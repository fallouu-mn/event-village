# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · anonyme >> design-confirmation — Design 1a — confirmation : le bouton dit l’action et le montant
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de design-confirmation__ordinateur__clair.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "1 cible(s) < 44 px : div « Programme » 1088×20",
+ ]
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - link "Event Village, accueil" [ref=e5] [cursor=pointer]:
        - /url: /
        - generic [ref=e6]: Event Village
      - navigation "Navigation principale" [ref=e9]:
        - generic [ref=e10]:
          - paragraph [ref=e11]: Menu principal
          - generic [ref=e12]:
            - link "Accueil" [ref=e13] [cursor=pointer]:
              - /url: /
            - link "Explorer" [ref=e18] [cursor=pointer]:
              - /url: /explore
            - link "Mes billets" [ref=e23] [cursor=pointer]:
              - /url: /tickets
            - link "Portefeuille" [ref=e27] [cursor=pointer]:
              - /url: /wallet
        - generic [ref=e32]:
          - paragraph [ref=e33]: Espaces métier
          - link "Devenir partenaire" [ref=e35] [cursor=pointer]:
            - /url: /partner/register
      - generic [ref=e41]:
        - link "Se connecter" [ref=e42] [cursor=pointer]:
          - /url: /login
        - button "Basculer le thème" [ref=e48] [cursor=pointer]
    - generic [ref=e52]:
      - banner [ref=e53]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e55] [cursor=pointer]:
          - /url: /explore
        - button "Notifications" [ref=e62] [cursor=pointer]
      - main [ref=e66]:
        - generic [ref=e68]:
          - heading "Composants" [level=1] [ref=e69]
          - region [ref=e70]:
            - heading "Boutons" [level=2] [ref=e71]
            - generic [ref=e72]:
              - button "Enregistrer" [ref=e73] [cursor=pointer]
              - button "Retour" [ref=e75] [cursor=pointer]
              - button "Voir le programme" [ref=e77] [cursor=pointer]
              - button "Plus tard" [ref=e79] [cursor=pointer]
              - button "Rembourser 10 000 F CFA" [ref=e81] [cursor=pointer]
            - button "Choisir mes billets" [ref=e83] [cursor=pointer]
          - region [ref=e85]:
            - heading "Champs" [level=2] [ref=e86]
            - generic [ref=e87]:
              - generic [ref=e88]: Nom complet
              - textbox "Nom complet" [ref=e90]: Awa Ndiaye
              - paragraph [ref=e91]: Tel qu’il figure sur votre pièce d’identité.
            - generic [ref=e92]:
              - generic [ref=e94]:
                - text: Numéro de téléphone*
                - generic [ref=e95]: (obligatoire)
              - textbox "Numéro de téléphone (obligatoire)" [invalid] [ref=e96]: 77 12
              - paragraph [ref=e97]:
                - generic [ref=e100]: Saisissez les 9 chiffres de votre numéro.
          - region [ref=e101]:
            - heading "Cartes" [level=2] [ref=e102]
            - generic [ref=e103]:
              - generic [ref=e104]:
                - paragraph [ref=e105]: Recettes en ligne nettes
                - paragraph [ref=e106]: 245 000 F CFA
              - article [ref=e107]:
                - generic [ref=e109]:
                  - generic [ref=e110]:
                    - generic [aria-hidden] [ref=e111]:
                      - generic [ref=e112]: "20"
                      - generic [ref=e113]: déc.
                    - heading [level=3] [ref=e115]:
                      - link "Festival des lumières de Saint-Louis" [ref=e116] [cursor=pointer]:
                        - /url: /events/00000000-0000-4000-8000-000000000001
                  - generic [ref=e117]:
                    - generic [ref=e118]: Dernières places
                    - generic [ref=e120]: Concert
                  - list [ref=e122]:
                    - listitem [ref=e123]:
                      - generic [ref=e126]: samedi 20 décembre à 20 h 00
                    - listitem [ref=e127]:
                      - generic [ref=e131]: Saint-Louis · Place Faidherbe
                  - generic [ref=e133]:
                    - paragraph [ref=e134]: À partir de
                    - paragraph [ref=e135]: 10 000 F CFA
          - region [ref=e148]:
            - heading "Onglets, pastilles et filtres" [level=2] [ref=e149]
            - tablist "Sections de l’événement" [ref=e151]:
              - tab "Programme" [selected] [ref=e152] [cursor=pointer]
              - tab "Billets , 3" [ref=e154] [cursor=pointer]:
                - generic [ref=e155]: Billets
                - generic [ref=e156]:
                  - generic [ref=e157]: ","
                  - text: "3"
              - tab "Lieu" [ref=e158] [cursor=pointer]
            - tabpanel "Programme" [ref=e160]: Ouverture des portes à 19 h.
            - generic [ref=e161]:
              - generic [ref=e162]: Gratuit
              - generic [ref=e164]: Dernières places
              - generic [ref=e166]: Complet
              - generic [ref=e168]: Nouveau
              - generic [ref=e170]: Brouillon
            - generic [ref=e172]:
              - button "Concerts" [pressed] [ref=e173] [cursor=pointer]:
                - generic [aria-hidden] [ref=e174]: ✓
                - text: Concerts
              - button "Gratuit" [ref=e175] [cursor=pointer]
              - button "Cette semaine" [ref=e176] [cursor=pointer]
          - region [ref=e177]:
            - heading "Retours et fenêtres" [level=2] [ref=e178]
            - generic [ref=e179]:
              - button "Montrer les toasts" [ref=e180] [cursor=pointer]
              - button "Ouvrir la confirmation" [ref=e182] [cursor=pointer]
          - region [ref=e184]:
            - heading "Chargement et état vide" [level=2] [ref=e185]
            - generic [ref=e206]:
              - heading "Aucun événement cette semaine" [level=3] [ref=e212]
              - paragraph [ref=e213]: Élargissez la recherche à tout le mois ou à une autre ville.
              - button "Voir tout le mois" [ref=e214] [cursor=pointer]
          - region [ref=e216]:
            - heading "Repères de la carte" [level=2] [ref=e217]
            - generic [ref=e218]:
              - img "10 000 F" [ref=e219]
              - img "Gratuit" [ref=e223]
              - img "Événement choisi, 5 000 F" [ref=e227]:
                - generic [ref=e228]: 5 000 F
              - img "À la une" [ref=e231]
              - img "3 événements" [ref=e235]
          - region [ref=e238]:
            - heading "Feuille glissante" [level=2] [ref=e239]
            - region [ref=e240]:
              - generic [ref=e243]:
                - heading "12 événements autour de vous" [level=2] [ref=e244]
                - button "Tout afficher" [ref=e245] [cursor=pointer]
              - paragraph [ref=e247]: Liste des événements visibles sur la carte.
  - alert [ref=e251]
  - alertdialog [ref=e254]:
    - generic [ref=e255]:
      - heading "Rembourser ce billet ?" [level=2] [ref=e258]
      - button "Fermer" [ref=e259] [cursor=pointer]
    - paragraph [ref=e270]: L’acheteur reçoit 10 000 F CFA sur son compte Wave sous 48 heures.
    - generic [ref=e271]:
      - button "Garder le billet" [active] [ref=e272] [cursor=pointer]
      - button "Rembourser 10 000 F CFA" [ref=e274] [cursor=pointer]
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
      |                                                                   ^ Error: contrôles bloquants de design-confirmation__ordinateur__clair.png
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