# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · organisateur >> org-calendrier — Calendrier
- Location: e2e/responsive.spec.ts:78:21

# Error details

```
Error: contrôles responsive de org-calendrier (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "erreur d'hydratation sur org-calendrier à 768 px : exception sur /partner/calendar : Error: Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f5e1]:
  - generic [ref=f5e2]:
    - complementary [ref=f5e4]:
      - generic [ref=f5e5]:
        - link "Event Village, accueil" [ref=f5e7] [cursor=pointer]:
          - /url: /
          - generic [ref=f5e8]: Event Village
        - button "Replier la barre latérale" [expanded] [ref=f5e11] [cursor=pointer]
      - navigation "Navigation principale" [ref=f5e16]:
        - generic [ref=f5e17]:
          - paragraph [ref=f5e18]: Gestion
          - generic [ref=f5e19]:
            - link "Tableau de bord" [ref=f5e20] [cursor=pointer]:
              - /url: /partner/dashboard
            - link "Événements" [ref=f5e27] [cursor=pointer]:
              - /url: /partner/events
            - link "Équipe" [ref=f5e31] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=f5e38]:
          - paragraph [ref=f5e39]: Outils
          - generic [ref=f5e40]:
            - link "Finances" [ref=f5e41] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=f5e45] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=f5e49] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=f5e57] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=f5e61] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=f5e66] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=f5e72] [cursor=pointer]:
          - /url: /
      - generic [ref=f5e78]:
        - link "Mariama Ndiaye Partenaire" [ref=f5e79] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f5e81]: MN
          - generic [ref=f5e82]:
            - generic [ref=f5e83]: Mariama Ndiaye
            - generic [ref=f5e84]: Partenaire
        - generic [ref=f5e85]:
          - button "Se déconnecter" [ref=f5e86] [cursor=pointer]
          - button "Basculer le thème" [ref=f5e91] [cursor=pointer]
    - generic [ref=f5e95]:
      - banner [ref=f5e96]:
        - link "Rechercher un événement…" [ref=f5e98] [cursor=pointer]:
          - /url: /explore
        - generic [ref=f5e103]:
          - button "Notifications, 37 non lues" [ref=f5e105] [cursor=pointer]:
            - generic [ref=f5e109]: "37"
          - button "Mariama Ndiaye" [ref=f5e111] [cursor=pointer]:
            - generic [aria-hidden] [ref=f5e112]: MN
      - main [ref=f5e114]:
        - generic [ref=f5e116]:
          - generic [ref=f5e118]:
            - generic [ref=f5e119]:
              - heading "Calendrier" [level=1] [ref=f5e120]
              - paragraph [ref=f5e121]: Vos événements, placés à leur date de début.
            - link "Nouvel événement" [ref=f5e123] [cursor=pointer]:
              - /url: /partner/events/new
          - generic [ref=f5e127]:
            - region [ref=f5e128]:
              - generic [ref=f5e129]:
                - generic [ref=f5e130]:
                  - heading "novembre 2026" [level=2] [ref=f5e131]
                  - paragraph [ref=f5e132]: 7 événements ce mois-ci
                - generic [ref=f5e133]:
                  - button "Mois précédent" [ref=f5e134] [cursor=pointer]
                  - button "Mois suivant" [ref=f5e138] [cursor=pointer]
              - generic [ref=f5e142]:
                - generic [aria-hidden] [ref=f5e143]:
                  - generic [ref=f5e144]: Lun
                  - generic [ref=f5e145]: Mar
                  - generic [ref=f5e146]: Mer
                  - generic [ref=f5e147]: Jeu
                  - generic [ref=f5e148]: Ven
                  - generic [ref=f5e149]: Sam
                  - generic [ref=f5e150]: Dim
                - list "Jours de novembre 2026" [ref=f5e151]:
                  - listitem [aria-hidden] [ref=f5e152]
                  - listitem [aria-hidden] [ref=f5e153]
                  - listitem [aria-hidden] [ref=f5e154]
                  - listitem [aria-hidden] [ref=f5e155]
                  - listitem [aria-hidden] [ref=f5e156]
                  - listitem [aria-hidden] [ref=f5e157]
                  - listitem [ref=f5e158]:
                    - button "dimanche 1 novembre 2026, aucun événement" [ref=f5e159] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e160]: "1"
                  - listitem [ref=f5e161]:
                    - button "lundi 2 novembre 2026, aucun événement" [ref=f5e162] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e163]: "2"
                  - listitem [ref=f5e164]:
                    - button "mardi 3 novembre 2026, aucun événement" [ref=f5e165] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e166]: "3"
                  - listitem [ref=f5e167]:
                    - button "mercredi 4 novembre 2026, aucun événement" [ref=f5e168] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e169]: "4"
                  - listitem [ref=f5e170]:
                    - button "jeudi 5 novembre 2026, aucun événement" [ref=f5e171] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e172]: "5"
                  - listitem [ref=f5e173]:
                    - button "vendredi 6 novembre 2026, aucun événement" [ref=f5e174] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e175]: "6"
                  - listitem [ref=f5e176]:
                    - button "samedi 7 novembre 2026, aucun événement" [ref=f5e177] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e178]: "7"
                  - listitem [ref=f5e179]:
                    - button "dimanche 8 novembre 2026, aucun événement" [ref=f5e180] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e181]: "8"
                  - listitem [ref=f5e182]:
                    - button "lundi 9 novembre 2026, aucun événement" [ref=f5e183] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e184]: "9"
                  - listitem [ref=f5e185]:
                    - button "mardi 10 novembre 2026, aucun événement" [ref=f5e186] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e187]: "10"
                  - listitem [ref=f5e188]:
                    - button "mercredi 11 novembre 2026, aucun événement" [ref=f5e189] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e190]: "11"
                  - listitem [ref=f5e191]:
                    - button "jeudi 12 novembre 2026, aucun événement" [ref=f5e192] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e193]: "12"
                  - listitem [ref=f5e194]:
                    - button "vendredi 13 novembre 2026, aucun événement" [ref=f5e195] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e196]: "13"
                  - listitem [ref=f5e197]:
                    - button "samedi 14 novembre 2026, aucun événement" [ref=f5e198] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e199]: "14"
                  - listitem [ref=f5e200]:
                    - button "dimanche 15 novembre 2026, aucun événement" [ref=f5e201] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e202]: "15"
                  - listitem [ref=f5e203]:
                    - button "lundi 16 novembre 2026, aucun événement" [ref=f5e204] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e205]: "16"
                  - listitem [ref=f5e206]:
                    - button "mardi 17 novembre 2026, aucun événement" [ref=f5e207] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e208]: "17"
                  - listitem [ref=f5e209]:
                    - button "mercredi 18 novembre 2026, aucun événement" [ref=f5e210] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e211]: "18"
                  - listitem [ref=f5e212]:
                    - button "jeudi 19 novembre 2026, aucun événement" [ref=f5e213] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e214]: "19"
                  - listitem [ref=f5e215]:
                    - button "vendredi 20 novembre 2026, aucun événement" [ref=f5e216] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e217]: "20"
                  - listitem [ref=f5e218]:
                    - button "samedi 21 novembre 2026, aucun événement" [ref=f5e219] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e220]: "21"
                  - listitem [ref=f5e221]:
                    - button "dimanche 22 novembre 2026, aucun événement" [ref=f5e222] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e223]: "22"
                  - listitem [ref=f5e224]:
                    - button "lundi 23 novembre 2026, aucun événement" [ref=f5e225] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e226]: "23"
                  - listitem [ref=f5e227]:
                    - button "mardi 24 novembre 2026, 1 événement" [ref=f5e228] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e229]: "24"
                      - generic [aria-hidden] [ref=f5e230]: 1 év.
                  - listitem [ref=f5e231]:
                    - button "mercredi 25 novembre 2026, aucun événement" [ref=f5e232] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e233]: "25"
                  - listitem [ref=f5e234]:
                    - button "jeudi 26 novembre 2026, aucun événement" [ref=f5e235] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e236]: "26"
                  - listitem [ref=f5e237]:
                    - button "vendredi 27 novembre 2026, 3 événements" [ref=f5e238] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e239]: "27"
                      - generic [aria-hidden] [ref=f5e240]: 3 év.
                  - listitem [ref=f5e241]:
                    - button "samedi 28 novembre 2026, 3 événements, aujourd’hui" [ref=f5e242] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e243]: "28"
                      - generic [aria-hidden] [ref=f5e244]: 3 év.
                  - listitem [ref=f5e245]:
                    - button "dimanche 29 novembre 2026, aucun événement" [ref=f5e246] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e247]: "29"
                  - listitem [ref=f5e248]:
                    - button "lundi 30 novembre 2026, aucun événement" [ref=f5e249] [cursor=pointer]:
                      - generic [aria-hidden] [ref=f5e250]: "30"
                - paragraph [ref=f5e251]: Un jour avec des événements est encadré et indique leur nombre ; choisissez-le pour n’afficher que ses événements.
            - region [ref=f5e252]:
              - heading "Événements de novembre 2026" [level=2] [ref=f5e254]
              - list [ref=f5e255]:
                - listitem [ref=f5e256]:
                  - heading "mardi 24 novembre 2026" [level=3] [ref=f5e257]
                  - list [ref=f5e258]:
                    - listitem [ref=f5e259]:
                      - link "Brunch électro des Almadies Terminé mar. 24 nov. 2026 à 12:00 Rooftop de la Pointe des Almadies, Dakar" [ref=f5e260] [cursor=pointer]:
                        - /url: /partner/events/91f9d69a-8a1b-43e5-b1bc-bf307033aeea
                        - generic [ref=f5e261]:
                          - generic [ref=f5e262]: Brunch électro des Almadies
                          - 'generic "L’événement est passé : la vente est close, le bilan reste consultable." [ref=f5e263]': Terminé
                        - generic [ref=f5e266]: mar. 24 nov. 2026 à 12:00
                        - generic [ref=f5e267]: Rooftop de la Pointe des Almadies, Dakar
                - listitem [ref=f5e272]:
                  - heading "vendredi 27 novembre 2026" [level=3] [ref=f5e273]
                  - list [ref=f5e274]:
                    - listitem [ref=f5e275]:
                      - link "Soirée en cours c5849e8d Publié ven. 27 nov. 2026 à 23:57 Esplanade de test, Dakar" [ref=f5e276] [cursor=pointer]:
                        - /url: /partner/events/d68e58d1-db1f-4967-b72c-da7b0897a5a0
                        - generic [ref=f5e277]:
                          - generic [ref=f5e278]: Soirée en cours c5849e8d
                          - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f5e279]': Publié
                        - generic [ref=f5e282]: ven. 27 nov. 2026 à 23:57
                        - generic [ref=f5e283]: Esplanade de test, Dakar
                    - listitem [ref=f5e288]:
                      - link "Soirée en cours 67d45d86 Publié ven. 27 nov. 2026 à 23:57 Esplanade de test, Dakar" [ref=f5e289] [cursor=pointer]:
                        - /url: /partner/events/bfc22201-86d3-43cf-8183-c9aa8b64e5bc
                        - generic [ref=f5e290]:
                          - generic [ref=f5e291]: Soirée en cours 67d45d86
                          - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f5e292]': Publié
                        - generic [ref=f5e295]: ven. 27 nov. 2026 à 23:57
                        - generic [ref=f5e296]: Esplanade de test, Dakar
                    - listitem [ref=f5e301]:
                      - link "Soirée en cours d78b1a41 Publié ven. 27 nov. 2026 à 23:57 Esplanade de test, Dakar" [ref=f5e302] [cursor=pointer]:
                        - /url: /partner/events/b8910541-6c9b-42e5-b21b-ad8a01597de0
                        - generic [ref=f5e303]:
                          - generic [ref=f5e304]: Soirée en cours d78b1a41
                          - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f5e305]': Publié
                        - generic [ref=f5e308]: ven. 27 nov. 2026 à 23:57
                        - generic [ref=f5e309]: Esplanade de test, Dakar
                - listitem [ref=f5e314]:
                  - heading "samedi 28 novembre 2026" [level=3] [ref=f5e315]
                  - list [ref=f5e316]:
                    - listitem [ref=f5e317]:
                      - link "Nuit du Sabar — édition d’automne Publié sam. 28 nov. 2026 à 01:00 Esplanade de la Corniche Ouest, Dakar" [ref=f5e318] [cursor=pointer]:
                        - /url: /partner/events/391a5bc9-3436-4d4a-8828-0c3778f4d7fb
                        - generic [ref=f5e319]:
                          - generic [ref=f5e320]: Nuit du Sabar — édition d’automne
                          - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f5e321]': Publié
                        - generic [ref=f5e324]: sam. 28 nov. 2026 à 01:00
                        - generic [ref=f5e325]: Esplanade de la Corniche Ouest, Dakar
                    - listitem [ref=f5e330]:
                      - link "Croisière musicale vers Gorée Annulé sam. 28 nov. 2026 à 04:15 Embarcadère du port de Dakar, Dakar" [ref=f5e331] [cursor=pointer]:
                        - /url: /partner/events/0639591b-d733-4eae-9c88-91dc0d2b4347
                        - generic [ref=f5e332]:
                          - generic [ref=f5e333]: Croisière musicale vers Gorée
                          - 'generic "Annulé : les participants sont prévenus et les billets payés sont remboursés." [ref=f5e334]': Annulé
                        - generic [ref=f5e337]: sam. 28 nov. 2026 à 04:15
                        - generic [ref=f5e338]: Embarcadère du port de Dakar, Dakar
                    - listitem [ref=f5e343]:
                      - link "Concert des Lumières de Gorée Publié sam. 28 nov. 2026 à 20:15 Place du Gouvernement, Gorée" [ref=f5e344] [cursor=pointer]:
                        - /url: /partner/events/65ae8262-fe62-445c-974b-ac58be7a326a
                        - generic [ref=f5e345]:
                          - generic [ref=f5e346]: Concert des Lumières de Gorée
                          - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f5e347]': Publié
                        - generic [ref=f5e350]: sam. 28 nov. 2026 à 20:15
                        - generic [ref=f5e351]: Place du Gouvernement, Gorée
  - alert [ref=f5e356]
```

# Test source

```ts
  35  | 
  36  | const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
  37  |     { key: 'clair', colorScheme: 'light' },
  38  |     { key: 'sombre', colorScheme: 'dark' },
  39  | ];
  40  | 
  41  | interface Size { width: number; height: number; paysage?: boolean }
  42  | 
  43  | function sizesFor(p: ResponsivePage, theme: ThemeKey): Size[] {
  44  |     const base: Size[] = RESPONSIVE_WIDTHS
  45  |         .filter((w) => theme === 'clair' || RESPONSIVE_CAPTURE_WIDTHS.includes(w.width))
  46  |         .map((w) => ({ width: w.width, height: w.height }));
  47  |     const land: Size[] = p.paysage ? RESPONSIVE_LANDSCAPE.map((w) => ({ width: w.width, height: w.height, paysage: true })) : [];
  48  |     return [...base, ...land];
  49  | }
  50  | 
  51  | /** Page stable : polices chargées, réseau au repos (plafond 3 s, noté sinon), deux images d'affichage. */
  52  | async function settle(page: Page, notes: string[], at: string): Promise<void> {
  53  |     await page.evaluate(() => document.fonts.ready.then(() => true));
  54  |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => { notes.push(`${at} : réseau jamais au repos en 3 s (attente plafonnée)`); });
  55  |     await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete), undefined, { timeout: 5_000 })
  56  |         .catch(() => { notes.push(`${at} : images encore en chargement après 5 s`); });
  57  |     await page.evaluate(() => new Promise<void>((resolve) => { requestAnimationFrame(() => requestAnimationFrame(() => resolve())); }));
  58  | }
  59  | 
  60  | interface ResponsiveRecord {
  61  |     page: string;
  62  |     titre: string;
  63  |     groupe: string;
  64  |     role: CaptureRole;
  65  |     theme: ThemeKey;
  66  |     url: string | null;
  67  |     sizes: Array<{ size: string; blocking: string[]; warnings: string[]; capture: string | null }>;
  68  |     notes: string[];
  69  |     error: string | null;
  70  | }
  71  | 
  72  | for (const theme of THEMES) {
  73  |     const roles = Array.from(new Set(RESPONSIVE_PAGES.map((p) => p.role)));
  74  |     for (const role of roles) {
  75  |         test.describe(`${theme.key} · ${role}`, () => {
  76  |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  77  |             for (const p of RESPONSIVE_PAGES.filter((x) => x.role === role)) {
  78  |                 test(`${p.id} — ${p.titre}`, async ({ page, context, guard, servicesLock }) => {
  79  |                     test.setTimeout(240_000);
  80  |                     const record: ResponsiveRecord = { page: p.id, titre: p.titre, groupe: p.groupe, role, theme: theme.key, url: null, sizes: [], notes: [], error: null };
  81  |                     try {
  82  |                         // Lot 10b (lot 11b : salles et tables) : verrou des services avant tout chargement (attente ajoutée au délai du test)
  83  |                         await servicesLock.enter(p.services ? 'services' : 'autres');
  84  |                         if (servicesLock.waitedMs >= 1_000) record.notes.push(`attente du verrou des services : ${Math.round(servicesLock.waitedMs / 1000)} s`);
  85  |                         if (p.services) {
  86  |                             record.notes.push('page des services : interrupteurs features.halls_enabled et features.tables_enabled ouverts le temps du test (e2e/support/services-switch.ts)');
  87  |                             await keepHomeOutOfServicesWindow(page);
  88  |                         }
  89  |                         const demo: DemoIds | null = p.needsIds ? readDemoIds() : null;
  90  |                         record.url = p.path(demo);
  91  |                         guard.configure({ allowFailures: p.allowFailures ?? [], ignoreConsoleErrors: false });
  92  |                         if (p.fakeCamera) await context.addInitScript(installFakeCamera, { mode: fakeScanMode() });
  93  |                         // Lot stabilité (contrôle durable) : erreur d'hydratation de React (n° 418, 423, 425, « did not match ») =
  94  |                         // page en échec, avec son nom et la largeur (les autres erreurs de la page restent notées)
  95  |                         const hydration = watchHydration(page);
  96  |                         let hydrationSeen = 0;
  97  |                         for (const size of sizesFor(p, theme.key)) {
  98  |                             const at = size.paysage ? `${size.width}×${size.height} px (paysage)` : `${size.width} px`;
  99  |                             await page.setViewportSize({ width: size.width, height: size.height });
  100 |                             const response = await page.goto(record.url, { waitUntil: 'load' });
  101 |                             if (p.expectStatus !== undefined) expect(response?.status(), `statut HTTP de ${record.url}`).toBe(p.expectStatus);
  102 |                             if (p.ready) await p.ready(page);
  103 |                             else await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  104 |                             if (p.actions) await p.actions(page);
  105 |                             await settle(page, record.notes, at);
  106 |                             const checks = await runResponsiveChecks(page, { width: size.width, phone: !size.paysage && size.width <= PHONE_MAX_WIDTH });
  107 |                             const blocking = checks.blocking.map((b) => (size.paysage ? b.replace(`${size.width} px`, at) : b));
  108 |                             // Finition 5 (point 1) : thème demandé vraiment affiché (classe dark et fond lus sur la page), bloquant
  109 |                             const themeIssue = themeProblem(await readTheme(page), theme.key, at);
  110 |                             if (themeIssue) blocking.push(themeIssue);
  111 |                             for (const h of hydration.since(hydrationSeen)) blocking.push(`erreur d'hydratation sur ${p.id} à ${at} : ${h}`);
  112 |                             hydrationSeen = hydration.mark();
  113 |                             let capture: string | null = null;
  114 |                             if (size.paysage || RESPONSIVE_CAPTURE_WIDTHS.includes(size.width)) {
  115 |                                 fs.mkdirSync(SHOTS, { recursive: true });
  116 |                                 capture = `${p.id}__${size.paysage ? `${size.width}x${size.height}` : size.width}__${theme.key}.jpg`;
  117 |                                 await page.screenshot({ path: path.join(SHOTS, capture), type: 'jpeg', quality: 80, animations: 'disabled', caret: 'hide', scale: 'css' });
  118 |                             }
  119 |                             record.sizes.push({ size: at, blocking, warnings: checks.warnings, capture });
  120 |                         }
  121 |                         // Erreur d'hydratation arrivée après le relevé de la dernière largeur : rattachée à celle-ci
  122 |                         const late = hydration.since(hydrationSeen);
  123 |                         const last = record.sizes[record.sizes.length - 1];
  124 |                         if (last) for (const h of late) last.blocking.push(`erreur d'hydratation sur ${p.id} (après le relevé de ${last.size}) : ${h}`);
  125 |                     } catch (err) {
  126 |                         record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  127 |                         throw err;
  128 |                     } finally {
  129 |                         // Erreurs de la page (console, requêtes) : notées, déjà bloquantes dans les captures
  130 |                         record.notes.push(...guard.blockingIssues().map((i) => `erreur de la page : ${i}`));
  131 |                         fs.mkdirSync(RESULTS, { recursive: true });
  132 |                         fs.writeFileSync(path.join(RESULTS, `${p.id}__${theme.key}.json`), `${JSON.stringify(record, null, 1)}\n`, 'utf8');
  133 |                     }
  134 |                     const blocking = record.sizes.flatMap((s) => s.blocking);
> 135 |                     expect(blocking, `contrôles responsive de ${p.id} (${theme.key})`).toEqual([]);
      |                                                                                        ^ Error: contrôles responsive de org-calendrier (clair)
  136 |                 });
  137 |             }
  138 |         });
  139 |     }
  140 | }
  141 | 
```