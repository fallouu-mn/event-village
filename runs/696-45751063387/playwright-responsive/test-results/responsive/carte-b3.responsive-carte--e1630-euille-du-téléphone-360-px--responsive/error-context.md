# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: carte-b3.responsive.spec.ts >> carte B3 · captures · sombre >> couches, repères des trois types, feuille du téléphone (360 px)
- Location: e2e/carte-b3.responsive.spec.ts:180:13

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /^Salle Teranga 25add980,/ }).locator('.ev-repere--salle')
Expected: visible
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('button', { name: /^Salle Teranga 25add980,/ }).locator('.ev-repere--salle') with timeout 30000ms
  - waiting for getByRole('button', { name: /^Salle Teranga 25add980,/ }).locator('.ev-repere--salle')

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
      - button "Festival Jazz sur le Fleuve, mar. 8 déc. · 18:00, Dès 7 500 F": Dès 7 500 F
      - button "Festival des rythmes de Casamance, mar. 22 déc. · 17:00, Dès 5 000 F": Dès 5 000 F
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
  96  |             expect(Object.keys(shown).sort(), 'champs publics seulement').toEqual(['area', 'capacity', 'hours', 'id', 'lat', 'lng', 'name', 'photos', 'price', 'type']);
  97  |             expect({ lat: shown.lat, lng: shown.lng }, 'point exact (décision du 25/11)').toEqual(point);
  98  | 
  99  |             // Visiteur sans session (aucun cookie) : adresse, point et itinéraire publics ; rien de la partenaire
  100 |             const visitor = await playwright.request.newContext({ baseURL });
  101 |             const page0 = await (await visitor.get(`/halls/${id}`)).text();
  102 |             const search = await (await visitor.get(`/api/halls?q=${encodeURIComponent(STAMP)}`)).text();
  103 |             const apiOne = await (await visitor.get(`/api/halls/${id}`)).text();
  104 |             await visitor.dispose();
  105 |             expect(page0, 'fiche : adresse').toContain(address);
  106 |             expect(page0, 'fiche : itinéraire vers le point exact').toContain(`maps/dir/?api=1&amp;destination=${point.lat},${point.lng}`);
  107 |             expect(search, 'recherche par un mot de l’adresse').toContain(id);
  108 |             for (const [label, text] of [['recherche', search], ['fiche de l’API', apiOne]] as const) {
  109 |                 expect(text, `${label} : adresse`).toContain(address);
  110 |                 expect(text, `${label} : point`).toContain(String(point.lat));
  111 |             }
  112 |             const { data: pa } = await serviceClient().from('partners').select('company_name, phone, email').eq('id', await demoPartnerId()).single();
  113 |             for (const secret of [pa?.phone, pa?.email].filter((x): x is string => typeof x === 'string' && x.length > 0)) {
  114 |                 for (const [label, text] of [['fiche', page0], ['recherche', search], ['fiche de l’API', apiOne], ['carte', JSON.stringify(places)]] as const) {
  115 |                     expect(text.includes(secret), `${label} : coordonnée de la partenaire`).toBe(false);
  116 |                 }
  117 |             }
  118 | 
  119 |             const suspend = await page.request.post(`/api/admin/halls/${id}/validation`, { data: { decision: 'SUSPENDRE', reason: `Contrôle du lot Carte B3 ${STAMP}` } });
  120 |             expect(suspend.status(), `suspension : ${await suspend.text()}`).toBe(200);
  121 |             const goneAfter = await waitUntil('salle retirée de la carte', async () => !(await hallsOnMap(page.request)).some((p) => p.id === id), 65_000);
  122 |             console.log(`[carte-b3] salle suspendue retirée de la carte après ${goneAfter} ms`);
  123 |             expect(goneAfter, 'retirée en moins de 5 s').toBeLessThan(MAX_STALE_MS);
  124 |         } finally {
  125 |             await retire(id);
  126 |         }
  127 |     });
  128 | });
  129 | 
  130 | async function settle(page: Page): Promise<void> {
  131 |     await page.evaluate(() => document.fonts.ready.then(() => true));
  132 |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
  133 |     await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
  134 | }
  135 | 
  136 | /** Fait défiler jusqu'à un élément, placé sous l'en-tête et la barre collante des catégories d'Explorer (≈ 130 px). */
  137 | async function scrollToTop(page: Page, selector: string): Promise<void> {
  138 |     await page.locator(selector).first().evaluate((el) => {
  139 |         window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 132, behavior: 'instant' as ScrollBehavior });
  140 |     });
  141 |     await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
  142 | }
  143 | 
  144 | async function shot(page: Page, name: string, width: number, theme: ThemeKey): Promise<void> {
  145 |     fs.mkdirSync(SHOTS, { recursive: true });
  146 |     await page.waitForTimeout(350); // fin des transitions (≤ 300 ms)
  147 |     await page.screenshot({ path: path.join(SHOTS, `cb3-${name}__${width}__${theme}.jpg`), type: 'jpeg', quality: 80, caret: 'hide', scale: 'css' });
  148 | }
  149 | 
  150 | const LAYERS = '[role="group"][aria-label="Afficher sur la carte"]';
  151 | 
  152 | /** Salles des captures, à Thiès (« Aller à » Thiès, zoom 13), assez éloignées pour ne pas être regroupées. */
  153 | const THIES = {
  154 |     teranga: { name: `Salle Teranga ${STAMP}`, address: `Villa ${STAMP}, quartier Randoulène`, lat: 14.799, lng: -16.92, city: 'Thiès' },
  155 |     rails: { name: `Salle Les Rails ${STAMP}`, address: `Avenue de la Gare ${STAMP}, Thiès`, lat: 14.783, lng: -16.957, city: 'Thiès' },
  156 | } as const;
  157 | const thiesIds: string[] = [];
  158 | 
  159 | test.beforeAll(async () => {
  160 |     for (const spec of [THIES.teranga, THIES.rails]) thiesIds.push(await newHall({ ...spec, validate: true }));
  161 | });
  162 | test.afterAll(async () => {
  163 |     for (const id of thiesIds) await retire(id);
  164 | });
  165 | const MAP = '[role="region"][aria-label="Carte des événements et des lieux"]';
  166 | 
  167 | const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
  168 |     { key: 'clair', colorScheme: 'light' },
  169 |     { key: 'sombre', colorScheme: 'dark' },
  170 | ];
  171 | 
  172 | for (const theme of THEMES) {
  173 |     test.describe(`carte B3 · captures · ${theme.key}`, () => {
  174 |         test.use({ colorScheme: theme.colorScheme, evTheme: theme.key });
  175 |         test.beforeEach(async ({ context, servicesLock }) => {
  176 |             await servicesLock.enter('services');
  177 |             await context.addInitScript((value: string) => { document.cookie = `ev-theme=${value}; path=/`; }, theme.colorScheme);
  178 |         });
  179 | 
  180 |         test('couches, repères des trois types, feuille du téléphone (360 px)', async ({ page }) => {
  181 |             test.setTimeout(240_000);
  182 |             await page.setViewportSize({ width: 360, height: 780 });
  183 |             // Salles de Thiès créées sans passer par l'administration : cache de la carte (60 s au plus) attendu ici
  184 |             await waitUntil('salles de Thiès sur la carte', async () => {
  185 |                 const shown = new Set((await hallsOnMap(page.request)).map((p) => p.id));
  186 |                 return thiesIds.every((id) => shown.has(id));
  187 |             }, 75_000, 1_000);
  188 |             await page.goto('/explore?vue=carte', { waitUntil: 'load' });
  189 |             const layers = page.locator(LAYERS);
  190 |             await expect(layers.getByRole('button', { name: /Salles/ })).toBeVisible({ timeout: 30_000 });
  191 |             await expect(layers.getByRole('button', { name: /Restaurants/ })).toHaveAttribute('aria-pressed', 'true');
  192 | 
  193 |             // Thiès : un événement (billet), deux salles (bâtiment)
  194 |             await page.getByLabel('Aller à').selectOption('thies');
  195 |             const teranga = page.getByRole('button', { name: new RegExp(`^Salle Teranga ${STAMP},`) });
> 196 |             await expect(teranga.locator('.ev-repere--salle')).toBeVisible({ timeout: 30_000 });
      |                                                                ^ Error: expect(locator).toBeVisible() failed
  197 |             await expect(page.getByRole('button', { name: new RegExp(`^Salle Les Rails ${STAMP},`) }).locator('.ev-repere--salle')).toBeVisible();
  198 |             await settle(page);
  199 |             await scrollToTop(page, LAYERS);
  200 |             await shot(page, 'couches-reperes', 360, theme.key);
  201 | 
  202 |             // Couche masquée : plus de repère de salle, couches gardées dans l'adresse
  203 |             await layers.getByRole('button', { name: /Salles/ }).click();
  204 |             await expect(layers.getByRole('button', { name: /Salles/ })).toHaveAttribute('aria-pressed', 'false');
  205 |             await expect(page).toHaveURL(/couches=evenements(%2C|,)restaurants/);
  206 |             await expect(page.locator('.leaflet-marker-icon .ev-repere--salle')).toHaveCount(0);
  207 |             await layers.getByRole('button', { name: /Salles/ }).click();
  208 |             await expect(teranga.locator('.ev-repere--salle')).toBeVisible({ timeout: 15_000 });
  209 | 
  210 |             // Feuille du téléphone : photos, faits, lien vers la fiche (la réservation se fait là)
  211 |             await teranga.locator('.ev-repere').click();
  212 |             const sheet = page.getByRole('dialog');
  213 |             await expect(sheet.getByRole('link', { name: 'Voir la salle' })).toBeVisible();
  214 |             await scrollToTop(page, MAP);
  215 |             await shot(page, 'feuille-lieu', 360, theme.key);
  216 |             await sheet.getByRole('button', { name: 'Fermer' }).click();
  217 | 
  218 |             // Restaurants du seed (Sacré-Cœur) : couverts
  219 |             await page.getByLabel('Aller à').selectOption('sacre-coeur');
  220 |             await expect(page.locator('.leaflet-marker-icon .ev-repere--resto').first()).toBeVisible({ timeout: 30_000 });
  221 |             await settle(page);
  222 |             await scrollToTop(page, MAP);
  223 |             await shot(page, 'repere-restaurant', 360, theme.key);
  224 |         });
  225 | 
  226 |         test('liste de l’ordinateur et survol d’un lieu (1 440 px)', async ({ page }) => {
  227 |             test.setTimeout(150_000);
  228 |             await page.setViewportSize({ width: 1440, height: 900 });
  229 |             await page.goto('/explore?vue=carte', { waitUntil: 'load' });
  230 |             await expect(page.locator(LAYERS).getByRole('button', { name: /Salles/ })).toBeVisible({ timeout: 30_000 });
  231 |             await page.getByLabel('Aller à').selectOption('dakar');
  232 |             const place = page.locator('[id^="carte-vignette-p-"] a').first();
  233 |             await expect(place).toBeVisible({ timeout: 30_000 });
  234 |             await place.hover();
  235 |             // Run 658 : le lieu survolé peut être caché dans un regroupement, qui s'allume alors à sa place
  236 |             await expect(page.locator('.ev-repere--choisi'), 'survol : repère du lieu mis en évidence').toHaveCount(1, { timeout: 5_000 });
  237 |             await settle(page);
  238 |             await scrollToTop(page, LAYERS);
  239 |             await place.hover();
  240 |             await shot(page, 'liste-ordinateur', 1440, theme.key);
  241 |         });
  242 | 
  243 |         test('fiches : adresse, carte au point exact, « Voir l’itinéraire » (360 et 1 440 px)', async ({ page }) => {
  244 |             test.setTimeout(180_000);
  245 |             const ids = readDemoIds();
  246 |             for (const w of [360, 1440] as const) {
  247 |                 await page.setViewportSize({ width: w, height: w === 360 ? 780 : 900 });
  248 |                 for (const [name, href] of [['fiche-salle', `/halls/${ids.halls.validee.id}`], ['fiche-restaurant', `/tables/${ids.tables.restaurant.id}`]] as const) {
  249 |                     await page.goto(href, { waitUntil: 'load' });
  250 |                     // Page entièrement chargée d'abord (la fiche se redessine après l'arrivée du code : run 654) ; le clic
  251 |                     // attend le bouton et le fait défiler lui-même
  252 |                     await settle(page);
  253 |                     const section = page.locator('section[aria-labelledby="salle-adresse"], section[aria-labelledby="etab-adresse"]');
  254 |                     await section.getByRole('button', { name: 'Afficher la carte' }).click({ timeout: 30_000 });
  255 |                     await expect(section.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 });
  256 |                     await expect(section.getByRole('link', { name: /Voir l’itinéraire/ })).toBeVisible();
  257 |                     await settle(page);
  258 |                     await scrollToTop(page, 'section[aria-labelledby="salle-adresse"], section[aria-labelledby="etab-adresse"]');
  259 |                     await shot(page, name, w, theme.key);
  260 |                 }
  261 |             }
  262 |         });
  263 |     });
  264 | }
  265 | 
```