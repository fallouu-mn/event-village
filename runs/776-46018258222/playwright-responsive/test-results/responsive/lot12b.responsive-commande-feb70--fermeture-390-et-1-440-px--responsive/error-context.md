# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lot12b.responsive.spec.ts >> commandes du client · clair : carte, panier, heure, sur place, prix changé, paiement, suivi, code et mode comptoir, annulation, solde, Mes commandes, fermeture (390 et 1 440 px)
- Location: e2e/lot12b.responsive.spec.ts:199:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/^Fermé exceptionnellement jusqu’au \d{2}\/\d{2} à 18 h — commandez pour plus tard$/)
Expected: visible
Error: strict mode violation: getByText(/^Fermé exceptionnellement jusqu’au \d{2}\/\d{2} à 18 h — commandez pour plus tard$/) resolved to 2 elements:
    1) <p class="text-base font-semibold leading-snug">Fermé exceptionnellement jusqu’au 28/11 à 18 h — …</p> aka getByRole('status').getByText('Fermé exceptionnellement')
    2) <p class="text-base font-semibold leading-snug">Fermé exceptionnellement jusqu’au 28/11 à 18 h — …</p> aka getByText('Fermé exceptionnellement').nth(1)

Call log:
  - Expect "toBeVisible" getByText(/^Fermé exceptionnellement jusqu’au \d{2}\/\d{2} à 18 h — commandez pour plus tard$/) with timeout 30000ms
  - waiting for getByText(/^Fermé exceptionnellement jusqu’au \d{2}\/\d{2} à 18 h — commandez pour plus tard$/)

```

# Test source

```ts
  321 |                     await stepReached(page, orderId, 'RECUE');
  322 |                     await settle(page);
  323 |                     await checkLayout(page, w.width, w.phone, 'suivi : envoyée');
  324 |                     await shot(page, 'suivi-recue', w.width, theme.key);
  325 | 
  326 |                     // 9. Chaque étape, avancée par la partenaire
  327 |                     await partnerStep(data, orderId, 'ACCEPTER');
  328 |                     await stepReached(page, orderId, 'ACCEPTEE');
  329 |                     await expect(page.getByTestId('heure-estimee')).toContainText('Prévue vers');
  330 |                     await settle(page);
  331 |                     await shot(page, 'suivi-acceptee', w.width, theme.key);
  332 |                     await partnerStep(data, orderId, 'PREPARER');
  333 |                     await stepReached(page, orderId, 'EN_PREPARATION');
  334 |                     await settle(page);
  335 |                     await checkLayout(page, w.width, w.phone, 'suivi : en préparation');
  336 |                     await shot(page, 'suivi-preparation', w.width, theme.key);
  337 |                     await partnerStep(data, orderId, 'PRETE');
  338 |                     await stepReached(page, orderId, 'PRETE');
  339 |                     const cases = page.getByTestId('case-code');
  340 |                     await expect(cases).toHaveCount(4, { timeout: 30_000 });
  341 |                     await expect(page.getByTestId('code-remise')).toContainText('Montrez ce code à la remise');
  342 |                     const code = (await cases.allInnerTexts()).map((t) => t.trim()).join('');
  343 |                     expect(code, 'code de quatre chiffres').toMatch(/^\d{4}$/);
  344 |                     await settle(page);
  345 |                     await checkLayout(page, w.width, w.phone, 'code de remise');
  346 |                     await shot(page, 'code', w.width, theme.key);
  347 |                     // Lien de l'avis « commande prête » (?comptoir=1) : le code s'ouvre en très grand (idée 11), sans copie
  348 |                     await page.goto(`/orders/${orderId}?comptoir=1`, { waitUntil: 'load' });
  349 |                     const counter = page.getByTestId('mode-comptoir');
  350 |                     await expect(counter).toBeVisible({ timeout: 30_000 });
  351 |                     await expect(counter).toContainText(code.split('').join(''));
  352 |                     await expect(counter).toHaveCSS('user-select', 'none');
  353 |                     expect(page.url(), 'le code ne passe jamais par l’adresse').not.toContain(code);
  354 |                     await settle(page);
  355 |                     await checkLayout(page, w.width, w.phone, 'mode comptoir');
  356 |                     await shot(page, 'mode-comptoir', w.width, theme.key, false);
  357 |                     await counter.getByRole('button', { name: 'Fermer' }).click();
  358 |                     await expect(counter).toHaveCount(0);
  359 |                     await partnerStep(data, orderId, 'REMETTRE', { code });
  360 |                     await stepReached(page, orderId, 'REMISE');
  361 |                     await expect(page.getByTestId('code-remise')).toHaveCount(0);
  362 |                     await settle(page);
  363 |                     await checkLayout(page, w.width, w.phone, 'suivi : retirée');
  364 |                     await shot(page, 'suivi-retiree', w.width, theme.key);
  365 | 
  366 |                     // 10. Annulation d'une commande payable à la remise (aucun paiement)
  367 |                     const made = await context.request.post(`${APP_URL}/api/orders/create`, {
  368 |                         headers: { 'Idempotency-Key': `l12b-${randomUUID()}` },
  369 |                         data: { venueId: data.venueId, mode: 'RETRAIT', payment: 'DIFFERE', items: [{ productId: data.products.mafe, quantity: 1 }] },
  370 |                     });
  371 |                     const madeBody = await made.json() as { order?: { id?: string } };
  372 |                     expect(made.status(), `commande à annuler : ${JSON.stringify(madeBody)}`).toBe(201);
  373 |                     const second = String(madeBody.order?.id);
  374 |                     await page.goto(`/orders/${second}`, { waitUntil: 'load' });
  375 |                     await page.getByRole('button', { name: 'Annuler la commande' }).click();
  376 |                     await expect(page.getByRole('alertdialog', { name: 'Annuler la commande ?' })).toBeVisible();
  377 |                     await settle(page);
  378 |                     await checkLayout(page, w.width, w.phone, 'annulation');
  379 |                     await shot(page, 'annulation', w.width, theme.key, false);
  380 |                     await page.getByRole('button', { name: 'Oui, annuler' }).click();
  381 |                     await expect(page.getByRole('button', { name: 'Annuler la commande' })).toHaveCount(0, { timeout: 20_000 });
  382 |                     await settle(page);
  383 |                     await checkLayout(page, w.width, w.phone, 'commande annulée');
  384 |                     await shot(page, 'annulee', w.width, theme.key);
  385 | 
  386 |                     // 10 bis. Commande payable à la remise, acceptée : lien de l'avis « commande acceptée » (?payer=solde), le
  387 |                     // panneau du solde s'ouvre au montant relu en base (idée 12)
  388 |                     const third = await context.request.post(`${APP_URL}/api/orders/create`, {
  389 |                         headers: { 'Idempotency-Key': `l12b-${randomUUID()}` },
  390 |                         data: { venueId: data.venueId, mode: 'RETRAIT', payment: 'DIFFERE', items: [{ productId: data.products.mafe, quantity: 1 }] },
  391 |                     });
  392 |                     const thirdBody = await third.json() as { order?: { id?: string } };
  393 |                     expect(third.status(), `commande payable à la remise : ${JSON.stringify(thirdBody)}`).toBe(201);
  394 |                     const accepted = String(thirdBody.order?.id);
  395 |                     await partnerStep(data, accepted, 'ACCEPTER');
  396 |                     await page.goto(`/orders/${accepted}?payer=solde`, { waitUntil: 'load' });
  397 |                     const balance = page.getByTestId('solde');
  398 |                     await expect(balance.getByTestId('paiement-solde')).toBeVisible({ timeout: 30_000 });
  399 |                     await settle(page);
  400 |                     await checkLayout(page, w.width, w.phone, 'solde depuis l’avis');
  401 |                     await shot(page, 'solde-depuis-avis', w.width, theme.key);
  402 | 
  403 |                     // 11. Mes commandes (heure estimée rappelée pour la commande en cours : idée 10)
  404 |                     await page.goto('/orders', { waitUntil: 'load' });
  405 |                     await expect(page.locator(`[data-commande="${orderId}"]`).first()).toBeVisible({ timeout: 30_000 });
  406 |                     await expect(page.locator(`[data-commande="${accepted}"]`).getByTestId('heure-estimee-liste')).toContainText(/Prête (demain )?vers \d{1,2} h/);
  407 |                     await expect(page.getByRole('link', { name: /Commander à nouveau/ }).or(page.getByRole('button', { name: /Commander à nouveau/ })).first()).toBeVisible();
  408 |                     await settle(page);
  409 |                     await checkLayout(page, w.width, w.phone, 'Mes commandes');
  410 |                     await shot(page, 'mes-commandes', w.width, theme.key);
  411 |                     const undo = await context.request.post(`${APP_URL}/api/orders/${accepted}/cancel`, { data: {} });
  412 |                     expect(undo.status(), `annulation de la commande acceptée : ${await undo.text()}`).toBe(200);
  413 | 
  414 |                     // 12. Fermeture exceptionnelle annoncée sur la carte (idée 9), premier créneau proposé ; levée ensuite
  415 |                     const { data: closure, error: cErr } = await serviceClient().from('venue_closures')
  416 |                         .insert({ venue_id: data.venueId, starts_at: dakarQuarter(-60), ends_at: `${dakarQuarter(24 * 60).slice(0, 10)} 18:00`, reason: 'Fermeture des captures (lot 12b)' })
  417 |                         .select('id').single();
  418 |                     if (cErr || !closure) throw new Error(`[l12b] fermeture : ${cErr?.message}`);
  419 |                     try {
  420 |                         await page.goto(`/restaurants/${data.venueId}/menu`, { waitUntil: 'load' });
> 421 |                         await expect(page.getByText(/^Fermé exceptionnellement jusqu’au \d{2}\/\d{2} à 18 h — commandez pour plus tard$/)).toBeVisible({ timeout: 30_000 });
      |                                                                                                                                            ^ Error: expect(locator).toBeVisible() failed
  422 |                         await expect(page.getByTestId('fermeture-exceptionnelle')).toContainText('Premier créneau proposé');
  423 |                         await settle(page);
  424 |                         await checkLayout(page, w.width, w.phone, 'fermeture exceptionnelle');
  425 |                         await shot(page, 'fermeture', w.width, theme.key, false);
  426 |                     } finally {
  427 |                         await serviceClient().from('venue_closures').update({ cancelled_at: new Date().toISOString() }).eq('id', String(closure.id));
  428 |                     }
  429 |                 }
  430 |             } finally {
  431 |                 await context.close();
  432 |             }
  433 |         } finally {
  434 |             await releaseOrdersService(`${WHO} (${theme.key})`, superadmin);
  435 |         }
  436 |     });
  437 | }
  438 | 
```