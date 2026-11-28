# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · organisateur >> org-tables-fermetures — Établissement — fermetures exceptionnelles (fermeture à venir de la démonstration)
- Location: e2e/captures.spec.ts:202:9

# Error details

```
Error: contrôles bloquants de org-tables-fermetures__mobile__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "erreur de console : Failed to load resource: the server responded with a status of 404 (Not Found) (http://localhost:3000/api/partner/venues/closures/2504ea7b-dfde-4ec0-8438-77f67d13bcaf/orders)",
+   "requête en échec : 404 GET localhost:3000/api/partner/venues/closures/2504ea7b-dfde-4ec0-8438-77f67d13bcaf/orders",
+ ]
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
          - button "Notifications, 37 non lues" [ref=e15] [cursor=pointer]:
            - generic [ref=e19]: "37"
          - button "Basculer le thème" [pressed] [ref=e21] [cursor=pointer]
          - link "Mon profil (Mariama Ndiaye)" [ref=e29] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e30]: MN
      - main [ref=e32]:
        - generic [ref=e34]:
          - generic [ref=e35]:
            - link "Retour à l’établissement" [ref=e37] [cursor=pointer]:
              - /url: /partner/tables/edition/d6adb482-33eb-4536-8e1d-cc0e935778a2
            - generic [ref=e43]:
              - generic [ref=e44]: Validé
              - heading "Fermetures exceptionnelles" [level=1] [ref=e47]
              - paragraph [ref=e48]: "La Terrasse du Plateau : jour férié, travaux, soirée privée. Pendant une fermeture, personne ne peut réserver."
          - generic [ref=e49]:
            - region [ref=e50]:
              - heading "Fermetures à venir" [level=2] [ref=e54]
              - list [ref=e55]:
                - listitem [ref=e56]:
                  - generic [ref=e62]:
                    - paragraph [ref=e63]: Toute la journée du mardi 8 décembre
                    - paragraph [ref=e64]: Inventaire et grand nettoyage de la cuisine
                  - 'button "Retirer la fermeture : Toute la journée du mardi 8 décembre" [ref=e65] [cursor=pointer]':
                    - generic [ref=e70]: Retirer
            - region [ref=e71]:
              - generic [ref=e74]:
                - heading "Prévoir une fermeture" [level=2] [ref=e75]
                - paragraph [ref=e76]: Vous verrez les réservations touchées avant de confirmer.
              - generic [ref=e77]:
                - group "Durée" [ref=e78]:
                  - group [ref=e80]:
                    - button "Un jour" [pressed] [ref=e81] [cursor=pointer]
                    - button "Plusieurs jours" [ref=e82] [cursor=pointer]
                - generic [ref=e84]:
                  - generic [ref=e86]:
                    - text: Jour*
                    - generic [ref=e87]: (obligatoire)
                  - textbox "Jour (obligatoire)" [ref=e88]
                - group "Heures" [ref=e89]:
                  - group [ref=e91]:
                    - button "Toute la journée" [pressed] [ref=e92] [cursor=pointer]
                    - button "De … à …" [ref=e93] [cursor=pointer]
                - generic [ref=e94]:
                  - generic [ref=e95]:
                    - generic [ref=e96]:
                      - text: Motif*
                      - generic [ref=e97]: (obligatoire)
                    - generic [ref=e98]: 0 / 200
                  - textbox "Motif (obligatoire)" [ref=e99]:
                    - /placeholder: "Par exemple : fermeture pour travaux"
                  - paragraph [ref=e100]: Envoyé aux clients dont la réservation est annulée.
                - button "Voir les réservations touchées" [ref=e102] [cursor=pointer]
    - navigation "Navigation rapide":
      - generic [ref=e108]:
        - link "Accueil" [ref=e110] [cursor=pointer]:
          - /url: /partner/dashboard
        - link "Billetterie" [ref=e118] [cursor=pointer]:
          - /url: /partner/events
        - link "Scanner" [ref=e123] [cursor=pointer]:
          - /url: /partner/scan
        - link "Finances" [ref=e132] [cursor=pointer]:
          - /url: /partner/finance
        - link "Profil" [ref=e137] [cursor=pointer]:
          - /url: /partner/profile
  - alert [ref=e143]
```

# Test source

```ts
  245 |             for (const stub of stubs) {
  246 |                 record.notes.push(`réponse simulée : ${stub.method ?? 'toute méthode'} ${stub.url} remplacée par HTTP ${stub.status} ${JSON.stringify(stub.body).slice(0, 160)}`);
  247 |                 await page.route(stub.url, async (route) => {
  248 |                     if (!methodMatches(stub.method, route.request().method())) {
  249 |                         await route.fallback();
  250 |                         return;
  251 |                     }
  252 |                     await route.fulfill({ status: stub.status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(stub.body) });
  253 |                 });
  254 |             }
  255 |             for (const hold of screen.holdRequests ?? []) {
  256 |                 record.notes.push(`requête retenue (jamais servie) : ${hold.method ?? 'toute méthode'} ${hold.url}`);
  257 |                 await page.route(hold.url, async (route) => {
  258 |                     if (!methodMatches(hold.method, route.request().method())) {
  259 |                         await route.fallback();
  260 |                         return;
  261 |                     }
  262 |                     // Retenue jusqu'à la fermeture de la page : ni réponse ni erreur (réseau lent, téléchargement en cours)
  263 |                     await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  264 |                 });
  265 |             }
  266 |             if (screen.fakePush) {
  267 |                 const subscription = screen.fakePush === 'granted' ? await fakePushSubscriber() : null;
  268 |                 record.notes.push(screen.fakePush === 'granted'
  269 |                     ? `push simulé (granted) : permission accordée au clic sans fenêtre, inscription du service worker et pushManager.subscribe remplacés ; abonnement du faux service push ${subscription?.endpoint ?? '?'} ; configuration VAPID, route d'inscription et base réelles`
  270 |                     : screen.fakePush === 'denied'
  271 |                         ? 'push simulé (denied) : Notification.permission = « denied », appels à requestPermission comptés'
  272 |                         : 'push simulé (unsupported) : window.PushManager et window.Notification supprimés');
  273 |                 await context.addInitScript(installFakePush, { mode: screen.fakePush, subscription });
  274 |             }
  275 |             if (screen.fakeCamera) {
  276 |                 const mode = screen.fakeCamera === 'barcode-detector' ? 'barcode-detector' : fakeScanMode();
  277 |                 record.notes.push(`caméra simulée (${mode})${mode === 'barcode-detector' ? ' : faux BarcodeDetector, payload posé par le test' : ''}`);
  278 |                 await context.addInitScript(installFakeCamera, { mode });
  279 |             }
  280 |             if (screen.offline === 'before-load') {
  281 |                 record.notes.push('connexion coupée avant le chargement (collecte d’erreurs arrêtée)');
  282 |                 guard.freeze();
  283 |                 await context.setOffline(true);
  284 |             }
  285 |             const response = await page.goto(record.url, { waitUntil: 'load' });
  286 |             record.status = response ? response.status() : null;
  287 |             if (screen.expectStatus !== undefined) {
  288 |                 expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
  289 |             }
  290 |             if (screen.offline === 'after-load') {
  291 |                 record.notes.push('connexion coupée après le chargement (collecte d’erreurs arrêtée)');
  292 |                 guard.freeze();
  293 |                 await context.setOffline(true);
  294 |             }
  295 |             const sc = { page, context, guard, ids: demo };
  296 |             if (screen.ready) await screen.ready(sc);
  297 |             await settle(page, guard, record.notes);
  298 |             if (screen.actions) {
  299 |                 await screen.actions(sc);
  300 |                 await settle(page, guard, record.notes);
  301 |             }
  302 |             if (screen.id === 'cloche-ouverte' && vue === 'mobile') {
  303 |                 const problem = await markAllOnOneLine(page);
  304 |                 if (problem) record.blocking.push(problem);
  305 |             }
  306 |             // Design 1e (décision du 21/11, modification signalée) : contrôles toujours faits page en HAUT (position fixe) :
  307 |             // selon le défilement laissé par l'écran, une cible pouvait se trouver à moitié sous l'en-tête collant et le
  308 |             // verdict d'axe changeait d'un run à l'autre. Aucune règle d'axe changée ; la capture garde ensuite la position
  309 |             // de l'écran (barre d'achat sur page défilée…).
  310 |             // Finition 5 (point 1) : la page capturée est-elle vraiment dans le thème demandé ? (classe dark et fond lus sur la
  311 |             // page ; bloquant : depuis le design 1a, les captures « sombre » des comptes connectés sortaient en clair)
  312 |             record.themeLu = await readTheme(page);
  313 |             const themeIssue = themeProblem(record.themeLu, theme.key);
  314 |             if (themeIssue) record.blocking.push(themeIssue);
  315 |             const scrolledTo = await page.evaluate(() => { const y = window.scrollY; window.scrollTo({ top: 0, behavior: 'instant' }); return y; });
  316 |             const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true, references: screen.references });
  317 |             if (scrolledTo > 0) await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), scrolledTo);
  318 |             record.blocking.push(...checks.blocking);
  319 |             record.warnings.push(...checks.warnings);
  320 |             record.axeDetails = checks.axeDetails;
  321 |             record.smallTextDetails = checks.smallTextDetails;
  322 |             record.metrics = checks.metrics;
  323 |             const shot = await capture(page, screen, file);
  324 |             record.captured = true;
  325 |             await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  326 |         } catch (err) {
  327 |             record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  328 |             if (!record.captured && !page.isClosed()) {
  329 |                 await capture(page, screen, file).then(
  330 |                     async (shot) => {
  331 |                         record.captured = true;
  332 |                         record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
  333 |                         await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  334 |                     },
  335 |                     (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
  336 |                 );
  337 |             }
  338 |             throw err;
  339 |         } finally {
  340 |             record.blocking.push(...guard.blockingIssues());
  341 |             record.warnings.push(...guard.nonBlockingIssues());
  342 |             record.durationMs = Date.now() - started;
  343 |             writeCaptureRecord(record);
  344 |         }
> 345 |         expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
      |                                                                   ^ Error: contrôles bloquants de org-tables-fermetures__mobile__sombre.png
  346 |     });
  347 | }
  348 | 
  349 | for (const theme of THEMES) {
  350 |     for (const role of ROLE_ORDER) {
  351 |         const screens = SCREENS.filter((s) => s.role === role);
  352 |         if (screens.length === 0) continue;
  353 |         test.describe(`${theme.key} · ${role}`, () => {
  354 |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  355 | 
  356 |             for (const screen of screens) {
  357 |                 if (screen.serviceWorkers === 'allow') {
  358 |                     // Lot 7 (D7) : service worker autorisé seulement dans le contexte de cet écran
  359 |                     test.describe(`${screen.id} (service worker autorisé)`, () => {
  360 |                         test.use({ serviceWorkers: 'allow' });
  361 |                         defineCapture(screen, theme, role);
  362 |                     });
  363 |                 } else {
  364 |                     defineCapture(screen, theme, role);
  365 |                 }
  366 |             }
  367 |         });
  368 |     }
  369 | }
  370 | 
```