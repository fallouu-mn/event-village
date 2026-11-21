# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · organisateur >> org-tables-plan — Établissement — plan de salle (édition : deux zones, huit tables placées)
- Location: e2e/captures.spec.ts:193:9

# Error details

```
Error: contrôles bloquants de org-tables-plan__ordinateur__sombre.png

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
    - complementary [ref=e3]:
      - link "Event Village, accueil" [ref=e5] [cursor=pointer]:
        - /url: /
        - generic [ref=e6]: Event Village
      - navigation "Navigation principale" [ref=e9]:
        - generic [ref=e10]:
          - paragraph [ref=e11]: Gestion
          - generic [ref=e12]:
            - link "Tableau de bord" [ref=e13] [cursor=pointer]:
              - /url: /partner/dashboard
            - link "Événements" [ref=e20] [cursor=pointer]:
              - /url: /partner/events
            - link "Salles de fête" [ref=e24] [cursor=pointer]:
              - /url: /partner/halls
            - link "Tables" [ref=e30] [cursor=pointer]:
              - /url: /partner/tables
            - link "Équipe" [ref=e35] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=e42]:
          - paragraph [ref=e43]: Outils
          - generic [ref=e44]:
            - link "Finances" [ref=e45] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=e49] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=e53] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=e61] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=e65] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=e70] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=e76] [cursor=pointer]:
          - /url: /
      - generic [ref=e82]:
        - link "Mariama Ndiaye Partenaire" [ref=e83] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e84]: MN
          - generic [ref=e85]:
            - generic [ref=e86]: Mariama Ndiaye
            - generic [ref=e87]: Partenaire
        - generic [ref=e88]:
          - button "Se déconnecter" [ref=e89] [cursor=pointer]
          - button "Basculer le thème" [ref=e94] [cursor=pointer]
    - generic [ref=e98]:
      - banner [ref=e99]:
        - link "Rechercher un événement…" [ref=e101] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 37 non lues" [ref=e108] [cursor=pointer]:
          - generic [ref=e112]: "37"
      - main [ref=e113]:
        - generic [ref=e115]:
          - generic [ref=e116]:
            - link "Retour à l’établissement" [ref=e118] [cursor=pointer]:
              - /url: /partner/tables/edition/c4b57642-db5a-4206-93e0-1ef3dc232ba8
            - generic [ref=e123]:
              - generic [ref=e124]:
                - heading "Plan de salle" [level=1] [ref=e125]
                - paragraph [ref=e126]: La Terrasse du Plateau
              - button "Plan enregistré" [disabled] [ref=e128]
          - generic [ref=e135]:
            - generic [ref=e138]:
              - generic [ref=e139]:
                - generic [ref=e140] [cursor=pointer]: Montrer le plan aux clients
                - paragraph [ref=e141]: Les clients choisissent leur table sur le plan au moment de réserver. 8 tables placées sur 8.
              - generic [ref=e142]:
                - generic [aria-hidden] [ref=e143]: Activé
                - switch "Montrer le plan aux clients" [checked] [ref=e144] [cursor=pointer]
            - status [ref=e147]:
              - generic [ref=e155]:
                - paragraph [ref=e156]: Faites glisser les tables du doigt ou à la souris
                - generic [ref=e157]: "Touchez une table ou une zone pour la tourner, changer sa forme, l’agrandir ou la retirer. Au clavier : flèches pour déplacer (Majuscule pour aller plus vite), R pour tourner."
            - generic [ref=e158]:
              - generic [ref=e159]:
                - group "Plan de salle de La Terrasse du Plateau" [ref=e160]:
                  - generic [ref=e161]:
                    - button "Zone Salle climatisée" [ref=e163]
                    - button "Zone Terrasse" [ref=e165]
                    - button "Table 1, 2 places, forme ronde" [ref=e166]:
                      - generic [aria-hidden] [ref=e168]:
                        - generic [ref=e169]: "1"
                        - generic [ref=e170]: "2"
                    - button "Table 2, 2 places, forme ronde" [ref=e176]:
                      - generic [aria-hidden] [ref=e178]:
                        - generic [ref=e179]: "2"
                        - generic [ref=e180]: "2"
                    - button "Table 3, 2 à 4 places, forme carrée" [ref=e186]:
                      - generic [aria-hidden] [ref=e188]:
                        - generic [ref=e189]: "3"
                        - generic [ref=e190]: "4"
                    - button "Table 4, 2 à 4 places, forme carrée" [ref=e196]:
                      - generic [aria-hidden] [ref=e198]:
                        - generic [ref=e199]: "4"
                        - generic [ref=e200]: "4"
                    - button "Table 5, 3 à 6 places, forme rectangle" [ref=e206]:
                      - generic [aria-hidden] [ref=e208]:
                        - generic [ref=e209]: "5"
                        - generic [ref=e210]: "6"
                    - button "Table 6, 2 à 4 places, forme carrée" [ref=e216]:
                      - generic [aria-hidden] [ref=e218]:
                        - generic [ref=e219]: "6"
                        - generic [ref=e220]: "4"
                    - button "Table 7, 3 à 6 places, forme rectangle" [ref=e226]:
                      - generic [aria-hidden] [ref=e228]:
                        - generic [ref=e229]: "7"
                        - generic [ref=e230]: "6"
                    - button "Table 8, 4 à 8 places, forme rectangle" [ref=e236]:
                      - generic [aria-hidden] [ref=e238]:
                        - generic [ref=e239]: "8"
                        - generic [ref=e240]: "8"
                - paragraph [ref=e246]: "Zones du plan : Salle climatisée, Terrasse"
                - paragraph [ref=e247]: "Flèches : déplacer de 1 %. Majuscule et flèches : déplacer de 5 %. Touche R : tourner la table de 15 degrés."
                - paragraph [ref=e248]
              - region "Réglages de l’élément choisi" [ref=e250]:
                - paragraph [ref=e251]: "Touchez une table ou une zone du plan pour la régler : position, forme, rotation, taille."
            - generic [ref=e252]:
              - paragraph [ref=e253]: Tout est enregistré.
              - button "Plan enregistré" [disabled] [ref=e254]
  - alert [ref=e261]
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
      |                                                                   ^ Error: contrôles bloquants de org-tables-plan__ordinateur__sombre.png
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