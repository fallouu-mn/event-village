/**
 * Lot 12b — faille de l'existant : la règle REST products_read (0003_rls.sql:237-238, jamais redéfinie avant ce lot)
 * laissait lire avec la clé anon tout produit DISPONIBLE, même d'une partenaire suspendue, d'un établissement suspendu ou
 * sans établissement ; suppléments (product_options_read) et portions (product_daily_portions_read) suivaient.
 * Attendu (migration 20261222000002) : produits, suppléments et portions d'un établissement listé seulement (actif,
 * validé, partenaire VALIDE), plus la partenaire propriétaire et l'administration.
 * Suite à part : rouge sur main (branche de preuve lot12b/rouges), verte avec le lot.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { decideVenue } from './l11a-helpers';
import {
    newBuyer, newOption, newPartner, newProduct, newShop, openOrdersService, service, setPortions, userClient, type Buyer, type TestPartner,
} from './l12a-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;
let stranger: Buyer;
let shop: string;

before(async () => {
    restore = await openOrdersService();
    partner = await newPartner('l12b-rest');
    stranger = await newBuyer('l12b-rest-autre');
    shop = await newShop(partner);
});

after(async () => {
    await restore();
});

const anon = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
async function setPartnerStatus(p: TestPartner, status: 'VALIDE' | 'SUSPENDU'): Promise<void> {
    const { error } = await service.from('partners').update({ status }).eq('id', p.partnerId);
    assert.equal(error, null, error?.message);
}

// ── B. REST des produits ──────────────────────────────────────────────────────────────────────────────────────────

describe('REST des produits (clé anon et autre compte)', () => {
    test('établissement listé seulement ; rien d’une partenaire suspendue, d’un établissement suspendu ni sans établissement ; la propriétaire lit les siens', async () => {
        const listed = await newProduct(partner, shop, { price: 1_000, name: 'Listé l12b' });
        const listedOpt = await newOption(listed, 'Sauce', 100);
        const suspendedShop = await newShop(partner);
        const inSuspended = await newProduct(partner, suspendedShop, { price: 1_000, name: 'Établissement suspendu l12b' });
        const optSuspended = await newOption(inSuspended, 'Sauce', 100);
        assert.equal((await decideVenue(suspendedShop, 'SUSPENDRE', 'Contrôle d’hygiène en cours.')).ok, true);
        const { data: legacy, error: legErr } = await service.from('products').insert({ partner_id: partner.partnerId, name: 'Sans établissement l12b', price: 900, status: 'DISPONIBLE' }).select('id').single();
        assert.equal(legErr, null, legErr?.message);
        const other = await newPartner('l12b-rest-susp');
        const otherShop = await newShop(other);
        const ofSuspended = await newProduct(other, otherShop, { price: 1_000, name: 'Partenaire suspendue l12b', daily: true });
        await setPortions(other, ofSuspended, 5);
        await setPartnerStatus(other, 'SUSPENDU');
        try {
            const a = anon();
            const ids = [listed, inSuspended, String(legacy!.id), ofSuspended];
            const { data: prods, error } = await a.from('products').select('id').in('id', ids);
            assert.equal(error, null, error?.message);
            assert.deepEqual((prods ?? []).map((p) => p.id), [listed], 'seul le produit d’un établissement listé');
            const { data: opts } = await a.from('product_options').select('id').in('id', [listedOpt, optSuspended]);
            assert.deepEqual((opts ?? []).map((o) => o.id), [listedOpt]);
            const { data: portions } = await a.from('product_daily_portions').select('product_id').eq('product_id', ofSuspended);
            assert.deepEqual(portions ?? [], [], 'portions d’une partenaire suspendue');
            // Autre compte connecté : même chose
            const { data: asStranger } = await userClient(stranger.accessToken).from('products').select('id').in('id', ids);
            assert.deepEqual((asStranger ?? []).map((p) => p.id), [listed]);
            // Propriétaire : ses produits, établissement suspendu compris
            const { data: mine } = await userClient(partner.accessToken).from('products').select('id').in('id', [listed, inSuspended, String(legacy!.id)]);
            assert.deepEqual((mine ?? []).map((p) => p.id).sort(), [listed, inSuspended, String(legacy!.id)].sort());
        } finally {
            await setPartnerStatus(other, 'VALIDE');
        }
    });
});

