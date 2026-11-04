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
    - option "Terrain — idempotence 09.13.30" [selected]
    - option "Terrain — cache sans api 09.12.59"
    - option "Terrain — écart -5 min 09.12.12"
    - option "Terrain — écart +5 min 09.11.25"
    - option "TEST Concert A (publié, à venir)"
  - region "Terrain — idempotence 09.13.30":
    - heading "Terrain — idempotence 09.13.30" [level=2]
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
        - time: 09:13
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
  254 | type Reseau = 'normal' | '3G';
  255 | interface ScanRow { reseau: Reseau; attendu: 'valid' | 'already_used'; ticket: string; record: ProbeRecord }
  256 | interface MeasuredRow extends ScanRow {
  257 |     sondeAttente: number | null;
  258 |     sondeResultat: number | null;
  259 |     /** Depuis la lecture envoyée par l'écran (dernière lecture avant le POST) : diffère si l'écran a ignoré une lecture. */
  260 |     sondeResultatEnvoyee: number | null;
  261 |     marqueAttente: number | null;
  262 |     marqueResultat: number | null;
  263 | }
  264 | 
  265 | /** Billets neufs par réseau (série 1), puis relectures « déjà utilisé » par réseau (série 2, D41 : autre pas). */
  266 | const SCAN_NEW_PER_NETWORK = 10;
  267 | const SCAN_USED_PER_NETWORK = 5;
  268 | const SCAN_SOURCES = [
  269 |     ['marques', 'attente', (m: MeasuredRow) => m.marqueAttente],
  270 |     ['marques', 'resultat', (m: MeasuredRow) => m.marqueResultat],
  271 |     ['sonde', 'attente', (m: MeasuredRow) => m.sondeAttente],
  272 |     ['sonde', 'resultat', (m: MeasuredRow) => m.sondeResultat],
  273 |     ['sonde-lecture-envoyee', 'resultat', (m: MeasuredRow) => m.sondeResultatEnvoyee],
  274 | ] as const;
  275 | const SCAN_DETAIL_HEADER = 'reseau\tattendu\tobtenu_sonde\tbillet\tlectures\tpost\tsonde_attente_ms\tsonde_resultat_ms\tsonde_resultat_lecture_envoyee_ms\tmarque_attente_ms\tmarque_resultat_ms';
  276 | 
  277 | interface ScanStat { n: number; med: number | null; p95: number | null; min: number | null; max: number | null }
  278 | 
  279 | function scanStats(measured: MeasuredRow[]): Record<string, ScanStat> {
  280 |     const out: Record<string, ScanStat> = {};
  281 |     for (const reseau of ['normal', '3G'] as const) {
  282 |         for (const [source, mesure, pick] of SCAN_SOURCES) {
  283 |             const values = measured.filter((m) => m.reseau === reseau).map(pick).filter((v): v is number => v !== null);
  284 |             out[`${reseau}:${source}:${mesure}`] = {
  285 |                 n: values.length, med: median(values), p95: percentile(values, 95),
  286 |                 min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null,
  287 |             };
  288 |         }
  289 |     }
  290 |     return out;
  291 | }
  292 | 
  293 | /** scan.tsv réécrit après chaque lecture : un échec plus loin garde les mesures déjà prises. */
  294 | function writeScanSummary(measured: MeasuredRow[]): string {
  295 |     const st = scanStats(measured);
  296 |     const lines = ['reseau\tsource\tmesure\tn\tmediane_ms\tp95_ms\tmin_ms\tmax_ms'];
  297 |     for (const reseau of ['normal', '3G'] as const) {
  298 |         for (const [source, mesure] of SCAN_SOURCES) {
  299 |             const v = st[`${reseau}:${source}:${mesure}`];
  300 |             lines.push([reseau, source, mesure, v.n, fmtMs(v.med), fmtMs(v.p95), fmtMs(v.min), fmtMs(v.max)].join('\t'));
  301 |         }
  302 |     }
  303 |     return writePerfFile('scan.tsv', lines.join('\n'));
  304 | }
  305 | 
  306 | /**
  307 |  * Mesure d'une lecture, prise juste après son résultat : marques de l'application posées depuis la présentation
  308 |  * (aucune lecture suivante n'est encore présentée) et sonde ; ligne ajoutée à scan-lectures.tsv, scan.tsv réécrit.
  309 |  */
  310 | async function measureRow(page: Page, row: ScanRow, measured: MeasuredRow[]): Promise<MeasuredRow> {
  311 |     const lo = row.record.armedAt;
  312 |     const since = async () => (await scanMarks(page)).filter((m) => m.startTime >= lo).sort((a, b) => a.startTime - b.startTime);
  313 |     let marks = await since();
  314 |     // Marque de résultat posée après l'affichage relevé par la sonde : relue pendant 1 s au plus (aucune attente sans marque de lecture)
  315 |     for (let i = 0; i < 5; i++) {
  316 |         const r = marks.find((m) => m.name === 'ev-scan:read');
  317 |         if (!r || marks.some((m) => m.name === 'ev-scan:result' && m.startTime >= r.startTime)) break;
  318 |         await page.waitForTimeout(200);
  319 |         marks = await since();
  320 |     }
  321 |     const read = marks.find((m) => m.name === 'ev-scan:read') ?? null;
  322 |     const pending = read ? marks.find((m) => m.name === 'ev-scan:pending' && m.startTime >= read.startTime) ?? null : null;
  323 |     const result = read ? marks.find((m) => m.name === 'ev-scan:result' && m.startTime >= read.startTime) ?? null : null;
  324 |     const p = row.record;
  325 |     const m: MeasuredRow = {
  326 |         ...row,
  327 |         sondeAttente: p.readAt !== null && p.pendingAt !== null ? p.pendingAt - p.readAt : null,
  328 |         sondeResultat: p.readAt !== null && p.resultAt !== null ? p.resultAt - p.readAt : null,
  329 |         sondeResultatEnvoyee: p.lastReadAt !== null && p.resultAt !== null ? p.resultAt - p.lastReadAt : null,
  330 |         marqueAttente: read && pending ? pending.startTime - read.startTime : null,
  331 |         marqueResultat: read && result ? result.startTime - read.startTime : null,
  332 |     };
  333 |     measured.push(m);
  334 |     appendPerfFile('scan-lectures.tsv', SCAN_DETAIL_HEADER, [[m.reseau, m.attendu, m.record.result ?? '', m.ticket, m.record.reads, m.record.postAt !== null ? 'oui' : 'non',
  335 |         fmtMs(m.sondeAttente), fmtMs(m.sondeResultat), fmtMs(m.sondeResultatEnvoyee), fmtMs(m.marqueAttente), fmtMs(m.marqueResultat)].join('\t')]);
  336 |     writeScanSummary(measured);
```