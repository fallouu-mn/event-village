# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · organisateur >> partenaire-equipe-retirer — Équipe — fenêtre « Retirer de l’équipe » (ce qui se passe, dit vrai)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de partenaire-equipe-retirer__mobile__clair.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "4 cible(s) < 44 px : a « Caisse ouverte » 102×20 ; a « 32 entrées · dernier scan à 02:10 » 220×20 ; a « 22 entrées · dernier scan à 02:06 » 222×20 ; a « 7 entrées · dernier scan à 02:02 » 214×20",
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
          - button "Basculer le thème" [ref=e24] [cursor=pointer]
          - link "Mon profil (Mariama Ndiaye)" [ref=e28] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e29]: MN
      - main [ref=e31]:
        - generic [ref=e33]:
          - generic [ref=e36]:
            - heading "Équipe de contrôle" [level=1] [ref=e37]
            - paragraph [ref=e38]: "Les personnes qui scannent les billets à l’entrée de vos événements : leur état, leur porte et leurs espèces, événement par événement."
          - region [ref=e39]:
            - generic [ref=e40]:
              - generic [ref=e41]:
                - heading "Vos contrôleurs" [level=2] [ref=e42]
                - paragraph [ref=e43]: 4 contrôleurs · 4 prêts · 1 en attente
                - status [ref=e44]: Mis à jour à 02:17
              - generic [ref=e46]:
                - button "Actualiser" [ref=e47] [cursor=pointer]
                - button "Inviter un contrôleur" [ref=e55] [cursor=pointer]
            - status [ref=e61]:
              - generic [ref=e66]:
                - paragraph [ref=e67]: "« Grande soirée du Monument de la Renaissance » : porte sans contrôleur"
                - generic [ref=e68]: "Accès carré, Porte Sud : personne ne contrôle cette porte. Choisissez-la pour un contrôleur avec « Modifier »."
              - link "Modifier les portes et les couleurs" [ref=e70] [cursor=pointer]:
                - /url: /partner/events/2413feae-2d03-4e2c-8c18-f6d78e0b04cd?tab=equipe#portes-et-couleurs
            - group [ref=e72]:
              - generic "Portes et couleurs" [ref=e73] [cursor=pointer]
            - generic [ref=e74]:
              - generic [ref=e75]:
                - generic [ref=e76]:
                  - generic [ref=e77]: Rechercher
                  - textbox "Rechercher" [ref=e83]:
                    - /placeholder: Nom ou numéro
                - generic [ref=e84]:
                  - generic [ref=e85]: Événement
                  - combobox "Événement" [ref=e88] [cursor=pointer]:
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
              - group "Filtrer l’équipe" [ref=e89]:
                - button "Tous" [pressed] [ref=e90] [cursor=pointer]
                - button "Prêts" [ref=e91] [cursor=pointer]
                - button "En attente" [ref=e92] [cursor=pointer]
                - button "Sans porte" [ref=e93] [cursor=pointer]
                - button "À relancer" [ref=e94] [cursor=pointer]
            - generic [ref=e95]:
              - generic [ref=e96]:
                - paragraph [ref=e97]: Vous (organisatrice) — toutes les portes
                - paragraph [ref=e98]: Vous scannez vos événements dont le contrôle est ouvert, à toutes les portes ou à une porte choisie, et vous vendez au guichet.
              - link "Scanner les billets" [ref=e99] [cursor=pointer]:
                - /url: /partner/scan
            - list "Contrôleurs de l’équipe" [ref=e102]:
              - listitem [ref=e103]:
                - generic [ref=e104]:
                  - generic [ref=e105]:
                    - generic [ref=e106]:
                      - paragraph [ref=e107]: Ibrahima Gueye
                      - paragraph [ref=e108]: Actif depuis le 15 nov. 2026
                    - generic [ref=e109]: Prêt
                  - generic [ref=e111]:
                    - paragraph [ref=e112]: 70 000 01 06
                    - generic [ref=e113]:
                      - link "Appeler Ibrahima Gueye" [ref=e114] [cursor=pointer]:
                        - /url: tel:+221700000106
                        - generic [ref=e117]: Appeler
                      - link "Écrire à Ibrahima Gueye sur WhatsApp" [ref=e118] [cursor=pointer]:
                        - /url: https://wa.me/221700000106?text=Bonjour%20Ibrahima%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2015%20nov.%202026%20%C3%A0%2003%3A00%2C%20Entr%C3%A9e%20principale.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                        - generic [ref=e121]: WhatsApp
                  - list "Événements de Ibrahima Gueye" [ref=e124]:
                    - listitem [ref=e125]:
                      - paragraph [ref=e126]: Nuit du Sabar — édition d’automne · 15 nov. 2026 à 03:00
                      - paragraph [ref=e127]: "Point d’entrée : Entrée principale"
                      - paragraph [ref=e128]: "Laisse entrer : toutes les catégories"
                      - generic [ref=e129]:
                        - generic [ref=e130]: Espèces autorisées
                        - generic [ref=e132]:
                          - link "Caisse ouverte" [ref=e133] [cursor=pointer]:
                            - /url: /partner/events/8b6ecf5e-05d6-4311-ab95-83819d4b2ed2?tab=caisse
                          - link "32 entrées · dernier scan à 02:10" [ref=e134] [cursor=pointer]:
                            - /url: /partner/events/8b6ecf5e-05d6-4311-ab95-83819d4b2ed2?tab=entrees
                      - button "Modifier" [ref=e136] [cursor=pointer]
                  - button "Retirer de l’équipe" [ref=e139] [cursor=pointer]
              - listitem [ref=e141]:
                - generic [ref=e142]:
                  - generic [ref=e143]:
                    - generic [ref=e144]:
                      - paragraph [ref=e145]: Lamine Cissé
                      - paragraph [ref=e146]: Actif depuis le 15 nov. 2026
                    - generic [ref=e147]: Prêt
                  - generic [ref=e149]:
                    - paragraph [ref=e150]: 70 000 01 08
                    - generic [ref=e151]:
                      - link "Appeler Lamine Cissé" [ref=e152] [cursor=pointer]:
                        - /url: tel:+221700000108
                        - generic [ref=e155]: Appeler
                      - link "Écrire à Lamine Cissé sur WhatsApp" [ref=e156] [cursor=pointer]:
                        - /url: https://wa.me/221700000108?text=Bonjour%20Lamine%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2015%20nov.%202026%20%C3%A0%2003%3A00%2C%20Entr%C3%A9e%20principale.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                        - generic [ref=e159]: WhatsApp
                  - generic [ref=e161]:
                    - list "Événements de Lamine Cissé" [ref=e162]:
                      - listitem [ref=e163]:
                        - paragraph [ref=e164]: Nuit du Sabar — édition d’automne · 15 nov. 2026 à 03:00
                        - paragraph [ref=e165]: "Point d’entrée : Entrée principale"
                        - paragraph [ref=e166]: "Laisse entrer : toutes les catégories"
                        - generic [ref=e167]:
                          - generic [ref=e168]: Espèces autorisées
                          - link "22 entrées · dernier scan à 02:06" [ref=e171] [cursor=pointer]:
                            - /url: /partner/events/8b6ecf5e-05d6-4311-ab95-83819d4b2ed2?tab=entrees
                        - button "Modifier" [ref=e173] [cursor=pointer]
                    - group [ref=e175]:
                      - generic "Événements passés" [ref=e176] [cursor=pointer]
                  - button "Retirer de l’équipe" [ref=e178] [cursor=pointer]
              - listitem [ref=e180]:
                - generic [ref=e181]:
                  - generic [ref=e182]:
                    - generic [ref=e183]:
                      - paragraph [ref=e184]: Mamadou Sall
                      - paragraph [ref=e185]: Actif depuis le 15 nov. 2026
                    - generic [ref=e186]: Prêt
                  - generic [ref=e188]:
                    - paragraph [ref=e189]: 70 000 01 10
                    - generic [ref=e190]:
                      - link "Appeler Mamadou Sall" [ref=e191] [cursor=pointer]:
                        - /url: tel:+221700000110
                        - generic [ref=e194]: Appeler
                      - link "Écrire à Mamadou Sall sur WhatsApp" [ref=e195] [cursor=pointer]:
                        - /url: https://wa.me/221700000110?text=Bonjour%20Mamadou%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Grande%20soir%C3%A9e%20du%20Monument%20de%20la%20Renaissance%20%C2%BB%20le%2018%20nov.%202026%20%C3%A0%2020%3A00%2C%20porte%20Porte%20Nord.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                        - generic [ref=e198]: WhatsApp
                  - list "Événements de Mamadou Sall" [ref=e201]:
                    - listitem [ref=e202]:
                      - paragraph [ref=e203]: Grande soirée du Monument de la Renaissance · 18 nov. 2026 à 20:00
                      - paragraph [ref=e204]: "Porte : Porte Nord · Entrée générale"
                      - generic [ref=e205]:
                        - generic [ref=e206]: "Laisse entrer :"
                        - generic [ref=e207]:
                          - generic [ref=e209]: SIMPLE
                          - generic [ref=e210]: ", pastille blanc"
                        - generic [ref=e211]:
                          - generic [ref=e213]: VIP
                          - generic [ref=e214]: ", pastille or"
                        - generic [ref=e215]:
                          - generic [ref=e217]: VVIP
                          - generic [ref=e218]: ", pastille violet"
                      - generic [ref=e219]:
                        - generic [ref=e220]: Sans espèces
                        - generic [ref=e222]: Aucune entrée
                      - button "Modifier" [ref=e225] [cursor=pointer]
                  - button "Retirer de l’équipe" [ref=e228] [cursor=pointer]
              - listitem [ref=e230]:
                - generic [ref=e231]:
                  - generic [ref=e232]:
                    - generic [ref=e233]:
                      - paragraph [ref=e234]: Seynabou Ba
                      - paragraph [ref=e235]: Actif depuis le 15 nov. 2026
                    - generic [ref=e236]: Prêt
                  - generic [ref=e238]:
                    - paragraph [ref=e239]: 70 000 01 07
                    - generic [ref=e240]:
                      - link "Appeler Seynabou Ba" [ref=e241] [cursor=pointer]:
                        - /url: tel:+221700000107
                        - generic [ref=e244]: Appeler
                      - link "Écrire à Seynabou Ba sur WhatsApp" [ref=e245] [cursor=pointer]:
                        - /url: https://wa.me/221700000107?text=Bonjour%20Seynabou%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2015%20nov.%202026%20%C3%A0%2003%3A00%2C%20Entr%C3%A9e%20VIP.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                        - generic [ref=e248]: WhatsApp
                  - list "Événements de Seynabou Ba" [ref=e251]:
                    - listitem [ref=e252]:
                      - paragraph [ref=e253]: Nuit du Sabar — édition d’automne · 15 nov. 2026 à 03:00
                      - paragraph [ref=e254]: "Point d’entrée : Entrée VIP"
                      - paragraph [ref=e255]: "Laisse entrer : toutes les catégories"
                      - generic [ref=e256]:
                        - generic [ref=e257]: Espèces autorisées
                        - link "7 entrées · dernier scan à 02:02" [ref=e260] [cursor=pointer]:
                          - /url: /partner/events/8b6ecf5e-05d6-4311-ab95-83819d4b2ed2?tab=entrees
                      - button "Modifier" [ref=e262] [cursor=pointer]
                  - button "Retirer de l’équipe" [ref=e265] [cursor=pointer]
            - region [ref=e267]:
              - heading "Invitations" [level=3] [ref=e268]
              - list "Invitations" [ref=e269]:
                - listitem [ref=e270]:
                  - generic [ref=e271]:
                    - generic [ref=e272]:
                      - paragraph [ref=e273]: Fa*** M***
                      - generic [ref=e274]: Invitation envoyée
                    - paragraph [ref=e276]: "Envoyée le dim. 15 nov. 2026 à 02:13. Fa*** M*** doit accepter avant le mer. 18 nov. 2026 à 02:13. Événements : « Festival Jazz sur le Fleuve »."
                  - generic [ref=e278]:
                    - button "Renvoyer l’invitation" [ref=e279] [cursor=pointer]
                    - button "Annuler l’invitation" [ref=e281] [cursor=pointer]
    - navigation "Navigation rapide" [ref=e283]:
      - generic [ref=e284]:
        - link "Accueil" [ref=e285] [cursor=pointer]:
          - /url: /partner/dashboard
        - link "Billetterie" [ref=e292] [cursor=pointer]:
          - /url: /partner/events
        - link "Scanner" [ref=e296] [cursor=pointer]:
          - /url: /partner/scan
        - link "Finances" [ref=e304] [cursor=pointer]:
          - /url: /partner/finance
        - link "Profil" [ref=e308] [cursor=pointer]:
          - /url: /partner/profile
  - alert [ref=e313]
  - alertdialog [ref=e316]:
    - generic [ref=e317]:
      - heading "Retirer Ibrahima Gueye de votre équipe ?" [level=2] [ref=e320]
      - button "Fermer" [ref=e321] [cursor=pointer]
    - generic [ref=e328]:
      - paragraph [ref=e329]: Ibrahima est retiré de vos 1 événement et reçoit un SMS et un avis. Son scanner est refusé pour vos événements dès votre confirmation, même sur un téléphone déjà ouvert.
      - paragraph [ref=e330]: Son accès au scanner est fermé et il est déconnecté de l’application sur tous ses téléphones, espace client compris. Il pourra se reconnecter pour ses billets.
      - paragraph [ref=e331]: Pour le reprendre, invitez-le de nouveau.
    - generic [ref=e332]:
      - button "Revenir" [active] [ref=e333] [cursor=pointer]
      - button "Retirer de l’équipe" [ref=e335] [cursor=pointer]
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
      |                                                                   ^ Error: contrôles bloquants de partenaire-equipe-retirer__mobile__clair.png
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