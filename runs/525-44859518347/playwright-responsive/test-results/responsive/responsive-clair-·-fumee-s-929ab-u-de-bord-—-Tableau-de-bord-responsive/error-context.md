# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · fumee-superadmin >> adm-tableau-de-bord — Tableau de bord
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de adm-tableau-de-bord (clair)

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
          - generic [ref=f5e160]:
            - generic [ref=f5e161]:
              - heading "Tableau de bord" [level=1] [ref=f5e162]
              - paragraph [ref=f5e163]: Dossiers à traiter et vue d’ensemble de la plateforme.
            - generic [ref=f5e164]:
              - status [ref=f5e165]: Mis à jour à 03:18
              - button "Actualiser" [ref=f5e167] [cursor=pointer]
          - region [ref=f5e175]:
            - heading "À faire aujourd’hui" [level=2] [ref=f5e176]
            - list [ref=f5e177]:
              - listitem [ref=f5e178]:
                - paragraph [ref=f5e184]: "Argent qui attend : 2 versements à reprendre, aucune créance"
                - paragraph [ref=f5e185]: 25 200 F CFA attendus par des clients ou des partenaires depuis plus de 30 minutes.
                - link "Voir l’argent qui attend" [ref=f5e186] [cursor=pointer]:
                  - /url: "#argent-qui-attend"
              - listitem [ref=f5e191]:
                - paragraph [ref=f5e198]: 4 événements à valider
                - paragraph [ref=f5e199]: Le plus ancien attend depuis moins d’une heure.
                - link "Examiner les événements" [ref=f5e200] [cursor=pointer]:
                  - /url: /admin/events?status=EN_ATTENTE
              - listitem [ref=f5e205]:
                - paragraph [ref=f5e212]: 1 événement suspendu à décider
                - paragraph [ref=f5e213]: "1 à venir : réactivez-le ou annulez-le."
                - link "Voir les événements suspendus" [ref=f5e214] [cursor=pointer]:
                  - /url: /admin/events?status=SUSPENDU
              - listitem [ref=f5e219]:
                - paragraph [ref=f5e225]: 1 écart de caisse à valider
                - paragraph [ref=f5e226]: "Événement : « Nuit du Sabar — édition d’automne ». Recomptez l’argent avec le contrôleur avant de valider."
                - link "Voir la caisse" [ref=f5e227] [cursor=pointer]:
                  - /url: /partner/events/7a42d629-fb05-4355-bc58-05afff398979?tab=caisse
              - listitem [ref=f5e232]:
                - paragraph [ref=f5e237]: 1 envoi en échec aujourd’hui
                - paragraph [ref=f5e238]: SMS, emails ou notifications qui ne sont pas partis.
                - link "Voir les envois en échec" [ref=f5e239] [cursor=pointer]:
                  - /url: /admin/notifications?status=FAILED
            - list "À jour" [ref=f5e244]:
              - listitem [ref=f5e245]: "Candidatures de partenaires : aucune"
              - listitem [ref=f5e249]: "SMS optionnels : sous le seuil d’alerte"
          - region [ref=f5e254]:
            - heading "Argent qui attend" [level=2] [ref=f5e255]
            - list [ref=f5e256]:
              - listitem [ref=f5e257]:
                - paragraph [ref=f5e263]: 2 versements à reprendre
                - paragraph [ref=f5e264]: 25 200 F CFA que des clients ou des partenaires attendent depuis plus de 30 minutes.
                - link "Traiter les versements" [ref=f5e265] [cursor=pointer]:
                  - /url: /admin/finance#versements-a-reprendre
              - listitem [ref=f5e270]:
                - paragraph [ref=f5e279]: 4 remboursements à verser
                - paragraph [ref=f5e280]: 72 450 F CFA demandés et pas encore reçus par les clients.
                - link "Voir les remboursements" [ref=f5e281] [cursor=pointer]:
                  - /url: /admin/finance#remboursements-a-verser
            - list "À jour" [ref=f5e286]:
              - listitem [ref=f5e287]: "Créances : aucune"
          - region [ref=f5e291]:
            - heading "Indicateurs" [level=2] [ref=f5e292]
            - generic [ref=f5e293]:
              - generic [ref=f5e294]:
                - paragraph [ref=f5e296]: Gagné par Event Village
                - paragraph [ref=f5e300]: 57 540,72 F CFA
                - paragraph [ref=f5e301]: Ce mois-ci, du 1er au 21 novembre 2026. Détail sur la page Finance.
              - generic [ref=f5e302]:
                - paragraph [ref=f5e304]: Encaissé ce mois-ci
                - paragraph [ref=f5e309]: 2 002 950 F CFA
                - paragraph [ref=f5e310]: Paiements en ligne, frais de service compris.
              - generic [ref=f5e311]:
                - paragraph [ref=f5e313]: Partenaires validés
                - paragraph [ref=f5e319]: "6"
                - paragraph [ref=f5e320]: sur 6 inscrits
              - generic [ref=f5e321]:
                - paragraph [ref=f5e323]: Utilisateurs inscrits
                - paragraph [ref=f5e330]: "42"
                - paragraph [ref=f5e331]: 0 ambassadeur(s) actif(s)
          - region [ref=f5e332]:
            - generic [ref=f5e333]:
              - heading "Candidatures des partenaires" [level=2] [ref=f5e334]
              - paragraph [ref=f5e335]: Validez ou refusez les organisateurs, restaurants et gestionnaires de salles après examen de leur dossier.
            - tablist "Statut des candidatures" [ref=f5e337]:
              - tab "En attente , 0" [selected] [ref=f5e338] [cursor=pointer]:
                - generic [ref=f5e339]: En attente
                - generic [ref=f5e340]:
                  - generic [ref=f5e341]: ","
                  - text: "0"
              - tab "Validés , 6" [ref=f5e342] [cursor=pointer]:
                - generic [ref=f5e343]: Validés
                - generic [ref=f5e344]:
                  - generic [ref=f5e345]: ","
                  - text: "6"
              - tab "Refusés , 0" [ref=f5e346] [cursor=pointer]:
                - generic [ref=f5e347]: Refusés
                - generic [ref=f5e348]:
                  - generic [ref=f5e349]: ","
                  - text: "0"
              - tab "Tous , 6" [ref=f5e350] [cursor=pointer]:
                - generic [ref=f5e351]: Tous
                - generic [ref=f5e352]:
                  - generic [ref=f5e353]: ","
                  - text: "6"
            - tabpanel "En attente , 0" [ref=f5e354]:
              - generic [ref=f5e355]:
                - heading "Aucune candidature en attente" [level=3] [ref=f5e361]
                - paragraph [ref=f5e362]: Les nouvelles inscriptions « Devenir partenaire » apparaissent ici en direct, avec leurs pièces justificatives.
          - region [ref=f5e363]:
            - heading "Raccourcis" [level=2] [ref=f5e364]
            - generic [ref=f5e365]:
              - link "Parrainage et ambassadeurs" [ref=f5e366] [cursor=pointer]:
                - /url: /admin/referral
              - link "Journal d’audit" [ref=f5e372] [cursor=pointer]:
                - /url: /admin/audit
              - link "Catalogues et services" [ref=f5e377] [cursor=pointer]:
                - /url: /admin/services
  - alert [ref=f5e384]
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
      |                                                                                        ^ Error: contrôles responsive de adm-tableau-de-bord (clair)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```