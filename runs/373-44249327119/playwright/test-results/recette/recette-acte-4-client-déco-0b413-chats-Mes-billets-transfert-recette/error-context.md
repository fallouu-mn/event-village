# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recette.spec.ts >> acte 4 [client] : découverte, fiche, refus direct, inscription depuis l’achat, achats, Mes billets, transfert
- Location: e2e/recette.spec.ts:563:5

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('link', { name: /Recette — Nuit de Ngor 06\.58\.56/ }).first()

```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
  - generic [ref=f2e2]:
    - complementary [ref=f2e3]:
      - link "Event Village, accueil" [ref=f2e5] [cursor=pointer]:
        - /url: /
        - generic [ref=f2e6]: Event Village
      - navigation "Navigation principale" [ref=f2e9]:
        - generic [ref=f2e10]: Administration
        - link "Tableau de bord" [ref=f2e15] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=f2e22]:
          - paragraph [ref=f2e23]: Gestion
          - generic [ref=f2e24]:
            - link "Événements" [ref=f2e25] [cursor=pointer]:
              - /url: /admin/events
            - link "Comptes" [ref=f2e29] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=f2e36] [cursor=pointer]:
              - /url: /admin/services
        - generic [ref=f2e42]:
          - paragraph [ref=f2e43]: Finances
          - link "Finance" [ref=f2e45] [cursor=pointer]:
            - /url: /admin/finance
        - generic [ref=f2e49]:
          - paragraph [ref=f2e50]: Engagement
          - generic [ref=f2e51]:
            - link "Parrainage" [ref=f2e52] [cursor=pointer]:
              - /url: /admin/referral
            - link "Campagnes" [ref=f2e57] [cursor=pointer]:
              - /url: /admin/communications
            - link "À la une" [ref=f2e62] [cursor=pointer]:
              - /url: /admin/a-la-une
        - generic [ref=f2e66]:
          - paragraph [ref=f2e67]: Système
          - generic [ref=f2e68]:
            - link "Réglages" [ref=f2e69] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Journal d’audit" [ref=f2e74] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=f2e79] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=f2e86] [cursor=pointer]:
              - /url: /scan
            - link "Sécurité du compte" [ref=f2e94] [cursor=pointer]:
              - /url: /admin/securite
        - link "Retour au site" [ref=f2e100] [cursor=pointer]:
          - /url: /
      - generic [ref=f2e105]:
        - link "Elhadji SuperAdmin Superadmin" [ref=f2e106] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e107]: ES
          - generic [ref=f2e108]:
            - generic [ref=f2e109]: Elhadji SuperAdmin
            - generic [ref=f2e110]: Superadmin
        - generic [ref=f2e111]:
          - button "Se déconnecter" [ref=f2e112] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e117] [cursor=pointer]
    - generic [ref=f2e121]:
      - banner [ref=f2e122]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f2e124] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 63 non lues" [ref=f2e131] [cursor=pointer]:
          - generic [ref=f2e135]: "63"
      - main [ref=f2e136]:
        - generic [ref=f2e138]:
          - generic [ref=f2e139]:
            - link "Retour aux événements" [ref=f2e141] [cursor=pointer]:
              - /url: /admin/events
            - generic [ref=f2e146]:
              - generic [ref=f2e147]:
                - generic [ref=f2e148]:
                  - 'generic "Accepté par l’équipe Event Village : l’organisateur peut maintenant le publier." [ref=f2e149]': Validé
                  - generic [ref=f2e152]: Concerts & Musique
                - heading "Recette — Nuit de Ngor 06.58.56" [level=1] [ref=f2e153]
                - paragraph [ref=f2e154]: Recette Productions 06.58.56 · jeu. 19 nov. 2026 à 03:00
              - generic [ref=f2e155]:
                - button "Publier" [ref=f2e156] [cursor=pointer]
                - button "Annuler l’événement" [ref=f2e158] [cursor=pointer]
                - link "Ouvrir le pilotage" [ref=f2e160] [cursor=pointer]:
                  - /url: /partner/events/474b9d91-d145-4f72-8b40-a43f3f60444d
                - link "Équipe de cet événement" [ref=f2e166] [cursor=pointer]:
                  - /url: /partner/events/474b9d91-d145-4f72-8b40-a43f3f60444d?tab=equipe
          - generic [ref=f2e174]:
            - generic [ref=f2e175]:
              - region [ref=f2e176]:
                - heading "Dates et lieu" [level=2] [ref=f2e177]
                - generic [ref=f2e178]:
                  - generic [ref=f2e179]:
                    - term [ref=f2e180]: Début
                    - definition [ref=f2e184]: jeu. 19 nov. 2026 à 03:00
                  - generic [ref=f2e185]:
                    - term [ref=f2e186]: Fin
                    - definition [ref=f2e191]: jeu. 19 nov. 2026 à 07:00
                  - generic [ref=f2e192]:
                    - term [ref=f2e193]: Lieu
                    - definition [ref=f2e198]: Corniche de Ngor, Dakar
                  - generic [ref=f2e199]:
                    - term [ref=f2e200]: Jauge déclarée
                    - definition [ref=f2e207]: 100 personnes
                - generic [ref=f2e208]:
                  - 'region "Carte : Corniche de Ngor" [ref=f2e209]':
                    - generic:
                      - 'img "Emplacement : Corniche de Ngor" [ref=f2e210] [cursor=pointer]'
                      - generic [ref=f2e211]:
                        - strong [ref=f2e214]: Corniche de Ngor
                        - button "Fermer la bulle" [ref=f2e216] [cursor=pointer]: ×
                    - generic:
                      - generic [ref=f2e217]:
                        - button "Zoom avant" [ref=f2e218] [cursor=pointer]: +
                        - button "Zoom arrière" [ref=f2e219] [cursor=pointer]: −
                      - generic: © contributeurs OpenStreetMap
                  - link "Voir l’itinéraire" [ref=f2e221] [cursor=pointer]:
                    - /url: https://www.google.com/maps/dir/?api=1&destination=14.693078,-17.446632
                - generic [ref=f2e231]:
                  - generic [ref=f2e232]:
                    - term [ref=f2e233]: Adresse
                    - definition [ref=f2e234]: 12, route de la Corniche, Ngor
                  - generic [ref=f2e235]:
                    - term [ref=f2e236]: Accès
                    - definition [ref=f2e237]: Entrée principale par la plage de Ngor.
                  - generic [ref=f2e238]:
                    - term [ref=f2e239]: Stationnement
                    - definition [ref=f2e240]: Parking surveillé devant le site.
                  - generic [ref=f2e241]:
                    - term [ref=f2e242]: Règlement
                    - definition [ref=f2e243]: Billet présenté sur téléphone, sans objet en verre.
              - region [ref=f2e244]:
                - heading "Description" [level=2] [ref=f2e245]
                - paragraph [ref=f2e246]: "Soirée de la recette : vente en ligne et au guichet, scan, annulation et finance. Données fictives."
              - region [ref=f2e247]:
                - heading "Programme" [level=2] [ref=f2e248]
                - list [ref=f2e249]:
                  - listitem [ref=f2e250]:
                    - generic [ref=f2e251]: 20:30
                    - generic [ref=f2e252]:
                      - generic [ref=f2e253]:
                        - generic [ref=f2e254]: Grand cercle de recette
                        - generic [ref=f2e255]: Artiste
                      - paragraph [ref=f2e257]: Ensemble des Almadies
              - region [ref=f2e258]:
                - heading "Catégories et prix" [level=2] [ref=f2e259]
                - table [ref=f2e262]:
                  - caption [ref=f2e263]: Catégories de billets, tous canaux et inactives comprises
                  - rowgroup [ref=f2e264]:
                    - row [ref=f2e265]:
                      - columnheader "Catégorie" [ref=f2e266]
                      - columnheader "Prix" [ref=f2e267]
                      - columnheader "Quota" [ref=f2e268]
                      - columnheader "Période de vente" [ref=f2e269]
                      - columnheader "Par commande" [ref=f2e270]
                      - columnheader "Au contrôle" [ref=f2e271]
                      - columnheader "Canaux et état" [ref=f2e272]
                  - rowgroup [ref=f2e273]:
                    - row [ref=f2e274]:
                      - cell "Standard" [ref=f2e275]
                      - cell "6 000 F CFA" [ref=f2e278]
                      - cell "50" [ref=f2e279]
                      - cell "Dès la publication · jusqu’à l’événement" [ref=f2e280]
                      - cell "10 au plus" [ref=f2e282]
                      - cell "Blanc Aucune consigne" [ref=f2e283]:
                        - generic [ref=f2e284]:
                          - generic [ref=f2e285]: Blanc
                          - generic [ref=f2e288]: Aucune consigne
                      - cell "En ligne et au guichet Active" [ref=f2e289]:
                        - generic [ref=f2e290]:
                          - generic [ref=f2e291]: En ligne et au guichet
                          - generic [ref=f2e293]: Active
                    - row [ref=f2e295]:
                      - cell "Sur place" [ref=f2e296]
                      - cell "5 000 F CFA" [ref=f2e299]
                      - cell "20" [ref=f2e300]
                      - cell "Dès la publication · jusqu’à l’événement" [ref=f2e301]
                      - cell "10 au plus" [ref=f2e303]
                      - cell "Noir Aucune consigne" [ref=f2e304]:
                        - generic [ref=f2e305]:
                          - generic [ref=f2e306]: Noir
                          - generic [ref=f2e309]: Aucune consigne
                      - cell "Sur place uniquement Active" [ref=f2e310]:
                        - generic [ref=f2e311]:
                          - generic [ref=f2e312]: Sur place uniquement
                          - generic [ref=f2e314]: Active
                    - row [ref=f2e316]:
                      - cell "Invitations" [ref=f2e317]
                      - cell "Gratuit" [ref=f2e320]
                      - cell "10" [ref=f2e321]
                      - cell "Dès la publication · jusqu’à l’événement" [ref=f2e322]
                      - cell "10 au plus" [ref=f2e324]
                      - cell "Violet Aucune consigne" [ref=f2e325]:
                        - generic [ref=f2e326]:
                          - generic [ref=f2e327]: Violet
                          - generic [ref=f2e330]: Aucune consigne
                      - cell "Invitations seulement Active" [ref=f2e331]:
                        - generic [ref=f2e332]:
                          - generic [ref=f2e333]: Invitations seulement
                          - generic [ref=f2e335]: Active
                    - row [ref=f2e337]:
                      - cell "Découverte" [ref=f2e338]
                      - cell "Gratuit" [ref=f2e341]
                      - cell "20" [ref=f2e342]
                      - cell "Dès la publication · jusqu’à l’événement" [ref=f2e343]
                      - cell "10 au plus" [ref=f2e345]
                      - cell "Rose Aucune consigne" [ref=f2e346]:
                        - generic [ref=f2e347]:
                          - generic [ref=f2e348]: Rose
                          - generic [ref=f2e351]: Aucune consigne
                      - cell "En ligne uniquement Active" [ref=f2e352]:
                        - generic [ref=f2e353]:
                          - generic [ref=f2e354]: En ligne uniquement
                          - generic [ref=f2e356]: Active
              - region [ref=f2e358]:
                - heading "Contrôle à l’entrée" [level=2] [ref=f2e359]
                - paragraph [ref=f2e360]: "Une seule entrée : chaque contrôleur laisse entrer toutes les catégories."
            - generic [ref=f2e361]:
              - region [ref=f2e362]:
                - heading "Affiche" [level=2] [ref=f2e363]
                - img "Affiche de « Recette — Nuit de Ngor 06.58.56 »" [ref=f2e364]
              - region [ref=f2e365]:
                - heading "Organisateur" [level=2] [ref=f2e366]
                - generic [ref=f2e367]:
                  - generic [ref=f2e368]:
                    - term [ref=f2e369]: Structure
                    - definition [ref=f2e375]:
                      - text: Recette Productions 06.58.56
                      - generic [ref=f2e376]: Compte validé
                  - generic [ref=f2e379]:
                    - term [ref=f2e380]: Responsable
                    - definition [ref=f2e387]: Mame Recette
                  - generic [ref=f2e388]:
                    - term [ref=f2e389]: Téléphone
                    - definition [ref=f2e393]:
                      - link "+221775136899" [ref=f2e394] [cursor=pointer]:
                        - /url: tel:+221775136899
                  - generic [ref=f2e395]:
                    - term [ref=f2e396]: Email
                    - definition [ref=f2e401]:
                      - link "p1.5136899@recette.eventvillage.local" [ref=f2e402] [cursor=pointer]:
                        - /url: mailto:p1.5136899@recette.eventvillage.local
                  - generic [ref=f2e403]:
                    - term [ref=f2e404]: Ville
                    - definition [ref=f2e409]: Dakar
              - region [ref=f2e410]:
                - heading "Historique des statuts" [level=2] [ref=f2e411]
                - list [ref=f2e412]:
                  - listitem [ref=f2e413]:
                    - paragraph [ref=f2e415]: En attente de validation → Validé
                    - paragraph [ref=f2e416]: Elhadji SuperAdmin (Administration) · Changement de statut
                    - paragraph [ref=f2e417]:
                      - time [ref=f2e418]: mer. 18 nov. 2026 à 06:59
                  - listitem [ref=f2e419]:
                    - paragraph [ref=f2e421]: Brouillon → En attente de validation
                    - paragraph [ref=f2e422]: Mame Recette (Partenaire) · Changement de statut
                    - paragraph [ref=f2e423]:
                      - time [ref=f2e424]: mer. 18 nov. 2026 à 06:59
                  - listitem [ref=f2e425]:
                    - paragraph [ref=f2e427]: "Création : Brouillon"
                    - paragraph [ref=f2e428]: Mame Recette (Partenaire) · Création
                    - paragraph [ref=f2e429]:
                      - time [ref=f2e430]: mer. 18 nov. 2026 à 06:59
  - alert [ref=f2e431]
```

# Test source

```ts
  472 |         // « Enregistrer le brouillon » (parcours recalé, signalé au rapport) ; la soumission reste celle de la liste
  473 |         await partner.getByRole('button', { name: /^suivant/i }).click();
  474 |         await expect(partner.getByRole('heading', { level: 2, name: /^contrôle à l.entrée \(facultatif\)$/i })).toBeVisible();
  475 |         await partner.getByRole('button', { name: /^suivant/i }).click();
  476 |         await expect(partner.getByRole('heading', { level: 2, name: /^vérifier avant d.envoyer$/i })).toBeVisible();
  477 |         await partner.getByRole('button', { name: /^enregistrer le brouillon$/i }).click();
  478 |         await partner.waitForURL(/\/partner\/events(\?|$)/);
  479 |         await expect(partner.getByText(r.e1.title, { exact: true })).toBeVisible();
  480 | 
  481 |         const { data: ev, error } = await serviceClient().from('events').select('id').eq('title', r.e1.title).single();
  482 |         if (error || !ev) throw new Error(`[e2e] événement E1 : ${error?.message ?? 'introuvable'}`);
  483 |         r.e1.id = String(ev.id);
  484 |         const { data: cats, error: catErr } = await serviceClient().from('ticket_categories').select('id, name, sale_online, sale_counter, is_visible').eq('event_id', r.e1.id);
  485 |         if (catErr) throw new Error(`[e2e] catégories de E1 : ${catErr.message}`);
  486 |         for (const c of cats ?? []) r.e1.categories[String(c.name)] = String(c.id);
  487 |         expect((cats ?? []).map((c) => `${String(c.name)} ${String(c.sale_online)} ${String(c.sale_counter)} ${String(c.is_visible)}`).sort(), 'canaux enregistrés, is_visible en miroir')
  488 |             .toEqual(CATEGORIES.map((c) => `${c.name} ${c.online} ${c.counter} ${c.online}`).sort());
  489 |     });
  490 | 
  491 |     await test.step('soumission par P1, validation par le SUPERADMIN, publication par P1', async () => {
  492 |         await actionWithConfirm(partner, cardOf(partner, r.e1.title, /^soumettre/i), /^soumettre/i);
  493 |         await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(r.e1.title, { exact: true }) }).last()).toContainText(/en attente de validation/i);
  494 | 
  495 |         await admin.goto('/admin/events?status=EN_ATTENTE');
  496 |         await admin.getByRole('link', { name: new RegExp(escapeRe(r.e1.title)) }).click();
  497 |         await admin.waitForURL(/\/admin\/events\/[0-9a-f-]{36}/);
  498 |         await actionWithConfirm(admin, admin.locator('main'), /^valider/i);
  499 |         await expect(admin.getByText(/^validé$/i).first()).toBeVisible();
  500 | 
  501 |         await partner.goto('/partner/events');
  502 |         await actionWithConfirm(partner, cardOf(partner, r.e1.title, /^publier/i), /^publier/i);
  503 |         await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(r.e1.title, { exact: true }) }).last()).toContainText(/publié/i);
  504 |     });
  505 | 
  506 |     await test.step('E2 de P1 à J+2 (RPC du lot 5), Standard 3 000 F : l’annulation de l’acte 7 ne touche pas E1', async () => {
  507 |         const day = dakarDayFrom(new Date(), 2);
  508 |         r.e2.id = await createPublishedEvent({
  509 |             partnerUserId: r.p1.userId,
  510 |             superadminId: await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email),
  511 |             title: r.e2.title,
  512 |             description: 'Concert de la recette destiné à être annulé : remboursement automatique. Données fictives.',
  513 |             startDate: day, startTime: '20:00:00', endDate: day, endTime: '23:00:00',
  514 |             location: 'Corniche de Ngor', city: 'Dakar', capacity: 100,
  515 |             imageUrl: await eventImageUrl(r.e1.id),
  516 |             category: { name: 'Standard', price: 3000, total: 50 },
  517 |         });
  518 |     });
  519 | });
  520 | 
  521 | test('acte 3 [partenaire] : invitation de K1, permission espèces, point d’entrée, PIN régisseur', async () => {
  522 |     const partner = known('P1');
  523 |     await partner.goto(`/partner/events/${r.e1.id}`);
  524 |     await openTab(partner, /^équipe/i);
  525 | 
  526 |     await test.step('invitation de K1 avec la permission espèces, SMS d’activation', async () => {
  527 |         // Finition 1 (E-14) : l'invitation passe dans la fenêtre « Inviter un contrôleur » (étape recalée, signalée)
  528 |         await partner.getByRole('button', { name: /^inviter un contrôleur$/i }).click();
  529 |         const inviteDialog = partner.getByRole('dialog', { name: /^inviter un contrôleur$/i });
  530 |         await inviteDialog.getByLabel(/^prénom/i).fill(r.k1.firstName);
  531 |         await inviteDialog.getByLabel(/^nom/i).first().fill('Controle');
  532 |         await inviteDialog.getByLabel(/^numéro de téléphone/i).fill(r.k1.local);
  533 |         await inviteDialog.getByRole('switch', { name: /^encaisser les espèces/i }).click();
  534 |         const invited = await expectRoute(partner, 'POST', '/api/partner/team/invite', () => inviteDialog.getByRole('button', { name: /^inviter$/i }).click(), 201, 'invitation du contrôleur');
  535 |         expect(String(invited.message ?? ''), 'SMS d’activation parti').toMatch(/^Invitation envoyée à .+ par SMS : code d’activation valable jusqu’au /);
  536 |     });
  537 | 
  538 |     await test.step('point d’entrée et permission espèces lus sur la fiche du contrôleur', async () => {
  539 |         // Finition 1 (E-14) : réglages dans la fenêtre « Modifier », un seul « Enregistrer » (étape recalée, signalée)
  540 |         const card = partner.getByRole('table', { name: /^contrôleurs de l’équipe$/i }).getByRole('row').filter({ hasText: r.k1.firstName }).first();
  541 |         await expect(card.getByText('Espèces autorisées').first(), 'espèces autorisées sur cet événement').toBeVisible();
  542 |         await card.getByRole('button', { name: /^modifier$/i }).first().click();
  543 |         const settings = partner.getByRole('dialog');
  544 |         await expect(settings.getByRole('switch', { name: /^encaisser les espèces/i }), 'permission espèces de cet événement').toHaveAttribute('aria-checked', 'true');
  545 |         await settings.getByLabel(/^point d.entrée/i).fill('Porte Ngor');
  546 |         await expectRoute(partner, 'PATCH', '/api/partner/team/settings', () => settings.getByRole('button', { name: /^enregistrer$/i }).click(), 200, 'point d’entrée');
  547 |         await expect(card.getByText('Point d’entrée : Porte Ngor').first(), 'résumé exact de la ligne').toBeVisible();
  548 |     });
  549 | 
  550 |     await test.step('PIN régisseur généré, affiché une fois', async () => {
  551 |         await openTab(partner, /^caisse/i);
  552 |         await partner.getByRole('button', { name: /^générer le code pin$/i }).click();
  553 |         await expectRoute(partner, 'POST', `/api/partner/events/${r.e1.id}/regisseur-pin`, () => partner.getByRole('alertdialog').getByRole('button', { name: /^générer le code$/i }).click(), 200, 'génération du PIN');
  554 |         const dialog = partner.getByRole('dialog', { name: /^nouveau code pin régisseur$/i });
  555 |         await expect(dialog).toBeVisible();
  556 |         r.pin = (await dialog.getByLabel(/^code pin/i).innerText()).trim();
  557 |         expect(r.pin, 'PIN affiché à sa génération').toMatch(/^\d{4,8}$/);
  558 |         await dialog.getByRole('button', { name: /^j’ai noté le code$/i }).click();
  559 |         await expect(partner.getByText(/un code est en place/i)).toBeVisible();
  560 |     });
  561 | });
  562 | 
  563 | test('acte 4 [client] : découverte, fiche, refus direct, inscription depuis l’achat, achats, Mes billets, transfert', async ({ browser }, testInfo) => {
  564 |     const client = await asNew(browser, testInfo, 'C1');
  565 |     const standard = (): RegExp => /ajouter un billet standard/i;
  566 | 
  567 |     await test.step('visiteur : recherche, ville, fiche avec programme et infos pratiques (A15), catégories hors ligne absentes', async () => {
  568 |         await client.goto('/explore');
  569 |         await client.getByLabel(/^rechercher un événement/i).fill(r.e1.title);
  570 |         await client.getByLabel(/^ville/i).selectOption({ label: 'Dakar' });
  571 |         await expect(client.getByRole('link', { name: /Nuit du Sabar/ }), 'recherche : un autre événement de Dakar disparaît').toHaveCount(0);
> 572 |         await client.getByRole('link', { name: new RegExp(escapeRe(r.e1.title)) }).first().click();
      |                                                                                            ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  573 |         await client.waitForURL(new RegExp(`/events/${r.e1.id}`));
  574 |         await expect(client.getByRole('heading', { level: 1, name: r.e1.title })).toBeVisible();
  575 | 
  576 |         await expect(client.getByRole('heading', { name: /^programme$/i }), 'A15 : section Programme').toBeVisible();
  577 |         await expect(client.getByText(PROGRAM.title, { exact: true }), 'A15 : ligne du programme').toBeVisible();
  578 |         await expect(client.getByText(PROGRAM.participant), 'A15 : artiste du programme').toBeVisible();
  579 |         await expect(client.getByRole('heading', { name: /^lieu et accès$/i }), 'A15 : section des infos pratiques').toBeVisible();
  580 |         for (const text of [PRACTICAL.address, PRACTICAL.access, PRACTICAL.parking, PRACTICAL.rules]) {
  581 |             await expect(client.getByText(text, { exact: true }), `A15 : info pratique « ${text} »`).toBeVisible();
  582 |         }
  583 | 
  584 |         await expect(client.getByRole('button', { name: standard() }), 'Standard en vente en ligne').toBeVisible();
  585 |         await expect(client.getByRole('button', { name: /ajouter un billet découverte/i }), 'Découverte en vente en ligne').toBeVisible();
  586 |         await expect(client.getByRole('button', { name: /ajouter un billet sur place/i }), 'Sur place absente de la vente en ligne').toHaveCount(0);
  587 |         await expect(client.getByRole('button', { name: /ajouter un billet invitations/i }), 'Invitations absente de la vente en ligne').toHaveCount(0);
  588 |         await expect(client.getByRole('heading', { name: 'Sur place', exact: true }), 'Sur place absente de la fiche').toHaveCount(0);
  589 |     });
  590 | 
  591 |     await test.step('inscription depuis l’achat : numéro, code, profil, retour sur la fiche', async () => {
  592 |         await client.getByRole('button', { name: standard() }).click();
  593 |         await client.getByRole('button', { name: /^acheter 1 billet \(/i }).click();
  594 |         await client.waitForURL(/\/login\?redirect=/);
  595 |         await client.getByRole('link', { name: /^créer un compte client$/i }).click();
  596 |         await client.waitForURL(/\/register\?redirect=/);
  597 |         const seen = await smsSeen(r.c1.phone);
  598 |         await client.locator('#inscription-telephone').fill(r.c1.local);
  599 |         await client.getByRole('button', { name: /^recevoir le code par sms$/i }).click();
  600 |         await expect(client.getByText(/^code reçu par sms$/i)).toBeVisible();
  601 |         await fillOtp(client, await smsCode(r.c1.phone, seen, 'inscription du client'));
  602 |         await client.getByLabel(/^prénom/i).fill(r.c1.firstName);
  603 |         await client.getByLabel(/^nom/i).fill('Recette');
  604 |         await client.getByLabel(/^mot de passe/i).first().fill(TEST_PASSWORD);
  605 |         await client.getByRole('button', { name: /^créer mon compte$/i }).click();
  606 |         await client.waitForURL(new RegExp(`/events/${r.e1.id}`), { timeout: 30_000 });
  607 |     });
  608 | 
  609 |     await test.step('appel direct de l’API sur une catégorie non vendue en ligne : refus 400', async () => {
  610 |         const { data, error } = await serviceClient().from('users').select('id').in('phone', [r.c1.phone, r.c1.phone.slice(1)]).single();
  611 |         if (error || !data) throw new Error(`[e2e] compte de C1 : ${error?.message ?? 'introuvable'}`);
  612 |         r.c1.userId = String(data.id);
  613 |         const refused = await client.evaluate(async ({ eventId, categoryId, phone, key }) => {
  614 |             const res = await fetch('/api/checkout', {
  615 |                 method: 'POST',
  616 |                 headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
  617 |                 body: JSON.stringify({ eventId, items: [{ categoryId, quantity: 1 }], operator: 'WAVE', payerPhone: phone }),
  618 |             });
  619 |             return { status: res.status, body: (await res.json()) as { code?: string; problems?: Array<{ code?: string }> } };
  620 |         }, { eventId: r.e1.id, categoryId: r.e1.categories['Sur place'], phone: r.c1.local, key: `recette-${randomUUID()}` });
  621 |         expect(refused.status, `achat direct refusé : ${JSON.stringify(refused.body)}`).toBe(400);
  622 |         expect(refused.body.problems?.map((p) => p.code), `motif du refus : ${JSON.stringify(refused.body)}`).toEqual(['CATEGORY_NOT_SOLD_ONLINE']);
  623 |     });
  624 | 
  625 |     await test.step('achat de 2 Standard, puis achat gratuit', async () => {
  626 |         const [std1, std2] = await buyThroughUi(client, r.e1.id, 'Standard', 2, r.c1.local);
  627 |         r.tickets.std1 = std1;
  628 |         r.tickets.std2 = std2;
  629 | 
  630 |         await Promise.all([client.waitForResponse((res) => pathOf(res.url()) === '/api/auth/me'), client.goto(`/events/${r.e1.id}`)]); // session lue : sinon « Réserver » renvoie à la connexion (app/events/[id]/page.tsx:619)
  631 |         await client.getByRole('button', { name: /ajouter un billet découverte/i }).click();
  632 |         await client.getByRole('button', { name: /^réserver 1 billet gratuit$/i }).click();
  633 |         await client.waitForURL(/\/tickets(\?|$)/);
  634 |         const free = await ticketsOf(r.e1.id, r.c1.userId, r.e1.categories['Découverte']);
  635 |         expect(free.length, 'un billet gratuit émis').toBe(1);
  636 |         r.tickets.free = free[0];
  637 |     });
  638 | 
  639 |     await test.step('Mes billets, service worker autorisé : codes de la veille enregistrés, lot relevé avant le transfert', async () => {
  640 |         const context = await openAnonymousContext(browser, testInfo, 'clair', { storageState: await client.context().storageState(), serviceWorkers: 'allow' });
  641 |         const sw = adopt('C1-hors-ligne', context, await context.newPage());
  642 |         const [n1, n2, nFree] = await ticketNumbers([r.tickets.std1, r.tickets.std2, r.tickets.free]);
  643 |         Object.assign(r.numbers, { std1: n1, std2: n2, free: nFree });
  644 |         await sw.goto('/tickets');
  645 |         for (const number of [n1, n2, nFree]) {
  646 |             const card = sw.locator('li, article').filter({ hasText: number }).last();
  647 |             await expect(card, `carte du billet ${number} dans Mes billets`).toBeVisible({ timeout: 45_000 });
  648 |             await expect(card.locator('[data-ev-offline-state]'), `billet ${number} : « Disponible hors ligne »`).toHaveAttribute('data-ev-offline-state', 'available', { timeout: 60_000 });
  649 |         }
  650 |         const lots = await readStoredLots(sw, r.tickets.std2);
  651 |         expect(lots.length, 'lot du billet à transférer dans IndexedDB').toBe(1);
  652 |         r.oldLot = lots[0];
  653 |     });
  654 | 
  655 |     await test.step('transfert du 2e billet au second client, acceptation', async () => {
  656 |         const recipient = verifyHolderPhone('client-bis');
  657 |         console.log(`[e2e][recette] numéro du second client ${recipient.changed ? 'marqué vérifié' : 'déjà vérifié'}`);
  658 |         await client.goto('/tickets');
  659 |         const card = client.locator('li, article').filter({ hasText: r.numbers.std2 }).last();
  660 |         // Lot 9 bis (R66, §20) : prix et frais de service lus tels que le serveur les sert à la carte
  661 |         const served = await client.evaluate(async (id) => {
  662 |             const res = await fetch('/api/tickets', { cache: 'no-store' });
  663 |             const body = (await res.json()) as { tickets?: Array<{ id: string; price?: number; serviceFee?: number }> };
  664 |             return (body.tickets ?? []).find((t) => t.id === id) ?? null;
  665 |         }, r.tickets.std2);
  666 |         expect(served?.price, 'prix du billet servi à la carte').toBe(6000);
  667 |         await expect(definition(card, 'Prix'), 'prix sur la carte (R66)').toHaveText(fcfa(6000));
  668 |         const fee = Number(served?.serviceFee ?? 0);
  669 |         if (fee > 0) await expect(definition(card, 'Frais de service'), 'frais de service sur la carte (R66)').toHaveText(fcfa(fee));
  670 |         else await expect(card.locator('dt', { hasText: /^Frais de service$/ }), 'aucun frais servi, aucune ligne de frais').toHaveCount(0);
  671 | 
  672 |         await card.getByRole('button', { name: /^transférer$/i }).click();
```