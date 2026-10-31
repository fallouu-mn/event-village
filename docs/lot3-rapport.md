# LOT 3 — RAPPORT

**Objet :** finance. Ce lot couvre :
- le modèle du CDC ;
- les remboursements réels ;
- les soldes et retraits ;
- la régularisation des commissions.

Constats traités : R22 à R26, ticketing-finance-1 à -8 et -12 à -15, data-model-5, -10 et -13, partner-ux-7, points ouverts 2, 3 et 5 du lot 2, point 9 du lot 1C (objet des codes OTP).

**Branche :** `fix/evenementiel`. Aucun push sur `main`. Rien n'a été exécuté contre le projet Supabase distant ni contre SamirPay : tous les envois passent par le faux SamirPay. Migrations du dépôt uniquement (`20261101000001` à `…08`), appliquées et testées en CI.

**Date :** 31 octobre 2026.

**Résultat :** **vert.** Run 32 (`41242223807`, commit `68bd6a0`) : 77 suites sur 77 (479 sous-tests, aucun échec, aucun test ignoré), typecheck, lint et build compris, au premier passage des correctifs. Au run 31 (référence « avant »), les 15 nouvelles suites du lot étaient en échec, et elles seules. L'invariant étendu (a) à (f) donne 0 violation à la fin de chacune des 11 suites financières.

---

## À lire en premier

1. **Le client paie désormais le prix plus des frais de service.**
   - Total payé = prix facial + frais de service. Les frais (5 %) sont arrondis au FCFA supérieur, billet par billet.
   - L'organisateur reçoit le prix facial.
   - Les frais d'agrégateur (1,5 %) sont calculés sur le total payé, avec un taux par opérateur.
   - Revenu net Event Village = frais de service − frais d'agrégateur.
   - Exemple de l'Annexe C : un billet à 1 000 F donne un débit de 1 050, des frais d'agrégateur de 15,75, 1 000 pour l'organisateur et 34,25 pour Event Village.

   Avant ce lot, le client payait 1 000 et l'organisateur recevait 950. La même règle s'applique aux commandes, salles et tables. Un abonnement, payé à Event Village, n'a pas de frais de service. Ce choix est à valider (point ouvert 1).
2. **Chaque règle est un réglage, aucune n'est codée en dur** (section 3).
   - Seul un SUPERADMIN les modifie, par `PUT /api/admin/finance-settings`, ou par la page `/admin/finance-settings`.
   - Chaque changement est validé et historisé en base.
   - Rien n'est rétroactif : les taux et délais sont recopiés sur chaque paiement, commission et retrait au moment où ils naissent.

   Une décision client différente des valeurs par défaut se traduit donc par un changement de réglage, pas de code.
3. **Les soldes viennent d'un vrai grand livre** (`finance_ledger`), avec deux comptes par personne : ORGANISATEUR et PARRAINAGE.
   - Les fonds organisateur deviennent disponibles 48 h après la fin de l'événement.
   - Les ventes en espèces et les invitations n'y entrent jamais.
   - Un débit qui dépasse le solde devient une créance : alerte aux SUPERADMIN, puis compensation sur les gains suivants.

   Les anciens « soldes » des pages partenaire (somme des prix des billets) n'étaient pas retirables. Ils ont disparu.
4. **Les retraits fonctionnent pour les deux comptes.** Avant ce lot, l'organisateur ne pouvait rien retirer.
   - Chaque retrait est confirmé par un code SMS envoyé au téléphone du compte. Ce code ne vaut que pour un retrait.
   - Le versement passe par le module de cashout du lot 2.
   - Un envoi incertain n'est jamais relancé, et le montant reste réservé jusqu'à vérification.
5. **Le remboursement d'un billet est réel.**
   - Il passe par le module de cashout. Le billet est marqué REMBOURSE et le client prévenu seulement une fois le versement confirmé.
   - Un panier remboursé en partie passe PARTIAL, puis REFUNDED.
   - Avant ce lot : une ligne `refunds` PROCESSED, aucun argent envoyé, et un SMS « remboursé ». La route était de toute façon cassée depuis le lot 2 (« Ticket introuvable »).
6. **Failles corrigées en passant, avec un test de sécurité pour chacune** (`tests/security/r12` à `r14`, clé anon seule) :
   - un client pouvait se créer une relation de parrainage, avec le parrain et les taux de son choix (politique `referral_relationships_insert`) ;
   - un client pouvait insérer un retrait PAID à son nom (politique `withdrawals_insert`) ;
   - un ADMIN pouvait écrire n'importe quel réglage financier, directement ou par `/api/admin/pricing`.
7. **Contrats d'API modifiés**, à connaître pour le front :
   - `POST /api/checkout/quote` est nouveau (devis public) ;
   - `/api/payments/<id>/status` ajoute `facial_amount`, `service_fee` et `refunded_amount` ;
   - `GET /api/finance/balance?account=` est nouveau ;
   - `POST /api/withdrawals/otp` est nouveau ;
   - `POST /api/withdrawals/request` exige désormais `Idempotency-Key`, `account`, `otpCode`, `operator` et `phoneNumber` ;
   - la route de remboursement d'un billet exige `{reason}` (3 caractères au moins) et répond `{mode, cashout_status…}` ;
   - le rapport de clôture et la finance partenaire changent de champs : `totalCommission` est supprimé ; `buyerServiceFees`, `cashSales`, `availableNet` et `pendingNet` sont ajoutés ;
   - `my-stats` ajoute `pendingBalance` et `withdrawable`.
8. **Exploitation** (`docs/deploiement-projet-neuf.md`, §6 ter et §7) :
   - nouvelle tâche planifiée `/api/cron/referral-commissions`, toutes les heures ;
   - le solde SamirPay doit couvrir aussi les retraits ;
   - les réglages sont créés par la migration.
9. **Découpage des commits.** Un commit de tests rouges par tâche, puis un commit de correctifs par tâche, découpé au niveau du fichier. Comme au lot 2, les commits intermédiaires ne compilent pas isolément ; seule la tête est vérifiée par la CI. Le grand livre (migration `…04`, committée avec 3.6) sert aussi aux tâches 3.4, 3.5, 3.7 et 3.8.

---

## 1. Commits

| Commit | Message |
|---|---|
| 5acebe5 | test(infra)[3]: outils des suites financières (réglages restaurés, partenaire dédié, achat confirmé, grand livre) ; invariant du lot 2 : billet payant valide avec un paiement SUCCESS ou PARTIAL (remboursement partiel) |
| b53db78 | test(paiement)[3.0]: parcours minimal des paiements hors billetterie (commande, salle, table, abonnement) : création, confirmation, échec puis libération, montants du moteur |
| 410c2e7 | test(finance)[3.1]: réglages finance.* historisés réservés au SUPERADMIN, non rétroactifs ; moteur unique (Annexe C 1 000 → 1 050 / 15,75 / 1 000 / 34,25, arrondi par billet, taux à 0, Wave ≠ Orange Money), montants et taux persistés, plus de calcul dupliqué |
| 7e5274b | test(finance)[3.2]: devis serveur (sous-total, frais de service, total) = montant envoyé à SamirPay = montant persisté = statut ; frais affichés sur la page, la modale, le suivi, le SMS et le PDF |
| 5b61646 | test(finance)[3.3]: vente espèces sans frais ni revenu Event Village ; agrégats admin et partenaire limités aux paiements plateforme |
| 195ffd4 | test(finance)[3.4]: remboursement d'un billet par le module de cashout (REFUND-TKT-<billet>, part du paiement), statut intermédiaire, paiement PARTIAL puis REFUNDED, billet espèces sans cashout, CONTROLEUR refusé |
| a510a4d | test(finance)[3.5]: commissions EN ATTENTE 7 jours sur le revenu net (N1 1,71 / N2 0,69 sur 34,25), cron de disponibilité, annulation, prorata et régularisation négative au remboursement, grille du CDC ; un client ne crée plus sa relation de parrainage |
| 03e3300 | test(finance)[3.6]: grand livre organisateur et parrainage, fonds disponibles 48 h après l'événement, retraits par le module de cashout (seuil, frais 1 %, banque fermée, concurrence, INCERTAIN), OTP lié à son objet, plus d'insertion directe de retrait |
| 973fb8f | test(finance)[3.7]: annulation d'événement : total client remboursé pour les seuls paiements en ligne ; fonds déjà retirés → créance et alerte |
| 922feac | test(finance)[3.8]: rapport de clôture et finance partenaire depuis le grand livre : net = prix faciaux des billets restants payés en ligne, frais acheteur non déduits, espèces à part |
| 1d8e567 | test(finance)[3.9]: invariant financier étendu (d) répartition des paiements, (e) soldes du grand livre, (f) commissions régularisées ; garde-fou : chaque règle détecte une violation fabriquée |
| 2cc9833 | fix(finance)[3.1]: moteur financier unique en base (finance_compute : frais de service à la charge de l'acheteur au FCFA supérieur par billet, agrégateur par opérateur sur le total, organisateur = facial, net EV = service − agrégateur), taux lus dans les réglages finance.* sans repli ; réglages historisés, réservés au SUPERADMIN, recopiés sur chaque paiement ; checkout et autres cibles débitent le total calculé ; calculs dupliqués supprimés (fees.ts, taux codés) |
| 9534e7c | feat(finance)[3.2]: devis serveur (POST /api/checkout/quote : sous-total, frais de service, total) affiché par la page événement et la modale sans aucun calcul dans le navigateur ; suivi /paiement/[id], SMS de confirmation et PDF du billet avec frais de service et total payé |
| 30e5212 | fix(finance)[3.3]: paiements hors plateforme sans frais ni revenu Event Village (fin_offline) ; agrégats admin et partenaire limités à is_platform_payment = true, revenu EV = Σ (net − part remboursée) (finance_platform_revenue), rapprochement sur les montants persistés |
| b555a74 | fix(finance)[3.4]: remboursement d'un billet par le module de cashout (ticket_refund_request, clé REFUND-TKT-<billet>, part du paiement), billet REMBOURSEMENT_EN_COURS puis REMBOURSE à la confirmation, paiement PARTIAL puis REFUNDED, billet espèces à rembourser par l'organisateur ; partenaire propriétaire ou admin seulement ; plus de remboursement fictif (refundTicket supprimé) |
| 8c25343 | fix(finance)[3.5]: commissions EN ATTENTE avec échéance réglable (7 à 14 jours) sur le revenu net, cron de disponibilité ; au remboursement : annulation, prorata ou régularisation négative (créance sur les gains futurs), historique conservé ; grille referral_config du CDC ; plus de relation de parrainage créée par le client ; my-stats sur le grand livre |
| 69b4dd1 | feat(finance)[3.6]: grand livre des comptes organisateur et parrainage (fonds disponibles à la fin de l'événement + délai, espèces et invitations exclues, créances compensées) ; retraits par withdrawal_request et le module de cashout (seuil et frais réglés, solde réservé sous verrou, INCERTAIN jamais relancé, banque fermée par réglage), OTP obligatoire ; otp_codes.purpose : un code ne vaut que pour son objet ; plus d'insertion directe de retrait |
| 643cbe8 | fix(finance)[3.7]: annulation d'événement : reste dû remboursé au client (frais de service compris) pour les seuls paiements en ligne, espèces à rembourser par l'organisateur, invitations annulées ; billets REMBOURSE et message de versement à la confirmation seulement ; fonds déjà retirés → créance et alerte |
| ae00fda | fix(finance)[3.8]: rapport de clôture (PDF compris), export comptable, tableau de bord et finance partenaire lus depuis le grand livre (finance_partner_summary) : remboursements déduits une seule fois, frais de service payés par l'acheteur affichés sans déduction de l'organisateur, ventes espèces à part |
| 68bd6a0 | test(legacy)[3]: chunk5-phase2-b2c, cas 8 supprimé (WithdrawalService.processWithdrawal remplacé par withdrawal_request et le module de cashout) ; couvert par finance-retraits |

Ce rapport est ajouté par le commit qui suit le dernier de cette liste.

**Écriture des tests.** Les suites rouges ont été écrites par quatre sous-agents, chacun dans son domaine, à partir d'un contrat commun rédigé avant toute écriture (RPC, routes, champs, règles d'arrondi). Seuls des fichiers nouveaux ont été créés. Elles ont été relues, typecheckées sans les correctifs dans une copie propre du dépôt, puis committées avant tout correctif.

### Tests existants modifiés (signalement)

- **`tests/helpers/payment-invariants.ts`** (invariant du lot 2) : les règles (a) et (b) acceptent un paiement PARTIAL. Un panier remboursé en partie garde des billets valides : sans ce changement, l'invariant aurait déclaré fausse une situation désormais légitime. C'est un assouplissement, signalé comme tel. Il est compensé par la règle (d), qui exige un statut PARTIAL cohérent avec le montant remboursé.
- **`tests/parcours/paiement-operateur.test.ts`** : montant envoyé à SamirPay `'4000'` → `'4200'` (prix 4 000 + frais de service acheteur 200). C'est le changement de modèle demandé, pas un relâchement.
- **`tests/parcours/paiement-confirmation.test.ts`** : montant du paiement 2 500 → 2 625, même raison. Le prix du billet attendu reste 2 500 (prix facial lu, jamais recalculé).
- **`tests/partner-orders-m9.test.ts`** : frais de la commande 650 → 700.
  - Avant : commission de 5 % du sous-total (13 000), prélevée sur le partenaire.
  - Après : frais de service payés par l'acheteur, calculés par le moteur sur le montant débité (14 000, livraison comprise).
- **`tests/security/r3-fonctions-rpc.test.ts`** : `request_withdrawal` (supprimée) remplacée par `withdrawal_request`, et 10 RPC du lot 3 ajoutées à la liste refusée à anon et à un client connecté. Le test devient plus strict.
- **`tests/parcours/paiement-remboursement.test.ts`** : l'exemption « `withdrawal.service.ts` peut appeler `sendCashout` » est retirée. Plus strict : les retraits passent par le module de cashout.
- **`tests/seed/seed-test.ts`** : les paiements des billets de référence reçoivent une répartition explicite (facial = prix, sans frais de service), cohérente avec l'invariant (d). Aucune assertion n'est modifiée.

---

## 2. Tâches : grep, test rouge, correctif, test vert

Avant correctif : run CI 31 (`41240412478`, commit `1d8e567`), tests dans leur version finale et aucun correctif appliqué. Après : run 32 (`41242223807`, commit `68bd6a0`). Greps exécutés sur l'arbre du commit `1d8e567`. Journaux bruts sur la branche `ci-results` (`runs/31-41240412478/`, `runs/32-41242223807/`).

**Lecture des blocs « avant ».**
- Les nouvelles suites échouent souvent d'abord sur l'absence d'un réglage, d'une RPC ou d'une route du contrat. C'est un rouge réel mais structurel.
- Les défauts de fond apparaissent dans les cas qui n'en dépendent pas :
  - débit de 1 000 au lieu de 1 050 ;
  - base de commission de 35 au lieu de 34,25 ;
  - montants forgés repris par `checkout_create_payment` ;
  - contrôleur admis au remboursement (400 au lieu de 403) ;
  - « Ticket introuvable » ;
  - total retiré toujours à 0 ;
  - insertions directes acceptées par la RLS ;
  - code OTP d'un autre objet accepté ;
  - ancienne RPC toujours présente.
- `column "net_revenue_reversal" does not exist` est l'erreur levée par l'invariant financier en `after()`, la colonne n'existant pas encore.
- Quelques cas sont verts avant correctif : ce sont des garde-fous. On y trouve les quatre échecs de paiement de `finance-cibles`, l'opérateur inconnu de `finance-moteur`, et les cas 4 et 5 de r12, 3 de r13 et 3 de r14. Ils sont signalés comme tels et ne prouvent rien seuls.

### 3.0 — Filet de sécurité sur les autres paiements (point 3 du lot 2)

```text
$ git grep -n -E 'createPayment\(' 1d8e567 -- app lib
1d8e567:app/api/payments/create/route.ts:47:        const result = await paymentService.createPayment(session.user.id, input);
1d8e567:lib/payments/payment.service.ts:32:    public async createPayment(userId: string, input: CreatePaymentInput): Promise<Record<string, unknown>> {
(code de sortie 0)

$ git grep -n -E 'computeTicketingFees|payableAmount' 1d8e567 -- lib/payments/payment.service.ts
1d8e567:lib/payments/payment.service.ts:16:import { computeTicketingFees } from './fees';
1d8e567:lib/payments/payment.service.ts:39:        let payableAmount = 0;
1d8e567:lib/payments/payment.service.ts:79:                payableAmount = Number(order.balance_amount > 0 ? order.balance_amount : order.total_amount);
1d8e567:lib/payments/payment.service.ts:103:                payableAmount = Number(
1d8e567:lib/payments/payment.service.ts:131:                payableAmount = Number(tableRes.deposit_amount > 0 ? tableRes.deposit_amount : 0);
1d8e567:lib/payments/payment.service.ts:159:                payableAmount = Number(plan.price);
1d8e567:lib/payments/payment.service.ts:169:        if (payableAmount <= 0) {
1d8e567:lib/payments/payment.service.ts:178:        const fees = await computeTicketingFees(payableAmount, { subscription: input.targetType === 'SUBSCRIPTION' });
1d8e567:lib/payments/payment.service.ts:195:            amount: payableAmount,
1d8e567:lib/payments/payment.service.ts:216:                amount: payableAmount,
(code de sortie 0)
```

**Correctif.** Les quatre parcours (commande, salle, table, abonnement) passaient déjà la confirmation et l'échec (garde-fous verts). Le minimum nécessaire est le montant : `PaymentService.createPayment` appliquait la répartition billetterie, avec les frais retenus sur le partenaire. Il passe désormais par le moteur unique (3.1) : frais acheteur pour les cibles marché, aucun pour l'abonnement, taux recopiés. Les défauts relevés mais hors du parcours minimal sont listés en points ouverts (section 7) et ne sont pas corrigés : ce lot ne refond pas ces modules.

**parcours/finance-cibles**

Run 31 (avant correctif) :

```text
    not ok 1 - paiement en ligne : PENDING, montants du contrat, succès SamirPay → SUCCESS, commande confirmée
        → réglage finance.service_fee_rate absent de platform_settings
    ok 2 - échec chez SamirPay, réconciliation → FAILED, commande annulée
not ok 1 - Commande (ORDER)
    not ok 1 - paiement en ligne : PENDING, montants du contrat, succès SamirPay → SUCCESS, réservation confirmée
        → réglage finance.service_fee_rate absent de platform_settings
    ok 2 - échec chez SamirPay, réconciliation → FAILED, réservation annulée (créneau libéré)
not ok 2 - Réservation de salle (HALL_RESERVATION)
    not ok 1 - paiement en ligne : PENDING, montants du contrat, succès SamirPay → SUCCESS, réservation confirmée
        → réglage finance.service_fee_rate absent de platform_settings
    ok 2 - échec chez SamirPay, réconciliation → FAILED, réservation annulée (table libérée)
not ok 3 - Réservation de table (TABLE_RESERVATION)
    not ok 1 - paiement en ligne : PENDING, sans frais de service, succès SamirPay → SUCCESS, plan activé
        → réglage finance.aggregator_fee_rate.WAVE absent de platform_settings
    ok 2 - échec chez SamirPay, réconciliation → FAILED, plan non activé
not ok 4 - Abonnement partenaire (SUBSCRIPTION)
not ok 5 - /home/runner/work/event-village/event-village/tests/parcours/finance-cibles.test.ts
        → column "net_revenue_reversal" does not exist
# pass 4
# fail 4
```

Run 32 (après correctif) :

```text
    ok 1 - paiement en ligne : PENDING, montants du contrat, succès SamirPay → SUCCESS, commande confirmée
    ok 2 - échec chez SamirPay, réconciliation → FAILED, commande annulée
ok 1 - Commande (ORDER)
    ok 1 - paiement en ligne : PENDING, montants du contrat, succès SamirPay → SUCCESS, réservation confirmée
    ok 2 - échec chez SamirPay, réconciliation → FAILED, réservation annulée (créneau libéré)
ok 2 - Réservation de salle (HALL_RESERVATION)
    ok 1 - paiement en ligne : PENDING, montants du contrat, succès SamirPay → SUCCESS, réservation confirmée
    ok 2 - échec chez SamirPay, réconciliation → FAILED, réservation annulée (table libérée)
ok 3 - Réservation de table (TABLE_RESERVATION)
    ok 1 - paiement en ligne : PENDING, sans frais de service, succès SamirPay → SUCCESS, plan activé
    ok 2 - échec chez SamirPay, réconciliation → FAILED, plan non activé
ok 4 - Abonnement partenaire (SUBSCRIPTION)
# pass 8
# fail 0
```

### 3.1 — Moteur financier unique (R22, ticketing-finance-1, -2, -15, data-model-13)

```text
$ git grep -n -E 'computeTicketingFees|ticketing_fee_config|FinancialCalculatorService\.calculate\(' 1d8e567 -- app lib
1d8e567:app/api/partner/metrics/route.ts:53:            supabase.from('platform_settings').select('value').eq('key', 'ticketing_fee_config').maybeSingle(),
1d8e567:app/api/partner/metrics/route.ts:88:                { error: 'Configuration financière manquante: ticketing_fee_config. Contactez le superadmin.' },
1d8e567:lib/partner/partner-dashboard.service.ts:212:            supabase.from('platform_settings').select('value').eq('key', 'ticketing_fee_config').maybeSingle(),
1d8e567:lib/payments/checkout.service.ts:25:import { computeTicketingFees } from './fees';
1d8e567:lib/payments/checkout.service.ts:171:    const fees = await computeTicketingFees(payable);
1d8e567:lib/payments/fees.ts:4: * Les taux viennent de platform_settings.ticketing_fee_config ; leur absence est une erreur
1d8e567:lib/payments/fees.ts:17:export async function computeTicketingFees(payableAmount: number, opts: { subscription?: boolean } = {}): Promise<TicketingFees> {
1d8e567:lib/payments/fees.ts:21:        .eq('key', 'ticketing_fee_config')
1d8e567:lib/payments/fees.ts:24:        throw new Error(`Configuration des frais de paiement manquante (ticketing_fee_config)${error ? ` : ${error.message}` : ''}.`);
1d8e567:lib/payments/payment.service.ts:16:import { computeTicketingFees } from './fees';
1d8e567:lib/payments/payment.service.ts:178:        const fees = await computeTicketingFees(payableAmount, { subscription: input.targetType === 'SUBSCRIPTION' });
(code de sortie 0)

$ git grep -n -E 'platform_commission_rate|\|\|\s*(5(\.0)?|1\.5)\s*\)|\*\s*0\.01\b|\b0\.0(15|25)\b' 1d8e567 -- app lib
1d8e567:app/admin/finance/page.tsx:72:        const rate = data?.settings?.platform_commission_rate?.rate;
1d8e567:app/api/admin/metrics/route.ts:29:            supabase.from('platform_settings').select('value').eq('key', 'platform_commission_rate').maybeSingle(),
1d8e567:app/api/admin/metrics/route.ts:55:            configWarning = 'Configuration financière manquante: platform_commission_rate. Exécutez la migration 0012 ou insérez la valeur via le SQL Editor Supabase. Les revenus nets affichent 0 en attendant.';
1d8e567:app/partner/finance/page.tsx:117:    const feeAmount = amountNum >= 5000 ? Math.round(amountNum * 0.01) : 0;
1d8e567:app/wallet/page.tsx:133:  const feeNum = Math.round(grossNum * 0.01);
1d8e567:lib/admin/admin.service.ts:130:            let aggRate = 0.015;
1d8e567:lib/admin/admin.service.ts:132:            else if (p.payment_method === 'CARTE_BANCAIRE') aggRate = 0.025;
1d8e567:lib/partner/partner-dashboard.service.ts:219:        const orderCommissionRate = Number(orderConfigRes.data?.value?.commission_rate || 5.0);
1d8e567:lib/partner/partner-dashboard.service.ts:220:        const ticketServiceFeeRate = Number(ticketConfigRes.data?.value?.service_fee_rate || 5.0);
1d8e567:lib/partner/partner-dashboard.service.ts:221:        const ticketAggregatorFeeRate = Number(ticketConfigRes.data?.value?.aggregator_fee_rate || 1.5);
(code de sortie 0)

$ git grep -n -E 'from\('"'"'platform_settings'"'"'\)\s*\.(upsert|update|insert)' 1d8e567 -- app lib
1d8e567:app/api/admin/pricing/route.ts:64:        const { error: upsertErr } = await supabase.from('platform_settings').upsert({
(code de sortie 0)
```

**Correctif** (migrations `20261101000002_lot3_reglages.sql` et `20261101000003_lot3_moteur.sql`).
- **Moteur** : `finance_compute(cible, lignes, opérateur)` est la seule fonction qui calcule une répartition, avec les arrondis `fin_round_up` (frais), `fin_round_2` (calculs internes) et `fin_round_down` (versements de commissions).
  - Les taux sont lus par `fin_setting`, qui lève une exception si la clé manque. Il n'y a aucun repli, et un taux à 0 est valide.
  - Le net Event Village peut alors être négatif, à hauteur des frais d'agrégateur.
- **Checkout** : `checkout_create_payment` calcule lui-même les montants (ceux du corps sont ignorés), les persiste avec les taux, l'opérateur et le délai de disponibilité, puis renvoie le total que le serveur envoie à SamirPay. `payment_confirm` recopie les frais de service unitaires sur chaque billet (`tickets.service_fee`).
  - Colonnes ajoutées à `payments` : `facial_amount`, `service_fee_rate`, `aggregator_fee_rate`, `payout_delay_hours`, `payout_hold_enabled`, `event_id`, `refunded_amount`, `refunded_net_revenue`.
- **Code supprimé ou débranché** :
  - `lib/payments/fees.ts` ;
  - les taux codés du rapprochement admin (1 / 1,5 / 2,5 / 6,5 %) et des métriques admin (6,5 %) ;
  - les replis `|| 5.0` et `|| 1.5` du tableau de bord partenaire ;
  - les appels de `FinancialCalculatorService.calculate` (le service reste, marqué `@deprecated`, sans défauts : point ouvert 7) ;
  - la lecture de `ticketing_fee_config`.
- **Réglages** :
  - écriture par `finance_setting_set`, réservée au SUPERADMIN actif, avec validation et historique `platform_settings_history` (trigger) ;
  - politique RLS : un ADMIN n'écrit plus les clés `finance.%` ;
  - `/api/admin/pricing` refuse ces clés.

**parcours/finance-reglages**

Run 31 (avant correctif) :

```text
    not ok 1 - les 10 clés finance.* existent avec leur valeur par défaut
        → réglage finance.service_fee_rate absent de platform_settings
    not ok 2 - fin_setting : lecture sans repli, exception si la clé manque
        → lecture de finance.service_fee_rate : Could not find the function public.fin_setting(p_key) in the schema cache
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.fin_setting with parameter p_key or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 3 - finance_setting_set : le SUPERADMIN modifie une clé, la valeur est appliquée
        → réglage finance.payout_delay_hours absent de platform_settings
    not ok 4 - ADMIN, CLIENT ou acteur absent : FORBIDDEN, valeur et historique inchangés
        → réglage finance.service_fee_rate absent de platform_settings
    not ok 5 - valeurs invalides : INVALID_VALUE, valeur et historique inchangés
        → réglage finance.service_fee_rate absent de platform_settings
    not ok 6 - opérateur ou clé inconnus : UNKNOWN_KEY (aucun taux de repli)
        → finance_setting_set(finance.aggregator_fee_rate.FREE_MONEY) : Could not find the function public.finance_setting_set(p_actor, p_key, p_reason, p_value) in the schema cache
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.finance_setting_set with parameters p_actor, p_key, p_reason, p_value or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 7 - chaque modification écrit une ligne d’historique (ancienne, nouvelle valeur, auteur, motif)
        → réglage finance.payout_delay_hours absent de platform_settings
    not ok 8 - non-rétroactivité : le paiement garde ses montants et son taux si le taux change avant la confirmation
        → taux de service recopié sur le paiement à sa création (undefined)
        → NaN !== 5
not ok 1 - Réglages financiers (contrat A)
    not ok 1 - GET : l’ADMIN et le SUPERADMIN lisent les valeurs et l’historique ; anonyme refusé
        → test did not finish before its parent and was cancelled
    not ok 2 - PUT : 403 pour l’ADMIN (valeur inchangée), 200 pour le SUPERADMIN (valeur appliquée et historisée)
        → test did not finish before its parent and was cancelled
    not ok 3 - PUT : valeur invalide ou clé inconnue refusées pour le SUPERADMIN, sans effet
        → test did not finish before its parent and was cancelled
not ok 2 - Route /api/admin/finance-settings
        → Cannot find module '/home/runner/work/event-village/event-village/app/api/admin/finance-settings/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/finance-reglages.test.ts
        → column "net_revenue_reversal" does not exist
# pass 0
# fail 8
```

Run 32 (après correctif) :

```text
    ok 1 - les 10 clés finance.* existent avec leur valeur par défaut
    ok 2 - fin_setting : lecture sans repli, exception si la clé manque
    ok 3 - finance_setting_set : le SUPERADMIN modifie une clé, la valeur est appliquée
    ok 4 - ADMIN, CLIENT ou acteur absent : FORBIDDEN, valeur et historique inchangés
    ok 5 - valeurs invalides : INVALID_VALUE, valeur et historique inchangés
    ok 6 - opérateur ou clé inconnus : UNKNOWN_KEY (aucun taux de repli)
    ok 7 - chaque modification écrit une ligne d’historique (ancienne, nouvelle valeur, auteur, motif)
    ok 8 - non-rétroactivité : le paiement garde ses montants et son taux si le taux change avant la confirmation
ok 1 - Réglages financiers (contrat A)
    ok 1 - GET : l’ADMIN et le SUPERADMIN lisent les valeurs et l’historique ; anonyme refusé
    ok 2 - PUT : 403 pour l’ADMIN (valeur inchangée), 200 pour le SUPERADMIN (valeur appliquée et historisée)
    ok 3 - PUT : valeur invalide ou clé inconnue refusées pour le SUPERADMIN, sans effet
ok 2 - Route /api/admin/finance-settings
# pass 11
# fail 0
```

**parcours/finance-moteur**

Run 31 (avant correctif) :

```text
    not ok 1 - Annexe C : 1 000 F (Wave 1,5 %) → client 1 050, agrégateur 15,75, organisateur 1 000, Event Village 34,25
        → réglage finance.service_fee_rate absent de platform_settings
    not ok 2 - 1 250 F → service 63 (FCFA supérieur), total 1 313, agrégateur 19,70, net 43,30
        → réglage finance.service_fee_rate absent de platform_settings
    not ok 3 - frais de service arrondis au FCFA supérieur par billet ; agrégateur sur le total du panier
        → réglage finance.service_fee_rate absent de platform_settings
    not ok 4 - taux de service à 0 : accepté et appliqué, sans repli à 5 %
        → réglage finance.service_fee_rate absent de platform_settings
    not ok 5 - taux d’agrégateur par opérateur : Wave ≠ Orange Money
        → réglage finance.service_fee_rate absent de platform_settings
    not ok 6 - devis sans opérateur : total connu, agrégateur et taux d’agrégateur nuls
        → réglage finance.service_fee_rate absent de platform_settings
    not ok 7 - abonnement : pas de frais de service, organisateur 0, brut = facial, net = facial − agrégateur
        → réglage finance.service_fee_rate absent de platform_settings
    ok 8 - opérateur inconnu : erreur (aucun taux de repli)
not ok 1 - finance_compute (moteur unique)
    not ok 1 - Annexe C par le checkout : SamirPay débite 1 050, colonnes persistées, billet avec ses frais
        → montant envoyé à SamirPay = prix + frais de service (débit actuel : prix seul)
        → 1000 !== 1050
    not ok 2 - panier mixte Orange Money : SamirPay débite 3 413, agrégateur 51,20, billets 50 et 63
        → montant envoyé à SamirPay = total client
        → 3250 !== 3413
    not ok 3 - checkout_create_payment ignore les montants fournis par l’appelant
        → montants recalculés : amount = 1, attendu 1050
        → 1 !== 1050
not ok 2 - Checkout de bout en bout (montants du moteur)
    not ok 1 - plus de computeTicketingFees ni de lib/payments/fees.ts
        → lib/payments/fees.ts existe encore
        → true !== false
    not ok 2 - aucun taux de frais, de commission ou de retrait codé en dur dans les calculs relevés
        → taux codés en dur :
        → lib/admin/admin.service.ts#getFinancialReconciliation : agrégateur 1 / 1,5 / 2,5 % et commission 6,5 % (L130-139)
        → app/api/admin/metrics/route.ts : revenu EV = volume × 6,5 % (L29, L53, L60)
        → lib/partner/partner-dashboard.service.ts : replis || 5.0 / || 1.5 (L219-221)
    not ok 3 - l’ancienne clé ticketing_fee_config n’est plus lue par le code
        → lecture de ticketing_fee_config (remplacée par finance.*) :
        → app/api/partner/metrics/route.ts
        → lib/partner/partner-dashboard.service.ts
        → lib/payments/fees.ts
not ok 3 - Code : un seul moteur, aucun taux codé en dur
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/finance-moteur.test.ts
        → column "net_revenue_reversal" does not exist
# pass 1
# fail 13
```

Run 32 (après correctif) :

```text
    ok 1 - Annexe C : 1 000 F (Wave 1,5 %) → client 1 050, agrégateur 15,75, organisateur 1 000, Event Village 34,25
    ok 2 - 1 250 F → service 63 (FCFA supérieur), total 1 313, agrégateur 19,70, net 43,30
    ok 3 - frais de service arrondis au FCFA supérieur par billet ; agrégateur sur le total du panier
    ok 4 - taux de service à 0 : accepté et appliqué, sans repli à 5 %
    ok 5 - taux d’agrégateur par opérateur : Wave ≠ Orange Money
    ok 6 - devis sans opérateur : total connu, agrégateur et taux d’agrégateur nuls
    ok 7 - abonnement : pas de frais de service, organisateur 0, brut = facial, net = facial − agrégateur
    ok 8 - opérateur inconnu : erreur (aucun taux de repli)
ok 1 - finance_compute (moteur unique)
    ok 1 - Annexe C par le checkout : SamirPay débite 1 050, colonnes persistées, billet avec ses frais
    ok 2 - panier mixte Orange Money : SamirPay débite 3 413, agrégateur 51,20, billets 50 et 63
    ok 3 - checkout_create_payment ignore les montants fournis par l’appelant
ok 2 - Checkout de bout en bout (montants du moteur)
    ok 1 - plus de computeTicketingFees ni de lib/payments/fees.ts
    ok 2 - aucun taux de frais, de commission ou de retrait codé en dur dans les calculs relevés
    ok 3 - l’ancienne clé ticketing_fee_config n’est plus lue par le code
ok 3 - Code : un seul moteur, aucun taux codé en dur
# pass 14
# fail 0
```

**security/r12-reglages-finance**

Run 31 (avant correctif) :

```text
    not ok 1 - un ADMIN ne modifie pas une clé finance.* par REST (update ni upsert)
        → finance.service_fee_rate absente : le lot 3 crée les clés finance.*
    not ok 2 - un ADMIN ne crée pas de clé finance.* par REST
        → création de finance.r12_6dd8c9091da4 par un ADMIN : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 3 - un ADMIN ne supprime pas une clé finance.* par REST
        → finance.service_fee_rate absente : le lot 3 crée les clés finance.*
    ok 4 - un ADMIN n’appelle pas finance_setting_set, même en se déclarant SUPERADMIN
    ok 5 - un ADMIN n’écrit pas l’historique des réglages
not ok 1 - R12 — réglages financiers
# pass 2
# fail 3
```

Run 32 (après correctif) :

```text
    ok 1 - un ADMIN ne modifie pas une clé finance.* par REST (update ni upsert)
    ok 2 - un ADMIN ne crée pas de clé finance.* par REST
    ok 3 - un ADMIN ne supprime pas une clé finance.* par REST
    ok 4 - un ADMIN n’appelle pas finance_setting_set, même en se déclarant SUPERADMIN
    ok 5 - un ADMIN n’écrit pas l’historique des réglages
ok 1 - R12 — réglages financiers
# pass 5
# fail 0
```

**parcours/paiement-operateur**

Run 31 (code non corrigé, version du test antérieure à son adaptation dans un commit de correctif : pas un test rouge) :

```text
    ok 1 - WAVE : opérateur et téléphone payeur corrects en base, dans l’appel SamirPay et pour l’interface
    ok 2 - ORANGE_MONEY : opérateur et téléphone payeur corrects en base, dans l’appel SamirPay et pour l’interface
    ok 3 - interface : choix Wave / Orange Money obligatoire, aucune option carte, libellés selon l’opérateur
ok 1 - Opérateur de paiement
# pass 3
# fail 0
```

Run 32 (après correctif) :

```text
    ok 1 - WAVE : opérateur et téléphone payeur corrects en base, dans l’appel SamirPay et pour l’interface
    ok 2 - ORANGE_MONEY : opérateur et téléphone payeur corrects en base, dans l’appel SamirPay et pour l’interface
    ok 3 - interface : choix Wave / Orange Money obligatoire, aucune option carte, libellés selon l’opérateur
ok 1 - Opérateur de paiement
# pass 3
# fail 0
```

**parcours/paiement-confirmation**

Run 31 (code non corrigé, version du test antérieure à son adaptation dans un commit de correctif : pas un test rouge) :

```text
    ok 1 - deux webhooks identiques simultanés + un sondage : billets émis une seule fois, held sans double décrément
    ok 2 - RPC idempotente : un second appel ne fait rien et le dit
    ok 3 - panier dont une catégorie ne peut pas être honorée : zéro billet, jamais de SUCCESS partiel, remboursement déclenché
    ok 4 - montants lus, pas recalculés : le billet garde le prix payé si la catégorie change de prix avant la confirmation
ok 1 - Confirmation atomique
# pass 4
# fail 0
```

Run 32 (après correctif) :

```text
    ok 1 - deux webhooks identiques simultanés + un sondage : billets émis une seule fois, held sans double décrément
    ok 2 - RPC idempotente : un second appel ne fait rien et le dit
    ok 3 - panier dont une catégorie ne peut pas être honorée : zéro billet, jamais de SUCCESS partiel, remboursement déclenché
    ok 4 - montants lus, pas recalculés : le billet garde le prix payé si la catégorie change de prix avant la confirmation
ok 1 - Confirmation atomique
# pass 4
# fail 0
```

**partner-orders-m9**

Run 31 (code non corrigé, version du test antérieure à son adaptation dans un commit de correctif : pas un test rouge) :

```text
ok 1 - Test 1 : CRUD PRODUIT - Créer catégorie + produit, modifier, changer statut
ok 2 - Test 2 : CRÉATION COMMANDE & CALCUL FINANCIER
ok 3 - Test 3 : CYCLE STATUTS
ok 4 - Test 4 : BLOCAGE PRODUIT INTERDIT
ok 5 - Test 5 : ANNULATION & RÉGULARISATION STOCK
# pass 5
# fail 0
```

Run 32 (après correctif) :

```text
ok 1 - Test 1 : CRUD PRODUIT - Créer catégorie + produit, modifier, changer statut
ok 2 - Test 2 : CRÉATION COMMANDE & CALCUL FINANCIER
ok 3 - Test 3 : CYCLE STATUTS
ok 4 - Test 4 : BLOCAGE PRODUIT INTERDIT
ok 5 - Test 5 : ANNULATION & RÉGULARISATION STOCK
# pass 5
# fail 0
```

**security/r3-fonctions-rpc**

Run 31 (code non corrigé, version du test antérieure à son adaptation dans un commit de correctif : pas un test rouge) :

```text
    ok 1 - anon : rpc(validate_and_check_in_ticket) refusée
    ok 2 - authenticated (compte CLIENT) : rpc(validate_and_check_in_ticket) refusée
    ok 3 - anon : rpc(calculate_referral_commissions) refusée
    ok 4 - authenticated (compte CLIENT) : rpc(calculate_referral_commissions) refusée
    ok 5 - anon : rpc(activate_partner_trial) refusée
    ok 6 - authenticated (compte CLIENT) : rpc(activate_partner_trial) refusée
    ok 7 - anon : rpc(has_admin_permission) refusée
    ok 8 - authenticated (compte CLIENT) : rpc(has_admin_permission) refusée
    ok 9 - anon : rpc(create_hall_reservation_atomic) refusée
    ok 10 - authenticated (compte CLIENT) : rpc(create_hall_reservation_atomic) refusée
    ok 11 - anon : rpc(create_table_reservation_atomic) refusée
    ok 12 - authenticated (compte CLIENT) : rpc(create_table_reservation_atomic) refusée
    ok 13 - anon : rpc(request_withdrawal) refusée
    ok 14 - authenticated (compte CLIENT) : rpc(request_withdrawal) refusée
    ok 15 - anon : rpc(atomic_ticket_checkin) refusée
    ok 16 - authenticated (compte CLIENT) : rpc(atomic_ticket_checkin) refusée
    ok 17 - anon : rpc(atomic_partner_remove_controller) refusée
    ok 18 - authenticated (compte CLIENT) : rpc(atomic_partner_remove_controller) refusée
    ok 19 - anon : rpc(generate_referral_code) refusée
    ok 20 - authenticated (compte CLIENT) : rpc(generate_referral_code) refusée
    ok 21 - anon : rpc(ticket_sale_problems) refusée
    ok 22 - authenticated (compte CLIENT) : rpc(ticket_sale_problems) refusée
    ok 23 - anon : rpc(checkout_create_payment) refusée
    ok 24 - authenticated (compte CLIENT) : rpc(checkout_create_payment) refusée
    ok 25 - anon : rpc(payment_release) refusée
    ok 26 - authenticated (compte CLIENT) : rpc(payment_release) refusée
    ok 27 - anon : rpc(stock_reservations_expire) refusée
    ok 28 - authenticated (compte CLIENT) : rpc(stock_reservations_expire) refusée
    ok 29 - anon : rpc(refund_request) refusée
    ok 30 - authenticated (compte CLIENT) : rpc(refund_request) refusée
    ok 31 - anon : rpc(payment_confirm) refusée
    ok 32 - authenticated (compte CLIENT) : rpc(payment_confirm) refusée
    ok 33 - anon : rpc(free_tickets_claim) refusée
    ok 34 - authenticated (compte CLIENT) : rpc(free_tickets_claim) refusée
    ok 35 - anon : rpc(payment_webhook_record) refusée
    ok 36 - authenticated (compte CLIENT) : rpc(payment_webhook_record) refusée
ok 1 - R3 — RPC métier non appelables par anon / authenticated
    ok 1 - anon et authenticated : rpc(is_admin) acceptée
    ok 2 - anon et authenticated : rpc(is_superadmin) acceptée
    ok 3 - anon et authenticated : rpc(is_controller) acceptée
    ok 4 - anon et authenticated : rpc(has_role) acceptée
    ok 5 - anon et authenticated : rpc(is_partner_owner) acceptée
    ok 6 - anon et authenticated : rpc(auth_user_role) acceptée
ok 2 - R3 — aides RLS toujours appelables (sinon les politiques échouent)
# pass 42
# fail 0
```

Run 32 (après correctif) :

```text
    ok 1 - anon : rpc(validate_and_check_in_ticket) refusée
    ok 2 - authenticated (compte CLIENT) : rpc(validate_and_check_in_ticket) refusée
    ok 3 - anon : rpc(calculate_referral_commissions) refusée
    ok 4 - authenticated (compte CLIENT) : rpc(calculate_referral_commissions) refusée
    ok 5 - anon : rpc(activate_partner_trial) refusée
    ok 6 - authenticated (compte CLIENT) : rpc(activate_partner_trial) refusée
    ok 7 - anon : rpc(has_admin_permission) refusée
    ok 8 - authenticated (compte CLIENT) : rpc(has_admin_permission) refusée
    ok 9 - anon : rpc(create_hall_reservation_atomic) refusée
    ok 10 - authenticated (compte CLIENT) : rpc(create_hall_reservation_atomic) refusée
    ok 11 - anon : rpc(create_table_reservation_atomic) refusée
    ok 12 - authenticated (compte CLIENT) : rpc(create_table_reservation_atomic) refusée
    ok 13 - anon : rpc(atomic_ticket_checkin) refusée
    ok 14 - authenticated (compte CLIENT) : rpc(atomic_ticket_checkin) refusée
    ok 15 - anon : rpc(atomic_partner_remove_controller) refusée
    ok 16 - authenticated (compte CLIENT) : rpc(atomic_partner_remove_controller) refusée
    ok 17 - anon : rpc(generate_referral_code) refusée
    ok 18 - authenticated (compte CLIENT) : rpc(generate_referral_code) refusée
    ok 19 - anon : rpc(ticket_sale_problems) refusée
    ok 20 - authenticated (compte CLIENT) : rpc(ticket_sale_problems) refusée
    ok 21 - anon : rpc(checkout_create_payment) refusée
    ok 22 - authenticated (compte CLIENT) : rpc(checkout_create_payment) refusée
    ok 23 - anon : rpc(payment_release) refusée
    ok 24 - authenticated (compte CLIENT) : rpc(payment_release) refusée
    ok 25 - anon : rpc(stock_reservations_expire) refusée
    ok 26 - authenticated (compte CLIENT) : rpc(stock_reservations_expire) refusée
    ok 27 - anon : rpc(refund_request) refusée
    ok 28 - authenticated (compte CLIENT) : rpc(refund_request) refusée
    ok 29 - anon : rpc(payment_confirm) refusée
    ok 30 - authenticated (compte CLIENT) : rpc(payment_confirm) refusée
    ok 31 - anon : rpc(free_tickets_claim) refusée
    ok 32 - authenticated (compte CLIENT) : rpc(free_tickets_claim) refusée
    ok 33 - anon : rpc(payment_webhook_record) refusée
    ok 34 - authenticated (compte CLIENT) : rpc(payment_webhook_record) refusée
    ok 35 - anon : rpc(finance_setting_set) refusée
    ok 36 - authenticated (compte CLIENT) : rpc(finance_setting_set) refusée
    ok 37 - anon : rpc(fin_setting) refusée
    ok 38 - authenticated (compte CLIENT) : rpc(fin_setting) refusée
    ok 39 - anon : rpc(finance_compute) refusée
    ok 40 - authenticated (compte CLIENT) : rpc(finance_compute) refusée
    ok 41 - anon : rpc(finance_quote) refusée
    ok 42 - authenticated (compte CLIENT) : rpc(finance_quote) refusée
    ok 43 - anon : rpc(finance_account_balance) refusée
    ok 44 - authenticated (compte CLIENT) : rpc(finance_account_balance) refusée
    ok 45 - anon : rpc(ticket_refund_request) refusée
    ok 46 - authenticated (compte CLIENT) : rpc(ticket_refund_request) refusée
    ok 47 - anon : rpc(cashout_finalize) refusée
    ok 48 - authenticated (compte CLIENT) : rpc(cashout_finalize) refusée
    ok 49 - anon : rpc(withdrawal_request) refusée
    ok 50 - authenticated (compte CLIENT) : rpc(withdrawal_request) refusée
    ok 51 - anon : rpc(referral_commissions_release) refusée
    ok 52 - authenticated (compte CLIENT) : rpc(referral_commissions_release) refusée
    ok 53 - anon : rpc(finance_partner_summary) refusée
    ok 54 - authenticated (compte CLIENT) : rpc(finance_partner_summary) refusée
    ok 55 - anon : rpc(finance_platform_revenue) refusée
    ok 56 - authenticated (compte CLIENT) : rpc(finance_platform_revenue) refusée
ok 1 - R3 — RPC métier non appelables par anon / authenticated
    ok 1 - anon et authenticated : rpc(is_admin) acceptée
    ok 2 - anon et authenticated : rpc(is_superadmin) acceptée
    ok 3 - anon et authenticated : rpc(is_controller) acceptée
    ok 4 - anon et authenticated : rpc(has_role) acceptée
    ok 5 - anon et authenticated : rpc(is_partner_owner) acceptée
    ok 6 - anon et authenticated : rpc(auth_user_role) acceptée
ok 2 - R3 — aides RLS toujours appelables (sinon les politiques échouent)
# pass 62
# fail 0
```

### 3.2 — Affichage des frais au client

```text
$ git grep -n -E cartTotal 1d8e567 -- app components
1d8e567:app/events/[id]/page.tsx:83:  const cartTotal = cartItems.reduce((sum, item) => sum + (item.price || 0) * item.qty, 0);
1d8e567:app/events/[id]/page.tsx:84:  const cartTotalQty = cartItems.reduce((sum, item) => sum + item.qty, 0);
1d8e567:app/events/[id]/page.tsx:85:  const hasFreeOnly = cartTotal === 0 && cartTotalQty > 0;
1d8e567:app/events/[id]/page.tsx:225:    if (cartTotalQty === 0) return;
1d8e567:app/events/[id]/page.tsx:259:            cartTotalQty > 1
1d8e567:app/events/[id]/page.tsx:260:              ? `${cartTotalQty} billets gratuits réservés avec succès !`
1d8e567:app/events/[id]/page.tsx:670:          {cartTotalQty > 0 && (
1d8e567:app/events/[id]/page.tsx:688:                  Total ({cartTotalQty} billet{cartTotalQty > 1 ? 's' : ''})
1d8e567:app/events/[id]/page.tsx:691:                  {hasFreeOnly ? 'Gratuit' : `${cartTotal.toLocaleString('fr-FR')} FCFA`}
1d8e567:app/events/[id]/page.tsx:707:                  ? `Réserver ${cartTotalQty} billet${cartTotalQty > 1 ? 's' : ''} gratuit${cartTotalQty > 1 ? 's' : ''}`
1d8e567:app/events/[id]/page.tsx:708:                  : `Acheter ${cartTotalQty} billet${cartTotalQty > 1 ? 's' : ''} (${cartTotal.toLocaleString('fr-FR')} FCFA)`}
1d8e567:app/events/[id]/page.tsx:721:      {cartTotalQty > 0 && !event.isFullySoldOut && (
1d8e567:app/events/[id]/page.tsx:735:              ? `Réserver ${cartTotalQty} gratuit${cartTotalQty > 1 ? 's' : ''}`
1d8e567:app/events/[id]/page.tsx:736:              : `Acheter (${cartTotal.toLocaleString('fr-FR')} FCFA)`}
1d8e567:app/events/[id]/page.tsx:747:        amountFormatted={`${cartTotal.toLocaleString('fr-FR')} FCFA`}
(code de sortie 0)

$ git grep -n -E 'Achat confirme' 1d8e567 -- lib/notifications
1d8e567:lib/notifications/notification.service.ts:734:                    ? `Event Village : Achat confirme (${params.ticketCount} billets pour "${eventTitle}"). Retrouvez vos billets sur : ${appBaseUrl}/tickets`
1d8e567:lib/notifications/notification.service.ts:735:                    : `Event Village : Achat confirme (billet pour "${eventTitle}"). Retrouvez votre billet sur : ${appBaseUrl}/tickets`;
(code de sortie 0)

$ git grep -n -E priceFormatted 1d8e567 -- app/api/tickets lib/tickets
1d8e567:app/api/tickets/[id]/pdf/route.ts:114:        const priceFormatted = price > 0 ? `${price.toLocaleString('fr-FR')} FCFA` : 'Gratuit';
1d8e567:app/api/tickets/[id]/pdf/route.ts:123:            priceFormatted,
1d8e567:lib/tickets/ticket-pdf.service.ts:9:    priceFormatted: string;
1d8e567:lib/tickets/ticket-pdf.service.ts:203:        stream += `${cardX + 260} ${line3Y - 16} Td\n(${escapePdfText(data.priceFormatted)}) Tj\nET\n`;
(code de sortie 0)
```

**Correctif.**
- **Devis** : `POST /api/checkout/quote` est public. Il renvoie sous-total, frais de service par ligne et total, à partir des prix lus en base, sans exposer les revenus internes.
- **Page événement** : elle demande le devis à chaque changement du panier et ne calcule plus aucun montant. `cartTotal` est supprimé.
- **Modale de paiement** : elle affiche prix, frais de service et total du devis.
- **Page `/paiement/[id]`** : elle affiche prix, frais de service et total payé, lus sur la route de statut, qui renvoie `null` et non 0 pour un paiement antérieur au lot.
- **SMS de confirmation** : il donne « Total paye : X FCFA (dont frais de service : Y FCFA) ».
- **PDF du billet** : il affiche les frais de service et le total payé du billet.

L'organisateur voit dans ses notifications sa part, le prix facial, et non plus le montant débité.

**parcours/finance-affichage**

Run 31 (avant correctif) :

```text
    not ok 1 - route publique : sous-total, frais de service (FCFA supérieur par billet), total, détail par ligne
        → test did not finish before its parent and was cancelled
    not ok 2 - panier vide ou catégorie étrangère à l’événement : refusé, aucun montant
        → test did not finish before its parent and was cancelled
    not ok 3 - un seul montant : devis = montant envoyé à SamirPay = payments.amount = route de statut
        → test did not finish before its parent and was cancelled
not ok 1 - Devis serveur : POST /api/checkout/quote
        → Cannot find module '/home/runner/work/event-village/event-village/app/api/checkout/quote/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
    not ok 1 - SMS de confirmation d’achat : frais de service et total payé
        → test did not finish before its parent and was cancelled
    not ok 2 - PDF du billet : frais de service et total payé
        → test did not finish before its parent and was cancelled
not ok 2 - Confirmation : SMS et PDF du billet
        → Cannot find module '/home/runner/work/event-village/event-village/app/api/checkout/quote/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
    not ok 1 - page événement : demande le devis au serveur et ne transmet plus le total calculé dans le navigateur
        → test did not finish before its parent and was cancelled
    not ok 2 - modale : affiche les frais de service et le total du devis, sans les calculer
        → test did not finish before its parent and was cancelled
    not ok 3 - page /paiement/[id] : affiche le prix, les frais de service et le total
        → test did not finish before its parent and was cancelled
not ok 3 - Code : affichage du devis serveur
        → Cannot find module '/home/runner/work/event-village/event-village/app/api/checkout/quote/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/finance-affichage.test.ts
        → column "net_revenue_reversal" does not exist
# pass 0
# fail 0
```

Run 32 (après correctif) :

```text
    ok 1 - route publique : sous-total, frais de service (FCFA supérieur par billet), total, détail par ligne
    ok 2 - panier vide ou catégorie étrangère à l’événement : refusé, aucun montant
    ok 3 - un seul montant : devis = montant envoyé à SamirPay = payments.amount = route de statut
ok 1 - Devis serveur : POST /api/checkout/quote
    ok 1 - SMS de confirmation d’achat : frais de service et total payé
    ok 2 - PDF du billet : frais de service et total payé
ok 2 - Confirmation : SMS et PDF du billet
    ok 1 - page événement : demande le devis au serveur et ne transmet plus le total calculé dans le navigateur
    ok 2 - modale : affiche les frais de service et le total du devis, sans les calculer
    ok 3 - page /paiement/[id] : affiche le prix, les frais de service et le total
ok 3 - Code : affichage du devis serveur
# pass 8
# fail 0
```

### 3.3 — Hors plateforme (R25, ticketing-finance-7)

```text
$ git grep -n -E is_platform_payment 1d8e567 -- app lib
1d8e567:lib/events/event-cancellation.service.ts:254:                .eq('is_platform_payment', true)
1d8e567:lib/payments/payment.service.ts:197:            is_platform_payment: true,
1d8e567:lib/tables/table.service.ts:70:    is_platform_payment: boolean;
(code de sortie 0)

$ git grep -n -E 'from\('"'"'payments'"'"'\)' 1d8e567 -- app/api/admin app/api/partner lib/admin lib/partner
1d8e567:app/api/admin/metrics/route.ts:22:            supabase.from('payments').select('amount').eq('status', 'SUCCESS'),
1d8e567:lib/admin/admin.service.ts:67:            .from('payments')
1d8e567:lib/partner/partner-dashboard.service.ts:430:            supabase.from('payments').select('*').eq('partner_id', partner.id),
1d8e567:lib/partner/partner-dashboard.service.ts:797:            supabase.from('payments').select('id, external_order_id, transaction_id, payment_target, amount, status, partner_payout_amount, service_fee, aggregator_fee, created_at, metadata').eq('partner_id', partner.id),
(code de sortie 0)
```

**Correctif** (migration `20261101000008_lot3_rapports.sql` pour les fonctions de synthèse).
- **Répartition** : un paiement `is_platform_payment = false` a une répartition nulle (`fin_offline`). Il n'alimente ni le grand livre (le trigger VENTE l'exclut) ni le revenu Event Village.
- **Métriques admin** : elles passent par `finance_platform_revenue`, qui ne compte que les paiements plateforme et calcule le revenu net moins sa part remboursée.
- **Rapprochement** : il porte sur les montants persistés, les paiements plateforme et les remboursements PROCESSED. Il ne cite plus la colonne inexistante `target_id` ni le statut hors enum `'SUCCESS'`.
- **Tableau de bord, métriques, statistiques et finance partenaire** : ils sont lus depuis le grand livre. Les espèces y forment une ligne à part.

**parcours/finance-hors-plateforme**

Run 31 (avant correctif) :

```text
    not ok 1 - fin_offline : répartition nulle (frais, agrégateur, reversement, revenu brut et net)
        → fin_offline : Could not find the function public.fin_offline without parameters in the schema cache
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.fin_offline without parameters or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 2 - vente en ligne de 1 000 F : volume admin + 1 050, revenu EV + 34,25 (net des paiements plateforme)
        → volume admin : +1000
        → 1000 !== 1050
    not ok 3 - vente en espèces de 1 000 F : aucune écriture au grand livre, revenu EV 0, agrégats inchangés
        → solde ORGANISATEUR : Could not find the function public.finance_account_balance(p_kind, p_owner) in the schema cache
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.finance_account_balance with parameters p_kind, p_owner or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 4 - réconciliation admin : la vente en ligne y figure, la vente en espèces non
        → ventes des tests précédents absentes
not ok 1 - Paiements hors plateforme : ni frais ni revenu Event Village
    not ok 1 - chaque agrégat de revenu ou de volume filtre is_platform_payment
        → agrégats sans filtre is_platform_payment :
        → app/api/admin/metrics/route.ts : volume et revenu EV admin (L22, L58-60)
        → lib/admin/admin.service.ts#getFinancialReconciliation : rapprochement financier (L66-90)
        → lib/partner/partner-dashboard.service.ts#getDashboardData : tableau de bord partenaire (L239-263)
not ok 2 - Code : agrégats limités aux paiements plateforme
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/finance-hors-plateforme.test.ts
        → column "net_revenue_reversal" does not exist
# pass 0
# fail 5
```

Run 32 (après correctif) :

```text
    ok 1 - fin_offline : répartition nulle (frais, agrégateur, reversement, revenu brut et net)
    ok 2 - vente en ligne de 1 000 F : volume admin + 1 050, revenu EV + 34,25 (net des paiements plateforme)
    ok 3 - vente en espèces de 1 000 F : aucune écriture au grand livre, revenu EV 0, agrégats inchangés
    ok 4 - réconciliation admin : la vente en ligne y figure, la vente en espèces non
ok 1 - Paiements hors plateforme : ni frais ni revenu Event Village
    ok 1 - chaque agrégat de revenu ou de volume filtre is_platform_payment
ok 2 - Code : agrégats limités aux paiements plateforme
# pass 5
# fail 0
```

### 3.4 — Remboursement unitaire réel (R23, point 5 du lot 2)

```text
$ git grep -n -E 'refundTicket\(' 1d8e567 -- app lib components
1d8e567:app/api/partner/events/[id]/tickets/[ticketId]/refund/route.ts:24:        const result = await EventService.refundTicket({
1d8e567:lib/events/event.service.ts:934:    public static async refundTicket(params: {
(code de sortie 0)

$ git grep -n -E CONTROLEUR 1d8e567 -- 'app/api/partner/events/[id]/tickets/[ticketId]/refund/route.ts' lib/events/event.service.ts
1d8e567:app/api/partner/events/[id]/tickets/[ticketId]/refund/route.ts:16:        if (!serverHasAnyRole(user, ['PARTENAIRE', 'ADMIN', 'SUPERADMIN', 'CONTROLEUR'])) {
1d8e567:lib/events/event.service.ts:936:        operatorId: string; // User ID de la personne qui effectue le remboursement (PARTENAIRE, ADMIN, CONTROLEUR)
1d8e567:lib/events/event.service.ts:970:        const isStaff = ['ADMIN', 'SUPERADMIN', 'CONTROLEUR'].includes(params.operatorRole);
(code de sortie 0)

$ git grep -n -E 'status: '"'"'PROCESSED'"'"'|a été remboursé' 1d8e567 -- lib/events/event.service.ts
1d8e567:lib/events/event.service.ts:1021:                    status: 'PROCESSED',
1d8e567:lib/events/event.service.ts:1035:            message: `Votre billet n°${ticket.ticket_number} a été remboursé${refundAmount > 0 ? ` (${refundAmount.toLocaleString('fr-FR')} FCFA)` : ''}. Motif : ${params.reason}`,
1d8e567:lib/events/event.service.ts:1050:                message: `Le billet n°${ticket.ticket_number} (${refundAmount.toLocaleString('fr-FR')} FCFA) a été remboursé. Motif : ${params.reason}`,
(code de sortie 0)
```

**Correctif** (migrations `20261101000001_lot3_statuts.sql` et `20261101000005_lot3_remboursements.sql`).

`ticket_refund_request` traite trois cas :
- **Billet payé en ligne** :
  - part = prix + frais de service du billet, jamais au-delà du reste dû ;
  - remboursement et cashout `REFUND-TKT-<billet>` ;
  - billet REMBOURSEMENT_EN_COURS (nouveau statut, refusé au contrôle d'accès), place libérée ;
  - débit organisateur (prix facial, plus la part d'agrégateur si le réglage le met à sa charge), part du revenu net annulée, régularisation des commissions.
- **Billet payé en espèces** : aucun cashout ; remboursement `settlement = ORGANISATEUR`, « à rembourser par l'organisateur » ; billet ANNULE.
- **Billet gratuit ou invitation** : annulé.

Les autres pièces :
- **`cashout_finalize`** : à la confirmation de l'envoi, le billet passe REMBOURSE, `refunded_amount` augmente et le paiement passe PARTIAL ou REFUNDED. Le client reçoit « Remboursement versé ». À la demande, il n'a reçu que « Demande de remboursement en cours ».
- **`refund_request`** (lot 2) rembourse désormais le RESTE du paiement.
- **Route** : partenaire propriétaire de l'événement `[id]` ou ADMIN/SUPERADMIN (rôles `user_roles`) ; le CONTROLEUR est refusé (403) ; un billet d'un autre événement donne 404. L'envoi est lancé dans la même requête.
- **Code supprimé** : `EventService.refundTicket`, le remboursement fictif.

**parcours/finance-remboursement-billet**

Run 31 (avant correctif) :

```text
    not ok 1 - CONTROLEUR 403, partenaire étranger refusé, billet d’un autre événement 404, ADMIN accepté
        → CONTROLEUR refusé
        → 400 !== 403
not ok 1 - Accès à la route de remboursement
    not ok 1 - panier de 3 : remboursement d’un billet (cashout REFUND-TKT, EN_COURS → REMBOURSE, PARTIAL), puis des deux autres (REFUNDED), débit au grand livre
        → réglage finance.cancellation_aggregator_fee_bearer absent de platform_settings
not ok 2 - Billet payé en ligne
    not ok 1 - paiement hors plateforme : aucun cashout, remboursement à la charge de l’organisateur, billet ANNULE
        → remboursement espèces : HTTP 400 {"error":"Ticket introuvable."}
        → 400 !== 200
not ok 3 - Billet espèces
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/finance-remboursement-billet.test.ts
        → column "net_revenue_reversal" does not exist
# pass 0
# fail 3
```

Run 32 (après correctif) :

```text
    ok 1 - CONTROLEUR 403, partenaire étranger refusé, billet d’un autre événement 404, ADMIN accepté
ok 1 - Accès à la route de remboursement
    ok 1 - panier de 3 : remboursement d’un billet (cashout REFUND-TKT, EN_COURS → REMBOURSE, PARTIAL), puis des deux autres (REFUNDED), débit au grand livre
ok 2 - Billet payé en ligne
    ok 1 - paiement hors plateforme : aucun cashout, remboursement à la charge de l’organisateur, billet ANNULE
ok 3 - Billet espèces
# pass 3
# fail 0
```

### 3.5 — Régularisation (R24, data-model-5, ticketing-finance-6)

```text
$ git grep -n -E 'from\('"'"'referral_relationships'"'"'\)\.insert|referral_relationships_insert' 1d8e567 -- app lib supabase/migrations
1d8e567:app/api/auth/register/route.ts:150:                        await supabaseAdmin.from('referral_relationships').insert({
1d8e567:supabase/migrations/0003_rls.sql:313:CREATE POLICY "referral_relationships_insert" ON referral_relationships
(code de sortie 0)

$ git grep -n -E ''"'"'AVAILABLE'"'"'' 1d8e567 -- supabase/migrations/0002_functions.sql
1d8e567:supabase/migrations/0002_functions.sql:169:                'AVAILABLE',
1d8e567:supabase/migrations/0002_functions.sql:210:                    'AVAILABLE',
(code de sortie 0)

$ git grep -n -E 'select\('"'"'id, amount, status'"'"'\)' 1d8e567 -- app/api/referrals
1d8e567:app/api/referrals/my-stats/route.ts:99:            .select('id, amount, status')
(code de sortie 0)
```

**Correctif** (migration `20261101000006_lot3_commissions.sql`).
- **Création** : commissions EN ATTENTE, `available_at` = confirmation + délai réglé (7 jours par défaut, de 7 à 14), crédit PARRAINAGE au grand livre à cette date. La base est le revenu net Event Village (34,25 F donnent 1,71 en N1 et 0,69 en N2).
- **Disponibilité** : la RPC `referral_commissions_release` et le cron `/api/cron/referral-commissions` passent les commissions échues à DISPONIBLE.
- **Remboursement** (`fin_referral_on_refund`) :
  - commission jamais versée : CANCELLED avec motif. Pour un remboursement partiel, une nouvelle ligne la remplace au prorata : montant × (1 − remboursé ÷ total payé) ;
  - commission déjà versée, même en partie : ligne REGULARISATION négative, débitée du solde. Ce qui dépasse le solde devient une créance, déduite des gains futurs (§103) ;
  - aucune suppression.
- **Versements** : allocation FIFO des commissions aux retraits (`referral_commission_payouts`). Une commission est PAID quand elle est entièrement couverte.
- **Grille** : `referral_config` alignée sur l'Annexe A par `ON CONFLICT … DO UPDATE` (5/2 % 12 mois ; 7/2 % 24 mois ; 7/2 % 24 mois ; 10/3 % 36 mois).
- **RLS** : politique `referral_relationships_insert` supprimée. Grep : seule l'inscription serveur, avec le service_role, crée une relation.
- **`/api/referrals/my-stats`** : solde lu au grand livre, total retiré = retraits PARRAINAGE payés (la colonne `amount` lue auparavant n'existe pas), commissions annulées exclues.

**parcours/finance-commissions**

Run 31 (avant correctif) :

```text
    not ok 1 - grille referral_config : les quatre lignes de l’Annexe A (§95-§97), écrites par une migration
        → dernière migration qui écrit referral_config (0011_referral_codes.sql) : lignes du CDC absentes — seule seed.sql (non jouée en production) les contient
        → +   'STANDARD/CLIENT_TO_CLIENT 5/2/12',
        → +   'STANDARD/CLIENT_TO_PRESTATAIRE 7/2/24',
        → +   'AMBASSADEUR/CLIENT_TO_CLIENT 7/2/24',
    not ok 2 - achat d’un billet de 1 000 F par un filleul : N1 1,71 F et N2 0,69 F sur 34,25 F, EN ATTENTE jusqu’à la confirmation + 7 jours, crédit PARRAINAGE en attente
        → revenu net EV (base du parrainage) : 35
        → 3500 !== 3425
    not ok 3 - délai réglable de 7 à 14 jours (finance.referral_availability_days), recopié sur la commission à sa naissance (non rétroactif)
        → réglage finance.referral_availability_days absent de platform_settings
    not ok 4 - cron /api/cron/referral-commissions : 401 sans CRON_SECRET ; les commissions échues deviennent DISPONIBLES, les autres restent EN ATTENTE
        → route /api/cron/referral-commissions absente : Cannot find module '/home/runner/work/event-village/event-village/app/api/cron/referral-commissions/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
    not ok 5 - remboursement total du billet : commissions EN ATTENTE et DISPONIBLE annulées avec motif, lignes conservées, débit PARRAINAGE
        → remboursement du billet d4eda403-b70a-44a2-abab-2cadb5ff24a2 : HTTP 400 {"error":"Ticket introuvable."}
    not ok 6 - remboursement partiel d’un panier de 2 billets : commission recalculée au prorata (ancienne CANCELLED RECALCUL_PRORATA, nouvelle ligne)
        → revenu net EV : 70
        → 7000 !== 6850
    not ok 7 - commission déjà versée par un retrait de parrainage, puis remboursements : REGULARISATION négative, créance déduite des gains futurs (§103), ligne d’origine conservée
        → N1 avant remboursement (2 billets : net 68,50 × 5 %)
        → 350 !== 343
    not ok 8 - /api/referrals/my-stats : total retiré = retraits de parrainage payés, solde disponible sans commission en attente, statuts distincts
        → total retiré = retraits PARRAINAGE payés, bruts (ni refusé, ni ORGANISATEUR) : {"availableBalance":3.5,"totalEarned":3.5,"totalWithdrawn":0}
        → 0 !== 500000
not ok 1 - Commissions de parrainage (lot 3.5)
not ok 2 - /home/runner/work/event-village/event-village/tests/parcours/finance-commissions.test.ts
        → column "net_revenue_reversal" does not exist
# pass 0
# fail 8
```

Run 32 (après correctif) :

```text
    ok 1 - grille referral_config : les quatre lignes de l’Annexe A (§95-§97), écrites par une migration
    ok 2 - achat d’un billet de 1 000 F par un filleul : N1 1,71 F et N2 0,69 F sur 34,25 F, EN ATTENTE jusqu’à la confirmation + 7 jours, crédit PARRAINAGE en attente
    ok 3 - délai réglable de 7 à 14 jours (finance.referral_availability_days), recopié sur la commission à sa naissance (non rétroactif)
    ok 4 - cron /api/cron/referral-commissions : 401 sans CRON_SECRET ; les commissions échues deviennent DISPONIBLES, les autres restent EN ATTENTE
    ok 5 - remboursement total du billet : commissions EN ATTENTE et DISPONIBLE annulées avec motif, lignes conservées, débit PARRAINAGE
    ok 6 - remboursement partiel d’un panier de 2 billets : commission recalculée au prorata (ancienne CANCELLED RECALCUL_PRORATA, nouvelle ligne)
    ok 7 - commission déjà versée par un retrait de parrainage, puis remboursements : REGULARISATION négative, créance déduite des gains futurs (§103), ligne d’origine conservée
    ok 8 - /api/referrals/my-stats : total retiré = retraits de parrainage payés, solde disponible sans commission en attente, statuts distincts
ok 1 - Commissions de parrainage (lot 3.5)
# pass 8
# fail 0
```

**security/r13-parrainage-relations**

Run 31 (avant correctif) :

```text
    not ok 1 - CLIENT connecté : se déclarer filleul d’un complice avec des taux arbitraires (99,99 % / 50 %, 100 ans) → refusé
        → INSERT referral_relationships (taux 99,99 % / 50 %, 1 200 mois) : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 2 - CLIENT connecté : même avec la grille du CDC (5 % / 2 %, 12 mois) → refusé, seule l’inscription serveur crée la relation
        → INSERT referral_relationships (taux de la grille) : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    ok 3 - CLIENT connecté : insertion directe d’une commission disponible à son profit → refusée
not ok 1 - R13 — relations de parrainage : aucune création par le client
# pass 1
# fail 2
```

Run 32 (après correctif) :

```text
    ok 1 - CLIENT connecté : se déclarer filleul d’un complice avec des taux arbitraires (99,99 % / 50 %, 100 ans) → refusé
    ok 2 - CLIENT connecté : même avec la grille du CDC (5 % / 2 %, 12 mois) → refusé, seule l’inscription serveur crée la relation
    ok 3 - CLIENT connecté : insertion directe d’une commission disponible à son profit → refusée
ok 1 - R13 — relations de parrainage : aucune création par le client
# pass 3
# fail 0
```

### 3.6 — Solde organisateur et retraits (R26, ticketing-finance-8, point 2 du lot 2)

```text
$ git grep -n -E 'sendCashout\(|rpc\('"'"'request_withdrawal'"'"'' 1d8e567 -- app lib
1d8e567:lib/integrations/types.ts:63:    sendCashout(payload: SamirPayCashoutRequest): Promise<SamirPayCashoutResult>;
1d8e567:lib/payments/cashout.service.ts:143:            const res = await samirPayClient.sendCashout({
1d8e567:lib/payments/withdrawal.service.ts:79:        const { data: rpcResult, error: rpcError } = await supabase.rpc('request_withdrawal', {
1d8e567:lib/payments/withdrawal.service.ts:124:            const cashoutRes = await samirPayClient.sendCashout({
1d8e567:lib/samirpay/client.ts:17:    sendCashout: (payload) => getPaymentGateway().sendCashout(payload),
1d8e567:lib/samirpay/http-client.ts:152:    async sendCashout(payload: SamirPayCashoutRequest): Promise<SamirPayCashoutResult> {
(code de sortie 0)

$ git grep -n -E 'storeOtp\(|verifyStoredOtp\(|checkStoredOtp\(' 1d8e567 -- app lib
1d8e567:app/api/auth/register/route.ts:59:            await storeOtp(normalizedPhone, otpCode, new Date(otpExpiresAt));
1d8e567:app/api/auth/send-otp/route.ts:77:            await storeOtp(normalizedPhone, otpCode, new Date(expiresAt));
1d8e567:app/api/auth/verify-otp/route.ts:49:        const check = await verifyStoredOtp(normalizedPhone, otpCode);
1d8e567:app/api/controller/setup/route.ts:54:        const otpCheck = await checkStoredOtp(normalizedPhone, otp_code);
1d8e567:app/api/partner/register/route.ts:79:            await storeOtp(normalizedPhone, otpCode, new Date(otpExpiresAt));
1d8e567:app/api/partner/team/invite/route.ts:368:                await storeOtp(normalizedPhone, otpCode, new Date(expiresAt));
1d8e567:lib/auth/otp-store.ts:37:export async function storeOtp(phone: string, code: string, expiresAt: Date): Promise<string> {
1d8e567:lib/auth/otp-store.ts:50:export async function checkStoredOtp(phone: string, code: string): Promise<OtpCheck> {
1d8e567:lib/auth/otp-store.ts:86:export async function verifyStoredOtp(phone: string, code: string): Promise<OtpCheck> {
1d8e567:lib/auth/otp-store.ts:87:    const check = await checkStoredOtp(phone, code);
(code de sortie 0)

$ git grep -n -E 'withdrawals_insert|gross_amount >= 5000' 1d8e567 -- supabase/migrations
1d8e567:supabase/migrations/0001_initial_schema.sql:628:    gross_amount NUMERIC(12, 2) NOT NULL CHECK (gross_amount >= 5000.00), -- Seuil minimum 5000 FCFA
1d8e567:supabase/migrations/0003_rls.sql:332:CREATE POLICY "withdrawals_insert" ON withdrawals
(code de sortie 0)
```

**Correctif** (migrations `20261101000004_lot3_grand_livre.sql` et `20261101000007_lot3_retraits.sql`).
- **Grand livre `finance_ledger`** : écritures signées et datées, chacune avec une clé unique qui la rend idempotente.
  - VENTE : passée par un trigger à la confirmation d'un paiement plateforme. Elle devient disponible à la fin de l'événement + délai, ou à la date de début à 23:59 (Africa/Dakar) si la fin manque.
  - Débits par `fin_ledger_debit`, sous verrou du compte : jamais au-delà du solde, et le reste devient une créance avec alerte.
  - Compensation automatique des créances sur les crédits suivants.
- **`withdrawal_request`** : sous verrou du compte, montant entier, seuil et frais lus dans les réglages (frais au FCFA supérieur), solde disponible, débit immédiat.
  - Cashout `WITHDRAWAL-<id>` au montant net, vers le numéro déclaré, sur Wave ou Orange Money.
  - Banque refusée tant que le réglage est faux. Même clé d'idempotence → DUPLICATE.
  - Un envoi refusé rend le solde (`RETRAIT_ANNULE`) ; un envoi INCERTAIN le garde réservé.
- **Suppressions** : l'ancienne RPC `request_withdrawal` (solde de parrainage seul, frais calculés par l'appelant), la politique `withdrawals_insert` et la contrainte `gross_amount >= 5000` (le seuil devient un réglage).
- **OTP** : `otp_codes.purpose` est ajouté et chaque émetteur ou vérificateur passe son objet. `verify-otp` n'accepte que les codes du parcours de compte : un code de retrait n'ouvre jamais de session.
- **Routes** :
  - `POST /api/withdrawals/otp` envoie le code au téléphone du compte ;
  - `POST /api/withdrawals/request` exige une session ACTIF, `Idempotency-Key` et un OTP WITHDRAWAL ;
  - `GET /api/finance/balance` donne le solde.
- **Pages** : finance partenaire (compte ORGANISATEUR) et portefeuille (PARRAINAGE) affichent disponible, en attente avec sa date, retraits en cours, créance, historique et le parcours de retrait.

**parcours/finance-retraits**

Run 31 (avant correctif) :

```text
    not ok 1 - solde organisateur : prix faciaux des billets payés en ligne seulement ; vente espèces et invitation n’ajoutent rien
        → solde ORGANISATEUR : Could not find the function public.finance_account_balance(p_kind, p_owner) in the schema cache
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.finance_account_balance with parameters p_kind, p_owner or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 2 - fonds en attente jusqu’à la fin de l’événement + 48 h ; disponibles dès la confirmation si payout_hold_enabled = false (non rétroactif)
        → réglage finance.payout_hold_enabled absent de platform_settings
    not ok 3 - date de fin absente : date de début à 23:59 (Africa/Dakar) + 48 h
        → réglage finance.payout_hold_enabled absent de platform_settings
    not ok 4 - deux retraits simultanés qui dépassent ensemble le solde : un seul accepté
        → réglage finance.payout_hold_enabled absent de platform_settings
    not ok 5 - montants et comptes refusés : BELOW_MINIMUM (seuil 5 000 F), INVALID_AMOUNT, INSUFFICIENT_BALANCE, NOT_PARTNER
        → réglage finance.payout_hold_enabled absent de platform_settings
    not ok 6 - virement bancaire refusé tant que finance.withdrawal_bank_enabled est désactivé (BANK_DISABLED)
        → réglage finance.payout_hold_enabled absent de platform_settings
    not ok 7 - frais de 1 % arrondis au FCFA supérieur ; cashout WITHDRAWAL-<id> au montant net, vers le numéro déclaré
        → réglage finance.payout_hold_enabled absent de platform_settings
    not ok 8 - délai dépassé après envoi : cashout INCERTAIN, aucun second envoi, retrait non REJECTED, solde toujours réservé
        → réglage finance.payout_hold_enabled absent de platform_settings
    not ok 9 - refus explicite de SamirPay : retrait REJECTED, écriture RETRAIT_ANNULE, solde rendu
        → réglage finance.payout_hold_enabled absent de platform_settings
    not ok 10 - solde de parrainage distinct du solde organisateur ; retirable au FCFA inférieur ; commissions allouées
        → réglage finance.payout_hold_enabled absent de platform_settings
    not ok 11 - compte SUSPENDU : retrait, code de retrait et solde refusés (ACCOUNT_NOT_ACTIVE)
        → réglage finance.payout_hold_enabled absent de platform_settings
    not ok 12 - Idempotency-Key : même clé → même retrait, un seul cashout, un seul envoi ; RPC : DUPLICATE avant le contrôle du solde
        → réglage finance.payout_hold_enabled absent de platform_settings
    not ok 13 - GET /api/finance/balance : disponible, en attente, retraits en cours et historique ; 401 sans session
        → réglage finance.payout_hold_enabled absent de platform_settings
    not ok 14 - contrôle statique : plus d’envoi d’argent hors du module de cashout, plus de request_withdrawal
        → withdrawal.service.ts ne doit plus appeler sendCashout directement
    not ok 15 - ancienne RPC request_withdrawal supprimée
        → fonction absente attendue, obtenu P0001 INSUFFICIENT_BALANCE:Solde disponible : 0 FCFA — Montant demandé : 5000 FCFA
not ok 1 - Lot 3.6 — soldes et retraits
not ok 2 - /home/runner/work/event-village/event-village/tests/parcours/finance-retraits.test.ts
        → column "net_revenue_reversal" does not exist
# pass 0
# fail 15
```

Run 32 (après correctif) :

```text
    ok 1 - solde organisateur : prix faciaux des billets payés en ligne seulement ; vente espèces et invitation n’ajoutent rien
    ok 2 - fonds en attente jusqu’à la fin de l’événement + 48 h ; disponibles dès la confirmation si payout_hold_enabled = false (non rétroactif)
    ok 3 - date de fin absente : date de début à 23:59 (Africa/Dakar) + 48 h
    ok 4 - deux retraits simultanés qui dépassent ensemble le solde : un seul accepté
    ok 5 - montants et comptes refusés : BELOW_MINIMUM (seuil 5 000 F), INVALID_AMOUNT, INSUFFICIENT_BALANCE, NOT_PARTNER
    ok 6 - virement bancaire refusé tant que finance.withdrawal_bank_enabled est désactivé (BANK_DISABLED)
    ok 7 - frais de 1 % arrondis au FCFA supérieur ; cashout WITHDRAWAL-<id> au montant net, vers le numéro déclaré
    ok 8 - délai dépassé après envoi : cashout INCERTAIN, aucun second envoi, retrait non REJECTED, solde toujours réservé
    ok 9 - refus explicite de SamirPay : retrait REJECTED, écriture RETRAIT_ANNULE, solde rendu
    ok 10 - solde de parrainage distinct du solde organisateur ; retirable au FCFA inférieur ; commissions allouées
    ok 11 - compte SUSPENDU : retrait, code de retrait et solde refusés (ACCOUNT_NOT_ACTIVE)
    ok 12 - Idempotency-Key : même clé → même retrait, un seul cashout, un seul envoi ; RPC : DUPLICATE avant le contrôle du solde
    ok 13 - GET /api/finance/balance : disponible, en attente, retraits en cours et historique ; 401 sans session
    ok 14 - contrôle statique : plus d’envoi d’argent hors du module de cashout, plus de request_withdrawal
    ok 15 - ancienne RPC request_withdrawal supprimée
ok 1 - Lot 3.6 — soldes et retraits
# pass 15
# fail 0
```

**parcours/otp-objet**

Run 31 (avant correctif) :

```text
    not ok 1 - storeOtp / verifyStoredOtp : un code LOGIN est refusé pour WITHDRAWAL sans être consommé, puis accepté pour LOGIN
        → lecture de otp_codes.purpose : column otp_codes.purpose does not exist
        → +   code: '42703',
        → +   details: null,
        → +   hint: null,
    not ok 2 - un code REGISTER et un code WITHDRAWAL du même numéro coexistent ; chacun ne vaut que pour son objet
        → code de retrait refusé pour une inscription
        → true !== false
    not ok 3 - route de retrait : un code de connexion est refusé, le code WITHDRAWAL est accepté, le code de connexion reste valable pour la connexion
        → réglage finance.payout_hold_enabled absent de platform_settings
    not ok 4 - verify-otp : un code WITHDRAWAL n’ouvre pas de session
        → réglage finance.payout_hold_enabled absent de platform_settings
not ok 1 - Objet des codes OTP
not ok 2 - /home/runner/work/event-village/event-village/tests/parcours/otp-objet.test.ts
        → column "net_revenue_reversal" does not exist
# pass 0
# fail 4
```

Run 32 (après correctif) :

```text
    ok 1 - storeOtp / verifyStoredOtp : un code LOGIN est refusé pour WITHDRAWAL sans être consommé, puis accepté pour LOGIN
    ok 2 - un code REGISTER et un code WITHDRAWAL du même numéro coexistent ; chacun ne vaut que pour son objet
    ok 3 - route de retrait : un code de connexion est refusé, le code WITHDRAWAL est accepté, le code de connexion reste valable pour la connexion
    ok 4 - verify-otp : un code WITHDRAWAL n’ouvre pas de session
ok 1 - Objet des codes OTP
# pass 4
# fail 0
```

**security/r14-retraits-insertion**

Run 31 (avant correctif) :

```text
    not ok 1 - compte connecté : insertion d'un retrait PAID à son nom → refusée
        → INSERT withdrawals (retrait PAID forgé) : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 2 - compte connecté : insertion d'un retrait PENDING à son nom → refusée
        → INSERT withdrawals (retrait PENDING forgé) : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    ok 3 - compte connecté : appel direct de withdrawal_request → refusé
not ok 1 - R14 — insertion directe dans withdrawals refusée
# pass 1
# fail 2
```

Run 32 (après correctif) :

```text
    ok 1 - compte connecté : insertion d'un retrait PAID à son nom → refusée
    ok 2 - compte connecté : insertion d'un retrait PENDING à son nom → refusée
    ok 3 - compte connecté : appel direct de withdrawal_request → refusé
ok 1 - R14 — insertion directe dans withdrawals refusée
# pass 3
# fail 0
```

**parcours/paiement-remboursement**

Run 31 (code non corrigé, version du test antérieure à son adaptation dans un commit de correctif : pas un test rouge) :

```text
    ok 1 - payeur Orange Money : remboursement sur Orange Money, au numéro payeur (9 chiffres), prénom et nom
    ok 2 - opérateur ou numéro inconnu : aucun cashout envoyé, remboursement en attente, alerte admin
    ok 3 - deux envois simultanés pour le même remboursement : un seul cashout
    ok 4 - délai dépassé simulé : INCERTAIN, aucun second envoi, alerte
    ok 5 - solde partenaire insuffisant : aucun envoi, alerte
    ok 6 - annulation d’événement : remboursements par le module (REFUND-<paymentId>), CASH et invitations exclus
    ok 7 - code : aucun numéro de repli, aucun opérateur par défaut, un seul module d’envoi
ok 1 - Remboursement automatique et module de cashout
# pass 7
# fail 0
```

Run 32 (après correctif) :

```text
    ok 1 - payeur Orange Money : remboursement sur Orange Money, au numéro payeur (9 chiffres), prénom et nom
    ok 2 - opérateur ou numéro inconnu : aucun cashout envoyé, remboursement en attente, alerte admin
    ok 3 - deux envois simultanés pour le même remboursement : un seul cashout
    ok 4 - délai dépassé simulé : INCERTAIN, aucun second envoi, alerte
    ok 5 - solde partenaire insuffisant : aucun envoi, alerte
    ok 6 - annulation d’événement : remboursements par le module (REFUND-<paymentId>), CASH et invitations exclus
    ok 7 - code : aucun numéro de repli, aucun opérateur par défaut, un seul module d’envoi
ok 1 - Remboursement automatique et module de cashout
# pass 7
# fail 0
```

### 3.7 — Annulation d'événement et règle de disponibilité

```text
$ git grep -n -E 'requestRefund\(|status: '"'"'REMBOURSE'"'"'|status: '"'"'ANNULE'"'"'' 1d8e567 -- lib/events/event-cancellation.service.ts
1d8e567:lib/events/event-cancellation.service.ts:182:                status: 'ANNULE',
1d8e567:lib/events/event-cancellation.service.ts:220:                status: 'ANNULE',
1d8e567:lib/events/event-cancellation.service.ts:263:            const cashout = await CashoutService.requestRefund({ paymentId: p.id, reason: `Annulation de l'événement « ${event.title} »`, kind: 'EVENT_CANCELLATION_REFUND' });
1d8e567:lib/events/event-cancellation.service.ts:281:                .update({ status: 'REMBOURSE', updated_at: new Date().toISOString() })
(code de sortie 0)
```

**Correctif.**
- Les paiements en ligne SUCCESS ou PARTIAL de l'événement reçoivent le RESTE dû : total payé, frais de service compris, moins les remboursements déjà demandés.
- Les billets en espèces passent par « à rembourser par l'organisateur » ; les invitations sont annulées. Aucun cashout pour les uns ni pour les autres.
- Les billets ne passent REMBOURSE, et le client n'est prévenu du versement, qu'à la confirmation. Avant ce lot, c'était dès l'envoi.
- Si les fonds ont déjà été retirés (le réglage `finance.payout_hold_enabled = false` les rend disponibles dès la confirmation), le débit organisateur est limité au solde : le reste devient une créance, avec une alerte qui porte son identifiant.

**parcours/finance-annulation**

Run 31 (avant correctif) :

```text
    not ok 1 - 3 paiements en ligne, 1 vente espèces, 1 invitation → 3 cashouts au total client, rien pour les deux autres
        → réglage finance.cancellation_aggregator_fee_bearer absent de platform_settings
    not ok 2 - fonds déjà retirés par l’organisateur → débit limité au solde, créance et alerte admin
        → réglage finance.cancellation_aggregator_fee_bearer absent de platform_settings
not ok 1 - Annulation d’un événement
not ok 2 - /home/runner/work/event-village/event-village/tests/parcours/finance-annulation.test.ts
        → column "net_revenue_reversal" does not exist
# pass 0
# fail 2
```

Run 32 (après correctif) :

```text
    ok 1 - 3 paiements en ligne, 1 vente espèces, 1 invitation → 3 cashouts au total client, rien pour les deux autres
    ok 2 - fonds déjà retirés par l’organisateur → débit limité au solde, créance et alerte admin
ok 1 - Annulation d’un événement
# pass 2
# fail 0
```

### 3.8 — Rapports (partner-ux-7, ticketing-finance-13)

```text
$ git grep -n -E 'totalRefundedAmount|totalCommission|commissionAmount = 0' 1d8e567 -- lib/partner
1d8e567:lib/partner/partner-dashboard.service.ts:123:        totalCommission: number;
1d8e567:lib/partner/partner-dashboard.service.ts:264:        const totalCommission = totalGrossRevenue - totalNetRevenue;
1d8e567:lib/partner/partner-dashboard.service.ts:383:                commissionAmount: totalCommission,
1d8e567:lib/partner/partner-dashboard.service.ts:455:            const commissionAmount = 0;
1d8e567:lib/partner/partner-dashboard.service.ts:494:        const totalCommission = salesByCategory.reduce((s, c) => s + c.commissionAmount, 0);
1d8e567:lib/partner/partner-dashboard.service.ts:495:        const totalRefundedAmount = refundedGross;
1d8e567:lib/partner/partner-dashboard.service.ts:496:        const totalNet = totalGross - totalCommission - totalRefundedAmount;
1d8e567:lib/partner/partner-dashboard.service.ts:543:                totalCommission,
1d8e567:lib/partner/partner-dashboard.service.ts:544:                totalRefunded: totalRefundedAmount,
1d8e567:lib/partner/partner-dashboard.service.ts:708:        stream += `${pageWidth - 180} ${finBoxY + 54} Td\n(- ${data.financialSummary.totalCommission.toLocaleString('fr-FR')} FCFA) Tj\nET\n`;
(code de sortie 0)

$ git grep -n -E 'price|paid_amount \|\| ' 1d8e567 -- app/api/partner/finance/route.ts
1d8e567:app/api/partner/finance/route.ts:64:                .select('price')
1d8e567:app/api/partner/finance/route.ts:67:            ticketRevenue = tickets?.reduce((s: number, t: { price: number }) => s + Number(t.price || 0), 0) || 0;
1d8e567:app/api/partner/finance/route.ts:92:            s + Number(o.paid_amount || o.total_amount || 0), 0);
(code de sortie 0)
```

**Correctif.** `finance_partner_summary(partenaire, événement)` alimente le rapport de clôture (PDF compris), l'export comptable, le tableau de bord et la finance partenaire :
- net organisateur = Σ VENTE + REMBOURSEMENT : le remboursement n'est déduit qu'une fois ;
- frais de service payés par l'acheteur : ligne informative, non déduite ;
- ventes en espèces à part ;
- montants disponibles et en attente.

La commission Event Village sur l'organisateur vaut 0, puisque les frais sont payés par l'acheteur.

**parcours/finance-rapports**

Run 31 (avant correctif) :

```text
    not ok 1 - rapport de clôture : net = faciaux des billets restants en ligne, frais acheteur informatifs, espèces séparées
        → test did not finish before its parent and was cancelled
    not ok 2 - finance partenaire : même net billetterie, mêmes lignes informatives
        → test did not finish before its parent and was cancelled
not ok 1 - Rapports partenaire lus depuis le grand livre
        → réglage finance.cancellation_aggregator_fee_bearer absent de platform_settings
not ok 2 - /home/runner/work/event-village/event-village/tests/parcours/finance-rapports.test.ts
        → column "net_revenue_reversal" does not exist
# pass 0
# fail 0
```

Run 32 (après correctif) :

```text
    ok 1 - rapport de clôture : net = faciaux des billets restants en ligne, frais acheteur informatifs, espèces séparées
    ok 2 - finance partenaire : même net billetterie, mêmes lignes informatives
ok 1 - Rapports partenaire lus depuis le grand livre
# pass 2
# fail 0
```

### 3.9 — Invariant financier

```text
$ git grep -n -E 'FINANCE_INVARIANT_SQL|assertFinanceInvariants' 1d8e567 -- tests/helpers
1d8e567:tests/helpers/finance-invariants.ts:19:export const FINANCE_INVARIANT_SQL = `
1d8e567:tests/helpers/finance-invariants.ts:100:    return inspect(async (db) => (await db.query<Violation>(FINANCE_INVARIANT_SQL)).rows);
1d8e567:tests/helpers/finance-invariants.ts:104:export async function assertFinanceInvariants(label: string): Promise<void> {
(code de sortie 0)
```

Aucun code de production : l'invariant est vérifié par les tests (section 4). Le garde-fou ci-dessous fabrique, dans une transaction annulée, une violation pour chaque règle (d), (e) et (f), et vérifie qu'elle est détectée.

**parcours/finance-invariant**

Run 31 (avant correctif) :

```text
    not ok 1 - chaque règle détecte une violation fabriquée (transaction annulée)
        → column "facial_amount" of relation "payments" does not exist
not ok 1 - Invariant financier (d)(e)(f)
        → column "net_revenue_reversal" does not exist
# pass 0
# fail 1
```

Run 32 (après correctif) :

```text
    ok 1 - chaque règle détecte une violation fabriquée (transaction annulée)
ok 1 - Invariant financier (d)(e)(f)
# pass 1
# fail 0
```

---

## 3. Réglages créés

Les clés sont créées par la migration `20261101000002_lot3_reglages.sql`, sous la forme `{"value": …}`.

- **Modification** : SUPERADMIN actif uniquement, par `PUT /api/admin/finance-settings` ou la page `/admin/finance-settings`. La route appelle la RPC `finance_setting_set`, qui valide la valeur et exige un motif ; la modification est historisée dans `platform_settings_history`.
- **Lecture** : ADMIN et SUPERADMIN (`GET`).
- **Refusé** : l'écriture directe par un ADMIN (RLS) et l'écriture par `/api/admin/pricing`.

| Clé | Défaut | Valeurs admises | Recopié sur (non rétroactif) |
|---|---|---|---|
| `finance.service_fee_rate` | 5 | 0 à 50 (%) | paiement (`service_fee_rate`), billet (`service_fee`) |
| `finance.aggregator_fee_rate.WAVE` | 1,5 | 0 à 10 (%) | paiement (`aggregator_fee_rate`) |
| `finance.aggregator_fee_rate.ORANGE_MONEY` | 1,5 | 0 à 10 (%) | paiement (`aggregator_fee_rate`) |
| `finance.cancellation_aggregator_fee_bearer` | EVENT_VILLAGE | EVENT_VILLAGE, ORGANISATEUR | remboursement (`aggregator_fee_bearer`) |
| `finance.payout_hold_enabled` | true | booléen | paiement (`payout_hold_enabled`) |
| `finance.payout_delay_hours` | 48 | entier de 0 à 720 | paiement (`payout_delay_hours`) |
| `finance.withdrawal_fee_rate` | 1 | 0 à 10 (%) | retrait (`fee_rate`) |
| `finance.withdrawal_min_amount` | 5 000 | entier ≥ 0 | contrôlé à la demande de retrait |
| `finance.withdrawal_bank_enabled` | false | booléen | contrôlé à la demande de retrait |
| `finance.referral_availability_days` | 7 | entier de 7 à 14 (CDC §102) | commission (`available_at`) |

---

## 4. Invariant étendu : requête SQL et sortie

L'invariant du lot 2 (a)(b)(c) est vérifié d'abord (`tests/helpers/payment-invariants.ts` ; (a) et (b) acceptent PARTIAL, voir section 1). Viennent ensuite les règles (d)(e)(f) (`tests/helpers/finance-invariants.ts`), à la fin de chaque suite financière :
- **(d)** pour chaque paiement plateforme confirmé :
  - total = facial + service ;
  - reversement = facial (hors abonnement) ;
  - net EV = service − agrégateur ;
  - part remboursée du net et montant remboursé égaux à la somme des remboursements ;
  - statut PARTIAL ou REFUNDED cohérent avec le montant remboursé ;
- **(e)** pour chaque compte du grand livre :
  - solde total ≥ 0 et solde disponible ≥ 0 ;
  - `finance_account_balance` égal aux crédits moins les débits ;
  - une seule écriture VENTE, égale au reversement, pour chaque paiement plateforme confirmé d'un partenaire ;
- **(f)** aucune commission non annulée sur un paiement REFUNDED sans régularisations égales à −montant.

```sql
-- (a)(b)(c) : tests/helpers/payment-invariants.ts (INVARIANT_SQL, $1 = vérification après purge)
WITH reserved AS (
    SELECT payment_id, sum(quantity)::int AS qty FROM public.stock_reservations GROUP BY payment_id
), issued AS (
    SELECT payment_id, count(*)::int AS n FROM public.tickets WHERE payment_id IS NOT NULL GROUP BY payment_id
), active AS (
    SELECT category_id,
           sum(quantity) FILTER (WHERE status = 'ACTIVE')::int AS q_active,
           sum(quantity) FILTER (WHERE status = 'ACTIVE' AND expires_at > now())::int AS q_live
      FROM public.stock_reservations GROUP BY category_id
)
SELECT 'a' AS regle, p.id::text AS objet,
       format('paiement %s : %s billet(s) émis pour %s réservé(s)', p.status, coalesce(i.n, 0), coalesce(r.qty, 0)) AS detail
  FROM public.payments p
  LEFT JOIN reserved r ON r.payment_id = p.id
  LEFT JOIN issued i ON i.payment_id = p.id
 WHERE p.status IN ('SUCCESS', 'PARTIAL') AND p.payment_target = 'TICKET' AND p.is_platform_payment
   AND (coalesce(i.n, 0) = 0 OR coalesce(i.n, 0) <> coalesce(r.qty, 0))
UNION ALL
SELECT 'b', t.id::text, format('billet %s à %s F sans paiement SUCCESS ni PARTIAL (%s)', t.status, t.price, coalesce(p.status::text, 'aucun paiement'))
  FROM public.tickets t
  LEFT JOIN public.payments p ON p.id = t.payment_id
 WHERE t.price > 0 AND t.status IN ('VALIDE', 'UTILISE')
   AND (p.id IS NULL OR p.status NOT IN ('SUCCESS', 'PARTIAL'))
UNION ALL
SELECT 'c', c.id::text, format('sold %s + held %s > total %s', c.sold_quantity, c.held_quantity, c.total_quantity)
  FROM public.ticket_categories c
 WHERE c.sold_quantity + c.held_quantity > c.total_quantity
UNION ALL
SELECT 'c', c.id::text, format('held %s ≠ réservations %s : %s', c.held_quantity,
       CASE WHEN $1::boolean THEN 'ACTIVE non échues' ELSE 'ACTIVE' END,
       CASE WHEN $1::boolean THEN coalesce(a.q_live, 0) ELSE coalesce(a.q_active, 0) END)
  FROM public.ticket_categories c
  LEFT JOIN active a ON a.category_id = c.id
 WHERE c.held_quantity <> CASE WHEN $1::boolean THEN coalesce(a.q_live, 0) ELSE coalesce(a.q_active, 0) END
ORDER BY 1, 2

-- (d)(e)(f) : tests/helpers/finance-invariants.ts (FINANCE_INVARIANT_SQL)
WITH refund_sums AS (
    SELECT payment_id,
           sum(net_revenue_reversal) AS reversal,
           sum(amount) FILTER (WHERE status = 'PROCESSED' AND settlement = 'PLATEFORME') AS refunded
      FROM public.refunds WHERE payment_id IS NOT NULL GROUP BY payment_id
), confirmed AS (
    SELECT p.* FROM public.payments p
     WHERE p.is_platform_payment AND p.status IN ('SUCCESS', 'PARTIAL', 'REFUNDED')
), credited AS (
    -- paiements passés par SUCCESS (un panier non honorable va de PENDING à REFUND_PENDING puis REFUNDED, sans billet)
    SELECT p.* FROM confirmed p
     WHERE p.status IN ('SUCCESS', 'PARTIAL')
        OR (p.status = 'REFUNDED' AND (p.payment_target <> 'TICKET' OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.payment_id = p.id)))
), accounts AS (
    SELECT owner_id, account_kind, sum(amount) AS total,
           coalesce(sum(amount) FILTER (WHERE available_at <= now()), 0) AS available
      FROM public.finance_ledger GROUP BY owner_id, account_kind
), sales AS (
    SELECT payment_id, count(*) AS n, sum(amount) AS amount FROM public.finance_ledger
     WHERE entry_type = 'VENTE' GROUP BY payment_id
), regul AS (
    SELECT regularizes_id, sum(amount) AS amount FROM public.referral_commissions
     WHERE kind = 'REGULARISATION' GROUP BY regularizes_id
)
SELECT 'd' AS regle, p.id::text AS objet, format('%s : montants financiers absents (facial %s)', p.payment_target, p.facial_amount) AS detail
  FROM confirmed p WHERE p.facial_amount IS NULL
UNION ALL
SELECT 'd', p.id::text, format('total %s ≠ facial %s + service %s', p.amount, p.facial_amount, p.service_fee)
  FROM confirmed p WHERE p.facial_amount IS NOT NULL AND p.amount <> p.facial_amount + p.service_fee
UNION ALL
SELECT 'd', p.id::text, format('reversement %s ≠ facial %s', p.partner_payout_amount, p.facial_amount)
  FROM confirmed p WHERE p.facial_amount IS NOT NULL AND p.payment_target <> 'SUBSCRIPTION' AND p.partner_payout_amount <> p.facial_amount
UNION ALL
SELECT 'd', p.id::text, format('net EV %s ≠ %s − agrégateur %s', p.net_event_village_revenue,
       CASE WHEN p.payment_target = 'SUBSCRIPTION' THEN p.facial_amount ELSE p.service_fee END, p.aggregator_fee)
  FROM confirmed p WHERE p.facial_amount IS NOT NULL
   AND p.net_event_village_revenue <> round((CASE WHEN p.payment_target = 'SUBSCRIPTION' THEN p.facial_amount ELSE p.service_fee END) - p.aggregator_fee, 2)
UNION ALL
SELECT 'd', p.id::text, format('part remboursée du net %s ≠ Σ des remboursements %s', p.refunded_net_revenue, coalesce(r.reversal, 0))
  FROM confirmed p LEFT JOIN refund_sums r ON r.payment_id = p.id
 WHERE p.facial_amount IS NOT NULL AND p.refunded_net_revenue <> coalesce(r.reversal, 0)
UNION ALL
SELECT 'd', p.id::text, format('montant remboursé %s ≠ Σ des remboursements versés %s', p.refunded_amount, coalesce(r.refunded, 0))
  FROM confirmed p LEFT JOIN refund_sums r ON r.payment_id = p.id
 WHERE p.facial_amount IS NOT NULL AND p.refunded_amount <> coalesce(r.refunded, 0)
UNION ALL
SELECT 'd', p.id::text, format('statut %s incohérent avec %s remboursé sur %s', p.status, p.refunded_amount, p.amount)
  FROM confirmed p
 WHERE p.facial_amount IS NOT NULL AND (
       (p.status = 'SUCCESS' AND p.refunded_amount > 0)
    OR (p.status = 'PARTIAL' AND NOT (p.refunded_amount > 0 AND p.refunded_amount < p.amount))
    OR (p.status = 'REFUNDED' AND p.refunded_amount < p.amount AND p.payment_target = 'TICKET' AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.payment_id = p.id)))
UNION ALL
SELECT 'e', a.owner_id::text || '/' || a.account_kind, format('solde total %s, disponible %s', a.total, a.available)
  FROM accounts a WHERE a.total < 0 OR a.available < 0
UNION ALL
SELECT 'e', a.owner_id::text || '/' || a.account_kind,
       format('finance_account_balance %s ≠ grand livre (disponible %s, en attente %s)', b.v, a.available, a.total - a.available)
  FROM accounts a CROSS JOIN LATERAL (SELECT public.finance_account_balance(a.owner_id, a.account_kind) AS v) b
 WHERE (b.v->>'available')::numeric <> a.available OR (b.v->>'pending')::numeric <> a.total - a.available
UNION ALL
SELECT 'e', p.id::text, format('écritures VENTE : %s pour %s, reversement %s', coalesce(s.n, 0), coalesce(s.amount, 0), p.partner_payout_amount)
  FROM credited p LEFT JOIN sales s ON s.payment_id = p.id
 WHERE p.payment_target <> 'SUBSCRIPTION' AND p.partner_id IS NOT NULL AND p.partner_payout_amount > 0
   AND (coalesce(s.n, 0) <> 1 OR s.amount <> p.partner_payout_amount)
UNION ALL
SELECT 'e', s.payment_id::text, 'écriture VENTE sans paiement plateforme confirmé'
  FROM sales s WHERE NOT EXISTS (SELECT 1 FROM credited p WHERE p.id = s.payment_id)
UNION ALL
SELECT 'f', c.id::text, format('commission %s (%s) sur paiement REFUNDED : régularisations %s', c.amount, c.status, coalesce(g.amount, 0))
  FROM public.referral_commissions c
  JOIN public.payments p ON p.id = c.payment_id
  LEFT JOIN regul g ON g.regularizes_id = c.id
 WHERE p.status = 'REFUNDED' AND c.kind = 'COMMISSION' AND c.status <> 'CANCELLED'
   AND coalesce(g.amount, 0) <> -c.amount
ORDER BY 1, 2
```

Sortie brute, run 32 (toutes les suites financières) :

```text
# tests__parcours__finance-affichage.test.ts.log
[INVARIANT] finance-affichage — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] finance-affichage — purge des réservations échues : {"expired":0}
[INVARIANT] finance-affichage — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] finance-affichage — (d)(e)(f) : 0 violation(s)
# tests__parcours__finance-annulation.test.ts.log
[INVARIANT] finance-annulation — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] finance-annulation — purge des réservations échues : {"expired":0}
[INVARIANT] finance-annulation — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] finance-annulation — (d)(e)(f) : 0 violation(s)
# tests__parcours__finance-cibles.test.ts.log
[INVARIANT] finance-cibles — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] finance-cibles — purge des réservations échues : {"expired":0}
[INVARIANT] finance-cibles — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] finance-cibles — (d)(e)(f) : 0 violation(s)
# tests__parcours__finance-commissions.test.ts.log
[INVARIANT] finance-commissions — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] finance-commissions — purge des réservations échues : {"expired":0}
[INVARIANT] finance-commissions — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] finance-commissions — (d)(e)(f) : 0 violation(s)
# tests__parcours__finance-hors-plateforme.test.ts.log
[INVARIANT] finance-hors-plateforme — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] finance-hors-plateforme — purge des réservations échues : {"expired":0}
[INVARIANT] finance-hors-plateforme — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] finance-hors-plateforme — (d)(e)(f) : 0 violation(s)
# tests__parcours__finance-invariant.test.ts.log
[INVARIANT] finance-invariant — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] finance-invariant — purge des réservations échues : {"expired":0}
[INVARIANT] finance-invariant — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] finance-invariant — (d)(e)(f) : 0 violation(s)
# tests__parcours__finance-moteur.test.ts.log
[INVARIANT] finance-moteur — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] finance-moteur — purge des réservations échues : {"expired":0}
[INVARIANT] finance-moteur — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] finance-moteur — (d)(e)(f) : 0 violation(s)
# tests__parcours__finance-rapports.test.ts.log
[INVARIANT] finance-rapports — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] finance-rapports — purge des réservations échues : {"expired":0}
[INVARIANT] finance-rapports — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] finance-rapports — (d)(e)(f) : 0 violation(s)
# tests__parcours__finance-reglages.test.ts.log
[INVARIANT] finance-reglages — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] finance-reglages — purge des réservations échues : {"expired":0}
[INVARIANT] finance-reglages — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] finance-reglages — (d)(e)(f) : 0 violation(s)
# tests__parcours__finance-remboursement-billet.test.ts.log
[INVARIANT] finance-remboursement-billet — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] finance-remboursement-billet — purge des réservations échues : {"expired":0}
[INVARIANT] finance-remboursement-billet — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] finance-remboursement-billet — (d)(e)(f) : 0 violation(s)
# tests__parcours__finance-retraits.test.ts.log
[INVARIANT] finance-retraits — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] finance-retraits — purge des réservations échues : {"expired":0}
[INVARIANT] finance-retraits — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] finance-retraits — (d)(e)(f) : 0 violation(s)
```

---

## 5. Suites legacy touchées

Les suites `tests/legacy/` sont en quarantaine : `npm test` ne les exécute pas, mais elles sont typecheckées. Le lot 3 a supprimé deux API qu'elles pouvaient appeler, `WithdrawalService.processWithdrawal` et `EventService.refundTicket`. Seule la première était encore appelée, par une seule suite.

Commit `68bd6a0`, sortie brute :

```text
$ git show --format= --name-status 68bd6a0 -- tests/legacy
M	tests/legacy/chunk5-phase2-b2c.test.ts
$ git show --format= --shortstat 68bd6a0 -- tests/legacy
 1 file changed, 3 insertions(+), 112 deletions(-)
```

- **`chunk5-phase2-b2c`, cas 8** (« CASHOUT SAMIRPAY AUTOMATIQUE (§83) ») : supprimé et remplacé, à sa place, par le commentaire `// [lot 3 — cas supprimé] …`. Il appelait `processWithdrawal`, remplacé par `withdrawal_request` (grand livre, seuil et frais réglés), le module de cashout et l'OTP. Le cas est couvert par `tests/parcours/finance-retraits.test.ts` : frais de 1 % au FCFA supérieur, seuil, cashout `WITHDRAWAL-<id>`, envoi INCERTAIN jamais relancé. Le reste de la suite est conservé, assertions inchangées.
- **Aucune autre suite legacy n'est modifiée.** `npx tsc --noEmit -p .` ne signale aucune erreur (sortie de la CI en section 6). `tests/legacy/cdc-v3-validation-checks` et `partner-dashboard-and-exports` importent encore `FinancialCalculatorService` (gardé `@deprecated`, point ouvert 7).
- **Assertions devenues fausses** : celles des suites legacy du lot 2, déjà signalées (point ouvert 11), restent non modifiées, conformément à la règle. Aucune autre n'a été recherchée dans les suites en quarantaine : elles seront à revoir à leur sortie.

---

## 6. Sortie brute de `npm run verify` et CI

Run de référence : **https://github.com/fallouu-mn/event-village/actions/runs/41242223807** (run 32, commit `68bd6a0`). Sortie complète : `docs/lot3-logs/ci-run32-verify.log` ; run rouge de référence : `docs/lot3-logs/ci-run31-verify.log`.

```text

> event-village@1.0.0 verify
> node scripts/verify.mjs


═══════════════ verify › typecheck : npm run typecheck ═══════════════

> event-village@1.0.0 typecheck
> tsc --noEmit


═══════════════ verify › lint : npm run lint ═══════════════

> event-village@1.0.0 lint
> next lint

✔ No ESLint warnings or errors

═══════════════ verify › test : npm run test ═══════════════

> event-village@1.0.0 test
> node scripts/run-tests.mjs

[run-tests] 77 suite(s) — garde-fou : tests/helpers/env.ts — délai/suite : 600.0s
[… 4743 lignes de sortie des suites, intégralement dans docs/lot3-logs/ci-run32-verify.log …]
═══════════════════ RÉCAPITULATIF ═══════════════════
Suite                                                Statut   Durée     Code  Journal
tests/auth-rbac.test.ts                              PASS     194ms     0     .test-logs/tests__auth-rbac.test.ts.log
tests/e2e-scenarios.test.ts                          PASS     374ms     0     .test-logs/tests__e2e-scenarios.test.ts.log
tests/fondations-lot0.test.ts                        PASS     299ms     0     .test-logs/tests__fondations-lot0.test.ts.log
tests/notifications-and-documents.test.ts            PASS     151ms     0     .test-logs/tests__notifications-and-documents.test.ts.log
tests/parcours/achat-serveur.test.ts                 PASS     513ms     0     .test-logs/tests__parcours__achat-serveur.test.ts.log
tests/parcours/anonymisation-debogage.test.ts        PASS     550ms     0     .test-logs/tests__parcours__anonymisation-debogage.test.ts.log
tests/parcours/attribution-roles.test.ts             PASS     920ms     0     .test-logs/tests__parcours__attribution-roles.test.ts.log
tests/parcours/bootstrap-superadmin.test.ts          PASS     406ms     0     .test-logs/tests__parcours__bootstrap-superadmin.test.ts.log
tests/parcours/changement-role-admin.test.ts         PASS     726ms     0     .test-logs/tests__parcours__changement-role-admin.test.ts.log
tests/parcours/documents-inscription.test.ts         PASS     1.4s      0     .test-logs/tests__parcours__documents-inscription.test.ts.log
tests/parcours/email-optionnel.test.ts               PASS     701ms     0     .test-logs/tests__parcours__email-optionnel.test.ts.log
tests/parcours/filtres-postgrest.test.ts             PASS     371ms     0     .test-logs/tests__parcours__filtres-postgrest.test.ts.log
tests/parcours/finance-affichage.test.ts             PASS     1.1s      0     .test-logs/tests__parcours__finance-affichage.test.ts.log
tests/parcours/finance-annulation.test.ts            PASS     1.9s      0     .test-logs/tests__parcours__finance-annulation.test.ts.log
tests/parcours/finance-cibles.test.ts                PASS     1.2s      0     .test-logs/tests__parcours__finance-cibles.test.ts.log
tests/parcours/finance-commissions.test.ts           PASS     3.7s      0     .test-logs/tests__parcours__finance-commissions.test.ts.log
tests/parcours/finance-hors-plateforme.test.ts       PASS     1.1s      0     .test-logs/tests__parcours__finance-hors-plateforme.test.ts.log
tests/parcours/finance-invariant.test.ts             PASS     354ms     0     .test-logs/tests__parcours__finance-invariant.test.ts.log
tests/parcours/finance-moteur.test.ts                PASS     1.1s      0     .test-logs/tests__parcours__finance-moteur.test.ts.log
tests/parcours/finance-rapports.test.ts              PASS     1.1s      0     .test-logs/tests__parcours__finance-rapports.test.ts.log
tests/parcours/finance-reglages.test.ts              PASS     1.0s      0     .test-logs/tests__parcours__finance-reglages.test.ts.log
tests/parcours/finance-remboursement-billet.test.ts  PASS     1.4s      0     .test-logs/tests__parcours__finance-remboursement-billet.test.ts.log
tests/parcours/finance-retraits.test.ts              PASS     4.8s      0     .test-logs/tests__parcours__finance-retraits.test.ts.log
tests/parcours/invitation-identite.test.ts           PASS     1.1s      0     .test-logs/tests__parcours__invitation-identite.test.ts.log
tests/parcours/otp-hachage.test.ts                   PASS     334ms     0     .test-logs/tests__parcours__otp-hachage.test.ts.log
tests/parcours/otp-objet.test.ts                     PASS     1.1s      0     .test-logs/tests__parcours__otp-objet.test.ts.log
tests/parcours/otp-serveur.test.ts                   PASS     603ms     0     .test-logs/tests__parcours__otp-serveur.test.ts.log
tests/parcours/paiement-confirmation.test.ts         PASS     1.1s      0     .test-logs/tests__parcours__paiement-confirmation.test.ts.log
tests/parcours/paiement-controles.test.ts            PASS     1.5s      0     .test-logs/tests__parcours__paiement-controles.test.ts.log
tests/parcours/paiement-gratuits.test.ts             PASS     991ms     0     .test-logs/tests__parcours__paiement-gratuits.test.ts.log
tests/parcours/paiement-guichet.test.ts              PASS     586ms     0     .test-logs/tests__parcours__paiement-guichet.test.ts.log
tests/parcours/paiement-operateur.test.ts            PASS     628ms     0     .test-logs/tests__parcours__paiement-operateur.test.ts.log
tests/parcours/paiement-reconciliation.test.ts       PASS     1.1s      0     .test-logs/tests__parcours__paiement-reconciliation.test.ts.log
tests/parcours/paiement-remboursement.test.ts        PASS     1.4s      0     .test-logs/tests__parcours__paiement-remboursement.test.ts.log
tests/parcours/paiement-reservation.test.ts          PASS     1.4s      0     .test-logs/tests__parcours__paiement-reservation.test.ts.log
tests/parcours/paiement-retour.test.ts               PASS     488ms     0     .test-logs/tests__parcours__paiement-retour.test.ts.log
tests/parcours/paiement-statut.test.ts               PASS     907ms     0     .test-logs/tests__parcours__paiement-statut.test.ts.log
tests/parcours/paiement-webhook.test.ts              PASS     1.6s      0     .test-logs/tests__parcours__paiement-webhook.test.ts.log
tests/parcours/pin-regisseur.test.ts                 PASS     324ms     0     .test-logs/tests__parcours__pin-regisseur.test.ts.log
tests/parcours/realtime-scanner.test.ts              PASS     14.7s     0     .test-logs/tests__parcours__realtime-scanner.test.ts.log
tests/parcours/revocation-sessions.test.ts           PASS     1.3s      0     .test-logs/tests__parcours__revocation-sessions.test.ts.log
tests/parcours/roles-fraicheur.test.ts               PASS     696ms     0     .test-logs/tests__parcours__roles-fraicheur.test.ts.log
tests/parcours/roles-metadonnees.test.ts             PASS     473ms     0     .test-logs/tests__parcours__roles-metadonnees.test.ts.log
tests/parcours/sms-anti-abus.test.ts                 PASS     426ms     0     .test-logs/tests__parcours__sms-anti-abus.test.ts.log
tests/parcours/statut-compte.test.ts                 PASS     1.8s      0     .test-logs/tests__parcours__statut-compte.test.ts.log
tests/partner-auth-complete.test.ts                  PASS     325ms     0     .test-logs/tests__partner-auth-complete.test.ts.log
tests/partner-halls-m7.test.ts                       PASS     849ms     0     .test-logs/tests__partner-halls-m7.test.ts.log
tests/partner-orders-m9.test.ts                      PASS     1.0s      0     .test-logs/tests__partner-orders-m9.test.ts.log
tests/payment.test.ts                                PASS     152ms     0     .test-logs/tests__payment.test.ts.log
tests/roles-isolation.test.ts                        PASS     167ms     0     .test-logs/tests__roles-isolation.test.ts.log
tests/samirpay-contrat.test.ts                       PASS     3.6s      0     .test-logs/tests__samirpay-contrat.test.ts.log
tests/scanner-combat-ui.test.ts                      PASS     266ms     0     .test-logs/tests__scanner-combat-ui.test.ts.log
tests/scanner-wolof-audio.test.ts                    PASS     281ms     0     .test-logs/tests__scanner-wolof-audio.test.ts.log
tests/schema/fonctions-privileges.test.ts            PASS     212ms     0     .test-logs/tests__schema__fonctions-privileges.test.ts.log
tests/schema/hotfix-identique.test.ts                PASS     155ms     0     .test-logs/tests__schema__hotfix-identique.test.ts.log
tests/schema/hotfix-scripts.test.ts                  PASS     309ms     0     .test-logs/tests__schema__hotfix-scripts.test.ts.log
tests/schema/reset-test-password.test.ts             PASS     174ms     0     .test-logs/tests__schema__reset-test-password.test.ts.log
tests/schema/rls-toutes-tables.test.ts               PASS     183ms     0     .test-logs/tests__schema__rls-toutes-tables.test.ts.log
tests/schema/secrets-codes-en-dur.test.ts            PASS     195ms     0     .test-logs/tests__schema__secrets-codes-en-dur.test.ts.log
tests/security/anon-uniquement.test.ts               PASS     152ms     0     .test-logs/tests__security__anon-uniquement.test.ts.log
tests/security/r1-inscription-roles.test.ts          PASS     993ms     0     .test-logs/tests__security__r1-inscription-roles.test.ts.log
tests/security/r10-user-roles.test.ts                PASS     470ms     0     .test-logs/tests__security__r10-user-roles.test.ts.log
tests/security/r11-storage-documents.test.ts         PASS     474ms     0     .test-logs/tests__security__r11-storage-documents.test.ts.log
tests/security/r12-reglages-finance.test.ts          PASS     401ms     0     .test-logs/tests__security__r12-reglages-finance.test.ts.log
tests/security/r13-parrainage-relations.test.ts      PASS     564ms     0     .test-logs/tests__security__r13-parrainage-relations.test.ts.log
tests/security/r14-retraits-insertion.test.ts        PASS     439ms     0     .test-logs/tests__security__r14-retraits-insertion.test.ts.log
tests/security/r2-otp-codes.test.ts                  PASS     312ms     0     .test-logs/tests__security__r2-otp-codes.test.ts.log
tests/security/r3-fonctions-rpc.test.ts              PASS     519ms     0     .test-logs/tests__security__r3-fonctions-rpc.test.ts.log
tests/security/r4-ecritures-directes.test.ts         PASS     382ms     0     .test-logs/tests__security__r4-ecritures-directes.test.ts.log
tests/security/r5-lectures-anon.test.ts              PASS     361ms     0     .test-logs/tests__security__r5-lectures-anon.test.ts.log
tests/security/r6-roles-jeton.test.ts                PASS     478ms     0     .test-logs/tests__security__r6-roles-jeton.test.ts.log
tests/security/r7-profil-colonnes.test.ts            PASS     599ms     0     .test-logs/tests__security__r7-profil-colonnes.test.ts.log
tests/security/r8-controleur-lectures.test.ts        PASS     386ms     0     .test-logs/tests__security__r8-controleur-lectures.test.ts.log
tests/security/r9-partenaire-ecritures.test.ts       PASS     364ms     0     .test-logs/tests__security__r9-partenaire-ecritures.test.ts.log
tests/sms-formatage.test.ts                          PASS     233ms     0     .test-logs/tests__sms-formatage.test.ts.log
tests/superadmin-complete.test.ts                    PASS     258ms     0     .test-logs/tests__superadmin-complete.test.ts.log
tests/ux-performance-and-double-click.test.ts        PASS     498ms     0     .test-logs/tests__ux-performance-and-double-click.test.ts.log
──────────────────────────────────────────────────────
TOTAL : 77 suite(s) — 77 réussie(s), 0 en échec, 0 expirée(s)

═══════════════ verify › build : npm run build ═══════════════

> event-village@1.0.0 build
> next build

  ▲ Next.js 14.2.35
  - Experiments (use with caution):
    · instrumentationHook

   Creating an optimized production build ...
<w> [webpack.cache.PackFileCacheStrategy] Serializing big strings (108kiB) impacts deserialization performance (consider using Buffer instead and decode when needed)
<w> [webpack.cache.PackFileCacheStrategy] Serializing big strings (259kiB) impacts deserialization performance (consider using Buffer instead and decode when needed)
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/53) ...
[getServerSessionUser] Erreur session: B [Error]: Dynamic server usage: Route /api/partner/orders couldn't be rendered statically because it used `request.headers`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error
    at V (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:21778)
    at Object.get (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:29465)
    at o (/home/runner/work/event-village/event-village/.next/server/chunks/8272.js:1:11124)
    at d (/home/runner/work/event-village/event-village/.next/server/chunks/3138.js:1:920)
    at l (/home/runner/work/event-village/event-village/.next/server/chunks/3138.js:1:445)
    at c (/home/runner/work/event-village/event-village/.next/server/app/api/partner/orders/route.js:1:568)
    at /home/runner/work/event-village/event-village/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:38417
    at /home/runner/work/event-village/event-village/node_modules/next/dist/server/lib/trace/tracer.js:140:36
    at NoopContextManager.with (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:7062)
    at ContextAPI.with (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:518) {
  description: "Route /api/partner/orders couldn't be rendered statically because it used `request.headers`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error",
  digest: 'DYNAMIC_SERVER_USAGE'
}
   Generating static pages (13/53) 
   Generating static pages (26/53) 
   Generating static pages (39/53) 
 ✓ Generating static pages (53/53)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                             Size     First Load JS
┌ ○ /                                                   6.45 kB         119 kB
├ ○ /_not-found                                         177 B          87.8 kB
├ ○ /admin                                              177 B          87.8 kB
├ ○ /admin/audit                                        4.53 kB         108 kB
├ ○ /admin/communications                               5.56 kB         109 kB
├ ○ /admin/dashboard                                    13.1 kB         117 kB
├ ○ /admin/finance                                      7.23 kB         192 kB
├ ○ /admin/finance-settings                             6.22 kB         191 kB
├ ○ /admin/pricing                                      5.2 kB          109 kB
├ ○ /admin/referral                                     6.81 kB         110 kB
├ ○ /admin/services                                     5.96 kB         110 kB
├ ○ /admin/users                                        25.2 kB         142 kB
├ ƒ /api/admin/audit                                    0 B                0 B
├ ƒ /api/admin/communications                           0 B                0 B
├ ƒ /api/admin/events/[id]/cancel                       0 B                0 B
├ ƒ /api/admin/finance-settings                         0 B                0 B
├ ƒ /api/admin/finance/reconciliation                   0 B                0 B
├ ƒ /api/admin/metrics                                  0 B                0 B
├ ƒ /api/admin/partners                                 0 B                0 B
├ ƒ /api/admin/partners/[id]/status                     0 B                0 B
├ ƒ /api/admin/permissions                              0 B                0 B
├ ƒ /api/admin/pricing                                  0 B                0 B
├ ƒ /api/admin/promotions                               0 B                0 B
├ ƒ /api/admin/refunds/[id]/retry                       0 B                0 B
├ ƒ /api/admin/services                                 0 B                0 B
├ ƒ /api/admin/shifts/audit                             0 B                0 B
├ ƒ /api/admin/users                                    0 B                0 B
├ ƒ /api/admin/users/[id]/anonymize                     0 B                0 B
├ ƒ /api/auth/me                                        0 B                0 B
├ ƒ /api/auth/register                                  0 B                0 B
├ ƒ /api/auth/resolve-phone                             0 B                0 B
├ ƒ /api/auth/send-otp                                  0 B                0 B
├ ƒ /api/auth/sign-out-global                           0 B                0 B
├ ƒ /api/auth/sms-hook                                  0 B                0 B
├ ƒ /api/auth/verify-otp                                0 B                0 B
├ ƒ /api/checkout                                       0 B                0 B
├ ƒ /api/checkout/quote                                 0 B                0 B
├ ƒ /api/controller/assignments                         0 B                0 B
├ ƒ /api/controller/profile                             0 B                0 B
├ ƒ /api/controller/scan                                0 B                0 B
├ ƒ /api/controller/setup                               0 B                0 B
├ ƒ /api/controller/shifts/[id]/summary                 0 B                0 B
├ ƒ /api/controller/shifts/active                       0 B                0 B
├ ƒ /api/controller/shifts/close                        0 B                0 B
├ ƒ /api/controller/shifts/open                         0 B                0 B
├ ƒ /api/cron/moratoriums                               0 B                0 B
├ ƒ /api/cron/payments-reconcile                        0 B                0 B
├ ƒ /api/cron/referral-commissions                      0 B                0 B
├ ƒ /api/cron/stock-reservations                        0 B                0 B
├ ƒ /api/cron/ticket-transfers                          0 B                0 B
├ ƒ /api/events                                         0 B                0 B
├ ƒ /api/events/[id]                                    0 B                0 B
├ ƒ /api/events/[id]/tickets/purchase                   0 B                0 B
├ ƒ /api/finance/balance                                0 B                0 B
├ ƒ /api/halls                                          0 B                0 B
├ ƒ /api/halls/[id]                                     0 B                0 B
├ ƒ /api/halls/reserve                                  0 B                0 B
├ ƒ /api/notifications                                  0 B                0 B
├ ƒ /api/notifications/[id]/read                        0 B                0 B
├ ƒ /api/orders                                         0 B                0 B
├ ƒ /api/orders/create                                  0 B                0 B
├ ƒ /api/partner/activation                             0 B                0 B
├ ƒ /api/partner/dashboard                              0 B                0 B
├ ƒ /api/partner/documents/signed-url                   0 B                0 B
├ ƒ /api/partner/documents/upload                       0 B                0 B
├ ƒ /api/partner/events                                 0 B                0 B
├ ƒ /api/partner/events/[id]                            0 B                0 B
├ ƒ /api/partner/events/[id]/cancel                     0 B                0 B
├ ƒ /api/partner/events/[id]/cancellation               0 B                0 B
├ ƒ /api/partner/events/[id]/categories                 0 B                0 B
├ ƒ /api/partner/events/[id]/categories/[categoryId]    0 B                0 B
├ ƒ /api/partner/events/[id]/promotion                  0 B                0 B
├ ƒ /api/partner/events/[id]/regisseur-pin              0 B                0 B
├ ƒ /api/partner/events/[id]/shifts                     0 B                0 B
├ ƒ /api/partner/events/[id]/status                     0 B                0 B
├ ƒ /api/partner/events/[id]/tickets/[ticketId]/refund  0 B                0 B
├ ƒ /api/partner/finance                                0 B                0 B
├ ƒ /api/partner/halls                                  0 B                0 B
├ ƒ /api/partner/halls/[id]                             0 B                0 B
├ ƒ /api/partner/halls/reservations/[id]/status         0 B                0 B
├ ƒ /api/partner/metrics                                0 B                0 B
├ ƒ /api/partner/orders                                 0 B                0 B
├ ƒ /api/partner/orders/[id]                            0 B                0 B
├ ƒ /api/partner/products                               0 B                0 B
├ ƒ /api/partner/products/[id]                          0 B                0 B
├ ƒ /api/partner/products/[id]/status                   0 B                0 B
├ ƒ /api/partner/profile                                0 B                0 B
├ ƒ /api/partner/register                               0 B                0 B
├ ƒ /api/partner/reports/accounting                     0 B                0 B
├ ƒ /api/partner/reports/closing                        0 B                0 B
├ ƒ /api/partner/reports/closing/pdf                    0 B                0 B
├ ƒ /api/partner/stats                                  0 B                0 B
├ ƒ /api/partner/subscription                           0 B                0 B
├ ƒ /api/partner/tables                                 0 B                0 B
├ ƒ /api/partner/tables/[id]                            0 B                0 B
├ ƒ /api/partner/tables/reservations                    0 B                0 B
├ ƒ /api/partner/tables/reservations/[id]               0 B                0 B
├ ƒ /api/partner/team/[eventId]                         0 B                0 B
├ ƒ /api/partner/team/all                               0 B                0 B
├ ƒ /api/partner/team/assignments                       0 B                0 B
├ ƒ /api/partner/team/controller/[controllerId]         0 B                0 B
├ ƒ /api/partner/team/invite                            0 B                0 B
├ ƒ /api/partner/upload                                 0 B                0 B
├ ƒ /api/payments/[transactionId]/cancel                0 B                0 B
├ ƒ /api/payments/[transactionId]/status                0 B                0 B
├ ƒ /api/payments/create                                0 B                0 B
├ ƒ /api/referrals/my-stats                             0 B                0 B
├ ƒ /api/restaurants/[id]/menu                          0 B                0 B
├ ƒ /api/restaurants/[id]/tables                        0 B                0 B
├ ƒ /api/restaurants/reserve-table                      0 B                0 B
├ ƒ /api/tickets                                        0 B                0 B
├ ƒ /api/tickets/[id]/live-code                         0 B                0 B
├ ƒ /api/tickets/[id]/pdf                               0 B                0 B
├ ƒ /api/tickets/[id]/transfer                          0 B                0 B
├ ƒ /api/tickets/claim-free                             0 B                0 B
├ ƒ /api/tickets/claim/[token]                          0 B                0 B
├ ƒ /api/tickets/transfers/[id]/cancel                  0 B                0 B
├ ƒ /api/tickets/verify                                 0 B                0 B
├ ƒ /api/webhooks/samirpay                              0 B                0 B
├ ƒ /api/withdrawals/otp                                0 B                0 B
├ ƒ /api/withdrawals/request                            0 B                0 B
├ ○ /controller/profile                                 5.94 kB         110 kB
├ ○ /controller/scanner                                 14.8 kB         196 kB
├ ○ /controller/setup                                   4.59 kB         168 kB
├ ƒ /events/[id]                                        10.7 kB         201 kB
├ ○ /explore                                            3.94 kB         116 kB
├ ○ /forgot-password                                    8.87 kB         194 kB
├ ○ /halls                                              5.26 kB         114 kB
├ ƒ /halls/[id]                                         5.72 kB         196 kB
├ ○ /login                                              10.4 kB         196 kB
├ ○ /notifications                                      5.93 kB         178 kB
├ ○ /orders                                             6.04 kB         178 kB
├ ƒ /paiement/[id]                                      9.22 kB         238 kB
├ ○ /partner                                            177 B          87.8 kB
├ ○ /partner/calendar                                   4.53 kB         108 kB
├ ○ /partner/dashboard                                  13.6 kB         186 kB
├ ○ /partner/events                                     12.3 kB         121 kB
├ ƒ /partner/events/[id]/caisse                         6.97 kB         115 kB
├ ƒ /partner/events/[id]/edit                           6.66 kB         128 kB
├ ƒ /partner/events/[id]/team                           5.03 kB         182 kB
├ ○ /partner/events/new                                 9.57 kB         131 kB
├ ○ /partner/finance                                    9.89 kB         194 kB
├ ○ /partner/halls                                      9.51 kB         118 kB
├ ƒ /partner/halls/[id]/edit                            4.74 kB         126 kB
├ ○ /partner/halls/new                                  4.23 kB         126 kB
├ ○ /partner/orders                                     11.7 kB         184 kB
├ ○ /partner/products                                   8.78 kB         118 kB
├ ○ /partner/products/new                               3.89 kB         125 kB
├ ○ /partner/profile                                    4.34 kB        99.2 kB
├ ○ /partner/register                                   9.53 kB         126 kB
├ ○ /partner/scan                                       4.93 kB         113 kB
├ ○ /partner/stats                                      5.49 kB         100 kB
├ ○ /partner/subscription                               5.8 kB          109 kB
├ ○ /partner/tables                                     11.2 kB         119 kB
├ ○ /partner/team                                       9.35 kB         187 kB
├ ○ /profile                                            6.95 kB         179 kB
├ ○ /register                                           9.09 kB         194 kB
├ ○ /reset-password                                     7.65 kB         180 kB
├ ƒ /restaurants/[id]/menu                              4.86 kB         195 kB
├ ƒ /restaurants/[id]/tables                            5.21 kB         195 kB
├ ○ /scan                                               177 B          87.8 kB
├ ○ /tickets                                            9.77 kB         239 kB
├ ƒ /tickets/claim/[token]                              4.58 kB         227 kB
└ ○ /wallet                                             11.3 kB         196 kB
+ First Load JS shared by all                           87.6 kB
  ├ chunks/2117-488d789e9004e22c.js                     31.9 kB
  ├ chunks/fd9d1056-270721ac51469ce4.js                 53.6 kB
  └ other shared chunks (total)                         2.1 kB


ƒ Middleware                                            87.6 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand


[verify] OK — 4 étapes réussies en 127s.
```

| Run | Commit | Résultat | Rôle |
|---|---|---|---|
| [30 · 41233050316](https://github.com/fallouu-mn/event-village/actions/runs/41233050316) | c8476e6 | succès | rapport du lot 2, point de départ du lot 3 : 62 suites vertes sur 62 |
| [31 · 41240412478](https://github.com/fallouu-mn/event-village/actions/runs/41240412478) | 1d8e567 | échec attendu | **référence « avant »** : tests du lot dans leur version finale, sans aucun correctif. 15 suites en échec sur 77, exactement les 15 nouvelles suites. Les 62 autres sont vertes |
| [32 · 41242223807](https://github.com/fallouu-mn/event-village/actions/runs/41242223807) | 68bd6a0 | succès | **référence « après »** : correctifs 3.0 à 3.8 et suite legacy, migrations `20261101000001` à `…08` appliquées sans erreur. 77 suites vertes sur 77 au premier passage |

---

## 7. Points ouverts

1. **Frais de service sur les commandes, salles et tables.** Les mêmes frais acheteur que la billetterie s'y appliquent, calculés sur le total débité (livraison comprise pour une commande). Le CDC décrit les frais de service pour la billetterie ; pour ces cibles, la décision est à confirmer avec le client. Si elle diffère, il faudra un réglage par cible (changement mineur du moteur).
2. **Identité lue dans le corps de la requête** (découverte 3.0). `/api/orders/create`, `/api/halls/reserve` et `/api/restaurants/reserve-table` créent la cible au nom du `clientId` reçu, sans session. Le paiement, lui, exige une session. C'est une faille de sécurité **non corrigée ici** (hors du parcours minimal de 3.0), à traiter en priorité au lot suivant.
3. **Autres défauts relevés sur ces cibles, non corrigés** :
   - la salle facture le solde au lieu de l'acompte ;
   - une table réservée hors plateforme passe SUCCESS sans encaissement ;
   - l'activation d'un abonnement lève une suspension du partenaire ;
   - un succès tardif sur une cible annulée n'est que journalisé ;
   - aucune idempotence côté serveur pour ces paiements ;
   - les pages salles, tables et commandes calculent leur montant dans le navigateur (aucun devis pour ces cibles) ;
   - `createOrder` décrémente le stock avant le calcul des frais (comportement antérieur).
4. **Retraits par virement** : quand le réglage les autorise, le retrait est créé PENDING et le solde réservé, mais aucun canal ni écran d'administration ne le traite encore.
5. **Vérification manuelle des envois incertains** : un remboursement ou un retrait INCERTAIN déclenche une alerte, mais aucun écran admin ne permet de le clore (CONFIRME ou ECHOUE) après vérification chez SamirPay. Il faut passer par la base.
6. **Grand livre** :
   - il démarre vide, sans reprise des paiements, commissions ou retraits antérieurs (projet neuf, voir le lot 1B) ;
   - le service_role peut modifier une écriture, aucun trigger ne l'en empêche (les tests s'en servent pour simuler l'écoulement des délais) ;
   - la date de disponibilité est fixée à la vente : un événement reporté ensuite ne la déplace pas.
7. **`FinancialCalculatorService`** : il n'est plus appelé. Il reste, marqué `@deprecated` et sans défauts codés, pour des imports morts (`event.service.ts`, `hall.service.ts`) et deux suites legacy. Même chose pour `RequestWithdrawalSchema` (`lib/validations/payment.ts`, seuil 5 000 en dur), qui n'est plus utilisé par la route mais toujours testé par `tests/payment.test.ts` (cas 6, arithmétique en mémoire). Tous deux sont à supprimer avec leurs tests.
8. **Choix faits là où le CDC est muet, à valider** :
   - arrondi des frais billet par billet ;
   - part remboursée d'un billet = prix + frais de service du billet ;
   - réglage du porteur des frais d'agrégateur appliqué à tous les remboursements décidés par l'organisateur (unitaires et annulation) ;
   - formule du prorata des commissions ;
   - taux N2 lu sur la relation N1 (choix existant). L'Annexe C du CDC donne 3 % en N2 ambassadeur, l'Annexe A 2 % : l'Annexe A est appliquée ;
   - place libérée dès la demande de remboursement ;
   - billet espèces annulé ;
   - destination d'un retrait = numéro déclaré, l'OTP partant au téléphone du compte.
9. **Statut ambassadeur** modifiable par un ADMIN qui a la permission `users.write`, et non par le seul SUPERADMIN, alors qu'il fixe les taux de commission.
10. **Interface** :
    - le parcours de retrait est dupliqué entre les pages partenaire et portefeuille (à extraire dans un composant) ;
    - le seuil et le taux de frais de retrait ne sont pas exposés avant la demande ;
    - rien n'a été vérifié en navigateur (tests statiques seulement).
11. **Suites legacy du lot 2** : des assertions sont toujours fausses (`REFUND-PMT-<id>` dans `event-cancellation-and-refunds`, `+221` dans `chunk5-phase2-b2c`), et `checkout-mixed-cart` reste obsolète.
12. **Contrats d'API** : le rapport de clôture et la finance partenaire changent de forme (section « À lire en premier », point 7). Les seuls lecteurs du dépôt (modale de clôture, PDF, pages) sont adaptés. Un client externe éventuel devra suivre.

Le lot 4 n'a pas été commencé.
