# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lot12b.responsive.spec.ts >> commandes du client · clair : carte, panier, heure, sur place, paiement, suivi, code, annulation, Mes commandes (390 et 1 440 px)
- Location: e2e/lot12b.responsive.spec.ts:187:9

# Error details

```
Error: locator.click: Error: strict mode violation: getByTestId('paiement-commande').locator('label').filter({ hasText: 'Wave' }) resolved to 2 elements:
    1) <label class="ev-press relative block cursor-pointer">…</label> aka locator('label').filter({ hasText: /^Wave$/ })
    2) <label for="_r_7_-tel" class="mb-1.5 block text-sm font-semibold text-foreground-strong">Numéro Wave du payeur</label> aka getByText('Numéro Wave du payeur')

Call log:
  - waiting for getByTestId('paiement-commande').locator('label').filter({ hasText: 'Wave' })

```

# Test source

```ts
  174 |         if (data && data.order_id !== orderId) throw new Error(`[l12b] paiement ${paymentId} d’une autre commande (${String(data.order_id)})`);
  175 |         return data?.external_transaction_id ? String(data.external_transaction_id) : null;
  176 |     });
  177 |     const done = await fakeServices('/__test/samirpay/complete', { transactionId: tx });
  178 |     expect(done.json.webhookStatus, `webhook réel : ${JSON.stringify(done.json)}`).toBe(200);
  179 | }
  180 | 
  181 | async function stepReached(page: Page, orderId: string, step: string): Promise<void> {
  182 |     await page.goto(`/orders/${orderId}`, { waitUntil: 'load' });
  183 |     await expect(page.getByTestId('frise-commande').locator(`[data-etape="${step}"]`)).toHaveAttribute('data-franchie', 'oui', { timeout: 30_000 });
  184 | }
  185 | 
  186 | for (const theme of THEMES) {
  187 |     test(`commandes du client · ${theme.key} : carte, panier, heure, sur place, paiement, suivi, code, annulation, Mes commandes (390 et 1 440 px)`, async ({ browser }, testInfo) => {
  188 |         test.setTimeout(900_000);
  189 |         superadmin ||= await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
  190 |         await openOrdersService(WHO, superadmin);
  191 |         try {
  192 |             seeded ??= await seed(superadmin);
  193 |             const data = seeded;
  194 |             const context = await themedContext(browser, testInfo, theme.scheme);
  195 |             try {
  196 |                 await loginOnce(context, data.client.email);
  197 |                 const page = await context.newPage();
  198 |                 context.on('page', (p) => { if (p !== page) void p.close(); }); // page de l'opérateur (faux SamirPay)
  199 |                 for (const w of WIDTHS) {
  200 |                     await page.setViewportSize({ width: w.width, height: w.height });
  201 |                     const scope = w.phone ? page.getByRole('dialog') : page.getByRole('complementary', { name: 'Votre panier' });
  202 | 
  203 |                     // 1. Carte des plats
  204 |                     await page.goto(`/restaurants/${data.venueId}/menu`, { waitUntil: 'load' });
  205 |                     await expect(page.getByRole('heading', { level: 1, name: data.venueName })).toBeVisible({ timeout: 30_000 });
  206 |                     await settle(page);
  207 |                     await checkLayout(page, w.width, w.phone, 'carte des plats');
  208 |                     await shot(page, 'carte', w.width, theme.key);
  209 | 
  210 |                     // 2. Plat du jour (jauge des portions)
  211 |                     const banner = page.getByRole('button', { name: /^Plat du jour : Thiéboudienne du jour, Plus que \d+ portions aujourd’hui$/ });
  212 |                     await banner.scrollIntoViewIfNeeded();
  213 |                     await expect(banner).toBeVisible();
  214 |                     await settle(page);
  215 |                     await shot(page, 'plat-du-jour', w.width, theme.key, false);
  216 | 
  217 |                     // 3. Produit non commandable (réglementé : prix affiché) et dessert épuisé
  218 |                     const beer = page.getByRole('button', { name: 'Gazelle, Non commandable en ligne' });
  219 |                     await beer.scrollIntoViewIfNeeded();
  220 |                     await expect(beer).toBeVisible();
  221 |                     await expect(page.getByRole('button', { name: 'Thiakry, Épuisé' })).toBeVisible();
  222 |                     await settle(page);
  223 |                     await shot(page, 'non-commandable', w.width, theme.key, false);
  224 | 
  225 |                     // 4. Fiche d'un plat : supplément, ajout au panier
  226 |                     await page.getByRole('button', { name: 'Voir Yassa poulet' }).click();
  227 |                     const sheet = page.getByRole('dialog', { name: 'Yassa poulet' });
  228 |                     await expect(sheet).toBeVisible();
  229 |                     await sheet.getByText('Piment', { exact: true }).click();
  230 |                     await settle(page);
  231 |                     await checkLayout(page, w.width, w.phone, 'fiche d’un plat');
  232 |                     await shot(page, 'fiche-plat', w.width, theme.key, false);
  233 |                     await sheet.getByRole('button', { name: 'Ajouter 1 Yassa poulet au panier' }).click();
  234 |                     await expect(sheet).toBeHidden();
  235 | 
  236 |                     // 5. Panier et devis de la base (« À emporter » par défaut : aucune zone à choisir)
  237 |                     if (w.phone) await page.getByRole('button', { name: 'Voir le panier, 1 article' }).click();
  238 |                     await expect(scope.getByRole('region', { name: 'Montant de la commande' }).getByText('Total')).toBeVisible({ timeout: 20_000 });
  239 |                     // Yassa 3 500 + piment 200 = 3 700 ; frais 5 % : 185 ; total 3 885 (devis de la base, lu à l'écran)
  240 |                     await expect(scope.getByRole('region', { name: 'Montant de la commande' })).toContainText(/3\s885/);
  241 |                     await settle(page);
  242 |                     await checkLayout(page, w.width, w.phone, 'panier et devis');
  243 |                     await shot(page, 'panier-devis', w.width, theme.key, !w.phone);
  244 | 
  245 |                     // 6. Finaliser : sur place (table), heure
  246 |                     await scope.getByRole('button', { name: 'Finaliser' }).click();
  247 |                     await scope.getByRole('radio', { name: 'Sur place' }).click();
  248 |                     await scope.getByLabel('Votre table').selectOption({ label: 'Table 7' });
  249 |                     await settle(page);
  250 |                     await checkLayout(page, w.width, w.phone, 'sur place');
  251 |                     await shot(page, 'sur-place', w.width, theme.key, !w.phone);
  252 |                     await scope.getByRole('radio', { name: 'Autre heure' }).click();
  253 |                     await expect(scope.getByLabel('Heure', { exact: true })).toBeVisible();
  254 |                     await settle(page);
  255 |                     await checkLayout(page, w.width, w.phone, 'choix de l’heure');
  256 |                     await shot(page, 'choix-heure', w.width, theme.key, !w.phone);
  257 | 
  258 |                     // 7. À emporter, tout de suite, tout payer : commande puis page de suivi (compte à rebours, paiement)
  259 |                     await scope.getByRole('radio', { name: 'À emporter' }).click();
  260 |                     await scope.getByRole('radio', { name: 'Tout de suite' }).click();
  261 |                     await scope.getByRole('radio', { name: 'Tout payer' }).click();
  262 |                     const order = scope.getByRole('button', { name: 'Commander', exact: true });
  263 |                     await expect(order).toBeEnabled({ timeout: 20_000 });
  264 |                     await order.click();
  265 |                     await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  266 |                     const orderId = page.url().split('/orders/')[1];
  267 |                     await expect(page.getByTestId('compte-a-rebours')).toContainText(/À payer dans \d+:\d{2}/, { timeout: 20_000 });
  268 |                     await expect(page.getByTestId('paiement-commande')).toBeVisible();
  269 |                     await settle(page);
  270 |                     await checkLayout(page, w.width, w.phone, 'paiement et compte à rebours');
  271 |                     await shot(page, 'paiement', w.width, theme.key);
  272 | 
  273 |                     // 8. Paiement Wave : faux SamirPay et vrai webhook
> 274 |                     await page.getByTestId('paiement-commande').locator('label', { hasText: 'Wave' }).click();
      |                                                                                                       ^ Error: locator.click: Error: strict mode violation: getByTestId('paiement-commande').locator('label').filter({ hasText: 'Wave' }) resolved to 2 elements:
  275 |                     const [payRes] = await Promise.all([
  276 |                         page.waitForResponse((r) => r.url().endsWith('/api/payments/create') && r.request().method() === 'POST', { timeout: 30_000 }),
  277 |                         page.getByRole('button', { name: /^Payer .* avec Wave$/ }).click(),
  278 |                     ]);
  279 |                     const payBody = await payRes.json().catch(() => null) as Record<string, unknown> | null;
  280 |                     expect([200, 201], `paiement de la commande : HTTP ${payRes.status()} ${JSON.stringify(payBody)}`).toContain(payRes.status());
  281 |                     await completePayment(orderId, String(payBody?.payment_id ?? ''));
  282 |                     await stepReached(page, orderId, 'RECUE');
  283 |                     await settle(page);
  284 |                     await checkLayout(page, w.width, w.phone, 'suivi : envoyée');
  285 |                     await shot(page, 'suivi-recue', w.width, theme.key);
  286 | 
  287 |                     // 9. Chaque étape, avancée par la partenaire
  288 |                     await partnerStep(data, orderId, 'ACCEPTER');
  289 |                     await stepReached(page, orderId, 'ACCEPTEE');
  290 |                     await expect(page.getByTestId('heure-estimee')).toContainText('Prévue vers');
  291 |                     await settle(page);
  292 |                     await shot(page, 'suivi-acceptee', w.width, theme.key);
  293 |                     await partnerStep(data, orderId, 'PREPARER');
  294 |                     await stepReached(page, orderId, 'EN_PREPARATION');
  295 |                     await settle(page);
  296 |                     await checkLayout(page, w.width, w.phone, 'suivi : en préparation');
  297 |                     await shot(page, 'suivi-preparation', w.width, theme.key);
  298 |                     await partnerStep(data, orderId, 'PRETE');
  299 |                     await stepReached(page, orderId, 'PRETE');
  300 |                     const cases = page.getByTestId('case-code');
  301 |                     await expect(cases).toHaveCount(4, { timeout: 30_000 });
  302 |                     await expect(page.getByTestId('code-remise')).toContainText('Montrez ce code à la remise');
  303 |                     const code = (await cases.allInnerTexts()).map((t) => t.trim()).join('');
  304 |                     expect(code, 'code de quatre chiffres').toMatch(/^\d{4}$/);
  305 |                     await settle(page);
  306 |                     await checkLayout(page, w.width, w.phone, 'code de remise');
  307 |                     await shot(page, 'code', w.width, theme.key);
  308 |                     await partnerStep(data, orderId, 'REMETTRE', { code });
  309 |                     await stepReached(page, orderId, 'REMISE');
  310 |                     await expect(page.getByTestId('code-remise')).toHaveCount(0);
  311 |                     await settle(page);
  312 |                     await checkLayout(page, w.width, w.phone, 'suivi : retirée');
  313 |                     await shot(page, 'suivi-retiree', w.width, theme.key);
  314 | 
  315 |                     // 10. Annulation d'une commande payable à la remise (aucun paiement)
  316 |                     const made = await context.request.post(`${APP_URL}/api/orders/create`, {
  317 |                         headers: { 'Idempotency-Key': `l12b-${randomUUID()}` },
  318 |                         data: { venueId: data.venueId, mode: 'RETRAIT', payment: 'DIFFERE', items: [{ productId: data.products.mafe, quantity: 1 }] },
  319 |                     });
  320 |                     const madeBody = await made.json() as { order?: { id?: string } };
  321 |                     expect(made.status(), `commande à annuler : ${JSON.stringify(madeBody)}`).toBe(201);
  322 |                     const second = String(madeBody.order?.id);
  323 |                     await page.goto(`/orders/${second}`, { waitUntil: 'load' });
  324 |                     await page.getByRole('button', { name: 'Annuler la commande' }).click();
  325 |                     await expect(page.getByRole('alertdialog', { name: 'Annuler la commande ?' })).toBeVisible();
  326 |                     await settle(page);
  327 |                     await checkLayout(page, w.width, w.phone, 'annulation');
  328 |                     await shot(page, 'annulation', w.width, theme.key, false);
  329 |                     await page.getByRole('button', { name: 'Oui, annuler' }).click();
  330 |                     await expect(page.getByRole('button', { name: 'Annuler la commande' })).toHaveCount(0, { timeout: 20_000 });
  331 |                     await settle(page);
  332 |                     await checkLayout(page, w.width, w.phone, 'commande annulée');
  333 |                     await shot(page, 'annulee', w.width, theme.key);
  334 | 
  335 |                     // 11. Mes commandes
  336 |                     await page.goto('/orders', { waitUntil: 'load' });
  337 |                     await expect(page.locator(`[data-commande="${orderId}"]`).first()).toBeVisible({ timeout: 30_000 });
  338 |                     await expect(page.getByRole('link', { name: /Commander à nouveau/ }).or(page.getByRole('button', { name: /Commander à nouveau/ })).first()).toBeVisible();
  339 |                     await settle(page);
  340 |                     await checkLayout(page, w.width, w.phone, 'Mes commandes');
  341 |                     await shot(page, 'mes-commandes', w.width, theme.key);
  342 |                 }
  343 |             } finally {
  344 |                 await context.close();
  345 |             }
  346 |         } finally {
  347 |             await releaseOrdersService(WHO, superadmin);
  348 |         }
  349 |     });
  350 | }
  351 | 
```