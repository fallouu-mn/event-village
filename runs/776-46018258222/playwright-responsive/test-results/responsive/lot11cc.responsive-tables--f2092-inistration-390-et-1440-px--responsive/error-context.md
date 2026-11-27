# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lot11cc.responsive.spec.ts >> tables d’un événement · sombre : organisatrice, porte, scanner, administration (390 et 1440 px)
- Location: e2e/lot11cc.responsive.spec.ts:203:9

# Error details

```
Error: connexion de k2.l11cc-5a80b1.762747404@recette.eventvillage.local : {"error":"Trop de tentatives de connexion depuis cette connexion. Réessayez plus tard.","code":"LOGIN_RATE_LIMITED","retryAfterSeconds":568}

expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 429
```

# Test source

```ts
  1   | /**
  2   |  * Lot 11c-c — tables d'un événement : écrans de l'organisatrice, de la porte, du scanner et de l'administration, de bout en
  3   |  * bout sur le serveur construit (job « responsive » de la CI : nom en « …responsive.spec.ts »).
  4   |  *
  5   |  * Données propres au spec (la graine de démonstration n'est pas touchée) : un événement publié de la partenaire de
  6   |  * démonstration « organisateur3 » (aucun autre spec ne lit ses chiffres), deux types de tables placées sur le plan
  7   |  * (« Carré VIP » 4 × 6 places, « Table ronde » 6 × 8 places), deux tables vendues par le vrai achat (route du serveur, faux
  8   |  * SamirPay, vrai webhook), une troisième en paiement, une place envoyée et acceptée par une invitée, deux places entrées
  9   |  * (scan manuel du contrôleur affecté). Service des tables ouvert le temps du spec par le compteur partagé avec le spec du 11c-b (e2e/support/tables-service).
  10  |  *
  11  |  * Pour chaque thème (clair, sombre) et chaque largeur (390 et 1440 px) : contrôle responsive (0 défaut bloquant) et
  12  |  * capture de l'éditeur, du plan en édition, de la jauge, de la vue client, d'un type figé, du pilotage, de la porte (table
  13  |  * ouverte, plein écran, impression), de la porte du contrôleur, du badge du scanner et de la fiche de l'administration.
  14  |  * Captures : .e2e-captures/captures-responsive/l11cc-<écran>__<largeur>__<thème>.jpg (publiées sur ci-results).
  15  |  */
  16  | import fs from 'node:fs';
  17  | import path from 'node:path';
  18  | import { createHash, randomUUID } from 'node:crypto';
  19  | import { request as pwRequest, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
  20  | import { test, expect, projectContextOptions, type ThemeKey } from './support/fixtures';
  21  | import { E2E_OUTPUT_DIR, readDemoIds } from './support/demo-ids';
  22  | import { createClientAccount, createControllerAccount, createPublishedEvent, partnerPosterOf, rpcOk, serviceClient, userIdByEmail, type ControllerAccount } from './support/service';
  23  | import { fakeServices } from './support/parcours';
  24  | import { runResponsiveChecks } from './support/responsive-checks';
  25  | import { openTablesService, releaseTablesService } from './support/tables-service';
  26  | import { installFakeCamera } from './support/fake-camera';
  27  | import { requireStorageState, TEST_PASSWORD } from './support/accounts';
  28  | import { APP_URL } from './support/env';
  29  | import { FIXTURE_USERS } from '../tests/helpers/fixture-data';
  30  | 
  31  | test.describe.configure({ mode: 'serial' });
  32  | 
  33  | const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
  34  | const THEMES: ReadonlyArray<{ key: ThemeKey; scheme: 'light' | 'dark' }> = [{ key: 'clair', scheme: 'light' }, { key: 'sombre', scheme: 'dark' }];
  35  | const WIDTHS = [{ width: 390, height: 844, phone: true }, { width: 1440, height: 900, phone: false }] as const;
  36  | const STAMP = randomUUID().slice(0, 6);
  37  | 
  38  | interface Seeded { eventId: string; title: string; controller: ControllerAccount; seatNumber: string }
  39  | 
  40  | async function settle(page: Page): Promise<void> {
  41  |     await page.evaluate(() => document.fonts.ready.then(() => true));
  42  |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
  43  |     await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
  44  |     await page.waitForTimeout(350); // fin des transitions (≤ 300 ms)
  45  | }
  46  | 
  47  | async function shot(page: Page, name: string, width: number, theme: ThemeKey, full = true): Promise<void> {
  48  |     fs.mkdirSync(SHOTS, { recursive: true });
  49  |     await page.screenshot({ path: path.join(SHOTS, `l11cc-${name}__${width}__${theme}.jpg`), type: 'jpeg', quality: 80, caret: 'hide', scale: 'css', fullPage: full });
  50  | }
  51  | 
  52  | /** Contrôle responsive de la page affichée : aucun défaut bloquant (défilement horizontal, texte coupé, chevauchement…). */
  53  | async function checkLayout(page: Page, width: number, phone: boolean, label: string): Promise<void> {
  54  |     const r = await runResponsiveChecks(page, { width, phone });
  55  |     expect(r.blocking, `${label} : défauts bloquants\n${r.blocking.join('\n')}`).toEqual([]);
  56  | }
  57  | 
  58  | async function themedContext(browser: Browser, testInfo: TestInfo, scheme: 'light' | 'dark', storageState?: string): Promise<BrowserContext> {
  59  |     const context = await browser.newContext({ ...projectContextOptions(testInfo), colorScheme: scheme, ...(storageState ? { storageState } : {}) });
  60  |     await context.addInitScript((value: string) => {
  61  |         try { window.localStorage.setItem('ev-theme', value); } catch { /* document opaque */ }
  62  |         document.cookie = `ev-theme=${value}; path=/`;
  63  |     }, scheme);
  64  |     return context;
  65  | }
  66  | 
  67  | async function login(context: BrowserContext, identifier: string): Promise<void> {
  68  |     const res = await context.request.post(`${APP_URL}/api/auth/login`, { data: { identifier, password: TEST_PASSWORD } });
> 69  |     expect(res.status(), `connexion de ${identifier} : ${await res.text()}`).toBe(200);
      |                                                                              ^ Error: connexion de k2.l11cc-5a80b1.762747404@recette.eventvillage.local : {"error":"Trop de tentatives de connexion depuis cette connexion. Réessayez plus tard.","code":"LOGIN_RATE_LIMITED","retryAfterSeconds":568}
  70  | }
  71  | 
  72  | function dakar(at: Date): { date: string; time: string } {
  73  |     const iso = at.toISOString();
  74  |     return { date: iso.slice(0, 10), time: `${iso.slice(11, 16)}:00` };
  75  | }
  76  | 
  77  | async function waitFor<T>(label: string, read: () => Promise<T | null>, timeoutMs = 30_000): Promise<T> {
  78  |     const t0 = Date.now();
  79  |     for (;;) {
  80  |         const v = await read();
  81  |         if (v !== null) return v;
  82  |         if (Date.now() - t0 > timeoutMs) throw new Error(`[l11cc] ${label} : rien après ${timeoutMs} ms`);
  83  |         await new Promise((r) => setTimeout(r, 400));
  84  |     }
  85  | }
  86  | 
  87  | /** Achat d'une table par la vraie route ; `complete` : paiement confirmé par le faux SamirPay et le vrai webhook. */
  88  | async function buyTable(eventId: string, buyer: ControllerAccount, typeId: string, tableId: string, complete: boolean): Promise<string | null> {
  89  |     const api = await pwRequest.newContext({ baseURL: APP_URL });
  90  |     try {
  91  |         const log = await api.post('/api/auth/login', { data: { identifier: buyer.email, password: TEST_PASSWORD } });
  92  |         expect(log.status(), `connexion de l’acheteuse : ${await log.text()}`).toBe(200);
  93  |         const res = await api.post(`/api/events/${eventId}/tables/checkout`, {
  94  |             headers: { 'Idempotency-Key': `l11cc-${randomUUID()}` },
  95  |             data: { typeId, tableId, operator: 'WAVE', payerPhone: buyer.local },
  96  |         });
  97  |         const body = await res.json() as Record<string, unknown>;
  98  |         expect(res.status(), `achat de la table : ${JSON.stringify(body)}`).toBe(200);
  99  |         const paymentId = String(body.payment_id ?? '');
  100 |         if (!complete) return null;
  101 |         const { data: pay, error } = await serviceClient().from('payments').select('external_transaction_id').eq('id', paymentId).single();
  102 |         if (error || !pay?.external_transaction_id) throw new Error(`[l11cc] transaction du paiement ${paymentId} : ${error?.message ?? 'absente'}`);
  103 |         const done = await fakeServices('/__test/samirpay/complete', { transactionId: pay.external_transaction_id });
  104 |         expect(done.json.webhookStatus, `webhook réel : ${JSON.stringify(done.json)}`).toBe(200);
  105 |         return waitFor('vente de la table', async () => {
  106 |             const { data } = await serviceClient().from('event_table_bookings').select('id').eq('payment_id', paymentId).maybeSingle();
  107 |             return data ? String(data.id) : null;
  108 |         });
  109 |     } finally {
  110 |         await api.dispose();
  111 |     }
  112 | }
  113 | 
  114 | async function seed(superadmin: string): Promise<Seeded> {
  115 |     const owner = readDemoIds().accounts.organisateur3;
  116 |     const service = serviceClient();
  117 |     const start = new Date(Date.now() + 60 * 60_000);
  118 |     const end = new Date(start.getTime() + 4 * 3600_000);
  119 |     const s = dakar(start);
  120 |     const e = dakar(end);
  121 |     const title = `Nuit des tables ${STAMP}`;
  122 |     const eventId = await createPublishedEvent({
  123 |         partnerUserId: owner.userId, superadminId: superadmin, title,
  124 |         description: 'Captures du lot 11c-c (tables d’un événement). Données fictives.',
  125 |         startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time,
  126 |         location: 'Terrasse de la Corniche', city: 'Dakar', capacity: 200,
  127 |         imageUrl: await partnerPosterOf(owner.userId),
  128 |         categories: [{ name: 'Entrée', price: 5_000, total: 80 }],
  129 |     });
  130 |     const vip = await rpcOk('event_table_type_save', {
  131 |         event_id: eventId, actor_id: owner.userId, count: 4,
  132 |         type: { name: 'Carré VIP', seats: 6, price: 150_000, included_text: 'Une bouteille et un plateau de fruits', onsite_note: '50 000 F de consommations sur place', payment_mode: 'FULL' },
  133 |     });
  134 |     const ronde = await rpcOk('event_table_type_save', {
  135 |         event_id: eventId, actor_id: owner.userId, count: 6,
  136 |         type: { name: 'Table ronde', seats: 8, price: 120_000, included_text: 'Softs à volonté', payment_mode: 'FULL' },
  137 |     });
  138 |     const vipId = String((vip.type as Record<string, unknown>).id);
  139 |     const rondeId = String((ronde.type as Record<string, unknown>).id);
  140 |     const { data: rows, error } = await service.from('event_tables').select('id, number, category_id').eq('event_id', eventId).order('number');
  141 |     if (error || !rows) throw new Error(`[l11cc] tables de l'événement : ${error?.message}`);
  142 |     // Carré VIP en 2 × 2 en haut à gauche, tables rondes en deux rangées en bas
  143 |     const vipPos = [[17.5, 22.5], [32.5, 22.5], [17.5, 37.5], [32.5, 37.5]];
  144 |     const rondePos = [[52.5, 62.5], [67.5, 62.5], [82.5, 62.5], [52.5, 80], [67.5, 80], [82.5, 80]];
  145 |     let iv = 0;
  146 |     let ir = 0;
  147 |     const tables = rows.map((t) => {
  148 |         const p = t.category_id === vipId ? vipPos[iv++] : rondePos[ir++];
  149 |         return { id: t.id, type_id: t.category_id, number: t.number, zone_id: null, x: p[0], y: p[1], shape: t.category_id === vipId ? 'CARREE' : 'RONDE', rotation: 0 };
  150 |     });
  151 |     await rpcOk('event_tables_save', { event_id: eventId, actor_id: owner.userId, plan_enabled: true, tables, zones: [] });
  152 | 
  153 |     const vipTables = rows.filter((t) => t.category_id === vipId);
  154 |     const rondeTables = rows.filter((t) => t.category_id === rondeId);
  155 |     const awa = await createClientAccount(`l11cc-a-${STAMP}`);
  156 |     const fatou = await createClientAccount(`l11cc-b-${STAMP}`);
  157 |     const moussa = await createClientAccount(`l11cc-c-${STAMP}`);
  158 |     const guest = await createClientAccount(`l11cc-g-${STAMP}`);
  159 |     const bookingA = await buyTable(eventId, awa, vipId, String(vipTables[2].id), true);
  160 |     await buyTable(eventId, fatou, rondeId, String(rondeTables[0].id), true);
  161 |     await buyTable(eventId, moussa, rondeId, String(rondeTables[1].id), false);
  162 | 
  163 |     const { data: seats, error: sErr } = await service.from('tickets').select('id, ticket_number').eq('event_table_booking_id', bookingA!).order('ticket_number');
  164 |     if (sErr || !seats || seats.length !== 6) throw new Error(`[l11cc] places de la table : ${sErr?.message ?? seats?.length}`);
  165 |     const transfer = await rpcOk('ticket_transfer_initiate', { ticket_id: seats[0].id, actor_id: awa.userId, recipient: guest.phone, expires_at: new Date(Date.now() + 48 * 3600_000).toISOString() });
  166 |     await rpcOk('ticket_transfer_accept', { transfer_id: transfer.transfer_id, actor_id: guest.userId });
  167 | 
  168 |     const controller = await createControllerAccount(`l11cc-${STAMP}`);
  169 |     const { error: aErr } = await service.from('event_controllers').upsert(
```