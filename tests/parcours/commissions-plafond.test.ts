/**
 * Lot 8, tâche 8.2 c — plafond des commissions de parrainage (contrat section 6.3, AR5, L36 à L38 ; écrivain W3).
 * Règle : N1 = min(calcul, net), N2 = min(calcul, net − N1), et même budget au remboursement partiel. Avec la
 * grille, le dépassement est impossible à la vente (force brute de la découverte) ; il est possible en base (taux
 * sans plafond dans referral_relationships) et réel après un remboursement partiel d'un panier à deux prix.
 * Le taux N2 reste celui de la relation N1 ; la grille ne change pas (L37).
 *  1. relation à 80/30 : 1 000 F → N1 27,40 F, N2 6,85 F, uncapped_amount 10,28 F ; grand livre égal ;
 *  2. relation à 100/100 : N1 = net, aucune ligne N2 ;
 *  2 bis. relation à 120/10 (ajout au contrat, signalé) : N1 plafonné au net, uncapped_amount 41,10 F, aucune N2 ;
 *  3. témoin grille : 1,71 F et 0,69 F, uncapped_amount nul ;
 *  4. frais à 0 % : net négatif, aucune commission, aucune violation de (r) ;
 *  5. panier 10 000 + 100 F, remboursement du gros billet : commissions annulées, soldes PARRAINAGE à 0 ;
 *  6. même panier, commission N1 déjà versée : régularisation jusqu'à 0 ;
 *  7. témoin : le prorata de finance-commissions.test.ts:375 ne change pas (1,72 F + 0,69 F) ;
 *  8. (ajout au contrat, signalé) budget qui coupe le prorata sans l'annuler : uncapped_amount sur la ligne de
 *     remplacement, budget épuisé pour N2. Relation à 80/30, 2 billets de 1 000 F.
 *
 * Exemple du rapport (contrat 6.3) : 1 000 F, net 34,25 F. 80/30 : avant 27,40 + 10,28 = 37,68 F, après 27,40 + 6,85.
 * Panier 10 000 + 100 F, grille 5/2 : net 345,92 F, N1 17,30 F, N2 6,92 F ; remboursement du billet de 10 000 F :
 * réversion 500 F, net effectif −154,08 F ; avant 0,17 + 0,07 F restants, après 0 + 0.
 *
 * Rouge avant correctif (fix(8.2c), migration 20261106000004) :
 *  - 1, 2, 2 bis : calculate_referral_commissions n'a aucun plafond (20261101000006_lot3_commissions.sql:96,113) ;
 *  - 5, 6, 8 : fin_referral_on_refund proratise sur le montant remboursé, jamais sur le revenu net (:173-174) ;
 *  - 3 : les montants sont déjà justes, mais la colonne uncapped_amount manque : l'échec la nomme ;
 *  - 4 : aucune commission déjà aujourd'hui ; la lecture de (r) échoue en nommant le schéma du lot absent ;
 *  - after() : assertRecetteInvariants nomme le schéma du lot absent.
 * Vert dès l'écriture (témoin, signalé) : 7. Garde-fou : le cas 8, où le budget coupe vraiment le prorata.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { CashoutService } from '../../lib/payments/cashout.service';
import { assertRecetteInvariants, recetteViolations } from '../helpers/recette-invariants';
import { routeContext } from './helpers';
import { balanceOf, buyConfirmed, createPartnerEvent, jsonRequest, ledgerOf, newPartner, paymentRow, withSettings, type Purchase, type TestPartner } from './finance-helpers';
import { fakePay, importModule, newBuyer, service, setFakeMode, type Buyer, type SaleEvent } from './paiement-helpers';

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

const REFUND_ROUTE = '../../app/api/partner/events/[id]/tickets/[ticketId]/refund/route';
const M4 = 'migration 20261106000004';

const cents = (x: unknown): number => Math.round(Number(x) * 100);
const kindOf = (c: Row): string => String(c.kind ?? 'COMMISSION');
const brief = (c: Row) => ({ gen: c.generation, kind: c.kind, status: c.status, amount: c.amount, uncapped: c.uncapped_amount, reason: c.cancellation_reason });

let partner: TestPartner;

before(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = 10_000_000;
    partner = await newPartner('plafond');
});

after(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = 10_000_000;
    await assertRecetteInvariants('commissions-plafond');
});

// ── Chaîne de parrainage ───────────────────────────────────────────────────

interface Chain { n2: Buyer; n1: Buyer; filleul: Buyer }
interface Rates { n1: number; n2: number }

const GRID: Rates = { n1: 5, n2: 2 };

/** Relation écrite par le service_role, comme finance-commissions.test.ts:85, avec les taux du cas. */
async function relate(sponsor: Buyer, referred: Buyer, rates: Rates): Promise<void> {
    const { error } = await service.from('referral_relationships').insert({
        sponsor_id: sponsor.userId, referred_id: referred.userId, referral_type: 'CLIENT_TO_CLIENT', sponsor_status_at_creation: 'STANDARD',
        rate_n1_at_creation: rates.n1, rate_n2_at_creation: rates.n2, duration_months: 12,
        expires_at: new Date(Date.now() + 365 * 24 * 3600_000).toISOString(), is_active: true,
    });
    assert.equal(error, null, `relation de parrainage ${rates.n1}/${rates.n2} : ${error?.message}`);
}

/** Parrain N2 → parrain N1 → filleul ; le taux N2 appliqué est celui de la relation N1 (calculate_referral_commissions). */
async function chain(label: string, rates: Rates = GRID): Promise<Chain> {
    const n2 = await newBuyer(`plafond-${label}-n2`, { firstName: 'Aminata', lastName: 'ParrainDeux' });
    const n1 = await newBuyer(`plafond-${label}-n1`, { firstName: 'Ibrahima', lastName: 'ParrainUn' });
    const filleul = await newBuyer(`plafond-${label}-f`, { firstName: 'Khady', lastName: 'Filleule' });
    await relate(n2, n1, GRID);
    await relate(n1, filleul, rates);
    return { n2, n1, filleul };
}

async function standardEvent(label: string): Promise<SaleEvent> {
    return createPartnerEvent(partner.partnerId, `plafond ${label}`, [{ name: 'Standard', price: 1_000, total: 10 }]);
}

/** 10 000 F + 100 F : service 505, total 10 605, agrégateur 159,08, net 345,92 (contrat 6.3). */
async function twoPriceEvent(label: string): Promise<SaleEvent> {
    return createPartnerEvent(partner.partnerId, `plafond ${label}`, [{ name: 'Gros', price: 10_000, total: 5 }, { name: 'Petit', price: 100, total: 5 }]);
}

async function commissionsOf(paymentId: string): Promise<Row[]> {
    const { data, error } = await service.from('referral_commissions').select('*').eq('payment_id', paymentId).order('created_at');
    assert.equal(error, null, `commissions du paiement ${paymentId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

function only(rows: Row[], pred: (c: Row) => boolean, what: string): Row {
    const found = rows.filter(pred);
    assert.equal(found.length, 1, `${what} : ${found.length} ligne(s) — ${JSON.stringify(rows.map(brief))}`);
    return found[0];
}

const original = (rows: Row[], generation: 'N1' | 'N2'): Row =>
    only(rows, (c) => c.generation === generation && kindOf(c) === 'COMMISSION' && c.replaces_id === null, `commission ${generation} d'origine`);

/** Colonne de trace (L38) ; son absence est nommée au lieu de passer pour un undefined. */
function uncappedOf(c: Row): unknown {
    assert.ok(Object.prototype.hasOwnProperty.call(c, 'uncapped_amount'), `colonne referral_commissions.uncapped_amount absente — contrat 2.7, ${M4}`);
    return c.uncapped_amount;
}

/** L'écriture COMMISSION du grand livre porte le montant plafonné, et le solde du parrain aussi. */
async function assertCredited(who: Buyer, c: Row): Promise<void> {
    const credit = (await ledgerOf(who.userId, 'PARRAINAGE')).filter((e) => e.commission_id === c.id && e.entry_type === 'COMMISSION');
    assert.deepEqual(credit.map((e) => cents(e.amount)), [cents(c.amount)], `grand livre ${String(c.generation)} = commission`);
    const b = await balanceOf(who.userId, 'PARRAINAGE');
    assert.equal(cents(b.available) + cents(b.pending), cents(c.amount), `solde PARRAINAGE ${String(c.generation)} = commission`);
}

async function assertBalanceZero(who: Buyer, label: string): Promise<void> {
    const b = await balanceOf(who.userId, 'PARRAINAGE');
    assert.deepEqual([cents(b.available), cents(b.pending)], [0, 0], `solde PARRAINAGE ${label} : ${JSON.stringify(b)}`);
}

/** Aucune ligne de l'invariant (r) sur ce paiement. */
async function assertInvariantR(paymentId: string): Promise<void> {
    assert.deepEqual((await recetteViolations()).filter((v) => v.regle === 'r' && v.objet === paymentId), [], `invariant (r) sur le paiement ${paymentId}`);
}

/** Remboursement d'un billet par la route partenaire, puis envoi du cashout (mode succès du faux : confirmé aussitôt). */
async function refundTicket(ev: SaleEvent, ticketId: string, paymentId: string): Promise<void> {
    const mod = (await importModule(REFUND_ROUTE)) as { POST?: Handler };
    assert.ok(mod.POST, 'route POST /api/partner/events/[id]/tickets/[ticketId]/refund absente');
    const res = await mod.POST(
        jsonRequest(`/api/partner/events/${ev.eventId}/tickets/${ticketId}/refund`, 'POST', partner.accessToken, { reason: 'Remboursement demandé (test du plafond)' }),
        routeContext({ id: ev.eventId, ticketId }),
    );
    const body = await res.text();
    assert.ok(res.status >= 200 && res.status < 300, `remboursement du billet ${ticketId} : HTTP ${res.status} ${body.slice(0, 300)}`);
    const { data, error } = await service.from('cashouts').select('id').eq('payment_id', paymentId).eq('status', 'A_ENVOYER');
    assert.equal(error, null, `cashouts du paiement : ${error?.message}`);
    for (const c of data ?? []) await CashoutService.send(String(c.id));
}

const ticketPriced = (p: Purchase, price: number): string => {
    const found = p.tickets.filter((t) => Number(t.price) === price);
    assert.equal(found.length, 1, `billet à ${price} F : ${JSON.stringify(p.tickets.map((t) => t.price))}`);
    return String(found[0].id);
};

// ── À la vente ─────────────────────────────────────────────────────────────

describe('8.2 c — plafond à la vente : N1 = min(calcul, net), N2 = min(calcul, net − N1)', () => {
    test('1. relation à 80/30 sur 1 000 F : N1 27,40 F, N2 6,85 F, uncapped_amount 10,28 F, grand livre égal', async () => {
        const c = await chain('80-30', { n1: 80, n2: 30 });
        const p = await buyConfirmed(c.filleul, await standardEvent('80-30'), [['Standard', 1]]);
        assert.equal(cents(p.payment.net_event_village_revenue), 3425, 'revenu net EV');
        const rows = await commissionsOf(p.payment.id);
        const n1 = original(rows, 'N1');
        const n2 = original(rows, 'N2');
        assert.equal(cents(n1.amount), 2740, `N1 : ${JSON.stringify(n1.amount)}`);
        assert.equal(cents(n2.amount), 685, `N2 plafonnée au reste du net (34,25 − 27,40), calculée ${String(n2.amount)} F`);
        assert.equal(cents(n1.amount) + cents(n2.amount), 3425, 'somme = net');
        assert.equal(uncappedOf(n1), null, 'N1 non plafonnée : aucune trace');
        assert.equal(cents(uncappedOf(n2)), 1028, 'uncapped_amount de N2 : le montant calculé (§106)');
        assert.deepEqual([Number(n2.commission_rate), cents(n2.eligible_net_revenue)], [30, 3425], 'taux et base recopiés');
        await assertCredited(c.n1, n1);
        await assertCredited(c.n2, n2);
        await assertInvariantR(p.payment.id);
    });

    test('2. relation à 100/100 : N1 = net, aucune ligne N2', async () => {
        const c = await chain('100-100', { n1: 100, n2: 100 });
        const p = await buyConfirmed(c.filleul, await standardEvent('100-100'), [['Standard', 1]]);
        const rows = await commissionsOf(p.payment.id);
        assert.deepEqual(rows.map((r) => [r.generation, cents(r.amount)]), [['N1', 3425]], `une seule ligne, N1 = net : ${JSON.stringify(rows.map(brief))}`);
        assert.equal(uncappedOf(rows[0]), null, 'calcul égal au net : pas de plafonnement');
        await assertCredited(c.n1, rows[0]);
        await assertBalanceZero(c.n2, 'N2');
        await assertInvariantR(p.payment.id);
    });

    test('2 bis. relation à 120/10 : N1 plafonnée au net avec sa trace, aucune ligne N2', async () => {
        const c = await chain('120-10', { n1: 120, n2: 10 });
        const p = await buyConfirmed(c.filleul, await standardEvent('120-10'), [['Standard', 1]]);
        const rows = await commissionsOf(p.payment.id);
        assert.deepEqual(rows.map((r) => [r.generation, cents(r.amount)]), [['N1', 3425]], `N1 = net, calculée 41,10 F : ${JSON.stringify(rows.map(brief))}`);
        assert.equal(cents(uncappedOf(rows[0])), 4110, 'uncapped_amount de N1');
        await assertCredited(c.n1, rows[0]);
        await assertInvariantR(p.payment.id);
    });

    test('3. témoin : la grille 5/2 donne 1,71 F et 0,69 F, sans trace de plafond', async () => {
        const c = await chain('grille');
        const p = await buyConfirmed(c.filleul, await standardEvent('grille'), [['Standard', 1]]);
        const rows = await commissionsOf(p.payment.id);
        const n1 = original(rows, 'N1');
        const n2 = original(rows, 'N2');
        assert.deepEqual([cents(n1.amount), cents(n2.amount)], [171, 69], 'montants de la grille inchangés');
        assert.deepEqual([uncappedOf(n1), uncappedOf(n2)], [null, null], 'uncapped_amount nul sauf plafonnement');
    });

    test('4. frais à 0 % : net négatif, aucune commission, aucune violation de (r)', async () => {
        const c = await chain('zero');
        const ev = await standardEvent('zero');
        const p = await withSettings({ 'finance.service_fee_rate': 0 }, () => buyConfirmed(c.filleul, ev, [['Standard', 1]]));
        assert.equal(cents(p.payment.net_event_village_revenue), -1500, 'net = −agrégateur (1,5 % de 1 000 F)');
        assert.deepEqual(await commissionsOf(p.payment.id), [], 'aucune commission sans revenu net');
        await assertInvariantR(p.payment.id);
    });
});

// ── Au remboursement ───────────────────────────────────────────────────────

describe('8.2 c — plafond au remboursement partiel : budget = max(net − net remboursé, 0)', () => {
    test('5. panier 10 000 + 100 F, remboursement du gros billet, net effectif −154,08 F : commissions annulées, soldes à 0', async () => {
        const c = await chain('panier');
        const ev = await twoPriceEvent('panier');
        const p = await buyConfirmed(c.filleul, ev, [['Gros', 1], ['Petit', 1]]);
        assert.equal(cents(p.payment.net_event_village_revenue), 34592, 'revenu net EV');
        const before0 = await commissionsOf(p.payment.id);
        assert.deepEqual([cents(original(before0, 'N1').amount), cents(original(before0, 'N2').amount)], [1730, 692], 'commissions à la vente');

        await refundTicket(ev, ticketPriced(p, 10_000), p.payment.id);

        const now = await paymentRow(p.payment.id);
        assert.equal(now.status, 'PARTIAL', 'paiement partiellement remboursé');
        assert.equal(cents(now.refunded_net_revenue), 50000, 'réversion du service du gros billet');
        const rows = await commissionsOf(p.payment.id);
        const active = rows.filter((r) => kindOf(r) === 'COMMISSION' && r.status !== 'CANCELLED');
        assert.deepEqual(active.map(brief), [], 'aucune commission restante sur un net effectif négatif (aujourd’hui 0,17 F + 0,07 F)');
        for (const generation of ['N1', 'N2'] as const) {
            assert.deepEqual([original(rows, generation).status, original(rows, generation).cancellation_reason], ['CANCELLED', 'REMBOURSEMENT'], `${generation} annulée pour remboursement`);
        }
        assert.equal(rows.length, 2, `aucune ligne de remplacement : ${JSON.stringify(rows.map(brief))}`);
        await assertBalanceZero(c.n1, 'N1');
        await assertBalanceZero(c.n2, 'N2');
        await assertInvariantR(p.payment.id);
    });

    test('6. même panier, N1 déjà versée par un retrait : régularisation jusqu’à 0, créance du déjà versé', async () => {
        const c = await chain('versee');
        const ev = await twoPriceEvent('versee');
        const p = await buyConfirmed(c.filleul, ev, [['Gros', 1], ['Petit', 1]]);
        const n1 = original(await commissionsOf(p.payment.id), 'N1');
        assert.equal(cents(n1.amount), 1730, 'N1 à la vente');

        // Délai écoulé, puis retrait de parrainage de 17 F : N1 versée à hauteur de 17 F sur 17,30 F (comme finance-commissions:401)
        const past = new Date(Date.now() - 60_000).toISOString();
        const { error: aged } = await service.from('referral_commissions').update({ available_at: past, status: 'AVAILABLE' }).eq('id', n1.id);
        assert.equal(aged, null, `échéance de N1 : ${aged?.message}`);
        const { error: agedLedger } = await service.from('finance_ledger').update({ available_at: past }).eq('commission_id', n1.id).eq('entry_type', 'COMMISSION');
        assert.equal(agedLedger, null, `échéance au grand livre : ${agedLedger?.message}`);
        const w = await withSettings({ 'finance.withdrawal_min_amount': 0 }, async () => {
            const { data, error } = await service.rpc('withdrawal_request', {
                p: { user_id: c.n1.userId, account_kind: 'PARRAINAGE', gross_amount: 17, method: 'MOBILE_MONEY', operator: 'WAVE', phone_number: c.n1.phone9, client_key: randomUUID() },
            });
            assert.equal(error, null, `withdrawal_request : ${error?.message}`);
            assert.equal((data as Row | null)?.ok, true, `retrait de 17 F : ${JSON.stringify(data)}`);
            return data as Row;
        });
        if (w.cashout_id) await CashoutService.send(String(w.cashout_id));
        const paid = only(await commissionsOf(p.payment.id), (r) => r.id === n1.id, 'N1');
        assert.equal(cents(paid.paid_amount), 1700, 'précondition : N1 versée à hauteur de 17 F');

        await refundTicket(ev, ticketPriced(p, 10_000), p.payment.id);

        const rows = await commissionsOf(p.payment.id);
        const reguls = rows.filter((r) => kindOf(r) === 'REGULARISATION' && r.regularizes_id === n1.id);
        assert.deepEqual(reguls.map((r) => cents(r.amount)), [-1730], `régularisation jusqu’à 0 (aujourd’hui −17,13 F) : ${JSON.stringify(rows.map(brief))}`);
        const kept = only(rows, (r) => r.id === n1.id, 'N1');
        assert.notEqual(kept.status, 'CANCELLED', 'une commission versée n’est pas annulée');
        assert.equal(cents(kept.amount), 1730, 'ligne d’origine inchangée');
        assert.deepEqual([original(rows, 'N2').status, original(rows, 'N2').cancellation_reason], ['CANCELLED', 'REMBOURSEMENT'], 'N2, jamais versée : annulée');

        const { data: debts, error } = await service.from('finance_debts').select('remaining').eq('owner_id', c.n1.userId).eq('account_kind', 'PARRAINAGE');
        assert.equal(error, null, `créances : ${error?.message}`);
        assert.equal((debts ?? []).reduce((s, d) => s + cents(d.remaining), 0), 1700, 'créance = le déjà versé');
        await assertBalanceZero(c.n1, 'N1');
        await assertBalanceZero(c.n2, 'N2');
        await assertInvariantR(p.payment.id);
    });

    test('7. témoin : 2 billets de 1 000 F, un remboursé : prorata inchangé, 1,72 F et 0,69 F (finance-commissions:375)', async () => {
        const c = await chain('prorata');
        const ev = await standardEvent('prorata');
        const p = await buyConfirmed(c.filleul, ev, [['Standard', 2]]);
        await refundTicket(ev, String(p.tickets[0].id), p.payment.id);

        const rows = await commissionsOf(p.payment.id);
        const active = rows.filter((r) => kindOf(r) === 'COMMISSION' && r.status !== 'CANCELLED');
        assert.deepEqual(active.map((r) => [r.generation, cents(r.amount)]).sort(), [['N1', 172], ['N2', 69]], `prorata : ${JSON.stringify(rows.map(brief))}`);
        for (const generation of ['N1', 'N2'] as const) {
            assert.match(String(original(rows, generation).cancellation_reason), /RECALCUL_PRORATA/, `${generation} : motif`);
        }
    });

    test('8. relation à 80/30, 2 billets de 1 000 F, un remboursé : budget 18,50 F, N1 coupée avec sa trace, N2 annulée', async () => {
        const c = await chain('budget', { n1: 80, n2: 30 });
        const ev = await standardEvent('budget');
        const p = await buyConfirmed(c.filleul, ev, [['Standard', 2]]);
        assert.equal(cents(p.payment.net_event_village_revenue), 6850, 'revenu net EV');
        const at0 = await commissionsOf(p.payment.id);
        assert.deepEqual([cents(original(at0, 'N1').amount), cents(original(at0, 'N2').amount)], [5480, 1370], 'à la vente : N2 = net − N1');

        await refundTicket(ev, String(p.tickets[0].id), p.payment.id);

        assert.equal(cents((await paymentRow(p.payment.id)).refunded_net_revenue), 5000, 'réversion : 50 F de service');
        const rows = await commissionsOf(p.payment.id);
        const active = rows.filter((r) => kindOf(r) === 'COMMISSION' && r.status !== 'CANCELLED');
        assert.deepEqual(active.map((r) => [r.generation, cents(r.amount)]), [['N1', 1850]], `budget 68,50 − 50 = 18,50 F, consommé par N1 : ${JSON.stringify(rows.map(brief))}`);
        assert.equal(cents(uncappedOf(active[0])), 2740, 'uncapped_amount de la ligne de remplacement : le prorata coupé');
        assert.equal(active[0].replaces_id, original(rows, 'N1').id, 'ligne de remplacement de N1');
        assert.deepEqual([original(rows, 'N2').status, original(rows, 'N2').cancellation_reason], ['CANCELLED', 'REMBOURSEMENT'], 'budget épuisé : N2 annulée');
        await assertCredited(c.n1, active[0]);
        await assertBalanceZero(c.n2, 'N2');
        await assertInvariantR(p.payment.id);
    });
});
