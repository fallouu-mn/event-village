# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: terrain.spec.ts >> 2. cache du service worker : coquille hors ligne et ressources statiques seulement, anciens caches supprimés
- Location: e2e/terrain.spec.ts:154:5

# Error details

```
Error: caches après l’activation : seul ev-hors-ligne-lot7-1 attendu (event-village-v1 et ev-hors-ligne-ancien supprimés)

caches après l’activation : seul ev-hors-ligne-lot7-1 attendu (event-village-v1 et ev-hors-ligne-ancien supprimés)

expect(received).toEqual(expected) // deep equality

- Expected  - 3
+ Received  + 1

- Array [
-   "ev-hors-ligne-lot7-1",
- ]
+ Array []

Call Log:
- Timeout 30000ms exceeded while waiting on the predicate
```

# Test source

```ts
  86  |     async close(): Promise<void> {
  87  |         const issues = this.opened.flatMap(({ role, guard }) => [...guard.blockingIssues(), ...guard.nonBlockingIssues()].map((i) => `${role} : ${i}`));
  88  |         if (issues.length > 0) {
  89  |             console.log(`[e2e][terrain] ${this.testInfo.title} — observations du navigateur (non bloquantes) :\n${issues.join('\n')}`);
  90  |             await this.testInfo.attach('navigateur.txt', { body: issues.join('\n'), contentType: 'text/plain' });
  91  |         }
  92  |         for (const o of this.opened) await o.context.close();
  93  |     }
  94  | }
  95  | 
  96  | /** Carte du billet dans Mes billets (repérée par son numéro). */
  97  | function ticketCard(page: Page, ticketNumber: string): Locator {
  98  |     return page.locator('li, article').filter({ hasText: ticketNumber }).last();
  99  | }
  100 | 
  101 | async function expectOfflineAvailable(page: Page, ticketNumber: string): Promise<void> {
  102 |     const card = ticketCard(page, ticketNumber);
  103 |     await expect(card, `carte du billet ${ticketNumber} dans Mes billets`).toBeVisible({ timeout: 45_000 });
  104 |     await expect(card.locator('[data-ev-offline-state]'),
  105 |         `indicateur hors ligne de la carte ${ticketNumber} (contrat 5.2) : « available » attendu après le téléchargement automatique`)
  106 |         .toHaveAttribute('data-ev-offline-state', 'available', { timeout: 45_000 });
  107 | }
  108 | 
  109 | /** Scanne un payload et exige `[data-scan-result=<attendu>]` affiché. */
  110 | async function scanAndExpect(ctl: Page, payload: string, what: string, expected: string): Promise<ProbeRecord> {
  111 |     const { record } = await presentPayload(ctl, payload, what);
  112 |     await expect(ctl.locator(`[data-scan-result="${expected}"]`).first(), `${what} : résultat « ${expected} » attendu (sonde : « ${record.result ?? '—'} »)`).toBeVisible();
  113 |     return record;
  114 | }
  115 | 
  116 | // ── 1. Écart d'horloge ±5 min ─────────────────────────────────────────────
  117 | 
  118 | for (const [label, offsetMin] of [['en avance de 5 min', 5], ['en retard de 5 min', -5]] as const) {
  119 |     test(`1. téléphone ${label} : codes téléchargés, hors ligne, QR accepté par le contrôleur`, async ({ browser }, testInfo) => {
  120 |         test.setTimeout(5 * 60_000);
  121 |         const s = new Session(browser, testInfo);
  122 |         let ev: TerrainEvent | null = null;
  123 |         try {
  124 |             ev = prepareTerrainEvent(`écart ${offsetMin > 0 ? '+' : ''}${offsetMin} min`, 'client', 1);
  125 |             const ticket = ev.tickets[0];
  126 |             const client = await s.open('fumee-client', { serviceWorkers: 'allow', clockOffsetMs: offsetMin * 60_000 });
  127 |             await client.page.goto('/tickets');
  128 |             await expectOfflineAvailable(client.page, ticket.number);
  129 | 
  130 |             await client.context.setOffline(true);
  131 |             client.guard.freeze(); // passage hors ligne volontaire : la collecte d'erreurs s'arrête
  132 |             const res = await client.page.goto(`${OFFLINE_PATH}?id=${ticket.id}`);
  133 |             expect(res?.fromServiceWorker(), `${OFFLINE_PATH} hors ligne : réponse servie par le service worker`).toBe(true);
  134 |             const qr = client.page.locator('[data-ev-qr-payload]');
  135 |             await expect(qr, 'QR du billet affiché hors ligne (data-ev-qr-payload)').toBeVisible({ timeout: 20_000 });
  136 |             const payload = String(await qr.getAttribute('data-ev-qr-payload'));
  137 |             expect(payload, 'payload du QR hors ligne : <préfixe>:<billet>:<6 chiffres>').toMatch(new RegExp(`:${ticket.id}:\\d{6}$`));
  138 | 
  139 |             const ctl = await s.open('fumee-controleur', { probe: true });
  140 |             await openScanner(ctl.page, ev.title);
  141 |             await scanAndExpect(ctl.page, payload, `code affiché par un téléphone ${label}`, 'valid');
  142 |             const db = ticketScans(ticket.id);
  143 |             expect(db.ticket.status, `billet ${ticket.number} composté`).toBe('UTILISE');
  144 |             expect(db.scans.filter((r) => r.accepted).length, `une seule entrée acceptée : ${JSON.stringify(db.scans)}`).toBe(1);
  145 |         } finally {
  146 |             await s.close();
  147 |             restoreTerrainSetting(ev);
  148 |         }
  149 |     });
  150 | }
  151 | 
  152 | // ── 2. Cache du service worker sans /api/ ──────────────────────────────────
  153 | 
  154 | test('2. cache du service worker : coquille hors ligne et ressources statiques seulement, anciens caches supprimés', async ({ browser }, testInfo) => {
  155 |     test.setTimeout(4 * 60_000);
  156 |     const s = new Session(browser, testInfo);
  157 |     let ev: TerrainEvent | null = null;
  158 |     try {
  159 |         ev = prepareTerrainEvent('cache sans api', 'client', 1);
  160 |         const ticket = ev.tickets[0];
  161 |         const client = await s.open('fumee-client', { serviceWorkers: 'allow' });
  162 |         const servedApi: string[] = [];
  163 |         client.page.on('response', (r) => {
  164 |             if (r.fromServiceWorker() && new URL(r.url()).pathname.startsWith('/api/')) servedApi.push(`${r.status()} ${r.url()}`);
  165 |         });
  166 | 
  167 |         // Anciens caches créés avant tout enregistrement (page statique : aucun script de l'application)
  168 |         await client.page.goto('/manifest.json');
  169 |         const before = await client.page.evaluate(async () => {
  170 |             const registrations = (await navigator.serviceWorker.getRegistrations()).length;
  171 |             for (const name of ['event-village-v1', 'ev-hors-ligne-ancien']) {
  172 |                 const cache = await caches.open(name);
  173 |                 await cache.put('/__e2e-ancien', new Response('ancien cache du projet terrain'));
  174 |             }
  175 |             return { registrations, keys: (await caches.keys()).sort() };
  176 |         });
  177 |         expect(before, 'anciens caches posés avant l’enregistrement du service worker').toEqual({ registrations: 0, keys: ['ev-hors-ligne-ancien', 'event-village-v1'] });
  178 | 
  179 |         await client.page.goto('/tickets');
  180 |         await client.page.waitForFunction(async () => {
  181 |             const reg = await navigator.serviceWorker.getRegistration('/');
  182 |             return reg?.active?.state === 'activated';
  183 |         }, null, { timeout: 30_000 });
  184 |         await expect.poll(() => client.page.evaluate(async () => (await caches.keys()).sort()), {
  185 |             message: `caches après l’activation : seul ${OFFLINE_CACHE} attendu (event-village-v1 et ev-hors-ligne-ancien supprimés)`, timeout: 30_000,
> 186 |         }).toEqual([OFFLINE_CACHE]);
      |            ^ Error: caches après l’activation : seul ev-hors-ligne-lot7-1 attendu (event-village-v1 et ev-hors-ligne-ancien supprimés)
  187 |         await expectOfflineAvailable(client.page, ticket.number);
  188 | 
  189 |         const urls = await client.page.evaluate(async (name) => (await (await caches.open(name)).keys()).map((r) => r.url), OFFLINE_CACHE);
  190 |         const paths = urls.map((u) => new URL(u));
  191 |         const outside = paths.filter((u) => !(u.pathname === OFFLINE_PATH || u.pathname.startsWith('/_next/static/') || PUBLIC_ASSETS.includes(u.pathname)));
  192 |         const forbidden = paths.filter((u) => u.pathname.startsWith('/api/') || u.searchParams.has('_rsc'));
  193 |         console.log(`[e2e][terrain] cache ${OFFLINE_CACHE} : ${urls.length} entrée(s)\n${urls.join('\n')}`);
  194 |         expect(forbidden.map(String), 'aucune réponse /api/ ni charge _rsc en cache').toEqual([]);
  195 |         expect(outside.map(String), `cache limité à ${OFFLINE_PATH}, /_next/static/ et aux ressources publiques du contrat 5.3`).toEqual([]);
  196 |         expect(paths.some((u) => u.pathname === OFFLINE_PATH), `coquille ${OFFLINE_PATH} en cache`).toBe(true);
  197 |         expect(paths.some((u) => u.pathname.startsWith('/_next/static/')), 'ressources /_next/static/ de la coquille en cache').toBe(true);
  198 |         expect(servedApi, 'aucune réponse /api/ servie par le service worker').toEqual([]);
  199 | 
  200 |         await client.context.setOffline(true);
  201 |         client.guard.freeze();
  202 |         const outcome = await client.page.evaluate(async (id) => {
  203 |             try {
  204 |                 const r = await fetch(`/api/tickets/${id}/offline-codes`, { cache: 'no-store' });
  205 |                 return `servi (HTTP ${r.status})`;
  206 |             } catch (err) {
  207 |                 return `rejeté (${err instanceof Error ? err.message : String(err)})`;
  208 |             }
  209 |         }, ticket.id);
  210 |         expect(outcome, 'hors ligne, la route des codes n’est jamais servie depuis un cache').toMatch(/^rejeté/);
  211 |     } finally {
  212 |         await s.close();
  213 |         restoreTerrainSetting(ev);
  214 |     }
  215 | });
  216 | 
  217 | // ── 3. Idempotence : réponse perdue puis relance ───────────────────────────
  218 | 
  219 | test('3. réponse du scan perdue : relance automatique avec la même clé, une seule entrée', async ({ browser }, testInfo) => {
  220 |     test.setTimeout(4 * 60_000);
  221 |     const s = new Session(browser, testInfo);
  222 |     let ev: TerrainEvent | null = null;
  223 |     try {
  224 |         ev = prepareTerrainEvent('idempotence', 'client-bis', 1);
  225 |         const ticket = ev.tickets[0];
  226 |         const holder = await s.holder('fumee-client-bis');
  227 |         const ctl = await s.open('fumee-controleur', { probe: true });
  228 |         await openScanner(ctl.page, ev.title);
  229 | 
  230 |         const posts: Array<string | null> = [];
  231 |         ctl.page.on('request', (req) => {
  232 |             if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/controller/scan') posts.push(req.headers()['idempotency-key'] ?? null);
  233 |         });
  234 |         let lost = 0;
  235 |         let lostStatus = 0;
  236 |         await ctl.page.route('**/api/controller/scan', async (route) => {
  237 |             if (route.request().method() !== 'POST' || lost > 0) {
  238 |                 await route.fallback();
  239 |                 return;
  240 |             }
  241 |             lost += 1;
  242 |             const served = await route.fetch(); // le serveur traite la lecture…
  243 |             lostStatus = served.status();
  244 |             await route.abort('timedout'); // … mais l'écran ne voit jamais la réponse
  245 |         });
  246 | 
  247 |         await presentPayload(ctl.page, await livePayload(holder, ticket.id), 'scan dont la première réponse est perdue', 60_000);
  248 |         expect(lost, 'une réponse perdue simulée').toBe(1);
  249 |         expect(lostStatus, 'la lecture perdue a bien été traitée par le serveur').toBe(200);
  250 |         await expect(ctl.page.locator('[data-scan-result="valid"]').first(),
  251 |             `relance automatique après la réponse perdue : « valid » attendu (envois : ${posts.length})`).toBeVisible({ timeout: 30_000 });
  252 |         await expect(ctl.page.locator('[data-scan-result="already_used"]'), 'jamais « déjà utilisé » pour la relance de sa propre lecture').toHaveCount(0);
  253 |         expect(posts.length, 'au moins deux envois (lecture perdue, puis relance)').toBeGreaterThanOrEqual(2);
  254 |         expect(posts[0], 'en-tête Idempotency-Key sur chaque envoi (D39)').toMatch(/^[0-9a-f-]{36}$/i);
  255 |         expect(new Set(posts).size, `même clé pour la lecture et sa relance : ${JSON.stringify(posts)}`).toBe(1);
  256 | 
  257 |         const db = ticketScans(ticket.id);
  258 |         expect(db.scans.filter((r) => r.accepted).length, `une seule ligne acceptée : ${JSON.stringify(db.scans)}`).toBe(1);
  259 |         expect(db.scans.filter((r) => r.result === 'already_used').length, `aucune ligne already_used : ${JSON.stringify(db.scans)}`).toBe(0);
  260 |         expect(db.ticket.status).toBe('UTILISE');
  261 |     } finally {
  262 |         await s.close();
  263 |         restoreTerrainSetting(ev);
  264 |     }
  265 | });
  266 | 
  267 | // ── 4. Mesure du scan : réseau normal, 3G, puis hors ligne ─────────────────
  268 | 
  269 | type Reseau = 'normal' | '3G';
  270 | interface ScanRow { reseau: Reseau; attendu: 'valid' | 'already_used'; ticket: string; record: ProbeRecord }
  271 | interface MeasuredRow extends ScanRow {
  272 |     sondeAttente: number | null;
  273 |     sondeResultat: number | null;
  274 |     /** Depuis la lecture envoyée par l'écran (dernière lecture avant le POST) : diffère si l'écran a ignoré une lecture. */
  275 |     sondeResultatEnvoyee: number | null;
  276 |     marqueAttente: number | null;
  277 |     marqueResultat: number | null;
  278 | }
  279 | 
  280 | /** Billets neufs par réseau (série 1), puis relectures « déjà utilisé » par réseau (série 2, D41 : autre pas). */
  281 | const SCAN_NEW_PER_NETWORK = 10;
  282 | const SCAN_USED_PER_NETWORK = 5;
  283 | const SCAN_SOURCES = [
  284 |     ['marques', 'attente', (m: MeasuredRow) => m.marqueAttente],
  285 |     ['marques', 'resultat', (m: MeasuredRow) => m.marqueResultat],
  286 |     ['sonde', 'attente', (m: MeasuredRow) => m.sondeAttente],
```