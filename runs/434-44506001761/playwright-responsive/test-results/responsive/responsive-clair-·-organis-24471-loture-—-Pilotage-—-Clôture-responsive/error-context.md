# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · organisateur >> org-pilotage-cloture — Pilotage — Clôture
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de org-pilotage-cloture (clair)

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
            - generic [ref=f5e113]:
              - 'generic "L’événement est passé : la vente est close, le bilan reste consultable." [ref=f5e115]': Terminé
              - heading "Brunch électro des Almadies" [level=1] [ref=f5e118]
              - paragraph [ref=f5e119]:
                - generic [ref=f5e120]:
                  - generic [ref=f5e121]: dim. 15 nov. 2026 à 12:00
                  - generic [ref=f5e124]: Rooftop de la Pointe des Almadies, Dakar
          - generic [ref=f5e128]:
            - tablist "Rubriques du pilotage" [ref=f5e131]:
              - tab "Aperçu" [ref=f5e132] [cursor=pointer]
              - tab "Infos" [ref=f5e134] [cursor=pointer]
              - tab "Ventes" [ref=f5e136] [cursor=pointer]
              - tab "Invitations" [ref=f5e138] [cursor=pointer]
              - tab "Entrées" [ref=f5e140] [cursor=pointer]
              - tab "Équipe" [ref=f5e142] [cursor=pointer]
              - tab "Caisse" [ref=f5e144] [cursor=pointer]
              - tab "Clôture" [selected] [ref=f5e146] [cursor=pointer]
            - tabpanel "Clôture" [ref=f5e148]:
              - generic [ref=f5e149]:
                - generic [ref=f5e150]:
                  - generic [ref=f5e151]:
                    - generic [ref=f5e152]:
                      - paragraph [ref=f5e154]: Montant net organisateur
                      - paragraph [ref=f5e158]:
                        - generic [ref=f5e159]: 150 000 F CFA
                      - paragraph [ref=f5e160]: Ventes en ligne, remboursements déduits
                    - generic [ref=f5e161]:
                      - paragraph [ref=f5e163]: Disponibilité des fonds
                      - paragraph [ref=f5e169]: sam. 21 nov. 2026 à 16:45
                      - paragraph [ref=f5e170]: Selon le délai de versement de la plateforme
                    - generic [ref=f5e171]:
                      - paragraph [ref=f5e173]: Absents
                      - paragraph [ref=f5e180]: "2"
                      - paragraph [ref=f5e181]: Billets valides jamais scannés à l’entrée
                  - region [ref=f5e182]:
                    - generic [ref=f5e184]:
                      - heading "Rapport de clôture" [level=2] [ref=f5e185]
                      - paragraph [ref=f5e186]: Bilan complet de l’événement.
                    - generic [ref=f5e187]:
                      - generic [ref=f5e188]:
                        - generic [ref=f5e189]:
                          - term [ref=f5e190]: Billets vendus (hors invitations)
                          - definition [ref=f5e191]: "10"
                        - generic [ref=f5e192]:
                          - term [ref=f5e193]: Invitations
                          - definition [ref=f5e194]: "0"
                        - generic [ref=f5e195]:
                          - term [ref=f5e196]: Capacité mise en vente
                          - definition [ref=f5e197]: "80"
                        - generic [ref=f5e198]:
                          - term [ref=f5e199]: Entrées (dont guichet)
                          - definition [ref=f5e200]: 8 (0)
                        - generic [ref=f5e201]:
                          - term [ref=f5e202]: Refus au contrôle
                          - definition [ref=f5e203]: "0"
                      - generic [ref=f5e204]:
                        - generic [ref=f5e205]:
                          - term [ref=f5e206]: Recettes en ligne
                          - definition [ref=f5e207]: 150 000 F CFA
                        - generic [ref=f5e208]:
                          - term [ref=f5e209]: Recettes en espèces
                          - definition [ref=f5e210]: 0 F CFA
                        - generic [ref=f5e211]:
                          - term [ref=f5e212]: Remboursé
                          - definition [ref=f5e213]: 0 F CFA
                        - generic [ref=f5e214]:
                          - term [ref=f5e215]: Frais de service payés par les acheteurs
                          - definition [ref=f5e216]: 7 500 F CFA
                        - generic [ref=f5e217]:
                          - term [ref=f5e218]: Déjà disponible / en attente
                          - definition [ref=f5e219]: 0 F CFA / 150 000 F CFA
                  - region [ref=f5e220]:
                    - heading "Entrées" [level=2] [ref=f5e223]
                    - generic [ref=f5e224]:
                      - region [ref=f5e225]:
                        - heading "Par point d’entrée" [level=2] [ref=f5e228]
                        - table [ref=f5e231]:
                          - caption [ref=f5e232]: Entrées par point d’entrée
                          - rowgroup [ref=f5e233]:
                            - row [ref=f5e234]:
                              - columnheader "Point d’entrée" [ref=f5e235]
                              - columnheader "Entrées" [ref=f5e236]
                              - columnheader "Refus" [ref=f5e237]
                          - rowgroup [ref=f5e238]:
                            - row [ref=f5e239]:
                              - cell "Point d’entrée non précisé" [ref=f5e240]
                              - cell "8" [ref=f5e241]
                              - cell "0" [ref=f5e242]
                      - generic [ref=f5e243]:
                        - region [ref=f5e244]:
                          - heading "Par catégorie" [level=2] [ref=f5e247]
                          - list "Entrées par catégorie" [ref=f5e248]:
                            - listitem [ref=f5e249]:
                              - generic [ref=f5e250]:
                                - generic [ref=f5e251]: Brunch
                                - generic [ref=f5e252]: 8 entrés sur 10
                        - region [ref=f5e255]:
                          - heading "Par origine" [level=2] [ref=f5e258]
                          - list "Entrées par origine" [ref=f5e259]:
                            - listitem [ref=f5e260]:
                              - generic [ref=f5e261]:
                                - generic [ref=f5e262]: En ligne
                                - generic [ref=f5e263]: 8 entrés sur 10
                            - listitem [ref=f5e266]:
                              - generic [ref=f5e267]:
                                - generic [ref=f5e268]: Guichet
                                - generic [ref=f5e269]: 0 entré sur 0
                            - listitem [ref=f5e271]:
                              - generic [ref=f5e272]:
                                - generic [ref=f5e273]: Gratuit
                                - generic [ref=f5e274]: 0 entré sur 0
                            - listitem [ref=f5e276]:
                              - generic [ref=f5e277]:
                                - generic [ref=f5e278]: Invitation
                                - generic [ref=f5e279]: 0 entré sur 0
                        - region [ref=f5e281]:
                          - generic [ref=f5e283]:
                            - heading "Flux par quart d’heure" [level=2] [ref=f5e284]
                            - paragraph [ref=f5e285]: Heure de Dakar.
                          - list "Entrées par quart d’heure" [ref=f5e286]:
                            - listitem [ref=f5e287]:
                              - generic [ref=f5e288]:
                                - time [ref=f5e290]: dim. 15 nov. 2026 à 11:30
                                - generic [ref=f5e291]: 1 entrée
                            - listitem [ref=f5e294]:
                              - generic [ref=f5e295]:
                                - time [ref=f5e297]: dim. 15 nov. 2026 à 11:45
                                - generic [ref=f5e298]: 1 entrée
                            - listitem [ref=f5e301]:
                              - generic [ref=f5e302]:
                                - time [ref=f5e304]: dim. 15 nov. 2026 à 12:15
                                - generic [ref=f5e305]: 1 entrée
                            - listitem [ref=f5e308]:
                              - generic [ref=f5e309]:
                                - time [ref=f5e311]: dim. 15 nov. 2026 à 12:30
                                - generic [ref=f5e312]: 1 entrée
                            - listitem [ref=f5e315]:
                              - generic [ref=f5e316]:
                                - time [ref=f5e318]: dim. 15 nov. 2026 à 13:00
                                - generic [ref=f5e319]: 1 entrée
                            - listitem [ref=f5e322]:
                              - generic [ref=f5e323]:
                                - time [ref=f5e325]: dim. 15 nov. 2026 à 13:15
                                - generic [ref=f5e326]: 1 entrée
                            - listitem [ref=f5e329]:
                              - generic [ref=f5e330]:
                                - time [ref=f5e332]: dim. 15 nov. 2026 à 13:45
                                - generic [ref=f5e333]: 1 entrée
                            - listitem [ref=f5e336]:
                              - generic [ref=f5e337]:
                                - time [ref=f5e339]: dim. 15 nov. 2026 à 14:00
                                - generic [ref=f5e340]: 1 entrée
                        - region [ref=f5e343]:
                          - heading "Refus par motif" [level=2] [ref=f5e346]
                          - paragraph [ref=f5e347]: Aucun refus.
                      - region [ref=f5e348]:
                        - generic [ref=f5e350]:
                          - heading "Validations par la liste des invités" [level=2] [ref=f5e351]
                          - paragraph [ref=f5e352]: Entrées validées par un contrôleur avec la liste des invités, pièce d’identité vérifiée.
                        - paragraph [ref=f5e353]: Aucune entrée validée par la liste des invités.
                - region [ref=f5e354]:
                  - generic [ref=f5e356]:
                    - heading "Z de caisse" [level=2] [ref=f5e357]
                    - paragraph [ref=f5e358]: "Une fiche par caisse : fonds, attendu, déclaré hors fonds et écart, détail par source et par catégorie."
                  - paragraph [ref=f5e359]: Aucune caisse pour cet événement.
                - region [ref=f5e360]:
                  - generic [ref=f5e362]:
                    - heading "Absents" [level=2] [ref=f5e363]
                    - paragraph [ref=f5e364]: Participants dont le billet valide n’a pas été scanné à l’entrée.
                  - table [ref=f5e367]:
                    - caption [ref=f5e368]: Participants absents
                    - rowgroup [ref=f5e369]:
                      - row [ref=f5e370]:
                        - columnheader "Participant" [ref=f5e371]
                        - columnheader "Catégorie" [ref=f5e372]
                    - rowgroup [ref=f5e373]:
                      - row [ref=f5e374]:
                        - cell "Adama Diouf" [ref=f5e375]
                        - cell "Brunch" [ref=f5e376]
                      - row [ref=f5e377]:
                        - cell "Adama Diouf" [ref=f5e378]
                        - cell "Brunch" [ref=f5e379]
                - region [ref=f5e380]:
                  - generic [ref=f5e382]:
                    - heading "Export des participants" [level=2] [ref=f5e383]
                    - paragraph [ref=f5e384]: "Fichier CSV : nom, catégorie, origine, statut du billet, heure d’entrée, zone et porte. Aucune donnée de paiement ni numéro de billet."
                  - generic [ref=f5e385]:
                    - generic [ref=f5e386] [cursor=pointer]:
                      - checkbox "Inclure le téléphone et l’email des participants Seulement pour l’une des finalités ci-dessous. L’export et sa finalité sont journalisés." [ref=f5e387]
                      - generic [ref=f5e388]:
                        - text: Inclure le téléphone et l’email des participants
                        - generic [ref=f5e389]: Seulement pour l’une des finalités ci-dessous. L’export et sa finalité sont journalisés.
                    - generic [ref=f5e390]:
                      - button "Exporter les participants" [ref=f5e391] [cursor=pointer]
                      - generic [ref=f5e397]: CSV compatible tableur (UTF-8)
  - alert [ref=f5e401]
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
      |                                                                                        ^ Error: contrôles responsive de org-pilotage-cloture (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```