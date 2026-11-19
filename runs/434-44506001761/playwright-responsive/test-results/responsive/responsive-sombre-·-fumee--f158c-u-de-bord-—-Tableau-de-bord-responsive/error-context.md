# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · fumee-superadmin >> adm-tableau-de-bord — Tableau de bord
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de adm-tableau-de-bord (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
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
          - generic [ref=f2e140]:
            - generic [ref=f2e141]:
              - heading "Tableau de bord" [level=1] [ref=f2e142]
              - paragraph [ref=f2e143]: Dossiers à traiter et vue d’ensemble de la plateforme.
            - generic [ref=f2e144]:
              - status [ref=f2e145]: Mis à jour à 10:45
              - button "Actualiser" [ref=f2e147] [cursor=pointer]
          - region [ref=f2e155]:
            - heading "À faire aujourd’hui" [level=2] [ref=f2e156]
            - list [ref=f2e157]:
              - listitem [ref=f2e158]:
                - paragraph [ref=f2e164]: "Argent qui attend : 2 versements à reprendre, aucune créance"
                - paragraph [ref=f2e165]: 40 950 F CFA attendus par des clients ou des partenaires depuis plus de 30 minutes.
                - link "Voir l’argent qui attend" [ref=f2e166] [cursor=pointer]:
                  - /url: "#argent-qui-attend"
              - listitem [ref=f2e171]:
                - paragraph [ref=f2e178]: 4 événements à valider
                - paragraph [ref=f2e179]: Le plus ancien attend depuis moins d’une heure.
                - link "Examiner les événements" [ref=f2e180] [cursor=pointer]:
                  - /url: /admin/events?status=EN_ATTENTE
              - listitem [ref=f2e185]:
                - paragraph [ref=f2e192]: 1 événement suspendu à décider
                - paragraph [ref=f2e193]: "1 à venir : réactivez-le ou annulez-le."
                - link "Voir les événements suspendus" [ref=f2e194] [cursor=pointer]:
                  - /url: /admin/events?status=SUSPENDU
              - listitem [ref=f2e199]:
                - paragraph [ref=f2e205]: 1 écart de caisse à valider
                - paragraph [ref=f2e206]: "Événement : « Nuit du Sabar — édition d’automne ». Recomptez l’argent avec le contrôleur avant de valider."
                - link "Voir la caisse" [ref=f2e207] [cursor=pointer]:
                  - /url: /partner/events/1b6b9b15-31a6-41c3-856d-f27700d91f21?tab=caisse
              - listitem [ref=f2e212]:
                - paragraph [ref=f2e217]: 1 envoi en échec aujourd’hui
                - paragraph [ref=f2e218]: SMS, emails ou notifications qui ne sont pas partis.
                - link "Voir les envois en échec" [ref=f2e219] [cursor=pointer]:
                  - /url: /admin/notifications?status=FAILED
            - list "À jour" [ref=f2e224]:
              - listitem [ref=f2e225]: "Candidatures de partenaires : aucune"
              - listitem [ref=f2e229]: "SMS optionnels : sous le seuil d’alerte"
          - region [ref=f2e234]:
            - heading "Argent qui attend" [level=2] [ref=f2e235]
            - list [ref=f2e236]:
              - listitem [ref=f2e237]:
                - paragraph [ref=f2e243]: 2 versements à reprendre
                - paragraph [ref=f2e244]: 40 950 F CFA que des clients ou des partenaires attendent depuis plus de 30 minutes.
                - link "Traiter les versements" [ref=f2e245] [cursor=pointer]:
                  - /url: /admin/finance#versements-a-reprendre
              - listitem [ref=f2e250]:
                - paragraph [ref=f2e259]: 4 remboursements à verser
                - paragraph [ref=f2e260]: 66 150 F CFA demandés et pas encore reçus par les clients.
                - link "Voir les remboursements" [ref=f2e261] [cursor=pointer]:
                  - /url: /admin/finance#remboursements-a-verser
            - list "À jour" [ref=f2e266]:
              - listitem [ref=f2e267]: "Créances : aucune"
          - region [ref=f2e271]:
            - heading "Indicateurs" [level=2] [ref=f2e272]
            - generic [ref=f2e273]:
              - generic [ref=f2e274]:
                - paragraph [ref=f2e276]: Gagné par Event Village
                - paragraph [ref=f2e280]: 57 335,22 F CFA
                - paragraph [ref=f2e281]: Ce mois-ci, du 1er au 19 novembre 2026. Détail sur la page Finance.
              - generic [ref=f2e282]:
                - paragraph [ref=f2e284]: Encaissé ce mois-ci
                - paragraph [ref=f2e289]: 1 996 650 F CFA
                - paragraph [ref=f2e290]: Paiements en ligne, frais de service compris.
              - generic [ref=f2e291]:
                - paragraph [ref=f2e293]: Partenaires validés
                - paragraph [ref=f2e299]: "6"
                - paragraph [ref=f2e300]: sur 6 inscrits
              - generic [ref=f2e301]:
                - paragraph [ref=f2e303]: Utilisateurs inscrits
                - paragraph [ref=f2e310]: "42"
                - paragraph [ref=f2e311]: 0 ambassadeur(s) actif(s)
          - region [ref=f2e312]:
            - generic [ref=f2e313]:
              - heading "Candidatures des partenaires" [level=2] [ref=f2e314]
              - paragraph [ref=f2e315]: Validez ou refusez les organisateurs, restaurants et gestionnaires de salles après examen de leur dossier.
            - tablist "Statut des candidatures" [ref=f2e317]:
              - tab "En attente , 0" [selected] [ref=f2e318] [cursor=pointer]:
                - generic [ref=f2e319]: En attente
                - generic [ref=f2e320]:
                  - generic [ref=f2e321]: ","
                  - text: "0"
              - tab "Validés , 6" [ref=f2e322] [cursor=pointer]:
                - generic [ref=f2e323]: Validés
                - generic [ref=f2e324]:
                  - generic [ref=f2e325]: ","
                  - text: "6"
              - tab "Refusés , 0" [ref=f2e326] [cursor=pointer]:
                - generic [ref=f2e327]: Refusés
                - generic [ref=f2e328]:
                  - generic [ref=f2e329]: ","
                  - text: "0"
              - tab "Tous , 6" [ref=f2e330] [cursor=pointer]:
                - generic [ref=f2e331]: Tous
                - generic [ref=f2e332]:
                  - generic [ref=f2e333]: ","
                  - text: "6"
            - tabpanel "En attente , 0" [ref=f2e334]:
              - generic [ref=f2e335]:
                - heading "Aucune candidature en attente" [level=3] [ref=f2e341]
                - paragraph [ref=f2e342]: Les nouvelles inscriptions « Devenir partenaire » apparaissent ici en direct, avec leurs pièces justificatives.
          - region [ref=f2e343]:
            - heading "Raccourcis" [level=2] [ref=f2e344]
            - generic [ref=f2e345]:
              - link "Parrainage et ambassadeurs" [ref=f2e346] [cursor=pointer]:
                - /url: /admin/referral
              - link "Journal d’audit" [ref=f2e352] [cursor=pointer]:
                - /url: /admin/audit
              - link "Catalogues et services" [ref=f2e357] [cursor=pointer]:
                - /url: /admin/services
  - alert [ref=f2e364]
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
      |                                                                                        ^ Error: contrôles responsive de adm-tableau-de-bord (sombre)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```