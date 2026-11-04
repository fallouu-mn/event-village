# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fumee.spec.ts >> fumée : créer, soumettre, valider, publier, acheter, scanner, piloter
- Location: e2e/fumee.spec.ts:196:5

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
    - link "Produits et menu":
      - /url: /partner/products
      - img
      - text: Produits et menu
    - link "Salles de fête":
      - /url: /partner/halls
      - img
      - text: Salles de fête
    - link "Tables":
      - /url: /partner/tables
      - img
      - text: Tables
    - link "Commandes":
      - /url: /partner/orders
      - img
      - text: Commandes
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
  - button "Notifications"
- main:
  - heading "Contrôle des entrées" [level=1]
  - paragraph: QR dynamique de l’application, ou numéro du billet avec pièce d’identité.
  - link "Tableau de bord":
    - /url: /partner/dashboard
    - button "Tableau de bord"
  - text: Événement contrôlé
  - combobox "Événement contrôlé":
    - option "Fumée — Concert des Parcelles 09.37.47 — 4 nov." [selected]
    - option "TEST Concert A (publié, à venir) — 4 déc."
  - group "Mode de contrôle":
    - button "Caméra" [pressed]
    - button "Saisie manuelle"
  - alert:
    - paragraph: Requête refusée par le serveur
    - paragraph: Clé d’idempotence manquante ou invalide.
    - paragraph: "Incident technique : le billet n’est pas en cause. Ne refusez pas le spectateur pour ce motif, réessayez."
  - status: Billet lu
  - text: Scanner actif
  - button "Scanner le billet suivant"
  - region "Scans de la session (10)":
    - heading "Scans de la session (10)" [level=2]
    - status: 0 validé · 0 refusé
    - list:
      - listitem:
        - text: Requête refusée par le serveur
        - time: 09:38:33
      - listitem:
        - text: Requête refusée par le serveur
        - time: 09:38:31
      - listitem:
        - text: Requête refusée par le serveur
        - time: 09:38:28
      - listitem:
        - text: Requête refusée par le serveur
        - time: 09:38:26
      - listitem:
        - text: Requête refusée par le serveur
        - time: 09:38:23
      - listitem:
        - text: Requête refusée par le serveur
        - time: 09:38:21
      - listitem:
        - text: Requête refusée par le serveur
        - time: 09:38:18
      - listitem:
        - text: Requête refusée par le serveur
        - time: 09:38:16
      - listitem:
        - text: Requête refusée par le serveur
        - time: 09:38:13
      - listitem:
        - text: Requête refusée par le serveur
        - time: 09:38:10
- alert
```

# Test source

```ts
  247 | 
  248 |             for (let i = 0; i < 6 && !(await partner.getByRole('heading', { name: /billetterie/i }).isVisible()); i++) {
  249 |                 await partner.getByRole('button', { name: /^suivant/i }).click();
  250 |             }
  251 |             await expect(partner.getByRole('heading', { name: /billetterie/i })).toBeVisible();
  252 |             await partner.getByRole('button', { name: /ajouter une catégorie/i }).click();
  253 |             await partner.getByLabel(/nom de la catégorie/i).fill(category);
  254 |             await partner.getByLabel(/^prix/i).fill('5000');
  255 |             await partner.getByLabel(/quantité|quota|nombre de places/i).fill('50');
  256 |             await partner.getByRole('button', { name: /^enregistrer/i }).click();
  257 |             await partner.waitForURL(/\/partner\/events(\?|$)/);
  258 |             await expect(partner.getByText(title, { exact: true })).toBeVisible();
  259 |         });
  260 | 
  261 |         await test.step('1 bis. le partenaire soumet l’événement', async () => {
  262 |             const card = cardOf(partner, title, /^soumettre/i);
  263 |             await actionWithConfirm(partner, card, /^soumettre/i);
  264 |             await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(title, { exact: true }) }).last())
  265 |                 .toContainText(/en attente de validation/i);
  266 |         });
  267 | 
  268 |         await test.step('2. le SUPERADMIN valide l’événement', async () => {
  269 |             const admin = await pageAs('fumee-superadmin');
  270 |             // Diagnostic (run 50 : fiche restée en « En attente » après une validation réussie) : chaque
  271 |             // réponse de la fiche et de la transition est écrite dans e2e.log.
  272 |             admin.on('response', async (res) => {
  273 |                 const url = new URL(res.url());
  274 |                 if (!/^\/api\/admin\/events\/[0-9a-f-]{36}(\/transition)?$/.test(url.pathname)) return;
  275 |                 const body = (await res.json().catch(() => null)) as { actions?: { status?: string }; to?: string; code?: string } | null;
  276 |                 console.log(`[e2e][fiche admin] ${res.request().method()} ${url.pathname} → ${res.status()} statut=${body?.actions?.status ?? body?.to ?? '—'} code=${body?.code ?? '—'}`);
  277 |             });
  278 |             admin.on('console', (msg) => { if (msg.type() === 'error') console.log(`[e2e][fiche admin][console] ${msg.text()}`); });
  279 |             await admin.goto('/admin/events?status=EN_ATTENTE');
  280 |             await admin.getByRole('link', { name: new RegExp(escapeRe(title)) }).click();
  281 |             await admin.waitForURL(/\/admin\/events\/[0-9a-f-]{36}/);
  282 |             await actionWithConfirm(admin, admin.locator('main'), /^valider/i);
  283 |             await expect(admin.getByText(/^validé$/i).first()).toBeVisible();
  284 |         });
  285 | 
  286 |         await test.step('3. le partenaire publie l’événement', async () => {
  287 |             await partner.goto('/partner/events');
  288 |             const card = cardOf(partner, title, /^publier/i);
  289 |             await actionWithConfirm(partner, card, /^publier/i);
  290 |             await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(title, { exact: true }) }).last())
  291 |                 .toContainText(/publié/i);
  292 |         });
  293 | 
  294 |         const client = await pageAs('fumee-client');
  295 |         await test.step('4. le client achète un billet (faux SamirPay, vrai webhook)', async () => {
  296 |             await client.goto('/explore');
  297 |             await client.getByRole('link', { name: new RegExp(escapeRe(title)) }).first().click();
  298 |             await client.waitForURL(/\/events\/[0-9a-f-]{36}/);
  299 |             eventId = new URL(client.url()).pathname.split('/').pop() ?? '';
  300 |             await client.getByRole('button', { name: new RegExp(`ajouter un billet ${escapeRe(category)}`, 'i') }).click();
  301 |             await client.getByRole('button', { name: /^acheter/i }).click();
  302 |             const dialog = client.getByRole('dialog').or(client.getByRole('alertdialog'));
  303 |             await expect(dialog).toBeVisible();
  304 |             await dialog.getByRole('radio', { name: /^wave/i }).check({ force: true }); // radio masqué (sr-only) dans son libellé : le libellé reçoit le clic
  305 |             await dialog.getByLabel(/numéro/i).fill(fumeePayerPhone());
  306 |             await dialog.getByRole('button', { name: /payer|confirmer|continuer/i }).last().click();
  307 |             await client.waitForURL(/\/paiement\/[0-9a-f-]{36}/);
  308 |             const succeeded = client.waitForResponse(async (r) => {
  309 |                 if (!/\/api\/payments\/[^/]+\/status/.test(r.url()) || !r.ok()) return false;
  310 |                 const body = (await r.json()) as { status?: string; ticket_ids?: unknown };
  311 |                 return body.status === 'SUCCESS' && Array.isArray(body.ticket_ids) && body.ticket_ids.length > 0;
  312 |             }, { timeout: 45_000 });
  313 |             const done = await fakeServices('/__test/samirpay/complete', { telephone: fumeePayerPhone() });
  314 |             expect(done.status, `faux SamirPay : ${JSON.stringify(done.json)}`).toBe(200);
  315 |             expect(done.json.webhookStatus, `réponse du webhook réel : ${JSON.stringify(done.json)}`).toBe(200);
  316 |             const status = (await (await succeeded).json()) as { ticket_ids: string[] };
  317 |             ticketId = status.ticket_ids[0];
  318 |             await expect(client.getByText('Paiement confirmé')).toBeVisible({ timeout: 45_000 });
  319 |         });
  320 | 
  321 |         await test.step('5. le partenaire propriétaire scanne le billet (caméra simulée)', async () => {
  322 |             await partner.goto('/partner/scan');
  323 |             const select = partner.getByLabel('Événement contrôlé');
  324 |             const value = await select.locator('option', { hasText: title }).getAttribute('value');
  325 |             expect(value, 'événement publié proposé au scan').toBeTruthy();
  326 |             await select.selectOption(value as string);
  327 |             const cameraMode = partner.getByRole('button', { name: /^caméra$/i });
  328 |             if ((await cameraMode.getAttribute('aria-pressed')) !== 'true') await cameraMode.click();
  329 | 
  330 |             expect(ticketId, 'billet émis, lu dans la réponse de statut du paiement').toMatch(/^[0-9a-f-]{36}$/);
  331 |             const liveCode = client.waitForResponse((r) => r.url().includes(`/api/tickets/${ticketId}/live-code`) && r.ok());
  332 |             await client.goto('/tickets');
  333 |             const payload = String(((await (await liveCode).json()) as { payload?: string }).payload ?? '');
  334 |             const ticketCard = client.locator('li, article, section, div')
  335 |                 .filter({ has: client.getByText(title) })
  336 |                 .filter({ has: client.getByRole('img', { name: /QR d.entrée dynamique/i }) })
  337 |                 .last();
  338 |             const qr = ticketCard.getByRole('img', { name: /QR d.entrée dynamique/i });
  339 |             await expect(qr).toBeVisible();
  340 |             const png = await qr.screenshot();
  341 |             await partner.evaluate(async ({ dataUrl, p }) => {
  342 |                 const cam = (window as unknown as { __evFakeCamera?: { show: (d: string) => Promise<void>; setPayload: (x: string) => void } }).__evFakeCamera;
  343 |                 if (!cam) throw new Error('caméra simulée absente de la page');
  344 |                 cam.setPayload(p);
  345 |                 await cam.show(dataUrl);
  346 |             }, { dataUrl: `data:image/png;base64,${png.toString('base64')}`, p: payload });
> 347 |             await expect(partner.getByText('Entrée validée').first()).toBeVisible({ timeout: 40_000 });
      |                                                                       ^ Error: expect(locator).toBeVisible() failed
  348 |         });
  349 | 
  350 |         await test.step('6. la page de pilotage montre 1 vendu et 1 entrée', async () => {
  351 |             expect(eventId, 'identifiant de l’événement lu sur la page publique').toMatch(/^[0-9a-f-]{36}$/);
  352 |             await partner.goto(`/partner/events/${eventId}`);
  353 |             const apercu = partner.getByRole('tab', { name: /^aperçu/i });
  354 |             if ((await apercu.getAttribute('aria-selected')) !== 'true') await apercu.click();
  355 |             const panel = partner.getByRole('tabpanel');
  356 |             await expect(kpi(panel, /billets vendus/i)).toContainText(/(^|\D)1(\D|$)/);
  357 |             await expect(kpi(panel, /^entrées/i)).toContainText(/(^|\D)1(\D|$)/);
  358 |         });
  359 | 
  360 |         // ── Lot 6 (contrat P3) : étapes 7 à 10 ──────────────────────────────
  361 |         const clientPhone = FIXTURE_USERS.CLIENT.phone;
  362 |         const e2Title = `Fumée — Rappels des Parcelles ${stamp}`;
  363 |         const e2Category = 'Entrée générale';
  364 |         const e2Day = dakarDayFrom(new Date(), 2);
  365 |         const e2StartAt = new Date(`${e2Day}T20:00:00.000Z`);
  366 |         const e2Event: Record<string, unknown> = {
  367 |             event_id: '', title: e2Title, start_at: e2StartAt.toISOString(), location: 'Esplanade des Parcelles Assainies', city: 'Dakar',
  368 |         };
  369 |         let e2Id = '';
  370 |         let clientUserId = '';
  371 |         let clock: SimulatedClock | null = null;
  372 |         let smsMark = new Set<string>();
  373 |         let expectedJ1 = '';
  374 |         let expectedH3 = '';
  375 |         let expectedCancel = '';
  376 | 
  377 |         await test.step('7. second événement à J+2 20:00 (RPC du partenaire A), acheté par le client dans l’interface', async () => {
  378 |             expect(eventId, 'événement de l’étape 1 (affiche réutilisée)').toMatch(/^[0-9a-f-]{36}$/);
  379 |             clientUserId = await userIdByEmail(FIXTURE_USERS.CLIENT.email);
  380 |             const partnerUserId = await userIdByEmail(FIXTURE_USERS.PARTNER_A.email);
  381 |             const superadminId = await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
  382 |             e2Id = await createPublishedEvent({
  383 |                 partnerUserId,
  384 |                 superadminId,
  385 |                 title: e2Title,
  386 |                 description: 'Second concert de fumée : rappels J-1 et H-3 par horloge simulée, puis annulation. Données fictives.',
  387 |                 startDate: e2Day, startTime: '20:00:00', endDate: e2Day, endTime: '23:00:00',
  388 |                 location: String(e2Event.location), city: String(e2Event.city), capacity: 100,
  389 |                 imageUrl: await eventImageUrl(eventId),
  390 |                 category: { name: e2Category, price: 5000, total: 50 },
  391 |             });
  392 |             e2Event.event_id = e2Id;
  393 |             const ticket = await buyThroughUi(client, e2Id, e2Category);
  394 |             expect(ticket, 'billet de E2, lu dans la réponse de statut du paiement').toMatch(/^[0-9a-f-]{36}$/);
  395 |         });
  396 | 
  397 |         await test.step('8. rappels J-1 puis H-3 par horloge simulée : boîte d’envoi, faux SMS, cloche', async () => {
  398 |             const { simulatedClock } = await import('./support/clock');
  399 |             const c = await simulatedClock();
  400 |             clock = c;
  401 |             const how = c.mode === 'processus' ? 'modules du dépôt importés dans le processus Playwright' : `repli scripts/e2e/clock-run.ts (${c.fallbackReason})`;
  402 |             testInfo.annotations.push({ type: 'horloge simulée', description: how });
  403 |             console.log(`[e2e][fumée] horloge simulée : ${how}`);
  404 | 
  405 |             const j1Hour = await notifSettingInt('notif.reminder_j1_hour');
  406 |             const h3Hours = await notifSettingInt('notif.reminder_h3_hours');
  407 |             const quietStart = await notifSettingInt('notif.sms_quiet_start');
  408 |             const quietEnd = await notifSettingInt('notif.sms_quiet_end');
  409 |             if (inQuietHours(j1Hour, quietStart, quietEnd)) {
  410 |                 throw new Error(`rappel J-1 à ${j1Hour} h dans la plage de silence ${quietStart} h - ${quietEnd} h : la fumée ne modifie pas les réglages (contrat P3), relevez notif.reminder_j1_hour`);
  411 |             }
  412 |             smsMark = new Set((await fakeSmsTo(clientPhone)).map((m) => m.ticket));
  413 | 
  414 |             const veille = new Date(`${dakarDayFrom(e2StartAt, -1)}T${String(j1Hour).padStart(2, '0')}:00:30.000Z`);
  415 |             const scheduled = await c.schedule(veille, [e2Id]);
  416 |             console.log(`[e2e][fumée] planification à ${veille.toISOString()} : ${JSON.stringify(scheduled)}`);
  417 |             expect(scheduled.created.REMINDER_J1 ?? 0, `planification J-1 : ${JSON.stringify(scheduled)}`).toBeGreaterThan(0);
  418 |             const dispatched = await c.dispatch(new Date(veille.getTime() + 60_000), [e2Id]);
  419 |             console.log(`[e2e][fumée] envoyeur à ${new Date(veille.getTime() + 60_000).toISOString()} : ${JSON.stringify(dispatched)}`);
  420 | 
  421 |             const vapid = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
  422 |             const j1 = (await outboxOfEvent(e2Id, ['REMINDER_J1'])).filter((r) => r.recipient_user_id === clientUserId);
  423 |             expect(j1.map((r) => `${r.channel} ${r.status}${r.reason ? ` ${r.reason}` : ''}`).sort(), `lignes REMINDER_J1 du client : ${brief(j1)}`).toEqual([
  424 |                 'EMAIL SKIPPED EMAIL_NOT_CONFIGURED',
  425 |                 'IN_APP SENT',
  426 |                 `PUSH SKIPPED ${vapid ? 'NO_PUSH_SUBSCRIPTION' : 'PUSH_NOT_CONFIGURED'}`,
  427 |                 'SMS SENT',
  428 |             ]);
  429 |             const j1Sms = j1.find((r) => r.channel === 'SMS') as OutboxLine;
  430 |             expectedJ1 = await c.renderSms('REMINDER_J1', renderData(j1Sms, e2Event));
  431 |             const received = smsSince(await fakeSmsTo(clientPhone), smsMark);
  432 |             expect(received.filter((m) => m.message === expectedJ1).length,
  433 |                 `texte J-1 exact une seule fois au faux MTarget (attendu « ${expectedJ1} ») ; reçus : ${JSON.stringify(received.map((m) => m.message))}`).toBe(1);
  434 |             const panel = await openBell(client);
  435 |             await expect(panel.getByText(/rappel : c.est demain/i).first()).toBeVisible();
  436 | 
  437 |             const h3At = new Date(e2StartAt.getTime() - h3Hours * 3600_000 + 30_000);
  438 |             const h3Scheduled = await c.schedule(h3At, [e2Id]);
  439 |             console.log(`[e2e][fumée] planification à ${h3At.toISOString()} : ${JSON.stringify(h3Scheduled)}`);
  440 |             expect(h3Scheduled.created.REMINDER_H3 ?? 0, `planification H-3 : ${JSON.stringify(h3Scheduled)}`).toBeGreaterThan(0);
  441 |             const h3 = (await outboxOfEvent(e2Id, ['REMINDER_H3'])).filter((r) => r.recipient_user_id === clientUserId);
  442 |             expect(h3.length, `lignes REMINDER_H3 du client : ${brief(h3)}`).toBeGreaterThan(0);
  443 |             expect(h3.filter((r) => r.status !== 'PENDING'), `REMINDER_H3 en attente, rien d’envoyé : ${brief(h3)}`).toEqual([]);
  444 |             const h3Sms = h3.find((r) => r.channel === 'SMS');
  445 |             expect(h3Sms, `ligne SMS du H-3 : ${brief(h3)}`).toBeTruthy();
  446 |             expectedH3 = await c.renderSms('REMINDER_H3', renderData(h3Sms as OutboxLine, e2Event));
  447 |         });
```