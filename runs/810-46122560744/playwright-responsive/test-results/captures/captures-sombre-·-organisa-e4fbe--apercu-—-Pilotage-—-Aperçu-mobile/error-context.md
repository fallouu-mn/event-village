# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · organisateur >> pilotage-apercu — Pilotage — Aperçu
- Location: e2e/captures.spec.ts:203:9

# Error details

```
Error: contrôles bloquants de pilotage-apercu__mobile__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "axe-core document-title (serious, 1 nœud(s)) : Documents must have <title> element to aid in navigation",
+ ]
```

# Page snapshot

```yaml
- generic [ref=e1]:
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
            - link "Mes événements" [ref=e37] [cursor=pointer]:
              - /url: /partner/events
            - generic [ref=e42]:
              - generic [ref=e43]:
                - generic [ref=e44]:
                  - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=e45]': Publié
                  - status [ref=e48]: En direct
                - heading "Nuit du Sabar — édition d’automne" [level=1] [ref=e50]
                - paragraph [ref=e51]:
                  - generic [ref=e52]:
                    - generic [ref=e53]: sam. 28 nov. 2026 à 08:45
                    - generic [ref=e56]: Esplanade de la Corniche Ouest, Dakar
              - generic [ref=e61]:
                - link "Modifier" [ref=e62] [cursor=pointer]:
                  - /url: /partner/events/0b376a0f-91bb-4d51-97ee-8e6f687cf007/edit
                - button "Annuler l’événement" [ref=e68] [cursor=pointer]
          - generic [ref=e74]:
            - tablist "Rubriques du pilotage" [ref=e77]:
              - tab "Aperçu" [active] [selected] [ref=e78] [cursor=pointer]
              - tab "Infos" [ref=e80] [cursor=pointer]
              - tab "Ventes" [ref=e82] [cursor=pointer]
              - tab "Invitations" [ref=e84] [cursor=pointer]
              - tab "Entrées" [ref=e86] [cursor=pointer]
              - tab "Équipe" [ref=e88] [cursor=pointer]
              - tab "Caisse" [ref=e90] [cursor=pointer]
              - tab "Clôture" [ref=e92] [cursor=pointer]
            - tabpanel "Aperçu" [ref=e94]:
              - generic [ref=e95]:
                - region [ref=e96]:
                  - generic [ref=e98]:
                    - heading "Billetterie" [level=2] [ref=e99]
                    - paragraph [ref=e100]: Billets valides et utilisés, hors invitations.
                  - generic [ref=e101]:
                    - generic [ref=e102]:
                      - paragraph [ref=e104]: Billets vendus
                      - paragraph [ref=e108]: "83"
                      - paragraph [ref=e109]: Toutes catégories, y compris désactivées
                    - generic [ref=e110]:
                      - paragraph [ref=e112]: Places en vente
                      - paragraph [ref=e118]: "250"
                      - paragraph [ref=e119]: Quantités mises en vente des catégories actives
                    - generic [ref=e120]:
                      - paragraph [ref=e122]: Places restantes
                      - paragraph [ref=e127]: "187"
                      - paragraph [ref=e128]: Dans les catégories actives, sans compter 2 en cours de paiement
                    - generic [ref=e129]:
                      - paragraph [ref=e131]: Invitations
                      - paragraph [ref=e137]: "0"
                      - paragraph [ref=e138]: Places offertes, comptées à part
                - region [ref=e139]:
                  - generic [ref=e141]:
                    - heading "Contrôle d’accès" [level=2] [ref=e142]
                    - paragraph [ref=e143]: Passages validés au scan et au guichet.
                  - generic [ref=e144]:
                    - generic [ref=e145]:
                      - paragraph [ref=e147]: Entrées
                      - paragraph [ref=e152]: "63"
                      - paragraph [ref=e153]: dont 17 au guichet
                    - generic [ref=e154]:
                      - paragraph [ref=e156]: Taux de présence
                      - paragraph [ref=e162]: 76 %
                      - paragraph [ref=e163]: Part des participants attendus (ventes et invitations) déjà passés
                - region [ref=e164]:
                  - generic [ref=e166]:
                    - heading "Recettes" [level=2] [ref=e167]
                    - paragraph [ref=e168]: Ventes en ligne, remboursements, recettes nettes ; les espèces sont comptées à part.
                  - generic [ref=e169]:
                    - generic [ref=e170]:
                      - paragraph [ref=e172]: Ventes en ligne (brut)
                      - paragraph [ref=e176]:
                        - generic [ref=e177]: 351 000 F CFA
                      - paragraph [ref=e178]: Paiements mobiles confirmés, avant remboursements
                    - generic [ref=e179]:
                      - paragraph [ref=e181]: Remboursements
                      - paragraph [ref=e186]:
                        - generic [ref=e187]: 0 F CFA
                      - paragraph [ref=e188]: Billets payés en ligne puis remboursés
                    - generic [ref=e189]:
                      - paragraph [ref=e191]: Recettes nettes
                      - paragraph [ref=e195]:
                        - generic [ref=e196]: 351 000 F CFA
                      - paragraph [ref=e197]: Ventes en ligne moins les remboursements.
                    - generic [ref=e198]:
                      - paragraph [ref=e200]: Ventes en espèces
                      - paragraph [ref=e205]:
                        - generic [ref=e206]: 120 000 F CFA
                      - paragraph [ref=e207]: Encaissées par vos contrôleurs, hors solde
                - paragraph [ref=e208]:
                  - text: Chiffres calculés le
                  - time [ref=e209]: sam. 28 nov. 2026 à 08:20
                  - text: .
    - navigation "Navigation rapide":
      - generic [ref=e210]:
        - link "Accueil" [ref=e212] [cursor=pointer]:
          - /url: /partner/dashboard
        - link "Billetterie" [ref=e220] [cursor=pointer]:
          - /url: /partner/events
        - link "Scanner" [ref=e225] [cursor=pointer]:
          - /url: /partner/scan
        - link "Finances" [ref=e234] [cursor=pointer]:
          - /url: /partner/finance
        - link "Profil" [ref=e239] [cursor=pointer]:
          - /url: /partner/profile
  - alert [ref=e245]: Nuit du Sabar — édition d’automne
```

# Test source

```ts
  258 |                     await route.fulfill({ status: stub.status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(stub.body) });
  259 |                 });
  260 |             }
  261 |             for (const hold of screen.holdRequests ?? []) {
  262 |                 record.notes.push(`requête retenue (jamais servie) : ${hold.method ?? 'toute méthode'} ${hold.url}`);
  263 |                 await page.route(hold.url, async (route) => {
  264 |                     if (!methodMatches(hold.method, route.request().method())) {
  265 |                         await route.fallback();
  266 |                         return;
  267 |                     }
  268 |                     // Retenue jusqu'à la fermeture de la page : ni réponse ni erreur (réseau lent, téléchargement en cours)
  269 |                     await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  270 |                 });
  271 |             }
  272 |             if (screen.fakePush) {
  273 |                 const subscription = screen.fakePush === 'granted' ? await fakePushSubscriber() : null;
  274 |                 record.notes.push(screen.fakePush === 'granted'
  275 |                     ? `push simulé (granted) : permission accordée au clic sans fenêtre, inscription du service worker et pushManager.subscribe remplacés ; abonnement du faux service push ${subscription?.endpoint ?? '?'} ; configuration VAPID, route d'inscription et base réelles`
  276 |                     : screen.fakePush === 'denied'
  277 |                         ? 'push simulé (denied) : Notification.permission = « denied », appels à requestPermission comptés'
  278 |                         : 'push simulé (unsupported) : window.PushManager et window.Notification supprimés');
  279 |                 await context.addInitScript(installFakePush, { mode: screen.fakePush, subscription });
  280 |             }
  281 |             if (screen.fakeCamera) {
  282 |                 const mode = screen.fakeCamera === 'barcode-detector' ? 'barcode-detector' : fakeScanMode();
  283 |                 record.notes.push(`caméra simulée (${mode})${mode === 'barcode-detector' ? ' : faux BarcodeDetector, payload posé par le test' : ''}`);
  284 |                 await context.addInitScript(installFakeCamera, { mode });
  285 |             }
  286 |             if (screen.offline === 'before-load') {
  287 |                 record.notes.push('connexion coupée avant le chargement (collecte d’erreurs arrêtée)');
  288 |                 guard.freeze();
  289 |                 await context.setOffline(true);
  290 |             }
  291 |             const response = await page.goto(record.url, { waitUntil: 'load' });
  292 |             record.status = response ? response.status() : null;
  293 |             if (screen.expectStatus !== undefined) {
  294 |                 expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
  295 |             }
  296 |             if (screen.offline === 'after-load') {
  297 |                 record.notes.push('connexion coupée après le chargement (collecte d’erreurs arrêtée)');
  298 |                 guard.freeze();
  299 |                 await context.setOffline(true);
  300 |             }
  301 |             const sc = { page, context, guard, ids: demo };
  302 |             if (screen.ready) await screen.ready(sc);
  303 |             await settle(page, guard, record.notes);
  304 |             if (screen.actions) {
  305 |                 await screen.actions(sc);
  306 |                 await settle(page, guard, record.notes);
  307 |             }
  308 |             if (screen.id === 'cloche-ouverte' && vue === 'mobile') {
  309 |                 const problem = await markAllOnOneLine(page);
  310 |                 if (problem) record.blocking.push(problem);
  311 |             }
  312 |             // Design 1e (décision du 21/11, modification signalée) : contrôles toujours faits page en HAUT (position fixe) :
  313 |             // selon le défilement laissé par l'écran, une cible pouvait se trouver à moitié sous l'en-tête collant et le
  314 |             // verdict d'axe changeait d'un run à l'autre. Aucune règle d'axe changée ; la capture garde ensuite la position
  315 |             // de l'écran (barre d'achat sur page défilée…).
  316 |             // Finition 5 (point 1) : la page capturée est-elle vraiment dans le thème demandé ? (classe dark et fond lus sur la
  317 |             // page ; bloquant : depuis le design 1a, les captures « sombre » des comptes connectés sortaient en clair)
  318 |             record.themeLu = await readTheme(page);
  319 |             const themeIssue = themeProblem(record.themeLu, theme.key);
  320 |             if (themeIssue) record.blocking.push(themeIssue);
  321 |             const scrolledTo = await page.evaluate(() => { const y = window.scrollY; window.scrollTo({ top: 0, behavior: 'instant' }); return y; });
  322 |             const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true, references: screen.references });
  323 |             if (scrolledTo > 0) await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), scrolledTo);
  324 |             record.blocking.push(...checks.blocking);
  325 |             record.warnings.push(...checks.warnings);
  326 |             record.axeDetails = checks.axeDetails;
  327 |             record.smallTextDetails = checks.smallTextDetails;
  328 |             record.metrics = checks.metrics;
  329 |             const shot = await capture(page, screen, file);
  330 |             record.captured = true;
  331 |             await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  332 |         } catch (err) {
  333 |             record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  334 |             if (!record.captured && !page.isClosed()) {
  335 |                 await capture(page, screen, file).then(
  336 |                     async (shot) => {
  337 |                         record.captured = true;
  338 |                         record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
  339 |                         await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  340 |                     },
  341 |                     (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
  342 |                 );
  343 |             }
  344 |             throw err;
  345 |         } finally {
  346 |             record.blocking.push(...hydration.errors.map((h) => `erreur d'hydratation sur ${screen.id} (${vue}, ${theme.key}) : ${h}`));
  347 |             if (hydration.errors.length > 0 && !page.isClosed()) {
  348 |                 const report = formatProbe(await readProbe(page).catch((err: unknown) => ({ mismatches: [{ erreurSonde: String(err) }], writes: [] })));
  349 |                 console.log(`[hydratation] sonde · ${file}
  350 | ${report}`);
  351 |                 record.notes.push(`sonde d'hydratation : ${report.slice(0, 4000)}`);
  352 |             }
  353 |             record.blocking.push(...guard.blockingIssues());
  354 |             record.warnings.push(...guard.nonBlockingIssues());
  355 |             record.durationMs = Date.now() - started;
  356 |             writeCaptureRecord(record);
  357 |         }
> 358 |         expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
      |                                                                   ^ Error: contrôles bloquants de pilotage-apercu__mobile__sombre.png
  359 |     });
  360 | }
  361 | 
  362 | for (const theme of THEMES) {
  363 |     for (const role of ROLE_ORDER) {
  364 |         const screens = SCREENS.filter((s) => s.role === role);
  365 |         if (screens.length === 0) continue;
  366 |         test.describe(`${theme.key} · ${role}`, () => {
  367 |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  368 | 
  369 |             for (const screen of screens) {
  370 |                 if (screen.serviceWorkers === 'allow') {
  371 |                     // Lot 7 (D7) : service worker autorisé seulement dans le contexte de cet écran
  372 |                     test.describe(`${screen.id} (service worker autorisé)`, () => {
  373 |                         test.use({ serviceWorkers: 'allow' });
  374 |                         defineCapture(screen, theme, role);
  375 |                     });
  376 |                 } else {
  377 |                     defineCapture(screen, theme, role);
  378 |                 }
  379 |             }
  380 |         });
  381 |     }
  382 | }
  383 | 
```