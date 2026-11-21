/**
 * Contre-vérification du lot 11b (T8), POUR TOUTE L'APPLICATION : une partenaire ne lit par la REST (clé anon + son
 * jeton) AUCUN paiement ni remboursement de ses clients, quel que soit le service (billets, salles, tables), quel que
 * soit l'état ; le client lit toujours les siens ; les recettes de la partenaire restent justes par les routes serveur
 * (finance des billets, recettes des salles, recettes des tables).
 * Correctif : supabase/migrations/20261129000010_l11b_cv_paiements_lecture.sql (payments_read et refunds_read : le client
 * ou l'administration). Base LOCALE, faux SamirPay. Montants attendus calculés à la main : table 5 000 F × 4 = 20 000
 * (frais 5 % payés en plus par le client, commission 0 %).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertFinanceInvariants } from '../helpers/finance-invariants';
import { buyConfirmed, createPartnerEvent, jsonRequest } from '../parcours/finance-helpers';
import {
    newHall, openHallsService, payConfirmed as payHall, reserveRpc as reserveHall,
} from '../parcours/l10a-helpers';
import {
    api, dayFromNow, newBuyer, newPartner, newTable, newVenue, openTablesService, payConfirmed as payTable, reserveRpc as reserveTable,
    restAs, routeId, service, show, type Buyer, type Row, type TestPartner,
} from '../audit/cv11a-helpers';
import { GET as financeRoute } from '../../app/api/partner/finance/route';

let restoreTables: () => Promise<void>;
let restoreHalls: () => Promise<void>;
let owner: TestPartner;
let buyer: Buyer;
const paymentIds: Record<'billet' | 'salle' | 'table' | 'tableAnnulee', string> = { billet: '', salle: '', table: '', tableAnnulee: '' };
let ticketPrice = 0;
let ticketEvent = '';
let hallReservation = '';
let tableReservation = '';

const n = (v: unknown): number => Number(v);

before(async () => {
    restoreTables = await openTablesService();
    restoreHalls = await openHallsService();
    owner = await newPartner('l11bcv-paiements');
    buyer = await newBuyer('l11bcv-payeur', { firstName: 'Ndeye', lastName: 'Diop' });

    // Billets
    ticketPrice = 7_000;
    const ev = await createPartnerEvent(owner.partnerId, 'l11bcv-paiements', [{ name: 'Standard', price: ticketPrice, total: 50 }]);
    ticketEvent = ev.eventId;
    paymentIds.billet = String((await buyConfirmed(buyer, ev, [['Standard', 1]])).payment.id);

    // Salle
    const hall = await newHall(owner, { price_per_day: 200_000, cancellation_policy: 'MODEREE' });
    const h = await reserveHall(buyer, hall, { startDate: dayFromNow(40), days: 1 });
    assert.equal(h.ok, true, JSON.stringify(h));
    hallReservation = String(h.reservation_id);
    paymentIds.salle = String((await payHall(buyer, hallReservation, 'ACOMPTE')).id);

    // Tables : une réservation payée, une autre payée puis annulée (remboursement)
    const venue = await newVenue(owner, { deposit_per_person: 5_000 });
    const t1 = await newTable(owner, venue, 4, { number: 'PAY1' });
    const t2 = await newTable(owner, venue, 4, { number: 'PAY2' });
    const r1 = await reserveTable(buyer, venue, { date: dayFromNow(41), time: '20:00', guests: 4, tableId: t1 });
    assert.equal(r1.ok, true, JSON.stringify(r1));
    tableReservation = String(r1.reservation_id);
    paymentIds.table = String((await payTable(buyer, tableReservation)).id);
    const r2 = await reserveTable(buyer, venue, { date: dayFromNow(42), time: '20:00', guests: 4, tableId: t2 });
    assert.equal(r2.ok, true, JSON.stringify(r2));
    paymentIds.tableAnnulee = String((await payTable(buyer, String(r2.reservation_id))).id);
    const cancel = await routeId('POST', 'tables/reservations/[id]/cancel', String(r2.reservation_id), buyer.accessToken, {});
    assert.equal(cancel.status, 200, show(cancel));
});

after(async () => {
    await restoreHalls();
    await restoreTables();
    await assertFinanceInvariants('l11b-cv-paiements-partenaire');
});

describe('T8. Paiements et remboursements : client et administration seulement', () => {
    test('la partenaire ne lit par la REST aucun paiement (billets, salle, tables) ni aucun remboursement ; le client lit les siens', async () => {
        const ids = Object.values(paymentIds);
        const { data: real, error } = await service.from('payments').select('id, partner_id, status').in('id', ids);
        assert.equal(error, null, error?.message);
        assert.equal((real ?? []).length, 4, 'précondition : 4 paiements');
        // Précondition : les paiements des tables portent la fiche de la partenaire (l'ancienne règle les lui ouvrait)
        const tablePays = (real ?? []).filter((p) => p.id === paymentIds.table || p.id === paymentIds.tableAnnulee);
        assert.ok(tablePays.length === 2 && tablePays.every((p) => p.partner_id === owner.partnerId), `précondition : paiements des tables rattachés à la partenaire ${JSON.stringify(real)}`);
        console.log(`[L11B-CV] T8 paiements de la partenaire (base) : ${JSON.stringify(real)}`);
        const { data: refundRows } = await service.from('refunds').select('id').in('payment_id', ids);
        assert.ok((refundRows ?? []).length >= 1, 'précondition : un remboursement (table annulée)');

        const own = restAs(owner.accessToken);
        const byPartner = await own.from('payments').select('id, payer_phone, client_id, amount, status').eq('partner_id', owner.partnerId);
        const byIds = await own.from('payments').select('id').in('id', ids);
        const refunds = await own.from('refunds').select('id, amount').in('payment_id', ids);
        const mine = restAs(buyer.accessToken);
        const clientPays = await mine.from('payments').select('id').in('id', ids);
        const clientRefunds = await mine.from('refunds').select('id').in('payment_id', ids);
        const seen = {
            partenaireParFiche: byPartner.data ?? byPartner.error?.message, partenaireParIdentifiants: byIds.data ?? byIds.error?.message,
            partenaireRemboursements: refunds.data ?? refunds.error?.message, clientPaiements: (clientPays.data ?? []).length,
            clientRemboursements: (clientRefunds.data ?? []).length,
        };
        console.log(`[L11B-CV] T8 lectures REST : ${JSON.stringify(seen)}`);
        assert.deepEqual(byPartner.data ?? [], [], `paiements lus par la partenaire (par sa fiche) : ${JSON.stringify(byPartner.data)}`);
        assert.deepEqual(byIds.data ?? [], [], `paiements lus par la partenaire (par identifiant) : ${JSON.stringify(byIds.data)}`);
        assert.deepEqual(refunds.data ?? [], [], `remboursements lus par la partenaire : ${JSON.stringify(refunds.data)}`);
        assert.equal((clientPays.data ?? []).length, 4, `le client lit ses 4 paiements : ${JSON.stringify(clientPays)}`);
        assert.ok((clientRefunds.data ?? []).length >= 1, `le client lit son remboursement : ${JSON.stringify(clientRefunds)}`);
    });

    test('recettes de la partenaire justes par les routes serveur : billets, salle, tables', async () => {
        // Billets : ventes en ligne de l'événement = prix faciaux des billets vendus (lus en base)
        const res = await financeRoute(jsonRequest('/api/partner/finance', 'GET', owner.accessToken));
        const body = (await res.json()) as { finance?: { breakdown?: { tickets?: Row; halls?: Row; tables?: Row } } };
        assert.equal(res.status, 200, `finance : HTTP ${res.status} ${JSON.stringify(body)}`);
        const { data: tickets } = await service.from('tickets').select('price').eq('event_id', ticketEvent).eq('payment_id', paymentIds.billet);
        const faces = (tickets ?? []).reduce((s, t) => s + n(t.price), 0);
        assert.equal(faces, ticketPrice, 'précondition : un billet vendu');
        assert.equal(n(body.finance?.breakdown?.tickets?.grossRevenue), faces, `ventes des billets : ${JSON.stringify(body.finance?.breakdown?.tickets)}`);

        // Salle : la réservation payée figure dans les recettes, montant payé = paiement confirmé
        const halls = await api('GET', 'partner/halls/earnings', { token: owner.accessToken });
        assert.equal(halls.status, 200, show(halls));
        const { data: hallPay } = await service.from('payments').select('amount').eq('id', paymentIds.salle).single();
        const hallRow = ((halls.body.rows as Row[]) ?? []).find((r) => r.reservationId === hallReservation);
        assert.ok(hallRow, `réservation de salle absente des recettes : ${show(halls)}`);
        assert.equal(n(hallRow!.paidAmount), n(hallPay!.amount), `payé (salle) : ${JSON.stringify(hallRow)}`);

        // Tables : acompte 5 000 × 4 = 20 000 gagnés (frais payés en plus par le client, commission 0 %)
        const tables = await api('GET', 'partner/tables/earnings', { token: owner.accessToken });
        assert.equal(tables.status, 200, show(tables));
        const tableRow = ((tables.body.rows as Row[]) ?? []).find((r) => r.reservationId === tableReservation);
        assert.ok(tableRow && n(tableRow.earned) === 20_000, `recette de la table (20 000) : ${JSON.stringify(tableRow)}`);
    });
});
