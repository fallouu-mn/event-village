# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · client >> salles-reservation — Ma réservation de salle (en attente de paiement)
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de salles-reservation (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "1024 px : défilement horizontal (largeur du document 1145 px, fenêtre 1024 px)",
+   "1024 px : texte hors de l’écran : span.max-w-[12rem].break-words « Fatou Mbaye » de 1019 à 1108 px (fenêtre 1024 px)",
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
          - link "Commandes" [ref=f5e17] [cursor=pointer]:
            - /url: /orders
          - link "Portefeuille" [ref=f5e18] [cursor=pointer]:
            - /url: /wallet
      - link "Rechercher un événement…" [ref=f5e20] [cursor=pointer]:
        - /url: /explore
      - generic [ref=f5e25]:
        - button "Notifications, 10 non lues" [ref=f5e27] [cursor=pointer]:
          - generic [ref=f5e31]: "10"
        - button "Fatou Mbaye" [ref=f5e33] [cursor=pointer]:
          - generic [aria-hidden] [ref=f5e34]: FM
    - main [ref=f5e38]:
      - generic [ref=f5e40]:
        - generic [ref=f5e41]:
          - link "Mes réservations" [ref=f5e43] [cursor=pointer]:
            - /url: /halls/reservations
          - generic [ref=f5e49]:
            - generic [ref=f5e50]: À payer pour garder la date
            - heading "Salle des Fromagers" [level=1] [ref=f5e53]
            - paragraph [ref=f5e54]: Le 15 décembre 2026
        - status [ref=f5e55]:
          - generic [ref=f5e60]:
            - paragraph [ref=f5e61]: Payez avant 07:11 pour garder la date
            - generic [ref=f5e62]: Sans paiement à cette heure-là, la date est libérée pour d’autres clients.
        - generic [ref=f5e63]:
          - generic [ref=f5e64]:
            - region "La salle" [ref=f5e65]:
              - heading "La salle" [level=2] [ref=f5e66]
              - generic [ref=f5e73]:
                - paragraph [ref=f5e74]: Salle des Fromagers
                - paragraph [ref=f5e75]: 22, avenue Léopold-Sédar-Senghor, Dakar-Plateau, Dakar
                - link "Voir la fiche de la salle" [ref=f5e76] [cursor=pointer]:
                  - /url: /halls/0ef50f2f-8e48-4441-8876-c3858c30a7ce
              - paragraph [ref=f5e77]:
                - generic [ref=f5e80]:
                  - text: Le 15 décembre 2026
                  - generic [ref=f5e81]: "Location à la journée : 1 jour"
            - region "Montants" [ref=f5e82]:
              - heading "Montants" [level=2] [ref=f5e83]
              - generic [ref=f5e88]:
                - generic [ref=f5e89]:
                  - term [ref=f5e90]: Prix (1 jour)
                  - definition [ref=f5e91]: 450 000 F CFA
                - generic [ref=f5e92]:
                  - term [ref=f5e93]: Frais de service
                  - definition [ref=f5e94]: 22 500 F CFA
                - generic [ref=f5e95]:
                  - term [ref=f5e96]: Total
                  - definition [ref=f5e97]: 472 500 F CFA
                - generic [ref=f5e98]:
                  - term [ref=f5e99]: Déjà payé
                  - definition [ref=f5e100]: 0 F CFA
                - generic [ref=f5e101]:
                  - term [ref=f5e102]: Reste à payer
                  - definition [ref=f5e103]: 472 500 F CFA
              - paragraph [ref=f5e104]: "Acompte pour garder la date : 189 000 F CFA."
            - region "Conditions d’annulation" [ref=f5e105]:
              - heading "Conditions d’annulation" [level=2] [ref=f5e106]
              - paragraph [ref=f5e111]: "Règle Modérée : remboursement total si vous annulez au moins 30 jours avant la date, 50 % jusqu’à 7 jours avant, rien ensuite."
            - paragraph [ref=f5e112]: Réservation faite le 21 novembre 2026.
          - complementary "Actions" [ref=f5e113]:
            - button "Payer l’acompte (189 000 F CFA)" [ref=f5e114] [cursor=pointer]
            - button "Payer la totalité (472 500 F CFA)" [ref=f5e116] [cursor=pointer]
            - paragraph [ref=f5e118]: Paiement par Wave ou Orange Money.
            - button "Annuler la réservation" [ref=f5e119] [cursor=pointer]
  - alert [ref=f5e121]
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
      |                                                                                        ^ Error: contrôles responsive de salles-reservation (clair)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```