# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · fumee-superadmin >> adm-notification — Détail d’une notification
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de adm-notification (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "1024 px : textes qui se chevauchent : span.min-w-0.break-words « À la une » sur span.block.break-words « Elhadji SuperAdmin » (42×10 px) ; span.flex.flex-shrink-0 « ES » sur p.mb-1.5.block « Système » (17×14 px) ; span.block.break-words « Super-administrateur » sur p.mb-1.5.block « Système » (23×14 px) ; span.block.break-words « Super-administrateur » sur span.min-w-0.break-words « Réglages » (13×16 px)",
+   "1440 px : textes qui se chevauchent : span.block.break-words « Elhadji SuperAdmin » sur span.min-w-0.break-words « Notifications » (78×16 px) ; span.block.break-words « Super-administrateur » sur span.min-w-0.break-words « Scanner » (47×10 px)",
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
            - link "Toutes les notifications" [ref=f5e161] [cursor=pointer]:
              - /url: /admin/notifications
            - generic [ref=f5e166]:
              - generic [ref=f5e167]:
                - generic [ref=f5e168]: En échec
                - heading "Confirmation d’achat" [level=1] [ref=f5e172]
                - paragraph [ref=f5e173]: SMS · créée le sam. 21 nov. 2026 à 03:10
              - button "Relancer" [ref=f5e175] [cursor=pointer]
          - region [ref=f5e181]:
            - heading "Envoi" [level=2] [ref=f5e182]
            - generic [ref=f5e183]:
              - generic [ref=f5e184]:
                - term [ref=f5e185]: Type
                - definition [ref=f5e186]: Confirmation d’achat
              - generic [ref=f5e187]:
                - term [ref=f5e188]: Canal
                - definition [ref=f5e189]: SMS
              - generic [ref=f5e190]:
                - term [ref=f5e191]: Statut
                - definition [ref=f5e192]:
                  - generic [ref=f5e193]: En échec
              - generic [ref=f5e196]:
                - term [ref=f5e197]: Motif
                - definition [ref=f5e198]: Fournisseur SMS indisponible
              - generic [ref=f5e199]:
                - term [ref=f5e200]: Précision
                - definition [ref=f5e201]: refus temporaire 5 (démonstration)
              - generic [ref=f5e202]:
                - term [ref=f5e203]: Famille
                - definition [ref=f5e204]: Indispensable (toujours envoyée)
              - generic [ref=f5e205]:
                - term [ref=f5e206]: Origine
                - definition [ref=f5e207]: Boîte d’envoi
              - generic [ref=f5e208]:
                - term [ref=f5e209]: Événement
                - definition [ref=f5e210]:
                  - generic [ref=f5e211]:
                    - generic [ref=f5e212]: Nuit du Sabar — édition d’automne
                    - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f5e213]': Publié
              - generic [ref=f5e216]:
                - term [ref=f5e217]: Créée le
                - definition [ref=f5e218]:
                  - time [ref=f5e219]: sam. 21 nov. 2026 à 03:10
              - generic [ref=f5e220]:
                - term [ref=f5e221]: Prévue le
                - definition [ref=f5e222]:
                  - time [ref=f5e223]: sam. 21 nov. 2026 à 03:10
              - generic [ref=f5e224]:
                - term [ref=f5e225]: Envoyée le
                - definition [ref=f5e226]: —
          - region [ref=f5e227]:
            - heading "Destinataire" [level=2] [ref=f5e228]
            - generic [ref=f5e229]:
              - generic [ref=f5e230]:
                - term [ref=f5e231]: Compte
                - definition [ref=f5e232]: Moussa Sy
              - generic [ref=f5e233]:
                - term [ref=f5e234]: Téléphone
                - definition [ref=f5e235]: "+221700000202"
              - generic [ref=f5e236]:
                - term [ref=f5e237]: Email
                - definition [ref=f5e238]: moussa.sy.02@demo.eventvillage.local
          - region [ref=f5e239]:
            - heading "Décision" [level=2] [ref=f5e240]
            - generic [ref=f5e241]:
              - generic [ref=f5e242]:
                - term [ref=f5e243]: Moment
                - definition [ref=f5e244]:
                  - text: Au moment de l’envoi ·
                  - time [ref=f5e245]: sam. 21 nov. 2026 à 04:32
              - generic [ref=f5e246]:
                - term [ref=f5e247]: Décision
                - definition [ref=f5e248]: Envoyer
              - generic [ref=f5e249]:
                - term [ref=f5e250]: Compte du destinataire
                - definition [ref=f5e251]: Actif
              - generic [ref=f5e252]:
                - term [ref=f5e253]: Préférence
                - definition [ref=f5e254]: "Message indispensable : aucune préférence ne s’applique"
              - generic [ref=f5e255]:
                - term [ref=f5e256]: Événement à ce moment
                - definition [ref=f5e257]:
                  - generic [ref=f5e258]:
                    - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f5e259]': Publié
                    - generic [ref=f5e262]:
                      - text: "Début :"
                      - time [ref=f5e263]: sam. 21 nov. 2026 à 04:00
              - generic [ref=f5e264]:
                - term [ref=f5e265]: Réponse du fournisseur SMS
                - definition [ref=f5e266]: Refusé par le fournisseur
              - generic [ref=f5e267]:
                - term [ref=f5e268]: Taille du SMS
                - definition [ref=f5e269]: 1 SMS facturé, alphabet standard
          - region [ref=f5e270]:
            - heading "Contenu" [level=2] [ref=f5e271]
            - generic [ref=f5e272]:
              - paragraph [ref=f5e273]: "Event Village : achat confirmé, 2 billets Nuit du Sabar -... Frais de service 300 F CFA, total payé 6 300 F CFA. http://localhost:3000/tickets"
              - paragraph [ref=f5e274]: Aperçu rendu par le serveur à partir des données de la notification.
          - region [ref=f5e275]:
            - heading "Tentatives" [level=2] [ref=f5e276]
            - generic [ref=f5e277]:
              - generic [ref=f5e278]:
                - term [ref=f5e279]: Tentatives
                - definition [ref=f5e280]: 5 sur 5
              - generic [ref=f5e281]:
                - term [ref=f5e282]: Relances manuelles
                - definition [ref=f5e283]: "0"
              - generic [ref=f5e284]:
                - term [ref=f5e285]: Dernière prise en charge
                - definition [ref=f5e286]:
                  - time [ref=f5e287]: sam. 21 nov. 2026 à 04:32
              - generic [ref=f5e288]:
                - term [ref=f5e289]: Prochain essai
                - definition [ref=f5e290]: —
              - generic [ref=f5e291]:
                - term [ref=f5e292]: Terminée le
                - definition [ref=f5e293]:
                  - time [ref=f5e294]: sam. 21 nov. 2026 à 04:32
  - alert [ref=f5e295]
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
      |                                                                                        ^ Error: contrôles responsive de adm-notification (clair)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```