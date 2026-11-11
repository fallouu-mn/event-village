# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: perf.spec.ts >> Mes billets : premier affichage utile et JavaScript chargé, 4G simulée et processeur ×4 (5 passages)
- Location: e2e/perf.spec.ts:374:9

# Error details

```
Error: mes-billets passage 1 : mesure complète

expect(received).toBeNull()

Received: "marqueur d'affichage utile introuvable en 90 s (sélecteurs : article[aria-label^=\"Billet pour\"] | main .border-dashed) : page.waitForFunction: Timeout 90000ms exceeded."
```

```
Error: mes-billets passage 2 : mesure complète

expect(received).toBeNull()

Received: "marqueur d'affichage utile introuvable en 90 s (sélecteurs : article[aria-label^=\"Billet pour\"] | main .border-dashed) : page.waitForFunction: Timeout 90000ms exceeded."
```

```
Error: mes-billets passage 3 : mesure complète

expect(received).toBeNull()

Received: "marqueur d'affichage utile introuvable en 90 s (sélecteurs : article[aria-label^=\"Billet pour\"] | main .border-dashed) : page.waitForFunction: Timeout 90000ms exceeded."
```

```
Error: mes-billets passage 4 : mesure complète

expect(received).toBeNull()

Received: "marqueur d'affichage utile introuvable en 90 s (sélecteurs : article[aria-label^=\"Billet pour\"] | main .border-dashed) : page.waitForFunction: Timeout 90000ms exceeded."
```

```
Error: mes-billets passage 5 : mesure complète

expect(received).toBeNull()

Received: "marqueur d'affichage utile introuvable en 90 s (sélecteurs : article[aria-label^=\"Billet pour\"] | main .border-dashed) : page.waitForFunction: Timeout 90000ms exceeded."
```

```
Error: mes-billets : JavaScript (a) maximal — au-dessus du budget /tickets 241,0 Ko + 20,0 Ko

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  324 |         if (state.fcp === null || state.lcp === null) {
  325 |             console.log(`[PERF] ${screen.id} passage ${pass} : à l'apparition du marqueur, FCP ${fmtMs(state.fcp)} ms et LCP ${fmtMs(state.lcp)} ms ; `
  326 |                 + `à + 3 s : FCP ${fmtMs(out.fcp)} ms, LCP ${fmtMs(out.lcp)} ms${out.note ? ` — ${out.note}` : ''}`);
  327 |         }
  328 |         const later = await snapshot(page, state.useful);
  329 |         out.js3s = later.js;
  330 |         out.css = later.css;
  331 |         out.total = later.total;
  332 |         out.jsNetwork = (await Promise.all(networkSizes)).reduce((a, b) => a + b, 0);
  333 |         if (later.biggest) out.biggest = { ...later.biggest, minMs: (later.biggest.bytes / NET_4G.downloadThroughput) * 1000 };
  334 | 
  335 |         if (screen.camera) {
  336 |             const start = page.getByRole('button', { name: /commencer le contr[ôo]le/i });
  337 |             if (await start.count() > 0 && await start.first().isVisible()) await start.first().click();
  338 |             const handle = await page.waitForFunction(
  339 |                 () => (Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2) ? performance.now() : false),
  340 |                 null, { timeout: 60_000 },
  341 |             ).catch((err: unknown) => {
  342 |                 throw new Error(`caméra simulée jamais en lecture en 60 s : ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
  343 |             });
  344 |             out.cameraMs = Number(await handle.jsonValue());
  345 |             await page.waitForTimeout(3_000);
  346 |             out.jsCamera = (await snapshot(page, null)).js;
  347 |         }
  348 |     } catch (err) {
  349 |         out.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  350 |     } finally {
  351 |         await context.close();
  352 |     }
  353 |     return out;
  354 | }
  355 | 
  356 | const TSV_HEADER = 'ecran\tpassage\tfcp_ms\tlcp_ms\tutile_ms\tmarqueur\tjs_avant_utile_o\tjs_3s_o\tcss_o\ttotal_o\tjs_reseau_o\tcamera_ms\tjs_camera_o\tplus_gros_fichier\tfichier_o\tfichier_ms\tfichier_min_ms\terreur\tnote_fcp_lcp';
  357 | 
  358 | function num(v: number | null): string {
  359 |     return v === null ? '' : String(Math.round(v));
  360 | }
  361 | 
  362 | function row(screen: Screen, label: string, r: Omit<PassResult, 'pass'>): string {
  363 |     return [screen.id, label, num(r.fcp), num(r.lcp), num(r.useful), r.usefulBy ?? '', num(r.jsBeforeUseful), num(r.js3s), num(r.css), num(r.total),
  364 |         num(r.jsNetwork), num(r.cameraMs), num(r.jsCamera), r.biggest?.name ?? '', num(r.biggest?.bytes ?? null), num(r.biggest?.ms ?? null),
  365 |         num(r.biggest?.minMs ?? null), r.error ?? '', (r.note ?? '').replace(/\s+/g, ' ')].join('\t');
  366 | }
  367 | 
  368 | function aggregate(results: PassResult[], pick: (r: PassResult) => number | null): { med: number | null; max: number | null } {
  369 |     const values = results.map(pick).filter((v): v is number => v !== null);
  370 |     return { med: median(values), max: values.length ? Math.max(...values) : null };
  371 | }
  372 | 
  373 | for (const screen of SCREENS) {
  374 |     test(`${screen.libelle} : premier affichage utile et JavaScript chargé, 4G simulée et processeur ×4 (5 passages)`, async ({ browser }, testInfo) => {
  375 |         test.setTimeout(10 * 60_000);
  376 |         const budgets = readBudgets();
  377 |         const results: PassResult[] = [];
  378 |         for (let pass = 1; pass <= PASSES; pass++) {
  379 |             const r = await onePass(browser, testInfo, screen, pass);
  380 |             results.push(r);
  381 |             appendPerfFile('perf.tsv', TSV_HEADER, [row(screen, String(pass), r)]);
  382 |             console.log(`[PERF] ${screen.id} passage ${pass} : ${r.error ? `ÉCHEC ${r.error}` : `FCP ${fmtMs(r.fcp)} ms, LCP ${fmtMs(r.lcp)} ms, utile ${fmtMs(r.useful)} ms (${r.usefulBy}), JS (a) ${r.jsBeforeUseful} o, JS (b) ${r.js3s} o, CSS ${r.css} o, total ${r.total} o${screen.camera ? `, caméra ${fmtMs(r.cameraMs)} ms, JS caméra ${r.jsCamera} o` : ''}`}`);
  383 |         }
  384 |         const keys: Array<[keyof Omit<PassResult, 'pass' | 'usefulBy' | 'biggest' | 'error' | 'note'>, string]> = [
  385 |             ['fcp', 'fcp'], ['lcp', 'lcp'], ['useful', 'utile'], ['jsBeforeUseful', 'js (a)'], ['js3s', 'js (b)'], ['css', 'css'], ['total', 'total'],
  386 |             ['jsNetwork', 'js réseau'], ['cameraMs', 'caméra'], ['jsCamera', 'js caméra'],
  387 |         ];
  388 |         const med: Omit<PassResult, 'pass'> = { fcp: null, lcp: null, note: null, useful: null, usefulBy: null, jsBeforeUseful: null, js3s: null, css: null, total: null, jsNetwork: null, cameraMs: null, jsCamera: null, biggest: null, error: null };
  389 |         const max: Omit<PassResult, 'pass'> = { ...med };
  390 |         for (const [k] of keys) {
  391 |             const a = aggregate(results, (r) => r[k]);
  392 |             med[k] = a.med;
  393 |             max[k] = a.max;
  394 |         }
  395 |         appendPerfFile('perf.tsv', TSV_HEADER, [row(screen, 'mediane', med), row(screen, 'max', max)]);
  396 |         const ko = (v: number | null) => (v === null ? '—' : `${(v / 1000).toFixed(1).replace('.', ',')} Ko`);
  397 |         const budget = Object.prototype.hasOwnProperty.call(budgets, screen.budgetRoute) ? budgets[screen.budgetRoute] : null;
  398 |         const lines = [
  399 |             `${screen.libelle} (${screen.path()}, ${screen.role}) — ${PASSES} passages, ${NET_4G.nom}, processeur ×4`,
  400 |             `  premier affichage utile : médiane ${fmtMs(med.useful)} ms, max ${fmtMs(max.useful)} ms ; FCP médiane ${fmtMs(med.fcp)} ms ; LCP médiane ${fmtMs(med.lcp)} ms, max ${fmtMs(max.lcp)} ms`,
  401 |             `  JavaScript (a) avant le marqueur : médiane ${ko(med.jsBeforeUseful)}, max ${ko(max.jsBeforeUseful)} ; (b) à + 3 s : médiane ${ko(med.js3s)} ; CSS ${ko(med.css)} ; total ${ko(med.total)} ; recoupement réseau ${ko(med.jsNetwork)}`,
  402 |             ...(screen.camera ? [`  caméra en lecture : médiane ${fmtMs(med.cameraMs)} ms ; JavaScript à + 3 s caméra lancée : médiane ${ko(med.jsCamera)}, max ${ko(max.jsCamera)}`] : []),
  403 |             ...results.filter((r) => r.note).map((r) => `  passage ${r.pass} : ${r.note}`),
  404 |             `  budget post-build ${screen.budgetRoute} : ${budget === null ? 'aucun (mesure seule)' : `${ko(budget)} + ${ko(BUDGET_TOLERANCE)} de tolérance`}`,
  405 |         ];
  406 |         appendPerfFile('perf.txt', null, lines);
  407 |         console.log(lines.map((l) => `[PERF] ${l}`).join('\n'));
  408 |         if (med.useful !== null && med.useful > 3_000) console.log(`[PERF-AVERTISSEMENT] ${screen.id} : premier affichage utile médian ${fmtMs(med.useful)} ms > 3 000 ms`);
  409 |         if (med.lcp !== null && med.lcp > 4_000) console.log(`[PERF-AVERTISSEMENT] ${screen.id} : LCP médian ${fmtMs(med.lcp)} ms > 4 000 ms`);
  410 | 
  411 |         // Bloquant : chaque passage a abouti, avec un bridage effectivement appliqué
  412 |         for (const r of results) {
  413 |             expect.soft(r.error, `${screen.id} passage ${r.pass} : mesure complète`).toBeNull();
  414 |             if (r.error) continue;
  415 |             expect.soft(r.jsBeforeUseful ?? 0, `${screen.id} passage ${r.pass} : du JavaScript /_next/static/ arrivé avant le marqueur`).toBeGreaterThan(0);
  416 |             expect.soft(r.biggest, `${screen.id} passage ${r.pass} : au moins un fichier /_next/static/ mesuré`).not.toBeNull();
  417 |             if (r.biggest) {
  418 |                 expect.soft(r.biggest.ms >= r.biggest.minMs,
  419 |                     `${screen.id} passage ${r.pass} : bridage non appliqué (${r.biggest.name}, ${r.biggest.bytes} o en ${Math.round(r.biggest.ms)} ms < ${Math.round(r.biggest.minMs)} ms au débit simulé)`).toBe(true);
  420 |             }
  421 |         }
  422 |         if (budget !== null) {
  423 |             expect.soft((max.jsBeforeUseful ?? Number.POSITIVE_INFINITY) <= budget + BUDGET_TOLERANCE,
> 424 |                 `${screen.id} : JavaScript (a) maximal ${ko(max.jsBeforeUseful)} au-dessus du budget ${screen.budgetRoute} ${ko(budget)} + ${ko(BUDGET_TOLERANCE)}`).toBe(true);
      |                                                                                                                                                                      ^ Error: mes-billets : JavaScript (a) maximal — au-dessus du budget /tickets 241,0 Ko + 20,0 Ko
  425 |         }
  426 |     });
  427 | }
  428 | 
```