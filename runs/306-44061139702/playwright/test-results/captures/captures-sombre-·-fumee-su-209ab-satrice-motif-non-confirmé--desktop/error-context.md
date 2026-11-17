# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · fumee-superadmin >> admin-especes-rendues — Administration — événement annulé : « Marquer rendu » à la place de l’organisatrice, motif (non confirmé)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de admin-especes-rendues__ordinateur__sombre.png

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
          - button "Basculer le thème" [pressed] [ref=e120] [cursor=pointer]
    - generic [ref=e128]:
      - banner [ref=e129]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e131] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 58 non lues" [ref=e138] [cursor=pointer]:
          - generic [ref=e142]: "58"
      - main [ref=e143]:
        - generic [ref=e145]:
          - generic [ref=e146]:
            - link "Mes événements" [ref=e148] [cursor=pointer]:
              - /url: /partner/events
            - generic [ref=e154]:
              - 'generic "Annulé : les participants sont prévenus et les billets payés sont remboursés." [ref=e156]': Annulé
              - heading "Croisière musicale vers Gorée" [level=1] [ref=e159]
              - paragraph [ref=e160]:
                - generic [ref=e161]:
                  - generic [ref=e162]: mar. 17 nov. 2026 à 15:00
                  - generic [ref=e165]: Embarcadère du port de Dakar, Dakar
          - region [ref=e169]:
            - generic [ref=e170]:
              - generic [ref=e171]:
                - heading "Remboursements" [level=2] [ref=e172]
                - paragraph [ref=e173]: Avancement des remboursements des billets payés en ligne après l’annulation.
              - button "Actualiser l’avancement des remboursements" [ref=e174] [cursor=pointer]
            - generic [ref=e181]:
              - status [ref=e182]:
                - generic [ref=e187]:
                  - paragraph [ref=e188]: "Retardé : l’équipe Event Village s’en occupe"
                  - paragraph [ref=e190]: "2 remboursements (18 900 F CFA) : versement retardé, repris par l’équipe Event Village. Rien n’est à faire de votre côté."
              - generic [ref=e191]:
                - generic [ref=e192]:
                  - paragraph [ref=e194]: Versés
                  - paragraph [ref=e199]: 113 400 F CFA
                  - paragraph [ref=e200]: 5 remboursements
                - generic [ref=e201]:
                  - paragraph [ref=e203]: En cours
                  - paragraph [ref=e208]: 25 200 F CFA
                  - paragraph [ref=e209]: 2 remboursements
                - generic [ref=e210]:
                  - paragraph [ref=e212]: En vérification
                  - paragraph [ref=e218]: 18 900 F CFA
                  - paragraph [ref=e219]: "2 remboursements : issue à confirmer auprès de l’opérateur"
                - generic [ref=e220]:
                  - paragraph [ref=e222]: À reprendre
                  - paragraph [ref=e227]: 0 F CFA
                  - paragraph [ref=e228]: 0 remboursements échoués ou bloqués, à reprendre
              - generic [ref=e229]:
                - paragraph [ref=e231]: Espèces du guichet rendues par l’organisateur
                - paragraph [ref=e236]: 0 F CFA sur 18 000 F CFA
                - paragraph [ref=e237]: 0 vente sur 1 cochée « Remboursé » (jamais remboursées par Event Village)
          - region [ref=e238]:
            - generic [ref=e239]:
              - generic [ref=e240]:
                - heading "Espèces à rembourser par l’organisateur" [level=2] [ref=e241]
                - paragraph [ref=e242]: "Ventes au guichet de cet événement annulé. Event Village ne les rembourse jamais : rendez les espèces à chaque acheteur, puis cochez « Remboursé »."
              - button "Actualiser la liste des espèces à rembourser" [ref=e243] [cursor=pointer]
            - generic [ref=e250]:
              - generic [ref=e251]:
                - generic [ref=e252]:
                  - paragraph [ref=e254]: Ventes au guichet
                  - paragraph [ref=e259]: 18 000 F CFA
                  - paragraph [ref=e260]: 1 vente à rendre en espèces
                - generic [ref=e261]:
                  - paragraph [ref=e263]: Déjà remboursé
                  - paragraph [ref=e268]: 0 F CFA
                  - paragraph [ref=e269]: 0 vente cochée « Remboursé » sur 1
              - status [ref=e270]:
                - generic [ref=e275]:
                  - paragraph [ref=e276]: À la place de l’organisatrice
                  - generic [ref=e277]: "Si l’organisatrice ne peut pas le faire, marquez rendues les espèces d’une vente avec un motif : elle en est prévenue."
              - list "Ventes au guichet à rembourser en espèces" [ref=e278]:
                - listitem [ref=e279]:
                  - generic [ref=e280]:
                    - paragraph [ref=e281]:
                      - generic [ref=e282]: Vente 7B51FF88
                      - generic [ref=e283]: 18 000 F CFA
                    - paragraph [ref=e284]: 2 billets · *** ** 05
                    - paragraph [ref=e285]:
                      - text: Vendue le
                      - time [ref=e286]: mar. 17 nov. 2026 à 10:58
                      - text: par Lamine Cissé
                  - button "Marquer rendues les espèces de la vente 7B51FF88, 18 000 F CFA" [ref=e288] [cursor=pointer]:
                    - generic [ref=e289]: Marquer rendu
          - generic [ref=e290]:
            - tablist "Rubriques du pilotage" [ref=e293]:
              - tab "Aperçu" [selected] [ref=e294] [cursor=pointer]
              - tab "Infos" [ref=e296] [cursor=pointer]
              - tab "Ventes" [ref=e298] [cursor=pointer]
              - tab "Invitations" [ref=e300] [cursor=pointer]
              - tab "Entrées" [ref=e302] [cursor=pointer]
              - tab "Équipe" [ref=e304] [cursor=pointer]
              - tab "Caisse" [ref=e306] [cursor=pointer]
              - tab "Clôture" [ref=e308] [cursor=pointer]
            - tabpanel "Aperçu" [ref=e310]:
              - generic [ref=e311]:
                - region [ref=e312]:
                  - generic [ref=e314]:
                    - heading "Billetterie" [level=2] [ref=e315]
                    - paragraph [ref=e316]: Billets valides et utilisés, hors invitations.
                  - generic [ref=e317]:
                    - generic [ref=e318]:
                      - paragraph [ref=e320]: Billets vendus
                      - paragraph [ref=e324]: "2"
                      - paragraph [ref=e325]: Toutes catégories, y compris désactivées
                    - generic [ref=e326]:
                      - paragraph [ref=e328]: Vente
                      - paragraph [ref=e334]: Arrêtée
                      - paragraph [ref=e335]: "Événement annulé : aucune place n’est plus proposée"
                    - generic [ref=e336]:
                      - paragraph [ref=e338]: Invitations
                      - paragraph [ref=e344]: "0"
                      - paragraph [ref=e345]: Places offertes, comptées à part
                - region [ref=e346]:
                  - generic [ref=e348]:
                    - heading "Contrôle d’accès" [level=2] [ref=e349]
                    - paragraph [ref=e350]: Passages validés au scan et au guichet.
                  - generic [ref=e351]:
                    - generic [ref=e352]:
                      - paragraph [ref=e354]: Entrées
                      - paragraph [ref=e359]: "2"
                      - paragraph [ref=e360]: dont 2 au guichet
                    - generic [ref=e361]:
                      - paragraph [ref=e363]: Taux de présence
                      - paragraph [ref=e369]: 100 %
                      - paragraph [ref=e370]: Part des participants attendus (ventes et invitations) déjà passés
                - region [ref=e371]:
                  - generic [ref=e373]:
                    - heading "Recettes" [level=2] [ref=e374]
                    - paragraph [ref=e375]: Montants des billets, remboursements déduits pour les ventes en ligne.
                  - generic [ref=e376]:
                    - generic [ref=e377]:
                      - paragraph [ref=e379]: En ligne
                      - paragraph [ref=e383]:
                        - generic [ref=e384]: 0 F CFA
                      - paragraph [ref=e385]: Paiements mobiles confirmés
                    - generic [ref=e386]:
                      - paragraph [ref=e388]: En espèces
                      - paragraph [ref=e393]:
                        - generic [ref=e394]: 18 000 F CFA
                      - paragraph [ref=e395]: Encaissées par vos contrôleurs
                    - generic [ref=e396]:
                      - paragraph [ref=e398]: Remboursé
                      - paragraph [ref=e403]:
                        - generic [ref=e404]: 150 000 F CFA
                      - paragraph [ref=e405]: Remboursements en ligne
                - paragraph [ref=e406]:
                  - text: Chiffres calculés le
                  - time [ref=e407]: mar. 17 nov. 2026 à 11:23
                  - text: .
  - alert [ref=e408]
  - alertdialog [ref=e411]:
    - generic [ref=e412]:
      - heading "Marquer ces espèces rendues ?" [level=2] [ref=e415]
      - button "Fermer" [ref=e416] [cursor=pointer]
    - generic [ref=e422]:
      - paragraph [ref=e427]: "Vente 7B51FF88 : 18 000 F CFA. Faites-le seulement si l’argent a bien été rendu à l’acheteur. Ce marquage est définitif. L’organisatrice est prévenue (cloche, notification et email), avec votre motif ; l’acheteur ne reçoit aucun message."
      - generic [ref=e428]:
        - term [ref=e429]: Vente
        - definition [ref=e430]: 7B51FF88
        - term [ref=e431]: Billets
        - definition [ref=e432]: 2 billets
        - term [ref=e433]: Acheteur
        - definition [ref=e434]: "*** ** 05"
      - generic [ref=e435]:
        - generic [ref=e437]:
          - text: Motif (obligatoire)*
          - generic [ref=e438]: (obligatoire)
        - textbox "Motif (obligatoire) (obligatoire)" [active] [ref=e439]
        - paragraph [ref=e440]: 3 caractères au moins. L’organisatrice le lit dans son avis ; il reste dans le journal.
    - generic [ref=e441]:
      - button "Pas encore" [ref=e442] [cursor=pointer]
      - button "Marquer rendu" [disabled] [ref=e444]
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
      |                                                                   ^ Error: contrôles bloquants de admin-especes-rendues__ordinateur__sombre.png
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