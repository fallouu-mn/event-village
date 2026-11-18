# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · fumee-superadmin >> admin-cloture-motif — Administration — clôture d’un événement suspendu : champ « Motif de la clôture » (fiche imposée, rien n’est envoyé)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de admin-cloture-motif__mobile__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "erreur de console : Failed to load resource: the server responded with a status of 404 (Not Found) (http://localhost:3000/events/00000000-0000-4000-8000-000000000931?_rsc=EDka50BnZCHh3mjx)",
+   "requête en échec : 404 GET localhost:3000/events/00000000-0000-4000-8000-000000000931?_rsc=EDka50BnZCHh3mjx",
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
          - button "Notifications, 58 non lues" [ref=e15] [cursor=pointer]:
            - generic [ref=e19]: "58"
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
                - heading "Contrôle à l’entrée" [level=2] [ref=e157]
                - paragraph [ref=e158]: "Une seule entrée : chaque contrôleur laisse entrer toutes les catégories."
            - generic [ref=e159]:
              - region [ref=e160]:
                - heading "Affiche" [level=2] [ref=e161]
                - generic [ref=e162]: Aucune affiche
              - region [ref=e168]:
                - heading "Organisateur" [level=2] [ref=e169]
                - generic [ref=e170]:
                  - generic [ref=e171]:
                    - term [ref=e172]: Structure
                    - definition [ref=e178]:
                      - text: Ndar Événements
                      - generic [ref=e179]: Compte validé
                  - generic [ref=e182]:
                    - term [ref=e183]: Responsable
                    - definition [ref=e190]: Mariama Sall
                  - generic [ref=e191]:
                    - term [ref=e192]: Téléphone
                    - definition [ref=e196]:
                      - link "+221771234567" [ref=e197] [cursor=pointer]:
                        - /url: tel:+221771234567
                  - generic [ref=e198]:
                    - term [ref=e199]: Ville
                    - definition [ref=e204]: Saint-Louis
              - region [ref=e205]:
                - heading "Historique des statuts" [level=2] [ref=e206]
                - list [ref=e207]:
                  - listitem [ref=e208]:
                    - paragraph [ref=e210]: "Création : Brouillon"
                    - paragraph [ref=e211]: Mariama Sall (Partenaire) · Création
                    - paragraph [ref=e212]:
                      - time [ref=e213]: sam. 10 oct. 2026 à 09:00
                  - listitem [ref=e214]:
                    - paragraph [ref=e216]: Publié → Suspendu
                    - paragraph [ref=e217]: Ousmane Diallo (Administration) · Changement de statut
                    - paragraph [ref=e218]:
                      - time [ref=e219]: dim. 1 nov. 2026 à 18:00
                    - blockquote [ref=e220]:
                      - generic [ref=e221]: "Motif :"
                      - text: "Lieu fermé par arrêté préfectoral : en attente d’une nouvelle date."
    - navigation "Navigation rapide" [ref=e222]:
      - generic [ref=e223]:
        - link "Accueil" [ref=e224] [cursor=pointer]:
          - /url: /admin/dashboard
        - link "Validation" [ref=e231] [cursor=pointer]:
          - /url: /admin/events
        - link "Comptes" [ref=e235] [cursor=pointer]:
          - /url: /admin/users
        - link "Finance" [ref=e242] [cursor=pointer]:
          - /url: /admin/finance
        - link "Audit" [ref=e246] [cursor=pointer]:
          - /url: /admin/audit
  - alert [ref=e250]
  - dialog [ref=e253]:
    - generic [ref=e254]:
      - generic [ref=e256]:
        - heading "Clore l’événement ?" [level=2] [ref=e257]
        - paragraph [ref=e258]: "L’événement passe « Terminé », sans annulation : personne n’est remboursé automatiquement. Prévenus : le partenaire par SMS, notification et email (si une adresse vérifiée), avec votre motif ; les détenteurs de billets par SMS, notification et email (si une adresse vérifiée), sans votre motif. Si une caisse est encore ouverte, le partenaire reçoit aussi une alerte par SMS. Si les participants doivent être remboursés, choisissez plutôt « Annuler l’événement »."
      - button "Fermer" [ref=e259] [cursor=pointer]
    - generic [ref=e266]:
      - generic [ref=e267]:
        - generic [ref=e268]:
          - text: Motif de la clôture*
          - generic [ref=e269]: (obligatoire)
        - generic [ref=e270]: 0 / 500
      - textbox "Motif de la clôture (obligatoire)" [active] [ref=e271]
      - paragraph [ref=e272]: Au moins 3 caractères. Ce motif est communiqué à l’organisateur et reste dans l’historique.
    - generic [ref=e273]:
      - button "Annuler" [ref=e274] [cursor=pointer]
      - button "Clore l’événement" [ref=e276] [cursor=pointer]
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
      |                                                                   ^ Error: contrôles bloquants de admin-cloture-motif__mobile__sombre.png
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