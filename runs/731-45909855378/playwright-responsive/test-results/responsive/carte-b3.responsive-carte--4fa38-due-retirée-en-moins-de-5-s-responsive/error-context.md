# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: carte-b3.responsive.spec.ts >> carte B3 · validation, lieu public, suspension >> salle validée : sur la carte en moins de 5 s à son point exact, adresse et itinéraire publics ; suspendue : retirée en moins de 5 s
- Location: e2e/carte-b3.responsive.spec.ts:81:9

# Error details

```
Error: champs publics seulement

expect(received).toEqual(expected) // deep equality

- Expected  - 0
+ Received  + 1

@@ -4,9 +4,10 @@
    "hours",
    "id",
    "lat",
    "lng",
    "name",
+   "orders",
    "photos",
    "price",
    "type",
  ]
```

# Test source

```ts
  1   | /**
  2   |  * Lot Carte B3 — salles et restaurants sur la carte d'Explorer, preuves de bout en bout dans le job « responsive » de la
  3   |  * CI (nom en « …responsive.spec.ts »), sous le verrou des services (e2e/support/services-switch.ts : interrupteurs
  4   |  * features.halls_enabled et features.tables_enabled ouverts le temps de ces tests seulement) :
  5   |  *  - invalidation : une salle validée par l'administration (POST /api/admin/halls/[id]/validation) arrive sur la carte en
  6   |  *    moins de 5 s ; suspendue, elle en disparaît en moins de 5 s ;
  7   |  *  - décision du client du 25/11 (application entièrement publique ; modification signalée au rapport, elle remplace les
  8   |  *    preuves de la zone de 300 m) : la carte montre le point exact ; la fiche publique, la recherche et la fiche de l'API
  9   |  *    donnent l'adresse et le point, avec « Voir l'itinéraire » ; rien de la partenaire ; champs publics seulement ;
  10  |  *  - couches gardées dans l'adresse (`couches=`), repère masqué avec sa couche ;
  11  |  *  - captures du rapport, clair et sombre : couches, repères des trois types, feuille du téléphone, liste de
  12  |  *    l'ordinateur, fiches d'une salle et d'un restaurant :
  13  |  *    .e2e-captures/captures-responsive/cb3-<écran>__<largeur>__<thème>.jpg (publiées sur ci-results).
  14  |  * En CI, aucune tuile ne vient d'Internet (verrou réseau : tuile neutre locale). Données : lieux neufs de la partenaire de
  15  |  * démonstration « organisateur » (noms uniques), retirés à la fin ; les lieux du seed servent aux captures.
  16  |  */
  17  | import fs from 'node:fs';
  18  | import path from 'node:path';
  19  | import { randomUUID } from 'node:crypto';
  20  | import type { APIRequestContext, Page } from '@playwright/test';
  21  | import { test, expect, type ThemeKey } from './support/fixtures';
  22  | import { readDemoIds, E2E_OUTPUT_DIR } from './support/demo-ids';
  23  | import { serviceClient, userIdByEmail } from './support/service';
  24  | import { FIXTURE_USERS } from '../tests/helpers/fixture-data';
  25  | 
  26  | const STAMP = randomUUID().slice(0, 8);
  27  | // Un seul worker pour tout le fichier : les salles de Thiès des captures sont créées une fois (deux jeux au même endroit
  28  | // seraient regroupés sur la carte)
  29  | test.describe.configure({ mode: 'serial' });
  30  | const MAX_STALE_MS = 5_000;
  31  | const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
  32  | 
  33  | /** Partenaire de démonstration « organisateur ». */
  34  | async function demoPartnerId(): Promise<string> {
  35  |     const { data, error } = await serviceClient().from('partners').select('id').eq('user_id', readDemoIds().accounts.organisateur.userId).single();
  36  |     if (error || !data) throw new Error(`[e2e] partenaire de démonstration : ${error?.message ?? 'absente'}`);
  37  |     return String(data.id);
  38  | }
  39  | 
  40  | /** Salle neuve de la partenaire de démonstration, en attente de validation (ou validée par la base si `validate`). */
  41  | async function newHall(spec: { name: string; address: string; lat: number; lng: number; city?: string; validate?: boolean }): Promise<string> {
  42  |     const svc = serviceClient();
  43  |     const { data, error } = await svc.from('halls').insert({
  44  |         partner_id: await demoPartnerId(), name: spec.name, capacity: 250, price_per_day: 150_000, city: spec.city ?? 'Dakar',
  45  |         address: spec.address, latitude: spec.lat, longitude: spec.lng, is_active: true,
  46  |         description: 'Salle du lot Carte B3 (données fictives).',
  47  |     }).select('id').single();
  48  |     if (error || !data) throw new Error(`[e2e] salle : ${error?.message ?? 'absente'}`);
  49  |     const id = String(data.id);
  50  |     if (spec.validate) {
  51  |         const { data: d, error: e } = await svc.rpc('hall_validation_decide', { p: { actor_id: await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email), hall_id: id, decision: 'VALIDER', reason: null } });
  52  |         if (e || (d as { ok?: boolean } | null)?.ok !== true) throw new Error(`[e2e] validation : ${e?.message ?? JSON.stringify(d)}`);
  53  |     }
  54  |     return id;
  55  | }
  56  | 
  57  | async function retire(id: string): Promise<void> {
  58  |     const { error } = await serviceClient().from('halls').update({ is_active: false }).eq('id', id);
  59  |     if (error) console.warn(`[carte-b3] salle ${id} non retirée : ${error.message}`);
  60  | }
  61  | 
  62  | async function waitUntil(label: string, check: () => Promise<boolean>, timeoutMs: number, stepMs = 250): Promise<number> {
  63  |     const t0 = Date.now();
  64  |     for (;;) {
  65  |         if (await check()) return Date.now() - t0;
  66  |         if (Date.now() - t0 > timeoutMs) throw new Error(`[e2e] ${label} : toujours faux après ${timeoutMs} ms`);
  67  |         await new Promise((r) => setTimeout(r, stepMs));
  68  |     }
  69  | }
  70  | 
  71  | async function hallsOnMap(request: APIRequestContext): Promise<Array<Record<string, unknown>>> {
  72  |     const res = await request.get('/api/lieux/carte?couche=salles');
  73  |     expect(res.status(), 'lecture des salles de la carte').toBe(200);
  74  |     return ((await res.json()) as { places: Array<Record<string, unknown>> }).places;
  75  | }
  76  | 
  77  | test.describe('carte B3 · validation, lieu public, suspension', () => {
  78  |     test.use({ evRole: 'fumee-superadmin' });
  79  |     test.beforeEach(async ({ servicesLock }) => { await servicesLock.enter('services'); });
  80  | 
  81  |     test('salle validée : sur la carte en moins de 5 s à son point exact, adresse et itinéraire publics ; suspendue : retirée en moins de 5 s', async ({ page, playwright, baseURL }) => {
  82  |         test.setTimeout(180_000);
  83  |         const point = { lat: 14.70417, lng: -17.45333 };
  84  |         const address = `Villa ${STAMP}, rue des Cocotiers`;
  85  |         const name = `Salle B3 ${STAMP}`;
  86  |         const id = await newHall({ name, address, ...point });
  87  |         try {
  88  |             const decide = await page.request.post(`/api/admin/halls/${id}/validation`, { data: { decision: 'VALIDER' } });
  89  |             expect(decide.status(), `validation : ${await decide.text()}`).toBe(200);
  90  |             const shownAfter = await waitUntil('salle sur la carte', async () => (await hallsOnMap(page.request)).some((p) => p.id === id), 65_000);
  91  |             console.log(`[carte-b3] salle validée visible sur la carte après ${shownAfter} ms`);
  92  |             expect(shownAfter, 'sur la carte en moins de 5 s').toBeLessThan(MAX_STALE_MS);
  93  | 
  94  |             const places = await hallsOnMap(page.request);
  95  |             const shown = places.find((p) => p.id === id)!;
> 96  |             expect(Object.keys(shown).sort(), 'champs publics seulement').toEqual(['area', 'capacity', 'hours', 'id', 'lat', 'lng', 'name', 'photos', 'price', 'type']);
      |                                                                           ^ Error: champs publics seulement
  97  |             expect({ lat: shown.lat, lng: shown.lng }, 'point exact (décision du 25/11)').toEqual(point);
  98  | 
  99  |             // Visiteur sans session (aucun cookie) : adresse, point et itinéraire publics ; rien de la partenaire
  100 |             const visitor = await playwright.request.newContext({ baseURL });
  101 |             const page0 = await (await visitor.get(`/halls/${id}`)).text();
  102 |             const search = await (await visitor.get(`/api/halls?q=${encodeURIComponent(STAMP)}`)).text();
  103 |             const apiOne = await (await visitor.get(`/api/halls/${id}`)).text();
  104 |             await visitor.dispose();
  105 |             expect(page0, 'fiche : adresse').toContain(address);
  106 |             expect(page0, 'fiche : itinéraire vers le point exact').toContain(`maps/dir/?api=1&amp;destination=${point.lat},${point.lng}`);
  107 |             expect(search, 'recherche par un mot de l’adresse').toContain(id);
  108 |             for (const [label, text] of [['recherche', search], ['fiche de l’API', apiOne]] as const) {
  109 |                 expect(text, `${label} : adresse`).toContain(address);
  110 |                 expect(text, `${label} : point`).toContain(String(point.lat));
  111 |             }
  112 |             const { data: pa } = await serviceClient().from('partners').select('company_name, phone, email').eq('id', await demoPartnerId()).single();
  113 |             for (const secret of [pa?.phone, pa?.email].filter((x): x is string => typeof x === 'string' && x.length > 0)) {
  114 |                 for (const [label, text] of [['fiche', page0], ['recherche', search], ['fiche de l’API', apiOne], ['carte', JSON.stringify(places)]] as const) {
  115 |                     expect(text.includes(secret), `${label} : coordonnée de la partenaire`).toBe(false);
  116 |                 }
  117 |             }
  118 | 
  119 |             const suspend = await page.request.post(`/api/admin/halls/${id}/validation`, { data: { decision: 'SUSPENDRE', reason: `Contrôle du lot Carte B3 ${STAMP}` } });
  120 |             expect(suspend.status(), `suspension : ${await suspend.text()}`).toBe(200);
  121 |             const goneAfter = await waitUntil('salle retirée de la carte', async () => !(await hallsOnMap(page.request)).some((p) => p.id === id), 65_000);
  122 |             console.log(`[carte-b3] salle suspendue retirée de la carte après ${goneAfter} ms`);
  123 |             expect(goneAfter, 'retirée en moins de 5 s').toBeLessThan(MAX_STALE_MS);
  124 |         } finally {
  125 |             await retire(id);
  126 |         }
  127 |     });
  128 | });
  129 | 
  130 | async function settle(page: Page): Promise<void> {
  131 |     await page.evaluate(() => document.fonts.ready.then(() => true));
  132 |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
  133 |     await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
  134 | }
  135 | 
  136 | /** Fait défiler jusqu'à un élément, placé sous l'en-tête et la barre collante des catégories d'Explorer (≈ 130 px). */
  137 | async function scrollToTop(page: Page, selector: string): Promise<void> {
  138 |     await page.locator(selector).first().evaluate((el) => {
  139 |         window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 132, behavior: 'instant' as ScrollBehavior });
  140 |     });
  141 |     await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
  142 | }
  143 | 
  144 | async function shot(page: Page, name: string, width: number, theme: ThemeKey): Promise<void> {
  145 |     fs.mkdirSync(SHOTS, { recursive: true });
  146 |     await page.waitForTimeout(350); // fin des transitions (≤ 300 ms)
  147 |     await page.screenshot({ path: path.join(SHOTS, `cb3-${name}__${width}__${theme}.jpg`), type: 'jpeg', quality: 80, caret: 'hide', scale: 'css' });
  148 | }
  149 | 
  150 | const LAYERS = '[role="group"][aria-label="Afficher sur la carte"]';
  151 | 
  152 | /** Salles des captures, à Thiès (« Aller à » Thiès, zoom 13), assez éloignées pour ne pas être regroupées. */
  153 | const THIES = {
  154 |     teranga: { name: `Salle Teranga ${STAMP}`, address: `Villa ${STAMP}, quartier Randoulène`, lat: 14.799, lng: -16.92, city: 'Thiès' },
  155 |     rails: { name: `Salle Les Rails ${STAMP}`, address: `Avenue de la Gare ${STAMP}, Thiès`, lat: 14.783, lng: -16.957, city: 'Thiès' },
  156 | } as const;
  157 | const thiesIds: string[] = [];
  158 | 
  159 | test.beforeAll(async () => {
  160 |     for (const spec of [THIES.teranga, THIES.rails]) thiesIds.push(await newHall({ ...spec, validate: true }));
  161 | });
  162 | test.afterAll(async () => {
  163 |     for (const id of thiesIds) await retire(id);
  164 | });
  165 | const MAP = '[role="region"][aria-label="Carte des événements et des lieux"]';
  166 | 
  167 | const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
  168 |     { key: 'clair', colorScheme: 'light' },
  169 |     { key: 'sombre', colorScheme: 'dark' },
  170 | ];
  171 | 
  172 | for (const theme of THEMES) {
  173 |     test.describe(`carte B3 · captures · ${theme.key}`, () => {
  174 |         test.use({ colorScheme: theme.colorScheme, evTheme: theme.key });
  175 |         test.beforeEach(async ({ context, servicesLock }) => {
  176 |             await servicesLock.enter('services');
  177 |             await context.addInitScript((value: string) => { document.cookie = `ev-theme=${value}; path=/`; }, theme.colorScheme);
  178 |         });
  179 | 
  180 |         test('couches, repères des trois types, feuille du téléphone (360 px)', async ({ page }) => {
  181 |             test.setTimeout(240_000);
  182 |             await page.setViewportSize({ width: 360, height: 780 });
  183 |             // Salles de Thiès créées sans passer par l'administration : cache de la carte (60 s au plus) attendu ici
  184 |             await waitUntil('salles de Thiès sur la carte', async () => {
  185 |                 const shown = new Set((await hallsOnMap(page.request)).map((p) => p.id));
  186 |                 return thiesIds.every((id) => shown.has(id));
  187 |             }, 75_000, 1_000);
  188 |             await page.goto('/explore?vue=carte', { waitUntil: 'load' });
  189 |             const layers = page.locator(LAYERS);
  190 |             await expect(layers.getByRole('button', { name: /Salles/ })).toBeVisible({ timeout: 30_000 });
  191 |             await expect(layers.getByRole('button', { name: /Restaurants/ })).toHaveAttribute('aria-pressed', 'true');
  192 | 
  193 |             // Thiès : un événement (billet), deux salles (bâtiment)
  194 |             await page.getByLabel('Aller à').selectOption('thies');
  195 |             const teranga = page.getByRole('button', { name: new RegExp(`^Salle Teranga ${STAMP},`) });
  196 |             await expect(teranga.locator('.ev-repere--salle')).toBeVisible({ timeout: 30_000 });
```