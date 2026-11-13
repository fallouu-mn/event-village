# 12 — Tâches planifiées : chaque tâche, sa fréquence, son effet, et ce qui se passe si elle ne tourne pas

> Guide complet de l'application Event Village, état de `main` à `0889df6` (lots 1 à 9 ter). Source de vérité : le code.
> Chaque fait porte sa preuve `fichier:ligne` (chemins relatifs au dépôt ; `M/` = `supabase/migrations/`).
> Ce qui n'a pas pu être établi est marqué **NON VÉRIFIÉ**. Aucune commande n'a été lancée contre un projet distant :
> ce fichier décrit le code et les scripts, pas l'état réel d'un projet.
> Les messages produits par ces tâches sont détaillés dans `10-notifications.md` ; le cycle des événements dans
> `04-evenement-cycle.md` ; l'argent dans `08-argent.md`. Les écarts relevés sont repris dans `15-constats.md` (W4-xx).

## Sommaire

| N° | Scénario |
|---|---|
| 12.0 | Principe commun : routes protégées, heure, double appel |
| 12.1 | `ev_notifications_dispatch` — envoi des notifications (chaque minute) |
| 12.2 | `ev_reminders` — création des rappels (toutes les 5 minutes) |
| 12.3 | `ev_payments_reconcile` — réconciliation des paiements et des versements (toutes les 5 minutes) |
| 12.4 | `ev_events_finish` — passage des événements à Terminé (toutes les 15 minutes) |
| 12.5 | `ev_stock_reservations` — purge des places retenues échues (chaque heure) |
| 12.6 | `ev_ticket_transfers` — expiration des transferts de billets (chaque heure) |
| 12.7 | `ev_moratoriums` — moratoires des réservations de salle (chaque heure) |
| 12.8 | `ev_referral_commissions` — commissions de parrainage échues (chaque heure) |
| 12.9 | `ev_cron_history_purge` — purge de l'historique des tâches (chaque nuit) |
| 12.10 | En local : `npm run cron:local` |
| 12.11 | En production : planification par la base (pg_cron), arrêt, autres planificateurs |
| 12.12 | Ce qui n'est pas planifié |

## Tableau d'ensemble

Source unique de la liste et des fréquences : `supabase/ops/schedule-crons.sql:95-122` (le script local relit ce même
fichier, `scripts/dev/cron-local.core.mjs:5-19`). Les expressions sont en UTC, qui est aussi l'heure de Dakar
(`docs/deploiement-projet-neuf.md` section 7.1 ; `lib/validations/event.ts:11-12`).

| Tâche | Route appelée | Expression | Fréquence | Délai d'attente de l'appel | Indispensable |
|---|---|---|---|---|---|
| `ev_notifications_dispatch` | `/api/cron/notifications-dispatch` | `* * * * *` | chaque minute | 55 s | oui |
| `ev_reminders` | `/api/cron/reminders` | `1-59/5 * * * *` | toutes les 5 min, à 1, 6, 11… | 60 s | oui pour les rappels |
| `ev_payments_reconcile` | `/api/cron/payments-reconcile` | `*/5 * * * *` | toutes les 5 min, à 0, 5, 10… | 60 s | **oui** |
| `ev_events_finish` | `/api/cron/events-finish` | `3-59/15 * * * *` | toutes les 15 min, à 3, 18, 33, 48 | 60 s | **oui** |
| `ev_stock_reservations` | `/api/cron/stock-reservations` | `7 * * * *` | chaque heure, minute 7 | 60 s | non (doublée par 12.3) |
| `ev_ticket_transfers` | `/api/cron/ticket-transfers` | `17 * * * *` | chaque heure, minute 17 | 60 s | oui pour les avis d'expiration |
| `ev_moratoriums` | `/api/cron/moratoriums` | `27 * * * *` | chaque heure, minute 27 | 60 s | sans effet tant que les salles ne sont pas construites |
| `ev_referral_commissions` | `/api/cron/referral-commissions` | `37 * * * *` | chaque heure, minute 37 | 60 s | non (statut affiché seulement) |
| `ev_cron_history_purge` | aucune (requête SQL dans la base) | `30 3 * * *` | chaque nuit à 03:30 | — | production seulement |

Preuves : `supabase/ops/schedule-crons.sql:78-122`. Les tâches horaires sont décalées (7, 17, 27, 37) pour ne pas tomber
ensemble (`supabase/ops/schedule-crons.sql:87`).

---

## 12.0 Principe commun

1. **Qui, où.** Personne ne touche de bouton : un planificateur appelle chaque route `/api/cron/...` par une requête
   POST (GET accepté aussi) avec l'en-tête `Authorization: Bearer <CRON_SECRET>` (`lib/security/cron-auth.ts:1-24` ;
   routes : `app/api/cron/*/route.ts`, export `GET` et `POST`). Ces routes sont ouvertes au niveau du filtre d'accès et se
   protègent elles-mêmes (`middleware.ts:15-16`).
2. **Ce qu'il saisit.** Rien : aucune heure ni aucun filtre ne vient de la requête
   (`app/api/cron/notifications-dispatch/route.ts:10-11`, `app/api/cron/reminders/route.ts:11-12`).
3. **Ce que fait le système.** Le secret présenté est comparé à `CRON_SECRET` à temps constant
   (`lib/security/cron-auth.ts:13-23`). Les routes supportent un double appel (lignes réservées en `FOR UPDATE SKIP
   LOCKED`, clés d'idempotence) (`docs/deploiement-projet-neuf.md` section 7.3 ; ex.
   `M/20261110000007_lot9ter_evenements.sql:95-100`).
4. **Messages envoyés.** Selon la tâche (12.1 à 12.8).
5. **Ce que voient les autres rôles.** Rien directement ; la supervision des envois est décrite dans
   `11-admin-superadmin.md` et `10-notifications.md`.
6. **Refus.** Sans `CRON_SECRET` sur le serveur : réponse 503 « Tâche planifiée non configurée. » ; secret absent ou faux :
   401 « Non autorisé. » (`lib/security/cron-auth.ts:14-22`).
7. **Preuves et essai.** Fichiers cités. Recette : essai 1 (`docs/recette-billetterie.md:320-335`).

## 12.1 `ev_notifications_dispatch` — l'envoyeur unique (chaque minute)

1. **Qui, où.** Tâche `ev_notifications_dispatch`, route `/api/cron/notifications-dispatch`, chaque minute
   (`supabase/ops/schedule-crons.sql:98`, `app/api/cron/notifications-dispatch/route.ts:1-26`).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.**
   - Réserve les lignes dues de la boîte d'envoi par lots de 100, au plus 10 tours et 45 secondes, et les envoie par canal
     (cloche, push, email, SMS), 5 envois en parallèle par canal (`lib/notifications/dispatcher.ts:1-25`, `:165-169`,
     `:581-640`).
   - Reprend les envois restés « en cours » plus de 10 minutes (envoyeur interrompu) : un SMS n'est **jamais renvoyé**
     (il devient « incertain »), les autres canaux repartent (`M/20261109000010_lot9bis_email.sql:347-372`). Une ligne en
     échec repart au plus tôt 1 minute après (`:595`).
   - Puis fait le contrôle du jour : compte les SMS du jour, alerte les admins à 80 % du budget des SMS optionnels et au
     seuil des SMS indispensables (une fois par jour), et prévient la partenaire quand toutes les recettes en ligne d'un
     événement terminé sont disponibles (une fois par événement, dans les 30 jours après la fin)
     (`lib/notifications/dispatcher.ts:641-655`, `M/20261109000009_lot9bis_messages.sql:1243-1370`).
   - Réponse : nombre de lignes réservées, envoyées, relancées, en échec, ignorées, incertaines, annulées, SMS du jour
     (`lib/notifications/dispatcher.ts:573-575`, `app/api/cron/notifications-dispatch/route.ts:17-18`).
4. **Messages envoyés.** Tous ceux de la boîte d'envoi (catalogue complet : `10-notifications.md`), plus ceux que le
   contrôle du jour crée : `ADMIN_SMS_OPTIONAL_80`, `ADMIN_SMS_DAILY_THRESHOLD` (admins), `FUNDS_AVAILABLE`
   (partenaire : « Recettes disponibles » / « Les recettes de « {titre} » sont disponibles sur votre solde : vous pouvez
   demander un retrait. ») (`M/20261109000009_lot9bis_messages.sql:1296-1364`, `lib/notifications/catalog.ts:1634-1640`).
   Les envois « synchrones » (codes à usage unique, invitation d'un contrôleur, vérification d'email) **ne passent pas**
   par cette tâche (`lib/notifications/catalog.ts:22-23`, `:231-237`).
5. **Ce que voient les autres rôles.** Une notification part au plus tard au passage suivant, soit moins d'une minute
   (`docs/essai-local.md:362`) ; la cloche elle-même passe par cette tâche (`docs/deploiement-projet-neuf.md` section 7.1).
6. **Si elle ne tourne pas.** Plus aucune cloche, aucun push, aucun email ni SMS de la boîte d'envoi : tout reste en
   attente et part à la reprise, sauf ce que les règles de l'envoyeur écartent alors (rappel d'un événement commencé ou
   reporté, changement d'un événement annulé ou terminé…) (`M/20261109000010_lot9bis_email.sql:455-484`,
   `docs/deploiement-projet-neuf.md` section 7.2 point 7). Pas d'alerte de volume de SMS ni d'avis « Recettes
   disponibles ». En panne d'une base ou d'un fournisseur, la route répond 500 « Envoi des notifications momentanément
   impossible. » (`app/api/cron/notifications-dispatch/route.ts:19-22`).
7. **Preuves et essai.** Recette : essais 1 et 54 (`docs/recette-billetterie.md:320-335`, `:1240-1254`).

## 12.2 `ev_reminders` — création des rappels (toutes les 5 minutes)

1. **Qui, où.** Tâche `ev_reminders`, route `/api/cron/reminders`, minutes 1, 6, 11… (`supabase/ops/schedule-crons.sql:99`,
   `app/api/cron/reminders/route.ts:1-27`).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** Pour les événements **Publiés** qui commencent au plus tard le lendemain, crée dans la
   boîte d'envoi (sans rien envoyer) les rappels dont l'échéance vient de passer, **dans les 15 minutes qui suivent
   l'échéance, sans rattrapage** (`lib/notifications/reminders.ts:1-13`, `M/20261105000002_lot7_sms.sql:540`, `:616-628`) :
   - rappel de la veille (`REMINDER_J1`) : la veille du début à l'heure du réglage `notif.reminder_j1_hour` (10 h à
     l'installation) (`M/20261105000002_lot7_sms.sql:635-640`, `M/20261103000003_lot6_reglages.sql:22-25`) ;
   - rappel avant le début (`REMINDER_H3`) : début moins `notif.reminder_h3_hours` heures (3 à l'installation)
     (`M/20261105000002_lot7_sms.sql:669-672`, `M/20261103000003_lot6_reglages.sql:26-29`) ;
   - rappel du contrôleur (`CONTROLLER_REMINDER`) : la veille du début à 18:00 (`M/20261105000002_lot7_sms.sql:703-711`).
   Un second passage ne recrée rien (clé contenant le début) (`lib/notifications/reminders.ts:4-6`). L'envoi revient à
   12.1.
4. **Messages envoyés.** `REMINDER_J1`, `REMINDER_H3`, `CONTROLLER_REMINDER` (textes, canaux et règles SMS :
   `10-notifications.md`).
5. **Ce que voient les autres rôles.** Les clients détenteurs et les contrôleurs reçoivent leurs rappels.
6. **Si elle ne tourne pas.** Aucun rappel ; un rappel dont l'échéance est passée de plus de 15 minutes n'est jamais
   créé à la reprise (`M/20261105000002_lot7_sms.sql:638`, `:672`, `:706`). Un réglage `notif.*` manquant fait échouer le
   passage : réponse 500 « Planification des rappels momentanément impossible. » (`lib/notifications/reminders.ts:11-13`,
   `app/api/cron/reminders/route.ts:20-23`).
7. **Preuves et essai.** Recette : essai 48 (`docs/recette-billetterie.md:1135-1151`).

## 12.3 `ev_payments_reconcile` — paiements et versements (toutes les 5 minutes, obligatoire)

1. **Qui, où.** Tâche `ev_payments_reconcile`, route `/api/cron/payments-reconcile` (`supabase/ops/schedule-crons.sql:100`,
   `app/api/cron/payments-reconcile/route.ts:1-96`).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système**, dans cet ordre (`app/api/cron/payments-reconcile/route.ts:12-88`) :
   1. libère les places retenues échues (comme 12.5) ;
   2. interroge SamirPay sur les paiements « en attente » de plus de 2 minutes (`PAYMENT_RECONCILE_MIN_AGE_MINUTES`) :
      confirmation (billets émis), échec ou annulation (places rendues) ; au-delà de 60 minutes
      (`PAYMENT_PENDING_MAX_AGE_MINUTES`), le paiement encore en attente expire ;
   3. recherche les succès tardifs des paiements expirés, annulés ou échoués non définitifs des 48 dernières heures
      (`PAYMENT_LATE_SUCCESS_WINDOW_HOURS`), au plus un contrôle par paiement toutes les 15 minutes ;
   4. fait expirer les paiements restés sans identifiant SamirPay (initialisation interrompue) au-delà de 60 minutes ;
   5. confirme les versements envoyés, marque « incertain » un envoi réservé depuis plus de 5 minutes sans réponse,
      reprend les versements restés à envoyer, puis signale une fois les versements en retard de plus de 30 minutes.
   Lots de 50 (`PAYMENT_RECONCILE_BATCH`). Valeurs par défaut : `lib/env.ts:76-79` (modifiables par variables
   d'environnement, `lib/env.ts:25`).
4. **Messages envoyés.** Ceux de l'achat confirmé ou échoué (06), et des versements : alerte admin d'un versement
   incertain (par un déclencheur de la base) et journal `CASHOUT_UNCERTAIN` ; avis de retard des remboursements et des
   retraits (`app/api/cron/payments-reconcile/route.ts:74-87` ; `M/20261109000007_lot9bis_versements.sql:80`). Détail :
   `06-achat-paiement.md`, `08-argent.md`, `10-notifications.md`.
5. **Ce que voient les autres rôles.** Le client voit son paiement réussi ou échoué ; l'administration voit les
   versements incertains et à reprendre (08).
6. **Si elle ne tourne pas.** SamirPay n'envoie d'avis qu'en cas de succès : sans cette tâche, un paiement échoué ou
   annulé reste « en attente » et ses places restent retenues jusqu'à leur échéance ; aucun succès tardif n'est rattrapé ;
   les versements ne sont ni confirmés, ni repris, ni signalés en retard (`docs/deploiement-projet-neuf.md` section 7.1 ;
   `app/api/cron/payments-reconcile/route.ts:12-15`). Erreur : 500 « Réconciliation interrompue. » avec le compte de ce
   qui a été fait (`:89-92`).
7. **Preuves et essai.** Recette : essais 18, 19, 58, 75, 84 (`docs/recette-billetterie.md:626-657`, `:1309-1329`,
   `:1615-1632`, `:1805-1828`).

## 12.4 `ev_events_finish` — passage des événements à Terminé (toutes les 15 minutes, obligatoire)

1. **Qui, où.** Tâche `ev_events_finish`, route `/api/cron/events-finish`, minutes 3, 18, 33, 48
   (`supabase/ops/schedule-crons.sql:101`, `app/api/cron/events-finish/route.ts:1-37`).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** Passe à Terminé, par lots de 200 et au plus 10 lots par passage, chaque événement
   **Publié** ou **Validé** dont la fin est passée (fin saisie ; date de fin sans heure : 23:59 ; sans date de fin : début
   + 6 h), avec l'acteur « Automatique » ; un Validé jamais publié est marqué « terminé sans publication » et ne devient
   jamais public (`app/api/cron/events-finish/route.ts:7-33`, `M/20261110000007_lot9ter_evenements.sql:80-114`,
   `M/20261109000008_lot9bis_cycle.sql:476-486`). Les Suspendus ne sont jamais pris (04.18). Détail : `04-evenement-cycle.md`
   scénario 04.21.
4. **Messages envoyés.** À la partenaire d'un événement venu de Publié : `EVENT_FINISHED` (« Événement terminé ») ou,
   si une caisse est encore ouverte, `SHIFT_OPEN_AT_END` ; rien pour un Validé jamais publié ; rien aux détenteurs
   (`M/20261109000009_lot9bis_messages.sql:334-373`).
5. **Ce que voient les autres rôles.** L'événement apparaît « Terminé » dans les listes et sur la fiche publique.
6. **Si elle ne tourne pas.** L'événement reste affiché « Publié » (ou « Validé ») après sa fin ; pas d'avis « Événement
   terminé » ; pas d'avis « Recettes disponibles », qui ne vise que les Terminés (`M/20261109000009_lot9bis_messages.sql:1342-1350`).
   La vente est pourtant refusée dès la fin (« Cet événement est terminé. », `M/20261106000001_lot8_canaux.sql:240-241`,
   contrôle appelé avant tout paiement : `lib/payments/checkout.service.ts:218`), et la publication aussi
   (`M/20261109000008_lot9bis_cycle.sql:337-339`). Erreur : 500 « Passage des événements terminés impossible. »
   (`app/api/cron/events-finish/route.ts:24-27`).
7. **Preuves et essai.** Recette : essais 71 et 92 (`docs/recette-billetterie.md:1543-1558`, `:1956-1972`).

## 12.5 `ev_stock_reservations` — places retenues échues (chaque heure)

1. **Qui, où.** Tâche `ev_stock_reservations`, route `/api/cron/stock-reservations`, minute 7 de chaque heure
   (`supabase/ops/schedule-crons.sql:102`, `app/api/cron/stock-reservations/route.ts:1-24`).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** Passe « expirées » les places retenues pour un paiement dont la durée de garde est
   dépassée (réglage `finance.payment_hold_minutes`, 10 min à l'installation), ce qui les rend à la vente
   (`M/20261031000013_lot2_reservations.sql:229-247`, `lib/env.ts:70-71`). La même purge est faite au début de 12.3
   (toutes les 5 minutes) et, pour les catégories achetées, avant chaque nouveau paiement (`app/api/cron/payments-reconcile/route.ts:38-40`,
   `M/20261109000007_lot9bis_versements.sql:716-720`) : cette tâche horaire n'est qu'un filet.
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Les places reviennent dans le stock affiché.
6. **Si elle ne tourne pas.** Aucun effet tant que 12.3 tourne. Erreur : 500 « Purge impossible. »
   (`app/api/cron/stock-reservations/route.ts:15-19`).
7. **Preuves.** Fichiers cités. Le commentaire de la route parle encore de 5 minutes (constat W4-02).

## 12.6 `ev_ticket_transfers` — expiration des transferts (chaque heure)

1. **Qui, où.** Tâche `ev_ticket_transfers`, route `/api/cron/ticket-transfers`, minute 17 (`supabase/ops/schedule-crons.sql:103`,
   `app/api/cron/ticket-transfers/route.ts:1-37`).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** Passe « expirés » les transferts en attente dont l'échéance est passée (48 h après l'envoi
   d'un transfert, `lib/tickets/ticket-transfer.service.ts:190`), jusqu'à 500 par passage, et déverrouille les billets
   concernés (`lib/tickets/ticket-transfer.service.ts:332-340`, `M/20261109000008_lot9bis_cycle.sql:1515-1572`).
   Réponse : « Traitement terminé. {n} transfert(s) expiré(s). » (`app/api/cron/ticket-transfers/route.ts:26-31`).
4. **Messages envoyés.** À l'expéditeur d'un transfert (pas pour une invitation, qui n'a pas d'expéditeur) :
   `TRANSFER_EXPIRED` (`M/20261109000008_lot9bis_cycle.sql:1557-1568` ; texte : `07-billets.md`, `10-notifications.md`).
5. **Ce que voient les autres rôles.** L'expéditeur retrouve son billet et son QR ; le destinataire ne peut plus
   accepter (« Ce billet ne peut plus être accepté : le délai est dépassé. », `M/20261109000008_lot9bis_cycle.sql:108-111`).
6. **Si elle ne tourne pas.** Un transfert échu est quand même expiré quand on lit « Mes billets », quand le destinataire
   tente d'accepter ou au scan, avec le même avis (`M/20261109000008_lot9bis_cycle.sql:87-91`, `:105-111`) ; sans aucune
   de ces lectures, il reste « en attente » et le billet verrouillé. Erreur : 500 « Erreur lors de l’expiration des
   transferts. » (`app/api/cron/ticket-transfers/route.ts:33-35`).
7. **Preuves et essai.** Recette : essai 27 (`docs/recette-billetterie.md:773-788`).

## 12.7 `ev_moratoriums` — moratoires des réservations de salle (chaque heure)

1. **Qui, où.** Tâche `ev_moratoriums`, route `/api/cron/moratoriums`, minute 27 (`supabase/ops/schedule-crons.sql:104`,
   `app/api/cron/moratoriums/route.ts:1-36`).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** Annule les réservations de salle « en attente », non payées, dont la date de moratoire est
   passée (`lib/payments/payment.service.ts:258-288`). Réponse : « Traitement terminé. {n} réservation(s) expirée(s). »
   (`app/api/cron/moratoriums/route.ts:26-31`). Les salles relèvent du lot 10, non construit (`14-non-implemente.md`) :
   en pratique, rien à traiter (NON VÉRIFIÉ sur une base réelle : aucune lecture de base faite).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien aujourd'hui.
6. **Si elle ne tourne pas.** Aucun effet aujourd'hui. Une erreur de lecture est rendue comme « 0 réservation(s)
   expirée(s) » (constat W4-10) ; une autre erreur : 500 « Erreur lors de l’expiration des moratoires. »
   (`app/api/cron/moratoriums/route.ts:32-35`).
7. **Preuves.** Fichiers cités.

## 12.8 `ev_referral_commissions` — commissions échues (chaque heure)

1. **Qui, où.** Tâche `ev_referral_commissions`, route `/api/cron/referral-commissions`, minute 37
   (`supabase/ops/schedule-crons.sql:105`, `app/api/cron/referral-commissions/route.ts:1-25`).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** Passe de « en attente » à « disponible » chaque commission dont la date de disponibilité est
   passée (`M/20261101000006_lot3_commissions.sql:131-146`). Le solde du parrain les comptait déjà disponibles à leur date
   (grand livre) : la tâche met seulement le statut affiché en cohérence (`app/api/cron/referral-commissions/route.ts:7-11`).
   Elle ne regarde pas le gel d'un événement suspendu, calculé à part (`M/20261110000005_lot9ter_argent.sql:293-305` ;
   constat W4-11).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Le parrain voit le statut changer (écran : `09-parrainage.md`).
6. **Si elle ne tourne pas.** Les commissions restent affichées « en attente » au-delà de leur date ; le montant
   retirable n'en dépend pas. Erreur : 500 « Libération des commissions impossible. »
   (`app/api/cron/referral-commissions/route.ts:16-20`).
7. **Preuves et essai.** Recette : essais 50 et 87 (`docs/recette-billetterie.md:1172-1187`, `:1865-1881`).

## 12.9 `ev_cron_history_purge` — historique des tâches (chaque nuit)

1. **Qui, où.** Tâche `ev_cron_history_purge`, exécutée dans la base, sans route, à 03:30 (`supabase/ops/schedule-crons.sql:120-122`).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** Efface l'historique d'exécution des tâches (`cron.job_run_details`) de plus de 7 jours ;
   cette table grossit d'environ 1 900 lignes par jour (`supabase/ops/schedule-crons.sql:88-89`, `:120-121`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien.
6. **Si elle ne tourne pas.** L'historique grossit sans limite. N'existe pas en local (le script local ne lit que les
   tâches à route, `scripts/dev/cron-local.core.mjs:8-19`) ni avec un autre planificateur
   (`docs/deploiement-projet-neuf.md` section 7.3).
7. **Preuves.** Fichiers cités.

## 12.10 En local : `npm run cron:local`

1. **Qui, où.** Développeur ou testeur, sur son poste, dans une fenêtre dédiée : `npm run cron:local`
   (`package.json:16`, `scripts/dev/cron-local.mjs:1-13`). Guide pas à pas : `docs/essai-local.md` (fenêtre 3,
   `docs/essai-local.md:288-297`).
2. **Ce qu'il saisit.** Variantes : `node scripts/dev/cron-local.mjs --list` (liste, aucun appel) ; `node
   scripts/dev/cron-local.mjs --once <tâche>` (un seul appel, code de sortie 1 en échec). Sous PowerShell 5.1, passer par
   `node` directement : `npm run cron:local -- --once …` perd le `--` (`scripts/dev/cron-local.mjs:6-9`,
   `docs/essai-local.md:416-423`). Autre option : « Options admises : --list, ou --once <tâche>. »
   (`scripts/dev/cron-local.mjs:27-32`).
3. **Ce que fait le système.**
   - Lit `.env.local` comme l'application (`scripts/dev/env-local.mjs:27-36`) et la liste des tâches dans
     `supabase/ops/schedule-crons.sql` : **8 tâches** (la purge nocturne n'a pas de route) (`scripts/dev/cron-local.mjs:103-105`,
     `scripts/dev/cron-local.core.mjs:10-19`).
   - Chaque minute (calée sur le changement de minute, lue en UTC), appelle les tâches dues sur
     `http://localhost:<EV_DEV_APP_PORT>` (3000 par défaut) avec `CRON_SECRET` ; jamais vers un tunnel, même déclaré
     (`scripts/dev/cron-local.mjs:83-98`, `:111-115`, `scripts/dev/cron-local.core.mjs:46-53`).
   - Une tâche encore en cours n'est pas relancée : « {tâche} : passage ignoré, l'appel précédent est encore en cours »
     (`scripts/dev/cron-local.core.mjs:106-128`).
   - Journal à l'écran et dans `.logs/cron-local.log` : « {tâche} HTTP {code} {durée} ms {début de la réponse} », le
     secret masqué (`scripts/dev/cron-local.mjs:34-43`, `:56-69`). Démarrage : « 8 tâches, appels vers
     http://localhost:3000 ; Ctrl+C pour arrêter » (`:96`, `docs/essai-local.md:295`).
   - Aides : 401 → « CRON_SECRET diffère du serveur : redémarrez l'application après avoir changé .env.local. » ; 503 →
     « CRON_SECRET absent du serveur : ajoutez-le à .env.local, puis redémarrez l'application. » ; application arrêtée →
     « connexion refusée ({durée}) ; aide : application non démarrée, lancez npm run dev » ; délai dépassé → « délai de
     {n} ms dépassé » (`scripts/dev/cron-local.mjs:45-48`, `:70-79`).
4. **Messages envoyés.** Ceux des tâches. Sans `EV_INTEGRATIONS=fake`, les SMS et paiements sont **réels**
   (`docs/essai-local.md:7`).
5. **Ce que voient les autres rôles.** Comme en production, à la minute près.
6. **Refus de démarrer.** « NODE_ENV={valeur} : cron:local ne tourne qu'en développement. » ; « CRON_SECRET absent de
   .env.local. » ; « NEXT_PUBLIC_APP_URL absente ou illisible. » ; adresse ni locale ni tunnel déclaré : « NEXT_PUBLIC_APP_URL
   n'est pas locale et aucun tunnel n'est déclaré par EV_DEV_TUNNEL_URL : refus. » ; tunnel mal formé : « EV_DEV_TUNNEL_URL
   doit être en https. », « EV_DEV_TUNNEL_URL doit être une adresse <nom>.trycloudflare.com. », « NEXT_PUBLIC_APP_URL
   diffère du tunnel déclaré par EV_DEV_TUNNEL_URL : refus. » ; `NODE_ENV=test` : « NODE_ENV=test : Next y saute .env.local
   sans rien dire. Retirez cette variable du terminal. » ; tâche inconnue : « Tâche inconnue : {nom}. Liste : node
   scripts/dev/cron-local.mjs --list » (`scripts/dev/cron-local.core.mjs:72-94`, `scripts/dev/env-local.mjs:36`,
   `scripts/dev/cron-local.mjs:117-118`). Message affiché : « [cron-local] refus : {raison} » (`:127-129`).
7. **Preuves et essai.** Recette : essais 1 et 48 (`docs/recette-billetterie.md:320-335`, `:1135-1151`).

## 12.11 En production : planification par la base (pg_cron)

1. **Qui, où.** Opérateur, dans l'éditeur SQL du projet Supabase, après le déploiement de l'application. Ce n'est pas une
   migration : `supabase db push` ne le joue pas (`supabase/ops/schedule-crons.sql:1-24`,
   `docs/deploiement-projet-neuf.md` section 7.2).
2. **Ce qu'il saisit.** Deux secrets dans Vault, une fois : `ev_app_url` (origine HTTPS de l'application, sans chemin) et
   `ev_cron_secret` (la valeur de `CRON_SECRET` de l'hébergeur) ; puis il exécute `supabase/ops/schedule-crons.sql` en
   entier (`docs/deploiement-projet-neuf.md` section 7.2 points 3 et 4).
3. **Ce que fait le système.** Le script, tout ou rien et rejouable : vérifie Vault et les deux secrets, active pg_cron et
   pg_net, planifie exactement les 9 tâches `ev_…`, retire toute autre tâche `ev_…` (dont l'ancienne
   `ev_event_change_notifications`), réactive une tâche désactivée à la main, et affiche la liste (9 lignes actives)
   (`supabase/ops/schedule-crons.sql:8-17`, `:26-152`). Chaque appel relit l'adresse et le secret dans Vault : aucun secret
   n'est écrit dans la définition des tâches (`:108-116`). Changer `CRON_SECRET` : mettre à jour l'hébergeur puis le secret
   Vault, sans relancer le script (`:19-21`). Arrêt : `supabase/ops/unschedule-crons.sql` retire toutes les tâches `ev_…`
   et garde secrets et extensions (`supabase/ops/unschedule-crons.sql:1-39`).
4. **Messages envoyés.** Aucun par le script.
5. **Ce que voient les autres rôles.** Contrôles proposés à l'opérateur (liste des tâches, exécutions récentes, réponses
   HTTP) : `docs/deploiement-projet-neuf.md` section 7.2 point 5. Côté application, la supervision des envois de
   l'administration montre ce qui est passé par la boîte d'envoi (même section).
6. **Refus du script.** « Extension pg_cron indisponible sur cette base : la planification est impossible. » ; « Extension
   pg_net indisponible sur cette base : la planification est impossible. » ; « Vault (extension supabase_vault) absent :
   activez-le avant de planifier les tâches. » ; « Secret Vault ev_app_url absent : créez-le avec l'origine publique de
   l'application (https://<domaine>), voir docs/deploiement-projet-neuf.md section 7. » ; « Secret Vault ev_app_url
   invalide : origine HTTPS attendue, sans chemin (https://<domaine>). » ; « Secret Vault ev_cron_secret absent : créez-le
   avec la valeur de CRON_SECRET, voir docs/deploiement-projet-neuf.md section 7. » ; « Secret Vault ev_cron_secret
   invalide : il ne doit contenir ni espace ni retour à la ligne. » (`supabase/ops/schedule-crons.sql:36-65`).
   **Autres planificateurs** : un seul à la fois ; Vercel payant (fichier `vercel.json` non versionné, l'offre gratuite ne
   permet qu'une tâche par jour) ou planificateur externe avec l'en-tête `Authorization` (`docs/deploiement-projet-neuf.md`
   section 7.3). Il n'y a pas de `vercel.json` dans le dépôt (recherche à la racine) et aucune migration ne planifie de
   tâche (recherche de `cron.schedule` dans `supabase/migrations/` : aucune occurrence).
7. **Preuves.** Fichiers cités. L'état réel des tâches sur `event-village-dev` n'a pas été consulté : **NON VÉRIFIÉ**.

## 12.12 Ce qui n'est pas planifié

- Aucune tâche ne relance un événement Suspendu dont la fin est passée : il reste Suspendu jusqu'à une décision de
  l'administration (04.18) (`M/20261110000007_lot9ter_evenements.sql:95-100`).
- Aucune tâche ne fait expirer un brouillon ou un « En attente » dont la date est passée : ils restent dans leur statut
  (seuls Publiés et Validés sont pris, même preuve).
- Aucune tâche ne crée les rappels manqués (12.2) ni ne renvoie un SMS incertain (12.1).
- Les compteurs de quotas se purgent d'eux-mêmes à l'écriture (`M/20261031000011_lot1c9_quotas.sql:87`) ; l'ancienne
  table `rate_limits`, qui prévoyait un nettoyage périodique, est supprimée (`M/20261101000012_lot4_securite.sql:41-45`).
- L'ancienne tâche `ev_event_change_notifications` (lot 5) n'existe plus : les messages de changement passent par la
  boîte d'envoi (12.1) (`supabase/ops/schedule-crons.sql:15`).
