# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · client >> profil-paiements — Mes paiements
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de profil-paiements (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "1024 px : défilement horizontal (largeur du document 1030 px, fenêtre 1024 px)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f5e1]:
  - generic [ref=f5e3]:
    - banner [ref=f5e4]:
      - generic [ref=f5e5]:
        - link "Event Village, accueil" [ref=f5e7] [cursor=pointer]:
          - /url: /
          - generic [ref=f5e8]: Event Village
        - navigation "Rubriques" [ref=f5e13]:
          - link "Accueil" [ref=f5e14] [cursor=pointer]:
            - /url: /
          - link "Explorer" [ref=f5e15] [cursor=pointer]:
            - /url: /explore
          - link "Mes billets" [ref=f5e16] [cursor=pointer]:
            - /url: /tickets
          - link "Portefeuille" [ref=f5e17] [cursor=pointer]:
            - /url: /wallet
      - link "Rechercher un événement…" [ref=f5e19] [cursor=pointer]:
        - /url: /explore
      - generic [ref=f5e24]:
        - button "Notifications, 10 non lues" [ref=f5e26] [cursor=pointer]:
          - generic [ref=f5e30]: "10"
        - button "Fatou Mbaye" [ref=f5e32] [cursor=pointer]:
          - generic [aria-hidden] [ref=f5e33]: FM
    - main [ref=f5e37]:
      - generic [ref=f5e39]:
        - generic [ref=f5e40]:
          - link "Mon profil" [ref=f5e42] [cursor=pointer]:
            - /url: /profile
          - heading "Mes paiements" [level=1] [ref=f5e49]
        - generic [ref=f5e50]:
          - generic [ref=f5e51]:
            - paragraph [ref=f5e53]: Total payé
            - paragraph [ref=f5e58]: 56 175 F CFA
          - generic [ref=f5e59]:
            - paragraph [ref=f5e61]: Total remboursé
            - paragraph [ref=f5e66]: 15 750 F CFA
        - list "Liste de vos paiements" [ref=f5e67]:
          - listitem [ref=f5e68]:
            - link "Festival Jazz sur le Fleuve sam. 21 nov. 2026 à 03:11 Orange Money 7 875 F CFA Échoué" [ref=f5e69] [cursor=pointer]:
              - /url: /paiement/cec59dd0-d8b5-4ed1-a88a-d2bdb0e930f6
              - generic [ref=f5e70]:
                - generic [ref=f5e71]: Festival Jazz sur le Fleuve
                - time [ref=f5e73]: sam. 21 nov. 2026 à 03:11
                - generic [ref=f5e74]: Orange Money
              - generic [ref=f5e75]:
                - generic [ref=f5e76]: 7 875 F CFA
                - generic [ref=f5e77]: Échoué
          - listitem [ref=f5e81]:
            - link "Gala des entrepreneurs du Saloum sam. 21 nov. 2026 à 03:11 Orange Money 10 500 F CFA En attente" [ref=f5e82] [cursor=pointer]:
              - /url: /paiement/88c65add-e4b8-4e5d-9dc0-e38396237281
              - generic [ref=f5e83]:
                - generic [ref=f5e84]: Gala des entrepreneurs du Saloum
                - time [ref=f5e86]: sam. 21 nov. 2026 à 03:11
                - generic [ref=f5e87]: Orange Money
              - generic [ref=f5e88]:
                - generic [ref=f5e89]: 10 500 F CFA
                - generic [ref=f5e90]: En attente
          - listitem [ref=f5e94]:
            - link "Croisière musicale vers Gorée ven. 20 nov. 2026 à 22:58 Wave 15 750 F CFA Remboursé" [ref=f5e95] [cursor=pointer]:
              - /url: /paiement/ca9c9ebc-a167-4742-be68-6b7b5af0cc16
              - generic [ref=f5e96]:
                - generic [ref=f5e97]: Croisière musicale vers Gorée
                - time [ref=f5e99]: ven. 20 nov. 2026 à 22:58
                - generic [ref=f5e100]: Wave
              - generic [ref=f5e101]:
                - generic [ref=f5e102]: 15 750 F CFA
                - generic [ref=f5e103]: Remboursé
          - listitem [ref=f5e107]:
            - link "Concert des Lumières de Gorée dim. 15 nov. 2026 à 23:12 Orange Money 6 300 F CFA Confirmé" [ref=f5e108] [cursor=pointer]:
              - /url: /paiement/50001dbd-e484-4d61-aed2-e945e820a39d
              - generic [ref=f5e109]:
                - generic [ref=f5e110]: Concert des Lumières de Gorée
                - time [ref=f5e112]: dim. 15 nov. 2026 à 23:12
                - generic [ref=f5e113]: Orange Money
              - generic [ref=f5e114]:
                - generic [ref=f5e115]: 6 300 F CFA
                - generic [ref=f5e116]: Confirmé
          - listitem [ref=f5e120]:
            - link "Festival Jazz sur le Fleuve jeu. 12 nov. 2026 à 21:08 Wave 7 875 F CFA Confirmé" [ref=f5e121] [cursor=pointer]:
              - /url: /paiement/8424f4f2-452c-49e7-96bb-6ba1c40d9354
              - generic [ref=f5e122]:
                - generic [ref=f5e123]: Festival Jazz sur le Fleuve
                - time [ref=f5e125]: jeu. 12 nov. 2026 à 21:08
                - generic [ref=f5e126]: Wave
              - generic [ref=f5e127]:
                - generic [ref=f5e128]: 7 875 F CFA
                - generic [ref=f5e129]: Confirmé
          - listitem [ref=f5e133]:
            - link "Nuit du Sabar — édition d’automne jeu. 12 nov. 2026 à 20:11 Orange Money 10 500 F CFA Confirmé" [ref=f5e134] [cursor=pointer]:
              - /url: /paiement/0301df9e-7ffe-4f7a-87b5-957603542b69
              - generic [ref=f5e135]:
                - generic [ref=f5e136]: Nuit du Sabar — édition d’automne
                - time [ref=f5e138]: jeu. 12 nov. 2026 à 20:11
                - generic [ref=f5e139]: Orange Money
              - generic [ref=f5e140]:
                - generic [ref=f5e141]: 10 500 F CFA
                - generic [ref=f5e142]: Confirmé
          - listitem [ref=f5e146]:
            - link "Brunch électro des Almadies mar. 10 nov. 2026 à 04:15 Wave 15 750 F CFA Confirmé" [ref=f5e147] [cursor=pointer]:
              - /url: /paiement/d46fe225-0fe3-4e54-84fb-6887327e1287
              - generic [ref=f5e148]:
                - generic [ref=f5e149]: Brunch électro des Almadies
                - time [ref=f5e151]: mar. 10 nov. 2026 à 04:15
                - generic [ref=f5e152]: Wave
              - generic [ref=f5e153]:
                - generic [ref=f5e154]: 15 750 F CFA
                - generic [ref=f5e155]: Confirmé
  - alert [ref=f5e159]
```

# Test source

```ts
  20  | import path from 'node:path';
  21  | import type { Page } from '@playwright/test';
  22  | import { test, expect, type CaptureRole, type ThemeKey } from './support/fixtures';
  23  | import { readDemoIds, E2E_OUTPUT_DIR, type DemoIds } from './support/demo-ids';
  24  | import { fakeScanMode, installFakeCamera } from './support/fake-camera';
  25  | import { keepHomeOutOfHallsWindow } from './support/halls-switch';
  26  | import {
  27  |     PHONE_MAX_WIDTH, RESPONSIVE_CAPTURE_WIDTHS, RESPONSIVE_LANDSCAPE, RESPONSIVE_PAGES, RESPONSIVE_WIDTHS, type ResponsivePage,
  28  | } from './support/responsive-pages';
  29  | import { runResponsiveChecks } from './support/responsive-checks';
  30  | 
  31  | const RESULTS = path.join(E2E_OUTPUT_DIR, 'responsive');
  32  | const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
  33  | 
  34  | const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
  35  |     { key: 'clair', colorScheme: 'light' },
  36  |     { key: 'sombre', colorScheme: 'dark' },
  37  | ];
  38  | 
  39  | interface Size { width: number; height: number; paysage?: boolean }
  40  | 
  41  | function sizesFor(p: ResponsivePage, theme: ThemeKey): Size[] {
  42  |     const base: Size[] = RESPONSIVE_WIDTHS
  43  |         .filter((w) => theme === 'clair' || RESPONSIVE_CAPTURE_WIDTHS.includes(w.width))
  44  |         .map((w) => ({ width: w.width, height: w.height }));
  45  |     const land: Size[] = p.paysage ? RESPONSIVE_LANDSCAPE.map((w) => ({ width: w.width, height: w.height, paysage: true })) : [];
  46  |     return [...base, ...land];
  47  | }
  48  | 
  49  | /** Page stable : polices chargées, réseau au repos (plafond 3 s, noté sinon), deux images d'affichage. */
  50  | async function settle(page: Page, notes: string[], at: string): Promise<void> {
  51  |     await page.evaluate(() => document.fonts.ready.then(() => true));
  52  |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => { notes.push(`${at} : réseau jamais au repos en 3 s (attente plafonnée)`); });
  53  |     await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete), undefined, { timeout: 5_000 })
  54  |         .catch(() => { notes.push(`${at} : images encore en chargement après 5 s`); });
  55  |     await page.evaluate(() => new Promise<void>((resolve) => { requestAnimationFrame(() => requestAnimationFrame(() => resolve())); }));
  56  | }
  57  | 
  58  | interface ResponsiveRecord {
  59  |     page: string;
  60  |     titre: string;
  61  |     groupe: string;
  62  |     role: CaptureRole;
  63  |     theme: ThemeKey;
  64  |     url: string | null;
  65  |     sizes: Array<{ size: string; blocking: string[]; warnings: string[]; capture: string | null }>;
  66  |     notes: string[];
  67  |     error: string | null;
  68  | }
  69  | 
  70  | for (const theme of THEMES) {
  71  |     const roles = Array.from(new Set(RESPONSIVE_PAGES.map((p) => p.role)));
  72  |     for (const role of roles) {
  73  |         test.describe(`${theme.key} · ${role}`, () => {
  74  |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  75  |             for (const p of RESPONSIVE_PAGES.filter((x) => x.role === role)) {
  76  |                 test(`${p.id} — ${p.titre}`, async ({ page, context, guard, hallsLock }) => {
  77  |                     test.setTimeout(240_000);
  78  |                     const record: ResponsiveRecord = { page: p.id, titre: p.titre, groupe: p.groupe, role, theme: theme.key, url: null, sizes: [], notes: [], error: null };
  79  |                     try {
  80  |                         // Lot 10b : verrou des salles avant tout chargement (attente ajoutée au délai du test)
  81  |                         await hallsLock.enter(p.salles ? 'salles' : 'autres');
  82  |                         if (hallsLock.waitedMs >= 1_000) record.notes.push(`attente du verrou des salles : ${Math.round(hallsLock.waitedMs / 1000)} s`);
  83  |                         if (p.salles) {
  84  |                             record.notes.push('page des salles : interrupteur features.halls_enabled ouvert le temps du test (e2e/support/halls-switch.ts)');
  85  |                             await keepHomeOutOfHallsWindow(page);
  86  |                         }
  87  |                         const demo: DemoIds | null = p.needsIds ? readDemoIds() : null;
  88  |                         record.url = p.path(demo);
  89  |                         guard.configure({ allowFailures: p.allowFailures ?? [], ignoreConsoleErrors: false });
  90  |                         if (p.fakeCamera) await context.addInitScript(installFakeCamera, { mode: fakeScanMode() });
  91  |                         for (const size of sizesFor(p, theme.key)) {
  92  |                             const at = size.paysage ? `${size.width}×${size.height} px (paysage)` : `${size.width} px`;
  93  |                             await page.setViewportSize({ width: size.width, height: size.height });
  94  |                             const response = await page.goto(record.url, { waitUntil: 'load' });
  95  |                             if (p.expectStatus !== undefined) expect(response?.status(), `statut HTTP de ${record.url}`).toBe(p.expectStatus);
  96  |                             if (p.ready) await p.ready(page);
  97  |                             else await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  98  |                             if (p.actions) await p.actions(page);
  99  |                             await settle(page, record.notes, at);
  100 |                             const checks = await runResponsiveChecks(page, { width: size.width, phone: !size.paysage && size.width <= PHONE_MAX_WIDTH });
  101 |                             const blocking = checks.blocking.map((b) => (size.paysage ? b.replace(`${size.width} px`, at) : b));
  102 |                             let capture: string | null = null;
  103 |                             if (size.paysage || RESPONSIVE_CAPTURE_WIDTHS.includes(size.width)) {
  104 |                                 fs.mkdirSync(SHOTS, { recursive: true });
  105 |                                 capture = `${p.id}__${size.paysage ? `${size.width}x${size.height}` : size.width}__${theme.key}.jpg`;
  106 |                                 await page.screenshot({ path: path.join(SHOTS, capture), type: 'jpeg', quality: 80, animations: 'disabled', caret: 'hide', scale: 'css' });
  107 |                             }
  108 |                             record.sizes.push({ size: at, blocking, warnings: checks.warnings, capture });
  109 |                         }
  110 |                     } catch (err) {
  111 |                         record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  112 |                         throw err;
  113 |                     } finally {
  114 |                         // Erreurs de la page (console, requêtes) : notées, déjà bloquantes dans les captures
  115 |                         record.notes.push(...guard.blockingIssues().map((i) => `erreur de la page : ${i}`));
  116 |                         fs.mkdirSync(RESULTS, { recursive: true });
  117 |                         fs.writeFileSync(path.join(RESULTS, `${p.id}__${theme.key}.json`), `${JSON.stringify(record, null, 1)}\n`, 'utf8');
  118 |                     }
  119 |                     const blocking = record.sizes.flatMap((s) => s.blocking);
> 120 |                     expect(blocking, `contrôles responsive de ${p.id} (${theme.key})`).toEqual([]);
      |                                                                                        ^ Error: contrôles responsive de profil-paiements (clair)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```