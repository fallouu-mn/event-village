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

Locator:  locator('[data-tables-pilotage]').getByText('Awa S.').first()
Expected: visible
Received: hidden
Timeout:  15000ms

Call log:
  - Expect "toBeVisible" locator('[data-tables-pilotage]').getByText('Awa S.').first() with timeout 15000ms
  - waiting for locator('[data-tables-pilotage]').getByText('Awa S.').first()
    33 × locator resolved to <td class="px-4 py-3 align-middle break-words text-foreground-strong text-left">Awa S.</td>
       - unexpected value "hidden"

```

```yaml
- banner:
  - button "Ouvrir le menu"
  - link "Event Village, accueil":
    - /url: /
  - button "Notifications, 18 non lues": "18"
  - button "Basculer le thème"
  - link "Mon profil (Khady Sarr)":
    - /url: /profile
- main:
  - link "Mes événements":
    - /url: /partner/events
  - text: Publié
  - status: En direct
  - heading "Nuit des tables 55fe5c" [level=1]
  - paragraph: jeu. 26 nov. 2026 à 02:35 Terrasse de la Corniche, Dakar
  - link "Modifier":
    - /url: /partner/events/013049e9-e6ca-40e4-84bf-8d5e6fccc6f8/edit
  - button "Annuler l’événement"
  - tablist "Rubriques du pilotage":
    - tab "Aperçu"
    - tab "Infos"
    - tab "Ventes"
    - tab "Invitations"
    - tab "Entrées"
    - tab "Équipe"
    - tab "Caisse"
    - tab "Clôture"
    - tab "Tables" [selected]
  - tabpanel "Tables":
    - paragraph:
      - text: Mis à jour à
      - time: 01:36
    - link "Liste de la porte":
      - /url: /partner/events/013049e9-e6ca-40e4-84bf-8d5e6fccc6f8/porte
    - link "Imprimer":
      - /url: /partner/events/013049e9-e6ca-40e4-84bf-8d5e6fccc6f8/porte?imprimer=1
    - paragraph: Tables vendues
    - paragraph: 2 sur 10
    - paragraph: 1 en paiement · 7 libres
    - paragraph: Places entrées
    - paragraph: 2 sur 14
    - paragraph: Places des tables vendues
    - paragraph: Recette des tables
    - paragraph: 270 000 F CFA
    - paragraph: Hors frais de service, sans commission
    - paragraph: Tables remboursées
    - paragraph: "0"
    - paragraph: Aucune
    - region "Jauge en places":
      - heading "Jauge en places" [level=3]
      - paragraph: 48 libres
      - paragraph: "152 places sur 200 : 80 en billets, 72 en tables"
      - list "Détail de la jauge":
        - listitem: Billets 80
        - listitem: Tables 72
        - listitem: Libres 48
    - region "Plan des tables":
      - heading "Plan des tables" [level=3]
      - 'group "Plan des tables : état de chaque table"':
        - button "Table 1, 6 places, libre, Libre"
        - button "Table 2, 6 places, libre, Libre"
        - button "Table 3, 6 places, vendue, invités arrivés, Awa S., 2 sur 6 entrés"
        - button "Table 4, 6 places, libre, Libre"
        - button "Table 5, 8 places, vendue, Awa S., 0 sur 8 entrés"
        - button "Table 6, 8 places, en cours de paiement, En paiement"
        - button "Table 7, 8 places, libre, Libre"
        - button "Table 8, 8 places, libre, Libre"
        - button "Table 9, 8 places, libre, Libre"
        - button "Table 10, 8 places, libre, Libre"
      - list "Légende du plan":
        - listitem: Libre
        - listitem: En paiement
        - listitem: Vendue, invités arrivés
        - listitem: Vendue
      - paragraph: "Flèches : déplacer de 1 %. Majuscule et flèches : déplacer de 5 %. Touche R : tourner la table de 15 degrés."
      - paragraph
    - region "Liste des tables":
      - heading "Liste des tables" [level=3]
      - group "Trier les tables":
        - text: "Trier par :"
        - button "N°, ordre croissant" [pressed]: N°
        - button "Type"
        - button "Titulaire"
        - button "Places envoyées"
        - button "Places entrées"
      - list "Tables de l’événement":
        - listitem:
          - paragraph: Table 1 · Carré VIP
          - text: Libre
        - listitem:
          - paragraph: Table 2 · Carré VIP
          - text: Libre
        - listitem:
          - paragraph: Table 3 · Carré VIP
          - text: Vendue
          - term: Titulaire
          - definition: Awa S.
          - term: Envoyées
          - definition: "1"
          - term: Entrées
          - definition: 2/6
        - listitem:
          - paragraph: Table 4 · Carré VIP
          - text: Libre
        - listitem:
          - paragraph: Table 5 · Table ronde
          - text: Vendue
          - term: Titulaire
          - definition: Awa S.
          - term: Envoyées
          - definition: "0"
          - term: Entrées
          - definition: 0/8
        - listitem:
          - paragraph: Table 6 · Table ronde
          - text: En paiement
        - listitem:
          - paragraph: Table 7 · Table ronde
          - text: Libre
        - listitem:
          - paragraph: Table 8 · Table ronde
          - text: Libre
        - listitem:
          - paragraph: Table 9 · Table ronde
          - text: Libre
        - listitem:
          - paragraph: Table 10 · Table ronde
          - text: Libre
- navigation "Navigation rapide":
  - link "Accueil":
    - /url: /partner/dashboard
  - link "Billetterie":
    - /url: /partner/events
  - link "Scanner":
    - /url: /partner/scan
  - link "Finances":
    - /url: /partner/finance
  - link "Profil":
    - /url: /partner/profile
- alert
```

# Test source

```ts
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
  245 |             await expect(dialog).toContainText('Soit 25');
  246 |             await expect(dialog).toContainText('par personne.');
  247 |             await settle(page);
  248 |             await shot(page, 'type-fige', w.width, theme.key, false);
  249 |             await page.keyboard.press('Escape');
  250 | 
  251 |             await page.goto(`/partner/events/${data.eventId}?tab=tables`, { waitUntil: 'load' });
  252 |             const pil = page.locator('[data-tables-pilotage]');
  253 |             await expect(pil).toBeVisible({ timeout: 30_000 });
> 254 |             await expect(pil.getByText('Awa S.').first()).toBeVisible();
      |                                                           ^ Error: expect(locator).toBeVisible() failed
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
  304 |             await expect(cpage.getByRole('heading', { name: /^commencer le contr[ôo]le$/i })).toBeVisible({ timeout: 30_000 });
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
  331 |             await expect(section.getByText('Carré VIP').first()).toBeVisible();
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