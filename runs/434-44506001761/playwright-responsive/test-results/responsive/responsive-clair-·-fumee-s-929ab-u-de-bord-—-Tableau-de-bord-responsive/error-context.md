# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · fumee-superadmin >> adm-tableau-de-bord — Tableau de bord
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de adm-tableau-de-bord (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 6

- Array []
+ Array [
+   "320 px : texte tronqué sans le texte entier : small.text-caption.max-w-full « Validation » (points de suspension, texte entier absent)",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "1024 px : texte tronqué sans le texte entier : span.block.truncate « Elhadji SuperAdmin » (points de suspension, texte entier absent) ; span.block.truncate « Superadmin » (points de suspension, texte entier absent)",
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
          - generic [ref=f5e140]:
            - generic [ref=f5e141]:
              - heading "Tableau de bord" [level=1] [ref=f5e142]
              - paragraph [ref=f5e143]: Dossiers à traiter et vue d’ensemble de la plateforme.
            - generic [ref=f5e144]:
              - status [ref=f5e145]: Mis à jour à 10:40
              - button "Actualiser" [ref=f5e147] [cursor=pointer]
          - region [ref=f5e155]:
            - heading "À faire aujourd’hui" [level=2] [ref=f5e156]
            - list [ref=f5e157]:
              - listitem [ref=f5e158]:
                - paragraph [ref=f5e164]: "Argent qui attend : 2 versements à reprendre, aucune créance"
                - paragraph [ref=f5e165]: 40 950 F CFA attendus par des clients ou des partenaires depuis plus de 30 minutes.
                - link "Voir l’argent qui attend" [ref=f5e166] [cursor=pointer]:
                  - /url: "#argent-qui-attend"
              - listitem [ref=f5e171]:
                - paragraph [ref=f5e178]: 4 événements à valider
                - paragraph [ref=f5e179]: Le plus ancien attend depuis moins d’une heure.
                - link "Examiner les événements" [ref=f5e180] [cursor=pointer]:
                  - /url: /admin/events?status=EN_ATTENTE
              - listitem [ref=f5e185]:
                - paragraph [ref=f5e192]: 1 événement suspendu à décider
                - paragraph [ref=f5e193]: "1 à venir : réactivez-le ou annulez-le."
                - link "Voir les événements suspendus" [ref=f5e194] [cursor=pointer]:
                  - /url: /admin/events?status=SUSPENDU
              - listitem [ref=f5e199]:
                - paragraph [ref=f5e205]: 1 écart de caisse à valider
                - paragraph [ref=f5e206]: "Événement : « Nuit du Sabar — édition d’automne ». Recomptez l’argent avec le contrôleur avant de valider."
                - link "Voir la caisse" [ref=f5e207] [cursor=pointer]:
                  - /url: /partner/events/1b6b9b15-31a6-41c3-856d-f27700d91f21?tab=caisse
              - listitem [ref=f5e212]:
                - paragraph [ref=f5e217]: 1 envoi en échec aujourd’hui
                - paragraph [ref=f5e218]: SMS, emails ou notifications qui ne sont pas partis.
                - link "Voir les envois en échec" [ref=f5e219] [cursor=pointer]:
                  - /url: /admin/notifications?status=FAILED
            - list "À jour" [ref=f5e224]:
              - listitem [ref=f5e225]: "Candidatures de partenaires : aucune"
              - listitem [ref=f5e229]: "SMS optionnels : sous le seuil d’alerte"
          - region [ref=f5e234]:
            - heading "Argent qui attend" [level=2] [ref=f5e235]
            - list [ref=f5e236]:
              - listitem [ref=f5e237]:
                - paragraph [ref=f5e243]: 2 versements à reprendre
                - paragraph [ref=f5e244]: 40 950 F CFA que des clients ou des partenaires attendent depuis plus de 30 minutes.
                - link "Traiter les versements" [ref=f5e245] [cursor=pointer]:
                  - /url: /admin/finance#versements-a-reprendre
              - listitem [ref=f5e250]:
                - paragraph [ref=f5e259]: 4 remboursements à verser
                - paragraph [ref=f5e260]: 66 150 F CFA demandés et pas encore reçus par les clients.
                - link "Voir les remboursements" [ref=f5e261] [cursor=pointer]:
                  - /url: /admin/finance#remboursements-a-verser
            - list "À jour" [ref=f5e266]:
              - listitem [ref=f5e267]: "Créances : aucune"
          - region [ref=f5e271]:
            - heading "Indicateurs" [level=2] [ref=f5e272]
            - generic [ref=f5e273]:
              - generic [ref=f5e274]:
                - paragraph [ref=f5e276]: Gagné par Event Village
                - paragraph [ref=f5e280]: 57 335,22 F CFA
                - paragraph [ref=f5e281]: Ce mois-ci, du 1er au 19 novembre 2026. Détail sur la page Finance.
              - generic [ref=f5e282]:
                - paragraph [ref=f5e284]: Encaissé ce mois-ci
                - paragraph [ref=f5e289]: 1 996 650 F CFA
                - paragraph [ref=f5e290]: Paiements en ligne, frais de service compris.
              - generic [ref=f5e291]:
                - paragraph [ref=f5e293]: Partenaires validés
                - paragraph [ref=f5e299]: "6"
                - paragraph [ref=f5e300]: sur 6 inscrits
              - generic [ref=f5e301]:
                - paragraph [ref=f5e303]: Utilisateurs inscrits
                - paragraph [ref=f5e310]: "42"
                - paragraph [ref=f5e311]: 0 ambassadeur(s) actif(s)
          - region [ref=f5e312]:
            - generic [ref=f5e313]:
              - heading "Candidatures des partenaires" [level=2] [ref=f5e314]
              - paragraph [ref=f5e315]: Validez ou refusez les organisateurs, restaurants et gestionnaires de salles après examen de leur dossier.
            - tablist "Statut des candidatures" [ref=f5e317]:
              - tab "En attente , 0" [selected] [ref=f5e318] [cursor=pointer]:
                - generic [ref=f5e319]: En attente
                - generic [ref=f5e320]:
                  - generic [ref=f5e321]: ","
                  - text: "0"
              - tab "Validés , 6" [ref=f5e322] [cursor=pointer]:
                - generic [ref=f5e323]: Validés
                - generic [ref=f5e324]:
                  - generic [ref=f5e325]: ","
                  - text: "6"
              - tab "Refusés , 0" [ref=f5e326] [cursor=pointer]:
                - generic [ref=f5e327]: Refusés
                - generic [ref=f5e328]:
                  - generic [ref=f5e329]: ","
                  - text: "0"
              - tab "Tous , 6" [ref=f5e330] [cursor=pointer]:
                - generic [ref=f5e331]: Tous
                - generic [ref=f5e332]:
                  - generic [ref=f5e333]: ","
                  - text: "6"
            - tabpanel "En attente , 0" [ref=f5e334]:
              - generic [ref=f5e335]:
                - heading "Aucune candidature en attente" [level=3] [ref=f5e341]
                - paragraph [ref=f5e342]: Les nouvelles inscriptions « Devenir partenaire » apparaissent ici en direct, avec leurs pièces justificatives.
          - region [ref=f5e343]:
            - heading "Raccourcis" [level=2] [ref=f5e344]
            - generic [ref=f5e345]:
              - link "Parrainage et ambassadeurs" [ref=f5e346] [cursor=pointer]:
                - /url: /admin/referral
              - link "Journal d’audit" [ref=f5e352] [cursor=pointer]:
                - /url: /admin/audit
              - link "Catalogues et services" [ref=f5e357] [cursor=pointer]:
                - /url: /admin/services
  - alert [ref=f5e364]
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
      |                                                                                        ^ Error: contrôles responsive de adm-tableau-de-bord (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```