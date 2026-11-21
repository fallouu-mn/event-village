# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · organisateur >> org-tables-planning-demande — Planning du jour avec une demande à accepter
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de org-tables-planning-demande (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 7

- Array []
+ Array [
+   "360 px : défilement horizontal (largeur du document 1208 px, fenêtre 360 px)",
+   "768 px : défilement horizontal (largeur du document 1220 px, fenêtre 768 px)",
+   "768 px : textes qui se chevauchent : label.flex.items-center « Autre jour » sur span.whitespace-nowrap.text-sm « Jeu » (13×6 px)",
+   "1440 px : défilement horizontal (largeur du document 1516 px, fenêtre 1440 px)",
+   "1440 px : textes qui se chevauchent : label.flex.items-center « Autre jour » sur span.whitespace-nowrap.text-sm « Mar » (25×6 px)",
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
            - link "Salles de fête" [ref=f2e24] [cursor=pointer]:
              - /url: /partner/halls
            - link "Tables" [ref=f2e30] [cursor=pointer]:
              - /url: /partner/tables
            - link "Équipe" [ref=f2e35] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=f2e42]:
          - paragraph [ref=f2e43]: Outils
          - generic [ref=f2e44]:
            - link "Finances" [ref=f2e45] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=f2e49] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=f2e53] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=f2e61] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=f2e65] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=f2e70] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=f2e76] [cursor=pointer]:
          - /url: /
      - generic [ref=f2e82]:
        - link "Mariama Ndiaye Partenaire" [ref=f2e83] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e84]: MN
          - generic [ref=f2e85]:
            - generic [ref=f2e86]: Mariama Ndiaye
            - generic [ref=f2e87]: Partenaire
        - generic [ref=f2e88]:
          - button "Se déconnecter" [ref=f2e89] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e94] [cursor=pointer]
    - generic [ref=f2e98]:
      - banner [ref=f2e99]:
        - link "Rechercher un événement…" [ref=f2e101] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 37 non lues" [ref=f2e108] [cursor=pointer]:
          - generic [ref=f2e112]: "37"
      - main [ref=f2e113]:
        - generic [ref=f2e115]:
          - generic [ref=f2e116]:
            - link "Mes établissements" [ref=f2e118] [cursor=pointer]:
              - /url: /partner/tables
            - generic [ref=f2e123]:
              - generic [ref=f2e124]:
                - generic [ref=f2e125]: Validé
                - heading "Le Petit Jardin" [level=1] [ref=f2e128]
                - paragraph [ref=f2e129]: Restaurant · Dakar
              - generic [ref=f2e130]:
                - link "Modifier" [ref=f2e131] [cursor=pointer]:
                  - /url: /partner/tables/edition/c532b3fd-fa09-456c-865b-1024e4ff2d36
                - link "Plan de salle" [ref=f2e137] [cursor=pointer]:
                  - /url: /partner/tables/edition/c532b3fd-fa09-456c-865b-1024e4ff2d36/plan
                - link "Fermetures" [ref=f2e145] [cursor=pointer]:
                  - /url: /partner/tables/edition/c532b3fd-fa09-456c-865b-1024e4ff2d36/fermetures
                - link "Recettes" [ref=f2e152] [cursor=pointer]:
                  - /url: /partner/tables/recettes
          - generic [ref=f2e158]:
            - generic [ref=f2e159]:
              - generic [ref=f2e160]:
                - heading "Aujourd’hui" [level=2] [ref=f2e161]
                - status [ref=f2e162]: Mis à jour à 4 h 46
              - button "Actualiser le planning" [ref=f2e164] [cursor=pointer]
            - generic [ref=f2e171]:
              - list "Choisir le jour du planning" [ref=f2e172]:
                - listitem [ref=f2e173]:
                  - button "Hier 20 nov" [ref=f2e174] [cursor=pointer]:
                    - generic [ref=f2e175]: Hier
                    - generic [ref=f2e176]: "20"
                    - generic [ref=f2e177]: nov
                - listitem [ref=f2e178]:
                  - button "Aujourd’hui 21 nov" [pressed] [ref=f2e179] [cursor=pointer]:
                    - generic [ref=f2e180]: Aujourd’hui
                    - generic [ref=f2e181]: "21"
                    - generic [ref=f2e182]: nov
                - listitem [ref=f2e183]:
                  - button "Demain 22 nov" [ref=f2e184] [cursor=pointer]:
                    - generic [ref=f2e185]: Demain
                    - generic [ref=f2e186]: "22"
                    - generic [ref=f2e187]: nov
                - listitem [ref=f2e188]:
                  - button "Lun 23 nov" [ref=f2e189] [cursor=pointer]:
                    - generic [ref=f2e190]: Lun
                    - generic [ref=f2e191]: "23"
                    - generic [ref=f2e192]: nov
                - listitem [ref=f2e193]:
                  - button "Mar 24 nov" [ref=f2e194] [cursor=pointer]:
                    - generic [ref=f2e195]: Mar
                    - generic [ref=f2e196]: "24"
                    - generic [ref=f2e197]: nov
                - listitem [ref=f2e198]:
                  - button "Mer 25 nov" [ref=f2e199] [cursor=pointer]:
                    - generic [ref=f2e200]: Mer
                    - generic [ref=f2e201]: "25"
                    - generic [ref=f2e202]: nov
                - listitem [ref=f2e203]:
                  - button "Jeu 26 nov" [ref=f2e204] [cursor=pointer]:
                    - generic [ref=f2e205]: Jeu
                    - generic [ref=f2e206]: "26"
                    - generic [ref=f2e207]: nov
                - listitem [ref=f2e208]:
                  - button "Ven 27 nov" [ref=f2e209] [cursor=pointer]:
                    - generic [ref=f2e210]: Ven
                    - generic [ref=f2e211]: "27"
                    - generic [ref=f2e212]: nov
                - listitem [ref=f2e213]:
                  - button "Sam 28 nov" [ref=f2e214] [cursor=pointer]:
                    - generic [ref=f2e215]: Sam
                    - generic [ref=f2e216]: "28"
                    - generic [ref=f2e217]: nov
                - listitem [ref=f2e218]:
                  - button "Dim 29 nov" [ref=f2e219] [cursor=pointer]:
                    - generic [ref=f2e220]: Dim
                    - generic [ref=f2e221]: "29"
                    - generic [ref=f2e222]: nov
                - listitem [ref=f2e223]:
                  - button "Lun 30 nov" [ref=f2e224] [cursor=pointer]:
                    - generic [ref=f2e225]: Lun
                    - generic [ref=f2e226]: "30"
                    - generic [ref=f2e227]: nov
                - listitem [ref=f2e228]:
                  - button "Mar 1 déc" [ref=f2e229] [cursor=pointer]:
                    - generic [ref=f2e230]: Mar
                    - generic [ref=f2e231]: "1"
                    - generic [ref=f2e232]: déc
                - listitem [ref=f2e233]:
                  - button "Mer 2 déc" [ref=f2e234] [cursor=pointer]:
                    - generic [ref=f2e235]: Mer
                    - generic [ref=f2e236]: "2"
                    - generic [ref=f2e237]: déc
                - listitem [ref=f2e238]:
                  - button "Jeu 3 déc" [ref=f2e239] [cursor=pointer]:
                    - generic [ref=f2e240]: Jeu
                    - generic [ref=f2e241]: "3"
                    - generic [ref=f2e242]: déc
                - listitem [ref=f2e243]:
                  - button "Ven 4 déc" [ref=f2e244] [cursor=pointer]:
                    - generic [ref=f2e245]: Ven
                    - generic [ref=f2e246]: "4"
                    - generic [ref=f2e247]: déc
              - generic [ref=f2e248]:
                - generic [ref=f2e249]: Autre jour
                - textbox "Autre jour" [ref=f2e252]: 2026-11-21
          - status [ref=f2e253]
          - generic [ref=f2e254]:
            - generic [ref=f2e255]:
              - region [ref=f2e256]:
                - heading "Une demande à accepter" [level=2] [ref=f2e257]
                - paragraph [ref=f2e264]: Sans réponse avant l’heure indiquée, la demande est annulée et le client remboursé.
                - list [ref=f2e265]:
                  - listitem [ref=f2e266]:
                    - generic [ref=f2e267]:
                      - heading "Lundi 23 novembre 19 h 30 · 2 personnes" [level=3] [ref=f2e268]:
                        - generic [ref=f2e269]: Lundi 23 novembre
                        - text: 19 h 30 · 2 personnes
                      - paragraph [ref=f2e270]:
                        - generic [ref=f2e274]:
                          - text: Répondez avant 8 h 29 ·
                          - generic [ref=f2e275]: ","
                          - text: reste 3 h 42
                    - generic [ref=f2e276]:
                      - generic [ref=f2e277]:
                        - term [ref=f2e278]: "Client :"
                        - definition [ref=f2e279]: Fatou M.
                      - generic [ref=f2e280]:
                        - term [ref=f2e281]: "Place :"
                        - definition [ref=f2e282]: Table J1
                    - paragraph [ref=f2e283]:
                      - generic [ref=f2e287]: "Anniversaire de mariage : une table au calme si possible."
                    - generic [ref=f2e288]:
                      - button "Accepter" [ref=f2e289] [cursor=pointer]
                      - button "Refuser" [ref=f2e294] [cursor=pointer]
                      - link "Appeler +221700000105" [ref=f2e300] [cursor=pointer]:
                        - /url: tel:+221700000105
                      - link "Détail de la demande de Fatou M., 19 h 30" [ref=f2e304] [cursor=pointer]:
                        - /url: /partner/tables/reservations/860d3586-0b25-46bf-bd8f-1dc4f1ee9a6a
                        - text: Détail
                        - generic [ref=f2e305]: de la demande de Fatou M., 19 h 30
              - region [ref=f2e308]:
                - generic [ref=f2e309]:
                  - heading "Réservations du jour" [level=2] [ref=f2e310]
                  - paragraph [ref=f2e311]: 1 réservation · 4 personnes
                - list "Réservations du jour, par heure" [ref=f2e313]:
                  - listitem [aria-hidden] [ref=f2e314]:
                    - generic [ref=f2e316]: Maintenant · 4 h 46
                  - listitem [ref=f2e318]:
                    - heading "8 h 1 réservation" [level=3] [ref=f2e319]:
                      - generic [ref=f2e320]: 8 h
                      - generic [ref=f2e322]: 1 réservation
                    - list [ref=f2e323]:
                      - listitem [ref=f2e324]:
                        - generic [ref=f2e325]:
                          - generic [ref=f2e326]:
                            - generic [ref=f2e327]: 8 h 30
                            - generic [ref=f2e328]: à 10 h 30
                          - generic [ref=f2e329]:
                            - generic [ref=f2e330]:
                              - heading "4 personnes , Fatou M." [level=3] [ref=f2e331]:
                                - generic [ref=f2e332]: 4 personnes
                                - text: ·
                                - generic [ref=f2e339]: ","
                                - text: Fatou M.
                              - generic [ref=f2e340]: Confirmée
                            - paragraph [ref=f2e342]: Table J3
                            - generic [ref=f2e343]: Table gardée jusqu’à 9 h
                            - paragraph [ref=f2e350]:
                              - generic [ref=f2e354]: "Déjeuner en famille : une chaise haute pour un enfant, merci."
                        - generic [ref=f2e355]:
                          - link "+221700000105" [ref=f2e356] [cursor=pointer]:
                            - /url: tel:+221700000105
                          - button "Paiement sur place" [ref=f2e360] [cursor=pointer]
                          - button "Annuler" [ref=f2e366] [cursor=pointer]
                          - link "Détail de la réservation de Fatou M. à 8 h 30" [ref=f2e373] [cursor=pointer]:
                            - /url: /partner/tables/reservations/bbbb0bc2-fe8b-40dd-8103-726ed1e5368e
                            - text: Détail
                            - generic [ref=f2e374]: de la réservation de Fatou M. à 8 h 30
            - complementary "Tables et réglages de l’écran" [ref=f2e377]:
              - region [ref=f2e378]:
                - generic [ref=f2e379]:
                  - heading "Les tables maintenant" [level=2] [ref=f2e380]
                  - paragraph [ref=f2e386]: 4 libres · 0 attendue · 0 occupée
                - list [ref=f2e387]:
                  - listitem [ref=f2e388]:
                    - generic [ref=f2e389]:
                      - generic [ref=f2e390]:
                        - generic [ref=f2e391]: Table J1
                        - generic [ref=f2e392]: Libre
                      - generic [ref=f2e393]: aucune autre réservation aujourd’hui
                  - listitem [ref=f2e394]:
                    - generic [ref=f2e395]:
                      - generic [ref=f2e396]:
                        - generic [ref=f2e397]: Table J2
                        - generic [ref=f2e398]: Libre
                      - generic [ref=f2e399]: aucune autre réservation aujourd’hui
                  - listitem [ref=f2e400]:
                    - button "Table J3 Libre prochaine réservation à 8 h 30" [ref=f2e401] [cursor=pointer]:
                      - generic [ref=f2e402]:
                        - generic [ref=f2e403]: Table J3
                        - generic [ref=f2e404]: Libre
                      - generic [ref=f2e405]: prochaine réservation à 8 h 30
                  - listitem [ref=f2e406]:
                    - generic [ref=f2e407]:
                      - generic [ref=f2e408]:
                        - generic [ref=f2e409]: Table J4
                        - generic [ref=f2e410]: Libre
                      - generic [ref=f2e411]: aucune autre réservation aujourd’hui
              - region [ref=f2e412]:
                - heading "Réglages de l’écran" [level=2] [ref=f2e413]
                - generic [ref=f2e415]:
                  - generic [ref=f2e416]:
                    - generic [ref=f2e417] [cursor=pointer]: Signal des nouvelles réservations
                    - paragraph [ref=f2e418]: Un petit bip à chaque nouvelle réservation, dès que vous avez touché la page une fois. Choix gardé sur cet appareil.
                  - generic [ref=f2e419]:
                    - generic [aria-hidden] [ref=f2e420]: Activé
                    - switch "Signal des nouvelles réservations" [checked] [ref=f2e421] [cursor=pointer]
              - paragraph [ref=f2e425]: "Gardez cette page ouverte pendant le service : elle se met à jour toute seule."
  - alert [ref=f2e431]
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
      |                                                                                        ^ Error: contrôles responsive de org-tables-planning-demande (sombre)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```