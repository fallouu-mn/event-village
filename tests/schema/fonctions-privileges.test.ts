/**
 * Lot 1A.3 / 1A.6 — inventaire des fonctions du schéma public et de leurs droits EXECUTE effectifs.
 *
 * Groupes :
 *  a) aides utilisées par les politiques RLS : liste blanche explicite, exécutables par anon ET
 *     authenticated (les politiques sans clause TO s'évaluent aussi pour anon), lecture seule,
 *     search_path fixé ;
 *  b) RPC métier : exécutables par service_role uniquement ;
 *  c) fonctions de triggers : aucun EXECUTE pour les rôles API (le déclenchement d'un trigger ne
 *     vérifie pas ce privilège).
 *
 * Lecture du catalogue sur la base LOCALE (tests/helpers/db.ts) ; l'inventaire est imprimé tel quel.
 */
import '../helpers/env';
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import { inRolledBackTransaction, inspect } from '../helpers/db';

/**
 * Groupe a — seule liste de fonctions autorisées à rester exécutables par anon / authenticated.
 * Lot 7 (D21, T0e) : 7e aide, ticket_category_private_read(uuid), prédicat des politiques de
 * ticket_categories sans privilège SELECT de l'appelant sur public.users (rouge jusqu'à fix(7.0c)).
 */
export const RLS_HELPER_WHITELIST = [
    'is_admin', 'is_superadmin', 'is_controller', 'has_role', 'is_partner_owner', 'auth_user_role',
    'ticket_category_private_read',
] as const;

interface FnRow {
    name: string;
    args: string;
    security_definer: boolean;
    volatility: string;
    is_trigger: boolean;
    config: string;
    anon_exec: boolean;
    auth_exec: boolean;
    service_exec: boolean;
    from_extension: boolean;
}

function group(f: FnRow): 'a' | 'b' | 'c' | 'extension' {
    if (f.from_extension) return 'extension';
    if ((RLS_HELPER_WHITELIST as readonly string[]).includes(f.name)) return 'a';
    if (f.is_trigger) return 'c';
    return 'b';
}

const yn = (b: boolean) => (b ? 'oui' : 'non');

describe('Fonctions du schéma public : inventaire et privilèges EXECUTE', () => {
    let fns: FnRow[] = [];

    before(async () => {
        const res = await inspect((c) =>
            c.query<FnRow>(
                `SELECT p.proname AS name,
                        pg_get_function_identity_arguments(p.oid) AS args,
                        p.prosecdef AS security_definer,
                        p.provolatile AS volatility,
                        (p.prorettype = 'trigger'::regtype) AS is_trigger,
                        COALESCE(array_to_string(p.proconfig, ' '), '') AS config,
                        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
                        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
                        has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_exec,
                        EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e') AS from_extension
                   FROM pg_proc p
                   JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.prokind = 'f'
                  ORDER BY p.proname, args`
            )
        );
        fns = res.rows;

        const own = fns.filter((f) => !f.from_extension);
        console.log(`\nINVENTAIRE — ${own.length} fonction(s) du projet dans public (+ ${fns.length - own.length} fonction(s) d'extensions)\n`);
        console.log('| Groupe | Fonction | SECURITY DEFINER | Volatilité | search_path | EXECUTE anon | EXECUTE authenticated | EXECUTE service_role |');
        console.log('|---|---|---|---|---|---|---|---|');
        for (const f of own.sort((x, y) => group(x).localeCompare(group(y)) || x.name.localeCompare(y.name))) {
            const vol = f.volatility === 'i' ? 'IMMUTABLE' : f.volatility === 's' ? 'STABLE' : 'VOLATILE';
            console.log(`| ${group(f)} | ${f.name}(${f.args}) | ${yn(f.security_definer)} | ${vol} | ${f.config || '—'} | ${yn(f.anon_exec)} | ${yn(f.auth_exec)} | ${yn(f.service_exec)} |`);
        }
        console.log('');
    });

    test('aucune fonction hors liste blanche n\'est exécutable par anon ou authenticated', () => {
        const offenders = fns
            .filter((f) => !f.from_extension && group(f) !== 'a' && (f.anon_exec || f.auth_exec))
            .map((f) => `${f.name}(${f.args}) [groupe ${group(f)}] anon=${yn(f.anon_exec)} authenticated=${yn(f.auth_exec)}`);
        assert.deepEqual(offenders, [], `fonctions exécutables par les rôles API hors liste blanche :\n${offenders.join('\n')}`);
    });

    test('aucune fonction SECURITY DEFINER n\'est exécutable par anon sans être sur la liste blanche', () => {
        const offenders = fns
            .filter((f) => !f.from_extension && f.security_definer && f.anon_exec && group(f) !== 'a')
            .map((f) => `${f.name}(${f.args})`);
        assert.deepEqual(offenders, [], `SECURITY DEFINER exécutables par anon :\n${offenders.join('\n')}`);
    });

    test('groupe a : présentes, exécutables par anon et authenticated, en lecture seule, search_path fixé', () => {
        for (const name of RLS_HELPER_WHITELIST) {
            const f = fns.find((x) => x.name === name && !x.from_extension);
            assert.ok(f, `aide RLS ${name} absente`);
            assert.ok(f.anon_exec && f.auth_exec, `${name} doit rester exécutable par anon et authenticated (évaluée dans les politiques)`);
            assert.ok(['s', 'i'].includes(f.volatility), `${name} doit être STABLE ou IMMUTABLE (lecture seule), volatilité=${f.volatility}`);
            assert.match(f.config, /search_path=/, `${name} : search_path non fixé`);
        }
    });

    test('toute fonction SECURITY DEFINER du projet a un search_path fixé', () => {
        const offenders = fns.filter((f) => !f.from_extension && f.security_definer && !/search_path=/.test(f.config)).map((f) => `${f.name}(${f.args})`);
        assert.deepEqual(offenders, [], `SECURITY DEFINER sans search_path :\n${offenders.join('\n')}`);
    });

    test('groupe b : toujours exécutables par service_role (parcours serveur)', () => {
        const offenders = fns.filter((f) => group(f) === 'b' && !f.service_exec).map((f) => `${f.name}(${f.args})`);
        assert.deepEqual(offenders, [], `RPC métier non exécutables par service_role :\n${offenders.join('\n')}`);
    });

    test('validate_and_check_in_ticket est supprimée (inutilisée, composte sans vérifier l\'appelant)', () => {
        assert.equal(fns.some((f) => f.name === 'validate_and_check_in_ticket'), false);
    });

    test('privilèges par défaut : une nouvelle fonction de public n\'est exécutable ni par anon ni par authenticated', async () => {
        const probe = await inRolledBackTransaction(async (c) => {
            await c.query(`CREATE FUNCTION public.__lot1a_probe_default_acl() RETURNS integer LANGUAGE sql AS 'SELECT 1'`);
            const { rows } = await c.query<{ anon: boolean; auth: boolean; acl: string | null }>(
                `SELECT has_function_privilege('anon', 'public.__lot1a_probe_default_acl()', 'EXECUTE') AS anon,
                        has_function_privilege('authenticated', 'public.__lot1a_probe_default_acl()', 'EXECUTE') AS auth,
                        (SELECT proacl::text FROM pg_proc WHERE proname = '__lot1a_probe_default_acl') AS acl`
            );
            return rows[0];
        });
        console.log(`Fonction sonde (annulée) : ACL=${probe.acl ?? 'NULL (défaut PostgreSQL : EXECUTE à PUBLIC)'}`);
        assert.equal(probe.anon, false, 'anon peut exécuter une nouvelle fonction : privilèges par défaut non révoqués');
        assert.equal(probe.auth, false, 'authenticated peut exécuter une nouvelle fonction : privilèges par défaut non révoqués');
    });
});
