'use client';

import React, { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
    const {
        loginWithPassword,
        registerWithPassword,
    } = useAuth();

    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    const [credentialUser, setCredentialUser] = useState('');
    const [credentialPassword, setCredentialPassword] = useState('');
    const [credentialDisplayName, setCredentialDisplayName] = useState('');
    const [authError, setAuthError] = useState('');
    const [authSubmitting, setAuthSubmitting] = useState(false);

    const handleCredentialSubmit = async () => {
        const user = credentialUser.trim();
        const password = credentialPassword;

        if (!user || !password) {
            setAuthError('Please enter User/Email and Password.');
            return;
        }

        try {
            setAuthSubmitting(true);
            setAuthError('');

            if (authMode === 'login') {
                await loginWithPassword(user, password);
            } else {
                await registerWithPassword(user, password, credentialDisplayName.trim() || user);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Authentication failed.';
            setAuthError(message);
        } finally {
            setAuthSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#eef2f6] flex items-center justify-center p-4">
            <div className="w-full max-w-[460px]">
                <div className="rounded-2xl border border-[#c9d1dd] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.12)] overflow-hidden">
                    <header className="px-7 py-6 bg-[#0f2740] border-b border-[#0a1d31]">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#dce7f5] text-[11px] font-semibold tracking-wide uppercase">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Secure Access
                        </div>
                        <h1 className="mt-3 text-[24px] leading-tight font-bold text-white">WorkOS Access Portal</h1>
                        <p className="mt-1 text-[12px] text-[#c6d5e8]">
                            Official sign-in for the Task Management System
                        </p>
                    </header>

                    <main className="px-7 py-6 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-[13px] font-semibold text-[#1d2936]">
                                {authMode === 'login' ? 'Sign in with User / Password' : 'Create User / Password'}
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    setAuthMode(prev => (prev === 'login' ? 'register' : 'login'));
                                    setAuthError('');
                                }}
                                className="text-[12px] text-[#0b63ce] font-semibold hover:underline"
                            >
                                {authMode === 'login' ? 'Create account' : 'Back to login'}
                            </button>
                        </div>

                        {authMode === 'register' && (
                            <input
                                type="text"
                                value={credentialDisplayName}
                                onChange={e => setCredentialDisplayName(e.target.value)}
                                placeholder="Display name"
                                className="w-full h-11 px-4 border border-[#ccd5e1] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#0b63ce]/25 focus:border-[#0b63ce]"
                            />
                        )}

                        <input
                            type="text"
                            value={credentialUser}
                            onChange={e => setCredentialUser(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !authSubmitting && handleCredentialSubmit()}
                            placeholder="User or email (e.g. admin)"
                            className="w-full h-11 px-4 border border-[#ccd5e1] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#0b63ce]/25 focus:border-[#0b63ce]"
                        />
                        <input
                            type="password"
                            value={credentialPassword}
                            onChange={e => setCredentialPassword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !authSubmitting && handleCredentialSubmit()}
                            placeholder="Password"
                            className="w-full h-11 px-4 border border-[#ccd5e1] rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#0b63ce]/25 focus:border-[#0b63ce]"
                        />

                        {authError && <p className="text-[12px] text-[#c6314a]">{authError}</p>}

                        <button
                            type="button"
                            onClick={handleCredentialSubmit}
                            disabled={authSubmitting}
                            className="w-full h-11 inline-flex items-center justify-center gap-2 bg-[#0b63ce] hover:bg-[#0a56b4] text-white font-semibold rounded-xl text-[14px] disabled:bg-[#a0a2b1] disabled:cursor-not-allowed"
                        >
                            {authSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            {authMode === 'login' ? 'Sign In' : 'Create Account'}
                        </button>

                        <div className="rounded-lg bg-[#f5f8fc] border border-[#dde5ef] px-3 py-2">
                            <p className="text-[11px] text-[#4f5b68]">
                                Tip: username only will be stored as <code className="font-mono">username@workos.local</code>
                            </p>
                            <p className="mt-1 text-[11px] text-[#6b7785]">
                                LINE login is handled from <code className="font-mono">/me</code>.
                            </p>
                        </div>
                    </main>
                </div>

                <p className="text-center text-[12px] text-[#8191a2] mt-6">
                    SRT-HST Task Management System v2.0
                </p>
            </div>
        </div>
    );
}
