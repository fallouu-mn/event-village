#!/usr/bin/env node
/**
 * Lot 9 ter, tâche 9t.1 (consigne 0.1, arbitrage 6 ; contrat A.1.4) — npm run essai:fiche-partenaire : essai « une
 * partenaire tente de se valider elle-même ».
 *
 * Lit `.env.local` du dossier de travail (scripts/dev/env-local.mjs, aucune valeur affichée), se connecte au compte
 * partenaire de l'essai avec la clé publique (anon) seulement, lit sa fiche, tente un PATCH REST de `status` à sa
 * valeur actuelle (aucune modification de statut même si la protection manquait), relit la fiche, puis ferme la
 * session. Délai de 15 s par appel.
 *
 * Sortie : 0 protégé ; 1 non protégé (PATCH accepté ou statut relu différent) ; 2 contrôle impossible (variable
 * absente, URL refusée, connexion refusée, fiche introuvable, réponse inattendue, réseau).
 */
import {
    ESSAI_PARTNER_EMAIL, EXIT_EXPOSED, EXIT_IMPOSSIBLE, EXIT_PROTECTED, EXPOSED_TEXT, REQUIRED_ENV, SESSION_NOT_CLOSED_TEXT,
    impossibleLine, projectLine, protectedLine, readPartner, readPatch, readSignIn, resolveFicheTarget,
} from './essai-fiche-partenaire.core.mjs';
import { loadLocalEnv } from './env-local.mjs';

const TIMEOUT_MS = 15_000;

function impossible(reason) {
    console.error(impossibleLine(reason));
    process.exitCode = EXIT_IMPOSSIBLE;
}

/** Code d'une erreur réseau de fetch (ECONNREFUSED…), jamais son message entier. */
function networkCode(err) {
    const cause = err instanceof Error ? err.cause : undefined;
    if (err instanceof Error && err.name === 'TimeoutError') return 'délai dépassé';
    return cause?.code ?? cause?.errors?.[0]?.code ?? 'erreur réseau';
}

class NetworkError extends Error {
    constructor(code) {
        super(`connexion impossible à NEXT_PUBLIC_SUPABASE_URL (${code}).`);
        this.name = 'NetworkError';
    }
}

/**
 * Un appel HTTP : statut et texte du corps. Une panne réseau devient une NetworkError au message sans valeur.
 * @returns {Promise<{ status: number, text: string }>}
 */
async function call(target, method, path, { token, body, prefer } = {}) {
    const headers = { apikey: target.anonKey, Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (prefer) headers.Prefer = prefer;
    let res;
    try {
        res = await fetch(`${target.url}${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        return { status: res.status, text: await res.text() };
    } catch (err) {
        throw new NetworkError(networkCode(err));
    }
}

function partnerPath(userId) {
    return `/rest/v1/partners?select=id,status&user_id=eq.${encodeURIComponent(userId)}`;
}

/** Lecture, tentative de modification, relecture. Rend le code de sortie. */
async function attempt(target, token, userId) {
    const first = await call(target, 'GET', partnerPath(userId), { token });
    const before = readPartner(first.status, first.text);
    if (before.kind !== 'ok') {
        impossible(before.reason);
        return EXIT_IMPOSSIBLE;
    }

    const patchReply = await call(target, 'PATCH', `/rest/v1/partners?id=eq.${encodeURIComponent(before.id)}`, {
        token, body: { status: before.status }, prefer: 'return=minimal',
    });
    const patch = readPatch(patchReply.status, patchReply.text);
    if (patch.kind === 'error') {
        impossible(patch.reason);
        return EXIT_IMPOSSIBLE;
    }

    const second = await call(target, 'GET', partnerPath(userId), { token });
    const afterRead = readPartner(second.status, second.text);
    if (patch.kind === 'exposed' || (afterRead.kind === 'ok' && afterRead.status !== before.status)) {
        console.log(EXPOSED_TEXT);
        return EXIT_EXPOSED;
    }
    if (afterRead.kind !== 'ok') {
        impossible(afterRead.reason);
        return EXIT_IMPOSSIBLE;
    }
    console.log(protectedLine(afterRead.status));
    return EXIT_PROTECTED;
}

async function logout(target, token) {
    try {
        const res = await call(target, 'POST', '/auth/v1/logout?scope=local', { token });
        if (res.status < 200 || res.status >= 300) console.log(SESSION_NOT_CLOSED_TEXT);
    } catch (err) {
        console.log(SESSION_NOT_CLOSED_TEXT);
        if (!(err instanceof NetworkError)) throw err;
    }
}

async function main() {
    let target;
    try {
        loadLocalEnv({ required: REQUIRED_ENV });
        target = resolveFicheTarget(process.env);
    } catch (err) {
        impossible(err instanceof Error ? err.message : String(err));
        return;
    }
    console.log(projectLine(target.label));

    let signIn;
    try {
        const reply = await call(target, 'POST', '/auth/v1/token?grant_type=password', {
            body: { email: ESSAI_PARTNER_EMAIL, password: target.password },
        });
        signIn = readSignIn(reply.status, reply.text);
    } catch (err) {
        impossible(err instanceof NetworkError ? err.message : `erreur inattendue (${err instanceof Error ? err.name : typeof err}).`);
        return;
    }
    if (signIn.kind !== 'ok') {
        impossible(signIn.reason);
        return;
    }

    try {
        process.exitCode = await attempt(target, signIn.token, signIn.userId);
    } catch (err) {
        impossible(err instanceof NetworkError ? err.message : `erreur inattendue (${err instanceof Error ? err.name : typeof err}).`);
    } finally {
        await logout(target, signIn.token);
    }
}

main().catch((err) => {
    impossible(`erreur inattendue (${err instanceof Error ? err.name : typeof err}).`);
});
