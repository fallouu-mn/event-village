# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · organisateur >> pilotage-rembourser-billet — Pilotage — Ventes : fiche d’un billet à rembourser
- Location: e2e/captures.spec.ts:159:9

# Error details

```
TimeoutError: locator.fill: Timeout 15000ms exceeded.
Call log:
  - waiting for getByLabel(/^numéro du billet/i)

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - link "Event Village, accueil" [ref=e5] [cursor=pointer]:
        - /url: /
        - generic [ref=e11]:
          - generic [ref=e12]: EVENT
          - generic [ref=e13]: VILLAGE
      - navigation "Navigation principale" [ref=e14]:
        - generic [ref=e15]:
          - paragraph [ref=e16]: Gestion
          - generic [ref=e17]:
            - link "Tableau de bord" [ref=e18] [cursor=pointer]:
              - /url: /partner/dashboard
            - link "Événements" [ref=e25] [cursor=pointer]:
              - /url: /partner/events
            - link "Équipe" [ref=e29] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=e36]:
          - paragraph [ref=e37]: Outils
          - generic [ref=e38]:
            - link "Finances" [ref=e39] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=e43] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=e47] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=e55] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=e59] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=e64] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=e70] [cursor=pointer]:
          - /url: /
      - generic [ref=e76]:
        - link "Mariama Ndiaye Partenaire" [ref=e77] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e78]: MN
          - generic [ref=e79]:
            - generic [ref=e80]: Mariama Ndiaye
            - generic [ref=e81]: Partenaire
        - generic [ref=e82]:
          - button "Se déconnecter" [ref=e83] [cursor=pointer]
          - button "Basculer le thème" [pressed] [ref=e88] [cursor=pointer]
    - generic [ref=e96]:
      - banner [ref=e97]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e99] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 97 non lues" [ref=e106] [cursor=pointer]:
          - generic [ref=e110]: "97"
      - main [ref=e111]:
        - generic [ref=e113]:
          - generic [ref=e114]:
            - link "Mes événements" [ref=e116] [cursor=pointer]:
              - /url: /partner/events
            - generic [ref=e121]:
              - generic [ref=e122]:
                - generic [ref=e123]:
                  - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=e124]': Publié
                  - status [ref=e127]: En direct
                - heading "Nuit du Sabar — édition d’automne" [level=1] [ref=e129]
                - paragraph [ref=e130]:
                  - generic [ref=e131]:
                    - generic [ref=e132]: ven. 6 nov. 2026 à 20:15
                    - generic [ref=e135]: Esplanade de la Corniche Ouest, Dakar
              - generic [ref=e139]:
                - link "Modifier" [ref=e140] [cursor=pointer]:
                  - /url: /partner/events/e872d2a3-e91e-4f3b-b293-18547fdd5ac5/edit
                - button "Annuler l’événement" [ref=e146] [cursor=pointer]
          - generic [ref=e152]:
            - tablist "Rubriques du pilotage" [ref=e155]:
              - tab "Aperçu" [ref=e156] [cursor=pointer]
              - tab "Ventes" [active] [selected] [ref=e158] [cursor=pointer]
              - tab "Entrées" [ref=e160] [cursor=pointer]
              - tab "Équipe" [ref=e162] [cursor=pointer]
              - tab "Caisse" [ref=e164] [cursor=pointer]
              - tab "Clôture" [ref=e166] [cursor=pointer]
            - tabpanel "Ventes" [ref=e168]:
              - generic [ref=e169]:
                - region [ref=e170]:
                  - generic [ref=e172]:
                    - heading "Par catégorie" [level=2] [ref=e173]
                    - paragraph [ref=e174]: Restants = quota de la catégorie moins les ventes, les invitations et les paiements en cours. Une catégorie inactive n’a plus de place en vente.
                  - table [ref=e177]:
                    - caption [ref=e178]: Ventes par catégorie de billets
                    - rowgroup [ref=e179]:
                      - row [ref=e180]:
                        - columnheader "Catégorie" [ref=e181]
                        - columnheader "Prix" [ref=e182]
                        - columnheader "Vendus" [ref=e183]
                        - columnheader "En cours de paiement" [ref=e184]
                        - columnheader "Invitations" [ref=e185]
                        - columnheader "Restants" [ref=e186]
                        - columnheader "Recettes en ligne" [ref=e187]
                    - rowgroup [ref=e188]:
                      - row [ref=e189]:
                        - cell "Prévente(inactive)" [ref=e190]
                        - cell "3 000 F CFA" [ref=e192]
                        - cell "22" [ref=e193]
                        - cell "0" [ref=e194]
                        - cell "0" [ref=e195]
                        - cell "Vente fermée" [ref=e196]
                        - cell "66 000 F CFA" [ref=e197]
                      - row [ref=e198]:
                        - cell "Standard" [ref=e199]
                        - cell "5 000 F CFA" [ref=e200]
                        - cell "50" [ref=e201]
                        - cell "2" [ref=e202]
                        - cell "0" [ref=e203]
                        - cell "128 / 180" [ref=e204]
                        - cell "180 000 F CFA" [ref=e205]
                      - row [ref=e206]:
                        - cell "VIP" [ref=e207]
                        - cell "15 000 F CFA" [ref=e208]
                        - cell "10" [ref=e209]
                        - cell "0" [ref=e210]
                        - cell "0" [ref=e211]
                        - cell "40 / 50" [ref=e212]
                        - cell "105 000 F CFA" [ref=e213]
                      - row [ref=e214]:
                        - cell "Carré presse(masquée)" [ref=e215]
                        - cell "10 000 F CFA" [ref=e217]
                        - cell "0" [ref=e218]
                        - cell "0" [ref=e219]
                        - cell "0" [ref=e220]
                        - cell "10 / 10" [ref=e221]
                        - cell "0 F CFA" [ref=e222]
                - region [ref=e223]:
                  - generic [ref=e225]:
                    - heading "Évolution jour par jour" [level=2] [ref=e226]
                    - paragraph [ref=e227]: Billets vendus chaque jour, à l’heure de Dakar.
                  - list "Ventes par jour" [ref=e228]:
                    - listitem [ref=e229]:
                      - generic [ref=e230]:
                        - time [ref=e232]: 25 oct. 2026
                        - generic [ref=e233]: 0 billet
                    - listitem [ref=e235]:
                      - generic [ref=e236]:
                        - time [ref=e238]: 26 oct. 2026
                        - generic [ref=e239]: 0 billet
                    - listitem [ref=e241]:
                      - generic [ref=e242]:
                        - time [ref=e244]: 27 oct. 2026
                        - generic [ref=e245]: 0 billet
                    - listitem [ref=e247]:
                      - generic [ref=e248]:
                        - time [ref=e250]: 28 oct. 2026
                        - generic [ref=e251]: 1 billet
                    - listitem [ref=e254]:
                      - generic [ref=e255]:
                        - time [ref=e257]: 29 oct. 2026
                        - generic [ref=e258]: 13 billets
                    - listitem [ref=e261]:
                      - generic [ref=e262]:
                        - time [ref=e264]: 30 oct. 2026
                        - generic [ref=e265]: 7 billets
                    - listitem [ref=e268]:
                      - generic [ref=e269]:
                        - time [ref=e271]: 31 oct. 2026
                        - generic [ref=e272]: 4 billets
                    - listitem [ref=e275]:
                      - generic [ref=e276]:
                        - time [ref=e278]: 1 nov. 2026
                        - generic [ref=e279]: 6 billets
                    - listitem [ref=e282]:
                      - generic [ref=e283]:
                        - time [ref=e285]: 2 nov. 2026
                        - generic [ref=e286]: 6 billets
                    - listitem [ref=e289]:
                      - generic [ref=e290]:
                        - time [ref=e292]: 3 nov. 2026
                        - generic [ref=e293]: 2 billets
                    - listitem [ref=e296]:
                      - generic [ref=e297]:
                        - time [ref=e299]: 4 nov. 2026
                        - generic [ref=e300]: 9 billets
                    - listitem [ref=e303]:
                      - generic [ref=e304]:
                        - time [ref=e306]: 5 nov. 2026
                        - generic [ref=e307]: 5 billets
                    - listitem [ref=e310]:
                      - generic [ref=e311]:
                        - time [ref=e313]: 6 nov. 2026
                        - generic [ref=e314]: 29 billetsdont 16 en espèces
  - alert [ref=e317]
```

# Test source

```ts
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
  508 |             await expect(card.getByRole('checkbox', { name: ONLINE_BOX })).not.toBeChecked();
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
> 540 |             await c.page.getByLabel(/^numéro du billet/i).fill(number);
      |                                                           ^ TimeoutError: locator.fill: Timeout 15000ms exceeded.
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
  609 |     },
  610 |     {
  611 |         id: 'admin-remboursements-a-reprendre', titre: 'Administration — finances : remboursements à reprendre (réponses imposées)', role: 'admin', needsIds: true,
  612 |         path: () => '/admin/finance',
  613 |         stubResponses: [
  614 |             { url: RECONCILIATION_URL, method: 'GET', status: 200, body: EMPTY_RECONCILIATION },
  615 |             { url: REFUNDS_URL, method: 'GET', status: 200, body: REFUNDS_TO_RETRY },
  616 |         ],
  617 |         ready: async ({ page }) => {
  618 |             const retry = page.getByRole('button', { name: /^relancer/i }).filter({ visible: true });
  619 |             await expect(retry, 'un bouton « Relancer » par ligne relançable').toHaveCount(2);
  620 |             await expect(page.getByText(/à vérifier auprès de samirpay/i).filter({ visible: true }).first()).toBeVisible();
  621 |             await revealCenter(retry.first());
  622 |         },
  623 |     },
  624 |     // ── Contrôle d'accès ────────────────────────────────────────────────────
  625 |     // Lot 7 (D85, E3) : thème sombre forcé, 2 vues ; après « Commencer le contrôle » (l'écran de départ est
  626 |     // capturé à part : scanner-accueil)
  627 |     {
  628 |         id: 'controleur-scanner', titre: 'Scanner du contrôleur en cours de contrôle (caméra simulée)', role: 'controleur', needsIds: true,
  629 |         path: () => '/controller/scanner', fakeCamera: true, views: DARK_VIEWS,
  630 |         ready: async ({ page }) => startScanner(page),
  631 |     },
  632 |     // ── Lot 7 : billet hors ligne (7.1, E2) ─────────────────────────────────
  633 |     {
  634 |         id: 'billet-hors-ligne-disponible', titre: 'Mes billets — billet disponible hors ligne (service worker actif)', role: 'client', needsIds: true,
  635 |         path: () => '/tickets', serviceWorkers: 'allow',
  636 |         ready: async ({ page }) => {
  637 |             const state = page.locator('[data-ev-offline-state="available"]').first();
  638 |             await expect(state).toBeVisible({ timeout: 45_000 });
  639 |             // L'indicateur est sous l'affiche et le QR : sans défilement, aucune image ne le montrait (run 77)
  640 |             await revealCenter(state);
```