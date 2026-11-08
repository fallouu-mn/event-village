# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · anonyme >> accueil-ville — Accueil — Près de chez vous, ville gardée sur l’appareil
- Location: e2e/captures.spec.ts:174:9

# Error details

```
Error: ville du visiteur relue sur l’appareil

expect(locator).toHaveValue(expected) failed

Locator: locator('section').filter({ has: getByRole('heading', { name: /^près de chez vous/i }) }).getByRole('combobox')
Expected: "DAKAR"
Timeout: 30000ms
Error: element(s) not found

Call log:
  - ville du visiteur relue sur l’appareil locator('section').filter({ has: getByRole('heading', { name: /^près de chez vous/i }) }).getByRole('combobox') with timeout 30000ms
  - waiting for locator('section').filter({ has: getByRole('heading', { name: /^près de chez vous/i }) }).getByRole('combobox')

```

```yaml
- banner:
  - button "Ouvrir le menu"
  - link "Event Village, accueil":
    - /url: /
  - button "Notifications"
  - button "Basculer le thème" [pressed]
  - link "Se connecter":
    - /url: /login
- main:
  - paragraph: Billetterie officielle au Sénégal
  - heading "Découvrez, réservez et vivez les événements qui comptent." [level=1]
  - paragraph: "Concerts, festivals, soirées et rencontres : choisissez votre place, payez en quelques secondes et présentez votre billet à l’entrée."
  - search:
    - text: Rechercher un événement
    - searchbox "Rechercher un événement"
    - button "Explorer"
  - list:
    - listitem:
      - paragraph: Wave et Orange Money
      - paragraph: Payez depuis votre téléphone, le billet arrive aussitôt.
    - listitem:
      - paragraph: QR code dynamique
      - paragraph: "Un code renouvelé en continu : une capture d’écran ne passe pas l’entrée."
    - listitem:
      - paragraph: Remboursement automatique
      - paragraph: "Événement annulé : les billets payés en ligne sont remboursés."
  - region "À l’affiche":
    - heading "À l’affiche" [level=2]
    - status: En direct
    - link "Tous les événements":
      - /url: /explore
    - group "Catégorie":
      - button "Tous" [pressed]
      - button "Concerts & Musique"
      - button "Festivals"
      - button "Gastronomie & Tables"
      - button "Salles & Réceptions"
    - list:
      - listitem:
        - article:
          - paragraph: Baobab Scène
          - heading "Nuit du Sabar — édition d’automne" [level=3]:
            - link "Nuit du Sabar — édition d’automne":
              - /url: /events/708dc7ca-aaf1-400d-be6b-33df27beb3c1
          - text: Concerts & Musique
          - list:
            - listitem: 08 NOV 2026 à 17:45
            - listitem: Esplanade de la Corniche Ouest, Dakar
          - paragraph: À partir de
          - paragraph: 5 000 F CFA
      - listitem:
        - article:
          - paragraph: Baobab Scène
          - heading "Concert des Lumières de Gorée" [level=3]:
            - link "Concert des Lumières de Gorée":
              - /url: /events/9b7379a0-c736-4c98-8e75-321427086a53
          - text: Concerts & Musique
          - list:
            - listitem: 09 NOV 2026 à 13:00
            - listitem: Place du Gouvernement, Gorée
          - paragraph: À partir de
          - paragraph: 6 000 F CFA
      - listitem:
        - article:
          - paragraph: Petite-Côte Événements
          - heading "Marché gourmand de la Petite-Côte" [level=3]:
            - link "Marché gourmand de la Petite-Côte":
              - /url: /events/c1145e70-7915-4477-9657-d283c2ad7d8f
          - text: Gastronomie & Tables
          - list:
            - listitem: 13 NOV 2026 à 10:00
            - listitem: Place du Marché Central, Mbour
          - paragraph: À partir de
          - paragraph: 1 000 F CFA
      - listitem:
        - article:
          - paragraph: Saloum Culture
          - heading "Dîner-spectacle au bord du Saloum" [level=3]:
            - link "Dîner-spectacle au bord du Saloum":
              - /url: /events/4f2efd7a-173a-43a0-9cfa-c45a0a99b7ce
          - text: Salles & Réceptions
          - list:
            - listitem: 16 NOV 2026 à 20:00
            - listitem: Terrasse des Pirogues, Foundiougne
          - paragraph: À partir de
          - paragraph: 25 000 F CFA
      - listitem:
        - article:
          - paragraph: Baobab Scène
          - heading "Festival Jazz sur le Fleuve" [level=3]:
            - link "Festival Jazz sur le Fleuve":
              - /url: /events/b52d1a87-c3ac-45d1-8cfa-6d28a1267a84
          - text: Festivals
          - list:
            - listitem: 20 NOV 2026 à 18:00
            - listitem: Quai des Pêcheurs, Saint-Louis
          - paragraph: À partir de
          - paragraph: 7 500 F CFA
      - listitem:
        - article:
          - paragraph: Baobab Scène
          - heading "Soirée Kora & Lumières" [level=3]:
            - link "Soirée Kora & Lumières":
              - /url: /events/0d42c081-7200-4d5e-8315-1e0cd8f86f34
          - text: Concerts & Musique
          - list:
            - listitem: 25 NOV 2026 à 20:30
            - listitem: Jardin de la Maison des Arts, Dakar
          - paragraph: À partir de
          - paragraph: 6 000 F CFA
      - listitem:
        - article:
          - paragraph: Orga B (test)
          - heading "TEST Spectacle B (publié, à venir)" [level=3]:
            - link "TEST Spectacle B (publié, à venir)":
              - /url: /events/b7851e01-4113-48f5-8817-42edad039468
          - text: Concerts & Musique
          - list:
            - listitem: 28 NOV 2026 à 20:00
            - listitem: Salle de test, Dakar, Dakar
          - paragraph: À partir de
          - paragraph: 4 000 F CFA
      - listitem:
        - article:
          - paragraph: Saloum Culture
          - heading "Gala des entrepreneurs du Saloum" [level=3]:
            - link "Gala des entrepreneurs du Saloum":
              - /url: /events/e12a453f-7b09-4542-aee8-5d4f5d606811
          - text: Salles & Réceptions
          - list:
            - listitem: 29 NOV 2026 à 19:30
            - listitem: Salle des Palétuviers, Kaolack
          - paragraph: À partir de
          - paragraph: 10 000 F CFA
  - region "Vous organisez des événements ? Vendez vos billets avec Event Village.":
    - paragraph: Espace organisateur
    - heading "Vous organisez des événements ? Vendez vos billets avec Event Village." [level=2]
    - list:
      - listitem: Création et publication de vos événements, validées par notre équipe
      - listitem: Ventes et entrées suivies en direct, contrôleurs et caisses sur place
      - listitem: Fonds versés sur votre compte après l’événement
    - link "Devenir organisateur":
      - /url: /partner/register
  - paragraph: Event Village
  - paragraph: Billetterie et événements au Sénégal.
  - navigation "Liens du pied de page":
    - list:
      - listitem:
        - link "Explorer":
          - /url: /explore
      - listitem:
        - link "Mes billets":
          - /url: /tickets
      - listitem:
        - link "Devenir organisateur":
          - /url: /partner/register
  - paragraph: Event Village, 2026. Tous droits réservés.
- navigation "Navigation rapide":
  - link "Accueil":
    - /url: /
  - link "Explorer":
    - /url: /explore
  - link "Billets":
    - /url: /tickets
  - link "Solde":
    - /url: /wallet
- alert
```

# Test source

```ts
  888  |         },
  889  |     },
  890  |     // ── Lot 7 : pages partenaire migrées (7.4, E5 ; 7.0 f, E1) ──────────────
  891  |     {
  892  |         id: 'partenaire-inscription', titre: 'Inscription d’un partenaire (système de design)', role: 'anonyme', needsIds: false, path: () => '/partner/register',
  893  |         ready: async ({ page }) => expectPageTitle(page),
  894  |     },
  895  |     { id: 'partenaire-tableau-de-bord', titre: 'Partenaire — tableau de bord (chiffres servis par le serveur)', role: 'organisateur', needsIds: true, path: () => '/partner/dashboard', ready: async ({ page }) => expectPageTitle(page) },
  896  |     { id: 'partenaire-finances', titre: 'Partenaire — finances (écritures, retraits)', role: 'organisateur', needsIds: true, path: () => '/partner/finance', ready: async ({ page }) => expectPageTitle(page) },
  897  |     { id: 'partenaire-equipe', titre: 'Partenaire — équipe (contrôleurs et affectations)', role: 'organisateur', needsIds: true, path: () => '/partner/team', ready: async ({ page }) => expectPageTitle(page) },
  898  |     { id: 'partenaire-profil', titre: 'Partenaire — profil de l’organisateur', role: 'organisateur', needsIds: true, path: () => '/partner/profile', ready: async ({ page }) => expectPageTitle(page) },
  899  |     { id: 'partenaire-abonnement', titre: 'Partenaire — abonnement et période d’essai', role: 'organisateur', needsIds: true, path: () => '/partner/subscription', ready: async ({ page }) => expectPageTitle(page) },
  900  |     {
  901  |         id: 'partenaire-premiers-pas', titre: 'Partenaire validé sans événement — première utilisation (étapes cochées par le serveur)', role: 'partenaire-premiers-pas', needsIds: true,
  902  |         path: () => '/partner/dashboard',
  903  |         ready: async ({ page }) => {
  904  |             await expect(page.getByRole('heading', { name: /^publiez votre premier événement$/i })).toBeVisible({ timeout: 30_000 });
  905  |         },
  906  |     },
  907  |     // ── Lot 7 : pages masquées par les interrupteurs (7.3, D55) ─────────────
  908  |     {
  909  |         id: 'page-masquee-salles', titre: 'Salles de fête masquées (interrupteur fermé) : page introuvable propre', role: 'anonyme', needsIds: false, path: () => '/halls',
  910  |         expectStatus: 404, allowFailures: [/\/halls(\?.*)?$/],
  911  |         ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
  912  |     },
  913  |     {
  914  |         id: 'page-masquee-commandes', titre: 'Commandes masquées (trois interrupteurs fermés) : page introuvable propre', role: 'client', needsIds: true, path: () => '/orders',
  915  |         expectStatus: 404, allowFailures: [/\/orders(\?.*)?$/],
  916  |         ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
  917  |     },
  918  |     // ── Lot 7 : restes d'interface du lot 6 (7.0 f, E1) ─────────────────────
  919  |     {
  920  |         id: 'controleur-activation', titre: 'Activation d’un compte contrôleur (lien de l’invitation)', role: 'anonyme', needsIds: false,
  921  |         path: () => '/controller/setup?phone=%2B221700000199', views: DARK_VIEWS,
  922  |         ready: async ({ page }) => { await expectHeading(page, /^activer votre compte contrôleur$/i); },
  923  |     },
  924  |     {
  925  |         id: 'controleur-profil', titre: 'Profil du contrôleur (événements assignés, mot de passe)', role: 'controleur', needsIds: true, path: () => '/controller/profile', views: DARK_VIEWS,
  926  |         ready: async ({ page }) => { await expectHeading(page, /^mon profil$/i); },
  927  |     },
  928  |     {
  929  |         id: 'admin-campagnes', titre: 'Administration — campagnes de communication', role: 'admin', needsIds: true, path: () => '/admin/communications',
  930  |         ready: async ({ page }) => { await expectHeading(page, /^campagnes de communication$/i); },
  931  |     },
  932  |     {
  933  |         id: 'aide-transfert', titre: 'Mes billets — aide « Comment marche le transfert ? »', role: 'client', needsIds: true, path: () => '/tickets',
  934  |         actions: async ({ page }) => {
  935  |             await page.getByRole('button', { name: /^comment marche le transfert/i }).click();
  936  |             await expect(page.getByRole('dialog')).toBeVisible();
  937  |         },
  938  |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  939  |     },
  940  |     { id: 'portefeuille', titre: 'Portefeuille du client (solde, parrainage)', role: 'client', needsIds: true, path: () => '/wallet', ready: async ({ page }) => expectPageTitle(page) },
  941  |     // ── Lot 9 : invitations, découverte, compte (contrat section 7) ─────────
  942  |     {
  943  |         id: 'invitations-onglet', titre: 'Pilotage — Invitations (catégorie, numéros, liste)', role: 'organisateur', needsIds: true,
  944  |         path: (i) => `/partner/events/${ids(i).events.ceSoir.id}?tab=invitations`,
  945  |         ready: async ({ page }) => invitationsReady(page),
  946  |     },
  947  |     {
  948  |         id: 'invitations-confirmation', titre: 'Pilotage — Invitations : confirmation de l’envoi', role: 'organisateur', needsIds: true,
  949  |         path: (i) => `/partner/events/${ids(i).events.ceSoir.id}?tab=invitations`,
  950  |         ready: async ({ page }) => invitationsReady(page),
  951  |         actions: async ({ page }) => {
  952  |             const category = page.getByRole('tabpanel').getByLabel(/^catégorie/i);
  953  |             const value = await category.locator('option:not([value=""]):not([disabled])').first().getAttribute('value');
  954  |             if (!value) throw new Error('[e2e] aucune catégorie proposée dans le champ Catégorie des invitations');
  955  |             await category.selectOption(value);
  956  |             await page.getByLabel(/^numéros de téléphone/i).fill('771234567');
  957  |             await page.getByRole('button', { name: /^envoyer les invitations$/i }).click();
  958  |             await expect(page.getByRole('alertdialog', { name: /^confirmer l.envoi/i })).toBeVisible();
  959  |         },
  960  |     },
  961  |     {
  962  |         id: 'mes-paiements', titre: 'Mes paiements (date, événement, montant, opérateur, statut, totaux)', role: 'client', needsIds: true,
  963  |         path: () => '/profile/payments', expectStatus: 200,
  964  |         ready: async ({ page }) => {
  965  |             await expectHeading(page, /^mes paiements$/i);
  966  |             await expect(page.locator('a[href^="/paiement/"]').first()).toBeVisible();
  967  |         },
  968  |     },
  969  |     {
  970  |         id: 'profil', titre: 'Profil du client (identité, photo, numéro)', role: 'client', needsIds: true, path: () => '/profile',
  971  |         ready: async ({ page }) => {
  972  |             await expect(page.getByRole('button', { name: /^enregistrer le profil$/i })).toBeVisible();
  973  |             await expect(page.getByRole('button', { name: /^changer de numéro$/i })).toBeVisible();
  974  |             await expect(page.getByRole('button', { name: /^choisir une photo$/i })).toBeVisible();
  975  |         },
  976  |     },
  977  |     {
  978  |         id: 'changement-numero', titre: 'Profil du client — changement de numéro (boîte ouverte)', role: 'client', needsIds: true, path: () => '/profile',
  979  |         actions: async ({ page }) => {
  980  |             await page.getByRole('button', { name: /^changer de numéro$/i }).click();
  981  |             await expect(page.getByRole('dialog')).toBeVisible();
  982  |         },
  983  |     },
  984  |     {
  985  |         id: 'accueil-ville', titre: 'Accueil — Près de chez vous, ville gardée sur l’appareil', role: 'anonyme', needsIds: false, path: () => '/',
  986  |         initStorage: { 'ev-city': 'DAKAR' },
  987  |         ready: async ({ page }) => {
> 988  |             await expect(nearbySection(page).getByRole('combobox'), 'ville du visiteur relue sur l’appareil').toHaveValue('DAKAR', { timeout: 30_000 });
       |                                                                                                               ^ Error: ville du visiteur relue sur l’appareil
  989  |             await revealCenter(nearbySection(page).getByRole('combobox'));
  990  |         },
  991  |     },
  992  |     {
  993  |         id: 'accueil-populaires-erreur', titre: 'Accueil — Populaires, état d’erreur (Réessayer)', role: 'anonyme', needsIds: false, path: () => '/',
  994  |         injectError: /\/api\/events\/popular/,
  995  |         // Section sous « À l'affiche » : hors de l'image sans défilement
  996  |         ready: async (c) => {
  997  |             await expectRetry(c);
  998  |             await revealCenter(c.page.getByRole('button', { name: /réessayer/i }));
  999  |         },
  1000 |     },
  1001 | ];
  1002 | 
```