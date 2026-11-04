# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · client >> billet-hors-ligne-qr (service worker autorisé) >> billet-hors-ligne-qr — Billet hors ligne — QR affiché sans réseau (page servie par le service worker)
- Location: e2e/captures.spec.ts:151:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-ev-qr-payload]')
Expected: visible
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('[data-ev-qr-payload]') with timeout 20000ms
  - waiting for locator('[data-ev-qr-payload]')

```

```yaml
- main:
  - img "Event Village": EVENT VILLAGE
  - heading "Billet hors ligne" [level=1]
  - paragraph: Affiché sans réseau à partir du billet enregistré sur ce téléphone. Présentez le QR au contrôle.
  - article "Concert des Lumières de Gorée":
    - heading "Concert des Lumières de Gorée" [level=2]
    - paragraph:
      - time: jeu. 5 nov. 2026 à 13:45
    - paragraph: Place du Gouvernement, Gorée
    - paragraph: Entrée
    - status: Disponible hors ligne à partir du jeu. 5 nov. 2026 à 07:45
    - paragraph:
      - text: Le code d’entrée s’affichera ici à partir du
      - time: jeu. 5 nov. 2026 à 07:45
      - text: ", même sans réseau."
    - paragraph: Numéro du billet TCK-20261104-42CAFF1D14
    - list:
      - listitem: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
      - listitem: "Une capture d’écran n’est pas acceptée : le code change toutes les 20 s."
      - listitem: "Sur iPhone, ouvrez Event Village depuis son icône de l’écran d’accueil, avec du réseau, avant d’arriver : le billet y reste disponible sans réseau."
  - navigation "Autres billets enregistrés sur ce téléphone":
    - heading "Autres billets enregistrés sur ce téléphone" [level=2]
    - list:
      - listitem:
        - link "Nuit du Sabar — édition d’automne mer. 4 nov. 2026 à 18:30 · TCK-20261104-C61BC45585":
          - /url: /billet/hors-ligne?id=9b3269ef-767b-4f31-9c5b-755b3983f7a9
          - text: Nuit du Sabar — édition d’automne
          - time: mer. 4 nov. 2026 à 18:30
          - text: · TCK-20261104-C61BC45585
- alert
```

# Test source

```ts
  332 |     // ── Organisateur ────────────────────────────────────────────────────────
  333 |     { id: 'partenaire-evenements', titre: 'Liste des événements de l’organisateur', role: 'organisateur', needsIds: true, path: () => '/partner/events' },
  334 |     {
  335 |         id: 'partenaire-evenements-annules', titre: 'Liste de l’organisateur — onglet Annulé', role: 'organisateur', needsIds: true, path: () => '/partner/events',
  336 |         actions: async ({ page }) => openTab(page, /^annulé/i),
  337 |     },
  338 |     {
  339 |         id: 'partenaire-evenements-erreur', titre: 'Liste de l’organisateur — état d’erreur', role: 'organisateur', needsIds: true, path: () => '/partner/events',
  340 |         injectError: /\/api\/partner\/events(\/overview)?(\?.*)?$/, ready: expectRetry,
  341 |     },
  342 |     { id: 'partenaire-creation', titre: 'Création d’un événement (formulaire partagé)', role: 'organisateur', needsIds: true, path: () => '/partner/events/new' },
  343 |     {
  344 |         id: 'partenaire-edition', titre: 'Édition d’un événement publié avec ventes (champs verrouillés)', role: 'organisateur', needsIds: true,
  345 |         path: (i) => `/partner/events/${ids(i).events.publie.id}/edit`,
  346 |     },
  347 |     tabScreen('pilotage-apercu', 'Pilotage — Aperçu', /^aperçu/i),
  348 |     tabScreen('pilotage-ventes', 'Pilotage — Ventes', /^ventes/i),
  349 |     tabScreen('pilotage-entrees', 'Pilotage — Entrées en direct', /^entrées/i),
  350 |     tabScreen('pilotage-equipe', 'Pilotage — Équipe', /^équipe/i),
  351 |     tabScreen('pilotage-caisse', 'Pilotage — Caisse', /^caisse/i),
  352 |     tabScreen('pilotage-cloture', 'Pilotage — Clôture et export', /^clôture/i),
  353 |     {
  354 |         id: 'pilotage-annulation', titre: 'Modale « Annuler l’événement » (impact, titre à retaper)', role: 'organisateur', needsIds: true, path: pilotage('publie'),
  355 |         actions: async ({ page }) => {
  356 |             await page.getByRole('button', { name: /annuler l[’']événement/i }).click();
  357 |             await expect(page.getByRole('dialog').or(page.getByRole('alertdialog'))).toBeVisible();
  358 |         },
  359 |     },
  360 |     {
  361 |         id: 'pilotage-remboursements', titre: 'Événement annulé — avancement des remboursements', role: 'organisateur', needsIds: true, path: pilotage('annule'),
  362 |         ready: async ({ page }) => { await expect(page.getByText(/remboursements/i).first()).toBeVisible(); },
  363 |     },
  364 |     {
  365 |         id: 'pilotage-erreur', titre: 'Pilotage — état d’erreur', role: 'organisateur', needsIds: true, path: pilotage('ceSoir'),
  366 |         injectError: /\/api\/partner\/events\/[^/]+\/pilotage\/overview(\?.*)?$/, ready: expectRetry,
  367 |     },
  368 |     // ── Administration ──────────────────────────────────────────────────────
  369 |     { id: 'admin-evenements', titre: 'Administration — événements (filtres, pagination)', role: 'admin', needsIds: true, path: () => '/admin/events' },
  370 |     { id: 'admin-evenements-en-attente', titre: 'Administration — file de validation', role: 'admin', needsIds: true, path: () => '/admin/events?status=EN_ATTENTE' },
  371 |     {
  372 |         id: 'admin-evenements-erreur', titre: 'Administration — état d’erreur', role: 'admin', needsIds: true, path: () => '/admin/events',
  373 |         injectError: /\/api\/admin\/events(\?.*)?$/, ready: expectRetry,
  374 |     },
  375 |     { id: 'admin-fiche-en-attente', titre: 'Administration — fiche complète avant validation', role: 'admin', needsIds: true, path: (i) => `/admin/events/${ids(i).events.enAttente.id}` },
  376 |     { id: 'admin-fiche-suspendu', titre: 'Administration — fiche d’un événement suspendu (motif, réactiver)', role: 'admin', needsIds: true, path: (i) => `/admin/events/${ids(i).events.suspendu.id}` },
  377 |     {
  378 |         id: 'admin-notifications', titre: 'Administration — supervision des notifications (liste filtrable, compteurs)', role: 'admin', needsIds: true,
  379 |         path: () => '/admin/notifications',
  380 |         ready: async ({ page }) => {
  381 |             await expectHeading(page, /^notifications$/i);
  382 |             await expect(page.getByRole('link', { name: /^voir le détail/i }).first()).toBeVisible();
  383 |         },
  384 |     },
  385 |     {
  386 |         id: 'admin-notifications-detail', titre: 'Administration — détail d’une notification en échec (Relancer)', role: 'admin', needsIds: true,
  387 |         path: (i) => `/admin/notifications/${ids(i).notifications.failedId}`,
  388 |         ready: async ({ page }) => { await expect(page.getByRole('button', { name: /^relancer$/i })).toBeVisible(); },
  389 |     },
  390 |     {
  391 |         id: 'admin-notifications-erreur', titre: 'Administration — supervision des notifications, état d’erreur', role: 'admin', needsIds: true,
  392 |         path: () => '/admin/notifications',
  393 |         injectError: /\/api\/admin\/notifications(\?.*)?$/, ready: expectRetry,
  394 |     },
  395 |     // ── Contrôle d'accès ────────────────────────────────────────────────────
  396 |     // Lot 7 (D85, E3) : thème sombre forcé, 2 vues ; après « Commencer le contrôle » (l'écran de départ est
  397 |     // capturé à part : scanner-accueil)
  398 |     {
  399 |         id: 'controleur-scanner', titre: 'Scanner du contrôleur en cours de contrôle (caméra simulée)', role: 'controleur', needsIds: true,
  400 |         path: () => '/controller/scanner', fakeCamera: true, views: DARK_VIEWS,
  401 |         ready: async ({ page }) => startScanner(page),
  402 |     },
  403 |     // ── Lot 7 : billet hors ligne (7.1, E2) ─────────────────────────────────
  404 |     {
  405 |         id: 'billet-hors-ligne-disponible', titre: 'Mes billets — billet disponible hors ligne (service worker actif)', role: 'client', needsIds: true,
  406 |         path: () => '/tickets', serviceWorkers: 'allow',
  407 |         ready: async ({ page }) => {
  408 |             await expect(page.locator('[data-ev-offline-state="available"]').first()).toBeVisible({ timeout: 45_000 });
  409 |         },
  410 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  411 |     },
  412 |     {
  413 |         id: 'billet-hors-ligne-a-telecharger', titre: 'Mes billets — billet pas encore enregistré sur le téléphone (téléchargement en cours)', role: 'client', needsIds: true,
  414 |         path: () => '/tickets', holdRequests: [{ url: OFFLINE_CODES_URL, method: 'GET' }],
  415 |         ready: async ({ page }) => {
  416 |             await expect(page.locator('[data-ev-offline-state="missing"]').first()).toBeVisible({ timeout: 30_000 });
  417 |         },
  418 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  419 |     },
  420 |     {
  421 |         id: 'billet-hors-ligne-qr', titre: 'Billet hors ligne — QR affiché sans réseau (page servie par le service worker)', role: 'client', needsIds: true,
  422 |         path: () => '/tickets', serviceWorkers: 'allow',
  423 |         ready: async (c) => {
  424 |             await expect(offlineLink(c.page, ids(c.ids).tickets.clientVeille)).toBeVisible({ timeout: 45_000 });
  425 |         },
  426 |         actions: async (c) => {
  427 |             const id = ids(c.ids).tickets.clientVeille;
  428 |             c.guard.freeze(); // passage hors ligne volontaire : la collecte d'erreurs s'arrête
  429 |             await c.context.setOffline(true);
  430 |             const res = await c.page.goto(`/billet/hors-ligne?id=${encodeURIComponent(id)}`);
  431 |             expect(res?.fromServiceWorker(), '/billet/hors-ligne hors ligne : réponse servie par le service worker').toBe(true);
> 432 |             await expect(c.page.locator('[data-ev-qr-payload]')).toBeVisible({ timeout: 20_000 });
      |                                                                  ^ Error: expect(locator).toBeVisible() failed
  433 |         },
  434 |         masks: (page) => [page.locator('[data-ev-qr-payload]')],
  435 |     },
  436 |     {
  437 |         id: 'billet-hors-ligne-sans-codes', titre: 'Billet hors ligne — aucun code enregistré sur ce téléphone, réseau coupé', role: 'client', needsIds: true,
  438 |         path: (i) => `/billet/hors-ligne?id=${encodeURIComponent(ids(i).tickets.clientVeille)}`,
  439 |         holdRequests: [{ url: OFFLINE_CODES_URL, method: 'GET' }], offline: 'after-load',
  440 |         ready: async ({ page }) => {
  441 |             await expect(page.locator('[data-ev-offline-state="offline_missing"]').first()).toBeVisible({ timeout: 20_000 });
  442 |         },
  443 |     },
  444 |     // ── Lot 7 : scanner professionnel (7.2, E3) ─────────────────────────────
  445 |     {
  446 |         id: 'scanner-accueil', titre: 'Scanner — écran « Commencer le contrôle » (événement, porte)', role: 'controleur', needsIds: true,
  447 |         path: () => '/controller/scanner', fakeCamera: true, views: DARK_VIEWS,
  448 |         ready: async ({ page }) => scannerStartReady(page),
  449 |     },
  450 |     scanResultScreen('scanner-accepte', 'Scanner — entrée validée (plein écran)', { result: 'valid', scan_id: '5d2c7a10-8e4b-4f61-9a3d-1c2b3e4f5a60', ticket: SCAN_TICKET }),
  451 |     scanResultScreen('scanner-deja-utilise', 'Scanner — billet déjà utilisé (plein écran, heure d’entrée)', {
  452 |         result: 'already_used', scan_id: '6e3d8b21-9f5c-4a72-8b4e-2d3c4f5a6b71',
  453 |         ticket: { ...SCAN_TICKET, checked_in_at: '2026-11-04T19:42:00.000Z', checked_in_by_me: false },
  454 |     }),
  455 |     scanResultScreen('scanner-refuse', 'Scanner — entrée refusée (plein écran, QR expiré)', { result: 'qr_expired', scan_id: '7f4e9c32-a06d-4b83-9c5f-3e4d5a6b7c82', ticket: SCAN_TICKET }),
  456 |     scanResultScreen('scanner-a-encaisser', 'Scanner — encaissement requis (plein écran, caisse ouverte)', {
  457 |         result: 'cash_required', scan_id: '80a5ad43-b17e-4c94-8d6a-4f5e6b7c8d93', amount_due: 5000, ticket: SCAN_TICKET,
  458 |     }),
  459 |     scanResultScreen('scanner-hors-fenetre', 'Scanner — contrôle pas encore ouvert (plein écran)', { result: 'event_not_open', scan_id: '91b6be54-c28f-4da5-9e7b-5a6f7c8d9ea4' }),
  460 |     scanResultScreen('scanner-evenement-annule', 'Scanner — événement annulé (plein écran)', { result: 'event_cancelled', scan_id: 'a2c7cf65-d39a-4eb6-8f8c-6b7a8d9eafb5' }),
  461 |     {
  462 |         id: 'scanner-reseau-lent', titre: 'Scanner — réseau lent (envoi retenu, nouvel essai automatique)', role: 'controleur', needsIds: true,
  463 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: 'barcode-detector', initStorage: SCANNER_STORAGE, slowTimers: SCANNER_TIMERS,
  464 |         holdRequests: [{ url: SCAN_URL, method: 'POST' }], allowFailures: [SCAN_URL],
  465 |         ready: async ({ page }) => startScanner(page),
  466 |         actions: async (c) => {
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
```