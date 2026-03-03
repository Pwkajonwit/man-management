'use client';

import React from 'react';
import MobileMyTasksView from '@/components/MobileMyTasksView';
import { useAppContext } from '@/contexts/AppContext';

export default function MePage() {
    const {
        tasks,
        projects,
        teamMembers,
        currentUserName,
        loading,
        handleUpdateTaskStatus,
    } = useAppContext();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <MobileMyTasksView
            tasks={tasks}
            projects={projects}
            teamMembers={teamMembers}
            currentUserName={currentUserName}
            onStatusChange={handleUpdateTaskStatus}
        />
    );
}
