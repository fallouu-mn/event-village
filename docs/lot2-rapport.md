# LOT 2 — RAPPORT

**Objet :** chaîne paiement → billet atomique (constats R7 à R14, payment-security-1 à 17, ticketing-finance-9, -10, -16, client-ux-2, -7 ; filtres D1 et D2 du lot 1C), avec les compléments « contrat SamirPay » et « moyens de paiement et retraits ».
**Branche :** `fix/evenementiel`. Aucun push sur `main`. Rien n'a été exécuté contre le projet Supabase distant, ni contre SamirPay : tous les scénarios de paiement passent par le faux SamirPay, aligné sur le contrat. Migrations du dépôt uniquement, appliquées et testées en CI.
**Date :** 31 octobre 2026.

**Résultat :** **vert.** Run 29 (`41232067280`, commit `cefb73a`) : 62 suites sur 62, typecheck, lint et build compris. Au run 27 (référence « avant »), les 13 nouvelles suites du lot étaient en échec, et elles seules. L'invariant global (a)(b)(c) donne 0 violation à la fin de chacune des 11 suites de paiement, avant comme après la purge. Après le run 28, deux tests ont été corrigés (signalés en section 1).

---

## À lire en premier

1. **Le client SamirPay réel ne respectait pas le contrat officiel.** Avant ce lot :
   - le statut était demandé sur une URL inventée (`/api/tiers/direct/status?order_id=`) ;
   - le cashin envoyait `order_id` au lieu de `orderId`, jamais `callBackUrl`, un téléphone au format +221 et des montants en nombre ;
   - l'identifiant de transaction (`data.transactionId`) et le solde (`data.solde`) n'étaient jamais lus.

   Le faux SamirPay reproduisait ce format interne et masquait les écarts. Les deux sont désormais alignés sur la documentation, et le client réel est testé contre un serveur local qui imite le contrat (`tests/samirpay-contrat.test.ts`).
2. **Le contrat SamirPay ne prévoit aucune signature de webhook** (section 3). Rien n'est inventé. Un paiement n'est confirmé que si quatre conditions sont réunies :
   - un jeton propre au paiement figure dans le `callBackUrl` ;
   - le `transaction_id` reçu correspond à celui enregistré ;
   - le statut renvoyé par SamirPay pour l'identifiant enregistré est SUCCESS ;
   - la RPC de confirmation, transactionnelle et idempotente, l'accepte.

   Le montant n'est pas vérifiable par l'API : il est garanti par l'initialisation, faite par notre serveur à partir du panier réservé.
3. **Contrats d'API modifiés**, à connaître pour le front et pour toute intégration :
   - `POST /api/checkout` exige l'en-tête `Idempotency-Key` et, dès qu'il y a un montant à payer, `operator` (`WAVE` ou `ORANGE_MONEY`) et `payerPhone` (9 chiffres). Les URL de retour fournies par le client sont ignorées. La réponse donne `payment_id`, `expires_at`, `deep_link` et `status_page_url` (`/paiement/<id>`).
   - `/api/payments/create` exige `operator` et `payerPhone` ; un billet y passe par le checkout. L'option « carte bancaire » est retirée des schémas et de l'interface.
   - `/api/payments/<id>/status` prend l'UUID du paiement, exige une session et est réservée au propriétaire (404 pour tout autre compte). `/api/payments/<id>/cancel` est créée.
   - `/api/tickets/claim-free` répond 200, 409 à la limite. `/api/events/[id]/tickets/purchase` répond **410**.
4. **Obligations d'exploitation nouvelles** (`docs/deploiement-projet-neuf.md`, sections 6 et 7) :
   - `CRON_SECRET`, plus la réconciliation `/api/cron/payments-reconcile` planifiée **toutes les 5 minutes**. Sans elle, les paiements FAILED ou CANCELLED ne sont jamais connus et les webhooks perdus ne sont jamais rattrapés.
   - `NEXT_PUBLIC_APP_URL` doit être l'URL publique HTTPS définitive : elle sert à construire le `callBackUrl`.
   - Retirer les variables SamirPay devenues inutiles (`SAMIRPAY_*_URL`, `SAMIRPAY_WEBHOOK_SECRET`).
5. **Tâche 2.0** : le script n'a pas été exécuté. Commande à lancer dans un terminal : `npx tsx scripts/reset-test-password.ts --email superadmin@eventvillage.sn`. Il demande la référence du projet de `.env.local`, puis le nouveau mot de passe deux fois, sans affichage.
6. **Document SamirPay confidentiel** : il a été trouvé dans `Downloads` (pas dans `docs/private/`) et copié dans `docs/private/`, qui est ajouté au `.gitignore` (commit `fe2390d`). Il n'est ni suivi ni recopié dans le dépôt : vérifié, aucune occurrence de son contenu dans Git. Le code ne reprend que les éléments de contrat nécessaires (chemins, champs, statuts).

---

## 1. Commits

| Commit | Message |
|---|---|
| fe2390d | chore(lot2): docs/private/ (contrats fournisseurs confidentiels) et .logs/ (journaux des scripts d'exploitation) ignorés |
| 8d22276 | test(infra)[2]: outils des suites de paiement et invariant global (a) SUCCESS ⇒ billets, (b) billet payant ⇒ SUCCESS, (c) sold + held ≤ total et held = réservations |
| 4224ff7 | test(securite)[2.0]: script de mot de passe du superadmin de test : seul --email en argument, projet de .env.local uniquement, saisie masquée au clavier, journal sans mot de passe |
| 3ccc92c | test(paiement)[2.1]: webhook authentifié (jeton, corrélation transaction_id, statut SamirPay par l'identifiant enregistré, journal unique, order_id validé, journaux sans numéro) ; client SamirPay conforme au contrat (cashin direct, statut, solde, cashout) |
| 6cdc1cb | test(paiement)[2.2]: confirmation atomique (webhooks simultanés + sondage → billets une fois, held sans double décrément, RPC idempotente, panier non honorable → zéro billet et remboursement, montants lus) |
| d833207 | test(paiement)[2.3]: route de statut authentifiée, réservée au propriétaire, identifiant UUID, réconciliation par la RPC (sondage avant webhook → billets une fois) |
| 84a488e | test(paiement)[2.4]: réservation SQL tout ou rien (dernière place disputée, panier partiel), libération sur refus et exception SamirPay, annulation client, expiration par cron protégé, plus de suppression de paiement |
| 891765e | test(paiement)[2.5]: contrôles avant débit (max_per_order, fenêtre de vente, visibilité, événement passé ou non publié, opérateur et téléphone payeur), Idempotency-Key, quota de checkout par compte, /api/payments/create aligné |
| 50b369f | test(paiement)[2.6]: gratuits d'un panier mixte émis à la confirmation seulement ; claim-free limité par compte et par catégorie sous concurrence |
| 73925cf | test(paiement)[2.7]: remboursement par le module de cashout (opérateur et numéro payeur, jamais de repli, clé REFUND-<paiement>, envoi unique sous concurrence, INCERTAIN sans renvoi, solde vérifié, annulation d'événement sans CASH ni invitations) |
| c199bd8 | test(paiement)[2.8]: /api/events/[id]/tickets/purchase désactivée (410) pour tous les rôles, aucun billet émis |
| 7543eeb | test(paiement)[2.9]: réconciliation par cron protégé (SUCCESS → RPC, FAILED et CANCELLED → stock rendu, PENDING trop ancien → EXPIRED, fenêtre d'attente) |
| 41a45b7 | test(paiement)[2.10]: retour client par /paiement/[id] (sondage, trois états, annulation, délai aligné sur l'échéance), URL du client ignorées |
| 8b9a361 | test(paiement)[2.complément]: Wave et Orange Money obligatoires, opérateur et téléphone payeur en base, dans l'appel SamirPay et à l'interface ; plus d'option carte |
| 88436f5 | feat(securite)[2.0]: scripts/reset-test-password.ts — mot de passe du superadmin du projet de test, saisi au clavier (masqué, deux fois), projet de .env.local uniquement (référence à retaper), sessions révoquées, journal .logs/ sans mot de passe ; non exécuté |
| 0c826b6 | fix(paiement)[2.complément]: client et faux SamirPay alignés sur le contrat officiel (cashin direct, statut par identifiant, solde data.solde, cashout 9 chiffres, erreurs typées REJECTED/DUPLICATE/NOT_FOUND/UNCERTAIN) ; Wave ou Orange Money obligatoire, carte retirée des schémas ; retrait adapté au strict minimum (branché au lot 3) |
| cd92561 | fix(paiement)[2.4]: réservation du stock en SQL (stock_reservations, held_quantity par trigger, tout ou rien), libération sur tout échec (payment_release), purge par cron protégé par CRON_SECRET, annulation par le client ; ancienne réservation applicative supprimée (try/catch vide, replis « colonne absente », suppression du paiement) |
| 078bc68 | fix(paiement)[2.5]: contrôles partagés avant tout débit (ticket_sale_problems : actif, visible, PUBLIE et non passé, fenêtre de vente, max_per_order, stock moins réservations), Idempotency-Key obligatoire, quota de checkout par compte, opérateur et téléphone payeur persistés ; aucun paiement ni appel SamirPay si un contrôle échoue |
| 0a8d6d1 | fix(paiement)[2.2]: confirmation atomique (payment_confirm : transition conditionnelle, conversion des réservations, billets de tout le panier, montants lus, tout ou rien, idempotente) ; panier non honorable → aucun billet et remboursement ; fixtures payantes rattachées à un paiement SUCCESS |
| 403d503 | fix(paiement)[2.1]: webhook SamirPay enregistré avant traitement (payment_webhook_events), jeton du callBackUrl à temps constant, corrélation transaction_id, statut SamirPay par l'identifiant enregistré, order_id validé et .eq() (D2) ; aucun numéro dans les journaux |
| 97d2ecf | fix(paiement)[2.3]: route de statut authentifiée, réservée au propriétaire, identifiant UUID (D1), réconciliation par la RPC commune, jamais d'écriture de statut par la route |
| 829c18b | fix(paiement)[2.6]: billets gratuits par free_tickets_claim (contrôles partagés, limite par compte et par catégorie, quota de demandes) ; gratuits d'un panier mixte émis à la confirmation par payment_confirm |
| 80d3f6b | fix(paiement)[2.7]: module commun de cashout (A_ENVOYER → ENVOYE → CONFIRME | ECHOUE | INCERTAIN, clé REFUND-<paiement>, envoi réservé sous concurrence, INCERTAIN jamais renvoyé, solde vérifié, alertes) ; remboursements et annulation d'événement par ce module, sans opérateur par défaut ni numéro de repli, CASH et invitations exclus |
| cdd39cd | fix(paiement)[2.8]: /api/events/[id]/tickets/purchase désactivée (410) : aucun appelant dans l'interface ; guichet revu au lot 4 |
| 6eba7fe | feat(paiement)[2.9]: réconciliation périodique (cron protégé, fenêtre d'attente, statut SamirPay → RPC, échec et annulation, expiration, succès tardifs, confirmation des remboursements) ; planification documentée (Vercel Pro, pg_cron, planificateur externe) |
| 76432ea | feat(paiement)[2.10]: Wave ou Orange Money obligatoire, téléphone payeur, Idempotency-Key, libellés selon l'opérateur, plus d'option carte ; page de suivi /paiement/[id] (sondage, En attente / Confirmé / Échoué, annulation, délai aligné sur l'échéance) ; panier mixte envoyé en entier |
| 39a0a8b | test(legacy)[2]: suites legacy alignées sur le lot 2 (hold-cart-stock, ticket-stock-lifecycle, late-webhook-and-treasury-preflight supprimées ; cas reposant sur les API retirées remplacés par un commentaire citant la suite de remplacement ; mock SamirPay aligné) |
| 83f184b | fix(paiement)[2.3]: commentaire de la route de statut reformulé (il citait « .or() », relevé par le contrôle statique du run 28) |
| cefb73a | test(paiement)[2]: corrections de deux tests après le run 28 (signalées au rapport) |

Ce rapport est ajouté par le commit qui suit le dernier de cette liste.

**Découpage.** Un commit de tests rouges par tâche, puis un commit de correctifs par tâche, découpé au niveau du fichier. Les migrations sont découpées par tâche (`20261031000012` à `…18`). Certains fichiers servent plusieurs tâches et sont committés avec celle qui les introduit :
- `lib/payments/checkout.service.ts` (2.5) porte aussi l'appel de la réservation (2.4) et le chemin gratuit (2.6) ;
- `lib/payments/confirmation.service.ts` (2.2) porte aussi la réconciliation appelée par 2.3 et 2.9 ;
- `lib/env.ts` et les `.env*.example` partent avec le contrat (complément).

Conséquence : les commits intermédiaires ne compilent pas isolément (ils référencent des modules introduits plus loin). Seule la tête est vérifiée, par la CI.

### Tests modifiés (signalement)

- **`tests/fondations-lot0.test.ts`** : les deux cas sur le faux SamirPay (initialisation, refus dans le corps, webhook signé « provisoire ») sont réécrits selon le contrat : cashin direct, doublon 409, refus, délai, statut par identifiant, 404, webhook form-urlencoded vers le `callBackUrl`, uniquement en cas de succès. L'ancien contrat n'existe plus.
- **`tests/payment.test.ts`** :
  - le cas 1 (table de correspondance permissive `mapSamirPayStatus`, supprimée) devient un contrôle des opérateurs du contrat ;
  - le cas 2 utilise un payload conforme (UUID, `ORD-EV-…`, `success`) ;
  - le cas 4 exige `operator` et `payerPhone` et vérifie le refus de la carte et de l'opérateur absent.
- **`tests/e2e-scenarios.test.ts`** : les payloads de `CreatePaymentSchema` portent `operator` et `payerPhone`, et l'import de `mapSamirPayStatus` est retiré.
- **`tests/parcours/achat-serveur.test.ts` et `email-optionnel.test.ts`** : nouveau contrat de checkout (`Idempotency-Key`, `payerPhone`) et webhook adressé au `callBackUrl` (jeton, sans signature). Les assertions métier (paiement SUCCESS, billet VALIDE, SMS envoyé, aucun email) sont inchangées.
- **`tests/parcours/filtres-postgrest.test.ts`** : l'exemption « lot 2 » (D1, D2) est retirée, ce qui rend le test plus strict. La liste `LOT2_ALLOWED` est désormais vide, mais le titre du cas dit encore « hors paiement (lot 2) » : il n’a pas été renommé, pour ne pas toucher davantage au test.
- **`tests/parcours/statut-compte.test.ts`** : le billet payant dédié au cas « vérification » reçoit son paiement SUCCESS et sa réservation convertie (invariant global), sans changement d'assertion.
- **`tests/security/r3-fonctions-rpc.test.ts`** : les 8 nouvelles RPC sont ajoutées à la liste refusée à anon et à un client connecté (plus strict).
- **`tests/seed/seed-test.ts`** :
  - les billets payants de référence reçoivent un paiement SUCCESS et une réservation CONVERTED ;
  - `held_quantity` est recalculé à partir des réservations actives, au lieu d'être forcé à 0.
- **Après le run 28** (commit `cefb73a`) :
  - `tests/parcours/paiement-helpers.ts` : le repli « nouvel appel d'initialisation » ne vaut que pour une réponse 200. Sous concurrence, l'acheteur refusé se voyait attribuer le paiement du gagnant.
  - `tests/parcours/paiement-remboursement.test.ts` : le scénario « panier non honorable » omettait le succès SamirPay du premier paiement.

  Assertions inchangées dans les deux cas.
- **Rouges « structurels » au run 27** : `paiement-remboursement` (module de cashout absent), `paiement-reconciliation` (route absente) et les contrôles statiques de `paiement-retour` (page absente) échouaient faute du code à tester, pas sur une assertion métier. Leurs défauts sont prouvés par les autres suites (webhook, confirmation, contrôles) et par les greps.

---

## 2. Tâches : grep, test rouge, correctif, test vert

Avant correctif : run CI 27 (`41228246303`, commit `8b9a361`), tests dans leur version finale (sauf les deux corrections après le run 28, signalées en section 1), aucun correctif appliqué. Après : run 29 (`41232067280`, commit `cefb73a`). Greps exécutés sur l'arbre du commit `8b9a361`. Journaux bruts sur la branche `ci-results` (`runs/27-41228246303/`, `runs/29-41232067280/`).

Dans les blocs « avant », les lignes `→` placées sous un `not ok` de niveau suite sont les erreurs de niveau suite. « Cannot find module » signale un module à tester qui n'existe pas encore. `relation "public.stock_reservations" does not exist` vient du contrôle d'invariant, exécuté en `after()` : la table de réservation n'existe pas encore au run 27.

### 2.0 — Mot de passe du superadmin du projet de test

```text
$ git grep -n -E 'env\.local|password' 8b9a361 -- scripts
8b9a361:scripts/verify.mjs:8: * même si un `.env.local` pointant sur le projet distant existe sur la machine.
8b9a361:scripts/verify.mjs:50: *  - clés de .env.local neutralisées : `next build` charge .env.local s'il existe, mais ne
8b9a361:scripts/verify.mjs:59:    const localPath = path.resolve(ROOT, '.env.local');
8b9a361:scripts/verify.mjs:72:        console.log(`[verify] build : ${neutralized.length} clé(s) de .env.local neutralisée(s) : ${neutralized.join(', ')}`);
(code de sortie 0)
```

**Correctif.** Logique pure dans `scripts/reset-test-password.core.ts` (testée sans réseau), lanceur interactif dans `scripts/reset-test-password.ts`, non exécuté.
- **Arguments** : seule l'option `--email` est acceptée ; toute autre, y compris un mot de passe, est refusée.
- **Saisie** : terminal interactif obligatoire, mot de passe saisi deux fois sans affichage (mode brut), politique de 14 caractères avec 4 classes.
- **Projet ciblé** : celui de `.env.local` uniquement. Il est refusé si une variable du shell désigne un autre projet, si l'URL n'est pas un projet hébergé `*.supabase.co`, ou si la référence retapée ne correspond pas.
- **Sessions** : toutes révoquées après le changement (signOut global avec un jeton du nouveau mot de passe).
- **Journal** : une ligne JSON par exécution dans `.logs/reset-test-password.log` (ignoré par Git), sans mot de passe et email masqué.

**schema/reset-test-password**

Run 27 (avant correctif) :

```text
    not ok 1 - arguments : seul --email est accepté, jamais de mot de passe
        → test did not finish before its parent and was cancelled
    not ok 2 - projet : uniquement celui de .env.local
        → test did not finish before its parent and was cancelled
    not ok 3 - politique de mot de passe
        → test did not finish before its parent and was cancelled
    not ok 4 - journal : aucune trace du mot de passe
        → test did not finish before its parent and was cancelled
    not ok 5 - lanceur : saisie au clavier obligatoire, mot de passe jamais lu depuis argv, un fichier ou l’environnement
        → test did not finish before its parent and was cancelled
not ok 1 - scripts/reset-test-password
        → Cannot find module '/home/runner/work/event-village/event-village/scripts/reset-test-password.core' imported from /home/runner/work/event-village/event-village/tests/schema/reset-test-password.test.ts
# pass 0
# fail 0
```

Run 29 (après correctif) :

```text
    ok 1 - arguments : seul --email est accepté, jamais de mot de passe
    ok 2 - projet : uniquement celui de .env.local
    ok 3 - politique de mot de passe
    ok 4 - journal : aucune trace du mot de passe
    ok 5 - lanceur : saisie au clavier obligatoire, mot de passe jamais lu depuis argv, un fichier ou l’environnement
ok 1 - scripts/reset-test-password
# pass 5
# fail 0
```

### Complément — contrat SamirPay et moyens de paiement

**Correctif.**
- **Passerelle** (`lib/integrations/types.ts`) : `initDirectPayment`, `checkTransactionStatus(transactionId)`, `getSolde`, `sendCashout`.
- **Client réel** (`lib/samirpay/http-client.ts`) :
  - chemins fixés par le contrat ;
  - montants en chaîne, téléphone à 9 chiffres ;
  - réponses lues dans `data` ; statut corrélé à l'identifiant demandé ;
  - délai réglable (`SAMIRPAY_TIMEOUT_MS`) ;
  - erreurs typées : `REJECTED` (400, 409 métier), `DUPLICATE` (409 sur orderId), `NOT_FOUND`, `UNAUTHORIZED`, `INVALID_RESPONSE`, `UNCERTAIN` (délai, coupure, 5xx, réponse illisible).
- **Faux** (`tests/fakes/fake-samirpay.ts`) :
  - identifiants UUID, 409 sur orderId en double, statut sans montant, 404 pour une transaction inconnue ;
  - webhook form-urlencoded adressé au `callBackUrl`, refusé si la transaction n'est pas SUCCESS ;
  - cashout : délai dépassé avant envoi, délai dépassé après envoi (l'argent est parti), réponse « en attente ».
- **Interface et schémas** : Wave ou Orange Money obligatoire, carte retirée.
- **Retrait** (`withdrawal.service.ts`) : adapté au strict minimum (numéro à 9 chiffres, identifiant lu dans `data`) ; il ne sera branché sur le module de cashout qu'au lot 3.

**samirpay-contrat**

Run 27 (avant correctif) :

```text
    not ok 1 - cashin direct : chemin, en-têtes et corps exacts ; réponse 201 lue (transactionId, url, qrCode, urls)
        → client(...).initDirectPayment is not a function
    not ok 2 - cashin direct : orderId en double → erreur DUPLICATE (409)
        → client(...).initDirectPayment is not a function
    not ok 3 - statut : GET /api/tiers/payments/{transactionId}/status, réponse corrélée ; 404 → NOT_FOUND
        → Erreur vérification statut SamirPay : Impossible de vérifier le statut SamirPay : HTTP 404
    not ok 4 - solde : lu dans data.solde
        → Expected values to be strictly equal:
        → + undefined
        → - 250000
    not ok 5 - cashout : corps exact (9 chiffres, montant en chaîne, prénom et nom), identifiant lu dans data
        → Expected values to be strictly deep-equal:
        → +   amount: 15000,
        → -   amount: '15000',
        → firstName: 'Awa',
    not ok 6 - cashout : refus explicite → REJECTED ; délai dépassé ou 502 → UNCERTAIN
        → refus 409 : nature de l'erreur (Échec du Cashout SamirPay : Solde insuffisant)
        → + undefined
        → - 'REJECTED'
not ok 1 - Client SamirPay réel — conformité au contrat
# pass 0
# fail 6
```

Run 29 (après correctif) :

```text
    ok 1 - cashin direct : chemin, en-têtes et corps exacts ; réponse 201 lue (transactionId, url, qrCode, urls)
    ok 2 - cashin direct : orderId en double → erreur DUPLICATE (409)
    ok 3 - statut : GET /api/tiers/payments/{transactionId}/status, réponse corrélée ; 404 → NOT_FOUND
    ok 4 - solde : lu dans data.solde
    ok 5 - cashout : corps exact (9 chiffres, montant en chaîne, prénom et nom), identifiant lu dans data
    ok 6 - cashout : refus explicite → REJECTED ; délai dépassé ou 502 → UNCERTAIN
ok 1 - Client SamirPay réel — conformité au contrat
# pass 6
# fail 0
```

**fondations-lot0**

Run 27 (code non corrigé, ancienne version du test : suite adaptée dans le commit de correctif, pas un test rouge) :

```text
    ok 1 - le garde-fou impose une instance Supabase locale
    ok 2 - les variables Supabase sont gelées pendant les tests
    ok 3 - toute requête réseau vers un hôte externe est bloquée
    ok 4 - SMS : la façade mTargetService passe par le faux adaptateur
    ok 5 - Email : EmailService.send passe par le faux adaptateur
    ok 6 - SamirPay : init réussi, refus dans le corps, exception, statut piloté
    ok 7 - SamirPay : webhooks générés signés ou non signés
    ok 8 - lib/env : échec explicite si une variable requise manque
    ok 9 - seed de test : fixtures résolues depuis la base locale
ok 1 - LOT 0 — fondations de vérification
# pass 9
# fail 0
```

Run 29 (après correctif) :

```text
    ok 1 - le garde-fou impose une instance Supabase locale
    ok 2 - les variables Supabase sont gelées pendant les tests
    ok 3 - toute requête réseau vers un hôte externe est bloquée
    ok 4 - SMS : la façade mTargetService passe par le faux adaptateur
    ok 5 - Email : EmailService.send passe par le faux adaptateur
    ok 6 - SamirPay : cashin direct réussi, refus, délai dépassé, doublon d’orderId, statut piloté
    ok 7 - SamirPay : webhook form-urlencoded vers le callBackUrl reçu, uniquement en cas de succès
    ok 8 - lib/env : échec explicite si une variable requise manque
    ok 9 - seed de test : fixtures résolues depuis la base locale
ok 1 - LOT 0 — fondations de vérification
# pass 9
# fail 0
```

**payment**

Run 27 (code non corrigé, ancienne version du test : suite adaptée dans le commit de correctif, pas un test rouge) :

```text
ok 1 - 1. Mapping des statuts SamirPay
ok 2 - 2. Validation du payload Webhook SamirPay
ok 3 - 3. Masquage strict des secrets dans les erreurs
ok 4 - 4. Validation de la création de paiement PWA (Pas de montant envoyé)
ok 5 - 5. Calcul du Revenu Net Event Village et des Commissions de Parrainage (CDC V3)
ok 6 - 6. Validation du schéma et des calculs de Cashout SamirPay (Seuil min 5000, 1% de frais)
# pass 6
# fail 0
```

Run 29 (après correctif) :

```text
ok 1 - 1. Opérateurs du contrat SamirPay : Wave et Orange Money uniquement
ok 2 - 2. Validation du payload Webhook SamirPay
ok 3 - 3. Masquage strict des secrets dans les erreurs
ok 4 - 4. Validation de la création de paiement PWA (Pas de montant envoyé)
ok 5 - 5. Calcul du Revenu Net Event Village et des Commissions de Parrainage (CDC V3)
ok 6 - 6. Validation du schéma et des calculs de Cashout SamirPay (Seuil min 5000, 1% de frais)
# pass 6
# fail 0
```

**e2e-scenarios**

Run 27 (code non corrigé, ancienne version du test : suite adaptée dans le commit de correctif, pas un test rouge) :

```text
ok 1 - SCENARIO 1 : Parcours client complet & Structure des Pages Redesign
ok 2 - SCENARIO 2 & 3 : Création de commande & Validation des Schémas de Paiement
ok 3 - SCENARIO 4 & 5 : Initialisation SamirPay & Sandbox Contract
ok 4 - SCENARIO 6 & 7 : Réception Webhook & Validation Route Handler
ok 5 - SCENARIO 8 & 9 : Génération Ticket & QR Code Unique
ok 6 - SCENARIO 10 & 11 : Portefeuille Billetterie & TicketCard Perforé
ok 7 - SCENARIO 12, 13 & 14 : Scanner Partenaire & Contrôle d’accès
ok 8 - SCENARIO 15 : Dashboard Partenaire, Realtime & Calendrier
ok 9 - SCENARIO 16 : Parrainage N1 / N2 sur Revenu Net Éligible (CDC V3)
ok 10 - SCENARIO 17 : Idempotence Webhook Répété
ok 11 - SCENARIO 18, 19 & 20 : Responsive, PWA Manifest & Service Worker
# pass 11
# fail 0
```

Run 29 (après correctif) :

```text
ok 1 - SCENARIO 1 : Parcours client complet & Structure des Pages Redesign
ok 2 - SCENARIO 2 & 3 : Création de commande & Validation des Schémas de Paiement
ok 3 - SCENARIO 4 & 5 : Initialisation SamirPay & Sandbox Contract
ok 4 - SCENARIO 6 & 7 : Réception Webhook & Validation Route Handler
ok 5 - SCENARIO 8 & 9 : Génération Ticket & QR Code Unique
ok 6 - SCENARIO 10 & 11 : Portefeuille Billetterie & TicketCard Perforé
ok 7 - SCENARIO 12, 13 & 14 : Scanner Partenaire & Contrôle d’accès
ok 8 - SCENARIO 15 : Dashboard Partenaire, Realtime & Calendrier
ok 9 - SCENARIO 16 : Parrainage N1 / N2 sur Revenu Net Éligible (CDC V3)
ok 10 - SCENARIO 17 : Idempotence Webhook Répété
ok 11 - SCENARIO 18, 19 & 20 : Responsive, PWA Manifest & Service Worker
# pass 11
# fail 0
```

**parcours/paiement-operateur**

Run 27 (avant correctif) :

```text
    not ok 1 - WAVE : opérateur et téléphone payeur corrects en base, dans l’appel SamirPay et pour l’interface
        → opérateur en base
        → + undefined
        → - 'WAVE'
    not ok 2 - ORANGE_MONEY : opérateur et téléphone payeur corrects en base, dans l’appel SamirPay et pour l’interface
        → opérateur en base
        → + undefined
        → - 'ORANGE_MONEY'
    not ok 3 - interface : choix Wave / Orange Money obligatoire, aucune option carte, libellés selon l’opérateur
        → aucune option carte bancaire
not ok 1 - Opérateur de paiement
not ok 2 - /home/runner/work/event-village/event-village/tests/parcours/paiement-operateur.test.ts
        → relation "public.stock_reservations" does not exist
# pass 0
# fail 3
```

Run 29 (après correctif) :

```text
    ok 1 - WAVE : opérateur et téléphone payeur corrects en base, dans l’appel SamirPay et pour l’interface
    ok 2 - ORANGE_MONEY : opérateur et téléphone payeur corrects en base, dans l’appel SamirPay et pour l’interface
    ok 3 - interface : choix Wave / Orange Money obligatoire, aucune option carte, libellés selon l’opérateur
ok 1 - Opérateur de paiement
# pass 3
# fail 0
```

### 2.1 — Webhook SamirPay authentifié (R7, R8)

```text
$ git grep -n -E 'signature|SAMIRPAY_WEBHOOK_SECRET' 8b9a361 -- app/api/webhooks lib/payments lib/validations/payment.ts
8b9a361:lib/validations/payment.ts:53:    signature: z.string().optional(),
(code de sortie 0)

$ git grep -n -E '\.or\(`' 8b9a361 -- lib/payments app/api/payments
8b9a361:app/api/payments/[transactionId]/status/route.ts:27:            .or(`transaction_id.eq.${transactionId},external_order_id.eq.${transactionId}`)
8b9a361:lib/payments/payment.service.ts:500:            .or(`external_order_id.eq.${order_id},transaction_id.eq.${order_id}`)
(code de sortie 0)

$ git grep -n -E 'checkTransactionStatus\(' 8b9a361 -- app lib
8b9a361:app/api/payments/[transactionId]/status/route.ts:40:                const checkRes = await samirPayClient.checkTransactionStatus(payment.external_order_id);
8b9a361:lib/integrations/types.ts:53:    checkTransactionStatus(orderId: string): Promise<SamirPayCheckStatusResponse>;
8b9a361:lib/samirpay/client.ts:15:    checkTransactionStatus: (orderId) => getPaymentGateway().checkTransactionStatus(orderId),
8b9a361:lib/samirpay/http-client.ts:199:    public async checkTransactionStatus(orderId: string): Promise<SamirPayCheckStatusResponse> {
(code de sortie 0)
```

**Correctif** (`lib/payments/webhook.service.ts`, migration `20261031000016`).
1. **Enregistrement avant tout traitement** dans `payment_webhook_events` : corps brut, en-têtes utiles, présence du jeton. Une contrainte d'unicité porte sur l'empreinte du contenu reçu et du jeton présenté, et un rejeu incrémente `receive_count`.
2. **Format** : `order_id` validé par regex, `transaction_id` par format UUID, recherche par `.eq('external_order_id', …)` (D2 corrigé).
3. **Jeton** : empreinte SHA-256 du jeton du `callBackUrl`, comparée à temps constant à celle du paiement.
4. **Corrélation** : le `transaction_id` reçu doit être l'identifiant SamirPay enregistré à l'initialisation.
5. **Confirmation** : statut demandé à SamirPay avec l'identifiant enregistré ; seul SUCCESS déclenche la RPC (2.2).

Réponse : 200 dès que l'événement est enregistré, l'erreur interne éventuelle étant enregistrée puis rattrapée par la réconciliation ; 500 seulement si l'événement n'a pas pu être enregistré. Aucun numéro de téléphone dans les journaux : vérifié par le test, et les numéros des admins sont masqués dans les journaux « NOTIFY SUPERADMIN ».

**parcours/paiement-webhook**

Run 27 (avant correctif) :

```text
    not ok 1 - sans jeton : enregistré, 200, aucun billet, paiement toujours PENDING
        → aucun billet sans jeton
        → 1 !== 0
    not ok 2 - jeton erroné : rejeté, aucun billet
        → Expected values to be strictly equal:
        → 1 !== 0
    not ok 3 - jeton valide mais transaction_id différent de l’identifiant enregistré : rejeté (corrélation)
        → Expected values to be strictly equal:
        → 1 !== 0
    not ok 4 - jeton et corrélation valides, fournisseur encore PENDING : aucun billet
        → le webhook seul ne suffit pas : le statut SamirPay fait foi
        → 1 !== 0
    not ok 5 - fournisseur SUCCESS : billets émis, statut demandé avec l’identifiant ENREGISTRÉ
        → statut demandé à SamirPay avant émission
    not ok 6 - rejeu : enregistré une fois (compteur de réceptions), billets non doublés
        → journal des webhooks : Could not find the table 'public.payment_webhook_events' in the schema cache
        → +   code: 'PGRST205',
        → +   details: null,
        → +   hint: null,
    not ok 7 - order_id malformé (injection de filtre PostgREST) : 200, rejeté, aucun billet
        → journal des webhooks : Could not find the table 'public.payment_webhook_events' in the schema cache
        → +   code: 'PGRST205',
        → +   details: null,
        → +   hint: null,
    not ok 8 - corps brut et en-têtes utiles conservés ; statut autre que success ignoré
        → journal des webhooks : Could not find the table 'public.payment_webhook_events' in the schema cache
        → +   code: 'PGRST205',
        → +   details: null,
        → +   hint: null,
    ok 9 - aucun numéro de téléphone payeur dans les journaux du parcours
not ok 1 - Webhook SamirPay
not ok 2 - /home/runner/work/event-village/event-village/tests/parcours/paiement-webhook.test.ts
        → relation "public.stock_reservations" does not exist
# pass 1
# fail 8
```

Run 29 (après correctif) :

```text
    ok 1 - sans jeton : enregistré, 200, aucun billet, paiement toujours PENDING
    ok 2 - jeton erroné : rejeté, aucun billet
    ok 3 - jeton valide mais transaction_id différent de l’identifiant enregistré : rejeté (corrélation)
    ok 4 - jeton et corrélation valides, fournisseur encore PENDING : aucun billet
    ok 5 - fournisseur SUCCESS : billets émis, statut demandé avec l’identifiant ENREGISTRÉ
    ok 6 - rejeu : enregistré une fois (compteur de réceptions), billets non doublés
    ok 7 - order_id malformé (injection de filtre PostgREST) : 200, rejeté, aucun billet
    ok 8 - corps brut et en-têtes utiles conservés ; statut autre que success ignoré
    ok 9 - aucun numéro de téléphone payeur dans les journaux du parcours
ok 1 - Webhook SamirPay
# pass 9
# fail 0
```

**parcours/achat-serveur**

Run 27 (code non corrigé, ancienne version du test : suite adaptée dans le commit de correctif, pas un test rouge) :

```text
ok 1 - checkout → paiement PENDING → notification SUCCESS → billet VALIDE émis par le serveur
# pass 1
# fail 0
```

Run 29 (après correctif) :

```text
ok 1 - checkout → paiement PENDING → notification SUCCESS → billet VALIDE émis par le serveur
# pass 1
# fail 0
```

**parcours/email-optionnel**

Run 27 (code non corrigé, ancienne version du test : suite adaptée dans le commit de correctif, pas un test rouge) :

```text
    ok 1 - inscriptions et achat sans RESEND_API_KEY : SMS envoyés, aucun email tenté, un seul avertissement
    ok 2 - sans identifiants MTarget, la configuration serveur est refusée
ok 1 - Email optionnel, SMS obligatoire
# pass 2
# fail 0
```

Run 29 (après correctif) :

```text
    ok 1 - inscriptions et achat sans RESEND_API_KEY : SMS envoyés, aucun email tenté, un seul avertissement
    ok 2 - sans identifiants MTarget, la configuration serveur est refusée
ok 1 - Email optionnel, SMS obligatoire
# pass 2
# fail 0
```

**parcours/filtres-postgrest**

Run 27 (code non corrigé, ancienne version du test : suite adaptée dans le commit de correctif, pas un test rouge) :

```text
    ok 1 - aucune interpolation brute dans un .or() / .filter() hors paiement (lot 2)
    ok 2 - recherche admin : une virgule dans « search » n’ajoute pas de condition au filtre
ok 1 - Filtres PostgREST construits par interpolation
# pass 2
# fail 0
```

Run 29 (après correctif) :

```text
    ok 1 - aucune interpolation brute dans un .or() / .filter() hors paiement (lot 2)
    ok 2 - recherche admin : une virgule dans « search » n’ajoute pas de condition au filtre
ok 1 - Filtres PostgREST construits par interpolation
# pass 2
# fail 0
```

### 2.2 — Confirmation atomique (R10, R11, R12, R13)

```text
$ git grep -n -E 'reserveTicketsAtomic\(|releaseHoldTicketsAtomic\(' 8b9a361 -- app lib
8b9a361:app/api/checkout/route.ts:103:      const purchaseResult = await EventService.reserveTicketsAtomic({
8b9a361:app/api/checkout/route.ts:258:        await EventService.releaseHoldTicketsAtomic({
8b9a361:app/api/tickets/claim-free/route.ts:59:        const result = await EventService.reserveTicketsAtomic({
8b9a361:lib/events/event.service.ts:963:    public static async reserveTicketsAtomic(params: {
8b9a361:lib/events/event.service.ts:1348:        const result = await this.reserveTicketsAtomic({
8b9a361:lib/events/event.service.ts:1590:    public static async releaseHoldTicketsAtomic(params: {
8b9a361:lib/payments/payment.service.ts:363:                await EventService.releaseHoldTicketsAtomic({
8b9a361:lib/payments/payment.service.ts:543:                        const purchaseResult = await EventService.reserveTicketsAtomic({
8b9a361:lib/payments/payment.service.ts:561:                        await EventService.releaseHoldTicketsAtomic({
8b9a361:lib/payments/payment.service.ts:572:                            const purchaseResult = await EventService.reserveTicketsAtomic({
8b9a361:lib/payments/payment.service.ts:593:                            await EventService.releaseHoldTicketsAtomic({
8b9a361:lib/payments/payment.service.ts:950:                        await EventService.releaseHoldTicketsAtomic({
8b9a361:lib/payments/payment.service.ts:956:                    await EventService.releaseHoldTicketsAtomic({
8b9a361:lib/payments/payment.service.ts:1016:                        await EventService.releaseHoldTicketsAtomic({
8b9a361:lib/payments/payment.service.ts:1024:                    await EventService.releaseHoldTicketsAtomic({
(code de sortie 0)

$ git grep -n -E 'from\('"'"'tickets'"'"'\)\s*\.insert|\.from\('"'"'tickets'"'"'\)$' 8b9a361 -- app lib
8b9a361:app/api/controller/assignments/route.ts:59:                        .from('tickets')
8b9a361:app/api/controller/assignments/route.ts:65:                        .from('tickets')
8b9a361:app/api/controller/scan/route.ts:102:            .from('tickets')
8b9a361:app/api/controller/scan/route.ts:112:                .from('tickets')
8b9a361:app/api/controller/scan/route.ts:386:            .from('tickets')
8b9a361:app/api/controller/scan/route.ts:449:            .from('tickets')
8b9a361:app/api/controller/scan/route.ts:598:                .from('tickets')
8b9a361:app/api/controller/scan/route.ts:604:                .from('tickets')
8b9a361:app/api/partner/finance/route.ts:63:                .from('tickets')
8b9a361:app/api/partner/metrics/route.ts:66:                .from('tickets')
8b9a361:app/api/tickets/[id]/live-code/route.ts:35:            .from('tickets')
8b9a361:app/api/tickets/[id]/pdf/route.ts:48:            .from('tickets')
8b9a361:app/api/tickets/route.ts:28:            .from('tickets')
8b9a361:app/api/tickets/verify/route.ts:94:            .from('tickets')
8b9a361:app/api/tickets/verify/route.ts:104:                .from('tickets')
8b9a361:app/api/tickets/verify/route.ts:191:            .from('tickets')
8b9a361:app/api/tickets/verify/route.ts:225:            .from('tickets')
8b9a361:app/api/tickets/verify/route.ts:231:            .from('tickets')
8b9a361:lib/events/event-cancellation.service.ts:217:            .from('tickets')
8b9a361:lib/events/event-cancellation.service.ts:241:            .from('tickets')
8b9a361:lib/events/event-cancellation.service.ts:510:                            .from('tickets')
8b9a361:lib/events/event-cancellation.service.ts:518:                            .from('tickets')
8b9a361:lib/events/event-cancellation.service.ts:719:                        .from('tickets')
8b9a361:lib/events/event-cancellation.service.ts:818:            .from('tickets')
8b9a361:lib/events/event.service.ts:374:                    .from('tickets')
8b9a361:lib/events/event.service.ts:1183:            .from('tickets')
8b9a361:lib/events/event.service.ts:1649:            .from('tickets')
8b9a361:lib/events/event.service.ts:1683:            .from('tickets')
8b9a361:lib/notifications/notification.service.ts:1091:                .from('tickets')
8b9a361:lib/payments/payment.service.ts:143:                    .from('tickets')
8b9a361:lib/payments/payment.service.ts:527:                        .from('tickets')
8b9a361:lib/payments/payment.service.ts:938:                    .from('tickets')
8b9a361:lib/tickets/ticket-transfer.service.ts:117:            .from('tickets')
8b9a361:lib/tickets/ticket-transfer.service.ts:167:                .from('tickets')
8b9a361:lib/tickets/ticket-transfer.service.ts:229:                    .from('tickets')
8b9a361:lib/tickets/ticket-transfer.service.ts:301:                            .from('tickets')
8b9a361:lib/tickets/ticket-transfer.service.ts:439:            .from('tickets')
8b9a361:lib/tickets/ticket-transfer.service.ts:617:            .from('tickets')
8b9a361:lib/tickets/ticket-transfer.service.ts:722:                .from('tickets')
8b9a361:lib/tickets/ticket-transfer.service.ts:728:                    .from('tickets')
8b9a361:lib/tickets/ticket-transfer.service.ts:890:                .from('tickets')
8b9a361:lib/tickets/ticket-transfer.service.ts:904:            .from('tickets')
8b9a361:lib/tickets/ticket-transfer.service.ts:957:                            .from('tickets')
(code de sortie 0)
```

**Correctif** (migration `20261031000015`, `lib/payments/confirmation.service.ts`). `payment_confirm(paiement, source)`, une seule RPC appelée par le webhook, la route de statut et la réconciliation. Dans une transaction :
1. verrou du paiement, puis des catégories par identifiant croissant ;
2. contrôle que tout le panier est honorable (réservation active, ou stock encore libre si elle a échu ; événement non annulé) ;
3. conversion des réservations : `held` diminue une seule fois, par le trigger, puis `sold` augmente ;
4. création des billets de **tout** le panier, gratuits compris, au prix lu sur la réservation, avec `tickets.payment_id` ;
5. passage du paiement à SUCCESS.

Si le panier n'est pas honorable : aucun billet, statut `REFUND_PENDING` et remboursement (`refund_request`, 2.7). Un second appel renvoie `ALREADY_CONFIRMED`. Les notifications (achat, catégorie épuisée, événement complet) ne partent qu'au premier passage. Le double décrément de `held_quantity` disparaît avec la suppression de `reserveTicketsAtomic` et des `finally` du webhook.

**parcours/paiement-confirmation**

Run 27 (avant correctif) :

```text
    not ok 1 - deux webhooks identiques simultanés + un sondage : billets émis une seule fois, held sans double décrément
        → trois billets exactement (2 Standard + 1 VIP)
        → 6 !== 3
    not ok 2 - RPC idempotente : un second appel ne fait rien et le dit
        → premier appel : Could not find the function public.payment_confirm(p_payment_id, p_source) in the schema cache
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.payment_confirm with parameters p_payment_id, p_source or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 3 - panier dont une catégorie ne peut pas être honorée : zéro billet, jamais de SUCCESS partiel, remboursement déclenché
        → échéance forcée : Could not find the table 'public.stock_reservations' in the schema cache
        → +   code: 'PGRST205',
        → +   details: null,
        → +   hint: null,
    not ok 4 - montants lus, pas recalculés : le billet garde le prix payé si la catégorie change de prix avant la confirmation
        → prix du billet = prix au paiement
        → 99999 !== 2500
not ok 1 - Confirmation atomique
not ok 2 - /home/runner/work/event-village/event-village/tests/parcours/paiement-confirmation.test.ts
        → relation "public.stock_reservations" does not exist
# pass 0
# fail 4
```

Run 29 (après correctif) :

```text
    ok 1 - deux webhooks identiques simultanés + un sondage : billets émis une seule fois, held sans double décrément
    ok 2 - RPC idempotente : un second appel ne fait rien et le dit
    ok 3 - panier dont une catégorie ne peut pas être honorée : zéro billet, jamais de SUCCESS partiel, remboursement déclenché
    ok 4 - montants lus, pas recalculés : le billet garde le prix payé si la catégorie change de prix avant la confirmation
ok 1 - Confirmation atomique
# pass 4
# fail 0
```

**parcours/statut-compte**

Run 27 (code non corrigé, ancienne version du test : suite adaptée dans le commit de correctif, pas un test rouge) :

```text
    ok 1 - invitation d’un compte SUSPENDU par le partenaire A → refus explicite, journalisé, statut inchangé
    ok 2 - invitation avec l’email d’un compte existant et un autre numéro → compte distinct, identifiants du titulaire intacts
    ok 3 - affectation d’un compte SUSPENDU par le partenaire A → refus explicite, journalisé, statut inchangé
    ok 4 - retrait d’un contrôleur SUSPENDU par le partenaire A → retiré, statut inchangé
    ok 5 - partenaire SUSPENDU → /api/partner/events refusé (ACCOUNT_NOT_ACTIVE)
    ok 6 - client SUSPENDU → /api/tickets/[id]/live-code refusé (ACCOUNT_NOT_ACTIVE)
    ok 7 - activation d’essai d’un partenaire par un autre compte → refusée
    ok 8 - liste des billets : le paramètre userId ne donne pas accès aux billets d’un autre compte
    ok 9 - vérification de billet : refusée à un CLIENT et au partenaire d’un autre événement, acceptée pour le contrôleur affecté
    ok 10 - toutes les routes /api/partner/* et /api/tickets/* passent par le helper commun
ok 1 - Statut des comptes sur les routes partenaire et billets
# pass 10
# fail 0
```

Run 29 (après correctif) :

```text
    ok 1 - invitation d’un compte SUSPENDU par le partenaire A → refus explicite, journalisé, statut inchangé
    ok 2 - invitation avec l’email d’un compte existant et un autre numéro → compte distinct, identifiants du titulaire intacts
    ok 3 - affectation d’un compte SUSPENDU par le partenaire A → refus explicite, journalisé, statut inchangé
    ok 4 - retrait d’un contrôleur SUSPENDU par le partenaire A → retiré, statut inchangé
    ok 5 - partenaire SUSPENDU → /api/partner/events refusé (ACCOUNT_NOT_ACTIVE)
    ok 6 - client SUSPENDU → /api/tickets/[id]/live-code refusé (ACCOUNT_NOT_ACTIVE)
    ok 7 - activation d’essai d’un partenaire par un autre compte → refusée
    ok 8 - liste des billets : le paramètre userId ne donne pas accès aux billets d’un autre compte
    ok 9 - vérification de billet : refusée à un CLIENT et au partenaire d’un autre événement, acceptée pour le contrôleur affecté
    ok 10 - toutes les routes /api/partner/* et /api/tickets/* passent par le helper commun
ok 1 - Statut des comptes sur les routes partenaire et billets
# pass 10
# fail 0
```

### 2.3 — Route de statut (R10)

```text
$ git grep -n -E 'getServerSessionUser|requireActiveSession|\.update\(' 8b9a361 -- 'app/api/payments/[transactionId]/status/route.ts'
8b9a361:app/api/payments/[transactionId]/status/route.ts:47:                            .update({
(code de sortie 0)

$ git grep -n -E '/api/payments/.*status' 8b9a361 -- app components hooks
8b9a361:app/api/payments/[transactionId]/status/route.ts:78:        console.error('[API /api/payments/[transactionId]/status] Erreur:', error);
8b9a361:components/payment/PaymentModal.tsx:85:        const res = await fetch(`/api/payments/${transactionId}/status`);
8b9a361:hooks/usePaymentStatus.ts:32:            const res = await fetch(`/api/payments/${encodeURIComponent(transactionId)}/status`);
(code de sortie 0)
```

**Correctif.**
- **Accès** : UUID validé (400), session ACTIF (401), propriétaire seulement (404 sinon), réponse `no-store`.
- **Lecture seule** : si le paiement n'est pas final, la route demande une réconciliation (statut SamirPay avec l'identifiant enregistré, puis la RPC commune), au plus une fois toutes les `STATUS_POLL_RECONCILE_SECONDS`. Elle n'écrit jamais elle-même un statut.

**parcours/paiement-statut**

Run 27 (avant correctif) :

```text
    not ok 1 - sans session → 401 ; autre compte → 404 sans donnée ; propriétaire → statut, opérateur, échéance
        → Expected values to be strictly equal:
        → 400 !== 401
    ok 2 - identifiant non UUID (injection) → 400
    not ok 3 - sondage qui voit SUCCESS chez SamirPay avant le webhook : billets émis exactement une fois, puis webhook idempotent
        → Expected values to be strictly equal:
        → 400 !== 200
    not ok 4 - la route ne passe jamais elle-même un paiement en SUCCESS (lecture seule, réconciliation par RPC)
        → aucune écriture de SUCCESS dans la route
not ok 1 - Route de statut
not ok 2 - /home/runner/work/event-village/event-village/tests/parcours/paiement-statut.test.ts
        → relation "public.stock_reservations" does not exist
# pass 1
# fail 3
```

Run 29 (après correctif) :

```text
    ok 1 - sans session → 401 ; autre compte → 404 sans donnée ; propriétaire → statut, opérateur, échéance
    ok 2 - identifiant non UUID (injection) → 400
    ok 3 - sondage qui voit SUCCESS chez SamirPay avant le webhook : billets émis exactement une fois, puis webhook idempotent
    ok 4 - la route ne passe jamais elle-même un paiement en SUCCESS (lecture seule, réconciliation par RPC)
ok 1 - Route de statut
# pass 4
# fail 0
```

### 2.4 — Réservation de stock en SQL (R9, R13)

```text
$ git grep -n -E 'verifyAndEnforceHoldAtomic|cleanupExpiredHolds|getActiveHeldQuantity' 8b9a361 -- app lib
8b9a361:app/api/checkout/route.ts:211:        await EventService.verifyAndEnforceHoldAtomic({
8b9a361:lib/events/event.service.ts:1364:    public static async getActiveHeldQuantity(categoryId: string): Promise<number> {
8b9a361:lib/events/event.service.ts:1436:    public static async verifyAndEnforceHoldAtomic(params: {
8b9a361:lib/payments/payment.service.ts:319:            await EventService.verifyAndEnforceHoldAtomic({
8b9a361:lib/payments/payment.service.ts:983:    public async cleanupExpiredHolds(): Promise<{ cleanedCount: number; releasedTickets: number }> {
(code de sortie 0)

$ git grep -n -E 'from\('"'"'payments'"'"'\)\s*\.delete\(|\.delete\(\)' 8b9a361 -- lib/events/event.service.ts
8b9a361:lib/events/event.service.ts:176:                await supabase.from('events').delete().eq('id', event.id);
8b9a361:lib/events/event.service.ts:690:        const { error: catDelErr } = await supabase.from('ticket_categories').delete().eq('event_id', eventId);
8b9a361:lib/events/event.service.ts:691:        const { error: delErr } = await supabase.from('events').delete().eq('id', eventId);
8b9a361:lib/events/event.service.ts:1454:            await supabase.from('payments').delete().eq('id', params.paymentId);
8b9a361:lib/events/event.service.ts:1459:            await supabase.from('payments').delete().eq('id', params.paymentId);
8b9a361:lib/events/event.service.ts:1468:            await supabase.from('payments').delete().eq('id', params.paymentId);
8b9a361:lib/events/event.service.ts:1514:            await supabase.from('payments').delete().eq('id', params.paymentId);
8b9a361:lib/events/event.service.ts:1535:                        await supabase.from('payments').delete().eq('id', params.paymentId);
8b9a361:lib/events/event.service.ts:1565:                        await supabase.from('payments').delete().eq('id', params.paymentId);
8b9a361:lib/events/event.service.ts:1575:                    await supabase.from('payments').delete().eq('id', params.paymentId);
(code de sortie 0)

$ git grep -n -E 'catch \{\s*$|colonne held_quantity|hasHeldCol' 8b9a361 -- lib/events/event.service.ts
8b9a361:lib/events/event.service.ts:1068:        let hasHeldCol = false;
8b9a361:lib/events/event.service.ts:1077:                hasHeldCol = true;
8b9a361:lib/events/event.service.ts:1080:        } catch {
8b9a361:lib/events/event.service.ts:1081:            hasHeldCol = false;
8b9a361:lib/events/event.service.ts:1101:            if (hasHeldCol) {
8b9a361:lib/events/event.service.ts:1112:            if (hasHeldCol) {
8b9a361:lib/events/event.service.ts:1140:            if (hasHeldCol) {
8b9a361:lib/events/event.service.ts:1202:                if (params.paymentConfirmed && hasHeldCol) {
8b9a361:lib/events/event.service.ts:1390:        } catch {
8b9a361:lib/events/event.service.ts:1579:        } catch {
8b9a361:lib/events/event.service.ts:1580:            // colonne held_quantity non configurée en base
8b9a361:lib/events/event.service.ts:1625:            } catch {
(code de sortie 0)
```

**Correctif** (migration `20261031000013`).
- **`stock_reservations`** : une ligne par paiement et catégorie, avec quantité, prix unitaire, échéance et statut (ACTIVE, CONVERTED, RELEASED ou EXPIRED).
- **`held_quantity` maintenu par trigger**, égal à la somme des réservations ACTIVE. Choix « trigger » plutôt que « dérivé » : la colonne reste lue par l'interface temps réel et l'API publique, et la contrainte `sold + held <= total` reste le dernier filet.
- **`checkout_create_payment`**, dans une transaction et tout ou rien :
  - verrou des catégories, puis remise en stock des réservations échues de ces catégories ;
  - contrôles partagés (2.5) ;
  - paiement PENDING, puis réservations de tout le panier.

  En cas d'échec, aucune ligne `payments` n'est créée et aucun appel SamirPay n'a lieu.
- **Libération** (`payment_release`) sur tous les chemins d'échec : refus SamirPay (corps ou exception), délai dépassé, annulation par le client (`/api/payments/<id>/cancel`), expiration.
- **Purge** : `stock_reservations_expire`, appelée par `/api/cron/stock-reservations` (CRON_SECRET, sans repli) et au début de la réconciliation.
- **Code applicatif supprimé** : `verifyAndEnforceHoldAtomic` (try/catch vide, suppression du paiement), `releaseHoldTicketsAtomic`, `reserveTicketsAtomic`, `getActiveHeldQuantity`, `purchaseTicketAtomic` et `cleanupExpiredHolds`, avec leurs replis « colonne absente ».
- **Middleware** : `/api/cron` devient public, les routes se protégeant elles-mêmes. Avant, un planificateur sans cookie recevait 401 avant même d'atteindre la route.

**parcours/paiement-reservation**

Run 27 (avant correctif) :

```text
    not ok 1 - deux acheteurs simultanés pour la dernière place : une réservation, un refus avant tout appel SamirPay, aucune survente
        → un refus 409
        → 0 !== 1
    not ok 2 - panier partiel (une catégorie épuisée) : rien n’est réservé, aucun paiement
        → {"error":"Stock insuffisant : Cette catégorie est actuellement en cours de réservation par d'autres acheteurs. Veuillez réessayer dans quelques minutes."}
        → 400 !== 409
    not ok 3 - refus SamirPay dans la réponse : paiement FAILED, réservation libérée
        → refus remonté : 200
    not ok 4 - exception SamirPay (délai dépassé) : réservation libérée
        → réservation libérée
        → +   held: 5,
        → -   held: 4,
        → sold: 0,
    not ok 5 - annulation par le client : réservation libérée, paiement CANCELLED ; un tiers ne peut pas annuler
        → Cannot find module '/home/runner/work/event-village/event-village/app/api/payments/[transactionId]/cancel/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
    not ok 6 - réservation échue : la route cron (CRON_SECRET) rend le stock ; sans secret → 401
        → Cannot find module '/home/runner/work/event-village/event-village/app/api/cron/stock-reservations/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
    not ok 7 - plus de repli silencieux : aucune suppression de paiement ni « colonne absente » dans le code serveur
        → Expected values to be strictly deep-equal:
        → +   'app/api/checkout/route.ts : ancienne réservation applicative',
        → +   'lib/events/event.service.ts : suppression de paiement',
        → +   'lib/events/event.service.ts : repli « colonne absente »',
not ok 1 - Réservation de stock
not ok 2 - /home/runner/work/event-village/event-village/tests/parcours/paiement-reservation.test.ts
        → relation "public.stock_reservations" does not exist
# pass 0
# fail 7
```

Run 29 (après correctif) :

```text
    ok 1 - deux acheteurs simultanés pour la dernière place : une réservation, un refus avant tout appel SamirPay, aucune survente
    ok 2 - panier partiel (une catégorie épuisée) : rien n’est réservé, aucun paiement
    ok 3 - refus SamirPay dans la réponse : paiement FAILED, réservation libérée
    ok 4 - exception SamirPay (délai dépassé) : réservation libérée
    ok 5 - annulation par le client : réservation libérée, paiement CANCELLED ; un tiers ne peut pas annuler
    ok 6 - réservation échue : la route cron (CRON_SECRET) rend le stock ; sans secret → 401
    ok 7 - plus de repli silencieux : aucune suppression de paiement ni « colonne absente » dans le code serveur
ok 1 - Réservation de stock
# pass 7
# fail 0
```

### 2.5 — Contrôles avant tout débit (R14, client-ux-2)

```text
$ git grep -n -E 'max_per_order|sale_start|sale_end|is_visible' 8b9a361 -- app/api/checkout lib/payments/payment.service.ts
(code de sortie 1)

$ git grep -n -E 'max\(20\)|CARD|'"'"'card'"'"'' 8b9a361 -- app/api/checkout lib/validations/payment.ts components/payment
8b9a361:app/api/checkout/route.ts:14:    quantity: z.number().int().min(1).max(20)
8b9a361:components/payment/PaymentModal.tsx:38:  const [operator, setOperator] = useState<'wave' | 'om' | 'card'>('wave');
8b9a361:components/payment/PaymentModal.tsx:52:  const isPhoneValid = operator === 'card' || /^(7[0-8])\d{7}$/.test(phoneNumber.replace(/\s/g, ''));
8b9a361:components/payment/PaymentModal.tsx:108:    if (operator !== 'card' && !isPhoneValid) {
8b9a361:components/payment/PaymentModal.tsx:284:                  onClick={() => setOperator('card')}
8b9a361:components/payment/PaymentModal.tsx:286:                    operator === 'card'
8b9a361:components/payment/PaymentModal.tsx:298:            {operator !== 'card' && (
8b9a361:components/payment/PaymentModal.tsx:336:              disabled={operator !== 'card' && !isPhoneValid}
8b9a361:lib/validations/payment.ts:22:    operator: z.enum(['WAVE', 'ORANGE_MONEY', 'CARD'], {
8b9a361:lib/validations/payment.ts:25:    quantity: z.number().int().min(1).max(20).optional(),
(code de sortie 0)

$ git grep -n -E idempotency 8b9a361 -- app/api/checkout lib/payments/payment.service.ts
8b9a361:app/api/checkout/route.ts:189:        idempotency_key: `IDEMP-${externalOrderId}`,
8b9a361:lib/payments/payment.service.ts:295:                idempotency_key: `IDEMP-${externalOrderId}`,
(code de sortie 0)
```

**Correctif** (migration `20261031000014`, `lib/payments/checkout.service.ts`).
- **Contrôles partagés** : `ticket_sale_problems` est appelée par le checkout, `/api/payments/create` (billet), la réservation (sous verrou) et les billets gratuits. Elle vérifie que la catégorie est active et visible, que l'événement est PUBLIE et non passé, la fenêtre de vente, `max_per_order`, et le stock moins les réservations. Elle renvoie 400 explicite par catégorie, ou 409 pour le stock seul.
- **Bornes** : la borne Zod est alignée sur `max_per_order`, borné de 1 à 50 par une contrainte.
- **Idempotence** : `Idempotency-Key` obligatoire ; une double soumission renvoie le même paiement (unicité par compte et par clé, en base).
- **Quota de checkout par compte** : `reserveQuota` du lot 1C, en base, fail-closed.
- **Opérateur et téléphone payeur** obligatoires et persistés. Montants calculés par le code existant (`lib/payments/fees.ts`), inchangé et sans valeur de repli.

**parcours/paiement-controles**

Run 27 (avant correctif) :

```text
    not ok 1 - 11 billets pour max_per_order = 10 → 400, aucun paiement, aucun appel SamirPay
        → max_per_order : HTTP 200 {"success":true,"freeTickets":[],"payment":{"transaction_id":"TX-EV-1793470496112-6786FB","payment_url":"http://127.0.0.1:9/fake-samirpay/pay/FAKE-TX-1","is_push_ussd":false,"amount":22000},"totalPaid":22000,"totalFree":0,"totalTickets":11}
        → 200 !== 400
    not ok 2 - vente close, vente pas encore ouverte, catégorie invisible ou inactive → 400
        → vente close : HTTP 200 {"success":true,"freeTickets":[],"payment":{"transaction_id":"TX-EV-1793470496294-5F029E","payment_url":"http://127.0.0.1:9/fake-samirpay/pay/FAKE-TX-2","is_push_ussd":false,"amount":2000},"totalPaid":2000,"totalFree":0,"totalTickets":1}
        → 200 !== 400
    not ok 3 - événement passé ou non publié → 400
        → événement passé : HTTP 200 {"success":true,"freeTickets":[],"payment":{"transaction_id":"TX-EV-1793470496467-377EF9","payment_url":"http://127.0.0.1:9/fake-samirpay/pay/FAKE-TX-3","is_push_ussd":false,"amount":2000},"totalPaid":2000,"totalFree":0,"totalTickets":1}
        → 200 !== 400
    not ok 4 - opérateur absent, carte bancaire, téléphone payeur invalide → 400, aucun paiement
        → opérateur absent : HTTP 200 {"success":true,"freeTickets":[],"payment":{"transaction_id":"TX-EV-1793470496644-1BBC58","payment_url":"http://127.0.0.1:9/fake-samirpay/pay/FAKE-TX-4","is_push_ussd":false,"amount":2000},"totalPaid":2000,"totalFree":0,"totalTickets":1}
        → 200 !== 400
    not ok 5 - Idempotency-Key absente → 400
        → sans clé : HTTP 200 {"success":true,"freeTickets":[],"payment":{"transaction_id":"TX-EV-1793470496818-6E4BA9","payment_url":"http://127.0.0.1:9/fake-samirpay/pay/FAKE-TX-5","is_push_ussd":false,"amount":2000},"totalPaid":2000,"totalFree":0,"totalTickets":1}
        → 200 !== 400
    not ok 6 - double soumission (même Idempotency-Key, en parallèle) → un seul paiement, un seul appel SamirPay
        → un seul paiement
        → 2 !== 1
    not ok 7 - limite de checkout par compte (quota en base) → 429
        → Expected values to be strictly deep-equal:
        → 200,
        → 200,
        → +   200
    not ok 8 - /api/payments/create (billet) applique les mêmes contrôles : 11 billets → 400, aucun paiement
        → HTTP 201 {"success":true,"payment_id":"774eb942-f517-47d3-8162-d623a0ab159a","order_id":"ORD-EV-1793470497440-AE2F4C","transaction_id":"TX-EV-1793470497440-AE2F4C","payment_url":"http://127.0.0.1:9/fake-samirpay/pay/FAKE-TX-11","is_push_ussd":false,"amount":22000,"currency":"XOF","status":"PENDING"}
        → 201 !== 400
not ok 1 - Contrôles avant débit
not ok 2 - /home/runner/work/event-village/event-village/tests/parcours/paiement-controles.test.ts
        → relation "public.stock_reservations" does not exist
# pass 0
# fail 8
```

Run 29 (après correctif) :

```text
    ok 1 - 11 billets pour max_per_order = 10 → 400, aucun paiement, aucun appel SamirPay
    ok 2 - vente close, vente pas encore ouverte, catégorie invisible ou inactive → 400
    ok 3 - événement passé ou non publié → 400
    ok 4 - opérateur absent, carte bancaire, téléphone payeur invalide → 400, aucun paiement
    ok 5 - Idempotency-Key absente → 400
    ok 6 - double soumission (même Idempotency-Key, en parallèle) → un seul paiement, un seul appel SamirPay
    ok 7 - limite de checkout par compte (quota en base) → 429
    ok 8 - /api/payments/create (billet) applique les mêmes contrôles : 11 billets → 400, aucun paiement
ok 1 - Contrôles avant débit
# pass 8
# fail 0
```

### 2.6 — Billets gratuits dans un panier mixte (ticketing-finance-16)

```text
$ git grep -n -E claim-free 8b9a361 -- app components hooks lib
8b9a361:app/api/tickets/claim-free/route.ts:10: * POST /api/tickets/claim-free
8b9a361:app/api/tickets/claim-free/route.ts:90:                console.error('[claim-free] Erreur notifications:', notifErr);
8b9a361:app/api/tickets/claim-free/route.ts:102:        console.error('[API /api/tickets/claim-free] Erreur:', msg);
(code de sortie 0)

$ git grep -n -E 'price > 0|freeItems|paymentConfirmed: true' 8b9a361 -- app/api/checkout app/api/tickets/claim-free 'app/events/[id]/page.tsx'
8b9a361:app/api/checkout/route.ts:69:    const freeItems: any[] = [];
8b9a361:app/api/checkout/route.ts:91:        freeItems.push(item);
8b9a361:app/api/checkout/route.ts:102:    for (const item of freeItems) {
8b9a361:app/api/checkout/route.ts:108:        paymentConfirmed: true,
8b9a361:app/api/checkout/route.ts:122:          categoryId: freeItems[0].categoryId,
8b9a361:app/api/checkout/route.ts:142:        totalFree: freeItems.reduce((acc, i) => acc + i.quantity, 0),
8b9a361:app/api/checkout/route.ts:321:      totalFree: freeItems.reduce((acc, i) => acc + i.quantity, 0),
8b9a361:app/api/tickets/claim-free/route.ts:64:            paymentConfirmed: true,
(code de sortie 0)
```

**Correctif.**
- **Panier mixte** : les gratuits sont réservés avec le panier et émis par `payment_confirm`. Aucun billet gratuit sans paiement confirmé, aucun doublon.
- **Panier entièrement gratuit et claim-free** : `free_tickets_claim` (migration `20261031000018`) applique les contrôles partagés et la limite par compte et par catégorie (`max_per_order`, billets déjà détenus compris), dans une transaction, avec un quota de demandes par compte.
- **Interface** : la page événement envoie désormais tout le panier (2.10).

**parcours/paiement-gratuits**

Run 27 (avant correctif) :

```text
    not ok 1 - panier mixte dont le paiement échoue : aucun billet gratuit émis
        → aucun billet avant la confirmation
        → 2 !== 0
    not ok 2 - panier mixte confirmé : payants et gratuits émis ensemble, une seule fois
        → Expected values to be strictly equal:
        → 2 !== 1
    not ok 3 - claim-free : tentatives répétées et simultanées → jamais au-delà de la limite par compte et par catégorie
        → deux réussites (limite 2) : 201,201,201,201,201
        → 0 !== 2
    ok 4 - claim-free sur une catégorie payante → 400, aucun billet
not ok 1 - Billets gratuits
not ok 2 - /home/runner/work/event-village/event-village/tests/parcours/paiement-gratuits.test.ts
        → relation "public.stock_reservations" does not exist
# pass 1
# fail 3
```

Run 29 (après correctif) :

```text
    ok 1 - panier mixte dont le paiement échoue : aucun billet gratuit émis
    ok 2 - panier mixte confirmé : payants et gratuits émis ensemble, une seule fois
    ok 3 - claim-free : tentatives répétées et simultanées → jamais au-delà de la limite par compte et par catégorie
    ok 4 - claim-free sur une catégorie payante → 400, aucun billet
ok 1 - Billets gratuits
# pass 4
# fail 0
```

### 2.7 — Remboursement automatique sûr (payment-security-9) et module de cashout commun

```text
$ git grep -n -E 'sendCashout\(' 8b9a361 -- app lib
8b9a361:lib/events/event-cancellation.service.ts:472:                    const cashoutRes = await samirPayClient.sendCashout({
8b9a361:lib/events/event-cancellation.service.ts:680:                const cashoutRes = await samirPayClient.sendCashout({
8b9a361:lib/integrations/types.ts:55:    sendCashout(payload: SamirPayCashoutRequest): Promise<SamirPayCashoutResponse>;
8b9a361:lib/payments/payment.service.ts:636:                        const cashoutRes = await samirPayClient.sendCashout({
8b9a361:lib/payments/withdrawal.service.ts:120:            const cashoutRes = await samirPayClient.sendCashout({
8b9a361:lib/samirpay/client.ts:17:    sendCashout: (payload) => getPaymentGateway().sendCashout(payload),
8b9a361:lib/samirpay/http-client.ts:283:    public async sendCashout(payload: SamirPayCashoutRequest): Promise<SamirPayCashoutResponse> {
(code de sortie 0)

$ git grep -n -E '770000000|operator(Name)?\s*(=|:)\s*['"'"'"]WAVE['"'"'"]|\|\|\s*['"'"'"]WAVE['"'"'"]' 8b9a361 -- app lib
8b9a361:app/api/checkout/route.ts:235:    const samirPayOperator = operator || 'WAVE';
8b9a361:lib/events/event-cancellation.service.ts:464:            const cleanPhone = (buyerPhone || '770000000').replace(/\s+/g, '');
8b9a361:lib/events/event-cancellation.service.ts:672:        const cleanPhone = (buyerPhone || '770000000').replace(/\s+/g, '');
8b9a361:lib/events/event-cancellation.service.ts:920:        if (params.buyerPhone && params.buyerPhone !== '770000000') {
8b9a361:lib/payments/payment.service.ts:340:        const samirPayOperator = input.operator || 'WAVE'; // 'ORANGE_MONEY' / 'WAVE' envoyé tel quel
8b9a361:lib/payments/payment.service.ts:607:                    let operator: 'WAVE' | 'ORANGE_MONEY' = 'WAVE';
8b9a361:lib/payments/payment.service.ts:628:                    const cleanPhone = (buyerPhone || '770000000').replace(/\s+/g, '');
8b9a361:lib/payments/payment.service.ts:715:                                : `Event Village: Votre commande n'a pu aboutir (billets epuises). Notre service client procede a votre remboursement de ${Number(payment.amount).toLocaleString('fr-FR')} FCFA. Contact: +221770000000.`;
(code de sortie 0)
```

Appels actuels de `sendCashout` (grep ci-dessus) :
- `payment.service.ts:636`, remboursement automatique du webhook : **branché sur le module** ;
- `event-cancellation.service.ts:472`, annulation d'événement : **branché** ;
- `event-cancellation.service.ts:680`, nouvelle tentative admin : **branché** ;
- `withdrawal.service.ts:120`, retraits : **listé seulement**, à brancher au lot 3 avec le solde, les frais et le seuil.

**Correctif** (migration `20261031000017`, `lib/payments/cashout.service.ts`).
- **Opérateur et numéro payeur** persistés à la création du paiement et repris pour le remboursement. Le contrat SamirPay ne renvoie l'opérateur ni dans le webhook ni dans le statut : on ne peut donc pas le « confirmer au webhook ». Prénom et nom viennent du compte.
- **Aucune valeur par défaut** : opérateur, numéro ou nom inconnu → envoi bloqué (`blocked_reason`) et alerte aux SUPERADMIN (notification et `audit_logs`), aucun cashout.
- **Machine à états** : A_ENVOYER → ENVOYE → CONFIRME, ou ECHOUE (refus explicite), ou INCERTAIN (délai, 5xx, réponse illisible), avec une clé unique par paiement (`REFUND-<paymentId>`).
- **Envoi réservé** par une mise à jour conditionnelle : deux envois simultanés donnent un seul appel SamirPay.
- **INCERTAIN** : jamais renvoyé automatiquement, alerte et vérification manuelle ; la nouvelle tentative admin le refuse.
- **Solde partenaire** vérifié avant l'envoi, et une fois pour un lot (annulation d'événement) ; solde insuffisant → blocage et alerte.
- **Annulation d'événement** : seuls les paiements plateforme SUCCESS rattachés aux billets (`tickets.payment_id`) sont remboursés ; les paiements espèces et les invitations sont exclus.

Nouvelle tentative admin : un envoi ECHOUE est remis à envoyer, un blocage par solde est levé, un envoi INCERTAIN est refusé.

**parcours/paiement-remboursement**

Run 27 (avant correctif) :

```text
    not ok 1 - payeur Orange Money : remboursement sur Orange Money, au numéro payeur (9 chiffres), prénom et nom
        → test did not finish before its parent and was cancelled
    not ok 2 - opérateur ou numéro inconnu : aucun cashout envoyé, remboursement en attente, alerte admin
        → test did not finish before its parent and was cancelled
    not ok 3 - deux envois simultanés pour le même remboursement : un seul cashout
        → test did not finish before its parent and was cancelled
    not ok 4 - délai dépassé simulé : INCERTAIN, aucun second envoi, alerte
        → test did not finish before its parent and was cancelled
    not ok 5 - solde partenaire insuffisant : aucun envoi, alerte
        → test did not finish before its parent and was cancelled
    not ok 6 - annulation d’événement : remboursements par le module (REFUND-<paymentId>), CASH et invitations exclus
        → test did not finish before its parent and was cancelled
    not ok 7 - code : aucun numéro de repli, aucun opérateur par défaut, un seul module d’envoi
        → test did not finish before its parent and was cancelled
not ok 1 - Remboursement automatique et module de cashout
        → Cannot find module '/home/runner/work/event-village/event-village/lib/payments/cashout.service' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
not ok 2 - /home/runner/work/event-village/event-village/tests/parcours/paiement-remboursement.test.ts
        → relation "public.stock_reservations" does not exist
# pass 0
# fail 0
```

Run 29 (après correctif) :

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

**security/r3-fonctions-rpc**

Run 27 (code non corrigé, ancienne version du test : suite adaptée dans le commit de correctif, pas un test rouge) :

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
ok 1 - R3 — RPC métier non appelables par anon / authenticated
    ok 1 - anon et authenticated : rpc(is_admin) acceptée
    ok 2 - anon et authenticated : rpc(is_superadmin) acceptée
    ok 3 - anon et authenticated : rpc(is_controller) acceptée
    ok 4 - anon et authenticated : rpc(has_role) acceptée
    ok 5 - anon et authenticated : rpc(is_partner_owner) acceptée
    ok 6 - anon et authenticated : rpc(auth_user_role) acceptée
ok 2 - R3 — aides RLS toujours appelables (sinon les politiques échouent)
# pass 26
# fail 0
```

Run 29 (après correctif) :

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

### 2.8 — Route d'émission par le staff (payment-security-15)

```text
$ git grep -n -E 'tickets/purchase|purchaseTicketAtomic' 8b9a361 -- app components hooks lib tests scripts public
8b9a361:app/api/events/[id]/tickets/purchase/route.ts:6: * POST /api/events/[id]/tickets/purchase
8b9a361:app/api/events/[id]/tickets/purchase/route.ts:27:        const purchaseResult = await EventService.purchaseTicketAtomic({
8b9a361:app/api/events/[id]/tickets/purchase/route.ts:41:        console.error('[API events/[id]/tickets/purchase POST] Error:', error);
8b9a361:lib/events/event.service.ts:1337:    public static async purchaseTicketAtomic(params: {
8b9a361:tests/legacy/partner-events-m5.test.ts:733:        // --- ÉTAPE A : Tentative d'appel direct à purchaseTicketAtomic par un CLIENT sur une catégorie payante (is_free = false) ---
8b9a361:tests/legacy/partner-events-m5.test.ts:737:            await EventService.purchaseTicketAtomic({
8b9a361:tests/legacy/partner-events-m5.test.ts:748:        assert.strictEqual(directPaidAttemptFailed, true, 'Un client appelant directement purchaseTicketAtomic pour un billet payant DOIT être rejeté');
8b9a361:tests/legacy/partner-events-m5.test.ts:758:        // --- ÉTAPE B : Appel direct à purchaseTicketAtomic par un CLIENT sur une catégorie gratuite (price = 0) ---
8b9a361:tests/legacy/partner-events-m5.test.ts:759:        const freeTicketResult = await EventService.purchaseTicketAtomic({
8b9a361:tests/legacy/partner-events-m5.test.ts:966:        const guichetTicketRes = await EventService.purchaseTicketAtomic({
8b9a361:tests/legacy/partner-events-m5.test.ts:993:        const invitationRes = await EventService.purchaseTicketAtomic({
8b9a361:tests/parcours/paiement-guichet.test.ts:3: * /api/events/[id]/tickets/purchase n'a aucun appelant dans l'interface (grep au rapport) : elle est
8b9a361:tests/parcours/paiement-guichet.test.ts:11:import { POST as purchase } from '../../app/api/events/[id]/tickets/purchase/route';
8b9a361:tests/parcours/paiement-guichet.test.ts:33:                    new NextRequest(`${BASE_URL}/api/events/${ev.eventId}/tickets/purchase`, { method: 'POST', headers: { 'content-type': 'application/json', ...bearer(s.accessToken) }, body: JSON.stringify({ categoryId: cat }) }),
(code de sortie 0)
```

**Décision.** Aucun écran ni script n'appelle cette route. Ses seuls utilisateurs sont la route elle-même et des suites legacy qui appellent le service directement. Elle est désactivée : 410 pour tous les rôles et toutes les méthodes, appel journalisé. `purchaseTicketAtomic` est supprimé. Le guichet complet (contrôleur affecté, caisse ouverte, paiement CASH rattaché à la session) est renvoyé au lot 4.

**parcours/paiement-guichet**

Run 27 (avant correctif) :

```text
    not ok 1 - SUPERADMIN : 410, aucun billet émis (payant ou gratuit)
        → SUPERADMIN : HTTP 200
        → 200 !== 410
    not ok 2 - CONTROLLER_A : 410, aucun billet émis (payant ou gratuit)
        → CONTROLLER_A : HTTP 200
        → 200 !== 410
    not ok 3 - PARTNER_A : 410, aucun billet émis (payant ou gratuit)
        → PARTNER_A : HTTP 200
        → 200 !== 410
    not ok 4 - CLIENT : 410, aucun billet émis (payant ou gratuit)
        → CLIENT : HTTP 400
        → 400 !== 410
not ok 1 - Route d’émission par le staff
not ok 2 - /home/runner/work/event-village/event-village/tests/parcours/paiement-guichet.test.ts
        → relation "public.stock_reservations" does not exist
# pass 0
# fail 4
```

Run 29 (après correctif) :

```text
    ok 1 - SUPERADMIN : 410, aucun billet émis (payant ou gratuit)
    ok 2 - CONTROLLER_A : 410, aucun billet émis (payant ou gratuit)
    ok 3 - PARTNER_A : 410, aucun billet émis (payant ou gratuit)
    ok 4 - CLIENT : 410, aucun billet émis (payant ou gratuit)
ok 1 - Route d’émission par le staff
# pass 4
# fail 0
```

### 2.9 — Réconciliation périodique

```text
$ git ls-tree -r --name-only 8b9a361 -- app/api/cron
app/api/cron/moratoriums/route.ts
app/api/cron/ticket-transfers/route.ts
(code de sortie 0)

$ git grep -n -E 'cleanupExpiredHolds\(' 8b9a361 -- app lib
8b9a361:lib/payments/payment.service.ts:983:    public async cleanupExpiredHolds(): Promise<{ cleanedCount: number; releasedTickets: number }> {
(code de sortie 0)

$ git ls-tree --name-only 8b9a361 -- vercel.json
(code de sortie 0)
```

**Correctif** (`/api/cron/payments-reconcile`, CRON_SECRET sans repli, toutes les 5 minutes, voir `docs/deploiement-projet-neuf.md` §7) :
1. purge des réservations échues ;
2. paiements PENDING plus anciens que la fenêtre d'attente (2 min) : statut SamirPay avec l'identifiant enregistré. SUCCESS déclenche la RPC ; FAILED ou CANCELLED rend le stock ; encore PENDING au-delà de 60 min, le paiement passe EXPIRED et rend le stock ;
3. succès tardifs : paiements EXPIRED ou CANCELLED sans statut final de SamirPay, créés il y a moins de 48 h, au plus un contrôle toutes les 15 min. Un succès tardif émet les billets s'il reste de la place, sinon déclenche un remboursement ;
4. initialisations interrompues, sans identifiant SamirPay : EXPIRED ;
5. confirmation des cashouts ENVOYE ; un envoi réservé puis interrompu passe INCERTAIN, avec alerte.

**parcours/paiement-reconciliation**

Run 27 (avant correctif) :

```text
    not ok 1 - sans CRON_SECRET → 401
        → test did not finish before its parent and was cancelled
    not ok 2 - SUCCESS chez SamirPay (webhook perdu) → billets émis par la RPC ; FAILED → échec et stock rendu ; CANCELLED → annulé
        → test did not finish before its parent and was cancelled
    not ok 3 - PENDING trop ancien encore PENDING chez SamirPay → EXPIRED, réservation libérée ; paiement récent ignoré
        → test did not finish before its parent and was cancelled
not ok 1 - Réconciliation
        → Cannot find module '/home/runner/work/event-village/event-village/app/api/cron/payments-reconcile/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
not ok 2 - /home/runner/work/event-village/event-village/tests/parcours/paiement-reconciliation.test.ts
        → relation "public.stock_reservations" does not exist
# pass 0
# fail 0
```

Run 29 (après correctif) :

```text
    ok 1 - sans CRON_SECRET → 401
    ok 2 - SUCCESS chez SamirPay (webhook perdu) → billets émis par la RPC ; FAILED → échec et stock rendu ; CANCELLED → annulé
    ok 3 - PENDING trop ancien encore PENDING chez SamirPay → EXPIRED, réservation libérée ; paiement récent ignoré
ok 1 - Réconciliation
# pass 3
# fail 0
```

### 2.10 — Retour de paiement côté client (client-ux-7)

```text
$ git grep -n -E 'return_url|cancel_url|returnUrl|cancelUrl' 8b9a361 -- app/api/checkout lib/payments/payment.service.ts components/payment
8b9a361:app/api/checkout/route.ts:20:  returnUrl: z.string().url().optional(),
8b9a361:app/api/checkout/route.ts:21:  cancelUrl: z.string().url().optional(),
8b9a361:app/api/checkout/route.ts:38:    const { eventId, items, operator, customerPhone, customerName, customerEmail, returnUrl, cancelUrl } = parseResult.data;
8b9a361:app/api/checkout/route.ts:226:    const defaultReturnUrl = returnUrl || `${appUrl}/tickets`;
8b9a361:app/api/checkout/route.ts:227:    const defaultCancelUrl = cancelUrl || `${appUrl}/explore`;
8b9a361:app/api/checkout/route.ts:252:        return_url: defaultReturnUrl,
8b9a361:app/api/checkout/route.ts:253:        cancel_url: defaultCancelUrl,
8b9a361:lib/payments/payment.service.ts:330:        const returnUrl = input.returnUrl || `${appUrl}/tickets`;
8b9a361:lib/payments/payment.service.ts:331:        const cancelUrl = input.cancelUrl || `${appUrl}/explore`;
8b9a361:lib/payments/payment.service.ts:357:                return_url: returnUrl,
8b9a361:lib/payments/payment.service.ts:358:                cancel_url: cancelUrl,
(code de sortie 0)

$ git grep -n -E 'Orange Money' 8b9a361 -- components/payment/PaymentModal.tsx
8b9a361:components/payment/PaymentModal.tsx:80:        setErrorMessage('Le délai de confirmation Orange Money a expiré. Vérifiez votre téléphone et réessayez.');
8b9a361:components/payment/PaymentModal.tsx:97:          setErrorMessage('Le paiement Orange Money a échoué ou a été annulé. Veuillez réessayer.');
8b9a361:components/payment/PaymentModal.tsx:153:      // ── Mobile : Deep Link immédiat (Wave OU Orange Money) ──
8b9a361:components/payment/PaymentModal.tsx:279:                  <span className="text-xs">Orange Money</span>
8b9a361:components/payment/PaymentModal.tsx:361:                Un message <span className="font-bold text-[#F44336]">Orange Money</span> a été envoyé
8b9a361:components/payment/PaymentModal.tsx:363:                Saisissez votre <span className="font-bold">code secret Orange Money</span> pour confirmer le paiement de{' '}
8b9a361:components/payment/PaymentModal.tsx:383:                Si le Push ne s&apos;affiche pas — Ouvrir Orange Money
8b9a361:components/payment/PaymentModal.tsx:414:                  {operator === 'om' ? 'Orange Money' : operator === 'wave' ? 'Wave' : 'votre application'}
8b9a361:components/payment/PaymentModal.tsx:467:                Votre paiement Orange Money de <span className="font-bold text-emerald-600">{amountFormatted}</span> a été validé.
(code de sortie 0)

$ git grep -n -E 'usePaymentStatus\(|MAX_POLL' 8b9a361 -- app components hooks
8b9a361:hooks/usePaymentStatus.ts:17:export function usePaymentStatus(transactionId: string | null): UsePaymentStatusResult {
(code de sortie 0)
```

**Correctif.** Le cashin direct n'a pas d'URL de retour dans le contrat : l'interface ouvre le lien de l'opérateur (deep link, URL ou QR) puis mène le client à `/paiement/[id]`. Cette page :
- sonde la route de statut toutes les 3 s, et se met en pause quand l'onglet est masqué ;
- affiche « En attente », « Confirmé » ou « Échoué » (avec la mention remboursé le cas échéant) ;
- montre un compte à rebours jusqu'à `expires_at`, l'échéance de la réservation ;
- propose l'annulation par le client et renvoie vers `/tickets` une fois le paiement confirmé.

Dans la modale de paiement :
- opérateur obligatoire, sans présélection silencieuse, et libellés tirés de `OPERATOR_LABELS` ;
- téléphone payeur validé et `Idempotency-Key` conservée pendant une tentative ;
- plus de délai fixe de 3 minutes.

La page événement envoie tout le panier, gratuits compris. `hooks/usePaymentStatus.ts`, sans appelant, est supprimé.

**parcours/paiement-retour**

Run 27 (avant correctif) :

```text
    not ok 1 - réponse du checkout : page de suivi /paiement/<id>, échéance ; URL du client ignorées
        → Expected values to be strictly equal:
        → + undefined
        → - '/paiement/61297941-fd42-475a-ab45-e026ad239d7c'
    not ok 2 - page /paiement/[id] : sonde la route de statut, affiche les trois états, renvoie vers le billet, permet l’annulation
        → ENOENT: no such file or directory, open 'app/paiement/[id]/page.tsx'
    not ok 3 - modale de paiement : délai aligné sur l’échéance, renvoi vers /paiement/[id], clé d’idempotence
        → plus de délai fixe de 3 minutes
not ok 1 - Retour de paiement côté client
not ok 2 - /home/runner/work/event-village/event-village/tests/parcours/paiement-retour.test.ts
        → relation "public.stock_reservations" does not exist
# pass 0
# fail 3
```

Run 29 (après correctif) :

```text
    ok 1 - réponse du checkout : page de suivi /paiement/<id>, échéance ; URL du client ignorées
    ok 2 - page /paiement/[id] : sonde la route de statut, affiche les trois états, renvoie vers le billet, permet l’annulation
    ok 3 - modale de paiement : délai aligné sur l’échéance, renvoi vers /paiement/[id], clé d’idempotence
ok 1 - Retour de paiement côté client
# pass 3
# fail 0
```

---

## 3. Schéma de signature SamirPay

**Trouvé : aucun.** La documentation officielle API Partenaires v1.0 (document confidentiel, non recopié) décrit un webhook POST `application/x-www-form-urlencoded` :
- trois champs (`transaction_id`, `order_id`, `status`), avec `status` toujours égal à `success` ;
- envoyé seulement en cas de succès, à l'URL `callBackUrl` fournie à l'initialisation ;
- qui attend un HTTP 200, sans aucune signature, en-tête d'authentification ni relance documentée.

Le dépôt n'en contenait pas d'autre : le schéma HMAC du faux adaptateur était marqué « provisoire ». `SAMIRPAY_WEBHOOK_SECRET` n'est plus lu.

**Ce que ça implique, et ce qui le compense :**
- **Le webhook ne prouve rien.** Il n'est qu'une notification. Rien n'est émis sans les quatre conditions du point 2 de « À lire en premier » : jeton du paiement, corrélation du `transaction_id`, statut SUCCESS demandé à SamirPay avec l'identifiant enregistré, et RPC transactionnelle. Un webhook forgé, même avec un `order_id` et un `transaction_id` exacts, ne produit rien tant que le paiement n'est pas réellement réglé chez SamirPay.
- **Le montant n'est pas vérifiable** : le statut ne renvoie ni montant ni opérateur. Il est garanti par l'initialisation, faite par le serveur (montant calculé depuis le panier réservé, jamais fourni par le client), et l'`orderId` unique empêche de réutiliser une transaction.
- **Pas de relance documentée** : la réponse est toujours 200 une fois l'événement enregistré, et un webhook perdu ou en erreur est rattrapé par la réconciliation (2.9), qui est donc **obligatoire**.
- **FAILED et CANCELLED** ne sont jamais notifiés : seule la réconciliation les fait connaître.
- **L'opérateur réellement utilisé** n'est pas confirmé par l'API : il faut se fier à celui choisi et transmis à l'initialisation (`operatorName`), qui est persisté.

---

## 4. Invariant global : requête SQL et sortie

Requête (`tests/helpers/payment-invariants.ts`), exécutée en lecture seule à la fin de chaque suite de paiement, avant puis après la purge des réservations échues (la fonction appelée par le cron).

- **(c) avant purge** : held = somme des réservations ACTIVE. On vérifie ainsi que le trigger tient le compteur exact.
- **(c) après purge** : held = somme des réservations ACTIVE non échues, c'est-à-dire la formulation littérale de l'invariant.

```sql
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
       format('paiement SUCCESS : %s billet(s) émis pour %s réservé(s)', coalesce(i.n, 0), coalesce(r.qty, 0)) AS detail
  FROM public.payments p
  LEFT JOIN reserved r ON r.payment_id = p.id
  LEFT JOIN issued i ON i.payment_id = p.id
 WHERE p.status = 'SUCCESS' AND p.payment_target = 'TICKET' AND p.is_platform_payment
   AND (coalesce(i.n, 0) = 0 OR coalesce(i.n, 0) <> coalesce(r.qty, 0))
UNION ALL
SELECT 'b', t.id::text, format('billet %s à %s F sans paiement SUCCESS (%s)', t.status, t.price, coalesce(p.status::text, 'aucun paiement'))
  FROM public.tickets t
  LEFT JOIN public.payments p ON p.id = t.payment_id
 WHERE t.price > 0 AND t.status IN ('VALIDE', 'UTILISE')
   AND (p.id IS NULL OR p.status <> 'SUCCESS')
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
```

Sortie brute, run 29 (toutes les suites de paiement) :

```text
# tests__parcours__paiement-confirmation.test.ts.log
[INVARIANT] paiement-confirmation — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] paiement-confirmation — purge des réservations échues : {"expired":0}
[INVARIANT] paiement-confirmation — après purge (held = réservations non échues) : 0 violation(s)
# tests__parcours__paiement-controles.test.ts.log
[INVARIANT] paiement-controles — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] paiement-controles — purge des réservations échues : {"expired":0}
[INVARIANT] paiement-controles — après purge (held = réservations non échues) : 0 violation(s)
# tests__parcours__paiement-gratuits.test.ts.log
[INVARIANT] paiement-gratuits — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] paiement-gratuits — purge des réservations échues : {"expired":0}
[INVARIANT] paiement-gratuits — après purge (held = réservations non échues) : 0 violation(s)
# tests__parcours__paiement-guichet.test.ts.log
[INVARIANT] paiement-guichet — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] paiement-guichet — purge des réservations échues : {"expired":0}
[INVARIANT] paiement-guichet — après purge (held = réservations non échues) : 0 violation(s)
# tests__parcours__paiement-operateur.test.ts.log
[INVARIANT] paiement-operateur — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] paiement-operateur — purge des réservations échues : {"expired":0}
[INVARIANT] paiement-operateur — après purge (held = réservations non échues) : 0 violation(s)
# tests__parcours__paiement-reconciliation.test.ts.log
[INVARIANT] paiement-reconciliation — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] paiement-reconciliation — purge des réservations échues : {"expired":0}
[INVARIANT] paiement-reconciliation — après purge (held = réservations non échues) : 0 violation(s)
# tests__parcours__paiement-remboursement.test.ts.log
[INVARIANT] paiement-remboursement — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] paiement-remboursement — purge des réservations échues : {"expired":0}
[INVARIANT] paiement-remboursement — après purge (held = réservations non échues) : 0 violation(s)
# tests__parcours__paiement-reservation.test.ts.log
[INVARIANT] paiement-reservation — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] paiement-reservation — purge des réservations échues : {"expired":0}
[INVARIANT] paiement-reservation — après purge (held = réservations non échues) : 0 violation(s)
# tests__parcours__paiement-retour.test.ts.log
[INVARIANT] paiement-retour — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] paiement-retour — purge des réservations échues : {"expired":0}
[INVARIANT] paiement-retour — après purge (held = réservations non échues) : 0 violation(s)
# tests__parcours__paiement-statut.test.ts.log
[INVARIANT] paiement-statut — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] paiement-statut — purge des réservations échues : {"expired":0}
[INVARIANT] paiement-statut — après purge (held = réservations non échues) : 0 violation(s)
# tests__parcours__paiement-webhook.test.ts.log
[INVARIANT] paiement-webhook — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] paiement-webhook — purge des réservations échues : {"expired":0}
[INVARIANT] paiement-webhook — après purge (held = réservations non échues) : 0 violation(s)
```

---

## 5. Suites legacy touchées

Les suites `tests/legacy/` sont en quarantaine (non exécutées par `npm test`), mais elles sont typecheckées. Le lot 2 a supprimé ou remplacé les API qu'elles appelaient, ce qui donnait 119 erreurs de typecheck dans 11 suites.

Commit `39a0a8b`, sortie brute :

```text
$ git show --format= --name-status 39a0a8b -- tests/legacy
M	tests/legacy/cdc-v3-validation-checks.test.ts
M	tests/legacy/chunk5-phase1-bugs.test.ts
M	tests/legacy/chunk5-phase2-b2c.test.ts
M	tests/legacy/client-ticket-lifecycle.test.ts
M	tests/legacy/event-cancellation-and-refunds.test.ts
D	tests/legacy/hold-cart-stock.test.ts
D	tests/legacy/late-webhook-and-treasury-preflight.test.ts
M	tests/legacy/partner-events-m5.test.ts
M	tests/legacy/ticket-pdf-and-exports.test.ts
D	tests/legacy/ticket-stock-lifecycle.test.ts
M	tests/legacy/ticketing-e2e-final.test.ts
$ git show --format= --shortstat 39a0a8b -- tests/legacy
 11 files changed, 31 insertions(+), 3098 deletions(-)
```

Après ce commit, `npx tsc --noEmit -p .` ne signale plus aucune erreur (sortie de la CI en section 6). Aucun script, workflow ni runner ne référence les trois fichiers supprimés ; seuls des rapports historiques les citent.

**Règle appliquée.**
- Un cas qui repose sur une API retirée est supprimé et remplacé, à sa place, par le commentaire `// [lot 2 — cas supprimé] <nom> : <raison> ; couvert par <suite>`.
- Les assertions des cas conservés ne sont pas modifiées.
- Seuls les imports devenus inutiles sont retirés.

### Supprimées en entier

| Suite | Justification | Remplacement |
|---|---|---|
| `hold-cart-stock` (8 cas) | Toute la suite teste la réservation applicative (`getActiveHeldQuantity`, `releaseHoldTicketsAtomic`, `reserveTicketsAtomic`, `cleanupExpiredHolds`, ancien `handleSamirPayWebhook`, `createPayment(TICKET)`), qui a été supprimée. | `paiement-reservation`, `paiement-controles` (max_per_order) |
| `ticket-stock-lifecycle` (22 cas) | 16 cas sur 22 dépendent de `reserveTicketsAtomic`, directement ou par leurs données. Des 6 restants : 7 et 15 doublonnent `ticketing-e2e-final` 1.2 et 6.1 (conservés) ; 14 et 16 sont tautologiques (UPDATE SQL direct, aucun code testé) ; 9 et 10 sont perdus (voir plus bas). | `paiement-confirmation`, `paiement-reservation`, `paiement-gratuits` |
| `late-webhook-and-treasury-preflight` (2 cas) | Le webhook tardif passait par l'ancien `handleSamirPayWebhook`. Le pré-contrôle de trésorerie de `cancelEvent` n'existe plus : le solde est vérifié par le module de cashout. Le test lisait aussi `getSolde().body/.balance`, absents du contrat. | `paiement-confirmation` (panier non honorable), `paiement-webhook`, `paiement-remboursement` (solde insuffisant, annulation d'événement) |

### Cas supprimés (le reste de la suite est conservé)

| Suite | Cas supprimés | Remplacement |
|---|---|---|
| `ticketing-e2e-final` (7) | 2.1 catégorie fermée, 3.1 trois billets distincts, 3.2 et 3.3 compostage des billets de 3.1, 4.1 cent requêtes pour un billet, 5.1 notification EVENT_FULLY_SOLD_OUT, 7.1 quantités invalides | `paiement-controles`, `paiement-confirmation`, `paiement-reservation` ; compostage toujours couvert par `client-ticket-lifecycle` (10 à 12) |
| `client-ticket-lifecycle` (6) | 1 achat payant par l'ancien webhook, 2 et 3 (données du 1), 8 idempotence du webhook, 9 (assertion dépendant du 1), 18 surbooking par `createPayment(TICKET)` | `paiement-confirmation`, `paiement-webhook`, `paiement-reservation` |
| `partner-events-m5` (3) | 3 anti-survente par deux paiements, 5 anti-billet gratuit (`purchaseTicketAtomic`), 6 guichet du contrôleur | `paiement-reservation`, `paiement-gratuits`, `paiement-guichet` |
| `chunk5-phase1-bugs` (3) | BUG 1 `processRefund`, BUG 2 webhook d'abonnement, BUG 4 webhook hors ordre (salle, table) | `paiement-remboursement`, `paiement-webhook`, `paiement-reconciliation` |
| `ticket-pdf-and-exports` (2) | TEST 9 webhook répété, TEST 10 réservation du panier | `paiement-webhook`, `paiement-confirmation`, `paiement-reservation` |
| `cdc-v3-validation-checks` (1) | cas 6 `processRefund` | `paiement-remboursement` |
| `event-cancellation-and-refunds` (1) | cas 8 `reserveTicketsAtomic` sur un événement annulé | `paiement-controles` (EVENT_NOT_PUBLISHED) |

**Réécrits a minima (assertions inchangées) :**
- `cdc-v3-validation-checks`, cas 4 : `customerPhone` devient `payerPhone` dans l'appel `createPayment(ORDER)` ; le refus testé est levé avant la lecture du téléphone.
- `chunk5-phase2-b2c` : mock SamirPay aligné sur le contrat (`getSolde` → `{ solde, entityName }`, `sendCashout` → `{ transactionId, status }`).

### Ce que la remise en état a révélé

1. **Notifications « catégorie épuisée » et « événement complet »** : leur seul appelant était `reserveTicketsAtomic`, supprimé. **Corrigé dans le lot** : `lib/payments/stock-notifications.ts`, appelé après la confirmation, le claim-free et le panier gratuit.
2. **Annulation d'une salle ou d'une table** en cas d'échec du paiement : la nouvelle libération ne repassait pas la réservation à `ANNULEE`, contrairement à l'ancien BUG 4. **Corrigé dans le lot** (`releaseOther`, `confirmation.service.ts`). Ce chemin reste sans test (point ouvert 3).
3. **Remboursement partiel d'une commande** (`processRefund`) : supprimé, il n'avait aucun appelant (point ouvert 5).
4. **Cas conservés dont l'assertion est devenue fausse**, non modifiés conformément à la règle (point ouvert 8) :
   - `event-cancellation-and-refunds`, cas 4 et 5 : ils attendent la clé `REFUND-PMT-<id>`, alors que le module utilise `REFUND-<paymentId>` ;
   - `chunk5-phase2-b2c` : il attend `+221771234567`, alors que le retrait envoie 9 chiffres.
5. **`checkout-mixed-cart`** (non touché, il passe le typecheck) : son corps de requête n'a ni `payerPhone` ni `Idempotency-Key`, et il attend des billets gratuits émis sans paiement confirmé, ce que `paiement-gratuits` interdit. Il est obsolète sur le fond.
6. **Couverture perdue sans équivalent** : `isFullySoldOut` et `hasAvailableTickets` de `GET /api/events/[id]` (anciens `ticket-stock-lifecycle` 9 et 10), ainsi que le statut CLOSED de la même route. Ces cas sont partis avec leur suite ; ils sont à reprendre dans un test de parcours.

---

## 6. Sortie brute de `npm run verify` et CI

Run de référence : **https://github.com/fallouu-mn/event-village/actions/runs/41232067280** (run 29, commit `cefb73a`). Sortie complète : `docs/lot2-logs/ci-run29-verify.log` ; run rouge de référence : `docs/lot2-logs/ci-run27-verify.log`.

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

[run-tests] 62 suite(s) — garde-fou : tests/helpers/env.ts — délai/suite : 600.0s
[… 3621 lignes de sortie des suites, intégralement dans docs/lot2-logs/ci-run29-verify.log …]
═══════════════════ RÉCAPITULATIF ═══════════════════
Suite                                           Statut   Durée     Code  Journal
tests/auth-rbac.test.ts                         PASS     239ms     0     .test-logs/tests__auth-rbac.test.ts.log
tests/e2e-scenarios.test.ts                     PASS     470ms     0     .test-logs/tests__e2e-scenarios.test.ts.log
tests/fondations-lot0.test.ts                   PASS     392ms     0     .test-logs/tests__fondations-lot0.test.ts.log
tests/notifications-and-documents.test.ts       PASS     175ms     0     .test-logs/tests__notifications-and-documents.test.ts.log
tests/parcours/achat-serveur.test.ts            PASS     618ms     0     .test-logs/tests__parcours__achat-serveur.test.ts.log
tests/parcours/anonymisation-debogage.test.ts   PASS     668ms     0     .test-logs/tests__parcours__anonymisation-debogage.test.ts.log
tests/parcours/attribution-roles.test.ts        PASS     1.1s      0     .test-logs/tests__parcours__attribution-roles.test.ts.log
tests/parcours/bootstrap-superadmin.test.ts     PASS     514ms     0     .test-logs/tests__parcours__bootstrap-superadmin.test.ts.log
tests/parcours/changement-role-admin.test.ts    PASS     833ms     0     .test-logs/tests__parcours__changement-role-admin.test.ts.log
tests/parcours/documents-inscription.test.ts    PASS     1.6s      0     .test-logs/tests__parcours__documents-inscription.test.ts.log
tests/parcours/email-optionnel.test.ts          PASS     791ms     0     .test-logs/tests__parcours__email-optionnel.test.ts.log
tests/parcours/filtres-postgrest.test.ts        PASS     443ms     0     .test-logs/tests__parcours__filtres-postgrest.test.ts.log
tests/parcours/invitation-identite.test.ts      PASS     1.3s      0     .test-logs/tests__parcours__invitation-identite.test.ts.log
tests/parcours/otp-hachage.test.ts              PASS     410ms     0     .test-logs/tests__parcours__otp-hachage.test.ts.log
tests/parcours/otp-serveur.test.ts              PASS     836ms     0     .test-logs/tests__parcours__otp-serveur.test.ts.log
tests/parcours/paiement-confirmation.test.ts    PASS     1.5s      0     .test-logs/tests__parcours__paiement-confirmation.test.ts.log
tests/parcours/paiement-controles.test.ts       PASS     1.8s      0     .test-logs/tests__parcours__paiement-controles.test.ts.log
tests/parcours/paiement-gratuits.test.ts        PASS     1.2s      0     .test-logs/tests__parcours__paiement-gratuits.test.ts.log
tests/parcours/paiement-guichet.test.ts         PASS     690ms     0     .test-logs/tests__parcours__paiement-guichet.test.ts.log
tests/parcours/paiement-operateur.test.ts       PASS     773ms     0     .test-logs/tests__parcours__paiement-operateur.test.ts.log
tests/parcours/paiement-reconciliation.test.ts  PASS     1.3s      0     .test-logs/tests__parcours__paiement-reconciliation.test.ts.log
tests/parcours/paiement-remboursement.test.ts   PASS     1.7s      0     .test-logs/tests__parcours__paiement-remboursement.test.ts.log
tests/parcours/paiement-reservation.test.ts     PASS     1.9s      0     .test-logs/tests__parcours__paiement-reservation.test.ts.log
tests/parcours/paiement-retour.test.ts          PASS     600ms     0     .test-logs/tests__parcours__paiement-retour.test.ts.log
tests/parcours/paiement-statut.test.ts          PASS     1.1s      0     .test-logs/tests__parcours__paiement-statut.test.ts.log
tests/parcours/paiement-webhook.test.ts         PASS     2.0s      0     .test-logs/tests__parcours__paiement-webhook.test.ts.log
tests/parcours/pin-regisseur.test.ts            PASS     388ms     0     .test-logs/tests__parcours__pin-regisseur.test.ts.log
tests/parcours/realtime-scanner.test.ts         PASS     16.2s     0     .test-logs/tests__parcours__realtime-scanner.test.ts.log
tests/parcours/revocation-sessions.test.ts      PASS     1.6s      0     .test-logs/tests__parcours__revocation-sessions.test.ts.log
tests/parcours/roles-fraicheur.test.ts          PASS     841ms     0     .test-logs/tests__parcours__roles-fraicheur.test.ts.log
tests/parcours/roles-metadonnees.test.ts        PASS     550ms     0     .test-logs/tests__parcours__roles-metadonnees.test.ts.log
tests/parcours/sms-anti-abus.test.ts            PASS     526ms     0     .test-logs/tests__parcours__sms-anti-abus.test.ts.log
tests/parcours/statut-compte.test.ts            PASS     2.1s      0     .test-logs/tests__parcours__statut-compte.test.ts.log
tests/partner-auth-complete.test.ts             PASS     393ms     0     .test-logs/tests__partner-auth-complete.test.ts.log
tests/partner-halls-m7.test.ts                  PASS     1.1s      0     .test-logs/tests__partner-halls-m7.test.ts.log
tests/partner-orders-m9.test.ts                 PASS     1.2s      0     .test-logs/tests__partner-orders-m9.test.ts.log
tests/payment.test.ts                           PASS     188ms     0     .test-logs/tests__payment.test.ts.log
tests/roles-isolation.test.ts                   PASS     199ms     0     .test-logs/tests__roles-isolation.test.ts.log
tests/samirpay-contrat.test.ts                  PASS     3.7s      0     .test-logs/tests__samirpay-contrat.test.ts.log
tests/scanner-combat-ui.test.ts                 PASS     323ms     0     .test-logs/tests__scanner-combat-ui.test.ts.log
tests/scanner-wolof-audio.test.ts               PASS     342ms     0     .test-logs/tests__scanner-wolof-audio.test.ts.log
tests/schema/fonctions-privileges.test.ts       PASS     252ms     0     .test-logs/tests__schema__fonctions-privileges.test.ts.log
tests/schema/hotfix-identique.test.ts           PASS     190ms     0     .test-logs/tests__schema__hotfix-identique.test.ts.log
tests/schema/hotfix-scripts.test.ts             PASS     356ms     0     .test-logs/tests__schema__hotfix-scripts.test.ts.log
tests/schema/reset-test-password.test.ts        PASS     209ms     0     .test-logs/tests__schema__reset-test-password.test.ts.log
tests/schema/rls-toutes-tables.test.ts          PASS     226ms     0     .test-logs/tests__schema__rls-toutes-tables.test.ts.log
tests/schema/secrets-codes-en-dur.test.ts       PASS     236ms     0     .test-logs/tests__schema__secrets-codes-en-dur.test.ts.log
tests/security/anon-uniquement.test.ts          PASS     183ms     0     .test-logs/tests__security__anon-uniquement.test.ts.log
tests/security/r1-inscription-roles.test.ts     PASS     1.2s      0     .test-logs/tests__security__r1-inscription-roles.test.ts.log
tests/security/r10-user-roles.test.ts           PASS     573ms     0     .test-logs/tests__security__r10-user-roles.test.ts.log
tests/security/r11-storage-documents.test.ts    PASS     568ms     0     .test-logs/tests__security__r11-storage-documents.test.ts.log
tests/security/r2-otp-codes.test.ts             PASS     386ms     0     .test-logs/tests__security__r2-otp-codes.test.ts.log
tests/security/r3-fonctions-rpc.test.ts         PASS     511ms     0     .test-logs/tests__security__r3-fonctions-rpc.test.ts.log
tests/security/r4-ecritures-directes.test.ts    PASS     470ms     0     .test-logs/tests__security__r4-ecritures-directes.test.ts.log
tests/security/r5-lectures-anon.test.ts         PASS     441ms     0     .test-logs/tests__security__r5-lectures-anon.test.ts.log
tests/security/r6-roles-jeton.test.ts           PASS     607ms     0     .test-logs/tests__security__r6-roles-jeton.test.ts.log
tests/security/r7-profil-colonnes.test.ts       PASS     719ms     0     .test-logs/tests__security__r7-profil-colonnes.test.ts.log
tests/security/r8-controleur-lectures.test.ts   PASS     472ms     0     .test-logs/tests__security__r8-controleur-lectures.test.ts.log
tests/security/r9-partenaire-ecritures.test.ts  PASS     444ms     0     .test-logs/tests__security__r9-partenaire-ecritures.test.ts.log
tests/sms-formatage.test.ts                     PASS     282ms     0     .test-logs/tests__sms-formatage.test.ts.log
tests/superadmin-complete.test.ts               PASS     334ms     0     .test-logs/tests__superadmin-complete.test.ts.log
tests/ux-performance-and-double-click.test.ts   PASS     674ms     0     .test-logs/tests__ux-performance-and-double-click.test.ts.log
──────────────────────────────────────────────────────
TOTAL : 62 suite(s) — 62 réussie(s), 0 en échec, 0 expirée(s)

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
   Generating static pages (0/52) ...
[getServerSessionUser] Erreur session: B [Error]: Dynamic server usage: Route /api/partner/orders couldn't be rendered statically because it used `request.headers`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error
    at V (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:21778)
    at Object.get (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:29465)
    at o (/home/runner/work/event-village/event-village/.next/server/chunks/8272.js:1:11124)
    at d (/home/runner/work/event-village/event-village/.next/server/chunks/3138.js:1:1837)
    at l (/home/runner/work/event-village/event-village/.next/server/chunks/3138.js:1:1362)
    at c (/home/runner/work/event-village/event-village/.next/server/app/api/partner/orders/route.js:1:568)
    at /home/runner/work/event-village/event-village/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:38417
    at /home/runner/work/event-village/event-village/node_modules/next/dist/server/lib/trace/tracer.js:140:36
    at NoopContextManager.with (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:7062)
    at ContextAPI.with (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:518) {
  description: "Route /api/partner/orders couldn't be rendered statically because it used `request.headers`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error",
  digest: 'DYNAMIC_SERVER_USAGE'
}
   Generating static pages (13/52) 
   Generating static pages (26/52) 
   Generating static pages (39/52) 
 ✓ Generating static pages (52/52)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                             Size     First Load JS
┌ ○ /                                                   6.45 kB         119 kB
├ ○ /_not-found                                         177 B          87.8 kB
├ ○ /admin                                              177 B          87.8 kB
├ ○ /admin/audit                                        4.53 kB         108 kB
├ ○ /admin/communications                               5.56 kB         109 kB
├ ○ /admin/dashboard                                    13.1 kB         117 kB
├ ○ /admin/finance                                      4.02 kB         108 kB
├ ○ /admin/pricing                                      5.2 kB          109 kB
├ ○ /admin/referral                                     6.81 kB         110 kB
├ ○ /admin/services                                     5.96 kB         110 kB
├ ○ /admin/users                                        25.2 kB         142 kB
├ ƒ /api/admin/audit                                    0 B                0 B
├ ƒ /api/admin/communications                           0 B                0 B
├ ƒ /api/admin/events/[id]/cancel                       0 B                0 B
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
├ ƒ /api/cron/stock-reservations                        0 B                0 B
├ ƒ /api/cron/ticket-transfers                          0 B                0 B
├ ƒ /api/events                                         0 B                0 B
├ ƒ /api/events/[id]                                    0 B                0 B
├ ƒ /api/events/[id]/tickets/purchase                   0 B                0 B
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
├ ƒ /api/withdrawals/request                            0 B                0 B
├ ○ /controller/profile                                 5.94 kB         110 kB
├ ○ /controller/scanner                                 14.8 kB         196 kB
├ ○ /controller/setup                                   4.59 kB         168 kB
├ ƒ /events/[id]                                        9.64 kB         199 kB
├ ○ /explore                                            3.94 kB         116 kB
├ ○ /forgot-password                                    8.87 kB         194 kB
├ ○ /halls                                              5.26 kB         114 kB
├ ƒ /halls/[id]                                         5.72 kB         195 kB
├ ○ /login                                              10.4 kB         196 kB
├ ○ /notifications                                      5.93 kB         178 kB
├ ○ /orders                                             6.04 kB         178 kB
├ ƒ /paiement/[id]                                      9.1 kB          237 kB
├ ○ /partner                                            177 B          87.8 kB
├ ○ /partner/calendar                                   4.53 kB         108 kB
├ ○ /partner/dashboard                                  13.4 kB         186 kB
├ ○ /partner/events                                     6.85 kB         122 kB
├ ƒ /partner/events/[id]/caisse                         6.97 kB         115 kB
├ ƒ /partner/events/[id]/edit                           6.66 kB         128 kB
├ ƒ /partner/events/[id]/team                           5.03 kB         182 kB
├ ○ /partner/events/new                                 9.57 kB         131 kB
├ ○ /partner/finance                                    4.84 kB         198 kB
├ ○ /partner/halls                                      3.73 kB         119 kB
├ ƒ /partner/halls/[id]/edit                            4.74 kB         126 kB
├ ○ /partner/halls/new                                  4.23 kB         126 kB
├ ○ /partner/orders                                     4.53 kB         185 kB
├ ○ /partner/products                                   3.01 kB         118 kB
├ ○ /partner/products/new                               3.89 kB         125 kB
├ ○ /partner/profile                                    4.34 kB        99.2 kB
├ ○ /partner/register                                   9.53 kB         126 kB
├ ○ /partner/scan                                       4.93 kB         113 kB
├ ○ /partner/stats                                      5.5 kB          100 kB
├ ○ /partner/subscription                               5.8 kB          109 kB
├ ○ /partner/tables                                     5.38 kB         120 kB
├ ○ /partner/team                                       9.35 kB         187 kB
├ ○ /profile                                            6.95 kB         179 kB
├ ○ /register                                           9.09 kB         194 kB
├ ○ /reset-password                                     7.65 kB         180 kB
├ ƒ /restaurants/[id]/menu                              4.85 kB         194 kB
├ ƒ /restaurants/[id]/tables                            5.21 kB         194 kB
├ ○ /scan                                               177 B          87.8 kB
├ ○ /tickets                                            9.77 kB         239 kB
├ ƒ /tickets/claim/[token]                              4.58 kB         227 kB
└ ○ /wallet                                             8.57 kB         172 kB
+ First Load JS shared by all                           87.6 kB
  ├ chunks/2117-488d789e9004e22c.js                     31.9 kB
  ├ chunks/fd9d1056-270721ac51469ce4.js                 53.6 kB
  └ other shared chunks (total)                         2.1 kB


ƒ Middleware                                            87.6 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand


[verify] OK — 4 étapes réussies en 126s.
```

| Run | Commit | Résultat | Rôle |
|---|---|---|---|
| [26 · 41224375672](https://github.com/fallouu-mn/event-village/actions/runs/41224375672) | de21990 | succès | rapport du lot 1C, point de départ du lot 2 : 49 suites vertes sur 49 |
| [27 · 41228246303](https://github.com/fallouu-mn/event-village/actions/runs/41228246303) | 8b9a361 | échec attendu | **référence « avant »** : tests du lot dans leur version finale, sans aucun correctif. 13 suites en échec sur 62, exactement les 13 nouvelles suites du lot. Les 49 autres sont vertes |
| [28 · 41231666621](https://github.com/fallouu-mn/event-village/actions/runs/41231666621) | 39a0a8b | échec | correctifs 2.0 à 2.10 et suites legacy, migrations 12 à 18 appliquées sans erreur. 59 suites sur 62. Échecs : `paiement-statut` (contrôle statique : un commentaire de la route citait « .or() ») ; `paiement-reservation` (helper de test : l'acheteur refusé recevait le paiement du gagnant) ; `paiement-remboursement` (scénario de test incomplet : le succès SamirPay du premier paiement manquait) |
| [29 · 41232067280](https://github.com/fallouu-mn/event-village/actions/runs/41232067280) | cefb73a | succès | **référence « après »** : 62 suites vertes sur 62. Commentaire reformulé (`83f184b`) et deux tests corrigés (`cefb73a`, signalés en section 1) |

---

## 7. Points ouverts

1. **Webhook d'une initialisation dont la réponse a été perdue** : SamirPay a peut-être créé la transaction, mais notre serveur n'a jamais reçu son identifiant (délai dépassé). Le paiement est passé FAILED. Un webhook ultérieur est enregistré et rejeté (`REJECTED_CORRELATION`, aucun identifiant enregistré), sans émission automatique. Si le client a payé, un traitement manuel est nécessaire. À automatiser avec SamirPay : recherche d'une transaction par `orderId`, absente du contrat.
2. **Retraits** (`WithdrawalService`) : toujours hors du module de cashout. Un délai dépassé est classé REJECTED et le solde est libéré, d'où un double versement possible. À brancher au lot 3, avec le solde, les frais et le seuil.
3. **Cibles hors billetterie** (commande, salle, table, abonnement) : la confirmation et la libération passent par le nouveau chemin (transition conditionnelle, effets métier repris de l'ancien webhook, réservation repassée ANNULEE en cas d'échec), mais **aucun test** ne les couvre. Elles n'ont ni clé d'idempotence ni contrôle avant débit propres.
4. **Panier entièrement gratuit** : pas de clé d'idempotence côté serveur (`free_tickets_claim`). Une double soumission est bornée par la limite par compte et par catégorie, mais elle n'est pas dédoublonnée.
5. **Remboursement partenaire d'un billet** (`EventService.refundTicket`) : marque le billet REMBOURSE et crée une ligne `refunds` PROCESSED **sans aucun versement**. Il n'y a plus de remboursement partiel (`processRefund` supprimé, sans appelant). À reprendre avec le module de cashout (clé par billet) au lot 3.
6. **Liens Wave et Orange Money** (deep links, QR) : non vérifiés sur de vrais téléphones iOS et Android ; interface non testée en navigateur.
7. **Statut de cashout** : le contrat ne dit pas si l'endpoint de statut couvre les cashouts. La confirmation des envois ENVOYE l'utilise ; si SamirPay répond 404, l'envoi reste ENVOYE et doit être vérifié à la main.
8. **Suites legacy** : certains cas conservés ont des assertions devenues fausses (clé `REFUND-PMT-<id>` dans `event-cancellation-and-refunds`, téléphone +221 dans `chunk5-phase2-b2c`), et `checkout-mixed-cart` est obsolète sur le fond. Elles ne sont pas exécutées ; à réécrire avec les fixtures lors de leur sortie de quarantaine.
9. **Fenêtres et quotas** : valeurs par défaut prudentes (réservation de 15 min, 10 checkouts par 15 min et par compte, expiration à 60 min, succès tardifs pendant 48 h), à valider avec le client.
10. **Modèle financier** : inchangé (lot 3). La confirmation lit les montants sur le paiement et les réservations ; seul le calcul en amont (`lib/payments/fees.ts`) changera.

Le lot 3 n'a pas été commencé.
