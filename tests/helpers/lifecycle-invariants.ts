/**
 * Lot 5 — invariant du cycle de vie de l'événement (tâche 5.12, contrat K), extension des invariants des
 * lots 2 à 4, vérifié à la fin de chaque suite du lot par une requête SQL sur la base LOCALE (lecture seule) :
 *  (j) pour chaque événement : au moins une ligne d'historique ; première ligne NULL → BROUILLON (canal
 *      CREATION) ; chaque ligne suivante part du statut où menait la précédente ; chaque couple
 *      (ancien, nouveau, rôle, canal) figure dans event_status_transitions ; la dernière ligne mène à
 *      events.status. Ordre des lignes : created_at, puis txid, puis id ;
 *  (k) après le passage du cron (RPC events_finish_overdue, appelée ici par le service_role comme la
 *      route /api/cron/events-finish), aucun événement PUBLIE dont la fin (event_end_at) est dépassée de
 *      plus d'une heure ;
 *  (l) pour chaque événement qui a des billets, des scans ou des caisses, les fonctions de la page de
 *      pilotage égalent des requêtes indépendantes :
 *        - pilotage_compute_overview(event_id) -> 'tickets' ->> 'sold' = billets VALIDE et UTILISE hors
 *          invitations (sale_channel INVITATION) ;
 *        - pilotage_compute_overview(event_id) -> 'entries' ->> 'total' = scans acceptés = billets UTILISE ;
 *        - pilotage_compute_cash(event_id) -> 'shifts' : une entrée par caisse de l'événement
 *          (`id`, `cash_collected`), avec cash_collected = expected_cash_total = Σ des paiements hors
 *          plateforme SUCCESS rattachés à la caisse.
 * La requête vise la base CIBLE du contrat : avant correctif, elle échoue (relation ou fonction absente).
 * La sortie brute est imprimée (rapport du lot 5, section 4).
 */
import assert from 'node:assert/strict';
import { inspect } from './db';
import { assertAccessInvariants } from './access-invariants';
import { getServiceRoleClient } from '../../lib/supabase/server';

/** Forme minimale de pilotage_compute_overview(event_id) lue par (l) ; la fonction peut rendre d'autres clés. */
export interface PilotageOverviewCore {
    tickets: { sold: number };
    entries: { total: number };
}

/** Forme minimale de pilotage_compute_cash(event_id) lue par (l) : une entrée par caisse de l'événement. */
export interface PilotageCashCore {
    shifts: Array<{ id: string; cash_collected: number }>;
}

export const LIFECYCLE_INVARIANT_SQL = `
WITH hist AS (
    SELECT h.event_id,
           h.old_status::text AS old_status,
           h.new_status::text AS new_status,
           h.actor_role::text AS actor_role,
           h.channel::text AS channel,
           row_number() OVER w AS rang,
           lag(h.new_status::text) OVER w AS prev_new,
           count(*) OVER (PARTITION BY h.event_id) AS total
      FROM public.event_status_history h
    WINDOW w AS (PARTITION BY h.event_id ORDER BY h.created_at, h.txid, h.id)
), concerned AS (
    SELECT event_id FROM public.tickets WHERE event_id IS NOT NULL
    UNION
    SELECT event_id FROM public.ticket_scans WHERE event_id IS NOT NULL
    UNION
    SELECT event_id FROM public.controller_shifts
), truth AS MATERIALIZED (
    SELECT c.event_id,
           (SELECT count(*) FROM public.tickets t
             WHERE t.event_id = c.event_id AND t.status IN ('VALIDE', 'UTILISE')
               AND t.sale_channel IS DISTINCT FROM 'INVITATION') AS sold,
           (SELECT count(*) FROM public.ticket_scans s WHERE s.event_id = c.event_id AND s.accepted) AS accepted_scans,
           (SELECT count(*) FROM public.tickets t WHERE t.event_id = c.event_id AND t.status = 'UTILISE') AS used_tickets,
           public.pilotage_compute_overview(c.event_id) AS overview,
           public.pilotage_compute_cash(c.event_id) AS cash
      FROM concerned c
), shift_cash AS (
    SELECT shift_id, sum(amount) AS amount FROM public.payments
     WHERE shift_id IS NOT NULL AND NOT is_platform_payment AND status = 'SUCCESS'
     GROUP BY shift_id
), cash_rows AS (
    SELECT tr.event_id, x.value->>'id' AS shift_id, x.value->>'cash_collected' AS cash_collected
      FROM truth tr
     CROSS JOIN LATERAL jsonb_array_elements(
           CASE WHEN jsonb_typeof(tr.cash->'shifts') = 'array' THEN tr.cash->'shifts' ELSE '[]'::jsonb END) AS x(value)
)
SELECT 'j' AS regle, e.id::text AS objet, format('événement %s sans aucune ligne d''historique', e.status) AS detail
  FROM public.events e
 WHERE NOT EXISTS (SELECT 1 FROM public.event_status_history x WHERE x.event_id = e.id)
UNION ALL
SELECT 'j', h.event_id::text,
       format('première ligne %s → %s (canal %s), attendu NULL → BROUILLON (canal CREATION)',
              coalesce(h.old_status, 'NULL'), h.new_status, h.channel)
  FROM hist h
 WHERE h.rang = 1 AND NOT (h.old_status IS NULL AND h.new_status = 'BROUILLON' AND h.channel = 'CREATION')
UNION ALL
SELECT 'j', h.event_id::text,
       format('ligne %s : %s → %s, alors que la ligne précédente mène à %s', h.rang, coalesce(h.old_status, 'NULL'), h.new_status, h.prev_new)
  FROM hist h
 WHERE h.rang > 1 AND h.old_status IS DISTINCT FROM h.prev_new
UNION ALL
SELECT 'j', h.event_id::text,
       format('ligne %s : %s → %s par %s (canal %s) absente de event_status_transitions',
              h.rang, coalesce(h.old_status, 'NULL'), h.new_status, coalesce(h.actor_role, 'NULL'), h.channel)
  FROM hist h
 WHERE h.rang > 1 AND NOT EXISTS (
       SELECT 1 FROM public.event_status_transitions t
        WHERE t.from_status::text = h.old_status AND t.to_status::text = h.new_status
          AND t.actor_kind::text = h.actor_role AND t.channel::text = h.channel)
UNION ALL
SELECT 'j', e.id::text, format('statut %s, alors que la dernière ligne d''historique mène à %s', e.status, h.new_status)
  FROM public.events e
  JOIN hist h ON h.event_id = e.id AND h.rang = h.total
 WHERE h.new_status IS DISTINCT FROM e.status::text
UNION ALL
SELECT 'k', e.id::text,
       format('événement PUBLIE dont la fin (%s à Dakar) est dépassée de plus d''une heure après le passage du cron',
              to_char(public.event_end_at(e.id) AT TIME ZONE 'Africa/Dakar', 'DD/MM/YYYY HH24:MI'))
  FROM public.events e
 WHERE e.status::text = 'PUBLIE' AND public.event_end_at(e.id) < now() - interval '1 hour'
UNION ALL
SELECT 'l', tr.event_id::text,
       format('pilotage_compute_overview : vendus %s, vérité en base %s (billets VALIDE et UTILISE hors invitations)',
              coalesce(tr.overview->'tickets'->>'sold', 'absent'), tr.sold)
  FROM truth tr
 WHERE (tr.overview->'tickets'->>'sold')::numeric IS DISTINCT FROM tr.sold
UNION ALL
SELECT 'l', tr.event_id::text,
       format('pilotage_compute_overview : entrées %s, scans acceptés %s', coalesce(tr.overview->'entries'->>'total', 'absent'), tr.accepted_scans)
  FROM truth tr
 WHERE (tr.overview->'entries'->>'total')::numeric IS DISTINCT FROM tr.accepted_scans
UNION ALL
SELECT 'l', tr.event_id::text,
       format('pilotage_compute_overview : entrées %s, billets UTILISE %s', coalesce(tr.overview->'entries'->>'total', 'absent'), tr.used_tickets)
  FROM truth tr
 WHERE (tr.overview->'entries'->>'total')::numeric IS DISTINCT FROM tr.used_tickets
UNION ALL
SELECT 'l', tr.event_id::text,
       format('pilotage_compute_cash : clé shifts %s, tableau attendu', coalesce(jsonb_typeof(tr.cash->'shifts'), 'absente'))
  FROM truth tr
 WHERE jsonb_typeof(tr.cash->'shifts') IS DISTINCT FROM 'array'
UNION ALL
SELECT 'l', c.id::text,
       format('caisse %s de l''événement %s : %s entrée(s) dans pilotage_compute_cash, attendu 1', c.status, c.event_id, count(cr.shift_id))
  FROM public.controller_shifts c
  LEFT JOIN cash_rows cr ON cr.event_id = c.event_id AND cr.shift_id = c.id::text
 GROUP BY c.id, c.status, c.event_id
HAVING count(cr.shift_id) <> 1
UNION ALL
SELECT 'l', coalesce(cr.shift_id, 'NULL'), format('pilotage_compute_cash(%s) rend une caisse qui n''est pas de cet événement', cr.event_id)
  FROM cash_rows cr
 WHERE NOT EXISTS (SELECT 1 FROM public.controller_shifts c WHERE c.id::text = cr.shift_id AND c.event_id = cr.event_id)
UNION ALL
SELECT 'l', c.id::text,
       format('caisse %s : espèces au pilotage %s, total attendu %s, paiements rattachés %s',
              c.status, coalesce(cr.cash_collected, 'absent'), c.expected_cash_total, coalesce(sc.amount, 0))
  FROM public.controller_shifts c
  JOIN cash_rows cr ON cr.event_id = c.event_id AND cr.shift_id = c.id::text
  LEFT JOIN shift_cash sc ON sc.shift_id = c.id
 WHERE cr.cash_collected::numeric IS DISTINCT FROM c.expected_cash_total
    OR cr.cash_collected::numeric IS DISTINCT FROM coalesce(sc.amount, 0)
ORDER BY 1, 2`;

interface Violation { regle: string; objet: string; detail: string }

export async function lifecycleViolations(): Promise<Violation[]> {
    return inspect(async (db) => (await db.query<Violation>(LIFECYCLE_INVARIANT_SQL)).rows);
}

/** Taille d'un passage du cron ; on repasse tant qu'un passage est plein. */
const FINISH_BATCH = 500;
const FINISH_MAX_ROUNDS = 20;

/**
 * Passage du cron 5.4 : RPC events_finish_overdue({ limit }) par le service_role, comme
 * /api/cron/events-finish. Exige `{ ok: true, finished, ids }` et renvoie le nombre d'événements terminés.
 */
export async function finishOverdueEvents(): Promise<{ finished: number; ids: string[] }> {
    const service = getServiceRoleClient();
    let finished = 0;
    const ids: string[] = [];
    for (let round = 1; round <= FINISH_MAX_ROUNDS; round++) {
        const { data, error } = await service.rpc('events_finish_overdue', { p: { limit: FINISH_BATCH } });
        assert.equal(error, null, `events_finish_overdue : ${error?.message} (code ${error?.code})`);
        const body = (data ?? {}) as { ok?: boolean; finished?: unknown; ids?: unknown };
        assert.equal(body.ok, true, `events_finish_overdue refusé : ${JSON.stringify(data)}`);
        const n = Number(body.finished);
        assert.ok(Number.isInteger(n) && n >= 0, `events_finish_overdue : finished invalide (${JSON.stringify(data)})`);
        assert.ok(Array.isArray(body.ids), `events_finish_overdue : ids absent (${JSON.stringify(data)})`);
        finished += n;
        ids.push(...(body.ids as unknown[]).map(String));
        if (n < FINISH_BATCH) return { finished, ids };
    }
    throw new Error(`events_finish_overdue : encore des événements à terminer après ${FINISH_MAX_ROUNDS} passages de ${FINISH_BATCH}`);
}

/** À appeler dans after() de chaque suite du lot 5 : invariants (a) à (i), passage du cron, puis (j)(k)(l). */
export async function assertLifecycleInvariants(label: string): Promise<void> {
    await assertAccessInvariants(label);
    const cron = await finishOverdueEvents();
    console.log(`[INVARIANT-CYCLE] ${label} — cron events_finish_overdue : ${cron.finished} événement(s) passé(s) à TERMINE`);
    const rows = await lifecycleViolations();
    console.log(`[INVARIANT-CYCLE] ${label} — (j)(k)(l) : ${rows.length} violation(s)`);
    for (const r of rows) console.log(`[INVARIANT-CYCLE]   (${r.regle}) ${r.objet} : ${r.detail}`);
    assert.deepEqual(rows, [], `invariant du cycle de vie violé :\n${rows.map((r) => `(${r.regle}) ${r.objet} : ${r.detail}`).join('\n')}`);
}
