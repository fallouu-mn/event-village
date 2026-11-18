# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recette.spec.ts >> acte 4 [client] : découverte, fiche, refus direct, inscription depuis l’achat, achats, Mes billets, transfert
- Location: e2e/recette.spec.ts:563:5

# Error details

```
Error: A15 : info pratique « 12, route de la Corniche, Ngor »

expect(locator).toBeVisible() failed

Locator: getByText('12, route de la Corniche, Ngor', { exact: true })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - A15 : info pratique « 12, route de la Corniche, Ngor » getByText('12, route de la Corniche, Ngor', { exact: true }) with timeout 15000ms
  - waiting for getByText('12, route de la Corniche, Ngor', { exact: true })

```

```yaml
- complementary:
  - link "Event Village, accueil":
    - /url: /
    - text: Event Village
  - navigation "Navigation principale":
    - paragraph: Menu principal
    - link "Accueil":
      - /url: /
      - img
      - text: Accueil
    - link "Explorer":
      - /url: /explore
      - img
      - text: Explorer
    - link "Mes billets":
      - /url: /tickets
      - img
      - text: Mes billets
    - link "Portefeuille":
      - /url: /wallet
      - img
      - text: Portefeuille
    - paragraph: Espaces métier
    - link "Devenir partenaire":
      - /url: /partner/register
      - img
      - text: Devenir partenaire
  - link "Se connecter":
    - /url: /login
  - button "Basculer le thème"
- banner:
  - link "Rechercher un événement, un concert, un restaurant…":
    - /url: /explore
  - button "Notifications"
- main:
  - link "Retour aux événements":
    - /url: /explore
  - button "Partager l’événement"
  - article:
    - img "Affiche de l’événement Recette — Nuit de Ngor 08.01.07"
    - text: Concerts & Musique
    - heading "Recette — Nuit de Ngor 08.01.07" [level=1]
    - paragraph: Organisé par Recette Productions 08.01.07
    - list "Infos de l’événement":
      - listitem:
        - paragraph: Jeudi 19 novembre 2026 à 04:05
        - paragraph: Jusqu’à 08:05
      - listitem:
        - paragraph: Corniche de Ngor
        - paragraph: 12, route de la Corniche, Ngor · Dakar
      - listitem:
        - paragraph: Billet dans l’application
        - paragraph: Présentez son QR code à l’entrée, depuis Mes billets.
    - region "À propos":
      - heading "À propos" [level=2]
      - paragraph: "Soirée de la recette : vente en ligne et au guichet, scan, annulation et finance. Données fictives."
    - region "Programme":
      - heading "Programme" [level=2]
      - list:
        - listitem:
          - paragraph: 20:30
          - text: Artiste
          - paragraph: Grand cercle de recette
          - paragraph: Ensemble des Almadies
    - region "Lieu et accès":
      - heading "Lieu et accès" [level=2]
      - paragraph: Corniche de Ngor
      - paragraph: 12, route de la Corniche, Ngor · Dakar
      - img "Recette — Nuit de Ngor 08.01.07, Corniche de Ngor": Recette — Nuit de Ngor 08.0…
      - button "Afficher la carte"
      - link "Voir l’itinéraire":
        - /url: https://www.google.com/maps/dir/?api=1&destination=14.693078,-17.446632
      - paragraph: Accès et transports
      - text: Entrée principale par la plage de Ngor.
      - paragraph: Stationnement
      - text: Parking surveillé devant le site.
      - paragraph: Paiement
      - text: Wave ou Orange Money, en ligne. Les frais de service s’affichent avant le paiement.
      - paragraph: Règlement et consignes
      - text: Billet présenté sur téléphone, sans objet en verre.
    - region "Organisateur":
      - paragraph: Organisateur
      - paragraph: Recette Productions 08.01.07
  - complementary "Billetterie":
    - heading "Billetterie" [level=2]
    - paragraph: "Choisissez vos billets : places mises à jour en direct."
    - status: En direct
    - list "Catégories de billets":
      - listitem:
        - heading "Standard" [level=3]
        - paragraph: 6 000 F CFA
        - paragraph: Disponible
        - group "Quantité Standard":
          - button "Retirer un billet Standard" [disabled]
          - status: "0"
          - button "Ajouter un billet Standard"
      - listitem:
        - heading "Découverte" [level=3]
        - paragraph: Gratuit
        - paragraph: Disponible
        - group "Quantité Découverte":
          - button "Retirer un billet Découverte" [disabled]
          - status: "0"
          - button "Ajouter un billet Découverte"
    - paragraph: Choisissez au moins un billet avec le bouton « + ».
    - paragraph: Paiement Wave ou Orange Money
    - paragraph: Billet avec QR code dans Mes billets, dès le paiement
- alert: Recette — Nuit de Ngor 08.01.07 — Event Village
```

# Test source

```ts
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
  587 |         for (const text of [PRACTICAL.address, PRACTICAL.access, PRACTICAL.parking, PRACTICAL.rules]) {
> 588 |             await expect(client.getByText(text, { exact: true }), `A15 : info pratique « ${text} »`).toBeVisible();
      |                                                                                                      ^ Error: A15 : info pratique « 12, route de la Corniche, Ngor »
  589 |         }
  590 | 
  591 |         await expect(client.getByRole('button', { name: standard() }), 'Standard en vente en ligne').toBeVisible();
  592 |         await expect(client.getByRole('button', { name: /ajouter un billet découverte/i }), 'Découverte en vente en ligne').toBeVisible();
  593 |         await expect(client.getByRole('button', { name: /ajouter un billet sur place/i }), 'Sur place absente de la vente en ligne').toHaveCount(0);
  594 |         await expect(client.getByRole('button', { name: /ajouter un billet invitations/i }), 'Invitations absente de la vente en ligne').toHaveCount(0);
  595 |         await expect(client.getByRole('heading', { name: 'Sur place', exact: true }), 'Sur place absente de la fiche').toHaveCount(0);
  596 |     });
  597 | 
  598 |     await test.step('inscription depuis l’achat : numéro, code, profil, retour sur la fiche', async () => {
  599 |         await client.getByRole('button', { name: standard() }).click();
  600 |         await client.getByRole('button', { name: /^acheter 1 billet \(/i }).click();
  601 |         await client.waitForURL(/\/login\?redirect=/);
  602 |         await client.getByRole('link', { name: /^créer un compte client$/i }).click();
  603 |         await client.waitForURL(/\/register\?redirect=/);
  604 |         const seen = await smsSeen(r.c1.phone);
  605 |         await client.locator('#inscription-telephone').fill(r.c1.local);
  606 |         await client.getByRole('button', { name: /^recevoir le code par sms$/i }).click();
  607 |         await expect(client.getByText(/^code reçu par sms$/i)).toBeVisible();
  608 |         await fillOtp(client, await smsCode(r.c1.phone, seen, 'inscription du client'));
  609 |         await client.getByLabel(/^prénom/i).fill(r.c1.firstName);
  610 |         await client.getByLabel(/^nom/i).fill('Recette');
  611 |         await client.getByLabel(/^mot de passe/i).first().fill(TEST_PASSWORD);
  612 |         await client.getByRole('button', { name: /^créer mon compte$/i }).click();
  613 |         await client.waitForURL(new RegExp(`/events/${r.e1.id}`), { timeout: 30_000 });
  614 |     });
  615 | 
  616 |     await test.step('appel direct de l’API sur une catégorie non vendue en ligne : refus 400', async () => {
  617 |         const { data, error } = await serviceClient().from('users').select('id').in('phone', [r.c1.phone, r.c1.phone.slice(1)]).single();
  618 |         if (error || !data) throw new Error(`[e2e] compte de C1 : ${error?.message ?? 'introuvable'}`);
  619 |         r.c1.userId = String(data.id);
  620 |         const refused = await client.evaluate(async ({ eventId, categoryId, phone, key }) => {
  621 |             const res = await fetch('/api/checkout', {
  622 |                 method: 'POST',
  623 |                 headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
  624 |                 body: JSON.stringify({ eventId, items: [{ categoryId, quantity: 1 }], operator: 'WAVE', payerPhone: phone }),
  625 |             });
  626 |             return { status: res.status, body: (await res.json()) as { code?: string; problems?: Array<{ code?: string }> } };
  627 |         }, { eventId: r.e1.id, categoryId: r.e1.categories['Sur place'], phone: r.c1.local, key: `recette-${randomUUID()}` });
  628 |         expect(refused.status, `achat direct refusé : ${JSON.stringify(refused.body)}`).toBe(400);
  629 |         expect(refused.body.problems?.map((p) => p.code), `motif du refus : ${JSON.stringify(refused.body)}`).toEqual(['CATEGORY_NOT_SOLD_ONLINE']);
  630 |     });
  631 | 
  632 |     await test.step('achat de 2 Standard, puis achat gratuit', async () => {
  633 |         const [std1, std2] = await buyThroughUi(client, r.e1.id, 'Standard', 2, r.c1.local);
  634 |         r.tickets.std1 = std1;
  635 |         r.tickets.std2 = std2;
  636 | 
  637 |         await Promise.all([client.waitForResponse((res) => pathOf(res.url()) === '/api/auth/me'), client.goto(`/events/${r.e1.id}`)]); // session lue : sinon « Réserver » renvoie à la connexion (app/events/[id]/page.tsx:619)
  638 |         await client.getByRole('button', { name: /ajouter un billet découverte/i }).click();
  639 |         await client.getByRole('button', { name: /^réserver 1 billet gratuit$/i }).click();
  640 |         await client.waitForURL(/\/tickets(\?|$)/);
  641 |         const free = await ticketsOf(r.e1.id, r.c1.userId, r.e1.categories['Découverte']);
  642 |         expect(free.length, 'un billet gratuit émis').toBe(1);
  643 |         r.tickets.free = free[0];
  644 |     });
  645 | 
  646 |     await test.step('Mes billets, service worker autorisé : codes de la veille enregistrés, lot relevé avant le transfert', async () => {
  647 |         const context = await openAnonymousContext(browser, testInfo, 'clair', { storageState: await client.context().storageState(), serviceWorkers: 'allow' });
  648 |         const sw = adopt('C1-hors-ligne', context, await context.newPage());
  649 |         const [n1, n2, nFree] = await ticketNumbers([r.tickets.std1, r.tickets.std2, r.tickets.free]);
  650 |         Object.assign(r.numbers, { std1: n1, std2: n2, free: nFree });
  651 |         await sw.goto('/tickets');
  652 |         for (const number of [n1, n2, nFree]) {
  653 |             const card = sw.locator('li, article').filter({ hasText: number }).last();
  654 |             await expect(card, `carte du billet ${number} dans Mes billets`).toBeVisible({ timeout: 45_000 });
  655 |             await expect(card.locator('[data-ev-offline-state]'), `billet ${number} : « Disponible hors ligne »`).toHaveAttribute('data-ev-offline-state', 'available', { timeout: 60_000 });
  656 |         }
  657 |         const lots = await readStoredLots(sw, r.tickets.std2);
  658 |         expect(lots.length, 'lot du billet à transférer dans IndexedDB').toBe(1);
  659 |         r.oldLot = lots[0];
  660 |     });
  661 | 
  662 |     await test.step('transfert du 2e billet au second client, acceptation', async () => {
  663 |         const recipient = verifyHolderPhone('client-bis');
  664 |         console.log(`[e2e][recette] numéro du second client ${recipient.changed ? 'marqué vérifié' : 'déjà vérifié'}`);
  665 |         await client.goto('/tickets');
  666 |         const card = client.locator('li, article').filter({ hasText: r.numbers.std2 }).last();
  667 |         // Lot 9 bis (R66, §20) : prix et frais de service lus tels que le serveur les sert à la carte
  668 |         const served = await client.evaluate(async (id) => {
  669 |             const res = await fetch('/api/tickets', { cache: 'no-store' });
  670 |             const body = (await res.json()) as { tickets?: Array<{ id: string; price?: number; serviceFee?: number }> };
  671 |             return (body.tickets ?? []).find((t) => t.id === id) ?? null;
  672 |         }, r.tickets.std2);
  673 |         expect(served?.price, 'prix du billet servi à la carte').toBe(6000);
  674 |         await expect(definition(card, 'Prix'), 'prix sur la carte (R66)').toHaveText(fcfa(6000));
  675 |         const fee = Number(served?.serviceFee ?? 0);
  676 |         if (fee > 0) await expect(definition(card, 'Frais de service'), 'frais de service sur la carte (R66)').toHaveText(fcfa(fee));
  677 |         else await expect(card.locator('dt', { hasText: /^Frais de service$/ }), 'aucun frais servi, aucune ligne de frais').toHaveCount(0);
  678 | 
  679 |         await card.getByRole('button', { name: /^transférer$/i }).click();
  680 |         const dialog = client.getByRole('dialog', { name: /^transférer ce billet$/i });
  681 |         await expect(dialog).toBeVisible();
  682 |         await dialog.getByLabel(/^numéro de téléphone du destinataire/i).fill(r.bisPhone);
  683 |         // Lot 9 bis (R57, B35) : sans mot de passe saisi depuis moins de 10 min, refus, boîte « mot de passe », puis le
  684 |         // même transfert repart ; les saisies de C1 sont effacées d'abord pour que l'étape ne dépende pas de l'heure
  685 |         await clearPasswordConfirmations(r.c1.userId);
  686 |         const refused = await expectRoute(client, 'POST', `/api/tickets/${r.tickets.std2}/transfer`, () => dialog.getByRole('button', { name: /^envoyer le billet$/i }).click(), 403, 'transfert sans mot de passe récent');
  687 |         expect(refused.code, 'refus du transfert (R57)').toBe('PASSWORD_CONFIRMATION_REQUIRED');
  688 |         const confirmBox = client.getByRole('dialog', { name: /^confirmez votre mot de passe$/i });
```