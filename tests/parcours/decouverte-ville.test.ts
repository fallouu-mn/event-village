/**
 * Lot 9, tâche 9.1 (contrat 4.2, 5.2 ; L22) — « Près de chez vous » : la ville du client, enregistrée une fois.
 *  - PATCH /api/profile/city : `{ city: string(2..80, trim) | null }`, stockée en capitales, relue par /api/auth/me ;
 *    `null` efface ; refus 400 (type, 1 caractère, 81 caractères, corps illisible) ; sans session 401 ; compte suspendu 403 ;
 *  - A ne modifie que lui-même, un identifiant dans le corps est ignoré ;
 *  - `users.city` : nullable, 2 à 80, jamais modifiable par REST (aucun GRANT nouveau) ;
 *  - le middleware : 401 sans session, passe avec ;
 *  - Populaires reste global (L20) et le catalogue filtre sur la ville du profil.
 * Sécurité : l'acteur porte son jeton ; l'écriture REST est tentée avec la clé anon et une session par mot de passe.
 *
 * Rouge avant correctif : la route app/api/profile/city n'existe pas (import dynamique, l'échec la nomme), la colonne
 * users.city non plus ; après les tests, assertLot9Invariants reste rouge tant que M2 et M4 ne sont pas livrés. Cas
 * déjà verts, signalés au commit : les deux cas du middleware (règle générale des /api/*).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { GET as eventsRoute } from '../../app/api/events/route';
import { GET as meRoute } from '../../app/api/auth/me/route';
import { inspect } from '../helpers/db';
import { assertLot9Invariants } from '../helpers/lot9-invariants';
import { callMiddleware, sessionCookies } from '../helpers/middleware';
import { authed } from './acces-helpers';
import { createPartnerEvent, newPartner, type TestPartner } from './finance-helpers';
import { BASE_URL, STRONG_PASSWORD } from './helpers';
import { importModule, newBuyer, service, type Buyer } from './paiement-helpers';
import { issueFreeTicket } from './terrain-helpers';
import { gotrueEmail } from '../helpers/gotrue-email';

const CITY_PATH = '/api/profile/city';
const MARK = randomUUID().replace(/-/g, '').slice(0, 10).toLowerCase();
const CITY_NEAR = `Prochea${MARK}`;
const CITY_FAR = `Lointaineb${MARK}`;

interface Reply { status: number; body: Record<string, unknown>; text: string; headers: Headers }

let a: Buyer;
let b: Buyer;
let suspended: Buyer;
let partner: TestPartner;
let nearEventId: string;
let farEventId: string;

async function freeEventIn(label: string, city: string): Promise<string> {
    const ev = await createPartnerEvent(partner.partnerId, label, [{ name: 'Entrée', price: 0, total: 10 }]);
    const { error } = await service.from('events').update({ city }).eq('id', ev.eventId);
    assert.equal(error, null, `ville de l’événement ${label} : ${error?.message}`);
    await issueFreeTicket(ev.eventId, ev.categories['Entrée'].id, a);
    return ev.eventId;
}

before(async () => {
    a = await newBuyer('ville-a');
    b = await newBuyer('ville-b');
    suspended = await newBuyer('ville-susp');
    const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', suspended.userId);
    assert.equal(error, null, `suspension : ${error?.message}`);
    partner = await newPartner(`ville-${MARK.slice(0, 6)}`);
    nearEventId = await freeEventIn('ville-proche', CITY_NEAR);
    farEventId = await freeEventIn('ville-lointaine', CITY_FAR);
});

after(async () => {
    await assertLot9Invariants('decouverte-ville');
});

async function reply(res: Response): Promise<Reply> {
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
        body = text ? JSON.parse(text) as Record<string, unknown> : {};
    } catch (err) {
        assert.fail(`réponse non JSON (${err instanceof Error ? err.message : String(err)}) : ${text.slice(0, 200)}`);
    }
    return { status: res.status, body, text, headers: res.headers };
}

async function cityRoute(): Promise<(req: NextRequest) => Promise<Response>> {
    const mod = await importModule('../../app/api/profile/city/route');
    assert.equal(typeof mod.PATCH, 'function', 'app/api/profile/city/route doit exporter PATCH (contrat 4.2)');
    return mod.PATCH;
}

async function patchCity(user: Buyer, body: unknown): Promise<Reply> {
    return reply(await (await cityRoute())(authed(CITY_PATH, 'PATCH', user, body)));
}

async function cityOf(userId: string): Promise<unknown> {
    const { data, error } = await service.from('users').select('city').eq('id', userId).single();
    assert.equal(error, null, `lecture de users.city : ${error?.message}`);
    return (data as { city: unknown }).city;
}

function signedClient(): SupabaseClient {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signIn(user: Buyer): Promise<SupabaseClient> {
    const client = signedClient();
    const { error } = await client.auth.signInWithPassword({ email: await gotrueEmail(user.email), password: STRONG_PASSWORD });
    assert.equal(error, null, `connexion : ${error?.message}`);
    return client;
}

describe('PATCH /api/profile/city — enregistrement', () => {
    test('stockée en capitales, sans espaces, rendue et relue par /api/auth/me', async () => {
        const r = await patchCity(a, { city: '  Saint-Louis ' });
        assert.equal(r.status, 200, r.text);
        assert.deepEqual(r.body, { ok: true, city: 'SAINT-LOUIS' });
        assert.match(r.headers.get('cache-control') ?? '', /no-store/, 'réponse non mise en cache');
        assert.equal(await cityOf(a.userId), 'SAINT-LOUIS');
        const me = await reply(await meRoute(authed('/api/auth/me', 'GET', a)));
        assert.equal(me.status, 200, me.text);
        assert.equal((me.body.profile as { city?: unknown }).city, 'SAINT-LOUIS', 'ville relue par /api/auth/me');
    });

    test('accents conservés, 2 et 80 caractères admis', async () => {
        assert.equal((await patchCity(a, { city: 'Thiès' })).body.city, 'THIÈS');
        assert.equal(await cityOf(a.userId), 'THIÈS');
        const two = await patchCity(a, { city: 'ab' });
        assert.equal(two.status, 200, two.text);
        assert.equal(await cityOf(a.userId), 'AB');
        const eighty = await patchCity(a, { city: 'y'.repeat(80) });
        assert.equal(eighty.status, 200, eighty.text);
        assert.equal(await cityOf(a.userId), 'Y'.repeat(80));
    });

    test('`null` efface la ville', async () => {
        await patchCity(a, { city: 'Dakar' });
        assert.equal(await cityOf(a.userId), 'DAKAR', 'précondition');
        const r = await patchCity(a, { city: null });
        assert.equal(r.status, 200, r.text);
        assert.deepEqual(r.body, { ok: true, city: null });
        assert.equal(await cityOf(a.userId), null);
    });
});

describe('PATCH /api/profile/city — refus', () => {
    test('type, 1 caractère, 81 caractères, absente : 400 INVALID_FIELD, ville inchangée', async () => {
        await patchCity(a, { city: 'Dakar' });
        for (const [what, body] of [
            ['type', { city: 42 }],
            ['1 caractère', { city: 'D' }],
            ['1 caractère après trim', { city: '  D  ' }],
            ['81 caractères', { city: 'x'.repeat(81) }],
            ['absente', {}],
        ] as const) {
            const r = await patchCity(a, body);
            assert.equal(r.status, 400, `${what} : ${r.text}`);
            assert.equal(r.body.code, 'INVALID_FIELD', `${what} : ${r.text}`);
            assert.equal(typeof r.body.error, 'string', `${what} : message absent`);
        }
        assert.equal(await cityOf(a.userId), 'DAKAR', 'ville inchangée après les refus');
    });

    test('corps illisible : 400 INVALID_BODY', async () => {
        const req = new NextRequest(`${BASE_URL}${CITY_PATH}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${a.accessToken}` },
            body: 'pas du json',
        });
        const r = await reply(await (await cityRoute())(req));
        assert.equal(r.status, 400, r.text);
        assert.equal(r.body.code, 'INVALID_BODY', r.text);
    });

    test('sans session : 401 AUTH_REQUIRED', async () => {
        const req = new NextRequest(`${BASE_URL}${CITY_PATH}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ city: 'Dakar' }),
        });
        const r = await reply(await (await cityRoute())(req));
        assert.equal(r.status, 401, r.text);
        assert.equal(r.body.code, 'AUTH_REQUIRED', r.text);
    });

    test('compte suspendu : 403 ACCOUNT_NOT_ACTIVE, ville inchangée', async () => {
        const r = await patchCity(suspended, { city: 'Dakar' });
        assert.equal(r.status, 403, r.text);
        assert.equal(r.body.code, 'ACCOUNT_NOT_ACTIVE', r.text);
        assert.equal(await cityOf(suspended.userId), null);
    });

    test('panne de l’écriture : 500 CITY_SAVE_FAILED en français, journalisée, sans texte de la base', async () => {
        const handler = await cityRoute();
        await patchCity(a, { city: 'Dakar' });
        const previousFetch = globalThis.fetch;
        const previousError = console.error;
        const logged: string[] = [];
        let hits = 0;
        globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
            const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
            if (method !== 'PATCH' || new URL(href).pathname !== '/rest/v1/users') return previousFetch(input, init);
            hits++;
            return new Response(JSON.stringify({ message: 'relation "users" sentinelle', code: '42P01' }), { status: 500, headers: { 'content-type': 'application/json' } });
        }) as typeof fetch;
        console.error = (...args: unknown[]): void => { logged.push(args.map(String).join(' ')); };
        let r: Reply;
        try {
            r = await reply(await handler(authed(CITY_PATH, 'PATCH', a, { city: 'Thiès' })));
        } finally {
            globalThis.fetch = previousFetch;
            console.error = previousError;
        }
        assert.ok(hits >= 1, 'panne simulée non atteinte');
        assert.equal(r.status, 500, r.text);
        assert.equal(r.body.code, 'CITY_SAVE_FAILED', r.text);
        assert.equal(r.text.includes('sentinelle'), false, `texte de la base renvoyé : ${r.text}`);
        assert.ok(logged.length >= 1, 'panne journalisée');
        assert.equal(await cityOf(a.userId), 'DAKAR', 'ville inchangée');
    });
});

describe('Droits sur la ville', () => {
    test('A ne modifie que lui-même : un id ou un user_id dans le corps est ignoré', async () => {
        await patchCity(b, { city: null });
        const r = await patchCity(a, { city: 'Kaolack', id: b.userId, user_id: b.userId });
        assert.equal(r.status, 200, r.text);
        assert.equal(await cityOf(a.userId), 'KAOLACK');
        assert.equal(await cityOf(b.userId), null, 'B n’est pas modifié');
    });

    test('users.city : nullable, contrainte users_city_length, UPDATE refusé à anon et authenticated', async () => {
        const facts = await inspect(async (db) => {
            const column = await db.query<{ is_nullable: string }>(
                `SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'city'`);
            assert.equal(column.rows.length, 1, 'colonne public.users.city absente (migration M3, contrat 5.2)');
            const rights = await db.query<Record<string, boolean>>(
                `SELECT has_column_privilege('anon', 'public.users', 'city', 'UPDATE') AS anon_update,
                        has_column_privilege('authenticated', 'public.users', 'city', 'UPDATE') AS auth_update`);
            const check = await db.query<{ def: string }>(
                `SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
                  WHERE n.nspname = 'public' AND t.relname = 'users' AND c.conname = 'users_city_length'`);
            return { nullable: column.rows[0].is_nullable, rights: rights.rows[0], check: check.rows[0]?.def };
        });
        assert.equal(facts.nullable, 'YES', 'users.city nullable');
        assert.deepEqual(facts.rights, { anon_update: false, auth_update: false }, 'aucun GRANT nouveau sur users');
        assert.match(facts.check ?? '', /char_length\(city\)/, `contrainte users_city_length (${facts.check})`);
    });

    test('users.city : 1 caractère et 81 caractères refusés par la base, 23514', async () => {
        for (const [what, city] of [['1 caractère', 'D'], ['81 caractères', 'X'.repeat(81)]] as const) {
            const { error } = await service.from('users').update({ city }).eq('id', b.userId);
            assert.equal(error?.code, '23514', `${what} : ${error?.message}`);
            assert.match(error?.message ?? '', /users_city_length/, what);
        }
    });

    test('écriture directe par REST (clé anon, session du compte) : 42501, ville inchangée', async () => {
        await patchCity(a, { city: 'Dakar' });
        const client = await signIn(a);
        const { error } = await client.from('users').update({ city: 'PIRATE' }).eq('id', a.userId);
        assert.equal(error?.code, '42501', `écriture REST de users.city : ${error?.message} (code ${error?.code})`);
        assert.equal(await cityOf(a.userId), 'DAKAR');
    });
});

describe('Middleware (rappel A41)', () => {
    test('sans session : 401 (déjà vrai, garde-fou)', async () => {
        const result = await callMiddleware(CITY_PATH, []);
        assert.equal(result.status, 401, JSON.stringify(result));
        assert.equal(result.passedThrough, false);
    });

    test('avec une session : le middleware laisse passer (déjà vrai, garde-fou)', async () => {
        const result = await callMiddleware(CITY_PATH, await sessionCookies(await signIn(a)));
        assert.equal(result.passedThrough, true, JSON.stringify(result));
    });
});

describe('Ville du profil et lectures publiques', () => {
    test('le catalogue filtre sur la ville du profil ; Populaires reste global (L20)', async () => {
        const saved = await patchCity(a, { city: CITY_NEAR.toLowerCase() });
        assert.equal(saved.status, 200, saved.text);
        const profileCity = await cityOf(a.userId);
        assert.equal(profileCity, CITY_NEAR.toUpperCase());

        const res = await eventsRoute(new NextRequest(`${BASE_URL}/api/events?city=${encodeURIComponent(String(profileCity))}`));
        const body = await res.json() as { events?: Array<{ id: string }> };
        assert.equal(res.status, 200, JSON.stringify(body).slice(0, 300));
        const listed = (body.events ?? []).map((e) => e.id);
        assert.ok(listed.includes(nearEventId), 'événement de la ville du profil listé');
        assert.ok(!listed.includes(farEventId), 'événement d’une autre ville écarté');

        const { data, error } = await service.rpc('events_popular', { p_limit: 100000 });
        assert.equal(error, null, `events_popular : ${error?.message} (code ${error?.code})`);
        const rows = (data ?? []) as Array<{ event_id: string }>;
        const popular = new Set(rows.map((r) => r.event_id));
        assert.ok(popular.has(nearEventId) && popular.has(farEventId), 'Populaires ne dépend pas de la ville');
    });
});
