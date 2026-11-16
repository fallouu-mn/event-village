# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · fumee-superadmin >> admin-droits-apres-creation — Administration — après la création d’un administrateur : ses droits, profil « Validation » choisi (création simulée)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de admin-droits-apres-creation__mobile__clair.png

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
          - button "Basculer le thème" [ref=e24] [cursor=pointer]
          - link "Mon profil (Elhadji SuperAdmin)" [ref=e28] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e29]: ES
      - main [ref=e31]:
        - generic [ref=e33]:
          - generic [ref=e34]:
            - generic [ref=e35]:
              - link "Retour à l’accueil de l’administration" [ref=e36] [cursor=pointer]:
                - /url: /admin/dashboard
              - heading "Comptes et administrateurs" [level=1] [ref=e40]
            - generic [ref=e41]:
              - button "Actualiser" [ref=e42] [cursor=pointer]
              - button "Créer un compte" [ref=e49] [cursor=pointer]
          - generic [ref=e55]:
            - generic [ref=e56]:
              - searchbox "Rechercher un compte" [ref=e61]
              - group "Filtrer par rôle" [ref=e62]:
                - button "Tous" [pressed] [ref=e63] [cursor=pointer]
                - button "Superadmin" [ref=e64] [cursor=pointer]
                - button "Administrateur" [ref=e65] [cursor=pointer]
                - button "Partenaire" [ref=e66] [cursor=pointer]
                - button "Contrôleur" [ref=e67] [cursor=pointer]
                - button "Client" [ref=e68] [cursor=pointer]
            - paragraph [ref=e75]: Aucun compte ne correspond à cette recherche.
    - navigation "Navigation rapide" [ref=e76]:
      - generic [ref=e77]:
        - link "Accueil" [ref=e78] [cursor=pointer]:
          - /url: /admin/dashboard
        - link "Validation" [ref=e85] [cursor=pointer]:
          - /url: /admin/events
        - link "Comptes" [ref=e89] [cursor=pointer]:
          - /url: /admin/users
        - link "Finance" [ref=e96] [cursor=pointer]:
          - /url: /admin/finance
        - link "Audit" [ref=e100] [cursor=pointer]:
          - /url: /admin/audit
  - status [ref=e104]:
    - generic [ref=e109]:
      - paragraph [ref=e110]: Succès
      - paragraph [ref=e111]: "Compte Administrateur de Awa Ndiaye créé. Le lien d’activation est parti par SMS (valable 24 heures). Il n’a encore aucun droit : choisissez-les maintenant."
    - button "Fermer le message" [ref=e112] [cursor=pointer]
  - alert [ref=e117]
  - dialog [ref=e120]:
    - generic [ref=e121]:
      - generic [ref=e128]:
        - heading "Droits de Awa Ndiaye" [level=2] [ref=e129]
        - paragraph [ref=e130]: Effet immédiat ; la personne voit ses nouveaux écrans en rechargeant la page. Elle n’est pas prévenue.
      - button "Fermer" [ref=e131] [cursor=pointer]
    - generic [ref=e137]:
      - paragraph [ref=e138]: Partez d’un profil prêt, puis ajustez les cases. Un droit qui modifie amène toujours le droit de voir.
      - generic [ref=e139]:
        - group "Profils prêts" [ref=e140]:
          - button "Validation" [active] [ref=e141] [cursor=pointer]
          - button "Support client" [ref=e143] [cursor=pointer]
          - button "Finance" [ref=e145] [cursor=pointer]
          - button "Lecture seule" [ref=e147] [cursor=pointer]
          - button "Aucun droit" [ref=e149] [cursor=pointer]
        - generic [ref=e151]:
          - group "Événements et partenaires" [ref=e152]:
            - generic [ref=e154] [cursor=pointer]:
              - checkbox "Consulter les événements Voir les événements, leur pilotage, leurs équipes, leurs caisses et les catalogues." [checked] [ref=e155]
              - generic [ref=e156]:
                - generic [ref=e157]: Consulter les événements
                - generic [ref=e158]: Voir les événements, leur pilotage, leurs équipes, leurs caisses et les catalogues.
            - generic [ref=e159] [cursor=pointer]:
              - checkbox "Gérer les événements Valider, refuser, suspendre, réactiver, clore ou annuler un événement ; valider un écart de caisse." [checked] [ref=e160]
              - generic [ref=e161]:
                - generic [ref=e162]: Gérer les événements
                - generic [ref=e163]: Valider, refuser, suspendre, réactiver, clore ou annuler un événement ; valider un écart de caisse.
            - generic [ref=e164] [cursor=pointer]:
              - 'checkbox "Consulter les partenaires et leurs contacts Voir les candidatures et les dossiers des partenaires : pièces, NINEA, contacts." [checked] [ref=e165]'
              - generic [ref=e166]:
                - generic [ref=e167]: Consulter les partenaires et leurs contacts
                - generic [ref=e168]: "Voir les candidatures et les dossiers des partenaires : pièces, NINEA, contacts."
            - generic [ref=e169] [cursor=pointer]:
              - checkbox "Valider les partenaires Valider, refuser ou réactiver un partenaire. Le partenaire en est prévenu." [checked] [ref=e170]
              - generic [ref=e171]:
                - generic [ref=e172]: Valider les partenaires
                - generic [ref=e173]: Valider, refuser ou réactiver un partenaire. Le partenaire en est prévenu.
            - generic [ref=e174] [cursor=pointer]:
              - 'checkbox "Suspendre les partenaires Suspendre un partenaire. Attention : seul le Superadmin peut le faire, ce droit ne suffit pas à un administrateur." [ref=e175]'
              - generic [ref=e176]:
                - generic [ref=e177]: Suspendre les partenaires
                - generic [ref=e178]: "Suspendre un partenaire. Attention : seul le Superadmin peut le faire, ce droit ne suffit pas à un administrateur."
          - group "Comptes et messages" [ref=e179]:
            - generic [ref=e181] [cursor=pointer]:
              - checkbox "Consulter les comptes Voir la liste des comptes et les chercher." [ref=e182]
              - generic [ref=e183]:
                - generic [ref=e184]: Consulter les comptes
                - generic [ref=e185]: Voir la liste des comptes et les chercher.
            - generic [ref=e186] [cursor=pointer]:
              - checkbox "Gérer les comptes Créer, suspendre, réactiver ou supprimer des comptes de clients et de contrôleurs, jamais un administrateur." [ref=e187]
              - generic [ref=e188]:
                - generic [ref=e189]: Gérer les comptes
                - generic [ref=e190]: Créer, suspendre, réactiver ou supprimer des comptes de clients et de contrôleurs, jamais un administrateur.
            - generic [ref=e191] [cursor=pointer]:
              - checkbox "Consulter les envois de messages Voir les envois de SMS, d’emails et de notifications, et recevoir leurs alertes." [ref=e192]
              - generic [ref=e193]:
                - generic [ref=e194]: Consulter les envois de messages
                - generic [ref=e195]: Voir les envois de SMS, d’emails et de notifications, et recevoir leurs alertes.
            - generic [ref=e196] [cursor=pointer]:
              - checkbox "Relancer les envois de messages Relancer un envoi en échec." [ref=e197]
              - generic [ref=e198]:
                - generic [ref=e199]: Relancer les envois de messages
                - generic [ref=e200]: Relancer un envoi en échec.
            - generic [ref=e201] [cursor=pointer]:
              - checkbox "Gérer les communications Préparer des campagnes (brouillons seulement)." [ref=e202]
              - generic [ref=e203]:
                - generic [ref=e204]: Gérer les communications
                - generic [ref=e205]: Préparer des campagnes (brouillons seulement).
          - group "Argent" [ref=e206]:
            - generic [ref=e208] [cursor=pointer]:
              - 'checkbox "Consulter les paiements Voir la finance : ce que gagne Event Village, ce qui est dû, les paiements et les créances." [ref=e209]'
              - generic [ref=e210]:
                - generic [ref=e211]: Consulter les paiements
                - generic [ref=e212]: "Voir la finance : ce que gagne Event Village, ce qui est dû, les paiements et les créances."
            - generic [ref=e213] [cursor=pointer]:
              - 'checkbox "Gérer les remboursements Traiter les versements à reprendre : renvoyer, marquer versé ou constater non versé." [ref=e214]'
              - generic [ref=e215]:
                - generic [ref=e216]: Gérer les remboursements
                - generic [ref=e217]: "Traiter les versements à reprendre : renvoyer, marquer versé ou constater non versé."
            - generic [ref=e218] [cursor=pointer]:
              - checkbox "Gérer le parrainage Voir les taux du parrainage." [ref=e219]
              - generic [ref=e220]:
                - generic [ref=e221]: Gérer le parrainage
                - generic [ref=e222]: Voir les taux du parrainage.
            - generic [ref=e223] [cursor=pointer]:
              - 'checkbox "Consulter les statistiques Voir les indicateurs de l’accueil : volume, revenu, nombre de comptes." [ref=e224]'
              - generic [ref=e225]:
                - generic [ref=e226]: Consulter les statistiques
                - generic [ref=e227]: "Voir les indicateurs de l’accueil : volume, revenu, nombre de comptes."
          - group "Terrain et réglages" [ref=e228]:
            - generic [ref=e230] [cursor=pointer]:
              - checkbox "Contrôler les entrées et tenir une caisse Contrôler les entrées et tenir une caisse sur un événement." [ref=e231]
              - generic [ref=e232]:
                - generic [ref=e233]: Contrôler les entrées et tenir une caisse
                - generic [ref=e234]: Contrôler les entrées et tenir une caisse sur un événement.
            - generic [ref=e235] [cursor=pointer]:
              - checkbox "Lire les réglages Lire les réglages de la plateforme ; seul le Superadmin les change." [ref=e236]
              - generic [ref=e237]:
                - generic [ref=e238]: Lire les réglages
                - generic [ref=e239]: Lire les réglages de la plateforme ; seul le Superadmin les change.
      - generic [ref=e240]:
        - button "Annuler" [ref=e241] [cursor=pointer]
        - button "Enregistrer les droits" [ref=e243] [cursor=pointer]
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
      |                                                                   ^ Error: contrôles bloquants de admin-droits-apres-creation__mobile__clair.png
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