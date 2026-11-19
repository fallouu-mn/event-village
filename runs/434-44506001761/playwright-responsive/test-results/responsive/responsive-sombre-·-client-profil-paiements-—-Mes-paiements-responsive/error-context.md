# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · client >> profil-paiements — Mes paiements
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de profil-paiements (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
  - generic [ref=f2e2]:
    - complementary [ref=f2e3]:
      - link "Event Village, accueil" [ref=f2e5] [cursor=pointer]:
        - /url: /
        - generic [ref=f2e6]: Event Village
      - navigation "Navigation principale" [ref=f2e9]:
        - generic [ref=f2e10]:
          - paragraph [ref=f2e11]: Menu principal
          - generic [ref=f2e12]:
            - link "Accueil" [ref=f2e13] [cursor=pointer]:
              - /url: /
            - link "Explorer" [ref=f2e18] [cursor=pointer]:
              - /url: /explore
            - link "Mes billets" [ref=f2e23] [cursor=pointer]:
              - /url: /tickets
            - link "Portefeuille" [ref=f2e27] [cursor=pointer]:
              - /url: /wallet
        - generic [ref=f2e32]:
          - paragraph [ref=f2e33]: Espaces métier
          - link "Devenir partenaire" [ref=f2e35] [cursor=pointer]:
            - /url: /partner/register
      - generic [ref=f2e41]:
        - link "Fatou Mbaye Client" [ref=f2e42] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e43]: FM
          - generic [ref=f2e44]:
            - generic [ref=f2e45]: Fatou Mbaye
            - generic [ref=f2e46]: Client
        - generic [ref=f2e47]:
          - button "Se déconnecter" [ref=f2e48] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e53] [cursor=pointer]
    - generic [ref=f2e57]:
      - banner [ref=f2e58]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f2e60] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 7 non lues" [ref=f2e67] [cursor=pointer]:
          - generic [ref=f2e71]: "7"
      - main [ref=f2e72]:
        - generic [ref=f2e74]:
          - generic [ref=f2e75]:
            - link "Mon profil" [ref=f2e77] [cursor=pointer]:
              - /url: /profile
            - heading "Mes paiements" [level=1] [ref=f2e84]
          - generic [ref=f2e85]:
            - generic [ref=f2e86]:
              - paragraph [ref=f2e88]: Total payé
              - paragraph [ref=f2e93]: 56 175 F CFA
            - generic [ref=f2e94]:
              - paragraph [ref=f2e96]: Total remboursé
              - paragraph [ref=f2e101]: 15 750 F CFA
          - list "Liste de vos paiements" [ref=f2e102]:
            - listitem [ref=f2e103]:
              - link "Festival Jazz sur le Fleuve jeu. 19 nov. 2026 à 10:34 Orange Money 7 875 F CFA Échoué" [ref=f2e104] [cursor=pointer]:
                - /url: /paiement/06531a73-cea6-4da5-920a-0b4749a00ac2
                - generic [ref=f2e105]:
                  - generic [ref=f2e106]: Festival Jazz sur le Fleuve
                  - time [ref=f2e108]: jeu. 19 nov. 2026 à 10:34
                  - generic [ref=f2e109]: Orange Money
                - generic [ref=f2e110]:
                  - generic [ref=f2e111]: 7 875 F CFA
                  - generic [ref=f2e112]: Échoué
            - listitem [ref=f2e116]:
              - link "Gala des entrepreneurs du Saloum jeu. 19 nov. 2026 à 10:34 Orange Money 10 500 F CFA En attente" [ref=f2e117] [cursor=pointer]:
                - /url: /paiement/f38b3651-7b86-43d9-b918-54f5fe8d04eb
                - generic [ref=f2e118]:
                  - generic [ref=f2e119]: Gala des entrepreneurs du Saloum
                  - time [ref=f2e121]: jeu. 19 nov. 2026 à 10:34
                  - generic [ref=f2e122]: Orange Money
                - generic [ref=f2e123]:
                  - generic [ref=f2e124]: 10 500 F CFA
                  - generic [ref=f2e125]: En attente
            - listitem [ref=f2e129]:
              - link "Croisière musicale vers Gorée jeu. 19 nov. 2026 à 06:22 Wave 15 750 F CFA Remboursé" [ref=f2e130] [cursor=pointer]:
                - /url: /paiement/1c01b7b7-0c4a-41a9-8225-a7502a48e1af
                - generic [ref=f2e131]:
                  - generic [ref=f2e132]: Croisière musicale vers Gorée
                  - time [ref=f2e134]: jeu. 19 nov. 2026 à 06:22
                  - generic [ref=f2e135]: Wave
                - generic [ref=f2e136]:
                  - generic [ref=f2e137]: 15 750 F CFA
                  - generic [ref=f2e138]: Remboursé
            - listitem [ref=f2e142]:
              - link "Concert des Lumières de Gorée sam. 14 nov. 2026 à 06:36 Orange Money 6 300 F CFA Confirmé" [ref=f2e143] [cursor=pointer]:
                - /url: /paiement/f24be767-f0bd-4627-aed8-b571cacd40f9
                - generic [ref=f2e144]:
                  - generic [ref=f2e145]: Concert des Lumières de Gorée
                  - time [ref=f2e147]: sam. 14 nov. 2026 à 06:36
                  - generic [ref=f2e148]: Orange Money
                - generic [ref=f2e149]:
                  - generic [ref=f2e150]: 6 300 F CFA
                  - generic [ref=f2e151]: Confirmé
            - listitem [ref=f2e155]:
              - link "Festival Jazz sur le Fleuve mer. 11 nov. 2026 à 04:32 Wave 7 875 F CFA Confirmé" [ref=f2e156] [cursor=pointer]:
                - /url: /paiement/5832938a-4ef8-497f-abba-9109af5574c5
                - generic [ref=f2e157]:
                  - generic [ref=f2e158]: Festival Jazz sur le Fleuve
                  - time [ref=f2e160]: mer. 11 nov. 2026 à 04:32
                  - generic [ref=f2e161]: Wave
                - generic [ref=f2e162]:
                  - generic [ref=f2e163]: 7 875 F CFA
                  - generic [ref=f2e164]: Confirmé
            - listitem [ref=f2e168]:
              - link "Nuit du Sabar — édition d’automne mer. 11 nov. 2026 à 03:35 Orange Money 10 500 F CFA Confirmé" [ref=f2e169] [cursor=pointer]:
                - /url: /paiement/a67f5d3e-6393-4401-aaf0-9bcf7043ce3b
                - generic [ref=f2e170]:
                  - generic [ref=f2e171]: Nuit du Sabar — édition d’automne
                  - time [ref=f2e173]: mer. 11 nov. 2026 à 03:35
                  - generic [ref=f2e174]: Orange Money
                - generic [ref=f2e175]:
                  - generic [ref=f2e176]: 10 500 F CFA
                  - generic [ref=f2e177]: Confirmé
            - listitem [ref=f2e181]:
              - link "Brunch électro des Almadies dim. 8 nov. 2026 à 04:15 Wave 15 750 F CFA Confirmé" [ref=f2e182] [cursor=pointer]:
                - /url: /paiement/e2d7b33c-8952-496f-8f42-e893a28792cf
                - generic [ref=f2e183]:
                  - generic [ref=f2e184]: Brunch électro des Almadies
                  - time [ref=f2e186]: dim. 8 nov. 2026 à 04:15
                  - generic [ref=f2e187]: Wave
                - generic [ref=f2e188]:
                  - generic [ref=f2e189]: 15 750 F CFA
                  - generic [ref=f2e190]: Confirmé
  - alert [ref=f2e194]
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
      |                                                                                        ^ Error: contrôles responsive de profil-paiements (sombre)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```