/**
 * Lot 11c-b — correctifs après la contre-vérification, avec la base LOCALE (faux SamirPay). Les suites de l'audit
 * (tests/audit/cv11cb-*) sont reprises sans changement ; celle-ci prouve en plus :
 *  O.  Prix changé entre le devis affiché et l'achat : refus 409 TABLE_PRICE_CHANGED avec le nouveau total en mots simples,
 *      AUCUN paiement créé ; avec le nouveau total affiché, l'achat passe au montant de la base ; sans total affiché,
 *      comportement d'avant (le garde-fou G1 de l'audit le vérifie).
 *  T2. GET /api/tickets dit au titulaire qui a envoyé toutes ses places qu'il tient une table (d'après les ventes) et que
 *      son remboursement est ouvert après un report de plus de 24 h (montant = total payé) ; rien pour un autre compte.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLot11cInvariants } from '../helpers/lot11c-invariants';
import { assertNotificationInvariants } from '../helpers/notification-invariants';
import { newBuyer, paymentsOf, service, type Buyer } from './paiement-helpers';
import { getSetting, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import {
    buyTable, createdTableType, newTablesEvent, patchTableType, postpone, show, showPlan, switchEventTablesService, tableCheckout,
    tableQuote, transferSeat, vipType, type Row,
} from './l11c-helpers';
import { GET as listTickets } from '../../app/api/tickets/route';
import { formatFcfa } from '../../lib/format';

const PRICE = 150_000;
const n = (v: unknown): number => Number(v);

let restore: () => Promise<void>;
let partner: TestPartner;
let feeRate: number;
const fee = (price: number): number => Math.ceil(price * feeRate / 100);

before(async () => {
    restore = await switchEventTablesService(true);
    partner = await newPartner('l11cb-cv');
    feeRate = n(await getSetting('finance.service_fee_rate'));
    assert.ok(Number.isFinite(feeRate) && feeRate >= 0, `taux de frais : ${feeRate}`);
});

after(async () => {
    if (restore) await restore();
    await checkLot11cInvariants('l11cb-cv-correctifs');
    await assertNotificationInvariants('l11cb-cv-correctifs');
});

async function tablesInfoOf(user: Buyer): Promise<Row> {
    const res = await listTickets(jsonRequest('/api/tickets', 'GET', user.accessToken));
    const body = (await res.json()) as { tables?: Row };
    assert.equal(res.status, 200, JSON.stringify(body).slice(0, 300));
    assert.ok(body.tables, `indicateur des tables servi : ${JSON.stringify(body).slice(0, 300)}`);
    return body.tables!;
}

describe('Observation — prix changé entre le devis affiché et l’achat', () => {
    test('total affiché périmé : 409 avec le nouveau total, aucun paiement ; total à jour : paiement au montant de la base', async () => {
        const ev = await newTablesEvent(partner, 'cv-prix', { capacity: 100 });
        const t = await createdTableType(partner, ev.eventId, vipType({ price: PRICE }), 2);
        await showPlan(partner, ev.eventId);
        const buyer = await newBuyer('l11cb-cv-prix');
        const quote = await tableQuote(ev.eventId, { typeId: t.typeId, tableId: t.tables[0].id, operator: 'WAVE' });
        assert.equal(n(quote.body.total), PRICE + fee(PRICE), show(quote));

        const NEW = 200_000;
        const patched = await patchTableType(partner, ev.eventId, t.typeId, { price: NEW });
        assert.equal(patched.status, 200, show(patched));
        const stale = await tableCheckout(buyer, ev.eventId, t.typeId, { tableId: t.tables[0].id, extra: { expectedTotal: n(quote.body.total) } });
        assert.deepEqual([stale.status, stale.body.code], [409, 'TABLE_PRICE_CHANGED'], show(stale));
        assert.equal(stale.body.error, `Le prix de cette table a changé : ${formatFcfa(NEW + fee(NEW))}. Vérifiez avant de payer.`);
        assert.equal(n(stale.body.total), NEW + fee(NEW), 'nouveau total servi pour l’écran');
        const none = (await paymentsOf(buyer.userId)).filter((p) => (p as unknown as Row).event_id === ev.eventId);
        assert.equal(none.length, 0, 'aucun paiement créé, rien demandé au client');

        const fresh = await tableCheckout(buyer, ev.eventId, t.typeId, { tableId: t.tables[0].id, extra: { expectedTotal: NEW + fee(NEW) } });
        assert.equal(fresh.status, 200, show(fresh));
        assert.equal(n(fresh.payment!.amount), NEW + fee(NEW), 'montant du paiement = prix de la base (celui affiché)');
        console.log(`[L11CB-CV] prix : devis ${n(quote.body.total)} F, refus « ${String(stale.body.error)} », puis paiement ${n(fresh.payment!.amount)} F`);
    });

    test('total affiché forgé (plus bas) : refus, le montant n’est jamais celui du navigateur', async () => {
        const ev = await newTablesEvent(partner, 'cv-prix-forge', { capacity: 100 });
        const t = await createdTableType(partner, ev.eventId, vipType({ price: PRICE }), 1);
        const buyer = await newBuyer('l11cb-cv-forge');
        const forged = await tableCheckout(buyer, ev.eventId, t.typeId, { extra: { expectedTotal: 1 } });
        assert.deepEqual([forged.status, forged.body.code], [409, 'TABLE_PRICE_CHANGED'], show(forged));
        assert.equal(n(forged.body.total), PRICE + fee(PRICE));
        const none = (await paymentsOf(buyer.userId)).filter((p) => (p as unknown as Row).event_id === ev.eventId);
        assert.equal(none.length, 0, 'aucun paiement');
    });
});

describe('T2 — titulaire sans billet de sa table : Mes billets le sait', () => {
    test('places toutes envoyées, report de 48 h : tables.holder, vente tenue et remboursement ouvert ; autre compte : rien', async () => {
        const ev = await newTablesEvent(partner, 'cv-titulaire', { capacity: 100 });
        const t = await createdTableType(partner, ev.eventId, vipType({ seats: 2 }), 1);
        const holder = await newBuyer('l11cb-cv-titulaire');
        const bought = await buyTable(holder, ev.eventId, t.typeId);
        const bookingId = String(bought.booking.id);
        for (const [i, seat] of bought.tickets.entries()) {
            const guest = await newBuyer(`l11cb-cv-invite${i}`);
            const transferId = await transferSeat(String(seat.id), holder, guest.phoneE164);
            const { data, error } = await service.rpc('ticket_transfer_accept', { p: { transfer_id: transferId, actor_id: guest.userId } });
            assert.equal(error, null, error?.message);
            assert.equal((data as Row | null)?.ok, true, JSON.stringify(data));
        }
        const before = await tablesInfoOf(holder);
        assert.equal(before.holder, true, 'titulaire d’après les ventes, sans aucun billet');
        assert.deepEqual(before.held, [{ bookingId, eventId: ev.eventId }]);
        assert.deepEqual(before.refundOpen, [], 'aucun remboursement sans report');

        await postpone(partner, ev.eventId, 48);
        const after = await tablesInfoOf(holder);
        const open = (after.refundOpen as Row[]).find((r) => r.bookingId === bookingId);
        assert.ok(open, `remboursement annoncé : ${JSON.stringify(after)}`);
        assert.equal(n(open!.amount), n(bought.payment.amount), 'montant = total payé');
        assert.equal(open!.eventId, ev.eventId);

        const other = await newBuyer('l11cb-cv-autre');
        assert.deepEqual(await tablesInfoOf(other), { holder: false, held: [], refundOpen: [] }, 'rien pour un autre compte');
    });
});
