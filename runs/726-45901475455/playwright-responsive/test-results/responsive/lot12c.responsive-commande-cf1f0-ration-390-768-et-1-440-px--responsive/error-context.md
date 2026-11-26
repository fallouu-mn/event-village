# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lot12c.responsive.spec.ts >> commandes · sombre : catalogue, réglages, zones, commandes, code, livreurs, administration (390, 768 et 1 440 px)
- Location: e2e/lot12c.responsive.spec.ts:190:9

# Error details

```
Error: connexion de ousmane.faye@demo.eventvillage.local : {"error":"Trop de tentatives de connexion depuis cette connexion. Réessayez plus tard.","code":"LOGIN_RATE_LIMITED","retryAfterSeconds":3191}

expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 429
```

# Test source

```ts
  1   | /**
  2   |  * Lot 12c — commandes : écrans de la partenaire (catalogue, produit, produit en vérification, nouveau produit, réglages de
  3   |  * vente, zones de livraison, commandes en téléphone, tablette et ordinateur, fiche d'une commande reçue, saisie du code de
  4   |  * remise, livreurs, tableau de bord) et page « Produits à vérifier » de l'administration, de bout en bout sur le serveur
  5   |  * construit (job « responsive » de la CI : nom en « …responsive.spec.ts »).
  6   |  *
  7   |  * Données propres au spec (la graine de démonstration n'est pas touchée) : un établissement neuf de la partenaire de
  8   |  * démonstration « organisateur2 » (lue par aucun autre spec e2e), validé, ouvert 24 h sur 24, qui prend des commandes
  9   |  * (livraison, retrait, sur place, acompte, paiement à la remise) ; trois zones de livraison (une désactivée) ; des produits
  10  |  * enregistrés par la fonction en base (plat du jour avec portions, plat avec suppléments, boisson, dessert presque épuisé,
  11  |  * produit réglementé, « Bière Gazelle » mise « à vérifier » par la base) ; deux livreurs (un actif, une invitation en
  12  |  * attente) ; des commandes dans chaque étape (reçue au plus tôt, reçue pour plus tard, acceptée, en préparation, prête à
  13  |  * retirer avec un reste à payer, en route en livraison, remise), toutes payables à la remise (aucun paiement réel).
  14  |  *
  15  |  * Interrupteur features.orders_enabled : ouvert au début de chaque test et remis à sa valeur d'origine à la fin, sous le
  16  |  * verrou des services (groupe « services » : aucun test du groupe « autres » ne tourne pendant ce temps,
  17  |  * e2e/support/services-switch.ts).
  18  |  *
  19  |  * Pour chaque thème (clair, sombre) et chaque largeur (390, 768 et 1 440 px) : contrôle responsive (0 défaut bloquant) et
  20  |  * capture. Captures : .e2e-captures/captures-responsive/l12c-<écran>__<largeur>__<thème>.jpg (publiées sur ci-results).
  21  |  */
  22  | import fs from 'node:fs';
  23  | import path from 'node:path';
  24  | import { randomUUID } from 'node:crypto';
  25  | import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
  26  | import { test, expect, projectContextOptions, type ThemeKey } from './support/fixtures';
  27  | import { E2E_OUTPUT_DIR, readDemoIds } from './support/demo-ids';
  28  | import { createClientAccount, rpcOk, serviceClient, userIdByEmail, type ControllerAccount } from './support/service';
  29  | import { runResponsiveChecks } from './support/responsive-checks';
  30  | import { requireStorageState, TEST_PASSWORD } from './support/accounts';
  31  | import { APP_URL } from './support/env';
  32  | import { FIXTURE_USERS } from '../tests/helpers/fixture-data';
  33  | 
  34  | test.describe.configure({ mode: 'serial' });
  35  | 
  36  | const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
  37  | const THEMES: ReadonlyArray<{ key: ThemeKey; scheme: 'light' | 'dark' }> = [{ key: 'clair', scheme: 'light' }, { key: 'sombre', scheme: 'dark' }];
  38  | const WIDTHS = [
  39  |     { width: 390, height: 844, phone: true },
  40  |     { width: 768, height: 1024, phone: false },
  41  |     { width: 1440, height: 900, phone: false },
  42  | ] as const;
  43  | const STAMP = randomUUID().slice(0, 6);
  44  | const ALWAYS_OPEN = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, opens_at: '00:00', closes_at: '24:00' }));
  45  | 
  46  | interface Seeded {
  47  |     venueId: string;
  48  |     venueName: string;
  49  |     products: { yassa: string; biere: string };
  50  |     orders: { recue: { id: string; number: string }; prete: { id: string; number: string } };
  51  | }
  52  | 
  53  | async function settle(page: Page): Promise<void> {
  54  |     await page.evaluate(() => document.fonts.ready.then(() => true));
  55  |     // La page des commandes se relit toutes les 5 s : jamais « réseau au repos » ; attente bornée
  56  |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
  57  |     await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
  58  |     await page.waitForTimeout(400); // fin des transitions (≤ 300 ms)
  59  | }
  60  | 
  61  | async function shot(page: Page, name: string, width: number, theme: ThemeKey, full = true): Promise<void> {
  62  |     fs.mkdirSync(SHOTS, { recursive: true });
  63  |     await page.screenshot({ path: path.join(SHOTS, `l12c-${name}__${width}__${theme}.jpg`), type: 'jpeg', quality: 80, caret: 'hide', scale: 'css', fullPage: full });
  64  | }
  65  | 
  66  | async function checkLayout(page: Page, width: number, phone: boolean, label: string): Promise<void> {
  67  |     const r = await runResponsiveChecks(page, { width, phone });
  68  |     expect(r.blocking, `${label} (${width} px) : défauts bloquants\n${r.blocking.join('\n')}`).toEqual([]);
  69  | }
  70  | 
  71  | async function themedContext(browser: Browser, testInfo: TestInfo, scheme: 'light' | 'dark', storageState?: string): Promise<BrowserContext> {
  72  |     const context = await browser.newContext({ ...projectContextOptions(testInfo), colorScheme: scheme, ...(storageState ? { storageState } : {}) });
  73  |     await context.addInitScript((value: string) => {
  74  |         try { window.localStorage.setItem('ev-theme', value); } catch { /* document opaque */ }
  75  |         document.cookie = `ev-theme=${value}; path=/`;
  76  |     }, scheme);
  77  |     return context;
  78  | }
  79  | 
  80  | async function login(context: BrowserContext, identifier: string): Promise<void> {
  81  |     const res = await context.request.post(`${APP_URL}/api/auth/login`, { data: { identifier, password: TEST_PASSWORD } });
> 82  |     expect(res.status(), `connexion de ${identifier} : ${await res.text()}`).toBe(200);
      |                                                                              ^ Error: connexion de ousmane.faye@demo.eventvillage.local : {"error":"Trop de tentatives de connexion depuis cette connexion. Réessayez plus tard.","code":"LOGIN_RATE_LIMITED","retryAfterSeconds":3191}
  83  | }
  84  | 
  85  | async function title(page: Page, name: string | RegExp): Promise<void> {
  86  |     const heading = typeof name === 'string' ? page.getByRole('heading', { level: 1, name, exact: true }) : page.getByRole('heading', { level: 1, name });
  87  |     await expect(heading.first()).toBeVisible({ timeout: 30_000 });
  88  | }
  89  | 
  90  | async function setOrdersService(open: boolean, actor: string): Promise<void> {
  91  |     const { data, error } = await serviceClient().rpc('finance_setting_set', { p_key: 'features.orders_enabled', p_value: { value: open }, p_actor: actor, p_reason: 'Captures du lot 12c' });
  92  |     if (error || (data as { ok?: boolean } | null)?.ok !== true) throw new Error(`[l12c] interrupteur des commandes : ${error?.message ?? JSON.stringify(data)}`);
  93  | }
  94  | 
  95  | /** Heure de Dakar (UTC) au quart d'heure, `hours` heures plus tard, au format attendu par la base. */
  96  | function laterSlot(hours: number): string {
  97  |     const at = new Date(Date.now() + hours * 3600_000);
  98  |     at.setUTCMinutes(Math.ceil(at.getUTCMinutes() / 15) * 15, 0, 0);
  99  |     return at.toISOString().slice(0, 16);
  100 | }
  101 | 
  102 | async function seed(superadmin: string): Promise<Seeded> {
  103 |     const owner = readDemoIds().accounts.organisateur2;
  104 |     const service = serviceClient();
  105 |     const { data: fiche, error: fErr } = await service.from('partners').select('id, status').eq('user_id', owner.userId).order('created_at').limit(1).maybeSingle();
  106 |     if (fErr || !fiche) throw new Error(`[l12c] fiche de organisateur2 : ${fErr?.message ?? 'absente'}`);
  107 |     if (fiche.status !== 'VALIDE') throw new Error(`[l12c] fiche de organisateur2 au statut ${String(fiche.status)} : VALIDE attendu`);
  108 |     const partnerId = String(fiche.id);
  109 | 
  110 |     // Établissement validé, ouvert 24 h sur 24, qui prend des commandes
  111 |     const venueName = `Chez Fatou ${STAMP}`;
  112 |     const { data: venue, error: vErr } = await service.from('venues').insert({
  113 |         partner_id: partnerId, kind: 'RESTAURANT', name: venueName, address: 'Route de la Corniche Ouest', city: 'Dakar',
  114 |         latitude: 14.6937, longitude: -17.4441, confirmation_mode: 'AUTO',
  115 |     }).select('id').single();
  116 |     if (vErr || !venue) throw new Error(`[l12c] établissement : ${vErr?.message}`);
  117 |     const venueId = String(venue.id);
  118 |     await rpcOk('venue_hours_set', { actor_id: owner.userId, venue_id: venueId, hours: ALWAYS_OPEN });
  119 |     await rpcOk('venue_validation_decide', { actor_id: superadmin, venue_id: venueId, decision: 'VALIDER', reason: null });
  120 |     await rpcOk('order_venue_settings_set', {
  121 |         actor_id: owner.userId, venue_id: venueId, orders_open: true, modes: ['LIVRAISON', 'RETRAIT', 'SUR_PLACE'],
  122 |         deposit_allowed: true, deposit_percent: 30, pay_on_handover: true, prep_minutes: 20,
  123 |     });
  124 |     const almadies = await rpcOk('order_delivery_zone_set', { actor_id: owner.userId, venue_id: venueId, name: 'Almadies', fee: 1_500, min_order: 5_000 });
  125 |     await rpcOk('order_delivery_zone_set', { actor_id: owner.userId, venue_id: venueId, name: 'Mermoz – Sacré-Cœur', fee: 1_000, min_order: 0 });
  126 |     await rpcOk('order_delivery_zone_set', { actor_id: owner.userId, venue_id: venueId, name: 'Yoff', fee: 2_000, min_order: 10_000, is_active: false });
  127 |     const zoneId = String((almadies.zone as Record<string, unknown>).id);
  128 | 
  129 |     const { data: cats, error: cErr } = await service.from('product_categories').insert([
  130 |         { partner_id: partnerId, name: `Plats ${STAMP}`, sort_order: 0 },
  131 |         { partner_id: partnerId, name: `Boissons ${STAMP}`, sort_order: 1 },
  132 |         { partner_id: partnerId, name: `Desserts ${STAMP}`, sort_order: 2 },
  133 |     ]).select('id, name');
  134 |     if (cErr || !cats) throw new Error(`[l12c] catégories : ${cErr?.message}`);
  135 |     const cat = (prefix: string) => String(cats.find((c) => String(c.name).startsWith(prefix))!.id);
  136 |     const save = async (fields: Record<string, unknown>): Promise<string> => {
  137 |         const r = await rpcOk('order_product_save', { actor_id: owner.userId, product_id: null, fields: { venue_id: venueId, ...fields } });
  138 |         return String((r.product as Record<string, unknown>).id);
  139 |     };
  140 |     const thieb = await save({ name: 'Thiéboudienne du jour', description: 'Riz au poisson, légumes du marché, sauce tomate.', price: 4_500, category_id: cat('Plats'), is_daily_special: true });
  141 |     const yassa = await save({ name: 'Yassa poulet', description: 'Poulet mariné au citron et aux oignons, riz blanc.', price: 3_500, category_id: cat('Plats') });
  142 |     const bissap = await save({ name: 'Bissap maison', description: 'Fleurs d’hibiscus, menthe fraîche.', price: 1_000, category_id: cat('Boissons') });
  143 |     const thiakry = await save({ name: 'Thiakry', description: 'Couscous de mil au lait caillé.', price: 1_500, category_id: cat('Desserts'), is_stock_managed: true, stock_quantity: 4 });
  144 |     await save({ name: 'Whisky 12 ans', price: 15_000, category_id: cat('Boissons'), is_regulated: true, regulated_kind: 'ALCOOL' });
  145 |     const biere = await save({ name: 'Bière Gazelle 65 cl', description: 'Bière blonde locale, servie fraîche.', price: 1_500, category_id: cat('Boissons') });
  146 |     await rpcOk('product_option_set', { actor_id: owner.userId, product_id: yassa, name: 'Frites', price: 500 });
  147 |     await rpcOk('product_option_set', { actor_id: owner.userId, product_id: yassa, name: 'Sauce piment', price: 0 });
  148 |     await rpcOk('order_daily_portions_set', { actor_id: owner.userId, product_id: thieb, portions: 50 });
  149 | 
  150 |     // Livreurs : un actif, une invitation en attente
  151 |     const courier = await createClientAccount(`l12c-livreur-${STAMP}`);
  152 |     const pending = await createClientAccount(`l12c-invite-${STAMP}`);
  153 |     const inv = await rpcOk('order_courier_invite', { actor_id: owner.userId, phone: courier.phone });
  154 |     await rpcOk('order_courier_respond', { actor_id: courier.userId, invitation_id: inv.invitation_id, accept: true });
  155 |     await rpcOk('order_courier_invite', { actor_id: owner.userId, phone: pending.phone });
  156 | 
  157 |     // Commandes payables à la remise (au plus 3 non payées par client : trois clientes)
  158 |     const clients: ControllerAccount[] = [];
  159 |     for (const k of ['a', 'b', 'c']) clients.push(await createClientAccount(`l12c-${k}-${STAMP}`));
  160 |     const place = async (client: ControllerAccount, body: Record<string, unknown>): Promise<{ id: string; number: string }> => {
  161 |         const r = await rpcOk('order_create', { client_id: client.userId, venue_id: venueId, payment: 'DIFFERE', ...body });
  162 |         return { id: String(r.order_id), number: String(r.order_number) };
  163 |     };
  164 |     const act = async (orderId: string, ...actions: Array<Record<string, unknown>>): Promise<void> => {
  165 |         for (const a of actions) await rpcOk('order_partner_action', { order_id: orderId, actor_id: owner.userId, ...a });
  166 |     };
  167 |     const line = (productId: string, quantity: number, extra: Record<string, unknown> = {}) => ({ product_id: productId, quantity, option_ids: [], ...extra });
  168 |     const recue = await place(clients[0], { mode: 'RETRAIT', items: [line(yassa, 2, { notes: 'Sans oignons' }), line(bissap, 2)], phone: clients[0].local });
  169 |     await place(clients[0], { mode: 'SUR_PLACE', onsite_label: 'Terrasse 4', scheduled_for: laterSlot(3), items: [line(yassa, 3), line(thiakry, 1)] });
  170 |     const acceptee = await place(clients[1], { mode: 'SUR_PLACE', onsite_label: 'Table 7', items: [line(yassa, 1), line(bissap, 1)] });
  171 |     await act(acceptee.id, { action: 'ACCEPTER', minutes: 25 });
  172 |     const prep = await place(clients[1], { mode: 'RETRAIT', items: [line(bissap, 4)], phone: clients[1].local });
  173 |     await act(prep.id, { action: 'ACCEPTER' }, { action: 'PREPARER' });
  174 |     const prete = await place(clients[1], { mode: 'RETRAIT', items: [line(yassa, 2)], phone: clients[1].local });
  175 |     await act(prete.id, { action: 'ACCEPTER' }, { action: 'PRETE' });
  176 |     const route = await place(clients[2], { mode: 'LIVRAISON', zone_id: zoneId, address: 'Villa 12, route des Almadies, près de la pharmacie', phone: clients[2].local, items: [line(yassa, 2), line(bissap, 2)] });
  177 |     await act(route.id, { action: 'ACCEPTER' }, { action: 'PRETE' }, { action: 'EN_ROUTE', minutes: 20 });
  178 |     const remise = await place(clients[2], { mode: 'SUR_PLACE', onsite_label: 'Comptoir', items: [line(bissap, 3)] });
  179 |     await act(remise.id, { action: 'ACCEPTER' }, { action: 'PRETE' }, { action: 'REMETTRE', balance_received: true });
  180 | 
  181 |     return { venueId, venueName, products: { yassa, biere }, orders: { recue, prete } };
  182 | }
```