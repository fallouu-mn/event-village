# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lot11cb.responsive.spec.ts >> parcours d’achat d’une table, 1440 px, clair
- Location: e2e/lot11cb.responsive.spec.ts:222:13

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('dialog').getByRole('button', { name: /Table \d+, 6 places, prise/ })
Expected: visible
Error: strict mode violation: getByRole('dialog').getByRole('button', { name: /Table \d+, 6 places, prise/ }) resolved to 2 elements:
    1) <button type="button" aria-pressed="false" aria-disabled="true" aria-label="Table 1, 6 places, prise" data-table-id="db4a5e80-0f1f-40be-a681-18d18a838b22" class="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 select-none items-center justify-center rounded-lg text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted cursor-not-allowed opacity-70">…</button> aka getByRole('button', { name: 'Table 1, 6 places, prise' })
    2) <button type="button" aria-pressed="false" aria-disabled="true" aria-label="Table 2, 6 places, prise" data-table-id="471d23e5-b1fe-4e0b-9c25-2b0354914d2d" class="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 select-none items-center justify-center rounded-lg text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted cursor-not-allowed opacity-70">…</button> aka getByRole('button', { name: 'Table 2, 6 places, prise' })

Call log:
  - Expect "toBeVisible" getByRole('dialog').getByRole('button', { name: /Table \d+, 6 places, prise/ }) with timeout 15000ms
  - waiting for getByRole('dialog').getByRole('button', { name: /Table \d+, 6 places, prise/ })

```

# Test source

```ts
  152 |     });
  153 |     const ronde = await rpcOk('event_table_type_save', {
  154 |         event_id: planEventId, actor_id: owner.userId, count: 6,
  155 |         type: { name: 'Table ronde', seats: 8, price: 120_000, included_text: 'Softs à volonté', payment_mode: 'FULL' },
  156 |     });
  157 |     const vipId = String((vip.type as Record<string, unknown>).id);
  158 |     const rondeId = String((ronde.type as Record<string, unknown>).id);
  159 |     const { data: rows, error } = await service.from('event_tables').select('id, number, category_id').eq('event_id', planEventId).order('number');
  160 |     if (error || !rows) throw new Error(`[l11cb] tables de l'événement : ${error?.message}`);
  161 |     const vipPos = [[17.5, 22.5], [32.5, 22.5], [17.5, 40], [32.5, 40]];
  162 |     const rondePos = [[57.5, 22.5], [72.5, 22.5], [87.5, 22.5], [57.5, 62.5], [72.5, 62.5], [87.5, 62.5]];
  163 |     let iv = 0;
  164 |     let ir = 0;
  165 |     const tables = rows.map((t) => {
  166 |         const p = t.category_id === vipId ? vipPos[iv++] : rondePos[ir++];
  167 |         return { id: t.id, type_id: t.category_id, number: t.number, zone_id: null, x: p[0], y: p[1], shape: t.category_id === vipId ? 'CARREE' : 'RONDE', rotation: 0 };
  168 |     });
  169 |     await rpcOk('event_tables_save', { event_id: planEventId, actor_id: owner.userId, plan_enabled: true, tables, zones: [] });
  170 |     const vipTables = rows.filter((t) => t.category_id === vipId).map((t) => ({ id: String(t.id), number: Number(t.number) }));
  171 |     const rondeTables = rows.filter((t) => t.category_id === rondeId).map((t) => ({ id: String(t.id), number: Number(t.number) }));
  172 | 
  173 |     const noPlanEventId = await createPublishedEvent({
  174 |         partnerUserId: owner.userId, superadminId: superadmin, title: `Brunch des tables ${STAMP}`,
  175 |         description: 'Captures du lot 11c-b (sans plan de salle). Données fictives.',
  176 |         startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time,
  177 |         location: 'Jardin du Plateau', city: 'Dakar', capacity: 100, imageUrl: poster,
  178 |         categories: [{ name: 'Entrée', price: 3_000, total: 40 }],
  179 |     });
  180 |     await rpcOk('event_table_type_save', {
  181 |         event_id: noPlanEventId, actor_id: owner.userId, count: 3,
  182 |         type: { name: 'Table famille', seats: 4, price: 60_000, included_text: 'Jus frais et pâtisseries', payment_mode: 'FULL' },
  183 |     });
  184 | 
  185 |     const holder = await createClientAccount(`l11cb-a-${STAMP}`);
  186 |     const guest = await createClientAccount(`l11cb-g-${STAMP}`);
  187 |     const other = await createClientAccount(`l11cb-b-${STAMP}`);
  188 |     const pendingTo = await createClientAccount(`l11cb-p-${STAMP}`);
  189 |     const bookingId = await buyTable(planEventId, holder, vipId, vipTables[0].id);
  190 |     await buyTable(planEventId, other, rondeId, rondeTables[0].id);
  191 | 
  192 |     const { data: seats, error: sErr } = await service.from('tickets').select('id').eq('event_table_booking_id', bookingId).order('ticket_number');
  193 |     if (sErr || !seats || seats.length !== 6) throw new Error(`[l11cb] places de la table : ${sErr?.message ?? seats?.length}`);
  194 |     const sent = await rpcOk('ticket_transfer_initiate', { ticket_id: seats[1].id, actor_id: holder.userId, recipient: guest.phone, expires_at: new Date(Date.now() + 48 * 3600_000).toISOString() });
  195 |     await rpcOk('ticket_transfer_accept', { transfer_id: sent.transfer_id, actor_id: guest.userId });
  196 |     await rpcOk('ticket_transfer_initiate', { ticket_id: seats[2].id, actor_id: holder.userId, recipient: pendingTo.phone, expires_at: new Date(Date.now() + 48 * 3600_000).toISOString() });
  197 | 
  198 |     return { planEventId, noPlanEventId, holder, guest, bookingId, free: [vipTables[1], vipTables[2], vipTables[3], rondeTables[1]] };
  199 | }
  200 | 
  201 | let seeded: Seeded | null = null;
  202 | let superadmin = '';
  203 | let previous = false;
  204 | 
  205 | test.beforeAll(async () => {
  206 |     test.setTimeout(240_000);
  207 |     superadmin = await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
  208 |     const { data } = await serviceClient().from('platform_settings').select('value').eq('key', 'features.event_tables_enabled').maybeSingle();
  209 |     previous = (data?.value as { value?: boolean } | null)?.value === true;
  210 |     await setTablesService(true, superadmin);
  211 |     seeded = await seed(superadmin);
  212 | });
  213 | 
  214 | test.afterAll(async () => {
  215 |     if (superadmin) await setTablesService(previous, superadmin);
  216 | });
  217 | 
  218 | let round = 0;
  219 | 
  220 | for (const theme of THEMES) {
  221 |     for (const w of WIDTHS) {
  222 |         test(`parcours d’achat d’une table, ${w.width} px, ${theme.key}`, async ({ browser }, testInfo) => {
  223 |             test.setTimeout(240_000);
  224 |             const data = seeded!;
  225 |             const table = data.free[round++];
  226 |             await setTablesService(true, superadmin);
  227 |             const buyer = await createClientAccount(`l11cb-c${round}-${STAMP}`);
  228 |             const context = await themedContext(browser, testInfo, theme.scheme);
  229 |             try {
  230 |                 await login(context, buyer.email);
  231 |                 const page = await context.newPage();
  232 |                 await page.setViewportSize({ width: w.width, height: w.height });
  233 |                 context.on('page', (p) => { if (p !== page) void p.close(); }); // page de paiement de l'opérateur (faux SamirPay)
  234 | 
  235 |                 // 1. Fiche avec plan : onglet « Tables »
  236 |                 await page.goto(`/events/${data.planEventId}?tables=1`);
  237 |                 await expect(page.getByRole('tab', { name: /Tables/ })).toHaveAttribute('aria-selected', 'true');
  238 |                 await expect(page.getByRole('heading', { name: 'Tables', exact: true })).toBeVisible();
  239 |                 const openPlan = page.getByRole('button', { name: 'Voir le plan et choisir ma table' });
  240 |                 await expect(openPlan).toBeVisible();
  241 |                 await expect(page.getByRole('heading', { name: 'Carré VIP', exact: true })).toBeVisible();
  242 |                 await expect(page.getByText(/^(Plus que \d+ tables|Plus qu’une table)$/).first()).toBeVisible();
  243 |                 await settle(page);
  244 |                 await checkLayout(page, w.width, w.phone, 'fiche avec plan');
  245 |                 await shot(page, 'fiche-plan', w.width, theme.key);
  246 | 
  247 |                 // 2. Plan et feuille de devis
  248 |                 await openPlan.click();
  249 |                 // Titre de la fenêtre : « Choisissez votre table », puis « Table réservée » à la confirmation
  250 |                 const dialog = page.getByRole('dialog');
  251 |                 await expect(page.getByRole('dialog', { name: 'Choisissez votre table' })).toBeVisible();
> 252 |                 await expect(dialog.getByRole('button', { name: /Table \d+, 6 places, prise/ })).toBeVisible();
      |                                                                                                  ^ Error: expect(locator).toBeVisible() failed
  253 |                 await dialog.locator(`[data-table-id="${table.id}"]`).click();
  254 |                 const reserve = dialog.getByRole('button', { name: `Réserver la table ${table.number}` });
  255 |                 await expect(reserve).toBeEnabled();
  256 |                 await settle(page);
  257 |                 await checkLayout(page, w.width, w.phone, 'plan et feuille de devis');
  258 |                 await shot(page, 'plan-devis', w.width, theme.key, false);
  259 | 
  260 |                 // 3. Paiement puis « Table gardée »
  261 |                 await reserve.click();
  262 |                 await dialog.locator('label', { hasText: 'Wave' }).click();
  263 |                 const pay = dialog.getByRole('button', { name: /^Payer .* avec Wave$/ });
  264 |                 await expect(pay).toBeEnabled();
  265 |                 await pay.click();
  266 |                 await expect(dialog.getByText('Table gardée')).toBeVisible({ timeout: 20_000 });
  267 |                 await settle(page);
  268 |                 await checkLayout(page, w.width, w.phone, 'compte à rebours');
  269 |                 await shot(page, 'compte-a-rebours', w.width, theme.key, false);
  270 | 
  271 |                 // 4. Paiement confirmé : confirmation, puis « Envoyez vos N places »
  272 |                 const { data: pays } = await serviceClient().from('payments').select('id').eq('client_id', buyer.userId).order('created_at', { ascending: false }).limit(1);
  273 |                 await completePayment(String(pays?.[0]?.id));
  274 |                 await expect(dialog.getByRole('heading', { name: 'Votre table est réservée' })).toBeVisible({ timeout: 30_000 });
  275 |                 await expect(dialog.getByRole('link', { name: /^Envoyez vos \d+ places$/ })).toBeVisible();
  276 |                 await settle(page);
  277 |                 await checkLayout(page, w.width, w.phone, 'confirmation');
  278 |                 await shot(page, 'confirmation', w.width, theme.key, false);
  279 | 
  280 |                 // 5. Fiche sans plan : choix d'un type et devis
  281 |                 await page.goto(`/events/${data.noPlanEventId}?tables=1`);
  282 |                 await page.locator('label', { hasText: 'Table famille' }).click();
  283 |                 await expect(page.getByRole('button', { name: 'Réserver une table Table famille' })).toBeEnabled();
  284 |                 await settle(page);
  285 |                 await checkLayout(page, w.width, w.phone, 'fiche sans plan, devis');
  286 |                 await shot(page, 'fiche-sans-plan', w.width, theme.key, !w.phone);
  287 |             } finally {
  288 |                 await context.close();
  289 |             }
  290 |         });
  291 | 
  292 |         test(`Ma table et billet de l’invité, ${w.width} px, ${theme.key}`, async ({ browser }, testInfo) => {
  293 |             test.setTimeout(120_000);
  294 |             const data = seeded!;
  295 |             await setTablesService(true, superadmin);
  296 |             const holderCtx = await themedContext(browser, testInfo, theme.scheme);
  297 |             try {
  298 |                 await login(holderCtx, data.holder.email);
  299 |                 const page = await holderCtx.newPage();
  300 |                 await page.setViewportSize({ width: w.width, height: w.height });
  301 |                 await page.goto(`/tickets?tab=tables#table-${data.bookingId}`);
  302 |                 await expect(page.getByRole('heading', { name: /^Table \d+ · Carré VIP$/ })).toBeVisible({ timeout: 20_000 });
  303 |                 await expect(page.getByText('1/6 places envoyées')).toBeVisible();
  304 |                 await expect(page.getByText('Envoyez vos 3 places')).toBeVisible();
  305 |                 await settle(page);
  306 |                 await checkLayout(page, w.width, w.phone, 'Ma table');
  307 |                 await shot(page, 'ma-table', w.width, theme.key);
  308 |             } finally {
  309 |                 await holderCtx.close();
  310 |             }
  311 |             const guestCtx = await themedContext(browser, testInfo, theme.scheme);
  312 |             try {
  313 |                 await login(guestCtx, data.guest.email);
  314 |                 const page = await guestCtx.newPage();
  315 |                 await page.setViewportSize({ width: w.width, height: w.height });
  316 |                 await page.goto('/tickets');
  317 |                 await expect(page.getByText('Invité par Awa S.').first()).toBeVisible({ timeout: 20_000 });
  318 |                 await expect(page.getByText(/Table \d+ · Carré VIP/).first()).toBeVisible();
  319 |                 await settle(page);
  320 |                 await checkLayout(page, w.width, w.phone, 'billet de l’invité');
  321 |                 await shot(page, 'billet-invite', w.width, theme.key);
  322 |             } finally {
  323 |                 await guestCtx.close();
  324 |             }
  325 |         });
  326 |     }
  327 | }
  328 | 
```