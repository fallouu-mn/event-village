# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · fumee-superadmin >> adm-evenement — Fiche d’un événement à valider
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de adm-evenement (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 6

- Array []
+ Array [
+   "768 px : texte coupé : span « En ligne et au guichet » dépasse de div.hidden.overflow-hidden «  » ; span « En ligne et au guichet » dépasse de div.hidden.overflow-hidden «  »",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "1440 px : texte coupé : span « En ligne et au guichet » dépasse de div.hidden.overflow-hidden «  » ; span « En ligne et au guichet » dépasse de div.hidden.overflow-hidden «  »",
+   "1440 px : texte tronqué sans le texte entier : span.block.truncate « Elhadji SuperAdmin » (points de suspension, texte entier absent)",
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
        - generic [ref=f2e10]: Administration
        - link "Tableau de bord" [ref=f2e15] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=f2e22]:
          - paragraph [ref=f2e23]: Gestion
          - generic [ref=f2e24]:
            - link "Événements" [ref=f2e25] [cursor=pointer]:
              - /url: /admin/events
            - link "Comptes" [ref=f2e29] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=f2e36] [cursor=pointer]:
              - /url: /admin/services
        - generic [ref=f2e42]:
          - paragraph [ref=f2e43]: Finances
          - link "Finance" [ref=f2e45] [cursor=pointer]:
            - /url: /admin/finance
        - generic [ref=f2e49]:
          - paragraph [ref=f2e50]: Engagement
          - generic [ref=f2e51]:
            - link "Parrainage" [ref=f2e52] [cursor=pointer]:
              - /url: /admin/referral
            - link "Campagnes" [ref=f2e57] [cursor=pointer]:
              - /url: /admin/communications
            - link "À la une" [ref=f2e62] [cursor=pointer]:
              - /url: /admin/a-la-une
        - generic [ref=f2e66]:
          - paragraph [ref=f2e67]: Système
          - generic [ref=f2e68]:
            - link "Réglages" [ref=f2e69] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Journal d’audit" [ref=f2e74] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=f2e79] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=f2e86] [cursor=pointer]:
              - /url: /scan
            - link "Sécurité du compte" [ref=f2e94] [cursor=pointer]:
              - /url: /admin/securite
        - link "Retour au site" [ref=f2e100] [cursor=pointer]:
          - /url: /
      - generic [ref=f2e105]:
        - link "Elhadji SuperAdmin Superadmin" [ref=f2e106] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e107]: ES
          - generic [ref=f2e108]:
            - generic [ref=f2e109]: Elhadji SuperAdmin
            - generic [ref=f2e110]: Superadmin
        - generic [ref=f2e111]:
          - button "Se déconnecter" [ref=f2e112] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e117] [cursor=pointer]
    - generic [ref=f2e121]:
      - banner [ref=f2e122]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f2e124] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 58 non lues" [ref=f2e131] [cursor=pointer]:
          - generic [ref=f2e135]: "58"
      - main [ref=f2e136]:
        - generic [ref=f2e138]:
          - generic [ref=f2e139]:
            - link "Retour aux événements" [ref=f2e141] [cursor=pointer]:
              - /url: /admin/events
            - generic [ref=f2e146]:
              - generic [ref=f2e147]:
                - generic [ref=f2e148]:
                  - generic "Soumis à l’équipe Event Village, qui vérifie la fiche avant validation." [ref=f2e149]: En attente de validation
                  - generic [ref=f2e152]: Festivals
                - heading "Festival des musiques du Saloum" [level=1] [ref=f2e153]
                - paragraph [ref=f2e154]: Sine-Saloum Culture & Loisirs · mar. 22 déc. 2026 à 17:00
              - generic [ref=f2e155]:
                - button "Refuser" [ref=f2e156] [cursor=pointer]
                - button "Valider" [ref=f2e158] [cursor=pointer]
                - link "Ouvrir le pilotage" [ref=f2e160] [cursor=pointer]:
                  - /url: /partner/events/df93422e-6d27-4e16-8ac3-eb759df0ebb5
                - link "Équipe de cet événement" [ref=f2e166] [cursor=pointer]:
                  - /url: /partner/events/df93422e-6d27-4e16-8ac3-eb759df0ebb5?tab=equipe
          - generic [ref=f2e174]:
            - generic [ref=f2e175]:
              - region [ref=f2e176]:
                - heading "Dates et lieu" [level=2] [ref=f2e177]
                - generic [ref=f2e178]:
                  - generic [ref=f2e179]:
                    - term [ref=f2e180]: Début
                    - definition [ref=f2e184]: mar. 22 déc. 2026 à 17:00
                  - generic [ref=f2e185]:
                    - term [ref=f2e186]: Fin
                    - definition [ref=f2e191]: mer. 23 déc. 2026 à 00:00
                  - generic [ref=f2e192]:
                    - term [ref=f2e193]: Lieu
                    - definition [ref=f2e198]: Parc de la Promenade, Kaolack
                  - generic [ref=f2e199]:
                    - term [ref=f2e200]: Jauge déclarée
                    - definition [ref=f2e207]: 1 000 personnes
                - generic [ref=f2e208]:
                  - 'region "Carte : Parc de la Promenade" [ref=f2e209]':
                    - generic:
                      - 'img "Emplacement : Parc de la Promenade" [ref=f2e210] [cursor=pointer]'
                      - generic [ref=f2e211]:
                        - strong [ref=f2e214]: Parc de la Promenade
                        - button "Fermer la bulle" [ref=f2e216] [cursor=pointer]: ×
                    - generic:
                      - generic [ref=f2e217]:
                        - button "Zoom avant" [ref=f2e218] [cursor=pointer]: +
                        - button "Zoom arrière" [ref=f2e219] [cursor=pointer]: −
                      - generic: © contributeurs OpenStreetMap
                  - link "Voir l’itinéraire" [ref=f2e221] [cursor=pointer]:
                    - /url: https://www.google.com/maps/dir/?api=1&destination=14.144,-16.066
                - generic [ref=f2e231]:
                  - generic [ref=f2e232]:
                    - term [ref=f2e233]: Adresse
                    - definition [ref=f2e234]: Parc de la Promenade, Kaolack
                  - generic [ref=f2e235]:
                    - term [ref=f2e236]: Stationnement
                    - definition [ref=f2e237]: Stationnement surveillé à proximité.
                  - generic [ref=f2e238]:
                    - term [ref=f2e239]: Règlement
                    - definition [ref=f2e240]: Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.
              - region [ref=f2e241]:
                - heading "Description" [level=2] [ref=f2e242]
                - paragraph [ref=f2e243]: Deux jours de concerts gratuits pour les moins de douze ans, scène jeunes talents et village associatif.
              - region [ref=f2e244]:
                - heading "Programme" [level=2] [ref=f2e245]
                - list [ref=f2e246]:
                  - listitem [ref=f2e247]:
                    - generic [ref=f2e248]: 17:00
                    - generic [ref=f2e250]:
                      - generic [ref=f2e251]: Scène jeunes talents
                      - generic [ref=f2e252]: Artiste
                  - listitem [ref=f2e254]:
                    - generic [ref=f2e255]: 20:00
                    - generic [ref=f2e256]:
                      - generic [ref=f2e257]:
                        - generic [ref=f2e258]: Tête d’affiche
                        - generic [ref=f2e259]: Artiste
                      - paragraph [ref=f2e261]: Orchestre du Sine
              - region [ref=f2e262]:
                - heading "Catégories et prix" [level=2] [ref=f2e263]
                - table [ref=f2e266]:
                  - caption [ref=f2e267]: Catégories de billets, tous canaux et inactives comprises
                  - rowgroup [ref=f2e268]:
                    - row [ref=f2e269]:
                      - columnheader "Catégorie" [ref=f2e270]
                      - columnheader "Prix" [ref=f2e271]
                      - columnheader "Quota" [ref=f2e272]
                      - columnheader "Période de vente" [ref=f2e273]
                      - columnheader "Par commande" [ref=f2e274]
                      - columnheader "Au contrôle" [ref=f2e275]
                      - columnheader "Canaux et état" [ref=f2e276]
                  - rowgroup [ref=f2e277]:
                    - row [ref=f2e278]:
                      - cell "Pass journée Une journée." [ref=f2e279]:
                        - generic [ref=f2e280]:
                          - generic [ref=f2e281]: Pass journée
                          - generic [ref=f2e282]: Une journée.
                      - cell "3 000 F CFA" [ref=f2e283]
                      - cell "800" [ref=f2e284]
                      - cell "Du sam. 7 nov. 2026 à 10:34 · jusqu’à l’événement" [ref=f2e285]
                      - cell "10 au plus" [ref=f2e287]
                      - cell "Blanc Aucune consigne" [ref=f2e288]:
                        - generic [ref=f2e289]:
                          - generic [ref=f2e290]: Blanc
                          - generic [ref=f2e293]: Aucune consigne
                      - cell "En ligne et au guichet Active" [ref=f2e294]:
                        - generic [ref=f2e295]:
                          - generic [ref=f2e296]: En ligne et au guichet
                          - generic [ref=f2e298]: Active
                    - row [ref=f2e300]:
                      - cell "Pass deux jours Les deux journées." [ref=f2e301]:
                        - generic [ref=f2e302]:
                          - generic [ref=f2e303]: Pass deux jours
                          - generic [ref=f2e304]: Les deux journées.
                      - cell "5 000 F CFA" [ref=f2e305]
                      - cell "200" [ref=f2e306]
                      - cell "Du sam. 7 nov. 2026 à 10:34 · jusqu’à l’événement" [ref=f2e307]
                      - cell "10 au plus" [ref=f2e309]
                      - cell "Noir Aucune consigne" [ref=f2e310]:
                        - generic [ref=f2e311]:
                          - generic [ref=f2e312]: Noir
                          - generic [ref=f2e315]: Aucune consigne
                      - cell "En ligne et au guichet Active" [ref=f2e316]:
                        - generic [ref=f2e317]:
                          - generic [ref=f2e318]: En ligne et au guichet
                          - generic [ref=f2e320]: Active
              - region [ref=f2e322]:
                - heading "Contrôle à l’entrée" [level=2] [ref=f2e323]
                - paragraph [ref=f2e324]: "Une seule entrée : chaque contrôleur laisse entrer toutes les catégories."
            - generic [ref=f2e325]:
              - region [ref=f2e326]:
                - heading "Affiche" [level=2] [ref=f2e327]
                - img "Affiche de « Festival des musiques du Saloum »" [ref=f2e328]
              - region [ref=f2e329]:
                - heading "Organisateur" [level=2] [ref=f2e330]
                - generic [ref=f2e331]:
                  - generic [ref=f2e332]:
                    - term [ref=f2e333]: Structure
                    - definition [ref=f2e339]:
                      - text: Sine-Saloum Culture & Loisirs
                      - generic [ref=f2e340]: Saloum Culture
                      - generic [ref=f2e341]: Compte validé
                  - generic [ref=f2e344]:
                    - term [ref=f2e345]: Responsable
                    - definition [ref=f2e352]: Ousmane Faye
                  - generic [ref=f2e353]:
                    - term [ref=f2e354]: Téléphone
                    - definition [ref=f2e358]:
                      - link "+221700000102" [ref=f2e359] [cursor=pointer]:
                        - /url: tel:+221700000102
                  - generic [ref=f2e360]:
                    - term [ref=f2e361]: Email
                    - definition [ref=f2e366]:
                      - link "ousmane.faye@demo.eventvillage.local" [ref=f2e367] [cursor=pointer]:
                        - /url: mailto:ousmane.faye@demo.eventvillage.local
                  - generic [ref=f2e368]:
                    - term [ref=f2e369]: Ville
                    - definition [ref=f2e374]: Kaolack
              - region [ref=f2e375]:
                - heading "Historique des statuts" [level=2] [ref=f2e376]
                - list [ref=f2e377]:
                  - listitem [ref=f2e378]:
                    - paragraph [ref=f2e380]: Brouillon → En attente de validation
                    - paragraph [ref=f2e381]: Ousmane Faye (Partenaire) · Changement de statut
                    - paragraph [ref=f2e382]:
                      - time [ref=f2e383]: jeu. 19 nov. 2026 à 10:34
                  - listitem [ref=f2e384]:
                    - paragraph [ref=f2e386]: "Création : Brouillon"
                    - paragraph [ref=f2e387]: Ousmane Faye (Partenaire) · Création
                    - paragraph [ref=f2e388]:
                      - time [ref=f2e389]: jeu. 19 nov. 2026 à 10:34
  - alert [ref=f2e390]
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
      |                                                                                        ^ Error: contrôles responsive de adm-evenement (sombre)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```