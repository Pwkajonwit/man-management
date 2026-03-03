import { NextRequest, NextResponse } from 'next/server';

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const LINE_ADMIN_USER_ID_FROM_ENV = process.env.LINE_ADMIN_USER_ID || '';
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';

interface ReportPayload {
    projectName: string;
    adminLineUserId?: string;
    reportType?: 'project-summary' | 'today-team-load' | 'completed-last-2-days';
    teamLoad?: Array<{
        name: string;
        totalOpen: number;
        dueToday: number;
        overdue: number;
    }>;
    completedDigest?: {
        todayDate: string;
        yesterdayDate: string;
        todayDone: number;
        yesterdayDone: number;
        todayTasks?: string[];
        yesterdayTasks?: string[];
        todayMore?: number;
        yesterdayMore?: number;
    };
    metrics: {
        totalTasks: number;
        overdue: number;
        dueSoon: number;
        unassigned: number;
        notStarted: number;
        inProgress: number;
        completed: number;
        delayed: number;
    };
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

function isValidReportPayload(body: unknown): body is ReportPayload {
    if (!body || typeof body !== 'object') return false;
    const input = body as Record<string, unknown>;

    if (typeof input.projectName !== 'string' || !input.projectName.trim()) return false;

    if (input.adminLineUserId !== undefined && typeof input.adminLineUserId !== 'string') {
        return false;
    }
    if (
        input.reportType !== undefined
        && input.reportType !== 'project-summary'
        && input.reportType !== 'today-team-load'
        && input.reportType !== 'completed-last-2-days'
    ) {
        return false;
    }
    if (input.teamLoad !== undefined) {
        if (!Array.isArray(input.teamLoad)) return false;
        const isValid = input.teamLoad.every((entry) => {
            if (!entry || typeof entry !== 'object') return false;
            const item = entry as Record<string, unknown>;
            return (
                typeof item.name === 'string' &&
                typeof item.totalOpen === 'number' &&
                Number.isFinite(item.totalOpen) &&
                typeof item.dueToday === 'number' &&
                Number.isFinite(item.dueToday) &&
                typeof item.overdue === 'number' &&
                Number.isFinite(item.overdue)
            );
        });
        if (!isValid) return false;
    }

    if (input.completedDigest !== undefined) {
        if (!input.completedDigest || typeof input.completedDigest !== 'object') return false;
        const digest = input.completedDigest as Record<string, unknown>;
        if (typeof digest.todayDate !== 'string' || typeof digest.yesterdayDate !== 'string') return false;
        if (typeof digest.todayDone !== 'number' || !Number.isFinite(digest.todayDone)) return false;
        if (typeof digest.yesterdayDone !== 'number' || !Number.isFinite(digest.yesterdayDone)) return false;
        if (digest.todayTasks !== undefined) {
            if (!Array.isArray(digest.todayTasks) || !digest.todayTasks.every((item) => typeof item === 'string')) return false;
        }
        if (digest.yesterdayTasks !== undefined) {
            if (!Array.isArray(digest.yesterdayTasks) || !digest.yesterdayTasks.every((item) => typeof item === 'string')) return false;
        }
        if (digest.todayMore !== undefined && (typeof digest.todayMore !== 'number' || !Number.isFinite(digest.todayMore))) {
            return false;
        }
        if (digest.yesterdayMore !== undefined && (typeof digest.yesterdayMore !== 'number' || !Number.isFinite(digest.yesterdayMore))) {
            return false;
        }
    }

    if (!input.metrics || typeof input.metrics !== 'object') return false;

    const metrics = input.metrics as Record<string, unknown>;
    const requiredKeys = ['totalTasks', 'overdue', 'dueSoon', 'unassigned', 'notStarted', 'inProgress', 'completed', 'delayed'];
    return requiredKeys.every((key) => typeof metrics[key] === 'number' && Number.isFinite(metrics[key] as number));
}

function formatReportText(payload: ReportPayload): string {
    const generatedAt = new Date().toLocaleString('th-TH', { hour12: false });
    const reportType = payload.reportType || 'project-summary';

    if (reportType === 'completed-last-2-days') {
        const digest = payload.completedDigest;
        const todayTasks = digest?.todayTasks || [];
        const yesterdayTasks = digest?.yesterdayTasks || [];
        const todayMore = Math.max(0, digest?.todayMore || 0);
        const yesterdayMore = Math.max(0, digest?.yesterdayMore || 0);

        const lines = [
            'Completed Work Summary',
            `Project: ${payload.projectName}`,
            `Time: ${generatedAt}`,
            '------------------------------',
            `Today (${digest?.todayDate || '-'}) : ${digest?.todayDone ?? 0} tasks`,
        ];

        if (todayTasks.length === 0) {
            lines.push('- No completed tasks');
        } else {
            todayTasks.forEach((taskName) => lines.push(`- ${taskName}`));
            if (todayMore > 0) lines.push(`- +${todayMore} more`);
        }

        lines.push('------------------------------');
        lines.push(`Yesterday (${digest?.yesterdayDate || '-'}) : ${digest?.yesterdayDone ?? 0} tasks`);
        if (yesterdayTasks.length === 0) {
            lines.push('- No completed tasks');
        } else {
            yesterdayTasks.forEach((taskName) => lines.push(`- ${taskName}`));
            if (yesterdayMore > 0) lines.push(`- +${yesterdayMore} more`);
        }

        lines.push('------------------------------');
        lines.push(`Completed (All): ${payload.metrics.completed}`);
        lines.push(`Open Tasks: ${payload.metrics.totalTasks - payload.metrics.completed}`);
        return lines.join('\n');
    }

    if (reportType === 'today-team-load') {
        const lines = [
            'Team Load Report (Today)',
            `Project: ${payload.projectName}`,
            `Time: ${generatedAt}`,
            '------------------------------',
        ];

        if (!payload.teamLoad || payload.teamLoad.length === 0) {
            lines.push('No open tasks assigned today');
            return lines.join('\n');
        }

        payload.teamLoad.forEach((item) => {
            lines.push(`${item.name}`);
            lines.push(`Open: ${item.totalOpen} | Due Today: ${item.dueToday} | Overdue: ${item.overdue}`);
            lines.push('------------------------------');
        });
        lines.push(`Total Tasks: ${payload.metrics.totalTasks}`);
        lines.push(`Overdue Total: ${payload.metrics.overdue}`);
        return lines.join('\n');
    }

    return [
        'Project Report (Manual)',
        `Project: ${payload.projectName}`,
        `Time: ${generatedAt}`,
        '------------------------------',
        `Total Tasks: ${payload.metrics.totalTasks}`,
        `Overdue: ${payload.metrics.overdue}`,
        `Due Soon: ${payload.metrics.dueSoon}`,
        `Unassigned: ${payload.metrics.unassigned}`,
        '------------------------------',
        `Not Started: ${payload.metrics.notStarted}`,
        `In Progress: ${payload.metrics.inProgress}`,
        `Completed: ${payload.metrics.completed}`,
        `Delayed: ${payload.metrics.delayed}`,
    ].join('\n');
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
        if (!isValidReportPayload(body)) {
            return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
        }

        const targetLineUserId = (body.adminLineUserId || '').trim() || LINE_ADMIN_USER_ID_FROM_ENV.trim();
        if (!targetLineUserId) {
            return NextResponse.json(
                { ok: false, error: 'LINE admin user ID is not configured in Settings or environment' },
                { status: 500 }
            );
        }

        const text = formatReportText(body);

        const response = await fetch(LINE_PUSH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
                to: targetLineUserId,
                messages: [{ type: 'text', text }],
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
