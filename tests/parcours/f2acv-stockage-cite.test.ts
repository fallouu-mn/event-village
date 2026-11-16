/**
 * Correctifs de la contre-vérification de la finition 2a, T6 — la purge des affiches et l'effacement d'une affiche
 * remplacée lisent TOUTES les colonnes qui citent le stockage ; salles, produits et profil refusent une adresse du
 * dossier events/.
 *  a. Inventaire : chaque colonne d'une table de la base dont le nom désigne une adresse ou une image est lue par
 *     storage_public_citations (ou écartée pour une raison écrite) ; aucune colonne nouvelle n'y échappe.
 *  b. Purge : fichiers de plus de 7 jours sous events/<P>/ cités par la photo du compte et par une pièce ancienne : gardés ;
 *     l'orpheline : effacée (la copie publique de l'affiche, tenue par un déclencheur, est vérifiée par l'inventaire a).
 *  c. Profil : logo et couverture du dossier events/ (en clair, puis encodé) refusés ; image déposée depuis le profil
 *     (misc/) acceptée.
 *  d. Salles et produits (services, routes fermées par interrupteur) : image du dossier events/ refusée
 *     (IMAGE_FOLDER_INVALID), rien n'est écrit ; image du dossier de la salle acceptée.
 * Rouge avant le correctif : fonction absente, purge qui n'épargne que les événements, profil, salles et produits qui
 * acceptent une adresse du dossier events/. Sortie brute `[F2ACV-T6]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { NextRequest } from 'next/server';
import { newBuyer, service } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { BASE_URL } from './helpers';
import { inspect, writeLocal } from '../helpers/db';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { api, show, type Row } from '../audit/cvf1-helpers';
import { BUCKET, putObject, stored, uniqueName, uploadImage } from '../audit/cvf2a-helpers';

let P: TestPartner;

before(async () => {
    P = await newPartner('f2acv-stockage');
});

after(async () => {
    await assertFinition1Invariants('f2acv-stockage-cite');
});

const publicUrl = (p: string) => service.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;
const webp = async () => sharp({ create: { width: 48, height: 30, channels: 3, background: { r: 30, g: 140, b: 90 } } }).webp().toBuffer();

/** Colonnes lues par storage_public_citations (migration 20261116000008), et colonnes écartées avec leur raison. */
const READ = ['events.image_url', 'events.gallery_urls', 'public_event_state.image_url', 'halls.images', 'products.images', 'partners.logo_url',
    'partners.cover_url', 'partners.id_card_url', 'partners.business_doc_url', 'users.avatar_url'];
const SET_ASIDE: Readonly<Record<string, string>> = {};

describe('a. inventaire des colonnes qui citent le stockage', () => {
    test('toute colonne d’adresse ou d’image d’une table est lue par storage_public_citations', async () => {
        const cols = await inspect(async (c) => (await c.query<{ col: string }>(`
            SELECT c.table_name || '.' || c.column_name AS col
              FROM information_schema.columns c
              JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
             WHERE c.table_schema = 'public'
               AND c.column_name ~ '(url|image|logo|cover|avatar|photo|picture|banner|gallery|thumbnail|media)'
               AND c.data_type IN ('text', 'character varying', 'ARRAY', 'jsonb')
             ORDER BY 1`)).rows.map((r) => r.col));
        const def = await inspect(async (c) => (await c.query<{ src: string }>(`SELECT pg_get_functiondef('public.storage_public_citations()'::regprocedure) AS src`)).rows[0]?.src ?? '');
        console.log(`[F2ACV-T6] colonnes d'adresse ou d'image : ${cols.join(', ')}`);
        const missing = cols.filter((col) => !READ.includes(col) && !SET_ASIDE[col]);
        assert.deepEqual(missing, [], `colonnes qui peuvent citer le stockage, non lues par la purge : ${missing.join(', ')}`);
        const unread = READ.filter((col) => {
            const [table, column] = col.split('.');
            return !def.includes(`public.${table} `) || !def.includes(column);
        });
        assert.deepEqual(unread, [], `colonnes annoncées mais absentes de storage_public_citations : ${unread.join(', ')}`);
    });
});

async function age(pathInBucket: string, days: number): Promise<void> {
    await writeLocal(async (c) => {
        const r = await c.query(`UPDATE storage.objects SET created_at = now() - make_interval(days => $3), updated_at = now() - make_interval(days => $3)
                                  WHERE bucket_id = $1 AND name = $2`, [BUCKET, pathInBucket, days]);
        assert.equal(r.rowCount, 1, `vieillissement de ${pathInBucket}`);
    });
}

describe('b. purge : un fichier cité par n’importe quelle colonne est gardé', () => {
    test('photo du compte, pièce ancienne : gardées ; orpheline : effacée', async () => {
        // La copie publique (public_event_state.image_url) n'est pas posée à la main : une ligne forgée fausserait l'invariant
        // x13 des autres suites, qui tournent en même temps (run 237). Sa lecture par la purge est vérifiée par l'inventaire (a).
        const files: Record<string, string> = {};
        for (const k of ['photo', 'piece', 'orpheline']) {
            files[k] = `events/${P.partnerId}/${uniqueName('webp')}`;
            await putObject(files[k], await webp(), 'image/webp');
        }
        const holder = await newBuyer('f2acv-stockage-photo');
        try {
            const { error: uErr } = await service.from('users').update({ avatar_url: publicUrl(files.photo) }).eq('id', holder.userId);
            assert.equal(uErr, null, `photo du compte (montage) : ${uErr?.message}`);
            const { error: pErr } = await service.from('partners').update({ id_card_url: publicUrl(files.piece) }).eq('id', P.partnerId);
            assert.equal(pErr, null, `pièce ancienne (montage) : ${pErr?.message}`);
            for (const p of Object.values(files)) await age(p, 8);
            const { GET } = (await import('../../app/api/cron/events-finish/route')) as { GET: (req: NextRequest) => Promise<Response> };
            const res = await GET(new NextRequest(`${BASE_URL}/api/cron/events-finish`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
            const body = (await res.json()) as Row;
            console.log(`[F2ACV-T6] events-finish → HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
            assert.equal(res.status, 200, JSON.stringify(body));
            const kept = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([k, p]) => [k, Boolean(await stored(p))] as const)));
            console.log(`[F2ACV-T6] après la purge : ${JSON.stringify(kept)}`);
            assert.deepEqual(kept, { photo: true, piece: true, orpheline: false });
        } finally {
            await service.from('users').update({ avatar_url: null }).eq('id', holder.userId);
            await service.from('partners').update({ id_card_url: null }).eq('id', P.partnerId);
        }
    });
});

describe('c. profil : logo et couverture refusent une adresse du dossier events/', () => {
    test('events/ en clair ou encodé refusé ; image déposée depuis le profil (misc/) acceptée', async () => {
        const poster = await uploadImage(P.accessToken, await webp(), 'affiche.webp', 'image/webp', 'events');
        const misc = await uploadImage(P.accessToken, await webp(), 'logo.webp', 'image/webp', 'misc');
        assert.ok(poster.status === 200 && misc.status === 200, `dépôts (montage) : ${show(poster)} ${show(misc)}`);
        const encoded = String(poster.url).replace('/public-images/events/', '/public-images/ev%65nts/');
        const replies: Array<[string, Row]> = [];
        for (const [label, body] of [['logo du dossier events/', { logo_url: poster.url }], ['couverture du dossier events/', { cover_url: poster.url }],
            ['logo du dossier events/ encodé', { logo_url: encoded }]] as Array<[string, Row]>) {
            const r = await api('PATCH', 'partner/profile', { token: P.accessToken, body });
            console.log(`[F2ACV-T6] PATCH profile ${label} → ${show(r).slice(0, 200)}`);
            replies.push([label, { status: r.status, code: r.body.code }]);
        }
        assert.deepEqual(replies.map(([l, r]) => [l, r.status, r.code]), replies.map(([l]) => [l, 400, 'INVALID_FIELD']));
        const { data: partner } = await service.from('partners').select('logo_url, cover_url').eq('id', P.partnerId).single();
        assert.ok(!String(partner?.logo_url ?? '').includes('/events/') && !String(partner?.cover_url ?? '').includes('/events/'), JSON.stringify(partner));
        const ok = await api('PATCH', 'partner/profile', { token: P.accessToken, body: { logo_url: misc.url } });
        assert.ok(ok.status < 300, `témoin : logo déposé depuis le profil (${show(ok)})`);
    });
});

describe('d. salles et produits : image du dossier events/ refusée', () => {
    test('HallService et ProductService : IMAGE_FOLDER_INVALID, rien n’est écrit ; image de la salle acceptée', async () => {
        const { HallService } = await import('../../lib/halls/hall.service');
        const { ProductService } = await import('../../lib/products/product.service');
        const poster = publicUrl(`events/${P.partnerId}/${uniqueName('webp')}`);
        const hallImage = publicUrl(`halls/${P.partnerId}/${uniqueName('webp')}`);
        const name = `Salle f2acv ${Date.now()}`;
        const codeOf = async (fn: () => Promise<unknown>) => {
            try {
                await fn();
                return 'accepté';
            } catch (err) {
                return (err as { code?: string }).code ?? (err instanceof Error ? err.message : String(err));
            }
        };
        const hall = await codeOf(() => HallService.createHall(P.userId, { name, capacity: 50, price_per_day: 100_000, images: [hallImage, poster] }));
        const product = await codeOf(() => ProductService.createProduct(P.userId, { name: `Produit f2acv ${Date.now()}`, price: 1000, images: [poster] }));
        console.log(`[F2ACV-T6] salle avec une affiche → ${hall} ; produit avec une affiche → ${product}`);
        assert.deepEqual([hall, product], ['IMAGE_FOLDER_INVALID', 'IMAGE_FOLDER_INVALID']);
        const { count } = await service.from('halls').select('id', { count: 'exact', head: true }).eq('name', name);
        assert.equal(count ?? 0, 0, 'salle écrite malgré le refus');
        const witness = await codeOf(() => HallService.createHall(P.userId, { name: `${name} témoin`, capacity: 50, price_per_day: 100_000, images: [hallImage] }));
        assert.equal(witness, 'accepté', 'témoin : image du dossier de la salle');
    });
});
