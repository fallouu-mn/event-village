/**
 * Cvf2b 6.5 — session close à l'insu du navigateur (« Déconnecter tous mes appareils » depuis un autre appareil, session
 * révoquée ou expirée côté serveur). Le navigateur ne reçoit alors jamais SIGNED_OUT : au chargement suivant, le
 * middleware efface les cookies de session et la page ne voit qu'un INITIAL_SESSION sans compte. Sans ce module, les
 * billets hors ligne (codes d'entrée compris, montrés par la page publique /billet/hors-ligne), la mémoire du contrôle
 * et les brouillons du compte restaient sur le téléphone.
 *
 *  - middleware.ts : quand il efface une session (cookie de session présent dans la requête, vidé dans la réponse), il
 *    pose le signal SESSION_CLOSED_COOKIE (lisible par la page, cinq minutes) ;
 *  - components/providers/AuthProvider.tsx : sur INITIAL_SESSION sans compte, si sessionEnded() est vrai, tout est
 *    effacé (billets hors ligne, mémoire du contrôle, brouillons).
 *
 * « Session absente » veut dire : aucun cookie de session NON VIDE dans ce navigateur, ou le signal du middleware. Un
 * cookie de session présent avec une session illisible (sans réseau, jeton d'accès échu : le rafraîchissement échoue)
 * n'est PAS une fin de session : les billets hors ligne restent, c'est leur raison d'être.
 *
 * Module minuscule et sans dépendance : importé par AuthProvider (chaque page) et par le middleware.
 */

/** Signal posé par le middleware quand il efface une session (valeur « 1 »). */
export const SESSION_CLOSED_COOKIE = 'ev-session-close';

/** Cookie de session @supabase/ssr (`sb-<projet>-auth-token`, découpé en `.0`, `.1`…). */
export const SESSION_COOKIE = /^sb-.+-auth-token(?:\.\d+)?$/;

/**
 * Vrai quand ce navigateur n'a plus de session : signal du middleware (consommé ici), ou aucun cookie de session non
 * vide. Faux hors du navigateur. Ne lève jamais.
 */
export function sessionEnded(): boolean {
    try {
        const signalled = /(?:^|;\s*)ev-session-close=1(?:;|$)/.test(document.cookie);
        if (signalled) document.cookie = `${SESSION_CLOSED_COOKIE}=; path=/; max-age=0`;
        // Cookie de session non vide (même règle que SESSION_COOKIE, valeur en plus)
        return signalled || !/(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=[^;]/.test(document.cookie);
    } catch {
        return false;
    }
}
