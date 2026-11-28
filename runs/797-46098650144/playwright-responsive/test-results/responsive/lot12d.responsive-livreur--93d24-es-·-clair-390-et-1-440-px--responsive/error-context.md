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

Locator: getByRole('dialog', { name: 'Signaler un problème' })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('dialog', { name: 'Signaler un problème' }) with timeout 10000ms
  - waiting for getByRole('dialog', { name: 'Signaler un problème' })

```

```yaml
- banner:
  - button "Ouvrir le menu"
  - link "Event Village, accueil":
    - /url: /
  - button "Notifications"
  - button "Basculer le thème"
  - link "Mon profil (Awa Client)":
    - /url: /profile
- main:
  - link "Mes commandes":
    - /url: /orders
  - text: En préparation À emporter Commande CMD-261128-CFE4E3
  - heading "Le Baobab 45a583" [level=1]
  - paragraph: "État de la commande : En préparation"
  - region "Suivi":
    - heading "Suivi" [level=2]
    - paragraph: Prévue vers 03 h 01
    - list "Étapes de la commande":
      - listitem:
        - paragraph: Envoyée
        - time: 02:40
      - listitem:
        - paragraph: Acceptée
        - time: 02:40
      - listitem:
        - paragraph: En préparation
        - time: 02:40
        - paragraph: Votre commande se prépare.
      - listitem:
        - paragraph: Prête
      - listitem:
        - paragraph: Retirée
  - region "Un problème avec la commande ?":
    - heading "Un problème avec la commande ?" [level=2]
    - paragraph: "Retard, article manquant, erreur : prévenez l’équipe Event Village, elle contacte l’établissement."
    - button "Signaler un problème"
  - region "Reste à payer":
    - heading "Reste à payer" [level=2]
    - paragraph: 3 500 F CFA à payer au comptoir, ou en ligne dès maintenant.
    - button "Payer le reste en ligne"
  - complementary:
    - region "À emporter":
      - heading "À emporter" [level=2]
      - paragraph: À retirer chez Le Baobab 45a583
    - region "Votre commande":
      - heading "Votre commande" [level=2]
      - list:
        - listitem:
          - paragraph: 1 × Yassa poulet
          - text: 3 500 F CFA
      - term: Sous-total
      - definition: 3 500 F CFA
      - term: Total de la commande
      - definition: 3 500 F CFA
      - term: Reste à payer
      - definition: 3 500 F CFA
- navigation "Navigation rapide":
  - link "Accueil":
    - /url: /
  - link "Explorer":
    - /url: /explore
  - link "Billets":
    - /url: /tickets
  - link "Avis":
    - /url: /notifications
  - link "Portefeuille":
    - /url: /wallet
- alert
- alertdialog "Signaler un problème":
  - heading "Signaler un problème" [level=2]
  - button "Fermer"
  - group "Qu’est-ce qui ne va pas ?":
    - text: Qu’est-ce qui ne va pas ?
    - radiogroup "Motif du signalement":
      - radio "Retard"
      - radio "Commande incomplète"
      - radio "Erreur dans la commande"
      - radio "Autre"
  - text: Précisez (facultatif) 0 / 300
  - textbox "Précisez (facultatif)"
  - paragraph: "Rien n’est remboursé automatiquement : l’équipe regarde votre commande et vous répond."
  - button "Retour"
  - button "Envoyer le signalement" [disabled]
```

# Test source

```ts
  257 |                 await title(cp, `Livraison ${d.orders.prete.number}`);
  258 |                 await expect(cp.getByRole('button', { name: 'Je pars' })).toBeVisible({ timeout: 30_000 });
  259 |                 await expect(cp.getByText('Le numéro du client s’affiche quand vous partez.')).toBeVisible();
  260 |                 await settle(cp);
  261 |                 await checkLayout(cp, w.width, w.phone, 'livraison prête');
  262 |                 await shot(cp, 'livreur-livraison', w.width, theme.key);
  263 | 
  264 |                 await cp.goto(`/courier/orders/${d.orders.route.id}`, { waitUntil: 'load' });
  265 |                 await title(cp, `Livraison ${d.orders.route.number}`);
  266 |                 const code = cp.getByRole('group', { name: 'Code de remise à 4 chiffres' });
  267 |                 await expect(code).toBeVisible({ timeout: 30_000 });
  268 |                 await expect(cp.getByText(/^Reste reçu en espèces/).first()).toBeVisible();
  269 |                 await expect(cp.getByRole('button', { name: 'Appeler le client' })).toBeVisible();
  270 |                 await code.scrollIntoViewIfNeeded();
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
  356 |                 const dialog = pp.getByRole('dialog', { name: 'Signaler un problème' });
> 357 |                 await expect(dialog).toBeVisible({ timeout: 10_000 });
      |                                      ^ Error: expect(locator).toBeVisible() failed
  358 |                 await expect(dialog.getByRole('group', { name: 'Motif du signalement' })).toBeVisible();
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
  372 |                 await expect(pp.getByTestId('pause-commandes')).toContainText('Ce restaurant reprend les commandes à');
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