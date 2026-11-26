# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · fumee-superadmin >> admin-cloture-motif — Administration — clôture d’un événement suspendu : champ « Motif de la clôture » (fiche imposée, rien n’est envoyé)
- Location: e2e/captures.spec.ts:202:9

# Error details

```
Error: contrôles bloquants de admin-cloture-motif__ordinateur__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 8

- Array []
+ Array [
+   "erreur de console : Failed to load resource: the server responded with a status of 404 (Not Found) (http://localhost:3000/api/admin/events/00000000-0000-4000-8000-000000000931/tables)",
+   "erreur de console : [useServerData] /api/admin/events/00000000-0000-4000-8000-000000000931/tables ApiError: Événement introuvable.
+     at s (http://localhost:3000/_next/static/chunks/5574-9bde3adbdd56d647.js:1:22672)
+     at async i (http://localhost:3000/_next/static/chunks/5574-9bde3adbdd56d647.js:1:22956)
+     at asyn (http://localhost:3000/_next/static/chunks/83617-9fdde695c7bc16c7.js)",
+   "requête en échec : 404 GET localhost:3000/api/admin/events/00000000-0000-4000-8000-000000000931/tables",
+ ]
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e4]:
      - generic [ref=e5]:
        - link "Event Village, accueil" [ref=e7] [cursor=pointer]:
          - /url: /
          - generic [ref=e8]: Event Village
        - button "Replier la barre latérale" [expanded] [ref=e11] [cursor=pointer]
      - navigation "Navigation principale" [ref=e16]:
        - generic [ref=e17]: Administration
        - link "Tableau de bord" [ref=e22] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=e29]:
          - paragraph [ref=e30]: Gestion
          - generic [ref=e31]:
            - link "Événements" [ref=e32] [cursor=pointer]:
              - /url: /admin/events
            - link "Comptes" [ref=e36] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=e43] [cursor=pointer]:
              - /url: /admin/services
            - link "Salles à valider" [ref=e49] [cursor=pointer]:
              - /url: /admin/halls
        - generic [ref=e55]:
          - paragraph [ref=e56]: Finances
          - link "Finance" [ref=e58] [cursor=pointer]:
            - /url: /admin/finance
        - generic [ref=e62]:
          - paragraph [ref=e63]: Engagement
          - generic [ref=e64]:
            - link "Parrainage" [ref=e65] [cursor=pointer]:
              - /url: /admin/referral
            - link "Campagnes" [ref=e70] [cursor=pointer]:
              - /url: /admin/communications
            - link "À la une" [ref=e75] [cursor=pointer]:
              - /url: /admin/a-la-une
        - generic [ref=e79]:
          - paragraph [ref=e80]: Système
          - generic [ref=e81]:
            - link "Réglages" [ref=e82] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Journal d’audit" [ref=e87] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=e92] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=e99] [cursor=pointer]:
              - /url: /scan
            - link "Sécurité du compte" [ref=e107] [cursor=pointer]:
              - /url: /admin/securite
        - link "Retour au site" [ref=e113] [cursor=pointer]:
          - /url: /
      - generic [ref=e118]:
        - link "Elhadji SuperAdmin Super-administrateur" [ref=e119] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e121]: ES
          - generic [ref=e122]:
            - generic [ref=e123]: Elhadji SuperAdmin
            - generic [ref=e124]: Super-administrateur
        - generic [ref=e125]:
          - button "Se déconnecter" [ref=e126] [cursor=pointer]
          - button "Basculer le thème" [pressed] [ref=e131] [cursor=pointer]
    - generic [ref=e139]:
      - banner [ref=e140]:
        - link "Rechercher un événement…" [ref=e142] [cursor=pointer]:
          - /url: /explore
        - generic [ref=e147]:
          - button "Notifications, 65 non lues" [ref=e149] [cursor=pointer]:
            - generic [ref=e153]: "65"
          - button "Elhadji SuperAdmin" [ref=e155] [cursor=pointer]:
            - generic [aria-hidden] [ref=e156]: ES
      - main [ref=e158]:
        - generic [ref=e160]:
          - generic [ref=e161]:
            - link "Retour aux événements" [ref=e163] [cursor=pointer]:
              - /url: /admin/events
            - generic [ref=e168]:
              - generic [ref=e169]:
                - generic [ref=e170]:
                  - 'generic "Mis en pause par l’équipe Event Village : la vente et le contrôle d’accès sont arrêtés." [ref=e171]': Suspendu
                  - generic [ref=e174]: Festivals
                - heading "Festival des Lumières de Saint-Louis" [level=1] [ref=e175]
                - paragraph [ref=e176]: Ndar Événements · dim. 1 nov. 2026 à 20:00
              - generic [ref=e177]:
                - button "Clore l’événement" [ref=e178] [cursor=pointer]
                - link "Ouvrir le pilotage" [ref=e180] [cursor=pointer]:
                  - /url: /partner/events/00000000-0000-4000-8000-000000000931
                - link "Équipe de cet événement" [ref=e186] [cursor=pointer]:
                  - /url: /partner/events/00000000-0000-4000-8000-000000000931?tab=equipe
                - link "Page publique" [ref=e194] [cursor=pointer]:
                  - /url: /events/00000000-0000-4000-8000-000000000931
          - status [ref=e201]:
            - generic [ref=e206]:
              - paragraph [ref=e207]: Motif de la suspension
              - generic [ref=e208]:
                - paragraph [ref=e209]: "Lieu fermé par arrêté préfectoral : en attente d’une nouvelle date."
                - paragraph [ref=e210]:
                  - text: Communiqué à l’organisateur le
                  - time [ref=e211]: dim. 1 nov. 2026 à 18:00
                  - text: .
          - generic [ref=e212]:
            - generic [ref=e213]:
              - region [ref=e214]:
                - heading "Dates et lieu" [level=2] [ref=e215]
                - generic [ref=e216]:
                  - generic [ref=e217]:
                    - term [ref=e218]: Début
                    - definition [ref=e222]: dim. 1 nov. 2026 à 20:00
                  - generic [ref=e223]:
                    - term [ref=e224]: Fin
                    - definition [ref=e229]: lun. 2 nov. 2026 à 02:00
                  - generic [ref=e230]:
                    - term [ref=e231]: Lieu
                    - definition [ref=e236]:
                      - text: Quai Henri Jay, Saint-Louis
                      - generic [ref=e237]: Aucun repère sur la carte.
                  - generic [ref=e238]:
                    - term [ref=e239]: Jauge déclarée
                    - definition [ref=e246]: 800 personnes
              - region [ref=e247]:
                - heading "Description" [level=2] [ref=e248]
                - paragraph [ref=e249]: Trois scènes sur les quais, musiques mandingues et mbalax jusqu’à l’aube.
              - region [ref=e250]:
                - heading "Programme" [level=2] [ref=e251]
                - paragraph [ref=e252]: Aucun programme renseigné.
              - region [ref=e253]:
                - heading "Catégories et prix" [level=2] [ref=e254]
                - region "Catégories de billets, tous canaux et inactives comprises" [ref=e256]:
                  - table [ref=e257]:
                    - caption [ref=e258]: Catégories de billets, tous canaux et inactives comprises
                    - rowgroup [ref=e259]:
                      - row [ref=e260]:
                        - columnheader "Catégorie" [ref=e261]
                        - columnheader "Prix" [ref=e262]
                        - columnheader "Quota" [ref=e263]
                        - columnheader "Période de vente" [ref=e264]
                        - columnheader "Par commande" [ref=e265]
                        - columnheader "Au contrôle" [ref=e266]
                        - columnheader "Canaux et état" [ref=e267]
                    - rowgroup [ref=e268]:
                      - row [ref=e269]:
                        - cell "Standard" [ref=e270]
                        - cell "5 000 F CFA" [ref=e273]
                        - cell "600" [ref=e274]
                        - cell "Dès la publication · jusqu’à l’événement" [ref=e275]
                        - cell "10 au plus" [ref=e277]
                        - cell "Sans couleur Aucune consigne" [ref=e278]:
                          - generic [ref=e279]:
                            - generic [ref=e280]: Sans couleur
                            - generic [ref=e282]: Aucune consigne
                        - cell "En ligne et au guichet Active" [ref=e283]:
                          - generic [ref=e284]:
                            - generic [ref=e285]: En ligne et au guichet
                            - generic [ref=e287]: Active
              - region [ref=e289]:
                - heading "Tables" [level=2] [ref=e290]
                - alert [ref=e291]: Événement introuvable.
              - region [ref=e292]:
                - heading "Contrôle à l’entrée" [level=2] [ref=e293]
                - paragraph [ref=e294]: "Une seule entrée : chaque contrôleur laisse entrer toutes les catégories."
            - generic [ref=e295]:
              - region [ref=e296]:
                - heading "Affiche" [level=2] [ref=e297]
                - generic [ref=e298]: Aucune affiche
              - region [ref=e304]:
                - heading "Organisateur" [level=2] [ref=e305]
                - generic [ref=e306]:
                  - generic [ref=e307]:
                    - term [ref=e308]: Structure
                    - definition [ref=e314]:
                      - text: Ndar Événements
                      - generic [ref=e315]: Compte validé
                  - generic [ref=e318]:
                    - term [ref=e319]: Responsable
                    - definition [ref=e326]: Mariama Sall
                  - generic [ref=e327]:
                    - term [ref=e328]: Téléphone
                    - definition [ref=e332]:
                      - link "+221771234567" [ref=e333] [cursor=pointer]:
                        - /url: tel:+221771234567
                  - generic [ref=e334]:
                    - term [ref=e335]: Ville
                    - definition [ref=e340]: Saint-Louis
              - region [ref=e341]:
                - heading "Historique des statuts" [level=2] [ref=e342]
                - list [ref=e343]:
                  - listitem [ref=e344]:
                    - paragraph [ref=e346]: "Création : Brouillon"
                    - paragraph [ref=e347]: Mariama Sall (Partenaire) · Création
                    - paragraph [ref=e348]:
                      - time [ref=e349]: sam. 10 oct. 2026 à 09:00
                  - listitem [ref=e350]:
                    - paragraph [ref=e352]: Publié → Suspendu
                    - paragraph [ref=e353]: Ousmane Diallo (Administration) · Changement de statut
                    - paragraph [ref=e354]:
                      - time [ref=e355]: dim. 1 nov. 2026 à 18:00
                    - blockquote [ref=e356]:
                      - generic [ref=e357]: "Motif :"
                      - text: "Lieu fermé par arrêté préfectoral : en attente d’une nouvelle date."
  - alert [ref=e358]
  - dialog [ref=e361]:
    - generic [ref=e362]:
      - generic [ref=e364]:
        - heading "Clore l’événement ?" [level=2] [ref=e365]
        - paragraph [ref=e366]: "L’événement passe « Terminé », sans annulation : personne n’est remboursé automatiquement. Prévenus : le partenaire par SMS, notification et email (si une adresse vérifiée), avec votre motif ; les détenteurs de billets par SMS, notification et email (si une adresse vérifiée), sans votre motif. Si une caisse est encore ouverte, le partenaire reçoit aussi une alerte par SMS. Si les participants doivent être remboursés, choisissez plutôt « Annuler l’événement »."
      - button "Fermer" [ref=e367] [cursor=pointer]
    - generic [ref=e374]:
      - generic [ref=e375]:
        - generic [ref=e376]:
          - text: Motif de la clôture*
          - generic [ref=e377]: (obligatoire)
        - generic [ref=e378]: 0 / 500
      - textbox "Motif de la clôture (obligatoire)" [active] [ref=e379]
      - paragraph [ref=e380]: Au moins 3 caractères. Ce motif est communiqué à l’organisateur et reste dans l’historique.
    - generic [ref=e381]:
      - button "Annuler" [ref=e382] [cursor=pointer]
      - button "Clore l’événement" [ref=e384] [cursor=pointer]
```

# Test source

```ts
  245 |             for (const stub of stubs) {
  246 |                 record.notes.push(`réponse simulée : ${stub.method ?? 'toute méthode'} ${stub.url} remplacée par HTTP ${stub.status} ${JSON.stringify(stub.body).slice(0, 160)}`);
  247 |                 await page.route(stub.url, async (route) => {
  248 |                     if (!methodMatches(stub.method, route.request().method())) {
  249 |                         await route.fallback();
  250 |                         return;
  251 |                     }
  252 |                     await route.fulfill({ status: stub.status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(stub.body) });
  253 |                 });
  254 |             }
  255 |             for (const hold of screen.holdRequests ?? []) {
  256 |                 record.notes.push(`requête retenue (jamais servie) : ${hold.method ?? 'toute méthode'} ${hold.url}`);
  257 |                 await page.route(hold.url, async (route) => {
  258 |                     if (!methodMatches(hold.method, route.request().method())) {
  259 |                         await route.fallback();
  260 |                         return;
  261 |                     }
  262 |                     // Retenue jusqu'à la fermeture de la page : ni réponse ni erreur (réseau lent, téléchargement en cours)
  263 |                     await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  264 |                 });
  265 |             }
  266 |             if (screen.fakePush) {
  267 |                 const subscription = screen.fakePush === 'granted' ? await fakePushSubscriber() : null;
  268 |                 record.notes.push(screen.fakePush === 'granted'
  269 |                     ? `push simulé (granted) : permission accordée au clic sans fenêtre, inscription du service worker et pushManager.subscribe remplacés ; abonnement du faux service push ${subscription?.endpoint ?? '?'} ; configuration VAPID, route d'inscription et base réelles`
  270 |                     : screen.fakePush === 'denied'
  271 |                         ? 'push simulé (denied) : Notification.permission = « denied », appels à requestPermission comptés'
  272 |                         : 'push simulé (unsupported) : window.PushManager et window.Notification supprimés');
  273 |                 await context.addInitScript(installFakePush, { mode: screen.fakePush, subscription });
  274 |             }
  275 |             if (screen.fakeCamera) {
  276 |                 const mode = screen.fakeCamera === 'barcode-detector' ? 'barcode-detector' : fakeScanMode();
  277 |                 record.notes.push(`caméra simulée (${mode})${mode === 'barcode-detector' ? ' : faux BarcodeDetector, payload posé par le test' : ''}`);
  278 |                 await context.addInitScript(installFakeCamera, { mode });
  279 |             }
  280 |             if (screen.offline === 'before-load') {
  281 |                 record.notes.push('connexion coupée avant le chargement (collecte d’erreurs arrêtée)');
  282 |                 guard.freeze();
  283 |                 await context.setOffline(true);
  284 |             }
  285 |             const response = await page.goto(record.url, { waitUntil: 'load' });
  286 |             record.status = response ? response.status() : null;
  287 |             if (screen.expectStatus !== undefined) {
  288 |                 expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
  289 |             }
  290 |             if (screen.offline === 'after-load') {
  291 |                 record.notes.push('connexion coupée après le chargement (collecte d’erreurs arrêtée)');
  292 |                 guard.freeze();
  293 |                 await context.setOffline(true);
  294 |             }
  295 |             const sc = { page, context, guard, ids: demo };
  296 |             if (screen.ready) await screen.ready(sc);
  297 |             await settle(page, guard, record.notes);
  298 |             if (screen.actions) {
  299 |                 await screen.actions(sc);
  300 |                 await settle(page, guard, record.notes);
  301 |             }
  302 |             if (screen.id === 'cloche-ouverte' && vue === 'mobile') {
  303 |                 const problem = await markAllOnOneLine(page);
  304 |                 if (problem) record.blocking.push(problem);
  305 |             }
  306 |             // Design 1e (décision du 21/11, modification signalée) : contrôles toujours faits page en HAUT (position fixe) :
  307 |             // selon le défilement laissé par l'écran, une cible pouvait se trouver à moitié sous l'en-tête collant et le
  308 |             // verdict d'axe changeait d'un run à l'autre. Aucune règle d'axe changée ; la capture garde ensuite la position
  309 |             // de l'écran (barre d'achat sur page défilée…).
  310 |             // Finition 5 (point 1) : la page capturée est-elle vraiment dans le thème demandé ? (classe dark et fond lus sur la
  311 |             // page ; bloquant : depuis le design 1a, les captures « sombre » des comptes connectés sortaient en clair)
  312 |             record.themeLu = await readTheme(page);
  313 |             const themeIssue = themeProblem(record.themeLu, theme.key);
  314 |             if (themeIssue) record.blocking.push(themeIssue);
  315 |             const scrolledTo = await page.evaluate(() => { const y = window.scrollY; window.scrollTo({ top: 0, behavior: 'instant' }); return y; });
  316 |             const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true, references: screen.references });
  317 |             if (scrolledTo > 0) await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), scrolledTo);
  318 |             record.blocking.push(...checks.blocking);
  319 |             record.warnings.push(...checks.warnings);
  320 |             record.axeDetails = checks.axeDetails;
  321 |             record.smallTextDetails = checks.smallTextDetails;
  322 |             record.metrics = checks.metrics;
  323 |             const shot = await capture(page, screen, file);
  324 |             record.captured = true;
  325 |             await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  326 |         } catch (err) {
  327 |             record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  328 |             if (!record.captured && !page.isClosed()) {
  329 |                 await capture(page, screen, file).then(
  330 |                     async (shot) => {
  331 |                         record.captured = true;
  332 |                         record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
  333 |                         await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  334 |                     },
  335 |                     (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
  336 |                 );
  337 |             }
  338 |             throw err;
  339 |         } finally {
  340 |             record.blocking.push(...guard.blockingIssues());
  341 |             record.warnings.push(...guard.nonBlockingIssues());
  342 |             record.durationMs = Date.now() - started;
  343 |             writeCaptureRecord(record);
  344 |         }
> 345 |         expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
      |                                                                   ^ Error: contrôles bloquants de admin-cloture-motif__ordinateur__sombre.png
  346 |     });
  347 | }
  348 | 
  349 | for (const theme of THEMES) {
  350 |     for (const role of ROLE_ORDER) {
  351 |         const screens = SCREENS.filter((s) => s.role === role);
  352 |         if (screens.length === 0) continue;
  353 |         test.describe(`${theme.key} · ${role}`, () => {
  354 |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  355 | 
  356 |             for (const screen of screens) {
  357 |                 if (screen.serviceWorkers === 'allow') {
  358 |                     // Lot 7 (D7) : service worker autorisé seulement dans le contexte de cet écran
  359 |                     test.describe(`${screen.id} (service worker autorisé)`, () => {
  360 |                         test.use({ serviceWorkers: 'allow' });
  361 |                         defineCapture(screen, theme, role);
  362 |                     });
  363 |                 } else {
  364 |                     defineCapture(screen, theme, role);
  365 |                 }
  366 |             }
  367 |         });
  368 |     }
  369 | }
  370 | 
```