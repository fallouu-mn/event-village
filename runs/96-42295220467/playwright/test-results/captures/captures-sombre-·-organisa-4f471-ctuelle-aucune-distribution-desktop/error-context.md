# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · organisateur >> partenaire-categorie-invitations — Catégorie sans aucun canal : aide factuelle, aucune distribution
- Location: e2e/captures.spec.ts:159:9

# Error details

```
Error: expect(locator).not.toBeChecked() failed

Locator: locator('section').filter({ has: getByRole('checkbox', { name: /^vendue au guichet/i }) }).filter({ hasText: 'Invitations seulement' }).getByRole('checkbox', { name: /^vendue en ligne/i })
Expected: not checked
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "not toBeChecked" locator('section').filter({ has: getByRole('checkbox', { name: /^vendue au guichet/i }) }).filter({ hasText: 'Invitations seulement' }).getByRole('checkbox', { name: /^vendue en ligne/i }) with timeout 15000ms
  - waiting for locator('section').filter({ has: getByRole('checkbox', { name: /^vendue au guichet/i }) }).filter({ hasText: 'Invitations seulement' }).getByRole('checkbox', { name: /^vendue en ligne/i })

```

```yaml
- complementary:
  - link "Event Village, accueil":
    - /url: /
    - text: EVENT VILLAGE
  - navigation "Navigation principale":
    - paragraph: Gestion
    - link "Tableau de bord":
      - /url: /partner/dashboard
      - img
      - text: Tableau de bord
    - link "Événements":
      - /url: /partner/events
      - img
      - text: Événements
    - link "Équipe":
      - /url: /partner/team
      - img
      - text: Équipe
    - paragraph: Outils
    - link "Finances":
      - /url: /partner/finance
      - img
      - text: Finances
    - link "Statistiques":
      - /url: /partner/stats
      - img
      - text: Statistiques
    - link "Scanner les billets":
      - /url: /partner/scan
      - img
      - text: Scanner les billets
    - link "Calendrier":
      - /url: /partner/calendar
      - img
      - text: Calendrier
    - link "Abonnement":
      - /url: /partner/subscription
      - img
      - text: Abonnement
    - link "Profil partenaire":
      - /url: /partner/profile
      - img
      - text: Profil partenaire
    - link "Retour au site":
      - /url: /
      - img
      - text: Retour au site
  - link "Mariama Ndiaye Partenaire":
    - /url: /profile
  - button "Se déconnecter"
  - button "Basculer le thème" [pressed]
- banner:
  - link "Rechercher un événement, un concert, un restaurant…":
    - /url: /explore
  - button "Notifications, 97 non lues": "97"
- main:
  - link "Retour à mes événements":
    - /url: /partner/events
  - text: Publié
  - heading "Modifier l’événement" [level=1]
  - paragraph: Nuit du Sabar — édition d’automne
  - status:
    - paragraph: Modifications encadrées après la validation
    - list:
      - listitem: "Description, programme, informations pratiques, affiche et position : modifiables librement."
      - listitem: "Titre, dates, heures, lieu, ville et adresse : les détenteurs de billets sont prévenus."
      - listitem: "Catégorie d’événement et jauge : verrouillées dès la première vente (la jauge peut seulement augmenter)."
  - navigation "Étapes du formulaire":
    - paragraph: "Étape 4 sur 4 : Billetterie"
    - list:
      - listitem:
        - button "Informations Informations générales"
      - listitem:
        - button "Programme Programme"
      - listitem:
        - button "Accès Accès et informations pratiques"
      - listitem:
        - button "Billets Billetterie"
  - heading "Billetterie" [level=2]
  - paragraph: Chaque catégorie s’enregistre séparément. Le prix ne change plus dès qu’un billet est vendu ou réservé ; la quantité ne descend jamais sous les ventes.
  - region "Carré presse":
    - heading "Carré presse" [level=3]
    - paragraph: Aucun billet vendu · masquée au public
    - button "Supprimer la catégorie Carré presse"
    - text: Nom de la catégorie (obligatoire)
    - textbox "Nom de la catégorie (obligatoire)":
      - /placeholder: "Par exemple : Standard, VIP, Étudiant"
      - text: Carré presse
    - text: Prix (F CFA) (obligatoire)
    - spinbutton "Prix (F CFA) (obligatoire)": "10000"
    - paragraph: Montant entier ; 0 pour une entrée gratuite.
    - text: Quantité mise en vente (obligatoire)
    - spinbutton "Quantité mise en vente (obligatoire)": "10"
    - paragraph: Nombre de billets de cette catégorie (1 à 100 000).
    - text: Maximum de billets par commande
    - spinbutton "Maximum de billets par commande": "10"
    - paragraph: De 1 à 50 billets.
    - text: Début de la vente
    - textbox "Début de la vente": 2026-10-25T21:30
    - paragraph: "Heure de Dakar. Vide : en vente dès la publication."
    - text: Fin de la vente
    - textbox "Fin de la vente"
    - paragraph: Heure de Dakar. Au plus tard à la fin de l’événement.
    - text: Détail affiché aux acheteurs 30 / 300
    - textbox "Détail affiché aux acheteurs":
      - /placeholder: "Par exemple : accès à la zone devant la scène"
      - text: Réservé aux médias accrédités.
    - checkbox "Visible sur la page publique"
    - text: Visible sur la page publique
    - checkbox "En vente" [checked]
    - text: En vente
    - button "Enregistrer la catégorie" [disabled]
  - region "VIP":
    - heading "VIP" [level=3]
    - paragraph: 10 billets vendus
    - text: Nom de la catégorie (obligatoire)
    - textbox "Nom de la catégorie (obligatoire)":
      - /placeholder: "Par exemple : Standard, VIP, Étudiant"
      - text: VIP
    - text: Prix (F CFA) (obligatoire)
    - spinbutton "Prix (F CFA) (obligatoire)" [disabled]: "15000"
    - text: Quantité mise en vente (obligatoire)
    - spinbutton "Quantité mise en vente (obligatoire)": "50"
    - paragraph: "Jamais sous les ventes : 10 billets vendus, 0 en cours de paiement."
    - paragraph: "Prix verrouillé : 10 billets vendus. Créez une autre catégorie pour un nouveau tarif."
    - text: Maximum de billets par commande
    - spinbutton "Maximum de billets par commande": "10"
    - paragraph: De 1 à 50 billets.
    - text: Début de la vente
    - textbox "Début de la vente": 2026-10-25T21:30
    - paragraph: "Heure de Dakar. Vide : en vente dès la publication."
    - text: Fin de la vente
    - textbox "Fin de la vente"
    - paragraph: Heure de Dakar. Au plus tard à la fin de l’événement.
    - text: Détail affiché aux acheteurs 48 / 300
    - textbox "Détail affiché aux acheteurs":
      - /placeholder: "Par exemple : accès à la zone devant la scène"
      - text: Carré assis, entrée dédiée, une boisson offerte.
    - checkbox "Visible sur la page publique" [checked]
    - text: Visible sur la page publique
    - checkbox "En vente" [checked]
    - text: En vente
    - button "Enregistrer la catégorie" [disabled]
  - region "Prévente":
    - heading "Prévente" [level=3]
    - paragraph: 22 billets vendus · hors vente
    - text: Nom de la catégorie (obligatoire)
    - textbox "Nom de la catégorie (obligatoire)":
      - /placeholder: "Par exemple : Standard, VIP, Étudiant"
      - text: Prévente
    - text: Prix (F CFA) (obligatoire)
    - spinbutton "Prix (F CFA) (obligatoire)" [disabled]: "3000"
    - text: Quantité mise en vente (obligatoire)
    - spinbutton "Quantité mise en vente (obligatoire)": "40"
    - paragraph: "Jamais sous les ventes : 22 billets vendus, 0 en cours de paiement."
    - paragraph: "Prix verrouillé : 22 billets vendus. Créez une autre catégorie pour un nouveau tarif."
    - text: Maximum de billets par commande
    - spinbutton "Maximum de billets par commande": "10"
    - paragraph: De 1 à 50 billets.
    - text: Début de la vente
    - textbox "Début de la vente": 2026-10-25T21:30
    - paragraph: "Heure de Dakar. Vide : en vente dès la publication."
    - text: Fin de la vente
    - textbox "Fin de la vente"
    - paragraph: Heure de Dakar. Au plus tard à la fin de l’événement.
    - text: Détail affiché aux acheteurs 26 / 300
    - textbox "Détail affiché aux acheteurs":
      - /placeholder: "Par exemple : accès à la zone devant la scène"
      - text: Tarif réduit, vente close.
    - checkbox "Visible sur la page publique" [checked]
    - text: Visible sur la page publique
    - checkbox "En vente"
    - text: En vente
    - button "Enregistrer la catégorie" [disabled]
  - region "Standard":
    - heading "Standard" [level=3]
    - paragraph: 50 billets vendus, 2 en cours de paiement
    - text: Nom de la catégorie (obligatoire)
    - textbox "Nom de la catégorie (obligatoire)":
      - /placeholder: "Par exemple : Standard, VIP, Étudiant"
      - text: Standard
    - text: Prix (F CFA) (obligatoire)
    - spinbutton "Prix (F CFA) (obligatoire)" [disabled]: "5000"
    - text: Quantité mise en vente (obligatoire)
    - spinbutton "Quantité mise en vente (obligatoire)": "180"
    - paragraph: "Jamais sous les ventes : 50 billets vendus, 2 en cours de paiement."
    - paragraph: "Prix verrouillé : 50 billets vendus, 2 billets en cours de paiement. Créez une autre catégorie pour un nouveau tarif."
    - text: Maximum de billets par commande
    - spinbutton "Maximum de billets par commande": "10"
    - paragraph: De 1 à 50 billets.
    - text: Début de la vente
    - textbox "Début de la vente": 2026-10-25T21:30
    - paragraph: "Heure de Dakar. Vide : en vente dès la publication."
    - text: Fin de la vente
    - textbox "Fin de la vente"
    - paragraph: Heure de Dakar. Au plus tard à la fin de l’événement.
    - text: Détail affiché aux acheteurs 20 / 300
    - textbox "Détail affiché aux acheteurs":
      - /placeholder: "Par exemple : accès à la zone devant la scène"
      - text: Accès à l’esplanade.
    - checkbox "Visible sur la page publique" [checked]
    - text: Visible sur la page publique
    - checkbox "En vente" [checked]
    - text: En vente
    - button "Enregistrer la catégorie" [disabled]
  - button "Ajouter une catégorie"
  - button "Précédent"
  - button "Enregistrer les modifications"
  - paragraph: « Enregistrer les modifications » concerne les informations de l’événement ; chaque catégorie de billets s’enregistre avec son propre bouton.
- alert
```

# Test source

```ts
  408 |     {
  409 |         id: 'mes-billets-recus', titre: 'Mes billets — onglet « Reçus » (transfert entrant à accepter)', role: 'client', needsIds: true,
  410 |         path: () => '/tickets?tab=recus',
  411 |         ready: async ({ page }) => {
  412 |             await expect(page.getByRole('tab', { name: /^reçus/i })).toHaveAttribute('aria-selected', 'true');
  413 |             await expect(page.getByRole('button', { name: /^accepter le billet$/i }).first()).toBeVisible();
  414 |         },
  415 |     },
  416 |     {
  417 |         id: 'preferences-push-active', titre: 'Préférences de notification — push activé sur l’appareil (abonnement simulé)', role: 'client', needsIds: true,
  418 |         path: () => '/profile/notifications', fakePush: 'granted',
  419 |         ready: async ({ page }) => {
  420 |             await preferencesReady(page, /^désactivées$/i);
  421 |             await expectNoPermissionPrompt(page);
  422 |         },
  423 |         actions: async ({ page }) => {
  424 |             const registered = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/push/subscriptions' && r.request().method() === 'POST');
  425 |             await page.getByRole('button', { name: /^activer les notifications$/i }).click();
  426 |             const res = await registered;
  427 |             // Corps lu seulement en cas d'échec, pour l'afficher (run 65 : lecture bloquée sur une réponse 200).
  428 |             if (res.status() !== 200) {
  429 |                 throw new Error(`inscription de l’appareil par POST /api/push/subscriptions : HTTP ${res.status()} ${await res.text()}`);
  430 |             }
  431 |             await expect(page.getByText(/^activées sur cet appareil$/i)).toBeVisible();
  432 |             await expect(page.getByRole('button', { name: /^envoyer une notification d.essai$/i })).toBeVisible();
  433 |             const counters = await fakePushCounters(page);
  434 |             expect(counters.requestPermissionCalls, 'une seule demande d’autorisation, au clic').toBe(1);
  435 |             expect(counters.subscribeCalls, 'un seul abonnement').toBe(1);
  436 |         },
  437 |     },
  438 |     {
  439 |         id: 'preferences-push-refuse', titre: 'Préférences de notification — push refusé dans le navigateur', role: 'client', needsIds: true,
  440 |         path: () => '/profile/notifications', fakePush: 'denied',
  441 |         ready: async ({ page }) => {
  442 |             await preferencesReady(page, /^refusées dans le navigateur$/i);
  443 |             await expect(page.getByRole('button', { name: /^activer les notifications$/i })).toHaveCount(0);
  444 |             await expectNoPermissionPrompt(page);
  445 |         },
  446 |     },
  447 |     {
  448 |         id: 'preferences-push-non-pris-en-charge', titre: 'Préférences de notification — push non pris en charge par le navigateur', role: 'client', needsIds: true,
  449 |         path: () => '/profile/notifications', fakePush: 'unsupported',
  450 |         ready: async ({ page }) => {
  451 |             await preferencesReady(page, /^non prises en charge par ce navigateur$/i);
  452 |             await expect(page.getByRole('button', { name: /^activer les notifications$/i })).toHaveCount(0);
  453 |         },
  454 |     },
  455 |     {
  456 |         id: 'cloche-ouverte', titre: 'Cloche ouverte (non lues d’abord, Tout marquer comme lu)', role: 'client', needsIds: true, path: () => '/tickets',
  457 |         actions: async ({ page }) => {
  458 |             await page.getByRole('button', { name: /^notifications/i }).filter({ visible: true }).first().click();
  459 |             const panel = page.getByRole('region', { name: /^notifications$/i });
  460 |             await expect(panel).toBeVisible();
  461 |             await expect(panel.getByRole('listitem').first()).toBeVisible();
  462 |         },
  463 |     },
  464 |     {
  465 |         id: 'notifications-vide', titre: 'Notifications du client — aucune notification', role: 'client', needsIds: true, path: () => '/notifications',
  466 |         stubResponse: { url: /\/api\/notifications(\?|$)/, status: 200, body: { notifications: [], unreadCount: 0, total: 0, page: 1, pageSize: 20 } },
  467 |         ready: async ({ page }) => { await expect(page.getByText('Aucune notification', { exact: true })).toBeVisible(); },
  468 |     },
  469 |     { id: 'notifications', titre: 'Notifications du client', role: 'client', needsIds: true, path: () => '/notifications' },
  470 |     {
  471 |         id: 'notifications-erreur', titre: 'Notifications du client — état d’erreur', role: 'client', needsIds: true, path: () => '/notifications',
  472 |         injectError: /\/api\/notifications(\?|$)/, ready: expectRetry,
  473 |     },
  474 |     // ── Organisateur ────────────────────────────────────────────────────────
  475 |     { id: 'partenaire-evenements', titre: 'Liste des événements de l’organisateur', role: 'organisateur', needsIds: true, path: () => '/partner/events' },
  476 |     {
  477 |         id: 'partenaire-evenements-annules', titre: 'Liste de l’organisateur — onglet Annulé', role: 'organisateur', needsIds: true, path: () => '/partner/events',
  478 |         actions: async ({ page }) => openTab(page, /^annulé/i),
  479 |     },
  480 |     {
  481 |         id: 'partenaire-evenements-erreur', titre: 'Liste de l’organisateur — état d’erreur', role: 'organisateur', needsIds: true, path: () => '/partner/events',
  482 |         injectError: /\/api\/partner\/events(\/overview)?(\?.*)?$/, ready: expectRetry,
  483 |     },
  484 |     { id: 'partenaire-creation', titre: 'Création d’un événement (formulaire partagé)', role: 'organisateur', needsIds: true, path: () => '/partner/events/new' },
  485 |     {
  486 |         id: 'partenaire-edition', titre: 'Édition d’un événement publié avec ventes (champs verrouillés)', role: 'organisateur', needsIds: true,
  487 |         path: (i) => `/partner/events/${ids(i).events.publie.id}/edit`,
  488 |     },
  489 |     {
  490 |         id: 'partenaire-categorie-canaux', titre: 'Catégorie « Carré presse » : deux canaux, sur place uniquement', role: 'organisateur', needsIds: true,
  491 |         path: (i) => `/partner/events/${ids(i).events.ceSoir.id}/edit`,
  492 |         actions: async ({ page }) => {
  493 |             await openTicketingStep(page);
  494 |             const card = categorySections(page).filter({ has: page.getByRole('heading', { name: 'Carré presse', exact: true }) });
  495 |             await expect(card.getByRole('checkbox', { name: ONLINE_BOX })).not.toBeChecked();
  496 |             await expect(card.getByRole('checkbox', { name: COUNTER_BOX })).toBeChecked();
  497 |             await expect(card.getByText('Sur place uniquement').first()).toBeVisible();
  498 |             await revealCenter(card.getByRole('checkbox', { name: ONLINE_BOX }));
  499 |         },
  500 |     },
  501 |     {
  502 |         id: 'partenaire-categorie-invitations', titre: 'Catégorie sans aucun canal : aide factuelle, aucune distribution', role: 'organisateur', needsIds: true,
  503 |         path: (i) => `/partner/events/${ids(i).events.ceSoir.id}/edit`,
  504 |         actions: async ({ page }) => {
  505 |             await openTicketingStep(page);
  506 |             // Ligne ajoutée au seed par fix(8.0-seed) (L80) : son nom n'est pas fixé par le contrat, seul son résumé l'est
  507 |             const card = categorySections(page).filter({ hasText: 'Invitations seulement' });
> 508 |             await expect(card.getByRole('checkbox', { name: ONLINE_BOX })).not.toBeChecked();
      |                                                                                ^ Error: expect(locator).not.toBeChecked() failed
  509 |             await expect(card.getByRole('checkbox', { name: COUNTER_BOX })).not.toBeChecked();
  510 |             await expect(card.getByText('Cette catégorie n’est vendue ni en ligne ni au guichet. L’application n’envoie pas encore d’invitations : aucun billet ne sera distribué pour le moment.')).toBeVisible();
  511 |             await revealCenter(card.getByRole('checkbox', { name: ONLINE_BOX }));
  512 |         },
  513 |     },
  514 |     {
  515 |         id: 'partenaire-rapport-cloture', titre: 'Rapport de clôture d’un événement terminé (modale du tableau de bord)', role: 'organisateur', needsIds: true,
  516 |         path: () => '/partner/dashboard',
  517 |         actions: async (c) => {
  518 |             const { title } = ids(c.ids).events.termine;
  519 |             const button = c.page.locator('tr, li, article')
  520 |                 .filter({ hasText: title })
  521 |                 .getByRole('button', { name: /^clôture$/i })
  522 |                 .filter({ visible: true })
  523 |                 .first();
  524 |             const loaded = c.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/partner/reports/closing');
  525 |             await button.click();
  526 |             const report = await loaded;
  527 |             expect(report.status(), `rapport de clôture de « ${title} »`).toBe(200);
  528 |             const dialog = c.page.getByRole('dialog');
  529 |             await expect(dialog).toBeVisible();
  530 |             await expect(dialog.getByText(title).first()).toBeVisible();
  531 |         },
  532 |     },
  533 |     tabScreen('pilotage-apercu', 'Pilotage — Aperçu', /^aperçu/i),
  534 |     tabScreen('pilotage-ventes', 'Pilotage — Ventes', /^ventes/i),
  535 |     {
  536 |         id: 'pilotage-rembourser-billet', titre: 'Pilotage — Ventes : fiche d’un billet à rembourser', role: 'organisateur', needsIds: true, path: pilotage('ceSoir'),
  537 |         actions: async (c) => {
  538 |             const { number } = ids(c.ids).tickets.manualLookup;
  539 |             await openTab(c.page, /^ventes/i);
  540 |             await c.page.getByLabel(/^numéro du billet/i).fill(number);
  541 |             const found = c.page.waitForResponse((r) => new URL(r.url()).pathname.endsWith('/tickets/lookup'));
  542 |             await c.page.getByRole('button', { name: /^rechercher/i }).click();
  543 |             expect((await found).status(), `recherche du billet ${number}`).toBe(200);
  544 |             const refund = c.page.getByRole('button', { name: /^rembourser/i }).filter({ visible: true }).first();
  545 |             await expect(refund).toBeVisible();
  546 |             await revealCenter(refund);
  547 |         },
  548 |     },
  549 |     tabScreen('pilotage-entrees', 'Pilotage — Entrées en direct', /^entrées/i),
  550 |     tabScreen('pilotage-equipe', 'Pilotage — Équipe', /^équipe/i),
  551 |     tabScreen('pilotage-caisse', 'Pilotage — Caisse', /^caisse/i),
  552 |     tabScreen('pilotage-cloture', 'Pilotage — Clôture et export', /^clôture/i),
  553 |     {
  554 |         id: 'pilotage-annulation', titre: 'Modale « Annuler l’événement » (impact, titre à retaper)', role: 'organisateur', needsIds: true, path: pilotage('publie'),
  555 |         actions: async ({ page }) => {
  556 |             await page.getByRole('button', { name: /annuler l[’']événement/i }).click();
  557 |             await expect(page.getByRole('dialog').or(page.getByRole('alertdialog'))).toBeVisible();
  558 |         },
  559 |     },
  560 |     {
  561 |         id: 'pilotage-remboursements', titre: 'Événement annulé — avancement des remboursements', role: 'organisateur', needsIds: true, path: pilotage('annule'),
  562 |         ready: async ({ page }) => { await expect(page.getByText(/remboursements/i).first()).toBeVisible(); },
  563 |     },
  564 |     {
  565 |         id: 'pilotage-erreur', titre: 'Pilotage — état d’erreur', role: 'organisateur', needsIds: true, path: pilotage('ceSoir'),
  566 |         injectError: /\/api\/partner\/events\/[^/]+\/pilotage\/overview(\?.*)?$/, ready: expectRetry,
  567 |     },
  568 |     // ── Administration ──────────────────────────────────────────────────────
  569 |     { id: 'admin-evenements', titre: 'Administration — événements (filtres, pagination)', role: 'admin', needsIds: true, path: () => '/admin/events' },
  570 |     { id: 'admin-evenements-en-attente', titre: 'Administration — file de validation', role: 'admin', needsIds: true, path: () => '/admin/events?status=EN_ATTENTE' },
  571 |     {
  572 |         id: 'admin-evenements-erreur', titre: 'Administration — état d’erreur', role: 'admin', needsIds: true, path: () => '/admin/events',
  573 |         injectError: /\/api\/admin\/events(\?.*)?$/, ready: expectRetry,
  574 |     },
  575 |     { id: 'admin-fiche-en-attente', titre: 'Administration — fiche complète avant validation', role: 'admin', needsIds: true, path: (i) => `/admin/events/${ids(i).events.enAttente.id}` },
  576 |     { id: 'admin-fiche-suspendu', titre: 'Administration — fiche d’un événement suspendu (motif, réactiver)', role: 'admin', needsIds: true, path: (i) => `/admin/events/${ids(i).events.suspendu.id}` },
  577 |     {
  578 |         id: 'admin-notifications', titre: 'Administration — supervision des notifications (liste filtrable, compteurs)', role: 'admin', needsIds: true,
  579 |         path: () => '/admin/notifications',
  580 |         ready: async ({ page }) => {
  581 |             await expectHeading(page, /^notifications$/i);
  582 |             await expect(page.getByRole('link', { name: /^voir le détail/i }).first()).toBeVisible();
  583 |         },
  584 |         actions: expectFrenchDateField,
  585 |     },
  586 |     {
  587 |         id: 'admin-notifications-detail', titre: 'Administration — détail d’une notification en échec (Relancer)', role: 'admin', needsIds: true,
  588 |         path: (i) => `/admin/notifications/${ids(i).notifications.failedId}`,
  589 |         ready: async ({ page }) => { await expect(page.getByRole('button', { name: /^relancer$/i })).toBeVisible(); },
  590 |     },
  591 |     {
  592 |         id: 'admin-notifications-erreur', titre: 'Administration — supervision des notifications, état d’erreur', role: 'admin', needsIds: true,
  593 |         path: () => '/admin/notifications',
  594 |         injectError: /\/api\/admin\/notifications(\?.*)?$/,
  595 |         // L'état d'erreur est sous les compteurs et les filtres : à 390 px, il était hors de l'image (run 77)
  596 |         ready: async (c) => {
  597 |             await expectRetry(c);
  598 |             await revealCenter(c.page.getByRole('button', { name: /réessayer/i }));
  599 |         },
  600 |     },
  601 |     {
  602 |         id: 'admin-services-desactive', titre: 'Administration — services : mention « Service désactivé » (interrupteur fermé)', role: 'admin', needsIds: true,
  603 |         path: () => '/admin/services?tab=salles',
  604 |         ready: async ({ page }) => {
  605 |             await expect(page.getByRole('tab', { name: /^salles de fête/i })).toHaveAttribute('aria-selected', 'true');
  606 |             await expect(page.getByText('Service désactivé', { exact: true })).toBeVisible();
  607 |             await expect(page.getByText('Ce service est fermé par son interrupteur : il est masqué au public. Les données restent consultables ici.')).toBeVisible();
  608 |         },
```