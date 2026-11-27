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

    test('4 bis. paiement depuis le suivi : jamais une part hors du schéma de la route (run 745 : « PREMIER » refusé)', () => {
        const panel = code('components/orders/client/tracking/OrderPayPanel.tsx');
        assert.doesNotMatch(panel, /part: 'PREMIER'\s*[,}]|operator, payerPhone, part,/);
        assert.match(panel, /part === 'SOLDE' \? \{ part: 'SOLDE' \} : \{ expectedAmount: amount \}/);
        assert.match(read('lib/validations/payment.ts'), /part: z\.enum\(\['ACOMPTE', 'SOLDE', 'INTEGRAL'\]\)\.optional\(\)/);
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
        // Produits retirés (products.archived_at, lot 12c) : exclus de la carte publique (colonne lue directement : migration
        // renommée après le 12c) et de la lecture REST (aide product_public) ; le panier et « Commander à nouveau » se
        // recalent sur la carte
        const menu = read('supabase/migrations/20261226000002_l12b_carte_des_plats.sql');
        assert.ok((menu.match(/pr\.archived_at IS NULL/g) ?? []).length >= 3);
        assert.doesNotMatch(menu, /to_jsonb\((?:pr|z|products\.\*)\)/, 'plus de lecture de la ligne entière');
        assert.match(code('lib/orders/cart-client.ts'), /export function reconcileLines/);
        // Information du 12c : il ferme la lecture REST des colonnes review_state, review_words, review_requested_at et
        // archived_at (droits par colonne) ; les écrans du 12b ne lisent jamais les produits par la REST (carte par la route
        // du serveur, order_venue_menu)
        const rest = SCREENS.filter((f) => /\.from\(\s*['"](?:products|product_options|product_daily_portions|product_categories)['"]/.test(code(f)));
        assert.deepEqual(rest, [], 'lecture REST des produits dans un écran');
    });
});

// ── Correctifs après contre-vérification : idées 8 à 13 (expérience du client) ───────────────────────────────────────

describe('Lot 12b, correctifs après contre-vérification — idées 8 à 13 (contrôles sans base)', () => {
    const quoteOf = (unit: number, total: number, deliveryFee = 0) => ({
        lines: [{ productId: 'p1', name: 'Yassa poulet', quantity: 2, unitPrice: unit, totalPrice: 0, options: [] }],
        zoneName: null, itemsAmount: 0, deliveryFee, goodsTotal: 0, depositPercent: null, serviceFee: 290, total, toPayNow: total, balanceDue: 0,
        scheduledFor: null, asap: true,
    });

    test('8. prix changé : ancien et nouveau prix ligne par ligne, tels que servis par les deux devis ; un bouton « Commander à <total> »', async () => {
        const { priceChanges } = await import('../../lib/orders/cart-client');
        const change = priceChanges(quoteOf(2_700, 5_800), quoteOf(2_900, 6_090, 500));
        assert.deepEqual(change, {
            lines: [{ name: 'Yassa poulet', quantity: 2, before: 2_700, after: 2_900 }, { name: 'Livraison', quantity: 1, before: 0, after: 500 }],
            totalBefore: 5_800, totalAfter: 6_090,
        });
        const panel = code('components/orders/client/menu/CartPanel.tsx');
        assert.match(panel, /`Commander à \$\{formatFcfa\(quote\.quote\.total\)\}`/, 'bouton au total du NOUVEAU devis');
        assert.match(panel, /data-testid="prix-change"/);
        const view = code('components/orders/client/menu/MenuView.tsx');
        assert.match(view, /setChangedFrom\(shown\);/, 'devis affiché gardé pour la comparaison');
        assert.match(view, /data\?\.code === 'ORDER_PRICE_CHANGED'/);
    });

    test('9. fermeture exceptionnelle annoncée sur la carte, premier créneau proposé (heure servie par la base)', async () => {
        const { closureText } = await import('../../lib/orders/cart-client');
        assert.equal(closureText('2026-11-28T18:00', '2026-11-27'), 'Fermé exceptionnellement jusqu’au 28/11 à 18 h — commandez pour plus tard');
        assert.equal(closureText('2026-11-27T18:30', '2026-11-27'), 'Fermé exceptionnellement jusqu’à 18 h 30 — commandez pour plus tard');
        const sql = read('supabase/migrations/20261226000002_l12b_carte_des_plats.sql');
        assert.match(sql, /'closed_until', to_char\(v_closed_until, 'YYYY-MM-DD"T"HH24:MI'\)/);
        // Alignée sur le devis du 12c (VENUE_CLOSED : fermeture qui touche [t - préparation, t + 1 min)) : chaque fermeture
        // est retirée des heures proposées jusqu'à sa fin plus la préparation ; « tout de suite » aux mêmes bornes
        assert.match(sql, /range_agg\(tsrange\(c\.starts_at, c\.ends_at \+ make_interval\(mins => v_prep\), '\[\)'\)\)/);
        assert.match(sql, /venue_closed_during\(v\.id, tsrange\(v_now, v_now \+ make_interval\(mins => v_prep \+ 2\), '\[\)'\)\)/);
        assert.match(code('components/orders/client/menu/MenuView.tsx'), /closureText\(menu\.ordering\.closedUntil, today\)/);
        assert.match(code('components/orders/client/menu/MenuHeader.tsx'), /menu\.ordering\.closedUntil \? \(\s*<Badge variant="warning">Fermé exceptionnellement<\/Badge>/, 'jamais « Ouvert maintenant » pendant une fermeture');
    });

    test('10. heure estimée avant de payer et dans Mes commandes : « Prête vers 13 h 05 », « Livrée vers 13 h 25 » (heure de la base)', async () => {
        const { etaLabel } = await import('../../lib/orders/client-view');
        assert.equal(etaLabel('RETRAIT', '2026-11-27T13:05:00+00:00', '2026-11-27'), 'Prête vers 13 h 05');
        assert.equal(etaLabel('LIVRAISON', '2026-11-27T13:25:00Z', '2026-11-27'), 'Livrée vers 13 h 25');
        assert.equal(etaLabel('SUR_PLACE', '2026-11-28T20:00:00+00:00', '2026-11-27'), 'Servie demain vers 20 h');
        assert.equal(etaLabel('RETRAIT', '2026-11-29T12:15:00Z', '2026-11-27'), 'Prête dimanche 29 novembre vers 12 h 15');
        assert.equal(etaLabel('RETRAIT', null, '2026-11-27'), null);
        assert.match(code('components/orders/client/menu/CartPanel.tsx'), /etaLabel\(mode, quote\.scheduledFor, today\)/, 'panier : heure du devis');
        assert.match(code('app/orders/page.tsx'), /etaLabel\(order\.mode, order\.estimatedAt,/, 'Mes commandes : heure de la commande');
    });

    test('11. « Montrer au comptoir » : très grand, écran allumé, retour automatique, aucune copie ; lien de l’avis « commande prête »', () => {
        const counter = code('components/orders/client/tracking/CounterCode.tsx');
        assert.match(counter, /wakeLock/);
        assert.match(counter, /\.release\(\)/, 'écran rendu à la fermeture');
        assert.match(counter, /AUTO_RETURN_S = 90/);
        assert.match(counter, /select-none/);
        assert.match(counter, /onCopy=\{block\}/);
        assert.doesNotMatch(counter, /clipboard|navigator\.share|localStorage|sessionStorage|router\.|searchParams|console\./, 'ni copie, ni stockage, ni adresse, ni console');
        assert.match(read('lib/notifications/catalog.ts'), /text\(d, 'mode'\) === 'RETRAIT' \? `\$\{orderLink\(d\)\}\?comptoir=1` : orderLink\(d\)/);
        assert.match(read('app/orders/[id]/page.tsx'), /if \(q\.comptoir === '1'\) return 'comptoir';/);
        assert.match(code('components/orders/client/tracking/OrderTracking.tsx'), /counterOnLoad=\{intent === 'comptoir'\}/);
    });

    test('12. solde en un geste depuis l’avis « commande acceptée » : lien vers le panneau du solde, montant relu en base', () => {
        assert.match(read('lib/notifications/catalog.ts'), /num\(d, 'balance_due'\) > 0 \? `\$\{orderLink\(d\)\}\?payer=solde` : orderLink\(d\)/);
        const tracking = code('components/orders/client/tracking/OrderTracking.tsx');
        assert.match(tracking, /intent !== 'solde'/);
        assert.match(tracking, /setPayBalance\(true\)/);
        // Le montant du panneau vient de la commande relue (order.amounts), jamais de l'adresse
        assert.match(tracking, /part="SOLDE" amount=\{a\.balanceDue\}/);
        assert.match(read('app/orders/[id]/page.tsx'), /if \(q\.payer === 'solde'\) return 'solde';/);
    });

    test('13. visuels dessinés par catégorie, fichiers locaux, choisis par le serveur', async () => {
        const { DISH_VISUALS, dishVisual, dishVisualSrc } = await import('../../lib/orders/dish-visual');
        assert.equal(dishVisual('Boissons', 'Bissap'), 'boisson');
        assert.equal(dishVisual('Desserts', 'Thiakry'), 'dessert');
        assert.equal(dishVisual('Plats', 'Thiéboudienne du jour'), 'poisson');
        assert.equal(dishVisual('Grillades', 'Dibi'), 'grillade');
        assert.equal(dishVisual(null, 'Mafé'), 'plat');
        for (const v of DISH_VISUALS) {
            const file = `public${dishVisualSrc(v)}`;
            assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} absent`);
            const svg = read(file);
            assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
            assert.doesNotMatch(svg.replace('http://www.w3.org/2000/svg', ''), /<script|href=|url\(|https?:\/\//, `${file} : rien d’extérieur ni de script`);
        }
        assert.match(code('lib/orders/menu.server.ts'), /visuals: Object\.fromEntries\(rows\(d\.products\)\.map\(\(r\) => \[String\(r\.id\), dishVisual\(/);
        assert.match(code('components/orders/client/menu/ProductVisual.tsx'), /dishVisualSrc\(visual\)/);
        // La fiche d'un plat garde exactement ses champs (audit cv12b-2 G6) : le visuel est servi à part (menu.visuals)
        assert.doesNotMatch(read('lib/orders/menu-types.ts').slice(0, read('lib/orders/menu-types.ts').indexOf('export interface MenuZone')), /\bvisual:/);
    });
});
