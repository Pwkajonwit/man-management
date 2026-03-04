'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import LoginPage from '@/components/LoginPage';

export default function UserGate({ children }: { children: React.ReactNode }) {
    const { loading, isAuthenticated } = useAuth();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f5f6f8]">
                <div className="text-center">
                    <div className="w-16 h-16 bg-[#0073ea] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg animate-pulse">
                        <span className="text-white text-2xl font-black">W</span>
                    </div>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#0073ea] mx-auto mt-4"></div>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) return <LoginPage allowLineAuth />;

    return <div className="min-h-dvh bg-[#f5f6f8]">{children}</div>;
}
