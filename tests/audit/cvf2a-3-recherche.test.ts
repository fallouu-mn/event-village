/**
 * Contre-vérification de la finition 2a, attaque 3 — recherche de lieu (GET /api/partner/places/search).
 * Service simulé (serveur local, comme f2a-carte) : aucun appel réel.
 *  a. Qui peut chercher : sans session, client simple, contrôleur, fiche EN_ATTENTE ou REJETE → refus ; organisatrice
 *     à la fiche VALIDE → réponse.
 *  b. Quota : 12 recherches en parallèle pour un compte au quota de 5 ; plusieurs comptes en parallèle : le service ne
 *     reçoit jamais plus d'une requête par seconde (cadence commune), chaque compte garde son propre quota.
 *  c. Requêtes trop longues ou spéciales : 121 caractères, injection de paramètres (&countrycodes=fr&limit=50…),
 *     caractère nul, retours à la ligne, caractères combinants : la requête envoyée au service garde countrycodes=sn,
 *     limit=5, format=jsonv2 ; résultats hors du Sénégal filtrés ; jamais d'erreur 500.
 *  d. Cache partagé : rien d'un compte n'apparaît chez un autre (réponses identiques, aucun identifiant, aucune date) ;
 *     tables et fonction de la recherche inaccessibles par la REST (jeton de la partenaire, sans jeton).
 *  e. Aucune adresse ni contact du service dans les réponses (200, 400, 429, 503).
 * Sortie brute `[CVF2A-3]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { newBuyer } from '../parcours/paiement-helpers';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import { newController } from '../parcours/acces-helpers';
import { resetServerEnvCache } from '../../lib/env';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { anonClient, api, restRows, restRpc, setFiche, show, userClient, type Reply } from './cvf1-helpers';

const CONTACT = 'contact-secret-cvf2a@eventvillage.invalid';

interface FakeRequest { path: string; query: URLSearchParams; raw: string; userAgent: string; at: number }
const seen: FakeRequest[] = [];
let fake: http.Server;
let fakeUrl: string;
let fakeHost: string;
let P: TestPartner;
const saved: Record<string, string | undefined> = {};

before(async () => {
    fake = http.createServer((req, res) => {
        const url = new URL(req.url ?? '/', 'http://fake');
        seen.push({ path: url.pathname, query: url.searchParams, raw: req.url ?? '', userAgent: String(req.headers['user-agent'] ?? ''), at: Date.now() });
        const q = url.searchParams.get('q') ?? '';
        if (q.includes('panne')) {
            res.writeHead(500, { 'content-type': 'text/plain' }).end(`erreur interne de ${fakeHost}`);
            return;
        }
        const rows = [
            { place_id: 1, lat: '48.8566', lon: '2.3522', display_name: `${q}, Paris, France` },
            { place_id: 2, lat: '14.7000', lon: '-17.4500', display_name: `${q.slice(0, 60)} 1, Dakar, Sénégal` },
            { place_id: 3, lat: '14.7100', lon: '-17.4400', display_name: `${q.slice(0, 60)} 2, Dakar, Sénégal` },
        ];
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(rows));
    });
    await new Promise<void>((resolve) => fake.listen(0, '127.0.0.1', resolve));
    const port = (fake.address() as AddressInfo).port;
    fakeUrl = `http://127.0.0.1:${port}`;
    fakeHost = `127.0.0.1:${port}`;
    for (const k of ['NOMINATIM_URL', 'NOMINATIM_CONTACT', 'PLACE_SEARCHES_PER_ACCOUNT_HOUR']) saved[k] = process.env[k];
    process.env.NOMINATIM_URL = fakeUrl;
    process.env.NOMINATIM_CONTACT = CONTACT;
    process.env.PLACE_SEARCHES_PER_ACCOUNT_HOUR = '1000';
    resetServerEnvCache();
    P = await newPartner('cvf2a-lieu');
});

after(async () => {
    for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
    resetServerEnvCache();
    await new Promise<void>((resolve) => fake.close(() => resolve()));
    await assertFinition1Invariants('cvf2a-3-recherche');
});

function search(q: string, token: string | null): Promise<Reply> {
    return api('GET', 'partner/places/search', { token, path: `/api/partner/places/search?q=${encodeURIComponent(q)}` });
}

function uniq(label: string): string {
    return `${label} ${randomUUID().slice(0, 8)}`;
}

/** Ce qu'une réponse ne doit jamais contenir : adresse et contact du service, identification de l'application. */
function serviceLeaks(r: Reply): string[] {
    const text = JSON.stringify(r.body);
    return [fakeUrl, fakeHost, CONTACT, 'nominatim', 'Nominatim', 'EventVillage/1.0', 'User-Agent', 'countrycodes', 'jsonv2']
        .filter((s) => text.includes(s));
}

describe('a. qui peut chercher', () => {
    test('sans session, client, contrôleur, fiche EN_ATTENTE ou REJETE : refus ; fiche VALIDE : réponse', async () => {
        const breaches: string[] = [];
        const q = uniq('Grand Théâtre');
        const before = seen.length;
        const client = await newBuyer('cvf2a-lieu-client');
        const ctrl = await newController(P, null, { label: 'cvf2a-lieu' });
        const pending = await newPartner('cvf2a-lieu-attente');
        await setFiche(pending.partnerId, 'EN_ATTENTE');
        const rejected = await newPartner('cvf2a-lieu-rejete');
        await setFiche(rejected.partnerId, 'REJETE');
        for (const [who, token] of [['sans session', null], ['jeton illisible', 'abc.def.ghi'], ['client', client.accessToken], ['contrôleur', ctrl.accessToken],
            ['fiche EN_ATTENTE', pending.accessToken], ['fiche REJETE', rejected.accessToken]] as const) {
            const r = await search(q, token);
            console.log(`[CVF2A-3] ${who} → ${show(r).slice(0, 200)}`);
            if (r.status < 400 || Array.isArray(r.body.results)) breaches.push(`${who} : ${show(r).slice(0, 160)}`);
        }
        assert.equal(seen.length, before, 'le service a été appelé pour un compte refusé');
        const ok = await search(q, P.accessToken);
        console.log(`[CVF2A-3] organisatrice VALIDE → ${show(ok).slice(0, 200)}`);
        assert.equal(ok.status, 200, `précondition : organisatrice à la fiche VALIDE (${show(ok)})`);
        await setFiche(pending.partnerId, 'VALIDE');
        await setFiche(rejected.partnerId, 'VALIDE');
        assert.deepEqual(breaches, [], `recherche ouverte à un compte qui ne devrait pas :\n${breaches.join('\n')}`);
    });
});

describe('b. quota et cadence', () => {
    test('12 recherches en parallèle au quota de 5 : 5 au plus servies', async () => {
        const Q = await newPartner('cvf2a-lieu-quota');
        process.env.PLACE_SEARCHES_PER_ACCOUNT_HOUR = '5';
        resetServerEnvCache();
        try {
            const q = uniq('Stade Demba Diop');
            const replies = await Promise.all(Array.from({ length: 12 }, () => search(q, Q.accessToken)));
            const served = replies.filter((r) => r.status !== 429);
            const limited = replies.filter((r) => r.status === 429);
            console.log(`[CVF2A-3] 12 en parallèle (quota 5) : ${served.length} servies (${served.map((r) => r.status).join(',')}), ${limited.length} refusées 429`);
            console.log(`[CVF2A-3] exemple de refus : ${limited[0] ? show(limited[0]).slice(0, 200) : 'aucun'}`);
            assert.ok(served.length <= 5, `quota dépassé en parallèle : ${served.length} recherches servies pour un quota de 5`);
            assert.equal(limited.length, 12 - served.length);
        } finally {
            process.env.PLACE_SEARCHES_PER_ACCOUNT_HOUR = '1000';
            resetServerEnvCache();
        }
    });

    test('3 comptes × 6 recherches distinctes en parallèle : jamais plus d’une requête par seconde vers le service', async () => {
        const accounts = [await newPartner('cvf2a-lieu-c1'), await newPartner('cvf2a-lieu-c2'), await newPartner('cvf2a-lieu-c3')];
        const from = seen.length;
        const replies = await Promise.all(accounts.flatMap((a, i) => Array.from({ length: 6 }, (_, j) => search(uniq(`Lieu ${i}-${j}`), a.accessToken))));
        const calls = seen.slice(from).map((c) => c.at).sort((x, y) => x - y);
        const gaps = calls.slice(1).map((t, i) => t - calls[i]);
        const byStatus = replies.reduce<Record<number, number>>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
        console.log(`[CVF2A-3] 18 recherches de 3 comptes : réponses ${JSON.stringify(byStatus)} ; ${calls.length} appels au service ; écarts ${gaps.join(', ')} ms`);
        const fast = gaps.filter((g) => g < 950);
        assert.deepEqual(fast, [], `plus d'une requête par seconde vers le service : écarts ${gaps.join(', ')} ms`);
        assert.ok(replies.every((r) => r.status !== 500), `erreur 500 : ${replies.filter((r) => r.status === 500).map(show).join(' ; ')}`);
    });
});

describe('c. requêtes trop longues ou spéciales', () => {
    test('121 caractères, injection de paramètres, caractère nul, retours à la ligne, caractères combinants : jamais de 500, paramètres du service intacts', async () => {
        const breaches: string[] = [];
        const tooLong = await search('a'.repeat(121), P.accessToken);
        console.log(`[CVF2A-3] 121 caractères → ${show(tooLong).slice(0, 160)}`);
        if (tooLong.status !== 400) breaches.push(`121 caractères : ${show(tooLong).slice(0, 160)}`);
        const padded = await api('GET', 'partner/places/search', { token: P.accessToken, path: `/api/partner/places/search?q=${'%20'.repeat(500)}x` });
        console.log(`[CVF2A-3] 500 espaces puis « x » → ${show(padded).slice(0, 160)}`);
        if (padded.status !== 400) breaches.push(`500 espaces puis une lettre : ${show(padded).slice(0, 160)}`);
        const twice = await api('GET', 'partner/places/search', { token: P.accessToken, path: `/api/partner/places/search?q=ab&q=${encodeURIComponent(uniq('Dakar'))}` });
        console.log(`[CVF2A-3] q répété (ab puis long) → ${show(twice).slice(0, 160)}`);
        const specials: Array<[string, string]> = [
            ['injection de paramètres', `${uniq('Dakar')}&countrycodes=fr&limit=50&format=xml&email=x@y.z`],
            ['caractère nul', `${uniq('Dak')}\u0000ar`],
            ['retours à la ligne', `${uniq('Ngor')}\r\nX-Injecte: oui`],
            ['caractères combinants', `á́́${uniq('')}`],
            ['joker SQL', `%_%${uniq('')}`],
            ['120 caractères multioctets', 'é'.repeat(120)],
        ];
        for (const [label, q] of specials) {
            const from = seen.length;
            const r = await search(q, P.accessToken);
            const call = seen[from];
            console.log(`[CVF2A-3] ${label} → ${show(r).slice(0, 200)} ; service : ${call ? call.raw.slice(0, 200) : 'non appelé'}`);
            if (r.status === 500) breaches.push(`${label} : erreur 500`);
            if (call) {
                if (call.query.getAll('countrycodes').join(',') !== 'sn') breaches.push(`${label} : countrycodes=${call.query.getAll('countrycodes').join(',')}`);
                if (call.query.getAll('limit').join(',') !== '5') breaches.push(`${label} : limit=${call.query.getAll('limit').join(',')}`);
                if (call.query.getAll('format').join(',') !== 'jsonv2') breaches.push(`${label} : format=${call.query.getAll('format').join(',')}`);
                if (call.query.has('email')) breaches.push(`${label} : paramètre email transmis au service`);
            }
            const results = Array.isArray(r.body.results) ? (r.body.results as Array<{ latitude: number; longitude: number; label: string }>) : [];
            for (const x of results) {
                if (!(x.latitude >= 12.2 && x.latitude <= 16.8 && x.longitude >= -17.6 && x.longitude <= -11.3)) breaches.push(`${label} : résultat hors du Sénégal ${JSON.stringify(x)}`);
                if (x.label.length > 200) breaches.push(`${label} : libellé de ${x.label.length} caractères`);
            }
            if (results.length > 5) breaches.push(`${label} : ${results.length} résultats`);
        }
        assert.deepEqual(breaches, [], breaches.join('\n'));
    });
});

describe('d. cache partagé et tables de la recherche', () => {
    test('deux comptes, même recherche : réponses identiques, sans rien du premier compte', async () => {
        const A = await newPartner('cvf2a-lieu-cache-a');
        const B = await newPartner('cvf2a-lieu-cache-b');
        const q = uniq(`Chez ${A.firstName} ${A.lastName} ${A.phone9}`);
        const ra = await search(q, A.accessToken);
        const rb = await search(q.toUpperCase(), B.accessToken);
        console.log(`[CVF2A-3] A → ${show(ra).slice(0, 220)}`);
        console.log(`[CVF2A-3] B (même recherche, en capitales) → ${show(rb).slice(0, 220)}`);
        assert.equal(ra.status, 200, show(ra));
        assert.equal(rb.status, 200, show(rb));
        const textB = JSON.stringify(rb.body);
        const leaked = [A.userId, A.partnerId, A.email, A.phoneE164].filter((v) => textB.includes(v));
        assert.deepEqual(leaked, [], `données du compte A dans la réponse de B : ${leaked.join(', ')}`);
        assert.deepEqual(Object.keys(rb.body).sort(), ['attribution', 'results'], `champs de la réponse : ${Object.keys(rb.body).join(', ')}`);
        for (const x of rb.body.results as Array<Record<string, unknown>>) {
            assert.deepEqual(Object.keys(x).sort(), ['label', 'latitude', 'longitude'], `champs d'un résultat : ${Object.keys(x).join(', ')}`);
        }
        assert.deepEqual(rb.body, ra.body, 'réponses différentes pour la même recherche (le cache ne dit rien de plus)');
    });

    test('place_search_cache, place_search_throttle, place_search_slot : inaccessibles par la REST', async () => {
        const breaches: string[] = [];
        for (const [who, client] of [['partenaire', userClient(P.accessToken)], ['sans jeton', anonClient()]] as const) {
            for (const table of ['place_search_cache', 'place_search_throttle']) {
                const { rows, error } = await restRows(client, table);
                console.log(`[CVF2A-3] REST ${who} : ${table} → ${error ? `refus ${error}` : `${rows.length} ligne(s)`}`);
                if (rows.length > 0) breaches.push(`${who} lit ${table} (${rows.length} lignes)`);
                const ins = await client.from(table).insert(table === 'place_search_cache' ? { query_key: 'empoisonne', results: [{ label: 'Piège', latitude: 14.7, longitude: -17.4 }] } : { id: 1, next_at: new Date(Date.now() + 3600_000).toISOString() }).select();
                console.log(`[CVF2A-3] REST ${who} : écriture ${table} → ${ins.error ? `refus ${ins.error.message}` : JSON.stringify(ins.data)}`);
                if (!ins.error) breaches.push(`${who} écrit dans ${table}`);
            }
            const slot = await restRpc(client, 'place_search_slot', { p_max_wait_ms: 0 });
            console.log(`[CVF2A-3] REST ${who} : place_search_slot → ${slot.ok ? JSON.stringify(slot.data) : `refus ${slot.error}`}`);
            if (slot.ok) breaches.push(`${who} réserve un créneau d'appel (place_search_slot)`);
        }
        assert.deepEqual(breaches, [], breaches.join('\n'));
    });
});

describe('e. aucune adresse ni contact du service dans les réponses', () => {
    test('réponses 200, 400, 429 et 503 : ni adresse, ni contact, ni identification du service', async () => {
        const replies: Array<[string, Reply]> = [];
        replies.push(['200', await search(uniq('Place de l’Obélisque'), P.accessToken)]);
        replies.push(['400 trop courte', await search('ab', P.accessToken)]);
        replies.push(['503 service en panne', await search(uniq('salle en panne'), P.accessToken)]);
        process.env.NOMINATIM_URL = 'http://127.0.0.1:9';
        resetServerEnvCache();
        try {
            replies.push(['503 service injoignable', await search(uniq('Stade Léopold Sédar Senghor'), P.accessToken)]);
        } finally {
            process.env.NOMINATIM_URL = fakeUrl;
            resetServerEnvCache();
        }
        const Q = await newPartner('cvf2a-lieu-429');
        process.env.PLACE_SEARCHES_PER_ACCOUNT_HOUR = '1';
        resetServerEnvCache();
        try {
            await search(uniq('Dakar'), Q.accessToken);
            replies.push(['429', await search(uniq('Dakar'), Q.accessToken)]);
        } finally {
            process.env.PLACE_SEARCHES_PER_ACCOUNT_HOUR = '1000';
            resetServerEnvCache();
        }
        const breaches: string[] = [];
        for (const [label, r] of replies) {
            const found = serviceLeaks(r);
            console.log(`[CVF2A-3] ${label} → ${show(r).slice(0, 220)}${found.length ? ` ; FUITE : ${found.join(', ')}` : ''}`);
            if (found.length > 0) breaches.push(`${label} : ${found.join(', ')}`);
        }
        assert.deepEqual(replies.map(([l, r]) => [l, r.status]), [['200', 200], ['400 trop courte', 400], ['503 service en panne', 503], ['503 service injoignable', 503], ['429', 429]], 'précondition : statuts attendus');
        assert.deepEqual(breaches, [], `adresse ou contact du service dans une réponse :\n${breaches.join('\n')}`);
    });
});
