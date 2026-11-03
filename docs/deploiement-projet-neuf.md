# Déploiement — montage du futur projet de production depuis zéro

**Statut :** procédure préparée au lot 1A, complétée à chaque lot (dernière mise à jour : lot 6, notifications et planification indépendante de l'hébergeur). **À ne pas exécuter maintenant** : elle sera déroulée quand l'hébergeur de l'application sera choisi.

**Principe :** la production se fait sur un projet Supabase **neuf**. On n'y copie rien du projet de test : ni données, ni comptes, ni clés. Le schéma vient uniquement des migrations du dépôt.

---

## 1. Pré-requis

- Branche du dépôt validée (CI verte : `npm run verify`).
- Supabase CLI à la version figée dans `.github/workflows/verify.yml`.
- Accès administrateur au compte Supabase de l'organisation, aux comptes SamirPay, MTarget et Resend de production.
- Un poste de confiance pour l'opérateur. Les secrets ne transitent ni par le dépôt, ni par un chat, ni par une capture d'écran.

## 2. Créer le projet

1. Créer un nouveau projet Supabase dans l'organisation, région la plus proche de Dakar, mot de passe de base généré et conservé dans le gestionnaire de secrets.
2. Dans **Authentication > Providers** :
   - email : activé ; « Confirm email » : **activé** ;
   - inscription publique : activée (le trigger `handle_new_user` ne crée plus que des comptes CLIENT) ;
   - téléphone : **désactivé**, comme en local et en CI (`[auth.sms] enable_signup = false`). Les comptes sont créés par les routes serveur (`auth.admin.createUser`, téléphone et email déjà confirmés) et les codes SMS partent par MTarget depuis l'application ; Supabase n'envoie aucun SMS, le hook SMS (6 bis) n'est donc à configurer que si le fournisseur téléphone est un jour activé.
3. Dans **Authentication > Rate limits** : conserver les valeurs par défaut de Supabase (la valeur relevée de `supabase/config.toml` ne concerne que l'instance locale de test).
4. Ne créer **aucune** fonction, table ni politique à la main dans l'éditeur SQL. Tout passe par les migrations (étape 3). Une fonction créée à la main échappe aux tests de privilèges (c'est ainsi qu'`exec_sql` est apparue sur le projet de test). Seules exceptions, prévues et versionnées : les scripts d'exploitation de `supabase/ops/` (planification, section 7), qui ne créent ni table ni fonction de `public`.

## 3. Appliquer le schéma depuis zéro

Sur un projet neuf, l'historique de migrations est vide : `db push` applique tout, dans l'ordre.

```bash
supabase link --project-ref <ref-du-projet-de-production>
supabase db push --dry-run     # relire la liste : toutes les migrations du dépôt, rien d'autre
supabase db push
```

Puis exécuter `supabase/hotfix/2026-10-31-lot1a/03-verification.sql` dans l'éditeur SQL : **toutes** les lignes doivent être `OK`. Sur un projet neuf, cette vérification doit passer sans appliquer `02-hotfix.sql` (la migration du lot 1A est déjà incluse).

Les migrations ne créent ni pg_cron ni pg_net et ne planifient aucune tâche (décision 55 du lot 6, contrôlée par `tests/schema/planification-crons.test.ts`) : la planification est une étape à part (section 7).

## 4. Données de référence (sans données de test)

- `supabase/seed.sql` n'est **pas** joué par `db push`. Les données de référence nécessaires au fonctionnement sont créées par les migrations :
  - `platform_settings` : **33 clés** après le lot 6 (dont `ticketing_fee_config`, migration `0012`, les réglages `finance.*` et `access.*`, et les 9 réglages `notif.*` du lot 6, migration `20261103000003`) ;
  - `referral_config` (4 barèmes) ;
  - `notification_types` : registre des types de notifications (famille, sujet, canaux, destinataires), migration `20261103000002`.

  Relevé sur le projet de production le 02/11/2026 après `db push`, **avant** le lot 6 : 24 clés et 4 barèmes, aucune donnée de compte, d'événement, de billet ni de paiement. Après les migrations du lot 6, `select count(*) from platform_settings;` doit donner 33.
- `subscription_plans` n'est **pas** rempli par les migrations : ses lignes ne figurent que dans `supabase/seed.sql`, qui ne doit pas être joué en production. La table reste vide tant que le client n'a pas validé les formules et leurs tarifs (point de l'audit) ; elles seront alors créées par une migration dédiée.
- **Ne jamais exécuter** `npm run seed:test` ni `tests/seed/seed-test.ts` contre ce projet : ce seed crée des comptes de test avec un mot de passe connu. Le garde-fou `tests/helpers/env.ts` refuse de toute façon une URL non locale.
- Avant l'ouverture, vérifier et corriger les valeurs métier contradictoires relevées par l'audit (taux de parrainage `referral_config` de la migration `0011` contre CDC §95-§97, tarifs des packs) : traité dans un lot ultérieur, à valider avec le client.

### 4 bis. Réglages des notifications (`notif.*`, lot 6)

Créés par la migration `20261103000003` avec les valeurs ci-dessous. Comme `finance.*` et `access.*`, ils ne sont modifiables que par un SUPERADMIN actif, par `PUT /api/admin/finance-settings` (page **Réglages** de l'administration, section « Notifications ») : valeur validée en base, motif obligatoire, historique dans `platform_settings_history`.

| Clé | Défaut | Valeurs admises | Rôle |
|---|---|---|---|
| `notif.reminder_j1_enabled` | `true` | booléen | rappel la veille de l'événement |
| `notif.reminder_j1_hour` | `10` | entier de 6 à 20 | heure du rappel de la veille (heure de Dakar) |
| `notif.reminder_h3_enabled` | `true` | booléen | rappel avant le début |
| `notif.reminder_h3_hours` | `3` | entier de 1 à 12 | nombre d'heures avant le début |
| `notif.j1_sms` | `ALWAYS` | `ALWAYS`, `IF_NO_PUSH`, `NEVER` | SMS du rappel de la veille : toujours, seulement sans notification push remise, jamais |
| `notif.h3_sms` | `IF_NO_PUSH` | idem | SMS du rappel avant le début |
| `notif.sms_quiet_start` | `22` | entier de 0 à 23 | début de la plage sans SMS facultatif (heure de Dakar) |
| `notif.sms_quiet_end` | `8` | entier de 0 à 23 | fin de la plage ; début = fin signifie aucune plage |
| `notif.sms_daily_alert` | `2000` | entier de 1 à 1 000 000 | seuil d'alerte des SUPERADMIN sur le nombre de SMS du jour |

Une clé `notif.*` supprimée à la main fait échouer la planification des rappels (tâche `ev_reminders` en erreur 500, visible) ; l'envoyeur continue d'envoyer les messages indispensables et passe les seuls messages facultatifs en « Non envoyée », motif « Réglage des notifications manquant ».

## 5. Variables d'environnement de l'application

À saisir dans l'hébergeur (jamais dans un fichier versionné). `lib/env.ts` est la référence : il refuse de démarrer les routes serveur si une variable obligatoire manque et liste les absentes. Les exemples de valeurs sont dans `.env.example` ; aucune valeur réelle n'est écrite dans ce document.

### 5.1 Obligatoires (le serveur refuse de démarrer sans elles)

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Projet de production > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem (clé publique) |
| `SUPABASE_SERVICE_ROLE_KEY` | idem (secret serveur) |
| `NEXT_PUBLIC_APP_URL` | URL publique définitive en HTTPS (liens d'activation, URLs de retour de paiement, liens des SMS, emails et notifications push) |
| `SAMIRPAY_API_URL` | `https://app.samirpay.com/samirpays` (jamais l'URL sandbox) |
| `SAMIRPAY_API_KEY`, `SAMIRPAY_SECRET_KEY` | compte SamirPay de **production**, clés nouvelles |
| `MTARGET_USERNAME`, `MTARGET_PASSWORD` | compte MTarget, identifiants renouvelés (le SMS est le canal essentiel) |
| `OTP_HASH_SECRET` | secret aléatoire dédié (`openssl rand -hex 32`), différent de toute autre clé ; le changer invalide seulement les codes OTP en cours (10 min) |
| `TICKET_TOTP_MASTER_KEY` | secret aléatoire dédié (`openssl rand -hex 32`, 32 caractères au moins), différent de toute autre clé : clé maître du code dynamique des billets (QR) ; le changer invalide seulement les QR affichés (rafraîchis toutes les 20 s) |
| `REGISSEUR_PIN_KEY` | secret aléatoire dédié (`openssl rand -hex 32`, 32 caractères au moins), différent de toute autre clé et de `TICKET_TOTP_MASTER_KEY` : clé du hachage des PIN régisseur ; le changer oblige les organisateurs à régénérer leurs PIN |

### 5.2 Obligatoire en exploitation

| Variable | Rôle |
|---|---|
| `CRON_SECRET` | secret aléatoire propre aux tâches planifiées (`openssl rand -hex 32`). Facultatif au démarrage, mais **sans lui toutes les routes `/api/cron/*` répondent 503** (aucun envoi de notification, aucun rappel, aucune réconciliation de paiement). Sa valeur est recopiée dans le secret Vault `ev_cron_secret` (section 7) : les deux doivent rester identiques. |

### 5.3 Facultatives, nouvelles au lot 6

| Variable | Défaut | Rôle |
|---|---|---|
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | aucune | notifications push web (section 6 quater). **Les trois ou aucune** : sans elles (ou avec une configuration partielle ou invalide), le canal push est désactivé, les envois push sont marqués « Non envoyée », motif « Notifications push non configurées », un seul avertissement au démarrage, et tout le reste fonctionne. `VAPID_SUBJECT` : `mailto:<adresse de contact>` ou `https://<domaine>`. `VAPID_PRIVATE_KEY` est un secret, différent de toute autre clé (refusé au démarrage s'il reprend la valeur d'un secret dédié). |
| `MTARGET_TIMEOUT_MS` | 15000 | délai maximal d'un appel MTarget ; au-delà, l'issue du SMS est classée **« Incertaine »** : il n'est jamais renvoyé automatiquement (risque de double SMS facturé) et apparaît comme tel dans la supervision |
| `PUSH_TIMEOUT_MS` | 10000 | délai maximal d'un envoi vers un service push |
| `PUSH_SUBSCRIBE_PER_USER_HOUR` | 20 | inscriptions d'appareils par compte et par heure |
| `PUSH_TEST_PER_USER_HOUR` | 5 | notifications d'essai par compte et par heure (bouton de la page des préférences) |
| `PUSH_ENDPOINT_ALLOWED_ORIGINS` | liste intégrée | **ne pas renseigner en production** : remplace la liste blanche des services push (Google, Mozilla, Apple, Microsoft), qui protège le serveur contre les appels vers des adresses arbitraires ; réservée aux tests |

### 5.4 Facultatives existantes

| Variable | Défaut | Rôle |
|---|---|---|
| `MTARGET_SENDER`, `MTARGET_SERVICE_ID` | valeurs du compte actuel (`lib/sms/mtarget-http.adapter.ts`) | nom d'expéditeur et service MTarget : à renseigner avec ceux du compte de production |
| `MTARGET_API_URL` | API publique MTarget | à ne changer que sur instruction du fournisseur |
| `SAMIRPAY_TIMEOUT_MS` | 15000 | délai maximal d'un appel SamirPay ; au-delà, un cashout est classé INCERTAIN et n'est jamais renvoyé automatiquement |
| `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`, `SUPPORT_EMAIL` | aucune | sans `RESEND_API_KEY`, le canal email est désactivé (un avertissement au démarrage, envois email marqués « Non envoyée », motif « Envoi des emails non configuré ») ; SMS, push et notifications in-app partent normalement. Compte Resend du client, à configurer plus tard (clé nouvelle, domaine vérifié) |
| `SUPABASE_AUTH_HOOK_SECRET` | aucune | seulement si le hook SMS de Supabase Auth est activé (6 bis) : sans lui, `/api/auth/sms-hook` refuse tout appel. **Nouveau** secret généré à l'étape 6 bis (jamais la valeur du projet de test, publiée) |
| `SUPERADMIN_PHONE` | aucune | déclarée dans `lib/env.ts` mais lue nulle part : inutile à renseigner ; elle n'attribue aucun rôle (bootstrap : section 8) |
| `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` | OpenStreetMap | fournisseur de tuiles des cartes ; vérifier ses conditions d'usage avant l'ouverture |
| `CLIENT_IP_SOURCE` | `x-forwarded-for` | garder `x-forwarded-for` uniquement derrière un hébergeur qui réécrit l'en-tête ; sinon `x-real-ip` ou `none` (pas de limite par IP) |
| `PAYMENT_HOLD_MINUTES`, `CHECKOUT_PER_USER_15MIN`, `CHECKOUT_PER_USER_DAY`, `CLAIM_FREE_PER_USER_HOUR`, `PAYMENT_RECONCILE_MIN_AGE_MINUTES`, `PAYMENT_PENDING_MAX_AGE_MINUTES`, `PAYMENT_LATE_SUCCESS_WINDOW_HOURS`, `PAYMENT_RECONCILE_BATCH`, `STATUS_POLL_RECONCILE_SECONDS` | 15, 10, 50, 20, 2, 60, 48, 50, 5 | durée de réservation du stock, quotas d'achat par compte, fenêtres et taille de lot de la réconciliation, intervalle minimal des réconciliations demandées par la page de statut (lot 2) |
| `SMS_OTP_PER_PHONE_15MIN`, `SMS_OTP_PER_PHONE_DAY`, `SMS_OTP_PER_IP_HOUR`, `SMS_OTP_PER_IP_DAY`, `SMS_PER_PHONE_DAY`, `SMS_GLOBAL_DAILY_CAP` | 3, 10, 10, 30, 30, 1000 | à ajuster au budget SMS du client (5.5) ; `SMS_PER_PHONE_DAY` ne compte que les notifications (l'OTP a ses propres compteurs par numéro) ; le plafond global quotidien bloque tout SMS et alerte les SUPERADMIN |
| `SMS_GLOBAL_OTP_RESERVED_PERCENT`, `SMS_PER_ACCOUNT_DAY` | 30, 30 | part du plafond global réservée à l'OTP (les autres SMS s'arrêtent à 100 − part %) ; SMS non OTP qu'un même compte connecté peut déclencher par jour |
| `SCAN_PER_SCANNER_10S`, `CASH_COLLECT_PER_SCANNER_MIN`, `LIVE_CODE_PER_USER_MIN`, `RESOLVE_PHONE_PER_IP_HOUR`, `VERIFY_OTP_PER_PHONE_15MIN`, `CONTROLLER_SETUP_PER_PHONE_HOUR`, `PARTNER_REGISTER_PER_IP_HOUR`, `INVITE_PER_PARTNER_HOUR`, `INVITE_PER_PHONE_DAY`, `REGISSEUR_PIN_PER_SHIFT_15MIN` | 30, 20, 60, 30, 10, 10, 10, 20, 3, 5 | quotas en base (lot 4) : chaque tentative compte ; au-delà, HTTP 429 ; garde injoignable, HTTP 503 |
| `WITHDRAWAL_REQUEST_PER_USER_HOUR`, `COUNTER_RECEIPT_PER_SHIFT_DAY`, `SCAN_INCIDENT_REPORT_PER_SCANNER_MIN`, `SCAN_INCIDENT_LOG_PER_SCANNER_MIN` | 10, 500, 10, 60 | demandes de retrait par compte et par heure, reçus SMS du guichet par caisse et par jour, incidents de scan déclarés et écrits par minute (lot 5) |
| `DOCUMENT_UPLOADS_PER_IP_HOUR` | 20 | dépôts publics de pièces d'inscription partenaire, par IP et par heure |
| `EV_INTEGRATIONS` | `real` | **ne pas définir** (valeur `fake` réservée aux tests, refusée en production) |

Variables qui ne sont plus lues (à retirer si elles existent dans l'hébergeur) : `SAMIRPAY_CASHIN_URL`, `SAMIRPAY_CASHOUT_URL`, `SAMIRPAY_SOLDE_URL`, `SAMIRPAY_STATUS_URL`, `SAMIRPAY_WEBHOOK_SECRET` (lot 2).

Règles :

- aucune clé du projet de test ou de l'ancien `.env.local` n'est réutilisée ;
- `SUPABASE_AUTH_HOOK_SECRET` ne sert plus qu'au hook SMS (lot 4 : QR dynamiques et PIN régisseur ont leurs clés dédiées `TICKET_TOTP_MASTER_KEY` et `REGISSEUR_PIN_KEY`) ; il doit être unique à la production ;
- `OTP_HASH_SECRET`, `TICKET_TOTP_MASTER_KEY` et `REGISSEUR_PIN_KEY` sont trois secrets différents : le serveur refuse de démarrer si l'un d'eux reprend la valeur d'un autre ou d'une autre clé (service_role, hook, cron, SamirPay, clé privée VAPID).

### 5.5 Plafond SMS à dimensionner avant l'ouverture

Avec les réglages par défaut, un billet vendu coûte : 1 SMS de confirmation par **commande** (payeur), 1 SMS de rappel la veille par compte porteur, et 1 SMS de rappel avant le début seulement si aucune notification push n'a été remise (aucun si ce rappel tombe dans la plage sans SMS, de 22 h à 8 h). Une commande d'un billet sans push coûte donc **3 SMS**, avec push **2** ; une commande de 4 billets gardés par l'acheteur, sans push, 0,75 SMS par billet. Un billet transféré ajoute 1 SMS (offre au destinataire). S'y ajoutent les messages occasionnels (annulation, remboursement versé, changement de date ou de lieu, premier billet vendu, catégorie épuisée, événement complet, écart de caisse, retrait) et les codes OTP.

Le plafond par défaut (`SMS_GLOBAL_DAILY_CAP` = 1 000, dont 30 % réservés à l'OTP, soit **700 SMS hors OTP par jour**) est bas : un rappel de la veille pour un événement de plus de 700 porteurs le même jour serait en partie refusé (SMS marqués « Non envoyée », motif « Plafond quotidien de SMS atteint », sans relance ; notification in-app et push envoyées). Le seuil d'alerte `notif.sms_daily_alert` (2 000) ne peut pas être atteint avec ce plafond. À relever avec le client, d'après son budget MTarget, avant l'ouverture des ventes.

## 6. Paiements SamirPay (lot 2)

- Contrat appliqué : cashin direct (`/api/tiers/direct/initPayment`), statut (`/api/tiers/payments/{id}/status`), cashout (`/api/tiers/payments/send`), solde, sous `SAMIRPAY_API_URL`. Les anciennes variables `SAMIRPAY_CASHIN_URL`, `_CASHOUT_URL`, `_SOLDE_URL`, `_STATUS_URL` et `SAMIRPAY_WEBHOOK_SECRET` ne sont plus lues : les retirer.
- Le webhook est adressé par SamirPay au `callBackUrl` transmis à chaque paiement (`https://<domaine>/api/webhooks/samirpay?t=<jeton du paiement>`) : aucune configuration côté SamirPay, mais `NEXT_PUBLIC_APP_URL` doit être l'URL publique HTTPS définitive.
- Le solde du compte partenaire SamirPay doit couvrir les remboursements : il est vérifié avant chaque envoi (refus et alerte aux SUPERADMIN sinon).

## 6 ter. Finance (lot 3)

- **Réglages financiers** : clés `finance.*` de `platform_settings`, créées par la migration `20261101000002_lot3_reglages.sql` avec les valeurs par défaut ci-dessous. Elles ne sont modifiables que par un SUPERADMIN, par `PUT /api/admin/finance-settings` (valeur validée en base, motif obligatoire, historique dans `platform_settings_history`). Une modification ne s'applique qu'aux opérations suivantes : les taux sont recopiés sur chaque paiement, commission et retrait au moment où ils naissent.

  | Clé | Défaut | Rôle |
  |---|---|---|
  | `finance.service_fee_rate` | 5 | frais de service payés par l'acheteur (% du prix, au FCFA supérieur par billet) |
  | `finance.aggregator_fee_rate.WAVE` / `.ORANGE_MONEY` | 1,5 / 1,5 | frais SamirPay sur le total payé, par opérateur |
  | `finance.cancellation_aggregator_fee_bearer` | EVENT_VILLAGE | qui supporte les frais d'agrégateur perdus quand l'organisateur rembourse ou annule |
  | `finance.payout_hold_enabled` / `finance.payout_delay_hours` | true / 48 | fonds organisateur disponibles à la fin de l'événement + délai |
  | `finance.withdrawal_fee_rate` / `finance.withdrawal_min_amount` | 1 / 5 000 | frais (FCFA supérieur) et seuil de retrait |
  | `finance.withdrawal_bank_enabled` | false | retraits par virement bancaire |
  | `finance.referral_availability_days` | 7 (7 à 14) | délai avant qu'une commission de parrainage soit disponible |

- **Retraits** : par Wave ou Orange Money uniquement (le virement reste fermé tant que le réglage est faux), confirmés par un code SMS envoyé au téléphone du compte, versés par le module de cashout. Le solde SamirPay doit couvrir aussi les retraits. Un envoi à l'issue incertaine n'est jamais relancé : il reste réservé jusqu'à vérification manuelle par un SUPERADMIN (alerte reçue).
- **Grand livre** : les soldes organisateur et parrainage sont calculés depuis `finance_ledger` ; un projet neuf démarre vide (aucune reprise d'historique n'est prévue).

## 6 bis. Hook SMS de Supabase Auth

À configurer seulement si le fournisseur téléphone de Supabase Auth est activé (il ne l'est pas, section 2).

1. **Authentication > Hooks > Send SMS hook** : type HTTPS, URL `https://<domaine>/api/auth/sms-hook`.
2. Générer le secret dans ce même écran, le reporter dans `SUPABASE_AUTH_HOOK_SECRET` de l'application, redéployer.
3. Tester l'envoi d'un OTP vers un numéro de l'équipe.

Le hook n'accepte que la signature Standard Webhooks de Supabase (horodatage à ± 5 minutes) ou le secret complet ; chaque envoi passe par les limites anti-abus des OTP et le plafond global.

## 6 quater. Notifications push web (lot 6, facultatif)

Sans clés VAPID, l'application fonctionne entièrement ; la page « Préférences de notification » indique alors que les notifications push sont indisponibles pour le moment.

1. Sur le poste de confiance de l'opérateur, dans le dépôt (la bibliothèque `web-push` est une dépendance figée) :

   ```bash
   npx web-push generate-vapid-keys --json
   ```

   La commande affiche une clé publique et une clé privée. Ne pas les copier ailleurs que dans l'hébergeur et le gestionnaire de secrets.
2. Saisir dans l'hébergeur `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et `VAPID_SUBJECT` (`mailto:<adresse de contact du client>`), puis redéployer.
3. Vérifier : un compte de l'équipe active les notifications sur la page des préférences (le navigateur ne demande l'autorisation qu'après ce clic), puis utilise le bouton d'essai : la notification arrive dans la minute (passage de l'envoyeur, tâche `ev_notifications_dispatch`).

Limites : sur iPhone, le push web ne fonctionne que pour l'application installée sur l'écran d'accueil. **Rotation des clés** : changer la paire VAPID invalide tous les abonnements existants ; ils sont supprimés au premier envoi suivant, et chaque appareil se réabonne à la prochaine ouverture de l'application si l'autorisation a été accordée. Entre-temps, ces appareils ne reçoivent plus de push (les SMS de rappel en mode « seulement sans push » partent alors). À ne faire qu'en cas de fuite de la clé privée.

## 7. Tâches planifiées

L'hébergeur n'est pas choisi : la planification est portée par la base, avec **pg_cron** (planificateur) et **pg_net** (appels HTTP), et ne dépend pas de l'hébergeur. Chaque tâche appelle une route `/api/cron/*` de l'application en POST avec l'en-tête `Authorization` construit depuis Vault ; les routes sont publiques au middleware et se protègent elles-mêmes (`CRON_SECRET`, comparaison à temps constant ; 503 sans `CRON_SECRET`, 401 sans le bon jeton). L'URL de l'application et le secret sont lus dans **Supabase Vault à chaque exécution** : aucun d'eux n'est écrit dans la définition des tâches (`cron.job`).

### 7.1 Les 9 tâches

| Tâche | Route | Expression (UTC) | Fréquence | Raison |
|---|---|---|---|---|
| `ev_notifications_dispatch` | `/api/cron/notifications-dispatch` | `* * * * *` | chaque minute | envoyeur unique de la boîte d'envoi (in-app, SMS, email, push) : la première relance est prévue à 1 min, les envois interrompus sont repris après 10 min, la confirmation d'achat et la cloche n'attendent pas 5 min ; un passage sans ligne due coûte une lecture indexée. Délai pg_net de 55 s (l'envoyeur travaille 45 s au plus) |
| `ev_reminders` | `/api/cron/reminders` | `1-59/5 * * * *` | toutes les 5 minutes, à 1, 6, 11… | crée les rappels dus (veille, avant le début, rappel des contrôleurs) ; chaque rappel est créé dans les 15 min de tolérance qui suivent son échéance (5 min suffisent, sans rattrapage). Décalé d'une minute pour ne pas tomber avec la réconciliation |
| `ev_payments_reconcile` | `/api/cron/payments-reconcile` | `*/5 * * * *` | toutes les 5 minutes (**obligatoire**) | statut SamirPay des paiements en attente : confirmation (billets), échec ou annulation (stock rendu), expiration des paiements trop anciens, succès tardifs, confirmation et contrôle des remboursements ; le webhook SamirPay n'étant envoyé qu'en cas de succès, c'est le seul moyen de connaître FAILED et CANCELLED |
| `ev_events_finish` | `/api/cron/events-finish` | `3-59/15 * * * *` | toutes les 15 minutes, à 3, 18, 33, 48 (**obligatoire**) | passage à TERMINÉ des événements publiés dont la fin est passée (fin renseignée, sinon jour du début à 23:59, heure de Dakar), journalisé par le système ; le scan et l'ouverture de caisse restent possibles jusqu'à la fermeture de la fenêtre de scan (`access.scan_window_after_hours`) |
| `ev_stock_reservations` | `/api/cron/stock-reservations` | `7 * * * *` | horaire, à la minute 7 | purge des réservations de stock échues ; la réconciliation, toutes les 5 minutes, la fait aussi en début de passage, d'où l'heure suffisante |
| `ev_ticket_transfers` | `/api/cron/ticket-transfers` | `17 * * * *` | horaire, à la minute 17 | expiration des transferts de billets non acceptés sous 48 h (l'expéditeur est prévenu) |
| `ev_moratoriums` | `/api/cron/moratoriums` | `27 * * * *` | horaire, à la minute 27 | moratoires des réservations de salle |
| `ev_referral_commissions` | `/api/cron/referral-commissions` | `37 * * * *` | horaire, à la minute 37 | commissions de parrainage arrivées à échéance : EN ATTENTE → DISPONIBLE (le solde les rend déjà disponibles à leur date ; la tâche met le statut affiché à jour) |
| `ev_cron_history_purge` | aucune (SQL) | `30 3 * * *` | chaque nuit à 03:30 | purge de `cron.job_run_details` au-delà de 7 jours (la table grossit d'environ 1 900 lignes par jour) |

Les tâches horaires sont décalées (7, 17, 27, 37) pour éviter quatre appels simultanés. Pg_cron compte en UTC, qui est aussi l'heure de Dakar.

Changement du lot 6 : l'ancienne tâche `ev_event_change_notifications` du lot 5 n'existe plus (sa route est supprimée, les avis de changement de date ou de lieu passent par la boîte d'envoi) ; le script de planification la retire s'il la trouve.

### 7.2 Procédure sur Supabase hébergé

Les scripts sont `supabase/ops/schedule-crons.sql` (planification) et `supabase/ops/unschedule-crons.sql` (arrêt). Ce ne sont **pas** des migrations : `db push` ne les joue pas. Les deux sont transactionnels (tout ou rien) et peuvent être relancés sans effet de bord.

1. **Pré-requis** : migrations appliquées (section 3), application déployée et joignable en HTTPS, `CRON_SECRET` saisi dans l'hébergeur (5.2), redéploiement fait. Contrôle depuis le poste de l'opérateur : un appel sans en-tête à `https://<domaine>/api/cron/notifications-dispatch` doit répondre 401 (et non 503, qui signale un `CRON_SECRET` absent).
2. **Extensions** : dans **Database > Extensions**, activer `pg_cron` et `pg_net` (le script les active aussi s'il en a le droit). Vault (`supabase_vault`) est actif par défaut sur Supabase.
3. **Secrets Vault**, une seule fois, dans l'éditeur SQL (ou dans l'écran Vault du tableau de bord), en remplaçant les deux valeurs entre chevrons :

   ```sql
   select vault.create_secret('https://<domaine>', 'ev_app_url');
   select vault.create_secret('<valeur de CRON_SECRET>', 'ev_cron_secret');
   ```

   - `ev_app_url` : origine seule, en HTTPS, sans chemin (le script refuse une autre forme ; HTTP n'est admis que pour un hôte local) ; en général la même valeur que `NEXT_PUBLIC_APP_URL` ;
   - `ev_cron_secret` : exactement la valeur de `CRON_SECRET` de l'hébergeur ;
   - ne pas enregistrer cette requête comme extrait (« snippet ») de l'éditeur ; fermer l'onglet ensuite. La valeur ne doit apparaître dans aucune capture ni aucun message.
4. **Planification** : ouvrir `supabase/ops/schedule-crons.sql`, coller son contenu entier dans l'éditeur SQL, exécuter. Sans les secrets, il s'arrête avec un message explicite (par exemple « Secret Vault ev_app_url absent ») et ne change rien. Le dernier résultat affiché liste les 9 tâches, toutes actives.
5. **Vérifications** :

   ```sql
   -- 9 lignes ev_..., active = true ; aucune autre tâche ev_
   select jobname, schedule, active from cron.job order by jobname;

   -- exécutions récentes : status = succeeded signifie que la requête HTTP a été mise en file
   select j.jobname, d.status, d.return_message, d.start_time
     from cron.job_run_details d join cron.job j on j.jobid = d.jobid
    order by d.start_time desc limit 20;

   -- réponses HTTP de l'application (gardées quelques heures par pg_net)
   select id, status_code, error_msg, created from net._http_response order by created desc limit 20;
   ```

   Attendu : des réponses 200. Un 401 signifie que `ev_cron_secret` diffère de `CRON_SECRET` ; un 503, que `CRON_SECRET` manque dans l'hébergeur ; une erreur de délai ou de résolution, que `ev_app_url` est faux ou que l'application ne répond pas. Côté application, la page **Notifications** de l'administration montre les envois passés par la boîte d'envoi.
6. **Tâches manuelles plus anciennes** : si des tâches avaient été créées à la main (sans le préfixe `ev_`, par exemple à partir d'une ancienne version de ce document), les retirer : `select cron.unschedule('<nom de la tâche>');`. Le script ne touche jamais une tâche sans le préfixe `ev_`.
7. **Arrêt** (maintenance, bascule vers un autre planificateur) : exécuter `supabase/ops/unschedule-crons.sql`. Il retire toutes les tâches `ev_` et laisse les secrets Vault et les extensions ; la reprise se fait en relançant `schedule-crons.sql`. Pendant l'arrêt : aucune notification n'est envoyée (elles restent en file et partent à la reprise, sauf les rappels dont l'échéance est passée, qui ne sont pas rattrapés), aucun paiement en attente n'est réconcilié.

**Changer `CRON_SECRET`** : mettre à jour l'hébergeur (redéploiement), puis le secret Vault, sans relancer le script (les tâches relisent Vault à chaque exécution) :

```sql
select vault.update_secret((select id from vault.secrets where name = 'ev_cron_secret'), '<nouvelle valeur de CRON_SECRET>');
```

Entre les deux mises à jour, les appels reçoivent 401 et sont simplement refaits au passage suivant. De même pour un changement de domaine avec `ev_app_url`.

**Sécurité** : pg_net garde l'en-tête de chaque requête dans sa file (`net.http_request_queue`) jusqu'à son envoi, quelques secondes. Le schéma `net` ne doit jamais être ajouté aux schémas exposés par l'API (**Settings > API > Exposed schemas** : `public` et `graphql_public` seulement).

### 7.3 Autres planificateurs (si l'hébergeur en fournit un)

Un seul planificateur à la fois : arrêter pg_cron (`unschedule-crons.sql`) avant d'en activer un autre. Les routes supportent un double appel (réservation des lignes en `FOR UPDATE SKIP LOCKED`, clés d'idempotence), mais la charge serait doublée.

- **Vercel (offre payante)** : fichier `vercel.json` déclarant les 8 routes avec les expressions du tableau 7.1, et la variable `CRON_SECRET` (Vercel l'envoie dans l'en-tête `Authorization`). L'offre gratuite limite les tâches planifiées à une par jour : insuffisant, et un `vercel.json` plus fréquent y fait échouer le déploiement. C'est pourquoi le fichier n'est pas versionné. La purge `ev_cron_history_purge` est alors sans objet.
- **Planificateur externe** (cron d'un serveur, service de tâches planifiées) : requête GET ou POST vers chaque route, aux fréquences du tableau 7.1, avec l'en-tête `Authorization` portant `CRON_SECRET`, stocké dans le coffre de secrets du planificateur (jamais dans une ligne de commande visible ni dans un fichier versionné).

## 8. Bootstrap du premier SUPERADMIN

Le rôle SUPERADMIN n'est **plus** attribué par l'inscription (l'ancien trigger le donnait à quiconque déclarait le téléphone 773780756, y compris en métadonnée). Procédure :

1. La personne désignée crée son compte par l'inscription normale de l'application (email et téléphone réels), puis vérifie son téléphone.
2. L'opérateur, sur son poste, avec les variables du projet de **production** chargées dans le shell :

   ```bash
   npx tsx scripts/bootstrap-superadmin.ts --phone +221XXXXXXXXX --operator "Prénom Nom de l'opérateur"
   ```

   Le script refuse si un SUPERADMIN existe déjà, attribue le rôle dans `user_roles`, met à jour le profil et journalise l'opération (`audit_logs`, action `SUPERADMIN_BOOTSTRAP`).
3. Les administrateurs suivants sont créés depuis l'administration (`/api/admin/users`), qui attribue désormais le rôle explicitement.
4. Vérifier : la personne se reconnecte et accède à `/admin` ; `03-verification.sql` reste entièrement `OK`.

## 9. Recette avant ouverture

- `03-verification.sql` : tout `OK`.
- `supabase/hotfix/2026-10-31-lot1a/04-smoke-test.md` contre le projet de production : résultats « attendu après ».
- Tâches planifiées : les 9 tâches actives, réponses 200 dans `net._http_response` (7.2, étape 5).
- Parcours manuels : inscription client avec OTP, inscription partenaire puis validation par l'administration, création d'un événement, achat d'un billet en paiement réel de faible montant (SMS de confirmation et notification dans la cloche dans la minute), scan par un contrôleur ; si les clés VAPID sont posées, activation du push et bouton d'essai.
- Surveillance : journaux de l'hébergeur, **Logs > API** de Supabase et page **Notifications** de l'administration (SMS à l'issue incertaine, échecs) pendant les premiers jours.

## 10. Points ouverts d'exploitation

- Hébergeur de l'application à choisir ; la planification par la base (section 7) ne dépend pas de ce choix.
- Plafond SMS à relever avec le client avant l'ouverture des ventes (5.5).
- SMS à l'issue incertaine (délai MTarget dépassé) : jamais renvoyés automatiquement ; leur vérification se fait auprès de MTarget, par l'opérateur (procédure à convenir avec le fournisseur).
- Email : compte Resend du client et domaine d'envoi vérifié à configurer ; d'ici là, le canal email reste désactivé.
- Hors ligne du billet : le service worker du lot 6 ne met plus rien en cache ; le mode hors ligne est prévu au lot 7.
