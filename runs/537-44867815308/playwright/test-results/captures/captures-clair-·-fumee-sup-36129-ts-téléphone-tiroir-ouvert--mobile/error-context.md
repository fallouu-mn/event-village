# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · fumee-superadmin >> admin-menu-droits-limites — Administration — menu d’un ADMIN qui ne gère que les événements (téléphone, tiroir ouvert)
- Location: e2e/captures.spec.ts:192:9

# Error details

```
Error: contrôles bloquants de admin-menu-droits-limites__mobile__clair.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "12 cible(s) < 44 px : button « Fermer le menu » 38×38 ; a « Event Village, accueil » 38×38 ; button « Notifications, 61 non lues » 38×38 ; button « Basculer le thème » 38×38 ; a « AN Mon profil (Awa Ndiaye) » 38×38 ; button « Actualiser » 102×38 ; a « Examiner les événements » 279×38 ; a « Voir mes droits » 87×38",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - dialog "Menu" [ref=e2]:
    - button [aria-hidden] [ref=e3]
    - generic [ref=e4]:
      - generic [ref=e5]:
        - button "Fermer le menu" [ref=e6] [cursor=pointer]
        - generic [ref=e10]: Event Village
      - navigation "Navigation principale" [ref=e11]:
        - link "Rechercher un événement…" [ref=e13] [cursor=pointer]:
          - /url: /explore
        - paragraph [ref=e18]: Administration
        - link "Tableau de bord" [ref=e22] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=e29]:
          - paragraph [ref=e30]: Gestion
          - generic [ref=e31]:
            - link "Événements" [ref=e32] [cursor=pointer]:
              - /url: /admin/events
            - link "Catalogues et services" [ref=e36] [cursor=pointer]:
              - /url: /admin/services
        - generic [ref=e42]:
          - paragraph [ref=e43]: Système
          - link "Mes droits" [ref=e45] [cursor=pointer]:
            - /url: /admin/mes-droits
        - link "Retour au site" [ref=e51] [cursor=pointer]:
          - /url: /
      - generic [ref=e56]:
        - link "Awa Ndiaye Administrateur" [ref=e57] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e58]: AN
          - generic [ref=e59]:
            - generic [ref=e60]: Awa Ndiaye
            - generic [ref=e61]: Administrateur
        - button "Se déconnecter" [ref=e62] [cursor=pointer]
  - generic [aria-hidden] [ref=e67]:
    - generic [ref=e68]:
      - banner [ref=e69]:
        - generic [ref=e70]:
          - button [expanded] [ref=e71] [cursor=pointer]
          - link [ref=e77] [cursor=pointer]:
            - /url: /
        - generic [ref=e80]:
          - button [ref=e82] [cursor=pointer]:
            - generic [ref=e86]: "61"
          - button [ref=e88] [cursor=pointer]
          - link [ref=e92] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e93]: AN
            - generic [ref=e94]: Mon profil (Awa Ndiaye)
      - main [ref=e95]:
        - generic [ref=e97]:
          - generic [ref=e99]:
            - generic [ref=e100]:
              - heading [level=1] [ref=e101]: Tableau de bord
              - paragraph [ref=e102]: Dossiers à traiter et vue d’ensemble de la plateforme.
            - generic [ref=e103]:
              - status [ref=e104]: Mise à jour en cours
              - button [ref=e106] [cursor=pointer]:
                - generic [ref=e113]: Actualiser
          - region [ref=e114]:
            - heading [level=2] [ref=e115]: À faire aujourd’hui
            - list [ref=e116]:
              - listitem [ref=e117]:
                - paragraph [ref=e124]: 3 événements à valider
                - paragraph [ref=e125]: Le plus ancien attend depuis 6 jours.
                - link [ref=e126] [cursor=pointer]:
                  - /url: /admin/events?status=EN_ATTENTE
                  - generic [ref=e127]: Examiner les événements
            - list [ref=e131]:
              - listitem [ref=e132]: "Événements suspendus : aucun"
              - listitem [ref=e136]: "Écarts de caisse à valider : aucun"
            - paragraph [ref=e140]:
              - text: Vous ne voyez que ce que vos droits vous permettent de traiter.
              - link [ref=e141] [cursor=pointer]:
                - /url: /admin/mes-droits
                - text: Voir mes droits
          - region [ref=e142]:
            - heading [level=2] [ref=e143]: Indicateurs
            - paragraph [ref=e144]: "Action non autorisée : votre compte n’a pas la permission « Consulter les statistiques »."
          - region [ref=e145]:
            - heading [level=2] [ref=e146]: Raccourcis
            - generic [ref=e147]:
              - link [ref=e148] [cursor=pointer]:
                - /url: /admin/referral
                - generic [ref=e153]: Parrainage et ambassadeurs
              - link [ref=e154] [cursor=pointer]:
                - /url: /admin/services
                - generic [ref=e160]: Catalogues et services
    - navigation:
      - generic [ref=e161]:
        - link [ref=e163] [cursor=pointer]:
          - /url: /admin/dashboard
          - generic [ref=e170]: Accueil
        - link [ref=e171] [cursor=pointer]:
          - /url: /admin/events
          - generic [ref=e175]: Validation
  - alert [ref=e176]
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
      |                                                                   ^ Error: contrôles bloquants de admin-menu-droits-limites__mobile__clair.png
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