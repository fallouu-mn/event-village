# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fumee.spec.ts >> fumée : créer, soumettre, valider, publier, acheter, scanner, piloter
- Location: e2e/fumee.spec.ts:290:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Entrée validée').first()
Expected: visible
Timeout: 40000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('Entrée validée').first() with timeout 40000ms
  - waiting for getByText('Entrée validée').first()

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
  - link "Aïssatou OrgaA Partenaire":
    - /url: /profile
  - button "Se déconnecter"
  - button "Basculer le thème"
- banner:
  - link "Rechercher un événement, un concert, un restaurant…":
    - /url: /explore
  - button "Notifications, 4 non lues": "4"
- main:
  - heading "Contrôle des entrées" [level=1]
  - paragraph: QR dynamique de l’application, ou numéro du billet avec pièce d’identité.
  - link "Tableau de bord":
    - /url: /partner/dashboard
    - button "Tableau de bord"
  - text: Événement contrôlé
  - combobox "Événement contrôlé":
    - option "Fumée — Concert des Parcelles 20.36.34 — 4 nov." [selected]
    - option "TEST Concert A (publié, à venir) — 4 déc."
  - group "Mode de contrôle":
    - button "Caméra" [pressed]
    - button "Saisie manuelle"
  - text: Présentez le QR
  - region "Scans de la session (0)":
    - heading "Scans de la session (0)" [level=2]
    - status: 0 validé · 0 refusé
    - paragraph: Aucun scan pendant cette session.
- alert
```

# Test source

```ts
  345 | 
  346 |             for (let i = 0; i < 6 && !(await partner.getByRole('heading', { name: /billetterie/i }).isVisible()); i++) {
  347 |                 await partner.getByRole('button', { name: /^suivant/i }).click();
  348 |             }
  349 |             await expect(partner.getByRole('heading', { name: /billetterie/i })).toBeVisible();
  350 |             await partner.getByRole('button', { name: /ajouter une catégorie/i }).click();
  351 |             await partner.getByLabel(/nom de la catégorie/i).fill(category);
  352 |             await partner.getByLabel(/^prix/i).fill('5000');
  353 |             await partner.getByLabel(/quantité|quota|nombre de places/i).fill('50');
  354 |             await partner.getByRole('button', { name: /^enregistrer/i }).click();
  355 |             await partner.waitForURL(/\/partner\/events(\?|$)/);
  356 |             await expect(partner.getByText(title, { exact: true })).toBeVisible();
  357 |         });
  358 | 
  359 |         await test.step('1 bis. le partenaire soumet l’événement', async () => {
  360 |             const card = cardOf(partner, title, /^soumettre/i);
  361 |             await actionWithConfirm(partner, card, /^soumettre/i);
  362 |             await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(title, { exact: true }) }).last())
  363 |                 .toContainText(/en attente de validation/i);
  364 |         });
  365 | 
  366 |         await test.step('2. le SUPERADMIN valide l’événement', async () => {
  367 |             const admin = await pageAs('fumee-superadmin');
  368 |             // Diagnostic (run 50 : fiche restée en « En attente » après une validation réussie) : chaque
  369 |             // réponse de la fiche et de la transition est écrite dans e2e.log.
  370 |             admin.on('response', async (res) => {
  371 |                 const url = new URL(res.url());
  372 |                 if (!/^\/api\/admin\/events\/[0-9a-f-]{36}(\/transition)?$/.test(url.pathname)) return;
  373 |                 const body = (await res.json().catch(() => null)) as { actions?: { status?: string }; to?: string; code?: string } | null;
  374 |                 console.log(`[e2e][fiche admin] ${res.request().method()} ${url.pathname} → ${res.status()} statut=${body?.actions?.status ?? body?.to ?? '—'} code=${body?.code ?? '—'}`);
  375 |             });
  376 |             admin.on('console', (msg) => { if (msg.type() === 'error') console.log(`[e2e][fiche admin][console] ${msg.text()}`); });
  377 |             await admin.goto('/admin/events?status=EN_ATTENTE');
  378 |             await admin.getByRole('link', { name: new RegExp(escapeRe(title)) }).click();
  379 |             await admin.waitForURL(/\/admin\/events\/[0-9a-f-]{36}/);
  380 |             await actionWithConfirm(admin, admin.locator('main'), /^valider/i);
  381 |             await expect(admin.getByText(/^validé$/i).first()).toBeVisible();
  382 |         });
  383 | 
  384 |         await test.step('3. le partenaire publie l’événement', async () => {
  385 |             await partner.goto('/partner/events');
  386 |             const card = cardOf(partner, title, /^publier/i);
  387 |             await actionWithConfirm(partner, card, /^publier/i);
  388 |             await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(title, { exact: true }) }).last())
  389 |                 .toContainText(/publié/i);
  390 |         });
  391 | 
  392 |         const client = await pageAs('fumee-client');
  393 |         await test.step('4. le client achète un billet (faux SamirPay, vrai webhook)', async () => {
  394 |             await client.goto('/explore');
  395 |             await client.getByRole('link', { name: new RegExp(escapeRe(title)) }).first().click();
  396 |             await client.waitForURL(/\/events\/[0-9a-f-]{36}/);
  397 |             eventId = new URL(client.url()).pathname.split('/').pop() ?? '';
  398 |             await client.getByRole('button', { name: new RegExp(`ajouter un billet ${escapeRe(category)}`, 'i') }).click();
  399 |             await client.getByRole('button', { name: /^acheter/i }).click();
  400 |             const dialog = client.getByRole('dialog').or(client.getByRole('alertdialog'));
  401 |             await expect(dialog).toBeVisible();
  402 |             await dialog.getByRole('radio', { name: /^wave/i }).check({ force: true }); // radio masqué (sr-only) dans son libellé : le libellé reçoit le clic
  403 |             await dialog.getByLabel(/numéro/i).fill(fumeePayerPhone());
  404 |             await dialog.getByRole('button', { name: /payer|confirmer|continuer/i }).last().click();
  405 |             await client.waitForURL(/\/paiement\/[0-9a-f-]{36}/);
  406 |             const succeeded = client.waitForResponse(async (r) => {
  407 |                 if (!/\/api\/payments\/[^/]+\/status/.test(r.url()) || !r.ok()) return false;
  408 |                 const body = (await r.json()) as { status?: string; ticket_ids?: unknown };
  409 |                 return body.status === 'SUCCESS' && Array.isArray(body.ticket_ids) && body.ticket_ids.length > 0;
  410 |             }, { timeout: 45_000 });
  411 |             const done = await fakeServices('/__test/samirpay/complete', { telephone: fumeePayerPhone() });
  412 |             expect(done.status, `faux SamirPay : ${JSON.stringify(done.json)}`).toBe(200);
  413 |             expect(done.json.webhookStatus, `réponse du webhook réel : ${JSON.stringify(done.json)}`).toBe(200);
  414 |             const status = (await (await succeeded).json()) as { ticket_ids: string[] };
  415 |             ticketId = status.ticket_ids[0];
  416 |             await expect(client.getByText('Paiement confirmé')).toBeVisible({ timeout: 45_000 });
  417 |         });
  418 | 
  419 |         await test.step('5. le partenaire propriétaire scanne le billet (caméra simulée)', async () => {
  420 |             await partner.goto('/partner/scan');
  421 |             const select = partner.getByLabel('Événement contrôlé');
  422 |             const value = await select.locator('option', { hasText: title }).getAttribute('value');
  423 |             expect(value, 'événement publié proposé au scan').toBeTruthy();
  424 |             await select.selectOption(value as string);
  425 |             const cameraMode = partner.getByRole('button', { name: /^caméra$/i });
  426 |             if ((await cameraMode.getAttribute('aria-pressed')) !== 'true') await cameraMode.click();
  427 | 
  428 |             expect(ticketId, 'billet émis, lu dans la réponse de statut du paiement').toMatch(/^[0-9a-f-]{36}$/);
  429 |             const liveCode = client.waitForResponse((r) => r.url().includes(`/api/tickets/${ticketId}/live-code`) && r.ok());
  430 |             await client.goto('/tickets');
  431 |             const payload = String(((await (await liveCode).json()) as { payload?: string }).payload ?? '');
  432 |             const ticketCard = client.locator('li, article, section, div')
  433 |                 .filter({ has: client.getByText(title) })
  434 |                 .filter({ has: client.getByRole('img', { name: /QR d.entrée dynamique/i }) })
  435 |                 .last();
  436 |             const qr = ticketCard.getByRole('img', { name: /QR d.entrée dynamique/i });
  437 |             await expect(qr).toBeVisible();
  438 |             const png = await qr.screenshot();
  439 |             await partner.evaluate(async ({ dataUrl, p }) => {
  440 |                 const cam = (window as unknown as { __evFakeCamera?: { show: (d: string) => Promise<void>; setPayload: (x: string) => void } }).__evFakeCamera;
  441 |                 if (!cam) throw new Error('caméra simulée absente de la page');
  442 |                 cam.setPayload(p);
  443 |                 await cam.show(dataUrl);
  444 |             }, { dataUrl: `data:image/png;base64,${png.toString('base64')}`, p: payload });
> 445 |             await expect(partner.getByText('Entrée validée').first()).toBeVisible({ timeout: 40_000 });
      |                                                                       ^ Error: expect(locator).toBeVisible() failed
  446 |         });
  447 | 
  448 |         await test.step('6. la page de pilotage montre 1 vendu et 1 entrée', async () => {
  449 |             expect(eventId, 'identifiant de l’événement lu sur la page publique').toMatch(/^[0-9a-f-]{36}$/);
  450 |             await partner.goto(`/partner/events/${eventId}`);
  451 |             const apercu = partner.getByRole('tab', { name: /^aperçu/i });
  452 |             if ((await apercu.getAttribute('aria-selected')) !== 'true') await apercu.click();
  453 |             const panel = partner.getByRole('tabpanel');
  454 |             await expect(kpi(panel, /billets vendus/i)).toContainText(/(^|\D)1(\D|$)/);
  455 |             await expect(kpi(panel, /^entrées/i)).toContainText(/(^|\D)1(\D|$)/);
  456 |         });
  457 | 
  458 |         // ── Lot 6 (contrat P3) : étapes 7 à 10 ──────────────────────────────
  459 |         const clientPhone = FIXTURE_USERS.CLIENT.phone;
  460 |         const e2Title = `Fumée — Rappels des Parcelles ${stamp}`;
  461 |         const e2Category = 'Entrée générale';
  462 |         const e2Day = dakarDayFrom(new Date(), 2);
  463 |         const e2StartAt = new Date(`${e2Day}T20:00:00.000Z`);
  464 |         const e2Event: Record<string, unknown> = {
  465 |             event_id: '', title: e2Title, start_at: e2StartAt.toISOString(), location: 'Esplanade des Parcelles Assainies', city: 'Dakar',
  466 |         };
  467 |         let e2Id = '';
  468 |         let clientUserId = '';
  469 |         let clock: SimulatedClock | null = null;
  470 |         let smsMark = new Set<string>();
  471 |         let expectedJ1 = '';
  472 |         let expectedH3 = '';
  473 |         let expectedCancel = '';
  474 | 
  475 |         await test.step('7. second événement à J+2 20:00 (RPC du partenaire A), acheté par le client dans l’interface', async () => {
  476 |             expect(eventId, 'événement de l’étape 1 (affiche réutilisée)').toMatch(/^[0-9a-f-]{36}$/);
  477 |             clientUserId = await userIdByEmail(FIXTURE_USERS.CLIENT.email);
  478 |             const partnerUserId = await userIdByEmail(FIXTURE_USERS.PARTNER_A.email);
  479 |             const superadminId = await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
  480 |             e2Id = await createPublishedEvent({
  481 |                 partnerUserId,
  482 |                 superadminId,
  483 |                 title: e2Title,
  484 |                 description: 'Second concert de fumée : rappels J-1 et H-3 par horloge simulée, puis annulation. Données fictives.',
  485 |                 startDate: e2Day, startTime: '20:00:00', endDate: e2Day, endTime: '23:00:00',
  486 |                 location: String(e2Event.location), city: String(e2Event.city), capacity: 100,
  487 |                 imageUrl: await eventImageUrl(eventId),
  488 |                 category: { name: e2Category, price: 5000, total: 50 },
  489 |             });
  490 |             e2Event.event_id = e2Id;
  491 |             const [ticket] = await buyThroughUi(client, e2Id, e2Category);
  492 |             expect(ticket, 'billet de E2, lu dans la réponse de statut du paiement').toMatch(/^[0-9a-f-]{36}$/);
  493 |         });
  494 | 
  495 |         await test.step('8. rappels J-1 puis H-3 par horloge simulée : boîte d’envoi, faux SMS, cloche', async () => {
  496 |             const { simulatedClock } = await import('./support/clock');
  497 |             const c = await simulatedClock();
  498 |             clock = c;
  499 |             const how = c.mode === 'processus' ? 'modules du dépôt importés dans le processus Playwright' : `repli scripts/e2e/clock-run.ts (${c.fallbackReason})`;
  500 |             testInfo.annotations.push({ type: 'horloge simulée', description: how });
  501 |             console.log(`[e2e][fumée] horloge simulée : ${how}`);
  502 | 
  503 |             const j1Hour = await notifSettingInt('notif.reminder_j1_hour');
  504 |             const h3Hours = await notifSettingInt('notif.reminder_h3_hours');
  505 |             const quietStart = await notifSettingInt('notif.sms_quiet_start');
  506 |             const quietEnd = await notifSettingInt('notif.sms_quiet_end');
  507 |             if (inQuietHours(j1Hour, quietStart, quietEnd)) {
  508 |                 throw new Error(`rappel J-1 à ${j1Hour} h dans la plage de silence ${quietStart} h - ${quietEnd} h : la fumée ne modifie pas les réglages (contrat P3), relevez notif.reminder_j1_hour`);
  509 |             }
  510 |             // Lot 7 (D81) : boîte d'E1 vidée AVANT le repère (et toute autre ligne SMS en attente du client, hors E2),
  511 |             // à l'heure réelle ; les SMS partis sont identifiés, ils ne se mêlent plus au décompte de l'étape 10
  512 |             const drainEvents = Array.from(new Set([eventId, ...(await pendingSmsEventsOf(clientUserId, clientPhone))])).filter((id) => id !== e2Id);
  513 |             const beforeDrain = new Set((await fakeSmsTo(clientPhone)).map((m) => m.ticket));
  514 |             const drainReport = await c.dispatch(new Date(), drainEvents);
  515 |             console.log(`[e2e][fumée] boîte vidée avant le repère (événements ${drainEvents.join(', ')}) : ${JSON.stringify(drainReport)}`);
  516 |             const drained = await identifySms('avant le repère (boîte de E1 vidée)', smsSince(await fakeSmsTo(clientPhone), beforeDrain), { [eventId]: 'E1', [e2Id]: 'E2' });
  517 |             expect(drained.filter((d) => d.line === null).map((d) => d.sms.ticket), 'SMS partis au vidage de la boîte de E1, tous identifiés').toEqual([]);
  518 |             smsMark = new Set((await fakeSmsTo(clientPhone)).map((m) => m.ticket));
  519 | 
  520 |             const veille = new Date(`${dakarDayFrom(e2StartAt, -1)}T${String(j1Hour).padStart(2, '0')}:00:30.000Z`);
  521 |             const scheduled = await c.schedule(veille, [e2Id]);
  522 |             console.log(`[e2e][fumée] planification à ${veille.toISOString()} : ${JSON.stringify(scheduled)}`);
  523 |             expect(scheduled.created.REMINDER_J1 ?? 0, `planification J-1 : ${JSON.stringify(scheduled)}`).toBeGreaterThan(0);
  524 |             const dispatched = await c.dispatch(new Date(veille.getTime() + 60_000), [e2Id]);
  525 |             console.log(`[e2e][fumée] envoyeur à ${new Date(veille.getTime() + 60_000).toISOString()} : ${JSON.stringify(dispatched)}`);
  526 | 
  527 |             const vapid = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
  528 |             const j1 = (await outboxOfEvent(e2Id, ['REMINDER_J1'])).filter((r) => r.recipient_user_id === clientUserId);
  529 |             expect(j1.map((r) => `${r.channel} ${r.status}${r.reason ? ` ${r.reason}` : ''}`).sort(), `lignes REMINDER_J1 du client : ${brief(j1)}`).toEqual([
  530 |                 'EMAIL SKIPPED EMAIL_NOT_CONFIGURED',
  531 |                 'IN_APP SENT',
  532 |                 `PUSH SKIPPED ${vapid ? 'NO_PUSH_SUBSCRIPTION' : 'PUSH_NOT_CONFIGURED'}`,
  533 |                 'SMS SENT',
  534 |             ]);
  535 |             const j1Sms = j1.find((r) => r.channel === 'SMS') as OutboxLine;
  536 |             expectedJ1 = await c.renderSms('REMINDER_J1', renderData(j1Sms, e2Event));
  537 |             const received = smsSince(await fakeSmsTo(clientPhone), smsMark);
  538 |             expect(received.filter((m) => m.message === expectedJ1).length,
  539 |                 `texte J-1 exact une seule fois au faux MTarget (attendu « ${expectedJ1} ») ; reçus : ${JSON.stringify(received.map((m) => m.message))}`).toBe(1);
  540 |             const panel = await openBell(client);
  541 |             await expect(panel.getByText(/rappel : c.est demain/i).first()).toBeVisible();
  542 | 
  543 |             const h3At = new Date(e2StartAt.getTime() - h3Hours * 3600_000 + 30_000);
  544 |             const h3Scheduled = await c.schedule(h3At, [e2Id]);
  545 |             console.log(`[e2e][fumée] planification à ${h3At.toISOString()} : ${JSON.stringify(h3Scheduled)}`);
```