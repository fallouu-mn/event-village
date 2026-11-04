# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · client >> cloche-ouverte — Cloche ouverte (non lues d’abord, Tout marquer comme lu)
- Location: e2e/captures.spec.ts:151:9

# Error details

```
Error: contrôles bloquants de cloche-ouverte__mobile__sombre.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "« Tout marquer comme lu » sur 2 lignes à 390 px (une seule attendue, §4.6)",
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
          - generic [ref=e17]:
            - button "Notifications, 8 non lues" [expanded] [active] [ref=e18] [cursor=pointer]:
              - generic [ref=e22]: "8"
            - region [ref=e23]:
              - generic [ref=e24]:
                - heading "Notifications" [level=2] [ref=e25]
                - button "Fermer les notifications" [ref=e26] [cursor=pointer]
              - button "Tout marquer comme lu" [ref=e32] [cursor=pointer]
              - group "Filtrer les notifications" [ref=e36]:
                - button "Toutes" [pressed] [ref=e37] [cursor=pointer]
                - button "Non lues (8)" [ref=e38] [cursor=pointer]
              - list [ref=e40]:
                - listitem [ref=e41]:
                  - 'button "Non lue : Remboursement versé Il y a 3 min 15 750 F CFA vous ont été remboursés sur votre compte Wave pour « Croisière musicale vers Gorée ». Consulter" [ref=e42] [cursor=pointer]':
                    - generic [ref=e47]:
                      - generic [ref=e48]:
                        - generic [ref=e49]:
                          - generic [ref=e50]: "Non lue :"
                          - text: Remboursement versé
                        - time [ref=e51]: Il y a 3 min
                      - generic [ref=e52]: 15 750 F CFA vous ont été remboursés sur votre compte Wave pour « Croisière musicale vers Gorée ».
                      - generic [ref=e53]: Consulter
                  - 'button "Marquer comme lue : Remboursement versé" [ref=e56] [cursor=pointer]'
                - listitem [ref=e60]:
                  - 'button "Non lue : Événement annulé Il y a 3 min Statut de l’événement « Croisière musicale vers Gorée » du dim. 22 nov. 2026 à 17:30 est annulé. La chaloupe prévue n’a pas obtenu son certificat de navigation à temps. Tous les billets payés en ligne sont remboursés automatiquement, sans démarche de votre part. Votre remboursement est en cours. Consulter" [ref=e61] [cursor=pointer]':
                    - generic [ref=e67]:
                      - generic [ref=e68]:
                        - generic [ref=e69]:
                          - generic [ref=e70]: "Non lue :"
                          - text: Événement annulé
                        - time [ref=e71]: Il y a 3 min
                      - generic [ref=e72]: Statut de l’événement
                      - generic [ref=e75]: « Croisière musicale vers Gorée » du dim. 22 nov. 2026 à 17:30 est annulé. La chaloupe prévue n’a pas obtenu son certificat de navigation à temps. Tous les billets payés en ligne sont remboursés automatiquement, sans démarche de votre part. Votre remboursement est en cours.
                      - generic [ref=e76]: Consulter
                  - 'button "Marquer comme lue : Événement annulé" [ref=e79] [cursor=pointer]'
                - listitem [ref=e83]:
                  - 'button "Non lue : Un billet vous est transféré Il y a 3 min Transfert de billet Un billet pour « Festival Jazz sur le Fleuve » vous attend. Acceptez-le avant le ven. 6 nov. 2026 à 17:44. Consulter" [ref=e84] [cursor=pointer]':
                    - generic [ref=e88]:
                      - generic [ref=e89]:
                        - generic [ref=e90]:
                          - generic [ref=e91]: "Non lue :"
                          - text: Un billet vous est transféré
                        - time [ref=e92]: Il y a 3 min
                      - generic [ref=e93]: Transfert de billet
                      - generic [ref=e96]: Un billet pour « Festival Jazz sur le Fleuve » vous attend. Acceptez-le avant le ven. 6 nov. 2026 à 17:44.
                      - generic [ref=e97]: Consulter
                  - 'button "Marquer comme lue : Un billet vous est transféré" [ref=e100] [cursor=pointer]'
                - listitem [ref=e104]:
                  - 'button "Non lue : Achat confirmé Il y a 3 min Billet 1 billet pour « Croisière musicale vers Gorée » le dim. 22 nov. 2026 à 17:30. Total payé : 15 750 F CFA. Vos billets sont dans Mes billets. Consulter" [ref=e105] [cursor=pointer]':
                    - generic [ref=e109]:
                      - generic [ref=e110]:
                        - generic [ref=e111]:
                          - generic [ref=e112]: "Non lue :"
                          - text: Achat confirmé
                        - time [ref=e113]: Il y a 3 min
                      - generic [ref=e114]: Billet
                      - generic [ref=e117]: "1 billet pour « Croisière musicale vers Gorée » le dim. 22 nov. 2026 à 17:30. Total payé : 15 750 F CFA. Vos billets sont dans Mes billets."
                      - generic [ref=e118]: Consulter
                  - 'button "Marquer comme lue : Achat confirmé" [ref=e121] [cursor=pointer]'
                - listitem [ref=e125]:
                  - 'button "Non lue : Achat confirmé Il y a 3 min Billet 2 billets pour « Nuit du Sabar — édition d’automne » le mer. 4 nov. 2026 à 18:30. Total payé : 10 500 F CFA. Vos billets sont dans Mes billets. Consulter" [ref=e126] [cursor=pointer]':
                    - generic [ref=e130]:
                      - generic [ref=e131]:
                        - generic [ref=e132]:
                          - generic [ref=e133]: "Non lue :"
                          - text: Achat confirmé
                        - time [ref=e134]: Il y a 3 min
                      - generic [ref=e135]: Billet
                      - generic [ref=e138]: "2 billets pour « Nuit du Sabar — édition d’automne » le mer. 4 nov. 2026 à 18:30. Total payé : 10 500 F CFA. Vos billets sont dans Mes billets."
                      - generic [ref=e139]: Consulter
                  - 'button "Marquer comme lue : Achat confirmé" [ref=e142] [cursor=pointer]'
                - listitem [ref=e146]:
                  - 'button "Non lue : Achat confirmé Il y a 3 min Billet 1 billet pour « Concert des Lumières de Gorée » le jeu. 5 nov. 2026 à 13:45. Total payé : 6 300 F CFA. Vos billets sont dans Mes billets. Consulter" [ref=e147] [cursor=pointer]':
                    - generic [ref=e151]:
                      - generic [ref=e152]:
                        - generic [ref=e153]:
                          - generic [ref=e154]: "Non lue :"
                          - text: Achat confirmé
                        - time [ref=e155]: Il y a 3 min
                      - generic [ref=e156]: Billet
                      - generic [ref=e159]: "1 billet pour « Concert des Lumières de Gorée » le jeu. 5 nov. 2026 à 13:45. Total payé : 6 300 F CFA. Vos billets sont dans Mes billets."
                      - generic [ref=e160]: Consulter
                  - 'button "Marquer comme lue : Achat confirmé" [ref=e163] [cursor=pointer]'
                - listitem [ref=e167]:
                  - 'button "Non lue : Achat confirmé Il y a 3 min Billet 1 billet pour « Brunch électro des Almadies » le mer. 4 nov. 2026 à 18:45. Total payé : 15 750 F CFA. Vos billets sont dans Mes billets. Consulter" [ref=e168] [cursor=pointer]':
                    - generic [ref=e172]:
                      - generic [ref=e173]:
                        - generic [ref=e174]:
                          - generic [ref=e175]: "Non lue :"
                          - text: Achat confirmé
                        - time [ref=e176]: Il y a 3 min
                      - generic [ref=e177]: Billet
                      - generic [ref=e180]: "1 billet pour « Brunch électro des Almadies » le mer. 4 nov. 2026 à 18:45. Total payé : 15 750 F CFA. Vos billets sont dans Mes billets."
                      - generic [ref=e181]: Consulter
                  - 'button "Marquer comme lue : Achat confirmé" [ref=e184] [cursor=pointer]'
                - listitem [ref=e188]:
                  - 'button "Non lue : Achat confirmé Il y a 3 min Billet 1 billet pour « Festival Jazz sur le Fleuve » le lun. 16 nov. 2026 à 18:00. Total payé : 7 875 F CFA. Vos billets sont dans Mes billets. Consulter" [ref=e189] [cursor=pointer]':
                    - generic [ref=e193]:
                      - generic [ref=e194]:
                        - generic [ref=e195]:
                          - generic [ref=e196]: "Non lue :"
                          - text: Achat confirmé
                        - time [ref=e197]: Il y a 3 min
                      - generic [ref=e198]: Billet
                      - generic [ref=e201]: "1 billet pour « Festival Jazz sur le Fleuve » le lun. 16 nov. 2026 à 18:00. Total payé : 7 875 F CFA. Vos billets sont dans Mes billets."
                      - generic [ref=e202]: Consulter
                  - 'button "Marquer comme lue : Achat confirmé" [ref=e205] [cursor=pointer]'
                - listitem [ref=e209]:
                  - button "Entrée validée Il y a 3 min Entrée contrôlée Votre billet pour « Nuit du Sabar — édition d’automne » a été contrôlé à l'entrée. Consulter" [ref=e210] [cursor=pointer]:
                    - generic [ref=e214]:
                      - generic [ref=e215]:
                        - generic [ref=e216]: Entrée validée
                        - time [ref=e217]: Il y a 3 min
                      - generic [ref=e218]: Entrée contrôlée
                      - generic [ref=e221]: Votre billet pour « Nuit du Sabar — édition d’automne » a été contrôlé à l'entrée.
                      - generic [ref=e222]: Consulter
                - listitem [ref=e225]:
                  - button "Entrée validée Il y a 3 min Entrée contrôlée Votre billet pour « Brunch électro des Almadies » a été contrôlé à l'entrée. Consulter" [ref=e226] [cursor=pointer]:
                    - generic [ref=e230]:
                      - generic [ref=e231]:
                        - generic [ref=e232]: Entrée validée
                        - time [ref=e233]: Il y a 3 min
                      - generic [ref=e234]: Entrée contrôlée
                      - generic [ref=e237]: Votre billet pour « Brunch électro des Almadies » a été contrôlé à l'entrée.
                      - generic [ref=e238]: Consulter
              - generic [ref=e241]:
                - link "Voir toutes les notifications" [ref=e242] [cursor=pointer]:
                  - /url: /notifications
                - link "Préférences" [ref=e243] [cursor=pointer]:
                  - /url: /profile/notifications
          - button "Basculer le thème" [pressed] [ref=e248] [cursor=pointer]
          - link "Mon profil (Fatou Mbaye)" [ref=e256] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e257]: FM
      - main [ref=e259]:
        - generic [ref=e261]:
          - generic [ref=e263]:
            - generic [ref=e264]:
              - status [ref=e266]: En direct
              - heading "Mes billets" [level=1] [ref=e268]
              - paragraph [ref=e269]: "Présentez le QR code de votre billet à l’entrée. Il se renouvelle tout seul : gardez la page ouverte."
            - generic [ref=e270]:
              - link "Afficher mes billets hors ligne" [ref=e271] [cursor=pointer]:
                - /url: /billet/hors-ligne
              - button "Comment marche le transfert ?" [ref=e279] [cursor=pointer]
              - link "Réserver un billet" [ref=e285] [cursor=pointer]:
                - /url: /explore
          - tablist "Filtrer mes billets" [ref=e292]:
            - tab "À venir" [selected] [ref=e293] [cursor=pointer]
            - tab "Tous mes billets" [ref=e295] [cursor=pointer]
            - tab "Historique" [ref=e297] [cursor=pointer]
            - tab "Reçus , 1" [ref=e299] [cursor=pointer]:
              - generic [ref=e300]: Reçus
              - generic [ref=e301]:
                - generic [ref=e302]: ","
                - text: "1"
          - tabpanel "À venir" [ref=e303]:
            - list [ref=e304]:
              - listitem [ref=e305]:
                - article "Billet pour Concert des Lumières de Gorée" [ref=e306]:
                  - generic [ref=e307]:
                    - generic [ref=e310]:
                      - 'generic "Billet valable : présentez son code d’entrée au contrôle." [ref=e313]': Valable
                      - generic [ref=e316]:
                        - heading "Concert des Lumières de Gorée" [level=2] [ref=e317]
                        - paragraph [ref=e318]: Baobab Scène
                    - generic [ref=e320]:
                      - generic [ref=e321]:
                        - generic [ref=e322]:
                          - term [ref=e323]: Date
                          - definition [ref=e324]: 05 NOV 2026
                        - generic [ref=e325]:
                          - term [ref=e326]: Heure d’accès
                          - definition [ref=e327]: 13:45
                        - generic [ref=e328]:
                          - term [ref=e329]: Lieu
                          - definition [ref=e330]: Place du Gouvernement
                        - generic [ref=e331]:
                          - term [ref=e332]: Emplacement
                          - definition [ref=e333]: Entrée
                      - generic [ref=e335]:
                        - img "QR d’entrée dynamique" [ref=e337]
                        - paragraph [ref=e340]:
                          - generic [ref=e341]: "Numéro du billet :"
                          - text: TCK-20261104-42CAFF1D14
                        - generic [ref=e342]:
                          - generic [ref=e343]:
                            - generic [ref=e344]: Code renouvelé toutes les 20 s
                            - generic [ref=e346]:
                              - generic [aria-hidden] [ref=e347]: 5 s
                              - generic [ref=e348]: Nouveau code dans 5 secondes
                          - paragraph [ref=e351]: Une capture d’écran n’est pas acceptée au contrôle.
                          - paragraph [ref=e352]:
                            - generic [ref=e357]: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
                        - status [ref=e359]:
                          - generic [ref=e362]: Ouvrez ce billet avec du réseau avant d’arriver
                        - paragraph [ref=e363]:
                          - generic [ref=e367]: Billet authentique, émis par Event Village
                        - paragraph [ref=e368]: Présentez ce code au contrôle, billet ouvert dans l’application.
                  - generic [ref=e369]:
                    - button "Transférer" [ref=e370] [cursor=pointer]
                    - button "Partager le lien de l’événement sur WhatsApp" [ref=e376] [cursor=pointer]:
                      - generic [ref=e380]: WhatsApp
                    - button "Partager ou copier le lien de l’événement" [ref=e381] [cursor=pointer]:
                      - generic [ref=e389]: Lien
                    - button "Télécharger le billet en PDF" [ref=e390] [cursor=pointer]:
                      - generic [ref=e395]: PDF
                    - button "Aide au transfert" [ref=e396] [cursor=pointer]
              - listitem [ref=e402]:
                - article "Billet pour Festival Jazz sur le Fleuve" [ref=e403]:
                  - generic [ref=e404]:
                    - generic [ref=e407]:
                      - 'generic "Billet valable : présentez son code d’entrée au contrôle." [ref=e410]': Valable
                      - generic [ref=e413]:
                        - heading "Festival Jazz sur le Fleuve" [level=2] [ref=e414]
                        - paragraph [ref=e415]: Baobab Scène
                    - generic [ref=e417]:
                      - generic [ref=e418]:
                        - generic [ref=e419]:
                          - term [ref=e420]: Date
                          - definition [ref=e421]: 16 NOV 2026
                        - generic [ref=e422]:
                          - term [ref=e423]: Heure d’accès
                          - definition [ref=e424]: 18:00
                        - generic [ref=e425]:
                          - term [ref=e426]: Lieu
                          - definition [ref=e427]: Quai des Pêcheurs
                        - generic [ref=e428]:
                          - term [ref=e429]: Emplacement
                          - definition [ref=e430]: Pass soirée
                      - generic [ref=e432]:
                        - img "QR d’entrée dynamique" [ref=e434]
                        - paragraph [ref=e437]:
                          - generic [ref=e438]: "Numéro du billet :"
                          - text: TCK-20261104-D519DF20CA
                        - generic [ref=e439]:
                          - generic [ref=e440]:
                            - generic [ref=e441]: Code renouvelé toutes les 20 s
                            - generic [ref=e443]:
                              - generic [aria-hidden] [ref=e444]: 5 s
                              - generic [ref=e445]: Nouveau code dans 5 secondes
                          - paragraph [ref=e448]: Une capture d’écran n’est pas acceptée au contrôle.
                          - paragraph [ref=e449]:
                            - generic [ref=e454]: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
                        - status [ref=e456]:
                          - generic [ref=e460]: Disponible hors ligne à partir du dim. 15 nov. 2026 à 18:00
                        - paragraph [ref=e461]:
                          - generic [ref=e465]: Billet authentique, émis par Event Village
                        - paragraph [ref=e466]: Présentez ce code au contrôle, billet ouvert dans l’application.
                  - generic [ref=e467]:
                    - button "Transférer" [ref=e468] [cursor=pointer]
                    - button "Partager le lien de l’événement sur WhatsApp" [ref=e474] [cursor=pointer]:
                      - generic [ref=e478]: WhatsApp
                    - button "Partager ou copier le lien de l’événement" [ref=e479] [cursor=pointer]:
                      - generic [ref=e487]: Lien
                    - button "Télécharger le billet en PDF" [ref=e488] [cursor=pointer]:
                      - generic [ref=e493]: PDF
                    - button "Aide au transfert" [ref=e494] [cursor=pointer]
              - listitem [ref=e500]:
                - article "Billet pour Nuit du Sabar — édition d’automne" [ref=e501]:
                  - generic [ref=e502]:
                    - generic [ref=e505]:
                      - 'generic "Billet valable : présentez son code d’entrée au contrôle." [ref=e508]': Valable
                      - generic [ref=e511]:
                        - heading "Nuit du Sabar — édition d’automne" [level=2] [ref=e512]
                        - paragraph [ref=e513]: Baobab Scène
                    - generic [ref=e515]:
                      - generic [ref=e516]:
                        - generic [ref=e517]:
                          - term [ref=e518]: Date
                          - definition [ref=e519]: 04 NOV 2026
                        - generic [ref=e520]:
                          - term [ref=e521]: Heure d’accès
                          - definition [ref=e522]: 18:30
                        - generic [ref=e523]:
                          - term [ref=e524]: Lieu
                          - definition [ref=e525]: Esplanade de la Corniche Ouest
                        - generic [ref=e526]:
                          - term [ref=e527]: Emplacement
                          - definition [ref=e528]: Standard
                      - generic [ref=e530]:
                        - img "QR d’entrée dynamique" [ref=e532]
                        - paragraph [ref=e535]:
                          - generic [ref=e536]: "Numéro du billet :"
                          - text: TCK-20261104-C61BC45585
                        - generic [ref=e537]:
                          - generic [ref=e538]:
                            - generic [ref=e539]: Code renouvelé toutes les 20 s
                            - generic [ref=e541]:
                              - generic [aria-hidden] [ref=e542]: 5 s
                              - generic [ref=e543]: Nouveau code dans 5 secondes
                          - paragraph [ref=e546]: Une capture d’écran n’est pas acceptée au contrôle.
                          - paragraph [ref=e547]:
                            - generic [ref=e552]: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
                        - status [ref=e554]:
                          - generic [ref=e557]: Ouvrez ce billet avec du réseau avant d’arriver
                        - paragraph [ref=e558]:
                          - generic [ref=e562]: Billet authentique, émis par Event Village
                        - paragraph [ref=e563]: Présentez ce code au contrôle, billet ouvert dans l’application.
                  - generic [ref=e564]:
                    - button "Transférer" [ref=e565] [cursor=pointer]
                    - button "Partager le lien de l’événement sur WhatsApp" [ref=e571] [cursor=pointer]:
                      - generic [ref=e575]: WhatsApp
                    - button "Partager ou copier le lien de l’événement" [ref=e576] [cursor=pointer]:
                      - generic [ref=e584]: Lien
                    - button "Télécharger le billet en PDF" [ref=e585] [cursor=pointer]:
                      - generic [ref=e590]: PDF
                    - button "Aide au transfert" [ref=e591] [cursor=pointer]
    - navigation "Navigation rapide" [ref=e597]:
      - generic [ref=e598]:
        - link "Accueil" [ref=e599] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e604] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e609] [cursor=pointer]:
          - /url: /tickets
        - link "Solde" [ref=e613] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e618]
```

# Test source

```ts
  176 |                 await context.addInitScript(stretchTimers, screen.slowTimers);
  177 |             }
  178 |             if (screen.injectError) {
  179 |                 record.notes.push(`état d'erreur simulé : réponses ${screen.injectError} remplacées par un 500 (erreurs de console attendues, ignorées)`);
  180 |                 await page.route(screen.injectError, (route) => route.fulfill({
  181 |                     status: 500,
  182 |                     contentType: 'application/json; charset=utf-8',
  183 |                     body: JSON.stringify({ error: 'Erreur simulée par les tests de bout en bout.', code: 'E2E_SIMULATED_ERROR' }),
  184 |                 }));
  185 |             }
  186 |             const stubs: StubResponse[] = [...(screen.stubResponse ? [screen.stubResponse] : []), ...(screen.stubResponses ?? [])];
  187 |             for (const stub of stubs) {
  188 |                 record.notes.push(`réponse simulée : ${stub.method ?? 'toute méthode'} ${stub.url} remplacée par HTTP ${stub.status} ${JSON.stringify(stub.body).slice(0, 160)}`);
  189 |                 await page.route(stub.url, async (route) => {
  190 |                     if (!methodMatches(stub.method, route.request().method())) {
  191 |                         await route.fallback();
  192 |                         return;
  193 |                     }
  194 |                     await route.fulfill({ status: stub.status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(stub.body) });
  195 |                 });
  196 |             }
  197 |             for (const hold of screen.holdRequests ?? []) {
  198 |                 record.notes.push(`requête retenue (jamais servie) : ${hold.method ?? 'toute méthode'} ${hold.url}`);
  199 |                 await page.route(hold.url, async (route) => {
  200 |                     if (!methodMatches(hold.method, route.request().method())) {
  201 |                         await route.fallback();
  202 |                         return;
  203 |                     }
  204 |                     // Retenue jusqu'à la fermeture de la page : ni réponse ni erreur (réseau lent, téléchargement en cours)
  205 |                     await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  206 |                 });
  207 |             }
  208 |             if (screen.fakePush) {
  209 |                 const subscription = screen.fakePush === 'granted' ? await fakePushSubscriber() : null;
  210 |                 record.notes.push(screen.fakePush === 'granted'
  211 |                     ? `push simulé (granted) : permission accordée au clic sans fenêtre, inscription du service worker et pushManager.subscribe remplacés ; abonnement du faux service push ${subscription?.endpoint ?? '?'} ; configuration VAPID, route d'inscription et base réelles`
  212 |                     : screen.fakePush === 'denied'
  213 |                         ? 'push simulé (denied) : Notification.permission = « denied », appels à requestPermission comptés'
  214 |                         : 'push simulé (unsupported) : window.PushManager et window.Notification supprimés');
  215 |                 await context.addInitScript(installFakePush, { mode: screen.fakePush, subscription });
  216 |             }
  217 |             if (screen.fakeCamera) {
  218 |                 const mode = screen.fakeCamera === 'barcode-detector' ? 'barcode-detector' : fakeScanMode();
  219 |                 record.notes.push(`caméra simulée (${mode})${mode === 'barcode-detector' ? ' : faux BarcodeDetector, payload posé par le test' : ''}`);
  220 |                 await context.addInitScript(installFakeCamera, { mode });
  221 |             }
  222 |             if (screen.offline === 'before-load') {
  223 |                 record.notes.push('connexion coupée avant le chargement (collecte d’erreurs arrêtée)');
  224 |                 guard.freeze();
  225 |                 await context.setOffline(true);
  226 |             }
  227 |             const response = await page.goto(record.url, { waitUntil: 'load' });
  228 |             record.status = response ? response.status() : null;
  229 |             if (screen.expectStatus !== undefined) {
  230 |                 expect(record.status, `statut HTTP du document ${record.url}`).toBe(screen.expectStatus);
  231 |             }
  232 |             if (screen.offline === 'after-load') {
  233 |                 record.notes.push('connexion coupée après le chargement (collecte d’erreurs arrêtée)');
  234 |                 guard.freeze();
  235 |                 await context.setOffline(true);
  236 |             }
  237 |             const sc = { page, context, guard, ids: demo };
  238 |             if (screen.ready) await screen.ready(sc);
  239 |             await settle(page, guard, record.notes);
  240 |             if (screen.actions) {
  241 |                 await screen.actions(sc);
  242 |                 await settle(page, guard, record.notes);
  243 |             }
  244 |             if (screen.id === 'cloche-ouverte' && vue === 'mobile') {
  245 |                 const problem = await markAllOnOneLine(page);
  246 |                 if (problem) record.blocking.push(problem);
  247 |             }
  248 |             const checks = await runPageChecks(page, { mobile: vue === 'mobile', axe: true });
  249 |             record.blocking.push(...checks.blocking);
  250 |             record.warnings.push(...checks.warnings);
  251 |             record.axeDetails = checks.axeDetails;
  252 |             record.smallTextDetails = checks.smallTextDetails;
  253 |             record.metrics = checks.metrics;
  254 |             const shot = await capture(page, screen, file);
  255 |             record.captured = true;
  256 |             await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  257 |         } catch (err) {
  258 |             record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  259 |             if (!record.captured && !page.isClosed()) {
  260 |                 await capture(page, screen, file).then(
  261 |                     async (shot) => {
  262 |                         record.captured = true;
  263 |                         record.notes.push('capture prise après l’erreur (état de la page au moment de l’échec)');
  264 |                         await testInfo.attach(file, { path: shot, contentType: 'image/png' });
  265 |                     },
  266 |                     (shotErr: Error) => { record.notes.push(`capture impossible après l’erreur : ${shotErr.message.split('\n')[0]}`); },
  267 |                 );
  268 |             }
  269 |             throw err;
  270 |         } finally {
  271 |             record.blocking.push(...guard.blockingIssues());
  272 |             record.warnings.push(...guard.nonBlockingIssues());
  273 |             record.durationMs = Date.now() - started;
  274 |             writeCaptureRecord(record);
  275 |         }
> 276 |         expect(record.blocking, `contrôles bloquants de ${file}`).toEqual([]);
      |                                                                   ^ Error: contrôles bloquants de cloche-ouverte__mobile__sombre.png
  277 |     });
  278 | }
  279 | 
  280 | for (const theme of THEMES) {
  281 |     for (const role of ROLE_ORDER) {
  282 |         const screens = SCREENS.filter((s) => s.role === role);
  283 |         if (screens.length === 0) continue;
  284 |         test.describe(`${theme.key} · ${role}`, () => {
  285 |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  286 | 
  287 |             for (const screen of screens) {
  288 |                 if (screen.serviceWorkers === 'allow') {
  289 |                     // Lot 7 (D7) : service worker autorisé seulement dans le contexte de cet écran
  290 |                     test.describe(`${screen.id} (service worker autorisé)`, () => {
  291 |                         test.use({ serviceWorkers: 'allow' });
  292 |                         defineCapture(screen, theme, role);
  293 |                     });
  294 |                 } else {
  295 |                     defineCapture(screen, theme, role);
  296 |                 }
  297 |             }
  298 |         });
  299 |     }
  300 | }
  301 | 
```