/**
 * Correctifs de la contre-vérification de la finition 2a, R1 — recherche de lieu.
 *  a. Caractère nul et caractères de contrôle retirés de la recherche (le service ne reçoit jamais %00 ni un caractère de
 *     contrôle ; tabulation et retour à la ligne deviennent des espaces ; caractères invisibles de mise en forme retirés).
 *  b. Une recherche « indisponible » (503) ne compte pas dans le quota : au quota de 1, une recherche indisponible puis
 *     une recherche servie (200, et non 429) ; témoin : la suivante est refusée (429).
 * Rouge avant le correctif : %00 envoyé au service ; la recherche indisponible consommait l'unité (429). Sortie brute
 * `[F2ACV-R1]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { newPartner, type TestPartner } from './finance-helpers';
import { resetServerEnvCache } from '../../lib/env';
import { normalizePlaceQuery } from '../../lib/places/place-search';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { api, show, type Reply } from '../audit/cvf1-helpers';

const received: string[] = [];
let fake: http.Server;
let fakeUrl: string;
let P: TestPartner;
const saved: Record<string, string | undefined> = {};

before(async () => {
    fake = http.createServer((req, res) => {
        received.push(req.url ?? '');
        const q = new URL(req.url ?? '/', 'http://fake').searchParams.get('q') ?? '';
        res.writeHead(200, { 'content-type': 'application/json' })
            .end(JSON.stringify([{ place_id: 1, lat: '14.7000', lon: '-17.4500', display_name: `${q.slice(0, 60)}, Dakar, Sénégal` }]));
    });
    await new Promise<void>((resolve) => fake.listen(0, '127.0.0.1', resolve));
    fakeUrl = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;
    for (const k of ['NOMINATIM_URL', 'PLACE_SEARCHES_PER_ACCOUNT_HOUR']) saved[k] = process.env[k];
    process.env.NOMINATIM_URL = fakeUrl;
    process.env.PLACE_SEARCHES_PER_ACCOUNT_HOUR = '1000';
    resetServerEnvCache();
    P = await newPartner('f2acv-recherche');
});

after(async () => {
    for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
    resetServerEnvCache();
    await new Promise<void>((resolve) => fake.close(() => resolve()));
    await assertFinition1Invariants('f2acv-recherche');
});

function search(q: string, token: string): Promise<Reply> {
    return api('GET', 'partner/places/search', { token, path: `/api/partner/places/search?q=${encodeURIComponent(q)}` });
}

describe('a. caractère nul et caractères de contrôle retirés', () => {
    test('normalizePlaceQuery : nul et contrôles retirés, tabulation et retours à la ligne en espaces, invisibles retirés', () => {
        assert.equal(normalizePlaceQuery('Sta\u0000de\u0007 Demba\tDiop\r\nDakar'), 'Stade Demba Diop Dakar');
        assert.equal(normalizePlaceQuery('Place​ de‮ l’Obélisque﻿'), 'Place de l’Obélisque');
        assert.equal(normalizePlaceQuery('\u0000\u0001\u001f\u007f\u0085'), '');
        assert.equal(normalizePlaceQuery('Thiès, Sénégal'), 'Thiès, Sénégal', 'lettres accentuées gardées');
    });

    test('route : le service ne reçoit ni %00 ni caractère de contrôle', async () => {
        const tag = randomUUID().slice(0, 8);
        const from = received.length;
        const r = await search(`Stade\u0000 Demba\u0007 Diop ${tag}`, P.accessToken);
        const calls = received.slice(from);
        console.log(`[F2ACV-R1] recherche avec un nul → ${show(r).slice(0, 160)} ; reçu par le service : ${calls.join(' | ')}`);
        assert.equal(r.status, 200, show(r));
        assert.ok(calls.length >= 1, 'service non appelé');
        assert.ok(calls.every((u) => !/%00|%0[1-8]|%1[0-9a-f]|%7f/i.test(u)), `caractère de contrôle envoyé au service : ${calls.join(' | ')}`);
        assert.ok(calls.some((u) => new URL(u, 'http://fake').searchParams.get('q') === `Stade Demba Diop ${tag}`), calls.join(' | '));
    });
});

describe('b. recherche indisponible : hors du quota', () => {
    test('quota de 1 : indisponible (503), puis servie (200) ; la suivante : 429', async () => {
        const Q = await newPartner('f2acv-recherche-quota');
        process.env.PLACE_SEARCHES_PER_ACCOUNT_HOUR = '1';
        resetServerEnvCache();
        try {
            process.env.NOMINATIM_URL = 'http://127.0.0.1:9';
            resetServerEnvCache();
            const down = await search(`Lieu introuvable ${randomUUID().slice(0, 8)}`, Q.accessToken);
            process.env.NOMINATIM_URL = fakeUrl;
            resetServerEnvCache();
            const served = await search(`Grand Théâtre ${randomUUID().slice(0, 8)}`, Q.accessToken);
            const limited = await search(`Monument ${randomUUID().slice(0, 8)}`, Q.accessToken);
            console.log(`[F2ACV-R1] quota 1 : indisponible → ${down.status} ; puis → ${served.status} ; puis → ${limited.status}`);
            assert.deepEqual([down.status, served.status, limited.status], [503, 200, 429],
                `${show(down).slice(0, 120)} | ${show(served).slice(0, 120)} | ${show(limited).slice(0, 120)}`);
        } finally {
            process.env.NOMINATIM_URL = fakeUrl;
            process.env.PLACE_SEARCHES_PER_ACCOUNT_HOUR = '1000';
            resetServerEnvCache();
        }
    });
});
