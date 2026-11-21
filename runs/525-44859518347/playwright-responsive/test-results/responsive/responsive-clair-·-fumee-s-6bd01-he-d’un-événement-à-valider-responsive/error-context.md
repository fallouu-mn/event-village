# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · fumee-superadmin >> adm-evenement — Fiche d’un événement à valider
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de adm-evenement (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "1024 px : textes qui se chevauchent : span.min-w-0.break-words « À la une » sur span.block.break-words « Elhadji SuperAdmin » (42×10 px) ; span.flex.flex-shrink-0 « ES » sur p.mb-1.5.block « Système » (17×14 px) ; span.block.break-words « Super-administrateur » sur p.mb-1.5.block « Système » (23×14 px) ; span.block.break-words « Super-administrateur » sur span.min-w-0.break-words « Réglages » (13×16 px)",
+   "1440 px : textes qui se chevauchent : span.block.break-words « Elhadji SuperAdmin » sur span.min-w-0.break-words « Notifications » (77×16 px) ; span.block.break-words « Super-administrateur » sur span.min-w-0.break-words « Scanner » (47×10 px)",
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
        - generic [ref=f5e17]: Administration
        - link "Tableau de bord" [ref=f5e22] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=f5e29]:
          - paragraph [ref=f5e30]: Gestion
          - generic [ref=f5e31]:
            - link "Événements" [ref=f5e32] [cursor=pointer]:
              - /url: /admin/events
            - link "Comptes" [ref=f5e36] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=f5e43] [cursor=pointer]:
              - /url: /admin/services
            - link "Salles à valider" [ref=f5e49] [cursor=pointer]:
              - /url: /admin/halls
        - generic [ref=f5e55]:
          - paragraph [ref=f5e56]: Finances
          - link "Finance" [ref=f5e58] [cursor=pointer]:
            - /url: /admin/finance
        - generic [ref=f5e62]:
          - paragraph [ref=f5e63]: Engagement
          - generic [ref=f5e64]:
            - link "Parrainage" [ref=f5e65] [cursor=pointer]:
              - /url: /admin/referral
            - link "Campagnes" [ref=f5e70] [cursor=pointer]:
              - /url: /admin/communications
            - link "À la une" [ref=f5e75] [cursor=pointer]:
              - /url: /admin/a-la-une
        - generic [ref=f5e79]:
          - paragraph [ref=f5e80]: Système
          - generic [ref=f5e81]:
            - link "Réglages" [ref=f5e82] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Journal d’audit" [ref=f5e87] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=f5e92] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=f5e99] [cursor=pointer]:
              - /url: /scan
            - link "Sécurité du compte" [ref=f5e107] [cursor=pointer]:
              - /url: /admin/securite
        - link "Retour au site" [ref=f5e113] [cursor=pointer]:
          - /url: /
      - generic [ref=f5e118]:
        - link "Elhadji SuperAdmin Super-administrateur" [ref=f5e119] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f5e121]: ES
          - generic [ref=f5e122]:
            - generic [ref=f5e123]: Elhadji SuperAdmin
            - generic [ref=f5e124]: Super-administrateur
        - generic [ref=f5e125]:
          - button "Se déconnecter" [ref=f5e126] [cursor=pointer]
          - button "Basculer le thème" [ref=f5e131] [cursor=pointer]
    - generic [ref=f5e135]:
      - banner [ref=f5e136]:
        - link "Rechercher un événement…" [ref=f5e138] [cursor=pointer]:
          - /url: /explore
        - generic [ref=f5e143]:
          - button "Notifications, 61 non lues" [ref=f5e145] [cursor=pointer]:
            - generic [ref=f5e149]: "61"
          - button "Elhadji SuperAdmin" [ref=f5e151] [cursor=pointer]:
            - generic [aria-hidden] [ref=f5e152]: ES
      - main [ref=f5e156]:
        - generic [ref=f5e158]:
          - generic [ref=f5e159]:
            - link "Retour aux événements" [ref=f5e161] [cursor=pointer]:
              - /url: /admin/events
            - generic [ref=f5e166]:
              - generic [ref=f5e167]:
                - generic [ref=f5e168]:
                  - generic "Soumis à l’équipe Event Village, qui vérifie la fiche avant validation." [ref=f5e169]: En attente de validation
                  - generic [ref=f5e172]: Festivals
                - heading "Festival des musiques du Saloum" [level=1] [ref=f5e173]
                - paragraph [ref=f5e174]: Sine-Saloum Culture & Loisirs · jeu. 24 déc. 2026 à 17:00
              - generic [ref=f5e175]:
                - button "Refuser" [ref=f5e176] [cursor=pointer]
                - button "Valider" [ref=f5e178] [cursor=pointer]
                - link "Ouvrir le pilotage" [ref=f5e180] [cursor=pointer]:
                  - /url: /partner/events/45ef7659-a648-45e8-9dc9-8da722f7de7b
                - link "Équipe de cet événement" [ref=f5e186] [cursor=pointer]:
                  - /url: /partner/events/45ef7659-a648-45e8-9dc9-8da722f7de7b?tab=equipe
          - generic [ref=f5e194]:
            - generic [ref=f5e195]:
              - region [ref=f5e196]:
                - heading "Dates et lieu" [level=2] [ref=f5e197]
                - generic [ref=f5e198]:
                  - generic [ref=f5e199]:
                    - term [ref=f5e200]: Début
                    - definition [ref=f5e204]: jeu. 24 déc. 2026 à 17:00
                  - generic [ref=f5e205]:
                    - term [ref=f5e206]: Fin
                    - definition [ref=f5e211]: ven. 25 déc. 2026 à 00:00
                  - generic [ref=f5e212]:
                    - term [ref=f5e213]: Lieu
                    - definition [ref=f5e218]: Parc de la Promenade, Kaolack
                  - generic [ref=f5e219]:
                    - term [ref=f5e220]: Jauge déclarée
                    - definition [ref=f5e227]: 1 000 personnes
                - generic [ref=f5e228]:
                  - 'region "Carte : Parc de la Promenade" [ref=f5e229]':
                    - generic:
                      - 'img "Emplacement : Parc de la Promenade" [ref=f5e230] [cursor=pointer]'
                      - generic [ref=f5e231]:
                        - strong [ref=f5e234]: Parc de la Promenade
                        - button "Fermer la bulle" [ref=f5e236] [cursor=pointer]: ×
                    - generic:
                      - generic [ref=f5e237]:
                        - button "Zoom avant" [ref=f5e238] [cursor=pointer]: +
                        - button "Zoom arrière" [ref=f5e239] [cursor=pointer]: −
                      - generic: © contributeurs OpenStreetMap
                  - link "Voir l’itinéraire" [ref=f5e241] [cursor=pointer]:
                    - /url: https://www.google.com/maps/dir/?api=1&destination=14.144,-16.066
                - generic [ref=f5e251]:
                  - generic [ref=f5e252]:
                    - term [ref=f5e253]: Adresse
                    - definition [ref=f5e254]: Parc de la Promenade, Kaolack
                  - generic [ref=f5e255]:
                    - term [ref=f5e256]: Stationnement
                    - definition [ref=f5e257]: Stationnement surveillé à proximité.
                  - generic [ref=f5e258]:
                    - term [ref=f5e259]: Règlement
                    - definition [ref=f5e260]: Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.
              - region [ref=f5e261]:
                - heading "Description" [level=2] [ref=f5e262]
                - paragraph [ref=f5e263]: Deux jours de concerts gratuits pour les moins de douze ans, scène jeunes talents et village associatif.
              - region [ref=f5e264]:
                - heading "Programme" [level=2] [ref=f5e265]
                - list [ref=f5e266]:
                  - listitem [ref=f5e267]:
                    - generic [ref=f5e268]: 17:00
                    - generic [ref=f5e270]:
                      - generic [ref=f5e271]: Scène jeunes talents
                      - generic [ref=f5e272]: Artiste
                  - listitem [ref=f5e274]:
                    - generic [ref=f5e275]: 20:00
                    - generic [ref=f5e276]:
                      - generic [ref=f5e277]:
                        - generic [ref=f5e278]: Tête d’affiche
                        - generic [ref=f5e279]: Artiste
                      - paragraph [ref=f5e281]: Orchestre du Sine
              - region [ref=f5e282]:
                - heading "Catégories et prix" [level=2] [ref=f5e283]
                - region "Catégories de billets, tous canaux et inactives comprises" [ref=f5e285]:
                  - table [ref=f5e286]:
                    - caption [ref=f5e287]: Catégories de billets, tous canaux et inactives comprises
                    - rowgroup [ref=f5e288]:
                      - row [ref=f5e289]:
                        - columnheader "Catégorie" [ref=f5e290]
                        - columnheader "Prix" [ref=f5e291]
                        - columnheader "Quota" [ref=f5e292]
                        - columnheader "Période de vente" [ref=f5e293]
                        - columnheader "Par commande" [ref=f5e294]
                        - columnheader "Au contrôle" [ref=f5e295]
                        - columnheader "Canaux et état" [ref=f5e296]
                    - rowgroup [ref=f5e297]:
                      - row [ref=f5e298]:
                        - cell "Pass journée Une journée." [ref=f5e299]:
                          - generic [ref=f5e300]:
                            - generic [ref=f5e301]: Pass journée
                            - generic [ref=f5e302]: Une journée.
                        - cell "3 000 F CFA" [ref=f5e303]
                        - cell "800" [ref=f5e304]
                        - cell "Du lun. 9 nov. 2026 à 03:10 · jusqu’à l’événement" [ref=f5e305]
                        - cell "10 au plus" [ref=f5e307]
                        - cell "Blanc Aucune consigne" [ref=f5e308]:
                          - generic [ref=f5e309]:
                            - generic [ref=f5e310]: Blanc
                            - generic [ref=f5e313]: Aucune consigne
                        - cell "En ligne et au guichet Active" [ref=f5e314]:
                          - generic [ref=f5e315]:
                            - generic [ref=f5e316]: En ligne et au guichet
                            - generic [ref=f5e318]: Active
                      - row [ref=f5e320]:
                        - cell "Pass deux jours Les deux journées." [ref=f5e321]:
                          - generic [ref=f5e322]:
                            - generic [ref=f5e323]: Pass deux jours
                            - generic [ref=f5e324]: Les deux journées.
                        - cell "5 000 F CFA" [ref=f5e325]
                        - cell "200" [ref=f5e326]
                        - cell "Du lun. 9 nov. 2026 à 03:10 · jusqu’à l’événement" [ref=f5e327]
                        - cell "10 au plus" [ref=f5e329]
                        - cell "Noir Aucune consigne" [ref=f5e330]:
                          - generic [ref=f5e331]:
                            - generic [ref=f5e332]: Noir
                            - generic [ref=f5e335]: Aucune consigne
                        - cell "En ligne et au guichet Active" [ref=f5e336]:
                          - generic [ref=f5e337]:
                            - generic [ref=f5e338]: En ligne et au guichet
                            - generic [ref=f5e340]: Active
              - region [ref=f5e342]:
                - heading "Contrôle à l’entrée" [level=2] [ref=f5e343]
                - paragraph [ref=f5e344]: "Une seule entrée : chaque contrôleur laisse entrer toutes les catégories."
            - generic [ref=f5e345]:
              - region [ref=f5e346]:
                - heading "Affiche" [level=2] [ref=f5e347]
                - img "Affiche de « Festival des musiques du Saloum »" [ref=f5e348]
              - region [ref=f5e349]:
                - heading "Organisateur" [level=2] [ref=f5e350]
                - generic [ref=f5e351]:
                  - generic [ref=f5e352]:
                    - term [ref=f5e353]: Structure
                    - definition [ref=f5e359]:
                      - text: Sine-Saloum Culture & Loisirs
                      - generic [ref=f5e360]: Saloum Culture
                      - generic [ref=f5e361]: Compte validé
                  - generic [ref=f5e364]:
                    - term [ref=f5e365]: Responsable
                    - definition [ref=f5e372]: Ousmane Faye
                  - generic [ref=f5e373]:
                    - term [ref=f5e374]: Téléphone
                    - definition [ref=f5e378]:
                      - link "+221700000102" [ref=f5e379] [cursor=pointer]:
                        - /url: tel:+221700000102
                  - generic [ref=f5e380]:
                    - term [ref=f5e381]: Email
                    - definition [ref=f5e386]:
                      - link "ousmane.faye@demo.eventvillage.local" [ref=f5e387] [cursor=pointer]:
                        - /url: mailto:ousmane.faye@demo.eventvillage.local
                  - generic [ref=f5e388]:
                    - term [ref=f5e389]: Ville
                    - definition [ref=f5e394]: Kaolack
              - region [ref=f5e395]:
                - heading "Historique des statuts" [level=2] [ref=f5e396]
                - list [ref=f5e397]:
                  - listitem [ref=f5e398]:
                    - paragraph [ref=f5e400]: Brouillon → En attente de validation
                    - paragraph [ref=f5e401]: Ousmane Faye (Partenaire) · Changement de statut
                    - paragraph [ref=f5e402]:
                      - time [ref=f5e403]: sam. 21 nov. 2026 à 03:10
                  - listitem [ref=f5e404]:
                    - paragraph [ref=f5e406]: "Création : Brouillon"
                    - paragraph [ref=f5e407]: Ousmane Faye (Partenaire) · Création
                    - paragraph [ref=f5e408]:
                      - time [ref=f5e409]: sam. 21 nov. 2026 à 03:10
  - alert [ref=f5e410]
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
      |                                                                                        ^ Error: contrôles responsive de adm-evenement (clair)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```