# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recette.spec.ts >> acte 4 [client] : découverte, fiche, refus direct, inscription depuis l’achat, achats, Mes billets, transfert
- Location: e2e/recette.spec.ts:540:5

# Error details

```
Error: billet TCK-20261114-DF52D72DAF : « Disponible hors ligne »

expect(locator).toHaveAttribute(expected) failed

Locator:  locator('li, article').filter({ hasText: 'TCK-20261114-DF52D72DAF' }).last().locator('[data-ev-offline-state]')
Expected: "available"
Received: "missing"
Timeout:  60000ms

Call log:
  - billet TCK-20261114-DF52D72DAF : « Disponible hors ligne » locator('li, article').filter({ hasText: 'TCK-20261114-DF52D72DAF' }).last().locator('[data-ev-offline-state]') with timeout 60000ms
  - waiting for locator('li, article').filter({ hasText: 'TCK-20261114-DF52D72DAF' }).last().locator('[data-ev-offline-state]')
    123 × locator resolved to <p role="status" aria-atomic="true" data-ev-offline-state="missing" class="flex items-start gap-2 rounded-xl border px-3 py-2 text-sm font-medium leading-snug bg-warning-bg text-warning-fg border-warning-border">…</p>
        - unexpected value "missing"

```

```yaml
- status: Ouvrez ce billet avec du réseau avant d’arriver
```

# Test source

```ts
  525 |     });
  526 | 
  527 |     await test.step('PIN régisseur généré, affiché une fois', async () => {
  528 |         await openTab(partner, /^caisse/i);
  529 |         await partner.getByRole('button', { name: /^générer le code pin$/i }).click();
  530 |         await expectRoute(partner, 'POST', `/api/partner/events/${r.e1.id}/regisseur-pin`, () => partner.getByRole('alertdialog').getByRole('button', { name: /^générer le code$/i }).click(), 200, 'génération du PIN');
  531 |         const dialog = partner.getByRole('dialog', { name: /^nouveau code pin régisseur$/i });
  532 |         await expect(dialog).toBeVisible();
  533 |         r.pin = (await dialog.getByLabel(/^code pin/i).innerText()).trim();
  534 |         expect(r.pin, 'PIN affiché à sa génération').toMatch(/^\d{4,8}$/);
  535 |         await dialog.getByRole('button', { name: /^j’ai noté le code$/i }).click();
  536 |         await expect(partner.getByText(/un code est en place/i)).toBeVisible();
  537 |     });
  538 | });
  539 | 
  540 | test('acte 4 [client] : découverte, fiche, refus direct, inscription depuis l’achat, achats, Mes billets, transfert', async ({ browser }, testInfo) => {
  541 |     const client = await asNew(browser, testInfo, 'C1');
  542 |     const standard = (): RegExp => /ajouter un billet standard/i;
  543 | 
  544 |     await test.step('visiteur : recherche, ville, fiche avec programme et infos pratiques (A15), catégories hors ligne absentes', async () => {
  545 |         await client.goto('/explore');
  546 |         await client.getByLabel(/^rechercher un événement/i).fill(r.e1.title);
  547 |         await client.getByLabel(/^ville/i).selectOption({ label: 'Dakar' });
  548 |         await expect(client.getByRole('link', { name: /Nuit du Sabar/ }), 'recherche : un autre événement de Dakar disparaît').toHaveCount(0);
  549 |         await client.getByRole('link', { name: new RegExp(escapeRe(r.e1.title)) }).first().click();
  550 |         await client.waitForURL(new RegExp(`/events/${r.e1.id}`));
  551 |         await expect(client.getByRole('heading', { level: 1, name: r.e1.title })).toBeVisible();
  552 | 
  553 |         await expect(client.getByRole('heading', { name: /^programme$/i }), 'A15 : section Programme').toBeVisible();
  554 |         await expect(client.getByText(PROGRAM.title, { exact: true }), 'A15 : ligne du programme').toBeVisible();
  555 |         await expect(client.getByText(PROGRAM.participant), 'A15 : artiste du programme').toBeVisible();
  556 |         await expect(client.getByRole('heading', { name: /^lieu et accès$/i }), 'A15 : section des infos pratiques').toBeVisible();
  557 |         for (const text of [PRACTICAL.address, PRACTICAL.access, PRACTICAL.parking, PRACTICAL.rules]) {
  558 |             await expect(client.getByText(text, { exact: true }), `A15 : info pratique « ${text} »`).toBeVisible();
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
> 625 |             await expect(card.locator('[data-ev-offline-state]'), `billet ${number} : « Disponible hors ligne »`).toHaveAttribute('data-ev-offline-state', 'available', { timeout: 60_000 });
      |                                                                                                                   ^ Error: billet TCK-20261114-DF52D72DAF : « Disponible hors ligne »
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
  659 |         await expect(confirmBox, 'boîte « mot de passe » ouverte par le refus').toBeVisible();
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
```