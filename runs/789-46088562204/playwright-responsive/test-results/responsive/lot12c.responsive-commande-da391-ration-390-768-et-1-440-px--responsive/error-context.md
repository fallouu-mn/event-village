# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lot12c.responsive.spec.ts >> commandes · clair : catalogue, réglages, zones, commandes, code, livreurs, administration (390, 768 et 1 440 px)
- Location: e2e/lot12c.responsive.spec.ts:205:9

# Error details

```
Error: connexion de ousmane.faye@demo.eventvillage.local : {"error":"Trop de tentatives de connexion depuis cette connexion. Réessayez plus tard.","code":"LOGIN_RATE_LIMITED","retryAfterSeconds":1081}

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
  17  |  * e2e/support/services-switch.ts). Fusion avec le lot 12b : par le compteur partagé e2e/support/orders-service.ts
  18  |  * (openOrdersService / releaseOrdersService), comme e2e/lot12b.responsive.spec.ts qui tourne dans le même groupe : le
  19  |  * dernier spec qui se retire remet l'état d'origine, jamais un spec qui referme le service sous les pas de l'autre.
  20  |  *
  21  |  * Pour chaque thème (clair, sombre) et chaque largeur (390, 768 et 1 440 px) : contrôle responsive (0 défaut bloquant) et
  22  |  * capture. Captures : .e2e-captures/captures-responsive/l12c-<écran>__<largeur>__<thème>.jpg (publiées sur ci-results).
  23  |  */
  24  | import fs from 'node:fs';
  25  | import path from 'node:path';
  26  | import { randomUUID } from 'node:crypto';
  27  | import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
  28  | import { test, expect, projectContextOptions, type ThemeKey } from './support/fixtures';
  29  | import { E2E_OUTPUT_DIR, readDemoIds } from './support/demo-ids';
  30  | import { createClientAccount, rpcOk, serviceClient, userIdByEmail, type ControllerAccount } from './support/service';
  31  | import { runResponsiveChecks } from './support/responsive-checks';
  32  | import { requireStorageState, TEST_PASSWORD } from './support/accounts';
  33  | import { openOrdersService, releaseOrdersService } from './support/orders-service';
  34  | import { APP_URL } from './support/env';
  35  | import { FIXTURE_USERS } from '../tests/helpers/fixture-data';
  36  | 
  37  | test.describe.configure({ mode: 'serial' });
  38  | 
  39  | const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
  40  | const THEMES: ReadonlyArray<{ key: ThemeKey; scheme: 'light' | 'dark' }> = [{ key: 'clair', scheme: 'light' }, { key: 'sombre', scheme: 'dark' }];
  41  | const WIDTHS = [
  42  |     { width: 390, height: 844, phone: true },
  43  |     { width: 768, height: 1024, phone: false },
  44  |     { width: 1440, height: 900, phone: false },
  45  | ] as const;
  46  | const STAMP = randomUUID().slice(0, 6);
  47  | const ALWAYS_OPEN = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, opens_at: '00:00', closes_at: '24:00' }));
  48  | 
  49  | interface Seeded {
  50  |     venueId: string;
  51  |     venueName: string;
  52  |     products: { yassa: string; biere: string };
  53  |     orders: { recue: { id: string; number: string }; prete: { id: string; number: string } };
  54  | }
  55  | 
  56  | async function settle(page: Page): Promise<void> {
  57  |     await page.evaluate(() => document.fonts.ready.then(() => true));
  58  |     // La page des commandes se relit toutes les 5 s : jamais « réseau au repos » ; attente bornée
  59  |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
  60  |     await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
  61  |     await page.waitForTimeout(400); // fin des transitions (≤ 300 ms)
  62  | }
  63  | 
  64  | async function shot(page: Page, name: string, width: number, theme: ThemeKey, full = true): Promise<void> {
  65  |     fs.mkdirSync(SHOTS, { recursive: true });
  66  |     await page.screenshot({ path: path.join(SHOTS, `l12c-${name}__${width}__${theme}.jpg`), type: 'jpeg', quality: 80, caret: 'hide', scale: 'css', fullPage: full });
  67  | }
  68  | 
  69  | async function checkLayout(page: Page, width: number, phone: boolean, label: string): Promise<void> {
  70  |     const r = await runResponsiveChecks(page, { width, phone });
  71  |     expect(r.blocking, `${label} (${width} px) : défauts bloquants\n${r.blocking.join('\n')}`).toEqual([]);
  72  | }
  73  | 
  74  | type SessionState = Awaited<ReturnType<BrowserContext['storageState']>>;
  75  | 
  76  | /**
  77  |  * Session de la partenaire, ouverte UNE fois pour tout le spec (run 726 : la seconde connexion, au thème sombre, tombait
  78  |  * sur la limite des connexions par adresse de la phase responsive, 429 LOGIN_RATE_LIMITED) ; reprise par le thème suivant.
  79  |  */
  80  | let partnerSession: SessionState | null = null;
  81  | 
  82  | async function themedContext(browser: Browser, testInfo: TestInfo, scheme: 'light' | 'dark', storageState?: string | SessionState): Promise<BrowserContext> {
  83  |     const context = await browser.newContext({ ...projectContextOptions(testInfo), colorScheme: scheme, ...(storageState ? { storageState } : {}) });
  84  |     await context.addInitScript((value: string) => {
  85  |         try { window.localStorage.setItem('ev-theme', value); } catch { /* document opaque */ }
  86  |         document.cookie = `ev-theme=${value}; path=/`;
  87  |     }, scheme);
  88  |     return context;
  89  | }
  90  | 
  91  | async function login(context: BrowserContext, identifier: string): Promise<void> {
  92  |     const res = await context.request.post(`${APP_URL}/api/auth/login`, { data: { identifier, password: TEST_PASSWORD } });
> 93  |     expect(res.status(), `connexion de ${identifier} : ${await res.text()}`).toBe(200);
      |                                                                              ^ Error: connexion de ousmane.faye@demo.eventvillage.local : {"error":"Trop de tentatives de connexion depuis cette connexion. Réessayez plus tard.","code":"LOGIN_RATE_LIMITED","retryAfterSeconds":1081}
  94  | }
  95  | 
  96  | async function title(page: Page, name: string | RegExp): Promise<void> {
  97  |     const heading = typeof name === 'string' ? page.getByRole('heading', { level: 1, name, exact: true }) : page.getByRole('heading', { level: 1, name });
  98  |     await expect(heading.first()).toBeVisible({ timeout: 30_000 });
  99  | }
  100 | 
  101 | /** Inscription au compteur partagé du service des commandes (lot 12b : e2e/support/orders-service.ts). */
  102 | const WHO = 'lot12c';
  103 | 
  104 | /** Heure de Dakar (UTC) au quart d'heure, `hours` heures plus tard, au format attendu par la base. */
  105 | function laterSlot(hours: number): string {
  106 |     const at = new Date(Date.now() + hours * 3600_000);
  107 |     at.setUTCMinutes(Math.ceil(at.getUTCMinutes() / 15) * 15, 0, 0);
  108 |     return at.toISOString().slice(0, 16);
  109 | }
  110 | 
  111 | async function seed(superadmin: string): Promise<Seeded> {
  112 |     const owner = readDemoIds().accounts.organisateur2;
  113 |     const service = serviceClient();
  114 |     const { data: fiche, error: fErr } = await service.from('partners').select('id, status').eq('user_id', owner.userId).order('created_at').limit(1).maybeSingle();
  115 |     if (fErr || !fiche) throw new Error(`[l12c] fiche de organisateur2 : ${fErr?.message ?? 'absente'}`);
  116 |     if (fiche.status !== 'VALIDE') throw new Error(`[l12c] fiche de organisateur2 au statut ${String(fiche.status)} : VALIDE attendu`);
  117 |     const partnerId = String(fiche.id);
  118 | 
  119 |     // Établissement validé, ouvert 24 h sur 24, qui prend des commandes
  120 |     const venueName = `Chez Fatou ${STAMP}`;
  121 |     const { data: venue, error: vErr } = await service.from('venues').insert({
  122 |         partner_id: partnerId, kind: 'RESTAURANT', name: venueName, address: 'Route de la Corniche Ouest', city: 'Dakar',
  123 |         latitude: 14.6937, longitude: -17.4441, confirmation_mode: 'AUTO',
  124 |     }).select('id').single();
  125 |     if (vErr || !venue) throw new Error(`[l12c] établissement : ${vErr?.message}`);
  126 |     const venueId = String(venue.id);
  127 |     await rpcOk('venue_hours_set', { actor_id: owner.userId, venue_id: venueId, hours: ALWAYS_OPEN });
  128 |     await rpcOk('venue_validation_decide', { actor_id: superadmin, venue_id: venueId, decision: 'VALIDER', reason: null });
  129 |     await rpcOk('order_venue_settings_set', {
  130 |         actor_id: owner.userId, venue_id: venueId, orders_open: true, modes: ['LIVRAISON', 'RETRAIT', 'SUR_PLACE'],
  131 |         deposit_allowed: true, deposit_percent: 30, pay_on_handover: true, prep_minutes: 20,
  132 |     });
  133 |     const almadies = await rpcOk('order_delivery_zone_set', { actor_id: owner.userId, venue_id: venueId, name: 'Almadies', fee: 1_500, min_order: 5_000 });
  134 |     await rpcOk('order_delivery_zone_set', { actor_id: owner.userId, venue_id: venueId, name: 'Mermoz – Sacré-Cœur', fee: 1_000, min_order: 0 });
  135 |     await rpcOk('order_delivery_zone_set', { actor_id: owner.userId, venue_id: venueId, name: 'Yoff', fee: 2_000, min_order: 10_000, is_active: false });
  136 |     const zoneId = String((almadies.zone as Record<string, unknown>).id);
  137 | 
  138 |     const { data: cats, error: cErr } = await service.from('product_categories').insert([
  139 |         { partner_id: partnerId, name: `Plats ${STAMP}`, sort_order: 0 },
  140 |         { partner_id: partnerId, name: `Boissons ${STAMP}`, sort_order: 1 },
  141 |         { partner_id: partnerId, name: `Desserts ${STAMP}`, sort_order: 2 },
  142 |     ]).select('id, name');
  143 |     if (cErr || !cats) throw new Error(`[l12c] catégories : ${cErr?.message}`);
  144 |     const cat = (prefix: string) => String(cats.find((c) => String(c.name).startsWith(prefix))!.id);
  145 |     const save = async (fields: Record<string, unknown>): Promise<string> => {
  146 |         const r = await rpcOk('order_product_save', { actor_id: owner.userId, product_id: null, fields: { venue_id: venueId, ...fields } });
  147 |         return String((r.product as Record<string, unknown>).id);
  148 |     };
  149 |     const thieb = await save({ name: 'Thiéboudienne du jour', description: 'Riz au poisson, légumes du marché, sauce tomate.', price: 4_500, category_id: cat('Plats'), is_daily_special: true });
  150 |     const yassa = await save({ name: 'Yassa poulet', description: 'Poulet mariné au citron et aux oignons, riz blanc.', price: 3_500, category_id: cat('Plats') });
  151 |     const bissap = await save({ name: 'Bissap maison', description: 'Fleurs d’hibiscus, menthe fraîche.', price: 1_000, category_id: cat('Boissons') });
  152 |     const thiakry = await save({ name: 'Thiakry', description: 'Couscous de mil au lait caillé.', price: 1_500, category_id: cat('Desserts'), is_stock_managed: true, stock_quantity: 4 });
  153 |     await save({ name: 'Whisky 12 ans', price: 15_000, category_id: cat('Boissons'), is_regulated: true, regulated_kind: 'ALCOOL' });
  154 |     const biere = await save({ name: 'Bière Gazelle 65 cl', description: 'Bière blonde locale, servie fraîche.', price: 1_500, category_id: cat('Boissons') });
  155 |     // Contre-vérification du lot 12c (point 8) : un produit vendu puis archivé, pour « Remettre en vente »
  156 |     const pastels = await save({ name: 'Pastels au thon', description: 'Six chaussons frits, sauce tomate pimentée.', price: 2_000, category_id: cat('Plats') });
  157 |     await rpcOk('product_option_set', { actor_id: owner.userId, product_id: yassa, name: 'Frites', price: 500 });
  158 |     await rpcOk('product_option_set', { actor_id: owner.userId, product_id: yassa, name: 'Sauce piment', price: 0 });
  159 |     await rpcOk('order_daily_portions_set', { actor_id: owner.userId, product_id: thieb, portions: 50 });
  160 | 
  161 |     // Livreurs : un actif, une invitation en attente
  162 |     const courier = await createClientAccount(`l12c-livreur-${STAMP}`);
  163 |     const pending = await createClientAccount(`l12c-invite-${STAMP}`);
  164 |     const inv = await rpcOk('order_courier_invite', { actor_id: owner.userId, phone: courier.phone });
  165 |     await rpcOk('order_courier_respond', { actor_id: courier.userId, invitation_id: inv.invitation_id, accept: true });
  166 |     await rpcOk('order_courier_invite', { actor_id: owner.userId, phone: pending.phone });
  167 | 
  168 |     // Commandes payables à la remise (au plus 3 non payées par client : trois clientes)
  169 |     const clients: ControllerAccount[] = [];
  170 |     for (const k of ['a', 'b', 'c', 'd']) clients.push(await createClientAccount(`l12c-${k}-${STAMP}`));
  171 |     const place = async (client: ControllerAccount, body: Record<string, unknown>): Promise<{ id: string; number: string }> => {
  172 |         const r = await rpcOk('order_create', { client_id: client.userId, venue_id: venueId, payment: 'DIFFERE', ...body });
  173 |         return { id: String(r.order_id), number: String(r.order_number) };
  174 |     };
  175 |     const act = async (orderId: string, ...actions: Array<Record<string, unknown>>): Promise<void> => {
  176 |         for (const a of actions) await rpcOk('order_partner_action', { order_id: orderId, actor_id: owner.userId, ...a });
  177 |     };
  178 |     const line = (productId: string, quantity: number, extra: Record<string, unknown> = {}) => ({ product_id: productId, quantity, option_ids: [], ...extra });
  179 |     const recue = await place(clients[0], { mode: 'RETRAIT', items: [line(yassa, 2, { notes: 'Sans oignons' }), line(bissap, 2)], phone: clients[0].local });
  180 |     await place(clients[0], { mode: 'SUR_PLACE', onsite_label: 'Terrasse 4', scheduled_for: laterSlot(3), items: [line(yassa, 3), line(thiakry, 1)] });
  181 |     const acceptee = await place(clients[1], { mode: 'SUR_PLACE', onsite_label: 'Table 7', items: [line(yassa, 1), line(bissap, 1)] });
  182 |     await act(acceptee.id, { action: 'ACCEPTER', minutes: 25 });
  183 |     const prep = await place(clients[1], { mode: 'RETRAIT', items: [line(bissap, 4)], phone: clients[1].local });
  184 |     await act(prep.id, { action: 'ACCEPTER' }, { action: 'PREPARER' });
  185 |     const prete = await place(clients[1], { mode: 'RETRAIT', items: [line(yassa, 2)], phone: clients[1].local });
  186 |     await act(prete.id, { action: 'ACCEPTER' }, { action: 'PRETE' });
  187 |     const route = await place(clients[2], { mode: 'LIVRAISON', zone_id: zoneId, address: 'Villa 12, route des Almadies, près de la pharmacie', phone: clients[2].local, items: [line(yassa, 2), line(bissap, 2)] });
  188 |     await act(route.id, { action: 'ACCEPTER' }, { action: 'PRETE' }, { action: 'EN_ROUTE', minutes: 20 });
  189 |     const remise = await place(clients[2], { mode: 'SUR_PLACE', onsite_label: 'Comptoir', items: [line(bissap, 3)] });
  190 |     await act(remise.id, { action: 'ACCEPTER' }, { action: 'PRETE' }, { action: 'REMETTRE', balance_received: true });
  191 |     const vendu = await place(clients[3], { mode: 'SUR_PLACE', onsite_label: 'Table 2', items: [line(pastels, 1)] });
  192 |     await act(vendu.id, { action: 'ACCEPTER' }, { action: 'PRETE' }, { action: 'REMETTRE', balance_received: true });
  193 |     const removed = await rpcOk('order_product_remove', { actor_id: owner.userId, product_id: pastels });
```