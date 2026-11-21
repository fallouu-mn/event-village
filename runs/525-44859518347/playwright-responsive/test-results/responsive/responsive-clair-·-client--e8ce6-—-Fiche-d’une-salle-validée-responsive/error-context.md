# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · client >> salles-fiche — Fiche d’une salle validée
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de salles-fiche (clair)

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
        - link "Toutes les salles" [ref=f5e41] [cursor=pointer]:
          - /url: /halls
        - generic [ref=f5e46]:
          - article [ref=f5e47]:
            - region "Photos de la salle Salle des Fromagers" [ref=f5e48]:
              - generic [ref=f5e49]:
                - img "Photo 1 sur 1 de la salle Salle des Fromagers" [ref=f5e51]
                - button "Voir la photo 1 sur 1 en plein écran" [ref=f5e52]
                - button "Voir les photos en plein écran" [ref=f5e54] [cursor=pointer]
            - generic [ref=f5e61]:
              - heading "Salle des Fromagers" [level=1] [ref=f5e62]
              - paragraph [ref=f5e63]:
                - generic [ref=f5e67]: 22, avenue Léopold-Sédar-Senghor, Dakar-Plateau, Dakar
              - paragraph [ref=f5e68]: Proposée par Baobab Scène
            - list "L’essentiel" [ref=f5e69]:
              - listitem [ref=f5e70]:
                - generic [ref=f5e77]:
                  - paragraph [ref=f5e78]: Jusqu’à 350 invités
                  - paragraph [ref=f5e79]: Capacité indiquée par la salle
              - listitem [ref=f5e80]:
                - generic [ref=f5e85]:
                  - paragraph [ref=f5e86]: 450 000 F CFA par jour
                  - paragraph [ref=f5e87]: ou 60 000 F CFA par heure
            - region [ref=f5e88]:
              - heading "À propos de la salle" [level=2] [ref=f5e89]
              - paragraph [ref=f5e90]: Grande salle climatisée au cœur du Plateau, avec scène, piste de danse et terrasse ombragée. Mariages, baptêmes, galas et séminaires jusqu’à 350 invités ; cuisine équipée pour le traiteur et parking surveillé.
            - region [ref=f5e91]:
              - heading "Équipements" [level=2] [ref=f5e92]
              - list [ref=f5e93]:
                - listitem [ref=f5e94]:
                  - generic [ref=f5e97]: Climatisation
                - listitem [ref=f5e98]:
                  - generic [ref=f5e101]: Sonorisation
                - listitem [ref=f5e102]:
                  - generic [ref=f5e105]: Scène
                - listitem [ref=f5e106]:
                  - generic [ref=f5e109]: Piste de danse
                - listitem [ref=f5e110]:
                  - generic [ref=f5e113]: Cuisine équipée
                - listitem [ref=f5e114]:
                  - generic [ref=f5e117]: Parking surveillé
                - listitem [ref=f5e118]:
                  - generic [ref=f5e121]: Groupe électrogène
                - listitem [ref=f5e122]:
                  - generic [ref=f5e125]: Terrasse
            - region [ref=f5e126]:
              - heading "Adresse" [level=2] [ref=f5e127]
              - paragraph [ref=f5e128]: 22, avenue Léopold-Sédar-Senghor, Dakar-Plateau, Dakar
              - generic [ref=f5e129]:
                - img "Salle des Fromagers, 22, avenue Léopold-Sédar-Senghor, Dakar-Plateau, Dakar" [ref=f5e136]:
                  - generic [ref=f5e137]: Salle des Fromagers
                - button "Afficher la carte" [ref=f5e141] [cursor=pointer]
              - link "Voir l’itinéraire" [ref=f5e146] [cursor=pointer]:
                - /url: https://www.google.com/maps/dir/?api=1&destination=14.6712,-17.437
            - region [ref=f5e156]:
              - heading "Paiement et annulation" [level=2] [ref=f5e157]
              - generic [ref=f5e158]:
                - generic [ref=f5e159]:
                  - heading "Acompte" [level=3] [ref=f5e160]
                  - paragraph [ref=f5e161]: Acompte de 40 % du prix, plus sa part des frais de service.
                - generic [ref=f5e162]:
                  - heading "Solde" [level=3] [ref=f5e163]
                  - paragraph [ref=f5e164]: Le reste est à payer au plus tard 7 jours avant la date. Pour une date plus proche, tout se paie en une fois.
                - generic [ref=f5e165]:
                  - heading "Délai pour payer" [level=3] [ref=f5e166]
                  - paragraph [ref=f5e167]: La date est gardée 15 minutes pour payer, par Wave ou Orange Money. Sans paiement, elle est libérée.
                - generic [ref=f5e168]:
                  - heading "Frais de service" [level=3] [ref=f5e169]
                  - paragraph [ref=f5e170]: Ils s’ajoutent au prix ; leur montant exact s’affiche avant de payer.
                - generic [ref=f5e171]:
                  - heading "Conditions d’annulation" [level=3] [ref=f5e172]
                  - paragraph [ref=f5e173]: "Règle Modérée : remboursement total si vous annulez au moins 30 jours avant la date, 50 % jusqu’à 7 jours avant, rien ensuite."
            - region [ref=f5e174]:
              - heading "Disponibilités" [level=2] [ref=f5e175]
              - generic [ref=f5e177]:
                - generic [ref=f5e178]:
                  - button "Mois précédent" [disabled] [ref=f5e179]
                  - heading "Novembre 2026" [level=3] [ref=f5e183]
                  - button "Mois suivant" [ref=f5e184] [cursor=pointer]
                - generic [ref=f5e189]:
                  - generic [aria-hidden] [ref=f5e190]:
                    - generic [ref=f5e191]: lun.
                    - generic [ref=f5e192]: mar.
                    - generic [ref=f5e193]: mer.
                    - generic [ref=f5e194]: jeu.
                    - generic [ref=f5e195]: ven.
                    - generic [ref=f5e196]: sam.
                    - generic [ref=f5e197]: dim.
                  - list "Jours de Novembre 2026" [ref=f5e198]:
                    - listitem [aria-hidden] [ref=f5e199]
                    - listitem [aria-hidden] [ref=f5e200]
                    - listitem [aria-hidden] [ref=f5e201]
                    - listitem [aria-hidden] [ref=f5e202]
                    - listitem [aria-hidden] [ref=f5e203]
                    - listitem [aria-hidden] [ref=f5e204]
                    - listitem [ref=f5e205]:
                      - button "Dimanche 1 novembre 2026, passé" [disabled] [ref=f5e206]:
                        - generic [ref=f5e207]: "1"
                    - listitem [ref=f5e209]:
                      - button "Lundi 2 novembre 2026, passé" [disabled] [ref=f5e210]:
                        - generic [ref=f5e211]: "2"
                    - listitem [ref=f5e213]:
                      - button "Mardi 3 novembre 2026, passé" [disabled] [ref=f5e214]:
                        - generic [ref=f5e215]: "3"
                    - listitem [ref=f5e217]:
                      - button "Mercredi 4 novembre 2026, passé" [disabled] [ref=f5e218]:
                        - generic [ref=f5e219]: "4"
                    - listitem [ref=f5e221]:
                      - button "Jeudi 5 novembre 2026, passé" [disabled] [ref=f5e222]:
                        - generic [ref=f5e223]: "5"
                    - listitem [ref=f5e225]:
                      - button "Vendredi 6 novembre 2026, passé" [disabled] [ref=f5e226]:
                        - generic [ref=f5e227]: "6"
                    - listitem [ref=f5e229]:
                      - button "Samedi 7 novembre 2026, passé" [disabled] [ref=f5e230]:
                        - generic [ref=f5e231]: "7"
                    - listitem [ref=f5e233]:
                      - button "Dimanche 8 novembre 2026, passé" [disabled] [ref=f5e234]:
                        - generic [ref=f5e235]: "8"
                    - listitem [ref=f5e237]:
                      - button "Lundi 9 novembre 2026, passé" [disabled] [ref=f5e238]:
                        - generic [ref=f5e239]: "9"
                    - listitem [ref=f5e241]:
                      - button "Mardi 10 novembre 2026, passé" [disabled] [ref=f5e242]:
                        - generic [ref=f5e243]: "10"
                    - listitem [ref=f5e245]:
                      - button "Mercredi 11 novembre 2026, passé" [disabled] [ref=f5e246]:
                        - generic [ref=f5e247]: "11"
                    - listitem [ref=f5e249]:
                      - button "Jeudi 12 novembre 2026, passé" [disabled] [ref=f5e250]:
                        - generic [ref=f5e251]: "12"
                    - listitem [ref=f5e253]:
                      - button "Vendredi 13 novembre 2026, passé" [disabled] [ref=f5e254]:
                        - generic [ref=f5e255]: "13"
                    - listitem [ref=f5e257]:
                      - button "Samedi 14 novembre 2026, passé" [disabled] [ref=f5e258]:
                        - generic [ref=f5e259]: "14"
                    - listitem [ref=f5e261]:
                      - button "Dimanche 15 novembre 2026, passé" [disabled] [ref=f5e262]:
                        - generic [ref=f5e263]: "15"
                    - listitem [ref=f5e265]:
                      - button "Lundi 16 novembre 2026, passé" [disabled] [ref=f5e266]:
                        - generic [ref=f5e267]: "16"
                    - listitem [ref=f5e269]:
                      - button "Mardi 17 novembre 2026, passé" [disabled] [ref=f5e270]:
                        - generic [ref=f5e271]: "17"
                    - listitem [ref=f5e273]:
                      - button "Mercredi 18 novembre 2026, passé" [disabled] [ref=f5e274]:
                        - generic [ref=f5e275]: "18"
                    - listitem [ref=f5e277]:
                      - button "Jeudi 19 novembre 2026, passé" [disabled] [ref=f5e278]:
                        - generic [ref=f5e279]: "19"
                    - listitem [ref=f5e281]:
                      - button "Vendredi 20 novembre 2026, passé" [disabled] [ref=f5e282]:
                        - generic [ref=f5e283]: "20"
                    - listitem [ref=f5e285]:
                      - button "Samedi 21 novembre 2026, aujourd’hui, libre" [ref=f5e286] [cursor=pointer]:
                        - generic [ref=f5e287]: "21"
                    - listitem [ref=f5e290]:
                      - button "Dimanche 22 novembre 2026, libre" [ref=f5e291] [cursor=pointer]:
                        - generic [ref=f5e292]: "22"
                    - listitem [ref=f5e295]:
                      - button "Lundi 23 novembre 2026, libre" [ref=f5e296] [cursor=pointer]:
                        - generic [ref=f5e297]: "23"
                    - listitem [ref=f5e300]:
                      - button "Mardi 24 novembre 2026, libre" [ref=f5e301] [cursor=pointer]:
                        - generic [ref=f5e302]: "24"
                    - listitem [ref=f5e305]:
                      - button "Mercredi 25 novembre 2026, libre" [ref=f5e306] [cursor=pointer]:
                        - generic [ref=f5e307]: "25"
                    - listitem [ref=f5e310]:
                      - button "Jeudi 26 novembre 2026, libre" [ref=f5e311] [cursor=pointer]:
                        - generic [ref=f5e312]: "26"
                    - listitem [ref=f5e315]:
                      - button "Vendredi 27 novembre 2026, libre" [ref=f5e316] [cursor=pointer]:
                        - generic [ref=f5e317]: "27"
                    - listitem [ref=f5e320]:
                      - button "Samedi 28 novembre 2026, libre" [ref=f5e321] [cursor=pointer]:
                        - generic [ref=f5e322]: "28"
                    - listitem [ref=f5e325]:
                      - button "Dimanche 29 novembre 2026, libre" [ref=f5e326] [cursor=pointer]:
                        - generic [ref=f5e327]: "29"
                    - listitem [ref=f5e330]:
                      - button "Lundi 30 novembre 2026, libre" [ref=f5e331] [cursor=pointer]:
                        - generic [ref=f5e332]: "30"
                - list "Légende du calendrier" [ref=f5e335]:
                  - listitem [ref=f5e336]:
                    - generic [ref=f5e338]: "5"
                    - text: Libre
                  - listitem [ref=f5e341]:
                    - generic [ref=f5e343]: "5"
                    - text: Pris en partie (à l’heure)
                  - listitem [ref=f5e347]:
                    - generic [ref=f5e349]: "5"
                    - text: Déjà réservé
                  - listitem [ref=f5e353]:
                    - generic [ref=f5e355]: "5"
                    - text: Passé
                  - listitem [ref=f5e357]:
                    - generic [ref=f5e359]: "5"
                    - text: Votre date
                  - listitem [ref=f5e363]:
                    - generic [aria-hidden] [ref=f5e364]: "5"
                    - text: Aujourd’hui
          - complementary [ref=f5e365]:
            - generic [ref=f5e366]:
              - generic [ref=f5e367]:
                - heading "Réserver la salle" [level=2] [ref=f5e368]
                - paragraph [ref=f5e369]: 450 000 F CFA par jour ou 60 000 F CFA par heure, frais de service en plus.
              - group "Durée de la location" [ref=f5e370]:
                - button "À la journée" [pressed] [ref=f5e371] [cursor=pointer]:
                  - generic [aria-hidden] [ref=f5e372]: ✓
                  - text: À la journée
                - button "À l’heure" [ref=f5e375] [cursor=pointer]
              - generic [ref=f5e379]:
                - generic [ref=f5e380]:
                  - generic [ref=f5e381]: Date
                  - textbox "Date" [ref=f5e383]
                  - paragraph [ref=f5e384]: Ou touchez un jour libre du calendrier.
                - generic [ref=f5e385]:
                  - generic [ref=f5e386]: Nombre de jours
                  - combobox "Nombre de jours" [ref=f5e389] [cursor=pointer]:
                    - option "1 jour" [selected]
                    - option "2 jours"
                    - option "3 jours"
                    - option "4 jours"
                    - option "5 jours"
                    - option "6 jours"
                    - option "7 jours"
                    - option "8 jours"
                    - option "9 jours"
                    - option "10 jours"
                    - option "11 jours"
                    - option "12 jours"
                    - option "13 jours"
                    - option "14 jours"
                    - option "15 jours"
                    - option "16 jours"
                    - option "17 jours"
                    - option "18 jours"
                    - option "19 jours"
                    - option "20 jours"
                    - option "21 jours"
                    - option "22 jours"
                    - option "23 jours"
                    - option "24 jours"
                    - option "25 jours"
                    - option "26 jours"
                    - option "27 jours"
                    - option "28 jours"
                    - option "29 jours"
                    - option "30 jours"
              - status [ref=f5e390]
              - paragraph [ref=f5e392]: Choisissez une date pour voir le prix exact, l’acompte et les conditions.
              - generic [ref=f5e393]:
                - button "Réserver et payer l’acompte" [disabled] [ref=f5e394]
                - paragraph [ref=f5e396]: Après la réservation, la date vous est gardée 15 minutes, le temps de payer par Wave ou Orange Money.
  - alert [ref=f5e397]
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
      |                                                                                        ^ Error: contrôles responsive de salles-fiche (clair)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```