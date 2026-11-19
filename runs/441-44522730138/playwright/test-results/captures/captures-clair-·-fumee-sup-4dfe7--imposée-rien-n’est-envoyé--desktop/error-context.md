# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · fumee-superadmin >> admin-cloture-motif — Administration — clôture d’un événement suspendu : champ « Motif de la clôture » (fiche imposée, rien n’est envoyé)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de admin-cloture-motif__ordinateur__clair.png

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
- generic [ref=e1]:
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
            - link "Comptes" [ref=e29] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=e36] [cursor=pointer]:
              - /url: /admin/services
        - generic [ref=e42]:
          - paragraph [ref=e43]: Finances
          - link "Finance" [ref=e45] [cursor=pointer]:
            - /url: /admin/finance
        - generic [ref=e49]:
          - paragraph [ref=e50]: Engagement
          - generic [ref=e51]:
            - link "Parrainage" [ref=e52] [cursor=pointer]:
              - /url: /admin/referral
            - link "Campagnes" [ref=e57] [cursor=pointer]:
              - /url: /admin/communications
            - link "À la une" [ref=e62] [cursor=pointer]:
              - /url: /admin/a-la-une
        - generic [ref=e66]:
          - paragraph [ref=e67]: Système
          - generic [ref=e68]:
            - link "Réglages" [ref=e69] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Journal d’audit" [ref=e74] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=e79] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=e86] [cursor=pointer]:
              - /url: /scan
            - link "Sécurité du compte" [ref=e94] [cursor=pointer]:
              - /url: /admin/securite
        - link "Retour au site" [ref=e100] [cursor=pointer]:
          - /url: /
      - generic [ref=e105]:
        - link "Elhadji SuperAdmin Super-administrateur" [ref=e106] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e107]: ES
          - generic [ref=e108]:
            - generic [ref=e109]: Elhadji SuperAdmin
            - generic [ref=e110]: Super-administrateur
        - generic [ref=e111]:
          - button "Se déconnecter" [ref=e112] [cursor=pointer]
          - button "Basculer le thème" [ref=e117] [cursor=pointer]
    - generic [ref=e121]:
      - banner [ref=e122]:
        - link "Rechercher un événement…" [ref=e124] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 58 non lues" [ref=e131] [cursor=pointer]:
          - generic [ref=e135]: "58"
      - main [ref=e136]:
        - generic [ref=e138]:
          - generic [ref=e139]:
            - link "Retour aux événements" [ref=e141] [cursor=pointer]:
              - /url: /admin/events
            - generic [ref=e146]:
              - generic [ref=e147]:
                - generic [ref=e148]:
                  - 'generic "Mis en pause par l’équipe Event Village : la vente et le contrôle d’accès sont arrêtés." [ref=e149]': Suspendu
                  - generic [ref=e152]: Festivals
                - heading "Festival des Lumières de Saint-Louis" [level=1] [ref=e153]
                - paragraph [ref=e154]: Ndar Événements · dim. 1 nov. 2026 à 20:00
              - generic [ref=e155]:
                - button "Clore l’événement" [ref=e156] [cursor=pointer]
                - link "Ouvrir le pilotage" [ref=e158] [cursor=pointer]:
                  - /url: /partner/events/00000000-0000-4000-8000-000000000931
                - link "Équipe de cet événement" [ref=e164] [cursor=pointer]:
                  - /url: /partner/events/00000000-0000-4000-8000-000000000931?tab=equipe
                - link "Page publique" [ref=e172] [cursor=pointer]:
                  - /url: /events/00000000-0000-4000-8000-000000000931
          - status [ref=e179]:
            - generic [ref=e184]:
              - paragraph [ref=e185]: Motif de la suspension
              - generic [ref=e186]:
                - paragraph [ref=e187]: "Lieu fermé par arrêté préfectoral : en attente d’une nouvelle date."
                - paragraph [ref=e188]:
                  - text: Communiqué à l’organisateur le
                  - time [ref=e189]: dim. 1 nov. 2026 à 18:00
                  - text: .
          - generic [ref=e190]:
            - generic [ref=e191]:
              - region [ref=e192]:
                - heading "Dates et lieu" [level=2] [ref=e193]
                - generic [ref=e194]:
                  - generic [ref=e195]:
                    - term [ref=e196]: Début
                    - definition [ref=e200]: dim. 1 nov. 2026 à 20:00
                  - generic [ref=e201]:
                    - term [ref=e202]: Fin
                    - definition [ref=e207]: lun. 2 nov. 2026 à 02:00
                  - generic [ref=e208]:
                    - term [ref=e209]: Lieu
                    - definition [ref=e214]:
                      - text: Quai Henri Jay, Saint-Louis
                      - generic [ref=e215]: Aucun repère sur la carte.
                  - generic [ref=e216]:
                    - term [ref=e217]: Jauge déclarée
                    - definition [ref=e224]: 800 personnes
              - region [ref=e225]:
                - heading "Description" [level=2] [ref=e226]
                - paragraph [ref=e227]: Trois scènes sur les quais, musiques mandingues et mbalax jusqu’à l’aube.
              - region [ref=e228]:
                - heading "Programme" [level=2] [ref=e229]
                - paragraph [ref=e230]: Aucun programme renseigné.
              - region [ref=e231]:
                - heading "Catégories et prix" [level=2] [ref=e232]
                - table [ref=e235]:
                  - caption [ref=e236]: Catégories de billets, tous canaux et inactives comprises
                  - rowgroup [ref=e237]:
                    - row [ref=e238]:
                      - columnheader "Catégorie" [ref=e239]
                      - columnheader "Prix" [ref=e240]
                      - columnheader "Quota" [ref=e241]
                      - columnheader "Période de vente" [ref=e242]
                      - columnheader "Par commande" [ref=e243]
                      - columnheader "Au contrôle" [ref=e244]
                      - columnheader "Canaux et état" [ref=e245]
                  - rowgroup [ref=e246]:
                    - row [ref=e247]:
                      - cell "Standard" [ref=e248]
                      - cell "5 000 F CFA" [ref=e251]
                      - cell "600" [ref=e252]
                      - cell "Dès la publication · jusqu’à l’événement" [ref=e253]
                      - cell "10 au plus" [ref=e255]
                      - cell "Sans couleur Aucune consigne" [ref=e256]:
                        - generic [ref=e257]:
                          - generic [ref=e258]: Sans couleur
                          - generic [ref=e260]: Aucune consigne
                      - cell "En ligne et au guichet Active" [ref=e261]:
                        - generic [ref=e262]:
                          - generic [ref=e263]: En ligne et au guichet
                          - generic [ref=e265]: Active
              - region [ref=e267]:
                - heading "Contrôle à l’entrée" [level=2] [ref=e268]
                - paragraph [ref=e269]: "Une seule entrée : chaque contrôleur laisse entrer toutes les catégories."
            - generic [ref=e270]:
              - region [ref=e271]:
                - heading "Affiche" [level=2] [ref=e272]
                - generic [ref=e273]: Aucune affiche
              - region [ref=e279]:
                - heading "Organisateur" [level=2] [ref=e280]
                - generic [ref=e281]:
                  - generic [ref=e282]:
                    - term [ref=e283]: Structure
                    - definition [ref=e289]:
                      - text: Ndar Événements
                      - generic [ref=e290]: Compte validé
                  - generic [ref=e293]:
                    - term [ref=e294]: Responsable
                    - definition [ref=e301]: Mariama Sall
                  - generic [ref=e302]:
                    - term [ref=e303]: Téléphone
                    - definition [ref=e307]:
                      - link "+221771234567" [ref=e308] [cursor=pointer]:
                        - /url: tel:+221771234567
                  - generic [ref=e309]:
                    - term [ref=e310]: Ville
                    - definition [ref=e315]: Saint-Louis
              - region [ref=e316]:
                - heading "Historique des statuts" [level=2] [ref=e317]
                - list [ref=e318]:
                  - listitem [ref=e319]:
                    - paragraph [ref=e321]: "Création : Brouillon"
                    - paragraph [ref=e322]: Mariama Sall (Partenaire) · Création
                    - paragraph [ref=e323]:
                      - time [ref=e324]: sam. 10 oct. 2026 à 09:00
                  - listitem [ref=e325]:
                    - paragraph [ref=e327]: Publié → Suspendu
                    - paragraph [ref=e328]: Ousmane Diallo (Administration) · Changement de statut
                    - paragraph [ref=e329]:
                      - time [ref=e330]: dim. 1 nov. 2026 à 18:00
                    - blockquote [ref=e331]:
                      - generic [ref=e332]: "Motif :"
                      - text: "Lieu fermé par arrêté préfectoral : en attente d’une nouvelle date."
  - alert [ref=e333]
  - dialog [ref=e336]:
    - generic [ref=e337]:
      - generic [ref=e339]:
        - heading "Clore l’événement ?" [level=2] [ref=e340]
        - paragraph [ref=e341]: "L’événement passe « Terminé », sans annulation : personne n’est remboursé automatiquement. Prévenus : le partenaire par SMS, notification et email (si une adresse vérifiée), avec votre motif ; les détenteurs de billets par SMS, notification et email (si une adresse vérifiée), sans votre motif. Si une caisse est encore ouverte, le partenaire reçoit aussi une alerte par SMS. Si les participants doivent être remboursés, choisissez plutôt « Annuler l’événement »."
      - button "Fermer" [ref=e342] [cursor=pointer]
    - generic [ref=e349]:
      - generic [ref=e350]:
        - generic [ref=e351]:
          - text: Motif de la clôture*
          - generic [ref=e352]: (obligatoire)
        - generic [ref=e353]: 0 / 500
      - textbox "Motif de la clôture (obligatoire)" [active] [ref=e354]
      - paragraph [ref=e355]: Au moins 3 caractères. Ce motif est communiqué à l’organisateur et reste dans l’historique.
    - generic [ref=e356]:
      - button "Annuler" [ref=e357] [cursor=pointer]
      - button "Clore l’événement" [ref=e359] [cursor=pointer]
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
      |                                                                   ^ Error: contrôles bloquants de admin-cloture-motif__ordinateur__clair.png
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