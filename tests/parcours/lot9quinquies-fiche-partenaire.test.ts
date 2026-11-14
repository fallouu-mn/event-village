/**
 * Lot 9 quinquies, A9 — contre-vérification du lot 9 quater, point 2 : droits de la partenaire selon le statut de sa
 * FICHE partenaire.
 *
 * Fiche EN_ATTENTE : seulement la lecture du tableau de bord, du profil, des pièces et le complément de dossier ; tout le
 * reste (événements, équipe, finances, retraits, scan) exige une fiche VALIDE. Fiche REJETE : complément de dossier
 * seulement (avec la lecture du tableau de bord, qui porte le motif et le bouton, et des pièces).
 * Cas :
 *  1. inventaire imprimé pour le rapport : chaque politique et chaque fonction qui utilise is_partner_owner ;
 *  2. partenaire validée dont la fiche est remise EN_ATTENTE (compte ACTIF, événement à elle) : chaque route
 *     /api/partner/** (toutes les méthodes, hors liste blanche) → 403 PARTNER_NOT_VALIDATED ; tableau de bord et profil
 *     lisibles ; scan de son événement refusé ; REST : son événement n'est plus lisible ni modifiable ;
 *  3. fiche REJETE : profil refusé, tableau de bord lisible, complément de dossier admis par la garde ;
 *  4. témoin : fiche de nouveau VALIDE, tout revient.
 * Rouge avant correctif : routes et REST ouvertes à une fiche EN_ATTENTE dont le compte est ACTIF.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { inspect } from '../helpers/db';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';
import { BASE_URL } from './helpers';
import { service } from './paiement-helpers';
import { createPartnerEvent, newPartner, type TestPartner } from './finance-helpers';

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const ROOT = path.join(process.cwd(), 'app', 'api', 'partner');
/** Routes publiques (sans session) : inscription et dépôt de pièces avant le compte. */
const PUBLIC_ROUTES = new Set(['register', 'documents/upload']);
const PENDING_ALLOWED = new Set(['GET dashboard', 'GET profile', 'GET documents/signed-url', 'POST dossier/complete']);

let partner: TestPartner;
let eventId: string;

before(async () => {
    partner = await newPartner('a9-fiche');
    eventId = (await createPartnerEvent(partner.partnerId, 'a9', [{ name: 'Standard', price: 5_000, total: 20 }])).eventId;
});

after(async () => {
    await setFiche('VALIDE');
    await assertLot9quinquiesInvariants('lot9quinquies-fiche-partenaire');
});

async function setFiche(status: 'VALIDE' | 'EN_ATTENTE' | 'REJETE'): Promise<void> {
    const { error } = await service.from('partners').update({ status, ...(status === 'REJETE' ? { rejection_reason: 'Pièces illisibles (A9)' } : {}) }).eq('id', partner.partnerId);
    assert.equal(error, null, `fiche ${status} : ${error?.message}`);
}

/** Toutes les routes de app/api/partner (chemin relatif, segments dynamiques). */
function partnerRoutes(): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else if (e.name === 'route.ts') out.push(path.relative(ROOT, dir).split(path.sep).join('/'));
        }
    };
    walk(ROOT);
    return out.sort();
}

function concretePath(rel: string): { url: string; params: Record<string, string> } {
    const params: Record<string, string> = {};
    const segs = rel.split('/').map((s) => {
        const m = /^\[(\w+)\]$/.exec(s);
        if (!m) return s;
        const value = m[1] === 'id' || m[1] === 'eventId' ? eventId : randomUUID();
        params[m[1]] = value;
        return value;
    });
    return { url: `/api/partner/${segs.join('/')}`, params };
}

async function call(rel: string, method: string, token: string, body: unknown = {}): Promise<{ status: number; body: Record<string, unknown> } | null> {
    const mod = (await import(`../../app/api/partner/${rel}/route`)) as Record<string, Handler | undefined>;
    const handler = mod[method];
    if (typeof handler !== 'function') return null;
    const { url, params } = concretePath(rel);
    const req = new NextRequest(`${BASE_URL}${url}?eventId=${eventId}`, {
        method,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
    });
    const res = await handler(req, { params: Object.assign(Promise.resolve(params), params) });
    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    try { parsed = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { parsed = { raw: text.slice(0, 200) }; }
    return { status: res.status, body: parsed };
}

/** is_partner_owner évaluée sous le rôle authenticated, jeton de la partenaire posé (transaction en lecture seule). */
async function ownerCheck(): Promise<boolean> {
    return inspect(async (c) => {
        await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: partner.userId, role: 'authenticated' })]);
        await c.query('SET LOCAL ROLE authenticated');
        return (await c.query<{ ok: boolean }>('SELECT public.is_partner_owner($1) AS ok', [partner.partnerId])).rows[0].ok;
    });
}

function userClient(token: string) {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
    });
}

describe('A9 — droits de la partenaire selon le statut de sa fiche', () => {
    test('inventaire pour le rapport : politiques et fonctions qui utilisent is_partner_owner', async () => {
        const rows = await inspect(async (c) => (await c.query<{ kind: string; name: string }>(`
            SELECT 'politique' AS kind, schemaname || '.' || tablename || ' : ' || policyname || ' (' || cmd || ')' AS name
              FROM pg_policies
             WHERE COALESCE(qual, '') ~ 'is_partner_owner' OR COALESCE(with_check, '') ~ 'is_partner_owner'
            UNION ALL
            SELECT 'fonction', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
              FROM pg_proc p
             WHERE p.pronamespace = 'public'::regnamespace AND p.proname <> 'is_partner_owner'
               AND pg_get_functiondef(p.oid) ~ 'is_partner_owner'
             ORDER BY 1, 2`)).rows);
        for (const r of rows) console.log(`[A9-INVENTAIRE] ${r.kind} | ${r.name}`);
        console.log(`[A9-INVENTAIRE] total : ${rows.length}`);
        assert.ok(rows.length > 0, 'au moins un usage');
    });

    test('fiche remise EN_ATTENTE (compte ACTIF) : toute route /api/partner hors liste blanche → 403 PARTNER_NOT_VALIDATED ; tableau de bord et profil lisibles', async () => {
        await setFiche('EN_ATTENTE');
        const wrong: string[] = [];
        const allowedSeen: string[] = [];
        for (const rel of partnerRoutes()) {
            if (PUBLIC_ROUTES.has(rel)) continue;
            for (const method of METHODS) {
                const r = await call(rel, method, partner.accessToken);
                if (!r) continue;
                const key = `${method} ${rel.replace(/\[\w+\]/g, '*')}`;
                if (PENDING_ALLOWED.has(`${method} ${rel}`)) {
                    allowedSeen.push(`${key} → ${r.status}`);
                    if (r.body.code === 'PARTNER_NOT_VALIDATED') wrong.push(`${key} : refusée alors qu'elle est permise (${r.status})`);
                    continue;
                }
                if (!(r.status === 403 && r.body.code === 'PARTNER_NOT_VALIDATED')) wrong.push(`${key} : ${r.status} ${JSON.stringify(r.body).slice(0, 160)}`);
            }
        }
        console.log(`[A9] routes permises à une fiche EN_ATTENTE : ${allowedSeen.join(' ; ')}`);
        assert.deepEqual(wrong, [], `routes ouvertes à une fiche EN_ATTENTE :\n${wrong.join('\n')}`);
        const dash = await call('dashboard', 'GET', partner.accessToken);
        assert.equal(dash?.status, 200, `tableau de bord : ${JSON.stringify(dash?.body).slice(0, 200)}`);
        const prof = await call('profile', 'GET', partner.accessToken);
        assert.equal(prof?.status, 200, `profil : ${JSON.stringify(prof?.body).slice(0, 200)}`);
    });

    test('fiche EN_ATTENTE : scan de son événement refusé (403 PARTNER_NOT_VALIDATED)', async () => {
        await setFiche('EN_ATTENTE');
        const { POST } = (await import('../../app/api/controller/scan/route')) as { POST: Handler };
        const res = await POST(new NextRequest(`${BASE_URL}/api/controller/scan`, {
            method: 'POST',
            headers: { authorization: `Bearer ${partner.accessToken}`, 'content-type': 'application/json', 'idempotency-key': randomUUID() },
            body: JSON.stringify({ eventId, manualTicketNumber: 'EV-0000-0000' }),
        }));
        const body = (await res.json()) as Record<string, unknown>;
        assert.deepEqual([res.status, body.code], [403, 'PARTNER_NOT_VALIDATED'], JSON.stringify(body));
    });

    test('fiche EN_ATTENTE : par la REST, son événement n\'est plus lisible ni modifiable (is_partner_owner)', async () => {
        await setFiche('EN_ATTENTE');
        const db = userClient(partner.accessToken);
        const { data: read } = await db.from('ticket_categories').select('id').eq('event_id', eventId);
        assert.equal((read ?? []).length > 0, true, 'catégories d\'un événement PUBLIE : lecture publique (témoin)');
        const owned = await ownerCheck();
        assert.equal(owned, false, 'is_partner_owner faux pour une fiche EN_ATTENTE');
    });

    test('fiche REJETE : profil refusé, tableau de bord lisible, complément de dossier admis par la garde', async () => {
        await setFiche('REJETE');
        const prof = await call('profile', 'GET', partner.accessToken);
        assert.deepEqual([prof?.status, prof?.body.code], [403, 'PARTNER_NOT_VALIDATED'], JSON.stringify(prof?.body));
        const dash = await call('dashboard', 'GET', partner.accessToken);
        assert.equal(dash?.status, 200, JSON.stringify(dash?.body).slice(0, 200));
        const dossier = await call('dossier/complete', 'POST', partner.accessToken, {});
        assert.notEqual(dossier?.body.code, 'PARTNER_NOT_VALIDATED', `complément de dossier : ${JSON.stringify(dossier?.body)}`);
        const team = await call('team/all', 'GET', partner.accessToken);
        assert.deepEqual([team?.status, team?.body.code], [403, 'PARTNER_NOT_VALIDATED'], JSON.stringify(team?.body));
    });

    test('témoin : fiche de nouveau VALIDE, profil et équipe lisibles, is_partner_owner vrai', async () => {
        await setFiche('VALIDE');
        assert.equal((await call('profile', 'GET', partner.accessToken))?.status, 200);
        assert.equal((await call('team/all', 'GET', partner.accessToken))?.status, 200);
        const owned = await ownerCheck();
        assert.equal(owned, true, 'is_partner_owner vrai pour une fiche VALIDE');
    });
});
