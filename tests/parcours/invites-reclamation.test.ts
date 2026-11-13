/**
 * Lot 9 ter, tâche 9t.17 (consigne 3) — l'invité validé par la liste retrouve ensuite son billet dans l'application
 * (contrat 5.C, C.3.3 F25 et F26, C.3.4, C.3.6 ; rectification C 1 : la réclamation avance security_version).
 *  1. après la liste, l'invité qui vérifie son numéro voit son billet déjà utilisé (used, checked_in_at) ;
 *  2. « Ajouter à mes billets » : 200, billet au compte, UTILISE, numéro et QR inchangés, version du secret + 1, aucun
 *     avis ; carte sans code dans GET /api/tickets ;
 *  3. seconde acceptation : TRANSFER_NOT_PENDING ; refus : 409 ; autre compte : 404 identique à un transfert inconnu ;
 *  4. événement terminé : EVENT_NOT_ACTIVE, rien rattaché ;
 *  5. numéro non vérifié : aucun détail, phoneVerificationRequired.
 *
 * Montage : compte au numéro non vérifié (l'invitation reste en attente, AR15), validation par la liste (guestAdmit),
 * puis numéro vérifié (markPhoneVerified) ; routes réelles des transferts reçus, de la réclamation et du refus.
 * Rouge avant correctif (fix(9t.17), migrations 20261110000003 et …08) : validation par la liste refusée (400, aucun
 * schéma GUEST_LIST), statut ADMITTED absent, transfers incoming sans used ni checked_in_at, claim d'un billet
 * UTILISE refusé (ticket_transfer_claim exige VALIDE, M/20261105000003:387). after() : assertLot9terInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { routeContext } from './helpers';
import { newBuyer, service, type Buyer, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent, newController, scansOf, ticketRow, type RouteResult } from './acces-helpers';
import { advanceEventTo, shiftEventDates } from './cycle-helpers';
import { markPhoneVerified, outboxRows } from './notif-helpers';
import { invoke, routeHandler } from './pilotage-helpers';
import { guestAdmit, sendInvitations } from './zones-helpers';

type Row = Record<string, unknown>;

const VIP = 'VIP';
const CATEGORIES: CategorySpec[] = [{ name: VIP, price: 20_000, total: 30, maxPerOrder: 10 }];
const INCOMING_ROUTE = '../../app/api/tickets/transfers/incoming/route';
const CLAIM_ROUTE = '../../app/api/tickets/transfers/[id]/claim/route';
const DECLINE_ROUTE = '../../app/api/tickets/transfers/[id]/decline/route';
const TICKETS_ROUTE = '../../app/api/tickets/route';

let partner: TestPartner;

before(async () => {
    partner = await newPartner('invites-reclamation');
});

after(async () => {
    await assertLot9terInvariants('invites-reclamation');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 900)}`;
}

function newEvent(label: string): Promise<SaleEvent> {
    return createTimedEvent(partner.partnerId, `invites-reclamation ${label}`, CATEGORIES);
}

interface Admitted { account: Buyer; ticketId: string; transferId: string; before: Row }

/** Invitation vers un compte au numéro non vérifié (en attente), validée par la liste ; le numéro reste non vérifié. */
async function admittedInvitation(ev: SaleEvent, label: string): Promise<Admitted> {
    const account = await newBuyer(`inv-recl-${label}`, { firstName: 'Awa', lastName: 'Diop', phoneVerified: false });
    const sent = await sendInvitations(partner, ev.eventId, { category_id: ev.categories[VIP].id, phones: [account.phoneE164], quantity: 1, guest_names: ['Awa Diop'] });
    assert.equal(sent.status, 200, `invitation : ${show(sent)}`);
    const { data, error } = await service.from('ticket_transfers').select('id, ticket_id').eq('to_phone_or_email', account.phoneE164).eq('status', 'PENDING');
    assert.equal(error, null, `transfert : ${error?.message}`);
    assert.equal((data ?? []).length, 1, 'précondition : invitation en attente (numéro non vérifié, AR15)');
    const ticketId = String(data![0].ticket_id);
    const transferId = String(data![0].id);
    const ctrl = await newController(partner, ev.eventId, { label: `recl-${label}` });
    const r = await guestAdmit(ctrl, ev.eventId, ticketId);
    assert.equal(r.body.result, 'valid', `validation par la liste : ${show(r)}`);
    return { account, ticketId, transferId, before: await ticketRow(ticketId) };
}

async function incoming(user: Buyer): Promise<RouteResult> {
    const handler = await routeHandler(INCOMING_ROUTE, 'GET', 'GET /api/tickets/transfers/incoming');
    return invoke(handler, authed('/api/tickets/transfers/incoming', 'GET', user));
}

async function claim(user: Buyer, transferId: string): Promise<RouteResult> {
    const handler = await routeHandler(CLAIM_ROUTE, 'POST', 'POST /api/tickets/transfers/[id]/claim');
    return invoke(handler, authed(`/api/tickets/transfers/${transferId}/claim`, 'POST', user), routeContext({ id: transferId }));
}

async function transferRow(id: string): Promise<Row> {
    const { data, error } = await service.from('ticket_transfers').select('*').eq('id', id).single();
    assert.equal(error, null, `transfert ${id} : ${error?.message}`);
    return data as Row;
}

// ── Scénarios ──────────────────────────────────────────────────────────────

describe('9t.17 Réclamation d’une invitation déjà validée par la liste', () => {
    test('1. après la liste, l’invité qui s’inscrit voit son billet déjà utilisé', async () => {
        const ev = await newEvent('recus');
        const adm = await admittedInvitation(ev, 'recus');
        await markPhoneVerified(adm.account.userId);
        const list = await incoming(adm.account);
        assert.equal(list.status, 200, show(list));
        const items = (list.body.items ?? []) as Row[];
        assert.deepEqual(items.map((i) => i.transfer_id), [adm.transferId], show(list));
        assert.equal(items[0].used, true, `élément marqué utilisé : ${show(list)}`);
        const accepted = (await scansOf(adm.ticketId)).filter((s) => s.accepted === true);
        assert.equal(accepted.length, 1, 'une entrée');
        assert.equal(Date.parse(String(items[0].checked_in_at)), Date.parse(String(accepted[0].created_at)), `heure de l’entrée : ${show(list)}`);
        const raw = JSON.stringify(list.body);
        assert.ok(!raw.includes(String(adm.before.qr_code)), 'QR jamais exposé avant réclamation');
    });

    test('2. Ajouter à mes billets : 200, billet au compte, UTILISE, numéro et QR inchangés, version du secret + 1, aucun avis', async () => {
        const ev = await newEvent('ajout');
        const adm = await admittedInvitation(ev, 'ajout');
        await markPhoneVerified(adm.account.userId);
        const res = await claim(adm.account, adm.transferId);
        assert.equal(res.status, 200, show(res));
        const claimBody = (res.body.claim ?? res.body) as Row;
        assert.equal(claimBody.already_used, true, `already_used servi : ${show(res)}`);
        const t = await ticketRow(adm.ticketId);
        assert.deepEqual({ user_id: t.user_id, status: t.status, ticket_number: t.ticket_number, qr_code: t.qr_code },
            { user_id: adm.account.userId, status: 'UTILISE', ticket_number: adm.before.ticket_number, qr_code: adm.before.qr_code }, JSON.stringify(t));
        assert.equal(Number(t.security_version), Number(adm.before.security_version) + 1, 'security_version + 1 (trg_tickets_secret_guard, rectification C 1)');
        const tr = await transferRow(adm.transferId);
        assert.deepEqual({ status: tr.status, to_user_id: tr.to_user_id }, { status: 'ADMITTED', to_user_id: adm.account.userId }, JSON.stringify(tr));
        assert.deepEqual(await outboxRows({ type: ['TRANSFER_RECEIVED', 'TICKET_SCANNED'], userId: adm.account.userId }), [], 'aucun avis');
        const handler = await routeHandler(TICKETS_ROUTE, 'GET', 'GET /api/tickets');
        const mine = await invoke(handler, authed('/api/tickets', 'GET', adm.account));
        assert.equal(mine.status, 200, show(mine));
        const card = ((mine.body.tickets ?? []) as Row[]).find((c) => c.id === adm.ticketId);
        assert.ok(card, `billet présent dans « Mes billets » : ${show(mine)}`);
        assert.deepEqual({ status: card.status, codeVisible: card.codeVisible }, { status: 'UTILISE', codeVisible: false }, 'carte sans code');
    });

    test('3. seconde acceptation : TRANSFER_NOT_PENDING ; refus : 409 ; autre compte : 404 identique à un transfert inconnu', async () => {
        const ev = await newEvent('refus');
        const adm = await admittedInvitation(ev, 'refus');
        await markPhoneVerified(adm.account.userId);
        const decline = await routeHandler(DECLINE_ROUTE, 'POST', 'POST /api/tickets/transfers/[id]/decline');
        const declined = await invoke(decline, authed(`/api/tickets/transfers/${adm.transferId}/decline`, 'POST', adm.account), routeContext({ id: adm.transferId }));
        assert.equal(declined.status, 409, `un billet déjà utilisé ne se refuse pas : ${show(declined)}`);
        assert.equal((await transferRow(adm.transferId)).status, 'ADMITTED', 'transfert inchangé par le refus');

        const stranger = await newBuyer('inv-recl-tiers', { phoneVerified: false });
        await markPhoneVerified(stranger.userId);
        const other = await claim(stranger, adm.transferId);
        const unknown = await claim(stranger, randomUUID());
        assert.equal(other.status, 404, show(other));
        assert.deepEqual(other.body, unknown.body, 'aucune fuite d’existence');

        const first = await claim(adm.account, adm.transferId);
        assert.equal(first.status, 200, show(first));
        const again = await claim(adm.account, adm.transferId);
        assert.equal(again.status, 409, show(again));
        assert.equal(again.body.code, 'TRANSFER_NOT_PENDING', show(again));
    });

    test('4. événement terminé : EVENT_NOT_ACTIVE, rien rattaché', async () => {
        const ev = await newEvent('termine');
        const adm = await admittedInvitation(ev, 'termine');
        await markPhoneVerified(adm.account.userId);
        await shiftEventDates(ev.eventId, { startsInHours: -4, durationHours: 1 });
        await advanceEventTo(ev.eventId, 'TERMINE');
        const future = new Date(Date.now() + 24 * 3600_000).toISOString();
        const { error } = await service.from('ticket_transfers').update({ expires_at: future }).eq('id', adm.transferId);
        assert.equal(error, null, `échéance de l’invitation tenue dans le futur (refus par le statut de l’événement seul) : ${error?.message}`);
        const res = await claim(adm.account, adm.transferId);
        assert.equal(res.body.code, 'EVENT_NOT_ACTIVE', show(res));
        assert.equal((await ticketRow(adm.ticketId)).user_id, null, 'rien rattaché');
    });

    test('5. numéro non vérifié : aucun détail, phone_verification_required', async () => {
        const ev = await newEvent('non-verifie');
        const adm = await admittedInvitation(ev, 'non-verifie');
        const list = await incoming(adm.account);
        assert.equal(list.status, 200, show(list));
        assert.deepEqual(list.body.items, [], show(list));
        assert.equal(list.body.phoneVerificationRequired, true, `invitation déjà utilisée en attente de vérification : ${show(list)}`);
        assert.ok(!JSON.stringify(list.body).includes(ev.eventId), show(list));
    });
});
