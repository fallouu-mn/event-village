# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · admin >> adm-mes-droits — Mes droits
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de adm-mes-droits (sombre)

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
        - generic [ref=f2e10]: Administration
        - link "Tableau de bord" [ref=f2e15] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=f2e22]:
          - paragraph [ref=f2e23]: Gestion
          - generic [ref=f2e24]:
            - link "Événements" [ref=f2e25] [cursor=pointer]:
              - /url: /admin/events
            - link "Catalogues et services" [ref=f2e29] [cursor=pointer]:
              - /url: /admin/services
        - generic [ref=f2e35]:
          - paragraph [ref=f2e36]: Engagement
          - link "Campagnes" [ref=f2e38] [cursor=pointer]:
            - /url: /admin/communications
        - generic [ref=f2e43]:
          - paragraph [ref=f2e44]: Système
          - generic [ref=f2e45]:
            - link "Réglages" [ref=f2e46] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Notifications" [ref=f2e51] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Mes droits" [ref=f2e58] [cursor=pointer]:
              - /url: /admin/mes-droits
        - link "Retour au site" [ref=f2e64] [cursor=pointer]:
          - /url: /
      - generic [ref=f2e69]:
        - link "Aïda Diallo Administrateur" [ref=f2e70] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e71]: AD
          - generic [ref=f2e72]:
            - generic [ref=f2e73]: Aïda Diallo
            - generic [ref=f2e74]: Administrateur
        - generic [ref=f2e75]:
          - button "Se déconnecter" [ref=f2e76] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e81] [cursor=pointer]
    - generic [ref=f2e85]:
      - banner [ref=f2e86]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f2e88] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 40 non lues" [ref=f2e95] [cursor=pointer]:
          - generic [ref=f2e99]: "40"
      - main [ref=f2e100]:
        - generic [ref=f2e102]:
          - generic [ref=f2e103]:
            - link "Accueil" [ref=f2e105] [cursor=pointer]:
              - /url: /admin/dashboard
            - generic [ref=f2e111]:
              - heading "Mes droits" [level=1] [ref=f2e112]
              - paragraph [ref=f2e113]: Voici ce que votre compte peut faire. Pour un droit de plus, demandez-le au Superadmin.
          - region [ref=f2e114]:
            - heading "Vous pouvez" [level=2] [ref=f2e115]
            - list [ref=f2e116]:
              - listitem [ref=f2e117]:
                - generic [ref=f2e121]:
                  - paragraph [ref=f2e122]: Consulter les événements
                  - paragraph [ref=f2e123]: Voir les événements, leur pilotage, leurs équipes, leurs caisses et les catalogues.
              - listitem [ref=f2e124]:
                - generic [ref=f2e128]:
                  - paragraph [ref=f2e129]: Gérer les événements
                  - paragraph [ref=f2e130]: Valider, refuser, suspendre, réactiver, clore ou annuler un événement ; valider un écart de caisse.
              - listitem [ref=f2e131]:
                - generic [ref=f2e135]:
                  - paragraph [ref=f2e136]: Gérer les communications
                  - paragraph [ref=f2e137]: Préparer des campagnes (brouillons seulement).
              - listitem [ref=f2e138]:
                - generic [ref=f2e142]:
                  - paragraph [ref=f2e143]: Consulter les envois de messages
                  - paragraph [ref=f2e144]: Voir les envois de SMS, d’emails et de notifications, et recevoir leurs alertes.
              - listitem [ref=f2e145]:
                - generic [ref=f2e149]:
                  - paragraph [ref=f2e150]: Relancer les envois de messages
                  - paragraph [ref=f2e151]: Relancer un envoi en échec.
              - listitem [ref=f2e152]:
                - generic [ref=f2e156]:
                  - paragraph [ref=f2e157]: Lire les réglages
                  - paragraph [ref=f2e158]: Lire les réglages de la plateforme ; seul le Superadmin les change.
          - region [ref=f2e159]:
            - heading "Vous ne pouvez pas" [level=2] [ref=f2e160]
            - list [ref=f2e161]:
              - listitem [ref=f2e162]:
                - generic [ref=f2e165]:
                  - paragraph [ref=f2e166]: Consulter les comptes
                  - paragraph [ref=f2e167]: Voir la liste des comptes et les chercher.
              - listitem [ref=f2e168]:
                - generic [ref=f2e171]:
                  - paragraph [ref=f2e172]: Gérer les comptes
                  - paragraph [ref=f2e173]: Créer, suspendre, réactiver ou supprimer des comptes de clients et de contrôleurs, jamais un administrateur.
              - listitem [ref=f2e174]:
                - generic [ref=f2e177]:
                  - paragraph [ref=f2e178]: Consulter les partenaires et leurs contacts
                  - paragraph [ref=f2e179]: "Voir les candidatures et les dossiers des partenaires : pièces, NINEA, contacts."
              - listitem [ref=f2e180]:
                - generic [ref=f2e183]:
                  - paragraph [ref=f2e184]: Valider les partenaires
                  - paragraph [ref=f2e185]: Valider, refuser ou réactiver un partenaire. Le partenaire en est prévenu.
              - listitem [ref=f2e186]:
                - generic [ref=f2e189]:
                  - paragraph [ref=f2e190]: Suspendre les partenaires
                  - paragraph [ref=f2e191]: "Suspendre un partenaire. Attention : seul le Superadmin peut le faire, ce droit ne suffit pas à un administrateur."
              - listitem [ref=f2e192]:
                - generic [ref=f2e195]:
                  - paragraph [ref=f2e196]: Consulter les paiements
                  - paragraph [ref=f2e197]: "Voir la finance : ce que gagne Event Village, ce qui est dû, les paiements et les créances."
              - listitem [ref=f2e198]:
                - generic [ref=f2e201]:
                  - paragraph [ref=f2e202]: Gérer les remboursements
                  - paragraph [ref=f2e203]: "Traiter les versements à reprendre : renvoyer, marquer versé ou constater non versé."
              - listitem [ref=f2e204]:
                - generic [ref=f2e207]:
                  - paragraph [ref=f2e208]: Gérer le parrainage
                  - paragraph [ref=f2e209]: Voir les taux du parrainage.
              - listitem [ref=f2e210]:
                - generic [ref=f2e213]:
                  - paragraph [ref=f2e214]: Consulter les statistiques
                  - paragraph [ref=f2e215]: "Voir les indicateurs de l’accueil : volume, revenu, nombre de comptes."
              - listitem [ref=f2e216]:
                - generic [ref=f2e219]:
                  - paragraph [ref=f2e220]: Contrôler les entrées et tenir une caisse
                  - paragraph [ref=f2e221]: Contrôler les entrées et tenir une caisse sur un événement.
  - alert [ref=f2e222]
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
      |                                                                                        ^ Error: contrôles responsive de adm-mes-droits (sombre)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```