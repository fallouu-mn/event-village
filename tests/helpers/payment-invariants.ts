/**
 * Lot 2 — invariant global de la chaîne paiement → billet, vérifié à la fin de chaque suite de
 * paiement par une requête SQL sur la base LOCALE (lecture seule, sauf la purge des réservations échues) :
 *  (a) aucun paiement SUCCESS (ou PARTIAL, lot 3) de billetterie sans ses billets (nombre exact = quantités réservées ;
 *      lot 11c-a : une table réservée compte ses places) ;
 *  (b) aucun billet payant VALIDE ou UTILISE sans paiement SUCCESS ou PARTIAL (remboursement partiel, lot 3),
 *      hors billet VALIDE « à régler sur place » d'une commande impayée (encaissement au contrôle, lot 4) ;
 *  (c) pour chaque catégorie : sold + held ≤ total, et held = somme des réservations non expirées.
 *
 * (c) est vérifié deux fois :
 *  - avant purge : held = somme des réservations au statut ACTIVE (exactitude du compteur) ;
 *  - après la purge des réservations échues (la fonction appelée par le cron) : held = somme des
 *    réservations ACTIVE dont l'échéance n'est pas passée (formulation littérale de l'invariant).
 * La sortie brute est imprimée (rapport du lot 2, section 4).
 */
import assert from 'node:assert/strict';
import { inspect, writeLocal } from './db';

export const INVARIANT_SQL = `
WITH reserved AS (
    -- Lot 11c-a (modification signalée au rapport) : une table d'un événement est une unité de réservation qui émet
    -- autant de billets que de places (seats_per_unit, 1 pour une catégorie de billets)
    SELECT r.payment_id, sum(r.quantity * c.seats_per_unit)::int AS qty
      FROM public.stock_reservations r JOIN public.ticket_categories c ON c.id = r.category_id GROUP BY r.payment_id
), issued AS (
    SELECT payment_id, count(*)::int AS n FROM public.tickets WHERE payment_id IS NOT NULL GROUP BY payment_id
), active AS (
    SELECT category_id,
           sum(quantity) FILTER (WHERE status = 'ACTIVE')::int AS q_active,
           sum(quantity) FILTER (WHERE status = 'ACTIVE' AND expires_at > now())::int AS q_live
      FROM public.stock_reservations GROUP BY category_id
)
SELECT 'a' AS regle, p.id::text AS objet,
       format('paiement %s : %s billet(s) émis pour %s réservé(s)', p.status, coalesce(i.n, 0), coalesce(r.qty, 0)) AS detail
  FROM public.payments p
  LEFT JOIN reserved r ON r.payment_id = p.id
  LEFT JOIN issued i ON i.payment_id = p.id
 WHERE p.status IN ('SUCCESS', 'PARTIAL') AND p.payment_target = 'TICKET' AND p.is_platform_payment
   AND (coalesce(i.n, 0) = 0 OR coalesce(i.n, 0) <> coalesce(r.qty, 0))
UNION ALL
SELECT 'b', t.id::text, format('billet %s à %s F sans paiement SUCCESS ni PARTIAL (%s)', t.status, t.price, coalesce(p.status::text, 'aucun paiement'))
  FROM public.tickets t
  LEFT JOIN public.payments p ON p.id = t.payment_id
 WHERE t.price > 0 AND t.status IN ('VALIDE', 'UTILISE')
   AND (p.id IS NULL OR p.status NOT IN ('SUCCESS', 'PARTIAL'))
   -- Lot 4 : billet « à régler sur place » (commande impayée, encaissement au contrôle) : état légitime
   AND NOT (t.payment_id IS NULL AND t.status = 'VALIDE' AND EXISTS (
           SELECT 1 FROM public.orders o WHERE o.id = t.order_id AND o.payment_status <> 'SUCCESS'))
   -- Lot 9 bis (R48, contrat 5.27 ; R1) : l'annulation d'un événement commencé rembourse aussi les billets déjà
   -- utilisés à l'entrée ; une fois le versement confirmé (reprise automatique), le billet reste UTILISE (l'entrée a eu
   -- lieu) et son paiement est REFUNDED : état légitime, seulement sur un événement ANNULE.
   AND NOT (t.status = 'UTILISE' AND p.status = 'REFUNDED' AND EXISTS (
           SELECT 1 FROM public.events e WHERE e.id = t.event_id AND e.status = 'ANNULE'))
UNION ALL
SELECT 'c', c.id::text, format('sold %s + held %s > total %s', c.sold_quantity, c.held_quantity, c.total_quantity)
  FROM public.ticket_categories c
 WHERE c.sold_quantity + c.held_quantity > c.total_quantity
UNION ALL
SELECT 'c', c.id::text, format('held %s ≠ réservations %s : %s', c.held_quantity,
       CASE WHEN $1::boolean THEN 'ACTIVE non échues' ELSE 'ACTIVE' END,
       CASE WHEN $1::boolean THEN coalesce(a.q_live, 0) ELSE coalesce(a.q_active, 0) END)
  FROM public.ticket_categories c
  LEFT JOIN active a ON a.category_id = c.id
 WHERE c.held_quantity <> CASE WHEN $1::boolean THEN coalesce(a.q_live, 0) ELSE coalesce(a.q_active, 0) END
ORDER BY 1, 2`;

interface Violation { regle: string; objet: string; detail: string }

async function run(strict: boolean): Promise<Violation[]> {
    return inspect(async (db) => (await db.query<Violation>(INVARIANT_SQL, [strict])).rows);
}

function print(label: string, phase: string, rows: Violation[]): void {
    console.log(`[INVARIANT] ${label} — ${phase} : ${rows.length} violation(s)`);
    for (const r of rows) console.log(`[INVARIANT]   (${r.regle}) ${r.objet} : ${r.detail}`);
}

/**
 * Purge des réservations échues puis contrôle strict, dans UNE transaction REPEATABLE READ : la purge et le contrôle
 * partagent le même now() (début de transaction) et le même instantané. Auparavant, purge (appel REST) et contrôle
 * avaient chacun leur now() : une réservation d'une autre suite arrivée à échéance entre les deux restait dans held
 * mais plus dans « ACTIVE non échues » (run 182, push-service-worker : held 1 ≠ 0). Lot 9 quinquies, signalé.
 * Un conflit de sérialisation (40001) avec une suite concurrente fait rejouer la transaction, au plus 5 fois.
 */
async function purgeThenCheck(): Promise<{ purged: unknown; after: Violation[] }> {
    for (let attempt = 1; ; attempt++) {
        try {
            return await writeLocal(async (db) => {
                await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
                try {
                    const purged = (await db.query<{ r: unknown }>('SELECT public.stock_reservations_expire() AS r')).rows[0].r;
                    const after = (await db.query<Violation>(INVARIANT_SQL, [true])).rows;
                    await db.query('COMMIT');
                    return { purged, after };
                } catch (err) {
                    await db.query('ROLLBACK');
                    throw err;
                }
            });
        } catch (err) {
            if (attempt < 5 && (err as { code?: string }).code === '40001') {
                console.log(`[INVARIANT] conflit de sérialisation à la purge, essai ${attempt + 1}`);
                continue;
            }
            throw err;
        }
    }
}

/** À appeler dans after() de chaque suite de paiement. */
export async function assertPaymentInvariants(label: string): Promise<void> {
    const before = await run(false);
    print(label, 'avant purge (held = réservations ACTIVE)', before);
    const { purged, after } = await purgeThenCheck();
    console.log(`[INVARIANT] ${label} — purge des réservations échues : ${JSON.stringify(purged)}`);
    print(label, 'après purge (held = réservations non échues)', after);
    assert.deepEqual(before, [], `invariant violé avant purge :\n${before.map((r) => `(${r.regle}) ${r.objet} : ${r.detail}`).join('\n')}`);
    assert.deepEqual(after, [], `invariant violé après purge :\n${after.map((r) => `(${r.regle}) ${r.objet} : ${r.detail}`).join('\n')}`);
}
