/**
 * Design 1d (point 5) — SÉCURITÉ du partage : l'image d'aperçu (GET /api/events/[id]/apercu) n'est générée QUE pour un
 * événement publié. Il n'existe pas d'autre notion d'événement « privé » dans le projet : est privé tout événement non
 * public (brouillon, en attente, validé, terminé sans publication).
 *  1. Brouillon, en attente, validé, suspendu, annulé, terminé, identifiant inconnu ou illisible : 404, AUCUNE image
 *     (corps JSON identique pour tous, rien du titre), réponse jamais gardée en cache (`no-store`).
 *  2. Publié : 200, PNG 1 200 × 630 (signature et dimensions lues dans l'en-tête du fichier), en cache 5 minutes.
 *  3. Le statut est relu sans cache à chaque demande : l'aperçu d'un événement publié puis suspendu (ou annulé) répond
 *     404 aussitôt, même si l'image a été générée juste avant.
 *  4. Métadonnées de la fiche (shareImagesFor) : l'aperçu propre à l'événement seulement s'il est publié ; l'image
 *     générique du site sinon (aucune image propre à l'événement).
 * Rouge avant le design 1d : route et module absents. Sortie brute `[D1D-PARTAGE]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { BASE_URL, routeContext } from './helpers';
import { importModule, service } from './paiement-helpers';
import { advanceEventTo, createEventInStatus, type EventStatus } from './cycle-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { assertTerrainInvariants } from './terrain-helpers';

let partner: TestPartner;
const CATEGORIES = [{ name: 'Standard', price: 5000, total: 10 }];

before(async () => {
    partner = await newPartner('d1d-partage');
});

after(async () => {
    await assertTerrainInvariants('design1d-partage-prive');
});

interface Preview { status: number; type: string; cache: string; bytes: Buffer }

async function preview(id: string): Promise<Preview> {
    const mod = await importModule('../../app/api/events/[id]/apercu/route');
    const res: Response = await mod.GET(new NextRequest(`${BASE_URL}/api/events/${id}/apercu`), routeContext({ id }));
    return {
        status: res.status,
        type: res.headers.get('content-type') ?? '',
        cache: res.headers.get('cache-control') ?? '',
        bytes: Buffer.from(await res.arrayBuffer()),
    };
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngSize(bytes: Buffer): { width: number; height: number } {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function assertNoImage(p: Preview, what: string, title?: string): void {
    assert.equal(p.status, 404, `${what} : statut ${p.status}`);
    assert.ok(!p.type.includes('image'), `${what} : type ${p.type}`);
    assert.ok(!p.bytes.subarray(0, 8).equals(PNG_SIGNATURE), `${what} : une image PNG est servie`);
    assert.match(p.cache, /no-store/, `${what} : réponse gardée en cache (${p.cache})`);
    assert.deepEqual(JSON.parse(p.bytes.toString('utf8')), { error: 'Aperçu indisponible.', code: 'NOT_FOUND' }, `${what} : corps`);
    if (title) assert.ok(!p.bytes.toString('utf8').includes(title), `${what} : le titre sort`);
}

describe('1. aucun aperçu pour un événement non publié', () => {
    for (const status of ['BROUILLON', 'EN_ATTENTE', 'VALIDE', 'SUSPENDU', 'ANNULE'] as EventStatus[]) {
        test(`${status} : 404 sans image`, async () => {
            const ev = await createEventInStatus(partner, `d1d-partage-${status}`, CATEGORIES, status, { startsInHours: 72 });
            const p = await preview(ev.eventId);
            console.log(`[D1D-PARTAGE] 1. ${status} ${ev.eventId} : ${p.status} ${p.type} ${p.cache} ${p.bytes.length} o`);
            assertNoImage(p, status, ev.title);
        });
    }

    test('TERMINE (événement passé de la graine) : 404 sans image', async () => {
        const { data, error } = await service.from('events').select('id, status').eq('slug', 'test-fixture-a-passe').single();
        assert.equal(error, null, error?.message);
        assert.equal(data!.status, 'TERMINE');
        const p = await preview(data!.id);
        console.log(`[D1D-PARTAGE] 1. TERMINE ${data!.id} : ${p.status} ${p.cache}`);
        assertNoImage(p, 'TERMINE');
    });

    test('identifiant inconnu ou illisible : même 404', async () => {
        for (const id of [randomUUID(), 'abc', '../../etc']) {
            const p = await preview(id);
            assertNoImage(p, `identifiant ${id}`);
        }
    });
});

describe('2-3. publié : image ; suspendu ou annulé ensuite : plus d’image aussitôt', () => {
    test('publié → PNG 1 200 × 630 ; suspendu → 404 ; annulé → 404', async () => {
        const ev = await createEventInStatus(partner, 'd1d-partage-publie', CATEGORIES, 'PUBLIE', { startsInHours: 72 });
        const ok = await preview(ev.eventId);
        console.log(`[D1D-PARTAGE] 2. PUBLIE : ${ok.status} ${ok.type} ${ok.cache} ${ok.bytes.length} o`);
        assert.equal(ok.status, 200);
        assert.equal(ok.type, 'image/png');
        assert.ok(ok.bytes.subarray(0, 8).equals(PNG_SIGNATURE), 'signature PNG');
        assert.deepEqual(pngSize(ok.bytes), { width: 1200, height: 630 });
        assert.match(ok.cache, /public, max-age=300/);

        await advanceEventTo(ev.eventId, 'SUSPENDU', { partnerUserId: partner.userId });
        const suspended = await preview(ev.eventId);
        console.log(`[D1D-PARTAGE] 3. SUSPENDU juste après l'image : ${suspended.status} ${suspended.cache}`);
        assertNoImage(suspended, 'suspendu après publication', ev.title);

        // Un événement suspendu ne s'annule pas (event_cancel) : second événement publié, image générée, puis annulé
        const other = await createEventInStatus(partner, 'd1d-partage-annule', CATEGORIES, 'PUBLIE', { startsInHours: 72 });
        assert.equal((await preview(other.eventId)).status, 200, 'publié : image');
        await advanceEventTo(other.eventId, 'ANNULE', { partnerUserId: partner.userId });
        const cancelled = await preview(other.eventId);
        console.log(`[D1D-PARTAGE] 3. ANNULE juste après l'image : ${cancelled.status} ${cancelled.cache}`);
        assertNoImage(cancelled, 'annulé après publication', other.title);
    });
});

describe('4. métadonnées de la fiche', () => {
    test('aperçu propre à l’événement seulement s’il est publié', async () => {
        const { shareImagesFor } = await importModule('../../lib/events/share-preview.server');
        const { buildPublicEventSnapshot } = await importModule('../../lib/events/event-detail.server');
        const published = await createEventInStatus(partner, 'd1d-partage-meta', CATEGORIES, 'PUBLIE', { startsInHours: 72 });
        const sheet = await buildPublicEventSnapshot(published.eventId);
        const images = shareImagesFor(sheet) as Array<{ url: string; width: number; height: number }>;
        console.log(`[D1D-PARTAGE] 4. PUBLIE : ${JSON.stringify(images)}`);
        assert.equal(images.length, 1);
        assert.match(images[0].url, new RegExp(`^/api/events/${published.eventId}/apercu\\?v=[a-z0-9]+$`));
        assert.deepEqual([images[0].width, images[0].height], [1200, 630]);

        for (const status of ['SUSPENDU', 'ANNULE', 'TERMINE'] as const) {
            const other = shareImagesFor({ ...sheet, status }) as Array<{ url: string }>;
            assert.deepEqual(other.map((i) => i.url), ['/images/og-image.png'], `${status} : ${JSON.stringify(other)}`);
        }
    });
});
