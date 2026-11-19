# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · client >> profil — Profil
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de profil (clair)

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
          - generic [ref=f5e77]:
            - heading "Mon profil" [level=1] [ref=f5e78]
            - paragraph [ref=f5e79]: Vos coordonnées, vos préférences et la sécurité de votre compte.
          - region [ref=f5e80]:
            - generic [ref=f5e81]:
              - generic [aria-hidden] [ref=f5e82]: FM
              - button "Choisir une photo" [ref=f5e84] [cursor=pointer]
              - paragraph [ref=f5e90]: JPEG, PNG ou WebP, 2 Mo au plus.
            - generic [ref=f5e91]:
              - heading "Fatou Mbaye" [level=2] [ref=f5e92]
              - generic [ref=f5e93]:
                - generic [ref=f5e94]:
                  - term [ref=f5e95]:
                    - generic [ref=f5e98]: Téléphone
                  - definition [ref=f5e99]: +221 70 000 01 05
                - generic [ref=f5e100]:
                  - term [ref=f5e101]:
                    - generic [ref=f5e105]: Email
                  - definition [ref=f5e106]: fatou.mbaye@demo.eventvillage.local
                - generic [ref=f5e107]:
                  - term [ref=f5e108]:
                    - generic [ref=f5e112]: "Rôle :"
                  - definition [ref=f5e113]: Client
                - generic [ref=f5e114]:
                  - term [ref=f5e115]:
                    - generic [ref=f5e119]: Statut du compte
                  - definition [ref=f5e120]: Compte actif
          - region [ref=f5e121]:
            - heading "Mes informations" [level=2] [ref=f5e122]
            - generic [ref=f5e123]:
              - generic [ref=f5e124]:
                - generic [ref=f5e125]:
                  - generic [ref=f5e126]: Prénom
                  - textbox "Prénom" [ref=f5e128]: Fatou
                - generic [ref=f5e129]:
                  - generic [ref=f5e130]: Nom
                  - textbox "Nom" [ref=f5e132]: Mbaye
              - generic [ref=f5e133]:
                - generic [ref=f5e134]: Adresse email
                - textbox "Adresse email" [ref=f5e136]: fatou.mbaye.pro@demo.eventvillage.local
                - paragraph [ref=f5e137]: "Recommandé : recevez vos billets et confirmations par email"
              - status [ref=f5e138]:
                - generic [ref=f5e144]:
                  - paragraph [ref=f5e145]: Adresse email non vérifiée
                  - generic [ref=f5e146]: "fatou.mbaye.pro@demo.eventvillage.local : ouvrez le lien reçu par email pour la vérifier. En attendant, connectez-vous avec votre numéro."
                - button "Recevoir le lien de vérification" [ref=f5e148] [cursor=pointer]
              - button "Enregistrer le profil" [ref=f5e154] [cursor=pointer]
            - generic [ref=f5e161]:
              - generic [ref=f5e162]:
                - paragraph [ref=f5e163]: Numéro de téléphone
                - paragraph [ref=f5e164]: Un code envoyé au nouveau numéro confirme le changement.
              - button "Changer de numéro" [ref=f5e165] [cursor=pointer]
            - generic [ref=f5e167]:
              - generic [ref=f5e168]:
                - paragraph [ref=f5e169]: Mot de passe
                - paragraph [ref=f5e170]: Les autres appareils seront déconnectés.
              - button "Changer de mot de passe" [ref=f5e171] [cursor=pointer]
          - region [ref=f5e173]:
            - heading "Mon activité" [level=2] [ref=f5e174]
            - list [ref=f5e175]:
              - listitem [ref=f5e176]:
                - link "Mes billets Vos billets, leur QR code et vos transferts" [ref=f5e177] [cursor=pointer]:
                  - /url: /tickets
                  - generic [ref=f5e182]:
                    - generic [ref=f5e183]: Mes billets
                    - generic [ref=f5e184]: Vos billets, leur QR code et vos transferts
              - listitem [ref=f5e187]:
                - link "Mes paiements L’historique de vos paiements et de vos remboursements" [ref=f5e188] [cursor=pointer]:
                  - /url: /profile/payments
                  - generic [ref=f5e193]:
                    - generic [ref=f5e194]: Mes paiements
                    - generic [ref=f5e195]: L’historique de vos paiements et de vos remboursements
              - listitem [ref=f5e198]:
                - link "Portefeuille de parrainage Vos gains de parrainage et vos demandes de retrait" [ref=f5e199] [cursor=pointer]:
                  - /url: /wallet
                  - generic [ref=f5e205]:
                    - generic [ref=f5e206]: Portefeuille de parrainage
                    - generic [ref=f5e207]: Vos gains de parrainage et vos demandes de retrait
          - region [ref=f5e210]:
            - heading "Préférences" [level=2] [ref=f5e211]
            - link "Préférences de notification Rappels, changements d’événement, SMS et notifications sur cet appareil" [ref=f5e212] [cursor=pointer]:
              - /url: /profile/notifications
              - generic [ref=f5e218]:
                - generic [ref=f5e219]: Préférences de notification
                - generic [ref=f5e220]: Rappels, changements d’événement, SMS et notifications sur cet appareil
            - generic [ref=f5e223]:
              - heading "Affichage" [level=3] [ref=f5e224]
              - group "Affichage" [ref=f5e225]:
                - button "Clair" [pressed] [ref=f5e226] [cursor=pointer]
                - button "Sombre" [ref=f5e234] [cursor=pointer]
                - button "Système" [ref=f5e238] [cursor=pointer]
          - region [ref=f5e242]:
            - generic [ref=f5e248]:
              - heading "Sécurité" [level=2] [ref=f5e249]
              - paragraph [ref=f5e250]: « Se déconnecter » ferme seulement cet appareil.
            - button "Se déconnecter" [ref=f5e251] [cursor=pointer]
            - button "Déconnecter tous mes appareils" [ref=f5e257] [cursor=pointer]
  - alert [ref=f5e263]
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
      |                                                                                        ^ Error: contrôles responsive de profil (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```