/**
 * Lot 11a (tables : argent et sécurité) — invariants des réservations de table, vérifiés à la fin de chaque suite du
 * lot, par une requête SQL sur TOUTE la base LOCALE (lecture seule), après les invariants des livraisons précédentes
 * (assertLot10aInvariants, qui enchaîne finition 3d, 3b, 3a, finition 1, lots 9…).
 *
 *  (t1) Aucune table n'a deux réservations qui la tiennent sur des créneaux qui se chevauchent.
 *  (t2) Une réservation qui tient une table a une table, de son établissement, et cet établissement est à sa partenaire.
 *  (t3) État et argent d'accord : en attente de paiement → rien de payé ; demande, confirmée, arrivée ou absente avec
 *       acompte → acompte payé en entier ; payé = somme des paiements de la réservation encaissés (SUCCESS, PARTIAL ou
 *       REFUNDED, hors paiement arrivé trop tard : metadata.refund_reason) ; remboursé ≤ payé.
 *  (t4) Montants figés : acompte = acompte par personne × personnes ; à payer = acompte + frais ; sans acompte, tout à 0.
 *  (t5) Chaque paiement de table encaissé a sa vente au grand livre, du montant de la part de l'établissement, disponible
 *       au plus tôt à la fin du créneau (si la garde des ventes est active sur le paiement).
 *  (t6) Paiement sur place jamais compté : aucune ligne de paiement hors plateforme pour une table ; aucune ligne de
 *       paiement pour une réservation sans acompte.
 *
 * Une colonne absente (preuve des rouges, avant la migration) ne donne aucune violation. Sortie brute `[INVARIANT-LOT11A]`.
 */
import assert from 'node:assert/strict';
import { inspect } from './db';
import { assertLot10aInvariants } from './lot10a-invariants';
import type { RecetteViolation } from './recette-invariants';

export type Lot11aViolation = RecetteViolation;

const PRESENT_SQL = `SELECT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'table_reservations' AND column_name = 'booking_state') AS ok`;

const HOLDING = `('EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_ACCEPTATION', 'CONFIRMEE', 'ARRIVEE')`;

const RULES_SQL = `
SELECT 't1'::text AS regle, a.id::text AS objet, format('chevauche la réservation %s de la même table', b.id) AS detail
  FROM public.table_reservations a JOIN public.table_reservations b
    ON b.table_id = a.table_id AND b.id > a.id AND b.slot && a.slot
 WHERE a.booking_state IN ${HOLDING} AND b.booking_state IN ${HOLDING}
UNION ALL
SELECT 't2', r.id::text, format('état %s, table %s (établissement %s), établissement %s, partenaire %s / %s',
                                r.booking_state, r.table_id, t.venue_id, r.venue_id, r.partner_id, v.partner_id)
  FROM public.table_reservations r
  LEFT JOIN public.restaurant_tables t ON t.id = r.table_id
  LEFT JOIN public.venues v ON v.id = r.venue_id
 WHERE r.booking_state IN ${HOLDING}
   AND (r.table_id IS NULL OR t.venue_id IS DISTINCT FROM r.venue_id OR v.partner_id IS DISTINCT FROM r.partner_id)
UNION ALL
SELECT 't3', r.id::text, format('état %s, payé %s, à payer %s, encaissé %s, remboursé %s', r.booking_state, r.paid_amount, r.total_amount, COALESCE(p.cashed, 0), r.refunded_amount)
  FROM public.table_reservations r
  LEFT JOIN LATERAL (SELECT sum(pp.amount) AS cashed FROM public.payments pp
                      WHERE pp.table_reservation_id = r.id AND pp.status::text IN ('SUCCESS', 'PARTIAL', 'REFUNDED')
                        AND NOT (pp.metadata ? 'refund_reason')) p ON TRUE
 WHERE r.venue_id IS NOT NULL
   AND ((r.booking_state = 'EN_ATTENTE_PAIEMENT' AND r.paid_amount <> 0)
     OR (r.booking_state IN ('EN_ATTENTE_ACCEPTATION', 'CONFIRMEE', 'ARRIVEE', 'ABSENT') AND r.paid_amount <> r.total_amount)
     OR r.paid_amount <> COALESCE(p.cashed, 0)
     OR r.refunded_amount > r.paid_amount)
UNION ALL
SELECT 't4', r.id::text, format('acompte %s (%s × %s), frais %s, à payer %s', r.deposit_amount, r.deposit_per_person, r.guest_count, r.service_fee_amount, r.total_amount)
  FROM public.table_reservations r
 WHERE r.venue_id IS NOT NULL
   AND (r.total_amount <> r.deposit_amount + r.service_fee_amount
     OR (r.deposit_per_person IS NULL AND (r.deposit_amount <> 0 OR r.service_fee_amount <> 0))
     OR (r.deposit_per_person IS NOT NULL AND r.deposit_amount <> r.deposit_per_person * r.guest_count))
UNION ALL
SELECT 't5', p.id::text, format('vente au grand livre %s pour une part de l’établissement de %s, disponible %s (fin %s)',
                                COALESCE(l.amount::text, 'absente'), p.partner_payout_amount, l.available_at, upper(r.slot))
  FROM public.payments p
  JOIN public.table_reservations r ON r.id = p.table_reservation_id
  LEFT JOIN public.finance_ledger l ON l.source_key = 'VENTE-' || p.id::text
 WHERE p.payment_target::text = 'TABLE_RESERVATION' AND p.status::text IN ('SUCCESS', 'PARTIAL', 'REFUNDED')
   AND NOT (p.metadata ? 'refund_reason') AND COALESCE(p.partner_payout_amount, 0) > 0
   AND (l.id IS NULL OR l.amount <> p.partner_payout_amount
        OR (COALESCE(p.payout_hold_enabled, true) AND l.available_at < (upper(r.slot) AT TIME ZONE 'Africa/Dakar')))
UNION ALL
SELECT 't6', p.id::text, format('paiement %s (plateforme : %s) pour une réservation avec acompte de %s', p.status, p.is_platform_payment, r.total_amount)
  FROM public.payments p
  JOIN public.table_reservations r ON r.id = p.table_reservation_id
 WHERE r.venue_id IS NOT NULL AND (NOT p.is_platform_payment OR r.total_amount = 0)
ORDER BY 1, 2`;

export async function lot11aViolations(): Promise<Lot11aViolation[]> {
    return inspect(async (c) => {
        const { rows: present } = await c.query<{ ok: boolean }>(PRESENT_SQL);
        if (!present[0]?.ok) return [];
        const { rows } = await c.query<Lot11aViolation>(RULES_SQL);
        return rows;
    });
}

export async function assertLot11aInvariants(label: string): Promise<void> {
    await assertLot10aInvariants(label);
    const violations = await lot11aViolations();
    console.log(`[INVARIANT-LOT11A] ${label} — (t1)(t2)(t3)(t4)(t5)(t6) : ${violations.length} violation(s)`);
    for (const v of violations) console.log(`[INVARIANT-LOT11A] ${v.regle} ${v.objet} : ${v.detail}`);
    assert.deepEqual(violations, [], `[INVARIANT-LOT11A] ${label} : violations`);
}
