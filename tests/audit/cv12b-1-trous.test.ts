/**
 * Contre-vérification du lot 12b (commandes : écrans du client) — trous trouvés à la lecture du code, un test par trou.
 * VERT = attaque bloquée ou lecture correcte ; ROUGE = trou (docs/audit-lot12b.md, avec la sortie brute du run). Branche
 * lot12b/cv-rouges, jamais fusionnée. Base LOCALE, faux SamirPay et faux SMS.
 *
 * La branche porte AUSSI les 5 migrations du lot 12c (20261224000001 à 05, copiées à l'identique de main 85a1c85f57) :
 * c'est l'état de la base après la fusion du 12b dans main, où le 12c est déjà.
 *
 *  T1 Lecture REST des suppléments et des portions après le 12c : les règles product_options_read et
 *     product_daily_portions_read du 12b (20261222000002:192-211) lisent la ligne entière du produit (to_jsonb(pr)) dans
 *     une sous-requête, évaluée avec les droits de l'appelant ; le 12c retire à anon et authenticated la lecture des
 *     colonnes review_* et archived_at (20261224000005:571-582). Toute lecture REST des suppléments et des portions
 *     échoue alors (clé anon, client, partenaire propriétaire). La règle products_read (to_jsonb(products.*) sur la
 *     table elle-même) est contrôlée à côté.
 *  T2 Fermeture exceptionnelle (venue_closures) : la carte du 12b la retire des créneaux et de « tout de suite »
 *     (20261222000002:84-96) en disant « la base refait tous les contrôles au devis » ; le devis (order_quote_compute,
 *     12a puis 12c 20261224000003:236-262) ne lit que les horaires (venue_open_covers) : une commande « tout de suite »
 *     ou pour une heure pendant la fermeture est acceptée.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { BASE_URL } from '../parcours/helpers';
import { inspect, openConcurrentClient } from '../helpers/db';
import { GET as menuGet } from '../../app/api/restaurants/[id]/menu/route';
import { POST as createRoute } from '../../app/api/orders/create/route';
import {
    newBuyer, newOption, newPartner, newProduct, newShop, openOrdersService, orderBody, releaseUnpaid, setPortions, userClient,
    type Buyer, type Row, type TestPartner,
} from '../parcours/l12a-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;
let client: Buyer;
let shop: string;

before(async () => {
    restore = await openOrdersService();
    partner = await newPartner('cv12b-t');
    client = await newBuyer('cv12b-t-client');
    shop = await newShop(partner);
});

after(async () => {
    await releaseUnpaid(client.userId);
    await restore();
});

const anon = (): SupabaseClient => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
});
function req(path: string, method: string, token: string | null, body?: unknown): NextRequest {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    return new NextRequest(`${BASE_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function reply(res: Response): Promise<{ status: number; body: Row }> {
    const text = await res.text();
    try {
        return { status: res.status, body: text ? (JSON.parse(text) as Row) : {} };
    } catch {
        return { status: res.status, body: { raw: text } };
    }
}
async function sql<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
    const c = await openConcurrentClient({ applicationName: 'ev-test-cv12b' });
    try {
        const { rows } = await c.query<T>(text, params);
        await c.commit();
        return rows;
    } finally {
        await c.close();
    }
}
const brief = (v: unknown, max = 400): string => {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s.length > max ? `${s.slice(0, max)}…` : s;
};

// ── T1 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('T1 — REST des produits, suppléments et portions avec les droits par colonne du 12c', () => {
    test('clé anon, client et propriétaire : produit, supplément et portions d’un établissement listé lisibles sans erreur', async () => {
        // Témoin : la base porte bien les droits par colonne du 12c
        const grants = await inspect(async (c) => (await c.query<Row>(`
            SELECT has_column_privilege('anon', 'public.products', 'archived_at', 'SELECT') AS anon_archived,
                   has_column_privilege('anon', 'public.products', 'price', 'SELECT') AS anon_price,
                   has_table_privilege('anon', 'public.products', 'SELECT') AS anon_table,
                   (SELECT count(*) FROM pg_policies WHERE tablename IN ('products', 'product_options', 'product_daily_portions')
                       AND qual ILIKE '%to_jsonb%')::int AS policies_whole_row`)).rows[0]);
        console.log(`[CV12B] T1. témoin des droits : ${JSON.stringify(grants)}`);
        assert.equal(grants.anon_archived, false, 'témoin : migrations du 12c présentes (archived_at fermé à anon)');

        const product = await newProduct(partner, shop, { price: 1_200, name: 'Thiéboudienne cv12b', daily: true });
        const option = await newOption(product, 'Piment à part', 100);
        const portions = await setPortions(partner, product, 8);
        assert.equal(portions.ok, true, `portions : ${JSON.stringify(portions)}`);

        const readers: Array<[string, SupabaseClient]> = [
            ['anon', anon()], ['client', userClient(client.accessToken)], ['propriétaire', userClient(partner.accessToken)],
        ];
        const seen: string[] = [];
        const failures: string[] = [];
        for (const [who, db] of readers) {
            const prods = await db.from('products').select('id, name, price, status').eq('id', product);
            const opts = await db.from('product_options').select('id, name, price_delta').eq('id', option);
            const daily = await db.from('product_daily_portions').select('product_id, portions').eq('product_id', product);
            const line = `${who} : products ${prods.error ? `ERREUR « ${prods.error.message} »` : `${prods.data?.length} ligne(s)`} ; `
                + `product_options ${opts.error ? `ERREUR « ${opts.error.message} »` : `${opts.data?.length} ligne(s)`} ; `
                + `product_daily_portions ${daily.error ? `ERREUR « ${daily.error.message} »` : `${daily.data?.length} ligne(s)`}`;
            seen.push(line);
            if (prods.error || prods.data?.length !== 1) failures.push(`${who}/products`);
            if (opts.error || opts.data?.length !== 1) failures.push(`${who}/product_options`);
            if (daily.error || daily.data?.length !== 1) failures.push(`${who}/product_daily_portions`);
        }
        console.log(`[CV12B] T1. lectures REST :\n  ${seen.join('\n  ')}`);
        assert.deepEqual(failures, [], `lectures REST en échec après le 12c :\n  ${seen.join('\n  ')}`);
    });
});

// ── T2 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('T2 — fermeture exceptionnelle : la carte la retire, la base l’ignore', () => {
    test('« tout de suite » et heure choisie pendant une fermeture : refusés à la création, comme la carte le montre', async () => {
        const closedShop = await newShop(partner);
        const product = await newProduct(partner, closedShop, { price: 1_500, name: 'Yassa cv12b' });
        const [closure] = await sql<{ id: string; starts_at: string; ends_at: string }>(`
            INSERT INTO public.venue_closures (venue_id, starts_at, ends_at, reason)
            VALUES ($1, date_trunc('minute', public.hall_dakar_now()) - interval '1 hour', date_trunc('minute', public.hall_dakar_now()) + interval '26 hours', 'Deuil familial (cv12b)')
            RETURNING id, starts_at::text, ends_at::text`, [closedShop]);
        try {
            const menuRes = await reply(await menuGet(req(`/api/restaurants/${closedShop}/menu`, 'GET', null), { params: Promise.resolve({ id: closedShop }) }));
            assert.equal(menuRes.status, 200, brief(menuRes.body));
            const ordering = (menuRes.body.menu as Row).ordering as Row;
            const firstWindow = ((ordering.windows as string[][])[0] ?? [null])[0];
            console.log(`[CV12B] T2. fermeture ${closure.starts_at} → ${closure.ends_at} ; carte : asapAvailable=${String(ordering.asapAvailable)}, `
                + `maintenant ${String(ordering.now)}, première fenêtre proposée ${String(firstWindow)}`);
            assert.equal(ordering.asapAvailable, false, 'témoin : la carte dit « pas tout de suite » pendant la fermeture');

            // Heure au quart d'heure, dans 3 heures (pendant la fermeture, établissement ouvert 24 h sur 24)
            const q = 15 * 60_000;
            const at = new Date(Math.ceil((Date.now() + 3 * 3_600_000) / q) * q).toISOString().slice(0, 16);
            const asap = await reply(await createRoute(req('/api/orders/create', 'POST', client.accessToken,
                orderBody(closedShop, [{ productId: product, quantity: 1 }]))));
            const later = await reply(await createRoute(req('/api/orders/create', 'POST', client.accessToken,
                orderBody(closedShop, [{ productId: product, quantity: 1 }], { scheduledFor: at }))));
            const o = (r: { status: number; body: Row }) => `HTTP ${r.status} ${brief(r.body.order ? { id: (r.body.order as Row).id, state: (r.body.order as Row).state, scheduledFor: (r.body.order as Row).scheduledFor } : r.body)}`;
            console.log(`[CV12B] T2. « tout de suite » pendant la fermeture : ${o(asap)}`);
            console.log(`[CV12B] T2. heure ${at} pendant la fermeture : ${o(later)}`);
            assert.notEqual(asap.status, 201, `commande « tout de suite » acceptée pendant une fermeture exceptionnelle : ${o(asap)}`);
            assert.notEqual(later.status, 201, `commande pour ${at} acceptée pendant une fermeture exceptionnelle : ${o(later)}`);
        } finally {
            await sql(`UPDATE public.venue_closures SET cancelled_at = now() WHERE id = $1`, [closure.id]);
            await releaseUnpaid(client.userId);
        }
    });
});
