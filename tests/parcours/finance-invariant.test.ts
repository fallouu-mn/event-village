/**
 * Lot 3, tâche 3.9 — invariant financier étendu (d)(e)(f).
 * Garde-fou : dans une transaction annulée, chaque règle détecte une violation fabriquée exprès
 * (sinon un invariant toujours vide ne prouverait rien). L'invariant complet est ensuite vérifié
 * sur l'état réel de la base à la fin de la suite.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { inRolledBackTransaction } from '../helpers/db';
import { loadFixtures } from '../helpers/fixtures';
import { FINANCE_INVARIANT_SQL, assertFinanceInvariants } from '../helpers/finance-invariants';

interface Violation { regle: string; objet: string; detail: string }

describe('Invariant financier (d)(e)(f)', () => {
    after(async () => {
        await assertFinanceInvariants('finance-invariant');
    });

    test('chaque règle détecte une violation fabriquée (transaction annulée)', async () => {
        const fx = await loadFixtures();
        const client = fx.users.CLIENT.id;
        const sponsor = fx.users.CLIENT_BIS.id;
        const badTotal = randomUUID();
        const refunded = randomUUID();
        const lonely = fx.users.CONTROLLER_A.id;

        const rows = await inRolledBackTransaction(async (db) => {
            // (d) total ≠ facial + service
            await db.query(
                `INSERT INTO public.payments (id, transaction_id, client_id, payment_target, amount, status, is_platform_payment,
                                              facial_amount, service_fee, aggregator_fee, net_event_village_revenue, partner_payout_amount)
                 VALUES ($1, $2, $3, 'TICKET', 1100, 'SUCCESS', true, 1000, 50, 15.75, 34.25, 1000)`,
                [badTotal, `TX-INV-D-${Date.now()}`, client]);
            // (e) compte du grand livre négatif
            await db.query(
                `INSERT INTO public.finance_ledger (owner_id, account_kind, entry_type, amount, available_at, source_key, description)
                 VALUES ($1, 'PARRAINAGE', 'REGULARISATION', -100, now(), $2, 'violation fabriquée')`,
                [lonely, `INV-E-${randomUUID()}`]);
            // (f) commission DISPONIBLE sur un paiement REFUNDED, sans régularisation
            await db.query(
                `INSERT INTO public.payments (id, transaction_id, client_id, payment_target, amount, status, is_platform_payment,
                                              facial_amount, service_fee, aggregator_fee, net_event_village_revenue, partner_payout_amount,
                                              refunded_amount, refunded_net_revenue)
                 VALUES ($1, $2, $3, 'ORDER', 1050, 'REFUNDED', true, 1000, 50, 15.75, 34.25, 1000, 0, 0)`,
                [refunded, `TX-INV-F-${Date.now()}`, client]);
            await db.query(
                `INSERT INTO public.referral_commissions (sponsor_id, referred_id, generation, referral_type, payment_id, eligible_net_revenue,
                                                          commission_rate, amount, status, idempotency_key, available_at)
                 VALUES ($1, $2, 'N1', 'CLIENT_TO_CLIENT', $3, 34.25, 5, 1.71, 'AVAILABLE', $4, now())`,
                [sponsor, client, refunded, `INV-F-${randomUUID()}`]);
            return (await db.query<Violation>(FINANCE_INVARIANT_SQL)).rows;
        });

        const d = rows.filter((r) => r.regle === 'd' && r.objet === badTotal);
        assert.ok(d.some((r) => r.detail.startsWith('total 1100')), `(d) détecte le total faux : ${JSON.stringify(d)}`);
        const e = rows.filter((r) => r.regle === 'e' && r.objet.startsWith(lonely));
        assert.ok(e.some((r) => r.detail.includes('solde total -100')), `(e) détecte le solde négatif : ${JSON.stringify(e)}`);
        const f = rows.filter((r) => r.regle === 'f');
        assert.ok(f.some((r) => r.detail.includes('sur paiement REFUNDED')), `(f) détecte la commission non régularisée : ${JSON.stringify(f)}`);
    });
});
