# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · controleur >> scanner-deja-utilise — Scanner — billet déjà utilisé (plein écran, heure d’entrée)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: heure et porte de la première entrée (C.2.4, X5)

expect(locator).toBeVisible() failed

Locator: locator('[data-scan-state="result"]').getByText('Déjà utilisé à 19:42, Porte Nord', { exact: true })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - heure et porte de la première entrée (C.2.4, X5) locator('[data-scan-state="result"]').getByText('Déjà utilisé à 19:42, Porte Nord', { exact: true }) with timeout 15000ms
  - waiting for locator('[data-scan-state="result"]').getByText('Déjà utilisé à 19:42, Porte Nord', { exact: true })

```

```yaml
- banner:
  - link "Mon espace client":
    - /url: /
  - link "Event Village, accueil":
    - /url: /
  - button "Notifications, 1 non lue": "1"
  - link "Ibrahima Gueye":
    - /url: /controller/profile
- main:
  - heading "Nuit du Sabar — édition d’automne" [level=1]
  - paragraph:
    - status: "Entrée principale : 54 entrées"
    - text: En ligne
  - button "Changer d’événement"
  - button "Se déconnecter"
  - tablist "Espace du contrôleur":
    - tab "Contrôle" [selected]
    - tab "Guichet"
    - tab "Caisse"
  - tabpanel "Contrôle":
    - text: Détection en pause
    - group "Mode de contrôle":
      - button "Caméra" [pressed]
      - button "Saisie manuelle"
    - 'button "Derniers scans Vous : 32 entrées, 5 refus"'
    - group: Réglages de cet appareil
  - alert:
    - paragraph: Billet déjà utilisé
    - paragraph: Fatou Mbaye
    - paragraph: Entré à 19:42
    - paragraph: "Billet : Standard · TCK-20261104-7C2D9A4B1E"
    - paragraph: Retour automatique au scan · touchez pour passer
- alert
```

# Test source

```ts
  999  |         path: () => '/admin/notifications',
  1000 |         injectError: /\/api\/admin\/notifications(\?.*)?$/,
  1001 |         // L'état d'erreur est sous les compteurs et les filtres : à 390 px, il était hors de l'image (run 77)
  1002 |         ready: async (c) => {
  1003 |             await expectRetry(c);
  1004 |             await revealCenter(c.page.getByRole('button', { name: /réessayer/i }));
  1005 |         },
  1006 |     },
  1007 |     {
  1008 |         id: 'admin-services-desactive', titre: 'Administration — services : mention « Service désactivé » (interrupteur fermé)', role: 'admin', needsIds: true,
  1009 |         path: () => '/admin/services?tab=salles',
  1010 |         ready: async ({ page }) => {
  1011 |             await expect(page.getByRole('tab', { name: /^salles de fête/i })).toHaveAttribute('aria-selected', 'true');
  1012 |             await expect(page.getByText('Service désactivé', { exact: true })).toBeVisible();
  1013 |             await expect(page.getByText('Ce service est fermé par son interrupteur : il est masqué au public. Les données restent consultables ici.')).toBeVisible();
  1014 |         },
  1015 |     },
  1016 |     {
  1017 |         // Lot 9 bis (7.3, B114) : sous fumee-superadmin, réponse au format du contrat 4.1 ; voir l'en-tête du fichier
  1018 |         id: 'admin-remboursements-a-reprendre', titre: 'Administration — finances : versements à reprendre (Renvoyer, Marquer versé ; réponses imposées)',
  1019 |         role: 'fumee-superadmin', needsIds: false, path: () => '/admin/finance',
  1020 |         stubResponses: CASHOUTS_STUBS,
  1021 |         ready: async ({ page }) => {
  1022 |             const { resend } = await cashoutsReady(page);
  1023 |             await revealCenter(resend.first());
  1024 |         },
  1025 |     },
  1026 |     // ── Contrôle d'accès ────────────────────────────────────────────────────
  1027 |     // Lot 7 (D85, E3) : thème sombre forcé, 2 vues ; après « Commencer le contrôle » (l'écran de départ est
  1028 |     // capturé à part : scanner-accueil)
  1029 |     {
  1030 |         id: 'controleur-scanner', titre: 'Scanner du contrôleur en cours de contrôle (caméra simulée)', role: 'controleur', needsIds: true,
  1031 |         path: () => '/controller/scanner', fakeCamera: true, views: DARK_VIEWS,
  1032 |         ready: async ({ page }) => startScanner(page),
  1033 |     },
  1034 |     // ── Lot 7 : billet hors ligne (7.1, E2) ─────────────────────────────────
  1035 |     {
  1036 |         id: 'billet-hors-ligne-disponible', titre: 'Mes billets — billet disponible hors ligne (service worker actif)', role: 'client', needsIds: true,
  1037 |         path: () => '/tickets?tab=a-venir', serviceWorkers: 'allow', // A10 (R45) : onglet des billets demandé, sinon « Reçus » d'office
  1038 |         ready: async ({ page }) => {
  1039 |             const state = page.locator('[data-ev-offline-state="available"]').first();
  1040 |             await expect(state).toBeVisible({ timeout: 45_000 });
  1041 |             // L'indicateur est sous l'affiche et le QR : sans défilement, aucune image ne le montrait (run 77)
  1042 |             await revealCenter(state);
  1043 |         },
  1044 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  1045 |     },
  1046 |     {
  1047 |         id: 'billet-hors-ligne-a-telecharger', titre: 'Mes billets — billet pas encore enregistré sur le téléphone (téléchargement en cours)', role: 'client', needsIds: true,
  1048 |         path: () => '/tickets?tab=a-venir', holdRequests: [{ url: OFFLINE_CODES_URL, method: 'GET' }], // A10 (R45)
  1049 |         ready: async ({ page }) => {
  1050 |             const state = page.locator('[data-ev-offline-state="missing"]').first();
  1051 |             await expect(state).toBeVisible({ timeout: 30_000 });
  1052 |             await revealCenter(state); // même raison que billet-hors-ligne-disponible
  1053 |         },
  1054 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  1055 |     },
  1056 |     {
  1057 |         id: 'billet-hors-ligne-qr', titre: 'Billet hors ligne — QR affiché sans réseau (page servie par le service worker)', role: 'client', needsIds: true,
  1058 |         path: () => '/tickets?tab=a-venir', serviceWorkers: 'allow', // A10 (R45)
  1059 |         // Billet de « ce soir » (contrôle déjà ouvert), pas celui de « la veille » : le seed ne modifie pas
  1060 |         // access.scan_window_before_hours, donc le lot téléchargé la veille commence à l'ouverture du contrôle
  1061 |         // (début − before_hours, D31) et la page affiche à juste titre « Le code d'entrée s'affichera ici à partir
  1062 |         // du … » sans QR (run 77). Le billet de « la veille » reste celui de billet-hors-ligne-sans-codes.
  1063 |         ready: async (c) => {
  1064 |             await expect(offlineLink(c.page, ids(c.ids).tickets.clientValide)).toBeVisible({ timeout: 45_000 });
  1065 |         },
  1066 |         actions: async (c) => {
  1067 |             const id = ids(c.ids).tickets.clientValide;
  1068 |             c.guard.freeze(); // passage hors ligne volontaire : la collecte d'erreurs s'arrête
  1069 |             await c.context.setOffline(true);
  1070 |             const res = await c.page.goto(`/billet/hors-ligne?id=${encodeURIComponent(id)}`);
  1071 |             expect(res?.fromServiceWorker(), '/billet/hors-ligne hors ligne : réponse servie par le service worker').toBe(true);
  1072 |             await expect(c.page.locator('[data-ev-qr-payload]')).toBeVisible({ timeout: 20_000 });
  1073 |         },
  1074 |         masks: (page) => [page.locator('[data-ev-qr-payload]')],
  1075 |     },
  1076 |     {
  1077 |         id: 'billet-hors-ligne-sans-codes', titre: 'Billet hors ligne — aucun code enregistré sur ce téléphone, réseau coupé', role: 'client', needsIds: true,
  1078 |         path: (i) => `/billet/hors-ligne?id=${encodeURIComponent(ids(i).tickets.clientVeille)}`,
  1079 |         holdRequests: [{ url: OFFLINE_CODES_URL, method: 'GET' }], offline: 'after-load',
  1080 |         ready: async ({ page }) => {
  1081 |             await expect(page.locator('[data-ev-offline-state="offline_missing"]').first()).toBeVisible({ timeout: 20_000 });
  1082 |         },
  1083 |     },
  1084 |     // ── Lot 7 : scanner professionnel (7.2, E3) ─────────────────────────────
  1085 |     {
  1086 |         id: 'scanner-accueil', titre: 'Scanner — écran « Commencer le contrôle » (événement, porte)', role: 'controleur', needsIds: true,
  1087 |         path: () => '/controller/scanner', fakeCamera: true, views: DARK_VIEWS,
  1088 |         ready: async ({ page }) => scannerStartReady(page),
  1089 |     },
  1090 |     scanResultScreen('scanner-accepte', 'Scanner — entrée validée (plein écran)', { result: 'valid', scan_id: '5d2c7a10-8e4b-4f61-9a3d-1c2b3e4f5a60', ticket: SCAN_TICKET }),
  1091 |     // Lot 9 ter (consigne 2, C.4, X5) : porte d'entrée servie ; ligne « Déjà utilisé à {HH:MM}, {porte} » et rouge #991B1B
  1092 |     withExtraActions(
  1093 |         scanResultScreen('scanner-deja-utilise', 'Scanner — billet déjà utilisé (plein écran, heure d’entrée)', {
  1094 |             result: 'already_used', scan_id: '6e3d8b21-9f5c-4a72-8b4e-2d3c4f5a6b71',
  1095 |             ticket: { ...SCAN_TICKET, checked_in_at: '2026-11-04T19:42:00.000Z', checked_in_by_me: false, checked_in_gate: 'Porte Nord' },
  1096 |         }),
  1097 |         async ({ page }) => {
  1098 |             const overlay = scanOverlay(page);
> 1099 |             await expect(overlay.getByText('Déjà utilisé à 19:42, Porte Nord', { exact: true }), 'heure et porte de la première entrée (C.2.4, X5)').toBeVisible();
       |                                                                                                                                                      ^ Error: heure et porte de la première entrée (C.2.4, X5)
  1100 |             await expect(overlay, 'fond du jeton scan-used : rouge #991B1B (C.2.4)').toHaveCSS('background-color', SCAN_USED_RED);
  1101 |         },
  1102 |     ),
  1103 |     scanResultScreen('scanner-refuse', 'Scanner — entrée refusée (plein écran, QR expiré)', { result: 'qr_expired', scan_id: '7f4e9c32-a06d-4b83-9c5f-3e4d5a6b7c82', ticket: SCAN_TICKET }),
  1104 |     scanResultScreen('scanner-hors-fenetre', 'Scanner — contrôle pas encore ouvert (plein écran)', { result: 'event_not_open', scan_id: '91b6be54-c28f-4da5-9e7b-5a6f7c8d9ea4' }),
  1105 |     scanResultScreen('scanner-evenement-annule', 'Scanner — événement annulé (plein écran)', { result: 'event_cancelled', scan_id: 'a2c7cf65-d39a-4eb6-8f8c-6b7a8d9eafb5' }),
  1106 |     // Lot 8 (8.2 e, contrat 3.5) : réponse d'un renvoi sans ligne, ni scan_id ni ticket ; le parcours réel est au projet terrain
  1107 |     scanResultScreen('scanner-non-traite', 'Scanner — scan non traité après un renvoi (plein écran)', {
  1108 |         result: 'not_processed', code: 'REPLAY_NOT_FOUND', message: 'Scan non traité : aucune entrée enregistrée. Scannez le billet de nouveau.',
  1109 |     }),
  1110 |     {
  1111 |         id: 'scanner-reseau-lent', titre: 'Scanner — réseau lent (envoi retenu, nouvel essai automatique)', role: 'controleur', needsIds: true,
  1112 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: 'barcode-detector', initStorage: SCANNER_STORAGE, slowTimers: SCANNER_TIMERS,
  1113 |         holdRequests: [{ url: SCAN_URL, method: 'POST' }], allowFailures: [SCAN_URL],
  1114 |         ready: async ({ page }) => startScanner(page),
  1115 |         actions: async (c) => {
  1116 |             await presentToFakeDetector(c.page, demoPayload(c));
  1117 |             await expect(c.page.locator('[data-scan-state="slow"]')).toBeVisible({ timeout: 10_000 });
  1118 |         },
  1119 |     },
  1120 |     {
  1121 |         id: 'scanner-hors-ligne', titre: 'Scanner — hors ligne (bandeau permanent, rien n’est validé)', role: 'controleur', needsIds: true,
  1122 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: 'barcode-detector',
  1123 |         ready: async ({ page }) => startScanner(page),
  1124 |         actions: async ({ page, context, guard }) => {
  1125 |             guard.freeze(); // passage hors ligne volontaire après le chargement
  1126 |             await context.setOffline(true);
  1127 |             await expect(page.locator('[data-scan-state="offline"]')).toBeVisible({ timeout: 10_000 });
  1128 |         },
  1129 |     },
  1130 |     {
  1131 |         id: 'scanner-saisie-manuelle', titre: 'Scanner — saisie manuelle, étape « Vérifier » (titulaire affiché)', role: 'controleur', needsIds: true,
  1132 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  1133 |         ready: async ({ page }) => startScanner(page),
  1134 |         actions: async (c) => {
  1135 |             const number = ids(c.ids).tickets.manualLookup.number;
  1136 |             await c.page.getByRole('button', { name: /^saisie manuelle$/i }).click();
  1137 |             await c.page.getByLabel(/^numéro du billet/i).fill(number);
  1138 |             await c.page.getByRole('button', { name: /^vérifier le billet$/i }).click();
  1139 |             await expect(c.page.getByRole('heading', { name: new RegExp(`billet ${number}`, 'i') })).toBeVisible();
  1140 |             await expect(c.page.getByText(/^titulaire$/i)).toBeVisible();
  1141 |         },
  1142 |     },
  1143 |     {
  1144 |         id: 'scanner-guichet', titre: 'Scanner — onglet Guichet, devis servi par le serveur', role: 'controleur', needsIds: true,
  1145 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  1146 |         ready: async ({ page }) => startScanner(page),
  1147 |         actions: async ({ page }) => {
  1148 |             await openTab(page, /^guichet$/i);
  1149 |             await page.getByRole('button', { name: /^ajouter un billet standard$/i }).click();
  1150 |             await expect(page.getByRole('region', { name: /^total à encaisser$/i })).toBeVisible();
  1151 |             // Lot 8 (T23) : catégorie vendue au guichet seulement, reconnue d'un coup d'œil
  1152 |             const press = page.getByRole('list', { name: /^catégories en vente$/i }).getByRole('listitem').filter({ hasText: 'Carré presse' });
  1153 |             const mention = press.getByText('Sur place uniquement', { exact: true });
  1154 |             await expect(mention).toBeVisible();
  1155 |             expect(await fontSizePx(mention), 'taille de la mention « Sur place uniquement », en pixels').toBeGreaterThanOrEqual(14);
  1156 |             await revealCenter(mention);
  1157 |         },
  1158 |     },
  1159 |     {
  1160 |         id: 'caisse-ouverture', titre: 'Caisse — ouverture (fonds de caisse, PIN obligatoire)', role: 'controleur', needsIds: true,
  1161 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  1162 |         stubResponses: [{ url: /\/api\/controller\/shifts\/active(\?.*)?$/, method: 'GET', status: 200, body: { success: true, shift: null, expected_cash_in_drawer: null } }],
  1163 |         ready: async ({ page }) => startScanner(page),
  1164 |         actions: async ({ page }) => {
  1165 |             await openTab(page, /^caisse$/i);
  1166 |             await page.getByRole('button', { name: /^ouvrir ma caisse$/i }).click();
  1167 |             const dialog = page.getByRole('dialog', { name: /^ouvrir ma caisse$/i });
  1168 |             await expect(dialog).toBeVisible();
  1169 |             // Lot 9 bis (R42, A11, contrat 4.3 PIN_REQUIRED) : le PIN du régisseur est obligatoire à l'ouverture
  1170 |             await expect(dialog.getByLabel(/^code pin du régisseur/i), 'PIN du régisseur obligatoire à l’ouverture (R42)').toHaveAttribute('aria-required', 'true');
  1171 |             await expect(dialog.getByText(/facultatif/i), 'plus aucune mention « facultatif » du PIN (R42)').toHaveCount(0);
  1172 |         },
  1173 |     },
  1174 |     {
  1175 |         id: 'caisse-cloture-ecart', titre: 'Caisse — clôture avec écart constaté par le serveur (justification, PIN)', role: 'controleur', needsIds: true,
  1176 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  1177 |         stubResponses: [{
  1178 |             url: /\/api\/controller\/shifts\/close$/, method: 'POST', status: 400,
  1179 |             body: { success: false, code: 'JUSTIFICATION_REQUIRED', discrepancy: -2000, error: 'Écart constaté : justification et code PIN du régisseur requis.' },
  1180 |         }],
  1181 |         allowFailures: [/\/api\/controller\/shifts\/close$/],
  1182 |         ready: async ({ page }) => startScanner(page),
  1183 |         actions: async ({ page }) => {
  1184 |             await openTab(page, /^caisse$/i);
  1185 |             await page.getByRole('button', { name: /^clôturer ma caisse$/i }).click();
  1186 |             const dialog = page.getByRole('dialog', { name: /^clôturer ma caisse$/i });
  1187 |             await expect(dialog).toBeVisible();
  1188 |             // 2 000 de moins que le montant enregistré à l'écran : l'écart affiché (-2 000, réponse figée ci-dessus) tombe juste
  1189 |             const recorded = Number((await dialog.locator('dd').nth(1).innerText()).replace(/\D/g, ''));
  1190 |             await dialog.getByLabel(/^espèces encaissées comptées/i).fill(String(recorded - 2000));
  1191 |             await dialog.getByRole('button', { name: /^clôturer la caisse$/i }).click();
  1192 |             await expect(dialog.getByText(/^écart constaté$/i)).toBeVisible();
  1193 |             await expect(dialog.getByLabel(/^justification de l.écart/i)).toBeVisible();
  1194 |         },
  1195 |     },
  1196 |     {
  1197 |         id: 'caisse-ticket-z', titre: 'Caisse — Z de caisse après la clôture', role: 'controleur', needsIds: true,
  1198 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  1199 |         stubResponses: [{
```