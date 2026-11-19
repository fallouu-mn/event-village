# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · admin >> admin-fiche-en-attente — Administration — fiche complète avant validation
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de admin-fiche-en-attente__ordinateur__sombre.png

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
                  - generic "Soumis à l’équipe Event Village, qui vérifie la fiche avant validation." [ref=e113]: En attente de validation
                  - generic [ref=e116]: Festivals
                - heading "Festival des musiques du Saloum" [level=1] [ref=e117]
                - paragraph [ref=e118]: Sine-Saloum Culture & Loisirs · mar. 22 déc. 2026 à 17:00
              - generic [ref=e119]:
                - button "Refuser" [ref=e120] [cursor=pointer]
                - button "Valider" [ref=e122] [cursor=pointer]
                - link "Ouvrir le pilotage" [ref=e124] [cursor=pointer]:
                  - /url: /partner/events/54d6ca6a-3fbf-474d-a375-04344d73eaeb
                - link "Équipe de cet événement" [ref=e130] [cursor=pointer]:
                  - /url: /partner/events/54d6ca6a-3fbf-474d-a375-04344d73eaeb?tab=equipe
          - generic [ref=e138]:
            - generic [ref=e139]:
              - region [ref=e140]:
                - heading "Dates et lieu" [level=2] [ref=e141]
                - generic [ref=e142]:
                  - generic [ref=e143]:
                    - term [ref=e144]: Début
                    - definition [ref=e148]: mar. 22 déc. 2026 à 17:00
                  - generic [ref=e149]:
                    - term [ref=e150]: Fin
                    - definition [ref=e155]: mer. 23 déc. 2026 à 00:00
                  - generic [ref=e156]:
                    - term [ref=e157]: Lieu
                    - definition [ref=e162]: Parc de la Promenade, Kaolack
                  - generic [ref=e163]:
                    - term [ref=e164]: Jauge déclarée
                    - definition [ref=e171]: 1 000 personnes
                - generic [ref=e172]:
                  - 'region "Carte : Parc de la Promenade" [ref=e173]':
                    - generic:
                      - 'img "Emplacement : Parc de la Promenade" [ref=e174] [cursor=pointer]'
                      - generic [ref=e175]:
                        - strong [ref=e178]: Parc de la Promenade
                        - button "Fermer la bulle" [ref=e180] [cursor=pointer]: ×
                    - generic:
                      - generic [ref=e181]:
                        - button "Zoom avant" [ref=e182] [cursor=pointer]: +
                        - button "Zoom arrière" [ref=e183] [cursor=pointer]: −
                      - generic: © contributeurs OpenStreetMap
                  - link "Voir l’itinéraire" [ref=e185] [cursor=pointer]:
                    - /url: https://www.google.com/maps/dir/?api=1&destination=14.144,-16.066
                - generic [ref=e195]:
                  - generic [ref=e196]:
                    - term [ref=e197]: Adresse
                    - definition [ref=e198]: Parc de la Promenade, Kaolack
                  - generic [ref=e199]:
                    - term [ref=e200]: Stationnement
                    - definition [ref=e201]: Stationnement surveillé à proximité.
                  - generic [ref=e202]:
                    - term [ref=e203]: Règlement
                    - definition [ref=e204]: Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.
              - region [ref=e205]:
                - heading "Description" [level=2] [ref=e206]
                - paragraph [ref=e207]: Deux jours de concerts gratuits pour les moins de douze ans, scène jeunes talents et village associatif.
              - region [ref=e208]:
                - heading "Programme" [level=2] [ref=e209]
                - list [ref=e210]:
                  - listitem [ref=e211]:
                    - generic [ref=e212]: 17:00
                    - generic [ref=e214]:
                      - generic [ref=e215]: Scène jeunes talents
                      - generic [ref=e216]: Artiste
                  - listitem [ref=e218]:
                    - generic [ref=e219]: 20:00
                    - generic [ref=e220]:
                      - generic [ref=e221]:
                        - generic [ref=e222]: Tête d’affiche
                        - generic [ref=e223]: Artiste
                      - paragraph [ref=e225]: Orchestre du Sine
              - region [ref=e226]:
                - heading "Catégories et prix" [level=2] [ref=e227]
                - table [ref=e230]:
                  - caption [ref=e231]: Catégories de billets, tous canaux et inactives comprises
                  - rowgroup [ref=e232]:
                    - row [ref=e233]:
                      - columnheader "Catégorie" [ref=e234]
                      - columnheader "Prix" [ref=e235]
                      - columnheader "Quota" [ref=e236]
                      - columnheader "Période de vente" [ref=e237]
                      - columnheader "Par commande" [ref=e238]
                      - columnheader "Au contrôle" [ref=e239]
                      - columnheader "Canaux et état" [ref=e240]
                  - rowgroup [ref=e241]:
                    - row [ref=e242]:
                      - cell "Pass journée Une journée." [ref=e243]:
                        - generic [ref=e244]:
                          - generic [ref=e245]: Pass journée
                          - generic [ref=e246]: Une journée.
                      - cell "3 000 F CFA" [ref=e247]
                      - cell "800" [ref=e248]
                      - cell "Du sam. 7 nov. 2026 à 12:21 · jusqu’à l’événement" [ref=e249]
                      - cell "10 au plus" [ref=e251]
                      - cell "Blanc Aucune consigne" [ref=e252]:
                        - generic [ref=e253]:
                          - generic [ref=e254]: Blanc
                          - generic [ref=e257]: Aucune consigne
                      - cell "En ligne et au guichet Active" [ref=e258]:
                        - generic [ref=e259]:
                          - generic [ref=e260]: En ligne et au guichet
                          - generic [ref=e262]: Active
                    - row [ref=e264]:
                      - cell "Pass deux jours Les deux journées." [ref=e265]:
                        - generic [ref=e266]:
                          - generic [ref=e267]: Pass deux jours
                          - generic [ref=e268]: Les deux journées.
                      - cell "5 000 F CFA" [ref=e269]
                      - cell "200" [ref=e270]
                      - cell "Du sam. 7 nov. 2026 à 12:21 · jusqu’à l’événement" [ref=e271]
                      - cell "10 au plus" [ref=e273]
                      - cell "Noir Aucune consigne" [ref=e274]:
                        - generic [ref=e275]:
                          - generic [ref=e276]: Noir
                          - generic [ref=e279]: Aucune consigne
                      - cell "En ligne et au guichet Active" [ref=e280]:
                        - generic [ref=e281]:
                          - generic [ref=e282]: En ligne et au guichet
                          - generic [ref=e284]: Active
              - region [ref=e286]:
                - heading "Contrôle à l’entrée" [level=2] [ref=e287]
                - paragraph [ref=e288]: "Une seule entrée : chaque contrôleur laisse entrer toutes les catégories."
            - generic [ref=e289]:
              - region [ref=e290]:
                - heading "Affiche" [level=2] [ref=e291]
                - img "Affiche de « Festival des musiques du Saloum »" [ref=e292]
              - region [ref=e293]:
                - heading "Organisateur" [level=2] [ref=e294]
                - generic [ref=e295]:
                  - generic [ref=e296]:
                    - term [ref=e297]: Structure
                    - definition [ref=e303]:
                      - text: Sine-Saloum Culture & Loisirs
                      - generic [ref=e304]: Saloum Culture
                      - generic [ref=e305]: Compte validé
                  - generic [ref=e308]:
                    - term [ref=e309]: Responsable
                    - definition [ref=e316]: Ousmane Faye
                  - generic [ref=e317]:
                    - term [ref=e318]: Téléphone
                    - definition [ref=e322]:
                      - link "+221700000102" [ref=e323] [cursor=pointer]:
                        - /url: tel:+221700000102
                  - generic [ref=e324]:
                    - term [ref=e325]: Email
                    - definition [ref=e330]:
                      - link "ousmane.faye@demo.eventvillage.local" [ref=e331] [cursor=pointer]:
                        - /url: mailto:ousmane.faye@demo.eventvillage.local
                  - generic [ref=e332]:
                    - term [ref=e333]: Ville
                    - definition [ref=e338]: Kaolack
              - region [ref=e339]:
                - heading "Historique des statuts" [level=2] [ref=e340]
                - list [ref=e341]:
                  - listitem [ref=e342]:
                    - paragraph [ref=e344]: Brouillon → En attente de validation
                    - paragraph [ref=e345]: Ousmane Faye (Partenaire) · Changement de statut
                    - paragraph [ref=e346]:
                      - time [ref=e347]: jeu. 19 nov. 2026 à 12:22
                  - listitem [ref=e348]:
                    - paragraph [ref=e350]: "Création : Brouillon"
                    - paragraph [ref=e351]: Ousmane Faye (Partenaire) · Création
                    - paragraph [ref=e352]:
                      - time [ref=e353]: jeu. 19 nov. 2026 à 12:22
  - alert [ref=e354]
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
      |                                                                   ^ Error: contrôles bloquants de admin-fiche-en-attente__ordinateur__sombre.png
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