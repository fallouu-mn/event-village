# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · organisateur >> org-tables-planning-demande — Planning du jour avec une demande à accepter
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de org-tables-planning-demande (clair)

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 11

- Array []
+ Array [
+   "320 px : défilement horizontal (largeur du document 1208 px, fenêtre 320 px)",
+   "360 px : défilement horizontal (largeur du document 1208 px, fenêtre 360 px)",
+   "390 px : défilement horizontal (largeur du document 1208 px, fenêtre 390 px)",
+   "768 px : défilement horizontal (largeur du document 1220 px, fenêtre 768 px)",
+   "768 px : textes qui se chevauchent : label.flex.items-center « Autre jour » sur span.whitespace-nowrap.text-sm « Jeu » (13×6 px)",
+   "1024 px : défilement horizontal (largeur du document 1484 px, fenêtre 1024 px)",
+   "1024 px : textes qui se chevauchent : label.flex.items-center « Autre jour » sur span.whitespace-nowrap.text-sm « Jeu » (22×6 px)",
+   "1440 px : défilement horizontal (largeur du document 1516 px, fenêtre 1440 px)",
+   "1440 px : textes qui se chevauchent : label.flex.items-center « Autre jour » sur span.whitespace-nowrap.text-sm « Mar » (25×6 px)",
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
            - link "Salles de fête" [ref=f5e24] [cursor=pointer]:
              - /url: /partner/halls
            - link "Tables" [ref=f5e30] [cursor=pointer]:
              - /url: /partner/tables
            - link "Équipe" [ref=f5e35] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=f5e42]:
          - paragraph [ref=f5e43]: Outils
          - generic [ref=f5e44]:
            - link "Finances" [ref=f5e45] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=f5e49] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=f5e53] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=f5e61] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=f5e65] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=f5e70] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=f5e76] [cursor=pointer]:
          - /url: /
      - generic [ref=f5e82]:
        - link "Mariama Ndiaye Partenaire" [ref=f5e83] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f5e84]: MN
          - generic [ref=f5e85]:
            - generic [ref=f5e86]: Mariama Ndiaye
            - generic [ref=f5e87]: Partenaire
        - generic [ref=f5e88]:
          - button "Se déconnecter" [ref=f5e89] [cursor=pointer]
          - button "Basculer le thème" [ref=f5e94] [cursor=pointer]
    - generic [ref=f5e98]:
      - banner [ref=f5e99]:
        - link "Rechercher un événement…" [ref=f5e101] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 37 non lues" [ref=f5e108] [cursor=pointer]:
          - generic [ref=f5e112]: "37"
      - main [ref=f5e113]:
        - generic [ref=f5e115]:
          - generic [ref=f5e116]:
            - link "Mes établissements" [ref=f5e118] [cursor=pointer]:
              - /url: /partner/tables
            - generic [ref=f5e123]:
              - generic [ref=f5e124]:
                - generic [ref=f5e125]: Validé
                - heading "Le Petit Jardin" [level=1] [ref=f5e128]
                - paragraph [ref=f5e129]: Restaurant · Dakar
              - generic [ref=f5e130]:
                - link "Modifier" [ref=f5e131] [cursor=pointer]:
                  - /url: /partner/tables/edition/c532b3fd-fa09-456c-865b-1024e4ff2d36
                - link "Plan de salle" [ref=f5e137] [cursor=pointer]:
                  - /url: /partner/tables/edition/c532b3fd-fa09-456c-865b-1024e4ff2d36/plan
                - link "Fermetures" [ref=f5e145] [cursor=pointer]:
                  - /url: /partner/tables/edition/c532b3fd-fa09-456c-865b-1024e4ff2d36/fermetures
                - link "Recettes" [ref=f5e152] [cursor=pointer]:
                  - /url: /partner/tables/recettes
          - generic [ref=f5e158]:
            - generic [ref=f5e159]:
              - generic [ref=f5e160]:
                - heading "Aujourd’hui" [level=2] [ref=f5e161]
                - status [ref=f5e162]: Mis à jour à 4 h 38
              - button "Actualiser le planning" [ref=f5e164] [cursor=pointer]
            - generic [ref=f5e171]:
              - list "Choisir le jour du planning" [ref=f5e172]:
                - listitem [ref=f5e173]:
                  - button "Hier 20 nov" [ref=f5e174] [cursor=pointer]:
                    - generic [ref=f5e175]: Hier
                    - generic [ref=f5e176]: "20"
                    - generic [ref=f5e177]: nov
                - listitem [ref=f5e178]:
                  - button "Aujourd’hui 21 nov" [pressed] [ref=f5e179] [cursor=pointer]:
                    - generic [ref=f5e180]: Aujourd’hui
                    - generic [ref=f5e181]: "21"
                    - generic [ref=f5e182]: nov
                - listitem [ref=f5e183]:
                  - button "Demain 22 nov" [ref=f5e184] [cursor=pointer]:
                    - generic [ref=f5e185]: Demain
                    - generic [ref=f5e186]: "22"
                    - generic [ref=f5e187]: nov
                - listitem [ref=f5e188]:
                  - button "Lun 23 nov" [ref=f5e189] [cursor=pointer]:
                    - generic [ref=f5e190]: Lun
                    - generic [ref=f5e191]: "23"
                    - generic [ref=f5e192]: nov
                - listitem [ref=f5e193]:
                  - button "Mar 24 nov" [ref=f5e194] [cursor=pointer]:
                    - generic [ref=f5e195]: Mar
                    - generic [ref=f5e196]: "24"
                    - generic [ref=f5e197]: nov
                - listitem [ref=f5e198]:
                  - button "Mer 25 nov" [ref=f5e199] [cursor=pointer]:
                    - generic [ref=f5e200]: Mer
                    - generic [ref=f5e201]: "25"
                    - generic [ref=f5e202]: nov
                - listitem [ref=f5e203]:
                  - button "Jeu 26 nov" [ref=f5e204] [cursor=pointer]:
                    - generic [ref=f5e205]: Jeu
                    - generic [ref=f5e206]: "26"
                    - generic [ref=f5e207]: nov
                - listitem [ref=f5e208]:
                  - button "Ven 27 nov" [ref=f5e209] [cursor=pointer]:
                    - generic [ref=f5e210]: Ven
                    - generic [ref=f5e211]: "27"
                    - generic [ref=f5e212]: nov
                - listitem [ref=f5e213]:
                  - button "Sam 28 nov" [ref=f5e214] [cursor=pointer]:
                    - generic [ref=f5e215]: Sam
                    - generic [ref=f5e216]: "28"
                    - generic [ref=f5e217]: nov
                - listitem [ref=f5e218]:
                  - button "Dim 29 nov" [ref=f5e219] [cursor=pointer]:
                    - generic [ref=f5e220]: Dim
                    - generic [ref=f5e221]: "29"
                    - generic [ref=f5e222]: nov
                - listitem [ref=f5e223]:
                  - button "Lun 30 nov" [ref=f5e224] [cursor=pointer]:
                    - generic [ref=f5e225]: Lun
                    - generic [ref=f5e226]: "30"
                    - generic [ref=f5e227]: nov
                - listitem [ref=f5e228]:
                  - button "Mar 1 déc" [ref=f5e229] [cursor=pointer]:
                    - generic [ref=f5e230]: Mar
                    - generic [ref=f5e231]: "1"
                    - generic [ref=f5e232]: déc
                - listitem [ref=f5e233]:
                  - button "Mer 2 déc" [ref=f5e234] [cursor=pointer]:
                    - generic [ref=f5e235]: Mer
                    - generic [ref=f5e236]: "2"
                    - generic [ref=f5e237]: déc
                - listitem [ref=f5e238]:
                  - button "Jeu 3 déc" [ref=f5e239] [cursor=pointer]:
                    - generic [ref=f5e240]: Jeu
                    - generic [ref=f5e241]: "3"
                    - generic [ref=f5e242]: déc
                - listitem [ref=f5e243]:
                  - button "Ven 4 déc" [ref=f5e244] [cursor=pointer]:
                    - generic [ref=f5e245]: Ven
                    - generic [ref=f5e246]: "4"
                    - generic [ref=f5e247]: déc
              - generic [ref=f5e248]:
                - generic [ref=f5e249]: Autre jour
                - textbox "Autre jour" [ref=f5e252]: 2026-11-21
          - status [ref=f5e253]
          - generic [ref=f5e254]:
            - generic [ref=f5e255]:
              - region [ref=f5e256]:
                - heading "Une demande à accepter" [level=2] [ref=f5e257]
                - paragraph [ref=f5e264]: Sans réponse avant l’heure indiquée, la demande est annulée et le client remboursé.
                - list [ref=f5e265]:
                  - listitem [ref=f5e266]:
                    - generic [ref=f5e267]:
                      - heading "Lundi 23 novembre 19 h 30 · 2 personnes" [level=3] [ref=f5e268]:
                        - generic [ref=f5e269]: Lundi 23 novembre
                        - text: 19 h 30 · 2 personnes
                      - paragraph [ref=f5e270]:
                        - generic [ref=f5e274]:
                          - text: Répondez avant 8 h 29 ·
                          - generic [ref=f5e275]: ","
                          - text: reste 3 h 51
                    - generic [ref=f5e276]:
                      - generic [ref=f5e277]:
                        - term [ref=f5e278]: "Client :"
                        - definition [ref=f5e279]: Fatou M.
                      - generic [ref=f5e280]:
                        - term [ref=f5e281]: "Place :"
                        - definition [ref=f5e282]: Table J1
                    - paragraph [ref=f5e283]:
                      - generic [ref=f5e287]: "Anniversaire de mariage : une table au calme si possible."
                    - generic [ref=f5e288]:
                      - button "Accepter" [ref=f5e289] [cursor=pointer]
                      - button "Refuser" [ref=f5e294] [cursor=pointer]
                      - link "Appeler +221700000105" [ref=f5e300] [cursor=pointer]:
                        - /url: tel:+221700000105
                      - link "Détail de la demande de Fatou M., 19 h 30" [ref=f5e304] [cursor=pointer]:
                        - /url: /partner/tables/reservations/860d3586-0b25-46bf-bd8f-1dc4f1ee9a6a
                        - text: Détail
                        - generic [ref=f5e305]: de la demande de Fatou M., 19 h 30
              - region [ref=f5e308]:
                - generic [ref=f5e309]:
                  - heading "Réservations du jour" [level=2] [ref=f5e310]
                  - paragraph [ref=f5e311]: 1 réservation · 4 personnes
                - list "Réservations du jour, par heure" [ref=f5e313]:
                  - listitem [aria-hidden] [ref=f5e314]:
                    - generic [ref=f5e316]: Maintenant · 4 h 38
                  - listitem [ref=f5e318]:
                    - heading "8 h 1 réservation" [level=3] [ref=f5e319]:
                      - generic [ref=f5e320]: 8 h
                      - generic [ref=f5e322]: 1 réservation
                    - list [ref=f5e323]:
                      - listitem [ref=f5e324]:
                        - generic [ref=f5e325]:
                          - generic [ref=f5e326]:
                            - generic [ref=f5e327]: 8 h 30
                            - generic [ref=f5e328]: à 10 h 30
                          - generic [ref=f5e329]:
                            - generic [ref=f5e330]:
                              - heading "4 personnes , Fatou M." [level=3] [ref=f5e331]:
                                - generic [ref=f5e332]: 4 personnes
                                - text: ·
                                - generic [ref=f5e339]: ","
                                - text: Fatou M.
                              - generic [ref=f5e340]: Confirmée
                            - paragraph [ref=f5e342]: Table J3
                            - generic [ref=f5e343]: Table gardée jusqu’à 9 h
                            - paragraph [ref=f5e350]:
                              - generic [ref=f5e354]: "Déjeuner en famille : une chaise haute pour un enfant, merci."
                        - generic [ref=f5e355]:
                          - link "+221700000105" [ref=f5e356] [cursor=pointer]:
                            - /url: tel:+221700000105
                          - button "Paiement sur place" [ref=f5e360] [cursor=pointer]
                          - button "Annuler" [ref=f5e366] [cursor=pointer]
                          - link "Détail de la réservation de Fatou M. à 8 h 30" [ref=f5e373] [cursor=pointer]:
                            - /url: /partner/tables/reservations/bbbb0bc2-fe8b-40dd-8103-726ed1e5368e
                            - text: Détail
                            - generic [ref=f5e374]: de la réservation de Fatou M. à 8 h 30
            - complementary "Tables et réglages de l’écran" [ref=f5e377]:
              - region [ref=f5e378]:
                - generic [ref=f5e379]:
                  - heading "Les tables maintenant" [level=2] [ref=f5e380]
                  - paragraph [ref=f5e386]: 4 libres · 0 attendue · 0 occupée
                - list [ref=f5e387]:
                  - listitem [ref=f5e388]:
                    - generic [ref=f5e389]:
                      - generic [ref=f5e390]:
                        - generic [ref=f5e391]: Table J1
                        - generic [ref=f5e392]: Libre
                      - generic [ref=f5e393]: aucune autre réservation aujourd’hui
                  - listitem [ref=f5e394]:
                    - generic [ref=f5e395]:
                      - generic [ref=f5e396]:
                        - generic [ref=f5e397]: Table J2
                        - generic [ref=f5e398]: Libre
                      - generic [ref=f5e399]: aucune autre réservation aujourd’hui
                  - listitem [ref=f5e400]:
                    - button "Table J3 Libre prochaine réservation à 8 h 30" [ref=f5e401] [cursor=pointer]:
                      - generic [ref=f5e402]:
                        - generic [ref=f5e403]: Table J3
                        - generic [ref=f5e404]: Libre
                      - generic [ref=f5e405]: prochaine réservation à 8 h 30
                  - listitem [ref=f5e406]:
                    - generic [ref=f5e407]:
                      - generic [ref=f5e408]:
                        - generic [ref=f5e409]: Table J4
                        - generic [ref=f5e410]: Libre
                      - generic [ref=f5e411]: aucune autre réservation aujourd’hui
              - region [ref=f5e412]:
                - heading "Réglages de l’écran" [level=2] [ref=f5e413]
                - generic [ref=f5e415]:
                  - generic [ref=f5e416]:
                    - generic [ref=f5e417] [cursor=pointer]: Signal des nouvelles réservations
                    - paragraph [ref=f5e418]: Un petit bip à chaque nouvelle réservation, dès que vous avez touché la page une fois. Choix gardé sur cet appareil.
                  - generic [ref=f5e419]:
                    - generic [aria-hidden] [ref=f5e420]: Activé
                    - switch "Signal des nouvelles réservations" [checked] [ref=f5e421] [cursor=pointer]
              - paragraph [ref=f5e425]: "Gardez cette page ouverte pendant le service : elle se met à jour toute seule."
  - alert [ref=f5e431]
```

# Test source

```ts
  20  | import path from 'node:path';
  21  | import type { Page } from '@playwright/test';
  22  | import { test, expect, type CaptureRole, type ThemeKey } from './support/fixtures';
  23  | import { readDemoIds, E2E_OUTPUT_DIR, type DemoIds } from './support/demo-ids';
  24  | import { fakeScanMode, installFakeCamera } from './support/fake-camera';
  25  | import {
  26  |     PHONE_MAX_WIDTH, RESPONSIVE_CAPTURE_WIDTHS, RESPONSIVE_LANDSCAPE, RESPONSIVE_PAGES, RESPONSIVE_WIDTHS, type ResponsivePage,
  27  | } from './support/responsive-pages';
  28  | import { runResponsiveChecks } from './support/responsive-checks';
  29  | import { keepHomeOutOfServicesWindow } from './support/services-switch';
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
  76  |                 test(`${p.id} — ${p.titre}`, async ({ page, context, guard, servicesLock }) => {
  77  |                     test.setTimeout(240_000);
  78  |                     const record: ResponsiveRecord = { page: p.id, titre: p.titre, groupe: p.groupe, role, theme: theme.key, url: null, sizes: [], notes: [], error: null };
  79  |                     try {
  80  |                         // Lot 10b (lot 11b : salles et tables) : verrou des services avant tout chargement (attente ajoutée au délai du test)
  81  |                         await servicesLock.enter(p.services ? 'services' : 'autres');
  82  |                         if (servicesLock.waitedMs >= 1_000) record.notes.push(`attente du verrou des services : ${Math.round(servicesLock.waitedMs / 1000)} s`);
  83  |                         if (p.services) {
  84  |                             record.notes.push('page des services : interrupteurs features.halls_enabled et features.tables_enabled ouverts le temps du test (e2e/support/services-switch.ts)');
  85  |                             await keepHomeOutOfServicesWindow(page);
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
      |                                                                                        ^ Error: contrôles responsive de org-tables-planning-demande (clair)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```