# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lot11cc.responsive.spec.ts >> tables d’un événement · clair : organisatrice, porte, scanner, administration (390 et 1440 px)
- Location: e2e/lot11cc.responsive.spec.ts:207:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /^commencer le contr[ôo]le$/i })
Expected: visible
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: /^commencer le contr[ôo]le$/i }) with timeout 30000ms
  - waiting for getByRole('heading', { name: /^commencer le contr[ôo]le$/i })

```

```yaml
- banner:
  - link "Mon espace client":
    - /url: /
  - link "Event Village, accueil":
    - /url: /
    - text: Event Village
  - button "Notifications"
  - link "Ndiaga Diagne":
    - /url: /controller/profile
- main:
  - heading "Nuit des tables 7c9c53" [level=1]
  - paragraph:
    - status: "Entrée principale : 2 entrées"
    - text: En ligne
  - button "Changer d’événement"
  - button "Se déconnecter"
  - status:
    - paragraph: Contrôle retrouvé
    - paragraph: "Même événement, même mode : rallumez la caméra."
  - button "Reprendre le contrôle"
  - group "Mode de contrôle":
    - button "Caméra" [pressed]
    - button "Saisie manuelle"
  - button "Liste des invités"
  - link "Liste des tables":
    - /url: /controller/porte/39fabc46-5266-49ea-b833-8a045cb94fbb
  - 'button "Derniers scans Vous : 2 entrées, 0 refus"'
  - group: Réglages de cet appareil
- alert
```

# Test source

```ts
  204 | });
  205 | 
  206 | for (const theme of THEMES) {
  207 |     test(`tables d’un événement · ${theme.key} : organisatrice, porte, scanner, administration (390 et 1440 px)`, async ({ browser }, testInfo) => {
  208 |         test.setTimeout(600_000);
  209 |         const data = seeded!;
  210 |         const owner = readDemoIds().accounts.organisateur3;
  211 | 
  212 |         // ── Organisatrice : éditeur, plan, jauge, vue client, type figé, pilotage, porte ───────────────────────────
  213 |         const org = await themedContext(browser, testInfo, theme.scheme);
  214 |         await login(org, owner.email);
  215 |         const page = await org.newPage();
  216 |         for (const w of WIDTHS) {
  217 |             await page.setViewportSize({ width: w.width, height: w.height });
  218 |             await page.goto(`/partner/events/${data.eventId}/edit`, { waitUntil: 'load' });
  219 |             await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  220 |             await page.getByRole('button', { name: /^Étape 4 : Billetterie$/ }).click();
  221 |             await page.getByRole('tab', { name: 'Tables' }).click();
  222 |             const editor = page.locator('[data-tables-editeur]');
  223 |             await expect(editor).toBeVisible({ timeout: 30_000 });
  224 |             // 80 billets + 4 tables de 6 + 6 tables de 8 = 152 places sur 200 (réponse du serveur)
  225 |             await expect(editor.getByText('152 places sur 200 : 80 en billets, 72 en tables')).toBeVisible();
  226 |             await expect(editor.getByText('Prix et places figés : une table est vendue ou en cours de paiement.').first()).toBeVisible();
  227 |             await settle(page);
  228 |             await checkLayout(page, w.width, w.phone, 'éditeur des tables');
  229 |             await shot(page, 'editeur', w.width, theme.key);
  230 |             await editor.locator('[data-jauge-places]').screenshot({ path: path.join(SHOTS, `l11cc-jauge__${w.width}__${theme.key}.jpg`), type: 'jpeg', quality: 85 });
  231 |             // Plan en édition : une table choisie (panneau de réglage)
  232 |             const table1 = page.getByRole('button', { name: /^Table 1, 6 places/ });
  233 |             if (await table1.count() > 0) await table1.first().click();
  234 |             await settle(page);
  235 |             await shot(page, 'plan-edition', w.width, theme.key);
  236 |             await page.getByRole('button', { name: w.phone ? 'Téléphone' : 'Ordinateur' }).click();
  237 |             await expect(page.locator(`[data-vue-client="${w.phone ? 'telephone' : 'ordinateur'}"]`)).toBeVisible();
  238 |             await settle(page);
  239 |             await shot(page, 'vue-client', w.width, theme.key);
  240 |             // Type figé : prix et places verrouillés, avec la raison
  241 |             await editor.locator('[data-type-table="Carré VIP"]').getByRole('button', { name: 'Modifier' }).click();
  242 |             const dialog = page.getByRole('dialog', { name: 'Modifier le type de table' });
  243 |             await expect(dialog).toBeVisible();
  244 |             await expect(dialog.getByLabel('Prix de la table (F CFA)')).toBeDisabled();
  245 |             await expect(dialog).toContainText('Soit 25');
  246 |             await expect(dialog).toContainText('par personne.');
  247 |             await settle(page);
  248 |             await shot(page, 'type-fige', w.width, theme.key, false);
  249 |             await page.keyboard.press('Escape');
  250 | 
  251 |             await page.goto(`/partner/events/${data.eventId}?tab=tables`, { waitUntil: 'load' });
  252 |             const pil = page.locator('[data-tables-pilotage]');
  253 |             await expect(pil).toBeVisible({ timeout: 30_000 });
  254 |             await expect(pil.locator('text="Awa S." >> visible=true').first()).toBeVisible();
  255 |             await settle(page);
  256 |             await checkLayout(page, w.width, w.phone, 'pilotage des tables');
  257 |             await shot(page, 'pilotage', w.width, theme.key);
  258 | 
  259 |             await page.goto(`/partner/events/${data.eventId}/porte`, { waitUntil: 'load' });
  260 |             const door = page.locator('[data-porte]');
  261 |             await expect(door).toBeVisible({ timeout: 30_000 });
  262 |             await expect(door.getByText('2/6').first()).toBeVisible();
  263 |             await settle(page);
  264 |             await checkLayout(page, w.width, w.phone, 'liste de la porte');
  265 |             await shot(page, 'porte', w.width, theme.key);
  266 |             await door.locator('[data-porte-table] button').first().click();
  267 |             await expect(door.getByText('Awa S.').first()).toBeVisible();
  268 |             await settle(page);
  269 |             await shot(page, 'porte-table-ouverte', w.width, theme.key);
  270 |             await page.getByRole('button', { name: 'Plein écran' }).click();
  271 |             await expect(door).toHaveAttribute('data-porte-contraste', 'fort');
  272 |             await settle(page);
  273 |             await shot(page, 'porte-plein-ecran', w.width, theme.key, false);
  274 |             await page.getByRole('button', { name: 'Quitter le plein écran' }).click();
  275 |             await page.emulateMedia({ media: 'print' });
  276 |             await settle(page);
  277 |             await shot(page, 'porte-impression', w.width, theme.key);
  278 |             await page.emulateMedia({ media: 'screen' });
  279 |         }
  280 |         await org.close();
  281 | 
  282 |         // ── Contrôleur : porte, badge du scanner (réponse du scan imposée, caméra simulée) ───────────────────────────
  283 |         const ctl = await themedContext(browser, testInfo, theme.scheme);
  284 |         await login(ctl, data.controller.email);
  285 |         await ctl.addInitScript(installFakeCamera, { mode: 'barcode-detector' as const });
  286 |         const cpage = await ctl.newPage();
  287 |         for (const w of WIDTHS) {
  288 |             await cpage.setViewportSize({ width: w.width, height: w.height });
  289 |             await cpage.goto(`/controller/porte/${data.eventId}`, { waitUntil: 'load' });
  290 |             await expect(cpage.locator('[data-porte]')).toBeVisible({ timeout: 30_000 });
  291 |             await settle(cpage);
  292 |             await checkLayout(cpage, w.width, w.phone, 'liste de la porte du contrôleur');
  293 |             await shot(cpage, 'porte-controleur', w.width, theme.key);
  294 | 
  295 |             await cpage.route(/\/api\/controller\/scan$/, async (route) => {
  296 |                 if (route.request().method() !== 'POST') return route.continue();
  297 |                 await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
  298 |                     result: 'valid', replayed: false, message: 'Entrée validée',
  299 |                     ticket: { ticket_number: data.seatNumber, category: 'Carré VIP', holder: 'Awa Sarr', is_manual_entry: false },
  300 |                     table: { label: 'Table 3 · Carré VIP', table_number: 3, entered: 3, seats: 6 },
  301 |                 }) });
  302 |             });
  303 |             await cpage.goto('/controller/scanner', { waitUntil: 'load' });
> 304 |             await expect(cpage.getByRole('heading', { name: /^commencer le contr[ôo]le$/i })).toBeVisible({ timeout: 30_000 });
      |                                                                                               ^ Error: expect(locator).toBeVisible() failed
  305 |             await cpage.getByRole('button', { name: /^commencer le contr[ôo]le$/i }).click();
  306 |             await cpage.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2), null, { timeout: 30_000 });
  307 |             await expect(cpage.getByRole('link', { name: 'Liste des tables' })).toHaveAttribute('href', `/controller/porte/${data.eventId}`);
  308 |             await cpage.evaluate((p) => {
  309 |                 const cam = (window as unknown as { __evFakeCamera?: { setPayload: (x: string) => void } }).__evFakeCamera;
  310 |                 if (!cam) throw new Error('caméra simulée absente');
  311 |                 cam.setPayload(p);
  312 |             }, `EVT1:00000000-0000-4000-8000-000000000971:482913`);
  313 |             const overlay = cpage.locator('[data-scan-state="result"][data-scan-result="valid"]');
  314 |             await expect(overlay).toBeVisible({ timeout: 20_000 });
  315 |             await expect(overlay.locator('[data-scan-table]')).toContainText('Table 3 · Carré VIP');
  316 |             await expect(overlay.locator('[data-scan-table]')).toContainText('3/6 entrés');
  317 |             await cpage.waitForTimeout(250);
  318 |             await shot(cpage, 'scanner-badge', w.width, theme.key, false);
  319 |             await cpage.unroute(/\/api\/controller\/scan$/);
  320 |         }
  321 |         await ctl.close();
  322 | 
  323 |         // ── Administration : fiche de l'événement ─────────────────────────────────────────────────────────────────
  324 |         const adm = await themedContext(browser, testInfo, theme.scheme, requireStorageState('admin'));
  325 |         const apage = await adm.newPage();
  326 |         for (const w of WIDTHS) {
  327 |             await apage.setViewportSize({ width: w.width, height: w.height });
  328 |             await apage.goto(`/admin/events/${data.eventId}`, { waitUntil: 'load' });
  329 |             const section = apage.locator('[data-admin-tables]');
  330 |             await expect(section).toBeVisible({ timeout: 30_000 });
  331 |             await expect(section.locator('text="Carré VIP" >> visible=true').first()).toBeVisible();
  332 |             await section.scrollIntoViewIfNeeded();
  333 |             await settle(apage);
  334 |             await checkLayout(apage, w.width, w.phone, 'fiche de l’administration');
  335 |             await section.screenshot({ path: path.join(SHOTS, `l11cc-admin__${w.width}__${theme.key}.jpg`), type: 'jpeg', quality: 80 });
  336 |         }
  337 |         await adm.close();
  338 |     });
  339 | }
  340 | 
```