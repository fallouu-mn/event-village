/**
 * Finition 3d, correctifs de la contre-vérification (T2 et T3) — coût de admin_session_code_valid() sur une lecture REST.
 *
 * is_admin() et is_superadmin() appellent admin_session_code_valid() dans chaque politique de lecture réservée aux admins.
 * La version corrigée (migrations 20261120000007 et …08) lit en plus auth.sessions (T2) et admin_session_activity (T3) :
 * une seule requête, jointures sur clés primaires, STABLE. Mesure demandée : effet sur une lecture REST de 1 000 lignes.
 *
 *  - 1 000 lignes du journal (audit_logs, politique is_superadmin()) marquées pour cette suite, lues par la REST avec le
 *    jeton d'un Superadmin : médiane de 15 lectures, après 3 lectures d'échauffement ;
 *  - « avant » : la définition du lot 9 quinquies (20261112000011) remise le temps de la mesure, puis la définition en
 *    place recopiée telle quelle (bloc finally) ; la suite vérifie ensuite que la version corrigée est bien revenue.
 * Chiffres écrits au journal ([F3D-CV-MESURE]) et repris au rapport. Borne large (pas une mesure de performance fine) :
 * la version corrigée ne doit pas coûter plus du double de l'ancienne, plus 25 ms.
 * Fin de suite : assertFinition3dInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { inspect, writeLocal } from '../helpers/db';
import { assertFinition3dInvariants } from '../helpers/finition3d-invariants';
import { newAdmin, type TestAdmin } from './notif-helpers';

const ROWS = 1_000;
const RUNS = 15;
const WARMUP = 3;
const LOT9QQ_BODY = `CREATE OR REPLACE FUNCTION public.admin_session_code_valid()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
    SELECT COALESCE(EXISTS (
        SELECT 1
          FROM public.admin_session_codes c
         WHERE c.session_id = public.try_uuid(auth.jwt() ->> 'session_id')
           AND c.user_id = auth.uid()
           AND c.code_at > now() - interval '12 hours'
    ), FALSE);
$fn$`;

let sa: TestAdmin;
const marker = randomUUID();

before(async () => {
    sa = await newAdmin('f3dcv-mesure', [], { role: 'SUPERADMIN' });
    await writeLocal((c) => c.query(
        `INSERT INTO public.audit_logs (user_id, user_role, action, object_type, object_id, metadata)
         SELECT NULL, 'SYSTEM', 'F3D_CV_MESURE', 'f3d_cv_mesure', $1::uuid, jsonb_build_object('rang', g)
           FROM generate_series(1, $2::int) AS g`, [marker, ROWS]));
});

after(async () => {
    await assertFinition3dInvariants('f3d-cv-rest-mesure');
});

async function restRead(): Promise<{ ms: number; rows: number }> {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/audit_logs?select=id&object_type=eq.f3d_cv_mesure&object_id=eq.${marker}&limit=${ROWS}`;
    const started = performance.now();
    const res = await fetch(url, {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${sa.accessToken}` },
    });
    const body = (await res.json()) as unknown;
    const ms = performance.now() - started;
    assert.equal(res.status, 200, `lecture REST : HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
    return { ms, rows: Array.isArray(body) ? body.length : -1 };
}

async function median(): Promise<{ ms: number; rows: number }> {
    for (let i = 0; i < WARMUP; i++) await restRead();
    const times: number[] = [];
    let rows = -1;
    for (let i = 0; i < RUNS; i++) {
        const r = await restRead();
        times.push(r.ms);
        rows = r.rows;
    }
    times.sort((a, b) => a - b);
    return { ms: times[Math.floor(times.length / 2)], rows };
}

async function currentDefinition(): Promise<string> {
    return inspect(async (c) => String((await c.query(
        `SELECT pg_get_functiondef('public.admin_session_code_valid()'::regprocedure) AS d`)).rows[0].d));
}

describe('contre-vérification T2 et T3 : coût de admin_session_code_valid() sur une lecture REST de 1 000 lignes', () => {
    test('version corrigée : STABLE, une seule requête SQL, session encore ouverte et activité récente exigées', async () => {
        const meta = await inspect(async (c) => (await c.query(
            `SELECT p.provolatile, l.lanname FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
              WHERE p.oid = 'public.admin_session_code_valid()'::regprocedure`)).rows[0] as { provolatile: string; lanname: string });
        assert.deepEqual([meta.provolatile, meta.lanname], ['s', 'sql'], 'STABLE et en SQL (une requête)');
        const def = await currentDefinition();
        assert.match(def, /auth\.sessions/, 'T2 : session du jeton encore ouverte');
        assert.match(def, /admin_session_activity/, 'T3 : activité récente');
    });

    test('avant / après : médianes de 15 lectures REST de 1 000 lignes, version corrigée remise en place', async () => {
        const fixed = await currentDefinition();
        const after3d = await median();
        assert.equal(after3d.rows, ROWS, `version corrigée : ${after3d.rows} ligne(s) lue(s) au lieu de ${ROWS}`);
        let before3d: { ms: number; rows: number };
        try {
            await writeLocal((c) => c.query(LOT9QQ_BODY));
            before3d = await median();
        } finally {
            await writeLocal((c) => c.query(fixed));
        }
        const restored = await currentDefinition();
        assert.equal(restored, fixed, 'la version corrigée doit être remise en place à l’identique');
        assert.equal(before3d.rows, ROWS, `version du lot 9 quinquies : ${before3d.rows} ligne(s) lue(s)`);
        const delta = after3d.ms - before3d.ms;
        console.log(`[F3D-CV-MESURE] lecture REST de ${ROWS} lignes (audit_logs, Superadmin) : médiane avant ${before3d.ms.toFixed(1)} ms, après ${after3d.ms.toFixed(1)} ms, écart ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} ms (${((delta / before3d.ms) * 100).toFixed(0)} %)`);
        assert.ok(after3d.ms <= before3d.ms * 2 + 25, `version corrigée trop lente : ${after3d.ms.toFixed(1)} ms contre ${before3d.ms.toFixed(1)} ms`);
    });
});
