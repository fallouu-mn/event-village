/**
 * Lot 9 (AR6, contrat, section 6) — invariants du lot, vérifiés à la fin de chaque suite nouvelle du lot 9 qui
 * écrit, de migration-lot9-rejouable et, après les migrations, du seed de démonstration et de la recette, par une
 * requête SQL sur TOUTE la base LOCALE (lecture seule). Les règles portent les lettres (t), (u) et (v) :
 *  (t) extension de la consigne 9.0 : un billet INVITATION porte une décision INVITATION, et réciproquement ;
 *  (u) invitations : gratuites, sans paiement ; sans porteur seulement en attente de réclamation, verrouillées,
 *      avec un transfert en attente ou échu ; un transfert sans expéditeur n'existe que pour une invitation ;
 *      aucun numéro en clair au journal ; pas plus d'invitations actives que de vendus, sur les catégories
 *      passées par la vraie RPC (repérées par l'audit : les fixtures posent des compteurs sans billet) ;
 *  (v) compte : photo dans le dossier du compte, nom d'objet au format <user_id>/<uuid>.webp, une seule photo par
 *      compte ; numéro et email identiques entre le profil et l'authentification après un changement ; SMS à
 *      l'ancien numéro mis en file quand l'audit le dit.
 *
 * Ordre de assertLot9Invariants(label) : (a) à (t) par assertRecetteInvariants, contrôle du schéma du lot (échec
 * explicite qui nomme chaque objet absent ; jamais d'erreur Postgres brute, jamais de faux vert), puis (t)(u)(v).
 * La sortie brute est imprimée (`[INVARIANT-LOT9]`, filtrée par e2e/support/parcours.ts sur « [INVARIANT »).
 *
 * tests/helpers/recette-invariants.ts ne change pas (AR6) : les suites qui l'appellent gardent leur comportement
 * au run « avant ». Une suite annoncée verte dès l'écriture appelle assertRecetteInvariants : assertLot9Invariants
 * échoue tant que les migrations M2 et M4 du lot ne sont pas livrées. seed-demo et invariants-run ne passent à
 * cette aide que dans le commit de correctif (T29).
 */
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { inspect } from './db';
import { assertRecetteInvariants, type RecetteViolation } from './recette-invariants';

/** Requête des invariants (contrat 6.3) : lignes `{ regle, objet, detail }`, triées par règle puis objet. */
export const LOT9_INVARIANT_SQL = `
WITH t AS (SELECT * FROM public.tickets),
t5 AS (SELECT 't'::text AS regle, id::text AS objet, 'billet INVITATION dont la décision ne vient pas d''une invitation' AS detail
         FROM t WHERE sale_channel = 'INVITATION' AND sale_decision->>'source' NOT IN ('INVITATION', 'REPRISE')),
t6 AS (SELECT 't', id::text, 'décision INVITATION sur un billet ' || sale_channel
         FROM t WHERE sale_decision->>'source' = 'INVITATION' AND sale_channel IS DISTINCT FROM 'INVITATION'),
u1 AS (SELECT 'u', id::text, format('invitation à %s F ou rattachée à un paiement', price)
         FROM t WHERE sale_channel = 'INVITATION' AND (price <> 0 OR payment_id IS NOT NULL)),
u2 AS (SELECT 'u', t.id::text, 'invitation sans porteur, sans transfert en attente ou échu'
         FROM t WHERE sale_channel = 'INVITATION' AND user_id IS NULL AND status = 'VALIDE'
          AND NOT EXISTS (SELECT 1 FROM public.ticket_transfers x WHERE x.ticket_id = t.id AND x.status IN ('PENDING', 'EXPIRED'))),
u3 AS (SELECT 'u', t.id::text, 'billet sans porteur en attente de réclamation, non verrouillé'
         FROM t WHERE user_id IS NULL AND NOT transfer_locked
          AND EXISTS (SELECT 1 FROM public.ticket_transfers x WHERE x.ticket_id = t.id AND x.status = 'PENDING')),
u4 AS (SELECT 'u', x.id::text, 'transfert sans expéditeur sur un billet ' || t.sale_channel
         FROM public.ticket_transfers x JOIN t ON t.id = x.ticket_id
        WHERE x.from_user_id IS NULL AND t.sale_channel IS DISTINCT FROM 'INVITATION'),
journal AS (
    SELECT id, action, user_id, metadata,
           regexp_replace(COALESCE(old_value::text, '') || COALESCE(new_value::text, '') || metadata::text,
                          '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '', 'gi') AS texte
      FROM public.audit_logs
     WHERE action IN ('TICKET_INVITATIONS_SENT', 'TICKET_INVITATION_CANCELLED', 'ACCOUNT_PHONE_CHANGED', 'ACCOUNT_PROFILE_UPDATED')
),
u5 AS (SELECT 'u', id::text, action || ' : numéro en clair au journal'
         FROM journal WHERE texte ~ '(^|[^0-9])(\\+?221)?7[05678][0-9]{7}([^0-9]|$)'),
invit AS (SELECT category_id, count(*) AS n FROM t WHERE sale_channel = 'INVITATION' AND status IN ('VALIDE', 'UTILISE') GROUP BY 1),
u6 AS (SELECT 'u', c.id::text, format('%s invitations actives pour %s vendus', i.n, c.sold_quantity)
         FROM public.ticket_categories c JOIN invit i ON i.category_id = c.id
        WHERE i.n > c.sold_quantity
          AND c.id IN (SELECT (metadata->>'category_id')::uuid FROM journal WHERE action = 'TICKET_INVITATIONS_SENT')),
av AS (SELECT name, split_part(name, '/', 1) AS dossier FROM storage.objects WHERE bucket_id = 'avatars'),
v1 AS (SELECT 'v', u.id::text, 'photo hors du dossier du compte, ou objet absent'
         FROM public.users u
        WHERE u.avatar_url LIKE '%/storage/v1/object/public/avatars/%'
          AND NOT EXISTS (SELECT 1 FROM av WHERE av.name = substring(u.avatar_url from '/object/public/avatars/(.+)$') AND av.dossier = u.id::text)),
v2 AS (SELECT 'v', name, 'nom d''objet hors du format <user_id>/<uuid>.webp, ou dossier sans compte'
         FROM av WHERE name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\\.webp$'
            OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id::text = av.dossier)),
v3 AS (SELECT 'v', dossier, 'plusieurs photos pour un compte (' || count(*) || ')' FROM av GROUP BY dossier HAVING count(*) > 1),
changes AS (SELECT DISTINCT user_id FROM journal WHERE action = 'ACCOUNT_PHONE_CHANGED' AND user_id IS NOT NULL),
v4 AS (SELECT 'v', u.id::text, 'numéro différent entre le profil et l''authentification après un changement'
         FROM changes c JOIN public.users u ON u.id = c.user_id JOIN auth.users a ON a.id = u.id
        WHERE regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g') <> COALESCE(a.phone, '')),
v5 AS (SELECT 'v', j.id::text, 'changement de numéro sans SMS à l''ancien numéro'
         FROM journal j
        WHERE j.action = 'ACCOUNT_PHONE_CHANGED' AND COALESCE((j.metadata->>'sms_queued')::boolean, TRUE)
          AND NOT EXISTS (SELECT 1 FROM public.notification_outbox o
                           WHERE o.type = 'PHONE_CHANGED' AND o.idempotency_key LIKE 'PHONE_CHANGED:' || j.user_id::text || ':%')),
v6 AS (SELECT 'v', u.id::text, 'email différent entre le profil et l''authentification'
         FROM (SELECT DISTINCT user_id FROM journal WHERE action IN ('ACCOUNT_PHONE_CHANGED', 'ACCOUNT_PROFILE_UPDATED')) c
         JOIN public.users u ON u.id = c.user_id JOIN auth.users a ON a.id = u.id
        WHERE lower(COALESCE(u.email, '')) <> lower(COALESCE(a.email, '')))
SELECT * FROM t5 UNION ALL SELECT * FROM t6 UNION ALL SELECT * FROM u1 UNION ALL SELECT * FROM u2 UNION ALL SELECT * FROM u3
UNION ALL SELECT * FROM u4 UNION ALL SELECT * FROM u5 UNION ALL SELECT * FROM u6 UNION ALL SELECT * FROM v1 UNION ALL SELECT * FROM v2
UNION ALL SELECT * FROM v3 UNION ALL SELECT * FROM v4 UNION ALL SELECT * FROM v5 UNION ALL SELECT * FROM v6 ORDER BY 1, 2`;

/** Ligne de violation renvoyée par LOT9_INVARIANT_SQL (même forme que celles de la recette). */
export type Lot9Violation = RecetteViolation;

const M2 = 'migration 20261108000002_lot9_invitations';
const M4 = 'migration 20261108000004_lot9_compte';

/** Colonnes lues par la requête : sans elles, une erreur Postgres brute remplacerait un échec qui nomme l'objet. */
const REQUIRED_COLUMNS: ReadonlyArray<[string, string, readonly string[]]> = [
    ['public', 'tickets', ['id', 'category_id', 'user_id', 'payment_id', 'price', 'status', 'sale_channel', 'sale_decision', 'transfer_locked']],
    ['public', 'ticket_transfers', ['id', 'ticket_id', 'from_user_id', 'status']],
    ['public', 'ticket_categories', ['id', 'sold_quantity']],
    ['public', 'audit_logs', ['id', 'action', 'user_id', 'old_value', 'new_value', 'metadata']],
    ['public', 'users', ['id', 'phone', 'email', 'avatar_url']],
    ['public', 'notification_outbox', ['type', 'idempotency_key']],
    ['public', 'notification_types', ['type']],
    ['auth', 'users', ['id', 'phone', 'email']],
    ['storage', 'objects', ['bucket_id', 'name']],
    ['storage', 'buckets', ['id', 'public']],
];

/** RPC du lot sans lesquelles les règles n'ont aucun sens (contrat 6.2). */
const REQUIRED_RPCS: ReadonlyArray<[string, string]> = [
    ['ticket_invitation_create', M2],
    ['account_phone_finalize', M4],
];

/** Types du registre des notifications (contrat 6.2). */
const REQUIRED_NOTIFICATION_TYPES: ReadonlyArray<[string, string]> = [
    ['INVITATION_RECEIVED', M2],
    ['PHONE_CHANGED', M4],
];

/**
 * Objets du lot 9 absents de la base locale, décrits en clair (liste vide : schéma complet pour (t)(u)(v)).
 * Avec `db` : sur ce client (dans sa transaction) ; sans `db` : transaction READ ONLY sur une connexion neuve.
 */
export async function missingLot9Schema(db?: Client): Promise<string[]> {
    const run = async (client: Client): Promise<string[]> => {
        const missing: string[] = [];

        for (const [schema, table, wanted] of REQUIRED_COLUMNS) {
            const r = await client.query<{ attname: string }>(
                `SELECT a.attname FROM pg_attribute a
                   JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = $1 AND c.relname = $2 AND a.attnum > 0 AND NOT a.attisdropped`, [schema, table]);
            const present = new Set(r.rows.map((row) => row.attname));
            if (present.size === 0) {
                missing.push(`table ${schema}.${table} absente — lue par les invariants du lot 9 (contrat 6.3)`);
                continue;
            }
            for (const c of wanted) if (!present.has(c)) missing.push(`colonne ${schema}.${table}.${c} absente — lue par les invariants du lot 9 (contrat 6.3)`);
        }
        // Une table absente est déjà nommée : les contrôles suivants sur cette table lèveraient une erreur brute.
        if (missing.length > 0) return missing;

        const f = await client.query<{ proname: string }>(
            `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`, [REQUIRED_RPCS.map(([name]) => name)]);
        const functions = new Set(f.rows.map((row) => row.proname));
        for (const [name, where] of REQUIRED_RPCS) {
            if (!functions.has(name)) missing.push(`fonction public.${name} absente — ${where} (contrat 6.2)`);
        }

        const holder = await client.query<{ def: string }>(
            `SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c
               JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
              WHERE n.nspname = 'public' AND t.relname = 'tickets' AND c.conname = 'tickets_holder_or_counter'`);
        if (holder.rows.length === 0) {
            missing.push(`contrainte public.tickets.tickets_holder_or_counter absente — ${M2} (contrat 6.2)`);
        } else if (!holder.rows[0].def.includes('INVITATION')) {
            missing.push(`contrainte public.tickets.tickets_holder_or_counter n'admet pas le canal INVITATION — ${M2} (contrat 6.2)`);
        }

        const fromUser = await client.query<{ is_nullable: string }>(
            `SELECT is_nullable FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'ticket_transfers' AND column_name = 'from_user_id'`);
        if (fromUser.rows[0]?.is_nullable !== 'YES') {
            missing.push(`colonne public.ticket_transfers.from_user_id encore NOT NULL — expéditeur NULL d'une invitation en attente, ${M2} (contrat 6.2)`);
        }

        const decision = await client.query<{ def: string }>(
            `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'tickets_sale_decision_set'`);
        if (decision.rows.length === 0) {
            missing.push(`fonction public.tickets_sale_decision_set absente — ${M2} (contrat 6.2)`);
        } else if (!decision.rows.some((row) => row.def.includes(`'INVITATION'`))) {
            missing.push(`fonction public.tickets_sale_decision_set ne connaît pas le canal 'INVITATION' — ${M2} (contrat 6.2)`);
        }

        const types = await client.query<{ type: string }>(
            'SELECT type FROM public.notification_types WHERE type = ANY($1::text[])', [REQUIRED_NOTIFICATION_TYPES.map(([type]) => type)]);
        const registered = new Set(types.rows.map((row) => row.type));
        for (const [type, where] of REQUIRED_NOTIFICATION_TYPES) {
            if (!registered.has(type)) missing.push(`type ${type} absent de public.notification_types — ${where} (contrat 6.2)`);
        }

        const bucket = await client.query<{ public: boolean }>(`SELECT public FROM storage.buckets WHERE id = 'avatars'`);
        if (bucket.rows.length === 0) {
            missing.push(`bucket avatars absent de storage.buckets — ${M4} (contrat 6.2)`);
        } else if (bucket.rows[0].public !== true) {
            missing.push(`bucket avatars non public dans storage.buckets — ${M4} (contrat 6.2)`);
        }

        return missing;
    };
    return db ? run(db) : inspect(run);
}

/** Échoue en nommant chaque objet manquant si le schéma du lot 9 n'est pas en place. */
export async function assertLot9Schema(label: string, db?: Client): Promise<void> {
    const missing = await missingLot9Schema(db);
    if (missing.length > 0) {
        console.log(`[INVARIANT-LOT9] ${label} — schéma du lot 9 incomplet : ${missing.length} objet(s) manquant(s)`);
        for (const m of missing) console.log(`[INVARIANT-LOT9]   ${m}`);
    }
    assert.deepEqual(missing, [], `schéma du lot 9 incomplet (${label}) : invariants (t)(u)(v) impossibles à vérifier :\n${missing.join('\n')}`);
}

/**
 * Violations de (t)(u)(v) sur toute la base. Avec `db` : la requête s'exécute sur ce client, dans sa transaction
 * (garde-fous de lot9-invariant.test.ts, violation fabriquée dans inRolledBackTransaction) ; sans `db` :
 * transaction READ ONLY sur une connexion neuve. Le schéma est contrôlé d'abord (échec explicite s'il manque).
 */
export async function lot9Violations(db?: Client): Promise<Lot9Violation[]> {
    await assertLot9Schema('lot9Violations', db);
    if (db) return (await db.query<Lot9Violation>(LOT9_INVARIANT_SQL)).rows;
    return inspect(async (client) => (await client.query<Lot9Violation>(LOT9_INVARIANT_SQL)).rows);
}

/**
 * À appeler dans after() de chaque suite nouvelle du lot 9 qui écrit : (a) à (t) par assertRecetteInvariants
 * (envoyeur compris : aucun after() ne compte de SMS), schéma du lot 9, puis (t)(u)(v).
 */
export async function assertLot9Invariants(label: string): Promise<void> {
    await assertRecetteInvariants(label);
    await assertLot9Schema(label);
    const rows = await lot9Violations();
    console.log(`[INVARIANT-LOT9] ${label} — (t)(u)(v) : ${rows.length} violation(s)`);
    for (const r of rows) console.log(`[INVARIANT-LOT9]   (${r.regle}) ${r.objet} : ${r.detail}`);
    assert.deepEqual(rows, [], `invariants (t)(u)(v) violés (${label}) :\n${rows.map((r) => `(${r.regle}) ${r.objet} : ${r.detail}`).join('\n')}`);
}
