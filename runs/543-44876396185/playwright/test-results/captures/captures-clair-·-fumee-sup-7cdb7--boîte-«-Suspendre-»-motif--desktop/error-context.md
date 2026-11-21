# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · fumee-superadmin >> admin-fiche-partenaire-suspendre — Administration — fiche d’un partenaire validé : boîte « Suspendre » (motif)
- Location: e2e/captures.spec.ts:192:9

# Error details

```
Error: contrôles bloquants de admin-fiche-partenaire-suspendre__ordinateur__clair.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "axe-core target-size (serious, 1 nœud(s)) : All touch targets must be 24px large, or leave sufficient space",
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
          - button "Basculer le thème" [ref=e131] [cursor=pointer]
    - generic [ref=e135]:
      - banner [ref=e136]:
        - link "Rechercher un événement…" [ref=e138] [cursor=pointer]:
          - /url: /explore
        - generic [ref=e143]:
          - button "Notifications, 61 non lues" [ref=e145] [cursor=pointer]:
            - generic [ref=e149]: "61"
          - button "Elhadji SuperAdmin" [ref=e151] [cursor=pointer]:
            - generic [aria-hidden] [ref=e152]: ES
      - main [ref=e156]:
        - generic [ref=e158]:
          - generic [ref=e160]:
            - generic [ref=e161]:
              - heading "Tableau de bord" [level=1] [ref=e162]
              - paragraph [ref=e163]: Dossiers à traiter et vue d’ensemble de la plateforme.
            - generic [ref=e164]:
              - status [ref=e165]: Mis à jour à 07:05
              - button "Actualiser" [ref=e167] [cursor=pointer]
          - region [ref=e175]:
            - heading "À faire aujourd’hui" [level=2] [ref=e176]
            - list [ref=e177]:
              - listitem [ref=e178]:
                - paragraph [ref=e184]: "Argent qui attend : 2 versements à reprendre, aucune créance"
                - paragraph [ref=e185]: 63 000 F CFA attendus par des clients ou des partenaires depuis plus de 30 minutes.
                - link "Voir l’argent qui attend" [ref=e186] [cursor=pointer]:
                  - /url: "#argent-qui-attend"
              - listitem [ref=e191]:
                - paragraph [ref=e198]: 4 événements à valider
                - paragraph [ref=e199]: Le plus ancien attend depuis moins d’une heure.
                - link "Examiner les événements" [ref=e200] [cursor=pointer]:
                  - /url: /admin/events?status=EN_ATTENTE
              - listitem [ref=e205]:
                - paragraph [ref=e212]: 1 événement suspendu à décider
                - paragraph [ref=e213]: "1 à venir : réactivez-le ou annulez-le."
                - link "Voir les événements suspendus" [ref=e214] [cursor=pointer]:
                  - /url: /admin/events?status=SUSPENDU
              - listitem [ref=e219]:
                - paragraph [ref=e225]: 1 écart de caisse à valider
                - paragraph [ref=e226]: "Événement : « Nuit du Sabar — édition d’automne ». Recomptez l’argent avec le contrôleur avant de valider."
                - link "Voir la caisse" [ref=e227] [cursor=pointer]:
                  - /url: /partner/events/59e53edc-3d51-4056-beeb-1338b87a6062?tab=caisse
              - listitem [ref=e232]:
                - paragraph [ref=e237]: 1 envoi en échec aujourd’hui
                - paragraph [ref=e238]: SMS, emails ou notifications qui ne sont pas partis.
                - link "Voir les envois en échec" [ref=e239] [cursor=pointer]:
                  - /url: /admin/notifications?status=FAILED
            - list "À jour" [ref=e244]:
              - listitem [ref=e245]: "Candidatures de partenaires : aucune"
              - listitem [ref=e249]: "SMS optionnels : sous le seuil d’alerte"
          - region [ref=e254]:
            - heading "Argent qui attend" [level=2] [ref=e255]
            - list [ref=e256]:
              - listitem [ref=e257]:
                - paragraph [ref=e263]: 2 versements à reprendre
                - paragraph [ref=e264]: 63 000 F CFA que des clients ou des partenaires attendent depuis plus de 30 minutes.
                - link "Traiter les versements" [ref=e265] [cursor=pointer]:
                  - /url: /admin/finance#versements-a-reprendre
              - listitem [ref=e270]:
                - paragraph [ref=e279]: 4 remboursements à verser
                - paragraph [ref=e280]: 97 650 F CFA demandés et pas encore reçus par les clients.
                - link "Voir les remboursements" [ref=e281] [cursor=pointer]:
                  - /url: /admin/finance#remboursements-a-verser
            - list "À jour" [ref=e286]:
              - listitem [ref=e287]: "Créances : aucune"
          - region [ref=e291]:
            - heading "Indicateurs" [level=2] [ref=e292]
            - generic [ref=e293]:
              - generic [ref=e294]:
                - paragraph [ref=e296]: Gagné par Event Village
                - paragraph [ref=e300]: 57 540,72 F CFA
                - paragraph [ref=e301]: Ce mois-ci, du 1er au 21 novembre 2026. Détail sur la page Finance.
              - generic [ref=e302]:
                - paragraph [ref=e304]: Encaissé ce mois-ci
                - paragraph [ref=e309]: 2 002 950 F CFA
                - paragraph [ref=e310]: Paiements en ligne, frais de service compris.
              - generic [ref=e311]:
                - paragraph [ref=e313]: Partenaires validés
                - paragraph [ref=e319]: "6"
                - paragraph [ref=e320]: sur 6 inscrits
              - generic [ref=e321]:
                - paragraph [ref=e323]: Utilisateurs inscrits
                - paragraph [ref=e330]: "42"
                - paragraph [ref=e331]: 0 ambassadeur(s) actif(s)
          - region [ref=e332]:
            - generic [ref=e333]:
              - heading "Candidatures des partenaires" [level=2] [ref=e334]
              - paragraph [ref=e335]: Validez ou refusez les organisateurs, restaurants et gestionnaires de salles après examen de leur dossier.
            - tablist "Statut des candidatures" [ref=e337]:
              - tab "En attente , 0" [ref=e338] [cursor=pointer]:
                - generic [ref=e339]: En attente
                - generic [ref=e340]:
                  - generic [ref=e341]: ","
                  - text: "0"
              - tab "Validés , 6" [ref=e342] [cursor=pointer]:
                - generic [ref=e343]: Validés
                - generic [ref=e344]:
                  - generic [ref=e345]: ","
                  - text: "6"
              - tab "Refusés , 0" [ref=e346] [cursor=pointer]:
                - generic [ref=e347]: Refusés
                - generic [ref=e348]:
                  - generic [ref=e349]: ","
                  - text: "0"
              - tab "Tous , 6" [selected] [ref=e350] [cursor=pointer]:
                - generic [ref=e351]: Tous
                - generic [ref=e352]:
                  - generic [ref=e353]: ","
                  - text: "6"
            - tabpanel "Tous , 6" [ref=e354]:
              - region "Candidatures des partenaires" [ref=e356]:
                - table [ref=e357]:
                  - caption [ref=e358]: Candidatures des partenaires
                  - rowgroup [ref=e359]:
                    - row [ref=e360]:
                      - columnheader "Partenaire" [ref=e361]
                      - columnheader "Responsable" [ref=e362]
                      - columnheader "Statut" [ref=e363]
                      - columnheader "Inscrit le" [ref=e364]
                      - columnheader "Actions" [ref=e365]
                  - rowgroup [ref=e366]:
                    - row [ref=e367]:
                      - cell "Teranga Découvertes Organisateur" [ref=e368]:
                        - generic [ref=e369]:
                          - generic [ref=e370]: Teranga Découvertes
                          - generic [ref=e371]: Organisateur
                      - cell "Ndèye Gning +221700000109 Rufisque" [ref=e374]:
                        - generic [ref=e375]:
                          - generic [ref=e376]: Ndèye Gning
                          - generic [ref=e377]: "+221700000109"
                          - generic [ref=e378]: Rufisque
                      - cell "Validé" [ref=e379]
                      - cell [ref=e382]:
                        - time [ref=e383]: sam. 21 nov. 2026 à 06:40
                      - cell [ref=e384]:
                        - button "Dossier" [ref=e386] [cursor=pointer]
                    - row [ref=e392]:
                      - cell "Atelier Petite-Côte Petite-Côte Événements Organisateur" [ref=e393]:
                        - generic [ref=e394]:
                          - generic [ref=e395]: Atelier Petite-Côte
                          - generic [ref=e396]: Petite-Côte Événements
                          - generic [ref=e397]: Organisateur
                      - cell "Khady Sarr +221700000103 Mbour" [ref=e400]:
                        - generic [ref=e401]:
                          - generic [ref=e402]: Khady Sarr
                          - generic [ref=e403]: "+221700000103"
                          - generic [ref=e404]: Mbour
                      - cell "Validé" [ref=e405]
                      - cell [ref=e408]:
                        - time [ref=e409]: sam. 21 nov. 2026 à 06:40
                      - cell [ref=e410]:
                        - button "Dossier" [ref=e412] [cursor=pointer]
                    - row [ref=e418]:
                      - cell "Sine-Saloum Culture & Loisirs Saloum Culture Organisateur" [ref=e419]:
                        - generic [ref=e420]:
                          - generic [ref=e421]: Sine-Saloum Culture & Loisirs
                          - generic [ref=e422]: Saloum Culture
                          - generic [ref=e423]: Organisateur
                      - cell "Ousmane Faye +221700000102 Kaolack" [ref=e426]:
                        - generic [ref=e427]:
                          - generic [ref=e428]: Ousmane Faye
                          - generic [ref=e429]: "+221700000102"
                          - generic [ref=e430]: Kaolack
                      - cell "Validé" [ref=e431]
                      - cell [ref=e434]:
                        - time [ref=e435]: sam. 21 nov. 2026 à 06:40
                      - cell [ref=e436]:
                        - button "Dossier" [ref=e438] [cursor=pointer]
                    - row [ref=e444]:
                      - cell "Baobab Scène Productions Baobab Scène Organisateur" [ref=e445]:
                        - generic [ref=e446]:
                          - generic [ref=e447]: Baobab Scène Productions
                          - generic [ref=e448]: Baobab Scène
                          - generic [ref=e449]: Organisateur
                      - cell "Mariama Ndiaye +221700000101 Dakar" [ref=e452]:
                        - generic [ref=e453]:
                          - generic [ref=e454]: Mariama Ndiaye
                          - generic [ref=e455]: "+221700000101"
                          - generic [ref=e456]: Dakar
                      - cell "Validé" [ref=e457]
                      - cell [ref=e460]:
                        - time [ref=e461]: sam. 21 nov. 2026 à 06:40
                      - cell [ref=e462]:
                        - button "Dossier" [ref=e464] [cursor=pointer]
                    - row [ref=e470]:
                      - cell "TEST Organisateur B Orga B (test) Organisateur" [ref=e471]:
                        - generic [ref=e472]:
                          - generic [ref=e473]: TEST Organisateur B
                          - generic [ref=e474]: Orga B (test)
                          - generic [ref=e475]: Organisateur
                      - cell "Bassirou OrgaB +221700000004 Thiès" [ref=e478]:
                        - generic [ref=e479]:
                          - generic [ref=e480]: Bassirou OrgaB
                          - generic [ref=e481]: "+221700000004"
                          - generic [ref=e482]: Thiès
                      - cell "Validé" [ref=e483]
                      - cell [ref=e486]:
                        - time [ref=e487]: sam. 21 nov. 2026 à 06:39
                      - cell [ref=e488]:
                        - button "Dossier" [ref=e490] [cursor=pointer]
                    - row [ref=e496]:
                      - cell "TEST Organisateur A Orga A (test) Organisateur" [ref=e497]:
                        - generic [ref=e498]:
                          - generic [ref=e499]: TEST Organisateur A
                          - generic [ref=e500]: Orga A (test)
                          - generic [ref=e501]: Organisateur
                      - cell "Aïssatou OrgaA +221700000003 Dakar" [ref=e504]:
                        - generic [ref=e505]:
                          - generic [ref=e506]: Aïssatou OrgaA
                          - generic [ref=e507]: "+221700000003"
                          - generic [ref=e508]: Dakar
                      - cell "Validé" [ref=e509]
                      - cell [ref=e512]:
                        - time [ref=e513]: sam. 21 nov. 2026 à 06:39
                      - cell [ref=e514]:
                        - button "Dossier" [ref=e516] [cursor=pointer]
          - region [ref=e522]:
            - heading "Raccourcis" [level=2] [ref=e523]
            - generic [ref=e524]:
              - link "Parrainage et ambassadeurs" [ref=e525] [cursor=pointer]:
                - /url: /admin/referral
              - link "Journal d’audit" [ref=e531] [cursor=pointer]:
                - /url: /admin/audit
              - link "Catalogues et services" [ref=e536] [cursor=pointer]:
                - /url: /admin/services
  - alert [ref=e543]
  - dialog [ref=e546]:
    - generic [ref=e547]:
      - generic [ref=e549]:
        - heading "Suspendre le partenaire" [level=2] [ref=e550]
        - paragraph [ref=e551]: "« Baobab Scène Productions » ne pourra plus vendre : ses événements en ligne sont suspendus et ses fonds sont gelés jusqu’à la réactivation. Prévenus : le partenaire par SMS, notification et email (si une adresse vérifiée), avec votre motif ; les détenteurs de billets de ses événements en ligne par SMS, notification et email (si une adresse vérifiée), sans votre motif, seulement s’ils acceptent les actualités des événements ; les contrôleurs de ses événements par SMS, notification et email (si une adresse vérifiée), sans votre motif."
      - button "Fermer" [ref=e552] [cursor=pointer]
    - generic [ref=e559]:
      - generic [ref=e560]:
        - generic [ref=e561]:
          - text: Motif de la suspension*
          - generic [ref=e562]: (obligatoire)
        - generic [ref=e563]: 0 / 1000
      - textbox "Motif de la suspension (obligatoire)" [active] [ref=e564]
      - paragraph [ref=e565]: Au moins 3 caractères. Envoyé au partenaire (le SMS n’en garde que le début) et enregistré au journal.
    - generic [ref=e566]:
      - button "Annuler" [ref=e567] [cursor=pointer]
      - button "Suspendre le partenaire" [ref=e569] [cursor=pointer]
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
      |                                                                   ^ Error: contrôles bloquants de admin-fiche-partenaire-suspendre__ordinateur__clair.png
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