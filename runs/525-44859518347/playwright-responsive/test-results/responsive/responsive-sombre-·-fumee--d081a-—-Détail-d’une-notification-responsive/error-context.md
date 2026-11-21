# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · fumee-superadmin >> adm-notification — Détail d’une notification
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de adm-notification (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "1440 px : textes qui se chevauchent : span.block.break-words « Elhadji SuperAdmin » sur span.min-w-0.break-words « Notifications » (78×16 px) ; span.block.break-words « Super-administrateur » sur span.min-w-0.break-words « Scanner » (47×10 px)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
  - generic [ref=f2e2]:
    - complementary [ref=f2e4]:
      - generic [ref=f2e5]:
        - link "Event Village, accueil" [ref=f2e7] [cursor=pointer]:
          - /url: /
          - generic [ref=f2e8]: Event Village
        - button "Replier la barre latérale" [expanded] [ref=f2e11] [cursor=pointer]
      - navigation "Navigation principale" [ref=f2e16]:
        - generic [ref=f2e17]: Administration
        - link "Tableau de bord" [ref=f2e22] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=f2e29]:
          - paragraph [ref=f2e30]: Gestion
          - generic [ref=f2e31]:
            - link "Événements" [ref=f2e32] [cursor=pointer]:
              - /url: /admin/events
            - link "Comptes" [ref=f2e36] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=f2e43] [cursor=pointer]:
              - /url: /admin/services
            - link "Salles à valider" [ref=f2e49] [cursor=pointer]:
              - /url: /admin/halls
        - generic [ref=f2e55]:
          - paragraph [ref=f2e56]: Finances
          - link "Finance" [ref=f2e58] [cursor=pointer]:
            - /url: /admin/finance
        - generic [ref=f2e62]:
          - paragraph [ref=f2e63]: Engagement
          - generic [ref=f2e64]:
            - link "Parrainage" [ref=f2e65] [cursor=pointer]:
              - /url: /admin/referral
            - link "Campagnes" [ref=f2e70] [cursor=pointer]:
              - /url: /admin/communications
            - link "À la une" [ref=f2e75] [cursor=pointer]:
              - /url: /admin/a-la-une
        - generic [ref=f2e79]:
          - paragraph [ref=f2e80]: Système
          - generic [ref=f2e81]:
            - link "Réglages" [ref=f2e82] [cursor=pointer]:
              - /url: /admin/finance-settings
            - link "Journal d’audit" [ref=f2e87] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=f2e92] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=f2e99] [cursor=pointer]:
              - /url: /scan
            - link "Sécurité du compte" [ref=f2e107] [cursor=pointer]:
              - /url: /admin/securite
        - link "Retour au site" [ref=f2e113] [cursor=pointer]:
          - /url: /
      - generic [ref=f2e118]:
        - link "Elhadji SuperAdmin Super-administrateur" [ref=f2e119] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e121]: ES
          - generic [ref=f2e122]:
            - generic [ref=f2e123]: Elhadji SuperAdmin
            - generic [ref=f2e124]: Super-administrateur
        - generic [ref=f2e125]:
          - button "Se déconnecter" [ref=f2e126] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e131] [cursor=pointer]
    - generic [ref=f2e135]:
      - banner [ref=f2e136]:
        - link "Rechercher un événement…" [ref=f2e138] [cursor=pointer]:
          - /url: /explore
        - generic [ref=f2e143]:
          - button "Notifications, 61 non lues" [ref=f2e145] [cursor=pointer]:
            - generic [ref=f2e149]: "61"
          - button "Elhadji SuperAdmin" [ref=f2e151] [cursor=pointer]:
            - generic [aria-hidden] [ref=f2e152]: ES
      - main [ref=f2e156]:
        - generic [ref=f2e158]:
          - generic [ref=f2e159]:
            - link "Toutes les notifications" [ref=f2e161] [cursor=pointer]:
              - /url: /admin/notifications
            - generic [ref=f2e166]:
              - generic [ref=f2e167]:
                - generic [ref=f2e168]: En échec
                - heading "Confirmation d’achat" [level=1] [ref=f2e172]
                - paragraph [ref=f2e173]: SMS · créée le sam. 21 nov. 2026 à 03:10
              - button "Relancer" [ref=f2e175] [cursor=pointer]
          - region [ref=f2e181]:
            - heading "Envoi" [level=2] [ref=f2e182]
            - generic [ref=f2e183]:
              - generic [ref=f2e184]:
                - term [ref=f2e185]: Type
                - definition [ref=f2e186]: Confirmation d’achat
              - generic [ref=f2e187]:
                - term [ref=f2e188]: Canal
                - definition [ref=f2e189]: SMS
              - generic [ref=f2e190]:
                - term [ref=f2e191]: Statut
                - definition [ref=f2e192]:
                  - generic [ref=f2e193]: En échec
              - generic [ref=f2e196]:
                - term [ref=f2e197]: Motif
                - definition [ref=f2e198]: Fournisseur SMS indisponible
              - generic [ref=f2e199]:
                - term [ref=f2e200]: Précision
                - definition [ref=f2e201]: refus temporaire 5 (démonstration)
              - generic [ref=f2e202]:
                - term [ref=f2e203]: Famille
                - definition [ref=f2e204]: Indispensable (toujours envoyée)
              - generic [ref=f2e205]:
                - term [ref=f2e206]: Origine
                - definition [ref=f2e207]: Boîte d’envoi
              - generic [ref=f2e208]:
                - term [ref=f2e209]: Événement
                - definition [ref=f2e210]:
                  - generic [ref=f2e211]:
                    - generic [ref=f2e212]: Nuit du Sabar — édition d’automne
                    - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f2e213]': Publié
              - generic [ref=f2e216]:
                - term [ref=f2e217]: Créée le
                - definition [ref=f2e218]:
                  - time [ref=f2e219]: sam. 21 nov. 2026 à 03:10
              - generic [ref=f2e220]:
                - term [ref=f2e221]: Prévue le
                - definition [ref=f2e222]:
                  - time [ref=f2e223]: sam. 21 nov. 2026 à 03:10
              - generic [ref=f2e224]:
                - term [ref=f2e225]: Envoyée le
                - definition [ref=f2e226]: —
          - region [ref=f2e227]:
            - heading "Destinataire" [level=2] [ref=f2e228]
            - generic [ref=f2e229]:
              - generic [ref=f2e230]:
                - term [ref=f2e231]: Compte
                - definition [ref=f2e232]: Moussa Sy
              - generic [ref=f2e233]:
                - term [ref=f2e234]: Téléphone
                - definition [ref=f2e235]: "+221700000202"
              - generic [ref=f2e236]:
                - term [ref=f2e237]: Email
                - definition [ref=f2e238]: moussa.sy.02@demo.eventvillage.local
          - region [ref=f2e239]:
            - heading "Décision" [level=2] [ref=f2e240]
            - generic [ref=f2e241]:
              - generic [ref=f2e242]:
                - term [ref=f2e243]: Moment
                - definition [ref=f2e244]:
                  - text: Au moment de l’envoi ·
                  - time [ref=f2e245]: sam. 21 nov. 2026 à 04:32
              - generic [ref=f2e246]:
                - term [ref=f2e247]: Décision
                - definition [ref=f2e248]: Envoyer
              - generic [ref=f2e249]:
                - term [ref=f2e250]: Compte du destinataire
                - definition [ref=f2e251]: Actif
              - generic [ref=f2e252]:
                - term [ref=f2e253]: Préférence
                - definition [ref=f2e254]: "Message indispensable : aucune préférence ne s’applique"
              - generic [ref=f2e255]:
                - term [ref=f2e256]: Événement à ce moment
                - definition [ref=f2e257]:
                  - generic [ref=f2e258]:
                    - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f2e259]': Publié
                    - generic [ref=f2e262]:
                      - text: "Début :"
                      - time [ref=f2e263]: sam. 21 nov. 2026 à 04:00
              - generic [ref=f2e264]:
                - term [ref=f2e265]: Réponse du fournisseur SMS
                - definition [ref=f2e266]: Refusé par le fournisseur
              - generic [ref=f2e267]:
                - term [ref=f2e268]: Taille du SMS
                - definition [ref=f2e269]: 1 SMS facturé, alphabet standard
          - region [ref=f2e270]:
            - heading "Contenu" [level=2] [ref=f2e271]
            - generic [ref=f2e272]:
              - paragraph [ref=f2e273]: "Event Village : achat confirmé, 2 billets Nuit du Sabar -... Frais de service 300 F CFA, total payé 6 300 F CFA. http://localhost:3000/tickets"
              - paragraph [ref=f2e274]: Aperçu rendu par le serveur à partir des données de la notification.
          - region [ref=f2e275]:
            - heading "Tentatives" [level=2] [ref=f2e276]
            - generic [ref=f2e277]:
              - generic [ref=f2e278]:
                - term [ref=f2e279]: Tentatives
                - definition [ref=f2e280]: 5 sur 5
              - generic [ref=f2e281]:
                - term [ref=f2e282]: Relances manuelles
                - definition [ref=f2e283]: "0"
              - generic [ref=f2e284]:
                - term [ref=f2e285]: Dernière prise en charge
                - definition [ref=f2e286]:
                  - time [ref=f2e287]: sam. 21 nov. 2026 à 04:32
              - generic [ref=f2e288]:
                - term [ref=f2e289]: Prochain essai
                - definition [ref=f2e290]: —
              - generic [ref=f2e291]:
                - term [ref=f2e292]: Terminée le
                - definition [ref=f2e293]:
                  - time [ref=f2e294]: sam. 21 nov. 2026 à 04:32
  - alert [ref=f2e295]
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
      |                                                                                        ^ Error: contrôles responsive de adm-notification (sombre)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```