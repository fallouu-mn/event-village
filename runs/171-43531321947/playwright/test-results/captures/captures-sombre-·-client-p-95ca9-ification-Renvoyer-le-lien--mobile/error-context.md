# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · client >> profil-email-non-verifie — Profil du client — adresse email en attente de vérification (Renvoyer le lien)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: adresse en attente du client du seed (email_pending, R87)

expect(locator).toBeVisible() failed

Locator: getByText('Email non vérifié', { exact: true }).first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - adresse en attente du client du seed (email_pending, R87) getByText('Email non vérifié', { exact: true }).first() with timeout 15000ms
  - waiting for getByText('Email non vérifié', { exact: true }).first()

```

```yaml
- banner:
  - button "Ouvrir le menu"
  - link "Event Village, accueil":
    - /url: /
  - button "Notifications, 7 non lues": "7"
  - button "Basculer le thème" [pressed]
  - link "Mon profil (Fatou Mbaye)":
    - /url: /profile
- main:
  - heading "Mon profil" [level=1]
  - paragraph: Vos coordonnées, l’affichage de l’application, vos notifications et vos accès.
  - region "Fatou Mbaye":
    - button "Choisir une photo"
    - paragraph: JPEG, PNG ou WebP, 2 Mo au plus.
    - heading "Fatou Mbaye" [level=2]
    - term: Téléphone
    - definition: +221 70 000 01 05
    - term: Email
    - definition: fatou.mbaye@demo.eventvillage.local
    - term: "Rôle :"
    - definition: Client
    - term: Statut du compte
    - definition: Compte actif
  - region "Mes informations":
    - heading "Mes informations" [level=2]
    - text: Prénom
    - textbox "Prénom": Fatou
    - text: Nom
    - textbox "Nom": Mbaye
    - text: Adresse email
    - textbox "Adresse email": fatou.mbaye.pro@demo.eventvillage.local
    - paragraph: "Recommandé : recevez vos billets et confirmations par email"
    - status:
      - paragraph: Adresse email non vérifiée
      - text: "fatou.mbaye.pro@demo.eventvillage.local : ouvrez le lien reçu par email pour la vérifier. En attendant, connectez-vous avec votre numéro."
      - button "Recevoir le lien de vérification"
    - button "Enregistrer le profil"
    - paragraph: Numéro de téléphone
    - paragraph: Un code envoyé au nouveau numéro confirme le changement.
    - button "Changer de numéro"
    - paragraph: Mot de passe
    - paragraph: Les autres appareils seront déconnectés.
    - button "Changer de mot de passe"
  - region "Réglages et espaces":
    - heading "Réglages et espaces" [level=2]
    - list:
      - listitem:
        - link "Préférences de notification Rappels, changements d’événement, SMS et notifications push sur cet appareil":
          - /url: /profile/notifications
      - listitem:
        - link "Mes paiements L’historique de vos paiements et de vos remboursements":
          - /url: /profile/payments
      - listitem:
        - link "Portefeuille de parrainage Vos gains de parrainage et vos demandes de retrait":
          - /url: /wallet
  - region "Affichage":
    - heading "Affichage" [level=2]
    - group "Thème de l’application":
      - button "Clair"
      - button "Sombre" [pressed]
      - button "Système"
  - button "Se déconnecter"
  - paragraph: « Se déconnecter » ferme seulement cet appareil.
  - button "Déconnecter tous mes appareils"
- navigation "Navigation rapide":
  - link "Accueil":
    - /url: /
  - link "Explorer":
    - /url: /explore
  - link "Billets":
    - /url: /tickets
  - link "Portefeuille":
    - /url: /wallet
- alert
```

# Test source

```ts
  1324 |         ready: async ({ page }) => invitationsReady(page),
  1325 |         actions: async ({ page }) => {
  1326 |             const category = page.getByRole('tabpanel').getByLabel(/^catégorie/i);
  1327 |             const value = await category.locator('option:not([value=""]):not([disabled])').first().getAttribute('value');
  1328 |             if (!value) throw new Error('[e2e] aucune catégorie proposée dans le champ Catégorie des invitations');
  1329 |             await category.selectOption(value);
  1330 |             await page.getByLabel(/^numéro 1(?!\d)/i).fill('771234567'); // lot 9 ter (9t.17) : lignes numéro et nom
  1331 |             await page.getByRole('button', { name: /^envoyer les invitations$/i }).click();
  1332 |             await expect(page.getByRole('alertdialog', { name: /^confirmer l.envoi/i })).toBeVisible();
  1333 |         },
  1334 |     },
  1335 |     {
  1336 |         id: 'mes-paiements', titre: 'Mes paiements (date, événement, montant, opérateur, statut, totaux)', role: 'client', needsIds: true,
  1337 |         path: () => '/profile/payments', expectStatus: 200,
  1338 |         ready: async ({ page }) => {
  1339 |             await expectHeading(page, /^mes paiements$/i);
  1340 |             await expect(page.locator('a[href^="/paiement/"]').first()).toBeVisible();
  1341 |         },
  1342 |     },
  1343 |     {
  1344 |         id: 'profil', titre: 'Profil du client (identité, photo, numéro)', role: 'client', needsIds: true, path: () => '/profile',
  1345 |         ready: async ({ page }) => {
  1346 |             await expect(page.getByRole('button', { name: /^enregistrer le profil$/i })).toBeVisible();
  1347 |             await expect(page.getByRole('button', { name: /^changer de numéro$/i })).toBeVisible();
  1348 |             await expect(page.getByRole('button', { name: /^choisir une photo$/i })).toBeVisible();
  1349 |         },
  1350 |     },
  1351 |     {
  1352 |         id: 'changement-numero', titre: 'Profil du client — changement de numéro (boîte ouverte)', role: 'client', needsIds: true, path: () => '/profile',
  1353 |         actions: async ({ page }) => {
  1354 |             await page.getByRole('button', { name: /^changer de numéro$/i }).click();
  1355 |             await expect(page.getByRole('dialog')).toBeVisible();
  1356 |         },
  1357 |     },
  1358 |     {
  1359 |         id: 'accueil-ville', titre: 'Accueil — Près de chez vous, ville gardée sur l’appareil', role: 'anonyme', needsIds: false, path: () => '/',
  1360 |         initStorage: { 'ev-city': 'DAKAR' },
  1361 |         ready: async ({ page }) => {
  1362 |             await expect(nearbySection(page).getByRole('combobox'), 'ville du visiteur relue sur l’appareil').toHaveValue('DAKAR', { timeout: 30_000 });
  1363 |             await revealCenter(nearbySection(page).getByRole('combobox'));
  1364 |         },
  1365 |     },
  1366 |     {
  1367 |         id: 'accueil-populaires-erreur', titre: 'Accueil — Populaires, état d’erreur (Réessayer)', role: 'anonyme', needsIds: false, path: () => '/',
  1368 |         injectError: /\/api\/events\/popular/,
  1369 |         injectErrorMessage: 'Populaires momentanément indisponibles.',
  1370 |         // Section sous « À l'affiche » : hors de l'image sans défilement
  1371 |         ready: async (c) => {
  1372 |             await expectRetry(c);
  1373 |             await revealCenter(c.page.getByRole('button', { name: /réessayer/i }));
  1374 |         },
  1375 |     },
  1376 |     // ── Lot 9 bis : versements, droits, transferts, email (contrat 7.3, T9) ──
  1377 |     // Rouges jusqu'à leurs écrans (vague E) et aux données du seed (fix(9b.seed)) ; aucune boîte n'est confirmée.
  1378 |     {
  1379 |         id: 'admin-versements-marquer-verse', titre: 'Administration — versements à reprendre : boîte « Marquer versé » (justification, référence ; réponses imposées)',
  1380 |         role: 'fumee-superadmin', needsIds: false, path: () => '/admin/finance',
  1381 |         stubResponses: CASHOUTS_STUBS,
  1382 |         ready: async ({ page }) => { await cashoutsReady(page); },
  1383 |         actions: async ({ page }) => {
  1384 |             // Ligne incertaine sans identifiant SamirPay : « Marquer versé » seul, avec la référence (B2)
  1385 |             const row = page.locator('tr, li, article').filter({ hasText: 'Festival Jazz sur le Fleuve' });
  1386 |             await row.getByRole('button', { name: /^marquer versé/i }).filter({ visible: true }).first().click();
  1387 |             const dialog = anyDialog(page, /marquer/i);
  1388 |             await expect(dialog).toBeVisible();
  1389 |             await expect(dialog.getByLabel(/justification/i), 'justification obligatoire (contrat 5.1)').toBeVisible();
  1390 |             await expect(dialog.getByLabel(/référence/i), 'référence SamirPay du versement (contrat 4.1, REFERENCE_REQUIRED)').toBeVisible();
  1391 |         },
  1392 |     },
  1393 |     {
  1394 |         id: 'pilotage-especes-a-rembourser', titre: 'Événement annulé — espèces à rembourser par l’organisateur (ventes au guichet)', role: 'organisateur', needsIds: true,
  1395 |         path: pilotage('annule'),
  1396 |         ready: async ({ page }) => {
  1397 |             const heading = page.getByRole('heading', { name: /^espèces à rembourser par l[’']organisateur/i });
  1398 |             await expect(heading, 'section des ventes au guichet d’un événement annulé (R20)').toBeVisible({ timeout: 30_000 });
  1399 |             await expect(page.getByRole('checkbox', { name: /remboursé/i }).first(), 'case « Remboursé » d’une vente au guichet du seed').toBeVisible();
  1400 |             await revealCenter(heading);
  1401 |         },
  1402 |     },
  1403 |     {
  1404 |         id: 'admin-fiche-partenaire-suspendre', titre: 'Administration — fiche d’un partenaire validé : boîte « Suspendre » (motif)', role: 'fumee-superadmin', needsIds: true,
  1405 |         path: (i) => `/admin/dashboard?partenaires=ALL&dossier=${encodeURIComponent(partnerIdOf(i, 'organisateur'))}`,
  1406 |         ready: async ({ page }) => {
  1407 |             await expect(page.getByRole('dialog', { name: /^dossier du partenaire/i }), 'fiche ouverte par le lien profond ?dossier= (R6)').toBeVisible({ timeout: 30_000 });
  1408 |         },
  1409 |         actions: async ({ page }) => {
  1410 |             const dossier = page.getByRole('dialog', { name: /^dossier du partenaire/i });
  1411 |             // Partenaire VALIDE : « Valider » et « Refuser » réservés à un dossier en attente, « Réactiver » à un suspendu (5.15)
  1412 |             await expect(dossier.getByRole('button', { name: /^valider/i }), '« Valider » sur un partenaire validé').toHaveCount(0);
  1413 |             await expect(dossier.getByRole('button', { name: /^refuser/i }), '« Refuser » sur un partenaire validé').toHaveCount(0);
  1414 |             await expect(dossier.getByRole('button', { name: /^réactiver/i }), '« Réactiver » sur un partenaire validé').toHaveCount(0);
  1415 |             await dossier.getByRole('button', { name: /^suspendre/i }).click();
  1416 |             const box = anyDialog(page, /^suspendre/i);
  1417 |             await expect(box).toBeVisible();
  1418 |             await expect(box.getByLabel(/^motif/i), 'motif obligatoire de la suspension (R55)').toBeVisible();
  1419 |         },
  1420 |     },
  1421 |     {
  1422 |         id: 'profil-email-non-verifie', titre: 'Profil du client — adresse email en attente de vérification (Renvoyer le lien)', role: 'client', needsIds: true, path: () => '/profile',
  1423 |         ready: async ({ page }) => {
> 1424 |             await expect(page.getByText('Email non vérifié', { exact: true }).first(), 'adresse en attente du client du seed (email_pending, R87)').toBeVisible();
       |                                                                                                                                                     ^ Error: adresse en attente du client du seed (email_pending, R87)
  1425 |             const resend = page.getByRole('button', { name: /^renvoyer le lien$/i });
  1426 |             await expect(resend).toBeVisible();
  1427 |             await revealCenter(resend);
  1428 |         },
  1429 |     },
  1430 |     {
  1431 |         id: 'profil-mot-de-passe', titre: 'Profil du client — « Changer de mot de passe » ouvert (trois champs, règle)', role: 'client', needsIds: true, path: () => '/profile',
  1432 |         ready: async ({ page }) => {
  1433 |             await expect(page.getByText('Les autres appareils seront déconnectés.', { exact: true }), 'bloc « Mot de passe » du profil (5.42)').toBeVisible();
  1434 |         },
  1435 |         actions: async ({ page }) => {
  1436 |             await page.getByRole('button', { name: /^changer de mot de passe$/i }).click();
  1437 |             const dialog = anyDialog(page, /mot de passe/i);
  1438 |             await expect(dialog).toBeVisible();
  1439 |             await expect(dialog.locator('input[type="password"]'), 'mot de passe actuel, nouveau et confirmation (R85)').toHaveCount(3);
  1440 |             await expect(dialog.getByText(PASSWORD_RULES_HELP, { exact: true })).toBeVisible();
  1441 |         },
  1442 |     },
  1443 |     {
  1444 |         id: 'confirmation-mot-de-passe', titre: 'Mes billets — transfert : boîte « mot de passe » avant l’envoi (réponse imposée, rien ne part)', role: 'client', needsIds: true,
  1445 |         path: () => '/tickets?tab=a-venir', // A10 (R45) : la carte et son bouton « Transférer » sont dans « À venir »
  1446 |         // Le transfert ne part jamais au serveur : réponse 403 du contrat 4.2 imposée (le seed reste intact)
  1447 |         stubResponses: [{ url: TRANSFER_URL, method: 'POST', status: 403, body: PASSWORD_CONFIRMATION_REQUIRED }],
  1448 |         allowFailures: [TRANSFER_URL],
  1449 |         actions: async ({ page }) => {
  1450 |             await page.getByRole('button', { name: /^transférer$/i }).filter({ visible: true }).first().click();
  1451 |             const transfer = page.getByRole('dialog', { name: /^transférer ce billet$/i });
  1452 |             await expect(transfer).toBeVisible();
  1453 |             await transfer.getByLabel(/^numéro de téléphone du destinataire/i).fill('771234567');
  1454 |             await transfer.getByRole('button', { name: /^envoyer le billet$/i }).click();
  1455 |             const confirm = anyDialog(page, /mot de passe/i);
  1456 |             await expect(confirm, 'boîte « mot de passe » ouverte par PASSWORD_CONFIRMATION_REQUIRED (R57)').toBeVisible();
  1457 |             await expect(confirm.locator('input[type="password"]'), 'un seul champ : le mot de passe du compte').toHaveCount(1);
  1458 |         },
  1459 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  1460 |     },
  1461 |     {
  1462 |         id: 'invitation-controleur', titre: 'Invitations — invitation de contrôleur en attente (Accepter, Refuser)', role: 'client', needsIds: true,
  1463 |         path: () => '/invitations', expectStatus: 200,
  1464 |         ready: async ({ page }) => {
  1465 |             await expectPageTitle(page);
  1466 |             await expect(page.getByRole('button', { name: /^accepter/i }).first(), 'invitation en attente du seed (R37)').toBeVisible();
  1467 |             await expect(page.getByRole('button', { name: /^refuser/i }).first()).toBeVisible();
  1468 |         },
  1469 |     },
  1470 |     {
  1471 |         id: 'mes-billets-recus-refuser', titre: 'Mes billets — Reçus : confirmation « Refuser » d’un transfert entrant', role: 'client', needsIds: true,
  1472 |         path: () => '/tickets?tab=recus',
  1473 |         ready: async ({ page }) => {
  1474 |             await expect(page.getByRole('tab', { name: /^reçus/i })).toHaveAttribute('aria-selected', 'true');
  1475 |             await expect(page.getByRole('button', { name: /^accepter le billet$/i }).first()).toBeVisible();
  1476 |         },
  1477 |         actions: async ({ page }) => {
  1478 |             await page.getByRole('button', { name: /^refuser/i }).filter({ visible: true }).first().click();
  1479 |             const confirm = anyDialog(page);
  1480 |             await expect(confirm, 'confirmation du refus (R46)').toBeVisible();
  1481 |             await expect(confirm.getByRole('button', { name: /^refuser/i })).toBeVisible();
  1482 |         },
  1483 |     },
  1484 |     withExtraActions(
  1485 |         scanResultScreen('scanner-transfert-en-cours', 'Scanner — billet en cours de transfert (plein écran « Transfert en cours »)', {
  1486 |             result: 'transfer_pending', scan_id: 'c6e1f2a3-b4c5-4d6e-8f70-81a2b3c4d5e6', ticket: SCAN_TICKET,
  1487 |         }),
  1488 |         async ({ page }) => {
  1489 |             await expect(page.locator('[data-scan-state="result"]').getByText(/^transfert en cours/i).first(), 'libellé du résultat transfer_pending (R19)').toBeVisible();
  1490 |         },
  1491 |     ),
  1492 |     {
  1493 |         id: 'verification-email', titre: 'Vérification d’une adresse email — « Confirmer mon adresse » (rien n’est validé au chargement)', role: 'anonyme', needsIds: false,
  1494 |         path: () => `/verify-email?t=${VERIFY_EMAIL_TOKEN}`, expectStatus: 200,
  1495 |         ready: async ({ page }) => {
  1496 |             await expectHeading(page, /^vérifier mon adresse email$/i);
  1497 |             await expect(page.getByRole('button', { name: /^confirmer mon adresse$/i })).toBeVisible();
  1498 |         },
  1499 |         actions: async ({ page }) => {
  1500 |             await expect.poll(() => new URL(page.url()).searchParams.has('t'), { message: 'jeton effacé de l’adresse (history.replaceState, contrat 4.6)' }).toBe(false);
  1501 |             const referrers = await page.evaluate(() => Array.from(document.querySelectorAll('meta[name="referrer"]'), (m) => m.getAttribute('content')));
  1502 |             expect(referrers, 'politique de référent de la page (contrat 4.6)').toEqual(['no-referrer']);
  1503 |             expect(await requestsTo(page, VERIFY_EMAIL_API), `aucun appel à ${VERIFY_EMAIL_API} au chargement (contrat 4.6)`).toBe(0);
  1504 |         },
  1505 |     },
  1506 |     // ── Lot 9 ter : zones, portes, liste des invités (C.6) ───────────────────
  1507 |     // Rouges jusqu'aux écrans d'E-C (fix(9t.15e), fix(9t.16e), fix(9t.17e)) ; partenaire-zones et partenaire-equipe-portes
  1508 |     // aussi jusqu'à la graine v4 (événement à zones VALIDE, fix(9t.seed)).
  1509 |     withExtraActions(
  1510 |         scanResultScreen('scanner-accepte-consigne', 'Scanner — entrée validée : bande de catégorie, consigne, zone et porte, badge Invitation', {
  1511 |             result: 'valid', scan_id: 'd3f8a1b2-4c5d-4e6f-8a7b-9c0d1e2f3a41',
  1512 |             ticket: { ...SCAN_TICKET_VIP, category_color: 'OR', entry_instruction: ENTRY_INSTRUCTION_VIP, origin: 'INVITATION' },
  1513 |             zone: ZONE_ENTREE_VIP, gate: GATE_VIP,
  1514 |         }),
  1515 |         async ({ page }) => expectScanLines(page, 'accepte', ['Entrée validée', ENTRY_INSTRUCTION_VIP, 'Zone : Entrée VIP · Porte VIP', 'Invitation']),
  1516 |     ),
  1517 |     withExtraActions(
  1518 |         scanResultScreen('scanner-mauvaise-zone', 'Scanner — mauvaise zone (plein écran orange, zone où se présenter)', {
  1519 |             result: 'wrong_zone', scan_id: 'd3f8a1b2-4c5d-4e6f-8a7b-9c0d1e2f3a42', message: 'Accès refusé : billet VIP',
  1520 |             ticket: SCAN_TICKET_VIP, redirect_zones: ['Entrée VIP'], zone: ZONE_ENTREE_GENERALE, gate: GATE_NORD,
  1521 |         }),
  1522 |         async ({ page }) => expectScanLines(page, 'oriente', ['Accès refusé : billet VIP', 'Présentez-vous à : Entrée VIP']),
  1523 |     ),
  1524 |     withExtraActions(
```