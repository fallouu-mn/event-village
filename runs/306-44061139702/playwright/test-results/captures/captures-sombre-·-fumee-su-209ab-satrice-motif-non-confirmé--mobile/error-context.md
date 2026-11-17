# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · fumee-superadmin >> admin-especes-rendues — Administration — événement annulé : « Marquer rendu » à la place de l’organisatrice, motif (non confirmé)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de admin-especes-rendues__mobile__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "axe-core label-content-name-mismatch (serious, 1 nœud(s)) : Elements must have their visible text as part of their accessible name",
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
          - button "Notifications, 58 non lues" [ref=e18] [cursor=pointer]:
            - generic [ref=e22]: "58"
          - button "Basculer le thème" [pressed] [ref=e24] [cursor=pointer]
          - link "Mon profil (Elhadji SuperAdmin)" [ref=e32] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e33]: ES
      - main [ref=e35]:
        - generic [ref=e37]:
          - generic [ref=e38]:
            - link "Mes événements" [ref=e40] [cursor=pointer]:
              - /url: /partner/events
            - generic [ref=e46]:
              - 'generic "Annulé : les participants sont prévenus et les billets payés sont remboursés." [ref=e48]': Annulé
              - heading "Croisière musicale vers Gorée" [level=1] [ref=e51]
              - paragraph [ref=e52]:
                - generic [ref=e53]:
                  - generic [ref=e54]: mar. 17 nov. 2026 à 15:00
                  - generic [ref=e57]: Embarcadère du port de Dakar, Dakar
          - region [ref=e61]:
            - generic [ref=e62]:
              - generic [ref=e63]:
                - heading "Remboursements" [level=2] [ref=e64]
                - paragraph [ref=e65]: Avancement des remboursements des billets payés en ligne après l’annulation.
              - button "Actualiser l’avancement des remboursements" [ref=e66] [cursor=pointer]
            - generic [ref=e73]:
              - status [ref=e74]:
                - generic [ref=e79]:
                  - paragraph [ref=e80]: "Retardé : l’équipe Event Village s’en occupe"
                  - paragraph [ref=e82]: "2 remboursements (18 900 F CFA) : versement retardé, repris par l’équipe Event Village. Rien n’est à faire de votre côté."
              - generic [ref=e83]:
                - generic [ref=e84]:
                  - paragraph [ref=e86]: Versés
                  - paragraph [ref=e91]: 113 400 F CFA
                  - paragraph [ref=e92]: 5 remboursements
                - generic [ref=e93]:
                  - paragraph [ref=e95]: En cours
                  - paragraph [ref=e100]: 25 200 F CFA
                  - paragraph [ref=e101]: 2 remboursements
                - generic [ref=e102]:
                  - paragraph [ref=e104]: En vérification
                  - paragraph [ref=e110]: 18 900 F CFA
                  - paragraph [ref=e111]: "2 remboursements : issue à confirmer auprès de l’opérateur"
                - generic [ref=e112]:
                  - paragraph [ref=e114]: À reprendre
                  - paragraph [ref=e119]: 0 F CFA
                  - paragraph [ref=e120]: 0 remboursements échoués ou bloqués, à reprendre
              - generic [ref=e121]:
                - paragraph [ref=e123]: Espèces du guichet rendues par l’organisateur
                - paragraph [ref=e128]: 0 F CFA sur 18 000 F CFA
                - paragraph [ref=e129]: 0 vente sur 1 cochée « Remboursé » (jamais remboursées par Event Village)
          - region [ref=e130]:
            - generic [ref=e131]:
              - generic [ref=e132]:
                - heading "Espèces à rembourser par l’organisateur" [level=2] [ref=e133]
                - paragraph [ref=e134]: "Ventes au guichet de cet événement annulé. Event Village ne les rembourse jamais : rendez les espèces à chaque acheteur, puis cochez « Remboursé »."
              - button "Actualiser la liste des espèces à rembourser" [ref=e135] [cursor=pointer]
            - generic [ref=e142]:
              - generic [ref=e143]:
                - generic [ref=e144]:
                  - paragraph [ref=e146]: Ventes au guichet
                  - paragraph [ref=e151]: 18 000 F CFA
                  - paragraph [ref=e152]: 1 vente à rendre en espèces
                - generic [ref=e153]:
                  - paragraph [ref=e155]: Déjà remboursé
                  - paragraph [ref=e160]: 0 F CFA
                  - paragraph [ref=e161]: 0 vente cochée « Remboursé » sur 1
              - status [ref=e162]:
                - generic [ref=e167]:
                  - paragraph [ref=e168]: À la place de l’organisatrice
                  - generic [ref=e169]: "Si l’organisatrice ne peut pas le faire, marquez rendues les espèces d’une vente avec un motif : elle en est prévenue."
              - list "Ventes au guichet à rembourser en espèces" [ref=e170]:
                - listitem [ref=e171]:
                  - generic [ref=e172]:
                    - paragraph [ref=e173]:
                      - generic [ref=e174]: Vente 7B51FF88
                      - generic [ref=e175]: 18 000 F CFA
                    - paragraph [ref=e176]: 2 billets · *** ** 05
                    - paragraph [ref=e177]:
                      - text: Vendue le
                      - time [ref=e178]: mar. 17 nov. 2026 à 10:58
                      - text: par Lamine Cissé
                  - button "Marquer rendues les espèces de la vente 7B51FF88, 18 000 F CFA" [ref=e180] [cursor=pointer]:
                    - generic [ref=e181]: Marquer rendu
          - generic [ref=e182]:
            - tablist "Rubriques du pilotage" [ref=e185]:
              - tab "Aperçu" [selected] [ref=e186] [cursor=pointer]
              - tab "Infos" [ref=e188] [cursor=pointer]
              - tab "Ventes" [ref=e190] [cursor=pointer]
              - tab "Invitations" [ref=e192] [cursor=pointer]
              - tab "Entrées" [ref=e194] [cursor=pointer]
              - tab "Équipe" [ref=e196] [cursor=pointer]
              - tab "Caisse" [ref=e198] [cursor=pointer]
              - tab "Clôture" [ref=e200] [cursor=pointer]
            - tabpanel "Aperçu" [ref=e202]:
              - generic [ref=e203]:
                - region [ref=e204]:
                  - generic [ref=e206]:
                    - heading "Billetterie" [level=2] [ref=e207]
                    - paragraph [ref=e208]: Billets valides et utilisés, hors invitations.
                  - generic [ref=e209]:
                    - generic [ref=e210]:
                      - paragraph [ref=e212]: Billets vendus
                      - paragraph [ref=e216]: "2"
                      - paragraph [ref=e217]: Toutes catégories, y compris désactivées
                    - generic [ref=e218]:
                      - paragraph [ref=e220]: Vente
                      - paragraph [ref=e226]: Arrêtée
                      - paragraph [ref=e227]: "Événement annulé : aucune place n’est plus proposée"
                    - generic [ref=e228]:
                      - paragraph [ref=e230]: Invitations
                      - paragraph [ref=e236]: "0"
                      - paragraph [ref=e237]: Places offertes, comptées à part
                - region [ref=e238]:
                  - generic [ref=e240]:
                    - heading "Contrôle d’accès" [level=2] [ref=e241]
                    - paragraph [ref=e242]: Passages validés au scan et au guichet.
                  - generic [ref=e243]:
                    - generic [ref=e244]:
                      - paragraph [ref=e246]: Entrées
                      - paragraph [ref=e251]: "2"
                      - paragraph [ref=e252]: dont 2 au guichet
                    - generic [ref=e253]:
                      - paragraph [ref=e255]: Taux de présence
                      - paragraph [ref=e261]: 100 %
                      - paragraph [ref=e262]: Part des participants attendus (ventes et invitations) déjà passés
                - region [ref=e263]:
                  - generic [ref=e265]:
                    - heading "Recettes" [level=2] [ref=e266]
                    - paragraph [ref=e267]: Montants des billets, remboursements déduits pour les ventes en ligne.
                  - generic [ref=e268]:
                    - generic [ref=e269]:
                      - paragraph [ref=e271]: En ligne
                      - paragraph [ref=e275]:
                        - generic [ref=e276]: 0 F CFA
                      - paragraph [ref=e277]: Paiements mobiles confirmés
                    - generic [ref=e278]:
                      - paragraph [ref=e280]: En espèces
                      - paragraph [ref=e285]:
                        - generic [ref=e286]: 18 000 F CFA
                      - paragraph [ref=e287]: Encaissées par vos contrôleurs
                    - generic [ref=e288]:
                      - paragraph [ref=e290]: Remboursé
                      - paragraph [ref=e295]:
                        - generic [ref=e296]: 150 000 F CFA
                      - paragraph [ref=e297]: Remboursements en ligne
                - paragraph [ref=e298]:
                  - text: Chiffres calculés le
                  - time [ref=e299]: mar. 17 nov. 2026 à 11:10
                  - text: .
    - navigation "Navigation rapide" [ref=e300]:
      - generic [ref=e301]:
        - link "Accueil" [ref=e302] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e307] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e312] [cursor=pointer]:
          - /url: /tickets
        - link "Portefeuille" [ref=e316] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e321]
  - alertdialog [ref=e324]:
    - generic [ref=e325]:
      - heading "Marquer ces espèces rendues ?" [level=2] [ref=e328]
      - button "Fermer" [ref=e329] [cursor=pointer]
    - generic [ref=e335]:
      - paragraph [ref=e340]: "Vente 7B51FF88 : 18 000 F CFA. Faites-le seulement si l’argent a bien été rendu à l’acheteur. Ce marquage est définitif. L’organisatrice est prévenue (cloche, notification et email), avec votre motif ; l’acheteur ne reçoit aucun message."
      - generic [ref=e341]:
        - term [ref=e342]: Vente
        - definition [ref=e343]: 7B51FF88
        - term [ref=e344]: Billets
        - definition [ref=e345]: 2 billets
        - term [ref=e346]: Acheteur
        - definition [ref=e347]: "*** ** 05"
      - generic [ref=e348]:
        - generic [ref=e350]:
          - text: Motif (obligatoire)*
          - generic [ref=e351]: (obligatoire)
        - textbox "Motif (obligatoire) (obligatoire)" [active] [ref=e352]
        - paragraph [ref=e353]: 3 caractères au moins. L’organisatrice le lit dans son avis ; il reste dans le journal.
    - generic [ref=e354]:
      - button "Pas encore" [ref=e355] [cursor=pointer]
      - button "Marquer rendu" [disabled] [ref=e357]
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
      |                                                                   ^ Error: contrôles bloquants de admin-especes-rendues__mobile__sombre.png
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