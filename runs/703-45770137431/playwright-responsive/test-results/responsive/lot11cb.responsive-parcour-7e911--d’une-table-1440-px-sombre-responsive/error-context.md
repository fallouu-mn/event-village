# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lot11cb.responsive.spec.ts >> parcours d’achat d’une table, 1440 px, sombre
- Location: e2e/lot11cb.responsive.spec.ts:222:13

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/^(Plus que \d+ tables|Plus qu’une table)$/).first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText(/^(Plus que \d+ tables|Plus qu’une table)$/).first() with timeout 15000ms
  - waiting for getByText(/^(Plus que \d+ tables|Plus qu’une table)$/).first()

```

```yaml
- banner:
  - link "Event Village, accueil":
    - /url: /
    - text: Event Village
  - navigation "Rubriques":
    - link "Accueil":
      - /url: /
    - link "Explorer":
      - /url: /explore
    - link "Mes billets":
      - /url: /tickets
    - link "Portefeuille":
      - /url: /wallet
  - link "Rechercher un événement…":
    - /url: /explore
  - button "Notifications"
  - button "Awa Sarr"
- main:
  - region "Soirée des tables 9362aa":
    - link "Retour aux événements":
      - /url: /explore
    - 'button "Mettre en favori : Soirée des tables 9362aa"'
    - button "Partager l’événement"
    - img "Affiche de l’événement Soirée des tables 9362aa"
    - text: Concerts & Musique
    - heading "Soirée des tables 9362aa" [level=1]
    - paragraph: Organisé par Saloum Culture
    - list "Date et lieu":
      - listitem: Vendredi 27 novembre 2026 à 08:48 Jusqu’à 13:48
      - listitem: Terrasse des Almadies Dakar
    - paragraph: Commence dans 1 jour et 1 heure
  - article:
    - list "Infos de l’événement":
      - listitem:
        - paragraph: Billet dans l’application
        - paragraph: Présentez son QR code à l’entrée, depuis Mes billets.
    - region "À propos":
      - heading "À propos" [level=2]
      - paragraph: Captures du lot 11c-b (tables d’un événement, écrans du client). Données fictives.
    - region "Lieu et accès":
      - heading "Lieu et accès" [level=2]
      - paragraph: Terrasse des Almadies
      - paragraph: Dakar
      - img "Soirée des tables 9362aa, Terrasse des Almadies": Soirée des tables 9362aa
      - button "Afficher la carte"
      - link "Voir l’itinéraire":
        - /url: https://www.google.com/maps/dir/?api=1&destination=14.6928,-17.4467
      - paragraph: Paiement
      - text: Wave ou Orange Money, en ligne. Les frais de service s’affichent avant le paiement.
    - region "Organisateur":
      - paragraph: Organisateur
      - paragraph: Saloum Culture
  - complementary "Billetterie":
    - tablist "Billets ou tables":
      - tab "Billets"
      - tab "Tables dès 120 000 F CFA" [selected]
    - tabpanel "Tables dès 120 000 F CFA":
      - heading "Tables" [level=2]
      - paragraph: Choisissez votre table sur le plan. Prix pour toute la table.
      - status: En direct
      - list "Types de tables":
        - listitem:
          - heading "Carré VIP" [level=3]
          - text: 6 places
          - paragraph: 150 000 F CFA
          - text: la table
          - paragraph: soit 25 000 F CFA par personne
          - paragraph: "Compris : Une bouteille et un plateau de fruits"
          - paragraph: "Sur place : 50 000 F de consommations sur place"
          - paragraph: Complet
        - listitem:
          - heading "Table ronde" [level=3]
          - text: 8 places
          - paragraph: 120 000 F CFA
          - text: la table
          - paragraph: soit 15 000 F CFA par personne
          - paragraph: "Compris : Softs à volonté"
          - paragraph: 5 tables disponibles
      - button "Voir le plan et choisir ma table"
      - paragraph: "Un billet par invité : vous envoyez les places après le paiement."
- alert
```

# Test source

```ts
  142 |     const planEventId = await createPublishedEvent({
  143 |         partnerUserId: owner.userId, superadminId: superadmin, title: `Soirée des tables ${STAMP}`,
  144 |         description: 'Captures du lot 11c-b (tables d’un événement, écrans du client). Données fictives.',
  145 |         startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time,
  146 |         location: 'Terrasse des Almadies', city: 'Dakar', capacity: 200, imageUrl: poster,
  147 |         categories: [{ name: 'Entrée', price: 5_000, total: 60 }],
  148 |     });
  149 |     const vip = await rpcOk('event_table_type_save', {
  150 |         event_id: planEventId, actor_id: owner.userId, count: 4,
  151 |         type: { name: 'Carré VIP', seats: 6, price: 150_000, included_text: 'Une bouteille et un plateau de fruits', onsite_note: '50 000 F de consommations sur place', payment_mode: 'FULL' },
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
> 242 |                 await expect(page.getByText(/^(Plus que \d+ tables|Plus qu’une table)$/).first()).toBeVisible();
      |                                                                                                   ^ Error: expect(locator).toBeVisible() failed
  243 |                 await settle(page);
  244 |                 await checkLayout(page, w.width, w.phone, 'fiche avec plan');
  245 |                 await shot(page, 'fiche-plan', w.width, theme.key);
  246 | 
  247 |                 // 2. Plan et feuille de devis
  248 |                 await openPlan.click();
  249 |                 // Titre de la fenêtre : « Choisissez votre table », puis « Table réservée » à la confirmation
  250 |                 const dialog = page.getByRole('dialog');
  251 |                 await expect(page.getByRole('dialog', { name: 'Choisissez votre table' })).toBeVisible();
  252 |                 await expect(dialog.getByRole('button', { name: /Table \d+, 6 places, prise/ }).first()).toBeVisible();
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