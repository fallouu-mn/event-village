/**
 * Lot 9 bis, tâche 42 (R85 ; contrat 5.42, 4.4, B89) — « Changer mon mot de passe » une fois connecté :
 * POST /api/account/password `{ current_password, new_password }` (session, `sessionId`).
 *  1. route absente : chaque cas échoue en la nommant (import dynamique) ;
 *  2. mauvais mot de passe actuel → 403 PASSWORD_INCORRECT « Mot de passe actuel incorrect. », rien ne change ;
 *  3. nouveau mot de passe faible → 400, rien ne change ;
 *  4. succès → 200 « Mot de passe modifié. Vos autres appareils sont déconnectés. » ; connexion avec le nouveau, refus
 *     de l'ancien ; session courante gardée, autre session révoquée, aucune session GoTrue de plus (auth.sessions) ; un
 *     seul PASSWORD_CHANGED en file par canal ; une ligne d'audit ACCOUNT_PASSWORD_CHANGED ;
 *  5. sans session → 401 ; compte suspendu → 403 ;
 *  6. 6ᵉ essai en 15 minutes → 429 (quota par compte PASSWORD_CONFIRM_PER_ACCOUNT_15MIN, 5 par défaut) ;
 *  7. statique : ProfileForm ouvre PasswordChangeDialog (trois champs, aide, appel de la route).
 * Mots de passe générés à chaque cas, jamais écrits en clair ; connexions par la clé anon.
 *
 * Rouge avant correctif (fix(9b.42) de S-E, après fix(9b.13) de S-B ; écrans fix(9b.42e)) : la route
 * app/api/account/password/route.ts, la RPC account_password_finalize (M11) et components/profile/PasswordChangeDialog.tsx
 * n'existent pas ; ProfileForm n'a aucun bloc « Mot de passe ». after() : la garde de schéma du lot 9 bis nomme les objets
 * absents jusqu'à M12 (attendu, contrat section 10).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { inspect } from '../helpers/db';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { STRONG_PASSWORD } from './helpers';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { jsonRequest } from './finance-helpers';
import type { RouteResult } from './acces-helpers';
import { outboxRows } from './notif-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { alignQuotaWindow, assertSameQuotaWindow } from './terrain-helpers';

after(async () => {
    await assertLot9bisInvariants('compte-mot-de-passe');
});

type Row = Record<string, unknown>;

const PASSWORD_ROUTE = '../../app/api/account/password/route';
const QUOTA = Number(process.env.PASSWORD_CONFIRM_PER_ACCOUNT_15MIN ?? 5);
const INCORRECT_TEXT = 'Mot de passe actuel incorrect.';
const SUCCESS_TEXT = 'Mot de passe modifié. Vos autres appareils sont déconnectés.';

/** Mot de passe fort neuf (majuscule, minuscules, chiffre, caractère spécial), jamais écrit en clair. */
function newStrongPassword(): string {
    return `Nv#${randomBytes(5).toString('hex')}9A`;
}

/** Mot de passe faible neuf : minuscules et chiffres seulement. */
function newWeakPassword(): string {
    return randomBytes(3).toString('hex');
}

function sameQuotes(v: unknown): string {
    return String(v ?? '').replace(/[’‘]/g, '\'');
}

function sessionIdOf(token: string): string {
    const claims = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { session_id?: string };
    assert.ok(claims.session_id, 'jeton sans session_id');
    return claims.session_id;
}

function anon() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Connexion par mot de passe (clé anon) : jeton, ou null si refusée. */
async function signIn(email: string, password: string): Promise<string | null> {
    const { data, error } = await anon().auth.signInWithPassword({ email, password });
    return error ? null : data.session?.access_token ?? null;
}

async function sessionIds(userId: string): Promise<string[]> {
    return inspect(async (db) => {
        const { rows } = await db.query<{ id: string }>('SELECT id::text AS id FROM auth.sessions WHERE user_id = $1 ORDER BY id', [userId]);
        return rows.map((r) => r.id);
    });
}

async function changePassword(token: string | null, body: Row): Promise<RouteResult> {
    const handler = await routeHandler(PASSWORD_ROUTE, 'POST', 'POST /api/account/password (contrat 4.4, fix(9b.42))');
    return invoke(handler, jsonRequest('/api/account/password', 'POST', token, body));
}

async function passwordChangedByChannel(userId: string): Promise<Record<string, number>> {
    const rows = await outboxRows({ type: 'PASSWORD_CHANGED', userId });
    const out: Record<string, number> = {};
    for (const r of rows) out[r.channel] = (out[r.channel] ?? 0) + 1;
    return out;
}

async function passwordAudits(userId: string): Promise<number> {
    const { count, error } = await service.from('audit_logs').select('id', { count: 'exact', head: true })
        .eq('action', 'ACCOUNT_PASSWORD_CHANGED').eq('object_id', userId);
    assert.equal(error, null, `audit_logs : ${error?.message}`);
    return count ?? 0;
}

async function assertPasswordUnchanged(user: Buyer, what: string): Promise<void> {
    assert.ok(await signIn(user.email, STRONG_PASSWORD), `${what} : l’ancien mot de passe doit rester valable`);
}

describe('R85 — POST /api/account/password : refus sans effet', () => {
    test('mauvais mot de passe actuel → 403 PASSWORD_INCORRECT « Mot de passe actuel incorrect. », mot de passe inchangé', async () => {
        const user = await newBuyer('r85-mauvais');
        const res = await changePassword(user.accessToken, { current_password: `${STRONG_PASSWORD}-faux`, new_password: newStrongPassword() });
        assert.equal(res.status, 403, show(res));
        assert.equal(res.body.code, 'PASSWORD_INCORRECT', show(res));
        assert.equal(sameQuotes(res.body.error), INCORRECT_TEXT, show(res));
        assert.equal(await passwordAudits(user.userId), 0, 'aucun audit');
        await assertPasswordUnchanged(user, 'mauvais mot de passe actuel');
    });

    test('nouveau mot de passe faible → 400, mot de passe inchangé', async () => {
        const user = await newBuyer('r85-faible');
        const weak = newWeakPassword();
        const res = await changePassword(user.accessToken, { current_password: STRONG_PASSWORD, new_password: weak });
        assert.equal(res.status, 400, show(res));
        assert.equal(await signIn(user.email, weak), null, 'le mot de passe faible n’est pas posé');
        await assertPasswordUnchanged(user, 'mot de passe faible');
    });

    test('sans session → 401', async () => {
        const res = await changePassword(null, { current_password: STRONG_PASSWORD, new_password: newStrongPassword() });
        assert.equal(res.status, 401, show(res));
    });

    test('compte suspendu → 403, mot de passe inchangé', async () => {
        const user = await newBuyer('r85-suspendu');
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', user.userId);
        assert.equal(error, null, `suspension : ${error?.message}`);
        const next = newStrongPassword();
        const res = await changePassword(user.accessToken, { current_password: STRONG_PASSWORD, new_password: next });
        assert.equal(res.status, 403, show(res));
        assert.equal(await signIn(user.email, next), null, 'le nouveau mot de passe n’est pas posé');
    });

    test(`au-delà de ${QUOTA} essais en 15 minutes → 429`, async () => {
        const user = await newBuyer('r85-quota');
        const win = await alignQuotaWindow(900, 30_000);
        const statuses: number[] = [];
        for (let i = 0; i <= QUOTA; i++) {
            statuses.push((await changePassword(user.accessToken, { current_password: `${STRONG_PASSWORD}-faux-${i}`, new_password: newStrongPassword() })).status);
        }
        await assertSameQuotaWindow(win, 'essais de changement de mot de passe');
        assert.deepEqual(statuses.slice(0, QUOTA), Array(QUOTA).fill(403), `essais dans le quota (${QUOTA}) : ${statuses.join(', ')}`);
        assert.equal(statuses[QUOTA], 429, `essai ${QUOTA + 1} au-delà du quota : ${statuses.join(', ')}`);
        await assertPasswordUnchanged(user, 'quota');
    });
});

describe('R85 — POST /api/account/password : succès', () => {
    test('200 ; nouveau valable, ancien refusé ; session courante gardée, autre révoquée, aucune de plus ; un PASSWORD_CHANGED par canal ; un audit', async () => {
        const user = await newBuyer('r85-succes');
        const other = await signIn(user.email, STRONG_PASSWORD);
        assert.ok(other, 'seconde session du compte');
        const current = sessionIdOf(user.accessToken);
        assert.notEqual(sessionIdOf(other), current, 'deux sessions distinctes');
        assert.ok((await sessionIds(user.userId)).includes(current), 'session courante dans auth.sessions');
        const before = await passwordChangedByChannel(user.userId);

        const next = newStrongPassword();
        const res = await changePassword(user.accessToken, { current_password: STRONG_PASSWORD, new_password: next });
        assert.equal(res.status, 200, show(res));
        assert.ok(sameQuotes(JSON.stringify(res.body)).includes(sameQuotes(SUCCESS_TEXT)), `message du contrat 4.4 : ${show(res)}`);

        assert.deepEqual(await sessionIds(user.userId), [current], 'seule la session courante reste (autre révoquée, aucune session de vérification laissée)');

        const afterRows = await passwordChangedByChannel(user.userId);
        const added = Object.fromEntries(['IN_APP', 'SMS', 'EMAIL'].map((c) => [c, (afterRows[c] ?? 0) - (before[c] ?? 0)]));
        assert.equal(added.IN_APP, 1, `un seul PASSWORD_CHANGED in-app : ${JSON.stringify(added)}`);
        assert.equal(added.SMS, 1, `un seul PASSWORD_CHANGED par SMS : ${JSON.stringify(added)}`);
        assert.ok(added.EMAIL <= 1, `au plus un PASSWORD_CHANGED par email : ${JSON.stringify(added)}`);
        assert.equal(await passwordAudits(user.userId), 1, 'une ligne d’audit ACCOUNT_PASSWORD_CHANGED, dans la transaction');

        assert.ok(await signIn(user.email, next), 'connexion avec le nouveau mot de passe');
        assert.equal(await signIn(user.email, STRONG_PASSWORD), null, 'l’ancien mot de passe est refusé');
    });
});

describe('R85 — écran du profil (statique)', () => {
    const DIALOG = path.join('components', 'profile', 'PasswordChangeDialog.tsx');
    const FORM = path.join('components', 'profile', 'ProfileForm.tsx');

    test('ProfileForm ouvre PasswordChangeDialog depuis le bloc « Mot de passe »', () => {
        const form = fs.readFileSync(FORM, 'utf8');
        assert.match(form, /import\s*\{?\s*PasswordChangeDialog\b[^;]*from\s*['"][^'"]*PasswordChangeDialog['"]/, 'PasswordChangeDialog non importé');
        assert.match(form, /<PasswordChangeDialog\b/, 'PasswordChangeDialog non rendu');
        assert.ok(form.includes('Changer de mot de passe'), 'bouton « Changer de mot de passe » absent');
        assert.ok(form.includes('Les autres appareils seront déconnectés.'), 'aide « Les autres appareils seront déconnectés. » absente');
    });

    test('PasswordChangeDialog : trois champs, aide de robustesse, appel de POST /api/account/password', () => {
        assert.ok(fs.existsSync(DIALOG), `${DIALOG} absent`);
        const src = fs.readFileSync(DIALOG, 'utf8');
        for (const label of ['Mot de passe actuel', 'Nouveau mot de passe', 'Confirmer le nouveau mot de passe']) {
            assert.ok(src.includes(label), `champ « ${label} » absent`);
        }
        // Lot 9 quinquies (A7, modification signalée au rapport) : aide de la règle commune (PASSWORD_HINT, lib/auth/password-rules.ts)
        assert.ok(src.includes('PASSWORD_HINT'), 'aide de robustesse absente');
        assert.ok(src.includes('/api/account/password'), 'appel de /api/account/password absent');
    });
});
