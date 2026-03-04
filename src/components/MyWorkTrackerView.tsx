import React, { useMemo, useState } from 'react';
import { addDays, isPast, isToday } from 'date-fns';
import { Task, Project, TeamMember } from '@/types/construction';
import { getStatusColor, getStatusLabel } from '@/utils/statusUtils';
import { getTaskOwnerNames } from '@/utils/taskOwnerUtils';

interface MyWorkTrackerViewProps {
    tasks: Task[];
    projects: Project[];
    teamMembers: TeamMember[];
}

function isTaskDone(task: Task): boolean {
    return task.status === 'completed' || task.progress >= 100;
}

export default function MyWorkTrackerView({ tasks, projects, teamMembers }: MyWorkTrackerViewProps) {
    const selectableMembers = useMemo(
        () => teamMembers.filter((member) => member.memberType !== 'crew'),
        [teamMembers]
    );
    const [selectedMyWorkUser, setSelectedMyWorkUser] = useState<string>('');

    const activeMyWorkUser = useMemo(() => {
        if (selectableMembers.length === 0) return '';
        if (selectedMyWorkUser && selectableMembers.some((member) => member.name === selectedMyWorkUser)) {
            return selectedMyWorkUser;
        }
        return selectableMembers[0].name;
    }, [selectedMyWorkUser, selectableMembers]);


    const view = useMemo(() => {
        const myTasks = tasks
            .filter((task) => getTaskOwnerNames(task, teamMembers).includes(activeMyWorkUser))
            .sort((a, b) => new Date(a.planEndDate).getTime() - new Date(b.planEndDate).getTime());

        const now = new Date();
        const weekBoundary = addDays(now, 7);

        const overdue = myTasks.filter((task) => {
            if (isTaskDone(task) || !task.planEndDate) return false;
            const endDate = new Date(task.planEndDate);
            endDate.setHours(23, 59, 59, 999);
            return isPast(endDate);
        });

        const today = myTasks.filter((task) => {
            if (isTaskDone(task) || !task.planEndDate) return false;
            return isToday(new Date(task.planEndDate));
        });

        const thisWeek = myTasks.filter((task) => {
            if (isTaskDone(task) || !task.planEndDate) return false;
            const endDate = new Date(task.planEndDate);
            endDate.setHours(23, 59, 59, 999);
            return endDate > now && endDate <= weekBoundary;
        });

        const completed = myTasks.filter((task) => isTaskDone(task));
        const openTasks = myTasks.filter((task) => !isTaskDone(task));
        const inProgress = myTasks.filter((task) => task.status === 'in-progress' && !isTaskDone(task));
        const averageProgress = openTasks.length > 0
            ? Math.round(openTasks.reduce((sum, task) => sum + task.progress, 0) / openTasks.length)
            : 0;

        return {
            myTasks,
            openTasks,
            overdue,
            today,
            thisWeek,
            completed,
            inProgress,
            averageProgress,
        };
    }, [activeMyWorkUser, tasks, teamMembers]);

    const renderTaskRow = (task: Task) => {
        const project = projects.find((projectItem) => projectItem.id === task.projectId);
        return (
            <div key={task.id} className="p-4 hover:bg-[#f8fafc] transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <div className="text-[#676879] text-xs font-medium mb-1 uppercase tracking-wider truncate">
                        {project?.name || 'Unknown Project'} • {task.category}
                    </div>
                    <div className="text-[15px] font-medium text-[#323338] truncate">{task.name}</div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-[#676879]">
                        <span>Due: {task.planEndDate}</span>
                        <span>{task.planDuration} Days</span>
                    </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-left sm:text-right">
                        <div className="text-[11px] text-[#676879]">Progress</div>
                        <div className="text-[13px] font-bold text-[#323338]">{task.progress}%</div>
                    </div>
                    <div className={`min-w-[128px] h-[32px] px-3 flex items-center justify-center text-[12px] font-semibold rounded ${getStatusColor(task.status)} text-white`}>
                        {getStatusLabel(task.status)}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col min-w-0 bg-[#f5f6f8]">
            <header className="min-h-[64px] bg-white flex flex-wrap items-center px-4 sm:px-6 lg:px-8 py-3 border-b border-[#d0d4e4] gap-3 shrink-0 transition-all">
                <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-[#323338] truncate">My Work Tracker</h1>
                <div className="w-full sm:w-auto sm:ml-auto">
                    <select
                        value={activeMyWorkUser}
                        onChange={(e) => setSelectedMyWorkUser(e.target.value)}
                        className="w-full sm:w-auto bg-[#f5f6f8] border border-[#d0d4e4] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[#323338]"
                    >
                        {selectableMembers.map((member) => (
                            <option key={member.id} value={member.name}>{member.name}</option>
                        ))}
                        {selectableMembers.length === 0 && (
                            <option value="">No team members</option>
                        )}
                    </select>
                </div>
            </header>

            <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                <div className="max-w-[1300px] space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-[#d0d4e4]">
                            <div className="text-[#676879] text-[11px] uppercase font-semibold tracking-wider">Open</div>
                            <div className="text-3xl font-black text-[#323338] mt-1">{view.openTasks.length}</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-[#d0d4e4]">
                            <div className="text-[#676879] text-[11px] uppercase font-semibold tracking-wider">Overdue</div>
                            <div className="text-3xl font-black text-[#e2445c] mt-1">{view.overdue.length}</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-[#d0d4e4]">
                            <div className="text-[#676879] text-[11px] uppercase font-semibold tracking-wider">Due Today</div>
                            <div className="text-3xl font-black text-[#fdab3d] mt-1">{view.today.length}</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-[#d0d4e4]">
                            <div className="text-[#676879] text-[11px] uppercase font-semibold tracking-wider">In Progress</div>
                            <div className="text-3xl font-black text-[#579bfc] mt-1">{view.inProgress.length}</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-[#d0d4e4]">
                            <div className="text-[#676879] text-[11px] uppercase font-semibold tracking-wider">Avg Progress</div>
                            <div className="text-3xl font-black text-[#00c875] mt-1">{view.averageProgress}%</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6">
                        <div className="bg-white rounded-xl border border-[#d0d4e4] overflow-hidden">
                            <div className="px-4 py-3 border-b border-[#e6e9ef] bg-[#fff5f6]">
                                <h2 className="text-[14px] font-bold text-[#e2445c]">Overdue & Due Today</h2>
                            </div>
                            <div className="divide-y divide-[#e6e9ef]">
                                {[...view.overdue, ...view.today].slice(0, 8).map(renderTaskRow)}
                                {view.overdue.length + view.today.length === 0 && (
                                    <div className="p-8 text-center text-[#676879] text-sm">No urgent tasks right now.</div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-[#d0d4e4] overflow-hidden">
                            <div className="px-4 py-3 border-b border-[#e6e9ef] bg-[#f0f7ff]">
                                <h2 className="text-[14px] font-bold text-[#0052cc]">This Week</h2>
                            </div>
                            <div className="divide-y divide-[#e6e9ef]">
                                {view.thisWeek.slice(0, 8).map(renderTaskRow)}
                                {view.thisWeek.length === 0 && (
                                    <div className="p-8 text-center text-[#676879] text-sm">No tasks due this week.</div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-[#d0d4e4] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#e6e9ef] bg-[#eefbf3] flex items-center justify-between">
                            <h2 className="text-[14px] font-bold text-[#008a59]">Completed</h2>
                            <div className="text-[12px] text-[#676879]">{view.completed.length} tasks</div>
                        </div>
                        <div className="divide-y divide-[#e6e9ef]">
                            {view.completed.slice(0, 6).map(renderTaskRow)}
                            {view.completed.length === 0 && (
                                <div className="p-8 text-center text-[#676879] text-sm">No completed tasks yet.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}



