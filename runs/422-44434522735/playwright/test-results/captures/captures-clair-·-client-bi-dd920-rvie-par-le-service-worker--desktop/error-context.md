# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · client >> billet-hors-ligne-qr (service worker autorisé) >> billet-hors-ligne-qr — Billet hors ligne — QR affiché sans réseau (page servie par le service worker)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('a[href="/billet/hors-ligne?id=7eabf9dd-3ea9-4b91-a91b-1b37a3b0ca0c"]')
Expected: visible
Timeout: 45000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('a[href="/billet/hors-ligne?id=7eabf9dd-3ea9-4b91-a91b-1b37a3b0ca0c"]') with timeout 45000ms
  - waiting for locator('a[href="/billet/hors-ligne?id=7eabf9dd-3ea9-4b91-a91b-1b37a3b0ca0c"]')

```

```yaml
- complementary:
  - link "Event Village, accueil":
    - /url: /
    - text: Event Village
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
  - paragraph: "Présentez le QR code à l’entrée : il se renouvelle tout seul. Glissez d’un billet à l’autre, et touchez le QR pour l’afficher en grand."
  - link "Mes billets sans réseau":
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
    - region "Billets à venir":
      - 'list "Billets à venir : glissez ou utilisez les flèches pour passer d’un billet à l’autre"':
        - listitem:
          - article "Billet pour Nuit du Sabar — édition d’automne":
            - paragraph: "Catégorie : Standard"
            - heading "Nuit du Sabar — édition d’automne" [level=2]
            - paragraph: Baobab Scène
            - text: Valable Dans 32 min
            - term: Date
            - definition: 19 NOV 2026
            - term: Heure d’accès
            - definition: 02:00
            - term: Lieu
            - definition: Esplanade de la Corniche Ouest
            - term: Prix
            - definition: 5 000 F CFA
            - term: Frais de service
            - definition: 250 F CFA
            - button "Agrandir le QR code en plein écran":
              - img "QR d’entrée dynamique"
            - paragraph: "Numéro du billet : TCK-20261119-7A29967C2B"
            - paragraph: Touchez le QR pour l’agrandir.
            - text: Code renouvelé toutes les 20 s Nouveau code dans 19 secondes
            - paragraph: Une capture d’écran n’est pas acceptée au contrôle.
            - paragraph: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
            - status: Ouvrez ce billet avec du réseau avant d’arriver
            - paragraph: Billet authentique, émis par Event Village
            - button "Transférer"
            - button "Partager le lien de l’événement sur WhatsApp": WhatsApp
            - button "Partager ou copier le lien de l’événement": Lien
            - button "Télécharger le billet en PDF": PDF
            - button "Aide au transfert"
        - listitem:
          - article "Billet pour Concert des Lumières de Gorée":
            - paragraph: "Catégorie : Entrée"
            - heading "Concert des Lumières de Gorée" [level=2]
            - paragraph: Baobab Scène
            - text: Valable Dans 19 h 47 min
            - term: Date
            - definition: 19 NOV 2026
            - term: Heure d’accès
            - definition: 21:15
            - term: Lieu
            - definition: Place du Gouvernement
            - term: Prix
            - definition: 6 000 F CFA
            - term: Frais de service
            - definition: 300 F CFA
            - button "Agrandir le QR code en plein écran":
              - img "QR d’entrée dynamique"
            - paragraph: "Numéro du billet : TCK-20261119-DB26BC355A"
            - paragraph: Touchez le QR pour l’agrandir.
            - text: Code renouvelé toutes les 20 s Nouveau code dans 19 secondes
            - paragraph: Une capture d’écran n’est pas acceptée au contrôle.
            - paragraph: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
            - status: Ouvrez ce billet avec du réseau avant d’arriver
            - paragraph: Billet authentique, émis par Event Village
            - button "Transférer"
            - button "Partager le lien de l’événement sur WhatsApp": WhatsApp
            - button "Partager ou copier le lien de l’événement": Lien
            - button "Télécharger le billet en PDF": PDF
            - button "Aide au transfert"
        - listitem:
          - article "Billet pour Festival Jazz sur le Fleuve":
            - paragraph: "Catégorie : Pass soirée"
            - heading "Festival Jazz sur le Fleuve" [level=2]
            - paragraph: Baobab Scène
            - text: Valable Dans 12 jours et 16 h
            - term: Date
            - definition: 01 DÉC 2026
            - term: Heure d’accès
            - definition: 18:00
            - term: Lieu
            - definition: Quai des Pêcheurs
            - term: Prix
            - definition: 7 500 F CFA
            - term: Frais de service
            - definition: 375 F CFA
            - button "Agrandir le QR code en plein écran":
              - img "QR d’entrée dynamique"
            - paragraph: "Numéro du billet : TCK-20261119-5CBF4C324A"
            - paragraph: Touchez le QR pour l’agrandir.
            - text: Code renouvelé toutes les 20 s Nouveau code dans 19 secondes
            - paragraph: Une capture d’écran n’est pas acceptée au contrôle.
            - paragraph: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
            - status: Disponible sans réseau à partir du lun. 30 nov. 2026 à 18:00
            - paragraph: Billet authentique, émis par Event Village
            - button "Transférer"
            - button "Partager le lien de l’événement sur WhatsApp": WhatsApp
            - button "Partager ou copier le lien de l’événement": Lien
            - button "Télécharger le billet en PDF": PDF
            - button "Aide au transfert"
- alert
```

# Test source

```ts
  1657 |     },
  1658 |     {
  1659 |         id: 'admin-numero-apres-secours', titre: 'Administration — après un code de secours : son nouveau numéro, code envoyé au nouveau numéro (envoi simulé)',
  1660 |         role: 'fumee-superadmin', needsIds: false, path: () => '/admin/securite?numero=1',
  1661 |         stubResponses: [F3D_BACKUP_STATUS, F3D_PHONE_START],
  1662 |         ready: async ({ page }) => {
  1663 |             await expect(page.getByText(/^code de secours accepté$/i)).toBeVisible({ timeout: 30_000 });
  1664 |         },
  1665 |         actions: async ({ page }) => {
  1666 |             await page.getByLabel(/^nouveau numéro/i).fill('76 555 44 33');
  1667 |             await page.getByRole('button', { name: /^envoyer le code au nouveau numéro$/i }).click();
  1668 |             await expect(page.getByText(/saisissez les 6 chiffres reçus au 76 555 44 33/i)).toBeVisible();
  1669 |         },
  1670 |     },
  1671 |     {
  1672 |         id: 'admin-telephone-perdu', titre: 'Administration — fenêtre du code administrateur : « J’ai perdu mon téléphone » (mot de passe et code de secours)',
  1673 |         role: 'fumee-superadmin', needsIds: false, path: () => '/admin/mes-droits',
  1674 |         stubResponses: [F3D_STEP_UP_SMS],
  1675 |         ready: async ({ page }) => {
  1676 |             await expect(page.getByRole('button', { name: /^j[’']ai perdu mon téléphone$/i })).toBeVisible({ timeout: 30_000 });
  1677 |         },
  1678 |         actions: async ({ page }) => {
  1679 |             await page.getByRole('button', { name: /^j[’']ai perdu mon téléphone$/i }).click();
  1680 |             await expect(page.getByLabel(/^code de secours/i)).toBeVisible();
  1681 |             await expect(page.getByRole('button', { name: /^utiliser le code de secours$/i })).toBeVisible();
  1682 |         },
  1683 |     },
  1684 |     {
  1685 |         id: 'admin-equipe-organisatrices', titre: 'Administration — page Équipe : choisir l’organisatrice dans une liste avec recherche',
  1686 |         role: 'fumee-superadmin', needsIds: true, path: () => '/partner/team',
  1687 |         ready: async ({ page }) => {
  1688 |             await expect(page.getByRole('heading', { name: /^choisissez l[’']organisatrice$/i })).toBeVisible({ timeout: 30_000 });
  1689 |             await expect(page.getByRole('list', { name: /^organisatrices$/i })).toBeVisible({ timeout: 30_000 });
  1690 |         },
  1691 |     },
  1692 |     {
  1693 |         id: 'admin-especes-rendues', titre: 'Administration — événement annulé : « Marquer rendu » à la place de l’organisatrice, motif (non confirmé)',
  1694 |         role: 'fumee-superadmin', needsIds: true, path: pilotage('annule'),
  1695 |         ready: async ({ page }) => {
  1696 |             const heading = page.getByRole('heading', { name: /^espèces à rembourser par l[’']organisateur/i });
  1697 |             await expect(heading).toBeVisible({ timeout: 30_000 });
  1698 |             await revealCenter(heading);
  1699 |         },
  1700 |         actions: async ({ page }) => {
  1701 |             await page.getByRole('button', { name: /^marquer rendu : espèces de la vente/i }).first().click();
  1702 |             const dialog = anyDialog(page, /^marquer ces espèces rendues/i);
  1703 |             await expect(dialog).toBeVisible();
  1704 |             await expect(dialog.getByLabel(/^motif/i)).toBeVisible();
  1705 |         },
  1706 |     },
  1707 |     {
  1708 |         id: 'admin-ecart-a-valider', titre: 'Administration — Pilotage, Caisse : « Valider l’écart » pour un admin qui gère les événements',
  1709 |         role: 'fumee-superadmin', needsIds: true, path: pilotage('ceSoir'),
  1710 |         stubResponses: [F3D_CASH],
  1711 |         actions: async ({ page }) => {
  1712 |             await openTab(page, /^caisse/i);
  1713 |             const heading = page.getByRole('heading', { name: /^écarts à valider$/i });
  1714 |             await expect(heading).toBeVisible({ timeout: 30_000 });
  1715 |             await expect(page.getByRole('button', { name: /^valider l[’']écart de la caisse de moussa ndiaye$/i })).toBeVisible();
  1716 |             await revealCenter(heading);
  1717 |         },
  1718 |     },
  1719 |     // ── Contrôle d'accès ────────────────────────────────────────────────────
  1720 |     // Lot 7 (D85, E3) : thème sombre forcé, 2 vues ; après « Commencer le contrôle » (l'écran de départ est
  1721 |     // capturé à part : scanner-accueil)
  1722 |     {
  1723 |         id: 'controleur-scanner', titre: 'Scanner du contrôleur en cours de contrôle (caméra simulée)', role: 'controleur', needsIds: true,
  1724 |         path: () => '/controller/scanner', fakeCamera: true, views: DARK_VIEWS,
  1725 |         ready: async ({ page }) => startScanner(page),
  1726 |     },
  1727 |     // ── Lot 7 : billet hors ligne (7.1, E2) ─────────────────────────────────
  1728 |     {
  1729 |         id: 'billet-hors-ligne-disponible', titre: 'Mes billets — billet disponible hors ligne (service worker actif)', role: 'client', needsIds: true,
  1730 |         path: () => '/tickets?tab=a-venir', serviceWorkers: 'allow', // A10 (R45) : onglet des billets demandé, sinon « Reçus » d'office
  1731 |         ready: async ({ page }) => {
  1732 |             const state = page.locator('[data-ev-offline-state="available"]').first();
  1733 |             await expect(state).toBeVisible({ timeout: 45_000 });
  1734 |             // L'indicateur est sous l'affiche et le QR : sans défilement, aucune image ne le montrait (run 77)
  1735 |             await revealCenter(state);
  1736 |         },
  1737 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  1738 |     },
  1739 |     {
  1740 |         id: 'billet-hors-ligne-a-telecharger', titre: 'Mes billets — billet pas encore enregistré sur le téléphone (téléchargement en cours)', role: 'client', needsIds: true,
  1741 |         path: () => '/tickets?tab=a-venir', holdRequests: [{ url: OFFLINE_CODES_URL, method: 'GET' }], // A10 (R45)
  1742 |         ready: async ({ page }) => {
  1743 |             const state = page.locator('[data-ev-offline-state="missing"]').first();
  1744 |             await expect(state).toBeVisible({ timeout: 30_000 });
  1745 |             await revealCenter(state); // même raison que billet-hors-ligne-disponible
  1746 |         },
  1747 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  1748 |     },
  1749 |     {
  1750 |         id: 'billet-hors-ligne-qr', titre: 'Billet hors ligne — QR affiché sans réseau (page servie par le service worker)', role: 'client', needsIds: true,
  1751 |         path: () => '/tickets?tab=a-venir', serviceWorkers: 'allow', // A10 (R45)
  1752 |         // Billet de « ce soir » (contrôle déjà ouvert), pas celui de « la veille » : le seed ne modifie pas
  1753 |         // access.scan_window_before_hours, donc le lot téléchargé la veille commence à l'ouverture du contrôle
  1754 |         // (début − before_hours, D31) et la page affiche à juste titre « Le code d'entrée s'affichera ici à partir
  1755 |         // du … » sans QR (run 77). Le billet de « la veille » reste celui de billet-hors-ligne-sans-codes.
  1756 |         ready: async (c) => {
> 1757 |             await expect(offlineLink(c.page, ids(c.ids).tickets.clientValide)).toBeVisible({ timeout: 45_000 });
       |                                                                                ^ Error: expect(locator).toBeVisible() failed
  1758 |         },
  1759 |         actions: async (c) => {
  1760 |             const id = ids(c.ids).tickets.clientValide;
  1761 |             c.guard.freeze(); // passage hors ligne volontaire : la collecte d'erreurs s'arrête
  1762 |             await c.context.setOffline(true);
  1763 |             const res = await c.page.goto(`/billet/hors-ligne?id=${encodeURIComponent(id)}`);
  1764 |             expect(res?.fromServiceWorker(), '/billet/hors-ligne hors ligne : réponse servie par le service worker').toBe(true);
  1765 |             await expect(c.page.locator('[data-ev-qr-payload]')).toBeVisible({ timeout: 20_000 });
  1766 |         },
  1767 |         masks: (page) => [page.locator('[data-ev-qr-payload]')],
  1768 |     },
  1769 |     {
  1770 |         id: 'billet-hors-ligne-sans-codes', titre: 'Billet hors ligne — aucun code enregistré sur ce téléphone, réseau coupé', role: 'client', needsIds: true,
  1771 |         path: (i) => `/billet/hors-ligne?id=${encodeURIComponent(ids(i).tickets.clientVeille)}`,
  1772 |         holdRequests: [{ url: OFFLINE_CODES_URL, method: 'GET' }], offline: 'after-load',
  1773 |         ready: async ({ page }) => {
  1774 |             await expect(page.locator('[data-ev-offline-state="offline_missing"]').first()).toBeVisible({ timeout: 20_000 });
  1775 |         },
  1776 |     },
  1777 |     // ── Lot 7 : scanner professionnel (7.2, E3) ─────────────────────────────
  1778 |     {
  1779 |         id: 'scanner-accueil', titre: 'Scanner — écran « Commencer le contrôle » (événement, porte)', role: 'controleur', needsIds: true,
  1780 |         path: () => '/controller/scanner', fakeCamera: true, views: DARK_VIEWS,
  1781 |         ready: async ({ page }) => scannerStartReady(page),
  1782 |     },
  1783 |     scanResultScreen('scanner-accepte', 'Scanner — entrée validée (plein écran)', { result: 'valid', scan_id: '5d2c7a10-8e4b-4f61-9a3d-1c2b3e4f5a60', ticket: SCAN_TICKET }),
  1784 |     // Lot 9 ter (consigne 2, C.4, X5) : porte d'entrée servie ; ligne « Déjà utilisé à {HH:MM}, {porte} » et rouge #991B1B
  1785 |     withExtraActions(
  1786 |         scanResultScreen('scanner-deja-utilise', 'Scanner — billet déjà utilisé (plein écran, heure d’entrée)', {
  1787 |             result: 'already_used', scan_id: '6e3d8b21-9f5c-4a72-8b4e-2d3c4f5a6b71',
  1788 |             ticket: { ...SCAN_TICKET, checked_in_at: '2026-11-04T19:42:00.000Z', checked_in_by_me: false, checked_in_gate: 'Porte Nord' },
  1789 |         }),
  1790 |         async ({ page }) => {
  1791 |             const overlay = scanOverlay(page);
  1792 |             await expect(overlay.getByText('Déjà utilisé à 19:42, Porte Nord', { exact: true }), 'heure et porte de la première entrée (C.2.4, X5)').toBeVisible();
  1793 |             await expect(overlay, 'fond du jeton scan-used : rouge #991B1B (C.2.4)').toHaveCSS('background-color', SCAN_USED_RED);
  1794 |         },
  1795 |     ),
  1796 |     scanResultScreen('scanner-refuse', 'Scanner — entrée refusée (plein écran, QR expiré)', { result: 'qr_expired', scan_id: '7f4e9c32-a06d-4b83-9c5f-3e4d5a6b7c82', ticket: SCAN_TICKET }),
  1797 |     scanResultScreen('scanner-hors-fenetre', 'Scanner — contrôle pas encore ouvert (plein écran)', { result: 'event_not_open', scan_id: '91b6be54-c28f-4da5-9e7b-5a6f7c8d9ea4' }),
  1798 |     scanResultScreen('scanner-evenement-annule', 'Scanner — événement annulé (plein écran)', { result: 'event_cancelled', scan_id: 'a2c7cf65-d39a-4eb6-8f8c-6b7a8d9eafb5' }),
  1799 |     // Lot 8 (8.2 e, contrat 3.5) : réponse d'un renvoi sans ligne, ni scan_id ni ticket ; le parcours réel est au projet terrain
  1800 |     scanResultScreen('scanner-non-traite', 'Scanner — scan non traité après un renvoi (plein écran)', {
  1801 |         result: 'not_processed', code: 'REPLAY_NOT_FOUND', message: 'Scan non traité : aucune entrée enregistrée. Scannez le billet de nouveau.',
  1802 |     }),
  1803 |     {
  1804 |         id: 'scanner-reseau-lent', titre: 'Scanner — réseau lent (envoi retenu, nouvel essai automatique)', role: 'controleur', needsIds: true,
  1805 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: 'barcode-detector', initStorage: SCANNER_STORAGE, slowTimers: SCANNER_TIMERS,
  1806 |         holdRequests: [{ url: SCAN_URL, method: 'POST' }], allowFailures: [SCAN_URL],
  1807 |         ready: async ({ page }) => startScanner(page),
  1808 |         actions: async (c) => {
  1809 |             await presentToFakeDetector(c.page, demoPayload(c));
  1810 |             await expect(c.page.locator('[data-scan-state="slow"]')).toBeVisible({ timeout: 10_000 });
  1811 |         },
  1812 |     },
  1813 |     {
  1814 |         id: 'scanner-hors-ligne', titre: 'Scanner — hors ligne (bandeau permanent, rien n’est validé)', role: 'controleur', needsIds: true,
  1815 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: 'barcode-detector',
  1816 |         ready: async ({ page }) => startScanner(page),
  1817 |         actions: async ({ page, context, guard }) => {
  1818 |             guard.freeze(); // passage hors ligne volontaire après le chargement
  1819 |             await context.setOffline(true);
  1820 |             await expect(page.locator('[data-scan-state="offline"]')).toBeVisible({ timeout: 10_000 });
  1821 |         },
  1822 |     },
  1823 |     {
  1824 |         id: 'scanner-saisie-manuelle', titre: 'Scanner — saisie manuelle, étape « Vérifier » (titulaire affiché)', role: 'controleur', needsIds: true,
  1825 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  1826 |         ready: async ({ page }) => startScanner(page),
  1827 |         actions: async (c) => {
  1828 |             const number = ids(c.ids).tickets.manualLookup.number;
  1829 |             await c.page.getByRole('button', { name: /^saisie manuelle$/i }).click();
  1830 |             await c.page.getByLabel(/^numéro du billet/i).fill(number);
  1831 |             await c.page.getByRole('button', { name: /^vérifier le billet$/i }).click();
  1832 |             await expect(c.page.getByRole('heading', { name: new RegExp(`billet ${number}`, 'i') })).toBeVisible();
  1833 |             await expect(c.page.getByText(/^titulaire$/i)).toBeVisible();
  1834 |         },
  1835 |     },
  1836 |     {
  1837 |         id: 'scanner-guichet', titre: 'Scanner — onglet Guichet, devis servi par le serveur', role: 'controleur', needsIds: true,
  1838 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  1839 |         ready: async ({ page }) => startScanner(page),
  1840 |         actions: async ({ page }) => {
  1841 |             await openTab(page, /^guichet$/i);
  1842 |             await page.getByRole('button', { name: /^ajouter un billet standard$/i }).click();
  1843 |             await expect(page.getByRole('region', { name: /^total à encaisser$/i })).toBeVisible();
  1844 |             // Lot 8 (T23) : catégorie vendue au guichet seulement, reconnue d'un coup d'œil
  1845 |             const press = page.getByRole('list', { name: /^catégories en vente$/i }).getByRole('listitem').filter({ hasText: 'Carré presse' });
  1846 |             const mention = press.getByText('Sur place uniquement', { exact: true });
  1847 |             await expect(mention).toBeVisible();
  1848 |             expect(await fontSizePx(mention), 'taille de la mention « Sur place uniquement », en pixels').toBeGreaterThanOrEqual(14);
  1849 |             await revealCenter(mention);
  1850 |         },
  1851 |     },
  1852 |     {
  1853 |         id: 'caisse-ouverture', titre: 'Caisse — ouverture (fonds de caisse, PIN obligatoire)', role: 'controleur', needsIds: true,
  1854 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  1855 |         stubResponses: [{ url: /\/api\/controller\/shifts\/active(\?.*)?$/, method: 'GET', status: 200, body: { success: true, shift: null, expected_cash_in_drawer: null } }],
  1856 |         ready: async ({ page }) => startScanner(page),
  1857 |         actions: async ({ page }) => {
```