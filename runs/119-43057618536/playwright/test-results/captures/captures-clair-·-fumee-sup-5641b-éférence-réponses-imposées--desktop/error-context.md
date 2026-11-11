# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · fumee-superadmin >> admin-versements-marquer-verse — Administration — versements à reprendre : boîte « Marquer versé » (justification, référence ; réponses imposées)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /^versements à reprendre$/i })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: /^versements à reprendre$/i }) with timeout 15000ms
  - waiting for getByRole('heading', { name: /^versements à reprendre$/i })

```

```yaml
- complementary:
  - link "Event Village, accueil":
    - /url: /
    - text: EVENT VILLAGE
  - navigation "Navigation principale":
    - text: Administration
    - link "Tableau de bord":
      - /url: /admin/dashboard
      - img
      - text: Tableau de bord
    - paragraph: Gestion
    - link "Événements":
      - /url: /admin/events
      - img
      - text: Événements
    - link "Utilisateurs":
      - /url: /admin/users
      - img
      - text: Utilisateurs
    - link "Catalogues et services":
      - /url: /admin/services
      - img
      - text: Catalogues et services
    - paragraph: Finances
    - link "Finance":
      - /url: /admin/finance
      - img
      - text: Finance
    - link "Tarification":
      - /url: /admin/pricing
      - img
      - text: Tarification
    - paragraph: Engagement
    - link "Parrainage":
      - /url: /admin/referral
      - img
      - text: Parrainage
    - link "Communications":
      - /url: /admin/communications
      - img
      - text: Communications
    - paragraph: Système
    - link "Journal d’audit":
      - /url: /admin/audit
      - img
      - text: Journal d’audit
    - link "Notifications":
      - /url: /admin/notifications
      - img
      - text: Notifications
    - link "Scanner":
      - /url: /scan
      - img
      - text: Scanner
    - link "Retour au site":
      - /url: /
      - img
      - text: Retour au site
  - link "Elhadji SuperAdmin Super administrateur":
    - /url: /profile
  - button "Se déconnecter"
  - button "Basculer le thème"
- banner:
  - link "Rechercher un événement, un concert, un restaurant…":
    - /url: /explore
  - button "Notifications"
- main:
  - link "Tableau de bord":
    - /url: /admin/dashboard
  - heading "Rapprochement financier" [level=1]
  - link "Réglages de la plateforme":
    - /url: /admin/finance-settings
  - button "Actualiser"
  - region "Synthèse financière":
    - text: Volume encaissé
    - paragraph: 0 F CFA
    - text: 0 paiement(s), frais de service compris Frais de service perçus
    - paragraph: 0 F CFA
    - text: Payés par les acheteurs, montants enregistrés sur chaque paiement Frais agrégateur (SamirPay)
    - paragraph: 0 F CFA
    - text: Prélevés sur les frais de service Revenu net Event Village
    - paragraph: 0 F CFA
    - text: Frais de service moins frais agrégateur, remboursements déduits Reversements partenaires
    - paragraph: 0 F CFA
    - text: Prix des billets et prestations dus aux partenaires Remboursements versés
    - paragraph: 0 F CFA
    - text: Remboursements confirmés sur la période
  - region "Parrainage, retraits et écarts":
    - text: Commissions de parrainage
    - paragraph: 0 F CFA
    - text: Revenu net après parrainage
    - paragraph: 0 F CFA
    - text: Retraits versés
    - paragraph: 0 F CFA
    - text: Écarts de rapprochement
    - paragraph: 0 anomalie
  - region "Remboursements à reprendre":
    - heading "Remboursements à reprendre" [level=2]
    - paragraph: Envois en échec, bloqués ou à l’issue incertaine, du plus ancien au plus récent.
    - alert:
      - heading "Liste indisponible" [level=3]
      - paragraph: "Connexion impossible : vérifiez votre réseau, puis réessayez."
      - button "Réessayer"
  - region "Paiements rapprochés":
    - heading "Paiements rapprochés" [level=2]
    - paragraph: "Contrôle automatique, paiement par paiement : total débité = reversement partenaire + frais de service ; frais de service = frais agrégateur + revenu net Event Village."
    - text: Statut
    - combobox "Statut":
      - option "Tous les paiements encaissés" [selected]
      - option "Confirmés"
      - option "Partiellement remboursés"
      - option "Remboursement en cours"
      - option "Remboursés"
    - group "Période":
      - button "Tout" [pressed]
      - button "30 jours"
      - button "7 jours"
    - paragraph: Aucun paiement encaissé pour cette période.
- alert
```

# Test source

```ts
  284 | 
  285 | /**
  286 |  * Gabarit affiché par le premier champ de date vide (8.2 t, L66). Il vit dans la racine fantôme du navigateur, que le
  287 |  * DOM de la page ne montre pas : lecture par CDP. Non vérifié sous Linux : si le run « avant » lit encore mm/dd/yyyy,
  288 |  * le rapport l'explique, sans changer de binaire (contrat 11.4).
  289 |  */
  290 | async function expectFrenchDateField(c: ScreenContext): Promise<void> {
  291 |     await expect(c.page.locator('input[type="date"]').first()).toBeAttached();
  292 |     const cdp = await c.context.newCDPSession(c.page);
  293 |     try {
  294 |         const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  295 |         const input = findDateInput(root);
  296 |         if (!input) throw new Error('[e2e] aucun champ de date dans l’arbre lu par CDP');
  297 |         expect(cdpText(input), 'gabarit du champ de date, lu par CDP (8.2 t)').toBe('dd/mm/yyyy');
  298 |     } finally {
  299 |         await cdp.detach();
  300 |     }
  301 | }
  302 | 
  303 | /** Taille de texte calculée d'un élément (mention « Sur place uniquement » : 14 px au moins, contrat 15.7). */
  304 | async function fontSizePx(target: Locator): Promise<number> {
  305 |     return target.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  306 | }
  307 | 
  308 | /** Étape « Billetterie » du formulaire d'un événement (EventForm, navigation par étapes). */
  309 | async function openTicketingStep(page: Page): Promise<void> {
  310 |     await page.getByRole('navigation', { name: /^étapes du formulaire$/i }).getByRole('button', { name: /billetterie/i }).click();
  311 |     await expect(page.getByRole('heading', { name: /^billetterie$/i })).toBeVisible();
  312 | }
  313 | 
  314 | const ONLINE_BOX = /^vendue en ligne/i;
  315 | const COUNTER_BOX = /^vendue au guichet/i;
  316 | 
  317 | /** Blocs des catégories enregistrées (EventTicketingManager), repérés par la case du guichet. */
  318 | function categorySections(page: Page): Locator {
  319 |     return page.locator('section').filter({ has: page.getByRole('checkbox', { name: COUNTER_BOX }) });
  320 | }
  321 | 
  322 | const REFUNDS_URL = /\/api\/admin\/refunds(\?.*)?$/;
  323 | const RECONCILIATION_URL = /\/api\/admin\/finance\/reconciliation(\?.*)?$/;
  324 | /** Lot 9 bis (B2, D-ver D1) : conseil exact d'un versement incertain sans identifiant SamirPay (seul « Marquer versé »). */
  325 | const ADVICE_UNCERTAIN_NO_ID = 'Vérifiez auprès du support SamirPay. Si le versement est parti, marquez-le versé avec sa référence.';
  326 | /**
  327 |  * Lot 9 bis (contrat 4.1, B1, B2 ; tableau « Renvoyer / Marquer versé » de la découverte D-ver) : réponse de
  328 |  * GET /api/admin/refunds?state=to_retry, du plus ancien au plus récent. Cinq versements, retrait compris :
  329 |  * « Renvoyer » sur 3 lignes (can_resend 'NOW' ou 'AFTER_CHECK'), « Marquer versé » sur les 5 (can_mark_paid).
  330 |  * Identifiants inconnus de la base : une action envoyée par erreur ne toucherait aucun versement réel.
  331 |  */
  332 | const CASHOUTS_TO_RESUME = {
  333 |     items: [
  334 |         {
  335 |             id: 'f7b8c4ba-28ef-43ab-9ed1-b0cfd23e4a4a', kind: 'TICKET_REFUND', kind_label: 'Remboursement d’un billet', state: 'ECHOUE', state_label: 'Envoi en échec',
  336 |             since: '2026-11-04T18:30:00.000Z', amount: 5250, beneficiary: '77 ••• •• 34', event_title: 'Croisière musicale vers Gorée',
  337 |             block_label: 'Refusé par l’opérateur Mobile Money', can_resend: 'NOW', can_mark_paid: true, advice: null,
  338 |         },
  339 |         {
  340 |             id: '19dae6dc-4a0b-45cd-9af3-d2e1f4506c6c', kind: 'WITHDRAWAL', kind_label: 'Retrait', state: 'BLOQUE', state_label: 'Bloqué',
  341 |             since: '2026-11-04T19:05:00.000Z', amount: 48500, beneficiary: '76 ••• •• 18', event_title: null,
  342 |             block_label: 'Solde SamirPay insuffisant', can_resend: 'NOW', can_mark_paid: true, advice: null,
  343 |         },
  344 |         {
  345 |             id: '3bfc08fe-6c2d-47ef-9c15-f40316728e8e', kind: 'EVENT_CANCELLATION_REFUND', kind_label: 'Annulation d’événement', state: 'INCERTAIN', state_label: 'Issue incertaine',
  346 |             since: '2026-11-04T20:40:00.000Z', amount: 3150, beneficiary: '78 ••• •• 52', event_title: 'Festival Jazz sur le Fleuve',
  347 |             block_label: null, can_resend: false, can_mark_paid: true, advice: ADVICE_UNCERTAIN_NO_ID,
  348 |         },
  349 |         {
  350 |             id: '4c0d19ef-7d3e-48fa-8d26-a51827839f9f', kind: 'REFUND', kind_label: 'Remboursement d’un paiement', state: 'ENVOYE_NON_CONFIRME', state_label: 'Envoyé, non confirmé',
  351 |             since: '2026-11-04T21:10:00.000Z', amount: 10500, beneficiary: '70 ••• •• 61', event_title: 'Nuit du Sabar — édition d’automne',
  352 |             block_label: null, can_resend: 'AFTER_CHECK', can_mark_paid: true, advice: null,
  353 |         },
  354 |         {
  355 |             id: '5d1e2a0f-8e4f-49ab-9e37-b62938940aa0', kind: 'TICKET_REFUND', kind_label: 'Remboursement d’un billet', state: 'BLOQUE', state_label: 'Bloqué',
  356 |             since: '2026-11-04T21:45:00.000Z', amount: 7350, beneficiary: '77 ••• •• 09', event_title: 'Croisière musicale vers Gorée',
  357 |             block_label: 'Opérateur Mobile Money inconnu', can_resend: false, can_mark_paid: true, advice: null,
  358 |         },
  359 |     ],
  360 |     total: 5,
  361 | };
  362 | const CASHOUTS_RESENDABLE = CASHOUTS_TO_RESUME.items.filter((i) => i.can_resend !== false).length;
  363 | const CASHOUTS_MARKABLE = CASHOUTS_TO_RESUME.items.filter((i) => i.can_mark_paid).length;
  364 | const EMPTY_RECONCILIATION = {
  365 |     summary: {
  366 |         period: 'Tout', totalTransactionsCount: 0, totalGrossVolume: 0, totalServiceFees: 0, totalAggregatorFees: 0, totalPlatformNetRevenue: 0,
  367 |         totalPartnerPayouts: 0, totalReferralCommissions: 0, totalWithdrawalsPaid: 0, totalRefunds: 0, platformNetBalance: 0, discrepanciesCount: 0,
  368 |     },
  369 |     items: [],
  370 | };
  371 | /** Lot 9 bis : réponses imposées des deux écrans « Versements à reprendre » (fumee-superadmin, B114). */
  372 | const CASHOUTS_STUBS: StubResponse[] = [
  373 |     { url: RECONCILIATION_URL, method: 'GET', status: 200, body: EMPTY_RECONCILIATION },
  374 |     { url: REFUNDS_URL, method: 'GET', status: 200, body: CASHOUTS_TO_RESUME },
  375 | ];
  376 | 
  377 | /**
  378 |  * Lot 9 bis : « Versements à reprendre » de /admin/finance (RefundsToRetry, contrat 5.1) chargé : titre exact, ligne
  379 |  * « Retrait » (retraits compris, R10), conseil exact d'un versement incertain sans identifiant (B2), puis un bouton
  380 |  * « Renvoyer » par ligne où can_resend n'est pas faux et un « Marquer versé » par ligne où can_mark_paid est vrai
  381 |  * (R51 : boutons conditionnés), et plus aucun « Relancer » (route retry supprimée, B4).
  382 |  */
  383 | async function cashoutsReady(page: Page): Promise<{ resend: Locator; markPaid: Locator }> {
> 384 |     await expect(page.getByRole('heading', { name: /^versements à reprendre$/i })).toBeVisible();
      |                                                                                    ^ Error: expect(locator).toBeVisible() failed
  385 |     await expect(page.getByText(/^retrait$/i).filter({ visible: true }).first(), 'ligne « Retrait » (retraits compris, R10)').toBeVisible();
  386 |     await expect(page.getByText(ADVICE_UNCERTAIN_NO_ID).filter({ visible: true }).first(), 'conseil d’un versement incertain sans identifiant (B2)').toBeVisible();
  387 |     const resend = page.getByRole('button', { name: /^renvoyer/i }).filter({ visible: true });
  388 |     const markPaid = page.getByRole('button', { name: /^marquer versé/i }).filter({ visible: true });
  389 |     await expect(resend, 'un bouton « Renvoyer » par ligne où can_resend n’est pas faux').toHaveCount(CASHOUTS_RESENDABLE);
  390 |     await expect(markPaid, 'un bouton « Marquer versé » par ligne où can_mark_paid est vrai').toHaveCount(CASHOUTS_MARKABLE);
  391 |     await expect(page.getByRole('button', { name: /^relancer/i }), 'plus aucun « Relancer » (B4)').toHaveCount(0);
  392 |     return { resend, markPaid };
  393 | }
  394 | 
  395 | // ── Lot 9 : invitations, découverte, compte ─────────────────────────────────
  396 | 
  397 | /** Onglet « Invitations » du pilotage ouvert par ?tab=invitations (libellés figés, contrat 5.1). */
  398 | async function invitationsReady(page: Page): Promise<void> {
  399 |     await expect(page.getByRole('tab', { name: /^invitations/i })).toHaveAttribute('aria-selected', 'true');
  400 |     await expect(page.getByRole('button', { name: /^envoyer les invitations$/i })).toBeVisible();
  401 | }
  402 | 
  403 | /** Section « Près de chez vous » de l'accueil (contrat 5.2). */
  404 | function nearbySection(page: Page): Locator {
  405 |     return page.locator('section').filter({ has: page.getByRole('heading', { name: /^près de chez vous/i }) });
  406 | }
  407 | 
  408 | // ── Lot 9 bis : versements, droits, transferts, email (contrat 7.3) ─────────
  409 | 
  410 | const TRANSFER_URL = /\/api\/tickets\/[^/]+\/transfer$/;
  411 | /** Contrat 4.2 : refus d'une action sensible sans mot de passe saisi depuis moins de 10 minutes (R57). */
  412 | const PASSWORD_CONFIRMATION_REQUIRED = {
  413 |     error: 'Par sécurité, saisissez votre mot de passe pour continuer.', code: 'PASSWORD_CONFIRMATION_REQUIRED',
  414 | };
  415 | /** Aide exacte de PasswordChangeDialog (contrat 5.42). */
  416 | const PASSWORD_RULES_HELP = '8 caractères au moins, dont une majuscule, un chiffre et un caractère spécial.';
  417 | /** Jeton factice de /verify-email : la page ne valide rien au chargement (contrat 4.6), il n'est jamais envoyé. */
  418 | const VERIFY_EMAIL_TOKEN = 'e2e-jeton-factice-jamais-envoye-0123456789abcdef';
  419 | const VERIFY_EMAIL_API = '/api/account/email/verify';
  420 | 
  421 | /** Boîte de dialogue ouverte, modale simple ou de confirmation (ConfirmDialog). */
  422 | function anyDialog(page: Page, name?: RegExp): Locator {
  423 |     return name
  424 |         ? page.getByRole('dialog', { name }).or(page.getByRole('alertdialog', { name }))
  425 |         : page.getByRole('dialog').or(page.getByRole('alertdialog'));
  426 | }
  427 | 
  428 | /** Fiche partenaire d'un compte organisateur du seed de démonstration (erreur explicite si le seed ne l'a pas écrite). */
  429 | function partnerIdOf(i: DemoIds | null, key: DemoAccountKey): string {
  430 |     const id = ids(i).accounts[key].partnerId;
  431 |     if (!id) throw new Error(`[e2e] demo-ids.json : accounts.${key}.partnerId absent (fiche partenaire du seed de démonstration)`);
  432 |     return id;
  433 | }
  434 | 
  435 | /** Écran existant prolongé d'un contrôle après ses propres actions. */
  436 | function withExtraActions(screen: Screen, extra: (c: ScreenContext) => Promise<void>): Screen {
  437 |     return {
  438 |         ...screen,
  439 |         actions: async (c) => {
  440 |             if (screen.actions) await screen.actions(c);
  441 |             await extra(c);
  442 |         },
  443 |     };
  444 | }
  445 | 
  446 | /** Requêtes déjà parties vers un chemin d'API, lues dans le minutage des ressources de la page. */
  447 | async function requestsTo(page: Page, pathname: string): Promise<number> {
  448 |     return page.evaluate((p) => performance.getEntriesByType('resource').filter((e) => new URL(e.name).pathname === p).length, pathname);
  449 | }
  450 | 
  451 | function tabScreen(id: string, titre: string, tab: RegExp): Screen {
  452 |     return {
  453 |         id, titre, role: 'organisateur', needsIds: true, path: pilotage('ceSoir'),
  454 |         actions: async ({ page }) => openTab(page, tab),
  455 |     };
  456 | }
  457 | 
  458 | export const SCREENS: readonly Screen[] = [
  459 |     // ── Public ──────────────────────────────────────────────────────────────
  460 |     {
  461 |         id: 'accueil', titre: 'Accueil', role: 'anonyme', needsIds: false, path: () => '/',
  462 |         // Lot 9 : section sous « À l'affiche », chargée après la page ; le seed y place des ventes récentes (spreadPurchases)
  463 |         ready: async ({ page }) => { await expect(page.getByRole('region', { name: /^populaires/i }).getByRole('link').first()).toBeVisible({ timeout: 30_000 }); },
  464 |     },
  465 |     { id: 'catalogue', titre: 'Catalogue des événements', role: 'anonyme', needsIds: false, path: () => '/explore' },
  466 |     { id: 'evenement-publie', titre: 'Page publique — événement publié (ce soir)', role: 'anonyme', needsIds: true, path: (i) => `/events/${ids(i).events.ceSoir.id}`, expectStatus: 200 },
  467 |     {
  468 |         id: 'evenement-suspendu', titre: 'Page publique — événement suspendu (bandeau, sans achat)', role: 'anonyme', needsIds: true,
  469 |         path: (i) => `/events/${ids(i).events.suspendu.id}`, expectStatus: 200,
  470 |         ready: async ({ page }) => { await expect(page.getByText(/suspendu/i).first()).toBeVisible(); },
  471 |     },
  472 |     {
  473 |         id: 'evenement-annule', titre: 'Page publique — événement annulé (avis public, remboursement)', role: 'anonyme', needsIds: true,
  474 |         path: (i) => `/events/${ids(i).events.annule.id}`, expectStatus: 200,
  475 |         ready: async ({ page }) => { await expect(page.getByText(/annulé/i).first()).toBeVisible(); },
  476 |     },
  477 |     {
  478 |         id: 'evenement-termine', titre: 'Page publique — événement terminé (archive)', role: 'anonyme', needsIds: true,
  479 |         path: (i) => `/events/${ids(i).events.termine.id}`, expectStatus: 200,
  480 |         ready: async ({ page }) => { await expect(page.getByText(/terminé/i).first()).toBeVisible(); },
  481 |     },
  482 |     {
  483 |         id: 'evenement-non-public', titre: 'URL d’un brouillon : page introuvable propre', role: 'anonyme', needsIds: true,
  484 |         path: (i) => `/events/${ids(i).events.brouillon.id}`,
```