# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · anonyme >> design-toasts — Design 1a — toasts : réussite, action annulable, erreur qui reste avec « Réessayer »
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /^annuler$/i })
Expected: visible
Error: strict mode violation: getByRole('button', { name: /^annuler$/i }) resolved to 2 elements:
    1) <button class="inline-flex items-center justify-center gap-2 font-semibold cursor-pointer select-none transition-[background-color,border-color,color,filter,transform] duration-fast ease-standard motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background min-h-11 px-4 text-sm rounded-xl bg-card text-foreground-strong hover:bg-muted border border-…>…</button> aka getByRole('main').getByRole('button', { name: 'Annuler' })
    2) <button type="button" class="min-h-11 flex-shrink-0 rounded-lg px-3 text-sm font-bold text-primary-text hover:bg-primary-soft">Annuler</button> aka getByRole('button', { name: 'Annuler' }).nth(1)

Call log:
  - Expect "toBeVisible" getByRole('button', { name: /^annuler$/i }) with timeout 15000ms
  - waiting for getByRole('button', { name: /^annuler$/i })

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
          - button "Notifications" [ref=e15] [cursor=pointer]
          - button "Basculer le thème" [ref=e20] [cursor=pointer]
          - link "Se connecter" [ref=e24] [cursor=pointer]:
            - /url: /login
      - main [ref=e28]:
        - generic [ref=e30]:
          - heading "Composants" [level=1] [ref=e31]
          - region [ref=e32]:
            - heading "Boutons" [level=2] [ref=e33]
            - generic [ref=e34]:
              - button "Enregistrer" [ref=e35] [cursor=pointer]
              - button "Annuler" [ref=e37] [cursor=pointer]
              - button "Voir le programme" [ref=e39] [cursor=pointer]
              - button "Plus tard" [ref=e41] [cursor=pointer]
              - button "Rembourser 10 000 F CFA" [ref=e43] [cursor=pointer]
            - button "Choisir mes billets" [ref=e45] [cursor=pointer]
          - region [ref=e47]:
            - heading "Champs" [level=2] [ref=e48]
            - generic [ref=e49]:
              - generic [ref=e50]: Nom complet
              - textbox "Nom complet" [ref=e52]: Awa Ndiaye
              - paragraph [ref=e53]: Tel qu’il figure sur votre pièce d’identité.
            - generic [ref=e54]:
              - generic [ref=e56]:
                - text: Numéro de téléphone*
                - generic [ref=e57]: (obligatoire)
              - textbox "Numéro de téléphone (obligatoire)" [invalid] [ref=e58]: 77 12
              - paragraph [ref=e59]:
                - generic [ref=e62]: Saisissez les 9 chiffres de votre numéro.
          - region [ref=e63]:
            - heading "Cartes" [level=2] [ref=e64]
            - generic [ref=e65]:
              - generic [ref=e66]:
                - paragraph [ref=e67]: Recettes en ligne nettes
                - paragraph [ref=e68]: 245 000 F CFA
              - article [ref=e69]:
                - generic [ref=e71]:
                  - generic [ref=e72]:
                    - generic [aria-hidden] [ref=e73]:
                      - generic [ref=e74]: "20"
                      - generic [ref=e75]: déc.
                    - heading [level=3] [ref=e77]:
                      - link "Festival des lumières de Saint-Louis" [ref=e78] [cursor=pointer]:
                        - /url: /events/00000000-0000-4000-8000-000000000001
                  - generic [ref=e79]:
                    - generic [ref=e80]: Dernières places
                    - generic [ref=e82]: Concert
                  - list [ref=e84]:
                    - listitem [ref=e85]:
                      - generic [ref=e88]: samedi 20 décembre à 20 h 00
                    - listitem [ref=e89]:
                      - generic [ref=e93]: Saint-Louis · Place Faidherbe
                  - generic [ref=e95]:
                    - paragraph [ref=e96]: À partir de
                    - paragraph [ref=e97]: 10 000 F CFA
          - region [ref=e110]:
            - heading "Onglets, pastilles et filtres" [level=2] [ref=e111]
            - tablist "Sections de l’événement" [ref=e113]:
              - tab "Programme" [selected] [ref=e114] [cursor=pointer]
              - tab "Billets , 3" [ref=e116] [cursor=pointer]:
                - generic [ref=e117]: Billets
                - generic [ref=e118]:
                  - generic [ref=e119]: ","
                  - text: "3"
              - tab "Lieu" [ref=e120] [cursor=pointer]
            - generic [ref=e122]:
              - generic [ref=e123]: Gratuit
              - generic [ref=e125]: Dernières places
              - generic [ref=e127]: Complet
              - generic [ref=e129]: Nouveau
              - generic [ref=e131]: Brouillon
            - generic [ref=e133]:
              - button "Concerts" [pressed] [ref=e134] [cursor=pointer]:
                - generic [aria-hidden] [ref=e135]: ✓
                - text: Concerts
              - button "Gratuit" [ref=e136] [cursor=pointer]
              - button "Cette semaine" [ref=e137] [cursor=pointer]
          - region [ref=e138]:
            - heading "Retours et fenêtres" [level=2] [ref=e139]
            - generic [ref=e140]:
              - button "Montrer les toasts" [active] [ref=e141] [cursor=pointer]
              - button "Ouvrir la confirmation" [ref=e143] [cursor=pointer]
          - region [ref=e145]:
            - heading "Chargement et état vide" [level=2] [ref=e146]
            - generic [ref=e167]:
              - heading "Aucun événement cette semaine" [level=3] [ref=e173]
              - paragraph [ref=e174]: Élargissez la recherche à tout le mois ou à une autre ville.
              - button "Voir tout le mois" [ref=e175] [cursor=pointer]
          - region [ref=e177]:
            - heading "Repères de la carte" [level=2] [ref=e178]
            - generic [ref=e179]:
              - img "10 000 F" [ref=e180]
              - img "Gratuit" [ref=e184]
              - img "Événement choisi, 5 000 F" [ref=e188]:
                - generic [ref=e189]: 5 000 F
              - img "À la une" [ref=e192]
              - img "3 événements" [ref=e196]
          - region [ref=e199]:
            - generic [ref=e202]:
              - heading "12 événements autour de vous" [level=2] [ref=e203]
              - button "Tout afficher" [ref=e204] [cursor=pointer]
    - navigation "Navigation rapide" [ref=e205]:
      - generic [ref=e206]:
        - link "Accueil" [ref=e207] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e212] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e217] [cursor=pointer]:
          - /url: /tickets
        - link "Portefeuille" [ref=e221] [cursor=pointer]:
          - /url: /wallet
  - generic:
    - status [ref=e226]:
      - generic [ref=e231]:
        - paragraph [ref=e232]: C’est fait
        - paragraph [ref=e233]: Billet transféré à Awa Ndiaye.
      - button "Fermer le message" [ref=e234] [cursor=pointer]
    - status [ref=e239]:
      - generic [ref=e244]:
        - paragraph [ref=e245]: C’est fait
        - paragraph [ref=e246]: Événement retiré de vos favoris.
      - button "Annuler" [ref=e247] [cursor=pointer]
      - button "Fermer le message" [ref=e248] [cursor=pointer]
    - alert [ref=e253]:
      - generic [ref=e259]:
        - paragraph [ref=e260]: Erreur
        - paragraph [ref=e261]: Le chargement a échoué. Vérifiez votre connexion.
      - button "Réessayer" [ref=e262] [cursor=pointer]
      - button "Fermer le message" [ref=e263] [cursor=pointer]
  - alert [ref=e268]
```

# Test source

```ts
  794 |     refusals_by_reason: [
  795 |         { result: 'invalid', label: 'Billet invalide', count: 8 },
  796 |         { result: 'already_used', label: 'Billet déjà utilisé', count: 4 },
  797 |         { result: 'wrong_zone', label: 'Mauvaise zone', count: 3 },
  798 |         { result: 'not_entered', label: 'Pas encore entré', count: 2 },
  799 |     ],
  800 |     repeated_attempts: [],
  801 |     incidents: [],
  802 |     configured: true,
  803 |     zone_checks: 21,
  804 |     by_zone: [
  805 |         { zone_id: ENTRIES_ZONE_GENERALE, name: 'Entrée générale', kind: 'ENTREE', implicit: false, expected: 180, entered: 112, checked: null, refused: 14 },
  806 |         { zone_id: ENTRIES_ZONE_CARRE, name: 'Carré VIP', kind: 'CONTROLE', implicit: false, expected: 30, entered: null, checked: 21, refused: 3 },
  807 |     ],
  808 |     by_gate: [
  809 |         { gate_key: ENTRIES_GATE_NORD, gate_id: ENTRIES_GATE_NORD, name: 'Porte Nord', zone_id: ENTRIES_ZONE_GENERALE, zone_name: 'Entrée générale', accepted: 64, refused: 2, controllers_assigned: 1, rate_per_minute: 1.4, controllers_active: 1 },
  810 |         { gate_key: ENTRIES_GATE_SUD, gate_id: ENTRIES_GATE_SUD, name: 'Porte Sud', zone_id: ENTRIES_ZONE_GENERALE, zone_name: 'Entrée générale', accepted: 48, refused: 12, controllers_assigned: 2, rate_per_minute: 0.8, controllers_active: 1 },
  811 |         { gate_key: ENTRIES_GATE_CARRE, gate_id: ENTRIES_GATE_CARRE, name: 'Accès carré', zone_id: ENTRIES_ZONE_CARRE, zone_name: 'Carré VIP', accepted: 0, refused: 3, controllers_assigned: 1, rate_per_minute: 0, controllers_active: 1 },
  812 |     ],
  813 |     by_origin: [
  814 |         { origin: 'ONLINE', label: 'En ligne', expected: 160, entered: 98 },
  815 |         { origin: 'COUNTER', label: 'Guichet', expected: 6, entered: 4 },
  816 |         { origin: 'FREE', label: 'Gratuit', expected: 4, entered: 0 },
  817 |         { origin: 'INVITATION', label: 'Invitation', expected: 10, entered: 10 },
  818 |     ],
  819 |     guest_list: {
  820 |         count: 1,
  821 |         items: [{
  822 |             scan_id: '00000000-0000-4000-8000-000000000981', at: '2026-11-07T20:12:00.000Z', category: 'VIP', gate: 'Porte Nord',
  823 |             zone: 'Entrée générale', controller: 'Moussa Ndiaye', guest_name: 'Awa Diop',
  824 |         }],
  825 |     },
  826 |     rate: { window_minutes: 5, per_minute: 2.2, by_minute: ENTRIES_BY_MINUTE },
  827 |     controllers: { window_minutes: 10, assigned: 4, active: 3 },
  828 |     alert_settings: { threshold: 10, minutes: 5 },
  829 |     alerts: [{ gate_key: 'porte-sud', name: 'Porte Sud', zone_name: 'Entrée générale', refused: 12, window_minutes: 5, threshold: 10 }],
  830 |     computed_at: '2026-11-07T21:00:00.000Z',
  831 | };
  832 | 
  833 | /** Onglet Équipe de l'événement à zones de la graine v4 (organisateur). */
  834 | function zonesTeamPath(i: DemoIds | null): string {
  835 |     return `/partner/events/${seedEvent(i, 'zones').id}?tab=equipe`;
  836 | }
  837 | 
  838 | /**
  839 |  * Finition 2b (B, E-23) : étape « Contrôle à l'entrée » du formulaire de modification de l'événement à zones de la graine
  840 |  * v4 (cible de « Modifier les portes et les couleurs ») ; l'éditeur des zones a quitté l'onglet Équipe.
  841 |  */
  842 | function zonesStepPath(i: DemoIds | null): string {
  843 |     return `/partner/events/${seedEvent(i, 'zones').id}/edit?etape=controle`;
  844 | }
  845 | 
  846 | /** Onglet Équipe ouvert (?tab=equipe). */
  847 | async function teamTabReady(page: Page): Promise<void> {
  848 |     await expect(page.getByRole('tab', { name: /^équipe/i })).toHaveAttribute('aria-selected', 'true', { timeout: 30_000 });
  849 | }
  850 | 
  851 | /** Éditeur des zones chargé avec les deux zones et les trois portes de la graine v4 (D.3.2), à l'étape du formulaire. */
  852 | async function zonesEditorReady(page: Page): Promise<Locator> {
  853 |     await expect(page.getByRole('heading', { name: /^contrôle à l.entrée \(facultatif\)$/i }), 'étape « Contrôle à l’entrée » ouverte')
  854 |         .toBeVisible({ timeout: 30_000 });
  855 |     const heading = page.getByRole('heading', { name: /^zones et portes$/i });
  856 |     await expect(heading, 'section « Zones et portes » de l’étape « Contrôle à l’entrée »').toBeVisible({ timeout: 30_000 });
  857 |     const zoneNames = page.getByLabel(/^nom de la zone/i);
  858 |     await expect(zoneNames, 'deux zones de la graine v4').toHaveCount(2);
  859 |     await expect(zoneNames.nth(0)).toHaveValue('Entrée générale');
  860 |     await expect(zoneNames.nth(1)).toHaveValue('Carré VIP');
  861 |     await expect(page.getByLabel(/^nom de la porte/i), 'trois portes de la graine v4').toHaveCount(3);
  862 |     return heading;
  863 | }
  864 | 
  865 | function tabScreen(id: string, titre: string, tab: RegExp): Screen {
  866 |     return {
  867 |         id, titre, role: 'organisateur', needsIds: true, path: pilotage('ceSoir'),
  868 |         actions: async ({ page }) => openTab(page, tab),
  869 |     };
  870 | }
  871 | 
  872 | export const SCREENS: readonly Screen[] = [
  873 |     // ── Public ──────────────────────────────────────────────────────────────
  874 |     {
  875 |         id: 'accueil', titre: 'Accueil', role: 'anonyme', needsIds: false, path: () => '/',
  876 |         // Lot 9 : section sous « À l'affiche », chargée après la page ; le seed y place des ventes récentes (spreadPurchases)
  877 |         ready: async ({ page }) => { await expect(page.getByRole('region', { name: /^populaires/i }).getByRole('link').first()).toBeVisible({ timeout: 30_000 }); },
  878 |     },
  879 |     { id: 'catalogue', titre: 'Catalogue des événements', role: 'anonyme', needsIds: false, path: () => '/explore' },
  880 |     // Design 1a : en-tête et logo, composants de base, toasts, fenêtre de confirmation, pages spéciales (vitrine ouverte par
  881 |     // scripts/e2e/start-app.mjs, EV_VITRINE_DESIGN=1 ; données fictives)
  882 |     {
  883 |         id: 'design-composants', titre: 'Design 1a — en-tête, composants de base, repères, squelettes et état vide', role: 'anonyme', needsIds: false,
  884 |         path: () => '/vitrine-design',
  885 |         ready: async ({ page }) => { await expectHeading(page, /^composants$/i); },
  886 |     },
  887 |     {
  888 |         id: 'design-toasts', titre: 'Design 1a — toasts : réussite, action annulable, erreur qui reste avec « Réessayer »', role: 'anonyme', needsIds: false,
  889 |         path: () => '/vitrine-design',
  890 |         ready: async ({ page }) => { await expectHeading(page, /^composants$/i); },
  891 |         actions: async ({ page }) => {
  892 |             await page.getByRole('button', { name: /^montrer les toasts$/i }).click();
  893 |             await expect(page.getByRole('button', { name: /^réessayer$/i })).toBeVisible();
> 894 |             await expect(page.getByRole('button', { name: /^annuler$/i })).toBeVisible();
      |                                                                            ^ Error: expect(locator).toBeVisible() failed
  895 |         },
  896 |     },
  897 |     {
  898 |         id: 'design-confirmation', titre: 'Design 1a — confirmation : le bouton dit l’action et le montant', role: 'anonyme', needsIds: false,
  899 |         path: () => '/vitrine-design',
  900 |         ready: async ({ page }) => { await expectHeading(page, /^composants$/i); },
  901 |         actions: async ({ page }) => {
  902 |             await page.getByRole('button', { name: /^ouvrir la confirmation$/i }).click();
  903 |             await expect(anyDialog(page, /^rembourser ce billet/i)).toBeVisible();
  904 |         },
  905 |     },
  906 |     {
  907 |         id: 'design-page-introuvable', titre: 'Design 1a — page introuvable', role: 'anonyme', needsIds: false, path: () => '/evenements-qui-n-existent-pas',
  908 |         allowFailures: [/404/],
  909 |         ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
  910 |     },
  911 |     {
  912 |         id: 'design-erreur', titre: 'Design 1a — page d’erreur (« Quelque chose s’est mal passé de notre côté. »)', role: 'anonyme', needsIds: false,
  913 |         path: () => '/vitrine-design?erreur=1',
  914 |         allowFailures: [/500|vitrine/i],
  915 |         ready: async ({ page }) => { await expectHeading(page, /^quelque chose s.est mal passé de notre côté\.$/i); },
  916 |     },
  917 |     {
  918 |         id: 'design-hors-ligne', titre: 'Design 1a — page hors ligne (« Vous n’avez pas de réseau. »)', role: 'anonyme', needsIds: false, path: () => '/hors-ligne',
  919 |         ready: async ({ page }) => { await expectHeading(page, /^vous n.avez pas de réseau\.$/i); },
  920 |     },
  921 |     { id: 'evenement-publie', titre: 'Page publique — événement publié (ce soir)', role: 'anonyme', needsIds: true, path: (i) => `/events/${ids(i).events.ceSoir.id}`, expectStatus: 200 },
  922 |     {
  923 |         id: 'evenement-suspendu', titre: 'Page publique — événement suspendu (bandeau, sans achat)', role: 'anonyme', needsIds: true,
  924 |         path: (i) => `/events/${ids(i).events.suspendu.id}`, expectStatus: 200,
  925 |         ready: async ({ page }) => { await expect(page.getByText(/suspendu/i).first()).toBeVisible(); },
  926 |     },
  927 |     {
  928 |         id: 'evenement-annule', titre: 'Page publique — événement annulé (avis public, remboursement)', role: 'anonyme', needsIds: true,
  929 |         path: (i) => `/events/${ids(i).events.annule.id}`, expectStatus: 200,
  930 |         ready: async ({ page }) => { await expect(page.getByText(/annulé/i).first()).toBeVisible(); },
  931 |     },
  932 |     {
  933 |         id: 'evenement-termine', titre: 'Page publique — événement terminé (archive)', role: 'anonyme', needsIds: true,
  934 |         path: (i) => `/events/${ids(i).events.termine.id}`, expectStatus: 200,
  935 |         ready: async ({ page }) => { await expect(page.getByText(/terminé/i).first()).toBeVisible(); },
  936 |     },
  937 |     {
  938 |         id: 'evenement-non-public', titre: 'URL d’un brouillon : page introuvable propre', role: 'anonyme', needsIds: true,
  939 |         path: (i) => `/events/${ids(i).events.brouillon.id}`,
  940 |         expectStatus: 404, allowFailures: EVENT_404_FAILURES,
  941 |         ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
  942 |     },
  943 |     {
  944 |         id: 'evenement-introuvable', titre: 'URL d’un événement inconnu : vrai 404, page introuvable propre', role: 'anonyme', needsIds: false,
  945 |         path: () => `/events/${UNKNOWN_EVENT_ID}`, expectStatus: 404, allowFailures: EVENT_404_FAILURES,
  946 |         ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
  947 |     },
  948 |     {
  949 |         id: 'evenement-identifiant-invalide', titre: 'URL d’un identifiant qui n’est pas un UUID : vrai 404', role: 'anonyme', needsIds: false,
  950 |         path: () => `/events/${NOT_AN_EVENT_ID}`, views: ['mobile-clair'], expectStatus: 404,
  951 |         allowFailures: [new RegExp(`/api/events/${NOT_AN_EVENT_ID}(\\?.*)?$`), new RegExp(`/events/${NOT_AN_EVENT_ID}$`)],
  952 |         ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
  953 |     },
  954 |     {
  955 |         id: 'fiche-barre-achat', titre: 'Fiche d’un événement — barre d’achat fixe, panier non vide, page défilée', role: 'client', needsIds: true,
  956 |         path: (i) => `/events/${ids(i).events.ceSoir.id}`, views: MOBILE_VIEWS,
  957 |         actions: async ({ page }) => {
  958 |             await page.getByRole('button', { name: /^ajouter un billet standard/i }).click();
  959 |             await expectBuyBarAnchored(page, 'fiche de « ce soir »'); // finit à mi-page : c'est l'état capturé
  960 |         },
  961 |     },
  962 |     {
  963 |         id: 'accueil-acces-refuse', titre: 'Accueil après un accès refusé (message de la redirection)', role: 'client', needsIds: true,
  964 |         path: () => '/?error=unauthorized_admin',
  965 |         ready: async ({ page }) => { await expect(page.getByRole('alert').filter({ hasText: 'Cet espace est réservé aux administrateurs.' })).toBeVisible(); },
  966 |     },
  967 |     {
  968 |         id: 'hors-ligne', titre: 'Indicateur « Hors ligne » (catalogue ouvert, connexion coupée)', role: 'anonyme', needsIds: false, path: () => '/explore',
  969 |         actions: async ({ page, context, guard }) => {
  970 |             guard.freeze();
  971 |             await context.setOffline(true);
  972 |             await expect(page.getByText(/hors ligne/i).first()).toBeVisible({ timeout: 20_000 });
  973 |         },
  974 |     },
  975 |     // ── Authentification (lot 6, 6.0 e) ─────────────────────────────────────
  976 |     {
  977 |         id: 'connexion', titre: 'Connexion (système de design)', role: 'anonyme', needsIds: false, path: () => '/login',
  978 |         ready: async ({ page }) => {
  979 |             await expectHeading(page, /^connexion$/i);
  980 |             await expect(page.getByRole('button', { name: /^se connecter$/i })).toBeVisible();
  981 |         },
  982 |     },
  983 |     {
  984 |         id: 'inscription', titre: 'Inscription (système de design)', role: 'anonyme', needsIds: false, path: () => '/register',
  985 |         ready: async ({ page }) => { await expectHeading(page, /^créer un compte$/i); },
  986 |     },
  987 |     {
  988 |         id: 'mot-de-passe-oublie', titre: 'Mot de passe oublié (système de design)', role: 'anonyme', needsIds: false, path: () => '/forgot-password',
  989 |         ready: async ({ page }) => { await expectHeading(page, /^mot de passe oublié$/i); },
  990 |     },
  991 |     // ── Client ──────────────────────────────────────────────────────────────
  992 |     {
  993 |         id: 'mes-billets', titre: 'Mes billets (QR masqué)', role: 'client', needsIds: true, path: () => '/tickets?tab=a-venir', // A10 : sans onglet, « Reçus » d'office (transfert entrant du seed)
  994 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
```