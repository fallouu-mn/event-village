# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · partenaire-premiers-pas >> org-premiers-pas — Tableau de bord sans événement
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de org-premiers-pas (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
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
            - link "Équipe" [ref=f2e24] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=f2e31]:
          - paragraph [ref=f2e32]: Outils
          - generic [ref=f2e33]:
            - link "Finances" [ref=f2e34] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=f2e38] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=f2e42] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=f2e50] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=f2e54] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=f2e59] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=f2e65] [cursor=pointer]:
          - /url: /
      - generic [ref=f2e71]:
        - link "Ndèye Gning Partenaire" [ref=f2e72] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e73]: NG
          - generic [ref=f2e74]:
            - generic [ref=f2e75]: Ndèye Gning
            - generic [ref=f2e76]: Partenaire
        - generic [ref=f2e77]:
          - button "Se déconnecter" [ref=f2e78] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e83] [cursor=pointer]
    - generic [ref=f2e87]:
      - banner [ref=f2e88]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f2e90] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 1 non lue" [ref=f2e97] [cursor=pointer]:
          - generic [ref=f2e101]: "1"
      - main [ref=f2e102]:
        - generic [ref=f2e104]:
          - generic [ref=f2e106]:
            - generic [ref=f2e107]:
              - generic [ref=f2e108]: Espace partenaire
              - heading "Teranga Découvertes" [level=1] [ref=f2e110]
              - paragraph [ref=f2e111]: Ventes, entrées et solde de vos événements.
            - generic [ref=f2e112]:
              - button "Actualiser" [ref=f2e113] [cursor=pointer]
              - link "Export comptable" [ref=f2e121] [cursor=pointer]:
                - /url: /api/partner/reports/accounting?format=csv
              - link "Scanner des billets" [ref=f2e125] [cursor=pointer]:
                - /url: /partner/scan
          - status [ref=f2e134]:
            - generic [ref=f2e140]:
              - paragraph [ref=f2e141]: Période d’essai gratuite en cours
              - generic [ref=f2e142]:
                - text: 90 jours offerts, jusqu’au
                - time [ref=f2e143]: lun. 15 févr. 2027
                - text: .
          - region [ref=f2e144]:
            - generic [ref=f2e145]:
              - generic [ref=f2e153]:
                - heading "Publiez votre premier événement" [level=2] [ref=f2e154]
                - paragraph [ref=f2e155]: "Votre compte est validé. Suivez ces étapes : elles se cochent toutes seules à mesure que vous avancez."
                - paragraph [ref=f2e156]: 0 étape franchie sur 8
              - link "Créer un événement" [ref=f2e157] [cursor=pointer]:
                - /url: /partner/events/new
            - list [ref=f2e162]:
              - listitem [ref=f2e163]:
                - generic [ref=f2e167]:
                  - 'link "Compléter votre page publique : étape à faire" [ref=f2e168] [cursor=pointer]':
                    - /url: /partner/profile
                    - text: Compléter votre page publique
                    - generic [ref=f2e169]: ": étape à faire"
                  - paragraph [ref=f2e170]: "Description et logo : ce que vos clients voient de votre organisation. Facultatif."
              - listitem [ref=f2e171]:
                - generic [ref=f2e175]:
                  - 'link "Créer l’événement : étape à faire" [ref=f2e176] [cursor=pointer]':
                    - /url: /partner/events/new
                    - text: Créer l’événement
                    - generic [ref=f2e177]: ": étape à faire"
                  - paragraph [ref=f2e178]: Il reste en brouillon, visible de vous seul, jusqu’à sa soumission.
              - listitem [ref=f2e179]:
                - generic [ref=f2e183]:
                  - 'link "Ajouter l’affiche : étape à faire" [ref=f2e184] [cursor=pointer]':
                    - /url: /partner/events/new
                    - text: Ajouter l’affiche
                    - generic [ref=f2e185]: ": étape à faire"
                  - paragraph [ref=f2e186]: Une image est obligatoire pour soumettre l’événement.
              - listitem [ref=f2e187]:
                - generic [ref=f2e191]:
                  - 'link "Ajouter une catégorie de billets : étape à faire" [ref=f2e192] [cursor=pointer]':
                    - /url: /partner/events/new
                    - text: Ajouter une catégorie de billets
                    - generic [ref=f2e193]: ": étape à faire"
                  - paragraph [ref=f2e194]: Au moins une catégorie active, avec son prix et sa quantité.
              - listitem [ref=f2e195]:
                - generic [ref=f2e199]:
                  - 'link "Soumettre à la validation : étape à faire" [ref=f2e200] [cursor=pointer]':
                    - /url: /partner/events/new
                    - text: Soumettre à la validation
                    - generic [ref=f2e201]: ": étape à faire"
                  - paragraph [ref=f2e202]: L’équipe Event Village vérifie l’événement avant sa mise en ligne.
              - listitem [ref=f2e203]:
                - generic [ref=f2e207]:
                  - 'link "Validation par Event Village : étape à faire" [ref=f2e208] [cursor=pointer]':
                    - /url: /partner/events/new
                    - text: Validation par Event Village
                    - generic [ref=f2e209]: ": étape à faire"
                  - paragraph [ref=f2e210]: Vous recevez un SMS et une notification dès que l’événement est validé.
              - listitem [ref=f2e211]:
                - generic [ref=f2e215]:
                  - 'link "Publier l’événement : étape à faire" [ref=f2e216] [cursor=pointer]':
                    - /url: /partner/events/new
                    - text: Publier l’événement
                    - generic [ref=f2e217]: ": étape à faire"
                  - paragraph [ref=f2e218]: "La billetterie s’ouvre : vos clients peuvent acheter leurs billets."
              - listitem [ref=f2e219]:
                - generic [ref=f2e223]:
                  - 'link "Inviter vos contrôleurs : étape à faire" [ref=f2e224] [cursor=pointer]':
                    - /url: /partner/team
                    - text: Inviter vos contrôleurs
                    - generic [ref=f2e225]: ": étape à faire"
                  - paragraph [ref=f2e226]: Ils scannent les billets à l’entrée le jour de l’événement. Facultatif.
          - region [ref=f2e227]:
            - heading "Indicateurs" [level=2] [ref=f2e228]
            - generic [ref=f2e229]:
              - generic [ref=f2e230]:
                - paragraph [ref=f2e232]: Ventes en ligne
                - paragraph [ref=f2e237]: 0 F CFA
                - paragraph [ref=f2e238]: Prix des billets vendus en ligne, tous événements.
              - generic [ref=f2e239]:
                - paragraph [ref=f2e241]: Net partenaire
                - paragraph [ref=f2e246]: 0 F CFA
                - paragraph [ref=f2e247]: Après 0 F CFA de remboursements.
              - generic [ref=f2e248]:
                - paragraph [ref=f2e250]: Billets vendus
                - paragraph [ref=f2e254]: "0"
                - paragraph [ref=f2e255]: 0 entrées validées aux portes.
              - generic [ref=f2e256]:
                - paragraph [ref=f2e258]: Disponible au retrait
                - paragraph [ref=f2e263]: 0 F CFA
                - paragraph [ref=f2e264]: "Déjà versé : 0 F CFA."
            - paragraph [ref=f2e265]:
              - text: Les ventes en espèces au guichet (0 F CFA) et les invitations n’alimentent pas le solde.
              - link "Voir mes finances" [ref=f2e266] [cursor=pointer]:
                - /url: /partner/finance
          - region [ref=f2e268]:
            - generic [ref=f2e269]:
              - generic [ref=f2e270]:
                - heading "Mes événements" [level=2] [ref=f2e271]
                - generic [ref=f2e274]: 0 au total
              - link "Tous mes événements" [ref=f2e276] [cursor=pointer]:
                - /url: /partner/events
            - generic [ref=f2e278]:
              - heading "Aucun événement pour le moment" [level=3] [ref=f2e282]
              - paragraph [ref=f2e283]: "Créez votre premier événement : il restera en brouillon jusqu’à ce que vous le soumettiez à la validation."
              - link "Créer un événement" [ref=f2e284] [cursor=pointer]:
                - /url: /partner/events/new
          - region [ref=f2e287]:
            - heading "Activité récente" [level=2] [ref=f2e288]
            - generic [ref=f2e291]:
              - heading "Aucune opération récente" [level=3] [ref=f2e295]
              - paragraph [ref=f2e296]: Ventes, entrées validées et retraits apparaîtront ici.
  - alert [ref=f2e297]
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
      |                                                                                        ^ Error: contrôles responsive de org-premiers-pas (sombre)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```