# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · client >> mes-billets-recus-refuser — Mes billets — Reçus : confirmation « Refuser » d’un transfert entrant
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de mes-billets-recus-refuser__mobile__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "3 cible(s) < 44 px : button « Fermer » 42×42 ; button « Revenir » 163×42 ; button « Refuser le billet » 163×42",
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
        - generic [ref=e16]:
          - button "Notifications, 7 non lues" [ref=e18] [cursor=pointer]:
            - generic [ref=e22]: "7"
          - button "Basculer le thème" [pressed] [ref=e24] [cursor=pointer]
          - link "Mon profil (Fatou Mbaye)" [ref=e32] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e33]: FM
      - main [ref=e35]:
        - generic [ref=e37]:
          - generic [ref=e39]:
            - generic [ref=e40]:
              - status [ref=e42]: En direct
              - heading "Mes billets" [level=1] [ref=e44]
              - paragraph [ref=e45]: "Présentez le QR code de votre billet à l’entrée. Il se renouvelle tout seul : gardez la page ouverte."
            - generic [ref=e46]:
              - link "Afficher mes billets hors ligne" [ref=e47] [cursor=pointer]:
                - /url: /billet/hors-ligne
              - button "Comment marche le transfert ?" [ref=e55] [cursor=pointer]
              - link "Réserver un billet" [ref=e61] [cursor=pointer]:
                - /url: /explore
          - tablist "Filtrer mes billets" [ref=e68]:
            - tab "À venir" [ref=e69] [cursor=pointer]
            - tab "Tous mes billets" [ref=e71] [cursor=pointer]
            - tab "Historique" [ref=e73] [cursor=pointer]
            - tab "Reçus , 1" [selected] [ref=e75] [cursor=pointer]:
              - generic [ref=e76]: Reçus
              - generic [ref=e77]:
                - generic [ref=e78]: ","
                - text: "1"
          - tabpanel "Reçus , 1" [ref=e79]:
            - list [ref=e81]:
              - listitem [ref=e82]:
                - article [ref=e83]:
                  - generic [ref=e88]:
                    - heading "Festival Jazz sur le Fleuve" [level=3] [ref=e89]
                    - paragraph [ref=e90]: Envoyé par Marième N.
                  - generic [ref=e94]:
                    - generic [ref=e95]:
                      - term [ref=e96]: Date
                      - definition [ref=e97]:
                        - generic [ref=e102]: ven. 27 nov. 2026 à 18:00
                    - generic [ref=e103]:
                      - term [ref=e104]: Lieu
                      - definition [ref=e105]:
                        - generic [ref=e109]: Quai des Pêcheurs, Saint-Louis
                    - generic [ref=e110]:
                      - term [ref=e111]: Billet
                      - definition [ref=e112]:
                        - generic [ref=e115]: Pass soirée · 7 500 F CFA
                    - generic [ref=e116]:
                      - term [ref=e117]: Délai
                      - definition [ref=e118]:
                        - generic [ref=e122]: À accepter avant le mar. 17 nov. 2026 à 00:51
                  - generic [ref=e123]:
                    - button "Accepter le billet" [ref=e124] [cursor=pointer]
                    - button "Refuser le billet pour Festival Jazz sur le Fleuve" [ref=e131] [cursor=pointer]:
                      - generic [ref=e136]: Refuser
    - navigation "Navigation rapide" [ref=e137]:
      - generic [ref=e138]:
        - link "Accueil" [ref=e139] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e144] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e149] [cursor=pointer]:
          - /url: /tickets
        - link "Portefeuille" [ref=e153] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e158]
  - alertdialog [ref=e161]:
    - generic [ref=e162]:
      - heading "Refuser ce billet ?" [level=2] [ref=e165]
      - button "Fermer" [ref=e166] [cursor=pointer]
    - paragraph [ref=e177]: Le billet pour « Festival Jazz sur le Fleuve » reste à son expéditeur, qui est prévenu. Vous ne pourrez plus l’accepter.
    - generic [ref=e178]:
      - button "Revenir" [active] [ref=e179] [cursor=pointer]
      - button "Refuser le billet" [ref=e181] [cursor=pointer]
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
      |                                                                   ^ Error: contrôles bloquants de mes-billets-recus-refuser__mobile__sombre.png
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