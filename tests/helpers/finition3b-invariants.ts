/**
 * Finition 3b (administration claire) — invariants de la finition, vérifiés à la fin de chaque suite nouvelle de la
 * finition, par une requête SQL sur TOUTE la base LOCALE (lecture seule). Après les invariants des livraisons précédentes
 * (assertFinition3aInvariants), règle (h1) :
 *  (h1) « À faire aujourd'hui » (admin_todo, toutes les lignes) est égal à un recalcul indépendant, dans la même
 *       instruction (même instantané, même now()) : événements EN_ATTENTE ; fiches partenaires EN_ATTENTE et dossiers
 *       complétés ; événements SUSPENDU et partage passé / à venir (fin recalculée ici : date et heure de fin à Dakar, ou
 *       début + 6 h) ; caisses clôturées à l'écart non validé et nombre d'événements ; envois FAILED terminés depuis
 *       minuit à Dakar ; créances ouvertes (nombre et reste) ; plafond des SMS optionnels lu dans platform_settings.
 *       Aucune ligne « unavailable ».
 * Sortie brute `[INVARIANT-FINITION3B]`. La fonction absente est un échec qui la nomme, jamais une erreur Postgres brute.
 */
import assert from 'node:assert/strict';
import { inspect } from './db';
import { assertFinition3aInvariants } from './finition3a-invariants';
import type { RecetteViolation } from './recette-invariants';

export type Finition3bViolation = RecetteViolation;

export const ALL_TODO_LINES = ['to_resume', 'events_to_validate', 'partners_to_validate', 'events_suspended',
    'cash_discrepancies', 'failed_sends', 'sms_cap', 'debts'] as const;

/** Une seule instruction : admin_todo et le recalcul indépendant voient le même instantané et le même now(). */
export const FINITION3B_TODO_ORACLE_SQL = `
WITH t AS (SELECT public.admin_todo(jsonb_build_object('lines', to_jsonb($1::text[]))) -> 'lines' AS l),
day AS (SELECT ((now() AT TIME ZONE 'Africa/Dakar')::date)::timestamp AT TIME ZONE 'Africa/Dakar' AS start),
o AS (
    SELECT (SELECT count(*) FROM public.events e WHERE e.status::text = 'EN_ATTENTE') AS events_to_validate,
           (SELECT count(*) FROM public.partners pa WHERE pa.status::text = 'EN_ATTENTE') AS partners,
           (SELECT count(*) FROM public.partners pa WHERE pa.status::text = 'EN_ATTENTE' AND pa.resubmitted_at IS NOT NULL) AS resubmitted,
           (SELECT count(*) FROM public.events e WHERE e.status::text = 'SUSPENDU') AS suspended,
           (SELECT count(*) FROM public.events e WHERE e.status::text = 'SUSPENDU'
               AND (CASE WHEN e.end_date IS NOT NULL
                         THEN (e.end_date + COALESCE(e.end_time, time '23:59')) AT TIME ZONE 'Africa/Dakar'
                         ELSE ((e.start_date + COALESCE(e.start_time, time '00:00')) AT TIME ZONE 'Africa/Dakar') + interval '6 hours'
                    END) < now()) AS suspended_past,
           (SELECT count(*) FROM public.controller_shifts s
             WHERE s.status = 'CLOTURE' AND s.discrepancy_amount IS NOT NULL AND s.discrepancy_amount <> 0
               AND s.discrepancy_validated_at IS NULL) AS cash,
           (SELECT count(DISTINCT s.event_id) FROM public.controller_shifts s
             WHERE s.status = 'CLOTURE' AND s.discrepancy_amount IS NOT NULL AND s.discrepancy_amount <> 0
               AND s.discrepancy_validated_at IS NULL) AS cash_events,
           (SELECT count(*) FROM public.notification_outbox n, day
             WHERE n.status = 'FAILED' AND COALESCE(n.finished_at, n.created_at) >= day.start) AS failed,
           (SELECT count(*) FROM public.finance_debts d WHERE d.remaining > 0) AS debts,
           (SELECT COALESCE(sum(d.remaining), 0) FROM public.finance_debts d WHERE d.remaining > 0) AS debts_amount,
           (SELECT (ps.value->>'value')::integer FROM public.platform_settings ps WHERE ps.key = 'notif.sms_optional_daily_cap') AS cap
)
SELECT * FROM (
    SELECT 'h1'::text AS regle, k AS objet, 'ligne indisponible : ' || (t.l->k)::text AS detail
      FROM t, unnest($1::text[]) k WHERE (t.l->k->>'unavailable')::boolean IS TRUE
    UNION ALL SELECT 'h1', 'événements à valider', format('%s ≠ %s', t.l->'events_to_validate'->>'count', o.events_to_validate)
      FROM t, o WHERE (t.l->'events_to_validate'->>'count')::bigint IS DISTINCT FROM o.events_to_validate
    UNION ALL SELECT 'h1', 'candidatures', format('%s / %s ≠ %s / %s', t.l->'partners_to_validate'->>'count', t.l->'partners_to_validate'->>'resubmitted', o.partners, o.resubmitted)
      FROM t, o WHERE (t.l->'partners_to_validate'->>'count')::bigint IS DISTINCT FROM o.partners
                   OR (t.l->'partners_to_validate'->>'resubmitted')::bigint IS DISTINCT FROM o.resubmitted
    UNION ALL SELECT 'h1', 'événements suspendus', format('%s (passés %s) ≠ %s (passés %s)', t.l->'events_suspended'->>'count', t.l->'events_suspended'->>'past', o.suspended, o.suspended_past)
      FROM t, o WHERE (t.l->'events_suspended'->>'count')::bigint IS DISTINCT FROM o.suspended
                   OR (t.l->'events_suspended'->>'past')::bigint IS DISTINCT FROM o.suspended_past
                   OR (t.l->'events_suspended'->>'upcoming')::bigint IS DISTINCT FROM o.suspended - o.suspended_past
    UNION ALL SELECT 'h1', 'écarts de caisse', format('%s sur %s événement(s) ≠ %s sur %s', t.l->'cash_discrepancies'->>'count', t.l->'cash_discrepancies'->>'events_count', o.cash, o.cash_events)
      FROM t, o WHERE (t.l->'cash_discrepancies'->>'count')::bigint IS DISTINCT FROM o.cash
                   OR (t.l->'cash_discrepancies'->>'events_count')::bigint IS DISTINCT FROM o.cash_events
                   OR jsonb_array_length(t.l->'cash_discrepancies'->'events') <> LEAST(o.cash_events, 3)
    UNION ALL SELECT 'h1', 'envois en échec', format('%s ≠ %s', t.l->'failed_sends'->>'count', o.failed)
      FROM t, o WHERE (t.l->'failed_sends'->>'count')::bigint IS DISTINCT FROM o.failed
    UNION ALL SELECT 'h1', 'créances', format('%s (%s) ≠ %s (%s)', t.l->'debts'->>'count', t.l->'debts'->>'amount', o.debts, o.debts_amount)
      FROM t, o WHERE (t.l->'debts'->>'count')::bigint IS DISTINCT FROM o.debts
                   OR (t.l->'debts'->>'amount')::numeric IS DISTINCT FROM o.debts_amount
    UNION ALL SELECT 'h1', 'plafond des SMS optionnels', format('%s ≠ %s', t.l->'sms_cap'->>'cap', o.cap)
      FROM t, o WHERE (t.l->'sms_cap'->>'cap')::integer IS DISTINCT FROM o.cap
                   OR (t.l->'sms_cap'->>'alert')::boolean IS DISTINCT FROM
                      (o.cap IS NOT NULL AND o.cap > 0 AND (t.l->'sms_cap'->>'count')::bigint * 100 >= o.cap * 80)
) v
ORDER BY 1, 2`;

export async function finition3bViolations(): Promise<Finition3bViolation[]> {
    return inspect(async (c) => {
        const { rows: fn } = await c.query<{ ok: boolean }>(`SELECT to_regprocedure('public.admin_todo(jsonb)') IS NOT NULL AS ok`);
        if (!fn[0]?.ok) return [{ regle: 'h1', objet: 'public.admin_todo(jsonb)', detail: 'fonction absente (migration 20261118000001 de la finition 3b)' }];
        const { rows } = await c.query<Finition3bViolation>(FINITION3B_TODO_ORACLE_SQL, [ALL_TODO_LINES]);
        return rows;
    });
}

export async function assertFinition3bInvariants(label: string): Promise<void> {
    await assertFinition3aInvariants(label);
    const violations = await finition3bViolations();
    console.log(`[INVARIANT-FINITION3B] ${label} — (h1) : ${violations.length} violation(s)`);
    for (const v of violations) console.log(`[INVARIANT-FINITION3B] ${v.regle} ${v.objet} : ${v.detail}`);
    assert.deepEqual(violations, [], `[INVARIANT-FINITION3B] ${label} : violations`);
}
