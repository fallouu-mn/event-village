# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lot12b.responsive.spec.ts >> commandes du client · clair : carte, panier, heure, sur place, paiement, suivi, code, annulation, Mes commandes (390 et 1 440 px)
- Location: e2e/lot12b.responsive.spec.ts:186:9

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('dialog').getByRole('region', { name: 'Montant de la commande' })
Expected pattern: /3\s885/
Received string:  "Encore un choixChoisissez une zone de livraison de cet établissement."
Timeout: 15000ms

Call log:
  - Expect "toContainText" getByRole('dialog').getByRole('region', { name: 'Montant de la commande' }) with timeout 15000ms
  - waiting for getByRole('dialog').getByRole('region', { name: 'Montant de la commande' })
    4 × locator resolved to <section aria-label="Montant de la commande" class="space-y-3 rounded-2xl border border-border bg-card p-4">…</section>
      - unexpected value " Calcul du total…"
    30 × locator resolved to <section aria-label="Montant de la commande" class="space-y-3 rounded-2xl border border-border bg-card p-4">…</section>
       - unexpected value "Encore un choixChoisissez une zone de livraison de cet établissement."

```

```yaml
- region "Montant de la commande":
  - status:
    - paragraph: Encore un choix
    - text: Choisissez une zone de livraison de cet établissement.
```

# Test source

```ts
  139 |         const { data, error } = await service.from('product_categories').insert({ partner_id: partnerId, name, sort_order: i + 1 }).select('id').single();
  140 |         if (error || !data) throw new Error(`[l12b] catégorie ${name} : ${error?.message}`);
  141 |         categories[name] = String(data.id);
  142 |     }
  143 |     const daily = await insertProduct(partnerId, venueId, {
  144 |         name: 'Thiéboudienne du jour', price: 4_500, is_daily_special: true, category_id: categories.Plats, images: [photo],
  145 |         description: 'Riz au poisson, légumes du marché, sauce tomate.',
  146 |     });
  147 |     await rpcOk('order_daily_portions_set', { actor_id: owner.userId, product_id: daily, portions: 20 });
  148 |     const yassa = await insertProduct(partnerId, venueId, { name: 'Yassa poulet', price: 3_500, category_id: categories.Plats, images: [photo], description: 'Oignons confits, citron vert.' });
  149 |     for (const [name, price] of [['Piment', 200], ['Frites', 500]] as const) {
  150 |         const { error } = await service.from('product_options').insert({ product_id: yassa, name, price_delta: price });
  151 |         if (error) throw new Error(`[l12b] supplément ${name} : ${error.message}`);
  152 |     }
  153 |     const mafe = await insertProduct(partnerId, venueId, { name: 'Mafé', price: 3_000, category_id: categories.Plats });
  154 |     await insertProduct(partnerId, venueId, { name: 'Bissap', price: 1_000, category_id: categories.Boissons });
  155 |     const beer = await insertProduct(partnerId, venueId, { name: 'Gazelle', price: 1_200, category_id: categories.Boissons, is_regulated: true, regulated_kind: 'ALCOOL' });
  156 |     const dessert = await insertProduct(partnerId, venueId, { name: 'Thiakry', price: 1_500, category_id: categories.Desserts, is_stock_managed: true, stock_quantity: 0 });
  157 |     const client = await createClientAccount(`l12b-${STAMP}`);
  158 |     return { venueId, venueName, ownerId: owner.userId, products: { daily, yassa, mafe, beer, dessert }, client };
  159 | }
  160 | 
  161 | let seeded: Seeded | null = null;
  162 | let superadmin = '';
  163 | 
  164 | test.beforeEach(async ({ servicesLock }) => { await servicesLock.enter('services'); });
  165 | 
  166 | async function partnerStep(data: Seeded, orderId: string, action: string, extra: Record<string, unknown> = {}): Promise<void> {
  167 |     await rpcOk('order_partner_action', { actor_id: data.ownerId, order_id: orderId, action, ...extra });
  168 | }
  169 | 
  170 | async function completePayment(orderId: string): Promise<void> {
  171 |     const tx = await waitFor('transaction du paiement de la commande', async () => {
  172 |         const { data } = await serviceClient().from('payments').select('external_transaction_id').eq('order_id', orderId)
  173 |             .order('created_at', { ascending: false }).limit(1).maybeSingle();
  174 |         return data?.external_transaction_id ? String(data.external_transaction_id) : null;
  175 |     });
  176 |     const done = await fakeServices('/__test/samirpay/complete', { transactionId: tx });
  177 |     expect(done.json.webhookStatus, `webhook réel : ${JSON.stringify(done.json)}`).toBe(200);
  178 | }
  179 | 
  180 | async function stepReached(page: Page, orderId: string, step: string): Promise<void> {
  181 |     await page.goto(`/orders/${orderId}`, { waitUntil: 'load' });
  182 |     await expect(page.getByTestId('frise-commande').locator(`[data-etape="${step}"]`)).toHaveAttribute('data-franchie', 'oui', { timeout: 30_000 });
  183 | }
  184 | 
  185 | for (const theme of THEMES) {
  186 |     test(`commandes du client · ${theme.key} : carte, panier, heure, sur place, paiement, suivi, code, annulation, Mes commandes (390 et 1 440 px)`, async ({ browser }, testInfo) => {
  187 |         test.setTimeout(900_000);
  188 |         superadmin ||= await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
  189 |         await openOrdersService(WHO, superadmin);
  190 |         try {
  191 |             seeded ??= await seed(superadmin);
  192 |             const data = seeded;
  193 |             const context = await themedContext(browser, testInfo, theme.scheme);
  194 |             try {
  195 |                 await loginOnce(context, data.client.email);
  196 |                 const page = await context.newPage();
  197 |                 context.on('page', (p) => { if (p !== page) void p.close(); }); // page de l'opérateur (faux SamirPay)
  198 |                 for (const w of WIDTHS) {
  199 |                     await page.setViewportSize({ width: w.width, height: w.height });
  200 |                     const scope = w.phone ? page.getByRole('dialog') : page.getByRole('complementary', { name: 'Votre panier' });
  201 | 
  202 |                     // 1. Carte des plats
  203 |                     await page.goto(`/restaurants/${data.venueId}/menu`, { waitUntil: 'load' });
  204 |                     await expect(page.getByRole('heading', { level: 1, name: data.venueName })).toBeVisible({ timeout: 30_000 });
  205 |                     await settle(page);
  206 |                     await checkLayout(page, w.width, w.phone, 'carte des plats');
  207 |                     await shot(page, 'carte', w.width, theme.key);
  208 | 
  209 |                     // 2. Plat du jour (jauge des portions)
  210 |                     const banner = page.getByRole('button', { name: /^Plat du jour : Thiéboudienne du jour, Plus que \d+ portions aujourd’hui$/ });
  211 |                     await banner.scrollIntoViewIfNeeded();
  212 |                     await expect(banner).toBeVisible();
  213 |                     await settle(page);
  214 |                     await shot(page, 'plat-du-jour', w.width, theme.key, false);
  215 | 
  216 |                     // 3. Produit non commandable (réglementé : prix affiché) et dessert épuisé
  217 |                     const beer = page.getByRole('button', { name: 'Gazelle, Non commandable en ligne' });
  218 |                     await beer.scrollIntoViewIfNeeded();
  219 |                     await expect(beer).toBeVisible();
  220 |                     await expect(page.getByRole('button', { name: 'Thiakry, Épuisé' })).toBeVisible();
  221 |                     await settle(page);
  222 |                     await shot(page, 'non-commandable', w.width, theme.key, false);
  223 | 
  224 |                     // 4. Fiche d'un plat : supplément, ajout au panier
  225 |                     await page.getByRole('button', { name: 'Voir Yassa poulet' }).click();
  226 |                     const sheet = page.getByRole('dialog', { name: 'Yassa poulet' });
  227 |                     await expect(sheet).toBeVisible();
  228 |                     await sheet.getByText('Piment', { exact: true }).click();
  229 |                     await settle(page);
  230 |                     await checkLayout(page, w.width, w.phone, 'fiche d’un plat');
  231 |                     await shot(page, 'fiche-plat', w.width, theme.key, false);
  232 |                     await sheet.getByRole('button', { name: 'Ajouter 1 Yassa poulet au panier' }).click();
  233 |                     await expect(sheet).toBeHidden();
  234 | 
  235 |                     // 5. Panier et devis de la base
  236 |                     if (w.phone) await page.getByRole('button', { name: 'Voir le panier, 1 article' }).click();
  237 |                     await expect(scope.getByRole('region', { name: 'Montant de la commande' }).getByText('Total')).toBeVisible({ timeout: 20_000 });
  238 |                     // Yassa 3 500 + piment 200 = 3 700 ; frais 5 % : 185 ; total 3 885 (devis de la base, lu à l'écran)
> 239 |                     await expect(scope.getByRole('region', { name: 'Montant de la commande' })).toContainText(/3\s885/);
      |                                                                                                 ^ Error: expect(locator).toContainText(expected) failed
  240 |                     await settle(page);
  241 |                     await checkLayout(page, w.width, w.phone, 'panier et devis');
  242 |                     await shot(page, 'panier-devis', w.width, theme.key, !w.phone);
  243 | 
  244 |                     // 6. Finaliser : sur place (table), heure
  245 |                     await scope.getByRole('button', { name: 'Finaliser' }).click();
  246 |                     await scope.getByRole('radio', { name: 'Sur place' }).click();
  247 |                     await scope.getByLabel('Votre table').selectOption({ label: 'Table 7' });
  248 |                     await settle(page);
  249 |                     await checkLayout(page, w.width, w.phone, 'sur place');
  250 |                     await shot(page, 'sur-place', w.width, theme.key, !w.phone);
  251 |                     await scope.getByRole('radio', { name: 'Autre heure' }).click();
  252 |                     await expect(scope.getByLabel('Heure')).toBeVisible();
  253 |                     await settle(page);
  254 |                     await checkLayout(page, w.width, w.phone, 'choix de l’heure');
  255 |                     await shot(page, 'choix-heure', w.width, theme.key, !w.phone);
  256 | 
  257 |                     // 7. À emporter, tout de suite, tout payer : commande puis page de suivi (compte à rebours, paiement)
  258 |                     await scope.getByRole('radio', { name: 'À emporter' }).click();
  259 |                     await scope.getByRole('radio', { name: 'Tout de suite' }).click();
  260 |                     await scope.getByRole('radio', { name: 'Tout payer' }).click();
  261 |                     const order = scope.getByRole('button', { name: 'Commander', exact: true });
  262 |                     await expect(order).toBeEnabled({ timeout: 20_000 });
  263 |                     await order.click();
  264 |                     await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  265 |                     const orderId = page.url().split('/orders/')[1];
  266 |                     await expect(page.getByTestId('compte-a-rebours')).toContainText(/À payer dans \d+:\d{2}/, { timeout: 20_000 });
  267 |                     await expect(page.getByTestId('paiement-commande')).toBeVisible();
  268 |                     await settle(page);
  269 |                     await checkLayout(page, w.width, w.phone, 'paiement et compte à rebours');
  270 |                     await shot(page, 'paiement', w.width, theme.key);
  271 | 
  272 |                     // 8. Paiement Wave : faux SamirPay et vrai webhook
  273 |                     await page.getByTestId('paiement-commande').locator('label', { hasText: 'Wave' }).click();
  274 |                     await page.getByRole('button', { name: /^Payer .* avec Wave$/ }).click();
  275 |                     await completePayment(orderId);
  276 |                     await stepReached(page, orderId, 'RECUE');
  277 |                     await settle(page);
  278 |                     await checkLayout(page, w.width, w.phone, 'suivi : envoyée');
  279 |                     await shot(page, 'suivi-recue', w.width, theme.key);
  280 | 
  281 |                     // 9. Chaque étape, avancée par la partenaire
  282 |                     await partnerStep(data, orderId, 'ACCEPTER');
  283 |                     await stepReached(page, orderId, 'ACCEPTEE');
  284 |                     await expect(page.getByTestId('heure-estimee')).toContainText('Prévue vers');
  285 |                     await settle(page);
  286 |                     await shot(page, 'suivi-acceptee', w.width, theme.key);
  287 |                     await partnerStep(data, orderId, 'PREPARER');
  288 |                     await stepReached(page, orderId, 'EN_PREPARATION');
  289 |                     await settle(page);
  290 |                     await checkLayout(page, w.width, w.phone, 'suivi : en préparation');
  291 |                     await shot(page, 'suivi-preparation', w.width, theme.key);
  292 |                     await partnerStep(data, orderId, 'PRETE');
  293 |                     await stepReached(page, orderId, 'PRETE');
  294 |                     const cases = page.getByTestId('case-code');
  295 |                     await expect(cases).toHaveCount(4, { timeout: 30_000 });
  296 |                     await expect(page.getByTestId('code-remise')).toContainText('Montrez ce code à la remise');
  297 |                     const code = (await cases.allInnerTexts()).map((t) => t.trim()).join('');
  298 |                     expect(code, 'code de quatre chiffres').toMatch(/^\d{4}$/);
  299 |                     await settle(page);
  300 |                     await checkLayout(page, w.width, w.phone, 'code de remise');
  301 |                     await shot(page, 'code', w.width, theme.key);
  302 |                     await partnerStep(data, orderId, 'REMETTRE', { code });
  303 |                     await stepReached(page, orderId, 'REMISE');
  304 |                     await expect(page.getByTestId('code-remise')).toHaveCount(0);
  305 |                     await settle(page);
  306 |                     await checkLayout(page, w.width, w.phone, 'suivi : retirée');
  307 |                     await shot(page, 'suivi-retiree', w.width, theme.key);
  308 | 
  309 |                     // 10. Annulation d'une commande payable à la remise (aucun paiement)
  310 |                     const made = await context.request.post(`${APP_URL}/api/orders/create`, {
  311 |                         headers: { 'Idempotency-Key': `l12b-${randomUUID()}` },
  312 |                         data: { venueId: data.venueId, mode: 'RETRAIT', payment: 'DIFFERE', items: [{ productId: data.products.mafe, quantity: 1 }] },
  313 |                     });
  314 |                     const madeBody = await made.json() as { order?: { id?: string } };
  315 |                     expect(made.status(), `commande à annuler : ${JSON.stringify(madeBody)}`).toBe(201);
  316 |                     const second = String(madeBody.order?.id);
  317 |                     await page.goto(`/orders/${second}`, { waitUntil: 'load' });
  318 |                     await page.getByRole('button', { name: 'Annuler la commande' }).click();
  319 |                     await expect(page.getByRole('dialog', { name: 'Annuler la commande ?' })).toBeVisible();
  320 |                     await settle(page);
  321 |                     await checkLayout(page, w.width, w.phone, 'annulation');
  322 |                     await shot(page, 'annulation', w.width, theme.key, false);
  323 |                     await page.getByRole('button', { name: 'Oui, annuler' }).click();
  324 |                     await expect(page.getByRole('button', { name: 'Annuler la commande' })).toHaveCount(0, { timeout: 20_000 });
  325 |                     await settle(page);
  326 |                     await checkLayout(page, w.width, w.phone, 'commande annulée');
  327 |                     await shot(page, 'annulee', w.width, theme.key);
  328 | 
  329 |                     // 11. Mes commandes
  330 |                     await page.goto('/orders', { waitUntil: 'load' });
  331 |                     await expect(page.locator(`[data-commande="${orderId}"]`).first()).toBeVisible({ timeout: 30_000 });
  332 |                     await expect(page.getByRole('link', { name: /Commander à nouveau/ }).or(page.getByRole('button', { name: /Commander à nouveau/ })).first()).toBeVisible();
  333 |                     await settle(page);
  334 |                     await checkLayout(page, w.width, w.phone, 'Mes commandes');
  335 |                     await shot(page, 'mes-commandes', w.width, theme.key);
  336 |                 }
  337 |             } finally {
  338 |                 await context.close();
  339 |             }
```