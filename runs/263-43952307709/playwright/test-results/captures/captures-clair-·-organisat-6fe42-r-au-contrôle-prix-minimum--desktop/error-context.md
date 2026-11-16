# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · organisateur >> partenaire-creation-billets — Création d’un événement — étape 4, Billets (couleur au contrôle, prix minimum)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('navigation', { name: /^étapes du formulaire$/i }).getByRole('button', { name: /billets/i })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - link "Event Village, accueil" [ref=e5] [cursor=pointer]:
        - /url: /
        - generic [ref=e11]:
          - generic [ref=e12]: EVENT
          - generic [ref=e13]: VILLAGE
      - navigation "Navigation principale" [ref=e14]:
        - generic [ref=e15]:
          - paragraph [ref=e16]: Gestion
          - generic [ref=e17]:
            - link "Tableau de bord" [ref=e18] [cursor=pointer]:
              - /url: /partner/dashboard
            - link "Événements" [ref=e25] [cursor=pointer]:
              - /url: /partner/events
            - link "Équipe" [ref=e29] [cursor=pointer]:
              - /url: /partner/team
        - generic [ref=e36]:
          - paragraph [ref=e37]: Outils
          - generic [ref=e38]:
            - link "Finances" [ref=e39] [cursor=pointer]:
              - /url: /partner/finance
            - link "Statistiques" [ref=e43] [cursor=pointer]:
              - /url: /partner/stats
            - link "Scanner les billets" [ref=e47] [cursor=pointer]:
              - /url: /partner/scan
            - link "Calendrier" [ref=e55] [cursor=pointer]:
              - /url: /partner/calendar
            - link "Abonnement" [ref=e59] [cursor=pointer]:
              - /url: /partner/subscription
            - link "Profil partenaire" [ref=e64] [cursor=pointer]:
              - /url: /partner/profile
        - link "Retour au site" [ref=e70] [cursor=pointer]:
          - /url: /
      - generic [ref=e76]:
        - link "Mariama Ndiaye Partenaire" [ref=e77] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e78]: MN
          - generic [ref=e79]:
            - generic [ref=e80]: Mariama Ndiaye
            - generic [ref=e81]: Partenaire
        - generic [ref=e82]:
          - button "Se déconnecter" [ref=e83] [cursor=pointer]
          - button "Basculer le thème" [ref=e88] [cursor=pointer]
    - generic [ref=e92]:
      - banner [ref=e93]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e95] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 99+ non lues" [ref=e102] [cursor=pointer]:
          - generic [ref=e106]: 99+
      - main [ref=e107]:
        - generic [ref=e109]:
          - generic [ref=e110]:
            - link "Retour à mes événements" [ref=e112] [cursor=pointer]:
              - /url: /partner/events
            - generic [ref=e118]:
              - heading "Créer un événement" [level=1] [ref=e119]
              - paragraph [ref=e120]: L’événement est enregistré en brouillon. À la dernière étape, vérifiez-le puis envoyez-le pour validation (ou plus tard, depuis la liste de vos événements).
          - navigation "Étapes du formulaire" [ref=e121]:
            - paragraph [ref=e122]: "Étape 1 sur 5 : Informations générales"
            - list [ref=e123]:
              - listitem [ref=e124]:
                - button "Informations générales" [ref=e125] [cursor=pointer]:
                  - generic [aria-hidden] [ref=e126]: "1"
                  - generic [aria-hidden] [ref=e127]: Informations
              - listitem [ref=e129]:
                - button "Programme" [ref=e130] [cursor=pointer]:
                  - generic [aria-hidden] [ref=e131]: "2"
                  - generic [aria-hidden] [ref=e132]: Programme
              - listitem [ref=e134]:
                - button "Accès et informations pratiques" [ref=e135] [cursor=pointer]:
                  - generic [aria-hidden] [ref=e136]: "3"
                  - generic [aria-hidden] [ref=e137]: Accès
              - listitem [ref=e139]:
                - button "Billetterie" [ref=e140] [cursor=pointer]:
                  - generic [aria-hidden] [ref=e141]: "4"
                  - generic [aria-hidden] [ref=e142]: Billets
              - listitem [ref=e144]:
                - button "Contrôle à l’entrée (facultatif)" [ref=e145] [cursor=pointer]:
                  - generic [aria-hidden] [ref=e146]: "5"
                  - generic [aria-hidden] [ref=e147]: Contrôle
              - listitem [ref=e149]:
                - button "Vérifier avant d’envoyer" [ref=e150] [cursor=pointer]:
                  - generic [aria-hidden] [ref=e154]: Vérifier
          - generic [ref=e156]:
            - heading "Informations générales" [level=2] [ref=e157]
            - generic [ref=e158]:
              - generic [ref=e159]:
                - generic [ref=e161]:
                  - text: Titre de l’événement*
                  - generic [ref=e162]: (obligatoire)
                - textbox "Titre de l’événement (obligatoire)" [ref=e163]:
                  - /placeholder: "Par exemple : Nuit du Mbalax"
              - generic [ref=e164]:
                - generic [ref=e165]:
                  - text: Type d’événement*
                  - generic [ref=e166]: (obligatoire)
                - radiogroup "Type d’événement (obligatoire)" [ref=e167]:
                  - radio "Concerts & Musique" [ref=e168] [cursor=pointer]
                  - radio "Festivals" [ref=e170] [cursor=pointer]
                  - radio "Gastronomie & Tables" [ref=e172] [cursor=pointer]
                  - radio "Salles & Réceptions" [ref=e174] [cursor=pointer]
              - generic [ref=e176]:
                - generic [ref=e177]:
                  - generic [ref=e178]: Description
                  - generic [ref=e179]: 0 / 5000
                - textbox "Description" [ref=e180]:
                  - /placeholder: "Présentez l’événement : artistes, ambiance, public attendu…"
              - generic [ref=e181]:
                - generic [ref=e182]: Affiche de l’événement
                - button "Affiche de l’événement" [ref=e183]
                - generic [ref=e184] [cursor=pointer]: Choisir une image ou la déposer ici
                - paragraph [ref=e191]: "Format conseillé : paysage, 1 600 × 1 000 pixels (proportion des cartes du site), recadré au centre. JPEG, PNG ou WebP, 5 Mo au plus. Obligatoire pour soumettre l’événement à la validation."
              - group "Dates et horaires (heure de Dakar)" [ref=e192]:
                - generic [ref=e194]:
                  - generic [ref=e195]:
                    - generic [ref=e197]:
                      - text: Date de début*
                      - generic [ref=e198]: (obligatoire)
                    - textbox "Date de début (obligatoire)" [ref=e199]
                  - generic [ref=e200]:
                    - generic [ref=e202]:
                      - text: Heure de début*
                      - generic [ref=e203]: (obligatoire)
                    - textbox "Heure de début (obligatoire)" [ref=e204]
                  - generic [ref=e205]:
                    - generic [ref=e206]: Date de fin
                    - textbox "Date de fin" [ref=e208]
                    - paragraph [ref=e209]: Facultative. Pour une soirée qui passe minuit, indiquez la date du lendemain.
                  - generic [ref=e210]:
                    - generic [ref=e211]: Heure de fin
                    - textbox "Heure de fin" [ref=e213]
                    - paragraph [ref=e214]: Facultative ; avec une heure de fin, la date de fin est demandée.
              - generic [ref=e215]:
                - generic [ref=e216]:
                  - generic [ref=e218]:
                    - text: Lieu*
                    - generic [ref=e219]: (obligatoire)
                  - textbox "Lieu (obligatoire)" [ref=e220]:
                    - /placeholder: "Par exemple : Grand Théâtre National"
                - generic [ref=e221]:
                  - generic [ref=e223]:
                    - text: Ville*
                    - generic [ref=e224]: (obligatoire)
                  - combobox "Ville (obligatoire)" [ref=e226] [cursor=pointer]:
                    - option "Cap Skirring"
                    - option "Dakar" [selected]
                    - option "Diamniadio"
                    - option "Diourbel"
                    - option "Fatick"
                    - option "Guédiawaye"
                    - option "Joal-Fadiouth"
                    - option "Kaffrine"
                    - option "Kaolack"
                    - option "Kédougou"
                    - option "Kolda"
                    - option "Louga"
                    - option "Matam"
                    - option "Mbacké"
                    - option "Mbour"
                    - option "Pikine"
                    - option "Richard-Toll"
                    - option "Rufisque"
                    - option "Saint-Louis"
                    - option "Saly"
                    - option "Sédhiou"
                    - option "Tambacounda"
                    - option "Thiès"
                    - option "Tivaouane"
                    - option "Touba"
                    - option "Ziguinchor"
                    - option "Autre ville"
              - generic [ref=e227]:
                - generic [ref=e228]: Capacité totale (jauge)
                - spinbutton "Capacité totale (jauge)" [ref=e230]
                - paragraph [ref=e231]: Facultative. La somme des quantités des catégories actives ne peut pas la dépasser.
            - generic [ref=e232]:
              - button "Précédent" [disabled] [ref=e233]
              - button "Suivant" [ref=e239] [cursor=pointer]
  - alert [ref=e244]
```

# Test source

```ts
  921  |             const counters = await fakePushCounters(page);
  922  |             expect(counters.requestPermissionCalls, 'une seule demande d’autorisation, au clic').toBe(1);
  923  |             expect(counters.subscribeCalls, 'un seul abonnement').toBe(1);
  924  |         },
  925  |     },
  926  |     {
  927  |         id: 'preferences-push-refuse', titre: 'Préférences de notification — push refusé dans le navigateur', role: 'client', needsIds: true,
  928  |         path: () => '/profile/notifications', fakePush: 'denied',
  929  |         ready: async ({ page }) => {
  930  |             await preferencesReady(page, /^refusées dans le navigateur$/i);
  931  |             await expect(page.getByRole('button', { name: /^activer les notifications$/i })).toHaveCount(0);
  932  |             await expectNoPermissionPrompt(page);
  933  |         },
  934  |     },
  935  |     {
  936  |         id: 'preferences-push-non-pris-en-charge', titre: 'Préférences de notification — push non pris en charge par le navigateur', role: 'client', needsIds: true,
  937  |         path: () => '/profile/notifications', fakePush: 'unsupported',
  938  |         ready: async ({ page }) => {
  939  |             await preferencesReady(page, /^non prises en charge par ce navigateur$/i);
  940  |             await expect(page.getByRole('button', { name: /^activer les notifications$/i })).toHaveCount(0);
  941  |         },
  942  |     },
  943  |     {
  944  |         id: 'cloche-ouverte', titre: 'Cloche ouverte (non lues d’abord, Tout marquer comme lu)', role: 'client', needsIds: true, path: () => '/tickets',
  945  |         actions: async ({ page }) => {
  946  |             await page.getByRole('button', { name: /^notifications/i }).filter({ visible: true }).first().click();
  947  |             const panel = page.getByRole('region', { name: /^notifications$/i });
  948  |             await expect(panel).toBeVisible();
  949  |             await expect(panel.getByRole('listitem').first()).toBeVisible();
  950  |         },
  951  |     },
  952  |     {
  953  |         id: 'notifications-vide', titre: 'Notifications du client — aucune notification', role: 'client', needsIds: true, path: () => '/notifications',
  954  |         stubResponse: { url: /\/api\/notifications(\?|$)/, status: 200, body: { notifications: [], unreadCount: 0, total: 0, page: 1, pageSize: 20 } },
  955  |         ready: async ({ page }) => { await expect(page.getByText('Aucune notification', { exact: true })).toBeVisible(); },
  956  |     },
  957  |     { id: 'notifications', titre: 'Notifications du client', role: 'client', needsIds: true, path: () => '/notifications' },
  958  |     {
  959  |         id: 'notifications-erreur', titre: 'Notifications du client — état d’erreur', role: 'client', needsIds: true, path: () => '/notifications',
  960  |         injectError: /\/api\/notifications(\?|$)/, ready: expectRetry,
  961  |     },
  962  |     // ── Organisateur ────────────────────────────────────────────────────────
  963  |     { id: 'partenaire-evenements', titre: 'Liste des événements de l’organisateur', role: 'organisateur', needsIds: true, path: () => '/partner/events' },
  964  |     {
  965  |         id: 'partenaire-evenements-annules', titre: 'Liste de l’organisateur — onglet Annulé', role: 'organisateur', needsIds: true, path: () => '/partner/events',
  966  |         actions: async ({ page }) => openTab(page, /^annulé/i),
  967  |     },
  968  |     {
  969  |         id: 'partenaire-evenements-erreur', titre: 'Liste de l’organisateur — état d’erreur', role: 'organisateur', needsIds: true, path: () => '/partner/events',
  970  |         injectError: /\/api\/partner\/events(\/overview)?(\?.*)?$/, ready: expectRetry,
  971  |     },
  972  |     { id: 'partenaire-creation', titre: 'Création d’un événement (formulaire partagé)', role: 'organisateur', needsIds: true, path: () => '/partner/events/new' },
  973  |     // Finition 2a : étape Accès du formulaire (carte du lieu, recherche), captures avant et après
  974  |     {
  975  |         id: 'partenaire-creation-acces', titre: 'Création d’un événement — étape Accès (carte du lieu)', role: 'organisateur', needsIds: true,
  976  |         path: () => '/partner/events/new',
  977  |         actions: async ({ page }) => {
  978  |             await page.getByRole('navigation', { name: /^étapes du formulaire$/i }).getByRole('button', { name: /accès/i }).click();
  979  |             await expect(page.getByRole('heading', { name: /^accès et informations pratiques$/i })).toBeVisible();
  980  |         },
  981  |     },
  982  |     // Finition 2a (captures « après » seulement) : la même étape descendue jusqu'à la recherche et à la carte (aucun repère
  983  |     // avant un choix) ; l'étape Informations avec un début à 22:00 sans fin (« Fin retenue : … à 04:00 » et son aide)
  984  |     {
  985  |         id: 'partenaire-creation-carte', titre: 'Création d’un événement — recherche de lieu et carte sans repère', role: 'organisateur', needsIds: true,
  986  |         path: () => '/partner/events/new',
  987  |         actions: async ({ page }) => {
  988  |             await page.getByRole('navigation', { name: /^étapes du formulaire$/i }).getByRole('button', { name: /accès/i }).click();
  989  |             const search = page.getByRole('search', { name: 'Rechercher un lieu' });
  990  |             await expect(search).toBeVisible();
  991  |             await expect(page.getByRole('region', { name: 'Carte du lieu' })).toBeVisible();
  992  |             await search.evaluate((el) => {
  993  |                 el.scrollIntoView({ block: 'start' });
  994  |                 window.scrollBy(0, -96);
  995  |             });
  996  |         },
  997  |     },
  998  |     {
  999  |         id: 'partenaire-creation-fin-retenue', titre: 'Création d’un événement — fin retenue sans heure de fin', role: 'organisateur', needsIds: true,
  1000 |         path: () => '/partner/events/new',
  1001 |         actions: async ({ page }) => {
  1002 |             const day = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  1003 |             await page.getByLabel(/^date de début/i).fill(day);
  1004 |             await page.getByLabel(/^heure de début/i).fill('22:00');
  1005 |             const retained = page.getByText(/^Fin retenue : /);
  1006 |             await expect(retained).toBeVisible();
  1007 |             await retained.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  1008 |         },
  1009 |     },
  1010 |     // Finition 2b : les cinq étapes de la création (Informations : partenaire-creation ; Accès : partenaire-creation-acces),
  1011 |     // l'écran « Vérifier avant d'envoyer » (formulaire vide : liste de ce qui manque) et la fenêtre « Prévenir »
  1012 |     ...([
  1013 |         ['partenaire-creation-programme', 'Création d’un événement — étape 2, Programme', /programme/i, /^programme$/i],
  1014 |         ['partenaire-creation-billets', 'Création d’un événement — étape 4, Billets (couleur au contrôle, prix minimum)', /billets/i, /^billetterie$/i],
  1015 |         ['partenaire-creation-controle', 'Création d’un événement — étape 5, Contrôle à l’entrée (facultatif)', /contrôle/i, /^contrôle à l’entrée \(facultatif\)$/i],
  1016 |         ['partenaire-creation-verifier', 'Création d’un événement — Vérifier avant d’envoyer (ce qui manque)', /vérifier/i, /^vérifier avant d’envoyer$/i],
  1017 |     ] as const).map(([id, titre, stepButton, heading]): Screen => ({
  1018 |         id, titre, role: 'organisateur', needsIds: true,
  1019 |         path: () => '/partner/events/new',
  1020 |         actions: async ({ page }) => {
> 1021 |             await page.getByRole('navigation', { name: /^étapes du formulaire$/i }).getByRole('button', { name: stepButton }).click();
       |                                                                                                                               ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  1022 |             await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  1023 |         },
  1024 |     })),
  1025 |     {
  1026 |         id: 'partenaire-edition', titre: 'Édition d’un événement publié avec ventes (champs verrouillés)', role: 'organisateur', needsIds: true,
  1027 |         path: (i) => `/partner/events/${ids(i).events.publie.id}/edit`,
  1028 |     },
  1029 |     // Finition 2b (D, E-27) : lieu changé, « Enregistrer les modifications » : fenêtre « Prévenir » (jamais confirmée :
  1030 |     // rien n'est enregistré)
  1031 |     {
  1032 |         id: 'partenaire-edition-prevenir', titre: 'Modifier un événement publié — fenêtre « Prévenir les détenteurs de billets »', role: 'organisateur', needsIds: true,
  1033 |         path: (i) => `/partner/events/${ids(i).events.publie.id}/edit`,
  1034 |         actions: async ({ page }) => {
  1035 |             const place = page.locator('#ev-location');
  1036 |             await expect(place, 'champ « Lieu »').toBeVisible({ timeout: 30_000 });
  1037 |             await place.fill(`${await place.inputValue()} — salle B`);
  1038 |             await page.getByRole('button', { name: /^enregistrer les modifications$/i }).click();
  1039 |             const dialog = page.getByRole('alertdialog', { name: /^prévenir les détenteurs de billets$/i });
  1040 |             await expect(dialog, 'fenêtre « Prévenir »').toBeVisible({ timeout: 30_000 });
  1041 |             await expect(dialog.getByText(/(seront prévenus|sera prévenu) par SMS (à \d{2}:\d{2}|tout de suite)\./)).toBeVisible();
  1042 |             await expect(dialog.getByRole('button', { name: /^enregistrer et prévenir$/i })).toBeVisible();
  1043 |         },
  1044 |     },
  1045 |     {
  1046 |         id: 'partenaire-categorie-canaux', titre: 'Catégorie « Carré presse » : deux canaux, sur place uniquement', role: 'organisateur', needsIds: true,
  1047 |         path: (i) => `/partner/events/${ids(i).events.ceSoir.id}/edit`,
  1048 |         actions: async ({ page }) => {
  1049 |             await openTicketingStep(page);
  1050 |             const card = categorySections(page).filter({ has: page.getByRole('heading', { name: 'Carré presse', exact: true }) });
  1051 |             await expect(card.getByRole('checkbox', { name: ONLINE_BOX })).not.toBeChecked();
  1052 |             await expect(card.getByRole('checkbox', { name: COUNTER_BOX })).toBeChecked();
  1053 |             await expect(card.getByText('Sur place uniquement').first()).toBeVisible();
  1054 |             await revealCenter(card.getByRole('checkbox', { name: ONLINE_BOX }));
  1055 |         },
  1056 |     },
  1057 |     {
  1058 |         id: 'partenaire-categorie-invitations', titre: 'Catégorie sans aucun canal : aide factuelle, aucune distribution', role: 'organisateur', needsIds: true,
  1059 |         path: (i) => `/partner/events/${ids(i).events.ceSoir.id}/edit`,
  1060 |         actions: async ({ page }) => {
  1061 |             await openTicketingStep(page);
  1062 |             // Ligne ajoutée au seed par fix(8.0-seed) (L80) : son nom n'est pas fixé par le contrat, seul son résumé l'est
  1063 |             const card = categorySections(page).filter({ hasText: 'Invitations seulement' });
  1064 |             await expect(card.getByRole('checkbox', { name: ONLINE_BOX })).not.toBeChecked();
  1065 |             await expect(card.getByRole('checkbox', { name: COUNTER_BOX })).not.toBeChecked();
  1066 |             await expect(card.getByText('Cette catégorie n’est vendue ni en ligne ni au guichet. Distribuez ses billets depuis l’onglet Invitations du pilotage.')).toBeVisible();
  1067 |             await revealCenter(card.getByRole('checkbox', { name: ONLINE_BOX }));
  1068 |         },
  1069 |     },
  1070 |     {
  1071 |         id: 'partenaire-rapport-cloture', titre: 'Rapport de clôture d’un événement terminé (modale du tableau de bord)', role: 'organisateur', needsIds: true,
  1072 |         path: () => '/partner/dashboard', references: [/^CLOTURE-[0-9A-F]{8}-\d{8}$/],
  1073 |         actions: async (c) => {
  1074 |             const { title } = ids(c.ids).events.termine;
  1075 |             const button = c.page.locator('tr, li, article')
  1076 |                 .filter({ hasText: title })
  1077 |                 .getByRole('button', { name: /^clôture$/i })
  1078 |                 .filter({ visible: true })
  1079 |                 .first();
  1080 |             const loaded = c.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/partner/reports/closing');
  1081 |             await button.click();
  1082 |             const report = await loaded;
  1083 |             expect(report.status(), `rapport de clôture de « ${title} »`).toBe(200);
  1084 |             const dialog = c.page.getByRole('dialog', { name: /^rapport de clôture$/i });
  1085 |             await expect(dialog).toBeVisible();
  1086 |             await expect(dialog.getByText(title).first()).toBeVisible();
  1087 |             await expect(dialog.getByText(/^généré le/i)).toBeVisible();
  1088 |             await expect(dialog.getByText('Entrées (dont guichet)', { exact: true }).filter({ visible: true }).first(), 'un seul rapport (lot 9 ter, R106 b)').toBeVisible();
  1089 |             await expect(dialog.getByRole('button', { name: /^télécharger le pdf$/i })).toBeVisible();
  1090 |             await c.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  1091 |         },
  1092 |     },
  1093 |     tabScreen('pilotage-apercu', 'Pilotage — Aperçu', /^aperçu/i),
  1094 |     tabScreen('pilotage-ventes', 'Pilotage — Ventes', /^ventes/i),
  1095 |     {
  1096 |         id: 'pilotage-rembourser-billet', titre: 'Pilotage — Ventes : fiche d’un billet à rembourser', role: 'organisateur', needsIds: true, path: pilotage('ceSoir'),
  1097 |         actions: async (c) => {
  1098 |             const { number } = ids(c.ids).tickets.manualLookup;
  1099 |             await openTab(c.page, /^ventes/i);
  1100 |             await c.page.getByLabel(/^numéro du billet/i).fill(number);
  1101 |             const found = c.page.waitForResponse((r) => new URL(r.url()).pathname.endsWith('/tickets/lookup'));
  1102 |             await c.page.getByRole('button', { name: /^rechercher le billet$/i }).click();
  1103 |             expect((await found).status(), `recherche du billet ${number}`).toBe(200);
  1104 |             const refund = c.page.getByRole('button', { name: /^rembourser ce billet$/i });
  1105 |             await expect(refund).toBeVisible();
  1106 |             await expect(c.page.getByRole('button', { name: /^annuler ce billet gratuit$/i }), 'billet payant : jamais l’action du billet gratuit').toHaveCount(0);
  1107 |             // Le motif se quitte sans rien envoyer : capture de la fiche, pas d'un remboursement
  1108 |             await refund.click();
  1109 |             const reason = c.page.getByRole('dialog', { name: /^motif du remboursement$/i });
  1110 |             await reason.getByRole('button', { name: /^revenir à la fiche$/i }).click();
  1111 |             await expect(reason).toBeHidden();
  1112 |             await revealCenter(refund);
  1113 |         },
  1114 |     },
  1115 |     tabScreen('pilotage-entrees', 'Pilotage — Entrées en direct', /^entrées/i),
  1116 |     tabScreen('pilotage-equipe', 'Pilotage — Équipe', /^équipe/i),
  1117 |     tabScreen('pilotage-caisse', 'Pilotage — Caisse', /^caisse/i),
  1118 |     tabScreen('pilotage-cloture', 'Pilotage — Clôture et export', /^clôture/i),
  1119 |     {
  1120 |         id: 'pilotage-annulation', titre: 'Modale « Annuler l’événement » (impact, titre à retaper)', role: 'organisateur', needsIds: true, path: pilotage('publie'),
  1121 |         actions: async ({ page }) => {
```