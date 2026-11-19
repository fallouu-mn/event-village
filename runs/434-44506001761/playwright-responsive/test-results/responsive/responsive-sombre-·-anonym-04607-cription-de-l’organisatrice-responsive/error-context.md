# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> sombre · anonyme >> inscription-partenaire — Inscription de l’organisatrice
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de inscription-partenaire (sombre)

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
          - link "Event Village, accueil" [ref=f2e74] [cursor=pointer]:
            - /url: /
            - generic [ref=f2e75]: Event Village
          - generic [ref=f2e80]:
            - generic [ref=f2e81]: Espace professionnel
            - heading "Devenir partenaire Event Village" [level=1] [ref=f2e88]
            - paragraph [ref=f2e89]: Publiez vos événements et vendez vos billets en ligne, avec des reversements par SamirPay. Votre dossier est vérifié par notre équipe avant l’ouverture de votre espace.
          - paragraph [ref=f2e90]: "Étape 1 sur 2 : votre dossier"
          - generic [ref=f2e91]:
            - region [ref=f2e92]:
              - heading "1. Votre structure" [level=2] [ref=f2e93]
              - generic [ref=f2e98]:
                - generic [ref=f2e99]:
                  - generic [ref=f2e101]:
                    - text: Raison sociale*
                    - generic [ref=f2e102]: (obligatoire)
                  - textbox "Raison sociale (obligatoire)" [ref=f2e103]:
                    - /placeholder: Nom légal de la société
                - generic [ref=f2e104]:
                  - generic [ref=f2e105]: Nom commercial (enseigne)
                  - textbox "Nom commercial (enseigne)" [ref=f2e107]:
                    - /placeholder: Nom connu du public
              - group "Activités proposées (obligatoire)" [ref=f2e108]:
                - generic [ref=f2e109]:
                  - text: Activités proposées*
                  - generic [ref=f2e110]: (obligatoire)
                - paragraph [ref=f2e111]: Touchez une ou plusieurs activités.
                - generic [ref=f2e112]:
                  - button "Restaurant" [ref=f2e113] [cursor=pointer]
                  - button "Traiteur et buffet" [ref=f2e116] [cursor=pointer]
                  - button "Salle de fête et de réception" [ref=f2e119] [cursor=pointer]
                  - button "Organisation d’événements et festivals" [pressed] [ref=f2e122] [cursor=pointer]
                  - button "Prestataire (son, lumière, scène)" [ref=f2e127] [cursor=pointer]
                  - button "Pâtisserie et desserts" [ref=f2e130] [cursor=pointer]
                  - button "Établissement alimentaire" [ref=f2e133] [cursor=pointer]
                  - button "Autre service événementiel" [ref=f2e136] [cursor=pointer]
              - generic [ref=f2e139]:
                - generic [ref=f2e140]:
                  - generic [ref=f2e141]:
                    - text: Présentation de votre structure*
                    - generic [ref=f2e142]: (obligatoire)
                  - generic [ref=f2e143]: 0 / 2000
                - textbox "Présentation de votre structure (obligatoire)" [ref=f2e144]
                - paragraph [ref=f2e145]: "10 caractères au moins : capacité d’accueil, prestations, spécialités."
              - generic [ref=f2e146]:
                - generic [ref=f2e147]:
                  - generic [ref=f2e149]:
                    - text: Adresse*
                    - generic [ref=f2e150]: (obligatoire)
                  - textbox "Adresse (obligatoire)" [ref=f2e151]:
                    - /placeholder: Boulevard Martin Luther King
                - generic [ref=f2e152]:
                  - generic [ref=f2e154]:
                    - text: Ville*
                    - generic [ref=f2e155]: (obligatoire)
                  - textbox "Ville (obligatoire)" [ref=f2e156]:
                    - /placeholder: Dakar
                    - text: Dakar
              - generic [ref=f2e157]:
                - generic [ref=f2e158]:
                  - generic [ref=f2e159]: NINEA (facultatif)
                  - textbox "NINEA (facultatif)" [ref=f2e161]
                - generic [ref=f2e162]:
                  - generic [ref=f2e163]: RCCM (facultatif)
                  - textbox "RCCM (facultatif)" [ref=f2e165]
            - region [ref=f2e166]:
              - heading "2. Le gérant et le compte" [level=2] [ref=f2e167]
              - generic [ref=f2e171]:
                - generic [ref=f2e172]:
                  - generic [ref=f2e174]:
                    - text: Prénom*
                    - generic [ref=f2e175]: (obligatoire)
                  - textbox "Prénom (obligatoire)" [ref=f2e176]
                - generic [ref=f2e177]:
                  - generic [ref=f2e179]:
                    - text: Nom*
                    - generic [ref=f2e180]: (obligatoire)
                  - textbox "Nom (obligatoire)" [ref=f2e181]
                - generic [ref=f2e182]:
                  - generic [ref=f2e184]:
                    - text: Téléphone professionnel*
                    - generic [ref=f2e185]: (obligatoire)
                  - textbox "Téléphone professionnel (obligatoire)" [ref=f2e186]:
                    - /placeholder: 77 800 00 00
                  - paragraph [ref=f2e187]: Le code de vérification est envoyé à ce numéro. Il ne doit pas déjà servir à un compte.
                - generic [ref=f2e188]:
                  - generic [ref=f2e190]:
                    - text: Email professionnel*
                    - generic [ref=f2e191]: (obligatoire)
                  - textbox "Email professionnel (obligatoire)" [ref=f2e192]:
                    - /placeholder: direction@etablissement.sn
                  - paragraph [ref=f2e193]: "Recommandé : recevez vos billets et confirmations par email. Un lien de vérification vous est envoyé ; l’adresse ne reçoit rien d’autre tant qu’elle n’est pas vérifiée."
                - generic [ref=f2e194]:
                  - generic [ref=f2e196]:
                    - text: Mot de passe*
                    - generic [ref=f2e197]: (obligatoire)
                  - textbox "Mot de passe (obligatoire)" [ref=f2e198]
                - generic [ref=f2e199]:
                  - generic [ref=f2e201]:
                    - text: Confirmer le mot de passe*
                    - generic [ref=f2e202]: (obligatoire)
                  - textbox "Confirmer le mot de passe (obligatoire)" [ref=f2e203]
            - region [ref=f2e204]:
              - heading "3. Pièces justificatives" [level=2] [ref=f2e205]
              - paragraph [ref=f2e208]: Les deux pièces sont obligatoires. Elles sont rangées dans un espace privé, lues seulement par l’équipe qui valide votre dossier. PDF, JPEG, PNG ou WebP, 10 Mo au plus.
              - generic [ref=f2e209]:
                - generic [ref=f2e210]:
                  - generic [ref=f2e211]:
                    - text: Pièce d’identité du gérant*
                    - generic [ref=f2e212]: (obligatoire)
                  - paragraph [ref=f2e213]: CNI ou passeport en cours de validité.
                  - button "Pièce d’identité du gérant (obligatoire)" [ref=f2e214]
                - generic [ref=f2e215]:
                  - generic [ref=f2e216]:
                    - text: Document de l’entreprise*
                    - generic [ref=f2e217]: (obligatoire)
                  - paragraph [ref=f2e218]: Extrait RCCM ou attestation NINEA.
                  - button "Document de l’entreprise (obligatoire)" [ref=f2e219]
            - paragraph [ref=f2e220]: Un code vous est d’abord envoyé par SMS au téléphone professionnel ; le dossier n’est enregistré qu’une fois ce code saisi.
            - button "Envoyer mon dossier" [ref=f2e221] [cursor=pointer]
            - generic [ref=f2e227]:
              - generic [ref=f2e228]: Déjà partenaire ?
              - link "Se connecter" [ref=f2e229] [cursor=pointer]:
                - /url: /login
  - alert [ref=f2e231]
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
      |                                                                                        ^ Error: contrôles responsive de inscription-partenaire (sombre)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```