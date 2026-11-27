# Lot « Avis » — phase 1 : inventaire de tous les avis et des mots techniques

Branche `etat/avis`, partie de `origin/main` à `2a65f5e55` (27/11/2026). Lecture seule : aucune migration, aucun code
modifié, aucun test, aucun build, aucun run de CI, aucun appel au projet distant, `.env.local` et `.private/` non lus.

Annexe : [`docs/avis-inventaire-annexe.md`](avis-inventaire-annexe.md), les 187 types un par un (destinataire, canaux,
règle de nuit, lien, titre de la cloche, longueur du SMS au pire cas, classement, manque) puis le texte complet de chaque
cloche et de chaque SMS. Tous ces textes sont le **rendu réel** du catalogue : un script hors dépôt (dossier temporaire de
la session) a chargé `lib/notifications/catalog.ts` tel quel et mesuré chaque SMS avec `smsSegments` (même fonction que
l'envoi). Aucun texte n'est recopié à la main.

---

## À lire en premier

**La règle du 27/11, rappelée.** Étape importante (argent, billet, code, commande, changement d'un événement ou d'une
réservation, action attendue, sécurité du compte) : SMS, email (si l'adresse est vérifiée), cloche et notification du
téléphone. Petite étape (avancement, information sans action) : cloche et notification du téléphone. Codes de connexion :
SMS seulement. Code de remise d'une commande : SMS et écran de la commande seulement. Jamais le numéro, l'adresse ou le
nom complet d'une personne dans un avis envoyé à une autre. SMS en un segment. Nuit de 1 h à 7 h : reporté à 7 h sauf
urgence ou événement / réservation à moins de 12 h.

**Ce qui existe.**

| | Nombre |
|---|---|
| Types d'avis au catalogue (identiques au registre `notification_types`) | **187** |
| … envoyés par la boîte d'envoi | 175 |
| … envoyés tout de suite, sans boîte d'envoi (codes, liens d'activation, email de vérification) | 12 |
| Avis avec cloche / SMS / email / notification du téléphone (sur 175) | 164 / 137 / 168 / 147 |
| Avis sur les quatre canaux | 125 |
| Avis que la personne peut couper dans ses préférences (rappels, ventes, résumés, merci) | 14 |
| Avis reportés la nuit (sauf événement ou réservation à moins de 12 h) / envoyés la nuit (urgents) | 52 / 123 |
| SMS de plus d'un segment au pire cas | **0** (dont 6 à 160 caractères pile, voir C3) |
| Étapes parcourues, module par module (§ 2) | **132** |

**Ce qui manque ou ne respecte pas la règle : 43 écarts.**

| Gravité | Nombre | En deux mots |
|---|---|---|
| Élevée | 4 | Le titulaire d'une table qui a donné toutes ses places n'apprend ni le report, ni la suspension, ni la clôture de l'événement (alors qu'un remboursement lui est ouvert) ; un retrait demandé ne donne aucun accusé (sécurité) ; un message d'erreur anglais du navigateur s'affiche sur la carte « notifications du téléphone » ; l'export comptable des organisatrices montre des codes (`EN_LIGNE`, `VALIDE`) |
| Moyenne | 18 | Étapes importantes sans SMS (billet reçu, abonnement payé, invitation d'un livreur, alertes d'argent des administrateurs) ou sans cloche (numéro changé, email ajouté, échecs de connexion) ; nom complet d'un contrôleur envoyé à l'organisatrice ; suspension d'un événement que le détenteur peut couper ; parrainage sans aucun avis ; paiement échoué sans avis (à décider) |
| Faible | 21 | Petites étapes sans notification du téléphone (surtout côté administration) ou sans aucun avis (réponse d'un livreur, écart de caisse validé…) ; refus d'API rédigés avec des mots de développeur (« Payload JSON invalide », « ID événement ») |

Le détail est au § 3 (avis) et au § 4 (mots techniques). Aucun avis n'est à enlever.

**Ce qui va bien.** Aucun code n'est envoyé par email ni par notification ; le code de remise d'une commande part par
SMS seul ; tous les SMS tiennent en un segment même avec un titre de 110 caractères, des montants de 9 999 999 F et la
date la plus longue ; les salles, les tables de restaurant et les commandes côté client suivent déjà la règle ; un
garde-fou des mots techniques existe pour les écrans et les avis (`tests/schema/design1b-mots.test.ts`).

**Décisions attendues de Fallou et du client (§ 5).** D1 paiement échoué : avis ou pas ; D2 parrainage : avis en V1 ou
pas ; D3 nom des contrôleurs : prénom et initiale à la place du nom complet ; D4 alertes de plafond SMS : sans SMS (le SMS
lui-même serait bloqué) ; D5 rappels de table : rester désactivables ou non ; D6 nom de SamirPay montré aux clients.

---

## 1. Comment les avis partent aujourd'hui (rappel utile pour la suite)

- **Une seule source des textes** : `lib/notifications/catalog.ts` (titre et texte de la cloche, SMS, email, lien). Le
  registre SQL `notification_types` porte les mêmes attributs ; le test `notif-modeles` impose l'égalité des deux listes.
- **Mise en file** : `notif_enqueue` (dernière définition `20261111000004_lot9quater_email.sql:156`) crée une ligne par
  canal du registre. Un émetteur peut **restreindre** les canaux (`channels`) ou en marquer un sauté (`skip`) : c'est le
  cas pour les lignes « numéro seul » (SMS sans compte : invitation, transfert, annulation au guichet) et pour quelques
  avis de compte (`PHONE_CHANGED`, `ADMIN_PHONE_*`). Ajouter un canal au registre ne suffit donc pas pour ces émetteurs :
  il faut recopier la fonction (voir § 6).
- **Canaux réellement servis** : l'email ne part que vers l'adresse **vérifiée** du compte (`EMAIL_NOT_VERIFIED` sinon) et
  seulement si la clé Resend est posée ; la notification du téléphone ne part que vers un appareil abonné et si les clés
  VAPID sont posées ; un avis de la famille facultative peut être coupé par la personne. La configuration de production
  n'a pas été lue (`.env.local` interdit) : l'état réel de Resend et du push est à confirmer par Fallou.
- **Nuit** : réglages `notif.sms_quiet_start = 1`, `notif.sms_quiet_end = 7` (finition 4). Seuls le SMS et la notification
  d'un type `DEFER` sont reportés ; la cloche et l'email partent tout de suite. Exception « moins de 12 h » :
  `notif_event_soon` (dernière définition `20261129000004_l11b_avis.sql:80`) couvre l'événement de l'avis, les événements
  d'une invitation de contrôleur, la réservation de table et la réservation de salle — **pas les commandes** (sans effet
  aujourd'hui : aucun avis de commande en cours n'est `DEFER`, voir écart B15).
- **Plafonds** : au plus 2 SMS d'avis par détenteur et par événement dans une heure glissante (`event_change_notify`) ;
  budget quotidien des SMS facultatifs ; SMS regroupés pour les ventes (30 min) et les administrateurs (`ADMIN_REVIEW_SMS`).
- **Code mort** : `public.event_notify` (lot 5) écrit encore directement dans la cloche, mais plus aucune fonction à jour
  ne l'appelle.

## 2. Parcours étape par étape

Légende : **I** = importante, **P** = petite ; « 4 canaux » = SMS, email, cloche et notification ; ✓ = conforme. Le nom
technique du type est entre parenthèses pour la relecture ; le tableau complet est dans l'annexe.

### 2.1 Compte (12 étapes)

| Étape | Ce que reçoit chaque personne aujourd'hui | Cl. | Écart |
|---|---|---|---|
| Inscription : code | SMS du code (`OTP_REGISTER`) | I | ✓ (code : SMS seul) |
| Inscription réussie | rien | P | A10 |
| Connexion par code | SMS du code (`OTP_LOGIN`, `OTP_AUTH_HOOK`) | I | ✓ |
| 10 échecs de mot de passe dans la journée | SMS et email (`ACCOUNT_LOGIN_FAILURES`) | I | B4 : ni cloche ni notification |
| Mot de passe oublié | SMS du code, ou email avec un lien (adresse vérifiée) | I | ✓ (lien, pas un code ; à confirmer D7) |
| Mot de passe changé | 4 canaux (`PASSWORD_CHANGED`) | I | ✓ |
| Changement de numéro | code au nouveau numéro ; SMS à l'ancien et email (`PHONE_CHANGED`) ; expéditeurs d'un transfert en attente prévenus (`TRANSFER_RECIPIENT_CHANGED`) | I | B2 : ni cloche ni notification |
| Adresse email ajoutée | email de vérification (lien) ; puis SMS et email (`EMAIL_ADDED`) ; email à l'ancienne adresse ; autres comptes qui attendaient la même adresse : 4 canaux (`EMAIL_CLAIMED_ELSEWHERE`) | I | B3 : `EMAIL_ADDED` sans cloche ni notification |
| Compte créé par un administrateur | SMS avec le lien d'activation (`ACCOUNT_ACTIVATION`) | I | ✓ |
| Compte suspendu | 4 canaux (`ACCOUNT_SUSPENDED`) | I | ✓ |
| Compte réactivé | 4 canaux (`ACCOUNT_REACTIVATED`) | I | ✓ |
| Compte anonymisé par un administrateur | rien | — | question D8 (plus aucun moyen de joindre la personne après coup) |

### 2.2 Partenaire : dossier et abonnement (9 étapes)

| Étape | Ce que reçoit chaque personne aujourd'hui | Cl. | Écart |
|---|---|---|---|
| Dossier déposé | partenaire : 4 canaux (`PARTNER_REGISTERED_ACK`) ; administrateurs : cloche, notification, email (`ADMIN_PARTNER_REGISTERED`) et SMS regroupé (`ADMIN_REVIEW_SMS`) | I | ✓ |
| Dossier complété après un refus | administrateurs : idem (`ADMIN_PARTNER_RESUBMITTED`) ; partenaire : rien | P | A5 |
| Dossier validé | 4 canaux (`PARTNER_VALIDATED`) ; essai : cloche, email, notification (`TRIAL_STARTED`) | I | ✓ |
| Dossier refusé | 4 canaux (`PARTNER_REJECTED`) | I | ✓ |
| Partenaire suspendue | 4 canaux (`PARTNER_SUSPENDED`) | I | ✓ |
| Partenaire réactivée | 4 canaux (`PARTNER_REACTIVATED`) | I | ✓ |
| Abonnement payé | cloche, email, notification (`PAYMENT_SUCCESS`) et cloche, email, notification (`SUBSCRIPTION_ACTIVATED`) | I | B5 : aucun SMS |
| Mise en avant payée, décidée | paiement : idem `PAYMENT_SUCCESS` ; décision : 4 canaux (`PROMOTION_DECIDED`) | I | B5 (SMS du paiement) |
| Fin de l'essai, abonnement qui expire | aucun traitement trouvé : rien n'expire aujourd'hui | — | aucun écart tant que rien n'expire |

### 2.3 Événements (16 étapes)

| Étape | Ce que reçoit chaque personne aujourd'hui | Cl. | Écart |
|---|---|---|---|
| Soumission | organisatrice : cloche, email, notification (`EVENT_SUBMITTED_ACK`) ; administrateurs : cloche, notification, email (`ADMIN_EVENT_SUBMITTED`) et SMS regroupé | P / I | ✓ |
| Validation | 4 canaux (`EVENT_VALIDATED`) | I | ✓ |
| Publication par un administrateur | organisatrice : 4 canaux (`EVENT_PUBLISHED_BY_ADMIN`) ; administrateurs : cloche et email (`ADMIN_EVENT_PUBLISHED`) | I / P | B11 : administrateurs sans notification |
| Refus | 4 canaux (`EVENT_REJECTED`) | I | ✓ |
| Modification (titre, lieu, date, prix…) | détenteurs : cloche, notification, email, SMS si date ou lieu (`EVENT_CHANGED`) ; contrôleurs (`CONTROLLER_EVENT_CHANGED`) ; administrateurs : cloche et email (`ADMIN_EVENT_CHANGED`) | I | B11 ; **A1** |
| Report de plus de 24 h | idem, avec remboursement ouvert ; **titulaire d'une table sans billet : rien** | I | **A1 (élevée)** |
| Annulation | détenteurs et payeurs : 4 canaux (`EVENT_CANCELLED`, le titulaire d'une table est payeur : il le reçoit) ; organisatrice si un administrateur annule (`EVENT_CANCELLED_BY_ADMIN`) ; contrôleurs ; administrateurs : cloche et email (`ADMIN_EVENT_CANCELLED`) | I | B11 |
| Suspension | organisatrice : 4 canaux (`EVENT_SUSPENDED`) ; détenteurs : 4 canaux mais **désactivable** (`EVENT_SUSPENDED_HOLDER`) ; contrôleurs (`CONTROLLER_EVENT_STATUS`) ; administrateurs : cloche et email (`ADMIN_EVENT_WITHDRAWN`) ; titulaire de table sans billet : rien | I | B13, B11, **A1** |
| Réactivation | organisatrice : 4 canaux ; détenteurs : 4 canaux, désactivable (`EVENT_REACTIVATED_HOLDER`) ; contrôleurs | I / P | ✓ |
| Clôture par un administrateur | organisatrice : 4 canaux (`EVENT_CLOSED_BY_ADMIN`) ; détenteurs : 4 canaux (`EVENT_CLOSED_HOLDER`) ; titulaire de table sans billet : rien | I | **A1** |
| Fin de l'événement | organisatrice : cloche, email, notification (`EVENT_FINISHED`, `CLOSING_REPORT_READY`) ; caisses encore ouvertes : 4 canaux (`SHIFT_OPEN_AT_END`) ; spectateurs : merci du lendemain (`ENTRY_THANKS`) | P | ✓ |
| Recettes disponibles | 4 canaux (`FUNDS_AVAILABLE`) | I | ✓ |
| Remboursements de l'annulation terminés / bloqués | 4 canaux (`CANCEL_REFUNDS_DONE`, `CANCEL_REFUNDS_BLOCKED`) | I | ✓ |
| Ventes | premier billet : 4 canaux ; ventes suivantes : cloche groupée (`NEW_ORDER`) et SMS groupé (`SALES_UPDATE_SMS`) ; catégorie et événement complets ; résumé du matin (désactivables) | P | B14 : ventes groupées sans notification |
| Demandes de remboursement des clients | 4 canaux, groupées (`PARTNER_REFUND_REQUESTS`) | P | ✓ |
| Espèces rendues par un administrateur | 4 canaux (`CASH_REFUND_MARKED_BY_ADMIN`) | I | ✓ |

### 2.4 Billets (17 étapes)

| Étape | Ce que reçoit chaque personne aujourd'hui | Cl. | Écart |
|---|---|---|---|
| Achat payé | 4 canaux (`PURCHASE_CONFIRMED`) | I | ✓ |
| Billets gratuits | 4 canaux (`FREE_TICKETS_CONFIRMED`) | I | ✓ |
| Achat au guichet | SMS au numéro de l'acheteur (`COUNTER_RECEIPT`) | I | ✓ (souvent sans compte : seul le SMS est possible) |
| Paiement échoué ou abandonné | rien (l'écran du paiement le montre) | ? | A4 (décision D1) |
| Double paiement d'un même panier | client : 4 canaux (`PAYMENT_REFUND_STARTED`) ; administrateurs : cloche, notification, email (`ADMIN_DUPLICATE_PAYMENT`) | I | B9 : administrateurs sans SMS |
| Invitation reçue | SMS au numéro ; cloche, notification, email si le numéro a un compte (`INVITATION_RECEIVED`) | I | ✓ |
| Invitation annulée | idem (`TICKET_CANCELLED`) | I | ✓ |
| Transfert proposé | destinataire : SMS au numéro, et cloche, notification, email s'il a un compte (`TRANSFER_OFFERED`) | I | ✓ |
| Transfert annulé par l'expéditeur | destinataire : idem (`TRANSFER_CANCELLED`) | I | ✓ |
| Transfert expiré | expéditeur : 4 canaux (`TRANSFER_EXPIRED`) | I | ✓ |
| Transfert accepté | expéditeur : 4 canaux (`TRANSFER_CLAIMED_SENDER`) ; destinataire : cloche, notification, email (`TRANSFER_RECEIVED`) | I | B1 : destinataire sans SMS |
| Transfert refusé | expéditeur : 4 canaux (`TRANSFER_DECLINED_SENDER`) | I | ✓ |
| Transfert révoqué par un remboursement | destinataire : SMS et autres canaux (`TRANSFER_REVOKED`) | I | ✓ |
| Remboursement demandé, versé, retardé | 4 canaux (`REFUND_REQUESTED`, `REFUND_PAID`, `REFUND_DELAYED`) ; porteur d'un billet payé par un autre : `TICKET_REFUNDED_HOLDER` | I | ✓ |
| Rappels la veille et 3 h avant | 4 canaux, désactivables (`REMINDER_J1`, `REMINDER_H3`) | P | ✓ |
| Première entrée | 4 canaux (`ENTRY_WELCOME`) | P | ✓ |
| Entrées suivantes | cloche, notification, email, groupées (`TICKET_SCANNED`) | P | ✓ |

### 2.5 Contrôle d'accès et caisse (13 étapes)

| Étape | Ce que reçoit chaque personne aujourd'hui | Cl. | Écart |
|---|---|---|---|
| Contrôleur invité | SMS du code d'activation (`CONTROLLER_INVITE`) et avis 4 canaux (`CONTROLLER_INVITATION`) | I | ✓ |
| Invitation acceptée | organisatrice : 4 canaux, **nom complet** du contrôleur (`CONTROLLER_INVITATION_ACCEPTED`) | P | C1 |
| Invitation refusée, expirée | organisatrice : 4 canaux, nom masqué (`…_DECLINED`, `…_EXPIRED`) | I | ✓ |
| Compte du contrôleur activé | 4 canaux (`CONTROLLER_ACTIVATED`) | P | ✓ |
| Affecté à un événement, retiré | 4 canaux, SMS regroupé (`CONTROLLER_ASSIGNED`, `CONTROLLER_UNASSIGNED`) | I | ✓ |
| Porte ou droit d'encaisser changé après l'affectation | rien | P | A9 |
| Rappel avant l'ouverture | 4 canaux, désactivable (`CONTROLLER_REMINDER`) | P | ✓ |
| Caisse fermée par l'organisatrice ou un administrateur | contrôleur : 4 canaux (`SHIFT_CLOSED_BY_OTHER`) | I | ✓ |
| Écart de caisse | organisatrice : 4 canaux, **nom complet** du contrôleur (`SHIFT_DISCREPANCY`) | I | C1 |
| Écart de caisse validé par l'organisatrice | contrôleur : rien | P | A8 |
| Refus en série à une porte | organisatrice : 4 canaux (`SCAN_REFUSALS_ALERT`) | I | ✓ |
| Contrôleur devenu administrateur | organisatrice : 4 canaux, **nom complet** (`CONTROLLER_BECAME_ADMIN`) | P | C1 |
| Événement annulé, modifié, suspendu | contrôleurs : 4 canaux (`CONTROLLER_EVENT_*`) | I | ✓ |

### 2.6 Salles (13 étapes) — conforme

Réservation demandée (client `HALL_RESERVATION_PENDING`, gérante `HALL_RESERVATION_REQUESTED`), confirmée, solde payé,
rappels du solde (J-10, J-8), délai dépassé, annulation côté client et côté gérante, paiement en trop remboursé,
remboursement versé, veille, recettes disponibles, décision de validation de la salle, salle soumise ou modifiée
(administrateurs). Les 13 avis aux clients et aux gérantes ont les 4 canaux ; les 2 avis aux administrateurs ont la cloche, la notification, l'email et le SMS regroupé. **Aucun écart.**

### 2.7 Réservations de tables de restaurant (15 étapes)

Demande envoyée et à traiter, réservation confirmée, nouvelle réservation, refus, sans réponse, attente du paiement
dépassée, annulations (client et établissement), absence, paiement en trop remboursé, remboursement versé, rappel,
« le client arrive », décision de validation de l'établissement, établissement soumis. Les 15 avis aux clients et aux établissements ont les 4 canaux ; l'avis aux administrateurs a la cloche, la notification, l'email et le SMS regroupé.
Seul point : le rappel (`TABLE_REMINDER`, qui demande de confirmer sa venue) est **désactivable** (B13, décision D5).

### 2.8 Tables d'un événement (5 étapes)

| Étape | Ce que reçoit chaque personne aujourd'hui | Cl. | Écart |
|---|---|---|---|
| Table achetée | titulaire : 4 canaux (`EVENT_TABLE_CONFIRMED`) ; organisatrice : 4 canaux (`EVENT_TABLE_SOLD`) | I / P | ✓ |
| Places pas encore envoyées | titulaire : 4 canaux, désactivable (`EVENT_TABLE_SEATS_REMINDER`) | I | B13 (D5) |
| Tables changées après la publication | administrateurs : 4 canaux (`ADMIN_EVENT_TABLES_CHANGED`) | P | ✓ |
| Report, suspension, clôture | titulaire qui a envoyé toutes ses places : **rien** | I | **A1** |
| Annulation | titulaire : 4 canaux (il est payeur) | I | ✓ |

### 2.9 Commandes (20 étapes)

| Étape | Ce que reçoit chaque personne aujourd'hui | Cl. | Écart |
|---|---|---|---|
| Commande passée | client : 4 canaux (`ORDER_RECEIVED`) ; établissement : 4 canaux (`ORDER_NEW`) | I | ✓ |
| Rappels de réponse et de préparation | établissement : 4 canaux | I | ✓ |
| Acceptée, en préparation | client : 4 canaux | P | ✓ |
| Prête | client : 4 canaux ; livreur : 4 canaux (`ORDER_READY_COURIER`) | I | ✓ |
| Code de remise | client : SMS seul, et l'écran de la commande (`ORDER_HANDOVER_CODE`) | I | ✓ (exception respectée) |
| En route | client : cloche, notification, email (`ORDER_ON_THE_WAY`) ; le SMS est celui du code (« votre commande est en route ») | P | ✓ |
| Code bloqué après des essais | client : 4 canaux (`ORDER_CODE_LOCKED`) | I | ✓ |
| Remise faite | client : 4 canaux ; établissement : 4 canaux | I | ✓ |
| Commande annulée, non retirée | client et établissement : 4 canaux | I | ✓ |
| Rappel de retrait, commande programmée | client : 4 canaux | I | ✓ |
| Remboursement (paiement en trop, versé) | client : 4 canaux | I | ✓ |
| Remboursement de commande bloqué | administrateurs : cloche, notification, email (`ADMIN_REFUND_TO_RETRY`) et SMS (`ADMIN_ORDER_REFUND_BLOCKED`) | I | ✓ |
| Livreur invité | livreur : cloche, notification, email (`ORDER_COURIER_INVITED`) | I | B6 : sans SMS |
| Livreur répond à l'invitation | établissement : rien | P | A6 |
| Livreur affecté, désaffecté | livreur : 4 canaux | I | ✓ |
| Livreur retiré de l'équipe | livreur : rien | P | A7 |
| Produit à vérifier | administrateurs : cloche et email (`ADMIN_PRODUCT_REVIEW`, `ADMIN_PRODUCTS_REVIEW_BATCH`) | I | B8 : sans SMS ni notification |
| Produit décidé | établissement : cloche, notification, email (`PRODUCT_REVIEW_DECIDED`) et SMS (`PRODUCT_DECISION_SMS`) | I | ✓ |
| Établissement fermé exceptionnellement | refus à la commande, pas d'avis à prévoir | — | — |
| Commande sur place | mêmes avis que ci-dessus (mode « sur place ») | — | ✓ |

### 2.10 Parrainage (4 étapes)

| Étape | Ce que reçoit chaque personne aujourd'hui | Cl. | Écart |
|---|---|---|---|
| Un filleul s'inscrit avec le code | rien | P | A3 |
| Commission gagnée (paiement d'un filleul) | rien | P | A3 |
| Commissions disponibles (après `finance.referral_availability_days`) | rien | I | A3 |
| Retrait des commissions | comme tout retrait (§ 2.11) | I | A2 |

### 2.11 Retraits (6 étapes)

| Étape | Ce que reçoit chaque personne aujourd'hui | Cl. | Écart |
|---|---|---|---|
| Code de retrait | SMS seul (`OTP_WITHDRAWAL`) | I | ✓ |
| Demande enregistrée | **rien** | I | **A2 (élevée)** |
| Versé | 4 canaux (`WITHDRAWAL_PAID`) | I | ✓ |
| Non versé | 4 canaux ; administrateurs : cloche et email (`ADMIN_WITHDRAWAL_REJECTED`) | I | B9 |
| Issue incertaine | 4 canaux ; administrateurs : cloche, notification, email (`ADMIN_CASHOUT_UNCERTAIN`) | I | B9 |
| Retardé | 4 canaux ; administrateurs : cloche, notification, email (`ADMIN_CASHOUT_TO_RESUME`) | I | B9 |

### 2.12 Administration (2 étapes de plus que celles déjà citées)

| Étape | Ce que reçoit chaque personne aujourd'hui | Cl. | Écart |
|---|---|---|---|
| Sécurité des comptes d'administration (droits changés, super-administrateur nommé, code de secours utilisé, numéro changé) | droits : 4 canaux ; super-administrateur nommé : cloche, SMS, email ; code de secours : SMS et email ; nouveau numéro : cloche, SMS, email | I | B12 |
| Alertes d'exploitation (envoi en échec, plafonds et volumes de SMS, créance, remboursement à reprendre) | cloche et email ; certaines avec notification | I / P | B9, B10, B11 |

## 3. Écarts sur les avis, et avis à ajouter

Chaque proposition donne : le moment, le destinataire, les textes (cloche, SMS au pire cas **mesuré**, email), la règle de
nuit et le lien. L'email reprend toujours la mise en page commune : sujet « {titre de la cloche} — Event Village », le
texte de la cloche, un bouton vers le lien. Les SMS ont été mesurés avec une adresse de 27 caractères
(`https://app.eventvillage.sn`), un nom ou un titre de 110 caractères et un montant de 9 999 999 F.

### 3.A Étapes sans aucun avis

**A1 — Report, suspension ou clôture d'un événement : le titulaire d'une table qui n'a plus de billet n'est pas prévenu.
Gravité élevée.**
Constat : `event_change_notify` (dernière définition `20261121000006_cvf2b_plafond_heure_glissante.sql`) choisit les
destinataires parmi les billets `VALIDE` (et `UTILISE` sur plusieurs jours) ; `notif_event_status_changed`
(`20261109000009_lot9bis_messages.sql:106`) fait de même pour la suspension, la réactivation et la clôture. Un titulaire qui
a envoyé toutes ses places n'a plus de billet : il n'apprend rien, alors que le remboursement de toute la table lui est
ouvert (`event_table_postponement_refund`). L'annulation, elle, lui parvient (les payeurs sont ajoutés). Repris de
`docs/lot12-etat-des-lieux.md` § 7.2 (branche `etat/lot12`).
Proposition : ajouter les titulaires des tables actives aux destinataires, **une fois par compte** (même clé que les
détenteurs, donc jamais deux avis s'il garde aussi un billet), sous le même plafond de 2 SMS par heure.
- Textes : ceux de `EVENT_CHANGED`, `EVENT_SUSPENDED_HOLDER` et `EVENT_CLOSED_HOLDER`, inchangés (SMS au pire cas : 159, 137 et
  158 caractères). Seul le lien change : « Ma table » (`/tickets?tab=tables#table-{réservation}`), en ajoutant
  `booking_id` aux données (le catalogue sait déjà construire ce lien, `myTablePath`).
- Nuit : comme aujourd'hui (`EVENT_CHANGED` part la nuit ; la suspension est reportée sauf événement à moins de 12 h).
- Aperçu du nombre de destinataires : `event_notice_recipient_count` (dernière définition `20261119000006_f2b_cadence_avis.sql:30`)
  doit les compter aussi.

**A2 — Retrait demandé : aucun accusé. Gravité élevée (argent et sécurité).**
Moment : à la création de la demande de retrait (organisatrice ou parrain). Destinataire : le titulaire du compte.
- Cloche : **Demande de retrait enregistrée** — « Votre demande de retrait de {montant} vers {Wave / Orange Money} est
  enregistrée. Vous serez prévenu dès qu'elle sera versée. Si ce n'est pas vous, ouvrez la page Aide tout de suite. »
- SMS (144 caractères au pire cas) : `Event Village : demande de retrait de 9 999 999 F CFA vers Orange Money enregistrée. Pas vous ? Ouvrez l'aide : https://app.eventvillage.sn/aide`
- Email : texte de la cloche, bouton « Voir mon retrait ».
- Nuit : part tout de suite (sécurité). Lien : la page du retrait (même lien que `WITHDRAWAL_PAID`).
- Doublon possible : un retrait versé dans la minute donnerait deux SMS. Proposition : échéance à 2 minutes et annulation
  de la ligne si le retrait est déjà versé à l'envoi (même mécanisme que `TICKET_SCANNED`).

**A3 — Parrainage : aucun avis. Gravité moyenne. Décision D2.**
- *Filleul inscrit* (petite) — cloche et notification : **Nouveau filleul** — « Une personne s'est inscrite avec votre
  code de parrainage. Vous gagnerez une commission sur ses achats. » Jamais le nom ni le numéro du filleul. Nuit : reporté.
  Lien : `/wallet`.
- *Commissions gagnées* (petite, regroupées une fois par jour à 9 h) — cloche et notification : **Commissions de la
  veille** — « Hier, vous avez gagné {n} commission(s), {montant} en tout. Elles seront disponibles dans {jours} jours. »
  Nuit : reporté. Lien : `/wallet`.
- *Commissions disponibles* (importante, regroupées par jour) — 4 canaux : **Commissions disponibles** — « {montant} de
  commissions de parrainage peuvent maintenant être retirés. »
  SMS (127 caractères) : `Event Village : 9 999 999 F CFA de commissions de parrainage sont disponibles. Retirez-les : https://app.eventvillage.sn/wallet`
  Nuit : reporté. Lien : `/wallet`.

**A4 — Paiement échoué ou abandonné : aucun avis. Gravité moyenne. Décision D1.**
Aujourd'hui l'écran de paiement montre l'issue ; si la personne a quitté l'écran, rien ne lui dit que ses places sont
libérées. Rien n'a été débité : on peut le classer « petite » (cloche et notification) ou « importante » (4 canaux).
- Cloche : **Paiement non abouti** — « Le paiement pour « {titre} » n'a pas abouti. Rien n'a été débité et les places ne
  sont plus réservées. Vous pouvez réessayer. »
- SMS si retenu (139 caractères) : `Event Village : paiement non abouti pour Grande soirée " Ndekk " -.... Rien n'a été débité. Réessayez : https://app.eventvillage.sn/tickets`
  (commande : `… pour la commande CMD-261205-A1B2C3. Rien n'a été débité. Réessayez : https://app.eventvillage.sn/orders`, 139).
- Un seul avis par panier, jamais si un autre paiement du même panier a réussi entre-temps. Nuit : reporté. Lien : la page
  de l'événement, de la commande ou de la réservation.

**A5 — Dossier complété après un refus : la partenaire n'a pas d'accusé.** Faible. Cloche et notification :
**Dossier envoyé** — « Votre dossier complété est envoyé à l'équipe Event Village. Vous recevrez la réponse ici et par
SMS. » Nuit : reporté. Lien : `/partner/dashboard`.

**A6 — Le livreur répond à l'invitation : l'établissement n'est pas prévenu.** Faible. Cloche et notification :
**Livreur : invitation acceptée** — « Un livreur a accepté votre invitation : vous pouvez lui confier des commandes. » (ou
« … a refusé votre invitation. »). Prénom et initiale seulement si un nom est voulu (D3). Nuit : reporté. Lien : l'équipe
des livreurs.

**A7 — Livreur retiré par l'établissement : le livreur n'est pas prévenu.** Faible. Cloche et notification :
**Vous ne livrez plus pour {établissement}** — « {établissement} vous a retiré de ses livreurs. Les commandes déjà
remises ne changent pas. » Nuit : reporté. Lien : `/courier/orders`.

**A8 — Écart de caisse validé : le contrôleur n'est pas prévenu.** Faible. Cloche et notification : **Caisse validée** —
« L'organisatrice a validé votre caisse de « {titre} ». » Nuit : reporté. Lien : `/controller/scanner`.

**A9 — Porte ou droit d'encaisser changé après l'affectation : le contrôleur n'est pas prévenu.** Faible (sauf le jour
même, où la règle des 12 h le rend urgent). Cloche et notification : **Votre poste a changé** — « Pour « {titre} » :
porte {porte}, {vous pouvez / vous ne pouvez plus} encaisser en espèces. » Lien : `/controller/scanner`.

**A10 — Inscription réussie : pas de bienvenue.** Faible et facultatif. Cloche : **Bienvenue sur Event Village** —
« Votre compte est prêt. Retrouvez vos billets, réservations et commandes ici. » Lien : `/`.

### 3.B Étapes importantes sans un canal, petites étapes sans notification

| N° | Avis | Manque | Gravité | Proposition |
|---|---|---|---|---|
| B1 | Billet reçu après acceptation (`TRANSFER_RECEIVED`) | SMS | moyenne | SMS (138) : `Event Village : le billet Grande soirée " Ndekk " - l... est dans vos billets, avec un nouveau numéro. https://app.eventvillage.sn/tickets` ; part la nuit |
| B2 | Numéro changé (`PHONE_CHANGED`) | cloche, notification | moyenne | cloche sur le compte : le texte existe déjà (fond de l'email) ; recopie de l'émetteur nécessaire |
| B3 | Adresse email ajoutée (`EMAIL_ADDED`) | cloche, notification | moyenne | idem, texte déjà écrit |
| B4 | 10 échecs de mot de passe (`ACCOUNT_LOGIN_FAILURES`) | cloche, notification | moyenne | idem, texte déjà écrit |
| B5 | Paiement d'un abonnement ou d'une mise en avant (`PAYMENT_SUCCESS`) | SMS | moyenne | SMS sur `PAYMENT_SUCCESS` seulement (pas sur `SUBSCRIPTION_ACTIVATED`, pour un seul SMS) : `Event Village : paiement de 9 999 999 F CFA confirmé pour votre abonnement. Merci. https://app.eventvillage.sn/partner/subscription` (131) ; « … pour votre mise en avant. Merci. …/partner/events » (128). Attention : « reçu » contient un « ç » hors GSM-7, qui ferait passer le SMS en deux segments |
| B6 | Livreur invité (`ORDER_COURIER_INVITED`) | SMS | moyenne | SMS (141) : `Event Village : {établissement} vous invite à livrer ses commandes. Répondez : https://app.eventvillage.sn/courier/invitations` ; reporté la nuit |
| B8 | Produit à vérifier (`ADMIN_PRODUCT_REVIEW`, `…_BATCH`) | SMS, notification | moyenne | notification ; SMS : ajouter les produits au **SMS regroupé** des administrateurs (`ADMIN_REVIEW_SMS`, qui dit « {n} demandes attendent votre validation » : 101 caractères, la longueur ne change pas) |
| B9 | Alertes d'argent des administrateurs (`ADMIN_REFUND_TO_RETRY`, `ADMIN_DUPLICATE_PAYMENT`, `ADMIN_CASHOUT_UNCERTAIN`, `ADMIN_CASHOUT_TO_RESUME`, `ADMIN_WITHDRAWAL_REJECTED`, `ADMIN_FINANCE_DEBT`) | SMS ; notification pour les deux derniers | moyenne | un **SMS regroupé** par heure, sur le modèle d'`ADMIN_REVIEW_SMS` : `Event Village : argent à vérifier : 99 versements à reprendre, 99 incertains, 99 doubles paiements, 99 créances. https://app.eventvillage.sn/admin/finance` (154) ; parties à zéro retirées ; reporté la nuit ; le SMS `ADMIN_ORDER_REFUND_BLOCKED` existant y est fondu pour éviter deux SMS |
| B10 | Plafonds de SMS atteints (`ADMIN_SMS_CAP_GLOBAL`, `…_NON_OTP`, `…_NEW_NUMBERS`) | SMS, notification | faible | notification seulement ; pas de SMS (décision D4 : le plafond bloquerait ce SMS lui-même) |
| B11 | Alertes d'information des administrateurs (`ADMIN_EVENT_PUBLISHED`, `…_WITHDRAWN`, `…_CHANGED`, `…_CANCELLED`, `ADMIN_NOTIFICATION_FAILED`, `ADMIN_SMS_DAILY_THRESHOLD`, `ADMIN_SMS_OPTIONAL_80`, `ADMIN_SMS_FORECAST`) | notification | faible | ajouter la notification ; reportée la nuit |
| B12 | Sécurité des administrateurs : `SUPERADMIN_PROMOTED`, `ADMIN_PHONE_CONFIRMED` (notification), `ADMIN_BACKUP_CODE_USED` (cloche, notification) | voir colonne | moyenne | ajouter les canaux ; textes déjà écrits ; part la nuit |
| B13 | Avis importants **désactivables** : suspension de l'événement au détenteur (`EVENT_SUSPENDED_HOLDER`), rappel de table (`TABLE_REMINDER`), places à envoyer (`EVENT_TABLE_SEATS_REMINDER`) | — | moyenne (suspension), faible (rappels) | passer `EVENT_SUSPENDED_HOLDER` dans la famille indispensable (plus de préférence, rien d'enlevé) ; rappels : décision D5 |
| B14 | Ventes groupées de l'organisatrice (`NEW_ORDER`, cloche seule ; le SMS est `SALES_UPDATE_SMS`) | notification | faible | ajouter la notification au regroupement de 15 minutes ; désactivable comme les autres ventes |
| B15 | Nuit : la règle « commande à moins de 12 h » n'existe pas dans `notif_event_soon` | — | faible | sans effet aujourd'hui (aucun avis de commande en cours n'est reporté) ; à ajouter dès qu'un avis de commande `DEFER` est créé |

### 3.C Exceptions enfreintes

**C1 — Nom complet d'une personne envoyé à une autre. Gravité moyenne. Décision D3.**
- `SHIFT_DISCREPANCY` (organisatrice, 4 canaux) : « La caisse de Fatou Sow pour « … » est fermée. Il manque 2 500 F CFA. »
  et SMS « caisse de Fatou Sow fermée … ».
- `CONTROLLER_INVITATION_ACCEPTED` (organisatrice, 4 canaux) : « Aminata Fall a accepté votre invitation … » — choix
  explicite de la finition 1 (E-20 : nom complet à l'acceptation, masqué sinon), contraire à la règle du 27/11.
- `CONTROLLER_BECAME_ADMIN` (organisatrice, 4 canaux) : « Aminata Fall ne fait plus partie de votre équipe … ».
- Entre administrateurs : `ADMIN_PERMISSIONS_ALERT` (« Moussa Diop a modifié les droits de Ndeye … ») et
  `SUPERADMIN_PROMOTED` (nom du compte promu et de l'auteur).
Proposition : prénom et initiale du nom (« Fatou S. », « Aminata F. ») pour les trois avis à l'organisatrice, calculés
dans le catalogue (aucune fonction SQL à recopier) ; pour les deux avis entre administrateurs, garder le nom complet
comme **exception justifiée** (équipe interne, alerte de sécurité où l'identité est l'information).

**C2 — Code envoyé par email ou notification : aucun.** Les codes partent par SMS seul ; le code de remise d'une commande
part par SMS seul et n'est jamais stocké ; l'invitation d'un contrôleur sépare le code (SMS) de l'avis. Seul point à
confirmer (D7) : « mot de passe oublié » envoie un **lien** par email quand l'adresse est vérifiée ; ce n'est pas un code,
mais il ouvre l'accès au compte.

**C3 — SMS de plus d'un segment : aucun, mais aucune marge pour 6 d'entre eux. Gravité faible.** `TRANSFER_OFFERED`,
`CONTROLLER_REMINDER`, `ADMIN_PERMISSIONS_ALERT`, `ACCOUNT_SUSPENDED`, `ACCOUNT_LOGIN_FAILURES` et le SMS d'invitation d'un
contrôleur (`CONTROLLER_INVITE`) font **160 caractères pile** au pire cas avec une adresse de 27 caractères ; 22 avis
dépassent 155. Rien ne vérifie la longueur de `NEXT_PUBLIC_APP_URL` (`lib/env.ts:37` ne contrôle que la forme) : une
adresse de production plus longue (par exemple un domaine Vercel) ferait passer ces SMS en deux segments. Proposition :
refus au démarrage si l'adresse dépasse 27 caractères, ou marge de 4 caractères prise sur les titres de ces six SMS.

## 4. Mots techniques dans les textes visibles

Méthode : lecture de toutes les chaînes et de tout le texte JSX de `app/`, `components/`, `lib/`, `hooks/` (hors tests),
et des messages renvoyés par les fonctions SQL (dernière définition), filtrés par une liste de mots de développeur ;
puis tri à la main. Les avis eux-mêmes (cloche, SMS, email, notification) sont **propres** : le garde-fou existant
`tests/schema/design1b-mots.test.ts` les rend tous et les contrôle. Les mots trouvés sont ailleurs.

### 4.1 Visibles par un client, une organisatrice, un contrôleur ou un livreur

| N° | Fichier : ligne | Texte | Phrase simple proposée | Gravité |
|---|---|---|---|---|
| M1 | `components/notifications/PushDeviceCard.tsx:111` et `:126` | message brut du navigateur quand l'abonnement échoue (`err.message` de `pushManager.subscribe`, en anglais : « Registration failed - push service error ») | « L'activation n'a pas marché sur ce navigateur. Vérifiez que les notifications sont autorisées, puis réessayez. » | élevée |
| M2 | `lib/partner/partner-dashboard.service.ts:1197`, `:1210`, `:1203` (export comptable) | colonne « Canal » : `EN_LIGNE`, `ESPECES`, `INVITATION` ; « Statut du billet » : statut brut (`VALIDE`, `UTILISE`, `REMBOURSE`…) ; « Billet » : identifiant technique si le billet n'a pas de numéro | « En ligne », « Espèces », « Invitation » ; libellé du statut (comme `pilotage_ticket_status_label` de l'export des participants) ; « — » sans numéro | élevée |
| M3 | `app/api/notifications/preferences/route.ts:61`, `app/profile/notifications/page.tsx:250`, `components/notifications/PushDeviceCard.tsx:49` et `:55`, `app/api/notifications/essai-push/route.ts:41` et `:57`, `app/api/push/subscriptions/route.ts:64` et `:87`, `lib/notifications/catalog.ts:3344` | « Notifications push », « notification push d'essai », « Les notifications push ne sont pas disponibles… » | « Notifications du téléphone », « notification d'essai », « Les notifications du téléphone ne sont pas disponibles pour le moment. » | moyenne |
| M4 | `app/api/auth/verify-otp/route.ts:34` | « Numéro de téléphone et code OTP requis. » | « Entrez votre numéro et le code reçu par SMS. » | moyenne |
| M5 | `app/api/controller/scan/route.ts:198` | « Scan invalide : eventId et payload (ou manualTicketNumber, ou guestTicketId) requis. » | « Scan illisible. Scannez de nouveau ou tapez le numéro du billet. » | moyenne |
| M6 | `app/api/controller/shifts/open/route.ts:12`, `:13`, `:22` ; `app/api/partner/events/[id]/regisseur-pin/route.ts:34` ; `app/api/partner/events/[id]/shifts/route.ts:26` ; `app/api/partner/team/invite/route.ts:67-71` | « ID événement invalide. », « ID événement requis. », « ID événement manquant. » | « Événement introuvable. Rechargez la page. » | moyenne |
| M7 | `lib/validations/payment.ts:18`, `:38`, `:53` (utilisé par `app/api/payments/create`) | « L'identifiant de la cible (targetId) doit être un UUID valide. », « transaction_id SamirPay invalide. », « L'opérateur (WAVE ou ORANGE_MONEY) est requis. », « Opérateur non supporté (choisir WAVE ou ORANGE_MONEY). » | « Achat introuvable. Rechargez la page. », « Paiement introuvable. », « Choisissez Wave ou Orange Money. » | moyenne |
| M8 | 15 routes : « Payload JSON invalide. » (`app/api/auth/send-otp:38`, `auth/verify-otp:25`, `auth/resolve-phone:39`, `controller/profile:111`, `controller/setup:31`, `partner/activation:23`, `partner/register:53`, `partner/team/assignments:88`, `partner/team/invite:118`, `admin/communications:55`, `admin/partners/[id]/status:72`, `admin/permissions:70`, `admin/users:142` et `:337`) ; environ 30 routes : « Corps JSON invalide. », « Corps de requête illisible (JSON attendu). », « Demande illisible : corps JSON attendu. » | une seule phrase : « Demande illisible. Rechargez la page, puis réessayez. » | faible (ne s'affiche que si l'écran envoie une demande cassée) |
| M9 | `components/partner/useServerData.ts:48`, `components/event-tables/DoorList.tsx:68`, et l'aide `errorMessage()` de `components/partner/fetch-json.ts:72` | affichent `err.message` tel quel quand l'erreur n'est pas une erreur d'API (réponse illisible, erreur de code) | passer par `humanToastMessage` (déjà écrite pour les toasts, `components/ui/Toast.tsx:74`) | faible |
| M10 | `app/api/partner/team/assignments/route.ts:289` | champ `details` : « … est en statut PUBLIE. Seuls les événements confirmés (VALIDÉ ou PUBLIÉ) … » (renvoyé, pas affiché aujourd'hui) | retirer le statut brut ou le traduire | faible |
| M11 | `lib/validations/auth.ts:167` (`VerifyOtpSchema`), `lib/validations/auth.ts` (`RequestWithdrawalSchema`) | « Le code OTP doit comporter exactement 6 chiffres », « (WAVE ou ORANGE_MONEY) » — schémas **jamais utilisés** | supprimer ces schémas morts, ou corriger les textes | faible |

### 4.2 Visibles par les administrateurs seulement

| N° | Fichier : ligne | Texte | Phrase simple proposée |
|---|---|---|---|
| M12 | `components/orders/admin/ProductReviewView.tsx:536` | `fetch` direct : une coupure réseau affiche « Failed to fetch » (anglais) | `humanToastMessage` ou `fetchJson` |
| M13 | `app/api/admin/users/route.ts:343` | « Statut invalide : ACTIF ou SUSPENDU. » | « Choisissez « Actif » ou « Suspendu ». » |
| M14 | `app/api/admin/users/[id]/anonymize/route.ts:25` | « ID utilisateur requis. » | « Compte introuvable. Rechargez la page. » |
| M15 | `lib/notifications/catalog.ts:3070` (nom du type, page de supervision) | « Code de connexion (Supabase) » | « Code de connexion (envoyé à la connexion) » |
| M16 | `lib/notifications/dispatcher.ts:500`, `lib/push/web-push.adapter.ts:115`, `lib/notifications/outbox-labels.ts:39-94` (motifs de la supervision) | « Charge refusée par le service push (413). », « (HTTP 413) », « Notification push », « Push accepté par le service… » | « Message trop long pour le service des notifications du téléphone », « notification du téléphone » |
| M17 | SQL : `20261106000002_lot8_essai.sql:123` (`MESSAGE = 'SIMULATION_MISMATCH'`), `20261130000004_l12a_devis_commande.sql:578` (`MESSAGE = 'OUT_OF_STOCK'`) | code en guise de message (la liste blanche `PublicError` l'empêche aujourd'hui d'arriver à l'écran) | une phrase : « L'essai ne correspond pas au paiement simulé. », « Un produit n'est plus disponible. » |

### 4.3 Exceptions justifiées (ce ne sont pas des écarts)

- **SamirPay, Wave, Orange Money** : noms de prestataires, utiles aux administrateurs (pages finance, remboursements) ;
  côté client, « Paiement sécurisé par SamirPay » (`components/payment/PaymentModal.tsx:826`), « Mobile Money, par
  SamirPay » (`:529`) et la description du site (`app/layout.tsx:32`) : à garder ou non selon le client (D6).
- **« scanner »** : verbe français (« scanner les billets ») ; **« 500 caractères », « 500 favoris », « 500 tables »** :
  des limites, pas des codes d'erreur.
- **Messages pour l'exploitant, jamais vus par une personne** : `lib/env.ts` (variables manquantes au démarrage),
  `lib/integrations/real-mode.ts`, `lib/push/config.ts`, `lib/sms/mtarget-http.adapter.ts:140`, et
  `app/api/auth/sms-hook/route.ts` (appelé par Supabase, pas par un écran).

### 4.4 Contrôle automatique à ajouter

Le garde-fou `tests/schema/design1b-mots.test.ts` (et `e2e/support/checks.ts` sur les écrans capturés) couvre les avis et
le JSX des écrans, mais **pas** : les routes d'API (`app/api` est exclu, ligne 107), `lib/` (messages de validation,
`PublicError`, replis), les messages SQL, les exports CSV, ni les erreurs mises dans un état puis affichées
(`setError(err.message)`). Il passe aussi `errorMessage(...)` comme sûr alors que cette aide laisse passer un message brut.

Proposition : étendre ce test (statique, sans base, donc dans le lot rapide), sans en créer un second.
1. **Fichiers couverts en plus** : `app/api/**`, `lib/**` (hors exceptions ci-dessous), `hooks/**` ; dans ces fichiers,
   les chaînes des propriétés `error`, `message`, `details` d'une réponse (`NextResponse.json`), de `new PublicError(`,
   des replis `apiFailure`/`ApiFallback`, des messages zod (`message:`, `zodTypeErrors`) et des refus `badRequest(`.
2. **Messages SQL** : pour chaque fonction, sa **dernière** définition dans `supabase/migrations` ; chaînes de
   `'message', '…'` et de `RAISE … MESSAGE = '…'`.
3. **Exports** : rendu de `participantsCsv` et de l'export comptable avec des lignes d'exemple ; aucune cellule ne doit
   répondre au motif des codes.
4. **Erreurs affichées** : interdire `set…(err.message)` et `set…(err instanceof Error ? err.message : …)` sans
   `humanToastMessage(` ; faire passer `errorMessage()` par `humanToastMessage` pour toute erreur qui n'est pas une
   `ApiError`.
5. **Liste de mots** (en plus de `TECH_RE` et `CODE_RE` déjà présents : RPC, API, token, null, undefined, NaN, UUID,
   « erreur 500 », « HTTP 500 », Failed to fetch, NetworkError, TypeError…) : `OTP`, `payload`, `JSON`, `webhook`,
   `timeout`, `ID` (mot seul), `push` (hors pages d'administration), `Supabase`, `MTarget`, `Resend`, `VAPID`,
   `service_role`, les identifiants en casse chameau dans une phrase (`eventId`, `targetId` : motif
   `\b[a-z]+[A-Z][A-Za-z]*\b`), et une courte liste de mots anglais d'interface (Loading, Submit, Cancel, Save, Delete,
   Retry, Success, Failed, Pending, Unknown, Something went wrong, Not found, Invalid, Required).
6. **Exceptions** (fichier et texte exact, chacune justifiée dans `EXCEPTIONS`) : noms de prestataires (SamirPay, Wave,
   Orange Money) ; « scanner » ; nombre suivi d'une unité (« 500 caractères ») ; fichiers d'exploitation (`lib/env.ts`,
   `lib/integrations/real-mode.ts`, `lib/push/config.ts`, `app/api/auth/sms-hook/route.ts`, `app/dev/**`) ; journaux
   (`console.*`, `logger.*`, `throw new Error` interne non renvoyé).

## 5. Décisions attendues

| N° | Question | Proposition |
|---|---|---|
| D1 | Paiement échoué ou abandonné : prévenir ? avec quel niveau ? | Petite étape (cloche et notification), un avis par panier ; SMS seulement si le client le souhaite |
| D2 | Parrainage : des avis dès la V1 ? | Oui, les trois avis de A3, regroupés par jour |
| D3 | Nom d'un contrôleur (ou d'un livreur) dans un avis à l'organisatrice | Prénom et initiale ; nom complet gardé entre administrateurs |
| D4 | Alertes de plafond SMS par SMS ? | Non : notification et email (le plafond bloquerait le SMS) |
| D5 | Rappel de table et rappel des places à envoyer : rester désactivables ? | Oui (ce sont des rappels) ; seule la suspension d'un événement devient non désactivable |
| D6 | Montrer « SamirPay » aux clients ? | Garder (rassure sur le paiement), à confirmer par le client |
| D7 | « Mot de passe oublié » par lien email : acceptable avec la règle « codes par SMS seulement » ? | Oui (lien à usage unique de 60 minutes, adresse vérifiée seulement) |
| D8 | Anonymisation d'un compte : prévenir la personne avant ? | SMS et email juste avant l'effacement, si le client le veut |

## 6. Découpage proposé pour la phase 2

**Horodatage** : la dernière migration de `main` est aujourd'hui `20261224000005_l12c_cv_correctifs.sql`. Le 12b (non
fusionné) utilise `20261222…`, le 12d est prévu en `20261228…`. Proposition : `20261230000001` et suivantes, **à revoir au
démarrage** de la phase 2 (toujours après la dernière de `main` à ce moment-là).

**Règle commune** : chaque type nouveau entre en même temps au registre (`notification_types`, avec `night_policy`), au
catalogue (`catalog.ts`, `catalog-types.ts`) et, s'il a une cloche, à `notification-types.ts` (libellé du filtre) ; un
canal ajouté à un type existant se fait par `UPDATE notification_types` **et** par la recopie de chaque émetteur qui passe
une liste `channels` explicite.

| Sous-lot | Contenu | Migrations et recopies (dernière définition) | Risques |
|---|---|---|---|
| **2a — canaux** | B1 à B6, B11, B12, B13 (suspension), B14 ; textes SMS nouveaux au catalogue | `UPDATE notification_types` ; une seule recopie : `account_phone_finalize` (`20261120000006_f3d_cv_numero_profil.sql`, B2 : elle impose `['SMS']` puis `['EMAIL']`, il faut une troisième mise en file cloche et notification) ; les autres émetteurs ne passent pas de liste et prennent les canaux du registre (`ticket_transfer_accept` `20261110000008`, `notif_email_verification_used` `20261112000008`, `auth_login_attempt_end` `20261112000002`, `notif_payments_other_success` `20261106000003` avec son déclencheur `20261130000007`, `order_courier_invite` `20261130000006`, `admin_backup_code_use` `20261120000004`, `admin_role_change` `20261120000003`, et `ADMIN_PHONE_CONFIRMED` dans `admin_phone_change_finalize` `20261120000007`) | B5 : un seul SMS pour un abonnement (`PAYMENT_SUCCESS`, pas `SUBSCRIPTION_ACTIVATED`) ; B13 : la page des préférences ne doit plus proposer de couper la suspension |
| **2b — titulaires de table (A1)** | report, suspension, réactivation, clôture vers le titulaire sans billet | recopies : `event_change_notify` (`20261121000006`), `event_notice_recipient_count` (`20261119000006`), `notif_event_status_changed` (`20261109000009`) ; catalogue : lien « Ma table » si `booking_id` | doublon s'il garde un billet : même clé par compte ; plafond de 2 SMS par heure à respecter ; indépendant des lots 12, à appliquer avant leurs migrations (comme le prévoyait le § 7.2) |
| **2c — avis nouveaux simples** | A2 (retrait demandé), A5, A8, A9, A10 | A2 : **nouveau** déclencheur sur `cashouts` (insertion d'un retrait) plutôt qu'une 10e recopie de `notif_cashouts_notify` (`20261130000006`, 9 définitions) ou de `withdrawal_request` (`20261109000006`) ; A5 : `partner_dossier_resubmit` (`20261109000004`) ; A8 : `shift_discrepancy_validate` (`20261116000005`) ; A9 : `event_controller_set_cash`, `event_controller_gate_set` (`20261116000004`) | A2 : deux SMS si le retrait est versé dans la minute (échéance à 2 min, annulation si versé) |
| **2d — administrateurs regroupés** | B8, B9, B10 | nouveau SMS regroupé (modèle : `notif_admin_review_sms` `20261126000004`, `notif_admin_review_due` `20261123000002`, tâche planifiée) ; `notif_admin_review_sms` recopiée pour compter les produits ; `private.order_product_review_notify` (`20261224000001`) ; `private.order_refund_blocked_notify` (`20261224000005`) fondu dans le regroupement | deux SMS pour un même remboursement de commande si le SMS existant n'est pas retiré du flux ; fonctions du 12c (sessions en parallèle) |
| **2e — livreurs** | A6, A7 | `order_courier_action`, `order_courier_remove` (`20261130000006`) | **à faire dans le 12d ou après lui** : ce sont ses fonctions |
| **2f — parrainage** (après D2) | A3 | nouveau déclencheur sur `referral_commissions` (pas de recopie des fonctions de paiement, présentes dans 3 migrations) ; regroupement quotidien dans `notification_daily_checks` (`20261125000003`) ou une tâche à part | commission annulée après remboursement : ne pas annoncer une commission déjà retirée |
| **2g — paiement échoué** (après D1) | A4 | déclencheur sur `payments` (passage à l'échec ou expiration) | un avis par panier ; aucun si un autre paiement du panier a réussi |
| **2h — noms et mots** | C1 (prénom et initiale, dans le catalogue), C3 (garde de longueur de l'adresse), M1 à M17, extension du garde-fou (§ 4.4) | aucune migration, sauf M17 (deux messages SQL : recopies `20261106000002` et `20261130000004`, ou laissés tels quels puisqu'ils n'arrivent pas à l'écran) | le garde-fou étendu fera d'abord échouer les textes de M1-M17 : corriger dans le même sous-lot |

**Tests existants qui citent ces avis** (à mettre à jour avec leurs auteurs prévenus, jamais affaiblis) :
- tous les types : `tests/parcours/notif-modeles.test.ts` (table G2 des types, canaux, liens, pire cas des SMS),
  `notif-outbox.test.ts`, `notif-migration.test.ts`, `tests/schema/f5-liens-avis.test.ts` (liens),
  `tests/parcours/email-regle-envoi.test.ts` (email des indispensables), `tests/schema/design1b-mots.test.ts`,
  `tests/parcours/f4-messages.test.ts` et `f4-recopies.test.ts` (règle de nuit du registre), `f4-textes.test.ts` et
  `textes-sms-9bis.test.ts` (SMS en un segment) ;
- A1 / `EVENT_CHANGED` : `lot9bis-report`, `f2b-cadence-avis`, `f2b-prevenir`, `messages-changement-9bis`,
  `notif-rappels-annulation`, `f2acv-avis-de-lieu`, `l11cb-ecrans`, `l11cb-cv-correctifs` (et `cv11cb-3-statique`) ;
- B1 : `notif-transferts`, `invitations-reclamation`, `course-annulation-transfert` ; B2 : `compte-numero`, invariants
  `lot9*` ; B3, B4 : `lot9quinquies-messages`, `lot9quinquies-connexion` ; B5 : `notif-pros`, `notif-abonnement`,
  `notif-cloche`, `l10a-salles` ; B8 : `l12c-catalogue`, `l12c-statique`, `l12c-cv-correctifs`, `cv12c-3-statique` ;
  B9 : `notif-admins`, `versements-reprise`, `double-paiement`, `argent9ter-non-verse`, `paiement-remboursement` ;
  B12 : `f3d-role`, `cvf3d-3-role`, `f3d-telephone` ; B13 : `notif-canaux`, `cvf4-1-nuit`, `lot9bis-fonds-suspension` ;
  B14 : `cvf4-3-argent-donnees`, `notif-pros` ; C1 : `finition1-equipe`, `f4-textes` (`SHIFT_DISCREPANCY`).

## 7. Méthode et limites

- Inventaire des types : `lib/notifications/catalog.ts`, `catalog-types.ts`, `notification-types.ts`, `outbox-labels.ts`,
  registre `notification_types` (égalité imposée par `notif-modeles`). Émetteurs : dernière définition de chaque fonction
  SQL (analyse de toutes les migrations dans l'ordre), déclencheurs, et code TypeScript hors tests.
- Mesure des SMS : rendu réel du catalogue avec deux jeux de pire cas, celui des tests (contrat G3) et un jeu élargi
  (noms d'établissement, de produit, de zone, de porte, d'organisateur et de personne à 110 caractères, montants des
  commandes, salles et tables à 9 999 999 F, compteurs à 99 ou plus) : aucun SMS ne dépasse 160.
- Le relevé des mots techniques repose sur une liste de mots puis un tri à la main : il peut manquer un texte construit
  en plusieurs morceaux. L'extension du garde-fou (§ 4.4) est là pour fermer ce trou de façon durable.
- Non vérifié ici (lecture seule) : la configuration de production (Resend, VAPID, adresse de l'application), et le
  comportement en vrai des avis (aucun test lancé).
