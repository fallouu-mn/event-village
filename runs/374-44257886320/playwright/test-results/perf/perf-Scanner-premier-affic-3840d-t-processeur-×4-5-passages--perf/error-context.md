# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: perf.spec.ts >> Scanner : premier affichage utile et JavaScript chargé, 4G simulée et processeur ×4 (5 passages)
- Location: e2e/perf.spec.ts:381:9

# Error details

```
Error: scanner : JavaScript (a) maximal 261,1 Ko au-dessus du budget /controller/scanner 234,9 Ko + 20,0 Ko

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  331 |         if (state.fcp === null || state.lcp === null) {
  332 |             console.log(`[PERF] ${screen.id} passage ${pass} : à l'apparition du marqueur, FCP ${fmtMs(state.fcp)} ms et LCP ${fmtMs(state.lcp)} ms ; `
  333 |                 + `à + 3 s : FCP ${fmtMs(out.fcp)} ms, LCP ${fmtMs(out.lcp)} ms${out.note ? ` — ${out.note}` : ''}`);
  334 |         }
  335 |         const later = await snapshot(page, state.useful);
  336 |         out.js3s = later.js;
  337 |         out.css = later.css;
  338 |         out.total = later.total;
  339 |         out.jsNetwork = (await Promise.all(networkSizes)).reduce((a, b) => a + b, 0);
  340 |         if (later.biggest) out.biggest = { ...later.biggest, minMs: (later.biggest.bytes / NET_4G.downloadThroughput) * 1000 };
  341 | 
  342 |         if (screen.camera) {
  343 |             const start = page.getByRole('button', { name: /commencer le contr[ôo]le/i });
  344 |             if (await start.count() > 0 && await start.first().isVisible()) await start.first().click();
  345 |             const handle = await page.waitForFunction(
  346 |                 () => (Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2) ? performance.now() : false),
  347 |                 null, { timeout: 60_000 },
  348 |             ).catch((err: unknown) => {
  349 |                 throw new Error(`caméra simulée jamais en lecture en 60 s : ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
  350 |             });
  351 |             out.cameraMs = Number(await handle.jsonValue());
  352 |             await page.waitForTimeout(3_000);
  353 |             out.jsCamera = (await snapshot(page, null)).js;
  354 |         }
  355 |     } catch (err) {
  356 |         out.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  357 |     } finally {
  358 |         await context.close();
  359 |     }
  360 |     return out;
  361 | }
  362 | 
  363 | const TSV_HEADER = 'ecran\tpassage\tfcp_ms\tlcp_ms\tutile_ms\tmarqueur\tjs_avant_utile_o\tjs_3s_o\tcss_o\ttotal_o\tjs_reseau_o\tcamera_ms\tjs_camera_o\tplus_gros_fichier\tfichier_o\tfichier_ms\tfichier_min_ms\terreur\tnote_fcp_lcp';
  364 | 
  365 | function num(v: number | null): string {
  366 |     return v === null ? '' : String(Math.round(v));
  367 | }
  368 | 
  369 | function row(screen: Screen, label: string, r: Omit<PassResult, 'pass'>): string {
  370 |     return [screen.id, label, num(r.fcp), num(r.lcp), num(r.useful), r.usefulBy ?? '', num(r.jsBeforeUseful), num(r.js3s), num(r.css), num(r.total),
  371 |         num(r.jsNetwork), num(r.cameraMs), num(r.jsCamera), r.biggest?.name ?? '', num(r.biggest?.bytes ?? null), num(r.biggest?.ms ?? null),
  372 |         num(r.biggest?.minMs ?? null), r.error ?? '', (r.note ?? '').replace(/\s+/g, ' ')].join('\t');
  373 | }
  374 | 
  375 | function aggregate(results: PassResult[], pick: (r: PassResult) => number | null): { med: number | null; max: number | null } {
  376 |     const values = results.map(pick).filter((v): v is number => v !== null);
  377 |     return { med: median(values), max: values.length ? Math.max(...values) : null };
  378 | }
  379 | 
  380 | for (const screen of SCREENS) {
  381 |     test(`${screen.libelle} : premier affichage utile et JavaScript chargé, 4G simulée et processeur ×4 (5 passages)`, async ({ browser }, testInfo) => {
  382 |         test.setTimeout(10 * 60_000);
  383 |         const budgets = readBudgets();
  384 |         const results: PassResult[] = [];
  385 |         for (let pass = 1; pass <= PASSES; pass++) {
  386 |             const r = await onePass(browser, testInfo, screen, pass);
  387 |             results.push(r);
  388 |             appendPerfFile('perf.tsv', TSV_HEADER, [row(screen, String(pass), r)]);
  389 |             console.log(`[PERF] ${screen.id} passage ${pass} : ${r.error ? `ÉCHEC ${r.error}` : `FCP ${fmtMs(r.fcp)} ms, LCP ${fmtMs(r.lcp)} ms, utile ${fmtMs(r.useful)} ms (${r.usefulBy}), JS (a) ${r.jsBeforeUseful} o, JS (b) ${r.js3s} o, CSS ${r.css} o, total ${r.total} o${screen.camera ? `, caméra ${fmtMs(r.cameraMs)} ms, JS caméra ${r.jsCamera} o` : ''}`}`);
  390 |         }
  391 |         const keys: Array<[keyof Omit<PassResult, 'pass' | 'usefulBy' | 'biggest' | 'error' | 'note'>, string]> = [
  392 |             ['fcp', 'fcp'], ['lcp', 'lcp'], ['useful', 'utile'], ['jsBeforeUseful', 'js (a)'], ['js3s', 'js (b)'], ['css', 'css'], ['total', 'total'],
  393 |             ['jsNetwork', 'js réseau'], ['cameraMs', 'caméra'], ['jsCamera', 'js caméra'],
  394 |         ];
  395 |         const med: Omit<PassResult, 'pass'> = { fcp: null, lcp: null, note: null, useful: null, usefulBy: null, jsBeforeUseful: null, js3s: null, css: null, total: null, jsNetwork: null, cameraMs: null, jsCamera: null, biggest: null, error: null };
  396 |         const max: Omit<PassResult, 'pass'> = { ...med };
  397 |         for (const [k] of keys) {
  398 |             const a = aggregate(results, (r) => r[k]);
  399 |             med[k] = a.med;
  400 |             max[k] = a.max;
  401 |         }
  402 |         appendPerfFile('perf.tsv', TSV_HEADER, [row(screen, 'mediane', med), row(screen, 'max', max)]);
  403 |         const ko = (v: number | null) => (v === null ? '—' : `${(v / 1000).toFixed(1).replace('.', ',')} Ko`);
  404 |         const budget = Object.prototype.hasOwnProperty.call(budgets, screen.budgetRoute) ? budgets[screen.budgetRoute] : null;
  405 |         const lines = [
  406 |             `${screen.libelle} (${screen.path()}, ${screen.role}) — ${PASSES} passages, ${NET_4G.nom}, processeur ×4`,
  407 |             `  premier affichage utile : médiane ${fmtMs(med.useful)} ms, max ${fmtMs(max.useful)} ms ; FCP médiane ${fmtMs(med.fcp)} ms ; LCP médiane ${fmtMs(med.lcp)} ms, max ${fmtMs(max.lcp)} ms`,
  408 |             `  JavaScript (a) avant le marqueur : médiane ${ko(med.jsBeforeUseful)}, max ${ko(max.jsBeforeUseful)} ; (b) à + 3 s : médiane ${ko(med.js3s)} ; CSS ${ko(med.css)} ; total ${ko(med.total)} ; recoupement réseau ${ko(med.jsNetwork)}`,
  409 |             ...(screen.camera ? [`  caméra en lecture : médiane ${fmtMs(med.cameraMs)} ms ; JavaScript à + 3 s caméra lancée : médiane ${ko(med.jsCamera)}, max ${ko(max.jsCamera)}`] : []),
  410 |             ...results.filter((r) => r.note).map((r) => `  passage ${r.pass} : ${r.note}`),
  411 |             `  budget post-build ${screen.budgetRoute} : ${budget === null ? 'aucun (mesure seule)' : `${ko(budget)} + ${ko(BUDGET_TOLERANCE)} de tolérance`}`,
  412 |         ];
  413 |         appendPerfFile('perf.txt', null, lines);
  414 |         console.log(lines.map((l) => `[PERF] ${l}`).join('\n'));
  415 |         if (med.useful !== null && med.useful > 3_000) console.log(`[PERF-AVERTISSEMENT] ${screen.id} : premier affichage utile médian ${fmtMs(med.useful)} ms > 3 000 ms`);
  416 |         if (med.lcp !== null && med.lcp > 4_000) console.log(`[PERF-AVERTISSEMENT] ${screen.id} : LCP médian ${fmtMs(med.lcp)} ms > 4 000 ms`);
  417 | 
  418 |         // Bloquant : chaque passage a abouti, avec un bridage effectivement appliqué
  419 |         for (const r of results) {
  420 |             expect.soft(r.error, `${screen.id} passage ${r.pass} : mesure complète`).toBeNull();
  421 |             if (r.error) continue;
  422 |             if (!screen.serverRendered) expect.soft(r.jsBeforeUseful ?? 0, `${screen.id} passage ${r.pass} : du JavaScript /_next/static/ arrivé avant le marqueur`).toBeGreaterThan(0);
  423 |             expect.soft(r.biggest, `${screen.id} passage ${r.pass} : au moins un fichier /_next/static/ mesuré`).not.toBeNull();
  424 |             if (r.biggest) {
  425 |                 expect.soft(r.biggest.ms >= r.biggest.minMs,
  426 |                     `${screen.id} passage ${r.pass} : bridage non appliqué (${r.biggest.name}, ${r.biggest.bytes} o en ${Math.round(r.biggest.ms)} ms < ${Math.round(r.biggest.minMs)} ms au débit simulé)`).toBe(true);
  427 |             }
  428 |         }
  429 |         if (budget !== null) {
  430 |             expect.soft((max.jsBeforeUseful ?? Number.POSITIVE_INFINITY) <= budget + BUDGET_TOLERANCE,
> 431 |                 `${screen.id} : JavaScript (a) maximal ${ko(max.jsBeforeUseful)} au-dessus du budget ${screen.budgetRoute} ${ko(budget)} + ${ko(BUDGET_TOLERANCE)}`).toBe(true);
      |                                                                                                                                                                      ^ Error: scanner : JavaScript (a) maximal 261,1 Ko au-dessus du budget /controller/scanner 234,9 Ko + 20,0 Ko
  432 |         }
  433 |     });
  434 | }
  435 | 
```