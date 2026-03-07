'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import LoginPage from '@/components/LoginPage';
import LinearLoadingScreen from '@/components/LinearLoadingScreen';

export default function UserGate({ children }: { children: React.ReactNode }) {
    const { loading, isAuthenticated, user } = useAuth();
    const isLineAuthenticated = Boolean(isAuthenticated && user?.lineUserId);
    const isDevLineBypassEnabled = process.env.NEXT_PUBLIC_ME_DEV_BYPASS_LINE === 'true' && process.env.NODE_ENV !== 'production';
    const canAccessMe = isLineAuthenticated || (isDevLineBypassEnabled && isAuthenticated);

    if (loading) return <LinearLoadingScreen message="Authenticating..." />;

    if (!canAccessMe) {
        if (isDevLineBypassEnabled) return <LoginPage />;
        return <LoginPage allowLineAuth lineOnly autoLineLogin />;
    }

    return <div className="min-h-dvh bg-[#f5f6f8]">{children}</div>;
}
