/**
 * Lot 9 quater — invariants du lot, vérifiés à la fin de chaque suite nouvelle du lot qui écrit et de
 * migration-lot9quater-rejouable, par une requête SQL sur TOUTE la base LOCALE (lecture seule). Après (a) à (w) et (x)
 * (assertLot9terInvariants), règles (q1) à (q8) :
 *  (q1) A4 : aucune adresse technique « <chiffres>@eventvillage.sn » dans auth.users ni public.users ;
 *  (q2) A3 : aucune marque is_temporary_controller_account dans raw_user_meta_data (la marque est dans raw_app_meta_data) ;
 *  (q3) A3 : une marque controller_activation_pending vraie seulement sur un compte qui a le rôle CONTROLEUR ;
 *  (q4) A4 : aucune adresse .invalid vérifiée ni en attente ;
 *  (q5) A6 : tout compte SUSPENDU ou SUPPRIME est bloqué chez GoTrue (banned_until dans le futur), tout compte ACTIF
 *       ne l'est pas (sauf compte anonymisé) ;
 *  (q6) A6 : toute aide exécutable par anon ou authenticated dans public (hors extensions) lit le statut du compte ;
 *  (q7) B6 : platform_settings n'est lisible ni par anon ni par authenticated (vue publique seule) ;
 *  (q8) A3, A4 : le trigger auth_users_guard_writes est posé sur auth.users.
 * Sortie brute `[INVARIANT-LOT9QUATER]`. Échec explicite qui nomme chaque objet du lot absent (jamais d'erreur Postgres
 * brute, jamais de faux vert).
 */
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { inspect } from './db';
import { assertLot9terInvariants } from './lot9ter-invariants';
import type { RecetteViolation } from './recette-invariants';

export type Lot9quaterViolation = RecetteViolation;

export const LOT9QUATER_INVARIANT_SQL = `
SELECT * FROM (
    SELECT 'q1'::text AS regle, 'auth.users.' || a.id::text AS objet, 'adresse technique tirée du numéro : ' || a.email AS detail
      FROM auth.users a WHERE COALESCE(a.email, '') ~ '^[0-9]+@eventvillage\\.sn$'
    UNION ALL
    SELECT 'q1', 'users.' || u.id::text, 'adresse technique tirée du numéro : ' || u.email
      FROM public.users u WHERE COALESCE(u.email, '') ~ '^[0-9]+@eventvillage\\.sn$'
    UNION ALL
    SELECT 'q2', 'auth.users.' || a.id::text, 'marque is_temporary_controller_account dans raw_user_meta_data'
      FROM auth.users a WHERE a.raw_user_meta_data ? 'is_temporary_controller_account'
    UNION ALL
    SELECT 'q3', 'auth.users.' || a.id::text, 'marque controller_activation_pending sans rôle CONTROLEUR'
      FROM auth.users a
     WHERE COALESCE(a.raw_app_meta_data->>'controller_activation_pending', '') = 'true'
       AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = a.id AND r.role::text = 'CONTROLEUR')
    UNION ALL
    SELECT 'q4', 'users.' || u.id::text, 'adresse .invalid vérifiée ou en attente'
      FROM public.users u
     WHERE (u.email_verified_at IS NOT NULL AND COALESCE(u.email, '') ~* '@([a-z0-9-]+\\.)*invalid$')
        OR COALESCE(u.email_pending, '') ~* '@([a-z0-9-]+\\.)*invalid$'
    UNION ALL
    SELECT 'q5', 'users.' || u.id::text, 'compte ' || u.status::text || ' non bloqué chez GoTrue'
      FROM public.users u JOIN auth.users a ON a.id = u.id
     WHERE u.status::text IN ('SUSPENDU', 'SUPPRIME') AND (a.banned_until IS NULL OR a.banned_until <= now())
    UNION ALL
    SELECT 'q5', 'users.' || u.id::text, 'compte ACTIF bloqué chez GoTrue'
      FROM public.users u JOIN auth.users a ON a.id = u.id
     WHERE u.status::text = 'ACTIF' AND a.banned_until > now()
       AND COALESCE(u.email, '') !~* '@deleted\\.eventvillage\\.sn$'
    UNION ALL
    SELECT 'q6', 'public.' || p.proname, 'aide exécutable par anon ou authenticated sans lecture du statut du compte'
      FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
       AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
       AND pg_get_functiondef(p.oid) !~ '\\mstatus\\M'
    UNION ALL
    SELECT 'q7', 'public.platform_settings', r.rol || ' peut lire la table'
      FROM (VALUES ('anon'), ('authenticated')) AS r(rol)
     WHERE has_table_privilege(r.rol, 'public.platform_settings', 'SELECT')
       AND EXISTS (SELECT 1 FROM pg_policies pp WHERE pp.schemaname = 'public' AND pp.tablename = 'platform_settings'
                     AND pp.cmd IN ('SELECT', 'ALL') AND (pp.roles::text[] && ARRAY[r.rol, 'public']::text[]))
    UNION ALL
    SELECT 'q8', 'auth.users', 'trigger on_auth_user_guard_writes absent'
     WHERE NOT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'auth.users'::regclass AND t.tgname = 'on_auth_user_guard_writes'
                         AND NOT t.tgisinternal)
) v
ORDER BY regle, objet`;

/** Objets du lot exigés avant le calcul des règles (échec explicite qui nomme chaque absent). */
export const LOT9QUATER_SCHEMA = {
    functions: ['is_technical_email', 'technical_email_for', 'auth_write_permit_grant', 'auth_users_guard_writes'],
    tables: ['auth_write_permits', 'account_recovery_grants'],
} as const;

export async function missingLot9quaterSchema(db?: Client): Promise<string[]> {
    const run = async (c: Client) => {
        const missing: string[] = [];
        for (const fn of LOT9QUATER_SCHEMA.functions) {
            const r = await c.query(`SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = $1`, [fn]);
            if (r.rowCount === 0) missing.push(`fonction public.${fn}`);
        }
        for (const t of LOT9QUATER_SCHEMA.tables) {
            const r = await c.query(`SELECT to_regclass($1)::text AS reg`, [`public.${t}`]);
            if (!r.rows[0].reg) missing.push(`table public.${t}`);
        }
        return missing;
    };
    return db ? run(db) : inspect(run);
}

export async function lot9quaterViolations(db?: Client): Promise<Lot9quaterViolation[]> {
    const missing = await missingLot9quaterSchema(db);
    assert.deepEqual(missing, [], `schéma du lot 9 quater incomplet : invariants (q) impossibles à vérifier :\n${missing.join('\n')}`);
    if (db) return (await db.query<Lot9quaterViolation>(LOT9QUATER_INVARIANT_SQL)).rows;
    return inspect(async (c) => (await c.query<Lot9quaterViolation>(LOT9QUATER_INVARIANT_SQL)).rows);
}

/** À appeler dans after() de chaque suite nouvelle du lot 9 quater qui écrit : (a) à (x), puis (q1) à (q8). */
export async function assertLot9quaterInvariants(label: string): Promise<void> {
    await assertLot9terInvariants(label);
    const rows = await lot9quaterViolations();
    console.log(`[INVARIANT-LOT9QUATER] ${label} — (q) : ${rows.length} violation(s)`);
    for (const r of rows) console.log(`[INVARIANT-LOT9QUATER]   (${r.regle}) ${r.objet} : ${r.detail}`);
    assert.deepEqual(rows, [], `invariants (q) violés (${label}) :\n${rows.map((r) => `(${r.regle}) ${r.objet} : ${r.detail}`).join('\n')}`);
}
