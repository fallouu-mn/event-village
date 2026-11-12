# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · organisateur >> invitations-confirmation — Pilotage — Invitations : confirmation de l’envoi
- Location: e2e/captures.spec.ts:185:9

# Error details

```
TimeoutError: locator.fill: Timeout 15000ms exceeded.
Call log:
  - waiting for getByLabel(/^numéro 1(?!\d)/i)

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
            - /url: /
        - generic [ref=e16]:
          - button "Notifications, 99+ non lues" [ref=e18] [cursor=pointer]:
            - generic [ref=e22]: 99+
          - button "Basculer le thème" [ref=e24] [cursor=pointer]
          - link "Mon profil (Mariama Ndiaye)" [ref=e28] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e29]: MN
      - main [ref=e31]:
        - generic [ref=e33]:
          - generic [ref=e34]:
            - link "Mes événements" [ref=e36] [cursor=pointer]:
              - /url: /partner/events
            - generic [ref=e41]:
              - generic [ref=e42]:
                - generic [ref=e43]:
                  - 'generic "En ligne : la page publique est visible et la billetterie est ouverte." [ref=e44]': Publié
                  - status [ref=e47]: En direct
                - heading "Nuit du Sabar — édition d’automne" [level=1] [ref=e49]
                - paragraph [ref=e50]:
                  - generic [ref=e51]:
                    - generic [ref=e52]: jeu. 12 nov. 2026 à 15:15
                    - generic [ref=e55]: Esplanade de la Corniche Ouest, Dakar
              - generic [ref=e59]:
                - link "Modifier" [ref=e60] [cursor=pointer]:
                  - /url: /partner/events/a38a7700-a9df-4ab9-b54e-acd70e970dd2/edit
                - button "Annuler l’événement" [ref=e66] [cursor=pointer]
          - generic [ref=e72]:
            - tablist "Rubriques du pilotage" [ref=e75]:
              - tab "Aperçu" [ref=e76] [cursor=pointer]
              - tab "Ventes" [ref=e78] [cursor=pointer]
              - tab "Invitations" [selected] [ref=e80] [cursor=pointer]
              - tab "Entrées" [ref=e82] [cursor=pointer]
              - tab "Équipe" [ref=e84] [cursor=pointer]
              - tab "Caisse" [ref=e86] [cursor=pointer]
              - tab "Clôture" [ref=e88] [cursor=pointer]
            - tabpanel "Invitations" [ref=e90]:
              - generic [ref=e91]:
                - region [ref=e92]:
                  - generic [ref=e94]:
                    - heading "Inviter par SMS" [level=2] [ref=e95]
                    - paragraph [ref=e96]: Chaque numéro reçoit un SMS avec un lien vers Mes billets. Sans compte, ses billets l’attendent jusqu’à son inscription avec ce numéro.
                  - generic [ref=e97]:
                    - generic [ref=e98]:
                      - generic [ref=e99]:
                        - generic [ref=e101]:
                          - text: Catégorie*
                          - generic [ref=e102]: (obligatoire)
                        - combobox "Catégorie (obligatoire)" [ref=e104] [cursor=pointer]:
                          - option "Choisir une catégorie" [disabled]
                          - option "Invités de la production · 10 restants" [selected]
                          - option "Prévente · vente fermée" [disabled]
                          - option "Standard · 128 restants"
                          - option "VIP · 40 restants"
                          - option "Carré presse · 9 restants"
                        - paragraph [ref=e105]: Toute catégorie peut être distribuée ; les places sont prises sur son stock.
                      - generic [ref=e106]:
                        - generic [ref=e107]: Billets par numéro
                        - combobox "Billets par numéro" [ref=e110] [cursor=pointer]:
                          - option "1" [selected]
                          - option "2"
                          - option "3"
                          - option "4"
                    - generic [ref=e111]:
                      - generic [ref=e112]:
                        - generic [ref=e113]:
                          - text: Numéros de téléphone*
                          - generic [ref=e114]: (obligatoire)
                        - generic [ref=e115]: 0 / 10
                      - textbox "Numéros de téléphone (obligatoire)" [ref=e117]:
                        - /placeholder: "77 123 45 67\n78 123 45 68"
                      - paragraph [ref=e118]: Un numéro par ligne, 10 au plus par envoi.
                    - button "Envoyer les invitations" [ref=e120] [cursor=pointer]
                - region [ref=e126]:
                  - generic [ref=e128]:
                    - heading "Historique des invitations" [level=2] [ref=e129]
                    - paragraph [ref=e130]: "Les numéros sont masqués. Une invitation non scannée peut être annulée : la place revient au stock, sans SMS."
                  - generic [ref=e131]:
                    - heading "Aucune invitation pour le moment" [level=3] [ref=e135]
                    - paragraph [ref=e136]: Elles apparaîtront ici dès le premier envoi.
    - navigation "Navigation rapide" [ref=e137]:
      - generic [ref=e138]:
        - link "Accueil" [ref=e139] [cursor=pointer]:
          - /url: /partner/dashboard
        - link "Billetterie" [ref=e146] [cursor=pointer]:
          - /url: /partner/events
        - link "Scanner" [ref=e150] [cursor=pointer]:
          - /url: /partner/scan
        - link "Finances" [ref=e158] [cursor=pointer]:
          - /url: /partner/finance
        - link "Profil" [ref=e162] [cursor=pointer]:
          - /url: /partner/profile
  - alert [ref=e167]
```

# Test source

```ts
  1231 |             await expect(page.getByRole('dialog').or(page.getByRole('alertdialog'))).toBeVisible();
  1232 |         },
  1233 |     },
  1234 |     {
  1235 |         id: 'paiement-attente', titre: 'Paiement — en attente de validation chez l’opérateur', role: 'client', needsIds: true,
  1236 |         path: (i) => `/paiement/${ids(i).payments.pending}`,
  1237 |         ready: async ({ page }) => {
  1238 |             await expect(page.locator('#payment-status-title')).toBeVisible({ timeout: 30_000 });
  1239 |         },
  1240 |     },
  1241 |     {
  1242 |         id: 'paiement-succes', titre: 'Paiement — confirmé (billets émis, redirection annulable)', role: 'client', needsIds: true,
  1243 |         path: (i) => `/paiement/${ids(i).payments.success}`, slowTimers: { minDelayMs: 1000, factor: 100 },
  1244 |         ready: async ({ page }) => {
  1245 |             await expect(page.locator('#payment-status-title')).toHaveText(/paiement confirmé/i, { timeout: 30_000 });
  1246 |         },
  1247 |     },
  1248 |     {
  1249 |         id: 'paiement-echec', titre: 'Paiement — refusé (Réessayer le paiement)', role: 'client', needsIds: true,
  1250 |         path: (i) => `/paiement/${ids(i).payments.failed}`,
  1251 |         ready: async ({ page }) => {
  1252 |             await expect(page.locator('#payment-status-title')).toHaveText(/n.a pas abouti/i, { timeout: 30_000 });
  1253 |         },
  1254 |     },
  1255 |     {
  1256 |         id: 'inscription-code', titre: 'Inscription — étape 2 : code reçu et profil (envoi du code simulé)', role: 'anonyme', needsIds: false, path: () => '/register',
  1257 |         stubResponses: [{ url: /\/api\/auth\/register\/start$/, method: 'POST', status: 200, body: { ok: true, phone: '+221771234567', resend_after: 60 } }],
  1258 |         ready: async ({ page }) => { await expectHeading(page, /^créer un compte$/i); },
  1259 |         actions: async ({ page }) => {
  1260 |             await page.getByLabel(/^numéro de téléphone/i).fill('77 123 45 67');
  1261 |             await page.getByRole('button', { name: /^recevoir le code par sms$/i }).click();
  1262 |             await expect(page.getByText(/^code reçu par sms$/i)).toBeVisible();
  1263 |         },
  1264 |     },
  1265 |     // ── Lot 7 : pages partenaire migrées (7.4, E5 ; 7.0 f, E1) ──────────────
  1266 |     {
  1267 |         id: 'partenaire-inscription', titre: 'Inscription d’un partenaire (système de design)', role: 'anonyme', needsIds: false, path: () => '/partner/register',
  1268 |         ready: async ({ page }) => expectPageTitle(page),
  1269 |     },
  1270 |     { id: 'partenaire-tableau-de-bord', titre: 'Partenaire — tableau de bord (chiffres servis par le serveur)', role: 'organisateur', needsIds: true, path: () => '/partner/dashboard', ready: async ({ page }) => expectPageTitle(page) },
  1271 |     { id: 'partenaire-finances', titre: 'Partenaire — finances (écritures, retraits)', role: 'organisateur', needsIds: true, path: () => '/partner/finance', ready: async ({ page }) => expectPageTitle(page) },
  1272 |     { id: 'partenaire-equipe', titre: 'Partenaire — équipe (contrôleurs et affectations)', role: 'organisateur', needsIds: true, path: () => '/partner/team', ready: async ({ page }) => expectPageTitle(page) },
  1273 |     { id: 'partenaire-profil', titre: 'Partenaire — profil de l’organisateur', role: 'organisateur', needsIds: true, path: () => '/partner/profile', ready: async ({ page }) => expectPageTitle(page) },
  1274 |     { id: 'partenaire-abonnement', titre: 'Partenaire — abonnement et période d’essai', role: 'organisateur', needsIds: true, path: () => '/partner/subscription', ready: async ({ page }) => expectPageTitle(page) },
  1275 |     {
  1276 |         id: 'partenaire-premiers-pas', titre: 'Partenaire validé sans événement — première utilisation (étapes cochées par le serveur)', role: 'partenaire-premiers-pas', needsIds: true,
  1277 |         path: () => '/partner/dashboard',
  1278 |         ready: async ({ page }) => {
  1279 |             await expect(page.getByRole('heading', { name: /^publiez votre premier événement$/i })).toBeVisible({ timeout: 30_000 });
  1280 |         },
  1281 |     },
  1282 |     // ── Lot 7 : pages masquées par les interrupteurs (7.3, D55) ─────────────
  1283 |     {
  1284 |         id: 'page-masquee-salles', titre: 'Salles de fête masquées (interrupteur fermé) : page introuvable propre', role: 'anonyme', needsIds: false, path: () => '/halls',
  1285 |         expectStatus: 404, allowFailures: [/\/halls(\?.*)?$/],
  1286 |         ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
  1287 |     },
  1288 |     {
  1289 |         id: 'page-masquee-commandes', titre: 'Commandes masquées (trois interrupteurs fermés) : page introuvable propre', role: 'client', needsIds: true, path: () => '/orders',
  1290 |         expectStatus: 404, allowFailures: [/\/orders(\?.*)?$/],
  1291 |         ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
  1292 |     },
  1293 |     // ── Lot 7 : restes d'interface du lot 6 (7.0 f, E1) ─────────────────────
  1294 |     {
  1295 |         id: 'controleur-activation', titre: 'Activation d’un compte contrôleur (lien de l’invitation)', role: 'anonyme', needsIds: false,
  1296 |         path: () => '/controller/setup?phone=%2B221700000199', views: DARK_VIEWS,
  1297 |         ready: async ({ page }) => { await expectHeading(page, /^activer votre compte contrôleur$/i); },
  1298 |     },
  1299 |     {
  1300 |         id: 'controleur-profil', titre: 'Profil du contrôleur (événements assignés, mot de passe)', role: 'controleur', needsIds: true, path: () => '/controller/profile', views: DARK_VIEWS,
  1301 |         ready: async ({ page }) => { await expectHeading(page, /^mon profil$/i); },
  1302 |     },
  1303 |     {
  1304 |         id: 'admin-campagnes', titre: 'Administration — campagnes de communication', role: 'admin', needsIds: true, path: () => '/admin/communications',
  1305 |         ready: async ({ page }) => { await expectHeading(page, /^campagnes de communication$/i); },
  1306 |     },
  1307 |     {
  1308 |         id: 'aide-transfert', titre: 'Mes billets — aide « Comment marche le transfert ? »', role: 'client', needsIds: true, path: () => '/tickets',
  1309 |         actions: async ({ page }) => {
  1310 |             await page.getByRole('button', { name: /^comment marche le transfert/i }).click();
  1311 |             await expect(page.getByRole('dialog')).toBeVisible();
  1312 |         },
  1313 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  1314 |     },
  1315 |     { id: 'portefeuille', titre: 'Portefeuille du client (solde, parrainage)', role: 'client', needsIds: true, path: () => '/wallet', ready: async ({ page }) => expectPageTitle(page) },
  1316 |     // ── Lot 9 : invitations, découverte, compte (contrat section 7) ─────────
  1317 |     {
  1318 |         id: 'invitations-onglet', titre: 'Pilotage — Invitations (catégorie, numéros, liste)', role: 'organisateur', needsIds: true,
  1319 |         path: (i) => `/partner/events/${ids(i).events.ceSoir.id}?tab=invitations`,
  1320 |         ready: async ({ page }) => invitationsReady(page),
  1321 |     },
  1322 |     {
  1323 |         id: 'invitations-confirmation', titre: 'Pilotage — Invitations : confirmation de l’envoi', role: 'organisateur', needsIds: true,
  1324 |         path: (i) => `/partner/events/${ids(i).events.ceSoir.id}?tab=invitations`,
  1325 |         ready: async ({ page }) => invitationsReady(page),
  1326 |         actions: async ({ page }) => {
  1327 |             const category = page.getByRole('tabpanel').getByLabel(/^catégorie/i);
  1328 |             const value = await category.locator('option:not([value=""]):not([disabled])').first().getAttribute('value');
  1329 |             if (!value) throw new Error('[e2e] aucune catégorie proposée dans le champ Catégorie des invitations');
  1330 |             await category.selectOption(value);
> 1331 |             await page.getByLabel(/^numéro 1(?!\d)/i).fill('771234567'); // lot 9 ter (9t.17) : lignes numéro et nom
       |                                                       ^ TimeoutError: locator.fill: Timeout 15000ms exceeded.
  1332 |             await page.getByRole('button', { name: /^envoyer les invitations$/i }).click();
  1333 |             await expect(page.getByRole('alertdialog', { name: /^confirmer l.envoi/i })).toBeVisible();
  1334 |         },
  1335 |     },
  1336 |     {
  1337 |         id: 'mes-paiements', titre: 'Mes paiements (date, événement, montant, opérateur, statut, totaux)', role: 'client', needsIds: true,
  1338 |         path: () => '/profile/payments', expectStatus: 200,
  1339 |         ready: async ({ page }) => {
  1340 |             await expectHeading(page, /^mes paiements$/i);
  1341 |             await expect(page.locator('a[href^="/paiement/"]').first()).toBeVisible();
  1342 |         },
  1343 |     },
  1344 |     {
  1345 |         id: 'profil', titre: 'Profil du client (identité, photo, numéro)', role: 'client', needsIds: true, path: () => '/profile',
  1346 |         ready: async ({ page }) => {
  1347 |             await expect(page.getByRole('button', { name: /^enregistrer le profil$/i })).toBeVisible();
  1348 |             await expect(page.getByRole('button', { name: /^changer de numéro$/i })).toBeVisible();
  1349 |             await expect(page.getByRole('button', { name: /^choisir une photo$/i })).toBeVisible();
  1350 |         },
  1351 |     },
  1352 |     {
  1353 |         id: 'changement-numero', titre: 'Profil du client — changement de numéro (boîte ouverte)', role: 'client', needsIds: true, path: () => '/profile',
  1354 |         actions: async ({ page }) => {
  1355 |             await page.getByRole('button', { name: /^changer de numéro$/i }).click();
  1356 |             await expect(page.getByRole('dialog')).toBeVisible();
  1357 |         },
  1358 |     },
  1359 |     {
  1360 |         id: 'accueil-ville', titre: 'Accueil — Près de chez vous, ville gardée sur l’appareil', role: 'anonyme', needsIds: false, path: () => '/',
  1361 |         initStorage: { 'ev-city': 'DAKAR' },
  1362 |         ready: async ({ page }) => {
  1363 |             await expect(nearbySection(page).getByRole('combobox'), 'ville du visiteur relue sur l’appareil').toHaveValue('DAKAR', { timeout: 30_000 });
  1364 |             await revealCenter(nearbySection(page).getByRole('combobox'));
  1365 |         },
  1366 |     },
  1367 |     {
  1368 |         id: 'accueil-populaires-erreur', titre: 'Accueil — Populaires, état d’erreur (Réessayer)', role: 'anonyme', needsIds: false, path: () => '/',
  1369 |         injectError: /\/api\/events\/popular/,
  1370 |         injectErrorMessage: 'Populaires momentanément indisponibles.',
  1371 |         // Section sous « À l'affiche » : hors de l'image sans défilement
  1372 |         ready: async (c) => {
  1373 |             await expectRetry(c);
  1374 |             await revealCenter(c.page.getByRole('button', { name: /réessayer/i }));
  1375 |         },
  1376 |     },
  1377 |     // ── Lot 9 bis : versements, droits, transferts, email (contrat 7.3, T9) ──
  1378 |     // Rouges jusqu'à leurs écrans (vague E) et aux données du seed (fix(9b.seed)) ; aucune boîte n'est confirmée.
  1379 |     {
  1380 |         id: 'admin-versements-marquer-verse', titre: 'Administration — versements à reprendre : boîte « Marquer versé » (justification, référence ; réponses imposées)',
  1381 |         role: 'fumee-superadmin', needsIds: false, path: () => '/admin/finance',
  1382 |         stubResponses: CASHOUTS_STUBS,
  1383 |         ready: async ({ page }) => { await cashoutsReady(page); },
  1384 |         actions: async ({ page }) => {
  1385 |             // Ligne incertaine sans identifiant SamirPay : « Marquer versé » seul, avec la référence (B2)
  1386 |             const row = page.locator('tr, li, article').filter({ hasText: 'Festival Jazz sur le Fleuve' });
  1387 |             await row.getByRole('button', { name: /^marquer versé/i }).filter({ visible: true }).first().click();
  1388 |             const dialog = anyDialog(page, /marquer/i);
  1389 |             await expect(dialog).toBeVisible();
  1390 |             await expect(dialog.getByLabel(/justification/i), 'justification obligatoire (contrat 5.1)').toBeVisible();
  1391 |             await expect(dialog.getByLabel(/référence/i), 'référence SamirPay du versement (contrat 4.1, REFERENCE_REQUIRED)').toBeVisible();
  1392 |         },
  1393 |     },
  1394 |     {
  1395 |         id: 'pilotage-especes-a-rembourser', titre: 'Événement annulé — espèces à rembourser par l’organisateur (ventes au guichet)', role: 'organisateur', needsIds: true,
  1396 |         path: pilotage('annule'),
  1397 |         ready: async ({ page }) => {
  1398 |             const heading = page.getByRole('heading', { name: /^espèces à rembourser par l[’']organisateur/i });
  1399 |             await expect(heading, 'section des ventes au guichet d’un événement annulé (R20)').toBeVisible({ timeout: 30_000 });
  1400 |             await expect(page.getByRole('checkbox', { name: /remboursé/i }).first(), 'case « Remboursé » d’une vente au guichet du seed').toBeVisible();
  1401 |             await revealCenter(heading);
  1402 |         },
  1403 |     },
  1404 |     {
  1405 |         id: 'admin-fiche-partenaire-suspendre', titre: 'Administration — fiche d’un partenaire validé : boîte « Suspendre » (motif)', role: 'fumee-superadmin', needsIds: true,
  1406 |         path: (i) => `/admin/dashboard?partenaires=ALL&dossier=${encodeURIComponent(partnerIdOf(i, 'organisateur'))}`,
  1407 |         ready: async ({ page }) => {
  1408 |             await expect(page.getByRole('dialog', { name: /^dossier du partenaire/i }), 'fiche ouverte par le lien profond ?dossier= (R6)').toBeVisible({ timeout: 30_000 });
  1409 |         },
  1410 |         actions: async ({ page }) => {
  1411 |             const dossier = page.getByRole('dialog', { name: /^dossier du partenaire/i });
  1412 |             // Partenaire VALIDE : « Valider » et « Refuser » réservés à un dossier en attente, « Réactiver » à un suspendu (5.15)
  1413 |             await expect(dossier.getByRole('button', { name: /^valider/i }), '« Valider » sur un partenaire validé').toHaveCount(0);
  1414 |             await expect(dossier.getByRole('button', { name: /^refuser/i }), '« Refuser » sur un partenaire validé').toHaveCount(0);
  1415 |             await expect(dossier.getByRole('button', { name: /^réactiver/i }), '« Réactiver » sur un partenaire validé').toHaveCount(0);
  1416 |             await dossier.getByRole('button', { name: /^suspendre/i }).click();
  1417 |             const box = anyDialog(page, /^suspendre/i);
  1418 |             await expect(box).toBeVisible();
  1419 |             await expect(box.getByLabel(/^motif/i), 'motif obligatoire de la suspension (R55)').toBeVisible();
  1420 |         },
  1421 |     },
  1422 |     {
  1423 |         id: 'profil-email-non-verifie', titre: 'Profil du client — adresse email en attente de vérification (Renvoyer le lien)', role: 'client', needsIds: true, path: () => '/profile',
  1424 |         ready: async ({ page }) => {
  1425 |             await expect(page.getByText('Email non vérifié', { exact: true }).first(), 'adresse en attente du client du seed (email_pending, R87)').toBeVisible();
  1426 |             const resend = page.getByRole('button', { name: /^renvoyer le lien$/i });
  1427 |             await expect(resend).toBeVisible();
  1428 |             await revealCenter(resend);
  1429 |         },
  1430 |     },
  1431 |     {
```