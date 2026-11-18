# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fumee.spec.ts >> fumée : créer, soumettre, valider, publier, acheter, scanner, piloter
- Location: e2e/fumee.spec.ts:99:5

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

diagnostic caméra : décodeur zxing+jsqr ; 19 image(s) analysée(s) en 40.0 s depuis la présentation du QR ; POST /api/controller/scan depuis la présentation : [+126 ms → 200 {"result":"wrong_event","scan_id":"ca4b616d-6dff-4d1c-b62d-1679a010742d","replayed":false,"message":"Billet d’un autre événement"}] [+4353 ms → 200 {"result":"wrong_event","scan_id":"0d1b5d20-f895-4544-a3ae-cf7f405af2f1","replayed":false,"message":"Billet d’un autre événement"}] [+8575 ms → 200 {"result":"wrong_event","scan_id":"64a4d52c-2cf5-407f-9a11-212ad67c842b","replayed":false,"message":"Billet d’un autre événement"}] [+12777 ms → 200 {"result":"wrong_event","scan_id":"c13b8a71-6096-461c-9457-ef2d71dbebf8","replayed":false,"message":"Billet d’un autre événement"}] [+16982 ms → 200 {"result":"wrong_event","scan_id":"be11d22d-39de-472e-9315-aa1c3bfd44d1","replayed":false,"message":"Billet d’un autre événement"}] [+21201 ms → 200 {"result":"wrong_event","scan_id":"5f9cf64a-f027-48aa-8f97-ba9141a24617","replayed":false,"message":"Billet d’un autre événement"}] [+25415 ms → 200 {"result":"wrong_event","scan_id":"76f14fd5-a9cc-41a2-a7fe-fa73b487fcc1","replayed":false,"message":"Billet d’un autre événement"}] [+29630 ms → 200 {"result":"wrong_event","scan_id":"35d98fb3-83c3-487d-8f18-0d4ad4d0cb7f","replayed":false,"message":"Billet d’un autre événement"}] [+33849 ms → 200 {"result":"wrong_event","scan_id":"c753c6d0-bf45-4a0b-9104-3dbe83d60454","replayed":false,"message":"Billet d’un autre événement"}] [+38053 ms → 200 {"result":"wrong_event","scan_id":"624abe54-47dc-45d1-97b3-06dc6aea0e96","replayed":false,"message":"Billet d’un autre événement"}] ; écran : ["Détection en pause"], compteur « — », vidéo readyState 4, en lecture, 640×480, flux attaché ; image vidéo jointe (image-video-du-scanner.png) ; console [camera]/[partner/scan]/[scan] (0) : aucun message
```

# Test source

```ts
  189 |         await test.step('1 bis. le partenaire soumet l’événement', async () => {
  190 |             const card = cardOf(partner, title, /^soumettre/i);
  191 |             await actionWithConfirm(partner, card, /^soumettre/i);
  192 |             await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(title, { exact: true }) }).last())
  193 |                 .toContainText(/en attente de validation/i);
  194 |         });
  195 | 
  196 |         await test.step('2. le SUPERADMIN valide l’événement', async () => {
  197 |             const admin = await pageAs('fumee-superadmin');
  198 |             // Diagnostic (run 50 : fiche restée en « En attente » après une validation réussie) : chaque
  199 |             // réponse de la fiche et de la transition est écrite dans e2e.log.
  200 |             admin.on('response', async (res) => {
  201 |                 const url = new URL(res.url());
  202 |                 if (!/^\/api\/admin\/events\/[0-9a-f-]{36}(\/transition)?$/.test(url.pathname)) return;
  203 |                 const body = (await res.json().catch(() => null)) as { actions?: { status?: string }; to?: string; code?: string } | null;
  204 |                 console.log(`[e2e][fiche admin] ${res.request().method()} ${url.pathname} → ${res.status()} statut=${body?.actions?.status ?? body?.to ?? '—'} code=${body?.code ?? '—'}`);
  205 |             });
  206 |             admin.on('console', (msg) => { if (msg.type() === 'error') console.log(`[e2e][fiche admin][console] ${msg.text()}`); });
  207 |             await admin.goto('/admin/events?status=EN_ATTENTE');
  208 |             await admin.getByRole('link', { name: new RegExp(escapeRe(title)) }).click();
  209 |             await admin.waitForURL(/\/admin\/events\/[0-9a-f-]{36}/);
  210 |             await actionWithConfirm(admin, admin.locator('main'), /^valider/i);
  211 |             await expect(admin.getByText(/^validé$/i).first()).toBeVisible();
  212 |         });
  213 | 
  214 |         await test.step('3. le partenaire publie l’événement', async () => {
  215 |             await partner.goto('/partner/events');
  216 |             const card = cardOf(partner, title, /^publier/i);
  217 |             await actionWithConfirm(partner, card, /^publier/i);
  218 |             await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(title, { exact: true }) }).last())
  219 |                 .toContainText(/publié/i);
  220 |         });
  221 | 
  222 |         const client = await pageAs('fumee-client');
  223 |         await test.step('4. le client achète un billet (faux SamirPay, vrai webhook)', async () => {
  224 |             await client.goto('/explore');
  225 |             await client.getByRole('link', { name: new RegExp(escapeRe(title)) }).first().click();
  226 |             await client.waitForURL(/\/events\/[0-9a-f-]{36}/);
  227 |             eventId = new URL(client.url()).pathname.split('/').pop() ?? '';
  228 |             await client.getByRole('button', { name: new RegExp(`ajouter un billet ${escapeRe(category)}`, 'i') }).click();
  229 |             await client.getByRole('button', { name: /^acheter/i }).click();
  230 |             const dialog = client.getByRole('dialog').or(client.getByRole('alertdialog'));
  231 |             await expect(dialog).toBeVisible();
  232 |             // Radio masqué (sr-only) dans son libellé : check({ force: true }) le jugeait parfois hors de l'écran dans la
  233 |             // modale (runs 66 et 92) ; le clic est envoyé à l'élément, puis la sélection est vérifiée.
  234 |             const wave = dialog.getByRole('radio', { name: /^wave/i });
  235 |             await wave.dispatchEvent('click');
  236 |             await expect(wave).toBeChecked();
  237 |             await dialog.getByLabel(/numéro/i).fill(fumeePayerPhone());
  238 |             await dialog.getByRole('button', { name: /payer|confirmer|continuer/i }).last().click();
  239 |             await client.waitForURL(/\/paiement\/[0-9a-f-]{36}/);
  240 |             const succeeded = client.waitForResponse(async (r) => {
  241 |                 if (!/\/api\/payments\/[^/]+\/status/.test(r.url()) || !r.ok()) return false;
  242 |                 const body = (await r.json()) as { status?: string; ticket_ids?: unknown };
  243 |                 return body.status === 'SUCCESS' && Array.isArray(body.ticket_ids) && body.ticket_ids.length > 0;
  244 |             }, { timeout: 45_000 });
  245 |             const done = await fakeServices('/__test/samirpay/complete', { telephone: fumeePayerPhone() });
  246 |             expect(done.status, `faux SamirPay : ${JSON.stringify(done.json)}`).toBe(200);
  247 |             expect(done.json.webhookStatus, `réponse du webhook réel : ${JSON.stringify(done.json)}`).toBe(200);
  248 |             const status = (await (await succeeded).json()) as { ticket_ids: string[] };
  249 |             ticketId = status.ticket_ids[0];
  250 |             await expect(client.getByText('Paiement confirmé')).toBeVisible({ timeout: 45_000 });
  251 |         });
  252 | 
  253 |         await test.step('5. le partenaire propriétaire scanne le billet (caméra simulée)', async () => {
  254 |             await partner.goto('/partner/scan');
  255 |             const select = partner.getByLabel('Événement contrôlé');
  256 |             const value = await select.locator('option', { hasText: title }).getAttribute('value');
  257 |             expect(value, 'événement publié proposé au scan').toBeTruthy();
  258 |             await select.selectOption(value as string);
  259 |             const cameraMode = partner.getByRole('button', { name: /^caméra$/i });
  260 |             if ((await cameraMode.getAttribute('aria-pressed')) !== 'true') await cameraMode.click();
  261 | 
  262 |             expect(ticketId, 'billet émis, lu dans la réponse de statut du paiement').toMatch(/^[0-9a-f-]{36}$/);
  263 |             const liveCode = client.waitForResponse((r) => r.url().includes(`/api/tickets/${ticketId}/live-code`) && r.ok());
  264 |             await client.goto('/tickets');
  265 |             const payload = String(((await (await liveCode).json()) as { payload?: string }).payload ?? '');
  266 |             const ticketCard = client.locator('li, article, section, div')
  267 |                 .filter({ has: client.getByText(title) })
  268 |                 .filter({ has: client.getByRole('img', { name: /QR d.entrée dynamique/i }) })
  269 |                 .last();
  270 |             const qr = ticketCard.getByRole('img', { name: /QR d.entrée dynamique/i });
  271 |             await expect(qr).toBeVisible();
  272 |             const png = await qr.screenshot();
  273 |             const before = await cameraDiagSnapshot(partner);
  274 |             await partner.evaluate(async ({ dataUrl, p }) => {
  275 |                 const cam = (window as unknown as { __evFakeCamera?: { show: (d: string) => Promise<void>; setPayload: (x: string) => void } }).__evFakeCamera;
  276 |                 if (!cam) throw new Error('caméra simulée absente de la page');
  277 |                 cam.setPayload(p);
  278 |                 await cam.show(dataUrl);
  279 |             }, { dataUrl: `data:image/png;base64,${png.toString('base64')}`, p: payload });
  280 |             try {
  281 |                 await expect(partner.getByText('Entrée validée').first()).toBeVisible({ timeout: 40_000 });
  282 |             } catch (err) {
  283 |                 // Run 80 : QR présenté, aucun résultat. Le diagnostic dit si la boucle tournait (images analysées),
  284 |                 // si une lecture est partie (POST) et dans quel état était l'écran ; QR présenté et image vidéo joints.
  285 |                 await testInfo.attach('qr-presente.png', { body: png, contentType: 'image/png' });
  286 |                 const detail = await describeCameraScan(partner, before, scanConsole, testInfo)
  287 |                     .catch((e: unknown) => `diagnostic caméra impossible : ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
  288 |                 console.log(`[e2e][fumée] étape 5, payload attendu « ${payload} » ; ${detail}`);
> 289 |                 throw new Error(`${err instanceof Error ? err.message : String(err)}\n${detail}`);
      |                       ^ Error: expect(locator).toBeVisible() failed
  290 |             }
  291 |         });
  292 | 
  293 |         await test.step('6. la page de pilotage montre 1 vendu et 1 entrée', async () => {
  294 |             expect(eventId, 'identifiant de l’événement lu sur la page publique').toMatch(/^[0-9a-f-]{36}$/);
  295 |             await partner.goto(`/partner/events/${eventId}`);
  296 |             const apercu = partner.getByRole('tab', { name: /^aperçu/i });
  297 |             if ((await apercu.getAttribute('aria-selected')) !== 'true') await apercu.click();
  298 |             const panel = partner.getByRole('tabpanel');
  299 |             await expect(kpi(panel, /billets vendus/i)).toContainText(/(^|\D)1(\D|$)/);
  300 |             await expect(kpi(panel, /^entrées/i)).toContainText(/(^|\D)1(\D|$)/);
  301 |         });
  302 | 
  303 |         // ── Lot 6 (contrat P3) : étapes 7 à 10 ──────────────────────────────
  304 |         const clientPhone = FIXTURE_USERS.CLIENT.phone;
  305 |         const e2Title = `Fumée — Rappels des Parcelles ${stamp}`;
  306 |         const e2Category = 'Entrée générale';
  307 |         const e2Day = dakarDayFrom(new Date(), 2);
  308 |         const e2StartAt = new Date(`${e2Day}T20:00:00.000Z`);
  309 |         const e2Event: Record<string, unknown> = {
  310 |             event_id: '', title: e2Title, start_at: e2StartAt.toISOString(), location: 'Esplanade des Parcelles Assainies', city: 'Dakar',
  311 |         };
  312 |         let e2Id = '';
  313 |         let clientUserId = '';
  314 |         let clock: SimulatedClock | null = null;
  315 |         let smsMark = new Set<string>();
  316 |         let expectedJ1 = '';
  317 |         let expectedH3 = '';
  318 |         let expectedCancel = '';
  319 | 
  320 |         await test.step('7. second événement à J+2 20:00 (RPC du partenaire A), acheté par le client dans l’interface', async () => {
  321 |             expect(eventId, 'événement de l’étape 1 (affiche réutilisée)').toMatch(/^[0-9a-f-]{36}$/);
  322 |             clientUserId = await userIdByEmail(FIXTURE_USERS.CLIENT.email);
  323 |             const partnerUserId = await userIdByEmail(FIXTURE_USERS.PARTNER_A.email);
  324 |             const superadminId = await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
  325 |             e2Id = await createPublishedEvent({
  326 |                 partnerUserId,
  327 |                 superadminId,
  328 |                 title: e2Title,
  329 |                 description: 'Second concert de fumée : rappels J-1 et H-3 par horloge simulée, puis annulation. Données fictives.',
  330 |                 startDate: e2Day, startTime: '20:00:00', endDate: e2Day, endTime: '23:00:00',
  331 |                 location: String(e2Event.location), city: String(e2Event.city), capacity: 100,
  332 |                 imageUrl: await eventImageUrl(eventId),
  333 |                 category: { name: e2Category, price: 5000, total: 50 },
  334 |             });
  335 |             e2Event.event_id = e2Id;
  336 |             const [ticket] = await buyThroughUi(client, e2Id, e2Category);
  337 |             expect(ticket, 'billet de E2, lu dans la réponse de statut du paiement').toMatch(/^[0-9a-f-]{36}$/);
  338 |         });
  339 | 
  340 |         await test.step('8. rappels J-1 puis H-3 par horloge simulée : boîte d’envoi, faux SMS, cloche', async () => {
  341 |             const { simulatedClock } = await import('./support/clock');
  342 |             const c = await simulatedClock();
  343 |             clock = c;
  344 |             const how = c.mode === 'processus' ? 'modules du dépôt importés dans le processus Playwright' : `repli scripts/e2e/clock-run.ts (${c.fallbackReason})`;
  345 |             testInfo.annotations.push({ type: 'horloge simulée', description: how });
  346 |             console.log(`[e2e][fumée] horloge simulée : ${how}`);
  347 | 
  348 |             const j1Hour = await notifSettingInt('notif.reminder_j1_hour');
  349 |             const h3Hours = await notifSettingInt('notif.reminder_h3_hours');
  350 |             const quietStart = await notifSettingInt('notif.sms_quiet_start');
  351 |             const quietEnd = await notifSettingInt('notif.sms_quiet_end');
  352 |             if (inQuietHours(j1Hour, quietStart, quietEnd)) {
  353 |                 throw new Error(`rappel J-1 à ${j1Hour} h dans la plage de silence ${quietStart} h - ${quietEnd} h : la fumée ne modifie pas les réglages (contrat P3), relevez notif.reminder_j1_hour`);
  354 |             }
  355 |             // Lot 7 (D81) : boîte d'E1 vidée AVANT le repère (et toute autre ligne SMS en attente du client, hors E2),
  356 |             // à l'heure réelle ; les SMS partis sont identifiés, ils ne se mêlent plus au décompte de l'étape 10
  357 |             const drainEvents = Array.from(new Set([eventId, ...(await pendingSmsEventsOf(clientUserId, clientPhone))])).filter((id) => id !== e2Id);
  358 |             const beforeDrain = new Set((await fakeSmsTo(clientPhone)).map((m) => m.ticket));
  359 |             const drainReport = await c.dispatch(new Date(), drainEvents);
  360 |             console.log(`[e2e][fumée] boîte vidée avant le repère (événements ${drainEvents.join(', ')}) : ${JSON.stringify(drainReport)}`);
  361 |             const drained = await identifySms('avant le repère (boîte de E1 vidée)', smsSince(await fakeSmsTo(clientPhone), beforeDrain), { [eventId]: 'E1', [e2Id]: 'E2' });
  362 |             expect(drained.filter((d) => d.line === null).map((d) => d.sms.ticket), 'SMS partis au vidage de la boîte de E1, tous identifiés').toEqual([]);
  363 |             smsMark = new Set((await fakeSmsTo(clientPhone)).map((m) => m.ticket));
  364 | 
  365 |             const veille = new Date(`${dakarDayFrom(e2StartAt, -1)}T${String(j1Hour).padStart(2, '0')}:00:30.000Z`);
  366 |             const scheduled = await c.schedule(veille, [e2Id]);
  367 |             console.log(`[e2e][fumée] planification à ${veille.toISOString()} : ${JSON.stringify(scheduled)}`);
  368 |             expect(scheduled.created.REMINDER_J1 ?? 0, `planification J-1 : ${JSON.stringify(scheduled)}`).toBeGreaterThan(0);
  369 |             const dispatched = await c.dispatch(new Date(veille.getTime() + 60_000), [e2Id]);
  370 |             console.log(`[e2e][fumée] envoyeur à ${new Date(veille.getTime() + 60_000).toISOString()} : ${JSON.stringify(dispatched)}`);
  371 | 
  372 |             const vapid = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
  373 |             const j1 = (await outboxOfEvent(e2Id, ['REMINDER_J1'])).filter((r) => r.recipient_user_id === clientUserId);
  374 |             // Lot 9 bis (B96, G.48, règle changée) : l'adresse du client n'est pas vérifiée, l'email est écarté pour ce motif
  375 |             // avant toute question de configuration du canal (run 119 : EMAIL_NOT_VERIFIED)
  376 |             expect(j1.map((r) => `${r.channel} ${r.status}${r.reason ? ` ${r.reason}` : ''}`).sort(), `lignes REMINDER_J1 du client : ${brief(j1)}`).toEqual([
  377 |                 'EMAIL SKIPPED EMAIL_NOT_VERIFIED',
  378 |                 'IN_APP SENT',
  379 |                 `PUSH SKIPPED ${vapid ? 'NO_PUSH_SUBSCRIPTION' : 'PUSH_NOT_CONFIGURED'}`,
  380 |                 'SMS SENT',
  381 |             ]);
  382 |             const j1Sms = j1.find((r) => r.channel === 'SMS') as OutboxLine;
  383 |             expectedJ1 = await c.renderSms('REMINDER_J1', renderData(j1Sms, e2Event));
  384 |             const received = smsSince(await fakeSmsTo(clientPhone), smsMark);
  385 |             expect(received.filter((m) => m.message === expectedJ1).length,
  386 |                 `texte J-1 exact une seule fois au faux MTarget (attendu « ${expectedJ1} ») ; reçus : ${JSON.stringify(received.map((m) => m.message))}`).toBe(1);
  387 |             const panel = await openBell(client);
  388 |             await expect(panel.getByText(/rappel : c.est demain/i).first()).toBeVisible();
  389 | 
```