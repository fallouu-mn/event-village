# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · anonyme >> design-composants — Design 1a — en-tête, composants de base, repères, squelettes et état vide
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de design-composants__mobile__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "erreur de console : Failed to load resource: the server responded with a status of 404 (Not Found) (http://localhost:3000/events/00000000-0000-4000-8000-000000000001?_rsc=Ujc3Wj4fhIoHoiR6)",
+   "requête en échec : 404 GET localhost:3000/events/00000000-0000-4000-8000-000000000001?_rsc=Ujc3Wj4fhIoHoiR6",
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
          - button "Notifications" [ref=e15] [cursor=pointer]
          - button "Basculer le thème" [pressed] [ref=e20] [cursor=pointer]
          - link "Se connecter" [ref=e28] [cursor=pointer]:
            - /url: /login
      - main [ref=e32]:
        - generic [ref=e34]:
          - heading "Composants" [level=1] [ref=e35]
          - region [ref=e36]:
            - heading "Boutons" [level=2] [ref=e37]
            - generic [ref=e38]:
              - button "Enregistrer" [ref=e39] [cursor=pointer]
              - button "Retour" [ref=e41] [cursor=pointer]
              - button "Voir le programme" [ref=e43] [cursor=pointer]
              - button "Plus tard" [ref=e45] [cursor=pointer]
              - button "Rembourser 10 000 F CFA" [ref=e47] [cursor=pointer]
            - button "Choisir mes billets" [ref=e49] [cursor=pointer]
          - region [ref=e51]:
            - heading "Champs" [level=2] [ref=e52]
            - generic [ref=e53]:
              - generic [ref=e54]: Nom complet
              - textbox "Nom complet" [ref=e56]: Awa Ndiaye
              - paragraph [ref=e57]: Tel qu’il figure sur votre pièce d’identité.
            - generic [ref=e58]:
              - generic [ref=e60]:
                - text: Numéro de téléphone*
                - generic [ref=e61]: (obligatoire)
              - textbox "Numéro de téléphone (obligatoire)" [invalid] [ref=e62]: 77 12
              - paragraph [ref=e63]:
                - generic [ref=e66]: Saisissez les 9 chiffres de votre numéro.
          - region [ref=e67]:
            - heading "Cartes" [level=2] [ref=e68]
            - generic [ref=e69]:
              - generic [ref=e70]:
                - paragraph [ref=e71]: Recettes en ligne nettes
                - paragraph [ref=e72]: 245 000 F CFA
              - article [ref=e73]:
                - generic [aria-hidden] [ref=e75]:
                  - generic [ref=e76]: "20"
                  - generic [ref=e77]: déc.
                - generic [ref=e78]:
                  - heading [level=3] [ref=e79]:
                    - link "Festival des lumières de Saint-Louis" [ref=e80] [cursor=pointer]:
                      - /url: /events/00000000-0000-4000-8000-000000000001
                  - paragraph [ref=e81]:
                    - generic [ref=e84]: samedi 20 décembre à 20 h 00
                  - paragraph [ref=e85]:
                    - generic [ref=e89]: Saint-Louis · Place Faidherbe
                  - generic [ref=e90]:
                    - generic [ref=e91]: Dernières places
                    - generic [ref=e93]: Concert
                  - paragraph [ref=e95]:
                    - generic [ref=e96]: Dès
                    - generic [ref=e97]: 10 000 F CFA
          - region [ref=e107]:
            - heading "Onglets, pastilles et filtres" [level=2] [ref=e108]
            - tablist "Sections de l’événement" [ref=e110]:
              - tab "Programme" [selected] [ref=e111] [cursor=pointer]
              - tab "Billets , 3" [ref=e113] [cursor=pointer]:
                - generic [ref=e114]: Billets
                - generic [ref=e115]:
                  - generic [ref=e116]: ","
                  - text: "3"
              - tab "Lieu" [ref=e117] [cursor=pointer]
            - tabpanel "Programme" [ref=e119]: Ouverture des portes à 19 h.
            - generic [ref=e120]:
              - generic [ref=e121]: Gratuit
              - generic [ref=e123]: Dernières places
              - generic [ref=e125]: Complet
              - generic [ref=e127]: Nouveau
              - generic [ref=e129]: Brouillon
            - generic [ref=e131]:
              - button "Concerts" [pressed] [ref=e132] [cursor=pointer]:
                - generic [aria-hidden] [ref=e133]: ✓
                - text: Concerts
              - button "Gratuit" [ref=e134] [cursor=pointer]
              - button "Cette semaine" [ref=e135] [cursor=pointer]
          - region [ref=e136]:
            - heading "Retours et fenêtres" [level=2] [ref=e137]
            - generic [ref=e138]:
              - button "Montrer les toasts" [ref=e139] [cursor=pointer]
              - button "Ouvrir la confirmation" [ref=e141] [cursor=pointer]
          - region [ref=e143]:
            - heading "Chargement et état vide" [level=2] [ref=e144]
            - generic [ref=e165]:
              - heading "Aucun événement cette semaine" [level=3] [ref=e171]
              - paragraph [ref=e172]: Élargissez la recherche à tout le mois ou à une autre ville.
              - button "Voir tout le mois" [ref=e173] [cursor=pointer]
          - region [ref=e175]:
            - heading "Repères de la carte" [level=2] [ref=e176]
            - generic [ref=e177]:
              - img "10 000 F" [ref=e178]
              - img "Gratuit" [ref=e182]
              - img "Événement choisi, 5 000 F" [ref=e186]:
                - generic [ref=e187]: 5 000 F
              - img "À la une" [ref=e190]
              - img "3 événements" [ref=e194]
          - region [ref=e197]:
            - heading "Feuille glissante" [level=2] [ref=e198]
            - region [ref=e199]:
              - generic [ref=e202]:
                - heading "12 événements autour de vous" [level=2] [ref=e203]
                - button "Tout afficher" [ref=e204] [cursor=pointer]
              - paragraph [ref=e206]: Liste des événements visibles sur la carte.
    - navigation "Navigation rapide" [ref=e210]:
      - generic [ref=e211]:
        - link "Accueil" [ref=e212] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e217] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e222] [cursor=pointer]:
          - /url: /tickets
        - link "Portefeuille" [ref=e226] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e231]
```

# Test source

```ts
  210 |                 await context.addInitScript(stretchTimers, screen.slowTimers);
  211 |             }
  212 |             if (screen.injectError) {
  213 |                 record.notes.push(`état d'erreur simulé : réponses ${screen.injectError} remplacées par un 500 (erreurs de console attendues, ignorées)`);
  214 |                 await page.route(screen.injectError, (route) => route.fulfill({
  215 |                     status: 500,
  216 |                     contentType: 'application/json; charset=utf-8',
  217 |                     body: JSON.stringify({ error: screen.injectErrorMessage ?? 'Erreur simulée par les tests de bout en bout.', code: 'E2E_SIMULATED_ERROR' }),
  218 |                 }));
  219 |             }
  220 |             const stubs: StubResponse[] = [...(screen.stubResponse ? [screen.stubResponse] : []), ...(screen.stubResponses ?? [])];
  221 |             for (const stub of stubs) {
  222 |                 record.notes.push(`réponse simulée : ${stub.method ?? 'toute méthode'} ${stub.url} remplacée par HTTP ${stub.status} ${JSON.stringify(stub.body).slice(0, 160)}`);
  223 |                 await page.route(stub.url, async (route) => {
  224 |                     if (!methodMatches(stub.method, route.request().method())) {
  225 |                         await route.fallback();
  226 |                         return;
  227 |                     }
  228 |                     await route.fulfill({ status: stub.status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(stub.body) });
  229 |                 });
  230 |             }
  231 |             for (const hold of screen.holdRequests ?? []) {
  232 |                 record.notes.push(`requête retenue (jamais servie) : ${hold.method ?? 'toute méthode'} ${hold.url}`);
  233 |                 await page.route(hold.url, async (route) => {
  234 |                     if (!methodMatches(hold.method, route.request().method())) {
  235 |                         await route.fallback();
  236 |                         return;
  237 |                     }
  238 |                     // Retenue jusqu'à la fermeture de la page : ni réponse ni erreur (réseau lent, téléchargement en cours)
  239 |                     await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  240 |                 });
  241 |             }
  242 |             if (screen.fakePush) {
  243 |                 const subscription = screen.fakePush === 'granted' ? await fakePushSubscriber() : null;
  244 |                 record.notes.push(screen.fakePush === 'granted'
  245 |                     ? `push simulé (granted) : permission accordée au clic sans fenêtre, inscription du service worker et pushManager.subscribe remplacés ; abonnement du faux service push ${subscription?.endpoint ?? '?'} ; configuration VAPID, route d'inscription et base réelles`
  246 |                     : screen.fakePush === 'denied'
  247 |                         ? 'push simulé (denied) : Notification.permission = « denied », appels à requestPermission comptés'
  248 |                         : 'push simulé (unsupported) : window.PushManager et window.Notification supprimés');
  249 |                 await context.addInitScript(installFakePush, { mode: screen.fakePush, subscription });
  250 |             }
  251 |             if (screen.fakeCamera) {
  252 |                 const mode = screen.fakeCamera === 'barcode-detector' ? 'barcode-detector' : fakeScanMode();
  253 |                 record.notes.push(`caméra simulée (${mode})${mode === 'barcode-detector' ? ' : faux BarcodeDetector, payload posé par le test' : ''}`);
  254 |                 await context.addInitScript(installFakeCamera, { mode });
  255 |             }
  256 |             if (screen.offline === 'before-load') {
  257 |                 record.notes.push('connexion coupée avant le chargement (collecte d’erreurs arrêtée)');
  258 |                 guard.freeze();
  259 |                 await context.setOffline(true);
  260 |             }
  261 |             const response = await page.goto(record.url, { waitUntil: 'load' });
  262 |             record.status = response ? response.status() : null;
  263 |             if (screen.expectStatus !== undefined) {
  264 |                 expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
  265 |             }
  266 |             if (screen.offline === 'after-load') {
  267 |                 record.notes.push('connexion coupée après le chargement (collecte d’erreurs arrêtée)');
  268 |                 guard.freeze();
  269 |                 await context.setOffline(true);
  270 |             }
  271 |             const sc = { page, context, guard, ids: demo };
  272 |             if (screen.ready) await screen.ready(sc);
  273 |             await settle(page, guard, record.notes);
  274 |             if (screen.actions) {
  275 |                 await screen.actions(sc);
  276 |                 await settle(page, guard, record.notes);
  277 |             }
  278 |             if (screen.id === 'cloche-ouverte' && vue === 'mobile') {
  279 |                 const problem = await markAllOnOneLine(page);
  280 |                 if (problem) record.blocking.push(problem);
  281 |             }
  282 |             const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true, references: screen.references });
  283 |             record.blocking.push(...checks.blocking);
  284 |             record.warnings.push(...checks.warnings);
  285 |             record.axeDetails = checks.axeDetails;
  286 |             record.smallTextDetails = checks.smallTextDetails;
  287 |             record.metrics = checks.metrics;
  288 |             const shot = await capture(page, screen, file);
  289 |             record.captured = true;
  290 |             await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  291 |         } catch (err) {
  292 |             record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  293 |             if (!record.captured && !page.isClosed()) {
  294 |                 await capture(page, screen, file).then(
  295 |                     async (shot) => {
  296 |                         record.captured = true;
  297 |                         record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
  298 |                         await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  299 |                     },
  300 |                     (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
  301 |                 );
  302 |             }
  303 |             throw err;
  304 |         } finally {
  305 |             record.blocking.push(...guard.blockingIssues());
  306 |             record.warnings.push(...guard.nonBlockingIssues());
  307 |             record.durationMs = Date.now() - started;
  308 |             writeCaptureRecord(record);
  309 |         }
> 310 |         expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
      |                                                                   ^ Error: contrôles bloquants de design-composants__mobile__sombre.png
  311 |     });
  312 | }
  313 | 
  314 | for (const theme of THEMES) {
  315 |     for (const role of ROLE_ORDER) {
  316 |         const screens = SCREENS.filter((s) => s.role === role);
  317 |         if (screens.length === 0) continue;
  318 |         test.describe(`${theme.key} · ${role}`, () => {
  319 |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  320 | 
  321 |             for (const screen of screens) {
  322 |                 if (screen.serviceWorkers === 'allow') {
  323 |                     // Lot 7 (D7) : service worker autorisé seulement dans le contexte de cet écran
  324 |                     test.describe(`${screen.id} (service worker autorisé)`, () => {
  325 |                         test.use({ serviceWorkers: 'allow' });
  326 |                         defineCapture(screen, theme, role);
  327 |                     });
  328 |                 } else {
  329 |                     defineCapture(screen, theme, role);
  330 |                 }
  331 |             }
  332 |         });
  333 |     }
  334 | }
  335 | 
```