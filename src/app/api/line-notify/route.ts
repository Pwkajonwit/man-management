import { NextRequest, NextResponse } from 'next/server';

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';

type NotifyAction = 'assigned' | 'status_changed' | 'comment_added' | 'deadline_warning' | 'overdue';

interface NotifyPayload {
    to: string;
    taskName: string;
    action: NotifyAction;
    assignedBy?: string;
    newStatus?: string;
    projectName?: string;
    comment?: string;
}

interface FlexTextNode {
    type: 'text';
    text: string;
    size?: 'sm' | 'md' | 'lg';
    weight?: 'regular' | 'bold';
    color?: string;
    wrap?: boolean;
    margin?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
    style?: 'normal' | 'italic';
}

type FlexBoxNode = {
    type: 'box';
    layout: 'vertical' | 'horizontal' | 'baseline';
    contents: Array<FlexTextNode | FlexBoxNode | FlexButtonNode>;
    backgroundColor?: string;
    paddingAll?: string;
};

type FlexButtonNode = {
    type: 'button';
    action: {
        type: 'uri';
        label: string;
        uri: string;
    };
    style?: 'primary' | 'secondary' | 'link';
    color?: string;
    height?: 'sm' | 'md';
};

interface FlexMessage {
    type: 'flex';
    altText: string;
    contents: {
        type: 'bubble';
        size: 'mega' | 'kilo' | 'giga';
        header: FlexBoxNode;
        body: FlexBoxNode;
        footer: FlexBoxNode;
    };
}

const ALLOWED_ACTIONS = new Set<NotifyAction>([
    'assigned',
    'status_changed',
    'comment_added',
    'deadline_warning',
    'overdue',
]);

function asTrimmedString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
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

function validateNotifyPayload(body: unknown): NotifyPayload | null {
    if (!body || typeof body !== 'object') return null;

    const input = body as Record<string, unknown>;
    const to = asTrimmedString(input.to);
    const taskName = asTrimmedString(input.taskName);
    const action = asTrimmedString(input.action) as NotifyAction | null;

    if (!to || !taskName || !action || !ALLOWED_ACTIONS.has(action)) {
        return null;
    }

    return {
        to,
        taskName,
        action,
        assignedBy: asTrimmedString(input.assignedBy) || undefined,
        newStatus: asTrimmedString(input.newStatus) || undefined,
        projectName: asTrimmedString(input.projectName) || undefined,
        comment: asTrimmedString(input.comment) || undefined,
    };
}

export async function POST(request: NextRequest) {
    try {
        if (!LINE_CHANNEL_ACCESS_TOKEN) {
            return NextResponse.json(
                { ok: false, error: 'LINE_CHANNEL_ACCESS_TOKEN not configured' },
                { status: 500 }
            );
        }

        if (!isAllowedOrigin(request)) {
            return NextResponse.json(
                { ok: false, error: 'Forbidden origin' },
                { status: 403 }
            );
        }

        const payload = validateNotifyPayload(await request.json());
        if (!payload) {
            return NextResponse.json(
                { ok: false, error: 'Invalid payload' },
                { status: 400 }
            );
        }

        const flexMessage = buildFlexMessage(payload);

        const response = await fetch(LINE_PUSH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
                to: payload.to,
                messages: [flexMessage],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('LINE API error:', errorText);
            return NextResponse.json({ ok: false, error: errorText }, { status: response.status });
        }

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('LINE notify error:', error);
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}

function buildFlexMessage(payload: NotifyPayload): FlexMessage {
    const actionMeta: Record<NotifyAction, { title: string; badge: string; color: string }> = {
        assigned: { title: 'Task Assigned', badge: 'ASSIGNED', color: '#0052CC' },
        status_changed: { title: 'Status Updated', badge: 'STATUS', color: '#0F7B0F' },
        comment_added: { title: 'New Comment', badge: 'COMMENT', color: '#8A4B00' },
        deadline_warning: { title: 'Deadline Warning', badge: 'DUE SOON', color: '#B06A00' },
        overdue: { title: 'Overdue Alert', badge: 'OVERDUE', color: '#B42318' },
    };
    const statusLabels: Record<string, string> = {
        'not-started': 'Not Started',
        'in-progress': 'In Progress',
        completed: 'Completed',
        delayed: 'Delayed',
    };

    const meta = actionMeta[payload.action];
    const timestamp = new Date().toLocaleString('en-GB', { hour12: false });

    const row = (label: string, value: string, valueColor = '#111827'): FlexBoxNode => ({
        type: 'box',
        layout: 'horizontal',
        contents: [
            { type: 'text', text: label, size: 'sm', color: '#6B7280' },
            { type: 'text', text: value, size: 'sm', color: valueColor, weight: 'bold', wrap: true },
        ],
    });

    const detailRows: FlexBoxNode[] = [
        row('Action', meta.badge, meta.color),
        row('Time', timestamp),
    ];

    if (payload.newStatus) {
        detailRows.push(row('Status', statusLabels[payload.newStatus] || payload.newStatus, '#0B6BCB'));
    }
    if (payload.assignedBy) {
        detailRows.push(row('By', payload.assignedBy));
    }

    const bodyContents: Array<FlexTextNode | FlexBoxNode | FlexButtonNode> = [
        {
            type: 'text',
            text: payload.taskName,
            weight: 'bold',
            size: 'lg',
            color: '#111827',
            wrap: true,
        },
        {
            type: 'text',
            text: payload.projectName ? `Project: ${payload.projectName}` : 'Project: -',
            size: 'sm',
            color: '#4B5563',
            margin: 'sm',
            wrap: true,
        },
        {
            type: 'box',
            layout: 'vertical',
            contents: detailRows,
            backgroundColor: '#F3F4F6',
            paddingAll: '12px',
        },
    ];

    if (payload.comment) {
        bodyContents.push({
            type: 'text',
            text: 'Comment',
            size: 'sm',
            color: '#6B7280',
            margin: 'md',
            weight: 'bold',
        });
        bodyContents.push({
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: payload.comment,
                    size: 'sm',
                    color: '#1F2937',
                    wrap: true,
                },
            ],
            backgroundColor: '#FFFBEB',
            paddingAll: '12px',
        });
    }

    return {
        type: 'flex',
        altText: `${meta.title}: ${payload.taskName}`,
        contents: {
            type: 'bubble',
            size: 'mega',
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: 'Task Notification',
                        color: '#ffffff',
                        size: 'sm',
                        weight: 'bold',
                    },
                    {
                        type: 'text',
                        text: meta.title,
                        color: '#ffffff',
                        size: 'lg',
                        weight: 'bold',
                        margin: 'sm',
                    },
                ],
                backgroundColor: meta.color,
                paddingAll: '16px',
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: bodyContents,
                paddingAll: '16px',
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'button',
                        action: {
                            type: 'uri',
                            label: 'Open Task Board',
                            uri: process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app',
                        },
                        style: 'primary',
                        color: '#0052CC',
                        height: 'sm',
                    },
                ],
                paddingAll: '12px',
            },
        },
    };
}
