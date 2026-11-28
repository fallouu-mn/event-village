# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lot12b.responsive.spec.ts >> commandes du client · clair : carte, panier, heure, sur place, prix changé, paiement, suivi, code et mode comptoir, annulation, solde, Mes commandes, fermeture (390 et 1 440 px)
- Location: e2e/lot12b.responsive.spec.ts:194:9

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByTestId('heure-estimee')
Expected substring: "Prévue vers"
Received string:    "Prévue le sam. 28 nov. 2026 vers 00 h 06"
Timeout: 15000ms

Call log:
  - Expect "toContainText" getByTestId('heure-estimee') with timeout 15000ms
  - waiting for getByTestId('heure-estimee')
    34 × locator resolved to <p data-testid="heure-estimee" class="text-2xl font-extrabold tabular-nums text-primary-text sm:text-3xl">Prévue le sam. 28 nov. 2026 vers 00 h 06</p>
       - unexpected value "Prévue le sam. 28 nov. 2026 vers 00 h 06"

```

```yaml
- paragraph: Prévue le sam. 28 nov. 2026 vers 00 h 06
```

# Test source

```ts
  223 |                     // 3. Produit non commandable (réglementé : prix affiché) et dessert épuisé
  224 |                     const beer = page.getByRole('button', { name: 'Gazelle, Non commandable en ligne' });
  225 |                     await beer.scrollIntoViewIfNeeded();
  226 |                     await expect(beer).toBeVisible();
  227 |                     await expect(page.getByRole('button', { name: 'Thiakry, Épuisé' })).toBeVisible();
  228 |                     await settle(page);
  229 |                     await shot(page, 'non-commandable', w.width, theme.key, false);
  230 | 
  231 |                     // 4. Fiche d'un plat : supplément, ajout au panier
  232 |                     await page.getByRole('button', { name: 'Voir Yassa poulet' }).click();
  233 |                     const sheet = page.getByRole('dialog', { name: 'Yassa poulet' });
  234 |                     await expect(sheet).toBeVisible();
  235 |                     await sheet.getByText('Piment', { exact: true }).click();
  236 |                     await settle(page);
  237 |                     await checkLayout(page, w.width, w.phone, 'fiche d’un plat');
  238 |                     await shot(page, 'fiche-plat', w.width, theme.key, false);
  239 |                     await sheet.getByRole('button', { name: 'Ajouter 1 Yassa poulet au panier' }).click();
  240 |                     await expect(sheet).toBeHidden();
  241 | 
  242 |                     // 5. Panier et devis de la base (« À emporter » par défaut : aucune zone à choisir)
  243 |                     if (w.phone) await page.getByRole('button', { name: 'Voir le panier, 1 article' }).click();
  244 |                     await expect(scope.getByRole('region', { name: 'Montant de la commande' }).getByText('Total')).toBeVisible({ timeout: 20_000 });
  245 |                     // Yassa 3 500 + piment 200 = 3 700 ; frais 5 % : 185 ; total 3 885 (devis de la base, lu à l'écran)
  246 |                     await expect(scope.getByRole('region', { name: 'Montant de la commande' })).toContainText(/3\s885/);
  247 |                     await settle(page);
  248 |                     // Heure estimée servie par le devis (« Prête vers 13 h 05 ») : idée 10 des correctifs
  249 |                     await expect(scope.getByTestId('heure-estimee-panier')).toContainText(/Prête (demain )?vers \d{1,2} h/);
  250 |                     await checkLayout(page, w.width, w.phone, 'panier et devis');
  251 |                     await shot(page, 'panier-devis', w.width, theme.key, !w.phone);
  252 | 
  253 |                     // 6. Finaliser : sur place (table), heure
  254 |                     await scope.getByRole('button', { name: 'Finaliser' }).click();
  255 |                     await scope.getByRole('radio', { name: 'Sur place' }).click();
  256 |                     await scope.getByLabel('Votre table').selectOption({ label: 'Table 7' });
  257 |                     await settle(page);
  258 |                     await checkLayout(page, w.width, w.phone, 'sur place');
  259 |                     await shot(page, 'sur-place', w.width, theme.key, !w.phone);
  260 |                     await scope.getByRole('radio', { name: 'Autre heure' }).click();
  261 |                     await expect(scope.getByLabel('Heure', { exact: true })).toBeVisible();
  262 |                     await settle(page);
  263 |                     await checkLayout(page, w.width, w.phone, 'choix de l’heure');
  264 |                     await shot(page, 'choix-heure', w.width, theme.key, !w.phone);
  265 | 
  266 |                     // 7. À emporter, tout de suite, tout payer : commande puis page de suivi (compte à rebours, paiement)
  267 |                     await scope.getByRole('radio', { name: 'À emporter' }).click();
  268 |                     await scope.getByRole('radio', { name: 'Tout de suite' }).click();
  269 |                     await scope.getByRole('radio', { name: 'Tout payer' }).click();
  270 |                     const order = scope.getByRole('button', { name: 'Commander', exact: true });
  271 |                     await expect(order).toBeEnabled({ timeout: 20_000 });
  272 |                     // Prix changé par la partenaire entre l'affichage et la commande (idée 8) : rien de créé, ancien et nouveau
  273 |                     // prix ligne par ligne, un seul bouton « Commander à <nouveau total> » (3 700 + 200 + frais 195 = 4 095)
  274 |                     await setPrice(data.products.yassa, 3_700);
  275 |                     try {
  276 |                         await order.click();
  277 |                         const changed = scope.getByTestId('prix-change');
  278 |                         await expect(changed).toBeVisible({ timeout: 20_000 });
  279 |                         await expect(changed).toContainText(/Yassa poulet.*3\s700/);
  280 |                         await expect(changed).toContainText(/Total.*4\s095/);
  281 |                         // Contrôle la feuille revenue en haut (run 774 : l'annonce fait défiler la feuille, et le contrôle lisait
  282 |                         // les puces de l'heure passées sous le titre opaque de la feuille) ; capture l'annonce à l'écran
  283 |                         await scope.evaluate((root) => {
  284 |                             for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
  285 |                                 if (el.scrollHeight > el.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(el).overflowY)) el.scrollTop = 0;
  286 |                             }
  287 |                         });
  288 |                         await settle(page);
  289 |                         await checkLayout(page, w.width, w.phone, 'prix changé');
  290 |                         await changed.scrollIntoViewIfNeeded();
  291 |                         await settle(page);
  292 |                         await shot(page, 'prix-change', w.width, theme.key, !w.phone);
  293 |                         await scope.getByRole('button', { name: /^Commander à 4\s095\sF\sCFA$/ }).click();
  294 |                         await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  295 |                     } finally {
  296 |                         await setPrice(data.products.yassa, 3_500);
  297 |                     }
  298 |                     const orderId = page.url().split('/orders/')[1];
  299 |                     await expect(page.getByTestId('compte-a-rebours')).toContainText(/À payer dans \d+:\d{2}/, { timeout: 20_000 });
  300 |                     await expect(page.getByTestId('paiement-commande')).toBeVisible();
  301 |                     await settle(page);
  302 |                     await checkLayout(page, w.width, w.phone, 'paiement et compte à rebours');
  303 |                     await shot(page, 'paiement', w.width, theme.key);
  304 | 
  305 |                     // 8. Paiement Wave : faux SamirPay et vrai webhook
  306 |                     // Opérateur mémorisé dès le 2ᵉ parcours (« Numéro Wave du payeur ») : la carte de l'opérateur est visée exactement
  307 |                     await page.getByTestId('paiement-commande').locator('label', { hasText: /^Wave$/ }).click();
  308 |                     const [payRes] = await Promise.all([
  309 |                         page.waitForResponse((r) => r.url().endsWith('/api/payments/create') && r.request().method() === 'POST', { timeout: 30_000 }),
  310 |                         page.getByRole('button', { name: /^Payer .* avec Wave$/ }).click(),
  311 |                     ]);
  312 |                     const payBody = await payRes.json().catch(() => null) as Record<string, unknown> | null;
  313 |                     expect([200, 201], `paiement de la commande : HTTP ${payRes.status()} ${JSON.stringify(payBody)}`).toContain(payRes.status());
  314 |                     await completePayment(orderId, String(payBody?.payment_id ?? ''));
  315 |                     await stepReached(page, orderId, 'RECUE');
  316 |                     await settle(page);
  317 |                     await checkLayout(page, w.width, w.phone, 'suivi : envoyée');
  318 |                     await shot(page, 'suivi-recue', w.width, theme.key);
  319 | 
  320 |                     // 9. Chaque étape, avancée par la partenaire
  321 |                     await partnerStep(data, orderId, 'ACCEPTER');
  322 |                     await stepReached(page, orderId, 'ACCEPTEE');
> 323 |                     await expect(page.getByTestId('heure-estimee')).toContainText('Prévue vers');
      |                                                                     ^ Error: expect(locator).toContainText(expected) failed
  324 |                     await settle(page);
  325 |                     await shot(page, 'suivi-acceptee', w.width, theme.key);
  326 |                     await partnerStep(data, orderId, 'PREPARER');
  327 |                     await stepReached(page, orderId, 'EN_PREPARATION');
  328 |                     await settle(page);
  329 |                     await checkLayout(page, w.width, w.phone, 'suivi : en préparation');
  330 |                     await shot(page, 'suivi-preparation', w.width, theme.key);
  331 |                     await partnerStep(data, orderId, 'PRETE');
  332 |                     await stepReached(page, orderId, 'PRETE');
  333 |                     const cases = page.getByTestId('case-code');
  334 |                     await expect(cases).toHaveCount(4, { timeout: 30_000 });
  335 |                     await expect(page.getByTestId('code-remise')).toContainText('Montrez ce code à la remise');
  336 |                     const code = (await cases.allInnerTexts()).map((t) => t.trim()).join('');
  337 |                     expect(code, 'code de quatre chiffres').toMatch(/^\d{4}$/);
  338 |                     await settle(page);
  339 |                     await checkLayout(page, w.width, w.phone, 'code de remise');
  340 |                     await shot(page, 'code', w.width, theme.key);
  341 |                     // Lien de l'avis « commande prête » (?comptoir=1) : le code s'ouvre en très grand (idée 11), sans copie
  342 |                     await page.goto(`/orders/${orderId}?comptoir=1`, { waitUntil: 'load' });
  343 |                     const counter = page.getByTestId('mode-comptoir');
  344 |                     await expect(counter).toBeVisible({ timeout: 30_000 });
  345 |                     await expect(counter).toContainText(code.split('').join(''));
  346 |                     await expect(counter).toHaveCSS('user-select', 'none');
  347 |                     expect(page.url(), 'le code ne passe jamais par l’adresse').not.toContain(code);
  348 |                     await settle(page);
  349 |                     await checkLayout(page, w.width, w.phone, 'mode comptoir');
  350 |                     await shot(page, 'mode-comptoir', w.width, theme.key, false);
  351 |                     await counter.getByRole('button', { name: 'Fermer' }).click();
  352 |                     await expect(counter).toHaveCount(0);
  353 |                     await partnerStep(data, orderId, 'REMETTRE', { code });
  354 |                     await stepReached(page, orderId, 'REMISE');
  355 |                     await expect(page.getByTestId('code-remise')).toHaveCount(0);
  356 |                     await settle(page);
  357 |                     await checkLayout(page, w.width, w.phone, 'suivi : retirée');
  358 |                     await shot(page, 'suivi-retiree', w.width, theme.key);
  359 | 
  360 |                     // 10. Annulation d'une commande payable à la remise (aucun paiement)
  361 |                     const made = await context.request.post(`${APP_URL}/api/orders/create`, {
  362 |                         headers: { 'Idempotency-Key': `l12b-${randomUUID()}` },
  363 |                         data: { venueId: data.venueId, mode: 'RETRAIT', payment: 'DIFFERE', items: [{ productId: data.products.mafe, quantity: 1 }] },
  364 |                     });
  365 |                     const madeBody = await made.json() as { order?: { id?: string } };
  366 |                     expect(made.status(), `commande à annuler : ${JSON.stringify(madeBody)}`).toBe(201);
  367 |                     const second = String(madeBody.order?.id);
  368 |                     await page.goto(`/orders/${second}`, { waitUntil: 'load' });
  369 |                     await page.getByRole('button', { name: 'Annuler la commande' }).click();
  370 |                     await expect(page.getByRole('alertdialog', { name: 'Annuler la commande ?' })).toBeVisible();
  371 |                     await settle(page);
  372 |                     await checkLayout(page, w.width, w.phone, 'annulation');
  373 |                     await shot(page, 'annulation', w.width, theme.key, false);
  374 |                     await page.getByRole('button', { name: 'Oui, annuler' }).click();
  375 |                     await expect(page.getByRole('button', { name: 'Annuler la commande' })).toHaveCount(0, { timeout: 20_000 });
  376 |                     await settle(page);
  377 |                     await checkLayout(page, w.width, w.phone, 'commande annulée');
  378 |                     await shot(page, 'annulee', w.width, theme.key);
  379 | 
  380 |                     // 10 bis. Commande payable à la remise, acceptée : lien de l'avis « commande acceptée » (?payer=solde), le
  381 |                     // panneau du solde s'ouvre au montant relu en base (idée 12)
  382 |                     const third = await context.request.post(`${APP_URL}/api/orders/create`, {
  383 |                         headers: { 'Idempotency-Key': `l12b-${randomUUID()}` },
  384 |                         data: { venueId: data.venueId, mode: 'RETRAIT', payment: 'DIFFERE', items: [{ productId: data.products.mafe, quantity: 1 }] },
  385 |                     });
  386 |                     const thirdBody = await third.json() as { order?: { id?: string } };
  387 |                     expect(third.status(), `commande payable à la remise : ${JSON.stringify(thirdBody)}`).toBe(201);
  388 |                     const accepted = String(thirdBody.order?.id);
  389 |                     await partnerStep(data, accepted, 'ACCEPTER');
  390 |                     await page.goto(`/orders/${accepted}?payer=solde`, { waitUntil: 'load' });
  391 |                     const balance = page.getByTestId('solde');
  392 |                     await expect(balance.getByTestId('paiement-solde')).toBeVisible({ timeout: 30_000 });
  393 |                     await settle(page);
  394 |                     await checkLayout(page, w.width, w.phone, 'solde depuis l’avis');
  395 |                     await shot(page, 'solde-depuis-avis', w.width, theme.key, false); // écran visible : le panneau amené à l'écran (en-tête fixe)
  396 | 
  397 |                     // 11. Mes commandes (heure estimée rappelée pour la commande en cours : idée 10)
  398 |                     await page.goto('/orders', { waitUntil: 'load' });
  399 |                     await expect(page.locator(`[data-commande="${orderId}"]`).first()).toBeVisible({ timeout: 30_000 });
  400 |                     await expect(page.locator(`[data-commande="${accepted}"]`).getByTestId('heure-estimee-liste')).toContainText(/Prête (demain )?vers \d{1,2} h/);
  401 |                     await expect(page.getByRole('link', { name: /Commander à nouveau/ }).or(page.getByRole('button', { name: /Commander à nouveau/ })).first()).toBeVisible();
  402 |                     await settle(page);
  403 |                     await checkLayout(page, w.width, w.phone, 'Mes commandes');
  404 |                     await shot(page, 'mes-commandes', w.width, theme.key);
  405 |                     const undo = await context.request.post(`${APP_URL}/api/orders/${accepted}/cancel`, { data: {} });
  406 |                     expect(undo.status(), `annulation de la commande acceptée : ${await undo.text()}`).toBe(200);
  407 | 
  408 |                     // 12. Fermeture exceptionnelle annoncée sur la carte (idée 9), premier créneau proposé ; levée ensuite
  409 |                     const { data: closure, error: cErr } = await serviceClient().from('venue_closures')
  410 |                         .insert({ venue_id: data.venueId, starts_at: dakarQuarter(-60), ends_at: `${dakarQuarter(24 * 60).slice(0, 10)} 18:00`, reason: 'Fermeture des captures (lot 12b)' })
  411 |                         .select('id').single();
  412 |                     if (cErr || !closure) throw new Error(`[l12b] fermeture : ${cErr?.message}`);
  413 |                     try {
  414 |                         await page.goto(`/restaurants/${data.venueId}/menu`, { waitUntil: 'load' });
  415 |                         await expect(page.getByText(/^Fermé exceptionnellement jusqu’au \d{2}\/\d{2} à 18 h — commandez pour plus tard$/).first()).toBeVisible({ timeout: 30_000 });
  416 |                         // Carte alignée sur le devis du 12c : premier créneau = fin de la fermeture + préparation (25 min) → 18 h 25 ;
  417 |                         // au quart d'heure : 18 h 30
  418 |                         await expect(page.getByTestId('fermeture-exceptionnelle').first()).toContainText('Premier créneau proposé : Demain à 18 h 30');
  419 |                         await expect(page.getByText('Ouvert maintenant', { exact: true })).toHaveCount(0);
  420 |                         await settle(page);
  421 |                         await checkLayout(page, w.width, w.phone, 'fermeture exceptionnelle');
  422 |                         await shot(page, 'fermeture', w.width, theme.key, false);
  423 |                     } finally {
```