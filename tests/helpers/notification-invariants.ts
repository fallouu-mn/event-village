/**
 * Lot 6 — invariants de la boîte d'envoi (tâche 6.11, contrat O1 et O2), extension des invariants des
 * lots 2 à 5, vérifiés à la fin de chaque suite du lot 6 par une requête SQL sur la base LOCALE
 * (lecture seule), après le passage de l'envoyeur :
 *  (m) au plus une ligne SENT ou SENDING par clé d'idempotence ; aucune ligne optionnelle SENT sans
 *      préférence activée dans l'instantané de décision, ni après la désactivation de la préférence ;
 *  (n) aucun rappel SENT pour un événement non PUBLIE à l'envoi (instantané, et historique des statuts
 *      pour les envois faits avant l'heure réelle), ni à un compte sans billet VALIDE à ce moment-là
 *      (instantané, et transferts réclamés / entrées avant l'envoi) ; aucun SMS optionnel SENT dans la
 *      plage de silence ;
 *  (o) aucune ligne SENDING depuis plus de 10 minutes après le passage de l'envoyeur ; tentatives au
 *      plus égales au maximum (lui-même au plus 5) ; toute ligne FAILED, UNCERTAIN, SKIPPED ou CANCELLED
 *      a un motif.
 *
 * Ordre de assertNotificationInvariants(label) : (a) à (l) (assertLifecycleInvariants, dont le passage
 * du cron events_finish_overdue), contrôle du schéma du lot (échec explicite si une table, une colonne
 * ou une fonction manque), passage de l'envoyeur s'il existe (lib/notifications/dispatcher.ts,
 * dispatchNotifications() sans horloge : condition de (o) ; il envoie aussi les lignes dues laissées par
 * les suites précédentes, d'où la règle « personne ne compte sms.sent.length dans un after() »), puis
 * (m)(n)(o). La sortie brute est imprimée (rapport du lot 6, section 4).
 */
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { inspect } from './db';
import { assertLifecycleInvariants } from './lifecycle-invariants';

export const NOTIFICATION_INVARIANT_SQL = `
WITH o AS (SELECT * FROM public.notification_outbox),
m1 AS (SELECT 'm'::text AS regle, idempotency_key AS objet, 'plusieurs lignes SENT ou SENDING pour la même clé (' || count(*) || ')' AS detail
         FROM o WHERE status IN ('SENT','SENDING') GROUP BY idempotency_key HAVING count(*) > 1),
m2 AS (SELECT 'm', id::text, 'ligne optionnelle SENT sans préférence activée dans l''instantané'
         FROM o WHERE status = 'SENT' AND family = 'OPTIONAL'
          AND COALESCE((decision->'preference'->>'enabled')::boolean, false) IS NOT TRUE),
m3 AS (SELECT 'm', o.id::text, 'ligne optionnelle SENT alors que la préférence était désactivée depuis ' || p.updated_at
         FROM o JOIN public.notification_preferences p
           ON p.user_id = o.recipient_user_id AND p.topic = o.topic AND p.channel = o.channel
        WHERE o.status = 'SENT' AND o.family = 'OPTIONAL' AND p.enabled = false AND p.updated_at <= o.sent_at),
n1 AS (SELECT 'n', id::text, 'rappel SENT pour un événement non PUBLIE à l''envoi (instantané : ' || COALESCE(decision->'event'->>'status', 'absent') || ')'
         FROM o WHERE status = 'SENT' AND type IN ('REMINDER_J1','REMINDER_H3','CONTROLLER_REMINDER')
          AND COALESCE(decision->'event'->>'status', '') <> 'PUBLIE'),
n2 AS (SELECT 'n', o.id::text, 'rappel SENT alors que l''historique donne ' || h.new_status || ' à l''envoi'
         FROM o JOIN LATERAL (SELECT new_status FROM public.event_status_history h
                               WHERE h.event_id = o.event_id AND h.created_at <= o.sent_at
                               ORDER BY h.created_at DESC, h.txid DESC, h.id DESC LIMIT 1) h ON TRUE
        WHERE o.status = 'SENT' AND o.type IN ('REMINDER_J1','REMINDER_H3','CONTROLLER_REMINDER')
          AND o.sent_at <= now() AND h.new_status <> 'PUBLIE'),
n3 AS (SELECT 'n', id::text, 'rappel SENT à un compte sans billet VALIDE dans l''instantané'
         FROM o WHERE status = 'SENT' AND type IN ('REMINDER_J1','REMINDER_H3')
          AND COALESCE(jsonb_array_length(decision->'holder'->'valid_ticket_ids'), 0) = 0),
n4 AS (SELECT 'n', o.id::text, 'rappel SENT alors qu''aucun des billets de l''instantané n''était au compte et VALIDE à l''envoi'
         FROM o WHERE o.status = 'SENT' AND o.type IN ('REMINDER_J1','REMINDER_H3') AND o.sent_at <= now()
          AND jsonb_array_length(o.decision->'holder'->'valid_ticket_ids') > 0
          AND NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(o.decision->'holder'->'valid_ticket_ids') v(tid)
                JOIN public.tickets t ON t.id = v.tid::uuid AND t.event_id = o.event_id
               WHERE NOT EXISTS (SELECT 1 FROM public.ticket_transfers x WHERE x.ticket_id = t.id AND x.status = 'CLAIMED'
                                    AND x.from_user_id = o.recipient_user_id AND x.claimed_at <= o.sent_at)
                 AND NOT (t.checked_in_at IS NOT NULL AND t.checked_in_at <= o.sent_at))),
n5 AS (SELECT 'n', id::text, 'SMS optionnel SENT dans la plage de silence (' || COALESCE(decision->'quiet'->>'start', '?') || ' h - ' || COALESCE(decision->'quiet'->>'end', '?') || ' h)'
         FROM o WHERE status = 'SENT' AND channel = 'SMS' AND family = 'OPTIONAL'
          AND (decision->'quiet' IS NULL
               OR public.notif_in_quiet_hours(sent_at, (decision->'quiet'->>'start')::int, (decision->'quiet'->>'end')::int))),
o1 AS (SELECT 'o', id::text, 'SENDING depuis ' || claimed_at || ' après le passage de l''envoyeur'
         FROM o WHERE status = 'SENDING' AND claimed_at < now() - interval '10 minutes'),
o2 AS (SELECT 'o', id::text, 'tentatives ' || attempts || ' > maximum ' || max_attempts FROM o WHERE attempts > max_attempts OR max_attempts > 5),
o3 AS (SELECT 'o', id::text, 'ligne ' || status || ' sans motif'
         FROM o WHERE status IN ('FAILED','UNCERTAIN','SKIPPED','CANCELLED') AND (reason IS NULL OR btrim(reason) = ''))
SELECT * FROM m1 UNION ALL SELECT * FROM m2 UNION ALL SELECT * FROM m3 UNION ALL SELECT * FROM n1 UNION ALL SELECT * FROM n2
UNION ALL SELECT * FROM n3 UNION ALL SELECT * FROM n4 UNION ALL SELECT * FROM n5 UNION ALL SELECT * FROM o1
UNION ALL SELECT * FROM o2 UNION ALL SELECT * FROM o3
ORDER BY 1, 2`;

/** Ligne de violation renvoyée par NOTIFICATION_INVARIANT_SQL. */
export interface NotificationViolation { regle: string; objet: string; detail: string }

/**
 * Objets de la base lus par NOTIFICATION_INVARIANT_SQL (contrat C2, C5, D). Chacun est contrôlé avant
 * la requête : s'il manque, l'aide échoue en le nommant (pas d'erreur Postgres brute, pas de faux vert).
 */
const REQUIRED_RELATIONS: ReadonlyArray<[string, string]> = [
    ['public.notification_outbox', 'boîte d\'envoi (contrat C2, migration 20261103000002)'],
    ['public.notification_preferences', 'préférences (contrat C5, migration 20261103000002)'],
    ['public.notification_types', 'registre des types (contrat C1, migration 20261103000002)'],
];

const REQUIRED_OUTBOX_COLUMNS = [
    'id', 'idempotency_key', 'group_key', 'type', 'family', 'topic', 'channel', 'recipient_user_id', 'event_id',
    'status', 'reason', 'attempts', 'max_attempts', 'claimed_at', 'sent_at', 'decision',
] as const;

const REQUIRED_PREFERENCE_COLUMNS = ['user_id', 'topic', 'channel', 'enabled', 'updated_at'] as const;

const REQUIRED_FUNCTIONS: ReadonlyArray<[string, string]> = [
    ['public.notif_in_quiet_hours(timestamptz, integer, integer)', 'plage de silence (contrat D, migration 20261103000002)'],
];

/** Objets du lot 6 absents de la base locale, décrits en clair (liste vide : schéma complet pour les invariants). */
export async function missingNotificationSchema(db?: Client): Promise<string[]> {
    const run = async (client: Client): Promise<string[]> => {
        const missing: string[] = [];
        for (const [rel, what] of REQUIRED_RELATIONS) {
            const r = await client.query<{ ok: boolean }>('SELECT to_regclass($1) IS NOT NULL AS ok', [rel]);
            if (!r.rows[0]?.ok) missing.push(`table ${rel} absente — ${what}`);
        }
        const columns = async (table: string, wanted: readonly string[]): Promise<void> => {
            const r = await client.query<{ column_name: string }>(
                `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [table]);
            const present = new Set(r.rows.map((row) => row.column_name));
            if (present.size === 0) return; // table absente : déjà signalée ci-dessus
            for (const c of wanted) if (!present.has(c)) missing.push(`colonne public.${table}.${c} absente (contrat C2/C5)`);
        };
        await columns('notification_outbox', REQUIRED_OUTBOX_COLUMNS);
        await columns('notification_preferences', REQUIRED_PREFERENCE_COLUMNS);
        for (const [fn, what] of REQUIRED_FUNCTIONS) {
            const r = await client.query<{ ok: boolean }>('SELECT to_regprocedure($1) IS NOT NULL AS ok', [fn]);
            if (!r.rows[0]?.ok) missing.push(`fonction ${fn} absente — ${what}`);
        }
        return missing;
    };
    return db ? run(db) : inspect(run);
}

/** Échoue en nommant chaque objet manquant si le schéma du lot 6 n'est pas en place. */
export async function assertNotificationSchema(label: string, db?: Client): Promise<void> {
    const missing = await missingNotificationSchema(db);
    if (missing.length > 0) {
        console.log(`[INVARIANT-NOTIF] ${label} — schéma du lot 6 incomplet : ${missing.length} objet(s) manquant(s)`);
        for (const m of missing) console.log(`[INVARIANT-NOTIF]   ${m}`);
    }
    assert.deepEqual(missing, [], `invariants (m)(n)(o) impossibles à vérifier (${label}) : schéma du lot 6 absent :\n${missing.join('\n')}`);
}

/**
 * Violations de (m)(n)(o). Avec `db` : la requête s'exécute sur ce client, dans sa transaction (garde-fous
 * de notif-invariant.test.ts, violation fabriquée dans inRolledBackTransaction) ; sans `db` : transaction
 * READ ONLY sur une connexion neuve. Le schéma est contrôlé d'abord (échec explicite s'il manque).
 */
export async function notificationViolations(db?: Client): Promise<NotificationViolation[]> {
    await assertNotificationSchema('notificationViolations', db);
    if (db) return (await db.query<NotificationViolation>(NOTIFICATION_INVARIANT_SQL)).rows;
    return inspect(async (client) => (await client.query<NotificationViolation>(NOTIFICATION_INVARIANT_SQL)).rows);
}

/** Rapport de dispatchNotifications() (contrat E4), champs lus ici. */
export interface DispatchRunReport {
    claimed: number;
    sent: number;
    retried: number;
    failed: number;
    skipped: number;
    uncertain: number;
    cancelled: number;
    waiting: number;
    reclaimed: number;
    rounds: number;
    smsToday: number;
}

type DispatchFn = (opts?: Record<string, unknown>) => Promise<DispatchRunReport>;

const DISPATCHER_MODULE = '../../lib/notifications/dispatcher';

/**
 * Vrai seulement si le module introuvable est `spec` lui-même (et non une de ses dépendances : un
 * envoyeur présent dont un import manque doit échouer, pas passer pour absent).
 */
export function isModuleNotFound(err: unknown, spec: string): boolean {
    const e = err as { code?: string; message?: string };
    if (e?.code !== 'ERR_MODULE_NOT_FOUND' && e?.code !== 'MODULE_NOT_FOUND') return false;
    const quoted = /Cannot find (?:module|package) '([^']+)'/.exec(String(e.message ?? ''));
    if (!quoted) return false;
    const target = quoted[1].replace(/\\/g, '/').replace(/\.(ts|tsx|js|mjs|cjs)$/, '');
    const wanted = spec.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '');
    return target === wanted || target.endsWith(`/${wanted}`);
}

/**
 * Charge dispatchNotifications (lib/notifications/dispatcher.ts, contrat E4). Module absent : `null` si
 * `optional`, sinon échec explicite. Toute autre erreur de chargement remonte telle quelle.
 */
async function loadDispatcher(optional: boolean): Promise<DispatchFn | null> {
    let mod: Record<string, unknown>;
    try {
        const spec = DISPATCHER_MODULE;
        mod = (await import(spec)) as Record<string, unknown>;
    } catch (err) {
        if (isModuleNotFound(err, DISPATCHER_MODULE)) {
            if (optional) return null;
            assert.fail(`envoyeur absent : lib/notifications/dispatcher.ts (contrat E4) — ${(err as Error).message}`);
        }
        throw err;
    }
    assert.equal(typeof mod.dispatchNotifications, 'function', 'lib/notifications/dispatcher.ts : dispatchNotifications non exporté (contrat E4)');
    return mod.dispatchNotifications as DispatchFn;
}

/**
 * Passage de l'envoyeur DANS le processus du test (comme finishOverdueEvents) : dispatchNotifications()
 * SANS horloge ni filtre, exactement comme la route /api/cron/notifications-dispatch. Échoue si le module
 * est absent. Renvoie le rapport de l'envoyeur.
 */
export async function dispatchPendingNotifications(): Promise<DispatchRunReport> {
    const dispatch = await loadDispatcher(false);
    const report = await dispatch!();
    assert.ok(report && typeof report === 'object', `dispatchNotifications() : rapport absent (${JSON.stringify(report)})`);
    return report;
}

/**
 * À appeler dans after() de chaque suite du lot 6 (et à la fin de tests/seed/seed-demo.ts) :
 * (a) à (l), schéma du lot, passage de l'envoyeur s'il existe, puis (m)(n)(o).
 */
export async function assertNotificationInvariants(label: string): Promise<void> {
    await assertLifecycleInvariants(label);
    await assertNotificationSchema(label);
    const dispatch = await loadDispatcher(true);
    if (dispatch) {
        const run = await dispatch();
        assert.ok(run && typeof run === 'object', `dispatchNotifications() : rapport absent (${JSON.stringify(run)})`);
        console.log(`[INVARIANT-NOTIF] ${label} — envoyeur : ${run.claimed} ligne(s) réservée(s), ${run.reclaimed} reprise(s)`);
    } else {
        console.log(`[INVARIANT-NOTIF] ${label} — envoyeur : absent (lib/notifications/dispatcher.ts introuvable), passage non effectué`);
    }
    const rows = await notificationViolations();
    console.log(`[INVARIANT-NOTIF] ${label} — (m)(n)(o) : ${rows.length} violation(s)`);
    for (const r of rows) console.log(`[INVARIANT-NOTIF]   (${r.regle}) ${r.objet} : ${r.detail}`);
    assert.deepEqual(rows, [], `invariants (m)(n)(o) violés (${label}) :\n${rows.map((r) => `(${r.regle}) ${r.objet} : ${r.detail}`).join('\n')}`);
}
