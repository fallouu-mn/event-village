# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · organisateur >> org-pilotage-caisse — Pilotage — Caisse
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de org-pilotage-caisse (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 9

- Array []
+ Array [
+   "768 px : texte hors de l’écran : th.px-4.py-3 « Écart » de 757 à 792 px (fenêtre 768 px) ; th.px-4.py-3 « Action » de 889 à 933 px (fenêtre 768 px) ; span.font-semibold.text-foreground-strong « Caisse ouverte » de 747 à 792 px (fenêtre 768 px) ; span.min-w-0 « Fermer cette caisse » de 867 à 916 px (fenêtre 768 px) ; span.font-semibold.text-danger-text « -2 000 F CFA » de 700 à 792 px (fenêtre 768 px) ; span.mt-0.5.block « Erreur de rendu de monnaie sur une vente VIP, sign » de 729 à 792 px (fenêtre 768 px) ; span.font-semibold.text-foreground-strong « Aucun écart » de 710 à 792 px (fenêtre 768 px)",
+   "768 px : texte coupé : th.px-4.py-3 « Écart » dépasse de div.hidden.overflow-hidden «  » ; th.px-4.py-3 « Action » dépasse de div.hidden.overflow-hidden «  » ; span.font-semibold.text-foreground-strong « Caisse ouverte » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Fermer cette caisse » dépasse de div.hidden.overflow-hidden «  » ; span.font-semibold.text-danger-text « -2 000 F CFA » dépasse de div.hidden.overflow-hidden «  » ; span.mt-0.5.block « Erreur de rendu de monnaie sur une vente VIP, sign » dépasse de div.hidden.overflow-hidden «  » ; span.font-semibold.text-foreground-strong « Aucun écart » dépasse de div.hidden.overflow-hidden «  »",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "1024 px : texte hors de l’écran : th.px-4.py-3 « Écart » de 1021 à 1056 px (fenêtre 1024 px) ; th.px-4.py-3 « Action » de 1153 à 1197 px (fenêtre 1024 px) ; span.font-semibold.text-foreground-strong « Caisse ouverte » de 1011 à 1056 px (fenêtre 1024 px) ; span.min-w-0 « Fermer cette caisse » de 1131 à 1180 px (fenêtre 1024 px) ; span.font-semibold.text-danger-text « -2 000 F CFA » de 964 à 1056 px (fenêtre 1024 px) ; span.mt-0.5.block « Erreur de rendu de monnaie sur une vente VIP, sign » de 993 à 1056 px (fenêtre 1024 px) ; span.font-semibold.text-foreground-strong « Aucun écart » de 974 à 1056 px (fenêtre 1024 px)",
+   "1024 px : texte coupé : th.px-4.py-3 « Écart » dépasse de div.hidden.overflow-hidden «  » ; th.px-4.py-3 « Action » dépasse de div.hidden.overflow-hidden «  » ; span.font-semibold.text-foreground-strong « Caisse ouverte » dépasse de div.hidden.overflow-hidden «  » ; span.min-w-0 « Fermer cette caisse » dépasse de div.hidden.overflow-hidden «  » ; span.font-semibold.text-danger-text « -2 000 F CFA » dépasse de div.hidden.overflow-hidden «  » ; span.mt-0.5.block « Erreur de rendu de monnaie sur une vente VIP, sign » dépasse de div.hidden.overflow-hidden «  » ; span.font-semibold.text-foreground-strong « Aucun écart » dépasse de div.hidden.overflow-hidden «  »",
+   "1024 px : texte tronqué sans le texte entier : span.block.truncate « Mariama Ndiaye » (points de suspension, texte entier absent)",
+   "1440 px : texte tronqué sans le texte entier : span.block.truncate « Mariama Ndiaye » (points de suspension, texte entier absent)",
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
            - link "Mes événements" [ref=f5e107] [cursor=pointer]:
              - /url: /partner/events
            - generic [ref=f5e112]:
              - generic [ref=f5e113]:
                - generic [ref=f5e114]:
                  - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f5e115]': Publié
                  - status [ref=f5e118]: En direct
                - heading "Nuit du Sabar — édition d’automne" [level=1] [ref=f5e120]
                - paragraph [ref=f5e121]:
                  - generic [ref=f5e122]:
                    - generic [ref=f5e123]: jeu. 19 nov. 2026 à 11:30
                    - generic [ref=f5e126]: Esplanade de la Corniche Ouest, Dakar
              - generic [ref=f5e130]:
                - link "Modifier" [ref=f5e131] [cursor=pointer]:
                  - /url: /partner/events/1b6b9b15-31a6-41c3-856d-f27700d91f21/edit
                - button "Annuler l’événement" [ref=f5e137] [cursor=pointer]
          - generic [ref=f5e143]:
            - tablist "Rubriques du pilotage" [ref=f5e146]:
              - tab "Aperçu" [ref=f5e147] [cursor=pointer]
              - tab "Infos" [ref=f5e149] [cursor=pointer]
              - tab "Ventes" [ref=f5e151] [cursor=pointer]
              - tab "Invitations" [ref=f5e153] [cursor=pointer]
              - tab "Entrées" [ref=f5e155] [cursor=pointer]
              - tab "Équipe" [ref=f5e157] [cursor=pointer]
              - tab "Caisse" [selected] [ref=f5e159] [cursor=pointer]
              - tab "Clôture" [ref=f5e161] [cursor=pointer]
            - tabpanel "Caisse" [ref=f5e163]:
              - generic [ref=f5e164]:
                - generic [ref=f5e165]:
                  - generic [ref=f5e166]:
                    - paragraph [ref=f5e168]: Espèces encaissées
                    - paragraph [ref=f5e173]:
                      - generic [ref=f5e174]: 120 000 F CFA
                    - paragraph [ref=f5e175]: Ventes au guichet, toutes caisses
                  - generic [ref=f5e176]:
                    - paragraph [ref=f5e178]: Caisses ouvertes
                    - paragraph [ref=f5e183]: "1"
                    - paragraph [ref=f5e184]: Contrôleurs en service
                  - generic [ref=f5e185]:
                    - paragraph [ref=f5e187]: Caisses clôturées
                    - paragraph [ref=f5e194]: "2"
                    - paragraph [ref=f5e195]: Caisses fermées
                  - generic [ref=f5e196]:
                    - paragraph [ref=f5e198]: Écart cumulé
                    - paragraph [ref=f5e204]:
                      - generic [ref=f5e205]: "-2 000 F CFA"
                    - paragraph [ref=f5e206]: Déclaré moins attendu, caisses clôturées
                - region [ref=f5e207]:
                  - generic [ref=f5e209]:
                    - heading "Code PIN régisseur" [level=2] [ref=f5e210]
                    - paragraph [ref=f5e211]: Le PIN est exigé à l’ouverture de chaque caisse. Un écart de clôture se valide ici, depuis votre compte, et non plus par le PIN. Il n’est affiché qu’une fois, à sa génération.
                  - generic [ref=f5e212]:
                    - paragraph [ref=f5e213]:
                      - generic [ref=f5e217]:
                        - text: Un code est en place depuis le
                        - time [ref=f5e218]: jeu. 19 nov. 2026 à 10:34
                        - text: .
                    - button "Régénérer le code PIN" [ref=f5e219] [cursor=pointer]
                - region [ref=f5e225]:
                  - heading "Espèces par contrôleur" [level=2] [ref=f5e228]
                  - generic [ref=f5e229]:
                    - generic [ref=f5e230]:
                      - term [ref=f5e231]: Ibrahima Gueye · 1 caisse, dont une ouverte
                      - definition [ref=f5e232]: 55 000 F CFA
                    - generic [ref=f5e233]:
                      - term [ref=f5e234]: Seynabou Ba · 1 caisse
                      - definition [ref=f5e235]: 50 000 F CFA
                    - generic [ref=f5e236]:
                      - term [ref=f5e237]: Lamine Cissé · 1 caisse
                      - definition [ref=f5e238]: 15 000 F CFA
                - region [ref=f5e239]:
                  - generic [ref=f5e241]:
                    - heading "Sessions de caisse" [level=2] [ref=f5e242]
                    - paragraph [ref=f5e243]: Le Z détaillé de chaque caisse figure dans l’onglet Clôture.
                  - table [ref=f5e246]:
                    - caption [ref=f5e247]: Sessions de caisse de l’événement
                    - rowgroup [ref=f5e248]:
                      - row [ref=f5e249]:
                        - columnheader "Contrôleur" [ref=f5e250]
                        - columnheader "État" [ref=f5e251]
                        - columnheader "Ouverte le" [ref=f5e252]
                        - columnheader "Fonds de caisse" [ref=f5e253]
                        - columnheader "Encaissé" [ref=f5e254]
                        - columnheader "Déclaré" [ref=f5e255]
                        - columnheader "Écart" [ref=f5e256]
                        - columnheader "Action" [ref=f5e257]
                    - rowgroup [ref=f5e258]:
                      - row [ref=f5e259]:
                        - cell "Ibrahima Gueye" [ref=f5e260]
                        - cell "Ouverte" [ref=f5e261]
                        - cell [ref=f5e262]:
                          - time [ref=f5e263]: jeu. 19 nov. 2026 à 10:34
                        - cell "10 000 F CFA" [ref=f5e264]
                        - cell "55 000 F CFA" [ref=f5e265]
                        - cell "Pas encore" [ref=f5e266]
                        - cell "Caisse ouverte" [ref=f5e267]
                        - cell [ref=f5e268]:
                          - button "Fermer cette caisse (Ibrahima Gueye)" [ref=f5e269] [cursor=pointer]:
                            - generic [ref=f5e274]: Fermer cette caisse
                      - row [ref=f5e275]:
                        - cell "Seynabou Ba" [ref=f5e276]
                        - cell "Clôturée" [ref=f5e277]
                        - cell [ref=f5e278]:
                          - time [ref=f5e279]: jeu. 19 nov. 2026 à 10:34
                        - cell "5 000 F CFA" [ref=f5e280]
                        - cell "50 000 F CFA" [ref=f5e281]
                        - cell "48 000 F CFA" [ref=f5e282]
                        - cell "-2 000 F CFA Erreur de rendu de monnaie sur une vente VIP, signalée au régisseur en fin de service." [ref=f5e283]:
                          - generic [ref=f5e284]:
                            - text: "-2 000 F CFA"
                            - generic [ref=f5e285]: Erreur de rendu de monnaie sur une vente VIP, signalée au régisseur en fin de service.
                        - cell [ref=f5e286]
                      - row [ref=f5e287]:
                        - cell "Lamine Cissé" [ref=f5e288]
                        - cell "Clôturée" [ref=f5e289]
                        - cell [ref=f5e290]:
                          - time [ref=f5e291]: jeu. 19 nov. 2026 à 10:34
                        - cell "5 000 F CFA" [ref=f5e292]
                        - cell "15 000 F CFA" [ref=f5e293]
                        - cell "15 000 F CFA" [ref=f5e294]
                        - cell "Aucun écart" [ref=f5e295]
                        - cell [ref=f5e296]
                - region [ref=f5e297]:
                  - generic [ref=f5e299]:
                    - heading "Écarts à valider" [level=2] [ref=f5e300]
                    - paragraph [ref=f5e301]: Une caisse fermée avec un écart attend votre validation. Vérifiez la justification du contrôleur avant de valider.
                  - list [ref=f5e302]:
                    - listitem [ref=f5e303]:
                      - generic [ref=f5e304]:
                        - paragraph [ref=f5e305]: Seynabou Ba · écart de -2 000 F CFA
                        - paragraph [ref=f5e306]: « Erreur de rendu de monnaie sur une vente VIP, signalée au régisseur en fin de service. »
                        - paragraph [ref=f5e307]:
                          - text: Fermée le
                          - time [ref=f5e308]: jeu. 19 nov. 2026 à 10:34
                      - button "Valider l’écart de la caisse de Seynabou Ba" [ref=f5e309] [cursor=pointer]:
                        - generic [ref=f5e314]: Valider l’écart
  - alert [ref=f5e315]
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
      |                                                                                        ^ Error: contrôles responsive de org-pilotage-caisse (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```