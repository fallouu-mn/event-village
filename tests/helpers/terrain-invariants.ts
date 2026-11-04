/**
 * Lot 7 — invariants (p)(q) du billet hors ligne et du scanner (tâche 7.6, contrat section 10), extension
 * des invariants des lots 2 à 6, vérifiés à la fin de chaque suite nouvelle du lot 7 (et du seed) par une
 * requête SQL sur la base LOCALE (lecture seule) :
 *  (p) aucun scan QR accepté avec un code d'une version de secret antérieure à la version courante du
 *      billet au moment du scan (historique ticket_secret_versions daté par clock_timestamp(), D86) ; aucun
 *      scan QR accepté sans version pour un billet dont l'historique précède le scan ; aucune version de
 *      scan supérieure à celle du billet ;
 *  (q) tout téléchargement de codes hors ligne est fait par le porteur du billet à ce moment-là (instantané
 *      de décision et historique des versions), pour la version courante, dans la fenêtre
 *      [début − 24 h ; fin + access.scan_window_after_hours], pour un billet VALIDE d'un événement PUBLIE,
 *      jamais après le compostage (tolérance d'une minute, checked_in_at étant daté par now()).
 *
 * Ordre de assertTerrainInvariants(label) : (a) à (o) (assertNotificationInvariants, passage de l'envoyeur
 * compris : aucun after() ne compte de SMS), contrôle du schéma du lot 7 (échec explicite qui nomme chaque
 * table, colonne ou trigger absent ; jamais d'erreur Postgres brute, jamais de faux vert), puis (p)(q).
 * La sortie brute est imprimée (`[INVARIANT-TERRAIN]`, recopiée par le rapport du lot 7, section 4).
 *
 * Écart au texte du contrat (10.2), plus strict : q4 est évaluée en COALESCE(…, TRUE) ; un instantané sans
 * fenêtre (clé absente, comparaison NULL) sort donc en violation au lieu d'être ignoré (fail-closed).
 */
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { inspect } from './db';
import { assertNotificationInvariants } from './notification-invariants';

export const TERRAIN_INVARIANT_SQL = `
WITH s AS (SELECT * FROM public.ticket_scans WHERE accepted AND method = 'QR'),
p1 AS (SELECT 'p'::text AS regle, s.id::text AS objet, 'scan QR accepté sans version de secret'::text AS detail
         FROM s WHERE s.secret_version IS NULL
          AND EXISTS (SELECT 1 FROM public.ticket_secret_versions h WHERE h.ticket_id = s.ticket_id AND h.created_at <= s.created_at)),
p2 AS (SELECT 'p', s.id::text, format('scan QR accepté avec la version %s alors que la version courante était %s', s.secret_version, v.version)
         FROM s JOIN LATERAL (SELECT max(h.version) AS version FROM public.ticket_secret_versions h
                               WHERE h.ticket_id = s.ticket_id AND h.created_at <= s.created_at) v ON v.version IS NOT NULL
        WHERE s.secret_version IS NOT NULL AND s.secret_version < v.version),
p3 AS (SELECT 'p', s.id::text, format('scan avec la version %s, supérieure à la version du billet %s', s.secret_version, t.security_version)
         FROM s JOIN public.tickets t ON t.id = s.ticket_id WHERE s.secret_version > t.security_version),
d AS (SELECT * FROM public.ticket_offline_downloads),
q1 AS (SELECT 'q', d.id::text, 'téléchargement par un compte qui n''était pas le porteur (instantané : ' || COALESCE(d.decision->>'holder_user_id', 'absent') || ')'
         FROM d WHERE (d.decision->>'holder_user_id') IS DISTINCT FROM d.user_id::text),
q2 AS (SELECT 'q', d.id::text, 'téléchargement par un compte qui n''était pas le porteur de la version ' || d.secret_version
         FROM d JOIN public.ticket_secret_versions h ON h.ticket_id = d.ticket_id AND h.version = d.secret_version
        WHERE h.holder_user_id IS DISTINCT FROM d.user_id),
q3 AS (SELECT 'q', d.id::text, format('lot de la version %s alors que la version courante était %s', d.secret_version, v.version)
         FROM d JOIN LATERAL (SELECT max(h.version) AS version FROM public.ticket_secret_versions h
                               WHERE h.ticket_id = d.ticket_id AND h.created_at <= d.downloaded_at) v ON v.version IS NOT NULL
        WHERE d.secret_version <> v.version),
q4 AS (SELECT 'q', d.id::text, 'téléchargement hors de la fenêtre [' || COALESCE(d.decision->>'window_opens_at', '?') || ' ; ' || COALESCE(d.decision->>'window_closes_at', '?') || ']'
         FROM d WHERE COALESCE((
                   d.downloaded_at < (d.decision->>'window_opens_at')::timestamptz
                OR d.downloaded_at > (d.decision->>'window_closes_at')::timestamptz
                OR (d.decision->>'window_opens_at')::timestamptz <> (d.decision->>'event_start_at')::timestamptz - interval '24 hours'
                OR (d.decision->>'window_closes_at')::timestamptz <> (d.decision->>'event_end_at')::timestamptz + make_interval(hours => (d.decision->>'after_hours')::int)
              ), TRUE)),
q5 AS (SELECT 'q', d.id::text, 'téléchargement d''un billet ' || COALESCE(d.decision->>'ticket_status', 'absent') || ' (événement ' || COALESCE(d.decision->>'event_status', 'absent') || ')'
         FROM d WHERE COALESCE(d.decision->>'ticket_status', '') <> 'VALIDE' OR COALESCE(d.decision->>'event_status', '') <> 'PUBLIE'),
q6 AS (SELECT 'q', d.id::text, 'téléchargement après le compostage du billet (' || t.checked_in_at || ')'
         FROM d JOIN public.tickets t ON t.id = d.ticket_id
        WHERE t.checked_in_at IS NOT NULL AND t.checked_in_at < d.downloaded_at - interval '1 minute')
SELECT * FROM p1 UNION ALL SELECT * FROM p2 UNION ALL SELECT * FROM p3 UNION ALL SELECT * FROM q1 UNION ALL SELECT * FROM q2
UNION ALL SELECT * FROM q3 UNION ALL SELECT * FROM q4 UNION ALL SELECT * FROM q5 UNION ALL SELECT * FROM q6
ORDER BY 1, 2`;

/** Ligne de violation renvoyée par TERRAIN_INVARIANT_SQL. */
export interface TerrainViolation { regle: string; objet: string; detail: string }

/** Tables du lot 7 lues par la requête (contrat M4). */
const REQUIRED_TABLES: ReadonlyArray<[string, string]> = [
    ['ticket_secret_versions', 'historique des versions du secret (contrat M4.1, migration 20261105000004)'],
    ['ticket_offline_downloads', 'journal des téléchargements hors ligne (contrat M4.5, migration 20261105000004)'],
];

/** Colonnes lues par la requête, par table (ticket_scans : contrat M5.1, migration 20261105000005). */
const REQUIRED_COLUMNS: ReadonlyArray<[string, readonly string[], string]> = [
    ['ticket_scans', ['secret_version', 'client_key'], 'contrat M5.1, migration 20261105000005'],
    ['ticket_secret_versions', ['ticket_id', 'version', 'holder_user_id', 'reason', 'created_at'], 'contrat M4.1'],
    ['ticket_offline_downloads', ['id', 'ticket_id', 'user_id', 'event_id', 'secret_version', 'downloaded_at', 'decision'], 'contrat M4.5'],
];

/** Triggers de rotation sur public.tickets (contrat M4.3) : sans eux, l'historique ne dit pas la vérité. */
const REQUIRED_TRIGGERS = ['trg_tickets_secret_issue', 'trg_tickets_secret_guard', 'trg_tickets_secret_log'] as const;

/**
 * Objets du lot 7 absents de la base locale, décrits en clair (liste vide : schéma complet pour (p)(q)).
 * Nomme `ticket_secret_versions`, `ticket_offline_downloads`, `ticket_scans.secret_version`,
 * `ticket_scans.client_key` et chaque trigger `trg_tickets_secret_*` manquant. Avec `db` : sur ce client
 * (dans sa transaction) ; sans `db` : transaction READ ONLY sur une connexion neuve.
 */
export async function missingTerrainSchema(db?: Client): Promise<string[]> {
    const run = async (client: Client): Promise<string[]> => {
        const missing: string[] = [];
        const absentTables = new Set<string>();
        for (const [table, what] of REQUIRED_TABLES) {
            const r = await client.query<{ ok: boolean }>('SELECT to_regclass($1) IS NOT NULL AS ok', [`public.${table}`]);
            if (!r.rows[0]?.ok) {
                missing.push(`table public.${table} absente — ${what}`);
                absentTables.add(table);
            }
        }
        for (const [table, wanted, what] of REQUIRED_COLUMNS) {
            if (absentTables.has(table)) continue; // déjà signalée
            const r = await client.query<{ column_name: string }>(
                `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [table]);
            const present = new Set(r.rows.map((row) => row.column_name));
            if (present.size === 0) {
                missing.push(`table public.${table} absente — ${what}`);
                continue;
            }
            for (const c of wanted) if (!present.has(c)) missing.push(`colonne public.${table}.${c} absente — ${what}`);
        }
        const t = await client.query<{ tgname: string }>(
            `SELECT tg.tgname FROM pg_trigger tg
               JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public' AND c.relname = 'tickets' AND NOT tg.tgisinternal AND tg.tgname = ANY($1::text[])`,
            [REQUIRED_TRIGGERS]);
        const triggers = new Set(t.rows.map((row) => row.tgname));
        for (const name of REQUIRED_TRIGGERS) {
            if (!triggers.has(name)) missing.push(`trigger ${name} absent de public.tickets — rotation de la version du secret (contrat M4.3, migration 20261105000004)`);
        }
        return missing;
    };
    return db ? run(db) : inspect(run);
}

/** Échoue en nommant chaque objet manquant si le schéma du lot 7 n'est pas en place. */
export async function assertTerrainSchema(label: string, db?: Client): Promise<void> {
    const missing = await missingTerrainSchema(db);
    if (missing.length > 0) {
        console.log(`[INVARIANT-TERRAIN] ${label} — schéma du lot 7 incomplet : ${missing.length} objet(s) manquant(s)`);
        for (const m of missing) console.log(`[INVARIANT-TERRAIN]   ${m}`);
    }
    assert.deepEqual(missing, [], `schéma du lot 7 incomplet (${label}) : invariants (p)(q) impossibles à vérifier :\n${missing.join('\n')}`);
}

/**
 * Violations de (p)(q). Avec `db` : la requête s'exécute sur ce client, dans sa transaction (garde-fous de
 * terrain-invariant.test.ts, violation fabriquée dans inRolledBackTransaction) ; sans `db` : transaction
 * READ ONLY sur une connexion neuve. Le schéma est contrôlé d'abord (échec explicite s'il manque).
 */
export async function terrainViolations(db?: Client): Promise<TerrainViolation[]> {
    await assertTerrainSchema('terrainViolations', db);
    if (db) return (await db.query<TerrainViolation>(TERRAIN_INVARIANT_SQL)).rows;
    return inspect(async (client) => (await client.query<TerrainViolation>(TERRAIN_INVARIANT_SQL)).rows);
}

/**
 * À appeler dans after() de chaque suite nouvelle du lot 7 (et à la fin de tests/seed/seed-demo.ts, fix(7.6)) :
 * (a) à (o) par assertNotificationInvariants (envoyeur compris), schéma du lot 7, puis (p)(q).
 */
export async function assertTerrainInvariants(label: string): Promise<void> {
    await assertNotificationInvariants(label);
    await assertTerrainSchema(label);
    const rows = await terrainViolations();
    console.log(`[INVARIANT-TERRAIN] ${label} — (p)(q) : ${rows.length} violation(s)`);
    for (const r of rows) console.log(`[INVARIANT-TERRAIN]   (${r.regle}) ${r.objet} : ${r.detail}`);
    assert.deepEqual(rows, [], `invariants (p)(q) violés (${label}) :\n${rows.map((r) => `(${r.regle}) ${r.objet} : ${r.detail}`).join('\n')}`);
}
