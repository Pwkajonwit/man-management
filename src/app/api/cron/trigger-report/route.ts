import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type AdminReportType = 'project-summary' | 'today-team-load' | 'completed-last-2-days';

type CronSettings = {
    lineAdminUserId?: string;
    lineAdminGroupId?: string;
    lineReportType?: AdminReportType;
    adminReportProjectSummaryEnabled?: boolean;
    adminReportTodayTeamLoadEnabled?: boolean;
    adminReportCompletedLast2DaysEnabled?: boolean;
    employeeReportEnabled?: boolean;
    employeeReportFrequency?: 'daily' | 'weekly';
    employeeReportDayOfWeek?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
    employeeReportTemplate?: 'compact' | 'detailed';
    employeeReportTestMemberId?: string;
};

type AdminProjectDoc = {
    id: string;
    name?: string;
};

type AdminTaskDoc = {
    id: string;
    projectId: string;
    name: string;
    status: 'not-started' | 'in-progress' | 'completed' | 'delayed';
    planStartDate?: string;
    planEndDate?: string;
    planDuration?: number;
    actualEndDate?: string;
    assignedEmployeeIds?: string[];
    responsible?: string;
};

type AdminTeamMemberDoc = {
    id: string;
    name: string;
    lineUserId?: string;
};

type EmployeeReportTaskStatus = AdminTaskDoc['status'] | 'overdue';

function normalizeAppUrl(value?: string | null): string {
    return (value || '').trim().replace(/\/$/, '');
}

function resolveAppUrl(request: NextRequest): string {
    const requestOrigin = normalizeAppUrl(request.nextUrl?.origin);
    const configuredUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);

    if (configuredUrl) {
        try {
            if (new URL(configuredUrl).origin === requestOrigin) {
                return configuredUrl;
            }
        } catch {
            // Fall back to the current request origin when the configured URL is invalid.
        }
    }

    if (requestOrigin) return requestOrigin;

    const host = request.headers.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    return host ? `${protocol}://${host}` : 'http://localhost:3000';
}

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const db = getFirebaseAdminDb();
        const appUrl = resolveAppUrl(request);

        const settingsSnap = await db.collection('appConfig').doc('notificationSettings').get();
        const settings = (settingsSnap.data() || {}) as CronSettings;

        const adminLineUserId = settings.lineAdminUserId || '';
        const adminLineGroupId = settings.lineAdminGroupId || '';
        const hasAdminTarget = Boolean(adminLineUserId || adminLineGroupId || process.env.LINE_ADMIN_USER_ID);

        const projectsSnap = await db.collection('projects').where('status', 'in', ['planning', 'in-progress', 'on-hold']).get();
        const projects = projectsSnap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() } as AdminProjectDoc));

        const tasksSnap = await db.collection('tasks').get();
        const allTasks = tasksSnap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() } as AdminTaskDoc));

        let sentCount = 0;
        const fallbackAdminReportType = settings.lineReportType || 'project-summary';
        const isProjectSummaryEnabled =
            settings.adminReportProjectSummaryEnabled ?? (fallbackAdminReportType === 'project-summary');
        const isTodayTeamLoadEnabled =
            settings.adminReportTodayTeamLoadEnabled ?? (fallbackAdminReportType === 'today-team-load');
        const isCompletedLast2DaysEnabled =
            settings.adminReportCompletedLast2DaysEnabled ?? (fallbackAdminReportType === 'completed-last-2-days');
        const selectedAdminReportTypes = [
            isProjectSummaryEnabled ? 'project-summary' : null,
            isTodayTeamLoadEnabled ? 'today-team-load' : null,
            isCompletedLast2DaysEnabled ? 'completed-last-2-days' : null,
        ].filter(Boolean) as AdminReportType[];

        if (hasAdminTarget && selectedAdminReportTypes.length > 0) {
            const teamMembersSnap = await db.collection('teamMembers').get();
            const teamMembers = teamMembersSnap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() } as AdminTeamMemberDoc));

            for (const project of projects) {
                const projectTasks = allTasks.filter((task) => task.projectId === project.id);

                let overdue = 0;
                let dueSoon = 0;
                let unassigned = 0;
                const statusCounts = { 'not-started': 0, 'in-progress': 0, completed: 0, delayed: 0 };

                const today = new Date();
                const todayKey = today.toISOString().split('T')[0];

                projectTasks.forEach((task) => {
                    if (task.status === 'completed') statusCounts.completed += 1;
                    else if (task.status === 'not-started') statusCounts['not-started'] += 1;
                    else if (task.status === 'in-progress') statusCounts['in-progress'] += 1;
                    else if (task.status === 'delayed') statusCounts.delayed += 1;

                    if (task.status !== 'completed' && task.planEndDate) {
                        if (task.planEndDate < todayKey) overdue += 1;
                        else if (task.planEndDate === todayKey) dueSoon += 1;
                    }

                    if (!task.assignedEmployeeIds || task.assignedEmployeeIds.length === 0) {
                        unassigned += 1;
                    }
                });

                for (const adminReportType of selectedAdminReportTypes) {
                    const teamLoad = adminReportType === 'today-team-load'
                        ? teamMembers
                            .map((member) => {
                                const memberTasks = projectTasks.filter((task) => {
                                    const assignedIds = task.assignedEmployeeIds || [];
                                    const byId = assignedIds.includes(member.id);
                                    const byName = (task.responsible || '').trim() === (member.name || '').trim();
                                    return byId || byName;
                                });
                                const openTasks = memberTasks.filter((task) => task.status !== 'completed');
                                return {
                                    name: member.name,
                                    totalOpen: openTasks.length,
                                    dueToday: openTasks.filter((task) => task.planEndDate === todayKey).length,
                                    overdue: openTasks.filter((task) => task.planEndDate && task.planEndDate < todayKey).length,
                                };
                            })
                            .filter((item) => item.totalOpen > 0 || item.dueToday > 0 || item.overdue > 0)
                        : undefined;

                    const completedDigest = adminReportType === 'completed-last-2-days'
                        ? (() => {
                            const todayDate = new Date();
                            const yesterdayDate = new Date(todayDate);
                            yesterdayDate.setDate(yesterdayDate.getDate() - 1);
                            const todayLabel = todayDate.toLocaleDateString('th-TH');
                            const yesterdayLabel = yesterdayDate.toLocaleDateString('th-TH');
                            const todayIso = todayDate.toISOString().split('T')[0];
                            const yesterdayIso = yesterdayDate.toISOString().split('T')[0];
                            const completedTasks = projectTasks.filter((task) => task.status === 'completed');
                            const todayTasks = completedTasks.filter((task) => (task.actualEndDate || task.planEndDate) === todayIso);
                            const yesterdayTasks = completedTasks.filter((task) => (task.actualEndDate || task.planEndDate) === yesterdayIso);
                            return {
                                todayDate: todayLabel,
                                yesterdayDate: yesterdayLabel,
                                todayDone: todayTasks.length,
                                yesterdayDone: yesterdayTasks.length,
                                todayTasks: todayTasks.map((task) => task.name),
                                yesterdayTasks: yesterdayTasks.map((task) => task.name),
                            };
                        })()
                        : undefined;

                    const payload = {
                        projectName: project.name || 'ไม่มีชื่อโครงการ',
                        projectId: project.id,
                        adminLineUserId,
                        adminLineGroupId,
                        reportType: adminReportType,
                        teamLoad,
                        completedDigest,
                        metrics: {
                            totalTasks: projectTasks.length,
                            overdue,
                            dueSoon,
                            unassigned,
                            notStarted: statusCounts['not-started'],
                            inProgress: statusCounts['in-progress'],
                            completed: statusCounts.completed,
                            delayed: statusCounts.delayed,
                        },
                    };

                    try {
                        const response = await fetch(`${appUrl}/api/line-admin-report`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                        });

                        if (response.ok) sentCount += 1;
                    } catch (error) {
                        console.error(`Failed to send report for project ${project.id} (${adminReportType}):`, error);
                    }
                }
            }
        }

        let sentEmployeeCount = 0;
        const employeeReportEnabled = settings.employeeReportEnabled ?? false;

        if (employeeReportEnabled) {
            const freq = settings.employeeReportFrequency || 'weekly';
            let shouldRunEmployeeReport = true;

            if (freq === 'weekly') {
                const targetDay = settings.employeeReportDayOfWeek || 'monday';
                const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                const bkkTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
                const currentDayName = dayMap[bkkTime.getDay()];

                if (currentDayName !== targetDay) {
                    shouldRunEmployeeReport = false;
                }
            }

            if (shouldRunEmployeeReport) {
                const membersSnap = await db.collection('teamMembers').get();
                const teamMembers = membersSnap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() } as AdminTeamMemberDoc));

                const targetMembers = settings.employeeReportTestMemberId
                    ? teamMembers.filter((member) => member.id === settings.employeeReportTestMemberId)
                    : teamMembers.filter((member) => member.lineUserId && member.lineUserId.trim() !== '');

                for (const member of targetMembers) {
                    const assignedTasks = allTasks.filter((task) => task.assignedEmployeeIds && task.assignedEmployeeIds.includes(member.id));
                    if (assignedTasks.length === 0) continue;

                    let overdue = 0;
                    let dueSoon = 0;
                    const statusCounts = { 'not-started': 0, 'in-progress': 0, completed: 0 };
                    const today = new Date();
                    const todayKey = today.toISOString().split('T')[0];

                    const taskList = assignedTasks.map((task) => {
                        let status: EmployeeReportTaskStatus = task.status;
                        if (task.status === 'completed') statusCounts.completed += 1;
                        else if (task.status === 'not-started') statusCounts['not-started'] += 1;
                        else if (task.status === 'in-progress') statusCounts['in-progress'] += 1;

                        if (task.status !== 'completed' && task.planEndDate) {
                            if (task.planEndDate < todayKey) {
                                overdue += 1;
                                status = 'overdue';
                            } else if (task.planEndDate === todayKey) {
                                dueSoon += 1;
                            }
                        }

                        return {
                            name: task.name,
                            status,
                            dueDate: task.planEndDate,
                            startDate: task.planStartDate,
                            durationDays: task.planDuration,
                            projectName: projects.find((project) => project.id === task.projectId)?.name || 'Unknown',
                        };
                    });

                    const payload = {
                        to: member.lineUserId || '',
                        employeeName: member.name,
                        projectName: 'สรุปงานของฉัน',
                        periodLabel: 'งานปัจจุบัน',
                        template: settings.employeeReportTemplate || 'compact',
                        summary: {
                            total: assignedTasks.length,
                            overdue,
                            dueSoon,
                            inProgress: statusCounts['in-progress'],
                            notStarted: statusCounts['not-started'],
                            completed: statusCounts.completed,
                        },
                        tasks: taskList,
                    };

                    try {
                        const response = await fetch(`${appUrl}/api/line-employee-report`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                        });

                        if (response.ok) sentEmployeeCount += 1;
                    } catch (error) {
                        console.error(`Failed to send report for employee ${member.id}:`, error);
                    }
                }
            }
        }

        return NextResponse.json({
            ok: true,
            message: `สร้างและส่งรายงาน: แอดมิน ${sentCount} โครงการ, พนักงาน ${sentEmployeeCount} คน`,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}
