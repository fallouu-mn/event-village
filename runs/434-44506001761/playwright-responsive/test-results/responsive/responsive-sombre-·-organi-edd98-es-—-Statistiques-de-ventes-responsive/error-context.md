# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · organisateur >> org-statistiques — Statistiques de ventes
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de org-statistiques (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 13

- Array []
+ Array [
+   "360 px : valeur technique affichée : BROUILLON ; PUBLIE ; VALIDE ; EN_ATTENTE ; TERMINE ; ANNULE — ex. texte : « BROUILLON » ; texte : « PUBLIE » ; texte : « VALIDE »",
+   "360 px : 5 cible(s) < 44 px : button « Aujourd'hui » 89×31 ; button « 7 derniers jours » 110×31 ; button « 30 derniers jours » 119×31 ; button « Mois en cours » 103×31 ; button « Personnalisé » 96×31",
+   "360 px : 50 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Données réelles isolées à votre espace … » (div.flex.items-center > div > p.text-xs.text-slate-500) ; 11 px « Aujourd'hui » (div.space-y-2 > div.flex.gap-1.5 > button.px-3.py-1.5) ; 11 px « 7 derniers jours » (div.space-y-2 > div.flex.gap-1.5 > button.px-3.py-1.5) ; 11 px « 30 derniers jours » (div.space-y-2 > div.flex.gap-1.5 > button.px-3.py-1.5) ; 11 px « Mois en cours » (div.space-y-2 > div.flex.gap-1.5 > button.px-3.py-1.5)",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "768 px : valeur technique affichée : BROUILLON ; PUBLIE ; VALIDE ; EN_ATTENTE ; TERMINE ; ANNULE — ex. texte : « BROUILLON » ; texte : « PUBLIE » ; texte : « VALIDE »",
+   "768 px : 5 cible(s) < 44 px : button « Aujourd'hui » 89×31 ; button « 7 derniers jours » 110×31 ; button « 30 derniers jours » 119×31 ; button « Mois en cours » 103×31 ; button « Personnalisé » 96×31",
+   "768 px : 50 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Données réelles isolées à votre espace … » (div.flex.items-center > div > p.text-xs.text-slate-500) ; 11 px « Aujourd'hui » (div.space-y-2 > div.flex.gap-1.5 > button.px-3.py-1.5) ; 11 px « 7 derniers jours » (div.space-y-2 > div.flex.gap-1.5 > button.px-3.py-1.5) ; 11 px « 30 derniers jours » (div.space-y-2 > div.flex.gap-1.5 > button.px-3.py-1.5) ; 11 px « Mois en cours » (div.space-y-2 > div.flex.gap-1.5 > button.px-3.py-1.5)",
+   "1440 px : texte tronqué sans le texte entier : span.block.truncate « Mariama Ndiaye » (points de suspension, texte entier absent)",
+   "1440 px : valeur technique affichée : BROUILLON ; PUBLIE ; VALIDE ; EN_ATTENTE ; TERMINE ; ANNULE — ex. texte : « BROUILLON » ; texte : « PUBLIE » ; texte : « VALIDE »",
+   "1440 px : 5 cible(s) < 44 px : button « Aujourd'hui » 89×31 ; button « 7 derniers jours » 110×31 ; button « 30 derniers jours » 119×31 ; button « Mois en cours » 103×31 ; button « Personnalisé » 96×31",
+   "1440 px : 50 texte(s) < 14 px hors exemption (mentions et légendes admises exclues) : 12 px « Données réelles isolées à votre espace … » (div.flex.items-center > div > p.text-xs.text-slate-500) ; 11 px « Aujourd'hui » (div.space-y-2 > div.flex.gap-1.5 > button.px-3.py-1.5) ; 11 px « 7 derniers jours » (div.space-y-2 > div.flex.gap-1.5 > button.px-3.py-1.5) ; 11 px « 30 derniers jours » (div.space-y-2 > div.flex.gap-1.5 > button.px-3.py-1.5) ; 11 px « Mois en cours » (div.space-y-2 > div.flex.gap-1.5 > button.px-3.py-1.5)",
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
        - link "Mariama Ndiaye Partenaire" [ref=f2e72] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e73]: MN
          - generic [ref=f2e74]:
            - generic [ref=f2e75]: Mariama Ndiaye
            - generic [ref=f2e76]: Partenaire
        - generic [ref=f2e77]:
          - button "Se déconnecter" [ref=f2e78] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e83] [cursor=pointer]
    - generic [ref=f2e87]:
      - banner [ref=f2e88]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f2e90] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 99+ non lues" [ref=f2e97] [cursor=pointer]:
          - generic [ref=f2e101]: 99+
      - main [ref=f2e102]:
        - generic [ref=f2e104]:
          - generic [ref=f2e105]:
            - generic [ref=f2e106]:
              - heading "Statistiques" [level=1] [ref=f2e107]
              - paragraph [ref=f2e110]: Données réelles isolées à votre espace partenaire
            - button "Actualiser" [ref=f2e111] [cursor=pointer]
          - generic [ref=f2e120]:
            - button "Aujourd'hui" [ref=f2e121] [cursor=pointer]
            - button "7 derniers jours" [ref=f2e122] [cursor=pointer]
            - button "30 derniers jours" [ref=f2e123] [cursor=pointer]
            - button "Mois en cours" [ref=f2e124] [cursor=pointer]
            - button "Personnalisé" [ref=f2e125] [cursor=pointer]
          - generic [ref=f2e126]:
            - generic [ref=f2e132]:
              - generic [ref=f2e133]: CA Total
              - generic [ref=f2e134]: 828 000 F
            - generic [ref=f2e139]:
              - generic [ref=f2e140]: Billets vendus
              - generic [ref=f2e141]: "134"
            - generic [ref=f2e147]:
              - generic [ref=f2e148]: Commandes
              - generic [ref=f2e149]: "1"
            - generic [ref=f2e156]:
              - generic [ref=f2e157]: Réservations salles
              - generic [ref=f2e158]: "0"
          - generic [ref=f2e159]:
            - heading "Répartition des revenus" [level=2] [ref=f2e160]
            - generic [ref=f2e161]:
              - generic [ref=f2e162]:
                - generic [ref=f2e167]:
                  - generic [ref=f2e168]: Billetterie
                  - generic [ref=f2e169]: 828 000 FCFA
                - generic [ref=f2e172]: 100%
              - generic [ref=f2e173]:
                - generic [ref=f2e179]:
                  - generic [ref=f2e180]: Commandes
                  - generic [ref=f2e181]: 0 FCFA
                - generic [ref=f2e184]: 0%
              - generic [ref=f2e185]:
                - generic [ref=f2e192]:
                  - generic [ref=f2e193]: Salles
                  - generic [ref=f2e194]: 0 FCFA
                - generic [ref=f2e197]: 0%
          - generic [ref=f2e198]:
            - generic [ref=f2e199]:
              - heading "Commandes par statut" [level=2] [ref=f2e200]
              - generic [ref=f2e201]: 1 au total
            - generic [ref=f2e204]:
              - generic [ref=f2e205]: CONFIRMEE
              - generic [ref=f2e208]: "1"
            - generic [ref=f2e209]:
              - text: "Panier moyen :"
              - generic [ref=f2e210]: 5 000 FCFA
              - text: "· Commandes livrées : 0"
          - generic [ref=f2e211]:
            - generic [ref=f2e212]:
              - heading "Événements" [level=2] [ref=f2e213]
              - generic [ref=f2e216]: "9"
              - generic [ref=f2e217]:
                - generic [ref=f2e218]:
                  - generic [ref=f2e219]: BROUILLON
                  - generic [ref=f2e220]: "1"
                - generic [ref=f2e221]:
                  - generic [ref=f2e222]: PUBLIE
                  - generic [ref=f2e223]: "4"
                - generic [ref=f2e224]:
                  - generic [ref=f2e225]: VALIDE
                  - generic [ref=f2e226]: "1"
                - generic [ref=f2e227]:
                  - generic [ref=f2e228]: EN_ATTENTE
                  - generic [ref=f2e229]: "1"
                - generic [ref=f2e230]:
                  - generic [ref=f2e231]: TERMINE
                  - generic [ref=f2e232]: "1"
                - generic [ref=f2e233]:
                  - generic [ref=f2e234]: ANNULE
                  - generic [ref=f2e235]: "1"
            - generic [ref=f2e236]:
              - heading "Billetterie" [level=2] [ref=f2e237]
              - generic [ref=f2e240]: 134 vendus
              - generic [ref=f2e241]:
                - generic [ref=f2e242]:
                  - generic [ref=f2e243]: Billets utilisés
                  - generic [ref=f2e244]: "71"
                - generic [ref=f2e245]:
                  - generic [ref=f2e246]: Revenus billetterie
                  - generic [ref=f2e247]: 828 000 FCFA
          - generic [ref=f2e248]:
            - heading "Catalogue Produits" [level=2] [ref=f2e249]
            - generic [ref=f2e255]:
              - generic [ref=f2e256]:
                - generic [ref=f2e257]: Total
                - generic [ref=f2e258]: "0"
              - generic [ref=f2e260]:
                - generic [ref=f2e261]: Disponibles
                - generic [ref=f2e262]: "0"
              - generic [ref=f2e264]:
                - generic [ref=f2e265]: Hors stock
                - generic [ref=f2e266]: "0"
  - alert [ref=f2e267]
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
      |                                                                                        ^ Error: contrôles responsive de org-statistiques (sombre)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```