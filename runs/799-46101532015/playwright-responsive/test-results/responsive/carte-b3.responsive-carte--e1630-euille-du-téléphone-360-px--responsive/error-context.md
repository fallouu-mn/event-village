# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: carte-b3.responsive.spec.ts >> carte B3 · captures · sombre >> couches, repères des trois types, feuille du téléphone (360 px)
- Location: e2e/carte-b3.responsive.spec.ts:183:13

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /^Salle Teranga 29019ebb,/ }).locator('.ev-repere--salle')
Expected: visible
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('button', { name: /^Salle Teranga 29019ebb,/ }).locator('.ev-repere--salle') with timeout 30000ms
  - waiting for getByRole('button', { name: /^Salle Teranga 29019ebb,/ }).locator('.ev-repere--salle')

```

```yaml
- banner:
  - button "Ouvrir le menu"
  - link "Event Village, accueil":
    - /url: /
  - button "Notifications"
  - button "Basculer le thème" [pressed]
  - link "Se connecter":
    - /url: /login
- main:
  - heading "Explorer les événements" [level=1]
  - paragraph: Concerts, festivals, soirées et rencontres à venir au Sénégal. La liste se met à jour d’elle-même.
  - status: En direct
  - region "Recherche et filtres":
    - text: Rechercher un événement
    - searchbox "Rechercher un événement"
    - group "Date et prix":
      - button "Aujourd’hui"
      - button "Ce week-end"
      - button "Cette semaine"
      - button "Gratuit"
    - text: Ville
    - combobox "Ville":
      - option "Toutes les villes" [selected]
      - option "Dakar"
      - option "Foundiougne"
      - option "Gorée"
      - option "Kaolack"
      - option "Mbour"
      - option "Saint-Louis"
      - option "Saly"
      - option "Ziguinchor"
    - text: Trier par
    - combobox "Trier par":
      - option "Date la plus proche" [selected]
      - option "Prix croissant"
  - group "Catégorie":
    - button "Toutes les catégories" [pressed]
    - button "Concerts & Musique"
    - button "Festivals"
    - button "Gastronomie & Tables"
    - button "Salles & Réceptions"
  - tablist "Affichage des événements":
    - tab "Liste"
    - tab "Carte" [selected]
    - tab "Calendrier"
  - tabpanel "Carte":
    - group "Afficher sur la carte":
      - button "Événements , 18 dans la zone" [pressed]: Événements · 18
      - button "Salles , 3 dans la zone" [pressed]: Salles · 3
      - button "Restaurants , 2 dans la zone" [pressed]: Restaurants · 2
    - group: Filtrer les salles et les restaurants
    - text: Aller à
    - combobox "Aller à":
      - option "Ville ou quartier"
      - option "Tout le Sénégal"
      - option "Dakar"
      - option "Almadies"
      - option "Plateau"
      - option "Ngor"
      - option "Ouakam"
      - option "Mermoz"
      - option "Sacré-Cœur"
      - option "Saly"
      - option "Mbour"
      - option "Thiès" [selected]
      - option "Saint-Louis"
      - option "Kaolack"
      - option "Ziguinchor"
    - button "Autour de moi"
    - region "Carte des événements et des lieux":
      - 'button "18 événements et lieux : agrandir"': "18"
      - 'button "3 événements : agrandir"': "3"
      - button "Festival Jazz sur le Fleuve, jeu. 10 déc. · 18:00, Dès 7 500 F": Dès 7 500 F
      - button "Festival des rythmes de Casamance, jeu. 24 déc. · 17:00, Dès 5 000 F": Dès 5 000 F
      - button "Zoom avant"
      - button "Zoom arrière" [disabled]
      - text: ©
      - link "Stadia Maps":
        - /url: https://stadiamaps.com/
      - text: ©
      - link "OpenMapTiles":
        - /url: https://openmaptiles.org/
      - text: ©
      - link "contributeurs OpenStreetMap":
        - /url: https://www.openstreetmap.org/copyright
    - paragraph: Les repères sont accessibles avec la touche Tabulation, puis Entrée. La vue Liste présente les mêmes événements.
    - paragraph: 18 événements, 3 salles, 2 restaurants dans cette zone
- navigation "Navigation rapide":
  - link "Accueil":
    - /url: /
  - link "Explorer":
    - /url: /explore
  - link "Billets":
    - /url: /tickets
  - link "Avis":
    - /url: /notifications
  - link "Portefeuille":
    - /url: /wallet
- alert
```

# Test source

```ts
  99  |             expect(shown.orders, 'une salle ne prend pas de commande').toBe(false);
  100 |             expect({ lat: shown.lat, lng: shown.lng }, 'point exact (décision du 25/11)').toEqual(point);
  101 | 
  102 |             // Visiteur sans session (aucun cookie) : adresse, point et itinéraire publics ; rien de la partenaire
  103 |             const visitor = await playwright.request.newContext({ baseURL });
  104 |             const page0 = await (await visitor.get(`/halls/${id}`)).text();
  105 |             const search = await (await visitor.get(`/api/halls?q=${encodeURIComponent(STAMP)}`)).text();
  106 |             const apiOne = await (await visitor.get(`/api/halls/${id}`)).text();
  107 |             await visitor.dispose();
  108 |             expect(page0, 'fiche : adresse').toContain(address);
  109 |             expect(page0, 'fiche : itinéraire vers le point exact').toContain(`maps/dir/?api=1&amp;destination=${point.lat},${point.lng}`);
  110 |             expect(search, 'recherche par un mot de l’adresse').toContain(id);
  111 |             for (const [label, text] of [['recherche', search], ['fiche de l’API', apiOne]] as const) {
  112 |                 expect(text, `${label} : adresse`).toContain(address);
  113 |                 expect(text, `${label} : point`).toContain(String(point.lat));
  114 |             }
  115 |             const { data: pa } = await serviceClient().from('partners').select('company_name, phone, email').eq('id', await demoPartnerId()).single();
  116 |             for (const secret of [pa?.phone, pa?.email].filter((x): x is string => typeof x === 'string' && x.length > 0)) {
  117 |                 for (const [label, text] of [['fiche', page0], ['recherche', search], ['fiche de l’API', apiOne], ['carte', JSON.stringify(places)]] as const) {
  118 |                     expect(text.includes(secret), `${label} : coordonnée de la partenaire`).toBe(false);
  119 |                 }
  120 |             }
  121 | 
  122 |             const suspend = await page.request.post(`/api/admin/halls/${id}/validation`, { data: { decision: 'SUSPENDRE', reason: `Contrôle du lot Carte B3 ${STAMP}` } });
  123 |             expect(suspend.status(), `suspension : ${await suspend.text()}`).toBe(200);
  124 |             const goneAfter = await waitUntil('salle retirée de la carte', async () => !(await hallsOnMap(page.request)).some((p) => p.id === id), 65_000);
  125 |             console.log(`[carte-b3] salle suspendue retirée de la carte après ${goneAfter} ms`);
  126 |             expect(goneAfter, 'retirée en moins de 5 s').toBeLessThan(MAX_STALE_MS);
  127 |         } finally {
  128 |             await retire(id);
  129 |         }
  130 |     });
  131 | });
  132 | 
  133 | async function settle(page: Page): Promise<void> {
  134 |     await page.evaluate(() => document.fonts.ready.then(() => true));
  135 |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
  136 |     await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
  137 | }
  138 | 
  139 | /** Fait défiler jusqu'à un élément, placé sous l'en-tête et la barre collante des catégories d'Explorer (≈ 130 px). */
  140 | async function scrollToTop(page: Page, selector: string): Promise<void> {
  141 |     await page.locator(selector).first().evaluate((el) => {
  142 |         window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 132, behavior: 'instant' as ScrollBehavior });
  143 |     });
  144 |     await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
  145 | }
  146 | 
  147 | async function shot(page: Page, name: string, width: number, theme: ThemeKey): Promise<void> {
  148 |     fs.mkdirSync(SHOTS, { recursive: true });
  149 |     await page.waitForTimeout(350); // fin des transitions (≤ 300 ms)
  150 |     await page.screenshot({ path: path.join(SHOTS, `cb3-${name}__${width}__${theme}.jpg`), type: 'jpeg', quality: 80, caret: 'hide', scale: 'css' });
  151 | }
  152 | 
  153 | const LAYERS = '[role="group"][aria-label="Afficher sur la carte"]';
  154 | 
  155 | /** Salles des captures, à Thiès (« Aller à » Thiès, zoom 13), assez éloignées pour ne pas être regroupées. */
  156 | const THIES = {
  157 |     teranga: { name: `Salle Teranga ${STAMP}`, address: `Villa ${STAMP}, quartier Randoulène`, lat: 14.799, lng: -16.92, city: 'Thiès' },
  158 |     rails: { name: `Salle Les Rails ${STAMP}`, address: `Avenue de la Gare ${STAMP}, Thiès`, lat: 14.783, lng: -16.957, city: 'Thiès' },
  159 | } as const;
  160 | const thiesIds: string[] = [];
  161 | 
  162 | test.beforeAll(async () => {
  163 |     for (const spec of [THIES.teranga, THIES.rails]) thiesIds.push(await newHall({ ...spec, validate: true }));
  164 | });
  165 | test.afterAll(async () => {
  166 |     for (const id of thiesIds) await retire(id);
  167 | });
  168 | const MAP = '[role="region"][aria-label="Carte des événements et des lieux"]';
  169 | 
  170 | const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
  171 |     { key: 'clair', colorScheme: 'light' },
  172 |     { key: 'sombre', colorScheme: 'dark' },
  173 | ];
  174 | 
  175 | for (const theme of THEMES) {
  176 |     test.describe(`carte B3 · captures · ${theme.key}`, () => {
  177 |         test.use({ colorScheme: theme.colorScheme, evTheme: theme.key });
  178 |         test.beforeEach(async ({ context, servicesLock }) => {
  179 |             await servicesLock.enter('services');
  180 |             await context.addInitScript((value: string) => { document.cookie = `ev-theme=${value}; path=/`; }, theme.colorScheme);
  181 |         });
  182 | 
  183 |         test('couches, repères des trois types, feuille du téléphone (360 px)', async ({ page }) => {
  184 |             test.setTimeout(240_000);
  185 |             await page.setViewportSize({ width: 360, height: 780 });
  186 |             // Salles de Thiès créées sans passer par l'administration : cache de la carte (60 s au plus) attendu ici
  187 |             await waitUntil('salles de Thiès sur la carte', async () => {
  188 |                 const shown = new Set((await hallsOnMap(page.request)).map((p) => p.id));
  189 |                 return thiesIds.every((id) => shown.has(id));
  190 |             }, 75_000, 1_000);
  191 |             await page.goto('/explore?vue=carte', { waitUntil: 'load' });
  192 |             const layers = page.locator(LAYERS);
  193 |             await expect(layers.getByRole('button', { name: /Salles/ })).toBeVisible({ timeout: 30_000 });
  194 |             await expect(layers.getByRole('button', { name: /Restaurants/ })).toHaveAttribute('aria-pressed', 'true');
  195 | 
  196 |             // Thiès : un événement (billet), deux salles (bâtiment)
  197 |             await page.getByLabel('Aller à').selectOption('thies');
  198 |             const teranga = page.getByRole('button', { name: new RegExp(`^Salle Teranga ${STAMP},`) });
> 199 |             await expect(teranga.locator('.ev-repere--salle')).toBeVisible({ timeout: 30_000 });
      |                                                                ^ Error: expect(locator).toBeVisible() failed
  200 |             await expect(page.getByRole('button', { name: new RegExp(`^Salle Les Rails ${STAMP},`) }).locator('.ev-repere--salle')).toBeVisible();
  201 |             await settle(page);
  202 |             await scrollToTop(page, LAYERS);
  203 |             await shot(page, 'couches-reperes', 360, theme.key);
  204 | 
  205 |             // Couche masquée : plus de repère de salle, couches gardées dans l'adresse
  206 |             await layers.getByRole('button', { name: /Salles/ }).click();
  207 |             await expect(layers.getByRole('button', { name: /Salles/ })).toHaveAttribute('aria-pressed', 'false');
  208 |             await expect(page).toHaveURL(/couches=evenements(%2C|,)restaurants/);
  209 |             await expect(page.locator('.leaflet-marker-icon .ev-repere--salle')).toHaveCount(0);
  210 |             await layers.getByRole('button', { name: /Salles/ }).click();
  211 |             await expect(teranga.locator('.ev-repere--salle')).toBeVisible({ timeout: 15_000 });
  212 | 
  213 |             // Feuille du téléphone : photos, faits, lien vers la fiche (la réservation se fait là)
  214 |             await teranga.locator('.ev-repere').click();
  215 |             const sheet = page.getByRole('dialog');
  216 |             await expect(sheet.getByRole('link', { name: 'Voir la salle' })).toBeVisible();
  217 |             await scrollToTop(page, MAP);
  218 |             await shot(page, 'feuille-lieu', 360, theme.key);
  219 |             await sheet.getByRole('button', { name: 'Fermer' }).click();
  220 | 
  221 |             // Restaurants du seed (Sacré-Cœur) : couverts
  222 |             await page.getByLabel('Aller à').selectOption('sacre-coeur');
  223 |             await expect(page.locator('.leaflet-marker-icon .ev-repere--resto').first()).toBeVisible({ timeout: 30_000 });
  224 |             await settle(page);
  225 |             await scrollToTop(page, MAP);
  226 |             await shot(page, 'repere-restaurant', 360, theme.key);
  227 |         });
  228 | 
  229 |         test('liste de l’ordinateur et survol d’un lieu (1 440 px)', async ({ page }) => {
  230 |             test.setTimeout(150_000);
  231 |             await page.setViewportSize({ width: 1440, height: 900 });
  232 |             await page.goto('/explore?vue=carte', { waitUntil: 'load' });
  233 |             await expect(page.locator(LAYERS).getByRole('button', { name: /Salles/ })).toBeVisible({ timeout: 30_000 });
  234 |             await page.getByLabel('Aller à').selectOption('dakar');
  235 |             const place = page.locator('[id^="carte-vignette-p-"] a').first();
  236 |             await expect(place).toBeVisible({ timeout: 30_000 });
  237 |             await place.hover();
  238 |             // Run 658 : le lieu survolé peut être caché dans un regroupement, qui s'allume alors à sa place
  239 |             await expect(page.locator('.ev-repere--choisi'), 'survol : repère du lieu mis en évidence').toHaveCount(1, { timeout: 5_000 });
  240 |             await settle(page);
  241 |             await scrollToTop(page, LAYERS);
  242 |             await place.hover();
  243 |             await shot(page, 'liste-ordinateur', 1440, theme.key);
  244 |         });
  245 | 
  246 |         test('fiches : adresse, carte au point exact, « Voir l’itinéraire » (360 et 1 440 px)', async ({ page }) => {
  247 |             test.setTimeout(180_000);
  248 |             const ids = readDemoIds();
  249 |             for (const w of [360, 1440] as const) {
  250 |                 await page.setViewportSize({ width: w, height: w === 360 ? 780 : 900 });
  251 |                 for (const [name, href] of [['fiche-salle', `/halls/${ids.halls.validee.id}`], ['fiche-restaurant', `/tables/${ids.tables.restaurant.id}`]] as const) {
  252 |                     await page.goto(href, { waitUntil: 'load' });
  253 |                     // Page entièrement chargée d'abord (la fiche se redessine après l'arrivée du code : run 654) ; le clic
  254 |                     // attend le bouton et le fait défiler lui-même
  255 |                     await settle(page);
  256 |                     const section = page.locator('section[aria-labelledby="salle-adresse"], section[aria-labelledby="etab-adresse"]');
  257 |                     await section.getByRole('button', { name: 'Afficher la carte' }).click({ timeout: 30_000 });
  258 |                     await expect(section.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 });
  259 |                     await expect(section.getByRole('link', { name: /Voir l’itinéraire/ })).toBeVisible();
  260 |                     await settle(page);
  261 |                     await scrollToTop(page, 'section[aria-labelledby="salle-adresse"], section[aria-labelledby="etab-adresse"]');
  262 |                     await shot(page, name, w, theme.key);
  263 |                 }
  264 |             }
  265 |         });
  266 |     });
  267 | }
  268 | 
```