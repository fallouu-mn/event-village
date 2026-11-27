/**
 * Lot 12c — correctifs après contre-vérification (docs/audit-lot12c.md), par les routes et les fonctions en base. Base
 * LOCALE ; faux SamirPay. Réglages et listes modifiés remis dans leur état d'origine à la fin de chaque test.
 *  A. Mots déguisés (T1) : forme décomposée, caractères invisibles, lettres cyrilliques ou grecques, pleine chasse,
 *     lettres séparées ; « vinaigrette », « gingembre » non reconnus ; marques de la liste par défaut ; surlignage servi
 *     par le serveur (plages du texte d'origine).
 *  B. Décision liée à la version lue (T2) : refus « Ce produit a changé pendant votre lecture » ; version exigée par la
 *     route ; après une autorisation, un mot nouveau (supplément, description) remet « à vérifier ».
 *  C. Revue groupée (T3) : un changement de la liste revoit les produits déjà en vente, un seul avis groupé aux
 *     administrateurs, dernière revue affichée ; mots déjà autorisés non repris.
 *  D. Bouton « Mettre à vérifier » (T3) : droit partners.validate, motif, partenaire prévenue, refus en double.
 *  E. Lecture REST (T4) : état, mots, motif et archivage illisibles par la clé anon et par une partenaire ; colonnes de
 *     la carte toujours lisibles ; aucun écran ne lit ces colonnes par la REST.
 *  F. Catégories (T5) : nom compté, renommage qui remet ses produits « à vérifier », avis groupé, doublons.
 *  G. Produit archivé figé (T6) et « Remettre en vente » (point 8).
 *  H. Rupture en un geste (point 12) : portions ramenées à ce qui est vendu, annulation.
 *  I. Avis ajoutés (point 7) : code bloqué, rappel de réponse, préparation, commande prête pour le livreur, décision par
 *     SMS, remboursement bloqué, rappel au client ; une fois chacun ; règle de nuit ; types identiques à la base.
 */
import '../helpers/env';
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { assertLot12aInvariants } from '../helpers/lot12a-invariants';
import { openConcurrentClient } from '../helpers/db';
import { BASE_URL } from './helpers';
import { newAdmin, type TestAdmin } from './notif-helpers';
import { NOTIFICATION_CATALOG } from '../../lib/notifications/catalog';
import { smsSegments } from '../../lib/notifications/sms-format';
import { POST as productsPost } from '../../app/api/partner/products/route';
import { PATCH as productPatch, DELETE as productDelete } from '../../app/api/partner/products/[id]/route';
import { POST as productStatus } from '../../app/api/partner/products/[id]/status/route';
import { POST as productPortions } from '../../app/api/partner/products/[id]/portions/route';
import { POST as productRestore } from '../../app/api/partner/products/[id]/restore/route';
import { POST as optionPost } from '../../app/api/partner/products/[id]/options/route';
import { POST as categoriesPost } from '../../app/api/partner/products/categories/route';
import { PATCH as categoryPatch } from '../../app/api/partner/products/categories/[id]/route';
import { GET as dayGet } from '../../app/api/partner/orders/day/route';
import { POST as regulationPost } from '../../app/api/admin/products/[id]/regulation/route';
import { POST as reviewRequestPost } from '../../app/api/admin/products/[id]/review/route';
import { GET as reviewGet } from '../../app/api/admin/products/review/route';
import { PUT as keywordsPut } from '../../app/api/admin/products/keywords/route';
import {
    addCourier, codeOf, dailySpecialWindowClosed, newBuyer, newDeliveryZone, newPartner, newProduct, newShop, openOrdersService, order,
    orderBody, orderRpc, outboxOf, partnerAct, payOrder, placed, releaseUnpaid, service, setPortions, shiftOrder, superadminId, toReady,
    userClient, allChannels, type Buyer, type Row, type TestPartner,
} from './l12a-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;
let other: TestPartner;
let client: Buyer;
let reviewer: TestAdmin;
let shop: string;

before(async () => {
    restore = await openOrdersService();
    partner = await newPartner('l12c-cv');
    other = await newPartner('l12c-cv-autre');
    client = await newBuyer('l12c-cv-client');
    reviewer = await newAdmin('l12c-cv-verif', ['partners.validate']);
    shop = await newShop(partner, { depositAllowed: true, payOnHandover: true });
});

beforeEach(async () => {
    if (client) await releaseUnpaid(client.userId);
});

after(async () => {
    await restore();
    await assertLot12aInvariants('l12c-cv-correctifs');
});

type Reply = { status: number; body: Row };
function req(path: string, method: string, token: string | null, body?: unknown): NextRequest {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    return new NextRequest(`${BASE_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
async function reply(res: Response): Promise<Reply> {
    return { status: res.status, body: (await res.json()) as Row };
}
async function rpc(fn: string, p: Row): Promise<Row> {
    const { data, error } = await service.rpc(fn, { p });
    assert.equal(error, null, `${fn} : ${error?.message}`);
    return data as Row;
}
async function quote(productId: string): Promise<Row> {
    const { orderInput } = await import('../../lib/orders/booking');
    return rpc('order_quote', orderInput(client.userId, orderBody(shop, [{ productId, quantity: 1 }])));
}
async function product(id: string): Promise<Row> {
    const { data, error } = await service.from('products').select('*').eq('id', id).maybeSingle();
    assert.equal(error, null, error?.message);
    return (data ?? {}) as Row;
}
async function create(body: Row, owner: Buyer = partner): Promise<Row> {
    const r = await reply(await productsPost(req('/api/partner/products', 'POST', owner.accessToken, { venue_id: shop, price: 1_500, ...body })));
    assert.equal(r.status, 201, `création : ${JSON.stringify(r.body)}`);
    return r.body.product as Row;
}
async function version(id: string): Promise<string> {
    const p = await product(id);
    return String(p.review_requested_at ?? p.updated_at);
}
async function decide(id: string, regulated: boolean, reviewedAt: string | null, reason = 'Vérifié par la contre-vérification'): Promise<Reply> {
    return reply(await regulationPost(req(`/api/admin/products/${id}/regulation`, 'POST', reviewer.accessToken,
        { regulated, reason, ...(reviewedAt === null ? {} : { reviewedAt }) }), params({ id })));
}
async function queue(q?: string): Promise<Row> {
    const r = await reply(await reviewGet(req(`/api/admin/products/review${q ? `?q=${encodeURIComponent(q)}` : ''}`, 'GET', reviewer.accessToken)));
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    return r.body;
}
async function keywords(): Promise<string[]> {
    const { data, error } = await service.from('platform_settings').select('value').eq('key', 'orders.review_keywords').single();
    assert.equal(error, null, error?.message);
    return (data!.value as { value: string[] }).value;
}
async function restoreKeywords(list: string[]): Promise<void> {
    const { data, error } = await service.rpc('order_review_keywords_set', { p_value: { value: list }, p_actor: await superadminId(), p_reason: 'Fin du test l12c-cv' });
    assert.equal(error, null, error?.message);
    assert.equal((data as Row).ok, true, JSON.stringify(data));
}
async function sql<T extends Row = Row>(text: string, values: unknown[] = []): Promise<T[]> {
    const c = await openConcurrentClient({ applicationName: 'ev-test-l12c-cv' });
    try {
        await c.query(`SELECT set_config('event_village.order_flow', 'on', true)`);
        const { rows } = await c.query<T>(text, values);
        await c.commit();
        return rows;
    } finally {
        await c.close();
    }
}
async function adminBox(userId: string, type: string, since: string): Promise<Row[]> {
    const { data, error } = await service.from('notification_outbox').select('channel, template_data, created_at')
        .eq('recipient_user_id', userId).eq('type', type).gte('created_at', since);
    assert.equal(error, null, error?.message);
    return (data ?? []) as Row[];
}

describe('A. mots déguisés et marques (T1)', () => {
    test('décomposé, invisible, cyrillique, grec, pleine chasse, lettres séparées : à vérifier ; vinaigrette, gingembre : non', async () => {
        const flagged: Array<[string, string]> = [
            ['Bière décomposée', 'Bière blonde 65 cl'],
            ['espace sans chasse', 'Whis​ky 12 ans'],
            ['trait d’union conditionnel', 'Vod­ka citron'],
            ['i cyrillique', 'Bіère Gazelle'],
            ['o grec', 'Cοgnac VS'],
            ['pleine chasse', 'ＷＨＩＳＫＹ Jack'],
            ['points', 'W.H.I.S.K.Y 12 ans'],
            ['espaces', 'R H U M arrangé'],
            ['majuscules et pluriel', 'BIÈRES fraîches'],
        ];
        const got: Array<[string, unknown]> = [];
        for (const [label, name] of flagged) got.push([label, (await create({ name })).review_state ?? null]);
        assert.deepEqual(got.filter(([, s]) => s !== 'A_VERIFIER'), [], `non repérés : ${JSON.stringify(got)}`);

        const clean = ['Vinaigrette maison', 'Jus de gingembre', 'G i n g e m b r e frais', 'Thé à la menthe', 'Ginger beer maison'];
        const left: Array<[string, unknown]> = [];
        for (const name of clean) left.push([name, (await create({ name })).review_state ?? null]);
        // « Ginger beer » : « beer » n'est pas dans la liste par défaut (mot anglais) ; « ginger » ne commence pas par « gin » + fin de mot
        assert.deepEqual(left.filter(([, s]) => s !== null), [], `repérés à tort : ${JSON.stringify(left)}`);
    });

    test('marques de la liste par défaut : Gazelle, Flag, Castel, 33 Export, Heineken, Guinness, Johnnie Walker, Jack Daniel’s, Marlboro, Dunhill', async () => {
        const list = await keywords();
        for (const w of ['gazelle', 'flag', 'castel', '33 export', 'heineken', 'guinness', 'johnnie walker', "jack daniel's", 'marlboro', 'dunhill']) {
            assert.ok(list.includes(w), `« ${w} » absent de la liste par défaut`);
        }
        const names = ['Flag spéciale 33 cl', 'Castel 65 cl', '33 Export', 'Heineken pression', 'Guinness', 'Johnnie Walker Red', 'Jack Daniel’s 70 cl', 'Paquet Marlboro', 'Dunhill bleu'];
        const got: Array<[string, unknown, unknown]> = [];
        for (const name of names) {
            const p = await create({ name });
            got.push([name, p.review_state ?? null, (await quote(String(p.id))).code ?? 'VENDABLE']);
        }
        assert.deepEqual(got.filter(([, s, q]) => s !== 'A_VERIFIER' || q !== 'PRODUCT_UNDER_REVIEW'), [], JSON.stringify(got));
    });

    test('surlignage servi par le serveur : plages du texte d’origine (lettres séparées, catégorie, supplément)', async () => {
        const cat = await reply(await categoriesPost(req('/api/partner/products/categories', 'POST', partner.accessToken, { name: `Caves l12c-cv ${Date.now() % 100000}` })));
        assert.ok(cat.status === 201 || cat.status === 200, JSON.stringify(cat.body));
        const p = await create({ name: 'W.H.I.S.K.Y 12 ans', description: 'Servi avec une bière', category_id: String((cat.body.category as Row).id) });
        const id = String(p.id);
        const opt = await reply(await optionPost(req(`/api/partner/products/${id}/options`, 'POST', partner.accessToken, { name: 'Rhum en plus', price: 500 }), params({ id })));
        assert.equal(opt.status, 201, JSON.stringify(opt.body));
        const item = ((await queue()).queue as Row[]).find((x) => x.id === id);
        assert.ok(item, 'produit dans la file');
        const marks = item!.marks as Record<string, Array<[number, number]>>;
        assert.deepEqual(marks.name, [[0, 11]], `nom : ${JSON.stringify(marks)}`);
        assert.deepEqual(marks.description, [[15, 20]], `description : ${JSON.stringify(marks)}`);
        assert.deepEqual(marks.category, [], `catégorie sans mot : ${JSON.stringify(marks)}`);
        assert.deepEqual((item!.options as Row[]).map((o) => o.marks), [[[0, 4]]]);
        assert.equal(typeof item!.version, 'string');
    });
});

describe('B. décision liée à la version lue (T2)', () => {
    test('sans version : refus ; version périmée : « Ce produit a changé pendant votre lecture » ; version à jour : décision prise', async () => {
        const id = String((await create({ name: 'Bière sans alcool l12c-cv' })).id);
        const seen = ((await queue()).queue as Row[]).find((x) => x.id === id);
        assert.ok(seen, 'dans la file');
        assert.equal(seen!.version, await version(id), 'version servie = date de la demande');

        const missing = await decide(id, false, null);
        assert.deepEqual([missing.status, missing.body.code], [400, 'REVIEW_VERSION_REQUIRED']);

        // La partenaire ajoute un supplément sans mot de la liste pendant la lecture : nouvelle version
        const opt = await reply(await optionPost(req(`/api/partner/products/${id}/options`, 'POST', partner.accessToken, { name: 'Citron vert', price: 200 }), params({ id })));
        assert.equal(opt.status, 201, JSON.stringify(opt.body));
        const stale = await decide(id, false, String(seen!.version));
        assert.deepEqual([stale.status, stale.body.code, stale.body.error], [409, 'REVIEW_CHANGED', 'Ce produit a changé pendant votre lecture : relisez-le.']);
        assert.equal((await product(id)).review_state, 'A_VERIFIER', 'aucune décision prise');

        const fresh = await decide(id, false, await version(id));
        assert.equal(fresh.status, 200, JSON.stringify(fresh.body));
        assert.equal((await quote(id)).ok, true, 'vendable après « autoriser »');

        // Après l'autorisation : un mot nouveau (supplément, puis description) remet « à vérifier »
        const rum = await reply(await optionPost(req(`/api/partner/products/${id}/options`, 'POST', partner.accessToken, { name: 'Shot de rhum', price: 1_000 }), params({ id })));
        assert.equal(rum.status, 201, JSON.stringify(rum.body));
        assert.deepEqual([(await product(id)).review_state, (await quote(id)).code], ['A_VERIFIER', 'PRODUCT_UNDER_REVIEW']);
        assert.equal((await decide(id, false, await version(id))).status, 200);
        const desc = await reply(await productPatch(req(`/api/partner/products/${id}`, 'PATCH', partner.accessToken, { description: 'Avec un trait de vodka' }), params({ id })));
        assert.equal(desc.status, 200, JSON.stringify(desc.body));
        assert.equal((await product(id)).review_state, 'A_VERIFIER', 'description avec un mot nouveau');
    });

    test('photo changée pendant la lecture : nouvelle version, décision périmée refusée', async () => {
        const id = String((await create({ name: 'Vin de palme l12c-cv' })).id);
        const before = await version(id);
        const patched = await reply(await productPatch(req(`/api/partner/products/${id}`, 'PATCH', partner.accessToken, { name: 'Vin de palme frais l12c-cv' }), params({ id })));
        assert.equal(patched.status, 200, JSON.stringify(patched.body));
        assert.notEqual(await version(id), before, 'nouvelle version');
        assert.equal((await decide(id, false, before)).body.code, 'REVIEW_CHANGED');
    });
});

describe('C. revue groupée des produits déjà en vente (T3)', () => {
    test('mot ajouté : produits en vente mis à vérifier, un seul avis groupé, dernière revue affichée ; mots déjà autorisés non repris', async () => {
        const original = await keywords();
        const since = new Date(Date.now() - 1_000).toISOString();
        const zorbex = String((await create({ name: 'Zorbex blonde 33 cl' })).id);
        assert.equal((await quote(zorbex)).ok, true, 'précondition : vendable');
        const allowed = String((await create({ name: 'Bière de gingembre l12c-cv' })).id);
        assert.equal((await decide(allowed, false, await version(allowed))).status, 200);
        try {
            const sa = await newAdmin('l12c-cv-super', [], { role: 'SUPERADMIN' });
            const put = await reply(await keywordsPut(req('/api/admin/products/keywords', 'PUT', sa.accessToken,
                { keywords: [...original, 'zorbex'], reason: 'Marque ajoutée (test l12c-cv)' })));
            assert.equal(put.status, 200, JSON.stringify(put.body));
            assert.ok(Number(put.body.flagged) >= 1, JSON.stringify(put.body));
            assert.match(String(put.body.message), /à vérifier/);
            const p = await product(zorbex);
            assert.deepEqual([p.review_state, p.review_words], ['A_VERIFIER', ['zorbex']]);
            assert.equal((await quote(zorbex)).code, 'PRODUCT_UNDER_REVIEW');
            assert.equal((await product(allowed)).review_state, null, 'produit autorisé (mot « bière » déjà vu) non repris');

            const box = (await adminBox(reviewer.userId, 'ADMIN_PRODUCTS_REVIEW_BATCH', since)).filter((b) => (b.template_data as Row).origin === 'LISTE');
            assert.deepEqual(box.map((b) => String(b.channel)).sort(), ['EMAIL', 'IN_APP'], 'un seul avis groupé (cloche, email)');
            assert.equal((await adminBox(reviewer.userId, 'ADMIN_PRODUCT_REVIEW', since)).filter((b) => (b.template_data as Row).product_id === zorbex).length, 0,
                'pas un avis par produit');
            const last = (await queue()).lastBatch as Row;
            assert.equal(last.origin, 'LISTE');
            assert.ok(Number(last.count) >= 1);
        } finally {
            await restoreKeywords(original);
        }
    });

    test('la revue ne fait que poser « à vérifier » : produit refusé, réglementé ou archivé non touché', async () => {
        const original = await keywords();
        const refused = String((await create({ name: 'Kirbex rouge' })).id);
        try {
            await restoreKeywords([...original, 'kirbex']);
            assert.equal((await decide(refused, true, await version(refused), 'Boisson alcoolisée')).status, 200);
            const before = await product(refused);
            await restoreKeywords([...original, 'kirbex', 'kirbexx']);
            const after = await product(refused);
            assert.deepEqual([after.review_state, after.regulated_admin, after.updated_at], [null, true, before.updated_at]);
        } finally {
            await restoreKeywords(original);
        }
    });
});

describe('D. bouton « Mettre à vérifier » (T3)', () => {
    test('droit, motif, partenaire prévenue, file avec le motif, refus en double ; produit d’une marque inconnue', async () => {
        const id = String((await create({ name: 'Tchoukoutou artisanal' })).id);
        assert.equal((await quote(id)).ok, true, 'précondition : vendable');
        const found = await queue('Tchoukoutou');
        assert.ok((found.search as Row[]).some((x) => x.id === id && x.underReview === false), 'trouvé par la recherche');

        const nobody = await newAdmin('l12c-cv-sans-droit', ['events.read']);
        const forbidden = await reply(await reviewRequestPost(req(`/api/admin/products/${id}/review`, 'POST', nobody.accessToken, { reason: 'Bière de mil' }), params({ id })));
        assert.equal(forbidden.status, 403);
        const asPartner = await reply(await reviewRequestPost(req(`/api/admin/products/${id}/review`, 'POST', partner.accessToken, { reason: 'Bière de mil' }), params({ id })));
        assert.ok(asPartner.status === 401 || asPartner.status === 403, `partenaire : HTTP ${asPartner.status}`);
        const noReason = await reply(await reviewRequestPost(req(`/api/admin/products/${id}/review`, 'POST', reviewer.accessToken, { reason: ' ' }), params({ id })));
        assert.deepEqual([noReason.status, noReason.body.code], [400, 'REASON_REQUIRED']);

        const ok = await reply(await reviewRequestPost(req(`/api/admin/products/${id}/review`, 'POST', reviewer.accessToken, { reason: 'Bière de mil fermentée' }), params({ id })));
        assert.equal(ok.status, 200, JSON.stringify(ok.body));
        const p = await product(id);
        assert.deepEqual([p.review_state, p.review_note], ['A_VERIFIER', 'Bière de mil fermentée']);
        assert.equal((await quote(id)).code, 'PRODUCT_UNDER_REVIEW');
        const { data: told } = await service.from('notification_outbox').select('channel, template_data')
            .eq('recipient_user_id', partner.userId).eq('type', 'PRODUCT_REVIEW_DECIDED').eq('template_data->>product_id', id);
        assert.deepEqual((told ?? []).map((t) => String(t.channel)).sort(), ['EMAIL', 'IN_APP', 'PUSH']);
        assert.equal(((told ?? [])[0]?.template_data as Row).decision, 'A_VERIFIER');
        const item = ((await queue()).queue as Row[]).find((x) => x.id === id);
        assert.deepEqual([item?.reason, item?.note], ['ADMIN', 'Bière de mil fermentée']);

        const again = await reply(await reviewRequestPost(req(`/api/admin/products/${id}/review`, 'POST', reviewer.accessToken, { reason: 'Encore' }), params({ id })));
        assert.deepEqual([again.status, again.body.code], [409, 'ALREADY_IN_REVIEW']);
        // Autorisation : le motif s'efface, le produit se vend
        assert.equal((await decide(id, false, await version(id), 'Boisson sans alcool')).status, 200);
        const cleared = await product(id);
        assert.deepEqual([cleared.review_state, cleared.review_note], [null, null]);
    });
});

describe('E. lecture REST de l’état de vérification (T4)', () => {
    test('clé anon, autre partenaire et partenaire elle-même : colonnes de vérification et d’archivage illisibles ; carte lisible', async () => {
        const id = String((await create({ name: 'Bière pression l12c-cv' })).id);
        const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
        for (const [who, c] of [['anon', anon], ['autre partenaire', userClient(other.accessToken)], ['partenaire', userClient(partner.accessToken)]] as const) {
            for (const col of ['review_state', 'review_words', 'review_requested_at', 'review_note', 'review_cleared_words', 'archived_at']) {
                const { data, error } = await c.from('products').select(`id, ${col}`).eq('id', id);
                assert.ok(error || !((data ?? []) as unknown as Row[]).some((r) => r[col] !== undefined), `${who} lit ${col} : ${JSON.stringify(data)}`);
            }
            const { error } = await c.from('products').select('id, name, price, status, is_regulated, images, category_id').eq('id', id);
            assert.equal(error, null, `${who} : colonnes de la carte illisibles (${error?.message})`);
        }
    });

    test('aucun écran ni code du navigateur ne lit la table products par la REST', () => {
        const ROOT = process.cwd();
        const files: string[] = [];
        const walk = (dir: string) => {
            for (const name of readdirSync(dir)) {
                const p = join(dir, name);
                if (statSync(p).isDirectory()) walk(p);
                else if (/\.(ts|tsx)$/.test(name)) files.push(p);
            }
        };
        for (const d of ['components', 'app']) walk(join(ROOT, d));
        const bad = files.filter((f) => !relative(ROOT, f).replace(/\\/g, '/').startsWith('app/api/'))
            .filter((f) => /from\(\s*['"]products['"]\s*\)/.test(readFileSync(f, 'utf8')));
        assert.deepEqual(bad.map((f) => relative(ROOT, f)), []);
    });
});

describe('F. catégories (T5)', () => {
    test('renommer une catégorie avec un mot de la liste : ses produits à vérifier, avis groupé ; doublons', async () => {
        const since = new Date(Date.now() - 1_000).toISOString();
        const stamp = Date.now() % 1_000_000;
        const made = await reply(await categoriesPost(req('/api/partner/products/categories', 'POST', partner.accessToken, { name: `Boissons fraîches ${stamp}` })));
        assert.equal(made.status, 201, JSON.stringify(made.body));
        const catId = String((made.body.category as Row).id);
        const same = await reply(await categoriesPost(req('/api/partner/products/categories', 'POST', partner.accessToken, { name: `boissons fraîches ${stamp}` })));
        assert.deepEqual([same.status, (same.body.category as Row).id], [200, catId], 'nom existant : catégorie existante');
        const p = String((await create({ name: 'Thiakry glacé', category_id: catId })).id);
        assert.equal((await quote(p)).ok, true, 'précondition : vendable');

        const renamed = await reply(await categoryPatch(req(`/api/partner/products/categories/${catId}`, 'PATCH', partner.accessToken, { name: `Bières et vins ${stamp}` }), params({ id: catId })));
        assert.equal(renamed.status, 200, JSON.stringify(renamed.body));
        assert.equal(renamed.body.flagged, 1);
        const after = await product(p);
        assert.deepEqual([after.review_state, after.review_words], ['A_VERIFIER', ['bière', 'vin']]);
        const box = (await adminBox(reviewer.userId, 'ADMIN_PRODUCTS_REVIEW_BATCH', since)).filter((b) => (b.template_data as Row).origin === 'CATEGORIE');
        assert.deepEqual(box.map((b) => String(b.channel)).sort(), ['EMAIL', 'IN_APP']);

        const other2 = await reply(await categoriesPost(req('/api/partner/products/categories', 'POST', partner.accessToken, { name: `Desserts ${stamp}` })));
        const clash = await reply(await categoryPatch(req(`/api/partner/products/categories/${String((other2.body.category as Row).id)}`, 'PATCH', partner.accessToken, { name: `bières et vins ${stamp}` }), params({ id: String((other2.body.category as Row).id) })));
        assert.deepEqual([clash.status, clash.body.code], [409, 'CATEGORY_EXISTS']);
        const foreign = await reply(await categoryPatch(req(`/api/partner/products/categories/${catId}`, 'PATCH', other.accessToken, { name: 'Volée' }), params({ id: catId })));
        assert.ok(foreign.status === 404 || foreign.status === 403, `catégorie d’une autre : HTTP ${foreign.status}`);
        const short = await reply(await categoryPatch(req(`/api/partner/products/categories/${catId}`, 'PATCH', partner.accessToken, { name: 'B' }), params({ id: catId })));
        assert.deepEqual([short.status, short.body.code], [400, 'INVALID_CATEGORY']);
    });
});

describe('G. produit archivé figé (T6) et « Remettre en vente » (point 8)', () => {
    async function archivedProduct(name: string, extra: Row = {}): Promise<{ id: string; orderId: string }> {
        const id = String((await create({ name, price: 2_500, ...extra })).id);
        if (extra.is_daily_special) assert.equal((await setPortions(partner, id, 10)).ok, true);
        // Plat du jour : payé en entier en ligne (commande en attente de paiement, close par beforeEach)
        const orderId = await placed(client, orderBody(shop, [{ productId: id, quantity: 1 }],
            extra.is_daily_special ? {} : { mode: 'SUR_PLACE', onsiteLabel: 'Comptoir', payment: 'DIFFERE' }));
        const arch = await reply(await productDelete(req(`/api/partner/products/${id}`, 'DELETE', partner.accessToken), params({ id })));
        assert.deepEqual([arch.status, arch.body.outcome], [200, 'ARCHIVED'], JSON.stringify(arch.body));
        return { id, orderId };
    }

    test('statut, prix, suppléments et écriture directe refusés sur un produit archivé', async () => {
        const { id, orderId } = await archivedProduct('Dibi mouton l12c-cv');
        const s = await reply(await productStatus(req(`/api/partner/products/${id}/status`, 'POST', partner.accessToken, { status: 'SUSPENDU' }), params({ id })));
        assert.deepEqual([s.status, s.body.code], [409, 'PRODUCT_ARCHIVED']);
        const price = await reply(await productPatch(req(`/api/partner/products/${id}`, 'PATCH', partner.accessToken, { price: 1 }), params({ id })));
        assert.equal(price.status, 409);
        const opt = await reply(await optionPost(req(`/api/partner/products/${id}/options`, 'POST', partner.accessToken, { name: 'Oignons', price: 0 }), params({ id })));
        assert.ok(opt.status >= 400, `supplément ajouté à un archivé (HTTP ${opt.status})`);
        const { error } = await service.from('products').update({ price: 1 }).eq('id', id);
        assert.ok(error, 'écriture directe acceptée sur un archivé');
        const p = await product(id);
        assert.deepEqual([p.status, Number(p.price)], ['DISPONIBLE', 2_500]);
        await partnerAct(partner, orderId, { action: 'REFUSER', reason: 'Fin du test l12c-cv' });
    });

    test('portions d’un plat du jour archivé refusées', { skip: dailySpecialWindowClosed() ? 'fenêtre de fin de journée' : false }, async () => {
        const { id, orderId } = await archivedProduct('Yassa du jour l12c-cv', { is_daily_special: true });
        const r = await reply(await productPortions(req(`/api/partner/products/${id}/portions`, 'POST', partner.accessToken, { portions: 30 }), params({ id })));
        assert.ok(r.status >= 400, `portions d’un archivé acceptées (HTTP ${r.status})`);
        assert.equal(r.body.code, 'PRODUCT_ARCHIVED');
        await partnerAct(partner, orderId, { action: 'REFUSER', reason: 'Fin du test l12c-cv' });
    });

    test('remettre en vente : retour sur la carte, revu par la liste ; mots déjà autorisés non repris ; non archivé refusé', async () => {
        const plain = await archivedProduct('Pastels l12c-cv');
        const back = await reply(await productRestore(req(`/api/partner/products/${plain.id}/restore`, 'POST', partner.accessToken), params({ id: plain.id })));
        assert.equal(back.status, 200, JSON.stringify(back.body));
        assert.deepEqual([(await product(plain.id)).archived_at, (back.body.product as Row).underReview], [null, false]);
        assert.equal((await quote(plain.id)).ok, true, 'vendable après la remise en vente');
        const twice = await reply(await productRestore(req(`/api/partner/products/${plain.id}/restore`, 'POST', partner.accessToken), params({ id: plain.id })));
        assert.deepEqual([twice.status, twice.body.code], [409, 'PRODUCT_NOT_ARCHIVED']);

        // Produit autorisé par l'administration (mot « bière » vu), vendu puis archivé : remis sans nouvelle vérification
        const allowedId = String((await create({ name: 'Bière de bissap l12c-cv', price: 2_500 })).id);
        assert.equal((await decide(allowedId, false, await version(allowedId), 'Sans alcool')).status, 200);
        const o2 = await placed(client, orderBody(shop, [{ productId: allowedId, quantity: 1 }], { mode: 'SUR_PLACE', onsiteLabel: 'Comptoir', payment: 'DIFFERE' }));
        assert.equal((await reply(await productDelete(req(`/api/partner/products/${allowedId}`, 'DELETE', partner.accessToken), params({ id: allowedId })))).body.outcome, 'ARCHIVED');
        const back2 = await reply(await productRestore(req(`/api/partner/products/${allowedId}/restore`, 'POST', partner.accessToken), params({ id: allowedId })));
        assert.equal(back2.status, 200, JSON.stringify(back2.body));
        assert.equal((await product(allowedId)).review_state, null, 'mot déjà autorisé : pas de nouvelle vérification');

        // Produit d'une autre partenaire : introuvable
        const foreign = await reply(await productRestore(req(`/api/partner/products/${allowedId}/restore`, 'POST', other.accessToken), params({ id: allowedId })));
        assert.ok(foreign.status === 404 || foreign.status === 403, `remise en vente du produit d’une autre : HTTP ${foreign.status}`);
        for (const id of [plain.orderId, o2]) await partnerAct(partner, id, { action: 'REFUSER', reason: 'Fin du test l12c-cv' });
    });
});

describe('H. rupture en un geste (point 12)', () => {
    test('« Plus de … » : portions ramenées à ce qui est vendu, hors de « Ma journée », annulable', { skip: dailySpecialWindowClosed() ? 'fenêtre de fin de journée' : false }, async () => {
        const id = String((await create({ name: 'Mafé du jour l12c-cv', price: 3_000, is_daily_special: true })).id);
        assert.equal((await setPortions(partner, id, 10)).ok, true);
        const dayBefore = await reply(await dayGet(req('/api/partner/orders/day', 'GET', partner.accessToken)));
        assert.ok(((dayBefore.body.day as Row).specials as Row[]).some((s) => s.productId === id && s.portions === 10), JSON.stringify(dayBefore.body.day));
        const sold = await reply(await productPortions(req(`/api/partner/products/${id}/portions`, 'POST', partner.accessToken, { soldOut: true }), params({ id })));
        assert.equal(sold.status, 200, JSON.stringify(sold.body));
        assert.deepEqual([(sold.body.portions as Row).portions, (sold.body.portions as Row).sold], [0, 0]);
        assert.notEqual((await quote(id)).ok, true, 'plat épuisé encore commandable');
        const dayAfter = await reply(await dayGet(req('/api/partner/orders/day', 'GET', partner.accessToken)));
        assert.ok(!((dayAfter.body.day as Row).specials as Row[]).some((s) => s.productId === id), 'encore listé en vente');
        const undo = await reply(await productPortions(req(`/api/partner/products/${id}/portions`, 'POST', partner.accessToken, { portions: 10 }), params({ id })));
        assert.equal(undo.status, 200, JSON.stringify(undo.body));
        assert.equal((await quote(id)).ok, true, 'de nouveau commandable après l’annulation');
    });
});

describe('I. avis ajoutés (point 7)', () => {
    test('P1 code bloqué : le client prévenu sur les 4 canaux, une fois', async () => {
        const dish = await newProduct(partner, shop, { price: 2_000 });
        const id = await placed(client, orderBody(shop, [{ productId: dish, quantity: 1 }]));
        await payOrder(client, id);
        await toReady(partner, id);
        const good = await codeOf(client, id);
        const wrong = good === '0000' ? '1111' : '0000';
        for (let i = 0; i < 6; i += 1) await partnerAct(partner, id, { action: 'REMETTRE', code: wrong });
        const box = (await outboxOf(client.userId, id)).filter((x) => x.startsWith('ORDER_CODE_LOCKED:'));
        assert.deepEqual(box, allChannels('ORDER_CODE_LOCKED'));
        await partnerAct(partner, id, { action: 'ANNULER', reason: 'Fin du test l12c-cv' });
    });

    test('P2 rappel de réponse 5 minutes avant la fin du délai : partenaire prévenue sur les 4 canaux, une seule fois', async () => {
        const dish = await newProduct(partner, shop, { price: 2_000 });
        const id = await placed(client, orderBody(shop, [{ productId: dish, quantity: 1 }]));
        await payOrder(client, id);
        assert.equal((await order(id)).order_state, 'RECUE');
        await shiftOrder(id, { response_due_at: 4 });
        const first = await rpc('order_reminders', {});
        assert.ok(Number(first.response_reminders) >= 1, JSON.stringify(first));
        await rpc('order_reminders', {});
        const box = (await outboxOf(partner.userId, id)).filter((x) => x.startsWith('ORDER_RESPONSE_REMINDER:'));
        assert.deepEqual(box, allChannels('ORDER_RESPONSE_REMINDER'));
        await partnerAct(partner, id, { action: 'REFUSER', reason: 'Fin du test l12c-cv' });
    });

    test('P3 commande programmée : début de préparation ; P7 commande d’un autre jour : rappel au client 1 heure avant', async () => {
        const dish = await newProduct(partner, shop, { price: 2_000 });
        const id = await placed(client, orderBody(shop, [{ productId: dish, quantity: 1 }]));
        await payOrder(client, id);
        assert.equal((await partnerAct(partner, id, { action: 'ACCEPTER' })).status, 200);
        await sql(`UPDATE public.orders SET asap = false, scheduled_for = now() + interval '20 minutes', accepted_at = now() - interval '3 hours',
                          received_at = now() - interval '1 day' WHERE id = $1`, [id]);
        await rpc('order_reminders', {});
        await rpc('order_reminders', {});
        assert.deepEqual((await outboxOf(partner.userId, id)).filter((x) => x.startsWith('ORDER_PREP_REMINDER:')), allChannels('ORDER_PREP_REMINDER'));
        assert.deepEqual((await outboxOf(client.userId, id)).filter((x) => x.startsWith('ORDER_SCHEDULED_REMINDER:')), allChannels('ORDER_SCHEDULED_REMINDER'));
        await partnerAct(partner, id, { action: 'ANNULER', reason: 'Fin du test l12c-cv' });
    });

    test('P4 commande prête : le livreur choisi pendant la préparation est prévenu sur les 4 canaux', async () => {
        const courier = await newBuyer('l12c-cv-livreur');
        await addCourier(partner, courier);
        const zone = await newDeliveryZone(shop, 1_000, 0, `Zone l12c-cv ${Date.now() % 100000}`);
        const dish = await newProduct(partner, shop, { price: 3_000 });
        const id = await placed(client, orderBody(shop, [{ productId: dish, quantity: 1 }], { mode: 'LIVRAISON', zoneId: zone, address: 'Villa 4, Ouakam', phone: client.phone9 }));
        await payOrder(client, id);
        for (const body of [{ action: 'ACCEPTER' }, { action: 'CONFIER', courierId: courier.userId }, { action: 'PREPARER' }, { action: 'PRETE' }]) {
            const r = await partnerAct(partner, id, body);
            assert.equal(r.status, 200, `${body.action} : ${JSON.stringify(r.body)}`);
        }
        assert.deepEqual((await outboxOf(courier.userId, id)).filter((x) => x.startsWith('ORDER_READY_COURIER:')), allChannels('ORDER_READY_COURIER'));
        await partnerAct(partner, id, { action: 'ANNULER', reason: 'Fin du test l12c-cv' });
    });

    test('P5 décision sur un produit : SMS à la partenaire en plus de la cloche', async () => {
        const id = String((await create({ name: 'Bière de riz l12c-cv' })).id);
        assert.equal((await decide(id, true, await version(id), 'Boisson alcoolisée')).status, 200);
        const { data } = await service.from('notification_outbox').select('channel, template_data')
            .eq('recipient_user_id', partner.userId).eq('type', 'PRODUCT_DECISION_SMS').eq('template_data->>product_id', id);
        assert.deepEqual((data ?? []).map((r) => [String(r.channel), (r.template_data as Row).decision]), [['SMS', 'REFUSE']]);
    });

    test('P6 remboursement d’une commande incertain : SMS aux administrateurs refunds.manage', async () => {
        const money = await newAdmin('l12c-cv-remb', ['refunds.manage']);
        const since = new Date(Date.now() - 1_000).toISOString();
        const dish = await newProduct(partner, shop, { price: 2_000 });
        const id = await placed(client, orderBody(shop, [{ productId: dish, quantity: 1 }]));
        const payment = await payOrder(client, id);
        assert.equal((await partnerAct(partner, id, { action: 'REFUSER', reason: 'Plus de stock (test l12c-cv)' })).status, 200);
        const { data: cashouts, error } = await service.from('cashouts').select('id, status').eq('kind', 'REFUND').eq('payment_id', payment.id);
        assert.equal(error, null, error?.message);
        assert.equal((cashouts ?? []).length, 1, JSON.stringify(cashouts));
        const { error: upd } = await service.from('cashouts').update({ status: 'INCERTAIN', last_error: 'délai dépassé (test l12c-cv)' }).eq('id', cashouts![0].id);
        assert.equal(upd, null, upd?.message);
        const box = (await adminBox(money.userId, 'ADMIN_ORDER_REFUND_BLOCKED', since)).filter((b) => (b.template_data as Row).cashout_id === cashouts![0].id);
        assert.deepEqual(box.map((b) => [String(b.channel), (b.template_data as Row).cashout_status, (b.template_data as Row).order_number]),
            [['SMS', 'INCERTAIN', (await order(id)).order_number]]);
    });

    test('règle de nuit : code, rappels, préparation, commande prête, rappel client tout de suite ; décision, remboursement, revue groupée reportés', async () => {
        const { data, error } = await service.from('notification_types').select('type, night_policy, channels')
            .in('type', ['ORDER_CODE_LOCKED', 'ORDER_RESPONSE_REMINDER', 'ORDER_PREP_REMINDER', 'ORDER_READY_COURIER', 'ORDER_SCHEDULED_REMINDER',
                'PRODUCT_DECISION_SMS', 'ADMIN_ORDER_REFUND_BLOCKED', 'ADMIN_PRODUCTS_REVIEW_BATCH']);
        assert.equal(error, null, error?.message);
        const got = Object.fromEntries((data ?? []).map((r) => [String(r.type), String(r.night_policy)]));
        assert.deepEqual(got, {
            ORDER_CODE_LOCKED: 'SEND', ORDER_RESPONSE_REMINDER: 'SEND', ORDER_PREP_REMINDER: 'SEND', ORDER_READY_COURIER: 'SEND',
            ORDER_SCHEDULED_REMINDER: 'SEND', PRODUCT_DECISION_SMS: 'DEFER', ADMIN_ORDER_REFUND_BLOCKED: 'DEFER', ADMIN_PRODUCTS_REVIEW_BATCH: 'DEFER',
        });
        for (const r of data ?? []) {
            const e = NOTIFICATION_CATALOG[String(r.type) as keyof typeof NOTIFICATION_CATALOG];
            assert.ok(e, `${String(r.type)} absent du catalogue`);
            assert.deepEqual([...e.channels].sort(), [...(r.channels as string[])].sort(), `${String(r.type)} : canaux`);
            assert.equal(e.nightPolicy, String(r.night_policy), `${String(r.type)} : règle de nuit`);
        }
    });

    test('SMS des avis ajoutés : GSM-7, un segment au pire cas, sans mot technique', () => {
        const LONG = 'Chez Mame Diarra « Tëranga » – grillades {[~]} € & poissons du fleuve, un nom vraiment très très long';
        const types = ['ORDER_CODE_LOCKED', 'ORDER_RESPONSE_REMINDER', 'ORDER_PREP_REMINDER', 'ORDER_READY_COURIER', 'ORDER_SCHEDULED_REMINDER',
            'PRODUCT_DECISION_SMS', 'ADMIN_ORDER_REFUND_BLOCKED'] as const;
        const bad: string[] = [];
        for (const type of types) {
            const e = NOTIFICATION_CATALOG[type];
            const variants: Row[] = type === 'PRODUCT_DECISION_SMS'
                ? [{ decision: 'AUTORISE', partner_box: false }, { decision: 'AUTORISE', partner_box: true }, { decision: 'REFUSE' }]
                : type === 'ADMIN_ORDER_REFUND_BLOCKED'
                    ? [{ cashout_status: 'BLOQUE' }, { cashout_status: 'ECHOUE' }, { cashout_status: 'INCERTAIN' }]
                    : [{ mode: 'LIVRAISON' }, { mode: 'RETRAIT' }, { mode: 'SUR_PLACE' }];
            for (const v of variants) {
                const d = { ...e.sample, venue_name: LONG, zone_name: LONG, product_name: LONG, amount: 9_875_000, ...v };
                const text = e.sms!(d as never, { appUrl: 'https://www.event-village.sn' });
                const m = smsSegments(text);
                if (m.encoding !== 'GSM7' || m.segments !== 1) bad.push(`${type} ${JSON.stringify(v)} : ${m.encoding} ${m.segments} — ${text}`);
                if (/\b[A-Z]{2,}_[A-Z_]+\b|null|undefined|NaN/.test(text)) bad.push(`${type} : mot technique — ${text}`);
            }
        }
        assert.deepEqual(bad, []);
    });
});
