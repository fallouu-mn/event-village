/**
 * Lot 11c-a (tables d'un événement) — invariants des ventes de tables, vérifiés à la fin de chaque suite du lot par une
 * requête SQL sur TOUTE la base LOCALE (lecture seule, transaction READ ONLY).
 *
 *  (a) Capacité en places : pour un événement qui vend des tables (au moins un type kind TABLE) et a une capacité,
 *      billets ordinaires vendus (VALIDE ou UTILISE, sans table) + Σ places des ventes de tables actives ≤ capacité.
 *  (b) Une table : au plus une vente ACTIVE, au plus une attente de paiement ACTIVE, jamais les deux à la fois.
 *  (c) Une vente de table : autant de billets reliés que de places ; Σ prix des billets = prix facial du paiement ;
 *      Σ frais des billets = frais de service du paiement.
 *  (d) Paiement d'une table : Σ remboursements PLATEFORME ≤ montant payé ; un paiement de table SUCCESS sur un
 *      événement ANNULE a son remboursement.
 *  (e) Un billet d'un type de table est toujours relié à sa vente (event_table_booking_id).
 *
 * Paiement d'une table : metadata.event_table posé par event_table_checkout (ventes et paiements tardifs compris).
 * Schéma absent (avant la migration 20261201000002) : aucune violation. Sortie brute `[INVARIANT-LOT11C]`.
 */
import assert from 'node:assert/strict';
import { inspect } from './db';

export interface Lot11cViolation { regle: string; objet: string; detail: string }

const PRESENT_SQL = `SELECT EXISTS (SELECT 1 FROM information_schema.tables
                     WHERE table_schema = 'public' AND table_name = 'event_table_bookings') AS ok`;

const RULES_SQL = `
WITH table_events AS (
    SELECT DISTINCT c.event_id FROM public.ticket_categories c WHERE c.kind = 'TABLE'
),
seats AS (
    SELECT e.id AS event_id, e.capacity,
           (SELECT count(*) FROM public.tickets t
             WHERE t.event_id = e.id AND t.event_table_booking_id IS NULL AND t.status::text IN ('VALIDE', 'UTILISE'))::int AS ticket_seats,
           (SELECT COALESCE(sum(b.seats), 0) FROM public.event_table_bookings b
             WHERE b.event_id = e.id AND b.status = 'ACTIVE')::int AS table_seats
      FROM public.events e JOIN table_events te ON te.event_id = e.id
     WHERE e.capacity IS NOT NULL
),
per_table AS (
    SELECT t.id, t.event_id, t.number,
           (SELECT count(*) FROM public.event_table_bookings b WHERE b.event_table_id = t.id AND b.status = 'ACTIVE')::int AS sold,
           (SELECT count(*) FROM public.stock_reservations s WHERE s.event_table_id = t.id AND s.status = 'ACTIVE')::int AS held
      FROM public.event_tables t
),
per_booking AS (
    SELECT b.id, b.seats, b.status, p.facial_amount, p.service_fee,
           (SELECT count(*) FROM public.tickets t WHERE t.event_table_booking_id = b.id)::int AS n,
           (SELECT COALESCE(sum(t.price), 0) FROM public.tickets t WHERE t.event_table_booking_id = b.id) AS prices,
           (SELECT COALESCE(sum(t.service_fee), 0) FROM public.tickets t WHERE t.event_table_booking_id = b.id) AS fees
      FROM public.event_table_bookings b JOIN public.payments p ON p.id = b.payment_id
),
table_payments AS (
    SELECT p.id, p.amount, p.status::text AS status, p.event_id
      FROM public.payments p
     WHERE p.payment_target::text = 'TICKET' AND p.metadata ? 'event_table'
)
SELECT 'a'::text AS regle, s.event_id::text AS objet,
       format('%s billet(s) + %s place(s) de tables = %s > capacité %s', s.ticket_seats, s.table_seats, s.ticket_seats + s.table_seats, s.capacity) AS detail
  FROM seats s
 WHERE s.ticket_seats + s.table_seats > s.capacity
UNION ALL
SELECT 'b', pt.id::text, format('table %s de l’événement %s : %s vente(s) active(s), %s attente(s) active(s)', pt.number, pt.event_id, pt.sold, pt.held)
  FROM per_table pt
 WHERE pt.sold > 1 OR pt.held > 1 OR (pt.sold > 0 AND pt.held > 0)
UNION ALL
SELECT 'c', pb.id::text, format('vente %s : %s billet(s) pour %s place(s), Σ prix %s / facial %s, Σ frais %s / frais %s',
                                pb.status, pb.n, pb.seats, pb.prices, pb.facial_amount, pb.fees, pb.service_fee)
  FROM per_booking pb
 WHERE pb.n <> pb.seats OR pb.prices IS DISTINCT FROM COALESCE(pb.facial_amount, 0) OR pb.fees IS DISTINCT FROM COALESCE(pb.service_fee, 0)
UNION ALL
SELECT 'd', tp.id::text, format('paiement %s de %s : %s remboursé(s) sur la plateforme', tp.status, tp.amount, r.total)
  FROM table_payments tp
  JOIN LATERAL (SELECT COALESCE(sum(x.amount), 0) AS total, count(*) AS n FROM public.refunds x
                 WHERE x.payment_id = tp.id AND x.settlement = 'PLATEFORME') r ON TRUE
 WHERE r.total > tp.amount
UNION ALL
SELECT 'd', tp.id::text, format('paiement %s de %s sur un événement annulé sans remboursement', tp.status, tp.amount)
  FROM table_payments tp
  JOIN public.events e ON e.id = tp.event_id
 WHERE tp.status = 'SUCCESS' AND e.status::text = 'ANNULE'
   AND NOT EXISTS (SELECT 1 FROM public.refunds x WHERE x.payment_id = tp.id AND x.settlement = 'PLATEFORME')
UNION ALL
SELECT 'e', t.id::text, format('billet %s du type de table %s sans vente reliée', t.status, c.id)
  FROM public.tickets t JOIN public.ticket_categories c ON c.id = t.category_id
 WHERE c.kind = 'TABLE' AND t.event_table_booking_id IS NULL
ORDER BY 1, 2`;

export async function lot11cViolations(): Promise<Lot11cViolation[]> {
    return inspect(async (c) => {
        const { rows: present } = await c.query<{ ok: boolean }>(PRESENT_SQL);
        if (!present[0]?.ok) return [];
        const { rows } = await c.query<Lot11cViolation>(RULES_SQL);
        return rows;
    });
}

/** Échoue avec le détail de chaque violation ; imprime une ligne de bilan comme les invariants des lots précédents. */
export async function checkLot11cInvariants(label: string): Promise<void> {
    const violations = await lot11cViolations();
    console.log(`[INVARIANT-LOT11C] ${label} — (a)(b)(c)(d)(e) : ${violations.length} violation(s)`);
    for (const v of violations) console.log(`[INVARIANT-LOT11C] ${v.regle} ${v.objet} : ${v.detail}`);
    assert.deepEqual(violations, [], `[INVARIANT-LOT11C] ${label} : violations\n${violations.map((v) => `${v.regle} ${v.objet} : ${v.detail}`).join('\n')}`);
}
