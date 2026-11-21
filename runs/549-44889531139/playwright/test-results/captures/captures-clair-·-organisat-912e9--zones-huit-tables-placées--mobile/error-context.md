# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · organisateur >> org-tables-plan — Établissement — plan de salle (édition : deux zones, huit tables placées)
- Location: e2e/captures.spec.ts:193:9

# Error details

```
Error: contrôles bloquants de org-tables-plan__mobile__clair.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "axe-core label-content-name-mismatch (serious, 8 nœud(s)) : Elements must have their visible text as part of their accessible name",
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
          - button "Basculer le thème" [ref=e21] [cursor=pointer]
          - link "Mon profil (Mariama Ndiaye)" [ref=e25] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e26]: MN
      - main [ref=e28]:
        - generic [ref=e30]:
          - generic [ref=e31]:
            - link "Retour à l’établissement" [ref=e33] [cursor=pointer]:
              - /url: /partner/tables/edition/0298e800-f646-4b56-a083-5a0aac1b8bd8
            - generic [ref=e38]:
              - generic [ref=e39]:
                - heading "Plan de salle" [level=1] [ref=e40]
                - paragraph [ref=e41]: La Terrasse du Plateau
              - button "Plan enregistré" [disabled] [ref=e43]
          - generic [ref=e50]:
            - generic [ref=e53]:
              - generic [ref=e54]:
                - generic [ref=e55] [cursor=pointer]: Montrer le plan aux clients
                - paragraph [ref=e56]: Les clients choisissent leur table sur le plan au moment de réserver. 8 tables placées sur 8.
              - generic [ref=e57]:
                - generic [aria-hidden] [ref=e58]: Activé
                - switch "Montrer le plan aux clients" [checked] [ref=e59] [cursor=pointer]
            - status [ref=e62]:
              - generic [ref=e70]:
                - paragraph [ref=e71]: Faites glisser les tables du doigt ou à la souris
                - generic [ref=e72]: "Touchez une table ou une zone pour la tourner, changer sa forme, l’agrandir ou la retirer. Au clavier : flèches pour déplacer (Majuscule pour aller plus vite), R pour tourner."
            - generic [ref=e73]:
              - generic [ref=e74]:
                - group "Plan de salle de La Terrasse du Plateau" [ref=e75]:
                  - generic [ref=e76]:
                    - button "Zone Salle climatisée" [ref=e78]
                    - button "Zone Terrasse" [ref=e80]
                    - button "Table 1, 2 places, forme ronde" [ref=e81]:
                      - generic [aria-hidden] [ref=e83]:
                        - generic [ref=e84]: "1"
                        - generic [ref=e85]: "2"
                    - button "Table 2, 2 places, forme ronde" [ref=e91]:
                      - generic [aria-hidden] [ref=e93]:
                        - generic [ref=e94]: "2"
                        - generic [ref=e95]: "2"
                    - button "Table 3, 4 places, à partir de 2, forme carrée" [ref=e101]:
                      - generic [aria-hidden] [ref=e103]:
                        - generic [ref=e104]: "3"
                        - generic [ref=e105]: "4"
                    - button "Table 4, 4 places, à partir de 2, forme carrée" [ref=e111]:
                      - generic [aria-hidden] [ref=e113]:
                        - generic [ref=e114]: "4"
                        - generic [ref=e115]: "4"
                    - button "Table 5, 6 places, à partir de 3, forme rectangle" [ref=e121]:
                      - generic [aria-hidden] [ref=e123]:
                        - generic [ref=e124]: "5"
                        - generic [ref=e125]: "6"
                    - button "Table 6, 4 places, à partir de 2, forme carrée" [ref=e131]:
                      - generic [aria-hidden] [ref=e133]:
                        - generic [ref=e134]: "6"
                        - generic [ref=e135]: "4"
                    - button "Table 7, 6 places, à partir de 3, forme rectangle" [ref=e141]:
                      - generic [aria-hidden] [ref=e143]:
                        - generic [ref=e144]: "7"
                        - generic [ref=e145]: "6"
                    - button "Table 8, 8 places, à partir de 4, forme rectangle" [ref=e151]:
                      - generic [aria-hidden] [ref=e153]:
                        - generic [ref=e154]: "8"
                        - generic [ref=e155]: "8"
                - paragraph [ref=e161]: "Zones du plan : Salle climatisée, Terrasse"
                - paragraph [ref=e162]: "Flèches : déplacer de 1 %. Majuscule et flèches : déplacer de 5 %. Touche R : tourner la table de 15 degrés."
                - paragraph [ref=e163]
              - region "Réglages de l’élément choisi" [ref=e165]:
                - paragraph [ref=e166]: "Touchez une table ou une zone du plan pour la régler : position, forme, rotation, taille."
            - generic [ref=e167]:
              - paragraph [ref=e168]: Tout est enregistré.
              - button "Plan enregistré" [disabled] [ref=e169]
    - navigation "Navigation rapide" [ref=e176]:
      - generic [ref=e177]:
        - link "Accueil" [ref=e178] [cursor=pointer]:
          - /url: /partner/dashboard
        - link "Billetterie" [ref=e185] [cursor=pointer]:
          - /url: /partner/events
        - link "Scanner" [ref=e189] [cursor=pointer]:
          - /url: /partner/scan
        - link "Finances" [ref=e197] [cursor=pointer]:
          - /url: /partner/finance
        - link "Profil" [ref=e201] [cursor=pointer]:
          - /url: /partner/profile
  - alert [ref=e206]
```

# Test source

```ts
  225 |                 await context.addInitScript(stretchTimers, screen.slowTimers);
  226 |             }
  227 |             if (screen.injectError) {
  228 |                 record.notes.push(`état d'erreur simulé : réponses ${screen.injectError} remplacées par un 500 (erreurs de console attendues, ignorées)`);
  229 |                 await page.route(screen.injectError, (route) => route.fulfill({
  230 |                     status: 500,
  231 |                     contentType: 'application/json; charset=utf-8',
  232 |                     body: JSON.stringify({ error: screen.injectErrorMessage ?? 'Erreur simulée par les tests de bout en bout.', code: 'E2E_SIMULATED_ERROR' }),
  233 |                 }));
  234 |             }
  235 |             const stubs: StubResponse[] = [...(screen.stubResponse ? [screen.stubResponse] : []), ...(screen.stubResponses ?? [])];
  236 |             for (const stub of stubs) {
  237 |                 record.notes.push(`réponse simulée : ${stub.method ?? 'toute méthode'} ${stub.url} remplacée par HTTP ${stub.status} ${JSON.stringify(stub.body).slice(0, 160)}`);
  238 |                 await page.route(stub.url, async (route) => {
  239 |                     if (!methodMatches(stub.method, route.request().method())) {
  240 |                         await route.fallback();
  241 |                         return;
  242 |                     }
  243 |                     await route.fulfill({ status: stub.status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(stub.body) });
  244 |                 });
  245 |             }
  246 |             for (const hold of screen.holdRequests ?? []) {
  247 |                 record.notes.push(`requête retenue (jamais servie) : ${hold.method ?? 'toute méthode'} ${hold.url}`);
  248 |                 await page.route(hold.url, async (route) => {
  249 |                     if (!methodMatches(hold.method, route.request().method())) {
  250 |                         await route.fallback();
  251 |                         return;
  252 |                     }
  253 |                     // Retenue jusqu'à la fermeture de la page : ni réponse ni erreur (réseau lent, téléchargement en cours)
  254 |                     await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  255 |                 });
  256 |             }
  257 |             if (screen.fakePush) {
  258 |                 const subscription = screen.fakePush === 'granted' ? await fakePushSubscriber() : null;
  259 |                 record.notes.push(screen.fakePush === 'granted'
  260 |                     ? `push simulé (granted) : permission accordée au clic sans fenêtre, inscription du service worker et pushManager.subscribe remplacés ; abonnement du faux service push ${subscription?.endpoint ?? '?'} ; configuration VAPID, route d'inscription et base réelles`
  261 |                     : screen.fakePush === 'denied'
  262 |                         ? 'push simulé (denied) : Notification.permission = « denied », appels à requestPermission comptés'
  263 |                         : 'push simulé (unsupported) : window.PushManager et window.Notification supprimés');
  264 |                 await context.addInitScript(installFakePush, { mode: screen.fakePush, subscription });
  265 |             }
  266 |             if (screen.fakeCamera) {
  267 |                 const mode = screen.fakeCamera === 'barcode-detector' ? 'barcode-detector' : fakeScanMode();
  268 |                 record.notes.push(`caméra simulée (${mode})${mode === 'barcode-detector' ? ' : faux BarcodeDetector, payload posé par le test' : ''}`);
  269 |                 await context.addInitScript(installFakeCamera, { mode });
  270 |             }
  271 |             if (screen.offline === 'before-load') {
  272 |                 record.notes.push('connexion coupée avant le chargement (collecte d’erreurs arrêtée)');
  273 |                 guard.freeze();
  274 |                 await context.setOffline(true);
  275 |             }
  276 |             const response = await page.goto(record.url, { waitUntil: 'load' });
  277 |             record.status = response ? response.status() : null;
  278 |             if (screen.expectStatus !== undefined) {
  279 |                 expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
  280 |             }
  281 |             if (screen.offline === 'after-load') {
  282 |                 record.notes.push('connexion coupée après le chargement (collecte d’erreurs arrêtée)');
  283 |                 guard.freeze();
  284 |                 await context.setOffline(true);
  285 |             }
  286 |             const sc = { page, context, guard, ids: demo };
  287 |             if (screen.ready) await screen.ready(sc);
  288 |             await settle(page, guard, record.notes);
  289 |             if (screen.actions) {
  290 |                 await screen.actions(sc);
  291 |                 await settle(page, guard, record.notes);
  292 |             }
  293 |             if (screen.id === 'cloche-ouverte' && vue === 'mobile') {
  294 |                 const problem = await markAllOnOneLine(page);
  295 |                 if (problem) record.blocking.push(problem);
  296 |             }
  297 |             const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true, references: screen.references });
  298 |             record.blocking.push(...checks.blocking);
  299 |             record.warnings.push(...checks.warnings);
  300 |             record.axeDetails = checks.axeDetails;
  301 |             record.smallTextDetails = checks.smallTextDetails;
  302 |             record.metrics = checks.metrics;
  303 |             const shot = await capture(page, screen, file);
  304 |             record.captured = true;
  305 |             await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  306 |         } catch (err) {
  307 |             record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  308 |             if (!record.captured && !page.isClosed()) {
  309 |                 await capture(page, screen, file).then(
  310 |                     async (shot) => {
  311 |                         record.captured = true;
  312 |                         record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
  313 |                         await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  314 |                     },
  315 |                     (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
  316 |                 );
  317 |             }
  318 |             throw err;
  319 |         } finally {
  320 |             record.blocking.push(...guard.blockingIssues());
  321 |             record.warnings.push(...guard.nonBlockingIssues());
  322 |             record.durationMs = Date.now() - started;
  323 |             writeCaptureRecord(record);
  324 |         }
> 325 |         expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
      |                                                                   ^ Error: contrôles bloquants de org-tables-plan__mobile__clair.png
  326 |     });
  327 | }
  328 | 
  329 | for (const theme of THEMES) {
  330 |     for (const role of ROLE_ORDER) {
  331 |         const screens = SCREENS.filter((s) => s.role === role);
  332 |         if (screens.length === 0) continue;
  333 |         test.describe(`${theme.key} · ${role}`, () => {
  334 |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  335 | 
  336 |             for (const screen of screens) {
  337 |                 if (screen.serviceWorkers === 'allow') {
  338 |                     // Lot 7 (D7) : service worker autorisé seulement dans le contexte de cet écran
  339 |                     test.describe(`${screen.id} (service worker autorisé)`, () => {
  340 |                         test.use({ serviceWorkers: 'allow' });
  341 |                         defineCapture(screen, theme, role);
  342 |                     });
  343 |                 } else {
  344 |                     defineCapture(screen, theme, role);
  345 |                 }
  346 |             }
  347 |         });
  348 |     }
  349 | }
  350 | 
```