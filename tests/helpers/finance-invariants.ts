/**
 * Lot 3 — invariant financier, extension de l'invariant global du lot 2 (payment-invariants.ts),
 * vérifié à la fin de chaque suite financière par une requête SQL sur la base LOCALE (lecture seule) :
 *  (d) pour chaque paiement plateforme confirmé (SUCCESS, PARTIAL, REFUNDED) : total = facial + service ;
 *      reversement organisateur = facial (hors abonnement) ; net EV = service − agrégateur (abonnement :
 *      facial − agrégateur) ; part remboursée du revenu net = Σ des remboursements demandés (un envoi refusé reste dû) ; montant
 *      remboursé = Σ des remboursements versés ; statut PARTIAL / REFUNDED cohérent avec ce montant ;
 *  (e) pour chaque compte du grand livre : solde total ≥ 0, solde disponible ≥ 0, solde calculé par
 *      finance_account_balance = crédits − débits du grand livre ; chaque paiement plateforme confirmé
 *      (passé par SUCCESS) d'un partenaire a exactement une écriture VENTE égale à son reversement ;
 *  (f) aucune commission non annulée sur un paiement REFUNDED sans régularisation correspondante
 *      (somme des régularisations = − montant de la commission).
 * La sortie brute est imprimée (rapport du lot 3, section 4).
 */
import assert from 'node:assert/strict';
import { inspect } from './db';
import { assertPaymentInvariants } from './payment-invariants';

export const FINANCE_INVARIANT_SQL = `
WITH refund_sums AS (
    SELECT payment_id,
           sum(net_revenue_reversal) AS reversal,
           sum(amount) FILTER (WHERE status = 'PROCESSED' AND settlement = 'PLATEFORME') AS refunded
      FROM public.refunds WHERE payment_id IS NOT NULL GROUP BY payment_id
), confirmed AS (
    SELECT p.* FROM public.payments p
     WHERE p.is_platform_payment AND p.status IN ('SUCCESS', 'PARTIAL', 'REFUNDED')
), credited AS (
    -- paiements passés par SUCCESS (un panier non honorable va de PENDING à REFUND_PENDING puis REFUNDED, sans billet)
    SELECT p.* FROM confirmed p
     WHERE p.status IN ('SUCCESS', 'PARTIAL')
        OR (p.status = 'REFUNDED' AND (p.payment_target <> 'TICKET' OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.payment_id = p.id)))
), accounts AS (
    SELECT owner_id, account_kind, sum(amount) AS total,
           coalesce(sum(amount) FILTER (WHERE available_at <= now()), 0) AS available
      FROM public.finance_ledger GROUP BY owner_id, account_kind
), sales AS (
    SELECT payment_id, count(*) AS n, sum(amount) AS amount FROM public.finance_ledger
     WHERE entry_type = 'VENTE' GROUP BY payment_id
), regul AS (
    SELECT regularizes_id, sum(amount) AS amount FROM public.referral_commissions
     WHERE kind = 'REGULARISATION' GROUP BY regularizes_id
)
SELECT 'd' AS regle, p.id::text AS objet, format('%s : montants financiers absents (facial %s)', p.payment_target, p.facial_amount) AS detail
  FROM confirmed p WHERE p.facial_amount IS NULL
UNION ALL
SELECT 'd', p.id::text, format('total %s ≠ facial %s + service %s', p.amount, p.facial_amount, p.service_fee)
  FROM confirmed p WHERE p.facial_amount IS NOT NULL AND p.amount <> p.facial_amount + p.service_fee
UNION ALL
SELECT 'd', p.id::text, format('reversement %s ≠ facial %s', p.partner_payout_amount, p.facial_amount)
  FROM confirmed p WHERE p.facial_amount IS NOT NULL AND p.payment_target <> 'SUBSCRIPTION' AND p.partner_payout_amount <> p.facial_amount
UNION ALL
SELECT 'd', p.id::text, format('net EV %s ≠ %s − agrégateur %s', p.net_event_village_revenue,
       CASE WHEN p.payment_target = 'SUBSCRIPTION' THEN p.facial_amount ELSE p.service_fee END, p.aggregator_fee)
  FROM confirmed p WHERE p.facial_amount IS NOT NULL
   AND p.net_event_village_revenue <> round((CASE WHEN p.payment_target = 'SUBSCRIPTION' THEN p.facial_amount ELSE p.service_fee END) - p.aggregator_fee, 2)
UNION ALL
SELECT 'd', p.id::text, format('part remboursée du net %s ≠ Σ des remboursements %s', p.refunded_net_revenue, coalesce(r.reversal, 0))
  FROM confirmed p LEFT JOIN refund_sums r ON r.payment_id = p.id
 WHERE p.facial_amount IS NOT NULL AND p.refunded_net_revenue <> coalesce(r.reversal, 0)
UNION ALL
SELECT 'd', p.id::text, format('montant remboursé %s ≠ Σ des remboursements versés %s', p.refunded_amount, coalesce(r.refunded, 0))
  FROM confirmed p LEFT JOIN refund_sums r ON r.payment_id = p.id
 WHERE p.facial_amount IS NOT NULL AND p.refunded_amount <> coalesce(r.refunded, 0)
UNION ALL
SELECT 'd', p.id::text, format('statut %s incohérent avec %s remboursé sur %s', p.status, p.refunded_amount, p.amount)
  FROM confirmed p
 WHERE p.facial_amount IS NOT NULL AND (
       (p.status = 'SUCCESS' AND p.refunded_amount > 0)
    OR (p.status = 'PARTIAL' AND NOT (p.refunded_amount > 0 AND p.refunded_amount < p.amount))
    OR (p.status = 'REFUNDED' AND p.refunded_amount < p.amount AND p.payment_target = 'TICKET' AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.payment_id = p.id)))
UNION ALL
SELECT 'e', a.owner_id::text || '/' || a.account_kind, format('solde total %s, disponible %s', a.total, a.available)
  FROM accounts a WHERE a.total < 0 OR a.available < 0
UNION ALL
SELECT 'e', a.owner_id::text || '/' || a.account_kind,
       format('finance_account_balance %s ≠ grand livre (disponible %s, en attente %s)', b.v, a.available, a.total - a.available)
  FROM accounts a CROSS JOIN LATERAL (SELECT public.finance_account_balance(a.owner_id, a.account_kind) AS v) b
 WHERE (b.v->>'available')::numeric <> a.available OR (b.v->>'pending')::numeric <> a.total - a.available
UNION ALL
SELECT 'e', p.id::text, format('écritures VENTE : %s pour %s, reversement %s', coalesce(s.n, 0), coalesce(s.amount, 0), p.partner_payout_amount)
  FROM credited p LEFT JOIN sales s ON s.payment_id = p.id
 WHERE p.payment_target <> 'SUBSCRIPTION' AND p.partner_id IS NOT NULL AND p.partner_payout_amount > 0
   AND (coalesce(s.n, 0) <> 1 OR s.amount <> p.partner_payout_amount)
UNION ALL
SELECT 'e', s.payment_id::text, 'écriture VENTE sans paiement plateforme confirmé'
  FROM sales s WHERE NOT EXISTS (SELECT 1 FROM credited p WHERE p.id = s.payment_id)
UNION ALL
SELECT 'f', c.id::text, format('commission %s (%s) sur paiement REFUNDED : régularisations %s', c.amount, c.status, coalesce(g.amount, 0))
  FROM public.referral_commissions c
  JOIN public.payments p ON p.id = c.payment_id
  LEFT JOIN regul g ON g.regularizes_id = c.id
 WHERE p.status = 'REFUNDED' AND c.kind = 'COMMISSION' AND c.status <> 'CANCELLED'
   AND coalesce(g.amount, 0) <> -c.amount
ORDER BY 1, 2`;

interface Violation { regle: string; objet: string; detail: string }

export async function financeViolations(): Promise<Violation[]> {
    return inspect(async (db) => (await db.query<Violation>(FINANCE_INVARIANT_SQL)).rows);
}

/** À appeler dans after() de chaque suite financière : invariant du lot 2, puis extension (d)(e)(f). */
export async function assertFinanceInvariants(label: string): Promise<void> {
    await assertPaymentInvariants(label);
    const rows = await financeViolations();
    console.log(`[INVARIANT-FIN] ${label} — (d)(e)(f) : ${rows.length} violation(s)`);
    for (const r of rows) console.log(`[INVARIANT-FIN]   (${r.regle}) ${r.objet} : ${r.detail}`);
    assert.deepEqual(rows, [], `invariant financier violé :\n${rows.map((r) => `(${r.regle}) ${r.objet} : ${r.detail}`).join('\n')}`);
}
