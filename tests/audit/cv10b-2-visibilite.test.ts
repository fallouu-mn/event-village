/**
 * Contre-vérification du lot 10b — points 4 et 6 : argent affiché = base, salle non publique ni visible ni réservable.
 * Base LOCALE, faux SamirPay, service ouvert le temps de la suite.
 *
 * Garde-fous (verts attendus, preuve que l'attaque est BLOQUÉE) :
 *  G5. salle en attente, refusée, suspendue, retirée de la vente : absente de la recherche, fiche, calendrier et devis en
 *      404 ou refus, réservation et paiement refusés ;
 *  G6. argent : la route de réservation ignore tout montant reçu ; le devis affiché = la réservation figée ; l'aperçu
 *      d'annulation = le remboursement réel.
 * Trous (rouges attendus tant qu'ils ne sont pas corrigés) :
 *  T3. réglage halls.validation_required désactivé : une salle restée EN_ATTENTE_VALIDATION (non validée) est
 *      réservable (hall_quote et hall_booking_refusal la laissent passer), alors qu'elle n'est pas visible ;
 *  T4. salle d'une partenaire suspendue (partner_status_set) : invisible dans l'application, mais lisible par
 *      n'importe qui par la REST (politique halls_read_public sans le statut de la partenaire).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLot10aInvariants } from '../helpers/lot10a-invariants';
import { assertFinanceInvariants } from '../helpers/finance-invariants';
import { startPayment } from '../parcours/l10a-helpers';
import { reserveRoute } from './cv10a-helpers';
import {
    api, dayFromNow, decideHall, newBuyer, newHall, newPartner, openHallsService, payConfirmed, reservation, reserveRpc,
    restAs, routeId, service, show, suspendPartner, trace, withSettings, type Buyer, type Row, type TestPartner,
} from './cv10b-helpers';

let restore: () => Promise<void>;
let owner: TestPartner;
let client: Buyer;

before(async () => {
    restore = await openHallsService();
    owner = await newPartner('cv10b-visible');
    client = await newBuyer('cv10b-visiteur');
});

after(async () => {
    await restore();
    await assertLot10aInvariants('cv10b-2-visibilite');
    await assertFinanceInvariants('cv10b-2-visibilite');
});

/** Ce que voit et peut faire un client sur une salle : recherche, fiche, calendrier, devis, réservation. */
async function exposure(hallId: string, label: string): Promise<{ inSearch: boolean; sheet: number; calendar: number; quote: number; reserve: Row }> {
    const name = String((await service.from('halls').select('name').eq('id', hallId).single()).data!.name);
    const search = await api('GET', 'halls', { path: `/api/halls?q=${encodeURIComponent(name)}` });
    const sheet = await routeId('GET', 'halls/[id]', hallId, null);
    const calendar = await routeId('GET', 'halls/[id]/calendar', hallId, null);
    const quote = await routeId('GET', 'halls/[id]/quote', hallId, null, undefined, `?date=${dayFromNow(50)}&mode=JOUR&units=1`);
    const reserve = await reserveRpc(client, hallId, { days: 1, startInDays: 50 });
    const out = {
        inSearch: JSON.stringify(search.body.halls ?? []).includes(hallId),
        sheet: sheet.status, calendar: calendar.status, quote: quote.status, reserve,
    };
    trace(`exposition ${label}`, { ...out, search: show(search).slice(0, 160), quoteBody: show(quote).slice(0, 200) });
    return out;
}

describe('G5. Salle non publique : ni visible ni réservable (attaques BLOQUÉES attendues)', () => {
    test('en attente, refusée, suspendue, retirée de la vente', async () => {
        const pending = await newHall(owner, { validate: false });
        const refused = await newHall(owner, { validate: false });
        assert.equal((await decideHall(refused, 'REFUSER', 'Photos absentes de la salle.')).ok, true);
        const suspended = await newHall(owner);
        assert.equal((await decideHall(suspended, 'SUSPENDRE', 'Plainte de clients à vérifier.')).ok, true);
        const inactive = await newHall(owner, { is_active: false });
        for (const [label, id] of [['EN_ATTENTE', pending], ['REFUSEE', refused], ['SUSPENDUE', suspended], ['RETIREE', inactive]] as const) {
            const e = await exposure(id, label);
            assert.equal(e.inSearch, false, `${label} : dans la recherche`);
            assert.equal(e.sheet, 404, `${label} : fiche`);
            assert.ok(e.calendar >= 400, `${label} : calendrier ${e.calendar}`);
            assert.ok(e.quote >= 400, `${label} : devis ${e.quote}`);
            assert.notEqual(e.reserve.ok, true, `${label} : réservation acceptée ${JSON.stringify(e.reserve)}`);
        }
    });

    test('salle suspendue après la réservation : l’acompte n’est plus payable', async () => {
        const hall = await newHall(owner);
        const res = String((await reserveRpc(client, hall, { days: 1, startInDays: 52 })).reservation_id);
        assert.equal((await decideHall(hall, 'SUSPENDRE', 'Contrôle de conformité en cours.')).ok, true);
        const pay = await startPayment(client, res, 'ACOMPTE');
        trace('G5 acompte sur salle suspendue', show({ status: pay.status, body: pay.body }));
        assert.ok(pay.status >= 400, `acompte accepté sur une salle suspendue : HTTP ${pay.status}`);
        assert.equal(pay.payment, null, 'aucun paiement créé');
    });
});

describe('G6. Argent : rien du navigateur, écran = base (attaques BLOQUÉES attendues)', () => {
    test('montants envoyés par le navigateur ignorés ; devis = réservation figée ; aperçu d’annulation = remboursement', async () => {
        const hall = await newHall(owner, { price_per_day: 180_000 });
        const date = dayFromNow(70);
        const quote = await routeId('GET', 'halls/[id]/quote', hall, null, undefined, `?date=${date}&mode=JOUR&units=1`);
        assert.equal(quote.status, 200, show(quote));
        const q = quote.body.quote as Row;
        const reserved = await reserveRoute(client, {
            hallId: hall, mode: 'JOUR', units: 1, startDate: date,
            totalAmount: 1, depositAmount: 1, price_amount: 1, total_amount: 1, deposit_amount: 1, amount: 1,
        });
        assert.ok(reserved.status < 300, show(reserved as never));
        const id = String((reserved.body.reservation as Row | undefined)?.id ?? reserved.body.reservation_id ?? '');
        const r = await reservation(id);
        trace('G6 devis / réservation', { quote: q, reservation: { price: r.price_amount, fee: r.service_fee_amount, total: r.total_amount, deposit: r.deposit_amount, balance: r.balance_amount } });
        assert.deepEqual(
            [Number(r.price_amount), Number(r.service_fee_amount), Number(r.total_amount), Number(r.deposit_amount), Number(r.balance_amount)],
            [Number(q.priceAmount), Number(q.serviceFeeAmount), Number(q.totalAmount), Number(q.depositAmount), Number(q.balanceAmount)]);
        await payConfirmed(client, id, 'ACOMPTE');
        const preview = await routeId('GET', 'halls/reservations/[id]/cancel', id, client.accessToken);
        assert.equal(preview.status, 200, show(preview));
        const cancel = await routeId('POST', 'halls/reservations/[id]/cancel', id, client.accessToken, {});
        assert.equal(cancel.status, 200, show(cancel));
        const after0 = await reservation(id);
        trace('G6 aperçu / annulation', { preview: preview.body.preview, cancel: cancel.body, refunded: after0.refunded_amount });
        assert.equal(Number((preview.body.preview as Row).refundAmount), Number(after0.refunded_amount));
    });
});

describe('T3. Réglage halls.validation_required désactivé : une salle non validée devient réservable', () => {
    test('salle EN_ATTENTE_VALIDATION : absente de la recherche, mais devis et réservation acceptés', async () => {
        const pending = await newHall(owner, { validate: false });
        const { data: h } = await service.from('halls').select('validation_status').eq('id', pending).single();
        assert.equal(h!.validation_status, 'EN_ATTENTE_VALIDATION', 'précondition : salle non validée');
        const e = await withSettings({ 'halls.validation_required': false }, () => exposure(pending, 'EN_ATTENTE, validation désactivée'));
        assert.equal(e.inSearch, false, 'précondition : invisible dans la recherche');
        assert.equal(e.sheet, 404, 'précondition : fiche publique 404');
        assert.notEqual(e.reserve.ok, true, `salle non validée réservée : ${JSON.stringify(e.reserve)}`);
    });
});

describe('T4. Salle d’une partenaire suspendue lisible par la REST', () => {
    test('suspension officielle : fiche 404 dans l’application, mais la REST anonyme rend la salle', async () => {
        const host = await newPartner('cv10b-suspendue-rest');
        const hall = await newHall(host);
        const reply = await suspendPartner(host.partnerId, 'Contre-vérification du lot 10b');
        assert.equal(reply.ok, true, JSON.stringify(reply));
        const sheet = await routeId('GET', 'halls/[id]', hall, null);
        assert.equal(sheet.status, 404, `précondition : fiche publique ${show(sheet)}`);
        const { data, error } = await restAs(null).from('halls').select('id, name, partner_id, price_per_day, validation_status, is_active').eq('id', hall);
        trace('T4 REST anonyme', { error: error?.message ?? null, rows: data });
        assert.deepEqual(data ?? [], [], `salle d'une partenaire suspendue lue par la REST anonyme : ${JSON.stringify(data)}`);
    });
});
