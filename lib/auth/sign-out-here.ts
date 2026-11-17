/**
 * Sécurité (déconnexion sans réseau) — « Se déconnecter » ferme TOUJOURS la session sur ce téléphone, tout de suite, avec
 * ou sans réseau ; la révocation côté serveur est tentée, et refaite au retour du réseau tant que les jetons restent en
 * mémoire (jamais écrits dans un stockage). Page rechargée ou fermée avant : révocation abandonnée, plus personne n'a les
 * jetons sur ce téléphone.
 *
 * Pourquoi pas auth.signOut : sans réseau, avec un jeton d'accès échu (plus d'une heure), auth-js tente d'abord de le
 * rafraîchir (jusqu'à 25 s d'essais), échoue et rend une erreur SANS effacer la session (GoTrueClient, _signOut). Les
 * cookies restaient ; au retour du réseau, le middleware rouvrait le compte pour la personne suivante.
 *
 * Module chargé par chaque page (components/providers/AuthProvider.tsx) : sans autre dépendance que le client Supabase.
 */
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/client';

/** Jetons gardés en mémoire pour la révocation côté serveur. */
export interface HeldTokens {
    access: string;
    refresh: string;
    /** « Déconnecter tous mes appareils » : toutes les sessions du compte (route /api/auth/sign-out-global, journalisée). */
    everywhere: boolean;
}

/**
 * Efface la session de ce navigateur sans réseau, et ne lève jamais : _removeSession d'auth-js (méthode interne, comportement
 * verrouillé par tests/parcours/securite-deconnexion.test.ts avec la vraie bibliothèque) efface tous les morceaux du cookie
 * de session et émet SIGNED_OUT dans cet onglet (purges d'AuthProvider, temps réel remis sur la clé anonyme) et dans les
 * autres ; filet : tout cookie « sb-…-auth-token… » restant est effacé.
 */
export async function dropLocalSession(auth: unknown): Promise<void> {
    try {
        await (auth as { _removeSession?: () => Promise<void> })._removeSession?.();
    } catch {
        // un abonné a levé : le stockage est déjà vidé (filet ci-dessous pour tout autre cas)
    }
    if (typeof document === 'undefined') return;
    for (const c of document.cookie.split(';')) {
        const name = c.split('=')[0].trim();
        if (/^sb-.+-auth-token/.test(name)) document.cookie = `${name}=; path=/; max-age=0`;
    }
}

/**
 * Notifications (lot 6, contrat F4) : l'abonnement de ce navigateur est retiré, sans réseau ; ne lève jamais. Pas de retrait
 * côté serveur ici : la session est déjà effacée (la route le refuserait) ; l'abonnement resté côté serveur est supprimé au
 * premier envoi refusé par le service push (404 ou 410, lib/push/client.ts). Ici plutôt que detachPushSubscription : le
 * module des notifications reste hors du JavaScript de chaque page.
 */
export async function unsubscribePush(): Promise<void> {
    try {
        const reg = await navigator.serviceWorker?.getRegistration();
        await (await reg?.pushManager.getSubscription())?.unsubscribe();
    } catch {
        // pas de service worker, ou abonnement déjà retiré : rien à faire
    }
}

/**
 * Révocation côté serveur avec les jetons gardés : jeton d'accès encore valable → déconnexion ; refusé (échu) → nouveau
 * jeton par le jeton de rafraîchissement (même session), puis déconnexion. « fait » : révoquée, ou plus rien à révoquer (jeton
 * de rafraîchissement refusé : session déjà close) ; « reseau » : à refaire (réseau absent, serveur indisponible). Les
 * jetons les plus récents sont gardés dans `t` pour l'essai suivant.
 */
export async function revokeHeld(t: HeldTokens): Promise<'fait' | 'reseau'> {
    try {
        for (let renewed = false; ; renewed = true) {
            const res = t.everywhere
                ? await fetch('/api/auth/sign-out-global', { method: 'POST', headers: { authorization: `Bearer ${t.access}` } })
                : await fetch(`${SUPABASE_URL}/auth/v1/logout?scope=local`, {
                    method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${t.access}` },
                });
            if (res.ok) return 'fait';
            if (res.status >= 500) return 'reseau';
            if (renewed || (res.status !== 401 && res.status !== 403)) return 'fait';
            const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
                method: 'POST',
                headers: { apikey: SUPABASE_ANON_KEY, 'content-type': 'application/json' },
                body: JSON.stringify({ refresh_token: t.refresh }),
            });
            if (!r.ok) return r.status >= 500 ? 'reseau' : 'fait';
            const s = (await r.json()) as { access_token: string; refresh_token: string };
            t.access = s.access_token;
            t.refresh = s.refresh_token;
        }
    } catch {
        return 'reseau';
    }
}

let held: HeldTokens | null = null;
let then: () => void = () => {};
let timer: ReturnType<typeof setTimeout> | undefined;
let tries = 0;

/** Retour du réseau : nouvel essai tout de suite, puis de nouveau rapprochés (le réseau peut mettre un instant à servir). */
const onOnline = () => {
    tries = 0;
    void retryRevocation();
};

/**
 * Un essai de révocation des jetons gardés. Échec (réseau absent ou pas encore prêt, serveur indisponible) : refait au
 * retour du réseau (événement « online ») et par une attente qui double, de 1 s à 30 s au plus (un réseau présent mais
 * sans données ne déclenche pas « online »). Fait (ou rien à révoquer) : `then` (écran de connexion). Exporté pour les tests.
 */
export async function retryRevocation(): Promise<void> {
    clearTimeout(timer);
    removeEventListener('online', onOnline);
    if (held ? (await revokeHeld(held)) === 'reseau' : !navigator.onLine) {
        addEventListener('online', onOnline, { once: true });
        timer = setTimeout(retryRevocation, Math.min(30_000, 1_000 * 2 ** tries++));
        return;
    }
    held = null;
    then();
}

/** Garde les jetons (null : rien à révoquer) et tente la révocation tout de suite ; `next` : une fois faite. */
export function revokeSoon(tokens: HeldTokens | null, next: () => void): void {
    held = tokens;
    then = next;
    tries = 0;
    void retryRevocation();
}
