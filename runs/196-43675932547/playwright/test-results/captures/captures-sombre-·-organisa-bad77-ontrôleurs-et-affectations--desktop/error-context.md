# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · organisateur >> partenaire-equipe — Partenaire — équipe (contrôleurs et affectations)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de partenaire-equipe__ordinateur__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "axe-core color-contrast (serious, 5 nœud(s)) : Elements must meet minimum color contrast ratio thresholds",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - link "Event Village, accueil" [ref=e5] [cursor=pointer]:
        - /url: /
        - generic [ref=e11]:
          - generic [ref=e12]: EVENT
          - generic [ref=e13]: VILLAGE
      - navigation "Navigation principale" [ref=e14]:
        - generic [ref=e15]:
          - paragraph [ref=e16]: Gestion
          - generic [ref=e17]:
            - link "Tableau de bord" [ref=e18] [cursor=pointer]:
              - /url: /partner/dashboard
            - link "Événements" [ref=e25] [cursor=pointer]:
              - /url: /partner/events
            - link "Équipe" [ref=e29] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=e36]:
          - paragraph [ref=e37]: Outils
          - generic [ref=e38]:
            - link "Finances" [ref=e39] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=e43] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=e47] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=e55] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=e59] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=e64] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=e70] [cursor=pointer]:
          - /url: /
      - generic [ref=e76]:
        - link "Mariama Ndiaye Partenaire" [ref=e77] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e78]: MN
          - generic [ref=e79]:
            - generic [ref=e80]: Mariama Ndiaye
            - generic [ref=e81]: Partenaire
        - generic [ref=e82]:
          - button "Se déconnecter" [ref=e83] [cursor=pointer]
          - button "Basculer le thème" [pressed] [ref=e88] [cursor=pointer]
    - generic [ref=e96]:
      - banner [ref=e97]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e99] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 99+ non lues" [ref=e106] [cursor=pointer]:
          - generic [ref=e110]: 99+
      - main [ref=e111]:
        - generic [ref=e113]:
          - generic [ref=e116]:
            - heading "Équipe de contrôle" [level=1] [ref=e117]
            - paragraph [ref=e118]: "Les personnes qui scannent les billets à l’entrée de vos événements : leur état, leur porte et leurs espèces, événement par événement."
          - region [ref=e119]:
            - generic [ref=e120]:
              - generic [ref=e121]:
                - heading "Vos contrôleurs" [level=2] [ref=e122]
                - paragraph [ref=e123]: 4 contrôleurs · 4 prêts · 1 en attente
                - status [ref=e124]: Mis à jour à 05:15
              - generic [ref=e126]:
                - button "Actualiser" [ref=e127] [cursor=pointer]
                - button "Inviter un contrôleur" [ref=e135] [cursor=pointer]
            - status [ref=e141]:
              - generic [ref=e146]:
                - paragraph [ref=e147]: "« Grande soirée du Monument de la Renaissance » : porte sans contrôleur"
                - generic [ref=e148]: "Accès carré, Porte Sud : personne ne contrôle cette porte. Choisissez-la pour un contrôleur avec « Modifier »."
              - link "Modifier les portes et les couleurs" [ref=e150] [cursor=pointer]:
                - /url: /partner/events/4f00059b-c125-48bb-9d18-2beb391c52ae?tab=equipe#portes-et-couleurs
            - group [ref=e152]:
              - generic "Portes et couleurs" [ref=e153] [cursor=pointer]
            - generic [ref=e154]:
              - generic [ref=e155]:
                - generic [ref=e156]:
                  - generic [ref=e157]: Rechercher
                  - textbox "Rechercher" [ref=e163]:
                    - /placeholder: Nom ou numéro
                - generic [ref=e164]:
                  - generic [ref=e165]: Événement
                  - combobox "Événement" [ref=e168] [cursor=pointer]:
                    - option "Tous les événements" [selected]
                    - option "Brunch électro des Almadies · 11 nov. 2026 à 12:00 (passé)"
                    - option "Nuit du Sabar — édition d’automne · 15 nov. 2026 à 05:45"
                    - option "Croisière musicale vers Gorée · 15 nov. 2026 à 09:00 (passé)"
                    - option "Concert des Lumières de Gorée · 16 nov. 2026 à 01:00"
                    - option "Grande soirée du Monument de la Renaissance · 18 nov. 2026 à 20:00"
                    - option "Festival Jazz sur le Fleuve · 27 nov. 2026 à 18:00"
                    - option "Soirée Kora & Lumières · 2 déc. 2026 à 20:30"
                    - option "Matinée gospel et chorales · 9 déc. 2026 à 10:00"
                    - option "Concert acoustique au jardin · 25 déc. 2026 à 19:00"
              - group "Filtrer l’équipe" [ref=e169]:
                - button "Tous" [pressed] [ref=e170] [cursor=pointer]
                - button "Prêts" [ref=e171] [cursor=pointer]
                - button "En attente" [ref=e172] [cursor=pointer]
                - button "Sans porte" [ref=e173] [cursor=pointer]
                - button "À relancer" [ref=e174] [cursor=pointer]
            - generic [ref=e175]:
              - generic [ref=e176]:
                - paragraph [ref=e177]: Vous (organisatrice) — toutes les portes
                - paragraph [ref=e178]: Vous scannez vos événements dont le contrôle est ouvert, à toutes les portes ou à une porte choisie, et vous vendez au guichet.
              - link "Scanner les billets" [ref=e179] [cursor=pointer]:
                - /url: /partner/scan
            - table [ref=e183]:
              - caption [ref=e184]: Contrôleurs de l’équipe
              - rowgroup [ref=e185]:
                - row [ref=e186]:
                  - columnheader "Contrôleur" [ref=e187]
                  - columnheader "État" [ref=e188]
                  - columnheader "Événements, porte et espèces" [ref=e189]
              - rowgroup [ref=e190]:
                - row [ref=e191]:
                  - cell [ref=e192]:
                    - generic [ref=e193]:
                      - generic [ref=e194]:
                        - paragraph [ref=e195]: Ibrahima Gueye
                        - paragraph [ref=e196]: 70 000 01 06
                      - generic [ref=e197]:
                        - link "Appeler Ibrahima Gueye" [ref=e198] [cursor=pointer]:
                          - /url: tel:+221700000106
                          - generic [ref=e201]: Appeler
                        - link "Écrire à Ibrahima Gueye sur WhatsApp" [ref=e202] [cursor=pointer]:
                          - /url: https://wa.me/221700000106?text=Bonjour%20Ibrahima%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2015%20nov.%202026%20%C3%A0%2005%3A45%2C%20Entr%C3%A9e%20principale.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                          - generic [ref=e205]: WhatsApp
                  - cell "Prêt Actif depuis le 15 nov. 2026 Retirer de l’équipe" [ref=e206]:
                    - generic [ref=e207]:
                      - generic [ref=e208]: Prêt
                      - paragraph [ref=e210]: Actif depuis le 15 nov. 2026
                      - button "Retirer de l’équipe" [ref=e212] [cursor=pointer]
                  - cell [ref=e214]:
                    - list "Événements de Ibrahima Gueye" [ref=e216]:
                      - listitem [ref=e217]:
                        - paragraph [ref=e218]: Nuit du Sabar — édition d’automne · 15 nov. 2026 à 05:45
                        - paragraph [ref=e219]: "Point d’entrée : Entrée principale"
                        - paragraph [ref=e220]: "Laisse entrer : toutes les catégories"
                        - generic [ref=e221]:
                          - generic [ref=e222]: Espèces autorisées
                          - generic [ref=e224]:
                            - link "Caisse ouverte" [ref=e225] [cursor=pointer]:
                              - /url: /partner/events/e52b99aa-b769-4bca-bfa3-7a1271d81cee?tab=caisse
                            - link "32 entrées · dernier scan à 04:52" [ref=e226] [cursor=pointer]:
                              - /url: /partner/events/e52b99aa-b769-4bca-bfa3-7a1271d81cee?tab=entrees
                        - button "Modifier" [ref=e228] [cursor=pointer]
                - row [ref=e230]:
                  - cell [ref=e231]:
                    - generic [ref=e232]:
                      - generic [ref=e233]:
                        - paragraph [ref=e234]: Lamine Cissé
                        - paragraph [ref=e235]: 70 000 01 08
                      - generic [ref=e236]:
                        - link "Appeler Lamine Cissé" [ref=e237] [cursor=pointer]:
                          - /url: tel:+221700000108
                          - generic [ref=e240]: Appeler
                        - link "Écrire à Lamine Cissé sur WhatsApp" [ref=e241] [cursor=pointer]:
                          - /url: https://wa.me/221700000108?text=Bonjour%20Lamine%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2015%20nov.%202026%20%C3%A0%2005%3A45%2C%20Entr%C3%A9e%20principale.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                          - generic [ref=e244]: WhatsApp
                  - cell "Prêt Actif depuis le 15 nov. 2026 Retirer de l’équipe" [ref=e245]:
                    - generic [ref=e246]:
                      - generic [ref=e247]: Prêt
                      - paragraph [ref=e249]: Actif depuis le 15 nov. 2026
                      - button "Retirer de l’équipe" [ref=e251] [cursor=pointer]
                  - cell [ref=e253]:
                    - generic [ref=e254]:
                      - list "Événements de Lamine Cissé" [ref=e255]:
                        - listitem [ref=e256]:
                          - paragraph [ref=e257]: Nuit du Sabar — édition d’automne · 15 nov. 2026 à 05:45
                          - paragraph [ref=e258]: "Point d’entrée : Entrée principale"
                          - paragraph [ref=e259]: "Laisse entrer : toutes les catégories"
                          - generic [ref=e260]:
                            - generic [ref=e261]: Espèces autorisées
                            - link "22 entrées · dernier scan à 04:48" [ref=e264] [cursor=pointer]:
                              - /url: /partner/events/e52b99aa-b769-4bca-bfa3-7a1271d81cee?tab=entrees
                          - button "Modifier" [ref=e266] [cursor=pointer]
                      - group [ref=e268]:
                        - generic "Événements passés" [ref=e269] [cursor=pointer]
                - row [ref=e270]:
                  - cell [ref=e271]:
                    - generic [ref=e272]:
                      - generic [ref=e273]:
                        - paragraph [ref=e274]: Mamadou Sall
                        - paragraph [ref=e275]: 70 000 01 10
                      - generic [ref=e276]:
                        - link "Appeler Mamadou Sall" [ref=e277] [cursor=pointer]:
                          - /url: tel:+221700000110
                          - generic [ref=e280]: Appeler
                        - link "Écrire à Mamadou Sall sur WhatsApp" [ref=e281] [cursor=pointer]:
                          - /url: https://wa.me/221700000110?text=Bonjour%20Mamadou%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Grande%20soir%C3%A9e%20du%20Monument%20de%20la%20Renaissance%20%C2%BB%20le%2018%20nov.%202026%20%C3%A0%2020%3A00%2C%20porte%20Porte%20Nord.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                          - generic [ref=e284]: WhatsApp
                  - cell "Prêt Actif depuis le 15 nov. 2026 Retirer de l’équipe" [ref=e285]:
                    - generic [ref=e286]:
                      - generic [ref=e287]: Prêt
                      - paragraph [ref=e289]: Actif depuis le 15 nov. 2026
                      - button "Retirer de l’équipe" [ref=e291] [cursor=pointer]
                  - cell [ref=e293]:
                    - list "Événements de Mamadou Sall" [ref=e295]:
                      - listitem [ref=e296]:
                        - paragraph [ref=e297]: Grande soirée du Monument de la Renaissance · 18 nov. 2026 à 20:00
                        - paragraph [ref=e298]: "Porte : Porte Nord · Entrée générale"
                        - generic [ref=e299]:
                          - generic [ref=e300]: "Laisse entrer :"
                          - generic [ref=e301]:
                            - generic [ref=e303]: SIMPLE
                            - generic [ref=e304]: ", pastille blanc"
                          - generic [ref=e305]:
                            - generic [ref=e307]: VIP
                            - generic [ref=e308]: ", pastille or"
                          - generic [ref=e309]:
                            - generic [ref=e311]: VVIP
                            - generic [ref=e312]: ", pastille violet"
                        - generic [ref=e313]:
                          - generic [ref=e314]: Sans espèces
                          - generic [ref=e316]: Aucune entrée
                        - button "Modifier" [ref=e319] [cursor=pointer]
                - row [ref=e321]:
                  - cell [ref=e322]:
                    - generic [ref=e323]:
                      - generic [ref=e324]:
                        - paragraph [ref=e325]: Seynabou Ba
                        - paragraph [ref=e326]: 70 000 01 07
                      - generic [ref=e327]:
                        - link "Appeler Seynabou Ba" [ref=e328] [cursor=pointer]:
                          - /url: tel:+221700000107
                          - generic [ref=e331]: Appeler
                        - link "Écrire à Seynabou Ba sur WhatsApp" [ref=e332] [cursor=pointer]:
                          - /url: https://wa.me/221700000107?text=Bonjour%20Seynabou%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2015%20nov.%202026%20%C3%A0%2005%3A45%2C%20Entr%C3%A9e%20VIP.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                          - generic [ref=e335]: WhatsApp
                  - cell "Prêt Actif depuis le 15 nov. 2026 Retirer de l’équipe" [ref=e336]:
                    - generic [ref=e337]:
                      - generic [ref=e338]: Prêt
                      - paragraph [ref=e340]: Actif depuis le 15 nov. 2026
                      - button "Retirer de l’équipe" [ref=e342] [cursor=pointer]
                  - cell [ref=e344]:
                    - list "Événements de Seynabou Ba" [ref=e346]:
                      - listitem [ref=e347]:
                        - paragraph [ref=e348]: Nuit du Sabar — édition d’automne · 15 nov. 2026 à 05:45
                        - paragraph [ref=e349]: "Point d’entrée : Entrée VIP"
                        - paragraph [ref=e350]: "Laisse entrer : toutes les catégories"
                        - generic [ref=e351]:
                          - generic [ref=e352]: Espèces autorisées
                          - link "7 entrées · dernier scan à 04:44" [ref=e355] [cursor=pointer]:
                            - /url: /partner/events/e52b99aa-b769-4bca-bfa3-7a1271d81cee?tab=entrees
                        - button "Modifier" [ref=e357] [cursor=pointer]
            - region [ref=e359]:
              - heading "Invitations" [level=3] [ref=e360]
              - list "Invitations" [ref=e361]:
                - listitem [ref=e362]:
                  - generic [ref=e363]:
                    - generic [ref=e364]:
                      - paragraph [ref=e365]: Fa*** M***
                      - generic [ref=e366]: Invitation envoyée
                    - paragraph [ref=e368]: "Envoyée le dim. 15 nov. 2026 à 04:55. Fa*** M*** doit accepter avant le mer. 18 nov. 2026 à 04:55. Événements : « Festival Jazz sur le Fleuve »."
                  - generic [ref=e370]:
                    - button "Renvoyer l’invitation" [ref=e371] [cursor=pointer]
                    - button "Annuler l’invitation" [ref=e373] [cursor=pointer]
  - alert [ref=e375]
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
      |                                                                   ^ Error: contrôles bloquants de partenaire-equipe__ordinateur__sombre.png
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