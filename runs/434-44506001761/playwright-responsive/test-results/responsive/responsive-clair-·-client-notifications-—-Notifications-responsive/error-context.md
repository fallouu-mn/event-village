# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · client >> notifications — Notifications
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de notifications (clair)

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
          - generic [ref=f5e76]:
            - generic [ref=f5e77]:
              - status [ref=f5e79]: En direct
              - heading "Notifications" [level=1] [ref=f5e81]
              - paragraph [ref=f5e82]: "Billets, rappels, paiements et changements d’événement : ce qui concerne votre compte, mis à jour en direct."
            - generic [ref=f5e83]:
              - button "Tout marquer comme lu" [ref=f5e84] [cursor=pointer]
              - link "Préférences" [ref=f5e90] [cursor=pointer]:
                - /url: /profile/notifications
          - tablist "Filtrer mes notifications" [ref=f5e98]:
            - tab "Toutes" [selected] [ref=f5e99] [cursor=pointer]
            - tab "Non lues , 7" [ref=f5e101] [cursor=pointer]:
              - generic [ref=f5e102]: Non lues
              - generic [ref=f5e103]:
                - generic [ref=f5e104]: ","
                - text: "7"
            - tab "Événements" [ref=f5e105] [cursor=pointer]
            - tab "Billets" [ref=f5e107] [cursor=pointer]
            - tab "Paiements et remboursements" [ref=f5e109] [cursor=pointer]
            - tab "Réservations et commandes" [ref=f5e111] [cursor=pointer]
            - tab "Compte" [ref=f5e113] [cursor=pointer]
            - tab "Alertes" [ref=f5e115] [cursor=pointer]
            - tab "Informations" [ref=f5e117] [cursor=pointer]
          - tabpanel "Toutes" [ref=f5e119]:
            - list [ref=f5e120]:
              - listitem [ref=f5e121]:
                - generic [ref=f5e126]:
                  - generic [ref=f5e127]:
                    - heading "Un billet vous est transféré" [level=2] [ref=f5e128]
                    - generic [ref=f5e129]: Non lue
                  - generic [ref=f5e131]: Transfert de billet
                  - paragraph [ref=f5e133]: Un billet pour « Festival Jazz sur le Fleuve » vous attend. Acceptez-le avant le sam. 21 nov. 2026 à 10:34.
                  - paragraph [ref=f5e134]:
                    - time [ref=f5e135]: Il y a 3 min
                - generic [ref=f5e136]:
                  - button "Marquer comme lue" [ref=f5e137] [cursor=pointer]
                  - link "Voir le détail" [ref=f5e143] [cursor=pointer]:
                    - /url: /tickets?tab=recus
              - listitem [ref=f5e148]:
                - generic [ref=f5e154]:
                  - generic [ref=f5e155]:
                    - heading "Remboursement versé" [level=2] [ref=f5e156]
                    - generic [ref=f5e157]: Non lue
                  - paragraph [ref=f5e159]: 15 750 F CFA vous ont été remboursés sur votre compte Wave pour « Croisière musicale vers Gorée ».
                  - paragraph [ref=f5e160]:
                    - time [ref=f5e161]: Il y a 3 min
                - generic [ref=f5e162]:
                  - button "Marquer comme lue" [ref=f5e163] [cursor=pointer]
                  - link "Voir le détail" [ref=f5e169] [cursor=pointer]:
                    - /url: /tickets?tab=historique
              - listitem [ref=f5e174]:
                - generic [ref=f5e179]:
                  - generic [ref=f5e180]:
                    - heading "Achat confirmé" [level=2] [ref=f5e181]
                    - generic [ref=f5e182]: Non lue
                  - generic [ref=f5e184]: Billet
                  - paragraph [ref=f5e186]: "1 billet pour « Brunch électro des Almadies » le jeu. 19 nov. 2026 à 11:45. Total payé : 15 750 F CFA. Vos billets sont dans Mes billets."
                  - paragraph [ref=f5e187]:
                    - time [ref=f5e188]: Il y a 3 min
                - generic [ref=f5e189]:
                  - button "Marquer comme lue" [ref=f5e190] [cursor=pointer]
                  - link "Voir le détail" [ref=f5e196] [cursor=pointer]:
                    - /url: /tickets?tab=a-venir
              - listitem [ref=f5e201]:
                - generic [ref=f5e208]:
                  - generic [ref=f5e209]:
                    - heading "Événement annulé" [level=2] [ref=f5e210]
                    - generic [ref=f5e211]: Non lue
                  - generic [ref=f5e213]: Statut de l’événement
                  - paragraph [ref=f5e215]: « Croisière musicale vers Gorée » du jeu. 19 nov. 2026 à 14:45 est annulé. La chaloupe prévue n’a pas obtenu son certificat de navigation à temps. Tous les billets payés en ligne sont remboursés automatiquement, sans démarche de votre part. Votre remboursement est en cours.
                  - paragraph [ref=f5e216]:
                    - time [ref=f5e217]: Il y a 3 min
                - generic [ref=f5e218]:
                  - button "Marquer comme lue" [ref=f5e219] [cursor=pointer]
                  - link "Voir le détail" [ref=f5e225] [cursor=pointer]:
                    - /url: /tickets?tab=historique
              - listitem [ref=f5e230]:
                - generic [ref=f5e235]:
                  - generic [ref=f5e236]:
                    - heading "Achat confirmé" [level=2] [ref=f5e237]
                    - generic [ref=f5e238]: Non lue
                  - generic [ref=f5e240]: Billet
                  - paragraph [ref=f5e242]: "1 billet pour « Festival Jazz sur le Fleuve » le mar. 1 déc. 2026 à 18:00. Total payé : 7 875 F CFA. Vos billets sont dans Mes billets."
                  - paragraph [ref=f5e243]:
                    - time [ref=f5e244]: Il y a 3 min
                - generic [ref=f5e245]:
                  - button "Marquer comme lue" [ref=f5e246] [cursor=pointer]
                  - link "Voir le détail" [ref=f5e252] [cursor=pointer]:
                    - /url: /tickets?tab=a-venir
              - listitem [ref=f5e257]:
                - generic [ref=f5e264]:
                  - generic [ref=f5e265]:
                    - heading "Invitation de Baobab Scène" [level=2] [ref=f5e266]
                    - generic [ref=f5e267]: Non lue
                  - generic [ref=f5e269]: Contrôle d’accès
                  - paragraph [ref=f5e271]: Baobab Scène vous invite à contrôler l'entrée de « Festival Jazz sur le Fleuve ». Répondez avant le dim. 22 nov. 2026 à 10:34.
                  - paragraph [ref=f5e272]:
                    - time [ref=f5e273]: Il y a 3 min
                - generic [ref=f5e274]:
                  - button "Marquer comme lue" [ref=f5e275] [cursor=pointer]
                  - link "Voir le détail" [ref=f5e281] [cursor=pointer]:
                    - /url: /invitations
              - listitem [ref=f5e286]:
                - generic [ref=f5e291]:
                  - generic [ref=f5e292]:
                    - heading "Achat confirmé" [level=2] [ref=f5e293]
                    - generic [ref=f5e294]: Non lue
                  - generic [ref=f5e296]: Billet
                  - paragraph [ref=f5e298]: "1 billet pour « Croisière musicale vers Gorée » le jeu. 19 nov. 2026 à 14:45. Total payé : 15 750 F CFA. Vos billets sont dans Mes billets."
                  - paragraph [ref=f5e299]:
                    - time [ref=f5e300]: Il y a 3 min
                - generic [ref=f5e301]:
                  - button "Marquer comme lue" [ref=f5e302] [cursor=pointer]
                  - link "Voir le détail" [ref=f5e308] [cursor=pointer]:
                    - /url: /tickets?tab=a-venir
              - listitem [ref=f5e313]:
                - generic [ref=f5e318]:
                  - heading "Achat confirmé" [level=2] [ref=f5e320]
                  - generic [ref=f5e321]: Billet
                  - paragraph [ref=f5e323]: "1 billet pour « Concert des Lumières de Gorée » le ven. 20 nov. 2026 à 06:45. Total payé : 6 300 F CFA. Vos billets sont dans Mes billets."
                  - paragraph [ref=f5e324]:
                    - time [ref=f5e325]: Il y a 3 min
                - link "Voir le détail" [ref=f5e327] [cursor=pointer]:
                  - /url: /tickets?tab=a-venir
              - listitem [ref=f5e332]:
                - generic [ref=f5e337]:
                  - heading "Achat confirmé" [level=2] [ref=f5e339]
                  - generic [ref=f5e340]: Billet
                  - paragraph [ref=f5e342]: "2 billets pour « Nuit du Sabar — édition d’automne » le jeu. 19 nov. 2026 à 11:30. Total payé : 10 500 F CFA. Vos billets sont dans Mes billets."
                  - paragraph [ref=f5e343]:
                    - time [ref=f5e344]: Il y a 3 min
                - link "Voir le détail" [ref=f5e346] [cursor=pointer]:
                  - /url: /tickets?tab=a-venir
  - alert [ref=f5e351]
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
      |                                                                                        ^ Error: contrôles responsive de notifications (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```