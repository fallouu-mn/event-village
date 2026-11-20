# Finition 4 — Messages : chaque étape annoncée

Branche `finition-4/messages`, partie de `main` à `fce22b609` (lot 11a fusionné), dans son propre dossier (`event-village-finition4`, `node_modules` propre). Correctifs de la contre-vérification (`docs/audit-finition-4.md`, branche `finition-4/rouges`) appliqués (§ 7 bis) ; `main` à `6afe843df` (design 1c et 1c bis) fusionné dans la branche. Migrations `20261125000001` à `…06`, sans BEGIN ni COMMIT, rejouables. Fusion dans `main` et application : § 8 bis.

## À lire en premier

- **La nuit ne fait plus perdre de message.** Plage par défaut 01:00 → 07:00, heure de Dakar (réglage, valeur posée par la migration si la valeur d'origine 22 h - 8 h n'a pas été changée). Un SMS ou un push non urgent préparé la nuit reste « En attente » et part à 07:00, sans tentative ni budget consommés ; l'urgent part tout de suite ; le SMS des admins suit le même réglage. Un rappel n'est jamais envoyé à moins de 30 minutes du début.
- **Qui est « non urgent »** est désormais écrit dans le registre (`notification_types.night_policy`) : toute la famille facultative, plus 22 avis sans urgence (liste en § 2). Tout le reste (achat, billet, annulation, remboursement, sécurité, porte, bienvenue…) est urgent. **Liste validée par le client le 20/11, avec une règle en plus : un avis lié à un événement qui commence dans moins de 12 h ou en cours est urgent (§ 2).**
- **42 types existants gagnent des canaux**, 5 types sont nouveaux (§ 3). Règle appliquée : SMS pour les étapes qui touchent l'argent, l'accès à l'événement ou demandent une action ; push, cloche et email partout. Pas de SMS quand la personne vient d'agir elle-même à l'écran (essai, abonnement, billet reçu par transfert accepté).
- **Bienvenue à l'entrée** : au premier passage d'un spectateur, elle **remplace** l'avis « Entrée validée » de ce billet (un seul message). Les billets suivants du même porteur gardent « Entrée validée » groupé.
- **SMS du merci** : « être » n'existe pas dans l'alphabet SMS standard (un seul SMS exigé) ; le SMS dit « merci de votre présence à … », la cloche et l'email gardent « Merci d'être venu ».
- **En cours de lot**, à la demande de l'utilisateur : `npm run taches`, déclencheur local des tâches planifiées (§ 6) ; et, venant du design 1c, « super-administrateur » dans tous les modèles et l'écart de caisse en mots (§ 6 bis).
- **Tests modifiés** : 31 suites et 3 aides de test existantes figeaient l'ancien comportement que le client a changé ; chacune est listée en § 7 avec la raison. Les suites de la contre-vérification (`cvf4-1` à `cvf4-4`) passent sans changement d'assertion ; une seule a été touchée, pour son isolation (§ 7 bis).
- **Contre-vérification** : T1 (avis de suspension ou de reprise qui n'est plus vrai), T2 (avis d'état d'un événement terminé) et T3 (SMS facultatifs qui consommaient la part des indispensables) corrigés (§ 7 bis).

## 1. État de chaque point

| Point | État | Où |
|---|---|---|
| 1. Nuit | Fait : report à la fin de la plage (SMS et push non urgents), urgent tout de suite, SMS des admins sur le réglage, 30 min avant le début, supervision (« Reporter à la fin de la plage de nuit », heure du report), prévision du budget (les rappels reportés sont comptés), aides des réglages. | migrations `…01`, `…02` ; `app/admin/notifications/[id]`, `app/admin/finance-settings` |
| 2. Ventes | Fait : premier billet (SMS gardé), cloche et push groupés 15 min, SMS groupé au plus toutes les 30 min, résumé du matin à 9 h (sujet « Résumé du matin »), « complet » fusionné, demandes de remboursement des clients groupées 15 min sans nom ni numéro. | migration `…03` (`notif_enqueue_grouped`, `notif_sale_recorded`, recopies) |
| 3. Spectateur | Fait : bienvenue (4 canaux, une fois par spectateur et par événement), merci le lendemain à 11:00 (4 canaux, sujet « Après l'événement », désactivable, annulé si l'événement est annulé). | migration `…04` |
| 4. SMS ajoutés | Fait : remboursement par l'organisatrice ou « par l'équipe Event Village », billet revenu à l'expéditeur (expiré, refusé, numéro changé), recettes disponibles, refus en série à une porte (au plus un SMS par porte et par 15 min). Limite de 30 SMS par compte déclencheur : seulement pour les numéros saisis à la main (invitation de contrôleur, invitation et transfert de billet). Plafond quotidien des SMS facultatifs : 700 → 20 000. | migrations `…01`, `…03`, `…05` ; `lib/notifications/dispatcher.ts` |
| 5. Textes faux | Fait : compte suspendu, alertes de plafond SMS, retrait constaté non versé, aides des réglages, lien des invitations, second refus d'une demande de partenaire. Réactivation : motif non transmis, texte inchangé (vérifié par test). | `lib/notifications/catalog.ts`, migration `…05` |
| Confirmations de l'administration | Tenues justes : `lib/admin/confirmations.ts` suit les canaux élargis (push du compte, SMS des porteurs et des contrôleurs) ; le test qui les compare au registre est vert. | `lib/admin/confirmations.ts` |
| Recopies | Chaque fonction recopiée part de sa dernière définition dans main (main414, 11a comprises) ; `tests/parcours/f4-recopies.test.ts` rougit si une ligne est perdue (preuve en § 5). | — |

## 2. La nuit

- **Décision** : `notification_outbox_claim` reporte (décision `DEFER`, motif `NIGHT`) toute ligne SMS ou push d'un type `night_policy = DEFER` réservée pendant la plage : `due_at` et `next_attempt_at` = fin de plage. À la fin de la plage, toutes les revérifications s'appliquent (événement commencé, plus de billet, préférence coupée…).
- **Non urgents (DEFER)** : toute la famille facultative (rappels, ventes, résumé, merci, suspension et reprise pour les porteurs…) et : SMS des admins à valider ; événement validé, refusé, publié par l'administration ; compte partenaire validé, refusé, réactivé ; mise en avant décidée ; espèces marquées rendues par l'administration ; recettes disponibles ; événement terminé ; rapport de clôture prêt ; remboursements d'une annulation terminés ; billet revenu à l'expéditeur (expiré, refusé, numéro changé) ; transfert accepté ; invitation de contrôleur acceptée, refusée, sans réponse ; contrôleur devenu administrateur ; demandes de remboursement des clients.
- **Règle du 20/11 (liste validée par le client)** : tout avis lié à un événement qui commence dans moins de 12 heures, ou qui est en cours, est urgent, même la nuit (billet revenu à l'expéditeur, transfert, invitation de contrôleur, rappel, ventes d'un événement en cours…). L'événement est celui de la ligne ou l'un de ceux de la liste d'une invitation de contrôleur ; un événement annulé ne compte pas. Migration `…06` (`notif_event_soon`, recopie de la réservation depuis `…02`) ; la supervision affiche « événement dans moins de 12 h ou en cours : envoyé sans attendre ». Test à heure simulée (03:00) dans `f4-messages` : événement à 05:00 et événement en cours envoyés, événement lointain reporté à 07:00, invitation liée par sa liste.
- **Rappels** : annulés à moins de 30 minutes du début (motif « Moins de 30 minutes avant le début »).
- **Prévision du budget** : les rappels de la veille et des contrôleurs dus la nuit sont comptés (reportés le même jour) ; le rappel du jour même compte s'il part plus de 30 minutes avant le début.
- **Correction annexe** : la supervision affichait « De ? h à ? h » pour un SMS d'admin reporté par le correctif main-414 ; elle affiche désormais l'heure du report.

## 3. Types nouveaux et canaux

Types nouveaux : `SALES_UPDATE_SMS` (SMS seul, facultatif, « Activité de vos ventes »), `PARTNER_DAILY_SUMMARY` (4 canaux, facultatif, « Résumé du matin »), `ENTRY_WELCOME` (4 canaux, indispensable), `ENTRY_THANKS` (4 canaux, facultatif, « Après l'événement »), `PARTNER_REFUND_REQUESTS` (4 canaux, indispensable).

Canaux ajoutés (registre = catalogue, vérifié en base par `f4-messages`) :
- **+ SMS** : TRANSFER_EXPIRED, TRANSFER_DECLINED_SENDER, TRANSFER_RECIPIENT_CHANGED, TRANSFER_CLAIMED_SENDER, EVENT_SUSPENDED_HOLDER, EVENT_REACTIVATED_HOLDER, REFUND_REQUESTED (seulement quand l'organisatrice ou l'administration rembourse), EVENT_PUBLISHED_BY_ADMIN, FUNDS_AVAILABLE, CANCEL_REFUNDS_DONE, CANCEL_REFUNDS_BLOCKED, PROMOTION_DECIDED, CONTROLLER_INVITATION_ACCEPTED, _DECLINED, _EXPIRED, CONTROLLER_BECAME_ADMIN, CASH_REFUND_MARKED_BY_ADMIN, SCAN_REFUSALS_ALERT, CONTROLLER_EVENT_STATUS, SHIFT_CLOSED_BY_OTHER.
- **+ push** : PURCHASE_CONFIRMED, FREE_TICKETS_CONFIRMED, PASSWORD_CHANGED, EMAIL_CLAIMED_ELSEWHERE, REFUND_REQUESTED, TICKET_CANCELLED, ACCOUNT_SUSPENDED, ACCOUNT_REACTIVATED, PARTNER_REGISTERED_ACK, PARTNER_VALIDATED, PARTNER_REJECTED, PARTNER_SUSPENDED, PARTNER_REACTIVATED, TRIAL_STARTED, SUBSCRIPTION_ACTIVATED, PAYMENT_SUCCESS, PROMOTION_DECIDED, EVENT_SUBMITTED_ACK, EVENT_FINISHED, CLOSING_REPORT_READY, FUNDS_AVAILABLE, EVENT_CANCELLED_BY_ADMIN, CONTROLLER_EVENT_STATUS, CONTROLLER_EVENT_CANCELLED, CONTROLLER_EVENT_CHANGED, CONTROLLER_ACTIVATED.
- **Cloche des ventes sans push** : un type facultatif qui a le push doit aussi avoir l'email (règle G.50) ; un email toutes les 15 minutes serait de trop. Les ventes arrivent par la cloche (15 min), le SMS groupé (30 min) et le résumé du matin (4 canaux).
- **Non touchés** : avis aux administrateurs (supervision), avis de sécurité volontairement hors application (numéro changé, essais de connexion, adresse ajoutée), salles (`HALL_*`, lot 10b en cours).

## 4. Textes exacts nouveaux ou modifiés

Valeurs d'exemple du catalogue (titre « Gala de la Teranga », adresse https://app.eventvillage.sn). Les SMS tiennent tous en un SMS (alphabet standard, 160 caractères au plus avec des valeurs longues : `tests/parcours/f4-textes.test.ts`). Entre parenthèses : nombre de caractères de l'exemple.

| Message | Cloche (titre — texte) | SMS (caractères) |
|---|---|---|
| `SALES_UPDATE_SMS` (ventes groupées) | — | Event Village : 12 billets vendus depuis 14:00 pour Gala de la Teranga : 60 000 F CFA. (86) |
| `PARTNER_DAILY_SUMMARY` (un événement) | « Résumé de la veille » — Hier (sam. 14 nov. 2026), pour « Gala de la Teranga » : 12 billets vendus (+60 000 F CFA), 1 billet remboursé (-5 000 F CFA), 40 entrées. | Event Village : hier pour Gala de la Teranga : 12 billets vendus (60 000 F CFA), 1 remboursé (-5 000 F CFA), 40 entrées. (120) |
| `PARTNER_DAILY_SUMMARY` (plusieurs événements) | « Résumé de la veille » — Hier (sam. 14 nov. 2026), sur 3 événements : 25 billets vendus (+125 000 F CFA). | Event Village : hier sur 3 événements : 25 billets vendus (125 000 F CFA). (74) |
| `PARTNER_DAILY_SUMMARY` (remboursements seulement) | « Résumé de la veille » — Hier (sam. 14 nov. 2026), pour « Gala de la Teranga » : aucun billet vendu, 2 billets remboursés (-10 000 F CFA). | Event Village : hier pour Gala de la Teranga : aucun billet vendu, 2 remboursés (-10 000 F CFA). (96) |
| `NEW_ORDER` (une commande) | « Nouvelle commande » — 2 billets vendus pour « Gala de la Teranga » (+10 000 F CFA). | — |
| `NEW_ORDER` (groupée) | « Nouvelles ventes » — 3 billets vendus pour « Gala de la Teranga » en 2 commandes depuis 14:05 (+30 000 F CFA). | — |
| `EVENT_SOLD_OUT` (fusionné) | « Événement complet » — Toutes les catégories de « Gala de la Teranga » sont vendues, la dernière : « Carré VIP ». | Event Village : Gala de la Teranga est complet, toutes les catégories sont vendues. https://app.eventvillage.sn/partner/events (126) |
| `PARTNER_REFUND_REQUESTS` (un billet) | « Remboursement demandé » — Un billet de « Gala de la Teranga » est remboursé à la demande de son acheteur (-5 000 F CFA) : il est retiré de vos ventes. | Event Village : un billet de Gala de la Teranga est remboursé à la demande de son acheteur (-5 000 F CFA). (106) |
| `PARTNER_REFUND_REQUESTS` (groupé) | « Remboursements demandés » — 3 billets de « Gala de la Teranga » sont remboursés à la demande de leurs acheteurs depuis 14:05 (-15 000 F CFA) : ils sont retirés de vos ventes. | Event Village : 3 billets de Gala de la Teranga remboursés à la demande des acheteurs depuis 14:05 (-15 000 F CFA). (115) |
| `ENTRY_WELCOME` | « Bienvenue » — Bienvenue à « Gala de la Teranga » ! Bonne soirée avec Sabar Events. Votre entrée est validée. | Event Village : Bienvenue à Gala de la Teranga ! Bonne soirée avec Sabar Events. (80) |
| `ENTRY_THANKS` | « Merci d’être venu » — Merci d'être venu à « Gala de la Teranga ». Sabar Events et Event Village espèrent vous revoir bientôt. | Event Village : merci de votre présence à Gala de la Teranga ! https://app.eventvillage.sn/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01 (134) |
| `REFUND_REQUESTED` (par l’organisatrice) | « Billet annulé par l'organisateur » — Votre billet pour « Gala de la Teranga » est annulé par l'organisateur. Le remboursement de 5 000 F CFA est lancé sur votre compte Orange Money. Vous serez prévenu dès qu'il est versé. | Event Village : billet Gala de la Teranga annulé par l'organisateur : remboursement de 5 000 F CFA en cours sur votre compte Orange Money. (138) |
| `REFUND_REQUESTED` (par l’équipe Event Village) | « Billet annulé par Event Village » — Votre billet pour « Gala de la Teranga » est annulé par l'équipe Event Village. Le remboursement de 5 000 F CFA est lancé sur votre compte Orange Money. Vous serez prévenu dès qu'il est versé. | Event Village : billet Gala de la Teranga annulé par l'équipe Event Village : remboursement de 5 000 F CFA en cours sur votre compte Orange Money. (146) |
| `REFUND_REQUESTED` (par le client) | « Remboursement en cours » — Le remboursement de votre billet pour « Gala de la Teranga » (5 000 F CFA) est en cours. Vous serez prévenu dès qu'il est versé. | Event Village : le remboursement de votre billet Gala de la Teranga (5 000 F CFA) est en cours. (95) |
| `TRANSFER_EXPIRED` | « Transfert expiré » — Votre billet pour « Gala de la Teranga » n'a pas été accepté à temps : il reste dans vos billets. | Event Village : votre billet Gala de la Teranga n'a pas été accepté à temps : il vous revient. https://app.eventvillage.sn/tickets (130) |
| `TRANSFER_DECLINED_SENDER` | « Billet refusé » — Le destinataire a refusé votre billet pour « Gala de la Teranga » : il reste dans vos billets. | Event Village : le destinataire a refusé votre billet Gala de la Teranga. Il vous revient : https://app.eventvillage.sn/tickets (127) |
| `TRANSFER_RECIPIENT_CHANGED` | « Transfert annulé » — Le destinataire de votre billet pour « Gala de la Teranga » a changé de numéro : le transfert est annulé et le billet reste dans vos billets. | Event Village : transfert du billet Gala de la Teranga annulé, le destinataire a changé de numéro. Il vous revient : https://app.eventvillage.sn/tickets (152) |
| `TRANSFER_CLAIMED_SENDER` | « Billet accepté » — Votre billet pour « Gala de la Teranga » a été accepté par son destinataire. | Event Village : votre billet Gala de la Teranga a été accepté par son destinataire. https://app.eventvillage.sn/tickets (119) |
| `FUNDS_AVAILABLE` | « Recettes disponibles » — Les recettes de « Gala de la Teranga » sont disponibles sur votre solde : vous pouvez demander un retrait. | Event Village : les recettes de Gala de la Teranga sont disponibles. Demandez votre retrait : https://app.eventvillage.sn/partner/finance (137) |
| `SCAN_REFUSALS_ALERT` | « Refus en série à une porte » — Porte B : 12 refus en 5 minutes pour « Gala de la Teranga ». Vérifiez la porte avec vos contrôleurs. | Event Village : Porte B : 12 refus en 5 min pour Gala de la Teranga. Vérifiez cette porte avec votre équipe. https://app.eventvillage.sn/partner/events (151) |
| `EVENT_SUSPENDED_HOLDER` | « Événement suspendu » — « Gala de la Teranga » est suspendu pour le moment. Vos billets restent valables, vous serez prévenu de la suite. | Event Village : Gala de la Teranga est suspendu pour le moment. Vos billets restent valables, vous serez prévenu de la suite. (125) |
| `EVENT_REACTIVATED_HOLDER` | « Événement de nouveau en ligne » — « Gala de la Teranga » reprend comme prévu. Vos billets restent valables. | Event Village : Gala de la Teranga reprend comme prévu. Vos billets restent valables. (85) |
| `EVENT_PUBLISHED_BY_ADMIN` | « Événement publié » — « Gala de la Teranga » a été publié par l'administration. | Event Village : Gala de la Teranga a été publié par l'administration. https://app.eventvillage.sn/partner/events (112) |
| `CANCEL_REFUNDS_DONE` | « Remboursements terminés » — Tous les remboursements en ligne de « Gala de la Teranga » sont versés. | Event Village : tous les remboursements en ligne de Gala de la Teranga sont versés. https://app.eventvillage.sn/partner/events (126) |
| `CANCEL_REFUNDS_BLOCKED` | « Remboursements en attente » — Des remboursements de « Gala de la Teranga » sont bloqués : l'administration les reprend. | Event Village : des remboursements de Gala de la Teranga sont bloqués : l'administration les reprend. https://app.eventvillage.sn/partner/events (144) |
| `PROMOTION_DECIDED` (acceptée) | « Mise en avant acceptée » — La mise en avant de « Gala de la Teranga » est acceptée. | Event Village : la mise en avant de Gala de la Teranga est acceptée. https://app.eventvillage.sn/partner/events (111) |
| `PROMOTION_DECIDED` (refusée avec motif) | « Mise en avant refusée » — La demande de mise en avant de « Gala de la Teranga » est refusée. Motif : Visuel non conforme. | Event Village : la mise en avant de Gala de la Teranga est refusée. Motif : Visuel non conforme. (96) |
| `CONTROLLER_INVITATION_ACCEPTED` | « Invitation acceptée » — Aminata Fall a accepté votre invitation à contrôler l'entrée de « Gala de la Teranga ». Choisissez sa porte et les espèces dans votre équipe. | Event Village : Aminata Fall a accepté de scanner les billets à vos entrées. Choisissez sa porte : https://app.eventvillage.sn/partner/team (139) |
| `CONTROLLER_INVITATION_DECLINED` | « Invitation refusée » — Ou*** B*** a refusé votre invitation à contrôler l'entrée de « Gala de la Teranga ». Invitez une autre personne depuis votre équipe. | Event Village : Ou*** B*** a refusé de scanner les billets à vos entrées. Invitez une autre personne : https://app.eventvillage.sn/partner/team (143) |
| `CONTROLLER_INVITATION_EXPIRED` | « Invitation sans réponse » — Kh*** S*** n'a pas répondu à votre invitation à contrôler l'entrée de « Gala de la Teranga » : elle a expiré. Invitez de nouveau depuis votre équipe. | Event Village : Kh*** S*** n'a pas répondu à votre invitation à scanner les billets. Invitez de nouveau : https://app.eventvillage.sn/partner/team (146) |
| `CONTROLLER_BECAME_ADMIN` | « Contrôleur retiré de votre équipe » — Aminata Fall ne fait plus partie de votre équipe : son compte est devenu un compte d'administration Event Village. Invitez une autre personne pour vos entrées. | Event Village : Aminata Fall ne fait plus partie de votre équipe d'entrée. Invitez une autre personne : https://app.eventvillage.sn/partner/team (144) |
| `CONTROLLER_EVENT_STATUS` (suspendu) | « Événement suspendu » — « Gala de la Teranga » est suspendu : le contrôle d'accès est fermé jusqu'à nouvel avis. | Event Village : Gala de la Teranga est suspendu : le scan des billets est fermé jusqu'à nouvel avis. (100) |
| `CONTROLLER_EVENT_STATUS` (repris) | « Événement de nouveau en ligne » — « Gala de la Teranga » reprend : votre affectation est maintenue. | Event Village : Gala de la Teranga reprend : votre affectation à l'entrée est maintenue. (88) |
| `SHIFT_CLOSED_BY_OTHER` | « Caisse fermée » — Votre caisse pour « Gala de la Teranga » a été fermée par l'organisateur. Montant déclaré : 47 500 F CFA. | Event Village : votre caisse pour Gala de la Teranga a été fermée par l'organisateur. Montant déclaré : 47 500 F CFA. (117) |
| `CASH_REFUND_MARKED_BY_ADMIN` | « Espèces marquées rendues par l’administration » — L'administration a marqué rendues les espèces de la vente 1F6E2B9C (6 000 F CFA) pour « Gala de la Teranga ». Motif : Espèces rendues par la billetterie du lieu. | Event Village : l'administration a marqué rendues les espèces de la vente 1F6E2B9C (6 000 F CFA) pour Gala de la Teranga. (121) |
| `ACCOUNT_SUSPENDED` | « Compte suspendu » — Votre compte est suspendu. Motif : Paiements contestés. Vos billets payés restent valables. Pour toute question, et avant de vous rendre à un événement, ouvrez la page Aide pour joindre le support. | Event Village : votre compte est suspendu. Motif : Paiements contestés. Vos billets payés restent valables. Aide : https://app.eventvillage.sn/aide (147) |
| `WITHDRAWAL_REJECTED` (constaté non versé) | « Retrait non versé » — Votre retrait de 25 000 F CFA n'a pas été versé. Le montant est revenu sur votre solde : vous pouvez demander un nouveau retrait. | Event Village : votre retrait de 25 000 F CFA n'a pas été versé. Le montant est revenu sur votre solde. (103) |
| `ADMIN_WITHDRAWAL_REJECTED` (constaté non versé) | « Retrait constaté non versé » — Le retrait de 25 000 F CFA a été constaté non versé ; le montant est revenu sur le solde du bénéficiaire. | — |
| `PARTNER_REJECTED` (1er refus) | « Demande refusée » — Votre demande de compte partenaire n'est pas acceptée. Motif : Pièce d’identité illisible. Vous pouvez compléter votre dossier une fois depuis votre tableau de bord. | Event Village : demande partenaire refusée. Motif : Pièce d'identité illisible. Complétez votre dossier : https://app.eventvillage.sn/partner/dashboard (151) |
| `PARTNER_REJECTED` (2e refus) | « Demande refusée » — Votre demande de compte partenaire n'est pas acceptée. Motif : Pièce d’identité illisible. Votre dossier a déjà été complété une fois : ouvrez la page Aide pour joindre le support. | Event Village : demande partenaire refusée. Motif : Pièce d'identité illisible. Dossier déjà complété une fois. Aide : https://app.eventvillage.sn/aide (151) |
| `ADMIN_SMS_CAP_GLOBAL` | « Plafond de SMS atteint : codes bloqués » — Le plafond de 1 000 SMS par jour est atteint : jusqu'à minuit, heure de Dakar, plus aucun code par SMS ne part vers les comptes existants (connexion, mot de passe, retrait), ni aucun SMS facultatif. Les SMS indispensables (achat, billet, annulation, remboursement, sécurité du compte) partent toujours. | — |
| `ADMIN_SMS_CAP_NON_OTP` | « Quota de SMS hors codes atteint » — La part des SMS hors codes (700 sur 1 000 par jour) est atteinte : jusqu'à minuit, heure de Dakar, les SMS facultatifs (rappels, ventes, résumés, remerciements) et les invitations de contrôleurs ne partent plus par SMS. Les codes et les SMS indispensables (achat, billet, annulation, remboursement, sécurité du compte) partent toujours. | — |
| `ADMIN_SMS_DAILY_THRESHOLD` | « Volume de SMS indispensables élevé » — 2 150 SMS indispensables envoyés aujourd'hui (seuil d'alerte : 2 000). Ils n'ont pas de plafond global ; chaque numéro en reçoit un nombre limité par jour, et les numéros saisis à la main (invitations, transferts) sont aussi limités par compte qui les déclenche. Vérifiez leur origine dans la supervision. | — |

## 5. Recopies

| Fonction | Dernière définition de main | Recopie |
|---|---|---|
| `notification_outbox_claim` | `20261123000002_main414_nuit_sms_admins.sql` | `…02` (nuit, 30 min, « complet », merci) |
| `notification_reminders_schedule` | `20261105000002_lot7_sms.sql` | `…02` (prévision) |
| `notification_preferences_get`, `notification_preference_set` | `20261103000002_lot6_outbox.sql` | `…01` (deux sujets) |
| `payment_confirm` | `20261111000005_lot9quater_argent.sql` | `…03` (cloche et SMS groupés) |
| `notif_ticket_categories_sold_out` | `20261103000005_lot6_billetterie.sql` | `…03` (fusion) |
| `notification_daily_checks` | `20261109000009_lot9bis_messages.sql` | `…03` (résumé de 9 h) |
| `notif_cashouts_notify` | `20261123000106_l11a_annulation.sql` | `…03` (auteur du remboursement, avis groupé, non versé) |
| `notif_tickets_scanned` | `20261109000009_lot9bis_messages.sql` | `…04` (bienvenue, merci) |
| `scan_refusal_alert` | `20261110000010_lot9ter_pilotage.sql` | `…05` (SMS de porte) |
| `notif_partners_notify` | `20261103000006_lot6_pros_admin.sql` | `…05` (second refus) |

Preuve que le test rougit : une ligne retirée à la main de la recopie de `notif_cashouts_notify` (`INSERT INTO public.admin_signals … 'CASHOUT_UNCERTAIN'`), sortie brute :

```
✖ failing tests:

test at tests\parcours\f4-recopies.test.ts:125:9
✖ notif_cashouts_notify : aucune ligne de main perdue sans être listée (272.4817ms)
  AssertionError [ERR_ASSERTION]: notif_cashouts_notify : lignes de 20261123000106_l11a_annulation.sql perdues dans 20261125000003_f4_ventes.sql
  + actual - expected
  
  + [
  +   "INSERT INTO public.admin_signals (kind, ref_id) VALUES ('CASHOUT_UNCERTAIN', NEW.id) ON CONFLICT DO NOTHING;"
  + ]
  - []
  
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: [ "INSERT INTO public.admin_signals (kind, ref_id) VALUES ('CASHOUT_UNCERTAIN', NEW.id) ON CONFLICT DO NOTHING;" ],
    expected: [],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }
```

## 6. `npm run taches` (demande ajoutée en cours de lot)

Même script que `npm run cron:local`, complété : routes et fréquences lues dans `supabase/ops/schedule-crons.sql` (9 tâches, mêmes routes que pg_cron), `CRON_SECRET` lu dans l'environnement, appels refusés hors de `http://localhost` (`assertLocalTarget`), une ligne « lancé : <tâche> → POST <adresse> » avant chaque appel et son résultat après, arrêt propre au Ctrl+C (plus aucun nouvel appel, attente des appels en cours, bilan, code 0 ; second Ctrl+C : arrêt forcé). Documenté dans `docs/essai-local.md` § 6. `schedule-crons.sql` reste la planification de la préproduction et de la production. Test : `tests/schema/f4-taches-locales.test.ts`.

## 6 bis. Demande du design 1c (ajoutée en cours de lot)

« Superadmin » est remplacé par « super-administrateur » dans tous les modèles du catalogue (nouveau super-administrateur, code de secours, numéro changé et confirmé, code du numéro administrateur) et dans le libellé de supervision. L'écart de caisse est écrit en mots. Pour tenir en un SMS au pire cas : noms ramenés à 20 caractères dans le SMS du nouveau super-administrateur, « alertez vite » (au lieu de « alertez tout de suite ») dans le seul SMS du code de secours. Vérifié par `tests/parcours/f4-textes.test.ts` § 5 (écart de 9 999 999 F CFA, nom et titre longs).

| Message | Cloche | SMS (caractères) |
|---|---|---|
| `SHIFT_DISCREPANCY` (manque) | « Écart de caisse » — La caisse de Fatou Sow pour « Gala de la Teranga » est fermée. Il manque 2 500 F CFA. | Event Village : caisse de Fatou Sow fermée (Gala de la Teranga). Il manque 2 500 F CFA. https://app.eventvillage.sn/partner/events (130) |
| `SHIFT_DISCREPANCY` (de trop) | « Écart de caisse » — La caisse de Fatou Sow pour « Gala de la Teranga » est fermée. 2 500 F CFA de trop. | Event Village : caisse de Fatou Sow fermée (Gala de la Teranga). 2 500 F CFA de trop. https://app.eventvillage.sn/partner/events (128) |
| `SUPERADMIN_PROMOTED` | « Nouveau super-administrateur » — Mame Diarra Bousso Ndiaye Diop est maintenant super-administrateur, nommé par Aminata Sophie Gueye Sarr Fall. Si ce n’est pas prévu, réagissez tout de suite : changez son rôle depuis Comptes. | Event Village : Mame Diarra Bouss... est maintenant super-administrateur, nommé par Aminata Sophie Gu... Si ce n'est pas prévu, réagissez tout de suite. (152) |
| `ADMIN_BACKUP_CODE_USED` | — | Event Village : un code de secours de votre compte de super-administrateur vient de servir. Si ce n'est pas vous, alertez vite un autre super-administrateur. (157) |
| `ADMIN_PHONE_CHANGED` (par le super-administrateur) | — | Event Village : le super-administrateur a remplacé ce numéro sur votre compte administrateur. Ce téléphone ne sert plus pour vos codes. (135) |
| `ADMIN_PHONE_CHANGED` (par soi-même) | — | Event Village : le numéro de votre compte de super-administrateur a été remplacé. Si ce n'est pas vous, alertez tout de suite un autre super-administrateur. (156) |
| `ADMIN_PHONE_CONFIRMED` (par le super-administrateur) | « Numéro de téléphone changé » — Le super-administrateur a remplacé le numéro de votre compte administrateur. Les codes administrateur arrivent désormais sur ce numéro. | Event Village : ce numéro est maintenant celui de votre compte administrateur. Reconnectez-vous avec votre mot de passe. (120) |
| `ADMIN_PHONE_CONFIRMED` (par soi-même) | « Numéro de téléphone changé » — Le numéro de votre compte de super-administrateur a été remplacé. Vos autres appareils sont déconnectés. | Event Village : ce numéro est maintenant celui de votre compte de super-administrateur. Vos autres appareils sont déconnectés. (126) |
| `OTP_ADMIN_PHONE` (envoi direct) | — | Event Village : code 483920 pour confirmer ce numéro sur un compte administrateur. Donnez-le seulement au super-administrateur. Valable 10 minutes. (147) |

## 7. Tests modifiés (décision du client)

Chaque modification porte en commentaire « Finition 4 … modification signalée au rapport ». Aucune assertion n'a été affaiblie pour faire passer un test : chacune suit un comportement que le client a changé.

| Suite | Ce qui change | Raison |
|---|---|---|
| `notif-modeles`, `notif-outbox` | canaux attendus de 41 types, 5 types nouveaux, titres (remboursement, plafonds SMS, retrait non versé), textes exacts (compte suspendu, plafond, refus partenaire), textes exacts des SMS nouveaux, lien des invitations, SMS de porte | canaux élargis, textes faux corrigés (points 4, 5) |
| `f3b-confirmations` | les porteurs sont prévenus par SMS ; l'avis « sans SMS » vérifié sur la fin d'un événement | canaux élargis |
| `main414-nuit-sms-admins`, `lot9quinquies-sms-admins`, invariant (p3) de `tests/helpers/lot9quinquies-invariants.ts` | plage 01:00-07:00 du réglage au lieu de 22 h - 8 h, motif `NIGHT` | point 1 |
| `notif-rappels` | rappel de nuit : SMS et push reportés puis envoyés (plus « non envoyé sans report ») | point 1 |
| `sms-veille` | les rappels dus la nuit sont comptés dans la prévision | point 1 |
| `notif-helpers` (valeurs par défaut), `sms-plafond-optionnel` | 1, 7, 20 000 ; le cas du seuil à 80 % garde un plafond de 700 dans sa transaction annulée | points 1 et 4 |
| `messages-fin-9bis`, `scan-renvoi-seulement` | bienvenue au premier passage, « Entrée validée » pour les billets suivants | point 3 |
| `notif-pros` | cloche groupée (une pour deux paiements), « complet » fusionné, SMS du refus partenaire, canaux élargis | points 2, 4, 5 |
| `pilotage-alerte-refus`, `pilotage-volume` | SMS de porte ; cas nouveau : au plus un SMS par porte et par 15 minutes | point 4 |
| `cvf1c-t1-promotion`, `finition1-equipe`, `messages-acteurs-9bis`, `lot9bis-fonds-suspension`, `notif-transferts`, `notif-controleurs`, `f3d-suppleance`, `invitations-annulation`, `notif-abonnement` | SMS ou push en plus (décisions R24, R33, E-20 et « décision 15 » d'avant remplacées) | canaux élargis |
| `messages-comptes-9bis` | SMS de compte suspendu | point 5 |
| `notif-modeles`, `notif-pros`, `f3d-telephone` | « super-administrateur », écart de caisse en mots | demande du design 1c |
| `email-regle-envoi`, `design1b-billets` | lien des invitations vers « À venir » | point 5 |
| `notif-preferences` | sujets « Après l'événement » et « Résumé du matin » | points 2, 3 |
| `notif-migration` | `NEW_ORDER` mis en file par `notif_sale_recorded` | point 2 |
| `cv11a-5-recopies` | si une migration postérieure recopie la fonction, la 11a est contrôlée sur son fichier (la base l'est par `f4-recopies`) | recopie de `notif_cashouts_notify` |
| `f3d-ecrans` | le SMS du code du numéro administrateur dit « super-administrateur » | demande du design 1c (la règle de `f3b-ecrans` est celle de `main` depuis la fusion : « super-administrateur » partout) |
| invariant (n) de `tests/helpers/notification-invariants.ts` | un SMS facultatif parti la nuit est admis s'il est marqué « événement dans moins de 12 h ou en cours » (`quiet.event_soon`) | règle du client du 20/11 |
| `notif-pros` (avis aux porteurs d'un événement suspendu) | envoyés « maintenant » au lieu de « demain à midi » (heure par défaut de l'outil) : l'événement du test commence dans 3 h et finit avant midi le lendemain, l'avis serait annulé comme « événement terminé » | correctif T2 |
| `notif-pros` (4 tests), aide `nowOutsideNight` de `tests/parcours/notif-helpers.ts` | les avis non urgents de ces tests sont envoyés « maintenant » hors de la plage de nuit, sinon à la fin de la plage plus une minute (réglage lu en base) ; avant : « maintenant », donc reportés quand le run tombe la nuit (run 480 de `main`) ; aucune assertion changée | point 1 (nuit) |
| `acces-limiteurs`, `tests/seed/seed-demo.ts` | le compteur nouveau des SMS facultatifs par numéro est levé comme l'autre (1 000) | correctif T3 |

## 7 bis. Correctifs de la contre-vérification

Tous dans la migration `…06` (aucune n'était appliquée) et dans `lib/sms/sms-guard.ts`. Les suites `cvf4-1` à `cvf4-4` passent au vert sans changement d'assertion ; le T2 de `cvf4-1` a été adapté par la contre-vérification elle-même à la règle des 12 h (décision du chef de projet, `dbc4da362`).

- **T1** : à la réservation (`notification_outbox_claim`), un avis `EVENT_SUSPENDED_HOLDER` dont l'événement n'est plus `SUSPENDU`, ou `EVENT_REACTIVATED_HOLDER` dont l'événement n'est plus `PUBLIE`, est annulé (motif « n'est plus d'actualité »). La vérification se fait au moment d'envoyer, après la décision de nuit : un avis reporté à 07:00 est revérifié à 07:00. `notif_cancel_on_status` (recopie de `20261109000009_lot9bis_messages.sql`) annule aussi ces lignes en attente au changement d'état ; son déclencheur se déclenche désormais aussi sur `PUBLIE`, et l'annulation des rappels reste limitée à `SUSPENDU`, `ANNULE`, `TERMINE`.
- **T2** : la règle des 12 h envoie tout de suite (inchangé) ; en plus, à la réservation, un avis d'état au porteur dont l'événement est terminé (statut `TERMINE` ou fin passée) est annulé (motif `EVENT_TERMINE`).
- **T3** : deux compteurs par numéro et par jour : `sms_phone` (indispensables et autres SMS non OTP, `SMS_PER_PHONE_DAY`) et `sms_phone_optional` (famille facultative, `SMS_PER_PHONE_DAY_OPTIONAL`, même valeur par défaut 30, réglable). Un facultatif ne consomme jamais la part d'un indispensable. Test de la contre-vérification (`cvf4-2`) : 30 SMS de ventes, puis l'alerte de porte part.
- **Isolation de `cvf4-4`** (run 474) : la suite passe deux billets à UTILISE par SQL direct, sans la ligne de scan qu'un vrai scan écrit ; l'invariant (g) du contrôle d'accès tombait alors à la fin des 82 suites suivantes du même lot. Un `after()` écrit à la fin la ligne de scan accepté (par le partenaire de l'événement, à la version courante du secret du billet : invariant (p), run 475). Aucune assertion changée.

## 8. Runs

| Run | Tête | Tests | e2e | Mesure mobile | Ce qu'il a montré |
|---|---|---|---|---|---|
| 437 | `0212a7c54` | 501/534 | 1 capture rouge (erreur d'hydratation de la fiche « en cours », page non touchée) | Mes billets 88 | 30 suites figeaient l'ancien comportement ; 3 défauts réels corrigés : « .... » après une valeur tronquée (porte, espèces, billet refusé), SMS de deux retours de transfert absents du catalogue, noms de couleur de la supervision ; invariant (p3) écrit en 22 h - 8 h |
| 442 | `516993928` | 529/535 | vert | accueil 89 | comptes de lignes à 4 canaux, renvois fichier:ligne de `docs/recette-billetterie.md` décalés |
| 445 | `555246a33` | 533/535 | vert | 85-88 (machine lente : indice 3 300, calibrage ×6,7 ; scores bruts 94-98) | deux comptes de lignes |
| 448 | `4aadf5ed0` | 534/535 | vert | vert | un compte de lignes |
| 458 | `75b3ae35f` | 532/535 | vert | Mes billets 88 | demande du design 1c : deux tests figeaient « Superadmin » ; deux comptes de lignes |
| **463** | **`fe63b952e`** | **535/535** | **vert** | **vert (90, 93, 93)** | **run complet vert, 50 min 49 s** (avant la contre-vérification) |
| 470 | `8c0373b2c` | rouge (invariant n) | vert | — | correctifs T1-T3 : l'invariant (n) refusait les SMS facultatifs partis la nuit pour un événement proche (règle du 20/11) ; la vérification d'état était faite avant la décision de nuit |
| 474 | `25f70efac` | 2 lots rouges | connexion du super-administrateur (code SMS non lu, 1re fois sur 40 runs ; aucun changement de l'OTP) | rouge (pages non touchées) | renvois vers `notif-pros` décalés de 2 lignes ; isolation de `cvf4-4` (82 suites rouges par l'invariant g) |
| 475 | `9297f6a90` | 1 lot rouge | fumée (scan du partenaire) et terrain 1 (vignette de « Mes billets » sans cesse redessinée) | vert | `main` fusionné ; la ligne de scan ajoutée à `cvf4-4` n'avait pas de version de secret (invariant p, 66 suites) ; e2e : voir § 8 ter |
| 476 | `1f1174ca5` | **547/547** | **vert** (fumée, terrain, recette) | Mes billets 88 (page non touchée) | relance du seul job e2e (règle du 19/11) : mesure verte (91, 91, 90), mais connexion du super-administrateur rouge : voir § 8 ter |
| **477** | **`944aad167`** | **547/547** | **vert** | **vert (93, 91, 90)** | **run complet vert en une seule fois, 55 min 41 s** ; fusion dans `main` (`40ffd1a74`, même arbre) |
| 480 (`main`) | `40ffd1a74` | 546/547 | vert | Mes billets 88 (page non touchée) | lancé à 01:33 (heure de Dakar), **en pleine plage de nuit** : dans `notif-pros`, quatre tests envoyaient « maintenant » des avis non urgents (événement refusé puis validé, partenaire validé, refusé, réactivé), reportés à 07:00 par ce lot, restés en attente. Défaut des tests de ce lot (risque noté ci-dessous), corrigé : voir § 7 |
| 484 | `35ab70cae` | **547/547** (lancé à 02:37, de nuit : `notif-pros` vert, correction prouvée) | vert | rouge : accueil 86, fiche 88, Mes billets 81 | machine de mesure lente (indice 3 500, processeur ralenti ×7 au lieu de ×3,8 au run 477 ; scores bruts ×4 : 94-96) ; poids transférés identiques au run 477 (418, 336, 385 Ko) et aucun fichier de l'application changé depuis `944aad167` (tests et rapport seulement) ; run complet relancé par la poussée de cette ligne |
| RUN_APRES | | | | | |

## 8 ter. Échecs de l'e2e sans lien avec ce lot

**Connexion du super-administrateur (runs 474 et relance du 476).** Symptômes : au run 474, le SMS du code n'arrive jamais ; à la relance du 476, le SMS du code part (88 caractères, numéro …07 du super-administrateur du seed) et le test le lit, mais la fenêtre est revenue à « Recevoir le code par SMS » (bouton au repos, aucun message d'erreur) et la case « chiffre 1 sur 6 » n'apparaît jamais.

Vérifié dans la branche :
- la demande de code (`POST /api/admin/step-up/sms`) réserve son SMS dans la catégorie OTP de `lib/sms/sms-guard.ts`, dont les règles sortent **avant** la ligne changée par T3 : un code ne passe jamais par le compteur des SMS facultatifs ;
- l'envoi est synchrone (`mTargetService.sendOtp`), hors boîte d'envoi : la règle de nuit (`notification_outbox_claim`) ne le voit pas ; aucune règle de nuit dans `lib/sms` ;
- la réponse de la route n'a pas changé (`{ ok: true, sent: true }` ; seul le texte de `NO_PHONE` dit « super-administrateur », venu de `main`) ; le texte du SMS du code n'a pas changé ;
- heures : l'e2e du 474 a démarré vers 20:33, la relance du 476 vers 23:38 (heure de Dakar), hors de la plage 01:00-07:00 ;
- la trace Playwright (artefact `playwright-report`) n'a pas pu être téléchargée depuis le poste (accès refusé) ; la capture et le contexte d'erreur publiés suffisent : le bouton porte `isLoading={busy}` et il est au repos, la requête n'était donc plus en cours : la fenêtre a été remontée.

Cause, dans du code que ce lot ne touche pas (`components/auth/LoginForm.tsx`, `middleware.ts`, inchangés depuis le lot sécurité de déconnexion) : après « Se connecter », `LoginForm` appelle `router.refresh()` puis arme `setTimeout(() => { window.location.href = target }, 400)`, jamais annulé. Le `router.refresh()` sur `/login` d'un compte connecté est redirigé par `middleware.ts` vers `/admin/dashboard` : l'URL change sans rechargement, le test voit `/admin`, trouve la fenêtre du code et clique ; puis le minuteur recharge toute la page. Si le clic tombe pendant le déchargement, la demande ne part pas (474) ; s'il tombe juste avant, le SMS part et le rechargement remet la fenêtre à zéro (476). La course dépend de la charge de la machine : vue 2 fois sur 6 runs de cette branche, 0 sur les 40 précédents, jamais sur `main` pour l'instant. Correctif possible, hors de ce lot : ne pas armer le rechargement quand `router.refresh()` a déjà quitté `/login`, ou attendre dans l'e2e le chargement complet de la page d'arrivée avant de chercher la fenêtre.

**Fumée et terrain du run 475.** La fumée s'est arrêtée à l'étape 5 (le partenaire scanne) : le QR du billet acheté était dessiné, mais la réponse du code vivant n'a pas été vue par le test (erreur d'hydratation React #418 côté client ; événement créé à 00:05 le lendemain, run lancé vers 22:20). La fumée interrompue a laissé son billet valide en tête de « Mes billets » du client ; les deux cas « terrain 1 » ont alors trouvé leur billet en vignette, redessinée pendant le clic. Ni « Mes billets », ni le code vivant, ni la fiche ne sont touchés par ce lot ; au run 476 suivant, fumée et terrain sont verts.

La mesure mobile a varié d'un run à l'autre sur des pages que ce lot ne touche pas (accueil, fiche, Mes billets), avec le poids JavaScript toujours vert : variation de la machine de mesure, déjà vue au run 432 de main. Rien n'a été changé pour elle.

Tests sans base passés aussi sur le poste : `f4-textes` 111/111, `f4-recopies` (partie sans base) 11/11, `f4-taches-locales` 14/14 (arrêt par Ctrl+C : CI seulement), contrôle de types et lint.

Heure du run : les suites qui envoient « maintenant » un avis non urgent dépendaient de l'heure du run ; le run 480 de `main`, lancé de nuit, l'a montré (seule `notif-pros` touchée, alors que toutes les suites ont tourné de nuit). Corrigé par `nowOutsideNight` ; le run suivant, lui aussi de nuit, en est la preuve.

## 9. Reste à faire

- Appliquer les migrations `20261125000001…06` sur event-village-dev après fusion, sur feu vert (dry-run : exactement ces 6).
- Liste des avis « non urgents » validée par le client le 20/11 (règle de l'événement proche ajoutée) ; règle des SMS (§ 3) à confirmer.
- Sur event-village-dev, la plage et le plafond ne changent que s'ils avaient leur valeur d'origine ; sinon, les régler à la main.
