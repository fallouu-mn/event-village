# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · fumee-superadmin >> adm-evenement — Fiche d’un événement à valider
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de adm-evenement (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "1440 px : textes qui se chevauchent : span.block.break-words « Elhadji SuperAdmin » sur span.min-w-0.break-words « Notifications » (77×16 px) ; span.block.break-words « Super-administrateur » sur span.min-w-0.break-words « Scanner » (47×10 px)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
  - generic [ref=f2e2]:
    - complementary [ref=f2e4]:
      - generic [ref=f2e5]:
        - link "Event Village, accueil" [ref=f2e7] [cursor=pointer]:
          - /url: /
          - generic [ref=f2e8]: Event Village
        - button "Replier la barre latérale" [expanded] [ref=f2e11] [cursor=pointer]
      - navigation "Navigation principale" [ref=f2e16]:
        - generic [ref=f2e17]: Administration
        - link "Tableau de bord" [ref=f2e22] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=f2e29]:
          - paragraph [ref=f2e30]: Gestion
          - generic [ref=f2e31]:
            - link "Événements" [ref=f2e32] [cursor=pointer]:
              - /url: /admin/events
            - link "Comptes" [ref=f2e36] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=f2e43] [cursor=pointer]:
              - /url: /admin/services
            - link "Salles à valider" [ref=f2e49] [cursor=pointer]:
              - /url: /admin/halls
        - generic [ref=f2e55]:
          - paragraph [ref=f2e56]: Finances
          - link "Finance" [ref=f2e58] [cursor=pointer]:
            - /url: /admin/finance
        - generic [ref=f2e62]:
          - paragraph [ref=f2e63]: Engagement
          - generic [ref=f2e64]:
            - link "Parrainage" [ref=f2e65] [cursor=pointer]:
              - /url: /admin/referral
            - link "Campagnes" [ref=f2e70] [cursor=pointer]:
              - /url: /admin/communications
            - link "À la une" [ref=f2e75] [cursor=pointer]:
              - /url: /admin/a-la-une
        - generic [ref=f2e79]:
          - paragraph [ref=f2e80]: Système
          - generic [ref=f2e81]:
            - link "Réglages" [ref=f2e82] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Journal d’audit" [ref=f2e87] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=f2e92] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=f2e99] [cursor=pointer]:
              - /url: /scan
            - link "Sécurité du compte" [ref=f2e107] [cursor=pointer]:
              - /url: /admin/securite
        - link "Retour au site" [ref=f2e113] [cursor=pointer]:
          - /url: /
      - generic [ref=f2e118]:
        - link "Elhadji SuperAdmin Super-administrateur" [ref=f2e119] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e121]: ES
          - generic [ref=f2e122]:
            - generic [ref=f2e123]: Elhadji SuperAdmin
            - generic [ref=f2e124]: Super-administrateur
        - generic [ref=f2e125]:
          - button "Se déconnecter" [ref=f2e126] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e131] [cursor=pointer]
    - generic [ref=f2e135]:
      - banner [ref=f2e136]:
        - link "Rechercher un événement…" [ref=f2e138] [cursor=pointer]:
          - /url: /explore
        - generic [ref=f2e143]:
          - button "Notifications, 61 non lues" [ref=f2e145] [cursor=pointer]:
            - generic [ref=f2e149]: "61"
          - button "Elhadji SuperAdmin" [ref=f2e151] [cursor=pointer]:
            - generic [aria-hidden] [ref=f2e152]: ES
      - main [ref=f2e156]:
        - generic [ref=f2e158]:
          - generic [ref=f2e159]:
            - link "Retour aux événements" [ref=f2e161] [cursor=pointer]:
              - /url: /admin/events
            - generic [ref=f2e166]:
              - generic [ref=f2e167]:
                - generic [ref=f2e168]:
                  - generic "Soumis à l’équipe Event Village, qui vérifie la fiche avant validation." [ref=f2e169]: En attente de validation
                  - generic [ref=f2e172]: Festivals
                - heading "Festival des musiques du Saloum" [level=1] [ref=f2e173]
                - paragraph [ref=f2e174]: Sine-Saloum Culture & Loisirs · jeu. 24 déc. 2026 à 17:00
              - generic [ref=f2e175]:
                - button "Refuser" [ref=f2e176] [cursor=pointer]
                - button "Valider" [ref=f2e178] [cursor=pointer]
                - link "Ouvrir le pilotage" [ref=f2e180] [cursor=pointer]:
                  - /url: /partner/events/45ef7659-a648-45e8-9dc9-8da722f7de7b
                - link "Équipe de cet événement" [ref=f2e186] [cursor=pointer]:
                  - /url: /partner/events/45ef7659-a648-45e8-9dc9-8da722f7de7b?tab=equipe
          - generic [ref=f2e194]:
            - generic [ref=f2e195]:
              - region [ref=f2e196]:
                - heading "Dates et lieu" [level=2] [ref=f2e197]
                - generic [ref=f2e198]:
                  - generic [ref=f2e199]:
                    - term [ref=f2e200]: Début
                    - definition [ref=f2e204]: jeu. 24 déc. 2026 à 17:00
                  - generic [ref=f2e205]:
                    - term [ref=f2e206]: Fin
                    - definition [ref=f2e211]: ven. 25 déc. 2026 à 00:00
                  - generic [ref=f2e212]:
                    - term [ref=f2e213]: Lieu
                    - definition [ref=f2e218]: Parc de la Promenade, Kaolack
                  - generic [ref=f2e219]:
                    - term [ref=f2e220]: Jauge déclarée
                    - definition [ref=f2e227]: 1 000 personnes
                - generic [ref=f2e228]:
                  - 'region "Carte : Parc de la Promenade" [ref=f2e229]':
                    - generic:
                      - 'img "Emplacement : Parc de la Promenade" [ref=f2e230] [cursor=pointer]'
                      - generic [ref=f2e231]:
                        - strong [ref=f2e234]: Parc de la Promenade
                        - button "Fermer la bulle" [ref=f2e236] [cursor=pointer]: ×
                    - generic:
                      - generic [ref=f2e237]:
                        - button "Zoom avant" [ref=f2e238] [cursor=pointer]: +
                        - button "Zoom arrière" [ref=f2e239] [cursor=pointer]: −
                      - generic: © contributeurs OpenStreetMap
                  - link "Voir l’itinéraire" [ref=f2e241] [cursor=pointer]:
                    - /url: https://www.google.com/maps/dir/?api=1&destination=14.144,-16.066
                - generic [ref=f2e251]:
                  - generic [ref=f2e252]:
                    - term [ref=f2e253]: Adresse
                    - definition [ref=f2e254]: Parc de la Promenade, Kaolack
                  - generic [ref=f2e255]:
                    - term [ref=f2e256]: Stationnement
                    - definition [ref=f2e257]: Stationnement surveillé à proximité.
                  - generic [ref=f2e258]:
                    - term [ref=f2e259]: Règlement
                    - definition [ref=f2e260]: Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.
              - region [ref=f2e261]:
                - heading "Description" [level=2] [ref=f2e262]
                - paragraph [ref=f2e263]: Deux jours de concerts gratuits pour les moins de douze ans, scène jeunes talents et village associatif.
              - region [ref=f2e264]:
                - heading "Programme" [level=2] [ref=f2e265]
                - list [ref=f2e266]:
                  - listitem [ref=f2e267]:
                    - generic [ref=f2e268]: 17:00
                    - generic [ref=f2e270]:
                      - generic [ref=f2e271]: Scène jeunes talents
                      - generic [ref=f2e272]: Artiste
                  - listitem [ref=f2e274]:
                    - generic [ref=f2e275]: 20:00
                    - generic [ref=f2e276]:
                      - generic [ref=f2e277]:
                        - generic [ref=f2e278]: Tête d’affiche
                        - generic [ref=f2e279]: Artiste
                      - paragraph [ref=f2e281]: Orchestre du Sine
              - region [ref=f2e282]:
                - heading "Catégories et prix" [level=2] [ref=f2e283]
                - region "Catégories de billets, tous canaux et inactives comprises" [ref=f2e285]:
                  - table [ref=f2e286]:
                    - caption [ref=f2e287]: Catégories de billets, tous canaux et inactives comprises
                    - rowgroup [ref=f2e288]:
                      - row [ref=f2e289]:
                        - columnheader "Catégorie" [ref=f2e290]
                        - columnheader "Prix" [ref=f2e291]
                        - columnheader "Quota" [ref=f2e292]
                        - columnheader "Période de vente" [ref=f2e293]
                        - columnheader "Par commande" [ref=f2e294]
                        - columnheader "Au contrôle" [ref=f2e295]
                        - columnheader "Canaux et état" [ref=f2e296]
                    - rowgroup [ref=f2e297]:
                      - row [ref=f2e298]:
                        - cell "Pass journée Une journée." [ref=f2e299]:
                          - generic [ref=f2e300]:
                            - generic [ref=f2e301]: Pass journée
                            - generic [ref=f2e302]: Une journée.
                        - cell "3 000 F CFA" [ref=f2e303]
                        - cell "800" [ref=f2e304]
                        - cell "Du lun. 9 nov. 2026 à 03:10 · jusqu’à l’événement" [ref=f2e305]
                        - cell "10 au plus" [ref=f2e307]
                        - cell "Blanc Aucune consigne" [ref=f2e308]:
                          - generic [ref=f2e309]:
                            - generic [ref=f2e310]: Blanc
                            - generic [ref=f2e313]: Aucune consigne
                        - cell "En ligne et au guichet Active" [ref=f2e314]:
                          - generic [ref=f2e315]:
                            - generic [ref=f2e316]: En ligne et au guichet
                            - generic [ref=f2e318]: Active
                      - row [ref=f2e320]:
                        - cell "Pass deux jours Les deux journées." [ref=f2e321]:
                          - generic [ref=f2e322]:
                            - generic [ref=f2e323]: Pass deux jours
                            - generic [ref=f2e324]: Les deux journées.
                        - cell "5 000 F CFA" [ref=f2e325]
                        - cell "200" [ref=f2e326]
                        - cell "Du lun. 9 nov. 2026 à 03:10 · jusqu’à l’événement" [ref=f2e327]
                        - cell "10 au plus" [ref=f2e329]
                        - cell "Noir Aucune consigne" [ref=f2e330]:
                          - generic [ref=f2e331]:
                            - generic [ref=f2e332]: Noir
                            - generic [ref=f2e335]: Aucune consigne
                        - cell "En ligne et au guichet Active" [ref=f2e336]:
                          - generic [ref=f2e337]:
                            - generic [ref=f2e338]: En ligne et au guichet
                            - generic [ref=f2e340]: Active
              - region [ref=f2e342]:
                - heading "Contrôle à l’entrée" [level=2] [ref=f2e343]
                - paragraph [ref=f2e344]: "Une seule entrée : chaque contrôleur laisse entrer toutes les catégories."
            - generic [ref=f2e345]:
              - region [ref=f2e346]:
                - heading "Affiche" [level=2] [ref=f2e347]
                - img "Affiche de « Festival des musiques du Saloum »" [ref=f2e348]
              - region [ref=f2e349]:
                - heading "Organisateur" [level=2] [ref=f2e350]
                - generic [ref=f2e351]:
                  - generic [ref=f2e352]:
                    - term [ref=f2e353]: Structure
                    - definition [ref=f2e359]:
                      - text: Sine-Saloum Culture & Loisirs
                      - generic [ref=f2e360]: Saloum Culture
                      - generic [ref=f2e361]: Compte validé
                  - generic [ref=f2e364]:
                    - term [ref=f2e365]: Responsable
                    - definition [ref=f2e372]: Ousmane Faye
                  - generic [ref=f2e373]:
                    - term [ref=f2e374]: Téléphone
                    - definition [ref=f2e378]:
                      - link "+221700000102" [ref=f2e379] [cursor=pointer]:
                        - /url: tel:+221700000102
                  - generic [ref=f2e380]:
                    - term [ref=f2e381]: Email
                    - definition [ref=f2e386]:
                      - link "ousmane.faye@demo.eventvillage.local" [ref=f2e387] [cursor=pointer]:
                        - /url: mailto:ousmane.faye@demo.eventvillage.local
                  - generic [ref=f2e388]:
                    - term [ref=f2e389]: Ville
                    - definition [ref=f2e394]: Kaolack
              - region [ref=f2e395]:
                - heading "Historique des statuts" [level=2] [ref=f2e396]
                - list [ref=f2e397]:
                  - listitem [ref=f2e398]:
                    - paragraph [ref=f2e400]: Brouillon → En attente de validation
                    - paragraph [ref=f2e401]: Ousmane Faye (Partenaire) · Changement de statut
                    - paragraph [ref=f2e402]:
                      - time [ref=f2e403]: sam. 21 nov. 2026 à 03:10
                  - listitem [ref=f2e404]:
                    - paragraph [ref=f2e406]: "Création : Brouillon"
                    - paragraph [ref=f2e407]: Ousmane Faye (Partenaire) · Création
                    - paragraph [ref=f2e408]:
                      - time [ref=f2e409]: sam. 21 nov. 2026 à 03:10
  - alert [ref=f2e410]
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
      |                                                                                        ^ Error: contrôles responsive de adm-evenement (sombre)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```