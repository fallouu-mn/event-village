# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lot12d.responsive.spec.ts >> livreur, administration, fermeture, pause, signalement, allergènes · clair (390 et 1 440 px)
- Location: e2e/lot12d.responsive.spec.ts:241:9

# Error details

```
Error: connexion de c1.l12d-livreur-d298f6.779480988@recette.eventvillage.local : {"error":"Trop de tentatives de connexion depuis cette connexion. Réessayez plus tard.","code":"LOGIN_RATE_LIMITED","retryAfterSeconds":770}

expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 429
```

# Test source

```ts
  1   | /**
  2   |  * Lot 12d — commandes : espace du livreur (livraisons du jour, livraison prête, saisie du code et reste en espèces, client
  3   |  * absent, invitation), administration des commandes (liste « À décider », fiche, décision après une absence), partenaire
  4   |  * (commandes prévues pendant une fermeture, pause des commandes) et client (signaler un problème, signalement envoyé,
  5   |  * bandeau de pause, allergènes et piment), de bout en bout sur le serveur construit (job « responsive » de la CI : nom en
  6   |  * « …responsive.spec.ts »).
  7   |  *
  8   |  * Données propres au spec (la graine de démonstration n'est pas touchée) : un établissement neuf de la partenaire de
  9   |  * démonstration « organisateur » (session déjà préparée), validé, ouvert 24 h sur 24, qui prend des commandes (livraison, retrait, paiement à la
  10  |  * remise : aucun paiement réel) ; des plats avec allergènes et piment ; un livreur actif (compte neuf), invité aussi par
  11  |  * « organisateur2 » (invitation en attente), qui passe aussi deux commandes à retirer comme client ; des livraisons à chaque étape (prête, en route, client absent en attente,
  12  |  * client absent à décider : horloge avancée par une écriture LOCALE de la base, SUPABASE_DB_URL de .env.e2e, hôte local
  13  |  * vérifié) ; deux commandes en préparation du même compte, client cette fois (dont une signalée) ; une commande prévue demain dans une
  14  |  * fermeture exceptionnelle posée ensuite ; une pause de 60 minutes.
  15  |  *
  16  |  * Interrupteurs : features.orders_enabled par le compteur partagé e2e/support/orders-service.ts (lots 12b et 12c) ;
  17  |  * features.tables_enabled (page des fermetures, sous la garde des tables) par e2e/support/tables-service.ts ; sous le verrou
  18  |  * des services (groupe « services »).
  19  |  *
  20  |  * UNE seule connexion dans tout le spec (le livreur, aussi client de ses deux commandes à retirer) : quota de 30 connexions
  21  |  * par adresse et par heure du job (PASSWORD_LOGIN_PER_IP_HOUR, run 789 : 429 au spec du 12c) ; partenaire et administration
  22  |  * reprennent les sessions préparées (organisateur, fumee-superadmin).
  23  |  * Pour chaque thème (clair, sombre) et chaque largeur (390 et 1 440 px) : contrôle responsive (0 défaut bloquant) et
  24  |  * capture. Captures : .e2e-captures/captures-responsive/l12d-<écran>__<largeur>__<thème>.jpg (publiées sur ci-results).
  25  |  */
  26  | import fs from 'node:fs';
  27  | import path from 'node:path';
  28  | import { randomUUID } from 'node:crypto';
  29  | import { Client } from 'pg';
  30  | import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
  31  | import { test, expect, projectContextOptions, type ThemeKey } from './support/fixtures';
  32  | import { E2E_OUTPUT_DIR, readDemoIds } from './support/demo-ids';
  33  | import { createClientAccount, rpcOk, serviceClient, userIdByEmail, type ControllerAccount } from './support/service';
  34  | import { runResponsiveChecks } from './support/responsive-checks';
  35  | import { requireStorageState, TEST_PASSWORD } from './support/accounts';
  36  | import { openOrdersService, releaseOrdersService } from './support/orders-service';
  37  | import { openTablesService, releaseTablesService } from './support/tables-service';
  38  | import { APP_URL, e2eConfig } from './support/env';
  39  | import { FIXTURE_USERS } from '../tests/helpers/fixture-data';
  40  | 
  41  | test.describe.configure({ mode: 'serial' });
  42  | 
  43  | const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
  44  | const THEMES: ReadonlyArray<{ key: ThemeKey; scheme: 'light' | 'dark' }> = [{ key: 'clair', scheme: 'light' }, { key: 'sombre', scheme: 'dark' }];
  45  | const WIDTHS = [
  46  |     { width: 390, height: 844, phone: true },
  47  |     { width: 1440, height: 900, phone: false },
  48  | ] as const;
  49  | const STAMP = randomUUID().slice(0, 6);
  50  | const ALWAYS_OPEN = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, opens_at: '00:00', closes_at: '24:00' }));
  51  | const WHO = 'lot12d';
  52  | 
  53  | interface Ref { id: string; number: string }
  54  | interface Seeded {
  55  |     venueId: string;
  56  |     closureId: string;
  57  |     invitationId: string;
  58  |     courier: ControllerAccount;
  59  |     orders: { prete: Ref; route: Ref; absent: Ref; equipe: Ref; prep: Ref; signale: Ref; fermeture: Ref };
  60  | }
  61  | 
  62  | type SessionState = Awaited<ReturnType<BrowserContext['storageState']>>;
  63  | const sessions: Record<'courier', SessionState | null> = { courier: null };
  64  | 
  65  | async function settle(page: Page): Promise<void> {
  66  |     await page.evaluate(() => document.fonts.ready.then(() => true));
  67  |     // Écrans relus toutes les 10 à 15 s : jamais « réseau au repos » ; attente bornée
  68  |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
  69  |     await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
  70  |     await page.waitForTimeout(400); // fin des transitions (≤ 300 ms)
  71  | }
  72  | 
  73  | async function shot(page: Page, name: string, width: number, theme: ThemeKey, full = true): Promise<void> {
  74  |     fs.mkdirSync(SHOTS, { recursive: true });
  75  |     await page.screenshot({ path: path.join(SHOTS, `l12d-${name}__${width}__${theme}.jpg`), type: 'jpeg', quality: 80, caret: 'hide', scale: 'css', fullPage: full });
  76  | }
  77  | 
  78  | async function checkLayout(page: Page, width: number, phone: boolean, label: string): Promise<void> {
  79  |     const r = await runResponsiveChecks(page, { width, phone });
  80  |     expect(r.blocking, `${label} (${width} px) : défauts bloquants\n${r.blocking.join('\n')}`).toEqual([]);
  81  | }
  82  | 
  83  | async function themedContext(browser: Browser, testInfo: TestInfo, scheme: 'light' | 'dark', storageState?: string | SessionState): Promise<BrowserContext> {
  84  |     const context = await browser.newContext({ ...projectContextOptions(testInfo), colorScheme: scheme, ...(storageState ? { storageState } : {}) });
  85  |     await context.addInitScript((value: string) => {
  86  |         try { window.localStorage.setItem('ev-theme', value); } catch { /* document opaque */ }
  87  |         document.cookie = `ev-theme=${value}; path=/`;
  88  |     }, scheme);
  89  |     return context;
  90  | }
  91  | 
  92  | /** Contexte connecté : la première fois, une connexion (gardée sans le thème) ; ensuite la session reprise. */
  93  | async function signedContext(browser: Browser, testInfo: TestInfo, scheme: 'light' | 'dark', who: keyof typeof sessions, identifier: string): Promise<BrowserContext> {
  94  |     const context = await themedContext(browser, testInfo, scheme, sessions[who] ?? undefined);
  95  |     if (!sessions[who]) {
  96  |         const res = await context.request.post(`${APP_URL}/api/auth/login`, { data: { identifier, password: TEST_PASSWORD } });
> 97  |         expect(res.status(), `connexion de ${identifier} : ${await res.text()}`).toBe(200);
      |                                                                                  ^ Error: connexion de c1.l12d-livreur-d298f6.779480988@recette.eventvillage.local : {"error":"Trop de tentatives de connexion depuis cette connexion. Réessayez plus tard.","code":"LOGIN_RATE_LIMITED","retryAfterSeconds":770}
  98  |         const state = await context.storageState();
  99  |         sessions[who] = {
  100 |             cookies: state.cookies.filter((c) => c.name !== 'ev-theme'),
  101 |             origins: state.origins.map((o) => ({ ...o, localStorage: o.localStorage.filter((l) => l.name !== 'ev-theme') })),
  102 |         };
  103 |     }
  104 |     return context;
  105 | }
  106 | 
  107 | async function title(page: Page, name: string | RegExp): Promise<void> {
  108 |     const heading = typeof name === 'string' ? page.getByRole('heading', { level: 1, name, exact: true }) : page.getByRole('heading', { level: 1, name });
  109 |     await expect(heading.first()).toBeVisible({ timeout: 30_000 });
  110 | }
  111 | 
  112 | /** Écriture LOCALE de la base (horloge des tests) : hôte local vérifié, drapeau des fonctions de commande posé. */
  113 | async function localSql(text: string, params: unknown[]): Promise<void> {
  114 |     e2eConfig();
  115 |     const url = process.env.SUPABASE_DB_URL;
  116 |     if (!url) throw new Error('[l12d] SUPABASE_DB_URL absent de .env.e2e : horloge de l’absence impossible à avancer');
  117 |     const host = new URL(url).hostname;
  118 |     if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error(`[l12d] SUPABASE_DB_URL non locale (${host})`);
  119 |     const c = new Client({ connectionString: url, application_name: 'ev-e2e-l12d' });
  120 |     await c.connect();
  121 |     try {
  122 |         await c.query('BEGIN');
  123 |         await c.query(`SELECT set_config('event_village.order_flow', 'on', true)`);
  124 |         await c.query(text, params);
  125 |         await c.query('COMMIT');
  126 |     } finally {
  127 |         await c.end();
  128 |     }
  129 | }
  130 | 
  131 | function tomorrow(): string {
  132 |     return new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  133 | }
  134 | 
  135 | async function seed(superadmin: string): Promise<Seeded> {
  136 |     const demo = readDemoIds().accounts;
  137 |     const owner = demo.organisateur;
  138 |     const service = serviceClient();
  139 |     const { data: fiche, error: fErr } = await service.from('partners').select('id, status').eq('user_id', owner.userId).order('created_at').limit(1).maybeSingle();
  140 |     if (fErr || !fiche || fiche.status !== 'VALIDE') throw new Error(`[l12d] fiche de organisateur : ${fErr?.message ?? String(fiche?.status)}`);
  141 | 
  142 |     const { data: venue, error: vErr } = await service.from('venues').insert({
  143 |         partner_id: fiche.id, kind: 'RESTAURANT', name: `Le Baobab ${STAMP}`, address: 'Rue 10, Médina', city: 'Dakar',
  144 |         latitude: 14.68, longitude: -17.45, confirmation_mode: 'AUTO',
  145 |     }).select('id').single();
  146 |     if (vErr || !venue) throw new Error(`[l12d] établissement : ${vErr?.message}`);
  147 |     const venueId = String(venue.id);
  148 |     await rpcOk('venue_hours_set', { actor_id: owner.userId, venue_id: venueId, hours: ALWAYS_OPEN });
  149 |     await rpcOk('venue_validation_decide', { actor_id: superadmin, venue_id: venueId, decision: 'VALIDER', reason: null });
  150 |     await rpcOk('order_venue_settings_set', {
  151 |         actor_id: owner.userId, venue_id: venueId, orders_open: true, modes: ['LIVRAISON', 'RETRAIT'],
  152 |         deposit_allowed: false, deposit_percent: null, pay_on_handover: true, prep_minutes: 20,
  153 |     });
  154 |     const zone = await rpcOk('order_delivery_zone_set', { actor_id: owner.userId, venue_id: venueId, name: 'Médina – Fass', fee: 1_000, min_order: 0 });
  155 |     const zoneId = String((zone.zone as Record<string, unknown>).id);
  156 |     const save = async (fields: Record<string, unknown>, allergens: string[], spice: number): Promise<string> => {
  157 |         const r = await rpcOk('order_product_save', { actor_id: owner.userId, product_id: null, fields: { venue_id: venueId, ...fields } });
  158 |         const id = String((r.product as Record<string, unknown>).id);
  159 |         await rpcOk('order_product_details_set', { actor_id: owner.userId, product_id: id, allergens, spice_level: spice });
  160 |         return id;
  161 |     };
  162 |     const yassa = await save({ name: 'Yassa poulet', description: 'Poulet mariné au citron et aux oignons, riz blanc.', price: 3_500 }, ['MOUTARDE', 'GLUTEN'], 2);
  163 |     const thieb = await save({ name: 'Thiéboudienne', description: 'Riz au poisson, légumes du marché.', price: 4_500 }, ['POISSON', 'CELERI'], 1);
  164 |     await save({ name: 'Bissap maison', description: 'Fleurs d’hibiscus, menthe fraîche.', price: 1_000 }, [], 0);
  165 |     await save({ name: 'Pastels au thon', description: 'Chaussons frits, sauce très pimentée.', price: 2_000 }, ['POISSON', 'GLUTEN', 'OEUFS'], 3);
  166 | 
  167 |     // Livreur actif ; invitation en attente d'une autre partenaire (organisateur2)
  168 |     const courier = await createClientAccount(`l12d-livreur-${STAMP}`);
  169 |     const inv = await rpcOk('order_courier_invite', { actor_id: owner.userId, phone: courier.phone });
  170 |     await rpcOk('order_courier_respond', { actor_id: courier.userId, invitation_id: inv.invitation_id, accept: true });
  171 |     const other = await rpcOk('order_courier_invite', { actor_id: demo.organisateur2.userId, phone: courier.phone });
  172 | 
  173 |     // Commandes payables à la remise (au plus 3 en cours par compte) ; le livreur est aussi le client de deux retraits
  174 |     const client = courier;
  175 |     const buyers: ControllerAccount[] = [];
  176 |     for (const k of ['a', 'b']) buyers.push(await createClientAccount(`l12d-${k}-${STAMP}`));
  177 |     const line = (productId: string, quantity: number) => ({ product_id: productId, quantity, option_ids: [] });
  178 |     const place = async (who: ControllerAccount, body: Record<string, unknown>): Promise<Ref> => {
  179 |         const r = await rpcOk('order_create', { client_id: who.userId, venue_id: venueId, payment: 'DIFFERE', ...body });
  180 |         return { id: String(r.order_id), number: String(r.order_number) };
  181 |     };
  182 |     const act = async (orderId: string, ...actions: Array<Record<string, unknown>>): Promise<void> => {
  183 |         for (const a of actions) await rpcOk('order_partner_action', { order_id: orderId, actor_id: owner.userId, ...a });
  184 |     };
  185 |     const deliver = (who: ControllerAccount) => ({ mode: 'LIVRAISON', zone_id: zoneId, address: 'Villa 7, rue 10 Médina, face à la mosquée', phone: who.local });
  186 |     const leave = async (o: Ref): Promise<void> => {
  187 |         await act(o.id, { action: 'ACCEPTER' }, { action: 'PRETE' }, { action: 'CONFIER', courier_id: courier.userId });
  188 |     };
  189 |     const absent = async (o: Ref): Promise<void> => {
  190 |         await rpcOk('order_courier_action', { order_id: o.id, actor_id: courier.userId, action: 'EN_ROUTE', minutes: 20 });
  191 |         await rpcOk('order_delivery_step', { order_id: o.id, actor_id: courier.userId, as: 'COURIER', action: 'APPEL' });
  192 |         await localSql(`UPDATE public.orders SET last_call_at = now() - interval '31 seconds' WHERE id = $1`, [o.id]);
  193 |         await rpcOk('order_delivery_step', { order_id: o.id, actor_id: courier.userId, as: 'COURIER', action: 'APPEL' });
  194 |         await rpcOk('order_delivery_step', { order_id: o.id, actor_id: courier.userId, as: 'COURIER', action: 'ABSENT' });
  195 |     };
  196 |     const prete = await place(buyers[0], { ...deliver(buyers[0]), items: [line(yassa, 2), line(thieb, 1)] });
  197 |     await leave(prete);
```