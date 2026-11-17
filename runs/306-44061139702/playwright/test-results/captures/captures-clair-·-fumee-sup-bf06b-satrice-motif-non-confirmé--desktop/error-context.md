# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · fumee-superadmin >> admin-especes-rendues — Administration — événement annulé : « Marquer rendu » à la place de l’organisatrice, motif (non confirmé)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de admin-especes-rendues__ordinateur__clair.png

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
    - complementary [ref=e3]:
      - link "Event Village, accueil" [ref=e5] [cursor=pointer]:
        - /url: /
        - generic [ref=e11]:
          - generic [ref=e12]: EVENT
          - generic [ref=e13]: VILLAGE
      - navigation "Navigation principale" [ref=e14]:
        - generic [ref=e15]:
          - paragraph [ref=e16]: Menu principal
          - generic [ref=e17]:
            - link "Accueil" [ref=e18] [cursor=pointer]:
              - /url: /
            - link "Explorer" [ref=e23] [cursor=pointer]:
              - /url: /explore
            - link "Mes billets" [ref=e28] [cursor=pointer]:
              - /url: /tickets
            - link "Portefeuille" [ref=e32] [cursor=pointer]:
              - /url: /wallet
        - generic [ref=e37]:
          - paragraph [ref=e38]: Espaces métier
          - generic [ref=e39]:
            - link "Administration" [ref=e40] [cursor=pointer]:
              - /url: /admin/dashboard
            - link "Événements à valider" [ref=e47] [cursor=pointer]:
              - /url: /admin/events
            - link "Comptes et administrateurs" [ref=e51] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=e58] [cursor=pointer]:
              - /url: /admin/services
            - link "Finance" [ref=e64] [cursor=pointer]:
              - /url: /admin/finance
            - link "Parrainage et ambassadeurs" [ref=e68] [cursor=pointer]:
              - /url: /admin/referral
            - link "Campagnes" [ref=e73] [cursor=pointer]:
              - /url: /admin/communications
            - link "Réglages de la plateforme" [ref=e78] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Journal d’audit" [ref=e83] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=e87] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner de contrôle" [ref=e94] [cursor=pointer]:
              - /url: /scan
            - link "Sécurité du compte" [ref=e102] [cursor=pointer]:
              - /url: /admin/securite
      - generic [ref=e108]:
        - link "Elhadji SuperAdmin Superadmin" [ref=e109] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e110]: ES
          - generic [ref=e111]:
            - generic [ref=e112]: Elhadji SuperAdmin
            - generic [ref=e113]: Superadmin
        - generic [ref=e114]:
          - button "Se déconnecter" [ref=e115] [cursor=pointer]
          - button "Basculer le thème" [ref=e120] [cursor=pointer]
    - generic [ref=e124]:
      - banner [ref=e125]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e127] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 58 non lues" [ref=e134] [cursor=pointer]:
          - generic [ref=e138]: "58"
      - main [ref=e139]:
        - generic [ref=e141]:
          - generic [ref=e142]:
            - link "Mes événements" [ref=e144] [cursor=pointer]:
              - /url: /partner/events
            - generic [ref=e150]:
              - 'generic "Annulé : les participants sont prévenus et les billets payés sont remboursés." [ref=e152]': Annulé
              - heading "Croisière musicale vers Gorée" [level=1] [ref=e155]
              - paragraph [ref=e156]:
                - generic [ref=e157]:
                  - generic [ref=e158]: mar. 17 nov. 2026 à 15:00
                  - generic [ref=e161]: Embarcadère du port de Dakar, Dakar
          - region [ref=e165]:
            - generic [ref=e166]:
              - generic [ref=e167]:
                - heading "Remboursements" [level=2] [ref=e168]
                - paragraph [ref=e169]: Avancement des remboursements des billets payés en ligne après l’annulation.
              - button "Actualiser l’avancement des remboursements" [ref=e170] [cursor=pointer]
            - generic [ref=e177]:
              - status [ref=e178]:
                - generic [ref=e183]:
                  - paragraph [ref=e184]: "Retardé : l’équipe Event Village s’en occupe"
                  - paragraph [ref=e186]: "2 remboursements (18 900 F CFA) : versement retardé, repris par l’équipe Event Village. Rien n’est à faire de votre côté."
              - generic [ref=e187]:
                - generic [ref=e188]:
                  - paragraph [ref=e190]: Versés
                  - paragraph [ref=e195]: 113 400 F CFA
                  - paragraph [ref=e196]: 5 remboursements
                - generic [ref=e197]:
                  - paragraph [ref=e199]: En cours
                  - paragraph [ref=e204]: 25 200 F CFA
                  - paragraph [ref=e205]: 2 remboursements
                - generic [ref=e206]:
                  - paragraph [ref=e208]: En vérification
                  - paragraph [ref=e214]: 18 900 F CFA
                  - paragraph [ref=e215]: "2 remboursements : issue à confirmer auprès de l’opérateur"
                - generic [ref=e216]:
                  - paragraph [ref=e218]: À reprendre
                  - paragraph [ref=e223]: 0 F CFA
                  - paragraph [ref=e224]: 0 remboursements échoués ou bloqués, à reprendre
              - generic [ref=e225]:
                - paragraph [ref=e227]: Espèces du guichet rendues par l’organisateur
                - paragraph [ref=e232]: 0 F CFA sur 18 000 F CFA
                - paragraph [ref=e233]: 0 vente sur 1 cochée « Remboursé » (jamais remboursées par Event Village)
          - region [ref=e234]:
            - generic [ref=e235]:
              - generic [ref=e236]:
                - heading "Espèces à rembourser par l’organisateur" [level=2] [ref=e237]
                - paragraph [ref=e238]: "Ventes au guichet de cet événement annulé. Event Village ne les rembourse jamais : rendez les espèces à chaque acheteur, puis cochez « Remboursé »."
              - button "Actualiser la liste des espèces à rembourser" [ref=e239] [cursor=pointer]
            - generic [ref=e246]:
              - generic [ref=e247]:
                - generic [ref=e248]:
                  - paragraph [ref=e250]: Ventes au guichet
                  - paragraph [ref=e255]: 18 000 F CFA
                  - paragraph [ref=e256]: 1 vente à rendre en espèces
                - generic [ref=e257]:
                  - paragraph [ref=e259]: Déjà remboursé
                  - paragraph [ref=e264]: 0 F CFA
                  - paragraph [ref=e265]: 0 vente cochée « Remboursé » sur 1
              - status [ref=e266]:
                - generic [ref=e271]:
                  - paragraph [ref=e272]: À la place de l’organisatrice
                  - generic [ref=e273]: "Si l’organisatrice ne peut pas le faire, marquez rendues les espèces d’une vente avec un motif : elle en est prévenue."
              - list "Ventes au guichet à rembourser en espèces" [ref=e274]:
                - listitem [ref=e275]:
                  - generic [ref=e276]:
                    - paragraph [ref=e277]:
                      - generic [ref=e278]: Vente 7B51FF88
                      - generic [ref=e279]: 18 000 F CFA
                    - paragraph [ref=e280]: 2 billets · *** ** 05
                    - paragraph [ref=e281]:
                      - text: Vendue le
                      - time [ref=e282]: mar. 17 nov. 2026 à 10:58
                      - text: par Lamine Cissé
                  - button "Marquer rendues les espèces de la vente 7B51FF88, 18 000 F CFA" [ref=e284] [cursor=pointer]:
                    - generic [ref=e285]: Marquer rendu
          - generic [ref=e286]:
            - tablist "Rubriques du pilotage" [ref=e289]:
              - tab "Aperçu" [selected] [ref=e290] [cursor=pointer]
              - tab "Infos" [ref=e292] [cursor=pointer]
              - tab "Ventes" [ref=e294] [cursor=pointer]
              - tab "Invitations" [ref=e296] [cursor=pointer]
              - tab "Entrées" [ref=e298] [cursor=pointer]
              - tab "Équipe" [ref=e300] [cursor=pointer]
              - tab "Caisse" [ref=e302] [cursor=pointer]
              - tab "Clôture" [ref=e304] [cursor=pointer]
            - tabpanel "Aperçu" [ref=e306]:
              - generic [ref=e307]:
                - region [ref=e308]:
                  - generic [ref=e310]:
                    - heading "Billetterie" [level=2] [ref=e311]
                    - paragraph [ref=e312]: Billets valides et utilisés, hors invitations.
                  - generic [ref=e313]:
                    - generic [ref=e314]:
                      - paragraph [ref=e316]: Billets vendus
                      - paragraph [ref=e320]: "2"
                      - paragraph [ref=e321]: Toutes catégories, y compris désactivées
                    - generic [ref=e322]:
                      - paragraph [ref=e324]: Vente
                      - paragraph [ref=e330]: Arrêtée
                      - paragraph [ref=e331]: "Événement annulé : aucune place n’est plus proposée"
                    - generic [ref=e332]:
                      - paragraph [ref=e334]: Invitations
                      - paragraph [ref=e340]: "0"
                      - paragraph [ref=e341]: Places offertes, comptées à part
                - region [ref=e342]:
                  - generic [ref=e344]:
                    - heading "Contrôle d’accès" [level=2] [ref=e345]
                    - paragraph [ref=e346]: Passages validés au scan et au guichet.
                  - generic [ref=e347]:
                    - generic [ref=e348]:
                      - paragraph [ref=e350]: Entrées
                      - paragraph [ref=e355]: "2"
                      - paragraph [ref=e356]: dont 2 au guichet
                    - generic [ref=e357]:
                      - paragraph [ref=e359]: Taux de présence
                      - paragraph [ref=e365]: 100 %
                      - paragraph [ref=e366]: Part des participants attendus (ventes et invitations) déjà passés
                - region [ref=e367]:
                  - generic [ref=e369]:
                    - heading "Recettes" [level=2] [ref=e370]
                    - paragraph [ref=e371]: Montants des billets, remboursements déduits pour les ventes en ligne.
                  - generic [ref=e372]:
                    - generic [ref=e373]:
                      - paragraph [ref=e375]: En ligne
                      - paragraph [ref=e379]:
                        - generic [ref=e380]: 0 F CFA
                      - paragraph [ref=e381]: Paiements mobiles confirmés
                    - generic [ref=e382]:
                      - paragraph [ref=e384]: En espèces
                      - paragraph [ref=e389]:
                        - generic [ref=e390]: 18 000 F CFA
                      - paragraph [ref=e391]: Encaissées par vos contrôleurs
                    - generic [ref=e392]:
                      - paragraph [ref=e394]: Remboursé
                      - paragraph [ref=e399]:
                        - generic [ref=e400]: 150 000 F CFA
                      - paragraph [ref=e401]: Remboursements en ligne
                - paragraph [ref=e402]:
                  - text: Chiffres calculés le
                  - time [ref=e403]: mar. 17 nov. 2026 à 11:17
                  - text: .
  - alert [ref=e404]
  - alertdialog [ref=e407]:
    - generic [ref=e408]:
      - heading "Marquer ces espèces rendues ?" [level=2] [ref=e411]
      - button "Fermer" [ref=e412] [cursor=pointer]
    - generic [ref=e418]:
      - paragraph [ref=e423]: "Vente 7B51FF88 : 18 000 F CFA. Faites-le seulement si l’argent a bien été rendu à l’acheteur. Ce marquage est définitif. L’organisatrice est prévenue (cloche, notification et email), avec votre motif ; l’acheteur ne reçoit aucun message."
      - generic [ref=e424]:
        - term [ref=e425]: Vente
        - definition [ref=e426]: 7B51FF88
        - term [ref=e427]: Billets
        - definition [ref=e428]: 2 billets
        - term [ref=e429]: Acheteur
        - definition [ref=e430]: "*** ** 05"
      - generic [ref=e431]:
        - generic [ref=e433]:
          - text: Motif (obligatoire)*
          - generic [ref=e434]: (obligatoire)
        - textbox "Motif (obligatoire) (obligatoire)" [active] [ref=e435]
        - paragraph [ref=e436]: 3 caractères au moins. L’organisatrice le lit dans son avis ; il reste dans le journal.
    - generic [ref=e437]:
      - button "Pas encore" [ref=e438] [cursor=pointer]
      - button "Marquer rendu" [disabled] [ref=e440]
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
      |                                                                   ^ Error: contrôles bloquants de admin-especes-rendues__ordinateur__clair.png
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