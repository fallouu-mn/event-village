# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: carte-b.responsive.spec.ts >> carte B · captures · clair >> Explorer Liste, Carte au Sénégal et zoomée, feuille du téléphone (360 px)
- Location: e2e/carte-b.responsive.spec.ts:196:13

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('.leaflet-marker-icon.leaflet-interactive[title]:not([title*="agrandir"])').first().locator('.ev-repere')
    - locator resolved to <span class="ev-repere ev-repere--prix">…</span>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - element is outside of the viewport
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - element is outside of the viewport
    - retrying click action
      - waiting 100ms
    29 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - element is outside of the viewport
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
            - /url: /
        - generic [ref=e13]:
          - button "Notifications" [ref=e15] [cursor=pointer]
          - button "Basculer le thème" [ref=e20] [cursor=pointer]
          - link "Se connecter" [ref=e24] [cursor=pointer]:
            - /url: /login
      - main [ref=e28]:
        - generic [ref=e30]:
          - generic [ref=e32]:
            - generic [ref=e33]:
              - heading "Explorer les événements" [level=1] [ref=e34]
              - paragraph [ref=e35]: Concerts, festivals, soirées et rencontres à venir au Sénégal. La liste se met à jour d’elle-même.
            - status [ref=e37]: En direct
          - region "Recherche et filtres" [ref=e39]:
            - generic [ref=e41]:
              - generic [ref=e42]: Rechercher un événement
              - searchbox "Rechercher un événement" [ref=e44]
            - group "Date et prix" [ref=e45]:
              - button "Aujourd’hui" [ref=e46] [cursor=pointer]
              - button "Ce week-end" [ref=e47] [cursor=pointer]
              - button "Cette semaine" [ref=e48] [cursor=pointer]
              - button "Gratuit" [ref=e49] [cursor=pointer]
            - generic [ref=e50]:
              - generic [ref=e51]:
                - generic [ref=e52]: Ville
                - combobox "Ville" [ref=e55] [cursor=pointer]:
                  - option "Toutes les villes" [selected]
                  - option "Dakar"
                  - option "Foundiougne"
                  - option "Gorée"
                  - option "Kaolack"
                  - option "Mbour"
                  - option "Saint-Louis"
                  - option "Saly"
                  - option "Ziguinchor"
              - generic [ref=e56]:
                - generic [ref=e57]: Trier par
                - combobox "Trier par" [ref=e60] [cursor=pointer]:
                  - option "Date la plus proche" [selected]
                  - option "Prix croissant"
          - group "Catégorie" [ref=e62]:
            - button "Toutes les catégories" [pressed] [ref=e63] [cursor=pointer]:
              - generic [aria-hidden] [ref=e64]: ✓
              - text: Toutes les catégories
            - button "Concerts & Musique" [ref=e65] [cursor=pointer]
            - button "Festivals" [ref=e66] [cursor=pointer]
            - button "Gastronomie & Tables" [ref=e67] [cursor=pointer]
            - button "Salles & Réceptions" [ref=e68] [cursor=pointer]
          - tablist "Affichage des événements" [ref=e70]:
            - tab "Liste" [ref=e71] [cursor=pointer]
            - tab "Carte" [active] [selected] [ref=e72] [cursor=pointer]
            - tab "Calendrier" [ref=e73] [cursor=pointer]
          - tabpanel "Carte" [ref=e74]:
            - generic [ref=e76]:
              - generic [ref=e77]:
                - generic [ref=e79]:
                  - generic [ref=e80]: Aller à
                  - combobox "Aller à" [ref=e83] [cursor=pointer]:
                    - option "Choisir une ville ou un quartier"
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
                - button "Autour de moi" [ref=e84] [cursor=pointer]
              - generic [ref=e90]:
                - region "Carte des événements" [ref=e91]:
                  - generic:
                    - generic:
                      - button "Dès 5 000 F"
                      - button "Dès 6 000 F"
                      - button "Dès 3 000 F"
                      - button "Dès 1 000 F"
                      - button "2"
                      - button "Dès 25 000 F"
                      - button "Dès 7 500 F"
                      - button "2"
                      - button "Dès 10 000 F"
                      - button "Dès 5 000 F"
                      - button "Dès 2 000 F"
                  - generic:
                    - generic [ref=e134]:
                      - button "Zoom avant" [ref=e135] [cursor=pointer]: +
                      - button "Zoom arrière" [ref=e136] [cursor=pointer]: −
                    - generic [ref=e137]:
                      - text: ©
                      - link "Stadia Maps" [ref=e138] [cursor=pointer]:
                        - /url: https://stadiamaps.com/
                      - text: ©
                      - link "OpenMapTiles" [ref=e139] [cursor=pointer]:
                        - /url: https://openmaptiles.org/
                      - text: ©
                      - link "contributeurs OpenStreetMap" [ref=e140] [cursor=pointer]:
                        - /url: https://www.openstreetmap.org/copyright
                - paragraph [ref=e141]: Les repères sont accessibles avec la touche Tabulation, puis Entrée. La vue Liste présente les mêmes événements.
                - button "Rechercher dans cette zone" [ref=e142] [cursor=pointer]
              - paragraph [ref=e148]: 1 événement dans cette zone
    - navigation "Navigation rapide":
      - generic [ref=e149]:
        - link "Accueil" [ref=e151] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e157] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e163] [cursor=pointer]:
          - /url: /tickets
        - link "Avis" [ref=e168] [cursor=pointer]:
          - /url: /notifications
        - link "Portefeuille" [ref=e174] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e180]
```

# Test source

```ts
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
  220 |             const single = page.locator('.leaflet-marker-icon.leaflet-interactive[title]:not([title*="agrandir"])').first();
  221 |             await expect(single.locator('.ev-repere')).toBeVisible({ timeout: 15_000 });
> 222 |             await single.locator('.ev-repere').click();
      |                                                ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  223 |             await expect(page.getByRole('dialog').getByRole('link', { name: /Voir l’événement/ })).toBeVisible();
  224 |             await scrollToTop(page, '[role="region"][aria-label="Carte des événements"]');
  225 |             await shot(page, 'feuille-telephone', 360, theme.key);
  226 |             // Clavier : un repère prend le focus et s'ouvre avec Entrée
  227 |             await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();
  228 |             await single.focus();
  229 |             await page.keyboard.press('Enter');
  230 |             await expect(page.getByRole('dialog').getByRole('link', { name: /Voir l’événement/ })).toBeVisible();
  231 |         });
  232 | 
  233 |         test('liste synchronisée et survol (1 440 px)', async ({ page }) => {
  234 |             test.setTimeout(150_000);
  235 |             await page.setViewportSize({ width: 1440, height: 900 });
  236 |             await page.goto('/explore?vue=carte', { waitUntil: 'load' });
  237 |             await expect(page.getByRole('region', { name: 'Carte des événements' })).toBeVisible({ timeout: 30_000 });
  238 |             await expect(page.locator('#carte-liste-titre')).toContainText(/dans cette zone/, { timeout: 30_000 });
  239 |             const before = await page.locator('[id^="carte-vignette-"]').count();
  240 |             // Saint-Louis (zoom 13) : la liste suit la zone visible ; un seul événement publié du jeu de démonstration y est
  241 |             await page.getByLabel('Aller à').selectOption('saint-louis');
  242 |             await settle(page);
  243 |             const cards = page.locator('[id^="carte-vignette-"]');
  244 |             await expect.poll(async () => cards.count(), { timeout: 10_000, message: 'liste ramenée à la zone visible' }).toBeLessThan(before);
  245 |             const first = cards.locator('a').first();
  246 |             await expect(first).toBeVisible({ timeout: 15_000 });
  247 |             await first.hover();
  248 |             await expect(page.locator('.ev-repere--choisi'), 'survol : repère mis en évidence').toHaveCount(1, { timeout: 5_000 });
  249 |             await scrollToTop(page, VIEWS);
  250 |             await first.hover();
  251 |             await shot(page, 'liste-synchronisee', 1440, theme.key);
  252 |             await expect(page.getByRole('button', { name: 'Rechercher dans cette zone' })).toBeVisible();
  253 |         });
  254 | 
  255 |         test('Calendrier et feuille d’un jour (360 et 1 440 px)', async ({ page }) => {
  256 |             test.setTimeout(150_000);
  257 |             for (const w of [360, 1440] as const) {
  258 |                 await page.setViewportSize({ width: w, height: w === 360 ? 780 : 900 });
  259 |                 await page.goto('/explore?vue=calendrier', { waitUntil: 'load' });
  260 |                 const day = page.getByRole('button', { name: /^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) \d{1,2} \S+, \d+ événements?$/ }).first();
  261 |                 await expect(day).toBeVisible({ timeout: 30_000 });
  262 |                 await settle(page);
  263 |                 await scrollToTop(page, VIEWS);
  264 |                 await shot(page, 'calendrier', w, theme.key);
  265 |                 await day.click();
  266 |                 const sheet = page.getByRole('dialog');
  267 |                 await expect(sheet.getByRole('link', { name: /Acheter/ }).first()).toBeVisible();
  268 |                 await shot(page, 'calendrier-jour', w, theme.key);
  269 |                 await page.keyboard.press('Escape');
  270 |             }
  271 |         });
  272 | 
  273 |         test('aperçu de la carte sur l’accueil (360 et 1 440 px)', async ({ page }) => {
  274 |             test.setTimeout(150_000);
  275 |             for (const w of [360, 1440] as const) {
  276 |                 await page.setViewportSize({ width: w, height: w === 360 ? 780 : 900 });
  277 |                 const tiles = watchTiles(page);
  278 |                 await page.goto('/', { waitUntil: 'load' });
  279 |                 await settle(page);
  280 |                 expect(tiles, 'accueil : aucune tuile avant que l’aperçu soit visible').toEqual([]);
  281 |                 const heading = page.getByRole('heading', { name: 'Partout au Sénégal' });
  282 |                 await heading.scrollIntoViewIfNeeded({ timeout: 30_000 });
  283 |                 await expect(page.getByRole('region', { name: 'Aperçu de la carte des événements' })).toBeVisible({ timeout: 30_000 });
  284 |                 await settle(page);
  285 |                 await scrollToTop(page, 'section[aria-labelledby="senegal-titre"]');
  286 |                 await shot(page, 'accueil-apercu', w, theme.key);
  287 |                 await expect(page.getByRole('link', { name: 'Ouvrir la carte' })).toHaveAttribute('href', '/explore?vue=carte');
  288 |             }
  289 |         });
  290 |     });
  291 | }
  292 | 
```