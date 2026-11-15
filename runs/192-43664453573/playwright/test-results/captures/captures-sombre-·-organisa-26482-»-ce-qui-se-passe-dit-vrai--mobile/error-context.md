# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · organisateur >> partenaire-equipe-retirer — Équipe — fenêtre « Retirer de l’équipe » (ce qui se passe, dit vrai)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de partenaire-equipe-retirer__mobile__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "4 cible(s) < 44 px : a « Caisse ouverte » 102×20 ; a « 32 entrées · dernier scan à 02:10 » 220×20 ; a « 22 entrées · dernier scan à 02:06 » 222×20 ; a « 7 entrées · dernier scan à 02:02 » 214×20",
+   "axe-core color-contrast (serious, 5 nœud(s)) : Elements must meet minimum color contrast ratio thresholds",
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
          - button "Notifications, 99+ non lues" [ref=e18] [cursor=pointer]:
            - generic [ref=e22]: 99+
          - button "Basculer le thème" [pressed] [ref=e24] [cursor=pointer]
          - link "Mon profil (Mariama Ndiaye)" [ref=e32] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e33]: MN
      - main [ref=e35]:
        - generic [ref=e37]:
          - generic [ref=e40]:
            - heading "Équipe de contrôle" [level=1] [ref=e41]
            - paragraph [ref=e42]: "Les personnes qui scannent les billets à l’entrée de vos événements : leur état, leur porte et leurs espèces, événement par événement."
          - region [ref=e43]:
            - generic [ref=e44]:
              - generic [ref=e45]:
                - heading "Vos contrôleurs" [level=2] [ref=e46]
                - paragraph [ref=e47]: 4 contrôleurs · 4 prêts · 1 en attente
                - status [ref=e48]: Mis à jour à 02:21
              - generic [ref=e50]:
                - button "Actualiser" [ref=e51] [cursor=pointer]
                - button "Inviter un contrôleur" [ref=e59] [cursor=pointer]
            - status [ref=e65]:
              - generic [ref=e70]:
                - paragraph [ref=e71]: "« Grande soirée du Monument de la Renaissance » : porte sans contrôleur"
                - generic [ref=e72]: "Accès carré, Porte Sud : personne ne contrôle cette porte. Choisissez-la pour un contrôleur avec « Modifier »."
              - link "Modifier les portes et les couleurs" [ref=e74] [cursor=pointer]:
                - /url: /partner/events/2413feae-2d03-4e2c-8c18-f6d78e0b04cd?tab=equipe#portes-et-couleurs
            - group [ref=e76]:
              - generic "Portes et couleurs" [ref=e77] [cursor=pointer]
            - generic [ref=e78]:
              - generic [ref=e79]:
                - generic [ref=e80]:
                  - generic [ref=e81]: Rechercher
                  - textbox "Rechercher" [ref=e87]:
                    - /placeholder: Nom ou numéro
                - generic [ref=e88]:
                  - generic [ref=e89]: Événement
                  - combobox "Événement" [ref=e92] [cursor=pointer]:
                    - option "Tous les événements" [selected]
                    - option "Brunch électro des Almadies · 11 nov. 2026 à 12:00 (passé)"
                    - option "Nuit du Sabar — édition d’automne · 15 nov. 2026 à 03:00"
                    - option "Croisière musicale vers Gorée · 15 nov. 2026 à 06:15 (passé)"
                    - option "Concert des Lumières de Gorée · 15 nov. 2026 à 22:15"
                    - option "Grande soirée du Monument de la Renaissance · 18 nov. 2026 à 20:00"
                    - option "Festival Jazz sur le Fleuve · 27 nov. 2026 à 18:00"
                    - option "Soirée Kora & Lumières · 2 déc. 2026 à 20:30"
                    - option "Matinée gospel et chorales · 9 déc. 2026 à 10:00"
                    - option "Concert acoustique au jardin · 25 déc. 2026 à 19:00"
              - group "Filtrer l’équipe" [ref=e93]:
                - button "Tous" [pressed] [ref=e94] [cursor=pointer]
                - button "Prêts" [ref=e95] [cursor=pointer]
                - button "En attente" [ref=e96] [cursor=pointer]
                - button "Sans porte" [ref=e97] [cursor=pointer]
                - button "À relancer" [ref=e98] [cursor=pointer]
            - generic [ref=e99]:
              - generic [ref=e100]:
                - paragraph [ref=e101]: Vous (organisatrice) — toutes les portes
                - paragraph [ref=e102]: Vous scannez vos événements dont le contrôle est ouvert, à toutes les portes ou à une porte choisie, et vous vendez au guichet.
              - link "Scanner les billets" [ref=e103] [cursor=pointer]:
                - /url: /partner/scan
            - list "Contrôleurs de l’équipe" [ref=e106]:
              - listitem [ref=e107]:
                - generic [ref=e108]:
                  - generic [ref=e109]:
                    - generic [ref=e110]:
                      - paragraph [ref=e111]: Ibrahima Gueye
                      - paragraph [ref=e112]: Actif depuis le 15 nov. 2026
                    - generic [ref=e113]: Prêt
                  - generic [ref=e115]:
                    - paragraph [ref=e116]: 70 000 01 06
                    - generic [ref=e117]:
                      - link "Appeler Ibrahima Gueye" [ref=e118] [cursor=pointer]:
                        - /url: tel:+221700000106
                        - generic [ref=e121]: Appeler
                      - link "Écrire à Ibrahima Gueye sur WhatsApp" [ref=e122] [cursor=pointer]:
                        - /url: https://wa.me/221700000106?text=Bonjour%20Ibrahima%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2015%20nov.%202026%20%C3%A0%2003%3A00%2C%20Entr%C3%A9e%20principale.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                        - generic [ref=e125]: WhatsApp
                  - list "Événements de Ibrahima Gueye" [ref=e128]:
                    - listitem [ref=e129]:
                      - paragraph [ref=e130]: Nuit du Sabar — édition d’automne · 15 nov. 2026 à 03:00
                      - paragraph [ref=e131]: "Point d’entrée : Entrée principale"
                      - paragraph [ref=e132]: "Laisse entrer : toutes les catégories"
                      - generic [ref=e133]:
                        - generic [ref=e134]: Espèces autorisées
                        - generic [ref=e136]:
                          - link "Caisse ouverte" [ref=e137] [cursor=pointer]:
                            - /url: /partner/events/8b6ecf5e-05d6-4311-ab95-83819d4b2ed2?tab=caisse
                          - link "32 entrées · dernier scan à 02:10" [ref=e138] [cursor=pointer]:
                            - /url: /partner/events/8b6ecf5e-05d6-4311-ab95-83819d4b2ed2?tab=entrees
                      - button "Modifier" [ref=e140] [cursor=pointer]
                  - button "Retirer de l’équipe" [ref=e143] [cursor=pointer]
              - listitem [ref=e145]:
                - generic [ref=e146]:
                  - generic [ref=e147]:
                    - generic [ref=e148]:
                      - paragraph [ref=e149]: Lamine Cissé
                      - paragraph [ref=e150]: Actif depuis le 15 nov. 2026
                    - generic [ref=e151]: Prêt
                  - generic [ref=e153]:
                    - paragraph [ref=e154]: 70 000 01 08
                    - generic [ref=e155]:
                      - link "Appeler Lamine Cissé" [ref=e156] [cursor=pointer]:
                        - /url: tel:+221700000108
                        - generic [ref=e159]: Appeler
                      - link "Écrire à Lamine Cissé sur WhatsApp" [ref=e160] [cursor=pointer]:
                        - /url: https://wa.me/221700000108?text=Bonjour%20Lamine%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2015%20nov.%202026%20%C3%A0%2003%3A00%2C%20Entr%C3%A9e%20principale.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                        - generic [ref=e163]: WhatsApp
                  - generic [ref=e165]:
                    - list "Événements de Lamine Cissé" [ref=e166]:
                      - listitem [ref=e167]:
                        - paragraph [ref=e168]: Nuit du Sabar — édition d’automne · 15 nov. 2026 à 03:00
                        - paragraph [ref=e169]: "Point d’entrée : Entrée principale"
                        - paragraph [ref=e170]: "Laisse entrer : toutes les catégories"
                        - generic [ref=e171]:
                          - generic [ref=e172]: Espèces autorisées
                          - link "22 entrées · dernier scan à 02:06" [ref=e175] [cursor=pointer]:
                            - /url: /partner/events/8b6ecf5e-05d6-4311-ab95-83819d4b2ed2?tab=entrees
                        - button "Modifier" [ref=e177] [cursor=pointer]
                    - group [ref=e179]:
                      - generic "Événements passés" [ref=e180] [cursor=pointer]
                  - button "Retirer de l’équipe" [ref=e182] [cursor=pointer]
              - listitem [ref=e184]:
                - generic [ref=e185]:
                  - generic [ref=e186]:
                    - generic [ref=e187]:
                      - paragraph [ref=e188]: Mamadou Sall
                      - paragraph [ref=e189]: Actif depuis le 15 nov. 2026
                    - generic [ref=e190]: Prêt
                  - generic [ref=e192]:
                    - paragraph [ref=e193]: 70 000 01 10
                    - generic [ref=e194]:
                      - link "Appeler Mamadou Sall" [ref=e195] [cursor=pointer]:
                        - /url: tel:+221700000110
                        - generic [ref=e198]: Appeler
                      - link "Écrire à Mamadou Sall sur WhatsApp" [ref=e199] [cursor=pointer]:
                        - /url: https://wa.me/221700000110?text=Bonjour%20Mamadou%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Grande%20soir%C3%A9e%20du%20Monument%20de%20la%20Renaissance%20%C2%BB%20le%2018%20nov.%202026%20%C3%A0%2020%3A00%2C%20porte%20Porte%20Nord.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                        - generic [ref=e202]: WhatsApp
                  - list "Événements de Mamadou Sall" [ref=e205]:
                    - listitem [ref=e206]:
                      - paragraph [ref=e207]: Grande soirée du Monument de la Renaissance · 18 nov. 2026 à 20:00
                      - paragraph [ref=e208]: "Porte : Porte Nord · Entrée générale"
                      - generic [ref=e209]:
                        - generic [ref=e210]: "Laisse entrer :"
                        - generic [ref=e211]:
                          - generic [ref=e213]: SIMPLE
                          - generic [ref=e214]: ", pastille blanc"
                        - generic [ref=e215]:
                          - generic [ref=e217]: VIP
                          - generic [ref=e218]: ", pastille or"
                        - generic [ref=e219]:
                          - generic [ref=e221]: VVIP
                          - generic [ref=e222]: ", pastille violet"
                      - generic [ref=e223]:
                        - generic [ref=e224]: Sans espèces
                        - generic [ref=e226]: Aucune entrée
                      - button "Modifier" [ref=e229] [cursor=pointer]
                  - button "Retirer de l’équipe" [ref=e232] [cursor=pointer]
              - listitem [ref=e234]:
                - generic [ref=e235]:
                  - generic [ref=e236]:
                    - generic [ref=e237]:
                      - paragraph [ref=e238]: Seynabou Ba
                      - paragraph [ref=e239]: Actif depuis le 15 nov. 2026
                    - generic [ref=e240]: Prêt
                  - generic [ref=e242]:
                    - paragraph [ref=e243]: 70 000 01 07
                    - generic [ref=e244]:
                      - link "Appeler Seynabou Ba" [ref=e245] [cursor=pointer]:
                        - /url: tel:+221700000107
                        - generic [ref=e248]: Appeler
                      - link "Écrire à Seynabou Ba sur WhatsApp" [ref=e249] [cursor=pointer]:
                        - /url: https://wa.me/221700000107?text=Bonjour%20Seynabou%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2015%20nov.%202026%20%C3%A0%2003%3A00%2C%20Entr%C3%A9e%20VIP.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                        - generic [ref=e252]: WhatsApp
                  - list "Événements de Seynabou Ba" [ref=e255]:
                    - listitem [ref=e256]:
                      - paragraph [ref=e257]: Nuit du Sabar — édition d’automne · 15 nov. 2026 à 03:00
                      - paragraph [ref=e258]: "Point d’entrée : Entrée VIP"
                      - paragraph [ref=e259]: "Laisse entrer : toutes les catégories"
                      - generic [ref=e260]:
                        - generic [ref=e261]: Espèces autorisées
                        - link "7 entrées · dernier scan à 02:02" [ref=e264] [cursor=pointer]:
                          - /url: /partner/events/8b6ecf5e-05d6-4311-ab95-83819d4b2ed2?tab=entrees
                      - button "Modifier" [ref=e266] [cursor=pointer]
                  - button "Retirer de l’équipe" [ref=e269] [cursor=pointer]
            - region [ref=e271]:
              - heading "Invitations" [level=3] [ref=e272]
              - list "Invitations" [ref=e273]:
                - listitem [ref=e274]:
                  - generic [ref=e275]:
                    - generic [ref=e276]:
                      - paragraph [ref=e277]: Fa*** M***
                      - generic [ref=e278]: Invitation envoyée
                    - paragraph [ref=e280]: "Envoyée le dim. 15 nov. 2026 à 02:13. Fa*** M*** doit accepter avant le mer. 18 nov. 2026 à 02:13. Événements : « Festival Jazz sur le Fleuve »."
                  - generic [ref=e282]:
                    - button "Renvoyer l’invitation" [ref=e283] [cursor=pointer]
                    - button "Annuler l’invitation" [ref=e285] [cursor=pointer]
    - navigation "Navigation rapide" [ref=e287]:
      - generic [ref=e288]:
        - link "Accueil" [ref=e289] [cursor=pointer]:
          - /url: /partner/dashboard
        - link "Billetterie" [ref=e296] [cursor=pointer]:
          - /url: /partner/events
        - link "Scanner" [ref=e300] [cursor=pointer]:
          - /url: /partner/scan
        - link "Finances" [ref=e308] [cursor=pointer]:
          - /url: /partner/finance
        - link "Profil" [ref=e312] [cursor=pointer]:
          - /url: /partner/profile
  - alert [ref=e317]
  - alertdialog [ref=e320]:
    - generic [ref=e321]:
      - heading "Retirer Ibrahima Gueye de votre équipe ?" [level=2] [ref=e324]
      - button "Fermer" [ref=e325] [cursor=pointer]
    - generic [ref=e332]:
      - paragraph [ref=e333]: Ibrahima est retiré de vos 1 événement et reçoit un SMS et un avis. Son scanner est refusé pour vos événements dès votre confirmation, même sur un téléphone déjà ouvert.
      - paragraph [ref=e334]: Son accès au scanner est fermé et il est déconnecté de l’application sur tous ses téléphones, espace client compris. Il pourra se reconnecter pour ses billets.
      - paragraph [ref=e335]: Pour le reprendre, invitez-le de nouveau.
    - generic [ref=e336]:
      - button "Revenir" [active] [ref=e337] [cursor=pointer]
      - button "Retirer de l’équipe" [ref=e339] [cursor=pointer]
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
      |                                                                   ^ Error: contrôles bloquants de partenaire-equipe-retirer__mobile__sombre.png
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