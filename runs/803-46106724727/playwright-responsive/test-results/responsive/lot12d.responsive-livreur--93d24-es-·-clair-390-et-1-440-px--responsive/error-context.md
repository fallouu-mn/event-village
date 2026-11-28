# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lot12d.responsive.spec.ts >> livreur, administration, fermeture, pause, signalement, allergènes · clair (390 et 1 440 px)
- Location: e2e/lot12d.responsive.spec.ts:233:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('pause-commandes')
Expected: visible
Error: strict mode violation: getByTestId('pause-commandes') resolved to 2 elements:
    1) <p data-testid="pause-commandes">Il fait une courte pause pour servir les commande…</p> aka getByRole('status').getByTestId('pause-commandes')
    2) <p data-testid="pause-commandes">Il fait une courte pause pour servir les commande…</p> aka getByTestId('pause-commandes').nth(1)

Call log:
  - Expect "toBeVisible" getByTestId('pause-commandes') with timeout 30000ms
  - waiting for getByTestId('pause-commandes')

```

# Page snapshot

```yaml
- generic [active] [ref=f5e1]:
  - generic [ref=f5e3]:
    - banner [ref=f5e4]:
      - generic [ref=f5e5]:
        - link "Event Village, accueil" [ref=f5e7] [cursor=pointer]:
          - /url: /
          - generic [ref=f5e8]: Event Village
        - navigation "Rubriques" [ref=f5e13]:
          - link "Accueil" [ref=f5e14] [cursor=pointer]:
            - /url: /
          - link "Explorer" [ref=f5e15] [cursor=pointer]:
            - /url: /explore
          - link "Mes billets" [ref=f5e16] [cursor=pointer]:
            - /url: /tickets
          - link "Commandes" [ref=f5e17] [cursor=pointer]:
            - /url: /orders
          - link "Portefeuille" [ref=f5e18] [cursor=pointer]:
            - /url: /wallet
      - link "Rechercher un événement…" [ref=f5e20] [cursor=pointer]:
        - /url: /explore
      - generic [ref=f5e25]:
        - button "Notifications" [ref=f5e27] [cursor=pointer]
        - button "Awa Client" [ref=f5e32] [cursor=pointer]:
          - generic [aria-hidden] [ref=f5e33]: AC
    - main [ref=f5e37]:
      - generic [ref=f5e39]:
        - generic [ref=f5e40]:
          - generic [ref=f5e45]:
            - generic [ref=f5e46]:
              - generic [ref=f5e47]: Restaurant
              - generic [ref=f5e49]: Ouvert maintenant
            - heading "Le Baobab 25ea31" [level=1] [ref=f5e51]
            - list [ref=f5e52]:
              - listitem [ref=f5e53]:
                - generic [ref=f5e57]: Rue 10, Médina, Dakar
              - listitem [ref=f5e58]:
                - generic [ref=f5e62]: Aujourd’hui 0 h – 24 h
              - listitem [ref=f5e63]:
                - generic [ref=f5e67]: Prêt en 20 min environ
            - list "Modes de remise" [ref=f5e68]:
              - listitem [ref=f5e69]: Livraison
              - listitem [ref=f5e70]: À emporter
          - status [ref=f5e71]:
            - generic [ref=f5e76]:
              - paragraph [ref=f5e77]: Ce restaurant reprend les commandes à 5 h 24
              - paragraph [ref=f5e79]: "Il fait une courte pause pour servir les commandes en cours. Vous pouvez préparer votre panier : vous commanderez dès la reprise."
          - group "Filtres de la carte" [ref=f5e80]:
            - button "Sans piment" [ref=f5e81] [cursor=pointer]
          - region [ref=f5e84]:
            - heading "La carte" [level=2] [ref=f5e85]
            - generic [ref=f5e86]:
              - article [ref=f5e87]:
                - button "Voir Bissap maison" [ref=f5e88] [cursor=pointer]:
                  - img "Bissap maison (sans photo)" [ref=f5e90]
                  - generic [ref=f5e94]:
                    - generic [ref=f5e95]: Bissap maison
                    - generic [ref=f5e96]: Fleurs d’hibiscus, menthe fraîche.
                    - generic [ref=f5e97]: 1 000 F CFA
              - article [ref=f5e101]:
                - button "Voir Pastels au thon" [ref=f5e102] [cursor=pointer]:
                  - img "Pastels au thon (sans photo)" [ref=f5e104]
                  - generic [ref=f5e108]:
                    - generic [ref=f5e109]: Pastels au thon
                    - generic [ref=f5e110]: Chaussons frits, sauce très pimentée.
                    - generic [ref=f5e111]: 2 000 F CFA
              - article [ref=f5e115]:
                - button "Voir Thiéboudienne" [ref=f5e116] [cursor=pointer]:
                  - img "Thiéboudienne (sans photo)" [ref=f5e118]
                  - generic [ref=f5e122]:
                    - generic [ref=f5e123]: Thiéboudienne
                    - generic [ref=f5e124]: Riz au poisson, légumes du marché.
                    - generic [ref=f5e125]: 4 500 F CFA
              - article [ref=f5e129]:
                - button "Voir Yassa poulet" [ref=f5e130] [cursor=pointer]:
                  - img "Yassa poulet (sans photo)" [ref=f5e132]
                  - generic [ref=f5e136]:
                    - generic [ref=f5e137]: Yassa poulet
                    - generic [ref=f5e138]: Poulet mariné au citron et aux oignons, riz blanc.
                    - generic [ref=f5e139]: 3 500 F CFA
        - complementary "Votre panier" [ref=f5e143]:
          - generic [ref=f5e144]:
            - heading "Votre panier" [level=2] [ref=f5e145]
            - generic [ref=f5e147]:
              - paragraph [ref=f5e154]: Votre panier est vide
              - paragraph [ref=f5e155]: "Touchez un plat pour l’ajouter : le total exact s’affiche ici."
              - button "Voir la carte" [ref=f5e156] [cursor=pointer]
  - alert [ref=f5e158]
```

# Test source

```ts
  271 |                 await settle(cp);
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
> 371 |                 await expect(pp.getByTestId('pause-commandes')).toBeVisible({ timeout: 30_000 });
      |                                                                 ^ Error: expect(locator).toBeVisible() failed
  372 |                 await expect(pp.getByText(/^Ce restaurant reprend les commandes à \d{1,2} h( \d{2})?$/).first()).toBeVisible();
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