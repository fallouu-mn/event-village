# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · fumee-superadmin >> admin-droits-apres-creation — Administration — après la création d’un administrateur : ses droits, profil « Validation » choisi (création simulée)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de admin-droits-apres-creation__mobile__sombre.png

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
  - status [ref=e108]:
    - generic [ref=e113]:
      - paragraph [ref=e114]: Succès
      - paragraph [ref=e115]: "Compte Administrateur de Awa Ndiaye créé. Le lien d’activation est parti par SMS (valable 24 heures). Il n’a encore aucun droit : choisissez-les maintenant."
    - button "Fermer le message" [ref=e116] [cursor=pointer]
  - alert [ref=e121]
  - dialog [ref=e124]:
    - generic [ref=e125]:
      - generic [ref=e132]:
        - heading "Droits de Awa Ndiaye" [level=2] [ref=e133]
        - paragraph [ref=e134]: Effet immédiat ; la personne voit ses nouveaux écrans en rechargeant la page. Elle n’est pas prévenue.
      - button "Fermer" [ref=e135] [cursor=pointer]
    - generic [ref=e141]:
      - paragraph [ref=e142]: Partez d’un profil prêt, puis ajustez les cases. Un droit qui modifie amène toujours le droit de voir.
      - generic [ref=e143]:
        - group "Profils prêts" [ref=e144]:
          - button "Validation" [active] [ref=e145] [cursor=pointer]
          - button "Support client" [ref=e147] [cursor=pointer]
          - button "Finance" [ref=e149] [cursor=pointer]
          - button "Lecture seule" [ref=e151] [cursor=pointer]
          - button "Aucun droit" [ref=e153] [cursor=pointer]
        - generic [ref=e155]:
          - group "Événements et partenaires" [ref=e156]:
            - generic [ref=e158] [cursor=pointer]:
              - checkbox "Consulter les événements Voir les événements, leur pilotage, leurs équipes, leurs caisses et les catalogues." [checked] [ref=e159]
              - generic [ref=e160]:
                - generic [ref=e161]: Consulter les événements
                - generic [ref=e162]: Voir les événements, leur pilotage, leurs équipes, leurs caisses et les catalogues.
            - generic [ref=e163] [cursor=pointer]:
              - checkbox "Gérer les événements Valider, refuser, suspendre, réactiver, clore ou annuler un événement ; valider un écart de caisse." [checked] [ref=e164]
              - generic [ref=e165]:
                - generic [ref=e166]: Gérer les événements
                - generic [ref=e167]: Valider, refuser, suspendre, réactiver, clore ou annuler un événement ; valider un écart de caisse.
            - generic [ref=e168] [cursor=pointer]:
              - 'checkbox "Consulter les partenaires et leurs contacts Voir les candidatures et les dossiers des partenaires : pièces, NINEA, contacts." [checked] [ref=e169]'
              - generic [ref=e170]:
                - generic [ref=e171]: Consulter les partenaires et leurs contacts
                - generic [ref=e172]: "Voir les candidatures et les dossiers des partenaires : pièces, NINEA, contacts."
            - generic [ref=e173] [cursor=pointer]:
              - checkbox "Valider les partenaires Valider, refuser ou réactiver un partenaire. Le partenaire en est prévenu." [checked] [ref=e174]
              - generic [ref=e175]:
                - generic [ref=e176]: Valider les partenaires
                - generic [ref=e177]: Valider, refuser ou réactiver un partenaire. Le partenaire en est prévenu.
            - generic [ref=e178] [cursor=pointer]:
              - 'checkbox "Suspendre les partenaires Suspendre un partenaire. Attention : seul le Superadmin peut le faire, ce droit ne suffit pas à un administrateur." [ref=e179]'
              - generic [ref=e180]:
                - generic [ref=e181]: Suspendre les partenaires
                - generic [ref=e182]: "Suspendre un partenaire. Attention : seul le Superadmin peut le faire, ce droit ne suffit pas à un administrateur."
          - group "Comptes et messages" [ref=e183]:
            - generic [ref=e185] [cursor=pointer]:
              - checkbox "Consulter les comptes Voir la liste des comptes et les chercher." [ref=e186]
              - generic [ref=e187]:
                - generic [ref=e188]: Consulter les comptes
                - generic [ref=e189]: Voir la liste des comptes et les chercher.
            - generic [ref=e190] [cursor=pointer]:
              - checkbox "Gérer les comptes Créer, suspendre, réactiver ou supprimer des comptes de clients et de contrôleurs, jamais un administrateur." [ref=e191]
              - generic [ref=e192]:
                - generic [ref=e193]: Gérer les comptes
                - generic [ref=e194]: Créer, suspendre, réactiver ou supprimer des comptes de clients et de contrôleurs, jamais un administrateur.
            - generic [ref=e195] [cursor=pointer]:
              - checkbox "Consulter les envois de messages Voir les envois de SMS, d’emails et de notifications, et recevoir leurs alertes." [ref=e196]
              - generic [ref=e197]:
                - generic [ref=e198]: Consulter les envois de messages
                - generic [ref=e199]: Voir les envois de SMS, d’emails et de notifications, et recevoir leurs alertes.
            - generic [ref=e200] [cursor=pointer]:
              - checkbox "Relancer les envois de messages Relancer un envoi en échec." [ref=e201]
              - generic [ref=e202]:
                - generic [ref=e203]: Relancer les envois de messages
                - generic [ref=e204]: Relancer un envoi en échec.
            - generic [ref=e205] [cursor=pointer]:
              - checkbox "Gérer les communications Préparer des campagnes (brouillons seulement)." [ref=e206]
              - generic [ref=e207]:
                - generic [ref=e208]: Gérer les communications
                - generic [ref=e209]: Préparer des campagnes (brouillons seulement).
          - group "Argent" [ref=e210]:
            - generic [ref=e212] [cursor=pointer]:
              - 'checkbox "Consulter les paiements Voir la finance : ce que gagne Event Village, ce qui est dû, les paiements et les créances." [ref=e213]'
              - generic [ref=e214]:
                - generic [ref=e215]: Consulter les paiements
                - generic [ref=e216]: "Voir la finance : ce que gagne Event Village, ce qui est dû, les paiements et les créances."
            - generic [ref=e217] [cursor=pointer]:
              - 'checkbox "Gérer les remboursements Traiter les versements à reprendre : renvoyer, marquer versé ou constater non versé." [ref=e218]'
              - generic [ref=e219]:
                - generic [ref=e220]: Gérer les remboursements
                - generic [ref=e221]: "Traiter les versements à reprendre : renvoyer, marquer versé ou constater non versé."
            - generic [ref=e222] [cursor=pointer]:
              - checkbox "Gérer le parrainage Voir les taux du parrainage." [ref=e223]
              - generic [ref=e224]:
                - generic [ref=e225]: Gérer le parrainage
                - generic [ref=e226]: Voir les taux du parrainage.
            - generic [ref=e227] [cursor=pointer]:
              - 'checkbox "Consulter les statistiques Voir les indicateurs de l’accueil : volume, revenu, nombre de comptes." [ref=e228]'
              - generic [ref=e229]:
                - generic [ref=e230]: Consulter les statistiques
                - generic [ref=e231]: "Voir les indicateurs de l’accueil : volume, revenu, nombre de comptes."
          - group "Terrain et réglages" [ref=e232]:
            - generic [ref=e234] [cursor=pointer]:
              - checkbox "Contrôler les entrées et tenir une caisse Contrôler les entrées et tenir une caisse sur un événement." [ref=e235]
              - generic [ref=e236]:
                - generic [ref=e237]: Contrôler les entrées et tenir une caisse
                - generic [ref=e238]: Contrôler les entrées et tenir une caisse sur un événement.
            - generic [ref=e239] [cursor=pointer]:
              - checkbox "Lire les réglages Lire les réglages de la plateforme ; seul le Superadmin les change." [ref=e240]
              - generic [ref=e241]:
                - generic [ref=e242]: Lire les réglages
                - generic [ref=e243]: Lire les réglages de la plateforme ; seul le Superadmin les change.
      - generic [ref=e244]:
        - button "Annuler" [ref=e245] [cursor=pointer]
        - button "Enregistrer les droits" [ref=e247] [cursor=pointer]
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
      |                                                                   ^ Error: contrôles bloquants de admin-droits-apres-creation__mobile__sombre.png
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