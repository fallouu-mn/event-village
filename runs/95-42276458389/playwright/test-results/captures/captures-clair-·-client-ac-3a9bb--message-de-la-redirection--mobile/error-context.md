# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · client >> accueil-acces-refuse — Accueil après un accès refusé (message de la redirection)
- Location: e2e/captures.spec.ts:159:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('alert').filter({ hasText: 'Cet espace est réservé aux administrateurs.' })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('alert').filter({ hasText: 'Cet espace est réservé aux administrateurs.' }) with timeout 15000ms
  - waiting for getByRole('alert').filter({ hasText: 'Cet espace est réservé aux administrateurs.' })

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
              - /url: /events/e872d2a3-e91e-4f3b-b293-18547fdd5ac5
          - text: Concerts & Musique
          - list:
            - listitem: 06 NOV 2026 à 20:15
            - listitem: Esplanade de la Corniche Ouest, Dakar
          - paragraph: À partir de
          - paragraph: 5 000 F CFA
      - listitem:
        - article:
          - paragraph: Baobab Scène
          - heading "Concert des Lumières de Gorée" [level=3]:
            - link "Concert des Lumières de Gorée":
              - /url: /events/54dc89c9-9748-439e-bd4e-7f10b24fd319
          - text: Concerts & Musique
          - list:
            - listitem: 07 NOV 2026 à 15:30
            - listitem: Place du Gouvernement, Gorée
          - paragraph: À partir de
          - paragraph: 6 000 F CFA
      - listitem:
        - article:
          - paragraph: Petite-Côte Événements
          - heading "Marché gourmand de la Petite-Côte" [level=3]:
            - link "Marché gourmand de la Petite-Côte":
              - /url: /events/deeb3f96-a91d-41df-bf8b-86268de2e6e0
          - text: Gastronomie & Tables
          - list:
            - listitem: 11 NOV 2026 à 10:00
            - listitem: Place du Marché Central, Mbour
          - paragraph: À partir de
          - paragraph: 1 000 F CFA
      - listitem:
        - article:
          - paragraph: Saloum Culture
          - heading "Dîner-spectacle au bord du Saloum" [level=3]:
            - link "Dîner-spectacle au bord du Saloum":
              - /url: /events/e64f1567-8141-4d21-9fcb-9932118c730a
          - text: Salles & Réceptions
          - list:
            - listitem: 14 NOV 2026 à 20:00
            - listitem: Terrasse des Pirogues, Foundiougne
          - paragraph: À partir de
          - paragraph: 25 000 F CFA
      - listitem:
        - article:
          - paragraph: Baobab Scène
          - heading "Festival Jazz sur le Fleuve" [level=3]:
            - link "Festival Jazz sur le Fleuve":
              - /url: /events/290345b1-9ab8-4f79-ba5a-4e683b041d78
          - text: Festivals
          - list:
            - listitem: 18 NOV 2026 à 18:00
            - listitem: Quai des Pêcheurs, Saint-Louis
          - paragraph: À partir de
          - paragraph: 7 500 F CFA
      - listitem:
        - article:
          - paragraph: Baobab Scène
          - heading "Soirée Kora & Lumières" [level=3]:
            - link "Soirée Kora & Lumières":
              - /url: /events/e0e3c6e2-deff-4bba-b5ae-3cfb1966a19f
          - text: Concerts & Musique
          - list:
            - listitem: 23 NOV 2026 à 20:30
            - listitem: Jardin de la Maison des Arts, Dakar
          - paragraph: À partir de
          - paragraph: 6 000 F CFA
      - listitem:
        - article:
          - paragraph: Orga B (test)
          - heading "TEST Spectacle B (publié, à venir)" [level=3]:
            - link "TEST Spectacle B (publié, à venir)":
              - /url: /events/eb1182ed-a5c1-4503-8200-7dfd6ba363ac
          - text: Concerts & Musique
          - list:
            - listitem: 26 NOV 2026 à 20:00
            - listitem: Salle de test, Dakar, Dakar
          - paragraph: À partir de
          - paragraph: 4 000 F CFA
      - listitem:
        - article:
          - paragraph: Saloum Culture
          - heading "Gala des entrepreneurs du Saloum" [level=3]:
            - link "Gala des entrepreneurs du Saloum":
              - /url: /events/416433c4-c55f-433d-a043-9bac882303a5
          - text: Salles & Réceptions
          - list:
            - listitem: 27 NOV 2026 à 19:30
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
  277 |     return target.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  278 | }
  279 | 
  280 | /** Étape « Billetterie » du formulaire d'un événement (EventForm, navigation par étapes). */
  281 | async function openTicketingStep(page: Page): Promise<void> {
  282 |     await page.getByRole('navigation', { name: /^étapes du formulaire$/i }).getByRole('button', { name: /billetterie/i }).click();
  283 |     await expect(page.getByRole('heading', { name: /^billetterie$/i })).toBeVisible();
  284 | }
  285 | 
  286 | const ONLINE_BOX = /^vendue en ligne/i;
  287 | const COUNTER_BOX = /^vendue au guichet/i;
  288 | 
  289 | /** Blocs des catégories enregistrées (EventTicketingManager), repérés par la case du guichet. */
  290 | function categorySections(page: Page): Locator {
  291 |     return page.locator('section').filter({ has: page.getByRole('checkbox', { name: COUNTER_BOX }) });
  292 | }
  293 | 
  294 | const REFUNDS_URL = /\/api\/admin\/refunds(\?.*)?$/;
  295 | const RECONCILIATION_URL = /\/api\/admin\/finance\/reconciliation(\?.*)?$/;
  296 | /** Réponse du contrat 3.10 : deux lignes relançables, une à vérifier auprès de SamirPay, sans bouton. */
  297 | const REFUNDS_TO_RETRY = {
  298 |     items: [
  299 |         {
  300 |             refund_id: 'e6a7b3a9-17de-42fa-8dc0-afbec12d3f39', cashout_id: 'f7b8c4ba-28ef-43ab-9ed1-b0cfd23e4a4a', kind: 'TICKET_REFUND', amount: 5250, state: 'ECHOUE',
  301 |             reason_label: 'Refus de l’opérateur', event_title: 'Croisière musicale vers Gorée', phone_masked: '77 ••• •• 34', created_at: '2026-11-04T18:30:00.000Z', can_retry: true,
  302 |         },
  303 |         {
  304 |             refund_id: '08c9d5cb-39fa-44bc-8fe2-c1d0e34f5b5b', cashout_id: '19dae6dc-4a0b-45cd-9af3-d2e1f4506c6c', kind: 'TICKET_REFUND', amount: 15750, state: 'BLOQUE',
  305 |             reason_label: 'Solde SamirPay insuffisant', event_title: 'Croisière musicale vers Gorée', phone_masked: '76 ••• •• 18', created_at: '2026-11-04T19:05:00.000Z', can_retry: true,
  306 |         },
  307 |         {
  308 |             refund_id: '2aebf7ed-5b1c-46de-8b04-e3f205617d7d', cashout_id: '3bfc08fe-6c2d-47ef-9c15-f40316728e8e', kind: 'TICKET_REFUND', amount: 3150, state: 'INCERTAIN',
  309 |             reason_label: null, event_title: 'Festival Jazz sur le Fleuve', phone_masked: '78 ••• •• 52', created_at: '2026-11-04T20:40:00.000Z', can_retry: false,
  310 |         },
  311 |     ],
  312 |     truncated: false,
  313 | };
  314 | const EMPTY_RECONCILIATION = {
  315 |     summary: {
  316 |         period: 'Tout', totalTransactionsCount: 0, totalGrossVolume: 0, totalServiceFees: 0, totalAggregatorFees: 0, totalPlatformNetRevenue: 0,
  317 |         totalPartnerPayouts: 0, totalReferralCommissions: 0, totalWithdrawalsPaid: 0, totalRefunds: 0, platformNetBalance: 0, discrepanciesCount: 0,
  318 |     },
  319 |     items: [],
  320 | };
  321 | 
  322 | function tabScreen(id: string, titre: string, tab: RegExp): Screen {
  323 |     return {
  324 |         id, titre, role: 'organisateur', needsIds: true, path: pilotage('ceSoir'),
  325 |         actions: async ({ page }) => openTab(page, tab),
  326 |     };
  327 | }
  328 | 
  329 | export const SCREENS: readonly Screen[] = [
  330 |     // ── Public ──────────────────────────────────────────────────────────────
  331 |     { id: 'accueil', titre: 'Accueil', role: 'anonyme', needsIds: false, path: () => '/' },
  332 |     { id: 'catalogue', titre: 'Catalogue des événements', role: 'anonyme', needsIds: false, path: () => '/explore' },
  333 |     { id: 'evenement-publie', titre: 'Page publique — événement publié (ce soir)', role: 'anonyme', needsIds: true, path: (i) => `/events/${ids(i).events.ceSoir.id}`, expectStatus: 200 },
  334 |     {
  335 |         id: 'evenement-suspendu', titre: 'Page publique — événement suspendu (bandeau, sans achat)', role: 'anonyme', needsIds: true,
  336 |         path: (i) => `/events/${ids(i).events.suspendu.id}`, expectStatus: 200,
  337 |         ready: async ({ page }) => { await expect(page.getByText(/suspendu/i).first()).toBeVisible(); },
  338 |     },
  339 |     {
  340 |         id: 'evenement-annule', titre: 'Page publique — événement annulé (avis public, remboursement)', role: 'anonyme', needsIds: true,
  341 |         path: (i) => `/events/${ids(i).events.annule.id}`, expectStatus: 200,
  342 |         ready: async ({ page }) => { await expect(page.getByText(/annulé/i).first()).toBeVisible(); },
  343 |     },
  344 |     {
  345 |         id: 'evenement-termine', titre: 'Page publique — événement terminé (archive)', role: 'anonyme', needsIds: true,
  346 |         path: (i) => `/events/${ids(i).events.termine.id}`, expectStatus: 200,
  347 |         ready: async ({ page }) => { await expect(page.getByText(/terminé/i).first()).toBeVisible(); },
  348 |     },
  349 |     {
  350 |         id: 'evenement-non-public', titre: 'URL d’un brouillon : page introuvable propre', role: 'anonyme', needsIds: true,
  351 |         path: (i) => `/events/${ids(i).events.brouillon.id}`,
  352 |         expectStatus: 404, allowFailures: EVENT_404_FAILURES,
  353 |         ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
  354 |     },
  355 |     {
  356 |         id: 'evenement-introuvable', titre: 'URL d’un événement inconnu : vrai 404, page introuvable propre', role: 'anonyme', needsIds: false,
  357 |         path: () => `/events/${UNKNOWN_EVENT_ID}`, expectStatus: 404, allowFailures: EVENT_404_FAILURES,
  358 |         ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
  359 |     },
  360 |     {
  361 |         id: 'evenement-identifiant-invalide', titre: 'URL d’un identifiant qui n’est pas un UUID : vrai 404', role: 'anonyme', needsIds: false,
  362 |         path: () => `/events/${NOT_AN_EVENT_ID}`, views: ['mobile-clair'], expectStatus: 404,
  363 |         allowFailures: [new RegExp(`/api/events/${NOT_AN_EVENT_ID}(\\?.*)?$`), new RegExp(`/events/${NOT_AN_EVENT_ID}$`)],
  364 |         ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
  365 |     },
  366 |     {
  367 |         id: 'fiche-barre-achat', titre: 'Fiche d’un événement — barre d’achat fixe, panier non vide, page défilée', role: 'client', needsIds: true,
  368 |         path: (i) => `/events/${ids(i).events.ceSoir.id}`, views: MOBILE_VIEWS,
  369 |         actions: async ({ page }) => {
  370 |             await page.getByRole('button', { name: /^ajouter un billet standard/i }).click();
  371 |             await expectBuyBarAnchored(page, 'fiche de « ce soir »'); // finit à mi-page : c'est l'état capturé
  372 |         },
  373 |     },
  374 |     {
  375 |         id: 'accueil-acces-refuse', titre: 'Accueil après un accès refusé (message de la redirection)', role: 'client', needsIds: true,
  376 |         path: () => '/?error=unauthorized_admin',
> 377 |         ready: async ({ page }) => { await expect(page.getByRole('alert').filter({ hasText: 'Cet espace est réservé aux administrateurs.' })).toBeVisible(); },
      |                                                                                                                                               ^ Error: expect(locator).toBeVisible() failed
  378 |     },
  379 |     {
  380 |         id: 'hors-ligne', titre: 'Indicateur « Hors ligne » (catalogue ouvert, connexion coupée)', role: 'anonyme', needsIds: false, path: () => '/explore',
  381 |         actions: async ({ page, context, guard }) => {
  382 |             guard.freeze();
  383 |             await context.setOffline(true);
  384 |             await expect(page.getByText(/hors ligne/i).first()).toBeVisible({ timeout: 20_000 });
  385 |         },
  386 |     },
  387 |     // ── Authentification (lot 6, 6.0 e) ─────────────────────────────────────
  388 |     {
  389 |         id: 'connexion', titre: 'Connexion (système de design)', role: 'anonyme', needsIds: false, path: () => '/login',
  390 |         ready: async ({ page }) => {
  391 |             await expectHeading(page, /^connexion$/i);
  392 |             await expect(page.getByRole('button', { name: /^se connecter$/i })).toBeVisible();
  393 |         },
  394 |     },
  395 |     {
  396 |         id: 'inscription', titre: 'Inscription (système de design)', role: 'anonyme', needsIds: false, path: () => '/register',
  397 |         ready: async ({ page }) => { await expectHeading(page, /^créer un compte$/i); },
  398 |     },
  399 |     {
  400 |         id: 'mot-de-passe-oublie', titre: 'Mot de passe oublié (système de design)', role: 'anonyme', needsIds: false, path: () => '/forgot-password',
  401 |         ready: async ({ page }) => { await expectHeading(page, /^mot de passe oublié$/i); },
  402 |     },
  403 |     // ── Client ──────────────────────────────────────────────────────────────
  404 |     {
  405 |         id: 'mes-billets', titre: 'Mes billets (QR masqué)', role: 'client', needsIds: true, path: () => '/tickets',
  406 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  407 |     },
  408 |     {
  409 |         id: 'mes-billets-recus', titre: 'Mes billets — onglet « Reçus » (transfert entrant à accepter)', role: 'client', needsIds: true,
  410 |         path: () => '/tickets?tab=recus',
  411 |         ready: async ({ page }) => {
  412 |             await expect(page.getByRole('tab', { name: /^reçus/i })).toHaveAttribute('aria-selected', 'true');
  413 |             await expect(page.getByRole('button', { name: /^accepter le billet$/i }).first()).toBeVisible();
  414 |         },
  415 |     },
  416 |     {
  417 |         id: 'preferences-push-active', titre: 'Préférences de notification — push activé sur l’appareil (abonnement simulé)', role: 'client', needsIds: true,
  418 |         path: () => '/profile/notifications', fakePush: 'granted',
  419 |         ready: async ({ page }) => {
  420 |             await preferencesReady(page, /^désactivées$/i);
  421 |             await expectNoPermissionPrompt(page);
  422 |         },
  423 |         actions: async ({ page }) => {
  424 |             const registered = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/push/subscriptions' && r.request().method() === 'POST');
  425 |             await page.getByRole('button', { name: /^activer les notifications$/i }).click();
  426 |             const res = await registered;
  427 |             // Corps lu seulement en cas d'échec, pour l'afficher (run 65 : lecture bloquée sur une réponse 200).
  428 |             if (res.status() !== 200) {
  429 |                 throw new Error(`inscription de l’appareil par POST /api/push/subscriptions : HTTP ${res.status()} ${await res.text()}`);
  430 |             }
  431 |             await expect(page.getByText(/^activées sur cet appareil$/i)).toBeVisible();
  432 |             await expect(page.getByRole('button', { name: /^envoyer une notification d.essai$/i })).toBeVisible();
  433 |             const counters = await fakePushCounters(page);
  434 |             expect(counters.requestPermissionCalls, 'une seule demande d’autorisation, au clic').toBe(1);
  435 |             expect(counters.subscribeCalls, 'un seul abonnement').toBe(1);
  436 |         },
  437 |     },
  438 |     {
  439 |         id: 'preferences-push-refuse', titre: 'Préférences de notification — push refusé dans le navigateur', role: 'client', needsIds: true,
  440 |         path: () => '/profile/notifications', fakePush: 'denied',
  441 |         ready: async ({ page }) => {
  442 |             await preferencesReady(page, /^refusées dans le navigateur$/i);
  443 |             await expect(page.getByRole('button', { name: /^activer les notifications$/i })).toHaveCount(0);
  444 |             await expectNoPermissionPrompt(page);
  445 |         },
  446 |     },
  447 |     {
  448 |         id: 'preferences-push-non-pris-en-charge', titre: 'Préférences de notification — push non pris en charge par le navigateur', role: 'client', needsIds: true,
  449 |         path: () => '/profile/notifications', fakePush: 'unsupported',
  450 |         ready: async ({ page }) => {
  451 |             await preferencesReady(page, /^non prises en charge par ce navigateur$/i);
  452 |             await expect(page.getByRole('button', { name: /^activer les notifications$/i })).toHaveCount(0);
  453 |         },
  454 |     },
  455 |     {
  456 |         id: 'cloche-ouverte', titre: 'Cloche ouverte (non lues d’abord, Tout marquer comme lu)', role: 'client', needsIds: true, path: () => '/tickets',
  457 |         actions: async ({ page }) => {
  458 |             await page.getByRole('button', { name: /^notifications/i }).filter({ visible: true }).first().click();
  459 |             const panel = page.getByRole('region', { name: /^notifications$/i });
  460 |             await expect(panel).toBeVisible();
  461 |             await expect(panel.getByRole('listitem').first()).toBeVisible();
  462 |         },
  463 |     },
  464 |     {
  465 |         id: 'notifications-vide', titre: 'Notifications du client — aucune notification', role: 'client', needsIds: true, path: () => '/notifications',
  466 |         stubResponse: { url: /\/api\/notifications(\?|$)/, status: 200, body: { notifications: [], unreadCount: 0, total: 0, page: 1, pageSize: 20 } },
  467 |         ready: async ({ page }) => { await expect(page.getByText('Aucune notification', { exact: true })).toBeVisible(); },
  468 |     },
  469 |     { id: 'notifications', titre: 'Notifications du client', role: 'client', needsIds: true, path: () => '/notifications' },
  470 |     {
  471 |         id: 'notifications-erreur', titre: 'Notifications du client — état d’erreur', role: 'client', needsIds: true, path: () => '/notifications',
  472 |         injectError: /\/api\/notifications(\?|$)/, ready: expectRetry,
  473 |     },
  474 |     // ── Organisateur ────────────────────────────────────────────────────────
  475 |     { id: 'partenaire-evenements', titre: 'Liste des événements de l’organisateur', role: 'organisateur', needsIds: true, path: () => '/partner/events' },
  476 |     {
  477 |         id: 'partenaire-evenements-annules', titre: 'Liste de l’organisateur — onglet Annulé', role: 'organisateur', needsIds: true, path: () => '/partner/events',
```