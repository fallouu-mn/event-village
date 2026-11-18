/**
 * Correctifs de la contre-vérification 2b × finition 3d — la pré-requête de PostgREST (securite.db_pre_request, 6.6/6.7,
 * migration 20261121000001) et admin_session_code_valid() de la 3d (20261120000007 et …08) se cumulent.
 *
 * Trois sessions du même ADMIN, toutes passées par le code administrateur :
 *  A. active : la pré-requête laisse passer, is_admin() vrai (comptes d'autrui lus par la REST) ;
 *  B. inactive depuis 31 minutes (règle de la 3d) : la pré-requête laisse passer (session ouverte : son propre compte est
 *     lu, 200), mais admin_session_code_valid() est faux : is_admin() faux, aucun compte d'autrui ;
 *  C. fermée par « Se déconnecter » (GoTrue, scope local) : la pré-requête refuse AVANT toute politique (401
 *     SESSION_FERMEE), table et RPC, même si la ligne admin_session_codes de la session existe encore ;
 *  A reste servie après la fermeture de C (l'autre session du compte n'est pas touchée).
 * Sortie brute `[CVF2B-CUMUL]`. Fin de suite : invariants de la 3d.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { inspect, writeLocal } from '../helpers/db';
import { assertFinition3dInvariants } from '../helpers/finition3d-invariants';
import { newAdmin } from './notif-helpers';
import { steppedUpSession, type OpenSession } from '../audit/cvf3d-helpers';

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

after(async () => {
    await assertFinition3dInvariants('cvf2b-cumul-3d');
});

interface Rest { status: number; code: string | null; rows: unknown }

async function rest(token: string, path: string, init: RequestInit = {}): Promise<Rest> {
    const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
        ...init,
        headers: { apikey: ANON, authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
    const text = await res.text();
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    const code = res.ok ? null : String((body as { code?: unknown } | null)?.code ?? '');
    return { status: res.status, code, rows: body };
}

const others = (s: OpenSession, ownId: string) => rest(s.token, `users?select=id&id=neq.${ownId}&limit=20`);
const own = (s: OpenSession, ownId: string) => rest(s.token, `users?select=id&id=eq.${ownId}`);
const isAdmin = (s: OpenSession) => rest(s.token, 'rpc/is_admin', { method: 'POST', body: '{}' });
const count = (r: Rest): number => (Array.isArray(r.rows) ? r.rows.length : -1);
const brief = (r: Rest): string => `${r.status}${r.code ? ` ${r.code}` : ''} ${Array.isArray(r.rows) ? `${r.rows.length} ligne(s)` : JSON.stringify(r.rows)}`;

async function ageSession(sessionId: string, minutes: number): Promise<void> {
    await writeLocal(async (c) => {
        const r = await c.query(
            `UPDATE public.admin_session_activity SET last_activity_at = now() - make_interval(mins => $2), password_at = now() - make_interval(mins => $2)
              WHERE session_id = $1`, [sessionId, minutes]);
        assert.equal(r.rowCount, 1, 'session admin introuvable dans admin_session_activity');
    });
}

describe('pré-requête (6.6/6.7) et admin_session_code_valid() de la 3d : les deux couches se cumulent', () => {
    test('active : admin ; inactive 31 min : servie sans pouvoir d’administration ; fermée : 401 SESSION_FERMEE ; l’autre session reste servie', async () => {
        const admin = await newAdmin('cvf2b-cumul', ['events.read']);
        const a = await steppedUpSession(admin.email);
        const b = await steppedUpSession(admin.email);
        const c = await steppedUpSession(admin.email);

        // A, B et C avant toute chose : admins
        for (const [name, s] of [['A', a], ['B', b], ['C', c]] as const) {
            const seen = await others(s, admin.userId);
            assert.equal(seen.status, 200, `${name} avant : ${brief(seen)}`);
            assert.ok(count(seen) > 0, `${name} avant : la session passée par le code lit les comptes d'autrui (${brief(seen)})`);
        }

        // B : inactive depuis 31 minutes
        await ageSession(b.sessionId, 31);
        const bOthers = await others(b, admin.userId);
        const bOwn = await own(b, admin.userId);
        const bAdmin = await isAdmin(b);

        // C : « Se déconnecter » sur cet appareil (GoTrue, scope local)
        const out = await fetch(`${URL_BASE}/auth/v1/logout?scope=local`, { method: 'POST', headers: { apikey: ANON, authorization: `Bearer ${c.token}` } });
        assert.ok(out.status === 204 || out.status === 200, `déconnexion de C : HTTP ${out.status}`);
        const cCodeKept = await inspect(async (q) => Number((await q.query('SELECT count(*)::int AS n FROM public.admin_session_codes WHERE session_id = $1', [c.sessionId])).rows[0].n));
        const cOthers = await others(c, admin.userId);
        const cOwn = await own(c, admin.userId);
        const cAdmin = await isAdmin(c);

        // A : toujours servie, toujours admin
        const aOthers = await others(a, admin.userId);
        const aAdmin = await isAdmin(a);

        console.log(`[CVF2B-CUMUL] A active : autrui ${brief(aOthers)}, is_admin ${brief(aAdmin)}`);
        console.log(`[CVF2B-CUMUL] B inactive 31 min : autrui ${brief(bOthers)}, son compte ${brief(bOwn)}, is_admin ${brief(bAdmin)}`);
        console.log(`[CVF2B-CUMUL] C fermée : autrui ${brief(cOthers)}, son compte ${brief(cOwn)}, is_admin ${brief(cAdmin)} ; ligne admin_session_codes encore présente : ${cCodeKept}`);

        assert.equal(bOwn.status, 200, `B (session ouverte) : la pré-requête laisse passer, ${brief(bOwn)}`);
        assert.equal(count(bOwn), 1, `B : son propre compte lu, ${brief(bOwn)}`);
        assert.equal(bOthers.status, 200, `B : ${brief(bOthers)}`);
        assert.equal(count(bOthers), 0, `B inactive : plus aucun compte d'autrui (admin_session_code_valid de la 3d), ${brief(bOthers)}`);
        assert.deepEqual([bAdmin.status, bAdmin.rows], [200, false], `B inactive : is_admin() faux, ${brief(bAdmin)}`);

        for (const [what, r] of [['autrui', cOthers], ['son compte', cOwn], ['is_admin', cAdmin]] as const) {
            assert.deepEqual([r.status, r.code], [401, 'SESSION_FERMEE'], `C fermée, ${what} : refus de la pré-requête attendu, ${brief(r)}`);
        }

        assert.equal(aOthers.status, 200, `A après la fermeture de C : ${brief(aOthers)}`);
        assert.ok(count(aOthers) > 0, `A reste admin : ${brief(aOthers)}`);
        assert.deepEqual([aAdmin.status, aAdmin.rows], [200, true], `A : is_admin() vrai, ${brief(aAdmin)}`);
    });
});
