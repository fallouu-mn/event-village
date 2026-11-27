/**
 * Contre-vérification du lot 12b — contrôles SANS BASE (stockage de l'appareil, sources des écrans, recopie SQL).
 * Rouge = trou ; vert = garde-fou en place.
 *
 *  T3 Panier gardé sur l'appareil (lib/device/device-prefs.ts, clé « event-village:appareil:panier:<établissement> ») :
 *     produits, suppléments et NOTE LIBRE par plat, 24 h. Effacé au bouton « Se déconnecter » et sur SIGNED_OUT
 *     (clearDevicePrefs()), mais PAS quand la page se charge sans session (session close à l'insu du navigateur,
 *     cvf2b 6.5) : AuthProvider n'y appelle que clearDevicePrefs('paiement'), qui ne connaît pas le préfixe du panier
 *     (mêmes précédents : CV 11b T5, CV 11c-b T3). L'inventaire de cvf2b-6 (13, clés liées au compte) décrit encore
 *     device-prefs.ts comme « opérateur et numéro de paiement, recherches récentes » : le panier n'y est pas.
 *  S1 Aucun écran du 12b ne lit products (ni options, ni portions) par la REST, ni les colonnes review_* ou archived_at.
 *  S2 Code de remise : jamais dans le stockage du navigateur, l'adresse de la page ni la console.
 *  S3 Refus des fonctions du 12b : chacun porte un message en français simple ; l'écran montre ce message, jamais le
 *     code du refus (PRODUCT_UNDER_REVIEW a sa phrase).
 *  S4 private.order_issue_code (20261222000001) : recopie exacte de 20261130000006:281-299, plus le seul bloc du 12b.
 */
import '../helpers/env';
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { clearDevicePrefs, DEVICE_PREFS_PREFIX } from '../../lib/device/device-prefs-purge';
import { ORDER_CART_PREFIX, saveOrderCart } from '../../lib/device/device-prefs';
import { refusalText } from '../../lib/orders/cart-client';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
function walk(rel: string): string[] {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) return [];
    if (fs.statSync(abs).isFile()) return [rel];
    return fs.readdirSync(abs).flatMap((f) => walk(path.join(rel, f)));
}

class MemoryStorage {
    private m = new Map<string, string>();
    get length() { return this.m.size; }
    key(i: number) { return [...this.m.keys()][i] ?? null; }
    getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
    setItem(k: string, v: string) { this.m.set(k, String(v)); }
    removeItem(k: string) { this.m.delete(k); }
    keys() { return [...this.m.keys()]; }
}
const g = globalThis as unknown as { window?: unknown };
afterEach(() => { delete g.window; });

const SCREENS = [
    ...walk('components/orders/client'), ...walk('app/orders'), ...walk('app/restaurants/[id]/menu'),
    'lib/orders/cart-client.ts', 'lib/orders/client-view.ts', 'lib/orders/device-store.ts', 'lib/orders/menu-types.ts', 'lib/orders/menu.server.ts',
    'app/api/restaurants/[id]/menu/route.ts', 'app/api/orders/route.ts',
].filter((f) => /\.(tsx?|mjs)$/.test(f));

describe('T3 — panier gardé et purge sans session (cvf2b 6.5)', () => {
    test('page chargée sans session : le panier (notes libres par plat) est effacé comme le numéro de paiement', () => {
        const storage = new MemoryStorage();
        g.window = { localStorage: storage, sessionStorage: new MemoryStorage() };
        const venue = '5b0e2f7a-1c3d-4e5f-8a9b-0c1d2e3f4a5b';
        assert.equal(saveOrderCart(venue, {
            at: Date.now(), mode: 'LIVRAISON',
            lines: [{ productId: '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f', quantity: 2, optionIds: [], notes: 'Sans piment, pour Fatou (diabétique), appeler le 77 123 45 67' }],
        }), true, 'panier gardé');
        storage.setItem(`${DEVICE_PREFS_PREFIX}paiement`, JSON.stringify({ operator: 'WAVE', phone: '771234567' }));
        const before = storage.keys();

        const auth = strip(read('components/providers/AuthProvider.tsx'));
        const silent = /event === 'INITIAL_SESSION'[\s\S]*?\{([\s\S]*?)\n\s*\}/.exec(auth)?.[1] ?? '';
        const silentScope = /clearDevicePrefs\('([a-z]+)'\)/.exec(silent)?.[1] ?? (/clearDevicePrefs\(\)/.test(silent) ? 'tout' : 'absent');
        clearDevicePrefs(silentScope === 'tout' ? 'tout' : 'paiement');
        const left = storage.keys();
        const classed = /'lib\/device\/device-prefs\.ts': \{ what: '([^']+)'/.exec(read('tests/audit/cvf2b-6-deconnexion.test.ts'))?.[1] ?? '';
        console.log(`[CV12B] T3. purge du chemin sans session : clearDevicePrefs('${silentScope}') ; clés avant ${JSON.stringify(before)} ; après ${JSON.stringify(left)} ; `
            + `panier restant : ${JSON.stringify(left.filter((k) => k.startsWith(ORDER_CART_PREFIX)).map((k) => storage.getItem(k)))} ; classement de device-prefs.ts dans cvf2b-6 : « ${classed} »`);
        assert.ok(!left.includes(`${DEVICE_PREFS_PREFIX}paiement`), 'témoin : le numéro de paiement est effacé sur ce chemin');
        assert.ok(ORDER_CART_PREFIX.startsWith(DEVICE_PREFS_PREFIX), 'témoin : panier sous le préfixe effacé au bouton');
        assert.deepEqual(left.filter((k) => k.startsWith(ORDER_CART_PREFIX)), [], 'panier (notes libres) gardé après une session close à l’insu du navigateur');
        assert.match(classed, /panier/i, 'inventaire de cvf2b-6 : le panier gardé par device-prefs.ts n’y est pas décrit');
    });
});

describe('S1-S4 — garde-fous sans base', () => {
    test('S1. aucun écran du 12b ne lit products, product_options ni product_daily_portions par la REST, ni review_* / archived_at', () => {
        assert.ok(SCREENS.length > 15, `fichiers des écrans trouvés : ${SCREENS.length}`);
        const hits = SCREENS.flatMap((f) => {
            const s = strip(read(f));
            return [
                ...[...s.matchAll(/\.from\(\s*['"`](products|product_options|product_daily_portions)['"`]\s*\)/g)].map((m) => `${f} : from('${m[1]}')`),
                ...[...s.matchAll(/\b(review_state|review_words|review_note|review_requested_at|review_cleared_words|archived_at)\b/g)].map((m) => `${f} : ${m[1]}`),
                ...(/\/rest\/v1\/products/.test(s) ? [`${f} : /rest/v1/products`] : []),
            ];
        });
        console.log(`[CV12B] S1. ${SCREENS.length} fichiers ; lectures trouvées : ${JSON.stringify(hits)}`);
        assert.deepEqual(hits, []);
    });

    test('S2. code de remise : jamais dans le stockage, l’adresse ni la console', () => {
        const s = strip(read('components/orders/client/tracking/HandoverCode.tsx'));
        const bad = [
            /localStorage|sessionStorage|indexedDB|caches\./.test(s) && 'stockage du navigateur',
            /router\.(push|replace)|history\.(push|replace)State|searchParams/.test(s) && 'adresse de la page',
            /console\.\w+\([^)]*[,(]\s*(?:code|value|body)\s*[,)]/.test(s) && 'console',
        ].filter(Boolean);
        const tracking = strip(read('components/orders/client/tracking/OrderTracking.tsx')) + strip(read('components/orders/client/tracking/order-view.ts'));
        const viewCarriesCode = /code\s*:\s*str\(|\.code\.value|code:\s*nonEmptyString/.test(tracking);
        console.log(`[CV12B] S2. HandoverCode : ${JSON.stringify(bad)} ; vue de suivi qui porterait le code : ${viewCarriesCode}`);
        assert.deepEqual(bad, []);
        assert.equal(viewCarriesCode, false);
    });

    test('S3. chaque refus des fonctions du 12b porte un message ; l’écran montre le message, jamais le code', () => {
        const files = ['20261222000001_l12b_code_visible.sql', '20261222000002_l12b_carte_des_plats.sql', '20261222000003_l12b_garde_prix.sql'];
        const missing: string[] = [];
        let refusals = 0;
        for (const f of files) {
            const s = read(`supabase/migrations/${f}`);
            for (const m of s.matchAll(/jsonb_build_object\('ok', false, 'code', '([A-Z_]+)'([^;]*)/g)) {
                refusals += 1;
                if (!/'message', '[^']*[a-zé]/.test(m[2])) missing.push(`${f} : ${m[1]}`);
            }
        }
        const technical = ['ORDER_PRICE_CHANGED', 'PRODUCT_UNDER_REVIEW', 'NO_CODE_YET', 'INVALID_REQUEST_KEY'].map((c) => [c, refusalText(c, undefined)]);
        const shown = technical.filter(([, t]) => /[A-Z]{3,}_[A-Z]/.test(t));
        console.log(`[CV12B] S3. refus examinés ${refusals}, sans message ${JSON.stringify(missing)} ; texte sans message du serveur : ${JSON.stringify(technical)}`);
        assert.ok(refusals >= 6);
        assert.deepEqual(missing, []);
        assert.deepEqual(shown, []);
        assert.doesNotMatch(refusalText('PRODUCT_UNDER_REVIEW', 'PRODUCT_UNDER_REVIEW'), /PRODUCT_UNDER_REVIEW/);
    });

    test('S4. order_issue_code : recopie exacte de la définition du 12a, plus le seul bloc du 12b', () => {
        const body = (s: string): string => {
            const m = /CREATE OR REPLACE FUNCTION private\.order_issue_code\(p_order_id uuid\)([\s\S]*?)\n\$\$;/.exec(s);
            assert.ok(m, 'définition trouvée');
            return m![1];
        };
        const a = body(read('supabase/migrations/20261130000006_l12a_etapes.sql'));
        const b = body(read('supabase/migrations/20261222000001_l12b_code_visible.sql'));
        const norm = (s: string) => s.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('--'));
        const added = norm(b).filter((l) => !norm(a).includes(l));
        const lost = norm(a).filter((l) => !norm(b).includes(l));
        console.log(`[CV12B] S4. lignes perdues ${JSON.stringify(lost)} ; lignes ajoutées ${JSON.stringify(added)}`);
        assert.deepEqual(lost, []);
        for (const l of added) assert.match(l, /v_hash|order_codes|order_code_encrypt|ON CONFLICT|END IF|IF v_hash|VALUES/, `ajout inattendu : ${l}`);
    });
});
