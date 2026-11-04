# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: terrain.spec.ts >> 5. vibrations : accepté [60], refusé [120,60,120,60,120], motifs distincts, aucune vibration à la lecture
- Location: e2e/terrain.spec.ts:453:5

# Error details

```
Error: accepté : exactement une vibration [60] (D50 ; plus de vibration de 80 ms à la lecture)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 6

  Array [
    Array [
-     60,
+     80,
+   ],
+   Array [
+     100,
+     50,
+     100,
    ],
  ]
```

```
Error: refusé : exactement une vibration [120,60,120,60,120] (D50)

expect(received).toEqual(expected) // deep equality

- Expected  - 5
+ Received  + 8

  Array [
    Array [
-     120,
-     60,
-     120,
-     60,
-     120,
+     80,
+   ],
+   Array [
+     100,
+     50,
+     100,
+     50,
+     100,
    ],
  ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: "{ \"name\": \"Event Village\", \"short_name\": \"EventVillage\", \"description\": \"Plateforme événementielle B2C & B2B — Événements, Ticketing, Réservations & Services au Sénégal\", \"start_url\": \"/\", \"display\": \"standalone\", \"background_color\": \"#0F0F11\", \"theme_color\": \"#FF5722\", \"icons\": [ { \"src\": \"/icon-192x192.png\", \"sizes\": \"192x192\", \"type\": \"image/png\" }, { \"src\": \"/icon-512x512.png\", \"sizes\": \"512x512\", \"type\": \"image/png\" } ] }"
```

# Test source

```ts
  381 |         // Série 1 : billets neufs, réseau normal puis 3G (mesures écrites avant toute relecture)
  382 |         for (const reseau of ['normal', '3G'] as const) {
  383 |             await setNetwork(reseau);
  384 |             for (const t of series[reseau]) {
  385 |                 const payload = await livePayload(holder, t.id);
  386 |                 used.set(t.id, payload);
  387 |                 const { record } = await presentPayload(ctl.page, payload, `${reseau} : billet neuf ${t.number}`);
  388 |                 await measureRow(ctl.page, { reseau, attendu: 'valid', ticket: t.number, record }, measured);
  389 |             }
  390 |         }
  391 |         // Série 2 : relectures « déjà utilisé », exigées (un POST et l'affichage already_used), réseau normal puis 3G
  392 |         for (const reseau of ['normal', '3G'] as const) {
  393 |             await setNetwork(reseau);
  394 |             for (const t of series[reseau].slice(0, SCAN_USED_PER_NETWORK)) {
  395 |                 const payload = freshPayload(t.id, used.get(t.id) as string);
  396 |                 const { index, record } = await presentPayload(ctl.page, payload, `${reseau} : billet déjà utilisé ${t.number}`);
  397 |                 const m = await measureRow(ctl.page, { reseau, attendu: 'already_used', ticket: t.number, record }, measured);
  398 |                 expect.soft(m.record.postAt, `${reseau} : relecture du billet déjà utilisé ${t.number} envoyée au serveur (POST) — ${await describeProbe(ctl.page, index)}`).not.toBeNull();
  399 |             }
  400 |         }
  401 |         await setNetwork('normal');
  402 |         await cdp.detach();
  403 | 
  404 |         const results = scanStats(measured);
  405 |         const ignored = measured.filter((m) => m.record.reads > 1);
  406 |         console.log(`[SCAN-MESURE] lectures ignorées par l'écran (QR relu au moins une fois avant l'envoi) : ${ignored.length} sur ${measured.length}`
  407 |             + `${ignored.length ? ` (${ignored.map((m) => `${m.reseau} ${m.ticket} : ${m.record.reads} lectures`).join(', ')})` : ''}`);
  408 |         for (const [key, st] of Object.entries(results)) {
  409 |             console.log(`[SCAN-MESURE] ${key} : n=${st.n} médiane=${fmtMs(st.med)} ms p95=${fmtMs(st.p95)} ms (min ${fmtMs(st.min)}, max ${fmtMs(st.max)})`);
  410 |         }
  411 |         await testInfo.attach('scan.tsv', { path: fileSummary, contentType: 'text/tab-separated-values' });
  412 |         const probe3g = results['3G:sonde:resultat'];
  413 |         if (probe3g.med !== null && probe3g.med < NET_3G.latency) {
  414 |             console.log(`[SCAN-MESURE] AVERTISSEMENT : médiane 3G résultat − lecture (sonde) ${fmtMs(probe3g.med)} ms < latence simulée ${NET_3G.latency} ms : bridage CDP peut-être non appliqué`);
  415 |         }
  416 |         for (const key of ['normal:marques:attente', 'normal:marques:resultat', '3G:marques:attente', '3G:marques:resultat']) {
  417 |             console.log(`[SCAN-MESURE] AVERTISSEMENT (non bloquant) ${key} p95=${fmtMs(results[key].p95)} ms`);
  418 |         }
  419 | 
  420 |         // Hors ligne : une lecture → état « Hors ligne », aucune vibration (D47)
  421 |         await ctl.context.setOffline(true);
  422 |         ctl.guard.freeze();
  423 |         // Billet 1 composté : code calculé (la route live-code le refuse) ; aucun envoi attendu hors ligne
  424 |         const offline = await presentPayloadNoResult(ctl.page, computedPayload(ev.tickets[0].id).payload, 'lecture hors ligne');
  425 |         await expect.soft(ctl.page.locator('[data-scan-state="offline"]').first(), 'lecture hors ligne : état data-scan-state="offline"').toBeAttached({ timeout: 10_000 });
  426 |         const offlineVibrations = (await probeVibrations(ctl.page)).filter((v) => offline.record.readAt !== null && v.at >= offline.record.readAt);
  427 |         expect.soft(offlineVibrations.map((v) => v.pattern), 'aucune vibration pour un incident technique (hors ligne)').toEqual([]);
  428 |         await ctl.context.setOffline(false);
  429 | 
  430 |         // Assertions (après l'écriture des mesures, pour que le run « avant » les produise)
  431 |         for (const m of measured) {
  432 |             expect.soft(m.record.result, `${m.reseau} billet ${m.ticket} : résultat affiché`).toBe(m.attendu);
  433 |         }
  434 |         for (const reseau of ['normal', '3G'] as const) {
  435 |             const expected = measured.filter((m) => m.reseau === reseau).length;
  436 |             for (const mesure of ['attente', 'resultat'] as const) {
  437 |                 expect.soft(results[`${reseau}:marques:${mesure}`].n,
  438 |                     `${reseau} : marques performance.mark('ev-scan:read' et 'ev-scan:${mesure === 'attente' ? 'pending' : 'result'}') pour chacune des ${expected} lectures (contrat 6.1, cas 5)`).toBe(expected);
  439 |             }
  440 |             const att = results[`${reseau}:marques:attente`].med;
  441 |             expect.soft(att !== null && att <= 300, `${reseau} : médiane attente − lecture ≤ 300 ms (mesurée : ${fmtMs(att)} ms)`).toBe(true);
  442 |         }
  443 |         const res = results['normal:marques:resultat'].med;
  444 |         expect.soft(res !== null && res <= 1_000, `réseau normal : médiane résultat − lecture ≤ 1 000 ms (mesurée : ${fmtMs(res)} ms)`).toBe(true);
  445 |     } finally {
  446 |         await s.close();
  447 |         restoreTerrainSetting(ev);
  448 |     }
  449 | });
  450 | 
  451 | // ── 5. Vibrations distinctes ───────────────────────────────────────────────
  452 | 
  453 | test('5. vibrations : accepté [60], refusé [120,60,120,60,120], motifs distincts, aucune vibration à la lecture', async ({ browser }, testInfo) => {
  454 |     test.setTimeout(4 * 60_000);
  455 |     const s = new Session(browser, testInfo);
  456 |     let ev: TerrainEvent | null = null;
  457 |     try {
  458 |         ev = prepareTerrainEvent('vibrations', 'client-bis', 2);
  459 |         const holder = await s.holder('fumee-client-bis');
  460 |         const ctl = await s.open('fumee-controleur', { probe: true });
  461 |         await openScanner(ctl.page, ev.title);
  462 | 
  463 |         const accepted = await scanAndExpect(ctl.page, await livePayload(holder, ev.tickets[0].id), 'billet valide', 'valid');
  464 |         await expect.poll(async () => (await probeVibrations(ctl.page)).filter((v) => v.at >= (accepted.readAt as number)).length,
  465 |             { message: 'au moins une vibration pour l’entrée acceptée', timeout: 5_000 }).toBeGreaterThan(0);
  466 |         await ctl.page.waitForTimeout(300); // une vibration posée par un effet après l'affichage est aussi relevée
  467 |         // Fenêtre de l'accepté relevée AVANT de présenter le code falsifié (de sa première lecture à maintenant) :
  468 |         // l'assertion D50 de l'accepté est jugée même si la lecture suivante échoue
  469 |         const acceptWindow = (await probeVibrations(ctl.page)).filter((v) => v.at >= (accepted.readAt as number)).map((v) => v.pattern);
  470 |         console.log(`[e2e][terrain] vibrations reçues pour l'accepté (lectures : ${accepted.reads}) : ${JSON.stringify(acceptWindow)}`);
  471 |         expect.soft(acceptWindow, 'accepté : exactement une vibration [60] (D50 ; plus de vibration de 80 ms à la lecture)').toEqual([VIBRATION_ACCEPTE]);
  472 | 
  473 |         const refusedPayload = forgedPayload(await livePayload(holder, ev.tickets[1].id));
  474 |         const { index: refusedIndex, record: refused } = await presentPayload(ctl.page, refusedPayload, 'code qui ne se vérifie pas');
  475 |         expect(REFUS.has(String(refused.result)), `code falsifié : résultat de refus attendu, obtenu « ${refused.result ?? '—'} » — ${await describeProbe(ctl.page, refusedIndex)}`).toBe(true);
  476 |         await expect.poll(async () => (await probeVibrations(ctl.page)).filter((v) => v.at >= (refused.readAt as number)).length,
  477 |             { message: 'une vibration pour le refus', timeout: 5_000 }).toBeGreaterThan(0);
  478 | 
  479 |         const refuseWindow = (await probeVibrations(ctl.page)).filter((v) => v.at >= (refused.readAt as number)).map((v) => v.pattern);
  480 |         console.log(`[e2e][terrain] vibrations reçues pour le refus (lectures : ${refused.reads}) : ${JSON.stringify(refuseWindow)}`);
> 481 |         expect(refuseWindow, 'refusé : exactement une vibration [120,60,120,60,120] (D50)').toEqual([VIBRATION_REFUS]);
      |                                                                                             ^ Error: refusé : exactement une vibration [120,60,120,60,120] (D50)
  482 |         expect(JSON.stringify(acceptWindow)).not.toBe(JSON.stringify(refuseWindow));
  483 |     } finally {
  484 |         await s.close();
  485 |         restoreTerrainSetting(ev);
  486 |     }
  487 | });
  488 | 
  489 | // ── 6. Caméra libérée en arrière-plan ──────────────────────────────────────
  490 | 
  491 | test('6. onglet en arrière-plan : pistes de la caméra arrêtées', async ({ browser }, testInfo) => {
  492 |     test.setTimeout(3 * 60_000);
  493 |     const s = new Session(browser, testInfo);
  494 |     let ev: TerrainEvent | null = null;
  495 |     try {
  496 |         ev = prepareTerrainEvent('camera en arriere-plan', 'client-bis', 1);
  497 |         const ctl = await s.open('fumee-controleur', { probe: true });
  498 |         await openScanner(ctl.page, ev.title);
  499 |         const live = (await probeTracks(ctl.page)).filter((t) => t.kind === 'video' && t.readyState === 'live');
  500 |         expect(live.length, 'caméra simulée en marche avant le passage en arrière-plan').toBeGreaterThan(0);
  501 | 
  502 |         await ctl.page.evaluate(() => {
  503 |             Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  504 |             Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  505 |             document.dispatchEvent(new Event('visibilitychange'));
  506 |         });
  507 |         await expect.poll(async () => (await probeTracks(ctl.page)).filter((t) => t.kind === 'video' && t.readyState !== 'ended').length, {
  508 |             message: 'pistes vidéo encore actives après visibilitychange (hidden) : la caméra doit être libérée (D48)', timeout: 10_000,
  509 |         }).toBe(0);
  510 |     } finally {
  511 |         await s.close();
  512 |         restoreTerrainSetting(ev);
  513 |     }
  514 | });
  515 | 
```