# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · anonyme >> inscription-partenaire — Inscription de l’organisatrice
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de inscription-partenaire (clair)

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
        - link "Se connecter" [ref=f5e42] [cursor=pointer]:
          - /url: /login
        - button "Basculer le thème" [ref=f5e48] [cursor=pointer]
    - generic [ref=f5e52]:
      - banner [ref=f5e53]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f5e55] [cursor=pointer]:
          - /url: /explore
        - button "Notifications" [ref=f5e62] [cursor=pointer]
      - main [ref=f5e66]:
        - generic [ref=f5e68]:
          - link "Event Village, accueil" [ref=f5e70] [cursor=pointer]:
            - /url: /
            - generic [ref=f5e71]: Event Village
          - generic [ref=f5e76]:
            - generic [ref=f5e77]: Espace professionnel
            - heading "Devenir partenaire Event Village" [level=1] [ref=f5e84]
            - paragraph [ref=f5e85]: Publiez vos événements et vendez vos billets en ligne, avec des reversements par SamirPay. Votre dossier est vérifié par notre équipe avant l’ouverture de votre espace.
          - paragraph [ref=f5e86]: "Étape 1 sur 2 : votre dossier"
          - generic [ref=f5e87]:
            - region [ref=f5e88]:
              - heading "1. Votre structure" [level=2] [ref=f5e89]
              - generic [ref=f5e94]:
                - generic [ref=f5e95]:
                  - generic [ref=f5e97]:
                    - text: Raison sociale*
                    - generic [ref=f5e98]: (obligatoire)
                  - textbox "Raison sociale (obligatoire)" [ref=f5e99]:
                    - /placeholder: Nom légal de la société
                - generic [ref=f5e100]:
                  - generic [ref=f5e101]: Nom commercial (enseigne)
                  - textbox "Nom commercial (enseigne)" [ref=f5e103]:
                    - /placeholder: Nom connu du public
              - group "Activités proposées (obligatoire)" [ref=f5e104]:
                - generic [ref=f5e105]:
                  - text: Activités proposées*
                  - generic [ref=f5e106]: (obligatoire)
                - paragraph [ref=f5e107]: Touchez une ou plusieurs activités.
                - generic [ref=f5e108]:
                  - button "Restaurant" [ref=f5e109] [cursor=pointer]
                  - button "Traiteur et buffet" [ref=f5e112] [cursor=pointer]
                  - button "Salle de fête et de réception" [ref=f5e115] [cursor=pointer]
                  - button "Organisation d’événements et festivals" [pressed] [ref=f5e118] [cursor=pointer]
                  - button "Prestataire (son, lumière, scène)" [ref=f5e123] [cursor=pointer]
                  - button "Pâtisserie et desserts" [ref=f5e126] [cursor=pointer]
                  - button "Établissement alimentaire" [ref=f5e129] [cursor=pointer]
                  - button "Autre service événementiel" [ref=f5e132] [cursor=pointer]
              - generic [ref=f5e135]:
                - generic [ref=f5e136]:
                  - generic [ref=f5e137]:
                    - text: Présentation de votre structure*
                    - generic [ref=f5e138]: (obligatoire)
                  - generic [ref=f5e139]: 0 / 2000
                - textbox "Présentation de votre structure (obligatoire)" [ref=f5e140]
                - paragraph [ref=f5e141]: "10 caractères au moins : capacité d’accueil, prestations, spécialités."
              - generic [ref=f5e142]:
                - generic [ref=f5e143]:
                  - generic [ref=f5e145]:
                    - text: Adresse*
                    - generic [ref=f5e146]: (obligatoire)
                  - textbox "Adresse (obligatoire)" [ref=f5e147]:
                    - /placeholder: Boulevard Martin Luther King
                - generic [ref=f5e148]:
                  - generic [ref=f5e150]:
                    - text: Ville*
                    - generic [ref=f5e151]: (obligatoire)
                  - textbox "Ville (obligatoire)" [ref=f5e152]:
                    - /placeholder: Dakar
                    - text: Dakar
              - generic [ref=f5e153]:
                - generic [ref=f5e154]:
                  - generic [ref=f5e155]: NINEA (facultatif)
                  - textbox "NINEA (facultatif)" [ref=f5e157]
                - generic [ref=f5e158]:
                  - generic [ref=f5e159]: RCCM (facultatif)
                  - textbox "RCCM (facultatif)" [ref=f5e161]
            - region [ref=f5e162]:
              - heading "2. Le gérant et le compte" [level=2] [ref=f5e163]
              - generic [ref=f5e167]:
                - generic [ref=f5e168]:
                  - generic [ref=f5e170]:
                    - text: Prénom*
                    - generic [ref=f5e171]: (obligatoire)
                  - textbox "Prénom (obligatoire)" [ref=f5e172]
                - generic [ref=f5e173]:
                  - generic [ref=f5e175]:
                    - text: Nom*
                    - generic [ref=f5e176]: (obligatoire)
                  - textbox "Nom (obligatoire)" [ref=f5e177]
                - generic [ref=f5e178]:
                  - generic [ref=f5e180]:
                    - text: Téléphone professionnel*
                    - generic [ref=f5e181]: (obligatoire)
                  - textbox "Téléphone professionnel (obligatoire)" [ref=f5e182]:
                    - /placeholder: 77 800 00 00
                  - paragraph [ref=f5e183]: Le code de vérification est envoyé à ce numéro. Il ne doit pas déjà servir à un compte.
                - generic [ref=f5e184]:
                  - generic [ref=f5e186]:
                    - text: Email professionnel*
                    - generic [ref=f5e187]: (obligatoire)
                  - textbox "Email professionnel (obligatoire)" [ref=f5e188]:
                    - /placeholder: direction@etablissement.sn
                  - paragraph [ref=f5e189]: "Recommandé : recevez vos billets et confirmations par email. Un lien de vérification vous est envoyé ; l’adresse ne reçoit rien d’autre tant qu’elle n’est pas vérifiée."
                - generic [ref=f5e190]:
                  - generic [ref=f5e192]:
                    - text: Mot de passe*
                    - generic [ref=f5e193]: (obligatoire)
                  - textbox "Mot de passe (obligatoire)" [ref=f5e194]
                - generic [ref=f5e195]:
                  - generic [ref=f5e197]:
                    - text: Confirmer le mot de passe*
                    - generic [ref=f5e198]: (obligatoire)
                  - textbox "Confirmer le mot de passe (obligatoire)" [ref=f5e199]
            - region [ref=f5e200]:
              - heading "3. Pièces justificatives" [level=2] [ref=f5e201]
              - paragraph [ref=f5e204]: Les deux pièces sont obligatoires. Elles sont rangées dans un espace privé, lues seulement par l’équipe qui valide votre dossier. PDF, JPEG, PNG ou WebP, 10 Mo au plus.
              - generic [ref=f5e205]:
                - generic [ref=f5e206]:
                  - generic [ref=f5e207]:
                    - text: Pièce d’identité du gérant*
                    - generic [ref=f5e208]: (obligatoire)
                  - paragraph [ref=f5e209]: CNI ou passeport en cours de validité.
                  - button "Pièce d’identité du gérant (obligatoire)" [ref=f5e210]
                - generic [ref=f5e211]:
                  - generic [ref=f5e212]:
                    - text: Document de l’entreprise*
                    - generic [ref=f5e213]: (obligatoire)
                  - paragraph [ref=f5e214]: Extrait RCCM ou attestation NINEA.
                  - button "Document de l’entreprise (obligatoire)" [ref=f5e215]
            - paragraph [ref=f5e216]: Un code vous est d’abord envoyé par SMS au téléphone professionnel ; le dossier n’est enregistré qu’une fois ce code saisi.
            - button "Envoyer mon dossier" [ref=f5e217] [cursor=pointer]
            - generic [ref=f5e223]:
              - generic [ref=f5e224]: Déjà partenaire ?
              - link "Se connecter" [ref=f5e225] [cursor=pointer]:
                - /url: /login
  - alert [ref=f5e227]
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
      |                                                                                        ^ Error: contrôles responsive de inscription-partenaire (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```