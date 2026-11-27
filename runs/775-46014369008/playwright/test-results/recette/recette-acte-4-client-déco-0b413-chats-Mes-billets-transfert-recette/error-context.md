# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recette.spec.ts >> acte 4 [client] : découverte, fiche, refus direct, inscription depuis l’achat, achats, Mes billets, transfert
- Location: e2e/recette.spec.ts:563:5

# Error details

```
Error: locator.fill: Error: strict mode violation: getByLabel(/^rechercher un événement/i) resolved to 2 elements:
    1) <input value="" type="search" maxlength="120" id="champ-_r_0_" inputmode="search" autocomplete="off" enterkeyhint="search" placeholder="Titre, lieu, organisateur…" class="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-base text-foreground-strong placeholder:text-muted-foreground transition-colors duration-fast focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 aria-[in…/> aka getByRole('searchbox', { name: 'Rechercher un événement' })
    2) <input value="" type="search" maxlength="120" inputmode="search" autocomplete="off" enterkeyhint="search" id="champ-_R_15anpfl7lb_" placeholder="Titre, lieu, organisateur…" class="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-base text-foreground-strong placeholder:text-muted-foreground transition-colors duration-fast focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70…/> aka getByPlaceholder('Titre, lieu, organisateur…').nth(1)

Call log:
  - waiting for getByLabel(/^rechercher un événement/i)

```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
  - generic [ref=f2e2]:
    - complementary [ref=f2e4]:
      - generic [ref=f2e5]:
        - link "Event Village, accueil" [ref=f2e7] [cursor=pointer]:
          - /url: /
          - generic [ref=f2e8]: Event Village
        - button "Replier la barre latérale" [expanded] [ref=f2e11] [cursor=pointer]
      - navigation "Navigation principale" [ref=f2e16]:
        - generic [ref=f2e17]: Administration
        - link "Tableau de bord" [ref=f2e22] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=f2e29]:
          - paragraph [ref=f2e30]: Gestion
          - generic [ref=f2e31]:
            - link "Événements" [ref=f2e32] [cursor=pointer]:
              - /url: /admin/events
            - link "Comptes" [ref=f2e36] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=f2e43] [cursor=pointer]:
              - /url: /admin/services
            - link "Salles à valider" [ref=f2e49] [cursor=pointer]:
              - /url: /admin/halls
            - link "Produits à vérifier" [ref=f2e55] [cursor=pointer]:
              - /url: /admin/products
        - generic [ref=f2e60]:
          - paragraph [ref=f2e61]: Finances
          - link "Finance" [ref=f2e63] [cursor=pointer]:
            - /url: /admin/finance
        - generic [ref=f2e67]:
          - paragraph [ref=f2e68]: Engagement
          - generic [ref=f2e69]:
            - link "Parrainage" [ref=f2e70] [cursor=pointer]:
              - /url: /admin/referral
            - link "Campagnes" [ref=f2e75] [cursor=pointer]:
              - /url: /admin/communications
            - link "À la une" [ref=f2e80] [cursor=pointer]:
              - /url: /admin/a-la-une
        - generic [ref=f2e84]:
          - paragraph [ref=f2e85]: Système
          - generic [ref=f2e86]:
            - link "Réglages" [ref=f2e87] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Journal d’audit" [ref=f2e92] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=f2e97] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=f2e104] [cursor=pointer]:
              - /url: /scan
            - link "Sécurité du compte" [ref=f2e112] [cursor=pointer]:
              - /url: /admin/securite
        - link "Retour au site" [ref=f2e118] [cursor=pointer]:
          - /url: /
      - generic [ref=f2e123]:
        - link "Elhadji SuperAdmin Super-administrateur" [ref=f2e124] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e126]: ES
          - generic [ref=f2e127]:
            - generic [ref=f2e128]: Elhadji SuperAdmin
            - generic [ref=f2e129]: Super-administrateur
        - generic [ref=f2e130]:
          - button "Se déconnecter" [ref=f2e131] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e136] [cursor=pointer]
    - generic [ref=f2e140]:
      - banner [ref=f2e141]:
        - link "Rechercher un événement…" [ref=f2e143] [cursor=pointer]:
          - /url: /explore
        - generic [ref=f2e148]:
          - button "Notifications, 70 non lues" [ref=f2e150] [cursor=pointer]:
            - generic [ref=f2e154]: "70"
          - button "Elhadji SuperAdmin" [ref=f2e156] [cursor=pointer]:
            - generic [aria-hidden] [ref=f2e157]: ES
      - main [ref=f2e159]:
        - generic [ref=f2e161]:
          - generic [ref=f2e162]:
            - link "Retour aux événements" [ref=f2e164] [cursor=pointer]:
              - /url: /admin/events
            - generic [ref=f2e169]:
              - generic [ref=f2e170]:
                - generic [ref=f2e171]:
                  - 'generic "Accepté par l’équipe Event Village : l’organisateur peut maintenant le publier." [ref=f2e172]': Validé
                  - generic [ref=f2e175]: Concerts & Musique
                - heading "Recette — Nuit de Ngor 14.57.53" [level=1] [ref=f2e176]
                - paragraph [ref=f2e177]: Recette Productions 14.57.53 · sam. 28 nov. 2026 à 11:00
              - generic [ref=f2e178]:
                - button "Publier" [ref=f2e179] [cursor=pointer]
                - button "Annuler l’événement" [ref=f2e181] [cursor=pointer]
                - link "Ouvrir le pilotage" [ref=f2e183] [cursor=pointer]:
                  - /url: /partner/events/1b2d65be-72da-4ee1-9cc9-b6cd48ce016d
                - link "Équipe de cet événement" [ref=f2e189] [cursor=pointer]:
                  - /url: /partner/events/1b2d65be-72da-4ee1-9cc9-b6cd48ce016d?tab=equipe
          - generic [ref=f2e197]:
            - generic [ref=f2e198]:
              - region [ref=f2e199]:
                - heading "Dates et lieu" [level=2] [ref=f2e200]
                - generic [ref=f2e201]:
                  - generic [ref=f2e202]:
                    - term [ref=f2e203]: Début
                    - definition [ref=f2e207]: sam. 28 nov. 2026 à 11:00
                  - generic [ref=f2e208]:
                    - term [ref=f2e209]: Fin
                    - definition [ref=f2e214]: sam. 28 nov. 2026 à 15:00
                  - generic [ref=f2e215]:
                    - term [ref=f2e216]: Lieu
                    - definition [ref=f2e221]: Corniche de Ngor, Dakar
                  - generic [ref=f2e222]:
                    - term [ref=f2e223]: Jauge déclarée
                    - definition [ref=f2e230]: 100 personnes
                - generic [ref=f2e231]:
                  - 'region "Carte : Corniche de Ngor" [ref=f2e232]':
                    - generic:
                      - 'img "Emplacement : Corniche de Ngor" [ref=f2e233] [cursor=pointer]'
                      - generic [ref=f2e234]:
                        - strong [ref=f2e237]: Corniche de Ngor
                        - button "Fermer la bulle" [ref=f2e239] [cursor=pointer]: ×
                    - generic:
                      - generic [ref=f2e240]:
                        - button "Zoom avant" [ref=f2e241] [cursor=pointer]: +
                        - button "Zoom arrière" [ref=f2e242] [cursor=pointer]: −
                      - generic [ref=f2e243]:
                        - text: ©
                        - link "Stadia Maps" [ref=f2e244] [cursor=pointer]:
                          - /url: https://stadiamaps.com/
                        - text: ©
                        - link "OpenMapTiles" [ref=f2e245] [cursor=pointer]:
                          - /url: https://openmaptiles.org/
                        - text: ©
                        - link "contributeurs OpenStreetMap" [ref=f2e246] [cursor=pointer]:
                          - /url: https://www.openstreetmap.org/copyright
                  - link "Voir l’itinéraire" [ref=f2e247] [cursor=pointer]:
                    - /url: https://www.google.com/maps/dir/?api=1&destination=14.693036,-17.446632
                - generic [ref=f2e257]:
                  - generic [ref=f2e258]:
                    - term [ref=f2e259]: Adresse
                    - definition [ref=f2e260]: 12, route de la Corniche, Ngor
                  - generic [ref=f2e261]:
                    - term [ref=f2e262]: Accès
                    - definition [ref=f2e263]: Entrée principale par la plage de Ngor.
                  - generic [ref=f2e264]:
                    - term [ref=f2e265]: Stationnement
                    - definition [ref=f2e266]: Parking surveillé devant le site.
                  - generic [ref=f2e267]:
                    - term [ref=f2e268]: Règlement
                    - definition [ref=f2e269]: Billet présenté sur téléphone, sans objet en verre.
              - region [ref=f2e270]:
                - heading "Description" [level=2] [ref=f2e271]
                - paragraph [ref=f2e272]: "Soirée de la recette : vente en ligne et au guichet, scan, annulation et finance. Données fictives."
              - region [ref=f2e273]:
                - heading "Programme" [level=2] [ref=f2e274]
                - list [ref=f2e275]:
                  - listitem [ref=f2e276]:
                    - generic [ref=f2e277]: 20:30
                    - generic [ref=f2e278]:
                      - generic [ref=f2e279]:
                        - generic [ref=f2e280]: Grand cercle de recette
                        - generic [ref=f2e281]: Artiste
                      - paragraph [ref=f2e283]: Ensemble des Almadies
              - region [ref=f2e284]:
                - heading "Catégories et prix" [level=2] [ref=f2e285]
                - region "Catégories de billets, tous canaux et inactives comprises" [ref=f2e287]:
                  - table [ref=f2e288]:
                    - caption [ref=f2e289]: Catégories de billets, tous canaux et inactives comprises
                    - rowgroup [ref=f2e290]:
                      - row [ref=f2e291]:
                        - columnheader "Catégorie" [ref=f2e292]
                        - columnheader "Prix" [ref=f2e293]
                        - columnheader "Quota" [ref=f2e294]
                        - columnheader "Période de vente" [ref=f2e295]
                        - columnheader "Par commande" [ref=f2e296]
                        - columnheader "Au contrôle" [ref=f2e297]
                        - columnheader "Canaux et état" [ref=f2e298]
                    - rowgroup [ref=f2e299]:
                      - row [ref=f2e300]:
                        - cell "Standard" [ref=f2e301]
                        - cell "6 000 F CFA" [ref=f2e304]
                        - cell "50" [ref=f2e305]
                        - cell "Dès la publication · jusqu’à l’événement" [ref=f2e306]
                        - cell "10 au plus" [ref=f2e308]
                        - cell "Blanc Aucune consigne" [ref=f2e309]:
                          - generic [ref=f2e310]:
                            - generic [ref=f2e311]: Blanc
                            - generic [ref=f2e314]: Aucune consigne
                        - cell "En ligne et au guichet Active" [ref=f2e315]:
                          - generic [ref=f2e316]:
                            - generic [ref=f2e317]: En ligne et au guichet
                            - generic [ref=f2e319]: Active
                      - row [ref=f2e321]:
                        - cell "Sur place" [ref=f2e322]
                        - cell "5 000 F CFA" [ref=f2e325]
                        - cell "20" [ref=f2e326]
                        - cell "Dès la publication · jusqu’à l’événement" [ref=f2e327]
                        - cell "10 au plus" [ref=f2e329]
                        - cell "Noir Aucune consigne" [ref=f2e330]:
                          - generic [ref=f2e331]:
                            - generic [ref=f2e332]: Noir
                            - generic [ref=f2e335]: Aucune consigne
                        - cell "Sur place uniquement Active" [ref=f2e336]:
                          - generic [ref=f2e337]:
                            - generic [ref=f2e338]: Sur place uniquement
                            - generic [ref=f2e340]: Active
                      - row [ref=f2e342]:
                        - cell "Invitations" [ref=f2e343]
                        - cell "Gratuit" [ref=f2e346]
                        - cell "10" [ref=f2e347]
                        - cell "Dès la publication · jusqu’à l’événement" [ref=f2e348]
                        - cell "10 au plus" [ref=f2e350]
                        - cell "Violet Aucune consigne" [ref=f2e351]:
                          - generic [ref=f2e352]:
                            - generic [ref=f2e353]: Violet
                            - generic [ref=f2e356]: Aucune consigne
                        - cell "Invitations seulement Active" [ref=f2e357]:
                          - generic [ref=f2e358]:
                            - generic [ref=f2e359]: Invitations seulement
                            - generic [ref=f2e361]: Active
                      - row [ref=f2e363]:
                        - cell "Découverte" [ref=f2e364]
                        - cell "Gratuit" [ref=f2e367]
                        - cell "20" [ref=f2e368]
                        - cell "Dès la publication · jusqu’à l’événement" [ref=f2e369]
                        - cell "10 au plus" [ref=f2e371]
                        - cell "Rose Aucune consigne" [ref=f2e372]:
                          - generic [ref=f2e373]:
                            - generic [ref=f2e374]: Rose
                            - generic [ref=f2e377]: Aucune consigne
                        - cell "En ligne uniquement Active" [ref=f2e378]:
                          - generic [ref=f2e379]:
                            - generic [ref=f2e380]: En ligne uniquement
                            - generic [ref=f2e382]: Active
              - region [ref=f2e384]:
                - heading "Contrôle à l’entrée" [level=2] [ref=f2e385]
                - paragraph [ref=f2e386]: "Une seule entrée : chaque contrôleur laisse entrer toutes les catégories."
            - generic [ref=f2e387]:
              - region [ref=f2e388]:
                - heading "Affiche" [level=2] [ref=f2e389]
                - img "Affiche de « Recette — Nuit de Ngor 14.57.53 »" [ref=f2e390]
              - region [ref=f2e391]:
                - heading "Organisateur" [level=2] [ref=f2e392]
                - generic [ref=f2e393]:
                  - generic [ref=f2e394]:
                    - term [ref=f2e395]: Structure
                    - definition [ref=f2e401]:
                      - text: Recette Productions 14.57.53
                      - generic [ref=f2e402]: Recette Productions 14.57.53 (enseigne)
                      - generic [ref=f2e403]: Compte validé
                  - generic [ref=f2e406]:
                    - term [ref=f2e407]: Responsable
                    - definition [ref=f2e414]: Mame Recette
                  - generic [ref=f2e415]:
                    - term [ref=f2e416]: Téléphone
                    - definition [ref=f2e420]:
                      - link "+221771473897" [ref=f2e421] [cursor=pointer]:
                        - /url: tel:+221771473897
                  - generic [ref=f2e422]:
                    - term [ref=f2e423]: Email
                    - definition [ref=f2e428]:
                      - link "p1.1473897@recette.eventvillage.local" [ref=f2e429] [cursor=pointer]:
                        - /url: mailto:p1.1473897@recette.eventvillage.local
                  - generic [ref=f2e430]:
                    - term [ref=f2e431]: Ville
                    - definition [ref=f2e436]: Dakar
              - region [ref=f2e437]:
                - heading "Historique des statuts" [level=2] [ref=f2e438]
                - list [ref=f2e439]:
                  - listitem [ref=f2e440]:
                    - paragraph [ref=f2e442]: En attente de validation → Validé
                    - paragraph [ref=f2e443]: Elhadji SuperAdmin (Administration) · Changement de statut
                    - paragraph [ref=f2e444]:
                      - time [ref=f2e445]: ven. 27 nov. 2026 à 14:58
                  - listitem [ref=f2e446]:
                    - paragraph [ref=f2e448]: Brouillon → En attente de validation
                    - paragraph [ref=f2e449]: Mame Recette (Partenaire) · Changement de statut
                    - paragraph [ref=f2e450]:
                      - time [ref=f2e451]: ven. 27 nov. 2026 à 14:58
                  - listitem [ref=f2e452]:
                    - paragraph [ref=f2e454]: "Création : Brouillon"
                    - paragraph [ref=f2e455]: Mame Recette (Partenaire) · Création
                    - paragraph [ref=f2e456]:
                      - time [ref=f2e457]: ven. 27 nov. 2026 à 14:58
  - alert [ref=f2e458]
```

# Test source

```ts
  469 |         await expect(partner.getByRole('heading', { level: 2, name: /^billetterie$/i })).toBeVisible();
  470 |         for (let i = 0; i < CATEGORIES.length; i++) await addCategory(partner, i, CATEGORIES[i]);
  471 |         // Finition 2b (B, C) : étapes « Contrôle à l'entrée » (une seule entrée) puis « Vérifier avant d'envoyer », où se trouve
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
> 569 |         await client.getByLabel(/^rechercher un événement/i).fill(r.e1.title);
      |                                                              ^ Error: locator.fill: Error: strict mode violation: getByLabel(/^rechercher un événement/i) resolved to 2 elements:
  570 |         await client.getByLabel(/^ville/i).selectOption({ label: 'Dakar' });
  571 |         await expect(client.getByRole('link', { name: /Nuit du Sabar/ }), 'recherche : un autre événement de Dakar disparaît').toHaveCount(0);
  572 |         // Design 1b : catalogue d'Explorer en cache 60 s (servi périmé une fois puis renouvelé) : l'événement publié à l'acte
  573 |         // précédent peut manquer au plus une minute ; la page est rechargée (filtres gardés dans l'adresse) jusqu'à 90 s.
  574 |         const e1Link = client.getByRole('link', { name: new RegExp(escapeRe(r.e1.title)) }).first();
  575 |         await expect(async () => {
  576 |             if (await e1Link.count() === 0) await client.reload();
  577 |             await expect(e1Link).toBeVisible({ timeout: 5_000 });
  578 |         }, 'recherche : l’événement publié apparaît (cache de 60 s)').toPass({ timeout: 90_000, intervals: [5_000, 10_000, 15_000] });
  579 |         await e1Link.click();
  580 |         await client.waitForURL(new RegExp(`/events/${r.e1.id}`));
  581 |         await expect(client.getByRole('heading', { level: 1, name: r.e1.title })).toBeVisible();
  582 | 
  583 |         await expect(client.getByRole('heading', { name: /^programme$/i }), 'A15 : section Programme').toBeVisible();
  584 |         await expect(client.getByText(PROGRAM.title, { exact: true }), 'A15 : ligne du programme').toBeVisible();
  585 |         await expect(client.getByText(PROGRAM.participant), 'A15 : artiste du programme').toBeVisible();
  586 |         await expect(client.getByRole('heading', { name: /^lieu et accès$/i }), 'A15 : section des infos pratiques').toBeVisible();
  587 |         // Design 1b : l'adresse est affichée avec la ville (« 12, route de la Corniche, Ngor · Dakar ») : texte contenu
  588 |         await expect(client.getByText(PRACTICAL.address).first(), `A15 : info pratique « ${PRACTICAL.address} »`).toBeVisible();
  589 |         for (const text of [PRACTICAL.access, PRACTICAL.parking, PRACTICAL.rules]) {
  590 |             await expect(client.getByText(text, { exact: true }), `A15 : info pratique « ${text} »`).toBeVisible();
  591 |         }
  592 | 
  593 |         await expect(client.getByRole('button', { name: standard() }), 'Standard en vente en ligne').toBeVisible();
  594 |         await expect(client.getByRole('button', { name: /ajouter un billet découverte/i }), 'Découverte en vente en ligne').toBeVisible();
  595 |         await expect(client.getByRole('button', { name: /ajouter un billet sur place/i }), 'Sur place absente de la vente en ligne').toHaveCount(0);
  596 |         await expect(client.getByRole('button', { name: /ajouter un billet invitations/i }), 'Invitations absente de la vente en ligne').toHaveCount(0);
  597 |         await expect(client.getByRole('heading', { name: 'Sur place', exact: true }), 'Sur place absente de la fiche').toHaveCount(0);
  598 |     });
  599 | 
  600 |     await test.step('inscription depuis l’achat : numéro, code, profil, retour sur la fiche', async () => {
  601 |         await client.getByRole('button', { name: standard() }).click();
  602 |         await client.getByRole('button', { name: /^acheter 1 billet \(/i }).click();
  603 |         await client.waitForURL(/\/login\?redirect=/);
  604 |         await client.getByRole('link', { name: /^créer un compte client$/i }).click();
  605 |         await client.waitForURL(/\/register\?redirect=/);
  606 |         const seen = await smsSeen(r.c1.phone);
  607 |         await client.locator('#inscription-telephone').fill(r.c1.local);
  608 |         await client.getByRole('button', { name: /^recevoir le code par sms$/i }).click();
  609 |         await expect(client.getByText(/^code reçu par sms$/i)).toBeVisible();
  610 |         await fillOtp(client, await smsCode(r.c1.phone, seen, 'inscription du client'));
  611 |         await client.getByLabel(/^prénom/i).fill(r.c1.firstName);
  612 |         await client.getByLabel(/^nom/i).fill('Recette');
  613 |         await client.getByLabel(/^mot de passe/i).first().fill(TEST_PASSWORD);
  614 |         await client.getByRole('button', { name: /^créer mon compte$/i }).click();
  615 |         await client.waitForURL(new RegExp(`/events/${r.e1.id}`), { timeout: 30_000 });
  616 |     });
  617 | 
  618 |     await test.step('appel direct de l’API sur une catégorie non vendue en ligne : refus 400', async () => {
  619 |         const { data, error } = await serviceClient().from('users').select('id').in('phone', [r.c1.phone, r.c1.phone.slice(1)]).single();
  620 |         if (error || !data) throw new Error(`[e2e] compte de C1 : ${error?.message ?? 'introuvable'}`);
  621 |         r.c1.userId = String(data.id);
  622 |         const refused = await client.evaluate(async ({ eventId, categoryId, phone, key }) => {
  623 |             const res = await fetch('/api/checkout', {
  624 |                 method: 'POST',
  625 |                 headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
  626 |                 body: JSON.stringify({ eventId, items: [{ categoryId, quantity: 1 }], operator: 'WAVE', payerPhone: phone }),
  627 |             });
  628 |             return { status: res.status, body: (await res.json()) as { code?: string; problems?: Array<{ code?: string }> } };
  629 |         }, { eventId: r.e1.id, categoryId: r.e1.categories['Sur place'], phone: r.c1.local, key: `recette-${randomUUID()}` });
  630 |         expect(refused.status, `achat direct refusé : ${JSON.stringify(refused.body)}`).toBe(400);
  631 |         expect(refused.body.problems?.map((p) => p.code), `motif du refus : ${JSON.stringify(refused.body)}`).toEqual(['CATEGORY_NOT_SOLD_ONLINE']);
  632 |     });
  633 | 
  634 |     await test.step('achat de 2 Standard, puis achat gratuit', async () => {
  635 |         const [std1, std2] = await buyThroughUi(client, r.e1.id, 'Standard', 2, r.c1.local);
  636 |         r.tickets.std1 = std1;
  637 |         r.tickets.std2 = std2;
  638 | 
  639 |         await Promise.all([client.waitForResponse((res) => pathOf(res.url()) === '/api/auth/me'), client.goto(`/events/${r.e1.id}`)]); // session lue : sinon « Réserver » renvoie à la connexion (app/events/[id]/page.tsx:619)
  640 |         await client.getByRole('button', { name: /ajouter un billet découverte/i }).click();
  641 |         await client.getByRole('button', { name: /^réserver 1 billet gratuit$/i }).click();
  642 |         await client.waitForURL(/\/tickets(\?|$)/);
  643 |         const free = await ticketsOf(r.e1.id, r.c1.userId, r.e1.categories['Découverte']);
  644 |         expect(free.length, 'un billet gratuit émis').toBe(1);
  645 |         r.tickets.free = free[0];
  646 |     });
  647 | 
  648 |     await test.step('Mes billets, service worker autorisé : codes de la veille enregistrés, lot relevé avant le transfert', async () => {
  649 |         const context = await openAnonymousContext(browser, testInfo, 'clair', { storageState: await client.context().storageState(), serviceWorkers: 'allow' });
  650 |         const sw = adopt('C1-hors-ligne', context, await context.newPage());
  651 |         const [n1, n2, nFree] = await ticketNumbers([r.tickets.std1, r.tickets.std2, r.tickets.free]);
  652 |         Object.assign(r.numbers, { std1: n1, std2: n2, free: nFree });
  653 |         await sw.goto('/tickets');
  654 |         for (const number of [n1, n2, nFree]) {
  655 |             const card = sw.locator('li, article').filter({ hasText: number }).last();
  656 |             await expect(card, `carte du billet ${number} dans Mes billets`).toBeVisible({ timeout: 45_000 });
  657 |             await expect(card.locator('[data-ev-offline-state]'), `billet ${number} : « Disponible hors ligne »`).toHaveAttribute('data-ev-offline-state', 'available', { timeout: 60_000 });
  658 |         }
  659 |         const lots = await readStoredLots(sw, r.tickets.std2);
  660 |         expect(lots.length, 'lot du billet à transférer dans IndexedDB').toBe(1);
  661 |         r.oldLot = lots[0];
  662 |     });
  663 | 
  664 |     await test.step('transfert du 2e billet au second client, acceptation', async () => {
  665 |         const recipient = verifyHolderPhone('client-bis');
  666 |         console.log(`[e2e][recette] numéro du second client ${recipient.changed ? 'marqué vérifié' : 'déjà vérifié'}`);
  667 |         await client.goto('/tickets');
  668 |         const card = client.locator('li, article').filter({ hasText: r.numbers.std2 }).last();
  669 |         // Lot 9 bis (R66, §20) : prix et frais de service lus tels que le serveur les sert à la carte
```