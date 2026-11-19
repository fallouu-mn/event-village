# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · fumee-superadmin >> adm-evenement — Fiche d’un événement à valider
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de adm-evenement (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 9

- Array []
+ Array [
+   "320 px : texte tronqué sans le texte entier : small.text-caption.max-w-full « Validation » (points de suspension, texte entier absent)",
+   "768 px : texte coupé : span « En ligne et au guichet » dépasse de div.hidden.overflow-hidden «  » ; span « En ligne et au guichet » dépasse de div.hidden.overflow-hidden «  »",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "1024 px : texte coupé : th.px-4.py-3 « Par commande » dépasse de div.hidden.overflow-hidden «  » ; th.px-4.py-3 « Au contrôle » dépasse de div.hidden.overflow-hidden «  » ; th.px-4.py-3 « Canaux et état » dépasse de div.hidden.overflow-hidden «  » ; span.tabular-nums « 10 au plus » dépasse de div.hidden.overflow-hidden «  » ; span « Blanc » dépasse de div.hidden.overflow-hidden «  » ; span.text-muted-foreground « Aucune consigne » dépasse de div.hidden.overflow-hidden «  » ; span « En ligne et au guichet » dépasse de div.hidden.overflow-hidden «  » ; span « Active » dépasse de div.hidden.overflow-hidden «  » ; span.tabular-nums « 10 au plus » dépasse de div.hidden.overflow-hidden «  » ; span « Noir » dépasse de div.hidden.overflow-hidden «  » ; span.text-muted-foreground « Aucune consigne » dépasse de div.hidden.overflow-hidden «  » ; span « En ligne et au guichet » dépasse de div.hidden.overflow-hidden «  »",
+   "1024 px : texte tronqué sans le texte entier : span.block.truncate « Elhadji SuperAdmin » (points de suspension, texte entier absent) ; span.block.truncate « Superadmin » (points de suspension, texte entier absent)",
+   "1440 px : texte coupé : span « En ligne et au guichet » dépasse de div.hidden.overflow-hidden «  » ; span « En ligne et au guichet » dépasse de div.hidden.overflow-hidden «  »",
+   "1440 px : texte tronqué sans le texte entier : span.block.truncate « Elhadji SuperAdmin » (points de suspension, texte entier absent)",
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
        - generic [ref=f5e10]: Administration
        - link "Tableau de bord" [ref=f5e15] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=f5e22]:
          - paragraph [ref=f5e23]: Gestion
          - generic [ref=f5e24]:
            - link "Événements" [ref=f5e25] [cursor=pointer]:
              - /url: /admin/events
            - link "Comptes" [ref=f5e29] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=f5e36] [cursor=pointer]:
              - /url: /admin/services
        - generic [ref=f5e42]:
          - paragraph [ref=f5e43]: Finances
          - link "Finance" [ref=f5e45] [cursor=pointer]:
            - /url: /admin/finance
        - generic [ref=f5e49]:
          - paragraph [ref=f5e50]: Engagement
          - generic [ref=f5e51]:
            - link "Parrainage" [ref=f5e52] [cursor=pointer]:
              - /url: /admin/referral
            - link "Campagnes" [ref=f5e57] [cursor=pointer]:
              - /url: /admin/communications
            - link "À la une" [ref=f5e62] [cursor=pointer]:
              - /url: /admin/a-la-une
        - generic [ref=f5e66]:
          - paragraph [ref=f5e67]: Système
          - generic [ref=f5e68]:
            - link "Réglages" [ref=f5e69] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Journal d’audit" [ref=f5e74] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=f5e79] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=f5e86] [cursor=pointer]:
              - /url: /scan
            - link "Sécurité du compte" [ref=f5e94] [cursor=pointer]:
              - /url: /admin/securite
        - link "Retour au site" [ref=f5e100] [cursor=pointer]:
          - /url: /
      - generic [ref=f5e105]:
        - link "Elhadji SuperAdmin Superadmin" [ref=f5e106] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f5e107]: ES
          - generic [ref=f5e108]:
            - generic [ref=f5e109]: Elhadji SuperAdmin
            - generic [ref=f5e110]: Superadmin
        - generic [ref=f5e111]:
          - button "Se déconnecter" [ref=f5e112] [cursor=pointer]
          - button "Basculer le thème" [ref=f5e117] [cursor=pointer]
    - generic [ref=f5e121]:
      - banner [ref=f5e122]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f5e124] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 58 non lues" [ref=f5e131] [cursor=pointer]:
          - generic [ref=f5e135]: "58"
      - main [ref=f5e136]:
        - generic [ref=f5e138]:
          - generic [ref=f5e139]:
            - link "Retour aux événements" [ref=f5e141] [cursor=pointer]:
              - /url: /admin/events
            - generic [ref=f5e146]:
              - generic [ref=f5e147]:
                - generic [ref=f5e148]:
                  - generic "Soumis à l’équipe Event Village, qui vérifie la fiche avant validation." [ref=f5e149]: En attente de validation
                  - generic [ref=f5e152]: Festivals
                - heading "Festival des musiques du Saloum" [level=1] [ref=f5e153]
                - paragraph [ref=f5e154]: Sine-Saloum Culture & Loisirs · mar. 22 déc. 2026 à 17:00
              - generic [ref=f5e155]:
                - button "Refuser" [ref=f5e156] [cursor=pointer]
                - button "Valider" [ref=f5e158] [cursor=pointer]
                - link "Ouvrir le pilotage" [ref=f5e160] [cursor=pointer]:
                  - /url: /partner/events/df93422e-6d27-4e16-8ac3-eb759df0ebb5
                - link "Équipe de cet événement" [ref=f5e166] [cursor=pointer]:
                  - /url: /partner/events/df93422e-6d27-4e16-8ac3-eb759df0ebb5?tab=equipe
          - generic [ref=f5e174]:
            - generic [ref=f5e175]:
              - region [ref=f5e176]:
                - heading "Dates et lieu" [level=2] [ref=f5e177]
                - generic [ref=f5e178]:
                  - generic [ref=f5e179]:
                    - term [ref=f5e180]: Début
                    - definition [ref=f5e184]: mar. 22 déc. 2026 à 17:00
                  - generic [ref=f5e185]:
                    - term [ref=f5e186]: Fin
                    - definition [ref=f5e191]: mer. 23 déc. 2026 à 00:00
                  - generic [ref=f5e192]:
                    - term [ref=f5e193]: Lieu
                    - definition [ref=f5e198]: Parc de la Promenade, Kaolack
                  - generic [ref=f5e199]:
                    - term [ref=f5e200]: Jauge déclarée
                    - definition [ref=f5e207]: 1 000 personnes
                - generic [ref=f5e208]:
                  - 'region "Carte : Parc de la Promenade" [ref=f5e209]':
                    - generic:
                      - 'img "Emplacement : Parc de la Promenade" [ref=f5e210] [cursor=pointer]'
                      - generic [ref=f5e211]:
                        - strong [ref=f5e214]: Parc de la Promenade
                        - button "Fermer la bulle" [ref=f5e216] [cursor=pointer]: ×
                    - generic:
                      - generic [ref=f5e217]:
                        - button "Zoom avant" [ref=f5e218] [cursor=pointer]: +
                        - button "Zoom arrière" [ref=f5e219] [cursor=pointer]: −
                      - generic: © contributeurs OpenStreetMap
                  - link "Voir l’itinéraire" [ref=f5e221] [cursor=pointer]:
                    - /url: https://www.google.com/maps/dir/?api=1&destination=14.144,-16.066
                - generic [ref=f5e231]:
                  - generic [ref=f5e232]:
                    - term [ref=f5e233]: Adresse
                    - definition [ref=f5e234]: Parc de la Promenade, Kaolack
                  - generic [ref=f5e235]:
                    - term [ref=f5e236]: Stationnement
                    - definition [ref=f5e237]: Stationnement surveillé à proximité.
                  - generic [ref=f5e238]:
                    - term [ref=f5e239]: Règlement
                    - definition [ref=f5e240]: Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.
              - region [ref=f5e241]:
                - heading "Description" [level=2] [ref=f5e242]
                - paragraph [ref=f5e243]: Deux jours de concerts gratuits pour les moins de douze ans, scène jeunes talents et village associatif.
              - region [ref=f5e244]:
                - heading "Programme" [level=2] [ref=f5e245]
                - list [ref=f5e246]:
                  - listitem [ref=f5e247]:
                    - generic [ref=f5e248]: 17:00
                    - generic [ref=f5e250]:
                      - generic [ref=f5e251]: Scène jeunes talents
                      - generic [ref=f5e252]: Artiste
                  - listitem [ref=f5e254]:
                    - generic [ref=f5e255]: 20:00
                    - generic [ref=f5e256]:
                      - generic [ref=f5e257]:
                        - generic [ref=f5e258]: Tête d’affiche
                        - generic [ref=f5e259]: Artiste
                      - paragraph [ref=f5e261]: Orchestre du Sine
              - region [ref=f5e262]:
                - heading "Catégories et prix" [level=2] [ref=f5e263]
                - table [ref=f5e266]:
                  - caption [ref=f5e267]: Catégories de billets, tous canaux et inactives comprises
                  - rowgroup [ref=f5e268]:
                    - row [ref=f5e269]:
                      - columnheader "Catégorie" [ref=f5e270]
                      - columnheader "Prix" [ref=f5e271]
                      - columnheader "Quota" [ref=f5e272]
                      - columnheader "Période de vente" [ref=f5e273]
                      - columnheader "Par commande" [ref=f5e274]
                      - columnheader "Au contrôle" [ref=f5e275]
                      - columnheader "Canaux et état" [ref=f5e276]
                  - rowgroup [ref=f5e277]:
                    - row [ref=f5e278]:
                      - cell "Pass journée Une journée." [ref=f5e279]:
                        - generic [ref=f5e280]:
                          - generic [ref=f5e281]: Pass journée
                          - generic [ref=f5e282]: Une journée.
                      - cell "3 000 F CFA" [ref=f5e283]
                      - cell "800" [ref=f5e284]
                      - cell "Du sam. 7 nov. 2026 à 10:34 · jusqu’à l’événement" [ref=f5e285]
                      - cell "10 au plus" [ref=f5e287]
                      - cell "Blanc Aucune consigne" [ref=f5e288]:
                        - generic [ref=f5e289]:
                          - generic [ref=f5e290]: Blanc
                          - generic [ref=f5e293]: Aucune consigne
                      - cell "En ligne et au guichet Active" [ref=f5e294]:
                        - generic [ref=f5e295]:
                          - generic [ref=f5e296]: En ligne et au guichet
                          - generic [ref=f5e298]: Active
                    - row [ref=f5e300]:
                      - cell "Pass deux jours Les deux journées." [ref=f5e301]:
                        - generic [ref=f5e302]:
                          - generic [ref=f5e303]: Pass deux jours
                          - generic [ref=f5e304]: Les deux journées.
                      - cell "5 000 F CFA" [ref=f5e305]
                      - cell "200" [ref=f5e306]
                      - cell "Du sam. 7 nov. 2026 à 10:34 · jusqu’à l’événement" [ref=f5e307]
                      - cell "10 au plus" [ref=f5e309]
                      - cell "Noir Aucune consigne" [ref=f5e310]:
                        - generic [ref=f5e311]:
                          - generic [ref=f5e312]: Noir
                          - generic [ref=f5e315]: Aucune consigne
                      - cell "En ligne et au guichet Active" [ref=f5e316]:
                        - generic [ref=f5e317]:
                          - generic [ref=f5e318]: En ligne et au guichet
                          - generic [ref=f5e320]: Active
              - region [ref=f5e322]:
                - heading "Contrôle à l’entrée" [level=2] [ref=f5e323]
                - paragraph [ref=f5e324]: "Une seule entrée : chaque contrôleur laisse entrer toutes les catégories."
            - generic [ref=f5e325]:
              - region [ref=f5e326]:
                - heading "Affiche" [level=2] [ref=f5e327]
                - img "Affiche de « Festival des musiques du Saloum »" [ref=f5e328]
              - region [ref=f5e329]:
                - heading "Organisateur" [level=2] [ref=f5e330]
                - generic [ref=f5e331]:
                  - generic [ref=f5e332]:
                    - term [ref=f5e333]: Structure
                    - definition [ref=f5e339]:
                      - text: Sine-Saloum Culture & Loisirs
                      - generic [ref=f5e340]: Saloum Culture
                      - generic [ref=f5e341]: Compte validé
                  - generic [ref=f5e344]:
                    - term [ref=f5e345]: Responsable
                    - definition [ref=f5e352]: Ousmane Faye
                  - generic [ref=f5e353]:
                    - term [ref=f5e354]: Téléphone
                    - definition [ref=f5e358]:
                      - link "+221700000102" [ref=f5e359] [cursor=pointer]:
                        - /url: tel:+221700000102
                  - generic [ref=f5e360]:
                    - term [ref=f5e361]: Email
                    - definition [ref=f5e366]:
                      - link "ousmane.faye@demo.eventvillage.local" [ref=f5e367] [cursor=pointer]:
                        - /url: mailto:ousmane.faye@demo.eventvillage.local
                  - generic [ref=f5e368]:
                    - term [ref=f5e369]: Ville
                    - definition [ref=f5e374]: Kaolack
              - region [ref=f5e375]:
                - heading "Historique des statuts" [level=2] [ref=f5e376]
                - list [ref=f5e377]:
                  - listitem [ref=f5e378]:
                    - paragraph [ref=f5e380]: Brouillon → En attente de validation
                    - paragraph [ref=f5e381]: Ousmane Faye (Partenaire) · Changement de statut
                    - paragraph [ref=f5e382]:
                      - time [ref=f5e383]: jeu. 19 nov. 2026 à 10:34
                  - listitem [ref=f5e384]:
                    - paragraph [ref=f5e386]: "Création : Brouillon"
                    - paragraph [ref=f5e387]: Ousmane Faye (Partenaire) · Création
                    - paragraph [ref=f5e388]:
                      - time [ref=f5e389]: jeu. 19 nov. 2026 à 10:34
  - alert [ref=f5e390]
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
      |                                                                                        ^ Error: contrôles responsive de adm-evenement (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```