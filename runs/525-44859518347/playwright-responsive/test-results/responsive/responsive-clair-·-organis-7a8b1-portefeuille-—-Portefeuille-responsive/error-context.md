# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · organisateur >> org-portefeuille — Portefeuille
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de org-portefeuille (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "1024 px : défilement horizontal (largeur du document 1049 px, fenêtre 1024 px)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f5e1]:
  - generic [ref=f5e3]:
    - banner [ref=f5e4]:
      - generic [ref=f5e5]:
        - link "Event Village, accueil" [ref=f5e7] [cursor=pointer]:
          - /url: /
          - generic [ref=f5e8]: Event Village
        - navigation "Rubriques" [ref=f5e13]:
          - link "Accueil" [ref=f5e14] [cursor=pointer]:
            - /url: /
          - link "Explorer" [ref=f5e15] [cursor=pointer]:
            - /url: /explore
          - link "Mes billets" [ref=f5e16] [cursor=pointer]:
            - /url: /tickets
          - link "Portefeuille" [ref=f5e17] [cursor=pointer]:
            - /url: /wallet
      - link "Rechercher un événement…" [ref=f5e19] [cursor=pointer]:
        - /url: /explore
      - generic [ref=f5e24]:
        - button "Notifications, 32 non lues" [ref=f5e26] [cursor=pointer]:
          - generic [ref=f5e30]: "32"
        - button "Mariama Ndiaye" [ref=f5e32] [cursor=pointer]:
          - generic [aria-hidden] [ref=f5e33]: MN
    - main [ref=f5e37]:
      - generic [ref=f5e39]:
        - generic [ref=f5e42]:
          - heading "Portefeuille de parrainage" [level=1] [ref=f5e43]
          - paragraph [ref=f5e44]: Vos commissions de parrainage deviennent disponibles après leur délai de validation ; retirez-les par Wave ou Orange Money.
        - region [ref=f5e45]:
          - heading "Soldes" [level=2] [ref=f5e46]
          - generic [ref=f5e47]:
            - generic [ref=f5e48]:
              - generic [ref=f5e49]: Disponible au retrait
              - generic [ref=f5e50]: Client standard
            - paragraph [ref=f5e54]: 0 F CFA
            - paragraph [ref=f5e55]: Commissions validées, retirables dès maintenant.
          - generic [ref=f5e56]:
            - generic [ref=f5e57]:
              - paragraph [ref=f5e58]: En attente
              - paragraph [ref=f5e62]: 0 F CFA
              - paragraph [ref=f5e63]: Chaque commission devient disponible après son délai de validation.
            - generic [ref=f5e64]:
              - paragraph [ref=f5e65]: Retraits en cours
              - paragraph [ref=f5e69]: 0 F CFA
              - paragraph [ref=f5e70]: Montant réservé sur votre solde, frais compris, pendant l’envoi vers Wave ou Orange Money.
            - generic [ref=f5e71]:
              - paragraph [ref=f5e72]: À compenser
              - paragraph [ref=f5e76]: 0 F CFA
              - paragraph [ref=f5e77]: Aucune somme à compenser.
        - region [ref=f5e78]:
          - generic [ref=f5e79]:
            - heading "Retirer mes commissions" [level=2] [ref=f5e80]
            - paragraph [ref=f5e84]: Wave ou Orange Money. Le minimum, les frais et le montant que vous recevrez sont affichés avant l’envoi du code.
          - list "Étapes du retrait" [ref=f5e85]:
            - listitem [ref=f5e86]:
              - generic [aria-hidden] [ref=f5e87]: "1"
              - generic [ref=f5e88]: Demande
            - listitem [ref=f5e90]:
              - generic [aria-hidden] [ref=f5e91]: "2"
              - generic [ref=f5e92]: Code SMS
            - listitem [ref=f5e94]:
              - generic [aria-hidden] [ref=f5e95]: "3"
              - generic [ref=f5e96]: Suivi
          - generic [ref=f5e97]:
            - group "Recevoir sur" [ref=f5e98]:
              - generic [ref=f5e99]: Recevoir sur *
              - generic [ref=f5e100]:
                - generic [ref=f5e101] [cursor=pointer]:
                  - radio "Wave" [ref=f5e102]
                  - generic [ref=f5e103]: Wave
                - generic [ref=f5e106] [cursor=pointer]:
                  - radio "Orange Money" [ref=f5e107]
                  - generic [ref=f5e108]: Orange Money
            - generic [ref=f5e111]:
              - generic [ref=f5e112]: Numéro Mobile Money qui reçoit le retrait *
              - textbox "Numéro Mobile Money qui reçoit le retrait" [ref=f5e113]:
                - /placeholder: 77 123 45 67
                - text: 70 000 01 01
              - paragraph [ref=f5e114]: Mobile sénégalais de 9 chiffres. Le code de confirmation part au numéro de votre compte.
            - generic [ref=f5e115]:
              - generic [ref=f5e116]: Montant à retirer (F CFA) *
              - textbox "Montant à retirer (F CFA)" [ref=f5e117]:
                - /placeholder: "Ex : 10000"
              - paragraph [ref=f5e118]: "Disponible : 0 F CFA. Les frais sont déduits du montant versé."
            - paragraph [ref=f5e119]: "Minimum de retrait : 5 000 F CFA. Frais : 1 % du montant."
            - button "Aucun montant disponible au retrait" [disabled] [ref=f5e120]
        - region [ref=f5e126]:
          - generic [ref=f5e133]:
            - heading "Votre lien de parrainage" [level=2] [ref=f5e134]
            - paragraph [ref=f5e135]: "Partagez ce lien : vous touchez une commission sur les achats en ligne de vos filleuls."
          - generic [ref=f5e136]:
            - paragraph [ref=f5e137]: http://localhost:3000/register?ref=EV-000101
            - button "Copier mon lien" [ref=f5e138] [cursor=pointer]
          - generic [ref=f5e144]:
            - generic [ref=f5e145]:
              - paragraph [ref=f5e146]: Génération 1 (filleuls directs)
              - generic [ref=f5e147]:
                - generic [ref=f5e148]: 5 %
                - generic [ref=f5e149]: 0 filleul
            - generic [ref=f5e150]:
              - paragraph [ref=f5e151]: Génération 2 (sous-filleuls)
              - generic [ref=f5e152]:
                - generic [ref=f5e153]: 2 %
                - generic [ref=f5e154]: 0 filleul
        - region [ref=f5e155]:
          - heading "Mes retraits" [level=2] [ref=f5e156]
          - generic [ref=f5e157]:
            - heading "Aucun retrait" [level=3] [ref=f5e162]
            - paragraph [ref=f5e163]: Vous n’avez pas encore retiré de commissions.
        - region [ref=f5e164]:
          - heading "Historique du compte" [level=2] [ref=f5e165]
          - generic [ref=f5e166]:
            - heading "Aucune opération" [level=3] [ref=f5e172]
            - paragraph [ref=f5e173]: "Partagez votre lien : les commissions de vos filleuls apparaîtront ici."
  - alert [ref=f5e174]
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
      |                                                                                        ^ Error: contrôles responsive de org-portefeuille (clair)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```