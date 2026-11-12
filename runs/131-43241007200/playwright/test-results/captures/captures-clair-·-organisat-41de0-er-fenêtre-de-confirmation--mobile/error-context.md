# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · organisateur >> edition-quitter-sans-enregistrer — Édition d’un événement — quitter sans enregistrer (fenêtre de confirmation)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: garde avant de quitter avec des modifications (R93)

expect(locator).toBeVisible() failed

Locator: getByRole('dialog', { name: /^quitter sans enregistrer/i }).or(getByRole('alertdialog', { name: /^quitter sans enregistrer/i }))
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - garde avant de quitter avec des modifications (R93) getByRole('dialog', { name: /^quitter sans enregistrer/i }).or(getByRole('alertdialog', { name: /^quitter sans enregistrer/i })) with timeout 15000ms
  - waiting for getByRole('dialog', { name: /^quitter sans enregistrer/i }).or(getByRole('alertdialog', { name: /^quitter sans enregistrer/i }))

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
  - status: En direct
  - heading "Mes événements" [level=1]
  - paragraph: Soumettez, publiez et pilotez vos événements. Les indicateurs portent sur tous vos événements.
  - link "Créer un événement":
    - /url: /partner/events/new
  - region "Indicateurs sur tous vos événements":
    - paragraph: Événements
    - paragraph: "8"
    - paragraph: Tous statuts confondus
    - paragraph: Billets vendus
    - paragraph: "133"
    - paragraph: Hors invitations
    - paragraph: Recettes en ligne
    - paragraph: 828 000 F CFA
    - paragraph: Billets payés en ligne, remboursements déduits
    - paragraph: Recettes en espèces
    - paragraph: 138 000 F CFA
    - paragraph: Encaissées par vos contrôleurs
  - tablist "Statut des événements":
    - tab "Tous , 8" [selected]
    - tab "Brouillon , 1"
    - tab "En attente de validation , 1"
    - tab "Validé , 0"
    - tab "Publié , 4"
    - tab "Suspendu , 0"
    - tab "Terminé , 1"
    - tab "Annulé , 1"
  - search:
    - text: Rechercher un événement
    - searchbox "Rechercher un événement"
    - button "Rechercher"
  - tabpanel "Tous , 8":
    - list "Événements":
      - listitem:
        - article "Concert acoustique au jardin":
          - text: Brouillon
          - heading "Concert acoustique au jardin" [level=2]
          - list:
            - listitem: mar. 22 déc. 2026 à 19:00
            - listitem: Jardin de la Maison des Arts, Dakar
          - button "Soumettre à la validation"
          - link "Modifier":
            - /url: /partner/events/0632276a-2ba8-4b3d-bc47-61c2d053e3fe/edit
          - button "Supprimer le brouillon"
      - listitem:
        - article "Matinée gospel et chorales":
          - text: En attente de validation
          - heading "Matinée gospel et chorales" [level=2]
          - list:
            - listitem: dim. 6 déc. 2026 à 10:00
            - listitem: Théâtre de verdure de Sicap, Dakar
          - button "Retirer de la validation"
      - listitem:
        - article "Brunch électro des Almadies":
          - text: Terminé
          - heading "Brunch électro des Almadies" [level=2]
          - list:
            - listitem: dim. 8 nov. 2026 à 12:00
            - listitem: Rooftop de la Pointe des Almadies, Dakar
          - link "Piloter":
            - /url: /partner/events/1bde9ca2-39ed-46fe-8034-77449b8b9e74
      - listitem:
        - article "Croisière musicale vers Gorée":
          - text: Annulé
          - heading "Croisière musicale vers Gorée" [level=2]
          - list:
            - listitem: jeu. 12 nov. 2026 à 19:30
            - listitem: Embarcadère du port de Dakar, Dakar
          - link "Piloter":
            - /url: /partner/events/4f10dbf6-b100-4d79-bd31-8d6f6338fc7e
      - listitem:
        - article "Soirée Kora & Lumières":
          - text: Publié
          - heading "Soirée Kora & Lumières" [level=2]
          - list:
            - listitem: dim. 29 nov. 2026 à 20:30
            - listitem: Jardin de la Maison des Arts, Dakar
          - link "Piloter":
            - /url: /partner/events/b4f9758d-e1ca-4041-84a6-4fdafd90654a
          - link "Modifier":
            - /url: /partner/events/b4f9758d-e1ca-4041-84a6-4fdafd90654a/edit
          - button "Annuler l’événement"
      - listitem:
        - article "Festival Jazz sur le Fleuve":
          - text: Publié
          - heading "Festival Jazz sur le Fleuve" [level=2]
          - list:
            - listitem: mar. 24 nov. 2026 à 18:00
            - listitem: Quai des Pêcheurs, Saint-Louis
          - link "Piloter":
            - /url: /partner/events/2dfe81c8-c9a9-42cd-b489-f9972fb1bb88
          - link "Modifier":
            - /url: /partner/events/2dfe81c8-c9a9-42cd-b489-f9972fb1bb88/edit
          - button "Annuler l’événement"
      - listitem:
        - article "Concert des Lumières de Gorée":
          - text: Publié
          - heading "Concert des Lumières de Gorée" [level=2]
          - list:
            - listitem: ven. 13 nov. 2026 à 11:30
            - listitem: Place du Gouvernement, Gorée
          - link "Piloter":
            - /url: /partner/events/24d366d1-c199-44c8-acd6-6a072744f8f3
          - link "Modifier":
            - /url: /partner/events/24d366d1-c199-44c8-acd6-6a072744f8f3/edit
          - button "Annuler l’événement"
      - listitem:
        - article "Nuit du Sabar — édition d’automne":
          - text: Publié
          - heading "Nuit du Sabar — édition d’automne" [level=2]
          - list:
            - listitem: jeu. 12 nov. 2026 à 16:15
            - listitem: Esplanade de la Corniche Ouest, Dakar
          - link "Piloter":
            - /url: /partner/events/85690298-786f-4083-b859-7ca5fd3b3c1f
          - link "Modifier":
            - /url: /partner/events/85690298-786f-4083-b859-7ca5fd3b3c1f/edit
          - button "Annuler l’événement"
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
```

# Test source

```ts
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
  1658 |             await expect(dialog.getByLabel(/^motif de la clôture/i), 'libellé du motif à la clôture (0.9, B-D24)').toBeVisible();
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
> 1673 |             await expect(dialog, 'garde avant de quitter avec des modifications (R93)').toBeVisible();
       |                                                                                         ^ Error: garde avant de quitter avec des modifications (R93)
  1674 |             await expect(dialog.getByRole('button', { name: /^rester sur la page$/i })).toBeVisible();
  1675 |         },
  1676 |     },
  1677 | ];
  1678 | 
```