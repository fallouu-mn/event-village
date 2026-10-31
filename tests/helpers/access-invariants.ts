/**
 * Lot 4 — invariant du contrôle d'accès, extension des invariants des lots 2 et 3, vérifié à la fin
 * de chaque suite du lot par une requête SQL sur la base LOCALE (lecture seule) :
 *  (g) tout billet UTILISE a exactement une ligne ticket_scans acceptée, faite par un scanneur autorisé
 *      pour son événement au moment du scan (contrôleur affecté, partenaire propriétaire ou admin : rôle
 *      recopié sur la ligne, scanner_role) ; un retrait ultérieur de l'affectation ne rend pas le scan illégitime ;
 *  (h) pour chaque caisse : total attendu = somme des paiements hors plateforme qui lui sont rattachés
 *      (encaissements au scan et ventes au guichet) ;
 *  (i) aucun paiement hors plateforme n'a de frais, de revenu Event Village, de reversement plateforme,
 *      ni d'écriture au grand livre.
 * La sortie brute est imprimée (rapport du lot 4, section 4).
 */
import assert from 'node:assert/strict';
import { inspect } from './db';
import { assertFinanceInvariants } from './finance-invariants';

export const ACCESS_INVARIANT_SQL = `
WITH accepted AS (
    SELECT s.ticket_id, count(*) AS n,
           count(*) FILTER (WHERE s.scanner_role IN ('CONTROLEUR', 'PARTENAIRE', 'ADMIN') AND s.event_id = t.event_id) AS authorized
      FROM public.ticket_scans s
      JOIN public.tickets t ON t.id = s.ticket_id
     WHERE s.accepted
     GROUP BY s.ticket_id
), shift_cash AS (
    SELECT shift_id, sum(amount) AS amount FROM public.payments
     WHERE shift_id IS NOT NULL AND NOT is_platform_payment AND status = 'SUCCESS'
     GROUP BY shift_id
)
SELECT 'g' AS regle, t.id::text AS objet,
       format('billet UTILISE : %s scan(s) accepté(s), dont %s par un scanneur autorisé', coalesce(a.n, 0), coalesce(a.authorized, 0)) AS detail
  FROM public.tickets t
  LEFT JOIN accepted a ON a.ticket_id = t.id
 WHERE t.status = 'UTILISE' AND (coalesce(a.n, 0) <> 1 OR coalesce(a.authorized, 0) <> 1)
UNION ALL
SELECT 'g', a.ticket_id::text, format('scan accepté sur un billet %s', t.status)
  FROM accepted a JOIN public.tickets t ON t.id = a.ticket_id
 WHERE t.status <> 'UTILISE'
UNION ALL
SELECT 'h', c.id::text, format('caisse %s : total attendu %s, paiements rattachés %s', c.status, c.expected_cash_total, coalesce(sc.amount, 0))
  FROM public.controller_shifts c
  LEFT JOIN shift_cash sc ON sc.shift_id = c.id
 WHERE c.expected_cash_total <> coalesce(sc.amount, 0)
UNION ALL
SELECT 'i', p.id::text,
       format('hors plateforme : frais %s, agrégateur %s, brut %s, net %s, reversement %s', p.service_fee, p.aggregator_fee,
              p.gross_event_village_revenue, p.net_event_village_revenue, p.partner_payout_amount)
  FROM public.payments p
 WHERE NOT p.is_platform_payment
   AND (p.service_fee <> 0 OR p.aggregator_fee <> 0 OR p.gross_event_village_revenue <> 0
        OR p.net_event_village_revenue <> 0 OR p.partner_payout_amount <> 0)
UNION ALL
SELECT 'i', p.id::text, format('hors plateforme : %s écriture(s) au grand livre', count(l.id))
  FROM public.payments p JOIN public.finance_ledger l ON l.payment_id = p.id
 WHERE NOT p.is_platform_payment
 GROUP BY p.id
ORDER BY 1, 2`;

interface Violation { regle: string; objet: string; detail: string }

export async function accessViolations(): Promise<Violation[]> {
    return inspect(async (db) => (await db.query<Violation>(ACCESS_INVARIANT_SQL)).rows);
}

/** À appeler dans after() de chaque suite du lot 4 : invariants des lots 2 et 3, puis (g)(h)(i). */
export async function assertAccessInvariants(label: string): Promise<void> {
    await assertFinanceInvariants(label);
    const rows = await accessViolations();
    console.log(`[INVARIANT-ACCES] ${label} — (g)(h)(i) : ${rows.length} violation(s)`);
    for (const r of rows) console.log(`[INVARIANT-ACCES]   (${r.regle}) ${r.objet} : ${r.detail}`);
    assert.deepEqual(rows, [], `invariant du contrôle violé :\n${rows.map((r) => `(${r.regle}) ${r.objet} : ${r.detail}`).join('\n')}`);
}
