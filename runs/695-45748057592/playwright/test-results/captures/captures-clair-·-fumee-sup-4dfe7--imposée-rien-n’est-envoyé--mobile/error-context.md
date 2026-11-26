# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · fumee-superadmin >> admin-cloture-motif — Administration — clôture d’un événement suspendu : champ « Motif de la clôture » (fiche imposée, rien n’est envoyé)
- Location: e2e/captures.spec.ts:202:9

# Error details

```
Error: contrôles bloquants de admin-cloture-motif__mobile__clair.png

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
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
            - /url: /
        - generic [ref=e13]:
          - button "Notifications, 65 non lues" [ref=e15] [cursor=pointer]:
            - generic [ref=e19]: "65"
          - button "Basculer le thème" [ref=e21] [cursor=pointer]
          - link "Mon profil (Elhadji SuperAdmin)" [ref=e25] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e26]: ES
      - main [ref=e28]:
        - generic [ref=e30]:
          - generic [ref=e31]:
            - link "Retour aux événements" [ref=e33] [cursor=pointer]:
              - /url: /admin/events
            - generic [ref=e38]:
              - generic [ref=e39]:
                - generic [ref=e40]:
                  - 'generic "Mis en pause par l’équipe Event Village : la vente et le contrôle d’accès sont arrêtés." [ref=e41]': Suspendu
                  - generic [ref=e44]: Festivals
                - heading "Festival des Lumières de Saint-Louis" [level=1] [ref=e45]
                - paragraph [ref=e46]: Ndar Événements · dim. 1 nov. 2026 à 20:00
              - generic [ref=e47]:
                - button "Clore l’événement" [ref=e48] [cursor=pointer]
                - link "Ouvrir le pilotage" [ref=e50] [cursor=pointer]:
                  - /url: /partner/events/00000000-0000-4000-8000-000000000931
                - link "Équipe de cet événement" [ref=e56] [cursor=pointer]:
                  - /url: /partner/events/00000000-0000-4000-8000-000000000931?tab=equipe
                - link "Page publique" [ref=e64] [cursor=pointer]:
                  - /url: /events/00000000-0000-4000-8000-000000000931
          - status [ref=e71]:
            - generic [ref=e76]:
              - paragraph [ref=e77]: Motif de la suspension
              - generic [ref=e78]:
                - paragraph [ref=e79]: "Lieu fermé par arrêté préfectoral : en attente d’une nouvelle date."
                - paragraph [ref=e80]:
                  - text: Communiqué à l’organisateur le
                  - time [ref=e81]: dim. 1 nov. 2026 à 18:00
                  - text: .
          - generic [ref=e82]:
            - generic [ref=e83]:
              - region [ref=e84]:
                - heading "Dates et lieu" [level=2] [ref=e85]
                - generic [ref=e86]:
                  - generic [ref=e87]:
                    - term [ref=e88]: Début
                    - definition [ref=e92]: dim. 1 nov. 2026 à 20:00
                  - generic [ref=e93]:
                    - term [ref=e94]: Fin
                    - definition [ref=e99]: lun. 2 nov. 2026 à 02:00
                  - generic [ref=e100]:
                    - term [ref=e101]: Lieu
                    - definition [ref=e106]:
                      - text: Quai Henri Jay, Saint-Louis
                      - generic [ref=e107]: Aucun repère sur la carte.
                  - generic [ref=e108]:
                    - term [ref=e109]: Jauge déclarée
                    - definition [ref=e116]: 800 personnes
              - region [ref=e117]:
                - heading "Description" [level=2] [ref=e118]
                - paragraph [ref=e119]: Trois scènes sur les quais, musiques mandingues et mbalax jusqu’à l’aube.
              - region [ref=e120]:
                - heading "Programme" [level=2] [ref=e121]
                - paragraph [ref=e122]: Aucun programme renseigné.
              - region [ref=e123]:
                - heading "Catégories et prix" [level=2] [ref=e124]
                - list "Catégories de billets, tous canaux et inactives comprises" [ref=e126]:
                  - listitem [ref=e127]:
                    - generic [ref=e128]: Standard
                    - generic [ref=e129]:
                      - term [ref=e130]: Catégorie
                      - definition [ref=e131]:
                        - generic [ref=e132]: Standard
                      - term [ref=e134]: Prix
                      - definition [ref=e135]: 5 000 F CFA
                      - term [ref=e136]: Quota
                      - definition [ref=e137]: "600"
                      - term [ref=e138]: Période de vente
                      - definition [ref=e139]:
                        - generic [ref=e140]: Dès la publication · jusqu’à l’événement
                      - term [ref=e141]: Par commande
                      - definition [ref=e142]: 10 au plus
                      - term [ref=e143]: Au contrôle
                      - definition [ref=e144]:
                        - generic [ref=e145]:
                          - generic [ref=e146]: Sans couleur
                          - generic [ref=e148]: Aucune consigne
                      - term [ref=e149]: Canaux et état
                      - definition [ref=e150]:
                        - generic [ref=e151]:
                          - generic [ref=e152]: En ligne et au guichet
                          - generic [ref=e154]: Active
              - region [ref=e156]:
                - heading "Tables" [level=2] [ref=e157]
                - alert [ref=e158]: Événement introuvable.
              - region [ref=e159]:
                - heading "Contrôle à l’entrée" [level=2] [ref=e160]
                - paragraph [ref=e161]: "Une seule entrée : chaque contrôleur laisse entrer toutes les catégories."
            - generic [ref=e162]:
              - region [ref=e163]:
                - heading "Affiche" [level=2] [ref=e164]
                - generic [ref=e165]: Aucune affiche
              - region [ref=e171]:
                - heading "Organisateur" [level=2] [ref=e172]
                - generic [ref=e173]:
                  - generic [ref=e174]:
                    - term [ref=e175]: Structure
                    - definition [ref=e181]:
                      - text: Ndar Événements
                      - generic [ref=e182]: Compte validé
                  - generic [ref=e185]:
                    - term [ref=e186]: Responsable
                    - definition [ref=e193]: Mariama Sall
                  - generic [ref=e194]:
                    - term [ref=e195]: Téléphone
                    - definition [ref=e199]:
                      - link "+221771234567" [ref=e200] [cursor=pointer]:
                        - /url: tel:+221771234567
                  - generic [ref=e201]:
                    - term [ref=e202]: Ville
                    - definition [ref=e207]: Saint-Louis
              - region [ref=e208]:
                - heading "Historique des statuts" [level=2] [ref=e209]
                - list [ref=e210]:
                  - listitem [ref=e211]:
                    - paragraph [ref=e213]: "Création : Brouillon"
                    - paragraph [ref=e214]: Mariama Sall (Partenaire) · Création
                    - paragraph [ref=e215]:
                      - time [ref=e216]: sam. 10 oct. 2026 à 09:00
                  - listitem [ref=e217]:
                    - paragraph [ref=e219]: Publié → Suspendu
                    - paragraph [ref=e220]: Ousmane Diallo (Administration) · Changement de statut
                    - paragraph [ref=e221]:
                      - time [ref=e222]: dim. 1 nov. 2026 à 18:00
                    - blockquote [ref=e223]:
                      - generic [ref=e224]: "Motif :"
                      - text: "Lieu fermé par arrêté préfectoral : en attente d’une nouvelle date."
    - navigation "Navigation rapide":
      - generic [ref=e225]:
        - link "Accueil" [ref=e227] [cursor=pointer]:
          - /url: /admin/dashboard
        - link "Validation" [ref=e235] [cursor=pointer]:
          - /url: /admin/events
        - link "Comptes" [ref=e240] [cursor=pointer]:
          - /url: /admin/users
        - link "Finance" [ref=e248] [cursor=pointer]:
          - /url: /admin/finance
        - link "Audit" [ref=e253] [cursor=pointer]:
          - /url: /admin/audit
  - alert [ref=e258]
  - dialog [ref=e261]:
    - generic [ref=e262]:
      - generic [ref=e264]:
        - heading "Clore l’événement ?" [level=2] [ref=e265]
        - paragraph [ref=e266]: "L’événement passe « Terminé », sans annulation : personne n’est remboursé automatiquement. Prévenus : le partenaire par SMS, notification et email (si une adresse vérifiée), avec votre motif ; les détenteurs de billets par SMS, notification et email (si une adresse vérifiée), sans votre motif. Si une caisse est encore ouverte, le partenaire reçoit aussi une alerte par SMS. Si les participants doivent être remboursés, choisissez plutôt « Annuler l’événement »."
      - button "Fermer" [ref=e267] [cursor=pointer]
    - generic [ref=e274]:
      - generic [ref=e275]:
        - generic [ref=e276]:
          - text: Motif de la clôture*
          - generic [ref=e277]: (obligatoire)
        - generic [ref=e278]: 0 / 500
      - textbox "Motif de la clôture (obligatoire)" [active] [ref=e279]
      - paragraph [ref=e280]: Au moins 3 caractères. Ce motif est communiqué à l’organisateur et reste dans l’historique.
    - generic [ref=e281]:
      - button "Annuler" [ref=e282] [cursor=pointer]
      - button "Clore l’événement" [ref=e284] [cursor=pointer]
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
      |                                                                   ^ Error: contrôles bloquants de admin-cloture-motif__mobile__clair.png
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