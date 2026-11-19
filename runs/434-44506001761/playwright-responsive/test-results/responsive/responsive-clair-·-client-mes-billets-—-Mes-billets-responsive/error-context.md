# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · client >> mes-billets — Mes billets
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de mes-billets (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 6

- Array []
+ Array [
+   "320 px : texte tronqué sans le texte entier : dd.mt-0.5.truncate « Esplanade de la Corniche Ouest » (points de suspension, texte entier absent)",
+   "320 px : textes qui se chevauchent : h2.mt-0.5.line-clamp-2 « Nuit du Sabar — édition d’automne » sur p.mt-0.5.truncate « Baobab Scène » (94×18 px)",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "1024 px : texte tronqué sans le texte entier : span.block.truncate « Fatou Mbaye » (points de suspension, texte entier absent)",
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
        - link "Fatou Mbaye Client" [ref=f5e42] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f5e43]: FM
          - generic [ref=f5e44]:
            - generic [ref=f5e45]: Fatou Mbaye
            - generic [ref=f5e46]: Client
        - generic [ref=f5e47]:
          - button "Se déconnecter" [ref=f5e48] [cursor=pointer]
          - button "Basculer le thème" [ref=f5e53] [cursor=pointer]
    - generic [ref=f5e57]:
      - banner [ref=f5e58]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f5e60] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 7 non lues" [ref=f5e67] [cursor=pointer]:
          - generic [ref=f5e71]: "7"
      - main [ref=f5e72]:
        - generic [ref=f5e74]:
          - generic [ref=f5e76]:
            - generic [ref=f5e77]:
              - status [ref=f5e79]: En direct
              - heading "Mes billets" [level=1] [ref=f5e81]
              - paragraph [ref=f5e82]: "Présentez le QR code à l’entrée : il se renouvelle tout seul. Glissez d’un billet à l’autre, et touchez le QR pour l’afficher en grand."
            - generic [ref=f5e83]:
              - link "Mes billets sans réseau" [ref=f5e84] [cursor=pointer]:
                - /url: /billet/hors-ligne
              - button "Comment marche le transfert ?" [ref=f5e92] [cursor=pointer]
              - link "Réserver un billet" [ref=f5e98] [cursor=pointer]:
                - /url: /explore
          - tablist "Filtrer mes billets" [ref=f5e105]:
            - tab "À venir" [selected] [ref=f5e106] [cursor=pointer]
            - tab "Tous mes billets" [ref=f5e108] [cursor=pointer]
            - tab "Historique" [ref=f5e110] [cursor=pointer]
            - tab "Reçus , 1" [ref=f5e112] [cursor=pointer]:
              - generic [ref=f5e113]: Reçus
              - generic [ref=f5e114]:
                - generic [ref=f5e115]: ","
                - text: "1"
          - tabpanel "À venir" [ref=f5e116]:
            - region "Billets à venir" [ref=f5e117]:
              - 'list "Billets à venir : glissez ou utilisez les flèches pour passer d’un billet à l’autre" [ref=f5e118]':
                - listitem [ref=f5e119]:
                  - article "Billet pour Nuit du Sabar — édition d’automne" [ref=f5e121]:
                    - generic [ref=f5e122]:
                      - generic [ref=f5e123]:
                        - generic [ref=f5e126]:
                          - paragraph [ref=f5e127]:
                            - generic [ref=f5e128]: "Catégorie :"
                            - text: Standard
                          - heading "Nuit du Sabar — édition d’automne" [level=2] [ref=f5e129]
                          - paragraph [ref=f5e130]: Baobab Scène
                        - generic [ref=f5e131]:
                          - 'generic "Billet valable : présentez son code d’entrée au contrôle." [ref=f5e132]': Valable
                          - generic [ref=f5e135]: Dans 53 min
                      - generic [ref=f5e142]:
                        - generic [ref=f5e143]:
                          - generic [ref=f5e144]:
                            - term [ref=f5e145]: Date
                            - definition [ref=f5e146]: 19 NOV 2026
                          - generic [ref=f5e147]:
                            - term [ref=f5e148]: Heure d’accès
                            - definition [ref=f5e149]: 11:30
                          - generic [ref=f5e150]:
                            - term [ref=f5e151]: Lieu
                            - definition [ref=f5e152]: Esplanade de la Corniche Ouest
                          - generic [ref=f5e153]:
                            - term [ref=f5e154]: Prix
                            - definition [ref=f5e155]: 5 000 F CFA
                          - generic [ref=f5e156]:
                            - term [ref=f5e157]: Frais de service
                            - definition [ref=f5e158]: 250 F CFA
                        - generic [ref=f5e159]:
                          - button "Agrandir le QR code en plein écran" [ref=f5e160] [cursor=pointer]:
                            - img "QR d’entrée dynamique" [ref=f5e161]
                          - paragraph [ref=f5e164]:
                            - generic [ref=f5e165]: "Numéro du billet :"
                            - text: TCK-20261119-91EE0E36B6
                          - paragraph [ref=f5e166]: Touchez le QR pour l’agrandir.
                          - generic [ref=f5e167]:
                            - generic [ref=f5e168]:
                              - generic [ref=f5e169]: Code renouvelé toutes les 20 s
                              - generic [ref=f5e171]:
                                - generic [aria-hidden] [ref=f5e172]: 15 s
                                - generic [ref=f5e173]: Nouveau code dans 15 secondes
                            - paragraph [ref=f5e174]: Une capture d’écran n’est pas acceptée au contrôle.
                            - paragraph [ref=f5e175]:
                              - generic [ref=f5e180]: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
                          - status [ref=f5e182]:
                            - generic [ref=f5e185]: Ouvrez ce billet avec du réseau avant d’arriver
                          - paragraph [ref=f5e186]:
                            - generic [ref=f5e190]: Billet authentique, émis par Event Village
                    - generic [ref=f5e191]:
                      - button "Transférer" [ref=f5e192] [cursor=pointer]
                      - button "Partager le lien de l’événement sur WhatsApp" [ref=f5e198] [cursor=pointer]:
                        - generic [ref=f5e202]: WhatsApp
                      - button "Partager ou copier le lien de l’événement" [ref=f5e203] [cursor=pointer]:
                        - generic [ref=f5e211]: Lien
                      - button "Télécharger le billet en PDF" [ref=f5e212] [cursor=pointer]:
                        - generic [ref=f5e217]: PDF
                      - button "Aide au transfert" [ref=f5e218] [cursor=pointer]
                - listitem [ref=f5e224]:
                  - article "Billet pour Concert des Lumières de Gorée" [ref=f5e226]:
                    - generic [ref=f5e227]:
                      - generic [ref=f5e228]:
                        - generic [ref=f5e231]:
                          - paragraph [ref=f5e232]:
                            - generic [ref=f5e233]: "Catégorie :"
                            - text: Entrée
                          - heading "Concert des Lumières de Gorée" [level=2] [ref=f5e234]
                          - paragraph [ref=f5e235]: Baobab Scène
                        - generic [ref=f5e236]:
                          - 'generic "Billet valable : présentez son code d’entrée au contrôle." [ref=f5e237]': Valable
                          - generic [ref=f5e240]: Dans 20 h 8 min
                      - generic [ref=f5e247]:
                        - generic [ref=f5e248]:
                          - generic [ref=f5e249]:
                            - term [ref=f5e250]: Date
                            - definition [ref=f5e251]: 20 NOV 2026
                          - generic [ref=f5e252]:
                            - term [ref=f5e253]: Heure d’accès
                            - definition [ref=f5e254]: 06:45
                          - generic [ref=f5e255]:
                            - term [ref=f5e256]: Lieu
                            - definition [ref=f5e257]: Place du Gouvernement
                          - generic [ref=f5e258]:
                            - term [ref=f5e259]: Prix
                            - definition [ref=f5e260]: 6 000 F CFA
                          - generic [ref=f5e261]:
                            - term [ref=f5e262]: Frais de service
                            - definition [ref=f5e263]: 300 F CFA
                        - generic [ref=f5e264]:
                          - button "Agrandir le QR code en plein écran" [ref=f5e265] [cursor=pointer]:
                            - img "QR d’entrée dynamique" [ref=f5e266]
                          - paragraph [ref=f5e269]:
                            - generic [ref=f5e270]: "Numéro du billet :"
                            - text: TCK-20261119-BCBF48F15A
                          - paragraph [ref=f5e271]: Touchez le QR pour l’agrandir.
                          - generic [ref=f5e272]:
                            - generic [ref=f5e273]:
                              - generic [ref=f5e274]: Code renouvelé toutes les 20 s
                              - generic [ref=f5e276]:
                                - generic [aria-hidden] [ref=f5e277]: 15 s
                                - generic [ref=f5e278]: Nouveau code dans 15 secondes
                            - paragraph [ref=f5e279]: Une capture d’écran n’est pas acceptée au contrôle.
                            - paragraph [ref=f5e280]:
                              - generic [ref=f5e285]: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
                          - status [ref=f5e287]:
                            - generic [ref=f5e290]: Ouvrez ce billet avec du réseau avant d’arriver
                          - paragraph [ref=f5e291]:
                            - generic [ref=f5e295]: Billet authentique, émis par Event Village
                    - generic [ref=f5e296]:
                      - button "Transférer" [ref=f5e297] [cursor=pointer]
                      - button "Partager le lien de l’événement sur WhatsApp" [ref=f5e303] [cursor=pointer]:
                        - generic [ref=f5e307]: WhatsApp
                      - button "Partager ou copier le lien de l’événement" [ref=f5e308] [cursor=pointer]:
                        - generic [ref=f5e316]: Lien
                      - button "Télécharger le billet en PDF" [ref=f5e317] [cursor=pointer]:
                        - generic [ref=f5e322]: PDF
                      - button "Aide au transfert" [ref=f5e323] [cursor=pointer]
                - listitem [ref=f5e329]:
                  - article "Billet pour Festival Jazz sur le Fleuve" [ref=f5e331]:
                    - generic [ref=f5e332]:
                      - generic [ref=f5e333]:
                        - generic [ref=f5e336]:
                          - paragraph [ref=f5e337]:
                            - generic [ref=f5e338]: "Catégorie :"
                            - text: Pass soirée
                          - heading "Festival Jazz sur le Fleuve" [level=2] [ref=f5e339]
                          - paragraph [ref=f5e340]: Baobab Scène
                        - generic [ref=f5e341]:
                          - 'generic "Billet valable : présentez son code d’entrée au contrôle." [ref=f5e342]': Valable
                          - generic [ref=f5e345]: Dans 12 jours et 7 h
                      - generic [ref=f5e352]:
                        - generic [ref=f5e353]:
                          - generic [ref=f5e354]:
                            - term [ref=f5e355]: Date
                            - definition [ref=f5e356]: 01 DÉC 2026
                          - generic [ref=f5e357]:
                            - term [ref=f5e358]: Heure d’accès
                            - definition [ref=f5e359]: 18:00
                          - generic [ref=f5e360]:
                            - term [ref=f5e361]: Lieu
                            - definition [ref=f5e362]: Quai des Pêcheurs
                          - generic [ref=f5e363]:
                            - term [ref=f5e364]: Prix
                            - definition [ref=f5e365]: 7 500 F CFA
                          - generic [ref=f5e366]:
                            - term [ref=f5e367]: Frais de service
                            - definition [ref=f5e368]: 375 F CFA
                        - generic [ref=f5e369]:
                          - button "Agrandir le QR code en plein écran" [ref=f5e370] [cursor=pointer]:
                            - img "QR d’entrée dynamique" [ref=f5e371]
                          - paragraph [ref=f5e374]:
                            - generic [ref=f5e375]: "Numéro du billet :"
                            - text: TCK-20261119-74BA27D443
                          - paragraph [ref=f5e376]: Touchez le QR pour l’agrandir.
                          - generic [ref=f5e377]:
                            - generic [ref=f5e378]:
                              - generic [ref=f5e379]: Code renouvelé toutes les 20 s
                              - generic [ref=f5e381]:
                                - generic [aria-hidden] [ref=f5e382]: 15 s
                                - generic [ref=f5e383]: Nouveau code dans 15 secondes
                            - paragraph [ref=f5e384]: Une capture d’écran n’est pas acceptée au contrôle.
                            - paragraph [ref=f5e385]:
                              - generic [ref=f5e390]: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
                          - status [ref=f5e392]:
                            - generic [ref=f5e396]: Disponible sans réseau à partir du lun. 30 nov. 2026 à 18:00
                          - paragraph [ref=f5e397]:
                            - generic [ref=f5e401]: Billet authentique, émis par Event Village
                    - generic [ref=f5e402]:
                      - button "Transférer" [ref=f5e403] [cursor=pointer]
                      - button "Partager le lien de l’événement sur WhatsApp" [ref=f5e409] [cursor=pointer]:
                        - generic [ref=f5e413]: WhatsApp
                      - button "Partager ou copier le lien de l’événement" [ref=f5e414] [cursor=pointer]:
                        - generic [ref=f5e422]: Lien
                      - button "Télécharger le billet en PDF" [ref=f5e423] [cursor=pointer]:
                        - generic [ref=f5e428]: PDF
                      - button "Aide au transfert" [ref=f5e429] [cursor=pointer]
  - alert [ref=f5e435]
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
      |                                                                                        ^ Error: contrôles responsive de mes-billets (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```