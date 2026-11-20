# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · client >> salles-fiche — Fiche d’une salle validée
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de salles-fiche (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "360 px : 30 cible(s) < 44 px : button « Dimanche 1 novembre 2026, passé » 40×48 ; button « Lundi 2 novembre 2026, passé » 40×48 ; button « Mardi 3 novembre 2026, passé » 40×48 ; button « Mercredi 4 novembre 2026, passé » 40×48 ; button « Jeudi 5 novembre 2026, passé » 40×48 ; button « Vendredi 6 novembre 2026, passé » 40×48 ; button « Samedi 7 novembre 2026, passé » 40×48 ; button « Dimanche 8 novembre 2026, passé » 40×48",
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
          - paragraph [ref=f2e11]: Menu principal
          - generic [ref=f2e12]:
            - link "Accueil" [ref=f2e13] [cursor=pointer]:
              - /url: /
            - link "Explorer" [ref=f2e18] [cursor=pointer]:
              - /url: /explore
            - link "Mes billets" [ref=f2e23] [cursor=pointer]:
              - /url: /tickets
            - link "Commandes" [ref=f2e27] [cursor=pointer]:
              - /url: /orders
            - link "Portefeuille" [ref=f2e32] [cursor=pointer]:
              - /url: /wallet
        - generic [ref=f2e37]:
          - paragraph [ref=f2e38]: Services et espaces
          - link "Salles de fête" [ref=f2e40] [cursor=pointer]:
            - /url: /halls
        - generic [ref=f2e46]:
          - paragraph [ref=f2e47]: Espaces métier
          - link "Devenir partenaire" [ref=f2e49] [cursor=pointer]:
            - /url: /partner/register
      - generic [ref=f2e55]:
        - link "Fatou Mbaye Client" [ref=f2e56] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e57]: FM
          - generic [ref=f2e58]:
            - generic [ref=f2e59]: Fatou Mbaye
            - generic [ref=f2e60]: Client
        - generic [ref=f2e61]:
          - button "Se déconnecter" [ref=f2e62] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e67] [cursor=pointer]
    - generic [ref=f2e71]:
      - banner [ref=f2e72]:
        - link "Rechercher un événement…" [ref=f2e74] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 10 non lues" [ref=f2e81] [cursor=pointer]:
          - generic [ref=f2e85]: "10"
      - main [ref=f2e86]:
        - generic [ref=f2e88]:
          - link "Toutes les salles" [ref=f2e89] [cursor=pointer]:
            - /url: /halls
          - generic [ref=f2e94]:
            - article [ref=f2e95]:
              - region "Photos de la salle Salle des Fromagers" [ref=f2e96]:
                - generic [ref=f2e97]:
                  - img "Photo 1 sur 1 de la salle Salle des Fromagers" [ref=f2e99]
                  - button "Voir la photo 1 sur 1 en plein écran" [ref=f2e100]
                  - button "Voir les photos en plein écran" [ref=f2e102] [cursor=pointer]
              - generic [ref=f2e109]:
                - heading "Salle des Fromagers" [level=1] [ref=f2e110]
                - paragraph [ref=f2e111]:
                  - generic [ref=f2e115]: 22, avenue Léopold-Sédar-Senghor, Dakar-Plateau, Dakar
                - paragraph [ref=f2e116]: Proposée par Baobab Scène
              - list "L’essentiel" [ref=f2e117]:
                - listitem [ref=f2e118]:
                  - generic [ref=f2e125]:
                    - paragraph [ref=f2e126]: Jusqu’à 350 invités
                    - paragraph [ref=f2e127]: Capacité indiquée par la salle
                - listitem [ref=f2e128]:
                  - generic [ref=f2e133]:
                    - paragraph [ref=f2e134]: 450 000 F CFA par jour
                    - paragraph [ref=f2e135]: ou 60 000 F CFA par heure
              - region [ref=f2e136]:
                - heading "À propos de la salle" [level=2] [ref=f2e137]
                - paragraph [ref=f2e138]: Grande salle climatisée au cœur du Plateau, avec scène, piste de danse et terrasse ombragée. Mariages, baptêmes, galas et séminaires jusqu’à 350 invités ; cuisine équipée pour le traiteur et parking surveillé.
              - region [ref=f2e139]:
                - heading "Équipements" [level=2] [ref=f2e140]
                - list [ref=f2e141]:
                  - listitem [ref=f2e142]:
                    - generic [ref=f2e145]: Climatisation
                  - listitem [ref=f2e146]:
                    - generic [ref=f2e149]: Sonorisation
                  - listitem [ref=f2e150]:
                    - generic [ref=f2e153]: Scène
                  - listitem [ref=f2e154]:
                    - generic [ref=f2e157]: Piste de danse
                  - listitem [ref=f2e158]:
                    - generic [ref=f2e161]: Cuisine équipée
                  - listitem [ref=f2e162]:
                    - generic [ref=f2e165]: Parking surveillé
                  - listitem [ref=f2e166]:
                    - generic [ref=f2e169]: Groupe électrogène
                  - listitem [ref=f2e170]:
                    - generic [ref=f2e173]: Terrasse
              - region [ref=f2e174]:
                - heading "Adresse" [level=2] [ref=f2e175]
                - paragraph [ref=f2e176]: 22, avenue Léopold-Sédar-Senghor, Dakar-Plateau, Dakar
                - generic [ref=f2e177]:
                  - img "Salle des Fromagers, 22, avenue Léopold-Sédar-Senghor, Dakar-Plateau, Dakar" [ref=f2e184]:
                    - generic [ref=f2e185]: Salle des Fromagers
                  - button "Afficher la carte" [ref=f2e189] [cursor=pointer]
                - link "Voir l’itinéraire" [ref=f2e194] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=14.6712,-17.437
              - region [ref=f2e204]:
                - heading "Paiement et annulation" [level=2] [ref=f2e205]
                - generic [ref=f2e206]:
                  - generic [ref=f2e207]:
                    - heading "Acompte" [level=3] [ref=f2e208]
                    - paragraph [ref=f2e209]: Acompte de 40 % du prix, plus sa part des frais de service.
                  - generic [ref=f2e210]:
                    - heading "Solde" [level=3] [ref=f2e211]
                    - paragraph [ref=f2e212]: Le reste est à payer au plus tard 7 jours avant la date. Pour une date plus proche, tout se paie en une fois.
                  - generic [ref=f2e213]:
                    - heading "Délai pour payer" [level=3] [ref=f2e214]
                    - paragraph [ref=f2e215]: La date est gardée 15 minutes pour payer, par Wave ou Orange Money. Sans paiement, elle est libérée.
                  - generic [ref=f2e216]:
                    - heading "Frais de service" [level=3] [ref=f2e217]
                    - paragraph [ref=f2e218]: Ils s’ajoutent au prix ; leur montant exact s’affiche avant de payer.
                  - generic [ref=f2e219]:
                    - heading "Conditions d’annulation" [level=3] [ref=f2e220]
                    - paragraph [ref=f2e221]: "Règle Modérée : remboursement total si vous annulez au moins 30 jours avant la date, 50 % jusqu’à 7 jours avant, rien ensuite."
              - region [ref=f2e222]:
                - heading "Disponibilités" [level=2] [ref=f2e223]
                - generic [ref=f2e225]:
                  - generic [ref=f2e226]:
                    - button "Mois précédent" [disabled] [ref=f2e227]
                    - heading "Novembre 2026" [level=3] [ref=f2e231]
                    - button "Mois suivant" [ref=f2e232] [cursor=pointer]
                  - generic [ref=f2e236]:
                    - generic [aria-hidden] [ref=f2e237]:
                      - generic [ref=f2e238]: lun.
                      - generic [ref=f2e239]: mar.
                      - generic [ref=f2e240]: mer.
                      - generic [ref=f2e241]: jeu.
                      - generic [ref=f2e242]: ven.
                      - generic [ref=f2e243]: sam.
                      - generic [ref=f2e244]: dim.
                    - list "Jours de Novembre 2026" [ref=f2e245]:
                      - listitem [aria-hidden] [ref=f2e246]
                      - listitem [aria-hidden] [ref=f2e247]
                      - listitem [aria-hidden] [ref=f2e248]
                      - listitem [aria-hidden] [ref=f2e249]
                      - listitem [aria-hidden] [ref=f2e250]
                      - listitem [aria-hidden] [ref=f2e251]
                      - listitem [ref=f2e252]:
                        - button "Dimanche 1 novembre 2026, passé" [disabled] [ref=f2e253]:
                          - generic [ref=f2e254]: "1"
                      - listitem [ref=f2e256]:
                        - button "Lundi 2 novembre 2026, passé" [disabled] [ref=f2e257]:
                          - generic [ref=f2e258]: "2"
                      - listitem [ref=f2e260]:
                        - button "Mardi 3 novembre 2026, passé" [disabled] [ref=f2e261]:
                          - generic [ref=f2e262]: "3"
                      - listitem [ref=f2e264]:
                        - button "Mercredi 4 novembre 2026, passé" [disabled] [ref=f2e265]:
                          - generic [ref=f2e266]: "4"
                      - listitem [ref=f2e268]:
                        - button "Jeudi 5 novembre 2026, passé" [disabled] [ref=f2e269]:
                          - generic [ref=f2e270]: "5"
                      - listitem [ref=f2e272]:
                        - button "Vendredi 6 novembre 2026, passé" [disabled] [ref=f2e273]:
                          - generic [ref=f2e274]: "6"
                      - listitem [ref=f2e276]:
                        - button "Samedi 7 novembre 2026, passé" [disabled] [ref=f2e277]:
                          - generic [ref=f2e278]: "7"
                      - listitem [ref=f2e280]:
                        - button "Dimanche 8 novembre 2026, passé" [disabled] [ref=f2e281]:
                          - generic [ref=f2e282]: "8"
                      - listitem [ref=f2e284]:
                        - button "Lundi 9 novembre 2026, passé" [disabled] [ref=f2e285]:
                          - generic [ref=f2e286]: "9"
                      - listitem [ref=f2e288]:
                        - button "Mardi 10 novembre 2026, passé" [disabled] [ref=f2e289]:
                          - generic [ref=f2e290]: "10"
                      - listitem [ref=f2e292]:
                        - button "Mercredi 11 novembre 2026, passé" [disabled] [ref=f2e293]:
                          - generic [ref=f2e294]: "11"
                      - listitem [ref=f2e296]:
                        - button "Jeudi 12 novembre 2026, passé" [disabled] [ref=f2e297]:
                          - generic [ref=f2e298]: "12"
                      - listitem [ref=f2e300]:
                        - button "Vendredi 13 novembre 2026, passé" [disabled] [ref=f2e301]:
                          - generic [ref=f2e302]: "13"
                      - listitem [ref=f2e304]:
                        - button "Samedi 14 novembre 2026, passé" [disabled] [ref=f2e305]:
                          - generic [ref=f2e306]: "14"
                      - listitem [ref=f2e308]:
                        - button "Dimanche 15 novembre 2026, passé" [disabled] [ref=f2e309]:
                          - generic [ref=f2e310]: "15"
                      - listitem [ref=f2e312]:
                        - button "Lundi 16 novembre 2026, passé" [disabled] [ref=f2e313]:
                          - generic [ref=f2e314]: "16"
                      - listitem [ref=f2e316]:
                        - button "Mardi 17 novembre 2026, passé" [disabled] [ref=f2e317]:
                          - generic [ref=f2e318]: "17"
                      - listitem [ref=f2e320]:
                        - button "Mercredi 18 novembre 2026, passé" [disabled] [ref=f2e321]:
                          - generic [ref=f2e322]: "18"
                      - listitem [ref=f2e324]:
                        - button "Jeudi 19 novembre 2026, passé" [disabled] [ref=f2e325]:
                          - generic [ref=f2e326]: "19"
                      - listitem [ref=f2e328]:
                        - button "Vendredi 20 novembre 2026, aujourd’hui, libre" [ref=f2e329] [cursor=pointer]:
                          - generic [ref=f2e330]: "20"
                      - listitem [ref=f2e333]:
                        - button "Samedi 21 novembre 2026, libre" [ref=f2e334] [cursor=pointer]:
                          - generic [ref=f2e335]: "21"
                      - listitem [ref=f2e338]:
                        - button "Dimanche 22 novembre 2026, libre" [ref=f2e339] [cursor=pointer]:
                          - generic [ref=f2e340]: "22"
                      - listitem [ref=f2e343]:
                        - button "Lundi 23 novembre 2026, libre" [ref=f2e344] [cursor=pointer]:
                          - generic [ref=f2e345]: "23"
                      - listitem [ref=f2e348]:
                        - button "Mardi 24 novembre 2026, libre" [ref=f2e349] [cursor=pointer]:
                          - generic [ref=f2e350]: "24"
                      - listitem [ref=f2e353]:
                        - button "Mercredi 25 novembre 2026, libre" [ref=f2e354] [cursor=pointer]:
                          - generic [ref=f2e355]: "25"
                      - listitem [ref=f2e358]:
                        - button "Jeudi 26 novembre 2026, libre" [ref=f2e359] [cursor=pointer]:
                          - generic [ref=f2e360]: "26"
                      - listitem [ref=f2e363]:
                        - button "Vendredi 27 novembre 2026, libre" [ref=f2e364] [cursor=pointer]:
                          - generic [ref=f2e365]: "27"
                      - listitem [ref=f2e368]:
                        - button "Samedi 28 novembre 2026, libre" [ref=f2e369] [cursor=pointer]:
                          - generic [ref=f2e370]: "28"
                      - listitem [ref=f2e373]:
                        - button "Dimanche 29 novembre 2026, libre" [ref=f2e374] [cursor=pointer]:
                          - generic [ref=f2e375]: "29"
                      - listitem [ref=f2e378]:
                        - button "Lundi 30 novembre 2026, libre" [ref=f2e379] [cursor=pointer]:
                          - generic [ref=f2e380]: "30"
                  - list "Légende du calendrier" [ref=f2e383]:
                    - listitem [ref=f2e384]:
                      - generic [ref=f2e386]: "5"
                      - text: Libre
                    - listitem [ref=f2e389]:
                      - generic [ref=f2e391]: "5"
                      - text: Pris en partie (à l’heure)
                    - listitem [ref=f2e395]:
                      - generic [ref=f2e397]: "5"
                      - text: Déjà réservé
                    - listitem [ref=f2e401]:
                      - generic [ref=f2e403]: "5"
                      - text: Passé
                    - listitem [ref=f2e405]:
                      - generic [ref=f2e407]: "5"
                      - text: Votre date
                    - listitem [ref=f2e411]:
                      - generic [aria-hidden] [ref=f2e412]: "5"
                      - text: Aujourd’hui
            - complementary [ref=f2e413]:
              - generic [ref=f2e414]:
                - generic [ref=f2e415]:
                  - heading "Réserver la salle" [level=2] [ref=f2e416]
                  - paragraph [ref=f2e417]: 450 000 F CFA par jour ou 60 000 F CFA par heure, frais de service en plus.
                - group "Durée de la location" [ref=f2e418]:
                  - button "À la journée" [pressed] [ref=f2e419] [cursor=pointer]:
                    - generic [aria-hidden] [ref=f2e420]: ✓
                    - text: À la journée
                  - button "À l’heure" [ref=f2e423] [cursor=pointer]
                - generic [ref=f2e427]:
                  - generic [ref=f2e428]:
                    - generic [ref=f2e429]: Date
                    - textbox "Date" [ref=f2e431]
                    - paragraph [ref=f2e432]: Ou touchez un jour libre du calendrier.
                  - generic [ref=f2e433]:
                    - generic [ref=f2e434]: Nombre de jours
                    - combobox "Nombre de jours" [ref=f2e437] [cursor=pointer]:
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
                - status [ref=f2e438]
                - paragraph [ref=f2e440]: Choisissez une date pour voir le prix exact, l’acompte et les conditions.
                - generic [ref=f2e441]:
                  - button "Réserver et payer l’acompte" [disabled] [ref=f2e442]
                  - paragraph [ref=f2e444]: Après la réservation, la date vous est gardée 15 minutes, le temps de payer par Wave ou Orange Money.
  - alert [ref=f2e445]
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
      |                                                                                        ^ Error: contrôles responsive de salles-fiche (sombre)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```