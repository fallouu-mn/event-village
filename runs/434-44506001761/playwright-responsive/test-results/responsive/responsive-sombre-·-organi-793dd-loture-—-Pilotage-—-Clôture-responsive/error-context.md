# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · organisateur >> org-pilotage-cloture — Pilotage — Clôture
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de org-pilotage-cloture (sombre)

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
            - generic [ref=f2e113]:
              - 'generic "L’événement est passé : la vente est close, le bilan reste consultable." [ref=f2e115]': Terminé
              - heading "Brunch électro des Almadies" [level=1] [ref=f2e118]
              - paragraph [ref=f2e119]:
                - generic [ref=f2e120]:
                  - generic [ref=f2e121]: dim. 15 nov. 2026 à 12:00
                  - generic [ref=f2e124]: Rooftop de la Pointe des Almadies, Dakar
          - generic [ref=f2e128]:
            - tablist "Rubriques du pilotage" [ref=f2e131]:
              - tab "Aperçu" [ref=f2e132] [cursor=pointer]
              - tab "Infos" [ref=f2e134] [cursor=pointer]
              - tab "Ventes" [ref=f2e136] [cursor=pointer]
              - tab "Invitations" [ref=f2e138] [cursor=pointer]
              - tab "Entrées" [ref=f2e140] [cursor=pointer]
              - tab "Équipe" [ref=f2e142] [cursor=pointer]
              - tab "Caisse" [ref=f2e144] [cursor=pointer]
              - tab "Clôture" [selected] [ref=f2e146] [cursor=pointer]
            - tabpanel "Clôture" [ref=f2e148]:
              - generic [ref=f2e149]:
                - generic [ref=f2e150]:
                  - generic [ref=f2e151]:
                    - generic [ref=f2e152]:
                      - paragraph [ref=f2e154]: Montant net organisateur
                      - paragraph [ref=f2e158]:
                        - generic [ref=f2e159]: 150 000 F CFA
                      - paragraph [ref=f2e160]: Ventes en ligne, remboursements déduits
                    - generic [ref=f2e161]:
                      - paragraph [ref=f2e163]: Disponibilité des fonds
                      - paragraph [ref=f2e169]: sam. 21 nov. 2026 à 16:45
                      - paragraph [ref=f2e170]: Selon le délai de versement de la plateforme
                    - generic [ref=f2e171]:
                      - paragraph [ref=f2e173]: Absents
                      - paragraph [ref=f2e180]: "2"
                      - paragraph [ref=f2e181]: Billets valides jamais scannés à l’entrée
                  - region [ref=f2e182]:
                    - generic [ref=f2e184]:
                      - heading "Rapport de clôture" [level=2] [ref=f2e185]
                      - paragraph [ref=f2e186]: Bilan complet de l’événement.
                    - generic [ref=f2e187]:
                      - generic [ref=f2e188]:
                        - generic [ref=f2e189]:
                          - term [ref=f2e190]: Billets vendus (hors invitations)
                          - definition [ref=f2e191]: "10"
                        - generic [ref=f2e192]:
                          - term [ref=f2e193]: Invitations
                          - definition [ref=f2e194]: "0"
                        - generic [ref=f2e195]:
                          - term [ref=f2e196]: Capacité mise en vente
                          - definition [ref=f2e197]: "80"
                        - generic [ref=f2e198]:
                          - term [ref=f2e199]: Entrées (dont guichet)
                          - definition [ref=f2e200]: 8 (0)
                        - generic [ref=f2e201]:
                          - term [ref=f2e202]: Refus au contrôle
                          - definition [ref=f2e203]: "0"
                      - generic [ref=f2e204]:
                        - generic [ref=f2e205]:
                          - term [ref=f2e206]: Recettes en ligne
                          - definition [ref=f2e207]: 150 000 F CFA
                        - generic [ref=f2e208]:
                          - term [ref=f2e209]: Recettes en espèces
                          - definition [ref=f2e210]: 0 F CFA
                        - generic [ref=f2e211]:
                          - term [ref=f2e212]: Remboursé
                          - definition [ref=f2e213]: 0 F CFA
                        - generic [ref=f2e214]:
                          - term [ref=f2e215]: Frais de service payés par les acheteurs
                          - definition [ref=f2e216]: 7 500 F CFA
                        - generic [ref=f2e217]:
                          - term [ref=f2e218]: Déjà disponible / en attente
                          - definition [ref=f2e219]: 0 F CFA / 150 000 F CFA
                  - region [ref=f2e220]:
                    - heading "Entrées" [level=2] [ref=f2e223]
                    - generic [ref=f2e224]:
                      - region [ref=f2e225]:
                        - heading "Par point d’entrée" [level=2] [ref=f2e228]
                        - table [ref=f2e231]:
                          - caption [ref=f2e232]: Entrées par point d’entrée
                          - rowgroup [ref=f2e233]:
                            - row [ref=f2e234]:
                              - columnheader "Point d’entrée" [ref=f2e235]
                              - columnheader "Entrées" [ref=f2e236]
                              - columnheader "Refus" [ref=f2e237]
                          - rowgroup [ref=f2e238]:
                            - row [ref=f2e239]:
                              - cell "Point d’entrée non précisé" [ref=f2e240]
                              - cell "8" [ref=f2e241]
                              - cell "0" [ref=f2e242]
                      - generic [ref=f2e243]:
                        - region [ref=f2e244]:
                          - heading "Par catégorie" [level=2] [ref=f2e247]
                          - list "Entrées par catégorie" [ref=f2e248]:
                            - listitem [ref=f2e249]:
                              - generic [ref=f2e250]:
                                - generic [ref=f2e251]: Brunch
                                - generic [ref=f2e252]: 8 entrés sur 10
                        - region [ref=f2e255]:
                          - heading "Par origine" [level=2] [ref=f2e258]
                          - list "Entrées par origine" [ref=f2e259]:
                            - listitem [ref=f2e260]:
                              - generic [ref=f2e261]:
                                - generic [ref=f2e262]: En ligne
                                - generic [ref=f2e263]: 8 entrés sur 10
                            - listitem [ref=f2e266]:
                              - generic [ref=f2e267]:
                                - generic [ref=f2e268]: Guichet
                                - generic [ref=f2e269]: 0 entré sur 0
                            - listitem [ref=f2e271]:
                              - generic [ref=f2e272]:
                                - generic [ref=f2e273]: Gratuit
                                - generic [ref=f2e274]: 0 entré sur 0
                            - listitem [ref=f2e276]:
                              - generic [ref=f2e277]:
                                - generic [ref=f2e278]: Invitation
                                - generic [ref=f2e279]: 0 entré sur 0
                        - region [ref=f2e281]:
                          - generic [ref=f2e283]:
                            - heading "Flux par quart d’heure" [level=2] [ref=f2e284]
                            - paragraph [ref=f2e285]: Heure de Dakar.
                          - list "Entrées par quart d’heure" [ref=f2e286]:
                            - listitem [ref=f2e287]:
                              - generic [ref=f2e288]:
                                - time [ref=f2e290]: dim. 15 nov. 2026 à 11:30
                                - generic [ref=f2e291]: 1 entrée
                            - listitem [ref=f2e294]:
                              - generic [ref=f2e295]:
                                - time [ref=f2e297]: dim. 15 nov. 2026 à 11:45
                                - generic [ref=f2e298]: 1 entrée
                            - listitem [ref=f2e301]:
                              - generic [ref=f2e302]:
                                - time [ref=f2e304]: dim. 15 nov. 2026 à 12:15
                                - generic [ref=f2e305]: 1 entrée
                            - listitem [ref=f2e308]:
                              - generic [ref=f2e309]:
                                - time [ref=f2e311]: dim. 15 nov. 2026 à 12:30
                                - generic [ref=f2e312]: 1 entrée
                            - listitem [ref=f2e315]:
                              - generic [ref=f2e316]:
                                - time [ref=f2e318]: dim. 15 nov. 2026 à 13:00
                                - generic [ref=f2e319]: 1 entrée
                            - listitem [ref=f2e322]:
                              - generic [ref=f2e323]:
                                - time [ref=f2e325]: dim. 15 nov. 2026 à 13:15
                                - generic [ref=f2e326]: 1 entrée
                            - listitem [ref=f2e329]:
                              - generic [ref=f2e330]:
                                - time [ref=f2e332]: dim. 15 nov. 2026 à 13:45
                                - generic [ref=f2e333]: 1 entrée
                            - listitem [ref=f2e336]:
                              - generic [ref=f2e337]:
                                - time [ref=f2e339]: dim. 15 nov. 2026 à 14:00
                                - generic [ref=f2e340]: 1 entrée
                        - region [ref=f2e343]:
                          - heading "Refus par motif" [level=2] [ref=f2e346]
                          - paragraph [ref=f2e347]: Aucun refus.
                      - region [ref=f2e348]:
                        - generic [ref=f2e350]:
                          - heading "Validations par la liste des invités" [level=2] [ref=f2e351]
                          - paragraph [ref=f2e352]: Entrées validées par un contrôleur avec la liste des invités, pièce d’identité vérifiée.
                        - paragraph [ref=f2e353]: Aucune entrée validée par la liste des invités.
                - region [ref=f2e354]:
                  - generic [ref=f2e356]:
                    - heading "Z de caisse" [level=2] [ref=f2e357]
                    - paragraph [ref=f2e358]: "Une fiche par caisse : fonds, attendu, déclaré hors fonds et écart, détail par source et par catégorie."
                  - paragraph [ref=f2e359]: Aucune caisse pour cet événement.
                - region [ref=f2e360]:
                  - generic [ref=f2e362]:
                    - heading "Absents" [level=2] [ref=f2e363]
                    - paragraph [ref=f2e364]: Participants dont le billet valide n’a pas été scanné à l’entrée.
                  - table [ref=f2e367]:
                    - caption [ref=f2e368]: Participants absents
                    - rowgroup [ref=f2e369]:
                      - row [ref=f2e370]:
                        - columnheader "Participant" [ref=f2e371]
                        - columnheader "Catégorie" [ref=f2e372]
                    - rowgroup [ref=f2e373]:
                      - row [ref=f2e374]:
                        - cell "Adama Diouf" [ref=f2e375]
                        - cell "Brunch" [ref=f2e376]
                      - row [ref=f2e377]:
                        - cell "Adama Diouf" [ref=f2e378]
                        - cell "Brunch" [ref=f2e379]
                - region [ref=f2e380]:
                  - generic [ref=f2e382]:
                    - heading "Export des participants" [level=2] [ref=f2e383]
                    - paragraph [ref=f2e384]: "Fichier CSV : nom, catégorie, origine, statut du billet, heure d’entrée, zone et porte. Aucune donnée de paiement ni numéro de billet."
                  - generic [ref=f2e385]:
                    - generic [ref=f2e386] [cursor=pointer]:
                      - checkbox "Inclure le téléphone et l’email des participants Seulement pour l’une des finalités ci-dessous. L’export et sa finalité sont journalisés." [ref=f2e387]
                      - generic [ref=f2e388]:
                        - text: Inclure le téléphone et l’email des participants
                        - generic [ref=f2e389]: Seulement pour l’une des finalités ci-dessous. L’export et sa finalité sont journalisés.
                    - generic [ref=f2e390]:
                      - button "Exporter les participants" [ref=f2e391] [cursor=pointer]
                      - generic [ref=f2e397]: CSV compatible tableur (UTF-8)
  - alert [ref=f2e401]
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
      |                                                                                        ^ Error: contrôles responsive de org-pilotage-cloture (sombre)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```