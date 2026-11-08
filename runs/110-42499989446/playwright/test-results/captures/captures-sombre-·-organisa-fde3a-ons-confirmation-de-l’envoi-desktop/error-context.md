# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · organisateur >> invitations-confirmation — Pilotage — Invitations : confirmation de l’envoi
- Location: e2e/captures.spec.ts:174:9

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator: getByRole('tab', { name: /^invitations/i })
Expected: "true"
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toHaveAttribute" getByRole('tab', { name: /^invitations/i }) with timeout 15000ms
  - waiting for getByRole('tab', { name: /^invitations/i })

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
  - button "Basculer le thème" [pressed]
- banner:
  - link "Rechercher un événement, un concert, un restaurant…":
    - /url: /explore
  - button "Notifications, 97 non lues": "97"
- main:
  - link "Mes événements":
    - /url: /partner/events
  - text: Publié
  - status: En direct
  - heading "Nuit du Sabar — édition d’automne" [level=1]
  - paragraph: dim. 8 nov. 2026 à 17:45 Esplanade de la Corniche Ouest, Dakar
  - link "Modifier":
    - /url: /partner/events/708dc7ca-aaf1-400d-be6b-33df27beb3c1/edit
  - button "Annuler l’événement"
  - tablist "Rubriques du pilotage":
    - tab "Aperçu" [selected]
    - tab "Ventes"
    - tab "Entrées"
    - tab "Équipe"
    - tab "Caisse"
    - tab "Clôture"
  - tabpanel "Aperçu":
    - region "Billetterie":
      - heading "Billetterie" [level=2]
      - paragraph: Billets valides et utilisés, hors invitations.
      - paragraph: Billets vendus
      - paragraph: "83"
      - paragraph: Toutes catégories, y compris désactivées
      - paragraph: Places en vente
      - paragraph: "250"
      - paragraph: Quotas des catégories actives
      - paragraph: Places restantes
      - paragraph: "187"
      - paragraph: Dans les catégories actives, sans compter 2 en cours de paiement
      - paragraph: Invitations
      - paragraph: "0"
      - paragraph: Places offertes, comptées à part
    - region "Contrôle d’accès":
      - heading "Contrôle d’accès" [level=2]
      - paragraph: Passages validés au scan et au guichet.
      - paragraph: Entrées
      - paragraph: "61"
      - paragraph: dont 15 au guichet
      - paragraph: Taux de présence
      - paragraph: 73 %
      - paragraph: Part des participants attendus (ventes et invitations) déjà passés
    - region "Recettes":
      - heading "Recettes" [level=2]
      - paragraph: Montants des billets, remboursements déduits pour les ventes en ligne.
      - paragraph: En ligne
      - paragraph: 351 000 F CFA
      - paragraph: Paiements mobiles confirmés
      - paragraph: En espèces
      - paragraph: 120 000 F CFA
      - paragraph: Encaissées par vos contrôleurs
      - paragraph: Remboursé
      - paragraph: 0 F CFA
      - paragraph: Remboursements en ligne
    - paragraph:
      - text: Chiffres calculés le
      - time: dim. 8 nov. 2026 à 17:05
      - text: .
- alert
```

# Test source

```ts
  238 | async function expectNoPermissionPrompt(page: Page): Promise<void> {
  239 |     const counters = await fakePushCounters(page);
  240 |     expect(counters.requestPermissionCalls, 'demandes d’autorisation des notifications au chargement').toBe(0);
  241 | }
  242 | 
  243 | // ── Lot 8 : champ de date, canaux de vente, remboursements ──────────────────
  244 | 
  245 | /** Nœud du document lu par CDP (DOM.getDocument en pierce) : champs utiles seulement. */
  246 | interface CdpNode { nodeType?: number; nodeName?: string; nodeValue?: string; attributes?: string[]; children?: CdpNode[]; shadowRoots?: CdpNode[] }
  247 | 
  248 | function cdpKids(node: CdpNode): CdpNode[] {
  249 |     return [...(node.shadowRoots ?? []), ...(node.children ?? [])];
  250 | }
  251 | 
  252 | function findDateInput(node: CdpNode): CdpNode | null {
  253 |     const attrs = node.attributes ?? [];
  254 |     if (node.nodeName === 'INPUT') {
  255 |         for (let i = 0; i < attrs.length; i += 2) if (attrs[i] === 'type' && attrs[i + 1] === 'date') return node;
  256 |     }
  257 |     for (const kid of cdpKids(node)) {
  258 |         const found = findDateInput(kid);
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
> 338 |     await expect(page.getByRole('tab', { name: /^invitations/i })).toHaveAttribute('aria-selected', 'true');
      |                                                                    ^ Error: expect(locator).toHaveAttribute(expected) failed
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
  359 |         ready: async ({ page }) => { await expect(page.getByRole('region', { name: /^populaires/i }).getByRole('link').first()).toBeVisible({ timeout: 30_000 }); },
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
```