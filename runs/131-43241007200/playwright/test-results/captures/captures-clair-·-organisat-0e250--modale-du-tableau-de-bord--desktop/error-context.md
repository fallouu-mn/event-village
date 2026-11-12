# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · organisateur >> partenaire-rapport-cloture — Rapport de clôture d’un événement terminé (modale du tableau de bord)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: un seul rapport (lot 9 ter, R106 b)

expect(locator).toBeVisible() failed

Locator: getByRole('dialog', { name: /^rapport de clôture$/i }).getByText('Entrées (dont guichet)', { exact: true }).visible().first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - un seul rapport (lot 9 ter, R106 b) getByRole('dialog', { name: /^rapport de clôture$/i }).getByText('Entrées (dont guichet)', { exact: true }).visible().first() with timeout 15000ms
  - waiting for getByRole('dialog', { name: /^rapport de clôture$/i }).getByText('Entrées (dont guichet)', { exact: true }).visible().first()

```

```yaml
- complementary:
  - link "Event Village, accueil":
    - /url: /
    - text: EVENT VILLAGE
  - navigation "Navigation principale":
    - paragraph: Gestion
    - link "Tableau de bord":
      - /url: /partner/dashboard
      - img
      - text: Tableau de bord
    - link "Événements":
      - /url: /partner/events
      - img
      - text: Événements
    - link "Équipe":
      - /url: /partner/team
      - img
      - text: Équipe
    - paragraph: Outils
    - link "Finances":
      - /url: /partner/finance
      - img
      - text: Finances
    - link "Statistiques":
      - /url: /partner/stats
      - img
      - text: Statistiques
    - link "Scanner les billets":
      - /url: /partner/scan
      - img
      - text: Scanner les billets
    - link "Calendrier":
      - /url: /partner/calendar
      - img
      - text: Calendrier
    - link "Abonnement":
      - /url: /partner/subscription
      - img
      - text: Abonnement
    - link "Profil partenaire":
      - /url: /partner/profile
      - img
      - text: Profil partenaire
    - link "Retour au site":
      - /url: /
      - img
      - text: Retour au site
  - link "Mariama Ndiaye Partenaire":
    - /url: /profile
  - button "Se déconnecter"
  - button "Basculer le thème"
- banner:
  - link "Rechercher un événement, un concert, un restaurant…":
    - /url: /explore
  - button "Notifications, 99+ non lues": 99+
- main:
  - text: Espace partenaire
  - heading "Baobab Scène" [level=1]
  - paragraph: Ventes, entrées et solde de vos événements.
  - button "Actualiser"
  - link "Export comptable":
    - /url: /api/partner/reports/accounting?format=csv
  - link "Scanner des billets":
    - /url: /partner/scan
  - status:
    - paragraph: Période d’essai gratuite en cours
    - text: 150 jours offerts, jusqu’au
    - time: lun. 11 janv. 2027
    - text: .
  - region "Indicateurs":
    - heading "Indicateurs" [level=2]
    - paragraph: Ventes en ligne
    - paragraph: 978 000 F CFA
    - paragraph: Prix des billets vendus en ligne, tous événements.
    - paragraph: Net partenaire
    - paragraph: 828 000 F CFA
    - paragraph: Après 150 000 F CFA de remboursements.
    - paragraph: Billets vendus
    - paragraph: "133"
    - paragraph: 71 entrées validées aux portes.
    - paragraph: Disponible au retrait
    - paragraph: 0 F CFA
    - paragraph: "Déjà versé : 0 F CFA."
    - paragraph:
      - text: Les ventes en espèces au guichet (138 000 F CFA) et les invitations n’alimentent pas le solde.
      - link "Voir mes finances":
        - /url: /partner/finance
  - region "Mes événements":
    - heading "Mes événements" [level=2]
    - text: 8 au total
    - link "Tous mes événements":
      - /url: /partner/events
    - table "Ventes, entrées et rapports par événement":
      - caption: Ventes, entrées et rapports par événement
      - rowgroup:
        - row "Événement Date et lieu Vendus / capacité Entrées Ventes en ligne Net partenaire Rapports":
          - columnheader "Événement"
          - columnheader "Date et lieu"
          - columnheader "Vendus / capacité"
          - columnheader "Entrées"
          - columnheader "Ventes en ligne"
          - columnheader "Net partenaire"
          - columnheader "Rapports"
      - rowgroup:
        - row "Concert acoustique au jardin Brouillon mar. 22 déc. 2026 à 19:00 Dakar 0 / 100 0 % rempli 0 0 % des vendus 0 F CFA 0 F CFA Clôture Télécharger le rapport PDF de Concert acoustique au jardin Exporter les ventes de Concert acoustique au jardin en CSV":
          - cell "Concert acoustique au jardin Brouillon"
          - cell "mar. 22 déc. 2026 à 19:00 Dakar":
            - time: mar. 22 déc. 2026 à 19:00
            - text: Dakar
          - cell "0 / 100 0 % rempli"
          - cell "0 0 % des vendus"
          - cell "0 F CFA"
          - cell "0 F CFA"
          - cell "Clôture Télécharger le rapport PDF de Concert acoustique au jardin Exporter les ventes de Concert acoustique au jardin en CSV":
            - button "Clôture"
            - button "Télécharger le rapport PDF de Concert acoustique au jardin"
            - button "Exporter les ventes de Concert acoustique au jardin en CSV"
        - row "Matinée gospel et chorales En attente de validation dim. 6 déc. 2026 à 10:00 Dakar 0 / 300 0 % rempli 0 0 % des vendus 0 F CFA 0 F CFA Clôture Télécharger le rapport PDF de Matinée gospel et chorales Exporter les ventes de Matinée gospel et chorales en CSV":
          - cell "Matinée gospel et chorales En attente de validation"
          - cell "dim. 6 déc. 2026 à 10:00 Dakar":
            - time: dim. 6 déc. 2026 à 10:00
            - text: Dakar
          - cell "0 / 300 0 % rempli"
          - cell "0 0 % des vendus"
          - cell "0 F CFA"
          - cell "0 F CFA"
          - cell "Clôture Télécharger le rapport PDF de Matinée gospel et chorales Exporter les ventes de Matinée gospel et chorales en CSV":
            - button "Clôture"
            - button "Télécharger le rapport PDF de Matinée gospel et chorales"
            - button "Exporter les ventes de Matinée gospel et chorales en CSV"
        - row "Soirée Kora & Lumières Publié dim. 29 nov. 2026 à 20:30 Dakar 5 / 150 3 % rempli 0 0 % des vendus 42 000 F CFA 42 000 F CFA Clôture Télécharger le rapport PDF de Soirée Kora & Lumières Exporter les ventes de Soirée Kora & Lumières en CSV":
          - cell "Soirée Kora & Lumières Publié"
          - cell "dim. 29 nov. 2026 à 20:30 Dakar":
            - time: dim. 29 nov. 2026 à 20:30
            - text: Dakar
          - cell "5 / 150 3 % rempli"
          - cell "0 0 % des vendus"
          - cell "42 000 F CFA"
          - cell "42 000 F CFA"
          - cell "Clôture Télécharger le rapport PDF de Soirée Kora & Lumières Exporter les ventes de Soirée Kora & Lumières en CSV":
            - button "Clôture"
            - button "Télécharger le rapport PDF de Soirée Kora & Lumières"
            - button "Exporter les ventes de Soirée Kora & Lumières en CSV"
        - row "Festival Jazz sur le Fleuve Publié mar. 24 nov. 2026 à 18:00 Saint-Louis 22 / 400 6 % rempli 0 0 % des vendus 201 000 F CFA 201 000 F CFA Clôture Télécharger le rapport PDF de Festival Jazz sur le Fleuve Exporter les ventes de Festival Jazz sur le Fleuve en CSV":
          - cell "Festival Jazz sur le Fleuve Publié"
          - cell "mar. 24 nov. 2026 à 18:00 Saint-Louis":
            - time: mar. 24 nov. 2026 à 18:00
            - text: Saint-Louis
          - cell "22 / 400 6 % rempli"
          - cell "0 0 % des vendus"
          - cell "201 000 F CFA"
          - cell "201 000 F CFA"
          - cell "Clôture Télécharger le rapport PDF de Festival Jazz sur le Fleuve Exporter les ventes de Festival Jazz sur le Fleuve en CSV":
            - button "Clôture"
            - button "Télécharger le rapport PDF de Festival Jazz sur le Fleuve"
            - button "Exporter les ventes de Festival Jazz sur le Fleuve en CSV"
        - row "Concert des Lumières de Gorée Publié ven. 13 nov. 2026 à 11:30 Gorée 11 / 250 4 % rempli 0 0 % des vendus 84 000 F CFA 84 000 F CFA Clôture Télécharger le rapport PDF de Concert des Lumières de Gorée Exporter les ventes de Concert des Lumières de Gorée en CSV":
          - cell "Concert des Lumières de Gorée Publié"
          - cell "ven. 13 nov. 2026 à 11:30 Gorée":
            - time: ven. 13 nov. 2026 à 11:30
            - text: Gorée
          - cell "11 / 250 4 % rempli"
          - cell "0 0 % des vendus"
          - cell "84 000 F CFA"
          - cell "84 000 F CFA"
          - cell "Clôture Télécharger le rapport PDF de Concert des Lumières de Gorée Exporter les ventes de Concert des Lumières de Gorée en CSV":
            - button "Clôture"
            - button "Télécharger le rapport PDF de Concert des Lumières de Gorée"
            - button "Exporter les ventes de Concert des Lumières de Gorée en CSV"
        - row "Croisière musicale vers Gorée Annulé jeu. 12 nov. 2026 à 19:30 Dakar 2 / 120 2 % rempli 2 100 % des vendus 150 000 F CFA 0 F CFA Clôture Télécharger le rapport PDF de Croisière musicale vers Gorée Exporter les ventes de Croisière musicale vers Gorée en CSV":
          - cell "Croisière musicale vers Gorée Annulé"
          - cell "jeu. 12 nov. 2026 à 19:30 Dakar":
            - time: jeu. 12 nov. 2026 à 19:30
            - text: Dakar
          - cell "2 / 120 2 % rempli"
          - cell "2 100 % des vendus"
          - cell "150 000 F CFA"
          - cell "0 F CFA"
          - cell "Clôture Télécharger le rapport PDF de Croisière musicale vers Gorée Exporter les ventes de Croisière musicale vers Gorée en CSV":
            - button "Clôture"
            - button "Télécharger le rapport PDF de Croisière musicale vers Gorée"
            - button "Exporter les ventes de Croisière musicale vers Gorée en CSV"
        - row "Nuit du Sabar — édition d’automne Publié jeu. 12 nov. 2026 à 16:15 Dakar 83 / 300 28 % rempli 61 73 % des vendus 351 000 F CFA 351 000 F CFA Clôture Télécharger le rapport PDF de Nuit du Sabar — édition d’automne Exporter les ventes de Nuit du Sabar — édition d’automne en CSV":
          - cell "Nuit du Sabar — édition d’automne Publié"
          - cell "jeu. 12 nov. 2026 à 16:15 Dakar":
            - time: jeu. 12 nov. 2026 à 16:15
            - text: Dakar
          - cell "83 / 300 28 % rempli"
          - cell "61 73 % des vendus"
          - cell "351 000 F CFA"
          - cell "351 000 F CFA"
          - cell "Clôture Télécharger le rapport PDF de Nuit du Sabar — édition d’automne Exporter les ventes de Nuit du Sabar — édition d’automne en CSV":
            - button "Clôture"
            - button "Télécharger le rapport PDF de Nuit du Sabar — édition d’automne"
            - button "Exporter les ventes de Nuit du Sabar — édition d’automne en CSV"
        - row "Brunch électro des Almadies Terminé dim. 8 nov. 2026 à 12:00 Dakar 10 / 80 13 % rempli 8 80 % des vendus 150 000 F CFA 150 000 F CFA Clôture Télécharger le rapport PDF de Brunch électro des Almadies Exporter les ventes de Brunch électro des Almadies en CSV":
          - cell "Brunch électro des Almadies Terminé"
          - cell "dim. 8 nov. 2026 à 12:00 Dakar":
            - time: dim. 8 nov. 2026 à 12:00
            - text: Dakar
          - cell "10 / 80 13 % rempli"
          - cell "8 80 % des vendus"
          - cell "150 000 F CFA"
          - cell "150 000 F CFA"
          - cell "Clôture Télécharger le rapport PDF de Brunch électro des Almadies Exporter les ventes de Brunch électro des Almadies en CSV":
            - button "Clôture"
            - button "Télécharger le rapport PDF de Brunch électro des Almadies"
            - button "Exporter les ventes de Brunch électro des Almadies en CSV"
  - region "Activité récente":
    - heading "Activité récente" [level=2]
    - list:
      - listitem:
        - paragraph: "Billet vendu : Croisière musicale vers Gorée"
        - paragraph: Billet TCK-20261112-105AE9020A · 9 000 F CFA
        - time: jeu. 12 nov. 2026 à 15:26
      - listitem:
        - paragraph: "Billet vendu : Croisière musicale vers Gorée"
        - paragraph: Billet TCK-20261112-6210AFE104 · 9 000 F CFA
        - time: jeu. 12 nov. 2026 à 15:26
      - listitem:
        - paragraph: Entrée validée
        - paragraph: Croisière musicale vers Gorée · contrôle à l’entrée
        - time: jeu. 12 nov. 2026 à 15:26
      - listitem:
        - paragraph: Entrée validée
        - paragraph: Croisière musicale vers Gorée · contrôle à l’entrée
        - time: jeu. 12 nov. 2026 à 15:26
      - listitem:
        - paragraph: "Billet vendu : Nuit du Sabar — édition d’automne"
        - paragraph: Billet TCK-20261112-8CC9ED992B · 5 000 F CFA
        - time: jeu. 12 nov. 2026 à 15:26
      - listitem:
        - paragraph: "Billet vendu : Nuit du Sabar — édition d’automne"
        - paragraph: Billet TCK-20261112-F014E7E176 · 5 000 F CFA
        - time: jeu. 12 nov. 2026 à 15:26
      - listitem:
        - paragraph: "Billet vendu : Nuit du Sabar — édition d’automne"
        - paragraph: Billet TCK-20261112-338E59BD00 · 10 000 F CFA
        - time: jeu. 12 nov. 2026 à 15:26
      - listitem:
        - paragraph: "Billet vendu : Nuit du Sabar — édition d’automne"
        - paragraph: Billet TCK-20261112-BCD5BBBB58 · 5 000 F CFA
        - time: jeu. 12 nov. 2026 à 15:26
      - listitem:
        - paragraph: "Billet vendu : Nuit du Sabar — édition d’automne"
        - paragraph: Billet TCK-20261112-C5FF9F652D · 5 000 F CFA
        - time: jeu. 12 nov. 2026 à 15:26
      - listitem:
        - paragraph: "Billet vendu : Nuit du Sabar — édition d’automne"
        - paragraph: Billet TCK-20261112-DF092793AF · 5 000 F CFA
        - time: jeu. 12 nov. 2026 à 15:26
      - listitem:
        - paragraph: Commande CMD-DEMO-1794497181358-0018A0
        - paragraph: Sur place · 5 000 F CFA
        - time: jeu. 12 nov. 2026 à 15:26
      - listitem:
        - paragraph: Entrée validée
        - paragraph: Nuit du Sabar — édition d’automne · contrôle à l’entrée
        - time: jeu. 12 nov. 2026 à 15:23
      - listitem:
        - paragraph: Entrée validée
        - paragraph: Nuit du Sabar — édition d’automne · contrôle à l’entrée
        - time: jeu. 12 nov. 2026 à 15:21
      - listitem:
        - paragraph: Entrée validée
        - paragraph: Nuit du Sabar — édition d’automne · contrôle à l’entrée
        - time: jeu. 12 nov. 2026 à 15:20
- alert
- dialog "Rapport de clôture":
  - heading "Rapport de clôture" [level=2]
  - paragraph: Brunch électro des Almadies
  - button "Fermer"
  - group "Contenu du rapport de clôture":
    - text: CLOTURE-1BDE9CA2-20261112
    - paragraph:
      - text: Généré le
      - time: jeu. 12 nov. 2026 à 15:41
    - list:
      - listitem: dim. 8 nov. 2026 à 12:00
      - listitem: Rooftop de la Pointe des Almadies, Dakar
    - paragraph: Billets vendus
    - paragraph: 10 / 80
    - paragraph: "Remplissage : 13 %"
    - paragraph: Entrées validées
    - paragraph: "8"
    - paragraph: "Présence : 80 %"
    - paragraph: Ventes en ligne
    - paragraph: 150 000 F CFA
    - paragraph: "Ventes au guichet : 0 F CFA"
    - paragraph: Net à reverser
    - paragraph: 150 000 F CFA
    - region "Ventes par catégorie":
      - heading "Ventes par catégorie" [level=3]
      - table "Ventes par catégorie":
        - caption: Ventes par catégorie
        - rowgroup:
          - row "Catégorie Prix unitaire Quota Vendus Invitations Ventes en ligne":
            - columnheader "Catégorie"
            - columnheader "Prix unitaire"
            - columnheader "Quota"
            - columnheader "Vendus"
            - columnheader "Invitations"
            - columnheader "Ventes en ligne"
        - rowgroup:
          - row "Brunch 15 000 F CFA 80 10 0 150 000 F CFA":
            - cell "Brunch"
            - cell "15 000 F CFA"
            - cell "80"
            - cell "10"
            - cell "0"
            - cell "150 000 F CFA"
    - region "Synthèse comptable":
      - heading "Synthèse comptable" [level=3]
      - term: Ventes en ligne, prix des billets
      - definition: 150 000 F CFA
      - term: Net à reverser au partenaire
      - definition: 150 000 F CFA
      - term: Dont disponible
      - definition: 0 F CFA
      - term: Dont en attente
      - definition: 150 000 F CFA
      - term: Frais de service payés par l’acheteur, non déduits
      - definition: 7 500 F CFA
      - term: Espèces au guichet, 0 billet, hors plateforme, pour information
      - definition: 0 F CFA
  - paragraph: Document généré par Event Village
  - button "Export CSV / Excel"
  - button "Télécharger le PDF"
```

# Test source

```ts
  828  |             await expect(page.getByRole('button', { name: /^envoyer une notification d.essai$/i })).toBeVisible();
  829  |             const counters = await fakePushCounters(page);
  830  |             expect(counters.requestPermissionCalls, 'une seule demande d’autorisation, au clic').toBe(1);
  831  |             expect(counters.subscribeCalls, 'un seul abonnement').toBe(1);
  832  |         },
  833  |     },
  834  |     {
  835  |         id: 'preferences-push-refuse', titre: 'Préférences de notification — push refusé dans le navigateur', role: 'client', needsIds: true,
  836  |         path: () => '/profile/notifications', fakePush: 'denied',
  837  |         ready: async ({ page }) => {
  838  |             await preferencesReady(page, /^refusées dans le navigateur$/i);
  839  |             await expect(page.getByRole('button', { name: /^activer les notifications$/i })).toHaveCount(0);
  840  |             await expectNoPermissionPrompt(page);
  841  |         },
  842  |     },
  843  |     {
  844  |         id: 'preferences-push-non-pris-en-charge', titre: 'Préférences de notification — push non pris en charge par le navigateur', role: 'client', needsIds: true,
  845  |         path: () => '/profile/notifications', fakePush: 'unsupported',
  846  |         ready: async ({ page }) => {
  847  |             await preferencesReady(page, /^non prises en charge par ce navigateur$/i);
  848  |             await expect(page.getByRole('button', { name: /^activer les notifications$/i })).toHaveCount(0);
  849  |         },
  850  |     },
  851  |     {
  852  |         id: 'cloche-ouverte', titre: 'Cloche ouverte (non lues d’abord, Tout marquer comme lu)', role: 'client', needsIds: true, path: () => '/tickets',
  853  |         actions: async ({ page }) => {
  854  |             await page.getByRole('button', { name: /^notifications/i }).filter({ visible: true }).first().click();
  855  |             const panel = page.getByRole('region', { name: /^notifications$/i });
  856  |             await expect(panel).toBeVisible();
  857  |             await expect(panel.getByRole('listitem').first()).toBeVisible();
  858  |         },
  859  |     },
  860  |     {
  861  |         id: 'notifications-vide', titre: 'Notifications du client — aucune notification', role: 'client', needsIds: true, path: () => '/notifications',
  862  |         stubResponse: { url: /\/api\/notifications(\?|$)/, status: 200, body: { notifications: [], unreadCount: 0, total: 0, page: 1, pageSize: 20 } },
  863  |         ready: async ({ page }) => { await expect(page.getByText('Aucune notification', { exact: true })).toBeVisible(); },
  864  |     },
  865  |     { id: 'notifications', titre: 'Notifications du client', role: 'client', needsIds: true, path: () => '/notifications' },
  866  |     {
  867  |         id: 'notifications-erreur', titre: 'Notifications du client — état d’erreur', role: 'client', needsIds: true, path: () => '/notifications',
  868  |         injectError: /\/api\/notifications(\?|$)/, ready: expectRetry,
  869  |     },
  870  |     // ── Organisateur ────────────────────────────────────────────────────────
  871  |     { id: 'partenaire-evenements', titre: 'Liste des événements de l’organisateur', role: 'organisateur', needsIds: true, path: () => '/partner/events' },
  872  |     {
  873  |         id: 'partenaire-evenements-annules', titre: 'Liste de l’organisateur — onglet Annulé', role: 'organisateur', needsIds: true, path: () => '/partner/events',
  874  |         actions: async ({ page }) => openTab(page, /^annulé/i),
  875  |     },
  876  |     {
  877  |         id: 'partenaire-evenements-erreur', titre: 'Liste de l’organisateur — état d’erreur', role: 'organisateur', needsIds: true, path: () => '/partner/events',
  878  |         injectError: /\/api\/partner\/events(\/overview)?(\?.*)?$/, ready: expectRetry,
  879  |     },
  880  |     { id: 'partenaire-creation', titre: 'Création d’un événement (formulaire partagé)', role: 'organisateur', needsIds: true, path: () => '/partner/events/new' },
  881  |     {
  882  |         id: 'partenaire-edition', titre: 'Édition d’un événement publié avec ventes (champs verrouillés)', role: 'organisateur', needsIds: true,
  883  |         path: (i) => `/partner/events/${ids(i).events.publie.id}/edit`,
  884  |     },
  885  |     {
  886  |         id: 'partenaire-categorie-canaux', titre: 'Catégorie « Carré presse » : deux canaux, sur place uniquement', role: 'organisateur', needsIds: true,
  887  |         path: (i) => `/partner/events/${ids(i).events.ceSoir.id}/edit`,
  888  |         actions: async ({ page }) => {
  889  |             await openTicketingStep(page);
  890  |             const card = categorySections(page).filter({ has: page.getByRole('heading', { name: 'Carré presse', exact: true }) });
  891  |             await expect(card.getByRole('checkbox', { name: ONLINE_BOX })).not.toBeChecked();
  892  |             await expect(card.getByRole('checkbox', { name: COUNTER_BOX })).toBeChecked();
  893  |             await expect(card.getByText('Sur place uniquement').first()).toBeVisible();
  894  |             await revealCenter(card.getByRole('checkbox', { name: ONLINE_BOX }));
  895  |         },
  896  |     },
  897  |     {
  898  |         id: 'partenaire-categorie-invitations', titre: 'Catégorie sans aucun canal : aide factuelle, aucune distribution', role: 'organisateur', needsIds: true,
  899  |         path: (i) => `/partner/events/${ids(i).events.ceSoir.id}/edit`,
  900  |         actions: async ({ page }) => {
  901  |             await openTicketingStep(page);
  902  |             // Ligne ajoutée au seed par fix(8.0-seed) (L80) : son nom n'est pas fixé par le contrat, seul son résumé l'est
  903  |             const card = categorySections(page).filter({ hasText: 'Invitations seulement' });
  904  |             await expect(card.getByRole('checkbox', { name: ONLINE_BOX })).not.toBeChecked();
  905  |             await expect(card.getByRole('checkbox', { name: COUNTER_BOX })).not.toBeChecked();
  906  |             await expect(card.getByText('Cette catégorie n’est vendue ni en ligne ni au guichet. Distribuez ses billets depuis l’onglet Invitations du pilotage.')).toBeVisible();
  907  |             await revealCenter(card.getByRole('checkbox', { name: ONLINE_BOX }));
  908  |         },
  909  |     },
  910  |     {
  911  |         id: 'partenaire-rapport-cloture', titre: 'Rapport de clôture d’un événement terminé (modale du tableau de bord)', role: 'organisateur', needsIds: true,
  912  |         path: () => '/partner/dashboard', references: [/^CLOTURE-[0-9A-F]{8}-\d{8}$/],
  913  |         actions: async (c) => {
  914  |             const { title } = ids(c.ids).events.termine;
  915  |             const button = c.page.locator('tr, li, article')
  916  |                 .filter({ hasText: title })
  917  |                 .getByRole('button', { name: /^clôture$/i })
  918  |                 .filter({ visible: true })
  919  |                 .first();
  920  |             const loaded = c.page.waitForResponse((r) => new URL(r.url()).pathname === '/api/partner/reports/closing');
  921  |             await button.click();
  922  |             const report = await loaded;
  923  |             expect(report.status(), `rapport de clôture de « ${title} »`).toBe(200);
  924  |             const dialog = c.page.getByRole('dialog', { name: /^rapport de clôture$/i });
  925  |             await expect(dialog).toBeVisible();
  926  |             await expect(dialog.getByText(title).first()).toBeVisible();
  927  |             await expect(dialog.getByText(/^généré le/i)).toBeVisible();
> 928  |             await expect(dialog.getByText('Entrées (dont guichet)', { exact: true }).filter({ visible: true }).first(), 'un seul rapport (lot 9 ter, R106 b)').toBeVisible();
       |                                                                                                                                                                ^ Error: un seul rapport (lot 9 ter, R106 b)
  929  |             await expect(dialog.getByRole('button', { name: /^télécharger le pdf$/i })).toBeVisible();
  930  |             await c.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  931  |         },
  932  |     },
  933  |     tabScreen('pilotage-apercu', 'Pilotage — Aperçu', /^aperçu/i),
  934  |     tabScreen('pilotage-ventes', 'Pilotage — Ventes', /^ventes/i),
  935  |     {
  936  |         id: 'pilotage-rembourser-billet', titre: 'Pilotage — Ventes : fiche d’un billet à rembourser', role: 'organisateur', needsIds: true, path: pilotage('ceSoir'),
  937  |         actions: async (c) => {
  938  |             const { number } = ids(c.ids).tickets.manualLookup;
  939  |             await openTab(c.page, /^ventes/i);
  940  |             await c.page.getByLabel(/^numéro du billet/i).fill(number);
  941  |             const found = c.page.waitForResponse((r) => new URL(r.url()).pathname.endsWith('/tickets/lookup'));
  942  |             await c.page.getByRole('button', { name: /^rechercher le billet$/i }).click();
  943  |             expect((await found).status(), `recherche du billet ${number}`).toBe(200);
  944  |             const refund = c.page.getByRole('button', { name: /^rembourser ce billet$/i });
  945  |             await expect(refund).toBeVisible();
  946  |             await expect(c.page.getByRole('button', { name: /^annuler ce billet gratuit$/i }), 'billet payant : jamais l’action du billet gratuit').toHaveCount(0);
  947  |             // Le motif se quitte sans rien envoyer : capture de la fiche, pas d'un remboursement
  948  |             await refund.click();
  949  |             const reason = c.page.getByRole('dialog', { name: /^motif du remboursement$/i });
  950  |             await reason.getByRole('button', { name: /^revenir à la fiche$/i }).click();
  951  |             await expect(reason).toBeHidden();
  952  |             await revealCenter(refund);
  953  |         },
  954  |     },
  955  |     tabScreen('pilotage-entrees', 'Pilotage — Entrées en direct', /^entrées/i),
  956  |     tabScreen('pilotage-equipe', 'Pilotage — Équipe', /^équipe/i),
  957  |     tabScreen('pilotage-caisse', 'Pilotage — Caisse', /^caisse/i),
  958  |     tabScreen('pilotage-cloture', 'Pilotage — Clôture et export', /^clôture/i),
  959  |     {
  960  |         id: 'pilotage-annulation', titre: 'Modale « Annuler l’événement » (impact, titre à retaper)', role: 'organisateur', needsIds: true, path: pilotage('publie'),
  961  |         actions: async ({ page }) => {
  962  |             await page.getByRole('button', { name: /annuler l[’']événement/i }).click();
  963  |             await expect(page.getByRole('dialog').or(page.getByRole('alertdialog'))).toBeVisible();
  964  |         },
  965  |     },
  966  |     {
  967  |         id: 'pilotage-remboursements', titre: 'Événement annulé — avancement des remboursements', role: 'organisateur', needsIds: true, path: pilotage('annule'),
  968  |         ready: async ({ page }) => { await expect(page.getByText(/remboursements/i).first()).toBeVisible(); },
  969  |     },
  970  |     {
  971  |         id: 'pilotage-erreur', titre: 'Pilotage — état d’erreur', role: 'organisateur', needsIds: true, path: pilotage('ceSoir'),
  972  |         injectError: /\/api\/partner\/events\/[^/]+\/pilotage\/overview(\?.*)?$/, ready: expectRetry,
  973  |     },
  974  |     // ── Administration ──────────────────────────────────────────────────────
  975  |     { id: 'admin-evenements', titre: 'Administration — événements (filtres, pagination)', role: 'admin', needsIds: true, path: () => '/admin/events' },
  976  |     { id: 'admin-evenements-en-attente', titre: 'Administration — file de validation', role: 'admin', needsIds: true, path: () => '/admin/events?status=EN_ATTENTE' },
  977  |     {
  978  |         id: 'admin-evenements-erreur', titre: 'Administration — état d’erreur', role: 'admin', needsIds: true, path: () => '/admin/events',
  979  |         injectError: /\/api\/admin\/events(\?.*)?$/, ready: expectRetry,
  980  |     },
  981  |     { id: 'admin-fiche-en-attente', titre: 'Administration — fiche complète avant validation', role: 'admin', needsIds: true, path: (i) => `/admin/events/${ids(i).events.enAttente.id}` },
  982  |     { id: 'admin-fiche-suspendu', titre: 'Administration — fiche d’un événement suspendu (motif, réactiver)', role: 'admin', needsIds: true, path: (i) => `/admin/events/${ids(i).events.suspendu.id}` },
  983  |     {
  984  |         id: 'admin-notifications', titre: 'Administration — supervision des notifications (liste filtrable, compteurs)', role: 'admin', needsIds: true,
  985  |         path: () => '/admin/notifications',
  986  |         ready: async ({ page }) => {
  987  |             await expectHeading(page, /^notifications$/i);
  988  |             await expect(page.getByRole('link', { name: /^voir le détail/i }).first()).toBeVisible();
  989  |         },
  990  |         actions: expectFrenchDateField,
  991  |     },
  992  |     {
  993  |         id: 'admin-notifications-detail', titre: 'Administration — détail d’une notification en échec (Relancer)', role: 'admin', needsIds: true,
  994  |         path: (i) => `/admin/notifications/${ids(i).notifications.failedId}`,
  995  |         ready: async ({ page }) => { await expect(page.getByRole('button', { name: /^relancer$/i })).toBeVisible(); },
  996  |     },
  997  |     {
  998  |         id: 'admin-notifications-erreur', titre: 'Administration — supervision des notifications, état d’erreur', role: 'admin', needsIds: true,
  999  |         path: () => '/admin/notifications',
  1000 |         injectError: /\/api\/admin\/notifications(\?.*)?$/,
  1001 |         // L'état d'erreur est sous les compteurs et les filtres : à 390 px, il était hors de l'image (run 77)
  1002 |         ready: async (c) => {
  1003 |             await expectRetry(c);
  1004 |             await revealCenter(c.page.getByRole('button', { name: /réessayer/i }));
  1005 |         },
  1006 |     },
  1007 |     {
  1008 |         id: 'admin-services-desactive', titre: 'Administration — services : mention « Service désactivé » (interrupteur fermé)', role: 'admin', needsIds: true,
  1009 |         path: () => '/admin/services?tab=salles',
  1010 |         ready: async ({ page }) => {
  1011 |             await expect(page.getByRole('tab', { name: /^salles de fête/i })).toHaveAttribute('aria-selected', 'true');
  1012 |             await expect(page.getByText('Service désactivé', { exact: true })).toBeVisible();
  1013 |             await expect(page.getByText('Ce service est fermé par son interrupteur : il est masqué au public. Les données restent consultables ici.')).toBeVisible();
  1014 |         },
  1015 |     },
  1016 |     {
  1017 |         // Lot 9 bis (7.3, B114) : sous fumee-superadmin, réponse au format du contrat 4.1 ; voir l'en-tête du fichier
  1018 |         id: 'admin-remboursements-a-reprendre', titre: 'Administration — finances : versements à reprendre (Renvoyer, Marquer versé ; réponses imposées)',
  1019 |         role: 'fumee-superadmin', needsIds: false, path: () => '/admin/finance',
  1020 |         stubResponses: CASHOUTS_STUBS,
  1021 |         ready: async ({ page }) => {
  1022 |             const { resend } = await cashoutsReady(page);
  1023 |             await revealCenter(resend.first());
  1024 |         },
  1025 |     },
  1026 |     // ── Contrôle d'accès ────────────────────────────────────────────────────
  1027 |     // Lot 7 (D85, E3) : thème sombre forcé, 2 vues ; après « Commencer le contrôle » (l'écran de départ est
  1028 |     // capturé à part : scanner-accueil)
```