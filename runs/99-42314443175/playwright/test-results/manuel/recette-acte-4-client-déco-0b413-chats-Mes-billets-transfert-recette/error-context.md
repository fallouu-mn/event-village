# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recette.spec.ts >> acte 4 [client] : découverte, fiche, refus direct, inscription depuis l’achat, achats, Mes billets, transfert
- Location: e2e/recette.spec.ts:486:5

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /^acheter 1 billet \(/i })

```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
  - generic [ref=f2e2]:
    - complementary [ref=f2e3]:
      - link "Event Village, accueil" [ref=f2e5] [cursor=pointer]:
        - /url: /
        - generic [ref=f2e11]:
          - generic [ref=f2e12]: EVENT
          - generic [ref=f2e13]: VILLAGE
      - navigation "Navigation principale" [ref=f2e14]:
        - generic [ref=f2e15]: Administration
        - link "Tableau de bord" [ref=f2e20] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=f2e27]:
          - paragraph [ref=f2e28]: Gestion
          - generic [ref=f2e29]:
            - link "Événements" [ref=f2e30] [cursor=pointer]:
              - /url: /admin/events
            - link "Utilisateurs" [ref=f2e34] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=f2e41] [cursor=pointer]:
              - /url: /admin/services
        - generic [ref=f2e47]:
          - paragraph [ref=f2e48]: Finances
          - generic [ref=f2e49]:
            - link "Finance" [ref=f2e50] [cursor=pointer]:
              - /url: /admin/finance
            - link "Tarification" [ref=f2e54] [cursor=pointer]:
              - /url: /admin/pricing
        - generic [ref=f2e57]:
          - paragraph [ref=f2e58]: Engagement
          - generic [ref=f2e59]:
            - link "Parrainage" [ref=f2e60] [cursor=pointer]:
              - /url: /admin/referral
            - link "Communications" [ref=f2e65] [cursor=pointer]:
              - /url: /admin/communications
        - generic [ref=f2e70]:
          - paragraph [ref=f2e71]: Système
          - generic [ref=f2e72]:
            - link "Journal d’audit" [ref=f2e73] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=f2e78] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=f2e85] [cursor=pointer]:
              - /url: /scan
        - link "Retour au site" [ref=f2e94] [cursor=pointer]:
          - /url: /
      - generic [ref=f2e99]:
        - link "Elhadji SuperAdmin Super administrateur" [ref=f2e100] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e101]: ES
          - generic [ref=f2e102]:
            - generic [ref=f2e103]: Elhadji SuperAdmin
            - generic [ref=f2e104]: Super administrateur
        - generic [ref=f2e105]:
          - button "Se déconnecter" [ref=f2e106] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e111] [cursor=pointer]
    - generic [ref=f2e115]:
      - banner [ref=f2e116]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f2e118] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 32 non lues" [ref=f2e125] [cursor=pointer]:
          - generic [ref=f2e129]: "32"
      - main [ref=f2e130]:
        - generic [ref=f2e132]:
          - generic [ref=f2e133]:
            - link "Retour aux événements" [ref=f2e135] [cursor=pointer]:
              - /url: /admin/events
            - generic [ref=f2e140]:
              - generic [ref=f2e141]:
                - generic [ref=f2e142]:
                  - 'generic "Accepté par l’équipe Event Village : l’organisateur peut maintenant le publier." [ref=f2e143]': Validé
                  - generic [ref=f2e146]: Concerts & Musique
                - heading "Recette — Nuit de Ngor 23.55.56" [level=1] [ref=f2e147]
                - paragraph [ref=f2e148]: Recette Productions 23.55.56 · sam. 7 nov. 2026 à 20:00
              - generic [ref=f2e149]:
                - button "Publier" [ref=f2e150] [cursor=pointer]
                - button "Annuler l’événement" [ref=f2e152] [cursor=pointer]
          - generic [ref=f2e154]:
            - generic [ref=f2e155]:
              - region [ref=f2e156]:
                - heading "Dates et lieu" [level=2] [ref=f2e157]
                - generic [ref=f2e158]:
                  - generic [ref=f2e159]:
                    - term [ref=f2e160]: Début
                    - definition [ref=f2e164]: sam. 7 nov. 2026 à 20:00
                  - generic [ref=f2e165]:
                    - term [ref=f2e166]: Fin
                    - definition [ref=f2e171]: dim. 8 nov. 2026 à 00:00
                  - generic [ref=f2e172]:
                    - term [ref=f2e173]: Lieu
                    - definition [ref=f2e178]: Corniche de Ngor, Dakar
                  - generic [ref=f2e179]:
                    - term [ref=f2e180]: Jauge déclarée
                    - definition [ref=f2e187]: 100 personnes
                - generic [ref=f2e188]:
                  - generic [ref=f2e189]:
                    - term [ref=f2e190]: Adresse
                    - definition [ref=f2e191]: 12, route de la Corniche, Ngor
                  - generic [ref=f2e192]:
                    - term [ref=f2e193]: Accès
                    - definition [ref=f2e194]: Entrée principale par la plage de Ngor.
                  - generic [ref=f2e195]:
                    - term [ref=f2e196]: Stationnement
                    - definition [ref=f2e197]: Parking surveillé devant le site.
                  - generic [ref=f2e198]:
                    - term [ref=f2e199]: Règlement
                    - definition [ref=f2e200]: Billet présenté sur téléphone, sans objet en verre.
              - region [ref=f2e201]:
                - heading "Description" [level=2] [ref=f2e202]
                - paragraph [ref=f2e203]: "Soirée de la recette : vente en ligne et au guichet, scan, annulation et finance. Données fictives."
              - region [ref=f2e204]:
                - heading "Programme" [level=2] [ref=f2e205]
                - list [ref=f2e206]:
                  - listitem [ref=f2e207]:
                    - generic [ref=f2e208]: 20:30
                    - generic [ref=f2e209]:
                      - generic [ref=f2e210]:
                        - generic [ref=f2e211]: Grand cercle de recette
                        - generic [ref=f2e212]: Artiste
                      - paragraph [ref=f2e214]: Ensemble des Almadies
              - region [ref=f2e215]:
                - heading "Catégories et prix" [level=2] [ref=f2e216]
                - table [ref=f2e219]:
                  - caption [ref=f2e220]: Catégories de billets, tous canaux et inactives comprises
                  - rowgroup [ref=f2e221]:
                    - row [ref=f2e222]:
                      - columnheader "Catégorie" [ref=f2e223]
                      - columnheader "Prix" [ref=f2e224]
                      - columnheader "Quota" [ref=f2e225]
                      - columnheader "Période de vente" [ref=f2e226]
                      - columnheader "Par commande" [ref=f2e227]
                      - columnheader "Canaux et état" [ref=f2e228]
                  - rowgroup [ref=f2e229]:
                    - row [ref=f2e230]:
                      - cell "Standard" [ref=f2e231]
                      - cell "6 000 F CFA" [ref=f2e234]
                      - cell "50" [ref=f2e235]
                      - cell "Dès la publication · jusqu’à l’événement" [ref=f2e236]
                      - cell "10 au plus" [ref=f2e238]
                      - cell "En ligne et au guichet Active" [ref=f2e239]:
                        - generic [ref=f2e240]:
                          - generic [ref=f2e241]: En ligne et au guichet
                          - generic [ref=f2e243]: Active
                    - row [ref=f2e245]:
                      - cell "Sur place" [ref=f2e246]
                      - cell "5 000 F CFA" [ref=f2e249]
                      - cell "20" [ref=f2e250]
                      - cell "Dès la publication · jusqu’à l’événement" [ref=f2e251]
                      - cell "10 au plus" [ref=f2e253]
                      - cell "Sur place uniquement Active" [ref=f2e254]:
                        - generic [ref=f2e255]:
                          - generic [ref=f2e256]: Sur place uniquement
                          - generic [ref=f2e258]: Active
                    - row [ref=f2e260]:
                      - cell "Invitations" [ref=f2e261]
                      - cell "Gratuit" [ref=f2e264]
                      - cell "10" [ref=f2e265]
                      - cell "Dès la publication · jusqu’à l’événement" [ref=f2e266]
                      - cell "10 au plus" [ref=f2e268]
                      - cell "Invitations seulement Active" [ref=f2e269]:
                        - generic [ref=f2e270]:
                          - generic [ref=f2e271]: Invitations seulement
                          - generic [ref=f2e273]: Active
                    - row [ref=f2e275]:
                      - cell "Découverte" [ref=f2e276]
                      - cell "Gratuit" [ref=f2e279]
                      - cell "20" [ref=f2e280]
                      - cell "Dès la publication · jusqu’à l’événement" [ref=f2e281]
                      - cell "10 au plus" [ref=f2e283]
                      - cell "En ligne uniquement Active" [ref=f2e284]:
                        - generic [ref=f2e285]:
                          - generic [ref=f2e286]: En ligne uniquement
                          - generic [ref=f2e288]: Active
            - generic [ref=f2e290]:
              - region [ref=f2e291]:
                - heading "Affiche" [level=2] [ref=f2e292]
                - img "Affiche de « Recette — Nuit de Ngor 23.55.56 »" [ref=f2e293]
              - region [ref=f2e294]:
                - heading "Organisateur" [level=2] [ref=f2e295]
                - generic [ref=f2e296]:
                  - generic [ref=f2e297]:
                    - term [ref=f2e298]: Structure
                    - definition [ref=f2e304]:
                      - text: Recette Productions 23.55.56
                      - generic [ref=f2e305]: Compte validé
                  - generic [ref=f2e308]:
                    - term [ref=f2e309]: Responsable
                    - definition [ref=f2e316]: Mame Recette
                  - generic [ref=f2e317]:
                    - term [ref=f2e318]: Téléphone
                    - definition [ref=f2e322]:
                      - link "+221779356072" [ref=f2e323] [cursor=pointer]:
                        - /url: tel:+221779356072
                  - generic [ref=f2e324]:
                    - term [ref=f2e325]: Email
                    - definition [ref=f2e330]:
                      - link "p1.9356072@recette.eventvillage.local" [ref=f2e331] [cursor=pointer]:
                        - /url: mailto:p1.9356072@recette.eventvillage.local
                  - generic [ref=f2e332]:
                    - term [ref=f2e333]: Ville
                    - definition [ref=f2e338]: Dakar
              - region [ref=f2e339]:
                - heading "Historique des statuts" [level=2] [ref=f2e340]
                - list [ref=f2e341]:
                  - listitem [ref=f2e342]:
                    - paragraph [ref=f2e344]: En attente de validation → Validé
                    - paragraph [ref=f2e345]: Elhadji SuperAdmin (Administration) · Changement de statut
                    - paragraph [ref=f2e346]:
                      - time [ref=f2e347]: ven. 6 nov. 2026 à 23:56
                  - listitem [ref=f2e348]:
                    - paragraph [ref=f2e350]: Brouillon → En attente de validation
                    - paragraph [ref=f2e351]: Mame Recette (Organisateur) · Changement de statut
                    - paragraph [ref=f2e352]:
                      - time [ref=f2e353]: ven. 6 nov. 2026 à 23:56
                  - listitem [ref=f2e354]:
                    - paragraph [ref=f2e356]: "Création : Brouillon"
                    - paragraph [ref=f2e357]: Mame Recette (Organisateur) · Création
                    - paragraph [ref=f2e358]:
                      - time [ref=f2e359]: ven. 6 nov. 2026 à 23:56
  - alert [ref=f2e360]
```

# Test source

```ts
  416 |         if (catErr) throw new Error(`[e2e] catégories de E1 : ${catErr.message}`);
  417 |         for (const c of cats ?? []) r.e1.categories[String(c.name)] = String(c.id);
  418 |         expect((cats ?? []).map((c) => `${String(c.name)} ${String(c.sale_online)} ${String(c.sale_counter)} ${String(c.is_visible)}`).sort(), 'canaux enregistrés, is_visible en miroir')
  419 |             .toEqual(CATEGORIES.map((c) => `${c.name} ${c.online} ${c.counter} ${c.online}`).sort());
  420 |     });
  421 | 
  422 |     await test.step('soumission par P1, validation par le SUPERADMIN, publication par P1', async () => {
  423 |         await actionWithConfirm(partner, cardOf(partner, r.e1.title, /^soumettre/i), /^soumettre/i);
  424 |         await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(r.e1.title, { exact: true }) }).last()).toContainText(/en attente de validation/i);
  425 | 
  426 |         await admin.goto('/admin/events?status=EN_ATTENTE');
  427 |         await admin.getByRole('link', { name: new RegExp(escapeRe(r.e1.title)) }).click();
  428 |         await admin.waitForURL(/\/admin\/events\/[0-9a-f-]{36}/);
  429 |         await actionWithConfirm(admin, admin.locator('main'), /^valider/i);
  430 |         await expect(admin.getByText(/^validé$/i).first()).toBeVisible();
  431 | 
  432 |         await partner.goto('/partner/events');
  433 |         await actionWithConfirm(partner, cardOf(partner, r.e1.title, /^publier/i), /^publier/i);
  434 |         await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(r.e1.title, { exact: true }) }).last()).toContainText(/publié/i);
  435 |     });
  436 | 
  437 |     await test.step('E2 de P1 à J+2 (RPC du lot 5), Standard 3 000 F : l’annulation de l’acte 7 ne touche pas E1', async () => {
  438 |         const day = dakarDayFrom(new Date(), 2);
  439 |         r.e2.id = await createPublishedEvent({
  440 |             partnerUserId: r.p1.userId,
  441 |             superadminId: await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email),
  442 |             title: r.e2.title,
  443 |             description: 'Concert de la recette destiné à être annulé : remboursement automatique. Données fictives.',
  444 |             startDate: day, startTime: '20:00:00', endDate: day, endTime: '23:00:00',
  445 |             location: 'Corniche de Ngor', city: 'Dakar', capacity: 100,
  446 |             imageUrl: await eventImageUrl(r.e1.id),
  447 |             category: { name: 'Standard', price: 3000, total: 50 },
  448 |         });
  449 |     });
  450 | });
  451 | 
  452 | test('acte 3 [partenaire] : invitation de K1, permission espèces, point d’entrée, PIN régisseur', async () => {
  453 |     const partner = known('P1');
  454 |     await partner.goto(`/partner/events/${r.e1.id}`);
  455 |     await openTab(partner, /^équipe/i);
  456 | 
  457 |     await test.step('invitation de K1 avec la permission espèces, SMS d’activation', async () => {
  458 |         await partner.getByLabel(/^prénom/i).fill(r.k1.firstName);
  459 |         await partner.getByLabel(/^nom/i).first().fill('Controle');
  460 |         await partner.getByLabel(/^téléphone du contrôleur/i).fill(r.k1.local);
  461 |         await partner.getByRole('checkbox', { name: /encaissement en espèces/i }).check();
  462 |         const invited = await expectRoute(partner, 'POST', '/api/partner/team/invite', () => partner.getByRole('button', { name: /^inviter le contrôleur$/i }).click(), 201, 'invitation du contrôleur');
  463 |         expect(String(invited.message ?? ''), 'SMS d’activation parti').toMatch(/SMS avec code d'activation envoyé/);
  464 |     });
  465 | 
  466 |     await test.step('point d’entrée et permission espèces lus sur la fiche du contrôleur', async () => {
  467 |         const card = partner.getByRole('list', { name: /^contrôleurs affectés$/i }).getByRole('listitem').filter({ hasText: r.k1.firstName });
  468 |         await expect(card.getByRole('switch'), 'permission espèces de cette affectation').toHaveAttribute('aria-checked', 'true');
  469 |         await card.getByLabel(/^point d.entrée/i).fill('Porte Ngor');
  470 |         await expectRoute(partner, 'PATCH', '/api/partner/team/entry-point', () => card.getByRole('button', { name: /^enregistrer$/i }).click(), 200, 'point d’entrée');
  471 |     });
  472 | 
  473 |     await test.step('PIN régisseur généré, affiché une fois', async () => {
  474 |         await openTab(partner, /^caisse/i);
  475 |         await partner.getByRole('button', { name: /^générer le code pin$/i }).click();
  476 |         await expectRoute(partner, 'POST', `/api/partner/events/${r.e1.id}/regisseur-pin`, () => partner.getByRole('alertdialog').getByRole('button', { name: /^générer le code$/i }).click(), 200, 'génération du PIN');
  477 |         const dialog = partner.getByRole('dialog', { name: /^nouveau code pin régisseur$/i });
  478 |         await expect(dialog).toBeVisible();
  479 |         r.pin = (await dialog.getByLabel(/^code pin/i).innerText()).trim();
  480 |         expect(r.pin, 'PIN affiché à sa génération').toMatch(/^\d{4,8}$/);
  481 |         await dialog.getByRole('button', { name: /^j’ai noté le code$/i }).click();
  482 |         await expect(partner.getByText(/un code est en place/i)).toBeVisible();
  483 |     });
  484 | });
  485 | 
  486 | test('acte 4 [client] : découverte, fiche, refus direct, inscription depuis l’achat, achats, Mes billets, transfert', async ({ browser }, testInfo) => {
  487 |     const client = await asNew(browser, testInfo, 'C1');
  488 |     const standard = (): RegExp => /ajouter un billet standard/i;
  489 | 
  490 |     await test.step('visiteur : recherche, ville, fiche avec programme et infos pratiques (A15), catégories hors ligne absentes', async () => {
  491 |         await client.goto('/explore');
  492 |         await client.getByLabel(/^rechercher un événement/i).fill(r.e1.title);
  493 |         await client.getByLabel(/^ville/i).selectOption({ label: 'Dakar' });
  494 |         await expect(client.getByRole('link', { name: /Nuit du Sabar/ }), 'recherche : un autre événement de Dakar disparaît').toHaveCount(0);
  495 |         await client.getByRole('link', { name: new RegExp(escapeRe(r.e1.title)) }).first().click();
  496 |         await client.waitForURL(new RegExp(`/events/${r.e1.id}`));
  497 |         await expect(client.getByRole('heading', { level: 1, name: r.e1.title })).toBeVisible();
  498 | 
  499 |         await expect(client.getByRole('heading', { name: /^programme$/i }), 'A15 : section Programme').toBeVisible();
  500 |         await expect(client.getByText(PROGRAM.title, { exact: true }), 'A15 : ligne du programme').toBeVisible();
  501 |         await expect(client.getByText(PROGRAM.participant), 'A15 : artiste du programme').toBeVisible();
  502 |         await expect(client.getByRole('heading', { name: /^lieu et accès$/i }), 'A15 : section des infos pratiques').toBeVisible();
  503 |         for (const text of [PRACTICAL.address, PRACTICAL.access, PRACTICAL.parking, PRACTICAL.rules]) {
  504 |             await expect(client.getByText(text, { exact: true }), `A15 : info pratique « ${text} »`).toBeVisible();
  505 |         }
  506 | 
  507 |         await expect(client.getByRole('button', { name: standard() }), 'Standard en vente en ligne').toBeVisible();
  508 |         await expect(client.getByRole('button', { name: /ajouter un billet découverte/i }), 'Découverte en vente en ligne').toBeVisible();
  509 |         await expect(client.getByRole('button', { name: /ajouter un billet sur place/i }), 'Sur place absente de la vente en ligne').toHaveCount(0);
  510 |         await expect(client.getByRole('button', { name: /ajouter un billet invitations/i }), 'Invitations absente de la vente en ligne').toHaveCount(0);
  511 |         await expect(client.getByRole('heading', { name: 'Sur place', exact: true }), 'Sur place absente de la fiche').toHaveCount(0);
  512 |     });
  513 | 
  514 |     await test.step('inscription depuis l’achat : numéro, code, profil, retour sur la fiche', async () => {
  515 |         await client.getByRole('button', { name: standard() }).click();
> 516 |         await client.getByRole('button', { name: /^acheter 1 billet \(/i }).click();
      |                                                                             ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  517 |         await client.waitForURL(/\/login\?redirect=/);
  518 |         await client.getByRole('link', { name: /^créer un compte client$/i }).click();
  519 |         await client.waitForURL(/\/register\?redirect=/);
  520 |         const seen = await smsSeen(r.c1.phone);
  521 |         await client.locator('#inscription-telephone').fill(r.c1.local);
  522 |         await client.getByRole('button', { name: /^recevoir le code par sms$/i }).click();
  523 |         await expect(client.getByText(/^code reçu par sms$/i)).toBeVisible();
  524 |         await fillOtp(client, await smsCode(r.c1.phone, seen, 'inscription du client'));
  525 |         await client.getByLabel(/^prénom/i).fill(r.c1.firstName);
  526 |         await client.getByLabel(/^nom/i).fill('Recette');
  527 |         await client.getByLabel(/^mot de passe/i).first().fill(TEST_PASSWORD);
  528 |         await client.getByRole('button', { name: /^créer mon compte$/i }).click();
  529 |         await client.waitForURL(new RegExp(`/events/${r.e1.id}`), { timeout: 30_000 });
  530 |     });
  531 | 
  532 |     await test.step('appel direct de l’API sur une catégorie non vendue en ligne : refus 400', async () => {
  533 |         const { data, error } = await serviceClient().from('users').select('id').in('phone', [r.c1.phone, r.c1.phone.slice(1)]).single();
  534 |         if (error || !data) throw new Error(`[e2e] compte de C1 : ${error?.message ?? 'introuvable'}`);
  535 |         r.c1.userId = String(data.id);
  536 |         const refused = await client.evaluate(async ({ eventId, categoryId, phone, key }) => {
  537 |             const res = await fetch('/api/checkout', {
  538 |                 method: 'POST',
  539 |                 headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
  540 |                 body: JSON.stringify({ eventId, items: [{ categoryId, quantity: 1 }], operator: 'WAVE', payerPhone: phone }),
  541 |             });
  542 |             return { status: res.status, body: (await res.json()) as { code?: string; problems?: Array<{ code?: string }> } };
  543 |         }, { eventId: r.e1.id, categoryId: r.e1.categories['Sur place'], phone: r.c1.local, key: `recette-${randomUUID()}` });
  544 |         expect(refused.status, `achat direct refusé : ${JSON.stringify(refused.body)}`).toBe(400);
  545 |         expect(refused.body.problems?.map((p) => p.code), `motif du refus : ${JSON.stringify(refused.body)}`).toEqual(['CATEGORY_NOT_SOLD_ONLINE']);
  546 |     });
  547 | 
  548 |     await test.step('achat de 2 Standard, puis achat gratuit', async () => {
  549 |         const [std1, std2] = await buyThroughUi(client, r.e1.id, 'Standard', 2, r.c1.local);
  550 |         r.tickets.std1 = std1;
  551 |         r.tickets.std2 = std2;
  552 | 
  553 |         await Promise.all([client.waitForResponse((res) => pathOf(res.url()) === '/api/auth/me'), client.goto(`/events/${r.e1.id}`)]); // session lue : sinon « Réserver » renvoie à la connexion (app/events/[id]/page.tsx:619)
  554 |         await client.getByRole('button', { name: /ajouter un billet découverte/i }).click();
  555 |         await client.getByRole('button', { name: /^réserver 1 billet gratuit$/i }).click();
  556 |         await client.waitForURL(/\/tickets(\?|$)/);
  557 |         const free = await ticketsOf(r.e1.id, r.c1.userId, r.e1.categories['Découverte']);
  558 |         expect(free.length, 'un billet gratuit émis').toBe(1);
  559 |         r.tickets.free = free[0];
  560 |     });
  561 | 
  562 |     await test.step('Mes billets, service worker autorisé : codes de la veille enregistrés, lot relevé avant le transfert', async () => {
  563 |         const context = await openAnonymousContext(browser, testInfo, 'clair', { storageState: await client.context().storageState(), serviceWorkers: 'allow' });
  564 |         const sw = adopt('C1-hors-ligne', context, await context.newPage());
  565 |         const [n1, n2, nFree] = await ticketNumbers([r.tickets.std1, r.tickets.std2, r.tickets.free]);
  566 |         Object.assign(r.numbers, { std1: n1, std2: n2, free: nFree });
  567 |         await sw.goto('/tickets');
  568 |         for (const number of [n1, n2, nFree]) {
  569 |             const card = sw.locator('li, article').filter({ hasText: number }).last();
  570 |             await expect(card, `carte du billet ${number} dans Mes billets`).toBeVisible({ timeout: 45_000 });
  571 |             await expect(card.locator('[data-ev-offline-state]'), `billet ${number} : « Disponible hors ligne »`).toHaveAttribute('data-ev-offline-state', 'available', { timeout: 60_000 });
  572 |         }
  573 |         const lots = await readStoredLots(sw, r.tickets.std2);
  574 |         expect(lots.length, 'lot du billet à transférer dans IndexedDB').toBe(1);
  575 |         r.oldLot = lots[0];
  576 |     });
  577 | 
  578 |     await test.step('transfert du 2e billet au second client, acceptation', async () => {
  579 |         const recipient = verifyHolderPhone('client-bis');
  580 |         console.log(`[e2e][recette] numéro du second client ${recipient.changed ? 'marqué vérifié' : 'déjà vérifié'}`);
  581 |         await client.goto('/tickets');
  582 |         const card = client.locator('li, article').filter({ hasText: r.numbers.std2 }).last();
  583 |         await card.getByRole('button', { name: /^transférer$/i }).click();
  584 |         const dialog = client.getByRole('dialog', { name: /^transférer ce billet$/i });
  585 |         await expect(dialog).toBeVisible();
  586 |         await dialog.getByLabel(/^numéro de téléphone du destinataire/i).fill(r.bisPhone);
  587 |         await expectRoute(client, 'POST', `/api/tickets/${r.tickets.std2}/transfer`, () => dialog.getByRole('button', { name: /^envoyer le billet$/i }).click(), 200, 'transfert du billet');
  588 |         await dialog.getByRole('button', { name: /^terminer$/i }).click();
  589 | 
  590 |         const bis = await asRole(browser, testInfo, 'fumee-client-bis');
  591 |         await bis.goto('/tickets?tab=recus');
  592 |         const offer = bis.locator('li, article, section').filter({ hasText: r.e1.title }).filter({ has: bis.getByRole('button', { name: /^accepter le billet$/i }) }).last();
  593 |         await offer.getByRole('button', { name: /^accepter le billet$/i }).click();
  594 |         const confirm = bis.getByRole('dialog').or(bis.getByRole('alertdialog'));
  595 |         await expect(confirm).toBeVisible();
  596 |         await expectRoute(bis, 'POST', /^\/api\/tickets\/transfers\/[^/]+\/claim$/, () => confirm.getByRole('button', { name: /^accepter le billet$/i }).click(), 200, 'acceptation du transfert');
  597 |     });
  598 | 
  599 |     await test.step('le second client achète 2 Standard ; C1 achète un billet de E2', async () => {
  600 |         const bis = known('fumee-client-bis');
  601 |         const [shown, blocked] = await buyThroughUi(bis, r.e1.id, 'Standard', 2, r.bisPhone);
  602 |         r.tickets.refundShown = shown;
  603 |         r.tickets.refundBlocked = blocked;
  604 |         const [nShown, nBlocked] = await ticketNumbers([shown, blocked]);
  605 |         Object.assign(r.numbers, { refundShown: nShown, refundBlocked: nBlocked });
  606 |         const [e2Ticket] = await buyThroughUi(client, r.e2.id, 'Standard', 1, r.c1.local);
  607 |         r.tickets.e2 = e2Ticket;
  608 |     });
  609 | 
  610 |     await test.step('invariants (a) à (t)', async () => {
  611 |         await assertInvariants('recette-client');
  612 |     });
  613 | });
  614 | 
  615 | test('acte 5 [contrôleur] : activation, caisse, scan en ligne et hors ligne, ancien code, saisie manuelle, guichet, reprise, clôture', async ({ browser }, testInfo) => {
  616 |     const page = await asNew(browser, testInfo, 'K1', { probe: true });
```