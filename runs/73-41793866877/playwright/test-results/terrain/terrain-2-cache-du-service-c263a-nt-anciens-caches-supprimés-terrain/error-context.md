# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: terrain.spec.ts >> 2. cache du service worker : coquille hors ligne et ressources statiques seulement, anciens caches supprimés
- Location: e2e/terrain.spec.ts:139:5

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
  71  |     async close(): Promise<void> {
  72  |         const issues = this.opened.flatMap(({ role, guard }) => [...guard.blockingIssues(), ...guard.nonBlockingIssues()].map((i) => `${role} : ${i}`));
  73  |         if (issues.length > 0) {
  74  |             console.log(`[e2e][terrain] ${this.testInfo.title} — observations du navigateur (non bloquantes) :\n${issues.join('\n')}`);
  75  |             await this.testInfo.attach('navigateur.txt', { body: issues.join('\n'), contentType: 'text/plain' });
  76  |         }
  77  |         for (const o of this.opened) await o.context.close();
  78  |     }
  79  | }
  80  | 
  81  | /** Carte du billet dans Mes billets (repérée par son numéro). */
  82  | function ticketCard(page: Page, ticketNumber: string): Locator {
  83  |     return page.locator('li, article').filter({ hasText: ticketNumber }).last();
  84  | }
  85  | 
  86  | async function expectOfflineAvailable(page: Page, ticketNumber: string): Promise<void> {
  87  |     const card = ticketCard(page, ticketNumber);
  88  |     await expect(card, `carte du billet ${ticketNumber} dans Mes billets`).toBeVisible({ timeout: 45_000 });
  89  |     await expect(card.locator('[data-ev-offline-state]'),
  90  |         `indicateur hors ligne de la carte ${ticketNumber} (contrat 5.2) : « available » attendu après le téléchargement automatique`)
  91  |         .toHaveAttribute('data-ev-offline-state', 'available', { timeout: 45_000 });
  92  | }
  93  | 
  94  | /** Scanne un payload et exige `[data-scan-result=<attendu>]` affiché. */
  95  | async function scanAndExpect(ctl: Page, payload: string, what: string, expected: string): Promise<ProbeRecord> {
  96  |     const { record } = await presentPayload(ctl, payload, what);
  97  |     await expect(ctl.locator(`[data-scan-result="${expected}"]`).first(), `${what} : résultat « ${expected} » attendu (sonde : « ${record.result ?? '—'} »)`).toBeVisible();
  98  |     return record;
  99  | }
  100 | 
  101 | // ── 1. Écart d'horloge ±5 min ─────────────────────────────────────────────
  102 | 
  103 | for (const [label, offsetMin] of [['en avance de 5 min', 5], ['en retard de 5 min', -5]] as const) {
  104 |     test(`1. téléphone ${label} : codes téléchargés, hors ligne, QR accepté par le contrôleur`, async ({ browser }, testInfo) => {
  105 |         test.setTimeout(5 * 60_000);
  106 |         const s = new Session(browser, testInfo);
  107 |         let ev: TerrainEvent | null = null;
  108 |         try {
  109 |             ev = prepareTerrainEvent(`écart ${offsetMin > 0 ? '+' : ''}${offsetMin} min`, 'client', 1);
  110 |             const ticket = ev.tickets[0];
  111 |             const client = await s.open('fumee-client', { serviceWorkers: 'allow', clockOffsetMs: offsetMin * 60_000 });
  112 |             await client.page.goto('/tickets');
  113 |             await expectOfflineAvailable(client.page, ticket.number);
  114 | 
  115 |             await client.context.setOffline(true);
  116 |             client.guard.freeze(); // passage hors ligne volontaire : la collecte d'erreurs s'arrête
  117 |             const res = await client.page.goto(`${OFFLINE_PATH}?id=${ticket.id}`);
  118 |             expect(res?.fromServiceWorker(), `${OFFLINE_PATH} hors ligne : réponse servie par le service worker`).toBe(true);
  119 |             const qr = client.page.locator('[data-ev-qr-payload]');
  120 |             await expect(qr, 'QR du billet affiché hors ligne (data-ev-qr-payload)').toBeVisible({ timeout: 20_000 });
  121 |             const payload = String(await qr.getAttribute('data-ev-qr-payload'));
  122 |             expect(payload, 'payload du QR hors ligne : <préfixe>:<billet>:<6 chiffres>').toMatch(new RegExp(`:${ticket.id}:\\d{6}$`));
  123 | 
  124 |             const ctl = await s.open('fumee-controleur', { probe: true });
  125 |             await openScanner(ctl.page, ev.title);
  126 |             await scanAndExpect(ctl.page, payload, `code affiché par un téléphone ${label}`, 'valid');
  127 |             const db = ticketScans(ticket.id);
  128 |             expect(db.ticket.status, `billet ${ticket.number} composté`).toBe('UTILISE');
  129 |             expect(db.scans.filter((r) => r.accepted).length, `une seule entrée acceptée : ${JSON.stringify(db.scans)}`).toBe(1);
  130 |         } finally {
  131 |             await s.close();
  132 |             restoreTerrainSetting(ev);
  133 |         }
  134 |     });
  135 | }
  136 | 
  137 | // ── 2. Cache du service worker sans /api/ ──────────────────────────────────
  138 | 
  139 | test('2. cache du service worker : coquille hors ligne et ressources statiques seulement, anciens caches supprimés', async ({ browser }, testInfo) => {
  140 |     test.setTimeout(4 * 60_000);
  141 |     const s = new Session(browser, testInfo);
  142 |     let ev: TerrainEvent | null = null;
  143 |     try {
  144 |         ev = prepareTerrainEvent('cache sans api', 'client', 1);
  145 |         const ticket = ev.tickets[0];
  146 |         const client = await s.open('fumee-client', { serviceWorkers: 'allow' });
  147 |         const servedApi: string[] = [];
  148 |         client.page.on('response', (r) => {
  149 |             if (r.fromServiceWorker() && new URL(r.url()).pathname.startsWith('/api/')) servedApi.push(`${r.status()} ${r.url()}`);
  150 |         });
  151 | 
  152 |         // Anciens caches créés avant tout enregistrement (page statique : aucun script de l'application)
  153 |         await client.page.goto('/manifest.json');
  154 |         const before = await client.page.evaluate(async () => {
  155 |             const registrations = (await navigator.serviceWorker.getRegistrations()).length;
  156 |             for (const name of ['event-village-v1', 'ev-hors-ligne-ancien']) {
  157 |                 const cache = await caches.open(name);
  158 |                 await cache.put('/__e2e-ancien', new Response('ancien cache du projet terrain'));
  159 |             }
  160 |             return { registrations, keys: (await caches.keys()).sort() };
  161 |         });
  162 |         expect(before, 'anciens caches posés avant l’enregistrement du service worker').toEqual({ registrations: 0, keys: ['ev-hors-ligne-ancien', 'event-village-v1'] });
  163 | 
  164 |         await client.page.goto('/tickets');
  165 |         await client.page.waitForFunction(async () => {
  166 |             const reg = await navigator.serviceWorker.getRegistration('/');
  167 |             return reg?.active?.state === 'activated';
  168 |         }, null, { timeout: 30_000 });
  169 |         await expect.poll(() => client.page.evaluate(async () => (await caches.keys()).sort()), {
  170 |             message: `caches après l’activation : seul ${OFFLINE_CACHE} attendu (event-village-v1 et ev-hors-ligne-ancien supprimés)`, timeout: 30_000,
> 171 |         }).toEqual([OFFLINE_CACHE]);
      |            ^ Error: caches après l’activation : seul ev-hors-ligne-lot7-1 attendu (event-village-v1 et ev-hors-ligne-ancien supprimés)
  172 |         await expectOfflineAvailable(client.page, ticket.number);
  173 | 
  174 |         const urls = await client.page.evaluate(async (name) => (await (await caches.open(name)).keys()).map((r) => r.url), OFFLINE_CACHE);
  175 |         const paths = urls.map((u) => new URL(u));
  176 |         const outside = paths.filter((u) => !(u.pathname === OFFLINE_PATH || u.pathname.startsWith('/_next/static/') || PUBLIC_ASSETS.includes(u.pathname)));
  177 |         const forbidden = paths.filter((u) => u.pathname.startsWith('/api/') || u.searchParams.has('_rsc'));
  178 |         console.log(`[e2e][terrain] cache ${OFFLINE_CACHE} : ${urls.length} entrée(s)\n${urls.join('\n')}`);
  179 |         expect(forbidden.map(String), 'aucune réponse /api/ ni charge _rsc en cache').toEqual([]);
  180 |         expect(outside.map(String), `cache limité à ${OFFLINE_PATH}, /_next/static/ et aux ressources publiques du contrat 5.3`).toEqual([]);
  181 |         expect(paths.some((u) => u.pathname === OFFLINE_PATH), `coquille ${OFFLINE_PATH} en cache`).toBe(true);
  182 |         expect(paths.some((u) => u.pathname.startsWith('/_next/static/')), 'ressources /_next/static/ de la coquille en cache').toBe(true);
  183 |         expect(servedApi, 'aucune réponse /api/ servie par le service worker').toEqual([]);
  184 | 
  185 |         await client.context.setOffline(true);
  186 |         client.guard.freeze();
  187 |         const outcome = await client.page.evaluate(async (id) => {
  188 |             try {
  189 |                 const r = await fetch(`/api/tickets/${id}/offline-codes`, { cache: 'no-store' });
  190 |                 return `servi (HTTP ${r.status})`;
  191 |             } catch (err) {
  192 |                 return `rejeté (${err instanceof Error ? err.message : String(err)})`;
  193 |             }
  194 |         }, ticket.id);
  195 |         expect(outcome, 'hors ligne, la route des codes n’est jamais servie depuis un cache').toMatch(/^rejeté/);
  196 |     } finally {
  197 |         await s.close();
  198 |         restoreTerrainSetting(ev);
  199 |     }
  200 | });
  201 | 
  202 | // ── 3. Idempotence : réponse perdue puis relance ───────────────────────────
  203 | 
  204 | test('3. réponse du scan perdue : relance automatique avec la même clé, une seule entrée', async ({ browser }, testInfo) => {
  205 |     test.setTimeout(4 * 60_000);
  206 |     const s = new Session(browser, testInfo);
  207 |     let ev: TerrainEvent | null = null;
  208 |     try {
  209 |         ev = prepareTerrainEvent('idempotence', 'client-bis', 1);
  210 |         const ticket = ev.tickets[0];
  211 |         const holder = await s.holder('fumee-client-bis');
  212 |         const ctl = await s.open('fumee-controleur', { probe: true });
  213 |         await openScanner(ctl.page, ev.title);
  214 | 
  215 |         const posts: Array<string | null> = [];
  216 |         ctl.page.on('request', (req) => {
  217 |             if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/controller/scan') posts.push(req.headers()['idempotency-key'] ?? null);
  218 |         });
  219 |         let lost = 0;
  220 |         let lostStatus = 0;
  221 |         await ctl.page.route('**/api/controller/scan', async (route) => {
  222 |             if (route.request().method() !== 'POST' || lost > 0) {
  223 |                 await route.fallback();
  224 |                 return;
  225 |             }
  226 |             lost += 1;
  227 |             const served = await route.fetch(); // le serveur traite la lecture…
  228 |             lostStatus = served.status();
  229 |             await route.abort('timedout'); // … mais l'écran ne voit jamais la réponse
  230 |         });
  231 | 
  232 |         await presentPayload(ctl.page, await livePayload(holder, ticket.id), 'scan dont la première réponse est perdue', 60_000);
  233 |         expect(lost, 'une réponse perdue simulée').toBe(1);
  234 |         expect(lostStatus, 'la lecture perdue a bien été traitée par le serveur').toBe(200);
  235 |         await expect(ctl.page.locator('[data-scan-result="valid"]').first(),
  236 |             `relance automatique après la réponse perdue : « valid » attendu (envois : ${posts.length})`).toBeVisible({ timeout: 30_000 });
  237 |         await expect(ctl.page.locator('[data-scan-result="already_used"]'), 'jamais « déjà utilisé » pour la relance de sa propre lecture').toHaveCount(0);
  238 |         expect(posts.length, 'au moins deux envois (lecture perdue, puis relance)').toBeGreaterThanOrEqual(2);
  239 |         expect(posts[0], 'en-tête Idempotency-Key sur chaque envoi (D39)').toMatch(/^[0-9a-f-]{36}$/i);
  240 |         expect(new Set(posts).size, `même clé pour la lecture et sa relance : ${JSON.stringify(posts)}`).toBe(1);
  241 | 
  242 |         const db = ticketScans(ticket.id);
  243 |         expect(db.scans.filter((r) => r.accepted).length, `une seule ligne acceptée : ${JSON.stringify(db.scans)}`).toBe(1);
  244 |         expect(db.scans.filter((r) => r.result === 'already_used').length, `aucune ligne already_used : ${JSON.stringify(db.scans)}`).toBe(0);
  245 |         expect(db.ticket.status).toBe('UTILISE');
  246 |     } finally {
  247 |         await s.close();
  248 |         restoreTerrainSetting(ev);
  249 |     }
  250 | });
  251 | 
  252 | // ── 4. Mesure du scan : réseau normal, 3G, puis hors ligne ─────────────────
  253 | 
  254 | interface ScanRow { reseau: 'normal' | '3G'; attendu: 'valid' | 'already_used'; ticket: string; record: ProbeRecord }
  255 | 
  256 | /**
  257 |  * QR du pas courant d'un billet DÉJÀ COMPOSTÉ, d'un autre pas que `used` (anti-doublon D41). La route live-code
  258 |  * du porteur refuse un billet UTILISE (409, run 72) : le code est calculé par terrain-setup.ts `payload`
  259 |  * (lib/security/totp.ts, secret de la base locale), qui attend réellement le pas suivant si besoin (20 s au plus).
  260 |  */
  261 | function freshPayload(ticketId: string, used: string): string {
  262 |     const out = computedPayload(ticketId, codeOf(used));
  263 |     if (out.payload === used) throw new Error(`payload calculé du billet ${ticketId} identique à la lecture précédente`);
  264 |     if (out.status !== 'UTILISE') console.log(`[e2e][terrain] billet ${ticketId} au statut ${out.status} avant sa relecture (UTILISE attendu)`);
  265 |     return out.payload;
  266 | }
  267 | 
  268 | test('4. mesure du scan : 10 lectures en réseau normal, 10 en 3G, puis une lecture hors ligne', async ({ browser }, testInfo) => {
  269 |     test.setTimeout(12 * 60_000);
  270 |     const s = new Session(browser, testInfo);
  271 |     let ev: TerrainEvent | null = null;
```