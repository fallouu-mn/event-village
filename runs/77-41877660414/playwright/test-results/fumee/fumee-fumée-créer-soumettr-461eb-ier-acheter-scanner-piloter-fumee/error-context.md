# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fumee.spec.ts >> fumée : créer, soumettre, valider, publier, acheter, scanner, piloter
- Location: e2e/fumee.spec.ts:289:5

# Error details

```
Error: SMS du client depuis le repère : [{"type":"PURCHASE_CONFIRMED","cle":"PURCHASE_CONFIRMED:ef32c589-d9e8-43e1-99e3-c6d5ad416311:SMS"},{"type":"REMINDER_J1","cle":"REMINDER_J1:8e5c754e-c0c6-465b-84d9-8e0dd106cb73:c46d85d6-0179-47c1-8653-77e30e437b37:20261106T2000Z:SMS"},{"type":"EVENT_CANCELLED","cle":"EVENT_CANCELLED:8e5c754e-c0c6-465b-84d9-8e0dd106cb73:c46d85d6-0179-47c1-8653-77e30e437b37:SMS"},{"type":"REFUND_PAID","cle":"REFUND_PAID:cf7abefa-bfa7-4c61-bf52-b8b858b990d9:SMS"}]

expect(received).toEqual(expected) // deep equality

- Expected  - 0
+ Received  + 1

  Array [
    "EVENT_CANCELLED E2",
    "PURCHASE_CONFIRMED E2",
+   "REFUND_PAID E2",
    "REMINDER_J1 E2",
  ]
```

# Test source

```ts
  520 |             const scheduled = await c.schedule(veille, [e2Id]);
  521 |             console.log(`[e2e][fumée] planification à ${veille.toISOString()} : ${JSON.stringify(scheduled)}`);
  522 |             expect(scheduled.created.REMINDER_J1 ?? 0, `planification J-1 : ${JSON.stringify(scheduled)}`).toBeGreaterThan(0);
  523 |             const dispatched = await c.dispatch(new Date(veille.getTime() + 60_000), [e2Id]);
  524 |             console.log(`[e2e][fumée] envoyeur à ${new Date(veille.getTime() + 60_000).toISOString()} : ${JSON.stringify(dispatched)}`);
  525 | 
  526 |             const vapid = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
  527 |             const j1 = (await outboxOfEvent(e2Id, ['REMINDER_J1'])).filter((r) => r.recipient_user_id === clientUserId);
  528 |             expect(j1.map((r) => `${r.channel} ${r.status}${r.reason ? ` ${r.reason}` : ''}`).sort(), `lignes REMINDER_J1 du client : ${brief(j1)}`).toEqual([
  529 |                 'EMAIL SKIPPED EMAIL_NOT_CONFIGURED',
  530 |                 'IN_APP SENT',
  531 |                 `PUSH SKIPPED ${vapid ? 'NO_PUSH_SUBSCRIPTION' : 'PUSH_NOT_CONFIGURED'}`,
  532 |                 'SMS SENT',
  533 |             ]);
  534 |             const j1Sms = j1.find((r) => r.channel === 'SMS') as OutboxLine;
  535 |             expectedJ1 = await c.renderSms('REMINDER_J1', renderData(j1Sms, e2Event));
  536 |             const received = smsSince(await fakeSmsTo(clientPhone), smsMark);
  537 |             expect(received.filter((m) => m.message === expectedJ1).length,
  538 |                 `texte J-1 exact une seule fois au faux MTarget (attendu « ${expectedJ1} ») ; reçus : ${JSON.stringify(received.map((m) => m.message))}`).toBe(1);
  539 |             const panel = await openBell(client);
  540 |             await expect(panel.getByText(/rappel : c.est demain/i).first()).toBeVisible();
  541 | 
  542 |             const h3At = new Date(e2StartAt.getTime() - h3Hours * 3600_000 + 30_000);
  543 |             const h3Scheduled = await c.schedule(h3At, [e2Id]);
  544 |             console.log(`[e2e][fumée] planification à ${h3At.toISOString()} : ${JSON.stringify(h3Scheduled)}`);
  545 |             expect(h3Scheduled.created.REMINDER_H3 ?? 0, `planification H-3 : ${JSON.stringify(h3Scheduled)}`).toBeGreaterThan(0);
  546 |             const h3 = (await outboxOfEvent(e2Id, ['REMINDER_H3'])).filter((r) => r.recipient_user_id === clientUserId);
  547 |             expect(h3.length, `lignes REMINDER_H3 du client : ${brief(h3)}`).toBeGreaterThan(0);
  548 |             expect(h3.filter((r) => r.status !== 'PENDING'), `REMINDER_H3 en attente, rien d’envoyé : ${brief(h3)}`).toEqual([]);
  549 |             const h3Sms = h3.find((r) => r.channel === 'SMS');
  550 |             expect(h3Sms, `ligne SMS du H-3 : ${brief(h3)}`).toBeTruthy();
  551 |             expectedH3 = await c.renderSms('REMINDER_H3', renderData(h3Sms as OutboxLine, e2Event));
  552 |         });
  553 | 
  554 |         await test.step('9. annulation par le partenaire : H-3 annulés, avis d’annulation par la vraie route de l’envoyeur', async () => {
  555 |             if (!clock) throw new Error('horloge simulée absente (étape 8 non aboutie)');
  556 |             const c: SimulatedClock = clock;
  557 |             const before = new Set((await fakeSmsTo(clientPhone)).map((m) => m.ticket));
  558 |             await partner.goto(`/partner/events/${e2Id}`);
  559 |             await partner.getByRole('button', { name: /annuler l[’']événement/i }).click();
  560 |             const dialog = partner.getByRole('dialog').or(partner.getByRole('alertdialog'));
  561 |             await expect(dialog).toBeVisible();
  562 |             await expect(dialog.getByText(/acheteurs à prévenir/i)).toBeVisible();
  563 |             await dialog.getByLabel(/^avis public aux participants/i).fill('Concert de fumée annulé : les billets payés en ligne sont remboursés automatiquement.');
  564 |             await dialog.getByLabel(/^motif interne/i).fill('Fumée de bout en bout du lot 6.');
  565 |             await dialog.getByLabel(/pour confirmer, saisissez le titre exact/i).fill(e2Title);
  566 |             const cancelled = partner.waitForResponse(
  567 |                 (r) => new URL(r.url()).pathname === `/api/partner/events/${e2Id}/cancel` && r.request().method() === 'POST',
  568 |                 { timeout: 60_000 });
  569 |             await dialog.getByRole('button', { name: /^confirmer l[’']annulation$/i }).click();
  570 |             const res = await cancelled;
  571 |             expect(res.status(), `annulation par le partenaire : ${(await res.text()).slice(0, 300)}`).toBe(200);
  572 |             await expect(dialog).toBeHidden();
  573 | 
  574 |             const h3 = await outboxOfEvent(e2Id, ['REMINDER_H3']);
  575 |             expect(h3.length, 'lignes REMINDER_H3 de E2').toBeGreaterThan(0);
  576 |             expect(h3.map((r) => `${r.status} ${r.reason ?? ''}`), `REMINDER_H3 annulés dans la transaction de l’annulation : ${brief(h3)}`)
  577 |                 .toEqual(h3.map(() => 'CANCELLED EVENT_ANNULE'));
  578 | 
  579 |             const secret = process.env.CRON_SECRET;
  580 |             if (!secret) throw new Error(`CRON_SECRET absente de ${e2eConfig().envFile} : la vraie route de l’envoyeur est protégée`);
  581 |             // Même hôte que le contrôle de run-e2e.mjs : le serveur écoute sur 127.0.0.1 (localhost peut viser ::1)
  582 |             const cron = await fetch(`http://127.0.0.1:${new URL(APP_URL).port}/api/cron/notifications-dispatch`, {
  583 |                 method: 'GET', headers: { authorization: `Bearer ${secret}` },
  584 |             });
  585 |             const cronText = await cron.text();
  586 |             console.log(`[e2e][fumée] GET /api/cron/notifications-dispatch → ${cron.status} ${cronText.slice(0, 300)}`);
  587 |             expect(cron.status, `route de l’envoyeur : ${cronText.slice(0, 300)}`).toBe(200);
  588 | 
  589 |             const cancel = (await outboxOfEvent(e2Id, ['EVENT_CANCELLED']))
  590 |                 .filter((r) => r.recipient_user_id === clientUserId || r.recipient_phone === clientPhone);
  591 |             const cancelSms = cancel.filter((r) => r.channel === 'SMS');
  592 |             expect(cancelSms.map((r) => r.status), `EVENT_CANCELLED SMS du client : ${brief(cancel)}`).toEqual(['SENT']);
  593 |             expect(cancel.filter((r) => r.channel === 'IN_APP').map((r) => r.status), `EVENT_CANCELLED dans l’application : ${brief(cancel)}`).toEqual(['SENT']);
  594 |             expectedCancel = await c.renderSms('EVENT_CANCELLED', renderData(cancelSms[0], e2Event));
  595 |             const received = smsSince(await fakeSmsTo(clientPhone), before);
  596 |             const messages = JSON.stringify(received.map((m) => m.message));
  597 |             expect(received.filter((m) => m.message === expectedCancel).length,
  598 |                 `avis d’annulation exact une seule fois (attendu « ${expectedCancel} ») ; reçus : ${messages}`).toBe(1);
  599 |             expect(received.filter((m) => m.message === expectedH3).length, `aucun H-3 envoyé après l’annulation ; reçus : ${messages}`).toBe(0);
  600 |             const panel = await openBell(client);
  601 |             await expect(panel.getByText(/événement annulé/i).first()).toBeVisible();
  602 |         });
  603 | 
  604 |         await test.step('10. comptage par différence depuis l’étape 8 ; aucune ligne de E2 en SENDING', async () => {
  605 |             const received = smsSince(await fakeSmsTo(clientPhone), smsMark);
  606 |             const counts = {
  607 |                 j1: received.filter((m) => m.message === expectedJ1).length,
  608 |                 h3: received.filter((m) => m.message === expectedH3).length,
  609 |                 annulation: received.filter((m) => m.message === expectedCancel).length,
  610 |             };
  611 |             console.log(`[e2e][fumée] SMS du client depuis l’étape 8 : ${received.length} (${JSON.stringify(counts)})`);
  612 |             expect(counts, `SMS du client depuis l’étape 8 : ${JSON.stringify(received.map((m) => m.message))}`).toEqual({ j1: 1, h3: 0, annulation: 1 });
  613 |             // Lot 7 (D81) : liste exacte, par jointure provider_message_id = ticket du faux MTarget
  614 |             const identified = await identifySms('depuis le repère de l’étape 8', received, { [eventId]: 'E1', [e2Id]: 'E2' });
  615 |             expect(identified.filter((d) => d.line === null).map((d) => `${d.sms.ticket} « ${d.sms.message.slice(0, 60)} »`),
  616 |                 'chaque SMS reçu depuis le repère a sa ligne dans la boîte d’envoi (provider_message_id)').toEqual([]);
  617 |             const lines = identified.flatMap((d) => (d.line ? [d.line] : []));
  618 |             expect(lines.map((l) => `${l.type} ${l.event_id === e2Id ? 'E2' : l.event_id ?? 'sans événement'}`).sort(),
  619 |                 `SMS du client depuis le repère : ${JSON.stringify(lines.map((l) => ({ type: l.type, cle: l.idempotency_key })))}`)
> 620 |                 .toEqual(['EVENT_CANCELLED E2', 'PURCHASE_CONFIRMED E2', 'REMINDER_J1 E2']);
      |                  ^ Error: SMS du client depuis le repère : [{"type":"PURCHASE_CONFIRMED","cle":"PURCHASE_CONFIRMED:ef32c589-d9e8-43e1-99e3-c6d5ad416311:SMS"},{"type":"REMINDER_J1","cle":"REMINDER_J1:8e5c754e-c0c6-465b-84d9-8e0dd106cb73:c46d85d6-0179-47c1-8653-77e30e437b37:20261106T2000Z:SMS"},{"type":"EVENT_CANCELLED","cle":"EVENT_CANCELLED:8e5c754e-c0c6-465b-84d9-8e0dd106cb73:c46d85d6-0179-47c1-8653-77e30e437b37:SMS"},{"type":"REFUND_PAID","cle":"REFUND_PAID:cf7abefa-bfa7-4c61-bf52-b8b858b990d9:SMS"}]
  621 |             const keys = lines.map((l) => `${l.type} ${l.idempotency_key}`);
  622 |             expect(keys.filter((k, i) => keys.indexOf(k) !== i), 'aucun SMS envoyé deux fois pour la même clé (doublon = défaut)').toEqual([]);
  623 |             expect(lines.filter((l) => l.status !== 'SENT').map((l) => `${l.type} ${l.status}`), 'lignes des SMS reçus au statut SENT').toEqual([]);
  624 |             const sending = await sendingOfEvent(e2Id);
  625 |             expect(sending, `lignes de E2 encore SENDING : ${brief(sending)}`).toEqual([]);
  626 |         });
  627 | 
  628 |         // ── Lot 7 (contrat 11.4) : étapes 11 à 16 ───────────────────────────
  629 |         const e3Category = 'Entrée générale';
  630 |         let e3Tickets: string[] = [];
  631 |         let e3Numbers: string[] = [];
  632 |         let oldLot: StoredLot | null = null;
  633 |         let swClient: Page | null = null;
  634 |         let controller: Page | null = null;
  635 |         const swApiResponses: string[] = [];
  636 | 
  637 |         await test.step('11. événement E3 à ≈ 20 h (partenaire A, catégorie payante), contrôleur A affecté, fenêtre de scan à 24 h', async () => {
  638 |             e3 = prepareTerrainEvent('fumee prolongee', 'client', 0, { priceFcfa: 5000 });
  639 |             expect(e3.tickets, 'aucun billet émis par la préparation (achat par l’interface)').toEqual([]);
  640 |         });
  641 | 
  642 |         await test.step('12. achat de 2 billets de E3 par l’interface, puis Mes billets avec le service worker : disponibles hors ligne', async () => {
  643 |             if (!e3) throw new Error('événement E3 absent (étape 11 non aboutie)');
  644 |             e3Tickets = await buyThroughUi(client, e3.eventId, e3Category, 2);
  645 |             e3Numbers = await ticketNumbers(e3Tickets);
  646 |             const page = await pageAs('fumee-client', false, { serviceWorkers: 'allow' });
  647 |             swClient = page;
  648 |             page.context().on('response', (r) => {
  649 |                 try {
  650 |                     if (r.fromServiceWorker() && new URL(r.url()).pathname.startsWith('/api/')) swApiResponses.push(`${r.status()} ${r.url()}`);
  651 |                 } catch (err) {
  652 |                     swApiResponses.push(`URL illisible (${err instanceof Error ? err.message : String(err)})`);
  653 |                 }
  654 |             });
  655 |             await page.goto('/tickets');
  656 |             for (const number of e3Numbers) {
  657 |                 const card = page.locator('li, article').filter({ hasText: number }).last();
  658 |                 await expect(card, `carte du billet ${number} dans Mes billets`).toBeVisible({ timeout: 45_000 });
  659 |                 await expect(card.locator('[data-ev-offline-state]'), `billet ${number} : « Disponible hors ligne » (téléchargement automatique la veille)`)
  660 |                     .toHaveAttribute('data-ev-offline-state', 'available', { timeout: 60_000 });
  661 |             }
  662 |             const lots = await readStoredLots(page, e3Tickets[1]);
  663 |             expect(lots.length, `lot du 2e billet dans IndexedDB : ${lots.length} lot(s)`).toBe(1);
  664 |             oldLot = lots[0];
  665 |             console.log(`[e2e][fumée] lot hors ligne du billet ${e3Numbers[1]} : version ${oldLot.secret_version}, ${oldLot.count} codes de ${oldLot.step_seconds} s à partir du pas ${oldLot.first_counter}`);
  666 |         });
  667 | 
  668 |         await test.step('13. hors ligne : page du billet servie par le service worker, QR qui change au bout de ≈ 21 s réelles', async () => {
  669 |             const page = swClient;
  670 |             if (!page) throw new Error('contexte du client avec service worker absent (étape 12 non aboutie)');
  671 |             const failed: string[] = [];
  672 |             const consoleErrors: string[] = [];
  673 |             await page.context().setOffline(true);
  674 |             page.on('requestfailed', (r) => failed.push(`${r.method()} ${r.url()} : ${r.failure()?.errorText ?? 'échec'}`));
  675 |             page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  676 |             const res = await page.goto(`/billet/hors-ligne?id=${encodeURIComponent(e3Tickets[0])}`);
  677 |             expect(res?.fromServiceWorker(), '/billet/hors-ligne hors ligne : réponse servie par le service worker').toBe(true);
  678 |             const qr = page.locator('[data-ev-qr-payload]');
  679 |             await expect(qr, 'QR du billet 1 affiché hors ligne').toBeVisible({ timeout: 20_000 });
  680 |             const first = await qr.getAttribute('data-ev-qr-counter');
  681 |             expect(first, 'pas du QR affiché (data-ev-qr-counter)').toMatch(/^\d+$/);
  682 |             await expect.poll(async () => qr.getAttribute('data-ev-qr-counter'), {
  683 |                 message: 'le QR hors ligne change de pas au bout de ≈ 21 s réelles', timeout: 35_000, intervals: [1_000],
  684 |             }).not.toBe(first);
  685 |             expect(failed, 'aucune requête en échec sur la page hors ligne').toEqual([]);
  686 |             expect(consoleErrors, 'aucune erreur de console sur la page hors ligne').toEqual([]);
  687 |         });
  688 | 
  689 |         await test.step('14. contrôleur A en ligne : QR lu sur le téléphone hors ligne du client → entrée validée', async () => {
  690 |             if (!e3 || !swClient) throw new Error('étapes 11 à 13 non abouties');
  691 |             const clientPage: Page = swClient;
  692 |             controller = await pageAs('fumee-controleur', false, { scanProbe: true });
  693 |             await openScanner(controller, e3.title);
  694 |             const payload = String(await clientPage.locator('[data-ev-qr-payload]').getAttribute('data-ev-qr-payload'));
  695 |             expect(payload, 'payload affiché hors ligne : <préfixe>:<billet 1>:<6 chiffres>').toMatch(new RegExp(`:${e3Tickets[0]}:\\d{6}$`));
  696 |             await presentPayload(controller, payload, 'billet 1 présenté hors ligne');
  697 |             await expect(controller.locator('[data-scan-result="valid"]').first(), 'billet 1 hors ligne : « valid »').toBeVisible();
  698 |         });
  699 | 
  700 |         await test.step('15. transfert du billet 2 au second client, acceptation, puis ancien code présenté → refusé (qr_expired)', async () => {
  701 |             if (!e3 || !oldLot || !controller) throw new Error('étapes 11 à 14 non abouties');
  702 |             const lot: StoredLot = oldLot;
  703 |             const ctl: Page = controller;
  704 |             const recipient = verifyHolderPhone('client-bis');
  705 |             console.log(`[e2e][fumée] numéro du second client ${recipient.changed ? 'marqué vérifié' : 'déjà vérifié'} (${recipient.verifiedAt})`);
  706 |             await client.goto('/tickets');
  707 |             const card = client.locator('li, article').filter({ hasText: e3Numbers[1] }).last();
  708 |             await card.getByRole('button', { name: /^transférer$/i }).click();
  709 |             const dialog = client.getByRole('dialog', { name: /^transférer ce billet$/i });
  710 |             await expect(dialog).toBeVisible();
  711 |             await dialog.getByLabel(/^numéro de téléphone du destinataire/i).fill(FIXTURE_USERS.CLIENT_BIS.phone.replace(/^\+221/, ''));
  712 |             const sent = client.waitForResponse((r) => new URL(r.url()).pathname === `/api/tickets/${e3Tickets[1]}/transfer` && r.request().method() === 'POST');
  713 |             await dialog.getByRole('button', { name: /^envoyer le billet$/i }).click();
  714 |             const sentRes = await sent;
  715 |             expect(sentRes.status(), `transfert du billet 2 : ${(await sentRes.text()).slice(0, 300)}`).toBe(200);
  716 |             await dialog.getByRole('button', { name: /^terminer$/i }).click();
  717 | 
  718 |             const bis = await pageAs('fumee-client-bis');
  719 |             await bis.goto('/tickets?tab=recus');
  720 |             const offer = bis.locator('li, article, section').filter({ hasText: e3.title }).filter({ has: bis.getByRole('button', { name: /^accepter le billet$/i }) }).last();
```