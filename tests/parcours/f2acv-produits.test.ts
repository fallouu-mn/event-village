/**
 * Correctifs de la contre-vérification de la finition 2a, R2 — ProductService (service fermé par interrupteur, faille
 * réelle) : liste blanche des champs à la création et à la modification, partner_id toujours celui de la session, statut
 * jamais pris du corps.
 *  a. Création : partner_id d'une autre organisatrice, statut, identifiant, date de création dans le corps : refusés
 *     (FIELD_NOT_EDITABLE), aucun produit écrit ; champs de la liste blanche : produit de la session, statut DISPONIBLE.
 *  b. Modification : partner_id, statut, identifiant dans le corps : refusés, produit inchangé ; champ de la liste
 *     blanche appliqué ; catégorie d'une autre organisatrice refusée.
 *  c. Le statut ne change que par setProductStatus (route POST /api/partner/products/[id]/status).
 * Rouge avant le correctif : le corps était recopié tel quel (produit créé chez l'autre organisatrice, statut pris du
 * corps). Sortie brute `[F2ACV-R2]`.
 */
import '../helpers/env';
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { service } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { ProductService } from '../../lib/products/product.service';

// Corps de requête quelconque (avant le correctif, les signatures étaient typées : preuve des rouges sans erreur de typage)
type CreateBody = Parameters<typeof ProductService.createProduct>[1];
type UpdateBody = Parameters<typeof ProductService.updateProduct>[2];
type StatusValue = Parameters<typeof ProductService.setProductStatus>[2];

let A: TestPartner;
let B: TestPartner;

before(async () => {
    A = await newPartner('f2acv-produits-a');
    B = await newPartner('f2acv-produits-b');
});

async function outcome(fn: () => Promise<unknown>): Promise<string> {
    try {
        await fn();
        return 'accepté';
    } catch (err) {
        return (err as { code?: string }).code ?? (err instanceof Error ? err.message : String(err));
    }
}

async function productsOf(partnerId: string, name: string): Promise<number> {
    const { count, error } = await service.from('products').select('id', { count: 'exact', head: true }).eq('partner_id', partnerId).eq('name', name);
    assert.equal(error, null, error?.message);
    return count ?? 0;
}

describe('a. création : liste blanche, partenaire de la session', () => {
    test('partner_id, statut, identifiant, date de création dans le corps : refusés ; sinon produit de la session, DISPONIBLE', async () => {
        const name = `Produit R2 ${randomUUID().slice(0, 8)}`;
        const attempts: Array<[string, Record<string, unknown>]> = [
            ['partner_id d’une autre', { name, price: 1000, partner_id: B.partnerId }],
            ['statut', { name, price: 1000, status: 'SUSPENDU' }],
            ['identifiant', { name, price: 1000, id: randomUUID() }],
            ['date de création', { name, price: 1000, created_at: '2020-01-01T00:00:00Z' }],
        ];
        const results: string[] = [];
        for (const [label, body] of attempts) {
            const r = await outcome(() => ProductService.createProduct(A.userId, body as unknown as CreateBody));
            console.log(`[F2ACV-R2] création avec ${label} → ${r}`);
            results.push(r);
        }
        assert.deepEqual(results, attempts.map(() => 'FIELD_NOT_EDITABLE'));
        assert.deepEqual([await productsOf(A.partnerId, name), await productsOf(B.partnerId, name)], [0, 0], 'produit écrit malgré le refus');
        const created = await ProductService.createProduct(A.userId, { name, price: 1500, is_stock_managed: false } as unknown as CreateBody);
        console.log(`[F2ACV-R2] création permise → ${JSON.stringify({ partner_id: created.partner_id, status: created.status })}`);
        assert.deepEqual([created.partner_id, created.status], [A.partnerId, 'DISPONIBLE']);
    });
});

describe('b, c. modification et statut', () => {
    test('partner_id, statut, identifiant refusés ; prix appliqué ; catégorie d’une autre refusée ; statut par setProductStatus', async () => {
        const p = await ProductService.createProduct(A.userId, { name: `Produit R2 modif ${randomUUID().slice(0, 8)}`, price: 1000 } as unknown as CreateBody);
        const before = JSON.stringify((await service.from('products').select('partner_id, status, price, name').eq('id', p.id).single()).data);
        const otherCategory = await ProductService.createCategory(B.userId, { name: `Catégorie B ${Date.now()}` });
        const results: Array<[string, string]> = [];
        for (const [label, body] of [
            ['partner_id', { partner_id: B.partnerId }],
            ['statut', { status: 'SUSPENDU' }],
            ['identifiant', { id: randomUUID() }],
            ['catégorie d’une autre', { category_id: otherCategory.id }],
        ] as Array<[string, Record<string, unknown>]>) {
            const r = await outcome(() => ProductService.updateProduct(p.id, A.userId, body as unknown as UpdateBody));
            console.log(`[F2ACV-R2] modification avec ${label} → ${r}`);
            results.push([label, r]);
        }
        assert.deepEqual(results.map(([, r]) => r), ['FIELD_NOT_EDITABLE', 'FIELD_NOT_EDITABLE', 'FIELD_NOT_EDITABLE', 'CATEGORY_NOT_FOUND']);
        const after = JSON.stringify((await service.from('products').select('partner_id, status, price, name').eq('id', p.id).single()).data);
        assert.equal(after, before, 'produit changé malgré le refus');
        const priced = await ProductService.updateProduct(p.id, A.userId, { price: 2500 } as unknown as UpdateBody);
        assert.equal(Number(priced.price), 2500, 'prix (liste blanche) non appliqué');
        const off = await ProductService.setProductStatus(p.id, A.userId, 'INDISPONIBLE' as unknown as StatusValue);
        assert.equal(off.status, 'INDISPONIBLE', 'statut par la route de statut');
        assert.equal(await outcome(() => ProductService.setProductStatus(p.id, A.userId, 'EPUISE_PAR_LE_CORPS' as unknown as StatusValue)), 'INVALID_STATUS');
        const other = await outcome(() => ProductService.updateProduct(p.id, B.userId, { price: 1 } as unknown as UpdateBody));
        assert.equal(other, 'PRODUCT_NOT_FOUND', 'produit d’une autre modifié');
    });
});
