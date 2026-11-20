/**
 * Design 1d (points 1 et 8) — favoris et couleur des affiches, AVEC la base locale.
 *  1. Favoris (routes /api/favorites, compte de la session) :
 *     a. ajout refusé (404, même corps qu'un identifiant inconnu) pour un brouillon, un événement en attente, validé,
 *        suspendu ou annulé : rien ne laisse deviner un événement non public ;
 *     b. ajout d'un événement publié, liste des identifiants, cartes du catalogue (« Mes favoris ») avec la couleur de
 *        l'affiche ; l'événement suspendu ensuite reste listé (il est encore public) ; retrait ;
 *     c. les favoris d'une personne ne sont jamais lus ni retirés par une autre ;
 *     d. sans session : 401 ; aucun avis créé (le rappel de la veille viendra plus tard).
 *  2. Couleur de l'affiche :
 *     a. dépôt réel (POST /api/partner/upload, image PNG orange) : style enregistré pour le fichier (couleur « #rrggbb »
 *        de contraste ≥ 4,5:1 avec le blanc, image floutée data:image/webp) ;
 *     b. l'événement qui enregistre cette adresse prend la couleur (trigger), la fiche publique la sert, l'image
 *        floutée aussi ; une autre affiche sans style remet la couleur à vide (« bleu nuit » à l'écran) ;
 *     c. script des affiches existantes (à blanc puis appliqué, puis rejoué) : rejouable.
 * Rouge avant le design 1d : routes, colonnes et fonctions absentes. Sortie brute `[D1D-FAVORIS]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { BASE_URL, routeContext } from './helpers';
import { importModule, newBuyer, service, type Buyer } from './paiement-helpers';
import { advanceEventTo, createEventInStatus, type EventStatus } from './cycle-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { assertTerrainInvariants } from './terrain-helpers';
import { uploadImage } from '../audit/cvf2a-helpers';

type Row = Record<string, unknown>;
interface Reply { status: number; body: Row }

let partner: TestPartner;
let a: Buyer;
let b: Buyer;
const CATEGORIES = [{ name: 'Standard', price: 5000, total: 10 }];

before(async () => {
    partner = await newPartner('d1d-favoris');
    a = await newBuyer('d1d-fav-a');
    b = await newBuyer('d1d-fav-b');
});

after(async () => {
    await assertTerrainInvariants('design1d-favoris');
});

async function asReply(res: Response): Promise<Reply> {
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) as Row : {} };
}

async function favorites(token: string | null, query = ''): Promise<Reply> {
    const mod = await importModule('../../app/api/favorites/route');
    const headers: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
    return asReply(await mod.GET(new NextRequest(`${BASE_URL}/api/favorites${query}`, { headers })));
}

async function setFav(token: string | null, eventId: string, on: boolean): Promise<Reply> {
    const mod = await importModule('../../app/api/favorites/[eventId]/route');
    const headers: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
    const method = on ? 'PUT' : 'DELETE';
    return asReply(await mod[method](new NextRequest(`${BASE_URL}/api/favorites/${eventId}`, { method, headers }), routeContext({ eventId })));
}

describe('1. favoris', () => {
    test('a. ajout refusé pour tout événement non publié, même réponse qu’un inconnu', async () => {
        const unknown = await setFav(a.accessToken, randomUUID(), true);
        console.log(`[D1D-FAVORIS] 1a. inconnu : ${JSON.stringify(unknown)}`);
        assert.equal(unknown.status, 404);
        for (const status of ['BROUILLON', 'EN_ATTENTE', 'VALIDE', 'SUSPENDU', 'ANNULE'] as EventStatus[]) {
            const ev = await createEventInStatus(partner, `d1d-fav-${status}`, CATEGORIES, status, { startsInHours: 72 });
            const r = await setFav(a.accessToken, ev.eventId, true);
            console.log(`[D1D-FAVORIS] 1a. ${status} : ${JSON.stringify(r)}`);
            assert.deepEqual(r, unknown, `${status} : réponse différente d'un identifiant inconnu`);
        }
        const ids = await favorites(a.accessToken);
        assert.deepEqual(ids, { status: 200, body: { ids: [] } });
    });

    test('b-c. ajout, liste, cartes, suspendu encore listé, retrait ; jamais les favoris d’une autre personne', async () => {
        const ev = await createEventInStatus(partner, 'd1d-fav-publie', CATEGORIES, 'PUBLIE', { startsInHours: 72 });
        const added = await setFav(a.accessToken, ev.eventId, true);
        assert.deepEqual(added, { status: 200, body: { favorite: true } });
        assert.deepEqual(await setFav(a.accessToken, ev.eventId, true), { status: 200, body: { favorite: true } }, 'ajout répété');

        assert.deepEqual(await favorites(a.accessToken), { status: 200, body: { ids: [ev.eventId] } });
        const cards = await favorites(a.accessToken, '?cartes=1');
        const list = cards.body.events as Row[];
        console.log(`[D1D-FAVORIS] 1b. cartes : ${JSON.stringify(list.map((c) => ({ id: c.id, status: c.status, posterColor: c.posterColor })))}`);
        assert.equal(cards.status, 200);
        assert.deepEqual(list.map((c) => c.id), [ev.eventId]);
        assert.match(String(list[0].posterColor), /^#[0-9a-f]{6}$/);

        // c. B ne voit rien, et son retrait ne touche pas au favori de A ; paramètres d'un autre compte ignorés
        assert.deepEqual(await favorites(b.accessToken), { status: 200, body: { ids: [] } });
        assert.deepEqual(await favorites(b.accessToken, `?userId=${a.userId}&user_id=${a.userId}&cartes=1`), { status: 200, body: { events: [] } });
        assert.deepEqual(await setFav(b.accessToken, ev.eventId, false), { status: 200, body: { favorite: false } });
        assert.deepEqual(await favorites(a.accessToken), { status: 200, body: { ids: [ev.eventId] } }, 'retrait de B appliqué à A');

        await advanceEventTo(ev.eventId, 'SUSPENDU', { partnerUserId: partner.userId });
        const suspended = await favorites(a.accessToken, '?cartes=1');
        assert.deepEqual((suspended.body.events as Row[]).map((c) => [c.id, c.status]), [[ev.eventId, 'SUSPENDU']]);

        assert.deepEqual(await setFav(a.accessToken, ev.eventId, false), { status: 200, body: { favorite: false } });
        assert.deepEqual(await favorites(a.accessToken), { status: 200, body: { ids: [] } });
    });

    test('d. sans session : 401 ; aucun avis', async () => {
        const ev = await createEventInStatus(partner, 'd1d-fav-sans-session', CATEGORIES, 'PUBLIE', { startsInHours: 72 });
        assert.equal((await favorites(null)).status, 401);
        assert.equal((await setFav(null, ev.eventId, true)).status, 401);
        assert.equal((await setFav(null, ev.eventId, false)).status, 401);
        const before = await service.from('notification_outbox').select('id', { count: 'exact', head: true }).eq('recipient_user_id', a.userId);
        assert.deepEqual(await setFav(a.accessToken, ev.eventId, true), { status: 200, body: { favorite: true } });
        const afterAdd = await service.from('notification_outbox').select('id', { count: 'exact', head: true }).eq('recipient_user_id', a.userId);
        assert.equal(afterAdd.count, before.count, 'un avis a été créé par un favori');
        await setFav(a.accessToken, ev.eventId, false);
    });
});

describe('2. couleur de l’affiche', () => {
    test('a-b. dépôt réel → style ; l’événement prend la couleur ; autre affiche sans style → vide', async () => {
        const png = await sharp({ create: { width: 800, height: 1000, channels: 3, background: '#ff8a3d' } }).png().toBuffer();
        const up = await uploadImage(partner.accessToken, png, 'affiche.png', 'image/png');
        console.log(`[D1D-FAVORIS] 2a. dépôt : ${up.status} ${up.path}`);
        assert.equal(up.status, 200, JSON.stringify(up.body));
        const { data: style, error } = await service.from('poster_styles').select('path, color, blur').eq('path', up.path!).single();
        assert.equal(error, null, error?.message);
        const { contrastWithWhite, hexToRgb } = await importModule('../../lib/events/poster-color');
        console.log(`[D1D-FAVORIS] 2a. style : ${style!.color}, contraste ${contrastWithWhite(hexToRgb(style!.color)).toFixed(2)}, ${String(style!.blur).length} caractères`);
        assert.match(String(style!.color), /^#[0-9a-f]{6}$/);
        assert.ok(contrastWithWhite(hexToRgb(style!.color)) >= 4.5, 'contraste < 4,5:1');
        assert.match(String(style!.blur), /^data:image\/webp;base64,/);

        const ev = await createEventInStatus(partner, 'd1d-couleur', CATEGORIES, 'PUBLIE', { startsInHours: 72, imageUrl: up.url! });
        const { data: row } = await service.from('events').select('poster_color, poster_blur').eq('id', ev.eventId).single();
        assert.equal(row!.poster_color, style!.color, 'couleur prise par l’événement');
        assert.equal(row!.poster_blur, style!.blur, 'image floutée prise par l’événement');

        const detail = await importModule('../../app/api/events/[id]/route');
        const sheet = await asReply(await detail.GET(new NextRequest(`${BASE_URL}/api/events/${ev.eventId}`), routeContext({ id: ev.eventId })));
        const served = sheet.body.event as Row;
        assert.equal(served.posterColor, style!.color);
        assert.equal(served.posterBlur, style!.blur);

        const { posterUrl } = await import('./cycle-helpers');
        const { error: upErr } = await service.from('events').update({ image_url: posterUrl(partner.partnerId) }).eq('id', ev.eventId);
        assert.equal(upErr, null, upErr?.message);
        const { data: reset } = await service.from('events').select('poster_color, poster_blur').eq('id', ev.eventId).single();
        assert.deepEqual(reset, { poster_color: null, poster_blur: null }, 'couleur de l’ancienne affiche gardée');
    });

    test('c. script des affiches existantes : à blanc, appliqué, rejoué', async () => {
        const png = await sharp({ create: { width: 600, height: 750, channels: 3, background: '#1dc8f2' } }).png().toBuffer();
        const up = await uploadImage(partner.accessToken, png, 'ancienne.png', 'image/png');
        assert.equal(up.status, 200, JSON.stringify(up.body));
        // Affiche « d'avant le design 1d » : style retiré, événement sans couleur
        const ev = await createEventInStatus(partner, 'd1d-script', CATEGORIES, 'PUBLIE', { startsInHours: 72, imageUrl: up.url! });
        const { openConcurrentClient } = await import('../helpers/db');
        const db = await openConcurrentClient({ applicationName: 'ev-test-d1d-script' });
        try {
            await db.query('DELETE FROM public.poster_styles WHERE path = $1', [up.path]);
            await db.query('UPDATE public.events SET poster_color = NULL, poster_blur = NULL WHERE id = $1', [ev.eventId]);
            await db.commit();
        } finally {
            await db.close();
        }
        const { backfillPosterStyles } = await importModule('../../lib/events/poster-styles-backfill');
        const dry = await backfillPosterStyles({ onlyEventIds: [ev.eventId] });
        console.log(`[D1D-FAVORIS] 2c. à blanc : ${JSON.stringify(dry)}`);
        assert.equal(dry.apply, false);
        assert.equal(dry.planned.length, 1);
        const { data: still } = await service.from('events').select('poster_color').eq('id', ev.eventId).single();
        assert.equal(still!.poster_color, null, 'à blanc : rien d’écrit');

        const done = await backfillPosterStyles({ apply: true, onlyEventIds: [ev.eventId] });
        console.log(`[D1D-FAVORIS] 2c. appliqué : ${JSON.stringify(done)}`);
        assert.equal(done.done.length, 1);
        assert.equal(done.done[0].events, 1);
        const { data: colored } = await service.from('events').select('poster_color').eq('id', ev.eventId).single();
        assert.match(String(colored!.poster_color), /^#[0-9a-f]{6}$/);

        const again = await backfillPosterStyles({ apply: true, onlyEventIds: [ev.eventId] });
        assert.equal(again.candidates, 0, 'rejoué : plus rien à faire');
    });
});
