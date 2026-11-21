/**
 * Design 1d — la migration 20261127000001_d1d_vitrine.sql (seule migration du lot) est rejouable : déjà appliquée par la
 * CI depuis une base vide, elle s'exécute encore deux fois de suite sans erreur, dans une transaction annulée (base
 * LOCALE seulement), sans BEGIN ni COMMIT. Modèle : migration-d1b-a-la-une-rejouable.test.ts. Après les deux passages,
 * dans la même transaction :
 *  1. droits : poster_styles (RLS, aucune politique, lecture seule du service_role), event_favorites (RLS, aucune
 *     politique, AUCUN droit de table pour anon, authenticated ni service_role) ; fonctions SECURITY DEFINER à search_path
 *     fixé, jamais exécutables par anon ni authenticated, toutes par le service_role ; trigger présent une seule fois ;
 *  2. poster_style_put refuse un chemin hors du compartiment, une couleur trop claire (contraste < 4,5:1 avec le blanc)
 *     ou mal formée, une image floutée mal formée ; accepte un style valide ;
 *  3. trigger : un événement qui cite le fichier prend le style ; une adresse sans style ou d'un autre hôte le remet à
 *     vide ; poster_style_put range le style dans les événements qui citent déjà le fichier ;
 *  4. favoris : ajout refusé pour un brouillon (EVENT_NOT_FOUND) et un compte inexistant ; accepté pour un événement
 *     publié ; liste du compte seulement ; jamais un brouillon dans la liste ; plafond de 500 écrit dans la fonction.
 * Sortie brute `[D1D-MIG]`.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { inRolledBackTransaction } from '../helpers/db';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');
const NAME = '20261127000001_d1d_vitrine.sql';
const BLUR = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v3AgAA=';

describe('Design 1d — migration « vitrine » rejouable (transaction annulée)', () => {
    test(`${NAME} : sans BEGIN ni COMMIT, appliquée deux fois de plus ; droits, trigger et règles conformes`, async () => {
        const file = path.join(DIR, NAME);
        assert.ok(fs.existsSync(file), `migration absente : supabase/migrations/${NAME}`);
        const sql = fs.readFileSync(file, 'utf8');
        assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im, `${NAME} : la migration ne gère pas elle-même sa transaction`);
        const later = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql') && f > NAME);
        // Lot 12a (modification signalée au rapport) : les migrations 20261130… du lot 12a, non appliquées, viennent après ;
        // la règle vaut pour les migrations des lots déjà appliqués (aucune entre 20261127000001 et 20261130).
        assert.deepEqual(later.filter((f) => f < '20261130'), [], `migrations postérieures à ${NAME} : ${later.join(', ')}`);
        assert.match(sql, /v_count >= 500/, 'plafond de 500 favoris');

        await inRolledBackTransaction(async (db) => {
            await db.query(sql);
            await db.query(sql);

            // 1. Droits
            for (const table of ['poster_styles', 'event_favorites']) {
                const t = (await db.query<{ rls: boolean; policies: number }>(`
                    SELECT c.relrowsecurity AS rls,
                           (SELECT count(*)::int FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = $1) AS policies
                      FROM pg_class c WHERE c.oid = ('public.' || $1)::regclass`, [table])).rows[0];
                assert.deepEqual(t, { rls: true, policies: 0 }, `${table} : RLS activée, aucune politique`);
            }
            const grants = (await db.query<{ tbl: string; role: string; sel: boolean; ins: boolean; upd: boolean; del: boolean }>(`
                SELECT t AS tbl, r AS role,
                       has_table_privilege(r, 'public.' || t, 'SELECT') AS sel,
                       has_table_privilege(r, 'public.' || t, 'INSERT') AS ins,
                       has_table_privilege(r, 'public.' || t, 'UPDATE') AS upd,
                       has_table_privilege(r, 'public.' || t, 'DELETE') AS del
                  FROM unnest(ARRAY['event_favorites', 'poster_styles']) AS t, unnest(ARRAY['anon', 'authenticated', 'service_role']) AS r
                 ORDER BY 1, 2`)).rows;
            console.log(`[D1D-MIG] droits : ${JSON.stringify(grants)}`);
            assert.deepEqual(grants, [
                { tbl: 'event_favorites', role: 'anon', sel: false, ins: false, upd: false, del: false },
                { tbl: 'event_favorites', role: 'authenticated', sel: false, ins: false, upd: false, del: false },
                { tbl: 'event_favorites', role: 'service_role', sel: false, ins: false, upd: false, del: false },
                { tbl: 'poster_styles', role: 'anon', sel: false, ins: false, upd: false, del: false },
                { tbl: 'poster_styles', role: 'authenticated', sel: false, ins: false, upd: false, del: false },
                { tbl: 'poster_styles', role: 'service_role', sel: true, ins: false, upd: false, del: false },
            ], 'droits de table');

            const fns = (await db.query<{ sig: string; anon: boolean; auth: boolean; svc: boolean; secdef: boolean; path: boolean }>(`
                SELECT p.oid::regprocedure::text AS sig,
                       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
                       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
                       has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc,
                       p.prosecdef AS secdef,
                       COALESCE(p.proconfig::text, '') LIKE '%search_path=public%' AS path
                  FROM pg_proc p
                 WHERE p.pronamespace = 'public'::regnamespace
                   AND p.proname IN ('poster_color_contrast', 'poster_path_of', 'poster_style_put', 'events_poster_style_sync',
                                     'event_favorite_set', 'event_favorite_list')
                 ORDER BY 1`)).rows;
            console.log(`[D1D-MIG] fonctions : ${fns.map((f) => `${f.sig} svc=${f.svc}`).join(' ; ')}`);
            assert.equal(fns.length, 6, `6 fonctions : ${fns.map((f) => f.sig).join(', ')}`);
            assert.deepEqual(fns.filter((f) => f.anon || f.auth).map((f) => f.sig), [], 'fonction exécutable par anon ou authenticated');
            assert.deepEqual(fns.filter((f) => !f.secdef || !f.path).map((f) => f.sig), [], 'fonction sans SECURITY DEFINER ni search_path fixé');
            assert.deepEqual(fns.filter((f) => !f.svc).map((f) => f.sig), [], 'fonction non exécutable par le service_role');

            const trg = (await db.query<{ n: number }>(`
                SELECT count(*)::int AS n FROM pg_trigger
                 WHERE tgrelid = 'public.events'::regclass AND tgname = 'trg_events_poster_style' AND NOT tgisinternal`)).rows[0];
            assert.equal(trg.n, 1, 'trigger présent une seule fois');

            // 2. poster_style_put : refus et acceptation
            const partner = (await db.query<{ id: string; partner_id: string; base: string }>(`
                SELECT e.id::text, e.partner_id::text FROM public.events e WHERE e.slug = 'test-fixture-a-brouillon'`)).rows[0];
            assert.ok(partner, 'brouillon de la graine absent');
            const okPath = `events/${partner.partner_id}/1763600000000_d1d00001.webp`;
            const put = async (p: string, color: string, blur: string): Promise<Record<string, unknown>> =>
                (await db.query<{ r: Record<string, unknown> }>('SELECT public.poster_style_put($1, $2, $3) AS r', [p, color, blur])).rows[0].r;
            assert.deepEqual(await put('../secret.webp', '#14213d', BLUR), { ok: false, code: 'PATH_INVALID' });
            assert.deepEqual(await put(`autre/${partner.partner_id}/x.webp`, '#14213d', BLUR), { ok: false, code: 'PATH_INVALID' });
            assert.deepEqual(await put(okPath, '#ffffff', BLUR), { ok: false, code: 'COLOR_INVALID' }, 'blanc refusé (contraste 1:1)');
            assert.deepEqual(await put(okPath, '#ff8a3d', BLUR), { ok: false, code: 'COLOR_INVALID' }, 'orange vif refusé (contraste < 4,5:1)');
            assert.deepEqual(await put(okPath, 'red', BLUR), { ok: false, code: 'COLOR_INVALID' });
            assert.deepEqual(await put(okPath, '#14213d', 'data:image/png;base64,AAAA'), { ok: false, code: 'BLUR_INVALID' });
            assert.deepEqual(await put(okPath, '#14213d', `${BLUR}<script>`), { ok: false, code: 'BLUR_INVALID' });
            assert.deepEqual(await put(okPath, '#7c3a10', BLUR), { ok: true, events: 0 });
            const contrast = (await db.query<{ c: string }>(`SELECT round(public.poster_color_contrast('#7c3a10'), 2)::text AS c`)).rows[0].c;
            console.log(`[D1D-MIG] contraste de #7c3a10 avec le blanc : ${contrast}`);

            // 3. Trigger et rangement dans les événements qui citent déjà le fichier
            const base = String(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, '');
            const url = `${base}/storage/v1/object/public/public-images/${okPath}`;
            await db.query('UPDATE public.events SET image_url = $1 WHERE id = $2', [url, partner.id]);
            const after1 = (await db.query('SELECT poster_color, poster_blur FROM public.events WHERE id = $1', [partner.id])).rows[0];
            assert.deepEqual(after1, { poster_color: '#7c3a10', poster_blur: BLUR }, 'trigger : style du fichier');
            assert.deepEqual(await put(okPath, '#0f7c9a', BLUR), { ok: true, events: 1 }, 'événement qui cite déjà le fichier');
            assert.deepEqual(await put(okPath, '#0f7c9a', BLUR), { ok: true, events: 0 }, 'rejoué : aucune écriture');
            const after2 = (await db.query('SELECT poster_color FROM public.events WHERE id = $1', [partner.id])).rows[0];
            assert.equal(after2.poster_color, '#0f7c9a');
            await db.query('UPDATE public.events SET image_url = $1 WHERE id = $2', [`${base}/storage/v1/object/public/public-images/events/${partner.partner_id}/inconnue.webp`, partner.id]);
            assert.deepEqual((await db.query('SELECT poster_color, poster_blur FROM public.events WHERE id = $1', [partner.id])).rows[0], { poster_color: null, poster_blur: null }, 'fichier sans style');
            await db.query('UPDATE public.events SET image_url = $1 WHERE id = $2', [url, partner.id]);
            await db.query(`UPDATE public.events SET image_url = 'https://exemple.test/affiche.webp' WHERE id = $1`, [partner.id]);
            assert.deepEqual((await db.query('SELECT poster_color, poster_blur FROM public.events WHERE id = $1', [partner.id])).rows[0], { poster_color: null, poster_blur: null }, 'autre hôte');
            await db.query('UPDATE public.events SET title = title WHERE id = $1', [partner.id]);

            // 4. Favoris
            const client = (await db.query<{ id: string }>(`SELECT id::text FROM public.users WHERE status::text = 'ACTIF' ORDER BY created_at LIMIT 1`)).rows[0].id;
            const other = (await db.query<{ id: string }>(`SELECT id::text FROM public.users WHERE status::text = 'ACTIF' AND id <> $1 ORDER BY created_at LIMIT 1`, [client])).rows[0].id;
            const pub = (await db.query<{ id: string }>(`SELECT id::text FROM public.events WHERE slug = 'test-fixture-a-publie'`)).rows[0].id;
            const fav = async (u: string, e: string, on: boolean): Promise<Record<string, unknown>> =>
                (await db.query<{ r: Record<string, unknown> }>('SELECT public.event_favorite_set($1, $2, $3) AS r', [u, e, on])).rows[0].r;
            assert.deepEqual(await fav(client, partner.id, true), { ok: false, code: 'EVENT_NOT_FOUND' }, 'brouillon');
            assert.deepEqual(await fav(randomUUID(), pub, true), { ok: false, code: 'ACCOUNT_INACTIVE' }, 'compte inexistant');
            assert.deepEqual(await fav(client, randomUUID(), true), { ok: false, code: 'EVENT_NOT_FOUND' }, 'événement inconnu');
            assert.deepEqual(await fav(client, pub, true), { ok: true, favorite: true });
            // Brouillon inséré à la main (comme une donnée d'avant) : jamais lu dans la liste
            await db.query('INSERT INTO public.event_favorites (user_id, event_id) VALUES ($1, $2)', [client, partner.id]);
            const list = (await db.query<{ event_id: string }>('SELECT event_id::text FROM public.event_favorite_list($1, 10)', [client])).rows.map((r) => r.event_id);
            assert.deepEqual(list, [pub], `liste du compte : ${list.join(', ')}`);
            const otherList = (await db.query('SELECT * FROM public.event_favorite_list($1, 10)', [other])).rows;
            assert.deepEqual(otherList, [], 'liste d’un autre compte');
            assert.deepEqual(await fav(client, pub, false), { ok: true, favorite: false });
        });
    });
});
