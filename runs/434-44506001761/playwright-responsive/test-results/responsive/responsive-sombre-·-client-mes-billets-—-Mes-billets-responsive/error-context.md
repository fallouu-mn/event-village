# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · client >> mes-billets — Mes billets
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de mes-billets (sombre)

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
          - generic [ref=f2e76]:
            - generic [ref=f2e77]:
              - status [ref=f2e79]: En direct
              - heading "Mes billets" [level=1] [ref=f2e81]
              - paragraph [ref=f2e82]: "Présentez le QR code à l’entrée : il se renouvelle tout seul. Glissez d’un billet à l’autre, et touchez le QR pour l’afficher en grand."
            - generic [ref=f2e83]:
              - link "Mes billets sans réseau" [ref=f2e84] [cursor=pointer]:
                - /url: /billet/hors-ligne
              - button "Comment marche le transfert ?" [ref=f2e92] [cursor=pointer]
              - link "Réserver un billet" [ref=f2e98] [cursor=pointer]:
                - /url: /explore
          - tablist "Filtrer mes billets" [ref=f2e105]:
            - tab "À venir" [selected] [ref=f2e106] [cursor=pointer]
            - tab "Tous mes billets" [ref=f2e108] [cursor=pointer]
            - tab "Historique" [ref=f2e110] [cursor=pointer]
            - tab "Reçus , 1" [ref=f2e112] [cursor=pointer]:
              - generic [ref=f2e113]: Reçus
              - generic [ref=f2e114]:
                - generic [ref=f2e115]: ","
                - text: "1"
          - tabpanel "À venir" [ref=f2e116]:
            - region "Billets à venir" [ref=f2e117]:
              - 'list "Billets à venir : glissez ou utilisez les flèches pour passer d’un billet à l’autre" [ref=f2e118]':
                - listitem [ref=f2e119]:
                  - article "Billet pour Nuit du Sabar — édition d’automne" [ref=f2e121]:
                    - generic [ref=f2e122]:
                      - generic [ref=f2e123]:
                        - generic [ref=f2e126]:
                          - paragraph [ref=f2e127]:
                            - generic [ref=f2e128]: "Catégorie :"
                            - text: Standard
                          - heading "Nuit du Sabar — édition d’automne" [level=2] [ref=f2e129]
                          - paragraph [ref=f2e130]: Baobab Scène
                        - generic [ref=f2e131]:
                          - 'generic "Billet valable : présentez son code d’entrée au contrôle." [ref=f2e132]': Valable
                          - generic [ref=f2e135]: Dans 47 min
                      - generic [ref=f2e142]:
                        - generic [ref=f2e143]:
                          - generic [ref=f2e144]:
                            - term [ref=f2e145]: Date
                            - definition [ref=f2e146]: 19 NOV 2026
                          - generic [ref=f2e147]:
                            - term [ref=f2e148]: Heure d’accès
                            - definition [ref=f2e149]: 11:30
                          - generic [ref=f2e150]:
                            - term [ref=f2e151]: Lieu
                            - definition [ref=f2e152]: Esplanade de la Corniche Ouest
                          - generic [ref=f2e153]:
                            - term [ref=f2e154]: Prix
                            - definition [ref=f2e155]: 5 000 F CFA
                          - generic [ref=f2e156]:
                            - term [ref=f2e157]: Frais de service
                            - definition [ref=f2e158]: 250 F CFA
                        - generic [ref=f2e159]:
                          - button "Agrandir le QR code en plein écran" [ref=f2e160] [cursor=pointer]:
                            - img "QR d’entrée dynamique" [ref=f2e161]
                          - paragraph [ref=f2e164]:
                            - generic [ref=f2e165]: "Numéro du billet :"
                            - text: TCK-20261119-91EE0E36B6
                          - paragraph [ref=f2e166]: Touchez le QR pour l’agrandir.
                          - generic [ref=f2e167]:
                            - generic [ref=f2e168]:
                              - generic [ref=f2e169]: Code renouvelé toutes les 20 s
                              - generic [ref=f2e171]:
                                - generic [aria-hidden] [ref=f2e172]: 9 s
                                - generic [ref=f2e173]: Nouveau code dans 9 secondes
                            - paragraph [ref=f2e174]: Une capture d’écran n’est pas acceptée au contrôle.
                            - paragraph [ref=f2e175]:
                              - generic [ref=f2e180]: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
                          - status [ref=f2e182]:
                            - generic [ref=f2e185]: Ouvrez ce billet avec du réseau avant d’arriver
                          - paragraph [ref=f2e186]:
                            - generic [ref=f2e190]: Billet authentique, émis par Event Village
                    - generic [ref=f2e191]:
                      - button "Transférer" [ref=f2e192] [cursor=pointer]
                      - button "Partager le lien de l’événement sur WhatsApp" [ref=f2e198] [cursor=pointer]:
                        - generic [ref=f2e202]: WhatsApp
                      - button "Partager ou copier le lien de l’événement" [ref=f2e203] [cursor=pointer]:
                        - generic [ref=f2e211]: Lien
                      - button "Télécharger le billet en PDF" [ref=f2e212] [cursor=pointer]:
                        - generic [ref=f2e217]: PDF
                      - button "Aide au transfert" [ref=f2e218] [cursor=pointer]
                - listitem [ref=f2e224]:
                  - article "Billet pour Concert des Lumières de Gorée" [ref=f2e226]:
                    - generic [ref=f2e227]:
                      - generic [ref=f2e228]:
                        - generic [ref=f2e231]:
                          - paragraph [ref=f2e232]:
                            - generic [ref=f2e233]: "Catégorie :"
                            - text: Entrée
                          - heading "Concert des Lumières de Gorée" [level=2] [ref=f2e234]
                          - paragraph [ref=f2e235]: Baobab Scène
                        - generic [ref=f2e236]:
                          - 'generic "Billet valable : présentez son code d’entrée au contrôle." [ref=f2e237]': Valable
                          - generic [ref=f2e240]: Dans 20 h 2 min
                      - generic [ref=f2e247]:
                        - generic [ref=f2e248]:
                          - generic [ref=f2e249]:
                            - term [ref=f2e250]: Date
                            - definition [ref=f2e251]: 20 NOV 2026
                          - generic [ref=f2e252]:
                            - term [ref=f2e253]: Heure d’accès
                            - definition [ref=f2e254]: 06:45
                          - generic [ref=f2e255]:
                            - term [ref=f2e256]: Lieu
                            - definition [ref=f2e257]: Place du Gouvernement
                          - generic [ref=f2e258]:
                            - term [ref=f2e259]: Prix
                            - definition [ref=f2e260]: 6 000 F CFA
                          - generic [ref=f2e261]:
                            - term [ref=f2e262]: Frais de service
                            - definition [ref=f2e263]: 300 F CFA
                        - generic [ref=f2e264]:
                          - button "Agrandir le QR code en plein écran" [ref=f2e265] [cursor=pointer]:
                            - img "QR d’entrée dynamique" [ref=f2e266]
                          - paragraph [ref=f2e269]:
                            - generic [ref=f2e270]: "Numéro du billet :"
                            - text: TCK-20261119-BCBF48F15A
                          - paragraph [ref=f2e271]: Touchez le QR pour l’agrandir.
                          - generic [ref=f2e272]:
                            - generic [ref=f2e273]:
                              - generic [ref=f2e274]: Code renouvelé toutes les 20 s
                              - generic [ref=f2e276]:
                                - generic [aria-hidden] [ref=f2e277]: 9 s
                                - generic [ref=f2e278]: Nouveau code dans 9 secondes
                            - paragraph [ref=f2e279]: Une capture d’écran n’est pas acceptée au contrôle.
                            - paragraph [ref=f2e280]:
                              - generic [ref=f2e285]: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
                          - status [ref=f2e287]:
                            - generic [ref=f2e290]: Ouvrez ce billet avec du réseau avant d’arriver
                          - paragraph [ref=f2e291]:
                            - generic [ref=f2e295]: Billet authentique, émis par Event Village
                    - generic [ref=f2e296]:
                      - button "Transférer" [ref=f2e297] [cursor=pointer]
                      - button "Partager le lien de l’événement sur WhatsApp" [ref=f2e303] [cursor=pointer]:
                        - generic [ref=f2e307]: WhatsApp
                      - button "Partager ou copier le lien de l’événement" [ref=f2e308] [cursor=pointer]:
                        - generic [ref=f2e316]: Lien
                      - button "Télécharger le billet en PDF" [ref=f2e317] [cursor=pointer]:
                        - generic [ref=f2e322]: PDF
                      - button "Aide au transfert" [ref=f2e323] [cursor=pointer]
                - listitem [ref=f2e329]:
                  - article "Billet pour Festival Jazz sur le Fleuve" [ref=f2e331]:
                    - generic [ref=f2e332]:
                      - generic [ref=f2e333]:
                        - generic [ref=f2e336]:
                          - paragraph [ref=f2e337]:
                            - generic [ref=f2e338]: "Catégorie :"
                            - text: Pass soirée
                          - heading "Festival Jazz sur le Fleuve" [level=2] [ref=f2e339]
                          - paragraph [ref=f2e340]: Baobab Scène
                        - generic [ref=f2e341]:
                          - 'generic "Billet valable : présentez son code d’entrée au contrôle." [ref=f2e342]': Valable
                          - generic [ref=f2e345]: Dans 12 jours et 7 h
                      - generic [ref=f2e352]:
                        - generic [ref=f2e353]:
                          - generic [ref=f2e354]:
                            - term [ref=f2e355]: Date
                            - definition [ref=f2e356]: 01 DÉC 2026
                          - generic [ref=f2e357]:
                            - term [ref=f2e358]: Heure d’accès
                            - definition [ref=f2e359]: 18:00
                          - generic [ref=f2e360]:
                            - term [ref=f2e361]: Lieu
                            - definition [ref=f2e362]: Quai des Pêcheurs
                          - generic [ref=f2e363]:
                            - term [ref=f2e364]: Prix
                            - definition [ref=f2e365]: 7 500 F CFA
                          - generic [ref=f2e366]:
                            - term [ref=f2e367]: Frais de service
                            - definition [ref=f2e368]: 375 F CFA
                        - generic [ref=f2e369]:
                          - button "Agrandir le QR code en plein écran" [ref=f2e370] [cursor=pointer]:
                            - img "QR d’entrée dynamique" [ref=f2e371]
                          - paragraph [ref=f2e374]:
                            - generic [ref=f2e375]: "Numéro du billet :"
                            - text: TCK-20261119-74BA27D443
                          - paragraph [ref=f2e376]: Touchez le QR pour l’agrandir.
                          - generic [ref=f2e377]:
                            - generic [ref=f2e378]:
                              - generic [ref=f2e379]: Code renouvelé toutes les 20 s
                              - generic [ref=f2e381]:
                                - generic [aria-hidden] [ref=f2e382]: 9 s
                                - generic [ref=f2e383]: Nouveau code dans 9 secondes
                            - paragraph [ref=f2e384]: Une capture d’écran n’est pas acceptée au contrôle.
                            - paragraph [ref=f2e385]:
                              - generic [ref=f2e390]: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
                          - status [ref=f2e392]:
                            - generic [ref=f2e396]: Disponible sans réseau à partir du lun. 30 nov. 2026 à 18:00
                          - paragraph [ref=f2e397]:
                            - generic [ref=f2e401]: Billet authentique, émis par Event Village
                    - generic [ref=f2e402]:
                      - button "Transférer" [ref=f2e403] [cursor=pointer]
                      - button "Partager le lien de l’événement sur WhatsApp" [ref=f2e409] [cursor=pointer]:
                        - generic [ref=f2e413]: WhatsApp
                      - button "Partager ou copier le lien de l’événement" [ref=f2e414] [cursor=pointer]:
                        - generic [ref=f2e422]: Lien
                      - button "Télécharger le billet en PDF" [ref=f2e423] [cursor=pointer]:
                        - generic [ref=f2e428]: PDF
                      - button "Aide au transfert" [ref=f2e429] [cursor=pointer]
  - alert [ref=f2e435]
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
      |                                                                                        ^ Error: contrôles responsive de mes-billets (sombre)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```