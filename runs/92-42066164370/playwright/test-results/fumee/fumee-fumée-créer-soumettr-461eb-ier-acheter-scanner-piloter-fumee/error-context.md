# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fumee.spec.ts >> fumée : créer, soumettre, valider, publier, acheter, scanner, piloter
- Location: e2e/fumee.spec.ts:290:5

# Error details

```
Error: locator.check: Element is outside of the viewport
Call log:
  - waiting for getByRole('dialog').or(getByRole('alertdialog')).getByRole('radio', { name: /^wave/i })
    - locator resolved to <input required="" type="radio" value="WAVE" class="peer sr-only" name=":r0:-operator"/>
  - attempting click action
    - scrolling into view if needed
    - done scrolling

```

# Test source

```ts
  311 |             await context.addInitScript(installCameraDiagnostics);
  312 |         }
  313 |         if (opts.scanProbe) await context.addInitScript(installScanProbe);
  314 |         contexts.push(context);
  315 |         const page = await context.newPage();
  316 |         guards.push({ role, guard: new PageGuard(page) });
  317 |         return page;
  318 |     }
  319 |     let e3: TerrainEvent | null = null;
  320 | 
  321 |     try {
  322 |         const partner = await pageAs('fumee-organisateur', true);
  323 |         // Diagnostic de l'étape 5 (run 80) : messages du scanner (lectures écartées, envois, caméra)
  324 |         const scanConsole: string[] = [];
  325 |         partner.on('console', (msg) => {
  326 |             const text = msg.text();
  327 |             if (/^\[(camera|partner\/scan|scan)\]/.test(text)) scanConsole.push(`${msg.type()} ${text.slice(0, 200)}`);
  328 |         });
  329 | 
  330 |         await test.step('1. le partenaire crée l’événement (début dans 2 h)', async () => {
  331 |             await partner.goto('/partner/events/new');
  332 |             await partner.getByLabel(/^titre/i).fill(title);
  333 |             await partner.getByRole('radio', { name: /concerts/i }).or(partner.getByRole('button', { name: /^concerts/i })).first().click();
  334 |             await partner.getByLabel(/^description/i).fill('Concert de fumée : parcours complet de la création au contrôle d’entrée. Données fictives.');
  335 |             await partner.getByLabel(/date de début/i).fill(s.date);
  336 |             await partner.getByLabel(/heure de début/i).fill(s.time);
  337 |             await partner.getByLabel(/date de fin/i).fill(e.date);
  338 |             await partner.getByLabel(/heure de fin/i).fill(e.time);
  339 |             await partner.getByLabel(/^lieu/i).fill('Esplanade des Parcelles Assainies');
  340 |             await partner.getByLabel(/^ville/i).fill('Dakar');
  341 |             await partner.getByLabel(/capacité/i).fill('100');
  342 | 
  343 |             const posterPage = await partner.context().newPage();
  344 |             await posterPage.setViewportSize(POSTER_SIZE);
  345 |             await posterPage.setContent(posterHtml({
  346 |                 title: 'Concert des Parcelles', kicker: 'Fumée', dateLabel: `${s.date} · ${s.time}`, venue: 'Esplanade des Parcelles Assainies',
  347 |                 city: 'Dakar', organizer: 'Organisateur de test', palette: 'terre', motif: 'soleil',
  348 |             }));
  349 |             const poster = await posterPage.screenshot({ type: 'png' });
  350 |             await posterPage.close();
  351 |             const upload = partner.waitForResponse((r) => r.url().includes('/api/partner/upload') && r.request().method() === 'POST');
  352 |             await partner.getByLabel(/affiche/i).setInputFiles({ name: 'affiche-fumee.png', mimeType: 'image/png', buffer: poster });
  353 |             expect((await upload).ok(), 'téléversement de l’affiche').toBe(true);
  354 | 
  355 |             for (let i = 0; i < 6 && !(await partner.getByRole('heading', { name: /billetterie/i }).isVisible()); i++) {
  356 |                 await partner.getByRole('button', { name: /^suivant/i }).click();
  357 |             }
  358 |             await expect(partner.getByRole('heading', { name: /billetterie/i })).toBeVisible();
  359 |             await partner.getByRole('button', { name: /ajouter une catégorie/i }).click();
  360 |             await partner.getByLabel(/nom de la catégorie/i).fill(category);
  361 |             await partner.getByLabel(/^prix/i).fill('5000');
  362 |             await partner.getByLabel(/quantité|quota|nombre de places/i).fill('50');
  363 |             await partner.getByRole('button', { name: /^enregistrer/i }).click();
  364 |             await partner.waitForURL(/\/partner\/events(\?|$)/);
  365 |             await expect(partner.getByText(title, { exact: true })).toBeVisible();
  366 |         });
  367 | 
  368 |         await test.step('1 bis. le partenaire soumet l’événement', async () => {
  369 |             const card = cardOf(partner, title, /^soumettre/i);
  370 |             await actionWithConfirm(partner, card, /^soumettre/i);
  371 |             await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(title, { exact: true }) }).last())
  372 |                 .toContainText(/en attente de validation/i);
  373 |         });
  374 | 
  375 |         await test.step('2. le SUPERADMIN valide l’événement', async () => {
  376 |             const admin = await pageAs('fumee-superadmin');
  377 |             // Diagnostic (run 50 : fiche restée en « En attente » après une validation réussie) : chaque
  378 |             // réponse de la fiche et de la transition est écrite dans e2e.log.
  379 |             admin.on('response', async (res) => {
  380 |                 const url = new URL(res.url());
  381 |                 if (!/^\/api\/admin\/events\/[0-9a-f-]{36}(\/transition)?$/.test(url.pathname)) return;
  382 |                 const body = (await res.json().catch(() => null)) as { actions?: { status?: string }; to?: string; code?: string } | null;
  383 |                 console.log(`[e2e][fiche admin] ${res.request().method()} ${url.pathname} → ${res.status()} statut=${body?.actions?.status ?? body?.to ?? '—'} code=${body?.code ?? '—'}`);
  384 |             });
  385 |             admin.on('console', (msg) => { if (msg.type() === 'error') console.log(`[e2e][fiche admin][console] ${msg.text()}`); });
  386 |             await admin.goto('/admin/events?status=EN_ATTENTE');
  387 |             await admin.getByRole('link', { name: new RegExp(escapeRe(title)) }).click();
  388 |             await admin.waitForURL(/\/admin\/events\/[0-9a-f-]{36}/);
  389 |             await actionWithConfirm(admin, admin.locator('main'), /^valider/i);
  390 |             await expect(admin.getByText(/^validé$/i).first()).toBeVisible();
  391 |         });
  392 | 
  393 |         await test.step('3. le partenaire publie l’événement', async () => {
  394 |             await partner.goto('/partner/events');
  395 |             const card = cardOf(partner, title, /^publier/i);
  396 |             await actionWithConfirm(partner, card, /^publier/i);
  397 |             await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(title, { exact: true }) }).last())
  398 |                 .toContainText(/publié/i);
  399 |         });
  400 | 
  401 |         const client = await pageAs('fumee-client');
  402 |         await test.step('4. le client achète un billet (faux SamirPay, vrai webhook)', async () => {
  403 |             await client.goto('/explore');
  404 |             await client.getByRole('link', { name: new RegExp(escapeRe(title)) }).first().click();
  405 |             await client.waitForURL(/\/events\/[0-9a-f-]{36}/);
  406 |             eventId = new URL(client.url()).pathname.split('/').pop() ?? '';
  407 |             await client.getByRole('button', { name: new RegExp(`ajouter un billet ${escapeRe(category)}`, 'i') }).click();
  408 |             await client.getByRole('button', { name: /^acheter/i }).click();
  409 |             const dialog = client.getByRole('dialog').or(client.getByRole('alertdialog'));
  410 |             await expect(dialog).toBeVisible();
> 411 |             await dialog.getByRole('radio', { name: /^wave/i }).check({ force: true }); // radio masqué (sr-only) dans son libellé : le libellé reçoit le clic
      |                                                                 ^ Error: locator.check: Element is outside of the viewport
  412 |             await dialog.getByLabel(/numéro/i).fill(fumeePayerPhone());
  413 |             await dialog.getByRole('button', { name: /payer|confirmer|continuer/i }).last().click();
  414 |             await client.waitForURL(/\/paiement\/[0-9a-f-]{36}/);
  415 |             const succeeded = client.waitForResponse(async (r) => {
  416 |                 if (!/\/api\/payments\/[^/]+\/status/.test(r.url()) || !r.ok()) return false;
  417 |                 const body = (await r.json()) as { status?: string; ticket_ids?: unknown };
  418 |                 return body.status === 'SUCCESS' && Array.isArray(body.ticket_ids) && body.ticket_ids.length > 0;
  419 |             }, { timeout: 45_000 });
  420 |             const done = await fakeServices('/__test/samirpay/complete', { telephone: fumeePayerPhone() });
  421 |             expect(done.status, `faux SamirPay : ${JSON.stringify(done.json)}`).toBe(200);
  422 |             expect(done.json.webhookStatus, `réponse du webhook réel : ${JSON.stringify(done.json)}`).toBe(200);
  423 |             const status = (await (await succeeded).json()) as { ticket_ids: string[] };
  424 |             ticketId = status.ticket_ids[0];
  425 |             await expect(client.getByText('Paiement confirmé')).toBeVisible({ timeout: 45_000 });
  426 |         });
  427 | 
  428 |         await test.step('5. le partenaire propriétaire scanne le billet (caméra simulée)', async () => {
  429 |             await partner.goto('/partner/scan');
  430 |             const select = partner.getByLabel('Événement contrôlé');
  431 |             const value = await select.locator('option', { hasText: title }).getAttribute('value');
  432 |             expect(value, 'événement publié proposé au scan').toBeTruthy();
  433 |             await select.selectOption(value as string);
  434 |             const cameraMode = partner.getByRole('button', { name: /^caméra$/i });
  435 |             if ((await cameraMode.getAttribute('aria-pressed')) !== 'true') await cameraMode.click();
  436 | 
  437 |             expect(ticketId, 'billet émis, lu dans la réponse de statut du paiement').toMatch(/^[0-9a-f-]{36}$/);
  438 |             const liveCode = client.waitForResponse((r) => r.url().includes(`/api/tickets/${ticketId}/live-code`) && r.ok());
  439 |             await client.goto('/tickets');
  440 |             const payload = String(((await (await liveCode).json()) as { payload?: string }).payload ?? '');
  441 |             const ticketCard = client.locator('li, article, section, div')
  442 |                 .filter({ has: client.getByText(title) })
  443 |                 .filter({ has: client.getByRole('img', { name: /QR d.entrée dynamique/i }) })
  444 |                 .last();
  445 |             const qr = ticketCard.getByRole('img', { name: /QR d.entrée dynamique/i });
  446 |             await expect(qr).toBeVisible();
  447 |             const png = await qr.screenshot();
  448 |             const before = await cameraDiagSnapshot(partner);
  449 |             await partner.evaluate(async ({ dataUrl, p }) => {
  450 |                 const cam = (window as unknown as { __evFakeCamera?: { show: (d: string) => Promise<void>; setPayload: (x: string) => void } }).__evFakeCamera;
  451 |                 if (!cam) throw new Error('caméra simulée absente de la page');
  452 |                 cam.setPayload(p);
  453 |                 await cam.show(dataUrl);
  454 |             }, { dataUrl: `data:image/png;base64,${png.toString('base64')}`, p: payload });
  455 |             try {
  456 |                 await expect(partner.getByText('Entrée validée').first()).toBeVisible({ timeout: 40_000 });
  457 |             } catch (err) {
  458 |                 // Run 80 : QR présenté, aucun résultat. Le diagnostic dit si la boucle tournait (images analysées),
  459 |                 // si une lecture est partie (POST) et dans quel état était l'écran ; QR présenté et image vidéo joints.
  460 |                 await testInfo.attach('qr-presente.png', { body: png, contentType: 'image/png' });
  461 |                 const detail = await describeCameraScan(partner, before, scanConsole, testInfo)
  462 |                     .catch((e: unknown) => `diagnostic caméra impossible : ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
  463 |                 console.log(`[e2e][fumée] étape 5, payload attendu « ${payload} » ; ${detail}`);
  464 |                 throw new Error(`${err instanceof Error ? err.message : String(err)}\n${detail}`);
  465 |             }
  466 |         });
  467 | 
  468 |         await test.step('6. la page de pilotage montre 1 vendu et 1 entrée', async () => {
  469 |             expect(eventId, 'identifiant de l’événement lu sur la page publique').toMatch(/^[0-9a-f-]{36}$/);
  470 |             await partner.goto(`/partner/events/${eventId}`);
  471 |             const apercu = partner.getByRole('tab', { name: /^aperçu/i });
  472 |             if ((await apercu.getAttribute('aria-selected')) !== 'true') await apercu.click();
  473 |             const panel = partner.getByRole('tabpanel');
  474 |             await expect(kpi(panel, /billets vendus/i)).toContainText(/(^|\D)1(\D|$)/);
  475 |             await expect(kpi(panel, /^entrées/i)).toContainText(/(^|\D)1(\D|$)/);
  476 |         });
  477 | 
  478 |         // ── Lot 6 (contrat P3) : étapes 7 à 10 ──────────────────────────────
  479 |         const clientPhone = FIXTURE_USERS.CLIENT.phone;
  480 |         const e2Title = `Fumée — Rappels des Parcelles ${stamp}`;
  481 |         const e2Category = 'Entrée générale';
  482 |         const e2Day = dakarDayFrom(new Date(), 2);
  483 |         const e2StartAt = new Date(`${e2Day}T20:00:00.000Z`);
  484 |         const e2Event: Record<string, unknown> = {
  485 |             event_id: '', title: e2Title, start_at: e2StartAt.toISOString(), location: 'Esplanade des Parcelles Assainies', city: 'Dakar',
  486 |         };
  487 |         let e2Id = '';
  488 |         let clientUserId = '';
  489 |         let clock: SimulatedClock | null = null;
  490 |         let smsMark = new Set<string>();
  491 |         let expectedJ1 = '';
  492 |         let expectedH3 = '';
  493 |         let expectedCancel = '';
  494 | 
  495 |         await test.step('7. second événement à J+2 20:00 (RPC du partenaire A), acheté par le client dans l’interface', async () => {
  496 |             expect(eventId, 'événement de l’étape 1 (affiche réutilisée)').toMatch(/^[0-9a-f-]{36}$/);
  497 |             clientUserId = await userIdByEmail(FIXTURE_USERS.CLIENT.email);
  498 |             const partnerUserId = await userIdByEmail(FIXTURE_USERS.PARTNER_A.email);
  499 |             const superadminId = await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
  500 |             e2Id = await createPublishedEvent({
  501 |                 partnerUserId,
  502 |                 superadminId,
  503 |                 title: e2Title,
  504 |                 description: 'Second concert de fumée : rappels J-1 et H-3 par horloge simulée, puis annulation. Données fictives.',
  505 |                 startDate: e2Day, startTime: '20:00:00', endDate: e2Day, endTime: '23:00:00',
  506 |                 location: String(e2Event.location), city: String(e2Event.city), capacity: 100,
  507 |                 imageUrl: await eventImageUrl(eventId),
  508 |                 category: { name: e2Category, price: 5000, total: 50 },
  509 |             });
  510 |             e2Event.event_id = e2Id;
  511 |             const [ticket] = await buyThroughUi(client, e2Id, e2Category);
```