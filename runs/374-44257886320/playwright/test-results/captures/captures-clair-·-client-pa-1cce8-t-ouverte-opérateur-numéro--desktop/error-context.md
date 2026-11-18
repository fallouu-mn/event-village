# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · client >> paiement-modale — Paiement — modale d’achat ouverte (opérateur, numéro)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: locator.check: Clicking the checkbox did not change its state
Call log:
  - waiting for getByRole('radio', { name: /^wave/i }).first()
    - locator resolved to <input required="" type="radio" value="WAVE" class="peer sr-only" name="_r_0_-operator"/>
  - attempting click action
    - scrolling into view if needed
    - done scrolling
    - forcing action
    - performing click action
    - click action done
    - waiting for scheduled navigations to finish
    - navigations have finished

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - link "Event Village, accueil" [ref=e5] [cursor=pointer]:
        - /url: /
        - generic [ref=e6]: Event Village
      - navigation "Navigation principale" [ref=e9]:
        - generic [ref=e10]:
          - paragraph [ref=e11]: Menu principal
          - generic [ref=e12]:
            - link "Accueil" [ref=e13] [cursor=pointer]:
              - /url: /
            - link "Explorer" [ref=e18] [cursor=pointer]:
              - /url: /explore
            - link "Mes billets" [ref=e23] [cursor=pointer]:
              - /url: /tickets
            - link "Portefeuille" [ref=e27] [cursor=pointer]:
              - /url: /wallet
        - generic [ref=e32]:
          - paragraph [ref=e33]: Espaces métier
          - link "Devenir partenaire" [ref=e35] [cursor=pointer]:
            - /url: /partner/register
      - generic [ref=e41]:
        - link "Fatou Mbaye Client" [ref=e42] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e43]: FM
          - generic [ref=e44]:
            - generic [ref=e45]: Fatou Mbaye
            - generic [ref=e46]: Client
        - generic [ref=e47]:
          - button "Se déconnecter" [ref=e48] [cursor=pointer]
          - button "Basculer le thème" [ref=e53] [cursor=pointer]
    - generic [ref=e57]:
      - banner [ref=e58]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e60] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 7 non lues" [ref=e67] [cursor=pointer]:
          - generic [ref=e71]: "7"
      - main [ref=e72]:
        - generic [ref=e74]:
          - generic [ref=e75]:
            - link "Retour aux événements" [ref=e76] [cursor=pointer]:
              - /url: /explore
            - button "Partager l’événement" [ref=e81] [cursor=pointer]
          - generic [ref=e89]:
            - article [ref=e90]:
              - img "Affiche de l’événement Nuit du Sabar — édition d’automne" [ref=e92]
              - generic [ref=e93]:
                - generic [ref=e94]: Concerts & Musique
                - heading "Nuit du Sabar — édition d’automne" [level=1] [ref=e97]
                - paragraph [ref=e98]: Organisé par Baobab Scène
              - list "Infos de l’événement" [ref=e99]:
                - listitem [ref=e100]:
                  - generic [ref=e104]:
                    - paragraph [ref=e105]: Mercredi 18 novembre 2026 à 08:15
                    - paragraph [ref=e106]: Jusqu’à 13:15
                - listitem [ref=e107]:
                  - generic [ref=e112]:
                    - paragraph [ref=e113]: Esplanade de la Corniche Ouest
                    - paragraph [ref=e114]: Esplanade de la Corniche Ouest, Dakar · Dakar
                - listitem [ref=e115]:
                  - generic [ref=e119]:
                    - paragraph [ref=e120]: Billet dans l’application
                    - paragraph [ref=e121]: Présentez son QR code à l’entrée, depuis Mes billets.
              - region [ref=e122]:
                - heading "À propos" [level=2] [ref=e123]
                - paragraph [ref=e124]: Une nuit entière de sabar avec quatre troupes de percussionnistes et danseurs, en plein air face à l’océan. Restauration sur place, accès aux personnes à mobilité réduite par l’entrée principale.
              - region [ref=e125]:
                - heading "Programme" [level=2] [ref=e126]
                - list [ref=e127]:
                  - listitem [ref=e128]:
                    - generic [ref=e130]:
                      - paragraph [ref=e131]: 19:30
                      - generic [ref=e132]: Activité
                    - paragraph [ref=e134]: Ouverture des portes
                  - listitem [ref=e135]:
                    - generic [ref=e137]:
                      - paragraph [ref=e138]: 20:30
                      - generic [ref=e139]: Artiste
                    - paragraph [ref=e141]: Première partie
                    - paragraph [ref=e142]: Troupe Kër Gëstu
                  - listitem [ref=e143]:
                    - generic [ref=e145]:
                      - paragraph [ref=e146]: 22:00
                      - generic [ref=e147]: Artiste
                    - paragraph [ref=e149]: Grand cercle de sabar
                    - paragraph [ref=e150]: Ensemble Ndawrabine des Parcelles
                  - listitem [ref=e151]:
                    - generic [ref=e153]:
                      - paragraph [ref=e154]: 23:30
                      - generic [ref=e155]: Activité
                    - paragraph [ref=e157]: Bœuf final avec le public
              - region [ref=e158]:
                - heading "Lieu et accès" [level=2] [ref=e159]
                - generic [ref=e160]:
                  - paragraph [ref=e161]: Esplanade de la Corniche Ouest
                  - paragraph [ref=e162]: Esplanade de la Corniche Ouest, Dakar · Dakar
                - generic [ref=e163]:
                  - img "Nuit du Sabar — édition d’automne, Esplanade de la Corniche Ouest" [ref=e170]:
                    - generic [ref=e171]: Nuit du Sabar — édition d’a…
                  - button "Afficher la carte" [ref=e175] [cursor=pointer]
                - link "Voir l’itinéraire" [ref=e180] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=14.6833,-17.4676
                - generic [ref=e190]:
                  - generic [ref=e197]:
                    - paragraph [ref=e198]: Stationnement
                    - generic [ref=e199]: Stationnement surveillé à proximité.
                  - generic [ref=e205]:
                    - paragraph [ref=e206]: Paiement
                    - generic [ref=e207]: Wave ou Orange Money, en ligne. Les frais de service s’affichent avant le paiement.
                  - generic [ref=e213]:
                    - paragraph [ref=e214]: Règlement et consignes
                    - generic [ref=e215]: Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.
              - region "Organisateur" [ref=e216]:
                - generic [ref=e218]:
                  - paragraph [ref=e219]: Organisateur
                  - paragraph [ref=e220]: Baobab Scène
            - complementary [ref=e221]:
              - generic [ref=e222]:
                - generic [ref=e223]:
                  - generic [ref=e224]:
                    - heading "Billetterie" [level=2] [ref=e225]
                    - paragraph [ref=e226]: "Choisissez vos billets : places mises à jour en direct."
                  - status [ref=e227]: En direct
                - list "Catégories de billets" [ref=e229]:
                  - listitem [ref=e230]:
                    - generic [ref=e232]:
                      - generic [ref=e233]:
                        - heading "VIP" [level=3] [ref=e234]
                        - paragraph [ref=e235]: 15 000 F CFA
                        - paragraph [ref=e236]: Disponible
                        - paragraph [ref=e237]: Carré assis, entrée dédiée, une boisson offerte.
                      - group "Quantité VIP" [ref=e238]:
                        - button "Retirer un billet VIP" [disabled] [ref=e239]
                        - status [ref=e242]: "0"
                        - button "Ajouter un billet VIP" [ref=e243] [cursor=pointer]
                  - listitem [ref=e246]:
                    - generic [ref=e248]:
                      - generic [ref=e249]:
                        - heading "Standard" [level=3] [ref=e250]
                        - paragraph [ref=e251]: 5 000 F CFA
                        - paragraph [ref=e252]: Disponible
                        - paragraph [ref=e253]: Accès à l’esplanade.
                      - group "Quantité Standard" [ref=e254]:
                        - button "Retirer un billet Standard" [ref=e255] [cursor=pointer]
                        - status [ref=e258]: "1"
                        - button "Ajouter un billet Standard" [ref=e259] [cursor=pointer]
                    - paragraph [ref=e262]: "1 × 5 000 F CFA : 5 000 F CFA"
                - generic [ref=e263]:
                  - generic [ref=e264]:
                    - generic [ref=e265]:
                      - term [ref=e266]: Billets
                      - definition [ref=e267]: 5 000 F CFA
                    - generic [ref=e268]:
                      - term [ref=e269]: Frais de service
                      - definition [ref=e270]: 250 F CFA
                  - generic [ref=e271]:
                    - generic [ref=e272]: Total (1 billet)
                    - generic [ref=e273]: 5 250 F CFA
                  - button "Acheter 1 billet (5 250 F CFA)" [ref=e274] [cursor=pointer]
                  - paragraph [ref=e279]: Frais de service inclus dans le total, affiché avant le paiement.
                - generic [ref=e280]:
                  - paragraph [ref=e281]:
                    - generic [ref=e282]: Paiement
                    - generic [ref=e283]: Wave
                    - generic [ref=e284]: ou
                    - generic [ref=e285]: Orange Money
                  - paragraph [ref=e286]: Billet avec QR code dans Mes billets, dès le paiement
  - alert [ref=e290]
  - dialog [active] [ref=e293]:
    - generic [ref=e294]:
      - generic [ref=e300]:
        - heading "Paiement sécurisé" [level=2] [ref=e301]
        - paragraph [ref=e302]: Mobile Money, par SamirPay
      - button "Fermer" [ref=e303] [cursor=pointer]
    - generic [ref=e309]:
      - group "Payer avec" [ref=e310]:
        - generic [ref=e311]: Payer avec *
        - generic [ref=e312]:
          - generic [ref=e313] [cursor=pointer]:
            - radio "Wave Mobile Money" [ref=e314]
            - generic [ref=e315]:
              - generic [ref=e316]: Wave
              - generic [ref=e317]: Mobile Money
          - generic [ref=e318] [cursor=pointer]:
            - radio "Orange Money Mobile Money" [ref=e319]
            - generic [ref=e320]:
              - generic [ref=e321]: Orange Money
              - generic [ref=e322]: Mobile Money
      - generic [ref=e323]:
        - generic [ref=e324]: Numéro Mobile Money du payeur *
        - generic [ref=e325]:
          - generic [aria-hidden]: "+221"
          - textbox "Numéro Mobile Money du payeur" [ref=e326]:
            - /placeholder: 77 123 45 67
            - text: 70 000 01 05
        - paragraph [ref=e330]: Numéro de votre profil. Modifiez-le si un autre compte Mobile Money paie.
      - generic [ref=e331]:
        - generic [ref=e332]:
          - paragraph [ref=e333]: Récapitulatif
          - paragraph [ref=e334]: Nuit du Sabar — édition d’automne (1 × Standard)
        - generic [ref=e335]:
          - generic [ref=e336]:
            - term [ref=e337]: Prix des billets
            - definition [ref=e338]: 5 000 F CFA
          - generic [ref=e339]:
            - term [ref=e340]: Frais de service (5 %)
            - definition [ref=e341]: 250 F CFA
          - generic [ref=e342]:
            - term [ref=e343]: Total à payer
            - definition [ref=e344]: 5 250 F CFA
      - list [ref=e345]:
        - listitem [ref=e346]:
          - generic [ref=e350]: Vos places restent réservées pendant le paiement ; le temps restant s’affiche à l’étape suivante.
        - listitem [ref=e351]:
          - generic [ref=e354]: Vous recevrez votre billet, avec son QR code, dans Mes billets dès la confirmation.
      - button "Payer 5 250 F CFA" [ref=e355] [cursor=pointer]
      - paragraph [ref=e357]:
        - generic [ref=e361]: Paiement sécurisé par SamirPay. Votre code secret ne vous sera jamais demandé ici.
```

# Test source

```ts
  1821 |         ready: async ({ page }) => startScanner(page),
  1822 |         actions: async (c) => {
  1823 |             const number = ids(c.ids).tickets.manualLookup.number;
  1824 |             await c.page.getByRole('button', { name: /^saisie manuelle$/i }).click();
  1825 |             await c.page.getByLabel(/^numéro du billet/i).fill(number);
  1826 |             await c.page.getByRole('button', { name: /^vérifier le billet$/i }).click();
  1827 |             await expect(c.page.getByRole('heading', { name: new RegExp(`billet ${number}`, 'i') })).toBeVisible();
  1828 |             await expect(c.page.getByText(/^titulaire$/i)).toBeVisible();
  1829 |         },
  1830 |     },
  1831 |     {
  1832 |         id: 'scanner-guichet', titre: 'Scanner — onglet Guichet, devis servi par le serveur', role: 'controleur', needsIds: true,
  1833 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  1834 |         ready: async ({ page }) => startScanner(page),
  1835 |         actions: async ({ page }) => {
  1836 |             await openTab(page, /^guichet$/i);
  1837 |             await page.getByRole('button', { name: /^ajouter un billet standard$/i }).click();
  1838 |             await expect(page.getByRole('region', { name: /^total à encaisser$/i })).toBeVisible();
  1839 |             // Lot 8 (T23) : catégorie vendue au guichet seulement, reconnue d'un coup d'œil
  1840 |             const press = page.getByRole('list', { name: /^catégories en vente$/i }).getByRole('listitem').filter({ hasText: 'Carré presse' });
  1841 |             const mention = press.getByText('Sur place uniquement', { exact: true });
  1842 |             await expect(mention).toBeVisible();
  1843 |             expect(await fontSizePx(mention), 'taille de la mention « Sur place uniquement », en pixels').toBeGreaterThanOrEqual(14);
  1844 |             await revealCenter(mention);
  1845 |         },
  1846 |     },
  1847 |     {
  1848 |         id: 'caisse-ouverture', titre: 'Caisse — ouverture (fonds de caisse, PIN obligatoire)', role: 'controleur', needsIds: true,
  1849 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  1850 |         stubResponses: [{ url: /\/api\/controller\/shifts\/active(\?.*)?$/, method: 'GET', status: 200, body: { success: true, shift: null, expected_cash_in_drawer: null } }],
  1851 |         ready: async ({ page }) => startScanner(page),
  1852 |         actions: async ({ page }) => {
  1853 |             await openTab(page, /^caisse$/i);
  1854 |             await page.getByRole('button', { name: /^ouvrir ma caisse$/i }).click();
  1855 |             const dialog = page.getByRole('dialog', { name: /^ouvrir ma caisse$/i });
  1856 |             await expect(dialog).toBeVisible();
  1857 |             // Lot 9 bis (R42, A11, contrat 4.3 PIN_REQUIRED) : le PIN du régisseur est obligatoire à l'ouverture
  1858 |             await expect(dialog.getByLabel(/^code pin du régisseur/i), 'PIN du régisseur obligatoire à l’ouverture (R42)').toHaveAttribute('aria-required', 'true');
  1859 |             await expect(dialog.getByText(/facultatif/i), 'plus aucune mention « facultatif » du PIN (R42)').toHaveCount(0);
  1860 |         },
  1861 |     },
  1862 |     {
  1863 |         id: 'caisse-cloture-ecart', titre: 'Caisse — clôture avec écart constaté par le serveur (justification, PIN)', role: 'controleur', needsIds: true,
  1864 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  1865 |         stubResponses: [{
  1866 |             url: /\/api\/controller\/shifts\/close$/, method: 'POST', status: 400,
  1867 |             body: { success: false, code: 'JUSTIFICATION_REQUIRED', discrepancy: -2000, error: 'Écart constaté : justification et code PIN du régisseur requis.' },
  1868 |         }],
  1869 |         allowFailures: [/\/api\/controller\/shifts\/close$/],
  1870 |         ready: async ({ page }) => startScanner(page),
  1871 |         actions: async ({ page }) => {
  1872 |             await openTab(page, /^caisse$/i);
  1873 |             await page.getByRole('button', { name: /^clôturer ma caisse$/i }).click();
  1874 |             const dialog = page.getByRole('dialog', { name: /^clôturer ma caisse$/i });
  1875 |             await expect(dialog).toBeVisible();
  1876 |             // 2 000 de moins que le montant enregistré à l'écran : l'écart affiché (-2 000, réponse figée ci-dessus) tombe juste
  1877 |             const recorded = Number((await dialog.locator('dd').nth(1).innerText()).replace(/\D/g, ''));
  1878 |             await dialog.getByLabel(/^espèces encaissées comptées/i).fill(String(recorded - 2000));
  1879 |             await dialog.getByRole('button', { name: /^clôturer la caisse$/i }).click();
  1880 |             await expect(dialog.getByText(/^écart constaté$/i)).toBeVisible();
  1881 |             await expect(dialog.getByLabel(/^justification de l.écart/i)).toBeVisible();
  1882 |         },
  1883 |     },
  1884 |     {
  1885 |         id: 'caisse-ticket-z', titre: 'Caisse — Z de caisse après la clôture', role: 'controleur', needsIds: true,
  1886 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  1887 |         stubResponses: [{
  1888 |             url: /\/api\/controller\/shifts\/close$/, method: 'POST', status: 200,
  1889 |             body: {
  1890 |                 success: true,
  1891 |                 summary: {
  1892 |                     shift_id: 'b3d8d076-e4ab-4fc7-9a9d-7c8b9eafc0c6', controller_id: 'c4e9e187-f5bc-40d8-8bae-8d9caf0b1d17',
  1893 |                     controller_name: 'Ibrahima Gueye', controller_phone: '+221700000106', event_id: 'd5fae298-06cd-41e9-9cbf-9eadb01c2e28',
  1894 |                     event_title: 'Nuit du Sabar — édition d’automne', opened_at: '2026-11-04T18:30:00.000Z', closed_at: '2026-11-04T23:45:00.000Z',
  1895 |                     opening_float_amount: 10000, expected_cash_total: 23000, declared_cash_total: 21000, discrepancy_amount: -2000,
  1896 |                     discrepancy_justification: 'Monnaie rendue en trop à un spectateur, signalée au régisseur.', status: 'CLOTURE', closing_confirmed_by_pin: true,
  1897 |                 },
  1898 |             },
  1899 |         }],
  1900 |         ready: async ({ page }) => startScanner(page),
  1901 |         actions: async ({ page }) => {
  1902 |             await openTab(page, /^caisse$/i);
  1903 |             await page.getByRole('button', { name: /^clôturer ma caisse$/i }).click();
  1904 |             const dialog = page.getByRole('dialog', { name: /^clôturer ma caisse$/i });
  1905 |             await dialog.getByLabel(/^espèces encaissées comptées/i).fill('21000');
  1906 |             await dialog.getByRole('button', { name: /^clôturer la caisse$/i }).click();
  1907 |             await expect(page.getByRole('dialog', { name: /^caisse clôturée$/i })).toBeVisible();
  1908 |         },
  1909 |     },
  1910 |     // ── Lot 7 : paiement et inscription (7.3, E4) ───────────────────────────
  1911 |     {
  1912 |         id: 'paiement-modale', titre: 'Paiement — modale d’achat ouverte (opérateur, numéro)', role: 'client', needsIds: true,
  1913 |         path: (i) => `/events/${ids(i).events.ceSoir.id}`,
  1914 |         actions: async ({ page }) => {
  1915 |             await page.getByRole('button', { name: /^ajouter un billet standard/i }).click();
  1916 |             // Bouton du panneau de billetterie (« Acheter 1 billet (…) ») : à 390 px la barre d'achat fixe du bas
  1917 |             // (lg:hidden) porte aussi « Acheter (…) », même action ; /^acheter/ visait les deux (run 77, mode strict).
  1918 |             await page.getByRole('button', { name: /^acheter \d+ billets? \(/i }).click();
  1919 |             await expect(page.getByRole('dialog').or(page.getByRole('alertdialog'))).toBeVisible();
  1920 |             // Design 1b (point 7) : opérateur choisi (grand bouton Wave sélectionné)
> 1921 |             await page.getByRole('radio', { name: /^wave/i }).first().check({ force: true });
       |                                                                       ^ Error: locator.check: Clicking the checkbox did not change its state
  1922 |         },
  1923 |     },
  1924 |     {
  1925 |         id: 'paiement-attente', titre: 'Paiement — en attente de validation chez l’opérateur', role: 'client', needsIds: true,
  1926 |         path: (i) => `/paiement/${ids(i).payments.pending}`,
  1927 |         ready: async ({ page }) => {
  1928 |             await expect(page.locator('#payment-status-title')).toBeVisible({ timeout: 30_000 });
  1929 |         },
  1930 |     },
  1931 |     {
  1932 |         id: 'paiement-succes', titre: 'Paiement — confirmé (billets émis, redirection annulable)', role: 'client', needsIds: true,
  1933 |         path: (i) => `/paiement/${ids(i).payments.success}`, slowTimers: { minDelayMs: 1000, factor: 100 },
  1934 |         ready: async ({ page }) => {
  1935 |             await expect(page.locator('#payment-status-title')).toHaveText(/paiement confirmé/i, { timeout: 30_000 });
  1936 |         },
  1937 |     },
  1938 |     {
  1939 |         id: 'paiement-echec', titre: 'Paiement — refusé (Réessayer le paiement)', role: 'client', needsIds: true,
  1940 |         path: (i) => `/paiement/${ids(i).payments.failed}`,
  1941 |         ready: async ({ page }) => {
  1942 |             await expect(page.locator('#payment-status-title')).toHaveText(/n.a pas abouti/i, { timeout: 30_000 });
  1943 |         },
  1944 |     },
  1945 |     {
  1946 |         id: 'inscription-code', titre: 'Inscription — étape 2 : code reçu et profil (envoi du code simulé)', role: 'anonyme', needsIds: false, path: () => '/register',
  1947 |         stubResponses: [{ url: /\/api\/auth\/register\/start$/, method: 'POST', status: 200, body: { ok: true, phone: '+221771234567', resend_after: 60 } }],
  1948 |         ready: async ({ page }) => { await expectHeading(page, /^créer un compte$/i); },
  1949 |         actions: async ({ page }) => {
  1950 |             await page.getByLabel(/^numéro de téléphone/i).fill('77 123 45 67');
  1951 |             await page.getByRole('button', { name: /^recevoir le code par sms$/i }).click();
  1952 |             await expect(page.getByText(/^code reçu par sms$/i)).toBeVisible();
  1953 |         },
  1954 |     },
  1955 |     // ── Lot 7 : pages partenaire migrées (7.4, E5 ; 7.0 f, E1) ──────────────
  1956 |     {
  1957 |         id: 'partenaire-inscription', titre: 'Inscription d’un partenaire (système de design)', role: 'anonyme', needsIds: false, path: () => '/partner/register',
  1958 |         ready: async ({ page }) => expectPageTitle(page),
  1959 |     },
  1960 |     { id: 'partenaire-tableau-de-bord', titre: 'Partenaire — tableau de bord (chiffres servis par le serveur)', role: 'organisateur', needsIds: true, path: () => '/partner/dashboard', ready: async ({ page }) => expectPageTitle(page) },
  1961 |     { id: 'partenaire-finances', titre: 'Partenaire — finances (écritures, retraits)', role: 'organisateur', needsIds: true, path: () => '/partner/finance', ready: async ({ page }) => expectPageTitle(page) },
  1962 |     { id: 'partenaire-equipe', titre: 'Partenaire — équipe (contrôleurs et affectations)', role: 'organisateur', needsIds: true, path: () => '/partner/team', ready: async ({ page }) => expectPageTitle(page) },
  1963 |     { id: 'partenaire-profil', titre: 'Partenaire — profil de l’organisateur', role: 'organisateur', needsIds: true, path: () => '/partner/profile', ready: async ({ page }) => expectPageTitle(page) },
  1964 |     { id: 'partenaire-abonnement', titre: 'Partenaire — abonnement et période d’essai', role: 'organisateur', needsIds: true, path: () => '/partner/subscription', ready: async ({ page }) => expectPageTitle(page) },
  1965 |     {
  1966 |         id: 'partenaire-premiers-pas', titre: 'Partenaire validé sans événement — première utilisation (étapes cochées par le serveur)', role: 'partenaire-premiers-pas', needsIds: true,
  1967 |         path: () => '/partner/dashboard',
  1968 |         ready: async ({ page }) => {
  1969 |             await expect(page.getByRole('heading', { name: /^publiez votre premier événement$/i })).toBeVisible({ timeout: 30_000 });
  1970 |         },
  1971 |     },
  1972 |     // ── Lot 7 : pages masquées par les interrupteurs (7.3, D55) ─────────────
  1973 |     {
  1974 |         id: 'page-masquee-salles', titre: 'Salles de fête masquées (interrupteur fermé) : page introuvable propre', role: 'anonyme', needsIds: false, path: () => '/halls',
  1975 |         expectStatus: 404, allowFailures: [/\/halls(\?.*)?$/],
  1976 |         ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
  1977 |     },
  1978 |     {
  1979 |         id: 'page-masquee-commandes', titre: 'Commandes masquées (trois interrupteurs fermés) : page introuvable propre', role: 'client', needsIds: true, path: () => '/orders',
  1980 |         expectStatus: 404, allowFailures: [/\/orders(\?.*)?$/],
  1981 |         ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
  1982 |     },
  1983 |     // ── Lot 7 : restes d'interface du lot 6 (7.0 f, E1) ─────────────────────
  1984 |     {
  1985 |         id: 'controleur-activation', titre: 'Activation d’un compte contrôleur (lien de l’invitation)', role: 'anonyme', needsIds: false,
  1986 |         path: () => '/controller/setup?phone=%2B221700000199', views: DARK_VIEWS,
  1987 |         ready: async ({ page }) => { await expectHeading(page, /^activer votre compte contrôleur$/i); },
  1988 |     },
  1989 |     {
  1990 |         id: 'controleur-profil', titre: 'Profil du contrôleur (événements assignés, mot de passe)', role: 'controleur', needsIds: true, path: () => '/controller/profile', views: DARK_VIEWS,
  1991 |         ready: async ({ page }) => { await expectHeading(page, /^mon profil$/i); },
  1992 |     },
  1993 |     {
  1994 |         // Finition 1 (complément 13) : historique des soirées du contrôleur, depuis son profil (réponse imposée : trois
  1995 |         // soirées types, caisse clôturée, écart en attente, événement annulé sans caisse)
  1996 |         id: 'controleur-soirees', titre: 'Mes soirées du contrôleur (entrées et caisse, lecture seule)', role: 'controleur', needsIds: true,
  1997 |         path: () => '/profile/soirees',
  1998 |         stubResponses: [{
  1999 |             url: /\/api\/account\/evenings(\?|$)/, method: 'GET', status: 200, body: { items: [
  2000 |                 { event_id: '00000000-0000-4000-8000-0000000000a1', title: 'Nuit du Sabar — édition d’automne', status: 'TERMINE', start_at: '2026-11-07T20:00:00.000Z',
  2001 |                   organizer: 'Teranga Events', gate: 'Porte VIP', zone: 'Carré VIP', entry_point: null, entries: 214,
  2002 |                   cash: { collected: 36000, gap: 0, state: 'CLOSED' } },
  2003 |                 { event_id: '00000000-0000-4000-8000-0000000000a2', title: 'Gala de la Teranga', status: 'TERMINE', start_at: '2026-10-24T19:30:00.000Z',
  2004 |                   organizer: 'Teranga Events', gate: null, zone: null, entry_point: 'Entrée principale', entries: 87,
  2005 |                   cash: { collected: 12000, gap: -2000, state: 'GAP_PENDING' } },
  2006 |                 { event_id: '00000000-0000-4000-8000-0000000000a3', title: 'Festival du Fleuve', status: 'ANNULE', start_at: '2026-10-10T18:00:00.000Z',
  2007 |                   organizer: 'Saint-Louis Live', gate: null, zone: null, entry_point: null, entries: 0, cash: null },
  2008 |             ] },
  2009 |         }],
  2010 |         ready: async ({ page }) => { await expectHeading(page, /^mes soirées$/i); },
  2011 |     },
  2012 |     {
  2013 |         id: 'admin-campagnes', titre: 'Administration — campagnes de communication', role: 'admin', needsIds: true, path: () => '/admin/communications',
  2014 |         ready: async ({ page }) => { await expectHeading(page, /^campagnes de communication$/i); },
  2015 |     },
  2016 |     {
  2017 |         id: 'aide-transfert', titre: 'Mes billets — aide « Comment marche le transfert ? »', role: 'client', needsIds: true, path: () => '/tickets',
  2018 |         actions: async ({ page }) => {
  2019 |             await page.getByRole('button', { name: /^comment marche le transfert/i }).click();
  2020 |             await expect(page.getByRole('dialog')).toBeVisible();
  2021 |         },
```