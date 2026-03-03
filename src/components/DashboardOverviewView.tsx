import React, { useMemo } from 'react';
import { AlertTriangle, Clock3, UserX2, UsersRound } from 'lucide-react';
import { addDays, isPast } from 'date-fns';
import { Task, TeamMember } from '@/types/construction';
import { getTaskOwnerNames, isTaskUnassigned } from '@/utils/taskOwnerUtils';

interface DashboardOverviewViewProps {
    tasks: Task[];
    teamMembers: TeamMember[];
}

export default function DashboardOverviewView({ tasks, teamMembers }: DashboardOverviewViewProps) {
    const metrics = useMemo(() => {
        const now = new Date();
        const dueSoonBoundary = addDays(now, 2);
        const isTaskDone = (task: Task) => task.status === 'completed' || task.progress >= 100;
        const teamOnlyMembers = teamMembers.filter((member) => member.memberType !== 'crew');
        const crewOnlyMembers = teamMembers.filter((member) => member.memberType === 'crew');

        const overdueTasks = tasks.filter((task) => {
            if (isTaskDone(task) || !task.planEndDate) return false;
            const endDate = new Date(task.planEndDate);
            endDate.setHours(23, 59, 59, 999);
            return isPast(endDate);
        });

        const dueSoonTasks = tasks.filter((task) => {
            if (isTaskDone(task) || !task.planEndDate) return false;
            const endDate = new Date(task.planEndDate);
            endDate.setHours(23, 59, 59, 999);
            return !isPast(endDate) && endDate <= dueSoonBoundary;
        });

        const unassignedTasks = tasks.filter((task) => isTaskUnassigned(task, teamMembers));

        const buildMemberLoad = (members: TeamMember[]) =>
            members.map((member) => {
                const memberTasks = tasks.filter((task) => getTaskOwnerNames(task, teamMembers).includes(member.name));
                const openTasks = memberTasks.filter((task) => !isTaskDone(task));
                const assignedHours = openTasks.reduce((sum, task) => sum + (task.estimatedHours ?? 8), 0);
                const capacity = member.capacityHoursPerWeek ?? 40;
                const utilization = capacity > 0 ? Math.round((assignedHours / capacity) * 100) : 0;
                const overdue = openTasks.filter((task) => {
                    if (isTaskDone(task) || !task.planEndDate) return false;
                    const endDate = new Date(task.planEndDate);
                    endDate.setHours(23, 59, 59, 999);
                    return isPast(endDate);
                }).length;

                return {
                    member,
                    memberTasks,
                    openTaskCount: openTasks.length,
                    assignedHours,
                    capacity,
                    utilization,
                    overdue,
                    completed: memberTasks.filter((task) => isTaskDone(task)).length,
                    inProgress: memberTasks.filter((task) => task.status === 'in-progress' && !isTaskDone(task)).length,
                };
            })
            .sort((a, b) => b.utilization - a.utilization || b.assignedHours - a.assignedHours);

        const teamLoad = buildMemberLoad(teamOnlyMembers);
        const crewLoad = buildMemberLoad(crewOnlyMembers);
        const overloadedMembers = [...teamLoad, ...crewLoad].filter((entry) => entry.utilization > 100);

        return {
            overdueTasks,
            dueSoonTasks,
            unassignedTasks,
            teamOnlyMembers,
            crewOnlyMembers,
            teamLoad,
            crewLoad,
            overloadedMembers,
        };
    }, [tasks, teamMembers]);

    return (
        <div className="flex-1 flex flex-col min-w-0 bg-[#f5f6f8]">
            <header className="min-h-[64px] bg-white flex items-center px-4 sm:px-6 lg:px-8 py-3 border-b border-[#d0d4e4] gap-4 shrink-0 transition-all">
                <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-[#323338] truncate">Team and Crew Overview Dashboard</h1>
            </header>

            <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                <div className="max-w-[1500px] space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl border border-[#d0d4e4] p-4">
                            <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">Overdue Tasks</div>
                            <div className="text-3xl font-black text-[#e2445c] mt-1">{metrics.overdueTasks.length}</div>
                        </div>
                        <div className="bg-white rounded-xl border border-[#d0d4e4] p-4">
                            <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">Due Soon (48h)</div>
                            <div className="text-3xl font-black text-[#fdab3d] mt-1">{metrics.dueSoonTasks.length}</div>
                        </div>
                        <div className="bg-white rounded-xl border border-[#d0d4e4] p-4">
                            <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">Unassigned</div>
                            <div className="text-3xl font-black text-[#579bfc] mt-1">{metrics.unassignedTasks.length}</div>
                        </div>
                        <div className="bg-white rounded-xl border border-[#d0d4e4] p-4">
                            <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">Overloaded Members</div>
                            <div className="text-3xl font-black text-[#323338] mt-1">{metrics.overloadedMembers.length}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6">
                        <div className="bg-white rounded-xl border border-[#d0d4e4] overflow-hidden">
                            <div className="px-5 py-4 border-b border-[#e6e9ef] flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h2 className="text-[15px] font-bold text-[#323338]">Workload by Group</h2>
                                    <p className="text-[12px] text-[#676879]">Capacity vs assigned hours</p>
                                </div>
                                <div className="text-[12px] text-[#676879] flex items-center gap-3">
                                    <span>{metrics.teamOnlyMembers.length} team</span>
                                    <span>{metrics.crewOnlyMembers.length} crew</span>
                                </div>
                            </div>

                            <div className="divide-y divide-[#e6e9ef]">
                                {metrics.teamLoad.length > 0 && (
                                    <div className="px-5 py-2 bg-[#f8f9fc] text-[11px] font-bold tracking-wide text-[#676879] uppercase">
                                        Team
                                    </div>
                                )}
                                {metrics.teamLoad.map((entry) => {
                                    const overload = entry.utilization > 100;
                                    const warning = entry.utilization >= 85 && entry.utilization <= 100;
                                    const statusColor = overload ? 'text-[#e2445c]' : warning ? 'text-[#fdab3d]' : 'text-[#00c875]';
                                    const statusBg = overload ? 'bg-[#ffebef]' : warning ? 'bg-[#fff6e6]' : 'bg-[#e6faef]';

                                    return (
                                        <div key={`team-${entry.member.id}`} className="px-5 py-4 hover:bg-[#f9fafb] transition-colors">
                                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[14px] font-semibold text-[#323338] truncate">{entry.member.name}</span>
                                                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${statusBg} ${statusColor}`}>
                                                            {entry.utilization}%
                                                        </span>
                                                    </div>
                                                    <div className="text-[12px] text-[#676879] mt-0.5 truncate">{entry.member.position} • {entry.member.department}</div>
                                                    <div className="mt-2 w-full bg-[#eef1f6] h-2 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${overload ? 'bg-[#e2445c]' : warning ? 'bg-[#fdab3d]' : 'bg-[#00c875]'}`}
                                                            style={{ width: `${Math.min(entry.utilization, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>

                                                <div className="text-left sm:text-right shrink-0">
                                                    <div className="text-[13px] font-bold text-[#323338]">{entry.assignedHours}h / {entry.capacity}h</div>
                                                    <div className="text-[11px] text-[#676879] mt-0.5">{entry.openTaskCount} open tasks</div>
                                                    <div className="text-[11px] text-[#676879] mt-0.5">{entry.inProgress} active • {entry.completed} done</div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {metrics.crewLoad.length > 0 && (
                                    <div className="px-5 py-2 bg-[#fff8ee] text-[11px] font-bold tracking-wide text-[#b05b00] uppercase">
                                        Crew
                                    </div>
                                )}
                                {metrics.crewLoad.map((entry) => {
                                    const overload = entry.utilization > 100;
                                    const warning = entry.utilization >= 85 && entry.utilization <= 100;
                                    const statusColor = overload ? 'text-[#e2445c]' : warning ? 'text-[#fdab3d]' : 'text-[#00c875]';
                                    const statusBg = overload ? 'bg-[#ffebef]' : warning ? 'bg-[#fff6e6]' : 'bg-[#e6faef]';

                                    return (
                                        <div key={`crew-${entry.member.id}`} className="px-5 py-4 hover:bg-[#f9fafb] transition-colors">
                                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[14px] font-semibold text-[#323338] truncate">{entry.member.name}</span>
                                                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${statusBg} ${statusColor}`}>
                                                            {entry.utilization}%
                                                        </span>
                                                    </div>
                                                    <div className="text-[12px] text-[#676879] mt-0.5 truncate">{entry.member.position} • {entry.member.department}</div>
                                                    <div className="mt-2 w-full bg-[#eef1f6] h-2 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${overload ? 'bg-[#e2445c]' : warning ? 'bg-[#fdab3d]' : 'bg-[#00c875]'}`}
                                                            style={{ width: `${Math.min(entry.utilization, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>

                                                <div className="text-left sm:text-right shrink-0">
                                                    <div className="text-[13px] font-bold text-[#323338]">{entry.assignedHours}h / {entry.capacity}h</div>
                                                    <div className="text-[11px] text-[#676879] mt-0.5">{entry.openTaskCount} open tasks</div>
                                                    <div className="text-[11px] text-[#676879] mt-0.5">{entry.inProgress} active • {entry.completed} done</div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {metrics.teamLoad.length === 0 && metrics.crewLoad.length === 0 && (
                                    <div className="px-5 py-6 text-[13px] text-[#676879]">No team members or crew found.</div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-white rounded-xl border border-[#d0d4e4] p-4">
                                <div className="flex items-center gap-2 text-[14px] font-bold text-[#323338]">
                                    <AlertTriangle className="w-4 h-4 text-[#e2445c]" /> Critical
                                </div>
                                <div className="mt-3 space-y-2">
                                    {metrics.overdueTasks.slice(0, 5).map((task) => (
                                        <div key={task.id} className="p-2.5 rounded-lg bg-[#fff5f6] border border-[#ffd9de]">
                                            <div className="text-[12px] font-semibold text-[#323338] truncate">{task.name}</div>
                                            <div className="text-[11px] text-[#e2445c] mt-1">Due: {task.planEndDate}</div>
                                        </div>
                                    ))}
                                    {metrics.overdueTasks.length === 0 && (
                                        <div className="text-[12px] text-[#676879]">No overdue tasks.</div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-[#d0d4e4] p-4">
                                <div className="flex items-center gap-2 text-[14px] font-bold text-[#323338]">
                                    <Clock3 className="w-4 h-4 text-[#fdab3d]" /> Due Soon
                                </div>
                                <div className="mt-3 space-y-2">
                                    {metrics.dueSoonTasks.slice(0, 5).map((task) => (
                                        <div key={task.id} className="p-2.5 rounded-lg bg-[#fff8ee] border border-[#ffe0b2]">
                                            <div className="text-[12px] font-semibold text-[#323338] truncate">{task.name}</div>
                                            <div className="text-[11px] text-[#fdab3d] mt-1">Due: {task.planEndDate}</div>
                                        </div>
                                    ))}
                                    {metrics.dueSoonTasks.length === 0 && (
                                        <div className="text-[12px] text-[#676879]">No tasks due in 48 hours.</div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-[#d0d4e4] p-4">
                                <div className="flex items-center gap-2 text-[14px] font-bold text-[#323338]">
                                    <UserX2 className="w-4 h-4 text-[#579bfc]" /> Unassigned
                                </div>
                                <div className="mt-3 text-[12px] text-[#676879]">{metrics.unassignedTasks.length} tasks still need owners.</div>
                            </div>

                            <div className="bg-white rounded-xl border border-[#d0d4e4] p-4">
                                <div className="flex items-center gap-2 text-[14px] font-bold text-[#323338]">
                                    <UsersRound className="w-4 h-4 text-[#323338]" /> Capacity Alert
                                </div>
                                <div className="mt-3 text-[12px] text-[#676879]">
                                    {metrics.overloadedMembers.length > 0
                                        ? `${metrics.overloadedMembers.length} members are over 100% capacity.`
                                        : 'All members are within capacity.'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

