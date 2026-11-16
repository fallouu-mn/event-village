/**
 * Finition 3a (argent de l'administration) — invariants de la finition, vérifiés à la fin de chaque suite nouvelle de la
 * finition, par une requête SQL sur TOUTE la base LOCALE (lecture seule). Après les invariants des livraisons précédentes
 * (assertFinition1Invariants), règles (g1) et suivantes :
 *  (g1) la synthèse de l'administration « à l'instant » (finance_admin_summary) est égale à un recalcul indépendant :
 *       dû aux partenaires = Σ grand livre ORGANISATEUR + Σ net des retraits PENDING ou PROCESSING ; même règle pour les
 *       parrains (PARRAINAGE) ; créances = Σ reste des créances ouvertes ; remboursements à verser = Σ des versements
 *       autres que les retraits et non confirmés ;
 *  (g2) « Gagné par Event Village » depuis le début (finance_admin_earned sans bornes) est égal à un recalcul paiement par
 *       paiement et versement par versement (sous-requêtes corrélées, aucune jointure : un double comptage par jointure
 *       dans la fonction serait vu) ;
 *  (g3) aucune lecture du solde SamirPay datée du futur (cache de 5 minutes, samirpay_balance_reads).
 * Sortie brute `[INVARIANT-FINITION3A]`. Un objet de la finition absent (fonction, table) est un échec explicite qui le
 * nomme, jamais une erreur Postgres brute ni un faux vert.
 */
import assert from 'node:assert/strict';
import { inspect } from './db';
import { assertFinition1Invariants } from './finition1-invariants';
import type { RecetteViolation } from './recette-invariants';

export type Finition3aViolation = RecetteViolation;

const REQUIRED_OBJECTS = [
    'public.finance_admin_summary(timestamptz, timestamptz)',
    'public.finance_admin_earned(timestamptz, timestamptz)',
] as const;
const REQUIRED_TABLES = ['public.samirpay_balance_reads'] as const;

export const FINITION3A_INVARIANT_SQL = `
WITH s AS (SELECT public.finance_admin_summary(NULL, NULL) AS j, public.finance_admin_earned(NULL, NULL) AS e),
o AS (
    SELECT (SELECT COALESCE(sum(l.amount), 0) FROM public.finance_ledger l WHERE l.account_kind = 'ORGANISATEUR') AS org_ledger,
           (SELECT COALESCE(sum(w.net_amount), 0) FROM public.withdrawals w
             WHERE w.account_kind = 'ORGANISATEUR' AND w.status::text IN ('PENDING', 'PROCESSING')) AS org_w,
           (SELECT COALESCE(sum(l.amount), 0) FROM public.finance_ledger l WHERE l.account_kind = 'PARRAINAGE') AS par_ledger,
           (SELECT COALESCE(sum(w.net_amount), 0) FROM public.withdrawals w
             WHERE w.account_kind = 'PARRAINAGE' AND w.status::text IN ('PENDING', 'PROCESSING')) AS par_w,
           (SELECT COALESCE(sum(d.remaining), 0) FROM public.finance_debts d WHERE d.remaining > 0) AS debts,
           (SELECT COALESCE(sum(c.amount), 0) FROM public.cashouts c WHERE c.kind <> 'WITHDRAWAL' AND c.status <> 'CONFIRME') AS to_pay
),
pay AS (
    SELECT COALESCE(p.net_event_village_revenue, 0) - COALESCE(p.refunded_net_revenue, 0)
           + COALESCE(NULLIF(p.metadata->>'duplicate_fee_withheld', '')::numeric, 0)
           - COALESCE((SELECT sum(rc.amount) FROM public.referral_commissions rc
                        WHERE rc.payment_id = p.id AND rc.status::text <> 'CANCELLED'), 0)
           - COALESCE((SELECT sum(d.remaining) FROM public.finance_debts d
                        WHERE d.payment_id = p.id AND d.account_kind = 'PARRAINAGE' AND d.remaining > 0), 0) AS ev
      FROM public.payments p
     WHERE p.is_platform_payment AND p.status::text IN ('SUCCESS', 'PARTIAL', 'REFUNDED', 'REFUND_PENDING')
),
cash AS (
    SELECT COALESCE(sum(c.samirpay_fees), 0) AS fees,
           COALESCE(sum((SELECT -sum(l.amount) FROM public.finance_ledger l
                          WHERE l.source_key = 'CASHOUT_FEE-' || c.id::text AND l.entry_type = 'REGULARISATION')), 0)
         + COALESCE(sum((SELECT sum(d.amount - d.remaining) FROM public.finance_debts d
                          WHERE d.source_key = 'CASHOUT_FEE-' || c.id::text || '-CREANCE')), 0) AS rebilled
      FROM public.cashouts c
     WHERE c.status = 'CONFIRME'
),
oracle AS (
    SELECT (SELECT COALESCE(sum(ev), 0) FROM pay)
         + (SELECT COALESCE(sum(w.fee_amount), 0) FROM public.withdrawals w WHERE w.status::text = 'PAID')
         - (SELECT fees FROM cash) + (SELECT rebilled FROM cash) AS earned
)
SELECT * FROM (
    SELECT 'g1'::text AS regle, 'dû aux partenaires'::text AS objet,
           format('synthèse %s ≠ grand livre %s + retraits en cours %s', s.j->'owed_partners'->>'total', o.org_ledger, o.org_w) AS detail
      FROM s, o WHERE (s.j->'owed_partners'->>'total')::numeric <> o.org_ledger + o.org_w
    UNION ALL
    SELECT 'g1', 'dû aux parrains',
           format('synthèse %s ≠ grand livre %s + retraits en cours %s', s.j->'owed_referrers'->>'total', o.par_ledger, o.par_w)
      FROM s, o WHERE (s.j->'owed_referrers'->>'total')::numeric <> o.par_ledger + o.par_w
    UNION ALL
    SELECT 'g1', 'créances', format('synthèse %s ≠ %s', s.j->'debts'->>'total', o.debts)
      FROM s, o WHERE (s.j->'debts'->>'total')::numeric <> o.debts
    UNION ALL
    SELECT 'g1', 'remboursements à verser', format('synthèse %s ≠ %s', s.j->'refunds_to_pay'->>'total', o.to_pay)
      FROM s, o WHERE (s.j->'refunds_to_pay'->>'total')::numeric <> o.to_pay
    UNION ALL
    SELECT 'g2', 'gagné depuis le début', format('fonction %s ≠ recalcul %s', s.e->>'total', oracle.earned)
      FROM s, oracle WHERE (s.e->>'total')::numeric <> oracle.earned
    UNION ALL
    SELECT 'g3', 'samirpay_balance_reads.' || r.id::text, format('lecture datée du futur : %s', r.read_at)
      FROM public.samirpay_balance_reads r WHERE r.read_at > now() + interval '1 minute'
) v
ORDER BY 1, 2`;

export async function finition3aViolations(): Promise<Finition3aViolation[]> {
    return inspect(async (c) => {
        const missing: string[] = [];
        for (const fn of REQUIRED_OBJECTS) {
            const { rows } = await c.query<{ ok: boolean }>('SELECT to_regprocedure($1) IS NOT NULL AS ok', [fn]);
            if (!rows[0]?.ok) missing.push(fn);
        }
        for (const t of REQUIRED_TABLES) {
            const { rows } = await c.query<{ ok: boolean }>('SELECT to_regclass($1) IS NOT NULL AS ok', [t]);
            if (!rows[0]?.ok) missing.push(t);
        }
        if (missing.length > 0) {
            return missing.map((m) => ({ regle: 'g0', objet: m, detail: 'objet de la finition 3a absent de la base' }));
        }
        const { rows } = await c.query<Finition3aViolation>(FINITION3A_INVARIANT_SQL);
        return rows;
    });
}

export async function assertFinition3aInvariants(label: string): Promise<void> {
    await assertFinition1Invariants(label);
    const violations = await finition3aViolations();
    console.log(`[INVARIANT-FINITION3A] ${label} : ${violations.length} violation(s)`);
    for (const v of violations) console.log(`[INVARIANT-FINITION3A]   (${v.regle}) ${v.objet} — ${v.detail}`);
    assert.deepEqual(violations, [], `${label} : invariants de la finition 3a violés (${violations.length})`);
}
