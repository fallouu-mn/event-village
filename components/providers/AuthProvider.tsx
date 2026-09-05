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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [partner, setPartner] = useState<PartnerProfile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    const fetchUserProfile = useCallback(async (userId: string, currentSession?: Session | null) => {
        try {
            const supabase = getBrowserClient();

            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (userError) {
                console.error('[AuthProvider] Erreur chargement profil user:', userError);
            }

            let partnerData: PartnerProfile | null = null;
            if (userData) {
                const userProfile = userData as UserProfile;
                if (userProfile.role === 'PARTENAIRE') {
                    const { data } = await supabase
                        .from('partners')
                        .select('id, company_name, commercial_name, status, is_verified, trial_started_at, trial_ends_at, is_founder')
                        .eq('user_id', userId)
                        .maybeSingle();
                    partnerData = data ? (data as unknown as PartnerProfile) : null;
                }
                // Both setters called consecutively — React 18 batches into a single re-render.
                setProfile(userProfile);
                setPartner(partnerData);
            } else if (currentSession?.user) {
                const meta = currentSession.user.user_metadata || {};
                setProfile({
                    id: currentSession.user.id,
                    first_name: meta.first_name || 'Utilisateur',
                    last_name: meta.last_name || 'Event Village',
                    phone: currentSession.user.phone || meta.phone || '',
                    email: currentSession.user.email || null,
                    role: meta.role || 'CLIENT',
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

        // onAuthStateChange fires INITIAL_SESSION immediately on subscribe with the current
        // session — no need for a separate getSession() call that would double fetchUserProfile.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event: string, newSession: any) => {
                setSession(newSession);
                setUser(newSession?.user ?? null);
                // Session geree par @supabase/ssr — plus de cookie manuel

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
        };
    }
    return context;
};
