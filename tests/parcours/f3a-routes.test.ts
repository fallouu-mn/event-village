/**
 * Finition 3a (argent de l'administration), points 2 à 4 — routes de la page Finance et de l'accueil :
 *  - GET /api/admin/finance/summary : payments.read ; période unique (Dakar) ; le filtre de statut ne change jamais les
 *    chiffres du haut ; « Retirable par Event Village » au SUPERADMIN seulement, solde SamirPay lu par le serveur avec un
 *    cache de 5 minutes et l'heure de lecture ; solde illisible : aucun chiffre ; jamais négatif ;
 *  - bout en bout par le vrai moteur : achat de 2 billets, remboursement d'un billet, versement confirmé avec frais réels,
 *    retrait versé : les trois chiffres bougent exactement de ce que disent les lignes écrites ;
 *  - GET …/payments (pages de 20, filtre de statut), …/debts, …/refunds-to-pay (numéro masqué), …/owed ;
 *  - GET …/waiting : bloc « Argent qui attend », chaque ligne selon sa permission ;
 *  - GET /api/admin/metrics : le même « Gagné par Event Village » (mois en cours) que la page Finance ;
 *  - la table du cache du solde n'est lisible ni par anon ni par un compte connecté.
 * Rouge avant correctif : routes et modules absents (import en échec).
 * Fin de suite : invariants de toutes les livraisons et de la finition (assertFinition3aInvariants).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { CashoutService } from '../../lib/payments/cashout.service';
import { inspect, writeLocal } from '../helpers/db';
import { assertFinition3aInvariants } from '../helpers/finition3a-invariants';
import { buyConfirmed, createPartnerEvent, jsonRequest, newPartner, withSettings, type TestPartner } from './finance-helpers';
import { newAdmin, type TestAdmin } from './notif-helpers';
import { fakePay, importModule, newBuyer, service } from './paiement-helpers';

type Row = Record<string, unknown>;
type Handler = (req: NextRequest) => Promise<Response>;

let reader: TestAdmin;
let refunder: TestAdmin;
let nobody: TestAdmin;
let superadmin: TestAdmin;
const FULL_BALANCE = 10_000_000;

before(async () => {
    reader = await newAdmin('f3a-lecteur', ['payments.read', 'statistics.read']);
    refunder = await newAdmin('f3a-versements', ['refunds.manage']);
    nobody = await newAdmin('f3a-aucun', []);
    superadmin = await newAdmin('f3a-routes-super', [], { role: 'SUPERADMIN' });
    fakePay().balance = FULL_BALANCE;
    fakePay().cashoutFeeRate = null;
    await clearBalanceCache();
});

after(async () => {
    fakePay().balance = FULL_BALANCE;
    fakePay().cashoutFeeRate = null;
    await assertFinition3aInvariants('f3a-routes');
});

// ── Outils ─────────────────────────────────────────────────────────────────

const cents = (x: unknown): number => Math.round(Number(x) * 100);

async function call(route: string, path: string, token: string): Promise<{ status: number; body: Row }> {
    const { GET } = await importModule(route) as { GET: Handler };
    const res = await GET(jsonRequest(path, 'GET', token));
    return { status: res.status, body: (await res.json()) as Row };
}

async function ok(route: string, path: string, token: string): Promise<Row> {
    const r = await call(route, path, token);
    assert.equal(r.status, 200, `${path} : HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 400)}`);
    return r.body;
}

const SUMMARY = '../../app/api/admin/finance/summary/route';
const PAYMENTS = '../../app/api/admin/finance/payments/route';
const DEBTS = '../../app/api/admin/finance/debts/route';
const REFUNDS = '../../app/api/admin/finance/refunds-to-pay/route';
const OWED = '../../app/api/admin/finance/owed/route';
const WAITING = '../../app/api/admin/finance/waiting/route';
const METRICS = '../../app/api/admin/metrics/route';

async function clearBalanceCache(): Promise<void> {
    await writeLocal(async (c) => {
        const { rows } = await c.query<{ ok: boolean }>(`SELECT to_regclass('public.samirpay_balance_reads') IS NOT NULL AS ok`);
        if (rows[0]?.ok) await c.query('DELETE FROM public.samirpay_balance_reads');
    });
}

function soldeCalls(): number {
    return (fakePay().calls as Array<{ method: string }>).filter((c) => c.method === 'getSolde').length;
}

function block(body: Row, ...keys: string[]): Row {
    let cur: unknown = body;
    for (const k of keys) cur = (cur as Row | undefined)?.[k];
    assert.ok(cur && typeof cur === 'object', `bloc ${keys.join('.')} absent : ${JSON.stringify(body).slice(0, 300)}`);
    return cur as Row;
}

// ── Synthèse ───────────────────────────────────────────────────────────────

describe('GET /api/admin/finance/summary — droits, période, chiffres du haut', () => {
    test('ADMIN avec payments.read : synthèse du mois, sans « Retirable » ni lecture du solde SamirPay', async () => {
        const before = soldeCalls();
        const body = await ok(SUMMARY, '/api/admin/finance/summary', reader.accessToken);
        assert.equal(block(body, 'period').key, 'month', 'période par défaut : ce mois-ci');
        for (const k of ['earned', 'owed_partners', 'owed_referrers', 'debts', 'refunds_to_pay', 'reserve']) block(body, 'summary', k);
        assert.deepEqual(body.withdrawable, { visible: false }, 'retirable montré à un ADMIN');
        assert.equal(soldeCalls(), before, 'solde SamirPay lu pour un ADMIN');
    });

    test('sans payments.read : 403, permission nommée', async () => {
        const r = await call(SUMMARY, '/api/admin/finance/summary', refunder.accessToken);
        assert.equal(r.status, 403, JSON.stringify(r.body));
        assert.deepEqual([r.body.code, r.body.permission], ['PERMISSION_MISSING', 'payments.read']);
    });

    test('période refusée en français (400), dates libres admises', async () => {
        const bad = await call(SUMMARY, '/api/admin/finance/summary?period=semaine', reader.accessToken);
        assert.deepEqual([bad.status, bad.body.code], [400, 'INVALID_PERIOD'], JSON.stringify(bad.body));
        const inv = await call(SUMMARY, '/api/admin/finance/summary?period=custom&from=2026-11-12&to=2026-11-03', reader.accessToken);
        assert.equal(inv.status, 400, JSON.stringify(inv.body));
        const custom = await ok(SUMMARY, '/api/admin/finance/summary?period=custom&from=2026-01-01&to=2026-01-31', reader.accessToken);
        assert.deepEqual([block(custom, 'period').from, block(custom, 'period').to], ['2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z']);
    });

    test('le filtre de statut ne change jamais les chiffres du haut', async () => {
        const plain = await ok(SUMMARY, '/api/admin/finance/summary?period=30d', reader.accessToken);
        const filtered = await ok(SUMMARY, '/api/admin/finance/summary?period=30d&status=REFUNDED', reader.accessToken);
        assert.deepEqual(block(filtered, 'summary', 'earned'), block(plain, 'summary', 'earned'), 'gagné changé par le filtre de statut');
    });
});

describe('« Retirable par Event Village » : SUPERADMIN, solde en cache de 5 minutes, jamais négatif', () => {
    test('solde lu une fois, heure de lecture rendue, puis servi par le cache ; relu après 5 minutes', async () => {
        await clearBalanceCache();
        fakePay().balance = FULL_BALANCE;
        const before = soldeCalls();
        const first = await ok(SUMMARY, '/api/admin/finance/summary', superadmin.accessToken);
        const w1 = block(first, 'withdrawable');
        assert.equal(w1.visible, true);
        assert.equal(soldeCalls(), before + 1, 'solde SamirPay lu une fois');
        const bal = block(first, 'withdrawable', 'balance');
        assert.equal(cents(bal.solde), cents(FULL_BALANCE), `solde : ${JSON.stringify(bal)}`);
        assert.ok(!Number.isNaN(Date.parse(String(bal.readAt))), `heure de lecture : ${JSON.stringify(bal)}`);
        assert.equal(bal.cached, false);
        const s = block(first, 'summary');
        const expected = Math.max(cents(FULL_BALANCE) - cents(block(s, 'owed_partners').total) - cents(block(s, 'owed_referrers').total)
            - cents(block(s, 'refunds_to_pay').total) - cents(block(s, 'reserve').amount), 0);
        assert.equal(cents(w1.amount), expected, `retirable : ${JSON.stringify(w1)}`);

        const second = await ok(SUMMARY, '/api/admin/finance/summary', superadmin.accessToken);
        assert.equal(soldeCalls(), before + 1, 'solde relu malgré le cache de 5 minutes');
        assert.equal(block(second, 'withdrawable', 'balance').cached, true);

        await writeLocal((c) => c.query(`UPDATE public.samirpay_balance_reads SET read_at = now() - interval '6 minutes'`));
        await ok(SUMMARY, '/api/admin/finance/summary', superadmin.accessToken);
        assert.equal(soldeCalls(), before + 2, 'solde non relu après 6 minutes');
    });

    test('solde illisible : aucun chiffre, aucune lecture enregistrée', async () => {
        await clearBalanceCache();
        const fake = fakePay();
        const original = fake.getSolde;
        fake.getSolde = async () => {
            fake.calls.push({ method: 'getSolde', args: { simulated: 'UNAVAILABLE' }, at: new Date().toISOString() });
            throw new Error('Solde SamirPay indisponible (simulation du test)');
        };
        try {
            const body = await ok(SUMMARY, '/api/admin/finance/summary', superadmin.accessToken);
            const w = block(body, 'withdrawable');
            assert.deepEqual([w.visible, w.balance, w.amount], [true, null, null], JSON.stringify(w));
        } finally {
            fake.getSolde = original;
        }
        const { count, error } = await service.from('samirpay_balance_reads').select('id', { count: 'exact', head: true });
        assert.equal(error, null, error?.message);
        assert.equal(count, 0, 'lecture en échec enregistrée');
    });

    test('compte vide : 0 retirable, jamais négatif, le manque rendu à part', async () => {
        await clearBalanceCache();
        fakePay().balance = 0;
        try {
            const body = await ok(SUMMARY, '/api/admin/finance/summary', superadmin.accessToken);
            const w = block(body, 'withdrawable');
            assert.equal(cents(w.amount), 0, JSON.stringify(w));
            const s = block(body, 'summary');
            const due = cents(block(s, 'owed_partners').total) + cents(block(s, 'owed_referrers').total) + cents(block(s, 'refunds_to_pay').total) + cents(block(s, 'reserve').amount);
            assert.equal(cents(w.shortfall), due, `manque : ${JSON.stringify(w)}`);
        } finally {
            fakePay().balance = FULL_BALANCE;
            await clearBalanceCache();
        }
    });

    test('la table du cache n’est lisible ni par anon ni par un compte connecté', async () => {
        for (const role of ['anon', 'authenticated'] as const) {
            await assert.rejects(() => inspect((c) => c.query('SELECT count(*) FROM public.samirpay_balance_reads'), role), /permission denied/i, `${role} lit le cache du solde`);
        }
    });
});

describe('bout en bout par le vrai moteur : les chiffres bougent exactement', () => {
    test('achat de 2 billets, remboursement d’un billet (agrégateur à l’organisatrice), versement avec frais réels, retrait versé', async () => {
        await withSettings({
            'finance.service_fee_rate': 5, 'finance.aggregator_fee_rate.WAVE': 1.5, 'finance.withdrawal_fee_rate': 1,
            'finance.withdrawal_min_amount': 100, 'finance.payout_hold_enabled': false,
            'finance.cancellation_aggregator_fee_bearer': 'ORGANISATEUR',
        }, async () => {
            const partner: TestPartner = await newPartner('f3a-moteur');
            const ev = await createPartnerEvent(partner.partnerId, 'f3a moteur', [{ name: 'Standard', price: 10_000, total: 10 }]);
            const s0 = block(await ok(SUMMARY, '/api/admin/finance/summary?period=today', reader.accessToken), 'summary');

            const sale = await buyConfirmed(await newBuyer('f3a-moteur'), ev, [['Standard', 2]]);
            const ticketId = String(sale.tickets[0].id);
            const { data: refund, error: rErr } = await service.rpc('ticket_refund_request', { p_ticket_id: ticketId, p_actor: partner.userId, p_reason: 'Essai de la finition 3a' });
            assert.equal(rErr, null, `ticket_refund_request : ${rErr?.message}`);
            assert.equal((refund as Row).mode, 'CASHOUT', JSON.stringify(refund));
            const mid = block(await ok(SUMMARY, '/api/admin/finance/summary?period=today', reader.accessToken), 'summary');
            assert.equal(cents(block(mid, 'refunds_to_pay').total) - cents(block(s0, 'refunds_to_pay').total), 1_050_000, 'remboursement à verser : 10 500');

            fakePay().cashoutFeeRate = 1.5;
            const sentRefund = await CashoutService.send(String((refund as Row).cashout_id));
            assert.equal(sentRefund.status, 'CONFIRME', JSON.stringify(sentRefund));
            const { data: w, error: wErr } = await service.rpc('withdrawal_request', {
                p: { user_id: partner.userId, account_kind: 'ORGANISATEUR', gross_amount: 5_000, method: 'MOBILE_MONEY', operator: 'WAVE', phone_number: partner.phone9, client_key: randomUUID() },
            });
            assert.equal(wErr, null, `withdrawal_request : ${wErr?.message}`);
            assert.equal((w as Row).ok, true, JSON.stringify(w));
            const sentW = await CashoutService.send(String((w as Row).cashout_id));
            assert.equal(sentW.status, 'CONFIRME', JSON.stringify(sentW));
            fakePay().cashoutFeeRate = null;

            const { data: fees, error: fErr } = await service.from('cashouts').select('samirpay_fees')
                .in('id', [String((refund as Row).cashout_id), String((w as Row).cashout_id)]);
            assert.equal(fErr, null, fErr?.message);
            const realFees = (fees ?? []).reduce((t, r) => t + cents(r.samirpay_fees), 0);
            assert.ok(realFees > 0, `frais réels enregistrés : ${JSON.stringify(fees)}`);

            const s1 = block(await ok(SUMMARY, '/api/admin/finance/summary?period=today', reader.accessToken), 'summary');
            const d = (b: string, k: string): number => cents(block(s1, b)[k]) - cents(block(s0, b)[k]);
            // Net 685 (frais 1 000 − agrégateur 315) − part annulée 342,50 (500 − 157,50) + frais de retrait 50 − frais réels
            assert.equal(d('earned', 'service_net'), 34_250, 'frais de service nets : 685 − 342,50');
            assert.equal(d('earned', 'withdrawal_fees'), 5_000, 'frais de retrait : 1 % de 5 000');
            assert.equal(d('earned', 'samirpay_fees'), realFees, 'frais réels des deux versements');
            assert.equal(d('earned', 'total'), 34_250 + 5_000 - realFees, 'gagné par Event Village');
            // Grand livre : vente 20 000 − remboursement 10 157,50 (prix + part d'agrégateur) − retrait 5 000 ; rien en cours
            assert.equal(d('owed_partners', 'total'), 484_250, 'dû aux partenaires : + 4 842,50');
            assert.equal(d('refunds_to_pay', 'total'), 0, 'plus rien à verser');
            assert.equal(d('debts', 'total'), 0, 'aucune créance');
        });
    });
});

// ── Détail et accueil ──────────────────────────────────────────────────────

describe('détail : paiements paginés, créances, remboursements à verser, dû par compte', () => {
    test('paiements : 20 par page, statuts encaissés seulement, filtre REFUNDED, refus en français', async () => {
        const all = await ok(PAYMENTS, '/api/admin/finance/payments?period=30d', reader.accessToken);
        assert.equal(all.pageSize, 20);
        assert.ok((all.items as Row[]).length <= 20, 'plus de 20 lignes');
        assert.ok((all.items as Row[]).every((r) => ['SUCCESS', 'PARTIAL', 'REFUNDED', 'REFUND_PENDING'].includes(String(r.status))), 'statut non encaissé dans la liste');
        const refunded = await ok(PAYMENTS, '/api/admin/finance/payments?period=30d&status=REFUNDED', reader.accessToken);
        assert.ok((refunded.items as Row[]).every((r) => r.status === 'REFUNDED'), 'filtre REFUNDED');
        const far = await ok(PAYMENTS, `/api/admin/finance/payments?period=30d&page=${Number(all.pages) + 1}`, reader.accessToken);
        assert.deepEqual(far.items, [], 'page au-delà de la dernière');
        assert.equal((await call(PAYMENTS, '/api/admin/finance/payments?status=PENDING', reader.accessToken)).status, 400);
        assert.equal((await call(PAYMENTS, '/api/admin/finance/payments?page=0', reader.accessToken)).status, 400);
        assert.equal((await call(PAYMENTS, '/api/admin/finance/payments', refunder.accessToken)).status, 403);
    });

    test('créances, dû par compte : payments.read ; mots, jamais de code', async () => {
        const debts = await ok(DEBTS, '/api/admin/finance/debts', reader.accessToken);
        for (const r of debts.items as Row[]) {
            assert.doesNotMatch(`${String(r.reason)} ${String(r.whoKind)}`, /[A-Z]{3,}_[A-Z]/, `code technique : ${JSON.stringify(r)}`);
        }
        const owed = await ok(OWED, '/api/admin/finance/owed?kind=PARRAINAGE', reader.accessToken);
        assert.equal(owed.kind, 'PARRAINAGE');
        assert.equal((await call(OWED, '/api/admin/finance/owed?kind=CLIENT', reader.accessToken)).status, 400);
        assert.equal((await call(DEBTS, '/api/admin/finance/debts', refunder.accessToken)).status, 403);
    });

    test('remboursements à verser : refunds.manage ou payments.read ; numéro masqué', async () => {
        const body = await ok(REFUNDS, '/api/admin/finance/refunds-to-pay', refunder.accessToken);
        assert.doesNotMatch(JSON.stringify(body), /\b7[05678][0-9]{7}\b/, 'numéro complet dans la réponse');
        await ok(REFUNDS, '/api/admin/finance/refunds-to-pay', reader.accessToken);
        const denied = await call(REFUNDS, '/api/admin/finance/refunds-to-pay', nobody.accessToken);
        assert.equal(denied.status, 403, JSON.stringify(denied.body));
    });

    test('accueil, « Argent qui attend » : chaque ligne selon sa permission', async () => {
        const lines = (b: Row): Row => block(b, 'lines');
        const asRefunder = lines(await ok(WAITING, '/api/admin/finance/waiting', refunder.accessToken));
        assert.deepEqual([block(asRefunder, 'toResume').visible, block(asRefunder, 'refundsToPay').visible, block(asRefunder, 'debts').visible], [true, true, false]);
        const asReader = lines(await ok(WAITING, '/api/admin/finance/waiting', reader.accessToken));
        assert.deepEqual([block(asReader, 'toResume').visible, block(asReader, 'refundsToPay').visible, block(asReader, 'debts').visible], [false, true, true]);
        const asNobody = lines(await ok(WAITING, '/api/admin/finance/waiting', nobody.accessToken));
        assert.deepEqual([block(asNobody, 'toResume').visible, block(asNobody, 'refundsToPay').visible, block(asNobody, 'debts').visible], [false, false, false]);
        const asSuper = lines(await ok(WAITING, '/api/admin/finance/waiting', superadmin.accessToken));
        for (const k of ['toResume', 'refundsToPay', 'debts']) {
            const l = block(asSuper, k);
            assert.deepEqual([l.visible, l.unavailable], [true, false], `${k} : ${JSON.stringify(l)}`);
            assert.ok(Number.isInteger(l.count) && Number.isFinite(Number(l.amount)), `${k} : ${JSON.stringify(l)}`);
        }
    });
});

describe('accueil : un seul « revenu », le même que « Gagné par Event Village »', () => {
    test('/api/admin/metrics : gagné du mois = finance_admin_earned du mois en cours (Dakar)', async () => {
        const body = await ok(METRICS, '/api/admin/metrics', reader.accessToken);
        const kpis = block(body, 'kpis');
        const month = block(kpis, 'month');
        const { data, error } = await service.rpc('finance_admin_earned', { p_from: month.from, p_to: month.to });
        assert.equal(error, null, error?.message);
        assert.equal(cents(kpis.earnedMonth), cents((data as Row).total), 'gagné du mois');
        assert.equal(cents(kpis.encashedMonth), cents((data as Row).volume), 'encaissé du mois');
        assert.equal(month.label, 'Ce mois-ci');
        assert.equal('recentAuditLogs' in body, false);
    });
});
