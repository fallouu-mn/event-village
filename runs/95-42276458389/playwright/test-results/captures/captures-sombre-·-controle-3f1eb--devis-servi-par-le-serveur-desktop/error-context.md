# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · controleur >> scanner-guichet — Scanner — onglet Guichet, devis servi par le serveur
- Location: e2e/captures.spec.ts:159:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('list', { name: /^catégories en vente$/i }).getByRole('listitem').filter({ hasText: 'Carré presse' }).getByText('Sur place uniquement', { exact: true })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('list', { name: /^catégories en vente$/i }).getByRole('listitem').filter({ hasText: 'Carré presse' }).getByText('Sur place uniquement', { exact: true }) with timeout 15000ms
  - waiting for getByRole('list', { name: /^catégories en vente$/i }).getByRole('listitem').filter({ hasText: 'Carré presse' }).getByText('Sur place uniquement', { exact: true })

```

```yaml
- banner:
  - link "Mon espace client":
    - /url: /
  - link "Event Village, accueil":
    - /url: /
    - text: EVENT VILLAGE
  - button "Notifications, 1 non lue": "1"
  - link "Ibrahima Gueye":
    - /url: /controller/profile
- main:
  - heading "Nuit du Sabar — édition d’automne" [level=1]
  - paragraph:
    - status: "Porte Entrée principale : 53 entrées"
    - text: En ligne
  - button "Changer d’événement"
  - button "Se déconnecter"
  - tablist "Espace du contrôleur":
    - tab "Contrôle"
    - tab "Guichet" [selected]
    - tab "Caisse"
  - tabpanel "Guichet":
    - list "Catégories en vente":
      - listitem:
        - text: Standard 5 000 F CFA · 128 disponibles
        - button "Retirer un billet Standard"
        - text: "1"
        - button "Ajouter un billet Standard"
      - listitem:
        - text: Carré presse 10 000 F CFA · 10 disponibles
        - button "Retirer un billet Carré presse" [disabled]
        - text: "0"
        - button "Ajouter un billet Carré presse"
      - listitem:
        - text: VIP 15 000 F CFA · 40 disponibles
        - button "Retirer un billet VIP" [disabled]
        - text: "0"
        - button "Ajouter un billet VIP"
    - text: Numéro de l’acheteur (facultatif)
    - textbox "Numéro de l’acheteur (facultatif)"
    - paragraph: Pour lui envoyer un reçu par SMS. Le billet n’est rattaché à aucun compte.
    - region "Total à encaisser":
      - paragraph: 1 × Standard 5 000 F CFA
      - paragraph: À encaisser 5 000 F CFA
    - 'button "J’ai reçu 5 000 F CFA : valider la vente"'
- alert
```

# Test source

```ts
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
  720 |             await expect(page.locator('[data-scan-state="offline"]')).toBeVisible({ timeout: 10_000 });
  721 |         },
  722 |     },
  723 |     {
  724 |         id: 'scanner-saisie-manuelle', titre: 'Scanner — saisie manuelle, étape « Vérifier » (titulaire affiché)', role: 'controleur', needsIds: true,
  725 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  726 |         ready: async ({ page }) => startScanner(page),
  727 |         actions: async (c) => {
  728 |             const number = ids(c.ids).tickets.manualLookup.number;
  729 |             await c.page.getByRole('button', { name: /^saisie manuelle$/i }).click();
  730 |             await c.page.getByLabel(/^numéro du billet/i).fill(number);
  731 |             await c.page.getByRole('button', { name: /^vérifier le billet$/i }).click();
  732 |             await expect(c.page.getByRole('heading', { name: new RegExp(`billet ${number}`, 'i') })).toBeVisible();
  733 |             await expect(c.page.getByText(/^titulaire$/i)).toBeVisible();
  734 |         },
  735 |     },
  736 |     {
  737 |         id: 'scanner-guichet', titre: 'Scanner — onglet Guichet, devis servi par le serveur', role: 'controleur', needsIds: true,
  738 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  739 |         ready: async ({ page }) => startScanner(page),
  740 |         actions: async ({ page }) => {
  741 |             await openTab(page, /^guichet$/i);
  742 |             await page.getByRole('button', { name: /^ajouter un billet standard$/i }).click();
  743 |             await expect(page.getByRole('region', { name: /^total à encaisser$/i })).toBeVisible();
  744 |             // Lot 8 (T23) : catégorie vendue au guichet seulement, reconnue d'un coup d'œil
  745 |             const press = page.getByRole('list', { name: /^catégories en vente$/i }).getByRole('listitem').filter({ hasText: 'Carré presse' });
  746 |             const mention = press.getByText('Sur place uniquement', { exact: true });
> 747 |             await expect(mention).toBeVisible();
      |                                   ^ Error: expect(locator).toBeVisible() failed
  748 |             expect(await fontSizePx(mention), 'taille de la mention « Sur place uniquement », en pixels').toBeGreaterThanOrEqual(14);
  749 |             await revealCenter(mention);
  750 |         },
  751 |     },
  752 |     {
  753 |         id: 'caisse-ouverture', titre: 'Caisse — ouverture (fonds de caisse, PIN facultatif)', role: 'controleur', needsIds: true,
  754 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  755 |         stubResponses: [{ url: /\/api\/controller\/shifts\/active(\?.*)?$/, method: 'GET', status: 200, body: { success: true, shift: null, expected_cash_in_drawer: null } }],
  756 |         ready: async ({ page }) => startScanner(page),
  757 |         actions: async ({ page }) => {
  758 |             await openTab(page, /^caisse$/i);
  759 |             await page.getByRole('button', { name: /^ouvrir ma caisse$/i }).click();
  760 |             await expect(page.getByRole('dialog', { name: /^ouvrir ma caisse$/i })).toBeVisible();
  761 |         },
  762 |     },
  763 |     {
  764 |         id: 'caisse-cloture-ecart', titre: 'Caisse — clôture avec écart constaté par le serveur (justification, PIN)', role: 'controleur', needsIds: true,
  765 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  766 |         stubResponses: [{
  767 |             url: /\/api\/controller\/shifts\/close$/, method: 'POST', status: 400,
  768 |             body: { success: false, code: 'JUSTIFICATION_REQUIRED', discrepancy: -2000, error: 'Écart constaté : justification et code PIN du régisseur requis.' },
  769 |         }],
  770 |         allowFailures: [/\/api\/controller\/shifts\/close$/],
  771 |         ready: async ({ page }) => startScanner(page),
  772 |         actions: async ({ page }) => {
  773 |             await openTab(page, /^caisse$/i);
  774 |             await page.getByRole('button', { name: /^clôturer ma caisse$/i }).click();
  775 |             const dialog = page.getByRole('dialog', { name: /^clôturer ma caisse$/i });
  776 |             await expect(dialog).toBeVisible();
  777 |             // 43 000 pour 45 000 enregistrés : l'écart affiché (-2 000, réponse figée ci-dessus) tombe juste à l'écran
  778 |             await dialog.getByLabel(/^espèces encaissées comptées/i).fill('43000');
  779 |             await dialog.getByRole('button', { name: /^clôturer la caisse$/i }).click();
  780 |             await expect(dialog.getByText(/^écart constaté par le serveur$/i)).toBeVisible();
  781 |             await expect(dialog.getByLabel(/^justification de l.écart/i)).toBeVisible();
  782 |         },
  783 |     },
  784 |     {
  785 |         id: 'caisse-ticket-z', titre: 'Caisse — Z de caisse après la clôture', role: 'controleur', needsIds: true,
  786 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  787 |         stubResponses: [{
  788 |             url: /\/api\/controller\/shifts\/close$/, method: 'POST', status: 200,
  789 |             body: {
  790 |                 success: true,
  791 |                 summary: {
  792 |                     shift_id: 'b3d8d076-e4ab-4fc7-9a9d-7c8b9eafc0c6', controller_id: 'c4e9e187-f5bc-40d8-8bae-8d9caf0b1d17',
  793 |                     controller_name: 'Ibrahima Gueye', controller_phone: '+221700000106', event_id: 'd5fae298-06cd-41e9-9cbf-9eadb01c2e28',
  794 |                     event_title: 'Nuit du Sabar — édition d’automne', opened_at: '2026-11-04T18:30:00.000Z', closed_at: '2026-11-04T23:45:00.000Z',
  795 |                     opening_float_amount: 10000, expected_cash_total: 23000, declared_cash_total: 21000, discrepancy_amount: -2000,
  796 |                     discrepancy_justification: 'Monnaie rendue en trop à un spectateur, signalée au régisseur.', status: 'CLOTURE', closing_confirmed_by_pin: true,
  797 |                 },
  798 |             },
  799 |         }],
  800 |         ready: async ({ page }) => startScanner(page),
  801 |         actions: async ({ page }) => {
  802 |             await openTab(page, /^caisse$/i);
  803 |             await page.getByRole('button', { name: /^clôturer ma caisse$/i }).click();
  804 |             const dialog = page.getByRole('dialog', { name: /^clôturer ma caisse$/i });
  805 |             await dialog.getByLabel(/^espèces encaissées comptées/i).fill('21000');
  806 |             await dialog.getByRole('button', { name: /^clôturer la caisse$/i }).click();
  807 |             await expect(page.getByRole('dialog', { name: /^caisse clôturée$/i })).toBeVisible();
  808 |         },
  809 |     },
  810 |     // ── Lot 7 : paiement et inscription (7.3, E4) ───────────────────────────
  811 |     {
  812 |         id: 'paiement-modale', titre: 'Paiement — modale d’achat ouverte (opérateur, numéro)', role: 'client', needsIds: true,
  813 |         path: (i) => `/events/${ids(i).events.ceSoir.id}`,
  814 |         actions: async ({ page }) => {
  815 |             await page.getByRole('button', { name: /^ajouter un billet standard/i }).click();
  816 |             // Bouton du panneau de billetterie (« Acheter 1 billet (…) ») : à 390 px la barre d'achat fixe du bas
  817 |             // (lg:hidden) porte aussi « Acheter (…) », même action ; /^acheter/ visait les deux (run 77, mode strict).
  818 |             await page.getByRole('button', { name: /^acheter \d+ billets? \(/i }).click();
  819 |             await expect(page.getByRole('dialog').or(page.getByRole('alertdialog'))).toBeVisible();
  820 |         },
  821 |     },
  822 |     {
  823 |         id: 'paiement-attente', titre: 'Paiement — en attente de validation chez l’opérateur', role: 'client', needsIds: true,
  824 |         path: (i) => `/paiement/${ids(i).payments.pending}`,
  825 |         ready: async ({ page }) => {
  826 |             await expect(page.locator('#payment-status-title')).toBeVisible({ timeout: 30_000 });
  827 |         },
  828 |     },
  829 |     {
  830 |         id: 'paiement-succes', titre: 'Paiement — confirmé (billets émis, redirection annulable)', role: 'client', needsIds: true,
  831 |         path: (i) => `/paiement/${ids(i).payments.success}`, slowTimers: { minDelayMs: 1000, factor: 100 },
  832 |         ready: async ({ page }) => {
  833 |             await expect(page.locator('#payment-status-title')).toHaveText(/paiement confirmé/i, { timeout: 30_000 });
  834 |         },
  835 |     },
  836 |     {
  837 |         id: 'paiement-echec', titre: 'Paiement — refusé (Réessayer le paiement)', role: 'client', needsIds: true,
  838 |         path: (i) => `/paiement/${ids(i).payments.failed}`,
  839 |         ready: async ({ page }) => {
  840 |             await expect(page.locator('#payment-status-title')).toHaveText(/n.a pas abouti/i, { timeout: 30_000 });
  841 |         },
  842 |     },
  843 |     {
  844 |         id: 'inscription-code', titre: 'Inscription — étape 2 : code reçu et profil (envoi du code simulé)', role: 'anonyme', needsIds: false, path: () => '/register',
  845 |         stubResponses: [{ url: /\/api\/auth\/register\/start$/, method: 'POST', status: 200, body: { ok: true, phone: '+221771234567', resend_after: 60 } }],
  846 |         ready: async ({ page }) => { await expectHeading(page, /^créer un compte$/i); },
  847 |         actions: async ({ page }) => {
```