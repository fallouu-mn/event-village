# Annexe — tous les avis d’Event Village, type par type

Document généré le 27/11/2026 depuis `lib/notifications/catalog.ts` (main 2a65f5e55) : chaque texte ci-dessous est le rendu réel du catalogue, pas une recopie. Compagnon de `docs/avis-inventaire.md`.

Colonnes : **Canaux** = canaux déclarés au registre (`notification_types`), « cloche » = avis dans l’application, « notification » = notification du téléphone (push). L’email ne part que vers une adresse vérifiée ; la notification ne part que vers un appareil abonné ; un avis « désactivable » peut être coupé par la personne dans ses préférences. **SMS max** = longueur au pire cas mesurée (septets GSM-7, 160 = un segment), avec titres, lieux et noms de 110 caractères, montants de 9 999 999 F, date la plus longue et adresse de 27 caractères. **Classement** : I = importante, P = petite. **Manque** = canaux absents selon la règle du 27/11.

## Compte (15)

| Type | Avis | Pour | Canaux | Nuit | Lien | Titre de la cloche | SMS max | Classement | Manque |
|---|---|---|---|---|---|---|---|---|---|
| `PASSWORD_CHANGED` | Mot de passe modifié | selon le cas | cloche, SMS, email, notification | part la nuit | `/profile` | Mot de passe modifié | 153 | I | — |
| `PHONE_CHANGED` | Numéro de téléphone modifié | selon le cas | SMS, email | part la nuit | `/profile` | Numéro de téléphone modifié | 112 | I | cloche, notification |
| `EMAIL_CLAIMED_ELSEWHERE` | Adresse email validée par un autre compte | selon le cas | cloche, SMS, email, notification | part la nuit | `/profile` | Adresse email validée par un autre compte | 152 | I | — |
| `PUSH_TEST` | Notification d’essai | selon le cas | notification | part la nuit | `/profile/notifications` | — | — | I | (paire) envoi d’essai demandé par la personne |
| `ACCOUNT_SUSPENDED` | Compte suspendu | selon le cas | cloche, SMS, email, notification | part la nuit | `/aide` | Compte suspendu | 160 | I | — |
| `ACCOUNT_REACTIVATED` | Compte réactivé | selon le cas | cloche, SMS, email, notification | part la nuit | `/login` | Compte réactivé | 116 | I | — |
| `ACCOUNT_LOGIN_FAILURES` | Essais de connexion échoués | selon le cas | SMS, email | part la nuit | `/forgot-password` | Essais de connexion échoués | 160 | I | cloche, notification |
| `EMAIL_ADDED` | Adresse email ajoutée au compte | selon le cas | SMS, email | part la nuit | `/aide` | Adresse email ajoutée | 119 | I | cloche, notification |
| `OTP_LOGIN` | Code de connexion | selon le cas | SMS | immédiat | — | — | 83 | — | — |
| `OTP_REGISTER` | Code d’inscription | selon le cas | SMS | immédiat | — | — | 83 | — | — |
| `OTP_PASSWORD_RESET` | Code de réinitialisation du mot de passe | selon le cas | SMS | immédiat | — | — | 103 | — | — |
| `OTP_PHONE_CHANGE` | Code de changement de numéro | selon le cas | SMS | immédiat | — | — | 83 | — | — |
| `OTP_AUTH_HOOK` | Code de connexion (Supabase) | selon le cas | SMS | immédiat | — | — | 83 | — | — |
| `ACCOUNT_ACTIVATION` | Lien d’activation d’un compte créé par un administrateur | selon le cas | SMS | immédiat | — | — | 144 | — | — |
| `EMAIL_VERIFICATION` | Vérification de l’adresse email | selon le cas | email | immédiat | — | — | — | — | — |

## Partenaire (dossier, abonnement) (8)

| Type | Avis | Pour | Canaux | Nuit | Lien | Titre de la cloche | SMS max | Classement | Manque |
|---|---|---|---|---|---|---|---|---|---|
| `PARTNER_REGISTERED_ACK` | Inscription partenaire reçue | partenaire | cloche, SMS, email, notification | part la nuit | `/partner/dashboard` | Inscription reçue | 127 | I | — |
| `PARTNER_VALIDATED` | Compte partenaire validé | partenaire | cloche, SMS, email, notification | reporté à 7 h (sauf < 12 h) | `/partner/dashboard` | Compte partenaire validé | 133 | I | — |
| `PARTNER_REJECTED` | Demande de compte partenaire refusée | partenaire | cloche, SMS, email, notification | reporté à 7 h (sauf < 12 h) | `/partner/dashboard` | Demande refusée | 158 | I | — |
| `PARTNER_SUSPENDED` | Compte partenaire suspendu | partenaire | cloche, SMS, email, notification | part la nuit | `/partner/dashboard` | Compte suspendu | 142 | I | — |
| `PARTNER_REACTIVATED` | Compte partenaire réactivé | partenaire | cloche, SMS, email, notification | reporté à 7 h (sauf < 12 h) | `/partner/dashboard` | Compte réactivé | 104 | I | — |
| `TRIAL_STARTED` | Période d’essai activée | partenaire | cloche, email, notification | part la nuit | `/partner/dashboard` | Période d'essai activée | — | P | — |
| `SUBSCRIPTION_ACTIVATED` | Abonnement activé | partenaire | cloche, email, notification | part la nuit | `/partner/subscription` | Abonnement activé | — | I | SMS |
| `PAYMENT_SUCCESS` | Paiement confirmé | client | cloche, email, notification | part la nuit | `/orders` | Paiement confirmé | — | I | SMS |

## Événements : organisatrice (24)

| Type | Avis | Pour | Canaux | Nuit | Lien | Titre de la cloche | SMS max | Classement | Manque |
|---|---|---|---|---|---|---|---|---|---|
| `EVENT_VALIDATED` | Événement validé | partenaire | cloche, SMS, email, notification | reporté à 7 h (sauf < 12 h) | `/partner/events/…` | Événement validé | 150 | I | — |
| `EVENT_REJECTED` | Événement non validé | partenaire | cloche, SMS, email, notification | reporté à 7 h (sauf < 12 h) | `/partner/events/…` | Événement non validé | 154 | I | — |
| `EVENT_SUSPENDED` | Événement suspendu | partenaire | cloche, SMS, email, notification | part la nuit | `/partner/events/…` | Événement suspendu | 152 | I | — |
| `EVENT_REACTIVATED` | Événement réactivé | partenaire | cloche, SMS, email, notification | part la nuit | `/partner/events/…` | Événement réactivé | 130 | I | — |
| `EVENT_PUBLISHED_BY_ADMIN` | Événement publié par l’administration | partenaire | cloche, notification, email, SMS | reporté à 7 h (sauf < 12 h) | `/partner/events/…` | Événement publié | 124 | I | — |
| `FIRST_TICKET_SOLD` | Premier billet vendu | partenaire | cloche, notification, SMS, email | reporté à 7 h (sauf < 12 h) | `/partner/events/…?tab=ventes` | Premier billet vendu | 135 | P | — |
| `NEW_ORDER` | Nouvelle commande | partenaire | cloche | reporté à 7 h (sauf < 12 h) | `/partner/events/…?tab=ventes` | Nouvelle commande | — | P | (paire) cloche des ventes ; le SMS est SALES_UPDATE_SMS |
| `CATEGORY_SOLD_OUT` | Catégorie complète | partenaire | cloche, notification, SMS, email | reporté à 7 h (sauf < 12 h) | `/partner/events/…?tab=ventes` | Catégorie complète | 144 | P | — |
| `EVENT_SOLD_OUT` | Événement complet | partenaire | cloche, notification, SMS, email | reporté à 7 h (sauf < 12 h) | `/partner/events/…?tab=ventes` | Événement complet | 138 | P | — |
| `CANCEL_REFUNDS_DONE` | Remboursements d’une annulation terminés | partenaire | cloche, email, notification, SMS | reporté à 7 h (sauf < 12 h) | `/partner/events/…?tab=cloture` | Remboursements terminés | 138 | I | — |
| `CANCEL_REFUNDS_BLOCKED` | Remboursements d’une annulation bloqués | partenaire | cloche, email, notification, SMS | part la nuit | `/partner/events/…?tab=cloture` | Remboursements en attente | 156 | I | — |
| `PROMOTION_DECIDED` | Décision sur une mise en avant | partenaire | cloche, email, notification, SMS | reporté à 7 h (sauf < 12 h) | `/partner/events/…` | Mise en avant acceptée | 123 | I | — |
| `EVENT_CLOSED_BY_ADMIN` | Clôture d’un événement par l’administration | partenaire | cloche, SMS, email, notification | part la nuit | `/partner/events/…` | Événement clos par l'administration | 152 | I | — |
| `SHIFT_OPEN_AT_END` | Caisse encore ouverte à la fin | partenaire | cloche, notification, SMS, email | part la nuit | `/partner/events/…?tab=caisse` | Caisse encore ouverte | 157 | I | — |
| `EVENT_CANCELLED_BY_ADMIN` | Annulation d’un événement par l’administration | partenaire | cloche, SMS, email, notification | part la nuit | `/partner/events/…?tab=cloture` | Événement annulé par l'administration | 155 | I | — |
| `EVENT_SUBMITTED_ACK` | Événement envoyé en validation | partenaire | cloche, email, notification | part la nuit | `/partner/events/…` | Événement envoyé en validation | — | P | — |
| `EVENT_FINISHED` | Événement terminé | partenaire | cloche, email, notification | reporté à 7 h (sauf < 12 h) | `/partner/events/…?tab=cloture` | Événement terminé | — | P | — |
| `CLOSING_REPORT_READY` | Rapport de clôture prêt | partenaire | cloche, email, notification | reporté à 7 h (sauf < 12 h) | `/partner/events/…?tab=cloture` | Rapport de clôture prêt | — | P | — |
| `FUNDS_AVAILABLE` | Recettes disponibles | partenaire | cloche, email, notification, SMS | reporté à 7 h (sauf < 12 h) | `/partner/finance` | Recettes disponibles | 149 | I | — |
| `SCAN_REFUSALS_ALERT` | Refus en série à une porte | partenaire | cloche, notification, email, SMS | part la nuit | `/partner/events/…?tab=entrees` | Refus en série à une porte | 159 | I | — |
| `CASH_REFUND_MARKED_BY_ADMIN` | Espèces marquées rendues par l’administration | partenaire | cloche, notification, email, SMS | reporté à 7 h (sauf < 12 h) | `/partner/events/…?tab=cloture` | Espèces marquées rendues par l’administration | 126 | I | — |
| `SALES_UPDATE_SMS` | Ventes groupées par SMS | partenaire | SMS | reporté à 7 h (sauf < 12 h) | — | — | 102 | P | (paire) SMS des ventes ; la cloche est « Nouvelles ventes » (NEW_ORDER) |
| `PARTNER_DAILY_SUMMARY` | Résumé du matin (ventes de la veille) | partenaire | cloche, SMS, email, notification | reporté à 7 h (sauf < 12 h) | `/partner/events/…?tab=ventes` | Résumé de la veille | 130 | P | — |
| `PARTNER_REFUND_REQUESTS` | Remboursements demandés par des clients | partenaire | cloche, SMS, email, notification | reporté à 7 h (sauf < 12 h) | `/partner/events/…?tab=ventes` | Remboursements demandés | 126 | P | — |

## Événements : détenteurs de billets (9)

| Type | Avis | Pour | Canaux | Nuit | Lien | Titre de la cloche | SMS max | Classement | Manque |
|---|---|---|---|---|---|---|---|---|---|
| `EVENT_CANCELLED` | Annulation d’un événement | client | cloche, SMS, email, notification | part la nuit | `/tickets/…` | Événement annulé | 157 | I | — |
| `EVENT_SUSPENDED_HOLDER` | Suspension d’un événement (porteurs) | client | cloche, notification, email, SMS | reporté à 7 h (sauf < 12 h) | `/tickets/…` | Événement suspendu | 137 | I | désactivable par la personne |
| `EVENT_REACTIVATED_HOLDER` | Reprise d’un événement (porteurs) | client | cloche, notification, email, SMS | reporté à 7 h (sauf < 12 h) | `/events/…` | Événement de nouveau en ligne | 97 | P | — |
| `EVENT_CHANGED` | Changement d’un événement | client | cloche, notification, SMS, email | part la nuit | `/events/…` | Événement modifié | 159 | I | — |
| `REMINDER_J1` | Rappel la veille | client | cloche, notification, SMS, email | reporté à 7 h (sauf < 12 h) | `/tickets/…` | Rappel : c'est demain | 151 | P | — |
| `REMINDER_H3` | Rappel avant le début | client | cloche, notification, SMS, email | reporté à 7 h (sauf < 12 h) | `/tickets/…` | C'est bientôt | 153 | P | — |
| `EVENT_CLOSED_HOLDER` | Clôture d’un événement suspendu (porteurs) | client | cloche, SMS, email, notification | part la nuit | `/tickets/…` | Événement clos | 158 | I | — |
| `ENTRY_WELCOME` | Bienvenue à l’entrée | client | cloche, SMS, email, notification | part la nuit | `/events/…` | Bienvenue | 119 | P | — |
| `ENTRY_THANKS` | Merci du lendemain | client | cloche, SMS, email, notification | reporté à 7 h (sauf < 12 h) | `/events/…` | Merci d’être venu | 146 | P | — |

## Billets (19)

| Type | Avis | Pour | Canaux | Nuit | Lien | Titre de la cloche | SMS max | Classement | Manque |
|---|---|---|---|---|---|---|---|---|---|
| `PURCHASE_CONFIRMED` | Confirmation d’achat | client | cloche, SMS, email, notification | part la nuit | `/tickets/…` | Achat confirmé | 157 | I | — |
| `FREE_TICKETS_CONFIRMED` | Billets gratuits confirmés | client | cloche, SMS, email, notification | part la nuit | `/tickets/…` | Billets confirmés | 148 | I | — |
| `COUNTER_RECEIPT` | Reçu de vente au guichet | selon le cas | SMS | part la nuit | — | — | 130 | I | (paire) acheteur au guichet, souvent sans compte : seul le SMS est possible |
| `INVITATION_RECEIVED` | Invitation reçue | selon le cas | SMS, cloche, notification, email | part la nuit | `/tickets/…` | Invitation reçue | 159 | I | — |
| `TRANSFER_OFFERED` | Billet transféré (offre) | client | SMS, cloche, notification, email | part la nuit | `/tickets?tab=recus#recu-…` | Un billet vous est transféré | 160 | I | — |
| `TRANSFER_CANCELLED` | Transfert annulé | client | SMS, cloche, notification, email | part la nuit | `/tickets?tab=recus` | Transfert annulé | 104 | I | — |
| `TRANSFER_EXPIRED` | Transfert expiré | client | cloche, notification, email, SMS | reporté à 7 h (sauf < 12 h) | `/tickets/…` | Transfert expiré | 142 | I | — |
| `TRANSFER_CLAIMED_SENDER` | Transfert accepté (expéditeur) | client | cloche, notification, email, SMS | reporté à 7 h (sauf < 12 h) | `/tickets?tab=a-venir` | Billet accepté | 131 | I | — |
| `TRANSFER_RECEIVED` | Billet reçu | client | cloche, notification, email | part la nuit | `/tickets/…` | Billet reçu | — | I | SMS |
| `TICKET_SCANNED` | Entrée validée | client | cloche, notification, email | part la nuit | `/tickets/…` | Entrée validée | — | P | — |
| `REFUND_REQUESTED` | Remboursement demandé | client | cloche, SMS, email, notification | part la nuit | `/tickets/…` | Billet annulé par l'organisateur | 148 | I | — |
| `REFUND_PAID` | Remboursement versé | client | cloche, SMS, email, notification | part la nuit | `/tickets/…` | Remboursement versé | 118 | I | — |
| `REFUND_DELAYED` | Remboursement retardé | client | cloche, SMS, email, notification | part la nuit | `/tickets/…` | Remboursement retardé | 157 | I | — |
| `PAYMENT_REFUND_STARTED` | Remboursement d’un paiement | client | cloche, SMS, email, notification | part la nuit | `/tickets/…` | Remboursement de votre paiement | 154 | I | — |
| `TRANSFER_REVOKED` | Transfert annulé par un remboursement | client | SMS, cloche, notification, email | part la nuit | `/tickets?tab=recus` | Transfert annulé | 138 | I | — |
| `TRANSFER_DECLINED_SENDER` | Transfert refusé (expéditeur) | client | cloche, notification, email, SMS | reporté à 7 h (sauf < 12 h) | `/tickets/…` | Billet refusé | 138 | I | — |
| `TRANSFER_RECIPIENT_CHANGED` | Transfert annulé (numéro du destinataire changé) | client | cloche, notification, email, SMS | reporté à 7 h (sauf < 12 h) | `/tickets/…` | Transfert annulé | 158 | I | — |
| `TICKET_CANCELLED` | Billet annulé | selon le cas | cloche, SMS, email, notification | part la nuit | `/tickets/…` | Invitation annulée | 125 | I | — |
| `TICKET_REFUNDED_HOLDER` | Billet transféré annulé (détenteur) | client | SMS, cloche, notification, email | part la nuit | `/tickets/…` | Billet annulé | 154 | I | — |

## Contrôle d’accès et caisse (15)

| Type | Avis | Pour | Canaux | Nuit | Lien | Titre de la cloche | SMS max | Classement | Manque |
|---|---|---|---|---|---|---|---|---|---|
| `SHIFT_DISCREPANCY` | Écart de caisse | partenaire | cloche, SMS, notification, email | part la nuit | `/partner/events/…?tab=caisse` | Écart de caisse | 151 | I | — |
| `CONTROLLER_ASSIGNED` | Affectation d’un contrôleur | contrôleur | cloche, notification, SMS, email | part la nuit | `/controller/scanner` | Nouvelle affectation | 158 | I | — |
| `CONTROLLER_UNASSIGNED` | Retrait d’affectation | contrôleur | cloche, notification, SMS, email | part la nuit | `/controller/scanner` | Affectation retirée | 105 | I | — |
| `CONTROLLER_REMINDER` | Rappel de contrôle la veille | contrôleur | cloche, notification, SMS, email | reporté à 7 h (sauf < 12 h) | `/controller/scanner` | Contrôle demain | 160 | P | — |
| `SHIFT_CLOSED_BY_OTHER` | Caisse fermée par un tiers | contrôleur | cloche, notification, email, SMS | part la nuit | `/controller/scanner` | Caisse fermée | 132 | I | — |
| `CONTROLLER_ACTIVATED` | Compte de contrôleur activé | contrôleur | cloche, SMS, email, notification | part la nuit | `/controller/scanner` | Compte activé | 91 | P | — |
| `CONTROLLER_INVITATION` | Invitation à contrôler l’entrée | client | SMS, cloche, notification, email | part la nuit | `/invitations#invitation-…` | Invitation de Sabar Events | 158 | I | — |
| `CONTROLLER_INVITATION_ACCEPTED` | Invitation de contrôleur acceptée | partenaire | cloche, notification, email, SMS | reporté à 7 h (sauf < 12 h) | `/partner/team` | Invitation acceptée | 145 | P | — |
| `CONTROLLER_INVITATION_DECLINED` | Invitation de contrôleur refusée | partenaire | cloche, notification, email, SMS | reporté à 7 h (sauf < 12 h) | `/partner/team` | Invitation refusée | 151 | I | — |
| `CONTROLLER_INVITATION_EXPIRED` | Invitation de contrôleur sans réponse | partenaire | cloche, notification, email, SMS | reporté à 7 h (sauf < 12 h) | `/partner/team` | Invitation sans réponse | 154 | I | — |
| `CONTROLLER_BECAME_ADMIN` | Contrôleur devenu administrateur | partenaire | cloche, notification, email, SMS | reporté à 7 h (sauf < 12 h) | `/partner/team` | Contrôleur retiré de votre équipe | 150 | P | — |
| `CONTROLLER_EVENT_CANCELLED` | Annulation d’un événement contrôlé | contrôleur | cloche, SMS, email, notification | part la nuit | `/controller/scanner` | Contrôle annulé | 125 | I | — |
| `CONTROLLER_EVENT_CHANGED` | Changement d’un événement contrôlé | contrôleur | cloche, SMS, email, notification | part la nuit | `/controller/scanner` | Contrôle modifié | 146 | I | — |
| `CONTROLLER_EVENT_STATUS` | Suspension ou reprise d’un événement contrôlé | contrôleur | cloche, email, SMS, notification | part la nuit | `/controller/scanner` | Événement suspendu | 112 | I | — |
| `CONTROLLER_INVITE` | Invitation d’un contrôleur | selon le cas | SMS | immédiat | — | — | 160 | — | — |

## Salles (15)

| Type | Avis | Pour | Canaux | Nuit | Lien | Titre de la cloche | SMS max | Classement | Manque |
|---|---|---|---|---|---|---|---|---|---|
| `HALL_RESERVATION_PENDING` | Réservation de salle demandée | client | cloche, notification, email, SMS | part la nuit | `/halls/reservations/…` | Réservation demandée | 131 | I | — |
| `HALL_RESERVATION_REQUESTED` | Nouvelle réservation de salle | partenaire | cloche, notification, email, SMS | part la nuit | `/partner/halls/reservations/…` | Nouvelle réservation | 102 | I | — |
| `HALL_RESERVATION_CONFIRMED` | Réservation de salle confirmée | client | cloche, notification, email, SMS | part la nuit | `/halls/reservations/…` | Réservation confirmée | 125 | I | — |
| `HALL_BALANCE_PAID` | Solde d’une réservation de salle payé | selon le cas | cloche, notification, email, SMS | part la nuit | `/halls/reservations/…` | Réservation payée | 118 | I | — |
| `HALL_BALANCE_REMINDER` | Rappel du solde d’une réservation de salle | client | cloche, notification, email, SMS | reporté à 7 h (sauf < 12 h) | `/halls/reservations/…` | Solde à payer | 140 | I | — |
| `HALL_PAYMENT_DEADLINE_PASSED` | Délai de paiement d’une réservation de salle dépassé | client | cloche, notification, email, SMS | part la nuit | `/halls/reservations/…` | Délai de paiement dépassé | 132 | I | — |
| `HALL_RESERVATION_CANCELLED` | Réservation de salle annulée | client | cloche, notification, email, SMS | part la nuit | `/halls/reservations/…` | Réservation annulée | 127 | I | — |
| `HALL_RESERVATION_CANCELLED_PRO` | Réservation de salle annulée (salle) | partenaire | cloche, notification, email, SMS | part la nuit | `/partner/halls/reservations/…` | Réservation annulée | 144 | I | — |
| `HALL_PAYMENT_REFUNDED` | Paiement de salle remboursé | client | cloche, notification, email, SMS | part la nuit | `/halls/reservations/…` | Paiement remboursé | 138 | I | — |
| `HALL_REFUND_PAID` | Remboursement d’une réservation de salle versé | client | cloche, notification, email, SMS | part la nuit | `/halls/reservations/…` | Remboursement versé | 116 | I | — |
| `HALL_EVE_REMINDER` | Rappel la veille d’une réservation de salle | selon le cas | cloche, notification, email, SMS | reporté à 7 h (sauf < 12 h) | `/halls/reservations/…` | C’est demain | 105 | P | — |
| `HALL_EARNINGS_AVAILABLE` | Recettes d’une réservation de salle disponibles | partenaire | cloche, notification, email, SMS | reporté à 7 h (sauf < 12 h) | `/partner/halls/reservations/…` | Recettes disponibles | 115 | I | — |
| `HALL_VALIDATION_DECIDED` | Décision sur une salle | partenaire | cloche, notification, email, SMS | part la nuit | `/partner/halls/…` | Salle refusée | 147 | I | — |
| `ADMIN_HALL_SUBMITTED` | Salle à valider | administration | cloche, notification, email | part la nuit | `/admin/halls/…` | Salle à valider | — | I | — |
| `ADMIN_HALL_CHANGED` | Salle validée modifiée | administration | cloche, notification, email | part la nuit | `/admin/halls/…` | Salle modifiée | — | I | — |

## Réservations de tables de restaurant (16)

| Type | Avis | Pour | Canaux | Nuit | Lien | Titre de la cloche | SMS max | Classement | Manque |
|---|---|---|---|---|---|---|---|---|---|
| `TABLE_RESERVATION_CONFIRMED` | Réservation de table confirmée | client | cloche, notification, email, SMS | reporté à 7 h (sauf < 12 h) | `/tables/reservations/…` | Table réservée | 141 | I | — |
| `TABLE_REQUEST_SENT` | Demande de table envoyée | client | cloche, notification, email, SMS | part la nuit | `/tables/reservations/…` | Demande envoyée | 154 | I | — |
| `TABLE_REQUEST_TO_ANSWER` | Demande de table à accepter | partenaire | cloche, notification, email, SMS | part la nuit | `/partner/tables/reservations/…` | Demande à accepter | 147 | I | — |
| `TABLE_NEW_RESERVATION` | Nouvelle réservation de table | partenaire | cloche, notification, email, SMS | reporté à 7 h (sauf < 12 h) | `/partner/tables/reservations/…` | Nouvelle réservation | 140 | I | — |
| `TABLE_REQUEST_REFUSED` | Demande de table refusée | client | cloche, notification, email, SMS | part la nuit | `/tables/reservations/…` | Demande refusée | 147 | I | — |
| `TABLE_REQUEST_EXPIRED` | Demande de table sans réponse | client | cloche, notification, email, SMS | part la nuit | `/tables/reservations/…` | Demande sans réponse | 155 | I | — |
| `TABLE_HOLD_EXPIRED` | Acompte de table non payé à temps | client | cloche, notification, email, SMS | part la nuit | `/tables/reservations/…` | Acompte non payé à temps | 146 | I | — |
| `TABLE_RESERVATION_CANCELLED` | Réservation de table annulée | client | cloche, notification, email, SMS | part la nuit | `/tables/reservations/…` | Réservation annulée | 142 | I | — |
| `TABLE_RESERVATION_CANCELLED_PRO` | Réservation de table annulée (établissement) | partenaire | cloche, notification, email, SMS | part la nuit | `/partner/tables/reservations/…` | Réservation annulée | 150 | I | — |
| `TABLE_NO_SHOW` | Absence à une réservation de table | client | cloche, notification, email, SMS | part la nuit | `/tables/reservations/…` | Absence constatée | 155 | I | — |
| `TABLE_PAYMENT_REFUNDED` | Paiement de table remboursé | client | cloche, notification, email, SMS | part la nuit | `/tables/reservations/…` | Paiement remboursé | 146 | I | — |
| `TABLE_REMINDER` | Rappel de réservation de table | client | cloche, notification, email, SMS | reporté à 7 h (sauf < 12 h) | `/tables/reservations/…?rappel=1` | Votre table vous attend | 154 | I | désactivable par la personne |
| `TABLE_CLIENT_COMING` | Client qui confirme sa venue | partenaire | cloche, notification, email, SMS | reporté à 7 h (sauf < 12 h) | `/partner/tables/reservations/…` | Le client arrive | 136 | P | — |
| `TABLE_REFUND_PAID` | Remboursement d’une table versé | client | cloche, notification, email, SMS | part la nuit | `/tables/reservations/…` | Remboursement versé | 147 | I | — |
| `VENUE_VALIDATION_DECIDED` | Décision sur un établissement | partenaire | cloche, notification, email, SMS | reporté à 7 h (sauf < 12 h) | `/partner/tables/…` | Établissement refusé | 138 | I | — |
| `ADMIN_VENUE_SUBMITTED` | Établissement à valider | administration | cloche, notification, email | part la nuit | `/admin/venues/…` | Établissement à valider | — | I | — |

## Tables d’un événement (4)

| Type | Avis | Pour | Canaux | Nuit | Lien | Titre de la cloche | SMS max | Classement | Manque |
|---|---|---|---|---|---|---|---|---|---|
| `EVENT_TABLE_CONFIRMED` | Table d’un événement réservée | client | cloche, notification, email, SMS | part la nuit | `/tickets?tab=tables#table-…` | Table réservée | 146 | I | — |
| `EVENT_TABLE_SOLD` | Table d’un événement vendue | partenaire | cloche, notification, email, SMS | reporté à 7 h (sauf < 12 h) | `/partner/events/…?tab=ventes` | Table vendue | 126 | P | — |
| `EVENT_TABLE_SEATS_REMINDER` | Places de table à envoyer | client | cloche, notification, email, SMS | reporté à 7 h (sauf < 12 h) | `/tickets?tab=tables#table-…` | Vos invités attendent leurs places | 154 | I | désactivable par la personne |
| `ADMIN_EVENT_TABLES_CHANGED` | Tables modifiées après validation | administration | cloche, notification, email, SMS | reporté à 7 h (sauf < 12 h) | `/admin/events/…` | Tables modifiées après validation | 146 | P | — |

## Commandes (28)

| Type | Avis | Pour | Canaux | Nuit | Lien | Titre de la cloche | SMS max | Classement | Manque |
|---|---|---|---|---|---|---|---|---|---|
| `ORDER_RECEIVED` | Commande reçue | client | cloche, notification, email, SMS | part la nuit | `/orders/…` | Commande reçue | 122 | I | — |
| `ORDER_ACCEPTED` | Commande acceptée | client | cloche, notification, email, SMS | part la nuit | `/orders/…` | Commande acceptée | 104 | P | — |
| `ORDER_PREPARING` | Commande en préparation | client | cloche, notification, email, SMS | part la nuit | `/orders/…` | Commande en préparation | 110 | P | — |
| `ORDER_READY` | Commande prête | client | cloche, notification, email, SMS | part la nuit | `/orders/…` | Commande prête | 129 | I | — |
| `ORDER_ON_THE_WAY` | Commande en route | client | cloche, notification, email | part la nuit | `/orders/…` | Commande en route | — | P | (paire) le SMS « en route » est le SMS du code de remise (ORDER_HANDOVER_CODE, étape livraison) |
| `ORDER_HANDED_OVER` | Commande remise | client | cloche, notification, email, SMS | part la nuit | `/orders/…` | Commande livrée | 110 | I | — |
| `ORDER_CANCELLED` | Commande annulée | client | cloche, notification, email, SMS | part la nuit | `/orders/…` | Commande annulée | 107 | I | — |
| `ORDER_PAYMENT_REFUNDED` | Paiement de commande remboursé | client | cloche, notification, email, SMS | part la nuit | `/orders/…` | Paiement remboursé | 143 | I | — |
| `ORDER_REFUND_PAID` | Remboursement de commande versé | client | cloche, notification, email, SMS | part la nuit | `/orders/…` | Remboursement versé | 118 | I | — |
| `ORDER_PICKUP_REMINDER` | Commande à retirer | client | cloche, notification, email, SMS | part la nuit | `/orders/…` | Commande à retirer | 139 | I | — |
| `ORDER_NOT_COLLECTED` | Commande non retirée | client | cloche, notification, email, SMS | part la nuit | `/orders/…` | Commande non retirée | 127 | I | — |
| `ORDER_NEW` | Nouvelle commande à accepter | partenaire | cloche, notification, email, SMS | part la nuit | `/partner/orders/…` | Nouvelle commande | 130 | I | — |
| `ORDER_CANCELLED_PRO` | Commande annulée (établissement) | partenaire | cloche, notification, email, SMS | part la nuit | `/partner/orders/…` | Commande annulée | 89 | I | — |
| `ORDER_HANDED_OVER_PRO` | Commande remise par le livreur | partenaire | cloche, notification, email, SMS | reporté à 7 h (sauf < 12 h) | `/partner/orders/…` | Commande livrée | 78 | P | — |
| `ORDER_COURIER_ASSIGNED` | Livraison confiée | livreur | cloche, notification, email, SMS | part la nuit | `/courier/orders/…` | Livraison à faire | 134 | I | — |
| `ORDER_COURIER_CANCELLED` | Livraison annulée | livreur | cloche, notification, email, SMS | part la nuit | `/courier/orders` | Livraison annulée | 116 | I | — |
| `ORDER_COURIER_INVITED` | Invitation à livrer | livreur | cloche, notification, email | reporté à 7 h (sauf < 12 h) | `/courier/invitations/…` | Invitation à livrer | — | I | SMS |
| `ORDER_CODE_LOCKED` | Code de remise bloqué | client | cloche, notification, email, SMS | part la nuit | `/orders/…` | Code de remise bloqué | 136 | I | — |
| `ORDER_RESPONSE_REMINDER` | Commande sans réponse | partenaire | cloche, notification, email, SMS | part la nuit | `/partner/orders/…` | Commande sans réponse | 129 | I | — |
| `ORDER_PREP_REMINDER` | Commande programmée à préparer | partenaire | cloche, notification, email, SMS | part la nuit | `/partner/orders/…` | Commande à préparer | 93 | I | — |
| `ORDER_READY_COURIER` | Commande prête à livrer | livreur | cloche, notification, email, SMS | part la nuit | `/courier/orders/…` | Commande prête à livrer | 134 | I | — |
| `ORDER_SCHEDULED_REMINDER` | Commande programmée bientôt | client | cloche, notification, email, SMS | part la nuit | `/orders/…` | Votre commande approche | 138 | I | — |
| `ADMIN_PRODUCT_REVIEW` | Produit à vérifier | administration | cloche, email | reporté à 7 h (sauf < 12 h) | `/admin/products?produit=…` | Produit à vérifier | — | I | SMS, notification |
| `PRODUCT_REVIEW_DECIDED` | Produit vérifié | partenaire | cloche, notification, email | reporté à 7 h (sauf < 12 h) | `/partner/products/…` | Produit non vendu en ligne | — | I | (paire) cloche de la décision ; le SMS est PRODUCT_DECISION_SMS (sauf « à vérifier ») |
| `PRODUCT_DECISION_SMS` | SMS : produit vérifié | partenaire | SMS | reporté à 7 h (sauf < 12 h) | `/partner/products/…` | — | 126 | I | (paire) SMS de la décision ; cloche, notification et email : PRODUCT_REVIEW_DECIDED |
| `ADMIN_ORDER_REFUND_BLOCKED` | SMS : remboursement de commande à reprendre | administration | SMS | reporté à 7 h (sauf < 12 h) | `/admin/finance#versements-a-reprendre` | — | 122 | I | (paire) SMS ; la cloche, la notification et l’email sont ADMIN_REFUND_TO_RETRY (même versement) |
| `ADMIN_PRODUCTS_REVIEW_BATCH` | Produits déjà en vente à vérifier | administration | cloche, email | reporté à 7 h (sauf < 12 h) | `/admin/products` | Produits à vérifier | — | I | SMS, notification |
| `ORDER_HANDOVER_CODE` | Code de remise d’une commande | selon le cas | SMS | immédiat | — | — | 130 | — | — |

## Retraits (5)

| Type | Avis | Pour | Canaux | Nuit | Lien | Titre de la cloche | SMS max | Classement | Manque |
|---|---|---|---|---|---|---|---|---|---|
| `WITHDRAWAL_PAID` | Retrait versé | selon le cas | cloche, SMS, email, notification | part la nuit | `/partner/finance/retraits/…` | Retrait versé | 91 | I | — |
| `WITHDRAWAL_REJECTED` | Retrait refusé | selon le cas | cloche, SMS, email, notification | part la nuit | `/partner/finance/retraits/…` | Retrait refusé | 117 | I | — |
| `WITHDRAWAL_UNCERTAIN` | Retrait en vérification | selon le cas | cloche, SMS, notification, email | part la nuit | `/partner/finance/retraits/…` | Retrait en vérification | 120 | I | — |
| `WITHDRAWAL_DELAYED` | Retrait retardé | selon le cas | cloche, SMS, email, notification | part la nuit | `/partner/finance/retraits/…` | Retrait retardé | 126 | I | — |
| `OTP_WITHDRAWAL` | Code de confirmation d’un retrait | selon le cas | SMS | immédiat | — | — | 94 | — | — |

## Administration (29)

| Type | Avis | Pour | Canaux | Nuit | Lien | Titre de la cloche | SMS max | Classement | Manque |
|---|---|---|---|---|---|---|---|---|---|
| `ADMIN_EVENT_SUBMITTED` | Événement à valider | administration | cloche, notification, email | part la nuit | `/admin/events/…` | Événement à valider | — | I | — |
| `ADMIN_PERMISSIONS_CHANGED` | Droits d’administration modifiés | administration | cloche, notification, email, SMS | part la nuit | `/admin/mes-droits` | Vos droits ont changé | 80 | I | — |
| `ADMIN_PERMISSIONS_ALERT` | Droits d’un administrateur modifiés (super-administrateurs) | administration | cloche, notification, email, SMS | part la nuit | `/admin/users` | Droits d’un administrateur modifiés | 160 | I | — |
| `ADMIN_PARTNER_REGISTERED` | Nouvelle candidature partenaire | administration | cloche, notification, email | part la nuit | `/admin/dashboard?partenaires=ALL&dossier=…` | Nouvelle candidature | — | I | — |
| `ADMIN_REFUND_TO_RETRY` | Remboursement à reprendre | administration | cloche, notification, email | part la nuit | `/admin/finance#versements-a-reprendre` | Remboursement à reprendre | — | I | SMS |
| `ADMIN_DUPLICATE_PAYMENT` | Paiement en double remboursé | administration | cloche, notification, email | part la nuit | `/admin/finance#remboursements-a-verser` | Paiement en double remboursé | — | I | SMS |
| `ADMIN_CASHOUT_UNCERTAIN` | Versement incertain | administration | cloche, notification, email | part la nuit | `/admin/finance#versements-a-reprendre` | Versement incertain | — | I | SMS |
| `ADMIN_WITHDRAWAL_REJECTED` | Retrait refusé par l’opérateur | administration | cloche, email | part la nuit | `/admin/finance#du-aux-partenaires` | Retrait refusé par l'opérateur | — | I | SMS, notification |
| `ADMIN_FINANCE_DEBT` | Créance sur un compte | administration | cloche, email | part la nuit | `/admin/finance#creances` | Créance sur un compte | — | I | SMS, notification |
| `ADMIN_NOTIFICATION_FAILED` | Envoi en échec | administration | cloche, email | part la nuit | `/admin/notifications/…` | Envoi en échec | — | P | notification |
| `ADMIN_SMS_DAILY_THRESHOLD` | Volume de SMS indispensables élevé | administration | cloche, email | part la nuit | `/admin/notifications` | Volume de SMS indispensables élevé | — | P | notification |
| `ADMIN_SMS_CAP_GLOBAL` | Plafond de SMS atteint | administration | cloche, email | part la nuit | `/admin/notifications` | Plafond de SMS atteint : codes bloqués | — | I | SMS, notification |
| `ADMIN_SMS_CAP_NON_OTP` | Quota de SMS hors codes atteint | administration | cloche, email | part la nuit | `/admin/notifications` | Quota de SMS hors codes atteint | — | I | SMS, notification |
| `ADMIN_SMS_CAP_NEW_NUMBERS` | Codes d’inscription : part du jour atteinte | administration | cloche, email | part la nuit | `/admin/notifications` | Codes d’inscription : part du jour atteinte | — | I | SMS, notification |
| `ADMIN_SMS_OPTIONAL_80` | SMS optionnels à 80 % du plafond | administration | cloche, email | part la nuit | `/admin/notifications` | SMS optionnels : 80 % du plafond | — | P | notification |
| `ADMIN_SMS_FORECAST` | Rappels de demain au-delà du budget SMS | administration | cloche, email | part la nuit | `/admin/notifications` | Budget SMS de demain insuffisant | — | P | notification |
| `ADMIN_CASHOUT_TO_RESUME` | Versement à reprendre | administration | cloche, notification, email | part la nuit | `/admin/finance#versements-a-reprendre` | Versement à reprendre | — | I | SMS |
| `ADMIN_PARTNER_RESUBMITTED` | Dossier partenaire complété | administration | cloche, notification, email | part la nuit | `/admin/dashboard?partenaires=ALL&dossier=…` | Dossier complété | — | I | — |
| `ADMIN_EVENT_CANCELLED` | Événement annulé par l’organisateur | administration | cloche, email | part la nuit | `/admin/events/…` | Événement annulé par l'organisateur | — | P | notification |
| `ADMIN_EVENT_CHANGED` | Événement modifié après validation | administration | cloche, email | part la nuit | `/admin/events/…` | Événement modifié après validation | — | P | notification |
| `ADMIN_EVENT_PUBLISHED` | Événement publié par l’organisateur | administration | cloche, email | part la nuit | `/admin/events/…` | Événement publié par l'organisateur | — | P | notification |
| `ADMIN_EVENT_WITHDRAWN` | Soumission retirée par l’organisateur | administration | cloche, email | part la nuit | `/admin/events/…` | Soumission retirée par l'organisateur | — | P | notification |
| `ADMIN_REVIEW_SMS` | SMS aux administrateurs : à valider | administration | SMS | reporté à 7 h (sauf < 12 h) | `/admin/dashboard` | — | 135 | I | (paire) SMS regroupé des dossiers, événements, établissements et salles à valider |
| `SUPERADMIN_PROMOTED` | Nouveau super-administrateur (alerte) | administration | cloche, SMS, email | part la nuit | `/admin/users` | Nouveau super-administrateur | 152 | I | notification |
| `ADMIN_BACKUP_CODE_USED` | Code de secours utilisé (alerte) | administration | SMS, email | part la nuit | `/admin/securite` | Code de secours utilisé | 157 | I | cloche, notification |
| `ADMIN_PHONE_CHANGED` | Numéro d’un administrateur remplacé (ancien numéro) | selon le cas | SMS, email | part la nuit | `/profile` | Numéro de téléphone remplacé | 135 | I | (paire) SMS et email à l’ANCIEN numéro ; la cloche est ADMIN_PHONE_CONFIRMED |
| `ADMIN_PHONE_CONFIRMED` | Numéro d’un administrateur confirmé (nouveau numéro) | administration | cloche, SMS, email | part la nuit | `/profile` | Numéro de téléphone changé | 120 | I | notification |
| `OTP_ADMIN` | Code administrateur | selon le cas | SMS | immédiat | — | — | 88 | — | — |
| `OTP_ADMIN_PHONE` | Code au nouveau numéro d’un administrateur | selon le cas | SMS | immédiat | — | — | 147 | — | — |

## Textes complets

Pour chaque type : contenu de la cloche (exemple du catalogue) et SMS au pire cas mesuré. Les SMS synchrones (codes) suivent à la fin.

### `PURCHASE_CONFIRMED` — Confirmation d’achat

- Cloche : **Achat confirmé** — 2 billets pour « Gala de la Teranga » le sam. 14 nov. 2026 à 20:00. Total payé : 10 100 F CFA. Vos billets sont dans Mes billets.
- SMS au pire cas (157 septets, 1 segment) : `Event Village : achat confirmé, 999 billets Grande soirée "... Frais de service 99 999 F CFA, total payé 9 999 999 F CFA. https://app.eventvillage.sn/tickets`
- SMS avec des valeurs courantes : `Event Village : achat confirmé, 2 billets Gala de la Teranga. Frais de service 100 F CFA, total payé 10 100 F CFA. https://app.eventvillage.sn/tickets`

### `FREE_TICKETS_CONFIRMED` — Billets gratuits confirmés

- Cloche : **Billets confirmés** — 2 billets gratuits pour « Gala de la Teranga » le sam. 14 nov. 2026 à 20:00. Vos billets sont dans Mes billets.
- SMS au pire cas (148 septets, 1 segment) : `Event Village : 999 billets gratuits pour Grande soirée " Ndekk " - l... le mer. 30 sept. à 20:00. Vos billets : https://app.eventvillage.sn/tickets`
- SMS avec des valeurs courantes : `Event Village : 2 billets gratuits pour Gala de la Teranga le sam. 14 nov. à 20:00. Vos billets : https://app.eventvillage.sn/tickets`

### `COUNTER_RECEIPT` — Reçu de vente au guichet

- SMS au pire cas (130 septets, 1 segment) : `Event Village : achat au guichet pour Grande soirée " Ndekk " - l..., 999 billets, 9 999 999 F CFA. Entrée validée. Réf. 1F6E2B9C.`
- SMS avec des valeurs courantes : `Event Village : achat au guichet pour Gala de la Teranga, 2 billets, 10 000 F CFA. Entrée validée. Réf. 1F6E2B9C.`

### `INVITATION_RECEIVED` — Invitation reçue

- Cloche : **Invitation reçue** — 2 invitations pour « Gala de la Teranga » le sam. 14 nov. 2026 à 20:00 : vos billets sont dans Mes billets.
- SMS au pire cas (159 septets, 1 segment) : `Event Village : 999 invitations pour Grande soirée " Ndekk " -... le mer. 30 sept. à 20:00. Connectez-vous avec ce numéro : https://app.eventvillage.sn/tickets`
- SMS avec des valeurs courantes : `Event Village : 2 invitations pour Gala de la Teranga le sam. 14 nov. à 20:00. Connectez-vous avec ce numéro : https://app.eventvillage.sn/tickets`

### `TRANSFER_OFFERED` — Billet transféré (offre)

- Cloche : **Un billet vous est transféré** — Un billet pour « Gala de la Teranga » vous attend. Acceptez-le avant le jeu. 12 nov. 2026 à 18:30.
- SMS au pire cas (160 septets, 1 segment) : `Event Village : un billet Grande soirée " N... vous est transféré. Connectez-vous avec ce numéro avant le 30 sept. à 20:00 : https://app.eventvillage.sn/tickets`
- SMS avec des valeurs courantes : `Event Village : un billet Gala de la Teranga vous est transféré. Connectez-vous avec ce numéro avant le 12 nov. à 18:30 : https://app.eventvillage.sn/tickets`

### `TRANSFER_CANCELLED` — Transfert annulé

- Cloche : **Transfert annulé** — Le transfert du billet pour « Gala de la Teranga » a été annulé par son propriétaire.
- SMS au pire cas (104 septets, 1 segment) : `Event Village : le transfert du billet Grande soirée " Ndekk " - l... a été annulé par son propriétaire.`
- SMS avec des valeurs courantes : `Event Village : le transfert du billet Gala de la Teranga a été annulé par son propriétaire.`

### `TRANSFER_EXPIRED` — Transfert expiré

- Cloche : **Transfert expiré** — Votre billet pour « Gala de la Teranga » n'a pas été accepté à temps : il reste dans vos billets.
- SMS au pire cas (142 septets, 1 segment) : `Event Village : votre billet Grande soirée " Ndekk " - l... n'a pas été accepté à temps : il vous revient. https://app.eventvillage.sn/tickets`
- SMS avec des valeurs courantes : `Event Village : votre billet Gala de la Teranga n'a pas été accepté à temps : il vous revient. https://app.eventvillage.sn/tickets`

### `TRANSFER_CLAIMED_SENDER` — Transfert accepté (expéditeur)

- Cloche : **Billet accepté** — Votre billet pour « Gala de la Teranga » a été accepté par son destinataire.
- SMS au pire cas (131 septets, 1 segment) : `Event Village : votre billet Grande soirée " Ndekk " - l... a été accepté par son destinataire. https://app.eventvillage.sn/tickets`
- SMS avec des valeurs courantes : `Event Village : votre billet Gala de la Teranga a été accepté par son destinataire. https://app.eventvillage.sn/tickets`

### `TRANSFER_RECEIVED` — Billet reçu

- Cloche : **Billet reçu** — Le billet TCK-20261104-9E4B1C7A2F pour « Gala de la Teranga » du sam. 14 nov. 2026 à 20:00 est ajouté à Mes billets.

### `TICKET_SCANNED` — Entrée validée

- Cloche : **Entrée validée** — Votre billet pour « Gala de la Teranga » a été contrôlé à l'entrée.

### `EVENT_CANCELLED` — Annulation d’un événement

- Cloche : **Événement annulé** — « Gala de la Teranga » du sam. 14 nov. 2026 à 20:00 est annulé. Intempéries annoncées sur Dakar. Votre remboursement est en cours.
- SMS au pire cas (157 septets, 1 segment) : `Event Village : Grande soirée " Ndekk " - l... du mer. 30 sept. à 20:00 est annulé. Remboursement à l'acheteur d'origine. https://app.eventvillage.sn/tickets`
- SMS avec des valeurs courantes : `Event Village : Gala de la Teranga du sam. 14 nov. à 20:00 est annulé. Remboursement automatique en cours. https://app.eventvillage.sn/tickets`

### `EVENT_SUSPENDED_HOLDER` — Suspension d’un événement (porteurs)

- Cloche : **Événement suspendu** — « Gala de la Teranga » est suspendu pour le moment. Vos billets restent valables, vous serez prévenu de la suite.
- SMS au pire cas (137 septets, 1 segment) : `Event Village : Grande soirée " Ndekk " - l... est suspendu pour le moment. Vos billets restent valables, vous serez prévenu de la suite.`
- SMS avec des valeurs courantes : `Event Village : Gala de la Teranga est suspendu pour le moment. Vos billets restent valables, vous serez prévenu de la suite.`

### `EVENT_REACTIVATED_HOLDER` — Reprise d’un événement (porteurs)

- Cloche : **Événement de nouveau en ligne** — « Gala de la Teranga » reprend comme prévu. Vos billets restent valables.
- SMS au pire cas (97 septets, 1 segment) : `Event Village : Grande soirée " Ndekk " - l... reprend comme prévu. Vos billets restent valables.`
- SMS avec des valeurs courantes : `Event Village : Gala de la Teranga reprend comme prévu. Vos billets restent valables.`

### `EVENT_CHANGED` — Changement d’un événement

- Cloche : **Événement modifié** — « Gala de la Teranga » : nouvelle date : sam. 21 nov. 2026 à 21:00. Vos billets restent valables.
- SMS au pire cas (159 septets, 1 segment) : `Event Village : Grande soirée " N... reporté au mer. 30 sept. à 20:00, nouveau lieu. Remboursement total avant cette date : https://app.eventvillage.sn/tickets`
- SMS avec des valeurs courantes : `Event Village : Gala de la Teranga change de date : sam. 21 nov. à 21:00. Vos billets restent valables. https://app.eventvillage.sn/tickets`

### `REMINDER_J1` — Rappel la veille

- Cloche : **Rappel : c'est demain** — « Gala de la Teranga » demain à 20:00, CICAD, Diamniadio. Vos billets sont dans Mes billets.
- SMS au pire cas (151 septets, 1 segment) : `Event Village : rappel, Grande soirée " Ndekk " - l... demain à 20:00, Grande soirée " Ndekk " - l... Vos billets : https://app.eventvillage.sn/tickets`
- SMS avec des valeurs courantes : `Event Village : rappel, Gala de la Teranga demain à 20:00, CICAD. Vos billets : https://app.eventvillage.sn/tickets`

### `REMINDER_H3` — Rappel avant le début

- Cloche : **C'est bientôt** — « Gala de la Teranga » commence à 20:00 (CICAD). Ouvrez votre billet dans l'application avant d'arriver : il restera disponible sans réseau.
- SMS au pire cas (153 septets, 1 segment) : `Event Village : Grande soirée " Ndekk... à 20:00. Ouvrez votre billet avant d'arriver : QR renouvelé toutes les 20 s. https://app.eventvillage.sn/tickets`
- SMS avec des valeurs courantes : `Event Village : Gala de la Teranga à 20:00. Ouvrez votre billet avant d'arriver : QR renouvelé toutes les 20 s. https://app.eventvillage.sn/tickets`

### `REFUND_REQUESTED` — Remboursement demandé

- Cloche : **Billet annulé par l'organisateur** — Votre billet pour « Gala de la Teranga » est annulé par l'organisateur. Le remboursement de 5 000 F CFA est lancé sur votre compte Orange Money. Vous serez prévenu dès qu'il est versé.
- SMS au pire cas (148 septets, 1 segment) : `Event Village : billet Grande soirée " Ndekk... annulé par l'organisateur : remboursement de 9 999 999 F CFA en cours sur votre compte Orange Money.`
- SMS avec des valeurs courantes : `Event Village : billet Gala de la Teranga annulé par l'organisateur : remboursement de 5 000 F CFA en cours sur votre compte Orange Money.`

### `REFUND_PAID` — Remboursement versé

- Cloche : **Remboursement versé** — 5 000 F CFA vous ont été remboursés sur votre compte Wave pour « Gala de la Teranga ».
- SMS au pire cas (118 septets, 1 segment) : `Event Village : remboursement de 9 999 999 F CFA versé sur votre compte Orange Money (Grande soirée " Ndekk " - l...).`
- SMS avec des valeurs courantes : `Event Village : remboursement de 5 000 F CFA versé sur votre compte Wave (Gala de la Teranga).`

### `PASSWORD_CHANGED` — Mot de passe modifié

- Cloche : **Mot de passe modifié** — Le mot de passe de votre compte a été modifié. Si ce n'est pas vous : utilisez « Mot de passe oublié » sur la page de connexion, puis ouvrez la page Aide pour joindre le support.
- SMS au pire cas (153 septets, 1 segment) : `Event Village : le mot de passe de votre compte a été modifié. Si ce n'est pas vous : Mot de passe oublié sur https://app.eventvillage.sn/forgot-password`

### `PHONE_CHANGED` — Numéro de téléphone modifié

- Cloche : **Numéro de téléphone modifié** — Le numéro de téléphone de votre compte a été modifié. Si ce n'est pas vous, ouvrez la page Aide pour joindre le support.
- SMS au pire cas (112 septets, 1 segment) : `Event Village : le numéro de votre compte a été modifié. Si ce n'est pas vous : https://app.eventvillage.sn/aide`

### `EMAIL_CLAIMED_ELSEWHERE` — Adresse email validée par un autre compte

- Cloche : **Adresse email validée par un autre compte** — L’adresse email en attente sur votre compte vient d’être validée par un autre compte Event Village. Si c’est votre adresse, ne cliquez sur aucun lien que vous n’avez pas demandé et ouvrez la page Aide pour joindre le support.
- SMS au pire cas (152 septets, 1 segment) : `Event Village : l'adresse email en attente sur votre compte a été validée par un autre compte. Si c'est votre adresse : https://app.eventvillage.sn/aide`

### `PUSH_TEST` — Notification d’essai


### `EVENT_VALIDATED` — Événement validé

- Cloche : **Événement validé** — « Gala de la Teranga » est validé. Prochaines étapes : réglez les portes, invitez vos contrôleurs, générez le code PIN de caisse, puis publiez-le.
- SMS au pire cas (150 septets, 1 segment) : `Event Village : votre événement Grande soirée " Ndekk " - l... est validé. Publiez-le depuis votre espace : https://app.eventvillage.sn/partner/events`
- SMS avec des valeurs courantes : `Event Village : votre événement Gala de la Teranga est validé. Publiez-le depuis votre espace : https://app.eventvillage.sn/partner/events`

### `EVENT_REJECTED` — Événement non validé

- Cloche : **Événement non validé** — « Gala de la Teranga » n'est pas validé. Motif : Affiche illisible, merci d’en déposer une nouvelle.
- SMS au pire cas (154 septets, 1 segment) : `Event Village : événement Grande soirée " Ndekk... non validé. Motif : Grande soirée " Ndekk " - l'été à Sal... https://app.eventvillage.sn/partner/events`
- SMS avec des valeurs courantes : `Event Village : événement Gala de la Teranga non validé. Motif : Affiche illisible, merci d'en déposer... https://app.eventvillage.sn/partner/events`

### `EVENT_SUSPENDED` — Événement suspendu

- Cloche : **Événement suspendu** — « Gala de la Teranga » est suspendu par l'administration. Motif : Signalement en cours d’examen. Pour en parler, ouvrez la page Aide et joignez le support.
- SMS au pire cas (152 septets, 1 segment) : `Event Village : événement Grande soirée " Ndekk... suspendu. Motif : Grande soirée " Ndekk " - l'été à Sal... https://app.eventvillage.sn/partner/events`
- SMS avec des valeurs courantes : `Event Village : événement Gala de la Teranga suspendu. Motif : Signalement en cours d'examen. https://app.eventvillage.sn/partner/events`

### `EVENT_REACTIVATED` — Événement réactivé

- Cloche : **Événement réactivé** — « Gala de la Teranga » est de nouveau en ligne.
- SMS au pire cas (130 septets, 1 segment) : `Event Village : votre événement Grande soirée " Ndekk " - l... est de nouveau en ligne. https://app.eventvillage.sn/partner/events`
- SMS avec des valeurs courantes : `Event Village : votre événement Gala de la Teranga est de nouveau en ligne. https://app.eventvillage.sn/partner/events`

### `EVENT_PUBLISHED_BY_ADMIN` — Événement publié par l’administration

- Cloche : **Événement publié** — « Gala de la Teranga » a été publié par l'administration.
- SMS au pire cas (124 septets, 1 segment) : `Event Village : Grande soirée " Ndekk " - l... a été publié par l'administration. https://app.eventvillage.sn/partner/events`
- SMS avec des valeurs courantes : `Event Village : Gala de la Teranga a été publié par l'administration. https://app.eventvillage.sn/partner/events`

### `FIRST_TICKET_SOLD` — Premier billet vendu

- Cloche : **Premier billet vendu** — Le premier billet de « Gala de la Teranga » est vendu.
- SMS au pire cas (135 septets, 1 segment) : `Event Village : premier billet vendu pour Grande soirée " Ndekk " - l... Suivez vos ventes : https://app.eventvillage.sn/partner/events`
- SMS avec des valeurs courantes : `Event Village : premier billet vendu pour Gala de la Teranga. Suivez vos ventes : https://app.eventvillage.sn/partner/events`

### `NEW_ORDER` — Nouvelle commande

- Cloche : **Nouvelle commande** — 2 billets vendus pour « Gala de la Teranga » (+10 000 F CFA).

### `CATEGORY_SOLD_OUT` — Catégorie complète

- Cloche : **Catégorie complète** — La catégorie « Carré VIP » de « Gala de la Teranga » est complète.
- SMS au pire cas (144 septets, 1 segment) : `Event Village : la catégorie Grande soirée " Ndekk... de Grande soirée " Ndekk " - l... est complète. https://app.eventvillage.sn/partner/events`
- SMS avec des valeurs courantes : `Event Village : la catégorie Carré VIP de Gala de la Teranga est complète. https://app.eventvillage.sn/partner/events`

### `EVENT_SOLD_OUT` — Événement complet

- Cloche : **Événement complet** — Toutes les catégories de « Gala de la Teranga » sont vendues.
- SMS au pire cas (138 septets, 1 segment) : `Event Village : Grande soirée " Ndekk " - l... est complet, toutes les catégories sont vendues. https://app.eventvillage.sn/partner/events`
- SMS avec des valeurs courantes : `Event Village : Gala de la Teranga est complet, toutes les catégories sont vendues. https://app.eventvillage.sn/partner/events`

### `SHIFT_DISCREPANCY` — Écart de caisse

- Cloche : **Écart de caisse** — La caisse de Fatou Sow pour « Gala de la Teranga » est fermée. Il manque 2 500 F CFA. Justification : Erreur de monnaie rendue.
- SMS au pire cas (151 septets, 1 segment) : `Event Village : caisse de Grande soirée " N... fermée (Grande soirée " Ndekk...). Il manque 9 999 999 F CFA. https://app.eventvillage.sn/partner/events`
- SMS avec des valeurs courantes : `Event Village : caisse de Fatou Sow fermée (Gala de la Teranga). Il manque 2 500 F CFA. https://app.eventvillage.sn/partner/events`

### `WITHDRAWAL_PAID` — Retrait versé

- Cloche : **Retrait versé** — Votre retrait de 25 000 F CFA a été versé sur votre compte Wave.
- SMS au pire cas (91 septets, 1 segment) : `Event Village : votre retrait de 9 999 999 F CFA a été versé sur votre compte Orange Money.`
- SMS avec des valeurs courantes : `Event Village : votre retrait de 25 000 F CFA a été versé sur votre compte Wave.`

### `WITHDRAWAL_REJECTED` — Retrait refusé

- Cloche : **Retrait refusé** — Votre retrait de 25 000 F CFA a été refusé par l'opérateur. Le montant est revenu sur votre solde.
- SMS au pire cas (117 septets, 1 segment) : `Event Village : votre retrait de 9 999 999 F CFA a été refusé par l'opérateur. Le montant est revenu sur votre solde.`
- SMS avec des valeurs courantes : `Event Village : votre retrait de 25 000 F CFA a été refusé par l'opérateur. Le montant est revenu sur votre solde.`

### `WITHDRAWAL_UNCERTAIN` — Retrait en vérification

- Cloche : **Retrait en vérification** — Votre retrait de 25 000 F CFA est en vérification auprès de l'opérateur. Aucune action n'est nécessaire.
- SMS au pire cas (120 septets, 1 segment) : `Event Village : votre retrait de 9 999 999 F CFA est en vérification auprès de l'opérateur. Aucune action de votre part.`
- SMS avec des valeurs courantes : `Event Village : votre retrait de 25 000 F CFA est en vérification auprès de l'opérateur. Aucune action de votre part.`

### `CANCEL_REFUNDS_DONE` — Remboursements d’une annulation terminés

- Cloche : **Remboursements terminés** — Tous les remboursements en ligne de « Gala de la Teranga » sont versés.
- SMS au pire cas (138 septets, 1 segment) : `Event Village : tous les remboursements en ligne de Grande soirée " Ndekk " - l... sont versés. https://app.eventvillage.sn/partner/events`
- SMS avec des valeurs courantes : `Event Village : tous les remboursements en ligne de Gala de la Teranga sont versés. https://app.eventvillage.sn/partner/events`

### `CANCEL_REFUNDS_BLOCKED` — Remboursements d’une annulation bloqués

- Cloche : **Remboursements en attente** — Des remboursements de « Gala de la Teranga » sont bloqués : l'administration les reprend.
- SMS au pire cas (156 septets, 1 segment) : `Event Village : des remboursements de Grande soirée " Ndekk " - l... sont bloqués : l'administration les reprend. https://app.eventvillage.sn/partner/events`
- SMS avec des valeurs courantes : `Event Village : des remboursements de Gala de la Teranga sont bloqués : l'administration les reprend. https://app.eventvillage.sn/partner/events`

### `PARTNER_REGISTERED_ACK` — Inscription partenaire reçue

- Cloche : **Inscription reçue** — Votre demande de compte partenaire « Sabar Events » est en cours d'examen. Vous serez prévenu de la décision ici et par email.
- SMS au pire cas (127 septets, 1 segment) : `Event Village : votre demande de compte partenaire Grande soirée " Ndekk " - l'été à Sal... est enregistrée. Réponse sous 48 h.`
- SMS avec des valeurs courantes : `Event Village : votre demande de compte partenaire Sabar Events est enregistrée. Réponse sous 48 h.`

### `PARTNER_VALIDATED` — Compte partenaire validé

- Cloche : **Compte partenaire validé** — Votre compte partenaire « Sabar Events » est validé. Vous pouvez créer et publier vos événements.
- SMS au pire cas (133 septets, 1 segment) : `Event Village : votre compte partenaire Grande soirée " Ndekk " - l... est validé. Connectez-vous : https://app.eventvillage.sn/login`
- SMS avec des valeurs courantes : `Event Village : votre compte partenaire Sabar Events est validé. Connectez-vous : https://app.eventvillage.sn/login`

### `PARTNER_REJECTED` — Demande de compte partenaire refusée

- Cloche : **Demande refusée** — Votre demande de compte partenaire n'est pas acceptée. Motif : Pièce d’identité illisible. Vous pouvez compléter votre dossier une fois depuis votre tableau de bord.
- SMS au pire cas (158 septets, 1 segment) : `Event Village : demande partenaire refusée. Motif : Grande soirée " Ndekk " - l'été... Complétez votre dossier : https://app.eventvillage.sn/partner/dashboard`
- SMS avec des valeurs courantes : `Event Village : demande partenaire refusée. Motif : Pièce d'identité illisible. Complétez votre dossier : https://app.eventvillage.sn/partner/dashboard`

### `PARTNER_SUSPENDED` — Compte partenaire suspendu

- Cloche : **Compte suspendu** — Votre compte partenaire est suspendu. Motif : Signalements de fraude en cours d’examen. Ouvrez la page Aide pour joindre le support.
- SMS au pire cas (142 septets, 1 segment) : `Event Village : votre compte partenaire est suspendu. Motif : Grande soirée " Ndekk " - l'été à Sal... Aide : https://app.eventvillage.sn/aide`
- SMS avec des valeurs courantes : `Event Village : votre compte partenaire est suspendu. Motif : Signalements de fraude en cours d'examen. Aide : https://app.eventvillage.sn/aide`

### `PARTNER_REACTIVATED` — Compte partenaire réactivé

- Cloche : **Compte réactivé** — Votre compte partenaire est réactivé. Vous pouvez de nouveau publier vos événements.
- SMS au pire cas (104 septets, 1 segment) : `Event Village : votre compte partenaire est réactivé. Connectez-vous : https://app.eventvillage.sn/login`

### `TRIAL_STARTED` — Période d’essai activée

- Cloche : **Période d'essai activée** — Votre période d'essai de 60 jours commence aujourd'hui. Créez votre premier événement depuis votre tableau de bord.

### `SUBSCRIPTION_ACTIVATED` — Abonnement activé

- Cloche : **Abonnement activé** — Votre pack « Pro » est activé pour 30 jours.

### `PAYMENT_SUCCESS` — Paiement confirmé

- Cloche : **Paiement confirmé** — Votre paiement de 15 000 F CFA a été validé.

### `HALL_RESERVATION_PENDING` — Réservation de salle demandée

- Cloche : **Réservation demandée** — Votre demande pour « Salle des fêtes de Ngor » du sam. 5 déc. 2026 au dim. 6 déc. 2026 est enregistrée. Payez 126 000 F CFA avant 14:32 pour garder la date : sans paiement, elle sera libérée.
- SMS au pire cas (131 septets, 1 segment) : `Event Village : réservation demandée : Grande soirée " Ndekk..., le 30 sept. Payez 9 999 999 F CFA avant 20:00 pour garder la date.`
- SMS avec des valeurs courantes : `Event Village : réservation demandée : Salle des fetes de Ngor, du 5 déc. au 6 déc. Payez 126 000 F CFA avant 14:32 pour garder la date.`

### `HALL_RESERVATION_REQUESTED` — Nouvelle réservation de salle

- Cloche : **Nouvelle réservation** — « Salle des fêtes de Ngor » est réservée du sam. 5 déc. 2026 au dim. 6 déc. 2026. L’acompte est payé : 126 000 F CFA sur 420 000 F CFA.
- SMS au pire cas (102 septets, 1 segment) : `Event Village : nouvelle réservation de Grande soirée " Ndekk..., le 30 sept. Payée : 9 999 999 F CFA.`
- SMS avec des valeurs courantes : `Event Village : nouvelle réservation de Salle des fetes de Ngor, du 5 déc. au 6 déc. Acompte payé : 126 000 F CFA.`

### `HALL_RESERVATION_CONFIRMED` — Réservation de salle confirmée

- Cloche : **Réservation confirmée** — Votre réservation de « Salle des fêtes de Ngor » du sam. 5 déc. 2026 au dim. 6 déc. 2026 est confirmée. Il reste 294 000 F CFA à payer au plus tard le sam. 28 nov. 2026, sinon elle sera annulée.
- SMS au pire cas (125 septets, 1 segment) : `Event Village : réservation confirmée : Grande soirée " Ndekk..., le 30 sept. Reste 9 999 999 F CFA à payer avant le 30 sept.`
- SMS avec des valeurs courantes : `Event Village : réservation confirmée : Salle des fetes de Ngor, du 5 déc. au 6 déc. Reste 294 000 F CFA à payer avant le 28 nov.`

### `HALL_BALANCE_PAID` — Solde d’une réservation de salle payé

- Cloche : **Réservation payée** — Vous avez payé le solde : votre réservation de « Salle des fêtes de Ngor » du sam. 5 déc. 2026 au dim. 6 déc. 2026 est entièrement payée.
- SMS au pire cas (118 septets, 1 segment) : `Event Village : solde payé, merci ! Votre réservation de Grande soirée " Ndekk..., le 30 sept., est entièrement payée.`
- SMS avec des valeurs courantes : `Event Village : solde payé, merci ! Votre réservation de Salle des fetes de Ngor, du 5 déc. au 6 déc., est entièrement payée.`

### `HALL_BALANCE_REMINDER` — Rappel du solde d’une réservation de salle

- Cloche : **Solde à payer** — Il reste 294 000 F CFA à payer pour votre réservation de « Salle des fêtes de Ngor » du sam. 5 déc. 2026 au dim. 6 déc. 2026, au plus tard le sam. 28 nov. 2026. Sans paiement, la réservation sera annulée.
- SMS au pire cas (140 septets, 1 segment) : `Event Village : il reste 9 999 999 F CFA à payer pour Grande soirée " Ndekk... avant le 30 sept. Sans paiement, la réservation sera annulée.`
- SMS avec des valeurs courantes : `Event Village : il reste 294 000 F CFA à payer pour Salle des fetes de Ngor avant le 28 nov. Sans paiement, la réservation sera annulée.`

### `HALL_PAYMENT_DEADLINE_PASSED` — Délai de paiement d’une réservation de salle dépassé

- Cloche : **Délai de paiement dépassé** — Le solde n’a pas été payé à temps : votre réservation de « Salle des fêtes de Ngor » du sam. 5 déc. 2026 au dim. 6 déc. 2026 est annulée. Vous êtes remboursé de 63 000 F CFA sur votre compte de paiement.
- SMS au pire cas (132 septets, 1 segment) : `Event Village : délai de paiement dépassé, réservation annulée : Grande soirée " Ndekk... Remboursement de 9 999 999 F CFA en cours.`
- SMS avec des valeurs courantes : `Event Village : délai de paiement dépassé, réservation annulée : Salle des fetes de Ngor. Remboursement de 63 000 F CFA en cours.`

### `HALL_RESERVATION_CANCELLED` — Réservation de salle annulée

- Cloche : **Réservation annulée** — Votre réservation de « Salle des fêtes de Ngor » du sam. 5 déc. 2026 au dim. 6 déc. 2026 est annulée par la salle. Motif : Travaux imprévus dans la salle. Vous êtes remboursé de 126 000 F CFA sur votre compte de paiement.
- SMS au pire cas (127 septets, 1 segment) : `Event Village : la salle a annulé votre réservation : Grande soirée " Ndekk... Remboursement total de 9 999 999 F CFA en cours.`
- SMS avec des valeurs courantes : `Event Village : la salle a annulé votre réservation : Salle des fetes de Ngor. Remboursement total de 126 000 F CFA en cours.`

### `HALL_RESERVATION_CANCELLED_PRO` — Réservation de salle annulée (salle)

- Cloche : **Réservation annulée** — La réservation de « Salle des fêtes de Ngor » du sam. 5 déc. 2026 au dim. 6 déc. 2026 est annulée par le client. Le client récupère 63 000 F CFA ; la date est de nouveau libre.
- SMS au pire cas (144 septets, 1 segment) : `Event Village : réservation annulée par le client : Grande soirée " Ndekk..., le 30 sept. Le client récupère 9 999 999 F CFA. La date est libre.`
- SMS avec des valeurs courantes : `Event Village : réservation annulée par le client : Salle des fetes de Ngor, du 5 déc. au 6 déc. Le client récupère 63 000 F CFA. La date est libre.`

### `HALL_PAYMENT_REFUNDED` — Paiement de salle remboursé

- Cloche : **Paiement remboursé** — Votre paiement de 126 000 F CFA pour « Salle des fêtes de Ngor » est arrivé alors que la réservation n’était plus possible (date reprise, réservation annulée ou déjà payée). Il vous est remboursé sur votre compte Orange Money.
- SMS au pire cas (138 septets, 1 segment) : `Event Village : votre paiement de 9 999 999 F CFA pour Grande soirée " Ndekk... n'a pas pu servir. Il vous est remboursé sur Orange Money.`
- SMS avec des valeurs courantes : `Event Village : votre paiement de 126 000 F CFA pour Salle des fetes de Ngor n'a pas pu servir. Il vous est remboursé sur Orange Money.`

### `HALL_REFUND_PAID` — Remboursement d’une réservation de salle versé

- Cloche : **Remboursement versé** — 63 000 F CFA vous ont été versés sur votre compte Wave pour la réservation de « Salle des fêtes de Ngor » du sam. 5 déc. 2026 au dim. 6 déc. 2026.
- SMS au pire cas (116 septets, 1 segment) : `Event Village : 9 999 999 F CFA vous ont été versés sur Orange Money pour la réservation de Grande soirée " Ndekk...`
- SMS avec des valeurs courantes : `Event Village : 63 000 F CFA vous ont été versés sur Wave pour la réservation de Salle des fetes de Ngor.`

### `HALL_EVE_REMINDER` — Rappel la veille d’une réservation de salle

- Cloche : **C’est demain** — Votre réservation de « Salle des fêtes de Ngor » commence demain. Bonne fête !
- SMS au pire cas (105 septets, 1 segment) : `Event Village : rappel, votre réservation de Grande soirée " Ndekk... commence demain. Profitez-en bien !`
- SMS avec des valeurs courantes : `Event Village : rappel, votre réservation de Salle des fetes de Ngor commence demain. Profitez-en bien !`

### `HALL_EARNINGS_AVAILABLE` — Recettes d’une réservation de salle disponibles

- Cloche : **Recettes disponibles** — 400 000 F CFA de la réservation de « Salle des fêtes de Ngor » du sam. 5 déc. 2026 au dim. 6 déc. 2026 sont disponibles : vous pouvez les retirer depuis votre espace.
- SMS au pire cas (115 septets, 1 segment) : `Event Village : 9 999 999 F CFA disponibles pour Grande soirée " Ndekk..., le 30 sept. Retrait depuis votre espace.`
- SMS avec des valeurs courantes : `Event Village : 400 000 F CFA disponibles pour Salle des fetes de Ngor, du 5 déc. au 6 déc. Retrait depuis votre espace.`

### `HALL_VALIDATION_DECIDED` — Décision sur une salle

- Cloche : **Salle refusée** — « Salle des fêtes de Ngor » n’est pas acceptée. Motif : Photos manquantes. Modifiez-la puis renvoyez-la en validation.
- SMS au pire cas (147 septets, 1 segment) : `Event Village : votre salle Grande soirée " Ndekk " - l... n'est pas acceptée. Motif : Grande soirée " Ndekk " - l'été à Saly : édition spéciale...`
- SMS avec des valeurs courantes : `Event Village : votre salle Salle des fetes de Ngor n'est pas acceptée. Motif : Photos manquantes.`

### `TABLE_RESERVATION_CONFIRMED` — Réservation de table confirmée

- Cloche : **Table réservée** — Votre table chez « Le Grand Bleu » est réservée le sam. 5 déc. 2026 à 20:00 pour 4 personnes. Elle vous est gardée jusqu’à 20 h 30. Acompte payé : 21 000 F CFA. Annulation gratuite avant le sam. 5 déc. 2026 à 18:00. Un empêchement ? Annulez depuis votre réservation pour libérer la table.
- SMS au pire cas (141 septets, 1 segment) : `Event Village : table chez Grande soirée " Nde... le 30 sept. à 20:00, 99 pers. Gardée jusqu'à 20 h 30. https://app.eventvillage.sn/t/k7m2p9x`
- SMS avec des valeurs courantes : `Event Village : table chez Le Grand Bleu le 5 déc. à 20:00, 4 pers. Gardée jusqu'à 20 h 30. https://app.eventvillage.sn/t/k7m2p9x`

### `TABLE_REQUEST_SENT` — Demande de table envoyée

- Cloche : **Demande envoyée** — Votre demande de table chez « Le Grand Bleu » le sam. 5 déc. 2026 à 20:00 pour 4 personnes est envoyée. L’établissement répond avant le 5 déc. à 18 h : vous recevrez sa réponse ici. Sans réponse, la demande est annulée et l’acompte vous est rendu, vous n’avez rien à faire.
- SMS au pire cas (154 septets, 1 segment) : `Event Village : demande envoyée à Grande soirée "... pour le 30 sept. à 20:00, 99 pers. Réponse avant 30 sept. 20 h. https://app.eventvillage.sn/t/k7m2p9x`
- SMS avec des valeurs courantes : `Event Village : demande envoyée à Le Grand Bleu pour le 5 déc. à 20:00, 4 pers. Réponse avant 5 déc. 18 h. https://app.eventvillage.sn/t/k7m2p9x`

### `TABLE_REQUEST_TO_ANSWER` — Demande de table à accepter

- Cloche : **Demande à accepter** — Nouvelle demande chez « Le Grand Bleu » : 4 personnes le sam. 5 déc. 2026 à 20:00, table 12. Répondez avant le 5 déc. à 18 h ; sans réponse, elle est annulée et le client remboursé.
- SMS au pire cas (147 septets, 1 segment) : `Event Village : demande chez Grande soirée "... : 99 pers. le 30 sept. à 20:00. Répondez avant 30 sept. 20 h. https://app.eventvillage.sn/t/k7m2p9x`
- SMS avec des valeurs courantes : `Event Village : demande chez Le Grand Bleu : 4 pers. le 5 déc. à 20:00. Répondez avant 5 déc. 18 h. https://app.eventvillage.sn/t/k7m2p9x`

### `TABLE_NEW_RESERVATION` — Nouvelle réservation de table

- Cloche : **Nouvelle réservation** — « Le Grand Bleu » : 4 personnes le sam. 5 déc. 2026 à 20:00, table 12. Acompte payé : 21 000 F CFA. Elle est sur votre planning ; la table est gardée jusqu’à 20 h 30.
- SMS au pire cas (140 septets, 1 segment) : `Event Village : nouvelle réservation chez Grande soirée "... : 99 pers. le 30 sept. à 20:00, table 12. https://app.eventvillage.sn/t/k7m2p9x`
- SMS avec des valeurs courantes : `Event Village : nouvelle réservation chez Le Grand Bleu : 4 pers. le 5 déc. à 20:00, table 12. https://app.eventvillage.sn/t/k7m2p9x`

### `TABLE_REQUEST_REFUSED` — Demande de table refusée

- Cloche : **Demande refusée** — « Le Grand Bleu » ne peut pas vous recevoir le sam. 5 déc. 2026 à 20:00. Motif : Complet ce soir-là. Vous êtes remboursé de 21 000 F CFA sur votre compte de paiement. Choisissez une autre heure depuis la fiche de l’établissement.
- SMS au pire cas (147 septets, 1 segment) : `Event Village : Grande soirée "... ne peut pas vous recevoir le 30 sept. à 20:00. 9 999 999 F CFA remboursés. https://app.eventvillage.sn/t/k7m2p9x`
- SMS avec des valeurs courantes : `Event Village : Le Grand Bleu ne peut pas vous recevoir le 5 déc. à 20:00. 21 000 F CFA remboursés. https://app.eventvillage.sn/t/k7m2p9x`

### `TABLE_REQUEST_EXPIRED` — Demande de table sans réponse

- Cloche : **Demande sans réponse** — « Le Grand Bleu » n’a pas répondu à temps : votre demande le sam. 5 déc. 2026 à 20:00 est annulée. Vous êtes remboursé de 21 000 F CFA sur votre compte de paiement. Vous pouvez réserver ailleurs ou à une autre heure.
- SMS au pire cas (155 septets, 1 segment) : `Event Village : Grande soirée "... n'a pas répondu à temps : demande du 30 sept. annulée. 9 999 999 F CFA remboursés. https://app.eventvillage.sn/t/k7m2p9x`
- SMS avec des valeurs courantes : `Event Village : Le Grand Bleu n'a pas répondu à temps : demande du 5 déc. annulée. 21 000 F CFA remboursés. https://app.eventvillage.sn/t/k7m2p9x`

### `TABLE_HOLD_EXPIRED` — Acompte de table non payé à temps

- Cloche : **Acompte non payé à temps** — L’acompte n’a pas été payé à temps : la table chez « Le Grand Bleu » le sam. 5 déc. 2026 à 20:00 est libérée. Pour la garder, refaites une demande depuis la fiche de l’établissement.
- SMS au pire cas (146 septets, 1 segment) : `Event Village : acompte non payé à temps : la table chez Grande soirée "... le 30 sept. à 20:00 est libérée. https://app.eventvillage.sn/t/k7m2p9x`
- SMS avec des valeurs courantes : `Event Village : acompte non payé à temps : la table chez Le Grand Bleu le 5 déc. à 20:00 est libérée. https://app.eventvillage.sn/t/k7m2p9x`

### `TABLE_RESERVATION_CANCELLED` — Réservation de table annulée

- Cloche : **Réservation annulée** — Votre réservation chez « Le Grand Bleu » le sam. 5 déc. 2026 à 20:00 est annulée par l’établissement. Motif : Fermeture exceptionnelle : travaux dans la salle. Vous êtes remboursé de 21 000 F CFA sur votre compte de paiement.
- SMS au pire cas (142 septets, 1 segment) : `Event Village : Grande soirée "... a annulé votre table le 30 sept. à 20:00. 9 999 999 F CFA remboursés. https://app.eventvillage.sn/t/k7m2p9x`
- SMS avec des valeurs courantes : `Event Village : Le Grand Bleu a annulé votre table le 5 déc. à 20:00. 21 000 F CFA remboursés. https://app.eventvillage.sn/t/k7m2p9x`

### `TABLE_RESERVATION_CANCELLED_PRO` — Réservation de table annulée (établissement)

- Cloche : **Réservation annulée** — La réservation chez « Le Grand Bleu » le sam. 5 déc. 2026 à 20:00 (4 personnes) est annulée par le client. Le client récupère 21 000 F CFA. La table est de nouveau libre sur votre planning.
- SMS au pire cas (150 septets, 1 segment) : `Event Village : table chez Grande soirée "... le 30 sept. à 20:00 (99 pers.) annulée par le client. Table libre. https://app.eventvillage.sn/t/k7m2p9x`
- SMS avec des valeurs courantes : `Event Village : table chez Le Grand Bleu le 5 déc. à 20:00 (4 pers.) annulée par le client. Table libre. https://app.eventvillage.sn/t/k7m2p9x`

### `TABLE_NO_SHOW` — Absence à une réservation de table

- Cloche : **Absence constatée** — Vous n’êtes pas venu chez « Le Grand Bleu » le sam. 5 déc. 2026 à 20:00 : la table est libérée. Selon les conditions de réservation, l’acompte n’est pas remboursé. Une prochaine fois, annulez depuis votre réservation si vous avez un empêchement.
- SMS au pire cas (155 septets, 1 segment) : `Event Village : absence constatée chez Grande soirée "... le 30 sept. à 20:00 : table libérée, acompte non remboursé. https://app.eventvillage.sn/t/k7m2p9x`
- SMS avec des valeurs courantes : `Event Village : absence constatée chez Le Grand Bleu le 5 déc. à 20:00 : table libérée, acompte non remboursé. https://app.eventvillage.sn/t/k7m2p9x`

### `TABLE_PAYMENT_REFUNDED` — Paiement de table remboursé

- Cloche : **Paiement remboursé** — Votre paiement de 21 000 F CFA pour « Le Grand Bleu » est arrivé alors que la réservation n’était plus possible (table reprise, réservation annulée ou déjà payée). Il vous est remboursé sur votre compte Orange Money : vous n’avez rien à faire.
- SMS au pire cas (146 septets, 1 segment) : `Event Village : paiement de 9 999 999 F CFA pour Grande soirée "... non utilisé, remboursé sur Orange Money. https://app.eventvillage.sn/t/k7m2p9x`
- SMS avec des valeurs courantes : `Event Village : paiement de 21 000 F CFA pour Le Grand Bleu non utilisé, remboursé sur Orange Money. https://app.eventvillage.sn/t/k7m2p9x`

### `TABLE_REMINDER` — Rappel de réservation de table

- Cloche : **Votre table vous attend** — Votre table chez « Le Grand Bleu » vous attend le sam. 5 déc. 2026 à 20:00 pour 4 personnes, gardée jusqu’à 20 h 30. Dites-le à l’établissement : « J’arrive » ou « Annuler » depuis votre réservation.
- SMS au pire cas (154 septets, 1 segment) : `Event Village : votre table chez Grande soirée "... à 20:00, 99 pers., gardée jusqu'à 20 h 30. J'arrive ou annuler : https://app.eventvillage.sn/t/k7m2p9x`
- SMS avec des valeurs courantes : `Event Village : votre table chez Le Grand Bleu à 20:00, 4 pers., gardée jusqu'à 20 h 30. J'arrive ou annuler : https://app.eventvillage.sn/t/k7m2p9x`

### `TABLE_CLIENT_COMING` — Client qui confirme sa venue

- Cloche : **Le client arrive** — Le client de 4 personnes le sam. 5 déc. 2026 à 20:00 (table 12) chez « Le Grand Bleu » confirme sa venue. Table gardée jusqu’à 20 h 30 ; marquez-le « Client arrivé » à son arrivée.
- SMS au pire cas (136 septets, 1 segment) : `Event Village : le client de 99 pers. à 20:00, table 12, confirme sa venue chez Grande soirée "... https://app.eventvillage.sn/t/k7m2p9x`
- SMS avec des valeurs courantes : `Event Village : le client de 4 pers. à 20:00, table 12, confirme sa venue chez Le Grand Bleu. https://app.eventvillage.sn/t/k7m2p9x`

### `TABLE_REFUND_PAID` — Remboursement d’une table versé

- Cloche : **Remboursement versé** — Le remboursement de 21 000 F CFA pour votre réservation chez « Le Grand Bleu » le sam. 5 déc. 2026 à 20:00 est versé sur votre compte Orange Money. Vous n’avez rien à faire.
- SMS au pire cas (147 septets, 1 segment) : `Event Village : remboursement de 9 999 999 F CFA versé sur Orange Money pour la table chez Grande soirée "... https://app.eventvillage.sn/t/k7m2p9x`
- SMS avec des valeurs courantes : `Event Village : remboursement de 21 000 F CFA versé sur Orange Money pour la table chez Le Grand Bleu. https://app.eventvillage.sn/t/k7m2p9x`

### `EVENT_TABLE_CONFIRMED` — Table d’un événement réservée

- Cloche : **Table réservée** — Votre table 12 (Table VIP, 6 places) pour « Gala de la Teranga » est réservée. Total payé : 157 500 F CFA. Envoyez les places à vos invités depuis Mes billets : chacun aura son billet.
- SMS au pire cas (146 septets, 1 segment) : `Event Village : table 999 réservée pour Grande soirée " Ndekk " - l..., 99 places. Envoyez-les à vos invités : https://app.eventvillage.sn/tickets`
- SMS avec des valeurs courantes : `Event Village : table 12 réservée pour Gala de la Teranga, 6 places. Envoyez-les à vos invités : https://app.eventvillage.sn/tickets`

### `EVENT_TABLE_SOLD` — Table d’un événement vendue

- Cloche : **Table vendue** — Une table vendue pour « Gala de la Teranga » : 6 places, +150 000 F CFA.
- SMS au pire cas (126 septets, 1 segment) : `Event Village : 99 tables vendues pour Grande soirée " Ndekk " - l... (999 places). https://app.eventvillage.sn/partner/events`
- SMS avec des valeurs courantes : `Event Village : une table vendue pour Gala de la Teranga (6 places). https://app.eventvillage.sn/partner/events`

### `EVENT_TABLE_SEATS_REMINDER` — Places de table à envoyer

- Cloche : **Vos invités attendent leurs places** — Il vous reste 4 places à envoyer pour votre table 12 à « Gala de la Teranga », demain à 20:00. Envoyez-les depuis Mes billets : chaque invité aura son billet.
- SMS au pire cas (154 septets, 1 segment) : `Event Village : il vous reste 99 places à envoyer pour la table 999, Grande soirée " Ndekk " - l... demain. https://app.eventvillage.sn/tickets?tab=tables`
- SMS avec des valeurs courantes : `Event Village : il vous reste 4 places à envoyer pour la table 12, Gala de la Teranga demain. https://app.eventvillage.sn/tickets?tab=tables`

### `ADMIN_EVENT_TABLES_CHANGED` — Tables modifiées après validation

- Cloche : **Tables modifiées après validation** — « Gala de la Teranga » de Sabar Events : tables ou types de tables ajoutés, modifiés ou retirés après validation. Vérifiez la fiche.
- SMS au pire cas (146 septets, 1 segment) : `Event Village : tables modifiées après validation pour Grande soirée " Ndekk " - l... Vérifiez la fiche : https://app.eventvillage.sn/admin/events`
- SMS avec des valeurs courantes : `Event Village : tables modifiées après validation pour Gala de la Teranga. Vérifiez la fiche : https://app.eventvillage.sn/admin/events`

### `VENUE_VALIDATION_DECIDED` — Décision sur un établissement

- Cloche : **Établissement refusé** — « Le Grand Bleu » n’est pas accepté. Motif : Photos manquantes. Corrigez-le puis renvoyez-le en validation depuis sa fiche.
- SMS au pire cas (138 septets, 1 segment) : `Event Village : votre établissement Grande soirée " Ndekk... n'est pas accepté. Motif : Grande soirée " Ndekk " - l'été à Saly : éditio...`
- SMS avec des valeurs courantes : `Event Village : votre établissement Le Grand Bleu n'est pas accepté. Motif : Photos manquantes.`

### `PROMOTION_DECIDED` — Décision sur une mise en avant

- Cloche : **Mise en avant acceptée** — La mise en avant de « Gala de la Teranga » est acceptée.
- SMS au pire cas (123 septets, 1 segment) : `Event Village : la mise en avant de Grande soirée " Ndekk " - l... est acceptée. https://app.eventvillage.sn/partner/events`
- SMS avec des valeurs courantes : `Event Village : la mise en avant de Gala de la Teranga est acceptée. https://app.eventvillage.sn/partner/events`

### `CONTROLLER_ASSIGNED` — Affectation d’un contrôleur

- Cloche : **Nouvelle affectation** — Vous contrôlez l'entrée de « Gala de la Teranga » le sam. 14 nov. 2026 à 20:00, point d'entrée Porte Nord. Encaissement des espèces autorisé.
- SMS au pire cas (158 septets, 1 segment) : `Event Village : affectation à l'entrée de Grande soirée " Ndekk..., mer. 30 sept. à 20:00, point Grande so..., et 98 autres. https://app.eventvillage.sn/login`
- SMS avec des valeurs courantes : `Event Village : affectation à l'entrée de Gala de la Teranga, sam. 14 nov. à 20:00, point Porte Nord, et 1 autre. https://app.eventvillage.sn/login`

### `CONTROLLER_UNASSIGNED` — Retrait d’affectation

- Cloche : **Affectation retirée** — Vous ne contrôlez plus l'entrée de « Gala de la Teranga ».
- SMS au pire cas (105 septets, 1 segment) : `Event Village : votre affectation à l'entrée de Grande soirée " Ndekk " - l... est retirée, et 98 autres.`
- SMS avec des valeurs courantes : `Event Village : votre affectation à l'entrée de Gala de la Teranga est retirée, et 1 autre.`

### `CONTROLLER_REMINDER` — Rappel de contrôle la veille

- Cloche : **Contrôle demain** — Demain « Gala de la Teranga » à 20:00, point d'entrée Porte Nord, espèces autorisées.
- SMS au pire cas (160 septets, 1 segment) : `Event Village : demain Grande soirée " Ndekk " - l... à 20:00, point Grande soirée " N..., espèces non autorisées. Connexion : https://app.eventvillage.sn/login`
- SMS avec des valeurs courantes : `Event Village : demain Gala de la Teranga à 20:00, point Porte Nord, espèces autorisées. Connexion : https://app.eventvillage.sn/login`

### `SHIFT_CLOSED_BY_OTHER` — Caisse fermée par un tiers

- Cloche : **Caisse fermée** — Votre caisse pour « Gala de la Teranga » a été fermée par l'organisateur. Montant déclaré : 47 500 F CFA.
- SMS au pire cas (132 septets, 1 segment) : `Event Village : votre caisse pour Grande soirée " Ndekk " - l... a été fermée par l'organisateur. Montant déclaré : 9 999 999 F CFA.`
- SMS avec des valeurs courantes : `Event Village : votre caisse pour Gala de la Teranga a été fermée par l'organisateur. Montant déclaré : 47 500 F CFA.`

### `CONTROLLER_ACTIVATED` — Compte de contrôleur activé

- Cloche : **Compte activé** — Votre compte est activé : vous pouvez scanner les billets.
- SMS au pire cas (91 septets, 1 segment) : `Event Village : votre compte est activé. Vous pouvez vous connecter et scanner les billets.`

### `ADMIN_EVENT_SUBMITTED` — Événement à valider

- Cloche : **Événement à valider** — « Gala de la Teranga » de Sabar Events attend votre validation.

### `ORDER_RECEIVED` — Commande reçue

- Cloche : **Commande reçue** — Votre commande CMD-261205-A1B2C3 est transmise à « Chez Fatou, cuisine du Sénégal et grillades ». L’établissement l’accepte au plus tard à 12:15 ; sans réponse, elle est annulée et vous êtes remboursé. Suivez chaque étape depuis la commande.
- SMS au pire cas (122 septets, 1 segment) : `Event Village : commande CMD-261205-A1B2C3 transmise à Grande soirée " Ndekk " -... Réponse avant 20:00, sinon remboursée.`
- SMS avec des valeurs courantes : `Event Village : commande CMD-261205-A1B2C3 transmise à Chez Fatou, cuisine du Sé... Réponse avant 12:15, sinon remboursée.`

### `ORDER_ACCEPTED` — Commande acceptée

- Cloche : **Commande acceptée** — « Chez Fatou, cuisine du Sénégal et grillades » a accepté votre commande CMD-261205-A1B2C3, prévue vers 12:45. Au départ du livreur, vous recevrez le code à lui donner. Reste à payer à la remise : 875 000 F CFA.
- SMS au pire cas (104 septets, 1 segment) : `Event Village : Grande soirée " Ndekk " -... a accepté la commande CMD-261205-A1B2C3. Prévue vers 20:00.`
- SMS avec des valeurs courantes : `Event Village : Chez Fatou, cuisine du Sé... a accepté la commande CMD-261205-A1B2C3. Prévue vers 12:45.`

### `ORDER_PREPARING` — Commande en préparation

- Cloche : **Commande en préparation** — Votre commande CMD-261205-A1B2C3 est en préparation chez « Chez Fatou, cuisine du Sénégal et grillades », prévue vers 12:45. Elle ne peut plus être annulée.
- SMS au pire cas (110 septets, 1 segment) : `Event Village : commande CMD-261205-A1B2C3 en préparation chez Grande soirée " Ndekk " -... Prévue vers 20:00.`
- SMS avec des valeurs courantes : `Event Village : commande CMD-261205-A1B2C3 en préparation chez Chez Fatou, cuisine du Sé... Prévue vers 12:45.`

### `ORDER_READY` — Commande prête

- Cloche : **Commande prête** — Votre commande CMD-261205-A1B2C3 vous attend chez « Chez Fatou, cuisine du Sénégal et grillades ». Donnez au comptoir le code reçu par SMS. Reste à payer sur place : 875 000 F CFA.
- SMS au pire cas (129 septets, 1 segment) : `Event Village : votre commande CMD-261205-A1B2C3 vous attend chez Grande soirée " Ndekk " -... Le code de retrait arrive par SMS.`
- SMS avec des valeurs courantes : `Event Village : votre commande CMD-261205-A1B2C3 vous attend chez Chez Fatou, cuisine du Sé... Le code de retrait arrive par SMS.`

### `ORDER_ON_THE_WAY` — Commande en route

- Cloche : **Commande en route** — Votre commande CMD-261205-A1B2C3 est en route, arrivée prévue vers 12:45. À son arrivée, donnez au livreur le code reçu par SMS. Reste à payer au livreur : 875 000 F CFA.

### `ORDER_HANDED_OVER` — Commande remise

- Cloche : **Commande livrée** — Votre commande CMD-261205-A1B2C3 de « Chez Fatou, cuisine du Sénégal et grillades » est livrée. Merci et à bientôt !
- SMS au pire cas (110 septets, 1 segment) : `Event Village : commande CMD-261205-A1B2C3 de Grande soirée " Ndekk " - l... livrée. Merci et à la prochaine !`
- SMS avec des valeurs courantes : `Event Village : commande CMD-261205-A1B2C3 de Chez Fatou, cuisine du Séné... livrée. Merci et à la prochaine !`

### `ORDER_CANCELLED` — Commande annulée

- Cloche : **Commande annulée** — Votre commande CMD-261205-A1B2C3 chez « Chez Fatou, cuisine du Sénégal et grillades » est annulée par l’établissement. Motif : Rupture de poisson frais ce midi. Vous êtes remboursé de 1 312 500 F CFA sur votre compte de paiement.
- SMS au pire cas (107 septets, 1 segment) : `Event Village : commande CMD-261205-A1B2C3 annulée par Grande soirée " Ndekk... 9 999 999 F CFA remboursés.`
- SMS avec des valeurs courantes : `Event Village : commande CMD-261205-A1B2C3 annulée par Chez Fatou, cuisine du... 1 312 500 F CFA remboursés.`

### `ORDER_PAYMENT_REFUNDED` — Paiement de commande remboursé

- Cloche : **Paiement remboursé** — Votre paiement de 1 312 500 F CFA pour la commande CMD-261205-A1B2C3 est arrivé alors qu’elle n’était plus possible (annulée, déjà payée ou établissement fermé). Il vous est remboursé sur votre compte Orange Money.
- SMS au pire cas (143 septets, 1 segment) : `Event Village : votre paiement de 9 999 999 F CFA pour la commande CMD-261205-A1B2C3 n'a pas pu servir. Il vous est remboursé sur Orange Money.`
- SMS avec des valeurs courantes : `Event Village : votre paiement de 1 312 500 F CFA pour la commande CMD-261205-A1B2C3 n'a pas pu servir. Il vous est remboursé sur Orange Money.`

### `ORDER_REFUND_PAID` — Remboursement de commande versé

- Cloche : **Remboursement versé** — 1 312 500 F CFA pour la commande CMD-261205-A1B2C3 vous ont été versés sur votre compte Orange Money.
- SMS au pire cas (118 septets, 1 segment) : `Event Village : 9 999 999 F CFA versés sur votre compte Orange Money : remboursement de la commande CMD-261205-A1B2C3.`
- SMS avec des valeurs courantes : `Event Village : 1 312 500 F CFA versés sur votre compte Orange Money : remboursement de la commande CMD-261205-A1B2C3.`

### `ORDER_PICKUP_REMINDER` — Commande à retirer

- Cloche : **Commande à retirer** — Votre commande CMD-261205-A1B2C3 vous attend chez « Chez Fatou, cuisine du Sénégal et grillades ». Retirez-la avant le dim. 6 déc. 2026 à 12:45 : ensuite, elle est close sans remboursement.
- SMS au pire cas (139 septets, 1 segment) : `Event Village : commande CMD-261205-A1B2C3 à retirer chez Grande soirée " Nde... avant le 30 sept. à 20:00, sinon close sans remboursement.`
- SMS avec des valeurs courantes : `Event Village : commande CMD-261205-A1B2C3 à retirer chez Chez Fatou, cuisine... avant le 6 déc. à 12:45, sinon close sans remboursement.`

### `ORDER_NOT_COLLECTED` — Commande non retirée

- Cloche : **Commande non retirée** — Votre commande CMD-261205-A1B2C3 n’a pas été retirée à temps chez « Chez Fatou, cuisine du Sénégal et grillades » : elle est close, sans remboursement.
- SMS au pire cas (127 septets, 1 segment) : `Event Village : commande CMD-261205-A1B2C3 non retirée à temps chez Grande soirée " Ndekk " - l... : close, sans remboursement.`
- SMS avec des valeurs courantes : `Event Village : commande CMD-261205-A1B2C3 non retirée à temps chez Chez Fatou, cuisine du Séné... : close, sans remboursement.`

### `ORDER_NEW` — Nouvelle commande à accepter

- Cloche : **Nouvelle commande** — Commande CMD-261205-A1B2C3 chez « Chez Fatou, cuisine du Sénégal et grillades » : 12 articles, 1 250 000 F CFA. Livraison (zone Almadies et Ngor). À encaisser à la remise : 875 000 F CFA. Acceptez-la ou refusez-la avant 12:15 ; sans réponse, elle est annulée et le client remboursé.
- SMS au pire cas (130 septets, 1 segment) : `Event Village : nouvelle commande CMD-261205-A1B2C3 : 99 articles, 9 999 999 F CFA. Répondez avant 20:00, sinon elle sera annulée.`
- SMS avec des valeurs courantes : `Event Village : nouvelle commande CMD-261205-A1B2C3 : 12 articles, 1 250 000 F CFA. Répondez avant 12:15, sinon elle sera annulée.`

### `ORDER_CANCELLED_PRO` — Commande annulée (établissement)

- Cloche : **Commande annulée** — La commande CMD-261205-A1B2C3 est annulée par Event Village. Motif : Le client signale une erreur de commande. Ne la préparez pas.
- SMS au pire cas (89 septets, 1 segment) : `Event Village : commande CMD-261205-A1B2C3 annulée par Event Village. Ne la préparez pas.`

### `ORDER_HANDED_OVER_PRO` — Commande remise par le livreur

- Cloche : **Commande livrée** — Votre livreur a remis la commande CMD-261205-A1B2C3 au client.
- SMS au pire cas (78 septets, 1 segment) : `Event Village : votre livreur a remis la commande CMD-261205-A1B2C3 au client.`

### `ORDER_COURIER_ASSIGNED` — Livraison confiée

- Cloche : **Livraison à faire** — Commande CMD-261205-A1B2C3 à livrer pour « Chez Fatou, cuisine du Sénégal et grillades », zone Almadies et Ngor. Ouvrez-la pour l’adresse et le téléphone du client ; à la remise, demandez-lui son code.
- SMS au pire cas (134 septets, 1 segment) : `Event Village : commande CMD-261205-A1B2C3 à livrer pour Grande soirée " Nde..., zone Grande soirée " N... Adresse dans l'application.`
- SMS avec des valeurs courantes : `Event Village : commande CMD-261205-A1B2C3 à livrer pour Chez Fatou, cuisine..., zone Almadies et Ngor. Adresse dans l'application.`

### `ORDER_COURIER_CANCELLED` — Livraison annulée

- Cloche : **Livraison annulée** — La livraison de la commande CMD-261205-A1B2C3 est annulée ou confiée à quelqu’un d’autre : ne la livrez pas.
- SMS au pire cas (116 septets, 1 segment) : `Event Village : livraison de la commande CMD-261205-A1B2C3 annulée ou confiée à un autre livreur : ne la livrez pas.`

### `ORDER_COURIER_INVITED` — Invitation à livrer

- Cloche : **Invitation à livrer** — « Chez Fatou, cuisine du Sénégal et grillades » vous invite à livrer ses commandes avec Event Village. Acceptez ou refusez l’invitation ; vous verrez seulement les livraisons qui vous sont confiées.

### `ORDER_CODE_LOCKED` — Code de remise bloqué

- Cloche : **Code de remise bloqué** — Le code de remise de la commande CMD-261205-A1B2C3 a été mal saisi trop de fois : il ne fonctionne plus. Ouvrez la commande, demandez un nouveau code et donnez-le à la remise.
- SMS au pire cas (136 septets, 1 segment) : `Event Village : code de remise de la commande CMD-261205-A1B2C3 bloqué après trop d'essais. Demandez un nouveau code dans l'application.`

### `ORDER_RESPONSE_REMINDER` — Commande sans réponse

- Cloche : **Commande sans réponse** — La commande CMD-261205-A1B2C3 chez « Chez Fatou, cuisine du Sénégal et grillades » attend votre réponse. Acceptez-la ou refusez-la avant 12:15 : sans réponse, elle est annulée et le client remboursé.
- SMS au pire cas (129 septets, 1 segment) : `Event Village : commande CMD-261205-A1B2C3 toujours sans réponse. Acceptez-la ou refusez-la avant 20:00, sinon elle sera annulée.`
- SMS avec des valeurs courantes : `Event Village : commande CMD-261205-A1B2C3 toujours sans réponse. Acceptez-la ou refusez-la avant 12:15, sinon elle sera annulée.`

### `ORDER_PREP_REMINDER` — Commande programmée à préparer

- Cloche : **Commande à préparer** — La commande CMD-261205-A1B2C3 chez « Chez Fatou, cuisine du Sénégal et grillades » est prévue à 12:45 : lancez sa préparation maintenant. Livraison (zone Almadies et Ngor).
- SMS au pire cas (93 septets, 1 segment) : `Event Village : commande CMD-261205-A1B2C3 prévue à 20:00 : lancez sa préparation maintenant.`
- SMS avec des valeurs courantes : `Event Village : commande CMD-261205-A1B2C3 prévue à 12:45 : lancez sa préparation maintenant.`

### `ORDER_READY_COURIER` — Commande prête à livrer

- Cloche : **Commande prête à livrer** — La commande CMD-261205-A1B2C3 est prête chez « Chez Fatou, cuisine du Sénégal et grillades » (zone Almadies et Ngor) : passez la prendre. À la remise, demandez son code au client.
- SMS au pire cas (134 septets, 1 segment) : `Event Village : commande CMD-261205-A1B2C3 à récupérer chez Grande soirée " Ndekk " - l... pour la livrer. Adresse dans l'application.`
- SMS avec des valeurs courantes : `Event Village : commande CMD-261205-A1B2C3 à récupérer chez Chez Fatou, cuisine du Séné... pour la livrer. Adresse dans l'application.`

### `ORDER_SCHEDULED_REMINDER` — Commande programmée bientôt

- Cloche : **Votre commande approche** — Votre commande CMD-261205-A1B2C3 chez « Chez Fatou, cuisine du Sénégal et grillades » est prévue à 12:45. Gardez votre téléphone près de vous et votre code de remise prêt.
- SMS au pire cas (138 septets, 1 segment) : `Event Village : rappel, commande CMD-261205-A1B2C3 prévue à 20:00 chez Grande soirée " Ndekk " - l... Gardez votre téléphone près de vous.`
- SMS avec des valeurs courantes : `Event Village : rappel, commande CMD-261205-A1B2C3 prévue à 12:45 chez Chez Fatou, cuisine du Séné... Gardez votre téléphone près de vous.`

### `ADMIN_PRODUCT_REVIEW` — Produit à vérifier

- Cloche : **Produit à vérifier** — « Bissap maison et bière locale en bouteille de 65 cl » chez Le Grand Bleu contient le mot « bière ». Il ne se vend pas en ligne tant que vous ne l’avez pas autorisé ou refusé.

### `PRODUCT_REVIEW_DECIDED` — Produit vérifié

- Cloche : **Produit non vendu en ligne** — « Bissap maison et bière locale en bouteille de 65 cl » n’est pas autorisé à la vente en ligne. Motif : Boisson alcoolisée : vente en ligne interdite. Il reste affiché avec son prix sur votre carte : vos clients l’achètent sur place.

### `PRODUCT_DECISION_SMS` — SMS : produit vérifié

- SMS au pire cas (126 septets, 1 segment) : `Event Village : produit "Grande soirée " Ndekk " - l'été à Sal..." non autorisé à la vente en ligne. Motif dans l'application.`
- SMS avec des valeurs courantes : `Event Village : produit "Bissap maison et bière locale en bout..." non autorisé à la vente en ligne. Motif dans l'application.`

### `ADMIN_ORDER_REFUND_BLOCKED` — SMS : remboursement de commande à reprendre

- SMS au pire cas (122 septets, 1 segment) : `Event Village : remboursement de 9 999 999 F CFA de la commande CMD-261205-A1B2C3 bloqué. Reprenez-le depuis les finances.`
- SMS avec des valeurs courantes : `Event Village : remboursement de 1 312 500 F CFA de la commande CMD-261205-A1B2C3 bloqué. Reprenez-le depuis les finances.`

### `ADMIN_PRODUCTS_REVIEW_BATCH` — Produits déjà en vente à vérifier

- Cloche : **Produits à vérifier** — 12 produits déjà en vente sont à vérifier : la liste des mots a changé. Ils ne se commandent plus en ligne tant que vous ne les avez pas autorisés ou refusés.

### `ADMIN_VENUE_SUBMITTED` — Établissement à valider

- Cloche : **Établissement à valider** — « Le Grand Bleu » (Dakar) attend votre validation.

### `ADMIN_HALL_SUBMITTED` — Salle à valider

- Cloche : **Salle à valider** — « Salle des fêtes de Ngor » (Dakar) attend votre validation.

### `ADMIN_HALL_CHANGED` — Salle validée modifiée

- Cloche : **Salle modifiée** — « Salle des fêtes de Ngor » a changé : prix et photos. Elle reste validée : vérifiez sa fiche.

### `ADMIN_PERMISSIONS_CHANGED` — Droits d’administration modifiés

- Cloche : **Vos droits ont changé** — Vous pouvez maintenant valider les salles et les établissements.
- SMS au pire cas (80 septets, 1 segment) : `Event Village : vous pouvez maintenant valider les salles et les établissements.`

### `ADMIN_PERMISSIONS_ALERT` — Droits d’un administrateur modifiés (super-administrateurs)

- Cloche : **Droits d’un administrateur modifiés** — Moussa Diop a modifié les droits de Ndeye Administratrice. Peut maintenant valider les salles et les établissements. Ne peut plus gérer les événements.
- SMS au pire cas (160 septets, 1 segment) : `Event Village : Grande soirée " N... a modifié les droits de Grande soirée " N... (1 ajouté(s), 1 retiré(s)). Vérifiez : https://app.eventvillage.sn/admin/users`
- SMS avec des valeurs courantes : `Event Village : Moussa Diop a modifié les droits de Ndeye Administrat... (1 ajouté(s), 1 retiré(s)). Vérifiez : https://app.eventvillage.sn/admin/users`

### `ADMIN_PARTNER_REGISTERED` — Nouvelle candidature partenaire

- Cloche : **Nouvelle candidature** — Sabar Events demande un compte partenaire. Examinez son dossier puis validez-le ou refusez-le.

### `ADMIN_REFUND_TO_RETRY` — Remboursement à reprendre

- Cloche : **Remboursement à reprendre** — Un remboursement de 5 000 F CFA est bloqué : opérateur du paiement inconnu. Reprenez-le depuis les finances.

### `ADMIN_DUPLICATE_PAYMENT` — Paiement en double remboursé

- Cloche : **Paiement en double remboursé** — Un second paiement de 21 000 F CFA a été encaissé pour le même panier : son remboursement au client est lancé.

### `ADMIN_CASHOUT_UNCERTAIN` — Versement incertain

- Cloche : **Versement incertain** — L'issue d'un versement de 25 000 F CFA est incertaine : vérifiez-le avant toute action.

### `ADMIN_WITHDRAWAL_REJECTED` — Retrait refusé par l’opérateur

- Cloche : **Retrait refusé par l'opérateur** — Le retrait de 25 000 F CFA a été refusé ; le montant est revenu sur le solde du bénéficiaire.

### `ADMIN_FINANCE_DEBT` — Créance sur un compte

- Cloche : **Créance sur un compte** — Un débit de 5 000 F CFA sur le compte organisateur dépasse le solde disponible : une créance de 3 000 F CFA sera compensée sur les gains futurs.

### `ADMIN_NOTIFICATION_FAILED` — Envoi en échec

- Cloche : **Envoi en échec** — Une notification « Confirmation d’achat » par SMS a échoué après 5 tentatives. Ouvrez l'envoi pour en voir la cause.

### `ADMIN_SMS_DAILY_THRESHOLD` — Volume de SMS indispensables élevé

- Cloche : **Volume de SMS indispensables élevé** — 2 150 SMS indispensables envoyés aujourd'hui (seuil d'alerte : 2 000). Ils n'ont pas de plafond global ; chaque numéro en reçoit un nombre limité par jour, et les numéros saisis à la main (invitations, transferts) sont aussi limités par compte qui les déclenche. Vérifiez leur origine dans la supervision.

### `ADMIN_SMS_CAP_GLOBAL` — Plafond de SMS atteint

- Cloche : **Plafond de SMS atteint : codes bloqués** — Le plafond de 1 000 SMS par jour est atteint : jusqu'à minuit, heure de Dakar, plus aucun code par SMS ne part vers les comptes existants (connexion, mot de passe, retrait), ni aucun SMS facultatif. Les SMS indispensables (achat, billet, annulation, remboursement, sécurité du compte) partent toujours.

### `ADMIN_SMS_CAP_NON_OTP` — Quota de SMS hors codes atteint

- Cloche : **Quota de SMS hors codes atteint** — La part des SMS hors codes (700 sur 1 000 par jour) est atteinte : jusqu'à minuit, heure de Dakar, les SMS facultatifs (rappels, ventes, résumés, remerciements) et les invitations de contrôleurs ne partent plus par SMS. Les codes et les SMS indispensables (achat, billet, annulation, remboursement, sécurité du compte) partent toujours.

### `ADMIN_SMS_CAP_NEW_NUMBERS` — Codes d’inscription : part du jour atteinte

- Cloche : **Codes d’inscription : part du jour atteinte** — Les 90 codes du jour vers des numéros sans compte sont partis : plus aucune inscription ne reçoit de code jusqu'à minuit, heure de Dakar. Les codes des comptes existants partent toujours. Vérifiez s'il s'agit d'inscriptions en masse.

### `ADMIN_SMS_OPTIONAL_80` — SMS optionnels à 80 % du plafond

- Cloche : **SMS optionnels : 80 % du plafond** — 560 SMS optionnels envoyés aujourd'hui sur un plafond de 700. Au-delà, rappels et annonces partent sans SMS.

### `ADMIN_SMS_FORECAST` — Rappels de demain au-delà du budget SMS

- Cloche : **Budget SMS de demain insuffisant** — 812 SMS de rappel prévus le ven. 6 nov. 2026 pour 700 disponibles (plafond 700). Les rappels au-delà partiront sans SMS.

### `REFUND_DELAYED` — Remboursement retardé

- Cloche : **Remboursement retardé** — Le remboursement de 10 200 F CFA pour « Gala de la Teranga » est retardé. L'équipe Event Village s'en occupe : vous serez prévenu dès le versement.
- SMS au pire cas (157 septets, 1 segment) : `Event Village : remboursement de 9 999 999 F CFA retardé ("Grande soirée " Ndekk " - l..."). L'équipe Event Village s'en occupe, aucune action de votre part.`
- SMS avec des valeurs courantes : `Event Village : remboursement de 10 200 F CFA retardé ("Gala de la Teranga"). L'équipe Event Village s'en occupe, aucune action de votre part.`

### `WITHDRAWAL_DELAYED` — Retrait retardé

- Cloche : **Retrait retardé** — Votre retrait de 25 000 F CFA est retardé. L'équipe Event Village s'en occupe : le montant reste réservé et vous serez prévenu du versement.
- SMS au pire cas (126 septets, 1 segment) : `Event Village : votre retrait de 9 999 999 F CFA est retardé. L'équipe Event Village s'en occupe, aucune action de votre part.`
- SMS avec des valeurs courantes : `Event Village : votre retrait de 25 000 F CFA est retardé. L'équipe Event Village s'en occupe, aucune action de votre part.`

### `ADMIN_CASHOUT_TO_RESUME` — Versement à reprendre

- Cloche : **Versement à reprendre** — Un versement de 10 200 F CFA (remboursement d’un paiement) attend depuis plus de 30 minutes.

### `PAYMENT_REFUND_STARTED` — Remboursement d’un paiement

- Cloche : **Remboursement de votre paiement** — Votre paiement de 10 200 F CFA pour « Gala de la Teranga » a été reçu, mais aucun billet n'a pu être émis. Il vous est remboursé sur votre compte Wave : vous serez prévenu du versement.
- SMS au pire cas (154 septets, 1 segment) : `Event Village : paiement de 9 999 999 F CFA ("Grande soirée " Ndekk " - l...") sans billet possible : il vous est remboursé sur votre compte Orange Money.`
- SMS avec des valeurs courantes : `Event Village : paiement de 10 200 F CFA ("Gala de la Teranga") sans billet possible : il vous est remboursé sur votre compte Wave.`

### `ADMIN_PARTNER_RESUBMITTED` — Dossier partenaire complété

- Cloche : **Dossier complété** — Sabar Events a complété son dossier refusé : il attend un nouvel examen.

### `EVENT_CLOSED_HOLDER` — Clôture d’un événement suspendu (porteurs)

- Cloche : **Événement clos** — « Gala de la Teranga » est clos par l'équipe Event Village après sa suspension. Il n'est pas annulé : aucun remboursement automatique.
- SMS au pire cas (158 septets, 1 segment) : `Event Village : Grande soirée " Ndekk " - l... est clos après sa suspension, sans annulation ni remboursement automatique. https://app.eventvillage.sn/tickets`
- SMS avec des valeurs courantes : `Event Village : Gala de la Teranga est clos après sa suspension, sans annulation ni remboursement automatique. https://app.eventvillage.sn/tickets`

### `EVENT_CLOSED_BY_ADMIN` — Clôture d’un événement par l’administration

- Cloche : **Événement clos par l'administration** — « Gala de la Teranga » du sam. 14 nov. 2026 à 20:00 est clos par l'administration, sans annulation. Motif : Organisateur injoignable.
- SMS au pire cas (152 septets, 1 segment) : `Event Village : Grande soirée " Ndekk " - l... est clos par l'équipe Event Village après sa suspension. Motif : Grande soirée " Ndekk " - l'été à Sal...`
- SMS avec des valeurs courantes : `Event Village : Gala de la Teranga est clos par l'équipe Event Village après sa suspension. Motif : Organisateur injoignable.`

### `SHIFT_OPEN_AT_END` — Caisse encore ouverte à la fin

- Cloche : **Caisse encore ouverte** — « Gala de la Teranga » est terminé et 2 caisses restent ouvertes. Fermez-les dans l'onglet Caisse du pilotage.
- SMS au pire cas (157 septets, 1 segment) : `Event Village : Grande soirée " Ndekk... est terminé et 99 caisses restent ouvertes. Fermez-les dans le pilotage : https://app.eventvillage.sn/partner/events`
- SMS avec des valeurs courantes : `Event Village : Gala de la Teranga est terminé et 2 caisses restent ouvertes. Fermez-les dans le pilotage : https://app.eventvillage.sn/partner/events`

### `TRANSFER_REVOKED` — Transfert annulé par un remboursement

- Cloche : **Transfert annulé** — Le billet pour « Gala de la Teranga » a été remboursé à son acheteur : le transfert est annulé.
- SMS au pire cas (138 septets, 1 segment) : `Event Village : le billet Grande soirée " Ndekk " - l... qui vous était transféré a été remboursé à son acheteur. Le transfert est annulé.`
- SMS avec des valeurs courantes : `Event Village : le billet Gala de la Teranga qui vous était transféré a été remboursé à son acheteur. Le transfert est annulé.`

### `TRANSFER_DECLINED_SENDER` — Transfert refusé (expéditeur)

- Cloche : **Billet refusé** — Le destinataire a refusé votre billet pour « Gala de la Teranga » : il reste dans vos billets.
- SMS au pire cas (138 septets, 1 segment) : `Event Village : le destinataire a refusé votre billet Grande soirée " Ndekk " - l... Il vous revient : https://app.eventvillage.sn/tickets`
- SMS avec des valeurs courantes : `Event Village : le destinataire a refusé votre billet Gala de la Teranga. Il vous revient : https://app.eventvillage.sn/tickets`

### `TRANSFER_RECIPIENT_CHANGED` — Transfert annulé (numéro du destinataire changé)

- Cloche : **Transfert annulé** — Le destinataire de votre billet pour « Gala de la Teranga » a changé de numéro : le transfert est annulé et le billet reste dans vos billets.
- SMS au pire cas (158 septets, 1 segment) : `Event Village : transfert du billet Grande soirée " Ndekk... annulé, le destinataire a changé de numéro. Il vous revient : https://app.eventvillage.sn/tickets`
- SMS avec des valeurs courantes : `Event Village : transfert du billet Gala de la Teranga annulé, le destinataire a changé de numéro. Il vous revient : https://app.eventvillage.sn/tickets`

### `CONTROLLER_INVITATION` — Invitation à contrôler l’entrée

- Cloche : **Invitation de Sabar Events** — Sabar Events vous invite à contrôler l'entrée de « Gala de la Teranga » et 1 autre événement. Répondez avant le jeu. 12 nov. 2026 à 18:30.
- SMS au pire cas (158 septets, 1 segment) : `Event Village : Grande soirée "... vous invite à scanner les billets de Grande soirée "..., et 98 autres. Répondez sur https://app.eventvillage.sn/invitations`
- SMS avec des valeurs courantes : `Event Village : Sabar Events vous invite à scanner les billets de Gala de la Teranga, et 1 autre. Répondez sur https://app.eventvillage.sn/invitations`

### `CONTROLLER_INVITATION_ACCEPTED` — Invitation de contrôleur acceptée

- Cloche : **Invitation acceptée** — Aminata Fall a accepté votre invitation à contrôler l'entrée de « Gala de la Teranga ». Choisissez sa porte et les espèces dans votre équipe.
- SMS au pire cas (145 septets, 1 segment) : `Event Village : Grande soirée "... a accepté de scanner les billets à vos entrées. Choisissez sa porte : https://app.eventvillage.sn/partner/team`
- SMS avec des valeurs courantes : `Event Village : Aminata Fall a accepté de scanner les billets à vos entrées. Choisissez sa porte : https://app.eventvillage.sn/partner/team`

### `CONTROLLER_INVITATION_DECLINED` — Invitation de contrôleur refusée

- Cloche : **Invitation refusée** — Ou*** B*** a refusé votre invitation à contrôler l'entrée de « Gala de la Teranga ». Invitez une autre personne depuis votre équipe.
- SMS au pire cas (151 septets, 1 segment) : `Event Village : Grande soirée "... a refusé de scanner les billets à vos entrées. Invitez une autre personne : https://app.eventvillage.sn/partner/team`
- SMS avec des valeurs courantes : `Event Village : Ou*** B*** a refusé de scanner les billets à vos entrées. Invitez une autre personne : https://app.eventvillage.sn/partner/team`

### `CONTROLLER_INVITATION_EXPIRED` — Invitation de contrôleur sans réponse

- Cloche : **Invitation sans réponse** — Kh*** S*** n'a pas répondu à votre invitation à contrôler l'entrée de « Gala de la Teranga » : elle a expiré. Invitez de nouveau depuis votre équipe.
- SMS au pire cas (154 septets, 1 segment) : `Event Village : Grande soirée "... n'a pas répondu à votre invitation à scanner les billets. Invitez de nouveau : https://app.eventvillage.sn/partner/team`
- SMS avec des valeurs courantes : `Event Village : Kh*** S*** n'a pas répondu à votre invitation à scanner les billets. Invitez de nouveau : https://app.eventvillage.sn/partner/team`

### `CONTROLLER_BECAME_ADMIN` — Contrôleur devenu administrateur

- Cloche : **Contrôleur retiré de votre équipe** — Aminata Fall ne fait plus partie de votre équipe : son compte est devenu un compte d'administration Event Village. Invitez une autre personne pour vos entrées.
- SMS au pire cas (150 septets, 1 segment) : `Event Village : Grande soirée "... ne fait plus partie de votre équipe d'entrée. Invitez une autre personne : https://app.eventvillage.sn/partner/team`
- SMS avec des valeurs courantes : `Event Village : Aminata Fall ne fait plus partie de votre équipe d'entrée. Invitez une autre personne : https://app.eventvillage.sn/partner/team`

### `EVENT_CANCELLED_BY_ADMIN` — Annulation d’un événement par l’administration

- Cloche : **Événement annulé par l'administration** — « Gala de la Teranga » du sam. 14 nov. 2026 à 20:00 est annulé par l'administration. Motif : Intempéries annoncées sur Dakar. Les remboursements en ligne sont lancés : suivez-les dans l'onglet Clôture.
- SMS au pire cas (155 septets, 1 segment) : `Event Village : Grande soirée " Ndekk... annulé par l'administration. Motif : Grande soirée " Ndekk " - l'été... https://app.eventvillage.sn/partner/events`
- SMS avec des valeurs courantes : `Event Village : Gala de la Teranga annulé par l'administration. Motif : Intempéries annoncées sur Dakar. https://app.eventvillage.sn/partner/events`

### `ADMIN_EVENT_CANCELLED` — Événement annulé par l’organisateur

- Cloche : **Événement annulé par l'organisateur** — « Gala de la Teranga » de Sabar Events est annulé par l'organisateur. Motif interne : Salle indisponible à la date prévue.

### `CONTROLLER_EVENT_CANCELLED` — Annulation d’un événement contrôlé

- Cloche : **Contrôle annulé** — « Gala de la Teranga » du sam. 14 nov. 2026 à 20:00 est annulé : votre affectation à l'entrée est retirée.
- SMS au pire cas (125 septets, 1 segment) : `Event Village : Grande soirée " Ndekk " - l... du mer. 30 sept. à 20:00 est annulé. Votre affectation à l'entrée est retirée.`
- SMS avec des valeurs courantes : `Event Village : Gala de la Teranga du sam. 14 nov. à 20:00 est annulé. Votre affectation à l'entrée est retirée.`

### `CONTROLLER_EVENT_CHANGED` — Changement d’un événement contrôlé

- Cloche : **Contrôle modifié** — « Gala de la Teranga » : nouvelle date : sam. 21 nov. 2026 à 21:00. Votre affectation est maintenue.
- SMS au pire cas (146 septets, 1 segment) : `Event Village : affectation à l'entrée de Grande soirée " Ndekk... : mer. 30 sept. à 20:00, Grande soirée " N... https://app.eventvillage.sn/login`
- SMS avec des valeurs courantes : `Event Village : affectation à l'entrée de Gala de la Teranga : nouvelle date sam. 21 nov. à 21:00. https://app.eventvillage.sn/login`

### `CONTROLLER_EVENT_STATUS` — Suspension ou reprise d’un événement contrôlé

- Cloche : **Événement suspendu** — « Gala de la Teranga » est suspendu : le contrôle d'accès est fermé jusqu'à nouvel avis.
- SMS au pire cas (112 septets, 1 segment) : `Event Village : Grande soirée " Ndekk " - l... est suspendu : le scan des billets est fermé jusqu'à nouvel avis.`
- SMS avec des valeurs courantes : `Event Village : Gala de la Teranga est suspendu : le scan des billets est fermé jusqu'à nouvel avis.`

### `TICKET_CANCELLED` — Billet annulé

- Cloche : **Invitation annulée** — Votre invitation pour « Gala de la Teranga » du sam. 14 nov. 2026 à 20:00 est annulée par l'organisateur.
- SMS au pire cas (125 septets, 1 segment) : `Event Village : votre invitation pour Grande soirée " Ndekk " - l... du mer. 30 sept. à 20:00 est annulée par l'organisateur.`
- SMS avec des valeurs courantes : `Event Village : votre invitation pour Gala de la Teranga du sam. 14 nov. à 20:00 est annulée par l'organisateur.`

### `ACCOUNT_SUSPENDED` — Compte suspendu

- Cloche : **Compte suspendu** — Votre compte est suspendu. Motif : Paiements contestés. Vos billets payés restent valables. Pour toute question, et avant de vous rendre à un événement, ouvrez la page Aide pour joindre le support.
- SMS au pire cas (160 septets, 1 segment) : `Event Village : votre compte est suspendu. Motif : Grande soirée " Ndekk " - l'ét... Vos billets payés restent valables. Aide : https://app.eventvillage.sn/aide`
- SMS avec des valeurs courantes : `Event Village : votre compte est suspendu. Motif : Paiements contestés. Vos billets payés restent valables. Aide : https://app.eventvillage.sn/aide`

### `ACCOUNT_REACTIVATED` — Compte réactivé

- Cloche : **Compte réactivé** — Votre compte est réactivé : vous pouvez de nouveau vous connecter.
- SMS au pire cas (116 septets, 1 segment) : `Event Village : votre compte est réactivé. Vous pouvez de nouveau vous connecter : https://app.eventvillage.sn/login`

### `ADMIN_EVENT_CHANGED` — Événement modifié après validation

- Cloche : **Événement modifié après validation** — « Gala de la Teranga » de Sabar Events : nouveau titre (ancien : « Gala Teranga »), nouvelle affiche après validation. Vérifiez la fiche.

### `EVENT_SUBMITTED_ACK` — Événement envoyé en validation

- Cloche : **Événement envoyé en validation** — « Gala de la Teranga » est envoyé à l'équipe Event Village pour validation. Vous serez prévenu de la décision.

### `EVENT_FINISHED` — Événement terminé

- Cloche : **Événement terminé** — « Gala de la Teranga » est terminé. Le rapport de clôture est prêt dans l'onglet Clôture.

### `CLOSING_REPORT_READY` — Rapport de clôture prêt

- Cloche : **Rapport de clôture prêt** — Toutes les caisses de « Gala de la Teranga » sont fermées : le rapport de clôture est prêt.

### `FUNDS_AVAILABLE` — Recettes disponibles

- Cloche : **Recettes disponibles** — Les recettes de « Gala de la Teranga » sont disponibles sur votre solde : vous pouvez demander un retrait.
- SMS au pire cas (149 septets, 1 segment) : `Event Village : les recettes de Grande soirée " Ndekk " - l... sont disponibles. Demandez votre retrait : https://app.eventvillage.sn/partner/finance`
- SMS avec des valeurs courantes : `Event Village : les recettes de Gala de la Teranga sont disponibles. Demandez votre retrait : https://app.eventvillage.sn/partner/finance`

### `TICKET_REFUNDED_HOLDER` — Billet transféré annulé (détenteur)

- Cloche : **Billet annulé** — Votre billet VIP pour « Gala de la Teranga » du sam. 14 nov. 2026 à 20:00 a été annulé. Le remboursement est versé à l'acheteur d'origine.
- SMS au pire cas (154 septets, 1 segment) : `Event Village : votre billet Grande soirée " Ndekk... pour Grande soirée " Ndekk " - l... a été annulé. Le remboursement est versé à l'acheteur d'origine.`
- SMS avec des valeurs courantes : `Event Village : votre billet VIP pour Gala de la Teranga a été annulé. Le remboursement est versé à l'acheteur d'origine.`

### `ADMIN_EVENT_PUBLISHED` — Événement publié par l’organisateur

- Cloche : **Événement publié par l'organisateur** — « Gala de la Teranga » de Sabar Events est publié par l'organisateur : sa page publique est en ligne.

### `ADMIN_EVENT_WITHDRAWN` — Soumission retirée par l’organisateur

- Cloche : **Soumission retirée par l'organisateur** — « Gala de la Teranga » de Sabar Events est retiré de la validation par l'organisateur : il n'attend plus votre examen.

### `SCAN_REFUSALS_ALERT` — Refus en série à une porte

- Cloche : **Refus en série à une porte** — Porte B : 12 refus en 5 minutes pour « Gala de la Teranga ». Vérifiez la porte avec vos contrôleurs.
- SMS au pire cas (159 septets, 1 segment) : `Event Village : Grande so... : 999 refus en 60 min pour Grande soirée " N... Vérifiez cette porte avec votre équipe. https://app.eventvillage.sn/partner/events`
- SMS avec des valeurs courantes : `Event Village : Porte B : 12 refus en 5 min pour Gala de la Teranga. Vérifiez cette porte avec votre équipe. https://app.eventvillage.sn/partner/events`

### `ADMIN_REVIEW_SMS` — SMS aux administrateurs : à valider

- SMS au pire cas (135 septets, 1 segment) : `Event Village : 99 demande(s) de partenaire et 99 événement(s) attendent votre validation : https://app.eventvillage.sn/admin/dashboard`
- SMS avec des valeurs courantes : `Event Village : nouvelle demande de partenaire "Association culturelle Sabar Events D...". Vérifiez son dossier : https://app.eventvillage.sn/admin/dashboard`

### `ACCOUNT_LOGIN_FAILURES` — Essais de connexion échoués

- Cloche : **Essais de connexion échoués** — Plusieurs essais de connexion ont échoué sur votre compte. Si ce n’est pas vous, changez votre mot de passe avec « Mot de passe oublié ».
- SMS au pire cas (160 septets, 1 segment) : `Event Village : plusieurs connexions ont échoué sur votre compte. Si ce n'est pas vous, changez votre mot de passe : https://app.eventvillage.sn/forgot-password`

### `EMAIL_ADDED` — Adresse email ajoutée au compte

- Cloche : **Adresse email ajoutée** — Cette adresse email est désormais celle de votre compte Event Village : elle sert à vous connecter et à recevoir vos billets. Si ce n’est pas vous, ouvrez la page d’aide pour joindre le support.
- SMS au pire cas (119 septets, 1 segment) : `Event Village : une adresse email a été ajoutée à votre compte. Si ce n'est pas vous : https://app.eventvillage.sn/aide`

### `CASH_REFUND_MARKED_BY_ADMIN` — Espèces marquées rendues par l’administration

- Cloche : **Espèces marquées rendues par l’administration** — L'administration a marqué rendues les espèces de la vente 1F6E2B9C (6 000 F CFA) pour « Gala de la Teranga ». Motif : Espèces rendues par la billetterie du lieu.
- SMS au pire cas (126 septets, 1 segment) : `Event Village : l'administration a marqué rendues les espèces de la vente 1F6E2B9C (9 999 999 F CFA) pour Grande soirée " N...`
- SMS avec des valeurs courantes : `Event Village : l'administration a marqué rendues les espèces de la vente 1F6E2B9C (6 000 F CFA) pour Gala de la Teranga.`

### `SUPERADMIN_PROMOTED` — Nouveau super-administrateur (alerte)

- Cloche : **Nouveau super-administrateur** — Mame Diarra Bousso Ndiaye Diop est maintenant super-administrateur, nommé par Aminata Sophie Gueye Sarr Fall. Si ce n’est pas prévu, réagissez tout de suite : changez son rôle depuis Comptes.
- SMS au pire cas (152 septets, 1 segment) : `Event Village : Grande soirée " N... est maintenant super-administrateur, nommé par Grande soirée " N... Si ce n'est pas prévu, réagissez tout de suite.`
- SMS avec des valeurs courantes : `Event Village : Mame Diarra Bouss... est maintenant super-administrateur, nommé par Aminata Sophie Gu... Si ce n'est pas prévu, réagissez tout de suite.`

### `ADMIN_BACKUP_CODE_USED` — Code de secours utilisé (alerte)

- Cloche : **Code de secours utilisé** — Un code de secours de votre compte de super-administrateur vient de servir pour ouvrir l’administration. Il vous en reste 9. Si ce n’est pas vous, alertez tout de suite un autre super-administrateur et créez de nouveaux codes.
- SMS au pire cas (157 septets, 1 segment) : `Event Village : un code de secours de votre compte de super-administrateur vient de servir. Si ce n'est pas vous, alertez vite un autre super-administrateur.`

### `ADMIN_PHONE_CHANGED` — Numéro d’un administrateur remplacé (ancien numéro)

- Cloche : **Numéro de téléphone remplacé** — Le super-administrateur a remplacé le numéro de votre compte administrateur. L’ancien téléphone ne sert plus pour vos codes.
- SMS au pire cas (135 septets, 1 segment) : `Event Village : le super-administrateur a remplacé ce numéro sur votre compte administrateur. Ce téléphone ne sert plus pour vos codes.`

### `ADMIN_PHONE_CONFIRMED` — Numéro d’un administrateur confirmé (nouveau numéro)

- Cloche : **Numéro de téléphone changé** — Le super-administrateur a remplacé le numéro de votre compte administrateur. Les codes administrateur arrivent désormais sur ce numéro.
- SMS au pire cas (120 septets, 1 segment) : `Event Village : ce numéro est maintenant celui de votre compte administrateur. Reconnectez-vous avec votre mot de passe.`

### `SALES_UPDATE_SMS` — Ventes groupées par SMS

- SMS au pire cas (102 septets, 1 segment) : `Event Village : 999 billets vendus depuis 20:00 pour Grande soirée " Ndekk " - l... : 9 999 999 F CFA.`
- SMS avec des valeurs courantes : `Event Village : 12 billets vendus depuis 14:00 pour Gala de la Teranga : 60 000 F CFA.`

### `PARTNER_DAILY_SUMMARY` — Résumé du matin (ventes de la veille)

- Cloche : **Résumé de la veille** — Hier (sam. 14 nov. 2026), pour « Gala de la Teranga » : 1234 billets vendus (+6 170 000 F CFA), 12 billets remboursés (-60 000 F CFA), 1180 entrées.
- SMS au pire cas (130 septets, 1 segment) : `Event Village : hier sur 99 événements : 9 999 billets vendus (9 999 999 F CFA), 999 remboursés (-9 999 999 F CFA), 9 999 entrées.`
- SMS avec des valeurs courantes : `Event Village : hier pour Gala de la Teranga : 1 234 billets vendus (6 170 000 F CFA), 12 remboursés (-60 000 F CFA), 1 180 entrées.`

### `ENTRY_WELCOME` — Bienvenue à l’entrée

- Cloche : **Bienvenue** — Bienvenue à « Gala de la Teranga » ! Bonne soirée avec Sabar Events. Votre entrée est validée.
- SMS au pire cas (119 septets, 1 segment) : `Event Village : Bienvenue à Grande soirée " Ndekk " - l'été à Sal... ! Bonne soirée avec Grande soirée " Ndekk " - l...`
- SMS avec des valeurs courantes : `Event Village : Bienvenue à Gala de la Teranga ! Bonne soirée avec Sabar Events.`

### `ENTRY_THANKS` — Merci du lendemain

- Cloche : **Merci d’être venu** — Merci d'être venu à « Gala de la Teranga ». Sabar Events et Event Village espèrent vous revoir bientôt.
- SMS au pire cas (146 septets, 1 segment) : `Event Village : merci de votre présence à Grande soirée " Ndekk " - l... ! https://app.eventvillage.sn/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01`
- SMS avec des valeurs courantes : `Event Village : merci de votre présence à Gala de la Teranga ! https://app.eventvillage.sn/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01`

### `PARTNER_REFUND_REQUESTS` — Remboursements demandés par des clients

- Cloche : **Remboursements demandés** — 3 billets de « Gala de la Teranga » sont remboursés à la demande de leurs acheteurs depuis 14:05 (-15 000 F CFA) : ils sont retirés de vos ventes.
- SMS au pire cas (126 septets, 1 segment) : `Event Village : 999 billets de Grande soirée " Ndekk... remboursés à la demande des acheteurs depuis 20:00 (-9 999 999 F CFA).`
- SMS avec des valeurs courantes : `Event Village : 3 billets de Gala de la Teranga remboursés à la demande des acheteurs depuis 14:05 (-15 000 F CFA).`

### SMS synchrones (codes et liens)

| Type | SMS (pire cas) | Septets |
|---|---|---|
| `OTP_LOGIN` | `Event Village : votre code est 123456. Ne le donnez à personne. Valable 10 minutes.` | 83 |
| `OTP_REGISTER` | `Event Village : votre code est 123456. Ne le donnez à personne. Valable 10 minutes.` | 83 |
| `OTP_PASSWORD_RESET` | `Event Village : votre code de réinitialisation est 123456. Ne le donnez à personne. Valable 10 minutes.` | 103 |
| `OTP_WITHDRAWAL` | `Event Village : votre code de retrait est 123456. Valable 10 minutes. Ne le donnez à personne.` | 94 |
| `OTP_PHONE_CHANGE` | `Event Village : votre code est 123456. Ne le donnez à personne. Valable 10 minutes.` | 83 |
| `OTP_AUTH_HOOK` | `Event Village : votre code est 123456. Ne le donnez à personne. Valable 10 minutes.` | 83 |
| `OTP_ADMIN` | `Event Village : code administrateur 123456. Ne le donnez à personne. Valable 10 minutes.` | 88 |
| `OTP_ADMIN_PHONE` | `Event Village : code 123456 pour confirmer ce numéro sur un compte administrateur. Donnez-le seulement au super-administrateur. Valable 10 minutes.` | 147 |
| `CONTROLLER_INVITE` | `Event Village : Bonjour Grande..., code d'activation 123456 (24 h) pour scanner les billets : https://app.eventvillage.sn/controller/setup?phone=%2B221771234567` | 160 |
| `ACCOUNT_ACTIVATION` | `Event Village : votre compte est créé. Choisissez votre mot de passe sous 24 h : https://app.eventvillage.sn/activation?t=xxxxxxxxxxxxxxxxxxxxxx` | 144 |
| `ORDER_HANDOVER_CODE` | `Event Village : votre commande CMD-20261130-ABCD vous attend. Donnez le code 1234 au comptoir pour la retirer, à personne d'autre.` | 130 |
| `ORDER_HANDOVER_CODE#L` | `Event Village : votre commande CMD-20261130-ABCD est en route. Donnez le code 1234 au livreur à son arrivée, pas avant.` | 119 |
| `ORDER_HANDOVER_CODE#N` | `Event Village : nouveau code de la commande CMD-20261130-ABCD : 1234. L'ancien ne marche plus. Donnez-le seulement à la remise.` | 127 |
