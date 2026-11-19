# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · organisateur >> org-modification — Modification d’un événement
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de org-modification (clair)

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
              - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=f5e115]': Publié
              - heading "Modifier l’événement" [level=1] [ref=f5e118]
              - paragraph [ref=f5e119]: Festival Jazz sur le Fleuve
          - status [ref=f5e120]:
            - generic [ref=f5e125]:
              - paragraph [ref=f5e126]: "Votre événement est validé : ce que vos modifications changent"
              - list [ref=f5e128]:
                - listitem [ref=f5e129]: "Description, programme, informations pratiques et affiche : modifiables à tout moment, personne n’est prévenu."
                - listitem [ref=f5e130]: "Dates, heures, lieu, ville et adresse : les détenteurs de billets, invités compris, sont prévenus dans l’application et par SMS. Avant d’enregistrer, vous voyez combien recevront un SMS et à quelle heure."
                - listitem [ref=f5e131]: "Titre : les détenteurs de billets sont prévenus dans l’application."
                - listitem [ref=f5e132]: Déplacer le repère de plus de 200 m prévient les détenteurs de billets par SMS.
                - listitem [ref=f5e133]: "Un seul SMS par heure : les changements faits dans l’heure partent ensemble. À moins d’une heure du début, l’avis part tout de suite."
                - listitem [ref=f5e134]: "Type d’événement : verrouillé dès qu’un billet est vendu, réservé ou offert. Jauge : elle ne peut alors plus être retirée ni descendre sous les billets vendus et en cours de paiement, et jamais sous la somme des quantités des catégories actives."
          - navigation "Étapes du formulaire" [ref=f5e135]:
            - paragraph [ref=f5e136]: "Étape 1 sur 5 : Informations générales"
            - list [ref=f5e137]:
              - listitem [ref=f5e138]:
                - button "Informations générales" [ref=f5e139] [cursor=pointer]:
                  - generic [aria-hidden] [ref=f5e140]: "1"
                  - generic [aria-hidden] [ref=f5e141]: Informations
              - listitem [ref=f5e143]:
                - button "Programme" [ref=f5e144] [cursor=pointer]:
                  - generic [aria-hidden] [ref=f5e145]: "2"
                  - generic [aria-hidden] [ref=f5e146]: Programme
              - listitem [ref=f5e148]:
                - button "Accès et informations pratiques" [ref=f5e149] [cursor=pointer]:
                  - generic [aria-hidden] [ref=f5e150]: "3"
                  - generic [aria-hidden] [ref=f5e151]: Accès
              - listitem [ref=f5e153]:
                - button "Billetterie" [ref=f5e154] [cursor=pointer]:
                  - generic [aria-hidden] [ref=f5e155]: "4"
                  - generic [aria-hidden] [ref=f5e156]: Billets
              - listitem [ref=f5e158]:
                - button "Contrôle à l’entrée (facultatif)" [ref=f5e159] [cursor=pointer]:
                  - generic [aria-hidden] [ref=f5e160]: "5"
                  - generic [aria-hidden] [ref=f5e161]: Contrôle
              - listitem [ref=f5e163]:
                - button "Vérifier avant d’envoyer" [ref=f5e164] [cursor=pointer]:
                  - generic [aria-hidden] [ref=f5e168]: Vérifier
          - generic [ref=f5e170]:
            - heading "Informations générales" [level=2] [ref=f5e171]
            - generic [ref=f5e172]:
              - generic [ref=f5e173]:
                - generic [ref=f5e175]:
                  - text: Titre de l’événement*
                  - generic [ref=f5e176]: (obligatoire)
                - textbox "Titre de l’événement (obligatoire)" [ref=f5e177]:
                  - /placeholder: "Par exemple : Nuit du Mbalax"
                  - text: Festival Jazz sur le Fleuve
                - paragraph [ref=f5e178]: Les détenteurs de billets seront prévenus de ce changement.
              - generic [ref=f5e179]:
                - generic [ref=f5e180]:
                  - text: Type d’événement*
                  - generic [ref=f5e181]: (obligatoire)
                - radiogroup "Type d’événement (obligatoire)" [ref=f5e182]:
                  - radio "Concerts & Musique" [disabled] [ref=f5e183]
                  - radio "Festivals" [checked] [disabled] [ref=f5e185]
                  - radio "Gastronomie & Tables" [disabled] [ref=f5e189]
                  - radio "Salles & Réceptions" [disabled] [ref=f5e191]
                - paragraph [ref=f5e193]: "Verrouillé : des billets ont déjà été vendus ou réservés."
              - generic [ref=f5e197]:
                - generic [ref=f5e198]:
                  - generic [ref=f5e199]: Description
                  - generic [ref=f5e200]: 103 / 5000
                - textbox "Description" [ref=f5e201]:
                  - /placeholder: "Présentez l’événement : artistes, ambiance, public attendu…"
                  - text: "Deux soirées de jazz au bord du fleuve : quartets, big band du conservatoire et jam session de clôture."
              - generic [ref=f5e202]:
                - generic [ref=f5e203]: Affiche de l’événement
                - button "Affiche de l’événement" [ref=f5e204]
                - generic [ref=f5e205]:
                  - 'img "Aperçu : Affiche de l’événement" [ref=f5e206]'
                  - generic [ref=f5e207]:
                    - generic [ref=f5e208]: Aperçu sur les cartes du site
                    - generic [ref=f5e209]:
                      - generic [ref=f5e210] [cursor=pointer]: Remplacer l’image
                      - button "Supprimer l’image sélectionnée" [ref=f5e216] [cursor=pointer]
                - paragraph [ref=f5e221]: "Format conseillé : paysage, 1 600 × 1 000 pixels (proportion des cartes du site), recadré au centre. JPEG, PNG ou WebP, 5 Mo au plus. Obligatoire pour soumettre l’événement à la validation."
              - group "Dates et horaires (heure de Dakar)" [ref=f5e222]:
                - generic [ref=f5e224]:
                  - generic [ref=f5e225]:
                    - generic [ref=f5e227]:
                      - text: Date de début*
                      - generic [ref=f5e228]: (obligatoire)
                    - textbox "Date de début (obligatoire)" [ref=f5e229]: 2026-12-01
                    - paragraph [ref=f5e230]: Les détenteurs de billets seront prévenus de ce changement.
                  - generic [ref=f5e231]:
                    - generic [ref=f5e233]:
                      - text: Heure de début*
                      - generic [ref=f5e234]: (obligatoire)
                    - textbox "Heure de début (obligatoire)" [ref=f5e235]: 18:00
                    - paragraph [ref=f5e236]: Les détenteurs de billets seront prévenus de ce changement.
                  - generic [ref=f5e237]:
                    - generic [ref=f5e238]: Date de fin
                    - textbox "Date de fin" [ref=f5e240]: 2026-12-02
                    - paragraph [ref=f5e241]: Facultative. Pour une soirée qui passe minuit, indiquez la date du lendemain. Les détenteurs de billets seront prévenus de ce changement.
                  - generic [ref=f5e242]:
                    - generic [ref=f5e243]: Heure de fin
                    - textbox "Heure de fin" [ref=f5e245]: 00:00
                    - paragraph [ref=f5e246]: Facultative ; avec une heure de fin, la date de fin est demandée. Les détenteurs de billets seront prévenus de ce changement.
              - generic [ref=f5e247]:
                - generic [ref=f5e248]:
                  - generic [ref=f5e250]:
                    - text: Lieu*
                    - generic [ref=f5e251]: (obligatoire)
                  - textbox "Lieu (obligatoire)" [ref=f5e252]:
                    - /placeholder: "Par exemple : Grand Théâtre National"
                    - text: Quai des Pêcheurs
                  - paragraph [ref=f5e253]: Les détenteurs de billets seront prévenus de ce changement.
                - generic [ref=f5e254]:
                  - generic [ref=f5e256]:
                    - text: Ville*
                    - generic [ref=f5e257]: (obligatoire)
                  - combobox "Ville (obligatoire)" [ref=f5e259] [cursor=pointer]:
                    - option "Cap Skirring"
                    - option "Dakar"
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
                    - option "Saint-Louis" [selected]
                    - option "Saly"
                    - option "Sédhiou"
                    - option "Tambacounda"
                    - option "Thiès"
                    - option "Tivaouane"
                    - option "Touba"
                    - option "Ziguinchor"
                    - option "Autre ville"
                  - paragraph [ref=f5e260]: Les détenteurs de billets seront prévenus de ce changement.
              - generic [ref=f5e261]:
                - generic [ref=f5e262]: Capacité totale (jauge)
                - spinbutton "Capacité totale (jauge)" [ref=f5e268]: "400"
                - paragraph [ref=f5e269]: "Des billets sont vendus ou réservés : la jauge ne peut plus être retirée ni descendre sous 370 places."
            - generic [ref=f5e270]:
              - button "Précédent" [disabled] [ref=f5e271]
              - generic [ref=f5e276]:
                - button "Suivant" [ref=f5e277] [cursor=pointer]
                - button "Enregistrer les modifications" [ref=f5e282] [cursor=pointer]
  - alert [ref=f5e289]
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
      |                                                                                        ^ Error: contrôles responsive de org-modification (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```