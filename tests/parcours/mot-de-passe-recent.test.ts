/**
 * Lot 9 bis, tâche 13 (R57 ; contrat 5.13, B35, 4.2) — changer de numéro ou d'email, et transférer un billet, exigent
 * une saisie du mot de passe datant de moins de 10 minutes, liée à la session.
 *  - POST /api/account/password-confirm `{ password }` : 200 `{ ok: true }`, ligne password_confirmations de la session ;
 *    mauvais mot de passe → 403 PASSWORD_INCORRECT « Mot de passe incorrect. », sans ligne ; quota par compte
 *    (PASSWORD_CONFIRM_PER_ACCOUNT_15MIN, 5 par défaut) → 429 ; aucune session GoTrue de plus (auth.sessions) ;
 *  - sans confirmation récente : POST /api/tickets/[id]/transfer, POST /api/account/phone/start, POST
 *    /api/account/phone/confirm, PATCH /api/account/profile (email changé) → 403 PASSWORD_CONFIRMATION_REQUIRED « Par
 *    sécurité, saisissez votre mot de passe pour continuer. », AVANT tout SMS et sans effet ;
 *  - confirmation de 11 minutes, ou faite sur une AUTRE session du même compte → même refus ;
 *  - confirmation récente sur la session → 200 sur les trois actions.
 * Horloge : la confirmation est vieillie en base (password_confirmations.confirmed_at), jamais par la route.
 *
 * Rouge avant correctif (fix(9b.13), fix(9b.13-SG)) : la route password-confirm et la table n'existent pas ; transfert,
 * phone/start, phone/confirm et profil ne demandent qu'une session (app/api/tickets/[id]/transfer/route.ts:26-28,
 * app/api/account/phone/start/route.ts:24-26, app/api/account/profile/route.ts:24-63) : 200, transfert PENDING et SMS.
 * Fin de suite : assertLot9bisInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { getFakes } from '../fakes';
import { inspect } from '../helpers/db';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { confirmPassword, randomEmail, randomSenegalPhone, STRONG_PASSWORD } from './helpers';
import { newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, createPartnerEvent, jsonRequest, newPartner } from './finance-helpers';
import type { RouteResult } from './acces-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';

after(async () => {
    await assertLot9bisInvariants('mot-de-passe-recent');
});

type Row = Record<string, unknown>;

const REQUIRED_TEXT = 'Par sécurité, saisissez votre mot de passe pour continuer.';
const INCORRECT_TEXT = 'Mot de passe incorrect.';
const CONFIRM_ROUTE = '../../app/api/account/password-confirm/route';
const QUOTA = Number(process.env.PASSWORD_CONFIRM_PER_ACCOUNT_15MIN ?? 5);

let ev: SaleEvent;

before(async () => {
    const partner = await newPartner('r57');
    ev = await createPartnerEvent(partner.partnerId, 'r57', [{ name: 'Standard', price: 3_000, total: 40 }]);
});

function ctx(params: Record<string, string>): { params: Promise<Record<string, string>> & Record<string, string> } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

function sessionIdOf(token: string): string {
    const claims = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { session_id?: string };
    assert.ok(claims.session_id, 'jeton sans session_id');
    return claims.session_id;
}

/** Seconde session du même compte (connexion par mot de passe, clé anon). */
async function secondSession(user: Buyer): Promise<string> {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await anon.auth.signInWithPassword({ email: user.email, password: STRONG_PASSWORD });
    assert.equal(error, null, `seconde connexion : ${error?.message}`);
    return data.session!.access_token;
}

async function confirmRaw(token: string, password: string): Promise<RouteResult> {
    const handler = await routeHandler(CONFIRM_ROUTE, 'POST', 'POST /api/account/password-confirm (R57)');
    return invoke(handler, jsonRequest('/api/account/password-confirm', 'POST', token, { password }));
}

async function confirmationRow(token: string): Promise<Row | null> {
    const { data, error } = await service.from('password_confirmations').select('*').eq('session_id', sessionIdOf(token)).maybeSingle();
    assert.equal(error, null, `password_confirmations (table du contrat B35) : ${error?.message}`);
    return (data as Row | null) ?? null;
}

/** Vieillit la confirmation de la session de 11 minutes (horloge de test, en base). */
async function ageConfirmation(token: string, minutes = 11): Promise<void> {
    const at = new Date(Date.now() - minutes * 60_000).toISOString();
    const { data, error } = await service.from('password_confirmations').update({ confirmed_at: at }).eq('session_id', sessionIdOf(token)).select('session_id');
    assert.equal(error, null, `vieillissement de la confirmation : ${error?.message}`);
    assert.equal((data ?? []).length, 1, 'une confirmation à vieillir');
}

async function gotrueSessions(userId: string): Promise<number> {
    return inspect(async (db) => {
        const { rows } = await db.query<{ n: string }>('SELECT count(*)::text AS n FROM auth.sessions WHERE user_id = $1', [userId]);
        return Number(rows[0].n);
    });
}

async function transfer(token: string, ticketId: string, recipient: string): Promise<RouteResult> {
    const handler = await routeHandler('../../app/api/tickets/[id]/transfer/route', 'POST', 'POST /api/tickets/[id]/transfer');
    return invoke(handler, jsonRequest(`/api/tickets/${ticketId}/transfer`, 'POST', token, { recipient }), ctx({ id: ticketId }));
}

async function phoneStart(token: string, phone: string): Promise<RouteResult> {
    const handler = await routeHandler('../../app/api/account/phone/start/route', 'POST', 'POST /api/account/phone/start');
    return invoke(handler, jsonRequest('/api/account/phone/start', 'POST', token, { phone }));
}

async function phoneConfirm(token: string, phone: string, code: string): Promise<RouteResult> {
    const handler = await routeHandler('../../app/api/account/phone/confirm/route', 'POST', 'POST /api/account/phone/confirm');
    return invoke(handler, jsonRequest('/api/account/phone/confirm', 'POST', token, { phone, code }));
}

async function profile(token: string, user: Buyer, email: string): Promise<RouteResult> {
    const handler = await routeHandler('../../app/api/account/profile/route', 'PATCH', 'PATCH /api/account/profile');
    return invoke(handler, jsonRequest('/api/account/profile', 'PATCH', token, { first_name: user.firstName, last_name: user.lastName, email }));
}

async function transfersOf(ticketId: string): Promise<number> {
    const { count, error } = await service.from('ticket_transfers').select('id', { count: 'exact', head: true }).eq('ticket_id', ticketId);
    assert.equal(error, null, `ticket_transfers : ${error?.message}`);
    return count ?? 0;
}

async function userRow(userId: string): Promise<Row> {
    const { data, error } = await service.from('users').select('phone, email').eq('id', userId).single();
    assert.equal(error, null, error?.message);
    return data as Row;
}

function sameQuotes(v: unknown): string {
    return String(v ?? '').replace(/’/g, '\'');
}

function assertRequired(res: RouteResult, what: string): void {
    assert.equal(res.status, 403, `R57 : ${what} sans mot de passe récent → 403 attendu, ${show(res)}`);
    assert.equal(res.body.code, 'PASSWORD_CONFIRMATION_REQUIRED', `${what} : code, ${show(res)}`);
    assert.equal(sameQuotes(res.body.error), sameQuotes(REQUIRED_TEXT), `${what} : texte du contrat 4.2, ${show(res)}`);
}

async function holderWithTicket(label: string): Promise<{ buyer: Buyer; ticketId: string }> {
    const buyer = await newBuyer(label);
    const { tickets } = await buyConfirmed(buyer, ev, [['Standard', 1]]);
    return { buyer, ticketId: String(tickets[0].id) };
}

function lastCode(phone: string, since: number): string | null {
    const codes = getFakes().sms.messagesTo(phone).slice(since).map((m) => m.message.match(/\b(\d{6})\b/)?.[1]).filter((c): c is string => Boolean(c));
    return codes.length > 0 ? codes[codes.length - 1] : null;
}

describe('R57 — sans saisie récente du mot de passe, les actions sensibles sont refusées avant tout effet', () => {
    test('transfert d’un billet : 403 PASSWORD_CONFIRMATION_REQUIRED, aucun transfert, aucun SMS au destinataire', async () => {
        const { buyer, ticketId } = await holderWithTicket('r57-transfert');
        const recipient = randomSenegalPhone('76');
        const res = await transfer(buyer.accessToken, ticketId, recipient);
        assertRequired(res, 'transfert');
        assert.equal(await transfersOf(ticketId), 0, 'aucun transfert créé');
        assert.equal(getFakes().sms.messagesTo(recipient).length, 0, 'aucun SMS au destinataire');
    });

    test('changement de numéro (phone/start) : 403 avant tout SMS, aucun code envoyé au nouveau numéro', async () => {
        const buyer = await newBuyer('r57-numero');
        const phone = randomSenegalPhone('76');
        const res = await phoneStart(buyer.accessToken, phone);
        assertRequired(res, 'phone/start');
        assert.equal(getFakes().sms.messagesTo(phone).length, 0, 'aucun SMS au nouveau numéro');
    });

    test('changement d’email (PATCH /api/account/profile) : 403, adresse inchangée', async () => {
        const buyer = await newBuyer('r57-email');
        const before = await userRow(buyer.userId);
        const res = await profile(buyer.accessToken, buyer, randomEmail('r57-nouvelle'));
        assertRequired(res, 'changement d’email');
        assert.deepEqual(await userRow(buyer.userId), before, 'compte inchangé');
    });
});

describe('R57 — POST /api/account/password-confirm', () => {
    test('confirmation correcte → 200 { ok: true }, ligne de la session, aucune session GoTrue de plus ; puis transfert, phone/start et changement d’email → 200', async () => {
        const { buyer, ticketId } = await holderWithTicket('r57-confirme');
        const sessions = await gotrueSessions(buyer.userId);
        const res = await confirmRaw(buyer.accessToken, STRONG_PASSWORD);
        assert.equal(res.status, 200, `confirmation : ${show(res)}`);
        assert.equal(res.body.ok, true, show(res));
        const row = await confirmationRow(buyer.accessToken);
        assert.ok(row, 'ligne password_confirmations de la session');
        assert.equal(row.user_id, buyer.userId, 'confirmation liée au compte');
        assert.equal(await gotrueSessions(buyer.userId), sessions, 'aucune session GoTrue laissée par la vérification du mot de passe');

        const recipient = randomSenegalPhone('76');
        const t = await transfer(buyer.accessToken, ticketId, recipient);
        assert.equal(t.status, 200, `transfert après confirmation : ${show(t)}`);
        assert.equal(await transfersOf(ticketId), 1, 'un transfert');

        const phone = randomSenegalPhone('76');
        const p = await phoneStart(buyer.accessToken, phone);
        assert.equal(p.status, 200, `phone/start après confirmation : ${show(p)}`);
        assert.equal(getFakes().sms.messagesTo(phone).length, 1, 'un SMS de code au nouveau numéro');

        const e = await profile(buyer.accessToken, buyer, randomEmail('r57-ok'));
        assert.equal(e.status, 200, `changement d’email après confirmation : ${show(e)}`);
    });

    test('confirmation datée de 11 minutes → 403 sur le transfert et sur phone/confirm (code valide), sans effet', async () => {
        const { buyer, ticketId } = await holderWithTicket('r57-vieille');
        await confirmPassword(buyer, STRONG_PASSWORD);
        const phone = randomSenegalPhone('76');
        const since = getFakes().sms.messagesTo(phone).length;
        const start = await phoneStart(buyer.accessToken, phone);
        assert.equal(start.status, 200, `phone/start avec une confirmation récente : ${show(start)}`);
        const code = lastCode(phone, since);
        assert.ok(code, 'code reçu au nouveau numéro');

        await ageConfirmation(buyer.accessToken, 11);
        const before = await userRow(buyer.userId);
        assertRequired(await phoneConfirm(buyer.accessToken, phone, code), 'phone/confirm avec une confirmation de 11 min');
        assert.deepEqual(await userRow(buyer.userId), before, 'numéro inchangé');
        assertRequired(await transfer(buyer.accessToken, ticketId, randomSenegalPhone('76')), 'transfert avec une confirmation de 11 min');
        assert.equal(await transfersOf(ticketId), 0, 'aucun transfert');
    });

    test('confirmation faite sur une AUTRE session du même compte → 403 sur cette session', async () => {
        const { buyer, ticketId } = await holderWithTicket('r57-autre-session');
        const other = await secondSession(buyer);
        assert.notEqual(sessionIdOf(other), sessionIdOf(buyer.accessToken), 'deux sessions distinctes');
        await confirmPassword({ accessToken: other }, STRONG_PASSWORD);
        assertRequired(await transfer(buyer.accessToken, ticketId, randomSenegalPhone('76')), 'transfert sur la session non confirmée');
        assert.equal(await transfersOf(ticketId), 0, 'aucun transfert');
    });

    test('mauvais mot de passe → 403 PASSWORD_INCORRECT, aucune ligne ; au-delà du quota par compte → 429', async () => {
        const buyer = await newBuyer('r57-mauvais');
        const wrong = await confirmRaw(buyer.accessToken, `${STRONG_PASSWORD}-faux`);
        assert.equal(wrong.status, 403, `mauvais mot de passe : ${show(wrong)}`);
        assert.equal(wrong.body.code, 'PASSWORD_INCORRECT', show(wrong));
        assert.equal(sameQuotes(wrong.body.error), sameQuotes(INCORRECT_TEXT), show(wrong));
        assert.equal(await confirmationRow(buyer.accessToken), null, 'aucune confirmation enregistrée');

        const statuses: number[] = [wrong.status];
        for (let i = 1; i <= QUOTA; i++) statuses.push((await confirmRaw(buyer.accessToken, `${STRONG_PASSWORD}-faux-${i}`)).status);
        assert.deepEqual(statuses.slice(0, QUOTA), Array(QUOTA).fill(403), `essais dans le quota (${QUOTA}) : ${statuses.join(', ')}`);
        assert.equal(statuses[QUOTA], 429, `essai ${QUOTA + 1} au-delà du quota PASSWORD_CONFIRM_PER_ACCOUNT_15MIN : ${statuses.join(', ')}`);
        assert.equal(await confirmationRow(buyer.accessToken), null, 'toujours aucune confirmation');
    });

    test('sans session → 401', async () => {
        const handler = await routeHandler(CONFIRM_ROUTE, 'POST', 'POST /api/account/password-confirm (R57)');
        const res = await invoke(handler, jsonRequest('/api/account/password-confirm', 'POST', null, { password: STRONG_PASSWORD }));
        assert.equal(res.status, 401, show(res));
    });
});
