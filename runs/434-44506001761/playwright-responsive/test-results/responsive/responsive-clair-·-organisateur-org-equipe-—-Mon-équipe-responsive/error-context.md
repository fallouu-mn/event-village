# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> clair · organisateur >> org-equipe — Mon équipe
- Location: e2e/responsive.spec.ts:69:21

# Error details

```
Error: contrôles responsive de org-equipe (clair)

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 5

- Array []
+ Array [
+   "768 px : textes qui se chevauchent : span.hidden.whitespace-nowrap « Event Village » sur span.truncate « Rechercher un événement, un concert, un restaurant » (46×18 px)",
+   "1024 px : texte tronqué sans le texte entier : span.block.truncate « Mariama Ndiaye » (points de suspension, texte entier absent)",
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
          - generic [ref=f5e107]:
            - heading "Équipe de contrôle" [level=1] [ref=f5e108]
            - paragraph [ref=f5e109]: "Les personnes qui scannent les billets à l’entrée de vos événements : leur état, leur porte et leurs espèces, événement par événement."
          - region [ref=f5e110]:
            - generic [ref=f5e111]:
              - generic [ref=f5e112]:
                - heading "Vos contrôleurs" [level=2] [ref=f5e113]
                - paragraph [ref=f5e114]: 4 contrôleurs · 4 prêts · 1 en attente
                - status [ref=f5e115]: Mis à jour à 10:39
              - generic [ref=f5e117]:
                - button "Actualiser" [ref=f5e118] [cursor=pointer]
                - button "Inviter un contrôleur" [ref=f5e126] [cursor=pointer]
            - status [ref=f5e132]:
              - generic [ref=f5e137]:
                - paragraph [ref=f5e138]: "« Grande soirée du Monument de la Renaissance » : porte sans contrôleur"
                - generic [ref=f5e139]: "Accès carré, Porte Sud : personne ne contrôle cette porte. Choisissez-la pour un contrôleur avec « Modifier »."
              - link "Modifier les portes et les couleurs" [ref=f5e141] [cursor=pointer]:
                - /url: /partner/events/7f42abc7-0079-4ef2-a494-ff5eb79d07ed/edit?etape=controle
            - group [ref=f5e143]:
              - generic "Portes et couleurs" [ref=f5e144] [cursor=pointer]
            - generic [ref=f5e145]:
              - generic [ref=f5e146]:
                - generic [ref=f5e147]:
                  - generic [ref=f5e148]: Rechercher
                  - textbox "Rechercher" [ref=f5e154]:
                    - /placeholder: Nom ou numéro
                - generic [ref=f5e155]:
                  - generic [ref=f5e156]: Événement
                  - combobox "Événement" [ref=f5e159] [cursor=pointer]:
                    - option "Tous les événements" [selected]
                    - option "Brunch électro des Almadies · 15 nov. 2026 à 12:00 (passé)"
                    - option "Nuit du Sabar — édition d’automne · 19 nov. 2026 à 11:30"
                    - option "Croisière musicale vers Gorée · 19 nov. 2026 à 14:45 (passé)"
                    - option "Concert des Lumières de Gorée · 20 nov. 2026 à 06:45"
                    - option "Grande soirée du Monument de la Renaissance · 22 nov. 2026 à 20:00"
                    - option "Festival Jazz sur le Fleuve · 1 déc. 2026 à 18:00"
                    - option "Soirée Kora & Lumières · 6 déc. 2026 à 20:30"
                    - option "Matinée gospel et chorales · 13 déc. 2026 à 10:00"
                    - option "Concert acoustique au jardin · 29 déc. 2026 à 19:00"
              - group "Filtrer l’équipe" [ref=f5e160]:
                - button "Tous" [pressed] [ref=f5e161] [cursor=pointer]
                - button "Prêts" [ref=f5e162] [cursor=pointer]
                - button "En attente" [ref=f5e163] [cursor=pointer]
                - button "Sans porte" [ref=f5e164] [cursor=pointer]
                - button "À relancer" [ref=f5e165] [cursor=pointer]
            - generic [ref=f5e166]:
              - generic [ref=f5e167]:
                - paragraph [ref=f5e168]: Vous (organisatrice) — toutes les portes
                - paragraph [ref=f5e169]: Vous scannez vos événements dont le contrôle est ouvert, à toutes les portes ou à une porte choisie, et vous vendez au guichet.
              - link "Scanner les billets" [ref=f5e170] [cursor=pointer]:
                - /url: /partner/scan
            - table [ref=f5e174]:
              - caption [ref=f5e175]: Contrôleurs de l’équipe
              - rowgroup [ref=f5e176]:
                - row [ref=f5e177]:
                  - columnheader "Contrôleur" [ref=f5e178]
                  - columnheader "État" [ref=f5e179]
                  - columnheader "Événements, porte et espèces" [ref=f5e180]
              - rowgroup [ref=f5e181]:
                - row [ref=f5e182]:
                  - cell [ref=f5e183]:
                    - generic [ref=f5e184]:
                      - generic [ref=f5e185]:
                        - paragraph [ref=f5e186]: Ibrahima Gueye
                        - paragraph [ref=f5e187]: 70 000 01 06
                      - generic [ref=f5e188]:
                        - link "Appeler Ibrahima Gueye" [ref=f5e189] [cursor=pointer]:
                          - /url: tel:+221700000106
                          - generic [ref=f5e192]: Appeler
                        - link "Écrire à Ibrahima Gueye sur WhatsApp" [ref=f5e193] [cursor=pointer]:
                          - /url: https://wa.me/221700000106?text=Bonjour%20Ibrahima%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2019%20nov.%202026%20%C3%A0%2011%3A30%2C%20Entr%C3%A9e%20principale.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                          - generic [ref=f5e196]: WhatsApp
                  - cell "Prêt Actif depuis le 19 nov. 2026 Retirer de l’équipe" [ref=f5e197]:
                    - generic [ref=f5e198]:
                      - generic [ref=f5e199]: Prêt
                      - paragraph [ref=f5e201]: Actif depuis le 19 nov. 2026
                      - button "Retirer de l’équipe" [ref=f5e203] [cursor=pointer]
                  - cell [ref=f5e205]:
                    - list "Événements de Ibrahima Gueye" [ref=f5e207]:
                      - listitem [ref=f5e208]:
                        - paragraph [ref=f5e209]: Nuit du Sabar — édition d’automne · 19 nov. 2026 à 11:30
                        - paragraph [ref=f5e210]: "Point d’entrée : Entrée principale"
                        - paragraph [ref=f5e211]: "Laisse entrer : toutes les catégories"
                        - generic [ref=f5e212]:
                          - generic [ref=f5e213]: Espèces autorisées
                          - generic [ref=f5e215]:
                            - link "Caisse ouverte" [ref=f5e216] [cursor=pointer]:
                              - /url: /partner/events/1b6b9b15-31a6-41c3-856d-f27700d91f21?tab=caisse
                            - link "32 entrées · dernier scan à 10:31" [ref=f5e217] [cursor=pointer]:
                              - /url: /partner/events/1b6b9b15-31a6-41c3-856d-f27700d91f21?tab=entrees
                        - button "Modifier" [ref=f5e219] [cursor=pointer]
                - row [ref=f5e221]:
                  - cell [ref=f5e222]:
                    - generic [ref=f5e223]:
                      - generic [ref=f5e224]:
                        - paragraph [ref=f5e225]: Lamine Cissé
                        - paragraph [ref=f5e226]: 70 000 01 08
                      - generic [ref=f5e227]:
                        - link "Appeler Lamine Cissé" [ref=f5e228] [cursor=pointer]:
                          - /url: tel:+221700000108
                          - generic [ref=f5e231]: Appeler
                        - link "Écrire à Lamine Cissé sur WhatsApp" [ref=f5e232] [cursor=pointer]:
                          - /url: https://wa.me/221700000108?text=Bonjour%20Lamine%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2019%20nov.%202026%20%C3%A0%2011%3A30%2C%20Entr%C3%A9e%20principale.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                          - generic [ref=f5e235]: WhatsApp
                  - cell "Prêt Actif depuis le 19 nov. 2026 Retirer de l’équipe" [ref=f5e236]:
                    - generic [ref=f5e237]:
                      - generic [ref=f5e238]: Prêt
                      - paragraph [ref=f5e240]: Actif depuis le 19 nov. 2026
                      - button "Retirer de l’équipe" [ref=f5e242] [cursor=pointer]
                  - cell [ref=f5e244]:
                    - generic [ref=f5e245]:
                      - list "Événements de Lamine Cissé" [ref=f5e246]:
                        - listitem [ref=f5e247]:
                          - paragraph [ref=f5e248]: Nuit du Sabar — édition d’automne · 19 nov. 2026 à 11:30
                          - paragraph [ref=f5e249]: "Point d’entrée : Entrée principale"
                          - paragraph [ref=f5e250]: "Laisse entrer : toutes les catégories"
                          - generic [ref=f5e251]:
                            - generic [ref=f5e252]: Espèces autorisées
                            - link "22 entrées · dernier scan à 10:27" [ref=f5e255] [cursor=pointer]:
                              - /url: /partner/events/1b6b9b15-31a6-41c3-856d-f27700d91f21?tab=entrees
                          - button "Modifier" [ref=f5e257] [cursor=pointer]
                      - group [ref=f5e259]:
                        - generic "Événements passés" [ref=f5e260] [cursor=pointer]
                - row [ref=f5e261]:
                  - cell [ref=f5e262]:
                    - generic [ref=f5e263]:
                      - generic [ref=f5e264]:
                        - paragraph [ref=f5e265]: Mamadou Sall
                        - paragraph [ref=f5e266]: 70 000 01 10
                      - generic [ref=f5e267]:
                        - link "Appeler Mamadou Sall" [ref=f5e268] [cursor=pointer]:
                          - /url: tel:+221700000110
                          - generic [ref=f5e271]: Appeler
                        - link "Écrire à Mamadou Sall sur WhatsApp" [ref=f5e272] [cursor=pointer]:
                          - /url: https://wa.me/221700000110?text=Bonjour%20Mamadou%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Grande%20soir%C3%A9e%20du%20Monument%20de%20la%20Renaissance%20%C2%BB%20le%2022%20nov.%202026%20%C3%A0%2020%3A00%2C%20porte%20Porte%20Nord.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                          - generic [ref=f5e275]: WhatsApp
                  - cell "Prêt Actif depuis le 19 nov. 2026 Retirer de l’équipe" [ref=f5e276]:
                    - generic [ref=f5e277]:
                      - generic [ref=f5e278]: Prêt
                      - paragraph [ref=f5e280]: Actif depuis le 19 nov. 2026
                      - button "Retirer de l’équipe" [ref=f5e282] [cursor=pointer]
                  - cell [ref=f5e284]:
                    - list "Événements de Mamadou Sall" [ref=f5e286]:
                      - listitem [ref=f5e287]:
                        - paragraph [ref=f5e288]: Grande soirée du Monument de la Renaissance · 22 nov. 2026 à 20:00
                        - paragraph [ref=f5e289]: "Porte : Porte Nord · Entrée générale"
                        - generic [ref=f5e290]:
                          - generic [ref=f5e291]: "Laisse entrer :"
                          - generic [ref=f5e292]:
                            - generic [ref=f5e294]: SIMPLE
                            - generic [ref=f5e295]: ", pastille blanc"
                          - generic [ref=f5e296]:
                            - generic [ref=f5e298]: VIP
                            - generic [ref=f5e299]: ", pastille or"
                          - generic [ref=f5e300]:
                            - generic [ref=f5e302]: VVIP
                            - generic [ref=f5e303]: ", pastille violet"
                        - generic [ref=f5e304]:
                          - generic [ref=f5e305]: Sans espèces
                          - generic [ref=f5e307]: Aucune entrée
                        - button "Modifier" [ref=f5e310] [cursor=pointer]
                - row [ref=f5e312]:
                  - cell [ref=f5e313]:
                    - generic [ref=f5e314]:
                      - generic [ref=f5e315]:
                        - paragraph [ref=f5e316]: Seynabou Ba
                        - paragraph [ref=f5e317]: 70 000 01 07
                      - generic [ref=f5e318]:
                        - link "Appeler Seynabou Ba" [ref=f5e319] [cursor=pointer]:
                          - /url: tel:+221700000107
                          - generic [ref=f5e322]: Appeler
                        - link "Écrire à Seynabou Ba sur WhatsApp" [ref=f5e323] [cursor=pointer]:
                          - /url: https://wa.me/221700000107?text=Bonjour%20Seynabou%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2019%20nov.%202026%20%C3%A0%2011%3A30%2C%20Entr%C3%A9e%20VIP.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
                          - generic [ref=f5e326]: WhatsApp
                  - cell "Prêt Actif depuis le 19 nov. 2026 Retirer de l’équipe" [ref=f5e327]:
                    - generic [ref=f5e328]:
                      - generic [ref=f5e329]: Prêt
                      - paragraph [ref=f5e331]: Actif depuis le 19 nov. 2026
                      - button "Retirer de l’équipe" [ref=f5e333] [cursor=pointer]
                  - cell [ref=f5e335]:
                    - list "Événements de Seynabou Ba" [ref=f5e337]:
                      - listitem [ref=f5e338]:
                        - paragraph [ref=f5e339]: Nuit du Sabar — édition d’automne · 19 nov. 2026 à 11:30
                        - paragraph [ref=f5e340]: "Point d’entrée : Entrée VIP"
                        - paragraph [ref=f5e341]: "Laisse entrer : toutes les catégories"
                        - generic [ref=f5e342]:
                          - generic [ref=f5e343]: Espèces autorisées
                          - link "7 entrées · dernier scan à 10:23" [ref=f5e346] [cursor=pointer]:
                            - /url: /partner/events/1b6b9b15-31a6-41c3-856d-f27700d91f21?tab=entrees
                        - button "Modifier" [ref=f5e348] [cursor=pointer]
            - region [ref=f5e350]:
              - heading "Invitations" [level=3] [ref=f5e351]
              - list "Invitations" [ref=f5e352]:
                - listitem [ref=f5e353]:
                  - generic [ref=f5e354]:
                    - generic [ref=f5e355]:
                      - paragraph [ref=f5e356]: Fa*** M***
                      - generic [ref=f5e357]: Invitation envoyée
                    - paragraph [ref=f5e359]: "Envoyée le jeu. 19 nov. 2026 à 10:34. Fa*** M*** doit accepter avant le dim. 22 nov. 2026 à 10:34. Événements : « Festival Jazz sur le Fleuve »."
                  - generic [ref=f5e361]:
                    - button "Renvoyer l’invitation" [ref=f5e362] [cursor=pointer]
                    - button "Annuler l’invitation" [ref=f5e364] [cursor=pointer]
  - alert [ref=f5e366]
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
      |                                                                                        ^ Error: contrôles responsive de org-equipe (clair)
  107 |                 });
  108 |             }
  109 |         });
  110 |     }
  111 | }
  112 | 
```