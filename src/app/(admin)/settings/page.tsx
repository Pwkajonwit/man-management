'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Bell, MessageSquare, RefreshCw, Save, Send, Settings2, UserPlus, Users } from 'lucide-react';
import LinearLoadingScreen from '@/components/LinearLoadingScreen';
import { useAppContext } from '@/contexts/AppContext';
import { Task, TeamMember } from '@/types/construction';

type ToggleSettingKey = 'notifyTaskAssigned' | 'notifyTaskStatusChanged' | 'notifyTaskCommentAdded';

const settingItems: Array<{
    key: ToggleSettingKey;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
}> = [
    {
        key: 'notifyTaskAssigned',
        title: 'แจ้งเตือนเมื่อมอบหมายงาน',
        description: 'ส่งข้อความ LINE เมื่อมีการมอบหมายงานให้ผู้รับผิดชอบใหม่',
        icon: UserPlus,
    },
    {
        key: 'notifyTaskStatusChanged',
        title: 'แจ้งเตือนเมื่อเปลี่ยนสถานะ',
        description: 'ส่งข้อความ LINE เมื่อสถานะงานถูกเปลี่ยน',
        icon: RefreshCw,
    },
    {
        key: 'notifyTaskCommentAdded',
        title: 'แจ้งเตือนการแสดงความคิดเห็น',
        description: 'ส่งข้อความ LINE เมื่อมีการอัปเดตงานหรือแสดงความคิดเห็น',
        icon: MessageSquare,
    },
];

const dayOptions = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
] as const;

const adminReportOptions = [
    {
        key: 'adminReportProjectSummaryEnabled' as const,
        label: 'สรุปโครงการ',
        hint: 'ภาพรวมงานทั้งหมดของแต่ละโครงการ',
    },
    {
        key: 'adminReportTodayTeamLoadEnabled' as const,
        label: 'ภาระงานทีมวันนี้',
        hint: 'สรุปงานเปิด, ครบกำหนดวันนี้ และงานค้างของแต่ละคน',
    },
    {
        key: 'adminReportCompletedLast2DaysEnabled' as const,
        label: 'เสร็จสิ้น 2 วันล่าสุด',
        hint: 'รวมงานที่เสร็จวันนี้และเมื่อวาน',
    },
];

const parseLineTargetIds = (value: string) => (
    value
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
);

const joinLineTargetIds = (ids: string[]) => (
    Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).join(', ')
);

function isTaskOverdue(task: Task): boolean {
    if (!task.planEndDate || task.status === 'completed') return false;
    const due = new Date(task.planEndDate);
    due.setHours(23, 59, 59, 999);
    return due.getTime() < Date.now();
}

function isTaskDueSoon(task: Task, days: number): boolean {
    if (!task.planEndDate || task.status === 'completed') return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(task.planEndDate);
    due.setHours(23, 59, 59, 999);
    const max = new Date(now);
    max.setDate(max.getDate() + days);
    max.setHours(23, 59, 59, 999);
    return due.getTime() >= now.getTime() && due.getTime() <= max.getTime();
}

export default function SettingsPage() {
    const {
        loading,
        notificationSettings,
        updateNotificationSettings,
        teamMembers,
        tasks,
    } = useAppContext();

    const [savingKey, setSavingKey] = useState<ToggleSettingKey | null>(null);
    const [isSavingLineConfig, setIsSavingLineConfig] = useState(false);
    const [isSendingTest, setIsSendingTest] = useState(false);

    const [lineAdminUserIdDraft, setLineAdminUserIdDraft] = useState('');
    const [selectedAdminMemberIds, setSelectedAdminMemberIds] = useState<string[]>([]);
    const [lineAdminGroupIdDraft, setLineAdminGroupIdDraft] = useState('');
    const [adminReportProjectSummaryEnabled, setAdminReportProjectSummaryEnabled] = useState(true);
    const [adminReportTodayTeamLoadEnabled, setAdminReportTodayTeamLoadEnabled] = useState(false);
    const [adminReportCompletedLast2DaysEnabled, setAdminReportCompletedLast2DaysEnabled] = useState(false);

    const [employeeReportEnabled, setEmployeeReportEnabled] = useState(false);
    const [employeeReportFrequency, setEmployeeReportFrequency] = useState<'daily' | 'weekly'>('weekly');
    const [employeeReportDayOfWeek, setEmployeeReportDayOfWeek] = useState<(typeof dayOptions)[number]>('monday');
    const [employeeReportTemplate, setEmployeeReportTemplate] = useState<'compact' | 'detailed'>('detailed');
    const [employeeReportTestMemberId, setEmployeeReportTestMemberId] = useState('');

    const reportableMembers = useMemo(
        () => teamMembers.filter((member) => member.memberType !== 'crew'),
        [teamMembers]
    );

    const membersWithLine = useMemo(
        () => reportableMembers.filter((member) => Boolean(member.lineUserId && member.lineUserId.trim())),
        [reportableMembers]
    );

    const selectedAdminLineUserIds = useMemo(
        () => selectedAdminMemberIds
            .map((memberId) => membersWithLine.find((member) => member.id === memberId)?.lineUserId?.trim())
            .filter((id): id is string => Boolean(id)),
        [membersWithLine, selectedAdminMemberIds]
    );

    const combinedAdminLineUserIdDraft = useMemo(
        () => joinLineTargetIds([
            ...selectedAdminLineUserIds,
            ...parseLineTargetIds(lineAdminUserIdDraft),
        ]),
        [lineAdminUserIdDraft, selectedAdminLineUserIds]
    );

    useEffect(() => {
        const savedAdminLineIds = parseLineTargetIds(notificationSettings.lineAdminUserId || '');
        const memberLineIdToMemberId = new Map<string, string>(
            membersWithLine
                .map((member) => [member.lineUserId?.trim() || '', member.id] as const)
                .filter(([lineUserId]) => Boolean(lineUserId))
        );
        const nextSelectedAdminMemberIds = savedAdminLineIds
            .map((lineUserId) => memberLineIdToMemberId.get(lineUserId))
            .filter((memberId): memberId is string => Boolean(memberId));
        const manualAdminLineIds = savedAdminLineIds.filter((lineUserId) => !memberLineIdToMemberId.has(lineUserId));

        setSelectedAdminMemberIds(Array.from(new Set(nextSelectedAdminMemberIds)));
        setLineAdminUserIdDraft(manualAdminLineIds.join(', '));
        setLineAdminGroupIdDraft(notificationSettings.lineAdminGroupId || '');
        setAdminReportProjectSummaryEnabled(notificationSettings.adminReportProjectSummaryEnabled ?? true);
        setAdminReportTodayTeamLoadEnabled(notificationSettings.adminReportTodayTeamLoadEnabled ?? false);
        setAdminReportCompletedLast2DaysEnabled(notificationSettings.adminReportCompletedLast2DaysEnabled ?? false);

        setEmployeeReportEnabled(notificationSettings.employeeReportEnabled ?? false);
        setEmployeeReportFrequency(notificationSettings.employeeReportFrequency || 'weekly');
        setEmployeeReportDayOfWeek(notificationSettings.employeeReportDayOfWeek || 'monday');
        setEmployeeReportTemplate(notificationSettings.employeeReportTemplate || 'detailed');
        setEmployeeReportTestMemberId(notificationSettings.employeeReportTestMemberId || '');
    }, [membersWithLine, notificationSettings]);

    const handleToggle = async (key: ToggleSettingKey) => {
        try {
            setSavingKey(key);
            await updateNotificationSettings({ [key]: !notificationSettings[key] });
        } catch (error) {
            console.error('Failed to update notification settings:', error);
            alert('ไม่สามารถอัปเดตการตั้งค่าการแจ้งเตือนได้ โปรดลองอีกครั้ง');
        } finally {
            setSavingKey(null);
        }
    };

    const handleSaveLineConfig = async () => {
        try {
            setIsSavingLineConfig(true);
            const nextPrimaryReportType =
                adminReportProjectSummaryEnabled ? 'project-summary'
                    : adminReportTodayTeamLoadEnabled ? 'today-team-load'
                        : adminReportCompletedLast2DaysEnabled ? 'completed-last-2-days'
                            : 'project-summary';
            await updateNotificationSettings({
                lineAdminUserId: combinedAdminLineUserIdDraft,
                lineAdminGroupId: lineAdminGroupIdDraft.trim(),
                lineReportType: nextPrimaryReportType,
                adminReportProjectSummaryEnabled,
                adminReportTodayTeamLoadEnabled,
                adminReportCompletedLast2DaysEnabled,
                employeeReportEnabled,
                employeeReportFrequency,
                employeeReportDayOfWeek,
                employeeReportTemplate,
                employeeReportTestMemberId,
            });
            alert('บันทึกการตั้งค่ารายงาน LINE แล้ว');
        } catch (error) {
            console.error('Failed to update LINE settings:', error);
            alert('ไม่สามารถอัปเดตการตั้งค่า LINE ได้ โปรดลองอีกครั้ง');
        } finally {
            setIsSavingLineConfig(false);
        }
    };

    const selectedMember = useMemo(
        () => reportableMembers.find((member) => member.id === employeeReportTestMemberId) || null,
        [reportableMembers, employeeReportTestMemberId]
    );

    useEffect(() => {
        if (!employeeReportTestMemberId) return;
        if (!reportableMembers.some((member) => member.id === employeeReportTestMemberId)) {
            setEmployeeReportTestMemberId('');
        }
    }, [employeeReportTestMemberId, reportableMembers]);

    const preview = useMemo(() => {
        if (!selectedMember) {
            return { total: 0, overdue: 0, dueSoon: 0, inProgress: 0, notStarted: 0, completed: 0, reportTasks: [] as Task[] };
        }

        const memberTasks = tasks.filter((task) => {
            const byIds = (task.assignedEmployeeIds || []).includes(selectedMember.id);
            const byName = (task.responsible || '').trim() === selectedMember.name;
            return byIds || byName;
        });
        const sortedTasks = [...memberTasks].sort((a, b) => new Date(a.planEndDate).getTime() - new Date(b.planEndDate).getTime());

        return {
            total: memberTasks.length,
            overdue: memberTasks.filter((task) => isTaskOverdue(task)).length,
            dueSoon: memberTasks.filter((task) => isTaskDueSoon(task, 2)).length,
            inProgress: memberTasks.filter((task) => task.status === 'in-progress').length,
            notStarted: memberTasks.filter((task) => task.status === 'not-started').length,
            completed: memberTasks.filter((task) => task.status === 'completed').length,
            reportTasks: sortedTasks,
        };
    }, [
        selectedMember,
        tasks,
    ]);

    const handleSendEmployeeTest = async () => {
        if (!selectedMember) {
            alert('Please select a team member');
            return;
        }
        if (!selectedMember.lineUserId) {
            alert('Selected member does not have LINE user ID');
            return;
        }

        try {
            setIsSendingTest(true);
            const response = await fetch('/api/line-employee-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: selectedMember.lineUserId,
                    employeeName: selectedMember.name,
                    projectName: 'สรุปงานของฉัน',
                    periodLabel: 'งานปัจจุบัน',
                    template: employeeReportTemplate,
                    summary: {
                        total: preview.total,
                        overdue: preview.overdue,
                        dueSoon: preview.dueSoon,
                        inProgress: preview.inProgress,
                        notStarted: preview.notStarted,
                        completed: preview.completed,
                    },
                    tasks: preview.reportTasks.map((task) => ({
                        name: task.name,
                        status: task.status,
                        startDate: task.planStartDate,
                        endDate: task.planEndDate,
                        durationDays: task.planDuration,
                        dueDate: task.planEndDate,
                        projectName: task.projectId || 'Unknown Project',
                    })),
                }),
            });

            const data = await response.json();
            if (!response.ok || !data?.ok) {
                throw new Error(data?.error || 'Failed to send employee report');
            }

            alert(`ส่งรายงานทดสอบไปยัง ${selectedMember.name} เรียบร้อยแล้ว`);
        } catch (error) {
            console.error('Failed to send employee report:', error);
            alert('ไม่สามารถส่งรายงานทดสอบให้พนักงานได้ โปรดตรวจสอบการตั้งค่า LINE');
        } finally {
            setIsSendingTest(false);
        }
    };

    if (loading) return <LinearLoadingScreen message="กำลังโหลดการตั้งค่า..." />;

    const normalizedSavedAdminLineUserId = joinLineTargetIds(parseLineTargetIds(notificationSettings.lineAdminUserId || ''));
    const isLineConfigChanged =
        combinedAdminLineUserIdDraft !== normalizedSavedAdminLineUserId ||
        lineAdminGroupIdDraft.trim() !== (notificationSettings.lineAdminGroupId || '').trim() ||
        adminReportProjectSummaryEnabled !== (notificationSettings.adminReportProjectSummaryEnabled ?? true) ||
        adminReportTodayTeamLoadEnabled !== (notificationSettings.adminReportTodayTeamLoadEnabled ?? false) ||
        adminReportCompletedLast2DaysEnabled !== (notificationSettings.adminReportCompletedLast2DaysEnabled ?? false) ||
        employeeReportEnabled !== (notificationSettings.employeeReportEnabled ?? false) ||
        employeeReportFrequency !== (notificationSettings.employeeReportFrequency || 'weekly') ||
        employeeReportDayOfWeek !== (notificationSettings.employeeReportDayOfWeek || 'monday') ||
        employeeReportTemplate !== (notificationSettings.employeeReportTemplate || 'detailed') ||
        employeeReportTestMemberId !== (notificationSettings.employeeReportTestMemberId || '');

    const toggleAdminMember = (memberId: string) => {
        setSelectedAdminMemberIds((prev) => (
            prev.includes(memberId)
                ? prev.filter((id) => id !== memberId)
                : [...prev, memberId]
        ));
    };

    const renderSwitch = (
        checked: boolean,
        onChange: (value: boolean) => void,
        label: string,
        hint?: string
    ) => (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-[#e6e9ef] px-3 py-2 bg-white">
            <div>
                <div className="text-[13px] font-medium text-[#323338]">{label}</div>
                {hint && <div className="text-[11px] text-[#676879] mt-0.5">{hint}</div>}
            </div>
            <button
                type="button"
                onClick={() => onChange(!checked)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-[#00c875]' : 'bg-[#c4c4c4]'}`}
            >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
        </div>
    );

    return (
        <div className="flex-1 flex flex-col min-w-0 bg-[#f5f6f8]">
            <header className="min-h-[64px] bg-white flex items-center px-4 sm:px-6 lg:px-8 py-3 border-b border-[#d0d4e4] gap-4 shrink-0 transition-all">
                <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-[#323338] truncate flex items-center gap-2">
                    <Bell className="w-7 h-7 text-[#0073ea]" />
                    ศูนย์รายงาน LINE
                </h1>
            </header>

            <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                <div className="max-w-[1200px] grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <div className="xl:col-span-2 space-y-4">
                        <div className="bg-white border border-[#d0d4e4] rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-[15px] font-semibold text-[#323338]">
                                <Settings2 className="w-4 h-4 text-[#0073ea]" />
                                การตั้งค่ารายงานผู้ดูแลระบบ
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <div className="text-[13px] font-medium text-[#323338]">เลือกผู้รับรายงานแอดมิน</div>
                                    <div className="max-h-52 overflow-y-auto rounded-lg border border-[#d0d4e4] bg-[#f8fafc] p-2 space-y-2">
                                        {membersWithLine.length === 0 ? (
                                            <div className="px-2 py-3 text-[12px] text-[#676879]">
                                                ยังไม่มีสมาชิกทีมที่ตั้งค่า LINE User ID
                                            </div>
                                        ) : (
                                            membersWithLine.map((member) => {
                                                const checked = selectedAdminMemberIds.includes(member.id);
                                                return (
                                                    <button
                                                        key={member.id}
                                                        type="button"
                                                        onClick={() => toggleAdminMember(member.id)}
                                                        className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                                                            checked
                                                                ? 'border-[#0073ea] bg-[#eef6ff]'
                                                                : 'border-[#e2e8f0] bg-white hover:bg-[#f5f8fc]'
                                                        }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="truncate text-[13px] font-semibold text-[#323338]">{member.name}</div>
                                                                <div className="mt-0.5 truncate text-[11px] text-[#676879]">
                                                                    {member.position || '-'} • {member.lineUserId}
                                                                </div>
                                                            </div>
                                                            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                                                                checked
                                                                    ? 'border-[#0073ea] bg-[#0073ea] text-white'
                                                                    : 'border-[#cbd5e1] bg-white text-transparent'
                                                            }`}>
                                                                ✓
                                                            </span>
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                    <div className="text-[11px] text-[#676879]">
                                        เลือกได้หลายคน ระบบจะส่งรายงาน LINE ให้ทุกคนที่เลือก
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="text-[12px] font-medium text-[#323338]">User ID เพิ่มเติม</div>
                                        <input
                                            type="text"
                                            value={lineAdminUserIdDraft}
                                            onChange={(e) => setLineAdminUserIdDraft(e.target.value)}
                                            placeholder="เช่น U123..., U456..."
                                            className="h-10 w-full px-3 border border-[#d0d4e4] rounded-lg text-[14px] outline-none focus:ring-2 focus:ring-[#0073ea]"
                                        />
                                        <div className="text-[11px] text-[#676879]">
                                            ใช้สำหรับผู้รับที่ไม่ได้อยู่ในรายชื่อสมาชิก คั่นหลาย ID ด้วย comma `,`
                                        </div>
                                    </div>
                                    {combinedAdminLineUserIdDraft && (
                                        <div className="rounded-lg border border-[#e6e9ef] bg-white px-3 py-2 text-[11px] text-[#516273] break-all">
                                            ส่งถึง: {combinedAdminLineUserIdDraft}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <div className="text-[13px] font-medium text-[#323338]">ส่งเข้ากลุ่ม LINE (Group ID)</div>
                                    <input
                                        type="text"
                                        value={lineAdminGroupIdDraft}
                                        onChange={(e) => setLineAdminGroupIdDraft(e.target.value)}
                                        placeholder="เช่น C1234567890abcdef..."
                                        className="h-10 w-full px-3 border border-[#d0d4e4] rounded-lg text-[14px] outline-none focus:ring-2 focus:ring-[#0073ea]"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <div className="text-[13px] font-medium text-[#323338]">ประเภทรายงานที่ต้องการส่งอัตโนมัติ</div>
                                    {adminReportOptions.map((option) => {
                                        const checked =
                                            option.key === 'adminReportProjectSummaryEnabled' ? adminReportProjectSummaryEnabled
                                                : option.key === 'adminReportTodayTeamLoadEnabled' ? adminReportTodayTeamLoadEnabled
                                                    : adminReportCompletedLast2DaysEnabled;
                                        const onChange =
                                            option.key === 'adminReportProjectSummaryEnabled' ? setAdminReportProjectSummaryEnabled
                                                : option.key === 'adminReportTodayTeamLoadEnabled' ? setAdminReportTodayTeamLoadEnabled
                                                    : setAdminReportCompletedLast2DaysEnabled;

                                        return (
                                            <div key={option.key}>
                                                {renderSwitch(checked, onChange, option.label, option.hint)}
                                            </div>
                                        );
                                    })}
                                    <div className="text-[11px] text-[#676879]">
                                        เลือกได้หลายแบบพร้อมกัน หรือจะปิดทั้งหมดเพื่อไม่ส่งรายงานแอดมินอัตโนมัติก็ได้
                                    </div>
                                </div>
                                <div className="rounded-lg border border-[#e6e9ef] bg-[#f8fbff] px-3 py-2 text-[12px] text-[#516273]">
                                    LINE OA ต้องถูกเชิญเข้ากลุ่มก่อน จึงจะส่งรายงานเข้ากลุ่มได้
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-[#d0d4e4] rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-[15px] font-semibold text-[#323338]">
                                <Users className="w-4 h-4 text-[#0073ea]" />
                                การตั้งค่ารายงานพนักงาน
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                                {renderSwitch(employeeReportEnabled, setEmployeeReportEnabled, 'เปิดใช้งานรายงานพนักงาน', 'อนุญาตให้ระบบส่งรายงานภาระงานส่วนบุคคลตามรอบอัตโนมัติ')}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <select
                                    value={employeeReportFrequency}
                                    onChange={(e) => setEmployeeReportFrequency(e.target.value as 'daily' | 'weekly')}
                                    className="h-10 px-3 border border-[#d0d4e4] rounded-lg text-[13px] outline-none bg-white"
                                >
                                    <option value="daily">ความถี่: รายวัน</option>
                                    <option value="weekly">ความถี่: รายสัปดาห์</option>
                                </select>
                                <select
                                    value={employeeReportDayOfWeek}
                                    onChange={(e) => setEmployeeReportDayOfWeek(e.target.value as (typeof dayOptions)[number])}
                                    disabled={employeeReportFrequency !== 'weekly'}
                                    className="h-10 px-3 border border-[#d0d4e4] rounded-lg text-[13px] outline-none bg-white disabled:opacity-60"
                                >
                                    {dayOptions.map((day) => (
                                        <option key={day} value={day}>{`วัน: ${day}`}</option>
                                    ))}
                                </select>
                                <select
                                    value={employeeReportTemplate}
                                    onChange={(e) => setEmployeeReportTemplate(e.target.value as 'compact' | 'detailed')}
                                    className="h-10 px-3 border border-[#d0d4e4] rounded-lg text-[13px] outline-none bg-white"
                                >
                                    <option value="compact">รูปแบบ: กะทัดรัด</option>
                                    <option value="detailed">รูปแบบ: ละเอียด</option>
                                </select>
                            </div>

                            <div className="rounded-lg border border-[#e6e9ef] bg-[#f8fbff] px-3 py-2 text-[12px] text-[#516273]">
                                ระบบอัตโนมัติของโปรเจ็กต์นี้จะรวมงานทั้งหมดที่มอบหมายให้พนักงานคนนั้นจริง ๆ
                                โดยใช้ความถี่, วันส่ง, รูปแบบรายงาน และสมาชิกทดสอบจากหน้านี้
                            </div>
                        </div>

                        <div className="bg-white border border-[#d0d4e4] rounded-xl p-4">
                            <div className="flex items-center gap-2 text-[15px] font-semibold text-[#323338] mb-3">
                                <RefreshCw className="w-4 h-4 text-[#0073ea]" />
                                Webhook Google Apps Script
                            </div>
                            <div className="rounded-lg border border-[#e6e9ef] bg-[#f8fbff] px-3 py-2 text-[12px] text-[#516273] mb-3">
                                ใช้ Apps Script เป็นตัวปลุก `/api/cron/trigger-report`
                                ตามเวลา 08:00 และ 17:00 เพื่อให้ระบบส่งรายงาน LINE อัตโนมัติ
                            </div>
                            <div className="rounded-lg border border-[#e6e9ef] bg-[#fffced] px-3 py-2 text-[12px] text-[#856404] mb-4">
                                ใช้ไฟล์ `google-apps-script.js` ที่ root ของโปรเจ็กต์เพื่อวางใน Google Apps Script
                                แล้วตั้ง trigger สำหรับเรียก cron route ของระบบ
                            </div>
                            <button
                                type="button"
                                onClick={() => void handleSaveLineConfig()}
                                disabled={!isLineConfigChanged || isSavingLineConfig}
                                className="h-10 px-4 inline-flex items-center justify-center gap-2 rounded-lg bg-[#0073ea] text-white text-[13px] font-medium hover:bg-[#0060c0] disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <Save className="w-4 h-4" />
                                บันทึกการตั้งค่าทั้งหมด
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white border border-[#d0d4e4] rounded-xl p-4 space-y-3 sticky">
                            <div className="text-[15px] font-semibold text-[#323338]">ทดสอบรายงานพนักงาน</div>
                            <select
                                value={employeeReportTestMemberId}
                                onChange={(e) => setEmployeeReportTestMemberId(e.target.value)}
                                className="w-full h-10 px-3 border border-[#d0d4e4] rounded-lg text-[13px] outline-none bg-white"
                            >
                                <option value="">เลือกสมาชิกทีม</option>
                                {membersWithLine.map((member: TeamMember) => (
                                    <option key={member.id} value={member.id}>{member.name}</option>
                                ))}
                            </select>

                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-lg border border-[#e6e9ef] p-2">
                                    <div className="text-[10px] text-[#676879]">เปิด</div>
                                    <div className="text-[18px] font-bold text-[#323338]">{preview.total}</div>
                                </div>
                                <div className="rounded-lg border border-[#ffe4e8] bg-[#fff5f7] p-2">
                                    <div className="text-[10px] text-[#676879]">เกินกำหนด</div>
                                    <div className="text-[18px] font-bold text-[#e2445c]">{preview.overdue}</div>
                                </div>
                                <div className="rounded-lg border border-[#ffeacc] bg-[#fff8ec] p-2">
                                    <div className="text-[10px] text-[#676879]">ใกล้กำหนด</div>
                                    <div className="text-[18px] font-bold text-[#fdab3d]">{preview.dueSoon}</div>
                                </div>
                            </div>

                            <div className="text-[12px] text-[#676879] space-y-1">
                                <div>กำลังดำเนินการ: <span className="font-semibold text-[#323338]">{preview.inProgress}</span></div>
                                <div>ยังไม่เริ่ม: <span className="font-semibold text-[#323338]">{preview.notStarted}</span></div>
                                <div>เสร็จสิ้น: <span className="font-semibold text-[#323338]">{preview.completed}</span></div>
                                <div>จำนวนงานทั้งหมด: <span className="font-semibold text-[#323338]">{preview.total}</span></div>
                            </div>

                            <button
                                type="button"
                                onClick={() => void handleSendEmployeeTest()}
                                disabled={isSendingTest || !employeeReportTestMemberId}
                                className="w-full h-10 px-4 inline-flex items-center justify-center gap-2 rounded-lg bg-[#1f2937] text-white text-[13px] font-medium hover:bg-[#111827] disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <Send className="w-4 h-4" />
                                ส่งรายงานทดสอบ
                            </button>

                            <div className="text-[11px] text-[#9ca3af]">
                                โหมดทดสอบจะส่งไปยังสมาชิกที่เลือกเท่านั้นและไม่ต้องการระบบอัตโนมัติ
                            </div>
                        </div>

                        {settingItems.map((item) => {
                            const Icon = item.icon;
                            const enabled = notificationSettings[item.key];
                            const isSaving = savingKey === item.key;

                            return (
                                <div key={item.key} className="bg-white border border-[#d0d4e4] rounded-xl p-4 flex items-center justify-between gap-3">
                                    <div className="flex items-start gap-2 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-[#edf5ff] text-[#0073ea] flex items-center justify-center shrink-0">
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[13px] font-semibold text-[#323338]">{item.title}</div>
                                            <div className="text-[11px] text-[#676879] mt-0.5">{item.description}</div>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => void handleToggle(item.key)}
                                        disabled={isSaving}
                                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${enabled ? 'bg-[#00c875]' : 'bg-[#c4c4c4]'} ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
