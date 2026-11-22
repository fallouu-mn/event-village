# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: carte-b.responsive.spec.ts >> carte B · captures · sombre >> Explorer Liste, Carte au Sénégal et zoomée, feuille du téléphone (360 px)
- Location: e2e/carte-b.responsive.spec.ts:186:13

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('.leaflet-marker-icon').first()
Expected: visible
Received: hidden
Timeout:  30000ms

Call log:
  - Expect "toBeVisible" locator('.leaflet-marker-icon').first() with timeout 30000ms
  - waiting for locator('.leaflet-marker-icon').first()
    62 × locator resolved to <div tabindex="0" role="button" title="8 événements : agrandir" class="leaflet-marker-icon ev-repere-ancre leaflet-zoom-hide leaflet-interactive">…</div>
       - unexpected value "hidden"

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
      - option "Choisir une ville ou un quartier" [selected]
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
      - option "Saint-Louis"
      - option "Kaolack"
      - option "Ziguinchor"
    - button "Autour de moi"
    - region "Carte des événements":
      - button "8"
      - button "3"
      - button "Dès 7 500 F"
      - button "Dès 5 000 F"
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
    - paragraph: 13 événements dans cette zone
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
  96  |         const onMap = Date.now() - t0;
  97  |         console.log(`[carte-b] arrêt de vente visible sur la carte après ${onMap} ms`);
  98  |         expect(onMap, 'la carte montre l’arrêt de vente en moins de 5 s').toBeLessThan(MAX_STALE_MS);
  99  |     });
  100 | });
  101 | 
  102 | test.describe('carte B · suspension', () => {
  103 |     test.use({ evRole: 'admin' });
  104 | 
  105 |     test('suspension par l’administration : l’événement quitte la carte en moins de 5 s ; aucun champ en trop', async ({ page }) => {
  106 |         test.setTimeout(150_000);
  107 |         const title = `Carte B suspension ${STAMP}`;
  108 |         const ev = await publishDemoEvent(title, 3000, 14.8606, -15.8758);
  109 |         await waitUntil('événement sur la carte', async () => (await mapEvents(page.request, title)).some((e) => e.id === ev.id), 75_000, 1_000);
  110 |         const shown = (await mapEvents(page.request, title)).find((e) => e.id === ev.id);
  111 |         expect(Object.keys(shown ?? {}).sort(), 'champs publics seulement').toEqual(['blur', 'color', 'endsAt', 'highlight', 'id', 'lat', 'lng', 'price', 'startsAt', 'title']);
  112 | 
  113 |         const res = await page.request.post(`/api/admin/events/${ev.id}/transition`, { data: { to: 'SUSPENDU', reason: `Contrôle du lot Carte B ${STAMP}` } });
  114 |         expect(res.status(), `suspension : ${await res.text()}`).toBe(200);
  115 |         const elapsed = await waitUntil('événement retiré de la carte', async () => !(await mapEvents(page.request, title)).some((e) => e.id === ev.id), 65_000);
  116 |         console.log(`[carte-b] suspension visible sur la carte après ${elapsed} ms`);
  117 |         expect(elapsed, 'retiré de la carte en moins de 5 s').toBeLessThan(MAX_STALE_MS);
  118 |     });
  119 | });
  120 | 
  121 | /** Requêtes de tuiles Stadia vues par la page (servies par le verrou réseau : jamais Internet). */
  122 | function watchTiles(page: Page): string[] {
  123 |     const seen: string[] = [];
  124 |     page.on('request', (r) => {
  125 |         try {
  126 |             if (TILE_HOST.test(new URL(r.url()).hostname)) seen.push(r.url());
  127 |         } catch (err) {
  128 |             console.warn(`[carte-b] adresse illisible : ${err instanceof Error ? err.message : String(err)}`);
  129 |         }
  130 |     });
  131 |     return seen;
  132 | }
  133 | 
  134 | async function settle(page: Page): Promise<void> {
  135 |     await page.evaluate(() => document.fonts.ready.then(() => true));
  136 |     await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
  137 |     await page.evaluate(() => new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); }));
  138 | }
  139 | 
  140 | async function shot(page: Page, name: string, width: number, theme: ThemeKey): Promise<void> {
  141 |     fs.mkdirSync(SHOTS, { recursive: true });
  142 |     await page.waitForTimeout(350); // fin des transitions (≤ 300 ms)
  143 |     await page.screenshot({ path: path.join(SHOTS, `cb-${name}__${width}__${theme}.jpg`), type: 'jpeg', quality: 80, caret: 'hide', scale: 'css' });
  144 | }
  145 | 
  146 | test.describe('carte B · fond de carte', () => {
  147 |     test('aucune tuile avant la vue Carte ; mention visible ; tuiles en échec → Liste et message simple', async ({ page }) => {
  148 |         test.setTimeout(120_000);
  149 |         await page.setViewportSize({ width: 1024, height: 768 });
  150 |         const tiles = watchTiles(page);
  151 |         await page.goto('/explore', { waitUntil: 'load' });
  152 |         await settle(page);
  153 |         expect(tiles, 'Liste : aucune tuile demandée').toEqual([]);
  154 |         await expect(page.getByRole('tab', { name: 'Liste' })).toHaveAttribute('aria-selected', 'true');
  155 | 
  156 |         await page.getByRole('tab', { name: 'Carte' }).click();
  157 |         await expect(page).toHaveURL(/vue=carte/);
  158 |         await expect(page.getByRole('region', { name: 'Carte des événements' })).toBeVisible({ timeout: 30_000 });
  159 |         await expect(page.locator('.leaflet-control-attribution')).toContainText('Stadia Maps');
  160 |         await expect(page.locator('.leaflet-control-attribution')).toContainText('OpenMapTiles');
  161 |         await expect(page.locator('.leaflet-control-attribution')).toContainText('contributeurs OpenStreetMap');
  162 |         await waitUntil('tuiles demandées à l’ouverture de la carte', async () => tiles.length > 0, 15_000);
  163 | 
  164 |         // Tuiles refusées : la page revient sur la Liste, message simple, liste utilisable
  165 |         await page.route(/tiles\.stadiamaps\.com/, (route) => route.abort('failed'));
  166 |         await page.goto('/explore?vue=carte', { waitUntil: 'load' });
  167 |         await expect(page.getByText('La carte ne peut pas s’afficher pour le moment')).toBeVisible({ timeout: 30_000 });
  168 |         await expect(page.getByRole('tab', { name: 'Liste' })).toHaveAttribute('aria-selected', 'true');
  169 |         await expect(page).not.toHaveURL(/vue=carte/);
  170 |         await expect(page.getByRole('tabpanel').getByRole('heading', { level: 2 }).first()).toBeVisible();
  171 |     });
  172 | });
  173 | 
  174 | const THEMES: ReadonlyArray<{ key: ThemeKey; colorScheme: 'light' | 'dark' }> = [
  175 |     { key: 'clair', colorScheme: 'light' },
  176 |     { key: 'sombre', colorScheme: 'dark' },
  177 | ];
  178 | 
  179 | for (const theme of THEMES) {
  180 |     test.describe(`carte B · captures · ${theme.key}`, () => {
  181 |         test.use({ colorScheme: theme.colorScheme, evTheme: theme.key });
  182 |         test.beforeEach(async ({ context }) => {
  183 |             await context.addInitScript((value: string) => { document.cookie = `ev-theme=${value}; path=/`; }, theme.colorScheme);
  184 |         });
  185 | 
  186 |         test('Explorer Liste, Carte au Sénégal et zoomée, feuille du téléphone (360 px)', async ({ page }) => {
  187 |             test.setTimeout(180_000);
  188 |             await page.setViewportSize({ width: 360, height: 780 });
  189 |             await page.goto('/explore', { waitUntil: 'load' });
  190 |             await settle(page);
  191 |             await shot(page, 'explorer-liste', 360, theme.key);
  192 | 
  193 |             await page.getByRole('tab', { name: 'Carte' }).click();
  194 |             const map = page.getByRole('region', { name: 'Carte des événements' });
  195 |             await expect(map).toBeVisible({ timeout: 30_000 });
> 196 |             await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 30_000 });
      |                                                                        ^ Error: expect(locator).toBeVisible() failed
  197 |             await settle(page);
  198 |             await shot(page, 'carte-senegal', 360, theme.key);
  199 | 
  200 |             await page.getByLabel('Aller à').selectOption('almadies');
  201 |             await settle(page);
  202 |             await shot(page, 'carte-zoomee', 360, theme.key);
  203 | 
  204 |             const single = page.locator('.leaflet-marker-icon.leaflet-interactive[title]:not([title*="agrandir"])').first();
  205 |             await expect(single).toBeVisible({ timeout: 15_000 });
  206 |             await single.click();
  207 |             await expect(page.getByRole('dialog').getByRole('link', { name: /Voir l’événement/ })).toBeVisible();
  208 |             await shot(page, 'feuille-telephone', 360, theme.key);
  209 |             // Clavier : un repère prend le focus et s'ouvre avec Entrée
  210 |             await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();
  211 |             await single.focus();
  212 |             await page.keyboard.press('Enter');
  213 |             await expect(page.getByRole('dialog').getByRole('link', { name: /Voir l’événement/ })).toBeVisible();
  214 |         });
  215 | 
  216 |         test('liste synchronisée et survol (1 440 px)', async ({ page }) => {
  217 |             test.setTimeout(150_000);
  218 |             await page.setViewportSize({ width: 1440, height: 900 });
  219 |             await page.goto('/explore?vue=carte', { waitUntil: 'load' });
  220 |             await expect(page.getByRole('region', { name: 'Carte des événements' })).toBeVisible({ timeout: 30_000 });
  221 |             await expect(page.locator('#carte-liste-titre')).toContainText(/dans cette zone/, { timeout: 30_000 });
  222 |             const before = await page.locator('[id^="carte-vignette-"]').count();
  223 |             // Almadies (zoom 14) : la liste suit la zone visible ; un seul événement du seed y est, seul dans sa case
  224 |             await page.getByLabel('Aller à').selectOption('almadies');
  225 |             await settle(page);
  226 |             const cards = page.locator('[id^="carte-vignette-"]');
  227 |             await expect.poll(async () => cards.count(), { timeout: 10_000, message: 'liste ramenée à la zone visible' }).toBeLessThan(before);
  228 |             const first = cards.locator('a').first();
  229 |             await expect(first).toBeVisible({ timeout: 15_000 });
  230 |             await first.hover();
  231 |             await expect(page.locator('.ev-repere--choisi'), 'survol : repère mis en évidence').toHaveCount(1, { timeout: 5_000 });
  232 |             await shot(page, 'liste-synchronisee', 1440, theme.key);
  233 |             await expect(page.getByRole('button', { name: 'Rechercher dans cette zone' })).toBeVisible();
  234 |         });
  235 | 
  236 |         test('Calendrier et feuille d’un jour (360 et 1 440 px)', async ({ page }) => {
  237 |             test.setTimeout(150_000);
  238 |             for (const w of [360, 1440] as const) {
  239 |                 await page.setViewportSize({ width: w, height: w === 360 ? 780 : 900 });
  240 |                 await page.goto('/explore?vue=calendrier', { waitUntil: 'load' });
  241 |                 const day = page.getByRole('button', { name: /^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) \d{1,2} \S+, \d+ événements?$/ }).first();
  242 |                 await expect(day).toBeVisible({ timeout: 30_000 });
  243 |                 await settle(page);
  244 |                 await shot(page, 'calendrier', w, theme.key);
  245 |                 await day.click();
  246 |                 const sheet = page.getByRole('dialog');
  247 |                 await expect(sheet.getByRole('link', { name: /Acheter/ }).first()).toBeVisible();
  248 |                 await shot(page, 'calendrier-jour', w, theme.key);
  249 |                 await page.keyboard.press('Escape');
  250 |             }
  251 |         });
  252 | 
  253 |         test('aperçu de la carte sur l’accueil (360 et 1 440 px)', async ({ page }) => {
  254 |             test.setTimeout(150_000);
  255 |             for (const w of [360, 1440] as const) {
  256 |                 await page.setViewportSize({ width: w, height: w === 360 ? 780 : 900 });
  257 |                 const tiles = watchTiles(page);
  258 |                 await page.goto('/', { waitUntil: 'load' });
  259 |                 await settle(page);
  260 |                 expect(tiles, 'accueil : aucune tuile avant que l’aperçu soit visible').toEqual([]);
  261 |                 const heading = page.getByRole('heading', { name: 'Partout au Sénégal' });
  262 |                 await heading.scrollIntoViewIfNeeded({ timeout: 30_000 });
  263 |                 await expect(page.getByRole('region', { name: 'Aperçu de la carte des événements' })).toBeVisible({ timeout: 30_000 });
  264 |                 await page.locator('section[aria-labelledby="senegal-titre"]').scrollIntoViewIfNeeded();
  265 |                 await settle(page);
  266 |                 await page.locator('section[aria-labelledby="senegal-titre"]').screenshot({ path: path.join(SHOTS, `cb-accueil-apercu__${w}__${theme.key}.jpg`), type: 'jpeg', quality: 80, scale: 'css' });
  267 |                 await expect(page.getByRole('link', { name: 'Ouvrir la carte' })).toHaveAttribute('href', '/explore?vue=carte');
  268 |             }
  269 |         });
  270 |     });
  271 | }
  272 | 
```