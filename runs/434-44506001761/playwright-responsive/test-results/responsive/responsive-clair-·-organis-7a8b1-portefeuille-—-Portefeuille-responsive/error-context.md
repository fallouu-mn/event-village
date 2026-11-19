# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · organisateur >> org-portefeuille — Portefeuille
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de org-portefeuille (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 5

- Array []
+ Array [
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "1024 px : texte tronqué sans le texte entier : span.block.truncate « Mariama Ndiaye » (points de suspension, texte entier absent)",
+   "1440 px : texte tronqué sans le texte entier : span.block.truncate « Mariama Ndiaye » (points de suspension, texte entier absent)",
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
        - generic [ref=f5e10]:
          - paragraph [ref=f5e11]: Menu principal
          - generic [ref=f5e12]:
            - link "Accueil" [ref=f5e13] [cursor=pointer]:
              - /url: /
            - link "Explorer" [ref=f5e18] [cursor=pointer]:
              - /url: /explore
            - link "Mes billets" [ref=f5e23] [cursor=pointer]:
              - /url: /tickets
            - link "Portefeuille" [ref=f5e27] [cursor=pointer]:
              - /url: /wallet
        - generic [ref=f5e32]:
          - paragraph [ref=f5e33]: Espaces métier
          - link "Espace partenaire" [ref=f5e35] [cursor=pointer]:
            - /url: /partner/dashboard
      - generic [ref=f5e43]:
        - link "Mariama Ndiaye Partenaire" [ref=f5e44] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f5e45]: MN
          - generic [ref=f5e46]:
            - generic [ref=f5e47]: Mariama Ndiaye
            - generic [ref=f5e48]: Partenaire
        - generic [ref=f5e49]:
          - button "Se déconnecter" [ref=f5e50] [cursor=pointer]
          - button "Basculer le thème" [ref=f5e55] [cursor=pointer]
    - generic [ref=f5e59]:
      - banner [ref=f5e60]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f5e62] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 99+ non lues" [ref=f5e69] [cursor=pointer]:
          - generic [ref=f5e73]: 99+
      - main [ref=f5e74]:
        - generic [ref=f5e76]:
          - generic [ref=f5e79]:
            - heading "Portefeuille de parrainage" [level=1] [ref=f5e80]
            - paragraph [ref=f5e81]: Vos commissions de parrainage deviennent disponibles après leur délai de validation ; retirez-les par Wave ou Orange Money.
          - region [ref=f5e82]:
            - heading "Soldes" [level=2] [ref=f5e83]
            - generic [ref=f5e84]:
              - generic [ref=f5e85]:
                - generic [ref=f5e86]: Disponible au retrait
                - generic [ref=f5e87]: Client standard
              - paragraph [ref=f5e91]: 0 F CFA
              - paragraph [ref=f5e92]: Commissions validées, retirables dès maintenant.
            - generic [ref=f5e93]:
              - generic [ref=f5e94]:
                - paragraph [ref=f5e95]: En attente
                - paragraph [ref=f5e99]: 0 F CFA
                - paragraph [ref=f5e100]: Chaque commission devient disponible après son délai de validation.
              - generic [ref=f5e101]:
                - paragraph [ref=f5e102]: Retraits en cours
                - paragraph [ref=f5e106]: 0 F CFA
                - paragraph [ref=f5e107]: Montant réservé sur votre solde, frais compris, pendant l’envoi vers Wave ou Orange Money.
              - generic [ref=f5e108]:
                - paragraph [ref=f5e109]: À compenser
                - paragraph [ref=f5e113]: 0 F CFA
                - paragraph [ref=f5e114]: Aucune somme à compenser.
          - region [ref=f5e115]:
            - generic [ref=f5e116]:
              - heading "Retirer mes commissions" [level=2] [ref=f5e117]
              - paragraph [ref=f5e121]: Wave ou Orange Money. Le minimum, les frais et le montant que vous recevrez sont affichés avant l’envoi du code.
            - list "Étapes du retrait" [ref=f5e122]:
              - listitem [ref=f5e123]:
                - generic [aria-hidden] [ref=f5e124]: "1"
                - generic [ref=f5e125]: Demande
              - listitem [ref=f5e127]:
                - generic [aria-hidden] [ref=f5e128]: "2"
                - generic [ref=f5e129]: Code SMS
              - listitem [ref=f5e131]:
                - generic [aria-hidden] [ref=f5e132]: "3"
                - generic [ref=f5e133]: Suivi
            - generic [ref=f5e134]:
              - group "Recevoir sur" [ref=f5e135]:
                - generic [ref=f5e136]: Recevoir sur *
                - generic [ref=f5e137]:
                  - generic [ref=f5e138] [cursor=pointer]:
                    - radio "Wave" [ref=f5e139]
                    - generic [ref=f5e140]:
                      - generic [aria-hidden] [ref=f5e141]: W
                      - generic [ref=f5e142]: Wave
                  - generic [ref=f5e143] [cursor=pointer]:
                    - radio "Orange Money" [ref=f5e144]
                    - generic [ref=f5e145]:
                      - generic [aria-hidden] [ref=f5e146]: OM
                      - generic [ref=f5e147]: Orange Money
              - generic [ref=f5e148]:
                - generic [ref=f5e149]: Numéro Mobile Money qui reçoit le retrait *
                - textbox "Numéro Mobile Money qui reçoit le retrait" [ref=f5e150]:
                  - /placeholder: 77 123 45 67
                  - text: 70 000 01 01
                - paragraph [ref=f5e151]: Mobile sénégalais de 9 chiffres. Le code de confirmation part au numéro de votre compte.
              - generic [ref=f5e152]:
                - generic [ref=f5e153]: Montant à retirer (F CFA) *
                - textbox "Montant à retirer (F CFA)" [ref=f5e154]:
                  - /placeholder: "Ex : 10000"
                - paragraph [ref=f5e155]: "Disponible : 0 F CFA. Les frais sont déduits du montant versé."
              - paragraph [ref=f5e156]: "Minimum de retrait : 5 000 F CFA. Frais : 1 % du montant."
              - button "Aucun montant disponible au retrait" [disabled] [ref=f5e157]
          - region [ref=f5e163]:
            - generic [ref=f5e170]:
              - heading "Votre lien de parrainage" [level=2] [ref=f5e171]
              - paragraph [ref=f5e172]: "Partagez ce lien : vous touchez une commission sur les achats en ligne de vos filleuls."
            - generic [ref=f5e173]:
              - paragraph [ref=f5e174]: http://localhost:3000/register?ref=EV-000101
              - button "Copier mon lien" [ref=f5e175] [cursor=pointer]
            - generic [ref=f5e181]:
              - generic [ref=f5e182]:
                - paragraph [ref=f5e183]: Génération 1 (filleuls directs)
                - generic [ref=f5e184]:
                  - generic [ref=f5e185]: 5 %
                  - generic [ref=f5e186]: 0 filleul
              - generic [ref=f5e187]:
                - paragraph [ref=f5e188]: Génération 2 (sous-filleuls)
                - generic [ref=f5e189]:
                  - generic [ref=f5e190]: 2 %
                  - generic [ref=f5e191]: 0 filleul
          - region [ref=f5e192]:
            - heading "Mes retraits" [level=2] [ref=f5e193]
            - generic [ref=f5e194]:
              - heading "Aucun retrait" [level=3] [ref=f5e199]
              - paragraph [ref=f5e200]: Vous n’avez pas encore retiré de commissions.
          - region [ref=f5e201]:
            - heading "Historique du compte" [level=2] [ref=f5e202]
            - generic [ref=f5e203]:
              - heading "Aucune opération" [level=3] [ref=f5e209]
              - paragraph [ref=f5e210]: "Partagez votre lien : les commissions de vos filleuls apparaîtront ici."
  - alert [ref=f5e211]
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
      |                                                                                        ^ Error: contrôles responsive de org-portefeuille (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```