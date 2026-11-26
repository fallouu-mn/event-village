# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lot11cc.responsive.spec.ts >> tables d’un événement · clair : organisatrice, porte, scanner, administration (390 et 1440 px)
- Location: e2e/lot11cc.responsive.spec.ts:207:9

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('dialog', { name: 'Modifier le type de table' })
Expected pattern: /Soit 25.000 F.{0,6} par personne\./
Received string:  "Modifier le type de tableCarré VIPNom du type* (obligatoire)Places par table* (obligatoire)Prix de la table (F CFA)* (obligatoire)Soit 25 000 F CFA par personne.Figé : une table de ce type est vendue ou en cours de paiement. Le client a payé ce qu’il a vu.Ce qui est compris37 / 1000Une bouteille et un plateau de fruitsFacultatif. Affiché aux clients tel quel.Minimum sur placeFacultatif. Un simple texte : rien n’est encaissé en plus.AnnulerEnregistrer"
Timeout: 15000ms

Call log:
  - Expect "toContainText" getByRole('dialog', { name: 'Modifier le type de table' }) with timeout 15000ms
  - waiting for getByRole('dialog', { name: 'Modifier le type de table' })
    33 × locator resolved to <div role="dialog" tabindex="-1" aria-modal="true" aria-labelledby="_r_16_-titre" aria-describedby="_r_16_-description" class="relative z-10 flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-popover text-left text-foreground-strong shadow-2xl focus:outline-none sm:max-h-[85dvh] sm:rounded-3xl animate-in fade-in zoom-in-95 ev-sheet-mobile sm:max-w-lg">…</div>
       - unexpected value "Modifier le type de tableCarré VIPNom du type* (obligatoire)Places par table* (obligatoire)Prix de la table (F CFA)* (obligatoire)Soit 25 000 F CFA par personne.Figé : une table de ce type est vendue ou en cours de paiement. Le client a payé ce qu’il a vu.Ce qui est compris37 / 1000Une bouteille et un plateau de fruitsFacultatif. Affiché aux clients tel quel.Minimum sur placeFacultatif. Un simple texte : rien n’est encaissé en plus.AnnulerEnregistrer"

```

```yaml
- dialog "Modifier le type de table":
  - heading "Modifier le type de table" [level=2]
  - paragraph: Carré VIP
  - button "Fermer"
  - text: Nom du type (obligatoire)
  - textbox "Nom du type (obligatoire)":
    - /placeholder: Carré VIP, Table d’honneur…
    - text: Carré VIP
  - text: Places par table (obligatoire)
  - img "Figé"
  - spinbutton "Places par table (obligatoire)" [disabled]: "6"
  - text: Prix de la table (F CFA) (obligatoire)
  - img "Figé"
  - spinbutton "Prix de la table (F CFA) (obligatoire)" [disabled]: "150000"
  - paragraph: Soit 25 000 F CFA par personne.
  - paragraph: "Figé : une table de ce type est vendue ou en cours de paiement. Le client a payé ce qu’il a vu."
  - text: Ce qui est compris 37 / 1000
  - textbox "Ce qui est compris":
    - /placeholder: Une bouteille, un plateau de fruits…
    - text: Une bouteille et un plateau de fruits
  - paragraph: Facultatif. Affiché aux clients tel quel.
  - text: Minimum sur place
  - textbox "Minimum sur place":
    - /placeholder: 50 000 F de consommations sur place
    - text: 50 000 F de consommations sur place
  - paragraph: "Facultatif. Un simple texte : rien n’est encaissé en plus."
  - button "Annuler"
  - button "Enregistrer"
```

# Test source

```ts
  145 |     if (error || !rows) throw new Error(`[l11cc] tables de l'événement : ${error?.message}`);
  146 |     // Carré VIP en 2 × 2 en haut à gauche, tables rondes en deux rangées en bas
  147 |     const vipPos = [[17.5, 22.5], [32.5, 22.5], [17.5, 37.5], [32.5, 37.5]];
  148 |     const rondePos = [[52.5, 62.5], [67.5, 62.5], [82.5, 62.5], [52.5, 80], [67.5, 80], [82.5, 80]];
  149 |     let iv = 0;
  150 |     let ir = 0;
  151 |     const tables = rows.map((t) => {
  152 |         const p = t.category_id === vipId ? vipPos[iv++] : rondePos[ir++];
  153 |         return { id: t.id, type_id: t.category_id, number: t.number, zone_id: null, x: p[0], y: p[1], shape: t.category_id === vipId ? 'CARREE' : 'RONDE', rotation: 0 };
  154 |     });
  155 |     await rpcOk('event_tables_save', { event_id: eventId, actor_id: owner.userId, plan_enabled: true, tables, zones: [] });
  156 | 
  157 |     const vipTables = rows.filter((t) => t.category_id === vipId);
  158 |     const rondeTables = rows.filter((t) => t.category_id === rondeId);
  159 |     const awa = await createClientAccount(`l11cc-a-${STAMP}`);
  160 |     const fatou = await createClientAccount(`l11cc-b-${STAMP}`);
  161 |     const moussa = await createClientAccount(`l11cc-c-${STAMP}`);
  162 |     const guest = await createClientAccount(`l11cc-g-${STAMP}`);
  163 |     const bookingA = await buyTable(eventId, awa, vipId, String(vipTables[2].id), true);
  164 |     await buyTable(eventId, fatou, rondeId, String(rondeTables[0].id), true);
  165 |     await buyTable(eventId, moussa, rondeId, String(rondeTables[1].id), false);
  166 | 
  167 |     const { data: seats, error: sErr } = await service.from('tickets').select('id, ticket_number').eq('event_table_booking_id', bookingA!).order('ticket_number');
  168 |     if (sErr || !seats || seats.length !== 6) throw new Error(`[l11cc] places de la table : ${sErr?.message ?? seats?.length}`);
  169 |     const transfer = await rpcOk('ticket_transfer_initiate', { ticket_id: seats[0].id, actor_id: awa.userId, recipient: guest.phone, expires_at: new Date(Date.now() + 48 * 3600_000).toISOString() });
  170 |     await rpcOk('ticket_transfer_accept', { transfer_id: transfer.transfer_id, actor_id: guest.userId });
  171 | 
  172 |     const controller = await createControllerAccount(`l11cc-${STAMP}`);
  173 |     const { error: aErr } = await service.from('event_controllers').upsert(
  174 |         { event_id: eventId, user_id: controller.userId, can_accept_cash: false, created_by: owner.userId, entry_point: 'Entrée principale' },
  175 |         { onConflict: 'event_id,user_id' });
  176 |     if (aErr) throw new Error(`[l11cc] affectation du contrôleur : ${aErr.message}`);
  177 |     // La place envoyée (seats[0]) est réémise au nom de l’invitée : les entrées portent sur deux places restées au titulaire
  178 |     for (const seat of seats.slice(1, 3)) {
  179 |         const number = String(seat.ticket_number);
  180 |         const { data, error: scanErr } = await service.rpc('ticket_scan', { p: {
  181 |             scanner_id: controller.userId, event_id: eventId, method: 'MANUAL', ticket_number: number, identity_verified: true,
  182 |             payload_hash: createHash('sha256').update(number.toUpperCase()).digest('hex'), client_key: `l11cc-${randomUUID()}`,
  183 |         } });
  184 |         if (scanErr || (data as { result?: string } | null)?.result !== 'valid') throw new Error(`[l11cc] entrée de la place ${number} : ${scanErr?.message ?? JSON.stringify(data)}`);
  185 |     }
  186 |     return { eventId, title, controller, seatNumber: String(seats[3].ticket_number) };
  187 | }
  188 | 
  189 | let seeded: Seeded | null = null;
  190 | let superadmin = '';
  191 | let previous: boolean | null = null;
  192 | 
  193 | test.beforeAll(async () => {
  194 |     test.setTimeout(240_000);
  195 |     superadmin = await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
  196 |     const { data } = await serviceClient().from('platform_settings').select('value').eq('key', 'features.event_tables_enabled').maybeSingle();
  197 |     previous = (data?.value as { value?: boolean } | null)?.value === true;
  198 |     await setTablesService(true, superadmin);
  199 |     seeded = await seed(superadmin);
  200 | });
  201 | 
  202 | test.afterAll(async () => {
  203 |     if (superadmin) await setTablesService(previous === true, superadmin);
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
> 245 |             await expect(dialog).toContainText(/Soit 25.000 F.{0,6} par personne\./);
      |                                  ^ Error: expect(locator).toContainText(expected) failed
  246 |             await settle(page);
  247 |             await shot(page, 'type-fige', w.width, theme.key, false);
  248 |             await page.keyboard.press('Escape');
  249 | 
  250 |             await page.goto(`/partner/events/${data.eventId}?tab=tables`, { waitUntil: 'load' });
  251 |             const pil = page.locator('[data-tables-pilotage]');
  252 |             await expect(pil).toBeVisible({ timeout: 30_000 });
  253 |             await expect(pil.getByText('Awa S.').first()).toBeVisible();
  254 |             await settle(page);
  255 |             await checkLayout(page, w.width, w.phone, 'pilotage des tables');
  256 |             await shot(page, 'pilotage', w.width, theme.key);
  257 | 
  258 |             await page.goto(`/partner/events/${data.eventId}/porte`, { waitUntil: 'load' });
  259 |             const door = page.locator('[data-porte]');
  260 |             await expect(door).toBeVisible({ timeout: 30_000 });
  261 |             await expect(door.getByText('2/6').first()).toBeVisible();
  262 |             await settle(page);
  263 |             await checkLayout(page, w.width, w.phone, 'liste de la porte');
  264 |             await shot(page, 'porte', w.width, theme.key);
  265 |             await door.locator('[data-porte-table] button').first().click();
  266 |             await expect(door.getByText('Awa S.').first()).toBeVisible();
  267 |             await settle(page);
  268 |             await shot(page, 'porte-table-ouverte', w.width, theme.key);
  269 |             await page.getByRole('button', { name: 'Plein écran' }).click();
  270 |             await expect(door).toHaveAttribute('data-porte-contraste', 'fort');
  271 |             await settle(page);
  272 |             await shot(page, 'porte-plein-ecran', w.width, theme.key, false);
  273 |             await page.getByRole('button', { name: 'Quitter le plein écran' }).click();
  274 |             await page.emulateMedia({ media: 'print' });
  275 |             await settle(page);
  276 |             await shot(page, 'porte-impression', w.width, theme.key);
  277 |             await page.emulateMedia({ media: 'screen' });
  278 |         }
  279 |         await org.close();
  280 | 
  281 |         // ── Contrôleur : porte, badge du scanner (réponse du scan imposée, caméra simulée) ───────────────────────────
  282 |         const ctl = await themedContext(browser, testInfo, theme.scheme);
  283 |         await login(ctl, data.controller.email);
  284 |         await ctl.addInitScript(installFakeCamera, { mode: 'barcode-detector' as const });
  285 |         const cpage = await ctl.newPage();
  286 |         for (const w of WIDTHS) {
  287 |             await cpage.setViewportSize({ width: w.width, height: w.height });
  288 |             await cpage.goto(`/controller/porte/${data.eventId}`, { waitUntil: 'load' });
  289 |             await expect(cpage.locator('[data-porte]')).toBeVisible({ timeout: 30_000 });
  290 |             await settle(cpage);
  291 |             await checkLayout(cpage, w.width, w.phone, 'liste de la porte du contrôleur');
  292 |             await shot(cpage, 'porte-controleur', w.width, theme.key);
  293 | 
  294 |             await cpage.route(/\/api\/controller\/scan$/, async (route) => {
  295 |                 if (route.request().method() !== 'POST') return route.continue();
  296 |                 await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
  297 |                     result: 'valid', replayed: false, message: 'Entrée validée',
  298 |                     ticket: { ticket_number: data.seatNumber, category: 'Carré VIP', holder: 'Awa Sarr', is_manual_entry: false },
  299 |                     table: { label: 'Table 3 · Carré VIP', table_number: 3, entered: 3, seats: 6 },
  300 |                 }) });
  301 |             });
  302 |             await cpage.goto('/controller/scanner', { waitUntil: 'load' });
  303 |             await expect(cpage.getByRole('heading', { name: /^commencer le contr[ôo]le$/i })).toBeVisible({ timeout: 30_000 });
  304 |             await cpage.getByRole('button', { name: /^commencer le contr[ôo]le$/i }).click();
  305 |             await cpage.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2), null, { timeout: 30_000 });
  306 |             await expect(cpage.getByRole('link', { name: 'Liste des tables' })).toHaveAttribute('href', `/controller/porte/${data.eventId}`);
  307 |             await cpage.evaluate((p) => {
  308 |                 const cam = (window as unknown as { __evFakeCamera?: { setPayload: (x: string) => void } }).__evFakeCamera;
  309 |                 if (!cam) throw new Error('caméra simulée absente');
  310 |                 cam.setPayload(p);
  311 |             }, `EVT1:00000000-0000-4000-8000-000000000971:482913`);
  312 |             const overlay = cpage.locator('[data-scan-state="result"][data-scan-result="valid"]');
  313 |             await expect(overlay).toBeVisible({ timeout: 20_000 });
  314 |             await expect(overlay.locator('[data-scan-table]')).toContainText('Table 3 · Carré VIP');
  315 |             await expect(overlay.locator('[data-scan-table]')).toContainText('3/6 entrés');
  316 |             await cpage.waitForTimeout(250);
  317 |             await shot(cpage, 'scanner-badge', w.width, theme.key, false);
  318 |             await cpage.unroute(/\/api\/controller\/scan$/);
  319 |         }
  320 |         await ctl.close();
  321 | 
  322 |         // ── Administration : fiche de l'événement ─────────────────────────────────────────────────────────────────
  323 |         const adm = await themedContext(browser, testInfo, theme.scheme, requireStorageState('admin'));
  324 |         const apage = await adm.newPage();
  325 |         for (const w of WIDTHS) {
  326 |             await apage.setViewportSize({ width: w.width, height: w.height });
  327 |             await apage.goto(`/admin/events/${data.eventId}`, { waitUntil: 'load' });
  328 |             const section = apage.locator('[data-admin-tables]');
  329 |             await expect(section).toBeVisible({ timeout: 30_000 });
  330 |             await expect(section.getByText('Carré VIP').first()).toBeVisible();
  331 |             await section.scrollIntoViewIfNeeded();
  332 |             await settle(apage);
  333 |             await checkLayout(apage, w.width, w.phone, 'fiche de l’administration');
  334 |             await section.screenshot({ path: path.join(SHOTS, `l11cc-admin__${w.width}__${theme.key}.jpg`), type: 'jpeg', quality: 80 });
  335 |         }
  336 |         await adm.close();
  337 |     });
  338 | }
  339 | 
```