/**
 * Lot 10a (salles : argent et sécurité) — invariants des réservations de salle, vérifiés à la fin de chaque suite du
 * lot, par une requête SQL sur TOUTE la base LOCALE (lecture seule), après les invariants des livraisons précédentes
 * (assertFinition3dInvariants, qui enchaîne 3b, 3a, finition 1, lots 9…).
 *
 *  (h1) Aucune salle n'a deux réservations qui tiennent des créneaux qui se chevauchent.
 *  (h2) État et argent d'accord : en attente de paiement → rien de payé ; acompte payé → payé entre 0 et le total
 *       (exclus) ; payée → total payé ; payé = somme des paiements de la réservation encaissés (SUCCESS, PARTIAL ou
 *       REFUNDED : un remboursement ne retire pas l'encaissement ; hors paiement arrivé trop tard, remboursé en entier
 *       sans jamais compter : metadata.refund_reason) ; remboursé ≤ payé.
 *  (h3) Montants figés cohérents : total = prix + frais ; acompte = prix de l'acompte + ses frais ; solde = total −
 *       acompte ; prix de l'acompte entre 1 et le prix.
 *  (h4) Chaque paiement de salle encaissé a sa ligne de vente au grand livre, du montant de la part de la salle, et
 *       disponible au plus tôt à la fin de la réservation (si la garde des ventes est active sur le paiement).
 *
 * Une colonne absente (preuve des rouges, avant la migration) ne donne aucune violation. Sortie brute `[INVARIANT-LOT10A]`.
 */
import assert from 'node:assert/strict';
import { inspect } from './db';
import { assertFinition3dInvariants } from './finition3d-invariants';
import type { RecetteViolation } from './recette-invariants';

export type Lot10aViolation = RecetteViolation;

const PRESENT_SQL = `SELECT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'hall_reservations' AND column_name = 'booking_state') AS ok`;

const RULES_SQL = `
SELECT 'h1'::text AS regle, a.id::text AS objet, format('chevauche la réservation %s de la même salle', b.id) AS detail
  FROM public.hall_reservations a JOIN public.hall_reservations b
    ON b.hall_id = a.hall_id AND b.id > a.id AND b.slot && a.slot
 WHERE a.status::text IN ('EN_ATTENTE', 'CONFIRMEE') AND b.status::text IN ('EN_ATTENTE', 'CONFIRMEE')
UNION ALL
SELECT 'h2', r.id::text, format('état %s, payé %s, total %s, encaissé %s, remboursé %s', r.booking_state, r.paid_amount, r.total_amount, COALESCE(p.cashed, 0), r.refunded_amount)
  FROM public.hall_reservations r
  LEFT JOIN LATERAL (SELECT sum(pp.amount) AS cashed FROM public.payments pp
                      WHERE pp.hall_reservation_id = r.id AND pp.status::text IN ('SUCCESS', 'PARTIAL', 'REFUNDED')
                        AND NOT (pp.metadata ? 'refund_reason')) p ON TRUE
 WHERE r.price_amount IS NOT NULL
   AND ((r.booking_state = 'EN_ATTENTE_PAIEMENT' AND r.paid_amount <> 0)
     OR (r.booking_state = 'ACOMPTE_PAYE' AND NOT (r.paid_amount > 0 AND r.paid_amount < r.total_amount))
     OR (r.booking_state = 'PAYEE' AND r.paid_amount <> r.total_amount)
     OR r.paid_amount <> COALESCE(p.cashed, 0)
     OR r.refunded_amount > r.paid_amount)
UNION ALL
SELECT 'h3', r.id::text, format('prix %s, frais %s, total %s, acompte %s (%s + %s), solde %s', r.price_amount, r.service_fee_amount, r.total_amount,
                                r.deposit_amount, r.deposit_price, r.deposit_service_fee, r.balance_amount)
  FROM public.hall_reservations r
 WHERE r.price_amount IS NOT NULL
   AND (r.total_amount <> r.price_amount + r.service_fee_amount
     OR r.deposit_amount <> r.deposit_price + r.deposit_service_fee
     OR r.balance_amount <> r.total_amount - r.deposit_amount
     OR r.deposit_price < 1 OR r.deposit_price > r.price_amount)
UNION ALL
SELECT 'h4', p.id::text, format('vente au grand livre %s pour une part de la salle de %s, disponible %s (fin %s)',
                                COALESCE(l.amount::text, 'absente'), p.partner_payout_amount, l.available_at, upper(r.slot))
  FROM public.payments p
  JOIN public.hall_reservations r ON r.id = p.hall_reservation_id
  LEFT JOIN public.finance_ledger l ON l.source_key = 'VENTE-' || p.id::text
 WHERE p.payment_target::text = 'HALL_RESERVATION' AND p.status::text IN ('SUCCESS', 'PARTIAL', 'REFUNDED')
   AND NOT (p.metadata ? 'refund_reason') AND COALESCE(p.partner_payout_amount, 0) > 0
   AND (l.id IS NULL OR l.amount <> p.partner_payout_amount
        OR (COALESCE(p.payout_hold_enabled, true) AND l.available_at < (upper(r.slot) AT TIME ZONE 'Africa/Dakar')))
ORDER BY 1, 2`;

export async function lot10aViolations(): Promise<Lot10aViolation[]> {
    return inspect(async (c) => {
        const { rows: present } = await c.query<{ ok: boolean }>(PRESENT_SQL);
        if (!present[0]?.ok) return [];
        const { rows } = await c.query<Lot10aViolation>(RULES_SQL);
        return rows;
    });
}

export async function assertLot10aInvariants(label: string): Promise<void> {
    await assertFinition3dInvariants(label);
    const violations = await lot10aViolations();
    console.log(`[INVARIANT-LOT10A] ${label} — (h1)(h2)(h3)(h4) : ${violations.length} violation(s)`);
    for (const v of violations) console.log(`[INVARIANT-LOT10A] ${v.regle} ${v.objet} : ${v.detail}`);
    assert.deepEqual(violations, [], `[INVARIANT-LOT10A] ${label} : violations`);
}
