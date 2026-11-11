# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · controleur >> caisse-ouverture — Caisse — ouverture (fonds de caisse, PIN obligatoire)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: PIN du régisseur obligatoire à l’ouverture (R42)

expect(locator).toHaveAttribute(expected) failed

Locator:  getByRole('dialog', { name: /^ouvrir ma caisse$/i }).getByLabel(/^code pin du régisseur/i)
Expected: "true"
Received: ""
Timeout:  15000ms

Call log:
  - PIN du régisseur obligatoire à l’ouverture (R42) getByRole('dialog', { name: /^ouvrir ma caisse$/i }).getByLabel(/^code pin du régisseur/i) with timeout 15000ms
  - waiting for getByRole('dialog', { name: /^ouvrir ma caisse$/i }).getByLabel(/^code pin du régisseur/i)
    34 × locator resolved to <input value="" id=":rb:" required="" maxlength="8" type="password" autocomplete="off" inputmode="numeric" aria-describedby=":rb:-aide" class="w-full min-h-11 rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-base text-fg placeholder:text-fg-muted transition-colors duration-200 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-70 aria-[invalid=true]:border-dang…/>
       - unexpected value "null"

```

```yaml
- textbox "Code PIN du régisseur (obligatoire)"
```

# Test source

```ts
  799 |         // du … » sans QR (run 77). Le billet de « la veille » reste celui de billet-hors-ligne-sans-codes.
  800 |         ready: async (c) => {
  801 |             await expect(offlineLink(c.page, ids(c.ids).tickets.clientValide)).toBeVisible({ timeout: 45_000 });
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
> 899 |             await expect(dialog.getByLabel(/^code pin du régisseur/i), 'PIN du régisseur obligatoire à l’ouverture (R42)').toHaveAttribute('aria-required', 'true');
      |                                                                                                                            ^ Error: PIN du régisseur obligatoire à l’ouverture (R42)
  900 |             await expect(dialog.getByText(/facultatif/i), 'plus aucune mention « facultatif » du PIN (R42)').toHaveCount(0);
  901 |         },
  902 |     },
  903 |     {
  904 |         id: 'caisse-cloture-ecart', titre: 'Caisse — clôture avec écart constaté par le serveur (justification, PIN)', role: 'controleur', needsIds: true,
  905 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  906 |         stubResponses: [{
  907 |             url: /\/api\/controller\/shifts\/close$/, method: 'POST', status: 400,
  908 |             body: { success: false, code: 'JUSTIFICATION_REQUIRED', discrepancy: -2000, error: 'Écart constaté : justification et code PIN du régisseur requis.' },
  909 |         }],
  910 |         allowFailures: [/\/api\/controller\/shifts\/close$/],
  911 |         ready: async ({ page }) => startScanner(page),
  912 |         actions: async ({ page }) => {
  913 |             await openTab(page, /^caisse$/i);
  914 |             await page.getByRole('button', { name: /^clôturer ma caisse$/i }).click();
  915 |             const dialog = page.getByRole('dialog', { name: /^clôturer ma caisse$/i });
  916 |             await expect(dialog).toBeVisible();
  917 |             // 2 000 de moins que le montant enregistré à l'écran : l'écart affiché (-2 000, réponse figée ci-dessus) tombe juste
  918 |             const recorded = Number((await dialog.locator('dd').nth(1).innerText()).replace(/\D/g, ''));
  919 |             await dialog.getByLabel(/^espèces encaissées comptées/i).fill(String(recorded - 2000));
  920 |             await dialog.getByRole('button', { name: /^clôturer la caisse$/i }).click();
  921 |             await expect(dialog.getByText(/^écart constaté$/i)).toBeVisible();
  922 |             await expect(dialog.getByLabel(/^justification de l.écart/i)).toBeVisible();
  923 |         },
  924 |     },
  925 |     {
  926 |         id: 'caisse-ticket-z', titre: 'Caisse — Z de caisse après la clôture', role: 'controleur', needsIds: true,
  927 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  928 |         stubResponses: [{
  929 |             url: /\/api\/controller\/shifts\/close$/, method: 'POST', status: 200,
  930 |             body: {
  931 |                 success: true,
  932 |                 summary: {
  933 |                     shift_id: 'b3d8d076-e4ab-4fc7-9a9d-7c8b9eafc0c6', controller_id: 'c4e9e187-f5bc-40d8-8bae-8d9caf0b1d17',
  934 |                     controller_name: 'Ibrahima Gueye', controller_phone: '+221700000106', event_id: 'd5fae298-06cd-41e9-9cbf-9eadb01c2e28',
  935 |                     event_title: 'Nuit du Sabar — édition d’automne', opened_at: '2026-11-04T18:30:00.000Z', closed_at: '2026-11-04T23:45:00.000Z',
  936 |                     opening_float_amount: 10000, expected_cash_total: 23000, declared_cash_total: 21000, discrepancy_amount: -2000,
  937 |                     discrepancy_justification: 'Monnaie rendue en trop à un spectateur, signalée au régisseur.', status: 'CLOTURE', closing_confirmed_by_pin: true,
  938 |                 },
  939 |             },
  940 |         }],
  941 |         ready: async ({ page }) => startScanner(page),
  942 |         actions: async ({ page }) => {
  943 |             await openTab(page, /^caisse$/i);
  944 |             await page.getByRole('button', { name: /^clôturer ma caisse$/i }).click();
  945 |             const dialog = page.getByRole('dialog', { name: /^clôturer ma caisse$/i });
  946 |             await dialog.getByLabel(/^espèces encaissées comptées/i).fill('21000');
  947 |             await dialog.getByRole('button', { name: /^clôturer la caisse$/i }).click();
  948 |             await expect(page.getByRole('dialog', { name: /^caisse clôturée$/i })).toBeVisible();
  949 |         },
  950 |     },
  951 |     // ── Lot 7 : paiement et inscription (7.3, E4) ───────────────────────────
  952 |     {
  953 |         id: 'paiement-modale', titre: 'Paiement — modale d’achat ouverte (opérateur, numéro)', role: 'client', needsIds: true,
  954 |         path: (i) => `/events/${ids(i).events.ceSoir.id}`,
  955 |         actions: async ({ page }) => {
  956 |             await page.getByRole('button', { name: /^ajouter un billet standard/i }).click();
  957 |             // Bouton du panneau de billetterie (« Acheter 1 billet (…) ») : à 390 px la barre d'achat fixe du bas
  958 |             // (lg:hidden) porte aussi « Acheter (…) », même action ; /^acheter/ visait les deux (run 77, mode strict).
  959 |             await page.getByRole('button', { name: /^acheter \d+ billets? \(/i }).click();
  960 |             await expect(page.getByRole('dialog').or(page.getByRole('alertdialog'))).toBeVisible();
  961 |         },
  962 |     },
  963 |     {
  964 |         id: 'paiement-attente', titre: 'Paiement — en attente de validation chez l’opérateur', role: 'client', needsIds: true,
  965 |         path: (i) => `/paiement/${ids(i).payments.pending}`,
  966 |         ready: async ({ page }) => {
  967 |             await expect(page.locator('#payment-status-title')).toBeVisible({ timeout: 30_000 });
  968 |         },
  969 |     },
  970 |     {
  971 |         id: 'paiement-succes', titre: 'Paiement — confirmé (billets émis, redirection annulable)', role: 'client', needsIds: true,
  972 |         path: (i) => `/paiement/${ids(i).payments.success}`, slowTimers: { minDelayMs: 1000, factor: 100 },
  973 |         ready: async ({ page }) => {
  974 |             await expect(page.locator('#payment-status-title')).toHaveText(/paiement confirmé/i, { timeout: 30_000 });
  975 |         },
  976 |     },
  977 |     {
  978 |         id: 'paiement-echec', titre: 'Paiement — refusé (Réessayer le paiement)', role: 'client', needsIds: true,
  979 |         path: (i) => `/paiement/${ids(i).payments.failed}`,
  980 |         ready: async ({ page }) => {
  981 |             await expect(page.locator('#payment-status-title')).toHaveText(/n.a pas abouti/i, { timeout: 30_000 });
  982 |         },
  983 |     },
  984 |     {
  985 |         id: 'inscription-code', titre: 'Inscription — étape 2 : code reçu et profil (envoi du code simulé)', role: 'anonyme', needsIds: false, path: () => '/register',
  986 |         stubResponses: [{ url: /\/api\/auth\/register\/start$/, method: 'POST', status: 200, body: { ok: true, phone: '+221771234567', resend_after: 60 } }],
  987 |         ready: async ({ page }) => { await expectHeading(page, /^créer un compte$/i); },
  988 |         actions: async ({ page }) => {
  989 |             await page.getByLabel(/^numéro de téléphone/i).fill('77 123 45 67');
  990 |             await page.getByRole('button', { name: /^recevoir le code par sms$/i }).click();
  991 |             await expect(page.getByText(/^code reçu par sms$/i)).toBeVisible();
  992 |         },
  993 |     },
  994 |     // ── Lot 7 : pages partenaire migrées (7.4, E5 ; 7.0 f, E1) ──────────────
  995 |     {
  996 |         id: 'partenaire-inscription', titre: 'Inscription d’un partenaire (système de design)', role: 'anonyme', needsIds: false, path: () => '/partner/register',
  997 |         ready: async ({ page }) => expectPageTitle(page),
  998 |     },
  999 |     { id: 'partenaire-tableau-de-bord', titre: 'Partenaire — tableau de bord (chiffres servis par le serveur)', role: 'organisateur', needsIds: true, path: () => '/partner/dashboard', ready: async ({ page }) => expectPageTitle(page) },
```