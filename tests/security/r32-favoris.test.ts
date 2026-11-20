/**
 * R32 — Design 1d (point 8) : une personne ne voit jamais les favoris d'une autre, et personne n'écrit dans la table des
 * favoris autrement que par les routes serveur (compte de la session).
 *  1. Routes (session en cookies, comme le navigateur) : A ajoute un événement publié ; B ne le voit pas (identifiants ni
 *     cartes), même en passant le compte de A en paramètre ; le retrait de B ne touche pas au favori de A ; sans session :
 *     401 partout.
 *  2. REST sous le jeton de B, puis sans jeton : lecture, insertion au nom de A, mise à jour et suppression dans
 *     public.event_favorites → refusées (aucun droit de table).
 *  3. Fonctions event_favorite_list et event_favorite_set appelées par la REST (jeton de B avec le compte de A, puis sans
 *     jeton) → refusées (exécution réservée au serveur).
 *  4. Événement annulé (public) : ajout refusé, même réponse qu'un identifiant inconnu.
 * Rouge avant le design 1d : routes absentes (module introuvable) ; 2 et 3 déjà refusés tant que la table et les fonctions
 * n'existent pas (garde-fous, signalés au rapport).
 * Acteurs : comptes jetables (signUpAttacker), clé anon seule. Sortie brute `[R32]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { sessionCookies, type SessionCookie } from '../helpers/middleware';
import { anonClient, assertDenied, publicEvent, signUpAttacker, type AttackerAccount } from './helpers';

type Row = Record<string, unknown>;
interface Reply { status: number; body: Row }

let a: AttackerAccount;
let b: AttackerAccount;
let aCookies: SessionCookie[];
let bCookies: SessionCookie[];
let published = '';
let cancelled = '';

before(async () => {
    a = await signUpAttacker('r32-a');
    b = await signUpAttacker('r32-b');
    aCookies = await sessionCookies(a.client);
    bCookies = await sessionCookies(b.client);
    published = (await publicEvent('A_PUBLIE')).eventId;
    cancelled = (await publicEvent('B_ANNULATION')).eventId;
});

after(async () => {
    // Favori de A retiré (état laissé propre)
    await call('DELETE', `/api/favorites/${published}`, aCookies, { eventId: published }).catch((err: unknown) => {
        console.error('[R32] nettoyage du favori de A impossible :', err instanceof Error ? err.message : String(err));
    });
});

function cookieHeader(cookies: SessionCookie[] | null): Record<string, string> {
    return cookies ? { cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; ') } : {};
}

async function call(method: 'GET' | 'PUT' | 'DELETE', url: string, cookies: SessionCookie[] | null, params?: { eventId: string }): Promise<Reply> {
    const path = params ? '../../app/api/favorites/[eventId]/route' : '../../app/api/favorites/route';
    const mod = (await import(path)) as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>;
    const req = new NextRequest(`http://127.0.0.1:3000${url}`, { method, headers: cookieHeader(cookies) });
    const res = await mod[method](req, params ? { params: Promise.resolve(params) } : undefined);
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) as Row : {} };
}

describe('1. routes : favoris de la session seulement', () => {
    test('A ajoute ; B ne voit rien, même avec le compte de A en paramètre ; le retrait de B ne touche pas A', async () => {
        const added = await call('PUT', `/api/favorites/${published}`, aCookies, { eventId: published });
        console.log(`[R32] 1. ajout par A : ${JSON.stringify(added)}`);
        assert.deepEqual(added, { status: 200, body: { favorite: true } });
        assert.deepEqual(await call('GET', '/api/favorites', aCookies), { status: 200, body: { ids: [published] } });

        const seenByB = await call('GET', `/api/favorites?userId=${a.userId}&user_id=${a.userId}&p_user=${a.userId}`, bCookies);
        const cardsByB = await call('GET', `/api/favorites?cartes=1&userId=${a.userId}`, bCookies);
        console.log(`[R32] 1. lu par B : ${JSON.stringify(seenByB)} ; cartes : ${JSON.stringify(cardsByB)}`);
        assert.deepEqual(seenByB, { status: 200, body: { ids: [] } });
        assert.deepEqual(cardsByB, { status: 200, body: { events: [] } });

        assert.deepEqual(await call('DELETE', `/api/favorites/${published}`, bCookies, { eventId: published }), { status: 200, body: { favorite: false } });
        assert.deepEqual(await call('GET', '/api/favorites', aCookies), { status: 200, body: { ids: [published] } }, 'le retrait de B a touché A');
    });

    test('sans session : 401 partout', async () => {
        for (const [method, url, params] of [
            ['GET', '/api/favorites', undefined],
            ['GET', '/api/favorites?cartes=1', undefined],
            ['PUT', `/api/favorites/${published}`, { eventId: published }],
            ['DELETE', `/api/favorites/${published}`, { eventId: published }],
        ] as const) {
            const r = await call(method, url, null, params);
            assert.equal(r.status, 401, `${method} ${url} sans session : ${JSON.stringify(r)}`);
        }
    });
});

describe('2. table event_favorites : aucun accès par la REST', () => {
    test('jeton de B, puis sans jeton : lecture, insertion au nom de A, mise à jour, suppression refusées', async () => {
        for (const [who, client] of [['B', b.client], ['anon', anonClient()]] as const) {
            const read = await client.from('event_favorites').select('user_id, event_id');
            console.log(`[R32] 2. ${who} lecture : ${read.error?.code ?? 'acceptée'} ${JSON.stringify(read.data)}`);
            assertDenied(read.error, `${who} : lecture de event_favorites`);
            const ins = await client.from('event_favorites').insert({ user_id: a.userId, event_id: published });
            assertDenied(ins.error, `${who} : insertion au nom de A`);
            const upd = await client.from('event_favorites').update({ created_at: new Date().toISOString() }).eq('user_id', a.userId);
            assertDenied(upd.error, `${who} : mise à jour des favoris de A`);
            const del = await client.from('event_favorites').delete().eq('user_id', a.userId);
            assertDenied(del.error, `${who} : suppression des favoris de A`);
        }
        assert.deepEqual(await call('GET', '/api/favorites', aCookies), { status: 200, body: { ids: [published] } }, 'favori de A touché');
    });
});

describe('3. fonctions des favoris : exécution réservée au serveur', () => {
    test('event_favorite_list et event_favorite_set refusées (jeton de B avec le compte de A, sans jeton)', async () => {
        for (const [who, client] of [['B', b.client], ['anon', anonClient()]] as const) {
            const list = await client.rpc('event_favorite_list', { p_user: a.userId, p_limit: 10 });
            console.log(`[R32] 3. ${who} event_favorite_list : ${list.error?.code ?? 'acceptée'} ${JSON.stringify(list.data)}`);
            assertDenied(list.error, `${who} : event_favorite_list(A)`);
            const set = await client.rpc('event_favorite_set', { p_user: a.userId, p_event: published, p_on: false });
            assertDenied(set.error, `${who} : event_favorite_set(A, retrait)`);
            const add = await client.rpc('event_favorite_set', { p_user: b.userId, p_event: published, p_on: true });
            assertDenied(add.error, `${who} : event_favorite_set(B, ajout direct)`);
        }
        assert.deepEqual(await call('GET', '/api/favorites', aCookies), { status: 200, body: { ids: [published] } }, 'favori de A touché');
    });
});

describe('4. événement annulé : ajout refusé comme un inconnu', () => {
    test('annulé (public) et identifiant inconnu : même 404', async () => {
        const unknown = await call('PUT', `/api/favorites/${randomUUID()}`, bCookies, { eventId: randomUUID() });
        const onCancelled = await call('PUT', `/api/favorites/${cancelled}`, bCookies, { eventId: cancelled });
        console.log(`[R32] 4. inconnu ${JSON.stringify(unknown)} ; annulé ${JSON.stringify(onCancelled)}`);
        assert.equal(unknown.status, 404);
        assert.deepEqual(onCancelled, unknown);
    });
});
