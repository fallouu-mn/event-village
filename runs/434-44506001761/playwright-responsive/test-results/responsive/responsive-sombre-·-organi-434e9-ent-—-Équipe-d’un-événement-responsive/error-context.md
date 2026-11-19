# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · organisateur >> org-equipe-evenement — Équipe d’un événement
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de org-equipe-evenement (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
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
              - tab "Ventes" [ref=f2e151] [cursor=pointer]
              - tab "Invitations" [ref=f2e153] [cursor=pointer]
              - tab "Entrées" [ref=f2e155] [cursor=pointer]
              - tab "Équipe" [selected] [ref=f2e157] [cursor=pointer]
              - tab "Caisse" [ref=f2e159] [cursor=pointer]
              - tab "Clôture" [ref=f2e161] [cursor=pointer]
            - tabpanel "Équipe" [ref=f2e163]:
              - region [ref=f2e165]:
                - generic [ref=f2e166]:
                  - generic [ref=f2e167]:
                    - heading "Équipe de cet événement" [level=2] [ref=f2e168]
                    - paragraph [ref=f2e169]: 3 contrôleurs · 3 prêts · 0 en attente
                    - status [ref=f2e170]: Mis à jour à 10:45
                  - button "Inviter un contrôleur" [ref=f2e173] [cursor=pointer]
                - group [ref=f2e179]:
                  - generic "Portes et couleurs" [ref=f2e180] [cursor=pointer]
                  - list "Portes et couleurs des événements" [ref=f2e181]:
                    - listitem [ref=f2e182]:
                      - generic [ref=f2e183]:
                        - paragraph [ref=f2e184]: Nuit du Sabar — édition d’automne · 19 nov. 2026 à 11:30
                        - link "Modifier les portes et les couleurs" [ref=f2e185] [cursor=pointer]:
                          - /url: /partner/events/1b6b9b15-31a6-41c3-856d-f27700d91f21/edit?etape=controle
                      - paragraph [ref=f2e187]: "Pas de zones : chaque contrôleur laisse entrer toutes les catégories."
                - generic [ref=f2e188]:
                  - generic [ref=f2e189]:
                    - paragraph [ref=f2e190]: Vous (organisatrice) — toutes les portes
                    - paragraph [ref=f2e191]: Vous scannez vos événements dont le contrôle est ouvert, à toutes les portes ou à une porte choisie, et vous vendez au guichet.
                  - link "Scanner les billets" [ref=f2e192] [cursor=pointer]:
                    - /url: /partner/scan
                - table [ref=f2e196]:
                  - caption [ref=f2e197]: Contrôleurs de l’équipe
                  - rowgroup [ref=f2e198]:
                    - row [ref=f2e199]:
                      - columnheader "Contrôleur" [ref=f2e200]
                      - columnheader "État" [ref=f2e201]
                      - columnheader "Porte et espèces" [ref=f2e202]
                  - rowgroup [ref=f2e203]:
                    - row [ref=f2e204]:
                      - cell [ref=f2e205]:
                        - generic [ref=f2e206]:
                          - generic [ref=f2e207]:
                            - paragraph [ref=f2e208]: Ibrahima Gueye
                            - paragraph [ref=f2e209]: 70 000 01 06
                          - generic [ref=f2e210]:
                            - link "Appeler Ibrahima Gueye" [ref=f2e211] [cursor=pointer]:
                              - /url: tel:+221700000106
                              - generic [ref=f2e214]: Appeler
                            - link "Écrire à Ibrahima Gueye sur WhatsApp" [ref=f2e215] [cursor=pointer]:
                              - /url: https://wa.me/221700000106?text=Bonjour%20Ibrahima%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2019%20nov.%202026%20%C3%A0%2011%3A30%2C%20Entr%C3%A9e%20principale.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                              - generic [ref=f2e218]: WhatsApp
                      - cell "Prêt Actif depuis le 19 nov. 2026 Retirer de l’équipe" [ref=f2e219]:
                        - generic [ref=f2e220]:
                          - generic [ref=f2e221]: Prêt
                          - paragraph [ref=f2e223]: Actif depuis le 19 nov. 2026
                          - button "Retirer de l’équipe" [ref=f2e225] [cursor=pointer]
                      - cell [ref=f2e227]:
                        - list "Événements de Ibrahima Gueye" [ref=f2e229]:
                          - listitem [ref=f2e230]:
                            - paragraph [ref=f2e231]: "Point d’entrée : Entrée principale"
                            - paragraph [ref=f2e232]: "Laisse entrer : toutes les catégories"
                            - generic [ref=f2e233]:
                              - generic [ref=f2e234]: Espèces autorisées
                              - generic [ref=f2e236]:
                                - button "Caisse ouverte" [ref=f2e237] [cursor=pointer]
                                - button "32 entrées · dernier scan à 10:31" [ref=f2e238] [cursor=pointer]
                            - generic [ref=f2e239]:
                              - button "Modifier" [ref=f2e240] [cursor=pointer]
                              - button "Retirer de cet événement" [ref=f2e242] [cursor=pointer]
                    - row [ref=f2e244]:
                      - cell [ref=f2e245]:
                        - generic [ref=f2e246]:
                          - generic [ref=f2e247]:
                            - paragraph [ref=f2e248]: Lamine Cissé
                            - paragraph [ref=f2e249]: 70 000 01 08
                          - generic [ref=f2e250]:
                            - link "Appeler Lamine Cissé" [ref=f2e251] [cursor=pointer]:
                              - /url: tel:+221700000108
                              - generic [ref=f2e254]: Appeler
                            - link "Écrire à Lamine Cissé sur WhatsApp" [ref=f2e255] [cursor=pointer]:
                              - /url: https://wa.me/221700000108?text=Bonjour%20Lamine%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2019%20nov.%202026%20%C3%A0%2011%3A30%2C%20Entr%C3%A9e%20principale.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                              - generic [ref=f2e258]: WhatsApp
                      - cell "Prêt Actif depuis le 19 nov. 2026 Retirer de l’équipe" [ref=f2e259]:
                        - generic [ref=f2e260]:
                          - generic [ref=f2e261]: Prêt
                          - paragraph [ref=f2e263]: Actif depuis le 19 nov. 2026
                          - button "Retirer de l’équipe" [ref=f2e265] [cursor=pointer]
                      - cell [ref=f2e267]:
                        - list "Événements de Lamine Cissé" [ref=f2e269]:
                          - listitem [ref=f2e270]:
                            - paragraph [ref=f2e271]: "Point d’entrée : Entrée principale"
                            - paragraph [ref=f2e272]: "Laisse entrer : toutes les catégories"
                            - generic [ref=f2e273]:
                              - generic [ref=f2e274]: Espèces autorisées
                              - button "22 entrées · dernier scan à 10:27" [ref=f2e277] [cursor=pointer]
                            - generic [ref=f2e278]:
                              - button "Modifier" [ref=f2e279] [cursor=pointer]
                              - button "Retirer de cet événement" [ref=f2e281] [cursor=pointer]
                    - row [ref=f2e283]:
                      - cell [ref=f2e284]:
                        - generic [ref=f2e285]:
                          - generic [ref=f2e286]:
                            - paragraph [ref=f2e287]: Seynabou Ba
                            - paragraph [ref=f2e288]: 70 000 01 07
                          - generic [ref=f2e289]:
                            - link "Appeler Seynabou Ba" [ref=f2e290] [cursor=pointer]:
                              - /url: tel:+221700000107
                              - generic [ref=f2e293]: Appeler
                            - link "Écrire à Seynabou Ba sur WhatsApp" [ref=f2e294] [cursor=pointer]:
                              - /url: https://wa.me/221700000107?text=Bonjour%20Seynabou%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2019%20nov.%202026%20%C3%A0%2011%3A30%2C%20Entr%C3%A9e%20VIP.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                              - generic [ref=f2e297]: WhatsApp
                      - cell "Prêt Actif depuis le 19 nov. 2026 Retirer de l’équipe" [ref=f2e298]:
                        - generic [ref=f2e299]:
                          - generic [ref=f2e300]: Prêt
                          - paragraph [ref=f2e302]: Actif depuis le 19 nov. 2026
                          - button "Retirer de l’équipe" [ref=f2e304] [cursor=pointer]
                      - cell [ref=f2e306]:
                        - list "Événements de Seynabou Ba" [ref=f2e308]:
                          - listitem [ref=f2e309]:
                            - paragraph [ref=f2e310]: "Point d’entrée : Entrée VIP"
                            - paragraph [ref=f2e311]: "Laisse entrer : toutes les catégories"
                            - generic [ref=f2e312]:
                              - generic [ref=f2e313]: Espèces autorisées
                              - button "7 entrées · dernier scan à 10:23" [ref=f2e316] [cursor=pointer]
                            - generic [ref=f2e317]:
                              - button "Modifier" [ref=f2e318] [cursor=pointer]
                              - button "Retirer de cet événement" [ref=f2e320] [cursor=pointer]
  - alert [ref=f2e322]
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
      |                                                                                        ^ Error: contrôles responsive de org-equipe-evenement (sombre)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```