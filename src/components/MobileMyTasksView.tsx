'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { addDays, isPast, isToday } from 'date-fns';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, ListTodo, UserRound } from 'lucide-react';
import { Project, Task, TeamMember } from '@/types/construction';
import { getStatusColor, getStatusLabel } from '@/utils/statusUtils';
import { isTaskAssignedToCurrentUser } from '@/utils/taskOwnerUtils';
import { useAuth } from '@/contexts/AuthContext';

type FilterTab = 'all' | 'today' | 'soon' | 'overdue' | 'done';

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

export default function MobileMyTasksView({
    tasks,
    projects,
    teamMembers,
    currentUserName,
    onStatusChange,
}: MobileMyTasksViewProps) {
    const [activeTab, setActiveTab] = useState<FilterTab>('all');
    const [showProfileCard, setShowProfileCard] = useState(false);
    const { user } = useAuth();
    const profileName = user?.displayName || currentUserName || 'User';
    const profileInitial = profileName.substring(0, 2).toUpperCase();

    const myTasks = useMemo(() => {
        return tasks.filter((task) =>
            isTaskAssignedToCurrentUser(task, teamMembers, currentUserName, user?.lineUserId, user?.uid)
        );
    }, [tasks, teamMembers, currentUserName, user?.lineUserId, user?.uid]);

    const grouped = useMemo(() => {
        return {
            all: myTasks.filter((task) => !isTaskDone(task)),
            today: myTasks.filter((task) => task.planEndDate && isToday(new Date(task.planEndDate)) && !isTaskDone(task)),
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

    const tabs: Array<{ key: FilterTab; label: string; count: number }> = [
        { key: 'all', label: 'All', count: grouped.all.length },
        { key: 'today', label: 'Today', count: grouped.today.length },
        { key: 'soon', label: 'Soon', count: grouped.soon.length },
        { key: 'overdue', label: 'Overdue', count: grouped.overdue.length },
        { key: 'done', label: 'Done', count: grouped.done.length },
    ];

    return (
        <div className="min-h-screen bg-[#f5f6f8] md:bg-white">
            <header className="sticky top-0 z-20 bg-gradient-to-r from-[#4f9f2f] via-[#5cac37] to-[#71b545] px-4 py-3 shadow-[0_4px_14px_rgba(56,120,34,0.35)]">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-[18px] font-bold text-white tracking-[0.01em]">My Tasks</h1>
                        <p className="text-[12px] text-white/90 flex items-center gap-1 mt-0.5">
                            <UserRound className="w-3.5 h-3.5" /> {currentUserName}
                        </p>
                    </div>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setShowProfileCard((prev) => !prev)}
                            className="w-9 h-9 rounded-full border border-white/40 bg-white/20 hover:bg-white/30 transition-colors overflow-hidden flex items-center justify-center"
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
                                <span className="text-[11px] font-bold text-white">{profileInitial}</span>
                            )}
                        </button>
                        {showProfileCard && (
                            <div className="absolute right-0 mt-2 min-w-[170px] rounded-lg border border-[#d0d4e4] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.12)] px-3 py-2">
                                <p className="text-[11px] text-[#8f93a4] uppercase tracking-wide">Profile</p>
                                <p className="text-[13px] font-semibold text-[#323338] truncate mt-0.5">{profileName}</p>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="px-4 py-4 space-y-4 max-w-md mx-auto md:max-w-none md:mx-0 md:p-8">
                <div className="grid grid-cols-4 gap-2">
                    <div className="bg-white rounded-xl border border-[#d0d4e4] p-2.5">
                        <div className="text-[10px] uppercase tracking-wider text-[#8f93a4] font-semibold">Open</div>
                        <div className="text-[18px] font-black text-[#323338] mt-1">{stats.total}</div>
                    </div>
                    <div className="bg-white rounded-xl border border-[#d0d4e4] p-2.5">
                        <div className="text-[10px] uppercase tracking-wider text-[#8f93a4] font-semibold">Soon</div>
                        <div className="text-[18px] font-black text-[#fdab3d] mt-1">{stats.soon}</div>
                    </div>
                    <div className="bg-white rounded-xl border border-[#d0d4e4] p-2.5">
                        <div className="text-[10px] uppercase tracking-wider text-[#8f93a4] font-semibold">Overdue</div>
                        <div className="text-[18px] font-black text-[#e2445c] mt-1">{stats.overdue}</div>
                    </div>
                    <div className="bg-white rounded-xl border border-[#d0d4e4] p-2.5">
                        <div className="text-[10px] uppercase tracking-wider text-[#8f93a4] font-semibold">Done</div>
                        <div className="text-[18px] font-black text-[#00c875] mt-1">{stats.done}</div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-[#d0d4e4] p-2 flex gap-1 overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                                activeTab === tab.key
                                    ? 'bg-[#0073ea] text-white'
                                    : 'bg-[#f5f6f8] text-[#676879]'
                            }`}
                        >
                            {tab.label} ({tab.count})
                        </button>
                    ))}
                </div>

                <div className="space-y-3 pb-6">
                    {shownTasks.length === 0 && (
                        <div className="bg-white rounded-xl border border-[#d0d4e4] p-8 text-center">
                            <ListTodo className="w-7 h-7 mx-auto text-[#a0a2b1]" />
                            <p className="text-[13px] text-[#676879] mt-2">No tasks in this section</p>
                        </div>
                    )}

                    {shownTasks.map((task) => {
                        const project = projects.find((p) => p.id === task.projectId);
                        const overdue = isOverdue(task);
                        const dueSoon = isDueSoon(task);

                        return (
                            <div key={task.id} className="bg-white rounded-xl border border-[#d0d4e4] p-3.5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[11px] text-[#676879] truncate">
                                            {project?.name || 'No Project'} • {task.category}
                                        </p>
                                        <p className="text-[14px] font-semibold text-[#323338] leading-snug mt-1">{task.name}</p>
                                    </div>
                                    <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${getStatusColor(task.status)}`}>
                                        {getStatusLabel(task.status)}
                                    </span>
                                </div>

                                <div className="mt-3 flex items-center justify-between text-[11px]">
                                    <div className="text-[#676879] flex items-center gap-1">
                                        <CalendarDays className="w-3.5 h-3.5" /> {task.planEndDate}
                                    </div>
                                    {overdue ? (
                                        <div className="text-[#e2445c] font-semibold flex items-center gap-1">
                                            <AlertTriangle className="w-3.5 h-3.5" /> Overdue
                                        </div>
                                    ) : dueSoon ? (
                                        <div className="text-[#fdab3d] font-semibold flex items-center gap-1">
                                            <Clock3 className="w-3.5 h-3.5" /> Due soon
                                        </div>
                                    ) : (
                                        <div className="text-[#00a66a] font-semibold flex items-center gap-1">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> On track
                                        </div>
                                    )}
                                </div>

                                <div className="mt-3 flex items-center gap-2">
                                    <button
                                        onClick={() => onStatusChange(task.id, 'in-progress')}
                                        className="text-[11px] px-2.5 py-1.5 rounded-md bg-[#fff3e0] text-[#ad6800] font-semibold"
                                    >
                                        Working
                                    </button>
                                    <button
                                        onClick={() => onStatusChange(task.id, 'completed')}
                                        className="text-[11px] px-2.5 py-1.5 rounded-md bg-[#e6faef] text-[#007a4d] font-semibold"
                                    >
                                        Done
                                    </button>
                                    <Link
                                        href={`/me/tasks/${task.id}`}
                                        className="ml-auto text-[11px] px-2.5 py-1.5 rounded-md bg-[#eef4ff] text-[#0052cc] font-semibold"
                                    >
                                        Detail
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>
        </div>
    );
}

