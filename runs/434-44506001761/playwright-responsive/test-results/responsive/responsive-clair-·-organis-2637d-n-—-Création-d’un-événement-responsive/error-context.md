# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · organisateur >> org-creation — Création d’un événement
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de org-creation (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 7

- Array []
+ Array [
+   "320 px : texte tronqué sans le texte entier : span.min-w-0.truncate « Programme » (points de suspension, texte entier absent) ; span.min-w-0.truncate « Contrôle » (points de suspension, texte entier absent)",
+   "360 px : texte tronqué sans le texte entier : span.min-w-0.truncate « Programme » (points de suspension, texte entier absent)",
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "1024 px : texte tronqué sans le texte entier : span.block.truncate « Mariama Ndiaye » (points de suspension, texte entier absent) ; span.min-w-0.truncate « InfosInformations » (points de suspension, texte entier absent) ; span.min-w-0.truncate « Programme » (points de suspension, texte entier absent)",
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
          - paragraph [ref=f5e11]: Gestion
          - generic [ref=f5e12]:
            - link "Tableau de bord" [ref=f5e13] [cursor=pointer]:
              - /url: /partner/dashboard
            - link "Événements" [ref=f5e20] [cursor=pointer]:
              - /url: /partner/events
            - link "Équipe" [ref=f5e24] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=f5e31]:
          - paragraph [ref=f5e32]: Outils
          - generic [ref=f5e33]:
            - link "Finances" [ref=f5e34] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=f5e38] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=f5e42] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=f5e50] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=f5e54] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=f5e59] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=f5e65] [cursor=pointer]:
          - /url: /
      - generic [ref=f5e71]:
        - link "Mariama Ndiaye Partenaire" [ref=f5e72] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f5e73]: MN
          - generic [ref=f5e74]:
            - generic [ref=f5e75]: Mariama Ndiaye
            - generic [ref=f5e76]: Partenaire
        - generic [ref=f5e77]:
          - button "Se déconnecter" [ref=f5e78] [cursor=pointer]
          - button "Basculer le thème" [ref=f5e83] [cursor=pointer]
    - generic [ref=f5e87]:
      - banner [ref=f5e88]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f5e90] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 99+ non lues" [ref=f5e97] [cursor=pointer]:
          - generic [ref=f5e101]: 99+
      - main [ref=f5e102]:
        - generic [ref=f5e104]:
          - generic [ref=f5e105]:
            - link "Retour à mes événements" [ref=f5e107] [cursor=pointer]:
              - /url: /partner/events
            - generic [ref=f5e113]:
              - heading "Créer un événement" [level=1] [ref=f5e114]
              - paragraph [ref=f5e115]: L’événement est enregistré en brouillon. À la dernière étape, vérifiez-le puis envoyez-le pour validation (ou plus tard, depuis la liste de vos événements).
          - navigation "Étapes du formulaire" [ref=f5e116]:
            - paragraph [ref=f5e117]: "Étape 1 sur 5 : Informations générales"
            - list [ref=f5e118]:
              - listitem [ref=f5e119]:
                - button "Informations générales" [ref=f5e120] [cursor=pointer]:
                  - generic [aria-hidden] [ref=f5e121]: "1"
                  - generic [aria-hidden] [ref=f5e122]: Informations
              - listitem [ref=f5e124]:
                - button "Programme" [ref=f5e125] [cursor=pointer]:
                  - generic [aria-hidden] [ref=f5e126]: "2"
                  - generic [aria-hidden] [ref=f5e127]: Programme
              - listitem [ref=f5e129]:
                - button "Accès et informations pratiques" [ref=f5e130] [cursor=pointer]:
                  - generic [aria-hidden] [ref=f5e131]: "3"
                  - generic [aria-hidden] [ref=f5e132]: Accès
              - listitem [ref=f5e134]:
                - button "Billetterie" [ref=f5e135] [cursor=pointer]:
                  - generic [aria-hidden] [ref=f5e136]: "4"
                  - generic [aria-hidden] [ref=f5e137]: Billets
              - listitem [ref=f5e139]:
                - button "Contrôle à l’entrée (facultatif)" [ref=f5e140] [cursor=pointer]:
                  - generic [aria-hidden] [ref=f5e141]: "5"
                  - generic [aria-hidden] [ref=f5e142]: Contrôle
              - listitem [ref=f5e144]:
                - button "Vérifier avant d’envoyer" [ref=f5e145] [cursor=pointer]:
                  - generic [aria-hidden] [ref=f5e149]: Vérifier
          - generic [ref=f5e151]:
            - heading "Informations générales" [level=2] [ref=f5e152]
            - generic [ref=f5e153]:
              - generic [ref=f5e154]:
                - generic [ref=f5e156]:
                  - text: Titre de l’événement*
                  - generic [ref=f5e157]: (obligatoire)
                - textbox "Titre de l’événement (obligatoire)" [ref=f5e158]:
                  - /placeholder: "Par exemple : Nuit du Mbalax"
              - generic [ref=f5e159]:
                - generic [ref=f5e160]:
                  - text: Type d’événement*
                  - generic [ref=f5e161]: (obligatoire)
                - radiogroup "Type d’événement (obligatoire)" [ref=f5e162]:
                  - radio "Concerts & Musique" [ref=f5e163] [cursor=pointer]
                  - radio "Festivals" [ref=f5e165] [cursor=pointer]
                  - radio "Gastronomie & Tables" [ref=f5e167] [cursor=pointer]
                  - radio "Salles & Réceptions" [ref=f5e169] [cursor=pointer]
              - generic [ref=f5e171]:
                - generic [ref=f5e172]:
                  - generic [ref=f5e173]: Description
                  - generic [ref=f5e174]: 0 / 5000
                - textbox "Description" [ref=f5e175]:
                  - /placeholder: "Présentez l’événement : artistes, ambiance, public attendu…"
              - generic [ref=f5e176]:
                - generic [ref=f5e177]: Affiche de l’événement
                - button "Affiche de l’événement" [ref=f5e178]
                - generic [ref=f5e179] [cursor=pointer]: Choisir une image ou la déposer ici
                - paragraph [ref=f5e186]: "Format conseillé : paysage, 1 600 × 1 000 pixels (proportion des cartes du site), recadré au centre. JPEG, PNG ou WebP, 5 Mo au plus. Obligatoire pour soumettre l’événement à la validation."
              - group "Dates et horaires (heure de Dakar)" [ref=f5e187]:
                - generic [ref=f5e189]:
                  - generic [ref=f5e190]:
                    - generic [ref=f5e192]:
                      - text: Date de début*
                      - generic [ref=f5e193]: (obligatoire)
                    - textbox "Date de début (obligatoire)" [ref=f5e194]
                  - generic [ref=f5e195]:
                    - generic [ref=f5e197]:
                      - text: Heure de début*
                      - generic [ref=f5e198]: (obligatoire)
                    - textbox "Heure de début (obligatoire)" [ref=f5e199]
                  - generic [ref=f5e200]:
                    - generic [ref=f5e201]: Date de fin
                    - textbox "Date de fin" [ref=f5e203]
                    - paragraph [ref=f5e204]: Facultative. Pour une soirée qui passe minuit, indiquez la date du lendemain.
                  - generic [ref=f5e205]:
                    - generic [ref=f5e206]: Heure de fin
                    - textbox "Heure de fin" [ref=f5e208]
                    - paragraph [ref=f5e209]: Facultative ; avec une heure de fin, la date de fin est demandée.
              - generic [ref=f5e210]:
                - generic [ref=f5e211]:
                  - generic [ref=f5e213]:
                    - text: Lieu*
                    - generic [ref=f5e214]: (obligatoire)
                  - textbox "Lieu (obligatoire)" [ref=f5e215]:
                    - /placeholder: "Par exemple : Grand Théâtre National"
                - generic [ref=f5e216]:
                  - generic [ref=f5e218]:
                    - text: Ville*
                    - generic [ref=f5e219]: (obligatoire)
                  - combobox "Ville (obligatoire)" [ref=f5e221] [cursor=pointer]:
                    - option "Cap Skirring"
                    - option "Dakar" [selected]
                    - option "Diamniadio"
                    - option "Diourbel"
                    - option "Fatick"
                    - option "Guédiawaye"
                    - option "Joal-Fadiouth"
                    - option "Kaffrine"
                    - option "Kaolack"
                    - option "Kédougou"
                    - option "Kolda"
                    - option "Louga"
                    - option "Matam"
                    - option "Mbacké"
                    - option "Mbour"
                    - option "Pikine"
                    - option "Richard-Toll"
                    - option "Rufisque"
                    - option "Saint-Louis"
                    - option "Saly"
                    - option "Sédhiou"
                    - option "Tambacounda"
                    - option "Thiès"
                    - option "Tivaouane"
                    - option "Touba"
                    - option "Ziguinchor"
                    - option "Autre ville"
              - generic [ref=f5e222]:
                - generic [ref=f5e223]: Capacité totale (jauge)
                - spinbutton "Capacité totale (jauge)" [ref=f5e225]
                - paragraph [ref=f5e226]: Facultative. La somme des quantités des catégories actives ne peut pas la dépasser.
            - generic [ref=f5e227]:
              - button "Précédent" [disabled] [ref=f5e228]
              - button "Suivant" [ref=f5e234] [cursor=pointer]
  - alert [ref=f5e239]
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
      |                                                                                        ^ Error: contrôles responsive de org-creation (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```