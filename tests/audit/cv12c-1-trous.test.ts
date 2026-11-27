/**
 * Contre-vérification du lot 12c — trous trouvés (rouge = trou ouvert, vert = attaque bloquée). Base LOCALE, faux SamirPay et
 * faux SMS ; mise en place par les aides des lots 12a et 12c ; attaques par les routes (jeton de l'attaquant) ou par la
 * REST (clé anon, jeton d'une autre partenaire). Fiches et réglages modifiés remis dans leur état à la fin de chaque test.
 *
 *  T1 « À vérifier » contourné par l'écriture du mot : lettres séparées par des points ou des espaces (« W.H.I.S.K.Y »),
 *     accent décomposé (« Bière » en NFD), espace invisible, lettre cyrillique d'aspect latin, lettres pleine chasse.
 *  T2 Décision de l'administration non liée à ce qu'elle a vu : la partenaire change le texte entre l'affichage de la file
 *     et la décision ; « autoriser » efface la nouvelle demande et rend vendable un texte jamais vérifié.
 *  T3 Liste des mots : un mot ajouté ne s'applique pas aux produits déjà en vente (et la migration ne revoit pas les
 *     produits existants : cv12c-3-statique T3b).
 *  T4 Lecture REST : la clé anon et une autre partenaire lisent l'état « à vérifier », les mots trouvés et l'archivage des
 *     produits d'une partenaire.
 *  T5 Catégorie « Bières » : un produit sans mot de la liste rangé dans une catégorie au nom d'un mot de la liste reste
 *     vendable.
 *  T6 Produit archivé : son statut se change encore (« archivé : il ne se modifie plus »).
 */
import '../helpers/env';
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { BASE_URL } from '../parcours/helpers';
import { newAdmin, type TestAdmin } from '../parcours/notif-helpers';
import { POST as productsPost } from '../../app/api/partner/products/route';
import { PATCH as productPatch, DELETE as productDelete } from '../../app/api/partner/products/[id]/route';
import { POST as productStatus } from '../../app/api/partner/products/[id]/status/route';
import { POST as categoriesPost } from '../../app/api/partner/products/categories/route';
import { POST as regulationPost } from '../../app/api/admin/products/[id]/regulation/route';
import { GET as reviewGet } from '../../app/api/admin/products/review/route';
import { PUT as keywordsPut } from '../../app/api/admin/products/keywords/route';
import {
    newBuyer, newPartner, newShop, openOrdersService, orderBody, partnerAct, placed, releaseUnpaid, service, superadminId, userClient,
    type Buyer, type Row, type TestPartner,
} from '../parcours/l12a-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;
let other: TestPartner;
let client: Buyer;
let reviewer: TestAdmin;
let shop: string;

before(async () => {
    restore = await openOrdersService();
    partner = await newPartner('cv12c');
    other = await newPartner('cv12c-autre');
    client = await newBuyer('cv12c-client');
    reviewer = await newAdmin('cv12c-verif', ['partners.validate']);
    shop = await newShop(partner, { payOnHandover: true });
});

beforeEach(async () => {
    if (client) await releaseUnpaid(client.userId);
});

after(async () => {
    await restore();
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
async function createProduct(body: Row): Promise<Row> {
    const r = await reply(await productsPost(req('/api/partner/products', 'POST', partner.accessToken, body)));
    assert.equal(r.status, 201, `création : ${JSON.stringify(r.body)}`);
    return r.body.product as Row;
}
async function product(id: string): Promise<Row> {
    const { data, error } = await service.from('products').select('*').eq('id', id).maybeSingle();
    assert.equal(error, null, error?.message);
    return (data ?? {}) as Row;
}
async function quote(productId: string): Promise<Row> {
    const { orderInput } = await import('../../lib/orders/booking');
    const { data, error } = await service.rpc('order_quote', { p: orderInput(client.userId, orderBody(shop, [{ productId, quantity: 1 }])) });
    assert.equal(error, null, `order_quote : ${error?.message}`);
    return data as Row;
}

describe('T1 — « à vérifier » contourné par l’écriture du mot', () => {
    test('T1a lettres séparées par des points ou des espaces : « W.H.I.S.K.Y », « W H I S K Y », « C.H.I.C.H.A »', async () => {
        const got: Array<[string, unknown, unknown]> = [];
        for (const name of ['W.H.I.S.K.Y Jack 70 cl', 'W H I S K Y écossais', 'C.H.I.C.H.A menthe']) {
            const p = await createProduct({ venue_id: shop, name, price: 2_000 });
            got.push([name, p.review_state ?? null, (await quote(String(p.id))).code ?? 'VENDABLE']);
        }
        console.log(`[CV12C-T1a] ${JSON.stringify(got)}`);
        assert.deepEqual(got.map(([, s]) => s), ['A_VERIFIER', 'A_VERIFIER', 'A_VERIFIER'], `produits non mis à vérifier : ${JSON.stringify(got)}`);
    });

    test('T1b caractères proches : accent décomposé (NFD), espace invisible, « і » cyrillique, lettres pleine chasse', async () => {
        const cases: Array<[string, string]> = [
            ['Bière en NFD', 'Bière blonde 65 cl'],
            ['espace invisible', 'Whis​ky 12 ans'],
            ['і cyrillique', 'Bіère Gazelle'],
            ['pleine chasse', 'ＷＨＩＳＫＹ Jack'],
        ];
        const got: Array<[string, unknown, unknown]> = [];
        for (const [label, name] of cases) {
            const p = await createProduct({ venue_id: shop, name, price: 2_000 });
            got.push([label, p.review_state ?? null, (await quote(String(p.id))).code ?? 'VENDABLE']);
        }
        console.log(`[CV12C-T1b] ${JSON.stringify(got)}`);
        assert.deepEqual(got.map(([, s]) => s), cases.map(() => 'A_VERIFIER'), `produits non mis à vérifier : ${JSON.stringify(got)}`);
    });
});

describe('T2 — décision liée à ce que l’administration a vu', () => {
    test('texte changé entre l’affichage de la file et « autoriser » : le nouveau texte reste à vérifier', async () => {
        const p = await createProduct({ venue_id: shop, name: 'Bière sans alcool', price: 1_500 });
        const id = String(p.id);
        const queue = await reply(await reviewGet(req('/api/admin/products/review', 'GET', reviewer.accessToken)));
        assert.equal(queue.status, 200, JSON.stringify(queue.body).slice(0, 300));
        // Fiche telle que l'administratrice la voit (la file est limitée aux 200 plus anciennes : relue en base si absente)
        const seen = (queue.body.queue as Row[]).find((x) => x.id === id) ?? { requestedAt: (await product(id)).review_requested_at };
        // La partenaire change le texte pendant que l'administratrice lit la fiche
        const changed = await reply(await productPatch(req(`/api/partner/products/${id}`, 'PATCH', partner.accessToken,
            { name: 'Whisky 12 ans d’âge', description: 'Bouteille de 70 cl' }), params({ id })));
        assert.equal(changed.status, 200, JSON.stringify(changed.body));
        assert.equal((await product(id)).review_state, 'A_VERIFIER', 'précondition : nouveau texte à vérifier');
        // Décision prise sur la fiche affichée (« Bière sans alcool ») ; la route ne reçoit aucune version de ce qui a été vu
        const decided = await reply(await regulationPost(req(`/api/admin/products/${id}/regulation`, 'POST', reviewer.accessToken, {
            regulated: false, reason: 'Boisson sans alcool vérifiée', reviewedAt: seen.requestedAt ?? null, reviewedName: 'Bière sans alcool',
        }), params({ id })));
        const after = await product(id);
        const q = await quote(id);
        console.log(`[CV12C-T2] décision ${decided.status} ${JSON.stringify(decided.body)} ; produit ${JSON.stringify({ name: after.name, review_state: after.review_state, regulated_admin: after.regulated_admin })} ; devis ${q.ok === true ? 'VENDABLE' : String(q.code)}`);
        assert.notEqual(q.ok, true, `« ${String(after.name)} » vendable en ligne sans que l’administration ait vu ce texte (décision HTTP ${decided.status})`);
    });
});

describe('T3 — liste des mots et produits déjà en vente', () => {
    test('un mot ajouté (« flag ») : le produit « Flag spéciale 33 cl » déjà en vente devient à vérifier', async () => {
        const superadmin = await superadminId();
        const { data: before } = await service.from('platform_settings').select('value').eq('key', 'orders.review_keywords').single();
        const original = (before!.value as { value: string[] }).value;
        try {
            const p = await createProduct({ venue_id: shop, name: 'Flag spéciale 33 cl', price: 1_000 });
            const id = String(p.id);
            assert.equal((await quote(id)).ok, true, 'précondition : vendable');
            const sa = await newAdmin('cv12c-super', [], { role: 'SUPERADMIN' });
            const put = await reply(await keywordsPut(req('/api/admin/products/keywords', 'PUT', sa.accessToken,
                { keywords: [...original, 'flag'], reason: 'Marque de bière ajoutée (contre-vérification 12c)' })));
            assert.equal(put.status, 200, JSON.stringify(put.body));
            const after = await product(id);
            const q = await quote(id);
            console.log(`[CV12C-T3] après ajout de « flag » : ${JSON.stringify({ review_state: after.review_state, devis: q.ok === true ? 'VENDABLE' : q.code })}`);
            assert.notEqual(q.ok, true, '« Flag spéciale 33 cl » toujours vendable en ligne après l’ajout du mot « flag »');
        } finally {
            const { error } = await service.rpc('order_review_keywords_set', { p_value: { value: original }, p_actor: superadmin, p_reason: 'Fin de la contre-vérification 12c' });
            assert.equal(error, null, error?.message);
        }
    });
});

describe('T4 — lecture REST de l’état de vérification et de l’archivage', () => {
    test('clé anon et autre partenaire : ni l’état « à vérifier », ni les mots trouvés, ni l’archivage d’un produit d’autrui', async () => {
        const p = await createProduct({ venue_id: shop, name: 'Bière pression 50 cl', price: 1_500 });
        const id = String(p.id);
        assert.equal(p.review_state, 'A_VERIFIER');
        const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
        const seen: Row = {};
        for (const [who, c] of [['anon', anon], ['autre partenaire', userClient(other.accessToken)]] as const) {
            const { data, error } = await c.from('products').select('id, review_state, review_words, review_requested_at, archived_at').eq('id', id);
            seen[who] = error ? `refus : ${error.message}` : data;
        }
        console.log(`[CV12C-T4] ${JSON.stringify(seen)}`);
        for (const [who, v] of Object.entries(seen)) {
            const rows = Array.isArray(v) ? (v as Row[]) : [];
            assert.ok(!rows.some((r) => r.review_state !== undefined || r.review_words !== undefined), `${who} lit l’état et les mots de vérification : ${JSON.stringify(v)}`);
        }
    });
});

describe('T5 — catégorie au nom d’un mot de la liste', () => {
    test('« Flag 33 cl » rangé dans la catégorie « Bières et alcools » : à vérifier (ou refusé au devis)', async () => {
        const cat = await reply(await categoriesPost(req('/api/partner/products/categories', 'POST', partner.accessToken, { name: 'Bières et alcools' })));
        assert.ok(cat.status === 201 || cat.status === 200, JSON.stringify(cat.body));
        const categoryId = String((cat.body.category as Row).id);
        const p = await createProduct({ venue_id: shop, name: 'Flag 33 cl', price: 1_000, category_id: categoryId });
        const q = await quote(String(p.id));
        console.log(`[CV12C-T5] ${JSON.stringify({ review_state: p.review_state ?? null, devis: q.ok === true ? 'VENDABLE' : q.code })}`);
        assert.notEqual(q.ok, true, 'produit de la catégorie « Bières et alcools » vendable en ligne sans vérification');
    });
});

describe('T6 — produit archivé', () => {
    test('le statut d’un produit archivé ne se change plus', async () => {
        const p = await createProduct({ venue_id: shop, name: 'Dibi mouton', price: 5_000 });
        const id = String(p.id);
        const orderId = await placed(client, orderBody(shop, [{ productId: id, quantity: 1 }], { mode: 'SUR_PLACE', onsiteLabel: 'Comptoir', payment: 'DIFFERE' }));
        try {
            const arch = await reply(await productDelete(req(`/api/partner/products/${id}`, 'DELETE', partner.accessToken), params({ id })));
            assert.deepEqual([arch.status, arch.body.outcome], [200, 'ARCHIVED'], JSON.stringify(arch.body));
            const s = await reply(await productStatus(req(`/api/partner/products/${id}/status`, 'POST', partner.accessToken, { status: 'SUSPENDU' }), params({ id })));
            const after = await product(id);
            console.log(`[CV12C-T6] statut d’un archivé : HTTP ${s.status} ${JSON.stringify(s.body).slice(0, 160)} ; statut en base ${String(after.status)}`);
            assert.equal(after.status, 'DISPONIBLE', `statut d’un produit archivé changé (HTTP ${s.status})`);
            assert.ok(s.status >= 400, `changement de statut d’un archivé accepté (HTTP ${s.status})`);
        } finally {
            await partnerAct(partner, orderId, { action: 'REFUSER', reason: 'Fin de la contre-vérification 12c' });
        }
    });
});
