/**
 * Lot 9 bis, tâche 3 (R11 ; contrat 5.3, B21, 4.1) — remboursement d'un billet par la partenaire : autorisé jusqu'à la fin
 * de l'événement ; après la fin, seul un admin `refunds.manage` (ou le SUPERADMIN) rembourse. Règle dans
 * ticket_refund_request (là où l'argent sort), contexte d'annulation (événement ANNULE) exempté ; routes
 * POST …/tickets/[ticketId]/refund (403 REFUND_CLOSED_AFTER_EVENT) et GET …/tickets/lookup (`refundable`,
 * `refund_closed_reason: 'EVENT_ENDED'`).
 *
 * Rouge avant correctif : ticket_refund_request ne lit ni la date ni l'acteur (M/20261108000001:21-129) et la route
 * accepte tout ADMIN sans permission (app/api/partner/events/[id]/tickets/[ticketId]/refund/route.ts:34-37, :64) :
 * la partenaire et l'admin sans permission obtiennent 200 après la fin ; le lookup ne sert pas `refund_closed_reason`.
 * Verts dès l'écriture (témoins, signalés) : remboursement par la partenaire avant la fin ; annulation par l'admin d'un
 * événement fini (contexte ANNULE). Leur garde-fou : les cas rouges du même fichier, qui portent la règle.
 * Événement « fini » : créé dans le futur, billet acheté, puis dates déplacées dans le passé (fin il y a 6 h), encore
 * PUBLIE (le passage TERMINE est celui du cron ou de l'admin) ; un cas le passe TERMINE.
 * Fin de suite : assertLot9bisInvariants (w20 : aucun remboursement demandé par la propriétaire après la fin).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CashoutService } from '../../lib/payments/cashout.service';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { newBuyer, service, setFakeMode, type Buyer, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, cashoutsByKey, confirmCashouts, createPartnerEvent, jsonRequest, newPartner, superadminId, type TestPartner } from './finance-helpers';
import { assertRpcOk, eventStatus, rpcCancel, rpcTransition, shiftEventDates } from './cycle-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { newAdminWith } from './terrain-helpers';
import type { RouteResult } from './acces-helpers';

after(async () => {
    setFakeMode('cashoutMode', 'success');
    await assertLot9bisInvariants('lot9bis-remboursement-fin');
});

type Row = Record<string, unknown>;

const REFUND_ROUTE = '../../app/api/partner/events/[id]/tickets/[ticketId]/refund/route';
const LOOKUP_ROUTE = '../../app/api/partner/events/[id]/tickets/lookup/route';
const PRICE = 5_000;
const REASON = 'Test lot 9 bis : remboursement après la fin';
const CLOSED_TEXT = 'L’événement est terminé : seul Event Village peut encore rembourser ce billet. Contactez le support.';

/** Texte comparé mot pour mot, apostrophe droite ou typographique indifférente (la RPC écrit en SQL, l'écran en ’). */
function sameQuotes(v: unknown): string {
    return String(v ?? '').replace(/’/g, '\'');
}

interface Sale {
    partner: TestPartner;
    ev: SaleEvent;
    buyer: Buyer;
    tickets: Row[];
}

/** Partenaire neuve, événement PUBLIE, `quantity` billets payés en ligne par un acheteur neuf. */
async function sale(label: string, quantity: number): Promise<Sale> {
    const partner = await newPartner(label);
    const ev = await createPartnerEvent(partner.partnerId, label, [{ name: 'Standard', price: PRICE, total: 20 }]);
    const buyer = await newBuyer(`${label}-ach`);
    const { tickets } = await buyConfirmed(buyer, ev, [['Standard', quantity]]);
    assert.equal(tickets.length, quantity, `${quantity} billet(s) émis`);
    return { partner, ev, buyer, tickets };
}

/** Fin de l'événement il y a 6 h (début il y a 10 h, durée 4 h) ; statut inchangé (PUBLIE). */
async function endEvent(eventId: string): Promise<void> {
    await shiftEventDates(eventId, { startsInHours: -10, durationHours: 4 });
    assert.equal(await eventStatus(eventId), 'PUBLIE', 'événement fini, encore PUBLIE');
}

function ctx(params: Record<string, string>): { params: Promise<Record<string, string>> & Record<string, string> } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

async function requestRefund(token: string, eventId: string, ticketId: string): Promise<RouteResult> {
    const handler = await routeHandler(REFUND_ROUTE, 'POST', 'POST /api/partner/events/[id]/tickets/[ticketId]/refund');
    return invoke(handler, jsonRequest(`/api/partner/events/${eventId}/tickets/${ticketId}/refund`, 'POST', token, { reason: REASON }), ctx({ id: eventId, ticketId }));
}

async function lookup(token: string, eventId: string, ticketNumber: string): Promise<Row> {
    const handler = await routeHandler(LOOKUP_ROUTE, 'GET', 'GET /api/partner/events/[id]/tickets/lookup');
    const res = await invoke(handler, jsonRequest(`/api/partner/events/${eventId}/tickets/lookup?number=${encodeURIComponent(ticketNumber)}`, 'GET', token), ctx({ id: eventId }));
    assert.equal(res.status, 200, `fiche du billet : ${show(res)}`);
    assert.ok(res.body.ticket && typeof res.body.ticket === 'object', `fiche absente : ${show(res)}`);
    return res.body.ticket as Row;
}

async function ticketStatus(id: unknown): Promise<string> {
    const { data, error } = await service.from('tickets').select('status').eq('id', String(id)).single();
    assert.equal(error, null, `billet ${String(id)} : ${error?.message}`);
    return String(data.status);
}

async function refundCashouts(ticketId: unknown): Promise<Row[]> {
    return cashoutsByKey(`REFUND-TKT-${String(ticketId)}`);
}

/** Refus sans effet : aucun versement, billet toujours VALIDE. */
async function assertNoEffect(ticketId: unknown, label: string): Promise<void> {
    assert.deepEqual((await refundCashouts(ticketId)).map((c) => c.id), [], `${label} : aucun versement`);
    assert.equal(await ticketStatus(ticketId), 'VALIDE', `${label} : billet toujours VALIDE`);
}

/** Versements de remboursement envoyés et confirmés (aucun versement laissé en attente par la suite). */
async function settle(cashoutIds: unknown[]): Promise<void> {
    for (const id of cashoutIds) if (typeof id === 'string') await CashoutService.send(id);
    await confirmCashouts();
}

describe('R11 — après la fin, la partenaire ne rembourse plus', () => {
    test('R11 reproduit : événement fini (encore PUBLIE) puis TERMINE, la partenaire rembourse un billet payé → 403 REFUND_CLOSED_AFTER_EVENT, aucun versement, billet VALIDE', async () => {
        const s = await sale('fin-r11', 2);
        await endEvent(s.ev.eventId);
        const [first, second] = s.tickets.map((t) => String(t.id));

        const res = await requestRefund(s.partner.accessToken, s.ev.eventId, first);
        if (res.status === 200) await settle([res.body.cashout_id]);
        assert.equal(res.status, 403, `R11 : remboursement par la partenaire après la fin : ${show(res)}`);
        assert.equal(res.body.code, 'REFUND_CLOSED_AFTER_EVENT', show(res));
        assert.equal(sameQuotes(res.body.error), sameQuotes(CLOSED_TEXT), `texte du refus (contrat 4.1) : ${show(res)}`);
        await assertNoEffect(first, 'événement fini');

        assertRpcOk(await rpcTransition(s.ev.eventId, await superadminId(), 'TERMINE'), 'passage TERMINE par l’admin');
        const done = await requestRefund(s.partner.accessToken, s.ev.eventId, second);
        if (done.status === 200) await settle([done.body.cashout_id]);
        assert.equal(done.status, 403, `R11 : remboursement par la partenaire d'un événement TERMINE : ${show(done)}`);
        assert.equal(done.body.code, 'REFUND_CLOSED_AFTER_EVENT', show(done));
        await assertNoEffect(second, 'événement TERMINE');
    });

    test('après la fin : admin sans permission et admin sans refunds.manage → 403 sans effet ; admin refunds.manage → 200 et un versement ; SUPERADMIN → 200', async () => {
        const s = await sale('fin-admins', 4);
        await endEvent(s.ev.eventId);
        const [t1, t2, t3, t4] = s.tickets.map((t) => String(t.id));

        const bare = await newAdminWith([], { label: 'r11-nu' });
        const r1 = await requestRefund(bare.accessToken, s.ev.eventId, t1);
        if (r1.status === 200) await settle([r1.body.cashout_id]);
        assert.equal(r1.status, 403, `admin sans permission : ${show(r1)}`);
        await assertNoEffect(t1, 'admin sans permission');

        const other = await newAdminWith(['events.read', 'events.write'], { label: 'r11-autre' });
        const r2 = await requestRefund(other.accessToken, s.ev.eventId, t2);
        if (r2.status === 200) await settle([r2.body.cashout_id]);
        assert.equal(r2.status, 403, `admin sans refunds.manage (events.read, events.write) : ${show(r2)}`);
        await assertNoEffect(t2, 'admin sans refunds.manage');

        const manager = await newAdminWith(['refunds.manage'], { label: 'r11-rembourse' });
        const r3 = await requestRefund(manager.accessToken, s.ev.eventId, t3);
        assert.equal(r3.status, 200, `admin refunds.manage : ${show(r3)}`);
        assert.equal((await refundCashouts(t3)).length, 1, 'un versement pour le billet');
        assert.notEqual(await ticketStatus(t3), 'VALIDE', 'billet en remboursement');

        const superadmin = await newAdminWith([], { role: 'SUPERADMIN', label: 'r11-super' });
        const r4 = await requestRefund(superadmin.accessToken, s.ev.eventId, t4);
        assert.equal(r4.status, 200, `SUPERADMIN : ${show(r4)}`);
        assert.equal((await refundCashouts(t4)).length, 1, 'un versement pour le billet');

        await settle([r3.body.cashout_id, r4.body.cashout_id]);
    });

    test('témoin (vert dès l’écriture) : avant la fin, la partenaire rembourse → 200 et un versement', async () => {
        const s = await sale('fin-avant', 1);
        const t = String(s.tickets[0].id);
        const res = await requestRefund(s.partner.accessToken, s.ev.eventId, t);
        assert.equal(res.status, 200, `remboursement avant la fin : ${show(res)}`);
        assert.equal((await refundCashouts(t)).length, 1, 'un versement');
        await settle([res.body.cashout_id]);
    });

    test('témoin (vert dès l’écriture) : annulation par l’admin d’un événement fini non TERMINE → billets remboursés (contexte ANNULE exempté)', async () => {
        const s = await sale('fin-annule', 2);
        await endEvent(s.ev.eventId);
        const { data: ev, error } = await service.from('events').select('title').eq('id', s.ev.eventId).single();
        assert.equal(error, null, error?.message);
        const out = assertRpcOk(await rpcCancel(s.ev.eventId, await superadminId(), {
            publicNotice: 'Événement annulé après coup par Event Village : vos billets sont remboursés.',
            internalReason: 'Annulation de test du lot 9 bis (après la fin)',
            confirmTitle: String(ev.title),
        }), 'annulation par l’admin');
        assert.equal(await eventStatus(s.ev.eventId), 'ANNULE');
        for (const t of s.tickets) assert.notEqual(await ticketStatus(t.id), 'VALIDE', `billet ${String(t.id)} plus valable après l’annulation`);
        const ids = Array.isArray(out.cashout_ids) ? out.cashout_ids : [];
        assert.ok(ids.length >= 1, `remboursement en ligne lancé par l’annulation : ${JSON.stringify(out)}`);
        const { data: cashouts, error: cErr } = await service.from('cashouts').select('kind').in('id', ids as string[]);
        assert.equal(cErr, null, cErr?.message);
        assert.ok((cashouts ?? []).every((c) => c.kind === 'EVENT_CANCELLATION_REFUND'), `versements d'annulation : ${JSON.stringify(cashouts)}`);
        await settle(ids);
    });

    test('lookup : après la fin, la partenaire lit refundable = false et refund_closed_reason = EVENT_ENDED ; avant la fin, refundable = true et refund_closed_reason = null', async () => {
        const s = await sale('fin-fiche', 1);
        const number = String(s.tickets[0].ticket_number);

        const beforeEnd = await lookup(s.partner.accessToken, s.ev.eventId, number);
        assert.equal(beforeEnd.refundable, true, `avant la fin : ${JSON.stringify(beforeEnd)}`);
        assert.ok('refund_closed_reason' in beforeEnd, `champ refund_closed_reason servi (contrat 4.1) : ${JSON.stringify(beforeEnd)}`);
        assert.equal(beforeEnd.refund_closed_reason, null, JSON.stringify(beforeEnd));

        await endEvent(s.ev.eventId);
        const afterEnd = await lookup(s.partner.accessToken, s.ev.eventId, number);
        assert.equal(afterEnd.refundable, false, `après la fin, la partenaire ne peut plus rembourser : ${JSON.stringify(afterEnd)}`);
        assert.equal(afterEnd.refund_closed_reason, 'EVENT_ENDED', JSON.stringify(afterEnd));
    });
});
