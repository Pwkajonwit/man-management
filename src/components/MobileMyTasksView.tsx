'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { addDays, format, isPast } from 'date-fns';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, ListTodo, UserRound } from 'lucide-react';
import { Project, Task, TeamMember } from '@/types/construction';
import { getStatusColor, getStatusLabel } from '@/utils/statusUtils';
import { getTaskOwnerNames as resolveTaskOwnerNames, isTaskAssignedToCurrentUser } from '@/utils/taskOwnerUtils';
import { useAuth } from '@/contexts/AuthContext';

type FilterTab = 'all' | 'soon' | 'overdue' | 'done';

interface MobileMyTasksViewProps {
    tasks: Task[];
    projects: Project[];
    teamMembers: TeamMember[];
    currentUserName: string;
    onStatusChange: (taskId: string, newStatus: Task['status']) => void;
}

function isTaskDone(task: Task): boolean {
    return task.status === 'completed' || task.progress >= 100;
}

function isOverdue(task: Task): boolean {
    if (isTaskDone(task) || !task.planEndDate) return false;
    const endDate = new Date(task.planEndDate);
    endDate.setHours(23, 59, 59, 999);
    return isPast(endDate);
}

function isDueSoon(task: Task): boolean {
    if (isTaskDone(task) || !task.planEndDate) return false;
    const endDate = new Date(task.planEndDate);
    endDate.setHours(23, 59, 59, 999);
    return !isPast(endDate) && endDate <= addDays(new Date(), 2);
}

function getPriorityLabel(priority?: Task['priority']): string {
    switch (priority) {
        case 'urgent':
            return 'Urgent';
        case 'high':
            return 'High';
        case 'medium':
            return 'Medium';
        case 'low':
            return 'Low';
        default:
            return 'Normal';
    }
}

function getPriorityBadgeClass(priority?: Task['priority']): string {
    switch (priority) {
        case 'urgent':
            return 'border-[#e9c3cb] bg-[#fff3f5] text-[#9b2f42]';
        case 'high':
            return 'border-[#f0d6b1] bg-[#fff8ee] text-[#8b5a1c]';
        case 'medium':
            return 'border-[#c8d7eb] bg-[#f0f6fd] text-[#2d5f92]';
        case 'low':
            return 'border-[#cfdae7] bg-[#f4f7fb] text-[#496178]';
        default:
            return 'border-[#cfdae7] bg-[#f4f7fb] text-[#5c6f83]';
    }
}

function formatDateDdMmYyyy(dateValue?: string): string {
    if (!dateValue) return '-';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '-';
    return format(date, 'dd/MM/yyyy');
}

function formatTaskTimeline(task: Task): string {
    const start = formatDateDdMmYyyy(task.planStartDate);
    const end = formatDateDdMmYyyy(task.planEndDate);
    if (start === '-' && end === '-') return '-';
    if (start === '-') return end;
    if (end === '-') return start;
    return start === end ? start : `${start} - ${end}`;
}

export default function MobileMyTasksView({
    tasks,
    projects,
    teamMembers,
    currentUserName,
    onStatusChange,
}: MobileMyTasksViewProps) {
    const [activeTab, setActiveTab] = useState<FilterTab>('all');
    const [showProfileCard, setShowProfileCard] = useState(false);
    const [pendingStatusChange, setPendingStatusChange] = useState<{
        taskId: string;
        taskName: string;
        targetStatus: Task['status'];
    } | null>(null);
    const [isChangingStatus, setIsChangingStatus] = useState(false);
    const { user } = useAuth();
    const profileName = user?.displayName || currentUserName || 'User';
    const profileInitial = profileName.substring(0, 2).toUpperCase();

    const completedProjectIds = useMemo(() => (
        new Set(
            projects
                .filter((project) => project.status === 'completed')
                .map((project) => project.id)
        )
    ), [projects]);

    const reportTasks = useMemo(() => (
        tasks.filter((task) => !completedProjectIds.has(task.projectId))
    ), [tasks, completedProjectIds]);

    const reportOwnerNamesByTaskId = useMemo(() => {
        const map = new Map<string, string[]>();
        reportTasks.forEach((task) => {
            map.set(task.id, resolveTaskOwnerNames(task, teamMembers));
        });
        return map;
    }, [reportTasks, teamMembers]);

    const myTasks = useMemo(() => {
        return reportTasks.filter((task) =>
            isTaskAssignedToCurrentUser(task, teamMembers, currentUserName, user?.lineUserId, user?.uid)
        );
    }, [reportTasks, teamMembers, currentUserName, user?.lineUserId, user?.uid]);

    const taskOwnerNamesById = useMemo(() => {
        const map = new Map<string, string[]>();
        myTasks.forEach((task) => {
            map.set(task.id, reportOwnerNamesByTaskId.get(task.id) || []);
        });
        return map;
    }, [myTasks, reportOwnerNamesByTaskId]);

    const grouped = useMemo(() => {
        return {
            all: myTasks.filter((task) => !isTaskDone(task)),
            soon: myTasks.filter((task) => isDueSoon(task)),
            overdue: myTasks.filter((task) => isOverdue(task)),
            done: myTasks.filter((task) => isTaskDone(task)),
        };
    }, [myTasks]);

    const shownTasks = grouped[activeTab]
        .slice()
        .sort((a, b) => new Date(a.planEndDate).getTime() - new Date(b.planEndDate).getTime());

    const stats = {
        total: grouped.all.length,
        overdue: grouped.overdue.length,
        soon: grouped.soon.length,
        done: grouped.done.length,
    };

    const requestStatusChange = (task: Task, targetStatus: Task['status']) => {
        if (task.status === targetStatus) return;
        setPendingStatusChange({
            taskId: task.id,
            taskName: task.name,
            targetStatus,
        });
    };

    const cancelStatusChange = () => {
        if (isChangingStatus) return;
        setPendingStatusChange(null);
    };

    const confirmStatusChange = async () => {
        if (!pendingStatusChange || isChangingStatus) return;
        try {
            setIsChangingStatus(true);
            await Promise.resolve(onStatusChange(pendingStatusChange.taskId, pendingStatusChange.targetStatus));
            setPendingStatusChange(null);
        } finally {
            setIsChangingStatus(false);
        }
    };

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f6f9fc_0%,#eef3f8_42%,#e8eef5_100%)] [font-family:'IBM_Plex_Sans',sans-serif]">
            <header className="sticky top-0 z-20 bg-gradient-to-r from-[#11283f] via-[#1a3858] to-[#20486e] px-4 py-3 border-b border-[#2c4f72] shadow-[0_6px_18px_rgba(13,33,55,0.28)]">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-[18px] font-bold text-white tracking-[0.02em]">My Tasks</h1>
                        <p className="text-[12px] text-[#d8e7f6] flex items-center gap-1 mt-0.5">
                            <UserRound className="w-3.5 h-3.5" /> {currentUserName}
                        </p>
                    </div>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setShowProfileCard((prev) => !prev)}
                            className="w-9 h-9 rounded-full border border-[#8cabca]/70 bg-[#2a4e71] hover:bg-[#325b82] transition-colors overflow-hidden flex items-center justify-center"
                            aria-label="Profile"
                            title="Profile"
                        >
                            {user?.pictureUrl ? (
                                <img
                                    src={user.pictureUrl}
                                    alt={profileName}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className="text-[11px] font-bold text-[#f0f6ff]">{profileInitial}</span>
                            )}
                        </button>
                        {showProfileCard && (
                            <div className="absolute right-0 mt-2 min-w-[170px] rounded-lg border border-[#c9d4e2] bg-white shadow-[0_12px_28px_rgba(12,34,58,0.2)] px-3 py-2">
                                <p className="text-[11px] text-[#6f7f92] uppercase tracking-wide">Profile</p>
                                <p className="text-[13px] font-semibold text-[#1e2f44] truncate mt-0.5">{profileName}</p>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="px-4 py-4 space-y-4 max-w-md mx-auto md:max-w-none md:mx-0 md:p-8">
                <div className="grid grid-cols-4 gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('all')}
                        className={`text-left bg-white rounded-xl border p-2.5 shadow-[0_2px_10px_rgba(30,56,86,0.06)] transition-all ${
                            activeTab === 'all'
                                ? 'border-[#2f5f90] ring-2 ring-[#2f5f90]/20'
                                : 'border-[#cfd9e6] hover:border-[#9fb4cc]'
                        }`}
                    >
                        <div className="text-[10px] uppercase tracking-wider text-[#6e7f92] font-semibold">Open</div>
                        <div className="text-[18px] font-black text-[#20374f] mt-1">{stats.total}</div>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('soon')}
                        className={`text-left bg-white rounded-xl border p-2.5 shadow-[0_2px_10px_rgba(30,56,86,0.06)] transition-all ${
                            activeTab === 'soon'
                                ? 'border-[#2f5f90] ring-2 ring-[#2f5f90]/20'
                                : 'border-[#cfd9e6] hover:border-[#9fb4cc]'
                        }`}
                    >
                        <div className="text-[10px] uppercase tracking-wider text-[#6e7f92] font-semibold">Soon</div>
                        <div className="text-[18px] font-black text-[#2b5f95] mt-1">{stats.soon}</div>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('overdue')}
                        className={`text-left bg-white rounded-xl border p-2.5 shadow-[0_2px_10px_rgba(30,56,86,0.06)] transition-all ${
                            activeTab === 'overdue'
                                ? 'border-[#9b2f42] ring-2 ring-[#9b2f42]/20'
                                : 'border-[#cfd9e6] hover:border-[#caa2ab]'
                        }`}
                    >
                        <div className="text-[10px] uppercase tracking-wider text-[#6e7f92] font-semibold">Overdue</div>
                        <div className="text-[18px] font-black text-[#9b2f42] mt-1">{stats.overdue}</div>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('done')}
                        className={`text-left bg-white rounded-xl border p-2.5 shadow-[0_2px_10px_rgba(30,56,86,0.06)] transition-all ${
                            activeTab === 'done'
                                ? 'border-[#1f4f7a] ring-2 ring-[#1f4f7a]/20'
                                : 'border-[#cfd9e6] hover:border-[#9fb4cc]'
                        }`}
                    >
                        <div className="text-[10px] uppercase tracking-wider text-[#6e7f92] font-semibold">Done</div>
                        <div className="text-[18px] font-black text-[#1f4f7a] mt-1">{stats.done}</div>
                    </button>
                </div>

                <div className="space-y-3 pb-6">
                    {shownTasks.length === 0 && (
                        <div className="bg-white rounded-xl border border-[#cfd9e6] p-8 text-center shadow-[0_2px_12px_rgba(30,56,86,0.06)]">
                            <ListTodo className="w-7 h-7 mx-auto text-[#8ea0b5]" />
                            <p className="text-[13px] text-[#5f7084] mt-2">No tasks in this section</p>
                        </div>
                    )}

                    {shownTasks.map((task) => {
                        const project = projects.find((p) => p.id === task.projectId);
                        const overdue = isOverdue(task);
                        const dueSoon = isDueSoon(task);
                        const ownerNames = taskOwnerNamesById.get(task.id) || [];
                        const progress = Math.max(0, Math.min(100, task.progress || 0));
                        const timelineLabel = formatTaskTimeline(task);
                        const isWorking = task.status === 'in-progress';
                        const isDone = isTaskDone(task);

                        return (
                            <div key={task.id} className="bg-white rounded-xl border border-[#cfd9e6] p-3.5 shadow-[0_3px_14px_rgba(22,46,73,0.08)]">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] text-[#5f7084] break-words [overflow-wrap:anywhere]">
                                            {project?.name || 'No Project'} • {task.category}
                                        </p>
                                        <p className="text-[14px] font-semibold text-[#1f3147] leading-snug mt-1 break-words [overflow-wrap:anywhere]">
                                            {task.name}
                                        </p>
                                    </div>
                                    <span className={`shrink-0 text-[10px] px-2 py-1 rounded-full font-semibold border border-[#d2ddea] ${getStatusColor(task.status)}`}>
                                        {getStatusLabel(task.status)}
                                    </span>
                                </div>

                                <div className="mt-2 flex items-center gap-2">
                                    <span className={`text-[10px] px-2 py-1 rounded-full font-semibold border ${getPriorityBadgeClass(task.priority)}`}>
                                        Priority: {getPriorityLabel(task.priority)}
                                    </span>
                                    <span className="text-[10px] px-2 py-1 rounded-full font-semibold border border-[#ced9e7] bg-[#f3f7fb] text-[#2a4a68]">
                                        Progress: {progress}%
                                    </span>
                                </div>

                                <div className="mt-3 flex items-center justify-between text-[11px]">
                                    <div className="text-[#5f7084] flex items-center gap-1">
                                        <CalendarDays className="w-3.5 h-3.5" /> {timelineLabel}
                                    </div>
                                    {overdue ? (
                                        <div className="text-[#9b2f42] font-semibold flex items-center gap-1">
                                            <AlertTriangle className="w-3.5 h-3.5" /> Overdue
                                        </div>
                                    ) : dueSoon ? (
                                        <div className="text-[#2f5f90] font-semibold flex items-center gap-1">
                                            <Clock3 className="w-3.5 h-3.5" /> Due soon
                                        </div>
                                    ) : (
                                        <div className="text-[#1f4f7a] font-semibold flex items-center gap-1">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> On track
                                        </div>
                                    )}
                                </div>

                                <div className="mt-2 h-2 rounded-full bg-[#e5edf6] overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-[#2f5f90] via-[#3b75b1] to-[#4a8ac9]"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                                    <div className="rounded-lg border border-[#d7e0ea] bg-[#f8fbff] px-2 py-1.5">
                                        <p className="text-[#6c7f93] uppercase tracking-wide text-[10px]">Owner</p>
                                        <p className="text-[#1f3147] font-semibold break-words [overflow-wrap:anywhere]">
                                            {ownerNames.length > 0 ? ownerNames.join(', ') : 'Unassigned'}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-[#d7e0ea] bg-[#f8fbff] px-2 py-1.5">
                                        <p className="text-[#6c7f93] uppercase tracking-wide text-[10px]">Duration</p>
                                        <p className="text-[#1f3147] font-semibold truncate">{task.planDuration || 0} days</p>
                                    </div>
                                </div>

                                {task.description && (
                                    <div className="mt-2 rounded-lg border border-[#d7e0ea] bg-[#f8fbff] px-2.5 py-2">
                                        <p className="text-[10px] uppercase tracking-wide text-[#6c7f93]">Description</p>
                                        <p className="text-[11px] text-[#44586c] mt-1 line-clamp-2">{task.description}</p>
                                    </div>
                                )}

                                <div className="mt-3 flex items-center gap-2">
                                    <button
                                        onClick={() => requestStatusChange(task, 'in-progress')}
                                        className={`text-[11px] px-2.5 py-1.5 rounded-md font-semibold border transition-all ${
                                            isWorking
                                                ? 'bg-gradient-to-r from-[#ffb347] to-[#ff8f1f] text-white border-[#e37b16] shadow-[0_3px_10px_rgba(255,143,31,0.35)]'
                                                : 'bg-[#fff4e8] text-[#9b5b16] border-[#ffd1a2] hover:bg-[#ffe9d3]'
                                        }`}
                                    >
                                        Working
                                    </button>
                                    <button
                                        onClick={() => requestStatusChange(task, 'completed')}
                                        className={`text-[11px] px-2.5 py-1.5 rounded-md font-semibold border transition-all ${
                                            isDone
                                                ? 'bg-gradient-to-r from-[#2acb7a] to-[#0cae5f] text-white border-[#0e9a58] shadow-[0_3px_10px_rgba(12,174,95,0.32)]'
                                                : 'bg-[#e9f9f0] text-[#0f8a52] border-[#bde8d0] hover:bg-[#dff4e9]'
                                        }`}
                                    >
                                        Done
                                    </button>
                                    <Link
                                        href={`/me/tasks/${task.id}`}
                                        className="ml-auto text-[11px] px-2.5 py-1.5 rounded-md bg-[#f1f5fa] text-[#24425f] font-semibold border border-[#cfd8e5]"
                                    >
                                        Detail
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>

            {pendingStatusChange && (
                <div className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] flex items-center justify-center px-4">
                    <div className="w-full max-w-sm rounded-xl border border-[#d0dbe8] bg-white shadow-[0_18px_42px_rgba(15,33,53,0.25)]">
                        <div className="px-4 py-3 border-b border-[#e4ebf4]">
                            <h3 className="text-[15px] font-bold text-[#1f3147]">Confirm Status Change</h3>
                        </div>
                        <div className="px-4 py-3 space-y-2">
                            <p className="text-[13px] text-[#42586f] leading-relaxed">
                                Change task status for <span className="font-semibold text-[#1f3147]">{pendingStatusChange.taskName}</span>?
                            </p>
                            <div className="text-[12px] text-[#5f7084]">
                                New status:{' '}
                                <span className="font-semibold text-[#1f3147]">
                                    {getStatusLabel(pendingStatusChange.targetStatus)}
                                </span>
                            </div>
                        </div>
                        <div className="px-4 py-3 border-t border-[#e4ebf4] flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={cancelStatusChange}
                                disabled={isChangingStatus}
                                className="px-3 py-1.5 rounded-md text-[12px] font-semibold bg-[#f1f5fa] border border-[#d3ddeb] text-[#24425f] hover:bg-[#e6edf6] disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void confirmStatusChange()}
                                disabled={isChangingStatus}
                                className={`px-3 py-1.5 rounded-md text-[12px] font-semibold text-white disabled:opacity-60 ${
                                    pendingStatusChange.targetStatus === 'completed'
                                        ? 'bg-[#17a864] hover:bg-[#119557]'
                                        : 'bg-[#f08f24] hover:bg-[#dd7f16]'
                                }`}
                            >
                                {isChangingStatus ? 'Updating...' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
