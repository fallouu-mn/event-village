/**
 * Lot 9 ter, tâche 9t.1 (consigne 0.1, arbitrage 6 ; contrat A.1.4) — cœur pur de npm run essai:fiche-partenaire.
 *
 * Aucun réseau ici : choix du projet visé et refus, lecture des réponses de GoTrue et de PostgREST, textes des
 * sorties. Seule la clé publique (anon) est lue, jamais la clé serveur. Aucune valeur de clé, de mot de passe ni de
 * jeton n'entre dans un texte rendu par ce module.
 *
 * Codes de sortie : 0 protégé (modification directe refusée par les droits, 42501) ; 1 exposé (modification
 * acceptée, ou statut relu différent) ; 2 contrôle impossible.
 */

export const TAG = '[fiche-partenaire]';
export const EXIT_PROTECTED = 0;
export const EXIT_EXPOSED = 1;
export const EXIT_IMPOSSIBLE = 2;

/** Compte partenaire de l'essai (scripts/dev/seed-dev.core.ts, docs/essai-local.md). */
export const ESSAI_PARTNER_EMAIL = 'partenaire@essai.eventvillage.invalid';

export const REQUIRED_ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'EV_DEV_SEED_PASSWORD'];

export const EXPOSED_TEXT = `${TAG} NON PROTÉGÉ : la fiche partenaire a accepté une modification directe de son statut. Arrêtez l'essai et prévenez l'équipe technique : la migration 20261110000001_lot9ter_rls n'est pas appliquée sur ce projet.`;
export const SESSION_NOT_CLOSED_TEXT = `${TAG} session d'essai non fermée : elle expirera seule.`;
export const SIGN_IN_REFUSED = `connexion du compte ${ESSAI_PARTNER_EMAIL} refusée : lancez d'abord npm run seed:dev sur ce projet.`;
export const PARTNER_NOT_FOUND = 'fiche partenaire du compte introuvable.';

const HOSTED_PROJECT = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const PG_CODE = /^[A-Za-z0-9_]{1,16}$/;

/**
 * Projet visé, ou refus nommé (aucune valeur affichée) : mêmes règles d'URL et de EV_DEV_PROJECT_REF que
 * resolveCheckTarget (scripts/dev/essai-check-reel.core.mjs).
 * @param {Record<string, string | undefined>} env
 * @returns {{ url: string, anonKey: string, password: string, label: string }}
 */
export function resolveFicheTarget(env) {
    const raw = (env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
    const anonKey = (env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
    const password = env.EV_DEV_SEED_PASSWORD ?? '';
    if (!raw) throw new Error('NEXT_PUBLIC_SUPABASE_URL absente de .env.local.');
    if (!anonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY absente de .env.local.');
    if (!password) throw new Error('EV_DEV_SEED_PASSWORD absente de .env.local.');
    if (!URL.canParse(raw)) throw new Error('NEXT_PUBLIC_SUPABASE_URL illisible : refus.');
    const url = new URL(raw);
    const local = LOCAL_HOSTS.has(url.hostname);
    if (url.username !== '' || url.password !== '' || !(url.protocol === 'https:' || (url.protocol === 'http:' && local))) {
        throw new Error('NEXT_PUBLIC_SUPABASE_URL doit être en https, ou une adresse locale (localhost, 127.0.0.1) : refus.');
    }
    const hosted = HOSTED_PROJECT.exec(raw);
    const expectedRef = (env.EV_DEV_PROJECT_REF ?? '').trim();
    if (expectedRef && (!hosted || hosted[1] !== expectedRef)) {
        throw new Error('EV_DEV_PROJECT_REF diffère de la référence du projet de NEXT_PUBLIC_SUPABASE_URL : refus.');
    }
    return { url: url.origin, anonKey, password, label: hosted ? hosted[1] : `local (${url.host})` };
}

export function projectLine(label) {
    return `${TAG} projet ${label} : connexion du compte ${ESSAI_PARTNER_EMAIL} avec la clé publique seulement.`;
}

export function protectedLine(status) {
    return `${TAG} Protégé : la fiche partenaire refuse toute modification directe de son statut (statut ${status} inchangé).`;
}

export function impossibleLine(reason) {
    return `${TAG} contrôle impossible : ${reason}`;
}

/**
 * Corps JSON d'une réponse, ou null s'il est vide ou illisible (jamais affiché).
 * @param {string} text
 */
function parseBody(text) {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (err) {
        if (!(err instanceof SyntaxError)) throw err;
        return null;
    }
}

function isUuidLike(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 64;
}

/**
 * Réponse de POST /auth/v1/token?grant_type=password.
 * @param {number} status
 * @param {string} text
 * @returns {{ kind: 'ok', token: string, userId: string } | { kind: 'refused', reason: string }}
 */
export function readSignIn(status, text) {
    const body = status >= 200 && status < 300 ? parseBody(text) : null;
    const token = body && typeof body === 'object' ? body.access_token : undefined;
    const userId = body && typeof body === 'object' && body.user && typeof body.user === 'object' ? body.user.id : undefined;
    if (typeof token !== 'string' || token === '' || !isUuidLike(userId)) return { kind: 'refused', reason: SIGN_IN_REFUSED };
    return { kind: 'ok', token, userId };
}

/**
 * Réponse de GET /rest/v1/partners?select=id,status&user_id=eq.<compte> : une seule fiche attendue.
 * @param {number} status
 * @param {string} text
 * @returns {{ kind: 'ok', id: string, status: string } | { kind: 'missing', reason: string }}
 */
export function readPartner(status, text) {
    const body = status >= 200 && status < 300 ? parseBody(text) : null;
    const row = Array.isArray(body) && body.length === 1 ? body[0] : null;
    if (!row || typeof row !== 'object' || !isUuidLike(row.id) || typeof row.status !== 'string' || !/^[A-Z_]{1,32}$/.test(row.status)) {
        return { kind: 'missing', reason: PARTNER_NOT_FOUND };
    }
    return { kind: 'ok', id: row.id, status: row.status };
}

/**
 * Réponse de PATCH /rest/v1/partners?id=eq.<fiche> : protégé seulement si refus 401 ou 403 avec le code 42501
 * (droit de table retiré), exposé si 200 ou 204, sinon réponse inattendue.
 * @param {number} status
 * @param {string} text
 * @returns {{ kind: 'protected' } | { kind: 'exposed' } | { kind: 'error', reason: string }}
 */
export function readPatch(status, text) {
    const body = parseBody(text);
    const code = body && typeof body === 'object' && typeof body.code === 'string' && PG_CODE.test(body.code) ? body.code : null;
    if ((status === 401 || status === 403) && code === '42501') return { kind: 'protected' };
    if (status === 200 || status === 204) return { kind: 'exposed' };
    return { kind: 'error', reason: `réponse inattendue (HTTP ${status}) à la tentative de modification.${code ? ` (code ${code})` : ''}` };
}
