/**
 * Lot 12a (commandes : argent et sécurité) — invariants des commandes d'établissement, vérifiés à la fin de chaque suite
 * du lot, par une requête SQL sur TOUTE la base LOCALE (lecture seule), après les invariants des livraisons précédentes
 * (assertLot11aInvariants, qui enchaîne les lots 10a, finitions, lots 9… et l'invariant financier).
 *
 *  (o1) Montants : total = articles + frais de zone ; articles = Σ des lignes ; ligne = prix figé × quantité.
 *  (o2) Payé = Σ des paiements de la commande encaissés (SUCCESS, PARTIAL ou REFUNDED, hors paiement arrivé trop tard :
 *       metadata.refund_reason), part des produits et frais séparément ; remboursé ≤ payé.
 *  (o3) État et argent : en attente de paiement → rien de payé ; reçue et au-delà (hors paiement à la remise) → au moins la
 *       part payée au départ ; remise → payé en ligne + noté sur place = total ; jamais de paiement sur place pour une
 *       commande payée en entier en ligne.
 *  (o4) Chaque paiement de commande encaissé a sa vente au grand livre, du montant de la part de la partenaire, disponible
 *       au plus tôt à l'heure prévue de la remise (si la garde des ventes est active sur le paiement) ; aucun paiement hors
 *       plateforme pour une commande d'établissement.
 *  (o5) Portions du plat du jour : vendues = Σ des quantités des commandes qui les tiennent encore (stock pris, pas rendu) ;
 *       une commande close autrement que remise ou non retirée a rendu son stock.
 *  (o6) Code de remise : seulement pour une commande à retirer prête ou une livraison en route ; jamais pour une commande
 *       close ; toujours une empreinte (64 caractères hexadécimaux).
 *  (o7) Le code n'est jamais gardé en clair : aucune ligne terminée de la boîte d'envoi d'un avis de commande ne le porte,
 *       aucune ligne de cloche (IN_APP) ne l'a jamais porté, aucune notification in-app ne le contient dans ses données.
 *
 * Une colonne absente (preuve des rouges, avant la migration) ne donne aucune violation. Sortie brute `[INVARIANT-LOT12A]`.
 */
import assert from 'node:assert/strict';
import { inspect } from './db';
import { assertLot11aInvariants } from './lot11a-invariants';
import type { RecetteViolation } from './recette-invariants';

export type Lot12aViolation = RecetteViolation;

const PRESENT_SQL = `SELECT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'order_state') AS ok`;

const CASHED = `pp.status::text IN ('SUCCESS', 'PARTIAL', 'REFUNDED') AND NOT (pp.metadata ? 'refund_reason')`;

const RULES_SQL = `
SELECT 'o1'::text AS regle, o.id::text AS objet,
       format('articles %s, zone %s, total %s, lignes %s, ligne fausse %s', o.items_amount, o.delivery_fee, o.goods_total, COALESCE(l.s, 0), COALESCE(l.bad, 0)) AS detail
  FROM public.orders o
  LEFT JOIN LATERAL (SELECT sum(i.total_price) AS s, count(*) FILTER (WHERE i.total_price <> i.unit_price * i.quantity) AS bad
                       FROM public.order_items i WHERE i.order_id = o.id) l ON TRUE
 WHERE o.venue_id IS NOT NULL
   AND (o.goods_total <> o.items_amount + o.delivery_fee OR o.items_amount <> COALESCE(l.s, 0) OR COALESCE(l.bad, 0) > 0)
UNION ALL
SELECT 'o2', o.id::text, format('payé %s + frais %s, encaissé %s + %s, remboursé %s', o.paid_goods, o.paid_fees, COALESCE(p.goods, 0), COALESCE(p.fees, 0), o.refunded_amount)
  FROM public.orders o
  LEFT JOIN LATERAL (SELECT sum(pp.facial_amount) AS goods, sum(pp.service_fee) AS fees FROM public.payments pp
                      WHERE pp.order_id = o.id AND ${CASHED}) p ON TRUE
 WHERE o.venue_id IS NOT NULL
   AND (o.paid_goods <> COALESCE(p.goods, 0) OR o.paid_fees <> COALESCE(p.fees, 0) OR o.refunded_amount > o.paid_goods + o.paid_fees)
UNION ALL
SELECT 'o3', o.id::text, format('état %s, mode de paiement %s, payé %s (au départ %s), sur place %s, total %s', o.order_state, o.payment_type, o.paid_goods, o.first_goods, o.onsite_amount, o.goods_total)
  FROM public.orders o
 WHERE o.venue_id IS NOT NULL
   AND ((o.order_state = 'EN_ATTENTE_PAIEMENT' AND o.paid_goods <> 0)
     OR (o.order_state IN ('RECUE', 'ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'EN_ROUTE', 'REMISE') AND o.paid_goods < o.first_goods)
     OR (o.order_state = 'REMISE' AND o.paid_goods + COALESCE(o.onsite_amount, 0) <> o.goods_total)
     OR (o.payment_type::text = 'INTEGRAL' AND o.onsite_amount IS NOT NULL))
UNION ALL
SELECT 'o4', pp.id::text, format('vente au grand livre %s pour une part de la partenaire de %s, disponible %s (heure prévue %s)',
                                 COALESCE(l.amount::text, 'absente'), pp.partner_payout_amount, l.available_at, o.scheduled_for)
  FROM public.payments pp
  JOIN public.orders o ON o.id = pp.order_id AND o.venue_id IS NOT NULL
  LEFT JOIN public.finance_ledger l ON l.source_key = 'VENTE-' || pp.id::text
 WHERE pp.payment_target::text = 'ORDER' AND ${CASHED} AND COALESCE(pp.partner_payout_amount, 0) > 0
   AND (l.id IS NULL OR l.amount <> pp.partner_payout_amount
        OR (COALESCE(pp.payout_hold_enabled, true) AND l.available_at < o.scheduled_for))
UNION ALL
SELECT 'o4', pp.id::text, format('paiement %s hors plateforme pour une commande d’établissement', pp.status)
  FROM public.payments pp JOIN public.orders o ON o.id = pp.order_id AND o.venue_id IS NOT NULL
 WHERE NOT pp.is_platform_payment
UNION ALL
SELECT 'o5', d.product_id::text || '/' || d.day::text, format('portions vendues %s, tenues par les commandes %s', d.sold, COALESCE(h.q, 0))
  FROM public.product_daily_portions d
  LEFT JOIN LATERAL (SELECT sum(i.quantity) AS q FROM public.order_items i JOIN public.orders o ON o.id = i.order_id
                      WHERE i.product_id = d.product_id AND i.portion_day = d.day AND o.stock_taken AND o.stock_released_at IS NULL) h ON TRUE
 WHERE d.sold <> COALESCE(h.q, 0)
UNION ALL
SELECT 'o5', o.id::text, format('commande %s close sans rendre son stock', o.order_state)
  FROM public.orders o
 WHERE o.venue_id IS NOT NULL AND o.stock_taken AND o.stock_released_at IS NULL
   AND o.order_state IN ('EXPIREE', 'REFUSEE', 'SANS_REPONSE', 'ANNULEE_CLIENT', 'ANNULEE_PARTENAIRE', 'ANNULEE_EV')
UNION ALL
SELECT 'o6', o.id::text, format('état %s, mode %s, empreinte %s', o.order_state, o.delivery_mode, left(o.code_hash, 8))
  FROM public.orders o
 WHERE o.venue_id IS NOT NULL AND o.code_hash IS NOT NULL
   AND (o.code_hash !~ '^[0-9a-f]{64}$' OR o.closed_at IS NOT NULL
        OR NOT ((o.delivery_mode::text = 'RETRAIT' AND o.order_state = 'PRETE') OR (o.delivery_mode::text = 'LIVRAISON' AND o.order_state = 'EN_ROUTE')))
UNION ALL
SELECT 'o7', b.id::text, format('%s %s (%s) garde le code', b.type, b.channel, b.status)
  FROM public.notification_outbox b
 WHERE b.type LIKE 'ORDER\\_%' AND b.template_data ? 'code'
   AND (b.channel = 'IN_APP' OR b.status IN ('SENT', 'FAILED', 'SKIPPED', 'CANCELLED', 'UNCERTAIN'))
UNION ALL
SELECT 'o7', x.id::text, 'notification in-app d’une commande avec un code dans ses données'
  FROM public.notifications x
 WHERE x.metadata ? 'order_number' AND x.metadata ? 'code'
ORDER BY 1, 2`;

export async function lot12aViolations(): Promise<Lot12aViolation[]> {
    return inspect(async (c) => {
        const { rows: present } = await c.query<{ ok: boolean }>(PRESENT_SQL);
        if (!present[0]?.ok) return [];
        const { rows } = await c.query<Lot12aViolation>(RULES_SQL);
        return rows;
    });
}

export async function assertLot12aInvariants(label: string): Promise<void> {
    await assertLot11aInvariants(label);
    const violations = await lot12aViolations();
    console.log(`[INVARIANT-LOT12A] ${label} — (o1)(o2)(o3)(o4)(o5)(o6)(o7) : ${violations.length} violation(s)`);
    for (const v of violations) console.log(`[INVARIANT-LOT12A] ${v.regle} ${v.objet} : ${v.detail}`);
    assert.deepEqual(violations, [], `[INVARIANT-LOT12A] ${label} : violations`);
}
