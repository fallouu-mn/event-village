# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · client >> billet-hors-ligne-qr (service worker autorisé) >> billet-hors-ligne-qr — Billet hors ligne — QR affiché sans réseau (page servie par le service worker)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('a[href="/billet/hors-ligne?id=cb5313fc-d018-42ee-9957-c314e9b0967a"]')
Expected: visible
Timeout: 45000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('a[href="/billet/hors-ligne?id=cb5313fc-d018-42ee-9957-c314e9b0967a"]') with timeout 45000ms
  - waiting for locator('a[href="/billet/hors-ligne?id=cb5313fc-d018-42ee-9957-c314e9b0967a"]')

```

```yaml
- complementary:
  - link "Event Village, accueil":
    - /url: /
    - text: EVENT VILLAGE
  - navigation "Navigation principale":
    - paragraph: Menu principal
    - link "Accueil":
      - /url: /
      - img
      - text: Accueil
    - link "Explorer":
      - /url: /explore
      - img
      - text: Explorer
    - link "Mes billets":
      - /url: /tickets
      - img
      - text: Mes billets
    - link "Portefeuille":
      - /url: /wallet
      - img
      - text: Portefeuille
    - paragraph: Espaces métier
    - link "Devenir partenaire":
      - /url: /partner/register
      - img
      - text: Devenir partenaire
  - link "Fatou Mbaye Client":
    - /url: /profile
  - button "Se déconnecter"
  - button "Basculer le thème" [pressed]
- banner:
  - link "Rechercher un événement, un concert, un restaurant…":
    - /url: /explore
  - button "Notifications, 7 non lues": "7"
- main:
  - status: En direct
  - heading "Mes billets" [level=1]
  - paragraph: "Présentez le QR code de votre billet à l’entrée. Il se renouvelle tout seul : gardez la page ouverte."
  - link "Afficher mes billets hors ligne":
    - /url: /billet/hors-ligne
  - button "Comment marche le transfert ?"
  - link "Réserver un billet":
    - /url: /explore
  - tablist "Filtrer mes billets":
    - tab "À venir"
    - tab "Tous mes billets"
    - tab "Historique"
    - tab "Reçus , 1" [selected]
  - tabpanel "Reçus , 1":
    - list:
      - listitem:
        - article "Festival Jazz sur le Fleuve":
          - heading "Festival Jazz sur le Fleuve" [level=3]
          - paragraph: Envoyé par Marième N.
          - term: Date
          - definition: lun. 23 nov. 2026 à 18:00
          - term: Lieu
          - definition: Quai des Pêcheurs, Saint-Louis
          - term: Billet
          - definition: Pass soirée · 7 500 F CFA
          - term: Délai
          - definition: À accepter avant le ven. 13 nov. 2026 à 19:06
          - button "Accepter le billet"
          - button "Refuser le billet pour Festival Jazz sur le Fleuve": Refuser
- alert
```

# Test source

```ts
  701 |         },
  702 |     },
  703 |     {
  704 |         id: 'pilotage-remboursements', titre: 'Événement annulé — avancement des remboursements', role: 'organisateur', needsIds: true, path: pilotage('annule'),
  705 |         ready: async ({ page }) => { await expect(page.getByText(/remboursements/i).first()).toBeVisible(); },
  706 |     },
  707 |     {
  708 |         id: 'pilotage-erreur', titre: 'Pilotage — état d’erreur', role: 'organisateur', needsIds: true, path: pilotage('ceSoir'),
  709 |         injectError: /\/api\/partner\/events\/[^/]+\/pilotage\/overview(\?.*)?$/, ready: expectRetry,
  710 |     },
  711 |     // ── Administration ──────────────────────────────────────────────────────
  712 |     { id: 'admin-evenements', titre: 'Administration — événements (filtres, pagination)', role: 'admin', needsIds: true, path: () => '/admin/events' },
  713 |     { id: 'admin-evenements-en-attente', titre: 'Administration — file de validation', role: 'admin', needsIds: true, path: () => '/admin/events?status=EN_ATTENTE' },
  714 |     {
  715 |         id: 'admin-evenements-erreur', titre: 'Administration — état d’erreur', role: 'admin', needsIds: true, path: () => '/admin/events',
  716 |         injectError: /\/api\/admin\/events(\?.*)?$/, ready: expectRetry,
  717 |     },
  718 |     { id: 'admin-fiche-en-attente', titre: 'Administration — fiche complète avant validation', role: 'admin', needsIds: true, path: (i) => `/admin/events/${ids(i).events.enAttente.id}` },
  719 |     { id: 'admin-fiche-suspendu', titre: 'Administration — fiche d’un événement suspendu (motif, réactiver)', role: 'admin', needsIds: true, path: (i) => `/admin/events/${ids(i).events.suspendu.id}` },
  720 |     {
  721 |         id: 'admin-notifications', titre: 'Administration — supervision des notifications (liste filtrable, compteurs)', role: 'admin', needsIds: true,
  722 |         path: () => '/admin/notifications',
  723 |         ready: async ({ page }) => {
  724 |             await expectHeading(page, /^notifications$/i);
  725 |             await expect(page.getByRole('link', { name: /^voir le détail/i }).first()).toBeVisible();
  726 |         },
  727 |         actions: expectFrenchDateField,
  728 |     },
  729 |     {
  730 |         id: 'admin-notifications-detail', titre: 'Administration — détail d’une notification en échec (Relancer)', role: 'admin', needsIds: true,
  731 |         path: (i) => `/admin/notifications/${ids(i).notifications.failedId}`,
  732 |         ready: async ({ page }) => { await expect(page.getByRole('button', { name: /^relancer$/i })).toBeVisible(); },
  733 |     },
  734 |     {
  735 |         id: 'admin-notifications-erreur', titre: 'Administration — supervision des notifications, état d’erreur', role: 'admin', needsIds: true,
  736 |         path: () => '/admin/notifications',
  737 |         injectError: /\/api\/admin\/notifications(\?.*)?$/,
  738 |         // L'état d'erreur est sous les compteurs et les filtres : à 390 px, il était hors de l'image (run 77)
  739 |         ready: async (c) => {
  740 |             await expectRetry(c);
  741 |             await revealCenter(c.page.getByRole('button', { name: /réessayer/i }));
  742 |         },
  743 |     },
  744 |     {
  745 |         id: 'admin-services-desactive', titre: 'Administration — services : mention « Service désactivé » (interrupteur fermé)', role: 'admin', needsIds: true,
  746 |         path: () => '/admin/services?tab=salles',
  747 |         ready: async ({ page }) => {
  748 |             await expect(page.getByRole('tab', { name: /^salles de fête/i })).toHaveAttribute('aria-selected', 'true');
  749 |             await expect(page.getByText('Service désactivé', { exact: true })).toBeVisible();
  750 |             await expect(page.getByText('Ce service est fermé par son interrupteur : il est masqué au public. Les données restent consultables ici.')).toBeVisible();
  751 |         },
  752 |     },
  753 |     {
  754 |         // Lot 9 bis (7.3, B114) : sous fumee-superadmin, réponse au format du contrat 4.1 ; voir l'en-tête du fichier
  755 |         id: 'admin-remboursements-a-reprendre', titre: 'Administration — finances : versements à reprendre (Renvoyer, Marquer versé ; réponses imposées)',
  756 |         role: 'fumee-superadmin', needsIds: false, path: () => '/admin/finance',
  757 |         stubResponses: CASHOUTS_STUBS,
  758 |         ready: async ({ page }) => {
  759 |             const { resend } = await cashoutsReady(page);
  760 |             await revealCenter(resend.first());
  761 |         },
  762 |     },
  763 |     // ── Contrôle d'accès ────────────────────────────────────────────────────
  764 |     // Lot 7 (D85, E3) : thème sombre forcé, 2 vues ; après « Commencer le contrôle » (l'écran de départ est
  765 |     // capturé à part : scanner-accueil)
  766 |     {
  767 |         id: 'controleur-scanner', titre: 'Scanner du contrôleur en cours de contrôle (caméra simulée)', role: 'controleur', needsIds: true,
  768 |         path: () => '/controller/scanner', fakeCamera: true, views: DARK_VIEWS,
  769 |         ready: async ({ page }) => startScanner(page),
  770 |     },
  771 |     // ── Lot 7 : billet hors ligne (7.1, E2) ─────────────────────────────────
  772 |     {
  773 |         id: 'billet-hors-ligne-disponible', titre: 'Mes billets — billet disponible hors ligne (service worker actif)', role: 'client', needsIds: true,
  774 |         path: () => '/tickets', serviceWorkers: 'allow',
  775 |         ready: async ({ page }) => {
  776 |             const state = page.locator('[data-ev-offline-state="available"]').first();
  777 |             await expect(state).toBeVisible({ timeout: 45_000 });
  778 |             // L'indicateur est sous l'affiche et le QR : sans défilement, aucune image ne le montrait (run 77)
  779 |             await revealCenter(state);
  780 |         },
  781 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  782 |     },
  783 |     {
  784 |         id: 'billet-hors-ligne-a-telecharger', titre: 'Mes billets — billet pas encore enregistré sur le téléphone (téléchargement en cours)', role: 'client', needsIds: true,
  785 |         path: () => '/tickets', holdRequests: [{ url: OFFLINE_CODES_URL, method: 'GET' }],
  786 |         ready: async ({ page }) => {
  787 |             const state = page.locator('[data-ev-offline-state="missing"]').first();
  788 |             await expect(state).toBeVisible({ timeout: 30_000 });
  789 |             await revealCenter(state); // même raison que billet-hors-ligne-disponible
  790 |         },
  791 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  792 |     },
  793 |     {
  794 |         id: 'billet-hors-ligne-qr', titre: 'Billet hors ligne — QR affiché sans réseau (page servie par le service worker)', role: 'client', needsIds: true,
  795 |         path: () => '/tickets', serviceWorkers: 'allow',
  796 |         // Billet de « ce soir » (contrôle déjà ouvert), pas celui de « la veille » : le seed ne modifie pas
  797 |         // access.scan_window_before_hours, donc le lot téléchargé la veille commence à l'ouverture du contrôle
  798 |         // (début − before_hours, D31) et la page affiche à juste titre « Le code d'entrée s'affichera ici à partir
  799 |         // du … » sans QR (run 77). Le billet de « la veille » reste celui de billet-hors-ligne-sans-codes.
  800 |         ready: async (c) => {
> 801 |             await expect(offlineLink(c.page, ids(c.ids).tickets.clientValide)).toBeVisible({ timeout: 45_000 });
      |                                                                                ^ Error: expect(locator).toBeVisible() failed
  802 |         },
  803 |         actions: async (c) => {
  804 |             const id = ids(c.ids).tickets.clientValide;
  805 |             c.guard.freeze(); // passage hors ligne volontaire : la collecte d'erreurs s'arrête
  806 |             await c.context.setOffline(true);
  807 |             const res = await c.page.goto(`/billet/hors-ligne?id=${encodeURIComponent(id)}`);
  808 |             expect(res?.fromServiceWorker(), '/billet/hors-ligne hors ligne : réponse servie par le service worker').toBe(true);
  809 |             await expect(c.page.locator('[data-ev-qr-payload]')).toBeVisible({ timeout: 20_000 });
  810 |         },
  811 |         masks: (page) => [page.locator('[data-ev-qr-payload]')],
  812 |     },
  813 |     {
  814 |         id: 'billet-hors-ligne-sans-codes', titre: 'Billet hors ligne — aucun code enregistré sur ce téléphone, réseau coupé', role: 'client', needsIds: true,
  815 |         path: (i) => `/billet/hors-ligne?id=${encodeURIComponent(ids(i).tickets.clientVeille)}`,
  816 |         holdRequests: [{ url: OFFLINE_CODES_URL, method: 'GET' }], offline: 'after-load',
  817 |         ready: async ({ page }) => {
  818 |             await expect(page.locator('[data-ev-offline-state="offline_missing"]').first()).toBeVisible({ timeout: 20_000 });
  819 |         },
  820 |     },
  821 |     // ── Lot 7 : scanner professionnel (7.2, E3) ─────────────────────────────
  822 |     {
  823 |         id: 'scanner-accueil', titre: 'Scanner — écran « Commencer le contrôle » (événement, porte)', role: 'controleur', needsIds: true,
  824 |         path: () => '/controller/scanner', fakeCamera: true, views: DARK_VIEWS,
  825 |         ready: async ({ page }) => scannerStartReady(page),
  826 |     },
  827 |     scanResultScreen('scanner-accepte', 'Scanner — entrée validée (plein écran)', { result: 'valid', scan_id: '5d2c7a10-8e4b-4f61-9a3d-1c2b3e4f5a60', ticket: SCAN_TICKET }),
  828 |     scanResultScreen('scanner-deja-utilise', 'Scanner — billet déjà utilisé (plein écran, heure d’entrée)', {
  829 |         result: 'already_used', scan_id: '6e3d8b21-9f5c-4a72-8b4e-2d3c4f5a6b71',
  830 |         ticket: { ...SCAN_TICKET, checked_in_at: '2026-11-04T19:42:00.000Z', checked_in_by_me: false },
  831 |     }),
  832 |     scanResultScreen('scanner-refuse', 'Scanner — entrée refusée (plein écran, QR expiré)', { result: 'qr_expired', scan_id: '7f4e9c32-a06d-4b83-9c5f-3e4d5a6b7c82', ticket: SCAN_TICKET }),
  833 |     scanResultScreen('scanner-hors-fenetre', 'Scanner — contrôle pas encore ouvert (plein écran)', { result: 'event_not_open', scan_id: '91b6be54-c28f-4da5-9e7b-5a6f7c8d9ea4' }),
  834 |     scanResultScreen('scanner-evenement-annule', 'Scanner — événement annulé (plein écran)', { result: 'event_cancelled', scan_id: 'a2c7cf65-d39a-4eb6-8f8c-6b7a8d9eafb5' }),
  835 |     // Lot 8 (8.2 e, contrat 3.5) : réponse d'un renvoi sans ligne, ni scan_id ni ticket ; le parcours réel est au projet terrain
  836 |     scanResultScreen('scanner-non-traite', 'Scanner — scan non traité après un renvoi (plein écran)', {
  837 |         result: 'not_processed', code: 'REPLAY_NOT_FOUND', message: 'Scan non traité : aucune entrée enregistrée. Scannez le billet de nouveau.',
  838 |     }),
  839 |     {
  840 |         id: 'scanner-reseau-lent', titre: 'Scanner — réseau lent (envoi retenu, nouvel essai automatique)', role: 'controleur', needsIds: true,
  841 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: 'barcode-detector', initStorage: SCANNER_STORAGE, slowTimers: SCANNER_TIMERS,
  842 |         holdRequests: [{ url: SCAN_URL, method: 'POST' }], allowFailures: [SCAN_URL],
  843 |         ready: async ({ page }) => startScanner(page),
  844 |         actions: async (c) => {
  845 |             await presentToFakeDetector(c.page, demoPayload(c));
  846 |             await expect(c.page.locator('[data-scan-state="slow"]')).toBeVisible({ timeout: 10_000 });
  847 |         },
  848 |     },
  849 |     {
  850 |         id: 'scanner-hors-ligne', titre: 'Scanner — hors ligne (bandeau permanent, rien n’est validé)', role: 'controleur', needsIds: true,
  851 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: 'barcode-detector',
  852 |         ready: async ({ page }) => startScanner(page),
  853 |         actions: async ({ page, context, guard }) => {
  854 |             guard.freeze(); // passage hors ligne volontaire après le chargement
  855 |             await context.setOffline(true);
  856 |             await expect(page.locator('[data-scan-state="offline"]')).toBeVisible({ timeout: 10_000 });
  857 |         },
  858 |     },
  859 |     {
  860 |         id: 'scanner-saisie-manuelle', titre: 'Scanner — saisie manuelle, étape « Vérifier » (titulaire affiché)', role: 'controleur', needsIds: true,
  861 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  862 |         ready: async ({ page }) => startScanner(page),
  863 |         actions: async (c) => {
  864 |             const number = ids(c.ids).tickets.manualLookup.number;
  865 |             await c.page.getByRole('button', { name: /^saisie manuelle$/i }).click();
  866 |             await c.page.getByLabel(/^numéro du billet/i).fill(number);
  867 |             await c.page.getByRole('button', { name: /^vérifier le billet$/i }).click();
  868 |             await expect(c.page.getByRole('heading', { name: new RegExp(`billet ${number}`, 'i') })).toBeVisible();
  869 |             await expect(c.page.getByText(/^titulaire$/i)).toBeVisible();
  870 |         },
  871 |     },
  872 |     {
  873 |         id: 'scanner-guichet', titre: 'Scanner — onglet Guichet, devis servi par le serveur', role: 'controleur', needsIds: true,
  874 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  875 |         ready: async ({ page }) => startScanner(page),
  876 |         actions: async ({ page }) => {
  877 |             await openTab(page, /^guichet$/i);
  878 |             await page.getByRole('button', { name: /^ajouter un billet standard$/i }).click();
  879 |             await expect(page.getByRole('region', { name: /^total à encaisser$/i })).toBeVisible();
  880 |             // Lot 8 (T23) : catégorie vendue au guichet seulement, reconnue d'un coup d'œil
  881 |             const press = page.getByRole('list', { name: /^catégories en vente$/i }).getByRole('listitem').filter({ hasText: 'Carré presse' });
  882 |             const mention = press.getByText('Sur place uniquement', { exact: true });
  883 |             await expect(mention).toBeVisible();
  884 |             expect(await fontSizePx(mention), 'taille de la mention « Sur place uniquement », en pixels').toBeGreaterThanOrEqual(14);
  885 |             await revealCenter(mention);
  886 |         },
  887 |     },
  888 |     {
  889 |         id: 'caisse-ouverture', titre: 'Caisse — ouverture (fonds de caisse, PIN obligatoire)', role: 'controleur', needsIds: true,
  890 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  891 |         stubResponses: [{ url: /\/api\/controller\/shifts\/active(\?.*)?$/, method: 'GET', status: 200, body: { success: true, shift: null, expected_cash_in_drawer: null } }],
  892 |         ready: async ({ page }) => startScanner(page),
  893 |         actions: async ({ page }) => {
  894 |             await openTab(page, /^caisse$/i);
  895 |             await page.getByRole('button', { name: /^ouvrir ma caisse$/i }).click();
  896 |             const dialog = page.getByRole('dialog', { name: /^ouvrir ma caisse$/i });
  897 |             await expect(dialog).toBeVisible();
  898 |             // Lot 9 bis (R42, A11, contrat 4.3 PIN_REQUIRED) : le PIN du régisseur est obligatoire à l'ouverture
  899 |             await expect(dialog.getByLabel(/^code pin du régisseur/i), 'PIN du régisseur obligatoire à l’ouverture (R42)').toHaveAttribute('aria-required', 'true');
  900 |             await expect(dialog.getByText(/facultatif/i), 'plus aucune mention « facultatif » du PIN (R42)').toHaveCount(0);
  901 |         },
```