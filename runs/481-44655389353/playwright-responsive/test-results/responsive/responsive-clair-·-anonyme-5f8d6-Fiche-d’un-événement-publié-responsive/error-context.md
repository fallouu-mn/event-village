# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · anonyme >> fiche — Fiche d’un événement publié
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de fiche (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "1024 px : textes qui se chevauchent : h2.scroll-mt-24.text-xl « Billetterie » sur span.inline-flex.items-center « En direct » (5×18 px)",
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
          - paragraph [ref=f5e11]: Menu principal
          - generic [ref=f5e12]:
            - link "Accueil" [ref=f5e13] [cursor=pointer]:
              - /url: /
            - link "Explorer" [ref=f5e18] [cursor=pointer]:
              - /url: /explore
            - link "Mes billets" [ref=f5e23] [cursor=pointer]:
              - /url: /tickets
            - link "Portefeuille" [ref=f5e27] [cursor=pointer]:
              - /url: /wallet
        - generic [ref=f5e32]:
          - paragraph [ref=f5e33]: Espaces métier
          - link "Devenir partenaire" [ref=f5e35] [cursor=pointer]:
            - /url: /partner/register
      - generic [ref=f5e41]:
        - link "Se connecter" [ref=f5e42] [cursor=pointer]:
          - /url: /login
        - button "Basculer le thème" [ref=f5e48] [cursor=pointer]
    - generic [ref=f5e52]:
      - banner [ref=f5e53]:
        - link "Rechercher un événement…" [ref=f5e55] [cursor=pointer]:
          - /url: /explore
        - button "Notifications" [ref=f5e62] [cursor=pointer]
      - main [ref=f5e66]:
        - generic [ref=f5e68]:
          - region [ref=f5e69]:
            - generic [ref=f5e70]:
              - link "Retour aux événements" [ref=f5e71] [cursor=pointer]:
                - /url: /explore
              - generic [ref=f5e74]:
                - 'button "Mettre en favori : Festival Jazz sur le Fleuve" [ref=f5e75] [cursor=pointer]'
                - button "Partager l’événement" [ref=f5e78] [cursor=pointer]:
                  - generic [aria-hidden] [ref=f5e85]: Partager
            - generic [ref=f5e86]:
              - img "Affiche de l’événement Festival Jazz sur le Fleuve" [ref=f5e88]
              - generic [ref=f5e89]:
                - generic [ref=f5e90]: Festivals
                - heading "Festival Jazz sur le Fleuve" [level=1] [ref=f5e93]
                - paragraph [ref=f5e94]: Organisé par Baobab Scène
                - list "Date et lieu" [ref=f5e95]:
                  - listitem [ref=f5e96]:
                    - generic [ref=f5e99]:
                      - generic [ref=f5e100]: Mercredi 2 décembre 2026 à 18:00
                      - generic [ref=f5e101]: Jusqu’au jeudi 3 décembre à 00:00
                  - listitem [ref=f5e102]:
                    - generic [ref=f5e106]:
                      - generic [ref=f5e107]: Quai des Pêcheurs
                      - generic [ref=f5e108]: Quai des Pêcheurs, Saint-Louis · Saint-Louis
          - generic [ref=f5e110]:
            - article [ref=f5e111]:
              - list "Infos de l’événement" [ref=f5e112]:
                - listitem [ref=f5e113]:
                  - generic [ref=f5e117]:
                    - paragraph [ref=f5e118]: Billet dans l’application
                    - paragraph [ref=f5e119]: Présentez son QR code à l’entrée, depuis Mes billets.
              - region [ref=f5e120]:
                - heading "À propos" [level=2] [ref=f5e121]
                - paragraph [ref=f5e122]: "Deux soirées de jazz au bord du fleuve : quartets, big band du conservatoire et jam session de clôture."
              - region [ref=f5e123]:
                - heading "Programme" [level=2] [ref=f5e124]
                - list [ref=f5e125]:
                  - listitem [ref=f5e126]:
                    - generic [ref=f5e128]:
                      - paragraph [ref=f5e129]: 18:00
                      - generic [ref=f5e130]: Activité
                    - paragraph [ref=f5e132]: Accueil et marché des créateurs
                  - listitem [ref=f5e133]:
                    - generic [ref=f5e135]:
                      - paragraph [ref=f5e136]: 19:30
                      - generic [ref=f5e137]: Artiste
                    - paragraph [ref=f5e139]: Quartet d’ouverture
                    - paragraph [ref=f5e140]: Quartet Langue de Barbarie
                  - listitem [ref=f5e141]:
                    - generic [ref=f5e143]:
                      - paragraph [ref=f5e144]: 21:30
                      - generic [ref=f5e145]: Artiste
                    - paragraph [ref=f5e147]: Big band
                    - paragraph [ref=f5e148]: Big band du conservatoire régional
              - region [ref=f5e149]:
                - heading "Lieu et accès" [level=2] [ref=f5e150]
                - generic [ref=f5e151]:
                  - paragraph [ref=f5e152]: Quai des Pêcheurs
                  - paragraph [ref=f5e153]: Quai des Pêcheurs, Saint-Louis · Saint-Louis
                - generic [ref=f5e154]:
                  - img "Festival Jazz sur le Fleuve, Quai des Pêcheurs" [ref=f5e161]:
                    - generic [ref=f5e162]: Festival Jazz sur le Fleuve
                  - button "Afficher la carte" [ref=f5e166] [cursor=pointer]
                - link "Voir l’itinéraire" [ref=f5e171] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=16.0179,-16.4896
                - generic [ref=f5e181]:
                  - generic [ref=f5e188]:
                    - paragraph [ref=f5e189]: Stationnement
                    - generic [ref=f5e190]: Stationnement surveillé à proximité.
                  - generic [ref=f5e196]:
                    - paragraph [ref=f5e197]: Paiement
                    - generic [ref=f5e198]: Wave ou Orange Money, en ligne. Les frais de service s’affichent avant le paiement.
                  - generic [ref=f5e204]:
                    - paragraph [ref=f5e205]: Règlement et consignes
                    - generic [ref=f5e206]: Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.
              - region "Organisateur" [ref=f5e207]:
                - generic [ref=f5e209]:
                  - paragraph [ref=f5e210]: Organisateur
                  - paragraph [ref=f5e211]: Baobab Scène
            - complementary [ref=f5e212]:
              - generic [ref=f5e213]:
                - generic [ref=f5e214]:
                  - generic [ref=f5e215]:
                    - heading "Billetterie" [level=2] [ref=f5e216]
                    - paragraph [ref=f5e217]: "Choisissez vos billets : places mises à jour en direct."
                  - status [ref=f5e218]: En direct
                - list "Catégories de billets" [ref=f5e220]:
                  - listitem [ref=f5e221]:
                    - generic [ref=f5e223]:
                      - generic [ref=f5e224]:
                        - heading "Pass soirée" [level=3] [ref=f5e225]
                        - paragraph [ref=f5e226]: 7 500 F CFA
                        - paragraph [ref=f5e227]: Disponible
                        - paragraph [ref=f5e228]: Une soirée au choix.
                      - group "Quantité Pass soirée" [ref=f5e229]:
                        - button "Retirer un billet Pass soirée" [disabled] [ref=f5e230]
                        - status [ref=f5e233]: "0"
                        - button "Ajouter un billet Pass soirée" [ref=f5e234] [cursor=pointer]
                  - listitem [ref=f5e237]:
                    - generic [ref=f5e239]:
                      - generic [ref=f5e240]:
                        - heading "Pass deux soirs" [level=3] [ref=f5e241]
                        - paragraph [ref=f5e242]: 12 000 F CFA
                        - paragraph [ref=f5e243]: Disponible
                        - paragraph [ref=f5e244]: Les deux soirées.
                      - group "Quantité Pass deux soirs" [ref=f5e245]:
                        - button "Retirer un billet Pass deux soirs" [disabled] [ref=f5e246]
                        - status [ref=f5e249]: "0"
                        - button "Ajouter un billet Pass deux soirs" [ref=f5e250] [cursor=pointer]
                - paragraph [ref=f5e253]: Choisissez au moins un billet avec le bouton « + ».
                - generic [ref=f5e254]:
                  - paragraph [ref=f5e255]:
                    - generic [ref=f5e256]: Payer avec
                    - generic [ref=f5e257]: Wave
                    - generic [ref=f5e259]: ou
                    - generic [ref=f5e260]: Orange Money
                  - paragraph [ref=f5e262]: Billet avec QR code dans Mes billets, dès le paiement
  - alert [ref=f5e266]
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
      |                                                                                        ^ Error: contrôles responsive de fiche (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```