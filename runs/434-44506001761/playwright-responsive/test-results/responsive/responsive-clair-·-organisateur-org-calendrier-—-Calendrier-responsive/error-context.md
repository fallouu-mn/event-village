# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · organisateur >> org-calendrier — Calendrier
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de org-calendrier (clair)

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 17

- Array []
+ Array [
+   "320 px : 2 cible(s) < 44 px : button « ← » 30×24 ; button « → » 30×24",
+   "320 px : 41 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Visualisez le planning de vos événement… » (div.flex.flex-col > div > p.text-xs.text-slate-500) ; 12 px « ← » (div.flex.items-center > div.flex.items-center > button.px-2.5.py-1) ; 12 px « → » (div.flex.items-center > div.flex.items-center > button.px-2.5.py-1) ; 11 px « Dim » (div.p-6.rounded-3xl > div.grid.grid-cols-7 > span.text-[11px].font-bold) ; 11 px « Lun » (div.p-6.rounded-3xl > div.grid.grid-cols-7 > span.text-[11px].font-bold)",
+   "360 px : 2 cible(s) < 44 px : button « ← » 30×24 ; button « → » 30×24",
+   "360 px : 41 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Visualisez le planning de vos événement… » (div.flex.flex-col > div > p.text-xs.text-slate-500) ; 12 px « ← » (div.flex.items-center > div.flex.items-center > button.px-2.5.py-1) ; 12 px « → » (div.flex.items-center > div.flex.items-center > button.px-2.5.py-1) ; 11 px « Dim » (div.p-6.rounded-3xl > div.grid.grid-cols-7 > span.text-[11px].font-bold) ; 11 px « Lun » (div.p-6.rounded-3xl > div.grid.grid-cols-7 > span.text-[11px].font-bold)",
+   "390 px : 2 cible(s) < 44 px : button « ← » 30×24 ; button « → » 30×24",
+   "390 px : 41 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Visualisez le planning de vos événement… » (div.flex.flex-col > div > p.text-xs.text-slate-500) ; 12 px « ← » (div.flex.items-center > div.flex.items-center > button.px-2.5.py-1) ; 12 px « → » (div.flex.items-center > div.flex.items-center > button.px-2.5.py-1) ; 11 px « Dim » (div.p-6.rounded-3xl > div.grid.grid-cols-7 > span.text-[11px].font-bold) ; 11 px « Lun » (div.p-6.rounded-3xl > div.grid.grid-cols-7 > span.text-[11px].font-bold)",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "768 px : 2 cible(s) < 44 px : button « ← » 30×24 ; button « → » 30×24",
+   "768 px : 40 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « ← » (div.flex.items-center > div.flex.items-center > button.px-2.5.py-1) ; 12 px « → » (div.flex.items-center > div.flex.items-center > button.px-2.5.py-1) ; 11 px « Dim » (div.p-6.rounded-3xl > div.grid.grid-cols-7 > span.text-[11px].font-bold) ; 11 px « Lun » (div.p-6.rounded-3xl > div.grid.grid-cols-7 > span.text-[11px].font-bold) ; 11 px « Mar » (div.p-6.rounded-3xl > div.grid.grid-cols-7 > span.text-[11px].font-bold)",
+   "1024 px : texte tronqué sans le texte entier : span.block.truncate « Mariama Ndiaye » (points de suspension, texte entier absent)",
+   "1024 px : 2 cible(s) < 44 px : button « ← » 30×24 ; button « → » 30×24",
+   "1024 px : 40 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « ← » (div.flex.items-center > div.flex.items-center > button.px-2.5.py-1) ; 12 px « → » (div.flex.items-center > div.flex.items-center > button.px-2.5.py-1) ; 11 px « Dim » (div.p-6.rounded-3xl > div.grid.grid-cols-7 > span.text-[11px].font-bold) ; 11 px « Lun » (div.p-6.rounded-3xl > div.grid.grid-cols-7 > span.text-[11px].font-bold) ; 11 px « Mar » (div.p-6.rounded-3xl > div.grid.grid-cols-7 > span.text-[11px].font-bold)",
+   "1440 px : texte tronqué sans le texte entier : span.block.truncate « Mariama Ndiaye » (points de suspension, texte entier absent)",
+   "1440 px : 2 cible(s) < 44 px : button « ← » 30×24 ; button « → » 30×24",
+   "1440 px : 40 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « ← » (div.flex.items-center > div.flex.items-center > button.px-2.5.py-1) ; 12 px « → » (div.flex.items-center > div.flex.items-center > button.px-2.5.py-1) ; 11 px « Dim » (div.p-6.rounded-3xl > div.grid.grid-cols-7 > span.text-[11px].font-bold) ; 11 px « Lun » (div.p-6.rounded-3xl > div.grid.grid-cols-7 > span.text-[11px].font-bold) ; 11 px « Mar » (div.p-6.rounded-3xl > div.grid.grid-cols-7 > span.text-[11px].font-bold)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f5e1]:
  - generic [ref=f5e2]:
    - complementary [ref=f5e3]:
      - link "Event Village, accueil" [ref=f5e5] [cursor=pointer]:
        - /url: /
        - generic [ref=f5e6]: Event Village
      - navigation "Navigation principale" [ref=f5e9]:
        - generic [ref=f5e10]:
          - paragraph [ref=f5e11]: Gestion
          - generic [ref=f5e12]:
            - link "Tableau de bord" [ref=f5e13] [cursor=pointer]:
              - /url: /partner/dashboard
            - link "Événements" [ref=f5e20] [cursor=pointer]:
              - /url: /partner/events
            - link "Équipe" [ref=f5e24] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=f5e31]:
          - paragraph [ref=f5e32]: Outils
          - generic [ref=f5e33]:
            - link "Finances" [ref=f5e34] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=f5e38] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=f5e42] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=f5e50] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=f5e54] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=f5e59] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=f5e65] [cursor=pointer]:
          - /url: /
      - generic [ref=f5e71]:
        - link "Mariama Ndiaye Partenaire" [ref=f5e72] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f5e73]: MN
          - generic [ref=f5e74]:
            - generic [ref=f5e75]: Mariama Ndiaye
            - generic [ref=f5e76]: Partenaire
        - generic [ref=f5e77]:
          - button "Se déconnecter" [ref=f5e78] [cursor=pointer]
          - button "Basculer le thème" [ref=f5e83] [cursor=pointer]
    - generic [ref=f5e87]:
      - banner [ref=f5e88]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f5e90] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 99+ non lues" [ref=f5e97] [cursor=pointer]:
          - generic [ref=f5e101]: 99+
      - main [ref=f5e102]:
        - generic [ref=f5e104]:
          - generic [ref=f5e105]:
            - generic [ref=f5e106]:
              - heading "Calendrier Événementiel" [level=1] [ref=f5e107]
              - paragraph [ref=f5e111]: Visualisez le planning de vos événements et réservations.
            - link [ref=f5e113] [cursor=pointer]:
              - /url: /partner/events/new
              - button "Nouvel événement" [ref=f5e114]
          - generic [ref=f5e118]:
            - generic [ref=f5e120]:
              - generic [ref=f5e121]:
                - heading "novembre 2026" [level=3] [ref=f5e122]
                - generic [ref=f5e123]:
                  - button "←" [ref=f5e124] [cursor=pointer]
                  - button "→" [ref=f5e125] [cursor=pointer]
              - generic [ref=f5e126]:
                - generic [ref=f5e127]: Dim
                - generic [ref=f5e128]: Lun
                - generic [ref=f5e129]: Mar
                - generic [ref=f5e130]: Mer
                - generic [ref=f5e131]: Jeu
                - generic [ref=f5e132]: Ven
                - generic [ref=f5e133]: Sam
              - generic [ref=f5e134]:
                - generic [ref=f5e135] [cursor=pointer]: "1"
                - generic [ref=f5e137] [cursor=pointer]: "2"
                - generic [ref=f5e139] [cursor=pointer]: "3"
                - generic [ref=f5e141] [cursor=pointer]: "4"
                - generic [ref=f5e143] [cursor=pointer]: "5"
                - generic [ref=f5e145] [cursor=pointer]: "6"
                - generic [ref=f5e147] [cursor=pointer]: "7"
                - generic [ref=f5e149] [cursor=pointer]: "8"
                - generic [ref=f5e151] [cursor=pointer]: "9"
                - generic [ref=f5e153] [cursor=pointer]: "10"
                - generic [ref=f5e155] [cursor=pointer]: "11"
                - generic [ref=f5e157] [cursor=pointer]: "12"
                - generic [ref=f5e159] [cursor=pointer]: "13"
                - generic [ref=f5e161] [cursor=pointer]: "14"
                - generic [ref=f5e163] [cursor=pointer]: "15"
                - generic [ref=f5e166] [cursor=pointer]: "16"
                - generic [ref=f5e168] [cursor=pointer]: "17"
                - generic [ref=f5e170] [cursor=pointer]: "18"
                - generic [ref=f5e172] [cursor=pointer]: "19"
                - generic [ref=f5e175] [cursor=pointer]: "20"
                - generic [ref=f5e178] [cursor=pointer]: "21"
                - generic [ref=f5e180] [cursor=pointer]: "22"
                - generic [ref=f5e183] [cursor=pointer]: "23"
                - generic [ref=f5e185] [cursor=pointer]: "24"
                - generic [ref=f5e187] [cursor=pointer]: "25"
                - generic [ref=f5e189] [cursor=pointer]: "26"
                - generic [ref=f5e191] [cursor=pointer]: "27"
                - generic [ref=f5e193] [cursor=pointer]: "28"
                - generic [ref=f5e195] [cursor=pointer]: "29"
                - generic [ref=f5e197] [cursor=pointer]: "30"
            - generic [ref=f5e199]:
              - heading "Sélectionnez une date" [level=3] [ref=f5e200]
              - paragraph [ref=f5e204]: Cliquez sur une date
  - alert [ref=f5e205]
```

# Test source

```ts
  6   |  * aussi en paysage), pour que tout ce qui se décide au chargement suive la largeur. En clair : toutes les largeurs ; en
  7   |  * sombre : les largeurs capturées (360, 768, 1440) et le paysage. Les contrôles sont bloquants à chaque largeur contrôlée.
  8   |  *
  9   |  * Captures (JPEG, échelle 1, fenêtre visible) : .e2e-captures/captures-responsive/<page>__<largeur>__<thème>.jpg ;
  10  |  * résultats : .e2e-captures/responsive/<page>__<thème>.json, résumés par scripts/e2e/responsive-resume.mjs
  11  |  * (responsive.tsv et responsive.txt, publiés sur ci-results).
  12  |  */
  13  | import fs from 'node:fs';
  14  | import path from 'node:path';
  15  | import type { Page } from '@playwright/test';
  16  | import { test, expect, type CaptureRole, type ThemeKey } from './support/fixtures';
  17  | import { readDemoIds, E2E_OUTPUT_DIR, type DemoIds } from './support/demo-ids';
  18  | import { fakeScanMode, installFakeCamera } from './support/fake-camera';
  19  | import {
  20  |     PHONE_MAX_WIDTH, RESPONSIVE_CAPTURE_WIDTHS, RESPONSIVE_LANDSCAPE, RESPONSIVE_PAGES, RESPONSIVE_WIDTHS, type ResponsivePage,
  21  | } from './support/responsive-pages';
  22  | import { runResponsiveChecks } from './support/responsive-checks';
  23  | 
  24  | const RESULTS = path.join(E2E_OUTPUT_DIR, 'responsive');
  25  | const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
  26  | 
  27  | const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
  28  |     { key: 'clair', colorScheme: 'light' },
  29  |     { key: 'sombre', colorScheme: 'dark' },
  30  | ];
  31  | 
  32  | interface Size { width: number; height: number; paysage?: boolean }
  33  | 
  34  | function sizesFor(p: ResponsivePage, theme: ThemeKey): Size[] {
  35  |     const base: Size[] = RESPONSIVE_WIDTHS
  36  |         .filter((w) => theme === 'clair' || RESPONSIVE_CAPTURE_WIDTHS.includes(w.width))
  37  |         .map((w) => ({ width: w.width, height: w.height }));
  38  |     const land: Size[] = p.paysage ? RESPONSIVE_LANDSCAPE.map((w) => ({ width: w.width, height: w.height, paysage: true })) : [];
  39  |     return [...base, ...land];
  40  | }
  41  | 
  42  | /** Page stable : polices chargées, réseau au repos (plafond 3 s, noté sinon), deux images d'affichage. */
  43  | async function settle(page: Page, notes: string[], at: string): Promise<void> {
  44  |     await page.evaluate(() => document.fonts.ready.then(() => true));
  45  |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => { notes.push(`${at} : réseau jamais au repos en 3 s (attente plafonnée)`); });
  46  |     await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete), undefined, { timeout: 5_000 })
  47  |         .catch(() => { notes.push(`${at} : images encore en chargement après 5 s`); });
  48  |     await page.evaluate(() => new Promise<void>((resolve) => { requestAnimationFrame(() => requestAnimationFrame(() => resolve())); }));
  49  | }
  50  | 
  51  | interface ResponsiveRecord {
  52  |     page: string;
  53  |     titre: string;
  54  |     groupe: string;
  55  |     role: CaptureRole;
  56  |     theme: ThemeKey;
  57  |     url: string | null;
  58  |     sizes: Array<{ size: string; blocking: string[]; warnings: string[]; capture: string | null }>;
  59  |     notes: string[];
  60  |     error: string | null;
  61  | }
  62  | 
  63  | for (const theme of THEMES) {
  64  |     const roles = Array.from(new Set(RESPONSIVE_PAGES.map((p) => p.role)));
  65  |     for (const role of roles) {
  66  |         test.describe(`${theme.key} · ${role}`, () => {
  67  |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  68  |             for (const p of RESPONSIVE_PAGES.filter((x) => x.role === role)) {
  69  |                 test(`${p.id} — ${p.titre}`, async ({ page, context, guard }) => {
  70  |                     test.setTimeout(240_000);
  71  |                     const record: ResponsiveRecord = { page: p.id, titre: p.titre, groupe: p.groupe, role, theme: theme.key, url: null, sizes: [], notes: [], error: null };
  72  |                     try {
  73  |                         const demo: DemoIds | null = p.needsIds ? readDemoIds() : null;
  74  |                         record.url = p.path(demo);
  75  |                         guard.configure({ allowFailures: p.allowFailures ?? [], ignoreConsoleErrors: false });
  76  |                         if (p.fakeCamera) await context.addInitScript(installFakeCamera, { mode: fakeScanMode() });
  77  |                         for (const size of sizesFor(p, theme.key)) {
  78  |                             const at = size.paysage ? `${size.width}×${size.height} px (paysage)` : `${size.width} px`;
  79  |                             await page.setViewportSize({ width: size.width, height: size.height });
  80  |                             const response = await page.goto(record.url, { waitUntil: 'load' });
  81  |                             if (p.expectStatus !== undefined) expect(response?.status(), `statut HTTP de ${record.url}`).toBe(p.expectStatus);
  82  |                             if (p.ready) await p.ready(page);
  83  |                             else await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  84  |                             if (p.actions) await p.actions(page);
  85  |                             await settle(page, record.notes, at);
  86  |                             const checks = await runResponsiveChecks(page, { width: size.width, phone: !size.paysage && size.width <= PHONE_MAX_WIDTH });
  87  |                             const blocking = checks.blocking.map((b) => (size.paysage ? b.replace(`${size.width} px`, at) : b));
  88  |                             let capture: string | null = null;
  89  |                             if (size.paysage || RESPONSIVE_CAPTURE_WIDTHS.includes(size.width)) {
  90  |                                 fs.mkdirSync(SHOTS, { recursive: true });
  91  |                                 capture = `${p.id}__${size.paysage ? `${size.width}x${size.height}` : size.width}__${theme.key}.jpg`;
  92  |                                 await page.screenshot({ path: path.join(SHOTS, capture), type: 'jpeg', quality: 80, animations: 'disabled', caret: 'hide', scale: 'css' });
  93  |                             }
  94  |                             record.sizes.push({ size: at, blocking, warnings: checks.warnings, capture });
  95  |                         }
  96  |                     } catch (err) {
  97  |                         record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  98  |                         throw err;
  99  |                     } finally {
  100 |                         // Erreurs de la page (console, requêtes) : notées, déjà bloquantes dans les captures
  101 |                         record.notes.push(...guard.blockingIssues().map((i) => `erreur de la page : ${i}`));
  102 |                         fs.mkdirSync(RESULTS, { recursive: true });
  103 |                         fs.writeFileSync(path.join(RESULTS, `${p.id}__${theme.key}.json`), `${JSON.stringify(record, null, 1)}\n`, 'utf8');
  104 |                     }
  105 |                     const blocking = record.sizes.flatMap((s) => s.blocking);
> 106 |                     expect(blocking, `contrôles responsive de ${p.id} (${theme.key})`).toEqual([]);
      |                                                                                        ^ Error: contrôles responsive de org-calendrier (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```