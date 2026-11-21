# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · fumee-superadmin >> admin-accueil-a-faire — Administration — accueil : « À faire aujourd’hui » en tête (une carte par file, « À jour »)
- Location: e2e/captures.spec.ts:192:9

# Error details

```
Error: contrôles bloquants de admin-accueil-a-faire__ordinateur__clair.png

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
- generic [active] [ref=e1]:
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
              - status [ref=e165]: Mis à jour à 07:04
              - button "Actualiser" [ref=e167] [cursor=pointer]
          - region [ref=e175]:
            - heading "À faire aujourd’hui" [level=2] [ref=e176]
            - list [ref=e177]:
              - listitem [ref=e178]:
                - paragraph [ref=e184]: "Argent qui attend : 2 versements à reprendre, 3 créances"
                - paragraph [ref=e185]: 17 850 F CFA attendus par des clients ou des partenaires depuis plus de 30 minutes. 12 450 F CFA que des partenaires ou des parrains doivent encore à Event Village.
                - link "Voir l’argent qui attend" [ref=e186] [cursor=pointer]:
                  - /url: "#argent-qui-attend"
              - listitem [ref=e191]:
                - paragraph [ref=e198]: 3 événements à valider
                - paragraph [ref=e199]: Le plus ancien attend depuis 6 jours.
                - link "Examiner les événements" [ref=e200] [cursor=pointer]:
                  - /url: /admin/events?status=EN_ATTENTE
              - listitem [ref=e205]:
                - paragraph [ref=e212]: 2 candidatures de partenaires
                - paragraph [ref=e213]: Dont 1 dossier complété après un refus.
                - link "Examiner les candidatures" [ref=e214] [cursor=pointer]:
                  - /url: /admin/dashboard?partenaires=EN_ATTENTE#partenaires
              - listitem [ref=e219]:
                - paragraph [ref=e226]: 2 événements suspendus à décider
                - paragraph [ref=e227]: "1 dont la date est passée : clôturez-le ou annulez-le. 1 à venir : réactivez-le ou annulez-le."
                - link "Voir les événements suspendus" [ref=e228] [cursor=pointer]:
                  - /url: /admin/events?status=SUSPENDU
              - listitem [ref=e233]:
                - paragraph [ref=e239]: 1 écart de caisse à valider
                - paragraph [ref=e240]: "Événement : « Soirée Gorée ». Recomptez l’argent avec le contrôleur avant de valider."
                - link "Voir la caisse" [ref=e241] [cursor=pointer]:
                  - /url: /partner/events/00000000-0000-4000-8000-00000000f3b1?tab=caisse
            - list "À jour" [ref=e246]:
              - listitem [ref=e247]: "Envois en échec aujourd’hui : aucun"
              - listitem [ref=e251]: "SMS optionnels : sous le seuil d’alerte"
          - region [ref=e256]:
            - heading "Argent qui attend" [level=2] [ref=e257]
            - list [ref=e258]:
              - listitem [ref=e259]:
                - paragraph [ref=e265]: 2 versements à reprendre
                - paragraph [ref=e266]: 17 850 F CFA que des clients ou des partenaires attendent depuis plus de 30 minutes.
                - link "Traiter les versements" [ref=e267] [cursor=pointer]:
                  - /url: /admin/finance#versements-a-reprendre
              - listitem [ref=e272]:
                - paragraph [ref=e281]: 6 remboursements à verser
                - paragraph [ref=e282]: 63 000 F CFA demandés et pas encore reçus par les clients.
                - link "Voir les remboursements" [ref=e283] [cursor=pointer]:
                  - /url: /admin/finance#remboursements-a-verser
              - listitem [ref=e288]:
                - paragraph [ref=e295]: 3 créances
                - paragraph [ref=e296]: 12 450 F CFA que des partenaires ou des parrains doivent encore à Event Village, repris sur leurs prochains gains.
                - link "Voir les créances" [ref=e297] [cursor=pointer]:
                  - /url: /admin/finance#creances
          - region [ref=e302]:
            - heading "Indicateurs" [level=2] [ref=e303]
            - generic [ref=e304]:
              - generic [ref=e305]:
                - paragraph [ref=e307]: Gagné par Event Village
                - paragraph [ref=e311]: 57 540,72 F CFA
                - paragraph [ref=e312]: Ce mois-ci, du 1er au 21 novembre 2026. Détail sur la page Finance.
              - generic [ref=e313]:
                - paragraph [ref=e315]: Encaissé ce mois-ci
                - paragraph [ref=e320]: 2 002 950 F CFA
                - paragraph [ref=e321]: Paiements en ligne, frais de service compris.
              - generic [ref=e322]:
                - paragraph [ref=e324]: Partenaires validés
                - paragraph [ref=e330]: "6"
                - paragraph [ref=e331]: sur 6 inscrits
              - generic [ref=e332]:
                - paragraph [ref=e334]: Utilisateurs inscrits
                - paragraph [ref=e341]: "42"
                - paragraph [ref=e342]: 0 ambassadeur(s) actif(s)
          - region [ref=e343]:
            - generic [ref=e344]:
              - heading "Candidatures des partenaires" [level=2] [ref=e345]
              - paragraph [ref=e346]: Validez ou refusez les organisateurs, restaurants et gestionnaires de salles après examen de leur dossier.
            - tablist "Statut des candidatures" [ref=e348]:
              - tab "En attente , 0" [selected] [ref=e349] [cursor=pointer]:
                - generic [ref=e350]: En attente
                - generic [ref=e351]:
                  - generic [ref=e352]: ","
                  - text: "0"
              - tab "Validés , 6" [ref=e353] [cursor=pointer]:
                - generic [ref=e354]: Validés
                - generic [ref=e355]:
                  - generic [ref=e356]: ","
                  - text: "6"
              - tab "Refusés , 0" [ref=e357] [cursor=pointer]:
                - generic [ref=e358]: Refusés
                - generic [ref=e359]:
                  - generic [ref=e360]: ","
                  - text: "0"
              - tab "Tous , 6" [ref=e361] [cursor=pointer]:
                - generic [ref=e362]: Tous
                - generic [ref=e363]:
                  - generic [ref=e364]: ","
                  - text: "6"
            - tabpanel "En attente , 0" [ref=e365]:
              - generic [ref=e366]:
                - heading "Aucune candidature en attente" [level=3] [ref=e372]
                - paragraph [ref=e373]: Les nouvelles inscriptions « Devenir partenaire » apparaissent ici en direct, avec leurs pièces justificatives.
          - region [ref=e374]:
            - heading "Raccourcis" [level=2] [ref=e375]
            - generic [ref=e376]:
              - link "Parrainage et ambassadeurs" [ref=e377] [cursor=pointer]:
                - /url: /admin/referral
              - link "Journal d’audit" [ref=e383] [cursor=pointer]:
                - /url: /admin/audit
              - link "Catalogues et services" [ref=e388] [cursor=pointer]:
                - /url: /admin/services
  - alert [ref=e395]
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
      |                                                                   ^ Error: contrôles bloquants de admin-accueil-a-faire__ordinateur__clair.png
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