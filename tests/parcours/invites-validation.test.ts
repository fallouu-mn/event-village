/**
 * Lot 9 ter, tâche 9t.17 (consigne 3 ; consigne 6 : « validation par liste puis scan → Déjà utilisé ») — validation
 * d'une invitation par la liste des invités, dans la RPC de scan (contrat 5.C, C.2.2 points 5, 6, 10 et 12, C.2.3,
 * C.3.6 ; x11, w8 à w10 tenus par ADMITTED + claimed_at).
 *  1. validation par la liste : vert, porteur « Awa Diop », badge d'origine, billet UTILISE et déverrouillé, ligne
 *     GUEST_LIST tracée, transfert ADMITTED (claimed_at = heure de la ligne), aucun avis ;
 *  2. liste puis scan du même billet : Déjà utilisé (seconde validation, saisie manuelle, réclamation puis QR) ;
 *  3. pièce non vérifiée : manual_entry_refused, rien composté, transfert PENDING ;
 *  4. billet non INVITATION par la liste : invalid sans donnée ; billet d'un autre événement : wrong_event ;
 *  5. événement suspendu : event_suspended, transfert PENDING, billet verrouillé ;
 *  6. rejeu de la même clé : même verdict, aucune ligne nouvelle ;
 *  7. invitation échue après la fin, contrôle encore ouvert : validée, transfert EXPIRED → ADMITTED ;
 *  8. une invitation a les droits de sa catégorie : VIP par la liste à la Porte Nord → wrong_zone, transfert PENDING,
 *     billet verrouillé ; Porte VIP → valid.
 *
 * Rouge avant correctif (fix(9t.17), fix(9t.17-SZ), migrations 20261110000003, …08, …09) : le corps
 * { eventId, guestTicketId, identityVerified } est refusé par la route du scan (400, aucun schéma GUEST_LIST), méthode
 * GUEST_LIST absente de ticket_scan et de ticket_scans_method_check, statut ADMITTED absent, colonne guest_name
 * absente ; cas 8 : route des zones absente. after() : assertLot9terInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { randomSenegalPhone, routeContext } from './helpers';
import { newBuyer, service, type Buyer, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent, newController, scan, scansOf, ticketPayload, ticketRow, type RouteResult } from './acces-helpers';
import { advanceEventTo, shiftEventDates } from './cycle-helpers';
import { markPhoneVerified, outboxRows } from './notif-helpers';
import { invoke, routeHandler } from './pilotage-helpers';
import { assignGate, createZonedEvent, gateOf, guestAdmit, guestSearch, sendInvitations, type ZoneSpec } from './zones-helpers';

type Row = Record<string, unknown>;

const VIP = 'VIP';
const SIMPLE = 'SIMPLE';
const CATEGORIES: CategorySpec[] = [
    { name: SIMPLE, price: 5_000, total: 30, maxPerOrder: 10 },
    { name: VIP, price: 20_000, total: 20, maxPerOrder: 10 },
];

let partner: TestPartner;
let buyer: Buyer;

before(async () => {
    partner = await newPartner('invites-validation');
    buyer = await newBuyer('invites-validation');
});

after(async () => {
    await assertLot9terInvariants('invites-validation');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 900)}`;
}

function newEvent(label: string): Promise<SaleEvent> {
    return createTimedEvent(partner.partnerId, `invites-validation ${label}`, CATEGORIES);
}

interface Invitation { phone: string; ticketId: string; transferId: string }

/** Invitation en attente (numéro sans compte vérifié), nommée « Awa Diop » ; billet sans porteur, transfert PENDING. */
async function pendingInvitation(ev: SaleEvent, opts: { phone?: string; category?: string } = {}): Promise<Invitation> {
    const phone = opts.phone ?? randomSenegalPhone('76');
    const r = await sendInvitations(partner, ev.eventId, { category_id: ev.categories[opts.category ?? VIP].id, phones: [phone], quantity: 1, guest_names: ['Awa Diop'] });
    assert.equal(r.status, 200, `invitation : ${show(r)}`);
    const { data, error } = await service.from('ticket_transfers').select('id, ticket_id').eq('to_phone_or_email', phone).is('from_user_id', null).eq('status', 'PENDING');
    assert.equal(error, null, `transfert : ${error?.message}`);
    assert.equal((data ?? []).length, 1, `précondition : un transfert PENDING vers ${phone}`);
    return { phone, ticketId: String(data![0].ticket_id), transferId: String(data![0].id) };
}

async function transferRow(id: string): Promise<Row> {
    const { data, error } = await service.from('ticket_transfers').select('*').eq('id', id).single();
    assert.equal(error, null, `transfert ${id} : ${error?.message}`);
    return data as Row;
}

function expectResult(r: RouteResult, result: string, what: string): void {
    assert.equal(r.status, 200, `${what} : ${show(r)}`);
    assert.equal(r.body.result, result, `${what} : ${show(r)}`);
}

async function assertUntouched(inv: Invitation, what: string): Promise<void> {
    const t = await ticketRow(inv.ticketId);
    assert.equal(t.status, 'VALIDE', `${what} : billet non composté`);
    assert.equal(t.transfer_locked, true, `${what} : billet toujours verrouillé`);
    assert.equal((await transferRow(inv.transferId)).status, 'PENDING', `${what} : transfert toujours PENDING`);
    assert.deepEqual((await scansOf(inv.ticketId)).filter((s) => s.accepted === true), [], `${what} : aucune ligne acceptée`);
}

// ── 1 et 2. Validation, puis Déjà utilisé ──────────────────────────────────

describe('9t.17 Validation par la liste des invités', () => {
    test('1. validation par la liste : vert, billet utilisé, ligne GUEST_LIST tracée, transfert ADMITTED, billet déverrouillé, aucun avis', async () => {
        const ev = await newEvent('vert');
        const ctrl = await newController(partner, ev.eventId, { label: 'val-vert' });
        const inv = await pendingInvitation(ev);
        const r = await guestAdmit(ctrl, ev.eventId, inv.ticketId);
        expectResult(r, 'valid', 'validation par la liste');
        const ticket = r.body.ticket as Row;
        assert.deepEqual({ holder: ticket.holder, is_guest_list: ticket.is_guest_list, origin: ticket.origin },
            { holder: 'Awa Diop', is_guest_list: true, origin: 'INVITATION' }, show(r));
        const t = await ticketRow(inv.ticketId);
        assert.deepEqual({ status: t.status, transfer_locked: t.transfer_locked, checked_in_by: t.checked_in_by, user_id: t.user_id },
            { status: 'UTILISE', transfer_locked: false, checked_in_by: ctrl.userId, user_id: null }, JSON.stringify(t));
        const accepted = (await scansOf(inv.ticketId)).filter((s) => s.accepted === true);
        assert.equal(accepted.length, 1, 'une ligne acceptée');
        assert.deepEqual({ method: accepted[0].method, identity_verified: accepted[0].identity_verified, scanner_id: accepted[0].scanner_id, result: accepted[0].result },
            { method: 'GUEST_LIST', identity_verified: true, scanner_id: ctrl.userId, result: 'valid' }, JSON.stringify(accepted[0]));
        const tr = await transferRow(inv.transferId);
        assert.equal(tr.status, 'ADMITTED', JSON.stringify(tr));
        assert.equal(Date.parse(String(tr.claimed_at)), Date.parse(String(accepted[0].created_at)), 'claimed_at = heure de la ligne (x11)');
        const scanned = (await outboxRows({ type: 'TICKET_SCANNED', eventId: ev.eventId })).filter((o) => o.template_data.ticket_id === inv.ticketId);
        assert.deepEqual(scanned, [], 'aucun avis TICKET_SCANNED (billet sans porteur)');
    });

    test('2. liste puis scan du même billet : Déjà utilisé (consigne 6)', async () => {
        const ev = await newEvent('deja-utilise');
        const ctrl = await newController(partner, ev.eventId, { label: 'val-deja' });
        const account = await newBuyer('val-deja-compte', { firstName: 'Awa', lastName: 'Diop' });
        const inv = await pendingInvitation(ev, { phone: account.phoneE164 });
        expectResult(await guestAdmit(ctrl, ev.eventId, inv.ticketId), 'valid', 'première validation');
        expectResult(await guestAdmit(ctrl, ev.eventId, inv.ticketId), 'already_used', 'seconde validation par la liste');
        const t = await ticketRow(inv.ticketId);
        const manual = await scan(ctrl, { eventId: ev.eventId, manualTicketNumber: String(t.ticket_number), identityVerified: true });
        expectResult(manual, 'already_used', 'saisie manuelle du numéro');

        await markPhoneVerified(account.userId);
        const claim = await routeHandler('../../app/api/tickets/transfers/[id]/claim/route', 'POST', 'réclamation');
        const claimed = await invoke(claim, authed(`/api/tickets/transfers/${inv.transferId}/claim`, 'POST', account), routeContext({ id: inv.transferId }));
        assert.equal(claimed.status, 200, `réclamation d’un billet déjà utilisé : ${show(claimed)}`);
        const qr = await scan(ctrl, { eventId: ev.eventId, payload: await ticketPayload(inv.ticketId) });
        expectResult(qr, 'already_used', 'QR après réclamation');
        assert.equal((await scansOf(inv.ticketId)).filter((s) => s.accepted === true).length, 1, 'une seule entrée');
    });

    test('3. pièce non vérifiée : manual_entry_refused, rien composté, transfert PENDING', async () => {
        const ev = await newEvent('piece');
        const ctrl = await newController(partner, ev.eventId, { label: 'val-piece' });
        const inv = await pendingInvitation(ev);
        expectResult(await guestAdmit(ctrl, ev.eventId, inv.ticketId, { identityVerified: false }), 'manual_entry_refused', 'pièce non vérifiée');
        await assertUntouched(inv, 'pièce non vérifiée');
    });

    test('4. billet non INVITATION par la liste : invalid sans donnée ; billet d’un autre événement : wrong_event', async () => {
        const ev = await newEvent('non-invitation');
        const other = await newEvent('autre-evenement');
        const ctrl = await newController(partner, ev.eventId, { label: 'val-forge' });
        const [sold] = (await buyConfirmed(buyer, ev, [[VIP, 1]])).tickets;
        const forged = await guestAdmit(ctrl, ev.eventId, String(sold.id));
        expectResult(forged, 'invalid', 'billet vendu présenté par la liste');
        assert.equal(forged.body.ticket, undefined, `aucune donnée du billet : ${show(forged)}`);
        assert.ok(!JSON.stringify(forged.body).includes(String(sold.ticket_number)), show(forged));
        assert.equal((await ticketRow(String(sold.id))).status, 'VALIDE', 'billet vendu non composté');
        const rows = await scansOf(String(sold.id));
        assert.deepEqual(rows, [], 'ligne invalid écrite sans ticket_id (requête forgée)');

        const foreign = await pendingInvitation(other);
        expectResult(await guestAdmit(ctrl, ev.eventId, foreign.ticketId), 'wrong_event', 'invitation d’un autre événement');
        await assertUntouched(foreign, 'invitation d’un autre événement');
    });

    test('5. événement suspendu : event_suspended, transfert PENDING, billet verrouillé', async () => {
        const ev = await newEvent('suspendu');
        const ctrl = await newController(partner, ev.eventId, { label: 'val-suspendu' });
        const inv = await pendingInvitation(ev);
        await advanceEventTo(ev.eventId, 'SUSPENDU');
        expectResult(await guestAdmit(ctrl, ev.eventId, inv.ticketId), 'event_suspended', 'événement suspendu');
        await assertUntouched(inv, 'événement suspendu');
    });

    test('6. rejeu de la même clé : même verdict, aucune ligne nouvelle', async () => {
        const ev = await newEvent('rejeu');
        const ctrl = await newController(partner, ev.eventId, { label: 'val-rejeu' });
        const inv = await pendingInvitation(ev);
        const key = randomUUID();
        const first = await guestAdmit(ctrl, ev.eventId, inv.ticketId, { idempotencyKey: key });
        expectResult(first, 'valid', 'validation');
        const count = (await scansOf(inv.ticketId)).length;
        const again = await guestAdmit(ctrl, ev.eventId, inv.ticketId, { idempotencyKey: key });
        expectResult(again, 'valid', 'rejeu de la même clé');
        assert.equal(again.body.replayed, true, show(again));
        assert.equal((again.body.ticket as Row | undefined)?.is_guest_list, true, `rejeu : is_guest_list reconstruit : ${show(again)}`);
        assert.equal((await scansOf(inv.ticketId)).length, count, 'aucune ligne nouvelle');
    });

    test('7. invitation échue après la fin, contrôle encore ouvert : validée, transfert EXPIRED → ADMITTED', async () => {
        const ev = await newEvent('echue');
        const ctrl = await newController(partner, ev.eventId, { label: 'val-echue' });
        const inv = await pendingInvitation(ev);
        // Invitation envoyée avant l'événement : trg_events_invitation_expiry (M/20261108000002:640-657) ne recale
        // l'échéance sur la nouvelle fin que si cette fin est postérieure à created_at.
        const backdate = await service.from('ticket_transfers').update({ created_at: new Date(Date.now() - 49 * 3600_000).toISOString() }).eq('id', inv.transferId);
        assert.equal(backdate.error, null, `recul de created_at : ${backdate.error?.message}`);
        await shiftEventDates(ev.eventId, { startsInHours: -4, durationHours: 3 });
        const { data, error } = await service.rpc('ticket_transfers_expire', { p: {} });
        assert.equal(error, null, `ticket_transfers_expire : ${error?.message}`);
        assert.equal((data as Row).ok, true, JSON.stringify(data));
        assert.equal((await transferRow(inv.transferId)).status, 'EXPIRED', 'précondition : invitation échue à la fin de l’événement');
        const found = await guestSearch(ctrl, ev.eventId, inv.phone);
        assert.equal(found.status, 200, show(found));
        assert.deepEqual(((found.body.items ?? []) as Row[]).map((g) => g.ticket_ids), [[inv.ticketId]], `groupe présent : ${show(found)}`);
        expectResult(await guestAdmit(ctrl, ev.eventId, inv.ticketId), 'valid', 'validation dans la fenêtre après la fin');
        assert.equal((await transferRow(inv.transferId)).status, 'ADMITTED', 'transfert EXPIRED → ADMITTED');
    });

    test('8. une invitation a les droits de sa catégorie : VIP par la liste à la Porte Nord → wrong_zone ; Porte VIP → valid', async () => {
        const zones: ZoneSpec[] = [
            { name: 'Entrée générale', kind: 'ENTREE', admits: [SIMPLE], gates: ['Porte Nord'] },
            { name: 'Entrée VIP', kind: 'ENTREE', admits: [VIP], gates: ['Porte VIP'] },
        ];
        const ev = await createZonedEvent(partner, 'invites-validation zones', CATEGORIES, zones);
        const nord = await newController(partner, ev.eventId, { label: 'val-nord' });
        const porteVip = await newController(partner, ev.eventId, { label: 'val-vip' });
        for (const [c, g] of [[nord, 'Porte Nord'], [porteVip, 'Porte VIP']] as Array<[Buyer, string]>) {
            const res = await assignGate(partner, ev.eventId, c.userId, gateOf(ev, g));
            assert.equal(res.status, 200, show(res));
        }
        const inv = await pendingInvitation(ev);
        const wrong = await guestAdmit(nord, ev.eventId, inv.ticketId, { gateId: gateOf(ev, 'Porte Nord') });
        expectResult(wrong, 'wrong_zone', 'invitation VIP à la Porte Nord');
        await assertUntouched(inv, 'mauvaise zone');
        expectResult(await guestAdmit(porteVip, ev.eventId, inv.ticketId, { gateId: gateOf(ev, 'Porte VIP') }), 'valid', 'invitation VIP à la Porte VIP');
        assert.equal((await transferRow(inv.transferId)).status, 'ADMITTED');
    });
});
