# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fumee.spec.ts >> fumée : créer, soumettre, valider, publier, acheter, scanner, piloter
- Location: e2e/fumee.spec.ts:91:5

# Error details

```
Error: lignes REMINDER_J1 du client : [{"type":"REMINDER_J1","channel":"EMAIL","status":"SKIPPED","reason":"EMAIL_NOT_VERIFIED","user":"975dd84a-e3b6-4208-8183-e4eb881faac0"},{"type":"REMINDER_J1","channel":"IN_APP","status":"SENT","reason":null,"user":"975dd84a-e3b6-4208-8183-e4eb881faac0"},{"type":"REMINDER_J1","channel":"PUSH","status":"SKIPPED","reason":"NO_PUSH_SUBSCRIPTION","user":"975dd84a-e3b6-4208-8183-e4eb881faac0"},{"type":"REMINDER_J1","channel":"SMS","status":"SENT","reason":null,"user":"975dd84a-e3b6-4208-8183-e4eb881faac0"}]

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 1

  Array [
-   "EMAIL SKIPPED EMAIL_NOT_CONFIGURED",
+   "EMAIL SKIPPED EMAIL_NOT_VERIFIED",
    "IN_APP SENT",
    "PUSH SKIPPED NO_PUSH_SUBSCRIPTION",
    "SMS SENT",
  ]
```

# Test source

```ts
  254 |             await partner.evaluate(async ({ dataUrl, p }) => {
  255 |                 const cam = (window as unknown as { __evFakeCamera?: { show: (d: string) => Promise<void>; setPayload: (x: string) => void } }).__evFakeCamera;
  256 |                 if (!cam) throw new Error('caméra simulée absente de la page');
  257 |                 cam.setPayload(p);
  258 |                 await cam.show(dataUrl);
  259 |             }, { dataUrl: `data:image/png;base64,${png.toString('base64')}`, p: payload });
  260 |             try {
  261 |                 await expect(partner.getByText('Entrée validée').first()).toBeVisible({ timeout: 40_000 });
  262 |             } catch (err) {
  263 |                 // Run 80 : QR présenté, aucun résultat. Le diagnostic dit si la boucle tournait (images analysées),
  264 |                 // si une lecture est partie (POST) et dans quel état était l'écran ; QR présenté et image vidéo joints.
  265 |                 await testInfo.attach('qr-presente.png', { body: png, contentType: 'image/png' });
  266 |                 const detail = await describeCameraScan(partner, before, scanConsole, testInfo)
  267 |                     .catch((e: unknown) => `diagnostic caméra impossible : ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
  268 |                 console.log(`[e2e][fumée] étape 5, payload attendu « ${payload} » ; ${detail}`);
  269 |                 throw new Error(`${err instanceof Error ? err.message : String(err)}\n${detail}`);
  270 |             }
  271 |         });
  272 | 
  273 |         await test.step('6. la page de pilotage montre 1 vendu et 1 entrée', async () => {
  274 |             expect(eventId, 'identifiant de l’événement lu sur la page publique').toMatch(/^[0-9a-f-]{36}$/);
  275 |             await partner.goto(`/partner/events/${eventId}`);
  276 |             const apercu = partner.getByRole('tab', { name: /^aperçu/i });
  277 |             if ((await apercu.getAttribute('aria-selected')) !== 'true') await apercu.click();
  278 |             const panel = partner.getByRole('tabpanel');
  279 |             await expect(kpi(panel, /billets vendus/i)).toContainText(/(^|\D)1(\D|$)/);
  280 |             await expect(kpi(panel, /^entrées/i)).toContainText(/(^|\D)1(\D|$)/);
  281 |         });
  282 | 
  283 |         // ── Lot 6 (contrat P3) : étapes 7 à 10 ──────────────────────────────
  284 |         const clientPhone = FIXTURE_USERS.CLIENT.phone;
  285 |         const e2Title = `Fumée — Rappels des Parcelles ${stamp}`;
  286 |         const e2Category = 'Entrée générale';
  287 |         const e2Day = dakarDayFrom(new Date(), 2);
  288 |         const e2StartAt = new Date(`${e2Day}T20:00:00.000Z`);
  289 |         const e2Event: Record<string, unknown> = {
  290 |             event_id: '', title: e2Title, start_at: e2StartAt.toISOString(), location: 'Esplanade des Parcelles Assainies', city: 'Dakar',
  291 |         };
  292 |         let e2Id = '';
  293 |         let clientUserId = '';
  294 |         let clock: SimulatedClock | null = null;
  295 |         let smsMark = new Set<string>();
  296 |         let expectedJ1 = '';
  297 |         let expectedH3 = '';
  298 |         let expectedCancel = '';
  299 | 
  300 |         await test.step('7. second événement à J+2 20:00 (RPC du partenaire A), acheté par le client dans l’interface', async () => {
  301 |             expect(eventId, 'événement de l’étape 1 (affiche réutilisée)').toMatch(/^[0-9a-f-]{36}$/);
  302 |             clientUserId = await userIdByEmail(FIXTURE_USERS.CLIENT.email);
  303 |             const partnerUserId = await userIdByEmail(FIXTURE_USERS.PARTNER_A.email);
  304 |             const superadminId = await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
  305 |             e2Id = await createPublishedEvent({
  306 |                 partnerUserId,
  307 |                 superadminId,
  308 |                 title: e2Title,
  309 |                 description: 'Second concert de fumée : rappels J-1 et H-3 par horloge simulée, puis annulation. Données fictives.',
  310 |                 startDate: e2Day, startTime: '20:00:00', endDate: e2Day, endTime: '23:00:00',
  311 |                 location: String(e2Event.location), city: String(e2Event.city), capacity: 100,
  312 |                 imageUrl: await eventImageUrl(eventId),
  313 |                 category: { name: e2Category, price: 5000, total: 50 },
  314 |             });
  315 |             e2Event.event_id = e2Id;
  316 |             const [ticket] = await buyThroughUi(client, e2Id, e2Category);
  317 |             expect(ticket, 'billet de E2, lu dans la réponse de statut du paiement').toMatch(/^[0-9a-f-]{36}$/);
  318 |         });
  319 | 
  320 |         await test.step('8. rappels J-1 puis H-3 par horloge simulée : boîte d’envoi, faux SMS, cloche', async () => {
  321 |             const { simulatedClock } = await import('./support/clock');
  322 |             const c = await simulatedClock();
  323 |             clock = c;
  324 |             const how = c.mode === 'processus' ? 'modules du dépôt importés dans le processus Playwright' : `repli scripts/e2e/clock-run.ts (${c.fallbackReason})`;
  325 |             testInfo.annotations.push({ type: 'horloge simulée', description: how });
  326 |             console.log(`[e2e][fumée] horloge simulée : ${how}`);
  327 | 
  328 |             const j1Hour = await notifSettingInt('notif.reminder_j1_hour');
  329 |             const h3Hours = await notifSettingInt('notif.reminder_h3_hours');
  330 |             const quietStart = await notifSettingInt('notif.sms_quiet_start');
  331 |             const quietEnd = await notifSettingInt('notif.sms_quiet_end');
  332 |             if (inQuietHours(j1Hour, quietStart, quietEnd)) {
  333 |                 throw new Error(`rappel J-1 à ${j1Hour} h dans la plage de silence ${quietStart} h - ${quietEnd} h : la fumée ne modifie pas les réglages (contrat P3), relevez notif.reminder_j1_hour`);
  334 |             }
  335 |             // Lot 7 (D81) : boîte d'E1 vidée AVANT le repère (et toute autre ligne SMS en attente du client, hors E2),
  336 |             // à l'heure réelle ; les SMS partis sont identifiés, ils ne se mêlent plus au décompte de l'étape 10
  337 |             const drainEvents = Array.from(new Set([eventId, ...(await pendingSmsEventsOf(clientUserId, clientPhone))])).filter((id) => id !== e2Id);
  338 |             const beforeDrain = new Set((await fakeSmsTo(clientPhone)).map((m) => m.ticket));
  339 |             const drainReport = await c.dispatch(new Date(), drainEvents);
  340 |             console.log(`[e2e][fumée] boîte vidée avant le repère (événements ${drainEvents.join(', ')}) : ${JSON.stringify(drainReport)}`);
  341 |             const drained = await identifySms('avant le repère (boîte de E1 vidée)', smsSince(await fakeSmsTo(clientPhone), beforeDrain), { [eventId]: 'E1', [e2Id]: 'E2' });
  342 |             expect(drained.filter((d) => d.line === null).map((d) => d.sms.ticket), 'SMS partis au vidage de la boîte de E1, tous identifiés').toEqual([]);
  343 |             smsMark = new Set((await fakeSmsTo(clientPhone)).map((m) => m.ticket));
  344 | 
  345 |             const veille = new Date(`${dakarDayFrom(e2StartAt, -1)}T${String(j1Hour).padStart(2, '0')}:00:30.000Z`);
  346 |             const scheduled = await c.schedule(veille, [e2Id]);
  347 |             console.log(`[e2e][fumée] planification à ${veille.toISOString()} : ${JSON.stringify(scheduled)}`);
  348 |             expect(scheduled.created.REMINDER_J1 ?? 0, `planification J-1 : ${JSON.stringify(scheduled)}`).toBeGreaterThan(0);
  349 |             const dispatched = await c.dispatch(new Date(veille.getTime() + 60_000), [e2Id]);
  350 |             console.log(`[e2e][fumée] envoyeur à ${new Date(veille.getTime() + 60_000).toISOString()} : ${JSON.stringify(dispatched)}`);
  351 | 
  352 |             const vapid = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
  353 |             const j1 = (await outboxOfEvent(e2Id, ['REMINDER_J1'])).filter((r) => r.recipient_user_id === clientUserId);
> 354 |             expect(j1.map((r) => `${r.channel} ${r.status}${r.reason ? ` ${r.reason}` : ''}`).sort(), `lignes REMINDER_J1 du client : ${brief(j1)}`).toEqual([
      |                                                                                                                                                      ^ Error: lignes REMINDER_J1 du client : [{"type":"REMINDER_J1","channel":"EMAIL","status":"SKIPPED","reason":"EMAIL_NOT_VERIFIED","user":"975dd84a-e3b6-4208-8183-e4eb881faac0"},{"type":"REMINDER_J1","channel":"IN_APP","status":"SENT","reason":null,"user":"975dd84a-e3b6-4208-8183-e4eb881faac0"},{"type":"REMINDER_J1","channel":"PUSH","status":"SKIPPED","reason":"NO_PUSH_SUBSCRIPTION","user":"975dd84a-e3b6-4208-8183-e4eb881faac0"},{"type":"REMINDER_J1","channel":"SMS","status":"SENT","reason":null,"user":"975dd84a-e3b6-4208-8183-e4eb881faac0"}]
  355 |                 'EMAIL SKIPPED EMAIL_NOT_CONFIGURED',
  356 |                 'IN_APP SENT',
  357 |                 `PUSH SKIPPED ${vapid ? 'NO_PUSH_SUBSCRIPTION' : 'PUSH_NOT_CONFIGURED'}`,
  358 |                 'SMS SENT',
  359 |             ]);
  360 |             const j1Sms = j1.find((r) => r.channel === 'SMS') as OutboxLine;
  361 |             expectedJ1 = await c.renderSms('REMINDER_J1', renderData(j1Sms, e2Event));
  362 |             const received = smsSince(await fakeSmsTo(clientPhone), smsMark);
  363 |             expect(received.filter((m) => m.message === expectedJ1).length,
  364 |                 `texte J-1 exact une seule fois au faux MTarget (attendu « ${expectedJ1} ») ; reçus : ${JSON.stringify(received.map((m) => m.message))}`).toBe(1);
  365 |             const panel = await openBell(client);
  366 |             await expect(panel.getByText(/rappel : c.est demain/i).first()).toBeVisible();
  367 | 
  368 |             const h3At = new Date(e2StartAt.getTime() - h3Hours * 3600_000 + 30_000);
  369 |             const h3Scheduled = await c.schedule(h3At, [e2Id]);
  370 |             console.log(`[e2e][fumée] planification à ${h3At.toISOString()} : ${JSON.stringify(h3Scheduled)}`);
  371 |             expect(h3Scheduled.created.REMINDER_H3 ?? 0, `planification H-3 : ${JSON.stringify(h3Scheduled)}`).toBeGreaterThan(0);
  372 |             const h3 = (await outboxOfEvent(e2Id, ['REMINDER_H3'])).filter((r) => r.recipient_user_id === clientUserId);
  373 |             expect(h3.length, `lignes REMINDER_H3 du client : ${brief(h3)}`).toBeGreaterThan(0);
  374 |             expect(h3.filter((r) => r.status !== 'PENDING'), `REMINDER_H3 en attente, rien d’envoyé : ${brief(h3)}`).toEqual([]);
  375 |             const h3Sms = h3.find((r) => r.channel === 'SMS');
  376 |             expect(h3Sms, `ligne SMS du H-3 : ${brief(h3)}`).toBeTruthy();
  377 |             expectedH3 = await c.renderSms('REMINDER_H3', renderData(h3Sms as OutboxLine, e2Event));
  378 |         });
  379 | 
  380 |         await test.step('9. annulation par le partenaire : H-3 annulés, avis d’annulation par la vraie route de l’envoyeur', async () => {
  381 |             if (!clock) throw new Error('horloge simulée absente (étape 8 non aboutie)');
  382 |             const c: SimulatedClock = clock;
  383 |             const before = new Set((await fakeSmsTo(clientPhone)).map((m) => m.ticket));
  384 |             await partner.goto(`/partner/events/${e2Id}`);
  385 |             await partner.getByRole('button', { name: /annuler l[’']événement/i }).click();
  386 |             const dialog = partner.getByRole('dialog').or(partner.getByRole('alertdialog'));
  387 |             await expect(dialog).toBeVisible();
  388 |             await expect(dialog.getByText(/acheteurs à prévenir/i)).toBeVisible();
  389 |             await dialog.getByLabel(/^avis public aux participants/i).fill('Concert de fumée annulé : les billets payés en ligne sont remboursés automatiquement.');
  390 |             await dialog.getByLabel(/^motif interne/i).fill('Fumée de bout en bout du lot 6.');
  391 |             await dialog.getByLabel(/pour confirmer, saisissez le titre exact/i).fill(e2Title);
  392 |             const cancelled = partner.waitForResponse(
  393 |                 (r) => new URL(r.url()).pathname === `/api/partner/events/${e2Id}/cancel` && r.request().method() === 'POST',
  394 |                 { timeout: 60_000 });
  395 |             await dialog.getByRole('button', { name: /^confirmer l[’']annulation$/i }).click();
  396 |             const res = await cancelled;
  397 |             expect(res.status(), `annulation par le partenaire : ${(await res.text()).slice(0, 300)}`).toBe(200);
  398 |             await expect(dialog).toBeHidden();
  399 | 
  400 |             const h3 = await outboxOfEvent(e2Id, ['REMINDER_H3']);
  401 |             expect(h3.length, 'lignes REMINDER_H3 de E2').toBeGreaterThan(0);
  402 |             expect(h3.map((r) => `${r.status} ${r.reason ?? ''}`), `REMINDER_H3 annulés dans la transaction de l’annulation : ${brief(h3)}`)
  403 |                 .toEqual(h3.map(() => 'CANCELLED EVENT_ANNULE'));
  404 | 
  405 |             const secret = process.env.CRON_SECRET;
  406 |             if (!secret) throw new Error(`CRON_SECRET absente de ${e2eConfig().envFile} : la vraie route de l’envoyeur est protégée`);
  407 |             // Même hôte que le contrôle de run-e2e.mjs : le serveur écoute sur 127.0.0.1 (localhost peut viser ::1)
  408 |             const cron = await fetch(`http://127.0.0.1:${new URL(APP_URL).port}/api/cron/notifications-dispatch`, {
  409 |                 method: 'GET', headers: { authorization: `Bearer ${secret}` },
  410 |             });
  411 |             const cronText = await cron.text();
  412 |             console.log(`[e2e][fumée] GET /api/cron/notifications-dispatch → ${cron.status} ${cronText.slice(0, 300)}`);
  413 |             expect(cron.status, `route de l’envoyeur : ${cronText.slice(0, 300)}`).toBe(200);
  414 | 
  415 |             const cancel = (await outboxOfEvent(e2Id, ['EVENT_CANCELLED']))
  416 |                 .filter((r) => r.recipient_user_id === clientUserId || r.recipient_phone === clientPhone);
  417 |             const cancelSms = cancel.filter((r) => r.channel === 'SMS');
  418 |             expect(cancelSms.map((r) => r.status), `EVENT_CANCELLED SMS du client : ${brief(cancel)}`).toEqual(['SENT']);
  419 |             expect(cancel.filter((r) => r.channel === 'IN_APP').map((r) => r.status), `EVENT_CANCELLED dans l’application : ${brief(cancel)}`).toEqual(['SENT']);
  420 |             expectedCancel = await c.renderSms('EVENT_CANCELLED', renderData(cancelSms[0], e2Event));
  421 |             const received = smsSince(await fakeSmsTo(clientPhone), before);
  422 |             const messages = JSON.stringify(received.map((m) => m.message));
  423 |             expect(received.filter((m) => m.message === expectedCancel).length,
  424 |                 `avis d’annulation exact une seule fois (attendu « ${expectedCancel} ») ; reçus : ${messages}`).toBe(1);
  425 |             expect(received.filter((m) => m.message === expectedH3).length, `aucun H-3 envoyé après l’annulation ; reçus : ${messages}`).toBe(0);
  426 |             const panel = await openBell(client);
  427 |             await expect(panel.getByText(/événement annulé/i).first()).toBeVisible();
  428 |         });
  429 | 
  430 |         await test.step('10. comptage par différence depuis l’étape 8 ; aucune ligne de E2 en SENDING', async () => {
  431 |             const received = smsSince(await fakeSmsTo(clientPhone), smsMark);
  432 |             const counts = {
  433 |                 j1: received.filter((m) => m.message === expectedJ1).length,
  434 |                 h3: received.filter((m) => m.message === expectedH3).length,
  435 |                 annulation: received.filter((m) => m.message === expectedCancel).length,
  436 |             };
  437 |             console.log(`[e2e][fumée] SMS du client depuis l’étape 8 : ${received.length} (${JSON.stringify(counts)})`);
  438 |             expect(counts, `SMS du client depuis l’étape 8 : ${JSON.stringify(received.map((m) => m.message))}`).toEqual({ j1: 1, h3: 0, annulation: 1 });
  439 |             // Lot 7 (D81) : liste exacte, par jointure provider_message_id = ticket du faux MTarget
  440 |             const identified = await identifySms('depuis le repère de l’étape 8', received, { [eventId]: 'E1', [e2Id]: 'E2' });
  441 |             expect(identified.filter((d) => d.line === null).map((d) => `${d.sms.ticket} « ${d.sms.message.slice(0, 60)} »`),
  442 |                 'chaque SMS reçu depuis le repère a sa ligne dans la boîte d’envoi (provider_message_id)').toEqual([]);
  443 |             const lines = identified.flatMap((d) => (d.line ? [d.line] : []));
  444 |             expect(lines.map((l) => `${l.type} ${l.event_id === e2Id ? 'E2' : l.event_id ?? 'sans événement'}`).sort(),
  445 |                 `SMS du client depuis le repère : ${JSON.stringify(lines.map((l) => ({ type: l.type, cle: l.idempotency_key })))}`)
  446 |                 // REFUND_PAID E2 : remboursement automatique de l'achat E2 à l'annulation (event_cancel →
  447 |                 // refund_request EVENT_CANCELLATION_REFUND, envoyé aussitôt par CashoutService.sendBatch ; avis mis en
  448 |                 // file par le trigger des cashouts au passage à CONFIRME, clé REFUND_PAID:<cashout>). Déjà relevé au
  449 |                 // lot 6 parmi les SMS non identifiés de la fumée (contrat du lot 7, dette : PURCHASE_CONFIRMED E2,
  450 |                 // PURCHASE_CONFIRMED E1, REFUND_PAID E2) ; oublié dans la liste exacte jusqu'au run 77.
  451 |                 // Unicité contrôlée juste après (aucune clé deux fois).
  452 |                 .toEqual(['EVENT_CANCELLED E2', 'PURCHASE_CONFIRMED E2', 'REFUND_PAID E2', 'REMINDER_J1 E2']);
  453 |             const keys = lines.map((l) => `${l.type} ${l.idempotency_key}`);
  454 |             expect(keys.filter((k, i) => keys.indexOf(k) !== i), 'aucun SMS envoyé deux fois pour la même clé (doublon = défaut)').toEqual([]);
```