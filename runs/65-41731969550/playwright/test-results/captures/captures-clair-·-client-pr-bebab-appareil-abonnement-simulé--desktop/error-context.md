# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · client >> preferences-push-active — Préférences de notification — push activé sur l’appareil (abonnement simulé)
- Location: e2e/captures.spec.ts:90:21

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: response.text: Test timeout of 120000ms exceeded.
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
          - paragraph [ref=e16]: Menu principal
          - generic [ref=e17]:
            - link "Accueil" [ref=e18] [cursor=pointer]:
              - /url: /
            - link "Explorer" [ref=e23] [cursor=pointer]:
              - /url: /explore
            - link "Mes billets" [ref=e28] [cursor=pointer]:
              - /url: /tickets
            - link "Commandes" [ref=e32] [cursor=pointer]:
              - /url: /orders
            - link "Portefeuille" [ref=e37] [cursor=pointer]:
              - /url: /wallet
        - generic [ref=e42]:
          - paragraph [ref=e43]: Services et espaces
          - generic [ref=e44]:
            - link "Salles de fête" [ref=e45] [cursor=pointer]:
              - /url: /halls
            - link "Restaurants et tables" [ref=e51] [cursor=pointer]:
              - /url: /restaurants/rest-terrou-bi/tables
        - generic [ref=e56]:
          - paragraph [ref=e57]: Espaces métier
          - link "Devenir partenaire" [ref=e59] [cursor=pointer]:
            - /url: /partner/register
      - generic [ref=e65]:
        - link "Fatou Mbaye Client" [ref=e66] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e67]: FM
          - generic [ref=e68]:
            - generic [ref=e69]: Fatou Mbaye
            - generic [ref=e70]: Client
        - generic [ref=e71]:
          - button "Se déconnecter" [ref=e72] [cursor=pointer]
          - button "Basculer le thème" [ref=e77] [cursor=pointer]
    - generic [ref=e81]:
      - banner [ref=e82]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e84] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 7 non lues" [ref=e91] [cursor=pointer]:
          - generic [ref=e95]: "7"
      - main [ref=e96]:
        - generic [ref=e98]:
          - generic [ref=e99]:
            - link "Mon profil" [ref=e101] [cursor=pointer]:
              - /url: /profile
            - generic [ref=e107]:
              - heading "Préférences de notification" [level=1] [ref=e108]
              - paragraph [ref=e109]: Choisissez comment Event Village vous prévient. Les messages indispensables partent toujours.
          - region [ref=e110]:
            - heading "Sur cet appareil" [level=2] [ref=e111]
            - status [ref=e114]:
              - generic [ref=e121]:
                - paragraph [ref=e122]: Activées sur cet appareil
                - paragraph [ref=e123]: Rappels, transferts et changements d’événement s’affichent ici, même quand l’application est fermée.
            - generic [ref=e124]:
              - button "Envoyer une notification d'essai" [ref=e125] [cursor=pointer]
              - button "Désactiver" [ref=e131] [cursor=pointer]
          - region [ref=e133]:
            - generic [ref=e134]:
              - heading "Vous choisissez" [level=2] [ref=e135]
              - paragraph [ref=e136]: Pour chaque sujet, activez ou coupez un canal. Un canal coupé n’envoie plus rien sur ce sujet ; vous gardez les autres.
            - region [ref=e137]:
              - generic [ref=e144]:
                - heading "Rappels avant l’événement" [level=3] [ref=e145]
                - paragraph [ref=e146]: La veille et quelques heures avant le début d’un événement dont vous avez un billet (et, pour un contrôleur, la veille de chaque affectation).
              - list [ref=e147]:
                - listitem [ref=e148]:
                  - generic [ref=e150]:
                    - generic [ref=e151]: Application
                    - generic [ref=e153]:
                      - generic [aria-hidden] [ref=e154]: Activé
                      - switch "Application" [checked] [ref=e155] [cursor=pointer]
                - listitem [ref=e158]:
                  - generic [ref=e160]:
                    - generic [ref=e161]: SMS
                    - generic [ref=e163]:
                      - generic [aria-hidden] [ref=e164]: Désactivé
                      - switch "SMS" [ref=e165] [cursor=pointer]
                - listitem [ref=e168]:
                  - generic [ref=e170]:
                    - generic [ref=e171]: Email
                    - generic [ref=e173]:
                      - generic [aria-hidden] [ref=e174]: Activé
                      - switch "Email" [checked] [ref=e175] [cursor=pointer]
                - listitem [ref=e178]:
                  - generic [ref=e180]:
                    - generic [ref=e181]: Notifications push
                    - generic [ref=e183]:
                      - generic [aria-hidden] [ref=e184]: Activé
                      - switch "Notifications push" [checked] [ref=e185] [cursor=pointer]
            - region [ref=e188]:
              - generic [ref=e196]:
                - heading "Changements d’un événement" [level=3] [ref=e197]
                - paragraph [ref=e198]: Nouvelle date, nouveau lieu, suspension ou reprise d’un événement dont vous avez un billet.
              - list [ref=e199]:
                - listitem [ref=e200]:
                  - generic [ref=e202]:
                    - generic [ref=e203]: Application
                    - generic [ref=e205]:
                      - generic [aria-hidden] [ref=e206]: Activé
                      - switch "Application" [checked] [ref=e207] [cursor=pointer]
                - listitem [ref=e210]:
                  - generic [ref=e212]:
                    - generic [ref=e213]: SMS
                    - generic [ref=e215]:
                      - generic [aria-hidden] [ref=e216]: Activé
                      - switch "SMS" [checked] [ref=e217] [cursor=pointer]
                - listitem [ref=e220]:
                  - generic [ref=e222]:
                    - generic [ref=e223]: Email
                    - generic [ref=e225]:
                      - generic [aria-hidden] [ref=e226]: Activé
                      - switch "Email" [checked] [ref=e227] [cursor=pointer]
                - listitem [ref=e230]:
                  - generic [ref=e232]:
                    - generic [ref=e233]: Notifications push
                    - generic [ref=e235]:
                      - generic [aria-hidden] [ref=e236]: Activé
                      - switch "Notifications push" [checked] [ref=e237] [cursor=pointer]
          - region [ref=e240]:
            - generic [ref=e246]:
              - heading "Toujours envoyées" [level=2] [ref=e247]
              - paragraph [ref=e248]: "Ces messages protègent votre compte, votre argent et vos billets : ils ne se désactivent pas."
            - list [ref=e249]:
              - listitem [ref=e250]: Codes de connexion
              - listitem [ref=e254]: Confirmations d’achat et reçus
              - listitem [ref=e258]: Billets transférés
              - listitem [ref=e262]: Annulations
              - listitem [ref=e266]: Remboursements
              - listitem [ref=e270]: Sécurité du compte
  - alert [ref=e274]
```

# Test source

```ts
  75  | async function fakePushCounters(page: Page): Promise<FakePushCounters> {
  76  |     const counters = await page.evaluate(() => (window as unknown as { __evFakePush?: FakePushCounters }).__evFakePush ?? null);
  77  |     if (!counters) throw new Error('[e2e] push simulé absent de la page (script d’initialisation fake-push.ts non chargé)');
  78  |     return counters;
  79  | }
  80  | 
  81  | /** Page des préférences chargée (section « Vous choisissez ») et état du push sur l'appareil affiché. */
  82  | async function preferencesReady(page: Page, deviceState: RegExp): Promise<void> {
  83  |     await expectHeading(page, /^préférences de notification$/i);
  84  |     await expect(page.getByRole('heading', { name: /^vous choisissez$/i })).toBeVisible();
  85  |     await expect(page.getByText(deviceState).first()).toBeVisible();
  86  | }
  87  | 
  88  | /** Aucune demande d'autorisation au chargement de la page (contrat F4 : seulement après un geste). */
  89  | async function expectNoPermissionPrompt(page: Page): Promise<void> {
  90  |     const counters = await fakePushCounters(page);
  91  |     expect(counters.requestPermissionCalls, 'demandes d’autorisation des notifications au chargement').toBe(0);
  92  | }
  93  | 
  94  | function tabScreen(id: string, titre: string, tab: RegExp): Screen {
  95  |     return {
  96  |         id, titre, role: 'organisateur', needsIds: true, path: pilotage('ceSoir'),
  97  |         actions: async ({ page }) => openTab(page, tab),
  98  |     };
  99  | }
  100 | 
  101 | export const SCREENS: readonly Screen[] = [
  102 |     // ── Public ──────────────────────────────────────────────────────────────
  103 |     { id: 'accueil', titre: 'Accueil', role: 'anonyme', needsIds: false, path: () => '/' },
  104 |     { id: 'catalogue', titre: 'Catalogue des événements', role: 'anonyme', needsIds: false, path: () => '/explore' },
  105 |     { id: 'evenement-publie', titre: 'Page publique — événement publié (ce soir)', role: 'anonyme', needsIds: true, path: (i) => `/events/${ids(i).events.ceSoir.id}` },
  106 |     {
  107 |         id: 'evenement-suspendu', titre: 'Page publique — événement suspendu (bandeau, sans achat)', role: 'anonyme', needsIds: true,
  108 |         path: (i) => `/events/${ids(i).events.suspendu.id}`,
  109 |         ready: async ({ page }) => { await expect(page.getByText(/suspendu/i).first()).toBeVisible(); },
  110 |     },
  111 |     {
  112 |         id: 'evenement-annule', titre: 'Page publique — événement annulé (avis public, remboursement)', role: 'anonyme', needsIds: true,
  113 |         path: (i) => `/events/${ids(i).events.annule.id}`,
  114 |         ready: async ({ page }) => { await expect(page.getByText(/annulé/i).first()).toBeVisible(); },
  115 |     },
  116 |     {
  117 |         id: 'evenement-termine', titre: 'Page publique — événement terminé (archive)', role: 'anonyme', needsIds: true,
  118 |         path: (i) => `/events/${ids(i).events.termine.id}`,
  119 |         ready: async ({ page }) => { await expect(page.getByText(/terminé/i).first()).toBeVisible(); },
  120 |     },
  121 |     {
  122 |         id: 'evenement-non-public', titre: 'URL d’un brouillon : page introuvable propre', role: 'anonyme', needsIds: true,
  123 |         path: (i) => `/events/${ids(i).events.brouillon.id}`,
  124 |         allowFailures: [new RegExp(`/api/events/${UUID}(\\?.*)?$`), new RegExp(`/events/${UUID}$`)],
  125 |         ready: async ({ page }) => { await expect(page.getByText(/introuvable|n[’']existe pas|404/i).first()).toBeVisible(); },
  126 |     },
  127 |     {
  128 |         id: 'hors-ligne', titre: 'Indicateur « Hors ligne » (catalogue ouvert, connexion coupée)', role: 'anonyme', needsIds: false, path: () => '/explore',
  129 |         actions: async ({ page, context, guard }) => {
  130 |             guard.freeze();
  131 |             await context.setOffline(true);
  132 |             await expect(page.getByText(/hors ligne/i).first()).toBeVisible({ timeout: 20_000 });
  133 |         },
  134 |     },
  135 |     // ── Authentification (lot 6, 6.0 e) ─────────────────────────────────────
  136 |     {
  137 |         id: 'connexion', titre: 'Connexion (système de design)', role: 'anonyme', needsIds: false, path: () => '/login',
  138 |         ready: async ({ page }) => {
  139 |             await expectHeading(page, /^connexion$/i);
  140 |             await expect(page.getByRole('button', { name: /^se connecter$/i })).toBeVisible();
  141 |         },
  142 |     },
  143 |     {
  144 |         id: 'inscription', titre: 'Inscription (système de design)', role: 'anonyme', needsIds: false, path: () => '/register',
  145 |         ready: async ({ page }) => { await expectHeading(page, /^créer un compte$/i); },
  146 |     },
  147 |     {
  148 |         id: 'mot-de-passe-oublie', titre: 'Mot de passe oublié (système de design)', role: 'anonyme', needsIds: false, path: () => '/forgot-password',
  149 |         ready: async ({ page }) => { await expectHeading(page, /^mot de passe oublié$/i); },
  150 |     },
  151 |     // ── Client ──────────────────────────────────────────────────────────────
  152 |     {
  153 |         id: 'mes-billets', titre: 'Mes billets (QR masqué)', role: 'client', needsIds: true, path: () => '/tickets',
  154 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  155 |     },
  156 |     {
  157 |         id: 'mes-billets-recus', titre: 'Mes billets — onglet « Reçus » (transfert entrant à accepter)', role: 'client', needsIds: true,
  158 |         path: () => '/tickets?tab=recus',
  159 |         ready: async ({ page }) => {
  160 |             await expect(page.getByRole('tab', { name: /^reçus/i })).toHaveAttribute('aria-selected', 'true');
  161 |             await expect(page.getByRole('button', { name: /^accepter le billet$/i }).first()).toBeVisible();
  162 |         },
  163 |     },
  164 |     {
  165 |         id: 'preferences-push-active', titre: 'Préférences de notification — push activé sur l’appareil (abonnement simulé)', role: 'client', needsIds: true,
  166 |         path: () => '/profile/notifications', fakePush: 'granted',
  167 |         ready: async ({ page }) => {
  168 |             await preferencesReady(page, /^désactivées$/i);
  169 |             await expectNoPermissionPrompt(page);
  170 |         },
  171 |         actions: async ({ page }) => {
  172 |             const registered = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/push/subscriptions' && r.request().method() === 'POST');
  173 |             await page.getByRole('button', { name: /^activer les notifications$/i }).click();
  174 |             const res = await registered;
> 175 |             expect(res.status(), `inscription de l’appareil par POST /api/push/subscriptions : ${await res.text()}`).toBe(200);
      |                                                                                                            ^ Error: response.text: Test timeout of 120000ms exceeded.
  176 |             await expect(page.getByText(/^activées sur cet appareil$/i)).toBeVisible();
  177 |             await expect(page.getByRole('button', { name: /^envoyer une notification d.essai$/i })).toBeVisible();
  178 |             const counters = await fakePushCounters(page);
  179 |             expect(counters.requestPermissionCalls, 'une seule demande d’autorisation, au clic').toBe(1);
  180 |             expect(counters.subscribeCalls, 'un seul abonnement').toBe(1);
  181 |         },
  182 |     },
  183 |     {
  184 |         id: 'preferences-push-refuse', titre: 'Préférences de notification — push refusé dans le navigateur', role: 'client', needsIds: true,
  185 |         path: () => '/profile/notifications', fakePush: 'denied',
  186 |         ready: async ({ page }) => {
  187 |             await preferencesReady(page, /^refusées dans le navigateur$/i);
  188 |             await expect(page.getByRole('button', { name: /^activer les notifications$/i })).toHaveCount(0);
  189 |             await expectNoPermissionPrompt(page);
  190 |         },
  191 |     },
  192 |     {
  193 |         id: 'preferences-push-non-pris-en-charge', titre: 'Préférences de notification — push non pris en charge par le navigateur', role: 'client', needsIds: true,
  194 |         path: () => '/profile/notifications', fakePush: 'unsupported',
  195 |         ready: async ({ page }) => {
  196 |             await preferencesReady(page, /^non prises en charge par ce navigateur$/i);
  197 |             await expect(page.getByRole('button', { name: /^activer les notifications$/i })).toHaveCount(0);
  198 |         },
  199 |     },
  200 |     {
  201 |         id: 'cloche-ouverte', titre: 'Cloche ouverte (non lues d’abord, Tout marquer comme lu)', role: 'client', needsIds: true, path: () => '/tickets',
  202 |         actions: async ({ page }) => {
  203 |             await page.getByRole('button', { name: /^notifications/i }).filter({ visible: true }).first().click();
  204 |             const panel = page.getByRole('region', { name: /^notifications$/i });
  205 |             await expect(panel).toBeVisible();
  206 |             await expect(panel.getByRole('listitem').first()).toBeVisible();
  207 |         },
  208 |     },
  209 |     {
  210 |         id: 'notifications-vide', titre: 'Notifications du client — aucune notification', role: 'client', needsIds: true, path: () => '/notifications',
  211 |         stubResponse: { url: /\/api\/notifications(\?|$)/, status: 200, body: { notifications: [], unreadCount: 0, total: 0, page: 1, pageSize: 20 } },
  212 |         ready: async ({ page }) => { await expect(page.getByText('Aucune notification', { exact: true })).toBeVisible(); },
  213 |     },
  214 |     { id: 'notifications', titre: 'Notifications du client', role: 'client', needsIds: true, path: () => '/notifications' },
  215 |     {
  216 |         id: 'notifications-erreur', titre: 'Notifications du client — état d’erreur', role: 'client', needsIds: true, path: () => '/notifications',
  217 |         injectError: /\/api\/notifications(\?|$)/, ready: expectRetry,
  218 |     },
  219 |     // ── Organisateur ────────────────────────────────────────────────────────
  220 |     { id: 'partenaire-evenements', titre: 'Liste des événements de l’organisateur', role: 'organisateur', needsIds: true, path: () => '/partner/events' },
  221 |     {
  222 |         id: 'partenaire-evenements-annules', titre: 'Liste de l’organisateur — onglet Annulé', role: 'organisateur', needsIds: true, path: () => '/partner/events',
  223 |         actions: async ({ page }) => openTab(page, /^annulé/i),
  224 |     },
  225 |     {
  226 |         id: 'partenaire-evenements-erreur', titre: 'Liste de l’organisateur — état d’erreur', role: 'organisateur', needsIds: true, path: () => '/partner/events',
  227 |         injectError: /\/api\/partner\/events(\/overview)?(\?.*)?$/, ready: expectRetry,
  228 |     },
  229 |     { id: 'partenaire-creation', titre: 'Création d’un événement (formulaire partagé)', role: 'organisateur', needsIds: true, path: () => '/partner/events/new' },
  230 |     {
  231 |         id: 'partenaire-edition', titre: 'Édition d’un événement publié avec ventes (champs verrouillés)', role: 'organisateur', needsIds: true,
  232 |         path: (i) => `/partner/events/${ids(i).events.publie.id}/edit`,
  233 |     },
  234 |     tabScreen('pilotage-apercu', 'Pilotage — Aperçu', /^aperçu/i),
  235 |     tabScreen('pilotage-ventes', 'Pilotage — Ventes', /^ventes/i),
  236 |     tabScreen('pilotage-entrees', 'Pilotage — Entrées en direct', /^entrées/i),
  237 |     tabScreen('pilotage-equipe', 'Pilotage — Équipe', /^équipe/i),
  238 |     tabScreen('pilotage-caisse', 'Pilotage — Caisse', /^caisse/i),
  239 |     tabScreen('pilotage-cloture', 'Pilotage — Clôture et export', /^clôture/i),
  240 |     {
  241 |         id: 'pilotage-annulation', titre: 'Modale « Annuler l’événement » (impact, titre à retaper)', role: 'organisateur', needsIds: true, path: pilotage('publie'),
  242 |         actions: async ({ page }) => {
  243 |             await page.getByRole('button', { name: /annuler l[’']événement/i }).click();
  244 |             await expect(page.getByRole('dialog').or(page.getByRole('alertdialog'))).toBeVisible();
  245 |         },
  246 |     },
  247 |     {
  248 |         id: 'pilotage-remboursements', titre: 'Événement annulé — avancement des remboursements', role: 'organisateur', needsIds: true, path: pilotage('annule'),
  249 |         ready: async ({ page }) => { await expect(page.getByText(/remboursements/i).first()).toBeVisible(); },
  250 |     },
  251 |     {
  252 |         id: 'pilotage-erreur', titre: 'Pilotage — état d’erreur', role: 'organisateur', needsIds: true, path: pilotage('ceSoir'),
  253 |         injectError: /\/api\/partner\/events\/[^/]+\/pilotage\/overview(\?.*)?$/, ready: expectRetry,
  254 |     },
  255 |     // ── Administration ──────────────────────────────────────────────────────
  256 |     { id: 'admin-evenements', titre: 'Administration — événements (filtres, pagination)', role: 'admin', needsIds: true, path: () => '/admin/events' },
  257 |     { id: 'admin-evenements-en-attente', titre: 'Administration — file de validation', role: 'admin', needsIds: true, path: () => '/admin/events?status=EN_ATTENTE' },
  258 |     {
  259 |         id: 'admin-evenements-erreur', titre: 'Administration — état d’erreur', role: 'admin', needsIds: true, path: () => '/admin/events',
  260 |         injectError: /\/api\/admin\/events(\?.*)?$/, ready: expectRetry,
  261 |     },
  262 |     { id: 'admin-fiche-en-attente', titre: 'Administration — fiche complète avant validation', role: 'admin', needsIds: true, path: (i) => `/admin/events/${ids(i).events.enAttente.id}` },
  263 |     { id: 'admin-fiche-suspendu', titre: 'Administration — fiche d’un événement suspendu (motif, réactiver)', role: 'admin', needsIds: true, path: (i) => `/admin/events/${ids(i).events.suspendu.id}` },
  264 |     {
  265 |         id: 'admin-notifications', titre: 'Administration — supervision des notifications (liste filtrable, compteurs)', role: 'admin', needsIds: true,
  266 |         path: () => '/admin/notifications',
  267 |         ready: async ({ page }) => {
  268 |             await expectHeading(page, /^notifications$/i);
  269 |             await expect(page.getByRole('link', { name: /^voir le détail/i }).first()).toBeVisible();
  270 |         },
  271 |     },
  272 |     {
  273 |         id: 'admin-notifications-detail', titre: 'Administration — détail d’une notification en échec (Relancer)', role: 'admin', needsIds: true,
  274 |         path: (i) => `/admin/notifications/${ids(i).notifications.failedId}`,
  275 |         ready: async ({ page }) => { await expect(page.getByRole('button', { name: /^relancer$/i })).toBeVisible(); },
```