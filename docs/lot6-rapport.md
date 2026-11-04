# LOT 6 — RAPPORT

**Objet :** notifications sur tous les canaux et rappels avant l'événement. Le lot couvre :
- la dette du lot 5 (temps réel d'un compte suspendu, suppression d'un événement, annulation et transferts, tables publiées, connexion, avertissements des captures, détails d'écran) ;
- une boîte d'envoi transactionnelle unique et un seul envoyeur, avec relances, reprise et issue incertaine ;
- les canaux IN_APP, SMS, EMAIL (facultatif) et PUSH web (facultatif, VAPID) ;
- un catalogue unique des modèles, les préférences de l'utilisateur, les rappels J-1 et H-3 ;
- les notifications des partenaires, contrôleurs et admins, la migration de tous les envois existants ;
- la supervision admin, la planification indépendante de l'hébergeur, la cloche et le centre de notifications ;
- les invariants (m)(n)(o), les captures et la fumée prolongée.

Points ouverts du lot 5 traités : 2 (connexion migrée, fichiers `loading.tsx`, détails de la section 3), 5 (compte suspendu en temps réel, tables publiées, compteur de la cloche), 6 (suppression d'un événement par le service_role), 8 (révocation des transferts à l'annulation de nouveau couverte, avis d'expiration d'un transfert).

**Branche :** `lot6/notifications`, créée depuis `main` (`fff03b1`). Rien n'a été exécuté contre un projet Supabase distant. Migrations du dépôt uniquement (`20261103000001` à `…08`), appliquées et testées en CI depuis une base vide. Les scripts `supabase/ops/*.sql` ne sont pas des migrations.

**Date :** 4 novembre 2026.

**Résultat :** **vert.** Run 67 (`41743807069`, commit `3a246ad`) :
- `npm run verify` : 152 suites sur 152, 1 728 sous-tests, aucun échec ni test ignoré. Typecheck, lint et build compris.
- `npm run e2e` :
  - 7 connexions par le formulaire ;
  - 172 captures (43 écrans, en 390 × 844 et 1440 × 900, en clair et en sombre), sans aucun contrôle bloquant ;
  - la fumée complète : les 6 étapes du lot 5, puis second événement acheté, rappels J-1 et H-3 par horloge simulée, annulation (rappels annulés, avis envoyé).

Après le run 67, un seul changement de code : `43ff9ec` (le total des SMS du mois de la page admin vient du serveur, section 3). Le commit de ce rapport le contient ; `main` n'est avancé qu'après un run entièrement vert sur ce commit.

Au run 60 (référence « avant »), 29 suites étaient en échec : les 27 nouvelles suites du lot, plus `r3-fonctions-rpc` et `design-systeme`, modifiées en phase rouge. Les invariants (a) à (o) donnent 0 violation à la fin de chacune des 24 suites du lot qui les vérifient (toutes sauf `r20`, `r21` et `r22`, limitées à la clé anon), et à la fin du seed de démonstration.

---

## À lire en premier

1. **`main` sera avancé par moi, contrairement à la consigne écrite.** La consigne du lot dit « Tu ne pousses JAMAIS sur main ». Le 02/11/2026, après le lancement du lot, l'utilisateur a écrit : « donc apres aussi pousse le sur le main ». J'applique cette exception à la fin du lot seulement : après le commit de ce rapport et un run vert sur ce commit, `main` est avancé en avance rapide depuis `lot6/notifications`. Au moment où ce rapport est écrit, `origin/main` est encore sur `fff03b1`.
2. **Défauts réels trouvés pendant le lot, hors de la consigne, corrigés et testés :**
   - **Période d'essai des partenaires jamais enregistrée.** `activate_partner_trial` (migration `0008`) écrivait `partners.status = 'ACTIF'`, valeur absente de l'énumération `partner_status` : toute première activation échouait (22P02). Le repli JavaScript de `app/api/partner/activation/route.ts` écrivait la même valeur sans lire l'erreur, puis répondait succès avec des dates jamais enregistrées. Preuve rouge : `notif-pros`, run 60, « activation : invalid input value for enum partner_status: "ACTIF" ». Corrigé par `3930d11` (repli supprimé).
   - **Page `/notifications` en chargement sans fin** quand un rechargement temps réel tombait pendant le premier chargement et échouait (capture du run 66). Corrigé par `c77cd05`.
   - **Inscription push restée ouverte dans Chromium** : le client ne lisait pas le corps de la réponse 200 (capture du run 65). Corrigé par `6279f2f`.
   - **Repérés sans être corrigés** (points ouverts, section 12) : `lib/admin/admin.service.ts:417` supprime les permissions d'un compte par une colonne `admin_id` qui n'existe pas (la colonne est `user_id`) ; `verifyAdminAuth` ne refuse pas un compte SUPPRIME.
3. **Contrats d'API modifiés ou nouveaux** (le contrat complet est dans le code des routes) :
   - **Transfert de billet** (décisions de l'utilisateur, section 11) :
     - `POST /api/tickets/[id]/transfer` n'accepte qu'un numéro : un email donne 400 `RECIPIENT_PHONE_REQUIRED`. La réponse donne `transfer.transfer_id` et `recipient_notification` (`QUEUED` ou `NONE`) ; `claim_url` et `recipient_notified` disparaissent ;
     - nouvelles routes `GET /api/tickets/transfers/incoming` et `POST /api/tickets/transfers/[id]/claim`. Le destinataire doit avoir un numéro vérifié (`users.phone_verified_at`, posé par une vérification OTP réussie) ;
     - l'ancienne `POST /api/tickets/claim/[token]` répond 410 `CLAIM_LINK_RETIRED` sans lire la base ; la page `/tickets/claim/[token]` redirige vers `/tickets?tab=recus`.
   - **Guichet :** `POST /api/controller/counter-sale` répond `receipt_queued` et `receipt_refusal` au lieu de `receipt_sent`.
   - **Cloche :** `GET /api/notifications` renvoie `total`, `page`, `pageSize`, `actionUrl` et `unreadCount` sur le même ensemble, sans `channel` ; `PATCH` renvoie `updated` ; `PATCH /api/notifications/[id]/read` répond 404 pour la notification d'un autre compte.
   - **Suppression d'un événement :** `DELETE /api/partner/events/[id]` répond 409 `EVENT_NOT_DELETABLE` hors brouillon neuf (refus par trigger en base, y compris pour le service_role).
   - **Statut d'un partenaire :** RPC `partner_status_set` (statuts du partenaire et du compte synchronisés, sessions révoquées). Cible VALIDE, REJETE ou SUSPENDU ; même statut → 409 `TRANSITION_NOT_ALLOWED`. La route exige `partners.suspend` pour une suspension, `partners.validate` sinon.
   - **Campagnes admin :** `POST /api/admin/communications` enregistre un brouillon et répond `sendingDisabled: true` ; plus aucun envoi.
   - **Nouvelles routes :** `/api/cron/notifications-dispatch`, `/api/cron/reminders`, `/api/push/config`, `/api/push/subscriptions`, `/api/notifications/preferences`, `/api/notifications/essai-push`, `/api/admin/notifications`, `/api/admin/notifications/[id]`, `/api/admin/notifications/[id]/retry`, `/api/admin/notifications/stats`.
   - **Supprimée :** `/api/cron/event-change-notifications` (file du lot 5 absorbée par la boîte d'envoi).
4. **Exploitation** (`docs/deploiement-projet-neuf.md`, mis à jour) :
   - toutes les tâches planifiées passent par `supabase/ops/schedule-crons.sql` (pg_cron et pg_net, URL et `CRON_SECRET` lus dans Vault : secrets `ev_app_url` et `ev_cron_secret`). Ce n'est pas une migration : l'opérateur le lance une fois. Neuf tâches, dont l'envoyeur chaque minute et les rappels toutes les 5 minutes ;
   - **`CRON_SECRET` devient indispensable en exploitation** : sans lui, toutes les routes `/api/cron/*` répondent 503, donc aucune notification ne part, sauf l'OTP et l'invitation d'un contrôleur ;
   - nouvelles variables, toutes facultatives : `VAPID_*`, `MTARGET_TIMEOUT_MS`, `PUSH_*` (liste complète en section 9) ;
   - 9 réglages SUPERADMIN `notif.*` historisés (section 2, tâche 6.5) ;
   - permissions `notifications.read` et `notifications.write` à attribuer aux admins qui supervisent les envois.
5. **Coût des SMS** (section 10) : avec les réglages par défaut, une commande d'un billet coûte 3 SMS si le porteur n'a pas le push, 2 s'il l'a. Avec le plafond actuel (1 000 SMS par jour, dont 700 hors OTP), l'alerte admin à 2 000 SMS par jour ne peut pas se déclencher.
6. **Tests existants modifiés :** liste complète en section 1, avec la raison de chaque changement. Aucune assertion de fond n'est retirée, sauf l'assertion « cron sans secret refusé » de `edition-formulaire`, supprimée avec la route qu'elle visait. Un motif de contrôle statique de `notif-canaux` a été resserré (section 1, B).
7. **Les tests n'ont tourné qu'en CI.** Le poste n'a pas Docker : les agents correcteurs n'ont exécuté que `tsc`, le lint et les cas sans base. Toute affirmation « vert » de ce rapport vient des runs CI cités, dont les journaux bruts sont sur la branche `ci-results`.
8. **Découpage des commits.** Comme aux lots précédents : tests rouges par tâche, puis correctifs par tâche, puis écrans, puis e2e. Les commits intermédiaires ne compilent pas tous isolément (`0724381` importe `lib/notifications/catalog.ts`, créé par `1e14575`) ; seule la tête est vérifiée par la CI. Le renommage de la route d'essai (`test-push` → `essai-push`) est parti dans `b5de823` (écrans 6.0) au lieu du commit 6.4.

---

## 1. Commits

| Commit | Message |
|---|---|
| ab07e3a | docs(deploiement): subscription_plans n'est pas rempli par les migrations (seed.sql seulement, formules à valider avec le client) ; fournisseur téléphone de Supabase désactivé, l'application envoie ses SMS par MTarget ; relevé des données de référence du projet de production après db push |
| 223d3fd | ci(6.0): la vérification se déclenche aussi sur les branches lot\*/\*\* (la branche lot6/notifications n'aurait lancé aucun run : seuls main et fix/\*\* étaient couverts) |
| f610ba3 | test(infra)[6]: aides du lot 6 (horloge simulée de Dakar, planification et envoi par now, lecture de la boîte d'envoi, réglages notif.\* historisés, VAPID et abonnement de navigateur factices, téléphone vérifié, admins par permission), faux SMS (issue incertaine, refus), email (texte, en-têtes) et push enregistrant le contenu exact, invariants (m)(n)(o) avec contrôle du schéma, refus de VAPID_PRIVATE_KEY dans l'environnement de test ; r3 : RPC du lot ajoutées et exigées réservées au service_role, event_notify et event_change_notifications_\* retirées |
| 3f0f68f | test(6.0)[rouge]: partenaire, admin et contrôleur suspendus ne reçoivent plus le temps réel (réactivé : de nouveau), suppression d'un événement hors brouillon refusée en base même par le service_role (TRUNCATE aussi, route 409), écritures REST sur events refusées à l'ADMIN (r20), annulation : transferts PENDING annulés et billets déverrouillés dans la transaction de event_cancel (couverture et garde-fou), hall_reservations et table_reservations hors publication, orders sans diffusion à un tiers |
| fccada6 | test(6.1)[rouge]: boîte d'envoi (schéma, registre des types, clé d'idempotence unique, aucun secret, garde des statuts, non publiée, mise en file SKIPPED avec motif), envoyeur unique (réservation concurrente, relances 1/5/15/60 min, 5 tentatives puis FAILED et signal admin, reprise des SENDING, SMS incertain jamais renvoyé, horloge passée refusée, plafond SMS, route cron), r21 : aucune lecture ni écriture REST des tables de notification |
| 79064c1 | test(6.2)[rouge]: canaux IN_APP, SMS (adaptateur MTarget avec délai maximal : incertain contre refus), EMAIL facultatif (SKIPPED, échappement, désabonnement), PUSH web (VAPID facultatives, plusieurs appareils, 404/410 supprime l'abonnement, déchiffrement réel), routes d'abonnement (liste blanche contre le SSRF, 10 appareils), service worker sans cache ni fetch |
| 5815af6 | test(6.3)[rouge]: catalogue unique des modèles égal au registre SQL, rendu de chaque canal, aucune variable manquante, SMS en un segment GSM-7 avec valeurs maximales, aucun secret ni lien de réclamation, formats de date (Dakar) et de montant partagés |
| 43c3cd7 | test(6.4)[rouge]: préférences de notification (défauts, indispensables non désactivables, SKIPPED PREFERENCE_DISABLED à l'insertion et à l'envoi, bouton d'essai et quota) |
| bb37f70 | test(6.5)[rouge]: réglages notif.\* historisés et bornés (r22 : aucune écriture REST par un ADMIN), rappels J-1 et H-3 par horloge simulée (veille 10 h, tolérance d'un quart d'heure, plages de silence, achat tardif, 5 billets : 1 rappel, double passage sans doublon, UTILISE, guichet, politiques SMS), rappel contrôleur la veille à 18 h, annulation des rappels dans la transaction de la suspension, de l'annulation, de la fin, du changement de date et du transfert |
| 8211138 | test(6.6)[rouge]: notifications des partenaires (validé, refusé, suspendu, réactivé, premier billet, catégorie épuisée, écart de caisse, retraits, remboursements d'annulation), des contrôleurs (affectation, retrait, SMS agrégé, caisse fermée par un tiers, invitation synchrone sans code journalisé) et des admins (destinataires par permission, comptes actifs, seuil SMS) |
| effce82 | test(6.7)[rouge]: transfert sans jeton vers un numéro vérifié (liste des transferts reçus, acceptation sans fuite, refus d'une cible email, ancienne route 410 sans lecture de la base), migration des envois : contrôle statique interdisant tout appel direct aux adaptateurs hors envoyeur, OTP et invitation, absorption de event_change_notifications |
| 870e1e2 | test(6.8)[rouge]: supervision admin des notifications (filtres, détail sans code OTP, Relancer pour FAILED seulement, compteurs par canal et par jour, SMS du mois, permissions notifications.read et notifications.write) |
| d9221ef | test(6.9)[rouge]: supabase/ops/schedule-crons.sql et unschedule-crons.sql (sonde des extensions, tâches exactes, secrets lus dans Vault, idempotence, arrêt) en transaction annulée, procédure de déploiement à jour |
| 4c59aad | test(6.10)[rouge]: cloche et page /notifications sur le même ensemble (compteur et liste), non lues d'abord, pagination, Tout marquer comme lu, lien interne seulement, canal IN_APP, temps réel |
| 3d75889 | test(6.11)[rouge]: garde-fous des invariants (m)(n)(o), chacun détectant une violation fabriquée en transaction annulée |
| f6b4fd3 | test(6.0,6.2-6.10)[rouge, interface]: contrôles statiques des écrans (connexion migrée aux libellés figés, sans rendu Suspense intermédiaire, préférences, Relancer conditionné, menu admin, filtres kind des abonnements, scanner, ScrollableTabs partagé, Skeleton, détachement du push à la déconnexion) et liste blanche du système de design (nouveaux fichiers, ancienne entrée ScrollableTabs retirée) |
| be40f1b | test(6.6)[rouge]: notif-pros composte le billet UTILISE par un vrai scan accepté (événement à 3 h, dans la fenêtre de scan) au lieu d'un UPDATE direct ; l'UPDATE créait un billet UTILISE sans scan, violation de l'invariant (g) du lot 4 qui faisait échouer l'after() de toutes les suites suivantes (run 59 : pilotage-\*, temps-reel-\*, partenaire-liste en échec avec 0 sous-test en échec) |
| fba4337 | fix(6.0): statut du compte dans la RLS des tables publiées (ni suspendu ni supprimé), suppression d'un événement hors brouillon et TRUNCATE refusés en base y compris pour le service_role (EV423, 409 EVENT_NOT_DELETABLE), events_admin_manage supprimée et écritures REST sur events révoquées, hall_reservations et table_reservations retirées de la publication |
| 0724381 | fix(6.1): boîte d'envoi transactionnelle notification_outbox (registre des types, clé d'idempotence unique, instantané de décision, garde des statuts, préférences et abonnements push, phone_verified_at), envoyeur unique par lots FOR UPDATE SKIP LOCKED avec relances, reprise des SENDING, SMS incertain jamais renvoyé, route /api/cron/notifications-dispatch, adaptateur MTarget avec délai maximal, OTP synchrone journalisé sans code |
| 359d860 | fix(6.2): canaux IN_APP, SMS, EMAIL facultatif (SKIPPED avec motif, un seul avertissement) et PUSH web (VAPID facultatives, web-push 3.6.7 pour le chiffrement seul, transport par fetch, liste blanche des services push, 404/410 suppriment l'abonnement), service worker minimal sans cache ni fetch qui supprime les anciens caches, routes d'abonnement ; notif-canaux : motif resserré sur le sendNotification de web-push (contradiction avec notif-migration et fondations-lot0, signalée) |
| 1e14575 | fix(6.3): catalogue unique des modèles (titre, SMS en un segment GSM-7, push, email, lien interne), formats partagés de date (Dakar) et de montant, mise en page des emails échappée avec désabonnement, liens internes seulement |
| 272b3b4 | fix(6.4): routes des préférences de notification (indispensables non désactivables) et bouton d'essai du push |
| 21598da | fix(6.5): réglages notif.\* historisés et bornés (verrous de la politique, de /api/admin/pricing et de la route des réglages), planification idempotente des rappels J-1 et H-3 et du rappel contrôleur, annulation des rappels dans la transaction de la suspension, de l'annulation, de la fin, du changement de date et du transfert, route /api/cron/reminders |
| 3930d11 | fix(6.6): notifications des partenaires, contrôleurs et admins mises en file dans la transaction métier (triggers sur cashouts, affectations, partenaires, auth.users ; RPC de caisse), partner_status_set (statuts synchronisés, sessions révoquées), destinataires admin par permission, invitation contrôleur synchrone journalisée sans code, envoi immédiat des campagnes désactivé ; adaptations signalées de finance-remboursement-billet, dette-cloture-caisse, dette-retrait-controleur, paiement-remboursement, sms-anti-abus |
| 267c32b | fix(6.7): tous les envois hors OTP passent par la boîte d'envoi (achat, billets gratuits, guichet, scan, cycle de vie, annulation, édition), event_change_notifications absorbée (lignes reprises, cron et route supprimés), transfert sans jeton vers un numéro vérifié (transferts reçus, acceptation, ancienne route 410), NotificationService et envois morts supprimés ; adaptations signalées de acces-qr, acces-totp, dette-transferts, dette-guichet, finance-affichage, email-optionnel, edition-formulaire, cycle-transitions, notifications-and-documents, partner-auth-complete et des legacy |
| f319b82 | fix(6.8): supervision admin des notifications (liste filtrable, détail sans code OTP, Relancer pour FAILED seulement, compteurs par canal et par jour, SMS du mois), permissions notifications.read et notifications.write |
| 299f957 | fix(6.9): planification de toutes les routes /api/cron/\* par pg_cron et pg_net avec l'URL et CRON_SECRET lus dans Vault (supabase/ops/schedule-crons.sql, idempotent, et unschedule-crons.sql), procédure de déploiement mise à jour (tâches, fréquences, variables) |
| 539b908 | fix(6.10): cloche et notifications sur le même ensemble (canal IN_APP seul, compteur et liste), non lues d'abord, pagination, lien interne seulement, écriture REST de notifications fermée ; adaptation signalée de temps-reel-billets (compteur PUSH du lot 5 contraire à la consigne 6.2) |
| 761b94f | test(6.0): dette-publication-reservations écoute la commande témoin et les réservations sur des canaux séparés ; une table retirée de la publication pouvait faire refuser le canal entier, témoin compris (run 61 : 0 message), le refus d'abonnement est admis et journalisé comme preuve de non-diffusion |
| 98ed24d | test(6.5): garde-fou de notif-rappels-annulation : SET CONSTRAINTS ALL IMMEDIATE avant ALTER TABLE (les triggers de contrainte différés du lot 5 laissaient des événements en attente sur events, 55006 au run 61) |
| edd4fc6 | test(6.7): notif-migration compare due_at au millième (String() d'une Date perdait les millisecondes) et désigne notif_failed_alert comme point d'insertion d'ADMIN_NOTIFICATION_FAILED ; notif-transferts achète 16 billets pour ses 13 prélèvements (run 61 : billets épuisés) |
| b5de823 | fix(6.0)[écrans]: connexion (composant serveur + LoginForm, plus de rendu Suspense intermédiaire, libellés figés), inscription, mot de passe oublié et réinitialisation migrés au système de design avec la logique conservée, OtpInput nommé et à 44 px, bouton de fermeture de la bulle Leaflet à 44 px, Badge marqué data-ev-caption, ScrollableTabs partagé dans components/ui et utilisé par la file admin (abonnement filtré par kind), « Saisie manuelle » sur une ligne, Skeleton et loading.tsx sur les tokens ; adaptation signalée de admin-evenements:863 (ScrollableTabs enveloppe Tabs) |
| 5ca1b1a | fix(6.2)[écrans]: abonnement push détaché à la déconnexion (AuthProvider, espace contrôleur) |
| 647e966 | fix(6.5)[écrans]: page des réglages migrée au système de design, section « Notifications » avec les 9 réglages notif.\* |
| ace584b | fix(6.7)[écrans]: Mes billets, onglet « Reçus » (transferts entrants, Accepter le billet, confirmation du numéro par code SMS), TransferModal vers un numéro seulement, explications du transfert sans email ni lien privé, ancienne page de réclamation redirigée vers /tickets?tab=recus |
| 0009721 | fix(6.8)[écrans]: page admin Notifications (liste filtrable, détail sans code, Relancer pour FAILED avec notifications.write, compteurs, SMS du mois), entrée du menu Système, StatusBadge domaine notification, abonnement du tableau de bord filtré par kind |
| cd8e109 | fix(6.10)[écrans]: cloche et page /notifications sur le même ensemble que le compteur (serveur), non lues d'abord, pagination, Tout marquer comme lu, liens internes seulement, temps réel |
| fb0c3b0 | fix(6.4)[écrans]: page « Préférences de notification » (familles, canaux, état du push sur l'appareil, bouton d'essai), Switch et PushDeviceCard, accès depuis les profils ; route du bouton d'essai renommée /api/notifications/essai-push (anonymisation-debogage interdit les routes nommées test-\*, run 61 ; le déplacement du fichier est parti dans b5de823), références de notif-preferences et notif-interface mises à jour (signalé) |
| 1d56751 | test(6.0): adaptations signalées de partenaire-liste:457 et pilotage-acces:262 (lot 5) : les onglets sont rendus par components/ui/ScrollableTabs, qui enveloppe Tabs (contrat A7) ; l'ancien ScrollableTabs du dossier partenaire laissait voir Tabs aux contrôles statiques (run 63) |
| 128cebd | test(6.4): notif-interface cherche l'appel à /api/notifications/essai-push (le motif du renommage n'avait pas été remplacé, run 63) |
| ad639ce | test(6.7): notif-migration compare aussi next_attempt_at et sent_at au millième (run 63, même défaut que due_at) |
| 5401a0c | test(e2e)[6.0]: un préchargement Next abandonné (net::ERR_ABORTED avec preuve de préchargement sur la requête ou sa chaîne de redirection) devient un avertissement compté et listé, non bloquant ; run 64 : les préchargements de /tickets, /orders et /wallet par un anonyme, redirigés vers /login devenu dynamique, faisaient échouer 27 captures (modification signalée d'un contrôle existant, toute autre requête en échec reste bloquante) |
| abb7556 | test(e2e)[6]: 13 écrans capturés de plus (connexion, inscription, mot de passe oublié, préférences avec push activé, refusé et non pris en charge, cloche ouverte, notifications vide et erreur, Mes billets Reçus, admin Notifications liste, détail et erreur), faux push à trois modes, classement des textes < 14 px admis ou hors exemption et tableau écran × règle (avertissements.tsv), faux service push (VAPID, déchiffrement RFC 8291, réponses forcées), fumée prolongée (achat, J-1 et H-3 par horloge simulée, annulation : rappels CANCELLED et avis envoyé) ; workflow : paire VAPID générée par run pour .env.e2e, clé privée masquée (signalé) |
| 1ab1623 | fix(6.12): seed de démonstration du lot 6 (permissions notifications, préférences, transfert reçu, rappels planifiés et annulés, journal OTP sans code, lignes FAILED et UNCERTAIN), par les RPC et le vrai envoyeur, terminé par les invariants (a) à (o) |
| 6279f2f | fix(6.2): le client push consomme toujours le corps des réponses d'inscription et de retrait d'appareil ; une réponse 200 jamais lue restait ouverte dans Chromium (run 65 : capture « push activé » bloquée sur la lecture de la réponse, réseau jamais au repos) ; la capture ne lit le corps qu'en cas d'échec |
| 288dc5e | fix(6.8)[relecture]: « SMS ce mois-ci » suit la règle de « SMS aujourd'hui » (envoyés et à l'issue incertaine, peut-être facturés) ; le mois pouvait être inférieur au jour (capture du run 65 : 159 contre 160) ; aide accordée (« dont 1 codes » corrigé) |
| c77cd05 | fix(6.10)[relecture]: /notifications passe à l'écran d'erreur tant qu'aucune liste n'est affichée (un rechargement temps réel lancé pendant le premier chargement le rendait caduc, et son échec laissait la page en chargement sans fin, capture du run 66) ; onglets défilants avec indice sur /notifications et Mes billets (onglets coupés au bord à 390 px, run 65) |
| 1422502 | fix(6.0)[relecture]: exemple du champ de connexion raccourci (« 77 123 45 67 ou adresse email ») ; il était tronqué à 390 px (run 65) |
| 3a246ad | test(e2e)[6]: fumée, étape 7 : le radio Wave (sr-only) est sélectionné par un clic envoyé à l'élément puis vérifié coché ; check({ force: true }) le jugeait parfois hors de l'écran dans la modale (run 66) |
| 43ff9ec | fix(6.8)[relecture]: admin_notifications_stats renvoie sms_month.total (envoyés et à l'issue incertaine, même règle que sms_today) et la page l'affiche tel quel ; 288dc5e additionnait dans le navigateur, contraire à la règle « le serveur est la seule source des chiffres » (relevé par la rédaction du rapport) |

49 commits depuis `fff03b1`. Le premier, `ab07e3a`, reporte sur la branche une correction de la procédure de déploiement faite avant le lot. Ce rapport est ajouté par le commit qui suit le dernier de cette liste.

**Écriture des tests.** Le contrat commun est écrit après une découverte par sept sous-agents. Les tests rouges sont écrits par huit écrivains (infrastructure, puis un par domaine), sur des fichiers nouveaux, typecheckés sans les correctifs, puis committés avant tout correctif. Les agents d'interface avaient pour consigne d'invoquer le skill ui-ux-pro-max et de suivre `design-system/event-village/MASTER.md` ; je n'ai pas retrouvé de trace de sortie du skill pour ce lot (non vérifié). Le respect du système de design est contrôlé par `design-systeme` et `notif-interface`, verts au run 67.

### Tests existants modifiés (signalement)

**A. Tests antérieurs au lot 6.** Chaque ligne a été relue dans le diff `fff03b1..3a246ad`.

*Infrastructure (phase rouge, avant tout correctif) :*

| Fichier | Commit | Avant | Après | Raison |
|---|---|---|---|---|
| `tests/security/r3-fonctions-rpc.test.ts` | `f610ba3` | `event_notify`, `event_change_notifications_claim` et `_mark` dans la liste des RPC métier | ces trois entrées retirées ; 22 RPC `(p jsonb)` du lot et `event_start_at` ajoutées ; nouveau bloc qui exige pour chacune qu'elle **existe** et soit refusée à anon et authenticated par le privilège (42501), alors que la boucle existante acceptait une fonction absente (PGRST202) | plus strict ; trois fonctions supprimées par le lot |
| `tests/helpers/design-files.ts` | `f6b4fd3` | liste blanche du lot 5 | fichiers du lot 6 ajoutés ; entrée `components/partner/pilotage/ScrollableTabs.tsx` retirée | le fichier est déplacé dans `components/ui` (contrat A7, amendement 9) |
| `tests/fakes/fake-sms.ts` | `f610ba3` | file d'échecs `failNext` | file de scénarios : `failNext` (même effet qu'avant : `success: false`, `error`), `rejectNext` (refus définitif), `uncertainNext` (issue incertaine) ; champ `outcome`, `deliveredTo()` | contrat E6 ; le comportement des lots 0 à 5 est conservé |
| `tests/fakes/fake-email.ts` | `f610ba3` | sujet et HTML enregistrés | en plus : version texte, en-têtes, clé d'idempotence ; `failNext(…, { retryable })` | contrat F3 ; sans option, comportement inchangé |
| `tests/fakes/index.ts` | `f610ba3`, `359d860` | trois faux | faux push ajouté ; `FakeIntegrations extends Integrations` (typage local retiré par `359d860`) | contrat F4 |
| `tests/helpers/env.ts` | `f610ba3` | — | refuse `VAPID_PRIVATE_KEY` dans `.env.test` et dans le shell des tests (sauf `.env.e2e`, écrit par la CI avec une paire générée pour le run) | plus strict : une clé réelle ne doit jamais servir aux tests |

*Adaptations faites dans les commits de correctif (section T du contrat) :*

| Suite | Commit | Avant | Après | Raison |
|---|---|---|---|---|
| `acces-qr` | `267c32b` | cible = email du destinataire ; jeton lu dans `claim_url` ; `POST /api/tickets/claim/[token]` | `markPhoneVerified`, cible = numéro ; `transfer.transfer_id` ; `POST /api/tickets/transfers/[id]/claim` | décisions de l'utilisateur (transfert sans jeton, vers un numéro) |
| `acces-totp` | `267c32b` | idem | idem | idem |
| `dette-transferts` | `267c32b` | `recipient_notified` vrai ou faux, SMS envoyé par la route | `recipient_notification: 'QUEUED'`, une ligne SMS PENDING, envoi par l'envoyeur au texte exact avec `provider_message_id` ; échec simulé : ligne PENDING, 1 tentative, prochain essai à +60 s, transfert et verrou conservés ; entrée invalide `recipient: null` au lieu de `claim_token_hash: null` | 6.1 (plus d'envoi depuis une route) ; décision 38 |
| `dette-guichet` | `267c32b` | `receipt_sent` | `receipt_queued`, `receipt_refusal` ; ligne `SMS:PENDING` rattachée à la caisse, envoyeur, puis SENT ; échec : ligne PENDING avec 1 tentative, vente conservée | contrat J1.3 |
| `finance-affichage` | `267c32b` | lecture directe du faux SMS | passage de l'envoyeur sur les lignes `PURCHASE_CONFIRMED` avant la lecture | 6.1 |
| `email-optionnel` | `267c32b` | lecture directe | envoyeur avant la lecture ; **en plus** : la ligne EMAIL est SKIPPED `EMAIL_NOT_CONFIGURED` | 6.1 ; plus strict |
| `edition-formulaire` | `267c32b` | lignes de `event_change_notifications`, cron `event-change-notifications` (401 sans secret, puis envoi) | lignes `EVENT_CHANGED` SMS de la boîte d'envoi ; titre seul : ligne SKIPPED `TITLE_ONLY` (plus strict) ; envoi par l'envoyeur à midi (Dakar) le lendemain, puis +61 s sans doublon. L'assertion « cron sans secret → 401 » disparaît avec la route ; la protection de la nouvelle route est prouvée par `notif-envoyeur` (503 sans `CRON_SECRET`, 401 sans jeton ou avec un mauvais) | absorption de la file du lot 5 (6.1, J1.9) |
| `cycle-transitions` | `267c32b` | photographie puis lecture | passage de l'envoyeur, restreint à l'événement, avant la photographie et après l'action ; assertions inchangées | l'in-app passe par l'envoyeur (décision 4) |
| `notifications-and-documents` (cas 4) | `267c32b` | cherche `notifySuperadmins` et `type: 'KYC'` dans `notification.service.ts` | catalogue : `ADMIN_PARTNER_REGISTERED`, `inAppType: 'KYC'`, audience ADMIN, canal IN_APP ; base : ligne au registre et trigger `trg_partners_notify` à l'insertion, dont la fonction crée ce type | service supprimé (6.7) ; même règle métier |
| `partner-auth-complete` | `267c32b` | import de `NotificationService` (inutilisé) | import retiré | service supprimé |
| `finance-remboursement-billet` | `3930d11` | lecture directe | l'envoyeur livre d'abord les lignes PENDING du client | `REFUND_PAID` par la boîte d'envoi |
| `dette-cloture-caisse` | `3930d11` | photographie et comparaison directes | l'envoyeur livre les lignes PENDING du partenaire avant la photographie et avant la comparaison | in-app `SHIFT_DISCREPANCY` par l'envoyeur |
| `dette-retrait-controleur` | `3930d11` | trace sans envoyeur | envoyeur avant chaque trace ; **en plus** : aucune ligne de boîte d'envoi pour le contrôleur après un refus | plus strict |
| `paiement-remboursement` | `3930d11` | lecture directe de `CASHOUT_ALERT` | envoyeur sur les lignes `ADMIN_REFUND_TO_RETRY:<cashout>:` du SUPERADMIN avant la lecture | alerte mise en file par `trg_cashouts_notify` |
| `sms-anti-abus` | `3930d11` | lecture directe de `SMS_DAILY_CAP_REACHED` | envoyeur sur les lignes `ADMIN_SMS_CAP_GLOBAL:<jour UTC>:` du SUPERADMIN avant la lecture | alerte mise en file par `notification_admin_alert` |
| `temps-reel-billets` | `539b908` | jeu de 5 notifications sur PUSH, SMS et EMAIL ; compteur = PUSH non lues | 5 notifications IN_APP ; compteur = toutes les non lues du compte, `total` = 5, la liste montre les 5, et ses non lues sont exactement celles du compteur | la consigne 6.2 et 6.10 remplace la règle du lot 5 ; le même ensemble est vérifié des deux côtés |
| `admin-evenements:863` | `b5de823` | `assertRenders(files, 'Tabs', …)` | `assertRenders(files, 'ScrollableTabs', …)` | contrat A7 : `components/ui/ScrollableTabs` enveloppe `Tabs` ; `screenFiles` exclut `components/ui` |
| `partenaire-liste:457` | `1d56751` | idem | idem | idem (run 63) |
| `pilotage-acces:262` | `1d56751` | `/<Tabs\b/` rendu | `/<(?:Scrollable)?Tabs\b/` rendu ; l'import de `components/ui/Tabs` reste exigé | idem (run 63) |
| Legacy (5 fichiers) | `267c32b` | cas appelant des API supprimées | cas supprimés et commentés, une mise en place portée | section 5 |

*Outillage e2e, workflow et seed :*
- `e2e/support/checks.ts`, `build-index.ts`, `capture-record.ts` (`abb7556`) : chaque texte < 14 px est classé « admis » (ancêtres `small`, `time`, `figcaption`, `caption`, `legend`, texte SVG, `[data-ev-caption]`) ou « hors exemption ». **Aucun avertissement brut n'est retiré** : la ligne du lot 5 reste mot pour mot, une ligne de classement s'y ajoute. Tableau écran × règle en tête de l'index, `captures/avertissements.tsv`. Le champ masqué (sr-only) est mesuré sur son libellé visible de plus grande surface. 13 codes techniques ajoutés à la liste des valeurs interdites à l'écran.
- `e2e/support/network.ts` (`5401a0c`) : un préchargement Next abandonné (`net::ERR_ABORTED`) devient un avertissement compté et listé, **seulement** avec une preuve de préchargement sur la requête ou sa chaîne de redirection (`next-router-prefetch: 1`, `purpose`/`sec-purpose` contenant « prefetch », ou `rsc: 1` avec `_rsc=`). Toute autre requête en échec reste bloquante. Cause : au run 64, les préchargements de `/tickets`, `/orders` et `/wallet` par un visiteur anonyme, redirigés vers `/login` devenu dynamique, faisaient échouer 27 captures (section 6).
- `e2e/fumee.spec.ts` : étapes 7 à 10 ajoutées, étapes 1 à 6 inchangées, délai porté de 6 à 12 min (`abb7556`) ; étape 7, le radio Wave (sr-only) est sélectionné par un clic envoyé à l'élément puis vérifié coché, au lieu de `check({ force: true })` jugé « hors de l'écran » au run 66 (`3a246ad`).
- `e2e/support/screens.ts` : 13 écrans ajoutés (`abb7556`) ; la capture « push activé » ne lit le corps de la réponse d'inscription qu'en cas d'échec (`6279f2f`).
- Ajouts seulement : `e2e/captures.spec.ts`, `e2e/support/demo-ids.ts`, `e2e/support/env.ts`, `scripts/e2e/env.mjs` (refus d'un `PUSH_ENDPOINT_ALLOWED_ORIGINS` non local), `scripts/e2e/fake-services.mjs` (faux service push), nouveaux `e2e/support/{clock,fake-push,service}.ts` et `scripts/e2e/clock-run.ts` (`abb7556`).
- `tests/seed/seed-demo.ts` (`1ab1623`) : données de notification de démonstration ; à la fin, `assertNotificationInvariants('seed-demo')` (a à o) remplace `assertLifecycleInvariants` (a à l) : plus strict.
- `.github/workflows/verify.yml` : déclenchement aussi sur `lot*/**` (`223d3fd`, sans quoi la branche du lot n'aurait lancé aucun run) ; paire VAPID P-256 générée à chaque run pour `.env.e2e`, longueurs contrôlées (87 et 43), clé privée masquée dans les journaux, `PUSH_ENDPOINT_ALLOWED_ORIGINS=http://127.0.0.1:4010` (`abb7556`).

*Restés verts pour une autre raison, non modifiés :*
- `tests/e2e-scenarios.test.ts:171-173` exige que `public/sw.js` contienne `event-village-v1`. Le nouveau service worker le contient encore, mais seulement dans la liste des caches à **supprimer**.
- `tests/parcours/temps-reel-hook.test.ts:48-51` (`PUBLISHED_AFTER_LOT5`) liste encore `hall_reservations` et `table_reservations`, retirées de la publication ; aucune assertion n'en dépend.

**B. Tests du lot 6 corrigés après leur commit rouge** (défauts des tests ; chaque diff relu) :

| Commit | Suite | Défaut | Correction |
|---|---|---|---|
| `be40f1b` | `notif-pros` | passait un billet à UTILISE par un UPDATE direct, sans scan : violation de l'invariant (g) du lot 4, qui faisait échouer l'`after()` des 11 suites du lot 5 lancées après (run 59) | le billet est composté par un vrai scan accepté (événement à 3 h, dans la fenêtre de scan) |
| `359d860` | `notif-canaux` | le contrôle statique interdisait tout `sendNotification(`, ce qui contredisait `notif-migration` et `fondations-lot0`, qui exigent l'alias `MTargetService.sendNotification` | motif resserré sur le transport de la bibliothèque web-push (`webpush.sendNotification`, import nommé ou `require`). C'est un motif plus étroit : un appel à `mTargetService.sendNotification` hors liste blanche reste interdit par le contrôle K2 de `notif-migration` |
| `761b94f` | `dette-publication-reservations` | commande témoin et réservations sur un même canal Realtime : une table retirée de la publication pouvait faire refuser le canal entier, témoin compris (run 61 : 0 message) | canaux séparés ; pour les réservations, l'abonnement accepté (SUBSCRIBED) ou refusé (CHANNEL_ERROR) est admis et journalisé, tout autre état (délai dépassé compris) échoue. Au run 67, les trois abonnements sont SUBSCRIBED : la branche « refusé » n'a pas servi |
| `98ed24d` | `notif-rappels-annulation` | `ALTER TABLE` refusé (55006) par les triggers de contrainte différés du lot 5 (run 61) | `SET CONSTRAINTS ALL IMMEDIATE` avant, dans la transaction annulée du garde-fou |
| `edd4fc6` | `notif-migration`, `notif-transferts` | `String()` d'une `Date` perdait les millisecondes (`due_at`, écart de 433 ms) ; l'inventaire désignait `notification_outbox_mark` comme point d'insertion d'`ADMIN_NOTIFICATION_FAILED`, alors que c'est `notif_failed_alert` qui nomme le type ; 12 billets pour 13 prélèvements | comparaison au millième ; point d'insertion corrigé ; 16 billets |
| `fb0c3b0` | `notif-preferences`, `notif-interface` | la route d'essai `test-push` était interdite par `anonymisation-debogage` (routes `test-*`, run 61) | références à `/api/notifications/essai-push` |
| `128cebd` | `notif-interface` | un motif de recherche n'avait pas été remplacé par le renommage (run 63) | motif `essai-push` |
| `ad639ce` | `notif-migration` | même défaut de millisecondes sur `next_attempt_at` et `sent_at` (run 63) | comparaison au millième |

**C. Autres faits à signaler :**
- La route du bouton d'essai s'appelle `/api/notifications/essai-push` : `anonymisation-debogage` (lot 1) interdit toute route `test-*`. Son déplacement de fichier est parti dans `b5de823` (écrans 6.0) au lieu du commit 6.4.
- Les tests rouges et les correctifs n'ont pu tourner qu'en CI (pas de Docker sur le poste).
- Quatre agents correcteurs de la vague B ont été interrompus par la limite d'usage, puis relancés ; leurs reprises ont relu le code déjà écrit avant de le compléter.

---

## 2. Par tâche : grep, test rouge, correctif, test vert

Avant correctif : run CI 60 (`41504058977`, commit `be40f1b`), tests du lot dans leur version rouge, aucun correctif. Après : run 67 (`41743807069`, commit `3a246ad`). Greps exécutés sur l'arbre de `fff03b1` (départ du lot) puis de `3a246ad`. Journaux bruts de chaque suite : branche `ci-results`, `runs/60-41504058977/test-logs/` et `runs/67-41743807069/test-logs/`.

**Lecture des blocs « avant ».**
- Beaucoup de nouvelles suites échouent d'abord dans leur `before()` sur l'absence d'une table, d'une RPC ou d'un module du contrat (`notification_outbox`, `lib/notifications/catalog.ts`…). C'est un rouge réel mais structurel.
- Les défauts de fond sont visibles dans les cas qui n'en dépendent pas (suppression d'un événement, temps réel d'un compte suspendu, écritures REST, période d'essai…).
- Chaque suite du lot appelle `assertNotificationInvariants` dans son `after()` : avant correctif, ce hook échoue aussi (« schéma du lot 6 absent »), ligne `not ok` de niveau fichier.
- Les blocs « avant » ne montrent que les échecs et leurs deux premières lignes d'erreur ; les blocs « après » ne montrent que les lignes `ok`.

### 6.0 — Dette du lot 5

```text
$ git grep -c -E 'NOT IN \('"'"'SUSPENDU'"'"', ?'"'"'SUPPRIME'"'"'\)' fff03b1 -- supabase/migrations
(code de sortie 1)

$ git grep -c -E 'NOT IN \('"'"'SUSPENDU'"'"', ?'"'"'SUPPRIME'"'"'\)' 3a246ad -- supabase/migrations
3a246ad:supabase/migrations/20261103000001_lot6_dette.sql:14
(code de sortie 0)

$ git grep -n -E 'events_admin_manage|events_delete_guard|events_truncate_guard|REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.events' fff03b1 -- supabase/migrations
fff03b1:supabase/migrations/20261031000005_lot1b4_partenaire_ecritures.sql:20:DROP POLICY IF EXISTS "events_admin_manage" ON public.events;
fff03b1:supabase/migrations/20261031000005_lot1b4_partenaire_ecritures.sql:21:CREATE POLICY "events_admin_manage" ON public.events
(code de sortie 0)

$ git grep -n -E 'events_admin_manage|events_delete_guard|events_truncate_guard|REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.events' 3a246ad -- supabase/migrations
3a246ad:supabase/migrations/20261031000005_lot1b4_partenaire_ecritures.sql:20:DROP POLICY IF EXISTS "events_admin_manage" ON public.events;
3a246ad:supabase/migrations/20261031000005_lot1b4_partenaire_ecritures.sql:21:CREATE POLICY "events_admin_manage" ON public.events
3a246ad:supabase/migrations/20261103000001_lot6_dette.sql:22:--   events_admin_manage supprimée et écritures REST révoquées sur events (les écritures légitimes passent
3a246ad:supabase/migrations/20261103000001_lot6_dette.sql:207:CREATE OR REPLACE FUNCTION public.events_delete_guard() RETURNS trigger
3a246ad:supabase/migrations/20261103000001_lot6_dette.sql:225:COMMENT ON FUNCTION public.events_delete_guard() IS
3a246ad:supabase/migrations/20261103000001_lot6_dette.sql:227:REVOKE ALL ON FUNCTION public.events_delete_guard() FROM PUBLIC, anon, authenticated;
3a246ad:supabase/migrations/20261103000001_lot6_dette.sql:228:GRANT EXECUTE ON FUNCTION public.events_delete_guard() TO service_role;
3a246ad:supabase/migrations/20261103000001_lot6_dette.sql:230:DROP TRIGGER IF EXISTS trg_events_delete_guard ON public.events;
3a246ad:supabase/migrations/20261103000001_lot6_dette.sql:231:CREATE TRIGGER trg_events_delete_guard
3a246ad:supabase/migrations/20261103000001_lot6_dette.sql:233:    FOR EACH ROW EXECUTE FUNCTION public.events_delete_guard();
3a246ad:supabase/migrations/20261103000001_lot6_dette.sql:235:CREATE OR REPLACE FUNCTION public.events_truncate_guard() RETURNS trigger
3a246ad:supabase/migrations/20261103000001_lot6_dette.sql:245:COMMENT ON FUNCTION public.events_truncate_guard() IS
3a246ad:supabase/migrations/20261103000001_lot6_dette.sql:247:REVOKE ALL ON FUNCTION public.events_truncate_guard() FROM PUBLIC, anon, authenticated;
3a246ad:supabase/migrations/20261103000001_lot6_dette.sql:248:GRANT EXECUTE ON FUNCTION public.events_truncate_guard() TO service_role;
3a246ad:supabase/migrations/20261103000001_lot6_dette.sql:250:DROP TRIGGER IF EXISTS trg_events_truncate_guard ON public.events;
3a246ad:supabase/migrations/20261103000001_lot6_dette.sql:251:CREATE TRIGGER trg_events_truncate_guard
3a246ad:supabase/migrations/20261103000001_lot6_dette.sql:253:    FOR EACH STATEMENT EXECUTE FUNCTION public.events_truncate_guard();
3a246ad:supabase/migrations/20261103000001_lot6_dette.sql:255:-- events_admin_manage (FOR ALL, is_admin(), 20261031000005_lot1b4_partenaire_ecritures.sql:20-22) : supprimée.
3a246ad:supabase/migrations/20261103000001_lot6_dette.sql:259:DROP POLICY IF EXISTS "events_admin_manage" ON public.events;
3a246ad:supabase/migrations/20261103000001_lot6_dette.sql:260:REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.events FROM anon, authenticated;
(code de sortie 0)

$ git grep -n -E 'supabase_realtime (ADD|DROP) TABLE (public\.)?(orders|hall_reservations|table_reservations)|ARRAY\['"'"'hall_reservations'"'"', '"'"'table_reservations'"'"'\]' fff03b1 -- supabase/migrations
fff03b1:supabase/migrations/0004_indexes.sql:143:        ALTER PUBLICATION supabase_realtime ADD TABLE orders;
fff03b1:supabase/migrations/0004_indexes.sql:147:        ALTER PUBLICATION supabase_realtime ADD TABLE hall_reservations;
fff03b1:supabase/migrations/0004_indexes.sql:148:        ALTER PUBLICATION supabase_realtime ADD TABLE table_reservations;
(code de sortie 0)

$ git grep -n -E 'supabase_realtime (ADD|DROP) TABLE (public\.)?(orders|hall_reservations|table_reservations)|ARRAY\['"'"'hall_reservations'"'"', '"'"'table_reservations'"'"'\]' 3a246ad -- supabase/migrations
3a246ad:supabase/migrations/0004_indexes.sql:143:        ALTER PUBLICATION supabase_realtime ADD TABLE orders;
3a246ad:supabase/migrations/0004_indexes.sql:147:        ALTER PUBLICATION supabase_realtime ADD TABLE hall_reservations;
3a246ad:supabase/migrations/0004_indexes.sql:148:        ALTER PUBLICATION supabase_realtime ADD TABLE table_reservations;
3a246ad:supabase/migrations/20261103000001_lot6_dette.sql:270:    FOREACH v_table IN ARRAY ARRAY['hall_reservations', 'table_reservations'] LOOP
(code de sortie 0)

$ git grep -n -E 'UPDATE public\.ticket_transfers SET status = '"'"'CANCELLED'"'"'' fff03b1 -- supabase/migrations/20261102000003_lot5_cycle.sql
fff03b1:supabase/migrations/20261102000003_lot5_cycle.sql:635:    UPDATE public.ticket_transfers SET status = 'CANCELLED', cancelled_at = now()
(code de sortie 0)

$ git grep -n -E 'UPDATE public\.ticket_transfers SET status = '"'"'CANCELLED'"'"'' 3a246ad -- supabase/migrations/20261103000005_lot6_billetterie.sql
3a246ad:supabase/migrations/20261103000005_lot6_billetterie.sql:205:    UPDATE public.ticket_transfers SET status = 'CANCELLED', cancelled_at = now() WHERE id = tr.id;
3a246ad:supabase/migrations/20261103000005_lot6_billetterie.sql:1147:    UPDATE public.ticket_transfers SET status = 'CANCELLED', cancelled_at = now()
(code de sortie 0)

$ git grep -n -E 'Suspense|useSearchParams|LoginForm' fff03b1 -- app/login/page.tsx
fff03b1:app/login/page.tsx:3:import React, { useState, useEffect, useCallback, Suspense } from 'react';
fff03b1:app/login/page.tsx:5:import { useRouter, useSearchParams } from 'next/navigation';
fff03b1:app/login/page.tsx:38:    const searchParams = useSearchParams();
fff03b1:app/login/page.tsx:756:        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-[#FF5722] border-t-transparent animate-spin" /></div>}>
fff03b1:app/login/page.tsx:758:        </Suspense>
(code de sortie 0)

$ git grep -n -E 'Suspense|useSearchParams|LoginForm' 3a246ad -- app/login/page.tsx
3a246ad:app/login/page.tsx:3:import { LoginForm } from '@/components/auth/LoginForm';
3a246ad:app/login/page.tsx:8: * (plus de repli Suspense sans formulaire, cause de la course de e2e/auth.setup.ts:16-17 au lot 5).
3a246ad:app/login/page.tsx:37:                <LoginForm redirectUrl={redirectUrl} errorParam={errorParam} messageParam={messageParam} />
(code de sortie 0)

$ git ls-tree -r --name-only fff03b1 -- components/ui/ScrollableTabs.tsx components/partner/pilotage/ScrollableTabs.tsx components/auth/LoginForm.tsx components/ui/LoadingSkeleton.tsx
components/partner/pilotage/ScrollableTabs.tsx
components/ui/LoadingSkeleton.tsx
(code de sortie 0)

$ git ls-tree -r --name-only 3a246ad -- components/ui/ScrollableTabs.tsx components/partner/pilotage/ScrollableTabs.tsx components/auth/LoginForm.tsx components/ui/LoadingSkeleton.tsx
components/auth/LoginForm.tsx
components/ui/ScrollableTabs.tsx
(code de sortie 0)

$ git grep -n -E '<(Scrollable)?Tabs\b' fff03b1 -- app/admin/events/page.tsx
fff03b1:app/admin/events/page.tsx:359:      <Tabs tabs={tabs} value={tab} onChange={changeTab} ariaLabel="Statut des événements" idPrefix={ID_PREFIX} />
(code de sortie 0)

$ git grep -n -E '<(Scrollable)?Tabs\b' 3a246ad -- app/admin/events/page.tsx
3a246ad:app/admin/events/page.tsx:363:      <ScrollableTabs tabs={tabs} value={tab} onChange={changeTab} ariaLabel="Statut des événements" idPrefix={ID_PREFIX} />
(code de sortie 0)

$ git grep -c -E 'bg-(gray|slate|white)|text-(gray|slate)-|#[0-9A-Fa-f]{6}' fff03b1 -- 'app/**/loading.tsx'
fff03b1:app/events/[id]/loading.tsx:2
fff03b1:app/orders/loading.tsx:1
fff03b1:app/partner/dashboard/loading.tsx:2
fff03b1:app/profile/loading.tsx:1
fff03b1:app/wallet/loading.tsx:2
(code de sortie 0)

$ git grep -c -E 'bg-(gray|slate|white)|text-(gray|slate)-|#[0-9A-Fa-f]{6}' 3a246ad -- 'app/**/loading.tsx'
(code de sortie 1)

$ git grep -n -E leaflet-popup-close-button fff03b1 -- app/globals.css
fff03b1:app/globals.css:541:.leaflet-container a.leaflet-popup-close-button {
fff03b1:app/globals.css:550:.leaflet-container a.leaflet-popup-close-button:hover {
fff03b1:app/globals.css:555:.leaflet-container a.leaflet-popup-close-button:focus-visible {
(code de sortie 0)

$ git grep -n -E leaflet-popup-close-button 3a246ad -- app/globals.css
3a246ad:app/globals.css:510:   classes « .leaflet-container a.leaflet-popup-close-button » (24 × 24 px) et l'emportait par l'ordre. */
3a246ad:app/globals.css:523:.leaflet-container .leaflet-popup a.leaflet-popup-close-button {
3a246ad:app/globals.css:532:.leaflet-container .leaflet-popup a.leaflet-popup-close-button:hover {
3a246ad:app/globals.css:537:.leaflet-container .leaflet-popup a.leaflet-popup-close-button:focus-visible {
(code de sortie 0)
```

**Correctif** (migration `…01`, commits `fba4337`, `b5de823`, `1422502`) :
- **a) Compte suspendu et temps réel.** Douze politiques des tables publiées (`ticket_scans`, `scan_incidents`, `controller_shifts`, `event_status_history`, `admin_signals`, `tickets`, `ticket_categories`, `notifications`, `orders`) reçoivent `EXISTS (… users.status NOT IN ('SUSPENDU','SUPPRIME'))` (amendement 1 : un partenaire inscrit est EN_ATTENTE). La branche publique du catalogue reste ouverte à tous.
- **b) Suppression.** Triggers `trg_events_delete_guard` (EV423 hors brouillon jamais soumis, y compris pour le service_role) et `trg_events_truncate_guard` ; politique `events_admin_manage` supprimée ; INSERT, UPDATE, DELETE et TRUNCATE révoqués sur `events` pour anon et authenticated. La route répond 409 `EVENT_NOT_DELETABLE` avec le message du trigger.
- **c) Annulation.** `event_cancel` annulait déjà les transferts PENDING dans sa transaction (`20261102000003_lot5_cycle.sql:635`) ; le lot ajoute la preuve (`dette-annulation-transferts`) et la recopie de la fonction (migration `…05`) garde ce bloc.
- **d) Publication.** `hall_reservations` et `table_reservations` retirées ; `orders` gardée, sa RLS prouvée (anon, client B, partenaire B : 0 message).
- **e) Connexion, inscription, mot de passe oublié, réinitialisation** migrées au système de design (`LoginForm` séparé, page de connexion en composant serveur sans rendu Suspense intermédiaire, libellés figés).
- **f)** Bouton de fermeture de la bulle Leaflet à 44 px ; classement des textes < 14 px (section 8).
- **g)** `ScrollableTabs` partagé dans `components/ui` et utilisé par la file admin, « Saisie manuelle » sur une ligne dans le scanner, 7 fichiers `loading.tsx` et `Skeleton` sur les tokens.

**parcours/dette-suspendu-temps-reel**

Run 60 (avant correctif) :

```text
    ok 1 - précondition : le partenaire actif abonné reçoit chacune des huit tables ; témoins abonnés
    not ok 2 - suspendu (PATCH /api/admin/partners/[id]/status) puis reconnecté : rien sur les huit tables, le témoin reçoit chaque changement
        → partenaire suspendu et reconnecté : messages reçus
        → partenaire suspendu reconnecté ticket_scans : 2 message(s) [{"id":"9d6101a1-2a8e-48ba-90d7-1240350fb62d","method":"QR","result":"invalid","accepted":false,"event_id":"f50209ae-29e3-41c8-aa4c-c3c36a627423","shift_id":null,"ticket_id":null,"amount_due":null,"cre
    ok 3 - réactivé (SUSPENDU → VALIDE par la même route) : un nouveau client reçoit chacune des huit tables
not ok 1 - 6.0 a — partenaire suspendu par la route : plus aucun message en temps réel
    not ok 1 - suspendu puis reconnecté : aucun signal ; l’admin du seed les reçoit ; réactivé : un nouveau client les reçoit
        → admin suspendu et reconnecté : signaux reçus — admin suspendu reconnecté signals : 2 message(s) [{"id":"3a85f9c8-a32a-4c65-b891-b8856de16912","kind":"PARTNER_REGISTERED","ref_id":"6526fb12-cab5-4f81-b7a2-1843657613ef","created_at":"2026-11-02T18:54:16.377098+0
        → + 'admin suspendu reconnecté signals : 2 message(s) [{"id":"3a85f9c8-a32a-4c65-b891-b8856de16912","kind":"PARTNER_REGISTERED","ref_id":"6526fb12-cab5-4f81-b7a2-1843657613ef","created_at":"2026-11-02T18:54:16.377098+00:00"},{"id":"68702bde-223a-4650-9f7a-0d908d
not ok 2 - 6.0 a — admin suspendu (PATCH /api/admin/users) : rien sur admin_signals
    not ok 1 - suspendu puis reconnecté : aucune mise à jour de sa caisse ; l’admin la reçoit ; réactivé : un nouveau client la reçoit
        → contrôleur suspendu et reconnecté : sa caisse reçue — contrôleur suspendu reconnecté shift : 3 message(s) [{"id":"d5a0f0bf-779a-4780-9583-03630d7c9413","status":"OUVERT","event_id":"f50209ae-29e3-41c8-aa4c-c3c36a627423","closed_at":null,"closed_by":null,"opene
        → + 'contrôleur suspendu reconnecté shift : 3 message(s) [{"id":"d5a0f0bf-779a-4780-9583-03630d7c9413","status":"OUVERT","event_id":"f50209ae-29e3-41c8-aa4c-c3c36a627423","closed_at":null,"closed_by":null,"opened_at":"2026-11-02T18:54:19.848783+00:00","created_a
not ok 3 - 6.0 a — contrôleur suspendu (PATCH /api/admin/users) : rien sur sa caisse
    not ok 1 - chaque politique du tableau A1 lit users.status (ni SUSPENDU ni SUPPRIME) et s’adresse à authenticated
        → politiques des tables publiées sans le statut du compte :
        → ticket_scans.ticket_scans_owner_admin_select : USING ne lit pas le statut du compte
not ok 4 - 6.0 a — sonde pg_policies des tables publiées
not ok 5 - /home/runner/work/event-village/event-village/tests/parcours/dette-suspendu-temps-reel.test.ts
        → invariants (m)(n)(o) impossibles à vérifier (dette-suspendu-temps-reel) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
# pass 2
# fail 4
```

Run 67 (après correctif) :

```text
    ok 1 - précondition : le partenaire actif abonné reçoit chacune des huit tables ; témoins abonnés
    ok 2 - suspendu (PATCH /api/admin/partners/[id]/status) puis reconnecté : rien sur les huit tables, le témoin reçoit chaque changement
    ok 3 - réactivé (SUSPENDU → VALIDE par la même route) : un nouveau client reçoit chacune des huit tables
ok 1 - 6.0 a — partenaire suspendu par la route : plus aucun message en temps réel
    ok 1 - suspendu puis reconnecté : aucun signal ; l’admin du seed les reçoit ; réactivé : un nouveau client les reçoit
ok 2 - 6.0 a — admin suspendu (PATCH /api/admin/users) : rien sur admin_signals
    ok 1 - suspendu puis reconnecté : aucune mise à jour de sa caisse ; l’admin la reçoit ; réactivé : un nouveau client la reçoit
ok 3 - 6.0 a — contrôleur suspendu (PATCH /api/admin/users) : rien sur sa caisse
    ok 1 - chaque politique du tableau A1 lit users.status (ni SUSPENDU ni SUPPRIME) et s’adresse à authenticated
ok 4 - 6.0 a — sonde pg_policies des tables publiées
# pass 6
# fail 0
```

**parcours/dette-suppression-evenement**

Run 60 (avant correctif) :

```text
    not ok 1 - événement PUBLIE sans vente : DELETE refusé (EV423), historique intacts
        → DELETE service_role d'un événement PUBLIE : événement SUPPRIMÉ (historique de 4 ligne(s), 0 annulation(s) et 1 catégorie(s) emportés par cascade) — erreur null, 1 ligne(s) supprimée(s)
    not ok 2 - événement VALIDE sans vente : DELETE refusé (EV423), historique intacts
        → DELETE service_role d'un événement VALIDE : événement SUPPRIMÉ (historique de 3 ligne(s), 0 annulation(s) et 1 catégorie(s) emportés par cascade) — erreur null, 1 ligne(s) supprimée(s)
    not ok 3 - événement EN_ATTENTE sans vente : DELETE refusé (EV423), historique intacts
        → DELETE service_role d'un événement EN_ATTENTE : événement SUPPRIMÉ (historique de 2 ligne(s), 0 annulation(s) et 1 catégorie(s) emportés par cascade) — erreur null, 1 ligne(s) supprimée(s)
    not ok 4 - événement SUSPENDU sans vente : DELETE refusé (EV423), historique intacts
        → DELETE service_role d'un événement SUSPENDU : événement SUPPRIMÉ (historique de 5 ligne(s), 0 annulation(s) et 1 catégorie(s) emportés par cascade) — erreur null, 1 ligne(s) supprimée(s)
    not ok 5 - événement ANNULE sans vente : DELETE refusé (EV423), historique et annulation intacts
        → DELETE service_role d'un événement ANNULE : événement SUPPRIMÉ (historique de 5 ligne(s), 1 annulation(s) et 1 catégorie(s) emportés par cascade) — erreur null, 1 ligne(s) supprimée(s)
    not ok 6 - événement TERMINE sans vente : DELETE refusé (EV423), historique intacts
        → DELETE service_role d'un événement TERMINE : événement SUPPRIMÉ (historique de 5 ligne(s), 0 annulation(s) et 1 catégorie(s) emportés par cascade) — erreur null, 1 ligne(s) supprimée(s)
    not ok 7 - brouillon soumis puis refusé : DELETE refusé (EV423, historique conservé)
        → DELETE service_role d’un brouillon refusé : événement SUPPRIMÉ (historique de 3 ligne(s), 0 annulation(s) et 1 catégorie(s) emportés par cascade) — erreur null, 1 ligne(s) supprimée(s)
    ok 8 - garde-fou : un brouillon neuf (seule la ligne CREATION) reste supprimable, son historique et ses catégories partent avec lui
not ok 1 - 6.0 b — DELETE par le service_role refusé hors brouillon (trigger events_delete_guard, EV423)
    not ok 1 - TRUNCATE public.events CASCADE (transaction annulée) → EV423 « La table des événements ne se vide pas. »
        → TRUNCATE public.events CASCADE accepté (annulé par la transaction du test) : aucun trigger BEFORE TRUNCATE
        → true !== false
not ok 2 - 6.0 b — TRUNCATE de events refusé (trigger events_truncate_guard)
    not ok 1 - événement PUBLIE : 409 EVENT_NOT_DELETABLE avec le message du trigger, événement et historique intacts
        → HTTP 400 {"error":"Seuls les événements en statut BROUILLON peuvent être supprimés."}
        → 400 !== 409
    not ok 2 - brouillon refusé : 409 EVENT_NOT_DELETABLE avec le second message du trigger, historique conservé
        → brouillon refusé supprimé par la route, historique de 3 ligne(s) perdu (HTTP 200 {"success":true})
    ok 3 - garde-fou : brouillon neuf supprimé par la route (200), plus rien en base
not ok 3 - 6.0 b — DELETE /api/partner/events/[id] : 409 EVENT_NOT_DELETABLE hors brouillon neuf
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/dette-suppression-evenement.test.ts
        → invariants (m)(n)(o) impossibles à vérifier (dette-suppression-evenement) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
# pass 2
# fail 10
```

Run 67 (après correctif) :

```text
    ok 1 - événement PUBLIE sans vente : DELETE refusé (EV423), historique intacts
    ok 2 - événement VALIDE sans vente : DELETE refusé (EV423), historique intacts
    ok 3 - événement EN_ATTENTE sans vente : DELETE refusé (EV423), historique intacts
    ok 4 - événement SUSPENDU sans vente : DELETE refusé (EV423), historique intacts
    ok 5 - événement ANNULE sans vente : DELETE refusé (EV423), historique et annulation intacts
    ok 6 - événement TERMINE sans vente : DELETE refusé (EV423), historique intacts
    ok 7 - brouillon soumis puis refusé : DELETE refusé (EV423, historique conservé)
    ok 8 - garde-fou : un brouillon neuf (seule la ligne CREATION) reste supprimable, son historique et ses catégories partent avec lui
ok 1 - 6.0 b — DELETE par le service_role refusé hors brouillon (trigger events_delete_guard, EV423)
    ok 1 - TRUNCATE public.events CASCADE (transaction annulée) → EV423 « La table des événements ne se vide pas. »
ok 2 - 6.0 b — TRUNCATE de events refusé (trigger events_truncate_guard)
    ok 1 - événement PUBLIE : 409 EVENT_NOT_DELETABLE avec le message du trigger, événement et historique intacts
    ok 2 - brouillon refusé : 409 EVENT_NOT_DELETABLE avec le second message du trigger, historique conservé
    ok 3 - garde-fou : brouillon neuf supprimé par la route (200), plus rien en base
ok 3 - 6.0 b — DELETE /api/partner/events/[id] : 409 EVENT_NOT_DELETABLE hors brouillon neuf
# pass 12
# fail 0
```

**security/r20-evenements-ecritures-rest**

Run 60 (avant correctif) :

```text
    not ok 1 - DELETE de A_PUBLIE (billets émis) → refus 42501, événement intact
        → DELETE REST de A_PUBLIE par l’ADMIN : refus attendu 42501 (privilège d'écriture révoqué sur events), obtenu 23503 update or delete on table "events" violates foreign key constraint "tickets_event_id_fkey" on table "tickets"
        → '23503' !== '42501'
    not ok 2 - DELETE d’un identifiant inexistant → refus 42501 (privilège révoqué, sans ligne visée)
        → DELETE REST par l’ADMIN (identifiant inexistant) : acceptée par la base (0 ligne(s) renvoyée(s) : []), attendu un refus 42501
    not ok 3 - INSERT d’un événement → refus 42501, aucune ligne créée
        → événement créé par REST : [{"id":"35a2b0f0-37bc-4f74-a9d0-52d7c3c59c66","status":"BROUILLON"}]
        → +   id: '35a2b0f0-37bc-4f74-a9d0-52d7c3c59c66',
    not ok 4 - UPDATE de start_date du brouillon A_BROUILLON → refus 42501, date inchangée
        → date de A_BROUILLON changée par REST : [{"id":"5fa0d197-42ac-4845-a7d8-c2cc3d3ac134","start_date":"2099-12-31"}]
        → + '2099-12-31'
not ok 1 - R20 — ADMIN connecté : aucune écriture REST sur events
    not ok 1 - DELETE de son brouillon A_BROUILLON → refus 42501, brouillon intact
        → DELETE REST de son brouillon par le partenaire : acceptée par la base (0 ligne(s) renvoyée(s) : []), attendu un refus 42501
    not ok 2 - UPDATE de start_date de son brouillon → refus 42501, date inchangée
        → UPDATE REST de start_date par le partenaire : acceptée par la base (0 ligne(s) renvoyée(s) : []), attendu un refus 42501
    ok 3 - INSERT d’un événement → refus 42501, aucune ligne créée (déjà vert : RLS, couverture)
not ok 2 - R20 — partenaire propriétaire : aucune écriture REST sur ses événements
# pass 1
# fail 6
```

Run 67 (après correctif) :

```text
    ok 1 - DELETE de A_PUBLIE (billets émis) → refus 42501, événement intact
    ok 2 - DELETE d’un identifiant inexistant → refus 42501 (privilège révoqué, sans ligne visée)
    ok 3 - INSERT d’un événement → refus 42501, aucune ligne créée
    ok 4 - UPDATE de start_date du brouillon A_BROUILLON → refus 42501, date inchangée
ok 1 - R20 — ADMIN connecté : aucune écriture REST sur events
    ok 1 - DELETE de son brouillon A_BROUILLON → refus 42501, brouillon intact
    ok 2 - UPDATE de start_date de son brouillon → refus 42501, date inchangée
    ok 3 - INSERT d’un événement → refus 42501, aucune ligne créée (déjà vert : RLS, couverture)
ok 2 - R20 — partenaire propriétaire : aucune écriture REST sur ses événements
# pass 7
# fail 0
```

**parcours/dette-annulation-transferts**

Run 60 (avant correctif) :

```text
    ok 1 - PUBLIE → ANNULE : transfert CANCELLED, billet déverrouillé, même transaction ; le transfert d’un autre événement reste PENDING
    ok 2 - tout ou rien : un échec au déverrouillage annule toute l’annulation (transaction annulée)
    ok 3 - variante SUSPENDU → ANNULE : transfert CANCELLED, billet déverrouillé, même transaction
    not ok 4 - réclamation après l’annulation par la route POST /api/tickets/transfers/[id]/claim → 409 TRANSFER_NOT_PENDING, billet resté au porteur
        → markPhoneVerified 2525bbce-6f37-42bc-a098-b6b0df31334a : Could not find the 'phone_verified_at' column of 'users' in the schema cache (code PGRST204) — colonne users.phone_verified_at du contrat B1, migration 20261103000002
        → +   code: 'PGRST204',
not ok 1 - 6.0 c — event_cancel : transferts PENDING annulés et billets déverrouillés dans sa transaction
    ok 1 - copie de event_cancel sans les deux UPDATE (transaction annulée) : transfert resté PENDING et billet verrouillé relevés ; contre-épreuve hors transaction
ok 2 - 6.0 c — garde-fou : la vérification détecte une annulation qui ne révoque plus les transferts
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/dette-annulation-transferts.test.ts
        → invariants (m)(n)(o) impossibles à vérifier (dette-annulation-transferts) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
# pass 4
# fail 1
```

Run 67 (après correctif) :

```text
    ok 1 - PUBLIE → ANNULE : transfert CANCELLED, billet déverrouillé, même transaction ; le transfert d’un autre événement reste PENDING
    ok 2 - tout ou rien : un échec au déverrouillage annule toute l’annulation (transaction annulée)
    ok 3 - variante SUSPENDU → ANNULE : transfert CANCELLED, billet déverrouillé, même transaction
    ok 4 - réclamation après l’annulation par la route POST /api/tickets/transfers/[id]/claim → 409 TRANSFER_NOT_PENDING, billet resté au porteur
ok 1 - 6.0 c — event_cancel : transferts PENDING annulés et billets déverrouillés dans sa transaction
    ok 1 - copie de event_cancel sans les deux UPDATE (transaction annulée) : transfert resté PENDING et billet verrouillé relevés ; contre-épreuve hors transaction
ok 2 - 6.0 c — garde-fou : la vérification détecte une annulation qui ne révoque plus les transferts
# pass 5
# fail 0
```

**parcours/dette-publication-reservations**

Run 60 (avant correctif) :

```text
    not ok 1 - hall_reservations et table_reservations retirées de la publication ; orders y reste
        → tables encore publiées (aucun abonné dans l'application) : hall_reservations, table_reservations
        → +   'hall_reservations',
    not ok 2 - réservations de salle et de table : ni le client, ni le partenaire propriétaire, ni anon ne reçoivent une mise à jour (témoin : la commande, reçue par le partenaire)
        → réservations diffusées en temps réel :
        → partenaire propriétaire hallFiltered : 2 message(s) [{"id":"6dd6b151-ae2f-4747-b30d-4e15a58281da","notes":null,"status":"EN_ATTENTE","hall_id":"a0776815-94c2-4580-9914-f0d7551e69ff","end_date":"2027-05-22","end_time":null,"client_id":"35ef7aad-b388-486e-959a-a
not ok 1 - 6.0 d — publication supabase_realtime
    ok 1 - anon, client B et partenaire B (avec et sans filtre) ne reçoivent rien ; le partenaire propriétaire reçoit (couverture)
ok 2 - 6.0 d — orders : reçue par le partenaire propriétaire actif seulement
    ok 1 - la commande est visible du partenaire propriétaire et du client, d’aucun tiers (couverture)
    ok 2 - garde-fou : une politique permissive fabriquée (transaction annulée) est relevée par la sonde
    not ok 3 - partenaire propriétaire suspendu (users.status, transaction annulée) : aucune ligne (orders_read durcie, A1)
        → partenaire suspendu : la commande reste lisible par la RLS ({"active":1,"suspended":1}) — orders_read ne lit pas users.status
not ok 3 - 6.0 d — sonde RLS de orders_read sous le rôle et les claims de chaque abonné
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/dette-publication-reservations.test.ts
        → invariants (m)(n)(o) impossibles à vérifier (dette-publication-reservations) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
# pass 3
# fail 3
```

Run 67 (après correctif) :

```text
    ok 1 - hall_reservations et table_reservations retirées de la publication ; orders y reste
    ok 2 - réservations de salle et de table : ni le client, ni le partenaire propriétaire, ni anon ne reçoivent une mise à jour (témoin : la commande, reçue par le partenaire)
ok 1 - 6.0 d — publication supabase_realtime
    ok 1 - anon, client B et partenaire B (avec et sans filtre) ne reçoivent rien ; le partenaire propriétaire reçoit (couverture)
ok 2 - 6.0 d — orders : reçue par le partenaire propriétaire actif seulement
    ok 1 - la commande est visible du partenaire propriétaire et du client, d’aucun tiers (couverture)
    ok 2 - garde-fou : une politique permissive fabriquée (transaction annulée) est relevée par la sonde
    ok 3 - partenaire propriétaire suspendu (users.status, transaction annulée) : aucune ligne (orders_read durcie, A1)
ok 3 - 6.0 d — sonde RLS de orders_read sous le rôle et les claims de chaque abonné
# pass 6
# fail 0
```

Les cas d'écran de 6.0 (e, f, g) sont dans `notif-interface` et `design-systeme`, plus bas (« Écrans »).

### 6.1 — Boîte d'envoi unique et envoyeur

```text
$ git ls-tree --name-only fff03b1 -- app/api/cron/
app/api/cron/event-change-notifications
app/api/cron/events-finish
app/api/cron/moratoriums
app/api/cron/payments-reconcile
app/api/cron/referral-commissions
app/api/cron/stock-reservations
app/api/cron/ticket-transfers
(code de sortie 0)

$ git ls-tree --name-only 3a246ad -- app/api/cron/
app/api/cron/events-finish
app/api/cron/moratoriums
app/api/cron/notifications-dispatch
app/api/cron/payments-reconcile
app/api/cron/referral-commissions
app/api/cron/reminders
app/api/cron/stock-reservations
app/api/cron/ticket-transfers
(code de sortie 0)

$ git grep -c -E 'notification_outbox|FOR UPDATE SKIP LOCKED' fff03b1 -- supabase/migrations
fff03b1:supabase/migrations/20261102000002_lot5_dette.sql:1
fff03b1:supabase/migrations/20261102000003_lot5_cycle.sql:1
fff03b1:supabase/migrations/20261102000004_lot5_edition.sql:1
(code de sortie 0)

$ git grep -c -E 'notification_outbox|FOR UPDATE SKIP LOCKED' 3a246ad -- supabase/migrations
3a246ad:supabase/migrations/20261102000002_lot5_dette.sql:1
3a246ad:supabase/migrations/20261102000003_lot5_cycle.sql:1
3a246ad:supabase/migrations/20261102000004_lot5_edition.sql:1
3a246ad:supabase/migrations/20261103000002_lot6_outbox.sql:68
3a246ad:supabase/migrations/20261103000004_lot6_rappels.sql:5
3a246ad:supabase/migrations/20261103000005_lot6_billetterie.sql:9
3a246ad:supabase/migrations/20261103000006_lot6_pros_admin.sql:3
3a246ad:supabase/migrations/20261103000007_lot6_cloche.sql:2
3a246ad:supabase/migrations/20261103000008_lot6_supervision.sql:12
(code de sortie 0)

$ git grep -n -E 'export async function dispatchNotifications|FOR UPDATE SKIP LOCKED' fff03b1 -- lib/notifications/dispatcher.ts supabase/migrations/20261103000002_lot6_outbox.sql
(code de sortie 1)

$ git grep -n -E 'export async function dispatchNotifications|FOR UPDATE SKIP LOCKED' 3a246ad -- lib/notifications/dispatcher.ts supabase/migrations/20261103000002_lot6_outbox.sql
3a246ad:lib/notifications/dispatcher.ts:4: * Boucle : réservation d'un lot (RPC notification_outbox_claim, FOR UPDATE SKIP LOCKED, revérification et
3a246ad:lib/notifications/dispatcher.ts:510:export async function dispatchNotifications(opts: DispatchOptions = {}): Promise<DispatchReport> {
3a246ad:supabase/migrations/20261103000002_lot6_outbox.sql:21:-- E1-3 — l'envoyeur unique : réservation par lots (FOR UPDATE SKIP LOCKED) avec revérification et
3a246ad:supabase/migrations/20261103000002_lot6_outbox.sql:829:           FOR UPDATE SKIP LOCKED
(code de sortie 0)
```

**Correctif** (migration `…02`, commit `0724381`) :
- table `notification_outbox` : destinataire (compte ou numéro), canal, type, famille, sujet, données du modèle, `group_key`, clé d'idempotence UNIQUE (`<TYPE>:<identifiants>:<CANAL>`), statut (PENDING, SENDING, SENT, FAILED, SKIPPED, CANCELLED, plus **UNCERTAIN**), motif, tentatives, prochain essai, identifiant du fournisseur, horodatages, instantané de décision (`decision`) ; registre SQL des 67 types (`notification_types`) ; garde des statuts (NT409) ;
- insertion dans la transaction métier, par `notif_enqueue` appelée depuis les RPC et triggers (tâches 6.6 et 6.7) ;
- envoyeur unique `lib/notifications/dispatcher.ts` : `notification_outbox_claim` (lots en `FOR UPDATE SKIP LOCKED`, revérification au moment de l'envoi), `notification_outbox_mark` ; relances à 1, 5, 15 et 60 min, 5 tentatives, puis FAILED et alerte admin ; ligne SENDING de plus de 10 min reprise (SMS : UNCERTAIN, jamais renvoyé) ;
- adaptateur MTarget avec délai maximal (`MTARGET_TIMEOUT_MS`), issue `SENT`, `REJECTED` ou `UNCERTAIN` ;
- route `/api/cron/notifications-dispatch` protégée par `CRON_SECRET` ; OTP synchrone, journalisé sans le code (`notification_sync_log`).

**parcours/notif-outbox**

Run 60 (avant correctif) :

```text
    not ok 1 - public.notification_types contient exactement les types du contrat, avec famille, sujet, canaux, audience, politique, journal et permission
        → invariants (m)(n)(o) impossibles à vérifier (notif-outbox registre) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
    not ok 2 - le registre refuse un type mal formé, une famille optionnelle sans sujet, un canal inconnu, une permission hors audience ADMIN
        → invariants (m)(n)(o) impossibles à vérifier (notif-outbox registre CHECK) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
not ok 1 - 6.1 Registre des types (contrat C1, table G2)
    not ok 1 - colonnes, types et nullabilité de public.notification_outbox
        → invariants (m)(n)(o) impossibles à vérifier (notif-outbox colonnes) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
    not ok 2 - contraintes nommées, clés étrangères, index et triggers du contrat
        → invariants (m)(n)(o) impossibles à vérifier (notif-outbox contraintes) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
    not ok 3 - chaque CHECK refuse sa ligne fabriquée ; une ligne conforme est acceptée (transaction annulée)
        → invariants (m)(n)(o) impossibles à vérifier (notif-outbox CHECK) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
    not ok 4 - clé d’idempotence UNIQUE ; un seul SMS de changement PENDING par porteur et par événement
        → invariants (m)(n)(o) impossibles à vérifier (notif-outbox UNIQUE) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
not ok 2 - 6.1 Boîte d’envoi : schéma (contrat C2)
    not ok 1 - ligne SENT : statut, clé et destinataire figés (NT409 « Une notification terminée ne change plus. »)
        → insertOutboxRow {"type":"PASSWORD_CHANGED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":1,"max_attempts":5,"due_at":"2026-12-02T18:55:54.240Z","next_attempt_at":"2026-12-02T18:55:54.240Z","recipient_phone":"+221766667993","sent_at":"202
        → +   code: 'PGRST205',
    not ok 2 - ligne SKIPPED : statut, clé et destinataire figés (NT409 « Une notification terminée ne change plus. »)
        → insertOutboxRow {"type":"PASSWORD_CHANGED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":0,"max_attempts":5,"due_at":"2026-12-02T18:55:54.245Z","next_attempt_at":"2026-12-02T18:55:54.245Z","recipient_phone":"+221764373065","finished_at":
        → +   code: 'PGRST205',
    not ok 3 - ligne CANCELLED : statut, clé et destinataire figés (NT409 « Une notification terminée ne change plus. »)
        → insertOutboxRow {"type":"PASSWORD_CHANGED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":0,"max_attempts":5,"due_at":"2026-12-02T18:55:54.248Z","next_attempt_at":"2026-12-02T18:55:54.248Z","recipient_phone":"+221765637828","finished_at":
        → +   code: 'PGRST205',
    not ok 4 - ligne UNCERTAIN : statut, clé et destinataire figés (NT409 « Une notification terminée ne change plus. »)
        → insertOutboxRow {"type":"PASSWORD_CHANGED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":1,"max_attempts":5,"due_at":"2026-12-02T18:55:54.251Z","next_attempt_at":"2026-12-02T18:55:54.251Z","recipient_phone":"+221765367869","sent_at":"202
        → +   code: 'PGRST205',
    not ok 5 - FAILED → PENDING refusé hors relance manuelle (GUC notif.manual_retry absente) ; PENDING → PENDING admis
        → insertOutboxRow {"type":"PASSWORD_CHANGED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":5,"max_attempts":5,"due_at":"2026-12-02T18:55:54.253Z","next_attempt_at":"2026-12-02T18:55:54.253Z","recipient_phone":"+221762320758","finished_at":
        → +   code: 'PGRST205',
not ok 3 - 6.1 Boîte d’envoi : garde des statuts NT409, y compris pour le service_role
    not ok 1 - aucune table du lot dans la publication supabase_realtime
        → invariants (m)(n)(o) impossibles à vérifier (notif-outbox publication) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
    not ok 2 - RLS activée, aucune politique, aucun privilège pour anon et authenticated, service_role complet
        → invariants (m)(n)(o) impossibles à vérifier (notif-outbox privilèges) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
    not ok 3 - préférences et abonnements push : clés, CHECK et unicité (contrat C5)
        → invariants (m)(n)(o) impossibles à vérifier (notif-outbox C5) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
    not ok 4 - admin_signals accepte les nouveaux types et garde un seul signal par objet pour eux (contrat C6)
        → invariants (m)(n)(o) impossibles à vérifier (notif-outbox C6) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
not ok 4 - 6.1 Tables du lot : jamais publiées, RLS sans politique, service_role seul (contrat C2, C5)
    not ok 1 - chaque fonction existe, SECURITY DEFINER, search_path = public, volatilité du contrat, EXECUTE au service_role seul
        → fonctions du contrat D
        → +   'public.event_start_at(uuid) : absente (migration 20261103000002)',
    not ok 2 - event_start_at : début de l’événement à l’heure de Dakar (UTC+0)
        → invariants (m)(n)(o) impossibles à vérifier (notif-outbox event_start_at) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
    not ok 3 - notif_in_quiet_hours : plage qui passe minuit, plage dans la journée, plage vide, heure de Dakar
        → function public.notif_in_quiet_hours(timestamp with time zone, integer, integer) does not exist
    not ok 4 - notif_setting_int : entier lu, NULL si la clé manque ou si la valeur n’est pas entière (jamais de défaut caché)
        → invariants (m)(n)(o) impossibles à vérifier (notif-outbox notif_setting_int) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
    not ok 5 - notif_account_blocked : SUSPENDU, SUPPRIME et partenaire SUSPENDU bloquent ; ACTIF et EN_ATTENTE non
        → invariants (m)(n)(o) impossibles à vérifier (notif-outbox notif_account_blocked) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
    not ok 6 - notif_preference_enabled : activée sans ligne, sinon la valeur enregistrée
        → invariants (m)(n)(o) impossibles à vérifier (notif-outbox notif_preference_enabled) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
    not ok 7 - notif_admin_recipients : SUPERADMIN actif, ADMIN avec la permission ; users.role ignoré, comptes non actifs exclus
        → invariants (m)(n)(o) impossibles à vérifier (notif-outbox notif_admin_recipients) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
not ok 5 - 6.1 Fonctions SQL communes (contrat D)
    not ok 1 - une ligne PENDING par canal du registre, clés, données copiées, numéro non recopié ; rejeu sans doublon
        → invariants (m)(n)(o) impossibles à vérifier (notif-outbox notif_enqueue) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
    not ok 2 - due_at fourni ; filtre des canaux ; IN_APP et PUSH seulement avec un compte
        → invariants (m)(n)(o) impossibles à vérifier (notif-outbox notif_enqueue canaux) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
    not ok 3 - SKIPPED dès l’insertion : motif fourni (skip), préférence désactivée ; instantané et finished_at posés
        → invariants (m)(n)(o) impossibles à vérifier (notif-outbox notif_enqueue SKIPPED) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
    not ok 4 - compte suspendu ou partenaire suspendu : SKIPPED ACCOUNT_SUSPENDED sous politique BLOCK, avant la préférence ; ALLOW passe
        → invariants (m)(n)(o) impossibles à vérifier (notif-outbox notif_enqueue suspendu) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
    not ok 5 - sans téléphone : SMS SKIPPED NO_PHONE (numéro fourni : PENDING) ; email factice : EMAIL SKIPPED NO_REAL_EMAIL (adresse fournie : PENDING)
        → invariants (m)(n)(o) impossibles à vérifier (notif-outbox notif_enqueue destinataires) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
    not ok 6 - erreurs : type inconnu NT001, type synchrone NT002, horloge dans le passé NT003
        → invariants (m)(n)(o) impossibles à vérifier (notif-outbox notif_enqueue erreurs) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
    not ok 7 - notif_enqueue_admins : une ligne par destinataire de la permission du type, clé par admin, rejeu sans doublon
        → invariants (m)(n)(o) impossibles à vérifier (notif-outbox notif_enqueue_admins) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
not ok 6 - 6.1 notif_enqueue : mise en file dans la transaction de l’appelant (contrat D)
    not ok 1 - OTP envoyé : ligne SYNC_LOG SENT, une tentative, horodatée, sans code ; rejeu : une seule ligne
        → notification_sync_log : Could not find the function public.notification_sync_log(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
    not ok 2 - invitation en échec : FAILED avec motif ; refus de la garde : SKIPPED avec motif, sans sent_at
        → FAILED : Could not find the function public.notification_sync_log(p) in the schema cache
        → +   code: 'PGRST202',
    not ok 3 - type non synchrone refusé : aucune ligne écrite
        → fonction absente (PGRST202) : Could not find the function public.notification_sync_log(p) in the schema cache
not ok 7 - 6.1 notification_sync_log : journal des envois synchrones (OTP, invitation), jamais le code
not ok 8 - /home/runner/work/event-village/event-village/tests/parcours/notif-outbox.test.ts
        → invariants (m)(n)(o) impossibles à vérifier (notif-outbox) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
# pass 0
# fail 32
```

Run 67 (après correctif) :

```text
    ok 1 - public.notification_types contient exactement les types du contrat, avec famille, sujet, canaux, audience, politique, journal et permission
    ok 2 - le registre refuse un type mal formé, une famille optionnelle sans sujet, un canal inconnu, une permission hors audience ADMIN
ok 1 - 6.1 Registre des types (contrat C1, table G2)
    ok 1 - colonnes, types et nullabilité de public.notification_outbox
    ok 2 - contraintes nommées, clés étrangères, index et triggers du contrat
    ok 3 - chaque CHECK refuse sa ligne fabriquée ; une ligne conforme est acceptée (transaction annulée)
    ok 4 - clé d’idempotence UNIQUE ; un seul SMS de changement PENDING par porteur et par événement
ok 2 - 6.1 Boîte d’envoi : schéma (contrat C2)
    ok 1 - ligne SENT : statut, clé et destinataire figés (NT409 « Une notification terminée ne change plus. »)
    ok 2 - ligne SKIPPED : statut, clé et destinataire figés (NT409 « Une notification terminée ne change plus. »)
    ok 3 - ligne CANCELLED : statut, clé et destinataire figés (NT409 « Une notification terminée ne change plus. »)
    ok 4 - ligne UNCERTAIN : statut, clé et destinataire figés (NT409 « Une notification terminée ne change plus. »)
    ok 5 - FAILED → PENDING refusé hors relance manuelle (GUC notif.manual_retry absente) ; PENDING → PENDING admis
ok 3 - 6.1 Boîte d’envoi : garde des statuts NT409, y compris pour le service_role
    ok 1 - aucune table du lot dans la publication supabase_realtime
    ok 2 - RLS activée, aucune politique, aucun privilège pour anon et authenticated, service_role complet
    ok 3 - préférences et abonnements push : clés, CHECK et unicité (contrat C5)
    ok 4 - admin_signals accepte les nouveaux types et garde un seul signal par objet pour eux (contrat C6)
ok 4 - 6.1 Tables du lot : jamais publiées, RLS sans politique, service_role seul (contrat C2, C5)
    ok 1 - chaque fonction existe, SECURITY DEFINER, search_path = public, volatilité du contrat, EXECUTE au service_role seul
    ok 2 - event_start_at : début de l’événement à l’heure de Dakar (UTC+0)
    ok 3 - notif_in_quiet_hours : plage qui passe minuit, plage dans la journée, plage vide, heure de Dakar
    ok 4 - notif_setting_int : entier lu, NULL si la clé manque ou si la valeur n’est pas entière (jamais de défaut caché)
    ok 5 - notif_account_blocked : SUSPENDU, SUPPRIME et partenaire SUSPENDU bloquent ; ACTIF et EN_ATTENTE non
    ok 6 - notif_preference_enabled : activée sans ligne, sinon la valeur enregistrée
    ok 7 - notif_admin_recipients : SUPERADMIN actif, ADMIN avec la permission ; users.role ignoré, comptes non actifs exclus
ok 5 - 6.1 Fonctions SQL communes (contrat D)
    ok 1 - une ligne PENDING par canal du registre, clés, données copiées, numéro non recopié ; rejeu sans doublon
    ok 2 - due_at fourni ; filtre des canaux ; IN_APP et PUSH seulement avec un compte
    ok 3 - SKIPPED dès l’insertion : motif fourni (skip), préférence désactivée ; instantané et finished_at posés
    ok 4 - compte suspendu ou partenaire suspendu : SKIPPED ACCOUNT_SUSPENDED sous politique BLOCK, avant la préférence ; ALLOW passe
    ok 5 - sans téléphone : SMS SKIPPED NO_PHONE (numéro fourni : PENDING) ; email factice : EMAIL SKIPPED NO_REAL_EMAIL (adresse fournie : PENDING)
    ok 6 - erreurs : type inconnu NT001, type synchrone NT002, horloge dans le passé NT003
    ok 7 - notif_enqueue_admins : une ligne par destinataire de la permission du type, clé par admin, rejeu sans doublon
ok 6 - 6.1 notif_enqueue : mise en file dans la transaction de l’appelant (contrat D)
    ok 1 - OTP envoyé : ligne SYNC_LOG SENT, une tentative, horodatée, sans code ; rejeu : une seule ligne
    ok 2 - invitation en échec : FAILED avec motif ; refus de la garde : SKIPPED avec motif, sans sent_at
    ok 3 - type non synchrone refusé : aucune ligne écrite
ok 7 - 6.1 notification_sync_log : journal des envois synchrones (OTP, invitation), jamais le code
# pass 32
# fail 0
```

**parcours/notif-envoyeur**

Run 60 (avant correctif) :

```text
    not ok 1 - deux envoyeurs en parallèle : chaque ligne est réservée et envoyée une seule fois (FOR UPDATE SKIP LOCKED)
        → insertOutboxRow {"type":"PASSWORD_CHANGED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":0,"max_attempts":5,"due_at":"2026-11-02T18:55:46.602Z","next_attempt_at":"2026-11-02T18:55:46.602Z","channel":"SMS","recipient_phone":"+221769205820
        → +   code: 'PGRST205',
    not ok 2 - numéro du compte résolu à l’envoi ; compte suspendu entre-temps : SKIPPED ACCOUNT_SUSPENDED, aucun SMS
        → insertOutboxRow {"type":"PASSWORD_CHANGED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":0,"max_attempts":5,"due_at":"2026-11-02T18:55:46.946Z","next_attempt_at":"2026-11-02T18:55:46.946Z","channel":"SMS","recipient_user_id":"df33c58e-ed
        → +   code: 'PGRST205',
    not ok 3 - ordre de réservation : IN_APP avant SMS ; réponse de la réservation ; marquage par jeton (stale)
        → insertOutboxRow {"type":"PASSWORD_CHANGED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":0,"max_attempts":5,"due_at":"2026-11-02T18:55:47.080Z","next_attempt_at":"2026-11-02T18:55:47.080Z","channel":"SMS","recipient_user_id":"7c6ba4c8-90
        → +   code: 'PGRST205',
not ok 1 - 6.1 Envoyeur : réservation, revérification et marquage (contrat E1, E2, E4)
    not ok 1 - SMS refusé à réessayer : relances à 1, 5, 15 et 60 min, puis FAILED après la 5e tentative, alerte admin et signal
        → insertOutboxRow {"type":"PASSWORD_CHANGED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":0,"max_attempts":5,"due_at":"2026-11-02T18:55:47.083Z","next_attempt_at":"2026-11-02T18:55:47.083Z","channel":"SMS","recipient_phone":"+221761754642
        → +   code: 'PGRST205',
    not ok 2 - refus définitif du fournisseur : FAILED SMS_REJECTED dès la 1re tentative, code en détail, alerte admin
        → insertOutboxRow {"type":"PASSWORD_CHANGED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":0,"max_attempts":5,"due_at":"2026-11-02T18:55:47.087Z","next_attempt_at":"2026-11-02T18:55:47.087Z","channel":"SMS","recipient_phone":"+221761988470
        → +   code: 'PGRST205',
    not ok 3 - Retry-After du service push : plafonné à 240 min, jamais sous l’attente de la tentative
        → abonnement push : Could not find the table 'public.push_subscriptions' in the schema cache (code PGRST205)
        → +   code: 'PGRST205',
not ok 2 - 6.1 Envoyeur : relances avec attente croissante, 5 tentatives au plus (contrat E2, décision 3)
    not ok 1 - IN_APP : non reprise à 9 min, reprise après 10 min et envoyée, une seule notification
        → insertOutboxRow {"type":"PASSWORD_CHANGED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":0,"max_attempts":5,"due_at":"2026-11-02T18:55:47.356Z","next_attempt_at":"2026-11-02T18:55:47.356Z","channel":"IN_APP","recipient_user_id":"c0b43c4a
        → +   code: 'PGRST205',
    not ok 2 - SMS : passé UNCERTAIN SENDING_INTERRUPTED, jamais renvoyé, même un jour plus tard
        → insertOutboxRow {"type":"PASSWORD_CHANGED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":0,"max_attempts":5,"due_at":"2026-11-02T18:55:47.358Z","next_attempt_at":"2026-11-02T18:55:47.358Z","channel":"SMS","recipient_phone":"+221765905710
        → +   code: 'PGRST205',
    not ok 3 - dernière tentative interrompue : FAILED SENDING_INTERRUPTED, alerte admin et signal
        → insertOutboxRow {"type":"PASSWORD_CHANGED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":4,"max_attempts":5,"due_at":"2026-11-02T18:55:47.492Z","next_attempt_at":"2026-11-02T18:55:47.492Z","channel":"IN_APP","recipient_user_id":"c66f69a1
        → +   code: 'PGRST205',
not ok 3 - 6.1 Envoyeur : reprise des lignes SENDING de plus de 10 minutes (contrat E1, décision 2)
    not ok 1 - UNCERTAIN, sent_at posé, jamais renvoyé même à now + 1 jour, pas d’alerte FAILED
        → insertOutboxRow {"type":"PASSWORD_CHANGED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":0,"max_attempts":5,"due_at":"2026-11-02T18:55:47.495Z","next_attempt_at":"2026-11-02T18:55:47.495Z","channel":"SMS","recipient_phone":"+221767557056
        → +   code: 'PGRST205',
not ok 4 - 6.1 Envoyeur : SMS peut-être parti (délai dépassé après l’envoi)
    not ok 1 - INVALID_NOW pour la réservation, le marquage et les contrôles du jour ; dispatchNotifications rejette
        → insertOutboxRow {"type":"PASSWORD_CHANGED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":0,"max_attempts":5,"due_at":"2026-11-02T18:55:47.498Z","next_attempt_at":"2026-11-02T18:55:47.498Z","channel":"SMS","recipient_phone":"+221767989232
        → +   code: 'PGRST205',
not ok 5 - 6.1 Envoyeur : horloge dans le passé refusée (Conventions)
    not ok 1 - plafond quotidien atteint : SKIPPED SMS_DAILY_CAP, aucune relance, aucun SMS
        → insertOutboxRow {"type":"PASSWORD_CHANGED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":0,"max_attempts":5,"due_at":"2026-11-02T18:55:47.502Z","next_attempt_at":"2026-11-02T18:55:47.502Z","channel":"SMS","recipient_phone":"+221761929306
        → +   code: 'PGRST205',
    not ok 2 - seuil de SMS du jour dépassé : une seule alerte ADMIN_SMS_DAILY_THRESHOLD et un seul signal par jour
        → insertOutboxRow {"type":"PASSWORD_CHANGED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":0,"max_attempts":5,"due_at":"2026-11-02T18:55:47.505Z","next_attempt_at":"2026-11-02T18:55:47.505Z","channel":"SMS","recipient_phone":"+221765880538
        → +   code: 'PGRST205',
not ok 6 - 6.1 Envoyeur : plafond SMS et seuil du jour (décisions 4 et 9, contrat E3)
    not ok 1 - 503 sans CRON_SECRET, 401 sans jeton ou avec un mauvais jeton (rien n’est envoyé), 200 avec le rapport et l’envoi réel
        → route /api/cron/notifications-dispatch (contrat E5) absent : app/api/cron/notifications-dispatch/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/cron/notifications-dispatch/route' imported from /home/runner/work/event-village/
    not ok 2 - contrôles statiques : aucune heure lue dans la requête, dispatchNotifications() sans argument, protégée par CRON_SECRET
        → route absente : app/api/cron/notifications-dispatch/route.ts
not ok 7 - 6.1 Route /api/cron/notifications-dispatch (contrat E5)
not ok 8 - /home/runner/work/event-village/event-village/tests/parcours/notif-envoyeur.test.ts
        → invariants (m)(n)(o) impossibles à vérifier (notif-envoyeur) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
# pass 0
# fail 15
```

Run 67 (après correctif) :

```text
    ok 1 - deux envoyeurs en parallèle : chaque ligne est réservée et envoyée une seule fois (FOR UPDATE SKIP LOCKED)
    ok 2 - numéro du compte résolu à l’envoi ; compte suspendu entre-temps : SKIPPED ACCOUNT_SUSPENDED, aucun SMS
    ok 3 - ordre de réservation : IN_APP avant SMS ; réponse de la réservation ; marquage par jeton (stale)
ok 1 - 6.1 Envoyeur : réservation, revérification et marquage (contrat E1, E2, E4)
    ok 1 - SMS refusé à réessayer : relances à 1, 5, 15 et 60 min, puis FAILED après la 5e tentative, alerte admin et signal
    ok 2 - refus définitif du fournisseur : FAILED SMS_REJECTED dès la 1re tentative, code en détail, alerte admin
    ok 3 - Retry-After du service push : plafonné à 240 min, jamais sous l’attente de la tentative
ok 2 - 6.1 Envoyeur : relances avec attente croissante, 5 tentatives au plus (contrat E2, décision 3)
    ok 1 - IN_APP : non reprise à 9 min, reprise après 10 min et envoyée, une seule notification
    ok 2 - SMS : passé UNCERTAIN SENDING_INTERRUPTED, jamais renvoyé, même un jour plus tard
    ok 3 - dernière tentative interrompue : FAILED SENDING_INTERRUPTED, alerte admin et signal
ok 3 - 6.1 Envoyeur : reprise des lignes SENDING de plus de 10 minutes (contrat E1, décision 2)
    ok 1 - UNCERTAIN, sent_at posé, jamais renvoyé même à now + 1 jour, pas d’alerte FAILED
ok 4 - 6.1 Envoyeur : SMS peut-être parti (délai dépassé après l’envoi)
    ok 1 - INVALID_NOW pour la réservation, le marquage et les contrôles du jour ; dispatchNotifications rejette
ok 5 - 6.1 Envoyeur : horloge dans le passé refusée (Conventions)
    ok 1 - plafond quotidien atteint : SKIPPED SMS_DAILY_CAP, aucune relance, aucun SMS
    ok 2 - seuil de SMS du jour dépassé : une seule alerte ADMIN_SMS_DAILY_THRESHOLD et un seul signal par jour
ok 6 - 6.1 Envoyeur : plafond SMS et seuil du jour (décisions 4 et 9, contrat E3)
    ok 1 - 503 sans CRON_SECRET, 401 sans jeton ou avec un mauvais jeton (rien n’est envoyé), 200 avec le rapport et l’envoi réel
    ok 2 - contrôles statiques : aucune heure lue dans la requête, dispatchNotifications() sans argument, protégée par CRON_SECRET
ok 7 - 6.1 Route /api/cron/notifications-dispatch (contrat E5)
# pass 15
# fail 0
```

**security/r21-notifications-rest**

Run 60 (avant correctif) :

```text
    not ok 1 - anon : notification_outbox — ni lecture, ni insertion, ni modification, ni suppression
        → anon SELECT notification_outbox : refus attendu par le privilège (42501), obtenu PGRST205 Could not find the table 'public.notification_outbox' in the schema cache — PGRST205 : table absente (contrat C2/C5, migration 20261103000002)
    not ok 2 - CLIENT : notification_outbox — ni lecture, ni insertion, ni modification, ni suppression
        → CLIENT SELECT notification_outbox : refus attendu par le privilège (42501), obtenu PGRST205 Could not find the table 'public.notification_outbox' in the schema cache — PGRST205 : table absente (contrat C2/C5, migration 20261103000002)
    not ok 3 - PARTNER_A : notification_outbox — ni lecture, ni insertion, ni modification, ni suppression
        → PARTNER_A SELECT notification_outbox : refus attendu par le privilège (42501), obtenu PGRST205 Could not find the table 'public.notification_outbox' in the schema cache — PGRST205 : table absente (contrat C2/C5, migration 20261103000002)
    not ok 4 - ADMIN : notification_outbox — ni lecture, ni insertion, ni modification, ni suppression
        → ADMIN SELECT notification_outbox : refus attendu par le privilège (42501), obtenu PGRST205 Could not find the table 'public.notification_outbox' in the schema cache — PGRST205 : table absente (contrat C2/C5, migration 20261103000002)
    not ok 5 - anon : notification_preferences — ni lecture, ni insertion, ni modification, ni suppression
        → anon SELECT notification_preferences : refus attendu par le privilège (42501), obtenu PGRST205 Could not find the table 'public.notification_preferences' in the schema cache — PGRST205 : table absente (contrat C2/C5, migration 20261103000002)
    not ok 6 - CLIENT : notification_preferences — ni lecture, ni insertion, ni modification, ni suppression
        → CLIENT SELECT notification_preferences : refus attendu par le privilège (42501), obtenu PGRST205 Could not find the table 'public.notification_preferences' in the schema cache — PGRST205 : table absente (contrat C2/C5, migration 20261103000002)
    not ok 7 - PARTNER_A : notification_preferences — ni lecture, ni insertion, ni modification, ni suppression
        → PARTNER_A SELECT notification_preferences : refus attendu par le privilège (42501), obtenu PGRST205 Could not find the table 'public.notification_preferences' in the schema cache — PGRST205 : table absente (contrat C2/C5, migration 20261103000002)
    not ok 8 - ADMIN : notification_preferences — ni lecture, ni insertion, ni modification, ni suppression
        → ADMIN SELECT notification_preferences : refus attendu par le privilège (42501), obtenu PGRST205 Could not find the table 'public.notification_preferences' in the schema cache — PGRST205 : table absente (contrat C2/C5, migration 20261103000002)
    not ok 9 - anon : push_subscriptions — ni lecture, ni insertion, ni modification, ni suppression
        → anon SELECT push_subscriptions : refus attendu par le privilège (42501), obtenu PGRST205 Could not find the table 'public.push_subscriptions' in the schema cache — PGRST205 : table absente (contrat C2/C5, migration 20261103000002)
    not ok 10 - CLIENT : push_subscriptions — ni lecture, ni insertion, ni modification, ni suppression
        → CLIENT SELECT push_subscriptions : refus attendu par le privilège (42501), obtenu PGRST205 Could not find the table 'public.push_subscriptions' in the schema cache — PGRST205 : table absente (contrat C2/C5, migration 20261103000002)
    not ok 11 - PARTNER_A : push_subscriptions — ni lecture, ni insertion, ni modification, ni suppression
        → PARTNER_A SELECT push_subscriptions : refus attendu par le privilège (42501), obtenu PGRST205 Could not find the table 'public.push_subscriptions' in the schema cache — PGRST205 : table absente (contrat C2/C5, migration 20261103000002)
    not ok 12 - ADMIN : push_subscriptions — ni lecture, ni insertion, ni modification, ni suppression
        → ADMIN SELECT push_subscriptions : refus attendu par le privilège (42501), obtenu PGRST205 Could not find the table 'public.push_subscriptions' in the schema cache — PGRST205 : table absente (contrat C2/C5, migration 20261103000002)
    not ok 13 - anon : notification_types — ni lecture, ni insertion, ni modification, ni suppression
        → anon SELECT notification_types : refus attendu par le privilège (42501), obtenu PGRST205 Could not find the table 'public.notification_types' in the schema cache — PGRST205 : table absente (contrat C2/C5, migration 20261103000002)
    not ok 14 - CLIENT : notification_types — ni lecture, ni insertion, ni modification, ni suppression
        → CLIENT SELECT notification_types : refus attendu par le privilège (42501), obtenu PGRST205 Could not find the table 'public.notification_types' in the schema cache — PGRST205 : table absente (contrat C2/C5, migration 20261103000002)
    not ok 15 - PARTNER_A : notification_types — ni lecture, ni insertion, ni modification, ni suppression
        → PARTNER_A SELECT notification_types : refus attendu par le privilège (42501), obtenu PGRST205 Could not find the table 'public.notification_types' in the schema cache — PGRST205 : table absente (contrat C2/C5, migration 20261103000002)
    not ok 16 - ADMIN : notification_types — ni lecture, ni insertion, ni modification, ni suppression
        → ADMIN SELECT notification_types : refus attendu par le privilège (42501), obtenu PGRST205 Could not find the table 'public.notification_types' in the schema cache — PGRST205 : table absente (contrat C2/C5, migration 20261103000002)
not ok 1 - R21 — tables du lot 6 inaccessibles par REST (42501)
    not ok 1 - un client ne crée pas de notification à son nom
        → client INSERT notifications (son compte) : opération ACCEPTÉE, la table doit être réservée au rôle de service
    ok 2 - un ADMIN connecté ne crée pas de notification au nom d’un autre compte
    not ok 3 - un client ne modifie pas ses notifications (titre, statut lu) par REST
        → client UPDATE notifications (1 ligne(s) modifiée(s)) : opération ACCEPTÉE, la table doit être réservée au rôle de service
    not ok 4 - un client ne modifie pas les notifications d’un autre compte
        → client UPDATE notifications (autre compte) : refus par le privilège attendu (42501), la base répond sans erreur
    ok 5 - garde-fou : anon ne crée pas de notification
    ok 6 - garde-fou : un client ne supprime aucune notification (ni la sienne, ni celle d’un autre)
    ok 7 - garde-fou : un client lit ses propres notifications (cloche, temps réel) et pas celles d’un autre
not ok 2 - R21 — notifications in-app : aucune écriture par REST (contrat F1)
# pass 4
# fail 19
```

Run 67 (après correctif) :

```text
    ok 1 - anon : notification_outbox — ni lecture, ni insertion, ni modification, ni suppression
    ok 2 - CLIENT : notification_outbox — ni lecture, ni insertion, ni modification, ni suppression
    ok 3 - PARTNER_A : notification_outbox — ni lecture, ni insertion, ni modification, ni suppression
    ok 4 - ADMIN : notification_outbox — ni lecture, ni insertion, ni modification, ni suppression
    ok 5 - anon : notification_preferences — ni lecture, ni insertion, ni modification, ni suppression
    ok 6 - CLIENT : notification_preferences — ni lecture, ni insertion, ni modification, ni suppression
    ok 7 - PARTNER_A : notification_preferences — ni lecture, ni insertion, ni modification, ni suppression
    ok 8 - ADMIN : notification_preferences — ni lecture, ni insertion, ni modification, ni suppression
    ok 9 - anon : push_subscriptions — ni lecture, ni insertion, ni modification, ni suppression
    ok 10 - CLIENT : push_subscriptions — ni lecture, ni insertion, ni modification, ni suppression
    ok 11 - PARTNER_A : push_subscriptions — ni lecture, ni insertion, ni modification, ni suppression
    ok 12 - ADMIN : push_subscriptions — ni lecture, ni insertion, ni modification, ni suppression
    ok 13 - anon : notification_types — ni lecture, ni insertion, ni modification, ni suppression
    ok 14 - CLIENT : notification_types — ni lecture, ni insertion, ni modification, ni suppression
    ok 15 - PARTNER_A : notification_types — ni lecture, ni insertion, ni modification, ni suppression
    ok 16 - ADMIN : notification_types — ni lecture, ni insertion, ni modification, ni suppression
ok 1 - R21 — tables du lot 6 inaccessibles par REST (42501)
    ok 1 - un client ne crée pas de notification à son nom
    ok 2 - un ADMIN connecté ne crée pas de notification au nom d’un autre compte
    ok 3 - un client ne modifie pas ses notifications (titre, statut lu) par REST
    ok 4 - un client ne modifie pas les notifications d’un autre compte
    ok 5 - garde-fou : anon ne crée pas de notification
    ok 6 - garde-fou : un client ne supprime aucune notification (ni la sienne, ni celle d’un autre)
    ok 7 - garde-fou : un client lit ses propres notifications (cloche, temps réel) et pas celles d’un autre
ok 2 - R21 — notifications in-app : aucune écriture par REST (contrat F1)
# pass 23
# fail 0
```

### 6.2 — Canaux

```text
$ git grep -n -E 'VAPID_|MTARGET_TIMEOUT_MS|PUSH_' fff03b1 -- lib/env.ts
(code de sortie 1)

$ git grep -n -E 'VAPID_|MTARGET_TIMEOUT_MS|PUSH_' 3a246ad -- lib/env.ts
3a246ad:lib/env.ts:11: * REGISSEUR_PIN_KEY (PIN régisseur, lot 4). Lot 6 : VAPID_PRIVATE_KEY (push web, facultative) rejoint les
3a246ad:lib/env.ts:105:    MTARGET_TIMEOUT_MS: limit(15000),
3a246ad:lib/env.ts:109:    // PUSH_NOT_CONFIGURED, un seul avertissement) et tout le reste fonctionne. Validées par
3a246ad:lib/env.ts:111:    VAPID_PUBLIC_KEY: optionalString,
3a246ad:lib/env.ts:112:    VAPID_PRIVATE_KEY: optionalString, // secret : clé privée P-256 (base64url, 32 octets)
3a246ad:lib/env.ts:113:    VAPID_SUBJECT: optionalString, // mailto:… ou https:…
3a246ad:lib/env.ts:115:    PUSH_ENDPOINT_ALLOWED_ORIGINS: optionalString,
3a246ad:lib/env.ts:116:    PUSH_TIMEOUT_MS: limit(10000), // délai maximal d'un envoi vers un service push
3a246ad:lib/env.ts:117:    PUSH_SUBSCRIBE_PER_USER_HOUR: limit(20), // inscriptions d'appareils par compte et par heure
3a246ad:lib/env.ts:118:    PUSH_TEST_PER_USER_HOUR: limit(5), // notifications d'essai par compte et par heure
3a246ad:lib/env.ts:145:const OTHER_SECRETS = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_AUTH_HOOK_SECRET', 'CRON_SECRET', 'SAMIRPAY_SECRET_KEY', 'SAMIRPAY_API_KEY', 'VAPID_PRIVATE_KEY'] as const;
(code de sortie 0)

$ git grep -n -E 'addEventListener\('"'"'(fetch|push|notificationclick|pushsubscriptionchange)'"'"'|caches\.(open|match)' fff03b1 -- public/sw.js
fff03b1:public/sw.js:14:    caches.open(CACHE_NAME).then((cache) => {
fff03b1:public/sw.js:34:self.addEventListener('fetch', (event) => {
fff03b1:public/sw.js:47:      return caches.match(event.request).then((res) => {
fff03b1:public/sw.js:50:          return caches.match('/');
(code de sortie 0)

$ git grep -n -E 'addEventListener\('"'"'(fetch|push|notificationclick|pushsubscriptionchange)'"'"'|caches\.(open|match)' 3a246ad -- public/sw.js
3a246ad:public/sw.js:57:self.addEventListener('push', (event) => {
3a246ad:public/sw.js:81:self.addEventListener('notificationclick', (event) => {
3a246ad:public/sw.js:115:self.addEventListener('pushsubscriptionchange', (event) => {
(code de sortie 0)

$ git grep -n -E '"web-push"|"@types/web-push"' fff03b1 -- package.json
(code de sortie 1)

$ git grep -n -E '"web-push"|"@types/web-push"' 3a246ad -- package.json
3a246ad:package.json:39:    "web-push": "3.6.7",
3a246ad:package.json:49:    "@types/web-push": "3.6.4",
(code de sortie 0)
```

**Correctif** (commits `359d860`, `5ca1b1a`, `6279f2f` ; colonnes et tables en migrations `…02` et `…07`) :
- IN_APP : `notifications.channel` devient un texte contraint à `IN_APP` ; la ligne de la cloche est écrite par l'envoyeur, à partir du catalogue ;
- SMS : MTarget, un segment GSM-7 visé (section 10) ;
- EMAIL : sans `RESEND_API_KEY`, ligne SKIPPED `EMAIL_NOT_CONFIGURED`, un seul avertissement ; lien de désabonnement et en-tête `List-Unsubscribe` sur les familles optionnelles ;
- PUSH : `web-push` 3.6.7 épinglé pour le chiffrement seul, transport par notre `fetch` avec délai et liste blanche des services push ; sans VAPID, SKIPPED `PUSH_NOT_CONFIGURED` ; `push_subscriptions` (10 appareils au plus, 404 et 410 suppriment l'abonnement) ; demande d'autorisation au clic seulement ; détachement à la déconnexion ;
- service worker remplacé (décision de l'utilisateur) : sans cache ni `fetch`, il supprime les anciens caches `event-village-*`.

**parcours/notif-canaux**

Run 60 (avant correctif) :

```text
    not ok 1 - PASSWORD_CHANGED : une notification IN_APP (type, titre, contenu du catalogue, metadata), notification_id posé, une seule fois
        → insertOutboxRow {"type":"PASSWORD_CHANGED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":0,"max_attempts":5,"due_at":"2026-11-02T18:55:21.856Z","next_attempt_at":"2026-11-02T18:55:21.856Z","channel":"IN_APP","recipient_user_id":"a70fac37
        → +   code: 'PGRST205',
    not ok 2 - type lié à un événement (optionnel) : metadata = données du modèle + actionUrl /events/<id> + outbox_id ; préférence dans l’instantané
        → insertOutboxRow {"type":"EVENT_SUSPENDED_HOLDER","family":"OPTIONAL","origin":"OUTBOX","template_data":{"event_id":"a1ebab40-b859-4ac6-a75d-897922180e8e","title":"Gala de la Teranga","location":"CICAD","city":"Diamniadio","start_at":"2026-11-14T20:00:00.000Z"}
        → +   code: 'PGRST205',
not ok 1 - 6.2 IN_APP : la cloche est écrite par le marquage de l'envoyeur (contrat F1, E2, E4)
    not ok 1 - GSM-7 et UCS-2 : texte exact, un SMS, encodage et segments dans decision.delivery
        → insertOutboxRow {"type":"TRANSFER_CANCELLED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{"transfer_id":"98cac58f-91fe-4ba1-9503-05185e37906f","ticket_id":"842281d9-9d7a-4663-be6a-6a6a7c7e57d8","event_id":"a1ebab40-b859-4ac6-a75d-897922180e8e","titl
        → +   code: 'PGRST205',
not ok 2 - 6.2 SMS : encodage tracé par l'envoyeur (contrat F2, C3)
    not ok 1 - 2xx accepté (code 0) : SENT, identifiant du ticket ; la requête porte numéro MTarget et message
        → issue : {"success":true,"messageId":"T-ok-1","recipient":"00221771234567","rawResponse":{"results":[{"msisdn":"00221771234567","code":"0","reason":"ACCEPTED","ticket":"T-ok-1"}]}}
        → + undefined
    not ok 2 - 2xx avec un code MTarget de refus : REJECTED définitif
        → issue : {"success":false,"recipient":"00221771234567","error":"INVALID_MSISDN","rawResponse":{"results":[{"msisdn":"00221771234567","code":"102","reason":"INVALID_MSISDN"}]}}
        → + undefined
    not ok 3 - 2xx illisible (texte, ou JSON sans « results ») : UNCERTAIN, jamais compté comme envoyé
        → réponse illisible : {"success":true,"recipient":"00221771234567","rawResponse":"OK"}
        → + undefined
    not ok 4 - HTTP 429 et 500 : REJECTED à réessayer ; HTTP 400 : REJECTED définitif
        → HTTP 429 : {"success":false,"recipient":"00221771234567","error":"Erreur HTTP MTarget 429","rawResponse":{"error":"simulation"}}
        → + undefined
    not ok 5 - délai dépassé (MTARGET_TIMEOUT_MS) après l’envoi de la requête : UNCERTAIN, une seule requête, abandon dans le délai
        → l’adaptateur doit abandonner après MTARGET_TIMEOUT_MS (aucun délai aujourd’hui)
    not ok 6 - connexion coupée après l’envoi de la requête : UNCERTAIN
        → coupure après envoi : {"success":false,"recipient":"00221771234567","error":"fetch failed"}
        → + undefined
    not ok 7 - connexion refusée (rien n’est parti) : REJECTED à réessayer
        → connexion refusée : {"success":false,"recipient":"00221771234567","error":"fetch failed"}
        → + undefined
not ok 3 - 6.2 SMS : adaptateur MTarget réel contre un serveur HTTP local (contrat E6)
    not ok 1 - sans RESEND_API_KEY : SKIPPED EMAIL_NOT_CONFIGURED, aucun appel, un seul avertissement pour deux passages
        → insertOutboxRow {"type":"PASSWORD_CHANGED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":0,"max_attempts":5,"due_at":"2026-11-02T18:55:27.327Z","next_attempt_at":"2026-11-02T18:55:27.327Z","channel":"EMAIL","recipient_user_id":"7aef4e7b-
        → +   code: 'PGRST205',
    not ok 2 - adresse factice (<chiffres>@eventvillage.sn) du compte ou du destinataire : SKIPPED NO_REAL_EMAIL, aucun appel
        → insertOutboxRow {"type":"PASSWORD_CHANGED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":0,"max_attempts":5,"due_at":"2026-11-02T18:55:27.473Z","next_attempt_at":"2026-11-02T18:55:27.473Z","channel":"EMAIL","recipient_user_id":"17ea24b9-
        → +   code: 'PGRST205',
    not ok 3 - message indispensable : HTML échappé (titre <script>), version texte, bouton vers l’application, sans désabonnement, clé d’idempotence transmise
        → insertOutboxRow {"type":"PURCHASE_CONFIRMED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{"payment_id":"ee8eb414-a7ff-41ab-9c94-5287afe51bf3","ticket_count":2,"service_fee":100,"total":10100,"event_id":"a1ebab40-b859-4ac6-a75d-897922180e8e","title":
        → +   code: 'PGRST205',
    not ok 4 - famille optionnelle : pied « Ne plus recevoir ces emails » et en-tête List-Unsubscribe vers la page de préférences
        → insertOutboxRow {"type":"FIRST_TICKET_SOLD","family":"OPTIONAL","origin":"OUTBOX","template_data":{"event_id":"a1ebab40-b859-4ac6-a75d-897922180e8e","title":"Gala Dakar","location":"CICAD","city":"Diamniadio","start_at":"2026-11-14T20:00:00.000Z"},"attempts":0
        → +   code: 'PGRST205',
    not ok 5 - refus du fournisseur : à réessayer → relance dans 1 min ; définitif → FAILED EMAIL_REJECTED
        → insertOutboxRow {"type":"PASSWORD_CHANGED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":0,"max_attempts":5,"due_at":"2026-11-02T18:55:27.877Z","next_attempt_at":"2026-11-02T18:55:27.877Z","channel":"EMAIL","recipient_user_id":"43ee4561-
        → +   code: 'PGRST205',
not ok 4 - 6.2 EMAIL facultatif (contrat F3, E4)
    not ok 1 - sans VAPID : SKIPPED PUSH_NOT_CONFIGURED, aucun envoi, abonnement conservé, un avertissement au plus
        → abonnement push : Could not find the table 'public.push_subscriptions' in the schema cache (code PGRST205) — table push_subscriptions du contrat C5, migration 20261103000002
        → +   code: 'PGRST205',
    not ok 2 - aucun appareil : SKIPPED NO_PUSH_SUBSCRIPTION
        → insertOutboxRow {"type":"TICKET_SCANNED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{"ticket_id":"21a7fb3e-d7be-4c52-bfcb-14a70a46ebc8","event_id":"a1ebab40-b859-4ac6-a75d-897922180e8e","title":"Gala Dakar","location":"CICAD","city":"Diamniadio","s
        → +   code: 'PGRST205',
    not ok 3 - deux appareils : deux envois, une ligne SENT, charge exacte (titre, corps, lien, tag), TTL 24 h, urgence normale
        → abonnement push : Could not find the table 'public.push_subscriptions' in the schema cache (code PGRST205) — table push_subscriptions du contrat C5, migration 20261103000002
        → +   code: 'PGRST205',
    not ok 4 - 410 sur un appareil : abonnement supprimé, l’autre servi, ligne SENT
        → abonnement push : Could not find the table 'public.push_subscriptions' in the schema cache (code PGRST205) — table push_subscriptions du contrat C5, migration 20261103000002
        → +   code: 'PGRST205',
    not ok 5 - 404 sur le seul appareil : abonnement supprimé puis SKIPPED NO_PUSH_SUBSCRIPTION
        → abonnement push : Could not find the table 'public.push_subscriptions' in the schema cache (code PGRST205) — table push_subscriptions du contrat C5, migration 20261103000002
        → +   code: 'PGRST205',
    not ok 6 - 500, 429 puis délai dépassé : relances à 1, 5 et 15 min, abonnement conservé (failure_count), puis SENT
        → abonnement push : Could not find the table 'public.push_subscriptions' in the schema cache (code PGRST205) — table push_subscriptions du contrat C5, migration 20261103000002
        → +   code: 'PGRST205',
    not ok 7 - 413 → FAILED PUSH_PAYLOAD_TOO_LARGE ; 401 → FAILED PUSH_REJECTED ; abonnement conservé, aucune relance
        → abonnement push : Could not find the table 'public.push_subscriptions' in the schema cache (code PGRST205) — table push_subscriptions du contrat C5, migration 20261103000002
        → +   code: 'PGRST205',
    not ok 8 - clé VAPID changée : l’abonnement de l’ancienne clé est ignoré et supprimé, celui de la clé courante est servi
        → abonnement push : Could not find the table 'public.push_subscriptions' in the schema cache (code PGRST205) — table push_subscriptions du contrat C5, migration 20261103000002
        → +   code: 'PGRST205',
    not ok 9 - point d’arrivée hors liste blanche (inscrit sans passer par la route) : jamais appelé à l’envoi
        → abonnement push : Could not find the table 'public.push_subscriptions' in the schema cache (code PGRST205) — table push_subscriptions du contrat C5, migration 20261103000002
        → +   code: 'PGRST205',
    not ok 10 - annulation d’un événement : urgence haute, TTL 24 h, titre « Événement annulé », lien Mes billets
        → abonnement push : Could not find the table 'public.push_subscriptions' in the schema cache (code PGRST205) — table push_subscriptions du contrat C5, migration 20261103000002
        → +   code: 'PGRST205',
not ok 5 - 6.2 PUSH : envoi par l’envoyeur, faux adaptateur (contrat F4)
    not ok 1 - 201 : charge chiffrée aes128gcm déchiffrée à l’identique, en-tête VAPID valide, TTL et Urgency transmis
        → adaptateur push réel (contrat F4) absent : lib/push/web-push.adapter — Cannot find module '/home/runner/work/event-village/event-village/lib/push/web-push.adapter' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
    not ok 2 - statuts du service push : 202 ACCEPTED, 404/410 GONE, 413 TOO_LARGE, 429 (Retry-After) et 5xx RETRY, 400/401/403 REJECTED
        → adaptateur push réel (contrat F4) absent : lib/push/web-push.adapter — Cannot find module '/home/runner/work/event-village/event-village/lib/push/web-push.adapter' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
    not ok 3 - délai dépassé (PUSH_TIMEOUT_MS) : RETRY sans code HTTP, abandon dans le délai
        → adaptateur push réel (contrat F4) absent : lib/push/web-push.adapter — Cannot find module '/home/runner/work/event-village/event-village/lib/push/web-push.adapter' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
    not ok 4 - contrôles statiques : web-push 3.6.7 et @types/web-push 3.6.4 épinglés, generateRequestDetails seul, jamais sendNotification(
        → web-push épinglé à 3.6.7 (sans ^ ni ~)
        → + undefined
    not ok 5 - VAPID_PRIVATE_KEY parmi les secrets : réutilisée comme secret dédié, la configuration est refusée
        → getServerEnv doit refuser un secret dédié égal à VAPID_PRIVATE_KEY
not ok 6 - 6.2 PUSH : adaptateur réel (web-push pour le chiffrement, transport par fetch) contre un service local (contrat F4)
not ok 7 - /home/runner/work/event-village/event-village/tests/parcours/notif-canaux.test.ts
        → invariants (m)(n)(o) impossibles à vérifier (notif-canaux) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
# pass 0
# fail 30
```

Run 67 (après correctif) :

```text
    ok 1 - PASSWORD_CHANGED : une notification IN_APP (type, titre, contenu du catalogue, metadata), notification_id posé, une seule fois
    ok 2 - type lié à un événement (optionnel) : metadata = données du modèle + actionUrl /events/<id> + outbox_id ; préférence dans l’instantané
ok 1 - 6.2 IN_APP : la cloche est écrite par le marquage de l'envoyeur (contrat F1, E2, E4)
    ok 1 - GSM-7 et UCS-2 : texte exact, un SMS, encodage et segments dans decision.delivery
ok 2 - 6.2 SMS : encodage tracé par l'envoyeur (contrat F2, C3)
    ok 1 - 2xx accepté (code 0) : SENT, identifiant du ticket ; la requête porte numéro MTarget et message
    ok 2 - 2xx avec un code MTarget de refus : REJECTED définitif
    ok 3 - 2xx illisible (texte, ou JSON sans « results ») : UNCERTAIN, jamais compté comme envoyé
    ok 4 - HTTP 429 et 500 : REJECTED à réessayer ; HTTP 400 : REJECTED définitif
    ok 5 - délai dépassé (MTARGET_TIMEOUT_MS) après l’envoi de la requête : UNCERTAIN, une seule requête, abandon dans le délai
    ok 6 - connexion coupée après l’envoi de la requête : UNCERTAIN
    ok 7 - connexion refusée (rien n’est parti) : REJECTED à réessayer
ok 3 - 6.2 SMS : adaptateur MTarget réel contre un serveur HTTP local (contrat E6)
    ok 1 - sans RESEND_API_KEY : SKIPPED EMAIL_NOT_CONFIGURED, aucun appel, un seul avertissement pour deux passages
    ok 2 - adresse factice (<chiffres>@eventvillage.sn) du compte ou du destinataire : SKIPPED NO_REAL_EMAIL, aucun appel
    ok 3 - message indispensable : HTML échappé (titre <script>), version texte, bouton vers l’application, sans désabonnement, clé d’idempotence transmise
    ok 4 - famille optionnelle : pied « Ne plus recevoir ces emails » et en-tête List-Unsubscribe vers la page de préférences
    ok 5 - refus du fournisseur : à réessayer → relance dans 1 min ; définitif → FAILED EMAIL_REJECTED
ok 4 - 6.2 EMAIL facultatif (contrat F3, E4)
    ok 1 - sans VAPID : SKIPPED PUSH_NOT_CONFIGURED, aucun envoi, abonnement conservé, un avertissement au plus
    ok 2 - aucun appareil : SKIPPED NO_PUSH_SUBSCRIPTION
    ok 3 - deux appareils : deux envois, une ligne SENT, charge exacte (titre, corps, lien, tag), TTL 24 h, urgence normale
    ok 4 - 410 sur un appareil : abonnement supprimé, l’autre servi, ligne SENT
    ok 5 - 404 sur le seul appareil : abonnement supprimé puis SKIPPED NO_PUSH_SUBSCRIPTION
    ok 6 - 500, 429 puis délai dépassé : relances à 1, 5 et 15 min, abonnement conservé (failure_count), puis SENT
    ok 7 - 413 → FAILED PUSH_PAYLOAD_TOO_LARGE ; 401 → FAILED PUSH_REJECTED ; abonnement conservé, aucune relance
    ok 8 - clé VAPID changée : l’abonnement de l’ancienne clé est ignoré et supprimé, celui de la clé courante est servi
    ok 9 - point d’arrivée hors liste blanche (inscrit sans passer par la route) : jamais appelé à l’envoi
    ok 10 - annulation d’un événement : urgence haute, TTL 24 h, titre « Événement annulé », lien Mes billets
ok 5 - 6.2 PUSH : envoi par l’envoyeur, faux adaptateur (contrat F4)
    ok 1 - 201 : charge chiffrée aes128gcm déchiffrée à l’identique, en-tête VAPID valide, TTL et Urgency transmis
    ok 2 - statuts du service push : 202 ACCEPTED, 404/410 GONE, 413 TOO_LARGE, 429 (Retry-After) et 5xx RETRY, 400/401/403 REJECTED
    ok 3 - délai dépassé (PUSH_TIMEOUT_MS) : RETRY sans code HTTP, abandon dans le délai
    ok 4 - contrôles statiques : web-push 3.6.7 et @types/web-push 3.6.4 épinglés, generateRequestDetails seul, jamais sendNotification(
    ok 5 - VAPID_PRIVATE_KEY parmi les secrets : réutilisée comme secret dédié, la configuration est refusée
ok 6 - 6.2 PUSH : adaptateur réel (web-push pour le chiffrement, transport par fetch) contre un service local (contrat F4)
# pass 30
# fail 0
```

**parcours/push-abonnements**

Run 60 (avant correctif) :

```text
    not ok 1 - session exigée ; sans VAPID : { enabled: false, publicKey: null } ; avec : la clé publique courante
        → route GET /api/push/config (contrat F4) absent : app/api/push/config/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/push/config/route' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.t
    not ok 2 - configuration partielle ou sujet invalide : canal désactivé (les trois variables ou aucune ; sujet mailto: ou https:)
        → route GET /api/push/config (contrat F4) absent : app/api/push/config/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/push/config/route' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.t
not ok 1 - 6.2 GET /api/push/config (contrat F4)
    not ok 1 - session exigée ; compte suspendu refusé ; canal désactivé → 409 PUSH_NOT_CONFIGURED, rien d'écrit
        → route POST /api/push/subscriptions (contrat F4) absent : app/api/push/subscriptions/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/push/subscriptions/route' imported from /home/runner/work/event-village/event-village/tests/pa
    not ok 2 - inscription valide : 200 { subscribed: true }, ligne au compte avec les clés, vapid_key_id courant et user_agent
        → route POST /api/push/subscriptions (contrat F4) absent : app/api/push/subscriptions/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/push/subscriptions/route' imported from /home/runner/work/event-village/event-village/tests/pa
    not ok 3 - clés envoyées en base64 standard avec « = » : enregistrées en base64url sans « = »
        → route POST /api/push/subscriptions (contrat F4) absent : app/api/push/subscriptions/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/push/subscriptions/route' imported from /home/runner/work/event-village/event-village/tests/pa
    not ok 4 - validation stricte du corps : 400 et rien d'écrit (champ inconnu, clés de mauvaise taille, point d'arrivée invalide ou trop long)
        → route POST /api/push/subscriptions (contrat F4) absent : app/api/push/subscriptions/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/push/subscriptions/route' imported from /home/runner/work/event-village/event-village/tests/pa
    not ok 5 - liste blanche des services push : refus 400 PUSH_ENDPOINT_REFUSED, services connus admis
        → route POST /api/push/subscriptions (contrat F4) absent : app/api/push/subscriptions/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/push/subscriptions/route' imported from /home/runner/work/event-village/event-village/tests/pa
    not ok 6 - PUSH_ENDPOINT_ALLOWED_ORIGINS remplace la liste : origine exacte, https://*.suffixe, http seulement en local
        → route POST /api/push/subscriptions (contrat F4) absent : app/api/push/subscriptions/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/push/subscriptions/route' imported from /home/runner/work/event-village/event-village/tests/pa
    not ok 7 - point d'arrivée déjà inscrit par un autre compte : réattribué au compte qui s'inscrit, une seule ligne, vapid_key_id courant
        → route POST /api/push/subscriptions (contrat F4) absent : app/api/push/subscriptions/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/push/subscriptions/route' imported from /home/runner/work/event-village/event-village/tests/pa
    not ok 8 - 10 appareils au plus par compte : le onzième remplace le plus ancien
        → route POST /api/push/subscriptions (contrat F4) absent : app/api/push/subscriptions/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/push/subscriptions/route' imported from /home/runner/work/event-village/event-village/tests/pa
    not ok 9 - quota PUSH_SUBSCRIBE_PER_USER_HOUR : au-delà → 429, rien d'écrit
        → route POST /api/push/subscriptions (contrat F4) absent : app/api/push/subscriptions/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/push/subscriptions/route' imported from /home/runner/work/event-village/event-village/tests/pa
not ok 2 - 6.2 POST /api/push/subscriptions : inscription d'un appareil (contrat F4, C5)
    not ok 1 - un autre compte ne supprime rien ({ removed: false }) ; le propriétaire supprime ({ removed: true }) ; session exigée
        → route POST /api/push/subscriptions (contrat F4) absent : app/api/push/subscriptions/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/push/subscriptions/route' imported from /home/runner/work/event-village/event-village/tests/pa
not ok 3 - 6.2 DELETE /api/push/subscriptions : désinscription par le propriétaire seulement (contrat F4)
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/push-abonnements.test.ts
        → invariants (m)(n)(o) impossibles à vérifier (push-abonnements) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
# pass 0
# fail 12
```

Run 67 (après correctif) :

```text
    ok 1 - session exigée ; sans VAPID : { enabled: false, publicKey: null } ; avec : la clé publique courante
    ok 2 - configuration partielle ou sujet invalide : canal désactivé (les trois variables ou aucune ; sujet mailto: ou https:)
ok 1 - 6.2 GET /api/push/config (contrat F4)
    ok 1 - session exigée ; compte suspendu refusé ; canal désactivé → 409 PUSH_NOT_CONFIGURED, rien d'écrit
    ok 2 - inscription valide : 200 { subscribed: true }, ligne au compte avec les clés, vapid_key_id courant et user_agent
    ok 3 - clés envoyées en base64 standard avec « = » : enregistrées en base64url sans « = »
    ok 4 - validation stricte du corps : 400 et rien d'écrit (champ inconnu, clés de mauvaise taille, point d'arrivée invalide ou trop long)
    ok 5 - liste blanche des services push : refus 400 PUSH_ENDPOINT_REFUSED, services connus admis
    ok 6 - PUSH_ENDPOINT_ALLOWED_ORIGINS remplace la liste : origine exacte, https://*.suffixe, http seulement en local
    ok 7 - point d'arrivée déjà inscrit par un autre compte : réattribué au compte qui s'inscrit, une seule ligne, vapid_key_id courant
    ok 8 - 10 appareils au plus par compte : le onzième remplace le plus ancien
    ok 9 - quota PUSH_SUBSCRIBE_PER_USER_HOUR : au-delà → 429, rien d'écrit
ok 2 - 6.2 POST /api/push/subscriptions : inscription d'un appareil (contrat F4, C5)
    ok 1 - un autre compte ne supprime rien ({ removed: false }) ; le propriétaire supprime ({ removed: true }) ; session exigée
ok 3 - 6.2 DELETE /api/push/subscriptions : désinscription par le propriétaire seulement (contrat F4)
# pass 12
# fail 0
```

**parcours/push-service-worker**

Run 60 (avant correctif) :

```text
    not ok 1 - aucun écouteur fetch, aucun cache ni importScripts ; écouteurs install, activate, push, notificationclick, pushsubscriptionchange
        → aucun gestionnaire fetch : le réseau n’est jamais intercepté
        → 1 !== 0
    not ok 2 - install : skipWaiting ; activate : supprime les seuls caches event-village-* puis clients.claim()
        → aucun cache ouvert à l’installation
        → 1 !== 0
    not ok 3 - push JSON valide : showNotification(titre, { body, tag, data.url, icon, badge }) exact
        → une notification affichée
        → 0 !== 1
    not ok 4 - push illisible ou sans charge : notification générique (titre, texte, /notifications, tag event-village)
        → une notification est toujours affichée (userVisibleOnly)
        → 0 !== 1
    not ok 5 - notificationclick : lien interne ouvert dans une nouvelle fenêtre quand aucun onglet n’est ouvert ; notification fermée
        → notification fermée
        → 0 !== 1
    not ok 6 - notificationclick : lien externe, //hôte, javascript: ou absent → /notifications
        → lien https://evil.example/phishing → /notifications
        → + []
    not ok 7 - notificationclick : un onglet de l’application est ouvert → focus() puis navigate(), aucune nouvelle fenêtre
        → onglet existant mis au premier plan
        → 0 !== 1
    not ok 8 - pushsubscriptionchange : clé lue par GET /api/push/config, réabonnement userVisibleOnly, POST /api/push/subscriptions
        → Expected values to be strictly deep-equal:
        → + []
    not ok 9 - pushsubscriptionchange : échec de la configuration journalisé, aucun abonnement envoyé
        → échec journalisé : {"log":[],"warn":[],"error":[]}
not ok 1 - 6.2 public/sw.js remplacé : sans cache ni fetch, push et clics (contrat F5, décision 3)
    not ok 1 - `load` déjà passé (readyState complete) : enregistrement immédiat de /sw.js, sans console.log
        → enregistré sans attendre un `load` qui ne viendra plus
        → + []
    not ok 2 - page en cours de chargement : enregistrement sur `load` { once: true }, pas avant
        → écouteur { once: true }
        → + undefined
    not ok 3 - échec de l’enregistrement : console.warn, aucun console.log ni console.error
        → enregistrement tenté tout de suite (`load` déjà passé)
        → 0 !== 1
not ok 2 - 6.2 ServiceWorkerRegister : enregistrement fiable (contrat F5)
    not ok 1 - currentPushState : unsupported, denied, unavailable, enabled, disabled — sans jamais demander l’autorisation ni s’abonner
        → client push du navigateur (contrat F4) absent : lib/push/client — Cannot find module '/home/runner/work/event-village/event-village/lib/push/client' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
    not ok 2 - enablePush (geste de l’utilisateur) : une demande d’autorisation, abonnement userVisibleOnly avec la clé publique, POST de l’abonnement
        → client push du navigateur (contrat F4) absent : lib/push/client — Cannot find module '/home/runner/work/event-village/event-village/lib/push/client' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
    not ok 3 - enablePush refusé par l’utilisateur : aucun abonnement, rien envoyé au serveur
        → client push du navigateur (contrat F4) absent : lib/push/client — Cannot find module '/home/runner/work/event-village/event-village/lib/push/client' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
    not ok 4 - detachPushSubscription : DELETE serveur puis unsubscribe() ; échec réseau journalisé sans lever (la déconnexion continue)
        → client push du navigateur (contrat F4) absent : lib/push/client — Cannot find module '/home/runner/work/event-village/event-village/lib/push/client' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
not ok 3 - 6.2 lib/push/client.ts : autorisation demandée seulement par enablePush (contrat F4)
    not ok 1 - Notification.requestPermission seulement dans lib/push/client.ts (enablePush) ; pushManager.subscribe seulement dans lib/push/client.ts et public/sw.js ; rien dans un useEffect
        → lib/push/client.ts absent (contrat F4)
not ok 4 - 6.2 Contrôles statiques : autorisation seulement après un geste (consigne 6.2, contrat F4)
not ok 5 - /home/runner/work/event-village/event-village/tests/parcours/push-service-worker.test.ts
        → invariants (m)(n)(o) impossibles à vérifier (push-service-worker) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
# pass 0
# fail 17
```

Run 67 (après correctif) :

```text
    ok 1 - aucun écouteur fetch, aucun cache ni importScripts ; écouteurs install, activate, push, notificationclick, pushsubscriptionchange
    ok 2 - install : skipWaiting ; activate : supprime les seuls caches event-village-* puis clients.claim()
    ok 3 - push JSON valide : showNotification(titre, { body, tag, data.url, icon, badge }) exact
    ok 4 - push illisible ou sans charge : notification générique (titre, texte, /notifications, tag event-village)
    ok 5 - notificationclick : lien interne ouvert dans une nouvelle fenêtre quand aucun onglet n’est ouvert ; notification fermée
    ok 6 - notificationclick : lien externe, //hôte, javascript: ou absent → /notifications
    ok 7 - notificationclick : un onglet de l’application est ouvert → focus() puis navigate(), aucune nouvelle fenêtre
    ok 8 - pushsubscriptionchange : clé lue par GET /api/push/config, réabonnement userVisibleOnly, POST /api/push/subscriptions
    ok 9 - pushsubscriptionchange : échec de la configuration journalisé, aucun abonnement envoyé
ok 1 - 6.2 public/sw.js remplacé : sans cache ni fetch, push et clics (contrat F5, décision 3)
    ok 1 - `load` déjà passé (readyState complete) : enregistrement immédiat de /sw.js, sans console.log
    ok 2 - page en cours de chargement : enregistrement sur `load` { once: true }, pas avant
    ok 3 - échec de l’enregistrement : console.warn, aucun console.log ni console.error
ok 2 - 6.2 ServiceWorkerRegister : enregistrement fiable (contrat F5)
    ok 1 - currentPushState : unsupported, denied, unavailable, enabled, disabled — sans jamais demander l’autorisation ni s’abonner
    ok 2 - enablePush (geste de l’utilisateur) : une demande d’autorisation, abonnement userVisibleOnly avec la clé publique, POST de l’abonnement
    ok 3 - enablePush refusé par l’utilisateur : aucun abonnement, rien envoyé au serveur
    ok 4 - detachPushSubscription : DELETE serveur puis unsubscribe() ; échec réseau journalisé sans lever (la déconnexion continue)
ok 3 - 6.2 lib/push/client.ts : autorisation demandée seulement par enablePush (contrat F4)
    ok 1 - Notification.requestPermission seulement dans lib/push/client.ts (enablePush) ; pushManager.subscribe seulement dans lib/push/client.ts et public/sw.js ; rien dans un useEffect
ok 4 - 6.2 Contrôles statiques : autorisation seulement après un geste (consigne 6.2, contrat F4)
# pass 17
# fail 0
```

### 6.3 — Modèles de messages

```text
$ git ls-tree --name-only fff03b1 -- lib/notifications/
lib/notifications/channels.ts
lib/notifications/notification-types.ts
lib/notifications/notification.service.ts
(code de sortie 0)

$ git ls-tree --name-only 3a246ad -- lib/notifications/
lib/notifications/action-url.ts
lib/notifications/catalog-types.ts
lib/notifications/catalog.ts
lib/notifications/channels.ts
lib/notifications/dispatcher.ts
lib/notifications/email-layout.ts
lib/notifications/notification-types.ts
lib/notifications/outbox-labels.ts
lib/notifications/reminders.ts
lib/notifications/sms-format.ts
lib/notifications/sync-log.ts
(code de sortie 0)
```

**Correctif** (commit `1e14575`) : `lib/notifications/catalog.ts` (titre, SMS, push, email, lien interne par type ; 67 types, égaux au registre SQL), `sms-format.ts` (heure de Dakar, montants à espace simple dans les SMS), `email-layout.ts` (échappement, désabonnement), `action-url.ts` (liens internes seulement). Aucun SMS ne contient de QR, de code ni de jeton.

**parcours/notif-modeles**

Run 60 (avant correctif) :

```text
    not ok 1 - NOTIFICATION_CATALOG contient exactement les types de G2, chacun avec ses attributs
        → catalogue des modèles (contrat G1) absent : lib/notifications/catalog — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/catalog' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
    not ok 2 - public.notification_types = NOTIFICATION_CATALOG (type, famille, sujet, canaux, audience, politique, journal, permission)
        → catalogue des modèles (contrat G1) absent : lib/notifications/catalog — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/catalog' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
    not ok 3 - chaque type rend chaque canal qu'il déclare (sample), sans variable manquante ni valeur JS affichée
        → catalogue des modèles (contrat G1) absent : lib/notifications/catalog — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/catalog' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
    not ok 4 - renderNotification lève TemplateDataError quand une variable obligatoire manque, et rend le même texte que le catalogue
        → catalogue des modèles (contrat G1) absent : lib/notifications/catalog — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/catalog' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
    not ok 5 - liens : chemin interne de G2 (« / », jamais « // » ni schéma), avec l'identifiant du sample
        → catalogue des modèles (contrat G1) absent : lib/notifications/catalog — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/catalog' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
not ok 1 - 6.3 Catalogue : registre SQL = catalogue TS = table G2 (contrat C1, G1, G2)
    not ok 1 - titres in-app exacts (G4) ; variables in-app non tronquées (titre complet de l'événement)
        → catalogue des modèles (contrat G1) absent : lib/notifications/catalog — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/catalog' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
    not ok 2 - contenus in-app exacts pour des valeurs courtes (G4)
        → catalogue des modèles (contrat G1) absent : lib/notifications/catalog — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/catalog' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
    not ok 3 - push : titre = titre in-app, corps = contenu in-app (tronqué à 160 caractères au plus)
        → catalogue des modèles (contrat G1) absent : lib/notifications/catalog — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/catalog' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
    not ok 4 - email : sujet « {titre} — Event Village », corps = contenu in-app, bouton vers l'application, désabonnement des seules familles optionnelles
        → catalogue des modèles (contrat G1) absent : lib/notifications/catalog — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/catalog' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
    not ok 5 - email : toute variable est échappée dans le HTML (balise, &, guillemets), la version texte garde la valeur
        → catalogue des modèles (contrat G1) absent : lib/notifications/catalog — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/catalog' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
not ok 2 - 6.3 Catalogue : in-app, push et email (contrat G4, F3)
    not ok 1 - chaque SMS tient en un SMS GSM-7 (≤ 160) avec les valeurs maximales réalistes de G3 et une URL de 27 caractères
        → catalogue des modèles (contrat G1) absent : lib/notifications/catalog — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/catalog' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
    not ok 2 - texte fixe en GSM-7 de base : rendu avec des valeurs ASCII, aucun caractère interdit (« » ’ ° ç ê â ô î û ï ë œ, espaces insécables)
        → catalogue des modèles (contrat G1) absent : lib/notifications/catalog — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/catalog' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
    not ok 3 - variable non translittérable (autres écritures) : SMS UCS-2 de 3 segments au plus
        → catalogue des modèles (contrat G1) absent : lib/notifications/catalog — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/catalog' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
    not ok 4 - textes exacts G3 pour des valeurs courtes
        → catalogue des modèles (contrat G1) absent : lib/notifications/catalog — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/catalog' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
    not ok 5 - OTP et invitation (renderSyncSms) : textes actuels inchangés, le code n'est jamais stocké ; l'invitation seule sur 2 segments
        → catalogue des modèles (contrat G1) absent : lib/notifications/catalog — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/catalog' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
not ok 3 - 6.3 Catalogue : SMS (contrat F2, G3)
    not ok 1 - montants : smsAmount avec espace simple, formatFcfa (in-app, push, email) avec U+00A0
        → formats des SMS (contrat F2.2) absent : lib/notifications/sms-format — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/sms-format' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
    not ok 2 - dates des SMS à l'heure de Dakar : jours et mois du contrat, « aout », heure sur 24 h
        → formats des SMS (contrat F2.2) absent : lib/notifications/sms-format — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/sms-format' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
    not ok 3 - smsSegments : encodage et segments conformes à GSM 03.38 (calcul indépendant)
        → formats des SMS (contrat F2.2) absent : lib/notifications/sms-format — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/sms-format' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
    not ok 4 - smsVar : translittération vers GSM-7, espaces repliés, troncature avec « ... » au maximum indiqué
        → formats des SMS (contrat F2.2) absent : lib/notifications/sms-format — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/sms-format' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
not ok 4 - 6.3 Formats partagés (contrat F2.2, G1)
not ok 5 - /home/runner/work/event-village/event-village/tests/parcours/notif-modeles.test.ts
        → invariants (m)(n)(o) impossibles à vérifier (notif-modeles) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
# pass 0
# fail 19
```

Run 67 (après correctif) :

```text
    ok 1 - NOTIFICATION_CATALOG contient exactement les types de G2, chacun avec ses attributs
    ok 2 - public.notification_types = NOTIFICATION_CATALOG (type, famille, sujet, canaux, audience, politique, journal, permission)
    ok 3 - chaque type rend chaque canal qu'il déclare (sample), sans variable manquante ni valeur JS affichée
    ok 4 - renderNotification lève TemplateDataError quand une variable obligatoire manque, et rend le même texte que le catalogue
    ok 5 - liens : chemin interne de G2 (« / », jamais « // » ni schéma), avec l'identifiant du sample
ok 1 - 6.3 Catalogue : registre SQL = catalogue TS = table G2 (contrat C1, G1, G2)
    ok 1 - titres in-app exacts (G4) ; variables in-app non tronquées (titre complet de l'événement)
    ok 2 - contenus in-app exacts pour des valeurs courtes (G4)
    ok 3 - push : titre = titre in-app, corps = contenu in-app (tronqué à 160 caractères au plus)
    ok 4 - email : sujet « {titre} — Event Village », corps = contenu in-app, bouton vers l'application, désabonnement des seules familles optionnelles
    ok 5 - email : toute variable est échappée dans le HTML (balise, &, guillemets), la version texte garde la valeur
ok 2 - 6.3 Catalogue : in-app, push et email (contrat G4, F3)
    ok 1 - chaque SMS tient en un SMS GSM-7 (≤ 160) avec les valeurs maximales réalistes de G3 et une URL de 27 caractères
    ok 2 - texte fixe en GSM-7 de base : rendu avec des valeurs ASCII, aucun caractère interdit (« » ’ ° ç ê â ô î û ï ë œ, espaces insécables)
    ok 3 - variable non translittérable (autres écritures) : SMS UCS-2 de 3 segments au plus
    ok 4 - textes exacts G3 pour des valeurs courtes
    ok 5 - OTP et invitation (renderSyncSms) : textes actuels inchangés, le code n'est jamais stocké ; l'invitation seule sur 2 segments
ok 3 - 6.3 Catalogue : SMS (contrat F2, G3)
    ok 1 - montants : smsAmount avec espace simple, formatFcfa (in-app, push, email) avec U+00A0
    ok 2 - dates des SMS à l'heure de Dakar : jours et mois du contrat, « aout », heure sur 24 h
    ok 3 - smsSegments : encodage et segments conformes à GSM 03.38 (calcul indépendant)
    ok 4 - smsVar : translittération vers GSM-7, espaces repliés, troncature avec « ... » au maximum indiqué
ok 4 - 6.3 Formats partagés (contrat F2.2, G1)
# pass 19
# fail 0
```

### 6.4 — Préférences de l'utilisateur

```text
$ git ls-tree -r --name-only fff03b1 -- app/profile/notifications app/api/notifications/preferences app/api/notifications/essai-push app/api/notifications/test-push
(code de sortie 0)

$ git ls-tree -r --name-only 3a246ad -- app/profile/notifications app/api/notifications/preferences app/api/notifications/essai-push app/api/notifications/test-push
app/api/notifications/essai-push/route.ts
app/api/notifications/preferences/route.ts
app/profile/notifications/page.tsx
(code de sortie 0)

$ git grep -c -E notification_preferences fff03b1 -- supabase/migrations
(code de sortie 1)

$ git grep -c -E notification_preferences 3a246ad -- supabase/migrations
3a246ad:supabase/migrations/20261103000002_lot6_outbox.sql:9
(code de sortie 0)
```

**Correctif** (RPC en migration `…02` ; commits `272b3b4`, `fb0c3b0`) : familles INDISPENSABLE et OPTIONNELLE ; préférence désactivée = SKIPPED `PREFERENCE_DISABLED` à l'insertion et revérifiée à l'envoi ; routes `GET`/`PUT /api/notifications/preferences` ; page `app/profile/notifications/page.tsx` avec l'état du push sur l'appareil (activé, refusé, non pris en charge, indisponible) et le bouton d'essai (`POST /api/notifications/essai-push`, quota de 5 par heure).

**parcours/notif-preferences**

Run 60 (avant correctif) :

```text
    not ok 1 - client : sujets « Rappels avant l’événement » et « Changements d’un événement », 4 canaux activés, indispensables listés, pas d’« Activité de vos ventes »
        → GET /api/notifications/preferences (contrat H2) absent : app/api/notifications/preferences/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/notifications/preferences/route' imported from /home/runner/work/event-village/event-vi
    not ok 2 - partenaire : « Activité de vos ventes » en plus ; RPC notification_preferences_get : is_partner
        → GET /api/notifications/preferences (contrat H2) absent : app/api/notifications/preferences/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/notifications/preferences/route' imported from /home/runner/work/event-village/event-vi
not ok 1 - 6.4 Préférences : lecture, défauts et indispensables (H1, H2)
    not ok 1 - PUT REMINDERS/SMS désactivé puis réactivé : seul ce canal change, ligne notification_preferences
        → PUT /api/notifications/preferences (contrat H2) absent : app/api/notifications/preferences/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/notifications/preferences/route' imported from /home/runner/work/event-village/event-vi
    not ok 2 - sujet inconnu, canal inconnu, valeur non booléenne, indispensable → 400 INVALID_PREFERENCE, aucune écriture
        → PUT /api/notifications/preferences (contrat H2) absent : app/api/notifications/preferences/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/notifications/preferences/route' imported from /home/runner/work/event-village/event-vi
    not ok 3 - statut du compte : EN_ATTENTE admis (lecture et écriture) ; SUSPENDU 403 ; sans session 401
        → GET /api/notifications/preferences (contrat H2) absent : app/api/notifications/preferences/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/notifications/preferences/route' imported from /home/runner/work/event-village/event-vi
not ok 2 - 6.4 Préférences : écriture et refus (H1, H2)
    not ok 1 - à l’insertion : SMS SKIPPED PREFERENCE_DISABLED (stage ENQUEUE) ; autres canaux en attente ; préférence d’un autre sujet sans effet
        → test did not finish before its parent and was cancelled
    not ok 2 - à l’envoi : préférence coupée après la planification → SKIPPED PREFERENCE_DISABLED (stage CLAIM), aucun SMS ; témoin : un SMS
        → test did not finish before its parent and was cancelled
not ok 3 - 6.4 Préférence désactivée → SKIPPED PREFERENCE_DISABLED, jamais une absence (rappel J-1)
        → PUT /api/notifications/preferences (contrat H2) absent : app/api/notifications/preferences/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/notifications/preferences/route' imported from /home/runner/work/event-village/event-vi
    not ok 1 - tous les optionnels coupés : l’achat crée sa confirmation sans PREFERENCE_DISABLED et le SMS part
        → PUT /api/notifications/preferences (contrat H2) absent : app/api/notifications/preferences/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/notifications/preferences/route' imported from /home/runner/work/event-village/event-vi
not ok 4 - 6.4 Indispensables : toujours envoyés, quelles que soient les préférences (H1)
    not ok 1 - sans appareil : 409 NO_PUSH_SUBSCRIPTION, message exact, aucune ligne
        → POST /api/notifications/test-push (contrat H3) absent : app/api/notifications/test-push/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/notifications/test-push/route' imported from /home/runner/work/event-village/event-village
    not ok 2 - avec appareil : 202, une ligne PUSH_TEST à la minute (double clic dédoublonné), aucun envoi depuis la route, push remis par l’envoyeur
        → abonnement push : Could not find the table 'public.push_subscriptions' in the schema cache (code PGRST205) — table push_subscriptions du contrat C5
        → +   code: 'PGRST205',
    not ok 3 - quota PUSH_TEST_PER_USER_HOUR : 429 au-delà, par compte (un autre compte n’est pas touché)
        → abonnement push : Could not find the table 'public.push_subscriptions' in the schema cache (code PGRST205) — table push_subscriptions du contrat C5
        → +   code: 'PGRST205',
not ok 5 - 6.4 Bouton d’essai du push (H3)
not ok 6 - /home/runner/work/event-village/event-village/tests/parcours/notif-preferences.test.ts
        → invariants (m)(n)(o) impossibles à vérifier (notif-preferences) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
# pass 0
# fail 9
```

Run 67 (après correctif) :

```text
    ok 1 - client : sujets « Rappels avant l’événement » et « Changements d’un événement », 4 canaux activés, indispensables listés, pas d’« Activité de vos ventes »
    ok 2 - partenaire : « Activité de vos ventes » en plus ; RPC notification_preferences_get : is_partner
ok 1 - 6.4 Préférences : lecture, défauts et indispensables (H1, H2)
    ok 1 - PUT REMINDERS/SMS désactivé puis réactivé : seul ce canal change, ligne notification_preferences
    ok 2 - sujet inconnu, canal inconnu, valeur non booléenne, indispensable → 400 INVALID_PREFERENCE, aucune écriture
    ok 3 - statut du compte : EN_ATTENTE admis (lecture et écriture) ; SUSPENDU 403 ; sans session 401
ok 2 - 6.4 Préférences : écriture et refus (H1, H2)
    ok 1 - à l’insertion : SMS SKIPPED PREFERENCE_DISABLED (stage ENQUEUE) ; autres canaux en attente ; préférence d’un autre sujet sans effet
    ok 2 - à l’envoi : préférence coupée après la planification → SKIPPED PREFERENCE_DISABLED (stage CLAIM), aucun SMS ; témoin : un SMS
ok 3 - 6.4 Préférence désactivée → SKIPPED PREFERENCE_DISABLED, jamais une absence (rappel J-1)
    ok 1 - tous les optionnels coupés : l’achat crée sa confirmation sans PREFERENCE_DISABLED et le SMS part
ok 4 - 6.4 Indispensables : toujours envoyés, quelles que soient les préférences (H1)
    ok 1 - sans appareil : 409 NO_PUSH_SUBSCRIPTION, message exact, aucune ligne
    ok 2 - avec appareil : 202, une ligne PUSH_TEST à la minute (double clic dédoublonné), aucun envoi depuis la route, push remis par l’envoyeur
    ok 3 - quota PUSH_TEST_PER_USER_HOUR : 429 au-delà, par compte (un autre compte n’est pas touché)
ok 5 - 6.4 Bouton d’essai du push (H3)
# pass 11
# fail 0
```

### 6.5 — Rappels J-1 et H-3

```text
$ git grep -c -E ''"'"'notif\.[a-z0-9_]+'"'"'' fff03b1 -- supabase/migrations
(code de sortie 1)

$ git grep -c -E ''"'"'notif\.[a-z0-9_]+'"'"'' 3a246ad -- supabase/migrations
3a246ad:supabase/migrations/20261103000002_lot6_outbox.sql:4
3a246ad:supabase/migrations/20261103000003_lot6_reglages.sql:18
3a246ad:supabase/migrations/20261103000004_lot6_rappels.sql:8
3a246ad:supabase/migrations/20261103000008_lot6_supervision.sql:4
(code de sortie 0)

$ git grep -n -E 'CREATE OR REPLACE FUNCTION public\.notification_reminders_schedule' fff03b1 -- supabase/migrations
(code de sortie 1)

$ git grep -n -E 'CREATE OR REPLACE FUNCTION public\.notification_reminders_schedule' 3a246ad -- supabase/migrations
3a246ad:supabase/migrations/20261103000004_lot6_rappels.sql:34:CREATE OR REPLACE FUNCTION public.notification_reminders_schedule(p jsonb)
(code de sortie 0)
```

**Correctif** (migrations `…03` et `…04`, commits `21598da`, `647e966`) :
- 9 réglages `notif.*` historisés, bornés par `fin_setting_valid`, modifiables par un SUPERADMIN seulement (politique, `/api/admin/pricing`, route des réglages) : `notif.reminder_j1_enabled` (true), `notif.reminder_j1_hour` (10, de 6 à 20), `notif.reminder_h3_enabled` (true), `notif.reminder_h3_hours` (3, de 1 à 12), `notif.j1_sms` (ALWAYS), `notif.h3_sms` (IF_NO_PUSH), `notif.sms_quiet_start` (22), `notif.sms_quiet_end` (8), `notif.sms_daily_alert` (2 000) ;
- RPC `notification_reminders_schedule` (idempotente, tolérance de 15 min, pas de rattrapage, une ligne par compte, par événement, par type et par canal ; clé avec le début de l'événement) et route `/api/cron/reminders` ;
- rappels PENDING annulés dans la transaction de la cause : triggers sur `event_status_history` (SUSPENDU, ANNULE, TERMINE), sur `events` (changement de date) et sur `tickets` (changement de porteur) ;
- rappel du contrôleur la veille à 18 h.

**parcours/notif-reglages**

Run 60 (avant correctif) :

```text
    not ok 1 - les 9 clés notif.* existent avec leur valeur par défaut et une description
        → clés notif.* en base : [] (migration 20261103000003 attendue)
        → + []
    not ok 2 - finance_setting_set (SUPERADMIN) : chaque valeur admise par le contrat est appliquée
        → réglage notif.reminder_j1_enabled absent de platform_settings (contrat I1, migration 20261103000003)
    not ok 3 - finance_setting_set (SUPERADMIN) : chaque valeur hors bornes ou de mauvais type → INVALID_VALUE, sans effet ni historique
        → réglage notif.reminder_j1_enabled absent de platform_settings (contrat I1, migration 20261103000003)
    not ok 4 - notif_in_quiet_hours : 22 h - 8 h passe minuit, début = fin est une plage vide, plage dans la journée
        → public.notif_in_quiet_hours(timestamptz, integer, integer) absente (contrat D, migration 20261103000002)
        → false !== true
    not ok 5 - finance_setting_set : ADMIN refusé (FORBIDDEN, message du contrat), clé notif.* inconnue refusée (UNKNOWN_KEY), sans effet
        → réglage notif.reminder_h3_hours absent de platform_settings (contrat I1, migration 20261103000003)
    not ok 6 - historique : ancienne et nouvelle valeur, auteur et motif de chaque modification
        → réglage notif.reminder_j1_hour absent de platform_settings (contrat I1, migration 20261103000003)
not ok 1 - 6.5 Réglages notif.* (contrat I1)
    not ok 1 - GET : l’ADMIN et le SUPERADMIN lisent les 9 clés notif.* et leur historique
        → réglage notif.sms_daily_alert absent de platform_settings (contrat I1, migration 20261103000003)
    not ok 2 - PUT : 403 pour l’ADMIN (sans effet) ; 200 pour le SUPERADMIN, pour un entier, un booléen et un choix, valeur appliquée et historisée
        → réglage notif.reminder_j1_enabled absent de platform_settings (contrat I1, migration 20261103000003)
    not ok 3 - PUT SUPERADMIN : valeur hors bornes (400 INVALID_VALUE) et clé notif.* inconnue (400) refusées, sans effet
        → réglage notif.reminder_j1_enabled absent de platform_settings (contrat I1, migration 20261103000003)
    not ok 4 - POST /api/admin/pricing : un ADMIN qui a pricing.manage n’écrit ni ne crée de clé notif.* (403 NOTIF_SETTING, sans effet)
        → notif.reminder_h3_hours par /api/admin/pricing : HTTP 200 {"success":true,"key":"notif.reminder_h3_hours","message":"Grille tarifaire \"notif.reminder_h3_hours\" mise à jour avec succès."}
        → 200 !== 403
    not ok 5 - page /admin/finance-settings : 9 libellés exacts, choix en français, section « Notifications » (contrôle statique)
        → notif.reminder_j1_enabled : aucune entrée META dans la page des réglages
not ok 2 - 6.5 Route /api/admin/finance-settings et refus de /api/admin/pricing (contrat I1.6)
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/notif-reglages.test.ts
        → invariants (m)(n)(o) impossibles à vérifier (notif-reglages) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
# pass 0
# fail 11
```

Run 67 (après correctif) :

```text
    ok 1 - les 9 clés notif.* existent avec leur valeur par défaut et une description
    ok 2 - finance_setting_set (SUPERADMIN) : chaque valeur admise par le contrat est appliquée
    ok 3 - finance_setting_set (SUPERADMIN) : chaque valeur hors bornes ou de mauvais type → INVALID_VALUE, sans effet ni historique
    ok 4 - notif_in_quiet_hours : 22 h - 8 h passe minuit, début = fin est une plage vide, plage dans la journée
    ok 5 - finance_setting_set : ADMIN refusé (FORBIDDEN, message du contrat), clé notif.* inconnue refusée (UNKNOWN_KEY), sans effet
    ok 6 - historique : ancienne et nouvelle valeur, auteur et motif de chaque modification
ok 1 - 6.5 Réglages notif.* (contrat I1)
    ok 1 - GET : l’ADMIN et le SUPERADMIN lisent les 9 clés notif.* et leur historique
    ok 2 - PUT : 403 pour l’ADMIN (sans effet) ; 200 pour le SUPERADMIN, pour un entier, un booléen et un choix, valeur appliquée et historisée
    ok 3 - PUT SUPERADMIN : valeur hors bornes (400 INVALID_VALUE) et clé notif.* inconnue (400) refusées, sans effet
    ok 4 - POST /api/admin/pricing : un ADMIN qui a pricing.manage n’écrit ni ne crée de clé notif.* (403 NOTIF_SETTING, sans effet)
    ok 5 - page /admin/finance-settings : 9 libellés exacts, choix en français, section « Notifications » (contrôle statique)
ok 2 - 6.5 Route /api/admin/finance-settings et refus de /api/admin/pricing (contrat I1.6)
# pass 11
# fail 0
```

**security/r22-reglages-notif**

Run 60 (avant correctif) :

```text
    not ok 1 - un ADMIN ne modifie aucune des 9 clés notif.* par REST (update ni upsert)
        → notif.reminder_j1_enabled absente : le lot 6 crée les clés notif.* (migration 20261103000003)
    not ok 2 - un ADMIN et un SUPERADMIN ne créent pas de clé notif.* par REST
        → création de notif.r22_615feddf7401 par un ADMIN : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 3 - un ADMIN ne supprime pas de clé notif.* par REST
        → notif.reminder_h3_hours absente : le lot 6 crée les clés notif.* (migration 20261103000003)
not ok 1 - R22 — réglages des notifications
# pass 0
# fail 3
```

Run 67 (après correctif) :

```text
    ok 1 - un ADMIN ne modifie aucune des 9 clés notif.* par REST (update ni upsert)
    ok 2 - un ADMIN et un SUPERADMIN ne créent pas de clé notif.* par REST
    ok 3 - un ADMIN ne supprime pas de clé notif.* par REST
ok 1 - R22 — réglages des notifications
# pass 3
# fail 0
```

**parcours/notif-rappels**

Run 60 (avant correctif) :

```text
    not ok 1 - rien à 09:59 la veille ; à 10:00 une ligne par canal, clé avec le début, échéance 10:00 ; pas de H-3 à cette heure
        → planificateur des rappels (contrat I3) absent : lib/notifications/reminders — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/reminders' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helper
    not ok 2 - tolérance de 15 min : premier passage à 10:14 → créé (échéance 10:00) ; premier passage à 10:16 → rien, ni ensuite
        → planificateur des rappels (contrat I3) absent : lib/notifications/reminders — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/reminders' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helper
    not ok 3 - rappels désactivés (notif.reminder_j1_enabled, notif.reminder_h3_enabled = false) : rien ; réactivés dans la fenêtre : créés
        → réglage notif.reminder_j1_enabled absent de platform_settings (contrat I1, migration 20261103000003)
    not ok 4 - plage de silence (J-1 réglé à 7 h) : application et push envoyés, SMS SKIPPED QUIET_HOURS sans report ; textes in-app et push
        → abonnement push : Could not find the table 'public.push_subscriptions' in the schema cache (code PGRST205) — table push_subscriptions du contrat C5
        → +   code: 'PGRST205',
    not ok 5 - notif.j1_sms = NEVER : SMS SKIPPED SMS_POLICY_NEVER dès la planification, les autres canaux en attente
        → réglage notif.j1_sms absent de platform_settings (contrat I1, migration 20261103000003)
not ok 1 - 6.5 Rappel J-1 : la veille à l’heure réglée (contrat I2)
    not ok 1 - rien à début - 3 h - 1 min, créé à début - 3 h (I P S, IF_NO_PUSH) ; le J-1 n’est pas rattrapé ; notif.reminder_h3_hours = 5 déplace l’échéance
        → planificateur des rappels (contrat I3) absent : lib/notifications/reminders — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/reminders' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helper
    not ok 2 - achat tardif (heure réelle) : billet acheté après l’échéance du H-3 → aucun rappel ; témoin acheté avant → rappel
        → planificateur des rappels (contrat I3) absent : lib/notifications/reminders — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/reminders' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helper
    not ok 3 - billets UTILISE : pas de H-3 pour un compte sans billet VALIDE ; un billet VALIDE restant suffit
        → planificateur des rappels (contrat I3) absent : lib/notifications/reminders — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/reminders' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helper
    not ok 4 - notif.h3_sms = IF_NO_PUSH : push accepté → SMS SKIPPED PUSH_DELIVERED ; sans appareil → SMS envoyé au texte exact ; push urgent
        → abonnement push : Could not find the table 'public.push_subscriptions' in the schema cache (code PGRST205) — table push_subscriptions du contrat C5
        → +   code: 'PGRST205',
not ok 2 - 6.5 Rappel H-3 : au début moins le nombre d’heures réglé (contrat I2)
    not ok 1 - 5 billets d’un compte → une ligne par canal ; deux planifications et deux envois → aucun doublon, un seul SMS au texte exact
        → planificateur des rappels (contrat I3) absent : lib/notifications/reminders — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/reminders' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helper
    not ok 2 - invitation → rappel ; billet de guichet (sans porteur) → rien ; compte suspendu → lignes SKIPPED ACCOUNT_SUSPENDED (trace)
        → planificateur des rappels (contrat I3) absent : lib/notifications/reminders — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/reminders' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helper
    not ok 3 - rappel du contrôleur : la veille à 18:00, une ligne par affectation, point d’entrée et espèces dans les textes
        → planificateur des rappels (contrat I3) absent : lib/notifications/reminders — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/reminders' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helper
    not ok 4 - réglage notif.* absent : la planification lève une exception nommant la clé (transaction annulée, décision 25)
        → RPC public.notification_reminders_schedule(p jsonb) absente (contrat I2, migration 20261103000004)
        → false !== true
not ok 3 - 6.5 Destinataires et unicité (contrat I2)
    not ok 1 - 503 sans CRON_SECRET, 401 sans jeton ou avec un mauvais jeton, 200 avec le rapport de planification
        → route /api/cron/reminders (contrat I3) absent : app/api/cron/reminders/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/cron/reminders/route' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-help
    not ok 2 - contrôles statiques : aucune heure lue dans la requête, scheduleReminders() sans argument, protégée par CRON_SECRET
        → route absente : app/api/cron/reminders/route.ts
    not ok 3 - planifier n’envoie rien : aucun SMS ni push avant le passage de l’envoyeur (contrat 6.1)
        → planificateur des rappels (contrat I3) absent : lib/notifications/reminders — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/reminders' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helper
not ok 4 - 6.5 Route /api/cron/reminders (contrat I3)
not ok 5 - /home/runner/work/event-village/event-village/tests/parcours/notif-rappels.test.ts
        → invariants (m)(n)(o) impossibles à vérifier (notif-rappels) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
# pass 0
# fail 16
```

Run 67 (après correctif) :

```text
    ok 1 - rien à 09:59 la veille ; à 10:00 une ligne par canal, clé avec le début, échéance 10:00 ; pas de H-3 à cette heure
    ok 2 - tolérance de 15 min : premier passage à 10:14 → créé (échéance 10:00) ; premier passage à 10:16 → rien, ni ensuite
    ok 3 - rappels désactivés (notif.reminder_j1_enabled, notif.reminder_h3_enabled = false) : rien ; réactivés dans la fenêtre : créés
    ok 4 - plage de silence (J-1 réglé à 7 h) : application et push envoyés, SMS SKIPPED QUIET_HOURS sans report ; textes in-app et push
    ok 5 - notif.j1_sms = NEVER : SMS SKIPPED SMS_POLICY_NEVER dès la planification, les autres canaux en attente
ok 1 - 6.5 Rappel J-1 : la veille à l’heure réglée (contrat I2)
    ok 1 - rien à début - 3 h - 1 min, créé à début - 3 h (I P S, IF_NO_PUSH) ; le J-1 n’est pas rattrapé ; notif.reminder_h3_hours = 5 déplace l’échéance
    ok 2 - achat tardif (heure réelle) : billet acheté après l’échéance du H-3 → aucun rappel ; témoin acheté avant → rappel
    ok 3 - billets UTILISE : pas de H-3 pour un compte sans billet VALIDE ; un billet VALIDE restant suffit
    ok 4 - notif.h3_sms = IF_NO_PUSH : push accepté → SMS SKIPPED PUSH_DELIVERED ; sans appareil → SMS envoyé au texte exact ; push urgent
ok 2 - 6.5 Rappel H-3 : au début moins le nombre d’heures réglé (contrat I2)
    ok 1 - 5 billets d’un compte → une ligne par canal ; deux planifications et deux envois → aucun doublon, un seul SMS au texte exact
    ok 2 - invitation → rappel ; billet de guichet (sans porteur) → rien ; compte suspendu → lignes SKIPPED ACCOUNT_SUSPENDED (trace)
    ok 3 - rappel du contrôleur : la veille à 18:00, une ligne par affectation, point d’entrée et espèces dans les textes
    ok 4 - réglage notif.* absent : la planification lève une exception nommant la clé (transaction annulée, décision 25)
ok 3 - 6.5 Destinataires et unicité (contrat I2)
    ok 1 - 503 sans CRON_SECRET, 401 sans jeton ou avec un mauvais jeton, 200 avec le rapport de planification
    ok 2 - contrôles statiques : aucune heure lue dans la requête, scheduleReminders() sans argument, protégée par CRON_SECRET
    ok 3 - planifier n’envoie rien : aucun SMS ni push avant le passage de l’envoyeur (contrat 6.1)
ok 4 - 6.5 Route /api/cron/reminders (contrat I3)
# pass 16
# fail 0
```

**parcours/notif-rappels-annulation**

Run 60 (avant correctif) :

```text
    not ok 1 - suspension : rappels PENDING → CANCELLED EVENT_SUSPENDU dans la même transaction ; réactivation dans la tolérance → pas recréés, rien envoyé
        → planificateur des rappels (contrat I3) absent : lib/notifications/reminders — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/reminders' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helper
    not ok 2 - annulation (event_cancel) : CANCELLED EVENT_ANNULE et EVENT_CHANGED NO_LONGER_RELEVANT dans la transaction de l’annulation
        → planificateur des rappels (contrat I3) absent : lib/notifications/reminders — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/reminders' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helper
    not ok 3 - fin (TERMINE) : REMINDER_H3 et CONTROLLER_REMINDER PENDING → CANCELLED EVENT_TERMINE, EVENT_CHANGED → NO_LONGER_RELEVANT
        → insertOutboxRow {"type":"REMINDER_H3","family":"OPTIONAL","origin":"OUTBOX","template_data":{"event_id":"712fccf2-c297-438f-ab2e-99dd0ff0e464","title":"Termine f60c46","start_at":"2026-11-05T20:00:00.000Z","location":"Salle Sorano","city":"Dakar"},"attempts":0
        → +   code: 'PGRST205',
not ok 1 - 6.5 Rappels annulés par la transition de l’événement (contrat I4)
    not ok 1 - event_update (début déplacé d’un jour) : CANCELLED EVENT_RESCHEDULED dans la transaction de l’édition ; nouvelle clé au passage suivant, un seul SMS
        → planificateur des rappels (contrat I3) absent : lib/notifications/reminders — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/reminders' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helper
    not ok 2 - UPDATE du service_role : un UPDATE sans changement du début ne touche rien ; l’heure de début changée → CANCELLED EVENT_RESCHEDULED ; nouvelle clé dans la tolérance
        → planificateur des rappels (contrat I3) absent : lib/notifications/reminders — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/reminders' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helper
not ok 2 - 6.5 Rappels annulés par un changement de date (contrat I4, I2)
    not ok 1 - ancien porteur sans autre billet → CANCELLED NO_LONGER_HOLDER (transaction de l’acceptation) ; porteur qui garde un billet → intact ; nouveaux porteurs → rappels à venir
        → markPhoneVerified 8fd1983d-14bd-4784-9832-02d1ed00e3de : Could not find the 'phone_verified_at' column of 'users' in the schema cache (code PGRST204) — colonne users.phone_verified_at du contrat B1, migration 20261103000002
        → +   code: 'PGRST204',
not ok 3 - 6.5 Billet transféré : rappels de l’ancien et du nouveau porteur (contrat I4, B3)
    not ok 1 - trigger de transition désactivé → la suspension laisse les rappels PENDING et le contrôle le relève ; idem pour la date ; trigger actif → contrôle vide
        → planificateur des rappels (contrat I3) absent : lib/notifications/reminders — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/reminders' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helper
not ok 4 - 6.5 Garde-fous de détection (transaction annulée)
not ok 5 - /home/runner/work/event-village/event-village/tests/parcours/notif-rappels-annulation.test.ts
        → invariants (m)(n)(o) impossibles à vérifier (notif-rappels-annulation) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
# pass 0
# fail 7
```

Run 67 (après correctif) :

```text
    ok 1 - suspension : rappels PENDING → CANCELLED EVENT_SUSPENDU dans la même transaction ; réactivation dans la tolérance → pas recréés, rien envoyé
    ok 2 - annulation (event_cancel) : CANCELLED EVENT_ANNULE et EVENT_CHANGED NO_LONGER_RELEVANT dans la transaction de l’annulation
    ok 3 - fin (TERMINE) : REMINDER_H3 et CONTROLLER_REMINDER PENDING → CANCELLED EVENT_TERMINE, EVENT_CHANGED → NO_LONGER_RELEVANT
ok 1 - 6.5 Rappels annulés par la transition de l’événement (contrat I4)
    ok 1 - event_update (début déplacé d’un jour) : CANCELLED EVENT_RESCHEDULED dans la transaction de l’édition ; nouvelle clé au passage suivant, un seul SMS
    ok 2 - UPDATE du service_role : un UPDATE sans changement du début ne touche rien ; l’heure de début changée → CANCELLED EVENT_RESCHEDULED ; nouvelle clé dans la tolérance
ok 2 - 6.5 Rappels annulés par un changement de date (contrat I4, I2)
    ok 1 - ancien porteur sans autre billet → CANCELLED NO_LONGER_HOLDER (transaction de l’acceptation) ; porteur qui garde un billet → intact ; nouveaux porteurs → rappels à venir
ok 3 - 6.5 Billet transféré : rappels de l’ancien et du nouveau porteur (contrat I4, B3)
    ok 1 - trigger de transition désactivé → la suspension laisse les rappels PENDING et le contrôle le relève ; idem pour la date ; trigger actif → contrôle vide
ok 4 - 6.5 Garde-fous de détection (transaction annulée)
# pass 7
# fail 0
```

### 6.6 — Notifications des professionnels

```text
$ git grep -n -E 'mTargetService\.send[A-Za-z]*\(|NotificationService\.[A-Za-z]+\(|\.from\('"'"'notifications'"'"'\)\.insert' fff03b1 -- lib/shifts lib/payments/cashout.service.ts lib/admin/alerts.ts lib/sms/sms-guard.ts app/api/partner/team 'app/api/admin/partners/[id]/status/route.ts' app/api/controller/setup/route.ts
fff03b1:app/api/admin/partners/[id]/status/route.ts:144:            await NotificationService.sendReactivationNotification({
fff03b1:app/api/admin/partners/[id]/status/route.ts:152:            await NotificationService.sendAdminValidationNotification({
fff03b1:app/api/admin/partners/[id]/status/route.ts:162:            await NotificationService.sendSuspensionNotification({
fff03b1:app/api/controller/setup/route.ts:164:            await mTargetService.sendControllerActivationConfirmation(normalizedPhone);
fff03b1:app/api/partner/team/[eventId]/route.ts:151:            const sms = await mTargetService.sendControllerRevocationNotice(ctrlUser.phone, eventTitle, { actorId: user.id });
fff03b1:app/api/partner/team/[eventId]/route.ts:155:        const inApp = await NotificationService.createNotification({
fff03b1:app/api/partner/team/all/route.ts:251:                await mTargetService.sendControllerAllEventsRevokedNotice(ctrlUser.phone, { actorId: user.id });
fff03b1:app/api/partner/team/all/route.ts:259:            await NotificationService.createNotification({
fff03b1:app/api/partner/team/assignments/route.ts:242:                await mTargetService.sendControllerAssignmentsUpdatedNotice(ctrlUser.phone, requestedEventIds.length, { actorId: user.id });
fff03b1:app/api/partner/team/assignments/route.ts:249:            await NotificationService.createNotification({
fff03b1:app/api/partner/team/controller/[controllerId]/route.ts:122:            const sms = await mTargetService.sendControllerAccountDeletedNotice(ctrlProfile.phone, { actorId: user.id });
fff03b1:app/api/partner/team/controller/[controllerId]/route.ts:126:        const inApp = await NotificationService.createNotification({
fff03b1:app/api/partner/team/invite/route.ts:368:                const smsRes = await mTargetService.sendControllerInvite(
fff03b1:app/api/partner/team/invite/route.ts:389:                const smsRes = await mTargetService.sendNotification(normalizedPhone, smsMsg, { actorId: user.id });
fff03b1:lib/admin/alerts.ts:38:    const { error: notifErr } = await supabase.from('notifications').insert(admins.map((a) => ({
fff03b1:lib/payments/cashout.service.ts:91:    const { error } = await getServiceRoleClient().from('notifications').insert({
fff03b1:lib/shifts/shift.service.ts:425:                sms = await NotificationService.sendShiftDiscrepancySms({
fff03b1:lib/sms/sms-guard.ts:132:    const { error: notifErr } = await supabase.from('notifications').insert(admins.map((a) => ({
(code de sortie 0)

$ git grep -n -E 'mTargetService\.send[A-Za-z]*\(|NotificationService\.[A-Za-z]+\(|\.from\('"'"'notifications'"'"'\)\.insert' 3a246ad -- lib/shifts lib/payments/cashout.service.ts lib/admin/alerts.ts lib/sms/sms-guard.ts app/api/partner/team 'app/api/admin/partners/[id]/status/route.ts' app/api/controller/setup/route.ts
3a246ad:app/api/partner/team/invite/route.ts:383:                const smsRes = await mTargetService.sendControllerInvite(
(code de sortie 0)
```

**Correctif** (migration `…06`, commit `3930d11`) : avis des partenaires, contrôleurs et admins mis en file dans la transaction métier (triggers sur `cashouts`, `event_controllers`, `partners`, `auth.users`, `sponsored_promotions`, `hall_reservations`, `payments` ; `shift_close`, `fin_alert_superadmins`, `activate_partner_trial` recopiées) ; `partner_status_set` ; destinataires admin par permission (`user_roles`, comptes actifs) ; SMS d'affectation regroupé par requête ; invitation d'un contrôleur synchrone, journalisée sans le code ; aucun nouvel envoi à un compte suspendu, sauf les messages liés à son argent et l'avis de suspension (section 11) ; envoi immédiat des campagnes désactivé.

**parcours/notif-pros**

Run 60 (avant correctif) :

```text
    not ok 1 - refus par l’admin avec motif puis validation : EVENT_REJECTED et EVENT_VALIDATED, quatre canaux, SMS exacts
        → lecture de notification_outbox ({"type":"EVENT_REJECTED","keyPrefix":"EVENT_REJECTED:6fbce037-d197-4d0d-beb5-c14a4c10f9fe:"}) : Could not find the table 'public.notification_outbox' in the schema cache (code PGRST205) — table du contrat C2, migration 202611030
        → +   code: 'PGRST205',
    not ok 2 - publication par l’admin : EVENT_PUBLISHED_BY_ADMIN (in-app et push, sans SMS) ; publication par le partenaire : rien
        → lecture de notification_outbox ({"type":"EVENT_PUBLISHED_BY_ADMIN","keyPrefix":"EVENT_PUBLISHED_BY_ADMIN:039c424f-2348-45e2-ba99-1c9952d9f65f:"}) : Could not find the table 'public.notification_outbox' in the schema cache (code PGRST205) — table du contrat C2,
        → +   code: 'PGRST205',
    not ok 3 - suspension avec motif et réactivation : avis au partenaire et un seul avis par porteur distinct (billets VALIDE et UTILISE)
        → lecture de notification_outbox ({"type":"EVENT_SUSPENDED","keyPrefix":"EVENT_SUSPENDED:cde6ff3a-8dca-4700-9261-3e0c18fcc929:"}) : Could not find the table 'public.notification_outbox' in the schema cache (code PGRST205) — table du contrat C2, migration 2026110
        → +   code: 'PGRST205',
not ok 1 - 6.6 Partenaire — cycle de l’événement (trg_event_status_notify, contrat J1.7)
    not ok 1 - premier billet vendu en ligne : une seule fois par événement (quatre canaux), une « nouvelle commande » in-app par paiement
        → lecture de notification_outbox ({"type":"FIRST_TICKET_SOLD","keyPrefix":"FIRST_TICKET_SOLD:3f9dec44-20aa-4662-81f8-f1b207d0985a:"}) : Could not find the table 'public.notification_outbox' in the schema cache (code PGRST205) — table du contrat C2, migration 202
        → +   code: 'PGRST205',
    not ok 2 - billets gratuits : aucun « premier billet vendu » ; la première vente en ligne ensuite le déclenche
        → lecture de notification_outbox ({"type":"FREE_TICKETS_CONFIRMED","keyPrefix":"FREE_TICKETS_CONFIRMED:1d5d60e3-6269-4c65-b580-d8221cf2461c:"}) : Could not find the table 'public.notification_outbox' in the schema cache (code PGRST205) — table du contrat C2, mig
        → +   code: 'PGRST205',
    not ok 3 - premier billet vendu au guichet : déclenché par counter_sale (billet COUNTER)
        → lecture de notification_outbox ({"type":"FIRST_TICKET_SOLD","keyPrefix":"FIRST_TICKET_SOLD:47bb6f41-71e7-47c3-86f9-3ece24935a16:"}) : Could not find the table 'public.notification_outbox' in the schema cache (code PGRST205) — table du contrat C2, migration 202
        → +   code: 'PGRST205',
    not ok 4 - catégorie complète, de nouveau après une hausse du quota (clé avec le quota), puis événement complet
        → lecture de notification_outbox ({"type":"CATEGORY_SOLD_OUT","keyPrefix":"CATEGORY_SOLD_OUT:ef7d95f6-c623-4c45-b20f-82c5e69843ec:2:"}) : Could not find the table 'public.notification_outbox' in the schema cache (code PGRST205) — table du contrat C2, migration 2
        → +   code: 'PGRST205',
    not ok 5 - caisse clôturée avec écart : SHIFT_DISCREPANCY (in-app, SMS, push) au partenaire, alert_queued, SMS exact ; sans écart : rien
        → réponse : alert_queued = true (J2.1) : HTTP 200 {"success":true,"shift":{"id":"980e42a1-4ad5-4c62-bd3b-c8803b3d85eb","controller_id":"e9fd57d8-f793-408d-9c04-c09c5d02b52f","event_id":"fd08354e-cf1b-40aa-96d5-9fddc0f4b581","partner_id":"30391bdb-edc4-452d-a355-
        → + undefined
not ok 2 - 6.6 Partenaire — ventes (J1.4, J1.5, J1.1, J2.1)
    not ok 1 - retrait versé : WITHDRAWAL_PAID (quatre canaux), SMS exact au montant du cashout
        → lecture de notification_outbox ({"type":"WITHDRAWAL_PAID","keyPrefix":"WITHDRAWAL_PAID:e13299e8-4379-44d0-bc3b-99d577251aed:"}) : Could not find the table 'public.notification_outbox' in the schema cache (code PGRST205) — table du contrat C2, migration 2026110
        → +   code: 'PGRST205',
    not ok 2 - retrait refusé par l’opérateur : WITHDRAWAL_REJECTED (quatre canaux), SMS exact
        → lecture de notification_outbox ({"type":"WITHDRAWAL_REJECTED","keyPrefix":"WITHDRAWAL_REJECTED:7ea919ac-7faf-4f16-90ea-bfce3366a71f:"}) : Could not find the table 'public.notification_outbox' in the schema cache (code PGRST205) — table du contrat C2, migration
        → +   code: 'PGRST205',
    not ok 3 - retrait incertain : WITHDRAWAL_UNCERTAIN (in-app, SMS, push ; clé avec le nombre d’essais), SMS exact
        → lecture de notification_outbox ({"type":"WITHDRAWAL_UNCERTAIN","keyPrefix":"WITHDRAWAL_UNCERTAIN:8f996eb9-be7d-4f9d-af69-18d1e0956ac5:1:"}) : Could not find the table 'public.notification_outbox' in the schema cache (code PGRST205) — table du contrat C2, migra
        → +   code: 'PGRST205',
    not ok 4 - remboursements d’une annulation tous versés : CANCEL_REFUNDS_DONE une seule fois (in-app, email, push) ; un REFUND_PAID par cashout
        → lecture de notification_outbox ({"type":"CANCEL_REFUNDS_DONE","keyPrefix":"CANCEL_REFUNDS_DONE:b3f4ba4a-2070-49f5-afe1-e4e323c24fb0:"}) : Could not find the table 'public.notification_outbox' in the schema cache (code PGRST205) — table du contrat C2, migration
        → +   code: 'PGRST205',
    not ok 5 - remboursements d’une annulation bloqués (solde insuffisant) : CANCEL_REFUNDS_BLOCKED une seule fois pour le jour
        → lecture de notification_outbox ({"type":"CANCEL_REFUNDS_BLOCKED","keyPrefix":"CANCEL_REFUNDS_BLOCKED:c035d780-d40d-4501-9e9f-7c9c464cbeab:2026-11-02:"}) : Could not find the table 'public.notification_outbox' in the schema cache (code PGRST205) — table du cont
        → +   code: 'PGRST205',
not ok 3 - 6.6 Partenaire — argent (trg_cashouts_notify, contrat J2.2)
    not ok 1 - inscription par la route : un seul SMS (le code), PARTNER_REGISTERED_ACK in-app et email, aucune ligne SMS de la boîte d’envoi
        → un SMS synchrone : le code d’inscription
        → 2 !== 1
    not ok 2 - partner_status_set : validation d’un partenaire EN_ATTENTE → VALIDE, compte ACTIF, PARTNER_VALIDATED (in-app, SMS, email), SMS exact
        → validation : Could not find the function public.partner_status_set(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
    not ok 3 - partner_status_set : refus avec motif → REJETE, motif enregistré, PARTNER_REJECTED, SMS exact ; motif trop court → REASON_REQUIRED
        → refus sans motif : Could not find the function public.partner_status_set(p) in the schema cache
        → +   code: 'PGRST202',
    not ok 4 - partner_status_set : suspension (motif) → partenaire et compte SUSPENDU, sessions révoquées, avis envoyé malgré la suspension (ALLOW) ; réactivation → VALIDE, ACTIF, PARTNER_REACTIVATED
        → suspension : Could not find the function public.partner_status_set(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
    not ok 5 - partner_status_set : refus FORBIDDEN (acteur non admin), PARTNER_NOT_FOUND, TRANSITION_NOT_ALLOWED (statut inchangé), sans aucune ligne
        → acteur non admin : Could not find the function public.partner_status_set(p) in the schema cache
        → +   code: 'PGRST202',
    not ok 6 - route PATCH /api/admin/partners/[id]/status : passe par partner_status_set (statuts synchronisés), aucun SMS direct
        → la route n’envoie aucun SMS : avis dans la boîte d’envoi
        → 1 !== 0
    not ok 7 - période d’essai : TRIAL_STARTED (in-app, SMS) à la première activation seulement, SMS exact
        → activation : invalid input value for enum partner_status: "ACTIF"
        → +   code: '22P02',
    not ok 8 - abonnement : SUBSCRIPTION_ACTIVATED (in-app) au changement de formule, rien pour un rejeu de la même formule
        → lecture de notification_outbox ({"type":"SUBSCRIPTION_ACTIVATED","keyPrefix":"SUBSCRIPTION_ACTIVATED:3d1a1289-7b9f-4d35-b6ab-7f652a2bc0ae:80b6ea52-caa3-4a33-b083-719a14c31bfe:"}) : Could not find the table 'public.notification_outbox' in the schema cache (code
        → +   code: 'PGRST205',
not ok 4 - 6.6 Partenaire — compte (trg_partners_notify, partner_status_set, J2.5-J2.8)
    not ok 1 - partenaire suspendu : catégorie et événement complets SKIPPED ACCOUNT_SUSPENDED dès l’insertion ; remboursements de l’annulation (ALLOW) envoyés
        → suspension : Could not find the function public.partner_status_set(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
not ok 5 - 6.6 — aucun nouvel envoi à un compte suspendu, sauf messages indispensables liés à son argent
not ok 6 - /home/runner/work/event-village/event-village/tests/parcours/notif-pros.test.ts
        → invariants (m)(n)(o) impossibles à vérifier (notif-pros) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
# pass 0
# fail 22
```

Run 67 (après correctif) :

```text
    ok 1 - refus par l’admin avec motif puis validation : EVENT_REJECTED et EVENT_VALIDATED, quatre canaux, SMS exacts
    ok 2 - publication par l’admin : EVENT_PUBLISHED_BY_ADMIN (in-app et push, sans SMS) ; publication par le partenaire : rien
    ok 3 - suspension avec motif et réactivation : avis au partenaire et un seul avis par porteur distinct (billets VALIDE et UTILISE)
ok 1 - 6.6 Partenaire — cycle de l’événement (trg_event_status_notify, contrat J1.7)
    ok 1 - premier billet vendu en ligne : une seule fois par événement (quatre canaux), une « nouvelle commande » in-app par paiement
    ok 2 - billets gratuits : aucun « premier billet vendu » ; la première vente en ligne ensuite le déclenche
    ok 3 - premier billet vendu au guichet : déclenché par counter_sale (billet COUNTER)
    ok 4 - catégorie complète, de nouveau après une hausse du quota (clé avec le quota), puis événement complet
    ok 5 - caisse clôturée avec écart : SHIFT_DISCREPANCY (in-app, SMS, push) au partenaire, alert_queued, SMS exact ; sans écart : rien
ok 2 - 6.6 Partenaire — ventes (J1.4, J1.5, J1.1, J2.1)
    ok 1 - retrait versé : WITHDRAWAL_PAID (quatre canaux), SMS exact au montant du cashout
    ok 2 - retrait refusé par l’opérateur : WITHDRAWAL_REJECTED (quatre canaux), SMS exact
    ok 3 - retrait incertain : WITHDRAWAL_UNCERTAIN (in-app, SMS, push ; clé avec le nombre d’essais), SMS exact
    ok 4 - remboursements d’une annulation tous versés : CANCEL_REFUNDS_DONE une seule fois (in-app, email, push) ; un REFUND_PAID par cashout
    ok 5 - remboursements d’une annulation bloqués (solde insuffisant) : CANCEL_REFUNDS_BLOCKED une seule fois pour le jour
ok 3 - 6.6 Partenaire — argent (trg_cashouts_notify, contrat J2.2)
    ok 1 - inscription par la route : un seul SMS (le code), PARTNER_REGISTERED_ACK in-app et email, aucune ligne SMS de la boîte d’envoi
    ok 2 - partner_status_set : validation d’un partenaire EN_ATTENTE → VALIDE, compte ACTIF, PARTNER_VALIDATED (in-app, SMS, email), SMS exact
    ok 3 - partner_status_set : refus avec motif → REJETE, motif enregistré, PARTNER_REJECTED, SMS exact ; motif trop court → REASON_REQUIRED
    ok 4 - partner_status_set : suspension (motif) → partenaire et compte SUSPENDU, sessions révoquées, avis envoyé malgré la suspension (ALLOW) ; réactivation → VALIDE, ACTIF, PARTNER_REACTIVATED
    ok 5 - partner_status_set : refus FORBIDDEN (acteur non admin), PARTNER_NOT_FOUND, TRANSITION_NOT_ALLOWED (statut inchangé), sans aucune ligne
    ok 6 - route PATCH /api/admin/partners/[id]/status : passe par partner_status_set (statuts synchronisés), aucun SMS direct
    ok 7 - période d’essai : TRIAL_STARTED (in-app, SMS) à la première activation seulement, SMS exact
    ok 8 - abonnement : SUBSCRIPTION_ACTIVATED (in-app) au changement de formule, rien pour un rejeu de la même formule
ok 4 - 6.6 Partenaire — compte (trg_partners_notify, partner_status_set, J2.5-J2.8)
    ok 1 - partenaire suspendu : catégorie et événement complets SKIPPED ACCOUNT_SUSPENDED dès l’insertion ; remboursements de l’annulation (ALLOW) envoyés
ok 5 - 6.6 — aucun nouvel envoi à un compte suspendu, sauf messages indispensables liés à son argent
# pass 22
# fail 0
```

**parcours/notif-controleurs**

Run 60 (avant correctif) :

```text
    not ok 1 - une affectation (une instruction) : in-app et push de l’affectation, un SMS agrégé au texte exact (événement, date, point d’entrée)
        → lecture de notification_outbox ({"type":"CONTROLLER_ASSIGNED","keyPrefix":"CONTROLLER_ASSIGNED:e5431334-7918-49d9-a4ac-dcee68372dc8:"}) : Could not find the table 'public.notification_outbox' in the schema cache (code PGRST205) — table du contrat C2, migration
        → +   code: 'PGRST205',
    not ok 2 - trois affectations par PATCH /api/partner/team/assignments : trois in-app, trois push, un seul SMS « et 2 autres » ; notification QUEUED
        → réponse : notification QUEUED (J2.4) : HTTP 200 {"success":true,"message":"Affectations synchronisées avec succès.","added":["24db6573-462e-468b-9e62-6713431193f4","a9ea6677-06eb-432d-ad8b-10caa64c0612","ba5def28-fd29-4924-95c6-19bfc75778c1"],"removed":[],"tot
        → + undefined
not ok 1 - 6.6 Contrôleur — affectation (trg_event_controllers_notify, J2.4)
    not ok 1 - DELETE /api/partner/team/all : CONTROLLER_UNASSIGNED par affectation, un SMS agrégé, rappels PENDING du compte annulés NO_LONGER_ASSIGNED
        → insertOutboxRow {"type":"CONTROLLER_REMINDER","family":"OPTIONAL","origin":"OUTBOX","template_data":{"event_id":"17c88b4e-9419-467c-aa48-2346d8d5563b"},"attempts":0,"max_attempts":5,"due_at":"2026-12-02T18:55:45.535Z","next_attempt_at":"2026-12-02T18:55:45.535
        → +   code: 'PGRST205',
    not ok 2 - suppressions en cascade : brouillon supprimé, compte supprimé (transaction annulée) → aucune erreur, aucune ligne de retrait
        → lecture de notification_outbox ({"type":"CONTROLLER_ASSIGNED","keyPrefix":"CONTROLLER_ASSIGNED:cd941990-c350-456c-bd43-f2ad124929e6:"}) : Could not find the table 'public.notification_outbox' in the schema cache (code PGRST205) — table du contrat C2, migration
        → +   code: 'PGRST205',
not ok 2 - 6.6 Contrôleur — retrait d’affectation (J2.4, I4)
    not ok 1 - fermée par le partenaire ou par un admin : SHIFT_CLOSED_BY_OTHER (in-app, push) au contrôleur ; fermée par lui-même : rien
        → lecture de notification_outbox ({"type":"SHIFT_CLOSED_BY_OTHER","keyPrefix":"SHIFT_CLOSED_BY_OTHER:b6519e5a-c301-4f33-9b65-080f34eeeff4:"}) : Could not find the table 'public.notification_outbox' in the schema cache (code PGRST205) — table du contrat C2, migra
        → +   code: 'PGRST205',
not ok 3 - 6.6 Contrôleur — caisse fermée par un tiers (shift_close, J2.1)
    not ok 1 - notification_controller_activated : CONTROLLER_ACTIVATED (in-app, SMS) une seule fois, SMS exact
        → notification_controller_activated : Could not find the function public.notification_controller_activated(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
    not ok 2 - invitation d’un nouveau compte : SMS synchrone avec le code, journal sans code, aucun second SMS d’affectation ; setup → phone_verified_at et CONTROLLER_ACTIVATED
        → lecture de notification_outbox ({"type":"CONTROLLER_INVITE","phone":"+221766289487"}) : Could not find the table 'public.notification_outbox' in the schema cache (code PGRST205) — table du contrat C2, migration 20261103000002
        → +   code: 'PGRST205',
not ok 4 - 6.6 Contrôleur — activation et invitation d’un nouveau compte (J2.12, E7)
not ok 5 - /home/runner/work/event-village/event-village/tests/parcours/notif-controleurs.test.ts
        → invariants (m)(n)(o) impossibles à vérifier (notif-controleurs) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
# pass 0
# fail 7
```

Run 67 (après correctif) :

```text
    ok 1 - une affectation (une instruction) : in-app et push de l’affectation, un SMS agrégé au texte exact (événement, date, point d’entrée)
    ok 2 - trois affectations par PATCH /api/partner/team/assignments : trois in-app, trois push, un seul SMS « et 2 autres » ; notification QUEUED
ok 1 - 6.6 Contrôleur — affectation (trg_event_controllers_notify, J2.4)
    ok 1 - DELETE /api/partner/team/all : CONTROLLER_UNASSIGNED par affectation, un SMS agrégé, rappels PENDING du compte annulés NO_LONGER_ASSIGNED
    ok 2 - suppressions en cascade : brouillon supprimé, compte supprimé (transaction annulée) → aucune erreur, aucune ligne de retrait
ok 2 - 6.6 Contrôleur — retrait d’affectation (J2.4, I4)
    ok 1 - fermée par le partenaire ou par un admin : SHIFT_CLOSED_BY_OTHER (in-app, push) au contrôleur ; fermée par lui-même : rien
ok 3 - 6.6 Contrôleur — caisse fermée par un tiers (shift_close, J2.1)
    ok 1 - notification_controller_activated : CONTROLLER_ACTIVATED (in-app, SMS) une seule fois, SMS exact
    ok 2 - invitation d’un nouveau compte : SMS synchrone avec le code, journal sans code, aucun second SMS d’affectation ; setup → phone_verified_at et CONTROLLER_ACTIVATED
ok 4 - 6.6 Contrôleur — activation et invitation d’un nouveau compte (J2.12, E7)
# pass 7
# fail 0
```

**parcours/notif-admins**

Run 60 (avant correctif) :

```text
    not ok 1 - événement soumis : ADMIN_EVENT_SUBMITTED (in-app, push, email) aux admins events.read et au SUPERADMIN, sans SMS
        → lecture de notification_outbox ({"type":"ADMIN_EVENT_SUBMITTED","keyPrefix":"ADMIN_EVENT_SUBMITTED:0298c51c-decb-48c3-be5b-3745d4c59261:"}) : Could not find the table 'public.notification_outbox' in the schema cache (code PGRST205) — table du contrat C2, migra
        → +   code: 'PGRST205',
    not ok 2 - partenaire inscrit : ADMIN_PARTNER_REGISTERED (in-app, push, email) aux admins partners.read et au SUPERADMIN
        → lecture de notification_outbox ({"type":"ADMIN_PARTNER_REGISTERED","keyPrefix":"ADMIN_PARTNER_REGISTERED:630fbe2a-ec1c-4715-a313-8cb001ef0eeb:"}) : Could not find the table 'public.notification_outbox' in the schema cache (code PGRST205) — table du contrat C2,
        → +   code: 'PGRST205',
not ok 1 - 6.6 Admin — événement soumis et partenaire inscrit
    not ok 1 - remboursement bloqué (solde insuffisant) : ADMIN_REFUND_TO_RETRY BLOQUE aux admins refunds.manage, un signal REFUND_TO_RETRY
        → lecture de notification_outbox ({"type":"ADMIN_REFUND_TO_RETRY","keyPrefix":"ADMIN_REFUND_TO_RETRY:411d745c-1a27-4c4e-88bc-491fcb81e02c:0:BLOQUE:"}) : Could not find the table 'public.notification_outbox' in the schema cache (code PGRST205) — table du contrat 
        → +   code: 'PGRST205',
    not ok 2 - remboursement refusé par l’opérateur : ADMIN_REFUND_TO_RETRY ECHOUE, un signal ; second passage du trigger sans doublon
        → lecture de notification_outbox ({"type":"ADMIN_REFUND_TO_RETRY","keyPrefix":"ADMIN_REFUND_TO_RETRY:6250cc06-2126-4996-a4b0-d1a27b786b41:1:ECHOUE:"}) : Could not find the table 'public.notification_outbox' in the schema cache (code PGRST205) — table du contrat 
        → +   code: 'PGRST205',
    not ok 3 - cashout incertain : ADMIN_CASHOUT_UNCERTAIN aux admins refunds.manage, un signal CASHOUT_UNCERTAIN
        → lecture de notification_outbox ({"type":"ADMIN_CASHOUT_UNCERTAIN","keyPrefix":"ADMIN_CASHOUT_UNCERTAIN:c58bfb14-58bc-4e4d-966f-2a82bedf3b1e:1:"}) : Could not find the table 'public.notification_outbox' in the schema cache (code PGRST205) — table du contrat C2,
        → +   code: 'PGRST205',
    not ok 4 - créance sur un organisateur : ADMIN_FINANCE_DEBT (in-app, email) aux admins payments.read, metadata.debt_id
        → lecture de notification_outbox ({"type":"ADMIN_FINANCE_DEBT","keyPrefix":"ADMIN_FINANCE_DEBT:7e4094bb-ebc7-45d0-9b04-e0be8a4c40b7:"}) : Could not find the table 'public.notification_outbox' in the schema cache (code PGRST205) — table du contrat C2, migration 2
        → +   code: 'PGRST205',
not ok 2 - 6.6 Admin — remboursements, cashouts incertains, créances (trg_cashouts_notify, fin_alert_superadmins)
    not ok 1 - notification FAILED après refus définitif : ADMIN_NOTIFICATION_FAILED (in-app) aux admins notifications.read, un signal NOTIFICATION_FAILED
        → insertOutboxRow {"type":"PASSWORD_CHANGED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":0,"max_attempts":5,"due_at":"2026-11-02T18:55:22.047Z","next_attempt_at":"2026-11-02T18:55:22.047Z","channel":"SMS","recipient_phone":"+221763956349
        → +   code: 'PGRST205',
    not ok 2 - seuil de SMS du jour atteint (seuil 1) : ADMIN_SMS_DAILY_THRESHOLD (in-app, email) une fois pour le jour, un signal SMS_DAILY_THRESHOLD ; jour sans SMS : rien
        → insertOutboxRow {"type":"PASSWORD_CHANGED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":0,"max_attempts":5,"due_at":"2027-06-12T12:00:00.000Z","next_attempt_at":"2027-06-12T12:00:00.000Z","channel":"SMS","recipient_phone":"+221769065400
        → +   code: 'PGRST205',
    not ok 3 - plafond de SMS (notification_admin_alert) : ADMIN_SMS_CAP_GLOBAL et _NON_OTP en in-app aux admins notifications.read, une fois par jour ; type hors liste refusé
        → notification_admin_alert ADMIN_SMS_CAP_GLOBAL : Could not find the function public.notification_admin_alert(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
    not ok 4 - admin_signals : les quatre types du lot sont acceptés et uniques par référence (index uq_admin_signals_lot6)
        → type NOTIFICATION_FAILED accepté par le CHECK (C6) : 23514
        → '23514' !== 'accepté'
not ok 3 - 6.6 Admin — notification FAILED, seuil de SMS du jour, plafond de SMS
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/notif-admins.test.ts
        → invariants (m)(n)(o) impossibles à vérifier (notif-admins) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
# pass 0
# fail 10
```

Run 67 (après correctif) :

```text
    ok 1 - événement soumis : ADMIN_EVENT_SUBMITTED (in-app, push, email) aux admins events.read et au SUPERADMIN, sans SMS
    ok 2 - partenaire inscrit : ADMIN_PARTNER_REGISTERED (in-app, push, email) aux admins partners.read et au SUPERADMIN
ok 1 - 6.6 Admin — événement soumis et partenaire inscrit
    ok 1 - remboursement bloqué (solde insuffisant) : ADMIN_REFUND_TO_RETRY BLOQUE aux admins refunds.manage, un signal REFUND_TO_RETRY
    ok 2 - remboursement refusé par l’opérateur : ADMIN_REFUND_TO_RETRY ECHOUE, un signal ; second passage du trigger sans doublon
    ok 3 - cashout incertain : ADMIN_CASHOUT_UNCERTAIN aux admins refunds.manage, un signal CASHOUT_UNCERTAIN
    ok 4 - créance sur un organisateur : ADMIN_FINANCE_DEBT (in-app, email) aux admins payments.read, metadata.debt_id
ok 2 - 6.6 Admin — remboursements, cashouts incertains, créances (trg_cashouts_notify, fin_alert_superadmins)
    ok 1 - notification FAILED après refus définitif : ADMIN_NOTIFICATION_FAILED (in-app) aux admins notifications.read, un signal NOTIFICATION_FAILED
    ok 2 - seuil de SMS du jour atteint (seuil 1) : ADMIN_SMS_DAILY_THRESHOLD (in-app, email) une fois pour le jour, un signal SMS_DAILY_THRESHOLD ; jour sans SMS : rien
    ok 3 - plafond de SMS (notification_admin_alert) : ADMIN_SMS_CAP_GLOBAL et _NON_OTP en in-app aux admins notifications.read, une fois par jour ; type hors liste refusé
    ok 4 - admin_signals : les quatre types du lot sont acceptés et uniques par référence (index uq_admin_signals_lot6)
ok 3 - 6.6 Admin — notification FAILED, seuil de SMS du jour, plafond de SMS
# pass 10
# fail 0
```

### 6.7 — Migration des envois existants

```text
$ git grep -c -E 'NotificationService\.|mTargetService\.send|EmailService\.send|getSmsAdapter\(|getEmailAdapter\(|getPushAdapter\(' fff03b1 -- app lib
fff03b1:app/api/admin/communications/route.ts:1
fff03b1:app/api/admin/partners/[id]/status/route.ts:3
fff03b1:app/api/admin/promotions/route.ts:1
fff03b1:app/api/auth/register/route.ts:1
fff03b1:app/api/auth/send-otp/route.ts:2
fff03b1:app/api/auth/sms-hook/route.ts:1
fff03b1:app/api/controller/counter-sale/route.ts:1
fff03b1:app/api/controller/scan/route.ts:1
fff03b1:app/api/controller/setup/route.ts:1
fff03b1:app/api/partner/activation/route.ts:2
fff03b1:app/api/partner/register/route.ts:2
fff03b1:app/api/partner/team/[eventId]/route.ts:2
fff03b1:app/api/partner/team/all/route.ts:2
fff03b1:app/api/partner/team/assignments/route.ts:2
fff03b1:app/api/partner/team/controller/[controllerId]/route.ts:2
fff03b1:app/api/partner/team/invite/route.ts:2
fff03b1:app/api/tickets/claim-free/route.ts:1
fff03b1:app/api/withdrawals/otp/route.ts:1
fff03b1:lib/email/email.service.ts:2
fff03b1:lib/events/event-cancellation.service.ts:3
fff03b1:lib/events/event-change-notifications.ts:1
fff03b1:lib/events/event-lifecycle.service.ts:3
fff03b1:lib/halls/hall.service.ts:3
fff03b1:lib/integrations/registry.ts:2
fff03b1:lib/notifications/notification.service.ts:53
fff03b1:lib/payments/confirmation.service.ts:1
fff03b1:lib/payments/stock-notifications.ts:2
fff03b1:lib/shifts/shift.service.ts:1
fff03b1:lib/sms/mtarget.service.ts:1
fff03b1:lib/tickets/ticket-transfer.service.ts:3
(code de sortie 0)

$ git grep -c -E 'NotificationService\.|mTargetService\.send|EmailService\.send|getSmsAdapter\(|getEmailAdapter\(|getPushAdapter\(' 3a246ad -- app lib
3a246ad:app/api/auth/register/route.ts:1
3a246ad:app/api/auth/send-otp/route.ts:1
3a246ad:app/api/auth/sms-hook/route.ts:1
3a246ad:app/api/partner/register/route.ts:1
3a246ad:app/api/partner/team/invite/route.ts:1
3a246ad:app/api/withdrawals/otp/route.ts:1
3a246ad:lib/email/email.service.ts:1
3a246ad:lib/integrations/registry.ts:3
3a246ad:lib/notifications/dispatcher.ts:4
3a246ad:lib/sms/mtarget.service.ts:1
(code de sortie 0)

$ git ls-tree --name-only fff03b1 -- lib/notifications/notification.service.ts lib/payments/stock-notifications.ts lib/events/event-change-notifications.ts app/api/cron/event-change-notifications/route.ts 'app/api/tickets/transfers/[id]/claim/route.ts' app/api/tickets/transfers/incoming/route.ts
app/api/cron/event-change-notifications/route.ts
lib/events/event-change-notifications.ts
lib/notifications/notification.service.ts
lib/payments/stock-notifications.ts
(code de sortie 0)

$ git ls-tree --name-only 3a246ad -- lib/notifications/notification.service.ts lib/payments/stock-notifications.ts lib/events/event-change-notifications.ts app/api/cron/event-change-notifications/route.ts 'app/api/tickets/transfers/[id]/claim/route.ts' app/api/tickets/transfers/incoming/route.ts
app/api/tickets/transfers/[id]/claim/route.ts
app/api/tickets/transfers/incoming/route.ts
(code de sortie 0)
```

**Correctif** (migration `…05`, commits `267c32b`, `ace584b`) : tableau avant / après en section 7. Achat, billets gratuits, guichet, scan, cycle de vie, annulation, édition et transferts passent par la boîte d'envoi ; `event_change_notifications` absorbée (lignes reprises, cron et route supprimés) ; transfert sans jeton vers un numéro vérifié ; `NotificationService`, `lib/payments/stock-notifications.ts`, `lib/events/event-change-notifications.ts`, les modèles d'email morts et six méthodes `send*` de `MTargetService` supprimés. Contrôle statique K2 dans `notif-migration` : aucun appel direct aux adaptateurs hors de l'envoyeur, des routes OTP (`.sendOtp(` seulement) et de l'invitation (`.sendControllerInvite(` seulement).

**parcours/notif-transferts**

Run 60 (avant correctif) :

```text
    not ok 1 - numéro vérifié : réponse QUEUED sans jeton ni lien, TRANSFER_OFFERED par SMS au numéro et in-app + push au compte ; SMS exact sans lien de réclamation
        → markPhoneVerified e7bea2ed-7e2d-4d0b-83a1-13aadf256f90 : Could not find the 'phone_verified_at' column of 'users' in the schema cache (code PGRST204) — colonne users.phone_verified_at du contrat B1, migration 20261103000002
        → +   code: 'PGRST204',
    not ok 2 - numéro sans vérification : SMS au numéro seulement (aucune in-app à un compte non prouvé)
        → lecture de notification_outbox ({"type":"TRANSFER_OFFERED","keyPrefix":"TRANSFER_OFFERED:9c0b403b-ebb6-4882-898c-7cf2064c4ec4:"}) : Could not find the table 'public.notification_outbox' in the schema cache (code PGRST205) — table du contrat C2, migration 20261
        → +   code: 'PGRST205',
    not ok 3 - cible email : 400 RECIPIENT_PHONE_REQUIRED, aucun transfert, billet libre
        → markPhoneVerified 11507faf-e362-4103-a34b-aebee2fbc435 : Could not find the 'phone_verified_at' column of 'users' in the schema cache (code PGRST204) — colonne users.phone_verified_at du contrat B1, migration 20261103000002
        → +   code: 'PGRST204',
not ok 1 - 6.7 Transfert — initiation vers un numéro, sans jeton (B3, B4, amendement 2)
    not ok 1 - vérifié → l’élément ; non vérifié → phoneVerificationRequired sans détail ; autre compte → rien ; ancien transfert vers un email → rien
        → markPhoneVerified 65857809-cec6-41cc-ab79-4ce9c65eb739 : Could not find the 'phone_verified_at' column of 'users' in the schema cache (code PGRST204) — colonne users.phone_verified_at du contrat B1, migration 20261103000002
        → +   code: 'PGRST204',
not ok 2 - 6.7 Transfert — liste entrante (B3 ticket_transfers_incoming, B4)
    not ok 1 - destinataire vérifié : 200, billet transféré, identité du billet renouvelée, TRANSFER_CLAIMED_SENDER et TRANSFER_RECEIVED (in-app, push, aucun SMS) ; second appel 409
        → markPhoneVerified 048f371f-cc0e-4adb-89a1-afe71427841a : Could not find the 'phone_verified_at' column of 'users' in the schema cache (code PGRST204) — colonne users.phone_verified_at du contrat B1, migration 20261103000002
        → +   code: 'PGRST204',
    not ok 2 - refus : 404 identique (inconnu, transfert d’un autre, ancien transfert vers un email), 403 PHONE_NOT_VERIFIED, 410 TRANSFER_EXPIRED, 400 SELF_TRANSFER ; billet inchangé
        → markPhoneVerified 626d33f6-8345-434d-b795-ea609bb5b5f9 : Could not find the 'phone_verified_at' column of 'users' in the schema cache (code PGRST204) — colonne users.phone_verified_at du contrat B1, migration 20261103000002
        → +   code: 'PGRST204',
not ok 3 - 6.7 Transfert — acceptation par identifiant (B3 ticket_transfer_accept, B4)
    not ok 1 - GET et POST → 410 CLAIM_LINK_RETIRED, même réponse pour un vrai et un faux jeton ; POST sans session → 401 ; transfert intact
        → markPhoneVerified 6cd3308c-277d-432c-a373-dc2d94826929 : Could not find the 'phone_verified_at' column of 'users' in the schema cache (code PGRST204) — colonne users.phone_verified_at du contrat B1, migration 20261103000002
        → +   code: 'PGRST204',
    not ok 2 - contrôle statique : la route retirée ne lit pas la base ; la page est une redirection serveur vers /tickets?tab=recus
        → app/api/tickets/claim/[token]/route.ts : /\\bTicketTransferService\\b/ interdit (contrat B4)
not ok 4 - 6.7 Transfert — ancien lien /tickets/claim/<jeton> retiré (B4, décision 37)
    not ok 1 - code de connexion vérifié : phone_verified_at posé une fois (conservé ensuite) ; le transfert qui attendait devient visible
        → route GET /api/tickets/transfers/incoming (contrat B4) absent : app/api/tickets/transfers/incoming/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/tickets/transfers/incoming/route' imported from /home/runner/work/event-village
not ok 5 - 6.7 Transfert — verify-otp pose phone_verified_at (B1)
not ok 6 - /home/runner/work/event-village/event-village/tests/parcours/notif-transferts.test.ts
        → invariants (m)(n)(o) impossibles à vérifier (notif-transferts) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
# pass 0
# fail 9
```

Run 67 (après correctif) :

```text
    ok 1 - numéro vérifié : réponse QUEUED sans jeton ni lien, TRANSFER_OFFERED par SMS au numéro et in-app + push au compte ; SMS exact sans lien de réclamation
    ok 2 - numéro sans vérification : SMS au numéro seulement (aucune in-app à un compte non prouvé)
    ok 3 - cible email : 400 RECIPIENT_PHONE_REQUIRED, aucun transfert, billet libre
ok 1 - 6.7 Transfert — initiation vers un numéro, sans jeton (B3, B4, amendement 2)
    ok 1 - vérifié → l’élément ; non vérifié → phoneVerificationRequired sans détail ; autre compte → rien ; ancien transfert vers un email → rien
ok 2 - 6.7 Transfert — liste entrante (B3 ticket_transfers_incoming, B4)
    ok 1 - destinataire vérifié : 200, billet transféré, identité du billet renouvelée, TRANSFER_CLAIMED_SENDER et TRANSFER_RECEIVED (in-app, push, aucun SMS) ; second appel 409
    ok 2 - refus : 404 identique (inconnu, transfert d’un autre, ancien transfert vers un email), 403 PHONE_NOT_VERIFIED, 410 TRANSFER_EXPIRED, 400 SELF_TRANSFER ; billet inchangé
ok 3 - 6.7 Transfert — acceptation par identifiant (B3 ticket_transfer_accept, B4)
    ok 1 - GET et POST → 410 CLAIM_LINK_RETIRED, même réponse pour un vrai et un faux jeton ; POST sans session → 401 ; transfert intact
    ok 2 - contrôle statique : la route retirée ne lit pas la base ; la page est une redirection serveur vers /tickets?tab=recus
ok 4 - 6.7 Transfert — ancien lien /tickets/claim/<jeton> retiré (B4, décision 37)
    ok 1 - code de connexion vérifié : phone_verified_at posé une fois (conservé ensuite) ; le transfert qui attendait devient visible
ok 5 - 6.7 Transfert — verify-otp pose phone_verified_at (B1)
# pass 9
# fail 0
```

**parcours/notif-migration**

Run 60 (avant correctif) :

```text
    not ok 1 - liste blanche : chaque entrée existe (fichier ou dossier)
        → entrées de la liste blanche absentes :
        → lib/notifications/dispatcher.ts (l'envoyeur unique (contrat E4))
    not ok 2 - app, lib, components, hooks : aucun motif interdit hors de la liste blanche
        → 59 appel(s) direct(s) aux adaptateurs ou écriture(s) dans notifications :
        → app/api/admin/communications/route.ts:117 [mTargetService.send*(] mTargetService.sendSms(
    not ok 3 - routes synchrones de la liste : la méthode permise est appelée, et elle seule
        → app/api/partner/team/invite/route.ts : autre(s) méthode(s) appelée(s) : sendNotification
        → +   'app/api/partner/team/invite/route.ts : autre(s) méthode(s) appelée(s) : sendNotification'
    not ok 4 - contrat E7 : chaque appel .sendOtp( et .sendControllerInvite( de app/ passe `log:` (journal sans code)
        → appels sans journal (ctx.log) :
        → app/api/auth/register/route.ts:63 sendOtp(normalizedPhone, otpCode, { reservation: reserved.reservation })
not ok 1 - 6.7 K2 — aucun appel direct aux adaptateurs hors de l’envoyeur, de l’OTP et de l’invitation
    not ok 1 - fichiers supprimés : NotificationService, module et route event-change-notifications, stock-notifications
        → fichiers encore présents :
        → lib/notifications/notification.service.ts (NotificationService supprimé en entier (K))
    not ok 2 - aucune référence aux fonctions d’envoi retirées dans app, lib, components, hooks
        → références restantes :
        → app/api/admin/partners/[id]/status/route.ts:5 NotificationService (K) « NotificationService »
    not ok 3 - MTargetService : seules sendSms, sendNotification (alias), sendOtp et sendControllerInvite restent
        → méthodes send* de MTargetService : sendControllerAccountDeletedNotice, sendControllerActivationConfirmation, sendControllerAllEventsRevokedNotice, sendControllerAssignmentsUpdatedNotice, sendControllerInvite, sendControllerRevocationNotice, sendCounterReceipt,
        → +   'sendControllerAccountDeletedNotice',
    not ok 4 - plafond SMS (J2.13) : raiseCapAlert garde l’audit et passe par notification_admin_alert, sans écrire dans notifications
        → lib/sms/sms-guard.ts : appel de la RPC notification_admin_alert
    not ok 5 - alertes de cashout (J2.2) : lib/admin/alerts.ts garde l’audit et n’écrit plus dans notifications
        → lib/admin/alerts.ts : plus aucune écriture dans notifications
not ok 2 - 6.7 — envois TypeScript retirés
    not ok 1 - migrations du lot présentes (20261103000001 à …08)
        → migrations 20261103* du lot (contrat R) : aucune
        → + []
    not ok 2 - pg_get_functiondef : seule notification_outbox_mark contient INSERT INTO public.notifications
        → fonctions qui écrivent dans public.notifications : event_notify, event_update, fin_alert_superadmins, shift_close
        → +   'event_notify',
    not ok 3 - event_change_notifications, event_change_notifications_claim, _mark et event_notify n’existent plus
        → table public.event_change_notifications encore présente (J1.9)
        → + 'event_change_notifications'
    not ok 4 - la migration 20261103000005 supprime la table et les RPC du lot 5 après la reprise
        → supabase/migrations/20261103000005_lot6_billetterie.sql absent (contrat R)
not ok 3 - 6.7 — base : un seul écrivain de notifications, objets du lot 5 supprimés
    not ok 1 - registre notification_types : tous les types de l’inventaire (K1) et des envois TypeScript
        → table public.notification_types absente (contrat C1, migration 20261103000002)
    not ok 2 - RPC recopiées : chacune existe et nomme ses types
        → B1-B3, B4 : public.payment_confirm ne met pas 'PURCHASE_CONFIRMED' en file
        → B1-B3, B4 : public.payment_confirm ne met pas 'NEW_ORDER' en file
    not ok 3 - triggers : chacun existe sur sa table et sa fonction nomme ses types
        → B5 : trigger trg_tickets_first_sale absent de public.tickets
        → B13 : trigger trg_tickets_scanned_notify absent de public.tickets
not ok 4 - 6.7 K1 — inventaire : chaque envoi migré a son type au registre et son point d’insertion en base
    not ok 1 - une ligne par statut : statut, motif, détail, tentatives, dates et données repris selon la table du contrat
        → supabase/migrations/20261103000005_lot6_billetterie.sql absent (contrat R, J1.9)
not ok 5 - 6.7 J1.9 — reprise des lignes d’event_change_notifications dans la boîte d’envoi
    not ok 1 - notif_admin_recipients : users.role = ADMIN sans user_roles → exclu ; ADMIN de user_roles avec users.role = CLIENT → inclus
        → fonction public.notif_admin_recipients absente (contrat D)
    not ok 2 - lib : aucune requête from('users') filtrée sur role pour choisir des destinataires
        → destinataires lus par users.role :
        → lib/notifications/notification.service.ts:22
not ok 6 - 6.7 — destinataires admin par user_roles et permissions, jamais par users.role (décision 13)
    not ok 1 - notif_admin_recipients(NULL) : au moins le SUPERADMIN du seed, uniquement des comptes ACTIF, aucun identifiant inconnu
        → fonction public.notif_admin_recipients absente (contrat D)
not ok 7 - 6.7 — destinataires admin actifs
not ok 8 - /home/runner/work/event-village/event-village/tests/parcours/notif-migration.test.ts
        → invariants (m)(n)(o) impossibles à vérifier (notif-migration) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
# pass 0
# fail 20
```

Run 67 (après correctif) :

```text
    ok 1 - liste blanche : chaque entrée existe (fichier ou dossier)
    ok 2 - app, lib, components, hooks : aucun motif interdit hors de la liste blanche
    ok 3 - routes synchrones de la liste : la méthode permise est appelée, et elle seule
    ok 4 - contrat E7 : chaque appel .sendOtp( et .sendControllerInvite( de app/ passe `log:` (journal sans code)
ok 1 - 6.7 K2 — aucun appel direct aux adaptateurs hors de l’envoyeur, de l’OTP et de l’invitation
    ok 1 - fichiers supprimés : NotificationService, module et route event-change-notifications, stock-notifications
    ok 2 - aucune référence aux fonctions d’envoi retirées dans app, lib, components, hooks
    ok 3 - MTargetService : seules sendSms, sendNotification (alias), sendOtp et sendControllerInvite restent
    ok 4 - plafond SMS (J2.13) : raiseCapAlert garde l’audit et passe par notification_admin_alert, sans écrire dans notifications
    ok 5 - alertes de cashout (J2.2) : lib/admin/alerts.ts garde l’audit et n’écrit plus dans notifications
ok 2 - 6.7 — envois TypeScript retirés
    ok 1 - migrations du lot présentes (20261103000001 à …08)
    ok 2 - pg_get_functiondef : seule notification_outbox_mark contient INSERT INTO public.notifications
    ok 3 - event_change_notifications, event_change_notifications_claim, _mark et event_notify n’existent plus
    ok 4 - la migration 20261103000005 supprime la table et les RPC du lot 5 après la reprise
ok 3 - 6.7 — base : un seul écrivain de notifications, objets du lot 5 supprimés
    ok 1 - registre notification_types : tous les types de l’inventaire (K1) et des envois TypeScript
    ok 2 - RPC recopiées : chacune existe et nomme ses types
    ok 3 - triggers : chacun existe sur sa table et sa fonction nomme ses types
ok 4 - 6.7 K1 — inventaire : chaque envoi migré a son type au registre et son point d’insertion en base
    ok 1 - une ligne par statut : statut, motif, détail, tentatives, dates et données repris selon la table du contrat
ok 5 - 6.7 J1.9 — reprise des lignes d’event_change_notifications dans la boîte d’envoi
    ok 1 - notif_admin_recipients : users.role = ADMIN sans user_roles → exclu ; ADMIN de user_roles avec users.role = CLIENT → inclus
    ok 2 - lib : aucune requête from('users') filtrée sur role pour choisir des destinataires
ok 6 - 6.7 — destinataires admin par user_roles et permissions, jamais par users.role (décision 13)
    ok 1 - notif_admin_recipients(NULL) : au moins le SUPERADMIN du seed, uniquement des comptes ACTIF, aucun identifiant inconnu
ok 7 - 6.7 — destinataires admin actifs
# pass 20
# fail 0
```

### 6.8 — Supervision admin

```text
$ git ls-tree -r --name-only fff03b1 -- app/admin/notifications app/api/admin/notifications
(code de sortie 0)

$ git ls-tree -r --name-only 3a246ad -- app/admin/notifications app/api/admin/notifications
app/admin/notifications/[id]/page.tsx
app/admin/notifications/page.tsx
app/api/admin/notifications/[id]/retry/route.ts
app/api/admin/notifications/[id]/route.ts
app/api/admin/notifications/route.ts
app/api/admin/notifications/stats/route.ts
(code de sortie 0)

$ git grep -n -E ''"'"'notifications\.(read|write)'"'"'' fff03b1 -- lib/admin/admin-auth.ts
(code de sortie 1)

$ git grep -n -E ''"'"'notifications\.(read|write)'"'"'' 3a246ad -- lib/admin/admin-auth.ts
3a246ad:lib/admin/admin-auth.ts:37:    'notifications.read',
3a246ad:lib/admin/admin-auth.ts:38:    'notifications.write',
(code de sortie 0)
```

**Correctif** (migration `…08`, commits `f319b82`, `0009721`, `288dc5e`) : RPC `admin_notifications_list`, `admin_notification_detail` (aucun code OTP : le journal synchrone ne contient pas le code), `admin_notifications_stats`, `notification_retry` (FAILED seulement, jamais SENT ni UNCERTAIN, audit) ; routes protégées par `requireActiveSession` puis `verifyAdminAuth` avec `notifications.read` ou `notifications.write` ; pages `/admin/notifications` et `/admin/notifications/[id]`.

**parcours/notif-admin**

Run 60 (avant correctif) :

```text
    not ok 1 - statut FAILED : uniquement des FAILED, les 3 de la suite en tête (created_at DESC), can_retry vrai ; compteurs par statut
        → test did not finish before its parent and was cancelled
    not ok 2 - pagination : page_size 2, page 1 puis page 2, sans recouvrement ; 20 par défaut
        → test did not finish before its parent and was cancelled
    not ok 3 - canal, type et période : chaque filtre restreint la liste ; période en jours de Dakar
        → test did not finish before its parent and was cancelled
    not ok 4 - filtre inconnu (statut, canal, type) → 400 INVALID_FILTER
        → test did not finish before its parent and was cancelled
    not ok 5 - destinataire masqué : numéro « +221 77 *** ** 45 », email « aw***@domaine », compte par son nom, jamais d’endpoint push
        → test did not finish before its parent and was cancelled
    not ok 6 - détail : ligne sans claim_token, destinataire, décision, données ; can_retry selon le statut ; inconnue → 404 NOT_FOUND
        → test did not finish before its parent and was cancelled
    not ok 7 - journal OTP : template_data réduit à { purpose }, aucun code ni lien, jamais relançable
        → test did not finish before its parent and was cancelled
not ok 1 - 6.8 Liste des notifications : filtres, pagination, destinataire masqué (L2, L3)
        → abonnement push : Could not find the table 'public.push_subscriptions' in the schema cache (code PGRST205) — table push_subscriptions du contrat C5
        → +   code: 'PGRST205',
    not ok 1 - par différence autour de lignes de la suite : SMS envoyés (journal OTP compris), échecs, incertains, non envoyés, annulés ; email ; seuil
        → GET /api/admin/notifications/stats (contrat L3) absent : app/api/admin/notifications/stats/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/admin/notifications/stats/route' imported from /home/runner/work/event-village/event-vi
not ok 2 - 6.8 Statistiques : par canal et par jour, SMS du mois et du jour (L2)
    not ok 1 - sans session 401 ; client 403 ; ADMIN sans permission 403 partout ; lecture seule : lecture oui, relance 403 ; SUPERADMIN : lecture
        → GET /api/admin/notifications (contrat L3) absent : app/api/admin/notifications/route — Cannot find module '/home/runner/work/event-village/event-village/app/api/admin/notifications/route' imported from /home/runner/work/event-village/event-village/tests/parcou
    not ok 2 - lib/admin/admin-auth.ts : notifications.read et notifications.write sont des permissions connues
        → notifications.read dans ADMIN_PERMISSIONS
not ok 3 - 6.8 Permissions notifications.read et notifications.write (L1, L3)
    not ok 1 - RPC notification_retry : acteur ADMIN en lecture seule, ADMIN suspendu ou client → FORBIDDEN, ligne intacte
        → test did not finish before its parent and was cancelled
    not ok 2 - route : lecture seule 403, ADMIN suspendu 403 ; la ligne reste FAILED
        → test did not finish before its parent and was cancelled
    not ok 3 - notifications.write : FAILED → PENDING, tentatives remises à zéro, motif effacé, manual_retries 1, audit ; seconde relance 409
        → test did not finish before its parent and was cancelled
    not ok 4 - SENT, UNCERTAIN, SKIPPED, CANCELLED, PENDING, SENDING → 409 NOT_RETRYABLE, message exact, ligne inchangée
        → test did not finish before its parent and was cancelled
    not ok 5 - SUPERADMIN : relance d’une ligne FAILED ; ligne inconnue → 404
        → test did not finish before its parent and was cancelled
not ok 4 - 6.8 Relance : FAILED seulement, permission vérifiée aussi par la RPC (L2, L3)
        → insertOutboxRow {"type":"PURCHASE_CONFIRMED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":5,"max_attempts":5,"due_at":"2026-12-02T18:55:17.533Z","next_attempt_at":"2026-12-02T18:55:17.533Z","recipient_phone":"+221766706780","finished_at
        → +   code: 'PGRST205',
    not ok 1 - statuts, canaux, chaque motif de C4 et chaque type du registre ont un libellé français, jamais le code
        → libellés de la boîte d’envoi (contrat L4) absent : lib/notifications/outbox-labels — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/outbox-labels' imported from /home/runner/work/event-village/event-village/tests/parcours/n
not ok 5 - 6.8 Libellés humains (lib/notifications/outbox-labels.ts, L4)
not ok 6 - /home/runner/work/event-village/event-village/tests/parcours/notif-admin.test.ts
        → invariants (m)(n)(o) impossibles à vérifier (notif-admin) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
# pass 0
# fail 4
```

Run 67 (après correctif) :

```text
    ok 1 - statut FAILED : uniquement des FAILED, les 3 de la suite en tête (created_at DESC), can_retry vrai ; compteurs par statut
    ok 2 - pagination : page_size 2, page 1 puis page 2, sans recouvrement ; 20 par défaut
    ok 3 - canal, type et période : chaque filtre restreint la liste ; période en jours de Dakar
    ok 4 - filtre inconnu (statut, canal, type) → 400 INVALID_FILTER
    ok 5 - destinataire masqué : numéro « +221 77 *** ** 45 », email « aw***@domaine », compte par son nom, jamais d’endpoint push
    ok 6 - détail : ligne sans claim_token, destinataire, décision, données ; can_retry selon le statut ; inconnue → 404 NOT_FOUND
    ok 7 - journal OTP : template_data réduit à { purpose }, aucun code ni lien, jamais relançable
ok 1 - 6.8 Liste des notifications : filtres, pagination, destinataire masqué (L2, L3)
    ok 1 - par différence autour de lignes de la suite : SMS envoyés (journal OTP compris), échecs, incertains, non envoyés, annulés ; email ; seuil
ok 2 - 6.8 Statistiques : par canal et par jour, SMS du mois et du jour (L2)
    ok 1 - sans session 401 ; client 403 ; ADMIN sans permission 403 partout ; lecture seule : lecture oui, relance 403 ; SUPERADMIN : lecture
    ok 2 - lib/admin/admin-auth.ts : notifications.read et notifications.write sont des permissions connues
ok 3 - 6.8 Permissions notifications.read et notifications.write (L1, L3)
    ok 1 - RPC notification_retry : acteur ADMIN en lecture seule, ADMIN suspendu ou client → FORBIDDEN, ligne intacte
    ok 2 - route : lecture seule 403, ADMIN suspendu 403 ; la ligne reste FAILED
    ok 3 - notifications.write : FAILED → PENDING, tentatives remises à zéro, motif effacé, manual_retries 1, audit ; seconde relance 409
    ok 4 - SENT, UNCERTAIN, SKIPPED, CANCELLED, PENDING, SENDING → 409 NOT_RETRYABLE, message exact, ligne inchangée
    ok 5 - SUPERADMIN : relance d’une ligne FAILED ; ligne inconnue → 404
ok 4 - 6.8 Relance : FAILED seulement, permission vérifiée aussi par la RPC (L2, L3)
    ok 1 - statuts, canaux, chaque motif de C4 et chaque type du registre ont un libellé français, jamais le code
ok 5 - 6.8 Libellés humains (lib/notifications/outbox-labels.ts, L4)
# pass 16
# fail 0
```

### 6.9 — Planification indépendante de l'hébergeur

```text
$ git ls-tree --name-only fff03b1 -- supabase/ops/
(code de sortie 0)

$ git ls-tree --name-only 3a246ad -- supabase/ops/
supabase/ops/schedule-crons.sql
supabase/ops/unschedule-crons.sql
(code de sortie 0)

$ git grep -c -E 'cron\.schedule\(' fff03b1 -- supabase/ops docs/deploiement-projet-neuf.md
fff03b1:docs/deploiement-projet-neuf.md:1
(code de sortie 0)

$ git grep -c -E 'cron\.schedule\(' 3a246ad -- supabase/ops docs/deploiement-projet-neuf.md
3a246ad:supabase/ops/schedule-crons.sql:2
(code de sortie 0)
```

**Correctif** (commit `299f957`) : `supabase/ops/schedule-crons.sql` (contrôle préalable des extensions et des secrets Vault, refus d'une URL HTTP hors local, 9 tâches recréées à l'identique, toute autre tâche `ev_*` retirée, script relançable) et `supabase/ops/unschedule-crons.sql` (retire les tâches `ev_*`, laisse secrets et extensions). Fréquences : envoyeur `* * * * *` (première relance à 1 min, confirmation d'achat et cloche sans attendre 5 min), rappels `1-59/5 * * * *` (tolérance de 15 min), réconciliation `*/5`, fin des événements `3-59/15`, tâches horaires décalées aux minutes 7, 17, 27 et 37, purge de `cron.job_run_details` chaque nuit. `docs/deploiement-projet-neuf.md` §7 réécrit (procédure pas à pas, tableau des tâches), §5 (variables).

**schema/planification-crons**

Run 60 (avant correctif) :

```text
    ok 1 - sonde : pg_cron et pg_net disponibles, pg_cron préchargé, Vault disponible (échec explicite sinon)
    not ok 2 - scripts d’exploitation : présents, encadrés, hors des migrations, sans secret ni en-tête en clair ; aucune migration ne planifie
        → supabase/ops/schedule-crons.sql absent (contrat M1/M2 : script d'exploitation, pas une migration)
    not ok 3 - schedule-crons.sql : refus sans secrets ; deux exécutions → exactement les 9 tâches, sans secret en clair ; unschedule-crons.sql deux fois → aucune
        → supabase/ops/schedule-crons.sql absent (contrat M1/M2 : script d'exploitation, pas une migration)
    not ok 4 - docs/deploiement-projet-neuf.md : procédure Vault et scripts, 9 tâches, nouvelles routes et variables, plus de secret en clair (M4)
        → la documentation de déploiement cite « supabase/ops/schedule-crons.sql »
not ok 1 - 6.9 Planification par pg_cron et pg_net (contrat M)
not ok 2 - /home/runner/work/event-village/event-village/tests/schema/planification-crons.test.ts
        → invariants (m)(n)(o) impossibles à vérifier (planification-crons) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
# pass 1
# fail 3
```

Run 67 (après correctif) :

```text
    ok 1 - sonde : pg_cron et pg_net disponibles, pg_cron préchargé, Vault disponible (échec explicite sinon)
    ok 2 - scripts d’exploitation : présents, encadrés, hors des migrations, sans secret ni en-tête en clair ; aucune migration ne planifie
    ok 3 - schedule-crons.sql : refus sans secrets ; deux exécutions → exactement les 9 tâches, sans secret en clair ; unschedule-crons.sql deux fois → aucune
    ok 4 - docs/deploiement-projet-neuf.md : procédure Vault et scripts, 9 tâches, nouvelles routes et variables, plus de secret en clair (M4)
ok 1 - 6.9 Planification par pg_cron et pg_net (contrat M)
# pass 4
# fail 0
```

### 6.10 — Cloche et centre de notifications

```text
$ git grep -n -E '\.eq\('"'"'channel'"'"'|notifications_page|unreadCount' fff03b1 -- app/api/notifications/route.ts
fff03b1:app/api/notifications/route.ts:9: * unreadCount (cloche) : notifications de l'application seulement (canal PUSH) dont le statut n'est pas READ
fff03b1:app/api/notifications/route.ts:42:        const { count: unreadCount, error: countError } = await supabase
fff03b1:app/api/notifications/route.ts:46:            .eq('channel', 'PUSH')
fff03b1:app/api/notifications/route.ts:68:            unreadCount: unreadCount || 0,
(code de sortie 0)

$ git grep -n -E '\.eq\('"'"'channel'"'"'|notifications_page|unreadCount' 3a246ad -- app/api/notifications/route.ts
3a246ad:app/api/notifications/route.ts:15: *   total et le compteur des non lues sont calculés par la RPC notifications_page sur ce même ensemble ;
3a246ad:app/api/notifications/route.ts:98:    const { data, error } = await getServiceRoleClient().rpc('notifications_page', {
3a246ad:app/api/notifications/route.ts:109:        console.error('[API GET /api/notifications] notifications_page :', error ? `${error.code ?? ''} ${error.message}` : JSON.stringify(body));
3a246ad:app/api/notifications/route.ts:118:        unreadCount: Number(body.unread_count ?? 0),
(code de sortie 0)
```

**Correctif** (migration `…07`, commits `539b908`, `cd8e109`, `c77cd05`) : données passées en IN_APP ; écritures REST sur `notifications` fermées (politiques retirées, privilèges révoqués) ; RPC `notifications_page` (liste paginée, non lues d'abord, total et compteur sur le même ensemble) et `notifications_mark_read` ; cloche et page `/notifications` réécrites (onglets par catégorie, « Tout marquer comme lu », liens internes seulement, libellés humains, en direct par `useRealtimeRefresh`).

**parcours/notif-cloche**

Run 60 (avant correctif) :

```text
    not ok 1 - cloche (?limit=20) : 20 non lues en tête, badge 25, total 30, sans canal
        → ordre : non lues d’abord (les 20 plus récentes), jamais les lues plus récentes en tête
        → ... Skipped lines
    not ok 2 - onglet « Non lues » : 25 non lues sur 2 pages de 20, sans recouvrement ni lue
        → page 1 : les 20 non lues les plus récentes
        → ... Skipped lines
    not ok 3 - « Toutes », page 2 : les 5 non lues les plus anciennes puis les 5 lues
        → page 2 : fin des non lues, puis les lues par date décroissante
        → +   'c89ccbdc-2830-424b-87c9-9a9ccf7069a1',
    not ok 4 - catégorie (?category=ticket) : types traduits par le serveur, compteur sans filtre de type ; catégorie inconnue → 400
        → les 10 notifications TICKET seulement, non lues d’abord
        → +   'c89ccbdc-2830-424b-87c9-9a9ccf7069a1',
    not ok 5 - actionUrl : chemin interne seulement ; externe, //, \\ et javascript: → null
        → actionUrl de « /events/7f0c2c1e-0000-4000-8000-000000000001 » : "/events/7f0c2c1e-0000-4000-8000-000000000001" attendu, reçu undefined
        → + undefined
not ok 1 - 6.10 Liste et compteur : même ensemble, non lues d’abord, pagination serveur (N1, N2)
    not ok 1 - une seule : PATCH [id]/read → lue, compteur 24 ; la ligne d’un autre compte → 404 et intacte ; id inconnu → 404
        → marquage d’une notification : HTTP 400 {"error":"ID de notification requis."}
        → 400 !== 200
    not ok 2 - toutes : PATCH /api/notifications → updated 24, compteur 0, total inchangé ; l’autre compte intact
        → 24 notifications passées à lues (une l’était déjà), reçu undefined
        → undefined !== 24
not ok 2 - 6.10 « Tout marquer comme lu » et une seule (N1, N2)
    not ok 1 - notifications_page : filtre de types sur la liste, unread_count sur tout le compte
        → notifications_page : Could not find the function public.notifications_page(p) in the schema cache (code PGRST202) — RPC du contrat N1, migration 20261103000007
        → +   code: 'PGRST202',
    not ok 2 - notifications_mark_read : la ligne d’un autre compte n’est pas touchée (updated 0) ; toutes : updated 25
        → notifications_mark_read : Could not find the function public.notifications_mark_read(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
not ok 3 - 6.10 RPC notifications_page et notifications_mark_read (N1)
    not ok 1 - chemin interne gardé ; schéma, //, \\, relatif, vide ou non textuel → null
        → lien interne partagé (contrat G1) absent : lib/notifications/action-url — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/action-url' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.t
not ok 4 - 6.10 internalActionUrl (lib/notifications/action-url.ts, G1 et N2)
    not ok 1 - colonne texte à défaut IN_APP, CHECK notifications_channel_in_app : PUSH et SMS refusés, IN_APP accepté (transaction annulée)
        → notifications.channel en texte (contrat F1), type USER-DEFINED
        → + 'USER-DEFINED'
    not ok 2 - aucune notification d’un autre canal en base
        → notifications hors IN_APP : [{"channel":"PUSH","n":"959"}]
        → +     channel: 'PUSH',
not ok 5 - 6.10 Canal toujours IN_APP (F1, migration 20261103000007)
    not ok 1 - SUSPENDU → 403 ACCOUNT_NOT_ACTIVE sur la liste et le marquage ; EN_ATTENTE → 200 ; sans session → 401
        → compte suspendu : liste refusée, HTTP 200 {"notifications":[{"id":"8ee0d3d8-f493-433c-b843-519489ef2c70","userId":"332f179c-253e-4cbd-8c96-0fa028b9b202","type":"PAYMENT_SUCCESS","title":"TEST cloche suspendu 53303bdf lue 4","content":"Contenu de test de la clo
        → 200 !== 403
not ok 6 - 6.10 Statut du compte (N2 : ACTIF et EN_ATTENTE admis)
    not ok 1 - ligne IN_APP PASSWORD_CHANGED → INSERT reçu par le destinataire, au texte du catalogue ; rien chez un autre compte ; en tête de la cloche
        → insertOutboxRow {"type":"PASSWORD_CHANGED","family":"ESSENTIAL","origin":"OUTBOX","template_data":{},"attempts":0,"max_attempts":5,"due_at":"2026-11-02T18:55:33.186Z","next_attempt_at":"2026-11-02T18:55:33.186Z","channel":"IN_APP","recipient_user_id":"cc53ad0c
        → +   code: 'PGRST205',
not ok 7 - 6.10 Temps réel : une notification livrée par l’envoyeur arrive au destinataire seul (N3, E2)
    not ok 1 - les 11 nouveaux inAppType ont leur libellé et leur catégorie
        → types sans libellé dans lib/notifications/notification-types.ts : TICKET_TRANSFER, REMINDER, SALES, REFUND_PROGRESS, WITHDRAWAL_PENDING_CHECK, TRIAL, CONTROLLER, ADMIN_REVIEW, NOTIFICATION_ALERT, SMS_DAILY_THRESHOLD, PROMOTION
        → +   'TICKET_TRANSFER',
    not ok 2 - chaque inAppType du catalogue a un libellé (jamais « Information » par défaut ni le code brut)
        → catalogue des modèles (contrat G1) absent : lib/notifications/catalog — Cannot find module '/home/runner/work/event-village/event-village/lib/notifications/catalog' imported from /home/runner/work/event-village/event-village/tests/parcours/notif-helpers.ts
not ok 8 - 6.10 Libellés humains des types (G1, NOTIFICATION_TYPE_META)
    not ok 1 - NotificationBell : chaînes figées conservées, « Non lues » par le serveur, libellés partagés, lien vers les préférences
        → onglet « Non lues » chargé par ?limit=20&filter=unread
    not ok 2 - page /notifications : chaînes figées conservées, pagination et onglets servis par le serveur
        → composant Pagination (pagination serveur)
not ok 9 - 6.10 Cloche et page : chaînes figées et chargement par le serveur (N3)
not ok 10 - /home/runner/work/event-village/event-village/tests/parcours/notif-cloche.test.ts
        → invariants (m)(n)(o) impossibles à vérifier (notif-cloche) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
# pass 0
# fail 18
```

Run 67 (après correctif) :

```text
    ok 1 - cloche (?limit=20) : 20 non lues en tête, badge 25, total 30, sans canal
    ok 2 - onglet « Non lues » : 25 non lues sur 2 pages de 20, sans recouvrement ni lue
    ok 3 - « Toutes », page 2 : les 5 non lues les plus anciennes puis les 5 lues
    ok 4 - catégorie (?category=ticket) : types traduits par le serveur, compteur sans filtre de type ; catégorie inconnue → 400
    ok 5 - actionUrl : chemin interne seulement ; externe, //, \\ et javascript: → null
ok 1 - 6.10 Liste et compteur : même ensemble, non lues d’abord, pagination serveur (N1, N2)
    ok 1 - une seule : PATCH [id]/read → lue, compteur 24 ; la ligne d’un autre compte → 404 et intacte ; id inconnu → 404
    ok 2 - toutes : PATCH /api/notifications → updated 24, compteur 0, total inchangé ; l’autre compte intact
ok 2 - 6.10 « Tout marquer comme lu » et une seule (N1, N2)
    ok 1 - notifications_page : filtre de types sur la liste, unread_count sur tout le compte
    ok 2 - notifications_mark_read : la ligne d’un autre compte n’est pas touchée (updated 0) ; toutes : updated 25
ok 3 - 6.10 RPC notifications_page et notifications_mark_read (N1)
    ok 1 - chemin interne gardé ; schéma, //, \\, relatif, vide ou non textuel → null
ok 4 - 6.10 internalActionUrl (lib/notifications/action-url.ts, G1 et N2)
    ok 1 - colonne texte à défaut IN_APP, CHECK notifications_channel_in_app : PUSH et SMS refusés, IN_APP accepté (transaction annulée)
    ok 2 - aucune notification d’un autre canal en base
ok 5 - 6.10 Canal toujours IN_APP (F1, migration 20261103000007)
    ok 1 - SUSPENDU → 403 ACCOUNT_NOT_ACTIVE sur la liste et le marquage ; EN_ATTENTE → 200 ; sans session → 401
ok 6 - 6.10 Statut du compte (N2 : ACTIF et EN_ATTENTE admis)
    ok 1 - ligne IN_APP PASSWORD_CHANGED → INSERT reçu par le destinataire, au texte du catalogue ; rien chez un autre compte ; en tête de la cloche
ok 7 - 6.10 Temps réel : une notification livrée par l’envoyeur arrive au destinataire seul (N3, E2)
    ok 1 - les 11 nouveaux inAppType ont leur libellé et leur catégorie
    ok 2 - chaque inAppType du catalogue a un libellé (jamais « Information » par défaut ni le code brut)
ok 8 - 6.10 Libellés humains des types (G1, NOTIFICATION_TYPE_META)
    ok 1 - NotificationBell : chaînes figées conservées, « Non lues » par le serveur, libellés partagés, lien vers les préférences
    ok 2 - page /notifications : chaînes figées conservées, pagination et onglets servis par le serveur
ok 9 - 6.10 Cloche et page : chaînes figées et chargement par le serveur (N3)
# pass 18
# fail 0
```

### 6.11 — Invariants (m)(n)(o)

```text
$ git ls-tree --name-only fff03b1 -- tests/helpers/payment-invariants.ts tests/helpers/finance-invariants.ts tests/helpers/access-invariants.ts tests/helpers/lifecycle-invariants.ts tests/helpers/notification-invariants.ts
tests/helpers/access-invariants.ts
tests/helpers/finance-invariants.ts
tests/helpers/lifecycle-invariants.ts
tests/helpers/payment-invariants.ts
(code de sortie 0)

$ git ls-tree --name-only 3a246ad -- tests/helpers/payment-invariants.ts tests/helpers/finance-invariants.ts tests/helpers/access-invariants.ts tests/helpers/lifecycle-invariants.ts tests/helpers/notification-invariants.ts
tests/helpers/access-invariants.ts
tests/helpers/finance-invariants.ts
tests/helpers/lifecycle-invariants.ts
tests/helpers/notification-invariants.ts
tests/helpers/payment-invariants.ts
(code de sortie 0)
```

**Correctif :** l'aide `tests/helpers/notification-invariants.ts` (`f610ba3`) est appelée dans l'`after()` de chaque suite du lot, et à la fin du seed de démonstration (`1ab1623`). Requêtes et sortie en section 4. Les suites `tests/security/r20`, `r21` et `r22` ne l'appellent pas : la règle du lot 1A y interdit toute connexion autre que la clé anon.

**parcours/notif-invariant**

Run 60 (avant correctif) :

```text
    not ok 1 - (m) une seule ligne SENT ou SENDING par clé ; aucune ligne optionnelle SENT sans préférence activée
        → invariants (m)(n)(o) impossibles à vérifier (notif-invariant (m)) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
    not ok 2 - (n) rappels : événement non PUBLIE, porteur sans billet VALIDE, SMS optionnel dans la plage de silence
        → invariants (m)(n)(o) impossibles à vérifier (notif-invariant (n)) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
    not ok 3 - (o) SENDING de plus de 10 min, tentatives au-delà du maximum, ligne terminée sans motif
        → invariants (m)(n)(o) impossibles à vérifier (notif-invariant (o)) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
not ok 1 - 6.11 Invariants (m)(n)(o) : chaque règle détecte une violation fabriquée (transaction annulée)
    not ok 1 - après ROLLBACK, aucune ligne fabriquée ne reste dans la boîte d’envoi ni dans les violations
        → les garde-fous ci-dessus ont fabriqué des lignes
not ok 2 - 6.11 Invariants (m)(n)(o) sur l’état réel
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/notif-invariant.test.ts
        → invariants (m)(n)(o) impossibles à vérifier (notif-invariant) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
# pass 0
# fail 4
```

Run 67 (après correctif) :

```text
    ok 1 - (m) une seule ligne SENT ou SENDING par clé ; aucune ligne optionnelle SENT sans préférence activée
    ok 2 - (n) rappels : événement non PUBLIE, porteur sans billet VALIDE, SMS optionnel dans la plage de silence
    ok 3 - (o) SENDING de plus de 10 min, tentatives au-delà du maximum, ligne terminée sans motif
ok 1 - 6.11 Invariants (m)(n)(o) : chaque règle détecte une violation fabriquée (transaction annulée)
    ok 1 - après ROLLBACK, aucune ligne fabriquée ne reste dans la boîte d’envoi ni dans les violations
ok 2 - 6.11 Invariants (m)(n)(o) sur l’état réel
# pass 4
# fail 0
```

### Écrans (6.0 e, f, g, puis 6.2 à 6.10)

Contrôles statiques des écrans (`notif-interface`) et liste blanche du système de design (`design-systeme`). Commits d'écran : `b5de823`, `5ca1b1a`, `647e966`, `ace584b`, `0009721`, `cd8e109`, `fb0c3b0` ; corrections après relecture : `288dc5e`, `c77cd05`, `1422502`.

**parcours/notif-interface**

Run 60 (avant correctif) :

```text
    ok 1 - garde-fou : chaque fichier créé ou touché par l'interface du lot 6 figure dans MIGRATED_DESIGN_FILES
ok 1 - Q — liste blanche du système de design (tests/helpers/design-files.ts)
    not ok 1 - app/login/page.tsx : composant serveur (ni « use client », ni useSearchParams, ni Suspense) qui lit searchParams et rend LoginForm
        → app/login/page.tsx :
        → directive « use client » (la page doit être un composant serveur)
    not ok 2 - LoginForm : libellés figés « Email ou téléphone » et « Mot de passe » liés à leur champ, bouton « Se connecter »
        → components/auth/LoginForm.tsx absent (contrat A5 : formulaire client de la connexion)
    not ok 3 - LoginForm : logique conservée (verrou client et 429 serveur, téléphone → email, OTP type « email », SUSPENDU, refreshSession, resolvePostLoginRoute)
        → components/auth/LoginForm.tsx absent (contrat A5 : formulaire client de la connexion)
    not ok 4 - connexion sur le système de design : PageHeader « Connexion », StatusBanner, œil en IconButton focalisable, bascule aria-pressed, aucun « F5 », animations en motion-safe:
        → components/auth/LoginForm.tsx absent (contrat A5 : formulaire client de la connexion)
not ok 2 - 6.0 e — connexion : composant serveur et formulaire client (A5)
    not ok 1 - app/register/page.tsx : PageHeader « Créer un compte » (un seul <h1>), œil focalisable, animations en motion-safe:, logique conservée
        → app/register/page.tsx :
        → aucun PageHeader de titre « Créer un compte »
    not ok 2 - app/forgot-password/page.tsx : PageHeader « Mot de passe oublié » (un seul <h1>), œil focalisable, animations en motion-safe:, logique conservée
        → app/forgot-password/page.tsx :
        → aucun PageHeader de titre « Mot de passe oublié »
    not ok 3 - app/reset-password/page.tsx : PageHeader « Nouveau mot de passe » (un seul <h1>), œil focalisable, animations en motion-safe:, logique conservée
        → app/reset-password/page.tsx :
        → aucun PageHeader de titre « Nouveau mot de passe »
    not ok 4 - OtpInput : 6 champs numériques nommés « Chiffre N sur 6 », one-time-code, 44 px, collage d'un code complet, anneau ring
        → components/auth/OtpInput.tsx :
        → aria-label « Chiffre N sur 6 »
not ok 3 - 6.0 e — inscription, mot de passe oublié, réinitialisation, OtpInput (A5)
    not ok 1 - Badge et StatusBadge posent data-ev-caption (texte de 12 px admis par le contrôle des captures)
        → sans attribut data-ev-caption : components/ui/Badge.tsx, components/ui/StatusBadge.tsx
        → +   'components/ui/Badge.tsx',
    not ok 2 - app/globals.css : bouton de fermeture de la bulle Leaflet à 44 × 44 px par un sélecteur plus spécifique que leaflet.css:527-535
        → aucune règle « .leaflet-container .leaflet-popup a.leaflet-popup-close-button » : le sélecteur actuel (.leaflet-container a.leaflet-popup-close-button) est le même que celui de leaflet.css, chargé après, qui impose 24 × 24 px
not ok 4 - 6.0 f — textes admis et bulle Leaflet (A6)
    not ok 1 - ScrollableTabs déplacé dans components/ui (ancien fichier supprimé, imports mis à jour), indices w-8 et scroll-padding
        → components/ui/ScrollableTabs.tsx absent
        → components/partner/pilotage/ScrollableTabs.tsx existe encore (contrat A7 : déplacé, ancien fichier supprimé)
    not ok 2 - file admin (app/admin/events/page.tsx) : onglets de statut en ScrollableTabs (8 onglets, indice de débordement)
        → app/admin/events/page.tsx :
        → ScrollableTabs non importé de @/components/ui/ScrollableTabs
    not ok 3 - scanner : boutons « Caméra » / « Saisie manuelle » sur une ligne à 390 px (px-4 gap-2 text-sm whitespace-nowrap, hauteur de 48 px gardée)
        → app/controller/scanner/page.tsx :
        → « Caméra » sans whitespace-nowrap, px-4, gap-2, text-sm
    not ok 4 - components/ui/Skeleton.tsx sur les tokens : bg-surface-sunken, cartes bg-surface border-border, motion-safe:animate-pulse, aucune palette brute
        → components/ui/Skeleton.tsx :
        → palette brute : bg-slate-200/80, dark:bg-zinc-800/80, border-slate-200/80, dark:border-zinc-800, bg-white, dark:bg-zinc-900, border-slate-100
    not ok 5 - les 7 fichiers loading.tsx sur la nouvelle palette (aucune couleur brute, animations en motion-safe:)
        → app/events/[id]/loading.tsx : palette brute (border-slate-200/80, dark:border-zinc-800, bg-white, dark:bg-zinc-900)
        → app/orders/loading.tsx : palette brute (border-slate-200/80, dark:border-zinc-800, bg-white, dark:bg-zinc-900, divide-slate-100, dark:divide-zinc-800)
    not ok 6 - components/ui/LoadingSkeleton.tsx : supprimé s'il n'a aucun import, sinon migré et listé
        → components/ui/LoadingSkeleton.tsx existe sans aucun import dans app/, components/ ni hooks/ (contrat A7 : à supprimer)
not ok 5 - 6.0 g — détails du lot 5 (A7)
    not ok 1 - Notification.requestPermission n'apparaît que dans lib/push/client.ts (enablePush), nulle part ailleurs dans app/, components/, hooks/, lib/, public/
        → lib/push/client.ts absent (contrat F4 : client push du navigateur)
    not ok 2 - enablePush n'est appelée que depuis un gestionnaire onClick (jamais au chargement), et PushDeviceCard l'appelle
        → components/notifications/PushDeviceCard.tsx absent (contrat H4 : état du push sur cet appareil)
    not ok 3 - detachPushSubscription() avant chaque supabase.auth.signOut() du navigateur (AuthProvider, contrôleur, scanner, connexion, réinitialisation)
        → app/controller/layout.tsx:29 : signOut() sans detachPushSubscription() avant, dans la même fonction
        → app/controller/layout.tsx : detachPushSubscription non importée de @/lib/push/client
not ok 6 - 6.2 — autorisation des notifications après un geste seulement, détachement à la déconnexion (F4)
    not ok 1 - components/ui/Switch.tsx : role="switch", aria-checked, libellé lié, 44 px, états chargement et erreur
        → components/ui/Switch.tsx absent (contrat H4 : bascule partagée)
    not ok 2 - PushDeviceCard : les cinq états du push sur cet appareil, essai par /api/notifications/test-push, aucune demande d'autorisation directe
        → components/notifications/PushDeviceCard.tsx absent (contrat H4)
    not ok 3 - app/profile/notifications/page.tsx : PageHeader avec retour, « Toujours envoyées », « Vous choisissez », Switch par canal, PushDeviceCard, GET/PUT des préférences, Toast, ?topic=
        → app/profile/notifications/page.tsx absent (contrat H4)
    not ok 4 - liens vers /profile/notifications : profil client, profils partenaire et contrôleur, pied de la cloche (« Préférences ») et page /notifications
        → app/profile/page.tsx : aucun lien vers /profile/notifications
        → app/partner/profile/page.tsx : aucun lien vers /profile/notifications
    not ok 5 - app/profile/page.tsx migré : PageHeader, aucun rôle brut affiché (roles.join)
        → app/profile/page.tsx :
        → aucun PageHeader
not ok 7 - 6.4 — page « Préférences de notification » (H4)
    not ok 1 - app/tickets/page.tsx : onglet « Reçus » (?tab=recus) qui rend IncomingTransfers, lecture de /api/tickets/transfers/incoming
        → app/tickets/page.tsx :
        → onglet d'identifiant « recus » absent
    not ok 2 - IncomingTransfers : « Accepter le billet » confirmé (ConfirmDialog), POST …/claim, bandeau et bouton « Confirmer mon numéro »
        → components/tickets/IncomingTransfers.tsx absent (contrat B5)
    not ok 3 - PhoneVerifyDialog : Modal, send-otp puis verify-otp avec purpose LOGIN
        → components/tickets/PhoneVerifyDialog.tsx absent (contrat B5)
    not ok 4 - TransferModal : un seul champ « Numéro de téléphone du destinataire », texte d'aide exact, plus d'email ni de lien de réclamation
        → components/tickets/TransferModal.tsx :
        → champ « Numéro de téléphone du destinataire » sans libellé lié (exact)
    not ok 5 - app/tickets/claim/[token]/page.tsx : composant serveur qui redirige vers /tickets?tab=recus, sans lire le jeton ni la base
        → app/tickets/claim/[token]/page.tsx :
        → directive « use client »
not ok 8 - 6.7 — Mes billets « Reçus », vérification du numéro, transfert vers un numéro (B5, amendement 2)
    not ok 1 - AppLayout : entrée « Notifications » (/admin/notifications) dans le groupe « Système » et dans proItems ; barre du bas admin inchangée
        → components/layout/AppLayout.tsx :
        → groupe « Système » sans { name: 'Notifications', href: '/admin/notifications' }
    not ok 2 - abonnements à admin_signals filtrés par kind : tableau de bord et file des événements kind=in.(EVENT_SUBMITTED,PARTNER_REGISTERED), page Notifications kind=in.(NOTIFICATION_FAILED,SMS_DAILY_THRESHOLD)
        → app/admin/dashboard/page.tsx:267 : filtre absent (attendu kind=in.(EVENT_SUBMITTED,PARTNER_REGISTERED))
        → app/admin/events/page.tsx:166 : filtre absent (attendu kind=in.(EVENT_SUBMITTED,PARTNER_REGISTERED))
    not ok 3 - app/admin/notifications/page.tsx : PageHeader « Notifications » et LiveIndicator, KpiCard SMS, statut en ScrollableTabs, filtres, DataList, Pagination, états vide, erreur et accès refusé
        → app/admin/notifications/page.tsx absent (contrat L4)
    not ok 4 - app/admin/notifications/[id]/page.tsx : sections, contenu OTP non conservé, « Relancer » rendu seulement sous une condition FAILED / can_retry, confirmé, POST …/retry
        → app/admin/notifications/[id]/page.tsx absent (contrat L4)
    not ok 5 - « Relancer » n'est jamais rendu sans condition dans la liste admin
        → app/admin/notifications/page.tsx absent (contrat L4)
    not ok 6 - StatusBadge : domaine « notification » et tons du contrat L4 (PENDING neutral, SENDING info, SENT success, FAILED danger, SKIPPED et CANCELLED muted, UNCERTAIN warning-strong)
        → components/ui/StatusBadge.tsx : StatusDomain sans « notification »
not ok 9 - 6.8 — supervision admin (L4, C6)
    not ok 1 - cloche : chaînes figées conservées, onglet « Non lues » chargé par le serveur (?limit=20&filter=unread), libellés par notificationTypeMeta, lien interne seulement
        → components/notifications/NotificationBell.tsx :
        → onglet « Non lues » : aucune lecture de /api/notifications?limit=20&filter=unread
    not ok 2 - page /notifications : pagination serveur (page, pageSize, filter), plus de ?limit=50 ni de filtrage local, « Tout marquer comme lu », « Voir le détail » seulement avec actionUrl
        → app/notifications/page.tsx :
        → ?limit=50 fixe (liste tronquée, pas de pagination)
not ok 10 - 6.10 — cloche et page /notifications (N3)
not ok 11 - /home/runner/work/event-village/event-village/tests/parcours/notif-interface.test.ts
        → invariants (m)(n)(o) impossibles à vérifier (notif-interface) : schéma du lot 6 absent :
        → table public.notification_outbox absente — boîte d'envoi (contrat C2, migration 20261103000002)
# pass 1
# fail 37
```

Run 67 (après correctif) :

```text
    ok 1 - garde-fou : chaque fichier créé ou touché par l'interface du lot 6 figure dans MIGRATED_DESIGN_FILES
ok 1 - Q — liste blanche du système de design (tests/helpers/design-files.ts)
    ok 1 - app/login/page.tsx : composant serveur (ni « use client », ni useSearchParams, ni Suspense) qui lit searchParams et rend LoginForm
    ok 2 - LoginForm : libellés figés « Email ou téléphone » et « Mot de passe » liés à leur champ, bouton « Se connecter »
    ok 3 - LoginForm : logique conservée (verrou client et 429 serveur, téléphone → email, OTP type « email », SUSPENDU, refreshSession, resolvePostLoginRoute)
    ok 4 - connexion sur le système de design : PageHeader « Connexion », StatusBanner, œil en IconButton focalisable, bascule aria-pressed, aucun « F5 », animations en motion-safe:
ok 2 - 6.0 e — connexion : composant serveur et formulaire client (A5)
    ok 1 - app/register/page.tsx : PageHeader « Créer un compte » (un seul <h1>), œil focalisable, animations en motion-safe:, logique conservée
    ok 2 - app/forgot-password/page.tsx : PageHeader « Mot de passe oublié » (un seul <h1>), œil focalisable, animations en motion-safe:, logique conservée
    ok 3 - app/reset-password/page.tsx : PageHeader « Nouveau mot de passe » (un seul <h1>), œil focalisable, animations en motion-safe:, logique conservée
    ok 4 - OtpInput : 6 champs numériques nommés « Chiffre N sur 6 », one-time-code, 44 px, collage d'un code complet, anneau ring
ok 3 - 6.0 e — inscription, mot de passe oublié, réinitialisation, OtpInput (A5)
    ok 1 - Badge et StatusBadge posent data-ev-caption (texte de 12 px admis par le contrôle des captures)
    ok 2 - app/globals.css : bouton de fermeture de la bulle Leaflet à 44 × 44 px par un sélecteur plus spécifique que leaflet.css:527-535
ok 4 - 6.0 f — textes admis et bulle Leaflet (A6)
    ok 1 - ScrollableTabs déplacé dans components/ui (ancien fichier supprimé, imports mis à jour), indices w-8 et scroll-padding
    ok 2 - file admin (app/admin/events/page.tsx) : onglets de statut en ScrollableTabs (8 onglets, indice de débordement)
    ok 3 - scanner : boutons « Caméra » / « Saisie manuelle » sur une ligne à 390 px (px-4 gap-2 text-sm whitespace-nowrap, hauteur de 48 px gardée)
    ok 4 - components/ui/Skeleton.tsx sur les tokens : bg-surface-sunken, cartes bg-surface border-border, motion-safe:animate-pulse, aucune palette brute
    ok 5 - les 7 fichiers loading.tsx sur la nouvelle palette (aucune couleur brute, animations en motion-safe:)
    ok 6 - components/ui/LoadingSkeleton.tsx : supprimé s'il n'a aucun import, sinon migré et listé
ok 5 - 6.0 g — détails du lot 5 (A7)
    ok 1 - Notification.requestPermission n'apparaît que dans lib/push/client.ts (enablePush), nulle part ailleurs dans app/, components/, hooks/, lib/, public/
    ok 2 - enablePush n'est appelée que depuis un gestionnaire onClick (jamais au chargement), et PushDeviceCard l'appelle
    ok 3 - detachPushSubscription() avant chaque supabase.auth.signOut() du navigateur (AuthProvider, contrôleur, scanner, connexion, réinitialisation)
ok 6 - 6.2 — autorisation des notifications après un geste seulement, détachement à la déconnexion (F4)
    ok 1 - components/ui/Switch.tsx : role="switch", aria-checked, libellé lié, 44 px, états chargement et erreur
    ok 2 - PushDeviceCard : les cinq états du push sur cet appareil, essai par /api/notifications/essai-push, aucune demande d'autorisation directe
    ok 3 - app/profile/notifications/page.tsx : PageHeader avec retour, « Toujours envoyées », « Vous choisissez », Switch par canal, PushDeviceCard, GET/PUT des préférences, Toast, ?topic=
    ok 4 - liens vers /profile/notifications : profil client, profils partenaire et contrôleur, pied de la cloche (« Préférences ») et page /notifications
    ok 5 - app/profile/page.tsx migré : PageHeader, aucun rôle brut affiché (roles.join)
ok 7 - 6.4 — page « Préférences de notification » (H4)
    ok 1 - app/tickets/page.tsx : onglet « Reçus » (?tab=recus) qui rend IncomingTransfers, lecture de /api/tickets/transfers/incoming
    ok 2 - IncomingTransfers : « Accepter le billet » confirmé (ConfirmDialog), POST …/claim, bandeau et bouton « Confirmer mon numéro »
    ok 3 - PhoneVerifyDialog : Modal, send-otp puis verify-otp avec purpose LOGIN
    ok 4 - TransferModal : un seul champ « Numéro de téléphone du destinataire », texte d'aide exact, plus d'email ni de lien de réclamation
    ok 5 - app/tickets/claim/[token]/page.tsx : composant serveur qui redirige vers /tickets?tab=recus, sans lire le jeton ni la base
ok 8 - 6.7 — Mes billets « Reçus », vérification du numéro, transfert vers un numéro (B5, amendement 2)
    ok 1 - AppLayout : entrée « Notifications » (/admin/notifications) dans le groupe « Système » et dans proItems ; barre du bas admin inchangée
    ok 2 - abonnements à admin_signals filtrés par kind : tableau de bord et file des événements kind=in.(EVENT_SUBMITTED,PARTNER_REGISTERED), page Notifications kind=in.(NOTIFICATION_FAILED,SMS_DAILY_THRESHOLD)
    ok 3 - app/admin/notifications/page.tsx : PageHeader « Notifications » et LiveIndicator, KpiCard SMS, statut en ScrollableTabs, filtres, DataList, Pagination, états vide, erreur et accès refusé
    ok 4 - app/admin/notifications/[id]/page.tsx : sections, contenu OTP non conservé, « Relancer » rendu seulement sous une condition FAILED / can_retry, confirmé, POST …/retry
    ok 5 - « Relancer » n'est jamais rendu sans condition dans la liste admin
    ok 6 - StatusBadge : domaine « notification » et tons du contrat L4 (PENDING neutral, SENDING info, SENT success, FAILED danger, SKIPPED et CANCELLED muted, UNCERTAIN warning-strong)
ok 9 - 6.8 — supervision admin (L4, C6)
    ok 1 - cloche : chaînes figées conservées, onglet « Non lues » chargé par le serveur (?limit=20&filter=unread), libellés par notificationTypeMeta, lien interne seulement
    ok 2 - page /notifications : pagination serveur (page, pageSize, filter), plus de ?limit=50 ni de filtrage local, « Tout marquer comme lu », « Voir le détail » seulement avec actionUrl
ok 10 - 6.10 — cloche et page /notifications (N3)
# pass 38
# fail 0
```

**parcours/design-systeme**

Run 60 (avant correctif) :

```text
    ok 1 - lib/events/event-status.ts exporte EVENT_STATUS_META : les 7 statuts, libellés et tons exacts du contrat B, description en français
    ok 2 - StatusBadge (components/ui) lit EVENT_STATUS_META, a un domaine « event », sans majuscules forcées
ok 1 - B — EVENT_STATUS_META, seule source des libellés de statut
    ok 1 - app/globals.css : chaque token sémantique est une variable CSS de :root
    ok 2 - app/globals.css : le thème sombre (.dark) redéfinit surfaces, textes, bordures, anneau et tons
    ok 3 - tailwind.config : couleurs branchées sur les variables (bg-surface, text-fg, bg-brand, text-on-brand, bg-success-bg…)
    ok 4 - tailwind.config : utilitaire text-caption à 12 px (seule petite taille admise, voir la règle text-xs)
    ok 5 - rampe brand-50 à brand-900 en orange : teinte 12°–40°, saturation ≥ 0,35, luminosité décroissante
    ok 6 - contraste WCAG : --brand avec le blanc ≥ 4,5:1, --on-brand sur --brand ≥ 4,5:1 (clair et sombre) ; --brand-decor = \#FF5722
ok 2 - Q — tokens sémantiques (globals.css, tailwind.config)
    ok 1 - Button : au moins 44 px à toutes les tailles (min-h-11, icône min-w-11), primaire plein bg-brand et text-on-brand
    ok 2 - Modal : role dialog, aria-modal, aria-labelledby, Escape, piège de focus, focus restitué, bouton Fermer de 44 px avec aria-label
    ok 3 - ConfirmDialog : children, requireText (saisie comparée, champ étiqueté) et isLoading
    ok 4 - ReasonDialog : motif obligatoire (au moins 3 caractères), champ étiqueté, sur Modal ou ConfirmDialog
    ok 5 - KpiCard et KpiCardSkeleton : label, value, hint, tone, icon, loading
    ok 6 - Tabs : role tablist et tab, aria-selected, flèches gauche et droite, compteur par onglet
    ok 7 - Pagination : <nav aria-label>, Précédent, Suivant, « Page X sur Y », cibles de 44 px
    ok 8 - PageHeader : <h1>, title, description, actions qui passent à la ligne (flex-wrap)
    ok 9 - IconButton : aria-label obligatoire dans le type, 44 × 44 px
    ok 10 - LinkButton : next/link stylé en bouton, sans <button> imbriqué, 44 px
    ok 11 - Field, TextInput, Textarea, Select : label lié (htmlFor, id), aide et erreur reliées (aria-describedby), aria-invalid
    ok 12 - DataList : tableau à partir de md, cartes en dessous
    ok 13 - StatusBanner : annoncé aux lecteurs d’écran (role status ou alert, ou aria-live)
    ok 14 - LiveIndicator : « En direct » et « Hors ligne », annoncé (role status ou aria-live)
    ok 15 - ErrorState : onRetry obligatoire et bouton « Réessayer » ; EmptyState présent
ok 3 - Q — composants partagés (components/ui)
    ok 1 - versionné, généré puis complété des règles du lot (brand-decor, text-caption)
ok 4 - Q — design-system/event-village/MASTER.md
    ok 1 - garde-fou du détecteur : un fichier fautif est signalé règle par règle, les commentaires sont ignorés
    ok 2 - garde-fou du détecteur : un fichier conforme ne déclenche aucune règle
    not ok 3 - garde-fou : chaque entrée de la liste existe, sans doublon, en chemin relatif à la racine
        → entrées invalides ou fichiers absents : components/auth/LoginForm.tsx, components/ui/ScrollableTabs.tsx, components/ui/Switch.tsx, components/notifications/PushDeviceCard.tsx, app/profile/notifications/page.tsx, components/tickets/IncomingTransfers.tsx, compon
        → +   'components/auth/LoginForm.tsx',
    ok 4 - la liste contient les écrans du lot (admin, liste et pilotage partenaire, formulaire, page publique, catalogue, accueil, mes billets, anciennes pages caisse et équipe)
    ok 5 - la liste contient les composants partagés créés ou corrigés par le lot
    not ok 6 - garde-fou : tout fichier .tsx créé par le lot dans app/ ou components/ figure dans la liste
        → fichiers créés par le lot hors de MIGRATED_DESIGN_FILES : components/partner/pilotage/ScrollableTabs.tsx
        → +   'components/partner/pilotage/ScrollableTabs.tsx'
    ok 7 - règles du contrat Q : components/ui/Badge.tsx
    ok 8 - accessibilité et mobile (DoD 3 et 7) : components/ui/Badge.tsx
    ok 9 - règles du contrat Q : components/ui/Button.tsx
    ok 10 - accessibilité et mobile (DoD 3 et 7) : components/ui/Button.tsx
    ok 11 - règles du contrat Q : components/ui/ConfirmDialog.tsx
    ok 12 - accessibilité et mobile (DoD 3 et 7) : components/ui/ConfirmDialog.tsx
    ok 13 - règles du contrat Q : components/ui/DataList.tsx
    ok 14 - accessibilité et mobile (DoD 3 et 7) : components/ui/DataList.tsx
    ok 15 - règles du contrat Q : components/ui/EmptyState.tsx
    ok 16 - accessibilité et mobile (DoD 3 et 7) : components/ui/EmptyState.tsx
    ok 17 - règles du contrat Q : components/ui/Field.tsx
    ok 18 - accessibilité et mobile (DoD 3 et 7) : components/ui/Field.tsx
    ok 19 - règles du contrat Q : components/ui/IconButton.tsx
    ok 20 - accessibilité et mobile (DoD 3 et 7) : components/ui/IconButton.tsx
    ok 21 - règles du contrat Q : components/ui/KpiCard.tsx
    ok 22 - accessibilité et mobile (DoD 3 et 7) : components/ui/KpiCard.tsx
    ok 23 - règles du contrat Q : components/ui/LinkButton.tsx
    ok 24 - accessibilité et mobile (DoD 3 et 7) : components/ui/LinkButton.tsx
    ok 25 - règles du contrat Q : components/ui/LiveIndicator.tsx
    ok 26 - accessibilité et mobile (DoD 3 et 7) : components/ui/LiveIndicator.tsx
    ok 27 - règles du contrat Q : components/ui/Modal.tsx
    ok 28 - accessibilité et mobile (DoD 3 et 7) : components/ui/Modal.tsx
    ok 29 - règles du contrat Q : components/ui/PageHeader.tsx
    ok 30 - accessibilité et mobile (DoD 3 et 7) : components/ui/PageHeader.tsx
    ok 31 - règles du contrat Q : components/ui/Pagination.tsx
    ok 32 - accessibilité et mobile (DoD 3 et 7) : components/ui/Pagination.tsx
    ok 33 - règles du contrat Q : components/ui/ReasonDialog.tsx
    ok 34 - accessibilité et mobile (DoD 3 et 7) : components/ui/ReasonDialog.tsx
    ok 35 - règles du contrat Q : components/ui/StatusBadge.tsx
    ok 36 - accessibilité et mobile (DoD 3 et 7) : components/ui/StatusBadge.tsx
    ok 37 - règles du contrat Q : components/ui/StatusBanner.tsx
    ok 38 - accessibilité et mobile (DoD 3 et 7) : components/ui/StatusBanner.tsx
    ok 39 - règles du contrat Q : components/ui/Tabs.tsx
    ok 40 - accessibilité et mobile (DoD 3 et 7) : components/ui/Tabs.tsx
    ok 41 - règles du contrat Q : app/admin/events/page.tsx
    ok 42 - accessibilité et mobile (DoD 3 et 7) : app/admin/events/page.tsx
    ok 43 - règles du contrat Q : app/admin/events/[id]/page.tsx
    ok 44 - accessibilité et mobile (DoD 3 et 7) : app/admin/events/[id]/page.tsx
    ok 45 - règles du contrat Q : app/admin/dashboard/page.tsx
    ok 46 - accessibilité et mobile (DoD 3 et 7) : app/admin/dashboard/page.tsx
    ok 47 - règles du contrat Q : app/admin/services/page.tsx
    ok 48 - accessibilité et mobile (DoD 3 et 7) : app/admin/services/page.tsx
    ok 49 - règles du contrat Q : components/layout/AppLayout.tsx
    ok 50 - accessibilité et mobile (DoD 3 et 7) : components/layout/AppLayout.tsx
    ok 51 - règles du contrat Q : components/ui/Logo.tsx
    ok 52 - accessibilité et mobile (DoD 3 et 7) : components/ui/Logo.tsx
    ok 53 - règles du contrat Q : components/ui/ThemeToggle.tsx
    ok 54 - accessibilité et mobile (DoD 3 et 7) : components/ui/ThemeToggle.tsx
    ok 55 - règles du contrat Q : components/notifications/NotificationBell.tsx
    ok 56 - accessibilité et mobile (DoD 3 et 7) : components/notifications/NotificationBell.tsx
    ok 57 - règles du contrat Q : components/ui/Toast.tsx
    ok 58 - accessibilité et mobile (DoD 3 et 7) : components/ui/Toast.tsx
    ok 59 - règles du contrat Q : components/ui/EventMap.tsx
    ok 60 - accessibilité et mobile (DoD 3 et 7) : components/ui/EventMap.tsx
    ok 61 - règles du contrat Q : app/controller/layout.tsx
    ok 62 - accessibilité et mobile (DoD 3 et 7) : app/controller/layout.tsx
    ok 63 - règles du contrat Q : app/partner/layout.tsx
    ok 64 - accessibilité et mobile (DoD 3 et 7) : app/partner/layout.tsx
    ok 65 - règles du contrat Q : components/events/EventForm.tsx
    ok 66 - accessibilité et mobile (DoD 3 et 7) : components/events/EventForm.tsx
    ok 67 - règles du contrat Q : components/events/EventTicketing.tsx
    ok 68 - accessibilité et mobile (DoD 3 et 7) : components/events/EventTicketing.tsx
    ok 69 - règles du contrat Q : components/ui/ImageUpload.tsx
    ok 70 - accessibilité et mobile (DoD 3 et 7) : components/ui/ImageUpload.tsx
    ok 71 - règles du contrat Q : components/ui/MapPicker.tsx
    ok 72 - accessibilité et mobile (DoD 3 et 7) : components/ui/MapPicker.tsx
    ok 73 - règles du contrat Q : app/partner/events/new/page.tsx
    ok 74 - accessibilité et mobile (DoD 3 et 7) : app/partner/events/new/page.tsx
    ok 75 - règles du contrat Q : app/partner/events/[id]/edit/page.tsx
    ok 76 - accessibilité et mobile (DoD 3 et 7) : app/partner/events/[id]/edit/page.tsx
    ok 77 - règles du contrat Q : app/events/[id]/page.tsx
    ok 78 - accessibilité et mobile (DoD 3 et 7) : app/events/[id]/page.tsx
    ok 79 - règles du contrat Q : app/explore/page.tsx
    ok 80 - accessibilité et mobile (DoD 3 et 7) : app/explore/page.tsx
    ok 81 - règles du contrat Q : app/page.tsx
    ok 82 - accessibilité et mobile (DoD 3 et 7) : app/page.tsx
    ok 83 - règles du contrat Q : app/tickets/page.tsx
    ok 84 - accessibilité et mobile (DoD 3 et 7) : app/tickets/page.tsx
    ok 85 - règles du contrat Q : components/events/EventCard.tsx
    ok 86 - accessibilité et mobile (DoD 3 et 7) : components/events/EventCard.tsx
    ok 87 - règles du contrat Q : components/events/FeaturedEventCard.tsx
    ok 88 - accessibilité et mobile (DoD 3 et 7) : components/events/FeaturedEventCard.tsx
    ok 89 - règles du contrat Q : components/tickets/TicketCard.tsx
    ok 90 - accessibilité et mobile (DoD 3 et 7) : components/tickets/TicketCard.tsx
    ok 91 - règles du contrat Q : app/notifications/page.tsx
    ok 92 - accessibilité et mobile (DoD 3 et 7) : app/notifications/page.tsx
    ok 93 - règles du contrat Q : app/partner/events/page.tsx
    ok 94 - accessibilité et mobile (DoD 3 et 7) : app/partner/events/page.tsx
    ok 95 - règles du contrat Q : app/partner/events/[id]/page.tsx
    ok 96 - accessibilité et mobile (DoD 3 et 7) : app/partner/events/[id]/page.tsx
    ok 97 - règles du contrat Q : app/partner/events/[id]/team/page.tsx
    ok 98 - accessibilité et mobile (DoD 3 et 7) : app/partner/events/[id]/team/page.tsx
    ok 99 - règles du contrat Q : app/partner/events/[id]/caisse/page.tsx
    ok 100 - accessibilité et mobile (DoD 3 et 7) : app/partner/events/[id]/caisse/page.tsx
    ok 101 - règles du contrat Q : components/events/EventCancelDialog.tsx
    ok 102 - accessibilité et mobile (DoD 3 et 7) : components/events/EventCancelDialog.tsx
    ok 103 - règles du contrat Q : components/events/RefundProgress.tsx
    ok 104 - accessibilité et mobile (DoD 3 et 7) : components/events/RefundProgress.tsx
    ok 105 - règles du contrat Q : components/partner/events-list/PartnerEventCard.tsx
    ok 106 - accessibilité et mobile (DoD 3 et 7) : components/partner/events-list/PartnerEventCard.tsx
    ok 107 - règles du contrat Q : components/partner/pilotage/PilotageBlocks.tsx
    ok 108 - accessibilité et mobile (DoD 3 et 7) : components/partner/pilotage/PilotageBlocks.tsx
    ok 109 - règles du contrat Q : components/partner/pilotage/OverviewTab.tsx
    ok 110 - accessibilité et mobile (DoD 3 et 7) : components/partner/pilotage/OverviewTab.tsx
    ok 111 - règles du contrat Q : components/partner/pilotage/SalesTab.tsx
    ok 112 - accessibilité et mobile (DoD 3 et 7) : components/partner/pilotage/SalesTab.tsx
    ok 113 - règles du contrat Q : components/partner/pilotage/EntriesTab.tsx
    ok 114 - accessibilité et mobile (DoD 3 et 7) : components/partner/pilotage/EntriesTab.tsx
    ok 115 - règles du contrat Q : components/partner/pilotage/TeamTab.tsx
    ok 116 - accessibilité et mobile (DoD 3 et 7) : components/partner/pilotage/TeamTab.tsx
    ok 117 - règles du contrat Q : components/partner/pilotage/CashTab.tsx
    ok 118 - accessibilité et mobile (DoD 3 et 7) : components/partner/pilotage/CashTab.tsx
    ok 119 - règles du contrat Q : components/partner/pilotage/ClosingTab.tsx
    ok 120 - accessibilité et mobile (DoD 3 et 7) : components/partner/pilotage/ClosingTab.tsx
    ok 121 - règles du contrat Q : app/controller/scanner/page.tsx
    ok 122 - accessibilité et mobile (DoD 3 et 7) : app/controller/scanner/page.tsx
    ok 123 - règles du contrat Q : components/scan/ScannerShiftBanner.tsx
    ok 124 - accessibilité et mobile (DoD 3 et 7) : components/scan/ScannerShiftBanner.tsx
    ok 125 - règles du contrat Q : components/scan/ScanResultPanel.tsx
    ok 126 - accessibilité et mobile (DoD 3 et 7) : components/scan/ScanResultPanel.tsx
    ok 127 - règles du contrat Q : components/scan/ManualEntryForm.tsx
    ok 128 - accessibilité et mobile (DoD 3 et 7) : components/scan/ManualEntryForm.tsx
    ok 129 - règles du contrat Q : components/scan/CameraQrScanner.tsx
    ok 130 - accessibilité et mobile (DoD 3 et 7) : components/scan/CameraQrScanner.tsx
    not ok 131 - règles du contrat Q : app/login/page.tsx
        → 83 écart(s) au système de design :
        → app/login/page.tsx:419 [palette Tailwind brute] text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight
    ok 132 - accessibilité et mobile (DoD 3 et 7) : app/login/page.tsx
    not ok 133 - règles du contrat Q : components/auth/LoginForm.tsx
        → components/auth/LoginForm.tsx absent
    not ok 134 - accessibilité et mobile (DoD 3 et 7) : components/auth/LoginForm.tsx
        → components/auth/LoginForm.tsx absent
    not ok 135 - règles du contrat Q : app/register/page.tsx
        → 78 écart(s) au système de design :
        → app/register/page.tsx:238 [palette Tailwind brute] text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight
    not ok 136 - accessibilité et mobile (DoD 3 et 7) : app/register/page.tsx
        → 14 écart(s) d'accessibilité :
        → app/register/page.tsx:279 [<label> sans htmlFor ni champ englobé] <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 b
    not ok 137 - règles du contrat Q : app/forgot-password/page.tsx
        → 72 écart(s) au système de design :
        → app/forgot-password/page.tsx:349 [palette Tailwind brute] text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight
    not ok 138 - accessibilité et mobile (DoD 3 et 7) : app/forgot-password/page.tsx
        → 2 écart(s) d'accessibilité :
        → app/forgot-password/page.tsx:468 [<label> sans htmlFor ni champ englobé] <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 b
    not ok 139 - règles du contrat Q : app/reset-password/page.tsx
        → 56 écart(s) au système de design :
        → app/reset-password/page.tsx:262 [palette Tailwind brute] w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mx-auto animate
    not ok 140 - accessibilité et mobile (DoD 3 et 7) : app/reset-password/page.tsx
        → 4 écart(s) d'accessibilité :
        → app/reset-password/page.tsx:356 [<label> sans htmlFor ni champ englobé] <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 b
    not ok 141 - règles du contrat Q : components/auth/OtpInput.tsx
        → 5 écart(s) au système de design :
        → components/auth/OtpInput.tsx:95 [palette Tailwind brute] border-red-500 bg-red-50 dark:bg-red-950/30 text-red-600
    not ok 142 - accessibilité et mobile (DoD 3 et 7) : components/auth/OtpInput.tsx
        → 1 écart(s) d'accessibilité :
        → components/auth/OtpInput.tsx:82 [<input> sans label lié (id + htmlFor, aria-label ou <label> englobant)] <input key={i} ref={(el) => { inputsRef.current[i] = el; }} type="text" inputMode="numeric" pattern=
    not ok 143 - règles du contrat Q : components/auth/PasswordStrengthChecklist.tsx
        → 8 écart(s) au système de design :
        → components/auth/PasswordStrengthChecklist.tsx:32 [palette Tailwind brute] p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space
    ok 144 - accessibilité et mobile (DoD 3 et 7) : components/auth/PasswordStrengthChecklist.tsx
    not ok 145 - règles du contrat Q : components/ui/ScrollableTabs.tsx
        → components/ui/ScrollableTabs.tsx absent
    not ok 146 - accessibilité et mobile (DoD 3 et 7) : components/ui/ScrollableTabs.tsx
        → components/ui/ScrollableTabs.tsx absent
    not ok 147 - règles du contrat Q : components/ui/Skeleton.tsx
        → 6 écart(s) au système de design :
        → components/ui/Skeleton.tsx:5 [palette Tailwind brute] animate-pulse rounded-xl bg-slate-200/80 dark:bg-zinc-800/80 ev-skel
    ok 148 - accessibilité et mobile (DoD 3 et 7) : components/ui/Skeleton.tsx
    not ok 149 - règles du contrat Q : app/events/[id]/loading.tsx
        → 2 écart(s) au système de design :
        → app/events/[id]/loading.tsx:11 [palette Tailwind brute] rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2
    ok 150 - accessibilité et mobile (DoD 3 et 7) : app/events/[id]/loading.tsx
    not ok 151 - règles du contrat Q : app/orders/loading.tsx
        → 1 écart(s) au système de design :
        → app/orders/loading.tsx:19 [palette Tailwind brute] rounded-3xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 divide-y d
    ok 152 - accessibilité et mobile (DoD 3 et 7) : app/orders/loading.tsx
    not ok 153 - règles du contrat Q : app/partner/dashboard/loading.tsx
        → 2 écart(s) au système de design :
        → app/partner/dashboard/loading.tsx:21 [palette Tailwind brute] rounded-3xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-1
    ok 154 - accessibilité et mobile (DoD 3 et 7) : app/partner/dashboard/loading.tsx
    not ok 155 - règles du contrat Q : app/profile/loading.tsx
        → 1 écart(s) au système de design :
        → app/profile/loading.tsx:12 [palette Tailwind brute] rounded-3xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-1
    ok 156 - accessibilité et mobile (DoD 3 et 7) : app/profile/loading.tsx
    not ok 157 - règles du contrat Q : app/wallet/loading.tsx
        → 2 écart(s) au système de design :
        → app/wallet/loading.tsx:9 [palette Tailwind brute] rounded-3xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4
    ok 158 - accessibilité et mobile (DoD 3 et 7) : app/wallet/loading.tsx
    ok 159 - règles du contrat Q : app/explore/loading.tsx
    ok 160 - accessibilité et mobile (DoD 3 et 7) : app/explore/loading.tsx
    ok 161 - règles du contrat Q : app/tickets/loading.tsx
    ok 162 - accessibilité et mobile (DoD 3 et 7) : app/tickets/loading.tsx
    ok 163 - règles du contrat Q : components/pwa/ServiceWorkerRegister.tsx
    ok 164 - accessibilité et mobile (DoD 3 et 7) : components/pwa/ServiceWorkerRegister.tsx
    not ok 165 - règles du contrat Q : components/ui/Switch.tsx
        → components/ui/Switch.tsx absent
    not ok 166 - accessibilité et mobile (DoD 3 et 7) : components/ui/Switch.tsx
        → components/ui/Switch.tsx absent
    not ok 167 - règles du contrat Q : components/notifications/PushDeviceCard.tsx
        → components/notifications/PushDeviceCard.tsx absent
    not ok 168 - accessibilité et mobile (DoD 3 et 7) : components/notifications/PushDeviceCard.tsx
        → components/notifications/PushDeviceCard.tsx absent
    not ok 169 - règles du contrat Q : app/profile/notifications/page.tsx
        → app/profile/notifications/page.tsx absent
    not ok 170 - accessibilité et mobile (DoD 3 et 7) : app/profile/notifications/page.tsx
        → app/profile/notifications/page.tsx absent
    not ok 171 - règles du contrat Q : app/profile/page.tsx
        → 85 écart(s) au système de design :
        → app/profile/page.tsx:43 [couleur #hex] w-20 h-20 rounded-3xl bg-orange-100 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-c
    ok 172 - accessibilité et mobile (DoD 3 et 7) : app/profile/page.tsx
    not ok 173 - règles du contrat Q : app/admin/finance-settings/page.tsx
        → 42 écart(s) au système de design :
        → app/admin/finance-settings/page.tsx:216 [couleur #hex] w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-80
    ok 174 - accessibilité et mobile (DoD 3 et 7) : app/admin/finance-settings/page.tsx
    not ok 175 - règles du contrat Q : components/tickets/IncomingTransfers.tsx
        → components/tickets/IncomingTransfers.tsx absent
    not ok 176 - accessibilité et mobile (DoD 3 et 7) : components/tickets/IncomingTransfers.tsx
        → components/tickets/IncomingTransfers.tsx absent
    not ok 177 - règles du contrat Q : components/tickets/PhoneVerifyDialog.tsx
        → components/tickets/PhoneVerifyDialog.tsx absent
    not ok 178 - accessibilité et mobile (DoD 3 et 7) : components/tickets/PhoneVerifyDialog.tsx
        → components/tickets/PhoneVerifyDialog.tsx absent
    not ok 179 - règles du contrat Q : components/tickets/TransferModal.tsx
        → 58 écart(s) au système de design :
        → components/tickets/TransferModal.tsx:166 [palette Tailwind brute] absolute inset-0 bg-slate-950/70 backdrop-blur-md
    not ok 180 - accessibilité et mobile (DoD 3 et 7) : components/tickets/TransferModal.tsx
        → 3 écart(s) d'accessibilité :
        → components/tickets/TransferModal.tsx:160 [modale écrite à la main (fixed inset-0) : utiliser Modal] fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4
    not ok 181 - règles du contrat Q : app/tickets/claim/[token]/page.tsx
        → 71 écart(s) au système de design :
        → app/tickets/claim/[token]/page.tsx:191 [couleur #hex] w-full max-w-md p-6 bg-white dark:bg-[#16161A] border border-slate-200 dark:border-zinc-800 rounded-
    ok 182 - accessibilité et mobile (DoD 3 et 7) : app/tickets/claim/[token]/page.tsx
    not ok 183 - règles du contrat Q : app/admin/notifications/page.tsx
        → app/admin/notifications/page.tsx absent
    not ok 184 - accessibilité et mobile (DoD 3 et 7) : app/admin/notifications/page.tsx
        → app/admin/notifications/page.tsx absent
    not ok 185 - règles du contrat Q : app/admin/notifications/[id]/page.tsx
        → app/admin/notifications/[id]/page.tsx absent
    not ok 186 - accessibilité et mobile (DoD 3 et 7) : app/admin/notifications/[id]/page.tsx
        → app/admin/notifications/[id]/page.tsx absent
not ok 5 - Q — fichiers migrés (tests/helpers/design-files.ts)
# pass 169
# fail 41
```

Run 67 (après correctif) :

```text
    ok 1 - lib/events/event-status.ts exporte EVENT_STATUS_META : les 7 statuts, libellés et tons exacts du contrat B, description en français
    ok 2 - StatusBadge (components/ui) lit EVENT_STATUS_META, a un domaine « event », sans majuscules forcées
ok 1 - B — EVENT_STATUS_META, seule source des libellés de statut
    ok 1 - app/globals.css : chaque token sémantique est une variable CSS de :root
    ok 2 - app/globals.css : le thème sombre (.dark) redéfinit surfaces, textes, bordures, anneau et tons
    ok 3 - tailwind.config : couleurs branchées sur les variables (bg-surface, text-fg, bg-brand, text-on-brand, bg-success-bg…)
    ok 4 - tailwind.config : utilitaire text-caption à 12 px (seule petite taille admise, voir la règle text-xs)
    ok 5 - rampe brand-50 à brand-900 en orange : teinte 12°–40°, saturation ≥ 0,35, luminosité décroissante
    ok 6 - contraste WCAG : --brand avec le blanc ≥ 4,5:1, --on-brand sur --brand ≥ 4,5:1 (clair et sombre) ; --brand-decor = \#FF5722
ok 2 - Q — tokens sémantiques (globals.css, tailwind.config)
    ok 1 - Button : au moins 44 px à toutes les tailles (min-h-11, icône min-w-11), primaire plein bg-brand et text-on-brand
    ok 2 - Modal : role dialog, aria-modal, aria-labelledby, Escape, piège de focus, focus restitué, bouton Fermer de 44 px avec aria-label
    ok 3 - ConfirmDialog : children, requireText (saisie comparée, champ étiqueté) et isLoading
    ok 4 - ReasonDialog : motif obligatoire (au moins 3 caractères), champ étiqueté, sur Modal ou ConfirmDialog
    ok 5 - KpiCard et KpiCardSkeleton : label, value, hint, tone, icon, loading
    ok 6 - Tabs : role tablist et tab, aria-selected, flèches gauche et droite, compteur par onglet
    ok 7 - Pagination : <nav aria-label>, Précédent, Suivant, « Page X sur Y », cibles de 44 px
    ok 8 - PageHeader : <h1>, title, description, actions qui passent à la ligne (flex-wrap)
    ok 9 - IconButton : aria-label obligatoire dans le type, 44 × 44 px
    ok 10 - LinkButton : next/link stylé en bouton, sans <button> imbriqué, 44 px
    ok 11 - Field, TextInput, Textarea, Select : label lié (htmlFor, id), aide et erreur reliées (aria-describedby), aria-invalid
    ok 12 - DataList : tableau à partir de md, cartes en dessous
    ok 13 - StatusBanner : annoncé aux lecteurs d’écran (role status ou alert, ou aria-live)
    ok 14 - LiveIndicator : « En direct » et « Hors ligne », annoncé (role status ou aria-live)
    ok 15 - ErrorState : onRetry obligatoire et bouton « Réessayer » ; EmptyState présent
ok 3 - Q — composants partagés (components/ui)
    ok 1 - versionné, généré puis complété des règles du lot (brand-decor, text-caption)
ok 4 - Q — design-system/event-village/MASTER.md
    ok 1 - garde-fou du détecteur : un fichier fautif est signalé règle par règle, les commentaires sont ignorés
    ok 2 - garde-fou du détecteur : un fichier conforme ne déclenche aucune règle
    ok 3 - garde-fou : chaque entrée de la liste existe, sans doublon, en chemin relatif à la racine
    ok 4 - la liste contient les écrans du lot (admin, liste et pilotage partenaire, formulaire, page publique, catalogue, accueil, mes billets, anciennes pages caisse et équipe)
    ok 5 - la liste contient les composants partagés créés ou corrigés par le lot
    ok 6 - garde-fou : tout fichier .tsx créé par le lot dans app/ ou components/ figure dans la liste
    ok 7 - règles du contrat Q : components/ui/Badge.tsx
    ok 8 - accessibilité et mobile (DoD 3 et 7) : components/ui/Badge.tsx
    ok 9 - règles du contrat Q : components/ui/Button.tsx
    ok 10 - accessibilité et mobile (DoD 3 et 7) : components/ui/Button.tsx
    ok 11 - règles du contrat Q : components/ui/ConfirmDialog.tsx
    ok 12 - accessibilité et mobile (DoD 3 et 7) : components/ui/ConfirmDialog.tsx
    ok 13 - règles du contrat Q : components/ui/DataList.tsx
    ok 14 - accessibilité et mobile (DoD 3 et 7) : components/ui/DataList.tsx
    ok 15 - règles du contrat Q : components/ui/EmptyState.tsx
    ok 16 - accessibilité et mobile (DoD 3 et 7) : components/ui/EmptyState.tsx
    ok 17 - règles du contrat Q : components/ui/Field.tsx
    ok 18 - accessibilité et mobile (DoD 3 et 7) : components/ui/Field.tsx
    ok 19 - règles du contrat Q : components/ui/IconButton.tsx
    ok 20 - accessibilité et mobile (DoD 3 et 7) : components/ui/IconButton.tsx
    ok 21 - règles du contrat Q : components/ui/KpiCard.tsx
    ok 22 - accessibilité et mobile (DoD 3 et 7) : components/ui/KpiCard.tsx
    ok 23 - règles du contrat Q : components/ui/LinkButton.tsx
    ok 24 - accessibilité et mobile (DoD 3 et 7) : components/ui/LinkButton.tsx
    ok 25 - règles du contrat Q : components/ui/LiveIndicator.tsx
    ok 26 - accessibilité et mobile (DoD 3 et 7) : components/ui/LiveIndicator.tsx
    ok 27 - règles du contrat Q : components/ui/Modal.tsx
    ok 28 - accessibilité et mobile (DoD 3 et 7) : components/ui/Modal.tsx
    ok 29 - règles du contrat Q : components/ui/PageHeader.tsx
    ok 30 - accessibilité et mobile (DoD 3 et 7) : components/ui/PageHeader.tsx
    ok 31 - règles du contrat Q : components/ui/Pagination.tsx
    ok 32 - accessibilité et mobile (DoD 3 et 7) : components/ui/Pagination.tsx
    ok 33 - règles du contrat Q : components/ui/ReasonDialog.tsx
    ok 34 - accessibilité et mobile (DoD 3 et 7) : components/ui/ReasonDialog.tsx
    ok 35 - règles du contrat Q : components/ui/StatusBadge.tsx
    ok 36 - accessibilité et mobile (DoD 3 et 7) : components/ui/StatusBadge.tsx
    ok 37 - règles du contrat Q : components/ui/StatusBanner.tsx
    ok 38 - accessibilité et mobile (DoD 3 et 7) : components/ui/StatusBanner.tsx
    ok 39 - règles du contrat Q : components/ui/Tabs.tsx
    ok 40 - accessibilité et mobile (DoD 3 et 7) : components/ui/Tabs.tsx
    ok 41 - règles du contrat Q : app/admin/events/page.tsx
    ok 42 - accessibilité et mobile (DoD 3 et 7) : app/admin/events/page.tsx
    ok 43 - règles du contrat Q : app/admin/events/[id]/page.tsx
    ok 44 - accessibilité et mobile (DoD 3 et 7) : app/admin/events/[id]/page.tsx
    ok 45 - règles du contrat Q : app/admin/dashboard/page.tsx
    ok 46 - accessibilité et mobile (DoD 3 et 7) : app/admin/dashboard/page.tsx
    ok 47 - règles du contrat Q : app/admin/services/page.tsx
    ok 48 - accessibilité et mobile (DoD 3 et 7) : app/admin/services/page.tsx
    ok 49 - règles du contrat Q : components/layout/AppLayout.tsx
    ok 50 - accessibilité et mobile (DoD 3 et 7) : components/layout/AppLayout.tsx
    ok 51 - règles du contrat Q : components/ui/Logo.tsx
    ok 52 - accessibilité et mobile (DoD 3 et 7) : components/ui/Logo.tsx
    ok 53 - règles du contrat Q : components/ui/ThemeToggle.tsx
    ok 54 - accessibilité et mobile (DoD 3 et 7) : components/ui/ThemeToggle.tsx
    ok 55 - règles du contrat Q : components/notifications/NotificationBell.tsx
    ok 56 - accessibilité et mobile (DoD 3 et 7) : components/notifications/NotificationBell.tsx
    ok 57 - règles du contrat Q : components/ui/Toast.tsx
    ok 58 - accessibilité et mobile (DoD 3 et 7) : components/ui/Toast.tsx
    ok 59 - règles du contrat Q : components/ui/EventMap.tsx
    ok 60 - accessibilité et mobile (DoD 3 et 7) : components/ui/EventMap.tsx
    ok 61 - règles du contrat Q : app/controller/layout.tsx
    ok 62 - accessibilité et mobile (DoD 3 et 7) : app/controller/layout.tsx
    ok 63 - règles du contrat Q : app/partner/layout.tsx
    ok 64 - accessibilité et mobile (DoD 3 et 7) : app/partner/layout.tsx
    ok 65 - règles du contrat Q : components/events/EventForm.tsx
    ok 66 - accessibilité et mobile (DoD 3 et 7) : components/events/EventForm.tsx
    ok 67 - règles du contrat Q : components/events/EventTicketing.tsx
    ok 68 - accessibilité et mobile (DoD 3 et 7) : components/events/EventTicketing.tsx
    ok 69 - règles du contrat Q : components/ui/ImageUpload.tsx
    ok 70 - accessibilité et mobile (DoD 3 et 7) : components/ui/ImageUpload.tsx
    ok 71 - règles du contrat Q : components/ui/MapPicker.tsx
    ok 72 - accessibilité et mobile (DoD 3 et 7) : components/ui/MapPicker.tsx
    ok 73 - règles du contrat Q : app/partner/events/new/page.tsx
    ok 74 - accessibilité et mobile (DoD 3 et 7) : app/partner/events/new/page.tsx
    ok 75 - règles du contrat Q : app/partner/events/[id]/edit/page.tsx
    ok 76 - accessibilité et mobile (DoD 3 et 7) : app/partner/events/[id]/edit/page.tsx
    ok 77 - règles du contrat Q : app/events/[id]/page.tsx
    ok 78 - accessibilité et mobile (DoD 3 et 7) : app/events/[id]/page.tsx
    ok 79 - règles du contrat Q : app/explore/page.tsx
    ok 80 - accessibilité et mobile (DoD 3 et 7) : app/explore/page.tsx
    ok 81 - règles du contrat Q : app/page.tsx
    ok 82 - accessibilité et mobile (DoD 3 et 7) : app/page.tsx
    ok 83 - règles du contrat Q : app/tickets/page.tsx
    ok 84 - accessibilité et mobile (DoD 3 et 7) : app/tickets/page.tsx
    ok 85 - règles du contrat Q : components/events/EventCard.tsx
    ok 86 - accessibilité et mobile (DoD 3 et 7) : components/events/EventCard.tsx
    ok 87 - règles du contrat Q : components/events/FeaturedEventCard.tsx
    ok 88 - accessibilité et mobile (DoD 3 et 7) : components/events/FeaturedEventCard.tsx
    ok 89 - règles du contrat Q : components/tickets/TicketCard.tsx
    ok 90 - accessibilité et mobile (DoD 3 et 7) : components/tickets/TicketCard.tsx
    ok 91 - règles du contrat Q : app/notifications/page.tsx
    ok 92 - accessibilité et mobile (DoD 3 et 7) : app/notifications/page.tsx
    ok 93 - règles du contrat Q : app/partner/events/page.tsx
    ok 94 - accessibilité et mobile (DoD 3 et 7) : app/partner/events/page.tsx
    ok 95 - règles du contrat Q : app/partner/events/[id]/page.tsx
    ok 96 - accessibilité et mobile (DoD 3 et 7) : app/partner/events/[id]/page.tsx
    ok 97 - règles du contrat Q : app/partner/events/[id]/team/page.tsx
    ok 98 - accessibilité et mobile (DoD 3 et 7) : app/partner/events/[id]/team/page.tsx
    ok 99 - règles du contrat Q : app/partner/events/[id]/caisse/page.tsx
    ok 100 - accessibilité et mobile (DoD 3 et 7) : app/partner/events/[id]/caisse/page.tsx
    ok 101 - règles du contrat Q : components/events/EventCancelDialog.tsx
    ok 102 - accessibilité et mobile (DoD 3 et 7) : components/events/EventCancelDialog.tsx
    ok 103 - règles du contrat Q : components/events/RefundProgress.tsx
    ok 104 - accessibilité et mobile (DoD 3 et 7) : components/events/RefundProgress.tsx
    ok 105 - règles du contrat Q : components/partner/events-list/PartnerEventCard.tsx
    ok 106 - accessibilité et mobile (DoD 3 et 7) : components/partner/events-list/PartnerEventCard.tsx
    ok 107 - règles du contrat Q : components/partner/pilotage/PilotageBlocks.tsx
    ok 108 - accessibilité et mobile (DoD 3 et 7) : components/partner/pilotage/PilotageBlocks.tsx
    ok 109 - règles du contrat Q : components/partner/pilotage/OverviewTab.tsx
    ok 110 - accessibilité et mobile (DoD 3 et 7) : components/partner/pilotage/OverviewTab.tsx
    ok 111 - règles du contrat Q : components/partner/pilotage/SalesTab.tsx
    ok 112 - accessibilité et mobile (DoD 3 et 7) : components/partner/pilotage/SalesTab.tsx
    ok 113 - règles du contrat Q : components/partner/pilotage/EntriesTab.tsx
    ok 114 - accessibilité et mobile (DoD 3 et 7) : components/partner/pilotage/EntriesTab.tsx
    ok 115 - règles du contrat Q : components/partner/pilotage/TeamTab.tsx
    ok 116 - accessibilité et mobile (DoD 3 et 7) : components/partner/pilotage/TeamTab.tsx
    ok 117 - règles du contrat Q : components/partner/pilotage/CashTab.tsx
    ok 118 - accessibilité et mobile (DoD 3 et 7) : components/partner/pilotage/CashTab.tsx
    ok 119 - règles du contrat Q : components/partner/pilotage/ClosingTab.tsx
    ok 120 - accessibilité et mobile (DoD 3 et 7) : components/partner/pilotage/ClosingTab.tsx
    ok 121 - règles du contrat Q : app/controller/scanner/page.tsx
    ok 122 - accessibilité et mobile (DoD 3 et 7) : app/controller/scanner/page.tsx
    ok 123 - règles du contrat Q : components/scan/ScannerShiftBanner.tsx
    ok 124 - accessibilité et mobile (DoD 3 et 7) : components/scan/ScannerShiftBanner.tsx
    ok 125 - règles du contrat Q : components/scan/ScanResultPanel.tsx
    ok 126 - accessibilité et mobile (DoD 3 et 7) : components/scan/ScanResultPanel.tsx
    ok 127 - règles du contrat Q : components/scan/ManualEntryForm.tsx
    ok 128 - accessibilité et mobile (DoD 3 et 7) : components/scan/ManualEntryForm.tsx
    ok 129 - règles du contrat Q : components/scan/CameraQrScanner.tsx
    ok 130 - accessibilité et mobile (DoD 3 et 7) : components/scan/CameraQrScanner.tsx
    ok 131 - règles du contrat Q : app/login/page.tsx
    ok 132 - accessibilité et mobile (DoD 3 et 7) : app/login/page.tsx
    ok 133 - règles du contrat Q : components/auth/LoginForm.tsx
    ok 134 - accessibilité et mobile (DoD 3 et 7) : components/auth/LoginForm.tsx
    ok 135 - règles du contrat Q : app/register/page.tsx
    ok 136 - accessibilité et mobile (DoD 3 et 7) : app/register/page.tsx
    ok 137 - règles du contrat Q : app/forgot-password/page.tsx
    ok 138 - accessibilité et mobile (DoD 3 et 7) : app/forgot-password/page.tsx
    ok 139 - règles du contrat Q : app/reset-password/page.tsx
    ok 140 - accessibilité et mobile (DoD 3 et 7) : app/reset-password/page.tsx
    ok 141 - règles du contrat Q : components/auth/OtpInput.tsx
    ok 142 - accessibilité et mobile (DoD 3 et 7) : components/auth/OtpInput.tsx
    ok 143 - règles du contrat Q : components/auth/PasswordStrengthChecklist.tsx
    ok 144 - accessibilité et mobile (DoD 3 et 7) : components/auth/PasswordStrengthChecklist.tsx
    ok 145 - règles du contrat Q : components/ui/ScrollableTabs.tsx
    ok 146 - accessibilité et mobile (DoD 3 et 7) : components/ui/ScrollableTabs.tsx
    ok 147 - règles du contrat Q : components/ui/Skeleton.tsx
    ok 148 - accessibilité et mobile (DoD 3 et 7) : components/ui/Skeleton.tsx
    ok 149 - règles du contrat Q : app/events/[id]/loading.tsx
    ok 150 - accessibilité et mobile (DoD 3 et 7) : app/events/[id]/loading.tsx
    ok 151 - règles du contrat Q : app/orders/loading.tsx
    ok 152 - accessibilité et mobile (DoD 3 et 7) : app/orders/loading.tsx
    ok 153 - règles du contrat Q : app/partner/dashboard/loading.tsx
    ok 154 - accessibilité et mobile (DoD 3 et 7) : app/partner/dashboard/loading.tsx
    ok 155 - règles du contrat Q : app/profile/loading.tsx
    ok 156 - accessibilité et mobile (DoD 3 et 7) : app/profile/loading.tsx
    ok 157 - règles du contrat Q : app/wallet/loading.tsx
    ok 158 - accessibilité et mobile (DoD 3 et 7) : app/wallet/loading.tsx
    ok 159 - règles du contrat Q : app/explore/loading.tsx
    ok 160 - accessibilité et mobile (DoD 3 et 7) : app/explore/loading.tsx
    ok 161 - règles du contrat Q : app/tickets/loading.tsx
    ok 162 - accessibilité et mobile (DoD 3 et 7) : app/tickets/loading.tsx
    ok 163 - règles du contrat Q : components/pwa/ServiceWorkerRegister.tsx
    ok 164 - accessibilité et mobile (DoD 3 et 7) : components/pwa/ServiceWorkerRegister.tsx
    ok 165 - règles du contrat Q : components/ui/Switch.tsx
    ok 166 - accessibilité et mobile (DoD 3 et 7) : components/ui/Switch.tsx
    ok 167 - règles du contrat Q : components/notifications/PushDeviceCard.tsx
    ok 168 - accessibilité et mobile (DoD 3 et 7) : components/notifications/PushDeviceCard.tsx
    ok 169 - règles du contrat Q : app/profile/notifications/page.tsx
    ok 170 - accessibilité et mobile (DoD 3 et 7) : app/profile/notifications/page.tsx
    ok 171 - règles du contrat Q : app/profile/page.tsx
    ok 172 - accessibilité et mobile (DoD 3 et 7) : app/profile/page.tsx
    ok 173 - règles du contrat Q : app/admin/finance-settings/page.tsx
    ok 174 - accessibilité et mobile (DoD 3 et 7) : app/admin/finance-settings/page.tsx
    ok 175 - règles du contrat Q : components/tickets/IncomingTransfers.tsx
    ok 176 - accessibilité et mobile (DoD 3 et 7) : components/tickets/IncomingTransfers.tsx
    ok 177 - règles du contrat Q : components/tickets/PhoneVerifyDialog.tsx
    ok 178 - accessibilité et mobile (DoD 3 et 7) : components/tickets/PhoneVerifyDialog.tsx
    ok 179 - règles du contrat Q : components/tickets/TransferModal.tsx
    ok 180 - accessibilité et mobile (DoD 3 et 7) : components/tickets/TransferModal.tsx
    ok 181 - règles du contrat Q : app/tickets/claim/[token]/page.tsx
    ok 182 - accessibilité et mobile (DoD 3 et 7) : app/tickets/claim/[token]/page.tsx
    ok 183 - règles du contrat Q : app/admin/notifications/page.tsx
    ok 184 - accessibilité et mobile (DoD 3 et 7) : app/admin/notifications/page.tsx
    ok 185 - règles du contrat Q : app/admin/notifications/[id]/page.tsx
    ok 186 - accessibilité et mobile (DoD 3 et 7) : app/admin/notifications/[id]/page.tsx
ok 5 - Q — fichiers migrés (tests/helpers/design-files.ts)
# pass 210
# fail 0
```

### 6.12 — Captures et fumée

```text
$ git grep -n -o -E 'id: '"'"'(connexion|inscription|mot-de-passe-oublie|preferences-push-[a-z-]+|cloche-ouverte|notifications-(vide|erreur)|mes-billets-recus|admin-notifications[a-z-]*)'"'"'' fff03b1 -- e2e/support/screens.ts
(code de sortie 1)

$ git grep -n -o -E 'id: '"'"'(connexion|inscription|mot-de-passe-oublie|preferences-push-[a-z-]+|cloche-ouverte|notifications-(vide|erreur)|mes-billets-recus|admin-notifications[a-z-]*)'"'"'' 3a246ad -- e2e/support/screens.ts
3a246ad:e2e/support/screens.ts:137:id: 'connexion'
3a246ad:e2e/support/screens.ts:144:id: 'inscription'
3a246ad:e2e/support/screens.ts:148:id: 'mot-de-passe-oublie'
3a246ad:e2e/support/screens.ts:157:id: 'mes-billets-recus'
3a246ad:e2e/support/screens.ts:165:id: 'preferences-push-active'
3a246ad:e2e/support/screens.ts:187:id: 'preferences-push-refuse'
3a246ad:e2e/support/screens.ts:196:id: 'preferences-push-non-pris-en-charge'
3a246ad:e2e/support/screens.ts:204:id: 'cloche-ouverte'
3a246ad:e2e/support/screens.ts:213:id: 'notifications-vide'
3a246ad:e2e/support/screens.ts:219:id: 'notifications-erreur'
3a246ad:e2e/support/screens.ts:268:id: 'admin-notifications'
3a246ad:e2e/support/screens.ts:276:id: 'admin-notifications-detail'
3a246ad:e2e/support/screens.ts:281:id: 'admin-notifications-erreur'
(code de sortie 0)

$ git grep -n -E 'test\.step\('"'"'(7|8|9|10)\.' fff03b1 -- e2e/fumee.spec.ts
(code de sortie 1)

$ git grep -n -E 'test\.step\('"'"'(7|8|9|10)\.' 3a246ad -- e2e/fumee.spec.ts
3a246ad:e2e/fumee.spec.ts:377:        await test.step('7. second événement à J+2 20:00 (RPC du partenaire A), acheté par le client dans l’interface', async () => {
3a246ad:e2e/fumee.spec.ts:397:        await test.step('8. rappels J-1 puis H-3 par horloge simulée : boîte d’envoi, faux SMS, cloche', async () => {
3a246ad:e2e/fumee.spec.ts:449:        await test.step('9. annulation par le partenaire : H-3 annulés, avis d’annulation par la vraie route de l’envoyeur', async () => {
3a246ad:e2e/fumee.spec.ts:499:        await test.step('10. comptage par différence depuis l’étape 8 ; aucune ligne de E2 en SENDING', async () => {
(code de sortie 0)
```

**Correctif** (commits `5401a0c`, `abb7556`, `1ab1623`, `6279f2f`, `3a246ad`) : 13 écrans capturés de plus (section 3) ; fumée prolongée (étapes 7 à 10) ; seed de démonstration du lot 6 par les RPC et le vrai envoyeur. Sorties brutes en section 6.

**Simulé, et pourquoi.** Playwright bloque les service workers et aucun service push réel n'est joignable en CI :
- push « activé » : permission, enregistrement du service worker et `pushManager.subscribe` simulés ; `/api/push/config`, `POST /api/push/subscriptions` (200 vérifié), la liste blanche et la base sont réels ; la capture vérifie une seule demande d'autorisation, au clic ;
- push « refusé » et « non pris en charge » : `Notification.permission` à `denied`, ou `PushManager` et `Notification` supprimés ;
- `/notifications` vide : réponse remplacée par une liste vide ; écrans d'erreur : réponse 500 injectée, comme au lot 5 ;
- fumée : seule l'horloge est simulée. L'import des modules du dépôt dans Playwright échoue en CI (`Cannot find module '@/lib/payments/rpc'`) : la fumée passe par le repli `scripts/e2e/clock-run.ts`, comme prévu au contrat (section Y), et le journal le dit. L'avis d'annulation part par la vraie route `GET /api/cron/notifications-dispatch` avec `CRON_SECRET`, à l'heure réelle.

### Suites existantes adaptées dans un commit de correctif

Compteurs bruts du run 60 (version d'avant l'adaptation, verte sur le code non corrigé : ce ne sont pas des tests rouges) et du run 67 (version adaptée). Le détail de chaque changement est en section 1.

**parcours/acces-qr**

Run 60 (version d'avant l'adaptation, code non corrigé) puis run 67 (version adaptée, code corrigé), compteurs bruts :

```text
# run 60
# tests 10
# pass 10
# fail 0
# skipped 0
# run 67
# tests 10
# pass 10
# fail 0
# skipped 0
```

**parcours/acces-totp**

Run 60 (version d'avant l'adaptation, code non corrigé) puis run 67 (version adaptée, code corrigé), compteurs bruts :

```text
# run 60
# tests 14
# pass 14
# fail 0
# skipped 0
# run 67
# tests 14
# pass 14
# fail 0
# skipped 0
```

**parcours/dette-transferts**

Run 60 (version d'avant l'adaptation, code non corrigé) puis run 67 (version adaptée, code corrigé), compteurs bruts :

```text
# run 60
# tests 15
# pass 15
# fail 0
# skipped 0
# run 67
# tests 15
# pass 15
# fail 0
# skipped 0
```

**parcours/dette-guichet**

Run 60 (version d'avant l'adaptation, code non corrigé) puis run 67 (version adaptée, code corrigé), compteurs bruts :

```text
# run 60
# tests 10
# pass 10
# fail 0
# skipped 0
# run 67
# tests 10
# pass 10
# fail 0
# skipped 0
```

**parcours/finance-affichage**

Run 60 (version d'avant l'adaptation, code non corrigé) puis run 67 (version adaptée, code corrigé), compteurs bruts :

```text
# run 60
# tests 8
# pass 8
# fail 0
# skipped 0
# run 67
# tests 8
# pass 8
# fail 0
# skipped 0
```

**parcours/email-optionnel**

Run 60 (version d'avant l'adaptation, code non corrigé) puis run 67 (version adaptée, code corrigé), compteurs bruts :

```text
# run 60
# tests 2
# pass 2
# fail 0
# skipped 0
# run 67
# tests 2
# pass 2
# fail 0
# skipped 0
```

**parcours/edition-formulaire**

Run 60 (version d'avant l'adaptation, code non corrigé) puis run 67 (version adaptée, code corrigé), compteurs bruts :

```text
# run 60
# tests 24
# pass 24
# fail 0
# skipped 0
# run 67
# tests 24
# pass 24
# fail 0
# skipped 0
```

**parcours/cycle-transitions**

Run 60 (version d'avant l'adaptation, code non corrigé) puis run 67 (version adaptée, code corrigé), compteurs bruts :

```text
# run 60
# tests 24
# pass 24
# fail 0
# skipped 0
# run 67
# tests 24
# pass 24
# fail 0
# skipped 0
```

**notifications-and-documents**

Run 60 (version d'avant l'adaptation, code non corrigé) puis run 67 (version adaptée, code corrigé), compteurs bruts :

```text
# run 60
# tests 5
# pass 5
# fail 0
# skipped 0
# run 67
# tests 5
# pass 5
# fail 0
# skipped 0
```

**partner-auth-complete**

Run 60 (version d'avant l'adaptation, code non corrigé) puis run 67 (version adaptée, code corrigé), compteurs bruts :

```text
# run 60
# tests 24
# pass 24
# fail 0
# skipped 0
# run 67
# tests 24
# pass 24
# fail 0
# skipped 0
```

**parcours/finance-remboursement-billet**

Run 60 (version d'avant l'adaptation, code non corrigé) puis run 67 (version adaptée, code corrigé), compteurs bruts :

```text
# run 60
# tests 3
# pass 3
# fail 0
# skipped 0
# run 67
# tests 3
# pass 3
# fail 0
# skipped 0
```

**parcours/dette-cloture-caisse**

Run 60 (version d'avant l'adaptation, code non corrigé) puis run 67 (version adaptée, code corrigé), compteurs bruts :

```text
# run 60
# tests 13
# pass 13
# fail 0
# skipped 0
# run 67
# tests 13
# pass 13
# fail 0
# skipped 0
```

**parcours/dette-retrait-controleur**

Run 60 (version d'avant l'adaptation, code non corrigé) puis run 67 (version adaptée, code corrigé), compteurs bruts :

```text
# run 60
# tests 9
# pass 9
# fail 0
# skipped 0
# run 67
# tests 9
# pass 9
# fail 0
# skipped 0
```

**parcours/paiement-remboursement**

Run 60 (version d'avant l'adaptation, code non corrigé) puis run 67 (version adaptée, code corrigé), compteurs bruts :

```text
# run 60
# tests 7
# pass 7
# fail 0
# skipped 0
# run 67
# tests 7
# pass 7
# fail 0
# skipped 0
```

**parcours/sms-anti-abus**

Run 60 (version d'avant l'adaptation, code non corrigé) puis run 67 (version adaptée, code corrigé), compteurs bruts :

```text
# run 60
# tests 9
# pass 9
# fail 0
# skipped 0
# run 67
# tests 9
# pass 9
# fail 0
# skipped 0
```

**parcours/temps-reel-billets**

Run 60 (version d'avant l'adaptation, code non corrigé) puis run 67 (version adaptée, code corrigé), compteurs bruts :

```text
# run 60
# tests 4
# pass 4
# fail 0
# skipped 0
# run 67
# tests 4
# pass 4
# fail 0
# skipped 0
```

**parcours/admin-evenements**

Run 60 (version d'avant l'adaptation, code non corrigé) puis run 67 (version adaptée, code corrigé), compteurs bruts :

```text
# run 60
# tests 25
# pass 25
# fail 0
# skipped 0
# run 67
# tests 25
# pass 25
# fail 0
# skipped 0
```

**parcours/partenaire-liste**

Run 60 (version d'avant l'adaptation, code non corrigé) puis run 67 (version adaptée, code corrigé), compteurs bruts :

```text
# run 60
# tests 16
# pass 16
# fail 0
# skipped 0
# run 67
# tests 16
# pass 16
# fail 0
# skipped 0
```

**parcours/pilotage-acces**

Run 60 (version d'avant l'adaptation, code non corrigé) puis run 67 (version adaptée, code corrigé), compteurs bruts :

```text
# run 60
# tests 11
# pass 11
# fail 0
# skipped 0
# run 67
# tests 11
# pass 11
# fail 0
# skipped 0
```

### Infrastructure : `r3-fonctions-rpc`, modifiée en phase rouge

Le bloc du lot 6 exige que chaque RPC du lot existe et soit refusée à anon et authenticated (section 1, A). Au run 60, les 22 RPC `(p jsonb)` du lot n'existent pas encore.

**security/r3-fonctions-rpc**

Run 60 (avant correctif) :

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
    ok 13 - anon : rpc(atomic_partner_remove_controller) refusée
    ok 14 - authenticated (compte CLIENT) : rpc(atomic_partner_remove_controller) refusée
    ok 15 - anon : rpc(generate_referral_code) refusée
    ok 16 - authenticated (compte CLIENT) : rpc(generate_referral_code) refusée
    ok 17 - anon : rpc(ticket_sale_problems) refusée
    ok 18 - authenticated (compte CLIENT) : rpc(ticket_sale_problems) refusée
    ok 19 - anon : rpc(checkout_create_payment) refusée
    ok 20 - authenticated (compte CLIENT) : rpc(checkout_create_payment) refusée
    ok 21 - anon : rpc(payment_release) refusée
    ok 22 - authenticated (compte CLIENT) : rpc(payment_release) refusée
    ok 23 - anon : rpc(stock_reservations_expire) refusée
    ok 24 - authenticated (compte CLIENT) : rpc(stock_reservations_expire) refusée
    ok 25 - anon : rpc(refund_request) refusée
    ok 26 - authenticated (compte CLIENT) : rpc(refund_request) refusée
    ok 27 - anon : rpc(payment_confirm) refusée
    ok 28 - authenticated (compte CLIENT) : rpc(payment_confirm) refusée
    ok 29 - anon : rpc(free_tickets_claim) refusée
    ok 30 - authenticated (compte CLIENT) : rpc(free_tickets_claim) refusée
    ok 31 - anon : rpc(payment_webhook_record) refusée
    ok 32 - authenticated (compte CLIENT) : rpc(payment_webhook_record) refusée
    ok 33 - anon : rpc(finance_setting_set) refusée
    ok 34 - authenticated (compte CLIENT) : rpc(finance_setting_set) refusée
    ok 35 - anon : rpc(fin_setting) refusée
    ok 36 - authenticated (compte CLIENT) : rpc(fin_setting) refusée
    ok 37 - anon : rpc(finance_compute) refusée
    ok 38 - authenticated (compte CLIENT) : rpc(finance_compute) refusée
    ok 39 - anon : rpc(finance_quote) refusée
    ok 40 - authenticated (compte CLIENT) : rpc(finance_quote) refusée
    ok 41 - anon : rpc(finance_account_balance) refusée
    ok 42 - authenticated (compte CLIENT) : rpc(finance_account_balance) refusée
    ok 43 - anon : rpc(ticket_refund_request) refusée
    ok 44 - authenticated (compte CLIENT) : rpc(ticket_refund_request) refusée
    ok 45 - anon : rpc(cashout_finalize) refusée
    ok 46 - authenticated (compte CLIENT) : rpc(cashout_finalize) refusée
    ok 47 - anon : rpc(withdrawal_request) refusée
    ok 48 - authenticated (compte CLIENT) : rpc(withdrawal_request) refusée
    ok 49 - anon : rpc(referral_commissions_release) refusée
    ok 50 - authenticated (compte CLIENT) : rpc(referral_commissions_release) refusée
    ok 51 - anon : rpc(finance_partner_summary) refusée
    ok 52 - authenticated (compte CLIENT) : rpc(finance_partner_summary) refusée
    ok 53 - anon : rpc(finance_platform_revenue) refusée
    ok 54 - authenticated (compte CLIENT) : rpc(finance_platform_revenue) refusée
    ok 55 - anon : rpc(ticket_scan) refusée
    ok 56 - authenticated (compte CLIENT) : rpc(ticket_scan) refusée
    ok 57 - anon : rpc(ticket_cash_checkin) refusée
    ok 58 - authenticated (compte CLIENT) : rpc(ticket_cash_checkin) refusée
    ok 59 - anon : rpc(counter_sale) refusée
    ok 60 - authenticated (compte CLIENT) : rpc(counter_sale) refusée
    ok 61 - anon : rpc(shift_open) refusée
    ok 62 - authenticated (compte CLIENT) : rpc(shift_open) refusée
    ok 63 - anon : rpc(ticket_transfer_claim) refusée
    ok 64 - authenticated (compte CLIENT) : rpc(ticket_transfer_claim) refusée
    ok 65 - anon : rpc(scan_scanner_authorized) refusée
    ok 66 - authenticated (compte CLIENT) : rpc(scan_scanner_authorized) refusée
    ok 67 - anon : rpc(scan_event_problem) refusée
    ok 68 - authenticated (compte CLIENT) : rpc(scan_event_problem) refusée
    ok 69 - anon : rpc(try_uuid) refusée
    ok 70 - authenticated (compte CLIENT) : rpc(try_uuid) refusée
    ok 71 - anon : rpc(ticket_transfer_initiate) refusée
    ok 72 - authenticated (compte CLIENT) : rpc(ticket_transfer_initiate) refusée
    ok 73 - anon : rpc(ticket_transfer_cancel) refusée
    ok 74 - authenticated (compte CLIENT) : rpc(ticket_transfer_cancel) refusée
    ok 75 - anon : rpc(ticket_transfers_expire) refusée
    ok 76 - authenticated (compte CLIENT) : rpc(ticket_transfers_expire) refusée
    ok 77 - anon : rpc(shift_close) refusée
    ok 78 - authenticated (compte CLIENT) : rpc(shift_close) refusée
    ok 79 - anon : rpc(user_roles_set) refusée
    ok 80 - authenticated (compte CLIENT) : rpc(user_roles_set) refusée
    ok 81 - anon : rpc(otp_check) refusée
    ok 82 - authenticated (compte CLIENT) : rpc(otp_check) refusée
    ok 83 - anon : rpc(scan_incident_log) refusée
    ok 84 - authenticated (compte CLIENT) : rpc(scan_incident_log) refusée
    ok 85 - anon : rpc(event_transition) refusée
    ok 86 - authenticated (compte CLIENT) : rpc(event_transition) refusée
    ok 87 - anon : rpc(event_actions) refusée
    ok 88 - authenticated (compte CLIENT) : rpc(event_actions) refusée
    ok 89 - anon : rpc(event_cancel) refusée
    ok 90 - authenticated (compte CLIENT) : rpc(event_cancel) refusée
    ok 91 - anon : rpc(event_cancellation_impact) refusée
    ok 92 - authenticated (compte CLIENT) : rpc(event_cancellation_impact) refusée
    ok 93 - anon : rpc(event_cancellation_progress) refusée
    ok 94 - authenticated (compte CLIENT) : rpc(event_cancellation_progress) refusée
    ok 95 - anon : rpc(events_finish_overdue) refusée
    ok 96 - authenticated (compte CLIENT) : rpc(events_finish_overdue) refusée
    ok 97 - anon : rpc(event_end_at) refusée
    ok 98 - authenticated (compte CLIENT) : rpc(event_end_at) refusée
    ok 99 - anon : rpc(event_status_label) refusée
    ok 100 - authenticated (compte CLIENT) : rpc(event_status_label) refusée
    ok 101 - anon : rpc(event_actor_profile) refusée
    ok 102 - authenticated (compte CLIENT) : rpc(event_actor_profile) refusée
    ok 103 - anon : rpc(event_status_apply) refusée
    ok 104 - authenticated (compte CLIENT) : rpc(event_status_apply) refusée
    ok 105 - anon : rpc(event_create) refusée
    ok 106 - authenticated (compte CLIENT) : rpc(event_create) refusée
    ok 107 - anon : rpc(event_update) refusée
    ok 108 - authenticated (compte CLIENT) : rpc(event_update) refusée
    ok 109 - anon : rpc(ticket_category_create) refusée
    ok 110 - authenticated (compte CLIENT) : rpc(ticket_category_create) refusée
    ok 111 - anon : rpc(ticket_category_update) refusée
    ok 112 - authenticated (compte CLIENT) : rpc(ticket_category_update) refusée
    ok 113 - anon : rpc(ticket_category_delete) refusée
    ok 114 - authenticated (compte CLIENT) : rpc(ticket_category_delete) refusée
    ok 115 - anon : rpc(event_edit_refusal) refusée
    ok 116 - authenticated (compte CLIENT) : rpc(event_edit_refusal) refusée
    ok 117 - anon : rpc(event_end_from) refusée
    ok 118 - authenticated (compte CLIENT) : rpc(event_end_from) refusée
    ok 119 - anon : rpc(event_poster_path_ok) refusée
    ok 120 - authenticated (compte CLIENT) : rpc(event_poster_path_ok) refusée
    ok 121 - anon : rpc(ticket_category_has_sales) refusée
    ok 122 - authenticated (compte CLIENT) : rpc(ticket_category_has_sales) refusée
    ok 123 - anon : rpc(event_has_sales) refusée
    ok 124 - authenticated (compte CLIENT) : rpc(event_has_sales) refusée
    ok 125 - anon : rpc(ticket_category_normalize) refusée
    ok 126 - authenticated (compte CLIENT) : rpc(ticket_category_normalize) refusée
    ok 127 - anon : rpc(ticket_category_guard) refusée
    ok 128 - authenticated (compte CLIENT) : rpc(ticket_category_guard) refusée
    ok 129 - anon : rpc(low_stock_threshold) refusée
    ok 130 - authenticated (compte CLIENT) : rpc(low_stock_threshold) refusée
    ok 131 - anon : rpc(public_category_stock_sync) refusée
    ok 132 - authenticated (compte CLIENT) : rpc(public_category_stock_sync) refusée
    ok 133 - anon : rpc(public_event_state_sync) refusée
    ok 134 - authenticated (compte CLIENT) : rpc(public_event_state_sync) refusée
    ok 135 - anon : rpc(pilotage_scan_result_label) refusée
    ok 136 - authenticated (compte CLIENT) : rpc(pilotage_scan_result_label) refusée
    ok 137 - anon : rpc(pilotage_ticket_status_label) refusée
    ok 138 - authenticated (compte CLIENT) : rpc(pilotage_ticket_status_label) refusée
    ok 139 - anon : rpc(pilotage_display_name) refusée
    ok 140 - authenticated (compte CLIENT) : rpc(pilotage_display_name) refusée
    ok 141 - anon : rpc(pilotage_access) refusée
    ok 142 - authenticated (compte CLIENT) : rpc(pilotage_access) refusée
    ok 143 - anon : rpc(pilotage_refusal) refusée
    ok 144 - authenticated (compte CLIENT) : rpc(pilotage_refusal) refusée
    ok 145 - anon : rpc(pilotage_category_stats) refusée
    ok 146 - authenticated (compte CLIENT) : rpc(pilotage_category_stats) refusée
    ok 147 - anon : rpc(pilotage_compute_overview) refusée
    ok 148 - authenticated (compte CLIENT) : rpc(pilotage_compute_overview) refusée
    ok 149 - anon : rpc(pilotage_compute_cash) refusée
    ok 150 - authenticated (compte CLIENT) : rpc(pilotage_compute_cash) refusée
    ok 151 - anon : rpc(pilotage_overview) refusée
    ok 152 - authenticated (compte CLIENT) : rpc(pilotage_overview) refusée
    ok 153 - anon : rpc(pilotage_sales) refusée
    ok 154 - authenticated (compte CLIENT) : rpc(pilotage_sales) refusée
    ok 155 - anon : rpc(pilotage_entries) refusée
    ok 156 - authenticated (compte CLIENT) : rpc(pilotage_entries) refusée
    ok 157 - anon : rpc(pilotage_team) refusée
    ok 158 - authenticated (compte CLIENT) : rpc(pilotage_team) refusée
    ok 159 - anon : rpc(pilotage_cash) refusée
    ok 160 - authenticated (compte CLIENT) : rpc(pilotage_cash) refusée
    ok 161 - anon : rpc(pilotage_closing) refusée
    ok 162 - authenticated (compte CLIENT) : rpc(pilotage_closing) refusée
    ok 163 - anon : rpc(participants_export) refusée
    ok 164 - authenticated (compte CLIENT) : rpc(participants_export) refusée
    ok 165 - anon : rpc(event_controller_set_cash) refusée
    ok 166 - authenticated (compte CLIENT) : rpc(event_controller_set_cash) refusée
    ok 167 - anon : rpc(partner_events_overview) refusée
    ok 168 - authenticated (compte CLIENT) : rpc(partner_events_overview) refusée
    ok 169 - anon : rpc(admin_events_list) refusée
    ok 170 - authenticated (compte CLIENT) : rpc(admin_events_list) refusée
    ok 171 - anon : rpc(notification_outbox_claim) refusée
    ok 172 - authenticated (compte CLIENT) : rpc(notification_outbox_claim) refusée
    ok 173 - anon : rpc(notification_outbox_mark) refusée
    ok 174 - authenticated (compte CLIENT) : rpc(notification_outbox_mark) refusée
    ok 175 - anon : rpc(notification_daily_checks) refusée
    ok 176 - authenticated (compte CLIENT) : rpc(notification_daily_checks) refusée
    ok 177 - anon : rpc(notification_reminders_schedule) refusée
    ok 178 - authenticated (compte CLIENT) : rpc(notification_reminders_schedule) refusée
    ok 179 - anon : rpc(notification_sync_log) refusée
    ok 180 - authenticated (compte CLIENT) : rpc(notification_sync_log) refusée
    ok 181 - anon : rpc(notification_admin_alert) refusée
    ok 182 - authenticated (compte CLIENT) : rpc(notification_admin_alert) refusée
    ok 183 - anon : rpc(notification_preferences_get) refusée
    ok 184 - authenticated (compte CLIENT) : rpc(notification_preferences_get) refusée
    ok 185 - anon : rpc(notification_preference_set) refusée
    ok 186 - authenticated (compte CLIENT) : rpc(notification_preference_set) refusée
    ok 187 - anon : rpc(notification_test_push_enqueue) refusée
    ok 188 - authenticated (compte CLIENT) : rpc(notification_test_push_enqueue) refusée
    ok 189 - anon : rpc(notification_controller_activated) refusée
    ok 190 - authenticated (compte CLIENT) : rpc(notification_controller_activated) refusée
    ok 191 - anon : rpc(notification_retry) refusée
    ok 192 - authenticated (compte CLIENT) : rpc(notification_retry) refusée
    ok 193 - anon : rpc(notifications_page) refusée
    ok 194 - authenticated (compte CLIENT) : rpc(notifications_page) refusée
    ok 195 - anon : rpc(notifications_mark_read) refusée
    ok 196 - authenticated (compte CLIENT) : rpc(notifications_mark_read) refusée
    ok 197 - anon : rpc(admin_notifications_list) refusée
    ok 198 - authenticated (compte CLIENT) : rpc(admin_notifications_list) refusée
    ok 199 - anon : rpc(admin_notification_detail) refusée
    ok 200 - authenticated (compte CLIENT) : rpc(admin_notification_detail) refusée
    ok 201 - anon : rpc(admin_notifications_stats) refusée
    ok 202 - authenticated (compte CLIENT) : rpc(admin_notifications_stats) refusée
    ok 203 - anon : rpc(ticket_transfers_incoming) refusée
    ok 204 - authenticated (compte CLIENT) : rpc(ticket_transfers_incoming) refusée
    ok 205 - anon : rpc(ticket_transfer_accept) refusée
    ok 206 - authenticated (compte CLIENT) : rpc(ticket_transfer_accept) refusée
    ok 207 - anon : rpc(partner_status_set) refusée
    ok 208 - authenticated (compte CLIENT) : rpc(partner_status_set) refusée
    ok 209 - anon : rpc(notif_enqueue) refusée
    ok 210 - authenticated (compte CLIENT) : rpc(notif_enqueue) refusée
    ok 211 - anon : rpc(notif_enqueue_admins) refusée
    ok 212 - authenticated (compte CLIENT) : rpc(notif_enqueue_admins) refusée
    ok 213 - anon : rpc(notif_upsert_aggregated_sms) refusée
    ok 214 - authenticated (compte CLIENT) : rpc(notif_upsert_aggregated_sms) refusée
    ok 215 - anon : rpc(event_start_at) refusée
    ok 216 - authenticated (compte CLIENT) : rpc(event_start_at) refusée
ok 1 - R3 — RPC métier non appelables par anon / authenticated
    not ok 1 - anon et authenticated (compte CLIENT) : rpc(notification_outbox_claim) existe et est refusée
        → anon rpc(notification_outbox_claim) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.notification_outbox_claim(p) in the schema cache — PGRST202 : fonction absente ou signature différente de `(p jsonb)`
    not ok 2 - anon et authenticated (compte CLIENT) : rpc(notification_outbox_mark) existe et est refusée
        → anon rpc(notification_outbox_mark) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.notification_outbox_mark(p) in the schema cache — PGRST202 : fonction absente ou signature différente de `(p jsonb)`
    not ok 3 - anon et authenticated (compte CLIENT) : rpc(notification_daily_checks) existe et est refusée
        → anon rpc(notification_daily_checks) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.notification_daily_checks(p) in the schema cache — PGRST202 : fonction absente ou signature différente de `(p jsonb)`
    not ok 4 - anon et authenticated (compte CLIENT) : rpc(notification_reminders_schedule) existe et est refusée
        → anon rpc(notification_reminders_schedule) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.notification_reminders_schedule(p) in the schema cache — PGRST202 : fonction absente ou signature différente de `(p j
    not ok 5 - anon et authenticated (compte CLIENT) : rpc(notification_sync_log) existe et est refusée
        → anon rpc(notification_sync_log) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.notification_sync_log(p) in the schema cache — PGRST202 : fonction absente ou signature différente de `(p jsonb)`
    not ok 6 - anon et authenticated (compte CLIENT) : rpc(notification_admin_alert) existe et est refusée
        → anon rpc(notification_admin_alert) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.notification_admin_alert(p) in the schema cache — PGRST202 : fonction absente ou signature différente de `(p jsonb)`
    not ok 7 - anon et authenticated (compte CLIENT) : rpc(notification_preferences_get) existe et est refusée
        → anon rpc(notification_preferences_get) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.notification_preferences_get(p) in the schema cache — PGRST202 : fonction absente ou signature différente de `(p jsonb)`
    not ok 8 - anon et authenticated (compte CLIENT) : rpc(notification_preference_set) existe et est refusée
        → anon rpc(notification_preference_set) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.notification_preference_set(p) in the schema cache — PGRST202 : fonction absente ou signature différente de `(p jsonb)`
    not ok 9 - anon et authenticated (compte CLIENT) : rpc(notification_test_push_enqueue) existe et est refusée
        → anon rpc(notification_test_push_enqueue) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.notification_test_push_enqueue(p) in the schema cache — PGRST202 : fonction absente ou signature différente de `(p jso
    not ok 10 - anon et authenticated (compte CLIENT) : rpc(notification_controller_activated) existe et est refusée
        → anon rpc(notification_controller_activated) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.notification_controller_activated(p) in the schema cache — PGRST202 : fonction absente ou signature différente de `
    not ok 11 - anon et authenticated (compte CLIENT) : rpc(notification_retry) existe et est refusée
        → anon rpc(notification_retry) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.notification_retry(p) in the schema cache — PGRST202 : fonction absente ou signature différente de `(p jsonb)`
    not ok 12 - anon et authenticated (compte CLIENT) : rpc(notifications_page) existe et est refusée
        → anon rpc(notifications_page) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.notifications_page(p) in the schema cache — PGRST202 : fonction absente ou signature différente de `(p jsonb)`
    not ok 13 - anon et authenticated (compte CLIENT) : rpc(notifications_mark_read) existe et est refusée
        → anon rpc(notifications_mark_read) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.notifications_mark_read(p) in the schema cache — PGRST202 : fonction absente ou signature différente de `(p jsonb)`
    not ok 14 - anon et authenticated (compte CLIENT) : rpc(admin_notifications_list) existe et est refusée
        → anon rpc(admin_notifications_list) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.admin_notifications_list(p) in the schema cache — PGRST202 : fonction absente ou signature différente de `(p jsonb)`
    not ok 15 - anon et authenticated (compte CLIENT) : rpc(admin_notification_detail) existe et est refusée
        → anon rpc(admin_notification_detail) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.admin_notification_detail(p) in the schema cache — PGRST202 : fonction absente ou signature différente de `(p jsonb)`
    not ok 16 - anon et authenticated (compte CLIENT) : rpc(admin_notifications_stats) existe et est refusée
        → anon rpc(admin_notifications_stats) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.admin_notifications_stats(p) in the schema cache — PGRST202 : fonction absente ou signature différente de `(p jsonb)`
    not ok 17 - anon et authenticated (compte CLIENT) : rpc(ticket_transfers_incoming) existe et est refusée
        → anon rpc(ticket_transfers_incoming) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.ticket_transfers_incoming(p) in the schema cache — PGRST202 : fonction absente ou signature différente de `(p jsonb)`
    not ok 18 - anon et authenticated (compte CLIENT) : rpc(ticket_transfer_accept) existe et est refusée
        → anon rpc(ticket_transfer_accept) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.ticket_transfer_accept(p) in the schema cache — PGRST202 : fonction absente ou signature différente de `(p jsonb)`
    not ok 19 - anon et authenticated (compte CLIENT) : rpc(partner_status_set) existe et est refusée
        → anon rpc(partner_status_set) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.partner_status_set(p) in the schema cache — PGRST202 : fonction absente ou signature différente de `(p jsonb)`
    not ok 20 - anon et authenticated (compte CLIENT) : rpc(notif_enqueue) existe et est refusée
        → anon rpc(notif_enqueue) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.notif_enqueue(p) in the schema cache — PGRST202 : fonction absente ou signature différente de `(p jsonb)`
    not ok 21 - anon et authenticated (compte CLIENT) : rpc(notif_enqueue_admins) existe et est refusée
        → anon rpc(notif_enqueue_admins) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.notif_enqueue_admins(p) in the schema cache — PGRST202 : fonction absente ou signature différente de `(p jsonb)`
    not ok 22 - anon et authenticated (compte CLIENT) : rpc(notif_upsert_aggregated_sms) existe et est refusée
        → anon rpc(notif_upsert_aggregated_sms) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.notif_upsert_aggregated_sms(p) in the schema cache — PGRST202 : fonction absente ou signature différente de `(p jsonb)`
not ok 2 - R3 — lot 6 : chaque RPC du lot existe et reste réservée au rôle de service (42501)
    ok 1 - anon et authenticated : rpc(is_admin) acceptée
    ok 2 - anon et authenticated : rpc(is_superadmin) acceptée
    ok 3 - anon et authenticated : rpc(is_controller) acceptée
    ok 4 - anon et authenticated : rpc(has_role) acceptée
    ok 5 - anon et authenticated : rpc(is_partner_owner) acceptée
    ok 6 - anon et authenticated : rpc(auth_user_role) acceptée
ok 3 - R3 — aides RLS toujours appelables (sinon les politiques échouent)
# pass 222
# fail 22
```

Run 67 (après correctif) :

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
    ok 13 - anon : rpc(atomic_partner_remove_controller) refusée
    ok 14 - authenticated (compte CLIENT) : rpc(atomic_partner_remove_controller) refusée
    ok 15 - anon : rpc(generate_referral_code) refusée
    ok 16 - authenticated (compte CLIENT) : rpc(generate_referral_code) refusée
    ok 17 - anon : rpc(ticket_sale_problems) refusée
    ok 18 - authenticated (compte CLIENT) : rpc(ticket_sale_problems) refusée
    ok 19 - anon : rpc(checkout_create_payment) refusée
    ok 20 - authenticated (compte CLIENT) : rpc(checkout_create_payment) refusée
    ok 21 - anon : rpc(payment_release) refusée
    ok 22 - authenticated (compte CLIENT) : rpc(payment_release) refusée
    ok 23 - anon : rpc(stock_reservations_expire) refusée
    ok 24 - authenticated (compte CLIENT) : rpc(stock_reservations_expire) refusée
    ok 25 - anon : rpc(refund_request) refusée
    ok 26 - authenticated (compte CLIENT) : rpc(refund_request) refusée
    ok 27 - anon : rpc(payment_confirm) refusée
    ok 28 - authenticated (compte CLIENT) : rpc(payment_confirm) refusée
    ok 29 - anon : rpc(free_tickets_claim) refusée
    ok 30 - authenticated (compte CLIENT) : rpc(free_tickets_claim) refusée
    ok 31 - anon : rpc(payment_webhook_record) refusée
    ok 32 - authenticated (compte CLIENT) : rpc(payment_webhook_record) refusée
    ok 33 - anon : rpc(finance_setting_set) refusée
    ok 34 - authenticated (compte CLIENT) : rpc(finance_setting_set) refusée
    ok 35 - anon : rpc(fin_setting) refusée
    ok 36 - authenticated (compte CLIENT) : rpc(fin_setting) refusée
    ok 37 - anon : rpc(finance_compute) refusée
    ok 38 - authenticated (compte CLIENT) : rpc(finance_compute) refusée
    ok 39 - anon : rpc(finance_quote) refusée
    ok 40 - authenticated (compte CLIENT) : rpc(finance_quote) refusée
    ok 41 - anon : rpc(finance_account_balance) refusée
    ok 42 - authenticated (compte CLIENT) : rpc(finance_account_balance) refusée
    ok 43 - anon : rpc(ticket_refund_request) refusée
    ok 44 - authenticated (compte CLIENT) : rpc(ticket_refund_request) refusée
    ok 45 - anon : rpc(cashout_finalize) refusée
    ok 46 - authenticated (compte CLIENT) : rpc(cashout_finalize) refusée
    ok 47 - anon : rpc(withdrawal_request) refusée
    ok 48 - authenticated (compte CLIENT) : rpc(withdrawal_request) refusée
    ok 49 - anon : rpc(referral_commissions_release) refusée
    ok 50 - authenticated (compte CLIENT) : rpc(referral_commissions_release) refusée
    ok 51 - anon : rpc(finance_partner_summary) refusée
    ok 52 - authenticated (compte CLIENT) : rpc(finance_partner_summary) refusée
    ok 53 - anon : rpc(finance_platform_revenue) refusée
    ok 54 - authenticated (compte CLIENT) : rpc(finance_platform_revenue) refusée
    ok 55 - anon : rpc(ticket_scan) refusée
    ok 56 - authenticated (compte CLIENT) : rpc(ticket_scan) refusée
    ok 57 - anon : rpc(ticket_cash_checkin) refusée
    ok 58 - authenticated (compte CLIENT) : rpc(ticket_cash_checkin) refusée
    ok 59 - anon : rpc(counter_sale) refusée
    ok 60 - authenticated (compte CLIENT) : rpc(counter_sale) refusée
    ok 61 - anon : rpc(shift_open) refusée
    ok 62 - authenticated (compte CLIENT) : rpc(shift_open) refusée
    ok 63 - anon : rpc(ticket_transfer_claim) refusée
    ok 64 - authenticated (compte CLIENT) : rpc(ticket_transfer_claim) refusée
    ok 65 - anon : rpc(scan_scanner_authorized) refusée
    ok 66 - authenticated (compte CLIENT) : rpc(scan_scanner_authorized) refusée
    ok 67 - anon : rpc(scan_event_problem) refusée
    ok 68 - authenticated (compte CLIENT) : rpc(scan_event_problem) refusée
    ok 69 - anon : rpc(try_uuid) refusée
    ok 70 - authenticated (compte CLIENT) : rpc(try_uuid) refusée
    ok 71 - anon : rpc(ticket_transfer_initiate) refusée
    ok 72 - authenticated (compte CLIENT) : rpc(ticket_transfer_initiate) refusée
    ok 73 - anon : rpc(ticket_transfer_cancel) refusée
    ok 74 - authenticated (compte CLIENT) : rpc(ticket_transfer_cancel) refusée
    ok 75 - anon : rpc(ticket_transfers_expire) refusée
    ok 76 - authenticated (compte CLIENT) : rpc(ticket_transfers_expire) refusée
    ok 77 - anon : rpc(shift_close) refusée
    ok 78 - authenticated (compte CLIENT) : rpc(shift_close) refusée
    ok 79 - anon : rpc(user_roles_set) refusée
    ok 80 - authenticated (compte CLIENT) : rpc(user_roles_set) refusée
    ok 81 - anon : rpc(otp_check) refusée
    ok 82 - authenticated (compte CLIENT) : rpc(otp_check) refusée
    ok 83 - anon : rpc(scan_incident_log) refusée
    ok 84 - authenticated (compte CLIENT) : rpc(scan_incident_log) refusée
    ok 85 - anon : rpc(event_transition) refusée
    ok 86 - authenticated (compte CLIENT) : rpc(event_transition) refusée
    ok 87 - anon : rpc(event_actions) refusée
    ok 88 - authenticated (compte CLIENT) : rpc(event_actions) refusée
    ok 89 - anon : rpc(event_cancel) refusée
    ok 90 - authenticated (compte CLIENT) : rpc(event_cancel) refusée
    ok 91 - anon : rpc(event_cancellation_impact) refusée
    ok 92 - authenticated (compte CLIENT) : rpc(event_cancellation_impact) refusée
    ok 93 - anon : rpc(event_cancellation_progress) refusée
    ok 94 - authenticated (compte CLIENT) : rpc(event_cancellation_progress) refusée
    ok 95 - anon : rpc(events_finish_overdue) refusée
    ok 96 - authenticated (compte CLIENT) : rpc(events_finish_overdue) refusée
    ok 97 - anon : rpc(event_end_at) refusée
    ok 98 - authenticated (compte CLIENT) : rpc(event_end_at) refusée
    ok 99 - anon : rpc(event_status_label) refusée
    ok 100 - authenticated (compte CLIENT) : rpc(event_status_label) refusée
    ok 101 - anon : rpc(event_actor_profile) refusée
    ok 102 - authenticated (compte CLIENT) : rpc(event_actor_profile) refusée
    ok 103 - anon : rpc(event_status_apply) refusée
    ok 104 - authenticated (compte CLIENT) : rpc(event_status_apply) refusée
    ok 105 - anon : rpc(event_create) refusée
    ok 106 - authenticated (compte CLIENT) : rpc(event_create) refusée
    ok 107 - anon : rpc(event_update) refusée
    ok 108 - authenticated (compte CLIENT) : rpc(event_update) refusée
    ok 109 - anon : rpc(ticket_category_create) refusée
    ok 110 - authenticated (compte CLIENT) : rpc(ticket_category_create) refusée
    ok 111 - anon : rpc(ticket_category_update) refusée
    ok 112 - authenticated (compte CLIENT) : rpc(ticket_category_update) refusée
    ok 113 - anon : rpc(ticket_category_delete) refusée
    ok 114 - authenticated (compte CLIENT) : rpc(ticket_category_delete) refusée
    ok 115 - anon : rpc(event_edit_refusal) refusée
    ok 116 - authenticated (compte CLIENT) : rpc(event_edit_refusal) refusée
    ok 117 - anon : rpc(event_end_from) refusée
    ok 118 - authenticated (compte CLIENT) : rpc(event_end_from) refusée
    ok 119 - anon : rpc(event_poster_path_ok) refusée
    ok 120 - authenticated (compte CLIENT) : rpc(event_poster_path_ok) refusée
    ok 121 - anon : rpc(ticket_category_has_sales) refusée
    ok 122 - authenticated (compte CLIENT) : rpc(ticket_category_has_sales) refusée
    ok 123 - anon : rpc(event_has_sales) refusée
    ok 124 - authenticated (compte CLIENT) : rpc(event_has_sales) refusée
    ok 125 - anon : rpc(ticket_category_normalize) refusée
    ok 126 - authenticated (compte CLIENT) : rpc(ticket_category_normalize) refusée
    ok 127 - anon : rpc(ticket_category_guard) refusée
    ok 128 - authenticated (compte CLIENT) : rpc(ticket_category_guard) refusée
    ok 129 - anon : rpc(low_stock_threshold) refusée
    ok 130 - authenticated (compte CLIENT) : rpc(low_stock_threshold) refusée
    ok 131 - anon : rpc(public_category_stock_sync) refusée
    ok 132 - authenticated (compte CLIENT) : rpc(public_category_stock_sync) refusée
    ok 133 - anon : rpc(public_event_state_sync) refusée
    ok 134 - authenticated (compte CLIENT) : rpc(public_event_state_sync) refusée
    ok 135 - anon : rpc(pilotage_scan_result_label) refusée
    ok 136 - authenticated (compte CLIENT) : rpc(pilotage_scan_result_label) refusée
    ok 137 - anon : rpc(pilotage_ticket_status_label) refusée
    ok 138 - authenticated (compte CLIENT) : rpc(pilotage_ticket_status_label) refusée
    ok 139 - anon : rpc(pilotage_display_name) refusée
    ok 140 - authenticated (compte CLIENT) : rpc(pilotage_display_name) refusée
    ok 141 - anon : rpc(pilotage_access) refusée
    ok 142 - authenticated (compte CLIENT) : rpc(pilotage_access) refusée
    ok 143 - anon : rpc(pilotage_refusal) refusée
    ok 144 - authenticated (compte CLIENT) : rpc(pilotage_refusal) refusée
    ok 145 - anon : rpc(pilotage_category_stats) refusée
    ok 146 - authenticated (compte CLIENT) : rpc(pilotage_category_stats) refusée
    ok 147 - anon : rpc(pilotage_compute_overview) refusée
    ok 148 - authenticated (compte CLIENT) : rpc(pilotage_compute_overview) refusée
    ok 149 - anon : rpc(pilotage_compute_cash) refusée
    ok 150 - authenticated (compte CLIENT) : rpc(pilotage_compute_cash) refusée
    ok 151 - anon : rpc(pilotage_overview) refusée
    ok 152 - authenticated (compte CLIENT) : rpc(pilotage_overview) refusée
    ok 153 - anon : rpc(pilotage_sales) refusée
    ok 154 - authenticated (compte CLIENT) : rpc(pilotage_sales) refusée
    ok 155 - anon : rpc(pilotage_entries) refusée
    ok 156 - authenticated (compte CLIENT) : rpc(pilotage_entries) refusée
    ok 157 - anon : rpc(pilotage_team) refusée
    ok 158 - authenticated (compte CLIENT) : rpc(pilotage_team) refusée
    ok 159 - anon : rpc(pilotage_cash) refusée
    ok 160 - authenticated (compte CLIENT) : rpc(pilotage_cash) refusée
    ok 161 - anon : rpc(pilotage_closing) refusée
    ok 162 - authenticated (compte CLIENT) : rpc(pilotage_closing) refusée
    ok 163 - anon : rpc(participants_export) refusée
    ok 164 - authenticated (compte CLIENT) : rpc(participants_export) refusée
    ok 165 - anon : rpc(event_controller_set_cash) refusée
    ok 166 - authenticated (compte CLIENT) : rpc(event_controller_set_cash) refusée
    ok 167 - anon : rpc(partner_events_overview) refusée
    ok 168 - authenticated (compte CLIENT) : rpc(partner_events_overview) refusée
    ok 169 - anon : rpc(admin_events_list) refusée
    ok 170 - authenticated (compte CLIENT) : rpc(admin_events_list) refusée
    ok 171 - anon : rpc(notification_outbox_claim) refusée
    ok 172 - authenticated (compte CLIENT) : rpc(notification_outbox_claim) refusée
    ok 173 - anon : rpc(notification_outbox_mark) refusée
    ok 174 - authenticated (compte CLIENT) : rpc(notification_outbox_mark) refusée
    ok 175 - anon : rpc(notification_daily_checks) refusée
    ok 176 - authenticated (compte CLIENT) : rpc(notification_daily_checks) refusée
    ok 177 - anon : rpc(notification_reminders_schedule) refusée
    ok 178 - authenticated (compte CLIENT) : rpc(notification_reminders_schedule) refusée
    ok 179 - anon : rpc(notification_sync_log) refusée
    ok 180 - authenticated (compte CLIENT) : rpc(notification_sync_log) refusée
    ok 181 - anon : rpc(notification_admin_alert) refusée
    ok 182 - authenticated (compte CLIENT) : rpc(notification_admin_alert) refusée
    ok 183 - anon : rpc(notification_preferences_get) refusée
    ok 184 - authenticated (compte CLIENT) : rpc(notification_preferences_get) refusée
    ok 185 - anon : rpc(notification_preference_set) refusée
    ok 186 - authenticated (compte CLIENT) : rpc(notification_preference_set) refusée
    ok 187 - anon : rpc(notification_test_push_enqueue) refusée
    ok 188 - authenticated (compte CLIENT) : rpc(notification_test_push_enqueue) refusée
    ok 189 - anon : rpc(notification_controller_activated) refusée
    ok 190 - authenticated (compte CLIENT) : rpc(notification_controller_activated) refusée
    ok 191 - anon : rpc(notification_retry) refusée
    ok 192 - authenticated (compte CLIENT) : rpc(notification_retry) refusée
    ok 193 - anon : rpc(notifications_page) refusée
    ok 194 - authenticated (compte CLIENT) : rpc(notifications_page) refusée
    ok 195 - anon : rpc(notifications_mark_read) refusée
    ok 196 - authenticated (compte CLIENT) : rpc(notifications_mark_read) refusée
    ok 197 - anon : rpc(admin_notifications_list) refusée
    ok 198 - authenticated (compte CLIENT) : rpc(admin_notifications_list) refusée
    ok 199 - anon : rpc(admin_notification_detail) refusée
    ok 200 - authenticated (compte CLIENT) : rpc(admin_notification_detail) refusée
    ok 201 - anon : rpc(admin_notifications_stats) refusée
    ok 202 - authenticated (compte CLIENT) : rpc(admin_notifications_stats) refusée
    ok 203 - anon : rpc(ticket_transfers_incoming) refusée
    ok 204 - authenticated (compte CLIENT) : rpc(ticket_transfers_incoming) refusée
    ok 205 - anon : rpc(ticket_transfer_accept) refusée
    ok 206 - authenticated (compte CLIENT) : rpc(ticket_transfer_accept) refusée
    ok 207 - anon : rpc(partner_status_set) refusée
    ok 208 - authenticated (compte CLIENT) : rpc(partner_status_set) refusée
    ok 209 - anon : rpc(notif_enqueue) refusée
    ok 210 - authenticated (compte CLIENT) : rpc(notif_enqueue) refusée
    ok 211 - anon : rpc(notif_enqueue_admins) refusée
    ok 212 - authenticated (compte CLIENT) : rpc(notif_enqueue_admins) refusée
    ok 213 - anon : rpc(notif_upsert_aggregated_sms) refusée
    ok 214 - authenticated (compte CLIENT) : rpc(notif_upsert_aggregated_sms) refusée
    ok 215 - anon : rpc(event_start_at) refusée
    ok 216 - authenticated (compte CLIENT) : rpc(event_start_at) refusée
ok 1 - R3 — RPC métier non appelables par anon / authenticated
    ok 1 - anon et authenticated (compte CLIENT) : rpc(notification_outbox_claim) existe et est refusée
    ok 2 - anon et authenticated (compte CLIENT) : rpc(notification_outbox_mark) existe et est refusée
    ok 3 - anon et authenticated (compte CLIENT) : rpc(notification_daily_checks) existe et est refusée
    ok 4 - anon et authenticated (compte CLIENT) : rpc(notification_reminders_schedule) existe et est refusée
    ok 5 - anon et authenticated (compte CLIENT) : rpc(notification_sync_log) existe et est refusée
    ok 6 - anon et authenticated (compte CLIENT) : rpc(notification_admin_alert) existe et est refusée
    ok 7 - anon et authenticated (compte CLIENT) : rpc(notification_preferences_get) existe et est refusée
    ok 8 - anon et authenticated (compte CLIENT) : rpc(notification_preference_set) existe et est refusée
    ok 9 - anon et authenticated (compte CLIENT) : rpc(notification_test_push_enqueue) existe et est refusée
    ok 10 - anon et authenticated (compte CLIENT) : rpc(notification_controller_activated) existe et est refusée
    ok 11 - anon et authenticated (compte CLIENT) : rpc(notification_retry) existe et est refusée
    ok 12 - anon et authenticated (compte CLIENT) : rpc(notifications_page) existe et est refusée
    ok 13 - anon et authenticated (compte CLIENT) : rpc(notifications_mark_read) existe et est refusée
    ok 14 - anon et authenticated (compte CLIENT) : rpc(admin_notifications_list) existe et est refusée
    ok 15 - anon et authenticated (compte CLIENT) : rpc(admin_notification_detail) existe et est refusée
    ok 16 - anon et authenticated (compte CLIENT) : rpc(admin_notifications_stats) existe et est refusée
    ok 17 - anon et authenticated (compte CLIENT) : rpc(ticket_transfers_incoming) existe et est refusée
    ok 18 - anon et authenticated (compte CLIENT) : rpc(ticket_transfer_accept) existe et est refusée
    ok 19 - anon et authenticated (compte CLIENT) : rpc(partner_status_set) existe et est refusée
    ok 20 - anon et authenticated (compte CLIENT) : rpc(notif_enqueue) existe et est refusée
    ok 21 - anon et authenticated (compte CLIENT) : rpc(notif_enqueue_admins) existe et est refusée
    ok 22 - anon et authenticated (compte CLIENT) : rpc(notif_upsert_aggregated_sms) existe et est refusée
ok 2 - R3 — lot 6 : chaque RPC du lot existe et reste réservée au rôle de service (42501)
    ok 1 - anon et authenticated : rpc(is_admin) acceptée
    ok 2 - anon et authenticated : rpc(is_superadmin) acceptée
    ok 3 - anon et authenticated : rpc(is_controller) acceptée
    ok 4 - anon et authenticated : rpc(has_role) acceptée
    ok 5 - anon et authenticated : rpc(is_partner_owner) acceptée
    ok 6 - anon et authenticated : rpc(auth_user_role) acceptée
ok 3 - R3 — aides RLS toujours appelables (sinon les politiques échouent)
# pass 244
# fail 0
```

---

## 3. Captures : écrans capturés et corrections après relecture

En-tête de l'index du run vert (complet dans `docs/lot6-logs/ci-run67-captures-index.txt`, tableau dans `docs/lot6-logs/ci-run67-captures-avertissements.tsv`). Les images restent sur la branche `ci-results`, dossier `runs/67-41743807069/captures/` (172 PNG) ; aucune image n'est ajoutée au dépôt.

```text
EVENT VILLAGE — CAPTURES D’ÉCRAN (lot 5, tâche 5.1 ; lot 6, tâche 6.12)
généré le      : 2026-11-04T00:38:25.780Z
run CI         : 67-41743807069 (3a246ad2cb208c5632b630c068cc36251884e8b8)
format         : <écran>__<mobile|ordinateur>__<clair|sombre>.png — mobile 390×844 DPR 2, ordinateur 1440×900 DPR 1
captures       : 172 / 172 tentative(s)
en échec       : 0 (contrôles bloquants ou erreur)
avertissements : 171 capture(s) concernée(s) (cibles < 44 px, textes < 14 px, axe-core)
textes < 14 px : 48 hors exemption au total (détail sous chaque capture ; tableau : avertissements.tsv)
préchargements : 289 préchargement(s) Next abandonné(s), non bloquants, listés sous chaque capture (network.ts, lot 6)
Relecture humaine obligatoire : un écran n’est terminé qu’une fois sa capture relue (rapport du lot, section 3).
```

**43 écrans**, chacun en 4 vues : mobile et ordinateur, clair et sombre. Les 13 écrans du lot 6 sont marqués « 6 ».

| Écran | Lot | Rôle | Adresse | Description |
|---|---|---|---|---|
| `accueil` | 5 | anonyme | `/` | Accueil |
| `admin-evenements` | 5 | admin | `/admin/events` | Administration — événements (filtres, pagination) |
| `admin-evenements-en-attente` | 5 | admin | `/admin/events?status=EN_ATTENTE` | Administration — file de validation |
| `admin-evenements-erreur` | 5 | admin | `/admin/events` | Administration — état d’erreur |
| `admin-fiche-en-attente` | 5 | admin | `/admin/events/<id>` | Administration — fiche complète avant validation |
| `admin-fiche-suspendu` | 5 | admin | `/admin/events/<id>` | Administration — fiche d’un événement suspendu (motif, réactiver) |
| `admin-notifications` | 6 | admin | `/admin/notifications` | Administration — supervision des notifications (liste filtrable, compteurs) |
| `admin-notifications-detail` | 6 | admin | `/admin/notifications/<id>` | Administration — détail d’une notification en échec (Relancer) |
| `admin-notifications-erreur` | 6 | admin | `/admin/notifications` | Administration — supervision des notifications, état d’erreur |
| `catalogue` | 5 | anonyme | `/explore` | Catalogue des événements |
| `cloche-ouverte` | 6 | client | `/tickets` | Cloche ouverte (non lues d’abord, Tout marquer comme lu) |
| `connexion` | 6 | anonyme | `/login` | Connexion (système de design) |
| `controleur-scanner` | 5 | controleur | `/controller/scanner` | Scanner du contrôleur (caméra simulée) |
| `evenement-annule` | 5 | anonyme | `/events/<id>` | Page publique — événement annulé (avis public, remboursement) |
| `evenement-non-public` | 5 | anonyme | `/events/<id>` | URL d’un brouillon : page introuvable propre |
| `evenement-publie` | 5 | anonyme | `/events/<id>` | Page publique — événement publié (ce soir) |
| `evenement-suspendu` | 5 | anonyme | `/events/<id>` | Page publique — événement suspendu (bandeau, sans achat) |
| `evenement-termine` | 5 | anonyme | `/events/<id>` | Page publique — événement terminé (archive) |
| `hors-ligne` | 5 | anonyme | `/explore` | Indicateur « Hors ligne » (catalogue ouvert, connexion coupée) |
| `inscription` | 6 | anonyme | `/register` | Inscription (système de design) |
| `mes-billets` | 5 | client | `/tickets` | Mes billets (QR masqué) |
| `mes-billets-recus` | 6 | client | `/tickets?tab=recus` | Mes billets — onglet « Reçus » (transfert entrant à accepter) |
| `mot-de-passe-oublie` | 6 | anonyme | `/forgot-password` | Mot de passe oublié (système de design) |
| `notifications` | 5 | client | `/notifications` | Notifications du client |
| `notifications-erreur` | 6 | client | `/notifications` | Notifications du client — état d’erreur |
| `notifications-vide` | 6 | client | `/notifications` | Notifications du client — aucune notification |
| `partenaire-creation` | 5 | organisateur | `/partner/events/new` | Création d’un événement (formulaire partagé) |
| `partenaire-edition` | 5 | organisateur | `/partner/events/<id>/edit` | Édition d’un événement publié avec ventes (champs verrouillés) |
| `partenaire-evenements` | 5 | organisateur | `/partner/events` | Liste des événements de l’organisateur |
| `partenaire-evenements-annules` | 5 | organisateur | `/partner/events` | Liste de l’organisateur — onglet Annulé |
| `partenaire-evenements-erreur` | 5 | organisateur | `/partner/events` | Liste de l’organisateur — état d’erreur |
| `pilotage-annulation` | 5 | organisateur | `/partner/events/<id>` | Modale « Annuler l’événement » (impact, titre à retaper) |
| `pilotage-apercu` | 5 | organisateur | `/partner/events/<id>` | Pilotage — Aperçu |
| `pilotage-caisse` | 5 | organisateur | `/partner/events/<id>` | Pilotage — Caisse |
| `pilotage-cloture` | 5 | organisateur | `/partner/events/<id>` | Pilotage — Clôture et export |
| `pilotage-entrees` | 5 | organisateur | `/partner/events/<id>` | Pilotage — Entrées en direct |
| `pilotage-equipe` | 5 | organisateur | `/partner/events/<id>` | Pilotage — Équipe |
| `pilotage-erreur` | 5 | organisateur | `/partner/events/<id>` | Pilotage — état d’erreur |
| `pilotage-remboursements` | 5 | organisateur | `/partner/events/<id>` | Événement annulé — avancement des remboursements |
| `pilotage-ventes` | 5 | organisateur | `/partner/events/<id>` | Pilotage — Ventes |
| `preferences-push-active` | 6 | client | `/profile/notifications` | Préférences de notification — push activé sur l’appareil (abonnement simulé) |
| `preferences-push-non-pris-en-charge` | 6 | client | `/profile/notifications` | Préférences de notification — push non pris en charge par le navigateur |
| `preferences-push-refuse` | 6 | client | `/profile/notifications` | Préférences de notification — push refusé dans le navigateur |

**Relecture.** Captures relues des runs 65 et 66 (connexion, préférences avec push activé et refusé, cloche ouverte, notifications, détail et liste admin, Mes billets « Reçus »), plus les captures d'échec. J'ai revu moi-même, au run 67, `cloche-ouverte` en mobile clair et `partenaire-edition` en ordinateur clair.

**Ce qui a été corrigé après les avoir vues :**

| Run | Constat sur la capture | Correction |
|---|---|---|
| 65 | `preferences-push-active` (4 vues) bloquée deux minutes sur la lecture de la réponse d'inscription | le client push lit toujours le corps des réponses d'inscription et de retrait d'appareil ; Chromium gardait la requête ouverte (`6279f2f`) |
| 65 | `admin-notifications` : « SMS aujourd'hui » (160) supérieur à « SMS ce mois-ci » (159) | le mois suit la règle du jour : envoyés et à l'issue incertaine, peut-être facturés ; aide accordée au singulier et au pluriel (« dont 1 codes » corrigé) (`288dc5e`) |
| 65 | `connexion` en mobile : exemple « ex: 77 123 45 67 ou client@email.com » tronqué à 390 px | « 77 123 45 67 ou adresse email » (`1422502`) |
| 65 | `mes-billets-recus` en mobile : onglet « Reçus » et son compteur coupés au bord, sans indice | `ScrollableTabs` (`c77cd05`) |
| 65 | `notifications` et `notifications-vide` en mobile : sur 7 onglets, « Billets » coupé au bord | `ScrollableTabs` (`c77cd05`) |
| 66 | `notifications-erreur` en mobile sombre : chargement sans fin au lieu de l'écran d'erreur | défaut réel de l'écran : un rechargement temps réel lancé pendant le premier chargement rendait celui-ci caduc, et son échec ne posait qu'un bandeau ; tant qu'aucune liste n'est affichée, un échec mène à l'erreur avec « Réessayer » (`c77cd05`) |
| 66 | fumée, étape 7 : radio Wave jugé « hors de l'écran » dans la modale par `check({ force: true })` (l'étape avait réussi au run 65) | clic envoyé à l'élément, puis sélection vérifiée (`3a246ad`) |
| rapport | `admin-notifications` : depuis `288dc5e`, le total du mois était additionné dans le navigateur | le serveur renvoie `sms_month.total`, affiché tel quel (`43ff9ec`, après le run 67 : vérifié par le run du commit de ce rapport) |

**Relu sans défaut :** connexion (formulaire, libellés figés, bascule « Mot de passe » / « Code SMS ») ; push refusé (explication et marche à suivre, aucune demande d'autorisation) ; cloche ouverte (non lues d'abord, catégories, « Consulter », « Voir toutes les notifications », « Préférences » ; les heures sont masquées par Playwright) ; détail admin (« Relancer » sur une ligne en échec, motif humain, aucun code) ; liste admin (filtres, onglets de statut avec compteurs du serveur).

**Restes, et pourquoi ils restent :**
- Les champs de date des filtres admin affichent « mm/dd/yyyy » : le Chromium de la CI est en anglais. Le format suit la langue du navigateur ; un navigateur français affiche jj/mm/aaaa.
- Le libellé « Tout marquer comme lu » de la cloche passe sur deux lignes à 390 px (vu sur `cloche-ouverte__mobile__clair.png`). Ce libellé est exigé mot pour mot par `notif-cloche:643` et `notif-interface:1108` (tests du lot 6) ; le test du lot 5 (`notifications-and-documents`, cas 3) n'exige que `handleMarkAllAsRead`. La note de relecture qui l'attribuait au lot 5 était inexacte.
- Textes < 14 px hors exemption et cibles < 44 px restantes : section 8.

---

## 4. Requêtes des invariants et leur sortie

Chaque suite du lot, sauf `r20`, `r21` et `r22`, vérifie à sa fin, en lecture seule, les invariants dans cet ordre : (a)(b)(c), (d)(e)(f), (g)(h)(i), (j)(k)(l), contrôle du schéma du lot 6, passage de l'envoyeur (`dispatchNotifications()` sans horloge ni filtre, comme la route de cron), puis (m)(n)(o) (`tests/helpers/notification-invariants.ts`).
- **(m)** Au plus une ligne SENT ou SENDING par clé d'idempotence ; aucune ligne optionnelle SENT sans préférence activée dans l'instantané de décision, ni après la désactivation de la préférence.
- **(n)** Aucun rappel SENT pour un événement non PUBLIE à l'envoi (instantané, et historique des statuts) ; aucun rappel SENT à un compte sans billet VALIDE à ce moment-là (instantané, transferts réclamés et entrées avant l'envoi) ; aucun SMS optionnel SENT dans la plage de silence.
- **(o)** Aucune ligne SENDING depuis plus de 10 minutes après le passage de l'envoyeur ; tentatives au plus égales au maximum (lui-même au plus 5) ; toute ligne FAILED, UNCERTAIN, SKIPPED ou CANCELLED a un motif (plus large que la consigne, qui ne parlait que de FAILED).

```sql
-- (a)(b)(c) : tests/helpers/payment-invariants.ts (INVARIANT_SQL)
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
   -- Lot 4 : billet « à régler sur place » (commande impayée, encaissement au contrôle) : état légitime
   AND NOT (t.payment_id IS NULL AND t.status = 'VALIDE' AND EXISTS (
           SELECT 1 FROM public.orders o WHERE o.id = t.order_id AND o.payment_status <> 'SUCCESS'))
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

-- (g)(h)(i) : tests/helpers/access-invariants.ts (ACCESS_INVARIANT_SQL)
WITH accepted AS (
    SELECT s.ticket_id, count(*) AS n,
           count(*) FILTER (WHERE s.scanner_role IN ('CONTROLEUR', 'PARTENAIRE', 'ADMIN') AND s.event_id = t.event_id) AS authorized
      FROM public.ticket_scans s
      JOIN public.tickets t ON t.id = s.ticket_id
     WHERE s.accepted
     GROUP BY s.ticket_id
), shift_cash AS (
    SELECT shift_id, sum(amount) AS amount FROM public.payments
     WHERE shift_id IS NOT NULL AND NOT is_platform_payment AND status = 'SUCCESS'
     GROUP BY shift_id
)
SELECT 'g' AS regle, t.id::text AS objet,
       format('billet UTILISE : %s scan(s) accepté(s), dont %s par un scanneur autorisé', coalesce(a.n, 0), coalesce(a.authorized, 0)) AS detail
  FROM public.tickets t
  LEFT JOIN accepted a ON a.ticket_id = t.id
 WHERE t.status = 'UTILISE' AND (coalesce(a.n, 0) <> 1 OR coalesce(a.authorized, 0) <> 1)
UNION ALL
SELECT 'g', a.ticket_id::text, format('scan accepté sur un billet %s', t.status)
  FROM accepted a JOIN public.tickets t ON t.id = a.ticket_id
 WHERE t.status <> 'UTILISE'
UNION ALL
SELECT 'h', c.id::text, format('caisse %s : total attendu %s, paiements rattachés %s', c.status, c.expected_cash_total, coalesce(sc.amount, 0))
  FROM public.controller_shifts c
  LEFT JOIN shift_cash sc ON sc.shift_id = c.id
 WHERE c.expected_cash_total <> coalesce(sc.amount, 0)
UNION ALL
SELECT 'i', p.id::text,
       format('hors plateforme : frais %s, agrégateur %s, brut %s, net %s, reversement %s', p.service_fee, p.aggregator_fee,
              p.gross_event_village_revenue, p.net_event_village_revenue, p.partner_payout_amount)
  FROM public.payments p
 WHERE NOT p.is_platform_payment
   AND (p.service_fee <> 0 OR p.aggregator_fee <> 0 OR p.gross_event_village_revenue <> 0
        OR p.net_event_village_revenue <> 0 OR p.partner_payout_amount <> 0)
UNION ALL
SELECT 'i', p.id::text, format('hors plateforme : %s écriture(s) au grand livre', count(l.id))
  FROM public.payments p JOIN public.finance_ledger l ON l.payment_id = p.id
 WHERE NOT p.is_platform_payment
 GROUP BY p.id
ORDER BY 1, 2

-- (j)(k)(l) : tests/helpers/lifecycle-invariants.ts (LIFECYCLE_INVARIANT_SQL)
WITH hist AS (
    SELECT h.event_id,
           h.old_status::text AS old_status,
           h.new_status::text AS new_status,
           h.actor_role::text AS actor_role,
           h.channel::text AS channel,
           row_number() OVER w AS rang,
           lag(h.new_status::text) OVER w AS prev_new,
           count(*) OVER (PARTITION BY h.event_id) AS total
      FROM public.event_status_history h
    WINDOW w AS (PARTITION BY h.event_id ORDER BY h.created_at, h.txid, h.id)
), concerned AS (
    SELECT event_id FROM public.tickets WHERE event_id IS NOT NULL
    UNION
    SELECT event_id FROM public.ticket_scans WHERE event_id IS NOT NULL
    UNION
    SELECT event_id FROM public.controller_shifts
), truth AS MATERIALIZED (
    SELECT c.event_id,
           (SELECT count(*) FROM public.tickets t
             WHERE t.event_id = c.event_id AND t.status IN ('VALIDE', 'UTILISE')
               AND t.sale_channel IS DISTINCT FROM 'INVITATION') AS sold,
           (SELECT count(*) FROM public.ticket_scans s WHERE s.event_id = c.event_id AND s.accepted) AS accepted_scans,
           (SELECT count(*) FROM public.tickets t WHERE t.event_id = c.event_id AND t.status = 'UTILISE') AS used_tickets,
           public.pilotage_compute_overview(c.event_id) AS overview,
           public.pilotage_compute_cash(c.event_id) AS cash
      FROM concerned c
), shift_cash AS (
    SELECT shift_id, sum(amount) AS amount FROM public.payments
     WHERE shift_id IS NOT NULL AND NOT is_platform_payment AND status = 'SUCCESS'
     GROUP BY shift_id
), cash_rows AS (
    SELECT tr.event_id, x.value->>'id' AS shift_id, x.value->>'cash_collected' AS cash_collected
      FROM truth tr
     CROSS JOIN LATERAL jsonb_array_elements(
           CASE WHEN jsonb_typeof(tr.cash->'shifts') = 'array' THEN tr.cash->'shifts' ELSE '[]'::jsonb END) AS x(value)
)
SELECT 'j' AS regle, e.id::text AS objet, format('événement %s sans aucune ligne d''historique', e.status) AS detail
  FROM public.events e
 WHERE NOT EXISTS (SELECT 1 FROM public.event_status_history x WHERE x.event_id = e.id)
UNION ALL
SELECT 'j', h.event_id::text,
       format('première ligne %s → %s (canal %s), attendu NULL → BROUILLON (canal CREATION)',
              coalesce(h.old_status, 'NULL'), h.new_status, h.channel)
  FROM hist h
 WHERE h.rang = 1 AND NOT (h.old_status IS NULL AND h.new_status = 'BROUILLON' AND h.channel = 'CREATION')
UNION ALL
SELECT 'j', h.event_id::text,
       format('ligne %s : %s → %s, alors que la ligne précédente mène à %s', h.rang, coalesce(h.old_status, 'NULL'), h.new_status, h.prev_new)
  FROM hist h
 WHERE h.rang > 1 AND h.old_status IS DISTINCT FROM h.prev_new
UNION ALL
SELECT 'j', h.event_id::text,
       format('ligne %s : %s → %s par %s (canal %s) absente de event_status_transitions',
              h.rang, coalesce(h.old_status, 'NULL'), h.new_status, coalesce(h.actor_role, 'NULL'), h.channel)
  FROM hist h
 WHERE h.rang > 1 AND NOT EXISTS (
       SELECT 1 FROM public.event_status_transitions t
        WHERE t.from_status::text = h.old_status AND t.to_status::text = h.new_status
          AND t.actor_kind::text = h.actor_role AND t.channel::text = h.channel)
UNION ALL
SELECT 'j', e.id::text, format('statut %s, alors que la dernière ligne d''historique mène à %s', e.status, h.new_status)
  FROM public.events e
  JOIN hist h ON h.event_id = e.id AND h.rang = h.total
 WHERE h.new_status IS DISTINCT FROM e.status::text
UNION ALL
SELECT 'k', e.id::text,
       format('événement PUBLIE dont la fin (%s à Dakar) est dépassée de plus d''une heure après le passage du cron',
              to_char(public.event_end_at(e.id) AT TIME ZONE 'Africa/Dakar', 'DD/MM/YYYY HH24:MI'))
  FROM public.events e
 WHERE e.status::text = 'PUBLIE' AND public.event_end_at(e.id) < now() - interval '1 hour'
UNION ALL
SELECT 'l', tr.event_id::text,
       format('pilotage_compute_overview : vendus %s, vérité en base %s (billets VALIDE et UTILISE hors invitations)',
              coalesce(tr.overview->'tickets'->>'sold', 'absent'), tr.sold)
  FROM truth tr
 WHERE (tr.overview->'tickets'->>'sold')::numeric IS DISTINCT FROM tr.sold
UNION ALL
SELECT 'l', tr.event_id::text,
       format('pilotage_compute_overview : entrées %s, scans acceptés %s', coalesce(tr.overview->'entries'->>'total', 'absent'), tr.accepted_scans)
  FROM truth tr
 WHERE (tr.overview->'entries'->>'total')::numeric IS DISTINCT FROM tr.accepted_scans
UNION ALL
SELECT 'l', tr.event_id::text,
       format('pilotage_compute_overview : entrées %s, billets UTILISE %s', coalesce(tr.overview->'entries'->>'total', 'absent'), tr.used_tickets)
  FROM truth tr
 WHERE (tr.overview->'entries'->>'total')::numeric IS DISTINCT FROM tr.used_tickets
UNION ALL
SELECT 'l', tr.event_id::text,
       format('pilotage_compute_cash : clé shifts %s, tableau attendu', coalesce(jsonb_typeof(tr.cash->'shifts'), 'absente'))
  FROM truth tr
 WHERE jsonb_typeof(tr.cash->'shifts') IS DISTINCT FROM 'array'
UNION ALL
SELECT 'l', c.id::text,
       format('caisse %s de l''événement %s : %s entrée(s) dans pilotage_compute_cash, attendu 1', c.status, c.event_id, count(cr.shift_id))
  FROM public.controller_shifts c
  LEFT JOIN cash_rows cr ON cr.event_id = c.event_id AND cr.shift_id = c.id::text
 GROUP BY c.id, c.status, c.event_id
HAVING count(cr.shift_id) <> 1
UNION ALL
SELECT 'l', coalesce(cr.shift_id, 'NULL'), format('pilotage_compute_cash(%s) rend une caisse qui n''est pas de cet événement', cr.event_id)
  FROM cash_rows cr
 WHERE NOT EXISTS (SELECT 1 FROM public.controller_shifts c WHERE c.id::text = cr.shift_id AND c.event_id = cr.event_id)
UNION ALL
SELECT 'l', c.id::text,
       format('caisse %s : espèces au pilotage %s, total attendu %s, paiements rattachés %s',
              c.status, coalesce(cr.cash_collected, 'absent'), c.expected_cash_total, coalesce(sc.amount, 0))
  FROM public.controller_shifts c
  JOIN cash_rows cr ON cr.event_id = c.event_id AND cr.shift_id = c.id::text
  LEFT JOIN shift_cash sc ON sc.shift_id = c.id
 WHERE cr.cash_collected::numeric IS DISTINCT FROM c.expected_cash_total
    OR cr.cash_collected::numeric IS DISTINCT FROM coalesce(sc.amount, 0)
ORDER BY 1, 2

-- (m)(n)(o) : tests/helpers/notification-invariants.ts (NOTIFICATION_INVARIANT_SQL)
WITH o AS (SELECT * FROM public.notification_outbox),
m1 AS (SELECT 'm'::text AS regle, idempotency_key AS objet, 'plusieurs lignes SENT ou SENDING pour la même clé (' || count(*) || ')' AS detail
         FROM o WHERE status IN ('SENT','SENDING') GROUP BY idempotency_key HAVING count(*) > 1),
m2 AS (SELECT 'm', id::text, 'ligne optionnelle SENT sans préférence activée dans l''instantané'
         FROM o WHERE status = 'SENT' AND family = 'OPTIONAL'
          AND COALESCE((decision->'preference'->>'enabled')::boolean, false) IS NOT TRUE),
m3 AS (SELECT 'm', o.id::text, 'ligne optionnelle SENT alors que la préférence était désactivée depuis ' || p.updated_at
         FROM o JOIN public.notification_preferences p
           ON p.user_id = o.recipient_user_id AND p.topic = o.topic AND p.channel = o.channel
        WHERE o.status = 'SENT' AND o.family = 'OPTIONAL' AND p.enabled = false AND p.updated_at <= o.sent_at),
n1 AS (SELECT 'n', id::text, 'rappel SENT pour un événement non PUBLIE à l''envoi (instantané : ' || COALESCE(decision->'event'->>'status', 'absent') || ')'
         FROM o WHERE status = 'SENT' AND type IN ('REMINDER_J1','REMINDER_H3','CONTROLLER_REMINDER')
          AND COALESCE(decision->'event'->>'status', '') <> 'PUBLIE'),
n2 AS (SELECT 'n', o.id::text, 'rappel SENT alors que l''historique donne ' || h.new_status || ' à l''envoi'
         FROM o JOIN LATERAL (SELECT new_status FROM public.event_status_history h
                               WHERE h.event_id = o.event_id AND h.created_at <= o.sent_at
                               ORDER BY h.created_at DESC, h.txid DESC, h.id DESC LIMIT 1) h ON TRUE
        WHERE o.status = 'SENT' AND o.type IN ('REMINDER_J1','REMINDER_H3','CONTROLLER_REMINDER')
          AND o.sent_at <= now() AND h.new_status <> 'PUBLIE'),
n3 AS (SELECT 'n', id::text, 'rappel SENT à un compte sans billet VALIDE dans l''instantané'
         FROM o WHERE status = 'SENT' AND type IN ('REMINDER_J1','REMINDER_H3')
          AND COALESCE(jsonb_array_length(decision->'holder'->'valid_ticket_ids'), 0) = 0),
n4 AS (SELECT 'n', o.id::text, 'rappel SENT alors qu''aucun des billets de l''instantané n''était au compte et VALIDE à l''envoi'
         FROM o WHERE o.status = 'SENT' AND o.type IN ('REMINDER_J1','REMINDER_H3') AND o.sent_at <= now()
          AND jsonb_array_length(o.decision->'holder'->'valid_ticket_ids') > 0
          AND NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(o.decision->'holder'->'valid_ticket_ids') v(tid)
                JOIN public.tickets t ON t.id = v.tid::uuid AND t.event_id = o.event_id
               WHERE NOT EXISTS (SELECT 1 FROM public.ticket_transfers x WHERE x.ticket_id = t.id AND x.status = 'CLAIMED'
                                    AND x.from_user_id = o.recipient_user_id AND x.claimed_at <= o.sent_at)
                 AND NOT (t.checked_in_at IS NOT NULL AND t.checked_in_at <= o.sent_at))),
n5 AS (SELECT 'n', id::text, 'SMS optionnel SENT dans la plage de silence (' || COALESCE(decision->'quiet'->>'start', '?') || ' h - ' || COALESCE(decision->'quiet'->>'end', '?') || ' h)'
         FROM o WHERE status = 'SENT' AND channel = 'SMS' AND family = 'OPTIONAL'
          AND (decision->'quiet' IS NULL
               OR public.notif_in_quiet_hours(sent_at, (decision->'quiet'->>'start')::int, (decision->'quiet'->>'end')::int))),
o1 AS (SELECT 'o', id::text, 'SENDING depuis ' || claimed_at || ' après le passage de l''envoyeur'
         FROM o WHERE status = 'SENDING' AND claimed_at < now() - interval '10 minutes'),
o2 AS (SELECT 'o', id::text, 'tentatives ' || attempts || ' > maximum ' || max_attempts FROM o WHERE attempts > max_attempts OR max_attempts > 5),
o3 AS (SELECT 'o', id::text, 'ligne ' || status || ' sans motif'
         FROM o WHERE status IN ('FAILED','UNCERTAIN','SKIPPED','CANCELLED') AND (reason IS NULL OR btrim(reason) = ''))
SELECT * FROM m1 UNION ALL SELECT * FROM m2 UNION ALL SELECT * FROM m3 UNION ALL SELECT * FROM n1 UNION ALL SELECT * FROM n2
UNION ALL SELECT * FROM n3 UNION ALL SELECT * FROM n4 UNION ALL SELECT * FROM n5 UNION ALL SELECT * FROM o1
UNION ALL SELECT * FROM o2 UNION ALL SELECT * FROM o3
ORDER BY 1, 2
```

**Garde-fous** (`tests/parcours/notif-invariant.test.ts`) : chaque règle détecte une violation fabriquée dans une transaction annulée, puis on vérifie qu'aucune ligne fabriquée ne reste. Les trois cas (m), (n) et (o) et le contrôle « après ROLLBACK » sont `ok` au run 67 (bloc `notif-invariant`, section 2). Cette suite n'imprime pas les lignes de violation fabriquées ; seule la sortie TAP en témoigne.

**Sortie brute, run 67** : lignes `[INVARIANT…]` des 24 journaux de suite qui impriment `[INVARIANT-NOTIF]`. Aucune violation : le script qui a rempli ce rapport échoue si une ligne de détail ou un nombre de violations non nul apparaît.

```text
# tests__parcours__dette-annulation-transferts.test.ts.log
[INVARIANT] dette-annulation-transferts — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] dette-annulation-transferts — purge des réservations échues : {"expired":0}
[INVARIANT] dette-annulation-transferts — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] dette-annulation-transferts — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] dette-annulation-transferts — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] dette-annulation-transferts — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] dette-annulation-transferts — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] dette-annulation-transferts — envoyeur : 1000 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] dette-annulation-transferts — (m)(n)(o) : 0 violation(s)
# tests__parcours__dette-publication-reservations.test.ts.log
[INVARIANT] dette-publication-reservations — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] dette-publication-reservations — purge des réservations échues : {"expired":0}
[INVARIANT] dette-publication-reservations — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] dette-publication-reservations — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] dette-publication-reservations — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] dette-publication-reservations — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] dette-publication-reservations — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] dette-publication-reservations — envoyeur : 1000 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] dette-publication-reservations — (m)(n)(o) : 0 violation(s)
# tests__parcours__dette-suppression-evenement.test.ts.log
[INVARIANT] dette-suppression-evenement — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] dette-suppression-evenement — purge des réservations échues : {"expired":0}
[INVARIANT] dette-suppression-evenement — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] dette-suppression-evenement — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] dette-suppression-evenement — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] dette-suppression-evenement — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] dette-suppression-evenement — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] dette-suppression-evenement — envoyeur : 1000 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] dette-suppression-evenement — (m)(n)(o) : 0 violation(s)
# tests__parcours__dette-suspendu-temps-reel.test.ts.log
[INVARIANT] dette-suspendu-temps-reel — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] dette-suspendu-temps-reel — purge des réservations échues : {"expired":0}
[INVARIANT] dette-suspendu-temps-reel — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] dette-suspendu-temps-reel — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] dette-suspendu-temps-reel — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] dette-suspendu-temps-reel — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] dette-suspendu-temps-reel — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] dette-suspendu-temps-reel — envoyeur : 890 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] dette-suspendu-temps-reel — (m)(n)(o) : 0 violation(s)
# tests__parcours__notif-admin.test.ts.log
[INVARIANT] notif-admin — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] notif-admin — purge des réservations échues : {"expired":0}
[INVARIANT] notif-admin — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] notif-admin — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] notif-admin — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] notif-admin — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] notif-admin — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] notif-admin — envoyeur : 996 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] notif-admin — (m)(n)(o) : 0 violation(s)
# tests__parcours__notif-admins.test.ts.log
[INVARIANT] notif-admins — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] notif-admins — purge des réservations échues : {"expired":0}
[INVARIANT] notif-admins — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] notif-admins — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] notif-admins — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] notif-admins — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] notif-admins — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] notif-admins — envoyeur : 975 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] notif-admins — (m)(n)(o) : 0 violation(s)
# tests__parcours__notif-canaux.test.ts.log
[INVARIANT] notif-canaux — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] notif-canaux — purge des réservations échues : {"expired":0}
[INVARIANT] notif-canaux — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] notif-canaux — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] notif-canaux — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] notif-canaux — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] notif-canaux — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] notif-canaux — envoyeur : 62 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] notif-canaux — (m)(n)(o) : 0 violation(s)
# tests__parcours__notif-cloche.test.ts.log
[INVARIANT] notif-cloche — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] notif-cloche — purge des réservations échues : {"expired":0}
[INVARIANT] notif-cloche — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] notif-cloche — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] notif-cloche — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] notif-cloche — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] notif-cloche — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] notif-cloche — envoyeur : 0 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] notif-cloche — (m)(n)(o) : 0 violation(s)
# tests__parcours__notif-controleurs.test.ts.log
[INVARIANT] notif-controleurs — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] notif-controleurs — purge des réservations échues : {"expired":0}
[INVARIANT] notif-controleurs — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] notif-controleurs — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] notif-controleurs — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] notif-controleurs — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] notif-controleurs — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] notif-controleurs — envoyeur : 351 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] notif-controleurs — (m)(n)(o) : 0 violation(s)
# tests__parcours__notif-envoyeur.test.ts.log
[INVARIANT] notif-envoyeur — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] notif-envoyeur — purge des réservations échues : {"expired":0}
[INVARIANT] notif-envoyeur — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] notif-envoyeur — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] notif-envoyeur — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] notif-envoyeur — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] notif-envoyeur — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] notif-envoyeur — envoyeur : 0 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] notif-envoyeur — (m)(n)(o) : 0 violation(s)
# tests__parcours__notif-interface.test.ts.log
[INVARIANT] notif-interface — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] notif-interface — purge des réservations échues : {"expired":0}
[INVARIANT] notif-interface — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] notif-interface — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] notif-interface — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] notif-interface — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] notif-interface — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] notif-interface — envoyeur : 0 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] notif-interface — (m)(n)(o) : 0 violation(s)
# tests__parcours__notif-invariant.test.ts.log
[INVARIANT] notif-invariant — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] notif-invariant — purge des réservations échues : {"expired":0}
[INVARIANT] notif-invariant — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] notif-invariant — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] notif-invariant — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] notif-invariant — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] notif-invariant — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] notif-invariant — envoyeur : 1 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] notif-invariant — (m)(n)(o) : 0 violation(s)
# tests__parcours__notif-migration.test.ts.log
[INVARIANT] notif-migration — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] notif-migration — purge des réservations échues : {"expired":0}
[INVARIANT] notif-migration — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] notif-migration — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] notif-migration — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] notif-migration — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] notif-migration — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] notif-migration — envoyeur : 14 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] notif-migration — (m)(n)(o) : 0 violation(s)
# tests__parcours__notif-modeles.test.ts.log
[INVARIANT] notif-modeles — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] notif-modeles — purge des réservations échues : {"expired":0}
[INVARIANT] notif-modeles — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] notif-modeles — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] notif-modeles — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] notif-modeles — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] notif-modeles — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] notif-modeles — envoyeur : 0 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] notif-modeles — (m)(n)(o) : 0 violation(s)
# tests__parcours__notif-outbox.test.ts.log
[INVARIANT] notif-outbox — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] notif-outbox — purge des réservations échues : {"expired":0}
[INVARIANT] notif-outbox — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] notif-outbox — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] notif-outbox — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] notif-outbox — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] notif-outbox — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] notif-outbox — envoyeur : 14 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] notif-outbox — (m)(n)(o) : 0 violation(s)
# tests__parcours__notif-preferences.test.ts.log
[INVARIANT] notif-preferences — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] notif-preferences — purge des réservations échues : {"expired":0}
[INVARIANT] notif-preferences — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] notif-preferences — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] notif-preferences — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] notif-preferences — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] notif-preferences — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] notif-preferences — envoyeur : 68 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] notif-preferences — (m)(n)(o) : 0 violation(s)
# tests__parcours__notif-pros.test.ts.log
[INVARIANT] notif-pros — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] notif-pros — purge des réservations échues : {"expired":0}
[INVARIANT] notif-pros — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] notif-pros — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] notif-pros — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] notif-pros — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] notif-pros — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] notif-pros — envoyeur : 991 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] notif-pros — (m)(n)(o) : 0 violation(s)
# tests__parcours__notif-rappels-annulation.test.ts.log
[INVARIANT] notif-rappels-annulation — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] notif-rappels-annulation — purge des réservations échues : {"expired":0}
[INVARIANT] notif-rappels-annulation — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] notif-rappels-annulation — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] notif-rappels-annulation — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] notif-rappels-annulation — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] notif-rappels-annulation — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] notif-rappels-annulation — envoyeur : 205 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] notif-rappels-annulation — (m)(n)(o) : 0 violation(s)
# tests__parcours__notif-rappels.test.ts.log
[INVARIANT] notif-rappels — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] notif-rappels — purge des réservations échues : {"expired":0}
[INVARIANT] notif-rappels — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] notif-rappels — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] notif-rappels — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] notif-rappels — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] notif-rappels — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] notif-rappels — envoyeur : 495 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] notif-rappels — (m)(n)(o) : 0 violation(s)
# tests__parcours__notif-reglages.test.ts.log
[INVARIANT] notif-reglages — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] notif-reglages — purge des réservations échues : {"expired":0}
[INVARIANT] notif-reglages — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] notif-reglages — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] notif-reglages — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] notif-reglages — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] notif-reglages — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] notif-reglages — envoyeur : 0 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] notif-reglages — (m)(n)(o) : 0 violation(s)
# tests__parcours__notif-transferts.test.ts.log
[INVARIANT] notif-transferts — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] notif-transferts — purge des réservations échues : {"expired":0}
[INVARIANT] notif-transferts — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] notif-transferts — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] notif-transferts — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] notif-transferts — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] notif-transferts — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] notif-transferts — envoyeur : 71 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] notif-transferts — (m)(n)(o) : 0 violation(s)
# tests__parcours__push-abonnements.test.ts.log
[INVARIANT] push-abonnements — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] push-abonnements — purge des réservations échues : {"expired":0}
[INVARIANT] push-abonnements — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] push-abonnements — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] push-abonnements — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] push-abonnements — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] push-abonnements — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] push-abonnements — envoyeur : 1000 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] push-abonnements — (m)(n)(o) : 0 violation(s)
# tests__parcours__push-service-worker.test.ts.log
[INVARIANT] push-service-worker — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] push-service-worker — purge des réservations échues : {"expired":0}
[INVARIANT] push-service-worker — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] push-service-worker — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] push-service-worker — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] push-service-worker — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] push-service-worker — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] push-service-worker — envoyeur : 636 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] push-service-worker — (m)(n)(o) : 0 violation(s)
# tests__schema__planification-crons.test.ts.log
[INVARIANT] planification-crons — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] planification-crons — purge des réservations échues : {"expired":0}
[INVARIANT] planification-crons — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] planification-crons — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] planification-crons — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] planification-crons — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] planification-crons — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] planification-crons — envoyeur : 900 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] planification-crons — (m)(n)(o) : 0 violation(s)
```

**Seed de démonstration, run 67** (`docs/lot6-logs/ci-run67-e2e-seed.log`) :

```text
[seed-demo] notifications : préférence du client, transfert entrant, rappels J-1 planifiés (horloge simulée)…
[seed-demo] rappels J-1 planifiés : 44 ligne(s) à venir (« Festival Jazz sur le Fleuve »), 16 annulées par la suspension qui suit
[seed-demo] notifications : journal OTP, ligne FAILED après 5 tentatives, ligne UNCERTAIN, passage de l’envoyeur…
[seed-demo] envoyeur : 960 ligne(s) traitées
[seed-demo] notifications : FAILED 33a6714f-cb54-4923-b73f-657981e9dedd, UNCERTAIN 80bba831-c74c-41df-b4e3-e523f9112e8e, SENT f1238447-4d61-4791-80af-0328fd8d9e0a, journal OTP 644fbcec-00bb-4265-a254-ecf5a23356aa, 9 dans la cloche du client (2 lues)
[seed-demo] invariants (a) à (o)…
[INVARIANT] seed-demo — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] seed-demo — purge des réservations échues : {"expired":0}
[INVARIANT] seed-demo — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] seed-demo — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] seed-demo — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] seed-demo — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] seed-demo — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] seed-demo — envoyeur : 0 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] seed-demo — (m)(n)(o) : 0 violation(s)
[seed-demo] OK en 10.9s
```

---

## 5. Suites legacy touchées

Les suites `tests/legacy/` sont en quarantaine : `npm test` ne les exécute pas, mais elles sont typecheckées. Sortie brute :

```text
$ git diff --stat fff03b1 3a246ad -- tests/legacy
 tests/legacy/chunk5-phase1-bugs.test.ts            |  18 +--
 tests/legacy/client-ticket-lifecycle.test.ts       |  22 +--
 tests/legacy/ticket-pdf-and-exports.test.ts        |  57 +-------
 .../ticket-transfer-phase2-initiation.test.ts      |  70 +---------
 tests/legacy/ticket-transfer-phase3-claim.test.ts  | 153 +--------------------
 5 files changed, 17 insertions(+), 303 deletions(-)
```

Tout dans `267c32b` (nettoyage 6.7), parce que ces cas ne compilaient plus après la suppression de `NotificationService` et du jeton de réclamation :
- **`chunk5-phase1-bugs`** : import et cas BUG 3 supprimés (`sendPasswordResetNotification` n'existe plus), commentaire `// [lot 6 — cas supprimé]` avec la couverture.
- **`client-ticket-lifecycle`** : import et Test 6 supprimés (`sendTicketPurchaseNotifications`).
- **`ticket-pdf-and-exports`** : la mise en place du transfert est portée vers la nouvelle API (numéro de B vérifié, puis `acceptTransfer`), ce qui garde le TEST 6 (PDF après transfert, couvert nulle part ailleurs) ; TEST 8 et TEST 11 supprimés.
- **`ticket-transfer-phase2-initiation`** : cas 2 et 9 supprimés (jeton et cible email retirés).
- **`ticket-transfer-phase3-claim`** : TEST 1, 4, 5, 6 et 13 supprimés, import de la route retiré. Non couverts ailleurs : deux réclamations simultanées, annulation d'un transfert déjà réclamé.
- **Périmés à l'exécution mais compilés, non modifiés** (signalé par l'agent, non exécuté) : phase2 cas 1 (attend `claim_token_hash`) ; phase3 TEST 2 et 3 (la route répond 410) ; `client-ticket-lifecycle` tests 5 et 7 (l'in-app passe par l'envoyeur).
- Les autres assertions devenues fausses dans les suites legacy ne sont pas modifiées, conformément à la règle.

---

## 6. Sortie brute de `npm run verify`, de `npm run e2e` et CI

Run de référence : **https://github.com/fallouu-mn/event-village/actions/runs/41743807069** (run 67, commit `3a246ad`). Sorties complètes dans `docs/lot6-logs/` : `ci-run67-verify.log`, `ci-run67-db-reset.log`, `ci-run67-seed.log`, `ci-run67-e2e-seed.log`, `ci-run67-e2e.log`, `ci-run67-captures-index.txt`, `ci-run67-captures-avertissements.tsv`. Run rouge de référence : `ci-run60-verify.log`.

**Run 60 (référence « avant »), récapitulatif :**

```text
[run-tests] 152 suite(s) — garde-fou : tests/helpers/env.ts — délai/suite : 600.0s
═══════════════════ RÉCAPITULATIF ═══════════════════
Suite                                                  Statut   Durée     Code  Journal
tests/parcours/design-systeme.test.ts                  FAIL     1.3s      1     .test-logs/tests__parcours__design-systeme.test.ts.log
tests/parcours/dette-annulation-transferts.test.ts     FAIL     2.0s      1     .test-logs/tests__parcours__dette-annulation-transferts.test.ts.log
tests/parcours/dette-publication-reservations.test.ts  FAIL     19.4s     1     .test-logs/tests__parcours__dette-publication-reservations.test.ts.log
tests/parcours/dette-suppression-evenement.test.ts     FAIL     1.6s      1     .test-logs/tests__parcours__dette-suppression-evenement.test.ts.log
tests/parcours/dette-suspendu-temps-reel.test.ts       FAIL     39.5s     1     .test-logs/tests__parcours__dette-suspendu-temps-reel.test.ts.log
tests/parcours/notif-admin.test.ts                     FAIL     2.2s      1     .test-logs/tests__parcours__notif-admin.test.ts.log
tests/parcours/notif-admins.test.ts                    FAIL     4.4s      1     .test-logs/tests__parcours__notif-admins.test.ts.log
tests/parcours/notif-canaux.test.ts                    FAIL     8.4s      1     .test-logs/tests__parcours__notif-canaux.test.ts.log
tests/parcours/notif-cloche.test.ts                    FAIL     13.2s     1     .test-logs/tests__parcours__notif-cloche.test.ts.log
tests/parcours/notif-controleurs.test.ts               FAIL     3.1s      1     .test-logs/tests__parcours__notif-controleurs.test.ts.log
tests/parcours/notif-envoyeur.test.ts                  FAIL     1.8s      1     .test-logs/tests__parcours__notif-envoyeur.test.ts.log
tests/parcours/notif-interface.test.ts                 FAIL     1.6s      1     .test-logs/tests__parcours__notif-interface.test.ts.log
tests/parcours/notif-invariant.test.ts                 FAIL     689ms     1     .test-logs/tests__parcours__notif-invariant.test.ts.log
tests/parcours/notif-migration.test.ts                 FAIL     1.7s      1     .test-logs/tests__parcours__notif-migration.test.ts.log
tests/parcours/notif-modeles.test.ts                   FAIL     702ms     1     .test-logs/tests__parcours__notif-modeles.test.ts.log
tests/parcours/notif-outbox.test.ts                    FAIL     1.4s      1     .test-logs/tests__parcours__notif-outbox.test.ts.log
tests/parcours/notif-preferences.test.ts               FAIL     3.0s      1     .test-logs/tests__parcours__notif-preferences.test.ts.log
tests/parcours/notif-pros.test.ts                      FAIL     9.8s      1     .test-logs/tests__parcours__notif-pros.test.ts.log
tests/parcours/notif-rappels-annulation.test.ts        FAIL     2.6s      1     .test-logs/tests__parcours__notif-rappels-annulation.test.ts.log
tests/parcours/notif-rappels.test.ts                   FAIL     6.2s      1     .test-logs/tests__parcours__notif-rappels.test.ts.log
tests/parcours/notif-reglages.test.ts                  FAIL     1.5s      1     .test-logs/tests__parcours__notif-reglages.test.ts.log
tests/parcours/notif-transferts.test.ts                FAIL     3.0s      1     .test-logs/tests__parcours__notif-transferts.test.ts.log
tests/parcours/push-abonnements.test.ts                FAIL     2.6s      1     .test-logs/tests__parcours__push-abonnements.test.ts.log
tests/parcours/push-service-worker.test.ts             FAIL     714ms     1     .test-logs/tests__parcours__push-service-worker.test.ts.log
tests/schema/planification-crons.test.ts               FAIL     643ms     1     .test-logs/tests__schema__planification-crons.test.ts.log
tests/security/r20-evenements-ecritures-rest.test.ts   FAIL     558ms     1     .test-logs/tests__security__r20-evenements-ecritures-rest.test.ts.log
tests/security/r21-notifications-rest.test.ts          FAIL     787ms     1     .test-logs/tests__security__r21-notifications-rest.test.ts.log
tests/security/r22-reglages-notif.test.ts              FAIL     425ms     1     .test-logs/tests__security__r22-reglages-notif.test.ts.log
tests/security/r3-fonctions-rpc.test.ts                FAIL     1.2s      1     .test-logs/tests__security__r3-fonctions-rpc.test.ts.log
TOTAL : 152 suite(s) — 123 réussie(s), 29 en échec, 0 expirée(s)
[verify] ÉCHEC à l'étape "test" (code 1).
```

**Run 67, `npm run verify` :**

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

[run-tests] 152 suite(s) — garde-fou : tests/helpers/env.ts — délai/suite : 600.0s
[… 15586 lignes de sortie des suites, intégralement dans docs/lot6-logs/ci-run67-verify.log …]
═══════════════════ RÉCAPITULATIF ═══════════════════
Suite                                                  Statut   Durée     Code  Journal
tests/auth-rbac.test.ts                                PASS     198ms     0     .test-logs/tests__auth-rbac.test.ts.log
tests/e2e-scenarios.test.ts                            PASS     315ms     0     .test-logs/tests__e2e-scenarios.test.ts.log
tests/fondations-lot0.test.ts                          PASS     354ms     0     .test-logs/tests__fondations-lot0.test.ts.log
tests/notifications-and-documents.test.ts              PASS     218ms     0     .test-logs/tests__notifications-and-documents.test.ts.log
tests/parcours/acces-caisse-pin.test.ts                PASS     2.3s      0     .test-logs/tests__parcours__acces-caisse-pin.test.ts.log
tests/parcours/acces-encaissement.test.ts              PASS     2.0s      0     .test-logs/tests__parcours__acces-encaissement.test.ts.log
tests/parcours/acces-fenetre.test.ts                   PASS     1.5s      0     .test-logs/tests__parcours__acces-fenetre.test.ts.log
tests/parcours/acces-guichet.test.ts                   PASS     1.5s      0     .test-logs/tests__parcours__acces-guichet.test.ts.log
tests/parcours/acces-invariant.test.ts                 PASS     344ms     0     .test-logs/tests__parcours__acces-invariant.test.ts.log
tests/parcours/acces-limiteurs.test.ts                 PASS     7.3s      0     .test-logs/tests__parcours__acces-limiteurs.test.ts.log
tests/parcours/acces-pilotage.test.ts                  PASS     15.7s     0     .test-logs/tests__parcours__acces-pilotage.test.ts.log
tests/parcours/acces-qr.test.ts                        PASS     1.3s      0     .test-logs/tests__parcours__acces-qr.test.ts.log
tests/parcours/acces-reglages.test.ts                  PASS     932ms     0     .test-logs/tests__parcours__acces-reglages.test.ts.log
tests/parcours/acces-scan.test.ts                      PASS     1.4s      0     .test-logs/tests__parcours__acces-scan.test.ts.log
tests/parcours/acces-securite-urgente.test.ts          PASS     1.5s      0     .test-logs/tests__parcours__acces-securite-urgente.test.ts.log
tests/parcours/acces-totp.test.ts                      PASS     1.3s      0     .test-logs/tests__parcours__acces-totp.test.ts.log
tests/parcours/acces-tracabilite.test.ts               PASS     1.9s      0     .test-logs/tests__parcours__acces-tracabilite.test.ts.log
tests/parcours/achat-serveur.test.ts                   PASS     425ms     0     .test-logs/tests__parcours__achat-serveur.test.ts.log
tests/parcours/admin-evenements.test.ts                PASS     2.9s      0     .test-logs/tests__parcours__admin-evenements.test.ts.log
tests/parcours/anonymisation-debogage.test.ts          PASS     506ms     0     .test-logs/tests__parcours__anonymisation-debogage.test.ts.log
tests/parcours/attribution-roles.test.ts               PASS     839ms     0     .test-logs/tests__parcours__attribution-roles.test.ts.log
tests/parcours/bootstrap-superadmin.test.ts            PASS     404ms     0     .test-logs/tests__parcours__bootstrap-superadmin.test.ts.log
tests/parcours/changement-role-admin.test.ts           PASS     694ms     0     .test-logs/tests__parcours__changement-role-admin.test.ts.log
tests/parcours/cycle-annulation.test.ts                PASS     11.5s     0     .test-logs/tests__parcours__cycle-annulation.test.ts.log
tests/parcours/cycle-cron.test.ts                      PASS     1.5s      0     .test-logs/tests__parcours__cycle-cron.test.ts.log
tests/parcours/cycle-invariant.test.ts                 PASS     907ms     0     .test-logs/tests__parcours__cycle-invariant.test.ts.log
tests/parcours/cycle-transitions.test.ts               PASS     12.0s     0     .test-logs/tests__parcours__cycle-transitions.test.ts.log
tests/parcours/cycle-visibilite.test.ts                PASS     1.1s      0     .test-logs/tests__parcours__cycle-visibilite.test.ts.log
tests/parcours/design-systeme.test.ts                  PASS     981ms     0     .test-logs/tests__parcours__design-systeme.test.ts.log
tests/parcours/dette-admin-services.test.ts            PASS     965ms     0     .test-logs/tests__parcours__dette-admin-services.test.ts.log
tests/parcours/dette-annulation-transferts.test.ts     PASS     1.9s      0     .test-logs/tests__parcours__dette-annulation-transferts.test.ts.log
tests/parcours/dette-categories-publiques.test.ts      PASS     1.3s      0     .test-logs/tests__parcours__dette-categories-publiques.test.ts.log
tests/parcours/dette-cloture-caisse.test.ts            PASS     2.6s      0     .test-logs/tests__parcours__dette-cloture-caisse.test.ts.log
tests/parcours/dette-guichet.test.ts                   PASS     1.1s      0     .test-logs/tests__parcours__dette-guichet.test.ts.log
tests/parcours/dette-incidents.test.ts                 PASS     3.3s      0     .test-logs/tests__parcours__dette-incidents.test.ts.log
tests/parcours/dette-publication-reservations.test.ts  PASS     19.7s     0     .test-logs/tests__parcours__dette-publication-reservations.test.ts.log
tests/parcours/dette-retrait-controleur.test.ts        PASS     1.8s      0     .test-logs/tests__parcours__dette-retrait-controleur.test.ts.log
tests/parcours/dette-roles-otp.test.ts                 PASS     1.2s      0     .test-logs/tests__parcours__dette-roles-otp.test.ts.log
tests/parcours/dette-suppression-evenement.test.ts     PASS     1.6s      0     .test-logs/tests__parcours__dette-suppression-evenement.test.ts.log
tests/parcours/dette-suspendu-temps-reel.test.ts       PASS     44.4s     0     .test-logs/tests__parcours__dette-suspendu-temps-reel.test.ts.log
tests/parcours/dette-transferts.test.ts                PASS     1.1s      0     .test-logs/tests__parcours__dette-transferts.test.ts.log
tests/parcours/documents-inscription.test.ts           PASS     1.3s      0     .test-logs/tests__parcours__documents-inscription.test.ts.log
tests/parcours/edition-categories.test.ts              PASS     1.6s      0     .test-logs/tests__parcours__edition-categories.test.ts.log
tests/parcours/edition-formulaire.test.ts              PASS     3.5s      0     .test-logs/tests__parcours__edition-formulaire.test.ts.log
tests/parcours/edition-services.test.ts                PASS     642ms     0     .test-logs/tests__parcours__edition-services.test.ts.log
tests/parcours/edition-validation.test.ts              PASS     725ms     0     .test-logs/tests__parcours__edition-validation.test.ts.log
tests/parcours/email-optionnel.test.ts                 PASS     686ms     0     .test-logs/tests__parcours__email-optionnel.test.ts.log
tests/parcours/filtres-postgrest.test.ts               PASS     361ms     0     .test-logs/tests__parcours__filtres-postgrest.test.ts.log
tests/parcours/finance-affichage.test.ts               PASS     981ms     0     .test-logs/tests__parcours__finance-affichage.test.ts.log
tests/parcours/finance-annulation.test.ts              PASS     1.5s      0     .test-logs/tests__parcours__finance-annulation.test.ts.log
tests/parcours/finance-cibles.test.ts                  PASS     1.2s      0     .test-logs/tests__parcours__finance-cibles.test.ts.log
tests/parcours/finance-commissions.test.ts             PASS     3.3s      0     .test-logs/tests__parcours__finance-commissions.test.ts.log
tests/parcours/finance-hors-plateforme.test.ts         PASS     953ms     0     .test-logs/tests__parcours__finance-hors-plateforme.test.ts.log
tests/parcours/finance-invariant.test.ts               PASS     347ms     0     .test-logs/tests__parcours__finance-invariant.test.ts.log
tests/parcours/finance-moteur.test.ts                  PASS     1.1s      0     .test-logs/tests__parcours__finance-moteur.test.ts.log
tests/parcours/finance-rapports.test.ts                PASS     956ms     0     .test-logs/tests__parcours__finance-rapports.test.ts.log
tests/parcours/finance-reglages.test.ts                PASS     1.0s      0     .test-logs/tests__parcours__finance-reglages.test.ts.log
tests/parcours/finance-remboursement-billet.test.ts    PASS     1.4s      0     .test-logs/tests__parcours__finance-remboursement-billet.test.ts.log
tests/parcours/finance-retraits.test.ts                PASS     4.8s      0     .test-logs/tests__parcours__finance-retraits.test.ts.log
tests/parcours/invitation-identite.test.ts             PASS     1.0s      0     .test-logs/tests__parcours__invitation-identite.test.ts.log
tests/parcours/notif-admin.test.ts                     PASS     3.1s      0     .test-logs/tests__parcours__notif-admin.test.ts.log
tests/parcours/notif-admins.test.ts                    PASS     3.7s      0     .test-logs/tests__parcours__notif-admins.test.ts.log
tests/parcours/notif-canaux.test.ts                    PASS     3.6s      0     .test-logs/tests__parcours__notif-canaux.test.ts.log
tests/parcours/notif-cloche.test.ts                    PASS     15.5s     0     .test-logs/tests__parcours__notif-cloche.test.ts.log
tests/parcours/notif-controleurs.test.ts               PASS     2.7s      0     .test-logs/tests__parcours__notif-controleurs.test.ts.log
tests/parcours/notif-envoyeur.test.ts                  PASS     1.9s      0     .test-logs/tests__parcours__notif-envoyeur.test.ts.log
tests/parcours/notif-interface.test.ts                 PASS     1.7s      0     .test-logs/tests__parcours__notif-interface.test.ts.log
tests/parcours/notif-invariant.test.ts                 PASS     789ms     0     .test-logs/tests__parcours__notif-invariant.test.ts.log
tests/parcours/notif-migration.test.ts                 PASS     1.1s      0     .test-logs/tests__parcours__notif-migration.test.ts.log
tests/parcours/notif-modeles.test.ts                   PASS     586ms     0     .test-logs/tests__parcours__notif-modeles.test.ts.log
tests/parcours/notif-outbox.test.ts                    PASS     1.3s      0     .test-logs/tests__parcours__notif-outbox.test.ts.log
tests/parcours/notif-preferences.test.ts               PASS     2.7s      0     .test-logs/tests__parcours__notif-preferences.test.ts.log
tests/parcours/notif-pros.test.ts                      PASS     7.7s      0     .test-logs/tests__parcours__notif-pros.test.ts.log
tests/parcours/notif-rappels-annulation.test.ts        PASS     2.6s      0     .test-logs/tests__parcours__notif-rappels-annulation.test.ts.log
tests/parcours/notif-rappels.test.ts                   PASS     4.4s      0     .test-logs/tests__parcours__notif-rappels.test.ts.log
tests/parcours/notif-reglages.test.ts                  PASS     1.5s      0     .test-logs/tests__parcours__notif-reglages.test.ts.log
tests/parcours/notif-transferts.test.ts                PASS     2.7s      0     .test-logs/tests__parcours__notif-transferts.test.ts.log
tests/parcours/otp-hachage.test.ts                     PASS     330ms     0     .test-logs/tests__parcours__otp-hachage.test.ts.log
tests/parcours/otp-objet.test.ts                       PASS     1.1s      0     .test-logs/tests__parcours__otp-objet.test.ts.log
tests/parcours/otp-serveur.test.ts                     PASS     556ms     0     .test-logs/tests__parcours__otp-serveur.test.ts.log
tests/parcours/paiement-confirmation.test.ts           PASS     1.1s      0     .test-logs/tests__parcours__paiement-confirmation.test.ts.log
tests/parcours/paiement-controles.test.ts              PASS     1.5s      0     .test-logs/tests__parcours__paiement-controles.test.ts.log
tests/parcours/paiement-gratuits.test.ts               PASS     938ms     0     .test-logs/tests__parcours__paiement-gratuits.test.ts.log
tests/parcours/paiement-operateur.test.ts              PASS     646ms     0     .test-logs/tests__parcours__paiement-operateur.test.ts.log
tests/parcours/paiement-reconciliation.test.ts         PASS     1.1s      0     .test-logs/tests__parcours__paiement-reconciliation.test.ts.log
tests/parcours/paiement-remboursement.test.ts          PASS     1.5s      0     .test-logs/tests__parcours__paiement-remboursement.test.ts.log
tests/parcours/paiement-reservation.test.ts            PASS     1.4s      0     .test-logs/tests__parcours__paiement-reservation.test.ts.log
tests/parcours/paiement-retour.test.ts                 PASS     497ms     0     .test-logs/tests__parcours__paiement-retour.test.ts.log
tests/parcours/paiement-statut.test.ts                 PASS     857ms     0     .test-logs/tests__parcours__paiement-statut.test.ts.log
tests/parcours/paiement-webhook.test.ts                PASS     1.6s      0     .test-logs/tests__parcours__paiement-webhook.test.ts.log
tests/parcours/partenaire-liste.test.ts                PASS     1.9s      0     .test-logs/tests__parcours__partenaire-liste.test.ts.log
tests/parcours/pilotage-acces.test.ts                  PASS     11.9s     0     .test-logs/tests__parcours__pilotage-acces.test.ts.log
tests/parcours/pilotage-apercu-ventes.test.ts          PASS     2.3s      0     .test-logs/tests__parcours__pilotage-apercu-ventes.test.ts.log
tests/parcours/pilotage-cloture-export.test.ts         PASS     2.3s      0     .test-logs/tests__parcours__pilotage-cloture-export.test.ts.log
tests/parcours/pilotage-entrees.test.ts                PASS     15.7s     0     .test-logs/tests__parcours__pilotage-entrees.test.ts.log
tests/parcours/pilotage-equipe-caisse.test.ts          PASS     2.4s      0     .test-logs/tests__parcours__pilotage-equipe-caisse.test.ts.log
tests/parcours/pilotage-invariant.test.ts              PASS     2.5s      0     .test-logs/tests__parcours__pilotage-invariant.test.ts.log
tests/parcours/pin-regisseur.test.ts                   PASS     298ms     0     .test-logs/tests__parcours__pin-regisseur.test.ts.log
tests/parcours/push-abonnements.test.ts                PASS     3.1s      0     .test-logs/tests__parcours__push-abonnements.test.ts.log
tests/parcours/push-service-worker.test.ts             PASS     1.2s      0     .test-logs/tests__parcours__push-service-worker.test.ts.log
tests/parcours/realtime-scanner.test.ts                PASS     13.6s     0     .test-logs/tests__parcours__realtime-scanner.test.ts.log
tests/parcours/revocation-sessions.test.ts             PASS     1.3s      0     .test-logs/tests__parcours__revocation-sessions.test.ts.log
tests/parcours/roles-fraicheur.test.ts                 PASS     643ms     0     .test-logs/tests__parcours__roles-fraicheur.test.ts.log
tests/parcours/roles-metadonnees.test.ts               PASS     452ms     0     .test-logs/tests__parcours__roles-metadonnees.test.ts.log
tests/parcours/sms-anti-abus.test.ts                   PASS     480ms     0     .test-logs/tests__parcours__sms-anti-abus.test.ts.log
tests/parcours/statut-compte.test.ts                   PASS     1.7s      0     .test-logs/tests__parcours__statut-compte.test.ts.log
tests/parcours/temps-reel-billets.test.ts              PASS     22.2s     0     .test-logs/tests__parcours__temps-reel-billets.test.ts.log
tests/parcours/temps-reel-hook.test.ts                 PASS     225ms     0     .test-logs/tests__parcours__temps-reel-hook.test.ts.log
tests/parcours/temps-reel-prives.test.ts               PASS     43.8s     0     .test-logs/tests__parcours__temps-reel-prives.test.ts.log
tests/parcours/temps-reel-public.test.ts               PASS     27.0s     0     .test-logs/tests__parcours__temps-reel-public.test.ts.log
tests/parcours/temps-reel-stock.test.ts                PASS     21.8s     0     .test-logs/tests__parcours__temps-reel-stock.test.ts.log
tests/partner-auth-complete.test.ts                    PASS     314ms     0     .test-logs/tests__partner-auth-complete.test.ts.log
tests/partner-halls-m7.test.ts                         PASS     842ms     0     .test-logs/tests__partner-halls-m7.test.ts.log
tests/partner-orders-m9.test.ts                        PASS     969ms     0     .test-logs/tests__partner-orders-m9.test.ts.log
tests/payment.test.ts                                  PASS     179ms     0     .test-logs/tests__payment.test.ts.log
tests/roles-isolation.test.ts                          PASS     186ms     0     .test-logs/tests__roles-isolation.test.ts.log
tests/samirpay-contrat.test.ts                         PASS     3.6s      0     .test-logs/tests__samirpay-contrat.test.ts.log
tests/scanner-combat-ui.test.ts                        PASS     266ms     0     .test-logs/tests__scanner-combat-ui.test.ts.log
tests/scanner-wolof-audio.test.ts                      PASS     272ms     0     .test-logs/tests__scanner-wolof-audio.test.ts.log
tests/schema/fonctions-privileges.test.ts              PASS     246ms     0     .test-logs/tests__schema__fonctions-privileges.test.ts.log
tests/schema/hotfix-identique.test.ts                  PASS     182ms     0     .test-logs/tests__schema__hotfix-identique.test.ts.log
tests/schema/hotfix-scripts.test.ts                    PASS     342ms     0     .test-logs/tests__schema__hotfix-scripts.test.ts.log
tests/schema/planification-crons.test.ts               PASS     1.1s      0     .test-logs/tests__schema__planification-crons.test.ts.log
tests/schema/reset-test-password.test.ts               PASS     213ms     0     .test-logs/tests__schema__reset-test-password.test.ts.log
tests/schema/rls-toutes-tables.test.ts                 PASS     203ms     0     .test-logs/tests__schema__rls-toutes-tables.test.ts.log
tests/schema/secrets-codes-en-dur.test.ts              PASS     262ms     0     .test-logs/tests__schema__secrets-codes-en-dur.test.ts.log
tests/security/anon-uniquement.test.ts                 PASS     196ms     0     .test-logs/tests__security__anon-uniquement.test.ts.log
tests/security/r1-inscription-roles.test.ts            PASS     893ms     0     .test-logs/tests__security__r1-inscription-roles.test.ts.log
tests/security/r10-user-roles.test.ts                  PASS     511ms     0     .test-logs/tests__security__r10-user-roles.test.ts.log
tests/security/r11-storage-documents.test.ts           PASS     463ms     0     .test-logs/tests__security__r11-storage-documents.test.ts.log
tests/security/r12-reglages-finance.test.ts            PASS     377ms     0     .test-logs/tests__security__r12-reglages-finance.test.ts.log
tests/security/r13-parrainage-relations.test.ts        PASS     538ms     0     .test-logs/tests__security__r13-parrainage-relations.test.ts.log
tests/security/r14-retraits-insertion.test.ts          PASS     435ms     0     .test-logs/tests__security__r14-retraits-insertion.test.ts.log
tests/security/r15-statut-ambassadeur.test.ts          PASS     430ms     0     .test-logs/tests__security__r15-statut-ambassadeur.test.ts.log
tests/security/r16-reglages-acces.test.ts              PASS     332ms     0     .test-logs/tests__security__r16-reglages-acces.test.ts.log
tests/security/r17-statut-evenement-rest.test.ts       PASS     339ms     0     .test-logs/tests__security__r17-statut-evenement-rest.test.ts.log
tests/security/r18-partenaires-public.test.ts          PASS     544ms     0     .test-logs/tests__security__r18-partenaires-public.test.ts.log
tests/security/r19-categories-transferts.test.ts       PASS     543ms     0     .test-logs/tests__security__r19-categories-transferts.test.ts.log
tests/security/r2-otp-codes.test.ts                    PASS     309ms     0     .test-logs/tests__security__r2-otp-codes.test.ts.log
tests/security/r20-evenements-ecritures-rest.test.ts   PASS     410ms     0     .test-logs/tests__security__r20-evenements-ecritures-rest.test.ts.log
tests/security/r21-notifications-rest.test.ts          PASS     667ms     0     .test-logs/tests__security__r21-notifications-rest.test.ts.log
tests/security/r22-reglages-notif.test.ts              PASS     448ms     0     .test-logs/tests__security__r22-reglages-notif.test.ts.log
tests/security/r3-fonctions-rpc.test.ts                PASS     823ms     0     .test-logs/tests__security__r3-fonctions-rpc.test.ts.log
tests/security/r4-ecritures-directes.test.ts           PASS     408ms     0     .test-logs/tests__security__r4-ecritures-directes.test.ts.log
tests/security/r5-lectures-anon.test.ts                PASS     374ms     0     .test-logs/tests__security__r5-lectures-anon.test.ts.log
tests/security/r6-roles-jeton.test.ts                  PASS     456ms     0     .test-logs/tests__security__r6-roles-jeton.test.ts.log
tests/security/r7-profil-colonnes.test.ts              PASS     625ms     0     .test-logs/tests__security__r7-profil-colonnes.test.ts.log
tests/security/r8-controleur-lectures.test.ts          PASS     440ms     0     .test-logs/tests__security__r8-controleur-lectures.test.ts.log
tests/security/r9-partenaire-ecritures.test.ts         PASS     367ms     0     .test-logs/tests__security__r9-partenaire-ecritures.test.ts.log
tests/sms-formatage.test.ts                            PASS     241ms     0     .test-logs/tests__sms-formatage.test.ts.log
tests/superadmin-complete.test.ts                      PASS     260ms     0     .test-logs/tests__superadmin-complete.test.ts.log
tests/ux-performance-and-double-click.test.ts          PASS     483ms     0     .test-logs/tests__ux-performance-and-double-click.test.ts.log
──────────────────────────────────────────────────────
TOTAL : 152 suite(s) — 152 réussie(s), 0 en échec, 0 expirée(s)

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
   Generating static pages (0/56) ...
[getServerSessionUser] Erreur session: B [Error]: Dynamic server usage: Route /api/partner/orders couldn't be rendered statically because it used `request.headers`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error
    at V (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:21778)
    at Object.get (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:29465)
    at o (/home/runner/work/event-village/event-village/.next/server/chunks/2733.js:1:12239)
    at E (/home/runner/work/event-village/event-village/.next/server/chunks/2733.js:1:920)
    at l (/home/runner/work/event-village/event-village/.next/server/chunks/2733.js:1:445)
    at c (/home/runner/work/event-village/event-village/.next/server/app/api/partner/orders/route.js:1:568)
    at /home/runner/work/event-village/event-village/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:38417
    at /home/runner/work/event-village/event-village/node_modules/next/dist/server/lib/trace/tracer.js:140:36
    at NoopContextManager.with (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:7062)
    at ContextAPI.with (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:518) {
  description: "Route /api/partner/orders couldn't be rendered statically because it used `request.headers`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error",
  digest: 'DYNAMIC_SERVER_USAGE'
}
   Generating static pages (14/56) 
   Generating static pages (28/56) 
   Generating static pages (42/56) 
 ✓ Generating static pages (56/56)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                             Size     First Load JS
┌ ○ /                                                   4.74 kB         192 kB
├ ○ /_not-found                                         186 B          88.2 kB
├ ○ /admin                                              186 B          88.2 kB
├ ○ /admin/audit                                        5.5 kB          110 kB
├ ○ /admin/communications                               5.89 kB         110 kB
├ ○ /admin/dashboard                                    16.8 kB         194 kB
├ ○ /admin/events                                       8.46 kB         191 kB
├ ƒ /admin/events/[id]                                  10.9 kB         148 kB
├ ○ /admin/finance                                      9.88 kB         194 kB
├ ○ /admin/finance-settings                             12.3 kB         196 kB
├ ○ /admin/notifications                                9.33 kB         191 kB
├ ƒ /admin/notifications/[id]                           10.6 kB         193 kB
├ ○ /admin/pricing                                      5.5 kB          110 kB
├ ○ /admin/referral                                     7.83 kB         112 kB
├ ○ /admin/services                                     9.51 kB         114 kB
├ ○ /admin/users                                        24.2 kB         146 kB
├ ƒ /api/admin/audit                                    0 B                0 B
├ ƒ /api/admin/communications                           0 B                0 B
├ ƒ /api/admin/events                                   0 B                0 B
├ ƒ /api/admin/events/[id]                              0 B                0 B
├ ƒ /api/admin/events/[id]/cancel                       0 B                0 B
├ ƒ /api/admin/events/[id]/transition                   0 B                0 B
├ ƒ /api/admin/finance-settings                         0 B                0 B
├ ƒ /api/admin/finance/reconciliation                   0 B                0 B
├ ƒ /api/admin/metrics                                  0 B                0 B
├ ƒ /api/admin/notifications                            0 B                0 B
├ ƒ /api/admin/notifications/[id]                       0 B                0 B
├ ƒ /api/admin/notifications/[id]/retry                 0 B                0 B
├ ƒ /api/admin/notifications/stats                      0 B                0 B
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
├ ƒ /api/controller/counter-sale                        0 B                0 B
├ ƒ /api/controller/profile                             0 B                0 B
├ ƒ /api/controller/scan                                0 B                0 B
├ ƒ /api/controller/scan/incidents                      0 B                0 B
├ ƒ /api/controller/setup                               0 B                0 B
├ ƒ /api/controller/shifts/[id]/summary                 0 B                0 B
├ ƒ /api/controller/shifts/active                       0 B                0 B
├ ƒ /api/controller/shifts/close                        0 B                0 B
├ ƒ /api/controller/shifts/open                         0 B                0 B
├ ƒ /api/cron/events-finish                             0 B                0 B
├ ƒ /api/cron/moratoriums                               0 B                0 B
├ ƒ /api/cron/notifications-dispatch                    0 B                0 B
├ ƒ /api/cron/payments-reconcile                        0 B                0 B
├ ƒ /api/cron/referral-commissions                      0 B                0 B
├ ƒ /api/cron/reminders                                 0 B                0 B
├ ƒ /api/cron/stock-reservations                        0 B                0 B
├ ƒ /api/cron/ticket-transfers                          0 B                0 B
├ ƒ /api/events                                         0 B                0 B
├ ƒ /api/events/[id]                                    0 B                0 B
├ ƒ /api/finance/balance                                0 B                0 B
├ ƒ /api/halls                                          0 B                0 B
├ ƒ /api/halls/[id]                                     0 B                0 B
├ ƒ /api/halls/reserve                                  0 B                0 B
├ ƒ /api/notifications                                  0 B                0 B
├ ƒ /api/notifications/[id]/read                        0 B                0 B
├ ƒ /api/notifications/essai-push                       0 B                0 B
├ ƒ /api/notifications/preferences                      0 B                0 B
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
├ ƒ /api/partner/events/[id]/participants-export        0 B                0 B
├ ƒ /api/partner/events/[id]/pilotage/cash              0 B                0 B
├ ƒ /api/partner/events/[id]/pilotage/closing           0 B                0 B
├ ƒ /api/partner/events/[id]/pilotage/entries           0 B                0 B
├ ƒ /api/partner/events/[id]/pilotage/overview          0 B                0 B
├ ƒ /api/partner/events/[id]/pilotage/sales             0 B                0 B
├ ƒ /api/partner/events/[id]/pilotage/team              0 B                0 B
├ ƒ /api/partner/events/[id]/promotion                  0 B                0 B
├ ƒ /api/partner/events/[id]/regisseur-pin              0 B                0 B
├ ƒ /api/partner/events/[id]/shifts                     0 B                0 B
├ ƒ /api/partner/events/[id]/tickets/[ticketId]/refund  0 B                0 B
├ ƒ /api/partner/events/[id]/transition                 0 B                0 B
├ ƒ /api/partner/events/overview                        0 B                0 B
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
├ ƒ /api/partner/team/assignments/[id]                  0 B                0 B
├ ƒ /api/partner/team/controller/[controllerId]         0 B                0 B
├ ƒ /api/partner/team/entry-point                       0 B                0 B
├ ƒ /api/partner/team/invite                            0 B                0 B
├ ƒ /api/partner/upload                                 0 B                0 B
├ ƒ /api/payments/[transactionId]/cancel                0 B                0 B
├ ƒ /api/payments/[transactionId]/status                0 B                0 B
├ ƒ /api/payments/create                                0 B                0 B
├ ƒ /api/push/config                                    0 B                0 B
├ ƒ /api/push/subscriptions                             0 B                0 B
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
├ ƒ /api/tickets/transfers/[id]/claim                   0 B                0 B
├ ƒ /api/tickets/transfers/incoming                     0 B                0 B
├ ƒ /api/webhooks/samirpay                              0 B                0 B
├ ƒ /api/withdrawals/otp                                0 B                0 B
├ ƒ /api/withdrawals/request                            0 B                0 B
├ ○ /controller/profile                                 6.58 kB         111 kB
├ ○ /controller/scanner                                 15.7 kB         208 kB
├ ○ /controller/setup                                   4.9 kB          169 kB
├ ƒ /events/[id]                                        16.9 kB         206 kB
├ ○ /explore                                            3.41 kB         190 kB
├ ○ /forgot-password                                    10.4 kB         197 kB
├ ○ /halls                                              5.63 kB         115 kB
├ ƒ /halls/[id]                                         8.37 kB         198 kB
├ ƒ /login                                              12.7 kB         199 kB
├ ○ /notifications                                      8.8 kB          190 kB
├ ○ /orders                                             7.75 kB         181 kB
├ ƒ /paiement/[id]                                      8.67 kB         241 kB
├ ○ /partner                                            186 B          88.2 kB
├ ○ /partner/calendar                                   4.88 kB         109 kB
├ ○ /partner/dashboard                                  16.5 kB         189 kB
├ ○ /partner/events                                     9.18 kB         205 kB
├ ƒ /partner/events/[id]                                21.1 kB         211 kB
├ ƒ /partner/events/[id]/caisse                         186 B          88.2 kB
├ ƒ /partner/events/[id]/edit                           366 B           222 kB
├ ƒ /partner/events/[id]/team                           186 B          88.2 kB
├ ○ /partner/events/new                                 296 B           222 kB
├ ○ /partner/finance                                    7.82 kB         197 kB
├ ○ /partner/halls                                      8.11 kB         122 kB
├ ƒ /partner/halls/[id]/edit                            9.83 kB         127 kB
├ ○ /partner/halls/new                                  9.34 kB         127 kB
├ ○ /partner/orders                                     11.8 kB         189 kB
├ ○ /partner/products                                   7.39 kB         121 kB
├ ○ /partner/products/new                               9.1 kB          127 kB
├ ○ /partner/profile                                    4.84 kB         109 kB
├ ○ /partner/register                                   9.7 kB          127 kB
├ ○ /partner/scan                                       5.47 kB         119 kB
├ ○ /partner/stats                                      5.79 kB         101 kB
├ ○ /partner/subscription                               6.22 kB         110 kB
├ ○ /partner/tables                                     9.77 kB         123 kB
├ ○ /partner/team                                       13.2 kB         190 kB
├ ○ /profile                                            9.75 kB         183 kB
├ ○ /profile/notifications                              12.7 kB         186 kB
├ ○ /register                                           12.1 kB         198 kB
├ ○ /reset-password                                     10.8 kB         184 kB
├ ƒ /restaurants/[id]/menu                              7.41 kB         197 kB
├ ƒ /restaurants/[id]/tables                            7.84 kB         197 kB
├ ○ /scan                                               186 B          88.2 kB
├ ○ /tickets                                            19.3 kB         255 kB
├ ƒ /tickets/claim/[token]                              186 B          88.2 kB
└ ○ /wallet                                             9.27 kB         199 kB
+ First Load JS shared by all                           88 kB
  ├ chunks/2117-488d789e9004e22c.js                     31.9 kB
  ├ chunks/fd9d1056-270721ac51469ce4.js                 53.6 kB
  └ other shared chunks (total)                         2.48 kB


ƒ Middleware                                            87.6 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand


[verify] OK — 4 étapes réussies en 503s.
```

**Run 67, `npm run e2e`** (connexions, captures, fumée), lignes de synthèse :

```text
  7 passed (7.7s)
[e2e] phase connexion : OK en 8s
[e2e] index des captures : .e2e-captures/captures/index.txt (172 entrée(s), 0 en échec)
  172 passed (23.5m)
[e2e] phase captures : OK en 1409s
[e2e][fiche admin] GET /api/admin/events/7cd5657d-5335-41f1-b08c-53b538894ed0 → 200 statut=EN_ATTENTE code=—
[e2e][fiche admin] POST /api/admin/events/7cd5657d-5335-41f1-b08c-53b538894ed0/transition → 200 statut=VALIDE code=—
[e2e][fiche admin] GET /api/admin/events/7cd5657d-5335-41f1-b08c-53b538894ed0 → 200 statut=VALIDE code=—
[e2e][horloge] import des modules du dépôt impossible dans Playwright (Cannot find module '@/lib/payments/rpc') : repli sur scripts/e2e/clock-run.ts (contrat, section Y)
[e2e][fumée] horloge simulée : repli scripts/e2e/clock-run.ts (Cannot find module '@/lib/payments/rpc')
[e2e][fumée] planification à 2026-11-05T10:00:30.000Z : {"created":{"REMINDER_J1":4,"REMINDER_H3":0,"CONTROLLER_REMINDER":0},"events":1}
[e2e][fumée] envoyeur à 2026-11-05T10:01:30.000Z : {"claimed":22,"sent":11,"retried":0,"failed":0,"skipped":11,"uncertain":0,"cancelled":0,"waiting":0,"reclaimed":0,"rounds":1,"smsToday":4}
[e2e][fumée] planification à 2026-11-06T17:00:30.000Z : {"created":{"REMINDER_J1":0,"REMINDER_H3":3,"CONTROLLER_REMINDER":0},"events":1}
[e2e][fumée] GET /api/cron/notifications-dispatch → 200 {"ok":true,"claimed":30,"sent":14,"retried":0,"failed":0,"skipped":17,"uncertain":0,"cancelled":0,"waiting":0,"reclaimed":0,"rounds":1,"smsToday":164}
[e2e][fumée] SMS du client depuis l’étape 8 : 5 ({"j1":1,"h3":0,"annulation":1})
[e2e][fumée] avertissements non bloquants du navigateur :
  ✓  1 [fumee] › e2e/fumee.spec.ts:196:5 › fumée : créer, soumettre, valider, publier, acheter, scanner, piloter (11.5s)
[e2e] index des captures : .e2e-captures/captures/index.txt (172 entrée(s), 0 en échec)
  1 passed (12.2s)
[e2e] phase fumee : OK en 13s
[e2e] résumé : connexion OK · captures OK · fumee OK
```

Dans la fumée, « SMS du client depuis l'étape 8 : 5 » compte tous les SMS reçus par ce numéro pendant les étapes 8 à 10 ; l'assertion porte sur les trois textes attendus (J-1 une fois, H-3 jamais, annulation une fois). Les deux autres SMS ne sont pas identifiés par la fumée (non vérifié : sans doute d'autres lignes dues du seed, envoyées par le même passage de l'envoyeur).

**Échecs des runs intermédiaires** (extraits bruts de `e2e.log`) :

```text
run 64 — captures, 27 échecs, tous anonymes :
    Error: contrôles bloquants de accueil__mobile__clair.png
    +   "requête en échec : GET localhost:3000/login?redirect=%2Ftickets : net::ERR_ABORTED",
    +   "requête en échec : GET localhost:3000/login?redirect=%2Forders : net::ERR_ABORTED",
    +   "requête en échec : GET localhost:3000/login?redirect=%2Fwallet : net::ERR_ABORTED",
run 65 — preferences-push-active, 4 vues :
    Error: response.text: Test timeout of 120000ms exceeded.
    > 175 |             expect(res.status(), `inscription de l’appareil par POST /api/push/subscriptions : ${await res.text()}`).toBe(200);
run 66 — notifications-erreur, mobile sombre :
    Error: expect(locator).toBeVisible() failed
      - Expect "toBeVisible" getByRole('button', { name: /réessayer/i }) with timeout 15000ms
run 66 — fumée, étape 7 :
    Error: locator.check: Element is outside of the viewport
        - locator resolved to <input required="" type="radio" value="WAVE" class="peer sr-only" name=":r0:-operator"/>
```

| Run | Commit | verify | e2e | Rôle |
|---|---|---|---|---|
| [58 · 41462398301](https://github.com/fallouu-mn/event-village/actions/runs/41462398301) | 223d3fd | 125/125 | succès (7, 120 captures, fumée) | point de départ du lot (CI déclenchée aussi sur `lot*/**`) |
| [59 · 41501727946](https://github.com/fallouu-mn/event-village/actions/runs/41501727946) | f6b4fd3 | 112/152 | sauté | inexploitable : `notif-pros` passait un billet à UTILISE sans scan, ce qui violait (g) et faisait échouer l'`after()` de 11 suites du lot 5 (`pilotage-*`, `temps-reel-*`, `partenaire-liste`) ; 40 en échec = 27 + r3 + design-systeme + 11 |
| [60 · 41504058977](https://github.com/fallouu-mn/event-village/actions/runs/41504058977) | be40f1b | 123/152 | sauté | **référence « avant »** : tests rouges du lot, aucun correctif ; 29 en échec, exactement les 27 nouvelles suites plus `r3-fonctions-rpc` et `design-systeme` |
| [61 · 41717024008](https://github.com/fallouu-mn/event-village/actions/runs/41717024008) | 539b908 | 143/152 | sauté | correctifs serveur 6.0 à 6.10 ; restaient les écrans, `anonymisation-debogage` (route `test-push`), trois défauts de tests du lot (`761b94f`, `98ed24d`, `edd4fc6`) |
| [62 · 41720943878](https://github.com/fallouu-mn/event-village/actions/runs/41720943878) | cd8e109 | — | — | annulé par le push suivant |
| [63 · 41720987979](https://github.com/fallouu-mn/event-village/actions/runs/41720987979) | fb0c3b0 | 148/152 | sauté | écrans ; restaient `partenaire-liste` et `pilotage-acces` (ScrollableTabs), `notif-interface` (motif `essai-push`), `notif-migration` (millisecondes) |
| [64 · 41723680530](https://github.com/fallouu-mn/event-village/actions/runs/41723680530) | ad639ce | 152/152 | échec | premier verify vert ; captures du lot 5 seulement : 27 sur 120 en échec, toutes anonymes (préchargements Next abandonnés, corrigé par `5401a0c`) ; fumée du lot 5 verte |
| [65 · 41731969550](https://github.com/fallouu-mn/event-village/actions/runs/41731969550) | 1ab1623 | 152/152 | échec | e2e du lot 6 : 168 captures sur 172 (`preferences-push-active` bloquée), fumée prolongée verte, seed (a) à (o) : 0 violation |
| [66 · 41738647820](https://github.com/fallouu-mn/event-village/actions/runs/41738647820) | 6279f2f | 152/152 | échec | 171 sur 172 (`notifications-erreur` mobile sombre) ; fumée arrêtée à l'étape 7 (radio Wave) |
| [67 · 41743807069](https://github.com/fallouu-mn/event-village/actions/runs/41743807069) | 3a246ad | 152/152 | **succès** | **référence « après »** : 152 suites, 1 728 sous-tests, aucun échec ni test ignoré ; 7 connexions, 172 captures, fumée complète |

---

## 7. Migration des envois existants (6.7) : tableau avant / après

Inventaire de la découverte (`git grep` de tous les envois SMS, email et notifications sur `fff03b1`, numéros O, B, T, E, F, C, P, A), point d'insertion après le lot et canaux relus dans `lib/notifications/catalog.ts` à `3a246ad`. La colonne « Prouvé » renvoie à l'inventaire de `notif-migration` (chaque type au registre, son point d'insertion en base nomme le type), vert au run 67.

| # | Avant : fichier, canal | Après : type | Canaux (catalogue) | Déclencheur | Prouvé |
|---|---|---|---|---|---|
| O1–O6 | routes OTP, SMS synchrone | `OTP_LOGIN`, `OTP_REGISTER`, `OTP_PASSWORD_RESET`, `OTP_WITHDRAWAL`, `OTP_AUTH_HOOK` | SMS synchrone, journalisé sans le code | routes OTP (`.sendOtp(` seulement) + `notification_sync_log` | K2 |
| O7 | `partner/team/invite/route.ts`, SMS avec code | `CONTROLLER_INVITE` | SMS synchrone, journalisé sans le code | route d'invitation (`.sendControllerInvite(` seulement) | K2 |
| B1–B3 | `notification.service.ts` après `payment_confirm` : in-app, SMS, email | `PURCHASE_CONFIRMED` | IN_APP, SMS (numéro payeur), EMAIL | `payment_confirm` | oui |
| B4 | in-app au partenaire à chaque vente | `NEW_ORDER` | IN_APP | `payment_confirm` | oui |
| B5 | **SMS à l'organisateur à chaque vente** | supprimé → `FIRST_TICKET_SOLD` (une fois) | IN_APP, PUSH, SMS, EMAIL | trigger `trg_tickets_first_sale` | oui |
| B6 | email à l'organisateur à chaque vente | supprimé (récapitulatif hors périmètre) | — | — | — |
| B7–B12 | catégorie épuisée, événement complet : in-app, SMS, email | `CATEGORY_SOLD_OUT`, `EVENT_SOLD_OUT` | IN_APP, PUSH, SMS, EMAIL | trigger `trg_ticket_categories_sold_out` | oui |
| B13 | in-app au scan | `TICKET_SCANNED` | IN_APP, PUSH | trigger `trg_tickets_scanned_notify` | oui |
| B14–B15 | **SMS et email au porteur à chaque scan** | supprimés (B13 + push) | — | — | — |
| B16 | `counter-sale/route.ts`, SMS synchrone | `COUNTER_RECEIPT` | SMS | `counter_sale` | oui |
| (gratuits) | `claim-free/route.ts` | `FREE_TICKETS_CONFIRMED` | IN_APP, SMS, EMAIL | `free_tickets_claim` | oui |
| T1 | `ticket-transfer.service.ts`, SMS ou email **avec jeton** | `TRANSFER_OFFERED` (sans jeton) | SMS, IN_APP, PUSH (plus d'email : numéro seulement) | `ticket_transfer_initiate` | oui |
| T2 | annulation d'un transfert, SMS ou email | `TRANSFER_CANCELLED` | SMS, IN_APP, PUSH | `ticket_transfer_cancel` | oui |
| T3–T6 | in-app + **SMS** à l'expéditeur et au destinataire après réclamation | `TRANSFER_CLAIMED_SENDER`, `TRANSFER_RECEIVED` | IN_APP, PUSH | `ticket_transfer_accept` | oui |
| (nouveau) | aucun envoi à l'expiration | `TRANSFER_EXPIRED` | IN_APP, PUSH | `ticket_transfers_expire` | oui |
| E1–E5 | `event_notify` (SQL), SMS et email au partenaire (`event-lifecycle.service.ts`), **SMS à chaque admin** (`notifySuperadmins`), in-app aux porteurs | `EVENT_VALIDATED`, `EVENT_REJECTED`, `EVENT_SUSPENDED`, `EVENT_REACTIVATED`, `EVENT_PUBLISHED_BY_ADMIN`, `EVENT_SUSPENDED_HOLDER`, `EVENT_REACTIVATED_HOLDER`, `ADMIN_EVENT_SUBMITTED`, `EVENT_CANCELLED` | partenaire : IN_APP, SMS, EMAIL, PUSH (publié par l'admin : IN_APP, PUSH) ; porteurs suspendu/réactivé : IN_APP, PUSH ; admins : IN_APP, PUSH, EMAIL (SMS supprimé) ; annulation : IN_APP, SMS, EMAIL, PUSH | trigger `trg_event_status_notify` sur `event_status_history` | oui |
| E6, F1–F7 | `event-cancellation.service.ts` (SMS, email, 2e in-app), `cashout.service.ts`, `lib/admin/alerts.ts` | `REFUND_REQUESTED`, `REFUND_PAID`, `WITHDRAWAL_PAID`, `WITHDRAWAL_REJECTED`, `WITHDRAWAL_UNCERTAIN`, `CANCEL_REFUNDS_DONE`, `CANCEL_REFUNDS_BLOCKED`, `ADMIN_REFUND_TO_RETRY`, `ADMIN_CASHOUT_UNCERTAIN`, `ADMIN_WITHDRAWAL_REJECTED` | demandé : IN_APP ; versé : IN_APP, SMS, EMAIL, PUSH ; retrait versé ou refusé : IN_APP, SMS, EMAIL, PUSH ; retrait incertain : IN_APP, SMS, PUSH ; annulation terminée ou bloquée : IN_APP, EMAIL, PUSH ; admins : IN_APP, PUSH, EMAIL (retrait refusé : IN_APP, EMAIL) | trigger `trg_cashouts_notify` (audit gardé en TypeScript) | oui |
| E7–E8 | `event_update` + `event_change_notifications` + cron | `EVENT_CHANGED` | IN_APP, PUSH, SMS (regroupé) | `event_update` | oui |
| F8 | `fin_alert_superadmins` | `ADMIN_FINANCE_DEBT` | IN_APP, EMAIL | `fin_alert_superadmins` | oui |
| F9 | `confirmation.service.ts`, paiement non billetterie | `PAYMENT_SUCCESS` | IN_APP | trigger `trg_payments_other_success` | oui |
| F10 | abonnement | `SUBSCRIPTION_ACTIVATED` | IN_APP | trigger `trg_partners_subscription` | oui |
| C1–C2 | `shift_close` in-app + SMS (TypeScript) | `SHIFT_DISCREPANCY`, `SHIFT_CLOSED_BY_OTHER` (nouveau) | écart : IN_APP, SMS, PUSH ; caisse fermée par un tiers : IN_APP, PUSH | `shift_close` | oui |
| C3, C5–C12 | routes d'équipe, SMS + in-app | `CONTROLLER_ASSIGNED`, `CONTROLLER_UNASSIGNED` | IN_APP, PUSH, SMS regroupé par requête | trigger `trg_event_controllers_notify` | oui |
| C4 | `controller/setup/route.ts` | `CONTROLLER_ACTIVATED` | IN_APP, SMS | RPC `notification_controller_activated` | oui |
| (nouveau) | — | `CONTROLLER_REMINDER`, `REMINDER_J1`, `REMINDER_H3` | contrôleur : IN_APP, PUSH, SMS ; J-1 : IN_APP, PUSH, SMS, EMAIL ; H-3 : IN_APP, PUSH, SMS | `notification_reminders_schedule` | oui |
| P1–P7 | `partner/register` (SMS **doublon de l'OTP**, email, in-app), **SMS à chaque admin**, `admin/partners/[id]/status` (SMS, email, in-app) | `PARTNER_REGISTERED_ACK`, `ADMIN_PARTNER_REGISTERED`, `PARTNER_VALIDATED`, `PARTNER_REJECTED`, `PARTNER_SUSPENDED`, `PARTNER_REACTIVATED` | accusé : IN_APP, EMAIL (SMS supprimé) ; admins : IN_APP, PUSH, EMAIL ; statut : IN_APP, SMS, EMAIL | trigger `trg_partners_notify` (RPC `partner_status_set`) | oui |
| P8 | `partner/activation`, SMS + in-app | `TRIAL_STARTED` | IN_APP, SMS | `activate_partner_trial` | oui |
| P9 | `admin/promotions/route.ts` | `PROMOTION_DECIDED` | IN_APP | trigger `trg_sponsored_promotions_notify` | oui |
| P10–P12 | `hall.service.ts` | `HALL_RESERVATION_REQUESTED`, `_CONFIRMED`, `_CANCELLED` | IN_APP | trigger `trg_hall_reservations_notify` | oui |
| A1 | `admin/communications`, SMS en boucle | envoi immédiat désactivé (brouillon) | — | — | — |
| A2 | `sms-guard.ts`, in-app SUPERADMIN | `ADMIN_SMS_CAP_GLOBAL`, `ADMIN_SMS_CAP_NON_OTP` | IN_APP | `notification_admin_alert` (appelée par TypeScript) | registre |
| (nouveau) | — | `PASSWORD_CHANGED` | IN_APP, SMS, EMAIL | trigger `on_auth_user_password_changed` sur `auth.users` | oui |
| (nouveau) | — | `PUSH_TEST`, `ADMIN_NOTIFICATION_FAILED`, `ADMIN_SMS_DAILY_THRESHOLD` | push ; IN_APP ; IN_APP, EMAIL | `notification_test_push_enqueue`, `notif_failed_alert`, `notification_daily_checks` | oui |

Code supprimé : `NotificationService` en entier (`lib/notifications/notification.service.ts`), `lib/payments/stock-notifications.ts`, `lib/events/event-change-notifications.ts`, `app/api/cron/event-change-notifications/route.ts`, `EmailTemplates` et `sendToMany` (`lib/email/email.service.ts`), six méthodes `send*` de `MTargetService` (`sendCounterReceipt`, `sendControllerActivationConfirmation`, `sendControllerRevocationNotice`, `sendControllerAllEventsRevokedNotice`, `sendControllerAccountDeletedNotice`, `sendControllerAssignmentsUpdatedNotice`). Restent `sendSms`, `sendOtp`, `sendControllerInvite` et l'alias `sendNotification` (exigé par `fondations-lot0`, aucun appelant applicatif). Dans les migrations `20261103*`, seule `notification_outbox_mark` écrit dans `public.notifications` (contrôle de `notif-migration`).

---

## 8. Avertissements des captures au run final (6.0 f)

Tableau brut de l'index du run 67 (valeurs par vue : mobile clair / mobile sombre / ordinateur clair / ordinateur sombre) :

```text
TABLEAU ÉCRAN × RÈGLE (avertissements ; valeurs par vue : m-c/m-s/o-c/o-s = mobile clair/sombre, ordinateur clair/sombre ; ? = contrôles non exécutés)
écran | cibles < 44 px | textes < 14 px bruts | dont admis | dont hors exemption | axe (règles, nœuds au plus)
accueil | 0/0/0/0 | 13/13/8/8 | 13/13/8/8 | 0/0/0/0 | aucune
admin-evenements | 0/0/0/0 | 10/10/5/5 | 10/10/5/5 | 0/0/0/0 | aucune
admin-evenements-en-attente | 0/0/0/0 | 10/10/5/5 | 10/10/5/5 | 0/0/0/0 | aucune
admin-evenements-erreur | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
admin-fiche-en-attente | 0/0/0/0 | 13/13/8/8 | 13/13/8/8 | 0/0/0/0 | aucune
admin-fiche-suspendu | 0/0/0/0 | 11/11/6/6 | 11/11/6/6 | 0/0/0/0 | aucune
admin-notifications | 0/0/0/0 | 26/26/21/21 | 26/26/21/21 | 0/0/0/0 | aucune
admin-notifications-detail | 0/0/0/0 | 9/9/4/4 | 9/9/4/4 | 0/0/0/0 | aucune
admin-notifications-erreur | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
catalogue | 0/0/0/0 | 15/15/10/10 | 15/15/10/10 | 0/0/0/0 | aucune
cloche-ouverte | 0/0/0/0 | 25/25/20/20 | 25/25/20/20 | 0/0/0/0 | aucune
connexion | 0/0/0/0 | 5/5/0/0 | 5/5/0/0 | 0/0/0/0 | aucune
controleur-scanner | 0/0/0/0 | 1/1/1/1 | 1/1/1/1 | 0/0/0/0 | aucune
evenement-annule | 0/0/0/0 | 11/11/6/6 | 8/8/3/3 | 3/3/3/3 | aucune
evenement-non-public | 0/0/0/0 | 5/5/0/0 | 5/5/0/0 | 0/0/0/0 | aucune
evenement-publie | 0/0/0/0 | 13/13/8/8 | 10/10/5/5 | 3/3/3/3 | aucune
evenement-suspendu | 0/0/0/0 | 11/11/6/6 | 8/8/3/3 | 3/3/3/3 | aucune
evenement-termine | 0/0/0/0 | 11/11/6/6 | 8/8/3/3 | 3/3/3/3 | aucune
hors-ligne | 0/0/0/0 | 15/15/10/10 | 15/15/10/10 | 0/0/0/0 | aucune
inscription | 0/0/0/0 | 5/5/0/0 | 5/5/0/0 | 0/0/0/0 | aucune
mes-billets | 0/0/0/0 | 8/8/3/3 | 8/8/3/3 | 0/0/0/0 | aucune
mes-billets-recus | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
mot-de-passe-oublie | 0/0/0/0 | 5/5/0/0 | 5/5/0/0 | 0/0/0/0 | aucune
notifications | 0/0/0/0 | 14/14/9/9 | 14/14/9/9 | 0/0/0/0 | aucune
notifications-erreur | 0/0/0/0 | 5/5/0/0 | 5/5/0/0 | 0/0/0/0 | aucune
notifications-vide | 0/0/0/0 | 5/5/0/0 | 5/5/0/0 | 0/0/0/0 | aucune
partenaire-creation | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
partenaire-edition | 0/0/1/1 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
partenaire-evenements | 0/0/0/0 | 13/13/8/8 | 13/13/8/8 | 0/0/0/0 | aucune
partenaire-evenements-annules | 0/0/0/0 | 7/7/2/2 | 7/7/2/2 | 0/0/0/0 | aucune
partenaire-evenements-erreur | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-annulation | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-apercu | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-caisse | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-cloture | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-entrees | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-equipe | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-erreur | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-remboursements | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-ventes | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
preferences-push-active | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
preferences-push-non-pris-en-charge | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
preferences-push-refuse | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
```

Totaux de `avertissements.tsv` (172 lignes) : cibles < 44 px **2** ; textes < 14 px **1 076** bruts, dont **1 028** admis et **48** hors exemption ; règles axe-core en échec **0** ; préchargements Next abandonnés (non bloquants) **289** ; captures en échec **0**.

Au départ du lot (run 58, 120 captures) : 24 cibles < 44 px (16 « Fermer la bulle » de la carte en 24 × 24, 8 champs « Affiche de l'événement ») et 710 textes < 14 px non classés.

**Ce qui reste, règle par règle :**

| Écran | Vues | Règle | Élément | Pourquoi il reste |
|---|---|---|---|---|
| `evenement-publie`, `evenement-annule`, `evenement-suspendu`, `evenement-termine` | les 4 vues de chacun (16) | textes < 14 px hors exemption, 3 par vue (48) | attribution de la carte : « Leaflet », « \| », « © contributeurs OpenStreetMap » (12 px, `div.leaflet-control-attribution`) | mention légale du fournisseur de tuiles, hors contenu ; ni bouton ni texte de contenu |
| `partenaire-edition` | ordinateur clair et sombre (2) | cible < 44 px | `input « Affiche de l’événement Remplacer l’image » 798×20` | **non justifié pendant le lot, et absent de la note de relecture**, qui disait « aucune cible de moins de 44 px » au run 65 (il y en avait déjà 2). Ma lecture : le champ fichier est masqué (sr-only) et a deux libellés ; la mesure retient le plus grand, le titre du champ (798 × 20 px). Le bouton visible « Remplacer l'image » a `min-h-11`, soit 44 px (`components/ui/ImageUpload.tsx:140`). Le titre ouvre aussi le sélecteur de fichier, d'où une zone cliquable de 20 px de haut. Ce n'est pas un bouton d'action principal ; le champ est sous la ligne de flottaison de la capture, je ne l'ai pas vu |

Tout le reste des textes < 14 px est admis : badges et légendes marqués `data-ev-caption`, `small`, `time` (dates de la cloche, compteurs). Aucun bouton d'action principal ni texte de contenu n'est sous 14 px ou 44 px.

---

## 9. Variables d'environnement après le lot 6

Référence : `lib/env.ts` à `3a246ad` (schéma Zod), plus les deux variables publiques de carte lues hors de ce fichier. Détail des rôles : `docs/deploiement-projet-neuf.md`, §5.

**Obligatoires** (le serveur refuse de démarrer sans elles) :
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `SAMIRPAY_API_URL`, `SAMIRPAY_API_KEY`, `SAMIRPAY_SECRET_KEY`, `MTARGET_USERNAME`, `MTARGET_PASSWORD`, `OTP_HASH_SECRET`, `TICKET_TOTP_MASTER_KEY`, `REGISSEUR_PIN_KEY`.

**Obligatoire en exploitation** (facultative au démarrage) : `CRON_SECRET`. Sans elle, toutes les routes `/api/cron/*` répondent 503 : aucune notification hors OTP, aucun rappel, aucune réconciliation de paiement. Sa valeur est recopiée dans le secret Vault `ev_cron_secret`, avec l'URL publique dans `ev_app_url` (ce ne sont pas des variables de l'application).

**Facultatives, nouvelles au lot 6 :**

| Variable | Défaut | Rôle |
|---|---|---|
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | aucune | push web ; les trois ou aucune. Sans elles (ou partielles, ou invalides), push SKIPPED `PUSH_NOT_CONFIGURED`, un seul avertissement, le reste fonctionne. La clé privée est un secret, refusée si elle reprend la valeur d'un secret dédié |
| `MTARGET_TIMEOUT_MS` | 15 000 | délai maximal d'un appel MTarget ; au-delà, SMS UNCERTAIN, jamais renvoyé |
| `PUSH_TIMEOUT_MS` | 10 000 | délai maximal d'un envoi vers un service push |
| `PUSH_SUBSCRIBE_PER_USER_HOUR` | 20 | inscriptions d'appareils par compte et par heure |
| `PUSH_TEST_PER_USER_HOUR` | 5 | notifications d'essai par compte et par heure |
| `PUSH_ENDPOINT_ALLOWED_ORIGINS` | liste intégrée | remplace la liste blanche des services push ; **à ne pas renseigner en production** (tests seulement) |

**Facultatives existantes :**
- intégrations : `MTARGET_API_URL`, `MTARGET_SERVICE_ID`, `MTARGET_SENDER`, `SAMIRPAY_TIMEOUT_MS` (15 000), `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`, `SUPPORT_EMAIL`, `SUPABASE_AUTH_HOOK_SECRET` ;
- `CLIENT_IP_SOURCE` (`x-forwarded-for`) ;
- quotas SMS : `SMS_OTP_PER_PHONE_15MIN` (3), `SMS_OTP_PER_PHONE_DAY` (10), `SMS_OTP_PER_IP_HOUR` (10), `SMS_OTP_PER_IP_DAY` (30), `SMS_PER_PHONE_DAY` (30), `SMS_GLOBAL_DAILY_CAP` (1 000), `SMS_PER_ACCOUNT_DAY` (30), `SMS_GLOBAL_OTP_RESERVED_PERCENT` (30) ;
- paiement : `PAYMENT_HOLD_MINUTES` (15), `CHECKOUT_PER_USER_15MIN` (10), `CHECKOUT_PER_USER_DAY` (50), `CLAIM_FREE_PER_USER_HOUR` (20), `STATUS_POLL_RECONCILE_SECONDS` (5), `PAYMENT_RECONCILE_MIN_AGE_MINUTES` (2), `PAYMENT_PENDING_MAX_AGE_MINUTES` (60), `PAYMENT_LATE_SUCCESS_WINDOW_HOURS` (48), `PAYMENT_RECONCILE_BATCH` (50) ;
- quotas du lot 4 : `SCAN_PER_SCANNER_10S` (30), `CASH_COLLECT_PER_SCANNER_MIN` (20), `LIVE_CODE_PER_USER_MIN` (60), `RESOLVE_PHONE_PER_IP_HOUR` (30), `VERIFY_OTP_PER_PHONE_15MIN` (10), `CONTROLLER_SETUP_PER_PHONE_HOUR` (10), `PARTNER_REGISTER_PER_IP_HOUR` (10), `INVITE_PER_PARTNER_HOUR` (20), `INVITE_PER_PHONE_DAY` (3), `REGISSEUR_PIN_PER_SHIFT_15MIN` (5) ;
- quotas du lot 5 : `WITHDRAWAL_REQUEST_PER_USER_HOUR` (10), `COUNTER_RECEIPT_PER_SHIFT_DAY` (500), `SCAN_INCIDENT_REPORT_PER_SCANNER_MIN` (10), `SCAN_INCIDENT_LOG_PER_SCANNER_MIN` (60) ;
- `DOCUMENT_UPLOADS_PER_IP_HOUR` (20) ;
- `SUPERADMIN_PHONE` : déclarée dans `lib/env.ts`, lue nulle part ;
- `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` : lues par la carte, absentes de `lib/env.ts` (OpenStreetMap par défaut) ;
- `NODE_ENV` (posée par l'hébergeur) ; `EV_INTEGRATIONS` : **ne pas définir** (`fake` est refusé en production).

---

## 10. Estimation du nombre de SMS par billet vendu (réglages par défaut)

Réglages par défaut (migration `…03`) : J-1 à 10 h, SMS `ALWAYS` ; H-3, SMS `IF_NO_PUSH` ; plage de silence de 22 h à 8 h (heure de Dakar) pour les SMS optionnels. Le J-1 à 10 h n'est jamais dans la plage. Le H-3 y tombe pour un événement qui commence entre 1 h et 10 h 59 : son SMS est alors SKIPPED `QUIET_HOURS`, sans report.

| Message | SMS | Condition | Prouvé par un test |
|---|---|---|---|
| Confirmation d'achat (`PURCHASE_CONFIRMED`) | 1 par **commande**, au numéro payeur | toujours (indispensable) | texte et envoi : `finance-affichage`, `email-optionnel`, fumée (commandes d'un billet). « Une commande de N billets = 1 SMS » tient à la clé `PURCHASE_CONFIRMED:<payment_id>:SMS` (migration `…05`, `payment_confirm`) et à l'unicité de la clé (`notif-outbox`) ; **aucun test n'achète plusieurs billets en comptant les SMS d'achat** |
| Rappel J-1 (`REMINDER_J1`) | 1 par **compte porteur** et par événement | porteur d'au moins un billet VALIDE ; SMS optionnel (désactivable dans les préférences) | `notif-rappels` : « 5 billets d'un compte → une ligne par canal […] un seul SMS au texte exact » ; fumée : J-1 SMS SENT une fois |
| Rappel H-3 (`REMINDER_H3`) | 1 par compte porteur **sans push remis**, 0 avec push | porteur d'au moins un billet VALIDE (pas après l'entrée) ; hors plage de silence | `notif-rappels` : « push accepté → SMS SKIPPED PUSH_DELIVERED ; sans appareil → SMS envoyé au texte exact » ; « billets UTILISE : pas de H-3 » ; plage de silence prouvée sur le J-1 réglé à 7 h |

« Push remis » veut dire : le service push d'au moins un appareil du compte a accepté le message (ligne PUSH SENT). Un porteur qui n'a jamais activé le push reçoit le SMS du H-3 ; la part de clients qui activeront le push n'est pas connue (hypothèse à fixer pour chiffrer). Le SMS attend au plus 15 minutes l'issue de la ligne PUSH ; dans le doute, il part.

Pour une commande de `n` billets gardés par l'acheteur : `(1 + 1 + h) / n` SMS par billet, avec `h = 1` sans push remis, `0` avec.

| Cas | SMS par commande | SMS par billet |
|---|---|---|
| 1 billet, sans push | 3 | 3 |
| 1 billet, avec push | 2 | 2 |
| 4 billets gardés, sans push | 3 | 0,75 |
| 4 billets gardés, avec push | 2 | 0,5 |
| 4 billets, dont 3 transférés à 3 personnes sans push (1 SMS d'offre par transfert, J-1 et H-3 pour chaque porteur) | 1 + 3 + 4 + 4 = 12 | 3 |
| billet vendu au guichet | 1 reçu si un numéro est saisi, aucun rappel (billet sans porteur) | 0 ou 1 |

**Taille d'un SMS.** `notif-modeles` prouve que chaque SMS du catalogue tient en un segment GSM-7 (160 caractères au plus) avec les valeurs maximales réalistes du contrat et une URL de 27 caractères. Mesure complémentaire, faite par moi en rendant le catalogue (aucun test ne la fige) : avec un titre et un lieu de plus de 60 caractères, des frais de 99 999 F et un total de 1 250 000 F, les 31 types à SMS tiennent en un segment tant que `NEXT_PUBLIC_APP_URL` fait au plus 28 caractères (`https://` compris). À 29 caractères, `TRANSFER_OFFERED` passe à 161 ; à 30, `PURCHASE_CONFIRMED` aussi. Exemple réel, URL de 23 caractères : achat 154, J-1 148, H-3 150, annulation 150 caractères. Une variable non translittérable vers GSM-7 (autre écriture) donne un SMS UCS-2 de 3 segments au plus. La facturation par segment de MTarget reste à confirmer (section 12).

**SMS occasionnels, hors vente :** annulation d'un événement (1 par porteur), remboursement versé (1), changement de date ou de lieu (1 par porteur, regroupé), offre de transfert (1), changement de mot de passe (1, sécurité du compte) ; côté professionnels : premier billet vendu (1 par événement), catégorie épuisée (1 par catégorie), événement complet (1), écart de caisse (1), retrait versé, refusé ou incertain (1), statut du partenaire (1), affectation d'un contrôleur (1 regroupé par requête), rappel du contrôleur (1 par affectation) ; plus les codes OTP (connexion, inscription, retrait).

**Plafond.** `SMS_GLOBAL_DAILY_CAP` = 1 000 par jour, dont 30 % réservés à l'OTP : 700 SMS hors OTP par jour. Au-delà, SKIPPED `SMS_DAILY_CAP`, sans relance (prouvé par `notif-envoyeur`). Un J-1 de plus de 700 porteurs le même jour serait donc en partie non envoyé par SMS (l'in-app et le push partent). L'alerte `notif.sms_daily_alert` (2 000) ne peut pas se déclencher tant que le plafond n'est pas relevé au-dessus de 2 000.

---

## 11. Décisions prises

**Décisions de l'utilisateur (02/11/2026) :**
1. Transfert par lien sans jeton vers « Mes billets » : le SMS ne porte plus de secret ; le destinataire se connecte avec le numéro visé, vérifié par OTP, et accepte le billet dans l'onglet « Reçus ». L'API de réclamation du lot 4 change (« À lire en premier », point 3).
2. Transfert vers un numéro seulement : l'email n'est jamais vérifié ; une cible email est refusée (400 `RECIPIENT_PHONE_REQUIRED`) ; un ancien transfert PENDING vers un email n'est pas réclamable et expire normalement.
3. Invitation d'un nouveau contrôleur traitée comme l'OTP : envoi synchrone par la route, journalisé dans la boîte d'envoi sans le code ; le contrôle statique l'autorise nommément.
4. Service worker remplacé par une version minimale sans cache ni `fetch` (push, clic, renouvellement d'abonnement), qui supprime les anciens caches `event-village-*` ; le hors ligne du billet revient au lot 7.
5. Plafond SMS gardé à 1 000 par jour et alerte à 2 000 : un SMS refusé par le plafond est SKIPPED avec motif ; l'alerte ne peut pas se déclencher tant que le plafond n'est pas relevé.
6. Envoi immédiat des campagnes admin désactivé, brouillons conservés (marketing hors périmètre, aucun désabonnement disponible, coût).
7. Avance rapide de `main` à la fin du lot, contraire à la consigne écrite (« À lire en premier », point 1).

**Décisions du contrat** (liste V, amendée par l'orchestrateur ; une ligne chacune) :
1. Statut `UNCERTAIN` ajouté à la boîte d'envoi : jamais renvoyé, jamais « Relancer » (6.1 et 6.8 le supposent).
2. Une ligne SMS restée SENDING plus de 10 min passe UNCERTAIN (`SENDING_INTERRUPTED`) au lieu d'être renvoyée ; les autres canaux sont repris (ré-essai sans risque de double facturation).
3. « 5 tentatives » = 5 envois ; attentes de 1, 5, 15 et 60 min entre eux ; 240 min = plafond d'un `Retry-After` du fournisseur.
4. L'IN_APP passe par l'envoyeur (au plus 1 min) : un seul catalogue de textes, au prix des adaptations de tests de la section 1.
5. `notifications.channel` devient un texte contraint à `IN_APP` ; `PUSH` ne désigne plus que le push web (fin de la collision de nommage du lot 5).
6. Registre SQL des types et catalogue TypeScript des textes, égalité imposée par un test (la transaction SQL doit savoir quelles lignes créer).
7. Horloge injectable seulement sur les RPC et fonctions d'envoi et de planification, refusée dans le passé ; les routes n'acceptent aucune heure (risque de double envoi).
8. Instantané de décision sur chaque ligne (préférence, statut de l'événement, porteur, plage de silence) : seule preuve possible de (m) et (n), faute d'historique en base.
9. Refus du plafond SMS → SKIPPED avec motif, pour tous les SMS, sans relance (décision de l'utilisateur appliquée aussi aux SMS indispensables, dont l'in-app part quand même).
10. Le SMS d'achat va au numéro payeur (comportement existant), l'in-app au compte.
11. SMS à l'organisateur à chaque vente supprimé, remplacé par « premier billet vendu » (SMS une fois) et une in-app par commande ; email par vente supprimé (coût).
12. SMS et email au porteur à chaque scan supprimés, remplacés par in-app et push (coût, aucune valeur au moment de l'entrée).
13. SMS à chaque admin (événement soumis, candidature) supprimés : in-app, push, email ; destinataires par `user_roles` et permissions, comptes ACTIF.
14. SMS « inscription reçue » supprimé : doublon de l'OTP d'inscription ; in-app et email restent.
15. SMS à l'expéditeur et au destinataire après réclamation d'un transfert supprimés : in-app et push.
16. Transfert expiré : in-app et push à l'expéditeur (point ouvert 8 du lot 5).
17. Premier billet vendu : billets en ligne et au guichet seulement (gratuits et invitations exclus).
18. Catégorie épuisée : clé avec le quota, pour prévenir à nouveau après une hausse ; « événement complet » conservé.
19. Remboursements d'annulation « terminés » : cashouts de la plateforme seulement (espèces de l'organisateur exclues) ; « bloqués » : un avis par événement et par jour.
20. Affectations : une in-app et un push par affectation, un SMS regroupé par requête (clé `txid`), pas de SMS d'affectation juste après une invitation.
21. Rappel du contrôleur : la veille du début à 18 h, point d'entrée et permission espèces lus à la planification, événement PUBLIE.
22. J-1 et H-3 calculés sur le début seulement (événements sur plusieurs jours compris), sur billets VALIDE seulement.
23. Réactivation dans la tolérance après une suspension : le rappel annulé n'est pas recréé (pas de rattrapage).
24. Plage de silence : bornes de 0 à 23 ; début = fin signifie aucune plage ; seuil SMS de 1 à 1 000 000.
25. Réglage `notif.*` absent : la planification lève (cron 500, visible) ; l'envoyeur passe les seules lignes optionnelles en SKIPPED `SETTING_MISSING`, les indispensables partent.
26. `IF_NO_PUSH` : le SMS part si la ligne PUSH du même rappel n'est pas SENT ; il attend au plus 15 min une ligne PUSH en cours, mesurées sur l'horloge de l'envoyeur, jamais sur `created_at` (amendement 7) ; dans le doute, il part.
27. Push : une ligne par compte, SENT si un appareil accepte, pas d'état incertain ; `tag` = clé de groupe pour tous les types, `PUSH_TEST` compris (le test `notif-preferences` l'exige ; l'amendement 6, qui écrivait « tag `PUSH_TEST` », est corrigé dans ce sens).
28. Push sans VAPID : SKIPPED `PUSH_NOT_CONFIGURED` ; la page des préférences affiche un quatrième état « Indisponibles pour le moment ».
29. `web-push` 3.6.7 épinglé pour le chiffrement seulement, transport par `fetch` avec délai et liste blanche (anti-SSRF) ; clé publique servie par `GET /api/push/config`.
30. Endpoint push unique : réattribué au compte qui s'inscrit ; 10 appareils au plus par compte ; détachement à chaque déconnexion.
31. Service worker remplacé sans cache ni `fetch` (décision de l'utilisateur) ; plus de repli hors ligne jusqu'au lot 7.
32. Bouton d'essai : met en file une ligne PUSH (aucun envoi depuis la route), arrivée dans la minute ; texte « Notification d'essai » / « Les notifications fonctionnent sur cet appareil. », lien `/profile/notifications` (amendement 6).
33. Désabonnement d'email : lien vers la page des préférences (connexion demandée), sans jeton ; pas de désabonnement en un clic.
34. `users.phone_verified_at` posé par une vérification OTP réussie ; aucune reprise pour les comptes existants (un code SMS suffit pour l'obtenir).
35. Transfert vers un numéro seulement (décision de l'utilisateur ; remplace la décision d'origine, identité par l'email du compte).
36. Transfert absent ou adressé à un autre compte : même réponse 404 (aucune fuite d'existence).
37. Ancienne route de réclamation : 410 sans lecture de la base, POST derrière `requireActiveSession` (exigé par `statut-compte`) ; message mot pour mot : « Ce lien n'est plus utilisé. Connectez-vous avec le numéro auquel le billet a été envoyé, puis ouvrez « Mes billets ». » (amendement 5) ; la page redirige vers « Mes billets ».
38. `claim_token_hash` devient facultatif (anciens hachés conservés, inutilisés) ; le test d'entrée invalide utilise un destinataire vide.
39. Invitation d'un compte existant comme contrôleur : plus de SMS direct, affectation par la boîte d'envoi.
40. Texte de l'invitation d'un nouveau contrôleur inchangé (2 segments), seule exception de longueur.
41. Avis de suspension d'un compte partenaire envoyé malgré la suspension (politique ALLOW), comme les messages liés à l'argent (achat, remboursements, retraits, caisse, remboursements d'annulation) : message de sécurité du compte, famille INDISPENSABLE (amendement 4).
42. Changement de mot de passe notifié (sécurité du compte) par un trigger sur `auth.users` ; le texte couvre aussi le premier mot de passe d'un contrôleur.
43. Campagnes admin : envoi immédiat désactivé, brouillon enregistré (confirmé par l'utilisateur, amendement 3).
44. Suspension d'un partenaire par une RPC qui synchronise `partners.status` et `users.status` et révoque les sessions dans la même transaction.
45. RLS des tables publiées : prédicat en ligne « compte ni SUSPENDU ni SUPPRIME » (amendement 1 : un partenaire inscrit est EN_ATTENTE et doit garder ses lectures), sans nouvelle aide RLS ni durcissement de `is_partner_owner`.
46. Réception après réactivation prouvée sur une nouvelle connexion ; le comportement du canal ouvert avant la suspension est journalisé.
47. `hall_reservations` et `table_reservations` retirées de la publication (aucun abonné) ; `orders` gardée et testée.
48. Un brouillon déjà soumis n'est plus supprimable (son historique est conservé) ; TRUNCATE de `events` refusé.
49. `events_admin_manage` supprimée et écritures REST révoquées sur `events` (R17 reste vert, avec une erreur 42501).
50. Réinitialisation du mot de passe, `OtpInput` et `PasswordStrengthChecklist` migrés avec la connexion (parcours cohérent).
51. `ScrollableTabs` déplacé dans `components/ui` ; attribution Leaflet laissée à 12 px (mention légale).
52. Page admin Notifications rafraîchie par `admin_signals` (la boîte d'envoi n'est jamais publiée) ; abonnements existants filtrés par `kind`.
53. Destinataires admin par permission : événement soumis (`events.read`), candidature (`partners.read`), cashouts (`refunds.manage`), créance (`payments.read`), notifications et SMS (`notifications.read`) ; le SUPERADMIN reçoit tout.
54. Relance : défense en profondeur, la RPC vérifie aussi la permission ; remise à zéro des tentatives, compteur `manual_retries`, audit.
55. Extensions pg_cron et pg_net créées par le script d'exploitation, pas par une migration ; secrets Vault créés par l'opérateur ; le script d'arrêt les laisse.
56. Fréquences : envoyeur chaque minute, rappels toutes les 5 min (décalés d'une minute), tâches horaires décalées ; purge de `cron.job_run_details` ajoutée.
57. `assertNotificationInvariants` pour les suites du lot 6 et le seed de démonstration seulement ; pas dans `tests/security` (clé anon seule).
58. Fumée : horloge simulée, adaptateurs réels vers les faux services ; événement E2 à J+2. En CI, l'import des modules dans Playwright échoue et la fumée passe par le repli `scripts/e2e/clock-run.ts` (prévu au contrat, annoncé dans le journal).
59. Les montants en SMS ont une espace simple ; l'in-app, le push et l'email gardent l'espace insécable U+00A0.
60. Variables saisies des SMS translittérées vers GSM-7 et tronquées ; caractère non translittérable : SMS UCS-2 de 3 segments au plus.
61. Détail de la règle (n5) : `COALESCE` sur les bornes de la plage de silence, sans quoi le détail d'une violation valait NULL (amendement 8).
62. Liste blanche du système de design : l'ancienne entrée `ScrollableTabs` retirée en phase rouge ; le garde-fou « fichier hors liste » est resté rouge jusqu'au déplacement, pour la bonne raison (amendement 9).

**Décisions des correcteurs serveur** (rapports des agents, relus) :
- *Dette (6.0)* : le trigger est seul juge de la suppression, avec son message (plus de contrôle TypeScript, pour éviter deux messages divergents) ; un refus de clé étrangère (23503) devient 409 `EVENT_NOT_DELETABLE` avec un message français ; 404 `EVENT_NOT_FOUND` couvre l'événement d'un autre partenaire et la suppression concurrente (aucune fuite d'existence) ; `ticket_categories_read_public` garde ses rôles (PUBLIC), donc le prédicat sur `users` est aussi évalué pour anon (risque en section 12).
- *Boîte d'envoi (6.1)* :
  - envoyeur sans horloge en exploitation : la réservation et le marquage prennent l'heure de la base (évite un refus `INVALID_NOW` sur un lot long). Contrepartie : un SMS réservé juste avant 22 h et marqué juste après aurait un `sent_at` dans la plage de silence ;
  - avec une horloge simulée, l'envoyeur passe aussi son heure au contrôle du jour ;
  - la reprise des SENDING respecte les filtres `only_ids` et `only_event_ids` (isolation des suites) ;
  - un SMS repris en UNCERTAIN reçoit `sent_at = claimed_at` ; une exception pendant `sendSms` donne UNCERTAIN `PROVIDER_UNREADABLE`, jamais un second envoi ;
  - un résultat d'adaptateur sans `outcome` est traité comme un refus temporaire ;
  - journal synchrone : `attempts = 0` et pas de `sent_at` pour SKIPPED, pas de `sent_at` pour FAILED ; un refus de la garde avant `storeOtp` n'est pas journalisé (aucune référence `otp_codes`) ;
  - hook appelé par Bearer sans `webhook-id` : référence propre à l'appel ;
  - `notif_enqueue` : `ON CONFLICT DO NOTHING`, erreur `NT004` si la clé ou le destinataire manque ; une ligne FAILED garde sa clé et son destinataire figés ;
  - registre des types en lecture seule, même pour le service_role ;
  - marquage SKIPPED sans motif → FAILED `TEMPLATE_ERROR` ; ligne PENDING aux tentatives épuisées → FAILED avec alerte à la réservation ;
  - données de rendu complétées par les champs de l'événement relus à la réservation, sans écraser `template_data` ;
  - push : un point d'arrivée hors liste blanche n'est ni appelé ni supprimé ; `failure_count` augmente sur refus et revient à 0 sur un succès ;
  - `List-Unsubscribe` posé par l'envoyeur ; l'avertissement « réglage `notif.sms_daily_alert` absent » est émis une fois par processus ; la réservation renvoie en plus `examined`, `failed`, `max_attempts`, `due_at`.
- *Canaux et modèles (6.2, 6.3)* : routes push ouvertes aux comptes ACTIF et EN_ATTENTE, `DELETE` à toute session et sans VAPID (un compte suspendu doit pouvoir détacher son appareil) ; `enablePush` demande l'autorisation d'abord, dans le geste (exigence de Safari) ; `syncPushSubscription()` rattache l'abonnement à l'ouverture et réabonne sans fenêtre si la paire VAPID a changé ; abonnement hors liste blanche ignoré, pas supprimé ; au-delà de 10 appareils, le plus ancien est supprimé ; `@types/web-push` 3.6.4 ajouté en plus de `web-push` (exigé par le contrat F4 et les tests) ; noms des variables fixés là où le contrat se taisait (`account_kind`, `closed_by`, `cashout_status`, `blocked_reason`, `hall_name`, `failed_type`, `cap`, `limit`, `new_city`, `events`) ; texte de créance réécrit sans codes techniques ; dates des SMS à l'heure de Dakar, `smsVar` compte en septets ; un `label` par modèle pour la supervision.
- *Planification (6.9)* : message de refus renvoyant à la doc au lieu de citer `vault.create_secret` (le test interdit que le script crée les secrets) ; contrôles des secrets avant les extensions ; `ev_app_url` limité à une origine HTTPS sans chemin (HTTP seulement pour localhost, 127.0.0.1, `*.invalid`, `*.test`), parce que le secret part dans un en-tête ; `ev_cron_secret` refusé vide ou avec espace ; barre oblique finale retirée ; purge sur `COALESCE(end_time, start_time)` (exécutions jamais terminées comprises) ; tâches désactivées à la main réactivées ; `starts_with(jobname, 'ev_')` ; arrêt sans pg_cron : NOTICE, aucune erreur ; doc : `SUPABASE_AUTH_HOOK_SECRET`, `MTARGET_SENDER` et `MTARGET_SERVICE_ID` en facultatives, `SUPERADMIN_PHONE` signalée inutile ; précautions ajoutées (ne pas enregistrer la requête qui crée les secrets, ne jamais exposer le schéma `net`, un seul planificateur à la fois).
- *Rappels (6.5)* : `fin_setting_valid` passe `SECURITY DEFINER` (règle « toute fonction recréée », sans effet) ; la planification lit ses 6 clés d'emblée et lève en nommant la clé absente ; annulation pour l'ancien porteur par un trigger `AFTER UPDATE OF user_id ON tickets`, dans la transaction de la réclamation quel que soit l'appelant ; `created` compte des lignes ; rappel du contrôleur indépendant des interrupteurs J-1 et H-3 ; point d'entrée vide → « à préciser » ; seuls les événements qui commencent au plus le lendemain sont examinés ; annulation par trigger horodatée `now()`, `EVENT_CHANGED` jamais annulé par un changement de date ; un `now` illisible → `INVALID_NOW`.
- *Billetterie (6.7)* : cible contenant « @ » refusée à la route, au service et à la RPC ; in-app et push de l'offre au seul compte dont le numéro vérifié est la cible, sinon SMS seul ; annulation d'un ancien transfert vers un email : aucun canal, `recipient_notification: 'NONE'` ; `ticket_transfer_accept` annule aussi les rappels de l'ancien porteur (redondant avec le trigger, sans effet de bord) ; acceptation sans `rpcWithRetry` (un rejeu après commit renverrait à tort `TRANSFER_NOT_PENDING`) ; `NEW_ORDER.total` = montant facial, `PURCHASE_CONFIRMED.total` = montant payé ; `EVENT_CANCELLED` porte un `refund_mode` par porteur (`AUTO`, `ORGANIZER`, `NONE`) ; SMS de changement regroupés par fusion de la ligne PENDING, `notify_version` à chaque changement notifié ; reprise de la file du lot 5 (instantané `MIGRATION`, tentatives plafonnées à 5, `finished_at = updated_at`) ; guichet : un état du reçu illisible n'annule jamais la vente (`receipt_refusal: 'RECEIPT_STATE_UNKNOWN'`) ; clé de `free_tickets_claim` par le plus petit identifiant en ordre d'uuid (indépendant de la collation).
- *Professionnels (6.6)* : `activate_partner_trial` corrigée (valeur ACTIF retirée, compte remis ACTIF seulement s'il était EN_ATTENTE, `FOR UPDATE`, statut réel dans la réponse) ; `partner_status_set` (EN_ATTENTE refusé, statut identique → 409, `users.status` écrit avant la fiche, REJETE remet le compte ACTIF comme l'ancienne route, `users.role` n'est plus écrit) ; `fin_alert_superadmins` sur un autre objet que `finance_debts` : audit et WARNING, aucun avis ; `CANCEL_REFUNDS_DONE` sous verrou consultatif par événement ; `CANCEL_REFUNDS_BLOCKED` au jour de Dakar ; alerte d'un remboursement bloqué relancée seulement si le motif apparaît ; activation d'un contrôleur : échec de mise en file signalé dans la réponse (`activation_notice: 'FAILED'`), pas un 500 ; motif d'annulation d'une salle journalisé (pas de colonne) ; clé de `PASSWORD_CHANGED` = `auth.users.updated_at` en microsecondes.
- *Cloche et admin (6.4, 6.8, 6.10)* : filtre de catégorie sur les seuls types déclarés (inconnu = « Information », visible sous « Toutes » et « Non lues ») ; pagination bornée (100), 400 `INVALID_QUERY` et `INVALID_CATEGORY` ; marquer une notification d'un autre compte ou inconnue → 404, déjà lue → 200 ; ancien canal d'une ligne SMS, EMAIL ou WHATSAPP gardé dans `metadata.legacy_channel` ; compteurs par statut sous les autres filtres (pour les onglets) ; destinataire masqué (numéro, email ou « Prénom I. ») ; détail sans adresse technique `<chiffres>@eventvillage.sn`, aperçu rendu par le catalogue, « contenu non conservé » pour un journal synchrone ; filtre `q` (uuid exact, numéro exact, sinon recherche échappée dans l'email et le titre) ; statistiques au jour de Dakar, PENDING et SENDING exclus ; relance : journal synchrone FAILED non relançable (un code n'est jamais renvoyé), collision avec un SMS de changement plus récent non relançable ; bouton d'essai : quota compté avant le contrôle de l'appareil, 409 `PUSH_NOT_CONFIGURED` ou `NO_PUSH_SUBSCRIPTION` ; `PUT` d'un non-partenaire sur `PRO_ACTIVITY` → 400 ; routes admin réservées aux comptes ACTIF.
- *Nettoyage (6.7)* : `sendToMany` supprimée avec `EmailTemplates` (code mort) ; dans `ticket-pdf-and-exports`, la mise en place est portée plutôt que de supprimer le TEST 6 ; seuls les cas legacy qui ne compilent plus, ou qui dépendent d'un cas supprimé, sont supprimés, chacun avec sa couverture ou « non couvert » ; le cas 4 de `notifications-and-documents` lit le registre et le trigger en base au lieu du texte d'une migration.

**Décisions des écrans** :
- *Connexion et dette* : pas de `required` natif sur le mot de passe (le nom accessible deviendrait « Mot de passe (obligatoire) » et casserait `e2e/auth.setup.ts`), formulaires en `noValidate` avec messages dans un `StatusBanner` ; chaque `catch {}` des pages d'authentification journalise un `console.warn` avec son motif ; « Si un compte correspond à cette adresse, un lien… » (le texte précédent sous-entendait que le compte existait) ; détachement du push avant la révocation globale des sessions à la réinitialisation ; `Skeleton` avec un filet, sinon invisible sur le fond de page ; `.ev-skel` et `evShimmer` supprimés (code mort aux couleurs en dur) ; premier champ d'`OtpInput` à 6 caractères pour le remplissage automatique ; `?reset=success` et `?error=session_expired` laissés non affichés (hors contrat, section 12).
- *Notifications* : « SMS ce mois-ci » affichait d'abord les seuls envoyés ; la relecture du run 65 l'a aligné sur « SMS aujourd'hui » (envoyés + incertains, `288dc5e`), d'abord par une addition faite dans le navigateur, contraire à la règle « le serveur est la seule source des chiffres » ; relevé à la rédaction de ce rapport et corrigé par `43ff9ec` : `admin_notifications_stats` renvoie `sms_month.total`, affiché tel quel ; compteurs « par canal sur la période » en tableau jour × canal, valeurs du serveur, sans cartes de totaux (le serveur n'en fournit pas) ; « Relancer » seulement pour une ligne FAILED relançable et un admin `notifications.write` (le serveur revérifie, un 403 masque le bouton) ; 7 onglets de catégorie toujours affichés, filtrés par le serveur ; `?topic=` lu par `window.location` sans `Suspense` ; un champ « Code reçu par SMS » pour confirmer le numéro ; partage WhatsApp retiré après un transfert, remplacé par « Prévenir mon proche » (lien vers `/tickets?tab=recus`, sans jeton) ; plus aucune clé brute ni code technique (`reason_detail`) affichés à l'admin.

**Décisions de l'e2e** : faux push à trois modes (activé, refusé, non pris en charge) ; faux service push qui vérifie le chiffrement aes128gcm, le TTL et le JWT VAPID et déchiffre selon la RFC 8291, réponses forcées (201, 404, 410, 413, 429, 500) ; clés VAPID générées par run ; préchargement abandonné non bloquant seulement avec preuve (section 1) ; fumée sans modifier aucun réglage (elle échoue si le J-1 tombe dans la plage de silence) ; assertions exactes : J-1 du client = EMAIL SKIPPED `EMAIL_NOT_CONFIGURED`, IN_APP SENT, PUSH SKIPPED (`NO_PUSH_SUBSCRIPTION` avec VAPID), SMS SENT ; H-3 CANCELLED `EVENT_ANNULE` ; annulation : une ligne SMS et une IN_APP SENT.

---

## 12. Points ouverts

1. **Mise en production** (aucun hébergeur choisi) :
   - lancer `supabase/ops/schedule-crons.sql` une fois, après avoir créé les secrets Vault `ev_app_url` et `ev_cron_secret` (procédure en §7 de `docs/deploiement-projet-neuf.md`) ; sans cela, aucune notification ne part hors OTP ;
   - saisir chez l'hébergeur `CRON_SECRET`, les clés VAPID (si le push est voulu) et, si besoin, `MTARGET_TIMEOUT_MS` ;
   - projet de production `event-village-prod` : les clés anon et service_role ont été collées dans une conversation le 02/11 ; faire tourner le secret JWT à l'hébergement et saisir les nouvelles clés directement chez l'hébergeur ; changer aussi `SUPABASE_AUTH_HOOK_SECRET` (publié dans l'historique, lot 1A) ;
   - appliquer les migrations `20261103000001` à `…08` après celles des lots précédents ;
   - attribuer `notifications.read` et `notifications.write` aux admins concernés.
2. **SMS et coûts :**
   - plafond de 1 000 par jour (700 hors OTP) : un J-1 de plus de 700 porteurs le même jour est en partie SKIPPED `SMS_DAILY_CAP` ; l'alerte à 2 000 ne peut pas se déclencher ; à relever par le client avant l'ouverture ;
   - MTarget : encodage et facturation par segment à confirmer dans la documentation du fournisseur ; procédure de vérification manuelle d'un SMS UNCERTAIN à écrire ;
   - longueur de `NEXT_PUBLIC_APP_URL` : au-delà de 28 caractères, des SMS passent à 2 segments (section 10, mesure non figée par un test) ;
   - `sms-anti-abus` peut passer sur une ligne qu'il n'a pas créée : `notif-admins` crée la ligne `ADMIN_SMS_CAP_GLOBAL` du jour réel ; quand `sms-anti-abus` atteint le vrai plafond, la clé existe déjà et rien n'est recréé, et sa lecture accepte toute notification de moins de 10 minutes. Au run 67, 44 suites et 128 s séparent les deux. Risque signalé par le correcteur, non traité ; à reprendre en faisant porter le cas de `notif-admins` sur un jour futur.
3. **Email et comptes :**
   - l'email n'est jamais vérifié : les transferts n'en dépendent plus (numéro seulement), mais un compte peut toujours s'inscrire avec l'email d'autrui ;
   - désabonnement en un clic (RFC 8058) : exige un jeton, non fait ;
   - aucun parcours de changement de numéro de téléphone (et donc pas de modèle « numéro modifié ») ;
   - suspension d'un compte client par `/api/admin/users` : aucun avis envoyé ;
   - partenaire REJETE après validation : `users.status` reste ACTIF et `is_partner_owner` vrai (lectures REST conservées) ;
   - le JWT d'un compte suspendu reste valable jusqu'à 1 h pour les tables non publiées dont la RLS ne lit pas le statut ; les routes le refusent (`requireActiveSession`).
4. **Sécurité et données :**
   - `verifyAdminAuth` (`lib/admin/admin-auth.ts`) ne refuse que SUSPENDU : un compte SUPPRIME passe. Les routes du lot 6 appellent d'abord `requireActiveSession`, pas toutes les routes admin ;
   - `lib/admin/admin.service.ts:417` supprime les permissions d'un compte par `.eq('admin_id', …)` ; la colonne de `admin_permissions` est `user_id` (migration `0007`) : les permissions d'un compte anonymisé ne sont pas supprimées ;
   - `event_cancel` (recopiée en migration `…05`) verrouille les catégories mais lit les porteurs sans verrouiller les billets : course possible entre une réclamation de transfert et l'annulation ; `ticket_transfer_claim` (lot 4, inchangée) ne vérifie pas le statut de l'événement ;
   - `app/api/admin/refunds/[id]/retry` et `app/api/admin/shifts/audit` ne demandent que `serverIsAdmin`, sans permission dédiée ; l'écran des comptes affiche les codes de permission bruts ;
   - le prédicat « compte ni suspendu ni supprimé » de `ticket_categories_read_public` est évalué aussi pour anon : il suppose que anon garde son privilège SELECT sur `public.users` (aucune migration ne le révoque aujourd'hui, vérifié par grep). S'il était révoqué, le catalogue public répondrait 42501.
5. **Push et application installable :**
   - manifest sans `id`, `scope` ni icône `maskable` (vérifié dans `public/manifest.json`) ; sur iPhone, le push ne fonctionne que pour l'application installée ;
   - rotation des clés VAPID : les abonnements de l'ancienne clé sont supprimés à l'envoi, réabonnement à la prochaine ouverture seulement ;
   - hors ligne du billet : lot 7 (le cache du service worker a été retiré).
6. **Interface :**
   - `components/tickets/TransferExplainerModal.tsx` : textes corrigés par `ace584b` (plus d'email ni de « lien privé »), mais toujours sur l'ancienne palette (`#FF5722`, `bg-slate-*`, `text-[10px]`, `text-[11px]`) et hors de la liste blanche du système de design ;
   - `app/partner/register/page.tsx` et `app/controller/setup/page.tsx` ne sont pas migrés, mais utilisent `OtpInput` et `PasswordStrengthChecklist`, migrés : rendu mixte à relire ; de même, le nouveau `Skeleton` change l'apparence de toutes les pages qui l'importent ;
   - `app/admin/communications`, `app/partner/profile`, `app/controller/profile` non migrés (liens vers les préférences ajoutés seulement) ;
   - `?reset=success` et `?error=session_expired`, posés par `app/reset-password/page.tsx:281` et `:97`, ne sont pas affichés par la page de connexion (`ERROR_MESSAGES` ne les connaît pas) ;
   - champs de date des filtres admin en « mm/dd/yyyy » dans le Chromium anglais de la CI (format du navigateur) ;
   - « Tout marquer comme lu » sur deux lignes à 390 px ; champ d'affiche de l'édition mesuré à 20 px de haut sur ordinateur (section 8) ;
   - `components/layout/AppLayoutHeader.tsx` est du code mort, mais c'est lui que vérifie `notifications-and-documents` (cas 3) pour l'intégration de la cloche, pas `AppLayout.tsx` qui la rend vraiment ; `notification_channel_enum` reste défini sans usage.
7. **Supervision admin :**
   - `admin_notifications_stats` ne renvoie pas de totaux par canal sur la période (le total des SMS du mois, `sms_month.total`, est renvoyé depuis `43ff9ec`) ;
   - modification du point d'entrée ou de la permission espèces d'une affectation : pas d'avis immédiat (le rappel de la veille porte la valeur à jour) ;
   - campagnes admin à reprendre dans un lot « communications » (préférences, désabonnement, plafond).
8. **Documentation et tests anciens :**
   - `docs/architecture.md:1096` et d'anciens rapports citent encore `notification.service.ts` ;
   - suites legacy périmées à l'exécution (section 5), non exécutées en CI.

Le lot 7 n'a pas été commencé.
