# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · admin >> admin-remboursements-a-reprendre — Administration — finances : remboursements à reprendre (réponses imposées)
- Location: e2e/captures.spec.ts:159:9

# Error details

```
Error: un bouton « Relancer » par ligne relançable

expect(locator).toHaveCount(expected) failed

Locator:  getByRole('button', { name: /^relancer/i }).visible()
Expected: 2
Received: 0
Timeout:  15000ms

Call log:
  - un bouton « Relancer » par ligne relançable getByRole('button', { name: /^relancer/i }).visible() with timeout 15000ms
  - waiting for getByRole('button', { name: /^relancer/i }).visible()
    34 × locator resolved to 0 elements
       - unexpected value "0"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - link "Event Village, accueil" [ref=e5] [cursor=pointer]:
        - /url: /
        - generic [ref=e11]:
          - generic [ref=e12]: EVENT
          - generic [ref=e13]: VILLAGE
      - navigation "Navigation principale" [ref=e14]:
        - generic [ref=e15]: Administration
        - link "Tableau de bord" [ref=e20] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=e27]:
          - paragraph [ref=e28]: Gestion
          - generic [ref=e29]:
            - link "Événements" [ref=e30] [cursor=pointer]:
              - /url: /admin/events
            - link "Utilisateurs" [ref=e34] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=e41] [cursor=pointer]:
              - /url: /admin/services
        - generic [ref=e47]:
          - paragraph [ref=e48]: Finances
          - generic [ref=e49]:
            - link "Finance" [ref=e50] [cursor=pointer]:
              - /url: /admin/finance
            - link "Tarification" [ref=e54] [cursor=pointer]:
              - /url: /admin/pricing
        - generic [ref=e57]:
          - paragraph [ref=e58]: Engagement
          - generic [ref=e59]:
            - link "Parrainage" [ref=e60] [cursor=pointer]:
              - /url: /admin/referral
            - link "Communications" [ref=e65] [cursor=pointer]:
              - /url: /admin/communications
        - generic [ref=e70]:
          - paragraph [ref=e71]: Système
          - generic [ref=e72]:
            - link "Journal d’audit" [ref=e73] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=e78] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=e85] [cursor=pointer]:
              - /url: /scan
        - link "Retour au site" [ref=e94] [cursor=pointer]:
          - /url: /
      - generic [ref=e99]:
        - link "Aïda Diallo Administrateur" [ref=e100] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e101]: AD
          - generic [ref=e102]:
            - generic [ref=e103]: Aïda Diallo
            - generic [ref=e104]: Administrateur
        - generic [ref=e105]:
          - button "Se déconnecter" [ref=e106] [cursor=pointer]
          - button "Basculer le thème" [pressed] [ref=e111] [cursor=pointer]
    - generic [ref=e119]:
      - banner [ref=e120]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e122] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 20 non lues" [ref=e129] [cursor=pointer]:
          - generic [ref=e133]: "20"
      - main [ref=e134]:
        - generic [ref=e136]:
          - generic [ref=e137]:
            - generic [ref=e138]:
              - link "Retour au tableau de bord" [ref=e139] [cursor=pointer]:
                - /url: /admin/dashboard
              - generic [ref=e142]:
                - text: Console Superadmin
                - heading "Rapprochement financier (§84)" [level=1] [ref=e143]
            - generic [ref=e144]:
              - link "Réglages de la plateforme" [ref=e145] [cursor=pointer]:
                - /url: /admin/finance-settings
              - button "Actualiser" [ref=e146] [cursor=pointer]
          - region "Synthèse financière" [ref=e154]:
            - generic [ref=e155]:
              - text: Volume encaissé
              - paragraph [ref=e156]: 0 FCFA
              - generic [ref=e157]: 0 paiement(s), frais de service compris
            - generic [ref=e158]:
              - text: Frais de service perçus
              - paragraph [ref=e159]: 0 FCFA
              - generic [ref=e160]: Payés par les acheteurs, montants enregistrés sur chaque paiement
            - generic [ref=e161]:
              - text: Frais agrégateur (SamirPay)
              - paragraph [ref=e162]: 0 FCFA
              - generic [ref=e163]: Prélevés sur les frais de service
            - generic [ref=e164]:
              - text: Revenu net Event Village
              - paragraph [ref=e165]: 0 FCFA
              - generic [ref=e166]: Frais de service moins frais agrégateur, remboursements déduits
            - generic [ref=e167]:
              - text: Reversements partenaires
              - paragraph [ref=e168]: 0 FCFA
              - generic [ref=e169]: Prix des billets et prestations dus aux partenaires
            - generic [ref=e170]:
              - text: Remboursements versés
              - paragraph [ref=e171]: 0 FCFA
              - generic [ref=e172]: Cashouts de remboursement confirmés sur la période
          - region "Parrainage, retraits et écarts" [ref=e173]:
            - generic [ref=e175]:
              - text: Commissions parrainage (N1 + N2)
              - paragraph [ref=e176]: 0 FCFA
            - generic [ref=e183]:
              - text: Revenu net après parrainage
              - paragraph [ref=e184]: 0 FCFA
            - generic [ref=e188]:
              - text: Retraits versés
              - paragraph [ref=e189]: 0 FCFA
            - generic [ref=e193]:
              - text: Écarts de rapprochement
              - paragraph [ref=e194]: 0 anomalie(s)
          - region [ref=e198]:
            - generic [ref=e199]:
              - generic [ref=e200]:
                - heading "Paiements rapprochés" [level=2] [ref=e201]
                - paragraph [ref=e202]: "Contrôle du serveur, paiement par paiement : total débité = reversement partenaire + frais de service ; frais de service = frais agrégateur + revenu net Event Village."
              - generic [ref=e203]:
                - generic [ref=e204]:
                  - generic [ref=e205]: Statut
                  - combobox "Statut" [ref=e206]:
                    - option "Tous les paiements encaissés" [selected]
                    - option "Confirmés"
                    - option "Partiellement remboursés"
                    - option "Remboursement en cours"
                    - option "Remboursés"
                - group "Période" [ref=e207]:
                  - button "Tout" [pressed] [ref=e208] [cursor=pointer]
                  - button "30 jours" [ref=e209] [cursor=pointer]
                  - button "7 jours" [ref=e210] [cursor=pointer]
            - paragraph [ref=e214]: Aucun paiement encaissé pour cette période.
  - alert [ref=e215]
```

# Test source

```ts
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
> 619 |             await expect(retry, 'un bouton « Relancer » par ligne relançable').toHaveCount(2);
      |                                                                                ^ Error: un bouton « Relancer » par ligne relançable
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
  641 |         },
  642 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  643 |     },
  644 |     {
  645 |         id: 'billet-hors-ligne-a-telecharger', titre: 'Mes billets — billet pas encore enregistré sur le téléphone (téléchargement en cours)', role: 'client', needsIds: true,
  646 |         path: () => '/tickets', holdRequests: [{ url: OFFLINE_CODES_URL, method: 'GET' }],
  647 |         ready: async ({ page }) => {
  648 |             const state = page.locator('[data-ev-offline-state="missing"]').first();
  649 |             await expect(state).toBeVisible({ timeout: 30_000 });
  650 |             await revealCenter(state); // même raison que billet-hors-ligne-disponible
  651 |         },
  652 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  653 |     },
  654 |     {
  655 |         id: 'billet-hors-ligne-qr', titre: 'Billet hors ligne — QR affiché sans réseau (page servie par le service worker)', role: 'client', needsIds: true,
  656 |         path: () => '/tickets', serviceWorkers: 'allow',
  657 |         // Billet de « ce soir » (contrôle déjà ouvert), pas celui de « la veille » : le seed ne modifie pas
  658 |         // access.scan_window_before_hours, donc le lot téléchargé la veille commence à l'ouverture du contrôle
  659 |         // (début − before_hours, D31) et la page affiche à juste titre « Le code d'entrée s'affichera ici à partir
  660 |         // du … » sans QR (run 77). Le billet de « la veille » reste celui de billet-hors-ligne-sans-codes.
  661 |         ready: async (c) => {
  662 |             await expect(offlineLink(c.page, ids(c.ids).tickets.clientValide)).toBeVisible({ timeout: 45_000 });
  663 |         },
  664 |         actions: async (c) => {
  665 |             const id = ids(c.ids).tickets.clientValide;
  666 |             c.guard.freeze(); // passage hors ligne volontaire : la collecte d'erreurs s'arrête
  667 |             await c.context.setOffline(true);
  668 |             const res = await c.page.goto(`/billet/hors-ligne?id=${encodeURIComponent(id)}`);
  669 |             expect(res?.fromServiceWorker(), '/billet/hors-ligne hors ligne : réponse servie par le service worker').toBe(true);
  670 |             await expect(c.page.locator('[data-ev-qr-payload]')).toBeVisible({ timeout: 20_000 });
  671 |         },
  672 |         masks: (page) => [page.locator('[data-ev-qr-payload]')],
  673 |     },
  674 |     {
  675 |         id: 'billet-hors-ligne-sans-codes', titre: 'Billet hors ligne — aucun code enregistré sur ce téléphone, réseau coupé', role: 'client', needsIds: true,
  676 |         path: (i) => `/billet/hors-ligne?id=${encodeURIComponent(ids(i).tickets.clientVeille)}`,
  677 |         holdRequests: [{ url: OFFLINE_CODES_URL, method: 'GET' }], offline: 'after-load',
  678 |         ready: async ({ page }) => {
  679 |             await expect(page.locator('[data-ev-offline-state="offline_missing"]').first()).toBeVisible({ timeout: 20_000 });
  680 |         },
  681 |     },
  682 |     // ── Lot 7 : scanner professionnel (7.2, E3) ─────────────────────────────
  683 |     {
  684 |         id: 'scanner-accueil', titre: 'Scanner — écran « Commencer le contrôle » (événement, porte)', role: 'controleur', needsIds: true,
  685 |         path: () => '/controller/scanner', fakeCamera: true, views: DARK_VIEWS,
  686 |         ready: async ({ page }) => scannerStartReady(page),
  687 |     },
  688 |     scanResultScreen('scanner-accepte', 'Scanner — entrée validée (plein écran)', { result: 'valid', scan_id: '5d2c7a10-8e4b-4f61-9a3d-1c2b3e4f5a60', ticket: SCAN_TICKET }),
  689 |     scanResultScreen('scanner-deja-utilise', 'Scanner — billet déjà utilisé (plein écran, heure d’entrée)', {
  690 |         result: 'already_used', scan_id: '6e3d8b21-9f5c-4a72-8b4e-2d3c4f5a6b71',
  691 |         ticket: { ...SCAN_TICKET, checked_in_at: '2026-11-04T19:42:00.000Z', checked_in_by_me: false },
  692 |     }),
  693 |     scanResultScreen('scanner-refuse', 'Scanner — entrée refusée (plein écran, QR expiré)', { result: 'qr_expired', scan_id: '7f4e9c32-a06d-4b83-9c5f-3e4d5a6b7c82', ticket: SCAN_TICKET }),
  694 |     scanResultScreen('scanner-a-encaisser', 'Scanner — encaissement requis (plein écran, caisse ouverte)', {
  695 |         result: 'cash_required', scan_id: '80a5ad43-b17e-4c94-8d6a-4f5e6b7c8d93', amount_due: 5000, ticket: SCAN_TICKET,
  696 |     }),
  697 |     scanResultScreen('scanner-hors-fenetre', 'Scanner — contrôle pas encore ouvert (plein écran)', { result: 'event_not_open', scan_id: '91b6be54-c28f-4da5-9e7b-5a6f7c8d9ea4' }),
  698 |     scanResultScreen('scanner-evenement-annule', 'Scanner — événement annulé (plein écran)', { result: 'event_cancelled', scan_id: 'a2c7cf65-d39a-4eb6-8f8c-6b7a8d9eafb5' }),
  699 |     // Lot 8 (8.2 e, contrat 3.5) : réponse d'un renvoi sans ligne, ni scan_id ni ticket ; le parcours réel est au projet terrain
  700 |     scanResultScreen('scanner-non-traite', 'Scanner — scan non traité après un renvoi (plein écran)', {
  701 |         result: 'not_processed', code: 'REPLAY_NOT_FOUND', message: 'Scan non traité : aucune entrée enregistrée. Scannez le billet de nouveau.',
  702 |     }),
  703 |     {
  704 |         id: 'scanner-reseau-lent', titre: 'Scanner — réseau lent (envoi retenu, nouvel essai automatique)', role: 'controleur', needsIds: true,
  705 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: 'barcode-detector', initStorage: SCANNER_STORAGE, slowTimers: SCANNER_TIMERS,
  706 |         holdRequests: [{ url: SCAN_URL, method: 'POST' }], allowFailures: [SCAN_URL],
  707 |         ready: async ({ page }) => startScanner(page),
  708 |         actions: async (c) => {
  709 |             await presentToFakeDetector(c.page, demoPayload(c));
  710 |             await expect(c.page.locator('[data-scan-state="slow"]')).toBeVisible({ timeout: 10_000 });
  711 |         },
  712 |     },
  713 |     {
  714 |         id: 'scanner-hors-ligne', titre: 'Scanner — hors ligne (bandeau permanent, rien n’est validé)', role: 'controleur', needsIds: true,
  715 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: 'barcode-detector',
  716 |         ready: async ({ page }) => startScanner(page),
  717 |         actions: async ({ page, context, guard }) => {
  718 |             guard.freeze(); // passage hors ligne volontaire après le chargement
  719 |             await context.setOffline(true);
```