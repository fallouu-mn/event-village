# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · client >> paiement-modale — Paiement — modale d’achat ouverte (opérateur, numéro)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('radio', { name: /^wave/i }).first()
    - locator resolved to <input required="" type="radio" value="WAVE" class="peer sr-only" name="_r_0_-operator"/>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <label class="ev-press relative block cursor-pointer">…</label> intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <label class="ev-press relative block cursor-pointer">…</label> intercepts pointer events
    - retrying click action
      - waiting 100ms
    29 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <label class="ev-press relative block cursor-pointer">…</label> intercepts pointer events
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
            - /url: /
        - generic [ref=e13]:
          - button "Notifications, 7 non lues" [ref=e15] [cursor=pointer]:
            - generic [ref=e19]: "7"
          - button "Basculer le thème" [ref=e21] [cursor=pointer]
          - link "Mon profil (Fatou Mbaye)" [ref=e25] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e26]: FM
      - main [ref=e28]:
        - generic [ref=e30]:
          - generic [ref=e31]:
            - link "Retour aux événements" [ref=e32] [cursor=pointer]:
              - /url: /explore
            - button "Partager l’événement" [ref=e37] [cursor=pointer]
          - generic [ref=e45]:
            - article [ref=e46]:
              - img "Affiche de l’événement Nuit du Sabar — édition d’automne" [ref=e48]
              - generic [ref=e49]:
                - generic [ref=e50]: Concerts & Musique
                - heading "Nuit du Sabar — édition d’automne" [level=1] [ref=e53]
                - paragraph [ref=e54]: Organisé par Baobab Scène
              - list "Infos de l’événement" [ref=e55]:
                - listitem [ref=e56]:
                  - generic [ref=e60]:
                    - paragraph [ref=e61]: Mercredi 18 novembre 2026 à 07:00
                    - paragraph [ref=e62]: Jusqu’à 12:00
                - listitem [ref=e63]:
                  - generic [ref=e68]:
                    - paragraph [ref=e69]: Esplanade de la Corniche Ouest
                    - paragraph [ref=e70]: Esplanade de la Corniche Ouest, Dakar · Dakar
                - listitem [ref=e71]:
                  - generic [ref=e75]:
                    - paragraph [ref=e76]: Billet dans l’application
                    - paragraph [ref=e77]: Présentez son QR code à l’entrée, depuis Mes billets.
              - region [ref=e78]:
                - heading "À propos" [level=2] [ref=e79]
                - paragraph [ref=e80]: Une nuit entière de sabar avec quatre troupes de percussionnistes et danseurs, en plein air face à l’océan. Restauration sur place, accès aux personnes à mobilité réduite par l’entrée principale.
              - region [ref=e81]:
                - heading "Programme" [level=2] [ref=e82]
                - list [ref=e83]:
                  - listitem [ref=e84]:
                    - generic [ref=e86]:
                      - paragraph [ref=e87]: 19:30
                      - generic [ref=e88]: Activité
                    - paragraph [ref=e90]: Ouverture des portes
                  - listitem [ref=e91]:
                    - generic [ref=e93]:
                      - paragraph [ref=e94]: 20:30
                      - generic [ref=e95]: Artiste
                    - paragraph [ref=e97]: Première partie
                    - paragraph [ref=e98]: Troupe Kër Gëstu
                  - listitem [ref=e99]:
                    - generic [ref=e101]:
                      - paragraph [ref=e102]: 22:00
                      - generic [ref=e103]: Artiste
                    - paragraph [ref=e105]: Grand cercle de sabar
                    - paragraph [ref=e106]: Ensemble Ndawrabine des Parcelles
                  - listitem [ref=e107]:
                    - generic [ref=e109]:
                      - paragraph [ref=e110]: 23:30
                      - generic [ref=e111]: Activité
                    - paragraph [ref=e113]: Bœuf final avec le public
              - region [ref=e114]:
                - heading "Lieu et accès" [level=2] [ref=e115]
                - generic [ref=e116]:
                  - paragraph [ref=e117]: Esplanade de la Corniche Ouest
                  - paragraph [ref=e118]: Esplanade de la Corniche Ouest, Dakar · Dakar
                - generic [ref=e119]:
                  - img "Nuit du Sabar — édition d’automne, Esplanade de la Corniche Ouest" [ref=e126]:
                    - generic [ref=e127]: Nuit du Sabar — édition d’a…
                  - button "Afficher la carte" [ref=e131] [cursor=pointer]
                - link "Voir l’itinéraire" [ref=e136] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=14.6833,-17.4676
                - generic [ref=e146]:
                  - generic [ref=e153]:
                    - paragraph [ref=e154]: Stationnement
                    - generic [ref=e155]: Stationnement surveillé à proximité.
                  - generic [ref=e161]:
                    - paragraph [ref=e162]: Paiement
                    - generic [ref=e163]: Wave ou Orange Money, en ligne. Les frais de service s’affichent avant le paiement.
                  - generic [ref=e169]:
                    - paragraph [ref=e170]: Règlement et consignes
                    - generic [ref=e171]: Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.
              - region "Organisateur" [ref=e172]:
                - generic [ref=e174]:
                  - paragraph [ref=e175]: Organisateur
                  - paragraph [ref=e176]: Baobab Scène
            - complementary [ref=e177]:
              - generic [ref=e178]:
                - generic [ref=e179]:
                  - generic [ref=e180]:
                    - heading "Billetterie" [level=2] [ref=e181]
                    - paragraph [ref=e182]: "Choisissez vos billets : places mises à jour en direct."
                  - status [ref=e183]: En direct
                - list "Catégories de billets" [ref=e185]:
                  - listitem [ref=e186]:
                    - generic [ref=e188]:
                      - generic [ref=e189]:
                        - heading "VIP" [level=3] [ref=e190]
                        - paragraph [ref=e191]: 15 000 F CFA
                        - paragraph [ref=e192]: Disponible
                        - paragraph [ref=e193]: Carré assis, entrée dédiée, une boisson offerte.
                      - group "Quantité VIP" [ref=e194]:
                        - button "Retirer un billet VIP" [disabled] [ref=e195]
                        - status [ref=e198]: "0"
                        - button "Ajouter un billet VIP" [ref=e199] [cursor=pointer]
                  - listitem [ref=e202]:
                    - generic [ref=e204]:
                      - generic [ref=e205]:
                        - heading "Standard" [level=3] [ref=e206]
                        - paragraph [ref=e207]: 5 000 F CFA
                        - paragraph [ref=e208]: Disponible
                        - paragraph [ref=e209]: Accès à l’esplanade.
                      - group "Quantité Standard" [ref=e210]:
                        - button "Retirer un billet Standard" [ref=e211] [cursor=pointer]
                        - status [ref=e214]: "1"
                        - button "Ajouter un billet Standard" [ref=e215] [cursor=pointer]
                    - paragraph [ref=e218]: "1 × 5 000 F CFA : 5 000 F CFA"
                - generic [ref=e219]:
                  - generic [ref=e220]:
                    - generic [ref=e221]:
                      - term [ref=e222]: Billets
                      - definition [ref=e223]: 5 000 F CFA
                    - generic [ref=e224]:
                      - term [ref=e225]: Frais de service
                      - definition [ref=e226]: 250 F CFA
                  - generic [ref=e227]:
                    - generic [ref=e228]: Total (1 billet)
                    - generic [ref=e229]: 5 250 F CFA
                  - button "Acheter 1 billet (5 250 F CFA)" [ref=e230] [cursor=pointer]
                  - paragraph [ref=e235]: Frais de service inclus dans le total, affiché avant le paiement.
                - generic [ref=e236]:
                  - paragraph [ref=e237]:
                    - generic [ref=e238]: Paiement
                    - generic [ref=e239]: Wave
                    - generic [ref=e240]: ou
                    - generic [ref=e241]: Orange Money
                  - paragraph [ref=e242]: Billet avec QR code dans Mes billets, dès le paiement
              - region "Achat des billets" [ref=e247]:
                - generic [ref=e248]:
                  - generic [ref=e249]:
                    - paragraph [ref=e250]: 1 × Standard
                    - paragraph [ref=e251]: 5 250 F CFA
                  - button "Acheter (1)" [ref=e252] [cursor=pointer]
    - navigation "Navigation rapide" [ref=e254]:
      - generic [ref=e255]:
        - link "Accueil" [ref=e256] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e261] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e266] [cursor=pointer]:
          - /url: /tickets
        - link "Portefeuille" [ref=e270] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e275]
  - dialog [ref=e278]:
    - generic [ref=e279]:
      - generic [ref=e285]:
        - heading "Paiement sécurisé" [level=2] [ref=e286]
        - paragraph [ref=e287]: Mobile Money, par SamirPay
      - button "Fermer" [ref=e288] [cursor=pointer]
    - generic [ref=e294]:
      - group "Payer avec" [ref=e295]:
        - generic [ref=e296]: Payer avec *
        - generic [ref=e297]:
          - generic [ref=e298] [cursor=pointer]:
            - radio "Wave Mobile Money" [active] [ref=e299]
            - generic [ref=e300]:
              - generic [ref=e301]: Wave
              - generic [ref=e302]: Mobile Money
          - generic [ref=e303] [cursor=pointer]:
            - radio "Orange Money Mobile Money" [ref=e304]
            - generic [ref=e305]:
              - generic [ref=e306]: Orange Money
              - generic [ref=e307]: Mobile Money
      - generic [ref=e308]:
        - generic [ref=e309]: Numéro Mobile Money du payeur *
        - generic [ref=e310]:
          - generic [aria-hidden]: "+221"
          - textbox "Numéro Mobile Money du payeur" [ref=e311]:
            - /placeholder: 77 123 45 67
            - text: 70 000 01 05
        - paragraph [ref=e315]: Numéro de votre profil. Modifiez-le si un autre compte Mobile Money paie.
      - generic [ref=e316]:
        - generic [ref=e317]:
          - paragraph [ref=e318]: Récapitulatif
          - paragraph [ref=e319]: Nuit du Sabar — édition d’automne (1 × Standard)
        - generic [ref=e320]:
          - generic [ref=e321]:
            - term [ref=e322]: Prix des billets
            - definition [ref=e323]: 5 000 F CFA
          - generic [ref=e324]:
            - term [ref=e325]: Frais de service (5 %)
            - definition [ref=e326]: 250 F CFA
          - generic [ref=e327]:
            - term [ref=e328]: Total à payer
            - definition [ref=e329]: 5 250 F CFA
      - list [ref=e330]:
        - listitem [ref=e331]:
          - generic [ref=e335]: Vos places restent réservées pendant le paiement ; le temps restant s’affiche à l’étape suivante.
        - listitem [ref=e336]:
          - generic [ref=e339]: Vous recevrez votre billet, avec son QR code, dans Mes billets dès la confirmation.
      - button "Payer 5 250 F CFA" [ref=e340] [cursor=pointer]
      - paragraph [ref=e342]:
        - generic [ref=e346]: Paiement sécurisé par SamirPay. Votre code secret ne vous sera jamais demandé ici.
```

# Test source

```ts
  1810 |         ready: async ({ page }) => startScanner(page),
  1811 |         actions: async (c) => {
  1812 |             const number = ids(c.ids).tickets.manualLookup.number;
  1813 |             await c.page.getByRole('button', { name: /^saisie manuelle$/i }).click();
  1814 |             await c.page.getByLabel(/^numéro du billet/i).fill(number);
  1815 |             await c.page.getByRole('button', { name: /^vérifier le billet$/i }).click();
  1816 |             await expect(c.page.getByRole('heading', { name: new RegExp(`billet ${number}`, 'i') })).toBeVisible();
  1817 |             await expect(c.page.getByText(/^titulaire$/i)).toBeVisible();
  1818 |         },
  1819 |     },
  1820 |     {
  1821 |         id: 'scanner-guichet', titre: 'Scanner — onglet Guichet, devis servi par le serveur', role: 'controleur', needsIds: true,
  1822 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  1823 |         ready: async ({ page }) => startScanner(page),
  1824 |         actions: async ({ page }) => {
  1825 |             await openTab(page, /^guichet$/i);
  1826 |             await page.getByRole('button', { name: /^ajouter un billet standard$/i }).click();
  1827 |             await expect(page.getByRole('region', { name: /^total à encaisser$/i })).toBeVisible();
  1828 |             // Lot 8 (T23) : catégorie vendue au guichet seulement, reconnue d'un coup d'œil
  1829 |             const press = page.getByRole('list', { name: /^catégories en vente$/i }).getByRole('listitem').filter({ hasText: 'Carré presse' });
  1830 |             const mention = press.getByText('Sur place uniquement', { exact: true });
  1831 |             await expect(mention).toBeVisible();
  1832 |             expect(await fontSizePx(mention), 'taille de la mention « Sur place uniquement », en pixels').toBeGreaterThanOrEqual(14);
  1833 |             await revealCenter(mention);
  1834 |         },
  1835 |     },
  1836 |     {
  1837 |         id: 'caisse-ouverture', titre: 'Caisse — ouverture (fonds de caisse, PIN obligatoire)', role: 'controleur', needsIds: true,
  1838 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  1839 |         stubResponses: [{ url: /\/api\/controller\/shifts\/active(\?.*)?$/, method: 'GET', status: 200, body: { success: true, shift: null, expected_cash_in_drawer: null } }],
  1840 |         ready: async ({ page }) => startScanner(page),
  1841 |         actions: async ({ page }) => {
  1842 |             await openTab(page, /^caisse$/i);
  1843 |             await page.getByRole('button', { name: /^ouvrir ma caisse$/i }).click();
  1844 |             const dialog = page.getByRole('dialog', { name: /^ouvrir ma caisse$/i });
  1845 |             await expect(dialog).toBeVisible();
  1846 |             // Lot 9 bis (R42, A11, contrat 4.3 PIN_REQUIRED) : le PIN du régisseur est obligatoire à l'ouverture
  1847 |             await expect(dialog.getByLabel(/^code pin du régisseur/i), 'PIN du régisseur obligatoire à l’ouverture (R42)').toHaveAttribute('aria-required', 'true');
  1848 |             await expect(dialog.getByText(/facultatif/i), 'plus aucune mention « facultatif » du PIN (R42)').toHaveCount(0);
  1849 |         },
  1850 |     },
  1851 |     {
  1852 |         id: 'caisse-cloture-ecart', titre: 'Caisse — clôture avec écart constaté par le serveur (justification, PIN)', role: 'controleur', needsIds: true,
  1853 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  1854 |         stubResponses: [{
  1855 |             url: /\/api\/controller\/shifts\/close$/, method: 'POST', status: 400,
  1856 |             body: { success: false, code: 'JUSTIFICATION_REQUIRED', discrepancy: -2000, error: 'Écart constaté : justification et code PIN du régisseur requis.' },
  1857 |         }],
  1858 |         allowFailures: [/\/api\/controller\/shifts\/close$/],
  1859 |         ready: async ({ page }) => startScanner(page),
  1860 |         actions: async ({ page }) => {
  1861 |             await openTab(page, /^caisse$/i);
  1862 |             await page.getByRole('button', { name: /^clôturer ma caisse$/i }).click();
  1863 |             const dialog = page.getByRole('dialog', { name: /^clôturer ma caisse$/i });
  1864 |             await expect(dialog).toBeVisible();
  1865 |             // 2 000 de moins que le montant enregistré à l'écran : l'écart affiché (-2 000, réponse figée ci-dessus) tombe juste
  1866 |             const recorded = Number((await dialog.locator('dd').nth(1).innerText()).replace(/\D/g, ''));
  1867 |             await dialog.getByLabel(/^espèces encaissées comptées/i).fill(String(recorded - 2000));
  1868 |             await dialog.getByRole('button', { name: /^clôturer la caisse$/i }).click();
  1869 |             await expect(dialog.getByText(/^écart constaté$/i)).toBeVisible();
  1870 |             await expect(dialog.getByLabel(/^justification de l.écart/i)).toBeVisible();
  1871 |         },
  1872 |     },
  1873 |     {
  1874 |         id: 'caisse-ticket-z', titre: 'Caisse — Z de caisse après la clôture', role: 'controleur', needsIds: true,
  1875 |         path: () => '/controller/scanner', views: DARK_VIEWS, fakeCamera: true,
  1876 |         stubResponses: [{
  1877 |             url: /\/api\/controller\/shifts\/close$/, method: 'POST', status: 200,
  1878 |             body: {
  1879 |                 success: true,
  1880 |                 summary: {
  1881 |                     shift_id: 'b3d8d076-e4ab-4fc7-9a9d-7c8b9eafc0c6', controller_id: 'c4e9e187-f5bc-40d8-8bae-8d9caf0b1d17',
  1882 |                     controller_name: 'Ibrahima Gueye', controller_phone: '+221700000106', event_id: 'd5fae298-06cd-41e9-9cbf-9eadb01c2e28',
  1883 |                     event_title: 'Nuit du Sabar — édition d’automne', opened_at: '2026-11-04T18:30:00.000Z', closed_at: '2026-11-04T23:45:00.000Z',
  1884 |                     opening_float_amount: 10000, expected_cash_total: 23000, declared_cash_total: 21000, discrepancy_amount: -2000,
  1885 |                     discrepancy_justification: 'Monnaie rendue en trop à un spectateur, signalée au régisseur.', status: 'CLOTURE', closing_confirmed_by_pin: true,
  1886 |                 },
  1887 |             },
  1888 |         }],
  1889 |         ready: async ({ page }) => startScanner(page),
  1890 |         actions: async ({ page }) => {
  1891 |             await openTab(page, /^caisse$/i);
  1892 |             await page.getByRole('button', { name: /^clôturer ma caisse$/i }).click();
  1893 |             const dialog = page.getByRole('dialog', { name: /^clôturer ma caisse$/i });
  1894 |             await dialog.getByLabel(/^espèces encaissées comptées/i).fill('21000');
  1895 |             await dialog.getByRole('button', { name: /^clôturer la caisse$/i }).click();
  1896 |             await expect(page.getByRole('dialog', { name: /^caisse clôturée$/i })).toBeVisible();
  1897 |         },
  1898 |     },
  1899 |     // ── Lot 7 : paiement et inscription (7.3, E4) ───────────────────────────
  1900 |     {
  1901 |         id: 'paiement-modale', titre: 'Paiement — modale d’achat ouverte (opérateur, numéro)', role: 'client', needsIds: true,
  1902 |         path: (i) => `/events/${ids(i).events.ceSoir.id}`,
  1903 |         actions: async ({ page }) => {
  1904 |             await page.getByRole('button', { name: /^ajouter un billet standard/i }).click();
  1905 |             // Bouton du panneau de billetterie (« Acheter 1 billet (…) ») : à 390 px la barre d'achat fixe du bas
  1906 |             // (lg:hidden) porte aussi « Acheter (…) », même action ; /^acheter/ visait les deux (run 77, mode strict).
  1907 |             await page.getByRole('button', { name: /^acheter \d+ billets? \(/i }).click();
  1908 |             await expect(page.getByRole('dialog').or(page.getByRole('alertdialog'))).toBeVisible();
  1909 |             // Design 1b (point 7) : opérateur choisi (grand bouton Wave sélectionné)
> 1910 |             await page.getByRole('radio', { name: /^wave/i }).first().click();
       |                                                                       ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  1911 |         },
  1912 |     },
  1913 |     {
  1914 |         id: 'paiement-attente', titre: 'Paiement — en attente de validation chez l’opérateur', role: 'client', needsIds: true,
  1915 |         path: (i) => `/paiement/${ids(i).payments.pending}`,
  1916 |         ready: async ({ page }) => {
  1917 |             await expect(page.locator('#payment-status-title')).toBeVisible({ timeout: 30_000 });
  1918 |         },
  1919 |     },
  1920 |     {
  1921 |         id: 'paiement-succes', titre: 'Paiement — confirmé (billets émis, redirection annulable)', role: 'client', needsIds: true,
  1922 |         path: (i) => `/paiement/${ids(i).payments.success}`, slowTimers: { minDelayMs: 1000, factor: 100 },
  1923 |         ready: async ({ page }) => {
  1924 |             await expect(page.locator('#payment-status-title')).toHaveText(/paiement confirmé/i, { timeout: 30_000 });
  1925 |         },
  1926 |     },
  1927 |     {
  1928 |         id: 'paiement-echec', titre: 'Paiement — refusé (Réessayer le paiement)', role: 'client', needsIds: true,
  1929 |         path: (i) => `/paiement/${ids(i).payments.failed}`,
  1930 |         ready: async ({ page }) => {
  1931 |             await expect(page.locator('#payment-status-title')).toHaveText(/n.a pas abouti/i, { timeout: 30_000 });
  1932 |         },
  1933 |     },
  1934 |     {
  1935 |         id: 'inscription-code', titre: 'Inscription — étape 2 : code reçu et profil (envoi du code simulé)', role: 'anonyme', needsIds: false, path: () => '/register',
  1936 |         stubResponses: [{ url: /\/api\/auth\/register\/start$/, method: 'POST', status: 200, body: { ok: true, phone: '+221771234567', resend_after: 60 } }],
  1937 |         ready: async ({ page }) => { await expectHeading(page, /^créer un compte$/i); },
  1938 |         actions: async ({ page }) => {
  1939 |             await page.getByLabel(/^numéro de téléphone/i).fill('77 123 45 67');
  1940 |             await page.getByRole('button', { name: /^recevoir le code par sms$/i }).click();
  1941 |             await expect(page.getByText(/^code reçu par sms$/i)).toBeVisible();
  1942 |         },
  1943 |     },
  1944 |     // ── Lot 7 : pages partenaire migrées (7.4, E5 ; 7.0 f, E1) ──────────────
  1945 |     {
  1946 |         id: 'partenaire-inscription', titre: 'Inscription d’un partenaire (système de design)', role: 'anonyme', needsIds: false, path: () => '/partner/register',
  1947 |         ready: async ({ page }) => expectPageTitle(page),
  1948 |     },
  1949 |     { id: 'partenaire-tableau-de-bord', titre: 'Partenaire — tableau de bord (chiffres servis par le serveur)', role: 'organisateur', needsIds: true, path: () => '/partner/dashboard', ready: async ({ page }) => expectPageTitle(page) },
  1950 |     { id: 'partenaire-finances', titre: 'Partenaire — finances (écritures, retraits)', role: 'organisateur', needsIds: true, path: () => '/partner/finance', ready: async ({ page }) => expectPageTitle(page) },
  1951 |     { id: 'partenaire-equipe', titre: 'Partenaire — équipe (contrôleurs et affectations)', role: 'organisateur', needsIds: true, path: () => '/partner/team', ready: async ({ page }) => expectPageTitle(page) },
  1952 |     { id: 'partenaire-profil', titre: 'Partenaire — profil de l’organisateur', role: 'organisateur', needsIds: true, path: () => '/partner/profile', ready: async ({ page }) => expectPageTitle(page) },
  1953 |     { id: 'partenaire-abonnement', titre: 'Partenaire — abonnement et période d’essai', role: 'organisateur', needsIds: true, path: () => '/partner/subscription', ready: async ({ page }) => expectPageTitle(page) },
  1954 |     {
  1955 |         id: 'partenaire-premiers-pas', titre: 'Partenaire validé sans événement — première utilisation (étapes cochées par le serveur)', role: 'partenaire-premiers-pas', needsIds: true,
  1956 |         path: () => '/partner/dashboard',
  1957 |         ready: async ({ page }) => {
  1958 |             await expect(page.getByRole('heading', { name: /^publiez votre premier événement$/i })).toBeVisible({ timeout: 30_000 });
  1959 |         },
  1960 |     },
  1961 |     // ── Lot 7 : pages masquées par les interrupteurs (7.3, D55) ─────────────
  1962 |     {
  1963 |         id: 'page-masquee-salles', titre: 'Salles de fête masquées (interrupteur fermé) : page introuvable propre', role: 'anonyme', needsIds: false, path: () => '/halls',
  1964 |         expectStatus: 404, allowFailures: [/\/halls(\?.*)?$/],
  1965 |         ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
  1966 |     },
  1967 |     {
  1968 |         id: 'page-masquee-commandes', titre: 'Commandes masquées (trois interrupteurs fermés) : page introuvable propre', role: 'client', needsIds: true, path: () => '/orders',
  1969 |         expectStatus: 404, allowFailures: [/\/orders(\?.*)?$/],
  1970 |         ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
  1971 |     },
  1972 |     // ── Lot 7 : restes d'interface du lot 6 (7.0 f, E1) ─────────────────────
  1973 |     {
  1974 |         id: 'controleur-activation', titre: 'Activation d’un compte contrôleur (lien de l’invitation)', role: 'anonyme', needsIds: false,
  1975 |         path: () => '/controller/setup?phone=%2B221700000199', views: DARK_VIEWS,
  1976 |         ready: async ({ page }) => { await expectHeading(page, /^activer votre compte contrôleur$/i); },
  1977 |     },
  1978 |     {
  1979 |         id: 'controleur-profil', titre: 'Profil du contrôleur (événements assignés, mot de passe)', role: 'controleur', needsIds: true, path: () => '/controller/profile', views: DARK_VIEWS,
  1980 |         ready: async ({ page }) => { await expectHeading(page, /^mon profil$/i); },
  1981 |     },
  1982 |     {
  1983 |         // Finition 1 (complément 13) : historique des soirées du contrôleur, depuis son profil (réponse imposée : trois
  1984 |         // soirées types, caisse clôturée, écart en attente, événement annulé sans caisse)
  1985 |         id: 'controleur-soirees', titre: 'Mes soirées du contrôleur (entrées et caisse, lecture seule)', role: 'controleur', needsIds: true,
  1986 |         path: () => '/profile/soirees',
  1987 |         stubResponses: [{
  1988 |             url: /\/api\/account\/evenings(\?|$)/, method: 'GET', status: 200, body: { items: [
  1989 |                 { event_id: '00000000-0000-4000-8000-0000000000a1', title: 'Nuit du Sabar — édition d’automne', status: 'TERMINE', start_at: '2026-11-07T20:00:00.000Z',
  1990 |                   organizer: 'Teranga Events', gate: 'Porte VIP', zone: 'Carré VIP', entry_point: null, entries: 214,
  1991 |                   cash: { collected: 36000, gap: 0, state: 'CLOSED' } },
  1992 |                 { event_id: '00000000-0000-4000-8000-0000000000a2', title: 'Gala de la Teranga', status: 'TERMINE', start_at: '2026-10-24T19:30:00.000Z',
  1993 |                   organizer: 'Teranga Events', gate: null, zone: null, entry_point: 'Entrée principale', entries: 87,
  1994 |                   cash: { collected: 12000, gap: -2000, state: 'GAP_PENDING' } },
  1995 |                 { event_id: '00000000-0000-4000-8000-0000000000a3', title: 'Festival du Fleuve', status: 'ANNULE', start_at: '2026-10-10T18:00:00.000Z',
  1996 |                   organizer: 'Saint-Louis Live', gate: null, zone: null, entry_point: null, entries: 0, cash: null },
  1997 |             ] },
  1998 |         }],
  1999 |         ready: async ({ page }) => { await expectHeading(page, /^mes soirées$/i); },
  2000 |     },
  2001 |     {
  2002 |         id: 'admin-campagnes', titre: 'Administration — campagnes de communication', role: 'admin', needsIds: true, path: () => '/admin/communications',
  2003 |         ready: async ({ page }) => { await expectHeading(page, /^campagnes de communication$/i); },
  2004 |     },
  2005 |     {
  2006 |         id: 'aide-transfert', titre: 'Mes billets — aide « Comment marche le transfert ? »', role: 'client', needsIds: true, path: () => '/tickets',
  2007 |         actions: async ({ page }) => {
  2008 |             await page.getByRole('button', { name: /^comment marche le transfert/i }).click();
  2009 |             await expect(page.getByRole('dialog')).toBeVisible();
  2010 |         },
```