import { NextRequest, NextResponse } from 'next/server';

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';

interface EmployeeReportPayload {
    to: string;
    employeeName: string;
    projectName: string;
    periodLabel: string;
    template: 'compact' | 'detailed';
    summary: {
        total: number;
        overdue: number;
        dueSoon: number;
        inProgress: number;
        notStarted: number;
        completed: number;
    };
    tasks: Array<{
        name: string;
        status: string;
        dueDate: string;
        startDate?: string;
        endDate?: string;
        durationDays?: number;
        projectName?: string;
    }>;
}

function isAllowedOrigin(request: NextRequest): boolean {
    const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!configuredUrl) return true;

    const requestOrigin = request.headers.get('origin');
    if (!requestOrigin) return true;

    try {
        return new URL(configuredUrl).origin === requestOrigin;
    } catch {
        return false;
    }
}

function isValidPayload(body: unknown): body is EmployeeReportPayload {
    if (!body || typeof body !== 'object') return false;
    const input = body as Record<string, unknown>;

    const isValidString = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
    if (!isValidString(input.to)) return false;
    if (!isValidString(input.employeeName)) return false;
    if (!isValidString(input.projectName)) return false;
    if (!isValidString(input.periodLabel)) return false;
    if (input.template !== 'compact' && input.template !== 'detailed') return false;

    if (!input.summary || typeof input.summary !== 'object') return false;
    const summary = input.summary as Record<string, unknown>;
    const summaryKeys = ['total', 'overdue', 'dueSoon', 'inProgress', 'notStarted', 'completed'];
    if (!summaryKeys.every((key) => typeof summary[key] === 'number' && Number.isFinite(summary[key] as number))) {
        return false;
    }

    if (!Array.isArray(input.tasks)) return false;
    const tasksValid = input.tasks.every((task) => {
        if (!task || typeof task !== 'object') return false;
        const item = task as Record<string, unknown>;
        const base = isValidString(item.name) && isValidString(item.status) && isValidString(item.dueDate);
        const optionalDateValid =
            item.startDate === undefined || (typeof item.startDate === 'string' && item.startDate.trim().length > 0);
        const optionalEndDateValid =
            item.endDate === undefined || (typeof item.endDate === 'string' && item.endDate.trim().length > 0);
        const optionalDurationValid =
            item.durationDays === undefined || (typeof item.durationDays === 'number' && Number.isFinite(item.durationDays));
        const optionalProjectNameValid =
            item.projectName === undefined || (typeof item.projectName === 'string' && item.projectName.trim().length > 0);
        return base && optionalDateValid && optionalEndDateValid && optionalDurationValid && optionalProjectNameValid;
    });

    return tasksValid;
}

type FlexTextNode = {
    type: 'text';
    text: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    weight?: 'regular' | 'bold';
    color?: string;
    wrap?: boolean;
    margin?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
    align?: 'start' | 'center' | 'end';
    flex?: number;
};

type FlexBoxNode = {
    type: 'box';
    layout: 'vertical' | 'horizontal';
    contents: Array<FlexTextNode | FlexBoxNode>;
    margin?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
    paddingAll?: string;
    backgroundColor?: string;
    cornerRadius?: string;
    flex?: number;
    width?: string;
    height?: string;
    alignItems?: 'flex-start' | 'center' | 'flex-end';
    justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between';
    spacing?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
    borderWidth?: string;
    borderColor?: string;
};

function statusColor(status: string): string {
    const s = status.toLowerCase();
    if (s.includes('overdue') || s.includes('delayed') || s.includes('stuck')) return '#B42318';
    if (s.includes('progress')) return '#0c3b69';
    if (s.includes('complete') || s.includes('done')) return '#067647';
    if (s.includes('not')) return '#6B7280';
    return '#374151';
}

function isCompletedStatus(status: string): boolean {
    const normalized = status.toLowerCase();
    return normalized.includes('complete') || normalized.includes('done') || normalized.includes('เสร็จ');
}

function isInProgressStatus(status: string): boolean {
    const normalized = status.toLowerCase();
    return normalized.includes('progress') || normalized.includes('ดำเนินการ');
}

function isNotStartedStatus(status: string): boolean {
    const normalized = status.toLowerCase();
    return normalized.includes('not') || normalized.includes('ยังไม่เริ่ม');
}

function isOverdueTask(task: EmployeeReportPayload['tasks'][number], today: Date): boolean {
    const normalized = task.status.toLowerCase();
    if (
        normalized.includes('overdue')
        || normalized.includes('delayed')
        || normalized.includes('stuck')
        || normalized.includes('เกินกำหนด')
        || normalized.includes('ล่าช้า')
    ) {
        return true;
    }

    const dueDate = parseDate(task.dueDate);
    return dueDate ? dayDiff(dueDate, dayStart(today)) > 0 : false;
}

function isDueSoonTask(task: EmployeeReportPayload['tasks'][number], today: Date): boolean {
    if (isOverdueTask(task, today)) return false;
    const dueDate = parseDate(task.dueDate);
    if (!dueDate) return false;
    const diff = dayDiff(dayStart(today), dueDate);
    return diff >= 0 && diff <= 2;
}

function getScheduleTone(task: EmployeeReportPayload['tasks'][number], today: Date) {
    const dueDate = parseDate(task.dueDate);
    const todayStart = dayStart(today);
    const status = task.status.toLowerCase();

    if (status.includes('delayed') || (dueDate && dayDiff(dueDate, todayStart) > 0)) {
        return {
            bg: '#FEF2F2',
            border: '#FECACA',
            text: '#B42318',
            badge: 'เกินกำหนด',
        };
    }

    if (dueDate && isSameDay(dueDate, todayStart)) {
        return {
            bg: '#FFF7ED',
            border: '#FED7AA',
            text: '#C2410C',
            badge: 'ครบกำหนดวันนี้',
        };
    }

    if (dueDate) {
        const diff = dayDiff(todayStart, dueDate);
        if (diff === 1) {
            return {
                bg: '#FEF3C7',
                border: '#FDE68A',
                text: '#B45309',
                badge: 'ครบกำหนดพรุ่งนี้',
            };
        }
        if (diff === 2) {
            return {
                bg: '#EFF6FF',
                border: '#BFDBFE',
                text: '#1D4ED8',
                badge: 'ครบกำหนดอีก 2 วัน',
            };
        }
    }

    return {
        bg: '#F3F4F6',
        border: '#E5E7EB',
        text: '#374151',
        badge: 'ตามแผน',
    };
}

function parseDate(value?: string): Date | null {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

function dayStart(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function formatDateLabel(value?: string): string {
    const parsed = parseDate(value);
    if (!parsed) return value || '-';
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayDiff(start: Date, end: Date): number {
    const ms = dayStart(end).getTime() - dayStart(start).getTime();
    return Math.floor(ms / 86400000);
}

function isTaskWithinFourDayWindow(task: EmployeeReportPayload['tasks'][number], today: Date): boolean {
    const windowStart = addDays(today, -1);
    const windowEnd = addDays(today, 2);
    const dueDate = parseDate(task.dueDate);
    const startDate = parseDate(task.startDate) || dueDate;
    const endDate = parseDate(task.endDate) || dueDate || startDate;

    if (!startDate && !endDate) return false;

    const normalizedStart = startDate && endDate && startDate.getTime() <= endDate.getTime() ? startDate : endDate || startDate;
    const normalizedEnd = startDate && endDate && startDate.getTime() <= endDate.getTime() ? endDate : startDate || endDate;

    if (!normalizedStart || !normalizedEnd) return false;

    return dayStart(normalizedStart).getTime() <= dayStart(windowEnd).getTime()
        && dayStart(normalizedEnd).getTime() >= dayStart(windowStart).getTime();
}

function buildFourDayTimelineSection(
    tasks: EmployeeReportPayload['tasks'],
    today: Date,
    projectTitle?: string
): FlexBoxNode {
    const previousDay = addDays(today, -1);
    const tomorrow = addDays(today, 1);
    const twoDaysLater = addDays(today, 2);
    const timelineDays = [
        { key: 'previous', label: 'ก่อนหน้า', dayLabel: String(previousDay.getDate()), date: previousDay },
        { key: 'today', label: 'วันนี้', dayLabel: String(today.getDate()), date: today },
        { key: 'tomorrow', label: 'พรุ่งนี้', dayLabel: String(tomorrow.getDate()), date: tomorrow },
        { key: 'plus2', label: 'อีก 2 วัน', dayLabel: String(twoDaysLater.getDate()), date: twoDaysLater },
    ];
    const timelineTasks = tasks
        .filter((task) => isTaskWithinFourDayWindow(task, today))
        .sort((a, b) => {
            const aDue = parseDate(a.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
            const bDue = parseDate(b.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
            return aDue - bDue || a.name.localeCompare(b.name);
        });

    const contents: Array<FlexTextNode | FlexBoxNode> = [
            ...(projectTitle
                ? [{
                    type: 'text' as const,
                    text: projectTitle,
                    size: 'sm' as const,
                    weight: 'bold' as const,
                    color: '#111827',
                }]
                : []),
            {
                type: 'text',
                text: projectTitle ? 'ไทม์ไลน์ภาระงาน 4 วัน' : 'ไทม์ไลน์ภาระงาน 4 วัน',
                size: 'sm',
                weight: 'bold',
                color: '#374151',
                margin: projectTitle ? 'sm' : undefined,
            },
            ...(timelineTasks.length > 0
                ? [
                    {
                        type: 'box' as const,
                        layout: 'horizontal' as const,
                        margin: 'md' as const,
                        spacing: 'sm' as const,
                        contents: [
                            {
                                type: 'box' as const,
                                layout: 'vertical' as const,
                                width: '112px',
                                contents: [
                                    { type: 'text' as const, text: 'กำหนด', size: 'xs' as const, color: '#6B7280' },
                                ],
                            },
                            {
                                type: 'box' as const,
                                layout: 'horizontal' as const,
                                flex: 1,
                                spacing: 'sm' as const,
                                contents: timelineDays.map((day) => ({
                                    type: 'box' as const,
                                    layout: 'vertical' as const,
                                    flex: 1,
                                    alignItems: 'center' as const,
                                    contents: [
                                        {
                                            type: 'text' as const,
                                            text: day.label,
                                            size: 'xs' as const,
                                            color: '#6B7280',
                                            align: 'center' as const,
                                        },
                                        {
                                            type: 'text' as const,
                                            text: day.dayLabel,
                                            size: 'xs' as const,
                                            color: isSameDay(day.date, today) ? '#DC2626' : '#374151',
                                            weight: isSameDay(day.date, today) ? 'bold' as const : 'regular' as const,
                                            margin: 'sm' as const,
                                            align: 'center' as const,
                                        },
                                    ],
                                })),
                            },
                        ],
                    },
                    ...timelineTasks.slice(0, 6).map((task, index): FlexBoxNode => {
                        const tone = getScheduleTone(task, today);
                        const dueDate = parseDate(task.dueDate);
                        const startDate = parseDate(task.startDate) || dueDate;
                        const endDate = parseDate(task.endDate) || dueDate || startDate;
                        const normalizedStart = startDate && endDate && startDate.getTime() <= endDate.getTime() ? startDate : endDate;
                        const normalizedEnd = startDate && endDate && startDate.getTime() <= endDate.getTime() ? endDate : startDate;

                        return {
                            type: 'box' as const,
                            layout: 'vertical' as const,
                            margin: index === 0 ? 'sm' as const : 'md' as const,
                            paddingAll: '8px',
                            backgroundColor: '#FFFFFF',
                            cornerRadius: '8px',
                            contents: [
                                {
                                    type: 'text' as const,
                                    text: task.name,
                                    size: 'sm' as const,
                                    weight: 'bold' as const,
                                    color: '#111827',
                                    wrap: true,
                                },
                                {
                                    type: 'box' as const,
                                    layout: 'horizontal' as const,
                                    margin: 'sm' as const,
                                    spacing: 'sm' as const,
                                    contents: [
                                        {
                                            type: 'box' as const,
                                            layout: 'vertical' as const,
                                            width: '112px',
                                            contents: [
                                                {
                                                    type: 'text' as const,
                                                    text: formatDateLabel(task.startDate || task.dueDate),
                                                    size: 'xs' as const,
                                                    color: '#4B5563',
                                                },
                                                {
                                                    type: 'text' as const,
                                                    text: formatDateLabel(task.endDate || task.dueDate),
                                                    size: 'xs' as const,
                                                    color: '#4B5563',
                                                    margin: 'sm' as const,
                                                },
                                            ],
                                        },
                                        {
                                            type: 'box' as const,
                                            layout: 'horizontal' as const,
                                            flex: 1,
                                            spacing: 'sm' as const,
                                            contents: timelineDays.map((day) => {
                                                const inRange = normalizedStart && normalizedEnd
                                                    ? dayStart(day.date).getTime() >= dayStart(normalizedStart).getTime()
                                                        && dayStart(day.date).getTime() <= dayStart(normalizedEnd).getTime()
                                                    : false;
                                                const isDue = dueDate ? isSameDay(day.date, dueDate) : false;
                                                return {
                                                    type: 'box' as const,
                                                    layout: 'vertical' as const,
                                                    flex: 1,
                                                    paddingAll: '2px',
                                                    borderWidth: isDue ? '1px' : undefined,
                                                    borderColor: isDue ? tone.border : undefined,
                                                    backgroundColor: isSameDay(day.date, today) ? '#FFF1F2' : undefined,
                                                    cornerRadius: '4px',
                                                    contents: [
                                                        {
                                                            type: 'box' as const,
                                                            layout: 'vertical' as const,
                                                            height: '18px',
                                                            backgroundColor: isDue ? tone.text : inRange ? '#1D4ED8' : '#D1D5DB',
                                                            cornerRadius: '8px',
                                                            contents: [{ type: 'text' as const, text: ' ', size: 'xs' as const }],
                                                        },
                                                    ],
                                                };
                                            }),
                                        },
                                    ],
                                },
                                {
                                    type: 'box' as const,
                                    layout: 'horizontal' as const,
                                    margin: 'sm' as const,
                                    justifyContent: 'space-between' as const,
                                    contents: [
                                        {
                                            type: 'text' as const,
                                            text: task.status,
                                            size: 'xs' as const,
                                            color: statusColor(task.status),
                                            weight: 'bold' as const,
                                        },
                                        {
                                            type: 'text' as const,
                                            text: tone.badge,
                                            size: 'xs' as const,
                                            color: tone.text,
                                            weight: 'bold' as const,
                                            align: 'end' as const,
                                        },
                                    ],
                                },
                            ],
                        };
                    }),
                ]
                : [{
                    type: 'box' as const,
                    layout: 'vertical' as const,
                    paddingAll: '10px',
                    margin: 'md' as const,
                    backgroundColor: '#F9FAFB',
                    cornerRadius: '10px',
                    contents: [
                        { type: 'text' as const, text: 'ไม่มีงานที่อยู่ในช่วง 4 วันนี้', size: 'sm' as const, color: '#6B7280', align: 'center' as const },
                    ],
                }]),
            ...(timelineTasks.length > 6
                ? [{
                    type: 'text' as const,
                    text: `+ อีก ${timelineTasks.length - 6} งานในช่วง 4 วันนี้`,
                    size: 'xs' as const,
                    color: '#6B7280',
                    margin: 'sm' as const,
                    align: 'center' as const,
                }]
                : []),
    ];

    return {
        type: 'box',
        layout: 'vertical',
        margin: 'md',
        paddingAll: '10px',
        backgroundColor: '#F3F4F6',
        cornerRadius: '10px',
        contents,
    };
}

function groupTasksByProject(tasks: EmployeeReportPayload['tasks']) {
    const grouped = new Map<string, EmployeeReportPayload['tasks']>();
    tasks.forEach((task) => {
        const project = (task.projectName || 'โครงการที่ไม่รู้จัก').trim() || 'โครงการที่ไม่รู้จัก';
        if (!grouped.has(project)) grouped.set(project, []);
        grouped.get(project)?.push(task);
    });
    return Array.from(grouped.entries()).map(([projectName, items]) => ({ projectName, tasks: items }));
}

function buildFlexMessage(payload: EmployeeReportPayload) {
    const today = dayStart(new Date());
    const visibleTasks = payload.tasks.filter((task) => !isCompletedStatus(task.status));
    const timelineTasks = visibleTasks.filter((task) => isTaskWithinFourDayWindow(task, today));
    const visibleSummary = {
        total: timelineTasks.length,
        overdue: timelineTasks.filter((task) => isOverdueTask(task, today)).length,
        dueSoon: timelineTasks.filter((task) => isDueSoonTask(task, today)).length,
        inProgress: timelineTasks.filter((task) => isInProgressStatus(task.status)).length,
        notStarted: timelineTasks.filter((task) => isNotStartedStatus(task.status)).length,
    };
    const groupedProjectTasks = groupTasksByProject(timelineTasks);
    const multiProjectMode = groupedProjectTasks.length > 1;
    const generatedAt = new Date().toLocaleString('en-GB', { hour12: false });
    const summaryCards: FlexBoxNode[] = [
        {
            type: 'box',
            layout: 'vertical',
            contents: [
                { type: 'text', text: 'เปิด', size: 'xs', color: '#6B7280', align: 'center' },
                { type: 'text', text: String(visibleSummary.total), size: 'lg', weight: 'bold', color: '#111827', align: 'center' },
            ],
            paddingAll: '8px',
            backgroundColor: '#EFF6FF',
            cornerRadius: '8px',
            flex: 1,
        },
        {
            type: 'box',
            layout: 'vertical',
            contents: [
                { type: 'text', text: 'เกินกำหนด', size: 'xs', color: '#6B7280', align: 'center' },
                { type: 'text', text: String(visibleSummary.overdue), size: 'lg', weight: 'bold', color: '#B42318', align: 'center' },
            ],
            paddingAll: '8px',
            backgroundColor: '#FEF2F2',
            cornerRadius: '8px',
            flex: 1,
        },
        {
            type: 'box',
            layout: 'vertical',
            contents: [
                { type: 'text', text: 'ใกล้ครบกำหนด', size: 'xs', color: '#6B7280', align: 'center' },
                { type: 'text', text: String(visibleSummary.dueSoon), size: 'lg', weight: 'bold', color: '#B54708', align: 'center' },
            ],
            paddingAll: '8px',
            backgroundColor: '#FFF7ED',
            cornerRadius: '8px',
            flex: 1,
        },
    ];

    const simpleTaskRows: FlexBoxNode[] = timelineTasks.slice(0, 4).map((task, index) => ({
        type: 'box',
        layout: 'vertical',
        margin: index === 0 ? 'none' : 'sm',
        paddingAll: '10px',
        backgroundColor: '#FFFFFF',
        cornerRadius: '8px',
        contents: [
            {
                type: 'text',
                text: multiProjectMode ? `[โครงการ: ${task.projectName || 'ไม่รู้จัก'}] ${task.name}` : task.name,
                size: 'sm',
                weight: 'bold',
                color: '#111827',
                wrap: true
            },
            {
                type: 'box',
                layout: 'horizontal',
                margin: 'sm',
                contents: [
                    { type: 'text', text: task.status, size: 'xs', color: statusColor(task.status), weight: 'bold' },
                    { type: 'text', text: `ครบกำหนด ${formatDateLabel(task.dueDate)}`, size: 'xs', color: '#6B7280', align: 'end' },
                ],
            },
        ],
    }));

    const bodyContents: Array<FlexTextNode | FlexBoxNode> = [
        {
            type: 'box',
            layout: 'vertical',
            paddingAll: '12px',
            backgroundColor: '#EEF3F8',
            cornerRadius: '10px',
            contents: [
                { type: 'text', text: 'รายงาน', size: 'sm', color: '#475467', weight: 'bold' },
                { type: 'text', text: 'สรุปภาระงานพนักงาน', size: 'md', weight: 'bold', color: '#0F172A', margin: 'sm' },
                { type: 'text', text: `สร้างเมื่อ: ${generatedAt}`, size: 'xs', color: '#475467', margin: 'sm' },
            ],
        },
        {
            type: 'text',
            text: `${payload.employeeName} - ${payload.periodLabel}`,
            size: 'md',
            weight: 'bold',
            color: '#111827',
            wrap: true,
            margin: 'md',
        },
        {
            type: 'text',
            text: multiProjectMode ? `โครงการ: ${groupedProjectTasks.length} กลุ่ม (ทุกโครงการ)` : `โครงการ: ${payload.projectName}`,
            size: 'sm',
            color: '#4B5563',
            margin: 'sm',
            wrap: true,
        },
        {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            spacing: 'sm',
            contents: summaryCards,
        },
        {
            type: 'text',
            text: `กำลังดำเนินการ ${visibleSummary.inProgress} | ยังไม่เริ่ม ${visibleSummary.notStarted}`,
            size: 'xs',
            color: '#4B5563',
            margin: 'md',
            wrap: true,
        },
    ];

    if (timelineTasks.length > 0) {
        if (payload.template === 'detailed') {
            if (multiProjectMode) {
                bodyContents.push({
                    type: 'text',
                    text: 'แบ่งตามโครงการ',
                    size: 'sm',
                    weight: 'bold',
                    color: '#374151',
                    margin: 'md',
                });
                groupedProjectTasks.slice(0, 3).forEach((group) => {
                    bodyContents.push(buildFourDayTimelineSection(group.tasks, today, group.projectName));
                });
            } else {
                bodyContents.push(buildFourDayTimelineSection(timelineTasks, today));
            }
        } else {
            bodyContents.push({
                type: 'text',
                text: '\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e07\u0e32\u0e19\u0e2b\u0e25\u0e31\u0e01',
                size: 'sm',
                weight: 'bold',
                color: '#374151',
                margin: 'md',
            });
            bodyContents.push({
                type: 'box',
                layout: 'vertical',
                margin: 'sm',
                backgroundColor: '#F3F4F6',
                paddingAll: '8px',
                cornerRadius: '10px',
                contents: simpleTaskRows,
            });
        }
    } else {
        bodyContents.push({
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            paddingAll: '10px',
            backgroundColor: '#F9FAFB',
            cornerRadius: '10px',
            contents: [
                { type: 'text', text: 'ไม่มีงานค้างที่ต้องติดตามในช่วงเวลานี้', size: 'sm', color: '#6B7280', align: 'center' },
            ],
        });
    }

    return {
        type: 'flex',
        altText: `รายงานพนักงาน: ${payload.employeeName}`,
        contents: {
            type: 'bubble',
            size: 'giga',
            body: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '16px',
                contents: bodyContents,
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '12px',
                contents: [
                    { type: 'text', text: `สร้างเมื่อ: ${generatedAt}`, size: 'xs', color: '#6B7280', align: 'center' },
                ],
            },
        },
    };
}

export async function POST(request: NextRequest) {
    try {
        if (!LINE_CHANNEL_ACCESS_TOKEN) {
            return NextResponse.json({ ok: false, error: 'LINE_CHANNEL_ACCESS_TOKEN not configured' }, { status: 500 });
        }
        if (!isAllowedOrigin(request)) {
            return NextResponse.json({ ok: false, error: 'Forbidden origin' }, { status: 403 });
        }

        const body = await request.json();
        if (!isValidPayload(body)) {
            return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
        }

        const response = await fetch(LINE_PUSH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
                to: body.to.trim(),
                messages: [buildFlexMessage(body)],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json({ ok: false, error: errorText }, { status: response.status });
        }

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}
