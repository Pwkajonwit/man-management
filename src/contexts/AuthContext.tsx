'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { initializeLiff, getLineProfile, loginWithLine, logout as lineLogout, isLoggedIn, LineProfile } from '@/lib/line';
import { auth, hasFirebaseConfig } from '@/lib/firebase';
import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    User as FirebaseUser,
} from 'firebase/auth';
import { getTeamMembers, updateTeamMember } from '@/lib/firestore';
import { TeamMember } from '@/types/construction';

interface AuthUser {
    uid: string;
    displayName: string;
    pictureUrl?: string;
    lineUserId?: string;
}

interface AuthContextType {
    user: AuthUser | null;
    loading: boolean;
    loginLine: () => void;
    pendingLineProfile: LineProfile | null;
    requiresLinePhoneBinding: boolean;
    bindLinePhone: (phone: string) => Promise<void>;
    loginWithPassword: (userOrEmail: string, password: string) => Promise<void>;
    registerWithPassword: (userOrEmail: string, password: string, displayName?: string) => Promise<void>;
    logoutUser: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

const USERNAME_EMAIL_DOMAIN = 'workos.local';
const DIGITS_ONLY = /[^0-9]/g;

function normalizeLinePictureUrl(url?: string): string | undefined {
    if (!url) return undefined;
    return url.replace(/^http:\/\//i, 'https://');
}

function toAuthEmail(userOrEmail: string): string {
    const normalized = userOrEmail.trim().toLowerCase();
    if (!normalized) return '';
    if (normalized.includes('@')) return normalized;
    return `${normalized}@${USERNAME_EMAIL_DOMAIN}`;
}

function mapFirebaseUser(firebaseUser: FirebaseUser): AuthUser {
    return {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
        pictureUrl: firebaseUser.photoURL || undefined,
        lineUserId: undefined,
    };
}

function normalizePhone(phone: string): string {
    return phone.replace(DIGITS_ONLY, '');
}

function findMemberByPhone(members: TeamMember[], phone: string): TeamMember | null {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    return members.find((member) => normalizePhone(member.phone || '') === normalized) || null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [pendingLineProfile, setPendingLineProfile] = useState<LineProfile | null>(null);
    const [requiresLinePhoneBinding, setRequiresLinePhoneBinding] = useState(false);

    useEffect(() => {
        let mounted = true;

        const handleAuthState = async (firebaseUser: FirebaseUser | null) => {
            try {
                const liffReady = await initializeLiff();
                if (liffReady && isLoggedIn()) {
                    const profile = await getLineProfile();
                    if (profile && mounted) {
                        const normalizedPictureUrl = normalizeLinePictureUrl(profile.pictureUrl);
                        const members = await getTeamMembers();
                        const matchedByLine = members.find((member) => member.lineUserId === profile.userId);

                        if (matchedByLine) {
                            if (normalizedPictureUrl && matchedByLine.avatar !== normalizedPictureUrl) {
                                await updateTeamMember(matchedByLine.id, { avatar: normalizedPictureUrl });
                            }

                            setPendingLineProfile(null);
                            setRequiresLinePhoneBinding(false);
                            setUser({
                                uid: profile.userId,
                                displayName: matchedByLine.name || profile.displayName,
                                pictureUrl: normalizedPictureUrl,
                                lineUserId: profile.userId,
                            });
                            setLoading(false);
                            return;
                        }

                        setPendingLineProfile(profile);
                        setRequiresLinePhoneBinding(true);
                        setUser(null);
                        setLoading(false);
                        return;
                    }
                }

                if (firebaseUser && mounted) {
                    setPendingLineProfile(null);
                    setRequiresLinePhoneBinding(false);
                    setUser(mapFirebaseUser(firebaseUser));
                    setLoading(false);
                    return;
                }
            } catch (err) {
                console.error('Auth check error:', err);
            }

            if (mounted) {
                setPendingLineProfile(null);
                setRequiresLinePhoneBinding(false);
                setUser(null);
                setLoading(false);
            }
        };

        if (!hasFirebaseConfig) {
            void handleAuthState(null);
            return () => {
                mounted = false;
            };
        }

        const unsub = onAuthStateChanged(auth, (firebaseUser) => {
            void handleAuthState(firebaseUser);
        });

        return () => {
            mounted = false;
            unsub();
        };
    }, []);

    const loginLine = () => {
        if (hasFirebaseConfig) {
            void signOut(auth).catch(() => {
                // ignore
            });
        }
        setUser(null);
        setPendingLineProfile(null);
        setRequiresLinePhoneBinding(false);
        loginWithLine();
    };

    const bindLinePhone = async (phone: string) => {
        if (!pendingLineProfile) {
            throw new Error('LINE profile is not ready for binding.');
        }

        const normalizedInput = normalizePhone(phone);
        if (!normalizedInput) {
            throw new Error('Please enter a valid phone number.');
        }

        const members = await getTeamMembers();
        const matchedMember = findMemberByPhone(members, normalizedInput);

        if (!matchedMember) {
            throw new Error('Phone number was not found in system users.');
        }

        if (matchedMember.lineUserId && matchedMember.lineUserId !== pendingLineProfile.userId) {
            throw new Error('This phone is already linked with another LINE account.');
        }

        const normalizedPictureUrl = normalizeLinePictureUrl(pendingLineProfile.pictureUrl);
        const memberPatch: Partial<TeamMember> = { lineUserId: pendingLineProfile.userId };
        if (normalizedPictureUrl && matchedMember.avatar !== normalizedPictureUrl) {
            memberPatch.avatar = normalizedPictureUrl;
        }

        await updateTeamMember(matchedMember.id, memberPatch);

        setRequiresLinePhoneBinding(false);
        setPendingLineProfile(null);
        setUser({
            uid: pendingLineProfile.userId,
            displayName: matchedMember.name || pendingLineProfile.displayName,
            pictureUrl: normalizedPictureUrl,
            lineUserId: pendingLineProfile.userId,
        });
    };

    const loginWithPassword = async (userOrEmail: string, password: string) => {
        if (!hasFirebaseConfig) {
            throw new Error('Firebase Auth is not configured in this environment.');
        }

        const email = toAuthEmail(userOrEmail);
        if (!email || !password.trim()) {
            throw new Error('Please enter User/Email and Password.');
        }

        const credential = await signInWithEmailAndPassword(auth, email, password);
        setUser(mapFirebaseUser(credential.user));
    };

    const registerWithPassword = async (userOrEmail: string, password: string, displayName?: string) => {
        if (!hasFirebaseConfig) {
            throw new Error('Firebase Auth is not configured in this environment.');
        }

        const email = toAuthEmail(userOrEmail);
        if (!email || !password.trim()) {
            throw new Error('Please enter User/Email and Password.');
        }

        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const finalName = (displayName || userOrEmail).trim();
        if (finalName) {
            await updateProfile(credential.user, { displayName: finalName });
        }

        setUser({
            uid: credential.user.uid,
            displayName: finalName || credential.user.email?.split('@')[0] || 'User',
            pictureUrl: credential.user.photoURL || undefined,
            lineUserId: undefined,
        });
    };

    const logoutUser = () => {
        if (hasFirebaseConfig) {
            void signOut(auth).catch(() => {
                // ignore
            });
        }

        try {
            lineLogout();
        } catch {
            // ignore if not LINE
        }

        setPendingLineProfile(null);
        setRequiresLinePhoneBinding(false);
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                loginLine,
                pendingLineProfile,
                requiresLinePhoneBinding,
                bindLinePhone,
                loginWithPassword,
                registerWithPassword,
                logoutUser,
                isAuthenticated: !!user,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
