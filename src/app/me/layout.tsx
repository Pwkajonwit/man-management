'use client';

import React from 'react';
import UserGate from '@/components/UserGate';

export default function MeLayout({ children }: { children: React.ReactNode }) {
    return <UserGate>{children}</UserGate>;
}
