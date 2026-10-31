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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [partner, setPartner] = useState<PartnerProfile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    /**
     * Lot 1B.1 — profil et rôles viennent uniquement du serveur (/api/auth/me : public.users et
     * public.user_roles). Jamais de user_metadata, modifiable par l'utilisateur. Si le serveur ne
     * répond pas, aucun rôle n'est accordé (profil null) et l'erreur est journalisée.
     */
    const fetchUserProfile = useCallback(async (_userId: string, currentSession?: Session | null) => {
        try {
            const res = await fetch('/api/auth/me', {
                headers: currentSession?.access_token ? { 'Authorization': `Bearer ${currentSession.access_token}` } : {}
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.authenticated || !data?.profile) {
                console.error(`[AuthProvider] /api/auth/me : HTTP ${res.status}`, data?.error ?? '');
                setProfile(null);
                setPartner(null);
                return;
            }
            setProfile(data.profile as UserProfile);
            setPartner((data.partner as PartnerProfile | null) || null);
        } catch (err) {
            console.error('[AuthProvider] chargement du profil impossible :', err);
            setProfile(null);
            setPartner(null);
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
