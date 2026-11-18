# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recette.spec.ts >> acte 7 [client] [partenaire] : annulation de E2, envoyeur par la vraie route, billet remboursé, avis, bandeau public
- Location: e2e/recette.spec.ts:918:5

# Error details

```
Error: avis public

expect(locator).toBeVisible() failed

Locator: getByText('Concert de recette annulé : les billets payés en ligne sont remboursés automatiquement.')
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - avis public getByText('Concert de recette annulé : les billets payés en ligne sont remboursés automatiquement.') with timeout 15000ms
  - waiting for getByText('Concert de recette annulé : les billets payés en ligne sont remboursés automatiquement.')

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
    - img "Affiche de l’événement Recette — Concert annulé 10.52.54"
    - text: Concerts & Musique
    - heading "Recette — Concert annulé 10.52.54" [level=1]
    - paragraph: Organisé par Recette Productions 10.52.54
    - list "Infos de l’événement":
      - listitem:
        - paragraph: Vendredi 20 novembre 2026 à 20:00
        - paragraph: Jusqu’à 23:00
      - listitem:
        - paragraph: Corniche de Ngor
        - paragraph: Dakar
      - listitem:
        - paragraph: Billet dans l’application
        - paragraph: Présentez son QR code à l’entrée, depuis Mes billets.
    - region "À propos":
      - heading "À propos" [level=2]
      - paragraph: "Concert de la recette destiné à être annulé : remboursement automatique. Données fictives."
    - region "Lieu et accès":
      - heading "Lieu et accès" [level=2]
      - paragraph: Corniche de Ngor
      - paragraph: Dakar
      - img "Recette — Concert annulé 10.52.54, Corniche de Ngor": Recette — Concert annulé 10…
      - button "Afficher la carte"
      - link "Voir l’itinéraire":
        - /url: https://www.google.com/maps/dir/?api=1&destination=14.6928,-17.4467
      - paragraph: Paiement
      - text: Wave ou Orange Money, en ligne. Les frais de service s’affichent avant le paiement.
    - region "Organisateur":
      - paragraph: Organisateur
      - paragraph: Recette Productions 10.52.54
  - complementary "Billetterie":
    - heading "Billetterie" [level=2]
    - paragraph: La vente de billets est fermée pour cet événement.
    - list "Catégories de billets":
      - listitem:
        - heading "Standard" [level=3]
        - paragraph: 3 000 F CFA
    - paragraph: Remboursement
    - paragraph: Les billets payés en ligne sont remboursés automatiquement sur le compte Mobile Money utilisé pour l’achat, frais de service compris. Les billets réglés en espèces sont remboursés par l’organisateur.
    - link "Voir mes billets":
      - /url: /tickets
    - link "Voir d’autres événements":
      - /url: /explore
- alert
```

# Test source

```ts
  861  |     await test.step('export des participants, journalisé', async () => {
  862  |         await openTab(partner, /^clôture/i);
  863  |         const exported = partner.waitForResponse((res) => pathOf(res.url()) === `/api/partner/events/${r.e1.id}/participants-export`);
  864  |         const [download] = await Promise.all([partner.waitForEvent('download'), partner.getByRole('button', { name: /^exporter les participants$/i }).click()]);
  865  |         const res = await exported;
  866  |         expect(res.status(), 'export des participants').toBe(200);
  867  |         expect(fs.readFileSync(await download.path(), 'utf8'), 'export : le fichier reçu porte les billets de l’événement').toContain('Standard');
  868  |         const { data, error } = await serviceClient().from('participant_exports').select('event_id').eq('id', String(res.headers()['x-export-id'])).maybeSingle();
  869  |         if (error) throw new Error(`[e2e] journal des exports : ${error.message}`);
  870  |         expect(data?.event_id, 'export écrit au journal').toBe(r.e1.id);
  871  |     });
  872  | 
  873  |     await test.step('rapport de clôture du tableau de bord : libellés, PDF', async () => {
  874  |         await partner.goto('/partner/dashboard');
  875  |         await partner.locator('tr').filter({ hasText: r.e1.title }).getByRole('button', { name: /^clôture$/i }).click();
  876  |         const dialog = partner.getByRole('dialog', { name: /^rapport de clôture$/i });
  877  |         await expect(dialog).toBeVisible();
  878  |         await expect(dialog.getByText(/^généré le/i)).toBeVisible();
  879  |         await expect(dialog.getByText('Entrées (dont guichet)', { exact: true })).toBeVisible();
  880  |         await expectRoute(partner, 'GET', '/api/partner/reports/closing/pdf', () => dialog.getByRole('button', { name: /^télécharger le pdf$/i }).click(), 200, 'rapport PDF');
  881  |         await dialog.getByRole('button', { name: /^fermer$/i }).click();
  882  |         await expect(dialog).toBeHidden();
  883  |     });
  884  | 
  885  |     await test.step('/partner/finance : code SMS, retrait de 6 000 F, frais de 60 F, envoi au faux SamirPay', async () => {
  886  |         await partner.goto('/partner/finance');
  887  |         const wave = partner.getByRole('radio', { name: /^wave/i });
  888  |         await wave.dispatchEvent('click');
  889  |         await expect(wave).toBeChecked();
  890  |         await partner.getByLabel(/qui reçoit le retrait/i).fill(r.p1.local);
  891  |         await partner.getByLabel(/^montant à retirer/i).fill('6000');
  892  |         // Lot 9 bis (R62, B27) : minimum, frais et montant reçu dits AVANT l'envoi du code
  893  |         await expect(partner.getByText(/^Minimum de retrait : \d[\d\s]*\sF\sCFA\. Frais : .+ \(60\sF\sCFA\)\. Vous recevrez 5\s940\sF\sCFA\.$/),
  894  |             'devis avant le code : minimum, taux, frais et « Vous recevrez 5 940 F CFA »').toBeVisible();
  895  |         const seen = await smsSeen(r.p1.phone);
  896  |         await expectRoute(partner, 'POST', '/api/withdrawals/otp', () => partner.getByRole('button', { name: /^recevoir le code de confirmation$/i }).click(), 200, 'code de confirmation du retrait');
  897  |         await fillOtp(partner, await smsCode(r.p1.phone, seen, 'code du retrait'));
  898  |         await expectRoute(partner, 'POST', '/api/withdrawals/request', () => partner.getByRole('button', { name: /^confirmer le retrait$/i }).click(), 200, 'demande de retrait');
  899  |         await expect(partner.getByText('Retrait versé', { exact: true })).toBeVisible();
  900  |         const summary = partner.locator('dl').filter({ hasText: 'Montant versé' });
  901  |         await expect(summary, 'frais de retrait').toContainText(/60\sF/);
  902  |         await expect(summary, 'montant versé').toContainText(/5\s940/);
  903  |         const res = await fetch(`${e2eConfig().fakeServicesUrl}/__test/samirpay/transactions`);
  904  |         const { transactions } = (await res.json()) as { transactions: Array<{ kind: string; amount: number; status: string }> };
  905  |         expect(transactions.filter((t) => t.kind === 'CASHOUT' && t.amount === 5940 && t.status === 'SUCCESS').length, 'envoi de 5 940 F au faux SamirPay').toBeGreaterThan(0);
  906  |     });
  907  | 
  908  |     await test.step('A4 : remboursement d’un billet à l’écran, double confirmation', async () => {
  909  |         await refundOnScreen(partner, r.numbers.refundShown, `Recette ${STAMP} : client empêché`, /^remboursement versé$/i);
  910  |         await expect.poll(() => ticketStatus(r.tickets.refundShown), { message: 'billet remboursé', timeout: 15_000 }).toBe('REMBOURSE');
  911  |     });
  912  | 
  913  |     await test.step('invariants (a) à (t)', async () => {
  914  |         await assertInvariants('recette-partenaire');
  915  |     });
  916  | });
  917  | 
  918  | test('acte 7 [client] [partenaire] : annulation de E2, envoyeur par la vraie route, billet remboursé, avis, bandeau public', async ({ browser }, testInfo) => {
  919  |     const partner = known('P1');
  920  |     const client = known('C1');
  921  | 
  922  |     await test.step('annulation par P1 dans la modale', async () => {
  923  |         await partner.goto(`/partner/events/${r.e2.id}`);
  924  |         await partner.getByRole('button', { name: /annuler l[’']événement/i }).click();
  925  |         const dialog = partner.getByRole('dialog').or(partner.getByRole('alertdialog'));
  926  |         await expect(dialog).toBeVisible();
  927  |         await expect(dialog.getByText(/acheteurs à prévenir/i)).toBeVisible();
  928  |         // Lot 9 bis (R20, B22) : ventes au guichet dites (aucune pour E2) ; (R48) E2 à J+2 : aucun avertissement « en cours »
  929  |         await expect(definition(dialog, 'Ventes au guichet'), 'ventes au guichet de E2').toHaveText(/^0 billet, 0\sF\sCFA$/);
  930  |         await expect(dialog.getByText(/^l.événement a commencé/i), 'aucun avertissement d’annulation en cours').toHaveCount(0);
  931  |         await expect(dialog.getByRole('checkbox', { name: /j.ai compris/i }), 'aucune case « J’ai compris »').toHaveCount(0);
  932  |         await dialog.getByLabel(/^avis public aux participants/i).fill(NOTICE_E2);
  933  |         await dialog.getByLabel(/^motif interne/i).fill('Recette de la billetterie, lot 8.');
  934  |         await dialog.getByLabel(/pour confirmer, saisissez le titre exact/i).fill(r.e2.title);
  935  |         const cancelled = partner.waitForResponse((res) => pathOf(res.url()) === `/api/partner/events/${r.e2.id}/cancel` && res.request().method() === 'POST', { timeout: 60_000 });
  936  |         await dialog.getByRole('button', { name: /^confirmer l[’']annulation$/i }).click();
  937  |         const res = await cancelled;
  938  |         expect(res.status(), `annulation de E2 : ${(await res.text()).slice(0, 300)}`).toBe(200);
  939  |         await expect(dialog).toBeHidden();
  940  |     });
  941  | 
  942  |     await test.step('vraie route de l’envoyeur : avis d’annulation et de remboursement partis', async () => {
  943  |         await expect.poll(() => ticketStatus(r.tickets.e2), { message: 'billet de E2 remboursé par l’annulation', timeout: 30_000 }).toBe('REMBOURSE');
  944  |         await drainOutbox('après l’annulation de E2');
  945  |         const lines = (await outboxOfEvent(r.e2.id, ['EVENT_CANCELLED', 'REFUND_PAID'])).filter((l) => l.channel === 'SMS' && (l.recipient_user_id === r.c1.userId || l.recipient_phone === r.c1.phone));
  946  |         expect(lines.map((l) => `${l.type} ${l.status}`).sort(), `avis du client : ${JSON.stringify(lines.map((l) => ({ type: l.type, status: l.status, reason: l.reason })))}`)
  947  |             .toEqual(['EVENT_CANCELLED SENT', 'REFUND_PAID SENT']);
  948  |     });
  949  | 
  950  |     await test.step('Mes billets : billet Remboursé', async () => {
  951  |         await client.goto('/tickets?tab=tous');
  952  |         const card = client.locator('li, article').filter({ hasText: r.e2.title }).last();
  953  |         await expect(card, 'billet de E2 dans Mes billets').toBeVisible({ timeout: 30_000 });
  954  |         await expect(card, 'statut affiché').toContainText(/remboursé/i);
  955  |     });
  956  | 
  957  |     await test.step('page publique de E2 : bandeau et avis de l’organisateur', async () => {
  958  |         const visitor = await asNew(browser, testInfo, 'visiteur');
  959  |         const res = await visitor.goto(`/events/${r.e2.id}`);
  960  |         expect(res?.status(), 'page d’un événement annulé').toBe(200);
> 961  |         await expect(visitor.getByText(NOTICE_E2), 'avis public').toBeVisible();
       |                                                                   ^ Error: avis public
  962  |         await expect(visitor.getByRole('button', { name: /ajouter un billet/i }), 'plus aucune vente').toHaveCount(0);
  963  |     });
  964  | });
  965  | 
  966  | test('acte 9 [partenaire] [client] [contrôleur] : invitation d’un numéro sans compte, inscription, réclamation, entrée', async ({ browser }, testInfo) => {
  967  |     // Placé avant l'acte 8 (AR8), qui suspend E1 et P1 : une invitation exige un événement publié et un partenaire actif.
  968  |     const partner = known('P1');
  969  |     const controller = known('K1');
  970  |     const invite = { local: local('70'), phone: `+221${local('70')}`, firstName: 'Fatou' };
  971  |     const categoryId = r.e1.categories['Invitations'];
  972  |     const soldOfCategory = async (): Promise<number> => {
  973  |         const { data, error } = await serviceClient().from('ticket_categories').select('sold_quantity').eq('id', categoryId).single();
  974  |         if (error || !data) throw new Error(`[e2e] stock de la catégorie Invitations : ${error?.message ?? 'introuvable'}`);
  975  |         return Number(data.sold_quantity);
  976  |     };
  977  |     const soldBefore = await soldOfCategory();
  978  |     let ticketId = '';
  979  | 
  980  |     await test.step('P1 invite un numéro neuf sur la catégorie Invitations', async () => {
  981  |         await partner.goto(`/partner/events/${r.e1.id}?tab=invitations`);
  982  |         await expect(partner.getByRole('tab', { name: /^invitations/i }), 'onglet Invitations du pilotage ouvert par ?tab=invitations').toHaveAttribute('aria-selected', 'true');
  983  |         const panel = partner.getByRole('tabpanel');
  984  |         const category = panel.getByLabel(/^catégorie/i);
  985  |         // Le libellé de l'option porte aussi le restant (contrat 5.1) : l'option est repérée par le début du nom
  986  |         const value = await category.locator('option', { hasText: /^Invitations/ }).getAttribute('value');
  987  |         if (!value) throw new Error('[e2e] option « Invitations » sans valeur dans le champ Catégorie');
  988  |         await category.selectOption(value);
  989  |         await panel.getByLabel(/^numéro 1(?!\d)/i).fill(invite.local);
  990  |         await panel.getByLabel(/^billets par numéro/i).selectOption('1');
  991  |         await panel.getByRole('button', { name: /^envoyer les invitations$/i }).click();
  992  |         const confirm = partner.getByRole('alertdialog', { name: /^confirmer l.envoi/i });
  993  |         await expect(confirm, 'boîte de confirmation de l’envoi').toBeVisible();
  994  |         const sent = await expectRoute(partner, 'POST', `/api/partner/events/${r.e1.id}/invitations`, () => confirm.getByRole('button', { name: /^confirmer$/i }).click(), 200, 'envoi de l’invitation');
  995  |         expect(sent, 'réponse de l’envoi, identique avec ou sans compte').toMatchObject({ ok: true, ticket_count: 1, phone_count: 1 });
  996  |         await expect(partner.getByText(/invitations envoyées/i).first(), 'envoi annoncé à l’écran').toBeVisible();
  997  |     });
  998  | 
  999  |     await test.step('en base : billet d’invitation à 0 F sans porteur, stock décrémenté, transfert en attente vers le numéro', async () => {
  1000 |         const { data, error } = await serviceClient().from('tickets').select('id, sale_channel, price, user_id, status, transfer_locked, sale_decision').eq('event_id', r.e1.id).eq('category_id', categoryId);
  1001 |         if (error) throw new Error(`[e2e] billets de la catégorie Invitations : ${error.message}`);
  1002 |         expect((data ?? []).length, `un seul billet d’invitation : ${JSON.stringify(data)}`).toBe(1);
  1003 |         const ticket = data![0];
  1004 |         ticketId = String(ticket.id);
  1005 |         expect(ticket.sale_channel, 'canal du billet').toBe('INVITATION');
  1006 |         expect(Number(ticket.price), 'prix du billet').toBe(0);
  1007 |         expect(ticket.user_id, 'aucun porteur avant la réclamation').toBeNull();
  1008 |         expect(ticket.status, 'statut du billet').toBe('VALIDE');
  1009 |         expect(ticket.transfer_locked, 'billet verrouillé pendant l’attente').toBe(true);
  1010 |         expect((ticket.sale_decision as { source?: unknown }).source, 'source de la décision figée').toBe('INVITATION');
  1011 |         expect(await soldOfCategory(), 'stock décrémenté comme une vente').toBe(soldBefore + 1);
  1012 |         const { data: transfers, error: transferError } = await serviceClient().from('ticket_transfers').select('status, to_phone_or_email, from_user_id').eq('ticket_id', ticketId);
  1013 |         if (transferError) throw new Error(`[e2e] transfert de l’invitation : ${transferError.message}`);
  1014 |         expect(transfers, 'un transfert en attente, sans expéditeur').toEqual([{ status: 'PENDING', to_phone_or_email: invite.phone, from_user_id: null }]);
  1015 |     });
  1016 | 
  1017 |     await test.step('boîte d’envoi vidée par la vraie route : un SMS au numéro, lien vers Mes billets, aucun code', async () => {
  1018 |         await drainOutbox('après l’envoi de l’invitation');
  1019 |         const received = await fakeSmsTo(invite.phone);
  1020 |         expect(received.length, `SMS reçus par le numéro invité : ${JSON.stringify(received.map((m) => m.message))}`).toBe(1);
  1021 |         expect(received[0].message, 'lien vers Mes billets').toContain('/tickets');
  1022 |         expect(received[0].message, 'aucun code dans le SMS d’invitation').not.toMatch(/(?<!\d)\d{6}(?!\d)/);
  1023 |     });
  1024 | 
  1025 |     const invitee = await asNew(browser, testInfo, 'invité');
  1026 | 
  1027 |     await test.step('inscription à l’écran avec le numéro invité, invitation retrouvée dans Reçus et acceptée', async () => {
  1028 |         await invitee.goto('/register');
  1029 |         const seen = await smsSeen(invite.phone);
  1030 |         await invitee.locator('#inscription-telephone').fill(invite.local);
  1031 |         await invitee.getByRole('button', { name: /^recevoir le code par sms$/i }).click();
  1032 |         await expect(invitee.getByText(/^code reçu par sms$/i)).toBeVisible();
  1033 |         await fillOtp(invitee, await smsCode(invite.phone, seen, 'inscription de l’invité'));
  1034 |         await invitee.getByLabel(/^prénom/i).fill(invite.firstName);
  1035 |         await invitee.getByLabel(/^nom/i).fill('Recette');
  1036 |         await invitee.getByLabel(/^mot de passe/i).first().fill(TEST_PASSWORD);
  1037 |         await invitee.getByRole('button', { name: /^créer mon compte$/i }).click();
  1038 |         await invitee.waitForURL((url) => !url.pathname.startsWith('/register'), { timeout: 30_000 });
  1039 | 
  1040 |         // Lot 9 bis (R45, A10) : sans onglet demandé, Mes billets ouvre « Reçus » quand un billet attend
  1041 |         await invitee.goto('/tickets');
  1042 |         await expect(invitee.getByRole('tab', { name: /^reçus/i }), '« Reçus » ouvert d’office (R45)').toHaveAttribute('aria-selected', 'true', { timeout: 30_000 });
  1043 |         const offer = invitee.locator('li, article, section').filter({ hasText: r.e1.title }).filter({ has: invitee.getByRole('button', { name: /^accepter le billet$/i }) }).last();
  1044 |         await expect(offer, 'invitation dans l’onglet Reçus').toBeVisible({ timeout: 30_000 });
  1045 |         await expect(offer, 'expéditeur affiché').toContainText(/l.organisateur de l.événement/i);
  1046 |         await offer.getByRole('button', { name: /^accepter le billet$/i }).click();
  1047 |         const confirm = invitee.getByRole('dialog').or(invitee.getByRole('alertdialog'));
  1048 |         await expect(confirm).toBeVisible();
  1049 |         await expectRoute(invitee, 'POST', /^\/api\/tickets\/transfers\/[^/]+\/claim$/, () => confirm.getByRole('button', { name: /^accepter le billet$/i }).click(), 200, 'réclamation de l’invitation');
  1050 | 
  1051 |         const { data: account, error: accountError } = await serviceClient().from('users').select('id').in('phone', [invite.phone, invite.phone.slice(1)]).single();
  1052 |         if (accountError || !account) throw new Error(`[e2e] compte de l’invité : ${accountError?.message ?? 'introuvable'}`);
  1053 |         const { data: claimed, error: claimedError } = await serviceClient().from('tickets').select('user_id').eq('id', ticketId).single();
  1054 |         if (claimedError || !claimed) throw new Error(`[e2e] billet réclamé : ${claimedError?.message ?? 'introuvable'}`);
  1055 |         expect(String(claimed.user_id), 'billet au compte de l’invité').toBe(String(account.id));
  1056 |     });
  1057 | 
  1058 |     await test.step('K1 scanne le billet réclamé : entrée validée, sans caisse', async () => {
  1059 |         // K1 est resté sur le scanner de E1 depuis l'acte 5 ; openScanner attendrait l'écran de départ, que la reprise de session (A10) n'affiche pas
  1060 |         await openTab(controller, /^contrôle$/i);
  1061 |         await videoPlaying(controller, 'retour au contrôle après la clôture de caisse');
```