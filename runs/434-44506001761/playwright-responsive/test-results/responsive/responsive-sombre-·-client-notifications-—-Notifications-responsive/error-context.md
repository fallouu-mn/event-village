# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · client >> notifications — Notifications
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de notifications (sombre)

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
        - generic [ref=f2e10]:
          - paragraph [ref=f2e11]: Menu principal
          - generic [ref=f2e12]:
            - link "Accueil" [ref=f2e13] [cursor=pointer]:
              - /url: /
            - link "Explorer" [ref=f2e18] [cursor=pointer]:
              - /url: /explore
            - link "Mes billets" [ref=f2e23] [cursor=pointer]:
              - /url: /tickets
            - link "Portefeuille" [ref=f2e27] [cursor=pointer]:
              - /url: /wallet
        - generic [ref=f2e32]:
          - paragraph [ref=f2e33]: Espaces métier
          - link "Devenir partenaire" [ref=f2e35] [cursor=pointer]:
            - /url: /partner/register
      - generic [ref=f2e41]:
        - link "Fatou Mbaye Client" [ref=f2e42] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f2e43]: FM
          - generic [ref=f2e44]:
            - generic [ref=f2e45]: Fatou Mbaye
            - generic [ref=f2e46]: Client
        - generic [ref=f2e47]:
          - button "Se déconnecter" [ref=f2e48] [cursor=pointer]
          - button "Basculer le thème" [ref=f2e53] [cursor=pointer]
    - generic [ref=f2e57]:
      - banner [ref=f2e58]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f2e60] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 7 non lues" [ref=f2e67] [cursor=pointer]:
          - generic [ref=f2e71]: "7"
      - main [ref=f2e72]:
        - generic [ref=f2e74]:
          - generic [ref=f2e76]:
            - generic [ref=f2e77]:
              - status [ref=f2e79]: En direct
              - heading "Notifications" [level=1] [ref=f2e81]
              - paragraph [ref=f2e82]: "Billets, rappels, paiements et changements d’événement : ce qui concerne votre compte, mis à jour en direct."
            - generic [ref=f2e83]:
              - button "Tout marquer comme lu" [ref=f2e84] [cursor=pointer]
              - link "Préférences" [ref=f2e90] [cursor=pointer]:
                - /url: /profile/notifications
          - tablist "Filtrer mes notifications" [ref=f2e98]:
            - tab "Toutes" [selected] [ref=f2e99] [cursor=pointer]
            - tab "Non lues , 7" [ref=f2e101] [cursor=pointer]:
              - generic [ref=f2e102]: Non lues
              - generic [ref=f2e103]:
                - generic [ref=f2e104]: ","
                - text: "7"
            - tab "Événements" [ref=f2e105] [cursor=pointer]
            - tab "Billets" [ref=f2e107] [cursor=pointer]
            - tab "Paiements et remboursements" [ref=f2e109] [cursor=pointer]
            - tab "Réservations et commandes" [ref=f2e111] [cursor=pointer]
            - tab "Compte" [ref=f2e113] [cursor=pointer]
            - tab "Alertes" [ref=f2e115] [cursor=pointer]
            - tab "Informations" [ref=f2e117] [cursor=pointer]
          - tabpanel "Toutes" [ref=f2e119]:
            - list [ref=f2e120]:
              - listitem [ref=f2e121]:
                - generic [ref=f2e126]:
                  - generic [ref=f2e127]:
                    - heading "Un billet vous est transféré" [level=2] [ref=f2e128]
                    - generic [ref=f2e129]: Non lue
                  - generic [ref=f2e131]: Transfert de billet
                  - paragraph [ref=f2e133]: Un billet pour « Festival Jazz sur le Fleuve » vous attend. Acceptez-le avant le sam. 21 nov. 2026 à 10:34.
                  - paragraph [ref=f2e134]:
                    - time [ref=f2e135]: Il y a 9 min
                - generic [ref=f2e136]:
                  - button "Marquer comme lue" [ref=f2e137] [cursor=pointer]
                  - link "Voir le détail" [ref=f2e143] [cursor=pointer]:
                    - /url: /tickets?tab=recus
              - listitem [ref=f2e148]:
                - generic [ref=f2e154]:
                  - generic [ref=f2e155]:
                    - heading "Remboursement versé" [level=2] [ref=f2e156]
                    - generic [ref=f2e157]: Non lue
                  - paragraph [ref=f2e159]: 15 750 F CFA vous ont été remboursés sur votre compte Wave pour « Croisière musicale vers Gorée ».
                  - paragraph [ref=f2e160]:
                    - time [ref=f2e161]: Il y a 9 min
                - generic [ref=f2e162]:
                  - button "Marquer comme lue" [ref=f2e163] [cursor=pointer]
                  - link "Voir le détail" [ref=f2e169] [cursor=pointer]:
                    - /url: /tickets?tab=historique
              - listitem [ref=f2e174]:
                - generic [ref=f2e179]:
                  - generic [ref=f2e180]:
                    - heading "Achat confirmé" [level=2] [ref=f2e181]
                    - generic [ref=f2e182]: Non lue
                  - generic [ref=f2e184]: Billet
                  - paragraph [ref=f2e186]: "1 billet pour « Brunch électro des Almadies » le jeu. 19 nov. 2026 à 11:45. Total payé : 15 750 F CFA. Vos billets sont dans Mes billets."
                  - paragraph [ref=f2e187]:
                    - time [ref=f2e188]: Il y a 9 min
                - generic [ref=f2e189]:
                  - button "Marquer comme lue" [ref=f2e190] [cursor=pointer]
                  - link "Voir le détail" [ref=f2e196] [cursor=pointer]:
                    - /url: /tickets?tab=a-venir
              - listitem [ref=f2e201]:
                - generic [ref=f2e208]:
                  - generic [ref=f2e209]:
                    - heading "Événement annulé" [level=2] [ref=f2e210]
                    - generic [ref=f2e211]: Non lue
                  - generic [ref=f2e213]: Statut de l’événement
                  - paragraph [ref=f2e215]: « Croisière musicale vers Gorée » du jeu. 19 nov. 2026 à 14:45 est annulé. La chaloupe prévue n’a pas obtenu son certificat de navigation à temps. Tous les billets payés en ligne sont remboursés automatiquement, sans démarche de votre part. Votre remboursement est en cours.
                  - paragraph [ref=f2e216]:
                    - time [ref=f2e217]: Il y a 9 min
                - generic [ref=f2e218]:
                  - button "Marquer comme lue" [ref=f2e219] [cursor=pointer]
                  - link "Voir le détail" [ref=f2e225] [cursor=pointer]:
                    - /url: /tickets?tab=historique
              - listitem [ref=f2e230]:
                - generic [ref=f2e235]:
                  - generic [ref=f2e236]:
                    - heading "Achat confirmé" [level=2] [ref=f2e237]
                    - generic [ref=f2e238]: Non lue
                  - generic [ref=f2e240]: Billet
                  - paragraph [ref=f2e242]: "1 billet pour « Festival Jazz sur le Fleuve » le mar. 1 déc. 2026 à 18:00. Total payé : 7 875 F CFA. Vos billets sont dans Mes billets."
                  - paragraph [ref=f2e243]:
                    - time [ref=f2e244]: Il y a 9 min
                - generic [ref=f2e245]:
                  - button "Marquer comme lue" [ref=f2e246] [cursor=pointer]
                  - link "Voir le détail" [ref=f2e252] [cursor=pointer]:
                    - /url: /tickets?tab=a-venir
              - listitem [ref=f2e257]:
                - generic [ref=f2e264]:
                  - generic [ref=f2e265]:
                    - heading "Invitation de Baobab Scène" [level=2] [ref=f2e266]
                    - generic [ref=f2e267]: Non lue
                  - generic [ref=f2e269]: Contrôle d’accès
                  - paragraph [ref=f2e271]: Baobab Scène vous invite à contrôler l'entrée de « Festival Jazz sur le Fleuve ». Répondez avant le dim. 22 nov. 2026 à 10:34.
                  - paragraph [ref=f2e272]:
                    - time [ref=f2e273]: Il y a 9 min
                - generic [ref=f2e274]:
                  - button "Marquer comme lue" [ref=f2e275] [cursor=pointer]
                  - link "Voir le détail" [ref=f2e281] [cursor=pointer]:
                    - /url: /invitations
              - listitem [ref=f2e286]:
                - generic [ref=f2e291]:
                  - generic [ref=f2e292]:
                    - heading "Achat confirmé" [level=2] [ref=f2e293]
                    - generic [ref=f2e294]: Non lue
                  - generic [ref=f2e296]: Billet
                  - paragraph [ref=f2e298]: "1 billet pour « Croisière musicale vers Gorée » le jeu. 19 nov. 2026 à 14:45. Total payé : 15 750 F CFA. Vos billets sont dans Mes billets."
                  - paragraph [ref=f2e299]:
                    - time [ref=f2e300]: Il y a 9 min
                - generic [ref=f2e301]:
                  - button "Marquer comme lue" [ref=f2e302] [cursor=pointer]
                  - link "Voir le détail" [ref=f2e308] [cursor=pointer]:
                    - /url: /tickets?tab=a-venir
              - listitem [ref=f2e313]:
                - generic [ref=f2e318]:
                  - heading "Achat confirmé" [level=2] [ref=f2e320]
                  - generic [ref=f2e321]: Billet
                  - paragraph [ref=f2e323]: "1 billet pour « Concert des Lumières de Gorée » le ven. 20 nov. 2026 à 06:45. Total payé : 6 300 F CFA. Vos billets sont dans Mes billets."
                  - paragraph [ref=f2e324]:
                    - time [ref=f2e325]: Il y a 9 min
                - link "Voir le détail" [ref=f2e327] [cursor=pointer]:
                  - /url: /tickets?tab=a-venir
              - listitem [ref=f2e332]:
                - generic [ref=f2e337]:
                  - heading "Achat confirmé" [level=2] [ref=f2e339]
                  - generic [ref=f2e340]: Billet
                  - paragraph [ref=f2e342]: "2 billets pour « Nuit du Sabar — édition d’automne » le jeu. 19 nov. 2026 à 11:30. Total payé : 10 500 F CFA. Vos billets sont dans Mes billets."
                  - paragraph [ref=f2e343]:
                    - time [ref=f2e344]: Il y a 9 min
                - link "Voir le détail" [ref=f2e346] [cursor=pointer]:
                  - /url: /tickets?tab=a-venir
  - alert [ref=f2e351]
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
      |                                                                                        ^ Error: contrôles responsive de notifications (sombre)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```