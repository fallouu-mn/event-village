# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cvcb.responsive.spec.ts >> cvcb · CSP >> G4 — aucune violation img-src sous HTTPS de même origine (accueil, Explorer, fiche, salles, tables, connexion, aide)
- Location: e2e/cvcb.responsive.spec.ts:372:9

# Error details

```
Error: page.goto: net::ERR_BLOCKED_BY_CLIENT at https://localhost:35143/
Call log:
  - navigating to "https://localhost:35143/", waiting until "load"

```

# Test source

```ts
  293 |             const res = await o3.api.patch('/api/partner/profile', { data: { commercial_name: newName } });
  294 |             expect(res.status(), `nouveau nom : ${await res.text()}`).toBe(200);
  295 |             const elapsed = await measure(async () => (await ficheHtml(page.request, id)).includes(newName), 70_000);
  296 |             console.log(`[cvcb] nouveau nom commercial visible sur la fiche après ${elapsed === null ? 'plus de 70 000' : elapsed} ms (événement ${id})`);
  297 |             expect(elapsed, 'nouveau nom visible').not.toBeNull();
  298 |             expect(elapsed ?? Infinity, 'en moins de 5 s').toBeLessThan(MAX_STALE_MS);
  299 |         } finally {
  300 |             const back = await o3.api.patch('/api/partner/profile', { data: { commercial_name: oldName } });
  301 |             console.log(`[cvcb] nom commercial rétabli : HTTP ${back.status()}`);
  302 |             await o3.api.dispose();
  303 |         }
  304 |     });
  305 | });
  306 | 
  307 | // ── Middleware : requêtes brutes ───────────────────────────────────────────────────────────────────────────────────
  308 | 
  309 | function rawGet(pathname: string): Promise<{ status: number; type: string; location: string; body: string }> {
  310 |     return new Promise((resolve, reject) => {
  311 |         const req = http.request({ host: '127.0.0.1', port: Number(PORT), method: 'GET', path: pathname, headers: { host: `localhost:${PORT}` } }, (res) => {
  312 |             const chunks: Buffer[] = [];
  313 |             res.on('data', (c: Buffer) => chunks.push(c));
  314 |             res.on('end', () => resolve({
  315 |                 status: res.statusCode ?? 0,
  316 |                 type: String(res.headers['content-type'] ?? ''),
  317 |                 location: String(res.headers.location ?? ''),
  318 |                 body: Buffer.concat(chunks).toString('utf8').slice(0, 4_000),
  319 |             }));
  320 |         });
  321 |         req.on('error', reject);
  322 |         req.setTimeout(20_000, () => req.destroy(new Error(`délai dépassé : ${pathname}`)));
  323 |         req.end();
  324 |     });
  325 | }
  326 | 
  327 | test.describe('cvcb · middleware', () => {
  328 |     test('G3 — /leaflet/ ne sert que ses fichiers ; aucun chemin détourné ne sert une page ou une route protégée', async () => {
  329 |         test.setTimeout(240_000);
  330 |         const css = await rawGet('/leaflet/leaflet-1.9.4.css');
  331 |         expect(css.status, 'feuille de style').toBe(200);
  332 |         expect(css.type).toContain('text/css');
  333 |         const png = await rawGet('/leaflet/marker-icon.png');
  334 |         expect(png.status, 'icône').toBe(200);
  335 |         expect((await rawGet('/leaflet/inexistant.js')).status, 'fichier absent').toBe(404);
  336 | 
  337 |         const targets = ['admin', 'admin/events', 'partner/dashboard', 'tickets', 'controller/scanner', 'api/admin/users', 'api/partner/profile', 'api/tickets', 'api/auth/me'];
  338 |         const forms = (t: string): string[] => [
  339 |             `/leaflet/../${t}`, `/leaflet/%2e%2e/${t}`, `/leaflet/..%2f${t}`, `/leaflet/..%2F${t}`, `/leaflet/%2e%2e%2f${t}`,
  340 |             `/leaflet/..%5c${t}`, `/leaflet/..\\${t}`, `/leaflet//../${t}`, `/leaflet/%252e%252e/${t}`, `/leaflet/..;/${t}`,
  341 |             `/leaflet/%2f${t}`, `/leaflet/${t}`, `/leaflet/x/../../${t}`, `//leaflet/../${t}`, `/leaflet/.%2e/${t}`,
  342 |         ];
  343 |         const leaks: string[] = [];
  344 |         const summary = new Map<string, number>();
  345 |         for (const t of targets) {
  346 |             for (const p of forms(t)) {
  347 |                 // Redirections suivies (3 au plus) : une redirection vers /admin ou /tickets n'est pas une fuite si la page
  348 |                 // d'arrivée est refusée sans session ; la fuite est une réponse 2xx d'une page ou d'une route protégée
  349 |                 let at = p;
  350 |                 let r = await rawGet(at);
  351 |                 const hops: string[] = [`${r.status}`];
  352 |                 for (let i = 0; i < 3 && r.status >= 300 && r.status < 400 && r.location; i++) {
  353 |                     at = new URL(r.location, `http://localhost:${PORT}`).pathname + new URL(r.location, `http://localhost:${PORT}`).search;
  354 |                     r = await rawGet(at);
  355 |                     hops.push(`${at.slice(0, 30)} ${r.status}`);
  356 |                 }
  357 |                 const key = hops.map((h) => h.replace(/^.* (\d+)$/, '$1')).join('→');
  358 |                 summary.set(key, (summary.get(key) ?? 0) + 1);
  359 |                 const finalPath = at.split('?')[0];
  360 |                 const servedLogin = finalPath === '/login';
  361 |                 if (r.status >= 200 && r.status < 300 && !servedLogin) leaks.push(`${p} → ${hops.join(' → ')} ${r.type} ${r.body.slice(0, 120).replace(/\s+/g, ' ')}`);
  362 |             }
  363 |         }
  364 |         console.log(`[cvcb] middleware, ${targets.length * forms('x').length} chemins détournés : ${JSON.stringify(Object.fromEntries(summary))}`);
  365 |         expect(leaks, leaks.join('\n')).toEqual([]);
  366 |     });
  367 | });
  368 | 
  369 | // ── CSP sous HTTPS de même origine ─────────────────────────────────────────────────────────────────────────────────
  370 | 
  371 | test.describe('cvcb · CSP', () => {
  372 |     test('G4 — aucune violation img-src sous HTTPS de même origine (accueil, Explorer, fiche, salles, tables, connexion, aide)', async ({ browser }, testInfo) => {
  373 |         test.setTimeout(240_000);
  374 |         const mod = await import(pathToFileURL(path.resolve('scripts/e2e/h2-proxy.mjs')).href) as {
  375 |             startH2Proxy: (target: string, dir: string) => Promise<{ origin: string; port: number; close: () => Promise<void> }>;
  376 |         };
  377 |         const proxy = await mod.startH2Proxy(`http://127.0.0.1:${PORT}`, path.join(os.tmpdir(), 'cvcb-h2'));
  378 |         const context = await openAnonymousContext(browser, testInfo, 'clair', { ignoreHTTPSErrors: true, baseURL: proxy.origin, viewport: { width: 390, height: 844 } });
  379 |         try {
  380 |             await installNetworkGuard(context, new Set([...e2eConfig().allowedHosts, `localhost:${proxy.port}`]));
  381 |             await context.addInitScript(() => {
  382 |                 const w = window as unknown as { __cvcbCsp: string[] };
  383 |                 w.__cvcbCsp = [];
  384 |                 document.addEventListener('securitypolicyviolation', (e) => {
  385 |                     w.__cvcbCsp.push(`${e.effectiveDirective} ${e.blockedURI} ${e.disposition} ${location.pathname}`);
  386 |                 });
  387 |             });
  388 |             const page = await context.newPage();
  389 |             const fiche = readDemoIds().events.publie.id;
  390 |             const pages = ['/', '/explore', '/explore?vue=carte', `/events/${fiche}`, '/halls', '/tables', '/login', '/aide'];
  391 |             const all: string[] = [];
  392 |             for (const p of pages) {
> 393 |                 await page.goto(p, { waitUntil: 'load' });
      |                            ^ Error: page.goto: net::ERR_BLOCKED_BY_CLIENT at https://localhost:35143/
  394 |                 expect(new URL(page.url()).origin, `${p} servie en HTTPS par le relais`).toBe(proxy.origin);
  395 |                 // Défilement complet : images paresseuses, logos de paiement, aperçu de la carte de l'accueil
  396 |                 await page.evaluate(async () => {
  397 |                     for (let y = 0; y < document.body.scrollHeight; y += 400) {
  398 |                         window.scrollTo(0, y);
  399 |                         await new Promise((r) => setTimeout(r, 120));
  400 |                     }
  401 |                 });
  402 |                 if (p.startsWith('/events/')) {
  403 |                     const show = page.getByRole('button', { name: 'Afficher la carte' });
  404 |                     if (await show.count()) await show.first().click();
  405 |                 }
  406 |                 await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
  407 |                 await page.waitForTimeout(800);
  408 |                 const v = await page.evaluate(() => (window as unknown as { __cvcbCsp?: string[] }).__cvcbCsp ?? []);
  409 |                 all.push(...v);
  410 |             }
  411 |             console.log(`[cvcb] CSP sous HTTPS (${proxy.origin}) : ${all.length} violation(s) ${JSON.stringify(all)}`);
  412 |             const img = all.filter((v) => v.startsWith('img-src'));
  413 |             expect(img, 'violations img-src').toEqual([]);
  414 |         } finally {
  415 |             await context.close();
  416 |             await proxy.close();
  417 |         }
  418 |     });
  419 | });
  420 | 
  421 | // ── Lecture publique sur le vrai serveur ───────────────────────────────────────────────────────────────────────────
  422 | 
  423 | test.describe('cvcb · lecture publique', () => {
  424 |     test('G5 — paramètres piégés : 200 ou 400, jamais 500, champs publics, rapide ; aucune écriture', async ({ request }) => {
  425 |         test.setTimeout(180_000);
  426 |         const traps = [
  427 |             '', 'zone=1e9,1,2,3', 'zone=-90,-180,90,180', 'zone=NaN,NaN,NaN,NaN', `zone=${'9'.repeat(3000)},1,2,3`, 'zone=14.7,-17.5,14.8,-17.4;DROP%20TABLE%20events',
  428 |             'du=2026-02-30&au=2026-03-01', 'du=0000-01-01&au=9999-01-01', `q=${'a'.repeat(4000)}`, "q='%20OR%201=1%20--", 'q=),or(status.neq.PUBLIE',
  429 |             'q=%00', 'categorie=BROUILLON', 'gratuit=1&gratuit=0', `ville=${'x'.repeat(4000)}`, 'quand=1;select', 'status=BROUILLON&select=*&limit=100000',
  430 |             'or=(status.eq.BROUILLON)', 'zone=14.6,-17.6,14.9,-17.2&q=CVCB&categorie=CONCERT&gratuit=1&ville=Dakar&quand=semaine',
  431 |         ];
  432 |         const fields = ['blur', 'color', 'endsAt', 'highlight', 'id', 'lat', 'lng', 'price', 'startsAt', 'title'];
  433 |         const statuses = new Map<number, number>();
  434 |         for (const q of traps) {
  435 |             const t0 = Date.now();
  436 |             const res = await request.get(`/api/events/carte${q ? `?${q}` : ''}`);
  437 |             const ms = Date.now() - t0;
  438 |             statuses.set(res.status(), (statuses.get(res.status()) ?? 0) + 1);
  439 |             expect([200, 400], `?${q.slice(0, 60)} : HTTP ${res.status()}`).toContain(res.status());
  440 |             expect(ms, `?${q.slice(0, 60)} : ${ms} ms`).toBeLessThan(5_000);
  441 |             expect(res.headers()['cache-control'] ?? '', 'no-store').toContain('no-store');
  442 |             if (res.status() === 200) {
  443 |                 const body = await res.json() as { events: Array<Record<string, unknown>>; total: number; truncated: boolean };
  444 |                 expect(Object.keys(body).sort()).toEqual(['events', 'total', 'truncated']);
  445 |                 expect(body.events.length).toBeLessThanOrEqual(300);
  446 |                 for (const e of body.events) expect(Object.keys(e).sort(), `?${q.slice(0, 60)}`).toEqual(fields);
  447 |             }
  448 |         }
  449 |         console.log(`[cvcb] lecture publique, ${traps.length} adresses piégées : ${JSON.stringify(Object.fromEntries(statuses))}`);
  450 |         for (const method of ['post', 'put', 'patch', 'delete'] as const) {
  451 |             const res = await request[method]('/api/events/carte', { data: { status: 'PUBLIE' } });
  452 |             expect(res.status(), `${method.toUpperCase()} /api/events/carte`).toBe(405);
  453 |         }
  454 |     });
  455 | 
  456 |     test('G6 — fiche : aucune tuile avant « Afficher la carte » ; mention des fonds visible ensuite', async ({ page }) => {
  457 |         test.setTimeout(120_000);
  458 |         const tiles: string[] = [];
  459 |         page.on('request', (r) => { if (TILE_HOST.test(new URL(r.url()).hostname)) tiles.push(r.url()); });
  460 |         await page.setViewportSize({ width: 390, height: 844 });
  461 |         await page.goto(`/events/${readDemoIds().events.publie.id}`, { waitUntil: 'load' });
  462 |         const show = page.getByRole('button', { name: 'Afficher la carte' });
  463 |         await show.scrollIntoViewIfNeeded();
  464 |         await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
  465 |         await page.waitForTimeout(1_000);
  466 |         expect(tiles, 'aucune tuile avant le geste').toEqual([]);
  467 |         await show.click();
  468 |         await expect(page.locator('.leaflet-control-attribution')).toContainText('Stadia Maps', { timeout: 30_000 });
  469 |         await expect(page.locator('.leaflet-control-attribution')).toContainText('contributeurs OpenStreetMap');
  470 |         await expect(page.locator('.leaflet-control-attribution')).toBeVisible();
  471 |         await waitUntil('tuiles demandées après le geste', async () => tiles.length > 0, 15_000);
  472 |     });
  473 | });
  474 | 
```