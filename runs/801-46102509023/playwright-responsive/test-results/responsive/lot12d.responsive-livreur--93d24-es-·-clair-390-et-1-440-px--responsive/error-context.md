# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lot12d.responsive.spec.ts >> livreur, administration, fermeture, pause, signalement, allergènes · clair (390 et 1 440 px)
- Location: e2e/lot12d.responsive.spec.ts:233:9

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByTestId('pause-commandes')
Expected substring: "Ce restaurant reprend les commandes à"
Received string:    "Il fait une courte pause pour servir les commandes en cours. Vous pouvez préparer votre panier : vous commanderez dès la reprise."
Timeout: 15000ms

Call log:
  - Expect "toContainText" getByTestId('pause-commandes') with timeout 15000ms
  - waiting for getByTestId('pause-commandes')
    34 × locator resolved to <p data-testid="pause-commandes">Il fait une courte pause pour servir les commande…</p>
       - unexpected value "Il fait une courte pause pour servir les commandes en cours. Vous pouvez préparer votre panier : vous commanderez dès la reprise."

```

```yaml
- paragraph: "Il fait une courte pause pour servir les commandes en cours. Vous pouvez préparer votre panier : vous commanderez dès la reprise."
```

# Test source

```ts
  272 |                 await checkLayout(cp, w.width, w.phone, 'saisie du code');
  273 |                 await shot(cp, 'livreur-code', w.width, theme.key);
  274 | 
  275 |                 await cp.goto(`/courier/orders/${d.orders.absent.id}`, { waitUntil: 'load' });
  276 |                 await title(cp, `Livraison ${d.orders.absent.number}`);
  277 |                 await expect(cp.getByText(/^Client absent : attente/).first()).toBeVisible({ timeout: 30_000 });
  278 |                 await settle(cp);
  279 |                 await checkLayout(cp, w.width, w.phone, 'client absent');
  280 |                 await shot(cp, 'livreur-client-absent', w.width, theme.key);
  281 | 
  282 |                 await cp.goto(`/courier/invitations/${d.invitationId}`, { waitUntil: 'load' });
  283 |                 await title(cp, /vous invite à livrer$/);
  284 |                 await expect(cp.getByRole('button', { name: 'Accepter' })).toBeVisible({ timeout: 30_000 });
  285 |                 await settle(cp);
  286 |                 await checkLayout(cp, w.width, w.phone, 'invitation');
  287 |                 await shot(cp, 'livreur-invitation', w.width, theme.key);
  288 |             }
  289 |             await cour.close();
  290 | 
  291 |             // ── Administration ────────────────────────────────────────────────────────────────────────────────
  292 |             const adm = await themedContext(browser, testInfo, theme.scheme, requireStorageState('fumee-superadmin'));
  293 |             const ap = await adm.newPage();
  294 |             for (const w of WIDTHS) {
  295 |                 await ap.setViewportSize({ width: w.width, height: w.height });
  296 |                 await ap.goto('/admin/orders?groupe=A_DECIDER', { waitUntil: 'load' });
  297 |                 await title(ap, 'Commandes');
  298 |                 await expect(ap.getByRole('link', { name: d.orders.equipe.number }).first()).toBeVisible({ timeout: 30_000 });
  299 |                 await settle(ap);
  300 |                 await checkLayout(ap, w.width, w.phone, 'commandes à décider');
  301 |                 await shot(ap, 'admin-liste', w.width, theme.key);
  302 | 
  303 |                 await ap.goto(`/admin/orders/${d.orders.route.id}`, { waitUntil: 'load' });
  304 |                 await title(ap, `Commande ${d.orders.route.number}`);
  305 |                 await expect(ap.getByRole('heading', { name: 'Étapes' })).toBeVisible({ timeout: 30_000 });
  306 |                 await settle(ap);
  307 |                 await checkLayout(ap, w.width, w.phone, 'fiche d’une commande');
  308 |                 await shot(ap, 'admin-fiche', w.width, theme.key);
  309 | 
  310 |                 await ap.goto(`/admin/orders/${d.orders.equipe.id}`, { waitUntil: 'load' });
  311 |                 await title(ap, `Commande ${d.orders.equipe.number}`);
  312 |                 const decide = ap.getByRole('heading', { name: 'Décider après l’absence du client' });
  313 |                 await expect(decide).toBeVisible({ timeout: 30_000 });
  314 |                 await ap.getByText('Ne rien rembourser', { exact: true }).first().click();
  315 |                 await ap.getByLabel('Motif').last().fill('Deux appels et trente minutes d’attente sans réponse.');
  316 |                 await ap.getByRole('button', { name: 'Voir le montant rendu' }).click();
  317 |                 await expect(ap.getByRole('button', { name: /^Confirmer/ })).toBeVisible({ timeout: 30_000 });
  318 |                 await decide.scrollIntoViewIfNeeded();
  319 |                 await settle(ap);
  320 |                 await checkLayout(ap, w.width, w.phone, 'décision après une absence');
  321 |                 await shot(ap, 'admin-decision', w.width, theme.key);
  322 |             }
  323 |             await adm.close();
  324 | 
  325 |             // ── Partenaire : fermeture avec commandes, pause ──────────────────────────────────────────────────
  326 |             const org = await themedContext(browser, testInfo, theme.scheme, requireStorageState('organisateur'));
  327 |             const op = await org.newPage();
  328 |             for (const w of WIDTHS) {
  329 |                 await op.setViewportSize({ width: w.width, height: w.height });
  330 |                 await op.goto(`/partner/tables/edition/${d.venueId}/fermetures?fermeture=${d.closureId}`, { waitUntil: 'load' });
  331 |                 const section = op.getByRole('heading', { name: 'Commandes prévues pendant cette fermeture' }).first();
  332 |                 await expect(section).toBeVisible({ timeout: 30_000 });
  333 |                 await expect(op.getByRole('button', { name: `Garder la commande ${d.orders.fermeture.number}` })).toBeVisible();
  334 |                 await section.scrollIntoViewIfNeeded();
  335 |                 await settle(op);
  336 |                 await checkLayout(op, w.width, w.phone, 'fermeture avec commandes');
  337 |                 await shot(op, 'partenaire-fermeture', w.width, theme.key);
  338 | 
  339 |                 await op.goto('/partner/orders', { waitUntil: 'load' });
  340 |                 await title(op, 'Commandes');
  341 |                 await expect(op.getByRole('heading', { name: 'Pause des commandes' }).first()).toBeVisible({ timeout: 30_000 });
  342 |                 await settle(op);
  343 |                 await checkLayout(op, w.width, w.phone, 'pause des commandes');
  344 |                 await shot(op, 'partenaire-pause', w.width, theme.key, false);
  345 |             }
  346 |             await org.close();
  347 | 
  348 |             // ── Cliente : signalement, bandeau de pause, allergènes ───────────────────────────────────────────
  349 |             // Même compte que le livreur (session préparée)
  350 |             const cli = await themedContext(browser, testInfo, theme.scheme, requireStorageState('fumee-client'));
  351 |             const pp = await cli.newPage();
  352 |             for (const w of WIDTHS) {
  353 |                 await pp.setViewportSize({ width: w.width, height: w.height });
  354 |                 await pp.goto(`/orders/${d.orders.prep.id}`, { waitUntil: 'load' });
  355 |                 await pp.getByRole('button', { name: 'Signaler un problème' }).first().click({ timeout: 30_000 });
  356 |                 const dialog = pp.getByRole('alertdialog', { name: 'Signaler un problème' });
  357 |                 await expect(dialog).toBeVisible({ timeout: 10_000 });
  358 |                 await expect(dialog.getByRole('radiogroup', { name: 'Motif du signalement' })).toBeVisible();
  359 |                 await settle(pp);
  360 |                 await checkLayout(pp, w.width, w.phone, 'signaler un problème');
  361 |                 await shot(pp, 'client-signalement', w.width, theme.key, false);
  362 |                 await pp.keyboard.press('Escape');
  363 | 
  364 |                 await pp.goto(`/orders/${d.orders.signale.id}`, { waitUntil: 'load' });
  365 |                 await expect(pp.getByText('Signalement envoyé').first()).toBeVisible({ timeout: 30_000 });
  366 |                 await settle(pp);
  367 |                 await checkLayout(pp, w.width, w.phone, 'signalement envoyé');
  368 |                 await shot(pp, 'client-signalement-envoye', w.width, theme.key);
  369 | 
  370 |                 await pp.goto(`/restaurants/${d.venueId}/menu`, { waitUntil: 'load' });
  371 |                 await expect(pp.getByTestId('pause-commandes')).toBeVisible({ timeout: 30_000 });
> 372 |                 await expect(pp.getByTestId('pause-commandes')).toContainText('Ce restaurant reprend les commandes à');
      |                                                                 ^ Error: expect(locator).toContainText(expected) failed
  373 |                 await expect(pp.getByRole('button', { name: 'Sans piment' })).toBeVisible();
  374 |                 await settle(pp);
  375 |                 await checkLayout(pp, w.width, w.phone, 'carte en pause');
  376 |                 await shot(pp, 'client-carte-pause', w.width, theme.key);
  377 |                 await pp.getByRole('button', { name: 'Voir Yassa poulet' }).click();
  378 |                 const sheet = pp.getByRole('dialog', { name: 'Yassa poulet' });
  379 |                 await expect(sheet).toBeVisible({ timeout: 10_000 });
  380 |                 await expect(sheet.getByRole('list', { name: 'Allergènes du plat' })).toBeVisible();
  381 |                 await settle(pp);
  382 |                 await checkLayout(pp, w.width, w.phone, 'allergènes et piment');
  383 |                 await shot(pp, 'client-allergenes', w.width, theme.key, false);
  384 |                 await pp.keyboard.press('Escape');
  385 |             }
  386 |             await cli.close();
  387 |         } finally {
  388 |             await releaseTablesService(who, superadmin);
  389 |             await releaseOrdersService(who, superadmin);
  390 |         }
  391 |     });
  392 | }
  393 | 
```