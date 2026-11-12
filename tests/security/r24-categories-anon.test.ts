/**
 * R24 — Lot 7, tâche 7.0 c (contrat section 4.3, D21, M3.1 à M3.3) : la RLS de ticket_categories ne dépend
 * plus du privilège SELECT de anon sur public.users. La politique ticket_categories_read_public lit le compte de
 * l'appelant par l'aide SECURITY DEFINER ticket_category_private_read(p_event uuid), 7e aide RLS (exécutable par anon
 * et authenticated) ; ticket_categories_admin_manage est supprimée au lot 9 ter (0.1, migration 20261110000001).
 *  1. client anon réel (clé anon seule) : catégories du publié A_PUBLIE visibles, aucune du brouillon
 *     A_BROUILLON (témoin : son propriétaire, PARTNER_A connecté, les lit) ;
 *  2. transaction annulée sur la base locale : REVOKE SELECT ON public.users FROM anon (précondition : anon
 *     n'a plus aucun privilège SELECT sur la table ni sur ses colonnes), SET LOCAL ROLE anon, claims anon :
 *     la lecture des catégories du publié rend les mêmes lignes que le client anon réel, sans 42501 ;
 *  3. catalogue : ticket_category_private_read(p_event uuid) présente, STABLE, SECURITY DEFINER,
 *     search_path = public, exécutable par anon et authenticated ;
 *  4. catalogue : aucune politique SELECT ou ALL de ticket_categories ne cite la table users ;
 *     read_public appelle l'aide et reste sans clause TO (catalogue public lu par anon) ; aucune politique
 *     d'écriture (lot 9 ter, 0.1 : toute écriture REST supprimée, y compris celle de l'admin) ;
 *  5. propriétaire suspendu (transaction annulée, rôle authenticated, claims du PARTNER_A du seed) : témoin
 *     ACTIF, les catégories du brouillon sont lues ; SUSPENDU, aucune ;
 *  6. l'aide elle-même (même transaction annulée) : vraie pour le propriétaire ACTIF, fausse pour anon et
 *     pour le propriétaire SUSPENDU.
 *
 * État avant correctif (fix(7.0c), migration 20261105000003) :
 *  - 1 et 5 : verts (couverture ajoutée : lot 5 A3 et lot 6 P_ACTIF, 20261103000001_lot6_dette.sql:145-175) ;
 *  - 2 : ROUGE, 42501 « permission denied for table users » : read_public (sans clause TO) et
 *    admin_manage (FOR ALL sans TO, donc appliquée au SELECT de anon ; supprimée au lot 9 ter) contiennent une sous-requête sur
 *    public.users, dont le privilège est contrôlé pour anon même quand la branche publique suffit ;
 *  - 3, 4, 6 : ROUGES, aide absente et politiques qui lisent users.
 *
 * Connexion directe (tests/helpers/db.ts) pour les cas 2 à 6 : le contrat (4.3) exige le REVOKE en
 * transaction annulée et des lectures sous les rôles anon et authenticated ; rien n'est écrit hors de ces
 * transactions annulées. Aucun appel avec des privilèges serveur pour l'acteur testé (règle du lot 1A).
 * Pas d'assertTerrainInvariants ici, comme r20 à r22 du lot 6 : il passe par l'envoyeur et une connexion
 * privilégiée, et la suite n'écrit rien (écart à la règle « chaque suite nouvelle », signalé).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { FIXTURE_EVENTS } from '../helpers/fixture-data';
import { inRolledBackTransaction, inspect } from '../helpers/db';
import { anonClient, publicEvent, signInFixture } from './helpers';

type Row = Record<string, unknown>;

/** Brouillon A_BROUILLON du seed et ses catégories, lus par son propriétaire (PARTNER_A). */
async function draftOfPartnerA(): Promise<{ ownerId: string; eventId: string; categoryIds: string[] }> {
    const a = await signInFixture('PARTNER_A');
    const { data: ev, error } = await a.client.from('events').select('id, status').eq('slug', FIXTURE_EVENTS.A_BROUILLON.slug).single();
    assert.equal(error, null, `lecture du brouillon par son propriétaire : ${error?.message}`);
    assert.equal(ev.status, 'BROUILLON', 'précondition : A_BROUILLON est un brouillon');
    const { data: cats, error: catErr } = await a.client.from('ticket_categories').select('id').eq('event_id', ev.id);
    assert.equal(catErr, null, `catégories du brouillon lues par son propriétaire : ${catErr?.message}`);
    const ids = (cats ?? []).map((c) => String(c.id)).sort();
    assert.ok(ids.length > 0, 'témoin : le propriétaire lit les catégories de son brouillon');
    return { ownerId: a.userId, eventId: String(ev.id), categoryIds: ids };
}

/** Catégories de A_PUBLIE lues par un client anon réel (identifiants triés, au moins une). */
async function publishedCategoryIds(): Promise<{ eventId: string; ids: string[] }> {
    const pub = await publicEvent('A_PUBLIE');
    const ids = Object.values(pub.categories).map((c) => c.id).sort();
    assert.ok(ids.length > 0, 'précondition : catégories du publié A_PUBLIE lisibles par anon');
    return { eventId: pub.eventId, ids };
}

/** Lecture des catégories d'un événement sous un rôle API et des claims JWT donnés (dans la transaction de db). */
async function categoriesAs(db: Client, role: 'anon' | 'authenticated', claims: Row, eventId: string): Promise<string[]> {
    await db.query(`SET LOCAL ROLE ${role}`);
    await db.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    const { rows } = await db.query<{ id: string }>('SELECT id FROM public.ticket_categories WHERE event_id = $1 ORDER BY id', [eventId]);
    await db.query('RESET ROLE');
    return rows.map((r) => String(r.id)).sort();
}

describe('R24 — catégories de billets sans lecture de public.users (7.0 c, D21)', () => {
    test('anon (clé anon seule) : catégories du publié visibles, aucune du brouillon', async () => {
        const pub = await publishedCategoryIds();
        const { data: seen, error } = await anonClient().from('ticket_categories').select('id').eq('event_id', pub.eventId);
        assert.equal(error, null, `anon, publié : ${error?.message}`);
        assert.deepEqual((seen ?? []).map((c) => String(c.id)).sort(), pub.ids, 'anon lit les catégories actives et visibles du publié');
        const draft = await draftOfPartnerA();
        const { data: hidden, error: hErr } = await anonClient().from('ticket_categories').select('id').in('id', draft.categoryIds);
        assert.equal(hErr, null, `anon, brouillon : ${hErr?.message}`);
        assert.deepEqual(hidden ?? [], [], 'anon ne lit aucune catégorie d’un brouillon');
    });

    test('transaction annulée : sans SELECT de anon sur public.users, anon lit encore les catégories publiques (aucune 42501)', async () => {
        const pub = await publishedCategoryIds();
        const out = await inRolledBackTransaction(async (db) => {
            await db.query('REVOKE SELECT ON public.users FROM anon');
            const { rows: priv } = await db.query<{ tbl: boolean; cols: boolean }>(
                `SELECT has_table_privilege('anon', 'public.users', 'SELECT') AS tbl, has_any_column_privilege('anon', 'public.users', 'SELECT') AS cols`);
            assert.deepEqual(priv[0], { tbl: false, cols: false }, `précondition : anon ne doit plus avoir aucun SELECT sur public.users (PUBLIC ou autre rôle hérité ?) : ${JSON.stringify(priv[0])}`);
            await db.query('SAVEPOINT lecture');
            try {
                return { ids: await categoriesAs(db, 'anon', { role: 'anon' }, pub.eventId), error: null as string | null };
            } catch (err) {
                await db.query('ROLLBACK TO SAVEPOINT lecture');
                return { ids: [] as string[], error: `${(err as { code?: string }).code ?? ''} ${(err as Error).message}` };
            }
        });
        assert.equal(out.error, null, `lecture des catégories par anon refusée (${out.error}) : une politique de ticket_categories lit encore public.users`);
        assert.deepEqual(out.ids, pub.ids, 'mêmes catégories que le client anon réel');
    });

    test('aide ticket_category_private_read(p_event uuid) : présente, STABLE, SECURITY DEFINER, search_path = public, exécutable par anon et authenticated', async () => {
        const rows = await inspect(async (db) => (await db.query<{ args: string; volatile: string; definer: boolean; config: string[] | null; anon_exec: boolean; auth_exec: boolean }>(
            `SELECT pg_get_function_identity_arguments(p.oid) AS args, p.provolatile::text AS volatile, p.prosecdef AS definer,
                    p.proconfig AS config, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
                    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec
               FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'ticket_category_private_read'`)).rows);
        assert.equal(rows.length, 1, `aide RLS public.ticket_category_private_read absente ou surchargée (${rows.length} définition(s)) — migration 20261105000003, contrat M3.1`);
        const f = rows[0];
        assert.equal(f.args, 'p_event uuid', `signature : ${f.args}`);
        assert.equal(f.volatile, 's', `volatilité STABLE attendue (provolatile = ${f.volatile})`);
        assert.equal(f.definer, true, 'SECURITY DEFINER attendu');
        assert.ok((f.config ?? []).includes('search_path=public'), `search_path = public attendu : ${JSON.stringify(f.config)}`);
        assert.equal(f.anon_exec, true, 'EXECUTE pour anon (aide RLS évaluée pour le catalogue public)');
        assert.equal(f.auth_exec, true, 'EXECUTE pour authenticated');
    });

    test('politiques de ticket_categories : aucune lecture de la table users ; read_public appelle l’aide ; aucune politique d’écriture (lot 9 ter, 0.1)', async () => {
        const policies = await inspect(async (db) => (await db.query<{ policyname: string; roles: string[]; cmd: string; qual: string | null; with_check: string | null }>(
            `SELECT policyname, roles::text[] AS roles, cmd, qual, with_check
               FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ticket_categories' ORDER BY policyname`)).rows);
        const byName = new Map(policies.map((p) => [p.policyname, p]));
        const readPublic = byName.get('ticket_categories_read_public');
        assert.ok(readPublic, 'politique ticket_categories_read_public absente');

        const readers = policies.filter((p) => p.cmd === 'SELECT' || p.cmd === 'ALL');
        const offenders = readers
            .filter((p) => /\busers\b/.test(`${p.qual ?? ''} ${p.with_check ?? ''}`))
            .map((p) => `${p.policyname} (${p.cmd}, rôles ${p.roles.join(',')}) : ${p.qual ?? ''} ${p.with_check ?? ''}`.slice(0, 600));
        assert.deepEqual(offenders, [], `politiques de ticket_categories qui lisent encore la table users :\n${offenders.join('\n')}`);

        assert.match(readPublic.qual ?? '', /ticket_category_private_read\(/, `read_public doit appeler ticket_category_private_read : ${readPublic.qual}`);
        assert.deepEqual(readPublic.roles, ['public'], `read_public reste sans clause TO (catalogue lu par anon) : ${readPublic.roles.join(',')}`);
        assert.deepEqual(policies.filter((p) => p.cmd !== 'SELECT').map((p) => p.policyname), [],
            `lot 9 ter (0.1) : aucune politique d’écriture sur ticket_categories, y compris pour l’admin : ${policies.filter((p) => p.cmd !== 'SELECT').map((p) => `${p.policyname} (${p.cmd})`).join(', ')}`);
    });

    test('propriétaire suspendu (transaction annulée, rôle authenticated) : aucune catégorie privée ; témoin ACTIF : catégories du brouillon lues', async () => {
        const draft = await draftOfPartnerA();
        const claims = { sub: draft.ownerId, role: 'authenticated' };
        const seen = await inRolledBackTransaction(async (db) => {
            const active = await categoriesAs(db, 'authenticated', claims, draft.eventId);
            const upd = await db.query(`UPDATE public.users SET status = 'SUSPENDU' WHERE id = $1`, [draft.ownerId]);
            assert.equal(upd.rowCount, 1, 'propriétaire suspendu dans la transaction');
            const suspended = await categoriesAs(db, 'authenticated', claims, draft.eventId);
            return { active, suspended };
        });
        assert.deepEqual(seen.active, draft.categoryIds, 'témoin : le propriétaire ACTIF lit les catégories de son brouillon');
        assert.deepEqual(seen.suspended, [], 'un propriétaire SUSPENDU ne lit aucune catégorie de son brouillon');
    });

    test('aide ticket_category_private_read : vraie pour le propriétaire ACTIF, fausse pour anon et pour le propriétaire SUSPENDU (transaction annulée)', async () => {
        const draft = await draftOfPartnerA();
        const out = await inRolledBackTransaction(async (db) => {
            const call = async (role: 'anon' | 'authenticated', claims: Row): Promise<unknown> => {
                await db.query(`SET LOCAL ROLE ${role}`);
                await db.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
                const { rows } = await db.query<{ v: unknown }>('SELECT public.ticket_category_private_read($1::uuid) AS v', [draft.eventId]);
                await db.query('RESET ROLE');
                return rows[0].v;
            };
            await db.query('SAVEPOINT aide');
            try {
                const owner = await call('authenticated', { sub: draft.ownerId, role: 'authenticated' });
                const anon = await call('anon', { role: 'anon' });
                await db.query(`UPDATE public.users SET status = 'SUSPENDU' WHERE id = $1`, [draft.ownerId]);
                const suspended = await call('authenticated', { sub: draft.ownerId, role: 'authenticated' });
                return { owner, anon, suspended, error: null as string | null };
            } catch (err) {
                await db.query('ROLLBACK TO SAVEPOINT aide');
                return { owner: null, anon: null, suspended: null, error: `${(err as { code?: string }).code ?? ''} ${(err as Error).message}` };
            }
        });
        assert.equal(out.error, null, `appel de ticket_category_private_read impossible (${out.error}) — migration 20261105000003, contrat M3.1`);
        assert.equal(out.owner, true, 'propriétaire ACTIF : vrai');
        assert.equal(out.anon, false, 'anon : faux');
        assert.equal(out.suspended, false, 'propriétaire SUSPENDU : faux');
    });
});
