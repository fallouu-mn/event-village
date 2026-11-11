/**
 * Lot 9, tâche 9.0 — annulation d'une invitation (contrat 4.1, 5.1, L11 ; découverte 9-invitations, 3.3, 4.1).
 * POST /api/partner/events/[id]/invitations/[ticketId]/cancel : billet ANNULE, transfert PENDING CANCELLED, stock
 * rendu (égalité exacte vendus = billets actifs de la catégorie), audit ; lot 9 bis (R22, T56) : une ligne TICKET_CANCELLED au numéro, rien d'autre.
 *  - en attente, après réclamation, attribution directe ;
 *  - acceptation après annulation refusée ;
 *  - billet scanné : 409 TICKET_ALREADY_USED ; déjà annulé : 409 TICKET_NOT_CANCELLABLE ;
 *  - droits : tiers 404, admin sans events.write 403, avec et SUPERADMIN 200 ;
 *  - billet hors invitation ou d'un autre événement : 404 TICKET_NOT_FOUND ;
 *  - statut de l'événement non contrôlé (suspendu : annulation permise).
 *
 * Rouge avant correctif : ni la route d'annulation, ni la route d'envoi, ni la RPC ticket_invitation_cancel n'existent :
 * chaque cas échoue en nommant la route absente ; after() : assertLot9Invariants nomme le schéma manquant.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { assertLot9Invariants } from '../helpers/lot9-invariants';
import { BASE_URL, randomSenegalPhone, routeContext } from './helpers';
import { categoryState, eventTickets, newBuyer, service, type Buyer, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent, newController, scan, ticketPayload, ticketRow, type RouteResult } from './acces-helpers';
import { advanceEventTo } from './cycle-helpers';
import { markPhoneVerified, newAdmin, outboxRows } from './notif-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';

type Row = Record<string, unknown>;

const INVITE_ROUTE = '../../app/api/partner/events/[id]/invitations/route';
const CANCEL_ROUTE = '../../app/api/partner/events/[id]/invitations/[ticketId]/cancel/route';
const CLAIM_ROUTE = '../../app/api/tickets/transfers/[id]/claim/route';
const INCOMING_ROUTE = '../../app/api/tickets/transfers/incoming/route';
const STANDARD = 'Standard';
const CATEGORIES: CategorySpec[] = [{ name: STANDARD, price: 5_000, total: 30, maxPerOrder: 10 }];

let partner: TestPartner;

before(async () => {
    partner = await newPartner('invitations-annulation');
});

after(async () => {
    await assertLot9Invariants('invitations-annulation');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function newEvent(label: string, startsInHours = 48): Promise<SaleEvent> {
    return createTimedEvent(partner.partnerId, `annulation ${label}`, CATEGORIES, { startsInHours });
}

async function inviteOk(ev: SaleEvent, phone: string, quantity = 1): Promise<Row[]> {
    const handler = await routeHandler(INVITE_ROUTE, 'POST', 'POST /api/partner/events/[id]/invitations (contrat 4.1)');
    const path = `/api/partner/events/${ev.eventId}/invitations`;
    const res = await invoke(handler, authed(path, 'POST', partner, { category_id: ev.categories[STANDARD].id, phones: [phone], quantity }), routeContext({ id: ev.eventId }));
    assert.equal(res.status, 200, `envoi de l’invitation : ${show(res)}`);
    return (await eventTickets(ev.eventId)).filter((t) => t.sale_channel === 'INVITATION');
}

/** Invitation en attente vers un numéro sans compte : un billet, un transfert PENDING. */
async function pending(ev: SaleEvent): Promise<{ ticketId: string; transferId: string; phone: string }> {
    const phone = randomSenegalPhone('76');
    await inviteOk(ev, phone);
    const { data, error } = await service.from('ticket_transfers').select('id, ticket_id').eq('to_phone_or_email', phone).eq('status', 'PENDING');
    assert.equal(error, null, `transfert : ${error?.message}`);
    assert.equal((data ?? []).length, 1, `précondition : un transfert PENDING vers le numéro (${JSON.stringify(data)})`);
    return { ticketId: String(data![0].ticket_id), transferId: String(data![0].id), phone };
}

async function pendingTransferId(ticketId: string): Promise<string> {
    const { data, error } = await service.from('ticket_transfers').select('id').eq('ticket_id', ticketId).eq('status', 'PENDING');
    assert.equal(error, null, `transfert : ${error?.message}`);
    assert.equal((data ?? []).length, 1, `précondition : un transfert PENDING (${JSON.stringify(data)})`);
    return String(data![0].id);
}

async function cancelRoute(user: Buyer | null, eventId: string, ticketId: string): Promise<RouteResult> {
    const handler = await routeHandler(CANCEL_ROUTE, 'POST', 'POST /api/partner/events/[id]/invitations/[ticketId]/cancel (contrat 4.1)');
    const path = `/api/partner/events/${eventId}/invitations/${ticketId}/cancel`;
    const req = user ? authed(path, 'POST', user) : new NextRequest(`${BASE_URL}${path}`, { method: 'POST' });
    return invoke(handler, req, routeContext({ id: eventId, ticketId }));
}

function assertCancelled(res: RouteResult, what: string): void {
    assert.equal(res.status, 200, `${what} : ${show(res)}`);
    assert.equal(res.body.ok, true, `${what} : ${show(res)}`);
}

function assertRefused(res: RouteResult, status: number, code: string, what: string): void {
    assert.equal(res.status, status, `${what} : ${status} attendu, ${show(res)}`);
    assert.equal(res.body.code, code, `${what} : ${show(res)}`);
    assert.equal(typeof res.body.error, 'string', `${what} : ${show(res)}`);
}

/** Égalité exacte du contrat 6.4 : vendus = billets actifs (VALIDE, UTILISE) de la catégorie. */
async function assertStockExact(ev: SaleEvent, expected: number, what: string): Promise<void> {
    const state = await categoryState(ev.categories[STANDARD].id);
    assert.equal(state.sold, expected, `${what} : vendus`);
    const active = (await eventTickets(ev.eventId)).filter((t) => ['VALIDE', 'UTILISE'].includes(String(t.status)));
    assert.equal(active.length, expected, `${what} : billets actifs = vendus`);
}

async function outboxIds(eventId: string): Promise<string[]> {
    return (await outboxRows({ eventId })).map((r) => r.id).sort();
}

async function cancelAudits(actor: string): Promise<number> {
    const { data, error } = await service.from('audit_logs').select('id').eq('action', 'TICKET_INVITATION_CANCELLED').eq('user_id', actor);
    assert.equal(error, null, `audit : ${error?.message}`);
    return (data ?? []).length;
}

async function transferRow(id: string): Promise<Row> {
    const { data, error } = await service.from('ticket_transfers').select('*').eq('id', id).single();
    assert.equal(error, null, `transfert ${id} : ${error?.message}`);
    return data as Row;
}

async function claim(user: Buyer, transferId: string): Promise<RouteResult> {
    const handler = await routeHandler(CLAIM_ROUTE, 'POST', 'route de réclamation');
    return invoke(handler, authed(`/api/tickets/transfers/${transferId}/claim`, 'POST', user), routeContext({ id: transferId }));
}

async function verifiedAccount(label: string): Promise<Buyer> {
    const account = await newBuyer(`annul-${label}`, { firstName: 'Fatou', lastName: 'Invitee' });
    await markPhoneVerified(account.userId);
    return account;
}

// ── Effets ─────────────────────────────────────────────────────────────────

describe('9.0 Annulation : effets (5.1, L11)', () => {
    test('sans session : 401 AUTH_REQUIRED', async () => {
        const ev = await newEvent('anonyme');
        const { ticketId } = await pending(ev);
        assertRefused(await cancelRoute(null, ev.eventId, ticketId), 401, 'AUTH_REQUIRED', 'sans session');
        assert.equal((await ticketRow(ticketId)).status, 'VALIDE', 'billet intact');
    });

    test('invitation en attente : billet ANNULE et déverrouillé, transfert CANCELLED, stock rendu, audit ; seul avis : TICKET_CANCELLED au numéro (R22)', async () => {
        const ev = await newEvent('attente');
        const { ticketId, transferId, phone } = await pending(ev);
        const outboxBefore = await outboxIds(ev.eventId);
        const auditsBefore = await cancelAudits(partner.userId);
        await assertStockExact(ev, 1, 'avant annulation');

        assertCancelled(await cancelRoute(partner, ev.eventId, ticketId), 'annulation');

        const ticket = await ticketRow(ticketId);
        assert.equal(ticket.status, 'ANNULE', 'billet ANNULE');
        assert.equal(ticket.transfer_locked, false, 'billet déverrouillé');
        assert.equal(ticket.user_id, null, 'toujours sans porteur');
        const tr = await transferRow(transferId);
        assert.equal(tr.status, 'CANCELLED', JSON.stringify(tr));
        assert.ok(tr.cancelled_at, 'cancelled_at renseigné');
        await assertStockExact(ev, 0, 'après annulation');
        assert.equal(await cancelAudits(partner.userId), auditsBefore + 1, 'une ligne TICKET_INVITATION_CANCELLED');
        // Lot 9 bis (R22, T56, règle changée : la consigne renverse L11) : une seule ligne nouvelle, TICKET_CANCELLED par SMS au numéro.
        const added = (await outboxRows({ eventId: ev.eventId })).filter((r) => !outboxBefore.includes(r.id));
        assert.deepEqual(added.map((r) => [r.type, r.channel, r.recipient_phone, r.recipient_user_id]), [['TICKET_CANCELLED', 'SMS', phone, null]],
            `une seule notification mise en file : TICKET_CANCELLED par SMS au numéro (R22) : ${JSON.stringify(added.map((r) => [r.type, r.channel, r.recipient_phone]))}`);
        assert.deepEqual(await outboxRows({ type: 'TRANSFER_CANCELLED', eventId: ev.eventId }), [], 'aucun avis d’annulation de transfert');
        assert.deepEqual((await outboxRows({ type: 'INVITATION_RECEIVED', phone })).length, 1, 'le SMS d’invitation initial reste unique');
    });

    test('acceptation après annulation : 409 TRANSFER_NOT_PENDING, absente de « Reçus », billet resté annulé', async () => {
        const ev = await newEvent('acceptation');
        const invitee = await newBuyer('annul-acc', { firstName: 'Awa', lastName: 'Invitee' });
        const tickets = await inviteOk(ev, invitee.phoneE164);
        const ticketId = String(tickets[0].id);
        const transferId = await pendingTransferId(ticketId);
        assertCancelled(await cancelRoute(partner, ev.eventId, ticketId), 'annulation');
        await markPhoneVerified(invitee.userId);

        const late = await claim(invitee, transferId);
        assert.equal(late.status, 409, show(late));
        assert.equal(late.body.code, 'TRANSFER_NOT_PENDING', show(late));
        assert.equal((await ticketRow(ticketId)).status, 'ANNULE', 'billet annulé');
        const handler = await routeHandler(INCOMING_ROUTE, 'GET', 'route des transferts reçus');
        const list = await invoke(handler, authed('/api/tickets/transfers/incoming', 'GET', invitee));
        assert.equal(list.status, 200, show(list));
        assert.deepEqual(list.body.items, [], show(list));
        await assertStockExact(ev, 0, 'après la tentative');
    });

    test('après réclamation : billet au compte annulé, transfert CLAIMED conservé, stock rendu, seul avis : TICKET_CANCELLED au compte (R22)', async () => {
        const ev = await newEvent('reclamee');
        const invitee = await newBuyer('annul-recl', { firstName: 'Khady', lastName: 'Invitee' });
        const tickets = await inviteOk(ev, invitee.phoneE164);
        const ticketId = String(tickets[0].id);
        const transferId = await pendingTransferId(ticketId);
        await markPhoneVerified(invitee.userId);
        const claimed = await claim(invitee, transferId);
        assert.equal(claimed.status, 200, `précondition : réclamation : ${show(claimed)}`);
        const outboxBefore = await outboxIds(ev.eventId);

        assertCancelled(await cancelRoute(partner, ev.eventId, ticketId), 'annulation après réclamation');

        const ticket = await ticketRow(ticketId);
        assert.equal(ticket.status, 'ANNULE', 'billet ANNULE');
        assert.equal(ticket.user_id, invitee.userId, 'porteur conservé');
        assert.equal((await transferRow(transferId)).status, 'CLAIMED', 'transfert réclamé inchangé');
        await assertStockExact(ev, 0, 'après annulation');
        const added = (await outboxRows({ eventId: ev.eventId })).filter((r) => !outboxBefore.includes(r.id)).map((r) => [r.type, r.channel, r.recipient_user_id, r.recipient_phone]).sort((a, b) => String(a[1]).localeCompare(String(b[1]))); assert.deepEqual(added, ['EMAIL', 'IN_APP', 'SMS'].map((c) => ['TICKET_CANCELLED', c, invitee.userId, null]), `lot 9 bis (R22, B73, la consigne renverse L11 ; G.49) : seul avis, TICKET_CANCELLED au porteur, une ligne par canal du registre : ${JSON.stringify(added)}`);
    });

    test('attribution directe à un compte vérifié : annulable, stock rendu', async () => {
        const ev = await newEvent('directe');
        const account = await verifiedAccount('direct');
        const tickets = await inviteOk(ev, account.phoneE164, 2);
        assert.equal(tickets[0].user_id, account.userId, 'précondition : billet au compte');
        assertCancelled(await cancelRoute(partner, ev.eventId, String(tickets[0].id)), 'annulation');
        await assertStockExact(ev, 1, 'une invitation sur deux annulée');
        assert.equal((await ticketRow(String(tickets[1].id))).status, 'VALIDE', 'l’autre billet reste valide');
    });

    test('événement suspendu : annulation permise, le statut n’est pas contrôlé', async () => {
        const ev = await newEvent('suspendu');
        const { ticketId } = await pending(ev);
        await advanceEventTo(ev.eventId, 'SUSPENDU');
        assertCancelled(await cancelRoute(partner, ev.eventId, ticketId), 'annulation sur un événement suspendu');
        await assertStockExact(ev, 0, 'événement suspendu');
    });
});

// ── Refus ──────────────────────────────────────────────────────────────────

describe('9.0 Annulation : refus', () => {
    test('billet scanné : 409 TICKET_ALREADY_USED, billet et stock inchangés', async () => {
        const ev = await newEvent('scanne', 1);
        const account = await verifiedAccount('scan');
        const tickets = await inviteOk(ev, account.phoneE164);
        const ticketId = String(tickets[0].id);
        const controller = await newController(partner, ev.eventId, { label: 'annulation' });
        const scanned = await scan(controller, { eventId: ev.eventId, payload: await ticketPayload(ticketId) });
        assert.equal(scanned.status, 200, `précondition : scan : ${show(scanned)}`);
        assert.equal(scanned.body.result, 'valid', `précondition : scan accepté : ${show(scanned)}`);

        assertRefused(await cancelRoute(partner, ev.eventId, ticketId), 409, 'TICKET_ALREADY_USED', 'billet scanné');
        assert.equal((await ticketRow(ticketId)).status, 'UTILISE', 'billet utilisé');
        await assertStockExact(ev, 1, 'billet scanné');
    });

    test('billet déjà annulé : 409 TICKET_NOT_CANCELLABLE, stock rendu une seule fois', async () => {
        const ev = await newEvent('deux-fois');
        const { ticketId } = await pending(ev);
        assertCancelled(await cancelRoute(partner, ev.eventId, ticketId), 'première annulation');
        assertRefused(await cancelRoute(partner, ev.eventId, ticketId), 409, 'TICKET_NOT_CANCELLABLE', 'seconde annulation');
        await assertStockExact(ev, 0, 'après la seconde annulation');
    });

    test('droits : autre partenaire et client 404, admin sans events.write 403, billet intact ; admin avec events.write et SUPERADMIN 200', async () => {
        const ev = await newEvent('droits');
        const { ticketId } = await pending(ev);
        const other = await newPartner('invitations-annulation-tiers');
        const client = await newBuyer('annul-client');
        assertRefused(await cancelRoute(other, ev.eventId, ticketId), 404, 'EVENT_NOT_FOUND', 'autre partenaire');
        assertRefused(await cancelRoute(client, ev.eventId, ticketId), 404, 'EVENT_NOT_FOUND', 'client');
        const reader = await newAdmin('annul-lecture', ['events.read']);
        assertRefused(await cancelRoute(reader, ev.eventId, ticketId), 403, 'FORBIDDEN', 'ADMIN sans events.write');
        assert.equal((await ticketRow(ticketId)).status, 'VALIDE', 'billet intact après les refus');
        await assertStockExact(ev, 1, 'après les refus');

        const writer = await newAdmin('annul-ecriture', ['events.write']);
        assertCancelled(await cancelRoute(writer, ev.eventId, ticketId), 'ADMIN avec events.write');
        const second = await pending(ev);
        const root = await newAdmin('annul-super', [], { role: 'SUPERADMIN' });
        assertCancelled(await cancelRoute(root, ev.eventId, second.ticketId), 'SUPERADMIN');
        await assertStockExact(ev, 0, 'après les deux annulations');
    });

    test('billet hors invitation ou d’un autre événement : 404 TICKET_NOT_FOUND', async () => {
        const ev = await newEvent('non-invitation');
        const buyer = await newBuyer('annul-achat', { firstName: 'Ramatoulaye', lastName: 'Acheteuse' });
        const [paid] = (await buyConfirmed(buyer, ev, [[STANDARD, 1]])).tickets;
        assertRefused(await cancelRoute(partner, ev.eventId, String(paid.id)), 404, 'TICKET_NOT_FOUND', 'billet acheté en ligne');
        assert.equal((await ticketRow(String(paid.id))).status, 'VALIDE', 'billet acheté intact');

        const other = await newEvent('autre-evenement');
        const { ticketId } = await pending(other);
        assertRefused(await cancelRoute(partner, ev.eventId, ticketId), 404, 'TICKET_NOT_FOUND', 'billet d’un autre événement');
        await assertStockExact(other, 1, 'autre événement intact');
    });
});
