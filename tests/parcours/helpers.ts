/**
 * Aides des tests de parcours serveur (tests fonctionnels : les routes s'exécutent
 * avec leur propre client service_role, comme en production).
 */
import '../helpers/env';
import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { getFakes } from '../fakes';

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

// ---------------------------------------------------------------------------------------------------------
// Lot 9 bis (R53, tâche 17) : inscription partenaire en deux appels de la même route.
// ---------------------------------------------------------------------------------------------------------

/** Réponse d'un appel de route, lue une fois. */
export interface RouteReply {
    status: number;
    body: Record<string, unknown>;
    /** En-têtes Set-Cookie (appel 2 : connexion côté serveur). */
    setCookies: string[];
}

export interface PartnerRegistration {
    /** Appel 1, sans `otpCode` : contrat 4, 200 `{ otpSent: true, phone }` et rien de créé. */
    first: RouteReply;
    /** Code lu dans le faux SMS envoyé au numéro par l'appel 1 (null si l'appel 1 est refusé). */
    code: string | null;
    /** SMS enregistrés par le faux adaptateur pour ce numéro pendant l'appel 1, toutes issues confondues. */
    smsDuringFirst: number;
    /** Appel 2, même corps plus `otpCode` : 201, compte et fiche créés. Null si l'appel 1 est refusé ou `stopAfterFirst`. */
    second: RouteReply | null;
}

export interface PartnerRegistrationOptions {
    /** En-têtes des deux appels (par exemple l'IP vue par getClientIp). */
    headers?: Record<string, string>;
    /** Code envoyé à l'appel 2 à la place du code reçu (cas « mauvais code »). */
    otpCode?: string;
    /** N'envoie que l'appel 1 (cas « appel sans code : rien n'est créé »). */
    stopAfterFirst?: boolean;
}

async function readReply(res: Response): Promise<RouteReply> {
    const body = (await res.json()) as Record<string, unknown>;
    return { status: res.status, body, setCookies: res.headers.getSetCookie() };
}

/** Codes à 6 chiffres des SMS reçus par `phone` après les `since` premiers enregistrements. */
function otpCodesSince(phone: string, since: number): { count: number; codes: string[] } {
    const received = getFakes().sms.messagesTo(phone).slice(since);
    const codes = received.map((m) => m.message.match(/\b(\d{6})\b/)?.[1]).filter((c): c is string => Boolean(c));
    return { count: received.length, codes };
}

/**
 * Inscription partenaire en deux appels de `POST /api/partner/register` (contrat lot 9 bis, section 4, R53) :
 *  1. le corps sans `otpCode` : le serveur envoie le code par SMS et ne crée rien ;
 *  2. le même corps plus `otpCode`, lu dans le faux SMS envoyé par l'appel 1 (comptage par numéro neuf) :
 *     le serveur vérifie le code, crée le compte et la fiche, et ouvre la session.
 * Les réponses sont rendues telles quelles : chaque suite garde ses propres assertions. Un refus à l'appel 1
 * (400, 409, 429, 503) arrête là, sans appel 2. Un appel 1 accepté sans SMS de code lève une erreur.
 *
 * Avant le correctif `fix(9b.17)`, l'appel 1 crée déjà le compte et la fiche, puis l'appel 2 est refusé en
 * 409 (« déjà associé à un compte ») : une suite qui attend 201 à l'appel 2 est rouge pour cette raison.
 */
export async function registerPartnerTwoStep(body: Record<string, unknown>, opts: PartnerRegistrationOptions = {}): Promise<PartnerRegistration> {
    if ('otpCode' in body) throw new Error('registerPartnerTwoStep : le corps de l’appel 1 ne doit pas contenir otpCode (passez opts.otpCode)');
    const { POST: register } = await import('../../app/api/partner/register/route');
    const headers = opts.headers ?? {};
    const phone = typeof body.phone === 'string' ? body.phone : null;
    const before = phone ? getFakes().sms.messagesTo(phone).length : 0;

    const first = await readReply(await register(jsonRequest('/api/partner/register', body, headers)));
    if (first.status !== 200 || !phone) return { first, code: null, smsDuringFirst: phone ? otpCodesSince(phone, before).count : 0, second: null };

    const sent = otpCodesSince(phone, before);
    const code = sent.codes.length > 0 ? sent.codes[sent.codes.length - 1] : null;
    if (opts.stopAfterFirst) return { first, code, smsDuringFirst: sent.count, second: null };
    if (!code && opts.otpCode === undefined) {
        throw new Error(`registerPartnerTwoStep : appel 1 accepté (HTTP ${first.status} ${JSON.stringify(first.body)}) mais aucun SMS de code reçu au ${phone}`);
    }
    const otpCode = opts.otpCode ?? (code as string);
    const second = await readReply(await register(jsonRequest('/api/partner/register', { ...body, otpCode }, headers)));
    return { first, code, smsDuringFirst: sent.count, second };
}

// ---------------------------------------------------------------------------------------------------------
// Lot 9 bis (R57, tâche 13) : mot de passe saisi depuis moins de 10 minutes.
// ---------------------------------------------------------------------------------------------------------

/** Compte connecté : sa session est celle de son jeton d'accès (Bearer), comme `Buyer` de paiement-helpers. */
export interface SessionHolder {
    accessToken: string;
}

// Import dynamique : la route n'existe pas avant le correctif fix(9b.13), et le typecheck passe avant les tests.
const PASSWORD_CONFIRM_ROUTE = '../../app/api/account/password-confirm/route';

/**
 * Confirme le mot de passe pour la session de `client` (`POST /api/account/password-confirm` `{ password }`,
 * contrat lot 9 bis, section 4) : étape à placer juste avant un transfert, `phone/start`, `phone/confirm` ou un
 * changement d'email. Lève si la route est absente ou si la réponse n'est pas 200 `{ ok: true }`.
 */
export async function confirmPassword(client: SessionHolder, password: string): Promise<void> {
    let mod: { POST: (req: NextRequest) => Promise<Response> };
    try {
        mod = (await import(PASSWORD_CONFIRM_ROUTE)) as typeof mod;
    } catch (err) {
        throw new Error(`confirmPassword : route /api/account/password-confirm absente (R57, fix(9b.13)) : ${err instanceof Error ? err.message : String(err)}`);
    }
    const res = await mod.POST(jsonRequest('/api/account/password-confirm', { password }, { authorization: `Bearer ${client.accessToken}` }));
    const body = (await res.json()) as Record<string, unknown>;
    if (res.status !== 200 || body.ok !== true) {
        throw new Error(`confirmPassword : HTTP ${res.status} ${JSON.stringify(body)} (attendu 200 { ok: true })`);
    }
}
