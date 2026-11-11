'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { detachPushSubscription } from '@/lib/push/client';
import { clearOfflineStore } from '@/lib/tickets/offline-store';
import { clearAllScanMemory } from '@/lib/scan/scan-memory';

/**
 * Lot 7 (7.5) — synchronisation des billets hors ligne chargée à la demande.
 *
 * components/tickets/OfflineTicketsSync.tsx (et lib/tickets/offline-clock.ts) n'est plus dans le JavaScript
 * de chaque page : son module n'est demandé qu'une fois la session connue et le rôle CLIENT lu sur le
 * serveur. Le visiteur, le partenaire et le contrôleur (scanner) ne le téléchargent jamais. Sur Mes billets,
 * qui l'importe déjà, le chargement est immédiat.
 *
 * Un échec du chargement (réseau coupé à ce moment-là) est journalisé ; le module est redemandé au retour du
 * réseau (`online`) ou au prochain montage. La purge à la déconnexion n'en dépend pas : clearOfflineStore
 * reste importé ici et appelé dans signOut et sur SIGNED_OUT.
 */
type OfflineSyncComponent = React.ComponentType;
let offlineSyncModule: Promise<OfflineSyncComponent> | null = null;

function loadOfflineTicketsSync(): Promise<OfflineSyncComponent> {
    if (!offlineSyncModule) {
        offlineSyncModule = import('@/components/tickets/OfflineTicketsSync')
            .then((m) => m.OfflineTicketsSync)
            .catch((err: unknown) => {
                offlineSyncModule = null; // nouvel essai possible au prochain appel ; l'erreur remonte à l'appelant
                throw err;
            });
    }
    return offlineSyncModule;
}

function LazyOfflineTicketsSync() {
    const [Sync, setSync] = useState<OfflineSyncComponent | null>(null);

    useEffect(() => {
        if (Sync) return;
        let active = true;
        const load = () => {
            loadOfflineTicketsSync()
                .then((component) => {
                    if (active) setSync(() => component);
                })
                .catch((err: unknown) => {
                    console.error(
                        '[AuthProvider] synchronisation des billets hors ligne non chargée (nouvel essai au retour du réseau) :',
                        err instanceof Error ? err.message : String(err),
                    );
                });
        };
        load();
        window.addEventListener('online', load);
        return () => {
            active = false;
            window.removeEventListener('online', load);
        };
    }, [Sync]);

    return Sync ? <Sync /> : null;
}

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
    city?: string | null;
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
    /**
     * Lot 9 bis (R51, B34) : permission d'administration servie par /api/auth/me (`admin_permissions` : lignes
     * d'un ADMIN, toutes pour un SUPERADMIN, aucune sinon). Sert seulement à masquer un bouton : la route décide.
     */
    hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [partner, setPartner] = useState<PartnerProfile | null>(null);
    const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    /** Lot 7 (7.1) : compte de la dernière session vue, pour purger le stockage hors ligne d'un autre compte. */
    const lastUserIdRef = useRef<string | null>(null);

    /**
     * Lot 1B.1 — profil et rôles viennent uniquement du serveur (/api/auth/me : public.users et
     * public.user_roles). Jamais de user_metadata, modifiable par l'utilisateur. Si le serveur ne
     * répond pas, aucun rôle n'est accordé (profil null) et l'erreur est journalisée.
     * Lot 7 (7.1) : sans réseau (navigator.onLine faux, billet hors ligne), /api/auth/me n'est pas appelé ;
     * le profil est relu au retour du réseau.
     */
    const fetchUserProfile = useCallback(async (_userId: string, currentSession?: Session | null) => {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            console.warn('[AuthProvider] hors ligne : profil relu au retour du réseau');
            return;
        }
        try {
            const res = await fetch('/api/auth/me', {
                headers: currentSession?.access_token ? { 'Authorization': `Bearer ${currentSession.access_token}` } : {}
            });
            const data = await res.json().catch((err: unknown) => {
                console.error(`[AuthProvider] /api/auth/me : réponse illisible (HTTP ${res.status})`, err);
                return null;
            });
            if (!res.ok || !data?.authenticated || !data?.profile) {
                console.error(`[AuthProvider] /api/auth/me : HTTP ${res.status}`, data?.error ?? '');
                setProfile(null);
                setPartner(null);
                setAdminPermissions([]);
                return;
            }
            setProfile(data.profile as UserProfile);
            setPartner((data.partner as PartnerProfile | null) || null);
            // Lot 9 bis (R51) : aucune permission supposée si le champ manque ou n'est pas une liste de textes.
            const perms: unknown = data.admin_permissions;
            setAdminPermissions(Array.isArray(perms) ? perms.filter((p): p is string => typeof p === 'string') : []);
        } catch (err) {
            console.error('[AuthProvider] chargement du profil impossible :', err);
            setProfile(null);
            setPartner(null);
            setAdminPermissions([]);
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
                const nextUserId: string | null = newSession?.user?.id ?? null;
                const previousUserId = lastUserIdRef.current;
                // Lot 7 (7.1, contrat 5.2) : billets hors ligne effacés à la déconnexion et à la connexion d'un
                // autre compte (téléphone partagé) ; clearOfflineStore ne lève jamais (échec journalisé).
                if (event === 'SIGNED_OUT') {
                    void clearOfflineStore();
                    // Lot 7 (A10) : mémoire du contrôle (événement, mode, scan en attente) effacée à la déconnexion
                    clearAllScanMemory();
                } else if (event === 'SIGNED_IN' && nextUserId && previousUserId && nextUserId !== previousUserId) {
                    void clearOfflineStore();
                }
                if (nextUserId) lastUserIdRef.current = nextUserId;
                else if (event === 'SIGNED_OUT') lastUserIdRef.current = null;
                setSession(newSession);
                setUser(newSession?.user ?? null);

                if (newSession?.user) {
                    await fetchUserProfile(newSession.user.id, newSession);
                } else {
                    setProfile(null);
                    setPartner(null);
                    setAdminPermissions([]);
                }
                setIsLoading(false);
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [fetchUserProfile]);

    // Lot 7 (7.1) : profil non lu hors ligne, relu au retour du réseau.
    useEffect(() => {
        if (!user || profile) return;
        const onOnline = () => { void fetchUserProfile(user.id, session); };
        window.addEventListener('online', onOnline);
        return () => window.removeEventListener('online', onOnline);
    }, [user, profile, session, fetchUserProfile]);

    const signOut = async () => {
        try {
            // Lot 7 (7.1) : billets hors ligne effacés avant la déconnexion (au cas où SIGNED_OUT n'arrive pas).
            await clearOfflineStore();
            // Lot 7 (A10) : mémoire du contrôle effacée aussi (scan partenaire et scanner contrôleur)
            clearAllScanMemory();
            // Lot 6 (contrat F4) : l'appareil est détaché du compte avant la déconnexion (ne lève jamais).
            await detachPushSubscription();
            const supabase = getBrowserClient();
            await supabase.auth.signOut();
        } catch (e) {
            console.warn('[AuthProvider] Signout notice:', e);
        } finally {
            setUser(null);
            setProfile(null);
            setPartner(null);
            setAdminPermissions([]);
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

    const hasPermission = useCallback((permission: string): boolean => {
        return adminPermissions.includes(permission);
    }, [adminPermissions]);

    // Lot 7 (7.5) : billets hors ligne synchronisés seulement pour un compte client (module chargé à la demande).
    const syncOfflineTickets = !isLoading && !!user && hasRole('CLIENT');

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
                hasPermission,
            }}
        >
            {syncOfflineTickets && <LazyOfflineTicketsSync />}
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
            hasPermission: () => false,
        };
    }
    return context;
};
