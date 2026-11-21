# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: perf.spec.ts >> Accueil : premier affichage utile et JavaScript chargé, 4G simulée et processeur ×4 (5 passages)
- Location: e2e/perf.spec.ts:391:9

# Error details

```
Error: request.sizes: Target page, context or browser has been closed
```

# Test source

```ts
  217 |         + `page masquée ${p.state.hiddenAt === null ? 'jamais' : `à ${Math.round(p.state.hiddenAt)} ms`} (état ${p.visibility}), `
  218 |         + `documents chargés ${p.state.docs ?? '?'}, navigation ${p.navType ?? '?'} vers ${p.path}`;
  219 | }
  220 | 
  221 | interface PassResult {
  222 |     pass: number;
  223 |     fcp: number | null;
  224 |     lcp: number | null;
  225 |     note: string | null;
  226 |     useful: number | null;
  227 |     usefulBy: string | null;
  228 |     jsBeforeUseful: number | null;
  229 |     js3s: number | null;
  230 |     css: number | null;
  231 |     total: number | null;
  232 |     jsNetwork: number | null;
  233 |     cameraMs: number | null;
  234 |     jsCamera: number | null;
  235 |     biggest: { name: string; bytes: number; ms: number; minMs: number } | null;
  236 |     error: string | null;
  237 | }
  238 | 
  239 | function readBudgets(): Record<string, number> {
  240 |     if (!fs.existsSync(BUDGET_FILE)) return {};
  241 |     const parsed = JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8')) as unknown;
  242 |     if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${BUDGET_FILE} : objet { "<route>": <octets> } attendu`);
  243 |     return parsed as Record<string, number>;
  244 | }
  245 | 
  246 | async function snapshot(page: Page, usefulAt: number | null): Promise<ResourceSnapshot> {
  247 |     return page.evaluate((useful) => {
  248 |         const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  249 |         let jsBeforeUseful = 0;
  250 |         let js = 0;
  251 |         let css = 0;
  252 |         let total = 0;
  253 |         let biggest: { name: string; bytes: number; ms: number } | null = null;
  254 |         const filesBefore: Array<{ path: string; bytes: number; start: number; end: number }> = [];
  255 |         const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  256 |         if (nav) total += nav.encodedBodySize;
  257 |         for (const e of entries) {
  258 |             let p = '';
  259 |             try {
  260 |                 p = new URL(e.name).pathname;
  261 |             } catch (err) {
  262 |                 console.warn(`[e2e][perf] URL de ressource illisible : ${err instanceof Error ? err.message : String(err)}`);
  263 |                 continue;
  264 |             }
  265 |             total += e.encodedBodySize;
  266 |             if (!p.startsWith('/_next/static/')) continue;
  267 |             if (p.endsWith('.js')) {
  268 |                 js += e.encodedBodySize;
  269 |                 if (useful !== null && e.responseEnd <= useful) {
  270 |                     jsBeforeUseful += e.encodedBodySize;
  271 |                     filesBefore.push({ path: p, bytes: e.encodedBodySize, start: e.startTime, end: e.responseEnd });
  272 |                 }
  273 |             } else if (p.endsWith('.css')) {
  274 |                 css += e.encodedBodySize;
  275 |             }
  276 |             if (!biggest || e.encodedBodySize > biggest.bytes) biggest = { name: p, bytes: e.encodedBodySize, ms: e.responseEnd - e.requestStart };
  277 |         }
  278 |         return { jsBeforeUseful, js, css, total, biggest, filesBefore };
  279 |     }, usefulAt);
  280 | }
  281 | 
  282 | async function onePass(browser: Browser, testInfo: TestInfo, screen: Screen, pass: number): Promise<PassResult> {
  283 |     const out: PassResult = {
  284 |         pass, fcp: null, lcp: null, note: null, useful: null, usefulBy: null, jsBeforeUseful: null, js3s: null, css: null, total: null,
  285 |         jsNetwork: null, cameraMs: null, jsCamera: null, biggest: null, error: null,
  286 |     };
  287 |     const context = await browser.newContext({
  288 |         ...projectContextOptions(testInfo),
  289 |         serviceWorkers: 'block',
  290 |         colorScheme: 'light',
  291 |         storageState: screen.role === 'anonyme' ? { cookies: [], origins: [] } : requireStorageState(screen.role),
  292 |     });
  293 |     try {
  294 |         await context.addInitScript({ content: 'window.__name = window.__name || function (f) { return f; };' });
  295 |         await context.addInitScript(setThemeBeforeLoad, 'light');
  296 |         if (screen.camera) await context.addInitScript(installFakeCamera, { mode: 'camera' as const });
  297 |         await context.addInitScript(installPerfProbe, { selectors: screen.selectors, buttonTexts: screen.buttonTexts ?? [] });
  298 |         const page = await context.newPage();
  299 |         const cdp = await context.newCDPSession(page);
  300 |         await cdp.send('Network.enable');
  301 |         await cdp.send('Network.setBlockedURLs', { urls: BLOCKED_URLS });
  302 |         await cdp.send('Network.emulateNetworkConditions', cdpNetworkConditions(NET_4G));
  303 |         await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  304 | 
  305 |         const networkSizes: Array<Promise<number>> = [];
  306 |         page.on('response', (r) => {
  307 |             const req = r.request();
  308 |             if (req.resourceType() !== 'script') return;
  309 |             let p = '';
  310 |             try {
  311 |                 p = new URL(r.url()).pathname;
  312 |             } catch (err) {
  313 |                 console.warn(`[e2e][perf] URL de script illisible : ${err instanceof Error ? err.message : String(err)}`);
  314 |                 return;
  315 |             }
  316 |             if (!p.startsWith('/_next/static/')) return;
> 317 |             networkSizes.push(req.sizes().then((s) => s.responseBodySize));
      |                                   ^ Error: request.sizes: Target page, context or browser has been closed
  318 |         });
  319 | 
  320 |         await page.goto(screen.path(), { waitUntil: 'commit', timeout: 120_000 });
  321 |         try {
  322 |             await page.waitForFunction(() => (window as unknown as { __evPerf?: PerfState }).__evPerf?.useful != null, null, { timeout: 90_000 });
  323 |         } catch (err) {
  324 |             throw new Error(`marqueur d'affichage utile introuvable en 90 s (sélecteurs : ${screen.selectors.join(' | ')}${screen.buttonTexts ? ` ; boutons : ${screen.buttonTexts.join(' | ')}` : ''}) : ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
  325 |         }
  326 |         const state = await page.evaluate(() => ({ ...(window as unknown as { __evPerf: PerfState }).__evPerf }));
  327 |         Object.assign(out, { fcp: state.fcp, lcp: state.lcp, useful: state.useful, usefulBy: state.usefulBy });
  328 |         const first = await snapshot(page, state.useful);
  329 |         out.jsBeforeUseful = first.jsBeforeUseful;
  330 |         // Design 1b (décision 3) : liste exacte des fichiers JavaScript arrivés avant le marqueur, pour l'analyse du poids
  331 |         appendPerfFile('js-avant-marqueur.tsv', ['ecran', 'passage', 'fichier', 'octets', 'debut_ms', 'fin_ms'].join('\t'), first.filesBefore
  332 |             .sort((a, b) => a.end - b.end)
  333 |             .map((x) => [screen.id, String(pass), x.path, String(x.bytes), String(Math.round(x.start)), String(Math.round(x.end))].join('\t')));
  334 |         await page.waitForTimeout(3_000); // (b) : JavaScript chargé à + 3 s (contrat 11.6)
  335 |         // FCP et LCP relus ici, toujours avant toute interaction (run 72 : scanner sans FCP ni LCP sur les 5
  336 |         // passages quand ils n'étaient lus qu'à l'apparition du marqueur) ; repli FCP sur la chronologie
  337 |         const paint = await readPaint(page);
  338 |         out.fcp = paint.state.fcp ?? paint.fcpTimeline ?? out.fcp;
  339 |         out.lcp = paint.state.lcp ?? out.lcp;
  340 |         out.note = paintNote(paint, out.fcp, out.lcp);
  341 |         if (state.fcp === null || state.lcp === null) {
  342 |             console.log(`[PERF] ${screen.id} passage ${pass} : à l'apparition du marqueur, FCP ${fmtMs(state.fcp)} ms et LCP ${fmtMs(state.lcp)} ms ; `
  343 |                 + `à + 3 s : FCP ${fmtMs(out.fcp)} ms, LCP ${fmtMs(out.lcp)} ms${out.note ? ` — ${out.note}` : ''}`);
  344 |         }
  345 |         const later = await snapshot(page, state.useful);
  346 |         out.js3s = later.js;
  347 |         out.css = later.css;
  348 |         out.total = later.total;
  349 |         out.jsNetwork = (await Promise.all(networkSizes)).reduce((a, b) => a + b, 0);
  350 |         if (later.biggest) out.biggest = { ...later.biggest, minMs: (later.biggest.bytes / NET_4G.downloadThroughput) * 1000 };
  351 | 
  352 |         if (screen.camera) {
  353 |             const start = page.getByRole('button', { name: /commencer le contr[ôo]le/i });
  354 |             if (await start.count() > 0 && await start.first().isVisible()) await start.first().click();
  355 |             const handle = await page.waitForFunction(
  356 |                 () => (Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2) ? performance.now() : false),
  357 |                 null, { timeout: 60_000 },
  358 |             ).catch((err: unknown) => {
  359 |                 throw new Error(`caméra simulée jamais en lecture en 60 s : ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
  360 |             });
  361 |             out.cameraMs = Number(await handle.jsonValue());
  362 |             await page.waitForTimeout(3_000);
  363 |             out.jsCamera = (await snapshot(page, null)).js;
  364 |         }
  365 |     } catch (err) {
  366 |         out.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  367 |     } finally {
  368 |         await context.close();
  369 |     }
  370 |     return out;
  371 | }
  372 | 
  373 | const TSV_HEADER = 'ecran\tpassage\tfcp_ms\tlcp_ms\tutile_ms\tmarqueur\tjs_avant_utile_o\tjs_3s_o\tcss_o\ttotal_o\tjs_reseau_o\tcamera_ms\tjs_camera_o\tplus_gros_fichier\tfichier_o\tfichier_ms\tfichier_min_ms\terreur\tnote_fcp_lcp';
  374 | 
  375 | function num(v: number | null): string {
  376 |     return v === null ? '' : String(Math.round(v));
  377 | }
  378 | 
  379 | function row(screen: Screen, label: string, r: Omit<PassResult, 'pass'>): string {
  380 |     return [screen.id, label, num(r.fcp), num(r.lcp), num(r.useful), r.usefulBy ?? '', num(r.jsBeforeUseful), num(r.js3s), num(r.css), num(r.total),
  381 |         num(r.jsNetwork), num(r.cameraMs), num(r.jsCamera), r.biggest?.name ?? '', num(r.biggest?.bytes ?? null), num(r.biggest?.ms ?? null),
  382 |         num(r.biggest?.minMs ?? null), r.error ?? '', (r.note ?? '').replace(/\s+/g, ' ')].join('\t');
  383 | }
  384 | 
  385 | function aggregate(results: PassResult[], pick: (r: PassResult) => number | null): { med: number | null; max: number | null } {
  386 |     const values = results.map(pick).filter((v): v is number => v !== null);
  387 |     return { med: median(values), max: values.length ? Math.max(...values) : null };
  388 | }
  389 | 
  390 | for (const screen of SCREENS) {
  391 |     test(`${screen.libelle} : premier affichage utile et JavaScript chargé, 4G simulée et processeur ×4 (5 passages)`, async ({ browser }, testInfo) => {
  392 |         test.setTimeout(10 * 60_000);
  393 |         const budgets = readBudgets();
  394 |         const results: PassResult[] = [];
  395 |         for (let pass = 1; pass <= PASSES; pass++) {
  396 |             const r = await onePass(browser, testInfo, screen, pass);
  397 |             results.push(r);
  398 |             appendPerfFile('perf.tsv', TSV_HEADER, [row(screen, String(pass), r)]);
  399 |             console.log(`[PERF] ${screen.id} passage ${pass} : ${r.error ? `ÉCHEC ${r.error}` : `FCP ${fmtMs(r.fcp)} ms, LCP ${fmtMs(r.lcp)} ms, utile ${fmtMs(r.useful)} ms (${r.usefulBy}), JS (a) ${r.jsBeforeUseful} o, JS (b) ${r.js3s} o, CSS ${r.css} o, total ${r.total} o${screen.camera ? `, caméra ${fmtMs(r.cameraMs)} ms, JS caméra ${r.jsCamera} o` : ''}`}`);
  400 |         }
  401 |         const keys: Array<[keyof Omit<PassResult, 'pass' | 'usefulBy' | 'biggest' | 'error' | 'note'>, string]> = [
  402 |             ['fcp', 'fcp'], ['lcp', 'lcp'], ['useful', 'utile'], ['jsBeforeUseful', 'js (a)'], ['js3s', 'js (b)'], ['css', 'css'], ['total', 'total'],
  403 |             ['jsNetwork', 'js réseau'], ['cameraMs', 'caméra'], ['jsCamera', 'js caméra'],
  404 |         ];
  405 |         const med: Omit<PassResult, 'pass'> = { fcp: null, lcp: null, note: null, useful: null, usefulBy: null, jsBeforeUseful: null, js3s: null, css: null, total: null, jsNetwork: null, cameraMs: null, jsCamera: null, biggest: null, error: null };
  406 |         const max: Omit<PassResult, 'pass'> = { ...med };
  407 |         for (const [k] of keys) {
  408 |             const a = aggregate(results, (r) => r[k]);
  409 |             med[k] = a.med;
  410 |             max[k] = a.max;
  411 |         }
  412 |         appendPerfFile('perf.tsv', TSV_HEADER, [row(screen, 'mediane', med), row(screen, 'max', max)]);
  413 |         const ko = (v: number | null) => (v === null ? '—' : `${(v / 1000).toFixed(1).replace('.', ',')} Ko`);
  414 |         const budget = Object.prototype.hasOwnProperty.call(budgets, screen.budgetRoute) ? budgets[screen.budgetRoute] : null;
  415 |         const lines = [
  416 |             `${screen.libelle} (${screen.path()}, ${screen.role}) — ${PASSES} passages, ${NET_4G.nom}, processeur ×4`,
  417 |             `  premier affichage utile : médiane ${fmtMs(med.useful)} ms, max ${fmtMs(max.useful)} ms ; FCP médiane ${fmtMs(med.fcp)} ms ; LCP médiane ${fmtMs(med.lcp)} ms, max ${fmtMs(max.lcp)} ms`,
```