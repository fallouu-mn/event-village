# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · client >> profil-notifications — Réglages des notifications
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de profil-notifications (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "1024 px : texte tronqué sans le texte entier : span.block.truncate « Fatou Mbaye » (points de suspension, texte entier absent)",
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
          - link "Devenir partenaire" [ref=f5e35] [cursor=pointer]:
            - /url: /partner/register
      - generic [ref=f5e41]:
        - link "Fatou Mbaye Client" [ref=f5e42] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f5e43]: FM
          - generic [ref=f5e44]:
            - generic [ref=f5e45]: Fatou Mbaye
            - generic [ref=f5e46]: Client
        - generic [ref=f5e47]:
          - button "Se déconnecter" [ref=f5e48] [cursor=pointer]
          - button "Basculer le thème" [ref=f5e53] [cursor=pointer]
    - generic [ref=f5e57]:
      - banner [ref=f5e58]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f5e60] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 7 non lues" [ref=f5e67] [cursor=pointer]:
          - generic [ref=f5e71]: "7"
      - main [ref=f5e72]:
        - generic [ref=f5e74]:
          - generic [ref=f5e75]:
            - link "Mon profil" [ref=f5e77] [cursor=pointer]:
              - /url: /profile
            - generic [ref=f5e83]:
              - heading "Préférences de notification" [level=1] [ref=f5e84]
              - paragraph [ref=f5e85]: Choisissez comment Event Village vous prévient. Les messages indispensables partent toujours.
          - region [ref=f5e86]:
            - heading "Sur cet appareil" [level=2] [ref=f5e87]
            - status [ref=f5e90]:
              - generic [ref=f5e96]:
                - paragraph [ref=f5e97]: Refusées dans le navigateur
                - paragraph [ref=f5e98]: Vous avez bloqué les notifications pour Event Village. Pour les réactiver, ouvrez les réglages du site dans votre navigateur (icône à gauche de l’adresse), autorisez les notifications, puis revenez sur cette page.
          - region [ref=f5e99]:
            - generic [ref=f5e100]:
              - heading "Vous choisissez" [level=2] [ref=f5e101]
              - paragraph [ref=f5e102]: Pour chaque sujet, activez ou coupez un canal. Un canal coupé n’envoie plus rien sur ce sujet ; vous gardez les autres.
            - status [ref=f5e103]:
              - generic [ref=f5e108]:
                - paragraph [ref=f5e109]: Emails non disponibles
                - generic [ref=f5e110]: Ajoutez et vérifiez une adresse email dans votre profil pour recevoir ces emails.
              - link "Ouvrir mon profil" [ref=f5e112] [cursor=pointer]:
                - /url: /profile
            - region [ref=f5e114]:
              - generic [ref=f5e121]:
                - heading "Rappels avant l’événement" [level=3] [ref=f5e122]
                - paragraph [ref=f5e123]: La veille et quelques heures avant le début d’un événement dont vous avez un billet (et, pour un contrôleur, la veille de chaque affectation).
              - list [ref=f5e124]:
                - listitem [ref=f5e125]:
                  - generic [ref=f5e127]:
                    - generic [ref=f5e128]: Application
                    - generic [ref=f5e130]:
                      - generic [aria-hidden] [ref=f5e131]: Activé
                      - switch "Application" [checked] [ref=f5e132] [cursor=pointer]
                - listitem [ref=f5e135]:
                  - generic [ref=f5e137]:
                    - generic [ref=f5e138]: SMS
                    - generic [ref=f5e140]:
                      - generic [aria-hidden] [ref=f5e141]: Désactivé
                      - switch "SMS" [ref=f5e142] [cursor=pointer]
                - listitem [ref=f5e145]:
                  - generic [ref=f5e147]:
                    - generic [ref=f5e148]:
                      - generic [ref=f5e149]: Email
                      - paragraph [ref=f5e150]: Adresse email non vérifiée
                    - generic [ref=f5e151]:
                      - generic [aria-hidden] [ref=f5e152]: Désactivé
                      - switch "Email" [disabled] [ref=f5e153]
                - listitem [ref=f5e156]:
                  - generic [ref=f5e158]:
                    - generic [ref=f5e159]: Notifications push
                    - generic [ref=f5e161]:
                      - generic [aria-hidden] [ref=f5e162]: Activé
                      - switch "Notifications push" [checked] [ref=f5e163] [cursor=pointer]
            - region [ref=f5e166]:
              - generic [ref=f5e174]:
                - heading "Suspension et reprise d’un événement" [level=3] [ref=f5e175]
                - paragraph [ref=f5e176]: Suspension ou reprise d’un événement dont vous avez un billet.
              - list [ref=f5e177]:
                - listitem [ref=f5e178]:
                  - generic [ref=f5e180]:
                    - generic [ref=f5e181]: Application
                    - generic [ref=f5e183]:
                      - generic [aria-hidden] [ref=f5e184]: Activé
                      - switch "Application" [checked] [ref=f5e185] [cursor=pointer]
                - listitem [ref=f5e188]:
                  - generic [ref=f5e190]:
                    - generic [ref=f5e191]: SMS
                    - generic [ref=f5e193]:
                      - generic [aria-hidden] [ref=f5e194]: Activé
                      - switch "SMS" [checked] [ref=f5e195] [cursor=pointer]
                - listitem [ref=f5e198]:
                  - generic [ref=f5e200]:
                    - generic [ref=f5e201]:
                      - generic [ref=f5e202]: Email
                      - paragraph [ref=f5e203]: Adresse email non vérifiée
                    - generic [ref=f5e204]:
                      - generic [aria-hidden] [ref=f5e205]: Désactivé
                      - switch "Email" [disabled] [ref=f5e206]
                - listitem [ref=f5e209]:
                  - generic [ref=f5e211]:
                    - generic [ref=f5e212]: Notifications push
                    - generic [ref=f5e214]:
                      - generic [aria-hidden] [ref=f5e215]: Activé
                      - switch "Notifications push" [checked] [ref=f5e216] [cursor=pointer]
          - region [ref=f5e219]:
            - generic [ref=f5e225]:
              - heading "Toujours envoyées" [level=2] [ref=f5e226]
              - paragraph [ref=f5e227]: "Ces messages protègent votre compte, votre argent et vos billets : ils ne se désactivent pas."
            - list [ref=f5e228]:
              - listitem [ref=f5e229]: Codes de connexion
              - listitem [ref=f5e233]: Confirmations d’achat et reçus
              - listitem [ref=f5e237]: Billets transférés
              - listitem [ref=f5e241]: Annulations
              - listitem [ref=f5e245]: Remboursements
              - listitem [ref=f5e249]: Sécurité du compte
              - listitem [ref=f5e253]: Changements de date ou de lieu
  - alert [ref=f5e257]
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
      |                                                                                        ^ Error: contrôles responsive de profil-notifications (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```