# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: hydratation.responsive.spec.ts >> hydratation · sombre · 390 px · page tardive, services ouverts : accueil, Explorer, fiche, tableau de bord et calendrier de l'organisatrice, commandes du client
- Location: e2e/hydratation.responsive.spec.ts:228:13

# Error details

```
Error: erreurs d'hydratation, page tardive (sombre, 390 px)

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 46

- Array []
+ Array [
+   "sombre · 390 px · org-tableau-de-bord (organisateur) · morceaux de page retardés de 600 ms · chargement 2/2 :
+   exception sur /partner/dashboard : Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.
+   écart à 640 ms : Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors a
+     pile : rD (/_next/static/chunks/4bd1b696-bad92808725a934a.js:1:35063) | oq (/_next/static/chunks/4bd1b696-bad92808725a934a.js:1:84567) | iw (/_next/static/chunks/4bd1b696-bad92808725a934a.js:1:114962) | /_next/static/chunks/4bd1b696-bad92808725a934a.js:1:110323 | iu (/_next/static/chunks/4bd1b696-bad92808725a934a.js:1:110832) | iX (/_next/static/chunks/4bd1b696-bad92808725a934a.js:1:132935)
+     nœud non hydraté : div.ev-push-page.relative.z-10.flex
+       chemin : body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex
+       précédé de : div[hidden=\"\"]
+       html : <div class=\"ev-push-page relative z-10 flex min-h-screen flex-col bg-background text-foreground-strong lg:flex-row\"><!--$--><div class=\"ev-side-spacer hidden flex-shrink-0 lg:block\" aria-hidden=\"true\"></div><aside class=\"ev-side fixed left-0 top-0 z-30 hidden h-screen flex-col overflow-y-auto overflow-x-hidden border-r border-border bg-card shadow-subtle lg:flex\"><div class=\"flex flex-shrink-0 ite
+       composants parents : (parent sans composant)
+     nœud non hydraté : #text « Event Village »
+       chemin : body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex > div.flex.min-w-0.flex-1.flex-col > header.sticky.top-0.z-20.flex > div.flex.flex-shrink-0.items-center.gap-1.5 > div.lg:hidden > a.inline-flex.min-h-11.min-w-11.items-center[aria-label=\"Event Village, accueil\"] > span.flex.select-none.items-center.gap-2 > span.hidden.sm:inline.whitespace-nowrap.text-xl > #text « Event Village »
+       précédé de : null
+       html : Event Village
+       composants parents : span < span < a < Symbol(react.context){value} < g{href,prefetch,aria-label,className} < l{variant} < div < div < header < div < div < et < Symbol(react.context){value} < u < Symbol(react.context){value} < d < Symbol(react.context){value} < A < body < html < tag7{0,1} < __next_root_layout_boundary__ < s{router} < f < s{pathname,errorComponent,errorStyles,errorScripts} < f{errorComponent,errorStyles,errorScripts} < i{errorComponent,errorStyles} < Symbol(react.context){value} < Symbol(react.context){value} < Symbol(react.context){value}
+     nœud non hydraté : #text « Rechercher un événement… »
+       chemin : body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex > div.flex.min-w-0.flex-1.flex-col > header.sticky.top-0.z-20.flex > div.hidden.min-w-0.max-w-lg.flex-1 > a.flex.min-h-11.items-center.gap-2 > span.min-w-0.break-words > #text « Rechercher un événement… »
+       précédé de : null
+       html : Rechercher un événement…
+       composants parents : span < a < Symbol(react.context){value} < g{href,prefetch,onPointerEnter,onTouchStart,onFocus,data-ev-search,onClick,className} < o{href,data-ev-search,onClick,className} < div < header < div < div < et < Symbol(react.context){value} < u < Symbol(react.context){value} < d < Symbol(react.context){value} < A < body < html < tag7{0,1} < __next_root_layout_boundary__ < s{router} < f < s{pathname,errorComponent,errorStyles,errorScripts} < f{errorComponent,errorStyles,errorScripts} < i{errorComponent,errorStyles} < Symbol(react.context){value} < Symbol(react.context){value} < Symbol(react.context){value} < Symbol(react.context){value} < Symbol(react.context){value}
+     nœud non hydraté : #text « Mon compte »
+       chemin : body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex > div.flex.min-w-0.flex-1.flex-col > header.sticky.top-0.z-20.flex > div.flex.flex-shrink-0.items-center.gap-1.5 > div.relative.hidden.lg:block > button.flex.min-h-11.items-center.rounded-full[type=\"button\"] > span.sr-only > #text « Mon compte »
+       précédé de : null
+       html : Mon compte
+       composants parents : span < button < div < V{pathname,loggedIn,avatar,displayName,subtitle,sections,onSignOut,themeToggle} < div < header < div < div < et < Symbol(react.context){value} < u < Symbol(react.context){value} < d < Symbol(react.context){value} < A < body < html < tag7{0,1} < __next_root_layout_boundary__ < s{router} < f < s{pathname,errorComponent,errorStyles,errorScripts} < f{errorComponent,errorStyles,errorScripts} < i{errorComponent,errorStyles} < Symbol(react.context){value} < Symbol(react.context){value} < Symbol(react.context){value} < Symbol(react.context){value} < Symbol(react.context){value} < Symbol(react.context){value}
+     nœud non hydraté : div.pointer-events-none.fixed.inset-x-4.bottom-24
+       chemin : body.min-h-screen.antialiased.font-sans > div.pointer-events-none.fixed.inset-x-4.bottom-24
+       précédé de : div.ev-push-page.relative.z-10.flex
+       html : <div class=\"pointer-events-none fixed inset-x-4 bottom-24 z-[100] flex flex-col gap-3 sm:inset-x-auto sm:right-5 sm:w-full sm:max-w-md lg:bottom-auto lg:top-20\"></div>
+       composants parents : (parent sans composant)
+   écritures dans le document avant l'écart (7) :
+     16 ms data= sur body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex > <!--$?-->
+       Comment.set [as data] (<anonymous>:148:9) | $RC (/partner/dashboard:2:105) | /partner/dashboard:2:321
+     22 ms removeChild sur body.min-h-screen.antialiased.font-sans
+       proto.<computed> [as removeChild] (<anonymous>:135:7) | $RV (/partner/dashboard:1:25560)
+     23 ms removeChild sur body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex
+       proto.<computed> [as removeChild] (<anonymous>:135:7) | $RV (/partner/dashboard:1:25786)
+     23 ms removeChild sur body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex
+       proto.<computed> [as removeChild] (<anonymous>:135:7) | $RV (/partner/dashboard:1:25786)
+     23 ms insertBefore sur body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex
+       proto.<computed> [as insertBefore] (<anonymous>:135:7) | $RV (/partner/dashboard:1:25835)
+     23 ms insertBefore sur body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex
+       proto.<computed> [as insertBefore] (<anonymous>:135:7) | $RV (/partner/dashboard:1:25835)
+     23 ms data= sur body.min-h-screen.antialiased.font-sans > div.ev-push-page.relative.z-10.flex > <!--$~-->
+       Comment.set [as data] (<anonymous>:148:9) | $RV (/partner/dashboard:1:25870)",
+ ]
```

# Test source

```ts
  166 |         let clockNote = BROWSER_TZ;
  167 |         if (scenario.at) {
  168 |             const at = scenario.at(input);
  169 |             await p.clock.install({ time: at });
  170 |             clockNote = `navigateur à ${new Date(at).toISOString()}, ${BROWSER_TZ}`;
  171 |         }
  172 |         if (scenario.fixed) {
  173 |             const at = scenario.fixed(input);
  174 |             clockNote = `navigateur figé à ${new Date(at).toISOString()}, ${BROWSER_TZ}`;
  175 |         }
  176 |         const label = `${pc.id} · ${scenario.id} (${clockNote})`;
  177 |         const passages = scenario.passages ?? 2;
  178 |         for (let passage = 1; passage <= passages; passage += 1) {
  179 |             const mark = watch.mark();
  180 |             if (passage === 1) await p.goto(pc.path(live), { waitUntil: 'load' });
  181 |             else await p.reload({ waitUntil: 'load' });
  182 |             await waitHydrated(p, pc.ready);
  183 |             // Capture fiche-en-cours : premier chargement à l'heure réelle, puis heure figée et rechargements
  184 |             if (passage === 1 && scenario.fixed) await p.clock.setFixedTime(new Date(scenario.fixed(input)));
  185 |             const errors = watch.since(mark);
  186 |             const extra: string[] = [];
  187 |             if (pc.id === 'explorer') {
  188 |                 const n = await p.getByLabel(/^Rechercher un événement$/).count();
  189 |                 if (n !== 1) extra.push(`${n} champs « Rechercher un événement » (1 attendu)`);
  190 |             }
  191 |             if (pc.id.startsWith('fiche')) {
  192 |                 const n = await p.locator('h1').count();
  193 |                 if (n !== 1) extra.push(`${n} titres h1 (1 attendu)`);
  194 |             }
  195 |             if (errors.length > 0 || extra.length > 0) {
  196 |                 const report = formatProbe(await readProbe(p));
  197 |                 failures.push(`${theme} · ${vp.id} px · ${label} · chargement ${passage}/${passages} :\n  ${[...errors, ...extra].join('\n  ')}${report ? `\n${report}` : ''}`);
  198 |             }
  199 |         }
  200 |     } finally {
  201 |         await context.close();
  202 |     }
  203 |     return failures;
  204 | }
  205 | 
  206 | /**
  207 |  * Page tardive, services ouverts (run 787 : n° 418 sur /partner/calendar à 768 px, page dont le contenu n'est PAS rendu par
  208 |  * le serveur : l'écart est dans le gabarit, ou dans une partie hydratée après la racine). Seuls les morceaux des pages et
  209 |  * des gabarits de segment (/_next/static/chunks/app/…, sauf le gabarit racine) sont retardés : la racine s'hydrate, ses
  210 |  * effets tournent (session lue, `mounted`, interrupteurs lus par GET /api/features), PUIS la page s'hydrate. Interrupteurs
  211 |  * salles et tables ouverts (verrou des services) : une entrée de service n'est rendue que si l'interrupteur est lu.
  212 |  */
  213 | const LATE_PAGE_CHUNK = /\/_next\/static\/chunks\/app\/(?!layout-)[^?]+\.js(\?|$)/;
  214 | 
  215 | interface LateCase { id: string; role: 'anonyme' | 'organisateur' | 'client'; path: () => string; ready: string }
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
  226 | for (const theme of THEMES) {
  227 |     for (const vp of VIEWPORTS) {
  228 |         test(`hydratation · ${theme} · ${vp.id} px · page tardive, services ouverts : accueil, Explorer, fiche, tableau de bord et calendrier de l'organisatrice, commandes du client`, async ({ browser, servicesLock }, testInfo) => {
  229 |             test.setTimeout(900_000);
  230 |             await servicesLock.enter('services');
  231 |             const failures: string[] = [];
  232 |             let loads = 0;
  233 |             for (const lc of LATE_PAGES) {
  234 |                 for (const delay of LATE_DELAYS) {
  235 |                     const extra = { ...vp.options, timezoneId: BROWSER_TZ };
  236 |                     const context = lc.role === 'anonyme'
  237 |                         ? await openAnonymousContext(browser, testInfo, theme, extra)
  238 |                         : await openRoleContext(browser, testInfo, lc.role, theme, extra);
  239 |                     try {
  240 |                         await installHydrationProbe(context);
  241 |                         await context.route(LATE_PAGE_CHUNK, async (route) => {
  242 |                             await new Promise((r) => setTimeout(r, delay));
  243 |                             await route.fallback();
  244 |                         });
  245 |                         const p = await context.newPage();
  246 |                         const watch = watchHydration(p);
  247 |                         for (let passage = 1; passage <= 2; passage += 1) {
  248 |                             const mark = watch.mark();
  249 |                             if (passage === 1) await p.goto(lc.path(), { waitUntil: 'load' });
  250 |                             else await p.reload({ waitUntil: 'load' });
  251 |                             await waitHydrated(p, lc.ready);
  252 |                             loads += 1;
  253 |                             const errors = watch.since(mark);
  254 |                             if (errors.length > 0) {
  255 |                                 const report = formatProbe(await readProbe(p));
  256 |                                 failures.push(`${theme} · ${vp.id} px · ${lc.id} (${lc.role}) · morceaux de page retardés de ${delay} ms · chargement ${passage}/2 :\n  ${errors.join('\n  ')}${report ? `\n${report}` : ''}`);
  257 |                             }
  258 |                         }
  259 |                     } finally {
  260 |                         await context.close();
  261 |                     }
  262 |                 }
  263 |             }
  264 |             console.log(`[hydratation] page tardive · ${theme} · ${vp.id} px : ${loads} chargements, ${failures.length} en échec`);
  265 |             for (const f of failures) console.log(`[hydratation] ÉCHEC ${f}`);
> 266 |             expect(failures, `erreurs d'hydratation, page tardive (${theme}, ${vp.id} px)`).toEqual([]);
      |                                                                                             ^ Error: erreurs d'hydratation, page tardive (sombre, 390 px)
  267 |         });
  268 |     }
  269 | }
  270 | 
  271 | for (const theme of THEMES) {
  272 |     for (const vp of VIEWPORTS) {
  273 |         for (const pc of PAGES) {
  274 |             test(`hydratation · ${theme} · ${vp.id} px · ${pc.id} : fuseau ${BROWSER_TZ}, minute, minuit, début, en cours, heure figée, morceaux lents, réseau 4G, processeur lent`, async ({ browser, page }, testInfo) => {
  275 |                 test.setTimeout(900_000);
  276 |                 const live = await liveEventId();
  277 |                 const startsAt = await ceSoirStart(page);
  278 |                 const failures: string[] = [];
  279 |                 let loads = 0;
  280 |                 for (const scenario of SCENARIOS) {
  281 |                     failures.push(...await runScenario(browser, testInfo, theme, vp, pc, scenario, { now: Date.now(), startsAt }, live));
  282 |                     loads += scenario.passages ?? 2;
  283 |                 }
  284 |                 console.log(`[hydratation] ${theme} · ${vp.id} px · ${pc.id} : ${loads} chargements, ${failures.length} en échec`);
  285 |                 for (const f of failures) console.log(`[hydratation] ÉCHEC ${f}`);
  286 |                 expect(failures, `erreurs d'hydratation (${theme}, ${vp.id} px, ${pc.id})`).toEqual([]);
  287 |             });
  288 |         }
  289 |     }
  290 | }
  291 | 
```