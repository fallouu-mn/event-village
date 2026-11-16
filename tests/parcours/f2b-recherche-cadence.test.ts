/**
 * Finition 2b (ajout, point 1) — recherche de lieu : le limiteur espace les APPELS au service d'au moins une seconde, pas
 * seulement les réservations de créneau. Cas du run complet 252 (finition 3a, tests/audit/cvf2a-3-recherche rouge : 801 ms
 * entre deux appels) : un appel dont la réponse de réservation revient en retard (charge du serveur) partait tard, trop
 * près de l'appel suivant.
 * Service simulé (serveur local) : heure d'arrivée de chaque appel. Réponse de la réservation retardée par l'enveloppe du
 * fetch global (le client de service appelle le fetch global à chaque requête, lib/supabase/no-store-fetch.ts).
 *  a. Réservation qui revient 450 ms en retard, une seconde recherche lancée 60 ms après : les deux recherches aboutissent,
 *     les deux appels au service sont séparés d'au moins 1 000 ms (avant : environ 650 ms).
 *  b. Six recherches distinctes en parallèle, l'une avec une réservation en retard : jamais deux appels à moins de
 *     1 000 ms ; jamais d'erreur autre que « indisponible ».
 * Rouge avant le correctif : a (≈ 650 ms) et b. Sortie brute `[F2B-LIEU]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { service } from './paiement-helpers';
import { resetServerEnvCache } from '../../lib/env';
import { PlaceSearchUnavailable, searchPlaces } from '../../lib/places/place-search';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';

const arrivals: number[] = [];
let fake: http.Server;
const saved: Record<string, string | undefined> = {};
const realFetch = globalThis.fetch;
/** Nombre de réponses de réservation (place_search_slot) encore à retarder. */
let lateSlots = 0;
const LATE_MS = 450;

before(async () => {
    fake = http.createServer((req, res) => {
        arrivals.push(Date.now());
        const q = new URL(req.url ?? '/', 'http://fake').searchParams.get('q') ?? '';
        res.writeHead(200, { 'content-type': 'application/json' })
            .end(JSON.stringify([{ place_id: 1, lat: '14.7000', lon: '-17.4500', display_name: `${q.slice(0, 60)}, Dakar, Sénégal` }]));
    });
    await new Promise<void>((resolve) => fake.listen(0, '127.0.0.1', resolve));
    for (const k of ['NOMINATIM_URL']) saved[k] = process.env[k];
    process.env.NOMINATIM_URL = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;
    resetServerEnvCache();
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const res = await realFetch(input, init);
        if (url.includes('/rest/v1/rpc/place_search_slot') && lateSlots > 0) {
            lateSlots -= 1;
            await new Promise((resolve) => setTimeout(resolve, LATE_MS));
        }
        return res;
    }) as typeof fetch;
});

after(async () => {
    globalThis.fetch = realFetch;
    for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
    resetServerEnvCache();
    await new Promise<void>((resolve) => fake.close(() => resolve()));
    await assertFinition1Invariants('f2b-recherche-cadence');
});

/** Attend que le prochain créneau commun soit libre (créneaux réservés par une suite ou un test précédent). */
async function throttleIdle(): Promise<void> {
    const { data, error } = await service.from('place_search_throttle').select('next_at').eq('id', 1).maybeSingle();
    assert.equal(error, null, `créneau commun : ${error?.message}`);
    const wait = data ? Date.parse(String(data.next_at)) - Date.now() : 0;
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait + 50));
}

function gapsOf(from: number): number[] {
    const calls = arrivals.slice(from).sort((x, y) => x - y);
    return calls.slice(1).map((t, i) => t - calls[i]);
}

const uniq = (label: string) => `${label} ${randomUUID().slice(0, 8)}`;

describe('a. réservation revenue en retard', () => {
    test('deux recherches : les deux aboutissent, appels séparés d’au moins une seconde', async () => {
        await throttleIdle();
        const from = arrivals.length;
        lateSlots = 1;
        const first = searchPlaces(uniq('Grand Théâtre'));
        await new Promise((resolve) => setTimeout(resolve, 60));
        const second = searchPlaces(uniq('Monument de la Renaissance'));
        const settled = await Promise.allSettled([first, second]);
        const gaps = gapsOf(from);
        console.log(`[F2B-LIEU] réservation en retard de ${LATE_MS} ms : ${settled.map((s) => s.status === 'fulfilled' ? `${s.value.length} résultat(s)` : `refus ${String((s.reason as Error)?.message)}`).join(' ; ')} ; ${arrivals.length - from} appel(s), écarts ${gaps.join(', ')} ms`);
        assert.deepEqual(settled.map((s) => s.status), ['fulfilled', 'fulfilled'], 'les deux recherches aboutissent');
        assert.equal(arrivals.length - from, 2, 'deux appels au service');
        assert.ok(gaps.every((g) => g >= 1_000), `deux appels à moins d'une seconde : écarts ${gaps.join(', ')} ms`);
    });
});

describe('b. six recherches en parallèle, une réservation en retard', () => {
    test('jamais deux appels à moins d’une seconde ; seule erreur admise : indisponible', async () => {
        await throttleIdle();
        const from = arrivals.length;
        lateSlots = 1;
        const settled = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => searchPlaces(uniq(`Lieu ${i}`))));
        const gaps = gapsOf(from);
        const refused = settled.filter((s) => s.status === 'rejected').map((s) => (s as PromiseRejectedResult).reason);
        console.log(`[F2B-LIEU] six en parallèle : ${settled.length - refused.length} servie(s), ${refused.length} indisponible(s) ; ${arrivals.length - from} appel(s), écarts ${gaps.join(', ')} ms`);
        assert.ok(refused.every((e) => e instanceof PlaceSearchUnavailable), `erreur inattendue : ${refused.map(String).join(' ; ')}`);
        assert.ok(arrivals.length - from >= 2, 'au moins deux appels au service');
        assert.ok(gaps.every((g) => g >= 1_000), `deux appels à moins d'une seconde : écarts ${gaps.join(', ')} ms`);
    });
});
