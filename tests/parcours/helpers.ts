/**
 * Aides des tests de parcours serveur (tests fonctionnels : les routes s'exécutent
 * avec leur propre client service_role, comme en production).
 */
import '../helpers/env';
import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';

export const BASE_URL = 'http://127.0.0.1:3000';

export function jsonRequest(path: string, body: unknown, headers: Record<string, string> = {}, method = 'POST'): NextRequest {
    return new NextRequest(`${BASE_URL}${path}`, {
        method,
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
    });
}

export function formRequest(path: string, body: string, headers: Record<string, string> = {}): NextRequest {
    return new NextRequest(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
        body,
    });
}

// Horloge des numéros, partagée par toutes les instances du module dans le processus (globalThis) :
// tsx peut charger ce fichier deux fois (ESM et CJS), deux compteurs distincts redonneraient le même numéro.
const PHONE_CLOCK = Symbol.for('event-village.tests.senegal-phone-clock');
const PHONE_SPAN = 8_999_999;   // suffixes 1 000 000 à 9 999 998 (sept chiffres, premier chiffre non nul)
const PHONE_SLEEP_CELL = new Int32Array(new SharedArrayBuffer(4));

function phoneClock(): { last: number } {
    const g = globalThis as typeof globalThis & { [PHONE_CLOCK]?: { last: number } };
    g[PHONE_CLOCK] ??= { last: 0 };
    return g[PHONE_CLOCK];
}

/**
 * Numéro sénégalais mobile valide et neuf (+221<prefix>XXXXXXX), sans collision au cours d'un run.
 *
 * Avant (run 86) : 7 chiffres tirés par Math.random() dans chaque processus de suite, sans mémoire : avec
 * N numéros tirés par run dans un espace de 9 000 000, la probabilité qu'au moins deux coïncident est
 * ≈ 1 − exp(−N² / 18 000 000) (paradoxe des anniversaires : ≈ 5 % pour N = 1 000, ≈ 20 % pour N = 2 000),
 * et GoTrue refuse alors le second compte (« Phone number already registered by another user »).
 *
 * Maintenant : le suffixe est la milliseconde d'horloge murale de l'émission, modulo 8 999 999 (≈ 2 h 30),
 * et jamais deux numéros sur la même milliseconde : dans le processus, une seconde demande dans la même
 * milliseconde attend la suivante (attente synchrone d'au plus 1 ms). Les suites tournent l'une après
 * l'autre (scripts/run-tests.mjs) et chaque numéro est émis au plus tard à l'instant où il est rendu : un
 * processus suivant démarre donc toujours sur une milliseconde plus récente. Deux appels d'un même run (base
 * remise à zéro par la CI) ne rendent jamais le même numéro, quel que soit le préfixe.
 * Base locale conservée d'un run à l'autre : le risque reste celui d'un tirage au hasard contre les comptes
 * des runs précédents (inchangé). Les comptes en masse (massHolders, +22170…) sont hors de cet espace.
 */
export function randomSenegalPhone(prefix: '76' | '77' | '78' = '78'): string {
    const clock = phoneClock();
    let t = Date.now();
    while (t <= clock.last) {
        Atomics.wait(PHONE_SLEEP_CELL, 0, 0, clock.last + 1 - t);
        t = Date.now();
    }
    clock.last = t;
    return `+221${prefix}${1_000_000 + (t % PHONE_SPAN)}`;
}

export function randomEmail(label: string): string {
    return `parcours-${label}-${randomBytes(5).toString('hex')}@test.eventvillage.local`;
}

export const STRONG_PASSWORD = 'Parcours#2026-local';

export function routeContext<T extends Record<string, string>>(params: T): { params: Promise<T> } {
    return { params: Promise.resolve(params) };
}

/** PDF minimal valide (signature %PDF-) pour les dépôts de pièces. */
export const MINIMAL_PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'latin1');

export function uploadRequest(docType: string, content: Buffer = MINIMAL_PDF, mime = 'application/pdf', name = 'piece.pdf', headers: Record<string, string> = {}): NextRequest {
    const form = new FormData();
    form.append('file', new File([new Uint8Array(content)], name, { type: mime }));
    form.append('docType', docType);
    return new NextRequest(`${BASE_URL}/api/partner/documents/upload`, { method: 'POST', body: form, headers });
}

export interface RegistrationDocuments {
    idCardUploadToken: string;
    businessDocUploadToken: string;
    /** Chemins historiques (contrat d'avant le lot 1C.2), envoyés en plus pour compatibilité. */
    idCardUrl: string;
    businessDocUrl: string;
}

/**
 * Dépose la pièce d'identité et le document d'entreprise comme le fait l'écran d'inscription
 * partenaire, et renvoie ce qu'il faut joindre à /api/partner/register.
 */
export async function uploadRegistrationDocuments(): Promise<RegistrationDocuments> {
    const { POST: upload } = await import('../../app/api/partner/documents/upload/route');
    const out: Record<string, string> = {};
    for (const docType of ['id_card', 'business_doc'] as const) {
        const res = await upload(uploadRequest(docType));
        const body = await res.json();
        if (res.status !== 200 || !body.success) throw new Error(`dépôt ${docType} : HTTP ${res.status} ${JSON.stringify(body)}`);
        out[docType] = body.filePath;
        out[`${docType}_token`] = body.uploadToken ?? '';
    }
    return {
        idCardUploadToken: out.id_card_token,
        businessDocUploadToken: out.business_doc_token,
        idCardUrl: out.id_card,
        businessDocUrl: out.business_doc,
    };
}
