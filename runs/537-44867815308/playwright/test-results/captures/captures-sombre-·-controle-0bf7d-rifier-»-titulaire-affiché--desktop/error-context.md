# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · controleur >> scanner-saisie-manuelle — Scanner — saisie manuelle, étape « Vérifier » (titulaire affiché)
- Location: e2e/captures.spec.ts:192:9

# Error details

```
Error: contrôles bloquants de scanner-saisie-manuelle__ordinateur__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "axe-core color-contrast (serious, 1 nœud(s)) : Elements must meet minimum color contrast ratio thresholds",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - link "Mon espace client" [ref=e6] [cursor=pointer]:
          - /url: /
        - link "Event Village, accueil" [ref=e11] [cursor=pointer]:
          - /url: /
          - generic [ref=e12]: Event Village
      - generic [ref=e15]:
        - button "Notifications, 1 non lue" [ref=e17] [cursor=pointer]:
          - generic [ref=e21]: "1"
        - link "Ibrahima Gueye" [ref=e22] [cursor=pointer]:
          - /url: /controller/profile
    - main [ref=e28]:
      - generic [ref=e29]:
        - generic [ref=e30]:
          - generic [ref=e31]:
            - heading "Nuit du Sabar — édition d’automne" [level=1] [ref=e32]
            - paragraph [ref=e33]:
              - status [ref=e34]: "Entrée principale : 54 entrées"
              - generic [ref=e35]: En ligne
          - button "Changer d’événement" [ref=e40] [cursor=pointer]
          - button "Se déconnecter" [ref=e45] [cursor=pointer]
        - tablist "Espace du contrôleur" [ref=e51]:
          - tab "Contrôle" [selected] [ref=e52] [cursor=pointer]
          - tab "Guichet" [ref=e54] [cursor=pointer]
          - tab "Caisse" [ref=e56] [cursor=pointer]
        - tabpanel "Contrôle" [ref=e58]:
          - generic [ref=e59]:
            - generic [ref=e62]:
              - generic [ref=e63]:
                - generic [ref=e64]:
                  - generic [ref=e65]: Numéro du billet
                  - textbox "Numéro du billet" [ref=e67]:
                    - /placeholder: TCK-20261101-XXXXXXXXXX
                    - text: TCK-20261121-F2EF9AA794
                  - paragraph [ref=e68]: "Spectateur sans téléphone : saisissez le numéro imprimé sur son billet, puis vérifiez le titulaire avant de valider."
                - button "Vérifier le billet" [ref=e69] [cursor=pointer]
              - region [ref=e75]:
                - heading "Billet TCK-20261121-F2EF9AA794" [level=3] [ref=e76]
                - generic [ref=e77]:
                  - term [ref=e78]: Titulaire
                  - definition [ref=e79]: Moussa Sy
                  - term [ref=e80]: Catégorie
                  - definition [ref=e81]: Prévente
                  - term [ref=e82]: Billet
                  - definition [ref=e83]: Valable
                  - term [ref=e84]: Résultat prévu
                  - definition [ref=e85]: Entrée possible
                - generic [ref=e86] [cursor=pointer]:
                  - checkbox "Pièce d’identité conforme au titulaire Le nom sur la pièce correspond au titulaire ci-dessus. Obligatoire." [ref=e87]
                  - generic [ref=e88]:
                    - generic [ref=e89]: Pièce d’identité conforme au titulaire
                    - generic [ref=e94]: Le nom sur la pièce correspond au titulaire ci-dessus. Obligatoire.
                - button "Pièce conforme, valider l’entrée" [disabled] [ref=e95]
                - button "Nouvelle vérification" [ref=e97] [cursor=pointer]
            - generic [ref=e103]:
              - group "Mode de contrôle" [ref=e104]:
                - button "Caméra" [ref=e105] [cursor=pointer]
                - button "Saisie manuelle" [pressed] [ref=e111] [cursor=pointer]
              - button "Liste des invités" [ref=e117] [cursor=pointer]
              - 'button "Derniers scans Vous : 32 entrées, 5 refus" [ref=e126] [cursor=pointer]':
                - generic [ref=e131]:
                  - generic [ref=e132]: Derniers scans
                  - generic [ref=e133]: "Vous : 32 entrées, 5 refus"
              - group [ref=e136]:
                - generic "Réglages de cet appareil" [ref=e137] [cursor=pointer]
  - alert [ref=e141]
```

# Test source

```ts
  224 |                 await context.addInitScript(stretchTimers, screen.slowTimers);
  225 |             }
  226 |             if (screen.injectError) {
  227 |                 record.notes.push(`état d'erreur simulé : réponses ${screen.injectError} remplacées par un 500 (erreurs de console attendues, ignorées)`);
  228 |                 await page.route(screen.injectError, (route) => route.fulfill({
  229 |                     status: 500,
  230 |                     contentType: 'application/json; charset=utf-8',
  231 |                     body: JSON.stringify({ error: screen.injectErrorMessage ?? 'Erreur simulée par les tests de bout en bout.', code: 'E2E_SIMULATED_ERROR' }),
  232 |                 }));
  233 |             }
  234 |             const stubs: StubResponse[] = [...(screen.stubResponse ? [screen.stubResponse] : []), ...(screen.stubResponses ?? [])];
  235 |             for (const stub of stubs) {
  236 |                 record.notes.push(`réponse simulée : ${stub.method ?? 'toute méthode'} ${stub.url} remplacée par HTTP ${stub.status} ${JSON.stringify(stub.body).slice(0, 160)}`);
  237 |                 await page.route(stub.url, async (route) => {
  238 |                     if (!methodMatches(stub.method, route.request().method())) {
  239 |                         await route.fallback();
  240 |                         return;
  241 |                     }
  242 |                     await route.fulfill({ status: stub.status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(stub.body) });
  243 |                 });
  244 |             }
  245 |             for (const hold of screen.holdRequests ?? []) {
  246 |                 record.notes.push(`requête retenue (jamais servie) : ${hold.method ?? 'toute méthode'} ${hold.url}`);
  247 |                 await page.route(hold.url, async (route) => {
  248 |                     if (!methodMatches(hold.method, route.request().method())) {
  249 |                         await route.fallback();
  250 |                         return;
  251 |                     }
  252 |                     // Retenue jusqu'à la fermeture de la page : ni réponse ni erreur (réseau lent, téléchargement en cours)
  253 |                     await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  254 |                 });
  255 |             }
  256 |             if (screen.fakePush) {
  257 |                 const subscription = screen.fakePush === 'granted' ? await fakePushSubscriber() : null;
  258 |                 record.notes.push(screen.fakePush === 'granted'
  259 |                     ? `push simulé (granted) : permission accordée au clic sans fenêtre, inscription du service worker et pushManager.subscribe remplacés ; abonnement du faux service push ${subscription?.endpoint ?? '?'} ; configuration VAPID, route d'inscription et base réelles`
  260 |                     : screen.fakePush === 'denied'
  261 |                         ? 'push simulé (denied) : Notification.permission = « denied », appels à requestPermission comptés'
  262 |                         : 'push simulé (unsupported) : window.PushManager et window.Notification supprimés');
  263 |                 await context.addInitScript(installFakePush, { mode: screen.fakePush, subscription });
  264 |             }
  265 |             if (screen.fakeCamera) {
  266 |                 const mode = screen.fakeCamera === 'barcode-detector' ? 'barcode-detector' : fakeScanMode();
  267 |                 record.notes.push(`caméra simulée (${mode})${mode === 'barcode-detector' ? ' : faux BarcodeDetector, payload posé par le test' : ''}`);
  268 |                 await context.addInitScript(installFakeCamera, { mode });
  269 |             }
  270 |             if (screen.offline === 'before-load') {
  271 |                 record.notes.push('connexion coupée avant le chargement (collecte d’erreurs arrêtée)');
  272 |                 guard.freeze();
  273 |                 await context.setOffline(true);
  274 |             }
  275 |             const response = await page.goto(record.url, { waitUntil: 'load' });
  276 |             record.status = response ? response.status() : null;
  277 |             if (screen.expectStatus !== undefined) {
  278 |                 expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
  279 |             }
  280 |             if (screen.offline === 'after-load') {
  281 |                 record.notes.push('connexion coupée après le chargement (collecte d’erreurs arrêtée)');
  282 |                 guard.freeze();
  283 |                 await context.setOffline(true);
  284 |             }
  285 |             const sc = { page, context, guard, ids: demo };
  286 |             if (screen.ready) await screen.ready(sc);
  287 |             await settle(page, guard, record.notes);
  288 |             if (screen.actions) {
  289 |                 await screen.actions(sc);
  290 |                 await settle(page, guard, record.notes);
  291 |             }
  292 |             if (screen.id === 'cloche-ouverte' && vue === 'mobile') {
  293 |                 const problem = await markAllOnOneLine(page);
  294 |                 if (problem) record.blocking.push(problem);
  295 |             }
  296 |             const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true, references: screen.references });
  297 |             record.blocking.push(...checks.blocking);
  298 |             record.warnings.push(...checks.warnings);
  299 |             record.axeDetails = checks.axeDetails;
  300 |             record.smallTextDetails = checks.smallTextDetails;
  301 |             record.metrics = checks.metrics;
  302 |             const shot = await capture(page, screen, file);
  303 |             record.captured = true;
  304 |             await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  305 |         } catch (err) {
  306 |             record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  307 |             if (!record.captured && !page.isClosed()) {
  308 |                 await capture(page, screen, file).then(
  309 |                     async (shot) => {
  310 |                         record.captured = true;
  311 |                         record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
  312 |                         await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  313 |                     },
  314 |                     (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
  315 |                 );
  316 |             }
  317 |             throw err;
  318 |         } finally {
  319 |             record.blocking.push(...guard.blockingIssues());
  320 |             record.warnings.push(...guard.nonBlockingIssues());
  321 |             record.durationMs = Date.now() - started;
  322 |             writeCaptureRecord(record);
  323 |         }
> 324 |         expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
      |                                                                   ^ Error: contrôles bloquants de scanner-saisie-manuelle__ordinateur__sombre.png
  325 |     });
  326 | }
  327 | 
  328 | for (const theme of THEMES) {
  329 |     for (const role of ROLE_ORDER) {
  330 |         const screens = SCREENS.filter((s) => s.role === role);
  331 |         if (screens.length === 0) continue;
  332 |         test.describe(`${theme.key} · ${role}`, () => {
  333 |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  334 | 
  335 |             for (const screen of screens) {
  336 |                 if (screen.serviceWorkers === 'allow') {
  337 |                     // Lot 7 (D7) : service worker autorisé seulement dans le contexte de cet écran
  338 |                     test.describe(`${screen.id} (service worker autorisé)`, () => {
  339 |                         test.use({ serviceWorkers: 'allow' });
  340 |                         defineCapture(screen, theme, role);
  341 |                     });
  342 |                 } else {
  343 |                     defineCapture(screen, theme, role);
  344 |                 }
  345 |             }
  346 |         });
  347 |     }
  348 | }
  349 | 
```