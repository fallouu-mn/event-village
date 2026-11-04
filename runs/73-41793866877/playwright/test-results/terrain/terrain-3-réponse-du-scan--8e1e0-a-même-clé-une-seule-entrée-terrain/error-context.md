# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: terrain.spec.ts >> 3. réponse du scan perdue : relance automatique avec la même clé, une seule entrée
- Location: e2e/terrain.spec.ts:204:5

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
    - option "Terrain — idempotence 08.18.45" [selected]
    - option "Terrain — cache sans api 08.18.14"
    - option "Terrain — écart -5 min 08.17.27"
    - option "Terrain — écart +5 min 08.16.41"
    - option "TEST Concert A (publié, à venir)"
  - region "Terrain — idempotence 08.18.45":
    - heading "Terrain — idempotence 08.18.45" [level=2]
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
        - time: 08:18
  - button "Se déconnecter"
- alert
```

# Test source

```ts
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
  171 |         }).toEqual([OFFLINE_CACHE]);
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
> 236 |             `relance automatique après la réponse perdue : « valid » attendu (envois : ${posts.length})`).toBeVisible({ timeout: 30_000 });
      |                                                                                                           ^ Error: relance automatique après la réponse perdue : « valid » attendu (envois : 1)
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
  272 |     try {
  273 |         ev = prepareTerrainEvent('mesure du scan', 'client-bis', 10);
  274 |         const holder = await s.holder('fumee-client-bis');
  275 |         const ctl = await s.open('fumee-controleur', { probe: true });
  276 |         await openScanner(ctl.page, ev.title);
  277 | 
  278 |         const rows: ScanRow[] = [];
  279 |         const series: Array<{ reseau: 'normal' | '3G'; tickets: typeof ev.tickets }> = [
  280 |             { reseau: 'normal', tickets: ev.tickets.slice(0, 5) },
  281 |             { reseau: '3G', tickets: ev.tickets.slice(5, 10) },
  282 |         ];
  283 |         let cdp: Awaited<ReturnType<BrowserContext['newCDPSession']>> | null = null;
  284 |         for (const serie of series) {
  285 |             if (serie.reseau === '3G') {
  286 |                 // Bridage par CDP après le chargement (D83) ; jamais combiné à setOffline
  287 |                 cdp = await ctl.context.newCDPSession(ctl.page);
  288 |                 await cdp.send('Network.enable');
  289 |                 await cdp.send('Network.emulateNetworkConditions', cdpNetworkConditions(NET_3G));
  290 |             }
  291 |             const used = new Map<string, string>();
  292 |             for (const t of serie.tickets) {
  293 |                 const payload = await livePayload(holder, t.id);
  294 |                 used.set(t.id, payload);
  295 |                 const { record } = await presentPayload(ctl.page, payload, `${serie.reseau} : billet neuf ${t.number}`);
  296 |                 rows.push({ reseau: serie.reseau, attendu: 'valid', ticket: t.number, record });
  297 |             }
  298 |             for (const t of serie.tickets) {
  299 |                 const payload = freshPayload(t.id, used.get(t.id) as string);
  300 |                 const { record } = await presentPayload(ctl.page, payload, `${serie.reseau} : billet déjà utilisé ${t.number}`);
  301 |                 rows.push({ reseau: serie.reseau, attendu: 'already_used', ticket: t.number, record });
  302 |             }
  303 |         }
  304 |         if (cdp) {
  305 |             await cdp.send('Network.emulateNetworkConditions', CDP_NO_THROTTLING);
  306 |             await cdp.detach();
  307 |         }
  308 | 
  309 |         // Marques de l'application, rattachées à chaque lecture (entre sa présentation et la suivante)
  310 |         const marks = (await scanMarks(ctl.page)).sort((a, b) => a.startTime - b.startTime);
  311 |         const armed = rows.map((r) => r.record.armedAt);
  312 |         const measured = rows.map((r, i) => {
  313 |             const lo = armed[i];
  314 |             const hi = i + 1 < armed.length ? armed[i + 1] : Number.POSITIVE_INFINITY;
  315 |             const read = marks.find((m) => m.name === 'ev-scan:read' && m.startTime >= lo && m.startTime < hi) ?? null;
  316 |             const pending = read ? marks.find((m) => m.name === 'ev-scan:pending' && m.startTime >= read.startTime && m.startTime < hi) ?? null : null;
  317 |             const result = read ? marks.find((m) => m.name === 'ev-scan:result' && m.startTime >= read.startTime && m.startTime < hi) ?? null : null;
  318 |             const p = r.record;
  319 |             return {
  320 |                 ...r,
  321 |                 sondeAttente: p.readAt !== null && p.pendingAt !== null ? p.pendingAt - p.readAt : null,
  322 |                 sondeResultat: p.readAt !== null && p.resultAt !== null ? p.resultAt - p.readAt : null,
  323 |                 // Depuis la lecture envoyée par l'écran (dernière lecture avant le POST) : diffère de la précédente
  324 |                 // seulement si l'écran a ignoré une lecture (lectures > 1)
  325 |                 sondeResultatEnvoyee: p.lastReadAt !== null && p.resultAt !== null ? p.resultAt - p.lastReadAt : null,
  326 |                 marqueAttente: read && pending ? pending.startTime - read.startTime : null,
  327 |                 marqueResultat: read && result ? result.startTime - read.startTime : null,
  328 |             };
  329 |         });
  330 |         const ignored = measured.filter((m) => m.record.reads > 1);
  331 |         console.log(`[SCAN-MESURE] lectures ignorées par l'écran (QR relu au moins une fois avant l'envoi) : ${ignored.length} sur ${measured.length}`
  332 |             + `${ignored.length ? ` (${ignored.map((m) => `${m.reseau} ${m.ticket} : ${m.record.reads} lectures`).join(', ')})` : ''}`);
  333 | 
  334 |         const summary: string[] = ['reseau\tsource\tmesure\tn\tmediane_ms\tp95_ms\tmin_ms\tmax_ms'];
  335 |         const stat = (reseau: 'normal' | '3G', pick: (m: typeof measured[number]) => number | null) => {
  336 |             const values = measured.filter((m) => m.reseau === reseau).map(pick).filter((v): v is number => v !== null);
```