# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · anonyme >> recherche-recentes — Recherche instantanée — recherches récentes de l’appareil
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('dialog', { name: /^rechercher un événement$/i }).getByRole('heading', { name: /^recherches récentes$/i })
Expected: visible
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('dialog', { name: /^rechercher un événement$/i }).getByRole('heading', { name: /^recherches récentes$/i }) with timeout 30000ms
  - waiting for getByRole('dialog', { name: /^rechercher un événement$/i }).getByRole('heading', { name: /^recherches récentes$/i })

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
  - region "Vos prochaines sorties au Sénégal":
    - heading "Vos prochaines sorties au Sénégal" [level=1]
    - paragraph: "Concerts, festivals, soirées et rencontres : choisissez votre place, payez avec Wave ou Orange Money et présentez votre billet à l’entrée."
    - search:
      - text: Rechercher un événement
      - searchbox "Rechercher un événement"
      - button "Rechercher"
    - navigation "Raccourcis":
      - list:
        - listitem:
          - link "Aujourd’hui":
            - /url: /explore?quand=aujourdhui
        - listitem:
          - link "Ce week-end":
            - /url: /explore?quand=weekend
        - listitem:
          - link "Cette semaine":
            - /url: /explore?quand=semaine
        - listitem:
          - link "Gratuit":
            - /url: /explore?gratuit=1
  - region "Populaires":
    - heading "Populaires" [level=2]
    - paragraph: Les événements les plus demandés des 7 derniers jours.
    - status: En direct
    - link "Tout voir":
      - /url: /explore
    - list:
      - listitem:
        - article:
          - text: En cours
          - 'button "Mettre en favori : Nuit du Sabar — édition d’automne"'
          - paragraph: Concerts & Musique
          - heading "Nuit du Sabar — édition d’automne" [level=3]:
            - link "Nuit du Sabar — édition d’automne":
              - /url: /events/3e9d2e6d-f0f3-446b-9d60-216f9a08b071
          - paragraph: ven. 20 nov. · 02:30
          - paragraph: Dakar · Esplanade de la Corniche Ouest
          - paragraph: Dès 5 000 F CFA
      - listitem:
        - article:
          - text: En cours
          - 'button "Mettre en favori : Marché gourmand de la Petite-Côte"'
          - paragraph: Gastronomie & Tables
          - heading "Marché gourmand de la Petite-Côte" [level=3]:
            - link "Marché gourmand de la Petite-Côte":
              - /url: /events/0ffa76c6-3e36-455b-bc34-fee45478bb19
          - paragraph: mer. 25 nov. · 10:00
          - paragraph: Mbour · Place du Marché Central
          - paragraph: Dès 1 000 F CFA
      - listitem:
        - article:
          - text: En cours
          - 'button "Mettre en favori : Nuit du slam de Kaolack"'
          - paragraph: Concerts & Musique
          - heading "Nuit du slam de Kaolack" [level=3]:
            - link "Nuit du slam de Kaolack":
              - /url: /events/2f36f179-021b-4c82-a4e2-10e2d89cb04c
          - paragraph: sam. 21 nov. · 21:00
          - paragraph: Kaolack · Centre culturel régional
          - text: Dernières places
          - paragraph: Dès 3 000 F CFA
      - listitem:
        - article:
          - text: En cours
          - 'button "Mettre en favori : Festival Jazz sur le Fleuve"'
          - paragraph: Festivals
          - heading "Festival Jazz sur le Fleuve" [level=3]:
            - link "Festival Jazz sur le Fleuve":
              - /url: /events/5e91928f-d52d-4a00-9717-f6d3b11c1512
          - paragraph: mer. 2 déc. · 18:00
          - paragraph: Saint-Louis · Quai des Pêcheurs
          - paragraph: Dès 7 500 F CFA
      - listitem:
        - article:
          - text: En cours
          - 'button "Mettre en favori : Gala des entrepreneurs du Saloum"'
          - paragraph: Salles & Réceptions
          - heading "Gala des entrepreneurs du Saloum" [level=3]:
            - link "Gala des entrepreneurs du Saloum":
              - /url: /events/06782029-c5e6-43c4-b094-05c2d957f457
          - paragraph: ven. 11 déc. · 19:30
          - paragraph: Kaolack · Salle des Palétuviers
          - paragraph: Dès 10 000 F CFA
      - listitem:
        - article:
          - text: En cours
          - 'button "Mettre en favori : Concert des Lumières de Gorée"'
          - paragraph: Concerts & Musique
          - heading "Concert des Lumières de Gorée" [level=3]:
            - link "Concert des Lumières de Gorée":
              - /url: /events/2efb3949-9b04-4b50-91d3-a68c90fc327a
          - paragraph: ven. 20 nov. · 21:45
          - paragraph: Gorée · Place du Gouvernement
          - paragraph: Dès 6 000 F CFA
      - listitem:
        - article:
          - text: En cours
          - 'button "Mettre en favori : Carnaval des enfants de Saly"'
          - paragraph: Festivals
          - heading "Carnaval des enfants de Saly" [level=3]:
            - link "Carnaval des enfants de Saly":
              - /url: /events/8980a46f-51a3-4f8b-9a6f-b70b558ad396
          - paragraph: dim. 20 déc. · 15:00
          - paragraph: Saly · Promenade des Filaos
          - paragraph: Dès 2 000 F CFA
      - listitem:
        - article:
          - text: En cours
          - 'button "Mettre en favori : Dîner-spectacle au bord du Saloum"'
          - paragraph: Salles & Réceptions
          - heading "Dîner-spectacle au bord du Saloum" [level=3]:
            - link "Dîner-spectacle au bord du Saloum":
              - /url: /events/2f111f43-3e00-49ab-8180-c539d1515bcc
          - paragraph: sam. 28 nov. · 20:00
          - paragraph: Foundiougne · Terrasse des Pirogues
          - paragraph: Dès 25 000 F CFA
      - listitem:
        - article:
          - text: En cours
          - 'button "Mettre en favori : Soirée Kora & Lumières"'
          - paragraph: Concerts & Musique
          - heading "Soirée Kora & Lumières" [level=3]:
            - link "Soirée Kora & Lumières":
              - /url: /events/aa979567-a4bc-4c18-8fd8-ba86d1adabf5
          - paragraph: lun. 7 déc. · 20:30
          - paragraph: Dakar · Jardin de la Maison des Arts
          - paragraph: Dès 6 000 F CFA
      - listitem:
        - article:
          - text: En cours
          - 'button "Mettre en favori : TEST Spectacle B (publié, à venir)"'
          - paragraph: Concerts & Musique
          - heading "TEST Spectacle B (publié, à venir)" [level=3]:
            - link "TEST Spectacle B (publié, à venir)":
              - /url: /events/b717cb0d-6a16-47cf-b600-929573381078
          - paragraph: jeu. 10 déc. · 20:00
          - paragraph: Dakar · Salle de test, Dakar
          - paragraph: Dès 4 000 F CFA
  - region "Cette semaine":
    - heading "Cette semaine" [level=2]
    - paragraph: Aujourd’hui et les six prochains jours.
    - link "Tout voir (4)":
      - /url: /explore?quand=semaine
    - list:
      - listitem:
        - article:
          - text: En cours
          - 'button "Mettre en favori : Nuit du Sabar — édition d’automne"'
          - paragraph: Concerts & Musique
          - heading "Nuit du Sabar — édition d’automne" [level=3]:
            - link "Nuit du Sabar — édition d’automne":
              - /url: /events/3e9d2e6d-f0f3-446b-9d60-216f9a08b071
          - paragraph: ven. 20 nov. · 02:30
          - paragraph: Dakar · Esplanade de la Corniche Ouest
          - paragraph: Dès 5 000 F CFA
      - listitem:
        - article:
          - text: En cours
          - 'button "Mettre en favori : Concert des Lumières de Gorée"'
          - paragraph: Concerts & Musique
          - heading "Concert des Lumières de Gorée" [level=3]:
            - link "Concert des Lumières de Gorée":
              - /url: /events/2efb3949-9b04-4b50-91d3-a68c90fc327a
          - paragraph: ven. 20 nov. · 21:45
          - paragraph: Gorée · Place du Gouvernement
          - paragraph: Dès 6 000 F CFA
      - listitem:
        - article:
          - text: En cours
          - 'button "Mettre en favori : Nuit du slam de Kaolack"'
          - paragraph: Concerts & Musique
          - heading "Nuit du slam de Kaolack" [level=3]:
            - link "Nuit du slam de Kaolack":
              - /url: /events/2f36f179-021b-4c82-a4e2-10e2d89cb04c
          - paragraph: sam. 21 nov. · 21:00
          - paragraph: Kaolack · Centre culturel régional
          - text: Dernières places
          - paragraph: Dès 3 000 F CFA
      - listitem:
        - article:
          - text: En cours
          - 'button "Mettre en favori : Marché gourmand de la Petite-Côte"'
          - paragraph: Gastronomie & Tables
          - heading "Marché gourmand de la Petite-Côte" [level=3]:
            - link "Marché gourmand de la Petite-Côte":
              - /url: /events/0ffa76c6-3e36-455b-bc34-fee45478bb19
          - paragraph: mer. 25 nov. · 10:00
          - paragraph: Mbour · Place du Marché Central
          - paragraph: Dès 1 000 F CFA
  - region "Par catégorie":
    - heading "Par catégorie" [level=2]
    - list:
      - listitem:
        - link "Concerts & Musique 6":
          - /url: /explore?categorie=CONCERT
      - listitem:
        - link "Festivals 3":
          - /url: /explore?categorie=FESTIVAL
      - listitem:
        - link "Gastronomie & Tables 1":
          - /url: /explore?categorie=FOOD
      - listitem:
        - link "Salles & Réceptions 2":
          - /url: /explore?categorie=SALLE
    - heading "Concerts & Musique" [level=3]
    - 'link "Tout voir : Concerts & Musique"':
      - /url: /explore?categorie=CONCERT
      - text: Tout voir
    - list:
      - listitem:
        - article:
          - text: En cours
          - 'button "Mettre en favori : Nuit du Sabar — édition d’automne"'
          - paragraph: Concerts & Musique
          - heading "Nuit du Sabar — édition d’automne" [level=3]:
            - link "Nuit du Sabar — édition d’automne":
              - /url: /events/3e9d2e6d-f0f3-446b-9d60-216f9a08b071
          - paragraph: ven. 20 nov. · 02:30
          - paragraph: Dakar · Esplanade de la Corniche Ouest
          - paragraph: Dès 5 000 F CFA
      - listitem:
        - article:
          - text: En cours
          - 'button "Mettre en favori : Concert des Lumières de Gorée"'
          - paragraph: Concerts & Musique
          - heading "Concert des Lumières de Gorée" [level=3]:
            - link "Concert des Lumières de Gorée":
              - /url: /events/2efb3949-9b04-4b50-91d3-a68c90fc327a
          - paragraph: ven. 20 nov. · 21:45
          - paragraph: Gorée · Place du Gouvernement
          - paragraph: Dès 6 000 F CFA
      - listitem:
        - article:
          - text: En cours
          - 'button "Mettre en favori : Nuit du slam de Kaolack"'
          - paragraph: Concerts & Musique
          - heading "Nuit du slam de Kaolack" [level=3]:
            - link "Nuit du slam de Kaolack":
              - /url: /events/2f36f179-021b-4c82-a4e2-10e2d89cb04c
          - paragraph: sam. 21 nov. · 21:00
          - paragraph: Kaolack · Centre culturel régional
          - text: Dernières places
          - paragraph: Dès 3 000 F CFA
      - listitem:
        - article:
          - text: En cours
          - 'button "Mettre en favori : Soirée Kora & Lumières"'
          - paragraph: Concerts & Musique
          - heading "Soirée Kora & Lumières" [level=3]:
            - link "Soirée Kora & Lumières":
              - /url: /events/aa979567-a4bc-4c18-8fd8-ba86d1adabf5
          - paragraph: lun. 7 déc. · 20:30
          - paragraph: Dakar · Jardin de la Maison des Arts
          - paragraph: Dès 6 000 F CFA
    - heading "Festivals" [level=3]
    - 'link "Tout voir : Festivals"':
      - /url: /explore?categorie=FESTIVAL
      - text: Tout voir
    - list:
      - listitem:
        - article:
          - text: En cours
          - 'button "Mettre en favori : Festival Jazz sur le Fleuve"'
          - paragraph: Festivals
          - heading "Festival Jazz sur le Fleuve" [level=3]:
            - link "Festival Jazz sur le Fleuve":
              - /url: /events/5e91928f-d52d-4a00-9717-f6d3b11c1512
          - paragraph: mer. 2 déc. · 18:00
          - paragraph: Saint-Louis · Quai des Pêcheurs
          - paragraph: Dès 7 500 F CFA
      - listitem:
        - article:
          - text: En cours
          - 'button "Mettre en favori : Festival des rythmes de Casamance"'
          - paragraph: Festivals
          - heading "Festival des rythmes de Casamance" [level=3]:
            - link "Festival des rythmes de Casamance":
              - /url: /events/0fe9a668-6018-4c05-88c1-0994fd4495aa
          - paragraph: mer. 16 déc. · 17:00
          - paragraph: Ziguinchor · Esplanade du Port
          - paragraph: Dès 5 000 F CFA
      - listitem:
        - article:
          - text: En cours
          - 'button "Mettre en favori : Carnaval des enfants de Saly"'
          - paragraph: Festivals
          - heading "Carnaval des enfants de Saly" [level=3]:
            - link "Carnaval des enfants de Saly":
              - /url: /events/8980a46f-51a3-4f8b-9a6f-b70b558ad396
          - paragraph: dim. 20 déc. · 15:00
          - paragraph: Saly · Promenade des Filaos
          - paragraph: Dès 2 000 F CFA
    - heading "Gastronomie & Tables" [level=3]
    - 'link "Tout voir : Gastronomie & Tables"':
      - /url: /explore?categorie=FOOD
      - text: Tout voir
    - list:
      - listitem:
        - article:
          - text: En cours
          - 'button "Mettre en favori : Marché gourmand de la Petite-Côte"'
          - paragraph: Gastronomie & Tables
          - heading "Marché gourmand de la Petite-Côte" [level=3]:
            - link "Marché gourmand de la Petite-Côte":
              - /url: /events/0ffa76c6-3e36-455b-bc34-fee45478bb19
          - paragraph: mer. 25 nov. · 10:00
          - paragraph: Mbour · Place du Marché Central
          - paragraph: Dès 1 000 F CFA
    - heading "Salles & Réceptions" [level=3]
    - 'link "Tout voir : Salles & Réceptions"':
      - /url: /explore?categorie=SALLE
      - text: Tout voir
    - list:
      - listitem:
        - article:
          - text: En cours
          - 'button "Mettre en favori : Dîner-spectacle au bord du Saloum"'
          - paragraph: Salles & Réceptions
          - heading "Dîner-spectacle au bord du Saloum" [level=3]:
            - link "Dîner-spectacle au bord du Saloum":
              - /url: /events/2f111f43-3e00-49ab-8180-c539d1515bcc
          - paragraph: sam. 28 nov. · 20:00
          - paragraph: Foundiougne · Terrasse des Pirogues
          - paragraph: Dès 25 000 F CFA
      - listitem:
        - article:
          - text: En cours
          - 'button "Mettre en favori : Gala des entrepreneurs du Saloum"'
          - paragraph: Salles & Réceptions
          - heading "Gala des entrepreneurs du Saloum" [level=3]:
            - link "Gala des entrepreneurs du Saloum":
              - /url: /events/06782029-c5e6-43c4-b094-05c2d957f457
          - paragraph: ven. 11 déc. · 19:30
          - paragraph: Kaolack · Salle des Palétuviers
          - paragraph: Dès 10 000 F CFA
  - region "Près de chez vous":
    - heading "Près de chez vous" [level=2]
    - paragraph: Les prochains événements dans votre ville.
    - text: Votre ville
    - combobox "Votre ville":
      - option "Choisir une ville" [disabled] [selected]
      - option "Dakar"
      - option "Foundiougne"
      - option "Gorée"
      - option "Kaolack"
      - option "Mbour"
      - option "Saint-Louis"
      - option "Saly"
      - option "Ziguinchor"
    - heading "Choisissez votre ville" [level=3]
    - paragraph: Les événements proches de chez vous apparaîtront ici. Votre choix est gardé pour vos prochaines visites.
  - region "Comment ça marche":
    - heading "Comment ça marche" [level=2]
    - list:
      - listitem:
        - paragraph: Wave et Orange Money
        - paragraph: Payez depuis votre téléphone, le billet arrive aussitôt dans « Mes billets ».
      - listitem:
        - paragraph: QR code dynamique
        - paragraph: "Un code renouvelé en continu : une capture d’écran ne passe pas l’entrée."
      - listitem:
        - paragraph: Remboursement automatique
        - paragraph: "Événement annulé : les billets payés en ligne sont remboursés."
  - region "Parrainez vos proches":
    - heading "Parrainez vos proches" [level=2]
    - paragraph:
      - text: "Partagez votre lien de parrainage : vous recevez"
      - strong: 5 %
      - text: de la part d’Event Village sur les achats en ligne de vos filleuls pendant
      - strong: 12 mois
      - text: ", et"
      - strong: 2 %
      - text: sur ceux des personnes qu’ils parrainent.
    - link "Obtenir mon lien":
      - /url: /wallet
  - region "Vous organisez des événements ? Vendez vos billets avec Event Village.":
    - paragraph: Espace organisateur
    - heading "Vous organisez des événements ? Vendez vos billets avec Event Village." [level=2]
    - list:
      - listitem: Création et publication de vos événements, validées par notre équipe
      - listitem: Ventes et entrées suivies en direct, contrôleurs et caisses sur place
      - listitem: Fonds versés sur votre compte après l’événement
    - link "Devenir partenaire":
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
        - link "Devenir partenaire":
          - /url: /partner/register
  - paragraph: Event Village, 2026. Tous droits réservés.
- navigation "Navigation rapide":
  - link "Accueil":
    - /url: /
  - link "Explorer":
    - /url: /explore
  - link "Billets":
    - /url: /tickets
  - link "Portefeuille":
    - /url: /wallet
- alert
- dialog "Rechercher un événement":
  - heading "Rechercher un événement" [level=2]
  - button "Fermer"
  - search:
    - text: Rechercher un événement
    - searchbox "Rechercher un événement"
  - status
  - paragraph: "Tapez au moins deux lettres : un artiste, un lieu, une ville…"
```

# Test source

```ts
  884  |         }],
  885  |     },
  886  |     rate: { window_minutes: 5, per_minute: 2.2, by_minute: ENTRIES_BY_MINUTE },
  887  |     controllers: { window_minutes: 10, assigned: 4, active: 3 },
  888  |     alert_settings: { threshold: 10, minutes: 5 },
  889  |     alerts: [{ gate_key: 'porte-sud', name: 'Porte Sud', zone_name: 'Entrée générale', refused: 12, window_minutes: 5, threshold: 10 }],
  890  |     computed_at: '2026-11-07T21:00:00.000Z',
  891  | };
  892  | 
  893  | /** Onglet Équipe de l'événement à zones de la graine v4 (organisateur). */
  894  | function zonesTeamPath(i: DemoIds | null): string {
  895  |     return `/partner/events/${seedEvent(i, 'zones').id}?tab=equipe`;
  896  | }
  897  | 
  898  | /**
  899  |  * Finition 2b (B, E-23) : étape « Contrôle à l'entrée » du formulaire de modification de l'événement à zones de la graine
  900  |  * v4 (cible de « Modifier les portes et les couleurs ») ; l'éditeur des zones a quitté l'onglet Équipe.
  901  |  */
  902  | function zonesStepPath(i: DemoIds | null): string {
  903  |     return `/partner/events/${seedEvent(i, 'zones').id}/edit?etape=controle`;
  904  | }
  905  | 
  906  | /** Onglet Équipe ouvert (?tab=equipe). */
  907  | async function teamTabReady(page: Page): Promise<void> {
  908  |     await expect(page.getByRole('tab', { name: /^équipe/i })).toHaveAttribute('aria-selected', 'true', { timeout: 30_000 });
  909  | }
  910  | 
  911  | /** Éditeur des zones chargé avec les deux zones et les trois portes de la graine v4 (D.3.2), à l'étape du formulaire. */
  912  | async function zonesEditorReady(page: Page): Promise<Locator> {
  913  |     await expect(page.getByRole('heading', { name: /^contrôle à l.entrée \(facultatif\)$/i }), 'étape « Contrôle à l’entrée » ouverte')
  914  |         .toBeVisible({ timeout: 30_000 });
  915  |     const heading = page.getByRole('heading', { name: /^zones et portes$/i });
  916  |     await expect(heading, 'section « Zones et portes » de l’étape « Contrôle à l’entrée »').toBeVisible({ timeout: 30_000 });
  917  |     const zoneNames = page.getByLabel(/^nom de la zone/i);
  918  |     await expect(zoneNames, 'deux zones de la graine v4').toHaveCount(2);
  919  |     await expect(zoneNames.nth(0)).toHaveValue('Entrée générale');
  920  |     await expect(zoneNames.nth(1)).toHaveValue('Carré VIP');
  921  |     await expect(page.getByLabel(/^nom de la porte/i), 'trois portes de la graine v4').toHaveCount(3);
  922  |     return heading;
  923  | }
  924  | 
  925  | function tabScreen(id: string, titre: string, tab: RegExp): Screen {
  926  |     return {
  927  |         id, titre, role: 'organisateur', needsIds: true, path: pilotage('ceSoir'),
  928  |         actions: async ({ page }) => openTab(page, tab),
  929  |     };
  930  | }
  931  | 
  932  | export const SCREENS: readonly Screen[] = [
  933  |     // ── Public ──────────────────────────────────────────────────────────────
  934  |     {
  935  |         id: 'accueil', titre: 'Accueil', role: 'anonyme', needsIds: false, path: () => '/',
  936  |         // Design 1b : rangée « À la une » (choix du Superadmin) ou, sans choix, « Populaires » (ventes récentes du seed,
  937  |         // spreadPurchases), rendue par le serveur
  938  |         ready: async ({ page }) => { await expect(page.getByRole('region', { name: /^(à la une|populaires)/i }).getByRole('link').first()).toBeVisible({ timeout: 30_000 }); },
  939  |     },
  940  |     { id: 'catalogue', titre: 'Catalogue des événements', role: 'anonyme', needsIds: false, path: () => '/explore' },
  941  |     // Design 1b (point 5) : Explorer avec filtres (adresse ?quand=&gratuit=&categorie=), puces aria-pressed, pagination
  942  |     {
  943  |         id: 'explorer-semaine-gratuits', titre: 'Explorer — filtres « Cette semaine » et « Gratuit »', role: 'anonyme', needsIds: false,
  944  |         path: () => '/explore?quand=semaine&gratuit=1',
  945  |         ready: async ({ page }) => { await expect(page.getByRole('button', { name: /^cette semaine$/i })).toHaveAttribute('aria-pressed', 'true', { timeout: 30_000 }); },
  946  |     },
  947  |     {
  948  |         id: 'explorer-concerts', titre: 'Explorer — catégorie « Concerts »', role: 'anonyme', needsIds: false, path: () => '/explore?categorie=CONCERT',
  949  |         ready: async ({ page }) => { await expectHeading(page, /^explorer les événements$/i); },
  950  |     },
  951  |     // ── Design 1d (vitrine) ─────────────────────────────────────────────────
  952  |     // Pastilles de catégories collées en haut pendant le défilement (indicateur sous la pastille choisie)
  953  |     {
  954  |         id: 'explorer-pastilles-collees', titre: 'Explorer — pastilles de catégories collées en haut pendant le défilement', role: 'anonyme', needsIds: false,
  955  |         path: () => '/explore?categorie=CONCERT',
  956  |         ready: async ({ page }) => { await expectHeading(page, /^explorer les événements$/i); },
  957  |         actions: async ({ page }) => {
  958  |             await page.mouse.wheel(0, 900);
  959  |             const chip = page.getByRole('group', { name: /^catégorie$/i }).getByRole('button', { name: /concerts/i });
  960  |             await expect(chip).toBeInViewport();
  961  |             await expect(chip).toHaveAttribute('aria-pressed', 'true');
  962  |         },
  963  |     },
  964  |     // Recherche instantanée : fenêtre ouverte depuis le champ de l'accueil, résultats pendant la saisie
  965  |     {
  966  |         id: 'recherche-instantanee', titre: 'Recherche instantanée — résultats pendant la saisie', role: 'anonyme', needsIds: false, path: () => '/',
  967  |         ready: async ({ page }) => { await expect(page.locator('#accueil-recherche')).toBeVisible({ timeout: 30_000 }); },
  968  |         actions: async ({ page }) => {
  969  |             await page.locator('#accueil-recherche').click();
  970  |             const dialog = page.getByRole('dialog', { name: /^rechercher un événement$/i });
  971  |             await expect(dialog).toBeVisible({ timeout: 30_000 });
  972  |             await dialog.getByRole('searchbox').fill('sabar');
  973  |             await expect(dialog.getByRole('list', { name: /^résultats$/i }).getByRole('link').first()).toBeVisible({ timeout: 30_000 });
  974  |         },
  975  |     },
  976  |     // Recherches récentes gardées sur l'appareil, avec « Effacer »
  977  |     {
  978  |         id: 'recherche-recentes', titre: 'Recherche instantanée — recherches récentes de l’appareil', role: 'anonyme', needsIds: false, path: () => '/',
  979  |         initStorage: { 'event-village:appareil:recherches': JSON.stringify(['sabar', 'jazz', 'Gorée']) },
  980  |         ready: async ({ page }) => { await expect(page.locator('#accueil-recherche')).toBeVisible({ timeout: 30_000 }); },
  981  |         actions: async ({ page }) => {
  982  |             await page.locator('#accueil-recherche').click();
  983  |             const dialog = page.getByRole('dialog', { name: /^rechercher un événement$/i });
> 984  |             await expect(dialog.getByRole('heading', { name: /^recherches récentes$/i })).toBeVisible({ timeout: 30_000 });
       |                                                                                           ^ Error: expect(locator).toBeVisible() failed
  985  |             await expect(dialog.getByRole('button', { name: /^effacer$/i })).toBeVisible();
  986  |         },
  987  |     },
  988  |     // Design 1a : en-tête et logo, composants de base, toasts, fenêtre de confirmation, pages spéciales (vitrine ouverte par
  989  |     // scripts/e2e/start-app.mjs, EV_VITRINE_DESIGN=1 ; données fictives)
  990  |     {
  991  |         id: 'design-composants', titre: 'Design 1a — en-tête, composants de base, repères, squelettes et état vide', role: 'anonyme', needsIds: false,
  992  |         allowFailures: [fakeEventPrefetch('00000000-0000-4000-8000-000000000001')],
  993  |         path: () => '/vitrine-design',
  994  |         ready: async ({ page }) => { await expectHeading(page, /^composants$/i); },
  995  |     },
  996  |     {
  997  |         id: 'design-toasts', titre: 'Design 1a — toasts : réussite, action annulable, erreur qui reste avec « Réessayer »', role: 'anonyme', needsIds: false,
  998  |         allowFailures: [fakeEventPrefetch('00000000-0000-4000-8000-000000000001')],
  999  |         path: () => '/vitrine-design',
  1000 |         ready: async ({ page }) => { await expectHeading(page, /^composants$/i); },
  1001 |         actions: async ({ page }) => {
  1002 |             await page.getByRole('button', { name: /^montrer les toasts$/i }).click();
  1003 |             await expect(page.getByRole('button', { name: /^réessayer$/i })).toBeVisible();
  1004 |             await expect(page.getByRole('button', { name: /^annuler$/i })).toBeVisible();
  1005 |         },
  1006 |     },
  1007 |     {
  1008 |         id: 'design-confirmation', titre: 'Design 1a — confirmation : le bouton dit l’action et le montant', role: 'anonyme', needsIds: false,
  1009 |         allowFailures: [fakeEventPrefetch('00000000-0000-4000-8000-000000000001')],
  1010 |         path: () => '/vitrine-design',
  1011 |         ready: async ({ page }) => { await expectHeading(page, /^composants$/i); },
  1012 |         actions: async ({ page }) => {
  1013 |             await page.getByRole('button', { name: /^ouvrir la confirmation$/i }).click();
  1014 |             await expect(anyDialog(page, /^rembourser ce billet/i)).toBeVisible();
  1015 |         },
  1016 |     },
  1017 |     {
  1018 |         id: 'design-page-introuvable', titre: 'Design 1a — page introuvable', role: 'anonyme', needsIds: false, path: () => '/events/00000000-0000-4000-8000-00000000d1a0',
  1019 |         // Vrai 404 attendu : la page et sa lecture d'API (comparés par URL, e2e/support/network.ts)
  1020 |         expectStatus: 404,
  1021 |         allowFailures: [/\/events\/00000000-0000-4000-8000-00000000d1a0$/, /\/api\/events\/00000000-0000-4000-8000-00000000d1a0(\?.*)?$/],
  1022 |         ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
  1023 |     },
  1024 |     {
  1025 |         id: 'design-erreur', titre: 'Design 1a — page d’erreur (« Quelque chose s’est mal passé de notre côté. »)', role: 'anonyme', needsIds: false,
  1026 |         path: () => '/vitrine-design?erreur=1',
  1027 |         // Erreur volontaire de la vitrine : message générique de Next et empreinte journalisée par app/error.tsx
  1028 |         // Comparés par URL : la page en erreur (500) et les deux journaux attendus, émis par les morceaux de Next
  1029 |         // (erreur du rendu serveur) et de app/error.tsx (empreinte)
  1030 |         allowFailures: [/\/vitrine-design\?erreur=1$/, /\/_next\/static\/chunks\/(?:app\/error-|\d+-)[0-9a-f]+\.js$/],
  1031 |         ready: async ({ page }) => { await expectHeading(page, /^quelque chose s.est mal passé de notre côté\.$/i); },
  1032 |     },
  1033 |     {
  1034 |         id: 'design-hors-ligne', titre: 'Design 1a — page hors ligne (« Vous n’avez pas de réseau. »)', role: 'anonyme', needsIds: false, path: () => '/hors-ligne',
  1035 |         ready: async ({ page }) => { await expectHeading(page, /^vous n.avez pas de réseau\.$/i); },
  1036 |     },
  1037 |     {
  1038 |         id: 'evenement-publie', titre: 'Page publique — événement publié (ce soir)', role: 'anonyme', needsIds: true, path: (i) => `/events/${ids(i).events.ceSoir.id}`, expectStatus: 200,
  1039 |         // Design 1b (point 6) : fiche préparée par le serveur ; billetterie (îlot) prête quand son titre est affiché
  1040 |         ready: async ({ page }) => { await expect(page.getByRole('heading', { name: /^billetterie$/i }).first()).toBeVisible({ timeout: 30_000 }); },
  1041 |     },
  1042 |     // Design 1b (point 11) : « En cours · se termine vers {heure} », calculé sur le téléphone. « ce soir » commence 45 min
  1043 |     // après la graine, pour 5 h : l'horloge de la page est avancée de 2 h (page.clock), dans sa fenêtre.
  1044 |     {
  1045 |         id: 'fiche-en-cours', titre: 'Fiche — événement en cours (« En cours · se termine vers … »)', role: 'anonyme', needsIds: true,
  1046 |         path: (i) => `/events/${ids(i).events.ceSoir.id}`, expectStatus: 200,
  1047 |         // Décision du 18/11 (erreur d'hydratation n° 418, run 401) : trois chargements de suite, heure du téléphone avancée de
  1048 |         // 2 h (événement en cours) ; toute exception de page est bloquante (contrôles de la capture). Badge calculé une fois la
  1049 |         // page chargée dans le navigateur (useLiveNow), jamais au rendu serveur.
  1050 |         actions: async ({ page }) => {
  1051 |             await page.clock.setFixedTime(new Date(Date.now() + 2 * 3600_000));
  1052 |             for (let passage = 1; passage <= 3; passage++) {
  1053 |                 await page.reload();
  1054 |                 await expect(page.getByText(/en cours · se termine vers \d{2}:\d{2}/i).first(), `badge « En cours », chargement ${passage}/3`).toBeVisible({ timeout: 30_000 });
  1055 |             }
  1056 |         },
  1057 |     },
  1058 |     // Design 1b (point 7) : bandeau de paiement en attente sur la fiche, tant que le serveur bloque un nouvel achat
  1059 |     {
  1060 |         id: 'fiche-paiement-en-attente', titre: 'Fiche — paiement déjà en attente (« Suivre le paiement », « Annuler ce paiement »)', role: 'client', needsIds: true,
  1061 |         path: (i) => `/events/${ids(i).events.publieComplet.id}`, expectStatus: 200,
  1062 |         ready: async ({ page }) => {
  1063 |             await expect(page.getByText(/un paiement est déjà en attente pour cet événement/i).first()).toBeVisible({ timeout: 30_000 });
  1064 |             await expect(page.getByRole('button', { name: /^annuler ce paiement$/i }).first()).toBeVisible();
  1065 |         },
  1066 |     },
  1067 |     {
  1068 |         id: 'evenement-suspendu', titre: 'Page publique — événement suspendu (bandeau, sans achat)', role: 'anonyme', needsIds: true,
  1069 |         path: (i) => `/events/${ids(i).events.suspendu.id}`, expectStatus: 200,
  1070 |         ready: async ({ page }) => { await expect(page.getByText(/suspendu/i).first()).toBeVisible(); },
  1071 |     },
  1072 |     {
  1073 |         id: 'evenement-annule', titre: 'Page publique — événement annulé (avis public, remboursement)', role: 'anonyme', needsIds: true,
  1074 |         path: (i) => `/events/${ids(i).events.annule.id}`, expectStatus: 200,
  1075 |         ready: async ({ page }) => { await expect(page.getByText(/annulé/i).first()).toBeVisible(); },
  1076 |     },
  1077 |     {
  1078 |         id: 'evenement-termine', titre: 'Page publique — événement terminé (archive)', role: 'anonyme', needsIds: true,
  1079 |         path: (i) => `/events/${ids(i).events.termine.id}`, expectStatus: 200,
  1080 |         ready: async ({ page }) => { await expect(page.getByText(/terminé/i).first()).toBeVisible(); },
  1081 |     },
  1082 |     {
  1083 |         id: 'evenement-non-public', titre: 'URL d’un brouillon : page introuvable propre', role: 'anonyme', needsIds: true,
  1084 |         path: (i) => `/events/${ids(i).events.brouillon.id}`,
```