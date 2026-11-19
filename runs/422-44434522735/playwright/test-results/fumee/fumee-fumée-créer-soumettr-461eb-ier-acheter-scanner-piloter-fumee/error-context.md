# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fumee.spec.ts >> fumée : créer, soumettre, valider, publier, acheter, scanner, piloter
- Location: e2e/fumee.spec.ts:99:5

# Error details

```
Error: billet TCK-20261119-039ADDE7AE : « Disponible hors ligne » (téléchargement automatique la veille)

expect(locator).toHaveAttribute(expected) failed

Locator:  locator('li, article').filter({ hasText: 'TCK-20261119-039ADDE7AE' }).last().locator('[data-ev-offline-state]')
Expected: "available"
Received: "missing"
Timeout:  60000ms

Call log:
  - billet TCK-20261119-039ADDE7AE : « Disponible hors ligne » (téléchargement automatique la veille) locator('li, article').filter({ hasText: 'TCK-20261119-039ADDE7AE' }).last().locator('[data-ev-offline-state]') with timeout 60000ms
  - waiting for locator('li, article').filter({ hasText: 'TCK-20261119-039ADDE7AE' }).last().locator('[data-ev-offline-state]')
    123 × locator resolved to <p role="status" aria-atomic="true" data-ev-offline-state="missing" class="flex items-start gap-2 rounded-xl border px-3 py-2 text-sm font-medium leading-snug bg-warning-soft text-warning-text border-warning-border">…</p>
        - unexpected value "missing"

```

```yaml
- status: Ouvrez ce billet avec du réseau avant d’arriver
```

# Test source

```ts
  424 |             const cancelled = partner.waitForResponse(
  425 |                 (r) => new URL(r.url()).pathname === `/api/partner/events/${e2Id}/cancel` && r.request().method() === 'POST',
  426 |                 { timeout: 60_000 });
  427 |             await dialog.getByRole('button', { name: /^confirmer l[’']annulation$/i }).click();
  428 |             const res = await cancelled;
  429 |             expect(res.status(), `annulation par le partenaire : ${(await res.text()).slice(0, 300)}`).toBe(200);
  430 |             await expect(dialog).toBeHidden();
  431 | 
  432 |             const h3 = await outboxOfEvent(e2Id, ['REMINDER_H3']);
  433 |             expect(h3.length, 'lignes REMINDER_H3 de E2').toBeGreaterThan(0);
  434 |             expect(h3.map((r) => `${r.status} ${r.reason ?? ''}`), `REMINDER_H3 annulés dans la transaction de l’annulation (email déjà écarté à l’insertion : inchangé) : ${brief(h3)}`)
  435 |                 .toEqual(h3.map((r) => (r.channel === 'EMAIL' && r.status === 'SKIPPED' && r.reason === 'EMAIL_NOT_VERIFIED' ? 'SKIPPED EMAIL_NOT_VERIFIED' : 'CANCELLED EVENT_ANNULE')));
  436 | 
  437 |             const secret = process.env.CRON_SECRET;
  438 |             if (!secret) throw new Error(`CRON_SECRET absente de ${e2eConfig().envFile} : la vraie route de l’envoyeur est protégée`);
  439 |             // Même hôte que le contrôle de run-e2e.mjs : le serveur écoute sur 127.0.0.1 (localhost peut viser ::1)
  440 |             const cron = await fetch(`http://127.0.0.1:${new URL(APP_URL).port}/api/cron/notifications-dispatch`, {
  441 |                 method: 'GET', headers: { authorization: `Bearer ${secret}` },
  442 |             });
  443 |             const cronText = await cron.text();
  444 |             console.log(`[e2e][fumée] GET /api/cron/notifications-dispatch → ${cron.status} ${cronText.slice(0, 300)}`);
  445 |             expect(cron.status, `route de l’envoyeur : ${cronText.slice(0, 300)}`).toBe(200);
  446 | 
  447 |             const cancel = (await outboxOfEvent(e2Id, ['EVENT_CANCELLED']))
  448 |                 .filter((r) => r.recipient_user_id === clientUserId || r.recipient_phone === clientPhone);
  449 |             const cancelSms = cancel.filter((r) => r.channel === 'SMS');
  450 |             expect(cancelSms.map((r) => r.status), `EVENT_CANCELLED SMS du client : ${brief(cancel)}`).toEqual(['SENT']);
  451 |             expect(cancel.filter((r) => r.channel === 'IN_APP').map((r) => r.status), `EVENT_CANCELLED dans l’application : ${brief(cancel)}`).toEqual(['SENT']);
  452 |             expectedCancel = await c.renderSms('EVENT_CANCELLED', renderData(cancelSms[0], e2Event));
  453 |             const received = smsSince(await fakeSmsTo(clientPhone), before);
  454 |             const messages = JSON.stringify(received.map((m) => m.message));
  455 |             expect(received.filter((m) => m.message === expectedCancel).length,
  456 |                 `avis d’annulation exact une seule fois (attendu « ${expectedCancel} ») ; reçus : ${messages}`).toBe(1);
  457 |             expect(received.filter((m) => m.message === expectedH3).length, `aucun H-3 envoyé après l’annulation ; reçus : ${messages}`).toBe(0);
  458 |             const panel = await openBell(client);
  459 |             await expect(panel.getByText(/événement annulé/i).first()).toBeVisible();
  460 |         });
  461 | 
  462 |         await test.step('10. comptage par différence depuis l’étape 8 ; aucune ligne de E2 en SENDING', async () => {
  463 |             const received = smsSince(await fakeSmsTo(clientPhone), smsMark);
  464 |             const counts = {
  465 |                 j1: received.filter((m) => m.message === expectedJ1).length,
  466 |                 h3: received.filter((m) => m.message === expectedH3).length,
  467 |                 annulation: received.filter((m) => m.message === expectedCancel).length,
  468 |             };
  469 |             console.log(`[e2e][fumée] SMS du client depuis l’étape 8 : ${received.length} (${JSON.stringify(counts)})`);
  470 |             expect(counts, `SMS du client depuis l’étape 8 : ${JSON.stringify(received.map((m) => m.message))}`).toEqual({ j1: 1, h3: 0, annulation: 1 });
  471 |             // Lot 7 (D81) : liste exacte, par jointure provider_message_id = ticket du faux MTarget
  472 |             const identified = await identifySms('depuis le repère de l’étape 8', received, { [eventId]: 'E1', [e2Id]: 'E2' });
  473 |             expect(identified.filter((d) => d.line === null).map((d) => `${d.sms.ticket} « ${d.sms.message.slice(0, 60)} »`),
  474 |                 'chaque SMS reçu depuis le repère a sa ligne dans la boîte d’envoi (provider_message_id)').toEqual([]);
  475 |             const lines = identified.flatMap((d) => (d.line ? [d.line] : []));
  476 |             expect(lines.map((l) => `${l.type} ${l.event_id === e2Id ? 'E2' : l.event_id ?? 'sans événement'}`).sort(),
  477 |                 `SMS du client depuis le repère : ${JSON.stringify(lines.map((l) => ({ type: l.type, cle: l.idempotency_key })))}`)
  478 |                 // REFUND_PAID E2 : remboursement automatique de l'achat E2 à l'annulation (event_cancel →
  479 |                 // refund_request EVENT_CANCELLATION_REFUND, envoyé aussitôt par CashoutService.sendBatch ; avis mis en
  480 |                 // file par le trigger des cashouts au passage à CONFIRME, clé REFUND_PAID:<cashout>). Déjà relevé au
  481 |                 // lot 6 parmi les SMS non identifiés de la fumée (contrat du lot 7, dette : PURCHASE_CONFIRMED E2,
  482 |                 // PURCHASE_CONFIRMED E1, REFUND_PAID E2) ; oublié dans la liste exacte jusqu'au run 77.
  483 |                 // Unicité contrôlée juste après (aucune clé deux fois).
  484 |                 .toEqual(['EVENT_CANCELLED E2', 'PURCHASE_CONFIRMED E2', 'REFUND_PAID E2', 'REMINDER_J1 E2']);
  485 |             const keys = lines.map((l) => `${l.type} ${l.idempotency_key}`);
  486 |             expect(keys.filter((k, i) => keys.indexOf(k) !== i), 'aucun SMS envoyé deux fois pour la même clé (doublon = défaut)').toEqual([]);
  487 |             expect(lines.filter((l) => l.status !== 'SENT').map((l) => `${l.type} ${l.status}`), 'lignes des SMS reçus au statut SENT').toEqual([]);
  488 |             const sending = await sendingOfEvent(e2Id);
  489 |             expect(sending, `lignes de E2 encore SENDING : ${brief(sending)}`).toEqual([]);
  490 |         });
  491 | 
  492 |         // ── Lot 7 (contrat 11.4) : étapes 11 à 16 ───────────────────────────
  493 |         const e3Category = 'Entrée générale';
  494 |         let e3Tickets: string[] = [];
  495 |         let e3Numbers: string[] = [];
  496 |         let oldLot: StoredLot | null = null;
  497 |         let swClient: Page | null = null;
  498 |         let controller: Page | null = null;
  499 |         const swApiResponses: string[] = [];
  500 | 
  501 |         await test.step('11. événement E3 à ≈ 20 h (partenaire A, catégorie payante), contrôleur A affecté, fenêtre de scan à 24 h', async () => {
  502 |             e3 = prepareTerrainEvent('fumee prolongee', 'client', 0, { priceFcfa: 5000 });
  503 |             expect(e3.tickets, 'aucun billet émis par la préparation (achat par l’interface)').toEqual([]);
  504 |         });
  505 | 
  506 |         await test.step('12. achat de 2 billets de E3 par l’interface, puis Mes billets avec le service worker : disponibles hors ligne', async () => {
  507 |             if (!e3) throw new Error('événement E3 absent (étape 11 non aboutie)');
  508 |             e3Tickets = await buyThroughUi(client, e3.eventId, e3Category, 2);
  509 |             e3Numbers = await ticketNumbers(e3Tickets);
  510 |             const page = await pageAs('fumee-client', false, { serviceWorkers: 'allow' });
  511 |             swClient = page;
  512 |             page.context().on('response', (r) => {
  513 |                 try {
  514 |                     if (r.fromServiceWorker() && new URL(r.url()).pathname.startsWith('/api/')) swApiResponses.push(`${r.status()} ${r.url()}`);
  515 |                 } catch (err) {
  516 |                     swApiResponses.push(`URL illisible (${err instanceof Error ? err.message : String(err)})`);
  517 |                 }
  518 |             });
  519 |             await page.goto('/tickets');
  520 |             for (const number of e3Numbers) {
  521 |                 const card = page.locator('li, article').filter({ hasText: number }).last();
  522 |                 await expect(card, `carte du billet ${number} dans Mes billets`).toBeVisible({ timeout: 45_000 });
  523 |                 await expect(card.locator('[data-ev-offline-state]'), `billet ${number} : « Disponible hors ligne » (téléchargement automatique la veille)`)
> 524 |                     .toHaveAttribute('data-ev-offline-state', 'available', { timeout: 60_000 });
      |                      ^ Error: billet TCK-20261119-039ADDE7AE : « Disponible hors ligne » (téléchargement automatique la veille)
  525 |             }
  526 |             const lots = await readStoredLots(page, e3Tickets[1]);
  527 |             expect(lots.length, `lot du 2e billet dans IndexedDB : ${lots.length} lot(s)`).toBe(1);
  528 |             oldLot = lots[0];
  529 |             console.log(`[e2e][fumée] lot hors ligne du billet ${e3Numbers[1]} : version ${oldLot.secret_version}, ${oldLot.count} codes de ${oldLot.step_seconds} s à partir du pas ${oldLot.first_counter}`);
  530 |         });
  531 | 
  532 |         await test.step('13. hors ligne : page du billet servie par le service worker, QR qui change au bout de ≈ 21 s réelles', async () => {
  533 |             const page = swClient;
  534 |             if (!page) throw new Error('contexte du client avec service worker absent (étape 12 non aboutie)');
  535 |             const failed: string[] = [];
  536 |             const consoleErrors: string[] = [];
  537 |             await page.context().setOffline(true);
  538 |             page.on('requestfailed', (r) => failed.push(`${r.method()} ${r.url()} : ${r.failure()?.errorText ?? 'échec'}`));
  539 |             page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  540 |             const res = await page.goto(`/billet/hors-ligne?id=${encodeURIComponent(e3Tickets[0])}`);
  541 |             expect(res?.fromServiceWorker(), '/billet/hors-ligne hors ligne : réponse servie par le service worker').toBe(true);
  542 |             const qr = page.locator('[data-ev-qr-payload]');
  543 |             await expect(qr, 'QR du billet 1 affiché hors ligne').toBeVisible({ timeout: 20_000 });
  544 |             const first = await qr.getAttribute('data-ev-qr-counter');
  545 |             expect(first, 'pas du QR affiché (data-ev-qr-counter)').toMatch(/^\d+$/);
  546 |             await expect.poll(async () => qr.getAttribute('data-ev-qr-counter'), {
  547 |                 message: 'le QR hors ligne change de pas au bout de ≈ 21 s réelles', timeout: 35_000, intervals: [1_000],
  548 |             }).not.toBe(first);
  549 |             expect(failed, 'aucune requête en échec sur la page hors ligne').toEqual([]);
  550 |             expect(consoleErrors, 'aucune erreur de console sur la page hors ligne').toEqual([]);
  551 |         });
  552 | 
  553 |         await test.step('14. contrôleur A en ligne : QR lu sur le téléphone hors ligne du client → entrée validée', async () => {
  554 |             if (!e3 || !swClient) throw new Error('étapes 11 à 13 non abouties');
  555 |             const clientPage: Page = swClient;
  556 |             controller = await pageAs('fumee-controleur', false, { scanProbe: true });
  557 |             await openScanner(controller, e3.title);
  558 |             const payload = String(await clientPage.locator('[data-ev-qr-payload]').getAttribute('data-ev-qr-payload'));
  559 |             expect(payload, 'payload affiché hors ligne : <préfixe>:<billet 1>:<6 chiffres>').toMatch(new RegExp(`:${e3Tickets[0]}:\\d{6}$`));
  560 |             await presentPayload(controller, payload, 'billet 1 présenté hors ligne');
  561 |             await expect(controller.locator('[data-scan-result="valid"]').first(), 'billet 1 hors ligne : « valid »').toBeVisible();
  562 |         });
  563 | 
  564 |         await test.step('15. transfert du billet 2 au second client, acceptation, puis ancien code présenté → refusé (qr_expired)', async () => {
  565 |             if (!e3 || !oldLot || !controller) throw new Error('étapes 11 à 14 non abouties');
  566 |             const lot: StoredLot = oldLot;
  567 |             const ctl: Page = controller;
  568 |             const recipient = verifyHolderPhone('client-bis');
  569 |             console.log(`[e2e][fumée] numéro du second client ${recipient.changed ? 'marqué vérifié' : 'déjà vérifié'} (${recipient.verifiedAt})`);
  570 |             await client.goto('/tickets');
  571 |             const card = client.locator('li, article').filter({ hasText: e3Numbers[1] }).last();
  572 |             await card.getByRole('button', { name: /^transférer$/i }).click();
  573 |             const dialog = client.getByRole('dialog', { name: /^transférer ce billet$/i });
  574 |             await expect(dialog).toBeVisible();
  575 |             await dialog.getByLabel(/^numéro de téléphone du destinataire/i).fill(FIXTURE_USERS.CLIENT_BIS.phone.replace(/^\+221/, ''));
  576 |             // Lot 9 bis (R57, B35, contrat 4.2 et 5.13) : le transfert demande un mot de passe saisi depuis moins de 10 min ;
  577 |             // les saisies du client sont effacées d'abord (la connexion de la phase « connexion » en compte une), puis la
  578 |             // boîte « mot de passe » s'ouvre sur le refus et le transfert repart après la confirmation
  579 |             await clearPasswordConfirmations(clientUserId);
  580 |             const transferPath = `/api/tickets/${e3Tickets[1]}/transfer`;
  581 |             const refused = client.waitForResponse((r) => new URL(r.url()).pathname === transferPath && r.request().method() === 'POST');
  582 |             await dialog.getByRole('button', { name: /^envoyer le billet$/i }).click();
  583 |             const refusedRes = await refused;
  584 |             const refusedBody = (await refusedRes.json().catch(() => ({}))) as { code?: string };
  585 |             expect(`${refusedRes.status()} ${String(refusedBody.code)}`, 'transfert sans mot de passe récent (R57)').toBe('403 PASSWORD_CONFIRMATION_REQUIRED');
  586 |             const confirmBox = client.getByRole('dialog', { name: /^confirmez votre mot de passe$/i });
  587 |             await expect(confirmBox, 'boîte « mot de passe » ouverte par le refus (R57)').toBeVisible();
  588 |             await confirmBox.getByLabel(/^mot de passe/i).fill(TEST_PASSWORD);
  589 |             const confirmed = client.waitForResponse((r) => new URL(r.url()).pathname === '/api/account/password-confirm' && r.request().method() === 'POST');
  590 |             const sent = client.waitForResponse((r) => new URL(r.url()).pathname === transferPath && r.request().method() === 'POST');
  591 |             await confirmBox.getByRole('button', { name: /^confirmer$/i }).click();
  592 |             const confirmedRes = await confirmed;
  593 |             expect(confirmedRes.status(), `mot de passe confirmé : ${(await confirmedRes.text()).slice(0, 300)}`).toBe(200);
  594 |             const sentRes = await sent;
  595 |             expect(sentRes.status(), `transfert du billet 2 relancé après la confirmation : ${(await sentRes.text()).slice(0, 300)}`).toBe(200);
  596 |             await dialog.getByRole('button', { name: /^terminer$/i }).click();
  597 | 
  598 |             const bis = await pageAs('fumee-client-bis');
  599 |             await bis.goto('/tickets?tab=recus');
  600 |             const offer = bis.locator('li, article, section').filter({ hasText: e3.title }).filter({ has: bis.getByRole('button', { name: /^accepter le billet$/i }) }).last();
  601 |             await offer.getByRole('button', { name: /^accepter le billet$/i }).click();
  602 |             const confirm = bis.getByRole('dialog').or(bis.getByRole('alertdialog'));
  603 |             await expect(confirm).toBeVisible();
  604 |             const claimed = bis.waitForResponse((r) => /^\/api\/tickets\/transfers\/[^/]+\/claim$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST');
  605 |             await confirm.getByRole('button', { name: /^accepter le billet$/i }).click();
  606 |             const claimRes = await claimed;
  607 |             expect(claimRes.status(), `acceptation du transfert : ${(await claimRes.text()).slice(0, 300)}`).toBe(200);
  608 | 
  609 |             const old = payloadFromLot(lot);
  610 |             console.log(`[e2e][fumée] ancien code du billet ${e3Numbers[1]} (version ${lot.secret_version}, pas ${old.counter}) présenté au contrôleur`);
  611 |             await presentPayload(ctl, old.payload, 'ancien code du billet 2 après le transfert');
  612 |             await expect(ctl.locator('[data-scan-result="qr_expired"]').first(), 'ancien code après le transfert : « qr_expired » (D3)').toBeVisible();
  613 |         });
  614 | 
  615 |         await test.step('16. caches du client : coquille hors ligne seulement, rien de /api/ ; route des codes jamais servie hors ligne', async () => {
  616 |             const page = swClient;
  617 |             if (!page) throw new Error('contexte du client avec service worker absent');
  618 |             const keys = await page.evaluate(async () => (await caches.keys()).sort());
  619 |             expect(keys, `caches du client : seul ${OFFLINE_CACHE} attendu`).toEqual([OFFLINE_CACHE]);
  620 |             const urls = await page.evaluate(async (name) => (await (await caches.open(name)).keys()).map((r) => r.url), OFFLINE_CACHE);
  621 |             const forbidden = urls.filter((u) => {
  622 |                 const url = new URL(u);
  623 |                 return url.pathname.startsWith('/api/') || url.searchParams.has('_rsc');
  624 |             });
```