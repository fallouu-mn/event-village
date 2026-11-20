/**
 * Design 1c bis (point 3) — erreur d'hydratation React n° 418 de la fiche « en cours » (runs 437 et 441, intermittente).
 *
 * Cas reproduit : la fiche est mise en cache 60 s (unstable_cache + page revalidée), mais la fiche en cache portait
 * l'état de la billetterie calculé à l'heure de sa préparation (vente ouverte ou close, catégorie disponible, achat
 * possible, guichet, remboursement d'un report). Une même fiche préparée avant puis après une fin de vente n'était
 * donc pas la même, et la page en cache ne disait plus l'heure du téléphone. Règle : ce qui dépend de l'heure est
 * calculé dans le navigateur après le chargement, jamais dans la page en cache.
 *
 *  1. la fiche en cache (readPublicSheet, la lecture de la page) lue avant puis après une fin de vente est identique ;
 *  2. la fiche en cache ne porte aucun état qui dépend de l'heure (horloge inconnue : rien d'ouvert, rien de fermé) ;
 *  3. la route de l'API, lue maintenant, garde l'état à l'heure du serveur (contrat inchangé).
 *
 * Rouge avant correctif (1 et 2) : la fiche en cache change à la fin de la vente et dit « achat possible ».
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { BASE_URL } from './helpers';
import { createSaleEvent, importModule } from './paiement-helpers';
import { assertTerrainInvariants } from './terrain-helpers';

type Row = Record<string, unknown>;

after(async () => {
    await assertTerrainInvariants('d1cbis-fiche-heure');
});

async function cachedSheet(eventId: string): Promise<Row> {
    const mod = await importModule('../../lib/events/event-detail.server');
    const read = await mod.readPublicSheet(eventId) as Row;
    assert.equal(read.kind, 'public', `fiche publique attendue : ${JSON.stringify(read).slice(0, 300)}`);
    return read.event as Row;
}

async function apiSheet(eventId: string): Promise<Row> {
    const mod = await importModule('../../app/api/events/[id]/route');
    const params = { id: eventId };
    const res = await mod.GET(new NextRequest(`${BASE_URL}/api/events/${eventId}`), { params: Object.assign(Promise.resolve(params), params) });
    assert.equal(res.status, 200, `route de la fiche : HTTP ${res.status}`);
    return ((await res.json()) as Row).event as Row;
}

function waitUntil(t: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, t - Date.now())));
}

describe('design 1c bis — fiche en cache : rien ne dépend de l’heure (erreur 418)', () => {
    test('1. la fiche en cache lue avant puis après une fin de vente est la même', async () => {
        const saleEnd = Date.now() + 5_000;
        const ev = await createSaleEvent('d1cbis-heure', [{ name: 'Standard', price: 3_000, total: 20, saleEnd: new Date(saleEnd).toISOString() }]);
        const before = await cachedSheet(ev.eventId);
        assert.ok(Date.now() < saleEnd, 'première lecture avant la fin de la vente');
        await waitUntil(saleEnd + 1_000);
        const afterEnd = await cachedSheet(ev.eventId);
        const diff = Object.keys(before).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(afterEnd[k]));
        assert.deepEqual(diff, [], `la fiche en cache dépend de l’heure : champs changés à la fin de la vente ${diff.join(', ')} `
            + `(avant ${JSON.stringify(diff.map((k) => before[k])).slice(0, 300)} ; après ${JSON.stringify(diff.map((k) => afterEnd[k])).slice(0, 300)})`);
    });

    test('2. la fiche en cache ne dit ni « achat possible » ni « vente close » : horloge inconnue', async () => {
        const ev = await createSaleEvent('d1cbis-neutre', [{ name: 'Standard', price: 3_000, total: 20 }]);
        const sheet = await cachedSheet(ev.eventId);
        assert.equal(sheet.clockKnown, false, `horloge de la fiche en cache : ${String(sheet.clockKnown)}`);
        assert.equal(sheet.purchasable, false, 'achat possible figé dans la page en cache');
        assert.equal(sheet.hasAvailableTickets, false, 'disponibilité figée dans la page en cache');
        assert.equal(sheet.salesEnded, false, 'fin de vente figée dans la page en cache');
        assert.equal(sheet.counterSale, false, 'guichet figé dans la page en cache');
        for (const c of sheet.categories as Row[]) {
            assert.deepEqual([c.isAvailable, c.saleOpen, c.saleStarted, c.saleEnded], [false, false, false, false], `catégorie ${String(c.name)} : état de vente figé`);
        }
    });

    test('3. la route de l’API, lue maintenant, garde l’état à l’heure du serveur', async () => {
        const ev = await createSaleEvent('d1cbis-api', [{ name: 'Standard', price: 3_000, total: 20 }]);
        const sheet = await apiSheet(ev.eventId);
        assert.equal(sheet.clockKnown, true, 'la route lit l’heure');
        assert.equal(sheet.purchasable, true, 'vente ouverte à l’heure du serveur');
        assert.equal((sheet.categories as Row[])[0].isAvailable, true);
    });
});
