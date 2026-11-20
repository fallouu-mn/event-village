/**
 * Design 1d (point 9) — recherche instantanée (GET /api/events/search), AVEC la base locale.
 *  1. Seuls les événements publiés et à venir sortent : un brouillon, un événement en attente, validé, suspendu ou annulé
 *     qui porte le même mot n'apparaît jamais ;
 *  2. 8 résultats au plus, total juste ; moins de 2 caractères : aucun résultat ; réponse publique sans donnée
 *     personnelle (champs de la carte seulement) ;
 *  3. saisie piégée (caractères de contrôle, 500 caractères, jokers) : jamais d'erreur, jamais plus de 60 caractères.
 * Rouge avant le design 1d : route absente. Sortie brute `[D1D-RECHERCHE]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { BASE_URL } from './helpers';
import { importModule } from './paiement-helpers';
import { createEventInStatus, type EventStatus } from './cycle-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { assertTerrainInvariants } from './terrain-helpers';

type Row = Record<string, unknown>;
let partner: TestPartner;
/** Mot unique à ce passage (aucun autre événement ne le porte). */
const WORD = `Zeribo${randomBytes(3).toString('hex')}`;
const published: string[] = [];
const hidden: string[] = [];

before(async () => {
    partner = await newPartner('d1d-recherche');
    for (let i = 0; i < 10; i++) {
        const ev = await createEventInStatus(partner, `d1d-rech-${i}`, [{ name: 'Standard', price: 2000, total: 5 }], 'PUBLIE', { startsInHours: 72 + i, title: `${WORD} soirée ${i}` });
        published.push(ev.eventId);
    }
    for (const status of ['BROUILLON', 'EN_ATTENTE', 'VALIDE', 'SUSPENDU', 'ANNULE'] as EventStatus[]) {
        const ev = await createEventInStatus(partner, `d1d-rech-${status}`, [{ name: 'Standard', price: 2000, total: 5 }], status, { startsInHours: 72, title: `${WORD} caché ${status}` });
        hidden.push(ev.eventId);
    }
});

after(async () => {
    await assertTerrainInvariants('design1d-recherche');
});

async function search(q: string): Promise<{ status: number; body: Row; cache: string }> {
    const mod = await importModule('../../app/api/events/search/route');
    const res: Response = await mod.GET(new NextRequest(`${BASE_URL}/api/events/search?q=${encodeURIComponent(q)}`));
    return { status: res.status, body: await res.json() as Row, cache: res.headers.get('cache-control') ?? '' };
}

describe('recherche instantanée', () => {
    test('1-2. publiés seulement, 8 au plus, total juste, champs de la carte', async () => {
        const r = await search(WORD.toUpperCase());
        const results = r.body.results as Row[];
        console.log(`[D1D-RECHERCHE] ${WORD} : ${r.status} total ${r.body.total} ; ${results.map((x) => x.title).join(' | ')} ; ${r.cache}`);
        assert.equal(r.status, 200);
        assert.equal(r.body.total, 10);
        assert.equal(results.length, 8);
        for (const x of results) {
            assert.ok(published.includes(String(x.id)), `résultat inattendu ${x.id} ${x.title}`);
            assert.ok(!hidden.includes(String(x.id)), `événement non publié servi : ${x.title}`);
            assert.deepEqual(Object.keys(x).sort(), ['id', 'imageUrl', 'place', 'posterColor', 'price', 'title', 'when']);
        }
        assert.match(r.cache, /public, max-age=30/);
        const caught = await search(`${WORD} caché`);
        assert.deepEqual([caught.body.total, caught.body.results], [0, []], 'mot des événements cachés');
    });

    test('2. moins de 2 caractères : aucun résultat', async () => {
        const r = await search('z');
        assert.deepEqual([r.status, r.body.total, r.body.results], [200, 0, []]);
    });

    test('3. saisie piégée : jamais d’erreur, 60 caractères au plus', async () => {
        for (const q of ['\u0000\u0007%_*', '%'.repeat(500), `${WORD}\n\r\t`, "' OR 1=1 --", '../../etc/passwd']) {
            const r = await search(q);
            console.log(`[D1D-RECHERCHE] 3. ${JSON.stringify(q.slice(0, 20))} : ${r.status} q=${JSON.stringify(r.body.q)} total ${r.body.total}`);
            assert.equal(r.status, 200);
            assert.ok(String(r.body.q).length <= 60);
        }
        assert.equal((await search(`${WORD}\n\r\t`)).body.total, 10, 'retours à la ligne retirés');
    });
});
