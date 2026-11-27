# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lot11cc.responsive.spec.ts >> tables d’un événement · clair : organisatrice, porte, scanner, administration (390 et 1440 px)
- Location: e2e/lot11cc.responsive.spec.ts:203:9

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /^commencer le contr[ôo]le$/i })

```

# Page snapshot

```yaml
- generic [active] [ref=f3e1]:
  - generic [ref=f3e3]:
    - banner [ref=f3e4]:
      - generic [ref=f3e5]:
        - link "Mon espace client" [ref=f3e6] [cursor=pointer]:
          - /url: /
        - link "Event Village, accueil" [ref=f3e11] [cursor=pointer]:
          - /url: /
          - generic [ref=f3e12]: Event Village
      - generic [ref=f3e15]:
        - button "Notifications" [ref=f3e17] [cursor=pointer]
        - link "Ndiaga Diagne" [ref=f3e21] [cursor=pointer]:
          - /url: /controller/profile
    - main [ref=f3e27]:
      - generic [ref=f3e28]:
        - generic [ref=f3e29]:
          - generic [ref=f3e30]:
            - heading "Nuit des tables 786980" [level=1] [ref=f3e31]
            - paragraph [ref=f3e32]:
              - status [ref=f3e33]: "Entrée principale : 2 entrées"
              - generic [ref=f3e34]: En ligne
          - button "Changer d’événement" [ref=f3e39] [cursor=pointer]
          - button "Se déconnecter" [ref=f3e44] [cursor=pointer]
        - generic [ref=f3e49]:
          - generic [ref=f3e52]:
            - generic "Image de la caméra" [ref=f3e53]
            - generic [ref=f3e54]:
              - status [ref=f3e59]:
                - paragraph [ref=f3e60]: Contrôle retrouvé
                - paragraph [ref=f3e61]: "Même événement, même mode : rallumez la caméra."
              - button "Reprendre le contrôle" [ref=f3e62] [cursor=pointer]
          - generic [ref=f3e68]:
            - group "Mode de contrôle" [ref=f3e69]:
              - button "Caméra" [pressed] [ref=f3e70] [cursor=pointer]
              - button "Saisie manuelle" [ref=f3e76] [cursor=pointer]
            - button "Liste des invités" [ref=f3e82] [cursor=pointer]
            - link "Liste des tables" [ref=f3e90] [cursor=pointer]:
              - /url: /controller/porte/303bccb7-5c63-4693-9b90-f859e9cd13ee
            - 'button "Derniers scans Vous : 2 entrées, 0 refus" [ref=f3e92] [cursor=pointer]':
              - generic [ref=f3e97]:
                - generic [ref=f3e98]: Derniers scans
                - generic [ref=f3e99]: "Vous : 2 entrées, 0 refus"
            - group [ref=f3e102]:
              - generic "Réglages de cet appareil" [ref=f3e103] [cursor=pointer]
  - alert [ref=f3e107]
```

# Test source

```ts
  205 |         const data = seeded!;
  206 |         const owner = readDemoIds().accounts.organisateur3;
  207 | 
  208 |         // ── Organisatrice : éditeur, plan, jauge, vue client, type figé, pilotage, porte ───────────────────────────
  209 |         const org = await themedContext(browser, testInfo, theme.scheme);
  210 |         await login(org, owner.email);
  211 |         const page = await org.newPage();
  212 |         for (const w of WIDTHS) {
  213 |             await page.setViewportSize({ width: w.width, height: w.height });
  214 |             await page.goto(`/partner/events/${data.eventId}/edit`, { waitUntil: 'load' });
  215 |             await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  216 |             await page.getByRole('button', { name: /^Étape 4 : Billetterie$/ }).click();
  217 |             await page.getByRole('tab', { name: 'Tables' }).click();
  218 |             const editor = page.locator('[data-tables-editeur]');
  219 |             await expect(editor).toBeVisible({ timeout: 30_000 });
  220 |             // 80 billets + 4 tables de 6 + 6 tables de 8 = 152 places sur 200 (réponse du serveur)
  221 |             await expect(editor.getByText('152 places sur 200 : 80 en billets, 72 en tables')).toBeVisible();
  222 |             await expect(editor.getByText('Prix et places figés : une table est vendue ou en cours de paiement.').first()).toBeVisible();
  223 |             await settle(page);
  224 |             await checkLayout(page, w.width, w.phone, 'éditeur des tables');
  225 |             await shot(page, 'editeur', w.width, theme.key);
  226 |             await editor.locator('[data-jauge-places]').screenshot({ path: path.join(SHOTS, `l11cc-jauge__${w.width}__${theme.key}.jpg`), type: 'jpeg', quality: 85 });
  227 |             // Plan en édition : une table choisie (panneau de réglage)
  228 |             const table1 = page.getByRole('button', { name: /^Table 1, 6 places/ });
  229 |             if (await table1.count() > 0) await table1.first().click();
  230 |             await settle(page);
  231 |             await shot(page, 'plan-edition', w.width, theme.key);
  232 |             await page.getByRole('button', { name: w.phone ? 'Téléphone' : 'Ordinateur' }).click();
  233 |             await expect(page.locator(`[data-vue-client="${w.phone ? 'telephone' : 'ordinateur'}"]`)).toBeVisible();
  234 |             await settle(page);
  235 |             await shot(page, 'vue-client', w.width, theme.key);
  236 |             // Type figé : prix et places verrouillés, avec la raison
  237 |             await editor.locator('[data-type-table="Carré VIP"]').getByRole('button', { name: 'Modifier' }).click();
  238 |             const dialog = page.getByRole('dialog', { name: 'Modifier le type de table' });
  239 |             await expect(dialog).toBeVisible();
  240 |             await expect(dialog.getByLabel('Prix de la table (F CFA)')).toBeDisabled();
  241 |             await expect(dialog).toContainText('Soit 25');
  242 |             await expect(dialog).toContainText('par personne.');
  243 |             await settle(page);
  244 |             await shot(page, 'type-fige', w.width, theme.key, false);
  245 |             await page.keyboard.press('Escape');
  246 | 
  247 |             await page.goto(`/partner/events/${data.eventId}?tab=tables`, { waitUntil: 'load' });
  248 |             const pil = page.locator('[data-tables-pilotage]');
  249 |             await expect(pil).toBeVisible({ timeout: 30_000 });
  250 |             await expect(pil.locator('text="Awa S." >> visible=true').first()).toBeVisible();
  251 |             await settle(page);
  252 |             await checkLayout(page, w.width, w.phone, 'pilotage des tables');
  253 |             await shot(page, 'pilotage', w.width, theme.key);
  254 | 
  255 |             await page.goto(`/partner/events/${data.eventId}/porte`, { waitUntil: 'load' });
  256 |             const door = page.locator('[data-porte]');
  257 |             await expect(door).toBeVisible({ timeout: 30_000 });
  258 |             await expect(door.getByText('2/6').first()).toBeVisible();
  259 |             await settle(page);
  260 |             await checkLayout(page, w.width, w.phone, 'liste de la porte');
  261 |             await shot(page, 'porte', w.width, theme.key);
  262 |             await door.locator('[data-porte-table] button').first().click();
  263 |             await expect(door.getByText('Awa S.').first()).toBeVisible();
  264 |             await settle(page);
  265 |             await shot(page, 'porte-table-ouverte', w.width, theme.key);
  266 |             await page.getByRole('button', { name: 'Plein écran' }).click();
  267 |             await expect(door).toHaveAttribute('data-porte-contraste', 'fort');
  268 |             await settle(page);
  269 |             await shot(page, 'porte-plein-ecran', w.width, theme.key, false);
  270 |             await page.getByRole('button', { name: 'Quitter le plein écran' }).click();
  271 |             await page.emulateMedia({ media: 'print' });
  272 |             await settle(page);
  273 |             await shot(page, 'porte-impression', w.width, theme.key);
  274 |             await page.emulateMedia({ media: 'screen' });
  275 |         }
  276 |         await org.close();
  277 | 
  278 |         // ── Contrôleur : porte, badge du scanner (réponse du scan imposée, caméra simulée) ───────────────────────────
  279 |         const ctl = await themedContext(browser, testInfo, theme.scheme);
  280 |         await login(ctl, data.controller.email);
  281 |         await ctl.addInitScript(installFakeCamera, { mode: 'barcode-detector' as const });
  282 |         const cpage = await ctl.newPage();
  283 |         for (const w of WIDTHS) {
  284 |             await cpage.setViewportSize({ width: w.width, height: w.height });
  285 |             await cpage.goto(`/controller/porte/${data.eventId}`, { waitUntil: 'load' });
  286 |             await expect(cpage.locator('[data-porte]')).toBeVisible({ timeout: 30_000 });
  287 |             await settle(cpage);
  288 |             await checkLayout(cpage, w.width, w.phone, 'liste de la porte du contrôleur');
  289 |             await shot(cpage, 'porte-controleur', w.width, theme.key);
  290 | 
  291 |             await cpage.route(/\/api\/controller\/scan$/, async (route) => {
  292 |                 if (route.request().method() !== 'POST') return route.continue();
  293 |                 await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
  294 |                     result: 'valid', replayed: false, message: 'Entrée validée',
  295 |                     ticket: { ticket_number: data.seatNumber, category: 'Carré VIP', holder: 'Awa Sarr', is_manual_entry: false },
  296 |                     table: { label: 'Table 3 · Carré VIP', table_number: 3, entered: 3, seats: 6 },
  297 |                 }) });
  298 |             });
  299 |             await cpage.goto('/controller/scanner', { waitUntil: 'load' });
  300 |             // Premier passage : écran de départ ; ensuite, le scanner retrouve le contrôle en cours (« Reprendre le contrôle »)
  301 |             const start = cpage.getByRole('button', { name: /^commencer le contr[ôo]le$/i });
  302 |             const resume = cpage.getByRole('button', { name: 'Reprendre le contrôle' });
  303 |             await expect(start.or(resume)).toBeVisible({ timeout: 30_000 });
  304 |             if (await resume.isVisible()) await resume.click();
> 305 |             else await start.click();
      |                              ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
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