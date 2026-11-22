# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cvcb.responsive.spec.ts >> cvcb · CSP >> G4 — aucune violation img-src sous HTTPS de même origine (accueil, Explorer, fiche, salles, tables, connexion, aide)
- Location: e2e/cvcb.responsive.spec.ts:372:9

# Error details

```
Error: violations img-src

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "img-src https://localhost:44293/images/paiement/wave.webp report /events/67e2945b-1504-418f-a816-a052ef21f418",
+   "img-src https://localhost:44293/images/paiement/om.webp report /events/67e2945b-1504-418f-a816-a052ef21f418",
+ ]
```

# Test source

```ts
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
  378 |         // Contexte ouvert à la main : le verrou réseau doit admettre l'hôte du relais (openAnonymousContext pose le verrou
  379 |         // par défaut, qui le refuse : run 624, ERR_BLOCKED_BY_CLIENT)
  380 |         const context = await browser.newContext({ ...projectContextOptions(testInfo), colorScheme: 'light', ignoreHTTPSErrors: true, baseURL: proxy.origin, viewport: { width: 390, height: 844 } });
  381 |         try {
  382 |             await installNetworkGuard(context, new Set([...e2eConfig().allowedHosts, `localhost:${proxy.port}`]));
  383 |             await context.addInitScript(() => {
  384 |                 const w = window as unknown as { __cvcbCsp: string[] };
  385 |                 w.__cvcbCsp = [];
  386 |                 document.addEventListener('securitypolicyviolation', (e) => {
  387 |                     w.__cvcbCsp.push(`${e.effectiveDirective} ${e.blockedURI} ${e.disposition} ${location.pathname}`);
  388 |                 });
  389 |             });
  390 |             const page = await context.newPage();
  391 |             const fiche = readDemoIds().events.publie.id;
  392 |             const pages = ['/', '/explore', '/explore?vue=carte', `/events/${fiche}`, '/halls', '/tables', '/login', '/aide'];
  393 |             const all: string[] = [];
  394 |             for (const p of pages) {
  395 |                 await page.goto(p, { waitUntil: 'load' });
  396 |                 expect(new URL(page.url()).origin, `${p} servie en HTTPS par le relais`).toBe(proxy.origin);
  397 |                 // Défilement complet : images paresseuses, logos de paiement, aperçu de la carte de l'accueil
  398 |                 await page.evaluate(async () => {
  399 |                     for (let y = 0; y < document.body.scrollHeight; y += 400) {
  400 |                         window.scrollTo(0, y);
  401 |                         await new Promise((r) => setTimeout(r, 120));
  402 |                     }
  403 |                 });
  404 |                 if (p.startsWith('/events/')) {
  405 |                     const show = page.getByRole('button', { name: 'Afficher la carte' });
  406 |                     if (await show.count()) await show.first().click();
  407 |                 }
  408 |                 await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
  409 |                 await page.waitForTimeout(800);
  410 |                 const v = await page.evaluate(() => (window as unknown as { __cvcbCsp?: string[] }).__cvcbCsp ?? []);
  411 |                 all.push(...v);
  412 |             }
  413 |             console.log(`[cvcb] CSP sous HTTPS (${proxy.origin}) : ${all.length} violation(s) ${JSON.stringify(all)}`);
  414 |             const img = all.filter((v) => v.startsWith('img-src'));
> 415 |             expect(img, 'violations img-src').toEqual([]);
      |                                               ^ Error: violations img-src
  416 |         } finally {
  417 |             await context.close();
  418 |             await proxy.close();
  419 |         }
  420 |     });
  421 | });
  422 | 
  423 | // ── Lecture publique sur le vrai serveur ───────────────────────────────────────────────────────────────────────────
  424 | 
  425 | test.describe('cvcb · lecture publique', () => {
  426 |     test('G5 — paramètres piégés : 200 ou 400, jamais 500, champs publics, rapide ; aucune écriture', async ({ request }) => {
  427 |         test.setTimeout(180_000);
  428 |         const traps = [
  429 |             '', 'zone=1e9,1,2,3', 'zone=-90,-180,90,180', 'zone=NaN,NaN,NaN,NaN', `zone=${'9'.repeat(3000)},1,2,3`, 'zone=14.7,-17.5,14.8,-17.4;DROP%20TABLE%20events',
  430 |             'du=2026-02-30&au=2026-03-01', 'du=0000-01-01&au=9999-01-01', `q=${'a'.repeat(4000)}`, "q='%20OR%201=1%20--", 'q=),or(status.neq.PUBLIE',
  431 |             'q=%00', 'categorie=BROUILLON', 'gratuit=1&gratuit=0', `ville=${'x'.repeat(4000)}`, 'quand=1;select', 'status=BROUILLON&select=*&limit=100000',
  432 |             'or=(status.eq.BROUILLON)', 'zone=14.6,-17.6,14.9,-17.2&q=CVCB&categorie=CONCERT&gratuit=1&ville=Dakar&quand=semaine',
  433 |         ];
  434 |         const fields = ['blur', 'color', 'endsAt', 'highlight', 'id', 'lat', 'lng', 'price', 'startsAt', 'title'];
  435 |         const statuses = new Map<number, number>();
  436 |         for (const q of traps) {
  437 |             const t0 = Date.now();
  438 |             const res = await request.get(`/api/events/carte${q ? `?${q}` : ''}`);
  439 |             const ms = Date.now() - t0;
  440 |             statuses.set(res.status(), (statuses.get(res.status()) ?? 0) + 1);
  441 |             expect([200, 400], `?${q.slice(0, 60)} : HTTP ${res.status()}`).toContain(res.status());
  442 |             expect(ms, `?${q.slice(0, 60)} : ${ms} ms`).toBeLessThan(5_000);
  443 |             expect(res.headers()['cache-control'] ?? '', 'no-store').toContain('no-store');
  444 |             if (res.status() === 200) {
  445 |                 const body = await res.json() as { events: Array<Record<string, unknown>>; total: number; truncated: boolean };
  446 |                 expect(Object.keys(body).sort()).toEqual(['events', 'total', 'truncated']);
  447 |                 expect(body.events.length).toBeLessThanOrEqual(300);
  448 |                 for (const e of body.events) expect(Object.keys(e).sort(), `?${q.slice(0, 60)}`).toEqual(fields);
  449 |             }
  450 |         }
  451 |         console.log(`[cvcb] lecture publique, ${traps.length} adresses piégées : ${JSON.stringify(Object.fromEntries(statuses))}`);
  452 |         for (const method of ['post', 'put', 'patch', 'delete'] as const) {
  453 |             const res = await request[method]('/api/events/carte', { data: { status: 'PUBLIE' } });
  454 |             expect(res.status(), `${method.toUpperCase()} /api/events/carte`).toBe(405);
  455 |         }
  456 |     });
  457 | 
  458 |     test('G6 — fiche : aucune tuile avant « Afficher la carte » ; mention des fonds visible ensuite', async ({ page }) => {
  459 |         test.setTimeout(120_000);
  460 |         const tiles: string[] = [];
  461 |         page.on('request', (r) => { if (TILE_HOST.test(new URL(r.url()).hostname)) tiles.push(r.url()); });
  462 |         await page.setViewportSize({ width: 390, height: 844 });
  463 |         await page.goto(`/events/${readDemoIds().events.publie.id}`, { waitUntil: 'load' });
  464 |         const show = page.getByRole('button', { name: 'Afficher la carte' });
  465 |         await show.scrollIntoViewIfNeeded();
  466 |         await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
  467 |         await page.waitForTimeout(1_000);
  468 |         expect(tiles, 'aucune tuile avant le geste').toEqual([]);
  469 |         await show.click();
  470 |         await expect(page.locator('.leaflet-control-attribution')).toContainText('Stadia Maps', { timeout: 30_000 });
  471 |         await expect(page.locator('.leaflet-control-attribution')).toContainText('contributeurs OpenStreetMap');
  472 |         await expect(page.locator('.leaflet-control-attribution')).toBeVisible();
  473 |         await waitUntil('tuiles demandées après le geste', async () => tiles.length > 0, 15_000);
  474 |     });
  475 | });
  476 | 
```