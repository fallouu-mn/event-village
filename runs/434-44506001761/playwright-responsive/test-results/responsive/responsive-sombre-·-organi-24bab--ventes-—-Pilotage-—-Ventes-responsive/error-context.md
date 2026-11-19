# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · organisateur >> org-pilotage-ventes — Pilotage — Ventes
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de org-pilotage-ventes (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 6

- Array []
+ Array [
+   "768 px : texte hors de l’écran : th.px-4.py-3 « Recettes en ligne » de 714 à 797 px (fenêtre 768 px) ; td.px-4.py-3 « 66 000 F CFA » de 706 à 797 px (fenêtre 768 px) ; td.px-4.py-3 « 180 000 F CFA » de 698 à 797 px (fenêtre 768 px) ; td.px-4.py-3 « 105 000 F CFA » de 698 à 797 px (fenêtre 768 px) ; td.px-4.py-3 « 0 F CFA » de 746 à 797 px (fenêtre 768 px) ; td.px-4.py-3 « 0 F CFA » de 746 à 797 px (fenêtre 768 px)",
+   "768 px : texte coupé : th.px-4.py-3 « Recettes en ligne » dépasse de div.hidden.overflow-hidden «  » ; td.px-4.py-3 « 66 000 F CFA » dépasse de div.hidden.overflow-hidden «  » ; td.px-4.py-3 « 180 000 F CFA » dépasse de div.hidden.overflow-hidden «  » ; td.px-4.py-3 « 105 000 F CFA » dépasse de div.hidden.overflow-hidden «  » ; td.px-4.py-3 « 0 F CFA » dépasse de div.hidden.overflow-hidden «  » ; td.px-4.py-3 « 0 F CFA » dépasse de div.hidden.overflow-hidden «  »",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "1440 px : texte tronqué sans le texte entier : span.block.truncate « Mariama Ndiaye » (points de suspension, texte entier absent)",
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
            - link "Équipe" [ref=f2e24] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=f2e31]:
          - paragraph [ref=f2e32]: Outils
          - generic [ref=f2e33]:
            - link "Finances" [ref=f2e34] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=f2e38] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=f2e42] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=f2e50] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=f2e54] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=f2e59] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=f2e65] [cursor=pointer]:
          - /url: /
      - generic [ref=f2e71]:
        - link "Mariama Ndiaye Partenaire" [ref=f2e72] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e73]: MN
          - generic [ref=f2e74]:
            - generic [ref=f2e75]: Mariama Ndiaye
            - generic [ref=f2e76]: Partenaire
        - generic [ref=f2e77]:
          - button "Se déconnecter" [ref=f2e78] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e83] [cursor=pointer]
    - generic [ref=f2e87]:
      - banner [ref=f2e88]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f2e90] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 99+ non lues" [ref=f2e97] [cursor=pointer]:
          - generic [ref=f2e101]: 99+
      - main [ref=f2e102]:
        - generic [ref=f2e104]:
          - generic [ref=f2e105]:
            - link "Mes événements" [ref=f2e107] [cursor=pointer]:
              - /url: /partner/events
            - generic [ref=f2e112]:
              - generic [ref=f2e113]:
                - generic [ref=f2e114]:
                  - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f2e115]': Publié
                  - status [ref=f2e118]: En direct
                - heading "Nuit du Sabar — édition d’automne" [level=1] [ref=f2e120]
                - paragraph [ref=f2e121]:
                  - generic [ref=f2e122]:
                    - generic [ref=f2e123]: jeu. 19 nov. 2026 à 11:30
                    - generic [ref=f2e126]: Esplanade de la Corniche Ouest, Dakar
              - generic [ref=f2e130]:
                - link "Modifier" [ref=f2e131] [cursor=pointer]:
                  - /url: /partner/events/1b6b9b15-31a6-41c3-856d-f27700d91f21/edit
                - button "Annuler l’événement" [ref=f2e137] [cursor=pointer]
          - generic [ref=f2e143]:
            - tablist "Rubriques du pilotage" [ref=f2e146]:
              - tab "Aperçu" [ref=f2e147] [cursor=pointer]
              - tab "Infos" [ref=f2e149] [cursor=pointer]
              - tab "Ventes" [selected] [ref=f2e151] [cursor=pointer]
              - tab "Invitations" [ref=f2e153] [cursor=pointer]
              - tab "Entrées" [ref=f2e155] [cursor=pointer]
              - tab "Équipe" [ref=f2e157] [cursor=pointer]
              - tab "Caisse" [ref=f2e159] [cursor=pointer]
              - tab "Clôture" [ref=f2e161] [cursor=pointer]
            - tabpanel "Ventes" [ref=f2e163]:
              - generic [ref=f2e164]:
                - region [ref=f2e165]:
                  - generic [ref=f2e167]:
                    - heading "Par catégorie" [level=2] [ref=f2e168]
                    - paragraph [ref=f2e169]: Restants = quantité mise en vente de la catégorie moins les ventes, les invitations et les paiements en cours. Une catégorie inactive n’a plus de place en vente.
                  - table [ref=f2e172]:
                    - caption [ref=f2e173]: Ventes par catégorie de billets
                    - rowgroup [ref=f2e174]:
                      - row [ref=f2e175]:
                        - columnheader "Catégorie" [ref=f2e176]
                        - columnheader "Prix" [ref=f2e177]
                        - columnheader "Vendus" [ref=f2e178]
                        - columnheader "En cours de paiement" [ref=f2e179]
                        - columnheader "Invitations" [ref=f2e180]
                        - columnheader "Restants" [ref=f2e181]
                        - columnheader "Recettes en ligne" [ref=f2e182]
                    - rowgroup [ref=f2e183]:
                      - row [ref=f2e184]:
                        - cell "Prévente(inactive)" [ref=f2e185]
                        - cell "3 000 F CFA" [ref=f2e187]
                        - cell "22" [ref=f2e188]
                        - cell "0" [ref=f2e189]
                        - cell "0" [ref=f2e190]
                        - cell "Vente fermée" [ref=f2e191]
                        - cell "66 000 F CFA" [ref=f2e192]
                      - row [ref=f2e193]:
                        - cell "Standard En ligne et au guichet" [ref=f2e194]:
                          - generic [ref=f2e195]:
                            - text: Standard
                            - generic [ref=f2e196]: En ligne et au guichet
                        - cell "5 000 F CFA" [ref=f2e197]
                        - cell "50" [ref=f2e198]
                        - cell "2" [ref=f2e199]
                        - cell "0" [ref=f2e200]
                        - cell "128 / 180" [ref=f2e201]
                        - cell "180 000 F CFA" [ref=f2e202]
                      - row [ref=f2e203]:
                        - cell "VIP En ligne et au guichet" [ref=f2e204]:
                          - generic [ref=f2e205]:
                            - text: VIP
                            - generic [ref=f2e206]: En ligne et au guichet
                        - cell "15 000 F CFA" [ref=f2e207]
                        - cell "10" [ref=f2e208]
                        - cell "0" [ref=f2e209]
                        - cell "0" [ref=f2e210]
                        - cell "40 / 50" [ref=f2e211]
                        - cell "105 000 F CFA" [ref=f2e212]
                      - row [ref=f2e213]:
                        - cell "Carré presse Sur place uniquement" [ref=f2e214]:
                          - generic [ref=f2e215]:
                            - text: Carré presse
                            - generic [ref=f2e216]: Sur place uniquement
                        - cell "10 000 F CFA" [ref=f2e217]
                        - cell "1" [ref=f2e218]
                        - cell "0" [ref=f2e219]
                        - cell "0" [ref=f2e220]
                        - cell "9 / 10" [ref=f2e221]
                        - cell "0 F CFA" [ref=f2e222]
                      - row [ref=f2e223]:
                        - cell "Invités de la production Invitations seulement" [ref=f2e224]:
                          - generic [ref=f2e225]:
                            - text: Invités de la production
                            - generic [ref=f2e226]: Invitations seulement
                        - cell "0 F CFA" [ref=f2e227]
                        - cell "0" [ref=f2e228]
                        - cell "0" [ref=f2e229]
                        - cell "0" [ref=f2e230]
                        - cell "10 / 10" [ref=f2e231]
                        - cell "0 F CFA" [ref=f2e232]
                - region [ref=f2e233]:
                  - generic [ref=f2e235]:
                    - heading "Par canal" [level=2] [ref=f2e236]
                    - paragraph [ref=f2e237]: "Billets valables ou déjà utilisés, comptés par le serveur : vendus en ligne, gratuits pris en ligne, vendus au guichet et invitations."
                  - table [ref=f2e240]:
                    - caption [ref=f2e241]: Ventes par canal
                    - rowgroup [ref=f2e242]:
                      - row [ref=f2e243]:
                        - columnheader "Canal" [ref=f2e244]
                        - columnheader "Billets" [ref=f2e245]
                        - columnheader "Montant" [ref=f2e246]
                    - rowgroup [ref=f2e247]:
                      - row [ref=f2e248]:
                        - cell "En ligne" [ref=f2e249]
                        - cell "66" [ref=f2e250]
                        - cell "351 000 F CFA" [ref=f2e251]
                      - row [ref=f2e252]:
                        - cell "En ligne, gratuits" [ref=f2e253]
                        - cell "0" [ref=f2e254]
                        - cell "0 F CFA" [ref=f2e255]
                      - row [ref=f2e256]:
                        - cell "Au guichet" [ref=f2e257]
                        - cell "17" [ref=f2e258]
                        - cell "120 000 F CFA" [ref=f2e259]
                      - row [ref=f2e260]:
                        - cell "Invitations" [ref=f2e261]
                        - cell "0" [ref=f2e262]
                        - cell "0 F CFA" [ref=f2e263]
                - region [ref=f2e264]:
                  - generic [ref=f2e266]:
                    - heading "Évolution jour par jour" [level=2] [ref=f2e267]
                    - paragraph [ref=f2e268]: Billets vendus chaque jour, à l’heure de Dakar.
                  - list "Ventes par jour" [ref=f2e269]:
                    - listitem [ref=f2e270]:
                      - generic [ref=f2e271]:
                        - time [ref=f2e273]: 7 nov. 2026
                        - generic [ref=f2e274]: 0 billet
                    - listitem [ref=f2e276]:
                      - generic [ref=f2e277]:
                        - time [ref=f2e279]: 8 nov. 2026
                        - generic [ref=f2e280]: 0 billet
                    - listitem [ref=f2e282]:
                      - generic [ref=f2e283]:
                        - time [ref=f2e285]: 9 nov. 2026
                        - generic [ref=f2e286]: 0 billet
                    - listitem [ref=f2e288]:
                      - generic [ref=f2e289]:
                        - time [ref=f2e291]: 10 nov. 2026
                        - generic [ref=f2e292]: 1 billet
                    - listitem [ref=f2e295]:
                      - generic [ref=f2e296]:
                        - time [ref=f2e298]: 11 nov. 2026
                        - generic [ref=f2e299]: 13 billets
                    - listitem [ref=f2e302]:
                      - generic [ref=f2e303]:
                        - time [ref=f2e305]: 12 nov. 2026
                        - generic [ref=f2e306]: 7 billets
                    - listitem [ref=f2e309]:
                      - generic [ref=f2e310]:
                        - time [ref=f2e312]: 13 nov. 2026
                        - generic [ref=f2e313]: 4 billets
                    - listitem [ref=f2e316]:
                      - generic [ref=f2e317]:
                        - time [ref=f2e319]: 14 nov. 2026
                        - generic [ref=f2e320]: 6 billets
                    - listitem [ref=f2e323]:
                      - generic [ref=f2e324]:
                        - time [ref=f2e326]: 15 nov. 2026
                        - generic [ref=f2e327]: 6 billets
                    - listitem [ref=f2e330]:
                      - generic [ref=f2e331]:
                        - time [ref=f2e333]: 16 nov. 2026
                        - generic [ref=f2e334]: 2 billets
                    - listitem [ref=f2e337]:
                      - generic [ref=f2e338]:
                        - time [ref=f2e340]: 17 nov. 2026
                        - generic [ref=f2e341]: 9 billets
                    - listitem [ref=f2e344]:
                      - generic [ref=f2e345]:
                        - time [ref=f2e347]: 18 nov. 2026
                        - generic [ref=f2e348]: 5 billets
                    - listitem [ref=f2e351]:
                      - generic [ref=f2e352]:
                        - time [ref=f2e354]: 19 nov. 2026
                        - generic [ref=f2e355]: 30 billetsdont 17 en espèces
                - region [ref=f2e358]:
                  - generic [ref=f2e360]:
                    - heading "Remboursement d’un billet" [level=2] [ref=f2e361]
                    - paragraph [ref=f2e362]: Retrouvez le billet par le numéro imprimé dessus. Rien n’est remboursé avant votre confirmation.
                  - generic [ref=f2e364]:
                    - generic [ref=f2e365]:
                      - generic [ref=f2e366]: Numéro du billet
                      - textbox "Numéro du billet" [ref=f2e368]:
                        - /placeholder: TCK-20261101-XXXXXXXXXX
                    - button "Rechercher le billet" [ref=f2e369] [cursor=pointer]
  - alert [ref=f2e375]
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
      |                                                                                        ^ Error: contrôles responsive de org-pilotage-ventes (sombre)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```