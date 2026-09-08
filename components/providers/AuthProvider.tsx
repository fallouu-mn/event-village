'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export interface UserProfile {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    email: string | null;
    role: 'CLIENT' | 'PARTENAIRE' | 'ADMIN' | 'CONTROLEUR' | 'SUPERADMIN';
    roles: string[];
    status: 'ACTIF' | 'SUSPENDU' | 'EN_ATTENTE';
    referral_status: 'STANDARD' | 'AMBASSADEUR';
    avatar_url?: string | null;
    created_at?: string;
}

export interface PartnerProfile {
    id: string;
    company_name: string;
    commercial_name?: string | null;
    status: 'EN_ATTENTE' | 'VALIDE' | 'REJETE' | 'SUSPENDU';
    is_verified: boolean;
    trial_started_at?: string | null;
    trial_ends_at?: string | null;
    is_founder?: boolean;
}

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    partner: PartnerProfile | null;
    session: Session | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    hasRole: (role: string) => boolean;
    hasAnyRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function parseRolesFromMetadata(meta: Record<string, unknown> | undefined): string[] {
    if (!meta) return ['CLIENT'];
    const rolesField = meta.roles;
    if (Array.isArray(rolesField) && rolesField.length > 0) return rolesField as string[];
    const legacyRole = meta.role as string | undefined;
    if (legacyRole) return [legacyRole];
    return ['CLIENT'];
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [partner, setPartner] = useState<PartnerProfile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    const fetchUserProfile = useCallback(async (userId: string, currentSession?: Session | null) => {
        try {
            // 1. Essayer de récupérer le profil complet et les multi-rôles via /api/auth/me (backend Service Role)
            try {
                const res = await fetch('/api/auth/me', {
                    headers: currentSession?.access_token ? { 'Authorization': `Bearer ${currentSession.access_token}` } : {}
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data?.authenticated && data?.profile) {
                        setProfile(data.profile);
                        setPartner(data.partner || null);
                        return;
                    }
                }
            } catch {
                // Fallback direct si l'API n'est pas encore disponible
            }

            // 2. Fallback direct via client Supabase sur users
            const supabase = getBrowserClient();
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (userError) {
                console.warn('[AuthProvider] Chargement fallback user:', userError.message);
            }

            let partnerData: PartnerProfile | null = null;
            if (userData) {
                const meta = currentSession?.user?.user_metadata || {};
                const metaRoles = parseRolesFromMetadata(meta as Record<string, unknown>);
                const dbRoles: string[] = (metaRoles && metaRoles.length > 0 && !metaRoles.includes('CLIENT'))
                    ? metaRoles
                    : [userData.role as string || 'CLIENT'];

                const userProfile: UserProfile = {
                    ...(userData as Omit<UserProfile, 'roles'>),
                    roles: dbRoles,
                };

                if (dbRoles.includes('PARTENAIRE')) {
                    const { data } = await supabase
                        .from('partners')
                        .select('id, company_name, commercial_name, status, is_verified, trial_started_at, trial_ends_at, is_founder')
                        .eq('user_id', userId)
                        .maybeSingle();
                    partnerData = data ? (data as unknown as PartnerProfile) : null;
                }
                setProfile(userProfile);
                setPartner(partnerData);
            } else if (currentSession?.user) {
                const meta = currentSession.user.user_metadata || {};
                const sessionRoles = parseRolesFromMetadata(meta as Record<string, unknown>);
                setProfile({
                    id: currentSession.user.id,
                    first_name: (meta.first_name as string) || 'Utilisateur',
                    last_name: (meta.last_name as string) || 'Event Village',
                    phone: currentSession.user.phone || (meta.phone as string) || '',
                    email: currentSession.user.email || null,
                    role: (meta.role as UserProfile['role']) || 'CLIENT',
                    roles: sessionRoles,
                    status: 'ACTIF',
                    referral_status: 'STANDARD',
                });
                setPartner(null);
            }
        } catch (err) {
            console.error('[AuthProvider] Erreur globale fetchUserProfile:', err);
        }
    }, []);

    const refreshProfile = useCallback(async () => {
        if (user) {
            await fetchUserProfile(user.id, session);
        }
    }, [user, session, fetchUserProfile]);

    useEffect(() => {
        const supabase = getBrowserClient();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event: string, newSession: any) => {
                setSession(newSession);
                setUser(newSession?.user ?? null);

                if (newSession?.user) {
                    await fetchUserProfile(newSession.user.id, newSession);
                } else {
                    setProfile(null);
                    setPartner(null);
                }
                setIsLoading(false);
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [fetchUserProfile]);

    const signOut = async () => {
        try {
            const supabase = getBrowserClient();
            await supabase.auth.signOut();
        } catch (e) {
            console.warn('[AuthProvider] Signout notice:', e);
        } finally {
            setUser(null);
            setProfile(null);
            setPartner(null);
            setSession(null);
            router.push('/login');
            router.refresh();
        }
    };

    const hasRole = useCallback((role: string): boolean => {
        return profile?.roles?.includes(role) ?? false;
    }, [profile]);

    const hasAnyRole = useCallback((roles: string[]): boolean => {
        if (!profile?.roles) return false;
        return roles.some(r => profile.roles.includes(r));
    }, [profile]);

    return (
        <AuthContext.Provider
            value={{
                user,
                profile,
                partner,
                session,
                isLoading,
                isAuthenticated: !!user,
                signOut,
                refreshProfile,
                hasRole,
                hasAnyRole,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        return {
            user: null,
            profile: null,
            partner: null,
            session: null,
            isLoading: false,
            isAuthenticated: false,
            signOut: async () => {},
            refreshProfile: async () => {},
            hasRole: () => false,
            hasAnyRole: () => false,
        };
    }
    return context;
};
