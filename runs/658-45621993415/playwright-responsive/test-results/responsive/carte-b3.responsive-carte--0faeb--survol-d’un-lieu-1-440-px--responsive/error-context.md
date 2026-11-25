# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: carte-b3.responsive.spec.ts >> carte B3 · captures · sombre >> liste de l’ordinateur et survol d’un lieu (1 440 px)
- Location: e2e/carte-b3.responsive.spec.ts:239:13

# Error details

```
Error: survol : repère du lieu mis en évidence

expect(locator).toHaveCount(expected) failed

Locator:  locator('.ev-repere--choisi')
Expected: 1
Received: 0
Timeout:  5000ms

Call log:
  - survol : repère du lieu mis en évidence locator('.ev-repere--choisi') with timeout 5000ms
  - waiting for locator('.ev-repere--choisi')
    14 × locator resolved to 0 elements
       - unexpected value "0"

```

# Test source

```ts
  148 |     await page.locator(selector).first().evaluate((el) => {
  149 |         window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 132, behavior: 'instant' as ScrollBehavior });
  150 |     });
  151 |     await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
  152 | }
  153 | 
  154 | async function shot(page: Page, name: string, width: number, theme: ThemeKey): Promise<void> {
  155 |     fs.mkdirSync(SHOTS, { recursive: true });
  156 |     await page.waitForTimeout(350); // fin des transitions (≤ 300 ms)
  157 |     await page.screenshot({ path: path.join(SHOTS, `cb3-${name}__${width}__${theme}.jpg`), type: 'jpeg', quality: 80, caret: 'hide', scale: 'css' });
  158 | }
  159 | 
  160 | const LAYERS = '[role="group"][aria-label="Afficher sur la carte"]';
  161 | 
  162 | /** Salles des captures, à Thiès (« Aller à » Thiès, zoom 13) : une de particulier, une professionnelle. */
  163 | const THIES = {
  164 |     particulier: { name: `Salle Teranga ${STAMP}`, address: `Villa ${STAMP}, quartier Randoulène`, lat: 14.799, lng: -16.92, city: 'Thiès' },
  165 |     pro: { name: `Salle Les Rails ${STAMP}`, address: `Avenue de la Gare ${STAMP}, Thiès`, lat: 14.783, lng: -16.957, city: 'Thiès', pro: true },
  166 | } as const;
  167 | const thiesIds: string[] = [];
  168 | 
  169 | test.beforeAll(async () => {
  170 |     for (const spec of [THIES.particulier, THIES.pro]) thiesIds.push(await newHall({ ...spec, validate: true }));
  171 | });
  172 | test.afterAll(async () => {
  173 |     for (const id of thiesIds) await retire(id);
  174 | });
  175 | const MAP = '[role="region"][aria-label="Carte des événements et des lieux"]';
  176 | 
  177 | const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
  178 |     { key: 'clair', colorScheme: 'light' },
  179 |     { key: 'sombre', colorScheme: 'dark' },
  180 | ];
  181 | 
  182 | for (const theme of THEMES) {
  183 |     test.describe(`carte B3 · captures · ${theme.key}`, () => {
  184 |         test.use({ colorScheme: theme.colorScheme, evTheme: theme.key });
  185 |         test.beforeEach(async ({ context, servicesLock }) => {
  186 |             await servicesLock.enter('services');
  187 |             await context.addInitScript((value: string) => { document.cookie = `ev-theme=${value}; path=/`; }, theme.colorScheme);
  188 |         });
  189 | 
  190 |         test('couches, repères des trois types, zone d’un particulier, feuille du téléphone (360 px)', async ({ page }) => {
  191 |             test.setTimeout(240_000);
  192 |             await page.setViewportSize({ width: 360, height: 780 });
  193 |             // Salles de Thiès créées sans passer par l'administration : cache de la carte (60 s au plus) attendu ici
  194 |             await waitUntil('salles de Thiès sur la carte', async () => {
  195 |                 const shown = new Set((await hallsOnMap(page.request)).map((p) => p.id));
  196 |                 return thiesIds.every((id) => shown.has(id));
  197 |             }, 75_000, 1_000);
  198 |             await page.goto('/explore?vue=carte', { waitUntil: 'load' });
  199 |             const layers = page.locator(LAYERS);
  200 |             await expect(layers.getByRole('button', { name: /Salles/ })).toBeVisible({ timeout: 30_000 });
  201 |             await expect(layers.getByRole('button', { name: /Restaurants/ })).toHaveAttribute('aria-pressed', 'true');
  202 | 
  203 |             // Thiès : un événement (billet), une salle de particulier (pointillé, zone), une salle professionnelle
  204 |             await page.getByLabel('Aller à').selectOption('thies');
  205 |             const particulier = page.getByRole('button', { name: new RegExp(`^Salle Teranga ${STAMP},`) });
  206 |             await expect(particulier.locator('.ev-repere--approx')).toBeVisible({ timeout: 30_000 });
  207 |             await expect(page.getByRole('button', { name: new RegExp(`^Salle Les Rails ${STAMP},`) }).locator('.ev-repere--salle')).toBeVisible();
  208 |             await expect(page.locator('path.ev-zone').first()).toBeVisible({ timeout: 15_000 });
  209 |             await settle(page);
  210 |             await scrollToTop(page, LAYERS);
  211 |             await shot(page, 'couches-reperes', 360, theme.key);
  212 | 
  213 |             // Couche masquée : plus de repère de salle, couches gardées dans l'adresse
  214 |             await layers.getByRole('button', { name: /Salles/ }).click();
  215 |             await expect(layers.getByRole('button', { name: /Salles/ })).toHaveAttribute('aria-pressed', 'false');
  216 |             await expect(page).toHaveURL(/couches=evenements(%2C|,)restaurants/);
  217 |             await expect(page.locator('.leaflet-marker-icon .ev-repere--salle')).toHaveCount(0);
  218 |             await layers.getByRole('button', { name: /Salles/ }).click();
  219 |             await expect(particulier.locator('.ev-repere--approx')).toBeVisible({ timeout: 15_000 });
  220 | 
  221 |             // Feuille du téléphone : photos, faits, « Adresse exacte après réservation », lien vers la fiche
  222 |             await particulier.locator('.ev-repere').click();
  223 |             const sheet = page.getByRole('dialog');
  224 |             await expect(sheet.getByRole('link', { name: 'Voir la salle' })).toBeVisible();
  225 |             await expect(sheet).toContainText('Adresse exacte après réservation');
  226 |             await expect(sheet).not.toContainText(THIES.particulier.address);
  227 |             await scrollToTop(page, MAP);
  228 |             await shot(page, 'feuille-lieu', 360, theme.key);
  229 |             await sheet.getByRole('button', { name: 'Fermer' }).click();
  230 | 
  231 |             // Restaurants du seed (Sacré-Cœur : « Le Petit Jardin », particulier) : couverts en pointillé et zone
  232 |             await page.getByLabel('Aller à').selectOption('sacre-coeur');
  233 |             await expect(page.locator('.leaflet-marker-icon .ev-repere--resto').first()).toBeVisible({ timeout: 30_000 });
  234 |             await settle(page);
  235 |             await scrollToTop(page, MAP);
  236 |             await shot(page, 'repere-restaurant', 360, theme.key);
  237 |         });
  238 | 
  239 |         test('liste de l’ordinateur et survol d’un lieu (1 440 px)', async ({ page }) => {
  240 |             test.setTimeout(150_000);
  241 |             await page.setViewportSize({ width: 1440, height: 900 });
  242 |             await page.goto('/explore?vue=carte', { waitUntil: 'load' });
  243 |             await expect(page.locator(LAYERS).getByRole('button', { name: /Salles/ })).toBeVisible({ timeout: 30_000 });
  244 |             await page.getByLabel('Aller à').selectOption('dakar');
  245 |             const place = page.locator('[id^="carte-vignette-p-"] a').first();
  246 |             await expect(place).toBeVisible({ timeout: 30_000 });
  247 |             await place.hover();
> 248 |             await expect(page.locator('.ev-repere--choisi'), 'survol : repère du lieu mis en évidence').toHaveCount(1, { timeout: 5_000 });
      |                                                                                                         ^ Error: survol : repère du lieu mis en évidence
  249 |             await settle(page);
  250 |             await scrollToTop(page, LAYERS);
  251 |             await place.hover();
  252 |             await shot(page, 'liste-ordinateur', 1440, theme.key);
  253 |         });
  254 | 
  255 |         test('fiches : zone d’un particulier, point d’un lieu professionnel (360 et 1 440 px)', async ({ page }) => {
  256 |             test.setTimeout(180_000);
  257 |             const ids = readDemoIds();
  258 |             const pro = thiesIds[1];
  259 |             {
  260 |                 for (const w of [360, 1440] as const) {
  261 |                     await page.setViewportSize({ width: w, height: w === 360 ? 780 : 900 });
  262 |                     for (const [name, href] of [['fiche-salle-particulier', `/halls/${ids.halls.validee.id}`], ['fiche-restaurant-particulier', `/tables/${ids.tables.restaurant.id}`], ['fiche-salle-pro', `/halls/${pro}`]] as const) {
  263 |                         await page.goto(href, { waitUntil: 'load' });
  264 |                         // Page entièrement chargée d'abord (la fiche se redessine après l'arrivée du code : run 654) ; le
  265 |                         // clic attend le bouton et le fait défiler lui-même
  266 |                         await settle(page);
  267 |                         const section = page.locator('section[aria-labelledby="salle-adresse"], section[aria-labelledby="etab-adresse"]');
  268 |                         await section.getByRole('button', { name: 'Afficher la carte' }).click({ timeout: 30_000 });
  269 |                         await expect(section.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 });
  270 |                         if (name === 'fiche-salle-pro') {
  271 |                             await expect(section.getByRole('link', { name: /Voir l’itinéraire/ })).toBeVisible();
  272 |                         } else {
  273 |                             await expect(section.locator('path.ev-zone')).toHaveCount(1, { timeout: 15_000 });
  274 |                             await expect(section).toContainText('Adresse exacte après réservation');
  275 |                             await expect(section.getByRole('link', { name: /Voir l’itinéraire/ })).toHaveCount(0);
  276 |                         }
  277 |                         await settle(page);
  278 |                         await scrollToTop(page, 'section[aria-labelledby="salle-adresse"], section[aria-labelledby="etab-adresse"]');
  279 |                         await shot(page, name, w, theme.key);
  280 |                     }
  281 |                 }
  282 |             }
  283 |         });
  284 |     });
  285 | }
  286 | 
```