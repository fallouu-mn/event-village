# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cvcb.responsive.spec.ts >> cvcb · lecture publique >> G6 — fiche : aucune tuile avant « Afficher la carte » ; mention des fonds visible ensuite
- Location: e2e/cvcb.responsive.spec.ts:463:9

# Error details

```
Error: locator.scrollIntoViewIfNeeded: Element is not attached to the DOM
Call log:
  - attempting scroll into view action
    - waiting for element to be stable

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
            - /url: /
        - generic [ref=e13]:
          - button "Notifications" [ref=e15] [cursor=pointer]
          - button "Basculer le thème" [ref=e20] [cursor=pointer]
          - link "Se connecter" [ref=e24] [cursor=pointer]:
            - /url: /login
      - main [ref=e28]:
        - generic [ref=e30]:
          - region [ref=e31]:
            - generic [ref=e33]:
              - link "Retour aux événements" [ref=e34] [cursor=pointer]:
                - /url: /explore
                - generic [aria-hidden] [ref=e37]: Retour
              - generic [ref=e38]:
                - 'button "Mettre en favori : Festival Jazz sur le Fleuve" [ref=e39] [cursor=pointer]'
                - button "Partager l’événement" [ref=e42] [cursor=pointer]
            - generic [ref=e49]:
              - img "Affiche de l’événement Festival Jazz sur le Fleuve" [ref=e51]
              - generic [ref=e52]:
                - generic [ref=e53]: Festivals
                - heading "Festival Jazz sur le Fleuve" [level=1] [ref=e56]
                - paragraph [ref=e57]: Organisé par Baobab Scène
                - list "Date et lieu" [ref=e58]:
                  - listitem [ref=e59]:
                    - generic [ref=e62]:
                      - generic [ref=e63]: Mardi 8 décembre 2026 à 18:00
                      - generic [ref=e64]: Jusqu’au mercredi 9 décembre à 00:00
                  - listitem [ref=e65]:
                    - generic [ref=e69]:
                      - generic [ref=e70]: Quai des Pêcheurs
                      - generic [ref=e71]: Quai des Pêcheurs, Saint-Louis · Saint-Louis
          - generic [ref=e74]:
            - article [ref=e75]:
              - list "Infos de l’événement" [ref=e76]:
                - listitem [ref=e77]:
                  - generic [ref=e81]:
                    - paragraph [ref=e82]: Billet dans l’application
                    - paragraph [ref=e83]: Présentez son QR code à l’entrée, depuis Mes billets.
              - region [ref=e84]:
                - heading "À propos" [level=2] [ref=e85]
                - paragraph [ref=e86]: "Deux soirées de jazz au bord du fleuve : quartets, big band du conservatoire et jam session de clôture."
              - region [ref=e87]:
                - heading "Programme" [level=2] [ref=e88]
                - list [ref=e89]:
                  - listitem [ref=e90]:
                    - generic [ref=e92]:
                      - paragraph [ref=e93]: 18:00
                      - generic [ref=e94]: Activité
                    - paragraph [ref=e96]: Accueil et marché des créateurs
                  - listitem [ref=e97]:
                    - generic [ref=e99]:
                      - paragraph [ref=e100]: 19:30
                      - generic [ref=e101]: Artiste
                    - paragraph [ref=e103]: Quartet d’ouverture
                    - paragraph [ref=e104]: Quartet Langue de Barbarie
                  - listitem [ref=e105]:
                    - generic [ref=e107]:
                      - paragraph [ref=e108]: 21:30
                      - generic [ref=e109]: Artiste
                    - paragraph [ref=e111]: Big band
                    - paragraph [ref=e112]: Big band du conservatoire régional
              - region [ref=e113]:
                - heading "Lieu et accès" [level=2] [ref=e114]
                - generic [ref=e115]:
                  - paragraph [ref=e116]: Quai des Pêcheurs
                  - paragraph [ref=e117]: Quai des Pêcheurs, Saint-Louis · Saint-Louis
                - generic [ref=e118]:
                  - img "Festival Jazz sur le Fleuve, Quai des Pêcheurs" [ref=e125]:
                    - generic [ref=e126]: Festival Jazz sur le Fleuve
                  - button "Afficher la carte" [ref=e130] [cursor=pointer]
                - link "Voir l’itinéraire" [ref=e135] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=16.0179,-16.4896
                - generic [ref=e145]:
                  - generic [ref=e152]:
                    - paragraph [ref=e153]: Stationnement
                    - generic [ref=e154]: Stationnement surveillé à proximité.
                  - generic [ref=e160]:
                    - paragraph [ref=e161]: Paiement
                    - generic [ref=e162]: Wave ou Orange Money, en ligne. Les frais de service s’affichent avant le paiement.
                  - generic [ref=e168]:
                    - paragraph [ref=e169]: Règlement et consignes
                    - generic [ref=e170]: Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.
              - region "Organisateur" [ref=e171]:
                - generic [ref=e173]:
                  - paragraph [ref=e174]: Organisateur
                  - paragraph [ref=e175]: Baobab Scène
            - complementary [ref=e176]:
              - generic [ref=e177]:
                - generic [ref=e178]:
                  - generic [ref=e179]:
                    - heading "Billetterie" [level=2] [ref=e180]
                    - paragraph [ref=e181]: "Choisissez vos billets : places mises à jour en direct."
                  - status [ref=e182]: En direct
                - list "Catégories de billets" [ref=e184]:
                  - listitem [ref=e185]:
                    - generic [ref=e187]:
                      - generic [ref=e188]:
                        - heading "Pass soirée" [level=3] [ref=e189]
                        - paragraph [ref=e190]: 7 500 F CFA
                        - paragraph [ref=e191]: Disponible
                        - paragraph [ref=e192]: Une soirée au choix.
                      - group "Quantité Pass soirée" [ref=e193]:
                        - button "Retirer un billet Pass soirée" [disabled] [ref=e194]
                        - status [ref=e197]: "0"
                        - button "Ajouter un billet Pass soirée" [ref=e198] [cursor=pointer]
                  - listitem [ref=e201]:
                    - generic [ref=e203]:
                      - generic [ref=e204]:
                        - heading "Pass deux soirs" [level=3] [ref=e205]
                        - paragraph [ref=e206]: 12 000 F CFA
                        - paragraph [ref=e207]: Disponible
                        - paragraph [ref=e208]: Les deux soirées.
                      - group "Quantité Pass deux soirs" [ref=e209]:
                        - button "Retirer un billet Pass deux soirs" [disabled] [ref=e210]
                        - status [ref=e213]: "0"
                        - button "Ajouter un billet Pass deux soirs" [ref=e214] [cursor=pointer]
                - paragraph [ref=e217]: Choisissez au moins un billet avec le bouton « + ».
                - generic [ref=e218]:
                  - paragraph [ref=e219]:
                    - generic [ref=e220]: Payer avec
                    - generic [ref=e221]: Wave
                    - generic [ref=e223]: ou
                    - generic [ref=e224]: Orange Money
                  - paragraph [ref=e226]: Billet avec QR code dans Mes billets, dès le paiement
              - region "Achat des billets" [ref=e231]:
                - generic [ref=e232]:
                  - generic [ref=e233]:
                    - paragraph [ref=e234]: Billetterie
                    - paragraph [ref=e235]: Dès 7 500 F CFA
                  - button "Choisir mes billets" [ref=e236] [cursor=pointer]
    - navigation "Navigation rapide":
      - generic [ref=e238]:
        - link "Accueil" [ref=e240] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e246] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e252] [cursor=pointer]:
          - /url: /tickets
        - link "Avis" [ref=e257] [cursor=pointer]:
          - /url: /notifications
        - link "Portefeuille" [ref=e263] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e269]
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
      |                    ^ Error: locator.scrollIntoViewIfNeeded: Element is not attached to the DOM
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