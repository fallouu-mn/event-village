# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · anonyme >> design-confirmation — Design 1a — confirmation : le bouton dit l’action et le montant
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de design-confirmation__mobile__clair.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "1 cible(s) < 44 px : div « Programme » 358×20",
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
          - button "Notifications" [ref=e15] [cursor=pointer]
          - button "Basculer le thème" [ref=e20] [cursor=pointer]
          - link "Se connecter" [ref=e24] [cursor=pointer]:
            - /url: /login
      - main [ref=e28]:
        - generic [ref=e30]:
          - heading "Composants" [level=1] [ref=e31]
          - region [ref=e32]:
            - heading "Boutons" [level=2] [ref=e33]
            - generic [ref=e34]:
              - button "Enregistrer" [ref=e35] [cursor=pointer]
              - button "Retour" [ref=e37] [cursor=pointer]
              - button "Voir le programme" [ref=e39] [cursor=pointer]
              - button "Plus tard" [ref=e41] [cursor=pointer]
              - button "Rembourser 10 000 F CFA" [ref=e43] [cursor=pointer]
            - button "Choisir mes billets" [ref=e45] [cursor=pointer]
          - region [ref=e47]:
            - heading "Champs" [level=2] [ref=e48]
            - generic [ref=e49]:
              - generic [ref=e50]: Nom complet
              - textbox "Nom complet" [ref=e52]: Awa Ndiaye
              - paragraph [ref=e53]: Tel qu’il figure sur votre pièce d’identité.
            - generic [ref=e54]:
              - generic [ref=e56]:
                - text: Numéro de téléphone*
                - generic [ref=e57]: (obligatoire)
              - textbox "Numéro de téléphone (obligatoire)" [invalid] [ref=e58]: 77 12
              - paragraph [ref=e59]:
                - generic [ref=e62]: Saisissez les 9 chiffres de votre numéro.
          - region [ref=e63]:
            - heading "Cartes" [level=2] [ref=e64]
            - generic [ref=e65]:
              - generic [ref=e66]:
                - paragraph [ref=e67]: Recettes en ligne nettes
                - paragraph [ref=e68]: 245 000 F CFA
              - article [ref=e69]:
                - generic [ref=e71]:
                  - generic [ref=e72]:
                    - generic [aria-hidden] [ref=e73]:
                      - generic [ref=e74]: "20"
                      - generic [ref=e75]: déc.
                    - heading [level=3] [ref=e77]:
                      - link "Festival des lumières de Saint-Louis" [ref=e78] [cursor=pointer]:
                        - /url: /events/00000000-0000-4000-8000-000000000001
                  - generic [ref=e79]:
                    - generic [ref=e80]: Dernières places
                    - generic [ref=e82]: Concert
                  - list [ref=e84]:
                    - listitem [ref=e85]:
                      - generic [ref=e88]: samedi 20 décembre à 20 h 00
                    - listitem [ref=e89]:
                      - generic [ref=e93]: Saint-Louis · Place Faidherbe
                  - generic [ref=e95]:
                    - paragraph [ref=e96]: À partir de
                    - paragraph [ref=e97]: 10 000 F CFA
          - region [ref=e110]:
            - heading "Onglets, pastilles et filtres" [level=2] [ref=e111]
            - tablist "Sections de l’événement" [ref=e113]:
              - tab "Programme" [selected] [ref=e114] [cursor=pointer]
              - tab "Billets , 3" [ref=e116] [cursor=pointer]:
                - generic [ref=e117]: Billets
                - generic [ref=e118]:
                  - generic [ref=e119]: ","
                  - text: "3"
              - tab "Lieu" [ref=e120] [cursor=pointer]
            - tabpanel "Programme" [ref=e122]: Ouverture des portes à 19 h.
            - generic [ref=e123]:
              - generic [ref=e124]: Gratuit
              - generic [ref=e126]: Dernières places
              - generic [ref=e128]: Complet
              - generic [ref=e130]: Nouveau
              - generic [ref=e132]: Brouillon
            - generic [ref=e134]:
              - button "Concerts" [pressed] [ref=e135] [cursor=pointer]:
                - generic [aria-hidden] [ref=e136]: ✓
                - text: Concerts
              - button "Gratuit" [ref=e137] [cursor=pointer]
              - button "Cette semaine" [ref=e138] [cursor=pointer]
          - region [ref=e139]:
            - heading "Retours et fenêtres" [level=2] [ref=e140]
            - generic [ref=e141]:
              - button "Montrer les toasts" [ref=e142] [cursor=pointer]
              - button "Ouvrir la confirmation" [ref=e144] [cursor=pointer]
          - region [ref=e146]:
            - heading "Chargement et état vide" [level=2] [ref=e147]
            - generic [ref=e168]:
              - heading "Aucun événement cette semaine" [level=3] [ref=e174]
              - paragraph [ref=e175]: Élargissez la recherche à tout le mois ou à une autre ville.
              - button "Voir tout le mois" [ref=e176] [cursor=pointer]
          - region [ref=e178]:
            - heading "Repères de la carte" [level=2] [ref=e179]
            - generic [ref=e180]:
              - img "10 000 F" [ref=e181]
              - img "Gratuit" [ref=e185]
              - img "Événement choisi, 5 000 F" [ref=e189]:
                - generic [ref=e190]: 5 000 F
              - img "À la une" [ref=e193]
              - img "3 événements" [ref=e197]
          - region [ref=e200]:
            - heading "Feuille glissante" [level=2] [ref=e201]
            - region [ref=e202]:
              - generic [ref=e205]:
                - heading "12 événements autour de vous" [level=2] [ref=e206]
                - button "Tout afficher" [ref=e207] [cursor=pointer]
              - paragraph [ref=e209]: Liste des événements visibles sur la carte.
    - navigation "Navigation rapide" [ref=e213]:
      - generic [ref=e214]:
        - link "Accueil" [ref=e215] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e220] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e225] [cursor=pointer]:
          - /url: /tickets
        - link "Portefeuille" [ref=e229] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e234]
  - alertdialog [ref=e237]:
    - generic [ref=e238]:
      - heading "Rembourser ce billet ?" [level=2] [ref=e241]
      - button "Fermer" [ref=e242] [cursor=pointer]
    - paragraph [ref=e253]: L’acheteur reçoit 10 000 F CFA sur son compte Wave sous 48 heures.
    - generic [ref=e254]:
      - button "Garder le billet" [active] [ref=e255] [cursor=pointer]
      - button "Rembourser 10 000 F CFA" [ref=e257] [cursor=pointer]
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
      |                                                                   ^ Error: contrôles bloquants de design-confirmation__mobile__clair.png
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