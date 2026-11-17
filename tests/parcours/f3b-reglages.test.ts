/**
 * Finition 3b, point 3 (E-35) — réglages de la plateforme trouvables, expliqués, bornés à l'écran, historisés avec l'auteur.
 *
 *  - Bornes : chaque réglage numérique du catalogue (lib/settings/catalog.ts, lu par l'écran) a exactement les bornes de la
 *    base (fin_setting_valid) : min et max admis, juste en dessous et juste au-dessus refusés, décimal refusé pour un
 *    entier ; et chaque réglage numérique de la base a ses bornes dans le catalogue (aucun oubli).
 *  - Défaut : GET /api/admin/finance-settings rend la valeur d'origine de chaque réglage (premier état de l'historique,
 *    sinon la valeur actuelle) ; après un changement, le défaut reste la valeur d'origine.
 *  - Historique : chaque ligne dit qui (prénom et nom de l'auteur), quoi, quand et pourquoi.
 *  - Refus du serveur en français, avec le nom du réglage et ses bornes, jamais la clé technique.
 * Rouge avant la finition (catalogue, défauts et auteurs absents ; refus « Valeur refusée pour finance.… »).
 * Fin de suite : assertFinition3bInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { NextRequest } from 'next/server';
import { inspect } from '../helpers/db';
import { assertFinition3bInvariants } from '../helpers/finition3b-invariants';
import { jsonRequest } from './finance-helpers';
import { newAdmin, type TestAdmin } from './notif-helpers';
import { importModule } from './paiement-helpers';

type Handler = (req: NextRequest) => Promise<Response>;
type Bounds = { min: number; max: number; integer: boolean; step: number };
type Reply = {
    settings: Array<{ key: string; value: unknown }>;
    defaults?: Record<string, unknown>;
    history: Array<{ key: string; changed_by: string | null; author?: string; reason: string | null; changed_at: string }>;
};

const ROUTE = '../../app/api/admin/finance-settings/route';
const KEY = 'access.low_stock_threshold';

let superadmin: TestAdmin;
let reader: TestAdmin;

before(async () => {
    superadmin = await newAdmin('f3b-reglages-super', [], { role: 'SUPERADMIN' });
    reader = await newAdmin('f3b-reglages-lecteur', ['settings.read']);
});

after(async () => {
    await assertFinition3bInvariants('f3b-reglages');
});

async function get(admin: TestAdmin): Promise<Reply> {
    const { GET } = (await importModule(ROUTE)) as { GET: Handler };
    const res = await GET(jsonRequest('/api/admin/finance-settings', 'GET', admin.accessToken));
    const body = (await res.json()) as Reply;
    assert.equal(res.status, 200, JSON.stringify(body).slice(0, 300));
    return body;
}

async function put(admin: TestAdmin, key: string, value: unknown, reason: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const { PUT } = (await importModule(ROUTE)) as { PUT: Handler };
    const res = await PUT(jsonRequest('/api/admin/finance-settings', 'PUT', admin.accessToken, { key, value, reason }));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe('bornes : le catalogue de l’écran et la base disent la même chose', () => {
    test('chaque borne du catalogue est celle de fin_setting_valid, et aucun réglage numérique n’est oublié', async () => {
        const { SETTING_BOUNDS } = (await importModule('../../lib/settings/catalog')) as { SETTING_BOUNDS: Record<string, Bounds> };
        const faults: string[] = [];
        await inspect(async (c) => {
            const valid = async (key: string, v: number): Promise<boolean> =>
                (await c.query<{ ok: boolean }>('SELECT public.fin_setting_valid($1, to_jsonb($2::numeric)) AS ok', [key, v])).rows[0].ok;
            for (const [key, b] of Object.entries(SETTING_BOUNDS)) {
                if (!(await valid(key, b.min))) faults.push(`${key} : min ${b.min} refusé par la base`);
                if (!(await valid(key, b.max))) faults.push(`${key} : max ${b.max} refusé par la base`);
                if (await valid(key, b.min - b.step)) faults.push(`${key} : ${b.min - b.step} (sous le min) admis par la base`);
                if (await valid(key, b.max + b.step)) faults.push(`${key} : ${b.max + b.step} (au-dessus du max) admis par la base`);
                if (b.integer && await valid(key, b.min + 0.5)) faults.push(`${key} : décimal admis par la base alors que l’écran attend un entier`);
            }
            const { rows } = await c.query<{ def: string }>(`SELECT pg_get_functiondef('public.fin_setting_valid(text, jsonb)'::regprocedure) AS def`);
            const numericKeys = [...rows[0].def.matchAll(/WHEN '([a-zA-Z0-9_.]+)' THEN n/g)].map((m) => m[1]);
            assert.ok(numericKeys.length >= 20, `réglages numériques lus dans la base : ${numericKeys.length}`);
            for (const k of numericKeys) if (!SETTING_BOUNDS[k]) faults.push(`${k} : réglage numérique sans bornes dans le catalogue`);
        });
        assert.deepEqual(faults, [], faults.join('\n'));
    });
});

describe('GET /api/admin/finance-settings : défaut de chaque réglage, auteur de chaque changement', () => {
    test('défaut = valeur d’origine, inchangé après un changement ; l’historique nomme l’auteur', async () => {
        const before = await get(reader);
        assert.ok(before.defaults && typeof before.defaults === 'object', `défauts absents : ${Object.keys(before).join(', ')}`);
        for (const s of before.settings) assert.ok(s.key in before.defaults!, `défaut absent pour ${s.key}`);
        const current = Number(before.settings.find((s) => s.key === KEY)?.value);
        const original = before.defaults![KEY];
        const next = current === 20 ? 21 : 20;
        const r = await put(superadmin, KEY, next, 'Essai de la finition 3b : défaut et auteur');
        assert.equal(r.status, 200, JSON.stringify(r.body));
        try {
            const mid = await get(reader);
            assert.deepEqual(mid.defaults![KEY], original, 'le défaut a suivi le changement');
            const line = mid.history.find((h) => h.key === KEY && h.reason === 'Essai de la finition 3b : défaut et auteur');
            assert.ok(line, 'changement absent de l’historique');
            assert.equal(line.author, 'Ndeye Administratrice', `auteur : ${JSON.stringify(line)}`);
        } finally {
            const back = await put(superadmin, KEY, current, 'Essai de la finition 3b : retour à la valeur');
            assert.equal(back.status, 200, JSON.stringify(back.body));
        }
    });

    test('un changement fait sans compte (migration, automate) est attribué à « Automatique »', async () => {
        const reply = await get(reader);
        for (const h of reply.history.filter((x) => x.changed_by === null)) assert.equal(h.author, 'Automatique', JSON.stringify(h));
        for (const h of reply.history) assert.ok(typeof h.author === 'string' && h.author.length > 0, `ligne sans auteur : ${JSON.stringify(h)}`);
    });
});

describe('refus du serveur en français', () => {
    test('valeur hors bornes : 400, nom du réglage et bornes, jamais la clé', async () => {
        const r = await put(superadmin, 'finance.service_fee_rate', 60, 'Essai de la finition 3b : hors bornes');
        assert.equal(r.status, 400);
        const msg = String(r.body.error ?? '');
        assert.match(msg, /Frais de service/, msg);
        assert.match(msg, /entre 0 et 50/, msg);
        assert.doesNotMatch(msg, /finance\./, `clé technique à l’écran : ${msg}`);
        const unchanged = await inspect(async (c) => (await c.query<{ v: string }>(`SELECT value->>'value' AS v FROM public.platform_settings WHERE key = 'finance.service_fee_rate'`)).rows[0].v);
        assert.notEqual(Number(unchanged), 60);
    });
});

