# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lot12b.responsive.spec.ts >> commandes du client · clair : carte, panier, heure, sur place, paiement, suivi, code, annulation, Mes commandes (390 et 1 440 px)
- Location: e2e/lot12b.responsive.spec.ts:186:9

# Error details

```
Error: [l12b] transaction du paiement de la commande : rien après 30000 ms
```

# Test source

```ts
  1   | /**
  2   |  * Lot 12b — commandes : écrans du client, de bout en bout sur le serveur construit (job « responsive » de la CI : nom en
  3   |  * « …responsive.spec.ts »).
  4   |  *
  5   |  * Données propres au spec (la graine de démonstration n'est pas touchée) : un établissement neuf de la partenaire de
  6   |  * démonstration « organisateur3 » (ses événements servent aux specs cvcb et 11c-c, aucun établissement), validé, ouvert
  7   |  * 24 h sur 24, qui prend des commandes (livraison, retrait, sur place, acompte de 30 %, paiement à la remise) ; une zone
  8   |  * de livraison ; deux tables ; une carte : plat du jour avec 20 portions, plats avec photo et suppléments, boisson,
  9   |  * produit réglementé (affiché avec son prix, non commandable), dessert épuisé. Un client neuf, connecté UNE seule fois
  10  |  * (cookies repris ensuite : la route de connexion admet 30 essais par adresse IP et par heure, partagés dans le job).
  11  |  *
  12  |  * Pour chaque thème (clair, sombre) et chaque largeur (390 et 1 440 px), le client fait le vrai parcours à l'écran : carte
  13  |  * des plats, plat du jour, produit non commandable, fiche d'un plat, panier et devis de la base, commande sur place (choix
  14  |  * de la table), choix de l'heure, puis commande à emporter « tout de suite » payée en entier : page de suivi avec compte à
  15  |  * rebours et paiement Wave, paiement confirmé par le faux SamirPay et le vrai webhook ; puis chaque étape (reçue,
  16  |  * acceptée, en préparation, prête avec le code de remise affiché, retirée) avancée par la fonction de la partenaire en
  17  |  * base ; une seconde commande payable à la remise, annulée à l'écran ; enfin Mes commandes.
  18  |  *
  19  |  * Interrupteur features.orders_enabled : ouvert au début de chaque test par le compteur partagé
  20  |  * (e2e/support/orders-service.ts), sous le verrou des services (groupe « services »), remis par le dernier inscrit.
  21  |  * Contrôle responsive (0 défaut bloquant) et capture de chaque écran :
  22  |  * .e2e-captures/captures-responsive/l12b-<écran>__<largeur>__<thème>.jpg (publiées sur ci-results).
  23  |  */
  24  | import fs from 'node:fs';
  25  | import path from 'node:path';
  26  | import { randomUUID } from 'node:crypto';
  27  | import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
  28  | import { test, expect, projectContextOptions, type ThemeKey } from './support/fixtures';
  29  | import { E2E_OUTPUT_DIR, readDemoIds } from './support/demo-ids';
  30  | import { createClientAccount, partnerPosterOf, rpcOk, serviceClient, userIdByEmail, type ControllerAccount } from './support/service';
  31  | import { fakeServices } from './support/parcours';
  32  | import { runResponsiveChecks } from './support/responsive-checks';
  33  | import { openOrdersService, releaseOrdersService } from './support/orders-service';
  34  | import { TEST_PASSWORD } from './support/accounts';
  35  | import { APP_URL } from './support/env';
  36  | import { FIXTURE_USERS } from '../tests/helpers/fixture-data';
  37  | 
  38  | test.describe.configure({ mode: 'serial' });
  39  | 
  40  | const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
  41  | const THEMES: ReadonlyArray<{ key: ThemeKey; scheme: 'light' | 'dark' }> = [{ key: 'clair', scheme: 'light' }, { key: 'sombre', scheme: 'dark' }];
  42  | const WIDTHS = [{ width: 390, height: 844, phone: true }, { width: 1440, height: 900, phone: false }] as const;
  43  | const STAMP = randomUUID().slice(0, 6);
  44  | const WHO = 'du lot 12b';
  45  | const ALWAYS_OPEN = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, opens_at: '00:00', closes_at: '24:00' }));
  46  | 
  47  | interface Seeded {
  48  |     venueId: string;
  49  |     venueName: string;
  50  |     ownerId: string;
  51  |     products: { daily: string; yassa: string; mafe: string; beer: string; dessert: string };
  52  |     client: ControllerAccount;
  53  | }
  54  | 
  55  | async function settle(page: Page): Promise<void> {
  56  |     await page.evaluate(() => document.fonts.ready.then(() => true));
  57  |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
  58  |     await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
  59  |     await page.waitForTimeout(350); // fin des transitions (≤ 300 ms)
  60  | }
  61  | 
  62  | async function shot(page: Page, name: string, width: number, theme: ThemeKey, full = true): Promise<void> {
  63  |     fs.mkdirSync(SHOTS, { recursive: true });
  64  |     await page.screenshot({ path: path.join(SHOTS, `l12b-${name}__${width}__${theme}.jpg`), type: 'jpeg', quality: 80, caret: 'hide', scale: 'css', fullPage: full });
  65  | }
  66  | 
  67  | async function checkLayout(page: Page, width: number, phone: boolean, label: string): Promise<void> {
  68  |     const r = await runResponsiveChecks(page, { width, phone });
  69  |     expect(r.blocking, `${label} : défauts bloquants\n${r.blocking.join('\n')}`).toEqual([]);
  70  | }
  71  | 
  72  | async function themedContext(browser: Browser, testInfo: TestInfo, scheme: 'light' | 'dark'): Promise<BrowserContext> {
  73  |     const context = await browser.newContext({ ...projectContextOptions(testInfo), colorScheme: scheme });
  74  |     await context.addInitScript((value: string) => {
  75  |         try { window.localStorage.setItem('ev-theme', value); } catch { /* document opaque */ }
  76  |         document.cookie = `ev-theme=${value}; path=/`;
  77  |     }, scheme);
  78  |     return context;
  79  | }
  80  | 
  81  | /** Une seule connexion du client pour tout le spec (quota de la route de connexion par adresse IP). */
  82  | let savedCookies: Awaited<ReturnType<BrowserContext['cookies']>> | null = null;
  83  | async function loginOnce(context: BrowserContext, identifier: string): Promise<void> {
  84  |     if (savedCookies) {
  85  |         await context.addCookies(savedCookies);
  86  |         return;
  87  |     }
  88  |     const res = await context.request.post(`${APP_URL}/api/auth/login`, { data: { identifier, password: TEST_PASSWORD } });
  89  |     expect(res.status(), `connexion de ${identifier} : ${await res.text()}`).toBe(200);
  90  |     savedCookies = await context.cookies();
  91  | }
  92  | 
  93  | async function waitFor<T>(label: string, read: () => Promise<T | null>, timeoutMs = 30_000): Promise<T> {
  94  |     const t0 = Date.now();
  95  |     for (;;) {
  96  |         const v = await read();
  97  |         if (v !== null) return v;
> 98  |         if (Date.now() - t0 > timeoutMs) throw new Error(`[l12b] ${label} : rien après ${timeoutMs} ms`);
      |                                                ^ Error: [l12b] transaction du paiement de la commande : rien après 30000 ms
  99  |         await new Promise((r) => setTimeout(r, 400));
  100 |     }
  101 | }
  102 | 
  103 | async function insertProduct(partnerId: string, venueId: string, row: Record<string, unknown>): Promise<string> {
  104 |     const { data, error } = await serviceClient().from('products').insert({ partner_id: partnerId, venue_id: venueId, status: 'DISPONIBLE', ...row }).select('id').single();
  105 |     if (error || !data) throw new Error(`[l12b] produit ${String(row.name)} : ${error?.message}`);
  106 |     return String(data.id);
  107 | }
  108 | 
  109 | async function seed(superadmin: string): Promise<Seeded> {
  110 |     const owner = readDemoIds().accounts.organisateur3;
  111 |     const service = serviceClient();
  112 |     const { data: fiche, error: fErr } = await service.from('partners').select('id, status').eq('user_id', owner.userId).maybeSingle();
  113 |     if (fErr || !fiche) throw new Error(`[l12b] fiche de organisateur3 : ${fErr?.message ?? 'absente'}`);
  114 |     if (fiche.status !== 'VALIDE') throw new Error(`[l12b] fiche de organisateur3 au statut ${String(fiche.status)} : VALIDE attendu`);
  115 |     const partnerId = String(fiche.id);
  116 |     const photo = await partnerPosterOf(owner.userId);
  117 |     const venueName = `Chez Fatou ${STAMP}`;
  118 |     const { data: venue, error: vErr } = await service.from('venues').insert({
  119 |         partner_id: partnerId, kind: 'RESTAURANT', name: venueName, city: 'Dakar', address: 'Route de la Corniche Ouest',
  120 |         description: 'Cuisine sénégalaise faite maison, plats du jour mijotés chaque matin.', photos: [photo],
  121 |         latitude: 14.6937, longitude: -17.4720,
  122 |     }).select('id').single();
  123 |     if (vErr || !venue) throw new Error(`[l12b] établissement : ${vErr?.message}`);
  124 |     const venueId = String(venue.id);
  125 |     await rpcOk('venue_hours_set', { actor_id: owner.userId, venue_id: venueId, hours: ALWAYS_OPEN });
  126 |     await rpcOk('venue_validation_decide', { actor_id: superadmin, venue_id: venueId, decision: 'VALIDER', reason: null });
  127 |     await rpcOk('order_venue_settings_set', {
  128 |         actor_id: owner.userId, venue_id: venueId, orders_open: true, modes: ['LIVRAISON', 'RETRAIT', 'SUR_PLACE'],
  129 |         deposit_allowed: true, deposit_percent: 30, pay_on_handover: true, prep_minutes: 25,
  130 |     });
  131 |     const { error: zErr } = await service.from('order_delivery_zones').insert({ venue_id: venueId, name: 'Plateau', fee: 1_000, min_order: 3_000 });
  132 |     if (zErr) throw new Error(`[l12b] zone : ${zErr.message}`);
  133 |     for (const number of ['4', '7']) {
  134 |         const { error } = await service.from('restaurant_tables').insert({ partner_id: partnerId, venue_id: venueId, table_number: `${number}`, capacity: 4, is_active: true });
  135 |         if (error) throw new Error(`[l12b] table ${number} : ${error.message}`);
  136 |     }
  137 |     const categories: Record<string, string> = {};
  138 |     for (const [i, name] of ['Plats', 'Boissons', 'Desserts'].entries()) {
  139 |         const { data, error } = await service.from('product_categories').insert({ partner_id: partnerId, name, sort_order: i + 1 }).select('id').single();
  140 |         if (error || !data) throw new Error(`[l12b] catégorie ${name} : ${error?.message}`);
  141 |         categories[name] = String(data.id);
  142 |     }
  143 |     const daily = await insertProduct(partnerId, venueId, {
  144 |         name: 'Thiéboudienne du jour', price: 4_500, is_daily_special: true, category_id: categories.Plats, images: [photo],
  145 |         description: 'Riz au poisson, légumes du marché, sauce tomate.',
  146 |     });
  147 |     await rpcOk('order_daily_portions_set', { actor_id: owner.userId, product_id: daily, portions: 20 });
  148 |     const yassa = await insertProduct(partnerId, venueId, { name: 'Yassa poulet', price: 3_500, category_id: categories.Plats, images: [photo], description: 'Oignons confits, citron vert.' });
  149 |     for (const [name, price] of [['Piment', 200], ['Frites', 500]] as const) {
  150 |         const { error } = await service.from('product_options').insert({ product_id: yassa, name, price_delta: price });
  151 |         if (error) throw new Error(`[l12b] supplément ${name} : ${error.message}`);
  152 |     }
  153 |     const mafe = await insertProduct(partnerId, venueId, { name: 'Mafé', price: 3_000, category_id: categories.Plats });
  154 |     await insertProduct(partnerId, venueId, { name: 'Bissap', price: 1_000, category_id: categories.Boissons });
  155 |     const beer = await insertProduct(partnerId, venueId, { name: 'Gazelle', price: 1_200, category_id: categories.Boissons, is_regulated: true, regulated_kind: 'ALCOOL' });
  156 |     const dessert = await insertProduct(partnerId, venueId, { name: 'Thiakry', price: 1_500, category_id: categories.Desserts, is_stock_managed: true, stock_quantity: 0 });
  157 |     const client = await createClientAccount(`l12b-${STAMP}`);
  158 |     return { venueId, venueName, ownerId: owner.userId, products: { daily, yassa, mafe, beer, dessert }, client };
  159 | }
  160 | 
  161 | let seeded: Seeded | null = null;
  162 | let superadmin = '';
  163 | 
  164 | test.beforeEach(async ({ servicesLock }) => { await servicesLock.enter('services'); });
  165 | 
  166 | async function partnerStep(data: Seeded, orderId: string, action: string, extra: Record<string, unknown> = {}): Promise<void> {
  167 |     await rpcOk('order_partner_action', { actor_id: data.ownerId, order_id: orderId, action, ...extra });
  168 | }
  169 | 
  170 | async function completePayment(orderId: string): Promise<void> {
  171 |     const tx = await waitFor('transaction du paiement de la commande', async () => {
  172 |         const { data } = await serviceClient().from('payments').select('external_transaction_id').eq('order_id', orderId)
  173 |             .order('created_at', { ascending: false }).limit(1).maybeSingle();
  174 |         return data?.external_transaction_id ? String(data.external_transaction_id) : null;
  175 |     });
  176 |     const done = await fakeServices('/__test/samirpay/complete', { transactionId: tx });
  177 |     expect(done.json.webhookStatus, `webhook réel : ${JSON.stringify(done.json)}`).toBe(200);
  178 | }
  179 | 
  180 | async function stepReached(page: Page, orderId: string, step: string): Promise<void> {
  181 |     await page.goto(`/orders/${orderId}`, { waitUntil: 'load' });
  182 |     await expect(page.getByTestId('frise-commande').locator(`[data-etape="${step}"]`)).toHaveAttribute('data-franchie', 'oui', { timeout: 30_000 });
  183 | }
  184 | 
  185 | for (const theme of THEMES) {
  186 |     test(`commandes du client · ${theme.key} : carte, panier, heure, sur place, paiement, suivi, code, annulation, Mes commandes (390 et 1 440 px)`, async ({ browser }, testInfo) => {
  187 |         test.setTimeout(900_000);
  188 |         superadmin ||= await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
  189 |         await openOrdersService(WHO, superadmin);
  190 |         try {
  191 |             seeded ??= await seed(superadmin);
  192 |             const data = seeded;
  193 |             const context = await themedContext(browser, testInfo, theme.scheme);
  194 |             try {
  195 |                 await loginOnce(context, data.client.email);
  196 |                 const page = await context.newPage();
  197 |                 context.on('page', (p) => { if (p !== page) void p.close(); }); // page de l'opérateur (faux SamirPay)
  198 |                 for (const w of WIDTHS) {
```