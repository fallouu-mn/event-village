# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · client >> profil — Profil du client (identité, photo, numéro)
- Location: e2e/captures.spec.ts:174:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /^enregistrer le profil$/i })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('button', { name: /^enregistrer le profil$/i }) with timeout 15000ms
  - waiting for getByRole('button', { name: /^enregistrer le profil$/i })

```

```yaml
- banner:
  - button "Ouvrir le menu"
  - link "Event Village, accueil":
    - /url: /
  - button "Notifications, 8 non lues": "8"
  - button "Basculer le thème"
  - link "Mon profil (Fatou Mbaye)":
    - /url: /profile
- main:
  - heading "Mon profil" [level=1]
  - paragraph: Vos coordonnées, l’affichage de l’application, vos notifications et vos accès.
  - region "Fatou Mbaye":
    - heading "Fatou Mbaye" [level=2]
    - term: Téléphone
    - definition: "+221700000105"
    - term: Email
    - definition: fatou.mbaye@demo.eventvillage.local
    - term: "Rôle :"
    - definition: Client
    - term: Statut du compte
    - definition: Compte actif
  - region "Réglages et espaces":
    - heading "Réglages et espaces" [level=2]
    - list:
      - listitem:
        - link "Préférences de notification Rappels, changements d’événement, SMS et notifications push sur cet appareil":
          - /url: /profile/notifications
      - listitem:
        - link "Portefeuille et parrainage Vos gains de parrainage et vos demandes de retrait":
          - /url: /wallet
  - region "Affichage":
    - heading "Affichage" [level=2]
    - group "Thème de l’application":
      - button "Clair" [pressed]
      - button "Sombre"
      - button "Système"
  - button "Se déconnecter"
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
  872  |     },
  873  |     {
  874  |         id: 'paiement-echec', titre: 'Paiement — refusé (Réessayer le paiement)', role: 'client', needsIds: true,
  875  |         path: (i) => `/paiement/${ids(i).payments.failed}`,
  876  |         ready: async ({ page }) => {
  877  |             await expect(page.locator('#payment-status-title')).toHaveText(/n.a pas abouti/i, { timeout: 30_000 });
  878  |         },
  879  |     },
  880  |     {
  881  |         id: 'inscription-code', titre: 'Inscription — étape 2 : code reçu et profil (envoi du code simulé)', role: 'anonyme', needsIds: false, path: () => '/register',
  882  |         stubResponses: [{ url: /\/api\/auth\/register\/start$/, method: 'POST', status: 200, body: { ok: true, phone: '+221771234567', resend_after: 60 } }],
  883  |         ready: async ({ page }) => { await expectHeading(page, /^créer un compte$/i); },
  884  |         actions: async ({ page }) => {
  885  |             await page.getByLabel(/^numéro de téléphone/i).fill('77 123 45 67');
  886  |             await page.getByRole('button', { name: /^recevoir le code par sms$/i }).click();
  887  |             await expect(page.getByText(/^code reçu par sms$/i)).toBeVisible();
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
> 972  |             await expect(page.getByRole('button', { name: /^enregistrer le profil$/i })).toBeVisible();
       |                                                                                          ^ Error: expect(locator).toBeVisible() failed
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
  988  |             await expect(nearbySection(page).getByRole('combobox'), 'ville du visiteur relue sur l’appareil').toHaveValue('DAKAR', { timeout: 30_000 });
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