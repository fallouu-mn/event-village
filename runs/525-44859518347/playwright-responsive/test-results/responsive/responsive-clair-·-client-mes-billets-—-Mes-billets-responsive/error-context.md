# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · client >> mes-billets — Mes billets
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de mes-billets (clair)

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
        - generic [ref=f5e41]:
          - generic [ref=f5e42]:
            - status [ref=f5e44]: En direct
            - heading "Mes billets" [level=1] [ref=f5e46]
            - paragraph [ref=f5e47]: "Présentez le QR code à l’entrée : il se renouvelle tout seul. Glissez d’un billet à l’autre, et touchez le QR pour l’afficher en grand."
          - generic [ref=f5e48]:
            - link "Mes billets sans réseau" [ref=f5e49] [cursor=pointer]:
              - /url: /billet/hors-ligne
            - button "Comment marche le transfert ?" [ref=f5e57] [cursor=pointer]
            - link "Réserver un billet" [ref=f5e63] [cursor=pointer]:
              - /url: /explore
        - tablist "Filtrer mes billets" [ref=f5e70]:
          - tab "À venir" [selected] [ref=f5e71] [cursor=pointer]
          - tab "Tous mes billets" [ref=f5e73] [cursor=pointer]
          - tab "Historique" [ref=f5e75] [cursor=pointer]
          - tab "Reçus , 1" [ref=f5e77] [cursor=pointer]:
            - generic [ref=f5e78]: Reçus
            - generic [ref=f5e79]:
              - generic [ref=f5e80]: ","
              - text: "1"
        - tabpanel "À venir" [ref=f5e81]:
          - region "Billets à venir" [ref=f5e82]:
            - 'list "Billets à venir : glissez ou utilisez les flèches pour passer d’un billet à l’autre" [ref=f5e83]':
              - listitem [ref=f5e84]:
                - article "Billet pour Nuit du Sabar — édition d’automne" [ref=f5e86]:
                  - generic [ref=f5e87]:
                    - generic [ref=f5e88]:
                      - generic [ref=f5e91]:
                        - paragraph [ref=f5e92]:
                          - generic [ref=f5e93]: "Catégorie :"
                          - text: Standard
                        - heading "Nuit du Sabar — édition d’automne" [level=2] [ref=f5e94]
                        - paragraph [ref=f5e95]: Baobab Scène
                      - generic [ref=f5e96]:
                        - 'generic "Billet valable : présentez son code d’entrée au contrôle." [ref=f5e97]': Valable
                        - generic [ref=f5e100]: Dans 48 min
                    - generic [ref=f5e107]:
                      - generic [ref=f5e108]:
                        - generic [ref=f5e109]:
                          - term [ref=f5e110]: Date
                          - definition [ref=f5e111]: 21 NOV 2026
                        - generic [ref=f5e112]:
                          - term [ref=f5e113]: Heure d’accès
                          - definition [ref=f5e114]: 04:00
                        - generic [ref=f5e115]:
                          - term [ref=f5e116]: Lieu
                          - definition [ref=f5e117]: Esplanade de la Corniche Ouest
                        - generic [ref=f5e118]:
                          - term [ref=f5e119]: Prix
                          - definition [ref=f5e120]: 5 000 F CFA
                        - generic [ref=f5e121]:
                          - term [ref=f5e122]: Frais de service
                          - definition [ref=f5e123]: 250 F CFA
                      - generic [ref=f5e124]:
                        - button "Agrandir le QR code en plein écran" [ref=f5e125] [cursor=pointer]:
                          - img "QR d’entrée dynamique" [ref=f5e126]
                        - paragraph [ref=f5e129]:
                          - generic [ref=f5e130]: "Numéro du billet :"
                          - text: TCK-20261121-DC1187ABE6
                        - paragraph [ref=f5e131]: Touchez le QR pour l’agrandir.
                        - generic [ref=f5e132]:
                          - generic [ref=f5e133]:
                            - generic [ref=f5e134]: Code renouvelé toutes les 20 s
                            - generic [ref=f5e136]:
                              - generic [aria-hidden] [ref=f5e137]: 7 s
                              - generic [ref=f5e138]: Nouveau code dans 7 secondes
                          - paragraph [ref=f5e139]: Une capture d’écran n’est pas acceptée au contrôle.
                          - paragraph [ref=f5e140]:
                            - generic [ref=f5e145]: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
                        - status [ref=f5e147]:
                          - generic [ref=f5e150]: Ouvrez ce billet avec du réseau avant d’arriver
                        - paragraph [ref=f5e151]:
                          - generic [ref=f5e155]: Billet authentique, émis par Event Village
                  - generic [ref=f5e156]:
                    - button "Transférer" [ref=f5e157] [cursor=pointer]
                    - button "Partager le lien de l’événement sur WhatsApp" [ref=f5e163] [cursor=pointer]:
                      - generic [ref=f5e167]: WhatsApp
                    - button "Partager ou copier le lien de l’événement" [ref=f5e168] [cursor=pointer]:
                      - generic [ref=f5e176]: Lien
                    - button "Télécharger le billet en PDF" [ref=f5e177] [cursor=pointer]:
                      - generic [ref=f5e182]: PDF
                    - group "Ajouter à mon agenda" [ref=f5e183]:
                      - button "Ajouter à mon agenda" [ref=f5e184] [cursor=pointer]
                      - button "Google Agenda" [ref=f5e189] [cursor=pointer]
                    - button "Aide au transfert" [ref=f5e191] [cursor=pointer]
              - listitem [ref=f5e197]:
                - article "Billet pour Concert des Lumières de Gorée" [ref=f5e199]:
                  - generic [ref=f5e200]:
                    - generic [ref=f5e201]:
                      - generic [ref=f5e204]:
                        - paragraph [ref=f5e205]:
                          - generic [ref=f5e206]: "Catégorie :"
                          - text: Entrée
                        - heading "Concert des Lumières de Gorée" [level=2] [ref=f5e207]
                        - paragraph [ref=f5e208]: Baobab Scène
                      - generic [ref=f5e209]:
                        - 'generic "Billet valable : présentez son code d’entrée au contrôle." [ref=f5e210]': Valable
                        - generic [ref=f5e213]: Dans 20 h 3 min
                    - generic [ref=f5e220]:
                      - generic [ref=f5e221]:
                        - generic [ref=f5e222]:
                          - term [ref=f5e223]: Date
                          - definition [ref=f5e224]: 21 NOV 2026
                        - generic [ref=f5e225]:
                          - term [ref=f5e226]: Heure d’accès
                          - definition [ref=f5e227]: 23:15
                        - generic [ref=f5e228]:
                          - term [ref=f5e229]: Lieu
                          - definition [ref=f5e230]: Place du Gouvernement
                        - generic [ref=f5e231]:
                          - term [ref=f5e232]: Prix
                          - definition [ref=f5e233]: 6 000 F CFA
                        - generic [ref=f5e234]:
                          - term [ref=f5e235]: Frais de service
                          - definition [ref=f5e236]: 300 F CFA
                      - generic [ref=f5e237]:
                        - button "Agrandir le QR code en plein écran" [ref=f5e238] [cursor=pointer]:
                          - img "QR d’entrée dynamique" [ref=f5e239]
                        - paragraph [ref=f5e242]:
                          - generic [ref=f5e243]: "Numéro du billet :"
                          - text: TCK-20261121-33977F2ED6
                        - paragraph [ref=f5e244]: Touchez le QR pour l’agrandir.
                        - generic [ref=f5e245]:
                          - generic [ref=f5e246]:
                            - generic [ref=f5e247]: Code renouvelé toutes les 20 s
                            - generic [ref=f5e249]:
                              - generic [aria-hidden] [ref=f5e250]: 7 s
                              - generic [ref=f5e251]: Nouveau code dans 7 secondes
                          - paragraph [ref=f5e252]: Une capture d’écran n’est pas acceptée au contrôle.
                          - paragraph [ref=f5e253]:
                            - generic [ref=f5e258]: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
                        - status [ref=f5e260]:
                          - generic [ref=f5e263]: Ouvrez ce billet avec du réseau avant d’arriver
                        - paragraph [ref=f5e264]:
                          - generic [ref=f5e268]: Billet authentique, émis par Event Village
                  - generic [ref=f5e269]:
                    - button "Transférer" [ref=f5e270] [cursor=pointer]
                    - button "Partager le lien de l’événement sur WhatsApp" [ref=f5e276] [cursor=pointer]:
                      - generic [ref=f5e280]: WhatsApp
                    - button "Partager ou copier le lien de l’événement" [ref=f5e281] [cursor=pointer]:
                      - generic [ref=f5e289]: Lien
                    - button "Télécharger le billet en PDF" [ref=f5e290] [cursor=pointer]:
                      - generic [ref=f5e295]: PDF
                    - group "Ajouter à mon agenda" [ref=f5e296]:
                      - button "Ajouter à mon agenda" [ref=f5e297] [cursor=pointer]
                      - button "Google Agenda" [ref=f5e302] [cursor=pointer]
                    - button "Aide au transfert" [ref=f5e304] [cursor=pointer]
              - listitem [ref=f5e310]:
                - article "Billet pour Festival Jazz sur le Fleuve" [ref=f5e312]:
                  - generic [ref=f5e313]:
                    - generic [ref=f5e314]:
                      - generic [ref=f5e317]:
                        - paragraph [ref=f5e318]:
                          - generic [ref=f5e319]: "Catégorie :"
                          - text: Pass soirée
                        - heading "Festival Jazz sur le Fleuve" [level=2] [ref=f5e320]
                        - paragraph [ref=f5e321]: Baobab Scène
                      - generic [ref=f5e322]:
                        - 'generic "Billet valable : présentez son code d’entrée au contrôle." [ref=f5e323]': Valable
                        - generic [ref=f5e326]: Dans 12 jours et 14 h
                    - generic [ref=f5e333]:
                      - generic [ref=f5e334]:
                        - generic [ref=f5e335]:
                          - term [ref=f5e336]: Date
                          - definition [ref=f5e337]: 03 DÉC 2026
                        - generic [ref=f5e338]:
                          - term [ref=f5e339]: Heure d’accès
                          - definition [ref=f5e340]: 18:00
                        - generic [ref=f5e341]:
                          - term [ref=f5e342]: Lieu
                          - definition [ref=f5e343]: Quai des Pêcheurs
                        - generic [ref=f5e344]:
                          - term [ref=f5e345]: Prix
                          - definition [ref=f5e346]: 7 500 F CFA
                        - generic [ref=f5e347]:
                          - term [ref=f5e348]: Frais de service
                          - definition [ref=f5e349]: 375 F CFA
                      - generic [ref=f5e350]:
                        - button "Agrandir le QR code en plein écran" [ref=f5e351] [cursor=pointer]:
                          - img "QR d’entrée dynamique" [ref=f5e352]
                        - paragraph [ref=f5e355]:
                          - generic [ref=f5e356]: "Numéro du billet :"
                          - text: TCK-20261121-DB090918A9
                        - paragraph [ref=f5e357]: Touchez le QR pour l’agrandir.
                        - generic [ref=f5e358]:
                          - generic [ref=f5e359]:
                            - generic [ref=f5e360]: Code renouvelé toutes les 20 s
                            - generic [ref=f5e362]:
                              - generic [aria-hidden] [ref=f5e363]: 7 s
                              - generic [ref=f5e364]: Nouveau code dans 7 secondes
                          - paragraph [ref=f5e365]: Une capture d’écran n’est pas acceptée au contrôle.
                          - paragraph [ref=f5e366]:
                            - generic [ref=f5e371]: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
                        - status [ref=f5e373]:
                          - generic [ref=f5e377]: Disponible sans réseau à partir du mer. 2 déc. 2026 à 18:00
                        - paragraph [ref=f5e378]:
                          - generic [ref=f5e382]: Billet authentique, émis par Event Village
                  - generic [ref=f5e383]:
                    - button "Transférer" [ref=f5e384] [cursor=pointer]
                    - button "Partager le lien de l’événement sur WhatsApp" [ref=f5e390] [cursor=pointer]:
                      - generic [ref=f5e394]: WhatsApp
                    - button "Partager ou copier le lien de l’événement" [ref=f5e395] [cursor=pointer]:
                      - generic [ref=f5e403]: Lien
                    - button "Télécharger le billet en PDF" [ref=f5e404] [cursor=pointer]:
                      - generic [ref=f5e409]: PDF
                    - group "Ajouter à mon agenda" [ref=f5e410]:
                      - button "Ajouter à mon agenda" [ref=f5e411] [cursor=pointer]
                      - button "Google Agenda" [ref=f5e416] [cursor=pointer]
                    - button "Aide au transfert" [ref=f5e418] [cursor=pointer]
        - status [ref=f5e424]
  - alert [ref=f5e425]
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
      |                                                                                        ^ Error: contrôles responsive de mes-billets (clair)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```