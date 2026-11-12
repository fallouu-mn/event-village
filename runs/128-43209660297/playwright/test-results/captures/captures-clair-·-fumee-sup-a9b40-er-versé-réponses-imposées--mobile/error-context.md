# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · fumee-superadmin >> admin-remboursements-a-reprendre — Administration — finances : versements à reprendre (Renvoyer, Marquer versé ; réponses imposées)
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
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
            - /url: /
        - generic [ref=e16]:
          - button "Notifications, 38 non lues" [ref=e18] [cursor=pointer]:
            - generic [ref=e22]: "38"
          - button "Basculer le thème" [ref=e24] [cursor=pointer]
          - link "Mon profil (Elhadji SuperAdmin)" [ref=e28] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e29]: ES
      - main [ref=e31]:
        - generic [ref=e33]:
          - generic [ref=e34]:
            - link "Tableau de bord" [ref=e36] [cursor=pointer]:
              - /url: /admin/dashboard
            - generic [ref=e41]:
              - heading "Rapprochement financier" [level=1] [ref=e43]
              - generic [ref=e44]:
                - link "Réglages de la plateforme" [ref=e45] [cursor=pointer]:
                  - /url: /admin/finance-settings
                - button "Actualiser" [ref=e47] [cursor=pointer]
          - region "Synthèse financière" [ref=e55]:
            - generic [ref=e56]:
              - text: Volume encaissé
              - paragraph [ref=e57]: 0 F CFA
              - generic [ref=e58]: 0 paiement(s), frais de service compris
            - generic [ref=e59]:
              - text: Frais de service perçus
              - paragraph [ref=e60]: 0 F CFA
              - generic [ref=e61]: Payés par les acheteurs, montants enregistrés sur chaque paiement
            - generic [ref=e62]:
              - text: Frais agrégateur (SamirPay)
              - paragraph [ref=e63]: 0 F CFA
              - generic [ref=e64]: Prélevés sur les frais de service
            - generic [ref=e65]:
              - text: Revenu net Event Village
              - paragraph [ref=e66]: 0 F CFA
              - generic [ref=e67]: Frais de service moins frais agrégateur, remboursements déduits
            - generic [ref=e68]:
              - text: Reversements partenaires
              - paragraph [ref=e69]: 0 F CFA
              - generic [ref=e70]: Prix des billets et prestations dus aux partenaires
            - generic [ref=e71]:
              - text: Remboursements versés
              - paragraph [ref=e72]: 0 F CFA
              - generic [ref=e73]: Remboursements confirmés sur la période
          - region "Parrainage, retraits et écarts" [ref=e74]:
            - generic [ref=e76]:
              - text: Commissions de parrainage
              - paragraph [ref=e77]: 0 F CFA
            - generic [ref=e84]:
              - text: Revenu net après parrainage
              - paragraph [ref=e85]: 0 F CFA
            - generic [ref=e89]:
              - text: Retraits versés
              - paragraph [ref=e90]: 0 F CFA
            - generic [ref=e94]:
              - text: Écarts de rapprochement
              - paragraph [ref=e95]: 0 anomalie
          - region [ref=e99]:
            - generic [ref=e100]:
              - heading "Frais SamirPay" [level=2] [ref=e101]
              - paragraph [ref=e102]: Frais réellement prélevés sur les versements confirmés de la période, comparés à l’estimation au taux de retrait réglé.
            - generic [ref=e103]:
              - generic [ref=e104]:
                - text: Frais réels des versements
                - paragraph [ref=e105]: 4 290 F CFA
                - generic [ref=e106]: 12 versements aux frais connus
              - generic [ref=e107]:
                - text: Frais estimés
                - paragraph [ref=e108]: 4 200 F CFA
                - generic [ref=e109]: "Au taux de retrait réglé : 1,5 %"
              - generic [ref=e110]:
                - text: Écart (réels moins estimés)
                - paragraph [ref=e111]: 90 F CFA
                - generic [ref=e114]: Les versements coûtent plus que l’estimation.
            - paragraph [ref=e115]:
              - generic [ref=e118]: "Encaissements : Frais réels non fournis par SamirPay pour ce mode d’encaissement : comparez avec votre tableau de bord SamirPay."
          - region [ref=e119]:
            - generic [ref=e120]:
              - heading "Versements à reprendre" [level=2] [ref=e121]
              - paragraph [ref=e122]: Remboursements et retraits refusés, bloqués, à l’issue incertaine ou en attente depuis plus de 30 minutes, du plus ancien au plus récent.
            - list "Versements à reprendre" [ref=e124]:
              - listitem [ref=e125]:
                - generic [ref=e126]:
                  - generic [ref=e127]:
                    - paragraph [ref=e128]: 5 250 F CFA
                    - generic [ref=e129]: Envoi en échec
                  - generic [ref=e133]:
                    - paragraph [ref=e134]: Remboursement d’un billet
                    - paragraph [ref=e135]: Croisière musicale vers Gorée
                  - paragraph [ref=e136]: Refusé par l’opérateur Mobile Money
                  - generic [ref=e137]:
                    - generic [ref=e138]: 77 ••• •• 34
                    - time [ref=e139]: mer. 4 nov. 2026 à 18:30
                  - generic [ref=e141]:
                    - button "Renvoyer le versement de 5 250 F CFA" [ref=e142] [cursor=pointer]:
                      - generic [ref=e147]: Renvoyer
                    - button "Marquer versé le versement de 5 250 F CFA" [ref=e148] [cursor=pointer]:
                      - generic [ref=e153]: Marquer versé
              - listitem [ref=e154]:
                - generic [ref=e155]:
                  - generic [ref=e156]:
                    - paragraph [ref=e157]: 48 500 F CFA
                    - generic [ref=e158]: Bloqué
                  - paragraph [ref=e163]: Retrait
                  - paragraph [ref=e164]: Solde SamirPay insuffisant
                  - generic [ref=e165]:
                    - generic [ref=e166]: 76 ••• •• 18
                    - time [ref=e167]: mer. 4 nov. 2026 à 19:05
                  - generic [ref=e169]:
                    - button "Renvoyer le versement de 48 500 F CFA" [ref=e170] [cursor=pointer]:
                      - generic [ref=e175]: Renvoyer
                    - button "Marquer versé le versement de 48 500 F CFA" [ref=e176] [cursor=pointer]:
                      - generic [ref=e181]: Marquer versé
              - listitem [ref=e182]:
                - generic [ref=e183]:
                  - generic [ref=e184]:
                    - paragraph [ref=e185]: 3 150 F CFA
                    - generic [ref=e186]: Issue incertaine
                  - generic [ref=e190]:
                    - paragraph [ref=e191]: Annulation d’événement
                    - paragraph [ref=e192]: Festival Jazz sur le Fleuve
                  - generic [ref=e193]:
                    - generic [ref=e194]: 78 ••• •• 52
                    - time [ref=e195]: mer. 4 nov. 2026 à 20:40
                  - generic [ref=e196]:
                    - paragraph [ref=e197]: Vérifiez auprès du support SamirPay. Si le versement est parti, marquez-le versé avec sa référence.
                    - button "Marquer versé le versement de 3 150 F CFA" [ref=e199] [cursor=pointer]:
                      - generic [ref=e204]: Marquer versé
              - listitem [ref=e205]:
                - generic [ref=e206]:
                  - generic [ref=e207]:
                    - paragraph [ref=e208]: 10 500 F CFA
                    - generic [ref=e209]: Envoyé, non confirmé
                  - generic [ref=e213]:
                    - paragraph [ref=e214]: Remboursement d’un paiement
                    - paragraph [ref=e215]: Nuit du Sabar — édition d’automne
                  - generic [ref=e216]:
                    - generic [ref=e217]: 70 ••• •• 61
                    - time [ref=e218]: mer. 4 nov. 2026 à 21:10
                  - generic [ref=e220]:
                    - button "Renvoyer le versement de 10 500 F CFA" [ref=e221] [cursor=pointer]:
                      - generic [ref=e226]: Renvoyer
                    - button "Marquer versé le versement de 10 500 F CFA" [ref=e227] [cursor=pointer]:
                      - generic [ref=e232]: Marquer versé
              - listitem [ref=e233]:
                - generic [ref=e234]:
                  - generic [ref=e235]:
                    - paragraph [ref=e236]: 7 350 F CFA
                    - generic [ref=e237]: Bloqué
                  - generic [ref=e241]:
                    - paragraph [ref=e242]: Remboursement d’un billet
                    - paragraph [ref=e243]: Croisière musicale vers Gorée
                  - paragraph [ref=e244]: Opérateur Mobile Money inconnu
                  - generic [ref=e245]:
                    - generic [ref=e246]: 77 ••• •• 09
                    - time [ref=e247]: mer. 4 nov. 2026 à 21:45
                  - button "Marquer versé le versement de 7 350 F CFA" [ref=e250] [cursor=pointer]:
                    - generic [ref=e255]: Marquer versé
          - region [ref=e256]:
            - generic [ref=e257]:
              - generic [ref=e258]:
                - heading "Paiements rapprochés" [level=2] [ref=e259]
                - paragraph [ref=e260]: "Contrôle automatique, paiement par paiement : total débité = reversement partenaire + frais de service ; frais de service = frais agrégateur + revenu net Event Village."
              - generic [ref=e261]:
                - generic [ref=e262]:
                  - generic [ref=e263]: Statut
                  - combobox "Statut" [ref=e266] [cursor=pointer]:
                    - option "Tous les paiements encaissés" [selected]
                    - option "Confirmés"
                    - option "Partiellement remboursés"
                    - option "Remboursement en cours"
                    - option "Remboursés"
                - group "Période" [ref=e267]:
                  - button "Tout" [pressed] [ref=e268] [cursor=pointer]
                  - button "30 jours" [ref=e269] [cursor=pointer]
                  - button "7 jours" [ref=e270] [cursor=pointer]
            - paragraph [ref=e274]: Aucun paiement encaissé pour cette période.
    - navigation "Navigation rapide" [ref=e275]:
      - generic [ref=e276]:
        - link "Accueil" [ref=e277] [cursor=pointer]:
          - /url: /admin/dashboard
        - link "Validation" [ref=e284] [cursor=pointer]:
          - /url: /admin/events
        - link "Comptes" [ref=e288] [cursor=pointer]:
          - /url: /admin/users
        - link "Finance" [ref=e295] [cursor=pointer]:
          - /url: /admin/finance
        - link "Audit" [ref=e299] [cursor=pointer]:
          - /url: /admin/audit
  - alert [ref=e303]
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