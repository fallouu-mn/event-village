# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · organisateur >> org-tables-plan — Plan de salle (édition)
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de org-tables-plan (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "360 px : textes qui se chevauchent : span.break-all.text-sm « 7 » sur span.block.break-words « Terrasse » (8×2 px) ; span.block.break-words « Salle climatisée » sur span.break-all.text-sm « 4 » (8×2 px) ; span.block.break-words « Terrasse » sur small.inline-flex.items-center « 6 » (7×13 px)",
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
          - paragraph [ref=f2e11]: Gestion
          - generic [ref=f2e12]:
            - link "Tableau de bord" [ref=f2e13] [cursor=pointer]:
              - /url: /partner/dashboard
            - link "Événements" [ref=f2e20] [cursor=pointer]:
              - /url: /partner/events
            - link "Salles de fête" [ref=f2e24] [cursor=pointer]:
              - /url: /partner/halls
            - link "Tables" [ref=f2e30] [cursor=pointer]:
              - /url: /partner/tables
            - link "Équipe" [ref=f2e35] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=f2e42]:
          - paragraph [ref=f2e43]: Outils
          - generic [ref=f2e44]:
            - link "Finances" [ref=f2e45] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=f2e49] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=f2e53] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=f2e61] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=f2e65] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=f2e70] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=f2e76] [cursor=pointer]:
          - /url: /
      - generic [ref=f2e82]:
        - link "Mariama Ndiaye Partenaire" [ref=f2e83] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e84]: MN
          - generic [ref=f2e85]:
            - generic [ref=f2e86]: Mariama Ndiaye
            - generic [ref=f2e87]: Partenaire
        - generic [ref=f2e88]:
          - button "Se déconnecter" [ref=f2e89] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e94] [cursor=pointer]
    - generic [ref=f2e98]:
      - banner [ref=f2e99]:
        - link "Rechercher un événement…" [ref=f2e101] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 37 non lues" [ref=f2e108] [cursor=pointer]:
          - generic [ref=f2e112]: "37"
      - main [ref=f2e113]:
        - generic [ref=f2e115]:
          - generic [ref=f2e116]:
            - link "Retour à l’établissement" [ref=f2e118] [cursor=pointer]:
              - /url: /partner/tables/edition/d1a11ec9-29f3-43d4-bc43-9cb561c72c63
            - generic [ref=f2e123]:
              - generic [ref=f2e124]:
                - heading "Plan de salle" [level=1] [ref=f2e125]
                - paragraph [ref=f2e126]: La Terrasse du Plateau
              - button "Plan enregistré" [disabled] [ref=f2e128]
          - generic [ref=f2e135]:
            - generic [ref=f2e138]:
              - generic [ref=f2e139]:
                - generic [ref=f2e140] [cursor=pointer]: Montrer le plan aux clients
                - paragraph [ref=f2e141]: Les clients choisissent leur table sur le plan au moment de réserver. 8 tables placées sur 8.
              - generic [ref=f2e142]:
                - generic [aria-hidden] [ref=f2e143]: Activé
                - switch "Montrer le plan aux clients" [checked] [ref=f2e144] [cursor=pointer]
            - status [ref=f2e147]:
              - generic [ref=f2e155]:
                - paragraph [ref=f2e156]: Faites glisser les tables du doigt ou à la souris
                - generic [ref=f2e157]: "Touchez une table ou une zone pour la tourner, changer sa forme, l’agrandir ou la retirer. Au clavier : flèches pour déplacer (Majuscule pour aller plus vite), R pour tourner."
            - generic [ref=f2e158]:
              - generic [ref=f2e159]:
                - group "Plan de salle de La Terrasse du Plateau" [ref=f2e160]:
                  - generic [ref=f2e161]:
                    - button "Zone Salle climatisée" [ref=f2e163]:
                      - generic [ref=f2e164]: Salle climatisée
                    - button "Zone Terrasse" [ref=f2e166]:
                      - generic [ref=f2e167]: Terrasse
                    - button "Table 1, 2 places, forme ronde" [ref=f2e168]:
                      - generic [aria-hidden] [ref=f2e170]:
                        - generic [ref=f2e171]: "1"
                        - generic [ref=f2e172]: "2"
                    - button "Table 2, 2 places, forme ronde" [ref=f2e178]:
                      - generic [aria-hidden] [ref=f2e180]:
                        - generic [ref=f2e181]: "2"
                        - generic [ref=f2e182]: "2"
                    - button "Table 3, 2 à 4 places, forme carrée" [ref=f2e188]:
                      - generic [aria-hidden] [ref=f2e190]:
                        - generic [ref=f2e191]: "3"
                        - generic [ref=f2e192]: "4"
                    - button "Table 4, 2 à 4 places, forme carrée" [ref=f2e198]:
                      - generic [aria-hidden] [ref=f2e200]:
                        - generic [ref=f2e201]: "4"
                        - generic [ref=f2e202]: "4"
                    - button "Table 5, 3 à 6 places, forme rectangle" [ref=f2e208]:
                      - generic [aria-hidden] [ref=f2e210]:
                        - generic [ref=f2e211]: "5"
                        - generic [ref=f2e212]: "6"
                    - button "Table 6, 2 à 4 places, forme carrée" [ref=f2e218]:
                      - generic [aria-hidden] [ref=f2e220]:
                        - generic [ref=f2e221]: "6"
                        - generic [ref=f2e222]: "4"
                    - button "Table 7, 3 à 6 places, forme rectangle" [ref=f2e228]:
                      - generic [aria-hidden] [ref=f2e230]:
                        - generic [ref=f2e231]: "7"
                        - generic [ref=f2e232]: "6"
                    - button "Table 8, 4 à 8 places, forme rectangle" [ref=f2e238]:
                      - generic [aria-hidden] [ref=f2e240]:
                        - generic [ref=f2e241]: "8"
                        - generic [ref=f2e242]: "8"
                - paragraph [ref=f2e248]: "Flèches : déplacer de 1 %. Majuscule et flèches : déplacer de 5 %. Touche R : tourner la table de 15 degrés."
                - paragraph [ref=f2e249]
              - region "Réglages de l’élément choisi" [ref=f2e251]:
                - paragraph [ref=f2e252]: "Touchez une table ou une zone du plan pour la régler : position, forme, rotation, taille."
            - generic [ref=f2e253]:
              - paragraph [ref=f2e254]: Tout est enregistré.
              - button "Plan enregistré" [disabled] [ref=f2e255]
  - alert [ref=f2e262]
```

# Test source

```ts
  20  | import path from 'node:path';
  21  | import type { Page } from '@playwright/test';
  22  | import { test, expect, type CaptureRole, type ThemeKey } from './support/fixtures';
  23  | import { readDemoIds, E2E_OUTPUT_DIR, type DemoIds } from './support/demo-ids';
  24  | import { fakeScanMode, installFakeCamera } from './support/fake-camera';
  25  | import {
  26  |     PHONE_MAX_WIDTH, RESPONSIVE_CAPTURE_WIDTHS, RESPONSIVE_LANDSCAPE, RESPONSIVE_PAGES, RESPONSIVE_WIDTHS, type ResponsivePage,
  27  | } from './support/responsive-pages';
  28  | import { runResponsiveChecks } from './support/responsive-checks';
  29  | import { keepHomeOutOfServicesWindow } from './support/services-switch';
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
  76  |                 test(`${p.id} — ${p.titre}`, async ({ page, context, guard, servicesLock }) => {
  77  |                     test.setTimeout(240_000);
  78  |                     const record: ResponsiveRecord = { page: p.id, titre: p.titre, groupe: p.groupe, role, theme: theme.key, url: null, sizes: [], notes: [], error: null };
  79  |                     try {
  80  |                         // Lot 10b (lot 11b : salles et tables) : verrou des services avant tout chargement (attente ajoutée au délai du test)
  81  |                         await servicesLock.enter(p.services ? 'services' : 'autres');
  82  |                         if (servicesLock.waitedMs >= 1_000) record.notes.push(`attente du verrou des services : ${Math.round(servicesLock.waitedMs / 1000)} s`);
  83  |                         if (p.services) {
  84  |                             record.notes.push('page des services : interrupteurs features.halls_enabled et features.tables_enabled ouverts le temps du test (e2e/support/services-switch.ts)');
  85  |                             await keepHomeOutOfServicesWindow(page);
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
      |                                                                                        ^ Error: contrôles responsive de org-tables-plan (sombre)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```