# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recette.spec.ts >> acte 4 [client] : découverte, fiche, refus direct, inscription depuis l’achat, achats, Mes billets, transfert
- Location: e2e/recette.spec.ts:540:5

# Error details

```
Error: boîte « mot de passe » ouverte par le refus

expect(locator).toBeVisible() failed

Locator: getByRole('dialog', { name: /^confirmez votre mot de passe$/i })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - boîte « mot de passe » ouverte par le refus getByRole('dialog', { name: /^confirmez votre mot de passe$/i }) with timeout 15000ms
  - waiting for getByRole('dialog', { name: /^confirmez votre mot de passe$/i })

```

```yaml
- complementary:
  - link "Event Village, accueil":
    - /url: /
    - text: EVENT VILLAGE
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
  - link "Awa Recette Client":
    - /url: /profile
  - button "Se déconnecter"
  - button "Basculer le thème"
- banner:
  - link "Rechercher un événement, un concert, un restaurant…":
    - /url: /explore
  - button "Notifications"
- main:
  - status: En direct
  - heading "Mes billets" [level=1]
  - paragraph: "Présentez le QR code de votre billet à l’entrée. Il se renouvelle tout seul : gardez la page ouverte."
  - link "Afficher mes billets hors ligne":
    - /url: /billet/hors-ligne
  - button "Comment marche le transfert ?"
  - link "Réserver un billet":
    - /url: /explore
  - tablist "Filtrer mes billets":
    - tab "À venir" [selected]
    - tab "Tous mes billets"
    - tab "Historique"
    - tab "Reçus"
  - tabpanel "À venir":
    - list:
      - listitem:
        - article "Billet pour Recette — Nuit de Ngor 19.41.52":
          - text: Valable
          - heading "Recette — Nuit de Ngor 19.41.52" [level=2]
          - paragraph: Recette Productions 19.41.52
          - term: Date
          - definition: 12 NOV 2026
          - term: Heure d’accès
          - definition: 15:45
          - term: Lieu
          - definition: Corniche de Ngor
          - term: Catégorie
          - definition: Découverte
          - term: Prix
          - definition: Gratuit
          - img "QR d’entrée dynamique"
          - paragraph: "Numéro du billet : TCK-20261111-FE21DA8463"
          - text: Code renouvelé toutes les 20 s Nouveau code dans 9 secondes
          - paragraph: Une capture d’écran n’est pas acceptée au contrôle.
          - paragraph: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
          - status: Ouvrez ce billet avec du réseau avant d’arriver
          - paragraph: Billet authentique, émis par Event Village
          - paragraph: Présentez ce code au contrôle, billet ouvert dans l’application.
          - button "Transférer"
          - button "Partager le lien de l’événement sur WhatsApp": WhatsApp
          - button "Partager ou copier le lien de l’événement": Lien
          - button "Télécharger le billet en PDF": PDF
          - button "Aide au transfert"
      - listitem:
        - article "Billet pour Recette — Nuit de Ngor 19.41.52":
          - text: Valable
          - heading "Recette — Nuit de Ngor 19.41.52" [level=2]
          - paragraph: Recette Productions 19.41.52
          - term: Date
          - definition: 12 NOV 2026
          - term: Heure d’accès
          - definition: 15:45
          - term: Lieu
          - definition: Corniche de Ngor
          - term: Catégorie
          - definition: Standard
          - term: Prix
          - definition: 6 000 F CFA
          - term: Frais de service
          - definition: 300 F CFA
          - img "QR d’entrée dynamique"
          - paragraph: "Numéro du billet : TCK-20261111-C75A8315BC"
          - text: Code renouvelé toutes les 20 s Nouveau code dans 9 secondes
          - paragraph: Une capture d’écran n’est pas acceptée au contrôle.
          - paragraph: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
          - status: Ouvrez ce billet avec du réseau avant d’arriver
          - paragraph: Billet authentique, émis par Event Village
          - paragraph: Présentez ce code au contrôle, billet ouvert dans l’application.
          - button "Transférer"
          - button "Partager le lien de l’événement sur WhatsApp": WhatsApp
          - button "Partager ou copier le lien de l’événement": Lien
          - button "Télécharger le billet en PDF": PDF
          - button "Aide au transfert"
      - listitem:
        - article "Billet pour Recette — Nuit de Ngor 19.41.52":
          - text: Valable
          - heading "Recette — Nuit de Ngor 19.41.52" [level=2]
          - paragraph: Recette Productions 19.41.52
          - term: Date
          - definition: 12 NOV 2026
          - term: Heure d’accès
          - definition: 15:45
          - term: Lieu
          - definition: Corniche de Ngor
          - term: Catégorie
          - definition: Standard
          - term: Prix
          - definition: 6 000 F CFA
          - term: Frais de service
          - definition: 300 F CFA
          - img "QR d’entrée dynamique"
          - paragraph: "Numéro du billet : TCK-20261111-F16DFD23A1"
          - text: Code renouvelé toutes les 20 s Nouveau code dans 9 secondes
          - paragraph: Une capture d’écran n’est pas acceptée au contrôle.
          - paragraph: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
          - status: Ouvrez ce billet avec du réseau avant d’arriver
          - paragraph: Billet authentique, émis par Event Village
          - paragraph: Présentez ce code au contrôle, billet ouvert dans l’application.
          - button "Transférer"
          - button "Partager le lien de l’événement sur WhatsApp": WhatsApp
          - button "Partager ou copier le lien de l’événement": Lien
          - button "Télécharger le billet en PDF": PDF
          - button "Aide au transfert"
- alert
- dialog "Transférer ce billet":
  - heading "Transférer ce billet" [level=2]
  - paragraph: Billet TCK-20261111-F16DFD23A1 · Standard
  - button "Fermer"
  - paragraph: Recette — Nuit de Ngor 19.41.52
  - paragraph: 12 NOV 2026 à 15:45
  - paragraph: Corniche de Ngor
  - paragraph: Transfert gratuit
  - text: Numéro de téléphone du destinataire (obligatoire)
  - textbox "Numéro de téléphone du destinataire (obligatoire)":
    - /placeholder: 77 123 45 67
    - text: "700000002"
  - paragraph: Le destinataire recevra un SMS. Il devra se connecter avec ce numéro pour accepter le billet sous 48 h.
  - alert:
    - paragraph: Transfert impossible
    - text: Par sécurité, saisissez votre mot de passe pour continuer.
  - paragraph: Ce qui se passe ensuite
  - list:
    - listitem: Dès l’acceptation, un nouveau QR code est créé pour votre proche ; le vôtre ne sert plus.
    - listitem: Sans acceptation sous 48 h, le billet vous revient automatiquement.
    - listitem: Vous pouvez annuler le transfert tant qu’il n’est pas accepté.
  - button "Comment fonctionne le transfert ?"
  - button "Annuler"
  - button "Envoyer le billet"
```

# Test source

```ts
  559 |         }
  560 | 
  561 |         await expect(client.getByRole('button', { name: standard() }), 'Standard en vente en ligne').toBeVisible();
  562 |         await expect(client.getByRole('button', { name: /ajouter un billet découverte/i }), 'Découverte en vente en ligne').toBeVisible();
  563 |         await expect(client.getByRole('button', { name: /ajouter un billet sur place/i }), 'Sur place absente de la vente en ligne').toHaveCount(0);
  564 |         await expect(client.getByRole('button', { name: /ajouter un billet invitations/i }), 'Invitations absente de la vente en ligne').toHaveCount(0);
  565 |         await expect(client.getByRole('heading', { name: 'Sur place', exact: true }), 'Sur place absente de la fiche').toHaveCount(0);
  566 |     });
  567 | 
  568 |     await test.step('inscription depuis l’achat : numéro, code, profil, retour sur la fiche', async () => {
  569 |         await client.getByRole('button', { name: standard() }).click();
  570 |         await client.getByRole('button', { name: /^acheter 1 billet \(/i }).click();
  571 |         await client.waitForURL(/\/login\?redirect=/);
  572 |         await client.getByRole('link', { name: /^créer un compte client$/i }).click();
  573 |         await client.waitForURL(/\/register\?redirect=/);
  574 |         const seen = await smsSeen(r.c1.phone);
  575 |         await client.locator('#inscription-telephone').fill(r.c1.local);
  576 |         await client.getByRole('button', { name: /^recevoir le code par sms$/i }).click();
  577 |         await expect(client.getByText(/^code reçu par sms$/i)).toBeVisible();
  578 |         await fillOtp(client, await smsCode(r.c1.phone, seen, 'inscription du client'));
  579 |         await client.getByLabel(/^prénom/i).fill(r.c1.firstName);
  580 |         await client.getByLabel(/^nom/i).fill('Recette');
  581 |         await client.getByLabel(/^mot de passe/i).first().fill(TEST_PASSWORD);
  582 |         await client.getByRole('button', { name: /^créer mon compte$/i }).click();
  583 |         await client.waitForURL(new RegExp(`/events/${r.e1.id}`), { timeout: 30_000 });
  584 |     });
  585 | 
  586 |     await test.step('appel direct de l’API sur une catégorie non vendue en ligne : refus 400', async () => {
  587 |         const { data, error } = await serviceClient().from('users').select('id').in('phone', [r.c1.phone, r.c1.phone.slice(1)]).single();
  588 |         if (error || !data) throw new Error(`[e2e] compte de C1 : ${error?.message ?? 'introuvable'}`);
  589 |         r.c1.userId = String(data.id);
  590 |         const refused = await client.evaluate(async ({ eventId, categoryId, phone, key }) => {
  591 |             const res = await fetch('/api/checkout', {
  592 |                 method: 'POST',
  593 |                 headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
  594 |                 body: JSON.stringify({ eventId, items: [{ categoryId, quantity: 1 }], operator: 'WAVE', payerPhone: phone }),
  595 |             });
  596 |             return { status: res.status, body: (await res.json()) as { code?: string; problems?: Array<{ code?: string }> } };
  597 |         }, { eventId: r.e1.id, categoryId: r.e1.categories['Sur place'], phone: r.c1.local, key: `recette-${randomUUID()}` });
  598 |         expect(refused.status, `achat direct refusé : ${JSON.stringify(refused.body)}`).toBe(400);
  599 |         expect(refused.body.problems?.map((p) => p.code), `motif du refus : ${JSON.stringify(refused.body)}`).toEqual(['CATEGORY_NOT_SOLD_ONLINE']);
  600 |     });
  601 | 
  602 |     await test.step('achat de 2 Standard, puis achat gratuit', async () => {
  603 |         const [std1, std2] = await buyThroughUi(client, r.e1.id, 'Standard', 2, r.c1.local);
  604 |         r.tickets.std1 = std1;
  605 |         r.tickets.std2 = std2;
  606 | 
  607 |         await Promise.all([client.waitForResponse((res) => pathOf(res.url()) === '/api/auth/me'), client.goto(`/events/${r.e1.id}`)]); // session lue : sinon « Réserver » renvoie à la connexion (app/events/[id]/page.tsx:619)
  608 |         await client.getByRole('button', { name: /ajouter un billet découverte/i }).click();
  609 |         await client.getByRole('button', { name: /^réserver 1 billet gratuit$/i }).click();
  610 |         await client.waitForURL(/\/tickets(\?|$)/);
  611 |         const free = await ticketsOf(r.e1.id, r.c1.userId, r.e1.categories['Découverte']);
  612 |         expect(free.length, 'un billet gratuit émis').toBe(1);
  613 |         r.tickets.free = free[0];
  614 |     });
  615 | 
  616 |     await test.step('Mes billets, service worker autorisé : codes de la veille enregistrés, lot relevé avant le transfert', async () => {
  617 |         const context = await openAnonymousContext(browser, testInfo, 'clair', { storageState: await client.context().storageState(), serviceWorkers: 'allow' });
  618 |         const sw = adopt('C1-hors-ligne', context, await context.newPage());
  619 |         const [n1, n2, nFree] = await ticketNumbers([r.tickets.std1, r.tickets.std2, r.tickets.free]);
  620 |         Object.assign(r.numbers, { std1: n1, std2: n2, free: nFree });
  621 |         await sw.goto('/tickets');
  622 |         for (const number of [n1, n2, nFree]) {
  623 |             const card = sw.locator('li, article').filter({ hasText: number }).last();
  624 |             await expect(card, `carte du billet ${number} dans Mes billets`).toBeVisible({ timeout: 45_000 });
  625 |             await expect(card.locator('[data-ev-offline-state]'), `billet ${number} : « Disponible hors ligne »`).toHaveAttribute('data-ev-offline-state', 'available', { timeout: 60_000 });
  626 |         }
  627 |         const lots = await readStoredLots(sw, r.tickets.std2);
  628 |         expect(lots.length, 'lot du billet à transférer dans IndexedDB').toBe(1);
  629 |         r.oldLot = lots[0];
  630 |     });
  631 | 
  632 |     await test.step('transfert du 2e billet au second client, acceptation', async () => {
  633 |         const recipient = verifyHolderPhone('client-bis');
  634 |         console.log(`[e2e][recette] numéro du second client ${recipient.changed ? 'marqué vérifié' : 'déjà vérifié'}`);
  635 |         await client.goto('/tickets');
  636 |         const card = client.locator('li, article').filter({ hasText: r.numbers.std2 }).last();
  637 |         // Lot 9 bis (R66, §20) : prix et frais de service lus tels que le serveur les sert à la carte
  638 |         const served = await client.evaluate(async (id) => {
  639 |             const res = await fetch('/api/tickets', { cache: 'no-store' });
  640 |             const body = (await res.json()) as { tickets?: Array<{ id: string; price?: number; serviceFee?: number }> };
  641 |             return (body.tickets ?? []).find((t) => t.id === id) ?? null;
  642 |         }, r.tickets.std2);
  643 |         expect(served?.price, 'prix du billet servi à la carte').toBe(6000);
  644 |         await expect(definition(card, 'Prix'), 'prix sur la carte (R66)').toHaveText(fcfa(6000));
  645 |         const fee = Number(served?.serviceFee ?? 0);
  646 |         if (fee > 0) await expect(definition(card, 'Frais de service'), 'frais de service sur la carte (R66)').toHaveText(fcfa(fee));
  647 |         else await expect(card.locator('dt', { hasText: /^Frais de service$/ }), 'aucun frais servi, aucune ligne de frais').toHaveCount(0);
  648 | 
  649 |         await card.getByRole('button', { name: /^transférer$/i }).click();
  650 |         const dialog = client.getByRole('dialog', { name: /^transférer ce billet$/i });
  651 |         await expect(dialog).toBeVisible();
  652 |         await dialog.getByLabel(/^numéro de téléphone du destinataire/i).fill(r.bisPhone);
  653 |         // Lot 9 bis (R57, B35) : sans mot de passe saisi depuis moins de 10 min, refus, boîte « mot de passe », puis le
  654 |         // même transfert repart ; les saisies de C1 sont effacées d'abord pour que l'étape ne dépende pas de l'heure
  655 |         await clearPasswordConfirmations(r.c1.userId);
  656 |         const refused = await expectRoute(client, 'POST', `/api/tickets/${r.tickets.std2}/transfer`, () => dialog.getByRole('button', { name: /^envoyer le billet$/i }).click(), 403, 'transfert sans mot de passe récent');
  657 |         expect(refused.code, 'refus du transfert (R57)').toBe('PASSWORD_CONFIRMATION_REQUIRED');
  658 |         const confirmBox = client.getByRole('dialog', { name: /^confirmez votre mot de passe$/i });
> 659 |         await expect(confirmBox, 'boîte « mot de passe » ouverte par le refus').toBeVisible();
      |                                                                                 ^ Error: boîte « mot de passe » ouverte par le refus
  660 |         await confirmBox.getByLabel(/^mot de passe/i).fill(TEST_PASSWORD);
  661 |         const resent = client.waitForResponse((res) => res.request().method() === 'POST' && pathOf(res.url()) === `/api/tickets/${r.tickets.std2}/transfer`);
  662 |         await expectRoute(client, 'POST', '/api/account/password-confirm', () => confirmBox.getByRole('button', { name: /^confirmer$/i }).click(), 200, 'mot de passe confirmé');
  663 |         const resentRes = await resent;
  664 |         expect(resentRes.status(), `transfert relancé après la confirmation : ${(await resentRes.text()).slice(0, 300)}`).toBe(200);
  665 |         await dialog.getByRole('button', { name: /^terminer$/i }).click();
  666 | 
  667 |         const bis = await asRole(browser, testInfo, 'fumee-client-bis');
  668 |         await bis.goto('/tickets?tab=recus');
  669 |         const offer = bis.locator('li, article, section').filter({ hasText: r.e1.title }).filter({ has: bis.getByRole('button', { name: /^accepter le billet$/i }) }).last();
  670 |         await offer.getByRole('button', { name: /^accepter le billet$/i }).click();
  671 |         const confirm = bis.getByRole('dialog').or(bis.getByRole('alertdialog'));
  672 |         await expect(confirm).toBeVisible();
  673 |         await expectRoute(bis, 'POST', /^\/api\/tickets\/transfers\/[^/]+\/claim$/, () => confirm.getByRole('button', { name: /^accepter le billet$/i }).click(), 200, 'acceptation du transfert');
  674 |     });
  675 | 
  676 |     await test.step('le second client achète 2 Standard ; C1 achète un billet de E2', async () => {
  677 |         const bis = known('fumee-client-bis');
  678 |         const [shown, blocked] = await buyThroughUi(bis, r.e1.id, 'Standard', 2, r.bisPhone);
  679 |         r.tickets.refundShown = shown;
  680 |         r.tickets.refundBlocked = blocked;
  681 |         const [nShown, nBlocked] = await ticketNumbers([shown, blocked]);
  682 |         Object.assign(r.numbers, { refundShown: nShown, refundBlocked: nBlocked });
  683 |         const [e2Ticket] = await buyThroughUi(client, r.e2.id, 'Standard', 1, r.c1.local);
  684 |         r.tickets.e2 = e2Ticket;
  685 |     });
  686 | 
  687 |     await test.step('invariants (a) à (t)', async () => {
  688 |         await assertInvariants('recette-client');
  689 |     });
  690 | });
  691 | 
  692 | test('acte 5 [contrôleur] : activation, caisse, scan en ligne et hors ligne, ancien code, saisie manuelle, guichet, reprise, clôture', async ({ browser }, testInfo) => {
  693 |     const page = await asNew(browser, testInfo, 'K1', { probe: true });
  694 |     const client = known('C1');
  695 |     const sw = known('C1-hors-ligne');
  696 |     const receiptTo = local('75');
  697 | 
  698 |     await test.step('activation du compte par le code du SMS d’invitation', async () => {
  699 |         await page.goto(`/controller/setup?phone=${encodeURIComponent(r.k1.phone)}`);
  700 |         await expect(page.getByRole('heading', { level: 1, name: /^activer votre compte contrôleur$/i })).toBeVisible();
  701 |         await fillOtp(page, await smsCode(r.k1.phone, new Set(), 'invitation du contrôleur'));
  702 |         await page.getByLabel(/^mot de passe/i).first().fill(TEST_PASSWORD);
  703 |         await page.getByLabel(/^confirmer le mot de passe/i).fill(TEST_PASSWORD);
  704 |         await page.getByRole('button', { name: /^activer mon compte$/i }).click();
  705 |         await page.waitForURL(/\/controller\/scanner/, { timeout: 30_000 });
  706 |     });
  707 | 
  708 |     await test.step('ouverture du contrôle à sa porte et de la caisse', async () => {
  709 |         await openScanner(page, r.e1.title);
  710 |         await openTab(page, /^caisse$/i);
  711 |         await page.getByRole('button', { name: /^ouvrir ma caisse$/i }).click();
  712 |         const dialog = page.getByRole('dialog', { name: /^ouvrir ma caisse$/i });
  713 |         await expect(dialog).toBeVisible();
  714 |         await dialog.getByLabel(/^fonds de caisse/i).fill('5000');
  715 |         // Lot 9 bis (R42, A11) : PIN du régisseur obligatoire, celui généré par P1 à l'acte 3
  716 |         await dialog.getByLabel(/^code pin du régisseur/i).fill(r.pin);
  717 |         await expectRoute(page, 'POST', '/api/controller/shifts/open', () => dialog.getByRole('button', { name: /^ouvrir la caisse$/i }).click(), 200, 'ouverture de la caisse');
  718 |         await openTab(page, /^contrôle$/i);
  719 |         await videoPlaying(page, 'retour au contrôle après l’ouverture de la caisse');
  720 |     });
  721 | 
  722 |     await test.step('scan en ligne du billet gratuit, code du porteur', async () => {
  723 |         await expectScan(page, await livePayload(client, r.tickets.free), 'billet gratuit en ligne', 'valid');
  724 |         expect(await ticketStatus(r.tickets.free), 'billet gratuit composté').toBe('UTILISE');
  725 |     });
  726 | 
  727 |     await test.step('téléphone du client hors ligne : QR accepté', async () => {
  728 |         await sw.context().setOffline(true);
  729 |         byWho.get('C1-hors-ligne')?.guard.freeze(); // passage hors ligne volontaire : la collecte d'erreurs s'arrête
  730 |         const res = await sw.goto(`/billet/hors-ligne?id=${encodeURIComponent(r.tickets.std1)}`);
  731 |         expect(res?.fromServiceWorker(), '/billet/hors-ligne hors ligne : réponse servie par le service worker').toBe(true);
  732 |         const qr = sw.locator('[data-ev-qr-payload]');
  733 |         await expect(qr, 'QR du billet affiché hors ligne').toBeVisible({ timeout: 20_000 });
  734 |         const payload = String(await qr.getAttribute('data-ev-qr-payload'));
  735 |         expect(payload, 'payload affiché hors ligne : <préfixe>:<billet>:<6 chiffres>').toMatch(new RegExp(`:${r.tickets.std1}:\\d{6}$`));
  736 |         await expectScan(page, payload, 'billet présenté hors ligne', 'valid');
  737 |         await sw.context().setOffline(false);
  738 |         expect(await ticketStatus(r.tickets.std1), 'billet hors ligne composté').toBe('UTILISE');
  739 |     });
  740 | 
  741 |     await test.step('ancien code du billet transféré : refusé', async () => {
  742 |         if (!r.oldLot) throw new Error('lot d’avant le transfert absent (acte 4)');
  743 |         await expectScan(page, payloadFromLot(r.oldLot).payload, 'ancien code du billet transféré', 'qr_expired');
  744 |     });
  745 | 
  746 |     await test.step('saisie manuelle du billet transféré, pièce conforme', async () => {
  747 |         // Le transfert renumérote le billet (ticket_transfer_accept) : l'ancien numéro ne vaut plus rien
  748 |         [r.numbers.std2] = await ticketNumbers([r.tickets.std2]);
  749 |         await page.getByRole('button', { name: /^saisie manuelle$/i }).click();
  750 |         await page.getByLabel(/^numéro du billet/i).fill(r.numbers.std2);
  751 |         await page.getByRole('button', { name: /^vérifier le billet$/i }).click();
  752 |         await expect(page.getByRole('heading', { name: new RegExp(`billet ${escapeRe(r.numbers.std2)}`, 'i') })).toBeVisible();
  753 |         await page.getByRole('checkbox', { name: /^pièce d.identité conforme au titulaire/i }).check();
  754 |         await page.getByRole('button', { name: /^pièce conforme, valider l.entrée$/i }).click();
  755 |         await expect(page.locator('[data-scan-result="valid"]').first(), 'saisie manuelle : entrée validée').toBeVisible();
  756 |         await resultClosed(page);
  757 |         expect(await ticketStatus(r.tickets.std2), 'billet saisi à la main composté').toBe('UTILISE');
  758 |         await page.getByRole('button', { name: /^caméra$/i }).click();
  759 |         await videoPlaying(page, 'retour à la caméra');
```