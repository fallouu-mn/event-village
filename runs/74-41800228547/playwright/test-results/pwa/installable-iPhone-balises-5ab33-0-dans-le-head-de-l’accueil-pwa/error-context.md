# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: installable.spec.ts >> iPhone : balises apple-mobile-web-app et icône apple-touch 180×180 dans le <head> de l’accueil
- Location: e2e/installable.spec.ts:193:5

# Error details

```
Error: exactement un link[rel=apple-touch-icon] (trouvés : ["/icon-192x192.png","/icon-192x192.png"])

expect(received).toBe(expected) // Object.is equality

Expected: 1
Received: 2
```

```
Error: icône apple-touch /icon-192x192.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 1

  Object {
    "href": "/icon-192x192.png",
-   "size": "180x180",
+   "size": "192x192",
    "status": 200,
    "type": "image/png",
  }
```

```
Error: icône apple-touch /icon-192x192.png

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 1

  Object {
    "href": "/icon-192x192.png",
-   "size": "180x180",
+   "size": "192x192",
    "status": 200,
    "type": "image/png",
  }
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
            - /url: /
        - generic [ref=e16]:
          - button "Notifications" [ref=e18] [cursor=pointer]
          - button "Basculer le thème" [ref=e23] [cursor=pointer]
          - link "Se connecter" [ref=e27] [cursor=pointer]:
            - /url: /login
      - main [ref=e31]:
        - generic [ref=e33]:
          - generic [ref=e35]:
            - generic [ref=e36]:
              - paragraph [ref=e37]: Billetterie officielle au Sénégal
              - heading "Découvrez, réservez et vivez les événements qui comptent." [level=1] [ref=e41]
              - paragraph [ref=e42]: "Concerts, festivals, soirées et rencontres : choisissez votre place, payez en quelques secondes et présentez votre billet à l’entrée."
              - search [ref=e43]:
                - generic [ref=e45]:
                  - generic [ref=e46]: Rechercher un événement
                  - searchbox "Rechercher un événement" [ref=e48]
                - button "Explorer" [ref=e49] [cursor=pointer]
            - list [ref=e55]:
              - listitem [ref=e56]:
                - generic [ref=e60]:
                  - paragraph [ref=e61]: Wave et Orange Money
                  - paragraph [ref=e62]: Payez depuis votre téléphone, le billet arrive aussitôt.
              - listitem [ref=e63]:
                - generic [ref=e71]:
                  - paragraph [ref=e72]: QR code dynamique
                  - paragraph [ref=e73]: "Un code renouvelé en continu : une capture d’écran ne passe pas l’entrée."
              - listitem [ref=e74]:
                - generic [ref=e79]:
                  - paragraph [ref=e80]: Remboursement automatique
                  - paragraph [ref=e81]: "Événement annulé : les billets payés en ligne sont remboursés."
          - region [ref=e82]:
            - generic [ref=e83]:
              - generic [ref=e84]:
                - heading "À l’affiche" [level=2] [ref=e85]
                - status [ref=e86]: En direct
              - link "Tous les événements" [ref=e88] [cursor=pointer]:
                - /url: /explore
            - group "Catégorie" [ref=e93]:
              - button "Tous" [pressed] [ref=e94] [cursor=pointer]
              - button "Concerts & Musique" [ref=e95] [cursor=pointer]
              - button "Festivals" [ref=e96] [cursor=pointer]
              - button "Gastronomie & Tables" [ref=e97] [cursor=pointer]
              - button "Salles & Réceptions" [ref=e98] [cursor=pointer]
            - list [ref=e99]:
              - listitem [ref=e100]:
                - article [ref=e101]:
                  - generic [ref=e103]:
                    - generic [ref=e104]:
                      - generic [aria-hidden] [ref=e105]:
                        - generic [ref=e106]: "04"
                        - generic [ref=e107]: NOV
                      - generic [ref=e108]:
                        - paragraph [ref=e109]: Baobab Scène
                        - heading [level=3] [ref=e110]:
                          - link "Nuit du Sabar — édition d’automne" [ref=e111] [cursor=pointer]:
                            - /url: /events/bab9c78c-d478-4d92-9fe4-d46eccf7f90b
                    - generic [ref=e112]: Concerts & Musique
                    - list [ref=e115]:
                      - listitem [ref=e116]:
                        - generic [ref=e119]: 04 NOV 2026 à 09:45
                      - listitem [ref=e120]:
                        - generic [ref=e124]: Esplanade de la Corniche Ouest, Dakar
                    - generic [ref=e126]:
                      - paragraph [ref=e127]: À partir de
                      - paragraph [ref=e128]: 5 000 F CFA
              - listitem [ref=e132]:
                - article [ref=e133]:
                  - generic [ref=e135]:
                    - generic [ref=e136]:
                      - generic [aria-hidden] [ref=e137]:
                        - generic [ref=e138]: "04"
                        - generic [ref=e139]: NOV
                      - generic [ref=e140]:
                        - paragraph [ref=e141]: Orga A (test)
                        - heading [level=3] [ref=e142]:
                          - link "Fumée — Concert des Parcelles 09.11.06" [ref=e143] [cursor=pointer]:
                            - /url: /events/1daafca2-cc4e-4c0b-80e6-b147bef84930
                    - generic [ref=e144]: Concerts & Musique
                    - list [ref=e147]:
                      - listitem [ref=e148]:
                        - generic [ref=e151]: 04 NOV 2026 à 11:15
                      - listitem [ref=e152]:
                        - generic [ref=e156]: Esplanade des Parcelles Assainies, Dakar
                    - generic [ref=e158]:
                      - paragraph [ref=e159]: À partir de
                      - paragraph [ref=e160]: 5 000 F CFA
              - listitem [ref=e164]:
                - article [ref=e165]:
                  - generic [ref=e167]:
                    - generic [ref=e168]:
                      - generic [aria-hidden] [ref=e169]:
                        - generic [ref=e170]: "05"
                        - generic [ref=e171]: NOV
                      - generic [ref=e172]:
                        - paragraph [ref=e173]: Orga A (test)
                        - heading [level=3] [ref=e174]:
                          - link "Terrain — mesure du scan 09.14.03" [ref=e175] [cursor=pointer]:
                            - /url: /events/dfdfd498-b0fd-4969-b4c0-0e7e79ac2af8
                    - generic [ref=e176]: Concerts & Musique
                    - list [ref=e179]:
                      - listitem [ref=e180]:
                        - generic [ref=e183]: 05 NOV 2026 à 05:15
                      - listitem [ref=e184]:
                        - generic [ref=e188]: Esplanade des Parcelles Assainies, Dakar
                    - generic [ref=e190]:
                      - paragraph [ref=e191]: À partir de
                      - paragraph [ref=e192]: Gratuit
              - listitem [ref=e196]:
                - article [ref=e197]:
                  - generic [ref=e199]:
                    - generic [ref=e200]:
                      - generic [aria-hidden] [ref=e201]:
                        - generic [ref=e202]: "05"
                        - generic [ref=e203]: NOV
                      - generic [ref=e204]:
                        - paragraph [ref=e205]: Orga A (test)
                        - heading [level=3] [ref=e206]:
                          - link "Terrain — vibrations 09.15.00" [ref=e207] [cursor=pointer]:
                            - /url: /events/c0d100b0-9fe3-4197-99df-89d3489fa7d3
                    - generic [ref=e208]: Concerts & Musique
                    - list [ref=e211]:
                      - listitem [ref=e212]:
                        - generic [ref=e215]: 05 NOV 2026 à 05:15
                      - listitem [ref=e216]:
                        - generic [ref=e220]: Esplanade des Parcelles Assainies, Dakar
                    - generic [ref=e222]:
                      - paragraph [ref=e223]: À partir de
                      - paragraph [ref=e224]: Gratuit
              - listitem [ref=e228]:
                - article [ref=e229]:
                  - generic [ref=e231]:
                    - generic [ref=e232]:
                      - generic [aria-hidden] [ref=e233]:
                        - generic [ref=e234]: "05"
                        - generic [ref=e235]: NOV
                      - generic [ref=e236]:
                        - paragraph [ref=e237]: Orga A (test)
                        - heading [level=3] [ref=e238]:
                          - link "Terrain — écart +5 min 09.11.25" [ref=e239] [cursor=pointer]:
                            - /url: /events/92260ceb-cdf1-42a9-b380-2cd79ff58912
                    - generic [ref=e240]: Concerts & Musique
                    - list [ref=e243]:
                      - listitem [ref=e244]:
                        - generic [ref=e247]: 05 NOV 2026 à 05:15
                      - listitem [ref=e248]:
                        - generic [ref=e252]: Esplanade des Parcelles Assainies, Dakar
                    - generic [ref=e254]:
                      - paragraph [ref=e255]: À partir de
                      - paragraph [ref=e256]: Gratuit
              - listitem [ref=e260]:
                - article [ref=e261]:
                  - generic [ref=e263]:
                    - generic [ref=e264]:
                      - generic [aria-hidden] [ref=e265]:
                        - generic [ref=e266]: "05"
                        - generic [ref=e267]: NOV
                      - generic [ref=e268]:
                        - paragraph [ref=e269]: Orga A (test)
                        - heading [level=3] [ref=e270]:
                          - link "Terrain — cache sans api 09.12.59" [ref=e271] [cursor=pointer]:
                            - /url: /events/9b84ee10-6e2a-4461-bd11-3d6c428d3880
                    - generic [ref=e272]: Concerts & Musique
                    - list [ref=e275]:
                      - listitem [ref=e276]:
                        - generic [ref=e279]: 05 NOV 2026 à 05:15
                      - listitem [ref=e280]:
                        - generic [ref=e284]: Esplanade des Parcelles Assainies, Dakar
                    - generic [ref=e286]:
                      - paragraph [ref=e287]: À partir de
                      - paragraph [ref=e288]: Gratuit
              - listitem [ref=e292]:
                - article [ref=e293]:
                  - generic [ref=e295]:
                    - generic [ref=e296]:
                      - generic [aria-hidden] [ref=e297]:
                        - generic [ref=e298]: "05"
                        - generic [ref=e299]: NOV
                      - generic [ref=e300]:
                        - paragraph [ref=e301]: Orga A (test)
                        - heading [level=3] [ref=e302]:
                          - link "Terrain — camera en arriere-plan 09.15.05" [ref=e303] [cursor=pointer]:
                            - /url: /events/fc987437-8b2e-4312-a896-ce1b98a210dc
                    - generic [ref=e304]: Concerts & Musique
                    - list [ref=e307]:
                      - listitem [ref=e308]:
                        - generic [ref=e311]: 05 NOV 2026 à 05:15
                      - listitem [ref=e312]:
                        - generic [ref=e316]: Esplanade des Parcelles Assainies, Dakar
                    - generic [ref=e318]:
                      - paragraph [ref=e319]: À partir de
                      - paragraph [ref=e320]: Gratuit
              - listitem [ref=e324]:
                - article [ref=e325]:
                  - generic [ref=e327]:
                    - generic [ref=e328]:
                      - generic [aria-hidden] [ref=e329]:
                        - generic [ref=e330]: "05"
                        - generic [ref=e331]: NOV
                      - generic [ref=e332]:
                        - paragraph [ref=e333]: Orga A (test)
                        - heading [level=3] [ref=e334]:
                          - link "Terrain — écart -5 min 09.12.12" [ref=e335] [cursor=pointer]:
                            - /url: /events/2d5d3355-2fea-4604-8222-82c192543633
                    - generic [ref=e336]: Concerts & Musique
                    - list [ref=e339]:
                      - listitem [ref=e340]:
                        - generic [ref=e343]: 05 NOV 2026 à 05:15
                      - listitem [ref=e344]:
                        - generic [ref=e348]: Esplanade des Parcelles Assainies, Dakar
                    - generic [ref=e350]:
                      - paragraph [ref=e351]: À partir de
                      - paragraph [ref=e352]: Gratuit
          - region [ref=e356]:
            - generic [ref=e357]:
              - paragraph [ref=e358]: Espace organisateur
              - heading "Vous organisez des événements ? Vendez vos billets avec Event Village." [level=2] [ref=e359]
              - list [ref=e360]:
                - listitem [ref=e361]:
                  - generic [ref=e365]: Création et publication de vos événements, validées par notre équipe
                - listitem [ref=e366]:
                  - generic [ref=e370]: Ventes et entrées suivies en direct, contrôleurs et caisses sur place
                - listitem [ref=e371]:
                  - generic [ref=e375]: Fonds versés sur votre compte après l’événement
              - link "Devenir organisateur" [ref=e377] [cursor=pointer]:
                - /url: /partner/register
            - generic [ref=e382]:
              - generic [ref=e383]:
                - heading "Une salle pour votre réception ?" [level=2] [ref=e389]
                - paragraph [ref=e390]: "Mariages, séminaires, galas : consultez les salles disponibles et réservez en ligne."
              - link "Voir les salles" [ref=e391] [cursor=pointer]:
                - /url: /halls
          - generic [ref=e396]:
            - generic [ref=e397]:
              - generic [ref=e398]:
                - paragraph [ref=e399]: Event Village
                - paragraph [ref=e400]: Billetterie, salles et événements au Sénégal.
              - navigation "Liens du pied de page" [ref=e401]:
                - list [ref=e402]:
                  - listitem [ref=e403]:
                    - link "Explorer" [ref=e404] [cursor=pointer]:
                      - /url: /explore
                  - listitem [ref=e406]:
                    - link "Mes billets" [ref=e407] [cursor=pointer]:
                      - /url: /tickets
                  - listitem [ref=e409]:
                    - link "Salles" [ref=e410] [cursor=pointer]:
                      - /url: /halls
                  - listitem [ref=e412]:
                    - link "Devenir organisateur" [ref=e413] [cursor=pointer]:
                      - /url: /partner/register
            - paragraph [ref=e415]: Event Village, 2026. Tous droits réservés.
    - navigation "Navigation rapide" [ref=e416]:
      - generic [ref=e417]:
        - link "Accueil" [ref=e418] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e423] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e428] [cursor=pointer]:
          - /url: /tickets
        - link "Achats" [ref=e432] [cursor=pointer]:
          - /url: /orders
        - link "Solde" [ref=e437] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e442]
```

# Test source

```ts
  110 |     const context = await persistentContext(testInfo, 'profil');
  111 |     try {
  112 |         const seen = observe(context);
  113 |         const page = context.pages()[0] ?? await context.newPage();
  114 |         await page.goto('/');
  115 |         await page.waitForFunction(() => ((window as unknown as { __evInstallPrompts?: number }).__evInstallPrompts ?? 0) > 0, null, { timeout: 15_000 })
  116 |             .catch((err: unknown) => {
  117 |                 throw new Error(`beforeinstallprompt jamais reçu en 15 s (${err instanceof Error ? err.message.split('\n')[0] : String(err)})`);
  118 |             });
  119 |         const errors = await installabilityErrors(context, page);
  120 |         console.log(`[e2e][pwa] Page.getInstallabilityErrors : ${errors.length === 0 ? 'aucune' : errors.join(' ; ')}`);
  121 |         expect(errors, 'Page.getInstallabilityErrors : liste vide attendue').toEqual([]);
  122 | 
  123 |         await expect.poll(() => seen.filter((r) => r.type === 'manifest' && r.path === '/manifest.json').map((r) => r.status), {
  124 |             message: 'manifest demandé par Chromium (type « manifest ») vers /manifest.json', timeout: 15_000,
  125 |         }).toContain(200);
  126 |         const manifest = await fetchFromPage(page, '/manifest.json', true);
  127 |         expect(manifest.status, 'manifest servi').toBe(200);
  128 |         const icons = (JSON.parse(manifest.text ?? '{}') as { icons?: ManifestIcon[] }).icons ?? [];
  129 |         expect(icons.length, 'icônes déclarées dans le manifest').toBeGreaterThan(0);
  130 |         const iconPaths = new Set(icons.map((i) => new URL(i.src, APP_URL).pathname));
  131 |         await expect.poll(() => seen.filter((r) => iconPaths.has(r.path) && r.status === 200).map((r) => r.path), {
  132 |             message: `au moins une icône déclarée demandée par Chromium et servie en 200 (${Array.from(iconPaths).join(', ')})`, timeout: 15_000,
  133 |         }).not.toEqual([]);
  134 |         for (const icon of icons) {
  135 |             const got = await fetchFromPage(page, icon.src, false);
  136 |             const size = pngSize(got.head);
  137 |             expect.soft({ src: icon.src, status: got.status, type: got.contentType.split(';')[0], size: size ? `${size.width}x${size.height}` : null },
  138 |                 `icône ${icon.src} servie sans session`).toEqual({ src: icon.src, status: 200, type: 'image/png', size: icon.sizes ?? null });
  139 |         }
  140 |         const failed = seen.filter((r) => r.status >= 400);
  141 |         expect(failed.map((r) => `${r.status} ${r.url}`), 'aucune réponse en erreur pendant le chargement de l’accueil').toEqual([]);
  142 |     } finally {
  143 |         await context.close();
  144 |     }
  145 | });
  146 | 
  147 | test('témoin négatif : manifest servi sans icône → Chromium signale l’icône manquante', async ({}, testInfo) => {
  148 |     const context = await persistentContext(testInfo, 'profil-temoin');
  149 |     try {
  150 |         await context.route('**/manifest.json', async (route) => {
  151 |             const original = await route.fetch();
  152 |             const body = (await original.json()) as Record<string, unknown>;
  153 |             delete body.icons;
  154 |             await route.fulfill({ status: 200, contentType: 'application/manifest+json', body: JSON.stringify(body) });
  155 |         });
  156 |         const page = context.pages()[0] ?? await context.newPage();
  157 |         await page.goto('/');
  158 |         await expect.poll(() => installabilityErrors(context, page), {
  159 |             message: 'manifest sans icône : manifest-missing-suitable-icon ou no-acceptable-icon attendu (sinon : headless shell, faux positif)', timeout: 15_000,
  160 |         }).toEqual(expect.arrayContaining([expect.stringMatching(/^(manifest-missing-suitable-icon|no-acceptable-icon)/)]));
  161 |     } finally {
  162 |         await context.close();
  163 |     }
  164 | });
  165 | 
  166 | test('manifest servi : id, scope, start_url, standalone, couleurs, icônes 192 et 512 dont une maskable (contrat 4.5)', async ({ page, guard }) => {
  167 |     await page.goto('/manifest.json');
  168 |     const got = await fetchFromPage(page, '/manifest.json', true);
  169 |     expect(got.status, 'manifest servi sans session').toBe(200);
  170 |     const m = JSON.parse(got.text ?? '{}') as Record<string, unknown> & { icons?: ManifestIcon[] };
  171 |     const scope = String(m.scope ?? '');
  172 |     expect.soft(m.id, 'id').toBe('/');
  173 |     expect.soft(scope, 'scope').toBe('/');
  174 |     expect.soft(String(m.start_url ?? '').startsWith(scope || '\u0000'), `start_url « ${String(m.start_url)} » dans le scope « ${scope} »`).toBe(true);
  175 |     expect.soft(m.display, 'display').toBe('standalone');
  176 |     expect.soft(String(m.theme_color ?? ''), 'theme_color #RRGGBB').toMatch(/^#[0-9A-Fa-f]{6}$/);
  177 |     expect.soft(String(m.background_color ?? ''), 'background_color #RRGGBB').toMatch(/^#[0-9A-Fa-f]{6}$/);
  178 |     const icons = m.icons ?? [];
  179 |     const purposeOf = (i: ManifestIcon) => (i.purpose ?? 'any').split(/\s+/);
  180 |     expect.soft(icons.some((i) => i.sizes === '192x192' && purposeOf(i).includes('any')), 'icône 192×192 « any »').toBe(true);
  181 |     expect.soft(icons.some((i) => i.sizes === '512x512' && purposeOf(i).includes('any')), 'icône 512×512 « any »').toBe(true);
  182 |     const maskable = icons.filter((i) => purposeOf(i).includes('maskable'));
  183 |     expect.soft(maskable.length, 'au moins une icône « maskable »').toBeGreaterThan(0);
  184 |     for (const icon of maskable) {
  185 |         const bytes = await fetchFromPage(page, icon.src, false);
  186 |         const size = pngSize(bytes.head);
  187 |         expect.soft({ status: bytes.status, type: bytes.contentType.split(';')[0], size: size ? `${size.width}x${size.height}` : null, colorType: size?.colorType ?? null },
  188 |             `icône maskable ${icon.src} : 200, PNG opaque (type de couleur 2), ${icon.sizes ?? '?'}`).toEqual({ status: 200, type: 'image/png', size: icon.sizes ?? null, colorType: 2 });
  189 |     }
  190 |     expect(guard.blockingIssues(), 'aucune erreur du navigateur').toEqual([]);
  191 | });
  192 | 
  193 | test('iPhone : balises apple-mobile-web-app et icône apple-touch 180×180 dans le <head> de l’accueil', async ({ page, guard }) => {
  194 |     await page.goto('/');
  195 |     const head = await page.evaluate(() => ({
  196 |         appleIcons: Array.from(document.querySelectorAll('link[rel="apple-touch-icon"]')).map((l) => l.getAttribute('href') ?? ''),
  197 |         capable: Array.from(document.querySelectorAll('meta[name="apple-mobile-web-app-capable"]')).map((m) => m.getAttribute('content') ?? ''),
  198 |         title: Array.from(document.querySelectorAll('meta[name="apple-mobile-web-app-title"]')).map((m) => m.getAttribute('content') ?? ''),
  199 |         manifests: Array.from(document.querySelectorAll('link[rel="manifest"]')).map((l) => l.getAttribute('href') ?? ''),
  200 |     }));
  201 |     console.log(`[e2e][pwa] <head> : ${JSON.stringify(head)}`);
  202 |     expect.soft(head.appleIcons.length, `exactement un link[rel=apple-touch-icon] (trouvés : ${JSON.stringify(head.appleIcons)})`).toBe(1);
  203 |     expect.soft(head.capable, 'meta apple-mobile-web-app-capable = yes').toEqual(['yes']);
  204 |     expect.soft(head.title.length === 1 && head.title[0].trim().length > 0, `meta apple-mobile-web-app-title renseignée (${JSON.stringify(head.title)})`).toBe(true);
  205 |     expect.soft(head.manifests, 'link[rel=manifest] vers /manifest.json').toEqual(['/manifest.json']);
  206 |     for (const href of head.appleIcons) {
  207 |         const bytes = await fetchFromPage(page, href, false);
  208 |         const size = pngSize(bytes.head);
  209 |         expect.soft({ href, status: bytes.status, type: bytes.contentType.split(';')[0], size: size ? `${size.width}x${size.height}` : null },
> 210 |             `icône apple-touch ${href}`).toEqual({ href, status: 200, type: 'image/png', size: '180x180' });
      |                                          ^ Error: icône apple-touch /icon-192x192.png
  211 |     }
  212 |     expect(guard.blockingIssues(), 'aucune erreur du navigateur').toEqual([]);
  213 | });
  214 | 
```