# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · client >> notifications — Notifications
- Location: e2e/responsive.spec.ts:76:21

# Error details

```
Error: contrôles responsive de notifications (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "1024 px : défilement horizontal (largeur du document 1030 px, fenêtre 1024 px)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=f5e1]:
  - generic [ref=f5e3]:
    - banner [ref=f5e4]:
      - generic [ref=f5e5]:
        - link "Event Village, accueil" [ref=f5e7] [cursor=pointer]:
          - /url: /
          - generic [ref=f5e8]: Event Village
        - navigation "Rubriques" [ref=f5e13]:
          - link "Accueil" [ref=f5e14] [cursor=pointer]:
            - /url: /
          - link "Explorer" [ref=f5e15] [cursor=pointer]:
            - /url: /explore
          - link "Mes billets" [ref=f5e16] [cursor=pointer]:
            - /url: /tickets
          - link "Portefeuille" [ref=f5e17] [cursor=pointer]:
            - /url: /wallet
      - link "Rechercher un événement…" [ref=f5e19] [cursor=pointer]:
        - /url: /explore
      - generic [ref=f5e24]:
        - button "Notifications, 10 non lues" [ref=f5e26] [cursor=pointer]:
          - generic [ref=f5e30]: "10"
        - button "Fatou Mbaye" [ref=f5e32] [cursor=pointer]:
          - generic [aria-hidden] [ref=f5e33]: FM
    - main [ref=f5e37]:
      - generic [ref=f5e39]:
        - generic [ref=f5e41]:
          - generic [ref=f5e42]:
            - status [ref=f5e44]: En direct
            - heading "Notifications" [level=1] [ref=f5e46]
            - paragraph [ref=f5e47]: "Billets, rappels, paiements et changements d’événement : ce qui concerne votre compte, mis à jour en direct."
          - generic [ref=f5e48]:
            - button "Tout marquer comme lu" [ref=f5e49] [cursor=pointer]
            - link "Préférences" [ref=f5e55] [cursor=pointer]:
              - /url: /profile/notifications
        - tablist "Filtrer mes notifications" [ref=f5e63]:
          - tab "Toutes" [selected] [ref=f5e64] [cursor=pointer]
          - tab "Non lues , 10" [ref=f5e66] [cursor=pointer]:
            - generic [ref=f5e67]: Non lues
            - generic [ref=f5e68]:
              - generic [ref=f5e69]: ","
              - text: "10"
          - tab "Événements" [ref=f5e70] [cursor=pointer]
          - tab "Billets" [ref=f5e72] [cursor=pointer]
          - tab "Paiements et remboursements" [ref=f5e74] [cursor=pointer]
          - tab "Réservations et commandes" [ref=f5e76] [cursor=pointer]
          - tab "Compte" [ref=f5e78] [cursor=pointer]
          - tab "Alertes" [ref=f5e80] [cursor=pointer]
          - tab "Informations" [ref=f5e82] [cursor=pointer]
        - tabpanel "Toutes" [ref=f5e84]:
          - list [ref=f5e85]:
            - listitem [ref=f5e86]:
              - generic [ref=f5e92]:
                - generic [ref=f5e93]:
                  - heading "Réservation demandée" [level=2] [ref=f5e94]
                  - generic [ref=f5e95]: Non lue
                - generic [ref=f5e97]: Réservation de salle
                - paragraph [ref=f5e99]: "Votre demande pour « Salle des Fromagers » le mar. 15 déc. 2026 est enregistrée. Payez 189 000 F CFA avant 03:26 pour garder la date : sans paiement, elle sera libérée."
                - paragraph [ref=f5e100]:
                  - time [ref=f5e101]: Il y a 2 min
              - generic [ref=f5e102]:
                - button "Marquer comme lue" [ref=f5e103] [cursor=pointer]
                - link "Voir le détail" [ref=f5e109] [cursor=pointer]:
                  - /url: /halls/reservations/04221ae3-9cc4-4f2d-920a-07bd65ec200c
            - listitem [ref=f5e114]:
              - generic [ref=f5e121]:
                - generic [ref=f5e122]:
                  - heading "Événement annulé" [level=2] [ref=f5e123]
                  - generic [ref=f5e124]: Non lue
                - generic [ref=f5e126]: Statut de l’événement
                - paragraph [ref=f5e128]: « Croisière musicale vers Gorée » du sam. 21 nov. 2026 à 07:15 est annulé. La chaloupe prévue n’a pas obtenu son certificat de navigation à temps. Tous les billets payés en ligne sont remboursés automatiquement, sans démarche de votre part. Votre remboursement est en cours.
                - paragraph [ref=f5e129]:
                  - time [ref=f5e130]: Il y a 2 min
              - generic [ref=f5e131]:
                - button "Marquer comme lue" [ref=f5e132] [cursor=pointer]
                - link "Voir le détail" [ref=f5e138] [cursor=pointer]:
                  - /url: /tickets?tab=historique
            - listitem [ref=f5e143]:
              - generic [ref=f5e149]:
                - generic [ref=f5e150]:
                  - heading "Remboursement versé" [level=2] [ref=f5e151]
                  - generic [ref=f5e152]: Non lue
                - paragraph [ref=f5e154]: 15 750 F CFA vous ont été remboursés sur votre compte Wave pour « Croisière musicale vers Gorée ».
                - paragraph [ref=f5e155]:
                  - time [ref=f5e156]: Il y a 2 min
              - generic [ref=f5e157]:
                - button "Marquer comme lue" [ref=f5e158] [cursor=pointer]
                - link "Voir le détail" [ref=f5e164] [cursor=pointer]:
                  - /url: /tickets?tab=historique
            - listitem [ref=f5e169]:
              - generic [ref=f5e174]:
                - generic [ref=f5e175]:
                  - heading "Bienvenue" [level=2] [ref=f5e176]
                  - generic [ref=f5e177]: Non lue
                - generic [ref=f5e179]: Entrée contrôlée
                - paragraph [ref=f5e181]: Bienvenue à « Nuit du Sabar — édition d’automne » ! Bonne soirée avec Baobab Scène Productions. Votre entrée est validée.
                - paragraph [ref=f5e182]:
                  - time [ref=f5e183]: Il y a 2 min
              - generic [ref=f5e184]:
                - button "Marquer comme lue" [ref=f5e185] [cursor=pointer]
                - link "Voir le détail" [ref=f5e191] [cursor=pointer]:
                  - /url: /events/7a42d629-fb05-4355-bc58-05afff398979
            - listitem [ref=f5e196]:
              - generic [ref=f5e201]:
                - generic [ref=f5e202]:
                  - heading "Bienvenue" [level=2] [ref=f5e203]
                  - generic [ref=f5e204]: Non lue
                - generic [ref=f5e206]: Entrée contrôlée
                - paragraph [ref=f5e208]: Bienvenue à « Brunch électro des Almadies » ! Bonne soirée avec Baobab Scène Productions. Votre entrée est validée.
                - paragraph [ref=f5e209]:
                  - time [ref=f5e210]: Il y a 2 min
              - generic [ref=f5e211]:
                - button "Marquer comme lue" [ref=f5e212] [cursor=pointer]
                - link "Voir le détail" [ref=f5e218] [cursor=pointer]:
                  - /url: /events/e9223584-268b-4216-ac3d-d9b8a80e9c1a
            - listitem [ref=f5e223]:
              - generic [ref=f5e230]:
                - generic [ref=f5e231]:
                  - heading "Invitation de Baobab Scène" [level=2] [ref=f5e232]
                  - generic [ref=f5e233]: Non lue
                - generic [ref=f5e235]: Contrôle d’accès
                - paragraph [ref=f5e237]: Baobab Scène vous invite à contrôler l'entrée de « Festival Jazz sur le Fleuve ». Répondez avant le mar. 24 nov. 2026 à 03:11.
                - paragraph [ref=f5e238]:
                  - time [ref=f5e239]: Il y a 2 min
              - generic [ref=f5e240]:
                - button "Marquer comme lue" [ref=f5e241] [cursor=pointer]
                - link "Voir le détail" [ref=f5e247] [cursor=pointer]:
                  - /url: /invitations
            - listitem [ref=f5e252]:
              - generic [ref=f5e257]:
                - generic [ref=f5e258]:
                  - heading "Un billet vous est transféré" [level=2] [ref=f5e259]
                  - generic [ref=f5e260]: Non lue
                - generic [ref=f5e262]: Transfert de billet
                - paragraph [ref=f5e264]: Un billet pour « Festival Jazz sur le Fleuve » vous attend. Acceptez-le avant le lun. 23 nov. 2026 à 03:11.
                - paragraph [ref=f5e265]:
                  - time [ref=f5e266]: Il y a 2 min
              - generic [ref=f5e267]:
                - button "Marquer comme lue" [ref=f5e268] [cursor=pointer]
                - link "Voir le détail" [ref=f5e274] [cursor=pointer]:
                  - /url: /tickets?tab=recus
            - listitem [ref=f5e279]:
              - generic [ref=f5e284]:
                - generic [ref=f5e285]:
                  - heading "Achat confirmé" [level=2] [ref=f5e286]
                  - generic [ref=f5e287]: Non lue
                - generic [ref=f5e289]: Billet
                - paragraph [ref=f5e291]: "1 billet pour « Festival Jazz sur le Fleuve » le jeu. 3 déc. 2026 à 18:00. Total payé : 7 875 F CFA. Vos billets sont dans Mes billets."
                - paragraph [ref=f5e292]:
                  - time [ref=f5e293]: Il y a 2 min
              - generic [ref=f5e294]:
                - button "Marquer comme lue" [ref=f5e295] [cursor=pointer]
                - link "Voir le détail" [ref=f5e301] [cursor=pointer]:
                  - /url: /tickets?tab=a-venir
            - listitem [ref=f5e306]:
              - generic [ref=f5e311]:
                - generic [ref=f5e312]:
                  - heading "Achat confirmé" [level=2] [ref=f5e313]
                  - generic [ref=f5e314]: Non lue
                - generic [ref=f5e316]: Billet
                - paragraph [ref=f5e318]: "1 billet pour « Concert des Lumières de Gorée » le sam. 21 nov. 2026 à 23:15. Total payé : 6 300 F CFA. Vos billets sont dans Mes billets."
                - paragraph [ref=f5e319]:
                  - time [ref=f5e320]: Il y a 2 min
              - generic [ref=f5e321]:
                - button "Marquer comme lue" [ref=f5e322] [cursor=pointer]
                - link "Voir le détail" [ref=f5e328] [cursor=pointer]:
                  - /url: /tickets?tab=a-venir
            - listitem [ref=f5e333]:
              - generic [ref=f5e338]:
                - generic [ref=f5e339]:
                  - heading "Achat confirmé" [level=2] [ref=f5e340]
                  - generic [ref=f5e341]: Non lue
                - generic [ref=f5e343]: Billet
                - paragraph [ref=f5e345]: "1 billet pour « Croisière musicale vers Gorée » le sam. 21 nov. 2026 à 07:15. Total payé : 15 750 F CFA. Vos billets sont dans Mes billets."
                - paragraph [ref=f5e346]:
                  - time [ref=f5e347]: Il y a 2 min
              - generic [ref=f5e348]:
                - button "Marquer comme lue" [ref=f5e349] [cursor=pointer]
                - link "Voir le détail" [ref=f5e355] [cursor=pointer]:
                  - /url: /tickets?tab=a-venir
            - listitem [ref=f5e360]:
              - generic [ref=f5e365]:
                - heading "Achat confirmé" [level=2] [ref=f5e367]
                - generic [ref=f5e368]: Billet
                - paragraph [ref=f5e370]: "1 billet pour « Brunch électro des Almadies » le sam. 21 nov. 2026 à 04:15. Total payé : 15 750 F CFA. Vos billets sont dans Mes billets."
                - paragraph [ref=f5e371]:
                  - time [ref=f5e372]: Il y a 2 min
              - link "Voir le détail" [ref=f5e374] [cursor=pointer]:
                - /url: /tickets?tab=a-venir
            - listitem [ref=f5e379]:
              - generic [ref=f5e384]:
                - heading "Achat confirmé" [level=2] [ref=f5e386]
                - generic [ref=f5e387]: Billet
                - paragraph [ref=f5e389]: "2 billets pour « Nuit du Sabar — édition d’automne » le sam. 21 nov. 2026 à 04:00. Total payé : 10 500 F CFA. Vos billets sont dans Mes billets."
                - paragraph [ref=f5e390]:
                  - time [ref=f5e391]: Il y a 2 min
              - link "Voir le détail" [ref=f5e393] [cursor=pointer]:
                - /url: /tickets?tab=a-venir
  - alert [ref=f5e398]
```

# Test source

```ts
  20  | import path from 'node:path';
  21  | import type { Page } from '@playwright/test';
  22  | import { test, expect, type CaptureRole, type ThemeKey } from './support/fixtures';
  23  | import { readDemoIds, E2E_OUTPUT_DIR, type DemoIds } from './support/demo-ids';
  24  | import { fakeScanMode, installFakeCamera } from './support/fake-camera';
  25  | import { keepHomeOutOfHallsWindow } from './support/halls-switch';
  26  | import {
  27  |     PHONE_MAX_WIDTH, RESPONSIVE_CAPTURE_WIDTHS, RESPONSIVE_LANDSCAPE, RESPONSIVE_PAGES, RESPONSIVE_WIDTHS, type ResponsivePage,
  28  | } from './support/responsive-pages';
  29  | import { runResponsiveChecks } from './support/responsive-checks';
  30  | 
  31  | const RESULTS = path.join(E2E_OUTPUT_DIR, 'responsive');
  32  | const SHOTS = path.join(E2E_OUTPUT_DIR, 'captures-responsive');
  33  | 
  34  | const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
  35  |     { key: 'clair', colorScheme: 'light' },
  36  |     { key: 'sombre', colorScheme: 'dark' },
  37  | ];
  38  | 
  39  | interface Size { width: number; height: number; paysage?: boolean }
  40  | 
  41  | function sizesFor(p: ResponsivePage, theme: ThemeKey): Size[] {
  42  |     const base: Size[] = RESPONSIVE_WIDTHS
  43  |         .filter((w) => theme === 'clair' || RESPONSIVE_CAPTURE_WIDTHS.includes(w.width))
  44  |         .map((w) => ({ width: w.width, height: w.height }));
  45  |     const land: Size[] = p.paysage ? RESPONSIVE_LANDSCAPE.map((w) => ({ width: w.width, height: w.height, paysage: true })) : [];
  46  |     return [...base, ...land];
  47  | }
  48  | 
  49  | /** Page stable : polices chargées, réseau au repos (plafond 3 s, noté sinon), deux images d'affichage. */
  50  | async function settle(page: Page, notes: string[], at: string): Promise<void> {
  51  |     await page.evaluate(() => document.fonts.ready.then(() => true));
  52  |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => { notes.push(`${at} : réseau jamais au repos en 3 s (attente plafonnée)`); });
  53  |     await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete), undefined, { timeout: 5_000 })
  54  |         .catch(() => { notes.push(`${at} : images encore en chargement après 5 s`); });
  55  |     await page.evaluate(() => new Promise<void>((resolve) => { requestAnimationFrame(() => requestAnimationFrame(() => resolve())); }));
  56  | }
  57  | 
  58  | interface ResponsiveRecord {
  59  |     page: string;
  60  |     titre: string;
  61  |     groupe: string;
  62  |     role: CaptureRole;
  63  |     theme: ThemeKey;
  64  |     url: string | null;
  65  |     sizes: Array<{ size: string; blocking: string[]; warnings: string[]; capture: string | null }>;
  66  |     notes: string[];
  67  |     error: string | null;
  68  | }
  69  | 
  70  | for (const theme of THEMES) {
  71  |     const roles = Array.from(new Set(RESPONSIVE_PAGES.map((p) => p.role)));
  72  |     for (const role of roles) {
  73  |         test.describe(`${theme.key} · ${role}`, () => {
  74  |             test.use({ colorScheme: theme.colorScheme, evTheme: theme.key, evRole: role });
  75  |             for (const p of RESPONSIVE_PAGES.filter((x) => x.role === role)) {
  76  |                 test(`${p.id} — ${p.titre}`, async ({ page, context, guard, hallsLock }) => {
  77  |                     test.setTimeout(240_000);
  78  |                     const record: ResponsiveRecord = { page: p.id, titre: p.titre, groupe: p.groupe, role, theme: theme.key, url: null, sizes: [], notes: [], error: null };
  79  |                     try {
  80  |                         // Lot 10b : verrou des salles avant tout chargement (attente ajoutée au délai du test)
  81  |                         await hallsLock.enter(p.salles ? 'salles' : 'autres');
  82  |                         if (hallsLock.waitedMs >= 1_000) record.notes.push(`attente du verrou des salles : ${Math.round(hallsLock.waitedMs / 1000)} s`);
  83  |                         if (p.salles) {
  84  |                             record.notes.push('page des salles : interrupteur features.halls_enabled ouvert le temps du test (e2e/support/halls-switch.ts)');
  85  |                             await keepHomeOutOfHallsWindow(page);
  86  |                         }
  87  |                         const demo: DemoIds | null = p.needsIds ? readDemoIds() : null;
  88  |                         record.url = p.path(demo);
  89  |                         guard.configure({ allowFailures: p.allowFailures ?? [], ignoreConsoleErrors: false });
  90  |                         if (p.fakeCamera) await context.addInitScript(installFakeCamera, { mode: fakeScanMode() });
  91  |                         for (const size of sizesFor(p, theme.key)) {
  92  |                             const at = size.paysage ? `${size.width}×${size.height} px (paysage)` : `${size.width} px`;
  93  |                             await page.setViewportSize({ width: size.width, height: size.height });
  94  |                             const response = await page.goto(record.url, { waitUntil: 'load' });
  95  |                             if (p.expectStatus !== undefined) expect(response?.status(), `statut HTTP de ${record.url}`).toBe(p.expectStatus);
  96  |                             if (p.ready) await p.ready(page);
  97  |                             else await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  98  |                             if (p.actions) await p.actions(page);
  99  |                             await settle(page, record.notes, at);
  100 |                             const checks = await runResponsiveChecks(page, { width: size.width, phone: !size.paysage && size.width <= PHONE_MAX_WIDTH });
  101 |                             const blocking = checks.blocking.map((b) => (size.paysage ? b.replace(`${size.width} px`, at) : b));
  102 |                             let capture: string | null = null;
  103 |                             if (size.paysage || RESPONSIVE_CAPTURE_WIDTHS.includes(size.width)) {
  104 |                                 fs.mkdirSync(SHOTS, { recursive: true });
  105 |                                 capture = `${p.id}__${size.paysage ? `${size.width}x${size.height}` : size.width}__${theme.key}.jpg`;
  106 |                                 await page.screenshot({ path: path.join(SHOTS, capture), type: 'jpeg', quality: 80, animations: 'disabled', caret: 'hide', scale: 'css' });
  107 |                             }
  108 |                             record.sizes.push({ size: at, blocking, warnings: checks.warnings, capture });
  109 |                         }
  110 |                     } catch (err) {
  111 |                         record.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
  112 |                         throw err;
  113 |                     } finally {
  114 |                         // Erreurs de la page (console, requêtes) : notées, déjà bloquantes dans les captures
  115 |                         record.notes.push(...guard.blockingIssues().map((i) => `erreur de la page : ${i}`));
  116 |                         fs.mkdirSync(RESULTS, { recursive: true });
  117 |                         fs.writeFileSync(path.join(RESULTS, `${p.id}__${theme.key}.json`), `${JSON.stringify(record, null, 1)}\n`, 'utf8');
  118 |                     }
  119 |                     const blocking = record.sizes.flatMap((s) => s.blocking);
> 120 |                     expect(blocking, `contrôles responsive de ${p.id} (${theme.key})`).toEqual([]);
      |                                                                                        ^ Error: contrôles responsive de notifications (clair)
  121 |                 });
  122 |             }
  123 |         });
  124 |     }
  125 | }
  126 | 
```