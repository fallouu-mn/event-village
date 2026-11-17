/**
 * Finition 3d — aides de test communes aux suites f3d-role et f3d-telephone.
 *
 * confirmIdentity(admin) : « mot de passe et code administrateur » d'une action sensible, saisis pour de vrai par les routes
 * de l'étape de sécurité : mot de passe par POST /api/admin/step-up (password_confirmations de CETTE session), code reçu par
 * le faux MTarget puis saisi par POST /api/admin/step-up/sms (appareil = la session, client par jeton). Aucune écriture
 * directe en base : la suite prouve le chemin réel.
 */
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { getFakes } from '../fakes';
import { BASE_URL, STRONG_PASSWORD } from './helpers';
import type { Buyer } from './paiement-helpers';

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

export interface CallResult { status: number; body: Record<string, unknown> }

export async function callRoute(modulePath: string, method: string, url: string, token: string | null, body?: unknown, params?: Record<string, string>): Promise<CallResult> {
    const mod = (await import(modulePath)) as Record<string, Handler | undefined>;
    const handler = mod[method];
    assert.equal(typeof handler, 'function', `${method} ${url} absente (${modulePath})`);
    const headers: Record<string, string> = { 'content-type': 'application/json', 'x-forwarded-for': `198.51.100.${(Math.floor(Math.random() * 250)) + 1}` };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await handler!(new NextRequest(`${BASE_URL}${url}`, {
        method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }), params ? { params: Object.assign(Promise.resolve(params), params) } : undefined);
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

export function show(r: CallResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 600)}`;
}

/** Textes des SMS reçus par ce numéro (faux MTarget), dans l'ordre. */
export function smsTo(phoneE164: string): string[] {
    return getFakes().sms.messagesTo(phoneE164).map((m) => String(m.message ?? ''));
}

/** Dernier code à 6 chiffres envoyé par SMS au numéro donné (faux MTarget). */
export async function lastSmsCode(phoneE164: string): Promise<string> {
    const messages = smsTo(phoneE164);
    const last = messages[messages.length - 1];
    assert.ok(last, `aucun SMS reçu au ${phoneE164}`);
    const m = /\b(\d{6})\b/.exec(last);
    assert.ok(m, `SMS sans code à 6 chiffres : ${last}`);
    return m[1];
}

/**
 * Mot de passe puis code administrateur, par les routes de l'étape de sécurité (identité confirmée 10 minutes). Un compte
 * de test neuf (newAdmin) a le mot de passe STRONG_PASSWORD ; un compte de référence (signInAs) passe le sien et son numéro.
 */
export async function confirmIdentity(admin: Pick<Buyer, 'accessToken' | 'phoneE164'>, password: string = STRONG_PASSWORD): Promise<void> {
    const pwd = await callRoute('../../app/api/admin/step-up/route', 'POST', '/api/admin/step-up', admin.accessToken, { password });
    assert.equal(pwd.status, 200, `mot de passe : ${show(pwd)}`);
    const send = await callRoute('../../app/api/admin/step-up/sms/route', 'POST', '/api/admin/step-up/sms', admin.accessToken, {});
    assert.equal(send.status, 200, `envoi du code administrateur : ${show(send)}`);
    const code = await lastSmsCode(admin.phoneE164);
    const verify = await callRoute('../../app/api/admin/step-up/sms/route', 'POST', '/api/admin/step-up/sms', admin.accessToken, { code });
    assert.equal(verify.status, 200, `code administrateur : ${show(verify)}`);
}

/** Changement de rôle par l'écran « Changer le rôle » (identité déjà confirmée). */
export async function changeRoleByScreen(actorToken: string, targetId: string, body: Record<string, unknown>): Promise<CallResult> {
    return callRoute('../../app/api/admin/users/[id]/role/route', 'POST', `/api/admin/users/${targetId}/role`, actorToken, body, { id: targetId });
}
