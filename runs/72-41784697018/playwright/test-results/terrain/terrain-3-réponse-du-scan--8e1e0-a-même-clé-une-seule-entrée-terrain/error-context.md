# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: terrain.spec.ts >> 3. réponse du scan perdue : relance automatique avec la même clé, une seule entrée
- Location: e2e/terrain.spec.ts:202:5

# Error details

```
Error: relance automatique après la réponse perdue : « valid » attendu (envois : 1)

expect(locator).toBeVisible() failed

Locator: locator('[data-scan-result="valid"]').first()
Expected: visible
Timeout: 30000ms
Error: element(s) not found

Call log:
  - relance automatique après la réponse perdue : « valid » attendu (envois : 1) locator('[data-scan-result="valid"]').first() with timeout 30000ms
  - waiting for locator('[data-scan-result="valid"]').first()

```

```yaml
- banner:
  - link "Mon espace client":
    - /url: /
  - link "Event Village, accueil":
    - /url: /
  - button "Notifications, 1 non lue": "1"
  - link "Cheikh ControleurA":
    - /url: /controller/profile
  - button "Se déconnecter"
- main:
  - text: Contrôleur · Cheikh ControleurA
  - 'button "Voix wolof : Son activé" [pressed]'
  - text: Mes événements (5)
  - combobox "Mes événements (5)":
    - option "Terrain — idempotence 06.57.32" [selected]
    - option "Terrain — cache sans api 06.57.01"
    - option "Terrain — écart -5 min 06.56.14"
    - option "Terrain — écart +5 min 06.55.28"
    - option "TEST Concert A (publié, à venir)"
  - region "Terrain — idempotence 06.57.32":
    - heading "Terrain — idempotence 06.57.32" [level=2]
    - text: Esplanade des Parcelles Assainies
  - region "Statistiques du contrôle":
    - text: 1 Billets valides 1 Arrivées 0 Billets refusés
    - status: 1 arrivées, 0 billets refusés
  - alert:
    - paragraph: "Erreur réseau : réessayez"
    - paragraph: "Incident technique : le billet n’est pas en cause. Ne refusez pas le spectateur pour ce motif, réessayez."
  - group "Mode de contrôle":
    - button "Caméra" [pressed]
    - button "Saisie manuelle"
  - text: Scanner actif
  - region "Derniers scans":
    - heading "Derniers scans" [level=3]
    - list:
      - listitem:
        - text: "Erreur réseau : réessayez"
        - time: 06:57
  - button "Se déconnecter"
- alert
```

# Test source

```ts
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
  169 |         }).toEqual([OFFLINE_CACHE]);
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
> 234 |             `relance automatique après la réponse perdue : « valid » attendu (envois : ${posts.length})`).toBeVisible({ timeout: 30_000 });
      |                                                                                                           ^ Error: relance automatique après la réponse perdue : « valid » attendu (envois : 1)
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
  270 |         ev = prepareTerrainEvent('mesure du scan', 'client-bis', 10);
  271 |         const holder = await s.holder('fumee-client-bis');
  272 |         const ctl = await s.open('fumee-controleur', { probe: true });
  273 |         await openScanner(ctl.page, ev.title);
  274 | 
  275 |         const rows: ScanRow[] = [];
  276 |         const series: Array<{ reseau: 'normal' | '3G'; tickets: typeof ev.tickets }> = [
  277 |             { reseau: 'normal', tickets: ev.tickets.slice(0, 5) },
  278 |             { reseau: '3G', tickets: ev.tickets.slice(5, 10) },
  279 |         ];
  280 |         let cdp: Awaited<ReturnType<BrowserContext['newCDPSession']>> | null = null;
  281 |         for (const serie of series) {
  282 |             if (serie.reseau === '3G') {
  283 |                 // Bridage par CDP après le chargement (D83) ; jamais combiné à setOffline
  284 |                 cdp = await ctl.context.newCDPSession(ctl.page);
  285 |                 await cdp.send('Network.enable');
  286 |                 await cdp.send('Network.emulateNetworkConditions', cdpNetworkConditions(NET_3G));
  287 |             }
  288 |             const used = new Map<string, string>();
  289 |             for (const t of serie.tickets) {
  290 |                 const payload = await livePayload(holder, t.id);
  291 |                 used.set(t.id, payload);
  292 |                 const { record } = await presentPayload(ctl.page, payload, `${serie.reseau} : billet neuf ${t.number}`);
  293 |                 rows.push({ reseau: serie.reseau, attendu: 'valid', ticket: t.number, record });
  294 |             }
  295 |             for (const t of serie.tickets) {
  296 |                 const payload = await freshPayload(holder, t.id, used.get(t.id) as string);
  297 |                 const { record } = await presentPayload(ctl.page, payload, `${serie.reseau} : billet déjà utilisé ${t.number}`);
  298 |                 rows.push({ reseau: serie.reseau, attendu: 'already_used', ticket: t.number, record });
  299 |             }
  300 |         }
  301 |         if (cdp) {
  302 |             await cdp.send('Network.emulateNetworkConditions', CDP_NO_THROTTLING);
  303 |             await cdp.detach();
  304 |         }
  305 | 
  306 |         // Marques de l'application, rattachées à chaque lecture (entre sa présentation et la suivante)
  307 |         const marks = (await scanMarks(ctl.page)).sort((a, b) => a.startTime - b.startTime);
  308 |         const armed = rows.map((r) => r.record.armedAt);
  309 |         const measured = rows.map((r, i) => {
  310 |             const lo = armed[i];
  311 |             const hi = i + 1 < armed.length ? armed[i + 1] : Number.POSITIVE_INFINITY;
  312 |             const read = marks.find((m) => m.name === 'ev-scan:read' && m.startTime >= lo && m.startTime < hi) ?? null;
  313 |             const pending = read ? marks.find((m) => m.name === 'ev-scan:pending' && m.startTime >= read.startTime && m.startTime < hi) ?? null : null;
  314 |             const result = read ? marks.find((m) => m.name === 'ev-scan:result' && m.startTime >= read.startTime && m.startTime < hi) ?? null : null;
  315 |             const p = r.record;
  316 |             return {
  317 |                 ...r,
  318 |                 sondeAttente: p.readAt !== null && p.pendingAt !== null ? p.pendingAt - p.readAt : null,
  319 |                 sondeResultat: p.readAt !== null && p.resultAt !== null ? p.resultAt - p.readAt : null,
  320 |                 marqueAttente: read && pending ? pending.startTime - read.startTime : null,
  321 |                 marqueResultat: read && result ? result.startTime - read.startTime : null,
  322 |             };
  323 |         });
  324 | 
  325 |         const summary: string[] = ['reseau\tsource\tmesure\tn\tmediane_ms\tp95_ms\tmin_ms\tmax_ms'];
  326 |         const stat = (reseau: 'normal' | '3G', pick: (m: typeof measured[number]) => number | null) => {
  327 |             const values = measured.filter((m) => m.reseau === reseau).map(pick).filter((v): v is number => v !== null);
  328 |             return { n: values.length, med: median(values), p95: percentile(values, 95), min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null };
  329 |         };
  330 |         const results: Record<string, ReturnType<typeof stat>> = {};
  331 |         for (const reseau of ['normal', '3G'] as const) {
  332 |             for (const [source, mesure, pick] of [
  333 |                 ['marques', 'attente', (m: typeof measured[number]) => m.marqueAttente],
  334 |                 ['marques', 'resultat', (m: typeof measured[number]) => m.marqueResultat],
```