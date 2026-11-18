# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fumee.spec.ts >> fumée : créer, soumettre, valider, publier, acheter, scanner, piloter
- Location: e2e/fumee.spec.ts:99:5

# Error details

```
TimeoutError: locator.getAttribute: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('[data-ev-qr-payload]')

```

# Test source

```ts
  436 | 
  437 |             const cancel = (await outboxOfEvent(e2Id, ['EVENT_CANCELLED']))
  438 |                 .filter((r) => r.recipient_user_id === clientUserId || r.recipient_phone === clientPhone);
  439 |             const cancelSms = cancel.filter((r) => r.channel === 'SMS');
  440 |             expect(cancelSms.map((r) => r.status), `EVENT_CANCELLED SMS du client : ${brief(cancel)}`).toEqual(['SENT']);
  441 |             expect(cancel.filter((r) => r.channel === 'IN_APP').map((r) => r.status), `EVENT_CANCELLED dans l’application : ${brief(cancel)}`).toEqual(['SENT']);
  442 |             expectedCancel = await c.renderSms('EVENT_CANCELLED', renderData(cancelSms[0], e2Event));
  443 |             const received = smsSince(await fakeSmsTo(clientPhone), before);
  444 |             const messages = JSON.stringify(received.map((m) => m.message));
  445 |             expect(received.filter((m) => m.message === expectedCancel).length,
  446 |                 `avis d’annulation exact une seule fois (attendu « ${expectedCancel} ») ; reçus : ${messages}`).toBe(1);
  447 |             expect(received.filter((m) => m.message === expectedH3).length, `aucun H-3 envoyé après l’annulation ; reçus : ${messages}`).toBe(0);
  448 |             const panel = await openBell(client);
  449 |             await expect(panel.getByText(/événement annulé/i).first()).toBeVisible();
  450 |         });
  451 | 
  452 |         await test.step('10. comptage par différence depuis l’étape 8 ; aucune ligne de E2 en SENDING', async () => {
  453 |             const received = smsSince(await fakeSmsTo(clientPhone), smsMark);
  454 |             const counts = {
  455 |                 j1: received.filter((m) => m.message === expectedJ1).length,
  456 |                 h3: received.filter((m) => m.message === expectedH3).length,
  457 |                 annulation: received.filter((m) => m.message === expectedCancel).length,
  458 |             };
  459 |             console.log(`[e2e][fumée] SMS du client depuis l’étape 8 : ${received.length} (${JSON.stringify(counts)})`);
  460 |             expect(counts, `SMS du client depuis l’étape 8 : ${JSON.stringify(received.map((m) => m.message))}`).toEqual({ j1: 1, h3: 0, annulation: 1 });
  461 |             // Lot 7 (D81) : liste exacte, par jointure provider_message_id = ticket du faux MTarget
  462 |             const identified = await identifySms('depuis le repère de l’étape 8', received, { [eventId]: 'E1', [e2Id]: 'E2' });
  463 |             expect(identified.filter((d) => d.line === null).map((d) => `${d.sms.ticket} « ${d.sms.message.slice(0, 60)} »`),
  464 |                 'chaque SMS reçu depuis le repère a sa ligne dans la boîte d’envoi (provider_message_id)').toEqual([]);
  465 |             const lines = identified.flatMap((d) => (d.line ? [d.line] : []));
  466 |             expect(lines.map((l) => `${l.type} ${l.event_id === e2Id ? 'E2' : l.event_id ?? 'sans événement'}`).sort(),
  467 |                 `SMS du client depuis le repère : ${JSON.stringify(lines.map((l) => ({ type: l.type, cle: l.idempotency_key })))}`)
  468 |                 // REFUND_PAID E2 : remboursement automatique de l'achat E2 à l'annulation (event_cancel →
  469 |                 // refund_request EVENT_CANCELLATION_REFUND, envoyé aussitôt par CashoutService.sendBatch ; avis mis en
  470 |                 // file par le trigger des cashouts au passage à CONFIRME, clé REFUND_PAID:<cashout>). Déjà relevé au
  471 |                 // lot 6 parmi les SMS non identifiés de la fumée (contrat du lot 7, dette : PURCHASE_CONFIRMED E2,
  472 |                 // PURCHASE_CONFIRMED E1, REFUND_PAID E2) ; oublié dans la liste exacte jusqu'au run 77.
  473 |                 // Unicité contrôlée juste après (aucune clé deux fois).
  474 |                 .toEqual(['EVENT_CANCELLED E2', 'PURCHASE_CONFIRMED E2', 'REFUND_PAID E2', 'REMINDER_J1 E2']);
  475 |             const keys = lines.map((l) => `${l.type} ${l.idempotency_key}`);
  476 |             expect(keys.filter((k, i) => keys.indexOf(k) !== i), 'aucun SMS envoyé deux fois pour la même clé (doublon = défaut)').toEqual([]);
  477 |             expect(lines.filter((l) => l.status !== 'SENT').map((l) => `${l.type} ${l.status}`), 'lignes des SMS reçus au statut SENT').toEqual([]);
  478 |             const sending = await sendingOfEvent(e2Id);
  479 |             expect(sending, `lignes de E2 encore SENDING : ${brief(sending)}`).toEqual([]);
  480 |         });
  481 | 
  482 |         // ── Lot 7 (contrat 11.4) : étapes 11 à 16 ───────────────────────────
  483 |         const e3Category = 'Entrée générale';
  484 |         let e3Tickets: string[] = [];
  485 |         let e3Numbers: string[] = [];
  486 |         let oldLot: StoredLot | null = null;
  487 |         let swClient: Page | null = null;
  488 |         let controller: Page | null = null;
  489 |         const swApiResponses: string[] = [];
  490 | 
  491 |         await test.step('11. événement E3 à ≈ 20 h (partenaire A, catégorie payante), contrôleur A affecté, fenêtre de scan à 24 h', async () => {
  492 |             e3 = prepareTerrainEvent('fumee prolongee', 'client', 0, { priceFcfa: 5000 });
  493 |             expect(e3.tickets, 'aucun billet émis par la préparation (achat par l’interface)').toEqual([]);
  494 |         });
  495 | 
  496 |         await test.step('12. achat de 2 billets de E3 par l’interface, puis Mes billets avec le service worker : disponibles hors ligne', async () => {
  497 |             if (!e3) throw new Error('événement E3 absent (étape 11 non aboutie)');
  498 |             e3Tickets = await buyThroughUi(client, e3.eventId, e3Category, 2);
  499 |             e3Numbers = await ticketNumbers(e3Tickets);
  500 |             const page = await pageAs('fumee-client', false, { serviceWorkers: 'allow' });
  501 |             swClient = page;
  502 |             page.context().on('response', (r) => {
  503 |                 try {
  504 |                     if (r.fromServiceWorker() && new URL(r.url()).pathname.startsWith('/api/')) swApiResponses.push(`${r.status()} ${r.url()}`);
  505 |                 } catch (err) {
  506 |                     swApiResponses.push(`URL illisible (${err instanceof Error ? err.message : String(err)})`);
  507 |                 }
  508 |             });
  509 |             await page.goto('/tickets');
  510 |             for (const number of e3Numbers) {
  511 |                 const card = page.locator('li, article').filter({ hasText: number }).last();
  512 |                 await expect(card, `carte du billet ${number} dans Mes billets`).toBeVisible({ timeout: 45_000 });
  513 |                 await expect(card.locator('[data-ev-offline-state]'), `billet ${number} : « Disponible hors ligne » (téléchargement automatique la veille)`)
  514 |                     .toHaveAttribute('data-ev-offline-state', 'available', { timeout: 60_000 });
  515 |             }
  516 |             const lots = await readStoredLots(page, e3Tickets[1]);
  517 |             expect(lots.length, `lot du 2e billet dans IndexedDB : ${lots.length} lot(s)`).toBe(1);
  518 |             oldLot = lots[0];
  519 |             console.log(`[e2e][fumée] lot hors ligne du billet ${e3Numbers[1]} : version ${oldLot.secret_version}, ${oldLot.count} codes de ${oldLot.step_seconds} s à partir du pas ${oldLot.first_counter}`);
  520 |         });
  521 | 
  522 |         await test.step('13. hors ligne : page du billet servie par le service worker, QR qui change au bout de ≈ 21 s réelles', async () => {
  523 |             const page = swClient;
  524 |             if (!page) throw new Error('contexte du client avec service worker absent (étape 12 non aboutie)');
  525 |             const failed: string[] = [];
  526 |             const consoleErrors: string[] = [];
  527 |             await page.context().setOffline(true);
  528 |             page.on('requestfailed', (r) => failed.push(`${r.method()} ${r.url()} : ${r.failure()?.errorText ?? 'échec'}`));
  529 |             page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  530 |             const res = await page.goto(`/billet/hors-ligne?id=${encodeURIComponent(e3Tickets[0])}`);
  531 |             expect(res?.fromServiceWorker(), '/billet/hors-ligne hors ligne : réponse servie par le service worker').toBe(true);
  532 |             const qr = page.locator('[data-ev-qr-payload]');
  533 |             await expect(qr, 'QR du billet 1 affiché hors ligne').toBeVisible({ timeout: 20_000 });
  534 |             const first = await qr.getAttribute('data-ev-qr-counter');
  535 |             expect(first, 'pas du QR affiché (data-ev-qr-counter)').toMatch(/^\d+$/);
> 536 |             await expect.poll(async () => qr.getAttribute('data-ev-qr-counter'), {
      |                                              ^ TimeoutError: locator.getAttribute: Timeout 15000ms exceeded.
  537 |                 message: 'le QR hors ligne change de pas au bout de ≈ 21 s réelles', timeout: 35_000, intervals: [1_000],
  538 |             }).not.toBe(first);
  539 |             expect(failed, 'aucune requête en échec sur la page hors ligne').toEqual([]);
  540 |             expect(consoleErrors, 'aucune erreur de console sur la page hors ligne').toEqual([]);
  541 |         });
  542 | 
  543 |         await test.step('14. contrôleur A en ligne : QR lu sur le téléphone hors ligne du client → entrée validée', async () => {
  544 |             if (!e3 || !swClient) throw new Error('étapes 11 à 13 non abouties');
  545 |             const clientPage: Page = swClient;
  546 |             controller = await pageAs('fumee-controleur', false, { scanProbe: true });
  547 |             await openScanner(controller, e3.title);
  548 |             const payload = String(await clientPage.locator('[data-ev-qr-payload]').getAttribute('data-ev-qr-payload'));
  549 |             expect(payload, 'payload affiché hors ligne : <préfixe>:<billet 1>:<6 chiffres>').toMatch(new RegExp(`:${e3Tickets[0]}:\\d{6}$`));
  550 |             await presentPayload(controller, payload, 'billet 1 présenté hors ligne');
  551 |             await expect(controller.locator('[data-scan-result="valid"]').first(), 'billet 1 hors ligne : « valid »').toBeVisible();
  552 |         });
  553 | 
  554 |         await test.step('15. transfert du billet 2 au second client, acceptation, puis ancien code présenté → refusé (qr_expired)', async () => {
  555 |             if (!e3 || !oldLot || !controller) throw new Error('étapes 11 à 14 non abouties');
  556 |             const lot: StoredLot = oldLot;
  557 |             const ctl: Page = controller;
  558 |             const recipient = verifyHolderPhone('client-bis');
  559 |             console.log(`[e2e][fumée] numéro du second client ${recipient.changed ? 'marqué vérifié' : 'déjà vérifié'} (${recipient.verifiedAt})`);
  560 |             await client.goto('/tickets');
  561 |             const card = client.locator('li, article').filter({ hasText: e3Numbers[1] }).last();
  562 |             await card.getByRole('button', { name: /^transférer$/i }).click();
  563 |             const dialog = client.getByRole('dialog', { name: /^transférer ce billet$/i });
  564 |             await expect(dialog).toBeVisible();
  565 |             await dialog.getByLabel(/^numéro de téléphone du destinataire/i).fill(FIXTURE_USERS.CLIENT_BIS.phone.replace(/^\+221/, ''));
  566 |             // Lot 9 bis (R57, B35, contrat 4.2 et 5.13) : le transfert demande un mot de passe saisi depuis moins de 10 min ;
  567 |             // les saisies du client sont effacées d'abord (la connexion de la phase « connexion » en compte une), puis la
  568 |             // boîte « mot de passe » s'ouvre sur le refus et le transfert repart après la confirmation
  569 |             await clearPasswordConfirmations(clientUserId);
  570 |             const transferPath = `/api/tickets/${e3Tickets[1]}/transfer`;
  571 |             const refused = client.waitForResponse((r) => new URL(r.url()).pathname === transferPath && r.request().method() === 'POST');
  572 |             await dialog.getByRole('button', { name: /^envoyer le billet$/i }).click();
  573 |             const refusedRes = await refused;
  574 |             const refusedBody = (await refusedRes.json().catch(() => ({}))) as { code?: string };
  575 |             expect(`${refusedRes.status()} ${String(refusedBody.code)}`, 'transfert sans mot de passe récent (R57)').toBe('403 PASSWORD_CONFIRMATION_REQUIRED');
  576 |             const confirmBox = client.getByRole('dialog', { name: /^confirmez votre mot de passe$/i });
  577 |             await expect(confirmBox, 'boîte « mot de passe » ouverte par le refus (R57)').toBeVisible();
  578 |             await confirmBox.getByLabel(/^mot de passe/i).fill(TEST_PASSWORD);
  579 |             const confirmed = client.waitForResponse((r) => new URL(r.url()).pathname === '/api/account/password-confirm' && r.request().method() === 'POST');
  580 |             const sent = client.waitForResponse((r) => new URL(r.url()).pathname === transferPath && r.request().method() === 'POST');
  581 |             await confirmBox.getByRole('button', { name: /^confirmer$/i }).click();
  582 |             const confirmedRes = await confirmed;
  583 |             expect(confirmedRes.status(), `mot de passe confirmé : ${(await confirmedRes.text()).slice(0, 300)}`).toBe(200);
  584 |             const sentRes = await sent;
  585 |             expect(sentRes.status(), `transfert du billet 2 relancé après la confirmation : ${(await sentRes.text()).slice(0, 300)}`).toBe(200);
  586 |             await dialog.getByRole('button', { name: /^terminer$/i }).click();
  587 | 
  588 |             const bis = await pageAs('fumee-client-bis');
  589 |             await bis.goto('/tickets?tab=recus');
  590 |             const offer = bis.locator('li, article, section').filter({ hasText: e3.title }).filter({ has: bis.getByRole('button', { name: /^accepter le billet$/i }) }).last();
  591 |             await offer.getByRole('button', { name: /^accepter le billet$/i }).click();
  592 |             const confirm = bis.getByRole('dialog').or(bis.getByRole('alertdialog'));
  593 |             await expect(confirm).toBeVisible();
  594 |             const claimed = bis.waitForResponse((r) => /^\/api\/tickets\/transfers\/[^/]+\/claim$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST');
  595 |             await confirm.getByRole('button', { name: /^accepter le billet$/i }).click();
  596 |             const claimRes = await claimed;
  597 |             expect(claimRes.status(), `acceptation du transfert : ${(await claimRes.text()).slice(0, 300)}`).toBe(200);
  598 | 
  599 |             const old = payloadFromLot(lot);
  600 |             console.log(`[e2e][fumée] ancien code du billet ${e3Numbers[1]} (version ${lot.secret_version}, pas ${old.counter}) présenté au contrôleur`);
  601 |             await presentPayload(ctl, old.payload, 'ancien code du billet 2 après le transfert');
  602 |             await expect(ctl.locator('[data-scan-result="qr_expired"]').first(), 'ancien code après le transfert : « qr_expired » (D3)').toBeVisible();
  603 |         });
  604 | 
  605 |         await test.step('16. caches du client : coquille hors ligne seulement, rien de /api/ ; route des codes jamais servie hors ligne', async () => {
  606 |             const page = swClient;
  607 |             if (!page) throw new Error('contexte du client avec service worker absent');
  608 |             const keys = await page.evaluate(async () => (await caches.keys()).sort());
  609 |             expect(keys, `caches du client : seul ${OFFLINE_CACHE} attendu`).toEqual([OFFLINE_CACHE]);
  610 |             const urls = await page.evaluate(async (name) => (await (await caches.open(name)).keys()).map((r) => r.url), OFFLINE_CACHE);
  611 |             const forbidden = urls.filter((u) => {
  612 |                 const url = new URL(u);
  613 |                 return url.pathname.startsWith('/api/') || url.searchParams.has('_rsc');
  614 |             });
  615 |             expect(forbidden, `aucune URL /api/ ni _rsc dans ${OFFLINE_CACHE} (${urls.length} entrée(s))`).toEqual([]);
  616 |             expect(swApiResponses, 'aucune réponse /api/ servie par le service worker').toEqual([]);
  617 |             await page.context().setOffline(true);
  618 |             const outcome = await page.evaluate(async (id) => {
  619 |                 try {
  620 |                     const r = await fetch(`/api/tickets/${id}/offline-codes`, { cache: 'no-store' });
  621 |                     return `servi (HTTP ${r.status})`;
  622 |                 } catch (err) {
  623 |                     return `rejeté (${err instanceof Error ? err.message : String(err)})`;
  624 |                 }
  625 |             }, e3Tickets[0]);
  626 |             expect(outcome, 'hors ligne, la route des codes n’est jamais servie depuis un cache').toMatch(/^rejeté/);
  627 |         });
  628 |     } finally {
  629 |         // Lot 7 (étape 11) : réglage access.scan_window_before_hours remis, même après un échec
  630 |         if (e3) restoreTerrainSetting(e3);
  631 |         const notices = guards.flatMap(({ role, guard }) => guard.nonBlockingIssues().map((i) => `${role} : ${i}`));
  632 |         if (notices.length > 0) console.log(`[e2e][fumée] avertissements non bloquants du navigateur :\n${notices.join('\n')}`);
  633 |         const issues = guards.flatMap(({ role, guard }) => guard.blockingIssues().map((i) => `${role} : ${i}`));
  634 |         if (issues.length > 0) {
  635 |             await testInfo.attach('erreurs-navigateur.txt', { body: issues.join('\n'), contentType: 'text/plain' });
  636 |             console.log(`[e2e][fumée] erreurs observées dans le navigateur :\n${issues.join('\n')}`);
```