# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: perf.spec.ts >> Mes billets : premier affichage utile et JavaScript chargé, 4G simulée et processeur ×4 (5 passages)
- Location: e2e/perf.spec.ts:391:9

# Error details

```
Error: mes-billets passage 1 : du JavaScript /_next/static/ arrivé avant le marqueur

expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

```
Error: mes-billets passage 2 : du JavaScript /_next/static/ arrivé avant le marqueur

expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

```
Error: mes-billets passage 3 : du JavaScript /_next/static/ arrivé avant le marqueur

expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

```
Error: mes-billets passage 4 : du JavaScript /_next/static/ arrivé avant le marqueur

expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

```
Error: mes-billets passage 5 : du JavaScript /_next/static/ arrivé avant le marqueur

expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

# Test source

```ts
  332 |             .sort((a, b) => a.end - b.end)
  333 |             .map((x) => [screen.id, String(pass), x.path, String(x.bytes), String(Math.round(x.start)), String(Math.round(x.end))].join('\t')));
  334 |         await page.waitForTimeout(3_000); // (b) : JavaScript chargé à + 3 s (contrat 11.6)
  335 |         // FCP et LCP relus ici, toujours avant toute interaction (run 72 : scanner sans FCP ni LCP sur les 5
  336 |         // passages quand ils n'étaient lus qu'à l'apparition du marqueur) ; repli FCP sur la chronologie
  337 |         const paint = await readPaint(page);
  338 |         out.fcp = paint.state.fcp ?? paint.fcpTimeline ?? out.fcp;
  339 |         out.lcp = paint.state.lcp ?? out.lcp;
  340 |         out.note = paintNote(paint, out.fcp, out.lcp);
  341 |         if (state.fcp === null || state.lcp === null) {
  342 |             console.log(`[PERF] ${screen.id} passage ${pass} : à l'apparition du marqueur, FCP ${fmtMs(state.fcp)} ms et LCP ${fmtMs(state.lcp)} ms ; `
  343 |                 + `à + 3 s : FCP ${fmtMs(out.fcp)} ms, LCP ${fmtMs(out.lcp)} ms${out.note ? ` — ${out.note}` : ''}`);
  344 |         }
  345 |         const later = await snapshot(page, state.useful);
  346 |         out.js3s = later.js;
  347 |         out.css = later.css;
  348 |         out.total = later.total;
  349 |         out.jsNetwork = (await Promise.all(networkSizes)).reduce((a, b) => a + b, 0);
  350 |         if (later.biggest) out.biggest = { ...later.biggest, minMs: (later.biggest.bytes / NET_4G.downloadThroughput) * 1000 };
  351 | 
  352 |         if (screen.camera) {
  353 |             const start = page.getByRole('button', { name: /commencer le contr[ôo]le/i });
  354 |             if (await start.count() > 0 && await start.first().isVisible()) await start.first().click();
  355 |             const handle = await page.waitForFunction(
  356 |                 () => (Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2) ? performance.now() : false),
  357 |                 null, { timeout: 60_000 },
  358 |             ).catch((err: unknown) => {
  359 |                 throw new Error(`caméra simulée jamais en lecture en 60 s : ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
  360 |             });
  361 |             out.cameraMs = Number(await handle.jsonValue());
  362 |             await page.waitForTimeout(3_000);
  363 |             out.jsCamera = (await snapshot(page, null)).js;
  364 |         }
  365 |     } catch (err) {
  366 |         out.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  367 |     } finally {
  368 |         await context.close();
  369 |     }
  370 |     return out;
  371 | }
  372 | 
  373 | const TSV_HEADER = 'ecran\tpassage\tfcp_ms\tlcp_ms\tutile_ms\tmarqueur\tjs_avant_utile_o\tjs_3s_o\tcss_o\ttotal_o\tjs_reseau_o\tcamera_ms\tjs_camera_o\tplus_gros_fichier\tfichier_o\tfichier_ms\tfichier_min_ms\terreur\tnote_fcp_lcp';
  374 | 
  375 | function num(v: number | null): string {
  376 |     return v === null ? '' : String(Math.round(v));
  377 | }
  378 | 
  379 | function row(screen: Screen, label: string, r: Omit<PassResult, 'pass'>): string {
  380 |     return [screen.id, label, num(r.fcp), num(r.lcp), num(r.useful), r.usefulBy ?? '', num(r.jsBeforeUseful), num(r.js3s), num(r.css), num(r.total),
  381 |         num(r.jsNetwork), num(r.cameraMs), num(r.jsCamera), r.biggest?.name ?? '', num(r.biggest?.bytes ?? null), num(r.biggest?.ms ?? null),
  382 |         num(r.biggest?.minMs ?? null), r.error ?? '', (r.note ?? '').replace(/\s+/g, ' ')].join('\t');
  383 | }
  384 | 
  385 | function aggregate(results: PassResult[], pick: (r: PassResult) => number | null): { med: number | null; max: number | null } {
  386 |     const values = results.map(pick).filter((v): v is number => v !== null);
  387 |     return { med: median(values), max: values.length ? Math.max(...values) : null };
  388 | }
  389 | 
  390 | for (const screen of SCREENS) {
  391 |     test(`${screen.libelle} : premier affichage utile et JavaScript chargé, 4G simulée et processeur ×4 (5 passages)`, async ({ browser }, testInfo) => {
  392 |         test.setTimeout(10 * 60_000);
  393 |         const budgets = readBudgets();
  394 |         const results: PassResult[] = [];
  395 |         for (let pass = 1; pass <= PASSES; pass++) {
  396 |             const r = await onePass(browser, testInfo, screen, pass);
  397 |             results.push(r);
  398 |             appendPerfFile('perf.tsv', TSV_HEADER, [row(screen, String(pass), r)]);
  399 |             console.log(`[PERF] ${screen.id} passage ${pass} : ${r.error ? `ÉCHEC ${r.error}` : `FCP ${fmtMs(r.fcp)} ms, LCP ${fmtMs(r.lcp)} ms, utile ${fmtMs(r.useful)} ms (${r.usefulBy}), JS (a) ${r.jsBeforeUseful} o, JS (b) ${r.js3s} o, CSS ${r.css} o, total ${r.total} o${screen.camera ? `, caméra ${fmtMs(r.cameraMs)} ms, JS caméra ${r.jsCamera} o` : ''}`}`);
  400 |         }
  401 |         const keys: Array<[keyof Omit<PassResult, 'pass' | 'usefulBy' | 'biggest' | 'error' | 'note'>, string]> = [
  402 |             ['fcp', 'fcp'], ['lcp', 'lcp'], ['useful', 'utile'], ['jsBeforeUseful', 'js (a)'], ['js3s', 'js (b)'], ['css', 'css'], ['total', 'total'],
  403 |             ['jsNetwork', 'js réseau'], ['cameraMs', 'caméra'], ['jsCamera', 'js caméra'],
  404 |         ];
  405 |         const med: Omit<PassResult, 'pass'> = { fcp: null, lcp: null, note: null, useful: null, usefulBy: null, jsBeforeUseful: null, js3s: null, css: null, total: null, jsNetwork: null, cameraMs: null, jsCamera: null, biggest: null, error: null };
  406 |         const max: Omit<PassResult, 'pass'> = { ...med };
  407 |         for (const [k] of keys) {
  408 |             const a = aggregate(results, (r) => r[k]);
  409 |             med[k] = a.med;
  410 |             max[k] = a.max;
  411 |         }
  412 |         appendPerfFile('perf.tsv', TSV_HEADER, [row(screen, 'mediane', med), row(screen, 'max', max)]);
  413 |         const ko = (v: number | null) => (v === null ? '—' : `${(v / 1000).toFixed(1).replace('.', ',')} Ko`);
  414 |         const budget = Object.prototype.hasOwnProperty.call(budgets, screen.budgetRoute) ? budgets[screen.budgetRoute] : null;
  415 |         const lines = [
  416 |             `${screen.libelle} (${screen.path()}, ${screen.role}) — ${PASSES} passages, ${NET_4G.nom}, processeur ×4`,
  417 |             `  premier affichage utile : médiane ${fmtMs(med.useful)} ms, max ${fmtMs(max.useful)} ms ; FCP médiane ${fmtMs(med.fcp)} ms ; LCP médiane ${fmtMs(med.lcp)} ms, max ${fmtMs(max.lcp)} ms`,
  418 |             `  JavaScript (a) avant le marqueur : médiane ${ko(med.jsBeforeUseful)}, max ${ko(max.jsBeforeUseful)} ; (b) à + 3 s : médiane ${ko(med.js3s)} ; CSS ${ko(med.css)} ; total ${ko(med.total)} ; recoupement réseau ${ko(med.jsNetwork)}`,
  419 |             ...(screen.camera ? [`  caméra en lecture : médiane ${fmtMs(med.cameraMs)} ms ; JavaScript à + 3 s caméra lancée : médiane ${ko(med.jsCamera)}, max ${ko(max.jsCamera)}`] : []),
  420 |             ...results.filter((r) => r.note).map((r) => `  passage ${r.pass} : ${r.note}`),
  421 |             `  budget post-build ${screen.budgetRoute} : ${budget === null ? 'aucun (mesure seule)' : `${ko(budget)} + ${ko(BUDGET_TOLERANCE)} de tolérance`}`,
  422 |         ];
  423 |         appendPerfFile('perf.txt', null, lines);
  424 |         console.log(lines.map((l) => `[PERF] ${l}`).join('\n'));
  425 |         if (med.useful !== null && med.useful > 3_000) console.log(`[PERF-AVERTISSEMENT] ${screen.id} : premier affichage utile médian ${fmtMs(med.useful)} ms > 3 000 ms`);
  426 |         if (med.lcp !== null && med.lcp > 4_000) console.log(`[PERF-AVERTISSEMENT] ${screen.id} : LCP médian ${fmtMs(med.lcp)} ms > 4 000 ms`);
  427 | 
  428 |         // Bloquant : chaque passage a abouti, avec un bridage effectivement appliqué
  429 |         for (const r of results) {
  430 |             expect.soft(r.error, `${screen.id} passage ${r.pass} : mesure complète`).toBeNull();
  431 |             if (r.error) continue;
> 432 |             if (!screen.serverRendered) expect.soft(r.jsBeforeUseful ?? 0, `${screen.id} passage ${r.pass} : du JavaScript /_next/static/ arrivé avant le marqueur`).toBeGreaterThan(0);
      |                                                                                                                                                                      ^ Error: mes-billets passage 5 : du JavaScript /_next/static/ arrivé avant le marqueur
  433 |             expect.soft(r.biggest, `${screen.id} passage ${r.pass} : au moins un fichier /_next/static/ mesuré`).not.toBeNull();
  434 |             if (r.biggest) {
  435 |                 expect.soft(r.biggest.ms >= r.biggest.minMs,
  436 |                     `${screen.id} passage ${r.pass} : bridage non appliqué (${r.biggest.name}, ${r.biggest.bytes} o en ${Math.round(r.biggest.ms)} ms < ${Math.round(r.biggest.minMs)} ms au débit simulé)`).toBe(true);
  437 |             }
  438 |         }
  439 |         if (budget !== null) {
  440 |             expect.soft((max.jsBeforeUseful ?? Number.POSITIVE_INFINITY) <= budget + BUDGET_TOLERANCE,
  441 |                 `${screen.id} : JavaScript (a) maximal ${ko(max.jsBeforeUseful)} au-dessus du budget ${screen.budgetRoute} ${ko(budget)} + ${ko(BUDGET_TOLERANCE)}`).toBe(true);
  442 |         }
  443 |     });
  444 | }
  445 | 
```