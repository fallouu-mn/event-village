# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · fumee-superadmin >> admin-versements-marquer-verse — Administration — versements à reprendre : boîte « Marquer versé » (justification, référence ; réponses imposées)
- Location: e2e/captures.spec.ts:185:9

# Error details

```
Error: un bouton « Constater non versé » par ligne où can_mark_not_sent est vrai (lot 9 ter, A.2.4)

expect(locator).toHaveCount(expected) failed

Locator:  getByRole('button', { name: /^constater non versé/i }).visible()
Expected: 1
Received: 0
Timeout:  15000ms

Call log:
  - un bouton « Constater non versé » par ligne où can_mark_not_sent est vrai (lot 9 ter, A.2.4) getByRole('button', { name: /^constater non versé/i }).visible() with timeout 15000ms
  - waiting for getByRole('button', { name: /^constater non versé/i }).visible()
    34 × locator resolved to 0 elements
       - unexpected value "0"

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
        - generic [ref=e15]: Administration
        - link "Tableau de bord" [ref=e20] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=e27]:
          - paragraph [ref=e28]: Gestion
          - generic [ref=e29]:
            - link "Événements" [ref=e30] [cursor=pointer]:
              - /url: /admin/events
            - link "Utilisateurs" [ref=e34] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=e41] [cursor=pointer]:
              - /url: /admin/services
        - generic [ref=e47]:
          - paragraph [ref=e48]: Finances
          - generic [ref=e49]:
            - link "Finance" [ref=e50] [cursor=pointer]:
              - /url: /admin/finance
            - link "Tarification" [ref=e54] [cursor=pointer]:
              - /url: /admin/pricing
        - generic [ref=e57]:
          - paragraph [ref=e58]: Engagement
          - generic [ref=e59]:
            - link "Parrainage" [ref=e60] [cursor=pointer]:
              - /url: /admin/referral
            - link "Communications" [ref=e65] [cursor=pointer]:
              - /url: /admin/communications
        - generic [ref=e70]:
          - paragraph [ref=e71]: Système
          - generic [ref=e72]:
            - link "Journal d’audit" [ref=e73] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=e78] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=e85] [cursor=pointer]:
              - /url: /scan
        - link "Retour au site" [ref=e94] [cursor=pointer]:
          - /url: /
      - generic [ref=e99]:
        - link "Elhadji SuperAdmin Super administrateur" [ref=e100] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e101]: ES
          - generic [ref=e102]:
            - generic [ref=e103]: Elhadji SuperAdmin
            - generic [ref=e104]: Super administrateur
        - generic [ref=e105]:
          - button "Se déconnecter" [ref=e106] [cursor=pointer]
          - button "Basculer le thème" [ref=e111] [cursor=pointer]
    - generic [ref=e115]:
      - banner [ref=e116]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e118] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 38 non lues" [ref=e125] [cursor=pointer]:
          - generic [ref=e129]: "38"
      - main [ref=e130]:
        - generic [ref=e132]:
          - generic [ref=e133]:
            - link "Tableau de bord" [ref=e135] [cursor=pointer]:
              - /url: /admin/dashboard
            - generic [ref=e140]:
              - heading "Rapprochement financier" [level=1] [ref=e142]
              - generic [ref=e143]:
                - link "Réglages de la plateforme" [ref=e144] [cursor=pointer]:
                  - /url: /admin/finance-settings
                - button "Actualiser" [ref=e146] [cursor=pointer]
          - region "Synthèse financière" [ref=e154]:
            - generic [ref=e155]:
              - text: Volume encaissé
              - paragraph [ref=e156]: 0 F CFA
              - generic [ref=e157]: 0 paiement(s), frais de service compris
            - generic [ref=e158]:
              - text: Frais de service perçus
              - paragraph [ref=e159]: 0 F CFA
              - generic [ref=e160]: Payés par les acheteurs, montants enregistrés sur chaque paiement
            - generic [ref=e161]:
              - text: Frais agrégateur (SamirPay)
              - paragraph [ref=e162]: 0 F CFA
              - generic [ref=e163]: Prélevés sur les frais de service
            - generic [ref=e164]:
              - text: Revenu net Event Village
              - paragraph [ref=e165]: 0 F CFA
              - generic [ref=e166]: Frais de service moins frais agrégateur, remboursements déduits
            - generic [ref=e167]:
              - text: Reversements partenaires
              - paragraph [ref=e168]: 0 F CFA
              - generic [ref=e169]: Prix des billets et prestations dus aux partenaires
            - generic [ref=e170]:
              - text: Remboursements versés
              - paragraph [ref=e171]: 0 F CFA
              - generic [ref=e172]: Remboursements confirmés sur la période
          - region "Parrainage, retraits et écarts" [ref=e173]:
            - generic [ref=e175]:
              - text: Commissions de parrainage
              - paragraph [ref=e176]: 0 F CFA
            - generic [ref=e183]:
              - text: Revenu net après parrainage
              - paragraph [ref=e184]: 0 F CFA
            - generic [ref=e188]:
              - text: Retraits versés
              - paragraph [ref=e189]: 0 F CFA
            - generic [ref=e193]:
              - text: Écarts de rapprochement
              - paragraph [ref=e194]: 0 anomalie
          - region [ref=e198]:
            - generic [ref=e199]:
              - heading "Frais SamirPay" [level=2] [ref=e200]
              - paragraph [ref=e201]: Frais réellement prélevés sur les versements confirmés de la période, comparés à l’estimation au taux de retrait réglé.
            - generic [ref=e202]:
              - generic [ref=e203]:
                - text: Frais réels des versements
                - paragraph [ref=e204]: 4 290 F CFA
                - generic [ref=e205]: 12 versements aux frais connus
              - generic [ref=e206]:
                - text: Frais estimés
                - paragraph [ref=e207]: 4 200 F CFA
                - generic [ref=e208]: "Au taux de retrait réglé : 1,5 %"
              - generic [ref=e209]:
                - text: Écart (réels moins estimés)
                - paragraph [ref=e210]: 90 F CFA
                - generic [ref=e213]: Les versements coûtent plus que l’estimation.
            - paragraph [ref=e214]:
              - generic [ref=e217]: "Encaissements : Frais réels non fournis par SamirPay pour ce mode d’encaissement : comparez avec votre tableau de bord SamirPay."
          - region [ref=e218]:
            - generic [ref=e219]:
              - heading "Versements à reprendre" [level=2] [ref=e220]
              - paragraph [ref=e221]: Remboursements et retraits refusés, bloqués, à l’issue incertaine ou en attente depuis plus de 30 minutes, du plus ancien au plus récent.
            - table [ref=e224]:
              - caption [ref=e225]: Versements à reprendre
              - rowgroup [ref=e226]:
                - row [ref=e227]:
                  - columnheader "Montant" [ref=e228]
                  - columnheader "Versement" [ref=e229]
                  - columnheader "Bénéficiaire" [ref=e230]
                  - columnheader "État" [ref=e231]
                  - columnheader "Depuis le" [ref=e232]
                  - columnheader "Reprise" [ref=e233]
              - rowgroup [ref=e234]:
                - row [ref=e235]:
                  - cell "5 250 F CFA" [ref=e236]
                  - cell [ref=e237]:
                    - generic [ref=e238]:
                      - paragraph [ref=e239]: Remboursement d’un billet
                      - paragraph [ref=e240]: Croisière musicale vers Gorée
                  - cell "77 ••• •• 34" [ref=e241]
                  - cell "Envoi en échec Refusé par l’opérateur Mobile Money" [ref=e242]:
                    - generic [ref=e243]:
                      - generic [ref=e244]: Envoi en échec
                      - generic [ref=e246]: Refusé par l’opérateur Mobile Money
                  - cell [ref=e247]:
                    - time [ref=e248]: mer. 4 nov. 2026 à 18:30
                  - cell [ref=e249]:
                    - generic [ref=e251]:
                      - button "Renvoyer le versement de 5 250 F CFA" [ref=e252] [cursor=pointer]:
                        - generic [ref=e257]: Renvoyer
                      - button "Marquer versé le versement de 5 250 F CFA" [ref=e258] [cursor=pointer]:
                        - generic [ref=e263]: Marquer versé
                - row [ref=e264]:
                  - cell "48 500 F CFA" [ref=e265]
                  - cell [ref=e266]:
                    - paragraph [ref=e268]: Retrait
                  - cell "76 ••• •• 18" [ref=e269]
                  - cell "Bloqué Solde SamirPay insuffisant" [ref=e270]:
                    - generic [ref=e271]:
                      - generic [ref=e272]: Bloqué
                      - generic [ref=e274]: Solde SamirPay insuffisant
                  - cell [ref=e275]:
                    - time [ref=e276]: mer. 4 nov. 2026 à 19:05
                  - cell [ref=e277]:
                    - generic [ref=e279]:
                      - button "Renvoyer le versement de 48 500 F CFA" [ref=e280] [cursor=pointer]:
                        - generic [ref=e285]: Renvoyer
                      - button "Marquer versé le versement de 48 500 F CFA" [ref=e286] [cursor=pointer]:
                        - generic [ref=e291]: Marquer versé
                - row [ref=e292]:
                  - cell "3 150 F CFA" [ref=e293]
                  - cell [ref=e294]:
                    - generic [ref=e295]:
                      - paragraph [ref=e296]: Annulation d’événement
                      - paragraph [ref=e297]: Festival Jazz sur le Fleuve
                  - cell "78 ••• •• 52" [ref=e298]
                  - cell "Issue incertaine" [ref=e299]
                  - cell [ref=e303]:
                    - time [ref=e304]: mer. 4 nov. 2026 à 20:40
                  - cell [ref=e305]:
                    - generic [ref=e306]:
                      - paragraph [ref=e307]: Vérifiez auprès du support SamirPay. Si le versement est parti, marquez-le versé avec sa référence.
                      - button "Marquer versé le versement de 3 150 F CFA" [ref=e309] [cursor=pointer]:
                        - generic [ref=e314]: Marquer versé
                - row [ref=e315]:
                  - cell "10 500 F CFA" [ref=e316]
                  - cell [ref=e317]:
                    - generic [ref=e318]:
                      - paragraph [ref=e319]: Remboursement d’un paiement
                      - paragraph [ref=e320]: Nuit du Sabar — édition d’automne
                  - cell "70 ••• •• 61" [ref=e321]
                  - cell "Envoyé, non confirmé" [ref=e322]
                  - cell [ref=e326]:
                    - time [ref=e327]: mer. 4 nov. 2026 à 21:10
                  - cell [ref=e328]:
                    - generic [ref=e330]:
                      - button "Renvoyer le versement de 10 500 F CFA" [ref=e331] [cursor=pointer]:
                        - generic [ref=e336]: Renvoyer
                      - button "Marquer versé le versement de 10 500 F CFA" [ref=e337] [cursor=pointer]:
                        - generic [ref=e342]: Marquer versé
                - row [ref=e343]:
                  - cell "7 350 F CFA" [ref=e344]
                  - cell [ref=e345]:
                    - generic [ref=e346]:
                      - paragraph [ref=e347]: Remboursement d’un billet
                      - paragraph [ref=e348]: Croisière musicale vers Gorée
                  - cell "77 ••• •• 09" [ref=e349]
                  - cell "Bloqué Opérateur Mobile Money inconnu" [ref=e350]:
                    - generic [ref=e351]:
                      - generic [ref=e352]: Bloqué
                      - generic [ref=e354]: Opérateur Mobile Money inconnu
                  - cell [ref=e355]:
                    - time [ref=e356]: mer. 4 nov. 2026 à 21:45
                  - cell [ref=e357]:
                    - button "Marquer versé le versement de 7 350 F CFA" [ref=e360] [cursor=pointer]:
                      - generic [ref=e365]: Marquer versé
          - region [ref=e366]:
            - generic [ref=e367]:
              - generic [ref=e368]:
                - heading "Paiements rapprochés" [level=2] [ref=e369]
                - paragraph [ref=e370]: "Contrôle automatique, paiement par paiement : total débité = reversement partenaire + frais de service ; frais de service = frais agrégateur + revenu net Event Village."
              - generic [ref=e371]:
                - generic [ref=e372]:
                  - generic [ref=e373]: Statut
                  - combobox "Statut" [ref=e376] [cursor=pointer]:
                    - option "Tous les paiements encaissés" [selected]
                    - option "Confirmés"
                    - option "Partiellement remboursés"
                    - option "Remboursement en cours"
                    - option "Remboursés"
                - group "Période" [ref=e377]:
                  - button "Tout" [pressed] [ref=e378] [cursor=pointer]
                  - button "30 jours" [ref=e379] [cursor=pointer]
                  - button "7 jours" [ref=e380] [cursor=pointer]
            - paragraph [ref=e384]: Aucun paiement encaissé pour cette période.
  - alert [ref=e385]
```

# Test source

```ts
  324 | }
  325 | 
  326 | /** Étape « Billetterie » du formulaire d'un événement (EventForm, navigation par étapes). */
  327 | async function openTicketingStep(page: Page): Promise<void> {
  328 |     await page.getByRole('navigation', { name: /^étapes du formulaire$/i }).getByRole('button', { name: /billetterie/i }).click();
  329 |     await expect(page.getByRole('heading', { name: /^billetterie$/i })).toBeVisible();
  330 | }
  331 | 
  332 | const ONLINE_BOX = /^vendue en ligne/i;
  333 | const COUNTER_BOX = /^vendue au guichet/i;
  334 | 
  335 | /** Blocs des catégories enregistrées (EventTicketingManager), repérés par la case du guichet. */
  336 | function categorySections(page: Page): Locator {
  337 |     return page.locator('section').filter({ has: page.getByRole('checkbox', { name: COUNTER_BOX }) });
  338 | }
  339 | 
  340 | const REFUNDS_URL = /\/api\/admin\/refunds(\?.*)?$/;
  341 | const RECONCILIATION_URL = /\/api\/admin\/finance\/reconciliation(\?.*)?$/;
  342 | /** Lot 9 bis (B2, D-ver D1) : conseil exact d'un versement incertain sans identifiant SamirPay (seul « Marquer versé »). */
  343 | const ADVICE_UNCERTAIN_NO_ID = 'Vérifiez auprès du support SamirPay. Si le versement est parti, marquez-le versé avec sa référence.';
  344 | /**
  345 |  * Lot 9 bis (contrat 4.1, B1, B2 ; tableau « Renvoyer / Marquer versé » de la découverte D-ver) : réponse de
  346 |  * GET /api/admin/refunds?state=to_retry, du plus ancien au plus récent. Cinq versements, retrait compris :
  347 |  * « Renvoyer » sur 3 lignes (can_resend 'NOW' ou 'AFTER_CHECK'), « Marquer versé » sur les 5 (can_mark_paid).
  348 |  * Identifiants inconnus de la base : une action envoyée par erreur ne toucherait aucun versement réel.
  349 |  */
  350 | const CASHOUTS_TO_RESUME = {
  351 |     items: [
  352 |         {
  353 |             id: 'f7b8c4ba-28ef-43ab-9ed1-b0cfd23e4a4a', kind: 'TICKET_REFUND', kind_label: 'Remboursement d’un billet', state: 'ECHOUE', state_label: 'Envoi en échec',
  354 |             since: '2026-11-04T18:30:00.000Z', amount: 5250, beneficiary: '77 ••• •• 34', event_title: 'Croisière musicale vers Gorée',
  355 |             block_label: 'Refusé par l’opérateur Mobile Money', can_resend: 'NOW', can_mark_paid: true, can_mark_not_sent: false, advice: null,
  356 |         },
  357 |         {
  358 |             id: '19dae6dc-4a0b-45cd-9af3-d2e1f4506c6c', kind: 'WITHDRAWAL', kind_label: 'Retrait', state: 'BLOQUE', state_label: 'Bloqué',
  359 |             since: '2026-11-04T19:05:00.000Z', amount: 48500, beneficiary: '76 ••• •• 18', event_title: null,
  360 |             block_label: 'Solde SamirPay insuffisant', can_resend: 'NOW', can_mark_paid: true, can_mark_not_sent: false, advice: null,
  361 |         },
  362 |         {
  363 |             id: '3bfc08fe-6c2d-47ef-9c15-f40316728e8e', kind: 'EVENT_CANCELLATION_REFUND', kind_label: 'Annulation d’événement', state: 'INCERTAIN', state_label: 'Issue incertaine',
  364 |             since: '2026-11-04T20:40:00.000Z', amount: 3150, beneficiary: '78 ••• •• 52', event_title: 'Festival Jazz sur le Fleuve',
  365 |             block_label: null, can_resend: false, can_mark_paid: true, can_mark_not_sent: true, advice: ADVICE_UNCERTAIN_NO_ID,
  366 |         },
  367 |         {
  368 |             id: '4c0d19ef-7d3e-48fa-8d26-a51827839f9f', kind: 'REFUND', kind_label: 'Remboursement d’un paiement', state: 'ENVOYE_NON_CONFIRME', state_label: 'Envoyé, non confirmé',
  369 |             since: '2026-11-04T21:10:00.000Z', amount: 10500, beneficiary: '70 ••• •• 61', event_title: 'Nuit du Sabar — édition d’automne',
  370 |             block_label: null, can_resend: 'AFTER_CHECK', can_mark_paid: true, can_mark_not_sent: false, advice: null,
  371 |         },
  372 |         {
  373 |             id: '5d1e2a0f-8e4f-49ab-9e37-b62938940aa0', kind: 'TICKET_REFUND', kind_label: 'Remboursement d’un billet', state: 'BLOQUE', state_label: 'Bloqué',
  374 |             since: '2026-11-04T21:45:00.000Z', amount: 7350, beneficiary: '77 ••• •• 09', event_title: 'Croisière musicale vers Gorée',
  375 |             block_label: 'Opérateur Mobile Money inconnu', can_resend: false, can_mark_paid: true, can_mark_not_sent: false, advice: null,
  376 |         },
  377 |     ],
  378 |     total: 5,
  379 | };
  380 | const CASHOUTS_RESENDABLE = CASHOUTS_TO_RESUME.items.filter((i) => i.can_resend !== false).length;
  381 | const CASHOUTS_MARKABLE = CASHOUTS_TO_RESUME.items.filter((i) => i.can_mark_paid).length;
  382 | /** Lot 9 ter (A.2.3, A.2.6) : « Constater non versé » sur la seule ligne INCERTAIN sans identifiant SamirPay (SUPERADMIN). */
  383 | const CASHOUTS_NOT_SENT = CASHOUTS_TO_RESUME.items.filter((i) => i.can_mark_not_sent).length;
  384 | const EMPTY_RECONCILIATION = {
  385 |     summary: {
  386 |         period: 'Tout', totalTransactionsCount: 0, totalGrossVolume: 0, totalServiceFees: 0, totalAggregatorFees: 0, totalPlatformNetRevenue: 0,
  387 |         totalPartnerPayouts: 0, totalReferralCommissions: 0, totalWithdrawalsPaid: 0, totalRefunds: 0, platformNetBalance: 0, discrepanciesCount: 0,
  388 |     },
  389 |     items: [],
  390 |     // Lot 9 bis (H6, contrat 4.1), relecture des captures du run 121 : sans ces champs, readCashoutFees (app/admin/finance/page.tsx)
  391 |     // affichait « Frais SamirPay non disponibles » sur la capture. Forme de cashoutFeeReconciliation (lib/admin/finance-reconciliation.ts) ;
  392 |     // cashinNote recopie CASHIN_FEES_NOTE. Aucun versement à la page : 12 versements aux frais connus, 280 000 F CFA au taux de 1,5 %.
  393 |     cashoutFeesReal: 4290,
  394 |     cashoutFeesEstimated: 4200,
  395 |     gap: 90,
  396 |     cashoutFeeRate: 1.5,
  397 |     cashoutCount: 12,
  398 |     cashinFeesReal: null,
  399 |     cashinNote: 'Frais réels non fournis par SamirPay pour ce mode d’encaissement : comparez avec votre tableau de bord SamirPay.',
  400 | };
  401 | /** Lot 9 bis : réponses imposées des deux écrans « Versements à reprendre » (fumee-superadmin, B114). */
  402 | const CASHOUTS_STUBS: StubResponse[] = [
  403 |     { url: RECONCILIATION_URL, method: 'GET', status: 200, body: EMPTY_RECONCILIATION },
  404 |     { url: REFUNDS_URL, method: 'GET', status: 200, body: CASHOUTS_TO_RESUME },
  405 | ];
  406 | 
  407 | /**
  408 |  * Lot 9 bis : « Versements à reprendre » de /admin/finance (RefundsToRetry, contrat 5.1) chargé : titre exact, ligne
  409 |  * « Retrait » (retraits compris, R10), conseil exact d'un versement incertain sans identifiant (B2), puis un bouton
  410 |  * « Renvoyer » par ligne où can_resend n'est pas faux et un « Marquer versé » par ligne où can_mark_paid est vrai
  411 |  * (R51 : boutons conditionnés), et plus aucun « Relancer » (route retry supprimée, B4). Lot 9 ter (A.2.6) : un
  412 |  * « Constater non versé » par ligne où can_mark_not_sent est vrai (jamais grisé, absent ailleurs).
  413 |  */
  414 | async function cashoutsReady(page: Page): Promise<{ resend: Locator; markPaid: Locator; markNotSent: Locator }> {
  415 |     await expect(page.getByRole('heading', { name: /^versements à reprendre$/i })).toBeVisible();
  416 |     await expect(page.getByText(/^retrait$/i).filter({ visible: true }).first(), 'ligne « Retrait » (retraits compris, R10)').toBeVisible();
  417 |     await expect(page.getByText(ADVICE_UNCERTAIN_NO_ID).filter({ visible: true }).first(), 'conseil d’un versement incertain sans identifiant (B2)').toBeVisible();
  418 |     const resend = page.getByRole('button', { name: /^renvoyer/i }).filter({ visible: true });
  419 |     const markPaid = page.getByRole('button', { name: /^marquer versé/i }).filter({ visible: true });
  420 |     await expect(resend, 'un bouton « Renvoyer » par ligne où can_resend n’est pas faux').toHaveCount(CASHOUTS_RESENDABLE);
  421 |     await expect(markPaid, 'un bouton « Marquer versé » par ligne où can_mark_paid est vrai').toHaveCount(CASHOUTS_MARKABLE);
  422 |     await expect(page.getByRole('button', { name: /^relancer/i }), 'plus aucun « Relancer » (B4)').toHaveCount(0);
  423 |     const markNotSent = page.getByRole('button', { name: /^constater non versé/i }).filter({ visible: true });
> 424 |     await expect(markNotSent, 'un bouton « Constater non versé » par ligne où can_mark_not_sent est vrai (lot 9 ter, A.2.4)').toHaveCount(CASHOUTS_NOT_SENT);
      |                                                                                                                               ^ Error: un bouton « Constater non versé » par ligne où can_mark_not_sent est vrai (lot 9 ter, A.2.4)
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
  524 |         await expect(overlay.getByText(line, { exact: true }).first(), `texte exact du plein écran (C.2.4) : « ${line} »`).toBeVisible();
```