# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recette.spec.ts >> acte 9 [partenaire] [client] [contrôleur] : invitation d’un numéro sans compte, inscription, réclamation, entrée
- Location: e2e/recette.spec.ts:841:5

# Error details

```
Error: onglet Invitations du pilotage ouvert par ?tab=invitations

expect(locator).toHaveAttribute(expected) failed

Locator: getByRole('tab', { name: /^invitations/i })
Expected: "true"
Timeout: 15000ms
Error: element(s) not found

Call log:
  - onglet Invitations du pilotage ouvert par ?tab=invitations getByRole('tab', { name: /^invitations/i }) with timeout 15000ms
  - waiting for getByRole('tab', { name: /^invitations/i })

```

```yaml
- complementary:
  - link "Event Village, accueil":
    - /url: /
    - text: EVENT VILLAGE
  - navigation "Navigation principale":
    - paragraph: Gestion
    - link "Tableau de bord":
      - /url: /partner/dashboard
      - img
      - text: Tableau de bord
    - link "Événements":
      - /url: /partner/events
      - img
      - text: Événements
    - link "Équipe":
      - /url: /partner/team
      - img
      - text: Équipe
    - paragraph: Outils
    - link "Finances":
      - /url: /partner/finance
      - img
      - text: Finances
    - link "Statistiques":
      - /url: /partner/stats
      - img
      - text: Statistiques
    - link "Scanner les billets":
      - /url: /partner/scan
      - img
      - text: Scanner les billets
    - link "Calendrier":
      - /url: /partner/calendar
      - img
      - text: Calendrier
    - link "Abonnement":
      - /url: /partner/subscription
      - img
      - text: Abonnement
    - link "Profil partenaire":
      - /url: /partner/profile
      - img
      - text: Profil partenaire
    - link "Retour au site":
      - /url: /
      - img
      - text: Retour au site
  - link "Mame Recette Partenaire":
    - /url: /profile
  - button "Se déconnecter"
  - button "Basculer le thème"
- banner:
  - link "Rechercher un événement, un concert, un restaurant…":
    - /url: /explore
  - button "Notifications, 12 non lues": "12"
- main:
  - link "Mes événements":
    - /url: /partner/events
  - text: Publié
  - status: En direct
  - heading "Recette — Nuit de Ngor 17.13.39" [level=1]
  - paragraph: lun. 9 nov. 2026 à 13:15 Corniche de Ngor, Dakar
  - link "Modifier":
    - /url: /partner/events/4ad4b3b2-6859-4b92-bebb-4e36046270a0/edit
  - button "Annuler l’événement"
  - tablist "Rubriques du pilotage":
    - tab "Aperçu" [selected]
    - tab "Ventes"
    - tab "Entrées"
    - tab "Équipe"
    - tab "Caisse"
    - tab "Clôture"
  - tabpanel "Aperçu":
    - region "Billetterie":
      - heading "Billetterie" [level=2]
      - paragraph: Billets valides et utilisés, hors invitations.
      - paragraph: Billets vendus
      - paragraph: "5"
      - paragraph: Toutes catégories, y compris désactivées
      - paragraph: Places en vente
      - paragraph: "100"
      - paragraph: Quotas des catégories actives
      - paragraph: Places restantes
      - paragraph: "95"
      - paragraph: Dans les catégories actives
      - paragraph: Invitations
      - paragraph: "0"
      - paragraph: Places offertes, comptées à part
    - region "Contrôle d’accès":
      - heading "Contrôle d’accès" [level=2]
      - paragraph: Passages validés au scan et au guichet.
      - paragraph: Entrées
      - paragraph: "4"
      - paragraph: dont 1 au guichet
      - paragraph: Taux de présence
      - paragraph: 80 %
      - paragraph: Part des participants attendus (ventes et invitations) déjà passés
    - region "Recettes":
      - heading "Recettes" [level=2]
      - paragraph: Montants des billets, remboursements déduits pour les ventes en ligne.
      - paragraph: En ligne
      - paragraph: 18 000 F CFA
      - paragraph: Paiements mobiles confirmés
      - paragraph: En espèces
      - paragraph: 5 000 F CFA
      - paragraph: Encaissées par vos contrôleurs
      - paragraph: Remboursé
      - paragraph: 6 000 F CFA
      - paragraph: Remboursements en ligne
    - paragraph:
      - text: Chiffres calculés le
      - time: dim. 8 nov. 2026 à 17:14
      - text: .
- alert
```

# Test source

```ts
  757 |         await partner.locator('tr').filter({ hasText: r.e1.title }).getByRole('button', { name: /^clôture$/i }).click();
  758 |         const dialog = partner.getByRole('dialog', { name: /^rapport de clôture$/i });
  759 |         await expect(dialog).toBeVisible();
  760 |         await expect(dialog.getByText(/^généré le/i)).toBeVisible();
  761 |         await expect(dialog.getByText('Entrées validées', { exact: true })).toBeVisible();
  762 |         await expectRoute(partner, 'GET', '/api/partner/reports/closing/pdf', () => dialog.getByRole('button', { name: /^télécharger le pdf$/i }).click(), 200, 'rapport PDF');
  763 |         await dialog.getByRole('button', { name: /^fermer$/i }).click();
  764 |         await expect(dialog).toBeHidden();
  765 |     });
  766 | 
  767 |     await test.step('/partner/finance : code SMS, retrait de 6 000 F, frais de 60 F, envoi au faux SamirPay', async () => {
  768 |         await partner.goto('/partner/finance');
  769 |         const wave = partner.getByRole('radio', { name: /^wave/i });
  770 |         await wave.dispatchEvent('click');
  771 |         await expect(wave).toBeChecked();
  772 |         await partner.getByLabel(/qui reçoit le retrait/i).fill(r.p1.local);
  773 |         await partner.getByLabel(/^montant à retirer/i).fill('6000');
  774 |         const seen = await smsSeen(r.p1.phone);
  775 |         await expectRoute(partner, 'POST', '/api/withdrawals/otp', () => partner.getByRole('button', { name: /^recevoir le code de confirmation$/i }).click(), 200, 'code de confirmation du retrait');
  776 |         await fillOtp(partner, await smsCode(r.p1.phone, seen, 'code du retrait'));
  777 |         await expectRoute(partner, 'POST', '/api/withdrawals/request', () => partner.getByRole('button', { name: /^confirmer le retrait$/i }).click(), 200, 'demande de retrait');
  778 |         await expect(partner.getByText('Retrait versé', { exact: true })).toBeVisible();
  779 |         const summary = partner.locator('dl').filter({ hasText: 'Montant versé' });
  780 |         await expect(summary, 'frais de retrait').toContainText(/60\sF/);
  781 |         await expect(summary, 'montant versé').toContainText(/5\s940/);
  782 |         const res = await fetch(`${e2eConfig().fakeServicesUrl}/__test/samirpay/transactions`);
  783 |         const { transactions } = (await res.json()) as { transactions: Array<{ kind: string; amount: number; status: string }> };
  784 |         expect(transactions.filter((t) => t.kind === 'CASHOUT' && t.amount === 5940 && t.status === 'SUCCESS').length, 'envoi de 5 940 F au faux SamirPay').toBeGreaterThan(0);
  785 |     });
  786 | 
  787 |     await test.step('A4 : remboursement d’un billet à l’écran, double confirmation', async () => {
  788 |         await refundOnScreen(partner, r.numbers.refundShown, `Recette ${STAMP} : client empêché`, /^remboursement versé$/i);
  789 |         await expect.poll(() => ticketStatus(r.tickets.refundShown), { message: 'billet remboursé', timeout: 15_000 }).toBe('REMBOURSE');
  790 |     });
  791 | 
  792 |     await test.step('invariants (a) à (t)', async () => {
  793 |         await assertInvariants('recette-partenaire');
  794 |     });
  795 | });
  796 | 
  797 | test('acte 7 [client] [partenaire] : annulation de E2, envoyeur par la vraie route, billet remboursé, avis, bandeau public', async ({ browser }, testInfo) => {
  798 |     const partner = known('P1');
  799 |     const client = known('C1');
  800 | 
  801 |     await test.step('annulation par P1 dans la modale', async () => {
  802 |         await partner.goto(`/partner/events/${r.e2.id}`);
  803 |         await partner.getByRole('button', { name: /annuler l[’']événement/i }).click();
  804 |         const dialog = partner.getByRole('dialog').or(partner.getByRole('alertdialog'));
  805 |         await expect(dialog).toBeVisible();
  806 |         await expect(dialog.getByText(/acheteurs à prévenir/i)).toBeVisible();
  807 |         await dialog.getByLabel(/^avis public aux participants/i).fill(NOTICE_E2);
  808 |         await dialog.getByLabel(/^motif interne/i).fill('Recette de la billetterie, lot 8.');
  809 |         await dialog.getByLabel(/pour confirmer, saisissez le titre exact/i).fill(r.e2.title);
  810 |         const cancelled = partner.waitForResponse((res) => pathOf(res.url()) === `/api/partner/events/${r.e2.id}/cancel` && res.request().method() === 'POST', { timeout: 60_000 });
  811 |         await dialog.getByRole('button', { name: /^confirmer l[’']annulation$/i }).click();
  812 |         const res = await cancelled;
  813 |         expect(res.status(), `annulation de E2 : ${(await res.text()).slice(0, 300)}`).toBe(200);
  814 |         await expect(dialog).toBeHidden();
  815 |     });
  816 | 
  817 |     await test.step('vraie route de l’envoyeur : avis d’annulation et de remboursement partis', async () => {
  818 |         await expect.poll(() => ticketStatus(r.tickets.e2), { message: 'billet de E2 remboursé par l’annulation', timeout: 30_000 }).toBe('REMBOURSE');
  819 |         await drainOutbox('après l’annulation de E2');
  820 |         const lines = (await outboxOfEvent(r.e2.id, ['EVENT_CANCELLED', 'REFUND_PAID'])).filter((l) => l.channel === 'SMS' && (l.recipient_user_id === r.c1.userId || l.recipient_phone === r.c1.phone));
  821 |         expect(lines.map((l) => `${l.type} ${l.status}`).sort(), `avis du client : ${JSON.stringify(lines.map((l) => ({ type: l.type, status: l.status, reason: l.reason })))}`)
  822 |             .toEqual(['EVENT_CANCELLED SENT', 'REFUND_PAID SENT']);
  823 |     });
  824 | 
  825 |     await test.step('Mes billets : billet Remboursé', async () => {
  826 |         await client.goto('/tickets?tab=tous');
  827 |         const card = client.locator('li, article').filter({ hasText: r.e2.title }).last();
  828 |         await expect(card, 'billet de E2 dans Mes billets').toBeVisible({ timeout: 30_000 });
  829 |         await expect(card, 'statut affiché').toContainText(/remboursé/i);
  830 |     });
  831 | 
  832 |     await test.step('page publique de E2 : bandeau et avis de l’organisateur', async () => {
  833 |         const visitor = await asNew(browser, testInfo, 'visiteur');
  834 |         const res = await visitor.goto(`/events/${r.e2.id}`);
  835 |         expect(res?.status(), 'page d’un événement annulé').toBe(200);
  836 |         await expect(visitor.getByText(NOTICE_E2), 'avis public').toBeVisible();
  837 |         await expect(visitor.getByRole('button', { name: /ajouter un billet/i }), 'plus aucune vente').toHaveCount(0);
  838 |     });
  839 | });
  840 | 
  841 | test('acte 9 [partenaire] [client] [contrôleur] : invitation d’un numéro sans compte, inscription, réclamation, entrée', async ({ browser }, testInfo) => {
  842 |     // Placé avant l'acte 8 (AR8), qui suspend E1 et P1 : une invitation exige un événement publié et un partenaire actif.
  843 |     const partner = known('P1');
  844 |     const controller = known('K1');
  845 |     const invite = { local: local('70'), phone: `+221${local('70')}`, firstName: 'Fatou' };
  846 |     const categoryId = r.e1.categories['Invitations'];
  847 |     const soldOfCategory = async (): Promise<number> => {
  848 |         const { data, error } = await serviceClient().from('ticket_categories').select('sold_quantity').eq('id', categoryId).single();
  849 |         if (error || !data) throw new Error(`[e2e] stock de la catégorie Invitations : ${error?.message ?? 'introuvable'}`);
  850 |         return Number(data.sold_quantity);
  851 |     };
  852 |     const soldBefore = await soldOfCategory();
  853 |     let ticketId = '';
  854 | 
  855 |     await test.step('P1 invite un numéro neuf sur la catégorie Invitations', async () => {
  856 |         await partner.goto(`/partner/events/${r.e1.id}?tab=invitations`);
> 857 |         await expect(partner.getByRole('tab', { name: /^invitations/i }), 'onglet Invitations du pilotage ouvert par ?tab=invitations').toHaveAttribute('aria-selected', 'true');
      |                                                                                                                                         ^ Error: onglet Invitations du pilotage ouvert par ?tab=invitations
  858 |         const panel = partner.getByRole('tabpanel');
  859 |         const category = panel.getByLabel(/^catégorie/i);
  860 |         // Le libellé de l'option porte aussi le restant (contrat 5.1) : l'option est repérée par le début du nom
  861 |         const value = await category.locator('option', { hasText: /^Invitations/ }).getAttribute('value');
  862 |         if (!value) throw new Error('[e2e] option « Invitations » sans valeur dans le champ Catégorie');
  863 |         await category.selectOption(value);
  864 |         await panel.getByLabel(/^numéros de téléphone/i).fill(invite.local);
  865 |         await panel.getByLabel(/^billets par numéro/i).selectOption('1');
  866 |         await panel.getByRole('button', { name: /^envoyer les invitations$/i }).click();
  867 |         const confirm = partner.getByRole('alertdialog', { name: /^confirmer l.envoi/i });
  868 |         await expect(confirm, 'boîte de confirmation de l’envoi').toBeVisible();
  869 |         const sent = await expectRoute(partner, 'POST', `/api/partner/events/${r.e1.id}/invitations`, () => confirm.getByRole('button', { name: /^confirmer$/i }).click(), 200, 'envoi de l’invitation');
  870 |         expect(sent, 'réponse de l’envoi, identique avec ou sans compte').toMatchObject({ ok: true, ticket_count: 1, phone_count: 1 });
  871 |         await expect(partner.getByText(/invitations envoyées/i).first(), 'envoi annoncé à l’écran').toBeVisible();
  872 |     });
  873 | 
  874 |     await test.step('en base : billet d’invitation à 0 F sans porteur, stock décrémenté, transfert en attente vers le numéro', async () => {
  875 |         const { data, error } = await serviceClient().from('tickets').select('id, sale_channel, price, user_id, status, transfer_locked, sale_decision').eq('event_id', r.e1.id).eq('category_id', categoryId);
  876 |         if (error) throw new Error(`[e2e] billets de la catégorie Invitations : ${error.message}`);
  877 |         expect((data ?? []).length, `un seul billet d’invitation : ${JSON.stringify(data)}`).toBe(1);
  878 |         const ticket = data![0];
  879 |         ticketId = String(ticket.id);
  880 |         expect(ticket.sale_channel, 'canal du billet').toBe('INVITATION');
  881 |         expect(Number(ticket.price), 'prix du billet').toBe(0);
  882 |         expect(ticket.user_id, 'aucun porteur avant la réclamation').toBeNull();
  883 |         expect(ticket.status, 'statut du billet').toBe('VALIDE');
  884 |         expect(ticket.transfer_locked, 'billet verrouillé pendant l’attente').toBe(true);
  885 |         expect((ticket.sale_decision as { source?: unknown }).source, 'source de la décision figée').toBe('INVITATION');
  886 |         expect(await soldOfCategory(), 'stock décrémenté comme une vente').toBe(soldBefore + 1);
  887 |         const { data: transfers, error: transferError } = await serviceClient().from('ticket_transfers').select('status, to_phone_or_email, from_user_id').eq('ticket_id', ticketId);
  888 |         if (transferError) throw new Error(`[e2e] transfert de l’invitation : ${transferError.message}`);
  889 |         expect(transfers, 'un transfert en attente, sans expéditeur').toEqual([{ status: 'PENDING', to_phone_or_email: invite.phone, from_user_id: null }]);
  890 |     });
  891 | 
  892 |     await test.step('boîte d’envoi vidée par la vraie route : un SMS au numéro, lien vers Mes billets, aucun code', async () => {
  893 |         await drainOutbox('après l’envoi de l’invitation');
  894 |         const received = await fakeSmsTo(invite.phone);
  895 |         expect(received.length, `SMS reçus par le numéro invité : ${JSON.stringify(received.map((m) => m.message))}`).toBe(1);
  896 |         expect(received[0].message, 'lien vers Mes billets').toContain('/tickets');
  897 |         expect(received[0].message, 'aucun code dans le SMS d’invitation').not.toMatch(/(?<!\d)\d{6}(?!\d)/);
  898 |     });
  899 | 
  900 |     const invitee = await asNew(browser, testInfo, 'invité');
  901 | 
  902 |     await test.step('inscription à l’écran avec le numéro invité, invitation retrouvée dans Reçus et acceptée', async () => {
  903 |         await invitee.goto('/register');
  904 |         const seen = await smsSeen(invite.phone);
  905 |         await invitee.locator('#inscription-telephone').fill(invite.local);
  906 |         await invitee.getByRole('button', { name: /^recevoir le code par sms$/i }).click();
  907 |         await expect(invitee.getByText(/^code reçu par sms$/i)).toBeVisible();
  908 |         await fillOtp(invitee, await smsCode(invite.phone, seen, 'inscription de l’invité'));
  909 |         await invitee.getByLabel(/^prénom/i).fill(invite.firstName);
  910 |         await invitee.getByLabel(/^nom/i).fill('Recette');
  911 |         await invitee.getByLabel(/^mot de passe/i).first().fill(TEST_PASSWORD);
  912 |         await invitee.getByRole('button', { name: /^créer mon compte$/i }).click();
  913 |         await invitee.waitForURL((url) => !url.pathname.startsWith('/register'), { timeout: 30_000 });
  914 | 
  915 |         await invitee.goto('/tickets?tab=recus');
  916 |         const offer = invitee.locator('li, article, section').filter({ hasText: r.e1.title }).filter({ has: invitee.getByRole('button', { name: /^accepter le billet$/i }) }).last();
  917 |         await expect(offer, 'invitation dans l’onglet Reçus').toBeVisible({ timeout: 30_000 });
  918 |         await expect(offer, 'expéditeur affiché').toContainText(/l.organisateur de l.événement/i);
  919 |         await offer.getByRole('button', { name: /^accepter le billet$/i }).click();
  920 |         const confirm = invitee.getByRole('dialog').or(invitee.getByRole('alertdialog'));
  921 |         await expect(confirm).toBeVisible();
  922 |         await expectRoute(invitee, 'POST', /^\/api\/tickets\/transfers\/[^/]+\/claim$/, () => confirm.getByRole('button', { name: /^accepter le billet$/i }).click(), 200, 'réclamation de l’invitation');
  923 | 
  924 |         const { data: account, error: accountError } = await serviceClient().from('users').select('id').in('phone', [invite.phone, invite.phone.slice(1)]).single();
  925 |         if (accountError || !account) throw new Error(`[e2e] compte de l’invité : ${accountError?.message ?? 'introuvable'}`);
  926 |         const { data: claimed, error: claimedError } = await serviceClient().from('tickets').select('user_id').eq('id', ticketId).single();
  927 |         if (claimedError || !claimed) throw new Error(`[e2e] billet réclamé : ${claimedError?.message ?? 'introuvable'}`);
  928 |         expect(String(claimed.user_id), 'billet au compte de l’invité').toBe(String(account.id));
  929 |     });
  930 | 
  931 |     await test.step('K1 scanne le billet réclamé : entrée validée, sans caisse', async () => {
  932 |         // K1 est resté sur le scanner de E1 depuis l'acte 5 ; openScanner attendrait l'écran de départ, que la reprise de session (A10) n'affiche pas
  933 |         await openTab(controller, /^contrôle$/i);
  934 |         await videoPlaying(controller, 'retour au contrôle après la clôture de caisse');
  935 |         await expectScan(controller, await livePayload(invitee, ticketId), 'invitation réclamée', 'valid');
  936 |         expect(await ticketStatus(ticketId), 'invitation compostée').toBe('UTILISE');
  937 |     });
  938 | 
  939 |     await test.step('invariants (a) à (t)', async () => {
  940 |         await assertInvariants('recette-invitation');
  941 |     });
  942 | });
  943 | 
  944 | test('acte 8 [admin] : supervision et relance d’une notification, remboursement bloqué relancé (A3), événement et partenaire suspendus', async ({ browser }, testInfo) => {
  945 |     const partner = known('P1');
  946 |     const superadmin = await asRole(browser, testInfo, 'fumee-superadmin');
  947 |     const admin = await asRole(browser, testInfo, 'admin');
  948 |     const { failedId } = readDemoIds().notifications;
  949 | 
  950 |     await test.step('supervision /admin/notifications, ligne en échec, relance', async () => {
  951 |         await admin.goto('/admin/notifications?status=FAILED');
  952 |         await expect(admin.getByRole('link', { name: /^voir le détail/i }).first(), 'ligne en échec dans la liste').toBeVisible();
  953 |         await admin.goto(`/admin/notifications/${failedId}`);
  954 |         await admin.getByRole('button', { name: /^relancer$/i }).click();
  955 |         const confirm = admin.getByRole('alertdialog');
  956 |         await expect(confirm).toBeVisible();
  957 |         await expectRoute(admin, 'POST', `/api/admin/notifications/${failedId}/retry`, () => confirm.getByRole('button', { name: /^relancer$/i }).click(), 200, 'relance de la notification');
```