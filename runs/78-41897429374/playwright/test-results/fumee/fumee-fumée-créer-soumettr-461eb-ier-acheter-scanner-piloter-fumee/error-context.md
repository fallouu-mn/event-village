# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fumee.spec.ts >> fumée : créer, soumettre, valider, publier, acheter, scanner, piloter
- Location: e2e/fumee.spec.ts:290:5

# Error details

```
Error: aucune requête en échec sur la page hors ligne

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "GET http://localhost:3000/api/features : net::ERR_INTERNET_DISCONNECTED",
+ ]
```

# Test source

```ts
  592 |             const cancelSms = cancel.filter((r) => r.channel === 'SMS');
  593 |             expect(cancelSms.map((r) => r.status), `EVENT_CANCELLED SMS du client : ${brief(cancel)}`).toEqual(['SENT']);
  594 |             expect(cancel.filter((r) => r.channel === 'IN_APP').map((r) => r.status), `EVENT_CANCELLED dans l’application : ${brief(cancel)}`).toEqual(['SENT']);
  595 |             expectedCancel = await c.renderSms('EVENT_CANCELLED', renderData(cancelSms[0], e2Event));
  596 |             const received = smsSince(await fakeSmsTo(clientPhone), before);
  597 |             const messages = JSON.stringify(received.map((m) => m.message));
  598 |             expect(received.filter((m) => m.message === expectedCancel).length,
  599 |                 `avis d’annulation exact une seule fois (attendu « ${expectedCancel} ») ; reçus : ${messages}`).toBe(1);
  600 |             expect(received.filter((m) => m.message === expectedH3).length, `aucun H-3 envoyé après l’annulation ; reçus : ${messages}`).toBe(0);
  601 |             const panel = await openBell(client);
  602 |             await expect(panel.getByText(/événement annulé/i).first()).toBeVisible();
  603 |         });
  604 | 
  605 |         await test.step('10. comptage par différence depuis l’étape 8 ; aucune ligne de E2 en SENDING', async () => {
  606 |             const received = smsSince(await fakeSmsTo(clientPhone), smsMark);
  607 |             const counts = {
  608 |                 j1: received.filter((m) => m.message === expectedJ1).length,
  609 |                 h3: received.filter((m) => m.message === expectedH3).length,
  610 |                 annulation: received.filter((m) => m.message === expectedCancel).length,
  611 |             };
  612 |             console.log(`[e2e][fumée] SMS du client depuis l’étape 8 : ${received.length} (${JSON.stringify(counts)})`);
  613 |             expect(counts, `SMS du client depuis l’étape 8 : ${JSON.stringify(received.map((m) => m.message))}`).toEqual({ j1: 1, h3: 0, annulation: 1 });
  614 |             // Lot 7 (D81) : liste exacte, par jointure provider_message_id = ticket du faux MTarget
  615 |             const identified = await identifySms('depuis le repère de l’étape 8', received, { [eventId]: 'E1', [e2Id]: 'E2' });
  616 |             expect(identified.filter((d) => d.line === null).map((d) => `${d.sms.ticket} « ${d.sms.message.slice(0, 60)} »`),
  617 |                 'chaque SMS reçu depuis le repère a sa ligne dans la boîte d’envoi (provider_message_id)').toEqual([]);
  618 |             const lines = identified.flatMap((d) => (d.line ? [d.line] : []));
  619 |             expect(lines.map((l) => `${l.type} ${l.event_id === e2Id ? 'E2' : l.event_id ?? 'sans événement'}`).sort(),
  620 |                 `SMS du client depuis le repère : ${JSON.stringify(lines.map((l) => ({ type: l.type, cle: l.idempotency_key })))}`)
  621 |                 // REFUND_PAID E2 : remboursement automatique de l'achat E2 à l'annulation (event_cancel →
  622 |                 // refund_request EVENT_CANCELLATION_REFUND, envoyé aussitôt par CashoutService.sendBatch ; avis mis en
  623 |                 // file par le trigger des cashouts au passage à CONFIRME, clé REFUND_PAID:<cashout>). Déjà relevé au
  624 |                 // lot 6 parmi les SMS non identifiés de la fumée (contrat du lot 7, dette : PURCHASE_CONFIRMED E2,
  625 |                 // PURCHASE_CONFIRMED E1, REFUND_PAID E2) ; oublié dans la liste exacte jusqu'au run 77.
  626 |                 // Unicité contrôlée juste après (aucune clé deux fois).
  627 |                 .toEqual(['EVENT_CANCELLED E2', 'PURCHASE_CONFIRMED E2', 'REFUND_PAID E2', 'REMINDER_J1 E2']);
  628 |             const keys = lines.map((l) => `${l.type} ${l.idempotency_key}`);
  629 |             expect(keys.filter((k, i) => keys.indexOf(k) !== i), 'aucun SMS envoyé deux fois pour la même clé (doublon = défaut)').toEqual([]);
  630 |             expect(lines.filter((l) => l.status !== 'SENT').map((l) => `${l.type} ${l.status}`), 'lignes des SMS reçus au statut SENT').toEqual([]);
  631 |             const sending = await sendingOfEvent(e2Id);
  632 |             expect(sending, `lignes de E2 encore SENDING : ${brief(sending)}`).toEqual([]);
  633 |         });
  634 | 
  635 |         // ── Lot 7 (contrat 11.4) : étapes 11 à 16 ───────────────────────────
  636 |         const e3Category = 'Entrée générale';
  637 |         let e3Tickets: string[] = [];
  638 |         let e3Numbers: string[] = [];
  639 |         let oldLot: StoredLot | null = null;
  640 |         let swClient: Page | null = null;
  641 |         let controller: Page | null = null;
  642 |         const swApiResponses: string[] = [];
  643 | 
  644 |         await test.step('11. événement E3 à ≈ 20 h (partenaire A, catégorie payante), contrôleur A affecté, fenêtre de scan à 24 h', async () => {
  645 |             e3 = prepareTerrainEvent('fumee prolongee', 'client', 0, { priceFcfa: 5000 });
  646 |             expect(e3.tickets, 'aucun billet émis par la préparation (achat par l’interface)').toEqual([]);
  647 |         });
  648 | 
  649 |         await test.step('12. achat de 2 billets de E3 par l’interface, puis Mes billets avec le service worker : disponibles hors ligne', async () => {
  650 |             if (!e3) throw new Error('événement E3 absent (étape 11 non aboutie)');
  651 |             e3Tickets = await buyThroughUi(client, e3.eventId, e3Category, 2);
  652 |             e3Numbers = await ticketNumbers(e3Tickets);
  653 |             const page = await pageAs('fumee-client', false, { serviceWorkers: 'allow' });
  654 |             swClient = page;
  655 |             page.context().on('response', (r) => {
  656 |                 try {
  657 |                     if (r.fromServiceWorker() && new URL(r.url()).pathname.startsWith('/api/')) swApiResponses.push(`${r.status()} ${r.url()}`);
  658 |                 } catch (err) {
  659 |                     swApiResponses.push(`URL illisible (${err instanceof Error ? err.message : String(err)})`);
  660 |                 }
  661 |             });
  662 |             await page.goto('/tickets');
  663 |             for (const number of e3Numbers) {
  664 |                 const card = page.locator('li, article').filter({ hasText: number }).last();
  665 |                 await expect(card, `carte du billet ${number} dans Mes billets`).toBeVisible({ timeout: 45_000 });
  666 |                 await expect(card.locator('[data-ev-offline-state]'), `billet ${number} : « Disponible hors ligne » (téléchargement automatique la veille)`)
  667 |                     .toHaveAttribute('data-ev-offline-state', 'available', { timeout: 60_000 });
  668 |             }
  669 |             const lots = await readStoredLots(page, e3Tickets[1]);
  670 |             expect(lots.length, `lot du 2e billet dans IndexedDB : ${lots.length} lot(s)`).toBe(1);
  671 |             oldLot = lots[0];
  672 |             console.log(`[e2e][fumée] lot hors ligne du billet ${e3Numbers[1]} : version ${oldLot.secret_version}, ${oldLot.count} codes de ${oldLot.step_seconds} s à partir du pas ${oldLot.first_counter}`);
  673 |         });
  674 | 
  675 |         await test.step('13. hors ligne : page du billet servie par le service worker, QR qui change au bout de ≈ 21 s réelles', async () => {
  676 |             const page = swClient;
  677 |             if (!page) throw new Error('contexte du client avec service worker absent (étape 12 non aboutie)');
  678 |             const failed: string[] = [];
  679 |             const consoleErrors: string[] = [];
  680 |             await page.context().setOffline(true);
  681 |             page.on('requestfailed', (r) => failed.push(`${r.method()} ${r.url()} : ${r.failure()?.errorText ?? 'échec'}`));
  682 |             page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  683 |             const res = await page.goto(`/billet/hors-ligne?id=${encodeURIComponent(e3Tickets[0])}`);
  684 |             expect(res?.fromServiceWorker(), '/billet/hors-ligne hors ligne : réponse servie par le service worker').toBe(true);
  685 |             const qr = page.locator('[data-ev-qr-payload]');
  686 |             await expect(qr, 'QR du billet 1 affiché hors ligne').toBeVisible({ timeout: 20_000 });
  687 |             const first = await qr.getAttribute('data-ev-qr-counter');
  688 |             expect(first, 'pas du QR affiché (data-ev-qr-counter)').toMatch(/^\d+$/);
  689 |             await expect.poll(async () => qr.getAttribute('data-ev-qr-counter'), {
  690 |                 message: 'le QR hors ligne change de pas au bout de ≈ 21 s réelles', timeout: 35_000, intervals: [1_000],
  691 |             }).not.toBe(first);
> 692 |             expect(failed, 'aucune requête en échec sur la page hors ligne').toEqual([]);
      |                                                                              ^ Error: aucune requête en échec sur la page hors ligne
  693 |             expect(consoleErrors, 'aucune erreur de console sur la page hors ligne').toEqual([]);
  694 |         });
  695 | 
  696 |         await test.step('14. contrôleur A en ligne : QR lu sur le téléphone hors ligne du client → entrée validée', async () => {
  697 |             if (!e3 || !swClient) throw new Error('étapes 11 à 13 non abouties');
  698 |             const clientPage: Page = swClient;
  699 |             controller = await pageAs('fumee-controleur', false, { scanProbe: true });
  700 |             await openScanner(controller, e3.title);
  701 |             const payload = String(await clientPage.locator('[data-ev-qr-payload]').getAttribute('data-ev-qr-payload'));
  702 |             expect(payload, 'payload affiché hors ligne : <préfixe>:<billet 1>:<6 chiffres>').toMatch(new RegExp(`:${e3Tickets[0]}:\\d{6}$`));
  703 |             await presentPayload(controller, payload, 'billet 1 présenté hors ligne');
  704 |             await expect(controller.locator('[data-scan-result="valid"]').first(), 'billet 1 hors ligne : « valid »').toBeVisible();
  705 |         });
  706 | 
  707 |         await test.step('15. transfert du billet 2 au second client, acceptation, puis ancien code présenté → refusé (qr_expired)', async () => {
  708 |             if (!e3 || !oldLot || !controller) throw new Error('étapes 11 à 14 non abouties');
  709 |             const lot: StoredLot = oldLot;
  710 |             const ctl: Page = controller;
  711 |             const recipient = verifyHolderPhone('client-bis');
  712 |             console.log(`[e2e][fumée] numéro du second client ${recipient.changed ? 'marqué vérifié' : 'déjà vérifié'} (${recipient.verifiedAt})`);
  713 |             await client.goto('/tickets');
  714 |             const card = client.locator('li, article').filter({ hasText: e3Numbers[1] }).last();
  715 |             await card.getByRole('button', { name: /^transférer$/i }).click();
  716 |             const dialog = client.getByRole('dialog', { name: /^transférer ce billet$/i });
  717 |             await expect(dialog).toBeVisible();
  718 |             await dialog.getByLabel(/^numéro de téléphone du destinataire/i).fill(FIXTURE_USERS.CLIENT_BIS.phone.replace(/^\+221/, ''));
  719 |             const sent = client.waitForResponse((r) => new URL(r.url()).pathname === `/api/tickets/${e3Tickets[1]}/transfer` && r.request().method() === 'POST');
  720 |             await dialog.getByRole('button', { name: /^envoyer le billet$/i }).click();
  721 |             const sentRes = await sent;
  722 |             expect(sentRes.status(), `transfert du billet 2 : ${(await sentRes.text()).slice(0, 300)}`).toBe(200);
  723 |             await dialog.getByRole('button', { name: /^terminer$/i }).click();
  724 | 
  725 |             const bis = await pageAs('fumee-client-bis');
  726 |             await bis.goto('/tickets?tab=recus');
  727 |             const offer = bis.locator('li, article, section').filter({ hasText: e3.title }).filter({ has: bis.getByRole('button', { name: /^accepter le billet$/i }) }).last();
  728 |             await offer.getByRole('button', { name: /^accepter le billet$/i }).click();
  729 |             const confirm = bis.getByRole('dialog').or(bis.getByRole('alertdialog'));
  730 |             await expect(confirm).toBeVisible();
  731 |             const claimed = bis.waitForResponse((r) => /^\/api\/tickets\/transfers\/[^/]+\/claim$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST');
  732 |             await confirm.getByRole('button', { name: /^accepter le billet$/i }).click();
  733 |             const claimRes = await claimed;
  734 |             expect(claimRes.status(), `acceptation du transfert : ${(await claimRes.text()).slice(0, 300)}`).toBe(200);
  735 | 
  736 |             const old = payloadFromLot(lot);
  737 |             console.log(`[e2e][fumée] ancien code du billet ${e3Numbers[1]} (version ${lot.secret_version}, pas ${old.counter}) présenté au contrôleur`);
  738 |             await presentPayload(ctl, old.payload, 'ancien code du billet 2 après le transfert');
  739 |             await expect(ctl.locator('[data-scan-result="qr_expired"]').first(), 'ancien code après le transfert : « qr_expired » (D3)').toBeVisible();
  740 |         });
  741 | 
  742 |         await test.step('16. caches du client : coquille hors ligne seulement, rien de /api/ ; route des codes jamais servie hors ligne', async () => {
  743 |             const page = swClient;
  744 |             if (!page) throw new Error('contexte du client avec service worker absent');
  745 |             const keys = await page.evaluate(async () => (await caches.keys()).sort());
  746 |             expect(keys, `caches du client : seul ${OFFLINE_CACHE} attendu`).toEqual([OFFLINE_CACHE]);
  747 |             const urls = await page.evaluate(async (name) => (await (await caches.open(name)).keys()).map((r) => r.url), OFFLINE_CACHE);
  748 |             const forbidden = urls.filter((u) => {
  749 |                 const url = new URL(u);
  750 |                 return url.pathname.startsWith('/api/') || url.searchParams.has('_rsc');
  751 |             });
  752 |             expect(forbidden, `aucune URL /api/ ni _rsc dans ${OFFLINE_CACHE} (${urls.length} entrée(s))`).toEqual([]);
  753 |             expect(swApiResponses, 'aucune réponse /api/ servie par le service worker').toEqual([]);
  754 |             await page.context().setOffline(true);
  755 |             const outcome = await page.evaluate(async (id) => {
  756 |                 try {
  757 |                     const r = await fetch(`/api/tickets/${id}/offline-codes`, { cache: 'no-store' });
  758 |                     return `servi (HTTP ${r.status})`;
  759 |                 } catch (err) {
  760 |                     return `rejeté (${err instanceof Error ? err.message : String(err)})`;
  761 |                 }
  762 |             }, e3Tickets[0]);
  763 |             expect(outcome, 'hors ligne, la route des codes n’est jamais servie depuis un cache').toMatch(/^rejeté/);
  764 |         });
  765 |     } finally {
  766 |         // Lot 7 (étape 11) : réglage access.scan_window_before_hours remis, même après un échec
  767 |         if (e3) restoreTerrainSetting(e3);
  768 |         const notices = guards.flatMap(({ role, guard }) => guard.nonBlockingIssues().map((i) => `${role} : ${i}`));
  769 |         if (notices.length > 0) console.log(`[e2e][fumée] avertissements non bloquants du navigateur :\n${notices.join('\n')}`);
  770 |         const issues = guards.flatMap(({ role, guard }) => guard.blockingIssues().map((i) => `${role} : ${i}`));
  771 |         if (issues.length > 0) {
  772 |             await testInfo.attach('erreurs-navigateur.txt', { body: issues.join('\n'), contentType: 'text/plain' });
  773 |             console.log(`[e2e][fumée] erreurs observées dans le navigateur :\n${issues.join('\n')}`);
  774 |         }
  775 |         for (const c of contexts) await c.close();
  776 |     }
  777 | });
  778 | 
```