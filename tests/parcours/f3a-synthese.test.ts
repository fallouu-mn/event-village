/**
 * Finition 3a (argent de l'administration), point 2 — les trois chiffres (E-06, E-38) : une seule fonction serveur de
 * synthèse, finance_admin_summary(p_from, p_to) (bloc « gagné » : finance_admin_earned), testée sur des cas construits
 * à la main.
 *
 * Méthode : chaque cas est écrit en base LOCALE dans UNE transaction annulée en lecture répétable (rien ne reste) :
 *  - « Gagné » porte sur une fenêtre isolée, du 1er mars 2001 au 1er avril 2001 (heure de Dakar = UTC) : aucune autre
 *    donnée n'y tombe, le montant attendu est donc exact ;
 *  - les chiffres « à l'instant » (dû aux partenaires et aux parrains, créances, remboursements à verser, réserve) sont
 *    lus avant et après les écritures, dans le même instantané : l'écart attendu est exact.
 * Montants attendus écrits en dur (jamais recalculés en flottant).
 *
 * Cas de « Gagné » (fenêtre de mars 2001) :
 *  P1 paiement simple : 21 000 payés, frais de service 1 000, agrégateur 315, net 685 ; commission N1 34,25 → +650,75
 *  P2 remboursement total, frais d'agrégateur gardés par Event Village (part du net annulée = frais de service 500) → −157,50
 *  P3 remboursement partiel d'un billet sur deux, agrégateur à la charge de l'organisatrice (part annulée 500 − 157,50) :
 *     685 − 342,50 = 342,50 ; commission 34,25 annulée et remplacée au prorata par 17,13 → +325,37
 *  P4 remboursement total (−157,50) ; commission 17,13 déjà versée, régularisée (−17,13) mais 10,00 non récupérés
 *     (créance PARRAINAGE ouverte sur le paiement) → −167,50
 *  P5 3e paiement en double, remboursé moins les frais de l'opérateur (retenue 157,50) → 0
 *  W1 retrait versé : frais de retrait 100 ; son versement a coûté 148,50 de frais SamirPay réels → −48,50
 *  C2 remboursement d'annulation : 150 de frais réels, repris en entier à l'organisatrice (écriture CASHOUT_FEE) → 0
 *  C3 remboursement d'annulation : 120 de frais réels, passés en créance dont 40 déjà récupérés → −80
 *  Hors calcul : paiement de février (fin de fenêtre), d'avril (borne exclue), en échec, en espèces ; versement confirmé
 *  en avril ; versement confirmé sans frais connus ; retrait refusé ; retrait en attente.
 *  Total : 522,62 = 712,50 (frais de service nets : 2 397,50 − 1 842,50 + 157,50) + 100 − 418,50 − 51,38 − 10,00 + 190.
 *
 * Rouge avant correctif : finance_admin_summary et finance_admin_earned n'existent pas (fonctions absentes).
 * Fin de suite : invariants de toutes les livraisons précédentes et de la finition (assertFinition3aInvariants).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { inRolledBackTransaction } from '../helpers/db';
import { assertFinition3aInvariants } from '../helpers/finition3a-invariants';
import { newPartner, type TestPartner } from './finance-helpers';
import { newBuyer, type Buyer } from './paiement-helpers';

type Row = Record<string, unknown>;
type Summary = Record<string, Row>;

const FROM = '2001-03-01T00:00:00Z';
const TO = '2001-04-01T00:00:00Z';

let partner: TestPartner;
let buyer: Buyer;
let sponsor: Buyer;

before(async () => {
    partner = await newPartner('f3a-synthese');
    buyer = await newBuyer('f3a-synthese-acheteur');
    sponsor = await newBuyer('f3a-synthese-parrain');
});

after(async () => {
    await assertFinition3aInvariants('f3a-synthese');
});

// ── Outils ─────────────────────────────────────────────────────────────────

const cents = (x: unknown): number => Math.round(Number(x) * 100);

/** Montant en centimes (entier), pour comparer sans flottant. */
function eqAmount(actual: unknown, expected: number, label: string): void {
    assert.equal(cents(actual), Math.round(expected * 100), `${label} : ${String(actual)} au lieu de ${expected}`);
}

async function summaryIn(c: Client, from: string | null, to: string | null): Promise<Summary> {
    const { rows } = await c.query<{ s: Summary }>('SELECT public.finance_admin_summary($1::timestamptz, $2::timestamptz) AS s', [from, to]);
    assert.ok(rows[0]?.s, 'finance_admin_summary : réponse vide');
    return rows[0].s;
}

async function earnedIn(c: Client, from: string | null, to: string | null): Promise<Row> {
    const { rows } = await c.query<{ e: Row }>('SELECT public.finance_admin_earned($1::timestamptz, $2::timestamptz) AS e', [from, to]);
    assert.ok(rows[0]?.e, 'finance_admin_earned : réponse vide');
    return rows[0].e;
}

/** Transaction annulée, lecture répétable : un seul instantané pour l'avant et l'après. */
async function inSnapshot<T>(fn: (c: Client) => Promise<T>): Promise<T> {
    return inRolledBackTransaction(async (c) => {
        await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        return fn(c);
    });
}

interface PaymentSpec {
    amount: number; service: number; agg: number; net: number; refundedNet?: number; refundedAmount?: number;
    status?: string; at: string; platform?: boolean; withheld?: number; payout?: number;
}

async function insertPayment(c: Client, s: PaymentSpec): Promise<string> {
    const id = randomUUID();
    const metadata = s.withheld ? { duplicate_of: randomUUID(), duplicate_fee_withheld: s.withheld, duplicate_rank: 3 } : {};
    await c.query(
        `INSERT INTO public.payments (id, transaction_id, client_id, payment_target, amount, currency, status, is_platform_payment,
                                      paid_at, facial_amount, service_fee, aggregator_fee, gross_event_village_revenue,
                                      net_event_village_revenue, refunded_net_revenue, refunded_amount, partner_payout_amount,
                                      operator, offline_payment_method, aggregator, metadata)
         VALUES ($1, $2, $3, 'TICKET', $4, 'XOF', $5::payment_status_enum, $6, $7::timestamptz, $8, $9, $10, $9, $11, $12, $13, $14,
                 CASE WHEN $6 THEN 'WAVE' END, CASE WHEN $6 THEN NULL ELSE 'ESPECES'::offline_payment_method_enum END,
                 CASE WHEN $6 THEN 'SAMIRPAY' ELSE 'GUICHET' END, $15::jsonb)`,
        [id, `TX-F3A-${id}`, buyer.userId, s.amount, s.status ?? 'SUCCESS', s.platform ?? true, s.at, s.payout ?? s.amount - s.service,
         s.service, s.agg, s.net, s.refundedNet ?? 0, s.refundedAmount ?? 0, s.payout ?? s.amount - s.service, JSON.stringify(metadata)]);
    return id;
}

async function insertCommission(c: Client, paymentId: string, amount: number, opts: { status?: string; kind?: 'COMMISSION' | 'REGULARISATION'; regularizes?: string; replaces?: string } = {}): Promise<string> {
    const id = randomUUID();
    await c.query(
        `INSERT INTO public.referral_commissions (id, sponsor_id, referred_id, generation, referral_type, payment_id, eligible_net_revenue,
                                                  commission_rate, amount, status, idempotency_key, available_at, kind, regularizes_id, replaces_id)
         VALUES ($1, $2, $3, 'N1', 'CLIENT_TO_CLIENT', $4, 685, 5, $5, $6::commission_status_enum, $7, '2001-03-20T00:00:00Z', $8, $9, $10)`,
        [id, sponsor.userId, buyer.userId, paymentId, amount, opts.status ?? 'AVAILABLE', `F3A-${id}`, opts.kind ?? 'COMMISSION',
         opts.regularizes ?? null, opts.replaces ?? null]);
    return id;
}

async function insertCashout(c: Client, s: { kind: string; amount: number; status: string; confirmedAt?: string; fees?: number | null; withdrawalId?: string }): Promise<string> {
    const id = randomUUID();
    await c.query(
        `INSERT INTO public.cashouts (id, kind, idempotency_key, amount, status, confirmed_at, samirpay_fees, withdrawal_id, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8, $6::timestamptz)`,
        [id, s.kind, `F3A-${s.kind}-${id}`, s.amount, s.status, s.confirmedAt ?? null, s.fees ?? null, s.withdrawalId ?? null]);
    return id;
}

async function insertWithdrawal(c: Client, s: { gross: number; fee: number; status: string; processedAt?: string; kind?: string; owner?: string }): Promise<string> {
    const id = randomUUID();
    await c.query(
        `INSERT INTO public.withdrawals (id, user_id, gross_amount, fee_rate, fee_amount, net_amount, withdrawal_method, payment_details,
                                         status, processed_at, account_kind)
         VALUES ($1, $2, $3, 1, $4, $5, 'MOBILE_MONEY', '{}'::jsonb, $6::withdrawal_status_enum, $7::timestamptz, $8)`,
        [id, s.owner ?? partner.userId, s.gross, s.fee, s.gross - s.fee, s.status, s.processedAt ?? null, s.kind ?? 'ORGANISATEUR']);
    return id;
}

async function insertLedger(c: Client, s: { owner: string; kind: 'ORGANISATEUR' | 'PARRAINAGE'; type: string; amount: number; at?: string; sourceKey?: string }): Promise<void> {
    await c.query(
        `INSERT INTO public.finance_ledger (owner_id, account_kind, partner_id, entry_type, amount, available_at, source_key, description)
         VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7, 'Cas construit à la main (finition 3a)')`,
        [s.owner, s.kind, s.kind === 'ORGANISATEUR' ? partner.partnerId : null, s.type, s.amount, s.at ?? '2001-03-02T00:00:00Z',
         s.sourceKey ?? `F3A-${randomUUID()}`]);
}

async function insertDebt(c: Client, s: { owner: string; kind: 'ORGANISATEUR' | 'PARRAINAGE'; amount: number; remaining: number; paymentId?: string; sourceKey?: string }): Promise<void> {
    await c.query(
        `INSERT INTO public.finance_debts (owner_id, account_kind, amount, remaining, reason, payment_id, source_key)
         VALUES ($1, $2, $3, $4, 'Cas construit à la main (finition 3a)', $5, $6)`,
        [s.owner, s.kind, s.amount, s.remaining, s.paymentId ?? null, s.sourceKey ?? `F3A-${randomUUID()}-CREANCE`]);
}

/** Écrit tous les cas du scénario (voir l'en-tête) dans la transaction c. */
async function writeScenario(c: Client): Promise<void> {
    // Paiements de la fenêtre
    const p1 = await insertPayment(c, { amount: 21_000, service: 1_000, agg: 315, net: 685, at: '2001-03-05T10:00:00Z' });
    await insertCommission(c, p1, 34.25);
    await insertPayment(c, { amount: 10_500, service: 500, agg: 157.5, net: 342.5, refundedNet: 500, refundedAmount: 10_500, status: 'REFUNDED', at: '2001-03-06T10:00:00Z' });
    const p3 = await insertPayment(c, { amount: 21_000, service: 1_000, agg: 315, net: 685, refundedNet: 342.5, refundedAmount: 10_500, status: 'PARTIAL', at: '2001-03-07T10:00:00Z' });
    const p3c = await insertCommission(c, p3, 34.25, { status: 'CANCELLED' });
    await insertCommission(c, p3, 17.13, { replaces: p3c });
    const p4 = await insertPayment(c, { amount: 10_500, service: 500, agg: 157.5, net: 342.5, refundedNet: 500, refundedAmount: 10_500, status: 'REFUNDED', at: '2001-03-08T10:00:00Z' });
    const p4c = await insertCommission(c, p4, 17.13, { status: 'PAID' });
    await insertCommission(c, p4, -17.13, { kind: 'REGULARISATION', regularizes: p4c });
    await insertPayment(c, { amount: 10_500, service: 500, agg: 157.5, net: 342.5, refundedNet: 500, refundedAmount: 10_342.5, status: 'REFUNDED', withheld: 157.5, at: '2001-03-09T10:00:00Z' });

    // Hors de la fenêtre ou hors calcul
    await insertPayment(c, { amount: 50_000, service: 2_500, agg: 750, net: 1_750, at: '2001-02-28T23:59:59Z' });
    await insertPayment(c, { amount: 50_000, service: 2_500, agg: 750, net: 1_750, at: '2001-04-01T00:00:00Z' });
    await insertPayment(c, { amount: 50_000, service: 2_500, agg: 750, net: 1_750, status: 'FAILED', at: '2001-03-10T10:00:00Z' });
    await insertPayment(c, { amount: 5_000, service: 0, agg: 0, net: 0, payout: 5_000, platform: false, at: '2001-03-10T11:00:00Z' });

    // Retraits et versements
    const w1 = await insertWithdrawal(c, { gross: 10_000, fee: 100, status: 'PAID', processedAt: '2001-03-10T12:00:00Z' });
    await insertCashout(c, { kind: 'WITHDRAWAL', amount: 9_900, status: 'CONFIRME', confirmedAt: '2001-03-10T12:00:00Z', fees: 148.5, withdrawalId: w1 });
    const w2 = await insertWithdrawal(c, { gross: 5_000, fee: 50, status: 'PENDING' });
    await insertCashout(c, { kind: 'WITHDRAWAL', amount: 4_950, status: 'A_ENVOYER', withdrawalId: w2 });
    await insertWithdrawal(c, { gross: 8_000, fee: 80, status: 'REJECTED', processedAt: '2001-03-11T12:00:00Z' });
    const c2 = await insertCashout(c, { kind: 'EVENT_CANCELLATION_REFUND', amount: 10_500, status: 'CONFIRME', confirmedAt: '2001-03-12T12:00:00Z', fees: 150 });
    const c3 = await insertCashout(c, { kind: 'EVENT_CANCELLATION_REFUND', amount: 8_000, status: 'CONFIRME', confirmedAt: '2001-03-13T12:00:00Z', fees: 120 });
    await insertCashout(c, { kind: 'TICKET_REFUND', amount: 5_250, status: 'CONFIRME', confirmedAt: '2001-04-02T12:00:00Z', fees: 99 });
    await insertCashout(c, { kind: 'REFUND', amount: 3_000, status: 'CONFIRME', confirmedAt: '2001-03-14T12:00:00Z', fees: null });

    // Remboursements encore à verser (demandés, en cours, incertain, échoué)
    await insertCashout(c, { kind: 'TICKET_REFUND', amount: 10_500, status: 'A_ENVOYER' });
    await insertCashout(c, { kind: 'EVENT_CANCELLATION_REFUND', amount: 2_100, status: 'ECHOUE' });
    await insertCashout(c, { kind: 'REFUND', amount: 3_000, status: 'INCERTAIN' });
    await insertCashout(c, { kind: 'REFUND', amount: 500, status: 'ENVOYE' });

    // Grand livre : écritures d'abord (aucune créance ouverte : pas de compensation automatique), créances ensuite
    await insertLedger(c, { owner: partner.userId, kind: 'ORGANISATEUR', type: 'VENTE', amount: 40_000 });
    await insertLedger(c, { owner: partner.userId, kind: 'ORGANISATEUR', type: 'REMBOURSEMENT', amount: -10_157.5 });
    await insertLedger(c, { owner: partner.userId, kind: 'ORGANISATEUR', type: 'RETRAIT', amount: -10_000 });
    await insertLedger(c, { owner: partner.userId, kind: 'ORGANISATEUR', type: 'RETRAIT', amount: -5_000 });
    await insertLedger(c, { owner: partner.userId, kind: 'ORGANISATEUR', type: 'REGULARISATION', amount: -150, sourceKey: `CASHOUT_FEE-${c2}` });
    await insertLedger(c, { owner: sponsor.userId, kind: 'PARRAINAGE', type: 'COMMISSION', amount: 34.25 });
    await insertLedger(c, { owner: sponsor.userId, kind: 'PARRAINAGE', type: 'COMMISSION', amount: 17.13 });
    await insertDebt(c, { owner: partner.userId, kind: 'ORGANISATEUR', amount: 120, remaining: 80, sourceKey: `CASHOUT_FEE-${c3}-CREANCE` });
    await insertDebt(c, { owner: sponsor.userId, kind: 'PARRAINAGE', amount: 10, remaining: 10, paymentId: p4 });
}

// ── Cas ────────────────────────────────────────────────────────────────────

describe('2 — « Gagné par Event Village » sur des cas construits à la main (mars 2001)', () => {
    test('total 522,62 F CFA et chaque composante, sans double comptage', async () => {
        await inSnapshot(async (c) => {
            const before = await earnedIn(c, FROM, TO);
            eqAmount(before.total, 0, 'précondition : fenêtre de mars 2001 vide');
            await writeScenario(c);
            const e = await earnedIn(c, FROM, TO);
            eqAmount(e.total, 522.62, 'gagné par Event Village');
            assert.equal(Number(e.payments), 5, `paiements de la fenêtre : ${String(e.payments)}`);
            eqAmount(e.volume, 73_500, 'encaissé');
            eqAmount(e.service_fees, 3_500, 'frais de service payés');
            eqAmount(e.aggregator_fees, 1_102.5, 'frais d’encaissement SamirPay (estimés)');
            eqAmount(e.net_revenue, 2_397.5, 'net Event Village avant remboursements');
            eqAmount(e.refunded_net, 1_842.5, 'part annulée par les remboursements');
            eqAmount(e.duplicate_withheld, 157.5, 'retenue sur un paiement en double');
            eqAmount(e.service_net, 712.5, 'frais de service nets des remboursements');
            eqAmount(e.withdrawal_fees, 100, 'frais de retrait');
            eqAmount(e.samirpay_fees, 418.5, 'frais réels SamirPay des versements');
            eqAmount(e.commissions, 51.38, 'commissions de parrainage');
            eqAmount(e.commissions_unrecovered, 10, 'commissions reprises non récupérées');
            eqAmount(e.rebilled, 190, 'frais repris aux partenaires');
            const recomposed = cents(e.service_net) + cents(e.withdrawal_fees) - cents(e.samirpay_fees) - cents(e.commissions)
                - cents(e.commissions_unrecovered) + cents(e.rebilled);
            assert.equal(cents(e.total), recomposed, 'le total est la somme de ses composantes');
        });
    });

    test('la synthèse rend le même bloc « gagné » que finance_admin_earned', async () => {
        await inSnapshot(async (c) => {
            await writeScenario(c);
            const s = await summaryIn(c, FROM, TO);
            const e = await earnedIn(c, FROM, TO);
            assert.deepEqual(s.earned, e, 'bloc earned de la synthèse');
        });
    });

    test('période vide ou inversée refusée (aucun chiffre faux)', async () => {
        await inSnapshot(async (c) => {
            await assert.rejects(() => earnedIn(c, TO, FROM), /période/i, 'période inversée acceptée');
        });
    });
});

describe('2 — chiffres à l’instant : dû aux partenaires, dû aux parrains, créances, remboursements à verser', () => {
    test('écarts exacts après les cas construits à la main', async () => {
        await inSnapshot(async (c) => {
            const a = await summaryIn(c, FROM, TO);
            await writeScenario(c);
            const b = await summaryIn(c, FROM, TO);
            const d = (block: string, key: string): number => (cents(b[block][key]) - cents(a[block][key])) / 100;
            // Grand livre de la partenaire : 40 000 − 10 157,50 − 10 000 − 5 000 − 150 = 14 692,50 ; retrait en cours net 4 950
            eqAmount(d('owed_partners', 'ledger'), 14_692.5, 'dû aux partenaires : solde du grand livre');
            eqAmount(d('owed_partners', 'withdrawals_in_progress'), 4_950, 'dû aux partenaires : net des retraits en cours');
            eqAmount(d('owed_partners', 'total'), 19_642.5, 'dû aux partenaires');
            eqAmount(d('owed_partners', 'withdrawable_now'), 14_692, 'dont retirable aujourd’hui (arrondi au franc inférieur)');
            eqAmount(d('owed_partners', 'pending'), 0, 'en attente de la fin des événements');
            eqAmount(d('owed_referrers', 'total'), 51.38, 'dû aux parrains');
            eqAmount(d('debts', 'total'), 90, 'créances');
            eqAmount(d('debts', 'count'), 2, 'nombre de créances');
            eqAmount(d('debts', 'partners_total'), 80, 'créances des partenaires');
            eqAmount(d('debts', 'referrers_total'), 10, 'créances des parrains');
            eqAmount(d('refunds_to_pay', 'total'), 16_100, 'remboursements à verser (retraits exclus, confirmés exclus)');
            eqAmount(d('refunds_to_pay', 'count'), 4, 'nombre de remboursements à verser');
        });
    });
});

describe('2 — réserve de prudence (réglages finance.safety_reserve_*)', () => {
    test('automatique par défaut : encaissements des 3 derniers jours (ceux d’il y a 4 jours exclus)', async () => {
        await inSnapshot(async (c) => {
            const a = await summaryIn(c, FROM, TO);
            assert.equal(a.reserve.mode, 'AUTO_3_DAYS', `mode par défaut : ${JSON.stringify(a.reserve)}`);
            await insertPayment(c, { amount: 7_000, service: 333, agg: 105, net: 228, at: new Date(Date.now() - 24 * 3600_000).toISOString() });
            await insertPayment(c, { amount: 9_000, service: 428, agg: 135, net: 293, at: new Date(Date.now() - 4 * 24 * 3600_000).toISOString() });
            await insertPayment(c, { amount: 4_000, service: 190, agg: 60, net: 130, status: 'FAILED', at: new Date(Date.now() - 3600_000).toISOString() });
            const b = await summaryIn(c, FROM, TO);
            eqAmount(cents(b.reserve.amount) / 100 - cents(a.reserve.amount) / 100, 7_000, 'réserve automatique');
            eqAmount(cents(b.reserve.auto_amount) / 100 - cents(a.reserve.auto_amount) / 100, 7_000, 'montant automatique');
        });
    });

    test('montant fixe : la réserve vaut exactement le réglage', async () => {
        await inSnapshot(async (c) => {
            await c.query(`UPDATE public.platform_settings SET value = '{"value": "FIXED"}'::jsonb WHERE key = 'finance.safety_reserve_mode'`);
            await c.query(`UPDATE public.platform_settings SET value = '{"value": 250000}'::jsonb WHERE key = 'finance.safety_reserve_amount'`);
            const s = await summaryIn(c, FROM, TO);
            assert.equal(s.reserve.mode, 'FIXED', JSON.stringify(s.reserve));
            eqAmount(s.reserve.amount, 250_000, 'réserve fixe');
        });
    });

    test('réglages SUPERADMIN : valeurs admises et refusées par finance_setting_set', async () => {
        await inSnapshot(async (c) => {
            const { rows: sa } = await c.query<{ id: string }>(
                `SELECT r.user_id AS id FROM public.user_roles r JOIN public.users u ON u.id = r.user_id
                  WHERE r.role = 'SUPERADMIN' AND u.status = 'ACTIF' ORDER BY r.user_id LIMIT 1`);
            assert.ok(sa[0], 'précondition : un SUPERADMIN actif');
            const set = async (key: string, value: unknown): Promise<Row> => (await c.query<{ r: Row }>(
                'SELECT public.finance_setting_set($1, $2::jsonb, $3, $4) AS r', [key, JSON.stringify({ value }), sa[0].id, 'Essai de la finition 3a'])).rows[0].r;
            assert.equal((await set('finance.safety_reserve_mode', 'FIXED')).ok, true);
            assert.equal((await set('finance.safety_reserve_mode', 'AUTO_3_DAYS')).ok, true);
            assert.equal((await set('finance.safety_reserve_mode', 'TOUT')).code, 'INVALID_VALUE');
            assert.equal((await set('finance.safety_reserve_amount', 1_500_000)).ok, true);
            assert.equal((await set('finance.safety_reserve_amount', -1)).code, 'INVALID_VALUE');
            assert.equal((await set('finance.safety_reserve_amount', 10.5)).code, 'INVALID_VALUE');
            assert.equal((await set('finance.safety_reserve_amount', 1_000_000_001)).code, 'INVALID_VALUE');
        });
    });
});

describe('3 — détail de chaque chiffre : paiements paginés, créances, remboursements à verser, dû par compte', () => {
    async function rpcIn(c: Client, fn: string, p: Row): Promise<Row> {
        const { rows } = await c.query<{ r: Row }>(`SELECT public.${fn}($1::jsonb) AS r`, [JSON.stringify(p)]);
        assert.ok(rows[0]?.r, `${fn} : réponse vide`);
        return rows[0].r;
    }

    test('paiements de la période : pages, ordre du plus récent, filtre de statut limité à la liste', async () => {
        await inSnapshot(async (c) => {
            await writeScenario(c);
            const all = await rpcIn(c, 'finance_admin_payments', { from: FROM, to: TO, status: 'ALL', limit: 2, offset: 0 });
            assert.equal(all.total, 5, `paiements encaissés de mars 2001 : ${JSON.stringify(all.total)}`);
            const items = all.items as Row[];
            assert.equal(items.length, 2, 'page de 2 lignes');
            assert.ok(String(items[0].encashed_at) > String(items[1].encashed_at), 'du plus récent au plus ancien');
            const last = await rpcIn(c, 'finance_admin_payments', { from: FROM, to: TO, status: 'ALL', limit: 2, offset: 4 });
            assert.equal((last.items as Row[]).length, 1, 'dernière page : 1 ligne');
            const byStatus = async (status: string) => Number((await rpcIn(c, 'finance_admin_payments', { from: FROM, to: TO, status })).total);
            assert.deepEqual([await byStatus('SUCCESS'), await byStatus('PARTIAL'), await byStatus('REFUNDED'), await byStatus('REFUND_PENDING')], [1, 1, 3, 0]);
            const capped = await rpcIn(c, 'finance_admin_payments', { from: FROM, to: TO, limit: 5000 });
            assert.equal(capped.limit, 100, 'page plafonnée à 100 lignes');
            const withheld = (await rpcIn(c, 'finance_admin_payments', { from: FROM, to: TO, status: 'REFUNDED', limit: 10 })).items as Row[];
            assert.ok(withheld.some((r) => cents(r.duplicate_withheld) === 15_750), 'retenue du paiement en double servie');
            await assert.rejects(() => rpcIn(c, 'finance_admin_payments', { from: FROM, to: TO, status: 'PENDING' }), /statut/i, 'statut hors liste accepté');
        });
    });

    test('créances : qui doit quoi et pourquoi (frais d’un remboursement, commission reprise)', async () => {
        await inSnapshot(async (c) => {
            const a = await rpcIn(c, 'finance_admin_debts', { limit: 100 });
            await writeScenario(c);
            const b = await rpcIn(c, 'finance_admin_debts', { limit: 100 });
            assert.equal(Number(b.total) - Number(a.total), 2, 'deux créances de plus');
            eqAmount((cents(b.amount) - cents(a.amount)) / 100, 90, 'reste dû des créances');
            const mine = (b.items as Row[]).filter((r) => r.owner_id === partner.userId || r.owner_id === sponsor.userId);
            const partnerDebt = mine.find((r) => r.owner_id === partner.userId);
            const sponsorDebt = mine.find((r) => r.owner_id === sponsor.userId);
            assert.ok(partnerDebt && sponsorDebt, `créances du scénario : ${JSON.stringify(mine)}`);
            assert.deepEqual([partnerDebt.account_kind, partnerDebt.nature, cents(partnerDebt.remaining)], ['ORGANISATEUR', 'FRAIS_REMBOURSEMENT', 8_000]);
            assert.ok(String(partnerDebt.company_name ?? '').startsWith('TEST Finance f3a-synthese'), `raison sociale : ${String(partnerDebt.company_name)}`);
            assert.deepEqual([sponsorDebt.account_kind, sponsorDebt.nature, cents(sponsorDebt.remaining)], ['PARRAINAGE', 'COMMISSION', 1_000]);
        });
    });

    test('remboursements à verser : versements de remboursement non confirmés seulement', async () => {
        await inSnapshot(async (c) => {
            const a = await rpcIn(c, 'finance_admin_refunds_to_pay', { limit: 100 });
            await writeScenario(c);
            const b = await rpcIn(c, 'finance_admin_refunds_to_pay', { limit: 100 });
            assert.equal(Number(b.total) - Number(a.total), 4, 'quatre remboursements à verser de plus');
            eqAmount((cents(b.amount) - cents(a.amount)) / 100, 16_100, 'montant à verser');
            assert.ok((b.items as Row[]).every((r) => r.kind !== 'WITHDRAWAL' && r.status !== 'CONFIRME'), 'retrait ou versement confirmé dans la liste');
        });
    });

    test('dû par compte : la partenaire du scénario, solde, retrait en cours et part retirable', async () => {
        await inSnapshot(async (c) => {
            await writeScenario(c);
            const r = await rpcIn(c, 'finance_admin_owed', { kind: 'ORGANISATEUR', limit: 100 });
            const row = (r.items as Row[]).find((x) => x.owner_id === partner.userId);
            assert.ok(row, `partenaire du scénario absente : ${JSON.stringify(r).slice(0, 300)}`);
            eqAmount(row.total, 19_642.5, 'dû à la partenaire');
            eqAmount(row.withdrawals_in_progress, 4_950, 'retrait en cours');
            eqAmount(row.withdrawable_now, 14_692, 'retirable aujourd’hui');
            const ref = await rpcIn(c, 'finance_admin_owed', { kind: 'PARRAINAGE', limit: 100 });
            const sp = (ref.items as Row[]).find((x) => x.owner_id === sponsor.userId);
            assert.ok(sp, 'parrain du scénario absent');
            eqAmount(sp.total, 51.38, 'dû au parrain');
            await assert.rejects(() => rpcIn(c, 'finance_admin_owed', { kind: 'CLIENT' }), /compte/i, 'compte inconnu accepté');
        });
    });

    test('accueil, « Argent qui attend » : mêmes règles que les listes', async () => {
        await inSnapshot(async (c) => {
            const read = async (): Promise<Row> => (await c.query<{ r: Row }>('SELECT public.finance_admin_waiting(false, 48) AS r')).rows[0].r;
            const a = await read();
            await writeScenario(c);
            const b = await read();
            const d = (block: string, key: string): number => (cents((b[block] as Row)[key]) - cents((a[block] as Row)[key])) / 100;
            // Versements à reprendre : l'échoué et l'incertain (les autres viennent d'être créés : moins de 30 minutes), plus le
            // paiement en échec sans identifiant SamirPay du scénario, créé à l'instant (à vérifier chez SamirPay, comme la
            // liste de GET /api/admin/refunds) — run 246 : attendu corrigé (2 → 3), règle inchangée
            eqAmount(d('to_resume', 'cashouts'), 2, 'versements à reprendre : versements');
            eqAmount(d('to_resume', 'unconfirmed_payments'), 1, 'versements à reprendre : paiement sans identifiant SamirPay');
            eqAmount(d('to_resume', 'count'), 3, 'versements à reprendre');
            eqAmount(d('to_resume', 'amount'), 55_100, 'montant des versements à reprendre (2 100 + 3 000 + 50 000)');
            eqAmount(d('refunds_to_pay', 'count'), 4, 'remboursements à verser');
            eqAmount(d('refunds_to_pay', 'amount'), 16_100, 'montant à verser');
            eqAmount(d('debts', 'count'), 2, 'créances');
            eqAmount(d('debts', 'amount'), 90, 'reste dû des créances');
        });
    });
});
