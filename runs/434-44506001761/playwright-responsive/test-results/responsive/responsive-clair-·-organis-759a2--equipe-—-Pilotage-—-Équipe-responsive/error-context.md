# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · organisateur >> org-pilotage-equipe — Pilotage — Équipe
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de org-pilotage-equipe (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 5

- Array []
+ Array [
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
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
              - tab "Équipe" [selected] [ref=f5e157] [cursor=pointer]
              - tab "Caisse" [ref=f5e159] [cursor=pointer]
              - tab "Clôture" [ref=f5e161] [cursor=pointer]
            - tabpanel "Équipe" [ref=f5e163]:
              - region [ref=f5e165]:
                - generic [ref=f5e166]:
                  - generic [ref=f5e167]:
                    - heading "Équipe de cet événement" [level=2] [ref=f5e168]
                    - paragraph [ref=f5e169]: 3 contrôleurs · 3 prêts · 0 en attente
                    - status [ref=f5e170]: Mis à jour à 10:39
                  - button "Inviter un contrôleur" [ref=f5e173] [cursor=pointer]
                - group [ref=f5e179]:
                  - generic "Portes et couleurs" [ref=f5e180] [cursor=pointer]
                  - list "Portes et couleurs des événements" [ref=f5e181]:
                    - listitem [ref=f5e182]:
                      - generic [ref=f5e183]:
                        - paragraph [ref=f5e184]: Nuit du Sabar — édition d’automne · 19 nov. 2026 à 11:30
                        - link "Modifier les portes et les couleurs" [ref=f5e185] [cursor=pointer]:
                          - /url: /partner/events/1b6b9b15-31a6-41c3-856d-f27700d91f21/edit?etape=controle
                      - paragraph [ref=f5e187]: "Pas de zones : chaque contrôleur laisse entrer toutes les catégories."
                - generic [ref=f5e188]:
                  - generic [ref=f5e189]:
                    - paragraph [ref=f5e190]: Vous (organisatrice) — toutes les portes
                    - paragraph [ref=f5e191]: Vous scannez vos événements dont le contrôle est ouvert, à toutes les portes ou à une porte choisie, et vous vendez au guichet.
                  - link "Scanner les billets" [ref=f5e192] [cursor=pointer]:
                    - /url: /partner/scan
                - table [ref=f5e196]:
                  - caption [ref=f5e197]: Contrôleurs de l’équipe
                  - rowgroup [ref=f5e198]:
                    - row [ref=f5e199]:
                      - columnheader "Contrôleur" [ref=f5e200]
                      - columnheader "État" [ref=f5e201]
                      - columnheader "Porte et espèces" [ref=f5e202]
                  - rowgroup [ref=f5e203]:
                    - row [ref=f5e204]:
                      - cell [ref=f5e205]:
                        - generic [ref=f5e206]:
                          - generic [ref=f5e207]:
                            - paragraph [ref=f5e208]: Ibrahima Gueye
                            - paragraph [ref=f5e209]: 70 000 01 06
                          - generic [ref=f5e210]:
                            - link "Appeler Ibrahima Gueye" [ref=f5e211] [cursor=pointer]:
                              - /url: tel:+221700000106
                              - generic [ref=f5e214]: Appeler
                            - link "Écrire à Ibrahima Gueye sur WhatsApp" [ref=f5e215] [cursor=pointer]:
                              - /url: https://wa.me/221700000106?text=Bonjour%20Ibrahima%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2019%20nov.%202026%20%C3%A0%2011%3A30%2C%20Entr%C3%A9e%20principale.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                              - generic [ref=f5e218]: WhatsApp
                      - cell "Prêt Actif depuis le 19 nov. 2026 Retirer de l’équipe" [ref=f5e219]:
                        - generic [ref=f5e220]:
                          - generic [ref=f5e221]: Prêt
                          - paragraph [ref=f5e223]: Actif depuis le 19 nov. 2026
                          - button "Retirer de l’équipe" [ref=f5e225] [cursor=pointer]
                      - cell [ref=f5e227]:
                        - list "Événements de Ibrahima Gueye" [ref=f5e229]:
                          - listitem [ref=f5e230]:
                            - paragraph [ref=f5e231]: "Point d’entrée : Entrée principale"
                            - paragraph [ref=f5e232]: "Laisse entrer : toutes les catégories"
                            - generic [ref=f5e233]:
                              - generic [ref=f5e234]: Espèces autorisées
                              - generic [ref=f5e236]:
                                - button "Caisse ouverte" [ref=f5e237] [cursor=pointer]
                                - button "32 entrées · dernier scan à 10:31" [ref=f5e238] [cursor=pointer]
                            - generic [ref=f5e239]:
                              - button "Modifier" [ref=f5e240] [cursor=pointer]
                              - button "Retirer de cet événement" [ref=f5e242] [cursor=pointer]
                    - row [ref=f5e244]:
                      - cell [ref=f5e245]:
                        - generic [ref=f5e246]:
                          - generic [ref=f5e247]:
                            - paragraph [ref=f5e248]: Lamine Cissé
                            - paragraph [ref=f5e249]: 70 000 01 08
                          - generic [ref=f5e250]:
                            - link "Appeler Lamine Cissé" [ref=f5e251] [cursor=pointer]:
                              - /url: tel:+221700000108
                              - generic [ref=f5e254]: Appeler
                            - link "Écrire à Lamine Cissé sur WhatsApp" [ref=f5e255] [cursor=pointer]:
                              - /url: https://wa.me/221700000108?text=Bonjour%20Lamine%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2019%20nov.%202026%20%C3%A0%2011%3A30%2C%20Entr%C3%A9e%20principale.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                              - generic [ref=f5e258]: WhatsApp
                      - cell "Prêt Actif depuis le 19 nov. 2026 Retirer de l’équipe" [ref=f5e259]:
                        - generic [ref=f5e260]:
                          - generic [ref=f5e261]: Prêt
                          - paragraph [ref=f5e263]: Actif depuis le 19 nov. 2026
                          - button "Retirer de l’équipe" [ref=f5e265] [cursor=pointer]
                      - cell [ref=f5e267]:
                        - list "Événements de Lamine Cissé" [ref=f5e269]:
                          - listitem [ref=f5e270]:
                            - paragraph [ref=f5e271]: "Point d’entrée : Entrée principale"
                            - paragraph [ref=f5e272]: "Laisse entrer : toutes les catégories"
                            - generic [ref=f5e273]:
                              - generic [ref=f5e274]: Espèces autorisées
                              - button "22 entrées · dernier scan à 10:27" [ref=f5e277] [cursor=pointer]
                            - generic [ref=f5e278]:
                              - button "Modifier" [ref=f5e279] [cursor=pointer]
                              - button "Retirer de cet événement" [ref=f5e281] [cursor=pointer]
                    - row [ref=f5e283]:
                      - cell [ref=f5e284]:
                        - generic [ref=f5e285]:
                          - generic [ref=f5e286]:
                            - paragraph [ref=f5e287]: Seynabou Ba
                            - paragraph [ref=f5e288]: 70 000 01 07
                          - generic [ref=f5e289]:
                            - link "Appeler Seynabou Ba" [ref=f5e290] [cursor=pointer]:
                              - /url: tel:+221700000107
                              - generic [ref=f5e293]: Appeler
                            - link "Écrire à Seynabou Ba sur WhatsApp" [ref=f5e294] [cursor=pointer]:
                              - /url: https://wa.me/221700000107?text=Bonjour%20Seynabou%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2019%20nov.%202026%20%C3%A0%2011%3A30%2C%20Entr%C3%A9e%20VIP.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                              - generic [ref=f5e297]: WhatsApp
                      - cell "Prêt Actif depuis le 19 nov. 2026 Retirer de l’équipe" [ref=f5e298]:
                        - generic [ref=f5e299]:
                          - generic [ref=f5e300]: Prêt
                          - paragraph [ref=f5e302]: Actif depuis le 19 nov. 2026
                          - button "Retirer de l’équipe" [ref=f5e304] [cursor=pointer]
                      - cell [ref=f5e306]:
                        - list "Événements de Seynabou Ba" [ref=f5e308]:
                          - listitem [ref=f5e309]:
                            - paragraph [ref=f5e310]: "Point d’entrée : Entrée VIP"
                            - paragraph [ref=f5e311]: "Laisse entrer : toutes les catégories"
                            - generic [ref=f5e312]:
                              - generic [ref=f5e313]: Espèces autorisées
                              - button "7 entrées · dernier scan à 10:23" [ref=f5e316] [cursor=pointer]
                            - generic [ref=f5e317]:
                              - button "Modifier" [ref=f5e318] [cursor=pointer]
                              - button "Retirer de cet événement" [ref=f5e320] [cursor=pointer]
  - alert [ref=f5e322]
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
      |                                                                                        ^ Error: contrôles responsive de org-pilotage-equipe (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```