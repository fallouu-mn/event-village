# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · organisateur >> salles-partenaire-calendrier — Partenaire — calendrier des réservations d’une salle (mois de la réservation du client)
- Location: e2e/captures.spec.ts:192:9

# Error details

```
Error: contrôles bloquants de salles-partenaire-calendrier__mobile__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "1 cible(s) < 44 px : button « lundi 14 décembre 2026 : 1 réservation » 43×44",
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
          - button "Notifications, 32 non lues" [ref=e15] [cursor=pointer]:
            - generic [ref=e19]: "32"
          - button "Basculer le thème" [ref=e21] [cursor=pointer]
          - link "Mon profil (Mariama Ndiaye)" [ref=e25] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e26]: MN
      - main [ref=e28]:
        - generic [ref=e30]:
          - generic [ref=e31]:
            - link "Mes salles" [ref=e33] [cursor=pointer]:
              - /url: /partner/halls
            - generic [ref=e38]:
              - generic [ref=e39]:
                - generic [ref=e40]: Validée
                - heading "Salle des Fromagers" [level=1] [ref=e43]
                - paragraph [ref=e44]: Dakar · 350 personnes
              - link "Modifier" [ref=e46] [cursor=pointer]:
                - /url: /partner/halls/3d0a9a2e-53fb-4db6-8fa9-a679e0bdf742/edit
          - status [ref=e52]:
            - generic [ref=e58]:
              - paragraph [ref=e59]: Validée
              - generic [ref=e60]: La salle est visible et peut être réservée.
          - generic [ref=e62]:
            - generic [ref=e63]:
              - generic [ref=e65]:
                - img "Photo principale de Salle des Fromagers" [ref=e66]
                - generic [ref=e67]: Photo principale
              - region [ref=e68]:
                - heading "Description" [level=2] [ref=e69]
                - paragraph [ref=e70]: Grande salle climatisée au cœur du Plateau, avec scène, piste de danse et terrasse ombragée. Mariages, baptêmes, galas et séminaires jusqu’à 350 invités ; cuisine équipée pour le traiteur et parking surveillé.
              - region [ref=e71]:
                - heading "Équipements" [level=2] [ref=e72]
                - list [ref=e73]:
                  - listitem [ref=e74]: Climatisation
                  - listitem [ref=e75]: Sonorisation
                  - listitem [ref=e76]: Scène
                  - listitem [ref=e77]: Piste de danse
                  - listitem [ref=e78]: Cuisine équipée
                  - listitem [ref=e79]: Parking surveillé
                  - listitem [ref=e80]: Groupe électrogène
                  - listitem [ref=e81]: Terrasse
            - region [ref=e82]:
              - heading "Informations clés" [level=2] [ref=e83]
              - generic [ref=e84]:
                - generic [ref=e85]:
                  - term [ref=e86]: Prix par jour
                  - definition [ref=e87]: 450 000 F CFA
                - generic [ref=e88]:
                  - term [ref=e89]: Prix par heure
                  - definition [ref=e90]: 60 000 F CFA
                - generic [ref=e91]:
                  - term [ref=e92]: Acompte
                  - definition [ref=e93]: 40 % du prix
                - generic [ref=e94]:
                  - term [ref=e95]: Capacité
                  - definition [ref=e96]: 350 personnes
                - generic [ref=e97]:
                  - term [ref=e98]: Règle d’annulation
                  - definition [ref=e99]:
                    - generic [ref=e100]: Modérée
                    - generic [ref=e101]: "Règle Modérée : remboursement total si le client annule au moins 30 jours avant la date, 50 % jusqu’à 7 jours avant, rien ensuite."
                - generic [ref=e102]:
                  - term [ref=e103]: Adresse
                  - definition [ref=e104]:
                    - generic [ref=e105]: 22, avenue Léopold-Sédar-Senghor, Dakar-Plateau, Dakar
              - link "Voir les recettes des salles" [ref=e110] [cursor=pointer]:
                - /url: /partner/halls/recettes
          - region [ref=e117]:
            - generic [ref=e118]:
              - heading "Calendrier des réservations" [level=2] [ref=e119]
              - button "Revenir à ce mois-ci" [ref=e120] [cursor=pointer]
            - generic [ref=e122]:
              - button "Mois précédent" [ref=e123] [cursor=pointer]
              - paragraph [ref=e127]: décembre 2026
              - button "Mois suivant" [active] [ref=e128] [cursor=pointer]
            - group "Jours de décembre 2026" [ref=e132]:
              - generic [aria-hidden] [ref=e133]:
                - generic [ref=e134]: Lun
                - generic [ref=e135]: Mar
                - generic [ref=e136]: Mer
                - generic [ref=e137]: Jeu
                - generic [ref=e138]: Ven
                - generic [ref=e139]: Sam
                - generic [ref=e140]: Dim
              - list [ref=e141]:
                - listitem [aria-hidden] [ref=e142]
                - listitem [ref=e143]:
                  - generic [ref=e144]:
                    - generic [ref=e146]: "1"
                    - generic [ref=e147]: mardi 1 décembre 2026
                - listitem [ref=e148]:
                  - generic [ref=e149]:
                    - generic [ref=e151]: "2"
                    - generic [ref=e152]: mercredi 2 décembre 2026
                - listitem [ref=e153]:
                  - generic [ref=e154]:
                    - generic [ref=e156]: "3"
                    - generic [ref=e157]: jeudi 3 décembre 2026
                - listitem [ref=e158]:
                  - generic [ref=e159]:
                    - generic [ref=e161]: "4"
                    - generic [ref=e162]: vendredi 4 décembre 2026
                - listitem [ref=e163]:
                  - generic [ref=e164]:
                    - generic [ref=e166]: "5"
                    - generic [ref=e167]: samedi 5 décembre 2026
                - listitem [ref=e168]:
                  - generic [ref=e169]:
                    - generic [ref=e171]: "6"
                    - generic [ref=e172]: dimanche 6 décembre 2026
                - listitem [ref=e173]:
                  - generic [ref=e174]:
                    - generic [ref=e176]: "7"
                    - generic [ref=e177]: lundi 7 décembre 2026
                - listitem [ref=e178]:
                  - generic [ref=e179]:
                    - generic [ref=e181]: "8"
                    - generic [ref=e182]: mardi 8 décembre 2026
                - listitem [ref=e183]:
                  - generic [ref=e184]:
                    - generic [ref=e186]: "9"
                    - generic [ref=e187]: mercredi 9 décembre 2026
                - listitem [ref=e188]:
                  - generic [ref=e189]:
                    - generic [ref=e191]: "10"
                    - generic [ref=e192]: jeudi 10 décembre 2026
                - listitem [ref=e193]:
                  - generic [ref=e194]:
                    - generic [ref=e196]: "11"
                    - generic [ref=e197]: vendredi 11 décembre 2026
                - listitem [ref=e198]:
                  - generic [ref=e199]:
                    - generic [ref=e201]: "12"
                    - generic [ref=e202]: samedi 12 décembre 2026
                - listitem [ref=e203]:
                  - generic [ref=e204]:
                    - generic [ref=e206]: "13"
                    - generic [ref=e207]: dimanche 13 décembre 2026
                - listitem [ref=e208]:
                  - 'button "lundi 14 décembre 2026 : 1 réservation" [ref=e209] [cursor=pointer]':
                    - generic [ref=e210]: "14"
                - listitem [ref=e212]:
                  - generic [ref=e213]:
                    - generic [ref=e215]: "15"
                    - generic [ref=e216]: mardi 15 décembre 2026
                - listitem [ref=e217]:
                  - generic [ref=e218]:
                    - generic [ref=e220]: "16"
                    - generic [ref=e221]: mercredi 16 décembre 2026
                - listitem [ref=e222]:
                  - generic [ref=e223]:
                    - generic [ref=e225]: "17"
                    - generic [ref=e226]: jeudi 17 décembre 2026
                - listitem [ref=e227]:
                  - generic [ref=e228]:
                    - generic [ref=e230]: "18"
                    - generic [ref=e231]: vendredi 18 décembre 2026
                - listitem [ref=e232]:
                  - generic [ref=e233]:
                    - generic [ref=e235]: "19"
                    - generic [ref=e236]: samedi 19 décembre 2026
                - listitem [ref=e237]:
                  - generic [ref=e238]:
                    - generic [ref=e240]: "20"
                    - generic [ref=e241]: dimanche 20 décembre 2026
                - listitem [ref=e242]:
                  - generic [ref=e243]:
                    - generic [ref=e245]: "21"
                    - generic [ref=e246]: lundi 21 décembre 2026
                - listitem [ref=e247]:
                  - generic [ref=e248]:
                    - generic [ref=e250]: "22"
                    - generic [ref=e251]: mardi 22 décembre 2026
                - listitem [ref=e252]:
                  - generic [ref=e253]:
                    - generic [ref=e255]: "23"
                    - generic [ref=e256]: mercredi 23 décembre 2026
                - listitem [ref=e257]:
                  - generic [ref=e258]:
                    - generic [ref=e260]: "24"
                    - generic [ref=e261]: jeudi 24 décembre 2026
                - listitem [ref=e262]:
                  - generic [ref=e263]:
                    - generic [ref=e265]: "25"
                    - generic [ref=e266]: vendredi 25 décembre 2026
                - listitem [ref=e267]:
                  - generic [ref=e268]:
                    - generic [ref=e270]: "26"
                    - generic [ref=e271]: samedi 26 décembre 2026
                - listitem [ref=e272]:
                  - generic [ref=e273]:
                    - generic [ref=e275]: "27"
                    - generic [ref=e276]: dimanche 27 décembre 2026
                - listitem [ref=e277]:
                  - generic [ref=e278]:
                    - generic [ref=e280]: "28"
                    - generic [ref=e281]: lundi 28 décembre 2026
                - listitem [ref=e282]:
                  - generic [ref=e283]:
                    - generic [ref=e285]: "29"
                    - generic [ref=e286]: mardi 29 décembre 2026
                - listitem [ref=e287]:
                  - generic [ref=e288]:
                    - generic [ref=e290]: "30"
                    - generic [ref=e291]: mercredi 30 décembre 2026
                - listitem [ref=e292]:
                  - generic [ref=e293]:
                    - generic [ref=e295]: "31"
                    - generic [ref=e296]: jeudi 31 décembre 2026
            - list "Légende du calendrier" [ref=e297]:
              - listitem [ref=e298]: Jour réservé
              - listitem [ref=e300]: Réservation annulée seulement
              - listitem [ref=e302]:
                - generic [aria-hidden] [ref=e303]: "12"
                - text: Aujourd’hui
            - generic [ref=e304]:
              - heading "Réservations de décembre 2026" [level=3] [ref=e306]
              - list [ref=e307]:
                - listitem [ref=e308]:
                  - 'link "En attente de paiement Le 14 décembre 2026 Fatou Payé : 0 F CFA sur 472 500 F CFA Voir le détail" [ref=e309] [cursor=pointer]':
                    - /url: /partner/halls/reservations/6ddb17ca-043e-4e9d-aeb9-d7ce0683fda3
                    - generic [ref=e310]:
                      - generic [ref=e311]: En attente de paiement
                      - paragraph [ref=e314]: Le 14 décembre 2026
                      - paragraph [ref=e315]:
                        - generic [ref=e316]: Fatou
                        - generic [ref=e320]: "Payé : 0 F CFA sur 472 500 F CFA"
                    - generic [ref=e323]: Voir le détail
    - navigation "Navigation rapide" [ref=e324]:
      - generic [ref=e325]:
        - link "Accueil" [ref=e326] [cursor=pointer]:
          - /url: /partner/dashboard
        - link "Billetterie" [ref=e333] [cursor=pointer]:
          - /url: /partner/events
        - link "Scanner" [ref=e337] [cursor=pointer]:
          - /url: /partner/scan
        - link "Finances" [ref=e345] [cursor=pointer]:
          - /url: /partner/finance
        - link "Profil" [ref=e349] [cursor=pointer]:
          - /url: /partner/profile
  - alert [ref=e354]
```

# Test source

```ts
  224 |                 await context.addInitScript(stretchTimers, screen.slowTimers);
  225 |             }
  226 |             if (screen.injectError) {
  227 |                 record.notes.push(`état d'erreur simulé : réponses ${screen.injectError} remplacées par un 500 (erreurs de console attendues, ignorées)`);
  228 |                 await page.route(screen.injectError, (route) => route.fulfill({
  229 |                     status: 500,
  230 |                     contentType: 'application/json; charset=utf-8',
  231 |                     body: JSON.stringify({ error: screen.injectErrorMessage ?? 'Erreur simulée par les tests de bout en bout.', code: 'E2E_SIMULATED_ERROR' }),
  232 |                 }));
  233 |             }
  234 |             const stubs: StubResponse[] = [...(screen.stubResponse ? [screen.stubResponse] : []), ...(screen.stubResponses ?? [])];
  235 |             for (const stub of stubs) {
  236 |                 record.notes.push(`réponse simulée : ${stub.method ?? 'toute méthode'} ${stub.url} remplacée par HTTP ${stub.status} ${JSON.stringify(stub.body).slice(0, 160)}`);
  237 |                 await page.route(stub.url, async (route) => {
  238 |                     if (!methodMatches(stub.method, route.request().method())) {
  239 |                         await route.fallback();
  240 |                         return;
  241 |                     }
  242 |                     await route.fulfill({ status: stub.status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(stub.body) });
  243 |                 });
  244 |             }
  245 |             for (const hold of screen.holdRequests ?? []) {
  246 |                 record.notes.push(`requête retenue (jamais servie) : ${hold.method ?? 'toute méthode'} ${hold.url}`);
  247 |                 await page.route(hold.url, async (route) => {
  248 |                     if (!methodMatches(hold.method, route.request().method())) {
  249 |                         await route.fallback();
  250 |                         return;
  251 |                     }
  252 |                     // Retenue jusqu'à la fermeture de la page : ni réponse ni erreur (réseau lent, téléchargement en cours)
  253 |                     await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  254 |                 });
  255 |             }
  256 |             if (screen.fakePush) {
  257 |                 const subscription = screen.fakePush === 'granted' ? await fakePushSubscriber() : null;
  258 |                 record.notes.push(screen.fakePush === 'granted'
  259 |                     ? `push simulé (granted) : permission accordée au clic sans fenêtre, inscription du service worker et pushManager.subscribe remplacés ; abonnement du faux service push ${subscription?.endpoint ?? '?'} ; configuration VAPID, route d'inscription et base réelles`
  260 |                     : screen.fakePush === 'denied'
  261 |                         ? 'push simulé (denied) : Notification.permission = « denied », appels à requestPermission comptés'
  262 |                         : 'push simulé (unsupported) : window.PushManager et window.Notification supprimés');
  263 |                 await context.addInitScript(installFakePush, { mode: screen.fakePush, subscription });
  264 |             }
  265 |             if (screen.fakeCamera) {
  266 |                 const mode = screen.fakeCamera === 'barcode-detector' ? 'barcode-detector' : fakeScanMode();
  267 |                 record.notes.push(`caméra simulée (${mode})${mode === 'barcode-detector' ? ' : faux BarcodeDetector, payload posé par le test' : ''}`);
  268 |                 await context.addInitScript(installFakeCamera, { mode });
  269 |             }
  270 |             if (screen.offline === 'before-load') {
  271 |                 record.notes.push('connexion coupée avant le chargement (collecte d’erreurs arrêtée)');
  272 |                 guard.freeze();
  273 |                 await context.setOffline(true);
  274 |             }
  275 |             const response = await page.goto(record.url, { waitUntil: 'load' });
  276 |             record.status = response ? response.status() : null;
  277 |             if (screen.expectStatus !== undefined) {
  278 |                 expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
  279 |             }
  280 |             if (screen.offline === 'after-load') {
  281 |                 record.notes.push('connexion coupée après le chargement (collecte d’erreurs arrêtée)');
  282 |                 guard.freeze();
  283 |                 await context.setOffline(true);
  284 |             }
  285 |             const sc = { page, context, guard, ids: demo };
  286 |             if (screen.ready) await screen.ready(sc);
  287 |             await settle(page, guard, record.notes);
  288 |             if (screen.actions) {
  289 |                 await screen.actions(sc);
  290 |                 await settle(page, guard, record.notes);
  291 |             }
  292 |             if (screen.id === 'cloche-ouverte' && vue === 'mobile') {
  293 |                 const problem = await markAllOnOneLine(page);
  294 |                 if (problem) record.blocking.push(problem);
  295 |             }
  296 |             const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true, references: screen.references });
  297 |             record.blocking.push(...checks.blocking);
  298 |             record.warnings.push(...checks.warnings);
  299 |             record.axeDetails = checks.axeDetails;
  300 |             record.smallTextDetails = checks.smallTextDetails;
  301 |             record.metrics = checks.metrics;
  302 |             const shot = await capture(page, screen, file);
  303 |             record.captured = true;
  304 |             await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  305 |         } catch (err) {
  306 |             record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  307 |             if (!record.captured && !page.isClosed()) {
  308 |                 await capture(page, screen, file).then(
  309 |                     async (shot) => {
  310 |                         record.captured = true;
  311 |                         record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
  312 |                         await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  313 |                     },
  314 |                     (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
  315 |                 );
  316 |             }
  317 |             throw err;
  318 |         } finally {
  319 |             record.blocking.push(...guard.blockingIssues());
  320 |             record.warnings.push(...guard.nonBlockingIssues());
  321 |             record.durationMs = Date.now() - started;
  322 |             writeCaptureRecord(record);
  323 |         }
> 324 |         expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
      |                                                                   ^ Error: contrôles bloquants de salles-partenaire-calendrier__mobile__sombre.png
  325 |     });
  326 | }
  327 | 
  328 | for (const theme of THEMES) {
  329 |     for (const role of ROLE_ORDER) {
  330 |         const screens = SCREENS.filter((s) => s.role === role);
  331 |         if (screens.length === 0) continue;
  332 |         test.describe(`${theme.key} · ${role}`, () => {
  333 |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  334 | 
  335 |             for (const screen of screens) {
  336 |                 if (screen.serviceWorkers === 'allow') {
  337 |                     // Lot 7 (D7) : service worker autorisé seulement dans le contexte de cet écran
  338 |                     test.describe(`${screen.id} (service worker autorisé)`, () => {
  339 |                         test.use({ serviceWorkers: 'allow' });
  340 |                         defineCapture(screen, theme, role);
  341 |                     });
  342 |                 } else {
  343 |                     defineCapture(screen, theme, role);
  344 |                 }
  345 |             }
  346 |         });
  347 |     }
  348 | }
  349 | 
```