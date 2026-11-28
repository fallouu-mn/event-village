# Lot « Avis » — phase 2 : avis manquants ajoutés, noms et mots techniques corrigés

Branche `avis/phase2`, partie de `main` à `f7bf7ad94` (lot 12b fusionné), le 27/11/2026. **Pas de fusion, aucune migration
appliquée.** Inventaire de départ : `docs/avis-inventaire.md` et son annexe (branche `etat/avis`, `3fa45cce4`), repris dans la
branche. Règle du 27/11 : on n'enlève aucun avis, on ajoute ce qui manque. Chaque écart a été revérifié dans le code avant
d'être corrigé (constat cité en tête de chaque migration).

[[ETAT]]

---

## À lire en premier

### Migrations (6, toutes après `20261226000003`, sans BEGIN ni COMMIT, rejouables)

| Fichier | Sous-lot | Contenu |
|---|---|---|
| `20261230000001_avis_titulaires_table.sql` | 2b | titulaires de table sans billet (A1) ; plafond de 2 SMS d'avis par heure étendu aux avis d'état |
| `20261230000002_avis_nouveaux_simples.sql` | 2c | 5 types ; déclencheurs nouveaux (retrait demandé, dossier complété, caisse validée, poste changé) |
| `20261230000003_avis_canaux.sql` | 2a | canaux ajoutés au registre ; suspension indispensable ; recopie d'`account_phone_finalize` |
| `20261230000004_avis_admins.sql` | 2d | SMS regroupé « argent à vérifier » ; produits dans le SMS des validations ; notifications des alertes |
| `20261230000005_avis_parrainage_paiement.sql` | 2f, 2g, D8 | parrainage, paiement non abouti, avis avant l'anonymisation (types) |
| `20261230000006_avis_mots.sql` | 2h | message de la garde de simulation (M17) |

### Recopies (11 fonctions, chacune UNE fois, depuis sa dernière définition, ajouts seuls)

Test : `tests/schema/migration-avis2-rejouable.test.ts` (fichier et lignes cités, chaque ligne de la dernière définition
retrouvée dans la recopie, une seule ligne remplacée déclarée, droits).

| Fonction | Dernière définition recopiée | Pourquoi une recopie |
|---|---|---|
| `event_notice_recipient_count` | `20261119000006_f2b_cadence_avis.sql:30-61` | compter les titulaires sans billet (aperçu « Prévenir ») |
| `event_change_notify` | `20261121000006_cvf2b_plafond_heure_glissante.sql:17-325` | titulaires sans billet ; plafond commun aux avis d'état |
| `notif_event_status_changed` | `20261109000009_lot9bis_messages.sql:106-374` | suspension, reprise, clôture aux titulaires ; plafond |
| `notification_outbox_claim` | `20261125000006_f4_evenement_proche.sql:46-457` | ne plus sauter (NO_VALID_TICKET) le report adressé au titulaire d'une table active |
| `account_phone_finalize` | `20261120000006_f3d_cv_numero_profil.sql:8-135` | seul émetteur qui impose ses canaux (B2 : cloche et notification) |
| `notif_admin_review_sms` | `20261126000004_l10b_cv_correctifs.sql:317-421` | sorte PRODUCT_REVIEW comptée (B8) |
| `private.order_product_review_notify` | `20261224000001_l12c_verification.sql:441-467` | produit dans le SMS regroupé (B8) |
| `private.order_review_batch_done` | `20261224000005_l12c_cv_correctifs.sql:54-75` | lot de produits dans le SMS regroupé (B8) |
| `private.order_refund_blocked_notify` | `20261224000005_l12c_cv_correctifs.sql:469-503` | SMS fondu dans « argent à vérifier » (B9) |
| `notification_daily_checks` | `20261125000003_f4_ventes.sql:382-564` | commissions de la veille et disponibles, à 9 h (D2) |
| `cashouts_simulation_guard` | `20261106000002_lot8_essai.sql:110-127` | une phrase au lieu de « SIMULATION_MISMATCH » (M17) ; **seule ligne remplacée** |

Déclencheurs nouveaux plutôt que recopies (consigne) : retrait demandé et SMS annulé si versé, dossier complété, caisse
validée, poste changé, argent à vérifier (sur la boîte d'envoi : aucune fonction d'argent recopiée, `notif_cashouts_notify`
garde ses 9 définitions), filleul inscrit, paiement non abouti. Jamais recopiées : `order_courier_action`,
`order_courier_remove` (12d), `notif_cashouts_notify`, `notif_enqueue`, `notif_event_soon`, `withdrawal_request`,
`finance_setting_set` (contrôle du test). Droits : 15 fonctions nouvelles, toutes dans `private`, fermées à tous les rôles de
l'API ; fonctions publiques recopiées : droits inchangés (rôle de service seulement). `03-verification.sql` : [[V03]].

### Tests existants modifiés (avant → après), aucun affaibli

Aucune assertion de `tests/audit/` ni de `tests/audit-auth/` n'a été changée.

| Suite | Avant | Après | Raison |
|---|---|---|---|
| `notif-modeles` | tables G2 et textes exacts du 26/11 | + 11 types nouveaux ; canaux ajoutés à 25 types ; `EVENT_SUSPENDED_HOLDER` indispensable ; textes exacts des SMS nouveaux ; variantes de pire cas (paiement non abouti, argent à vérifier, produits) ; « Fatou S. », « Aminata F. » | règle du 27/11, D3 |
| `notif-outbox` | table G2 | mêmes ajouts | idem |
| `email-regle-envoi` | G.49 : 5 exclusions ; suspension coupée par EVENT_UPDATES/EMAIL | + 9 exclusions (petites étapes, SMS regroupé, paiement non abouti sans email D1) ; G.50 : exception `NEW_ORDER` (notification sans email toutes les 15 min) ; même contrôle de préférence sur la **reprise**, et la suspension part malgré la préférence coupée | D1, D5, B13, B14 |
| `notif-preferences` | « Suspension et reprise d'un événement » ; « Notifications push » | « Reprise d'un événement » ; « Notifications du téléphone » ; + « Suspension d'un événement » aux indispensables | B13, M3 |
| `notif-abonnement` | PAYMENT_SUCCESS : EMAIL, IN_APP, PUSH | + SMS ; **ajout** : un seul SMS par abonnement | B5 |
| `l12c-cv-correctifs` (P6) | ligne SMS ADMIN_ORDER_REFUND_BLOCKED présente | inchangé ; **ajout** : ligne sautée GROUPED_ADMIN_SMS, un SMS regroupé en attente qui la compte | B9 |
| `f4-textes`, `notif-pros` | « caisse de Fatou Sow », « Ibrahima Controleur » | « Fatou S. », « Ibrahima C. » | C1, D3 |
| `notif-admin` | canal « Notification push » | « Notification du téléphone » | M16 |
| `messages-sms-9bis` | « Push accepté par le service, SMS non envoyé (affichage non garanti) » | « Notification du téléphone acceptée par le service, … » | M16 |
| `legacy-exports-partenaire` | canal `EN_LIGNE`, statut `VALIDE` | « En ligne », « Valable » | M2 |
| `essai-simule` | message `SIMULATION_MISMATCH` | « L'envoi ne correspond pas au mode du paiement : … » (code EV403 inchangé) | M17 |
| `f5-liens-avis` | 32 raisons « sans objet » | + 3 (dossier complété, caisse validée, poste changé : pages du compte et du scanner) | 2c |
| `design1b-mots` | blocs a à d | **+ bloc e** (extension § 4.4, aucun bloc retiré) | 2h |

### Exceptions du garde-fou (bloc e, chacune justifiée dans le test)

Prestataires permis partout : SamirPay (D6), Wave, Orange Money. Fichiers d'exploitation : `lib/env.ts`,
`lib/integrations/real-mode.ts`, `lib/push/config.ts`, `app/api/auth/sms-hook/route.ts`, routes `app/api/dev/**`, et le
catalogue (relu rendu au bloc a). Textes : `EMAIL_CHANNEL_DISABLED`, `RESEND_API_KEY_MISSING` (codes internes d'adaptateurs,
jamais affichés) ; « Configuration MTarget incomplète sur le serveur. » (message d'exploitation) ; l'erreur JSON de PostgREST de
`securite.db_pre_request` (format imposé ; texte lu : « Votre session est fermée. Reconnectez-vous. ») ; `OUT_OF_STOCK`,
`NO_PORTIONS_LEFT` (`order_create`) et `ORDER_PRICE_CHANGED` (`order_create_checked`, `order_payment_start`) : codes internes
d'exceptions attrapées dans la même fonction (le message sert de code de la réponse, qui porte une phrase française).
Règle des erreurs affichées : une erreur d'API identifiée par son code (`error.code === …` ou `instanceof ApiError`) affiche la
phrase française de la route.

### Points à décider ou à savoir

1. **M17 partiel** : `OUT_OF_STOCK` et `NO_PORTIONS_LEFT` restent dans `order_create` (cœur des commandes, 12a) : changer ce
   texte oblige à réécrire la gestion de l'erreur (le texte y sert de code). Rien n'arrive à l'écran. À valider, ou à faire
   avec le 12d.
2. **`verify.yml`** : ajout de `avis/**` aux branches qui déclenchent la vérification (sinon aucun run pour cette branche).
3. **B6** : le SMS d'invitation d'un livreur mène à `/courier/invitations` : la page arrive avec le 12d (le lien de la cloche,
   `/courier/invitations/<id>`, était déjà dans ce cas).
4. **C3** : refus au démarrage seulement en production ; un essai local par tunnel (`EV_DEV_TUNNEL_URL` posée) reste permis.
5. **C1** : « prénom et initiale » = premier mot et initiale du dernier mot du nom enregistré (« Fatou Sow » → « Fatou S. ») ;
   les données de l'avis gardent le nom (jamais affiché) ; les deux avis entre administrateurs gardent le nom complet
   (exception D3).
6. **Plafond de 2 SMS par heure** : il compte maintenant ensemble le report, la suspension, la reprise et la clôture (avant :
   les changements seuls). Une suite « suspension, reprise, nouvelle suspension » dans l'heure ne donne plus que 2 SMS.
7. **Paiement non abouti** : déclenché par l'échec ou l'expiration d'un paiement de la plateforme (pas par une annulation par
   la personne), dû 10 minutes plus tard (laisse le temps de réessayer), annulé si un paiement du même panier réussit.
8. **D8** : l'avis part par l'envoyeur tout de suite, avant l'effacement ; s'il échoue, l'anonymisation continue (décision de
   l'équipe) et l'échec est journalisé ; une reprise vise encore l'ancien numéro (écrit dans la ligne).

---

## 1. Avis ajoutés (11 types nouveaux)

Textes rendus par le catalogue (`lib/notifications/catalog.ts`) ; SMS mesurés au pire cas par
`tests/parcours/avis2-sms-pire-cas.test.ts` (titre et noms de 110 caractères, 9 999 999 F, adresse de 27 caractères). Email :
sujet « {titre} — Event Village », texte de la cloche, bouton « Ouvrir Event Village » (adresse vérifiée seulement).

| Écart | Type | Qui le reçoit, quand | Canaux | Nuit | Cloche (titre — texte) | SMS au pire cas |
|---|---|---|---|---|---|---|
| A1 | (types existants `EVENT_CHANGED`, `EVENT_SUSPENDED_HOLDER`, `EVENT_REACTIVATED_HOLDER`, `EVENT_CLOSED_HOLDER`) | **titulaire d'une table active qui n'a plus de billet** : report, suspension, reprise, clôture ; une fois par compte ; lien « Ma table » | comme les détenteurs | comme les détenteurs | textes inchangés | textes inchangés |
| A2 | `WITHDRAWAL_REQUESTED` | titulaire du compte, à la demande de retrait (organisatrice ou parrain) ; SMS dû 2 minutes plus tard, annulé si le retrait est déjà versé | cloche, notification, email, SMS | part la nuit | **Demande de retrait enregistrée** — « Votre demande de retrait de 25 000 F CFA vers Wave est enregistrée. Vous serez prévenu dès qu'elle sera versée. Si ce n'est pas vous, ouvrez la page Aide tout de suite. » | `Event Village : demande de retrait de 9 999 999 F CFA vers Orange Money enregistrée. Pas vous ? Ouvrez l'aide : https://app.eventvillage.sn/aide` (144) |
| A5 | `PARTNER_RESUBMITTED_ACK` | partenaire, à l'envoi du dossier complété après un refus | cloche, notification | reporté | **Dossier envoyé** — « Votre dossier complété est envoyé à l'équipe Event Village. Vous recevrez la réponse ici et par SMS. » | — |
| A8 | `SHIFT_DISCREPANCY_VALIDATED` | contrôleur, quand l'écart de sa caisse est validé | cloche, notification | reporté | **Caisse validée** — « L'organisateur a validé votre caisse de « Gala de la Teranga ». » (« L'équipe Event Village… » si un administrateur valide) | — |
| A9 | `CONTROLLER_POST_CHANGED` | contrôleur, porte ou droit d'encaisser changés par l'organisatrice (un avis par enregistrement, jamais pour sa propre porte choisie au scanner) | cloche, notification | reporté, sauf événement à moins de 12 h | **Votre poste a changé** — « Pour « Gala de la Teranga » : votre porte est maintenant « Porte Nord » ; vous pouvez maintenant encaisser en espèces. » | — |
| A10 | `ACCOUNT_WELCOME` | nouveau compte, après l'inscription par code (route d'inscription seulement) | cloche, notification | reporté | **Bienvenue sur Event Village** — « Votre compte est prêt. Retrouvez vos billets, réservations et commandes ici. » | — |
| B9 | `ADMIN_MONEY_SMS` | administrateurs qui reçoivent les alertes d'argent ; un SMS par heure au plus, parties à zéro retirées | SMS | reporté | — (les alertes ont déjà leur cloche) | `Event Village : argent à vérifier : 999 versements à reprendre, 999 incertains, 999 doubles paiements, 999 créances. https://app.eventvillage.sn/admin/finance` (158) |
| A3 (D2) | `REFERRAL_SIGNUP` | parrain, quand une personne s'inscrit avec son code (jamais son nom ni son numéro) | cloche, notification | reporté | **Nouveau filleul** — « Une personne s'est inscrite avec votre code de parrainage. Vous gagnerez une commission sur ses achats. » | — |
| A3 (D2) | `REFERRAL_EARNED` | parrain, à 9 h, commissions gagnées la veille (une fois par jour) | cloche, notification | reporté | **Commissions de la veille** — « Hier, vous avez gagné 3 commissions, 4 500 F CFA en tout. Elles seront disponibles dans 7 jours. » | — |
| A3 (D2) | `REFERRAL_AVAILABLE` | parrain, à 9 h, commissions devenues disponibles (une fois par jour) | cloche, notification, email, SMS | reporté | **Commissions disponibles** — « 4 500 F CFA de commissions de parrainage peuvent maintenant être retirés. » | `Event Village : 9 999 999 F CFA de commissions de parrainage sont disponibles. Retirez-les : https://app.eventvillage.sn/wallet` (127) |
| A4 (D1) | `PAYMENT_NOT_COMPLETED` | acheteur, paiement échoué ou expiré ; une fois par panier ; jamais si un paiement du panier a réussi ; dû 10 minutes plus tard | cloche, notification, SMS (sans email) | reporté | **Paiement non abouti** — « Le paiement pour « Gala de la Teranga » n'a pas abouti. Rien n'a été débité et les places ne sont plus réservées. Vous pouvez réessayer. » (variantes : commande, salle, table, abonnement) | `Event Village : paiement non abouti pour Grande soirée " Ndekk " - l... Rien n'a été débité. Réessayez : https://app.eventvillage.sn/tickets` (140 ; commande, salle, table, abonnement : 140 à 149) |
| D8 | `ACCOUNT_ANONYMIZATION_NOTICE` | personne dont le compte est anonymisé par l'équipe, juste avant l'effacement | SMS, email | part la nuit | — (email : **Votre compte est supprimé** — « L'équipe Event Village supprime votre compte : votre nom, votre numéro et votre adresse vont être effacés. Les paiements passés restent dans les registres comptables, sans votre nom. Pour toute question, ouvrez la page Aide. ») | `Event Village : votre compte est supprimé par l'équipe, vos informations personnelles sont effacées. Une question : https://app.eventvillage.sn/aide` (148) |

Aucun avis enlevé. `ADMIN_ORDER_REFUND_BLOCKED` garde sa ligne SMS, écrite sautée (« Compté dans le SMS regroupé « argent à
vérifier » ») : le remboursement bloqué d'une commande est compté dans le SMS regroupé par son alerte de cloche, jamais deux SMS.

## 2. Canaux ajoutés à des avis existants

| Écart | Type | Canal ajouté | Texte ajouté (SMS au pire cas mesuré) |
|---|---|---|---|
| B1 | `TRANSFER_RECEIVED` (billet reçu) | SMS (part la nuit) | `Event Village : le billet Grande soirée " Ndekk " - l... est dans vos billets, avec un nouveau numéro. https://app.eventvillage.sn/tickets` (138) |
| B2 | `PHONE_CHANGED` (numéro changé) | cloche et notification au compte | cloche **Numéro de téléphone modifié** (texte déjà écrit, fond de l'email) |
| B3 | `EMAIL_ADDED` (adresse ajoutée) | cloche et notification | **Adresse email ajoutée** (texte déjà écrit) |
| B4 | `ACCOUNT_LOGIN_FAILURES` (10 échecs) | cloche et notification | **Essais de connexion échoués** (texte déjà écrit) |
| B5 | `PAYMENT_SUCCESS` (abonnement payé) | SMS ; un seul SMS par abonnement (`SUBSCRIPTION_ACTIVATED` n'en a pas) | `Event Village : paiement de 9 999 999 F CFA confirmé pour votre abonnement. Merci. https://app.eventvillage.sn/partner/subscription` (131 ; « confirmé » et non « reçu » : le « ç » ferait deux SMS) |
| B6 | `ORDER_COURIER_INVITED` (livreur invité) | SMS (reporté la nuit) | `Event Village : Grande soirée " Ndekk " - la nuit des... vous invite à livrer ses commandes. Répondez : https://app.eventvillage.sn/courier/invitations` (151) |
| B8 | `ADMIN_PRODUCT_REVIEW`, `ADMIN_PRODUCTS_REVIEW_BATCH` | notification ; SMS regroupé des validations (`ADMIN_REVIEW_SMS`, au plus un toutes les 30 min) | `Event Village : 999 produit(s) attendent votre validation : https://app.eventvillage.sn/admin/dashboard` (103 ; avec les autres rubriques, total seul au-delà d'un SMS) |
| B9 | `ADMIN_WITHDRAWAL_REJECTED`, `ADMIN_FINANCE_DEBT` | notification ; SMS regroupé « argent à vérifier » (avec `ADMIN_REFUND_TO_RETRY`, `ADMIN_CASHOUT_TO_RESUME`, `ADMIN_CASHOUT_UNCERTAIN`, `ADMIN_DUPLICATE_PAYMENT`) | voir `ADMIN_MONEY_SMS` |
| B10 | `ADMIN_SMS_CAP_GLOBAL`, `_NON_OTP`, `_NEW_NUMBERS` | notification seulement (D4 : jamais de SMS) | — |
| B11 | `ADMIN_EVENT_PUBLISHED`, `_WITHDRAWN`, `_CHANGED`, `_CANCELLED`, `ADMIN_NOTIFICATION_FAILED`, `ADMIN_SMS_DAILY_THRESHOLD`, `ADMIN_SMS_OPTIONAL_80`, `ADMIN_SMS_FORECAST` | notification, reportée la nuit | — |
| B12 | `SUPERADMIN_PROMOTED`, `ADMIN_PHONE_CONFIRMED` ; `ADMIN_BACKUP_CODE_USED` | notification ; cloche et notification | cloche **Code de secours utilisé** (texte déjà écrit) |
| B13 | `EVENT_SUSPENDED_HOLDER` | devient indispensable (plus de préférence), reporté la nuit sauf événement à moins de 12 h ; la page des préférences dit « Reprise d'un événement » et liste « Suspension d'un événement » parmi les messages toujours envoyés ; rappels de table toujours désactivables (D5) | — |
| B14 | `NEW_ORDER` (ventes groupées) | notification, même regroupement de 15 minutes, toujours désactivable, sans email | — |

25 types ont un canal de plus. B15 (règle « commande à moins de 12 h » de la nuit) : sans objet, aucun avis de commande en
cours n'est reporté la nuit.

## 3. Noms et mots corrigés

| N° | Où | Avant | Après |
|---|---|---|---|
| C1 (D3) | `SHIFT_DISCREPANCY`, `CONTROLLER_INVITATION_ACCEPTED`, `CONTROLLER_BECAME_ADMIN` | « La caisse de Fatou Sow… », « Aminata Fall a accepté… » | « Fatou S. », « Aminata F. » (`personShortName`) ; entre administrateurs : nom complet gardé |
| C3 | démarrage (`instrumentation.ts`, `lib/notifications/app-url-guard.ts`) | aucune garde | en production, refus si `NEXT_PUBLIC_APP_URL` dépasse 27 caractères : « [démarrage] Refus de démarrer : l'adresse de l'application (NEXT_PUBLIC_APP_URL) fait N caractères, 27 au plus. Chaque SMS contient ce lien : plus long, certains SMS partiraient en deux messages (facturés deux fois). Choisissez un domaine court… » |
| M1 | carte des notifications du téléphone | message anglais du navigateur | « L'activation n'a pas marché sur ce navigateur. Vérifiez que les notifications sont autorisées, puis réessayez. » |
| M2 | export comptable des organisatrices | `EN_LIGNE`, `ESPECES`, `INVITATION`, `VALIDE`…, identifiant technique | « En ligne », « Espèces », « Invitation », libellé du statut (« Valable »…), « — » sans numéro |
| M3 | préférences, carte, essai, abonnement de l'appareil, catalogue | « Notifications push », « notification push d'essai » | « Notifications du téléphone », « notification d'essai » |
| M4 | `verify-otp` | « Numéro de téléphone et code OTP requis. » | « Entrez votre numéro et le code reçu par SMS. » |
| M5 | scan | « Scan invalide : eventId et payload (…) requis. » | « Scan illisible. Scannez de nouveau ou tapez le numéro du billet. » |
| M6 | 6 routes | « ID événement invalide / requis / manquant. » | « Événement introuvable. Rechargez la page. » |
| M7 | validation des paiements | « (targetId) doit être un UUID valide », « transaction_id SamirPay invalide », « (WAVE ou ORANGE_MONEY) » | « Achat introuvable. Rechargez la page. », « Paiement introuvable. », « Choisissez Wave ou Orange Money. » |
| M8 | 81 fichiers (88 messages) | « Payload JSON invalide. », « Corps JSON invalide. », « Corps de requête illisible (JSON attendu). »… (8 variantes) | « Demande illisible. Rechargez la page, puis réessayez. » |
| M9 | `useServerData`, `DoorList`, `errorMessage()` | message brut d'une erreur hors API | passé au garde-fou `humanToastMessage` (sorti dans `components/ui/human-message.ts`, réexporté par `Toast.tsx`) |
| M10 | affectations | « … est en statut PUBLIE. Seuls … (VALIDÉ ou PUBLIÉ) » | « L'événement « … » n'est pas encore validé ou en ligne : seuls les événements validés ou en ligne peuvent être affectés. » |
| M11 | schémas de validation (gardés : testés) | « Le code OTP doit comporter exactement 6 chiffres », « (WAVE ou ORANGE_MONEY) » | « Le code reçu par SMS comporte 6 chiffres. », « Choisissez Wave ou Orange Money. » |
| M12 | revue des produits (admin) | « Failed to fetch » | « Connexion impossible. Vérifiez votre réseau, puis réessayez. » |
| M13 | comptes (admin) | « Statut invalide : ACTIF ou SUSPENDU. » | « Choisissez « Actif » ou « Suspendu ». » |
| M14 | anonymisation (admin) | « ID utilisateur requis. » | « Compte introuvable. Rechargez la page. » |
| M15 | nom du type (supervision) | « Code de connexion (Supabase) » | « Code de connexion (envoyé à la connexion) » |
| M16 | supervision, envoyeur, adaptateur | « Notification push », « Charge refusée par le service push (413). », « (HTTP 413) » | « Notification du téléphone », « Message trop long pour le service des notifications du téléphone. » |
| M17 | SQL | `SIMULATION_MISMATCH` | « L'envoi ne correspond pas au mode du paiement : un versement simulé ne part jamais en réel, ni l'inverse. » ; `OUT_OF_STOCK`, `NO_PORTIONS_LEFT`, `ORDER_PRICE_CHANGED` gardés (point 1) |
| bloc e | 24 messages trouvés par le garde-fou étendu | « pageSize », « adminId », « userId requis », « partnerId et docType », « includeContacts », « confirmOpenShifts », « eventId obligatoire », « controllerId », « canAcceptCash », « applyConstraints », « targetType », « service push » | phrases simples (« Compte introuvable. Rechargez la page. », « Contrôleur introuvable. Rechargez la page. », « La lampe n'est pas disponible sur ce navigateur. »…) |

Garde-fou (`tests/schema/design1b-mots.test.ts`, bloc e) : 568 fichiers serveur, 1 724 messages ; 623 fonctions SQL (dernière
définition), 1 039 messages ; erreurs affichées ; exports : **0 faute** (exécution locale, statique).

## 4. Runs

Résultats lus par l'API GitHub et les fichiers bruts de `ci-results` (jamais par git).

| Run | Commit | Contenu | Résultat |
|---|---|---|---|
| 785 | `c8467d02b` | rapide n°1 (2b), 47 suites | 46/47 ; typecheck et lint OK ; rouge : mon test 2b.2 (heure d'envoi calculée avant la reprise) → corrigé |
| 786 | `dadddfacf` | rapide n°2 (2c), 172 suites | 170/172 ; rouges : bouton d'email imposé (« Ouvrir Event Village »), raisons « sans objet » des liens → corrigés |
| 788 | `7f77df887` | rapide n°3 (2a à 2h), 211 suites | **coupé à 60 min** (liste trop longue), aucun journal de suites |
| 791, 792 | `0aded0997`, `3134434de` | rapide n°4 en deux moitiés (106 + 107 suites), en parallèle | 59/106 et 61/107 : deux cascades d'invariants causées par mes tests (commission rendue disponible trop tôt : w18 ; numéro changé sans l'authentification : v), 2 erreurs de compilation dans mes tests, une trentaine d'attentes de canaux exacts, un défaut de B14 (notification des ventes reportée la nuit qui retenait la série) → corrigés (`d4ad50569`) |
| 795, 794 | `f2e1b05ce`, `e90c881ac` | rapide n°5 en deux moitiés | 103/106 et 106/107 ; typecheck et lint OK ; rouges : 3 attentes (nombre de lignes, SMS « billet reçu » au destinataire), un second défaut de B14 la nuit (cloche suivante décalée à 07 h 15) → corrigés (`d5604f64e`) |
| 798 | `d5604f64e` | rapide ciblé, 15 suites (regroupements, attentes corrigées) | **15/15 vert**, typecheck et lint OK |
| [[RUN_COMPLET]] | | run complet unique | [[RESULTAT_COMPLET]] |

Les moitiés B sont parties sur des branches jumelles (`avis/phase2-b`, puis `avis/phase2-c`) pour tourner en même temps que
les moitiés A sans s'annuler (la vérification annule le run en cours d'une même branche) ; elles sont à supprimer.

## 5. Poids et mesure mobile

[[POIDS]]

## 6. Essais pour un non-développeur

À faire sur un serveur d'essai avec les migrations appliquées (comptes de test, téléphone qui reçoit les SMS, notifications
du téléphone activées dans « Profil › Notifications »). Entre 1 h et 7 h (heure de Dakar), les avis marqués « reporté » partent à
7 h ; les autres partent tout de suite.

1. **Table d'un événement** : achetez une table, envoyez toutes ses places à d'autres numéros, puis faites reporter
   l'événement de plus de 24 h par l'organisatrice. Le titulaire reçoit un SMS « … reporté au … Remboursement total possible … »,
   une cloche et une notification qui ouvrent « Ma table ». Suspendre puis reprendre l'événement : un avis chacun. Une troisième
   bascule dans la même heure : cloche seulement, pas de troisième SMS.
2. **Retrait** : demandez un retrait. Tout de suite : cloche « Demande de retrait enregistrée » et notification ; 2 minutes plus
   tard, un SMS « … Pas vous ? Ouvrez l'aide … ». Si le retrait est versé avant 2 minutes : seul le SMS « votre retrait … a été
   versé » arrive.
3. **Dossier complété** (partenaire refusée qui renvoie son dossier) : cloche « Dossier envoyé ».
4. **Contrôleur** : l'organisatrice change sa porte ou lui donne le droit d'encaisser : cloche « Votre poste a changé ». Le
   contrôleur qui choisit lui-même sa porte au scanner ne reçoit rien. Écart de caisse validé : cloche « Caisse validée ».
5. **Inscription** : créez un compte avec le code reçu par SMS : cloche « Bienvenue sur Event Village ».
6. **Billet reçu** : acceptez un billet transféré : en plus de la cloche, un SMS « le billet … est dans vos billets ».
7. **Abonnement** : payez un abonnement : un seul SMS « paiement de … confirmé pour votre abonnement ».
8. **Numéro, adresse, connexions** : changer son numéro, ajouter une adresse, ou 10 mots de passe faux : en plus du SMS et de
   l'email, une cloche et une notification.
9. **Suspension** : coupez « Reprise d'un événement » dans les préférences, puis faites suspendre un événement dont vous avez
   un billet : l'avis de suspension arrive quand même ; celui de la reprise, non.
10. **Paiement non abouti** : lancez un achat et laissez le paiement échouer : 10 minutes plus tard, SMS « paiement non abouti
    … Rien n'a été débité », cloche et notification. Un second échec du même panier ne renvoie rien ; si vous payez le même
    panier dans les 10 minutes, rien n'arrive.
11. **Parrainage** : un filleul s'inscrit avec votre code : cloche « Nouveau filleul ». Le lendemain à 9 h : « Commissions de la
    veille » ; le jour où elles deviennent disponibles, à 9 h : SMS « … de commissions de parrainage sont disponibles ».
12. **Administrateurs** : plusieurs alertes d'argent en moins d'une heure : un seul SMS « argent à vérifier : … », au plus un
    par heure. Un produit à vérifier : il entre dans le SMS « … attendent votre validation ». Un plafond de SMS atteint :
    notification, jamais de SMS.
13. **Anonymisation** : un super-administrateur anonymise un compte de test : juste avant, ce compte reçoit un SMS « votre
    compte est supprimé par l'équipe… » et un email (adresse vérifiée).
14. **Noms** : un écart de caisse affiche « La caisse de Fatou S. » à l'organisatrice ; l'export comptable montre « En ligne » et
    « Valable » au lieu des codes.
