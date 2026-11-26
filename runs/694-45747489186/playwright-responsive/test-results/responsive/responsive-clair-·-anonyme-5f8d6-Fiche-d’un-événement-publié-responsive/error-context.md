# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · anonyme >> fiche — Fiche d’un événement publié
- Location: e2e/responsive.spec.ts:77:21

# Error details

```
Error: contrôles responsive de fiche (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 8

- Array []
+ Array [
+   "320 px : valeur technique affichée : Internal Server Error — ex. texte : « Internal Server Error »",
+   "360 px : valeur technique affichée : Internal Server Error — ex. texte : « Internal Server Error »",
+   "390 px : valeur technique affichée : Internal Server Error — ex. texte : « Internal Server Error »",
+   "768 px : valeur technique affichée : Internal Server Error — ex. texte : « Internal Server Error »",
+   "1024 px : valeur technique affichée : Internal Server Error — ex. texte : « Internal Server Error »",
+   "1440 px : valeur technique affichée : Internal Server Error — ex. texte : « Internal Server Error »",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f5e1]:
  - generic [ref=f5e4]:
    - heading "500" [level=1] [ref=f5e5]
    - heading "Internal Server Error." [level=2] [ref=f5e7]
  - alert [ref=f5e8]
```

# Test source

```ts
  24  | import { fakeScanMode, installFakeCamera } from './support/fake-camera';
  25  | import {
  26  |     PHONE_MAX_WIDTH, RESPONSIVE_CAPTURE_WIDTHS, RESPONSIVE_LANDSCAPE, RESPONSIVE_PAGES, RESPONSIVE_WIDTHS, type ResponsivePage,
  27  | } from './support/responsive-pages';
  28  | import { runResponsiveChecks } from './support/responsive-checks';
  29  | import { keepHomeOutOfServicesWindow } from './support/services-switch';
  30  | import { readTheme, themeProblem } from './support/theme-check';
  31  | 
  32  | const RESULTS = path.join(E2E_OUTPUT_DIR, 'responsive');
  33  | const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
  34  | 
  35  | const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
  36  |     { key: 'clair', colorScheme: 'light' },
  37  |     { key: 'sombre', colorScheme: 'dark' },
  38  | ];
  39  | 
  40  | interface Size { width: number; height: number; paysage?: boolean }
  41  | 
  42  | function sizesFor(p: ResponsivePage, theme: ThemeKey): Size[] {
  43  |     const base: Size[] = RESPONSIVE_WIDTHS
  44  |         .filter((w) => theme === 'clair' || RESPONSIVE_CAPTURE_WIDTHS.includes(w.width))
  45  |         .map((w) => ({ width: w.width, height: w.height }));
  46  |     const land: Size[] = p.paysage ? RESPONSIVE_LANDSCAPE.map((w) => ({ width: w.width, height: w.height, paysage: true })) : [];
  47  |     return [...base, ...land];
  48  | }
  49  | 
  50  | /** Page stable : polices chargées, réseau au repos (plafond 3 s, noté sinon), deux images d'affichage. */
  51  | async function settle(page: Page, notes: string[], at: string): Promise<void> {
  52  |     await page.evaluate(() => document.fonts.ready.then(() => true));
  53  |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => { notes.push(`${at} : réseau jamais au repos en 3 s (attente plafonnée)`); });
  54  |     await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete), undefined, { timeout: 5_000 })
  55  |         .catch(() => { notes.push(`${at} : images encore en chargement après 5 s`); });
  56  |     await page.evaluate(() => new Promise<void>((resolve) => { requestAnimationFrame(() => requestAnimationFrame(() => resolve())); }));
  57  | }
  58  | 
  59  | interface ResponsiveRecord {
  60  |     page: string;
  61  |     titre: string;
  62  |     groupe: string;
  63  |     role: CaptureRole;
  64  |     theme: ThemeKey;
  65  |     url: string | null;
  66  |     sizes: Array<{ size: string; blocking: string[]; warnings: string[]; capture: string | null }>;
  67  |     notes: string[];
  68  |     error: string | null;
  69  | }
  70  | 
  71  | for (const theme of THEMES) {
  72  |     const roles = Array.from(new Set(RESPONSIVE_PAGES.map((p) => p.role)));
  73  |     for (const role of roles) {
  74  |         test.describe(`${theme.key} · ${role}`, () => {
  75  |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  76  |             for (const p of RESPONSIVE_PAGES.filter((x) => x.role === role)) {
  77  |                 test(`${p.id} — ${p.titre}`, async ({ page, context, guard, servicesLock }) => {
  78  |                     test.setTimeout(240_000);
  79  |                     const record: ResponsiveRecord = { page: p.id, titre: p.titre, groupe: p.groupe, role, theme: theme.key, url: null, sizes: [], notes: [], error: null };
  80  |                     try {
  81  |                         // Lot 10b (lot 11b : salles et tables) : verrou des services avant tout chargement (attente ajoutée au délai du test)
  82  |                         await servicesLock.enter(p.services ? 'services' : 'autres');
  83  |                         if (servicesLock.waitedMs >= 1_000) record.notes.push(`attente du verrou des services : ${Math.round(servicesLock.waitedMs / 1000)} s`);
  84  |                         if (p.services) {
  85  |                             record.notes.push('page des services : interrupteurs features.halls_enabled et features.tables_enabled ouverts le temps du test (e2e/support/services-switch.ts)');
  86  |                             await keepHomeOutOfServicesWindow(page);
  87  |                         }
  88  |                         const demo: DemoIds | null = p.needsIds ? readDemoIds() : null;
  89  |                         record.url = p.path(demo);
  90  |                         guard.configure({ allowFailures: p.allowFailures ?? [], ignoreConsoleErrors: false });
  91  |                         if (p.fakeCamera) await context.addInitScript(installFakeCamera, { mode: fakeScanMode() });
  92  |                         for (const size of sizesFor(p, theme.key)) {
  93  |                             const at = size.paysage ? `${size.width}×${size.height} px (paysage)` : `${size.width} px`;
  94  |                             await page.setViewportSize({ width: size.width, height: size.height });
  95  |                             const response = await page.goto(record.url, { waitUntil: 'load' });
  96  |                             if (p.expectStatus !== undefined) expect(response?.status(), `statut HTTP de ${record.url}`).toBe(p.expectStatus);
  97  |                             if (p.ready) await p.ready(page);
  98  |                             else await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  99  |                             if (p.actions) await p.actions(page);
  100 |                             await settle(page, record.notes, at);
  101 |                             const checks = await runResponsiveChecks(page, { width: size.width, phone: !size.paysage && size.width <= PHONE_MAX_WIDTH });
  102 |                             const blocking = checks.blocking.map((b) => (size.paysage ? b.replace(`${size.width} px`, at) : b));
  103 |                             // Finition 5 (point 1) : thème demandé vraiment affiché (classe dark et fond lus sur la page), bloquant
  104 |                             const themeIssue = themeProblem(await readTheme(page), theme.key, at);
  105 |                             if (themeIssue) blocking.push(themeIssue);
  106 |                             let capture: string | null = null;
  107 |                             if (size.paysage || RESPONSIVE_CAPTURE_WIDTHS.includes(size.width)) {
  108 |                                 fs.mkdirSync(SHOTS, { recursive: true });
  109 |                                 capture = `${p.id}__${size.paysage ? `${size.width}x${size.height}` : size.width}__${theme.key}.jpg`;
  110 |                                 await page.screenshot({ path: path.join(SHOTS, capture), type: 'jpeg', quality: 80, animations: 'disabled', caret: 'hide', scale: 'css' });
  111 |                             }
  112 |                             record.sizes.push({ size: at, blocking, warnings: checks.warnings, capture });
  113 |                         }
  114 |                     } catch (err) {
  115 |                         record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  116 |                         throw err;
  117 |                     } finally {
  118 |                         // Erreurs de la page (console, requêtes) : notées, déjà bloquantes dans les captures
  119 |                         record.notes.push(...guard.blockingIssues().map((i) => `erreur de la page : ${i}`));
  120 |                         fs.mkdirSync(RESULTS, { recursive: true });
  121 |                         fs.writeFileSync(path.join(RESULTS, `${p.id}__${theme.key}.json`), `${JSON.stringify(record, null, 1)}\n`, 'utf8');
  122 |                     }
  123 |                     const blocking = record.sizes.flatMap((s) => s.blocking);
> 124 |                     expect(blocking, `contrôles responsive de ${p.id} (${theme.key})`).toEqual([]);
      |                                                                                        ^ Error: contrôles responsive de fiche (clair)
  125 |                 });
  126 |             }
  127 |         });
  128 |     }
  129 | }
  130 | 
```