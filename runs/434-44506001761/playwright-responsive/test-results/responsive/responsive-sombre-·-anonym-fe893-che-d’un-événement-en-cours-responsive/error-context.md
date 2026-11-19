# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · anonyme >> fiche-en-cours — Fiche d’un événement en cours
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de fiche-en-cours (sombre)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "360 px : texte tronqué sans le texte entier : p.truncate.text-base « Dès 5 000 F CFA » (points de suspension, texte entier absent)",
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
        - link "Se connecter" [ref=f2e42] [cursor=pointer]:
          - /url: /login
        - button "Basculer le thème" [pressed] [ref=f2e48] [cursor=pointer]
    - generic [ref=f2e56]:
      - banner [ref=f2e57]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f2e59] [cursor=pointer]:
          - /url: /explore
        - button "Notifications" [ref=f2e66] [cursor=pointer]
      - main [ref=f2e70]:
        - generic [ref=f2e72]:
          - generic [ref=f2e73]:
            - link "Retour aux événements" [ref=f2e74] [cursor=pointer]:
              - /url: /explore
            - button "Partager l’événement" [ref=f2e79] [cursor=pointer]
          - generic [ref=f2e87]:
            - article [ref=f2e88]:
              - img "Affiche de l’événement Nuit du Sabar — édition d’automne" [ref=f2e90]
              - generic [ref=f2e91]:
                - generic [ref=f2e92]: Concerts & Musique
                - heading "Nuit du Sabar — édition d’automne" [level=1] [ref=f2e95]
                - paragraph [ref=f2e96]: Organisé par Baobab Scène
              - list "Infos de l’événement" [ref=f2e97]:
                - listitem [ref=f2e98]:
                  - generic [ref=f2e102]:
                    - paragraph [ref=f2e103]: Jeudi 19 novembre 2026 à 11:30
                    - paragraph [ref=f2e104]: Jusqu’à 16:30
                - listitem [ref=f2e105]:
                  - generic [ref=f2e110]:
                    - paragraph [ref=f2e111]: Esplanade de la Corniche Ouest
                    - paragraph [ref=f2e112]: Esplanade de la Corniche Ouest, Dakar · Dakar
                - listitem [ref=f2e113]:
                  - generic [ref=f2e117]:
                    - paragraph [ref=f2e118]: Billet dans l’application
                    - paragraph [ref=f2e119]: Présentez son QR code à l’entrée, depuis Mes billets.
              - region [ref=f2e120]:
                - heading "À propos" [level=2] [ref=f2e121]
                - paragraph [ref=f2e122]: Une nuit entière de sabar avec quatre troupes de percussionnistes et danseurs, en plein air face à l’océan. Restauration sur place, accès aux personnes à mobilité réduite par l’entrée principale.
              - region [ref=f2e123]:
                - heading "Programme" [level=2] [ref=f2e124]
                - list [ref=f2e125]:
                  - listitem [ref=f2e126]:
                    - generic [ref=f2e128]:
                      - paragraph [ref=f2e129]: 19:30
                      - generic [ref=f2e130]: Activité
                    - paragraph [ref=f2e132]: Ouverture des portes
                  - listitem [ref=f2e133]:
                    - generic [ref=f2e135]:
                      - paragraph [ref=f2e136]: 20:30
                      - generic [ref=f2e137]: Artiste
                    - paragraph [ref=f2e139]: Première partie
                    - paragraph [ref=f2e140]: Troupe Kër Gëstu
                  - listitem [ref=f2e141]:
                    - generic [ref=f2e143]:
                      - paragraph [ref=f2e144]: 22:00
                      - generic [ref=f2e145]: Artiste
                    - paragraph [ref=f2e147]: Grand cercle de sabar
                    - paragraph [ref=f2e148]: Ensemble Ndawrabine des Parcelles
                  - listitem [ref=f2e149]:
                    - generic [ref=f2e151]:
                      - paragraph [ref=f2e152]: 23:30
                      - generic [ref=f2e153]: Activité
                    - paragraph [ref=f2e155]: Bœuf final avec le public
              - region [ref=f2e156]:
                - heading "Lieu et accès" [level=2] [ref=f2e157]
                - generic [ref=f2e158]:
                  - paragraph [ref=f2e159]: Esplanade de la Corniche Ouest
                  - paragraph [ref=f2e160]: Esplanade de la Corniche Ouest, Dakar · Dakar
                - generic [ref=f2e161]:
                  - img "Nuit du Sabar — édition d’automne, Esplanade de la Corniche Ouest" [ref=f2e168]:
                    - generic [ref=f2e169]: Nuit du Sabar — édition d’a…
                  - button "Afficher la carte" [ref=f2e173] [cursor=pointer]
                - link "Voir l’itinéraire" [ref=f2e178] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=14.6833,-17.4676
                - generic [ref=f2e188]:
                  - generic [ref=f2e195]:
                    - paragraph [ref=f2e196]: Stationnement
                    - generic [ref=f2e197]: Stationnement surveillé à proximité.
                  - generic [ref=f2e203]:
                    - paragraph [ref=f2e204]: Paiement
                    - generic [ref=f2e205]: Wave ou Orange Money, en ligne. Les frais de service s’affichent avant le paiement.
                  - generic [ref=f2e211]:
                    - paragraph [ref=f2e212]: Règlement et consignes
                    - generic [ref=f2e213]: Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.
              - region "Organisateur" [ref=f2e214]:
                - generic [ref=f2e216]:
                  - paragraph [ref=f2e217]: Organisateur
                  - paragraph [ref=f2e218]: Baobab Scène
            - complementary [ref=f2e219]:
              - generic [ref=f2e220]:
                - generic [ref=f2e221]:
                  - generic [ref=f2e222]:
                    - heading "Billetterie" [level=2] [ref=f2e223]
                    - paragraph [ref=f2e224]: "Choisissez vos billets : places mises à jour en direct."
                  - status [ref=f2e225]: En direct
                - list "Catégories de billets" [ref=f2e227]:
                  - listitem [ref=f2e228]:
                    - generic [ref=f2e230]:
                      - generic [ref=f2e231]:
                        - heading "VIP" [level=3] [ref=f2e232]
                        - paragraph [ref=f2e233]: 15 000 F CFA
                        - paragraph [ref=f2e234]: Disponible
                        - paragraph [ref=f2e235]: Carré assis, entrée dédiée, une boisson offerte.
                      - group "Quantité VIP" [ref=f2e236]:
                        - button "Retirer un billet VIP" [disabled] [ref=f2e237]
                        - status [ref=f2e240]: "0"
                        - button "Ajouter un billet VIP" [ref=f2e241] [cursor=pointer]
                  - listitem [ref=f2e244]:
                    - generic [ref=f2e246]:
                      - generic [ref=f2e247]:
                        - heading "Standard" [level=3] [ref=f2e248]
                        - paragraph [ref=f2e249]: 5 000 F CFA
                        - paragraph [ref=f2e250]: Disponible
                        - paragraph [ref=f2e251]: Accès à l’esplanade.
                      - group "Quantité Standard" [ref=f2e252]:
                        - button "Retirer un billet Standard" [disabled] [ref=f2e253]
                        - status [ref=f2e256]: "0"
                        - button "Ajouter un billet Standard" [ref=f2e257] [cursor=pointer]
                - paragraph [ref=f2e260]: Choisissez au moins un billet avec le bouton « + ».
                - generic [ref=f2e261]:
                  - paragraph [ref=f2e262]:
                    - generic [ref=f2e263]: Paiement
                    - generic [ref=f2e264]: Wave
                    - generic [ref=f2e265]: ou
                    - generic [ref=f2e266]: Orange Money
                  - paragraph [ref=f2e267]: Billet avec QR code dans Mes billets, dès le paiement
  - alert [ref=f2e271]
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
      |                                                                                        ^ Error: contrôles responsive de fiche-en-cours (sombre)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```