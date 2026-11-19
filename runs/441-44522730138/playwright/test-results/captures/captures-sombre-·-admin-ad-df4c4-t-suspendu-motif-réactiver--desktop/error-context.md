# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · admin >> admin-fiche-suspendu — Administration — fiche d’un événement suspendu (motif, réactiver)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de admin-fiche-suspendu__ordinateur__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "axe-core scrollable-region-focusable (serious, 1 nœud(s)) : Scrollable region must have keyboard access",
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
        - generic [ref=e10]: Administration
        - link "Tableau de bord" [ref=e15] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=e22]:
          - paragraph [ref=e23]: Gestion
          - generic [ref=e24]:
            - link "Événements" [ref=e25] [cursor=pointer]:
              - /url: /admin/events
            - link "Catalogues et services" [ref=e29] [cursor=pointer]:
              - /url: /admin/services
        - generic [ref=e35]:
          - paragraph [ref=e36]: Engagement
          - link "Campagnes" [ref=e38] [cursor=pointer]:
            - /url: /admin/communications
        - generic [ref=e43]:
          - paragraph [ref=e44]: Système
          - generic [ref=e45]:
            - link "Réglages" [ref=e46] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Notifications" [ref=e51] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Mes droits" [ref=e58] [cursor=pointer]:
              - /url: /admin/mes-droits
        - link "Retour au site" [ref=e64] [cursor=pointer]:
          - /url: /
      - generic [ref=e69]:
        - link "Aïda Diallo Administrateur" [ref=e70] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e71]: AD
          - generic [ref=e72]:
            - generic [ref=e73]: Aïda Diallo
            - generic [ref=e74]: Administrateur
        - generic [ref=e75]:
          - button "Se déconnecter" [ref=e76] [cursor=pointer]
          - button "Basculer le thème" [ref=e81] [cursor=pointer]
    - generic [ref=e85]:
      - banner [ref=e86]:
        - link "Rechercher un événement…" [ref=e88] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 40 non lues" [ref=e95] [cursor=pointer]:
          - generic [ref=e99]: "40"
      - main [ref=e100]:
        - generic [ref=e102]:
          - generic [ref=e103]:
            - link "Retour aux événements" [ref=e105] [cursor=pointer]:
              - /url: /admin/events
            - generic [ref=e110]:
              - generic [ref=e111]:
                - generic [ref=e112]:
                  - 'generic "Mis en pause par l’équipe Event Village : la vente et le contrôle d’accès sont arrêtés." [ref=e113]': Suspendu
                  - generic [ref=e116]: Festivals
                - heading "Rencontres du conte et de la parole" [level=1] [ref=e117]
                - paragraph [ref=e118]: Sine-Saloum Culture & Loisirs · sam. 28 nov. 2026 à 16:00
              - generic [ref=e119]:
                - button "Réactiver" [ref=e120] [cursor=pointer]
                - button "Annuler l’événement" [ref=e122] [cursor=pointer]
                - link "Ouvrir le pilotage" [ref=e124] [cursor=pointer]:
                  - /url: /partner/events/a982f434-71d9-40a6-bed4-2a69fad589c8
                - link "Équipe de cet événement" [ref=e130] [cursor=pointer]:
                  - /url: /partner/events/a982f434-71d9-40a6-bed4-2a69fad589c8?tab=equipe
                - link "Page publique" [ref=e138] [cursor=pointer]:
                  - /url: /events/a982f434-71d9-40a6-bed4-2a69fad589c8
          - status [ref=e145]:
            - generic [ref=e150]:
              - paragraph [ref=e151]: Motif de la suspension
              - generic [ref=e152]:
                - paragraph [ref=e153]: "Autorisation de la mairie en cours de renouvellement : reprise des ventes dès réception de l’arrêté."
                - paragraph [ref=e154]:
                  - text: Communiqué à l’organisateur le
                  - time [ref=e155]: jeu. 19 nov. 2026 à 12:22
                  - text: .
          - generic [ref=e156]:
            - generic [ref=e157]:
              - region [ref=e158]:
                - heading "Dates et lieu" [level=2] [ref=e159]
                - generic [ref=e160]:
                  - generic [ref=e161]:
                    - term [ref=e162]: Début
                    - definition [ref=e166]: sam. 28 nov. 2026 à 16:00
                  - generic [ref=e167]:
                    - term [ref=e168]: Fin
                    - definition [ref=e173]: sam. 28 nov. 2026 à 21:00
                  - generic [ref=e174]:
                    - term [ref=e175]: Lieu
                    - definition [ref=e180]: Cour de l’ancienne gare, Kaolack
                  - generic [ref=e181]:
                    - term [ref=e182]: Jauge déclarée
                    - definition [ref=e189]: 250 personnes
                - generic [ref=e190]:
                  - 'region "Carte : Cour de l’ancienne gare" [ref=e191]':
                    - generic:
                      - 'img "Emplacement : Cour de l’ancienne gare" [ref=e192] [cursor=pointer]'
                      - generic [ref=e193]:
                        - strong [ref=e196]: Cour de l’ancienne gare
                        - button "Fermer la bulle" [ref=e198] [cursor=pointer]: ×
                    - generic:
                      - generic [ref=e199]:
                        - button "Zoom avant" [ref=e200] [cursor=pointer]: +
                        - button "Zoom arrière" [ref=e201] [cursor=pointer]: −
                      - generic: © contributeurs OpenStreetMap
                  - link "Voir l’itinéraire" [ref=e203] [cursor=pointer]:
                    - /url: https://www.google.com/maps/dir/?api=1&destination=14.1468,-16.0726
                - generic [ref=e213]:
                  - generic [ref=e214]:
                    - term [ref=e215]: Adresse
                    - definition [ref=e216]: Cour de l’ancienne gare, Kaolack
                  - generic [ref=e217]:
                    - term [ref=e218]: Stationnement
                    - definition [ref=e219]: Stationnement surveillé à proximité.
                  - generic [ref=e220]:
                    - term [ref=e221]: Règlement
                    - definition [ref=e222]: Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.
              - region [ref=e223]:
                - heading "Description" [level=2] [ref=e224]
                - paragraph [ref=e225]: Conteurs et griots de toute la région pour un après-midi de récits et de chants.
              - region [ref=e226]:
                - heading "Programme" [level=2] [ref=e227]
                - list [ref=e228]:
                  - listitem [ref=e229]:
                    - generic [ref=e230]: 16:00
                    - generic [ref=e231]:
                      - generic [ref=e232]:
                        - generic [ref=e233]: Contes pour les enfants
                        - generic [ref=e234]: Intervenant
                      - paragraph [ref=e236]: Conteuse invitée
                  - listitem [ref=e237]:
                    - generic [ref=e238]: 19:00
                    - generic [ref=e240]:
                      - generic [ref=e241]: Veillée de la parole
                      - generic [ref=e242]: Artiste
              - region [ref=e244]:
                - heading "Catégories et prix" [level=2] [ref=e245]
                - table [ref=e248]:
                  - caption [ref=e249]: Catégories de billets, tous canaux et inactives comprises
                  - rowgroup [ref=e250]:
                    - row [ref=e251]:
                      - columnheader "Catégorie" [ref=e252]
                      - columnheader "Prix" [ref=e253]
                      - columnheader "Quota" [ref=e254]
                      - columnheader "Période de vente" [ref=e255]
                      - columnheader "Par commande" [ref=e256]
                      - columnheader "Au contrôle" [ref=e257]
                      - columnheader "Canaux et état" [ref=e258]
                  - rowgroup [ref=e259]:
                    - row [ref=e260]:
                      - cell "Entrée Accès à toutes les séances." [ref=e261]:
                        - generic [ref=e262]:
                          - generic [ref=e263]: Entrée
                          - generic [ref=e264]: Accès à toutes les séances.
                      - cell "3 000 F CFA" [ref=e265]
                      - cell "200" [ref=e266]
                      - cell "Du sam. 7 nov. 2026 à 12:21 · jusqu’à l’événement" [ref=e267]
                      - cell "10 au plus" [ref=e269]
                      - cell "Blanc Aucune consigne" [ref=e270]:
                        - generic [ref=e271]:
                          - generic [ref=e272]: Blanc
                          - generic [ref=e275]: Aucune consigne
                      - cell "En ligne et au guichet Active" [ref=e276]:
                        - generic [ref=e277]:
                          - generic [ref=e278]: En ligne et au guichet
                          - generic [ref=e280]: Active
              - region [ref=e282]:
                - heading "Contrôle à l’entrée" [level=2] [ref=e283]
                - paragraph [ref=e284]: "Une seule entrée : chaque contrôleur laisse entrer toutes les catégories."
            - generic [ref=e285]:
              - region [ref=e286]:
                - heading "Affiche" [level=2] [ref=e287]
                - img "Affiche de « Rencontres du conte et de la parole »" [ref=e288]
              - region [ref=e289]:
                - heading "Organisateur" [level=2] [ref=e290]
                - generic [ref=e291]:
                  - generic [ref=e292]:
                    - term [ref=e293]: Structure
                    - definition [ref=e299]:
                      - text: Sine-Saloum Culture & Loisirs
                      - generic [ref=e300]: Saloum Culture
                      - generic [ref=e301]: Compte validé
                  - generic [ref=e304]:
                    - term [ref=e305]: Responsable
                    - definition [ref=e312]: Ousmane Faye
                  - generic [ref=e313]:
                    - term [ref=e314]: Téléphone
                    - definition [ref=e318]:
                      - link "+221700000102" [ref=e319] [cursor=pointer]:
                        - /url: tel:+221700000102
                  - generic [ref=e320]:
                    - term [ref=e321]: Email
                    - definition [ref=e326]:
                      - link "ousmane.faye@demo.eventvillage.local" [ref=e327] [cursor=pointer]:
                        - /url: mailto:ousmane.faye@demo.eventvillage.local
                  - generic [ref=e328]:
                    - term [ref=e329]: Ville
                    - definition [ref=e334]: Kaolack
              - region [ref=e335]:
                - heading "Historique des statuts" [level=2] [ref=e336]
                - list [ref=e337]:
                  - listitem [ref=e338]:
                    - paragraph [ref=e340]: Publié → Suspendu
                    - paragraph [ref=e341]: Aïda Diallo (Administration) · Changement de statut
                    - paragraph [ref=e342]:
                      - time [ref=e343]: jeu. 19 nov. 2026 à 12:22
                    - blockquote [ref=e344]:
                      - generic [ref=e345]: "Motif :"
                      - text: "Autorisation de la mairie en cours de renouvellement : reprise des ventes dès réception de l’arrêté."
                  - listitem [ref=e346]:
                    - paragraph [ref=e348]: Validé → Publié
                    - paragraph [ref=e349]: Ousmane Faye (Partenaire) · Changement de statut
                    - paragraph [ref=e350]:
                      - time [ref=e351]: jeu. 19 nov. 2026 à 12:22
                  - listitem [ref=e352]:
                    - paragraph [ref=e354]: En attente de validation → Validé
                    - paragraph [ref=e355]: Aïda Diallo (Administration) · Changement de statut
                    - paragraph [ref=e356]:
                      - time [ref=e357]: jeu. 19 nov. 2026 à 12:22
                  - listitem [ref=e358]:
                    - paragraph [ref=e360]: Brouillon → En attente de validation
                    - paragraph [ref=e361]: Ousmane Faye (Partenaire) · Changement de statut
                    - paragraph [ref=e362]:
                      - time [ref=e363]: jeu. 19 nov. 2026 à 12:22
                  - listitem [ref=e364]:
                    - paragraph [ref=e366]: "Création : Brouillon"
                    - paragraph [ref=e367]: Ousmane Faye (Partenaire) · Création
                    - paragraph [ref=e368]:
                      - time [ref=e369]: jeu. 19 nov. 2026 à 12:22
  - alert [ref=e370]
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
      |                                                                   ^ Error: contrôles bloquants de admin-fiche-suspendu__ordinateur__sombre.png
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