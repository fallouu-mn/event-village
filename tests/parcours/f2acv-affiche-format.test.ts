/**
 * Correctifs de la contre-vérification de la finition 2a, T5 — seuls les fichiers produits par la route de dépôt
 * (horodatage_8 caractères.webp) sont acceptés comme affiche ; les affiches d'avant la finition encore citées sont
 * réencodées une fois par scripts/reencode-posters.ts (fonction reencodeLegacyPosters).
 *  a. Route : fichier brut d'avant la finition, dans le dossier de la partenaire, enregistré comme affiche : 400
 *     IMAGE_ORIGIN_INVALID ; fichier déposé par la route : accepté (témoin).
 *  b. Base : event_update et event_create avec un fichier au nom libre : IMAGE_ORIGIN_INVALID ; nom de la route : accepté.
 *  c. Tâche : à blanc, la liste sans rien écrire ; pour de bon, même dossier, nom de la route, WebP sans métadonnée,
 *     adresse des deux événements qui la citent mise à jour, ancien fichier effacé, journal, aucune alerte « affiche » aux
 *     admins ; un fichier absent est signalé et laissé ; une adresse externe n'est pas touchée ; rejouée : plus rien.
 * Rouge avant le correctif : fichier brut accepté (route et base) ; fonction et script absents. Sortie brute `[F2ACV-T5]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { service, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { createTimedEvent } from './acces-helpers';
import { createDraftEvent } from './cycle-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { FREE, show, type Row } from '../audit/cvf1-helpers';
import { putEvent, putObject, stored, uniqueName, uploadImage, versionOf } from '../audit/cvf2a-helpers';

let A: TestPartner;

/** JPEG avec un bloc EXIF de position GPS (comme une photo de téléphone). */
async function rawJpegWithGps(): Promise<Buffer> {
    return sharp({ create: { width: 320, height: 200, channels: 3, background: { r: 200, g: 120, b: 40 } } })
        .withExif({ IFD0: { Make: 'Telephone', Model: 'Photo' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '14/1 41/1 34/1', GPSLongitudeRef: 'W', GPSLongitude: '17/1 26/1 48/1' } })
        .jpeg().toBuffer();
}

async function imageOf(eventId: string): Promise<string | null> {
    const { data, error } = await service.from('events').select('image_url').eq('id', eventId).single();
    assert.equal(error, null, error?.message);
    return (data?.image_url as string | null) ?? null;
}

before(async () => {
    A = await newPartner('f2acv-affiche');
});

after(async () => {
    await assertFinition1Invariants('f2acv-affiche-format');
});

describe('a, b. affiche : fichier de la route de dépôt seulement', () => {
    test('route : fichier brut d’avant la finition refusé (IMAGE_ORIGIN_INVALID) ; fichier déposé par la route accepté', async () => {
        const legacyUrl = await putObject(`events/${A.partnerId}/${Date.now()}_avant.jpg`, await rawJpegWithGps(), 'image/jpeg');
        const d = await createDraftEvent(A, 'f2acv-affiche-route', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 72, imageUrl: null });
        const refused = await putEvent(A.accessToken, d.eventId, { image_url: legacyUrl });
        console.log(`[F2ACV-T5] PUT affiche d'avant la finition → ${show(refused).slice(0, 220)}`);
        assert.equal(refused.status, 400, show(refused));
        assert.equal(JSON.stringify(refused.body).includes('IMAGE_ORIGIN_INVALID'), true, show(refused));
        assert.equal(await imageOf(d.eventId), null, 'affiche enregistrée');
        const up = await uploadImage(A.accessToken, await rawJpegWithGps(), 'photo.jpg', 'image/jpeg');
        assert.equal(up.status, 200, show(up));
        const ok = await putEvent(A.accessToken, d.eventId, { image_url: up.url });
        assert.equal(ok.status, 200, `témoin : fichier déposé par la route (${show(ok)})`);
    });

    test('base : event_update et event_create, nom libre refusé, nom de la route accepté', async () => {
        const base = String(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, '');
        const folder = `${base}/storage/v1/object/public/public-images/events/${A.partnerId}`;
        const d = await createDraftEvent(A, 'f2acv-affiche-base', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 72, imageUrl: null });
        const upd = async (url: string) => (await service.rpc('event_update', {
            p: { event_id: d.eventId, actor_id: A.userId, patch: { image_url: url }, expected_updated_at: await versionOf(d.eventId) },
        })).data as Row;
        const legacy = await upd(`${folder}/affiche-ancienne.jpg`);
        console.log(`[F2ACV-T5] event_update nom libre → ${JSON.stringify(legacy).slice(0, 200)}`);
        assert.equal(legacy.ok, false, JSON.stringify(legacy));
        assert.equal(legacy.code, 'IMAGE_ORIGIN_INVALID', JSON.stringify(legacy));
        const fake = await upd(`${folder}/${Date.now()}_avant.webp`);
        assert.equal(fake.code, 'IMAGE_ORIGIN_INVALID', `nom presque de la route : ${JSON.stringify(fake)}`);
        const good = await upd(`${folder}/${uniqueName('webp')}`);
        assert.equal(good.ok, true, `témoin : nom de la route (${JSON.stringify(good)})`);
        const day = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
        const created = (await service.rpc('event_create', {
            p: { actor_id: A.userId, event: { title: 'Affiche au nom libre', category: 'CONCERT', start_date: day, start_time: '20:00:00', location: 'Salle de test', city: 'Dakar', latitude: 14.6928, longitude: -17.4467, image_url: `${folder}/affiche.png` } },
        })).data as Row;
        console.log(`[F2ACV-T5] event_create nom libre → ${JSON.stringify(created).slice(0, 200)}`);
        assert.equal(created.code, 'IMAGE_ORIGIN_INVALID', JSON.stringify(created));
    });
});

describe('c. affiches d’avant la finition : réencodées une fois (scripts/reencode-posters.ts)', () => {
    test('à blanc, pour de bon, rejouée', async () => {
        // Chemin en variable : avant le correctif, le module n'existe pas (preuve des rouges sans erreur de typage)
        const modulePath = '../../lib/events/poster-reencode';
        const { reencodeLegacyPosters } = (await import(modulePath)) as {
            reencodeLegacyPosters: (o: { apply?: boolean; onlyEventIds?: string[]; limit?: number }) => Promise<{
                apply: boolean; candidates: number; planned: Array<{ path: string; events: string[] }>;
                done: Array<{ from: string; to: string; events: string[]; oldRemoved: boolean }>;
                skipped: Array<{ path: string; events: string[]; reason: string }>; remaining: number;
            }>;
        };
        const oldPath = `events/${A.partnerId}/${Date.now()}_avant.jpg`;
        const oldUrl = await putObject(oldPath, await rawJpegWithGps(), 'image/jpeg');
        const missingUrl = service.storage.from('public-images').getPublicUrl(`events/${A.partnerId}/${Date.now()}_manquante.jpg`).data.publicUrl;
        const evs: SaleEvent[] = [];
        for (const label of ['un', 'deux', 'manquante', 'externe']) {
            evs.push(await createTimedEvent(A.partnerId, `f2acv-reencode-${label}`, [{ name: FREE, price: 0, total: 10 }], { startsInHours: 48, status: 'PUBLIE' }));
        }
        const set = async (i: number, url: string) => {
            const { error } = await service.from('events').update({ image_url: url }).eq('id', evs[i].eventId);
            assert.equal(error, null, `affiche (montage) : ${error?.message}`);
        };
        await set(0, oldUrl);
        await set(1, oldUrl);
        await set(2, missingUrl);
        await set(3, 'https://exemple.invalid/affiche.jpg');
        const ids = evs.map((e) => e.eventId);
        const alertsBefore = (await service.from('notification_outbox').select('id', { count: 'exact', head: true })
            .in('event_id', ids).eq('type', 'ADMIN_EVENT_CHANGED')).count ?? 0;

        const dry = await reencodeLegacyPosters({ onlyEventIds: ids });
        console.log(`[F2ACV-T5] à blanc → ${JSON.stringify(dry)}`);
        assert.equal(dry.apply, false);
        assert.deepEqual(dry.planned.map((p) => [p.path, p.events]), [[oldPath, [ids[0], ids[1]].sort()]]);
        assert.deepEqual(dry.skipped.map((s) => s.reason), ['fichier absent du stockage']);
        assert.equal(await imageOf(ids[0]), oldUrl, 'à blanc : adresse changée');
        assert.ok(await stored(oldPath), 'à blanc : ancien fichier effacé');

        const run = await reencodeLegacyPosters({ onlyEventIds: ids, apply: true });
        console.log(`[F2ACV-T5] pour de bon → ${JSON.stringify(run)}`);
        assert.equal(run.done.length, 1, JSON.stringify(run));
        const done = run.done[0];
        assert.equal(done.from, oldPath);
        assert.match(done.to, new RegExp(`^events/${A.partnerId}/\\d{13}_[0-9a-f]{8}\\.webp$`), 'même dossier, nom de la route');
        assert.deepEqual(done.events, [ids[0], ids[1]].sort());
        assert.equal(done.oldRemoved, true, 'ancien fichier gardé alors que plus personne ne le cite');
        const newUrl = service.storage.from('public-images').getPublicUrl(done.to).data.publicUrl;
        assert.deepEqual([await imageOf(ids[0]), await imageOf(ids[1])], [newUrl, newUrl], 'adresse mise à jour');
        assert.equal(await imageOf(ids[2]), missingUrl, 'fichier absent : adresse inchangée');
        assert.equal(await imageOf(ids[3]), 'https://exemple.invalid/affiche.jpg', 'adresse externe touchée');
        assert.equal(await stored(oldPath), null, 'ancien fichier (brut, GPS) encore servi');
        const meta = await sharp((await stored(done.to))!).metadata();
        console.log(`[F2ACV-T5] fichier réencodé : ${meta.format} ${meta.width}x${meta.height} exif=${Boolean(meta.exif)} icc=${Boolean(meta.icc)} xmp=${Boolean(meta.xmp)}`);
        assert.deepEqual([meta.format, Boolean(meta.exif), Boolean(meta.icc), Boolean(meta.xmp)], ['webp', false, false, false]);
        const { data: logs } = await service.from('audit_logs').select('object_id').eq('action', 'EVENT_POSTER_REENCODED').in('object_id', ids);
        assert.deepEqual((logs ?? []).map((l) => String(l.object_id)).sort(), [ids[0], ids[1]].sort(), 'journal du réencodage');
        const alertsAfter = (await service.from('notification_outbox').select('id', { count: 'exact', head: true })
            .in('event_id', ids).eq('type', 'ADMIN_EVENT_CHANGED')).count ?? 0;
        assert.equal(alertsAfter, alertsBefore, 'alerte « affiche » envoyée aux admins pour un réencodage');

        const again = await reencodeLegacyPosters({ onlyEventIds: ids, apply: true });
        console.log(`[F2ACV-T5] rejouée → ${JSON.stringify(again)}`);
        assert.deepEqual([again.done.length, again.planned.length, again.skipped.map((s) => s.reason)], [0, 0, ['fichier absent du stockage']]);
    });
});
