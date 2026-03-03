'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Plus, Edit2, Trash2, Check, X, Camera, ImagePlus, Search, CheckCircle2, Loader2 } from 'lucide-react';
import { Task, TeamMember } from '@/types/construction';
import { getTaskOwnerNames } from '@/utils/taskOwnerUtils';

interface UserManagementViewProps {
    teamMembers: TeamMember[];
    tasks: Task[];
    onAddMember: (member: TeamMember) => Promise<void> | void;
    onUpdateMember: (memberId: string, patch: Partial<TeamMember>) => Promise<void> | void;
    onDeleteMember: (memberId: string) => Promise<void> | void;
}

type MemberType = NonNullable<TeamMember['memberType']>;

const getMemberType = (member: TeamMember): MemberType => (
    member.memberType === 'crew' ? 'crew' : 'team'
);

const getMemberTypeLabel = (memberType: MemberType): string => (
    memberType === 'crew' ? 'Crew' : 'Team Member'
);

const getMemberTypeBadgeClass = (memberType: MemberType): string => (
    memberType === 'crew'
        ? 'bg-[#fff3e0] text-[#ad6800] border-[#ffd69b]'
        : 'bg-[#eef4ff] text-[#0052cc] border-[#c9ddff]'
);

const normalizeMemberName = (name: string): string => name.trim().toLowerCase();

export default function UserManagementView({
    teamMembers,
    tasks,
    onAddMember,
    onUpdateMember,
    onDeleteMember,
}: UserManagementViewProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [memberTab, setMemberTab] = useState<MemberType>('team');
    const [lineActionMemberId, setLineActionMemberId] = useState<string | null>(null);
    const [lineCopiedMemberId, setLineCopiedMemberId] = useState<string | null>(null);

    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberPosition, setNewMemberPosition] = useState('');
    const [newMemberDepartment, setNewMemberDepartment] = useState('');
    const [newMemberPhone, setNewMemberPhone] = useState('');
    const [newMemberCapacity, setNewMemberCapacity] = useState('40');
    const [newMemberType, setNewMemberType] = useState<MemberType>('team');
    const [newMemberAvatar, setNewMemberAvatar] = useState('');

    const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
    const [editingData, setEditingData] = useState<Partial<TeamMember>>({});
    const [pendingDeleteMember, setPendingDeleteMember] = useState<TeamMember | null>(null);
    const [isDeletingMember, setIsDeletingMember] = useState(false);

    const newAvatarRef = useRef<HTMLInputElement>(null);
    const editAvatarRef = useRef<HTMLInputElement>(null);

    const loadByMemberName = useMemo(() => {
        const loadMap = new Map<string, { taskCount: number; assignedHours: number }>();
        teamMembers.forEach((member) => {
            const ownedTasks = tasks.filter((task) => getTaskOwnerNames(task, teamMembers).includes(member.name));
            const openTasks = ownedTasks.filter((task) => task.status !== 'completed' && task.progress < 100);
            const assignedHours = openTasks.reduce((sum, task) => sum + (task.estimatedHours ?? 8), 0);
            loadMap.set(member.name, { taskCount: openTasks.length, assignedHours });
        });
        return loadMap;
    }, [tasks, teamMembers]);

    const filteredTeamMembers = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return teamMembers.filter((member) => {
            if (getMemberType(member) !== memberTab) return false;
            if (!q) return true;
            return (
                member.name.toLowerCase().includes(q)
                || (member.position || '').toLowerCase().includes(q)
                || (member.department || '').toLowerCase().includes(q)
                || (member.phone || '').toLowerCase().includes(q)
                || getMemberTypeLabel(getMemberType(member)).toLowerCase().includes(q)
            );
        });
    }, [searchQuery, teamMembers, memberTab]);

    const summary = useMemo(() => {
        const totalCapacity = teamMembers.reduce((sum, member) => sum + (member.capacityHoursPerWeek ?? 40), 0);
        const totalAssigned = teamMembers.reduce((sum, member) => sum + (loadByMemberName.get(member.name)?.assignedHours || 0), 0);
        const lineLinked = teamMembers.filter((member) => Boolean(member.lineUserId)).length;
        const teamCount = teamMembers.filter((member) => getMemberType(member) === 'team').length;
        const crewCount = teamMembers.filter((member) => getMemberType(member) === 'crew').length;
        const overloaded = teamMembers.filter((member) => {
            const assigned = loadByMemberName.get(member.name)?.assignedHours || 0;
            const capacity = member.capacityHoursPerWeek ?? 40;
            return assigned > capacity;
        }).length;

        return {
            members: teamMembers.length,
            totalCapacity,
            totalAssigned,
            lineLinked,
            teamCount,
            crewCount,
            overloaded,
        };
    }, [loadByMemberName, teamMembers]);

    const pendingDeleteImpactCount = useMemo(() => {
        if (!pendingDeleteMember) return 0;
        return tasks.filter((task) =>
            task.responsible === pendingDeleteMember.name || (task.assignedEmployeeIds || []).includes(pendingDeleteMember.id)
        ).length;
    }, [pendingDeleteMember, tasks]);

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_SIZE = 200;
                    let width = img.width;
                    let height = img.height;
                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.src = reader.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleNewAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const base64 = await fileToBase64(file);
            setNewMemberAvatar(base64);
        } catch (err) {
            console.error('Error reading file:', err);
        }
        e.target.value = '';
    };

    const handleEditAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const base64 = await fileToBase64(file);
            setEditingData({ ...editingData, avatar: base64 });
        } catch (err) {
            console.error('Error reading file:', err);
        }
        e.target.value = '';
    };

    const handleAvatarChangeForMember = async (memberId: string, file: File) => {
        try {
            const base64 = await fileToBase64(file);
            await Promise.resolve(onUpdateMember(memberId, { avatar: base64 }));
        } catch (err) {
            console.error('Error reading file:', err);
        }
    };

    const handleAddMember = () => {
        if (!newMemberName.trim()) return;
        const normalizedName = normalizeMemberName(newMemberName);
        const duplicated = teamMembers.some((member) => normalizeMemberName(member.name) === normalizedName);
        if (duplicated) {
            alert('Member name already exists. Please use a different name.');
            return;
        }

        const newMember: TeamMember = {
            id: `u-${Date.now()}`,
            name: newMemberName.trim(),
            memberType: newMemberType,
            position: newMemberPosition.trim() || 'Staff',
            department: newMemberDepartment.trim() || 'General',
            phone: newMemberPhone.trim() || '-',
            capacityHoursPerWeek: Number.parseInt(newMemberCapacity, 10) || 40,
            avatar: newMemberAvatar || undefined,
        };

        void onAddMember(newMember);
        setNewMemberName('');
        setNewMemberPosition('');
        setNewMemberDepartment('');
        setNewMemberPhone('');
        setNewMemberCapacity('40');
        setNewMemberType('team');
        setNewMemberAvatar('');
    };

    const startEditingMember = (member: TeamMember) => {
        setEditingMemberId(member.id);
        setEditingData({ ...member });
    };

    const saveEditingMember = () => {
        if (!editingMemberId || !editingData.name?.trim()) return;
        const normalizedName = normalizeMemberName(editingData.name);
        const duplicated = teamMembers.some(
            (member) => member.id !== editingMemberId && normalizeMemberName(member.name) === normalizedName
        );
        if (duplicated) {
            alert('Member name already exists. Please use a different name.');
            return;
        }
        const patch: Partial<TeamMember> = {
            ...editingData,
            name: editingData.name.trim(),
            memberType: editingData.memberType === 'crew' ? 'crew' : 'team',
        };
        void onUpdateMember(editingMemberId, patch);
        setEditingMemberId(null);
    };

    const cancelEditingMember = () => {
        setEditingMemberId(null);
        setEditingData({});
    };

    const openDeleteModal = (member: TeamMember) => {
        setPendingDeleteMember(member);
    };

    const closeDeleteModal = () => {
        if (isDeletingMember) return;
        setPendingDeleteMember(null);
    };

    const confirmDeleteMember = async () => {
        if (!pendingDeleteMember || isDeletingMember) return;
        try {
            setIsDeletingMember(true);
            await Promise.resolve(onDeleteMember(pendingDeleteMember.id));
            setPendingDeleteMember(null);
        } finally {
            setIsDeletingMember(false);
        }
    };

    const AvatarDisplay = ({ member, size = 40, className = '' }: { member: TeamMember | { name: string; avatar?: string }; size?: number; className?: string }) => (
        member.avatar ? (
            <img
                src={member.avatar}
                alt={member.name}
                referrerPolicy="no-referrer"
                className={`rounded-full object-cover border-2 border-white shadow-sm ${className}`}
                style={{ width: size, height: size }}
            />
        ) : (
            <div
                className={`rounded-full bg-[#cce5ff] border border-[#0052cc]/20 flex items-center justify-center text-[#0052cc] font-medium shrink-0 ${className}`}
                style={{ width: size, height: size, fontSize: size * 0.35 }}
            >
                {member.name.substring(0, 2).toUpperCase()}
            </div>
        )
    );

    const copyText = async (text: string) => {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const input = document.createElement('input');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
    };

    const handleLineBadgeClick = async (member: TeamMember) => {
        if (!member.lineUserId || lineActionMemberId) return;

        try {
            setLineActionMemberId(member.id);
            await copyText(member.lineUserId);
            setLineCopiedMemberId(member.id);
            window.setTimeout(() => {
                setLineCopiedMemberId((current) => (current === member.id ? null : current));
            }, 1200);
        } catch (error) {
            console.error('Failed to copy LINE User ID:', error);
            alert('Copy LINE User ID failed. Please try again.');
        } finally {
            setLineActionMemberId(null);
        }
    };

    return (
        <div className="flex-1 flex flex-col min-w-0 bg-[#f5f6f8]">
            <header className="min-h-[64px] bg-white flex items-center px-4 sm:px-6 lg:px-8 py-3 border-b border-[#d0d4e4] gap-4 shrink-0 transition-all">
                <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-[#323338] truncate">User Management</h1>
            </header>

            <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                <div className="max-w-[1500px] space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                        <div className="bg-white border border-[#d0d4e4] rounded-xl px-4 py-3">
                            <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">Members</div>
                            <div className="text-2xl font-black text-[#323338] mt-1">{summary.members}</div>
                            <div className="text-[11px] text-[#676879] mt-1">Team {summary.teamCount} • Crew {summary.crewCount}</div>
                        </div>
                        <div className="bg-white border border-[#d0d4e4] rounded-xl px-4 py-3">
                            <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">Total Capacity</div>
                            <div className="text-2xl font-black text-[#00c875] mt-1">{summary.totalCapacity}h</div>
                        </div>
                        <div className="bg-white border border-[#d0d4e4] rounded-xl px-4 py-3">
                            <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">Assigned Hours</div>
                            <div className="text-2xl font-black text-[#0073ea] mt-1">{summary.totalAssigned}h</div>
                        </div>
                        <div className="bg-white border border-[#d0d4e4] rounded-xl px-4 py-3">
                            <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">LINE Linked</div>
                            <div className="text-2xl font-black text-[#00c875] mt-1">{summary.lineLinked}</div>
                        </div>
                        <div className="bg-white border border-[#d0d4e4] rounded-xl px-4 py-3">
                            <div className="text-[11px] text-[#676879] uppercase tracking-wider font-semibold">Overloaded</div>
                            <div className="text-2xl font-black text-[#e2445c] mt-1">{summary.overloaded}</div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-[#d0d4e4] overflow-hidden">
                        <div className="p-4 sm:p-6 border-b border-[#d0d4e4] bg-[#f5f6f8] space-y-4">
                            <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                                <h2 className="text-xl font-semibold text-[#323338]">Team Members & Crew</h2>
                                <div className="relative w-full lg:w-[320px]">
                                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#a0a2b1]" />
                                    <input
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search name, role, crew..."
                                        className="w-full bg-white border border-[#d0d4e4] rounded-lg pl-9 pr-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#0073ea]"
                                    />
                                </div>
                            </div>

                            <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-[#d0d4e4] bg-white w-fit">
                                <button
                                    type="button"
                                    onClick={() => setMemberTab('team')}
                                    className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${memberTab === 'team' ? 'bg-[#0073ea] text-white' : 'text-[#676879] hover:bg-[#f5f6f8]'}`}
                                >
                                    Owner ({summary.teamCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMemberTab('crew')}
                                    className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${memberTab === 'crew' ? 'bg-[#fdab3d] text-white' : 'text-[#676879] hover:bg-[#f5f6f8]'}`}
                                >
                                    Team ช่าง ({summary.crewCount})
                                </button>
                            </div>

                            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-start">
                                <div className="shrink-0">
                                    <input type="file" accept="image/*" ref={newAvatarRef} onChange={handleNewAvatarUpload} className="hidden" />
                                    <button onClick={() => newAvatarRef.current?.click()} className="relative group" title="Upload Photo">
                                        {newMemberAvatar ? (
                                            <div className="relative">
                                                <img src={newMemberAvatar} alt="New member" className="w-[42px] h-[42px] rounded-full object-cover border-2 border-[#0073ea] shadow-sm" />
                                                <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Camera className="w-4 h-4 text-white" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-[42px] h-[42px] rounded-full bg-[#e6e9ef] border-2 border-dashed border-[#a0a2b1] flex items-center justify-center text-[#a0a2b1] hover:border-[#0073ea] hover:text-[#0073ea] transition-colors">
                                                <ImagePlus className="w-5 h-5" />
                                            </div>
                                        )}
                                    </button>
                                </div>

                                <div className="flex-1 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
                                    <input value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="Name" className="w-full bg-white border border-[#d0d4e4] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[#323338]" />
                                    <select
                                        value={newMemberType}
                                        onChange={(e) => setNewMemberType(e.target.value as MemberType)}
                                        className="w-full bg-white border border-[#d0d4e4] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[#323338]"
                                    >
                                        <option value="team">Team Member</option>
                                        <option value="crew">Crew</option>
                                    </select>
                                    <input value={newMemberPosition} onChange={(e) => setNewMemberPosition(e.target.value)} placeholder="Position" className="w-full bg-white border border-[#d0d4e4] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[#323338]" />
                                    <input value={newMemberDepartment} onChange={(e) => setNewMemberDepartment(e.target.value)} placeholder="Department" className="w-full bg-white border border-[#d0d4e4] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[#323338]" />
                                    <input value={newMemberPhone} onChange={(e) => setNewMemberPhone(e.target.value)} placeholder="Phone" className="w-full bg-white border border-[#d0d4e4] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[#323338]" />
                                    <input type="number" min="1" max="168" value={newMemberCapacity} onChange={(e) => setNewMemberCapacity(e.target.value)} placeholder="Capacity h/week" className="w-full bg-white border border-[#d0d4e4] rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#0073ea] text-[#323338]" />
                                </div>
                                <button onClick={handleAddMember} disabled={!newMemberName.trim()} className="bg-[#0073ea] hover:bg-[#0060c0] disabled:bg-[#d0d4e4] disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 h-[42px] w-full lg:w-auto">
                                    <Plus className="w-4 h-4" /> Add
                                </button>
                            </div>
                        </div>

                        <div className="divide-y divide-[#e6e9ef]">
                            {filteredTeamMembers.map((member) => {
                                const load = loadByMemberName.get(member.name) || { taskCount: 0, assignedHours: 0 };
                                const capacity = member.capacityHoursPerWeek ?? 40;
                                const overloaded = load.assignedHours > capacity;

                                return (
                                    <div key={member.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 hover:bg-[#f8fafc] transition-colors group gap-3">
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            {editingMemberId === member.id ? (
                                                <div className="shrink-0">
                                                    <input type="file" accept="image/*" ref={editAvatarRef} onChange={handleEditAvatarUpload} className="hidden" />
                                                    <button onClick={() => editAvatarRef.current?.click()} className="relative group/avatar" title="Change Photo">
                                                        {(editingData.avatar || member.avatar) ? (
                                                            <div className="relative">
                                                                <img src={editingData.avatar || member.avatar} alt={member.name} referrerPolicy="no-referrer" className="w-10 h-10 rounded-full object-cover border-2 border-[#0073ea] shadow-sm" />
                                                                <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
                                                                    <Camera className="w-3.5 h-3.5 text-white" />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-full bg-[#e6e9ef] border-2 border-dashed border-[#0073ea] flex items-center justify-center text-[#0073ea]"><Camera className="w-4 h-4" /></div>
                                                        )}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="shrink-0 relative group/avatar">
                                                    <input type="file" accept="image/*" className="hidden" id={`avatar-upload-${member.id}`} onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) await handleAvatarChangeForMember(member.id, file);
                                                        e.target.value = '';
                                                    }} />
                                                    <label htmlFor={`avatar-upload-${member.id}`} className="cursor-pointer block relative">
                                                        <AvatarDisplay member={member} size={40} />
                                                        <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center"><Camera className="w-3.5 h-3.5 text-white" /></div>
                                                    </label>
                                                </div>
                                            )}

                                            {editingMemberId === member.id ? (
                                                <div className="grid grid-cols-1 sm:grid-cols-6 flex-1 px-2 gap-2 items-center">
                                                    <input value={editingData.name || ''} onChange={(e) => setEditingData({ ...editingData, name: e.target.value })} className="w-full bg-white border border-[#0073ea] rounded px-2 py-1 text-sm focus:outline-none" placeholder="Name" />
                                                    <select
                                                        value={editingData.memberType === 'crew' ? 'crew' : 'team'}
                                                        onChange={(e) => setEditingData({ ...editingData, memberType: e.target.value as MemberType })}
                                                        className="w-full bg-white border border-[#0073ea] rounded px-2 py-1 text-sm focus:outline-none"
                                                    >
                                                        <option value="team">Team Member</option>
                                                        <option value="crew">Crew</option>
                                                    </select>
                                                    <input value={editingData.position || ''} onChange={(e) => setEditingData({ ...editingData, position: e.target.value })} className="w-full bg-white border border-[#0073ea] rounded px-2 py-1 text-sm focus:outline-none" placeholder="Position" />
                                                    <input value={editingData.department || ''} onChange={(e) => setEditingData({ ...editingData, department: e.target.value })} className="w-full bg-white border border-[#0073ea] rounded px-2 py-1 text-sm focus:outline-none" placeholder="Department" />
                                                    <input value={editingData.phone || ''} onChange={(e) => setEditingData({ ...editingData, phone: e.target.value })} className="w-full bg-white border border-[#0073ea] rounded px-2 py-1 text-sm focus:outline-none" placeholder="Phone" />
                                                    <input type="number" min="1" max="168" value={editingData.capacityHoursPerWeek ?? 40} onChange={(e) => setEditingData({ ...editingData, capacityHoursPerWeek: Number.parseInt(e.target.value, 10) || 40 })} className="w-full bg-white border border-[#0073ea] rounded px-2 py-1 text-sm focus:outline-none" placeholder="Capacity" />
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-7 flex-1 px-2 gap-2 items-center min-w-0">
                                                    <div className="font-medium text-[#323338] min-w-0 flex items-center gap-2">
                                                        <span className="truncate">{member.name}</span>
                                                        {member.lineUserId && (
                                                            <button
                                                                type="button"
                                                                onClick={() => void handleLineBadgeClick(member)}
                                                                disabled={lineActionMemberId === member.id}
                                                                title={member.lineUserId ? `Copy LINE User ID: ${member.lineUserId}` : 'LINE not linked'}
                                                                className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#e6faef] text-[#00a66a] border border-[#b8ebd2] px-2 py-0.5 text-[10px] font-bold hover:bg-[#d9f5e8] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                                                            >
                                                                {lineActionMemberId === member.id ? (
                                                                    <>
                                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                                        ...
                                                                    </>
                                                                ) : lineCopiedMemberId === member.id ? (
                                                                    <>
                                                                        <Check className="w-3 h-3" />
                                                                        Copied
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <CheckCircle2 className="w-3 h-3" />
                                                                        LINE
                                                                    </>
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${getMemberTypeBadgeClass(getMemberType(member))}`}>
                                                            {getMemberTypeLabel(getMemberType(member))}
                                                        </span>
                                                    </div>
                                                    <div className="text-[#676879] text-sm truncate">{member.position}</div>
                                                    <div className="text-[#676879] text-sm truncate">{member.department}</div>
                                                    <div className="text-[#676879] text-sm truncate">{member.phone}</div>
                                                    <div className="text-[#676879] text-sm truncate">{capacity} h/wk</div>
                                                    <div className={`text-sm font-semibold truncate ${overloaded ? 'text-[#e2445c]' : 'text-[#0052cc]'}`}>
                                                        {load.assignedHours} h • {load.taskCount} open tasks
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                            {editingMemberId === member.id ? (
                                                <>
                                                    <button onClick={saveEditingMember} className="text-[#00c875] p-2 hover:bg-[#e6faef] rounded-md transition-all"><Check className="w-5 h-5" /></button>
                                                    <button onClick={cancelEditingMember} className="text-[#676879] p-2 hover:bg-[#e6e9ef] rounded-md transition-all"><X className="w-5 h-5" /></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => startEditingMember(member)} className="text-[#676879] p-2 hover:bg-[#e6e9ef] rounded-md transition-all sm:opacity-0 sm:group-hover:opacity-100"><Edit2 className="w-5 h-5" /></button>
                                                    <button onClick={() => openDeleteModal(member)} className="text-[#e2445c] p-2 hover:bg-[#ffebef] rounded-md transition-all sm:opacity-0 sm:group-hover:opacity-100"><Trash2 className="w-5 h-5" /></button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {filteredTeamMembers.length === 0 && (
                                <div className="p-8 text-center text-[#676879]">
                                    {memberTab === 'team' ? 'No owner found.' : 'No crew found.'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {pendingDeleteMember && (
                <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-white rounded-xl border border-[#d0d4e4] shadow-2xl">
                        <div className="px-5 py-4 border-b border-[#e6e9ef]">
                            <h3 className="text-[18px] font-bold text-[#323338]">Confirm Delete</h3>
                        </div>
                        <div className="px-5 py-4 text-[14px] text-[#323338] space-y-2">
                            <p>
                                Delete member <span className="font-semibold">{pendingDeleteMember.name}</span>?
                            </p>
                            <p className="text-[#676879] text-[13px]">
                                Related tasks will be updated to remove this owner.
                            </p>
                            <p className="text-[#676879] text-[13px]">
                                Impacted tasks: <span className="font-semibold text-[#323338]">{pendingDeleteImpactCount}</span>
                            </p>
                        </div>
                        <div className="px-5 py-4 border-t border-[#e6e9ef] flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeDeleteModal}
                                disabled={isDeletingMember}
                                className="px-3 py-2 rounded-lg text-[13px] font-medium bg-[#f5f6f8] text-[#323338] hover:bg-[#e6e9ef] disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void confirmDeleteMember()}
                                disabled={isDeletingMember}
                                className="px-3 py-2 rounded-lg text-[13px] font-medium bg-[#e2445c] text-white hover:bg-[#c9344b] disabled:opacity-60 inline-flex items-center gap-1.5"
                            >
                                {isDeletingMember && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

