# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lot11cc.responsive.spec.ts >> tables d’un événement · clair : organisatrice, porte, scanner, administration (390 et 1440 px)
- Location: e2e/lot11cc.responsive.spec.ts:206:9

# Error details

```
Error: [l11cc] entrée de la place TCK-20261125-01F8CAE31E : {"result":"invalid","scan_id":"076fa076-635c-4c90-b820-854a0aebf46a"}
```

# Test source

```ts
  83  |     }
  84  | }
  85  | 
  86  | /** Achat d'une table par la vraie route ; `complete` : paiement confirmé par le faux SamirPay et le vrai webhook. */
  87  | async function buyTable(eventId: string, buyer: ControllerAccount, typeId: string, tableId: string, complete: boolean): Promise<string | null> {
  88  |     const api = await pwRequest.newContext({ baseURL: APP_URL });
  89  |     try {
  90  |         const log = await api.post('/api/auth/login', { data: { identifier: buyer.email, password: TEST_PASSWORD } });
  91  |         expect(log.status(), `connexion de l’acheteuse : ${await log.text()}`).toBe(200);
  92  |         const res = await api.post(`/api/events/${eventId}/tables/checkout`, {
  93  |             headers: { 'Idempotency-Key': `l11cc-${randomUUID()}` },
  94  |             data: { typeId, tableId, operator: 'WAVE', payerPhone: buyer.local },
  95  |         });
  96  |         const body = await res.json() as Record<string, unknown>;
  97  |         expect(res.status(), `achat de la table : ${JSON.stringify(body)}`).toBe(200);
  98  |         const paymentId = String(body.payment_id ?? '');
  99  |         if (!complete) return null;
  100 |         const { data: pay, error } = await serviceClient().from('payments').select('external_transaction_id').eq('id', paymentId).single();
  101 |         if (error || !pay?.external_transaction_id) throw new Error(`[l11cc] transaction du paiement ${paymentId} : ${error?.message ?? 'absente'}`);
  102 |         const done = await fakeServices('/__test/samirpay/complete', { transactionId: pay.external_transaction_id });
  103 |         expect(done.json.webhookStatus, `webhook réel : ${JSON.stringify(done.json)}`).toBe(200);
  104 |         return waitFor('vente de la table', async () => {
  105 |             const { data } = await serviceClient().from('event_table_bookings').select('id').eq('payment_id', paymentId).maybeSingle();
  106 |             return data ? String(data.id) : null;
  107 |         });
  108 |     } finally {
  109 |         await api.dispose();
  110 |     }
  111 | }
  112 | 
  113 | async function setTablesService(open: boolean, actor: string): Promise<void> {
  114 |     const { data, error } = await serviceClient().rpc('event_tables_setting_set', { p_key: 'features.event_tables_enabled', p_value: { value: open }, p_actor: actor, p_reason: 'Captures du lot 11c-c' });
  115 |     if (error || (data as { ok?: boolean } | null)?.ok !== true) throw new Error(`[l11cc] interrupteur des tables : ${error?.message ?? JSON.stringify(data)}`);
  116 | }
  117 | 
  118 | async function seed(superadmin: string): Promise<Seeded> {
  119 |     const owner = readDemoIds().accounts.organisateur3;
  120 |     const service = serviceClient();
  121 |     const start = new Date(Date.now() + 60 * 60_000);
  122 |     const end = new Date(start.getTime() + 4 * 3600_000);
  123 |     const s = dakar(start);
  124 |     const e = dakar(end);
  125 |     const title = `Nuit des tables ${STAMP}`;
  126 |     const eventId = await createPublishedEvent({
  127 |         partnerUserId: owner.userId, superadminId: superadmin, title,
  128 |         description: 'Captures du lot 11c-c (tables d’un événement). Données fictives.',
  129 |         startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time,
  130 |         location: 'Terrasse de la Corniche', city: 'Dakar', capacity: 200,
  131 |         imageUrl: await partnerPosterOf(owner.userId),
  132 |         categories: [{ name: 'Entrée', price: 5_000, total: 80 }],
  133 |     });
  134 |     const vip = await rpcOk('event_table_type_save', {
  135 |         event_id: eventId, actor_id: owner.userId, count: 4,
  136 |         type: { name: 'Carré VIP', seats: 6, price: 150_000, included_text: 'Une bouteille et un plateau de fruits', onsite_note: '50 000 F de consommations sur place', payment_mode: 'FULL' },
  137 |     });
  138 |     const ronde = await rpcOk('event_table_type_save', {
  139 |         event_id: eventId, actor_id: owner.userId, count: 6,
  140 |         type: { name: 'Table ronde', seats: 8, price: 120_000, included_text: 'Softs à volonté', payment_mode: 'FULL' },
  141 |     });
  142 |     const vipId = String((vip.type as Record<string, unknown>).id);
  143 |     const rondeId = String((ronde.type as Record<string, unknown>).id);
  144 |     const { data: rows, error } = await service.from('event_tables').select('id, number, category_id').eq('event_id', eventId).order('number');
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
  177 |     for (const seat of seats.slice(0, 2)) {
  178 |         const number = String(seat.ticket_number);
  179 |         const { data, error: scanErr } = await service.rpc('ticket_scan', { p: {
  180 |             scanner_id: controller.userId, event_id: eventId, method: 'MANUAL', ticket_number: number, identity_verified: true,
  181 |             payload_hash: createHash('sha256').update(number.toUpperCase()).digest('hex'), client_key: `l11cc-${randomUUID()}`,
  182 |         } });
> 183 |         if (scanErr || (data as { result?: string } | null)?.result !== 'valid') throw new Error(`[l11cc] entrée de la place ${number} : ${scanErr?.message ?? JSON.stringify(data)}`);
      |                                                                                        ^ Error: [l11cc] entrée de la place TCK-20261125-01F8CAE31E : {"result":"invalid","scan_id":"076fa076-635c-4c90-b820-854a0aebf46a"}
  184 |     }
  185 |     return { eventId, title, controller, seatNumber: String(seats[3].ticket_number) };
  186 | }
  187 | 
  188 | let seeded: Seeded | null = null;
  189 | let superadmin = '';
  190 | let previous: boolean | null = null;
  191 | 
  192 | test.beforeAll(async () => {
  193 |     test.setTimeout(240_000);
  194 |     superadmin = await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
  195 |     const { data } = await serviceClient().from('platform_settings').select('value').eq('key', 'features.event_tables_enabled').maybeSingle();
  196 |     previous = (data?.value as { value?: boolean } | null)?.value === true;
  197 |     await setTablesService(true, superadmin);
  198 |     seeded = await seed(superadmin);
  199 | });
  200 | 
  201 | test.afterAll(async () => {
  202 |     if (superadmin) await setTablesService(previous === true, superadmin);
  203 | });
  204 | 
  205 | for (const theme of THEMES) {
  206 |     test(`tables d’un événement · ${theme.key} : organisatrice, porte, scanner, administration (390 et 1440 px)`, async ({ browser }, testInfo) => {
  207 |         test.setTimeout(600_000);
  208 |         const data = seeded!;
  209 |         const owner = readDemoIds().accounts.organisateur3;
  210 | 
  211 |         // ── Organisatrice : éditeur, plan, jauge, vue client, type figé, pilotage, porte ───────────────────────────
  212 |         const org = await themedContext(browser, testInfo, theme.scheme);
  213 |         await login(org, owner.email);
  214 |         const page = await org.newPage();
  215 |         for (const w of WIDTHS) {
  216 |             await page.setViewportSize({ width: w.width, height: w.height });
  217 |             await page.goto(`/partner/events/${data.eventId}/edit`, { waitUntil: 'load' });
  218 |             await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
  219 |             await page.getByRole('button', { name: /^Billets$/ }).click();
  220 |             await page.getByRole('tab', { name: 'Tables' }).click();
  221 |             const editor = page.locator('[data-tables-editeur]');
  222 |             await expect(editor).toBeVisible({ timeout: 30_000 });
  223 |             // 80 billets + 4 tables de 6 + 6 tables de 8 = 152 places sur 200 (réponse du serveur)
  224 |             await expect(editor.getByText('152 places sur 200 : 80 en billets, 72 en tables')).toBeVisible();
  225 |             await expect(editor.getByText('Prix et places figés : une table est vendue ou en cours de paiement.').first()).toBeVisible();
  226 |             await settle(page);
  227 |             await checkLayout(page, w.width, w.phone, 'éditeur des tables');
  228 |             await shot(page, 'editeur', w.width, theme.key);
  229 |             await editor.locator('[data-jauge-places]').screenshot({ path: path.join(SHOTS, `l11cc-jauge__${w.width}__${theme.key}.jpg`), type: 'jpeg', quality: 85 });
  230 |             // Plan en édition : une table choisie (panneau de réglage)
  231 |             const table1 = page.getByRole('button', { name: /^Table 1, 6 places/ });
  232 |             if (await table1.count() > 0) await table1.first().click();
  233 |             await settle(page);
  234 |             await shot(page, 'plan-edition', w.width, theme.key);
  235 |             await page.getByRole('button', { name: w.phone ? 'Téléphone' : 'Ordinateur' }).click();
  236 |             await expect(page.locator(`[data-vue-client="${w.phone ? 'telephone' : 'ordinateur'}"]`)).toBeVisible();
  237 |             await settle(page);
  238 |             await shot(page, 'vue-client', w.width, theme.key);
  239 |             // Type figé : prix et places verrouillés, avec la raison
  240 |             await editor.locator('[data-type-table="Carré VIP"]').getByRole('button', { name: 'Modifier' }).click();
  241 |             const dialog = page.getByRole('dialog', { name: 'Modifier le type de table' });
  242 |             await expect(dialog).toBeVisible();
  243 |             await expect(dialog.getByLabel('Prix de la table (F CFA)')).toBeDisabled();
  244 |             await expect(dialog.getByText(/^Soit 25\s000 F.* par personne\.$/)).toBeVisible();
  245 |             await settle(page);
  246 |             await shot(page, 'type-fige', w.width, theme.key, false);
  247 |             await page.keyboard.press('Escape');
  248 | 
  249 |             await page.goto(`/partner/events/${data.eventId}?tab=tables`, { waitUntil: 'load' });
  250 |             const pil = page.locator('[data-tables-pilotage]');
  251 |             await expect(pil).toBeVisible({ timeout: 30_000 });
  252 |             await expect(pil.getByText('Awa S.').first()).toBeVisible();
  253 |             await settle(page);
  254 |             await checkLayout(page, w.width, w.phone, 'pilotage des tables');
  255 |             await shot(page, 'pilotage', w.width, theme.key);
  256 | 
  257 |             await page.goto(`/partner/events/${data.eventId}/porte`, { waitUntil: 'load' });
  258 |             const door = page.locator('[data-porte]');
  259 |             await expect(door).toBeVisible({ timeout: 30_000 });
  260 |             await expect(door.getByText('2/6').first()).toBeVisible();
  261 |             await settle(page);
  262 |             await checkLayout(page, w.width, w.phone, 'liste de la porte');
  263 |             await shot(page, 'porte', w.width, theme.key);
  264 |             await door.locator('[data-porte-table] button').first().click();
  265 |             await expect(door.getByText('Awa S.').first()).toBeVisible();
  266 |             await settle(page);
  267 |             await shot(page, 'porte-table-ouverte', w.width, theme.key);
  268 |             await page.getByRole('button', { name: 'Plein écran' }).click();
  269 |             await expect(door).toHaveAttribute('data-porte-contraste', 'fort');
  270 |             await settle(page);
  271 |             await shot(page, 'porte-plein-ecran', w.width, theme.key, false);
  272 |             await page.getByRole('button', { name: 'Quitter le plein écran' }).click();
  273 |             await page.emulateMedia({ media: 'print' });
  274 |             await settle(page);
  275 |             await shot(page, 'porte-impression', w.width, theme.key);
  276 |             await page.emulateMedia({ media: 'screen' });
  277 |         }
  278 |         await org.close();
  279 | 
  280 |         // ── Contrôleur : porte, badge du scanner (réponse du scan imposée, caméra simulée) ───────────────────────────
  281 |         const ctl = await themedContext(browser, testInfo, theme.scheme);
  282 |         await login(ctl, data.controller.email);
  283 |         await ctl.addInitScript(installFakeCamera, { mode: 'barcode-detector' as const });
```