# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: carte-b3.responsive.spec.ts >> carte B3 · captures · clair >> fiches : zone d’un particulier, point d’un lieu professionnel (360 et 1 440 px)
- Location: e2e/carte-b3.responsive.spec.ts:254:13

# Error details

```
Error: locator.scrollIntoViewIfNeeded: Element is not attached to the DOM
Call log:
  - attempting scroll into view action
    - waiting for element to be stable

```

# Test source

```ts
  164 |     pro: { name: `Salle Les Rails ${STAMP}`, address: `Avenue de la Gare ${STAMP}, Thiès`, lat: 14.783, lng: -16.957, pro: true },
  165 | } as const;
  166 | const thiesIds: string[] = [];
  167 | 
  168 | test.beforeAll(async () => {
  169 |     for (const spec of [THIES.particulier, THIES.pro]) thiesIds.push(await newHall({ ...spec, validate: true }));
  170 | });
  171 | test.afterAll(async () => {
  172 |     for (const id of thiesIds) await retire(id);
  173 | });
  174 | const MAP = '[role="region"][aria-label="Carte des événements et des lieux"]';
  175 | 
  176 | const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
  177 |     { key: 'clair', colorScheme: 'light' },
  178 |     { key: 'sombre', colorScheme: 'dark' },
  179 | ];
  180 | 
  181 | for (const theme of THEMES) {
  182 |     test.describe(`carte B3 · captures · ${theme.key}`, () => {
  183 |         test.use({ colorScheme: theme.colorScheme, evTheme: theme.key });
  184 |         test.beforeEach(async ({ context, servicesLock }) => {
  185 |             await servicesLock.enter('services');
  186 |             await context.addInitScript((value: string) => { document.cookie = `ev-theme=${value}; path=/`; }, theme.colorScheme);
  187 |         });
  188 | 
  189 |         test('couches, repères des trois types, zone d’un particulier, feuille du téléphone (360 px)', async ({ page }) => {
  190 |             test.setTimeout(240_000);
  191 |             await page.setViewportSize({ width: 360, height: 780 });
  192 |             // Salles de Thiès créées sans passer par l'administration : cache de la carte (60 s au plus) attendu ici
  193 |             await waitUntil('salles de Thiès sur la carte', async () => {
  194 |                 const shown = new Set((await hallsOnMap(page.request)).map((p) => p.id));
  195 |                 return thiesIds.every((id) => shown.has(id));
  196 |             }, 75_000, 1_000);
  197 |             await page.goto('/explore?vue=carte', { waitUntil: 'load' });
  198 |             const layers = page.locator(LAYERS);
  199 |             await expect(layers.getByRole('button', { name: /Salles/ })).toBeVisible({ timeout: 30_000 });
  200 |             await expect(layers.getByRole('button', { name: /Restaurants/ })).toHaveAttribute('aria-pressed', 'true');
  201 | 
  202 |             // Thiès : un événement (billet), une salle de particulier (pointillé, zone), une salle professionnelle
  203 |             await page.getByLabel('Aller à').selectOption('thies');
  204 |             const particulier = page.getByRole('button', { name: new RegExp(`^Salle Teranga ${STAMP},`) });
  205 |             await expect(particulier.locator('.ev-repere--approx')).toBeVisible({ timeout: 30_000 });
  206 |             await expect(page.getByRole('button', { name: new RegExp(`^Salle Les Rails ${STAMP},`) }).locator('.ev-repere--salle')).toBeVisible();
  207 |             await expect(page.locator('path.ev-zone').first()).toBeVisible({ timeout: 15_000 });
  208 |             await settle(page);
  209 |             await scrollToTop(page, LAYERS);
  210 |             await shot(page, 'couches-reperes', 360, theme.key);
  211 | 
  212 |             // Couche masquée : plus de repère de salle, couches gardées dans l'adresse
  213 |             await layers.getByRole('button', { name: /Salles/ }).click();
  214 |             await expect(layers.getByRole('button', { name: /Salles/ })).toHaveAttribute('aria-pressed', 'false');
  215 |             await expect(page).toHaveURL(/couches=evenements(%2C|,)restaurants/);
  216 |             await expect(page.locator('.leaflet-marker-icon .ev-repere--salle')).toHaveCount(0);
  217 |             await layers.getByRole('button', { name: /Salles/ }).click();
  218 |             await expect(particulier.locator('.ev-repere--approx')).toBeVisible({ timeout: 15_000 });
  219 | 
  220 |             // Feuille du téléphone : photos, faits, « Adresse exacte après réservation », lien vers la fiche
  221 |             await particulier.locator('.ev-repere').click();
  222 |             const sheet = page.getByRole('dialog');
  223 |             await expect(sheet.getByRole('link', { name: 'Voir la salle' })).toBeVisible();
  224 |             await expect(sheet).toContainText('Adresse exacte après réservation');
  225 |             await expect(sheet).not.toContainText(THIES.particulier.address);
  226 |             await scrollToTop(page, MAP);
  227 |             await shot(page, 'feuille-lieu', 360, theme.key);
  228 |             await sheet.getByRole('button', { name: 'Fermer' }).click();
  229 | 
  230 |             // Restaurants du seed (Sacré-Cœur : « Le Petit Jardin », particulier) : couverts en pointillé et zone
  231 |             await page.getByLabel('Aller à').selectOption('sacre-coeur');
  232 |             await expect(page.locator('.leaflet-marker-icon .ev-repere--resto').first()).toBeVisible({ timeout: 30_000 });
  233 |             await settle(page);
  234 |             await scrollToTop(page, MAP);
  235 |             await shot(page, 'repere-restaurant', 360, theme.key);
  236 |         });
  237 | 
  238 |         test('liste de l’ordinateur et survol d’un lieu (1 440 px)', async ({ page }) => {
  239 |             test.setTimeout(150_000);
  240 |             await page.setViewportSize({ width: 1440, height: 900 });
  241 |             await page.goto('/explore?vue=carte', { waitUntil: 'load' });
  242 |             await expect(page.locator(LAYERS).getByRole('button', { name: /Salles/ })).toBeVisible({ timeout: 30_000 });
  243 |             await page.getByLabel('Aller à').selectOption('dakar');
  244 |             const place = page.locator('[id^="carte-vignette-p-"] a').first();
  245 |             await expect(place).toBeVisible({ timeout: 30_000 });
  246 |             await place.hover();
  247 |             await expect(page.locator('.ev-repere--choisi'), 'survol : repère du lieu mis en évidence').toHaveCount(1, { timeout: 5_000 });
  248 |             await settle(page);
  249 |             await scrollToTop(page, LAYERS);
  250 |             await place.hover();
  251 |             await shot(page, 'liste-ordinateur', 1440, theme.key);
  252 |         });
  253 | 
  254 |         test('fiches : zone d’un particulier, point d’un lieu professionnel (360 et 1 440 px)', async ({ page }) => {
  255 |             test.setTimeout(180_000);
  256 |             const ids = readDemoIds();
  257 |             const pro = thiesIds[1];
  258 |             {
  259 |                 for (const w of [360, 1440] as const) {
  260 |                     await page.setViewportSize({ width: w, height: w === 360 ? 780 : 900 });
  261 |                     for (const [name, href] of [['fiche-salle-particulier', `/halls/${ids.halls.validee.id}`], ['fiche-restaurant-particulier', `/tables/${ids.tables.restaurant.id}`], ['fiche-salle-pro', `/halls/${pro}`]] as const) {
  262 |                         await page.goto(href, { waitUntil: 'load' });
  263 |                         const section = page.locator('section[aria-labelledby="salle-adresse"], section[aria-labelledby="etab-adresse"]');
> 264 |                         await section.scrollIntoViewIfNeeded({ timeout: 30_000 });
      |                                       ^ Error: locator.scrollIntoViewIfNeeded: Element is not attached to the DOM
  265 |                         await section.getByRole('button', { name: 'Afficher la carte' }).click();
  266 |                         await expect(section.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 });
  267 |                         if (name === 'fiche-salle-pro') {
  268 |                             await expect(section.getByRole('link', { name: /Voir l’itinéraire/ })).toBeVisible();
  269 |                         } else {
  270 |                             await expect(section.locator('path.ev-zone')).toHaveCount(1, { timeout: 15_000 });
  271 |                             await expect(section).toContainText('Adresse exacte après réservation');
  272 |                             await expect(section.getByRole('link', { name: /Voir l’itinéraire/ })).toHaveCount(0);
  273 |                         }
  274 |                         await settle(page);
  275 |                         await scrollToTop(page, 'section[aria-labelledby="salle-adresse"], section[aria-labelledby="etab-adresse"]');
  276 |                         await shot(page, name, w, theme.key);
  277 |                     }
  278 |                 }
  279 |             }
  280 |         });
  281 |     });
  282 | }
  283 | 
```