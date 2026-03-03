'use client';

import React from 'react';
import DashboardOverviewView from '@/components/DashboardOverviewView';
import { useAppContext } from '@/contexts/AppContext';

export default function DashboardPage() {
    const { tasks, teamMembers, loading } = useAppContext();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return <DashboardOverviewView tasks={tasks} teamMembers={teamMembers} />;
}
