'use client';

import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import LoginPage from '@/components/LoginPage';
import SidebarNavigation from '@/components/SidebarNavigation';

export default function AdminGate({ children }: { children: React.ReactNode }) {
    const { loading, isAuthenticated } = useAuth();
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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

    if (!isAuthenticated) return <LoginPage />;

    return (
        <div className="flex h-dvh bg-white text-[#323338] font-sans">
            <SidebarNavigation />
            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
                <div className="md:hidden h-14 bg-white border-b border-[#d0d4e4] px-4 flex items-center justify-between shrink-0">
                    <button
                        type="button"
                        onClick={() => setMobileSidebarOpen(true)}
                        className="p-2 rounded-lg hover:bg-[#f5f6f8] text-[#323338]"
                        aria-label="Open menu"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <div className="font-bold text-[15px] tracking-tight">WorkOS Admin</div>
                    <div className="w-9" />
                </div>
                <div className="flex-1 min-w-0 min-h-0 overflow-y-auto">
                    {children}
                </div>
            </div>

            {mobileSidebarOpen && (
                <div className="fixed inset-0 z-[120] md:hidden">
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setMobileSidebarOpen(false)}
                        aria-label="Close menu backdrop"
                    />
                    <div className="relative h-full">
                        <div className="absolute left-0 top-0 h-full shadow-2xl">
                            <SidebarNavigation mobile onNavigate={() => setMobileSidebarOpen(false)} />
                            <button
                                type="button"
                                onClick={() => setMobileSidebarOpen(false)}
                                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white border border-[#d0d4e4] flex items-center justify-center text-[#676879]"
                                aria-label="Close menu"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
