# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lot11cb.responsive.spec.ts >> Ma table et billet de l’invité, 390 px, sombre
- Location: e2e/lot11cb.responsive.spec.ts:293:13

# Error details

```
Error: connexion de c1.l11cb-g-9d7d74.777651538@recette.eventvillage.local : {"error":"Trop de tentatives de connexion depuis cette connexion. Réessayez plus tard.","code":"LOGIN_RATE_LIMITED","retryAfterSeconds":2696}

expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 429
```

# Test source

```ts
  1   | /**
  2   |  * Lot 11c-b — tables d'un événement : écrans du client, de bout en bout sur le serveur construit (job « responsive » de la
  3   |  * CI : nom en « …responsive.spec.ts »).
  4   |  *
  5   |  * Données propres au spec (la graine de démonstration n'est pas touchée) : deux événements publiés de la partenaire de
  6   |  * démonstration « organisateur2 » (le spec du lot 11c-c utilise « organisateur3 ») :
  7   |  *  - « Soirée des tables » avec plan : « Carré VIP » (4 × 6 places, 150 000 F) et « Table ronde » (6 × 8 places,
  8   |  *    120 000 F) ; une table vendue à Awa (titulaire) par le vrai achat (route du serveur, faux SamirPay, vrai webhook), une
  9   |  *    place envoyée et acceptée par un invité, une autre envoyée et en attente ; une table ronde vendue à une autre cliente
  10  |  *    (prise sur le plan) ;
  11  |  *  - « Brunch des tables » sans plan : « Table famille » (3 × 4 places, 60 000 F).
  12  |  * Service des tables ouvert le temps du spec (rouvert avant chaque écran : un autre spec peut le refermer), remis ensuite.
  13  |  *
  14  |  * Pour chaque thème (clair, sombre) et chaque largeur (390 et 1440 px), un nouveau client fait le vrai parcours à l'écran :
  15  |  * fiche avec l'onglet « Tables », plan et feuille de devis, « Réserver la table N », paiement Wave, « Table gardée » (compte à
  16  |  * rebours), paiement confirmé par le faux SamirPay → confirmation ; puis la fiche sans plan (type choisi, devis), « Ma
  17  |  * table » du titulaire et le billet de l'invité. Contrôle responsive (0 défaut bloquant) et capture de chaque écran :
  18  |  * .e2e-captures/captures-responsive/l11cb-<écran>__<largeur>__<thème>.jpg (publiées sur ci-results).
  19  |  */
  20  | import fs from 'node:fs';
  21  | import path from 'node:path';
  22  | import { randomUUID } from 'node:crypto';
  23  | import { request as pwRequest, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
  24  | import { test, expect, projectContextOptions, type ThemeKey } from './support/fixtures';
  25  | import { E2E_OUTPUT_DIR, readDemoIds } from './support/demo-ids';
  26  | import { createClientAccount, createPublishedEvent, partnerPosterOf, rpcOk, serviceClient, userIdByEmail, type ControllerAccount } from './support/service';
  27  | import { fakeServices } from './support/parcours';
  28  | import { runResponsiveChecks } from './support/responsive-checks';
  29  | import { TEST_PASSWORD } from './support/accounts';
  30  | import { APP_URL } from './support/env';
  31  | import { FIXTURE_USERS } from '../tests/helpers/fixture-data';
  32  | 
  33  | test.describe.configure({ mode: 'serial' });
  34  | 
  35  | const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
  36  | const THEMES: ReadonlyArray<{ key: ThemeKey; scheme: 'light' | 'dark' }> = [{ key: 'clair', scheme: 'light' }, { key: 'sombre', scheme: 'dark' }];
  37  | const WIDTHS = [{ width: 390, height: 844, phone: true }, { width: 1440, height: 900, phone: false }] as const;
  38  | const STAMP = randomUUID().slice(0, 6);
  39  | 
  40  | interface TableRow { id: string; number: number }
  41  | interface Seeded {
  42  |     planEventId: string;
  43  |     noPlanEventId: string;
  44  |     holder: ControllerAccount;
  45  |     guest: ControllerAccount;
  46  |     bookingId: string;
  47  |     /** Tables libres proposées aux clients des 4 parcours (une par thème et largeur). */
  48  |     free: TableRow[];
  49  | }
  50  | 
  51  | async function settle(page: Page): Promise<void> {
  52  |     await page.evaluate(() => document.fonts.ready.then(() => true));
  53  |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
  54  |     await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
  55  |     await page.waitForTimeout(350); // fin des transitions (≤ 300 ms)
  56  | }
  57  | 
  58  | async function shot(page: Page, name: string, width: number, theme: ThemeKey, full = true): Promise<void> {
  59  |     fs.mkdirSync(SHOTS, { recursive: true });
  60  |     await page.screenshot({ path: path.join(SHOTS, `l11cb-${name}__${width}__${theme}.jpg`), type: 'jpeg', quality: 80, caret: 'hide', scale: 'css', fullPage: full });
  61  | }
  62  | 
  63  | async function checkLayout(page: Page, width: number, phone: boolean, label: string): Promise<void> {
  64  |     const r = await runResponsiveChecks(page, { width, phone });
  65  |     expect(r.blocking, `${label} : défauts bloquants\n${r.blocking.join('\n')}`).toEqual([]);
  66  | }
  67  | 
  68  | async function themedContext(browser: Browser, testInfo: TestInfo, scheme: 'light' | 'dark'): Promise<BrowserContext> {
  69  |     const context = await browser.newContext({ ...projectContextOptions(testInfo), colorScheme: scheme });
  70  |     await context.addInitScript((value: string) => {
  71  |         try { window.localStorage.setItem('ev-theme', value); } catch { /* document opaque */ }
  72  |         document.cookie = `ev-theme=${value}; path=/`;
  73  |     }, scheme);
  74  |     return context;
  75  | }
  76  | 
  77  | async function login(context: BrowserContext, identifier: string): Promise<void> {
  78  |     const res = await context.request.post(`${APP_URL}/api/auth/login`, { data: { identifier, password: TEST_PASSWORD } });
> 79  |     expect(res.status(), `connexion de ${identifier} : ${await res.text()}`).toBe(200);
      |                                                                              ^ Error: connexion de c1.l11cb-g-9d7d74.777651538@recette.eventvillage.local : {"error":"Trop de tentatives de connexion depuis cette connexion. Réessayez plus tard.","code":"LOGIN_RATE_LIMITED","retryAfterSeconds":2696}
  80  | }
  81  | 
  82  | function dakar(at: Date): { date: string; time: string } {
  83  |     const iso = at.toISOString();
  84  |     return { date: iso.slice(0, 10), time: `${iso.slice(11, 16)}:00` };
  85  | }
  86  | 
  87  | async function waitFor<T>(label: string, read: () => Promise<T | null>, timeoutMs = 30_000): Promise<T> {
  88  |     const t0 = Date.now();
  89  |     for (;;) {
  90  |         const v = await read();
  91  |         if (v !== null) return v;
  92  |         if (Date.now() - t0 > timeoutMs) throw new Error(`[l11cb] ${label} : rien après ${timeoutMs} ms`);
  93  |         await new Promise((r) => setTimeout(r, 400));
  94  |     }
  95  | }
  96  | 
  97  | async function completePayment(paymentId: string): Promise<void> {
  98  |     const tx = await waitFor('transaction du paiement', async () => {
  99  |         const { data } = await serviceClient().from('payments').select('external_transaction_id').eq('id', paymentId).maybeSingle();
  100 |         return data?.external_transaction_id ? String(data.external_transaction_id) : null;
  101 |     });
  102 |     const done = await fakeServices('/__test/samirpay/complete', { transactionId: tx });
  103 |     expect(done.json.webhookStatus, `webhook réel : ${JSON.stringify(done.json)}`).toBe(200);
  104 | }
  105 | 
  106 | /** Achat d'une table par la vraie route, paiement confirmé par le faux SamirPay et le vrai webhook ; rend la vente. */
  107 | async function buyTable(eventId: string, buyer: ControllerAccount, typeId: string, tableId: string): Promise<string> {
  108 |     const api = await pwRequest.newContext({ baseURL: APP_URL });
  109 |     try {
  110 |         const log = await api.post('/api/auth/login', { data: { identifier: buyer.email, password: TEST_PASSWORD } });
  111 |         expect(log.status(), `connexion de l’acheteuse : ${await log.text()}`).toBe(200);
  112 |         const res = await api.post(`/api/events/${eventId}/tables/checkout`, {
  113 |             headers: { 'Idempotency-Key': `l11cb-${randomUUID()}` },
  114 |             data: { typeId, tableId, operator: 'WAVE', payerPhone: buyer.local },
  115 |         });
  116 |         const body = await res.json() as Record<string, unknown>;
  117 |         expect(res.status(), `achat de la table : ${JSON.stringify(body)}`).toBe(200);
  118 |         const paymentId = String(body.payment_id ?? '');
  119 |         await completePayment(paymentId);
  120 |         return waitFor('vente de la table', async () => {
  121 |             const { data } = await serviceClient().from('event_table_bookings').select('id').eq('payment_id', paymentId).maybeSingle();
  122 |             return data ? String(data.id) : null;
  123 |         });
  124 |     } finally {
  125 |         await api.dispose();
  126 |     }
  127 | }
  128 | 
  129 | async function setTablesService(open: boolean, actor: string): Promise<void> {
  130 |     const { data, error } = await serviceClient().rpc('event_tables_setting_set', { p_key: 'features.event_tables_enabled', p_value: { value: open }, p_actor: actor, p_reason: 'Captures du lot 11c-b' });
  131 |     if (error || (data as { ok?: boolean } | null)?.ok !== true) throw new Error(`[l11cb] interrupteur des tables : ${error?.message ?? JSON.stringify(data)}`);
  132 | }
  133 | 
  134 | async function seed(superadmin: string): Promise<Seeded> {
  135 |     const owner = readDemoIds().accounts.organisateur2;
  136 |     const service = serviceClient();
  137 |     const start = new Date(Date.now() + 26 * 3600_000);
  138 |     const end = new Date(start.getTime() + 5 * 3600_000);
  139 |     const s = dakar(start);
  140 |     const e = dakar(end);
  141 |     const poster = await partnerPosterOf(owner.userId);
  142 |     const planEventId = await createPublishedEvent({
  143 |         partnerUserId: owner.userId, superadminId: superadmin, title: `Soirée des tables ${STAMP}`,
  144 |         description: 'Captures du lot 11c-b (tables d’un événement, écrans du client). Données fictives.',
  145 |         startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time,
  146 |         location: 'Terrasse des Almadies', city: 'Dakar', capacity: 200, imageUrl: poster,
  147 |         categories: [{ name: 'Entrée', price: 5_000, total: 60 }],
  148 |     });
  149 |     const vip = await rpcOk('event_table_type_save', {
  150 |         event_id: planEventId, actor_id: owner.userId, count: 4,
  151 |         type: { name: 'Carré VIP', seats: 6, price: 150_000, included_text: 'Une bouteille et un plateau de fruits', onsite_note: '50 000 F de consommations sur place', payment_mode: 'FULL' },
  152 |     });
  153 |     const ronde = await rpcOk('event_table_type_save', {
  154 |         event_id: planEventId, actor_id: owner.userId, count: 6,
  155 |         type: { name: 'Table ronde', seats: 8, price: 120_000, included_text: 'Softs à volonté', payment_mode: 'FULL' },
  156 |     });
  157 |     const vipId = String((vip.type as Record<string, unknown>).id);
  158 |     const rondeId = String((ronde.type as Record<string, unknown>).id);
  159 |     const { data: rows, error } = await service.from('event_tables').select('id, number, category_id').eq('event_id', planEventId).order('number');
  160 |     if (error || !rows) throw new Error(`[l11cb] tables de l'événement : ${error?.message}`);
  161 |     const vipPos = [[17.5, 22.5], [32.5, 22.5], [17.5, 40], [32.5, 40]];
  162 |     const rondePos = [[57.5, 22.5], [72.5, 22.5], [87.5, 22.5], [57.5, 62.5], [72.5, 62.5], [87.5, 62.5]];
  163 |     let iv = 0;
  164 |     let ir = 0;
  165 |     const tables = rows.map((t) => {
  166 |         const p = t.category_id === vipId ? vipPos[iv++] : rondePos[ir++];
  167 |         return { id: t.id, type_id: t.category_id, number: t.number, zone_id: null, x: p[0], y: p[1], shape: t.category_id === vipId ? 'CARREE' : 'RONDE', rotation: 0 };
  168 |     });
  169 |     await rpcOk('event_tables_save', { event_id: planEventId, actor_id: owner.userId, plan_enabled: true, tables, zones: [] });
  170 |     const vipTables = rows.filter((t) => t.category_id === vipId).map((t) => ({ id: String(t.id), number: Number(t.number) }));
  171 |     const rondeTables = rows.filter((t) => t.category_id === rondeId).map((t) => ({ id: String(t.id), number: Number(t.number) }));
  172 | 
  173 |     const noPlanEventId = await createPublishedEvent({
  174 |         partnerUserId: owner.userId, superadminId: superadmin, title: `Brunch des tables ${STAMP}`,
  175 |         description: 'Captures du lot 11c-b (sans plan de salle). Données fictives.',
  176 |         startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time,
  177 |         location: 'Jardin du Plateau', city: 'Dakar', capacity: 100, imageUrl: poster,
  178 |         categories: [{ name: 'Entrée', price: 3_000, total: 40 }],
  179 |     });
```