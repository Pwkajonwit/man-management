'use client';

import React, { useCallback, useEffect, useState } from 'react';
import UserManagementView from '@/components/UserManagementView';
import { useAppContext } from '@/contexts/AppContext';
import {
    deleteTeamMember as fbDeleteTeamMember,
    deleteSystemUserAccount as fbDeleteSystemUserAccount,
    subscribeSystemUserAccounts,
    updateTeamMember as fbUpdateTeamMember,
    upsertSystemUserAccount,
    upsertTeamMember,
    updateTask as fbUpdateTask,
} from '@/lib/firestore';
import { SystemUserAccount, TeamMember } from '@/types/construction';

export default function UsersPage() {
    const { teamMembers, setTeamMembers, tasks, setTasks, loading, dataSource } = useAppContext();
    const [systemUsers, setSystemUsers] = useState<SystemUserAccount[]>([]);

    useEffect(() => {
        if (dataSource !== 'firebase') return;

        const unsubscribe = subscribeSystemUserAccounts((users) => {
            setSystemUsers(users);
        });
        return () => unsubscribe();
    }, [dataSource]);

    const handleAddMember = useCallback(async (member: TeamMember) => {
        setTeamMembers(prev => [...prev, member]);

        if (dataSource !== 'firebase') return;

        try {
            const { id, ...payload } = member;
            await upsertTeamMember(id, payload);
        } catch (error) {
            console.error('Failed to add team member:', error);
            setTeamMembers(prev => prev.filter(m => m.id !== member.id));
            alert('Cannot add team member. Please try again.');
        }
    }, [dataSource, setTeamMembers]);

    const handleUpdateMember = useCallback(async (memberId: string, patch: Partial<TeamMember>) => {
        const currentMember = teamMembers.find(m => m.id === memberId);
        if (!currentMember) return;

        const updatedMember: TeamMember = { ...currentMember, ...patch };
        const oldName = currentMember.name;
        const newName = updatedMember.name;
        const nameChanged = oldName !== newName;
        const affectedTaskIds = tasks.filter(t => t.responsible === oldName).map(t => t.id);

        setTeamMembers(prev => prev.map(m => (m.id === memberId ? updatedMember : m)));
        if (nameChanged) {
            setTasks(prev => prev.map(t => (t.responsible === oldName ? { ...t, responsible: newName } : t)));
        }

        if (dataSource !== 'firebase') return;

        try {
            const memberPatch = { ...patch };
            delete memberPatch.id;
            await fbUpdateTeamMember(memberId, memberPatch);

            if (nameChanged && affectedTaskIds.length > 0) {
                await Promise.all(
                    affectedTaskIds.map(taskId => fbUpdateTask(taskId, { responsible: newName }))
                );
            }
        } catch (error) {
            console.error('Failed to update team member:', error);
            setTeamMembers(prev => prev.map(m => (m.id === memberId ? currentMember : m)));
            if (nameChanged) {
                setTasks(prev => prev.map(t => (t.responsible === newName ? { ...t, responsible: oldName } : t)));
            }
            alert('Cannot update team member. Please try again.');
        }
    }, [dataSource, setTasks, setTeamMembers, tasks, teamMembers]);

    const handleDeleteMember = useCallback(async (memberId: string) => {
        const memberToDelete = teamMembers.find(m => m.id === memberId);
        if (!memberToDelete) return;

        const ownerName = memberToDelete.name;
        const affectedTasks = tasks
            .filter(t => t.responsible === ownerName || (t.assignedEmployeeIds || []).includes(memberId))
            .map((task) => {
                const remainingOwnerIds = (task.assignedEmployeeIds || []).filter(ownerId => ownerId !== memberId);
                const nextPrimaryOwner = remainingOwnerIds
                    .map(ownerId => teamMembers.find(member => member.id === ownerId)?.name)
                    .find((name): name is string => Boolean(name)) || '';
                const nextResponsible = task.responsible === ownerName ? nextPrimaryOwner : task.responsible || '';
                return {
                    taskId: task.id,
                    patch: {
                        responsible: nextResponsible,
                        assignedEmployeeIds: remainingOwnerIds,
                    },
                    previous: {
                        responsible: task.responsible || '',
                        assignedEmployeeIds: task.assignedEmployeeIds || [],
                    },
                };
            });

        const patchByTaskId = new Map(affectedTasks.map(item => [item.taskId, item.patch]));
        const previousByTaskId = new Map(affectedTasks.map(item => [item.taskId, item.previous]));

        setTeamMembers(prev => prev.filter(m => m.id !== memberId));
        if (affectedTasks.length > 0) {
            setTasks(prev => prev.map(task => {
                const patch = patchByTaskId.get(task.id);
                return patch ? { ...task, ...patch } : task;
            }));
        }

        if (dataSource !== 'firebase') return;

        try {
            await fbDeleteTeamMember(memberId);

            if (affectedTasks.length > 0) {
                await Promise.all(
                    affectedTasks.map(item => fbUpdateTask(item.taskId, item.patch))
                );
            }
        } catch (error) {
            console.error('Failed to delete team member:', error);
            setTeamMembers(prev => [...prev, memberToDelete]);
            if (affectedTasks.length > 0) {
                setTasks(prev => prev.map(task => {
                    const previous = previousByTaskId.get(task.id);
                    return previous ? { ...task, ...previous } : task;
                }));
            }
            alert('Cannot delete team member. Please try again.');
        }
    }, [dataSource, setTasks, setTeamMembers, tasks, teamMembers]);

    const handleAddSystemUser = useCallback(async (payload: {
        id?: string;
        username: string;
        email: string;
        displayName: string;
        authProvider: SystemUserAccount['authProvider'];
        phone?: string;
        lineUserId?: string;
    }) => {
        if (dataSource !== 'firebase') {
            alert('System user management is available in Firebase mode only.');
            return;
        }

        const id = payload.id?.trim() || `su-${Date.now()}`;
        const nowIso = new Date().toISOString();
        try {
            await upsertSystemUserAccount(id, {
                username: payload.username.trim(),
                email: payload.email.trim().toLowerCase(),
                displayName: payload.displayName.trim(),
                authProvider: payload.authProvider,
                phone: payload.phone?.trim() || '',
                lineUserId: payload.lineUserId?.trim() || '',
                createdAt: nowIso,
            });
        } catch (error) {
            console.error('Failed to add system user:', error);
            alert('Cannot add system user. Please try again.');
        }
    }, [dataSource]);

    const handleUpdateSystemUser = useCallback(async (userId: string, patch: Partial<SystemUserAccount>) => {
        if (dataSource !== 'firebase') {
            alert('System user management is available in Firebase mode only.');
            return;
        }
        try {
            const safePatch: Partial<SystemUserAccount> = { ...patch };
            delete safePatch.id;
            await upsertSystemUserAccount(userId, safePatch);
        } catch (error) {
            console.error('Failed to update system user:', error);
            alert('Cannot update system user. Please try again.');
        }
    }, [dataSource]);

    const handleDeleteSystemUser = useCallback(async (userId: string) => {
        if (dataSource !== 'firebase') {
            alert('System user management is available in Firebase mode only.');
            return;
        }
        try {
            await fbDeleteSystemUserAccount(userId);
        } catch (error) {
            console.error('Failed to delete system user:', error);
            alert('Cannot delete system user. Please try again.');
        }
    }, [dataSource]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <UserManagementView
            teamMembers={teamMembers}
            systemUsers={dataSource === 'firebase' ? systemUsers : []}
            tasks={tasks}
            onAddMember={handleAddMember}
            onUpdateMember={handleUpdateMember}
            onDeleteMember={handleDeleteMember}
            onAddSystemUser={handleAddSystemUser}
            onUpdateSystemUser={handleUpdateSystemUser}
            onDeleteSystemUser={handleDeleteSystemUser}
        />
    );
}
