# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: terrain.spec.ts >> 2. cache du service worker : coquille hors ligne et ressources statiques seulement, anciens caches supprimés
- Location: e2e/terrain.spec.ts:137:5

# Error details

```
Error: caches après l’activation : seul ev-hors-ligne-lot7-1 attendu (event-village-v1 et ev-hors-ligne-ancien supprimés)

caches après l’activation : seul ev-hors-ligne-lot7-1 attendu (event-village-v1 et ev-hors-ligne-ancien supprimés)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 1

  Array [
-   "ev-hors-ligne-lot7-1",
+   "ev-hors-ligne-ancien",
  ]

Call Log:
- Timeout 30000ms exceeded while waiting on the predicate
```

# Test source

```ts
  69  |     async close(): Promise<void> {
  70  |         const issues = this.opened.flatMap(({ role, guard }) => [...guard.blockingIssues(), ...guard.nonBlockingIssues()].map((i) => `${role} : ${i}`));
  71  |         if (issues.length > 0) {
  72  |             console.log(`[e2e][terrain] ${this.testInfo.title} — observations du navigateur (non bloquantes) :\n${issues.join('\n')}`);
  73  |             await this.testInfo.attach('navigateur.txt', { body: issues.join('\n'), contentType: 'text/plain' });
  74  |         }
  75  |         for (const o of this.opened) await o.context.close();
  76  |     }
  77  | }
  78  | 
  79  | /** Carte du billet dans Mes billets (repérée par son numéro). */
  80  | function ticketCard(page: Page, ticketNumber: string): Locator {
  81  |     return page.locator('li, article').filter({ hasText: ticketNumber }).last();
  82  | }
  83  | 
  84  | async function expectOfflineAvailable(page: Page, ticketNumber: string): Promise<void> {
  85  |     const card = ticketCard(page, ticketNumber);
  86  |     await expect(card, `carte du billet ${ticketNumber} dans Mes billets`).toBeVisible({ timeout: 45_000 });
  87  |     await expect(card.locator('[data-ev-offline-state]'),
  88  |         `indicateur hors ligne de la carte ${ticketNumber} (contrat 5.2) : « available » attendu après le téléchargement automatique`)
  89  |         .toHaveAttribute('data-ev-offline-state', 'available', { timeout: 45_000 });
  90  | }
  91  | 
  92  | /** Scanne un payload et exige `[data-scan-result=<attendu>]` affiché. */
  93  | async function scanAndExpect(ctl: Page, payload: string, what: string, expected: string): Promise<ProbeRecord> {
  94  |     const { record } = await presentPayload(ctl, payload, what);
  95  |     await expect(ctl.locator(`[data-scan-result="${expected}"]`).first(), `${what} : résultat « ${expected} » attendu (sonde : « ${record.result ?? '—'} »)`).toBeVisible();
  96  |     return record;
  97  | }
  98  | 
  99  | // ── 1. Écart d'horloge ±5 min ─────────────────────────────────────────────
  100 | 
  101 | for (const [label, offsetMin] of [['en avance de 5 min', 5], ['en retard de 5 min', -5]] as const) {
  102 |     test(`1. téléphone ${label} : codes téléchargés, hors ligne, QR accepté par le contrôleur`, async ({ browser }, testInfo) => {
  103 |         test.setTimeout(5 * 60_000);
  104 |         const s = new Session(browser, testInfo);
  105 |         let ev: TerrainEvent | null = null;
  106 |         try {
  107 |             ev = prepareTerrainEvent(`écart ${offsetMin > 0 ? '+' : ''}${offsetMin} min`, 'client', 1);
  108 |             const ticket = ev.tickets[0];
  109 |             const client = await s.open('fumee-client', { serviceWorkers: 'allow', clockOffsetMs: offsetMin * 60_000 });
  110 |             await client.page.goto('/tickets');
  111 |             await expectOfflineAvailable(client.page, ticket.number);
  112 | 
  113 |             await client.context.setOffline(true);
  114 |             client.guard.freeze(); // passage hors ligne volontaire : la collecte d'erreurs s'arrête
  115 |             const res = await client.page.goto(`${OFFLINE_PATH}?id=${ticket.id}`);
  116 |             expect(res?.fromServiceWorker(), `${OFFLINE_PATH} hors ligne : réponse servie par le service worker`).toBe(true);
  117 |             const qr = client.page.locator('[data-ev-qr-payload]');
  118 |             await expect(qr, 'QR du billet affiché hors ligne (data-ev-qr-payload)').toBeVisible({ timeout: 20_000 });
  119 |             const payload = String(await qr.getAttribute('data-ev-qr-payload'));
  120 |             expect(payload, 'payload du QR hors ligne : <préfixe>:<billet>:<6 chiffres>').toMatch(new RegExp(`:${ticket.id}:\\d{6}$`));
  121 | 
  122 |             const ctl = await s.open('fumee-controleur', { probe: true });
  123 |             await openScanner(ctl.page, ev.title);
  124 |             await scanAndExpect(ctl.page, payload, `code affiché par un téléphone ${label}`, 'valid');
  125 |             const db = ticketScans(ticket.id);
  126 |             expect(db.ticket.status, `billet ${ticket.number} composté`).toBe('UTILISE');
  127 |             expect(db.scans.filter((r) => r.accepted).length, `une seule entrée acceptée : ${JSON.stringify(db.scans)}`).toBe(1);
  128 |         } finally {
  129 |             await s.close();
  130 |             restoreTerrainSetting(ev);
  131 |         }
  132 |     });
  133 | }
  134 | 
  135 | // ── 2. Cache du service worker sans /api/ ──────────────────────────────────
  136 | 
  137 | test('2. cache du service worker : coquille hors ligne et ressources statiques seulement, anciens caches supprimés', async ({ browser }, testInfo) => {
  138 |     test.setTimeout(4 * 60_000);
  139 |     const s = new Session(browser, testInfo);
  140 |     let ev: TerrainEvent | null = null;
  141 |     try {
  142 |         ev = prepareTerrainEvent('cache sans api', 'client', 1);
  143 |         const ticket = ev.tickets[0];
  144 |         const client = await s.open('fumee-client', { serviceWorkers: 'allow' });
  145 |         const servedApi: string[] = [];
  146 |         client.page.on('response', (r) => {
  147 |             if (r.fromServiceWorker() && new URL(r.url()).pathname.startsWith('/api/')) servedApi.push(`${r.status()} ${r.url()}`);
  148 |         });
  149 | 
  150 |         // Anciens caches créés avant tout enregistrement (page statique : aucun script de l'application)
  151 |         await client.page.goto('/manifest.json');
  152 |         const before = await client.page.evaluate(async () => {
  153 |             const registrations = (await navigator.serviceWorker.getRegistrations()).length;
  154 |             for (const name of ['event-village-v1', 'ev-hors-ligne-ancien']) {
  155 |                 const cache = await caches.open(name);
  156 |                 await cache.put('/__e2e-ancien', new Response('ancien cache du projet terrain'));
  157 |             }
  158 |             return { registrations, keys: (await caches.keys()).sort() };
  159 |         });
  160 |         expect(before, 'anciens caches posés avant l’enregistrement du service worker').toEqual({ registrations: 0, keys: ['ev-hors-ligne-ancien', 'event-village-v1'] });
  161 | 
  162 |         await client.page.goto('/tickets');
  163 |         await client.page.waitForFunction(async () => {
  164 |             const reg = await navigator.serviceWorker.getRegistration('/');
  165 |             return reg?.active?.state === 'activated';
  166 |         }, null, { timeout: 30_000 });
  167 |         await expect.poll(() => client.page.evaluate(async () => (await caches.keys()).sort()), {
  168 |             message: `caches après l’activation : seul ${OFFLINE_CACHE} attendu (event-village-v1 et ev-hors-ligne-ancien supprimés)`, timeout: 30_000,
> 169 |         }).toEqual([OFFLINE_CACHE]);
      |            ^ Error: caches après l’activation : seul ev-hors-ligne-lot7-1 attendu (event-village-v1 et ev-hors-ligne-ancien supprimés)
  170 |         await expectOfflineAvailable(client.page, ticket.number);
  171 | 
  172 |         const urls = await client.page.evaluate(async (name) => (await (await caches.open(name)).keys()).map((r) => r.url), OFFLINE_CACHE);
  173 |         const paths = urls.map((u) => new URL(u));
  174 |         const outside = paths.filter((u) => !(u.pathname === OFFLINE_PATH || u.pathname.startsWith('/_next/static/') || PUBLIC_ASSETS.includes(u.pathname)));
  175 |         const forbidden = paths.filter((u) => u.pathname.startsWith('/api/') || u.searchParams.has('_rsc'));
  176 |         console.log(`[e2e][terrain] cache ${OFFLINE_CACHE} : ${urls.length} entrée(s)\n${urls.join('\n')}`);
  177 |         expect(forbidden.map(String), 'aucune réponse /api/ ni charge _rsc en cache').toEqual([]);
  178 |         expect(outside.map(String), `cache limité à ${OFFLINE_PATH}, /_next/static/ et aux ressources publiques du contrat 5.3`).toEqual([]);
  179 |         expect(paths.some((u) => u.pathname === OFFLINE_PATH), `coquille ${OFFLINE_PATH} en cache`).toBe(true);
  180 |         expect(paths.some((u) => u.pathname.startsWith('/_next/static/')), 'ressources /_next/static/ de la coquille en cache').toBe(true);
  181 |         expect(servedApi, 'aucune réponse /api/ servie par le service worker').toEqual([]);
  182 | 
  183 |         await client.context.setOffline(true);
  184 |         client.guard.freeze();
  185 |         const outcome = await client.page.evaluate(async (id) => {
  186 |             try {
  187 |                 const r = await fetch(`/api/tickets/${id}/offline-codes`, { cache: 'no-store' });
  188 |                 return `servi (HTTP ${r.status})`;
  189 |             } catch (err) {
  190 |                 return `rejeté (${err instanceof Error ? err.message : String(err)})`;
  191 |             }
  192 |         }, ticket.id);
  193 |         expect(outcome, 'hors ligne, la route des codes n’est jamais servie depuis un cache').toMatch(/^rejeté/);
  194 |     } finally {
  195 |         await s.close();
  196 |         restoreTerrainSetting(ev);
  197 |     }
  198 | });
  199 | 
  200 | // ── 3. Idempotence : réponse perdue puis relance ───────────────────────────
  201 | 
  202 | test('3. réponse du scan perdue : relance automatique avec la même clé, une seule entrée', async ({ browser }, testInfo) => {
  203 |     test.setTimeout(4 * 60_000);
  204 |     const s = new Session(browser, testInfo);
  205 |     let ev: TerrainEvent | null = null;
  206 |     try {
  207 |         ev = prepareTerrainEvent('idempotence', 'client-bis', 1);
  208 |         const ticket = ev.tickets[0];
  209 |         const holder = await s.holder('fumee-client-bis');
  210 |         const ctl = await s.open('fumee-controleur', { probe: true });
  211 |         await openScanner(ctl.page, ev.title);
  212 | 
  213 |         const posts: Array<string | null> = [];
  214 |         ctl.page.on('request', (req) => {
  215 |             if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/controller/scan') posts.push(req.headers()['idempotency-key'] ?? null);
  216 |         });
  217 |         let lost = 0;
  218 |         let lostStatus = 0;
  219 |         await ctl.page.route('**/api/controller/scan', async (route) => {
  220 |             if (route.request().method() !== 'POST' || lost > 0) {
  221 |                 await route.fallback();
  222 |                 return;
  223 |             }
  224 |             lost += 1;
  225 |             const served = await route.fetch(); // le serveur traite la lecture…
  226 |             lostStatus = served.status();
  227 |             await route.abort('timedout'); // … mais l'écran ne voit jamais la réponse
  228 |         });
  229 | 
  230 |         await presentPayload(ctl.page, await livePayload(holder, ticket.id), 'scan dont la première réponse est perdue', 60_000);
  231 |         expect(lost, 'une réponse perdue simulée').toBe(1);
  232 |         expect(lostStatus, 'la lecture perdue a bien été traitée par le serveur').toBe(200);
  233 |         await expect(ctl.page.locator('[data-scan-result="valid"]').first(),
  234 |             `relance automatique après la réponse perdue : « valid » attendu (envois : ${posts.length})`).toBeVisible({ timeout: 30_000 });
  235 |         await expect(ctl.page.locator('[data-scan-result="already_used"]'), 'jamais « déjà utilisé » pour la relance de sa propre lecture').toHaveCount(0);
  236 |         expect(posts.length, 'au moins deux envois (lecture perdue, puis relance)').toBeGreaterThanOrEqual(2);
  237 |         expect(posts[0], 'en-tête Idempotency-Key sur chaque envoi (D39)').toMatch(/^[0-9a-f-]{36}$/i);
  238 |         expect(new Set(posts).size, `même clé pour la lecture et sa relance : ${JSON.stringify(posts)}`).toBe(1);
  239 | 
  240 |         const db = ticketScans(ticket.id);
  241 |         expect(db.scans.filter((r) => r.accepted).length, `une seule ligne acceptée : ${JSON.stringify(db.scans)}`).toBe(1);
  242 |         expect(db.scans.filter((r) => r.result === 'already_used').length, `aucune ligne already_used : ${JSON.stringify(db.scans)}`).toBe(0);
  243 |         expect(db.ticket.status).toBe('UTILISE');
  244 |     } finally {
  245 |         await s.close();
  246 |         restoreTerrainSetting(ev);
  247 |     }
  248 | });
  249 | 
  250 | // ── 4. Mesure du scan : réseau normal, 3G, puis hors ligne ─────────────────
  251 | 
  252 | interface ScanRow { reseau: 'normal' | '3G'; attendu: 'valid' | 'already_used'; ticket: string; record: ProbeRecord }
  253 | 
  254 | /** Payload courant d'un billet, différent de `used` (QR changé : pas suivant de 20 s). */
  255 | async function freshPayload(holder: Page, ticketId: string, used: string): Promise<string> {
  256 |     const deadline = Date.now() + 30_000;
  257 |     for (;;) {
  258 |         const p = await livePayload(holder, ticketId);
  259 |         if (p !== used) return p;
  260 |         if (Date.now() > deadline) throw new Error(`live-code du billet ${ticketId} : même code après 30 s`);
  261 |         await holder.waitForTimeout(2_000); // attente réelle du pas suivant du QR dynamique (20 s)
  262 |     }
  263 | }
  264 | 
  265 | test('4. mesure du scan : 10 lectures en réseau normal, 10 en 3G, puis une lecture hors ligne', async ({ browser }, testInfo) => {
  266 |     test.setTimeout(12 * 60_000);
  267 |     const s = new Session(browser, testInfo);
  268 |     let ev: TerrainEvent | null = null;
  269 |     try {
```