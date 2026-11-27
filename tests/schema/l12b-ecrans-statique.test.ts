/**
 * Lot 12b — contrôles sans base des écrans du client et des routes qu'ils appellent.
 *  1. Plus aucune photo de remplacement venue d'un site extérieur (carte des plats, route, écrans des commandes).
 *  2. Code de remise : la route qui le lit ne le laisse jamais en cache (no-store, private) et ne le journalise pas ; les
 *     écrans des commandes n'écrivent jamais dans le stockage du navigateur (localStorage, sessionStorage, IndexedDB,
 *     caches) en direct et ne journalisent rien dans la console ; seul lib/device/device-prefs.ts écrit (audit cvf2b-6).
 *  3. Aucun montant calculé dans le navigateur : aucune multiplication d'un prix par une quantité, aucune somme de prix
 *     dans les écrans des commandes ; le panier gardé sur l'appareil ne porte ni prix ni total.
 *  4. Coquille : le lien « Restaurants et tables » mène à la recherche des établissements (plus d'établissement d'exemple).
 *  5. Modules partagés par les écrans sans dépendance serveur (lib/orders/client-view.ts, lib/orders/menu-types.ts).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const code = (rel: string): string => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/([^:'"`])\/\/.*$/gm, '$1');

function walk(dir: string, out: string[] = []): string[] {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) return out;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel, out);
        else if (/\.(ts|tsx)$/.test(e.name)) out.push(rel);
    }
    return out;
}

/** Écrans du client des commandes (lot 12b). */
const SCREENS = [...walk('components/orders/client'), ...walk('app/orders'), ...walk('app/restaurants/[id]/menu'), 'lib/orders/cart-client.ts']
    .filter((f) => fs.existsSync(path.join(ROOT, f)));

describe('Lot 12b — écrans du client (contrôles sans base)', () => {
    test('écrans présents : carte des plats, suivi, Mes commandes', () => {
        for (const f of ['app/restaurants/[id]/menu/page.tsx', 'app/orders/[id]/page.tsx', 'app/orders/page.tsx']) {
            assert.ok(fs.existsSync(path.join(ROOT, f)), `${f} absent`);
        }
        assert.ok(SCREENS.length >= 6, `écrans trouvés : ${SCREENS.join(', ')}`);
    });

    test('1. aucune photo de remplacement venue d’un site extérieur', () => {
        const files = [...SCREENS, 'app/api/restaurants/[id]/menu/route.ts', 'lib/orders/menu.server.ts'];
        const hits = files.filter((f) => /unsplash|picsum|placeholder\.com|placehold\.co|loremflickr/i.test(read(f)));
        assert.deepEqual(hits, []);
    });

    test('2a. route du code : jamais en cache, jamais journalisé', () => {
        const route = code('app/api/orders/[id]/code/route.ts');
        assert.match(route, /'Cache-Control':\s*'no-store, private/);
        const get = route.slice(route.indexOf('export async function GET'), route.indexOf('export async function POST'));
        assert.ok(get.length > 100, 'GET du code introuvable');
        assert.doesNotMatch(get, /console\./, 'aucune trace dans la console du serveur');
        assert.match(get, /order_code_reveal/);
    });

    test('2b. écrans des commandes : aucune écriture directe dans le stockage du navigateur, aucune trace dans la console', () => {
        const storage = SCREENS.filter((f) => /\b(localStorage|sessionStorage|indexedDB)\b|\bcaches\.open\b/.test(code(f)));
        assert.deepEqual(storage, [], 'stockage du navigateur en direct (passer par lib/device/device-prefs.ts)');
        const consoleLogs = SCREENS.filter((f) => /console\.(log|info|debug)\(/.test(code(f)));
        assert.deepEqual(consoleLogs, []);
    });

    test('3a. aucun montant calculé dans le navigateur', () => {
        const price = /\b(?:price|unitPrice|unit_price|priceDelta|fee|amount|total)\b\s*\*|\*\s*\b(?:quantity|qty)\b|\b(?:quantity|qty)\b\s*\*\s*\w*(?:price|Price)/;
        const sums = /\.reduce\([^)]*(?:price|Price|amount|Amount|total|Total)/;
        const hits = SCREENS.filter((f) => price.test(code(f)) || sums.test(code(f)));
        assert.deepEqual(hits, [], 'calcul d’un montant dans un écran (le devis vient de la base)');
    });

    test('3b. panier gardé sur l’appareil : ni prix, ni total, ni adresse, ni code', () => {
        const prefs = read('lib/device/device-prefs.ts');
        const section = prefs.slice(prefs.indexOf('// ── Lot 12b : panier'));
        assert.ok(section.length > 200, 'section du panier absente');
        const body = section.replace(/^\s*\/\/.*$/gm, '');
        assert.doesNotMatch(body, /\b(price|total|amount|address|phone|code)\b/i);
        // Mise en forme du panier (lib/orders/device-store.ts) : seuls les champs des lignes et le mode sont écrits
        const store = code('lib/orders/device-store.ts');
        assert.doesNotMatch(store.slice(0, store.indexOf('export async function loadPaymentPreference')), /\b(price|total|amount|address|phone|code)\b/i);
        assert.match(store, /return \{ productId: l\.productId, quantity: q, optionIds, notes \};/);
        assert.doesNotMatch(store, /\b(localStorage|sessionStorage)\b/, 'aucune écriture directe');
    });

    test('4. coquille : « Restaurants et tables » mène à /tables', () => {
        const shell = read('components/layout/AppLayout.tsx');
        assert.match(shell, /\{ name: 'Restaurants et tables', href: '\/tables', icon: Utensils, feature: 'tables' \}/);
        assert.doesNotMatch(shell, /rest-terrou-bi/);
    });

    test('5. modules partagés des écrans sans dépendance serveur', () => {
        for (const f of ['lib/orders/client-view.ts', 'lib/orders/menu-types.ts']) {
            assert.doesNotMatch(read(f), /from '(?:next\/server|@\/lib\/supabase\/server|@\/lib\/payments\/cashout\.service|node:)/, f);
        }
        // Les écrans n'importent jamais le module serveur des commandes (CashoutService, NextResponse)
        const server = SCREENS.filter((f) => /'use client'/.test(read(f)) && /from '@\/lib\/orders\/(?:booking|menu\.server|order-payment\.service)'/.test(read(f)));
        assert.deepEqual(server, []);
    });

    test('6. produit « à vérifier » (lot 12c, PRODUCT_UNDER_REVIEW) : phrase simple au devis et à la commande ; archivés exclus de la carte', () => {
        const cart = code('lib/orders/cart-client.ts');
        assert.match(cart, /code === 'PRODUCT_UNDER_REVIEW'\) return UNDER_REVIEW_TEXT/);
        assert.match(read('lib/orders/cart-client.ts'), /'Ce produit est en cours de vérification et ne peut pas être commandé pour l’instant\.'/);
        assert.match(cart, /message: refusalText\(code, d\.error\)/, 'devis');
        assert.match(code('components/orders/client/menu/MenuView.tsx'), /setSubmitError\(refusalText\(data\?\.code, data\?\.error\)\)/, 'commande');
        // Produits retirés (products.archived_at, lot 12c) : exclus de la carte publique et de la lecture REST, sans
        // dépendre de l'existence de la colonne ; le panier et « Commander à nouveau » se recalent sur la carte
        const menu = read('supabase/migrations/20261222000002_l12b_carte_des_plats.sql');
        assert.ok((menu.match(/to_jsonb\((?:pr|products\.\*)\) ->> 'archived_at'\) IS NULL/g) ?? []).length >= 5);
        assert.match(code('lib/orders/cart-client.ts'), /export function reconcileLines/);
        // Information du 12c : il ferme la lecture REST des colonnes review_state, review_words, review_requested_at et
        // archived_at (droits par colonne) ; les écrans du 12b ne lisent jamais les produits par la REST (carte par la route
        // du serveur, order_venue_menu)
        const rest = SCREENS.filter((f) => /\.from\(\s*['"](?:products|product_options|product_daily_portions|product_categories)['"]/.test(code(f)));
        assert.deepEqual(rest, [], 'lecture REST des produits dans un écran');
    });
});
