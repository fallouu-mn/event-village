# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cvcb.responsive.spec.ts >> cvcb · invalidation >> T2 — fin par la tâche planifiée : la fiche montre « Événement terminé » en moins de 5 s
- Location: e2e/cvcb.responsive.spec.ts:251:9

# Error details

```
Error: fiche

expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 500
```

# Test source

```ts
  1   | /**
  2   |  * Contre-vérification du lot Carte B (22/11/2026) — preuves de bout en bout, serveur construit (job « responsive » de la
  3   |  * CI : nom en « …responsive.spec.ts »). Vert = attaque bloquée ; rouge = trou.
  4   |  *
  5   |  * Trous (rouges attendus) :
  6   |  *  T1 « Autour de moi » puis « Rechercher dans cette zone » : la zone envoyée au serveur est centrée sur la position du
  7   |  *     téléphone (centre retrouvé à quelques mètres près).
  8   |  *  T2 Fin d'événement par la tâche planifiée (vraie route GET /api/cron/events-finish, Bearer CRON_SECRET) : la fiche
  9   |  *     garde l'état « publié » (sans « Événement terminé ») bien au-delà de 5 s.
  10  |  *  T3 Nouveau nom commercial de la partenaire (PATCH /api/partner/profile) : la fiche (organisateur) garde l'ancien bien
  11  |  *     au-delà de 5 s.
  12  |  *
  13  |  * Garde-fous (verts attendus) :
  14  |  *  G1 « Autour de moi » seul : aucune requête (hors tuiles), aucun stockage, aucun cookie ne porte la position.
  15  |  *  G2 Écritures de la partenaire : position, dates, affiche, titre, annulation visibles sur la carte ou l'Explorer en moins
  16  |  *     de 5 s.
  17  |  *  G3 Middleware, requêtes HTTP brutes (chemins non normalisés par le client) : /leaflet/ ne sert que ses fichiers ; aucune
  18  |  *     page ni route protégée servie par ce biais.
  19  |  *  G4 CSP sous HTTPS de même origine (relais HTTP/2 local de la mesure mobile) : aucune violation img-src sur l'accueil,
  20  |  *     Explorer (liste et carte), la fiche (logos de paiement, carte du lieu), salles, tables, connexion, aide.
  21  |  *  G5 GET /api/events/carte sur le vrai serveur : paramètres piégés → 200 ou 400, jamais 500, réponse publique, rapide ;
  22  |  *     aucune écriture (POST, PUT, PATCH, DELETE refusés).
  23  |  *  G6 Fiche : aucune tuile avant « Afficher la carte » ; mention des fonds visible ensuite.
  24  |  *
  25  |  * Données : événements neufs de la partenaire de démonstration « organisateur3 » (utilisée par aucun autre test e2e),
  26  |  * connectée par l'API ; son nom commercial est rétabli à la fin de T3.
  27  |  */
  28  | import http from 'node:http';
  29  | import os from 'node:os';
  30  | import path from 'node:path';
  31  | import { randomUUID } from 'node:crypto';
  32  | import { pathToFileURL } from 'node:url';
  33  | import { request as pwRequest, type APIRequestContext, type Page } from '@playwright/test';
  34  | import { test, expect, projectContextOptions } from './support/fixtures';
  35  | import { readDemoIds } from './support/demo-ids';
  36  | import { dakarDayFrom } from './support/parcours';
  37  | import { createPublishedEvent, partnerPosterOf, serviceClient, userIdByEmail } from './support/service';
  38  | import { installNetworkGuard } from './support/network';
  39  | import { APP_URL, e2eConfig } from './support/env';
  40  | import { TEST_PASSWORD } from './support/accounts';
  41  | import { FIXTURE_USERS } from '../tests/helpers/fixture-data';
  42  | 
  43  | const STAMP = `cvcb${randomUUID().slice(0, 6)}`;
  44  | const MAX_STALE_MS = 5_000;
  45  | const PORT = new URL(APP_URL).port || '3000';
  46  | const TILE_HOST = /(^|\.)tiles\.stadiamaps\.com$/;
  47  | /** Position simulée du téléphone (Sacré-Cœur, Dakar). */
  48  | const POS = { latitude: 14.72153, longitude: -17.46831 };
  49  | 
  50  | async function waitUntil(label: string, check: () => Promise<boolean>, timeoutMs: number, stepMs = 250): Promise<number> {
  51  |     const t0 = Date.now();
  52  |     for (;;) {
  53  |         if (await check()) return Date.now() - t0;
  54  |         if (Date.now() - t0 > timeoutMs) throw new Error(`[cvcb] ${label} : toujours faux après ${timeoutMs} ms`);
  55  |         await new Promise((r) => setTimeout(r, stepMs));
  56  |     }
  57  | }
  58  | 
  59  | /** Mesure sans lever : temps écoulé, ou null si toujours faux après `timeoutMs`. */
  60  | async function measure(check: () => Promise<boolean>, timeoutMs: number, stepMs = 250): Promise<number | null> {
  61  |     try {
  62  |         return await waitUntil('mesure', check, timeoutMs, stepMs);
  63  |     } catch {
  64  |         return null;
  65  |     }
  66  | }
  67  | 
  68  | function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  69  |     const k = 111_320;
  70  |     return Math.hypot((a.lat - b.lat) * k, (a.lng - b.lng) * k * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180));
  71  | }
  72  | 
  73  | /** Nombres décimaux d'un texte à moins de 0,02° de la position simulée (≈ 2 km). */
  74  | function nearPosition(text: string): string[] {
  75  |     const out: string[] = [];
  76  |     for (const m of text.matchAll(/-?\d{1,3}\.\d{2,}/g)) {
  77  |         const n = Number(m[0]);
  78  |         if (Math.abs(n - POS.latitude) < 0.02 || Math.abs(n - POS.longitude) < 0.02) out.push(m[0]);
  79  |     }
  80  |     return out;
  81  | }
  82  | 
  83  | async function exploreHtml(request: APIRequestContext, q: string): Promise<string> {
  84  |     const res = await request.get(`/explore?q=${encodeURIComponent(q)}`);
  85  |     expect(res.status(), 'Explorer').toBe(200);
  86  |     return res.text();
  87  | }
  88  | 
  89  | async function mapEvents(request: APIRequestContext, q: string): Promise<Array<Record<string, unknown>>> {
  90  |     const res = await request.get(`/api/events/carte?q=${encodeURIComponent(q)}`);
  91  |     expect(res.status(), 'lecture de la carte').toBe(200);
  92  |     return ((await res.json()) as { events: Array<Record<string, unknown>> }).events;
  93  | }
  94  | 
  95  | async function ficheHtml(request: APIRequestContext, id: string): Promise<string> {
  96  |     const res = await request.get(`/events/${id}`);
> 97  |     expect(res.status(), 'fiche').toBe(200);
      |                                   ^ Error: fiche
  98  |     return res.text();
  99  | }
  100 | 
  101 | /** Session API de la partenaire « organisateur3 » (vraie route de connexion). */
  102 | async function organisateur3(): Promise<{ api: APIRequestContext; userId: string; partnerId: string }> {
  103 |     const acc = readDemoIds().accounts.organisateur3;
  104 |     const api = await pwRequest.newContext({ baseURL: APP_URL });
  105 |     const res = await api.post('/api/auth/login', { data: { identifier: acc.email, password: TEST_PASSWORD } });
  106 |     expect(res.status(), `connexion d’organisateur3 : ${await res.text()}`).toBe(200);
  107 |     const { data, error } = await serviceClient().from('partners').select('id').eq('user_id', acc.userId).single();
  108 |     if (error || !data) throw new Error(`[cvcb] partenaire d’organisateur3 : ${error?.message ?? 'introuvable'}`);
  109 |     return { api, userId: acc.userId, partnerId: String(data.id) };
  110 | }
  111 | 
  112 | async function publish(partnerUserId: string, title: string, offsetDays: number, lat = 14.7215, lng = -17.4683): Promise<string> {
  113 |     const day = dakarDayFrom(new Date(), offsetDays);
  114 |     return createPublishedEvent({
  115 |         partnerUserId,
  116 |         superadminId: await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email),
  117 |         title,
  118 |         description: 'Contre-vérification du lot Carte B (invalidation). Données fictives.',
  119 |         startDate: day, startTime: '20:00:00', endDate: day, endTime: '23:00:00',
  120 |         location: 'Esplanade de contre-vérification', city: 'Dakar', capacity: 100,
  121 |         imageUrl: await partnerPosterOf(partnerUserId),
  122 |         latitude: lat, longitude: lng,
  123 |         category: { name: 'Standard', price: 3500, total: 50 },
  124 |     });
  125 | }
  126 | 
  127 | async function updatedAt(id: string): Promise<string> {
  128 |     const { data, error } = await serviceClient().from('events').select('updated_at').eq('id', id).single();
  129 |     if (error || !data) throw new Error(`[cvcb] updated_at de ${id} : ${error?.message ?? 'introuvable'}`);
  130 |     return String(data.updated_at);
  131 | }
  132 | 
  133 | async function editEvent(api: APIRequestContext, id: string, patch: Record<string, unknown>): Promise<void> {
  134 |     const res = await api.put(`/api/partner/events/${id}`, { data: { patch, expected_updated_at: await updatedAt(id) } });
  135 |     expect(res.status(), `modification ${JSON.stringify(patch)} : ${await res.text()}`).toBe(200);
  136 | }
  137 | 
  138 | // ── « Autour de moi » ──────────────────────────────────────────────────────────────────────────────────────────────
  139 | 
  140 | // Lot Carte B3 : la carte d'Explorer montre aussi les salles et les restaurants quand leurs services sont ouverts ; ces
  141 | // tests tournent interrupteurs à leur valeur d'origine (groupe « autres » du verrou des services, comme les pages qui ne
  142 | // sont pas des services), jamais pendant les tests des services
  143 | test.beforeEach(async ({ servicesLock }) => { await servicesLock.enter('autres'); });
  144 | 
  145 | test.describe('cvcb · « Autour de moi »', () => {
  146 |     test.use({ geolocation: POS, permissions: ['geolocation'] });
  147 | 
  148 |     async function openMapAroundMe(page: Page): Promise<{ urls: string[]; bodies: string[]; tiles: string[] }> {
  149 |         const urls: string[] = [];
  150 |         const bodies: string[] = [];
  151 |         const tiles: string[] = [];
  152 |         page.on('request', (r) => {
  153 |             const u = new URL(r.url());
  154 |             if (TILE_HOST.test(u.hostname)) {
  155 |                 tiles.push(r.url());
  156 |                 return;
  157 |             }
  158 |             urls.push(r.url());
  159 |             const body = r.postData();
  160 |             if (body) bodies.push(body);
  161 |         });
  162 |         await page.setViewportSize({ width: 390, height: 844 });
  163 |         await page.goto('/explore?vue=carte', { waitUntil: 'load' });
  164 |         await expect(page.getByRole('region', { name: 'Carte des événements' })).toBeVisible({ timeout: 30_000 });
  165 |         await expect(page.locator('.leaflet-control-attribution')).toContainText('Stadia Maps', { timeout: 30_000 });
  166 |         urls.length = 0;
  167 |         bodies.length = 0;
  168 |         await page.getByRole('button', { name: 'Autour de moi' }).click();
  169 |         await expect(page.getByRole('button', { name: 'Rechercher dans cette zone' })).toBeVisible({ timeout: 15_000 });
  170 |         await page.waitForTimeout(1_500);
  171 |         return { urls, bodies, tiles };
  172 |     }
  173 | 
  174 |     test('G1 — « Autour de moi » seul : aucune requête, aucun stockage, aucun cookie ne porte la position', async ({ page, context }) => {
  175 |         test.setTimeout(120_000);
  176 |         const seen = await openMapAroundMe(page);
  177 |         const carried = [...seen.urls, ...seen.bodies].filter((t) => nearPosition(t).length > 0);
  178 |         console.log(`[cvcb] « Autour de moi » : ${seen.urls.length} requête(s) hors tuiles, ${seen.tiles.length} tuile(s) ; porteuses de la position : ${carried.length}`);
  179 |         expect(carried, 'requêtes qui portent la position').toEqual([]);
  180 |         const storage = await page.evaluate(() => JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage } }));
  181 |         expect(nearPosition(storage), `stockage : ${storage.slice(0, 300)}`).toEqual([]);
  182 |         const cookies = JSON.stringify(await context.cookies());
  183 |         expect(nearPosition(cookies), 'cookies').toEqual([]);
  184 |     });
  185 | 
  186 |     test('T1 — puis « Rechercher dans cette zone » : la zone envoyée ne doit pas permettre de retrouver la position (≥ 1 km)', async ({ page }) => {
  187 |         test.setTimeout(120_000);
  188 |         await openMapAroundMe(page);
  189 |         const req = page.waitForRequest((r) => r.url().includes('/api/events/carte') && r.url().includes('zone='), { timeout: 15_000 });
  190 |         await page.getByRole('button', { name: 'Rechercher dans cette zone' }).click();
  191 |         const url = new URL((await req).url());
  192 |         const [s, w, n, e] = (url.searchParams.get('zone') ?? '').split(',').map(Number);
  193 |         const centre = { lat: (s + n) / 2, lng: (w + e) / 2 };
  194 |         const d = metres({ lat: POS.latitude, lng: POS.longitude }, centre);
  195 |         console.log(`[cvcb] « Rechercher dans cette zone » après « Autour de moi » : ${url.pathname}${url.search} ; centre à ${d.toFixed(1)} m de la position`);
  196 |         expect(d, `position retrouvée au centre de la zone envoyée (${d.toFixed(1)} m) : ${url.search}`).toBeGreaterThanOrEqual(1_000);
  197 |     });
```