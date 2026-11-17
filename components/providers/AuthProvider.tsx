'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getBrowserClient } from '@/lib/supabase/client';
import { usePathname, useRouter } from 'next/navigation';
import { clearOfflineStore } from '@/lib/tickets/offline-store';
import { clearAllScanMemory } from '@/lib/scan/scan-memory';
import { clearAllDrafts } from '@/lib/events/draft-purge';
import { dropLocalSession, revokeSoon, unsubscribePush } from '@/lib/auth/sign-out-here';
import { sessionEnded } from '@/lib/auth/session-signal';
import { LinkButton } from '@/components/ui/LinkButton';

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
                    // Nouvel essai au retour du réseau (finition 1 : message raccourci, budget JS de la page d'accueil)
                    console.error('[AuthProvider] billets hors ligne non chargés :', err);
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

/** Finition 1 (complément 14) : retour au premier plan (l'événement du document remonte à window) et refus « contrôle
 * fermé » signalé par le scanner. */
const SCANNER_EVENTS = ['visibilitychange', 'ev:scanner-refresh'];

/** Cvf2b 6.2 : pages d'authentification, sans donnée du compte, jamais remplacées par l'écran « déconnecté ». */
const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password'];

export interface UserProfile {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    email: string | null;
    role: 'CLIENT' | 'PARTENAIRE' | 'ADMIN' | 'CONTROLEUR' | 'SUPERADMIN';
    roles: string[];
    /** Finition 1 (complément 11) : contrôleur seul — menu « Scanner » affiché (null : état illisible, affiché). */
    scanner_open?: boolean | null;
    /** Complément 14 : prochain instant où le menu « Scanner » peut changer (contrôleur seul). */
    scanner_next_change_at?: string | null;
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
    /** Ferme la session sur ce téléphone, avec ou sans réseau ; « partout » : « Déconnecter tous mes appareils ». */
    signOut: (scope?: 'partout') => Promise<void>;
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
    /**
     * Sécurité (déconnexion sans réseau) : « Vous êtes déconnecté de ce téléphone. » à la place de la page (signOut).
     * Cvf2b 6.2 : aussi sur tout SIGNED_OUT, dans TOUS les onglets (autre onglet, autre appareil, session refusée) : un
     * écran personnel déjà affiché (administration, scanner, portefeuille…) ne reste pas lisible.
     */
    const [signedOut, setSignedOut] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
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
            console.warn('[AuthProvider] hors ligne : profil différé');
            return;
        }
        try {
            const res = await fetch('/api/auth/me', {
                headers: currentSession?.access_token ? { 'Authorization': `Bearer ${currentSession.access_token}` } : {}
            });
            const data = await res.json().catch((err: unknown) => {
                console.error('[AuthProvider] /api/auth/me illisible', res.status, err);
                return null;
            });
            if (!res.ok || !data?.authenticated || !data?.profile) {
                console.error('[AuthProvider] /api/auth/me', res.status, data?.error ?? '');
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
            console.error('[AuthProvider] profil :', err);
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
                    // Finition 2b (C) : brouillons du formulaire d'événement aussi (autre onglet, autre appareil, autres
                    // boutons de déconnexion : contrôleur, mot de passe réinitialisé)
                    clearAllDrafts();
                    setSignedOut(true); // cvf2b 6.2 : la page affichée est remplacée, dans tous les onglets
                    // Cvf2b 6.9 : abonnement push de ce navigateur retiré sur toute fin de session (autre onglet, autre
                    // appareil, jeton de rafraîchissement refusé, mot de passe réinitialisé), pas seulement au bouton
                    void unsubscribePush();
                } else if (event === 'SIGNED_IN' && nextUserId && previousUserId && nextUserId !== previousUserId) {
                    void clearOfflineStore();
                } else if (event === 'INITIAL_SESSION' && !nextUserId && sessionEnded()) {
                    // Cvf2b 6.5 : page chargée sans session (close à l'insu du navigateur : « Déconnecter tous mes
                    // appareils » depuis un autre appareil, signal du middleware) : tout ce que le compte a laissé sur
                    // l'appareil est effacé, sans attendre un SIGNED_OUT qui ne viendra pas
                    void clearOfflineStore(true);
                    clearAllScanMemory();
                    clearAllDrafts();
                    void unsubscribePush(); // cvf2b 6.9 : même règle que SIGNED_OUT
                }
                if (nextUserId) {
                    lastUserIdRef.current = nextUserId;
                    setSignedOut(false); // un compte connecté referme l'écran « déconnecté »
                } else if (event === 'SIGNED_OUT') lastUserIdRef.current = null;
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

    // Relectures du profil, un seul gestionnaire :
    //  - Lot 7 (7.1) : profil non lu hors ligne, relu au retour du réseau (`online`) ;
    //  - Finition 1 (complément 14) : contrôleur seul (profil avec scanner_open), menu « Scanner » à jour sans recharger :
    //    relu à l'heure du prochain changement servie par /api/auth/me (scanner_next_change_at, + 1 s ; servie seulement
    //    dans les 24 h, sinon null et rapprochée à chaque renouvellement de session), au retour au premier plan (visibilitychange) et quand le scanner signale un refus
    //    « contrôle fermé » (ev:scanner-refresh) ; jamais en arrière-plan (la relecture attend le premier plan). Le menu
    //    n'est qu'un confort : le serveur refuse lui-même tout scan hors de la plage. Rien pour les autres comptes.
    useEffect(() => {
        const watch = profile?.scanner_open !== undefined;
        if (!user || (profile && !watch)) return;
        const relire = () => void ((watch && document.hidden) || fetchUserProfile(user.id, session));
        const events = profile ? SCANNER_EVENTS : ['online'];
        const at = watch && profile?.scanner_next_change_at;
        const timer = at ? setTimeout(relire, Date.parse(at) - Date.now() + 1e3) : undefined;
        for (const e of events) addEventListener(e, relire);
        return () => {
            clearTimeout(timer);
            for (const e of events) removeEventListener(e, relire);
        };
    }, [user, profile, session, fetchUserProfile]);

    /**
     * Sécurité (déconnexion sans réseau) : la session est fermée sur ce téléphone TOUT DE SUITE, avec ou sans réseau, avant
     * tout appel réseau. Avant : auth.signOut, sans réseau et avec un jeton d'accès échu, gardait la session (cookies), et le
     * compte revenait au retour du réseau. Dans l'ordre, sans jamais lever :
     *  - mémoire du contrôle (lot 7, A10), brouillons (finition 2b, C), billets hors ligne (lot 7, 7.1) : effacés ;
     *  - état de la session remis à zéro, « Vous êtes déconnecté de ce téléphone. » à la place de la page (pas de navigation :
     *    sans réseau, /login ne se charge pas, et la page d'erreur du navigateur perdrait les jetons gardés) ;
     *  - cookies de session effacés (dropLocalSession : SIGNED_OUT, ici et dans les autres onglets) ; abonnement aux
     *    notifications retiré de ce navigateur (lot 6, F4 ; unsubscribePush) ;
     *  - révocation côté serveur avec les jetons gardés en mémoire, refaite au retour du réseau (lib/auth/sign-out-here.ts) ;
     *    faite : écran de connexion avec le même message, puis session de nouveau effacée (cookie qu'une réponse en vol
     *    aurait reposé). Run 307 : l'écran de connexion n'est pas venu dans les 30 s ; la navigation n'attend plus rien.
     * « partout » : « Déconnecter tous mes appareils » (page Profil) ; sinon CET appareil seulement (lot 9 quinquies, B4).
     */
    const signOut = async (scope?: 'partout') => {
        const held = session && { access: session.access_token, refresh: session.refresh_token, everywhere: scope === 'partout' };
        clearAllScanMemory();
        clearAllDrafts();
        void clearOfflineStore();
        setSignedOut(true);
        setUser(null);
        setProfile(null);
        setPartner(null);
        setAdminPermissions([]);
        setSession(null);
        const auth = getBrowserClient().auth;
        await dropLocalSession(auth);
        void unsubscribePush();
        revokeSoon(held, () => {
            router.replace('/login?message=deconnecte');
            void dropLocalSession(auth); // sans l'attendre : il prévient tous les abonnés (temps réel), l'écran n'en dépend pas
        });
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
            {signedOut && !AUTH_PAGES.includes(pathname) ? (
                <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface-sunken p-6 text-center text-fg">
                    <p role="status" className="text-lg font-semibold">Vous êtes déconnecté de ce téléphone.</p>
                    <LinkButton href="/login?message=deconnecte">Se connecter</LinkButton>
                </main>
            ) : children}
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
