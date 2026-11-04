# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: terrain.spec.ts >> 5. vibrations : accepté [60], refusé [120,60,120,60,120], motifs distincts, aucune vibration à la lecture
- Location: e2e/terrain.spec.ts:403:5

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
Error: code qui ne se vérifie pas : aucun résultat de scan affiché ([data-scan-result]) après la lecture (45 s) — sonde : readAt +2014 ms, lectures 18, dernière lecture +44763 ms, POST —, pendingAt —, résultat — « — », retiré — ; POST /api/controller/scan depuis la présentation : aucun ; écran : en veille non, vidéo en lecture oui, data-scan-result [], data-scan-state [] ; vibrations [[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80]]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]: "{ \"name\": \"Event Village\", \"short_name\": \"EventVillage\", \"description\": \"Plateforme événementielle B2C & B2B — Événements, Ticketing, Réservations & Services au Sénégal\", \"start_url\": \"/\", \"display\": \"standalone\", \"background_color\": \"#0F0F11\", \"theme_color\": \"#FF5722\", \"icons\": [ { \"src\": \"/icon-192x192.png\", \"sizes\": \"192x192\", \"type\": \"image/png\" }, { \"src\": \"/icon-512x512.png\", \"sizes\": \"512x512\", \"type\": \"image/png\" } ] }"
```

# Test source

```ts
  295 |     w.BarcodeDetector = ProbeBarcodeDetector;
  296 | 
  297 |     w.__evScanProbe = {
  298 |         records,
  299 |         vibrations,
  300 |         posts,
  301 |         /**
  302 |          * Présente un QR. hold = true : rendu à chaque appel de detect() jusqu'au premier POST du scan ou au
  303 |          * premier résultat (QR tenu devant la caméra) ; hold = false : rendu une seule fois.
  304 |          */
  305 |         present(payload: string, hold: boolean): number {
  306 |             if (armed) withdraw(armed);
  307 |             const r: ProbeRecord = {
  308 |                 payload, hold, armedAt: performance.now(), readAt: null, lastReadAt: null, reads: 0, postAt: null,
  309 |                 pendingAt: null, resultAt: null, result: null, withdrawnAt: null,
  310 |             };
  311 |             records.push(r);
  312 |             armed = r;
  313 |             return records.length - 1;
  314 |         },
  315 |         withdraw(index: number): void {
  316 |             const r = records[index];
  317 |             if (r) withdraw(r);
  318 |         },
  319 |         state(): { asleep: boolean; videoPlaying: boolean; results: string[]; scanStates: string[] } {
  320 |             const text = (document.body?.innerText ?? '').toLowerCase();
  321 |             return {
  322 |                 asleep: text.includes('en veille'),
  323 |                 videoPlaying: Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2 && !v.paused),
  324 |                 results: Array.from(document.querySelectorAll('[data-scan-result]')).map((el) => el.getAttribute('data-scan-result') ?? ''),
  325 |                 scanStates: Array.from(document.querySelectorAll('[data-scan-state]')).map((el) => el.getAttribute('data-scan-state') ?? ''),
  326 |             };
  327 |         },
  328 |         tracks(): Array<{ kind: string; readyState: string }> {
  329 |             return streams.flatMap((s) => s.getTracks().map((t) => ({ kind: t.kind, readyState: t.readyState })));
  330 |         },
  331 |     };
  332 | }
  333 | 
  334 | interface ProbeHandle {
  335 |     records: ProbeRecord[];
  336 |     vibrations: ProbeVibration[];
  337 |     posts: ProbePost[];
  338 |     present(payload: string, hold: boolean): number;
  339 |     withdraw(index: number): void;
  340 |     state(): { asleep: boolean; videoPlaying: boolean; results: string[]; scanStates: string[] };
  341 |     tracks(): Array<{ kind: string; readyState: string }>;
  342 | }
  343 | 
  344 | async function presentOnPage(page: Page, payload: string, hold: boolean): Promise<number> {
  345 |     return page.evaluate(({ p, h }) => {
  346 |         const probe = (window as unknown as { __evScanProbe?: ProbeHandle }).__evScanProbe;
  347 |         if (!probe) throw new Error('sonde du scanner absente de la page (installScanProbe)');
  348 |         return probe.present(p, h);
  349 |     }, { p: payload, h: hold });
  350 | }
  351 | 
  352 | function ms(v: number | null, origin: number): string {
  353 |     return v === null ? '—' : `+${Math.round(v - origin)} ms`;
  354 | }
  355 | 
  356 | /**
  357 |  * Diagnostic d'une lecture (messages d'échec) : heures relatives à la présentation du QR, POST du scan
  358 |  * observés depuis la présentation (statut, erreur, début de la réponse), état de l'écran et vibrations.
  359 |  */
  360 | export async function describeProbe(page: Page, index: number): Promise<string> {
  361 |     const d = await page.evaluate((i) => {
  362 |         const probe = (window as unknown as { __evScanProbe?: ProbeHandle }).__evScanProbe;
  363 |         if (!probe) return null;
  364 |         const r = probe.records[i];
  365 |         if (!r) return null;
  366 |         return {
  367 |             record: { ...r },
  368 |             posts: probe.posts.filter((p) => p.at >= r.armedAt).map((p) => ({ ...p })),
  369 |             vibrations: probe.vibrations.filter((v) => v.at >= r.armedAt).map((v) => ({ at: v.at, pattern: [...v.pattern] })),
  370 |             state: probe.state(),
  371 |         };
  372 |     }, index);
  373 |     if (!d) return 'sonde du scanner absente de la page (rechargée ?)';
  374 |     const r = d.record;
  375 |     const o = r.armedAt;
  376 |     const posts = d.posts.length === 0 ? 'aucun'
  377 |         : d.posts.map((p) => `[${ms(p.at, o)} lecture ${p.record}${p.payloadInBody ? ' (payload présenté)' : ''} → ${p.status ?? (p.error ? `erreur ${p.error}` : 'sans réponse')}${p.doneAt !== null ? ` à ${ms(p.doneAt, o)}` : ''}${p.response ? ` ${p.response.replace(/\s+/g, ' ').slice(0, 160)}` : ''}]`).join(' ');
  378 |     return `sonde : readAt ${ms(r.readAt, o)}, lectures ${r.reads}, dernière lecture ${ms(r.lastReadAt, o)}, POST ${ms(r.postAt, o)}, `
  379 |         + `pendingAt ${ms(r.pendingAt, o)}, résultat ${ms(r.resultAt, o)} « ${r.result ?? '—'} », retiré ${ms(r.withdrawnAt, o)} ; `
  380 |         + `POST /api/controller/scan depuis la présentation : ${posts} ; `
  381 |         + `écran : en veille ${d.state.asleep ? 'oui' : 'non'}, vidéo en lecture ${d.state.videoPlaying ? 'oui' : 'non'}, `
  382 |         + `data-scan-result ${JSON.stringify(d.state.results)}, data-scan-state ${JSON.stringify(d.state.scanStates)} ; `
  383 |         + `vibrations ${JSON.stringify(d.vibrations.map((v) => v.pattern))}`;
  384 | }
  385 | 
  386 | /** Attend qu'un champ de la lecture soit renseigné ; sinon échec avec le diagnostic complet de la sonde. */
  387 | async function waitProbe(page: Page, index: number, field: 'readAt' | 'resultAt', timeoutMs: number, failure: string): Promise<ProbeRecord> {
  388 |     const deadline = Date.now() + timeoutMs;
  389 |     for (;;) {
  390 |         const r = await probeRecord(page, index);
  391 |         if (r[field] !== null) return r;
  392 |         if (Date.now() > deadline) {
  393 |             const detail = await describeProbe(page, index);
  394 |             await page.evaluate((i) => (window as unknown as { __evScanProbe?: ProbeHandle }).__evScanProbe?.withdraw(i), index);
> 395 |             throw new Error(`${failure} (${Math.round(timeoutMs / 1000)} s) — ${detail}`);
      |                   ^ Error: code qui ne se vérifie pas : aucun résultat de scan affiché ([data-scan-result]) après la lecture (45 s) — sonde : readAt +2014 ms, lectures 18, dernière lecture +44763 ms, POST —, pendingAt —, résultat — « — », retiré — ; POST /api/controller/scan depuis la présentation : aucun ; écran : en veille non, vidéo en lecture oui, data-scan-result [], data-scan-state [] ; vibrations [[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80]]
  396 |         }
  397 |         await page.waitForTimeout(200);
  398 |     }
  399 | }
  400 | 
  401 | /**
  402 |  * Présente un payload au scanner (QR tenu jusqu'à l'envoi de la lecture ou au résultat) et attend sa lecture
  403 |  * puis le changement de résultat (sonde). En cas d'échec, le message donne readAt, les lectures, les POST
  404 |  * du scan observés et l'état de l'écran.
  405 |  */
  406 | export async function presentPayload(page: Page, payload: string, what: string, timeoutMs = 45_000): Promise<{ index: number; record: ProbeRecord }> {
  407 |     const index = await presentOnPage(page, payload, true);
  408 |     await waitProbe(page, index, 'readAt', timeoutMs, `${what} : le scanner n'a pas lu le QR présenté (caméra en pause, en veille, ou détection arrêtée)`);
  409 |     const record = await waitProbe(page, index, 'resultAt', timeoutMs, `${what} : aucun résultat de scan affiché ([data-scan-result]) après la lecture`);
  410 |     return { index, record };
  411 | }
  412 | 
  413 | /** Présente un payload une seule fois, sans attendre de résultat (lecture hors ligne : écran technique attendu). */
  414 | export async function presentPayloadNoResult(page: Page, payload: string, what: string): Promise<{ index: number; record: ProbeRecord }> {
  415 |     const index = await presentOnPage(page, payload, false);
  416 |     const record = await waitProbe(page, index, 'readAt', 30_000, `${what} : le scanner n'a pas lu le QR présenté`);
  417 |     return { index, record };
  418 | }
  419 | 
  420 | export async function probeRecord(page: Page, index: number): Promise<ProbeRecord> {
  421 |     return page.evaluate((i) => {
  422 |         const probe = (window as unknown as { __evScanProbe?: ProbeHandle }).__evScanProbe;
  423 |         if (!probe) throw new Error('sonde du scanner absente de la page');
  424 |         const r = probe.records[i];
  425 |         if (!r) throw new Error(`lecture ${i} inconnue de la sonde`);
  426 |         return { ...r };
  427 |     }, index);
  428 | }
  429 | 
  430 | export async function probeVibrations(page: Page): Promise<ProbeVibration[]> {
  431 |     return page.evaluate(() => {
  432 |         const probe = (window as unknown as { __evScanProbe?: ProbeHandle }).__evScanProbe;
  433 |         if (!probe) throw new Error('sonde du scanner absente de la page');
  434 |         return probe.vibrations.map((v) => ({ at: v.at, pattern: [...v.pattern] }));
  435 |     });
  436 | }
  437 | 
  438 | export async function probeTracks(page: Page): Promise<Array<{ kind: string; readyState: string }>> {
  439 |     return page.evaluate(() => {
  440 |         const probe = (window as unknown as { __evScanProbe?: ProbeHandle }).__evScanProbe;
  441 |         if (!probe) throw new Error('sonde du scanner absente de la page');
  442 |         return probe.tracks();
  443 |     });
  444 | }
  445 | 
  446 | /** Marques de l'application (`performance.mark('ev-scan:read'|'ev-scan:pending'|'ev-scan:result')`). */
  447 | export async function scanMarks(page: Page): Promise<Array<{ name: string; startTime: number }>> {
  448 |     return page.evaluate(() => performance.getEntriesByType('mark')
  449 |         .filter((m) => m.name.startsWith('ev-scan:'))
  450 |         .map((m) => ({ name: m.name, startTime: m.startTime })));
  451 | }
  452 | 
  453 | // ── Écran du contrôleur ────────────────────────────────────────────────────
  454 | 
  455 | function escapeRe(s: string): string {
  456 |     return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  457 | }
  458 | 
  459 | /**
  460 |  * Ouvre /controller/scanner, choisit l'événement (sélecteur d'événement de l'écran du lot 6, ou écran
  461 |  * « Commencer le contrôle » du lot 7, D49), passe en mode caméra et attend un flux vidéo en lecture.
  462 |  */
  463 | export async function openScanner(page: Page, eventTitle: string): Promise<void> {
  464 |     await page.goto('/controller/scanner');
  465 |     const titleRe = new RegExp(escapeRe(eventTitle));
  466 |     const select = page.locator('select').filter({ has: page.locator('option', { hasText: eventTitle }) });
  467 |     const radio = page.getByRole('radio', { name: titleRe });
  468 |     const eventButton = page.getByRole('button', { name: titleRe });
  469 |     const start = page.getByRole('button', { name: /commencer le contr[ôo]le/i });
  470 |     const heading = page.getByRole('heading', { name: titleRe });
  471 |     await expect(select.or(radio).or(eventButton).or(start).or(heading).first(),
  472 |         `scanner : l'événement « ${eventTitle} » n'est proposé ni dans le sélecteur ni sur l'écran de départ`).toBeVisible({ timeout: 45_000 });
  473 |     const usesSelect = await select.count() > 0;
  474 |     if (usesSelect) {
  475 |         const value = await select.first().locator('option', { hasText: eventTitle }).first().getAttribute('value');
  476 |         expect(value, `option de l'événement « ${eventTitle} »`).toBeTruthy();
  477 |         await select.first().selectOption(value as string);
  478 |         await expect(select.first(), `scanner : événement « ${eventTitle} » sélectionné`).toHaveValue(value as string);
  479 |     } else if (await radio.count() > 0) {
  480 |         await radio.first().check();
  481 |     } else if (await eventButton.count() > 0 && !(await heading.count())) {
  482 |         await eventButton.first().click();
  483 |     }
  484 |     if (await start.count() > 0 && await start.first().isVisible()) await start.first().click();
  485 |     const camera = page.getByRole('button', { name: /^caméra$/i });
  486 |     if (await camera.count() > 0 && (await camera.first().getAttribute('aria-pressed')) !== 'true') await camera.first().click();
  487 |     if (!usesSelect) {
  488 |         await expect(page.getByText(eventTitle).filter({ visible: true }).first(), `scanner : événement « ${eventTitle} » affiché`).toBeVisible();
  489 |     }
  490 |     await page.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2), null, { timeout: 30_000 })
  491 |         .catch((err: unknown) => {
  492 |             throw new Error(`scanner : aucun flux vidéo en lecture après le choix de l'événement (${err instanceof Error ? err.message.split('\n')[0] : String(err)})`);
  493 |         });
  494 | }
  495 | 
```