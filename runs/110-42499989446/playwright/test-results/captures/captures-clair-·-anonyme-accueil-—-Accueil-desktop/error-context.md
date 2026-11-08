# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · anonyme >> accueil — Accueil
- Location: e2e/captures.spec.ts:174:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('region', { name: /^populaires/i }).getByRole('link').first()
Expected: visible
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('region', { name: /^populaires/i }).getByRole('link').first() with timeout 30000ms
  - waiting for getByRole('region', { name: /^populaires/i }).getByRole('link').first()

```

```yaml
- complementary:
  - link "Event Village, accueil":
    - /url: /
    - text: EVENT VILLAGE
  - navigation "Navigation principale":
    - paragraph: Menu principal
    - link "Accueil":
      - /url: /
      - img
      - text: Accueil
    - link "Explorer":
      - /url: /explore
      - img
      - text: Explorer
    - link "Mes billets":
      - /url: /tickets
      - img
      - text: Mes billets
    - link "Portefeuille":
      - /url: /wallet
      - img
      - text: Portefeuille
    - paragraph: Espaces métier
    - link "Devenir partenaire":
      - /url: /partner/register
      - img
      - text: Devenir partenaire
  - link "Se connecter":
    - /url: /login
  - button "Basculer le thème"
- banner:
  - link "Rechercher un événement, un concert, un restaurant…":
    - /url: /explore
  - button "Notifications"
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
              - /url: /events/708dc7ca-aaf1-400d-be6b-33df27beb3c1
          - text: Concerts & Musique
          - list:
            - listitem: 08 NOV 2026 à 17:45
            - listitem: Esplanade de la Corniche Ouest, Dakar
          - paragraph: À partir de
          - paragraph: 5 000 F CFA
      - listitem:
        - article:
          - paragraph: Baobab Scène
          - heading "Concert des Lumières de Gorée" [level=3]:
            - link "Concert des Lumières de Gorée":
              - /url: /events/9b7379a0-c736-4c98-8e75-321427086a53
          - text: Concerts & Musique
          - list:
            - listitem: 09 NOV 2026 à 13:00
            - listitem: Place du Gouvernement, Gorée
          - paragraph: À partir de
          - paragraph: 6 000 F CFA
      - listitem:
        - article:
          - paragraph: Petite-Côte Événements
          - heading "Marché gourmand de la Petite-Côte" [level=3]:
            - link "Marché gourmand de la Petite-Côte":
              - /url: /events/c1145e70-7915-4477-9657-d283c2ad7d8f
          - text: Gastronomie & Tables
          - list:
            - listitem: 13 NOV 2026 à 10:00
            - listitem: Place du Marché Central, Mbour
          - paragraph: À partir de
          - paragraph: 1 000 F CFA
      - listitem:
        - article:
          - paragraph: Saloum Culture
          - heading "Dîner-spectacle au bord du Saloum" [level=3]:
            - link "Dîner-spectacle au bord du Saloum":
              - /url: /events/4f2efd7a-173a-43a0-9cfa-c45a0a99b7ce
          - text: Salles & Réceptions
          - list:
            - listitem: 16 NOV 2026 à 20:00
            - listitem: Terrasse des Pirogues, Foundiougne
          - paragraph: À partir de
          - paragraph: 25 000 F CFA
      - listitem:
        - article:
          - paragraph: Baobab Scène
          - heading "Festival Jazz sur le Fleuve" [level=3]:
            - link "Festival Jazz sur le Fleuve":
              - /url: /events/b52d1a87-c3ac-45d1-8cfa-6d28a1267a84
          - text: Festivals
          - list:
            - listitem: 20 NOV 2026 à 18:00
            - listitem: Quai des Pêcheurs, Saint-Louis
          - paragraph: À partir de
          - paragraph: 7 500 F CFA
      - listitem:
        - article:
          - paragraph: Baobab Scène
          - heading "Soirée Kora & Lumières" [level=3]:
            - link "Soirée Kora & Lumières":
              - /url: /events/0d42c081-7200-4d5e-8315-1e0cd8f86f34
          - text: Concerts & Musique
          - list:
            - listitem: 25 NOV 2026 à 20:30
            - listitem: Jardin de la Maison des Arts, Dakar
          - paragraph: À partir de
          - paragraph: 6 000 F CFA
      - listitem:
        - article:
          - paragraph: Orga B (test)
          - heading "TEST Spectacle B (publié, à venir)" [level=3]:
            - link "TEST Spectacle B (publié, à venir)":
              - /url: /events/b7851e01-4113-48f5-8817-42edad039468
          - text: Concerts & Musique
          - list:
            - listitem: 28 NOV 2026 à 20:00
            - listitem: Salle de test, Dakar, Dakar
          - paragraph: À partir de
          - paragraph: 4 000 F CFA
      - listitem:
        - article:
          - paragraph: Saloum Culture
          - heading "Gala des entrepreneurs du Saloum" [level=3]:
            - link "Gala des entrepreneurs du Saloum":
              - /url: /events/e12a453f-7b09-4542-aee8-5d4f5d606811
          - text: Salles & Réceptions
          - list:
            - listitem: 29 NOV 2026 à 19:30
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
- alert
```

# Test source

```ts
  259 |         if (found) return found;
  260 |     }
  261 |     return null;
  262 | }
  263 | 
  264 | function cdpText(node: CdpNode): string {
  265 |     const own = node.nodeType === 3 ? (node.nodeValue ?? '').trim() : '';
  266 |     return own + cdpKids(node).map(cdpText).join('');
  267 | }
  268 | 
  269 | /**
  270 |  * Gabarit affiché par le premier champ de date vide (8.2 t, L66). Il vit dans la racine fantôme du navigateur, que le
  271 |  * DOM de la page ne montre pas : lecture par CDP. Non vérifié sous Linux : si le run « avant » lit encore mm/dd/yyyy,
  272 |  * le rapport l'explique, sans changer de binaire (contrat 11.4).
  273 |  */
  274 | async function expectFrenchDateField(c: ScreenContext): Promise<void> {
  275 |     await expect(c.page.locator('input[type="date"]').first()).toBeAttached();
  276 |     const cdp = await c.context.newCDPSession(c.page);
  277 |     try {
  278 |         const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  279 |         const input = findDateInput(root);
  280 |         if (!input) throw new Error('[e2e] aucun champ de date dans l’arbre lu par CDP');
  281 |         expect(cdpText(input), 'gabarit du champ de date, lu par CDP (8.2 t)').toBe('dd/mm/yyyy');
  282 |     } finally {
  283 |         await cdp.detach();
  284 |     }
  285 | }
  286 | 
  287 | /** Taille de texte calculée d'un élément (mention « Sur place uniquement » : 14 px au moins, contrat 15.7). */
  288 | async function fontSizePx(target: Locator): Promise<number> {
  289 |     return target.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  290 | }
  291 | 
  292 | /** Étape « Billetterie » du formulaire d'un événement (EventForm, navigation par étapes). */
  293 | async function openTicketingStep(page: Page): Promise<void> {
  294 |     await page.getByRole('navigation', { name: /^étapes du formulaire$/i }).getByRole('button', { name: /billetterie/i }).click();
  295 |     await expect(page.getByRole('heading', { name: /^billetterie$/i })).toBeVisible();
  296 | }
  297 | 
  298 | const ONLINE_BOX = /^vendue en ligne/i;
  299 | const COUNTER_BOX = /^vendue au guichet/i;
  300 | 
  301 | /** Blocs des catégories enregistrées (EventTicketingManager), repérés par la case du guichet. */
  302 | function categorySections(page: Page): Locator {
  303 |     return page.locator('section').filter({ has: page.getByRole('checkbox', { name: COUNTER_BOX }) });
  304 | }
  305 | 
  306 | const REFUNDS_URL = /\/api\/admin\/refunds(\?.*)?$/;
  307 | const RECONCILIATION_URL = /\/api\/admin\/finance\/reconciliation(\?.*)?$/;
  308 | /** Réponse du contrat 3.10 : deux lignes relançables, une à vérifier auprès de SamirPay, sans bouton. */
  309 | const REFUNDS_TO_RETRY = {
  310 |     items: [
  311 |         {
  312 |             refund_id: 'e6a7b3a9-17de-42fa-8dc0-afbec12d3f39', cashout_id: 'f7b8c4ba-28ef-43ab-9ed1-b0cfd23e4a4a', kind: 'TICKET_REFUND', amount: 5250, state: 'ECHOUE',
  313 |             reason_label: 'Refus de l’opérateur', event_title: 'Croisière musicale vers Gorée', phone_masked: '77 ••• •• 34', created_at: '2026-11-04T18:30:00.000Z', can_retry: true,
  314 |         },
  315 |         {
  316 |             refund_id: '08c9d5cb-39fa-44bc-8fe2-c1d0e34f5b5b', cashout_id: '19dae6dc-4a0b-45cd-9af3-d2e1f4506c6c', kind: 'TICKET_REFUND', amount: 15750, state: 'BLOQUE',
  317 |             reason_label: 'Solde SamirPay insuffisant', event_title: 'Croisière musicale vers Gorée', phone_masked: '76 ••• •• 18', created_at: '2026-11-04T19:05:00.000Z', can_retry: true,
  318 |         },
  319 |         {
  320 |             refund_id: '2aebf7ed-5b1c-46de-8b04-e3f205617d7d', cashout_id: '3bfc08fe-6c2d-47ef-9c15-f40316728e8e', kind: 'TICKET_REFUND', amount: 3150, state: 'INCERTAIN',
  321 |             reason_label: null, event_title: 'Festival Jazz sur le Fleuve', phone_masked: '78 ••• •• 52', created_at: '2026-11-04T20:40:00.000Z', can_retry: false,
  322 |         },
  323 |     ],
  324 |     truncated: false,
  325 | };
  326 | const EMPTY_RECONCILIATION = {
  327 |     summary: {
  328 |         period: 'Tout', totalTransactionsCount: 0, totalGrossVolume: 0, totalServiceFees: 0, totalAggregatorFees: 0, totalPlatformNetRevenue: 0,
  329 |         totalPartnerPayouts: 0, totalReferralCommissions: 0, totalWithdrawalsPaid: 0, totalRefunds: 0, platformNetBalance: 0, discrepanciesCount: 0,
  330 |     },
  331 |     items: [],
  332 | };
  333 | 
  334 | // ── Lot 9 : invitations, découverte, compte ─────────────────────────────────
  335 | 
  336 | /** Onglet « Invitations » du pilotage ouvert par ?tab=invitations (libellés figés, contrat 5.1). */
  337 | async function invitationsReady(page: Page): Promise<void> {
  338 |     await expect(page.getByRole('tab', { name: /^invitations/i })).toHaveAttribute('aria-selected', 'true');
  339 |     await expect(page.getByRole('button', { name: /^envoyer les invitations$/i })).toBeVisible();
  340 | }
  341 | 
  342 | /** Section « Près de chez vous » de l'accueil (contrat 5.2). */
  343 | function nearbySection(page: Page): Locator {
  344 |     return page.locator('section').filter({ has: page.getByRole('heading', { name: /^près de chez vous/i }) });
  345 | }
  346 | 
  347 | function tabScreen(id: string, titre: string, tab: RegExp): Screen {
  348 |     return {
  349 |         id, titre, role: 'organisateur', needsIds: true, path: pilotage('ceSoir'),
  350 |         actions: async ({ page }) => openTab(page, tab),
  351 |     };
  352 | }
  353 | 
  354 | export const SCREENS: readonly Screen[] = [
  355 |     // ── Public ──────────────────────────────────────────────────────────────
  356 |     {
  357 |         id: 'accueil', titre: 'Accueil', role: 'anonyme', needsIds: false, path: () => '/',
  358 |         // Lot 9 : section sous « À l'affiche », chargée après la page ; le seed y place des ventes récentes (spreadPurchases)
> 359 |         ready: async ({ page }) => { await expect(page.getByRole('region', { name: /^populaires/i }).getByRole('link').first()).toBeVisible({ timeout: 30_000 }); },
      |                                                                                                                                 ^ Error: expect(locator).toBeVisible() failed
  360 |     },
  361 |     { id: 'catalogue', titre: 'Catalogue des événements', role: 'anonyme', needsIds: false, path: () => '/explore' },
  362 |     { id: 'evenement-publie', titre: 'Page publique — événement publié (ce soir)', role: 'anonyme', needsIds: true, path: (i) => `/events/${ids(i).events.ceSoir.id}`, expectStatus: 200 },
  363 |     {
  364 |         id: 'evenement-suspendu', titre: 'Page publique — événement suspendu (bandeau, sans achat)', role: 'anonyme', needsIds: true,
  365 |         path: (i) => `/events/${ids(i).events.suspendu.id}`, expectStatus: 200,
  366 |         ready: async ({ page }) => { await expect(page.getByText(/suspendu/i).first()).toBeVisible(); },
  367 |     },
  368 |     {
  369 |         id: 'evenement-annule', titre: 'Page publique — événement annulé (avis public, remboursement)', role: 'anonyme', needsIds: true,
  370 |         path: (i) => `/events/${ids(i).events.annule.id}`, expectStatus: 200,
  371 |         ready: async ({ page }) => { await expect(page.getByText(/annulé/i).first()).toBeVisible(); },
  372 |     },
  373 |     {
  374 |         id: 'evenement-termine', titre: 'Page publique — événement terminé (archive)', role: 'anonyme', needsIds: true,
  375 |         path: (i) => `/events/${ids(i).events.termine.id}`, expectStatus: 200,
  376 |         ready: async ({ page }) => { await expect(page.getByText(/terminé/i).first()).toBeVisible(); },
  377 |     },
  378 |     {
  379 |         id: 'evenement-non-public', titre: 'URL d’un brouillon : page introuvable propre', role: 'anonyme', needsIds: true,
  380 |         path: (i) => `/events/${ids(i).events.brouillon.id}`,
  381 |         expectStatus: 404, allowFailures: EVENT_404_FAILURES,
  382 |         ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
  383 |     },
  384 |     {
  385 |         id: 'evenement-introuvable', titre: 'URL d’un événement inconnu : vrai 404, page introuvable propre', role: 'anonyme', needsIds: false,
  386 |         path: () => `/events/${UNKNOWN_EVENT_ID}`, expectStatus: 404, allowFailures: EVENT_404_FAILURES,
  387 |         ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
  388 |     },
  389 |     {
  390 |         id: 'evenement-identifiant-invalide', titre: 'URL d’un identifiant qui n’est pas un UUID : vrai 404', role: 'anonyme', needsIds: false,
  391 |         path: () => `/events/${NOT_AN_EVENT_ID}`, views: ['mobile-clair'], expectStatus: 404,
  392 |         allowFailures: [new RegExp(`/api/events/${NOT_AN_EVENT_ID}(\\?.*)?$`), new RegExp(`/events/${NOT_AN_EVENT_ID}$`)],
  393 |         ready: async ({ page }) => { await expectHeading(page, /^page introuvable$/i); },
  394 |     },
  395 |     {
  396 |         id: 'fiche-barre-achat', titre: 'Fiche d’un événement — barre d’achat fixe, panier non vide, page défilée', role: 'client', needsIds: true,
  397 |         path: (i) => `/events/${ids(i).events.ceSoir.id}`, views: MOBILE_VIEWS,
  398 |         actions: async ({ page }) => {
  399 |             await page.getByRole('button', { name: /^ajouter un billet standard/i }).click();
  400 |             await expectBuyBarAnchored(page, 'fiche de « ce soir »'); // finit à mi-page : c'est l'état capturé
  401 |         },
  402 |     },
  403 |     {
  404 |         id: 'accueil-acces-refuse', titre: 'Accueil après un accès refusé (message de la redirection)', role: 'client', needsIds: true,
  405 |         path: () => '/?error=unauthorized_admin',
  406 |         ready: async ({ page }) => { await expect(page.getByRole('alert').filter({ hasText: 'Cet espace est réservé aux administrateurs.' })).toBeVisible(); },
  407 |     },
  408 |     {
  409 |         id: 'hors-ligne', titre: 'Indicateur « Hors ligne » (catalogue ouvert, connexion coupée)', role: 'anonyme', needsIds: false, path: () => '/explore',
  410 |         actions: async ({ page, context, guard }) => {
  411 |             guard.freeze();
  412 |             await context.setOffline(true);
  413 |             await expect(page.getByText(/hors ligne/i).first()).toBeVisible({ timeout: 20_000 });
  414 |         },
  415 |     },
  416 |     // ── Authentification (lot 6, 6.0 e) ─────────────────────────────────────
  417 |     {
  418 |         id: 'connexion', titre: 'Connexion (système de design)', role: 'anonyme', needsIds: false, path: () => '/login',
  419 |         ready: async ({ page }) => {
  420 |             await expectHeading(page, /^connexion$/i);
  421 |             await expect(page.getByRole('button', { name: /^se connecter$/i })).toBeVisible();
  422 |         },
  423 |     },
  424 |     {
  425 |         id: 'inscription', titre: 'Inscription (système de design)', role: 'anonyme', needsIds: false, path: () => '/register',
  426 |         ready: async ({ page }) => { await expectHeading(page, /^créer un compte$/i); },
  427 |     },
  428 |     {
  429 |         id: 'mot-de-passe-oublie', titre: 'Mot de passe oublié (système de design)', role: 'anonyme', needsIds: false, path: () => '/forgot-password',
  430 |         ready: async ({ page }) => { await expectHeading(page, /^mot de passe oublié$/i); },
  431 |     },
  432 |     // ── Client ──────────────────────────────────────────────────────────────
  433 |     {
  434 |         id: 'mes-billets', titre: 'Mes billets (QR masqué)', role: 'client', needsIds: true, path: () => '/tickets',
  435 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  436 |     },
  437 |     {
  438 |         id: 'mes-billets-recus', titre: 'Mes billets — onglet « Reçus » (transfert entrant à accepter)', role: 'client', needsIds: true,
  439 |         path: () => '/tickets?tab=recus',
  440 |         ready: async ({ page }) => {
  441 |             await expect(page.getByRole('tab', { name: /^reçus/i })).toHaveAttribute('aria-selected', 'true');
  442 |             await expect(page.getByRole('button', { name: /^accepter le billet$/i }).first()).toBeVisible();
  443 |         },
  444 |     },
  445 |     {
  446 |         id: 'preferences-push-active', titre: 'Préférences de notification — push activé sur l’appareil (abonnement simulé)', role: 'client', needsIds: true,
  447 |         path: () => '/profile/notifications', fakePush: 'granted',
  448 |         ready: async ({ page }) => {
  449 |             await preferencesReady(page, /^désactivées$/i);
  450 |             await expectNoPermissionPrompt(page);
  451 |         },
  452 |         actions: async ({ page }) => {
  453 |             const registered = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/push/subscriptions' && r.request().method() === 'POST');
  454 |             await page.getByRole('button', { name: /^activer les notifications$/i }).click();
  455 |             const res = await registered;
  456 |             // Corps lu seulement en cas d'échec, pour l'afficher (run 65 : lecture bloquée sur une réponse 200).
  457 |             if (res.status() !== 200) {
  458 |                 throw new Error(`inscription de l’appareil par POST /api/push/subscriptions : HTTP ${res.status()} ${await res.text()}`);
  459 |             }
```