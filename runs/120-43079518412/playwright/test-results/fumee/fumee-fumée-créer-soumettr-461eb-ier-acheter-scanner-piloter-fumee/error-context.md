# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fumee.spec.ts >> fumée : créer, soumettre, valider, publier, acheter, scanner, piloter
- Location: e2e/fumee.spec.ts:99:5

# Error details

```
Error: REMINDER_H3 en attente, rien d’envoyé : [{"type":"REMINDER_H3","channel":"EMAIL","status":"SKIPPED","reason":"EMAIL_NOT_VERIFIED","user":"55e78c87-b935-4c41-bca4-8f661f35b0f0"},{"type":"REMINDER_H3","channel":"IN_APP","status":"PENDING","reason":null,"user":"55e78c87-b935-4c41-bca4-8f661f35b0f0"},{"type":"REMINDER_H3","channel":"PUSH","status":"PENDING","reason":null,"user":"55e78c87-b935-4c41-bca4-8f661f35b0f0"},{"type":"REMINDER_H3","channel":"SMS","status":"PENDING","reason":null,"user":"55e78c87-b935-4c41-bca4-8f661f35b0f0"}]

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 24

- Array []
+ Array [
+   Object {
+     "attempts": 0,
+     "channel": "EMAIL",
+     "due_at": "2026-11-13T17:00:00+00:00",
+     "event_id": "5a132de7-b3bf-4d42-8efb-9f0c3fca7ae0",
+     "id": "2e6e6dba-0a5a-4a3e-98d6-2df73dd79ca6",
+     "idempotency_key": "REMINDER_H3:5a132de7-b3bf-4d42-8efb-9f0c3fca7ae0:55e78c87-b935-4c41-bca4-8f661f35b0f0:20261113T2000Z:EMAIL",
+     "reason": "EMAIL_NOT_VERIFIED",
+     "recipient_phone": null,
+     "recipient_user_id": "55e78c87-b935-4c41-bca4-8f661f35b0f0",
+     "status": "SKIPPED",
+     "template_data": Object {
+       "city": "Dakar",
+       "event_id": "5a132de7-b3bf-4d42-8efb-9f0c3fca7ae0",
+       "free_only": false,
+       "location": "Esplanade des Parcelles Assainies",
+       "sms_policy": "IF_NO_PUSH",
+       "start_at": "2026-11-13T20:00:00+00:00",
+       "title": "Fumée — Rappels des Parcelles 19.28.58",
+     },
+     "type": "REMINDER_H3",
+   },
+ ]
```

# Test source

```ts
  284 |             const apercu = partner.getByRole('tab', { name: /^aperçu/i });
  285 |             if ((await apercu.getAttribute('aria-selected')) !== 'true') await apercu.click();
  286 |             const panel = partner.getByRole('tabpanel');
  287 |             await expect(kpi(panel, /billets vendus/i)).toContainText(/(^|\D)1(\D|$)/);
  288 |             await expect(kpi(panel, /^entrées/i)).toContainText(/(^|\D)1(\D|$)/);
  289 |         });
  290 | 
  291 |         // ── Lot 6 (contrat P3) : étapes 7 à 10 ──────────────────────────────
  292 |         const clientPhone = FIXTURE_USERS.CLIENT.phone;
  293 |         const e2Title = `Fumée — Rappels des Parcelles ${stamp}`;
  294 |         const e2Category = 'Entrée générale';
  295 |         const e2Day = dakarDayFrom(new Date(), 2);
  296 |         const e2StartAt = new Date(`${e2Day}T20:00:00.000Z`);
  297 |         const e2Event: Record<string, unknown> = {
  298 |             event_id: '', title: e2Title, start_at: e2StartAt.toISOString(), location: 'Esplanade des Parcelles Assainies', city: 'Dakar',
  299 |         };
  300 |         let e2Id = '';
  301 |         let clientUserId = '';
  302 |         let clock: SimulatedClock | null = null;
  303 |         let smsMark = new Set<string>();
  304 |         let expectedJ1 = '';
  305 |         let expectedH3 = '';
  306 |         let expectedCancel = '';
  307 | 
  308 |         await test.step('7. second événement à J+2 20:00 (RPC du partenaire A), acheté par le client dans l’interface', async () => {
  309 |             expect(eventId, 'événement de l’étape 1 (affiche réutilisée)').toMatch(/^[0-9a-f-]{36}$/);
  310 |             clientUserId = await userIdByEmail(FIXTURE_USERS.CLIENT.email);
  311 |             const partnerUserId = await userIdByEmail(FIXTURE_USERS.PARTNER_A.email);
  312 |             const superadminId = await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
  313 |             e2Id = await createPublishedEvent({
  314 |                 partnerUserId,
  315 |                 superadminId,
  316 |                 title: e2Title,
  317 |                 description: 'Second concert de fumée : rappels J-1 et H-3 par horloge simulée, puis annulation. Données fictives.',
  318 |                 startDate: e2Day, startTime: '20:00:00', endDate: e2Day, endTime: '23:00:00',
  319 |                 location: String(e2Event.location), city: String(e2Event.city), capacity: 100,
  320 |                 imageUrl: await eventImageUrl(eventId),
  321 |                 category: { name: e2Category, price: 5000, total: 50 },
  322 |             });
  323 |             e2Event.event_id = e2Id;
  324 |             const [ticket] = await buyThroughUi(client, e2Id, e2Category);
  325 |             expect(ticket, 'billet de E2, lu dans la réponse de statut du paiement').toMatch(/^[0-9a-f-]{36}$/);
  326 |         });
  327 | 
  328 |         await test.step('8. rappels J-1 puis H-3 par horloge simulée : boîte d’envoi, faux SMS, cloche', async () => {
  329 |             const { simulatedClock } = await import('./support/clock');
  330 |             const c = await simulatedClock();
  331 |             clock = c;
  332 |             const how = c.mode === 'processus' ? 'modules du dépôt importés dans le processus Playwright' : `repli scripts/e2e/clock-run.ts (${c.fallbackReason})`;
  333 |             testInfo.annotations.push({ type: 'horloge simulée', description: how });
  334 |             console.log(`[e2e][fumée] horloge simulée : ${how}`);
  335 | 
  336 |             const j1Hour = await notifSettingInt('notif.reminder_j1_hour');
  337 |             const h3Hours = await notifSettingInt('notif.reminder_h3_hours');
  338 |             const quietStart = await notifSettingInt('notif.sms_quiet_start');
  339 |             const quietEnd = await notifSettingInt('notif.sms_quiet_end');
  340 |             if (inQuietHours(j1Hour, quietStart, quietEnd)) {
  341 |                 throw new Error(`rappel J-1 à ${j1Hour} h dans la plage de silence ${quietStart} h - ${quietEnd} h : la fumée ne modifie pas les réglages (contrat P3), relevez notif.reminder_j1_hour`);
  342 |             }
  343 |             // Lot 7 (D81) : boîte d'E1 vidée AVANT le repère (et toute autre ligne SMS en attente du client, hors E2),
  344 |             // à l'heure réelle ; les SMS partis sont identifiés, ils ne se mêlent plus au décompte de l'étape 10
  345 |             const drainEvents = Array.from(new Set([eventId, ...(await pendingSmsEventsOf(clientUserId, clientPhone))])).filter((id) => id !== e2Id);
  346 |             const beforeDrain = new Set((await fakeSmsTo(clientPhone)).map((m) => m.ticket));
  347 |             const drainReport = await c.dispatch(new Date(), drainEvents);
  348 |             console.log(`[e2e][fumée] boîte vidée avant le repère (événements ${drainEvents.join(', ')}) : ${JSON.stringify(drainReport)}`);
  349 |             const drained = await identifySms('avant le repère (boîte de E1 vidée)', smsSince(await fakeSmsTo(clientPhone), beforeDrain), { [eventId]: 'E1', [e2Id]: 'E2' });
  350 |             expect(drained.filter((d) => d.line === null).map((d) => d.sms.ticket), 'SMS partis au vidage de la boîte de E1, tous identifiés').toEqual([]);
  351 |             smsMark = new Set((await fakeSmsTo(clientPhone)).map((m) => m.ticket));
  352 | 
  353 |             const veille = new Date(`${dakarDayFrom(e2StartAt, -1)}T${String(j1Hour).padStart(2, '0')}:00:30.000Z`);
  354 |             const scheduled = await c.schedule(veille, [e2Id]);
  355 |             console.log(`[e2e][fumée] planification à ${veille.toISOString()} : ${JSON.stringify(scheduled)}`);
  356 |             expect(scheduled.created.REMINDER_J1 ?? 0, `planification J-1 : ${JSON.stringify(scheduled)}`).toBeGreaterThan(0);
  357 |             const dispatched = await c.dispatch(new Date(veille.getTime() + 60_000), [e2Id]);
  358 |             console.log(`[e2e][fumée] envoyeur à ${new Date(veille.getTime() + 60_000).toISOString()} : ${JSON.stringify(dispatched)}`);
  359 | 
  360 |             const vapid = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
  361 |             const j1 = (await outboxOfEvent(e2Id, ['REMINDER_J1'])).filter((r) => r.recipient_user_id === clientUserId);
  362 |             // Lot 9 bis (B96, G.48, règle changée) : l'adresse du client n'est pas vérifiée, l'email est écarté pour ce motif
  363 |             // avant toute question de configuration du canal (run 119 : EMAIL_NOT_VERIFIED)
  364 |             expect(j1.map((r) => `${r.channel} ${r.status}${r.reason ? ` ${r.reason}` : ''}`).sort(), `lignes REMINDER_J1 du client : ${brief(j1)}`).toEqual([
  365 |                 'EMAIL SKIPPED EMAIL_NOT_VERIFIED',
  366 |                 'IN_APP SENT',
  367 |                 `PUSH SKIPPED ${vapid ? 'NO_PUSH_SUBSCRIPTION' : 'PUSH_NOT_CONFIGURED'}`,
  368 |                 'SMS SENT',
  369 |             ]);
  370 |             const j1Sms = j1.find((r) => r.channel === 'SMS') as OutboxLine;
  371 |             expectedJ1 = await c.renderSms('REMINDER_J1', renderData(j1Sms, e2Event));
  372 |             const received = smsSince(await fakeSmsTo(clientPhone), smsMark);
  373 |             expect(received.filter((m) => m.message === expectedJ1).length,
  374 |                 `texte J-1 exact une seule fois au faux MTarget (attendu « ${expectedJ1} ») ; reçus : ${JSON.stringify(received.map((m) => m.message))}`).toBe(1);
  375 |             const panel = await openBell(client);
  376 |             await expect(panel.getByText(/rappel : c.est demain/i).first()).toBeVisible();
  377 | 
  378 |             const h3At = new Date(e2StartAt.getTime() - h3Hours * 3600_000 + 30_000);
  379 |             const h3Scheduled = await c.schedule(h3At, [e2Id]);
  380 |             console.log(`[e2e][fumée] planification à ${h3At.toISOString()} : ${JSON.stringify(h3Scheduled)}`);
  381 |             expect(h3Scheduled.created.REMINDER_H3 ?? 0, `planification H-3 : ${JSON.stringify(h3Scheduled)}`).toBeGreaterThan(0);
  382 |             const h3 = (await outboxOfEvent(e2Id, ['REMINDER_H3'])).filter((r) => r.recipient_user_id === clientUserId);
  383 |             expect(h3.length, `lignes REMINDER_H3 du client : ${brief(h3)}`).toBeGreaterThan(0);
> 384 |             expect(h3.filter((r) => r.status !== 'PENDING'), `REMINDER_H3 en attente, rien d’envoyé : ${brief(h3)}`).toEqual([]);
      |                                                                                                                      ^ Error: REMINDER_H3 en attente, rien d’envoyé : [{"type":"REMINDER_H3","channel":"EMAIL","status":"SKIPPED","reason":"EMAIL_NOT_VERIFIED","user":"55e78c87-b935-4c41-bca4-8f661f35b0f0"},{"type":"REMINDER_H3","channel":"IN_APP","status":"PENDING","reason":null,"user":"55e78c87-b935-4c41-bca4-8f661f35b0f0"},{"type":"REMINDER_H3","channel":"PUSH","status":"PENDING","reason":null,"user":"55e78c87-b935-4c41-bca4-8f661f35b0f0"},{"type":"REMINDER_H3","channel":"SMS","status":"PENDING","reason":null,"user":"55e78c87-b935-4c41-bca4-8f661f35b0f0"}]
  385 |             const h3Sms = h3.find((r) => r.channel === 'SMS');
  386 |             expect(h3Sms, `ligne SMS du H-3 : ${brief(h3)}`).toBeTruthy();
  387 |             expectedH3 = await c.renderSms('REMINDER_H3', renderData(h3Sms as OutboxLine, e2Event));
  388 |         });
  389 | 
  390 |         await test.step('9. annulation par le partenaire : H-3 annulés, avis d’annulation par la vraie route de l’envoyeur', async () => {
  391 |             if (!clock) throw new Error('horloge simulée absente (étape 8 non aboutie)');
  392 |             const c: SimulatedClock = clock;
  393 |             const before = new Set((await fakeSmsTo(clientPhone)).map((m) => m.ticket));
  394 |             await partner.goto(`/partner/events/${e2Id}`);
  395 |             await partner.getByRole('button', { name: /annuler l[’']événement/i }).click();
  396 |             const dialog = partner.getByRole('dialog').or(partner.getByRole('alertdialog'));
  397 |             await expect(dialog).toBeVisible();
  398 |             await expect(dialog.getByText(/acheteurs à prévenir/i)).toBeVisible();
  399 |             await dialog.getByLabel(/^avis public aux participants/i).fill('Concert de fumée annulé : les billets payés en ligne sont remboursés automatiquement.');
  400 |             await dialog.getByLabel(/^motif interne/i).fill('Fumée de bout en bout du lot 6.');
  401 |             await dialog.getByLabel(/pour confirmer, saisissez le titre exact/i).fill(e2Title);
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
  412 |             expect(h3.map((r) => `${r.status} ${r.reason ?? ''}`), `REMINDER_H3 annulés dans la transaction de l’annulation : ${brief(h3)}`)
  413 |                 .toEqual(h3.map(() => 'CANCELLED EVENT_ANNULE'));
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
```