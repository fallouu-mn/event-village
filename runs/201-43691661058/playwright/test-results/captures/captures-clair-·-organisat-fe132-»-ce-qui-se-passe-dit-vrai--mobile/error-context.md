# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · organisateur >> partenaire-equipe-retirer — Équipe — fenêtre « Retirer de l’équipe » (ce qui se passe, dit vrai)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: fenêtre de retrait

expect(locator).toBeVisible() failed

Locator: getByRole('alertdialog').or(getByRole('dialog')).filter({ hasText: /de votre équipe \?/ }).first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - fenêtre de retrait getByRole('alertdialog').or(getByRole('dialog')).filter({ hasText: /de votre équipe \?/ }).first() with timeout 15000ms
  - waiting for getByRole('alertdialog').or(getByRole('dialog')).filter({ hasText: /de votre équipe \?/ }).first()

```

```yaml
- banner:
  - button "Ouvrir le menu"
  - link "Event Village, accueil":
    - /url: /
  - button "Notifications, 99+ non lues": 99+
  - button "Basculer le thème"
  - link "Mon profil (Mariama Ndiaye)":
    - /url: /profile
- main:
  - heading "Équipe de contrôle" [level=1]
  - paragraph: "Les personnes qui scannent les billets à l’entrée de vos événements : leur état, leur porte et leurs espèces, événement par événement."
  - region "Vos contrôleurs":
    - heading "Vos contrôleurs" [level=2]
    - paragraph: 4 contrôleurs · 4 prêts · 1 en attente
    - status: Mis à jour à 08:25
    - button "Actualiser"
    - button "Inviter un contrôleur"
    - status:
      - paragraph: "« Grande soirée du Monument de la Renaissance » : porte sans contrôleur"
      - text: "Accès carré, Porte Sud : personne ne contrôle cette porte. Choisissez-la pour un contrôleur avec « Modifier »."
      - link "Modifier les portes et les couleurs":
        - /url: /partner/events/06a6f94a-85a4-4b0a-a1a0-38636b0b39ce?tab=equipe#portes-et-couleurs
    - group: Portes et couleurs
    - text: Rechercher
    - textbox "Rechercher":
      - /placeholder: Nom ou numéro
    - text: Événement
    - combobox "Événement":
      - option "Tous les événements" [selected]
      - option "Brunch électro des Almadies · 11 nov. 2026 à 12:00 (passé)"
      - option "Nuit du Sabar — édition d’automne · 15 nov. 2026 à 09:15"
      - option "Croisière musicale vers Gorée · 15 nov. 2026 à 12:30 (passé)"
      - option "Concert des Lumières de Gorée · 16 nov. 2026 à 04:30"
      - option "Grande soirée du Monument de la Renaissance · 18 nov. 2026 à 20:00"
      - option "Festival Jazz sur le Fleuve · 27 nov. 2026 à 18:00"
      - option "Soirée Kora & Lumières · 2 déc. 2026 à 20:30"
      - option "Matinée gospel et chorales · 9 déc. 2026 à 10:00"
      - option "Concert acoustique au jardin · 25 déc. 2026 à 19:00"
    - group "Filtrer l’équipe":
      - button "Tous" [pressed]
      - button "Prêts"
      - button "En attente"
      - button "Sans porte"
      - button "À relancer"
    - paragraph: Vous (organisatrice) — toutes les portes
    - paragraph: Vous scannez vos événements dont le contrôle est ouvert, à toutes les portes ou à une porte choisie, et vous vendez au guichet.
    - link "Scanner les billets":
      - /url: /partner/scan
    - list "Contrôleurs de l’équipe":
      - listitem:
        - paragraph: Ibrahima Gueye
        - paragraph: Actif depuis le 15 nov. 2026
        - text: Prêt
        - paragraph: 70 000 01 06
        - link "Appeler Ibrahima Gueye":
          - /url: tel:+221700000106
          - text: Appeler
        - link "Écrire à Ibrahima Gueye sur WhatsApp":
          - /url: https://wa.me/221700000106?text=Bonjour%20Ibrahima%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2015%20nov.%202026%20%C3%A0%2009%3A15%2C%20Entr%C3%A9e%20principale.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
          - text: WhatsApp
        - list "Événements de Ibrahima Gueye":
          - listitem:
            - paragraph: Nuit du Sabar — édition d’automne · 15 nov. 2026 à 09:15
            - paragraph: "Point d’entrée : Entrée principale"
            - paragraph: "Laisse entrer : toutes les catégories"
            - text: Espèces autorisées
            - link "Caisse ouverte":
              - /url: /partner/events/8cd28bc9-9f78-4eb9-9953-f760008fb225?tab=caisse
            - link "32 entrées · dernier scan à 08:19":
              - /url: /partner/events/8cd28bc9-9f78-4eb9-9953-f760008fb225?tab=entrees
            - button "Modifier"
        - button "Retirer de l’équipe"
      - listitem:
        - paragraph: Lamine Cissé
        - paragraph: Actif depuis le 15 nov. 2026
        - text: Prêt
        - paragraph: 70 000 01 08
        - link "Appeler Lamine Cissé":
          - /url: tel:+221700000108
          - text: Appeler
        - link "Écrire à Lamine Cissé sur WhatsApp":
          - /url: https://wa.me/221700000108?text=Bonjour%20Lamine%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2015%20nov.%202026%20%C3%A0%2009%3A15%2C%20Entr%C3%A9e%20principale.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
          - text: WhatsApp
        - list "Événements de Lamine Cissé":
          - listitem:
            - paragraph: Nuit du Sabar — édition d’automne · 15 nov. 2026 à 09:15
            - paragraph: "Point d’entrée : Entrée principale"
            - paragraph: "Laisse entrer : toutes les catégories"
            - text: Espèces autorisées
            - link "22 entrées · dernier scan à 08:14":
              - /url: /partner/events/8cd28bc9-9f78-4eb9-9953-f760008fb225?tab=entrees
            - button "Modifier"
        - group: Événements passés
        - button "Retirer de l’équipe"
      - listitem:
        - paragraph: Mamadou Sall
        - paragraph: Actif depuis le 15 nov. 2026
        - text: Prêt
        - paragraph: 70 000 01 10
        - link "Appeler Mamadou Sall":
          - /url: tel:+221700000110
          - text: Appeler
        - link "Écrire à Mamadou Sall sur WhatsApp":
          - /url: https://wa.me/221700000110?text=Bonjour%20Mamadou%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Grande%20soir%C3%A9e%20du%20Monument%20de%20la%20Renaissance%20%C2%BB%20le%2018%20nov.%202026%20%C3%A0%2020%3A00%2C%20porte%20Porte%20Nord.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
          - text: WhatsApp
        - list "Événements de Mamadou Sall":
          - listitem:
            - paragraph: Grande soirée du Monument de la Renaissance · 18 nov. 2026 à 20:00
            - paragraph: "Porte : Porte Nord · Entrée générale"
            - text: "Laisse entrer : SIMPLE , pastille blanc VIP , pastille or VVIP , pastille violet Sans espèces Aucune entrée"
            - button "Modifier"
        - button "Retirer de l’équipe"
      - listitem:
        - paragraph: Seynabou Ba
        - paragraph: Actif depuis le 15 nov. 2026
        - text: Prêt
        - paragraph: 70 000 01 07
        - link "Appeler Seynabou Ba":
          - /url: tel:+221700000107
          - text: Appeler
        - link "Écrire à Seynabou Ba sur WhatsApp":
          - /url: https://wa.me/221700000107?text=Bonjour%20Seynabou%2C%20ici%20Baobab%20Sc%C3%A8ne.%20Vous%20contr%C3%B4lez%20l%E2%80%99entr%C3%A9e%20de%20%C2%AB%20Nuit%20du%20Sabar%20%E2%80%94%20%C3%A9dition%20d%E2%80%99automne%20%C2%BB%20le%2015%20nov.%202026%20%C3%A0%2009%3A15%2C%20Entr%C3%A9e%20VIP.%20Ouvrez%20le%20scanner%20%3A%20http%3A%2F%2Flocalhost%3A3000%2Fcontroller%2Fscanner
          - text: WhatsApp
        - list "Événements de Seynabou Ba":
          - listitem:
            - paragraph: Nuit du Sabar — édition d’automne · 15 nov. 2026 à 09:15
            - paragraph: "Point d’entrée : Entrée VIP"
            - paragraph: "Laisse entrer : toutes les catégories"
            - text: Espèces autorisées
            - link "7 entrées · dernier scan à 08:10":
              - /url: /partner/events/8cd28bc9-9f78-4eb9-9953-f760008fb225?tab=entrees
            - button "Modifier"
        - button "Retirer de l’équipe"
    - region "Invitations":
      - heading "Invitations" [level=3]
      - list "Invitations":
        - listitem:
          - paragraph: Fa*** M***
          - text: Invitation envoyée
          - paragraph: "Envoyée le dim. 15 nov. 2026 à 08:21. Fa*** M*** doit accepter avant le mer. 18 nov. 2026 à 08:21. Événements : « Festival Jazz sur le Fleuve »."
          - button "Renvoyer l’invitation"
          - button "Annuler l’invitation"
- navigation "Navigation rapide":
  - link "Accueil":
    - /url: /partner/dashboard
  - link "Billetterie":
    - /url: /partner/events
  - link "Scanner":
    - /url: /partner/scan
  - link "Finances":
    - /url: /partner/finance
  - link "Profil":
    - /url: /partner/profile
- alert
- alertdialog "Retirer Ibrahima Gueye de votre équipe ?":
  - heading "Retirer Ibrahima Gueye de votre équipe ?" [level=2]
  - button "Fermer"
  - paragraph: Ibrahima est retiré de votre événement et reçoit un SMS et un avis. Son scanner est refusé pour vos événements dès votre confirmation, même sur un téléphone déjà ouvert.
  - paragraph: Son accès au scanner est fermé et il est déconnecté de l’application sur tous ses téléphones, espace client compris. Il pourra se reconnecter pour ses billets.
  - paragraph: Pour le reprendre, invitez-le de nouveau.
  - button "Revenir"
  - button "Retirer de l’équipe"
```

# Test source

```ts
  1536 |             zone: ZONE_ENTREE_VIP, gate: GATE_VIP,
  1537 |         }),
  1538 |         async ({ page }) => expectScanLines(page, 'accepte', ['Entrée validée', ENTRY_INSTRUCTION_VIP, 'Zone : Entrée VIP · Porte VIP', 'Invitation']),
  1539 |     ),
  1540 |     withExtraActions(
  1541 |         scanResultScreen('scanner-mauvaise-zone', 'Scanner — mauvaise zone (plein écran orange, zone où se présenter)', {
  1542 |             result: 'wrong_zone', scan_id: 'd3f8a1b2-4c5d-4e6f-8a7b-9c0d1e2f3a42', message: 'Accès refusé : billet VIP',
  1543 |             ticket: SCAN_TICKET_VIP, redirect_zones: ['Entrée VIP'], zone: ZONE_ENTREE_GENERALE, gate: GATE_NORD,
  1544 |         }),
  1545 |         async ({ page }) => expectScanLines(page, 'oriente', ['Accès refusé : billet VIP', 'Présentez-vous à : Entrée VIP']),
  1546 |     ),
  1547 |     withExtraActions(
  1548 |         scanResultScreen('scanner-pas-encore-entre', 'Scanner — pas encore entré (contrôle de zone, plein écran orange)', {
  1549 |             result: 'not_entered', scan_id: 'd3f8a1b2-4c5d-4e6f-8a7b-9c0d1e2f3a43',
  1550 |             ticket: SCAN_TICKET_VIP, redirect_zones: ['Entrée VIP'], zone: ZONE_CARRE_VIP, gate: GATE_ACCES_CARRE,
  1551 |         }),
  1552 |         async ({ page }) => expectScanLines(page, 'oriente', ['Pas encore entré', 'Passez d’abord par : Entrée VIP']),
  1553 |     ),
  1554 |     withExtraActions(
  1555 |         scanResultScreen('scanner-zone-ok', 'Scanner — contrôle de zone accepté (heure et porte de l’entrée)', {
  1556 |             result: 'zone_ok', scan_id: 'd3f8a1b2-4c5d-4e6f-8a7b-9c0d1e2f3a44',
  1557 |             ticket: { ...SCAN_TICKET_VIP, category_color: 'VIOLET', checked_in_at: '2026-11-04T19:42:00.000Z', checked_in_gate: 'Porte VIP' },
  1558 |             zone: ZONE_CARRE_VIP, gate: GATE_ACCES_CARRE,
  1559 |         }),
  1560 |         async ({ page }) => expectScanLines(page, 'accepte', ['Accès autorisé', 'Zone : Carré VIP', 'Entré à 19:42, Porte VIP']),
  1561 |     ),
  1562 |     {
  1563 |         // 409 GATE_REQUIRED : incident technique (scan-client.ts, échec 'gate'), jamais un refus du billet
  1564 |         id: 'scanner-porte-absente', titre: 'Scanner — aucune porte affectée (incident technique, rien n’est validé)', role: 'controleur', needsIds: true,
  1565 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: 'barcode-detector', initStorage: SCANNER_STORAGE, slowTimers: SCANNER_TIMERS,
  1566 |         stubResponses: [{ url: SCAN_URL, method: 'POST', status: 409, body: { error: GATE_REQUIRED_MESSAGE, code: 'GATE_REQUIRED' } }],
  1567 |         allowFailures: [SCAN_URL],
  1568 |         ready: async ({ page }) => startScanner(page),
  1569 |         actions: async (c) => {
  1570 |             await presentToFakeDetector(c.page, demoPayload(c));
  1571 |             await expectScanResult(c.page, 'server_error');
  1572 |             await expectScanLines(c.page, 'technique', ['Aucune porte affectée', 'Demandez à l’organisateur de vous attribuer une porte. Rien n’a été validé.']);
  1573 |         },
  1574 |     },
  1575 |     {
  1576 |         id: 'scanner-liste-invites', titre: 'Scanner — liste des invités : recherche par les 4 derniers chiffres (réponse imposée)', role: 'controleur', needsIds: true,
  1577 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  1578 |         stubResponses: [{ url: GUESTS_URL, method: 'POST', status: 200, body: GUEST_SEARCH_STUB }],
  1579 |         ready: async ({ page }) => startScanner(page),
  1580 |         actions: async ({ page }) => searchGuestList(page),
  1581 |     },
  1582 |     {
  1583 |         id: 'scanner-liste-invites-resultat', titre: 'Scanner — liste des invités : invité choisi, pièce d’identité à vérifier (rien n’est validé)', role: 'controleur', needsIds: true,
  1584 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  1585 |         stubResponses: [{ url: GUESTS_URL, method: 'POST', status: 200, body: GUEST_SEARCH_STUB }],
  1586 |         ready: async ({ page }) => startScanner(page),
  1587 |         actions: async ({ page }) => {
  1588 |             await searchGuestList(page);
  1589 |             await page.getByRole('button', { name: /^choisir/i }).click();
  1590 |             await expect(page.getByText('Vérifiez la pièce d’identité', { exact: true }), 'bandeau de vérification de l’identité (C.3.5)').toBeVisible();
  1591 |             const verified = page.getByRole('checkbox', { name: /^j.ai vérifié la pièce d.identité/i });
  1592 |             await expect(verified, 'case décochée à chaque personne (C.3.5)').not.toBeChecked();
  1593 |             // Jamais cliqué : la capture montre la confirmation, aucune entrée n'est validée
  1594 |             const validate = page.getByRole('button', { name: /^valider l.entrée d.une personne$/i });
  1595 |             await expect(validate, '« Valider » désactivé tant que la pièce n’est pas vérifiée (C.3.5)').toBeDisabled();
  1596 |             await revealCenter(verified);
  1597 |         },
  1598 |     },
  1599 |     {
  1600 |         id: 'partenaire-zones', titre: 'Pilotage — Équipe : zones et portes de l’événement (éditeur)', role: 'organisateur', needsIds: true,
  1601 |         path: zonesTeamPath,
  1602 |         ready: async ({ page }) => { await revealCenter(await zonesEditorReady(page)); },
  1603 |     },
  1604 |     {
  1605 |         id: 'partenaire-equipe-portes', titre: 'Pilotage — Équipe : porte d’un contrôleur et droit de changer de porte', role: 'organisateur', needsIds: true,
  1606 |         path: zonesTeamPath,
  1607 |         ready: async ({ page }) => { await zonesEditorReady(page); },
  1608 |         // Finition 1 (E-14) : la porte se règle dans la fenêtre « Modifier » (un seul « Enregistrer ») ; la ligne en donne le
  1609 |         // résumé « Porte : Porte Nord · Entrée générale » (capture recalée, signalée au rapport)
  1610 |         actions: async ({ page }) => {
  1611 |             await expect(page.getByText('Porte : Porte Nord · Entrée générale').filter({ visible: true }).first(), 'résumé de la porte sur la ligne').toBeVisible({ timeout: 30_000 });
  1612 |             await page.getByRole('button', { name: /^modifier$/i }).filter({ visible: true }).first().click();
  1613 |             const dialog = page.getByRole('dialog');
  1614 |             const gate = dialog.getByLabel(/^porte$/i);
  1615 |             await expect(gate, 'champ « Porte » de la fenêtre « Modifier »').toBeVisible();
  1616 |             await expect(gate.locator('option:checked'), 'porte posée par la graine v4').toHaveText('Porte Nord · Entrée générale');
  1617 |             const canChange = dialog.getByRole('switch', { name: /^peut changer de porte/i });
  1618 |             await expect(canChange, 'interrupteur « Peut changer de porte », fermé dans la graine v4').toHaveAttribute('aria-checked', 'false');
  1619 |         },
  1620 |     },
  1621 |     {
  1622 |         id: 'partenaire-equipe-inviter', titre: 'Équipe — fenêtre « Inviter un contrôleur »', role: 'organisateur', needsIds: true,
  1623 |         path: () => '/partner/team',
  1624 |         ready: async ({ page }) => expectPageTitle(page),
  1625 |         actions: async ({ page }) => {
  1626 |             await page.getByRole('button', { name: /^inviter un contrôleur$/i }).click();
  1627 |             await expect(page.getByRole('dialog', { name: /^inviter un contrôleur$/i }), 'fenêtre d’invitation').toBeVisible();
  1628 |         },
  1629 |     },
  1630 |     {
  1631 |         id: 'partenaire-equipe-retirer', titre: 'Équipe — fenêtre « Retirer de l’équipe » (ce qui se passe, dit vrai)', role: 'organisateur', needsIds: true,
  1632 |         path: () => '/partner/team',
  1633 |         ready: async ({ page }) => expectPageTitle(page),
  1634 |         actions: async ({ page }) => {
  1635 |             await page.getByRole('button', { name: /^retirer de l’équipe$/i }).filter({ visible: true }).first().click();
> 1636 |             await expect(page.getByRole('alertdialog').or(page.getByRole('dialog')).filter({ hasText: /de votre équipe \?/ }).first(), 'fenêtre de retrait').toBeVisible();
       |                                                                                                                                                              ^ Error: fenêtre de retrait
  1637 |         },
  1638 |     },
  1639 |     // ── Lot 9 ter : pilotage et stock (D.3.1) ───────────────────────────────
  1640 |     {
  1641 |         id: 'pilotage-entrees-zones', titre: 'Pilotage — Entrées par zone et par porte, alerte de refus', role: 'organisateur', needsIds: true,
  1642 |         path: (i) => `/partner/events/${seedEvent(i, 'zones').id}?tab=entrees`,
  1643 |         stubResponses: [{ url: ENTRIES_URL, method: 'GET', status: 200, body: ENTRIES_ZONES_STUB }],
  1644 |         ready: async ({ page }) => {
  1645 |             const alert = page.getByText('Beaucoup de refus à Porte Sud', { exact: true });
  1646 |             await expect(alert, 'alerte de refus de la porte Sud (D.1.4)').toBeVisible({ timeout: 30_000 });
  1647 |             await expect(page.getByRole('heading', { name: 'Par zone', exact: true })).toBeVisible();
  1648 |             await expect(page.getByRole('heading', { name: 'Validations par la liste des invités', exact: true })).toBeVisible();
  1649 |             await revealCenter(alert);
  1650 |         },
  1651 |     },
  1652 |     {
  1653 |         id: 'accueil-dernieres-places', titre: 'Accueil — badge « Dernières places » d’un événement presque complet', role: 'anonyme', needsIds: true,
  1654 |         path: () => '/',
  1655 |         ready: async (c) => {
  1656 |             const { title } = seedEvent(c.ids, 'dernieresPlaces');
  1657 |             const card = c.page.locator('article').filter({ has: c.page.getByRole('heading', { name: title, exact: true }) }).first();
  1658 |             await expect(card, `carte de « ${title} » à l’accueil`).toBeVisible({ timeout: 30_000 });
  1659 |             await expect(card.getByText('Dernières places', { exact: true }), 'badge de stock bas (D.2.4)').toBeVisible();
  1660 |             await revealCenter(card);
  1661 |         },
  1662 |     },
  1663 |     // ── Lot 9 ter : versements, retraits retardés, clôture, édition (A.2.6, B.6) ──
  1664 |     {
  1665 |         id: 'admin-versements-constater-non-verse', titre: 'Administration — versements à reprendre : boîte « Constater non versé » (référence, motif ; réponses imposées)',
  1666 |         role: 'fumee-superadmin', needsIds: false, path: () => '/admin/finance',
  1667 |         stubResponses: CASHOUTS_STUBS,
  1668 |         ready: async ({ page }) => { await cashoutsReady(page); },
  1669 |         actions: async ({ page }) => {
  1670 |             // Ligne incertaine sans identifiant SamirPay : seule ligne où can_mark_not_sent est vrai (A.2.3)
  1671 |             const row = page.locator('tr, li, article').filter({ hasText: 'Festival Jazz sur le Fleuve' });
  1672 |             await row.getByRole('button', { name: /^constater non versé/i }).filter({ visible: true }).first().click();
  1673 |             const dialog = anyDialog(page, /^constater que ce versement n.est pas parti/i);
  1674 |             await expect(dialog).toBeVisible();
  1675 |             await expect(dialog.getByLabel(/^référence du support samirpay/i), 'référence du support, 100 caractères au plus (A.2.4)').toHaveAttribute('maxlength', '100');
  1676 |             await expect(dialog.getByLabel(/^motif/i).first(), 'motif obligatoire (A.2.4)').toBeVisible();
  1677 |             // Jamais confirmé : bouton désactivé tant que le motif et la référence manquent
  1678 |             await expect(dialog.getByRole('button', { name: /^constater non versé$/i }), 'confirmation désactivée sans motif ni référence (A.2.4)').toBeDisabled();
  1679 |         },
  1680 |     },
  1681 |     {
  1682 |         id: 'partenaire-finances-retrait-retarde', titre: 'Partenaire — finances : retrait retardé (badge « Retardé » ; réponse imposée)', role: 'organisateur', needsIds: true,
  1683 |         path: () => '/partner/finance',
  1684 |         stubResponse: { url: /\/api\/finance\/balance\?account=ORGANISATEUR$/, status: 200, body: delayedWithdrawalBalance('ORGANISATEUR') },
  1685 |         ready: async ({ page }) => delayedWithdrawalReady(page),
  1686 |     },
  1687 |     {
  1688 |         id: 'portefeuille-retrait-retarde', titre: 'Portefeuille du client : retrait retardé (badge « Retardé » ; réponse imposée)', role: 'client', needsIds: true,
  1689 |         path: () => '/wallet',
  1690 |         stubResponse: { url: /\/api\/finance\/balance\?account=PARRAINAGE$/, status: 200, body: delayedWithdrawalBalance('PARRAINAGE') },
  1691 |         ready: async ({ page }) => delayedWithdrawalReady(page),
  1692 |     },
  1693 |     {
  1694 |         id: 'admin-cloture-motif', titre: 'Administration — clôture d’un événement suspendu : champ « Motif de la clôture » (fiche imposée, rien n’est envoyé)',
  1695 |         role: 'fumee-superadmin', needsIds: true, path: (i) => `/admin/events/${ids(i).events.termine.id}`,
  1696 |         stubResponses: [{ url: new RegExp(`/api/admin/events/${UUID}$`), method: 'GET', status: 200, body: CLOSING_SHEET }],
  1697 |         ready: async ({ page }) => { await expectHeading(page, /^festival des lumières de saint-louis$/i); },
  1698 |         actions: async ({ page }) => {
  1699 |             await page.getByRole('button', { name: /^clore l.événement$/i }).click();
  1700 |             const dialog = anyDialog(page);
  1701 |             await expect(dialog).toBeVisible();
  1702 |             await expect(dialog.getByLabel(/^motif de la clôture/i), 'libellé du motif à la clôture (0.9, B-D24)').toBeVisible();
  1703 |         },
  1704 |     },
  1705 |     {
  1706 |         id: 'edition-quitter-sans-enregistrer', titre: 'Édition d’un événement — quitter sans enregistrer (fenêtre de confirmation)', role: 'organisateur', needsIds: true,
  1707 |         path: (i) => `/partner/events/${ids(i).events.publie.id}/edit`,
  1708 |         actions: async ({ page }) => {
  1709 |             await openTicketingStep(page);
  1710 |             const quantity = page.getByLabel(/^quantité mise en vente/i).first();
  1711 |             await expect(quantity, 'quantité d’une catégorie modifiable').toBeEditable();
  1712 |             const current = Number(await quantity.inputValue());
  1713 |             if (!Number.isInteger(current)) throw new Error(`[e2e] quantité mise en vente illisible : « ${await quantity.inputValue()} »`);
  1714 |             await quantity.fill(String(current + 1)); // jamais enregistrée
  1715 |             await page.getByRole('link', { name: /^retour à mes événements$/i }).click();
  1716 |             const dialog = anyDialog(page, /^quitter sans enregistrer/i);
  1717 |             await expect(dialog, 'garde avant de quitter avec des modifications (R93)').toBeVisible();
  1718 |             await expect(dialog.getByRole('button', { name: /^rester sur la page$/i })).toBeVisible();
  1719 |         },
  1720 |     },
  1721 | ];
  1722 | 
```