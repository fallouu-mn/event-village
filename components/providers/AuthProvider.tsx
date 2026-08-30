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

/**
 * Gestionnaire de cookies côté client pour synchroniser le token avec le Middleware Next.js
 */
function syncAuthCookie(token?: string | null) {
    if (typeof document === 'undefined') return;

    if (token) {
        // Cookie valide 7 jours
        const maxAge = 60 * 60 * 24 * 7;
        const secure = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `sb-access-token=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
    } else {
        document.cookie = 'sb-access-token=; Path=/; Max-Age=0; SameSite=Lax';
    }
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
            const supabase = getBrowserClient();

            // 1. Récupération du profil public.users
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (userError) {
                console.error('[AuthProvider] Erreur chargement profil user:', userError);
            }

            if (userData) {
                const userProfile = userData as UserProfile;
                setProfile(userProfile);

                // 2. Si le rôle est PARTENAIRE, charger les informations du partenaire
                if (userProfile.role === 'PARTENAIRE') {
                    const { data: partnerData, error: partnerError } = await supabase
                        .from('partners')
                        .select('id, company_name, commercial_name, status, is_verified, trial_started_at, trial_ends_at, is_founder')
                        .eq('user_id', userId)
                        .maybeSingle();

                    if (!partnerError && partnerData) {
                        setPartner(partnerData as PartnerProfile);
                    }
                } else {
                    setPartner(null);
                }
            } else if (currentSession?.user) {
                // Fallback structuré depuis les métadonnées si le trigger PostgreSQL n'a pas encore fini
                const meta = currentSession.user.user_metadata || {};
                const fallbackProfile: UserProfile = {
                    id: currentSession.user.id,
                    first_name: meta.first_name || 'Utilisateur',
                    last_name: meta.last_name || 'Event Village',
                    phone: currentSession.user.phone || meta.phone || '',
                    email: currentSession.user.email || null,
                    role: meta.role || 'CLIENT',
                    status: 'ACTIF',
                    referral_status: 'STANDARD',
                };
                setProfile(fallbackProfile);
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

        // 1. Initialiser la session actuelle
        supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
            setSession(initialSession);
            setUser(initialSession?.user ?? null);
            syncAuthCookie(initialSession?.access_token);

            if (initialSession?.user) {
                fetchUserProfile(initialSession.user.id, initialSession).finally(() => {
                    setIsLoading(false);
                });
            } else {
                setProfile(null);
                setPartner(null);
                setIsLoading(false);
            }
        }).catch((err) => {
            console.warn('[AuthProvider] Initial session fetch notice:', err);
            setIsLoading(false);
        });

        // 2. Écouter les changements d'état d'authentification
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                setSession(newSession);
                setUser(newSession?.user ?? null);
                syncAuthCookie(newSession?.access_token);

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
            syncAuthCookie(null);
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
