# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · client >> paiement-modale — Paiement — modale d’achat ouverte (opérateur, numéro)
- Location: e2e/captures.spec.ts:151:9

# Error details

```
Error: locator.click: Error: strict mode violation: getByRole('button', { name: /^acheter/i }) resolved to 2 elements:
    1) <button class="inline-flex items-center justify-center font-semibold tracking-tight cursor-pointer select-none transition-colors duration-200 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface bg-brand text-on-brand hover:bg-brand-hover border border-transparent shadow-sm min-h-12 px-6 text-base rounded-2xl gap-2.5 w-full">…</button> aka getByRole('button', { name: 'Acheter 1 billet (5 250 F CFA)' })
    2) <button class="inline-flex items-center justify-center font-semibold tracking-tight cursor-pointer select-none transition-colors duration-200 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface bg-brand text-on-brand hover:bg-brand-hover border border-transparent shadow-sm min-h-12 px-6 text-base rounded-2xl gap-2.5 w-full">…</button> aka getByRole('button', { name: 'Acheter (5 250 F CFA)' })

Call log:
  - waiting for getByRole('button', { name: /^acheter/i })

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
            - /url: /
        - generic [ref=e16]:
          - button "Notifications, 8 non lues" [ref=e18] [cursor=pointer]:
            - generic [ref=e22]: "8"
          - button "Basculer le thème" [pressed] [ref=e24] [cursor=pointer]
          - link "Mon profil (Fatou Mbaye)" [ref=e32] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e33]: FM
      - main [ref=e35]:
        - generic [ref=e37]:
          - generic [ref=e38]:
            - link "Retour aux événements" [ref=e39] [cursor=pointer]:
              - /url: /explore
            - generic [ref=e44]:
              - status [ref=e45]: En direct
              - button "Partager l’événement" [ref=e47] [cursor=pointer]
          - generic [ref=e55]:
            - generic [ref=e56]:
              - img "Affiche de l’événement Nuit du Sabar — édition d’automne" [ref=e58]
              - generic [ref=e59]:
                - generic [ref=e60]: Concerts & Musique
                - heading "Nuit du Sabar — édition d’automne" [level=1] [ref=e63]
                - paragraph [ref=e64]: Organisé par Baobab Scène
              - generic [ref=e65]:
                - generic [ref=e70]:
                  - paragraph [ref=e71]: Date et heure
                  - generic [ref=e72]: Mercredi 4 novembre 2026 à 18:30
                - generic [ref=e78]:
                  - paragraph [ref=e79]: Lieu
                  - generic [ref=e80]: Esplanade de la Corniche Ouest, Dakar
              - generic [ref=e81]:
                - heading "À propos de l’événement" [level=2] [ref=e82]
                - paragraph [ref=e83]: Une nuit entière de sabar avec quatre troupes de percussionnistes et danseurs, en plein air face à l’océan. Restauration sur place, accès aux personnes à mobilité réduite par l’entrée principale.
              - generic [ref=e84]:
                - heading "Programme" [level=2] [ref=e85]
                - list [ref=e89]:
                  - listitem [ref=e90]:
                    - generic [ref=e92]:
                      - paragraph [ref=e93]: 19:30
                      - generic [ref=e94]: Activité
                    - paragraph [ref=e96]: Ouverture des portes
                  - listitem [ref=e97]:
                    - generic [ref=e99]:
                      - paragraph [ref=e100]: 20:30
                      - generic [ref=e101]: Artiste
                    - paragraph [ref=e103]: Première partie
                    - paragraph [ref=e104]: Troupe Kër Gëstu
                  - listitem [ref=e105]:
                    - generic [ref=e107]:
                      - paragraph [ref=e108]: 22:00
                      - generic [ref=e109]: Artiste
                    - paragraph [ref=e111]: Grand cercle de sabar
                    - paragraph [ref=e112]: Ensemble Ndawrabine des Parcelles
                  - listitem [ref=e113]:
                    - generic [ref=e115]:
                      - paragraph [ref=e116]: 23:30
                      - generic [ref=e117]: Activité
                    - paragraph [ref=e119]: Bœuf final avec le public
              - generic [ref=e120]:
                - heading "Lieu et accès" [level=2] [ref=e121]
                - generic [ref=e126]:
                  - paragraph [ref=e127]: Esplanade de la Corniche Ouest
                  - paragraph [ref=e128]: Esplanade de la Corniche Ouest, Dakar
                - link "Voir l’itinéraire" [ref=e131] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=14.6833,-17.4676
                - generic [ref=e141]:
                  - generic [ref=e148]:
                    - paragraph [ref=e149]: Stationnement
                    - generic [ref=e150]: Stationnement surveillé à proximité.
                  - generic [ref=e156]:
                    - paragraph [ref=e157]: Règlement et consignes
                    - generic [ref=e158]: Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.
              - generic [ref=e161]:
                - paragraph [ref=e162]: Organisateur
                - heading "Baobab Scène" [level=2] [ref=e163]
            - complementary [ref=e164]:
              - generic [ref=e165]:
                - heading "Choisissez vos billets" [level=2] [ref=e166]
                - paragraph [ref=e167]: Places et disponibilités mises à jour en direct.
              - list [ref=e168]:
                - listitem [ref=e169]:
                  - generic [ref=e170]:
                    - generic [ref=e171]:
                      - heading "VIP" [level=3] [ref=e172]
                      - paragraph [ref=e173]: 15 000 F CFA
                      - paragraph [ref=e174]: Disponible
                      - paragraph [ref=e175]: Carré assis, entrée dédiée, une boisson offerte.
                    - group "Quantité VIP" [ref=e176]:
                      - button "Retirer un billet VIP" [disabled] [ref=e177]
                      - status [ref=e180]: "0"
                      - button "Ajouter un billet VIP" [ref=e181] [cursor=pointer]
                - listitem [ref=e184]:
                  - generic [ref=e185]:
                    - generic [ref=e186]:
                      - heading "Standard" [level=3] [ref=e187]
                      - paragraph [ref=e188]: 5 000 F CFA
                      - paragraph [ref=e189]: Disponible
                      - paragraph [ref=e190]: Accès à l’esplanade.
                    - group "Quantité Standard" [ref=e191]:
                      - button "Retirer un billet Standard" [ref=e192] [cursor=pointer]
                      - status [ref=e195]: "1"
                      - button "Ajouter un billet Standard" [active] [ref=e196] [cursor=pointer]
                  - paragraph [ref=e199]: "1 × 5 000 F CFA : 5 000 F CFA"
              - generic [ref=e200]:
                - generic [ref=e201]:
                  - generic [ref=e202]:
                    - term [ref=e203]: Billets
                    - definition [ref=e204]: 5 000 F CFA
                  - generic [ref=e205]:
                    - term [ref=e206]: Frais de service
                    - definition [ref=e207]: 250 F CFA
                - generic [ref=e208]:
                  - generic [ref=e209]: Total (1 billet)
                  - generic [ref=e210]: 5 250 F CFA
                - button "Acheter 1 billet (5 250 F CFA)" [ref=e211] [cursor=pointer]
                - paragraph [ref=e216]: Paiement Wave ou Orange Money. Frais de service calculés par Event Village sur chaque billet.
                - paragraph [ref=e217]: Billet avec QR code émis dès le paiement
          - button "Acheter (5 250 F CFA)" [ref=e222] [cursor=pointer]
    - navigation "Navigation rapide" [ref=e227]:
      - generic [ref=e228]:
        - link "Accueil" [ref=e229] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e234] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e239] [cursor=pointer]:
          - /url: /tickets
        - link "Solde" [ref=e243] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e248]
```

# Test source

```ts
  467 |             await presentToFakeDetector(c.page, demoPayload(c));
  468 |             await expect(c.page.locator('[data-scan-state="slow"]')).toBeVisible({ timeout: 10_000 });
  469 |         },
  470 |     },
  471 |     {
  472 |         id: 'scanner-hors-ligne', titre: 'Scanner — hors ligne (bandeau permanent, rien n’est validé)', role: 'controleur', needsIds: true,
  473 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: 'barcode-detector',
  474 |         ready: async ({ page }) => startScanner(page),
  475 |         actions: async ({ page, context, guard }) => {
  476 |             guard.freeze(); // passage hors ligne volontaire après le chargement
  477 |             await context.setOffline(true);
  478 |             await expect(page.locator('[data-scan-state="offline"]')).toBeVisible({ timeout: 10_000 });
  479 |         },
  480 |     },
  481 |     {
  482 |         id: 'scanner-saisie-manuelle', titre: 'Scanner — saisie manuelle, étape « Vérifier » (titulaire affiché)', role: 'controleur', needsIds: true,
  483 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  484 |         ready: async ({ page }) => startScanner(page),
  485 |         actions: async (c) => {
  486 |             const number = ids(c.ids).tickets.manualLookup.number;
  487 |             await c.page.getByRole('button', { name: /^saisie manuelle$/i }).click();
  488 |             await c.page.getByLabel(/^numéro du billet/i).fill(number);
  489 |             await c.page.getByRole('button', { name: /^vérifier le billet$/i }).click();
  490 |             await expect(c.page.getByRole('heading', { name: new RegExp(`billet ${number}`, 'i') })).toBeVisible();
  491 |             await expect(c.page.getByText(/^titulaire$/i)).toBeVisible();
  492 |         },
  493 |     },
  494 |     {
  495 |         id: 'scanner-guichet', titre: 'Scanner — onglet Guichet, devis servi par le serveur', role: 'controleur', needsIds: true,
  496 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  497 |         ready: async ({ page }) => startScanner(page),
  498 |         actions: async ({ page }) => {
  499 |             await openTab(page, /^guichet$/i);
  500 |             await page.getByRole('button', { name: /^ajouter un billet standard$/i }).click();
  501 |             await expect(page.getByRole('region', { name: /^total à encaisser$/i })).toBeVisible();
  502 |         },
  503 |     },
  504 |     {
  505 |         id: 'caisse-ouverture', titre: 'Caisse — ouverture (fonds de caisse, PIN facultatif)', role: 'controleur', needsIds: true,
  506 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  507 |         stubResponses: [{ url: /\/api\/controller\/shifts\/active(\?.*)?$/, method: 'GET', status: 200, body: { success: true, shift: null, expected_cash_in_drawer: null } }],
  508 |         ready: async ({ page }) => startScanner(page),
  509 |         actions: async ({ page }) => {
  510 |             await openTab(page, /^caisse$/i);
  511 |             await page.getByRole('button', { name: /^ouvrir ma caisse$/i }).click();
  512 |             await expect(page.getByRole('dialog', { name: /^ouvrir ma caisse$/i })).toBeVisible();
  513 |         },
  514 |     },
  515 |     {
  516 |         id: 'caisse-cloture-ecart', titre: 'Caisse — clôture avec écart constaté par le serveur (justification, PIN)', role: 'controleur', needsIds: true,
  517 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  518 |         stubResponses: [{
  519 |             url: /\/api\/controller\/shifts\/close$/, method: 'POST', status: 409,
  520 |             body: { success: false, code: 'JUSTIFICATION_REQUIRED', discrepancy: -2000, error: 'Écart constaté : justification et code PIN du régisseur requis.' },
  521 |         }],
  522 |         allowFailures: [/\/api\/controller\/shifts\/close$/],
  523 |         ready: async ({ page }) => startScanner(page),
  524 |         actions: async ({ page }) => {
  525 |             await openTab(page, /^caisse$/i);
  526 |             await page.getByRole('button', { name: /^clôturer ma caisse$/i }).click();
  527 |             const dialog = page.getByRole('dialog', { name: /^clôturer ma caisse$/i });
  528 |             await expect(dialog).toBeVisible();
  529 |             await dialog.getByLabel(/^espèces encaissées comptées/i).fill('8000');
  530 |             await dialog.getByRole('button', { name: /^clôturer la caisse$/i }).click();
  531 |             await expect(dialog.getByText(/^écart constaté par le serveur$/i)).toBeVisible();
  532 |             await expect(dialog.getByLabel(/^justification de l.écart/i)).toBeVisible();
  533 |         },
  534 |     },
  535 |     {
  536 |         id: 'caisse-ticket-z', titre: 'Caisse — Z de caisse après la clôture', role: 'controleur', needsIds: true,
  537 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  538 |         stubResponses: [{
  539 |             url: /\/api\/controller\/shifts\/close$/, method: 'POST', status: 200,
  540 |             body: {
  541 |                 success: true,
  542 |                 summary: {
  543 |                     shift_id: 'b3d8d076-e4ab-4fc7-9a9d-7c8b9eafc0c6', controller_id: 'c4e9e187-f5bc-40d8-8bae-8d9caf0b1d17',
  544 |                     controller_name: 'Ibrahima Gueye', controller_phone: '+221700000106', event_id: 'd5fae298-06cd-41e9-9cbf-9eadb01c2e28',
  545 |                     event_title: 'Nuit du Sabar — édition d’automne', opened_at: '2026-11-04T18:30:00.000Z', closed_at: '2026-11-04T23:45:00.000Z',
  546 |                     opening_float_amount: 10000, expected_cash_total: 23000, declared_cash_total: 21000, discrepancy_amount: -2000,
  547 |                     discrepancy_justification: 'Monnaie rendue en trop à un spectateur, signalée au régisseur.', status: 'CLOTURE', closing_confirmed_by_pin: true,
  548 |                 },
  549 |             },
  550 |         }],
  551 |         ready: async ({ page }) => startScanner(page),
  552 |         actions: async ({ page }) => {
  553 |             await openTab(page, /^caisse$/i);
  554 |             await page.getByRole('button', { name: /^clôturer ma caisse$/i }).click();
  555 |             const dialog = page.getByRole('dialog', { name: /^clôturer ma caisse$/i });
  556 |             await dialog.getByLabel(/^espèces encaissées comptées/i).fill('21000');
  557 |             await dialog.getByRole('button', { name: /^clôturer la caisse$/i }).click();
  558 |             await expect(page.getByRole('dialog', { name: /^caisse clôturée$/i })).toBeVisible();
  559 |         },
  560 |     },
  561 |     // ── Lot 7 : paiement et inscription (7.3, E4) ───────────────────────────
  562 |     {
  563 |         id: 'paiement-modale', titre: 'Paiement — modale d’achat ouverte (opérateur, numéro)', role: 'client', needsIds: true,
  564 |         path: (i) => `/events/${ids(i).events.ceSoir.id}`,
  565 |         actions: async ({ page }) => {
  566 |             await page.getByRole('button', { name: /^ajouter un billet standard/i }).click();
> 567 |             await page.getByRole('button', { name: /^acheter/i }).click();
      |                                                                   ^ Error: locator.click: Error: strict mode violation: getByRole('button', { name: /^acheter/i }) resolved to 2 elements:
  568 |             await expect(page.getByRole('dialog').or(page.getByRole('alertdialog'))).toBeVisible();
  569 |         },
  570 |     },
  571 |     {
  572 |         id: 'paiement-attente', titre: 'Paiement — en attente de validation chez l’opérateur', role: 'client', needsIds: true,
  573 |         path: (i) => `/paiement/${ids(i).payments.pending}`,
  574 |         ready: async ({ page }) => {
  575 |             await expect(page.locator('#payment-status-title')).toBeVisible({ timeout: 30_000 });
  576 |         },
  577 |     },
  578 |     {
  579 |         id: 'paiement-succes', titre: 'Paiement — confirmé (billets émis, redirection annulable)', role: 'client', needsIds: true,
  580 |         path: (i) => `/paiement/${ids(i).payments.success}`, slowTimers: { minDelayMs: 1000, factor: 100 },
  581 |         ready: async ({ page }) => {
  582 |             await expect(page.locator('#payment-status-title')).toHaveText(/paiement confirmé/i, { timeout: 30_000 });
  583 |         },
  584 |     },
  585 |     {
  586 |         id: 'paiement-echec', titre: 'Paiement — refusé (Réessayer le paiement)', role: 'client', needsIds: true,
  587 |         path: (i) => `/paiement/${ids(i).payments.failed}`,
  588 |         ready: async ({ page }) => {
  589 |             await expect(page.locator('#payment-status-title')).toHaveText(/n.a pas abouti/i, { timeout: 30_000 });
  590 |         },
  591 |     },
  592 |     {
  593 |         id: 'inscription-code', titre: 'Inscription — étape 2 : code reçu et profil (envoi du code simulé)', role: 'anonyme', needsIds: false, path: () => '/register',
  594 |         stubResponses: [{ url: /\/api\/auth\/register\/start$/, method: 'POST', status: 200, body: { ok: true, phone: '+221771234567', resend_after: 60 } }],
  595 |         ready: async ({ page }) => { await expectHeading(page, /^créer un compte$/i); },
  596 |         actions: async ({ page }) => {
  597 |             await page.getByLabel(/^numéro de téléphone/i).fill('77 123 45 67');
  598 |             await page.getByRole('button', { name: /^recevoir le code par sms$/i }).click();
  599 |             await expect(page.getByText(/^code reçu par sms$/i)).toBeVisible();
  600 |         },
  601 |     },
  602 |     // ── Lot 7 : pages partenaire migrées (7.4, E5 ; 7.0 f, E1) ──────────────
  603 |     {
  604 |         id: 'partenaire-inscription', titre: 'Inscription d’un partenaire (système de design)', role: 'anonyme', needsIds: false, path: () => '/partner/register',
  605 |         ready: async ({ page }) => expectPageTitle(page),
  606 |     },
  607 |     { id: 'partenaire-tableau-de-bord', titre: 'Partenaire — tableau de bord (chiffres servis par le serveur)', role: 'organisateur', needsIds: true, path: () => '/partner/dashboard', ready: async ({ page }) => expectPageTitle(page) },
  608 |     { id: 'partenaire-finances', titre: 'Partenaire — finances (écritures, retraits)', role: 'organisateur', needsIds: true, path: () => '/partner/finance', ready: async ({ page }) => expectPageTitle(page) },
  609 |     { id: 'partenaire-equipe', titre: 'Partenaire — équipe (contrôleurs et affectations)', role: 'organisateur', needsIds: true, path: () => '/partner/team', ready: async ({ page }) => expectPageTitle(page) },
  610 |     { id: 'partenaire-profil', titre: 'Partenaire — profil de l’organisateur', role: 'organisateur', needsIds: true, path: () => '/partner/profile', ready: async ({ page }) => expectPageTitle(page) },
  611 |     { id: 'partenaire-abonnement', titre: 'Partenaire — abonnement et période d’essai', role: 'organisateur', needsIds: true, path: () => '/partner/subscription', ready: async ({ page }) => expectPageTitle(page) },
  612 |     {
  613 |         id: 'partenaire-premiers-pas', titre: 'Partenaire validé sans événement — première utilisation (étapes cochées par le serveur)', role: 'partenaire-premiers-pas', needsIds: true,
  614 |         path: () => '/partner/dashboard',
  615 |         ready: async ({ page }) => {
  616 |             await expect(page.getByRole('heading', { name: /^publiez votre premier événement$/i })).toBeVisible({ timeout: 30_000 });
  617 |         },
  618 |     },
  619 |     // ── Lot 7 : pages masquées par les interrupteurs (7.3, D55) ─────────────
  620 |     {
  621 |         id: 'page-masquee-salles', titre: 'Salles de fête masquées (interrupteur fermé) : page introuvable propre', role: 'anonyme', needsIds: false, path: () => '/halls',
  622 |         expectStatus: 404, allowFailures: [/\/halls(\?.*)?$/],
  623 |         ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
  624 |     },
  625 |     {
  626 |         id: 'page-masquee-commandes', titre: 'Commandes masquées (trois interrupteurs fermés) : page introuvable propre', role: 'client', needsIds: true, path: () => '/orders',
  627 |         expectStatus: 404, allowFailures: [/\/orders(\?.*)?$/],
  628 |         ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
  629 |     },
  630 |     // ── Lot 7 : restes d'interface du lot 6 (7.0 f, E1) ─────────────────────
  631 |     {
  632 |         id: 'controleur-activation', titre: 'Activation d’un compte contrôleur (lien de l’invitation)', role: 'anonyme', needsIds: false,
  633 |         path: () => '/controller/setup?phone=%2B221700000199', views: DARK_VIEWS,
  634 |         ready: async ({ page }) => { await expectHeading(page, /^activer votre compte contrôleur$/i); },
  635 |     },
  636 |     {
  637 |         id: 'controleur-profil', titre: 'Profil du contrôleur (événements assignés, mot de passe)', role: 'controleur', needsIds: true, path: () => '/controller/profile', views: DARK_VIEWS,
  638 |         ready: async ({ page }) => { await expectHeading(page, /^mon profil$/i); },
  639 |     },
  640 |     {
  641 |         id: 'admin-campagnes', titre: 'Administration — campagnes de communication', role: 'admin', needsIds: true, path: () => '/admin/communications',
  642 |         ready: async ({ page }) => { await expectHeading(page, /^campagnes de communication$/i); },
  643 |     },
  644 |     {
  645 |         id: 'aide-transfert', titre: 'Mes billets — aide « Comment marche le transfert ? »', role: 'client', needsIds: true, path: () => '/tickets',
  646 |         actions: async ({ page }) => {
  647 |             await page.getByRole('button', { name: /^comment marche le transfert/i }).click();
  648 |             await expect(page.getByRole('dialog')).toBeVisible();
  649 |         },
  650 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  651 |     },
  652 |     { id: 'portefeuille', titre: 'Portefeuille du client (solde, parrainage)', role: 'client', needsIds: true, path: () => '/wallet', ready: async ({ page }) => expectPageTitle(page) },
  653 | ];
  654 | 
```