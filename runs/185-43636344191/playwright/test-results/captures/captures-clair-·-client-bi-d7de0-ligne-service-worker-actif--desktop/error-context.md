# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · client >> billet-hors-ligne-disponible (service worker autorisé) >> billet-hors-ligne-disponible — Mes billets — billet disponible hors ligne (service worker actif)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-ev-offline-state="available"]').first()
Expected: visible
Timeout: 45000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('[data-ev-offline-state="available"]').first() with timeout 45000ms
  - waiting for locator('[data-ev-offline-state="available"]').first()

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
  - button "Basculer le thème"
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
    - tab "À venir" [selected]
    - tab "Tous mes billets"
    - tab "Historique"
    - tab "Reçus , 1"
  - tabpanel "À venir":
    - list:
      - listitem:
        - article "Billet pour Concert des Lumières de Gorée":
          - text: Valable
          - heading "Concert des Lumières de Gorée" [level=2]
          - paragraph: Baobab Scène
          - term: Date
          - definition: 15 NOV 2026
          - term: Heure d’accès
          - definition: 17:00
          - term: Lieu
          - definition: Place du Gouvernement
          - term: Catégorie
          - definition: Entrée
          - term: Prix
          - definition: 6 000 F CFA
          - term: Frais de service
          - definition: 300 F CFA
          - img "QR d’entrée dynamique"
          - paragraph: "Numéro du billet : TCK-20261114-4FBBA7A66F"
          - text: Code renouvelé toutes les 20 s Nouveau code dans 14 secondes
          - paragraph: Une capture d’écran n’est pas acceptée au contrôle.
          - paragraph: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
          - status: Ouvrez ce billet avec du réseau avant d’arriver
          - paragraph: Billet authentique, émis par Event Village
          - paragraph: Présentez ce code au contrôle, billet ouvert dans l’application.
          - button "Transférer"
          - button "Partager le lien de l’événement sur WhatsApp": WhatsApp
          - button "Partager ou copier le lien de l’événement": Lien
          - button "Télécharger le billet en PDF": PDF
          - button "Aide au transfert"
      - listitem:
        - article "Billet pour Festival Jazz sur le Fleuve":
          - text: Valable
          - heading "Festival Jazz sur le Fleuve" [level=2]
          - paragraph: Baobab Scène
          - term: Date
          - definition: 26 NOV 2026
          - term: Heure d’accès
          - definition: 18:00
          - term: Lieu
          - definition: Quai des Pêcheurs
          - term: Catégorie
          - definition: Pass soirée
          - term: Prix
          - definition: 7 500 F CFA
          - term: Frais de service
          - definition: 375 F CFA
          - img "QR d’entrée dynamique"
          - paragraph: "Numéro du billet : TCK-20261114-1E6C0ED1A4"
          - text: Code renouvelé toutes les 20 s Nouveau code dans 14 secondes
          - paragraph: Une capture d’écran n’est pas acceptée au contrôle.
          - paragraph: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
          - status: Disponible hors ligne à partir du mer. 25 nov. 2026 à 18:00
          - paragraph: Billet authentique, émis par Event Village
          - paragraph: Présentez ce code au contrôle, billet ouvert dans l’application.
          - button "Transférer"
          - button "Partager le lien de l’événement sur WhatsApp": WhatsApp
          - button "Partager ou copier le lien de l’événement": Lien
          - button "Télécharger le billet en PDF": PDF
          - button "Aide au transfert"
      - listitem:
        - article "Billet pour Nuit du Sabar — édition d’automne":
          - text: Valable
          - heading "Nuit du Sabar — édition d’automne" [level=2]
          - paragraph: Baobab Scène
          - term: Date
          - definition: 14 NOV 2026
          - term: Heure d’accès
          - definition: 21:45
          - term: Lieu
          - definition: Esplanade de la Corniche Ouest
          - term: Catégorie
          - definition: Standard
          - term: Prix
          - definition: 5 000 F CFA
          - term: Frais de service
          - definition: 250 F CFA
          - img "QR d’entrée dynamique"
          - paragraph: "Numéro du billet : TCK-20261114-E85F2547C1"
          - text: Code renouvelé toutes les 20 s Nouveau code dans 14 secondes
          - paragraph: Une capture d’écran n’est pas acceptée au contrôle.
          - paragraph: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
          - status: Ouvrez ce billet avec du réseau avant d’arriver
          - paragraph: Billet authentique, émis par Event Village
          - paragraph: Présentez ce code au contrôle, billet ouvert dans l’application.
          - button "Transférer"
          - button "Partager le lien de l’événement sur WhatsApp": WhatsApp
          - button "Partager ou copier le lien de l’événement": Lien
          - button "Télécharger le billet en PDF": PDF
          - button "Aide au transfert"
- alert
```

# Test source

```ts
  941  |             await c.page.getByLabel(/^numéro du billet/i).fill(number);
  942  |             const found = c.page.waitForResponse((r) => new URL(r.url()).pathname.endsWith('/tickets/lookup'));
  943  |             await c.page.getByRole('button', { name: /^rechercher le billet$/i }).click();
  944  |             expect((await found).status(), `recherche du billet ${number}`).toBe(200);
  945  |             const refund = c.page.getByRole('button', { name: /^rembourser ce billet$/i });
  946  |             await expect(refund).toBeVisible();
  947  |             await expect(c.page.getByRole('button', { name: /^annuler ce billet gratuit$/i }), 'billet payant : jamais l’action du billet gratuit').toHaveCount(0);
  948  |             // Le motif se quitte sans rien envoyer : capture de la fiche, pas d'un remboursement
  949  |             await refund.click();
  950  |             const reason = c.page.getByRole('dialog', { name: /^motif du remboursement$/i });
  951  |             await reason.getByRole('button', { name: /^revenir à la fiche$/i }).click();
  952  |             await expect(reason).toBeHidden();
  953  |             await revealCenter(refund);
  954  |         },
  955  |     },
  956  |     tabScreen('pilotage-entrees', 'Pilotage — Entrées en direct', /^entrées/i),
  957  |     tabScreen('pilotage-equipe', 'Pilotage — Équipe', /^équipe/i),
  958  |     tabScreen('pilotage-caisse', 'Pilotage — Caisse', /^caisse/i),
  959  |     tabScreen('pilotage-cloture', 'Pilotage — Clôture et export', /^clôture/i),
  960  |     {
  961  |         id: 'pilotage-annulation', titre: 'Modale « Annuler l’événement » (impact, titre à retaper)', role: 'organisateur', needsIds: true, path: pilotage('publie'),
  962  |         actions: async ({ page }) => {
  963  |             await page.getByRole('button', { name: /annuler l[’']événement/i }).click();
  964  |             await expect(page.getByRole('dialog').or(page.getByRole('alertdialog'))).toBeVisible();
  965  |         },
  966  |     },
  967  |     {
  968  |         id: 'pilotage-remboursements', titre: 'Événement annulé — avancement des remboursements', role: 'organisateur', needsIds: true, path: pilotage('annule'),
  969  |         ready: async ({ page }) => { await expect(page.getByText(/remboursements/i).first()).toBeVisible(); },
  970  |     },
  971  |     {
  972  |         id: 'pilotage-erreur', titre: 'Pilotage — état d’erreur', role: 'organisateur', needsIds: true, path: pilotage('ceSoir'),
  973  |         injectError: /\/api\/partner\/events\/[^/]+\/pilotage\/overview(\?.*)?$/, ready: expectRetry,
  974  |     },
  975  |     // ── Administration ──────────────────────────────────────────────────────
  976  |     { id: 'admin-evenements', titre: 'Administration — événements (filtres, pagination)', role: 'admin', needsIds: true, path: () => '/admin/events' },
  977  |     { id: 'admin-evenements-en-attente', titre: 'Administration — file de validation', role: 'admin', needsIds: true, path: () => '/admin/events?status=EN_ATTENTE' },
  978  |     {
  979  |         id: 'admin-evenements-erreur', titre: 'Administration — état d’erreur', role: 'admin', needsIds: true, path: () => '/admin/events',
  980  |         injectError: /\/api\/admin\/events(\?.*)?$/, ready: expectRetry,
  981  |     },
  982  |     { id: 'admin-fiche-en-attente', titre: 'Administration — fiche complète avant validation', role: 'admin', needsIds: true, path: (i) => `/admin/events/${ids(i).events.enAttente.id}` },
  983  |     { id: 'admin-fiche-suspendu', titre: 'Administration — fiche d’un événement suspendu (motif, réactiver)', role: 'admin', needsIds: true, path: (i) => `/admin/events/${ids(i).events.suspendu.id}` },
  984  |     {
  985  |         id: 'admin-notifications', titre: 'Administration — supervision des notifications (liste filtrable, compteurs)', role: 'admin', needsIds: true,
  986  |         path: () => '/admin/notifications',
  987  |         ready: async ({ page }) => {
  988  |             await expectHeading(page, /^notifications$/i);
  989  |             await expect(page.getByRole('link', { name: /^voir le détail/i }).first()).toBeVisible();
  990  |         },
  991  |         actions: expectFrenchDateField,
  992  |     },
  993  |     {
  994  |         id: 'admin-notifications-detail', titre: 'Administration — détail d’une notification en échec (Relancer)', role: 'admin', needsIds: true,
  995  |         path: (i) => `/admin/notifications/${ids(i).notifications.failedId}`,
  996  |         ready: async ({ page }) => { await expect(page.getByRole('button', { name: /^relancer$/i })).toBeVisible(); },
  997  |     },
  998  |     {
  999  |         id: 'admin-notifications-erreur', titre: 'Administration — supervision des notifications, état d’erreur', role: 'admin', needsIds: true,
  1000 |         path: () => '/admin/notifications',
  1001 |         injectError: /\/api\/admin\/notifications(\?.*)?$/,
  1002 |         // L'état d'erreur est sous les compteurs et les filtres : à 390 px, il était hors de l'image (run 77)
  1003 |         ready: async (c) => {
  1004 |             await expectRetry(c);
  1005 |             await revealCenter(c.page.getByRole('button', { name: /réessayer/i }));
  1006 |         },
  1007 |     },
  1008 |     {
  1009 |         id: 'admin-services-desactive', titre: 'Administration — services : mention « Service désactivé » (interrupteur fermé)', role: 'admin', needsIds: true,
  1010 |         path: () => '/admin/services?tab=salles',
  1011 |         ready: async ({ page }) => {
  1012 |             await expect(page.getByRole('tab', { name: /^salles de fête/i })).toHaveAttribute('aria-selected', 'true');
  1013 |             await expect(page.getByText('Service désactivé', { exact: true })).toBeVisible();
  1014 |             await expect(page.getByText('Ce service est fermé par son interrupteur : il est masqué au public. Les données restent consultables ici.')).toBeVisible();
  1015 |         },
  1016 |     },
  1017 |     {
  1018 |         // Lot 9 bis (7.3, B114) : sous fumee-superadmin, réponse au format du contrat 4.1 ; voir l'en-tête du fichier
  1019 |         id: 'admin-remboursements-a-reprendre', titre: 'Administration — finances : versements à reprendre (Renvoyer, Marquer versé ; réponses imposées)',
  1020 |         role: 'fumee-superadmin', needsIds: false, path: () => '/admin/finance',
  1021 |         stubResponses: CASHOUTS_STUBS,
  1022 |         ready: async ({ page }) => {
  1023 |             const { resend } = await cashoutsReady(page);
  1024 |             await revealCenter(resend.first());
  1025 |         },
  1026 |     },
  1027 |     // ── Contrôle d'accès ────────────────────────────────────────────────────
  1028 |     // Lot 7 (D85, E3) : thème sombre forcé, 2 vues ; après « Commencer le contrôle » (l'écran de départ est
  1029 |     // capturé à part : scanner-accueil)
  1030 |     {
  1031 |         id: 'controleur-scanner', titre: 'Scanner du contrôleur en cours de contrôle (caméra simulée)', role: 'controleur', needsIds: true,
  1032 |         path: () => '/controller/scanner', fakeCamera: true, views: DARK_VIEWS,
  1033 |         ready: async ({ page }) => startScanner(page),
  1034 |     },
  1035 |     // ── Lot 7 : billet hors ligne (7.1, E2) ─────────────────────────────────
  1036 |     {
  1037 |         id: 'billet-hors-ligne-disponible', titre: 'Mes billets — billet disponible hors ligne (service worker actif)', role: 'client', needsIds: true,
  1038 |         path: () => '/tickets?tab=a-venir', serviceWorkers: 'allow', // A10 (R45) : onglet des billets demandé, sinon « Reçus » d'office
  1039 |         ready: async ({ page }) => {
  1040 |             const state = page.locator('[data-ev-offline-state="available"]').first();
> 1041 |             await expect(state).toBeVisible({ timeout: 45_000 });
       |                                 ^ Error: expect(locator).toBeVisible() failed
  1042 |             // L'indicateur est sous l'affiche et le QR : sans défilement, aucune image ne le montrait (run 77)
  1043 |             await revealCenter(state);
  1044 |         },
  1045 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  1046 |     },
  1047 |     {
  1048 |         id: 'billet-hors-ligne-a-telecharger', titre: 'Mes billets — billet pas encore enregistré sur le téléphone (téléchargement en cours)', role: 'client', needsIds: true,
  1049 |         path: () => '/tickets?tab=a-venir', holdRequests: [{ url: OFFLINE_CODES_URL, method: 'GET' }], // A10 (R45)
  1050 |         ready: async ({ page }) => {
  1051 |             const state = page.locator('[data-ev-offline-state="missing"]').first();
  1052 |             await expect(state).toBeVisible({ timeout: 30_000 });
  1053 |             await revealCenter(state); // même raison que billet-hors-ligne-disponible
  1054 |         },
  1055 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  1056 |     },
  1057 |     {
  1058 |         id: 'billet-hors-ligne-qr', titre: 'Billet hors ligne — QR affiché sans réseau (page servie par le service worker)', role: 'client', needsIds: true,
  1059 |         path: () => '/tickets?tab=a-venir', serviceWorkers: 'allow', // A10 (R45)
  1060 |         // Billet de « ce soir » (contrôle déjà ouvert), pas celui de « la veille » : le seed ne modifie pas
  1061 |         // access.scan_window_before_hours, donc le lot téléchargé la veille commence à l'ouverture du contrôle
  1062 |         // (début − before_hours, D31) et la page affiche à juste titre « Le code d'entrée s'affichera ici à partir
  1063 |         // du … » sans QR (run 77). Le billet de « la veille » reste celui de billet-hors-ligne-sans-codes.
  1064 |         ready: async (c) => {
  1065 |             await expect(offlineLink(c.page, ids(c.ids).tickets.clientValide)).toBeVisible({ timeout: 45_000 });
  1066 |         },
  1067 |         actions: async (c) => {
  1068 |             const id = ids(c.ids).tickets.clientValide;
  1069 |             c.guard.freeze(); // passage hors ligne volontaire : la collecte d'erreurs s'arrête
  1070 |             await c.context.setOffline(true);
  1071 |             const res = await c.page.goto(`/billet/hors-ligne?id=${encodeURIComponent(id)}`);
  1072 |             expect(res?.fromServiceWorker(), '/billet/hors-ligne hors ligne : réponse servie par le service worker').toBe(true);
  1073 |             await expect(c.page.locator('[data-ev-qr-payload]')).toBeVisible({ timeout: 20_000 });
  1074 |         },
  1075 |         masks: (page) => [page.locator('[data-ev-qr-payload]')],
  1076 |     },
  1077 |     {
  1078 |         id: 'billet-hors-ligne-sans-codes', titre: 'Billet hors ligne — aucun code enregistré sur ce téléphone, réseau coupé', role: 'client', needsIds: true,
  1079 |         path: (i) => `/billet/hors-ligne?id=${encodeURIComponent(ids(i).tickets.clientVeille)}`,
  1080 |         holdRequests: [{ url: OFFLINE_CODES_URL, method: 'GET' }], offline: 'after-load',
  1081 |         ready: async ({ page }) => {
  1082 |             await expect(page.locator('[data-ev-offline-state="offline_missing"]').first()).toBeVisible({ timeout: 20_000 });
  1083 |         },
  1084 |     },
  1085 |     // ── Lot 7 : scanner professionnel (7.2, E3) ─────────────────────────────
  1086 |     {
  1087 |         id: 'scanner-accueil', titre: 'Scanner — écran « Commencer le contrôle » (événement, porte)', role: 'controleur', needsIds: true,
  1088 |         path: () => '/controller/scanner', fakeCamera: true, views: DARK_VIEWS,
  1089 |         ready: async ({ page }) => scannerStartReady(page),
  1090 |     },
  1091 |     scanResultScreen('scanner-accepte', 'Scanner — entrée validée (plein écran)', { result: 'valid', scan_id: '5d2c7a10-8e4b-4f61-9a3d-1c2b3e4f5a60', ticket: SCAN_TICKET }),
  1092 |     // Lot 9 ter (consigne 2, C.4, X5) : porte d'entrée servie ; ligne « Déjà utilisé à {HH:MM}, {porte} » et rouge #991B1B
  1093 |     withExtraActions(
  1094 |         scanResultScreen('scanner-deja-utilise', 'Scanner — billet déjà utilisé (plein écran, heure d’entrée)', {
  1095 |             result: 'already_used', scan_id: '6e3d8b21-9f5c-4a72-8b4e-2d3c4f5a6b71',
  1096 |             ticket: { ...SCAN_TICKET, checked_in_at: '2026-11-04T19:42:00.000Z', checked_in_by_me: false, checked_in_gate: 'Porte Nord' },
  1097 |         }),
  1098 |         async ({ page }) => {
  1099 |             const overlay = scanOverlay(page);
  1100 |             await expect(overlay.getByText('Déjà utilisé à 19:42, Porte Nord', { exact: true }), 'heure et porte de la première entrée (C.2.4, X5)').toBeVisible();
  1101 |             await expect(overlay, 'fond du jeton scan-used : rouge #991B1B (C.2.4)').toHaveCSS('background-color', SCAN_USED_RED);
  1102 |         },
  1103 |     ),
  1104 |     scanResultScreen('scanner-refuse', 'Scanner — entrée refusée (plein écran, QR expiré)', { result: 'qr_expired', scan_id: '7f4e9c32-a06d-4b83-9c5f-3e4d5a6b7c82', ticket: SCAN_TICKET }),
  1105 |     scanResultScreen('scanner-hors-fenetre', 'Scanner — contrôle pas encore ouvert (plein écran)', { result: 'event_not_open', scan_id: '91b6be54-c28f-4da5-9e7b-5a6f7c8d9ea4' }),
  1106 |     scanResultScreen('scanner-evenement-annule', 'Scanner — événement annulé (plein écran)', { result: 'event_cancelled', scan_id: 'a2c7cf65-d39a-4eb6-8f8c-6b7a8d9eafb5' }),
  1107 |     // Lot 8 (8.2 e, contrat 3.5) : réponse d'un renvoi sans ligne, ni scan_id ni ticket ; le parcours réel est au projet terrain
  1108 |     scanResultScreen('scanner-non-traite', 'Scanner — scan non traité après un renvoi (plein écran)', {
  1109 |         result: 'not_processed', code: 'REPLAY_NOT_FOUND', message: 'Scan non traité : aucune entrée enregistrée. Scannez le billet de nouveau.',
  1110 |     }),
  1111 |     {
  1112 |         id: 'scanner-reseau-lent', titre: 'Scanner — réseau lent (envoi retenu, nouvel essai automatique)', role: 'controleur', needsIds: true,
  1113 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: 'barcode-detector', initStorage: SCANNER_STORAGE, slowTimers: SCANNER_TIMERS,
  1114 |         holdRequests: [{ url: SCAN_URL, method: 'POST' }], allowFailures: [SCAN_URL],
  1115 |         ready: async ({ page }) => startScanner(page),
  1116 |         actions: async (c) => {
  1117 |             await presentToFakeDetector(c.page, demoPayload(c));
  1118 |             await expect(c.page.locator('[data-scan-state="slow"]')).toBeVisible({ timeout: 10_000 });
  1119 |         },
  1120 |     },
  1121 |     {
  1122 |         id: 'scanner-hors-ligne', titre: 'Scanner — hors ligne (bandeau permanent, rien n’est validé)', role: 'controleur', needsIds: true,
  1123 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: 'barcode-detector',
  1124 |         ready: async ({ page }) => startScanner(page),
  1125 |         actions: async ({ page, context, guard }) => {
  1126 |             guard.freeze(); // passage hors ligne volontaire après le chargement
  1127 |             await context.setOffline(true);
  1128 |             await expect(page.locator('[data-scan-state="offline"]')).toBeVisible({ timeout: 10_000 });
  1129 |         },
  1130 |     },
  1131 |     {
  1132 |         id: 'scanner-saisie-manuelle', titre: 'Scanner — saisie manuelle, étape « Vérifier » (titulaire affiché)', role: 'controleur', needsIds: true,
  1133 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  1134 |         ready: async ({ page }) => startScanner(page),
  1135 |         actions: async (c) => {
  1136 |             const number = ids(c.ids).tickets.manualLookup.number;
  1137 |             await c.page.getByRole('button', { name: /^saisie manuelle$/i }).click();
  1138 |             await c.page.getByLabel(/^numéro du billet/i).fill(number);
  1139 |             await c.page.getByRole('button', { name: /^vérifier le billet$/i }).click();
  1140 |             await expect(c.page.getByRole('heading', { name: new RegExp(`billet ${number}`, 'i') })).toBeVisible();
  1141 |             await expect(c.page.getByText(/^titulaire$/i)).toBeVisible();
```