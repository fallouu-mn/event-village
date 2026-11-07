# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recette.spec.ts >> acte 5 [contrôleur] : activation, caisse, scan en ligne et hors ligne, ancien code, saisie manuelle, guichet, reprise, clôture
- Location: e2e/recette.spec.ts:615:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /billet TCK-20261107-BFB2FA98AB/i })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: /billet TCK-20261107-BFB2FA98AB/i }) with timeout 15000ms
  - waiting for getByRole('heading', { name: /billet TCK-20261107-BFB2FA98AB/i })

```

```yaml
- banner:
  - link "Mon espace client":
    - /url: /
  - link "Event Village, accueil":
    - /url: /
    - text: EVENT VILLAGE
  - button "Notifications, 1 non lue": "1"
  - link "Modou Controle":
    - /url: /controller/profile
- main:
  - heading "Recette — Nuit de Ngor 00.04.52" [level=1]
  - paragraph:
    - status: "Porte Porte Ngor : 2 entrées"
    - text: En ligne
  - button "Changer d’événement"
  - button "Se déconnecter"
  - tablist "Espace du contrôleur":
    - tab "Contrôle" [selected]
    - tab "Guichet"
    - tab "Caisse"
  - tabpanel "Contrôle":
    - text: Numéro du billet
    - textbox "Numéro du billet":
      - /placeholder: TCK-20261101-XXXXXXXXXX
      - text: TCK-20261107-BFB2FA98AB
    - paragraph: "Spectateur sans téléphone : saisissez le numéro imprimé sur son billet, puis vérifiez le titulaire avant de valider."
    - button "Vérifier le billet"
    - alert:
      - paragraph: Aucun billet de cet événement ne porte ce numéro
      - text: Vérifiez la saisie avec le spectateur. Aucune entrée n’a été validée.
    - group "Mode de contrôle":
      - button "Caméra"
      - button "Saisie manuelle" [pressed]
    - 'button "Derniers scans Vous : 2 entrées, 1 refus"'
    - group: Réglages de cet appareil
- alert
```

# Test source

```ts
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
  617 |     const client = known('C1');
  618 |     const sw = known('C1-hors-ligne');
  619 |     const receiptTo = local('75');
  620 | 
  621 |     await test.step('activation du compte par le code du SMS d’invitation', async () => {
  622 |         await page.goto(`/controller/setup?phone=${encodeURIComponent(r.k1.phone)}`);
  623 |         await expect(page.getByRole('heading', { level: 1, name: /^activer votre compte contrôleur$/i })).toBeVisible();
  624 |         await fillOtp(page, await smsCode(r.k1.phone, new Set(), 'invitation du contrôleur'));
  625 |         await page.getByLabel(/^mot de passe/i).first().fill(TEST_PASSWORD);
  626 |         await page.getByLabel(/^confirmer le mot de passe/i).fill(TEST_PASSWORD);
  627 |         await page.getByRole('button', { name: /^activer mon compte$/i }).click();
  628 |         await page.waitForURL(/\/controller\/scanner/, { timeout: 30_000 });
  629 |     });
  630 | 
  631 |     await test.step('ouverture du contrôle à sa porte et de la caisse', async () => {
  632 |         await openScanner(page, r.e1.title);
  633 |         await openTab(page, /^caisse$/i);
  634 |         await page.getByRole('button', { name: /^ouvrir ma caisse$/i }).click();
  635 |         const dialog = page.getByRole('dialog', { name: /^ouvrir ma caisse$/i });
  636 |         await expect(dialog).toBeVisible();
  637 |         await dialog.getByLabel(/^fonds de caisse/i).fill('5000');
  638 |         await expectRoute(page, 'POST', '/api/controller/shifts/open', () => dialog.getByRole('button', { name: /^ouvrir la caisse$/i }).click(), 200, 'ouverture de la caisse');
  639 |         await openTab(page, /^contrôle$/i);
  640 |         await videoPlaying(page, 'retour au contrôle après l’ouverture de la caisse');
  641 |     });
  642 | 
  643 |     await test.step('scan en ligne du billet gratuit, code du porteur', async () => {
  644 |         await expectScan(page, await livePayload(client, r.tickets.free), 'billet gratuit en ligne', 'valid');
  645 |         expect(await ticketStatus(r.tickets.free), 'billet gratuit composté').toBe('UTILISE');
  646 |     });
  647 | 
  648 |     await test.step('téléphone du client hors ligne : QR accepté', async () => {
  649 |         await sw.context().setOffline(true);
  650 |         byWho.get('C1-hors-ligne')?.guard.freeze(); // passage hors ligne volontaire : la collecte d'erreurs s'arrête
  651 |         const res = await sw.goto(`/billet/hors-ligne?id=${encodeURIComponent(r.tickets.std1)}`);
  652 |         expect(res?.fromServiceWorker(), '/billet/hors-ligne hors ligne : réponse servie par le service worker').toBe(true);
  653 |         const qr = sw.locator('[data-ev-qr-payload]');
  654 |         await expect(qr, 'QR du billet affiché hors ligne').toBeVisible({ timeout: 20_000 });
  655 |         const payload = String(await qr.getAttribute('data-ev-qr-payload'));
  656 |         expect(payload, 'payload affiché hors ligne : <préfixe>:<billet>:<6 chiffres>').toMatch(new RegExp(`:${r.tickets.std1}:\\d{6}$`));
  657 |         await expectScan(page, payload, 'billet présenté hors ligne', 'valid');
  658 |         await sw.context().setOffline(false);
  659 |         expect(await ticketStatus(r.tickets.std1), 'billet hors ligne composté').toBe('UTILISE');
  660 |     });
  661 | 
  662 |     await test.step('ancien code du billet transféré : refusé', async () => {
  663 |         if (!r.oldLot) throw new Error('lot d’avant le transfert absent (acte 4)');
  664 |         await expectScan(page, payloadFromLot(r.oldLot).payload, 'ancien code du billet transféré', 'qr_expired');
  665 |     });
  666 | 
  667 |     await test.step('saisie manuelle du billet transféré, pièce conforme', async () => {
  668 |         await page.getByRole('button', { name: /^saisie manuelle$/i }).click();
  669 |         await page.getByLabel(/^numéro du billet/i).fill(r.numbers.std2);
  670 |         await page.getByRole('button', { name: /^vérifier le billet$/i }).click();
> 671 |         await expect(page.getByRole('heading', { name: new RegExp(`billet ${escapeRe(r.numbers.std2)}`, 'i') })).toBeVisible();
      |                                                                                                                  ^ Error: expect(locator).toBeVisible() failed
  672 |         await page.getByRole('checkbox', { name: /^pièce d.identité conforme au titulaire/i }).check();
  673 |         await page.getByRole('button', { name: /^pièce conforme, valider l.entrée$/i }).click();
  674 |         await expect(page.locator('[data-scan-result="valid"]').first(), 'saisie manuelle : entrée validée').toBeVisible();
  675 |         await resultClosed(page);
  676 |         expect(await ticketStatus(r.tickets.std2), 'billet saisi à la main composté').toBe('UTILISE');
  677 |         await page.getByRole('button', { name: /^caméra$/i }).click();
  678 |         await videoPlaying(page, 'retour à la caméra');
  679 |     });
  680 | 
  681 |     await test.step('guichet : Sur place avec sa mention, Invitations et Découverte absentes, vente, reçu', async () => {
  682 |         await openTab(page, /^guichet$/i);
  683 |         const list = page.getByRole('list', { name: /^catégories en vente$/i });
  684 |         const onSite = list.getByRole('listitem').filter({ hasText: 'Sur place' });
  685 |         await expect(onSite.getByText('Sur place uniquement', { exact: true }), 'mention de la catégorie vendue au guichet seulement').toBeVisible();
  686 |         await expect(list.getByRole('listitem'), 'guichet : seules les catégories vendues au guichet').toHaveCount(2);
  687 |         await page.getByRole('button', { name: /^ajouter un billet sur place$/i }).click();
  688 |         await expect(page.getByRole('region', { name: /^total à encaisser$/i })).toContainText(/5\s000/);
  689 |         await page.getByLabel(/^numéro de l.acheteur/i).fill(receiptTo);
  690 |         const sold = await expectRoute(page, 'POST', '/api/controller/counter-sale', () => page.getByRole('button', { name: /^j.ai reçu .*valider la vente$/i }).click(), 200, 'vente au guichet');
  691 |         expect(sold.receipt_queued, `reçu SMS mis en file : ${JSON.stringify(sold)}`).toBe(true);
  692 |         await expect(page.getByText(/reçu sms envoyé à l.acheteur/i), 'vente et reçu annoncés').toBeVisible();
  693 |     });
  694 | 
  695 |     await test.step('reprise de session : sortie puis retour, même événement, « Reprendre le contrôle »', async () => {
  696 |         await openTab(page, /^contrôle$/i);
  697 |         await videoPlaying(page, 'retour au contrôle après le guichet');
  698 |         await page.goto('/controller/profile');
  699 |         await expect(page.getByRole('heading', { level: 1 }).first(), 'page du profil du contrôleur ouverte').toBeVisible({ timeout: 30_000 });
  700 |         await page.goBack();
  701 |         await expectResumed(page, r.e1.title, 'camera', 'retour depuis le profil');
  702 |         await page.getByRole('button', { name: /^reprendre le contr[ôo]le$/i }).click();
  703 |         await videoPlaying(page, '« Reprendre le contrôle »');
  704 |     });
  705 | 
  706 |     await test.step('clôture de caisse sans écart, Z de caisse', async () => {
  707 |         await openTab(page, /^caisse$/i);
  708 |         await page.getByRole('button', { name: /^clôturer ma caisse$/i }).click();
  709 |         const dialog = page.getByRole('dialog', { name: /^clôturer ma caisse$/i });
  710 |         await expect(dialog).toBeVisible();
  711 |         await dialog.getByLabel(/^espèces encaissées comptées/i).fill('5000');
  712 |         await expectRoute(page, 'POST', '/api/controller/shifts/close', () => dialog.getByRole('button', { name: /^clôturer la caisse$/i }).click(), 200, 'clôture sans écart');
  713 |         const z = page.getByRole('dialog', { name: /^caisse clôturée$/i });
  714 |         await expect(z).toBeVisible();
  715 |         await z.getByRole('button', { name: /^terminé$/i }).click();
  716 |     });
  717 | 
  718 |     await test.step('invariants (a) à (t), puis reçu du guichet arrivé au faux MTarget', async () => {
  719 |         await assertInvariants('recette-controleur');
  720 |         const receipts = await fakeSmsTo(`+221${receiptTo}`);
  721 |         expect(receipts.length, 'reçu de la vente au guichet envoyé par la boîte d’envoi').toBe(1);
  722 |     });
  723 | });
  724 | 
  725 | test('acte 6 [partenaire] : pilotage, rapport de clôture, export, retrait, remboursement d’un billet à l’écran', async () => {
  726 |     const partner = known('P1');
  727 | 
  728 |     await test.step('pilotage : vendus, entrées, espèces, caisse clôturée', async () => {
  729 |         await partner.goto(`/partner/events/${r.e1.id}`);
  730 |         await openTab(partner, /^aperçu/i);
  731 |         const panel = partner.getByRole('tabpanel');
  732 |         // 2 Standard de C1, 2 du second client, 1 gratuit, 1 au guichet ; entrées : gratuit, hors ligne, saisie manuelle, guichet
  733 |         await expect(kpi(panel, /billets vendus/i)).toContainText(/(^|\D)6(\D|$)/);
  734 |         await expect(kpi(panel, /^entrées/i)).toContainText(/(^|\D)4(\D|$)/);
  735 |         await openTab(partner, /^caisse/i);
  736 |         await expect(kpi(partner.getByRole('tabpanel'), /^espèces encaissées/i)).toContainText(/5\s000/);
  737 |         await expect(kpi(partner.getByRole('tabpanel'), /^caisses clôturées/i)).toContainText(/(^|\D)1(\D|$)/);
  738 |     });
  739 | 
  740 |     await test.step('export des participants, journalisé', async () => {
  741 |         await openTab(partner, /^clôture/i);
  742 |         const exported = partner.waitForResponse((res) => pathOf(res.url()) === `/api/partner/events/${r.e1.id}/participants-export`);
  743 |         await partner.getByRole('button', { name: /^exporter les participants$/i }).click();
  744 |         const res = await exported;
  745 |         expect(res.status(), 'export des participants').toBe(200);
  746 |         expect(await res.text(), 'export : les billets de l’événement').toContain('Standard');
  747 |         const { data, error } = await serviceClient().from('participant_exports').select('event_id').eq('id', String(res.headers()['x-export-id'])).maybeSingle();
  748 |         if (error) throw new Error(`[e2e] journal des exports : ${error.message}`);
  749 |         expect(data?.event_id, 'export écrit au journal').toBe(r.e1.id);
  750 |     });
  751 | 
  752 |     await test.step('rapport de clôture du tableau de bord : libellés, PDF', async () => {
  753 |         await partner.goto('/partner/dashboard');
  754 |         await partner.locator('tr').filter({ hasText: r.e1.title }).getByRole('button', { name: /^clôture$/i }).click();
  755 |         const dialog = partner.getByRole('dialog', { name: /^rapport de clôture$/i });
  756 |         await expect(dialog).toBeVisible();
  757 |         await expect(dialog.getByText(/^généré le/i)).toBeVisible();
  758 |         await expect(dialog.getByText('Entrées validées', { exact: true })).toBeVisible();
  759 |         await expectRoute(partner, 'GET', '/api/partner/reports/closing/pdf', () => dialog.getByRole('button', { name: /^télécharger le pdf$/i }).click(), 200, 'rapport PDF');
  760 |         await dialog.getByRole('button', { name: /^fermer$/i }).click();
  761 |         await expect(dialog).toBeHidden();
  762 |     });
  763 | 
  764 |     await test.step('/partner/finance : code SMS, retrait de 6 000 F, frais de 60 F, envoi au faux SamirPay', async () => {
  765 |         await partner.goto('/partner/finance');
  766 |         const wave = partner.getByRole('radio', { name: /^wave/i });
  767 |         await wave.dispatchEvent('click');
  768 |         await expect(wave).toBeChecked();
  769 |         await partner.getByLabel(/qui reçoit le retrait/i).fill(r.p1.local);
  770 |         await partner.getByLabel(/^montant à retirer/i).fill('6000');
  771 |         const seen = await smsSeen(r.p1.phone);
```