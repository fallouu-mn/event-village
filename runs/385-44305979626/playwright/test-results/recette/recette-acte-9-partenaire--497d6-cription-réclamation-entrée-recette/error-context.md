# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recette.spec.ts >> acte 9 [partenaire] [client] [contrôleur] : invitation d’un numéro sans compte, inscription, réclamation, entrée
- Location: e2e/recette.spec.ts:966:5

# Error details

```
Error: expéditeur affiché

expect(locator).toContainText(expected) failed

Locator: locator('li, article, section').filter({ hasText: 'Recette — Nuit de Ngor 13.16.09' }).filter({ has: getByRole('button', { name: /^accepter le billet$/i }) }).last()
Expected pattern: /l.organisateur de l.événement/i
Received string:  "Recette — Nuit de Ngor 13.16.09Invitation de l’organisateurDatejeu. 19 nov. 2026 à 09:20LieuCorniche de Ngor, DakarBilletInvitations · InvitationDélaiÀ accepter avant le jeu. 19 nov. 2026 à 13:20Accepter le billetRefuser"
Timeout: 15000ms

Call log:
  - expéditeur affiché locator('li, article, section').filter({ hasText: 'Recette — Nuit de Ngor 13.16.09' }).filter({ has: getByRole('button', { name: /^accepter le billet$/i }) }).last() with timeout 15000ms
  - waiting for locator('li, article, section').filter({ hasText: 'Recette — Nuit de Ngor 13.16.09' }).filter({ has: getByRole('button', { name: /^accepter le billet$/i }) }).last()
    34 × locator resolved to <article aria-labelledby="recu-17eb49b1-a3c0-4790-826e-5c745f4a17d5" class="space-y-4 rounded-2xl border border-primary-text/30 bg-card p-4 sm:p-5">…</article>
       - unexpected value "Recette — Nuit de Ngor 13.16.09Invitation de l’organisateurDatejeu. 19 nov. 2026 à 09:20LieuCorniche de Ngor, DakarBilletInvitations · InvitationDélaiÀ accepter avant le jeu. 19 nov. 2026 à 13:20Accepter le billetRefuser"

```

```yaml
- article "Recette — Nuit de Ngor 13.16.09":
  - heading "Recette — Nuit de Ngor 13.16.09" [level=3]
  - paragraph: Invitation de l’organisateur
  - term: Date
  - definition: jeu. 19 nov. 2026 à 09:20
  - term: Lieu
  - definition: Corniche de Ngor, Dakar
  - term: Billet
  - definition: Invitations · Invitation
  - term: Délai
  - definition: À accepter avant le jeu. 19 nov. 2026 à 13:20
  - button "Accepter le billet"
  - button "Refuser l’invitation pour Recette — Nuit de Ngor 13.16.09": Refuser
```

# Test source

```ts
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
  961  |         await expect(visitor.getByText(NOTICE_E2), 'avis public').toBeVisible();
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
> 1045 |         await expect(offer, 'expéditeur affiché').toContainText(/l.organisateur de l.événement/i);
       |                                                   ^ Error: expéditeur affiché
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
  1062 |         await expectScan(controller, await livePayload(invitee, ticketId), 'invitation réclamée', 'valid');
  1063 |         expect(await ticketStatus(ticketId), 'invitation compostée').toBe('UTILISE');
  1064 |     });
  1065 | 
  1066 |     await test.step('invariants (a) à (t)', async () => {
  1067 |         await assertInvariants('recette-invitation');
  1068 |     });
  1069 | });
  1070 | 
  1071 | test('acte 8 [admin] : supervision et relance d’une notification, remboursement bloqué relancé (A3), événement et partenaire suspendus', async ({ browser }, testInfo) => {
  1072 |     const partner = known('P1');
  1073 |     const superadmin = await asRole(browser, testInfo, 'fumee-superadmin');
  1074 |     const admin = await asRole(browser, testInfo, 'admin');
  1075 |     const { failedId } = readDemoIds().notifications;
  1076 | 
  1077 |     await test.step('supervision /admin/notifications, ligne en échec, relance', async () => {
  1078 |         await admin.goto('/admin/notifications?status=FAILED');
  1079 |         await expect(admin.getByRole('link', { name: /^voir le détail/i }).first(), 'ligne en échec dans la liste').toBeVisible();
  1080 |         await admin.goto(`/admin/notifications/${failedId}`);
  1081 |         await admin.getByRole('button', { name: /^relancer$/i }).click();
  1082 |         const confirm = admin.getByRole('alertdialog');
  1083 |         await expect(confirm).toBeVisible();
  1084 |         await expectRoute(admin, 'POST', `/api/admin/notifications/${failedId}/retry`, () => confirm.getByRole('button', { name: /^relancer$/i }).click(), 200, 'relance de la notification');
  1085 |         const { data, error } = await serviceClient().from('notification_outbox').select('status').eq('id', failedId).single();
  1086 |         if (error || !data) throw new Error(`[e2e] ligne ${failedId} : ${error?.message ?? 'introuvable'}`);
  1087 |         expect(String(data.status), 'ligne relancée, plus en échec').not.toBe('FAILED');
  1088 |     });
  1089 | 
  1090 |     await test.step('A3 : solde du faux SamirPay à 0, remboursement bloqué à l’écran du partenaire', async () => {
  1091 |         const emptied = await fakeServices('/__test/samirpay/balance', { solde: 0 });
  1092 |         expect(emptied.status, `solde vidé : ${JSON.stringify(emptied.json)}`).toBe(200);
  1093 |         await refundOnScreen(partner, r.numbers.refundBlocked, `Recette ${STAMP} : solde insuffisant`, /^remboursement enregistré, versement en attente$/i);
  1094 |         expect(await ticketStatus(r.tickets.refundBlocked), 'billet en attente du versement').toBe('REMBOURSEMENT_EN_COURS');
  1095 |     });
  1096 | 
  1097 |     await test.step('A3 : solde rétabli, « Renvoyer » avec justification sur /admin/finance, billet remboursé', async () => {
  1098 |         const restored = await fakeServices('/__test/samirpay/balance', { solde: FAKE_BALANCE });
  1099 |         expect(restored.status, `solde rétabli : ${JSON.stringify(restored.json)}`).toBe(200);
  1100 |         await superadmin.goto('/admin/finance');
  1101 |         // Lot 9 bis (R1, R9, R10, B1 à B4) : « Versements à reprendre », renvoi justifié par la route resend (retry supprimée)
  1102 |         const panel = superadmin.locator('section').filter({ has: superadmin.getByRole('heading', { name: /^versements à reprendre$/i }) });
  1103 |         const row = panel.locator('tr').filter({ hasText: r.e1.title });
  1104 |         await expect(row, 'versement bloqué dans la liste').toBeVisible();
  1105 |         await expect(row, 'motif en français').toContainText(/solde du compte partenaire samirpay insuffisant/i);
  1106 |         await row.getByRole('button', { name: /^renvoyer le versement/i }).click();
  1107 |         const confirm = superadmin.getByRole('alertdialog', { name: /^renvoyer ce versement/i });
  1108 |         await expect(confirm).toBeVisible();
  1109 |         await confirm.getByLabel(/^justification/i).fill(`Recette ${STAMP} : solde SamirPay rétabli, versement renvoyé`);
  1110 |         const resent = await expectRoute(superadmin, 'POST', /^\/api\/admin\/cashouts\/[^/]+\/resend$/, () => confirm.getByRole('button', { name: /^renvoyer$/i }).click(), 200, 'renvoi du versement');
  1111 |         expect(resent.ok, `réponse du renvoi : ${JSON.stringify(resent)}`).toBe(true);
  1112 |         await expect(panel.getByText(/^versement (confirmé|envoyé)$/i).first(), 'renvoi annoncé').toBeVisible();
  1113 |         await expect(row, 'la ligne quitte la liste').toHaveCount(0);
  1114 |         await expect.poll(() => ticketStatus(r.tickets.refundBlocked), { message: 'billet remboursé après le renvoi', timeout: 15_000 }).toBe('REMBOURSE');
  1115 |         const { data: audit, error: auditErr } = await serviceClient().from('audit_logs').select('metadata').eq('action', 'CASHOUT_RESENT')
  1116 |             .filter('metadata->>reason', 'eq', `Recette ${STAMP} : solde SamirPay rétabli, versement renvoyé`);
  1117 |         if (auditErr) throw new Error(`[e2e] journal du renvoi : ${auditErr.message}`);
  1118 |         expect((audit ?? []).length, 'renvoi journalisé avec sa justification (CASHOUT_RESENT)').toBe(1);
  1119 |     });
  1120 | 
  1121 |     await test.step('E3 de P1 publié à J+3 (RPC du lot 5) : la cascade de la suspension de P1 le suspendra (R5)', async () => {
  1122 |         const day = dakarDayFrom(new Date(), 3);
  1123 |         r.e3.id = await createPublishedEvent({
  1124 |             partnerUserId: r.p1.userId,
  1125 |             superadminId: await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email),
  1126 |             title: r.e3.title,
  1127 |             description: 'Concert de la recette publié, suspendu avec son organisateur puis jamais rouvert. Données fictives.',
  1128 |             startDate: day, startTime: '20:00:00', endDate: day, endTime: '23:00:00',
  1129 |             location: 'Corniche de Ngor', city: 'Dakar', capacity: 100,
  1130 |             imageUrl: await eventImageUrl(r.e1.id),
  1131 |             category: { name: 'Standard', price: 3000, total: 50 },
  1132 |         });
  1133 |     });
  1134 | 
  1135 |     await test.step('suspension de E1 sur sa fiche, avec motif : plus de vente, bandeau public', async () => {
  1136 |         await superadmin.goto(`/admin/events/${r.e1.id}`);
  1137 |         await superadmin.getByRole('button', { name: /^suspendre/i }).click();
  1138 |         const dialog = superadmin.getByRole('dialog', { name: /^suspendre l’événement$/i });
  1139 |         await expect(dialog).toBeVisible();
  1140 |         await dialog.getByLabel(/^motif de la suspension/i).fill(`Recette ${STAMP} : contrôle de l’organisateur`);
  1141 |         await expectRoute(superadmin, 'POST', /^\/api\/admin\/events\/[^/]+\/transition$/, () => dialog.getByRole('button', { name: /^suspendre/i }).click(), 200, 'suspension de E1');
  1142 |         const { data, error } = await serviceClient().from('events').select('status').eq('id', r.e1.id).single();
  1143 |         if (error || !data) throw new Error(`[e2e] statut de E1 : ${error?.message ?? 'introuvable'}`);
  1144 |         expect(String(data.status), 'E1 suspendu').toBe('SUSPENDU');
  1145 |         const visitor = known('visiteur');
```