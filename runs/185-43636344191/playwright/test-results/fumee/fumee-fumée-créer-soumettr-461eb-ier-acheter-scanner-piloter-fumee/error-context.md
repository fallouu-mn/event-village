# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fumee.spec.ts >> fumée : créer, soumettre, valider, publier, acheter, scanner, piloter
- Location: e2e/fumee.spec.ts:99:5

# Error details

```
Error: billet TCK-20261114-1B019B151B : « Disponible hors ligne » (téléchargement automatique la veille)

expect(locator).toHaveAttribute(expected) failed

Locator:  locator('li, article').filter({ hasText: 'TCK-20261114-1B019B151B' }).last().locator('[data-ev-offline-state]')
Expected: "available"
Received: "missing"
Timeout:  60000ms

Call log:
  - billet TCK-20261114-1B019B151B : « Disponible hors ligne » (téléchargement automatique la veille) locator('li, article').filter({ hasText: 'TCK-20261114-1B019B151B' }).last().locator('[data-ev-offline-state]') with timeout 60000ms
  - waiting for locator('li, article').filter({ hasText: 'TCK-20261114-1B019B151B' }).last().locator('[data-ev-offline-state]')
    123 × locator resolved to <p role="status" aria-atomic="true" data-ev-offline-state="missing" class="flex items-start gap-2 rounded-xl border px-3 py-2 text-sm font-medium leading-snug bg-warning-bg text-warning-fg border-warning-border">…</p>
        - unexpected value "missing"

```

```yaml
- status: Ouvrez ce billet avec du réseau avant d’arriver
```

# Test source

```ts
  402 |             const cancelled = partner.waitForResponse(
  403 |                 (r) => new URL(r.url()).pathname === `/api/partner/events/${e2Id}/cancel` && r.request().method() === 'POST',
  404 |                 { timeout: 60_000 });
  405 |             await dialog.getByRole('button', { name: /^confirmer l[’']annulation$/i }).click();
  406 |             const res = await cancelled;
  407 |             expect(res.status(), `annulation par le partenaire : ${(await res.text()).slice(0, 300)}`).toBe(200);
  408 |             await expect(dialog).toBeHidden();
  409 | 
  410 |             const h3 = await outboxOfEvent(e2Id, ['REMINDER_H3']);
  411 |             expect(h3.length, 'lignes REMINDER_H3 de E2').toBeGreaterThan(0);
  412 |             expect(h3.map((r) => `${r.status} ${r.reason ?? ''}`), `REMINDER_H3 annulés dans la transaction de l’annulation (email déjà écarté à l’insertion : inchangé) : ${brief(h3)}`)
  413 |                 .toEqual(h3.map((r) => (r.channel === 'EMAIL' && r.status === 'SKIPPED' && r.reason === 'EMAIL_NOT_VERIFIED' ? 'SKIPPED EMAIL_NOT_VERIFIED' : 'CANCELLED EVENT_ANNULE')));
  414 | 
  415 |             const secret = process.env.CRON_SECRET;
  416 |             if (!secret) throw new Error(`CRON_SECRET absente de ${e2eConfig().envFile} : la vraie route de l’envoyeur est protégée`);
  417 |             // Même hôte que le contrôle de run-e2e.mjs : le serveur écoute sur 127.0.0.1 (localhost peut viser ::1)
  418 |             const cron = await fetch(`http://127.0.0.1:${new URL(APP_URL).port}/api/cron/notifications-dispatch`, {
  419 |                 method: 'GET', headers: { authorization: `Bearer ${secret}` },
  420 |             });
  421 |             const cronText = await cron.text();
  422 |             console.log(`[e2e][fumée] GET /api/cron/notifications-dispatch → ${cron.status} ${cronText.slice(0, 300)}`);
  423 |             expect(cron.status, `route de l’envoyeur : ${cronText.slice(0, 300)}`).toBe(200);
  424 | 
  425 |             const cancel = (await outboxOfEvent(e2Id, ['EVENT_CANCELLED']))
  426 |                 .filter((r) => r.recipient_user_id === clientUserId || r.recipient_phone === clientPhone);
  427 |             const cancelSms = cancel.filter((r) => r.channel === 'SMS');
  428 |             expect(cancelSms.map((r) => r.status), `EVENT_CANCELLED SMS du client : ${brief(cancel)}`).toEqual(['SENT']);
  429 |             expect(cancel.filter((r) => r.channel === 'IN_APP').map((r) => r.status), `EVENT_CANCELLED dans l’application : ${brief(cancel)}`).toEqual(['SENT']);
  430 |             expectedCancel = await c.renderSms('EVENT_CANCELLED', renderData(cancelSms[0], e2Event));
  431 |             const received = smsSince(await fakeSmsTo(clientPhone), before);
  432 |             const messages = JSON.stringify(received.map((m) => m.message));
  433 |             expect(received.filter((m) => m.message === expectedCancel).length,
  434 |                 `avis d’annulation exact une seule fois (attendu « ${expectedCancel} ») ; reçus : ${messages}`).toBe(1);
  435 |             expect(received.filter((m) => m.message === expectedH3).length, `aucun H-3 envoyé après l’annulation ; reçus : ${messages}`).toBe(0);
  436 |             const panel = await openBell(client);
  437 |             await expect(panel.getByText(/événement annulé/i).first()).toBeVisible();
  438 |         });
  439 | 
  440 |         await test.step('10. comptage par différence depuis l’étape 8 ; aucune ligne de E2 en SENDING', async () => {
  441 |             const received = smsSince(await fakeSmsTo(clientPhone), smsMark);
  442 |             const counts = {
  443 |                 j1: received.filter((m) => m.message === expectedJ1).length,
  444 |                 h3: received.filter((m) => m.message === expectedH3).length,
  445 |                 annulation: received.filter((m) => m.message === expectedCancel).length,
  446 |             };
  447 |             console.log(`[e2e][fumée] SMS du client depuis l’étape 8 : ${received.length} (${JSON.stringify(counts)})`);
  448 |             expect(counts, `SMS du client depuis l’étape 8 : ${JSON.stringify(received.map((m) => m.message))}`).toEqual({ j1: 1, h3: 0, annulation: 1 });
  449 |             // Lot 7 (D81) : liste exacte, par jointure provider_message_id = ticket du faux MTarget
  450 |             const identified = await identifySms('depuis le repère de l’étape 8', received, { [eventId]: 'E1', [e2Id]: 'E2' });
  451 |             expect(identified.filter((d) => d.line === null).map((d) => `${d.sms.ticket} « ${d.sms.message.slice(0, 60)} »`),
  452 |                 'chaque SMS reçu depuis le repère a sa ligne dans la boîte d’envoi (provider_message_id)').toEqual([]);
  453 |             const lines = identified.flatMap((d) => (d.line ? [d.line] : []));
  454 |             expect(lines.map((l) => `${l.type} ${l.event_id === e2Id ? 'E2' : l.event_id ?? 'sans événement'}`).sort(),
  455 |                 `SMS du client depuis le repère : ${JSON.stringify(lines.map((l) => ({ type: l.type, cle: l.idempotency_key })))}`)
  456 |                 // REFUND_PAID E2 : remboursement automatique de l'achat E2 à l'annulation (event_cancel →
  457 |                 // refund_request EVENT_CANCELLATION_REFUND, envoyé aussitôt par CashoutService.sendBatch ; avis mis en
  458 |                 // file par le trigger des cashouts au passage à CONFIRME, clé REFUND_PAID:<cashout>). Déjà relevé au
  459 |                 // lot 6 parmi les SMS non identifiés de la fumée (contrat du lot 7, dette : PURCHASE_CONFIRMED E2,
  460 |                 // PURCHASE_CONFIRMED E1, REFUND_PAID E2) ; oublié dans la liste exacte jusqu'au run 77.
  461 |                 // Unicité contrôlée juste après (aucune clé deux fois).
  462 |                 .toEqual(['EVENT_CANCELLED E2', 'PURCHASE_CONFIRMED E2', 'REFUND_PAID E2', 'REMINDER_J1 E2']);
  463 |             const keys = lines.map((l) => `${l.type} ${l.idempotency_key}`);
  464 |             expect(keys.filter((k, i) => keys.indexOf(k) !== i), 'aucun SMS envoyé deux fois pour la même clé (doublon = défaut)').toEqual([]);
  465 |             expect(lines.filter((l) => l.status !== 'SENT').map((l) => `${l.type} ${l.status}`), 'lignes des SMS reçus au statut SENT').toEqual([]);
  466 |             const sending = await sendingOfEvent(e2Id);
  467 |             expect(sending, `lignes de E2 encore SENDING : ${brief(sending)}`).toEqual([]);
  468 |         });
  469 | 
  470 |         // ── Lot 7 (contrat 11.4) : étapes 11 à 16 ───────────────────────────
  471 |         const e3Category = 'Entrée générale';
  472 |         let e3Tickets: string[] = [];
  473 |         let e3Numbers: string[] = [];
  474 |         let oldLot: StoredLot | null = null;
  475 |         let swClient: Page | null = null;
  476 |         let controller: Page | null = null;
  477 |         const swApiResponses: string[] = [];
  478 | 
  479 |         await test.step('11. événement E3 à ≈ 20 h (partenaire A, catégorie payante), contrôleur A affecté, fenêtre de scan à 24 h', async () => {
  480 |             e3 = prepareTerrainEvent('fumee prolongee', 'client', 0, { priceFcfa: 5000 });
  481 |             expect(e3.tickets, 'aucun billet émis par la préparation (achat par l’interface)').toEqual([]);
  482 |         });
  483 | 
  484 |         await test.step('12. achat de 2 billets de E3 par l’interface, puis Mes billets avec le service worker : disponibles hors ligne', async () => {
  485 |             if (!e3) throw new Error('événement E3 absent (étape 11 non aboutie)');
  486 |             e3Tickets = await buyThroughUi(client, e3.eventId, e3Category, 2);
  487 |             e3Numbers = await ticketNumbers(e3Tickets);
  488 |             const page = await pageAs('fumee-client', false, { serviceWorkers: 'allow' });
  489 |             swClient = page;
  490 |             page.context().on('response', (r) => {
  491 |                 try {
  492 |                     if (r.fromServiceWorker() && new URL(r.url()).pathname.startsWith('/api/')) swApiResponses.push(`${r.status()} ${r.url()}`);
  493 |                 } catch (err) {
  494 |                     swApiResponses.push(`URL illisible (${err instanceof Error ? err.message : String(err)})`);
  495 |                 }
  496 |             });
  497 |             await page.goto('/tickets');
  498 |             for (const number of e3Numbers) {
  499 |                 const card = page.locator('li, article').filter({ hasText: number }).last();
  500 |                 await expect(card, `carte du billet ${number} dans Mes billets`).toBeVisible({ timeout: 45_000 });
  501 |                 await expect(card.locator('[data-ev-offline-state]'), `billet ${number} : « Disponible hors ligne » (téléchargement automatique la veille)`)
> 502 |                     .toHaveAttribute('data-ev-offline-state', 'available', { timeout: 60_000 });
      |                      ^ Error: billet TCK-20261114-1B019B151B : « Disponible hors ligne » (téléchargement automatique la veille)
  503 |             }
  504 |             const lots = await readStoredLots(page, e3Tickets[1]);
  505 |             expect(lots.length, `lot du 2e billet dans IndexedDB : ${lots.length} lot(s)`).toBe(1);
  506 |             oldLot = lots[0];
  507 |             console.log(`[e2e][fumée] lot hors ligne du billet ${e3Numbers[1]} : version ${oldLot.secret_version}, ${oldLot.count} codes de ${oldLot.step_seconds} s à partir du pas ${oldLot.first_counter}`);
  508 |         });
  509 | 
  510 |         await test.step('13. hors ligne : page du billet servie par le service worker, QR qui change au bout de ≈ 21 s réelles', async () => {
  511 |             const page = swClient;
  512 |             if (!page) throw new Error('contexte du client avec service worker absent (étape 12 non aboutie)');
  513 |             const failed: string[] = [];
  514 |             const consoleErrors: string[] = [];
  515 |             await page.context().setOffline(true);
  516 |             page.on('requestfailed', (r) => failed.push(`${r.method()} ${r.url()} : ${r.failure()?.errorText ?? 'échec'}`));
  517 |             page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  518 |             const res = await page.goto(`/billet/hors-ligne?id=${encodeURIComponent(e3Tickets[0])}`);
  519 |             expect(res?.fromServiceWorker(), '/billet/hors-ligne hors ligne : réponse servie par le service worker').toBe(true);
  520 |             const qr = page.locator('[data-ev-qr-payload]');
  521 |             await expect(qr, 'QR du billet 1 affiché hors ligne').toBeVisible({ timeout: 20_000 });
  522 |             const first = await qr.getAttribute('data-ev-qr-counter');
  523 |             expect(first, 'pas du QR affiché (data-ev-qr-counter)').toMatch(/^\d+$/);
  524 |             await expect.poll(async () => qr.getAttribute('data-ev-qr-counter'), {
  525 |                 message: 'le QR hors ligne change de pas au bout de ≈ 21 s réelles', timeout: 35_000, intervals: [1_000],
  526 |             }).not.toBe(first);
  527 |             expect(failed, 'aucune requête en échec sur la page hors ligne').toEqual([]);
  528 |             expect(consoleErrors, 'aucune erreur de console sur la page hors ligne').toEqual([]);
  529 |         });
  530 | 
  531 |         await test.step('14. contrôleur A en ligne : QR lu sur le téléphone hors ligne du client → entrée validée', async () => {
  532 |             if (!e3 || !swClient) throw new Error('étapes 11 à 13 non abouties');
  533 |             const clientPage: Page = swClient;
  534 |             controller = await pageAs('fumee-controleur', false, { scanProbe: true });
  535 |             await openScanner(controller, e3.title);
  536 |             const payload = String(await clientPage.locator('[data-ev-qr-payload]').getAttribute('data-ev-qr-payload'));
  537 |             expect(payload, 'payload affiché hors ligne : <préfixe>:<billet 1>:<6 chiffres>').toMatch(new RegExp(`:${e3Tickets[0]}:\\d{6}$`));
  538 |             await presentPayload(controller, payload, 'billet 1 présenté hors ligne');
  539 |             await expect(controller.locator('[data-scan-result="valid"]').first(), 'billet 1 hors ligne : « valid »').toBeVisible();
  540 |         });
  541 | 
  542 |         await test.step('15. transfert du billet 2 au second client, acceptation, puis ancien code présenté → refusé (qr_expired)', async () => {
  543 |             if (!e3 || !oldLot || !controller) throw new Error('étapes 11 à 14 non abouties');
  544 |             const lot: StoredLot = oldLot;
  545 |             const ctl: Page = controller;
  546 |             const recipient = verifyHolderPhone('client-bis');
  547 |             console.log(`[e2e][fumée] numéro du second client ${recipient.changed ? 'marqué vérifié' : 'déjà vérifié'} (${recipient.verifiedAt})`);
  548 |             await client.goto('/tickets');
  549 |             const card = client.locator('li, article').filter({ hasText: e3Numbers[1] }).last();
  550 |             await card.getByRole('button', { name: /^transférer$/i }).click();
  551 |             const dialog = client.getByRole('dialog', { name: /^transférer ce billet$/i });
  552 |             await expect(dialog).toBeVisible();
  553 |             await dialog.getByLabel(/^numéro de téléphone du destinataire/i).fill(FIXTURE_USERS.CLIENT_BIS.phone.replace(/^\+221/, ''));
  554 |             // Lot 9 bis (R57, B35, contrat 4.2 et 5.13) : le transfert demande un mot de passe saisi depuis moins de 10 min ;
  555 |             // les saisies du client sont effacées d'abord (la connexion de la phase « connexion » en compte une), puis la
  556 |             // boîte « mot de passe » s'ouvre sur le refus et le transfert repart après la confirmation
  557 |             await clearPasswordConfirmations(clientUserId);
  558 |             const transferPath = `/api/tickets/${e3Tickets[1]}/transfer`;
  559 |             const refused = client.waitForResponse((r) => new URL(r.url()).pathname === transferPath && r.request().method() === 'POST');
  560 |             await dialog.getByRole('button', { name: /^envoyer le billet$/i }).click();
  561 |             const refusedRes = await refused;
  562 |             const refusedBody = (await refusedRes.json().catch(() => ({}))) as { code?: string };
  563 |             expect(`${refusedRes.status()} ${String(refusedBody.code)}`, 'transfert sans mot de passe récent (R57)').toBe('403 PASSWORD_CONFIRMATION_REQUIRED');
  564 |             const confirmBox = client.getByRole('dialog', { name: /^confirmez votre mot de passe$/i });
  565 |             await expect(confirmBox, 'boîte « mot de passe » ouverte par le refus (R57)').toBeVisible();
  566 |             await confirmBox.getByLabel(/^mot de passe/i).fill(TEST_PASSWORD);
  567 |             const confirmed = client.waitForResponse((r) => new URL(r.url()).pathname === '/api/account/password-confirm' && r.request().method() === 'POST');
  568 |             const sent = client.waitForResponse((r) => new URL(r.url()).pathname === transferPath && r.request().method() === 'POST');
  569 |             await confirmBox.getByRole('button', { name: /^confirmer$/i }).click();
  570 |             const confirmedRes = await confirmed;
  571 |             expect(confirmedRes.status(), `mot de passe confirmé : ${(await confirmedRes.text()).slice(0, 300)}`).toBe(200);
  572 |             const sentRes = await sent;
  573 |             expect(sentRes.status(), `transfert du billet 2 relancé après la confirmation : ${(await sentRes.text()).slice(0, 300)}`).toBe(200);
  574 |             await dialog.getByRole('button', { name: /^terminer$/i }).click();
  575 | 
  576 |             const bis = await pageAs('fumee-client-bis');
  577 |             await bis.goto('/tickets?tab=recus');
  578 |             const offer = bis.locator('li, article, section').filter({ hasText: e3.title }).filter({ has: bis.getByRole('button', { name: /^accepter le billet$/i }) }).last();
  579 |             await offer.getByRole('button', { name: /^accepter le billet$/i }).click();
  580 |             const confirm = bis.getByRole('dialog').or(bis.getByRole('alertdialog'));
  581 |             await expect(confirm).toBeVisible();
  582 |             const claimed = bis.waitForResponse((r) => /^\/api\/tickets\/transfers\/[^/]+\/claim$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST');
  583 |             await confirm.getByRole('button', { name: /^accepter le billet$/i }).click();
  584 |             const claimRes = await claimed;
  585 |             expect(claimRes.status(), `acceptation du transfert : ${(await claimRes.text()).slice(0, 300)}`).toBe(200);
  586 | 
  587 |             const old = payloadFromLot(lot);
  588 |             console.log(`[e2e][fumée] ancien code du billet ${e3Numbers[1]} (version ${lot.secret_version}, pas ${old.counter}) présenté au contrôleur`);
  589 |             await presentPayload(ctl, old.payload, 'ancien code du billet 2 après le transfert');
  590 |             await expect(ctl.locator('[data-scan-result="qr_expired"]').first(), 'ancien code après le transfert : « qr_expired » (D3)').toBeVisible();
  591 |         });
  592 | 
  593 |         await test.step('16. caches du client : coquille hors ligne seulement, rien de /api/ ; route des codes jamais servie hors ligne', async () => {
  594 |             const page = swClient;
  595 |             if (!page) throw new Error('contexte du client avec service worker absent');
  596 |             const keys = await page.evaluate(async () => (await caches.keys()).sort());
  597 |             expect(keys, `caches du client : seul ${OFFLINE_CACHE} attendu`).toEqual([OFFLINE_CACHE]);
  598 |             const urls = await page.evaluate(async (name) => (await (await caches.open(name)).keys()).map((r) => r.url), OFFLINE_CACHE);
  599 |             const forbidden = urls.filter((u) => {
  600 |                 const url = new URL(u);
  601 |                 return url.pathname.startsWith('/api/') || url.searchParams.has('_rsc');
  602 |             });
```