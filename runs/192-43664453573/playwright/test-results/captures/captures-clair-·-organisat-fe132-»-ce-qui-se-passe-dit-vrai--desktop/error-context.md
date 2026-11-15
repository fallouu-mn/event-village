# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · organisateur >> partenaire-equipe-retirer — Équipe — fenêtre « Retirer de l’équipe » (ce qui se passe, dit vrai)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: contrôles bloquants de partenaire-equipe-retirer__ordinateur__clair.png

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
          - button "Basculer le thème" [ref=e88] [cursor=pointer]
    - generic [ref=e92]:
      - banner [ref=e93]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e95] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 99+ non lues" [ref=e102] [cursor=pointer]:
          - generic [ref=e106]: 99+
      - main [ref=e107]:
        - generic [ref=e109]:
          - generic [ref=e112]:
            - heading "Équipe de contrôle" [level=1] [ref=e113]
            - paragraph [ref=e114]: "Les personnes qui scannent les billets à l’entrée de vos événements : leur état, leur porte et leurs espèces, événement par événement."
          - region [ref=e115]:
            - generic [ref=e116]:
              - generic [ref=e117]:
                - heading "Vos contrôleurs" [level=2] [ref=e118]
                - paragraph [ref=e119]: 4 contrôleurs · 4 prêts · 1 en attente
                - status [ref=e120]: Mis à jour à 02:27
              - generic [ref=e122]:
                - button "Actualiser" [ref=e123] [cursor=pointer]
                - button "Inviter un contrôleur" [ref=e131] [cursor=pointer]
            - status [ref=e137]:
              - generic [ref=e142]:
                - paragraph [ref=e143]: "« Grande soirée du Monument de la Renaissance » : porte sans contrôleur"
                - generic [ref=e144]: "Accès carré, Porte Sud : personne ne contrôle cette porte. Choisissez-la pour un contrôleur avec « Modifier »."
              - link "Modifier les portes et les couleurs" [ref=e146] [cursor=pointer]:
                - /url: /partner/events/2413feae-2d03-4e2c-8c18-f6d78e0b04cd?tab=equipe#portes-et-couleurs
            - group [ref=e148]:
              - generic "Portes et couleurs" [ref=e149] [cursor=pointer]
            - generic [ref=e150]:
              - generic [ref=e151]:
                - generic [ref=e152]:
                  - generic [ref=e153]: Rechercher
                  - textbox "Rechercher" [ref=e159]:
                    - /placeholder: Nom ou numéro
                - generic [ref=e160]:
                  - generic [ref=e161]: Événement
                  - combobox "Événement" [ref=e164] [cursor=pointer]:
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
              - group "Filtrer l’équipe" [ref=e165]:
                - button "Tous" [pressed] [ref=e166] [cursor=pointer]
                - button "Prêts" [ref=e167] [cursor=pointer]
                - button "En attente" [ref=e168] [cursor=pointer]
                - button "Sans porte" [ref=e169] [cursor=pointer]
                - button "À relancer" [ref=e170] [cursor=pointer]
            - generic [ref=e171]:
              - generic [ref=e172]:
                - paragraph [ref=e173]: Vous (organisatrice) — toutes les portes
                - paragraph [ref=e174]: Vous scannez vos événements dont le contrôle est ouvert, à toutes les portes ou à une porte choisie, et vous vendez au guichet.
              - link "Scanner les billets" [ref=e175] [cursor=pointer]:
                - /url: /partner/scan
            - table [ref=e179]:
              - caption [ref=e180]: Contrôleurs de l’équipe
              - rowgroup [ref=e181]:
                - row [ref=e182]:
                  - columnheader "Contrôleur" [ref=e183]
                  - columnheader "État" [ref=e184]
                  - columnheader "Événements, porte et espèces" [ref=e185]
              - rowgroup [ref=e186]:
                - row [ref=e187]:
                  - cell [ref=e188]:
                    - generic [ref=e189]:
                      - generic [ref=e190]:
                        - paragraph [ref=e191]: Ibrahima Gueye
                        - paragraph [ref=e192]: 70 000 01 06
                      - generic [ref=e193]:
                        - link "Appeler Ibrahima Gueye" [ref=e194] [cursor=pointer]:
                          - /url: tel:+221700000106
                          - generic [ref=e197]: Appeler
                        - link "Écrire à Ibrahima Gueye sur WhatsApp" [ref=e198] [cursor=pointer]:
                          - /url: https://wa.me/221700000106?text=Bonjour%20Ibrahima%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2015%20nov.%202026%20%C3%A0%2003%3A00%2C%20Entr%C3%A9e%20principale.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                          - generic [ref=e201]: WhatsApp
                  - cell "Prêt Actif depuis le 15 nov. 2026 Retirer de l’équipe" [ref=e202]:
                    - generic [ref=e203]:
                      - generic [ref=e204]: Prêt
                      - paragraph [ref=e206]: Actif depuis le 15 nov. 2026
                      - button "Retirer de l’équipe" [ref=e208] [cursor=pointer]
                  - cell [ref=e210]:
                    - list "Événements de Ibrahima Gueye" [ref=e212]:
                      - listitem [ref=e213]:
                        - paragraph [ref=e214]: Nuit du Sabar — édition d’automne · 15 nov. 2026 à 03:00
                        - paragraph [ref=e215]: "Point d’entrée : Entrée principale"
                        - paragraph [ref=e216]: "Laisse entrer : toutes les catégories"
                        - generic [ref=e217]:
                          - generic [ref=e218]: Espèces autorisées
                          - generic [ref=e220]:
                            - link "Caisse ouverte" [ref=e221] [cursor=pointer]:
                              - /url: /partner/events/8b6ecf5e-05d6-4311-ab95-83819d4b2ed2?tab=caisse
                            - link "32 entrées · dernier scan à 02:10" [ref=e222] [cursor=pointer]:
                              - /url: /partner/events/8b6ecf5e-05d6-4311-ab95-83819d4b2ed2?tab=entrees
                        - button "Modifier" [ref=e224] [cursor=pointer]
                - row [ref=e226]:
                  - cell [ref=e227]:
                    - generic [ref=e228]:
                      - generic [ref=e229]:
                        - paragraph [ref=e230]: Lamine Cissé
                        - paragraph [ref=e231]: 70 000 01 08
                      - generic [ref=e232]:
                        - link "Appeler Lamine Cissé" [ref=e233] [cursor=pointer]:
                          - /url: tel:+221700000108
                          - generic [ref=e236]: Appeler
                        - link "Écrire à Lamine Cissé sur WhatsApp" [ref=e237] [cursor=pointer]:
                          - /url: https://wa.me/221700000108?text=Bonjour%20Lamine%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2015%20nov.%202026%20%C3%A0%2003%3A00%2C%20Entr%C3%A9e%20principale.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                          - generic [ref=e240]: WhatsApp
                  - cell "Prêt Actif depuis le 15 nov. 2026 Retirer de l’équipe" [ref=e241]:
                    - generic [ref=e242]:
                      - generic [ref=e243]: Prêt
                      - paragraph [ref=e245]: Actif depuis le 15 nov. 2026
                      - button "Retirer de l’équipe" [ref=e247] [cursor=pointer]
                  - cell [ref=e249]:
                    - generic [ref=e250]:
                      - list "Événements de Lamine Cissé" [ref=e251]:
                        - listitem [ref=e252]:
                          - paragraph [ref=e253]: Nuit du Sabar — édition d’automne · 15 nov. 2026 à 03:00
                          - paragraph [ref=e254]: "Point d’entrée : Entrée principale"
                          - paragraph [ref=e255]: "Laisse entrer : toutes les catégories"
                          - generic [ref=e256]:
                            - generic [ref=e257]: Espèces autorisées
                            - link "22 entrées · dernier scan à 02:06" [ref=e260] [cursor=pointer]:
                              - /url: /partner/events/8b6ecf5e-05d6-4311-ab95-83819d4b2ed2?tab=entrees
                          - button "Modifier" [ref=e262] [cursor=pointer]
                      - group [ref=e264]:
                        - generic "Événements passés" [ref=e265] [cursor=pointer]
                - row [ref=e266]:
                  - cell [ref=e267]:
                    - generic [ref=e268]:
                      - generic [ref=e269]:
                        - paragraph [ref=e270]: Mamadou Sall
                        - paragraph [ref=e271]: 70 000 01 10
                      - generic [ref=e272]:
                        - link "Appeler Mamadou Sall" [ref=e273] [cursor=pointer]:
                          - /url: tel:+221700000110
                          - generic [ref=e276]: Appeler
                        - link "Écrire à Mamadou Sall sur WhatsApp" [ref=e277] [cursor=pointer]:
                          - /url: https://wa.me/221700000110?text=Bonjour%20Mamadou%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Grande%20soir%C3%A9e%20du%20Monument%20de%20la%20Renaissance%20%C2%BB%20le%2018%20nov.%202026%20%C3%A0%2020%3A00%2C%20porte%20Porte%20Nord.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                          - generic [ref=e280]: WhatsApp
                  - cell "Prêt Actif depuis le 15 nov. 2026 Retirer de l’équipe" [ref=e281]:
                    - generic [ref=e282]:
                      - generic [ref=e283]: Prêt
                      - paragraph [ref=e285]: Actif depuis le 15 nov. 2026
                      - button "Retirer de l’équipe" [ref=e287] [cursor=pointer]
                  - cell [ref=e289]:
                    - list "Événements de Mamadou Sall" [ref=e291]:
                      - listitem [ref=e292]:
                        - paragraph [ref=e293]: Grande soirée du Monument de la Renaissance · 18 nov. 2026 à 20:00
                        - paragraph [ref=e294]: "Porte : Porte Nord · Entrée générale"
                        - generic [ref=e295]:
                          - generic [ref=e296]: "Laisse entrer :"
                          - generic [ref=e297]:
                            - generic [ref=e299]: SIMPLE
                            - generic [ref=e300]: ", pastille blanc"
                          - generic [ref=e301]:
                            - generic [ref=e303]: VIP
                            - generic [ref=e304]: ", pastille or"
                          - generic [ref=e305]:
                            - generic [ref=e307]: VVIP
                            - generic [ref=e308]: ", pastille violet"
                        - generic [ref=e309]:
                          - generic [ref=e310]: Sans espèces
                          - generic [ref=e312]: Aucune entrée
                        - button "Modifier" [ref=e315] [cursor=pointer]
                - row [ref=e317]:
                  - cell [ref=e318]:
                    - generic [ref=e319]:
                      - generic [ref=e320]:
                        - paragraph [ref=e321]: Seynabou Ba
                        - paragraph [ref=e322]: 70 000 01 07
                      - generic [ref=e323]:
                        - link "Appeler Seynabou Ba" [ref=e324] [cursor=pointer]:
                          - /url: tel:+221700000107
                          - generic [ref=e327]: Appeler
                        - link "Écrire à Seynabou Ba sur WhatsApp" [ref=e328] [cursor=pointer]:
                          - /url: https://wa.me/221700000107?text=Bonjour%20Seynabou%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2015%20nov.%202026%20%C3%A0%2003%3A00%2C%20Entr%C3%A9e%20VIP.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                          - generic [ref=e331]: WhatsApp
                  - cell "Prêt Actif depuis le 15 nov. 2026 Retirer de l’équipe" [ref=e332]:
                    - generic [ref=e333]:
                      - generic [ref=e334]: Prêt
                      - paragraph [ref=e336]: Actif depuis le 15 nov. 2026
                      - button "Retirer de l’équipe" [ref=e338] [cursor=pointer]
                  - cell [ref=e340]:
                    - list "Événements de Seynabou Ba" [ref=e342]:
                      - listitem [ref=e343]:
                        - paragraph [ref=e344]: Nuit du Sabar — édition d’automne · 15 nov. 2026 à 03:00
                        - paragraph [ref=e345]: "Point d’entrée : Entrée VIP"
                        - paragraph [ref=e346]: "Laisse entrer : toutes les catégories"
                        - generic [ref=e347]:
                          - generic [ref=e348]: Espèces autorisées
                          - link "7 entrées · dernier scan à 02:02" [ref=e351] [cursor=pointer]:
                            - /url: /partner/events/8b6ecf5e-05d6-4311-ab95-83819d4b2ed2?tab=entrees
                        - button "Modifier" [ref=e353] [cursor=pointer]
            - region [ref=e355]:
              - heading "Invitations" [level=3] [ref=e356]
              - list "Invitations" [ref=e357]:
                - listitem [ref=e358]:
                  - generic [ref=e359]:
                    - generic [ref=e360]:
                      - paragraph [ref=e361]: Fa*** M***
                      - generic [ref=e362]: Invitation envoyée
                    - paragraph [ref=e364]: "Envoyée le dim. 15 nov. 2026 à 02:13. Fa*** M*** doit accepter avant le mer. 18 nov. 2026 à 02:13. Événements : « Festival Jazz sur le Fleuve »."
                  - generic [ref=e366]:
                    - button "Renvoyer l’invitation" [ref=e367] [cursor=pointer]
                    - button "Annuler l’invitation" [ref=e369] [cursor=pointer]
  - alert [ref=e371]
  - alertdialog [ref=e374]:
    - generic [ref=e375]:
      - heading "Retirer Ibrahima Gueye de votre équipe ?" [level=2] [ref=e378]
      - button "Fermer" [ref=e379] [cursor=pointer]
    - generic [ref=e386]:
      - paragraph [ref=e387]: Ibrahima est retiré de vos 1 événement et reçoit un SMS et un avis. Son scanner est refusé pour vos événements dès votre confirmation, même sur un téléphone déjà ouvert.
      - paragraph [ref=e388]: Son accès au scanner est fermé et il est déconnecté de l’application sur tous ses téléphones, espace client compris. Il pourra se reconnecter pour ses billets.
      - paragraph [ref=e389]: Pour le reprendre, invitez-le de nouveau.
    - generic [ref=e390]:
      - button "Revenir" [active] [ref=e391] [cursor=pointer]
      - button "Retirer de l’équipe" [ref=e393] [cursor=pointer]
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
      |                                                                   ^ Error: contrôles bloquants de partenaire-equipe-retirer__ordinateur__clair.png
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