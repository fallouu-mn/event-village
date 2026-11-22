# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: carte-b.responsive.spec.ts >> carte B · captures · sombre >> Explorer Liste, Carte au Sénégal et zoomée, feuille du téléphone (360 px)
- Location: e2e/carte-b.responsive.spec.ts:196:13

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('dialog').getByRole('link', { name: /Voir l’événement/ })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('dialog').getByRole('link', { name: /Voir l’événement/ }) with timeout 15000ms
  - waiting for getByRole('dialog').getByRole('link', { name: /Voir l’événement/ })

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
      - option "Thiès"
      - option "Saint-Louis" [selected]
      - option "Kaolack"
      - option "Ziguinchor"
    - button "Autour de moi"
    - region "Carte des événements":
      - button "Nuit du Sabar — édition d’automne, dim. 22 nov. · 07:15, Dès 5 000 F": Dès 5 000 F
      - button "Concert des Lumières de Gorée, lun. 23 nov. · 02:30, Dès 6 000 F": Dès 6 000 F
      - button "Nuit du slam de Kaolack, lun. 23 nov. · 21:00, Dès 3 000 F": Dès 3 000 F
      - button "Marché gourmand de la Petite-Côte, ven. 27 nov. · 10:00, Dès 1 000 F": Dès 1 000 F
      - 'button "2 événements : agrandir"': "2"
      - button "Dîner-spectacle au bord du Saloum, lun. 30 nov. · 20:00, Dès 25 000 F": Dès 25 000 F
      - button "Festival Jazz sur le Fleuve, ven. 4 déc. · 18:00, Dès 7 500 F": Dès 7 500 F
      - 'button "2 événements : agrandir"': "2"
      - button "Gala des entrepreneurs du Saloum, dim. 13 déc. · 19:30, Dès 10 000 F": Dès 10 000 F
      - button "Festival des rythmes de Casamance, ven. 18 déc. · 17:00, Dès 5 000 F": Dès 5 000 F
      - button "Carnaval des enfants de Saly, mar. 22 déc. · 15:00, Dès 2 000 F": Dès 2 000 F
      - button "Zoom avant"
      - button "Zoom arrière"
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
    - button "Rechercher dans cette zone"
    - paragraph: 1 événement dans cette zone
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
  133 | 
  134 | async function settle(page: Page): Promise<void> {
  135 |     await page.evaluate(() => document.fonts.ready.then(() => true));
  136 |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
  137 |     await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
  138 | }
  139 | 
  140 | /** Fait défiler jusqu'à un élément, placé en haut de l'écran sous l'en-tête (captures parlantes : la vue, pas les filtres). */
  141 | async function scrollToTop(page: Page, selector: string): Promise<void> {
  142 |     await page.locator(selector).first().evaluate((el) => {
  143 |         window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: 'instant' as ScrollBehavior });
  144 |     });
  145 |     await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
  146 | }
  147 | 
  148 | const VIEWS = '[role="tablist"][aria-label="Affichage des événements"]';
  149 | 
  150 | async function shot(page: Page, name: string, width: number, theme: ThemeKey): Promise<void> {
  151 |     fs.mkdirSync(SHOTS, { recursive: true });
  152 |     await page.waitForTimeout(350); // fin des transitions (≤ 300 ms)
  153 |     await page.screenshot({ path: path.join(SHOTS, `cb-${name}__${width}__${theme}.jpg`), type: 'jpeg', quality: 80, caret: 'hide', scale: 'css' });
  154 | }
  155 | 
  156 | test.describe('carte B · fond de carte', () => {
  157 |     test('aucune tuile avant la vue Carte ; mention visible ; tuiles en échec → Liste et message simple', async ({ page }) => {
  158 |         test.setTimeout(120_000);
  159 |         await page.setViewportSize({ width: 1024, height: 768 });
  160 |         const tiles = watchTiles(page);
  161 |         await page.goto('/explore', { waitUntil: 'load' });
  162 |         await settle(page);
  163 |         expect(tiles, 'Liste : aucune tuile demandée').toEqual([]);
  164 |         await expect(page.getByRole('tab', { name: 'Liste' })).toHaveAttribute('aria-selected', 'true');
  165 | 
  166 |         await page.getByRole('tab', { name: 'Carte' }).click();
  167 |         await expect(page).toHaveURL(/vue=carte/);
  168 |         await expect(page.getByRole('region', { name: 'Carte des événements' })).toBeVisible({ timeout: 30_000 });
  169 |         await expect(page.locator('.leaflet-control-attribution')).toContainText('Stadia Maps');
  170 |         await expect(page.locator('.leaflet-control-attribution')).toContainText('OpenMapTiles');
  171 |         await expect(page.locator('.leaflet-control-attribution')).toContainText('contributeurs OpenStreetMap');
  172 |         await waitUntil('tuiles demandées à l’ouverture de la carte', async () => tiles.length > 0, 15_000);
  173 | 
  174 |         // Tuiles refusées : la page revient sur la Liste, message simple, liste utilisable
  175 |         await page.route(/tiles\.stadiamaps\.com/, (route) => route.abort('failed'));
  176 |         await page.goto('/explore?vue=carte', { waitUntil: 'load' });
  177 |         await expect(page.getByText('La carte ne peut pas s’afficher pour le moment')).toBeVisible({ timeout: 30_000 });
  178 |         await expect(page.getByRole('tab', { name: 'Liste' })).toHaveAttribute('aria-selected', 'true');
  179 |         await expect(page).not.toHaveURL(/vue=carte/);
  180 |         await expect(page.getByRole('tabpanel').getByRole('heading', { level: 2 }).first()).toBeVisible();
  181 |     });
  182 | });
  183 | 
  184 | const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
  185 |     { key: 'clair', colorScheme: 'light' },
  186 |     { key: 'sombre', colorScheme: 'dark' },
  187 | ];
  188 | 
  189 | for (const theme of THEMES) {
  190 |     test.describe(`carte B · captures · ${theme.key}`, () => {
  191 |         test.use({ colorScheme: theme.colorScheme, evTheme: theme.key });
  192 |         test.beforeEach(async ({ context }) => {
  193 |             await context.addInitScript((value: string) => { document.cookie = `ev-theme=${value}; path=/`; }, theme.colorScheme);
  194 |         });
  195 | 
  196 |         test('Explorer Liste, Carte au Sénégal et zoomée, feuille du téléphone (360 px)', async ({ page }) => {
  197 |             test.setTimeout(180_000);
  198 |             await page.setViewportSize({ width: 360, height: 780 });
  199 |             await page.goto('/explore', { waitUntil: 'load' });
  200 |             await settle(page);
  201 |             await shot(page, 'explorer-liste', 360, theme.key);
  202 | 
  203 |             await page.getByRole('tab', { name: 'Carte' }).click();
  204 |             const map = page.getByRole('region', { name: 'Carte des événements' });
  205 |             await expect(map).toBeVisible({ timeout: 30_000 });
  206 |             // Le repère de Leaflet mesure 0 × 0 px : le billet visible est son enfant (.ev-repere), qui reçoit le toucher
  207 |             await expect(page.locator('.leaflet-marker-icon .ev-repere').first()).toBeVisible({ timeout: 30_000 });
  208 |             await settle(page);
  209 |             await scrollToTop(page, VIEWS);
  210 |             await shot(page, 'carte-senegal', 360, theme.key);
  211 | 
  212 |             await page.getByLabel('Aller à').selectOption('dakar');
  213 |             await settle(page);
  214 |             await scrollToTop(page, VIEWS);
  215 |             await shot(page, 'carte-zoomee', 360, theme.key);
  216 | 
  217 |             // Saint-Louis : un seul événement publié dans le jeu de démonstration (repère simple)
  218 |             await page.getByLabel('Aller à').selectOption('saint-louis');
  219 |             await settle(page);
  220 |             // Repère visé par son nom accessible (titre de l'événement) : les repères hors de la partie visible restent dans la page
  221 |             // (tout caractère autre qu'une lettre, un chiffre ou une espace devient un joker : aucune expression à échapper)
  222 |             const stLouis = readDemoIds().events.publie.title.replace(/[^\p{L}\p{N} ]/gu, '.');
  223 |             const single = page.getByRole('button', { name: new RegExp(`^${stLouis},`, 'u') });
  224 |             await expect(single.locator('.ev-repere')).toBeVisible({ timeout: 15_000 });
  225 |             await single.locator('.ev-repere').click();
  226 |             await expect(page.getByRole('dialog').getByRole('link', { name: /Voir l’événement/ })).toBeVisible();
  227 |             await scrollToTop(page, '[role="region"][aria-label="Carte des événements"]');
  228 |             await shot(page, 'feuille-telephone', 360, theme.key);
  229 |             // Clavier : un repère prend le focus et s'ouvre avec Entrée
  230 |             await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();
  231 |             await single.focus();
  232 |             await page.keyboard.press('Enter');
> 233 |             await expect(page.getByRole('dialog').getByRole('link', { name: /Voir l’événement/ })).toBeVisible();
      |                                                                                                    ^ Error: expect(locator).toBeVisible() failed
  234 |         });
  235 | 
  236 |         test('liste synchronisée et survol (1 440 px)', async ({ page }) => {
  237 |             test.setTimeout(150_000);
  238 |             await page.setViewportSize({ width: 1440, height: 900 });
  239 |             await page.goto('/explore?vue=carte', { waitUntil: 'load' });
  240 |             await expect(page.getByRole('region', { name: 'Carte des événements' })).toBeVisible({ timeout: 30_000 });
  241 |             await expect(page.locator('#carte-liste-titre')).toContainText(/dans cette zone/, { timeout: 30_000 });
  242 |             const before = await page.locator('[id^="carte-vignette-"]').count();
  243 |             // Saint-Louis (zoom 13) : la liste suit la zone visible ; un seul événement publié du jeu de démonstration y est
  244 |             await page.getByLabel('Aller à').selectOption('saint-louis');
  245 |             await settle(page);
  246 |             const cards = page.locator('[id^="carte-vignette-"]');
  247 |             await expect.poll(async () => cards.count(), { timeout: 10_000, message: 'liste ramenée à la zone visible' }).toBeLessThan(before);
  248 |             const first = cards.locator('a').first();
  249 |             await expect(first).toBeVisible({ timeout: 15_000 });
  250 |             await first.hover();
  251 |             await expect(page.locator('.ev-repere--choisi'), 'survol : repère mis en évidence').toHaveCount(1, { timeout: 5_000 });
  252 |             await scrollToTop(page, VIEWS);
  253 |             await first.hover();
  254 |             await shot(page, 'liste-synchronisee', 1440, theme.key);
  255 |             await expect(page.getByRole('button', { name: 'Rechercher dans cette zone' })).toBeVisible();
  256 |         });
  257 | 
  258 |         test('Calendrier et feuille d’un jour (360 et 1 440 px)', async ({ page }) => {
  259 |             test.setTimeout(150_000);
  260 |             for (const w of [360, 1440] as const) {
  261 |                 await page.setViewportSize({ width: w, height: w === 360 ? 780 : 900 });
  262 |                 await page.goto('/explore?vue=calendrier', { waitUntil: 'load' });
  263 |                 const day = page.getByRole('button', { name: /^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) \d{1,2} \S+, \d+ événements?$/ }).first();
  264 |                 await expect(day).toBeVisible({ timeout: 30_000 });
  265 |                 await settle(page);
  266 |                 await scrollToTop(page, VIEWS);
  267 |                 await shot(page, 'calendrier', w, theme.key);
  268 |                 await day.click();
  269 |                 const sheet = page.getByRole('dialog');
  270 |                 await expect(sheet.getByRole('link', { name: /Acheter/ }).first()).toBeVisible();
  271 |                 await shot(page, 'calendrier-jour', w, theme.key);
  272 |                 await page.keyboard.press('Escape');
  273 |             }
  274 |         });
  275 | 
  276 |         test('aperçu de la carte sur l’accueil (360 et 1 440 px)', async ({ page }) => {
  277 |             test.setTimeout(150_000);
  278 |             for (const w of [360, 1440] as const) {
  279 |                 await page.setViewportSize({ width: w, height: w === 360 ? 780 : 900 });
  280 |                 const tiles = watchTiles(page);
  281 |                 await page.goto('/', { waitUntil: 'load' });
  282 |                 await settle(page);
  283 |                 expect(tiles, 'accueil : aucune tuile avant que l’aperçu soit visible').toEqual([]);
  284 |                 const heading = page.getByRole('heading', { name: 'Partout au Sénégal' });
  285 |                 await heading.scrollIntoViewIfNeeded({ timeout: 30_000 });
  286 |                 await expect(page.getByRole('region', { name: 'Aperçu de la carte des événements' })).toBeVisible({ timeout: 30_000 });
  287 |                 await settle(page);
  288 |                 await scrollToTop(page, 'section[aria-labelledby="senegal-titre"]');
  289 |                 await shot(page, 'accueil-apercu', w, theme.key);
  290 |                 await expect(page.getByRole('link', { name: 'Ouvrir la carte' })).toHaveAttribute('href', '/explore?vue=carte');
  291 |             }
  292 |         });
  293 |     });
  294 | }
  295 | 
```