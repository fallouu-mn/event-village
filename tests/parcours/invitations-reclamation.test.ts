/**
 * Lot 9, tâche 9.0 — réclamation d'une invitation en attente par le mécanisme de transfert existant (contrat 3.2,
 * 5.1, L3, L6, L8, L16, AR15 ; découverte 9-invitations, 1.2, 3.7).
 *  1. numéro sans compte, inscription par la vraie route : billet retrouvé dans « Reçus », accepté, identité du
 *     billet renouvelée, aucune notification vers un expéditeur inexistant ;
 *  2. autre compte : 404 identique à un transfert inconnu, billet intact ;
 *  3. compte au numéro non vérifié : aucun détail, 403, puis accepté une fois le numéro vérifié (AR15) ;
 *  4. la route d'annulation d'un transfert reste fermée au partenaire et au destinataire (L3) ;
 *  5. expiration : aucun avis, billet déverrouillé, réclamation refusée ;
 *  6. report de date : échéance recalée pour les seules invitations en attente (L8).
 *
 * Rouge avant correctif : ni la RPC ticket_invitation_create ni la route d'envoi n'existent, chaque cas échoue à
 * son envoi en nommant la route absente ; ticket_transfer_accept lève NT004 sans expéditeur (M/20261105000007:364) ;
 * after() : assertLot9Invariants nomme le schéma manquant jusqu'à M2 et M4.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { inspect } from '../helpers/db';
import { assertLot9Invariants } from '../helpers/lot9-invariants';
import { randomSenegalPhone, routeContext, STRONG_PASSWORD } from './helpers';
import { categoryState, eventTickets, newBuyer, service, type Buyer, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent, ticketRow, type RouteResult } from './acces-helpers';
import { shiftEventDates } from './cycle-helpers';
import { markPhoneVerified, outboxRows } from './notif-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { registerClientFlow } from './terrain-helpers';

type Row = Record<string, unknown>;

const INVITE_ROUTE = '../../app/api/partner/events/[id]/invitations/route';
const TRANSFER_ROUTE = '../../app/api/tickets/[id]/transfer/route';
const INCOMING_ROUTE = '../../app/api/tickets/transfers/incoming/route';
const CLAIM_ROUTE = '../../app/api/tickets/transfers/[id]/claim/route';
const CANCEL_ROUTE = '../../app/api/tickets/transfers/[id]/cancel/route';
const STANDARD = 'Standard';
const CATEGORIES: CategorySpec[] = [{ name: STANDARD, price: 5_000, total: 30, maxPerOrder: 10 }];

let partner: TestPartner;
let ipSeq = 0;

before(async () => {
    partner = await newPartner('invitations-reclamation');
});

after(async () => {
    await assertLot9Invariants('invitations-reclamation');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function newEvent(label: string): Promise<SaleEvent> {
    return createTimedEvent(partner.partnerId, `réclamation ${label}`, CATEGORIES, { startsInHours: 48 });
}

/** Invitation envoyée par la route (200 exigé) ; renvoie les billets et leurs transferts PENDING vers `phone`. */
async function invite(ev: SaleEvent, phone: string, quantity = 1): Promise<{ tickets: Row[]; transfers: Row[] }> {
    const handler = await routeHandler(INVITE_ROUTE, 'POST', 'POST /api/partner/events/[id]/invitations (contrat 4.1)');
    const path = `/api/partner/events/${ev.eventId}/invitations`;
    const res = await invoke(handler, authed(path, 'POST', partner, { category_id: ev.categories[STANDARD].id, phones: [phone], quantity }), routeContext({ id: ev.eventId }));
    assert.equal(res.status, 200, `envoi de l’invitation : ${show(res)}`);
    const { data, error } = await service.from('ticket_transfers').select('*').eq('to_phone_or_email', phone).eq('status', 'PENDING');
    assert.equal(error, null, `transferts : ${error?.message}`);
    const transfers = (data ?? []) as Row[];
    assert.equal(transfers.length, quantity, `précondition : ${quantity} transfert(s) PENDING vers le numéro`);
    const tickets = await Promise.all(transfers.map((t) => ticketRow(String(t.ticket_id))));
    for (const t of tickets) assert.equal(t.user_id, null, 'précondition : billet sans porteur');
    return { tickets, transfers };
}

async function incoming(user: Buyer): Promise<RouteResult> {
    const handler = await routeHandler(INCOMING_ROUTE, 'GET', 'route des transferts reçus');
    return invoke(handler, authed('/api/tickets/transfers/incoming', 'GET', user));
}

async function claim(user: Buyer, transferId: string): Promise<RouteResult> {
    const handler = await routeHandler(CLAIM_ROUTE, 'POST', 'route de réclamation');
    return invoke(handler, authed(`/api/tickets/transfers/${transferId}/claim`, 'POST', user), routeContext({ id: transferId }));
}

async function transferRow(id: string): Promise<Row> {
    const { data, error } = await service.from('ticket_transfers').select('*').eq('id', id).single();
    assert.equal(error, null, `transfert ${id} : ${error?.message}`);
    return data as Row;
}

function normalizeQuotes(text: unknown): string {
    return String(text).replace(/’/g, '\'');
}

/** Numéro sans compte, compte créé par l'inscription réelle, connexion par mot de passe. */
async function registerOn(phone: string): Promise<Buyer> {
    ipSeq += 1;
    const firstName = 'Mariama';
    const lastName = 'Reclamante';
    const flow = await registerClientFlow({ phone, firstName, lastName, headers: { 'x-forwarded-for': `203.0.113.${(ipSeq % 250) + 1}` } });
    const email = String(flow.register!.body.email);
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await anon.auth.signInWithPassword({ email, password: STRONG_PASSWORD });
    assert.equal(error, null, `connexion du compte inscrit : ${error?.message}`);
    return { userId: flow.userId!, accessToken: data.session!.access_token, email, phoneE164: phone, phone9: phone.slice(4), firstName, lastName };
}

async function verifiedAccount(label: string): Promise<Buyer> {
    const account = await newBuyer(`recl-${label}`, { firstName: 'Fatou', lastName: 'Tiers' });
    await markPhoneVerified(account.userId);
    return account;
}

/** Compte déjà présent au numéro, non vérifié : l'invitation part en attente (AR15). */
function unverifiedAccount(label: string): Promise<Buyer> {
    return newBuyer(`recl-nv-${label}`, { firstName: 'Awa', lastName: 'Nonverifiee' });
}

// ── Scénarios ──────────────────────────────────────────────────────────────

describe('9.0 Réclamation : numéro sans compte puis inscription', () => {
    test('le billet est retrouvé dans « Reçus », accepté, numéro, QR et secret changés ; aucun avis à un expéditeur', async () => {
        const ev = await newEvent('inscription');
        const phone = randomSenegalPhone('76');
        const { tickets, transfers } = await invite(ev, phone);
        const [before0] = tickets;
        const [transfer] = transfers;

        const { data: none, error: noneErr } = await service.from('users').select('id').eq('phone', phone);
        assert.equal(noneErr, null, `comptes : ${noneErr?.message}`);
        assert.deepEqual(none ?? [], [], 'aucun compte avant l’inscription');

        const account = await registerOn(phone);
        const list = await incoming(account);
        assert.equal(list.status, 200, show(list));
        assert.equal(list.body.phoneVerificationRequired, false, show(list));
        const items = list.body.items as Row[];
        assert.deepEqual(items.map((i) => i.transfer_id), [transfer.id], show(list));
        assert.equal(normalizeQuotes(items[0].sender_display), 'L\'organisateur de l\'événement', show(list));
        assert.equal(Number((items[0].ticket as Row).price), 0, show(list));
        assert.equal((items[0].ticket as Row).category_name, STANDARD, show(list));
        assert.equal((items[0].event as Row).id, ev.eventId, show(list));
        const raw = JSON.stringify(list.body);
        assert.ok(!raw.includes(String(before0.ticket_number)), `numéro de billet exposé avant réclamation (L16) : ${raw}`);
        assert.ok(!raw.includes(String(before0.qr_code)), `QR exposé avant réclamation (L16) : ${raw}`);

        const res = await claim(account, String(transfer.id));
        assert.equal(res.status, 200, show(res));
        const after0 = await ticketRow(String(before0.id));
        assert.equal(after0.user_id, account.userId, 'billet au compte inscrit');
        assert.equal(after0.transfer_locked, false, 'billet déverrouillé');
        assert.notEqual(after0.ticket_number, before0.ticket_number, 'numéro renouvelé');
        assert.notEqual(after0.qr_code, before0.qr_code, 'QR renouvelé');
        assert.notEqual(after0.totp_secret, before0.totp_secret, 'secret renouvelé');
        assert.equal(Number(after0.security_version), Number(before0.security_version) + 1, 'security_version + 1');
        const tr = await transferRow(String(transfer.id));
        assert.equal(tr.status, 'CLAIMED', JSON.stringify(tr));
        assert.equal(tr.to_user_id, account.userId, JSON.stringify(tr));

        assert.deepEqual(await outboxRows({ type: 'TRANSFER_CLAIMED_SENDER', keyPrefix: `TRANSFER_CLAIMED_SENDER:${transfer.id}` }), [], 'aucun avis à un expéditeur inexistant');
        const received = await outboxRows({ type: 'TRANSFER_RECEIVED', keyPrefix: `TRANSFER_RECEIVED:${transfer.id}` });
        assert.ok(received.some((r) => r.channel === 'IN_APP' && r.recipient_user_id === account.userId), `TRANSFER_RECEIVED au compte : ${JSON.stringify(received.map((r) => r.channel))}`);
        assert.equal((await categoryState(ev.categories[STANDARD].id)).sold, 1, 'stock inchangé par la réclamation');
        const again = await claim(account, String(transfer.id));
        assert.equal(again.status, 409, show(again));
        assert.equal(again.body.code, 'TRANSFER_NOT_PENDING', show(again));
    });

    test('plusieurs billets : un transfert et une acceptation par billet', async () => {
        const ev = await newEvent('plusieurs');
        const phone = randomSenegalPhone('76');
        const { transfers } = await invite(ev, phone, 2);
        const account = await registerOn(phone);
        for (const t of transfers) {
            const res = await claim(account, String(t.id));
            assert.equal(res.status, 200, show(res));
        }
        const owners = (await eventTickets(ev.eventId)).map((t) => t.user_id);
        assert.deepEqual(owners, [account.userId, account.userId], 'deux billets au compte');
    });
});

describe('9.0 Réclamation : refus', () => {
    test('autre compte : 404 identique à un transfert inconnu, billet intact', async () => {
        const ev = await newEvent('autre');
        const { tickets, transfers } = await invite(ev, randomSenegalPhone('76'));
        const stranger = await verifiedAccount('etranger');
        const other = await claim(stranger, String(transfers[0].id));
        const unknown = await claim(stranger, randomUUID());
        assert.equal(other.status, 404, show(other));
        assert.equal(other.body.code, 'TRANSFER_NOT_FOUND', show(other));
        assert.deepEqual(other.body, unknown.body, 'aucune fuite d’existence');
        assert.equal((await ticketRow(String(tickets[0].id))).user_id, null, 'billet toujours sans porteur');
        assert.equal((await transferRow(String(transfers[0].id))).status, 'PENDING', 'transfert toujours PENDING');
    });

    test('compte au numéro non vérifié : aucun détail, 403 PHONE_NOT_VERIFIED, puis accepté une fois vérifié (AR15)', async () => {
        const ev = await newEvent('non-verifie');
        const account = await unverifiedAccount('attente');
        const { tickets, transfers } = await invite(ev, account.phoneE164);
        const listed = await incoming(account);
        assert.equal(listed.status, 200, show(listed));
        assert.deepEqual(listed.body.items, [], show(listed));
        assert.equal(listed.body.phoneVerificationRequired, true, show(listed));
        assert.ok(!JSON.stringify(listed.body).includes(ev.eventId), show(listed));

        const refused = await claim(account, String(transfers[0].id));
        assert.equal(refused.status, 403, show(refused));
        assert.equal(refused.body.code, 'PHONE_NOT_VERIFIED', show(refused));
        assert.equal((await ticketRow(String(tickets[0].id))).user_id, null, 'billet toujours en attente');

        await markPhoneVerified(account.userId);
        const res = await claim(account, String(transfers[0].id));
        assert.equal(res.status, 200, show(res));
        assert.equal((await ticketRow(String(tickets[0].id))).user_id, account.userId, 'billet au compte une fois le numéro vérifié');
    });

    test('route d’annulation d’un transfert : 403 NOT_SENDER pour le partenaire et le destinataire, transfert PENDING et billet verrouillé (L3)', async () => {
        const ev = await newEvent('annulation-transfert');
        const account = await unverifiedAccount('annul');
        const { tickets, transfers } = await invite(ev, account.phoneE164);
        await markPhoneVerified(account.userId);
        const handler = await routeHandler(CANCEL_ROUTE, 'POST', 'route d’annulation d’un transfert');
        const transferId = String(transfers[0].id);
        for (const [who, label] of [[partner, 'partenaire'], [account, 'destinataire']] as Array<[Buyer, string]>) {
            const res = await invoke(handler, authed(`/api/tickets/transfers/${transferId}/cancel`, 'POST', who), routeContext({ id: transferId }));
            assert.equal(res.status, 403, `${label} : ${show(res)}`);
            assert.equal(res.body.code, 'NOT_SENDER', `${label} : ${show(res)}`);
        }
        assert.equal((await transferRow(transferId)).status, 'PENDING', 'transfert intact');
        assert.equal((await ticketRow(String(tickets[0].id))).transfer_locked, true, 'billet toujours verrouillé');
        assert.deepEqual(await outboxRows({ type: 'TRANSFER_CANCELLED', eventId: ev.eventId }), [], 'aucun avis d’annulation');
    });
});

describe('9.0 Réclamation : échéance', () => {
    test('expiration : 410 avant le passage du cron, puis EXPIRED sans aucun avis, billet déverrouillé et sans porteur, réclamation 409', async () => {
        const ev = await newEvent('expiration');
        const account = await unverifiedAccount('expire');
        const { tickets, transfers } = await invite(ev, account.phoneE164);
        await markPhoneVerified(account.userId);
        const transferId = String(transfers[0].id);
        const { error: updErr } = await service.from('ticket_transfers')
            .update({ created_at: new Date(Date.now() - 49 * 3600_000).toISOString(), expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', transferId);
        assert.equal(updErr, null, `échéance passée : ${updErr?.message}`);
        const late = await claim(account, transferId);
        assert.equal(late.status, 410, show(late));
        assert.equal(late.body.code, 'TRANSFER_EXPIRED', show(late));

        const { data, error } = await service.rpc('ticket_transfers_expire', { p: {} });
        assert.equal(error, null, `ticket_transfers_expire : ${error?.message}`);
        assert.equal((data as Row).ok, true, JSON.stringify(data));
        assert.equal((await transferRow(transferId)).status, 'EXPIRED', 'transfert expiré');
        const ticket = await ticketRow(String(tickets[0].id));
        assert.equal(ticket.transfer_locked, false, 'billet déverrouillé');
        assert.equal(ticket.user_id, null, 'billet toujours sans porteur');
        assert.deepEqual(await outboxRows({ type: 'TRANSFER_EXPIRED', keyPrefix: `TRANSFER_EXPIRED:${transferId}` }), [], 'aucun avis d’expiration (L3)');
        const after0 = await claim(account, transferId);
        assert.equal(after0.status, 409, show(after0));
        assert.equal(after0.body.code, 'TRANSFER_NOT_PENDING', show(after0));
    });

    test('report de date : échéance recalée sur la nouvelle fin pour l’invitation, inchangée pour un transfert ordinaire du même événement (L8)', async () => {
        const ev = await newEvent('report');
        const holder = await newBuyer('recl-porteur', { firstName: 'Khady', lastName: 'Porteuse' });
        const [paid] = (await buyConfirmed(holder, ev, [[STANDARD, 1]])).tickets;
        const paidId = String(paid.id);
        const transferHandler = await routeHandler(TRANSFER_ROUTE, 'POST', 'route de transfert');
        const initiated = await invoke(transferHandler, authed(`/api/tickets/${paidId}/transfer`, 'POST', holder, { recipient: randomSenegalPhone('77') }), routeContext({ id: paidId }));
        assert.equal(initiated.status, 200, show(initiated));
        const { data: ordinary, error: ordErr } = await service.from('ticket_transfers').select('id, expires_at').eq('ticket_id', paidId).eq('status', 'PENDING').single();
        assert.equal(ordErr, null, `transfert ordinaire : ${ordErr?.message}`);

        const { transfers } = await invite(ev, randomSenegalPhone('76'));
        const invitationId = String(transfers[0].id);

        await shiftEventDates(ev.eventId, { startsInHours: 240, durationHours: 6 });
        const end = await inspect(async (db) => (await db.query<{ at: Date }>('SELECT public.event_end_at($1::uuid) AS at', [ev.eventId])).rows[0].at);
        const after0 = await transferRow(invitationId);
        assert.equal(after0.status, 'PENDING', 'invitation toujours en attente');
        assert.equal(new Date(String(after0.expires_at)).getTime(), end.getTime(), 'échéance recalée sur la nouvelle fin de l’événement');
        assert.equal(new Date(String((await transferRow(String(ordinary.id))).expires_at)).getTime(), new Date(String(ordinary.expires_at)).getTime(), 'transfert ordinaire inchangé');
    });
});
