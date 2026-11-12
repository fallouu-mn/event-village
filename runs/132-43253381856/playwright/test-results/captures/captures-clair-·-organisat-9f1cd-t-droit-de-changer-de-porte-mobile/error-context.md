# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · organisateur >> partenaire-equipe-portes — Pilotage — Équipe : porte d’un contrôleur et droit de changer de porte
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: deux zones de la graine v4

expect(locator).toHaveCount(expected) failed

Locator:  getByLabel(/^nom de la zone/i)
Expected: 2
Received: 0
Timeout:  15000ms

Call log:
  - deux zones de la graine v4 getByLabel(/^nom de la zone/i) with timeout 15000ms
  - waiting for getByLabel(/^nom de la zone/i)
    34 × locator resolved to 0 elements
       - unexpected value "0"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
            - /url: /
        - generic [ref=e16]:
          - button "Notifications, 99+ non lues" [ref=e18] [cursor=pointer]:
            - generic [ref=e22]: 99+
          - button "Basculer le thème" [ref=e24] [cursor=pointer]
          - link "Mon profil (Mariama Ndiaye)" [ref=e28] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e29]: MN
      - main [ref=e31]:
        - generic [ref=e33]:
          - generic [ref=e34]:
            - link "Mes événements" [ref=e36] [cursor=pointer]:
              - /url: /partner/events
            - generic [ref=e41]:
              - generic [ref=e42]:
                - generic [ref=e43]:
                  - 'generic "Accepté par l’équipe Event Village : l’organisateur peut maintenant le publier." [ref=e44]': Validé
                  - status [ref=e47]: En direct
                - heading "Grande soirée du Monument de la Renaissance" [level=1] [ref=e49]
                - paragraph [ref=e50]:
                  - generic [ref=e51]:
                    - generic [ref=e52]: dim. 15 nov. 2026 à 20:00
                    - generic [ref=e55]: Esplanade du Monument de la Renaissance, Dakar
              - generic [ref=e59]:
                - button "Publier" [ref=e60] [cursor=pointer]
                - link "Modifier" [ref=e66] [cursor=pointer]:
                  - /url: /partner/events/3b9626b4-b018-4930-add9-31a916c9e953/edit
                - button "Annuler l’événement" [ref=e72] [cursor=pointer]
          - generic [ref=e78]:
            - tablist "Rubriques du pilotage" [ref=e81]:
              - tab "Aperçu" [ref=e82] [cursor=pointer]
              - tab "Ventes" [ref=e84] [cursor=pointer]
              - tab "Invitations" [ref=e86] [cursor=pointer]
              - tab "Entrées" [ref=e88] [cursor=pointer]
              - tab "Équipe" [selected] [ref=e90] [cursor=pointer]
              - tab "Caisse" [ref=e92] [cursor=pointer]
              - tab "Clôture" [ref=e94] [cursor=pointer]
            - tabpanel "Équipe" [ref=e96]:
              - generic [ref=e97]:
                - region [ref=e98]:
                  - generic [ref=e100]:
                    - heading "Inviter un contrôleur" [level=2] [ref=e101]
                    - paragraph [ref=e102]: Le contrôleur reçoit un SMS avec son accès au scanner de cet événement.
                  - generic [ref=e103]:
                    - generic [ref=e104]:
                      - generic [ref=e105]:
                        - generic [ref=e106]: Prénom
                        - textbox "Prénom" [ref=e108]
                        - paragraph [ref=e109]: Facultatif
                      - generic [ref=e110]:
                        - generic [ref=e111]: Nom
                        - textbox "Nom" [ref=e113]
                        - paragraph [ref=e114]: Facultatif
                      - generic [ref=e115]:
                        - generic [ref=e117]:
                          - text: Téléphone du contrôleur*
                          - generic [ref=e118]: (obligatoire)
                        - textbox "Téléphone du contrôleur (obligatoire)" [ref=e119]:
                          - /placeholder: 77 123 45 67
                    - generic [ref=e120] [cursor=pointer]:
                      - checkbox "Autoriser l’encaissement en espèces" [ref=e121]
                      - text: Autoriser l’encaissement en espèces
                    - button "Inviter le contrôleur" [disabled] [ref=e123]
                - region [ref=e129]:
                  - generic [ref=e131]:
                    - heading "Zones et portes" [level=2] [ref=e132]
                    - paragraph [ref=e133]: "Sans zone, une seule entrée « Entrée » admet toutes les catégories : rien à régler. Ajoutez des zones pour séparer les accès (carré VIP, backstage)."
                  - generic [ref=e134]:
                    - generic [ref=e140]:
                      - paragraph [ref=e141]: Une seule entrée, toutes les catégories
                      - paragraph [ref=e142]: Tous vos contrôleurs compostent les billets de toutes les catégories.
                    - button "Configurer des zones" [ref=e143] [cursor=pointer]
                  - generic [ref=e151]:
                    - button "Enregistrer les zones" [ref=e152] [cursor=pointer]
                    - button "Annuler les modifications" [ref=e154] [cursor=pointer]
                    - button "Revenir à une seule entrée" [ref=e156] [cursor=pointer]
                - region [ref=e158]:
                  - generic [ref=e160]:
                    - heading "Contrôleurs affectés" [level=2] [ref=e161]
                    - paragraph [ref=e162]: Chaque scan garde le point d’entrée du contrôleur ; la permission espèces vaut pour cette affectation seulement.
                  - list "Contrôleurs affectés" [ref=e163]:
                    - listitem [ref=e164]:
                      - generic [ref=e166]:
                        - paragraph [ref=e167]: Mamadou Sall
                        - paragraph [ref=e168]:
                          - generic [ref=e171]: 70 000 01 10
                        - paragraph [ref=e172]: 0 entrée(s) validée(s)
                      - generic [ref=e173]:
                        - generic [ref=e174]:
                          - generic [ref=e175]:
                            - generic [ref=e176]:
                              - generic [ref=e177]: Porte
                              - combobox "Porte" [ref=e180] [cursor=pointer]:
                                - option "Aucune porte"
                                - option "Porte Nord — Entrée générale" [selected]
                                - option "Porte Sud — Entrée générale"
                                - option "Accès carré — Carré VIP"
                            - button "Enregistrer" [disabled] [ref=e181]
                          - generic [ref=e184]:
                            - generic [ref=e185]:
                              - generic [ref=e186] [cursor=pointer]: Peut changer de porte
                              - paragraph [ref=e187]: Le contrôleur choisit lui-même sa porte dans le scanner.
                            - generic [ref=e188]:
                              - generic [aria-hidden] [ref=e189]: Désactivé
                              - switch "Peut changer de porte" [ref=e190] [cursor=pointer]
                        - switch "Espèces non autorisées" [ref=e193] [cursor=pointer]
                      - generic [ref=e197]:
                        - button "Renvoyer l’invitation par SMS" [ref=e198] [cursor=pointer]
                        - button "Retirer de l’événement" [ref=e204] [cursor=pointer]
    - navigation "Navigation rapide" [ref=e210]:
      - generic [ref=e211]:
        - link "Accueil" [ref=e212] [cursor=pointer]:
          - /url: /partner/dashboard
        - link "Billetterie" [ref=e219] [cursor=pointer]:
          - /url: /partner/events
        - link "Scanner" [ref=e223] [cursor=pointer]:
          - /url: /partner/scan
        - link "Finances" [ref=e231] [cursor=pointer]:
          - /url: /partner/finance
        - link "Profil" [ref=e235] [cursor=pointer]:
          - /url: /partner/profile
  - alert [ref=e240]
```

# Test source

```ts
  606 |         },
  607 |     ],
  608 |     actions: {
  609 |         status: 'SUSPENDU', actions: [{ to: 'TERMINE', label: 'Clore l’événement', reason_required: true }], can_edit: false, can_cancel: false,
  610 |         last_reason: { kind: 'SUSPENSION', reason: 'Lieu fermé par arrêté préfectoral : en attente d’une nouvelle date.', at: '2026-11-01T18:00:00.000Z' },
  611 |     },
  612 |     cancellation: null,
  613 | };
  614 | 
  615 | const ENTRIES_URL = /\/api\/partner\/events\/[^/]+\/pilotage\/entries$/;
  616 | const ENTRIES_GATE_NORD = '00000000-0000-4000-8000-000000000951';
  617 | const ENTRIES_GATE_SUD = '00000000-0000-4000-8000-000000000952';
  618 | const ENTRIES_GATE_CARRE = '00000000-0000-4000-8000-000000000953';
  619 | const ENTRIES_ZONE_GENERALE = '00000000-0000-4000-8000-000000000954';
  620 | const ENTRIES_ZONE_CARRE = '00000000-0000-4000-8000-000000000955';
  621 | /** 30 minutes de débit (heure de Dakar), les 5 dernières à 11 entrées : 2,2 par minute. */
  622 | const ENTRIES_BY_MINUTE = Array.from({ length: 30 }, (_, k) => ({
  623 |     start: `2026-11-07T20:${String(30 + k).padStart(2, '0')}:00`,
  624 |     accepted: k >= 25 ? [2, 3, 2, 2, 2][k - 25] : (k * 3) % 5,
  625 | }));
  626 | /**
  627 |  * PilotageEntries complet d'un événement à zones (D.3.1) : réponse imposée de GET …/pilotage/entries, toutes les clés
  628 |  * actuelles gardées (pilotage_entries) et celles du lot 9 ter (F46, D.1.3). Totaux cohérents : 112 entrées (Porte Nord 64,
  629 |  * Porte Sud 48), 17 refus (zones 14 + 3, motifs 8 + 4 + 3 + 2), 180 attendus (catégories et origines).
  630 |  */
  631 | const ENTRIES_ZONES_STUB = {
  632 |     ok: true, event_id: '00000000-0000-4000-8000-000000000950',
  633 |     total: 112, counter: 4, refused: 17, cash_pending: 0,
  634 |     by_scanner: [
  635 |         { scanner_id: '00000000-0000-4000-8000-000000000961', name: 'Moussa Ndiaye', role: 'CONTROLEUR', entry_point: null, gate: 'Porte Nord', assigned: true, active: true, accepted: 64, refused: 2, incidents: 0, last_activity_at: '2026-11-07T20:58:00.000Z', last_incident_at: null },
  636 |         { scanner_id: '00000000-0000-4000-8000-000000000962', name: 'Aminata Sow', role: 'CONTROLEUR', entry_point: null, gate: 'Porte Sud', assigned: true, active: true, accepted: 48, refused: 12, incidents: 0, last_activity_at: '2026-11-07T20:59:00.000Z', last_incident_at: null },
  637 |         { scanner_id: '00000000-0000-4000-8000-000000000963', name: 'Khady Diouf', role: 'CONTROLEUR', entry_point: null, gate: 'Accès carré', assigned: true, active: true, accepted: 0, refused: 3, incidents: 0, last_activity_at: '2026-11-07T20:57:00.000Z', last_incident_at: null },
  638 |         { scanner_id: '00000000-0000-4000-8000-000000000964', name: 'Cheikh Fall', role: 'CONTROLEUR', entry_point: null, gate: 'Porte Sud', assigned: true, active: false, accepted: 0, refused: 0, incidents: 0, last_activity_at: null, last_incident_at: null },
  639 |     ],
  640 |     by_entry_point: [
  641 |         { entry_point: 'Porte Nord', accepted: 64, refused: 2 },
  642 |         { entry_point: 'Porte Sud', accepted: 48, refused: 12 },
  643 |         { entry_point: 'Accès carré', accepted: 0, refused: 3 },
  644 |     ],
  645 |     by_category: [
  646 |         { category_id: '00000000-0000-4000-8000-000000000971', name: 'SIMPLE', expected: 120, accepted: 70 },
  647 |         { category_id: '00000000-0000-4000-8000-000000000972', name: 'VIP', expected: 45, accepted: 30 },
  648 |         { category_id: '00000000-0000-4000-8000-000000000973', name: 'VVIP', expected: 15, accepted: 12 },
  649 |     ],
  650 |     by_quarter: [
  651 |         { start: '2026-11-07T20:00:00', accepted: 30, refused: 3 },
  652 |         { start: '2026-11-07T20:15:00', accepted: 38, refused: 5 },
  653 |         { start: '2026-11-07T20:30:00', accepted: 26, refused: 6 },
  654 |         { start: '2026-11-07T20:45:00', accepted: 18, refused: 3 },
  655 |     ],
  656 |     refusals_by_reason: [
  657 |         { result: 'invalid', label: 'Billet invalide', count: 8 },
  658 |         { result: 'already_used', label: 'Billet déjà utilisé', count: 4 },
  659 |         { result: 'wrong_zone', label: 'Mauvaise zone', count: 3 },
  660 |         { result: 'not_entered', label: 'Pas encore entré', count: 2 },
  661 |     ],
  662 |     repeated_attempts: [],
  663 |     incidents: [],
  664 |     configured: true,
  665 |     zone_checks: 21,
  666 |     by_zone: [
  667 |         { zone_id: ENTRIES_ZONE_GENERALE, name: 'Entrée générale', kind: 'ENTREE', implicit: false, expected: 180, entered: 112, checked: null, refused: 14 },
  668 |         { zone_id: ENTRIES_ZONE_CARRE, name: 'Carré VIP', kind: 'CONTROLE', implicit: false, expected: 30, entered: null, checked: 21, refused: 3 },
  669 |     ],
  670 |     by_gate: [
  671 |         { gate_key: ENTRIES_GATE_NORD, gate_id: ENTRIES_GATE_NORD, name: 'Porte Nord', zone_id: ENTRIES_ZONE_GENERALE, zone_name: 'Entrée générale', accepted: 64, refused: 2, controllers_assigned: 1, rate_per_minute: 1.4, controllers_active: 1 },
  672 |         { gate_key: ENTRIES_GATE_SUD, gate_id: ENTRIES_GATE_SUD, name: 'Porte Sud', zone_id: ENTRIES_ZONE_GENERALE, zone_name: 'Entrée générale', accepted: 48, refused: 12, controllers_assigned: 2, rate_per_minute: 0.8, controllers_active: 1 },
  673 |         { gate_key: ENTRIES_GATE_CARRE, gate_id: ENTRIES_GATE_CARRE, name: 'Accès carré', zone_id: ENTRIES_ZONE_CARRE, zone_name: 'Carré VIP', accepted: 0, refused: 3, controllers_assigned: 1, rate_per_minute: 0, controllers_active: 1 },
  674 |     ],
  675 |     by_origin: [
  676 |         { origin: 'ONLINE', label: 'En ligne', expected: 160, entered: 98 },
  677 |         { origin: 'COUNTER', label: 'Guichet', expected: 6, entered: 4 },
  678 |         { origin: 'FREE', label: 'Gratuit', expected: 4, entered: 0 },
  679 |         { origin: 'INVITATION', label: 'Invitation', expected: 10, entered: 10 },
  680 |     ],
  681 |     guest_list: {
  682 |         count: 1,
  683 |         items: [{
  684 |             scan_id: '00000000-0000-4000-8000-000000000981', at: '2026-11-07T20:12:00.000Z', category: 'VIP', gate: 'Porte Nord',
  685 |             zone: 'Entrée générale', controller: 'Moussa Ndiaye', guest_name: 'Awa Diop',
  686 |         }],
  687 |     },
  688 |     rate: { window_minutes: 5, per_minute: 2.2, by_minute: ENTRIES_BY_MINUTE },
  689 |     controllers: { window_minutes: 10, assigned: 4, active: 3 },
  690 |     alert_settings: { threshold: 10, minutes: 5 },
  691 |     alerts: [{ gate_key: 'porte-sud', name: 'Porte Sud', zone_name: 'Entrée générale', refused: 12, window_minutes: 5, threshold: 10 }],
  692 |     computed_at: '2026-11-07T21:00:00.000Z',
  693 | };
  694 | 
  695 | /** Onglet Équipe de l'événement à zones de la graine v4 (organisateur ; C.1.4, ZonesEditor au-dessus des contrôleurs). */
  696 | function zonesTeamPath(i: DemoIds | null): string {
  697 |     return `/partner/events/${seedEvent(i, 'zones').id}?tab=equipe`;
  698 | }
  699 | 
  700 | /** Éditeur des zones chargé avec les deux zones et les trois portes de la graine v4 (D.3.2). */
  701 | async function zonesEditorReady(page: Page): Promise<Locator> {
  702 |     await expect(page.getByRole('tab', { name: /^équipe/i })).toHaveAttribute('aria-selected', 'true');
  703 |     const heading = page.getByRole('heading', { name: /^zones et portes$/i });
  704 |     await expect(heading, 'section « Zones et portes » de l’onglet Équipe (C.1.4)').toBeVisible({ timeout: 30_000 });
  705 |     const zoneNames = page.getByLabel(/^nom de la zone/i);
> 706 |     await expect(zoneNames, 'deux zones de la graine v4').toHaveCount(2);
      |                                                           ^ Error: deux zones de la graine v4
  707 |     await expect(zoneNames.nth(0)).toHaveValue('Entrée générale');
  708 |     await expect(zoneNames.nth(1)).toHaveValue('Carré VIP');
  709 |     await expect(page.getByLabel(/^nom de la porte/i), 'trois portes de la graine v4').toHaveCount(3);
  710 |     return heading;
  711 | }
  712 | 
  713 | function tabScreen(id: string, titre: string, tab: RegExp): Screen {
  714 |     return {
  715 |         id, titre, role: 'organisateur', needsIds: true, path: pilotage('ceSoir'),
  716 |         actions: async ({ page }) => openTab(page, tab),
  717 |     };
  718 | }
  719 | 
  720 | export const SCREENS: readonly Screen[] = [
  721 |     // ── Public ──────────────────────────────────────────────────────────────
  722 |     {
  723 |         id: 'accueil', titre: 'Accueil', role: 'anonyme', needsIds: false, path: () => '/',
  724 |         // Lot 9 : section sous « À l'affiche », chargée après la page ; le seed y place des ventes récentes (spreadPurchases)
  725 |         ready: async ({ page }) => { await expect(page.getByRole('region', { name: /^populaires/i }).getByRole('link').first()).toBeVisible({ timeout: 30_000 }); },
  726 |     },
  727 |     { id: 'catalogue', titre: 'Catalogue des événements', role: 'anonyme', needsIds: false, path: () => '/explore' },
  728 |     { id: 'evenement-publie', titre: 'Page publique — événement publié (ce soir)', role: 'anonyme', needsIds: true, path: (i) => `/events/${ids(i).events.ceSoir.id}`, expectStatus: 200 },
  729 |     {
  730 |         id: 'evenement-suspendu', titre: 'Page publique — événement suspendu (bandeau, sans achat)', role: 'anonyme', needsIds: true,
  731 |         path: (i) => `/events/${ids(i).events.suspendu.id}`, expectStatus: 200,
  732 |         ready: async ({ page }) => { await expect(page.getByText(/suspendu/i).first()).toBeVisible(); },
  733 |     },
  734 |     {
  735 |         id: 'evenement-annule', titre: 'Page publique — événement annulé (avis public, remboursement)', role: 'anonyme', needsIds: true,
  736 |         path: (i) => `/events/${ids(i).events.annule.id}`, expectStatus: 200,
  737 |         ready: async ({ page }) => { await expect(page.getByText(/annulé/i).first()).toBeVisible(); },
  738 |     },
  739 |     {
  740 |         id: 'evenement-termine', titre: 'Page publique — événement terminé (archive)', role: 'anonyme', needsIds: true,
  741 |         path: (i) => `/events/${ids(i).events.termine.id}`, expectStatus: 200,
  742 |         ready: async ({ page }) => { await expect(page.getByText(/terminé/i).first()).toBeVisible(); },
  743 |     },
  744 |     {
  745 |         id: 'evenement-non-public', titre: 'URL d’un brouillon : page introuvable propre', role: 'anonyme', needsIds: true,
  746 |         path: (i) => `/events/${ids(i).events.brouillon.id}`,
  747 |         expectStatus: 404, allowFailures: EVENT_404_FAILURES,
  748 |         ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
  749 |     },
  750 |     {
  751 |         id: 'evenement-introuvable', titre: 'URL d’un événement inconnu : vrai 404, page introuvable propre', role: 'anonyme', needsIds: false,
  752 |         path: () => `/events/${UNKNOWN_EVENT_ID}`, expectStatus: 404, allowFailures: EVENT_404_FAILURES,
  753 |         ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
  754 |     },
  755 |     {
  756 |         id: 'evenement-identifiant-invalide', titre: 'URL d’un identifiant qui n’est pas un UUID : vrai 404', role: 'anonyme', needsIds: false,
  757 |         path: () => `/events/${NOT_AN_EVENT_ID}`, views: ['mobile-clair'], expectStatus: 404,
  758 |         allowFailures: [new RegExp(`/api/events/${NOT_AN_EVENT_ID}(\\?.*)?$`), new RegExp(`/events/${NOT_AN_EVENT_ID}$`)],
  759 |         ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
  760 |     },
  761 |     {
  762 |         id: 'fiche-barre-achat', titre: 'Fiche d’un événement — barre d’achat fixe, panier non vide, page défilée', role: 'client', needsIds: true,
  763 |         path: (i) => `/events/${ids(i).events.ceSoir.id}`, views: MOBILE_VIEWS,
  764 |         actions: async ({ page }) => {
  765 |             await page.getByRole('button', { name: /^ajouter un billet standard/i }).click();
  766 |             await expectBuyBarAnchored(page, 'fiche de « ce soir »'); // finit à mi-page : c'est l'état capturé
  767 |         },
  768 |     },
  769 |     {
  770 |         id: 'accueil-acces-refuse', titre: 'Accueil après un accès refusé (message de la redirection)', role: 'client', needsIds: true,
  771 |         path: () => '/?error=unauthorized_admin',
  772 |         ready: async ({ page }) => { await expect(page.getByRole('alert').filter({ hasText: 'Cet espace est réservé aux administrateurs.' })).toBeVisible(); },
  773 |     },
  774 |     {
  775 |         id: 'hors-ligne', titre: 'Indicateur « Hors ligne » (catalogue ouvert, connexion coupée)', role: 'anonyme', needsIds: false, path: () => '/explore',
  776 |         actions: async ({ page, context, guard }) => {
  777 |             guard.freeze();
  778 |             await context.setOffline(true);
  779 |             await expect(page.getByText(/hors ligne/i).first()).toBeVisible({ timeout: 20_000 });
  780 |         },
  781 |     },
  782 |     // ── Authentification (lot 6, 6.0 e) ─────────────────────────────────────
  783 |     {
  784 |         id: 'connexion', titre: 'Connexion (système de design)', role: 'anonyme', needsIds: false, path: () => '/login',
  785 |         ready: async ({ page }) => {
  786 |             await expectHeading(page, /^connexion$/i);
  787 |             await expect(page.getByRole('button', { name: /^se connecter$/i })).toBeVisible();
  788 |         },
  789 |     },
  790 |     {
  791 |         id: 'inscription', titre: 'Inscription (système de design)', role: 'anonyme', needsIds: false, path: () => '/register',
  792 |         ready: async ({ page }) => { await expectHeading(page, /^créer un compte$/i); },
  793 |     },
  794 |     {
  795 |         id: 'mot-de-passe-oublie', titre: 'Mot de passe oublié (système de design)', role: 'anonyme', needsIds: false, path: () => '/forgot-password',
  796 |         ready: async ({ page }) => { await expectHeading(page, /^mot de passe oublié$/i); },
  797 |     },
  798 |     // ── Client ──────────────────────────────────────────────────────────────
  799 |     {
  800 |         id: 'mes-billets', titre: 'Mes billets (QR masqué)', role: 'client', needsIds: true, path: () => '/tickets?tab=a-venir', // A10 : sans onglet, « Reçus » d'office (transfert entrant du seed)
  801 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  802 |     },
  803 |     {
  804 |         id: 'mes-billets-recus', titre: 'Mes billets — onglet « Reçus » (transfert entrant à accepter)', role: 'client', needsIds: true,
  805 |         path: () => '/tickets?tab=recus',
  806 |         ready: async ({ page }) => {
```