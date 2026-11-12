# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · fumee-superadmin >> admin-cloture-motif — Administration — clôture d’un événement suspendu : champ « Motif de la clôture » (fiche imposée, rien n’est envoyé)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: libellé du motif à la clôture (0.9, B-D24)

expect(locator).toBeVisible() failed

Locator: getByRole('dialog').or(getByRole('alertdialog')).getByLabel(/^motif de la clôture/i)
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - libellé du motif à la clôture (0.9, B-D24) getByRole('dialog').or(getByRole('alertdialog')).getByLabel(/^motif de la clôture/i) with timeout 15000ms
  - waiting for getByRole('dialog').or(getByRole('alertdialog')).getByLabel(/^motif de la clôture/i)

```

```yaml
- complementary:
  - link "Event Village, accueil":
    - /url: /
    - text: EVENT VILLAGE
  - navigation "Navigation principale":
    - text: Administration
    - link "Tableau de bord":
      - /url: /admin/dashboard
      - img
      - text: Tableau de bord
    - paragraph: Gestion
    - link "Événements":
      - /url: /admin/events
      - img
      - text: Événements
    - link "Utilisateurs":
      - /url: /admin/users
      - img
      - text: Utilisateurs
    - link "Catalogues et services":
      - /url: /admin/services
      - img
      - text: Catalogues et services
    - paragraph: Finances
    - link "Finance":
      - /url: /admin/finance
      - img
      - text: Finance
    - link "Tarification":
      - /url: /admin/pricing
      - img
      - text: Tarification
    - paragraph: Engagement
    - link "Parrainage":
      - /url: /admin/referral
      - img
      - text: Parrainage
    - link "Communications":
      - /url: /admin/communications
      - img
      - text: Communications
    - paragraph: Système
    - link "Journal d’audit":
      - /url: /admin/audit
      - img
      - text: Journal d’audit
    - link "Notifications":
      - /url: /admin/notifications
      - img
      - text: Notifications
    - link "Scanner":
      - /url: /scan
      - img
      - text: Scanner
    - link "Retour au site":
      - /url: /
      - img
      - text: Retour au site
  - link "Elhadji SuperAdmin Super administrateur":
    - /url: /profile
  - button "Se déconnecter"
  - button "Basculer le thème" [pressed]
- banner:
  - link "Rechercher un événement, un concert, un restaurant…":
    - /url: /explore
  - button "Notifications, 38 non lues": "38"
- main:
  - link "Retour aux événements":
    - /url: /admin/events
  - text: Suspendu Festivals
  - heading "Festival des Lumières de Saint-Louis" [level=1]
  - paragraph: Ndar Événements · dim. 1 nov. 2026 à 20:00
  - button "Clore l’événement"
  - link "Ouvrir le pilotage":
    - /url: /partner/events/00000000-0000-4000-8000-000000000931
  - link "Page publique":
    - /url: /events/00000000-0000-4000-8000-000000000931
  - status:
    - paragraph: Motif de la suspension
    - paragraph: "Lieu fermé par arrêté préfectoral : en attente d’une nouvelle date."
    - paragraph:
      - text: Communiqué à l’organisateur le
      - time: dim. 1 nov. 2026 à 18:00
      - text: .
  - region "Dates et lieu":
    - heading "Dates et lieu" [level=2]
    - term: Début
    - definition: dim. 1 nov. 2026 à 20:00
    - term: Fin
    - definition: lun. 2 nov. 2026 à 02:00
    - term: Lieu
    - definition: Quai Henri Jay, Saint-Louis
    - term: Jauge déclarée
    - definition: 800 personnes
  - region "Description":
    - heading "Description" [level=2]
    - paragraph: Trois scènes sur les quais, musiques mandingues et mbalax jusqu’à l’aube.
  - region "Programme":
    - heading "Programme" [level=2]
    - paragraph: Aucun programme renseigné.
  - region "Catégories et prix":
    - heading "Catégories et prix" [level=2]
    - table "Catégories de billets, tous canaux et inactives comprises":
      - caption: Catégories de billets, tous canaux et inactives comprises
      - rowgroup:
        - row "Catégorie Prix Quota Période de vente Par commande Canaux et état":
          - columnheader "Catégorie"
          - columnheader "Prix"
          - columnheader "Quota"
          - columnheader "Période de vente"
          - columnheader "Par commande"
          - columnheader "Canaux et état"
      - rowgroup:
        - row "Standard 5 000 F CFA 600 Dès la publication · jusqu’à l’événement 10 au plus En ligne et au guichet Active":
          - cell "Standard"
          - cell "5 000 F CFA"
          - cell "600"
          - cell "Dès la publication · jusqu’à l’événement"
          - cell "10 au plus"
          - cell "En ligne et au guichet Active"
  - region "Affiche":
    - heading "Affiche" [level=2]
    - text: Aucune affiche
  - region "Organisateur":
    - heading "Organisateur" [level=2]
    - term: Structure
    - definition: Ndar Événements Compte validé
    - term: Responsable
    - definition: Mariama Sall
    - term: Téléphone
    - definition:
      - link "+221771234567":
        - /url: tel:+221771234567
    - term: Ville
    - definition: Saint-Louis
  - region "Historique des statuts":
    - heading "Historique des statuts" [level=2]
    - list:
      - listitem:
        - paragraph: "Création : Brouillon"
        - paragraph: Mariama Sall (Organisateur) · Création
        - paragraph:
          - time: sam. 10 oct. 2026 à 09:00
      - listitem:
        - paragraph: Publié → Suspendu
        - paragraph: Ousmane Diallo (Administration) · Changement de statut
        - paragraph:
          - time: dim. 1 nov. 2026 à 18:00
        - blockquote: "Motif : Lieu fermé par arrêté préfectoral : en attente d’une nouvelle date."
- alert
- dialog "Terminer l’événement ?":
  - heading "Terminer l’événement ?" [level=2]
  - paragraph: La vente est close. Le contrôle des entrées reste possible jusqu’à la fermeture de la fenêtre de scan.
  - button "Fermer"
  - text: Motif du refus (obligatoire) 0 / 500
  - textbox "Motif du refus (obligatoire)"
  - paragraph: Au moins 3 caractères. Ce motif est communiqué à l’organisateur et reste dans l’historique.
  - button "Annuler"
  - button "Clore l’événement"
```

# Test source

```ts
  1558 |         actions: async ({ page }) => searchGuestList(page),
  1559 |     },
  1560 |     {
  1561 |         id: 'scanner-liste-invites-resultat', titre: 'Scanner — liste des invités : invité choisi, pièce d’identité à vérifier (rien n’est validé)', role: 'controleur', needsIds: true,
  1562 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  1563 |         stubResponses: [{ url: GUESTS_URL, method: 'POST', status: 200, body: GUEST_SEARCH_STUB }],
  1564 |         ready: async ({ page }) => startScanner(page),
  1565 |         actions: async ({ page }) => {
  1566 |             await searchGuestList(page);
  1567 |             await page.getByRole('button', { name: /^choisir/i }).click();
  1568 |             await expect(page.getByText('Vérifiez la pièce d’identité', { exact: true }), 'bandeau de vérification de l’identité (C.3.5)').toBeVisible();
  1569 |             const verified = page.getByRole('checkbox', { name: /^j.ai vérifié la pièce d.identité/i });
  1570 |             await expect(verified, 'case décochée à chaque personne (C.3.5)').not.toBeChecked();
  1571 |             // Jamais cliqué : la capture montre la confirmation, aucune entrée n'est validée
  1572 |             const validate = page.getByRole('button', { name: /^valider l.entrée d.une personne$/i });
  1573 |             await expect(validate, '« Valider » désactivé tant que la pièce n’est pas vérifiée (C.3.5)').toBeDisabled();
  1574 |             await revealCenter(verified);
  1575 |         },
  1576 |     },
  1577 |     {
  1578 |         id: 'partenaire-zones', titre: 'Pilotage — Équipe : zones et portes de l’événement (éditeur)', role: 'organisateur', needsIds: true,
  1579 |         path: zonesTeamPath,
  1580 |         ready: async ({ page }) => { await revealCenter(await zonesEditorReady(page)); },
  1581 |     },
  1582 |     {
  1583 |         id: 'partenaire-equipe-portes', titre: 'Pilotage — Équipe : porte d’un contrôleur et droit de changer de porte', role: 'organisateur', needsIds: true,
  1584 |         path: zonesTeamPath,
  1585 |         ready: async ({ page }) => { await zonesEditorReady(page); },
  1586 |         actions: async ({ page }) => {
  1587 |             const gate = page.getByLabel(/^porte(?: \(obligatoire\))?$/i).first();
  1588 |             await expect(gate, 'champ « Porte » de la ligne du contrôleur (C.1.4)').toBeVisible();
  1589 |             await expect(gate.locator('option:checked'), 'porte posée par la graine v4').toHaveText('Porte Nord — Entrée générale');
  1590 |             const canChange = page.getByRole('switch', { name: /^peut changer de porte/i }).first();
  1591 |             await expect(canChange, 'interrupteur « Peut changer de porte », fermé dans la graine v4').toHaveAttribute('aria-checked', 'false');
  1592 |             await revealCenter(gate);
  1593 |         },
  1594 |     },
  1595 |     // ── Lot 9 ter : pilotage et stock (D.3.1) ───────────────────────────────
  1596 |     {
  1597 |         id: 'pilotage-entrees-zones', titre: 'Pilotage — Entrées par zone et par porte, alerte de refus', role: 'organisateur', needsIds: true,
  1598 |         path: (i) => `/partner/events/${seedEvent(i, 'zones').id}?tab=entrees`,
  1599 |         stubResponses: [{ url: ENTRIES_URL, method: 'GET', status: 200, body: ENTRIES_ZONES_STUB }],
  1600 |         ready: async ({ page }) => {
  1601 |             const alert = page.getByText('Beaucoup de refus à Porte Sud', { exact: true });
  1602 |             await expect(alert, 'alerte de refus de la porte Sud (D.1.4)').toBeVisible({ timeout: 30_000 });
  1603 |             await expect(page.getByRole('heading', { name: 'Par zone', exact: true })).toBeVisible();
  1604 |             await expect(page.getByRole('heading', { name: 'Validations par la liste des invités', exact: true })).toBeVisible();
  1605 |             await revealCenter(alert);
  1606 |         },
  1607 |     },
  1608 |     {
  1609 |         id: 'accueil-dernieres-places', titre: 'Accueil — badge « Dernières places » d’un événement presque complet', role: 'anonyme', needsIds: true,
  1610 |         path: () => '/',
  1611 |         ready: async (c) => {
  1612 |             const { title } = seedEvent(c.ids, 'dernieresPlaces');
  1613 |             const card = c.page.locator('article').filter({ has: c.page.getByRole('heading', { name: title, exact: true }) }).first();
  1614 |             await expect(card, `carte de « ${title} » à l’accueil`).toBeVisible({ timeout: 30_000 });
  1615 |             await expect(card.getByText('Dernières places', { exact: true }), 'badge de stock bas (D.2.4)').toBeVisible();
  1616 |             await revealCenter(card);
  1617 |         },
  1618 |     },
  1619 |     // ── Lot 9 ter : versements, retraits retardés, clôture, édition (A.2.6, B.6) ──
  1620 |     {
  1621 |         id: 'admin-versements-constater-non-verse', titre: 'Administration — versements à reprendre : boîte « Constater non versé » (référence, motif ; réponses imposées)',
  1622 |         role: 'fumee-superadmin', needsIds: false, path: () => '/admin/finance',
  1623 |         stubResponses: CASHOUTS_STUBS,
  1624 |         ready: async ({ page }) => { await cashoutsReady(page); },
  1625 |         actions: async ({ page }) => {
  1626 |             // Ligne incertaine sans identifiant SamirPay : seule ligne où can_mark_not_sent est vrai (A.2.3)
  1627 |             const row = page.locator('tr, li, article').filter({ hasText: 'Festival Jazz sur le Fleuve' });
  1628 |             await row.getByRole('button', { name: /^constater non versé/i }).filter({ visible: true }).first().click();
  1629 |             const dialog = anyDialog(page, /^constater que ce versement n.est pas parti/i);
  1630 |             await expect(dialog).toBeVisible();
  1631 |             await expect(dialog.getByLabel(/^référence du support samirpay/i), 'référence du support, 100 caractères au plus (A.2.4)').toHaveAttribute('maxlength', '100');
  1632 |             await expect(dialog.getByLabel(/^motif/i).first(), 'motif obligatoire (A.2.4)').toBeVisible();
  1633 |             // Jamais confirmé : bouton désactivé tant que le motif et la référence manquent
  1634 |             await expect(dialog.getByRole('button', { name: /^constater non versé$/i }), 'confirmation désactivée sans motif ni référence (A.2.4)').toBeDisabled();
  1635 |         },
  1636 |     },
  1637 |     {
  1638 |         id: 'partenaire-finances-retrait-retarde', titre: 'Partenaire — finances : retrait retardé (badge « Retardé » ; réponse imposée)', role: 'organisateur', needsIds: true,
  1639 |         path: () => '/partner/finance',
  1640 |         stubResponse: { url: /\/api\/finance\/balance\?account=ORGANISATEUR$/, status: 200, body: delayedWithdrawalBalance('ORGANISATEUR') },
  1641 |         ready: async ({ page }) => delayedWithdrawalReady(page),
  1642 |     },
  1643 |     {
  1644 |         id: 'portefeuille-retrait-retarde', titre: 'Portefeuille du client : retrait retardé (badge « Retardé » ; réponse imposée)', role: 'client', needsIds: true,
  1645 |         path: () => '/wallet',
  1646 |         stubResponse: { url: /\/api\/finance\/balance\?account=PARRAINAGE$/, status: 200, body: delayedWithdrawalBalance('PARRAINAGE') },
  1647 |         ready: async ({ page }) => delayedWithdrawalReady(page),
  1648 |     },
  1649 |     {
  1650 |         id: 'admin-cloture-motif', titre: 'Administration — clôture d’un événement suspendu : champ « Motif de la clôture » (fiche imposée, rien n’est envoyé)',
  1651 |         role: 'fumee-superadmin', needsIds: true, path: (i) => `/admin/events/${ids(i).events.termine.id}`,
  1652 |         stubResponses: [{ url: new RegExp(`/api/admin/events/${UUID}$`), method: 'GET', status: 200, body: CLOSING_SHEET }],
  1653 |         ready: async ({ page }) => { await expectHeading(page, /^festival des lumières de saint-louis$/i); },
  1654 |         actions: async ({ page }) => {
  1655 |             await page.getByRole('button', { name: /^clore l.événement$/i }).click();
  1656 |             const dialog = anyDialog(page);
  1657 |             await expect(dialog).toBeVisible();
> 1658 |             await expect(dialog.getByLabel(/^motif de la clôture/i), 'libellé du motif à la clôture (0.9, B-D24)').toBeVisible();
       |                                                                                                                    ^ Error: libellé du motif à la clôture (0.9, B-D24)
  1659 |         },
  1660 |     },
  1661 |     {
  1662 |         id: 'edition-quitter-sans-enregistrer', titre: 'Édition d’un événement — quitter sans enregistrer (fenêtre de confirmation)', role: 'organisateur', needsIds: true,
  1663 |         path: (i) => `/partner/events/${ids(i).events.publie.id}/edit`,
  1664 |         actions: async ({ page }) => {
  1665 |             await openTicketingStep(page);
  1666 |             const quantity = page.getByLabel(/^quantité mise en vente/i).first();
  1667 |             await expect(quantity, 'quantité d’une catégorie modifiable').toBeEditable();
  1668 |             const current = Number(await quantity.inputValue());
  1669 |             if (!Number.isInteger(current)) throw new Error(`[e2e] quantité mise en vente illisible : « ${await quantity.inputValue()} »`);
  1670 |             await quantity.fill(String(current + 1)); // jamais enregistrée
  1671 |             await page.getByRole('link', { name: /^retour à mes événements$/i }).click();
  1672 |             const dialog = anyDialog(page, /^quitter sans enregistrer/i);
  1673 |             await expect(dialog, 'garde avant de quitter avec des modifications (R93)').toBeVisible();
  1674 |             await expect(dialog.getByRole('button', { name: /^rester sur la page$/i })).toBeVisible();
  1675 |         },
  1676 |     },
  1677 | ];
  1678 | 
```