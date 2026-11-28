# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: hydratation.responsive.spec.ts >> hydratation · sombre · 1440 px · page tardive, services ouverts : accueil, Explorer, fiche, tableau de bord et calendrier de l'organisatrice, commandes du client
- Location: e2e/hydratation.responsive.spec.ts:278:13

# Error details

```
Error: erreurs d'hydratation, page tardive (sombre, 1440 px)

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 26

- Array []
+ Array [
+   "sombre · 1440 px · accueil (anonyme) · morceaux de page retardés de 2500 ms · chargement 2/3 :
+   exception sur / : Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.
+   écart à 2556 ms : Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors a
+     pile : rD (/_next/static/chunks/4bd1b696-bad92808725a934a.js:1:35063) | oq (/_next/static/chunks/4bd1b696-bad92808725a934a.js:1:84567) | iw (/_next/static/chunks/4bd1b696-bad92808725a934a.js:1:114962) | /_next/static/chunks/4bd1b696-bad92808725a934a.js:1:110323 | iu (/_next/static/chunks/4bd1b696-bad92808725a934a.js:1:110832) | iX (/_next/static/chunks/4bd1b696-bad92808725a934a.js:1:132935)
+     dernier nœud rattaché : path
+       chemin : body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex > div.flex.min-w-0.flex-1.flex-col > header.sticky.top-0.z-20.flex > div.flex.flex-shrink-0.items-center.gap-1.5 > div.relative.hidden.lg:block > button.flex.min-h-11.items-center.rounded-full[type=\"button\"] > svg.lucide.lucide-chevron-down.transition-transform.duration-200 > path
+       précédé de : null
+       html : <path d=\"m6 9 6 6 6-6\"></path>
+       composants parents : path < svg < Symbol(react.forward_ref){ref,iconNode,className,size,aria-hidden} < ChevronDown{size,aria-hidden,className} < button < div < V{pathname,loggedIn,avatar,displayName,subtitle,sections,onSignOut,themeToggle} < div < header < div < div < et < Symbol(react.context){value} < u < Symbol(react.context){value} < d < Symbol(react.context){value} < A < body < html < tag7{0,1} < __next_root_layout_boundary__ < s{router} < f < s{pathname,errorComponent,errorStyles,errorScripts} < f{errorComponent,errorStyles,errorScripts} < i{errorComponent,errorStyles} < Symbol(react.context){value} < Symbol(react.context){value} < Symbol(react.context){value}
+     suivant (non rattaché) : main.mx-auto.w-full.max-w-7xl.flex-1
+       chemin : body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex > div.flex.min-w-0.flex-1.flex-col > main.mx-auto.w-full.max-w-7xl.flex-1
+       précédé de : header.sticky.top-0.z-20.flex
+       html : <main class=\"mx-auto w-full max-w-7xl flex-1 p-4 pb-28 sm:p-6 sm:pb-28 lg:p-8\"><div class=\"ev-page-enter\"><div class=\"space-y-12 pb-24 sm:space-y-16 lg:pb-12\"><!--$!--><template data-dgst=\"BAILOUT_TO_CLIENT_SIDE_RENDERING\"></template><!--/$--><section aria-labelledby=\"accueil-titre\" class=\"pt-2 sm:pt-6\"><h1 id=\"accueil-titre\" class=\"max-w-3xl text-balance text-3xl font-extrabold leading-tight tracking-tight text-foreground-strong sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]\">Vos prochaines sort
+       composants parents : enfants du parent (✓ = rattaché) : header.sticky.top-0.z-20.flex ✓ | main.mx-auto.w-full.max-w-7xl.flex-1 ;; composants du parent : (parent sans composant)
+     suivant (non rattaché) : div.ev-page-enter
+       chemin : body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex > div.flex.min-w-0.flex-1.flex-col > main.mx-auto.w-full.max-w-7xl.flex-1 > div.ev-page-enter
+       précédé de : null
+       html : <div class=\"ev-page-enter\"><div class=\"space-y-12 pb-24 sm:space-y-16 lg:pb-12\"><!--$!--><template data-dgst=\"BAILOUT_TO_CLIENT_SIDE_RENDERING\"></template><!--/$--><section aria-labelledby=\"accueil-titre\" class=\"pt-2 sm:pt-6\"><h1 id=\"accueil-titre\" class=\"max-w-3xl text-balance text-3xl font-extrabold leading-tight tracking-tight text-foreground-strong sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]\">Vos prochaines sorties au Sénégal</h1><p class=\"mt-3 max-w-2xl text-base leading-relaxed text-mute
+       composants parents : enfants du parent (✓ = rattaché) : div.ev-page-enter ;; composants du parent : (parent sans composant)
+     suivant (non rattaché) : div.space-y-12.pb-24.sm:space-y-16.lg:pb-12
+       chemin : body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex > div.flex.min-w-0.flex-1.flex-col > main.mx-auto.w-full.max-w-7xl.flex-1 > div.ev-page-enter > div.space-y-12.pb-24.sm:space-y-16.lg:pb-12
+       précédé de : null
+       html : <div class=\"space-y-12 pb-24 sm:space-y-16 lg:pb-12\"><!--$!--><template data-dgst=\"BAILOUT_TO_CLIENT_SIDE_RENDERING\"></template><!--/$--><section aria-labelledby=\"accueil-titre\" class=\"pt-2 sm:pt-6\"><h1 id=\"accueil-titre\" class=\"max-w-3xl text-balance text-3xl font-extrabold leading-tight tracking-tight text-foreground-strong sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]\">Vos prochaines sorties au Sénégal</h1><p class=\"mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg\">Co
+       composants parents : enfants du parent (✓ = rattaché) : div.space-y-12.pb-24.sm:space-y-16.lg:pb-12 | <!--$--> | <!--/$--> ;; composants du parent : (parent sans composant)",
+ ]
```

# Test source

```ts
  216 | const LATE_PAGES: LateCase[] = [
  217 |     { id: 'accueil', role: 'anonyme', path: () => '/', ready: '#accueil-titre' },
  218 |     { id: 'explorer', role: 'anonyme', path: () => '/explore', ready: '#resultats-titre' },
  219 |     { id: 'fiche-ce-soir', role: 'anonyme', path: () => `/events/${readDemoIds().events.ceSoir.id}`, ready: '#billetterie' },
  220 |     { id: 'org-tableau-de-bord', role: 'organisateur', path: () => '/partner/dashboard', ready: 'h1' },
  221 |     { id: 'org-calendrier', role: 'organisateur', path: () => '/partner/calendar', ready: 'h1' },
  222 |     { id: 'client-commandes', role: 'client', path: () => '/orders', ready: 'h1' },
  223 | ];
  224 | const LATE_DELAYS = [600, 2_500] as const;
  225 | 
  226 | /**
  227 |  * Rechargements répétés des pages connectées, morceaux de page retardés (run 796 : les deux n° 418 reproduits l'ont été au
  228 |  * rechargement, sur /orders et /partner/dashboard ; run 800 : aucun sur 144 chargements). Sans le verrou des services (les
  229 |  * autres tests ne l'attendent pas) : interrupteurs dans l'état du moment.
  230 |  */
  231 | const RELOAD_PAGES = LATE_PAGES.filter((p) => p.role !== 'anonyme');
  232 | const RELOAD_DELAYS = [600, 1_200, 2_500] as const;
  233 | const RELOADS = 8;
  234 | 
  235 | for (const theme of THEMES) {
  236 |     for (const vp of VIEWPORTS) {
  237 |         test(`hydratation · ${theme} · ${vp.id} px · rechargements répétés, page tardive : tableau de bord et calendrier de l'organisatrice, commandes du client`, async ({ browser }, testInfo) => {
  238 |             test.setTimeout(900_000);
  239 |             const failures: string[] = [];
  240 |             let loads = 0;
  241 |             for (const lc of RELOAD_PAGES) {
  242 |                 for (const delay of RELOAD_DELAYS) {
  243 |                     const context = await openRoleContext(browser, testInfo, lc.role as 'organisateur' | 'client', theme, { ...vp.options, timezoneId: BROWSER_TZ });
  244 |                     try {
  245 |                         await installHydrationProbe(context);
  246 |                         await context.route(LATE_PAGE_CHUNK, async (route) => {
  247 |                             await new Promise((r) => setTimeout(r, delay));
  248 |                             await route.fallback();
  249 |                         });
  250 |                         const p = await context.newPage();
  251 |                         const watch = watchHydration(p);
  252 |                         for (let passage = 1; passage <= RELOADS; passage += 1) {
  253 |                             const mark = watch.mark();
  254 |                             if (passage === 1) await p.goto(lc.path(), { waitUntil: 'load' });
  255 |                             else await p.reload({ waitUntil: 'load' });
  256 |                             await waitHydrated(p, lc.ready);
  257 |                             loads += 1;
  258 |                             const errors = watch.since(mark);
  259 |                             if (errors.length > 0) {
  260 |                                 const report = formatProbe(await readProbe(p));
  261 |                                 failures.push(`${theme} · ${vp.id} px · ${lc.id} (${lc.role}) · morceaux de page retardés de ${delay} ms · chargement ${passage}/${RELOADS} :\n  ${errors.join('\n  ')}${report ? `\n${report}` : ''}`);
  262 |                             }
  263 |                         }
  264 |                     } finally {
  265 |                         await context.close();
  266 |                     }
  267 |                 }
  268 |             }
  269 |             console.log(`[hydratation] rechargements répétés · ${theme} · ${vp.id} px : ${loads} chargements, ${failures.length} en échec`);
  270 |             for (const f of failures) console.log(`[hydratation] ÉCHEC ${f}`);
  271 |             expect(failures, `erreurs d'hydratation, rechargements répétés (${theme}, ${vp.id} px)`).toEqual([]);
  272 |         });
  273 |     }
  274 | }
  275 | 
  276 | for (const theme of THEMES) {
  277 |     for (const vp of VIEWPORTS) {
  278 |         test(`hydratation · ${theme} · ${vp.id} px · page tardive, services ouverts : accueil, Explorer, fiche, tableau de bord et calendrier de l'organisatrice, commandes du client`, async ({ browser, servicesLock }, testInfo) => {
  279 |             test.setTimeout(900_000);
  280 |             await servicesLock.enter('services');
  281 |             const failures: string[] = [];
  282 |             let loads = 0;
  283 |             for (const lc of LATE_PAGES) {
  284 |                 for (const delay of LATE_DELAYS) {
  285 |                     const extra = { ...vp.options, timezoneId: BROWSER_TZ };
  286 |                     const context = lc.role === 'anonyme'
  287 |                         ? await openAnonymousContext(browser, testInfo, theme, extra)
  288 |                         : await openRoleContext(browser, testInfo, lc.role, theme, extra);
  289 |                     try {
  290 |                         await installHydrationProbe(context);
  291 |                         await context.route(LATE_PAGE_CHUNK, async (route) => {
  292 |                             await new Promise((r) => setTimeout(r, delay));
  293 |                             await route.fallback();
  294 |                         });
  295 |                         const p = await context.newPage();
  296 |                         const watch = watchHydration(p);
  297 |                         for (let passage = 1; passage <= 3; passage += 1) {
  298 |                             const mark = watch.mark();
  299 |                             if (passage === 1) await p.goto(lc.path(), { waitUntil: 'load' });
  300 |                             else await p.reload({ waitUntil: 'load' });
  301 |                             await waitHydrated(p, lc.ready);
  302 |                             loads += 1;
  303 |                             const errors = watch.since(mark);
  304 |                             if (errors.length > 0) {
  305 |                                 const report = formatProbe(await readProbe(p));
  306 |                                 failures.push(`${theme} · ${vp.id} px · ${lc.id} (${lc.role}) · morceaux de page retardés de ${delay} ms · chargement ${passage}/3 :\n  ${errors.join('\n  ')}${report ? `\n${report}` : ''}`);
  307 |                             }
  308 |                         }
  309 |                     } finally {
  310 |                         await context.close();
  311 |                     }
  312 |                 }
  313 |             }
  314 |             console.log(`[hydratation] page tardive · ${theme} · ${vp.id} px : ${loads} chargements, ${failures.length} en échec`);
  315 |             for (const f of failures) console.log(`[hydratation] ÉCHEC ${f}`);
> 316 |             expect(failures, `erreurs d'hydratation, page tardive (${theme}, ${vp.id} px)`).toEqual([]);
      |                                                                                             ^ Error: erreurs d'hydratation, page tardive (sombre, 1440 px)
  317 |         });
  318 |     }
  319 | }
  320 | 
  321 | for (const theme of THEMES) {
  322 |     for (const vp of VIEWPORTS) {
  323 |         for (const pc of PAGES) {
  324 |             test(`hydratation · ${theme} · ${vp.id} px · ${pc.id} : fuseau ${BROWSER_TZ}, minute, minuit, début, en cours, heure figée, morceaux lents, réseau 4G, processeur lent`, async ({ browser, page }, testInfo) => {
  325 |                 test.setTimeout(900_000);
  326 |                 const live = await liveEventId();
  327 |                 const startsAt = await ceSoirStart(page);
  328 |                 const failures: string[] = [];
  329 |                 let loads = 0;
  330 |                 for (const scenario of SCENARIOS) {
  331 |                     failures.push(...await runScenario(browser, testInfo, theme, vp, pc, scenario, { now: Date.now(), startsAt }, live));
  332 |                     loads += scenario.passages ?? 2;
  333 |                 }
  334 |                 console.log(`[hydratation] ${theme} · ${vp.id} px · ${pc.id} : ${loads} chargements, ${failures.length} en échec`);
  335 |                 for (const f of failures) console.log(`[hydratation] ÉCHEC ${f}`);
  336 |                 expect(failures, `erreurs d'hydratation (${theme}, ${vp.id} px, ${pc.id})`).toEqual([]);
  337 |             });
  338 |         }
  339 |     }
  340 | }
  341 | 
```