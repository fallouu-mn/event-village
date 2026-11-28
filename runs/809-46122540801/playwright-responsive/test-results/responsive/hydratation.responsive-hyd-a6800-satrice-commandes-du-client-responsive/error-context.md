# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: hydratation.responsive.spec.ts >> hydratation · clair · 390 px · page tardive, services ouverts : accueil, Explorer, fiche, tableau de bord et calendrier de l'organisatrice, commandes du client
- Location: e2e/hydratation.responsive.spec.ts:363:13

# Error details

```
Error: erreurs d'hydratation, page tardive (clair, 390 px)

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 43

- Array []
+ Array [
+   "clair · 390 px · fiche-ce-soir (anonyme) · morceaux de page retardés de 2500 ms · chargement 3/3 :
+   exception sur /events/5f003f37-b65b-4592-b9fd-9fa6f9cda574 : Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.
+   écart à 2546 ms : Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors a
+     pile : rD (/_next/static/chunks/4bd1b696-bad92808725a934a.js:1:35063) | oq (/_next/static/chunks/4bd1b696-bad92808725a934a.js:1:84567) | iw (/_next/static/chunks/4bd1b696-bad92808725a934a.js:1:114962) | /_next/static/chunks/4bd1b696-bad92808725a934a.js:1:110323 | iu (/_next/static/chunks/4bd1b696-bad92808725a934a.js:1:110832) | iX (/_next/static/chunks/4bd1b696-bad92808725a934a.js:1:132935)
+     dernier nœud rattaché : path
+       chemin : body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex > div.flex.min-w-0.flex-1.flex-col > header.sticky.top-0.z-20.flex > div.flex.flex-shrink-0.items-center.gap-1.5 > div.relative.hidden.lg:block > button.flex.min-h-11.items-center.rounded-full[type=\"button\"] > svg.lucide.lucide-chevron-down.transition-transform.duration-200 > path
+       précédé de : null
+       html : <path d=\"m6 9 6 6 6-6\"></path>
+       composants parents : path < svg < Symbol(react.forward_ref){ref,iconNode,className,size,aria-hidden} < ChevronDown{size,aria-hidden,className} < button < div < V{pathname,loggedIn,avatar,displayName,subtitle,sections,onSignOut,themeToggle} < div < header < div < div < et < Symbol(react.context){value} < u < Symbol(react.context){value} < d < Symbol(react.context){value} < A < body < html < tag7{0,1} < __next_root_layout_boundary__ < s{router} < f < s{pathname,errorComponent,errorStyles,errorScripts} < f{errorComponent,errorStyles,errorScripts} < i{errorComponent,errorStyles} < Symbol(react.context){value} < Symbol(react.context){value} < Symbol(react.context){value}
+     suivant (non rattaché) : main.mx-auto.w-full.max-w-7xl.flex-1
+       chemin : body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex > div.flex.min-w-0.flex-1.flex-col > main.mx-auto.w-full.max-w-7xl.flex-1
+       précédé de : header.sticky.top-0.z-20.flex
+       html : <main class=\"mx-auto w-full max-w-7xl flex-1 p-4 pb-28 sm:p-6 sm:pb-28 lg:p-8\"><div class=\"ev-page-enter\"><!--$--><div><section aria-labelledby=\"fiche-titre\" style=\"--poster:#963711\" class=\"ev-hero ev-poster-card -mx-4 -mt-4 overflow-hidden px-4 pb-14 pt-3 sm:mx-0 sm:mt-0 sm:rounded-3xl sm:px-6 sm:pb-16 lg:px-10 lg:pt-6\"><div class=\"ev-hero-backdrop\" aria-hidden=\"true\"><img src=\"data:image/webp;base64,UklGRmgAAABXRUJQVlA4IFwAAABwBACdASoYAA8APtFUpEuoJKOhsAgBABoJZACdMoRwACnIBuKIIo/H4OqnIAD+wCxcuyH
+       composants parents : enfants du parent (✓ = rattaché) : header.sticky.top-0.z-20.flex ✓ | main.mx-auto.w-full.max-w-7xl.flex-1 ;; composants du parent : (parent sans composant)
+     suivant (non rattaché) : div.ev-page-enter
+       chemin : body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex > div.flex.min-w-0.flex-1.flex-col > main.mx-auto.w-full.max-w-7xl.flex-1 > div.ev-page-enter
+       précédé de : null
+       html : <div class=\"ev-page-enter\"><!--$--><div><section aria-labelledby=\"fiche-titre\" style=\"--poster:#963711\" class=\"ev-hero ev-poster-card -mx-4 -mt-4 overflow-hidden px-4 pb-14 pt-3 sm:mx-0 sm:mt-0 sm:rounded-3xl sm:px-6 sm:pb-16 lg:px-10 lg:pt-6\"><div class=\"ev-hero-backdrop\" aria-hidden=\"true\"><img src=\"data:image/webp;base64,UklGRmgAAABXRUJQVlA4IFwAAABwBACdASoYAA8APtFUpEuoJKOhsAgBABoJZACdMoRwACnIBuKIIo/H4OqnIAD+wCxcuyHF/jF4A8/U2+Qa+LfuiAn1Cy4t0A5THezeZD2JtB24/XXStR5iz8ewAA==\" alt=\"\"></div><div cl
+       composants parents : enfants du parent (✓ = rattaché) : div.ev-page-enter ;; composants du parent : (parent sans composant)
+     suivant (non rattaché) : <!--$-->
+       chemin : body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex > div.flex.min-w-0.flex-1.flex-col > main.mx-auto.w-full.max-w-7xl.flex-1 > div.ev-page-enter > <!--$-->
+       précédé de : null
+       html : $
+       composants parents : enfants du parent (✓ = rattaché) : <!--$--> | div | <!--$--> | <!--/$--> | <!--/$--> ;; composants du parent : (parent sans composant)
+   écritures dans le document avant l'écart (8) :
+     18 ms data= sur body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex > div.flex.min-w-0.flex-1.flex-col > main.mx-auto.w-full.max-w-7xl.flex-1 > div.ev-page-enter > <!--$?-->
+       Comment.set [as data] (<anonymous>:179:9) | $RC (/events/5f003f37-b65b-4592-b9fd-9fa6f9cda574:2:105) | /events/5f003f37-b65b-4592-b9fd-9fa6f9cda574:2:321
+     32 ms removeChild sur body.min-h-screen.antialiased.font-sans
+       proto.<computed> [as removeChild] (<anonymous>:166:7) | $RV (/events/5f003f37-b65b-4592-b9fd-9fa6f9cda574:1:48252)
+     32 ms removeChild sur body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex > div.flex.min-w-0.flex-1.flex-col > main.mx-auto.w-full.max-w-7xl.flex-1 > div.ev-page-enter
+       proto.<computed> [as removeChild] (<anonymous>:166:7) | $RV (/events/5f003f37-b65b-4592-b9fd-9fa6f9cda574:1:48478)
+     32 ms removeChild sur body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex > div.flex.min-w-0.flex-1.flex-col > main.mx-auto.w-full.max-w-7xl.flex-1 > div.ev-page-enter
+       proto.<computed> [as removeChild] (<anonymous>:166:7) | $RV (/events/5f003f37-b65b-4592-b9fd-9fa6f9cda574:1:48478)
+     32 ms insertBefore sur body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex > div.flex.min-w-0.flex-1.flex-col > main.mx-auto.w-full.max-w-7xl.flex-1 > div.ev-page-enter
+       proto.<computed> [as insertBefore] (<anonymous>:166:7) | $RV (/events/5f003f37-b65b-4592-b9fd-9fa6f9cda574:1:48527)
+     32 ms insertBefore sur body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex > div.flex.min-w-0.flex-1.flex-col > main.mx-auto.w-full.max-w-7xl.flex-1 > div.ev-page-enter
+       proto.<computed> [as insertBefore] (<anonymous>:166:7) | $RV (/events/5f003f37-b65b-4592-b9fd-9fa6f9cda574:1:48527)
+     32 ms insertBefore sur body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex > div.flex.min-w-0.flex-1.flex-col > main.mx-auto.w-full.max-w-7xl.flex-1 > div.ev-page-enter
+       proto.<computed> [as insertBefore] (<anonymous>:166:7) | $RV (/events/5f003f37-b65b-4592-b9fd-9fa6f9cda574:1:48527)
+     32 ms data= sur body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex > div.flex.min-w-0.flex-1.flex-col > main.mx-auto.w-full.max-w-7xl.flex-1 > div.ev-page-enter > <!--$~-->
+       Comment.set [as data] (<anonymous>:179:9) | $RV (/events/5f003f37-b65b-4592-b9fd-9fa6f9cda574:1:48562)",
+ ]
```

# Test source

```ts
  302 |                                 const report = formatProbe(await readProbe(p));
  303 |                                 failures.push(`${theme} · ${vp.id} px · ${lc.id} (${lc.role}) · fin du flux à +${sc.tail} ms, morceaux de page à +${sc.chunk} ms · chargement ${passage}/3 :\n  ${errors.join('\n  ')}${report ? `\n${report}` : ''}`);
  304 |                             }
  305 |                         }
  306 |                         notes.push(`${lc.id} (fin +${sc.tail} ms, morceaux +${sc.chunk} ms) : document coupé ${cut}/3 fois${cut === 0 ? ' (sans bloc différé)' : ''}`);
  307 |                     } finally {
  308 |                         await context.close();
  309 |                     }
  310 |                 }
  311 |             }
  312 |             console.log(`[hydratation] flux retardé · ${theme} · ${vp.id} px : ${loads} chargements, ${failures.length} en échec\n  ${notes.join('\n  ')}`);
  313 |             for (const f of failures) console.log(`[hydratation] ÉCHEC ${f}`);
  314 |             expect(failures, `erreurs d'hydratation, flux retardé (${theme}, ${vp.id} px)`).toEqual([]);
  315 |         });
  316 |     }
  317 | }
  318 | 
  319 | for (const theme of THEMES) {
  320 |     for (const vp of VIEWPORTS) {
  321 |         test(`hydratation · ${theme} · ${vp.id} px · rechargements répétés, page tardive : tableau de bord et calendrier de l'organisatrice, commandes du client`, async ({ browser }, testInfo) => {
  322 |             test.skip(!STRESS, 'groupe de stress (défaut de React n° 418, lot Next 16) : ligne « ci-hydratation: stress » du commit');
  323 |             test.setTimeout(900_000);
  324 |             const failures: string[] = [];
  325 |             let loads = 0;
  326 |             for (const lc of RELOAD_PAGES) {
  327 |                 for (const delay of RELOAD_DELAYS) {
  328 |                     const context = await openRoleContext(browser, testInfo, lc.role as 'organisateur' | 'client', theme, { ...vp.options, timezoneId: BROWSER_TZ });
  329 |                     try {
  330 |                         await installHydrationProbe(context);
  331 |                         await context.route(LATE_PAGE_CHUNK, async (route) => {
  332 |                             await new Promise((r) => setTimeout(r, delay));
  333 |                             await route.fallback();
  334 |                         });
  335 |                         const p = await context.newPage();
  336 |                         const watch = watchHydration(p);
  337 |                         for (let passage = 1; passage <= RELOADS; passage += 1) {
  338 |                             const mark = watch.mark();
  339 |                             if (passage === 1) await p.goto(lc.path(), { waitUntil: 'load' });
  340 |                             else await p.reload({ waitUntil: 'load' });
  341 |                             await waitHydrated(p, lc.ready);
  342 |                             loads += 1;
  343 |                             const errors = watch.since(mark);
  344 |                             if (errors.length > 0) {
  345 |                                 const report = formatProbe(await readProbe(p));
  346 |                                 failures.push(`${theme} · ${vp.id} px · ${lc.id} (${lc.role}) · morceaux de page retardés de ${delay} ms · chargement ${passage}/${RELOADS} :\n  ${errors.join('\n  ')}${report ? `\n${report}` : ''}`);
  347 |                             }
  348 |                         }
  349 |                     } finally {
  350 |                         await context.close();
  351 |                     }
  352 |                 }
  353 |             }
  354 |             console.log(`[hydratation] rechargements répétés · ${theme} · ${vp.id} px : ${loads} chargements, ${failures.length} en échec`);
  355 |             for (const f of failures) console.log(`[hydratation] ÉCHEC ${f}`);
  356 |             expect(failures, `erreurs d'hydratation, rechargements répétés (${theme}, ${vp.id} px)`).toEqual([]);
  357 |         });
  358 |     }
  359 | }
  360 | 
  361 | for (const theme of THEMES) {
  362 |     for (const vp of VIEWPORTS) {
  363 |         test(`hydratation · ${theme} · ${vp.id} px · page tardive, services ouverts : accueil, Explorer, fiche, tableau de bord et calendrier de l'organisatrice, commandes du client`, async ({ browser, servicesLock }, testInfo) => {
  364 |             test.skip(!STRESS, 'groupe de stress (défaut de React n° 418, lot Next 16) : ligne « ci-hydratation: stress » du commit');
  365 |             test.setTimeout(900_000);
  366 |             await servicesLock.enter('services');
  367 |             const failures: string[] = [];
  368 |             let loads = 0;
  369 |             for (const lc of LATE_PAGES) {
  370 |                 for (const delay of LATE_DELAYS) {
  371 |                     const extra = { ...vp.options, timezoneId: BROWSER_TZ };
  372 |                     const context = lc.role === 'anonyme'
  373 |                         ? await openAnonymousContext(browser, testInfo, theme, extra)
  374 |                         : await openRoleContext(browser, testInfo, lc.role, theme, extra);
  375 |                     try {
  376 |                         await installHydrationProbe(context);
  377 |                         await context.route(LATE_PAGE_CHUNK, async (route) => {
  378 |                             await new Promise((r) => setTimeout(r, delay));
  379 |                             await route.fallback();
  380 |                         });
  381 |                         const p = await context.newPage();
  382 |                         const watch = watchHydration(p);
  383 |                         for (let passage = 1; passage <= 3; passage += 1) {
  384 |                             const mark = watch.mark();
  385 |                             if (passage === 1) await p.goto(lc.path(), { waitUntil: 'load' });
  386 |                             else await p.reload({ waitUntil: 'load' });
  387 |                             await waitHydrated(p, lc.ready);
  388 |                             loads += 1;
  389 |                             const errors = watch.since(mark);
  390 |                             if (errors.length > 0) {
  391 |                                 const report = formatProbe(await readProbe(p));
  392 |                                 failures.push(`${theme} · ${vp.id} px · ${lc.id} (${lc.role}) · morceaux de page retardés de ${delay} ms · chargement ${passage}/3 :\n  ${errors.join('\n  ')}${report ? `\n${report}` : ''}`);
  393 |                             }
  394 |                         }
  395 |                     } finally {
  396 |                         await context.close();
  397 |                     }
  398 |                 }
  399 |             }
  400 |             console.log(`[hydratation] page tardive · ${theme} · ${vp.id} px : ${loads} chargements, ${failures.length} en échec`);
  401 |             for (const f of failures) console.log(`[hydratation] ÉCHEC ${f}`);
> 402 |             expect(failures, `erreurs d'hydratation, page tardive (${theme}, ${vp.id} px)`).toEqual([]);
      |                                                                                             ^ Error: erreurs d'hydratation, page tardive (clair, 390 px)
  403 |         });
  404 |     }
  405 | }
  406 | 
  407 | for (const theme of THEMES) {
  408 |     for (const vp of VIEWPORTS) {
  409 |         for (const pc of PAGES) {
  410 |             test(`hydratation · ${theme} · ${vp.id} px · ${pc.id} : fuseau ${BROWSER_TZ}, minute, minuit, début, en cours, heure figée, morceaux lents, réseau 4G, processeur lent`, async ({ browser, page }, testInfo) => {
  411 |                 test.setTimeout(900_000);
  412 |                 const live = await liveEventId();
  413 |                 const startsAt = await ceSoirStart(page);
  414 |                 const failures: string[] = [];
  415 |                 let loads = 0;
  416 |                 for (const scenario of SCENARIOS) {
  417 |                     failures.push(...await runScenario(browser, testInfo, theme, vp, pc, scenario, { now: Date.now(), startsAt }, live));
  418 |                     loads += scenario.passages ?? 2;
  419 |                 }
  420 |                 console.log(`[hydratation] ${theme} · ${vp.id} px · ${pc.id} : ${loads} chargements, ${failures.length} en échec`);
  421 |                 for (const f of failures) console.log(`[hydratation] ÉCHEC ${f}`);
  422 |                 expect(failures, `erreurs d'hydratation (${theme}, ${vp.id} px, ${pc.id})`).toEqual([]);
  423 |             });
  424 |         }
  425 |     }
  426 | }
  427 | 
```