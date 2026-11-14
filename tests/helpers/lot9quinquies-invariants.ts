/**
 * Lot 9 quinquies — invariants du lot, vérifiés à la fin de chaque suite nouvelle du lot qui écrit et de
 * migration-lot9quinquies-rejouable, par une requête SQL sur TOUTE la base LOCALE (lecture seule). Après (a) à (x) et
 * (q1) à (q8) (assertLot9quaterInvariants), règles (p1) et suivantes :
 *  (p1) D1 : au plus un SMS ADMIN_REVIEW_SMS en attente (PENDING) par admin ;
 *  (p2) D1 : jamais deux SMS ADMIN_REVIEW_SMS envoyés au même admin à moins de 30 minutes d'écart ;
 *  (p3) D1 : aucun SMS ADMIN_REVIEW_SMS envoyé entre 22 h et 8 h (heure de Dakar).
 * Sortie brute `[INVARIANT-LOT9QUINQUIES]`. Échec explicite qui nomme chaque objet du lot absent (jamais d'erreur Postgres
 * brute, jamais de faux vert).
 */
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { inspect } from './db';
import { assertLot9quaterInvariants } from './lot9quater-invariants';
import type { RecetteViolation } from './recette-invariants';

export type Lot9quinquiesViolation = RecetteViolation;

export const LOT9QUINQUIES_INVARIANT_SQL = `
WITH r AS (
    SELECT o.id, o.recipient_user_id, o.status, o.sent_at
      FROM public.notification_outbox o
     WHERE o.type = 'ADMIN_REVIEW_SMS' AND o.channel = 'SMS'
)
SELECT * FROM (
    SELECT 'p1'::text AS regle, 'users.' || r.recipient_user_id::text AS objet,
           count(*)::text || ' SMS aux admins en attente pour le même admin' AS detail
      FROM r WHERE r.status = 'PENDING'
     GROUP BY r.recipient_user_id HAVING count(*) > 1
    UNION ALL
    SELECT 'p2', 'notification_outbox.' || b.id::text,
           'SMS aux admins envoyé ' || round(extract(epoch FROM (b.sent_at - a.sent_at)) / 60)::text || ' min après le précédent (30 min au moins)'
      FROM r a JOIN r b ON b.recipient_user_id = a.recipient_user_id AND b.id <> a.id
     WHERE a.status = 'SENT' AND b.status = 'SENT' AND b.sent_at >= a.sent_at AND b.sent_at < a.sent_at + interval '30 minutes'
       AND (b.sent_at > a.sent_at OR b.id > a.id)
    UNION ALL
    SELECT 'p3', 'notification_outbox.' || r.id::text,
           'SMS aux admins envoyé la nuit (' || to_char(r.sent_at AT TIME ZONE 'Africa/Dakar', 'HH24:MI') || ' à Dakar)'
      FROM r
     WHERE r.status = 'SENT'
       AND (extract(hour FROM (r.sent_at AT TIME ZONE 'Africa/Dakar')) >= 22 OR extract(hour FROM (r.sent_at AT TIME ZONE 'Africa/Dakar')) < 8)
) v
ORDER BY regle, objet`;

/** Objets du lot exigés avant le calcul des règles (échec explicite qui nomme chaque absent). */
export const LOT9QUINQUIES_SCHEMA = {
    functions: ['notif_admin_review_sms', 'notif_admin_review_due'],
    types: ['ADMIN_REVIEW_SMS'],
} as const;

export async function missingLot9quinquiesSchema(db?: Client): Promise<string[]> {
    const run = async (c: Client) => {
        const missing: string[] = [];
        for (const fn of LOT9QUINQUIES_SCHEMA.functions) {
            const r = await c.query(`SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = $1`, [fn]);
            if (r.rowCount === 0) missing.push(`fonction public.${fn}`);
        }
        for (const t of LOT9QUINQUIES_SCHEMA.types) {
            const r = await c.query(`SELECT 1 FROM public.notification_types WHERE type = $1`, [t]);
            if (r.rowCount === 0) missing.push(`type de notification ${t}`);
        }
        return missing;
    };
    return db ? run(db) : inspect(run);
}

export async function lot9quinquiesViolations(db?: Client): Promise<Lot9quinquiesViolation[]> {
    const missing = await missingLot9quinquiesSchema(db);
    assert.deepEqual(missing, [], `schéma du lot 9 quinquies incomplet : invariants (p) impossibles à vérifier :\n${missing.join('\n')}`);
    if (db) return (await db.query<Lot9quinquiesViolation>(LOT9QUINQUIES_INVARIANT_SQL)).rows;
    return inspect(async (c) => (await c.query<Lot9quinquiesViolation>(LOT9QUINQUIES_INVARIANT_SQL)).rows);
}

/** À appeler dans after() de chaque suite nouvelle du lot 9 quinquies qui écrit : (a) à (x), (q1) à (q8), puis (p). */
export async function assertLot9quinquiesInvariants(label: string): Promise<void> {
    await assertLot9quaterInvariants(label);
    const rows = await lot9quinquiesViolations();
    console.log(`[INVARIANT-LOT9QUINQUIES] ${label} — (p) : ${rows.length} violation(s)`);
    for (const r of rows) console.log(`[INVARIANT-LOT9QUINQUIES]   (${r.regle}) ${r.objet} : ${r.detail}`);
    assert.deepEqual(rows, [], `invariants (p) violés (${label}) :\n${rows.map((r) => `(${r.regle}) ${r.objet} : ${r.detail}`).join('\n')}`);
}
