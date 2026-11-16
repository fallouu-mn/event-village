# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · fumee-superadmin >> admin-creation-administrateur — Administration — créer un compte : rôle « Administrateur » (aucun droit tant qu’on ne lui en donne pas)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de admin-creation-administrateur__mobile__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "1 cible(s) < 44 px : a « Retour à l’accueil de l’administration » 42×44",
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
        - generic [ref=e16]:
          - button "Notifications, 58 non lues" [ref=e18] [cursor=pointer]:
            - generic [ref=e22]: "58"
          - button "Basculer le thème" [pressed] [ref=e24] [cursor=pointer]
          - link "Mon profil (Elhadji SuperAdmin)" [ref=e32] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e33]: ES
      - main [ref=e35]:
        - generic [ref=e37]:
          - generic [ref=e38]:
            - generic [ref=e39]:
              - link "Retour à l’accueil de l’administration" [ref=e40] [cursor=pointer]:
                - /url: /admin/dashboard
              - heading "Comptes et administrateurs" [level=1] [ref=e44]
            - generic [ref=e45]:
              - button "Actualiser" [ref=e46] [cursor=pointer]
              - button "Créer un compte" [ref=e53] [cursor=pointer]
          - generic [ref=e59]:
            - generic [ref=e60]:
              - searchbox "Rechercher un compte" [ref=e65]
              - group "Filtrer par rôle" [ref=e66]:
                - button "Tous" [pressed] [ref=e67] [cursor=pointer]
                - button "Superadmin" [ref=e68] [cursor=pointer]
                - button "Administrateur" [ref=e69] [cursor=pointer]
                - button "Partenaire" [ref=e70] [cursor=pointer]
                - button "Contrôleur" [ref=e71] [cursor=pointer]
                - button "Client" [ref=e72] [cursor=pointer]
            - paragraph [ref=e79]: Aucun compte ne correspond à cette recherche.
    - navigation "Navigation rapide" [ref=e80]:
      - generic [ref=e81]:
        - link "Accueil" [ref=e82] [cursor=pointer]:
          - /url: /admin/dashboard
        - link "Validation" [ref=e89] [cursor=pointer]:
          - /url: /admin/events
        - link "Comptes" [ref=e93] [cursor=pointer]:
          - /url: /admin/users
        - link "Finance" [ref=e100] [cursor=pointer]:
          - /url: /admin/finance
        - link "Audit" [ref=e104] [cursor=pointer]:
          - /url: /admin/audit
  - alert [ref=e108]
  - dialog [ref=e111]:
    - generic [ref=e112]:
      - generic [ref=e118]:
        - heading "Créer un compte" [level=2] [ref=e119]
        - paragraph [ref=e120]: Le compte est actif tout de suite ; le titulaire choisit lui-même son mot de passe.
      - button "Fermer" [ref=e121] [cursor=pointer]
    - generic [ref=e127]:
      - generic [ref=e128]:
        - generic [ref=e129]:
          - generic [ref=e131]:
            - text: Prénom*
            - generic [ref=e132]: (obligatoire)
          - textbox "Prénom (obligatoire)" [ref=e133]:
            - /placeholder: "Ex : Moussa"
        - generic [ref=e134]:
          - generic [ref=e136]:
            - text: Nom*
            - generic [ref=e137]: (obligatoire)
          - textbox "Nom (obligatoire)" [ref=e138]:
            - /placeholder: "Ex : Diop"
      - generic [ref=e139]:
        - generic [ref=e141]:
          - text: Numéro de téléphone (Sénégal)*
          - generic [ref=e142]: (obligatoire)
        - textbox "Numéro de téléphone (Sénégal) (obligatoire)" [ref=e143]:
          - /placeholder: 77 123 45 67
      - generic [ref=e144]:
        - generic [ref=e145]: Email (facultatif)
        - textbox "Email (facultatif)" [ref=e147]:
          - /placeholder: contact@domaine.sn
      - generic [ref=e148]:
        - paragraph [ref=e149]: Mot de passe choisi par le titulaire
        - paragraph [ref=e150]: Le titulaire reçoit par SMS un lien d’activation valable 24 heures pour choisir son mot de passe.
      - group "Rôle" [ref=e151]:
        - generic [ref=e153]:
          - button "Contrôleur Scanne les billets des événements où un partenaire l’affecte" [ref=e154] [cursor=pointer]:
            - generic [ref=e161]:
              - generic [ref=e162]: Contrôleur
              - generic [ref=e163]: Scanne les billets des événements où un partenaire l’affecte
          - button "Administrateur Agit selon les droits que vous lui donnez" [active] [pressed] [ref=e164] [cursor=pointer]:
            - generic [ref=e169]:
              - generic [ref=e170]: Administrateur
              - generic [ref=e171]: Agit selon les droits que vous lui donnez
          - button "Superadmin Tous les droits, dont les réglages et la création d’administrateurs" [ref=e172] [cursor=pointer]:
            - generic [ref=e176]:
              - generic [ref=e177]: Superadmin
              - generic [ref=e178]: Tous les droits, dont les réglages et la création d’administrateurs
          - button "Client Achète des billets, sans accès professionnel" [ref=e179] [cursor=pointer]:
            - generic [ref=e183]:
              - generic [ref=e184]: Client
              - generic [ref=e185]: Achète des billets, sans accès professionnel
      - paragraph [ref=e186]:
        - generic [ref=e189]: "Un administrateur n’a aucun droit tant que vous ne lui en donnez pas : vous les choisissez juste après la création."
      - generic [ref=e190]:
        - button "Annuler" [ref=e191] [cursor=pointer]
        - button "Créer le compte Administrateur" [ref=e193] [cursor=pointer]
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
      |                                                                   ^ Error: contrôles bloquants de admin-creation-administrateur__mobile__sombre.png
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