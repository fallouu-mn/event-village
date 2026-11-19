# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · organisateur >> org-evenements — Mes événements
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de org-evenements (clair)

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
          - generic [ref=f5e106]:
            - generic [ref=f5e107]:
              - status [ref=f5e109]: Mis à jour à 10:38
              - heading "Mes événements" [level=1] [ref=f5e111]
              - paragraph [ref=f5e112]: Soumettez, publiez et pilotez vos événements. Les indicateurs portent sur tous vos événements.
            - link "Créer un événement" [ref=f5e114] [cursor=pointer]:
              - /url: /partner/events/new
          - region "Indicateurs sur tous vos événements" [ref=f5e119]:
            - generic [ref=f5e120]:
              - paragraph [ref=f5e122]: Événements
              - paragraph [ref=f5e126]: "9"
              - paragraph [ref=f5e127]: Tous statuts confondus
            - generic [ref=f5e128]:
              - paragraph [ref=f5e130]: Billets vendus
              - paragraph [ref=f5e134]: "133"
              - paragraph [ref=f5e135]: Hors invitations
            - generic [ref=f5e136]:
              - paragraph [ref=f5e138]: Recettes en ligne
              - paragraph [ref=f5e142]:
                - generic [ref=f5e143]: 828 000 F CFA
              - paragraph [ref=f5e144]: Billets payés en ligne, remboursements déduits
            - generic [ref=f5e145]:
              - paragraph [ref=f5e147]: Recettes en espèces
              - paragraph [ref=f5e152]:
                - generic [ref=f5e153]: 138 000 F CFA
              - paragraph [ref=f5e154]: Encaissées par vos contrôleurs
          - generic [ref=f5e155]:
            - tablist "Statut des événements" [ref=f5e158]:
              - tab "Tous , 9" [selected] [ref=f5e159] [cursor=pointer]:
                - generic [ref=f5e160]: Tous
                - generic [ref=f5e161]:
                  - generic [ref=f5e162]: ","
                  - text: "9"
              - tab "Brouillon , 1" [ref=f5e163] [cursor=pointer]:
                - generic [ref=f5e164]: Brouillon
                - generic [ref=f5e165]:
                  - generic [ref=f5e166]: ","
                  - text: "1"
              - tab "En attente de validation , 1" [ref=f5e167] [cursor=pointer]:
                - generic [ref=f5e168]: En attente de validation
                - generic [ref=f5e169]:
                  - generic [ref=f5e170]: ","
                  - text: "1"
              - tab "Validé , 1" [ref=f5e171] [cursor=pointer]:
                - generic [ref=f5e172]: Validé
                - generic [ref=f5e173]:
                  - generic [ref=f5e174]: ","
                  - text: "1"
              - tab "Publié , 4" [ref=f5e175] [cursor=pointer]:
                - generic [ref=f5e176]: Publié
                - generic [ref=f5e177]:
                  - generic [ref=f5e178]: ","
                  - text: "4"
              - tab "Suspendu , 0" [ref=f5e179] [cursor=pointer]:
                - generic [ref=f5e180]: Suspendu
                - generic [ref=f5e181]:
                  - generic [ref=f5e182]: ","
                  - text: "0"
              - tab "Terminé , 1" [ref=f5e183] [cursor=pointer]:
                - generic [ref=f5e184]: Terminé
                - generic [ref=f5e185]:
                  - generic [ref=f5e186]: ","
                  - text: "1"
              - tab "Annulé , 1" [ref=f5e187] [cursor=pointer]:
                - generic [ref=f5e188]: Annulé
                - generic [ref=f5e189]:
                  - generic [ref=f5e190]: ","
                  - text: "1"
            - search [ref=f5e191]:
              - generic [ref=f5e192]:
                - generic [ref=f5e193]: Rechercher un événement
                - searchbox "Rechercher un événement" [ref=f5e195]
              - button "Rechercher" [ref=f5e196] [cursor=pointer]
            - tabpanel "Tous , 9" [ref=f5e202]:
              - list "Événements" [ref=f5e203]:
                - listitem [ref=f5e204]:
                  - article [ref=f5e205]:
                    - generic [ref=f5e207]:
                      - 'generic "Accepté par l’équipe Event Village : l’organisateur peut maintenant le publier." [ref=f5e209]': Validé
                      - heading "Grande soirée du Monument de la Renaissance" [level=2] [ref=f5e212]
                      - list [ref=f5e213]:
                        - listitem [ref=f5e214]:
                          - generic [ref=f5e217]: dim. 22 nov. 2026 à 20:00
                        - listitem [ref=f5e218]:
                          - generic [ref=f5e222]: Esplanade du Monument de la Renaissance, Dakar
                      - generic [ref=f5e223]:
                        - button "Publier" [ref=f5e224] [cursor=pointer]
                        - link "Piloter" [ref=f5e230] [cursor=pointer]:
                          - /url: /partner/events/7f42abc7-0079-4ef2-a494-ff5eb79d07ed
                        - link "Modifier" [ref=f5e236] [cursor=pointer]:
                          - /url: /partner/events/7f42abc7-0079-4ef2-a494-ff5eb79d07ed/edit
                        - button "Annuler l’événement" [ref=f5e242] [cursor=pointer]
                - listitem [ref=f5e248]:
                  - article [ref=f5e249]:
                    - generic [ref=f5e251]:
                      - generic "En cours de rédaction par l’organisateur, visible de lui seul." [ref=f5e253]: Brouillon
                      - heading "Concert acoustique au jardin" [level=2] [ref=f5e256]
                      - list [ref=f5e257]:
                        - listitem [ref=f5e258]:
                          - generic [ref=f5e261]: mar. 29 déc. 2026 à 19:00
                        - listitem [ref=f5e262]:
                          - generic [ref=f5e266]: Jardin de la Maison des Arts, Dakar
                      - generic [ref=f5e267]:
                        - button "Soumettre à la validation" [ref=f5e268] [cursor=pointer]
                        - link "Modifier" [ref=f5e274] [cursor=pointer]:
                          - /url: /partner/events/0f94b05a-5e6e-49bd-a5d4-03563ae0b198/edit
                        - button "Supprimer le brouillon" [ref=f5e280] [cursor=pointer]
                - listitem [ref=f5e286]:
                  - article [ref=f5e287]:
                    - generic [ref=f5e289]:
                      - generic "Soumis à l’équipe Event Village, qui vérifie la fiche avant validation." [ref=f5e291]: En attente de validation
                      - heading "Matinée gospel et chorales" [level=2] [ref=f5e294]
                      - list [ref=f5e295]:
                        - listitem [ref=f5e296]:
                          - generic [ref=f5e299]: dim. 13 déc. 2026 à 10:00
                        - listitem [ref=f5e300]:
                          - generic [ref=f5e304]: Théâtre de verdure de Sicap, Dakar
                      - button "Retirer de la validation" [ref=f5e306] [cursor=pointer]
                - listitem [ref=f5e312]:
                  - article [ref=f5e313]:
                    - generic [ref=f5e315]:
                      - 'generic "L’événement est passé : la vente est close, le bilan reste consultable." [ref=f5e317]': Terminé
                      - heading "Brunch électro des Almadies" [level=2] [ref=f5e320]
                      - list [ref=f5e321]:
                        - listitem [ref=f5e322]:
                          - generic [ref=f5e325]: dim. 15 nov. 2026 à 12:00
                        - listitem [ref=f5e326]:
                          - generic [ref=f5e330]: Rooftop de la Pointe des Almadies, Dakar
                      - link "Piloter" [ref=f5e332] [cursor=pointer]:
                        - /url: /partner/events/8dca62e5-b925-45e2-8ea8-ff5b710d8b98
                - listitem [ref=f5e338]:
                  - article [ref=f5e339]:
                    - generic [ref=f5e341]:
                      - 'generic "Annulé : les participants sont prévenus et les billets payés sont remboursés." [ref=f5e343]': Annulé
                      - heading "Croisière musicale vers Gorée" [level=2] [ref=f5e346]
                      - list [ref=f5e347]:
                        - listitem [ref=f5e348]:
                          - generic [ref=f5e351]: jeu. 19 nov. 2026 à 14:45
                        - listitem [ref=f5e352]:
                          - generic [ref=f5e356]: Embarcadère du port de Dakar, Dakar
                      - link "Piloter" [ref=f5e358] [cursor=pointer]:
                        - /url: /partner/events/a3889ed1-11f5-41e2-b44d-f4e935b8a3a2
                - listitem [ref=f5e364]:
                  - article [ref=f5e365]:
                    - generic [ref=f5e367]:
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f5e369]': Publié
                      - heading "Soirée Kora & Lumières" [level=2] [ref=f5e372]
                      - list [ref=f5e373]:
                        - listitem [ref=f5e374]:
                          - generic [ref=f5e377]: dim. 6 déc. 2026 à 20:30
                        - listitem [ref=f5e378]:
                          - generic [ref=f5e382]: Jardin de la Maison des Arts, Dakar
                      - generic [ref=f5e383]:
                        - link "Piloter" [ref=f5e384] [cursor=pointer]:
                          - /url: /partner/events/51729819-f190-4aed-8679-5f33482543fa
                        - link "Modifier" [ref=f5e390] [cursor=pointer]:
                          - /url: /partner/events/51729819-f190-4aed-8679-5f33482543fa/edit
                        - button "Annuler l’événement" [ref=f5e396] [cursor=pointer]
                - listitem [ref=f5e402]:
                  - article [ref=f5e403]:
                    - generic [ref=f5e405]:
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f5e407]': Publié
                      - heading "Festival Jazz sur le Fleuve" [level=2] [ref=f5e410]
                      - list [ref=f5e411]:
                        - listitem [ref=f5e412]:
                          - generic [ref=f5e415]: mar. 1 déc. 2026 à 18:00
                        - listitem [ref=f5e416]:
                          - generic [ref=f5e420]: Quai des Pêcheurs, Saint-Louis
                      - generic [ref=f5e421]:
                        - link "Piloter" [ref=f5e422] [cursor=pointer]:
                          - /url: /partner/events/cbf928d9-6a7a-4bcf-822d-29f5e71c0fbe
                        - link "Modifier" [ref=f5e428] [cursor=pointer]:
                          - /url: /partner/events/cbf928d9-6a7a-4bcf-822d-29f5e71c0fbe/edit
                        - button "Annuler l’événement" [ref=f5e434] [cursor=pointer]
                - listitem [ref=f5e440]:
                  - article [ref=f5e441]:
                    - generic [ref=f5e443]:
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f5e445]': Publié
                      - heading "Concert des Lumières de Gorée" [level=2] [ref=f5e448]
                      - list [ref=f5e449]:
                        - listitem [ref=f5e450]:
                          - generic [ref=f5e453]: ven. 20 nov. 2026 à 06:45
                        - listitem [ref=f5e454]:
                          - generic [ref=f5e458]: Place du Gouvernement, Gorée
                      - generic [ref=f5e459]:
                        - link "Piloter" [ref=f5e460] [cursor=pointer]:
                          - /url: /partner/events/3e0f741a-d31d-4cde-af85-7cca6884a434
                        - link "Modifier" [ref=f5e466] [cursor=pointer]:
                          - /url: /partner/events/3e0f741a-d31d-4cde-af85-7cca6884a434/edit
                        - button "Annuler l’événement" [ref=f5e472] [cursor=pointer]
                - listitem [ref=f5e478]:
                  - article [ref=f5e479]:
                    - generic [ref=f5e481]:
                      - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f5e483]': Publié
                      - heading "Nuit du Sabar — édition d’automne" [level=2] [ref=f5e486]
                      - list [ref=f5e487]:
                        - listitem [ref=f5e488]:
                          - generic [ref=f5e491]: jeu. 19 nov. 2026 à 11:30
                        - listitem [ref=f5e492]:
                          - generic [ref=f5e496]: Esplanade de la Corniche Ouest, Dakar
                      - generic [ref=f5e497]:
                        - link "Piloter" [ref=f5e498] [cursor=pointer]:
                          - /url: /partner/events/1b6b9b15-31a6-41c3-856d-f27700d91f21
                        - link "Modifier" [ref=f5e504] [cursor=pointer]:
                          - /url: /partner/events/1b6b9b15-31a6-41c3-856d-f27700d91f21/edit
                        - button "Annuler l’événement" [ref=f5e510] [cursor=pointer]
  - alert [ref=f5e516]
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
      |                                                                                        ^ Error: contrôles responsive de org-evenements (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```