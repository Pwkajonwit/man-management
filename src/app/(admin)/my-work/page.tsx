'use client';

import React from 'react';
import MyWorkTrackerView from '@/components/MyWorkTrackerView';
import { useAppContext } from '@/contexts/AppContext';

export default function MyWorkPage() {
    const { tasks, projects, teamMembers, loading } = useAppContext();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return <MyWorkTrackerView tasks={tasks} projects={projects} teamMembers={teamMembers} />;
}
