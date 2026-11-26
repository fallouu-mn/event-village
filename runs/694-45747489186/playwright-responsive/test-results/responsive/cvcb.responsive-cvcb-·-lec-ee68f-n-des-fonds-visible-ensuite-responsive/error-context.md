# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cvcb.responsive.spec.ts >> cvcb · lecture publique >> G6 — fiche : aucune tuile avant « Afficher la carte » ; mention des fonds visible ensuite
- Location: e2e/cvcb.responsive.spec.ts:463:9

# Error details

```
TimeoutError: locator.scrollIntoViewIfNeeded: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Afficher la carte' })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - heading "500" [level=1] [ref=e5]
    - heading "Internal Server Error." [level=2] [ref=e7]
  - alert [ref=e8]
```

# Test source

```ts
  370 |         expect(leaks, leaks.join('\n')).toEqual([]);
  371 |     });
  372 | });
  373 | 
  374 | // ── CSP sous HTTPS de même origine ─────────────────────────────────────────────────────────────────────────────────
  375 | 
  376 | test.describe('cvcb · CSP', () => {
  377 |     test('G4 — aucune violation img-src sous HTTPS de même origine (accueil, Explorer, fiche, salles, tables, connexion, aide)', async ({ browser }, testInfo) => {
  378 |         test.setTimeout(240_000);
  379 |         const mod = await import(pathToFileURL(path.resolve('scripts/e2e/h2-proxy.mjs')).href) as {
  380 |             startH2Proxy: (target: string, dir: string) => Promise<{ origin: string; port: number; close: () => Promise<void> }>;
  381 |         };
  382 |         const proxy = await mod.startH2Proxy(`http://127.0.0.1:${PORT}`, path.join(os.tmpdir(), 'cvcb-h2'));
  383 |         // Contexte ouvert à la main : le verrou réseau doit admettre l'hôte du relais (openAnonymousContext pose le verrou
  384 |         // par défaut, qui le refuse : run 624, ERR_BLOCKED_BY_CLIENT)
  385 |         const context = await browser.newContext({ ...projectContextOptions(testInfo), colorScheme: 'light', ignoreHTTPSErrors: true, baseURL: proxy.origin, viewport: { width: 390, height: 844 } });
  386 |         try {
  387 |             await installNetworkGuard(context, new Set([...e2eConfig().allowedHosts, `localhost:${proxy.port}`]));
  388 |             await context.addInitScript(() => {
  389 |                 const w = window as unknown as { __cvcbCsp: string[] };
  390 |                 w.__cvcbCsp = [];
  391 |                 document.addEventListener('securitypolicyviolation', (e) => {
  392 |                     w.__cvcbCsp.push(`${e.effectiveDirective} ${e.blockedURI} ${e.disposition} ${location.pathname}`);
  393 |                 });
  394 |             });
  395 |             const page = await context.newPage();
  396 |             const fiche = readDemoIds().events.publie.id;
  397 |             const pages = ['/', '/explore', '/explore?vue=carte', `/events/${fiche}`, '/halls', '/tables', '/login', '/aide'];
  398 |             const all: string[] = [];
  399 |             for (const p of pages) {
  400 |                 await page.goto(p, { waitUntil: 'load' });
  401 |                 expect(new URL(page.url()).origin, `${p} servie en HTTPS par le relais`).toBe(proxy.origin);
  402 |                 // Défilement complet : images paresseuses, logos de paiement, aperçu de la carte de l'accueil
  403 |                 await page.evaluate(async () => {
  404 |                     for (let y = 0; y < document.body.scrollHeight; y += 400) {
  405 |                         window.scrollTo(0, y);
  406 |                         await new Promise((r) => setTimeout(r, 120));
  407 |                     }
  408 |                 });
  409 |                 if (p.startsWith('/events/')) {
  410 |                     const show = page.getByRole('button', { name: 'Afficher la carte' });
  411 |                     if (await show.count()) await show.first().click();
  412 |                 }
  413 |                 await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
  414 |                 await page.waitForTimeout(800);
  415 |                 const v = await page.evaluate(() => (window as unknown as { __cvcbCsp?: string[] }).__cvcbCsp ?? []);
  416 |                 all.push(...v);
  417 |             }
  418 |             console.log(`[cvcb] CSP sous HTTPS (${proxy.origin}) : ${all.length} violation(s) ${JSON.stringify(all)}`);
  419 |             const img = all.filter((v) => v.startsWith('img-src'));
  420 |             expect(img, 'violations img-src').toEqual([]);
  421 |         } finally {
  422 |             await context.close();
  423 |             await proxy.close();
  424 |         }
  425 |     });
  426 | });
  427 | 
  428 | // ── Lecture publique sur le vrai serveur ───────────────────────────────────────────────────────────────────────────
  429 | 
  430 | test.describe('cvcb · lecture publique', () => {
  431 |     test('G5 — paramètres piégés : 200 ou 400, jamais 500, champs publics, rapide ; aucune écriture', async ({ request }) => {
  432 |         test.setTimeout(180_000);
  433 |         const traps = [
  434 |             '', 'zone=1e9,1,2,3', 'zone=-90,-180,90,180', 'zone=NaN,NaN,NaN,NaN', `zone=${'9'.repeat(3000)},1,2,3`, 'zone=14.7,-17.5,14.8,-17.4;DROP%20TABLE%20events',
  435 |             'du=2026-02-30&au=2026-03-01', 'du=0000-01-01&au=9999-01-01', `q=${'a'.repeat(4000)}`, "q='%20OR%201=1%20--", 'q=),or(status.neq.PUBLIE',
  436 |             'q=%00', 'categorie=BROUILLON', 'gratuit=1&gratuit=0', `ville=${'x'.repeat(4000)}`, 'quand=1;select', 'status=BROUILLON&select=*&limit=100000',
  437 |             'or=(status.eq.BROUILLON)', 'zone=14.6,-17.6,14.9,-17.2&q=CVCB&categorie=CONCERT&gratuit=1&ville=Dakar&quand=semaine',
  438 |         ];
  439 |         const fields = ['blur', 'color', 'endsAt', 'highlight', 'id', 'lat', 'lng', 'price', 'startsAt', 'title'];
  440 |         const statuses = new Map<number, number>();
  441 |         for (const q of traps) {
  442 |             const t0 = Date.now();
  443 |             const res = await request.get(`/api/events/carte${q ? `?${q}` : ''}`);
  444 |             const ms = Date.now() - t0;
  445 |             statuses.set(res.status(), (statuses.get(res.status()) ?? 0) + 1);
  446 |             expect([200, 400], `?${q.slice(0, 60)} : HTTP ${res.status()}`).toContain(res.status());
  447 |             expect(ms, `?${q.slice(0, 60)} : ${ms} ms`).toBeLessThan(5_000);
  448 |             expect(res.headers()['cache-control'] ?? '', 'no-store').toContain('no-store');
  449 |             if (res.status() === 200) {
  450 |                 const body = await res.json() as { events: Array<Record<string, unknown>>; total: number; truncated: boolean };
  451 |                 expect(Object.keys(body).sort()).toEqual(['events', 'total', 'truncated']);
  452 |                 expect(body.events.length).toBeLessThanOrEqual(300);
  453 |                 for (const e of body.events) expect(Object.keys(e).sort(), `?${q.slice(0, 60)}`).toEqual(fields);
  454 |             }
  455 |         }
  456 |         console.log(`[cvcb] lecture publique, ${traps.length} adresses piégées : ${JSON.stringify(Object.fromEntries(statuses))}`);
  457 |         for (const method of ['post', 'put', 'patch', 'delete'] as const) {
  458 |             const res = await request[method]('/api/events/carte', { data: { status: 'PUBLIE' } });
  459 |             expect(res.status(), `${method.toUpperCase()} /api/events/carte`).toBe(405);
  460 |         }
  461 |     });
  462 | 
  463 |     test('G6 — fiche : aucune tuile avant « Afficher la carte » ; mention des fonds visible ensuite', async ({ page }) => {
  464 |         test.setTimeout(120_000);
  465 |         const tiles: string[] = [];
  466 |         page.on('request', (r) => { if (TILE_HOST.test(new URL(r.url()).hostname)) tiles.push(r.url()); });
  467 |         await page.setViewportSize({ width: 390, height: 844 });
  468 |         await page.goto(`/events/${readDemoIds().events.publie.id}`, { waitUntil: 'load' });
  469 |         const show = page.getByRole('button', { name: 'Afficher la carte' });
> 470 |         await show.scrollIntoViewIfNeeded();
      |                    ^ TimeoutError: locator.scrollIntoViewIfNeeded: Timeout 15000ms exceeded.
  471 |         await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
  472 |         await page.waitForTimeout(1_000);
  473 |         expect(tiles, 'aucune tuile avant le geste').toEqual([]);
  474 |         await show.click();
  475 |         await expect(page.locator('.leaflet-control-attribution')).toContainText('Stadia Maps', { timeout: 30_000 });
  476 |         await expect(page.locator('.leaflet-control-attribution')).toContainText('contributeurs OpenStreetMap');
  477 |         await expect(page.locator('.leaflet-control-attribution')).toBeVisible();
  478 |         await waitUntil('tuiles demandées après le geste', async () => tiles.length > 0, 15_000);
  479 |     });
  480 | });
  481 | 
```