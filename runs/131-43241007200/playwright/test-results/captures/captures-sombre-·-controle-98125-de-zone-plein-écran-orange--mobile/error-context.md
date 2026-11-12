# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · controleur >> scanner-pas-encore-entre — Scanner — pas encore entré (contrôle de zone, plein écran orange)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: texte exact du plein écran (C.2.4) : « Passez d’abord par : Entrée VIP »

expect(locator).toBeVisible() failed

Locator: locator('[data-scan-state="result"]').getByText('Passez d’abord par : Entrée VIP', { exact: true }).first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - texte exact du plein écran (C.2.4) : « Passez d’abord par : Entrée VIP » locator('[data-scan-state="result"]').getByText('Passez d’abord par : Entrée VIP', { exact: true }).first() with timeout 15000ms
  - waiting for locator('[data-scan-state="result"]').getByText('Passez d’abord par : Entrée VIP', { exact: true }).first()

```

```yaml
- banner:
  - link "Mon espace client":
    - /url: /
  - link "Event Village, accueil":
    - /url: /
  - button "Notifications, 1 non lue": "1"
  - link "Ibrahima Gueye":
    - /url: /controller/profile
- main:
  - heading "Nuit du Sabar — édition d’automne" [level=1]
  - paragraph:
    - status: "Entrée principale : 54 entrées"
    - text: En ligne
  - button "Changer d’événement"
  - button "Se déconnecter"
  - tablist "Espace du contrôleur":
    - tab "Contrôle" [selected]
    - tab "Guichet"
    - tab "Caisse"
  - tabpanel "Contrôle":
    - text: Détection en pause
    - group "Mode de contrôle":
      - button "Caméra" [pressed]
      - button "Saisie manuelle"
    - 'button "Derniers scans Vous : 32 entrées, 5 refus"'
    - group: Réglages de cet appareil
  - alert:
    - paragraph: Pas encore entré
    - paragraph: Fatou Mbaye
    - paragraph: "Billet : VIP · TCK-20261104-7C2D9A4B1E"
    - paragraph: Retour automatique au scan · touchez pour passer
- alert
```

# Test source

```ts
  424 |     await expect(markNotSent, 'un bouton « Constater non versé » par ligne où can_mark_not_sent est vrai (lot 9 ter, A.2.4)').toHaveCount(CASHOUTS_NOT_SENT);
  425 |     return { resend, markPaid, markNotSent };
  426 | }
  427 | 
  428 | // ── Lot 9 : invitations, découverte, compte ─────────────────────────────────
  429 | 
  430 | /** Onglet « Invitations » du pilotage ouvert par ?tab=invitations (libellés figés, contrat 5.1). */
  431 | async function invitationsReady(page: Page): Promise<void> {
  432 |     await expect(page.getByRole('tab', { name: /^invitations/i })).toHaveAttribute('aria-selected', 'true');
  433 |     await expect(page.getByRole('button', { name: /^envoyer les invitations$/i })).toBeVisible();
  434 | }
  435 | 
  436 | /** Section « Près de chez vous » de l'accueil (contrat 5.2). */
  437 | function nearbySection(page: Page): Locator {
  438 |     return page.locator('section').filter({ has: page.getByRole('heading', { name: /^près de chez vous/i }) });
  439 | }
  440 | 
  441 | // ── Lot 9 bis : versements, droits, transferts, email (contrat 7.3) ─────────
  442 | 
  443 | const TRANSFER_URL = /\/api\/tickets\/[^/]+\/transfer$/;
  444 | /** Contrat 4.2 : refus d'une action sensible sans mot de passe saisi depuis moins de 10 minutes (R57). */
  445 | const PASSWORD_CONFIRMATION_REQUIRED = {
  446 |     error: 'Par sécurité, saisissez votre mot de passe pour continuer.', code: 'PASSWORD_CONFIRMATION_REQUIRED',
  447 | };
  448 | /** Aide exacte de PasswordChangeDialog (contrat 5.42). */
  449 | const PASSWORD_RULES_HELP = '8 caractères au moins, dont une majuscule, un chiffre et un caractère spécial.';
  450 | /** Jeton factice de /verify-email : la page ne valide rien au chargement (contrat 4.6), il n'est jamais envoyé. */
  451 | const VERIFY_EMAIL_TOKEN = 'e2e-jeton-factice-jamais-envoye-0123456789abcdef';
  452 | const VERIFY_EMAIL_API = '/api/account/email/verify';
  453 | 
  454 | /** Boîte de dialogue ouverte, modale simple ou de confirmation (ConfirmDialog). */
  455 | function anyDialog(page: Page, name?: RegExp): Locator {
  456 |     return name
  457 |         ? page.getByRole('dialog', { name }).or(page.getByRole('alertdialog', { name }))
  458 |         : page.getByRole('dialog').or(page.getByRole('alertdialog'));
  459 | }
  460 | 
  461 | /** Fiche partenaire d'un compte organisateur du seed de démonstration (erreur explicite si le seed ne l'a pas écrite). */
  462 | function partnerIdOf(i: DemoIds | null, key: DemoAccountKey): string {
  463 |     const id = ids(i).accounts[key].partnerId;
  464 |     if (!id) throw new Error(`[e2e] demo-ids.json : accounts.${key}.partnerId absent (fiche partenaire du seed de démonstration)`);
  465 |     return id;
  466 | }
  467 | 
  468 | /** Écran existant prolongé d'un contrôle après ses propres actions. */
  469 | function withExtraActions(screen: Screen, extra: (c: ScreenContext) => Promise<void>): Screen {
  470 |     return {
  471 |         ...screen,
  472 |         actions: async (c) => {
  473 |             if (screen.actions) await screen.actions(c);
  474 |             await extra(c);
  475 |         },
  476 |     };
  477 | }
  478 | 
  479 | /** Requêtes déjà parties vers un chemin d'API, lues dans le minutage des ressources de la page. */
  480 | async function requestsTo(page: Page, pathname: string): Promise<number> {
  481 |     return page.evaluate((p) => performance.getEntriesByType('resource').filter((e) => new URL(e.name).pathname === p).length, pathname);
  482 | }
  483 | 
  484 | // ── Lot 9 ter : zones, portes, liste des invités, stock, versements (contrat 7.1 à 7.4) ──
  485 | 
  486 | /** Clés de la graine v4 (D.3.2, fix(9t.seed), vague F), absentes de DemoIds jusque-là. */
  487 | type Lot9terEventKey = 'zones' | 'dernieresPlaces';
  488 | 
  489 | /** Événement de la graine v4 lu par sa clé ; erreur explicite tant que le seed ne l'a pas écrit (capture rouge). */
  490 | function seedEvent(i: DemoIds | null, key: Lot9terEventKey): DemoEvent {
  491 |     const events = ids(i).events as Partial<Record<string, DemoEvent>>;
  492 |     const event = events[key];
  493 |     if (!event?.id) throw new Error(`[e2e] demo-ids.json : events.${key} absent (graine v4 du lot 9 ter, fix(9t.seed))`);
  494 |     return event;
  495 | }
  496 | 
  497 | /** Plein écran du résultat (CombatFlashOverlay). */
  498 | function scanOverlay(page: Page): Locator {
  499 |     return page.locator('[data-scan-state="result"]');
  500 | }
  501 | 
  502 | /** Jeton scan-used du lot 9 ter (#991B1B, C.2.4), tel que getComputedStyle le rend. */
  503 | const SCAN_USED_RED = 'rgb(153, 27, 27)';
  504 | 
  505 | /** Zones et portes des réponses imposées du scanner : identifiants inconnus de la base (C.6). */
  506 | const ZONE_ENTREE_VIP = { id: '00000000-0000-4000-8000-000000000911', name: 'Entrée VIP', kind: 'ENTREE', implicit: false };
  507 | const ZONE_ENTREE_GENERALE = { id: '00000000-0000-4000-8000-000000000912', name: 'Entrée générale', kind: 'ENTREE', implicit: false };
  508 | const ZONE_CARRE_VIP = { id: '00000000-0000-4000-8000-000000000913', name: 'Carré VIP', kind: 'CONTROLE', implicit: false };
  509 | const GATE_VIP = { id: '00000000-0000-4000-8000-000000000921', name: 'Porte VIP' };
  510 | const GATE_NORD = { id: '00000000-0000-4000-8000-000000000922', name: 'Porte Nord' };
  511 | const GATE_ACCES_CARRE = { id: '00000000-0000-4000-8000-000000000923', name: 'Accès carré' };
  512 | const SCAN_TICKET_VIP = { ...SCAN_TICKET, category: 'VIP' };
  513 | /** Consigne d'entrée de la capture scanner-accepte-consigne (C.6, mot pour mot). */
  514 | const ENTRY_INSTRUCTION_VIP = 'Remettre bracelet doré — orienter vers le carré VVIP';
  515 | 
  516 | /** Texte exact de GATE_REQUIRED au scan (contrat 11.3). */
  517 | const GATE_REQUIRED_MESSAGE = 'Aucune porte ne vous est attribuée : demandez à l’organisateur de vous en attribuer une. Rien n’a été validé.';
  518 | 
  519 | /** Plein écran attendu : résultat, famille de couleur (data-scan-category) et textes exacts de C.2.4. */
  520 | async function expectScanLines(page: Page, category: string, lines: readonly string[]): Promise<void> {
  521 |     const overlay = scanOverlay(page);
  522 |     await expect(overlay, `famille du résultat (C.2.4) : ${category}`).toHaveAttribute('data-scan-category', category);
  523 |     for (const line of lines) {
> 524 |         await expect(overlay.getByText(line, { exact: true }).first(), `texte exact du plein écran (C.2.4) : « ${line} »`).toBeVisible();
      |                                                                                                                            ^ Error: texte exact du plein écran (C.2.4) : « Passez d’abord par : Entrée VIP »
  525 |     }
  526 | }
  527 | 
  528 | const GUESTS_URL = /\/api\/controller\/scan\/guests$/;
  529 | /** Réponse imposée de POST /api/controller/scan/guests (C.6) : deux billets d'un même invité, identifiants inconnus de la base. */
  530 | const GUEST_SEARCH_STUB = {
  531 |     items: [{
  532 |         guest_name: 'Awa Diop', category: 'VIP', ticket_count: 2,
  533 |         ticket_ids: ['00000000-0000-4000-8000-000000000941', '00000000-0000-4000-8000-000000000942'],
  534 |     }],
  535 |     truncated: false,
  536 | };
  537 | 
  538 | /**
  539 |  * Liste des invités du scanner (C.3.5) : ouverture hors du groupe « Mode de contrôle », saisie des 4 derniers chiffres,
  540 |  * recherche envoyée avec `query` (corps de la route, C.3.4), carte de l'invité de la réponse imposée.
  541 |  */
  542 | async function searchGuestList(page: Page): Promise<void> {
  543 |     await page.getByRole('button', { name: /^liste des invités$/i }).click();
  544 |     await expect(page.getByRole('heading', { name: /^liste des invités$/i })).toBeVisible();
  545 |     await page.getByLabel(/^numéro de l.invité/i).fill('4567');
  546 |     const sent = page.waitForRequest((r) => GUESTS_URL.test(new URL(r.url()).pathname) && r.method() === 'POST');
  547 |     await page.getByRole('button', { name: /^rechercher$/i }).click();
  548 |     const body = (await sent).postDataJSON() as { query?: unknown } | null;
  549 |     expect(body?.query, 'recherche envoyée avec les 4 chiffres saisis (C.3.4)').toBe('4567');
  550 |     await expect(page.getByText('Awa Diop', { exact: true }).first()).toBeVisible();
  551 |     await expect(page.getByText('2 billets', { exact: true }).first()).toBeVisible();
  552 |     await expect(page.getByRole('button', { name: /^choisir/i }), 'un bouton « Choisir » par invité trouvé').toHaveCount(1);
  553 | }
  554 | 
  555 | /** Lot 9 ter (B.6) : retrait en cours depuis 2 h, marqué retardé par le serveur. */
  556 | const TWO_HOURS_AGO = new Date(Date.now() - 2 * 3_600_000).toISOString();
  557 | 
  558 | /** Réponse imposée de GET /api/finance/balance (B.6) : un retrait PROCESSING retardé, identifiant inconnu de la base. */
  559 | function delayedWithdrawalBalance(account: 'ORGANISATEUR' | 'PARRAINAGE'): Record<string, unknown> {
  560 |     return {
  561 |         account_kind: account, available: 4000, pending: 0, next_available_at: null, in_progress: 6000, debt: 0, frozen: 0,
  562 |         withdrawable: 4000, withdrawal_min_amount: 5000, withdrawal_fee_rate: 1, history: [],
  563 |         withdrawals: [{
  564 |             id: '00000000-0000-4000-8000-000000000901', gross_amount: 6000, fee_amount: 60, net_amount: 5940, status: 'PROCESSING',
  565 |             operator: 'WAVE', phone_number: '771234567', withdrawal_method: 'MOBILE_MONEY', created_at: TWO_HOURS_AGO, processed_at: null,
  566 |             rejection_reason: null, effective_status: 'PROCESSING', delayed: true,
  567 |         }],
  568 |     };
  569 | }
  570 | 
  571 | /** Badge « Retardé » et phrase des deux écrans de retraits (0.9). */
  572 | async function delayedWithdrawalReady(page: Page): Promise<void> {
  573 |     await expect(page.getByText('Retardé', { exact: true }).filter({ visible: true }).first(), 'badge « Retardé » (delayed servi par le serveur)').toBeVisible();
  574 |     const phrase = page.getByText('Retardé : l’équipe Event Village s’en occupe.', { exact: true }).filter({ visible: true }).first();
  575 |     await expect(phrase).toBeVisible();
  576 |     await revealCenter(phrase);
  577 | }
  578 | 
  579 | /**
  580 |  * Fiche admin imposée (B.6) au format d'AdminEventsService.getEventSheet : événement SUSPENDU dont la fin est passée,
  581 |  * seule action « Clore l’événement » avec motif. Identifiants inconnus de la base : une clôture envoyée par erreur ne
  582 |  * toucherait aucun événement réel.
  583 |  */
  584 | const CLOSING_SHEET = {
  585 |     event: {
  586 |         id: '00000000-0000-4000-8000-000000000931', title: 'Festival des Lumières de Saint-Louis', status: 'SUSPENDU',
  587 |         description: 'Trois scènes sur les quais, musiques mandingues et mbalax jusqu’à l’aube.', category: 'FESTIVAL', image_url: null,
  588 |         start_date: '2026-11-01', start_time: '20:00', end_date: '2026-11-02', end_time: '02:00', location: 'Quai Henri Jay', city: 'Saint-Louis',
  589 |         capacity: 800, program: [], practical_info: null, created_at: '2026-10-10T09:00:00.000Z', updated_at: '2026-11-01T18:00:00.000Z',
  590 |     },
  591 |     categories: [{
  592 |         id: '00000000-0000-4000-8000-000000000932', name: 'Standard', description: null, price: 5000, total_quantity: 600,
  593 |         sale_start: null, sale_end: null, max_per_order: 10, sale_online: true, sale_counter: true, is_active: true,
  594 |     }],
  595 |     organizer: {
  596 |         id: '00000000-0000-4000-8000-000000000933', company_name: 'Ndar Événements', commercial_name: null, phone: '+221771234567', email: null,
  597 |         city: 'Saint-Louis', status: 'VALIDE', contact_name: 'Mariama Sall', contact_phone: '+221771234567', contact_email: null,
  598 |     },
  599 |     history: [
  600 |         {
  601 |             id: '00000000-0000-4000-8000-000000000934', old_status: 'PUBLIE', new_status: 'SUSPENDU', actor_role: 'ADMIN', actor_name: 'Ousmane Diallo',
  602 |             reason: 'Lieu fermé par arrêté préfectoral : en attente d’une nouvelle date.', channel: 'TRANSITION', created_at: '2026-11-01T18:00:00.000Z',
  603 |         },
  604 |         {
  605 |             id: '00000000-0000-4000-8000-000000000935', old_status: null, new_status: 'BROUILLON', actor_role: 'PARTENAIRE', actor_name: 'Mariama Sall',
  606 |             reason: null, channel: 'CREATION', created_at: '2026-10-10T09:00:00.000Z',
  607 |         },
  608 |     ],
  609 |     actions: {
  610 |         status: 'SUSPENDU', actions: [{ to: 'TERMINE', label: 'Clore l’événement', reason_required: true }], can_edit: false, can_cancel: false,
  611 |         last_reason: { kind: 'SUSPENSION', reason: 'Lieu fermé par arrêté préfectoral : en attente d’une nouvelle date.', at: '2026-11-01T18:00:00.000Z' },
  612 |     },
  613 |     cancellation: null,
  614 | };
  615 | 
  616 | const ENTRIES_URL = /\/api\/partner\/events\/[^/]+\/pilotage\/entries$/;
  617 | const ENTRIES_GATE_NORD = '00000000-0000-4000-8000-000000000951';
  618 | const ENTRIES_GATE_SUD = '00000000-0000-4000-8000-000000000952';
  619 | const ENTRIES_GATE_CARRE = '00000000-0000-4000-8000-000000000953';
  620 | const ENTRIES_ZONE_GENERALE = '00000000-0000-4000-8000-000000000954';
  621 | const ENTRIES_ZONE_CARRE = '00000000-0000-4000-8000-000000000955';
  622 | /** 30 minutes de débit (heure de Dakar), les 5 dernières à 11 entrées : 2,2 par minute. */
  623 | const ENTRIES_BY_MINUTE = Array.from({ length: 30 }, (_, k) => ({
  624 |     start: `2026-11-07T20:${String(30 + k).padStart(2, '0')}:00`,
```