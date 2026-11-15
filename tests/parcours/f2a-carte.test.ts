/**
 * Finition 2a, 3 — carte de l'étape Accès.
 *  a. Recherche de lieu (GET /api/partner/places/search?q=…) : session de la partenaire, quota par compte, cache,
 *     Sénégal seulement, 5 résultats au plus, application et contact identifiés dans la requête, adresse du service et
 *     contact réglables par variables d'environnement, une requête par seconde au plus vers le service, mention
 *     « © contributeurs OpenStreetMap » ; sans réponse du service : « Recherche indisponible pour le moment : touchez la
 *     carte pour placer le repère. ». Service simulé ici (serveur local) : aucun appel réel.
 *  b. Position : latitude et longitude ensemble ou aucune ; bornes du Sénégal (latitude 12,2 à 16,8 ; longitude -17,6
 *     à -11,3) ; obligatoire pour soumettre (pas pour un brouillon), et après validation ; route ET base.
 *  c. Après validation, un repère déplacé de plus de 200 m prévient les détenteurs comme un changement d'adresse ; moins
 *     de 200 m ne prévient personne.
 * Rouge avant le correctif : pas de route de recherche ; position partielle ou hors du Sénégal acceptée, soumission sans
 * position acceptée ; un repère déplacé ne prévenait personne.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { newBuyer, service, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { createTimedEvent } from './acces-helpers';
import { createDraftEvent } from './cycle-helpers';
import { resetServerEnvCache } from '../../lib/env';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { api, freeTicket, show, type Reply, type Row } from '../audit/cvf1-helpers';

const UNAVAILABLE = 'Recherche indisponible pour le moment : touchez la carte pour placer le repère.';
const ATTRIBUTION = '© contributeurs OpenStreetMap';
const CONTACT = 'essai-carte@eventvillage.invalid';
const DAKAR = { latitude: 14.6928, longitude: -17.4467 };

interface FakeRequest { path: string; query: URLSearchParams; userAgent: string; at: number }
const seen: FakeRequest[] = [];
let fake: http.Server;
let fakeUrl: string;
let P: TestPartner;
const saved: Record<string, string | undefined> = {};

function nominatimRows(q: string): unknown[] {
    const inSenegal = Array.from({ length: 6 }, (_, i) => ({
        place_id: 1000 + i, lat: String(14.70 + i * 0.01), lon: String(-17.45 + i * 0.01),
        display_name: `${q} ${i + 1}, Dakar, Sénégal`, category: 'amenity', type: 'venue',
    }));
    return [{ place_id: 9, lat: '48.8566', lon: '2.3522', display_name: `${q}, Paris, France` }, ...inSenegal];
}

before(async () => {
    fake = http.createServer((req, res) => {
        const url = new URL(req.url ?? '/', 'http://fake');
        seen.push({ path: url.pathname, query: url.searchParams, userAgent: String(req.headers['user-agent'] ?? ''), at: Date.now() });
        const q = url.searchParams.get('q') ?? '';
        if (q.includes('panne')) {
            res.writeHead(500).end('erreur');
            return;
        }
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(nominatimRows(q)));
    });
    await new Promise<void>((resolve) => fake.listen(0, '127.0.0.1', resolve));
    fakeUrl = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;
    for (const k of ['NOMINATIM_URL', 'NOMINATIM_CONTACT', 'PLACE_SEARCHES_PER_ACCOUNT_HOUR']) saved[k] = process.env[k];
    process.env.NOMINATIM_URL = fakeUrl;
    process.env.NOMINATIM_CONTACT = CONTACT;
    process.env.PLACE_SEARCHES_PER_ACCOUNT_HOUR = '40';
    resetServerEnvCache();
    P = await newPartner('f2a-carte');
});

after(async () => {
    for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
    resetServerEnvCache();
    await new Promise<void>((resolve) => fake.close(() => resolve()));
    await assertFinition1Invariants('f2a-carte');
});

function search(q: string, token: string | null = P.accessToken): Promise<Reply> {
    return api('GET', 'partner/places/search', { token, path: `/api/partner/places/search?q=${encodeURIComponent(q)}` });
}

describe('3 a. recherche de lieu par le serveur', () => {
    test('Sénégal, 5 résultats au plus, application identifiée, mention OpenStreetMap', async () => {
        const before = seen.length;
        const r = await search('Ngor Club');
        console.log(`[F2A-3] recherche → ${show(r).slice(0, 400)}`);
        assert.equal(r.status, 200, show(r));
        const results = r.body.results as Array<{ label: string; latitude: number; longitude: number }>;
        assert.equal(results.length, 5, `résultats : ${results.length}`);
        for (const x of results) {
            assert.ok(x.latitude >= 12.2 && x.latitude <= 16.8 && x.longitude >= -17.6 && x.longitude <= -11.3, `hors du Sénégal : ${JSON.stringify(x)}`);
            assert.ok(x.label.includes('Ngor Club'), JSON.stringify(x));
        }
        assert.equal(r.body.attribution, ATTRIBUTION);
        assert.equal(seen.length, before + 1, 'un seul appel au service');
        const call = seen[seen.length - 1];
        assert.equal(call.path, '/search');
        assert.equal(call.query.get('q'), 'Ngor Club');
        assert.equal(call.query.get('countrycodes'), 'sn');
        assert.equal(call.query.get('limit'), '5');
        assert.equal(call.query.get('format'), 'jsonv2');
        assert.equal(call.query.get('accept-language'), 'fr');
        assert.ok(/EventVillage/.test(call.userAgent) && call.userAgent.includes(CONTACT), `application non identifiée : ${call.userAgent}`);
    });

    test('cache : la même recherche ne rappelle pas le service ; deux recherches distinctes à une seconde d’écart au moins', async () => {
        const before = seen.length;
        const again = await search('Ngor Club');
        assert.equal(again.status, 200, show(again));
        assert.equal(seen.length, before, 'le service a été rappelé pour une recherche déjà faite');
        const a = await search('Place du Souvenir');
        const b = await search('Monument de la Renaissance');
        assert.equal(a.status, 200, show(a));
        assert.equal(b.status, 200, show(b));
        const [first, second] = seen.slice(-2);
        console.log(`[F2A-3] deux recherches distinctes : ${second.at - first.at} ms d'écart`);
        assert.ok(second.at - first.at >= 950, `moins d'une seconde entre deux appels : ${second.at - first.at} ms`);
    });

    test('service en panne ou injoignable : recherche indisponible, texte exact', async () => {
        const down = await search('salle en panne');
        assert.equal(down.status, 503, show(down));
        assert.equal(down.body.error, UNAVAILABLE, show(down));
        process.env.NOMINATIM_URL = 'http://127.0.0.1:9';
        resetServerEnvCache();
        try {
            const unreachable = await search('Stade Léopold Sédar Senghor');
            assert.equal(unreachable.status, 503, show(unreachable));
            assert.equal(unreachable.body.error, UNAVAILABLE, show(unreachable));
        } finally {
            process.env.NOMINATIM_URL = fakeUrl;
            resetServerEnvCache();
        }
    });

    test('session de la partenaire exigée, recherche trop courte refusée, quota par compte', async () => {
        assert.equal((await search('Dakar', null)).status, 401, 'sans session');
        const client = await newBuyer('f2a-carte-client');
        assert.equal((await search('Dakar', client.accessToken)).status, 403, 'compte client');
        const short = await search('ab');
        assert.equal(short.status, 400, show(short));
        const q2 = await newPartner('f2a-carte-quota');
        process.env.PLACE_SEARCHES_PER_ACCOUNT_HOUR = '3';
        resetServerEnvCache();
        try {
            for (let i = 0; i < 3; i++) assert.equal((await search('Ngor Club', q2.accessToken)).status, 200, `recherche ${i + 1}`);
            const over = await search('Ngor Club', q2.accessToken);
            console.log(`[F2A-3] quota dépassé → ${show(over)}`);
            assert.equal(over.status, 429, show(over));
        } finally {
            process.env.PLACE_SEARCHES_PER_ACCOUNT_HOUR = '40';
            resetServerEnvCache();
        }
    });
});

async function versionOf(eventId: string): Promise<string> {
    const { data, error } = await service.from('events').select('updated_at').eq('id', eventId).single();
    assert.equal(error, null, `version de ${eventId} : ${error?.message}`);
    return String(data!.updated_at);
}

async function put(eventId: string, patch: Row): Promise<Reply> {
    return api('PUT', 'partner/events/[id]', {
        token: P.accessToken, path: `/api/partner/events/${eventId}`, params: { id: eventId },
        body: { patch, expected_updated_at: await versionOf(eventId) },
    });
}

async function transition(eventId: string, to: string): Promise<Reply> {
    return api('POST', 'partner/events/[id]/transition', { token: P.accessToken, path: `/api/partner/events/${eventId}/transition`, params: { id: eventId }, body: { to } });
}

async function rpc(name: string, p: Row): Promise<Row> {
    const { data, error } = await service.rpc(name, { p });
    assert.equal(error, null, `${name} : ${error?.message}`);
    return (data ?? {}) as Row;
}

describe('3 b. position : ensemble, au Sénégal, obligatoire pour soumettre', () => {
    test('route et base : position partielle ou hors du Sénégal refusée ; brouillon sans position accepté', async () => {
        const d = await createDraftEvent(P, 'f2a-carte-pos', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 72 });
        const partial = await put(d.eventId, { latitude: 14.7, longitude: null });
        assert.equal(partial.status, 400, show(partial));
        assert.equal(partial.body.code, 'POSITION_INCOMPLETE', show(partial));
        const paris = await put(d.eventId, { latitude: 48.8566, longitude: 2.3522 });
        assert.equal(paris.status, 400, show(paris));
        assert.equal(paris.body.code, 'POSITION_OUT_OF_BOUNDS', show(paris));
        assert.equal((await put(d.eventId, { latitude: null, longitude: null })).status, 200, 'brouillon sans position');
        const rpcPartial = await rpc('event_update', { event_id: d.eventId, actor_id: P.userId, patch: { latitude: 14.7 }, expected_updated_at: await versionOf(d.eventId) });
        assert.equal(rpcPartial.code, 'POSITION_INCOMPLETE', JSON.stringify(rpcPartial));
        const rpcOut = await rpc('event_update', { event_id: d.eventId, actor_id: P.userId, patch: { latitude: 10.5, longitude: -17.0 }, expected_updated_at: await versionOf(d.eventId) });
        assert.equal(rpcOut.code, 'POSITION_OUT_OF_BOUNDS', JSON.stringify(rpcOut));
        const created = await rpc('event_create', { actor_id: P.userId, event: { title: 'Hors du pays', latitude: 48.85, longitude: 2.35 } });
        assert.equal(created.code, 'POSITION_OUT_OF_BOUNDS', JSON.stringify(created));
    });

    test('soumission sans position refusée (route et base), acceptée une fois le repère placé ; retrait après validation refusé', async () => {
        const d = await createDraftEvent(P, 'f2a-carte-soumission', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 72 });
        const { error } = await service.from('events').update({ latitude: null, longitude: null }).eq('id', d.eventId);
        assert.equal(error, null, error?.message);
        const refused = await transition(d.eventId, 'EN_ATTENTE');
        console.log(`[F2A-3] soumission sans position → ${show(refused)}`);
        assert.ok(refused.status >= 400 && refused.status < 500, show(refused));
        assert.equal(refused.body.code, 'POSITION_REQUIRED', show(refused));
        const rpcRefused = await rpc('event_transition', { event_id: d.eventId, actor_id: P.userId, to_status: 'EN_ATTENTE' });
        assert.equal(rpcRefused.code, 'POSITION_REQUIRED', JSON.stringify(rpcRefused));
        assert.equal((await put(d.eventId, DAKAR)).status, 200, 'repère placé');
        const ok = await transition(d.eventId, 'EN_ATTENTE');
        assert.ok(ok.status < 300, `soumission avec position : ${show(ok)}`);
        const pub = await createTimedEvent(P.partnerId, 'f2a-carte-retrait', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 48 });
        await service.from('events').update(DAKAR).eq('id', pub.eventId);
        const removed = await put(pub.eventId, { latitude: null, longitude: null });
        assert.equal(removed.status, 400, show(removed));
        assert.equal(removed.body.code, 'POSITION_REQUIRED', show(removed));
    });
});

async function changedSms(eventId: string): Promise<number> {
    const { count, error } = await service.from('notification_outbox').select('id', { count: 'exact', head: true })
        .eq('event_id', eventId).eq('type', 'EVENT_CHANGED').eq('channel', 'SMS');
    assert.equal(error, null, error?.message);
    return count ?? 0;
}

describe('3 c. repère déplacé après validation', () => {
    test('moins de 200 m : personne n’est prévenu ; plus de 200 m : les détenteurs, comme un changement d’adresse', async () => {
        const ev: SaleEvent = await createTimedEvent(P.partnerId, 'f2a-carte-lieu', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 48 });
        await service.from('events').update(DAKAR).eq('id', ev.eventId);
        for (const label of ['f2a-carte-d1', 'f2a-carte-d2']) await freeTicket(ev, await newBuyer(label));
        const before = await changedSms(ev.eventId);
        const near = await put(ev.eventId, { latitude: DAKAR.latitude + 0.0009, longitude: DAKAR.longitude });
        console.log(`[F2A-3] repère déplacé d'environ 100 m → ${show(near).slice(0, 200)}`);
        assert.equal(near.status, 200, show(near));
        assert.equal(near.body.notified_holders, 0, show(near));
        assert.equal(await changedSms(ev.eventId), before, 'SMS pour un déplacement de moins de 200 m');
        const far = await put(ev.eventId, { latitude: DAKAR.latitude + 0.0036, longitude: DAKAR.longitude });
        console.log(`[F2A-3] repère déplacé d'environ 300 m → ${show(far).slice(0, 200)}`);
        assert.equal(far.status, 200, show(far));
        assert.equal(far.body.notified_holders, 2, show(far));
        assert.equal(await changedSms(ev.eventId), before + 2, 'un SMS par détenteur pour un déplacement de plus de 200 m');
    });

    // Ajouté après la preuve des rouges du run d5eb6b3b (signalé au rapport) : l'alerte de l'administration (ADMIN_EVENT_CHANGED,
    // changement PLACE) suit la même règle des 200 m ; rouge avant le correctif (le déclencheur ne regardait pas la position).
    test('alerte de l’administration : rien en deçà de 200 m, « lieu » au-delà', async () => {
        const ev: SaleEvent = await createTimedEvent(P.partnerId, 'f2a-carte-admin', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 48 });
        await service.from('events').update(DAKAR).eq('id', ev.eventId);
        const alerts = async (): Promise<Row[]> => {
            const { data, error } = await service.from('notification_outbox').select('template_data')
                .eq('event_id', ev.eventId).eq('type', 'ADMIN_EVENT_CHANGED');
            assert.equal(error, null, error?.message);
            return (data ?? []) as Row[];
        };
        const before = (await alerts()).length;
        assert.equal((await put(ev.eventId, { latitude: DAKAR.latitude + 0.0009, longitude: DAKAR.longitude })).status, 200);
        assert.equal((await alerts()).length, before, 'alerte aux admins pour un déplacement de moins de 200 m');
        assert.equal((await put(ev.eventId, { latitude: DAKAR.latitude + 0.0036, longitude: DAKAR.longitude })).status, 200);
        const after = await alerts();
        console.log(`[F2A-3] alertes admin : ${before} → ${after.length}`);
        assert.ok(after.length > before, 'aucune alerte aux admins pour un déplacement de plus de 200 m');
        assert.ok(after.slice(before).every((a) => JSON.stringify((a.template_data as Row | null)?.changes ?? []).includes('PLACE')), JSON.stringify(after.slice(before)));
    });
});
