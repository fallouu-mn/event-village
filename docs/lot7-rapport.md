# LOT 7 — RAPPORT

**Objet :** un billet présentable sans réseau, un scanner fiable devant une foule, des parcours client et partenaire terminés sur le système de design, et la dette du lot 6. Le lot couvre :
- 7.0 : dette du lot 6 (plafond SMS, billets gratuits, six correctifs de sécurité, preuves manquantes, application installable, restes d'interface) ;
- 7.1 : billet hors ligne (lot de codes, version du secret, page hors ligne, service worker à cache limité) ;
- 7.2 : interface du contrôleur (plein écran, vibrations, aucun son, idempotence, états réseau, compteur et historique servis par le serveur, saisie manuelle en deux temps, caisse, guichet), plus la reprise de session demandée par l'utilisateur (amendement A10) ;
- 7.3 et 7.4 : parcours client et partenaire ;
- 7.5 : performance et accessibilité ;
- 7.6 : invariants (p)(q) ;
- 7.7 : captures et fumée prolongée ;
- 7.9 : confirmation d'achat claire, ajoutée par l'utilisateur le 04/11.

**Branche :** `lot7/terrain`, créée depuis `main` (`6fff1bf`). Dernier commit de code : `55afc8b` ; le commit de ce rapport ne change que la documentation (`docs/`). Rien n'a été exécuté contre un projet Supabase distant. Les migrations du lot vont de `20261105000001` à `…07` ; elles sont appliquées et testées en CI depuis une base vide. Les migrations `20261103…` du lot 6, déjà appliquées en production, sont gelées : `migration-lot7-rejouable` vérifie leur SHA-256.

**Date :** 5 novembre 2026. Les runs cités ont eu lieu le 4 novembre, sauf le run 84 (5 novembre, vers 00 h UTC).

**Résultat : vert.** Run 84 (`41936361777`, commit `55afc8b`, `job_status=success`), le run « après » de référence :
- `npm run verify` : 181 suites sur 181, aucun échec ni suite expirée. Sous-tests : 2 169, tous réussis, aucun annulé. Typecheck, lint, tests, build et budgets de poids JavaScript : « [verify] OK — 5 étapes réussies en 605s ».
- `npm run e2e` : **tout vert**.
  - 10 connexions ;
  - 286 captures sur 286, sans aucun contrôle bloquant en échec ;
  - emails 5 sur 5 (20 captures) ;
  - fumée prolongée (16 étapes) ;
  - terrain 8 sur 8, reprise de session comprise ;
  - pwa 4 sur 4 ;
  - perf 4 sur 4.
- Durée du job : 1 857 s (31 min), pour une limite de 60 min.

**La preuve du lot est le run 84, sur `55afc8b`, dernier commit de code.** Le commit de ce rapport ne change que la documentation (`docs/lot7-rapport.md` et `docs/lot7-logs/`).

Au run 83 (`aaf6542`), le dernier run complet avant les deux derniers commits :
- verify était à 180 sur 181, à cause d'un seul cas de `temps-reel-billets` (« le porteur reçoit UTILISE en temps réel »), vert aux runs 77, 78, 80 et 84 ;
- c'est une **instabilité observée une fois** (section 6.3) ; ses journaux sont gardés dans `docs/lot7-logs/`.

Run « avant » : run 72 (`41784697018`, commit `51e0c70`, tests rouges seuls, aucun correctif). Verify : 180 suites, 128 réussies, 52 en échec. 51 échouent pour la bonne raison ; la 52ᵉ (`secrets-codes-en-dur`) venait d'un défaut d'un test du lot, corrigé par `7710e78`. Les mesures « avant » qui manquaient au run 72 viennent des runs 73 (temps d'affichage, A7) et 74 (temps de scan, A8).

---

## À lire en premier

1. **Le lot est vert au run 84** (`55afc8b`) : verify 181/181, et e2e entièrement vert. Une instabilité a été observée une fois, au run 83 : `temps-reel-billets`, le cas « le porteur reçoit UTILISE en temps réel », a échoué (délai de 20 s dépassé, scan accepté).
   - Le cas n'a pas été touché par le lot.
   - Il est vert aux runs 77, 78 et 80 (7 à 9 s) et au run 84.
   - Au run 83, le registre d'images avait répondu « Rate exceeded », image `realtime` comprise. Au run 84, il a aussi répondu « Rate exceeded », mais sur deux autres images (`postgres-meta`, `postgres`), et le cas passe.
   - La cause n'est pas établie (section 6.3). Elle reste un point ouvert à surveiller (section 15).
2. **`main` est toujours sur `6fff1bf`.** La consigne du lot est que `main` n'avance que sur demande de l'utilisateur, après lecture du rapport. Je ne l'ai pas avancé. `main` est donc encore rouge au sens du run 70 (test fragile `acces-tracabilite` 4.9, corrigé sur la branche par T0).
3. **Ne lancez jamais cette branche contre le projet de production.** `.env.local` pointe sur `event-village-prod`. Les migrations `20261105…` n'y sont pas appliquées, et la règle du projet interdit tout test sur un projet distant. Attention : `npm run dev` charge `.env.local` (comportement de Next.js). Section 13 : comment tester le lot 7 sans risque.
4. **Défauts réels trouvés pendant le lot, corrigés et testés.** Chaque preuve est citée telle qu'elle apparaît dans le journal :
   - **Boucle de détection orpheline du scanner (lot 6, A6).** Après une lecture, une seconde boucle de détection gardait `isVerifying` vrai et avalait toutes les lectures suivantes, sans POST ni message. Preuve : run 73, `e2e.log:457`, « lectures 18 … POST /api/controller/scan depuis la présentation : aucun » ; run 74, `e2e.log:464`, « lectures 19 ». Corrigé par `e8668d5`. Aux runs 83 et 84 : « lectures ignorées par l'écran (QR relu au moins une fois avant l'envoi) : 0 sur 30 ».
   - **Décodeur ZXing : environ 7,7 % des QR valides illisibles.** Preuve hors CI, dans `scratchpad/r3scan/batch2-jsqr.log` : « échecs sur 402 QR : {"app":31,"jsqr":0,…} ». Ce défaut a fait échouer la fumée du run 80 à l'étape 5 (« Entrée validée » jamais affichée en 40 s). Corrigé par `20378e3`, qui fait alterner ZXing et jsQR 1.4.0. La fumée est verte aux runs 83 et 84.
   - **Badge du portefeuille à 4,05:1.** Run 77 : axe `color-contrast` (blanc sur `#cb5e30`, 14 px). Corrigé par `e82a9b9` (`bg-brand-hover`, 7,31:1). Aux runs 83 et 84, axe ne signale rien sur `portefeuille`.
   - **Libellé comptable brut dans les finances du partenaire.** Run 77 : « valeur technique affichée : EVENT_CANCELLATION_REFUND (×9) ». Corrigé par `e82a9b9`. Capture verte aux runs 83 et 84.
   - **Modales enfermées dans la page.** Trouvé à la relecture humaine du run 77 (aide au transfert, annulation du pilotage) : la transformation de `.ev-page-enter` enfermait le voile `fixed`. `Modal` passe par un portail (`e82a9b9`). Correction vérifiée par les contrôles automatiques des runs 78 à 84, mais **NON VÉRIFIÉE à l'œil** : les captures n'ont pas été relues après correction.
   - **REFUND_PAID manquant dans l'attente de la fumée.** Run 77, étape 10 : le SMS de remboursement est bien envoyé, une seule fois, mais le test ne l'attendait pas. Attente complétée par `e82a9b9`.
   - **Mot de passe littéral dans un test du lot.** Run 72 : le garde-fou `secrets-codes-en-dur` a refusé `inscription-numero-dabord.test.ts:227`. Corrigé par `7710e78`, avec une valeur générée.
   - **IDOR sur `GET /api/orders?userId=`.** Run 72, `r25` : « sans session : HTTP 200 {"orders":[…]} », les commandes d'un autre compte. Corrigé par `64f87dd` : le compte vient de la session.
   - **Compte créé ACTIF avant la vérification du code.** Lecture de `app/api/auth/register/route.ts` à `6fff1bf` : `createUser` puis `status: 'ACTIF'`, et le code envoyé ensuite. Corrigé par `64f87dd` (D1) : numéro, puis code et profil. Le rouge du run 72 ne montre que l'absence de la route `start`. **La faille elle-même est prouvée par lecture du code, pas par un test rouge.**
   - **Double paiement en attente.** Run 72 : « second paiement (autre clé, autre opérateur) : HTTP 200 … PENDING », et deux checkouts simultanés qui répondent tous les deux 200. Corrigé par `64f87dd` (409 `PAYMENT_PENDING`, sous verrou consultatif).
   - **Course entre l'annulation d'un événement et l'acceptation d'un transfert.** Run 72 : « interblocage (40P01) entre event_cancel et ticket_transfer_accept », et « ticket_transfer_claim sur un événement ANNULE : {"ok":true,…} ». Corrigé par `6141f8f`.
   - **Course de la version du secret au scan.** Run 72, `hors-ligne-rotation` 6 : un code de la version 1, vérifié par la route avant la rotation, était accepté sur un billet déjà en version 2 (« violation de (p) »). Corrigé par `ef4c07f` : la version est contrôlée sous le verrou du billet.
   - **SMS d'achat à 161 septets au pire cas, soit 2 segments.** Run 72 : « PURCHASE_CONFIRMED (Festival des musique…) : 161 septets, 2 segment(s) ». Corrigé par `bd9d6e1` (titre limité à 19 septets) ; aux runs 83 et 84 : 160 et 159 septets.
   - **Aussi :**
     - trois activations simultanées d'un contrôleur toutes acceptées (run 72 : « statuts 200, 200, 200 ») ;
     - un admin SUPPRIME servi en 200 (run 72) ;
     - `admin_permissions` supprimé par une colonne `admin_id` inexistante (`lib/admin/admin.service.ts:417` à `6fff1bf`) ;
     - catégories illisibles par anon sans le privilège sur `users` (run 72, 42501) ;
     - `GET /api/features` appelé hors ligne (run 78, fumée étape 13), corrigé par `b18b3dd`.
5. **Contrats d'API modifiés ou nouveaux.** Le contrat complet est dans le code des routes.
   - **Inscription (D1, ★).**
     - Nouvelle route `POST /api/auth/register/start` (`{ phone }`) : elle envoie le code et ne crée aucun compte ; 409 `PHONE_ALREADY_REGISTERED`, sans SMS, si le numéro est déjà inscrit.
     - `POST /api/auth/register` exige `code` (400 `REGISTRATION_CODE_REQUIRED`) et vérifie et consomme le code avant de créer le compte, ACTIF avec `phone_verified_at`. Elle n'envoie plus aucun SMS.
     - 409 `ACCOUNT_ALREADY_EXISTS` si le numéro ou l'email a déjà un compte.
   - **Scan.**
     - `POST /api/controller/scan` exige l'en-tête `Idempotency-Key` (400 `IDEMPOTENCY_KEY_REQUIRED`). La réponse reçoit `replayed`, `consumed`, `ticket.checked_in_at` et `ticket.checked_in_by_me`.
     - Un QR sans version du secret est refusé (D32, résultat `qr_expired`).
     - `PUT` (encaissement) : le rejeu par le même scanneur rend `valid` avec `replayed: true` ; un code d'une ancienne version donne 409 `CASH_QR_OUTDATED`.
   - **Nouvelles routes du contrôleur :**
     - `POST /api/controller/scan/lookup` (saisie manuelle, premier temps) ;
     - `GET /api/controller/scans` (compteur de porte et derniers scans ; ouverte par le middleware au partenaire propriétaire, la route rend 404 hors droit) ;
     - `GET /api/controller/counter-sale` et `POST /api/controller/counter-sale/quote`.

     `GET /api/controller/assignments` reçoit `entry_point` et `counter_sale_enabled`. `GET /api/controller/shifts/active` reçoit `expected_cash_in_drawer`.
   - **Billet hors ligne :**
     - nouvelle route `GET /api/tickets/[id]/offline-codes` ;
     - `GET /api/tickets` : champ `offline` pour chaque billet ;
     - `live-code` : `server_time`.
   - **Paiement :**
     - `POST /api/checkout` : 409 `PAYMENT_PENDING`, avec `payment_id` et `status_page_url` ;
     - nouvelle route `GET /api/checkout/pending` ;
     - `POST /api/payments/[id]/cancel` interroge SamirPay avant toute annulation : 409 `PAYMENT_ALREADY_CONFIRMED`, 409 `PAYMENT_REFUND_IN_PROGRESS`, 409 `PAYMENT_VERIFICATION_PENDING`, 503 `PROVIDER_UNAVAILABLE` ;
     - `GET …/status` reçoit `target_type`, `event`, `ticket_count`, `items`, `payer_phone_masked`, `receipt_channels`, `success_url` et `retry_url`.
   - **Interrupteurs :**
     - nouvelle route publique `GET /api/features` ;
     - routes et pages des salles, tables et commandes en 404 `NOT_FOUND` quand leur interrupteur est fermé ;
     - `GET /api/orders` : le compte vient de la session et `?userId=` est ignoré ; 404 quand les trois interrupteurs sont fermés ;
     - `GET /api/partner/halls/[id]` exige désormais une session.
   - **Administration :**
     - `verifyAdminAuth` refuse tout compte non ACTIF (403 `ACCOUNT_NOT_ACTIVE`), ne lit plus que `user_roles`, et répond 503 `ADMIN_AUTH_UNAVAILABLE` si une lecture échoue ;
     - `POST /api/admin/refunds/[id]/retry` exige `refunds.manage` ;
     - `GET /api/admin/shifts/audit` exige la nouvelle permission `shifts.read`.
   - **Partenaire :**
     - `GET /api/partner/dashboard` reçoit `onboarding` et `trial` ;
     - `GET /api/partner/subscription` reçoit `trial_percent_used`, et répond 403 (et non plus 401) si le partenaire est absent ;
     - `GET /api/partner/team/all` reçoit `members`, `members_count`, `assignments_count` et `assignable_events` ;
     - `GET /api/finance/balance` reçoit `effective_status` et `is_pending` ;
     - `PATCH /api/partner/profile` est validé par Zod (400 `INVALID_FIELD`).
   - **Transfert :** l'acceptation d'un transfert dont l'événement n'est ni publié ni validé répond 409 `EVENT_NOT_ACTIVE`.
6. **Exploitation.** La procédure est dans `docs/deploiement-projet-neuf.md`, sections 3 bis, 4 bis, 4 ter, 5.3 bis, 5.5 et 5.6.
   - **Migrations :** sept migrations `20261105000001` à `…07`, à appliquer dans l'ordre. Avant `db push`, un contrôle doit montrer qu'aucune `20261103…` ne repart : `--dry-run` doit lister exactement ces 7 fichiers.
   - **Déploiement :** l'application du lot 7 se déploie **dans la même fenêtre de maintenance** que les migrations. Après la migration 5, la route de scan du lot 6 verrait tous ses QR refusés.
   - **Réglages :** 37 clés `platform_settings` après le lot. Les trois `features.*` valent `false`, et `notif.sms_daily_alert` est supprimée.
   - **Variables :** trois nouvelles variables facultatives (section 11).
   - **HTTPS** est indispensable : sans lui, ni service worker ni caméra.
   - La liste blanche des aides RLS passe à 7, y compris dans `supabase/hotfix/2026-10-31-lot1a/03-verification.sql`.
7. **Performance (section 8).**
   - `/tickets` passe de 276 353 à 237 601 octets gzip de JavaScript au run 84 (−38,8 Ko). L'objectif de −35 Ko est **atteint**.
   - `/controller/scanner` :
     - 229 207 octets avant le lot ;
     - 227 807 au run 78 ;
     - 229 698 au run 83, après l'ajout de la reprise de session et de jsQR ;
     - **222 499 au run 84**, après `28d62ae` : caméra, plein écran du résultat, bandeau de caisse et onglets chargés par `import()` et préchargés dès l'écran « Commencer le contrôle » (budget : 226 000).

     C'est 6,7 Ko de moins que l'« avant ». L'objectif de −10 Ko du contrat **reste manqué de 3,3 Ko** (D79).
   - `/billet/hors-ligne` : 211 561 octets ; l'hypothèse de 150 Ko au plus est **impossible**. Le layout racine et le template pèsent à eux seuls environ 200 Ko, dont le client Supabase (environ 69 Ko). C'est le point ouvert D79.
   - Les temps de premier affichage utile ne bougent pas : environ 4,7 s en 4G simulée avec un processeur ×4.
   - Le scan, en revanche, affiche le résultat en 44 ms (médiane, run 84) après la lecture en réseau normal, et l'état d'attente en 3 ms.
8. **Coût SMS (section 12).** Avec les réglages par défaut :
   - une commande d'un billet payant coûte 3 SMS sans push (15 F HT à 5 F, 30 F HT à 10 F), et 2 SMS avec push ;
   - un billet gratuit coûte 1 SMS (5 F ou 10 F) ;
   - les SMS indispensables ne sont plus jamais refusés par un plafond journalier ;
   - les SMS optionnels sont limités à 700 par jour, soit 3 500 F HT par jour au plus à 5 F et 7 000 F à 10 F.
9. **Tests existants modifiés :** la liste complète, avec la raison de chaque changement, est en section 1. Une suite est supprimée : `scanner-wolof-audio`, l'audio étant abandonné par le client. Deux points sortent de la règle « adaptation en phase rouge » :
   - T35 (`dette-suspendu-temps-reel`), adapté dans le commit de correctif `6141f8f` ;
   - l'exception nommée de `design-systeme` pour `CombatFlashOverlay` (`e8668d5`).

   **La décision 4 du lot 6 (service worker sans cache) est renversée** par la consigne 7.1 : le cache est limité à la page hors ligne et à ses ressources, jamais `/api/`.
10. **Demandes de l'utilisateur ajoutées pendant le lot :**
    - 7.9, la confirmation d'achat claire (section 2) ;
    - A10, la reprise de session du contrôleur (section 2, 7.2). Le scénario de test au téléphone est en section 13.
11. **Décisions ★ à lire** (section 14) :
    - D1 : contrat de l'inscription ;
    - D3 : un code d'une ancienne version donne `qr_expired`, sauf billet ou événement annulé ou remboursé ;
    - D84 : attente des captures plafonnée à 3 s.
12. **Les tests n'ont tourné qu'en CI.** Le poste n'a pas Docker : les agents n'ont exécuté que `tsc`, le lint, les cas sans base et des essais sur un PostgreSQL 14 jetable. Toute affirmation « vert » de ce rapport vient des runs CI cités, dont les journaux bruts sont sur la branche `ci-results`. Les plus utiles sont recopiés dans `docs/lot7-logs/`, dont ceux des runs 72, 83 et 84.
13. **Incident de production du lot 6** (migration 05 appliquée en partie les 03 et 04/11) : chronologie et règle retenue en section 2, « Dette : incident de production ». Runs 68 à 71 en section 6.

---

## 1. Commits

48 commits depuis `6fff1bf`, groupés par phase ; le dernier commit de code est `55afc8b`. Le commit de ce rapport vient après le dernier de cette liste, et ne change que `docs/`.

**A. Tests rouges (vague 0 et R), avant tout correctif**

| Commit | Message |
|---|---|
| 81d1be7 | test(infra)[7]: aides du lot 7 (terrain-invariants avec (p)(q) et contrôle du schéma, quota-window, openConcurrentClient et waitForLockWaiters, terrain-helpers), listes blanches (r3-fonctions-rpc : RPC du lot, dont notif_ticket_lines de la tâche 7.9 ajoutée par W11 (T31) ; fonctions-privileges : 7 aides RLS ; design-files), migration-lot7-rejouable (sept migrations, dont …07 de la tâche 7.9, T32), scan() avec Idempotency-Key, clés notif du lot 7 ; test existant 4.9 d'acces-tracabilite stabilisé (rafale alignée sur une fenêtre de 10 s, même limite et mêmes assertions, plus l'assertion « même fenêtre ») : instable au run 70 |
| ec7242c | test(7.0a): plafond des SMS optionnels (sms-plafond-optionnel : 700 SENT puis SKIPPED SMS_OPTIONAL_CAP, essentiels jamais plafonnés, alerte à 80 % une seule fois), alerte de la veille (sms-veille), réglages SUPERADMIN (r23) ; tests existants adaptés T1 à T6 (notif-envoyeur, notif-admins, notif-admin, notif-reglages, r22, notif-migration : le SMS indispensable n'est plus refusé, consigne 7.0 a) et T34 (notif-outbox, notif-modeles : types ADMIN_SMS_OPTIONAL_80 et ADMIN_SMS_FORECAST) |
| a8748de | test(7.0b): billets gratuits sans SMS de rappel par défaut (rappels-gratuits) ; tests existants adaptés T7 et T8 (notif-rappels, notif-rappels-annulation, notif-preferences : SAME_AS_PAID posé autour des billets à 0 F, attentes SMS inchangées) |
| 0624db1 | test(7.0c): sécurité (securite-admin-lot7 : compte admin non ACTIF refusé, user_id, permissions refunds.manage et shifts.read ; course-annulation-transfert à trois connexions ; r24 : catégories privées pour anon) |
| cdc343e | test(7.0d): preuves manquantes du lot 6 (activation-controleur : code à usage unique sous activations simultanées ; sms-commande-4-billets : 1 SMS et 1 J-1 par porteur) ; test existant adapté T9 (sms-anti-abus : découplé des autres suites, inscription par le nouveau parcours) |
| 159f4eb | test(7.0e): application installable (pwa-manifest : id, scope, icône maskable opaque, méta iPhone, ressources publiques sans session) |
| 36fcc61 | test(7.0f): restes d'interface (dette-interface-lot7) ; test existant renforcé T13 (notifications-and-documents cas 3 : AppLayout.tsx seul, AppLayoutHeader supprimé) |
| 118e755 | test(7.1): billet hors ligne (hors-ligne-codes : route, format, fenêtre, taille < 40 Ko gzip ; hors-ligne-rotation : version du secret, ancien code refusé, course du scan ; hors-ligne-client : IndexedDB, écart d'horloge ; hors-ligne-service-worker : cache en liste blanche) ; test existant adapté T12 (push-service-worker : la consigne 7.1 renverse la décision 4 du lot 6) |
| ac846c2 | test(7.2): scanner (scan-idempotence, scan-controleur-stats, scanner-interface sans aucun son) ; scanner-wolof-audio supprimé (T14, audio abandonné par le client) ; tests existants adaptés T15 (scanner-combat-ui : assertions audio retirées, jetons --scan-\*, vibrations distinctes), T16 (statut-compte, dette-incidents : Idempotency-Key) et T33 (acces-encaissement : le rejeu par le même scanneur rend valid et replayed, D40 ; total, commande et grand livre inchangés) |
| fd34438 | test(7.3): parcours client (interrupteurs features.\* à 404 ; paiement-attente-lot7 : second paiement en attente refusé, annulation vérifiée ; inscription-numero-dabord : aucun compte avant le code ; client-interface ; r25 : IDOR de /api/orders en clé anon) ; tests existants adaptés T18 à T20 (email-optionnel, otp-serveur, paiement-controles, finance-cibles) |
| 8480a80 | test(7.4): parcours partenaire (partenaire-lot7 : première utilisation, états vide, chargement et erreur, chiffres servis par le serveur, défauts relevés) |
| cb90f62 | test(7.5): performance et accessibilité (perf-statique ; scripts/js-budget.mjs appelé par verify après le build, mesure seule tant que js-budget.json est absent) ; .verify/ ignoré |
| a0376c7 | test(7.6): garde-fous des invariants (p)(q) (terrain-invariant : une violation fabriquée par règle, en transaction annulée) |
| 410cdca | test(7.9): confirmation d'achat claire (confirmation-achat : email de 1, 4 et 12 billets avec troncature à 10, numéros, phrases obligatoires, aucun QR ni code, thème sombre, SMS en un segment GSM-7 calculé par le test, billet reçu par transfert) ; tests existants adaptés T25 à T30 (notif-modeles, notif-outbox, notif-canaux, notif-transferts : canal email de TRANSFER_RECEIVED, bouton « Voir mes billets ») |
| 51e0c70 | test(e2e)[7]: projets terrain, pwa et perf (terrain.spec, installable.spec avec contrôle négatif, perf.spec en 4G et processeur ×4), préparation terrain-setup, build-mesure pour mesurer même si verify échoue, comptes de la fumée ; verify.yml : étapes de mesure, copie des TSV, délai du job relevé de 60 à 90 min pour le run « avant » (estimation 58 à 62 min, amendement A2, à remettre à 60 en vague F si possible) |

**B. Rattrapage du run « avant » (runs 72 et 73), avant tout correctif**

| Commit | Message |
|---|---|
| 7710e78 | test(7.3)[run 72]: inscription-numero-dabord, cas du mot de passe faible : valeur générée au lieu d'un mot de passe littéral (le garde-fou existant secrets-codes-en-dur du lot 1C l'a refusé au run 72 ; même assertion, mot de passe toujours faible : minuscules seules) |
| 1286752 | test(e2e)[7][run 72]: mesure « avant » réparée. Terrain 4 : le code d'un billet déjà composté est calculé côté Node par terrain-setup payload (réutilise lib/security/totp.ts, base locale, aucun secret imprimé) au lieu de live-code, qui le refuse en 409 UTILISE. Terrain 5 : le QR reste devant la fausse caméra jusqu'au premier POST, la sonde note lectures et POST, le message d'échec les donne. Perf : FCP et LCP relus à + 3 s, avec la colonne note_fcp_lcp. Traces Playwright non publiées sur ci-results (cookies de session et clé locale) |
| cb56b5d | test(e2e)[7][run 73]: terrain 4 réordonné pour que la mesure « avant » existe : 10 billets neufs en réseau normal puis 10 en 3G, ensuite 5 relectures « déjà utilisé » par réseau (toujours exigées, affichage et POST), puis la lecture hors ligne ; scan.tsv et scan-lectures.tsv écrits au fil des lectures. Au run 73, l'écran du lot 6 lisait la relecture sans jamais l'envoyer (boucle de détection orpheline gardant isVerifying vrai : défaut du lot 6, corrigé par fix(7.2e)). service.ts : maxPerOrder facultatif (10 par défaut, fumée inchangée) |

**C. Correctifs serveur (vague S)**

| Commit | Message |
|---|---|
| 32fa446 | fix(7.0a): les SMS indispensables ne sont plus jamais refusés par un plafond journalier (la garde ne leur applique plus sms_global, OTP inchangé) ; budget SUPERADMIN notif.sms_optional_daily_cap (700) appliqué aux seuls SMS optionnels dans notification_outbox_claim, sous verrou, au jour de Dakar de l'horloge de l'envoyeur (SKIPPED SMS_OPTIONAL_CAP) ; alerte admin à 80 % et alerte de la veille (ADMIN_SMS_OPTIONAL_80, ADMIN_SMS_FORECAST), une fois par jour ; notif.sms_daily_alert retiré ; migration 20261105000001 : toutes les clés du lot (notif.\*, features.\* à false) et features.% interdit en écriture à l'ADMIN |
| a233ebf | fix(7.0b): billets gratuits (prix 0, canal FREE ou INVITATION) sans SMS de rappel J-1 et H-3 par défaut (notif.free_ticket_reminder_sms = NEVER, SKIPPED FREE_TICKETS_ONLY ; SAME_AS_PAID les rétablit), décidé à la planification |
| 6141f8f | fix(7.0c): verifyAdminAuth refuse tout compte non ACTIF (403 ACCOUNT_NOT_ACTIVE) et ne lit plus que user_roles ; anonymisation par user_id avec retrait des rôles ADMIN et SUPERADMIN ; refunds/[id]/retry exige refunds.manage et shifts/audit exige shifts.read ; course annulation contre acceptation de transfert fermée (verrous ordonnés dans event_cancel, FOR SHARE dans ticket_transfer_accept, EVENT_NOT_ACTIVE → 409) ; catégories privées par l'aide RLS ticket_category_private_read (7e aide, liste blanche du hotfix à 7) ; notification_channel_enum supprimé. Test existant adapté (T35, signalé) : dette-suspendu-temps-reel accepte que les deux politiques de ticket_categories portent le statut du compte par l'aide, dont le corps doit lire users, SUSPENDU et SUPPRIME (contradiction avec r24 et D21) |
| 48dff36 | fix(7.0d): activation du contrôleur : le code est vérifié et consommé sous verrou en première étape, avant la pose du mot de passe (deux activations simultanées ne réussissent plus) ; une nouvelle invitation d'un compte encore temporaire émet un nouveau code et fait échoir les précédents |
| 4472f3e | fix(7.0e): application installable : manifest avec id, scope et purpose explicites, icône maskable 512 opaque et icône apple-touch 180 générées par scripts/generate-pwa-icons.mjs ; middleware : /icons/, /billet/hors-ligne, /api/features et les GET publics des salles et des restaurants servis sans session ; traces ui-ux-pro-max d'A3 |
| 0930728 | fix(7.1s): billet hors ligne côté serveur : GET /api/tickets/[id]/offline-codes (porteur, fenêtre de scan, lot compact glissant de 48 h au plus, next_from, quotas par billet et par compte), version du secret tournée par un trigger unique sur tickets avec l'historique ticket_secret_versions et ticket_secret_rotate, journal ticket_offline_downloads sans aucun code, champ offline de GET /api/tickets, heure du serveur dans live-code |
| ef4c07f | fix(7.2s): scan côté serveur : Idempotency-Key obligatoire, rejeu qui rend le verdict d'origine sans nouvelle ligne, version du secret contrôlée sous le verrou du billet après le statut d'annulation (ferme la course qui violait (p)), encaissement idempotent (le rejeu par le même scanneur rend valid et replayed), compteurs et historique de porte servis par le serveur (arrivées sur toute la durée de l'événement), saisie manuelle en deux temps par le numéro du billet, devis du guichet |
| 64f87dd | fix(7.3s): parcours client côté serveur : interrupteurs features.halls_enabled, tables_enabled et orders_enabled (404 propre par 8 layouts de garde et dans chaque route, session contrôlée avant l'interrupteur, GET /api/features) ; faille IDOR de GET /api/orders corrigée (le compte vient de la session, ?userId ignoré) ; second paiement en attente refusé (409 PAYMENT_PENDING avec le lien du paiement en cours) ; annulation vérifiée chez SamirPay ; statut de paiement enrichi ; inscription numéro d'abord (POST /api/auth/register/start, puis register qui vérifie et consomme le code avant de créer le compte) ; politiques d'insertion REST des réservations et commandes supprimées |
| bd9d6e1 | fix(7.9): confirmation d'achat claire : emails de PURCHASE_CONFIRMED, FREE_TICKETS_CONFIRMED et TRANSFER_RECEIVED avec événement, date et heure de Dakar, lieu, billets par catégorie, montant, numéros (10 au plus puis « et N autres »), les phrases obligatoires, le bouton « Voir mes billets », aucun QR ni code, thème sombre ; données figées à l'émission par notif_ticket_lines (migration 20261105000007 : payment_confirm, free_tickets_claim et ticket_transfer_accept recopiées) ; TRANSFER_RECEIVED reçoit l'email ; SMS d'achat ramené à un segment au pire cas (titre à 19 caractères, il en faisait 161) |

**D. Écrans et performance (vague E)**

| Commit | Message |
|---|---|
| eaeb60d | fix(7.0f): restes d'interface du lot 6 : messages de connexion (reset, session_expired, unauthorized_controller, already_configured, redirect vers l'inscription), cloche (« Tout marquer comme lu » sur sa ligne), champ Affiche (titre non cliquable, aria-labelledby), réglages (plafond optionnel, billets gratuits, section Fonctionnalités), supervision SMS (seuil de 80 % du plafond optionnel, état dit en texte), profil partenaire validé côté serveur, AppLayoutHeader supprimé, explication du transfert migrée sans framer-motion (le PDF n'a pas de QR), activation du contrôleur, campagnes en brouillon honnête, inscription partenaire (pièces envoyées après validation, compte déjà connecté), profils partenaire et contrôleur ; traces ui-ux-pro-max E1-001 à E1-014 |
| da26267 | fix(7.1e): billet présentable sans réseau : page publique et statique /billet/hors-ligne alimentée par IndexedDB (disponible, pas encore téléchargé, hors ligne sans codes, écart d'horloge appliqué), téléchargement automatique dans la fenêtre, purge à la déconnexion, au transfert et au changement de compte, service worker à cache versionné limité à cette page et à ses fichiers statiques (jamais /api/, push conservé, installation qui ne rejette jamais), méta iPhone et icônes dans app/layout.tsx (7.0e), modales de Mes billets chargées à la demande ; traces E2-001 à E2-004 |
| e8668d5 | fix(7.2e): scanner professionnel : résultat plein écran par catégorie (accepté, déjà utilisé, refusé, à encaisser, hors fenêtre, événement annulé) avec jetons --scan-\* d'au moins 7:1, une vibration distincte par verdict et aucune à la lecture, aucun son (wolof-audio et MP3 supprimés), retour automatique réglable, états réseau, relances avec la même clé d'idempotence, caméra libérée en arrière-plan ; défaut du lot 6 corrigé (amendement A6) : plus aucune boucle de détection orpheline qui avalait les lectures en silence ; saisie manuelle en deux temps, historique et compteur de porte servis par le serveur, caisse et guichet migrés et chargés à la demande ; test existant adapté (signalé) : design-systeme nomme CombatFlashOverlay comme exception de la règle « modale écrite à la main », le plein écran étant exigé par scanner-combat-ui ; traces E3-001 à E3-011 |
| 2b37606 | fix(7.3e): parcours client : inscription numéro d'abord puis code et profil (redirect conservé), attente de paiement honnête (ce que le client va recevoir, page fermée, « Réessayer le paiement », destination du succès servie), bandeau et refus d'un second paiement en attente, navigation et accueil selon les interrupteurs, 404 et page d'erreur propres, commandes et portefeuille migrés, un seul format de montant, modale de paiement et carte chargées à la demande, mention des tuiles marquée data-ev-caption ; traces E4-001 à E4-012 |
| 9a8f13c | fix(7.4): parcours partenaire : première utilisation (étapes cochées par le serveur), essai et pourcentage servis par le serveur, tableau de bord avec états de chargement et d'erreur (plus de zéros sans donnée), statuts traduits, finances, équipe et abonnement migrés au système de design, chiffres servis par le serveur ; traces E5-001 à E5-009 |
| 020fda0 | fix(7.5): sharp 0.33.5 avec ses binaires Linux, framer-motion, liquid-glass-react et react-leaflet retirés, @types/leaflet en devDependencies, budgets de poids JavaScript bloquants par route (scripts/js-budget.json, mesure + 3 Ko) ; traces E6-001 et E6-002 |

**E. Vague F : seed, captures, fumée, reprise de la performance, documentation**

| Commit | Message |
|---|---|
| fe99f4a | fix(7.6): seed de démonstration sur le schéma du lot 7 : ticket_scan appelé comme la route (secret_version lue avec le secret du billet, client_key par lecture), schéma du lot 7 exigé au contrôle préalable (missingTerrainSchema), plus jamais deux paiements PENDING d'un même acheteur sur un même événement (deux acheteurs distincts pour les réservations en cours, garde M6 vérifiée sur la base), événement « la veille » et billet du client dans la fenêtre hors ligne, paiements du client en attente, réussi et échoué, partenaire « premiers pas » (VALIDE, en essai, aucun événement, sans logo), communications.manage à l'administrateur, billet de la saisie manuelle ; fin par assertTerrainInvariants (a) à (q) ; demo-ids.json en version 3 (T24) |
| 6934436 | fix(7.7): captures des nouveaux écrans (billet hors ligne disponible, à télécharger, QR hors ligne servi par le service worker, sans codes ; scanner : départ, six résultats plein écran, réseau lent, hors ligne, saisie manuelle, guichet ; caisse : ouverture, clôture avec écart, Z ; paiement : modale, attente, succès, échec ; inscription par le code ; pages partenaire migrées et première utilisation ; pages masquées en 404 propre ; activation et profil du contrôleur ; campagnes ; aide au transfert ; portefeuille), scanner en 2 vues sombres (D85), attente des captures plafonnée à 3 s sur les requêtes /api/ (D84), contrôles axe, 44 px et 14 px bloquants et contraste du plein écran ≥ 7:1 (T23), emails de confirmation rendus hors application et capturés en clair et en sombre à 390 et 600 px (D98, projet et phase emails), fumée prolongée (étapes 11 à 16 : achat, codes la veille, hors ligne, scan accepté, transfert puis ancien code refusé) avec étapes 8 et 10 adaptées (D81 : boîte de E1 vidée avant le repère, SMS identifiés par provider_message_id, liste exacte), terrain et perf sur les sélecteurs réels (écran « Commencer le contrôle »), contrôle sharp-missing-in-production (start-app.mjs et verify.yml), timeout-minutes remis à 60 (A2) |
| abc6c7a | fix(7.5)[reprise]: le JavaScript du scanner baisse à nouveau : la synchronisation hors ligne n'est plus importée par le layout racine mais chargée à la demande par AuthProvider, pour un compte CLIENT seulement (purge à la déconnexion inchangée) ; StatusBadge n'importe plus les libellés de la boîte d'envoi (prop catalog passée par les deux pages admin) ; dépendances du panneau de la cloche chargées au survol, au focus ou à l'ouverture, avec états de chargement et d'erreur. Fichiers d'E2 et d'E1 attribués à E6 par l'orchestrateur pour cette reprise |
| 025bce5 | docs(7.0a): procédure de déploiement : migrations 20261105000001 à …07 dans l'ordre et contrôle qu'aucune 20261103… n'est rejouée (dry-run qui liste exactement les 7 fichiers), application déployée dans la même fenêtre que la migration 05, réglages du lot 7 (features.\* à false, notif.sms_daily_alert supprimé), 3 nouvelles variables d'environnement, notif.sms_optional_daily_cap comparé à SMS_GLOBAL_DAILY_CAP, exigences pour l'hébergeur |
| a6dd020 | docs(7.0e): installer l'application sur Android et sur iPhone, et afficher son billet sans réseau |
| 34b631e | docs(7.0f): architecture.md mis à jour pour le lot 7 (sections 5, 6, 31 à 33, 36, 37), sans plus aucune mention de notification.service.ts ni de use-notifications.ts |
| 0bc6e1d | docs(7.2): guide de l'organisateur pour les entrées : préparation, démarrage du contrôle, chaque écran de résultat et sa conduite, aucun son, réseau lent ou coupé (jamais de validation hors ligne), saisie manuelle en deux temps, caisse, guichet, billet hors ligne du spectateur |

**F. Après le run 77 : relecture des captures, corrections des runs 78 et 80, reprise de session (A10), CI**

| Commit | Message |
|---|---|
| e82a9b9 | fix(7.7)[relecture]: corrections du run 77 et de la relecture visuelle des captures (bilan dans le rapport). Échecs du run 77 : portefeuille (badge à 7,31:1 au lieu de 4,05:1), finances partenaire (plus de libellé comptable brut avec référence et code, titre de l'événement servi par accountHistory), cloche (contrôle « une ligne » qui comptait l'icône), billet hors ligne en QR (billet de « ce soir », contrôle déjà ouvert), modale de paiement (sélecteur du bouton du panneau), fumée étape 10 (REFUND_PAID E2 attendu, envoyé une seule fois après l'annulation, déjà prévu par le contrat). Relecture : modales rendues par un portail (elles étaient enfermées par la transformation de .ev-page-enter), pastille « En direct » masquée sur un événement clos, titre sous l'affiche du billet, compte à rebours du paiement, offres (limites illimitées), libellés des indicateurs et du pilotage, doublon du plein écran d'encaissement, liste d'activités partenaire unique, textes du billet hors ligne et du scanner ; traces R1-001 à R1-003 et R2-001 à R2-009 |
| b18b3dd | fix(7.7)[run 78]: hors ligne, useFeatureFlags ne tente plus GET /api/features (navigator.onLine faux) et lit les interrupteurs au retour du réseau ; au run 78, la page du billet hors ligne (fumée, étape 13) déclenchait par AppLayout une requête vouée à l'échec et une erreur de console |
| 8ce353c | fix(7.5)[run 78]: budgets de poids JavaScript resserrés à la règle du contrat (mesure du run 78 arrondie au Ko supérieur, plus 3 Ko) : / 217 000, /events/[id] 224 000, /tickets 241 000, /controller/scanner 231 000, /billet/hors-ligne 215 000 octets gzip ; les budgets précédents venaient de la mesure locale de la vague E, avant la reprise de la performance |
| 20378e3 | fix(7.2)[run 80]: le décodeur logiciel du scanner (ZXing 0.23, utilisé sans BarcodeDetector : Safari iPhone, Firefox, Chrome ordinateur) ne lisait pas environ 7,7 % des QR de billet valides (31 sur 402 dans le navigateur, même échec en 0.21 et 0.22), d'où l'échec intermittent de la fumée à l'étape 5 au run 80 (QR présenté, aucune lecture en 40 s). CameraQrScanner fait désormais alterner ZXing et jsQR 1.4.0 (version exacte, Apache-2.0, chargé à la demande, 0 échec sur 402), une image sur deux, et expose le décodeur actif (data-scan-decoder). Fumée, étape 5 : diagnostic caméra (images analysées, POST, état de l'écran, QR et image vidéo joints) ; délai et assertion inchangés ; trace R3-001 |
| 4f6499d | fix(7.2)[A10]: reprise de la session du contrôleur, à la demande de l'utilisateur (quitter l'application puis revenir ne perd plus rien), sur /controller/scanner et /partner/scan : même événement, même mode et même onglet retrouvés (mémoire locale par compte, sans identifiant ni donnée personnelle, 24 h, reprise seulement si l'événement est toujours ouvert au contrôle, effacée à la déconnexion) ; compteur de porte et derniers scans relus sur le serveur au montage, au retour d'arrière-plan (visibilitychange, pageshow) et au retour du réseau, y compris pour le partenaire (GET /api/controller/scans ouvert au propriétaire de l'événement par le middleware, la route rendant 404 hors droit) ; scan en cours au moment de la sortie renvoyé au retour avec la même clé d'idempotence (2 min au plus, « Résultat retrouvé », aucune double entrée) ; caisse ouverte relue ; caméra coupée en arrière-plan et relancée par « Reprendre le contrôle » ; suite scanner-reprise et e2e terrain 7 ; guide de l'organisateur mis à jour ; traces R4-001 à R4-006 |
| aaf6542 | ci(7)[runs 81-82]: démarrage de Supabase local plus robuste : le runner GitHub a refusé deux fois de suite le port 54322 (« address already in use ») avant tout test ; l'étape journalise les ports 5432x à l'écoute et, en cas d'échec, les conteneurs, puis fait un arrêt propre et une seule nouvelle tentative |

**G. Après le run 83 : poids du scanner, documentation**

| Commit | Message |
|---|---|
| 28d62ae | fix(7.5)[scanner]: le premier chargement de /controller/scanner passe de 229 692 à 222 496 octets gzip (avant le lot : 229 207 ; il était remonté au run 83 avec la reprise de session et le double décodeur) : la caméra, le plein écran du résultat, le bandeau de caisse et les onglets sont chargés par import() et préchargés dès l'écran « Commencer le contrôle » (lib/scan/deferred-part.ts, rendu direct une fois chargés, donc aucune suspension au premier verdict ; repli neutre, jamais un verdict, si une partie manque encore) ; budget du scanner ramené à 226 000 (mesure + 3 Ko) ; traces R5-001 et R5-002 |
| 55afc8b | docs(7.0e): installer l'application : l'adresse officielle en https:// est exigée (sinon ni installation, ni billet hors ligne, ni caméra du scanner) |

**Écriture des tests.**
- La découverte a été faite par huit sous-agents (`scratchpad/discovery-7-*.md`). Le contrat commun (`scratchpad/lot7-design.md`) porte en tête dix amendements de l'orchestrateur (A1 à A10).
- Les tests rouges ont été écrits par l'infrastructure, puis par dix écrivains et l'agent e2e. W11 a été ajouté pour 7.9. Ces tests ont été committés (`81d1be7` à `51e0c70`) avant tout correctif.
- Les correcteurs serveur (vague S) et les agents d'écran (vague E) n'ont touché à aucun fichier de `tests/` ni de `e2e/`, sauf l'exception nommée de `design-systeme` et T35, toutes deux posées par l'orchestrateur et signalées plus bas.
- Après le run 77, plusieurs agents ont modifié des fichiers de `e2e/` (tableau B) :
  - l'agent des échecs de la relecture (R1) ;
  - celui du décodeur (R3) ;
  - celui de la reprise de session (R4), qui a aussi écrit la suite `scanner-reprise`.
- Les agents d'écran ont invoqué ui-ux-pro-max par l'outil de trace. Les 75 traces sont dans `docs/lot7-logs/ui-ux-pro-max/` (section 10) : le lot 6 n'avait pas pu prouver cet usage, le lot 7 le prouve.

**Découpage des commits.** Comme aux lots précédents, les commits intermédiaires ne compilent ni ne passent tous isolément ; seule la tête est vérifiée par la CI.
- Les commits serveur (`32fa446` à `bd9d6e1`) ont été poussés ensemble.
- Le scanner répondait 400 tant que `e8668d5` (écran, en-tête `Idempotency-Key`) n'était pas poussé.
- Le seed de démonstration échouait (D32) jusqu'à `fe99f4a`.

### Tests existants modifiés (signalement)

**A. Tests antérieurs au lot 7.** Chaque ligne a été relue dans le diff `6fff1bf..55afc8b`. Les deux derniers commits ne touchent aucun test. « T » renvoie à la section 13 du contrat, complétée par 19.8 et les amendements A3 et A9. Les numéros T10 et T11 n'existent pas dans le contrat.

*Phase rouge, avant tout correctif :*

| # | Fichier | Commit | Avant → après | Raison | Run 84 |
|---|---|---|---|---|---|
| T0 | `tests/parcours/acces-tracabilite.test.ts` | `81d1be7` | Test 4.9 : la route est importée avant la rafale, puis `alignQuotaWindow(10, 3000)`, puis `assertSameQuotaWindow` après. Limite (3) et assertions (3 × 200 `dynamic_qr_required`, puis 2 × 429) inchangées. Titre « ni voix Wolof de rejet » → « aucun son de rejet » ; le motif `wolofType` est gardé. | Test instable du lot 4 : au run 70, une rafale à cheval sur deux fenêtres fixes de 10 s laissait passer le 4ᵉ scan en 200. Audio supprimé. | PASS |
| T0b | `tests/parcours/acces-helpers.ts` | `81d1be7` | `scan(user, body)` → `scan(user, body, opts)`, avec l'en-tête `idempotency-key` | D39 | PASS (via `acces-*`) |
| T0c | `tests/parcours/notif-helpers.ts` | `81d1be7` | `'notif.sms_daily_alert': 2000` → `'notif.sms_optional_daily_cap': 700, 'notif.free_ticket_reminder_sms': 'NEVER'` ; types `NotifSettingKey` et `RetiredNotifSettingKey` | D15 | — |
| T0d, T31 | `tests/security/r3-fonctions-rpc.test.ts` | `81d1be7` | `LOT7_RPCS` (9 fonctions, dont `notif_ticket_lines`) ajoutées à `BUSINESS_RPCS`. Un nouveau bloc exige que chacune **existe** et soit refusée en 42501. `ticket_category_private_read` est ajoutée aux aides RLS. | Plus strict ; fonctions nouvelles | PASS (272/272) |
| T0e | `tests/schema/fonctions-privileges.test.ts` | `81d1be7` | Liste blanche des aides RLS : 6 → 7 | D21 | PASS |
| T0f | `tests/helpers/design-files.ts` | `81d1be7` | 19 nouveaux `.tsx` et 18 fichiers migrés ajoutés ; commentaire `:80-81` remplacé | Règle de la liste blanche | — |
| — | `tests/helpers/db.ts` | `81d1be7` | Ajouts seulement (`openConcurrentClient`, `waitForLockWaiters`) | Course à trois connexions | — |
| T1 | `tests/parcours/notif-envoyeur.test.ts` | `ec7242c` | « Plafond quotidien → SKIPPED SMS_DAILY_CAP » (PASSWORD_CHANGED) devient : PASSWORD_CHANGED SENT au texte exact, et REMINDER_J1 SKIPPED `SMS_DAILY_CAP` sans relance. Le seuil `ADMIN_SMS_DAILY_THRESHOLD` devient `ADMIN_SMS_OPTIONAL_80` (plafond 1, ligne optionnelle). Jour tiré au hasard. | Consigne 7.0 a, qui **renverse la décision 9 du lot 6** ; D15 | PASS |
| T2 | `tests/parcours/notif-admins.test.ts` | `ec7242c` | Même passage à `ADMIN_SMS_OPTIONAL_80`. `ADMIN_SMS_CAP_GLOBAL` passe d'un jour réel à un jour futur tiré au hasard. | 7.0 a ; couplage 7.0 d supprimé | PASS |
| T3 | `tests/parcours/notif-admin.test.ts` | `ec7242c` | Motifs `SMS_OPTIONAL_CAP` et `FREE_TICKETS_ONLY` ajoutés à la liste fermée. `threshold` = `ceil(cap × 8 / 10)` (null si 0), plus `optional_cap` et `optional_today`. | 7.0 a, b | PASS |
| T4 | `tests/parcours/notif-reglages.test.ts` | `ec7242c` | 9 clés `notif.*` → 10 ; bornes des deux nouvelles clés ; libellés de la page (A5) ; section « Fonctionnalités » | 7.0 a, b, f | PASS |
| T5 | `tests/security/r22-reglages-notif.test.ts` | `ec7242c` | `KEYS` : − `sms_daily_alert`, + 2 clés | 7.0 a | PASS |
| T6 | `tests/parcours/notif-migration.test.ts` | `ec7242c` | `SYNC_ROUTES` : `register/route.ts` → `register/start/route.ts` ; inventaires : `ADMIN_SMS_FORECAST`, et `ADMIN_SMS_DAILY_THRESHOLD` → `ADMIN_SMS_OPTIONAL_80` | D1, D15 | PASS |
| T34 | `notif-outbox.test.ts:147-149`, `notif-modeles.test.ts:256-258` | `ec7242c` | Registre et catalogue attendus : + `ADMIN_SMS_OPTIONAL_80`, `ADMIN_SMS_FORECAST` | A3 : égalité exacte imposée par ces suites | PASS |
| T7 | `tests/parcours/notif-rappels.test.ts` | `a8748de` | `notif.free_ticket_reminder_sms` = `SAME_AS_PAID` pour toute la suite (valeur relue avant, puis remise). Attentes SMS inchangées. Texte in-app du H-3 : « …et demande une connexion. » → « …il restera disponible sans réseau. » | 7.0 b (tous ses billets sont à 0 F) ; D33 | PASS (16/16) |
| T8 | `notif-rappels-annulation.test.ts`, `notif-preferences.test.ts` | `a8748de` | `SAME_AS_PAID` autour des billets à 0 F | 7.0 b | PASS |
| T9 | `tests/parcours/sms-anti-abus.test.ts` | `cdc343e` | Compteur `sms_alert/global_cap` du jour remis à zéro en base locale ; `since` = début du test. Destinataire : un admin `notifications.read` neuf, et la ligne `ADMIN_SMS_CAP_GLOBAL:<jour>:<admin>:IN_APP` est **exigée** (au lieu d'un `if`). « Numéro déjà inscrit » passe par `registerClientFlow`. | Couplage 7.0 d ; D1 ; plus strict | PASS |
| T12 | `tests/parcours/push-service-worker.test.ts` | `118e755` | Test 1 : « 0 écouteur fetch, aucun cache » devient « un écouteur par type, aucune réponse pour `/api/push/*` et `/api/auth/me` » ; la liste blanche est vérifiée par `hors-ligne-service-worker`. Test 2 : `cacheOpened === 0` devient « l'installation ne rejette jamais ». `skipWaiting`, suppression des caches `event-village-*` et `claim` inchangés. | Consigne 7.1, qui **renverse la décision 4 du lot 6** | PASS (17/17) |
| T13 | `tests/notifications-and-documents.test.ts` | `36fcc61` | Cas 3 : lit `AppLayout.tsx` seulement (branche `AppLayoutHeader` retirée) | 7.0 f ; renforcement | PASS |
| T14 | `tests/scanner-wolof-audio.test.ts` | `ac846c2` | **Supprimé** (16 cas sur l'audio) | Décision du client (7.2) | — |
| T15 | `tests/scanner-combat-ui.test.ts` | `ac846c2` | Assertions audio retirées (oscillateurs, `AudioContext`, `audio: true`). Palettes → jetons `--scan-*`. Vibrations : accepté `[60]`, refusé `[120,60,120,60,120]`, hors fenêtre `[250,100,250]`, technique aucune. Gardés : `fixed inset-0`, nom en très grand, message, torche, robustesse sans `vibrate`. `qr_expired` passe de l'ambre au refus. | 7.2, D50 | PASS (6/6) |
| T16 | `statut-compte.test.ts`, `dette-incidents.test.ts` | `ac846c2` | En-tête `Idempotency-Key` sur les appels directs du scan | D39 (sans lui, les 403 attendus deviendraient des 400) | PASS |
| T33 | `tests/parcours/acces-encaissement.test.ts:202-204` | `ac846c2` | Rejeu de l'encaissement par le même scanneur : refus attendu → 200 `valid`, `replayed: true`, même `payment_id`, `amount` = prix. **En plus :** paiements de la caisse inchangés, un seul scan accepté. Total, commande et grand livre toujours vérifiés. Le refus par un autre scanneur est couvert par `scan-idempotence` cas 7. | D40 (A3) | PASS |
| T18 | `email-optionnel.test.ts`, `otp-serveur.test.ts` | `fd34438` | Inscription par `registerClientFlow` (start, code, register) ; mêmes assertions. `r13-parrainage-relations` et `finance-commissions` ne sont pas modifiés (ils n'appellent pas la route). | D1 | PASS |
| T19 | `tests/parcours/paiement-controles.test.ts` | `fd34438` | Test du quota : trois checkouts `[ev, ev, ev]` → `[ev, second, ev]`. Statuts attendus `[200, 200, 429]` inchangés. | D4 : le 2ᵉ paiement en attente du même acheteur serait 409 | PASS |
| T20 | `tests/parcours/finance-cibles.test.ts` | `fd34438` | `pay()` passe sous `withFeatureFlags({ <service>: true })` pour ORDER, HALL et TABLE ; webhook et cron exécutés interrupteur fermé (plus strict) | D55 | PASS (8/8) |
| T25-T27 | `tests/parcours/notif-modeles.test.ts` | `410cdca` | `TRANSFER_RECEIVED` `[I,P]` → `[I,P,M]`. Règle générique de l'email gardée pour tous les types sauf les trois de 7.9 (« Voir mes billets » exigé, « Ouvrir Event Village » absent, P1 à P3). In-app de `TRANSFER_RECEIVED` avec et sans `ticket_number`. | D91, D93, D94 | PASS (19/19) |
| T28 | `tests/parcours/notif-outbox.test.ts:93` | `410cdca` | `TRANSFER_RECEIVED` + EMAIL | D91 | PASS |
| T29 | `tests/parcours/notif-canaux.test.ts:463-464` | `410cdca` | Libellé du bouton « Ouvrir Event Village » → « Voir mes billets » ; le reste est inchangé | D93 | PASS |
| T30 | `tests/parcours/notif-transferts.test.ts` | `410cdca` | Canaux du destinataire `['EMAIL','IN_APP','PUSH']` ; « aucun SMS » gardé | D91 | PASS |
| T32 | `tests/schema/migration-lot7-rejouable.test.ts` | `81d1be7` | (suite du lot) liste exacte des 7 migrations | Rejouabilité | PASS (16/16) |

*Aucun changement, vérifié :* T17 (`notif-interface`), T21 (aucune insertion sous JWT client), T22 (`paiement-retour`, `paiement-operateur`, `finance-affichage`), ainsi que la liste « non modifiés » de la section 13 du contrat. Toutes ces suites sont PASS aux runs 72, 83 et 84.

*Adaptations faites hors de la phase rouge (signalées) :*

| Fichier | Commit | Avant → après | Raison |
|---|---|---|---|
| `tests/parcours/dette-suspendu-temps-reel.test.ts` (T35, A9) | `6141f8f` (commit de correctif 7.0 c, par l'orchestrateur) | Le test exigeait que le USING et le WITH CHECK des deux politiques de `ticket_categories` lisent littéralement `users`, `SUSPENDU` et `SUPPRIME`. Il accepte maintenant aussi l'appel de l'aide `ticket_category_private_read(`, **à condition que le corps de l'aide**, lu dans `pg_proc`, lise le statut du compte. | Contradiction avec `r24` et D21 : la politique ne doit plus lire `users`. La garde « statut du compte » reste vérifiée, à travers l'aide. |
| `tests/parcours/design-systeme.test.ts:630` | `e8668d5` (commit d'écran 7.2 e) | `components/scan/CombatFlashOverlay.tsx` est ajouté à `sharedShell`, la liste des fichiers où `fixed inset-0` est permis hors de `Modal`. | Le plein écran du résultat n'est pas une modale (pas de piège de focus, il se ferme seul), et `scanner-combat-ui` l'exige. **C'est un relâchement localisé, sur un seul fichier nommé**, qui remplace le contournement `cn('fixed','inset-0')` proposé par E3. |

**B. Tests du lot 7 corrigés après leur commit rouge.** Chaque diff a été relu.

| Commit | Fichier | Défaut | Correction |
|---|---|---|---|
| `7710e78` | `inscription-numero-dabord` | Mot de passe littéral, refusé par `secrets-codes-en-dur` (run 72) | Valeur générée, toujours faible (minuscules seules) ; même assertion |
| `1286752` | `e2e/terrain.spec.ts`, `e2e/support/terrain.ts`, `e2e/perf.spec.ts`, `scripts/e2e/terrain-setup.ts` | Terrain 4 : `live-code` refuse un billet UTILISE (409, run 72). Terrain 5 : sonde sans diagnostic. Perf : FCP et LCP du scanner vides. | Code d'un billet composté calculé côté Node (`terrain-setup payload`, aucun secret imprimé) ; QR gardé jusqu'au premier POST ; FCP et LCP relus à + 3 s |
| `cb56b5d` | `e2e/terrain.spec.ts`, `terrain-setup.ts`, `e2e/support/service.ts` | Au run 73, la relecture « déjà utilisé » était avalée par l'ancien écran (A6) avant la série 3G | Ordre : 10 neufs en normal, 10 en 3G, puis les relectures ; TSV écrits au fil de l'eau |
| `6934436` | `e2e/support/terrain.ts`, `e2e/perf.spec.ts` | Sélecteurs du scanner du lot 6 (`#scanner-event-title`) disparus avec le nouvel écran | Bouton radio et « Commencer le contrôle » ; **aucun seuil touché**. Le marqueur du scanner change, d'où la note de la section 8. |
| `e82a9b9` | `e2e/fumee.spec.ts` (étape 10) | `REFUND_PAID E2` non attendu (run 77) | Ajouté à la liste exacte. Comptes j1/h3/annulation, doublons, SENT et absence de SENDING inchangés. |
| `e82a9b9` | `e2e/captures.spec.ts` (contrôle « une ligne ») | Le Range comptait la boîte de l'icône SVG comme une seconde ligne | Seuls les nœuds texte sont mesurés ; un libellé replié reste détecté (4 lignes à 90 px, vérifié hors CI) |
| `e82a9b9` | `e2e/support/screens.ts` | `billet-hors-ligne-qr` visait le billet « la veille », dont le contrôle n'ouvre que le lendemain ; sélecteur `paiement-modale` ambigu | Billet de « ce soir » (**écart au tableau `lot7-design.md:735`**, signalé) ; sélecteur du bouton du panneau |
| `20378e3` | `e2e/fumee.spec.ts` (étape 5), `e2e/support/fake-camera.ts` | Échec du run 80 sans diagnostic | Diagnostic de la caméra joint en cas d'échec ; délai et assertion inchangés |
| `4f6499d` | `e2e/terrain.spec.ts` | — | Spécification 7 (reprise de session) ajoutée ; seule ligne existante touchée : l'import de types reçoit `Route` |
| `8ce353c` | `scripts/js-budget.json` | Budgets fixés sur la mesure locale de la vague E, trop larges | Mesure du run 78 arrondie au Ko supérieur, plus 3 Ko |
| `28d62ae` | `scripts/js-budget.json` | Budget du scanner à 231 000 | 226 000 (mesure après le chargement différé, plus 3 Ko) : resserré, aucun autre budget touché |

**C. Outillage e2e, workflow et seed (T23, T24) :**
- **`e2e/support/checks.ts` (`6934436`, D73) :** axe (au moins une règle en échec), cibles < 44 px et textes < 14 px hors exemption deviennent **bloquants**. C'est un durcissement. Ajouts :
  - contraste du plein écran du scanner ≥ 7:1, bloquant ;
  - 7 codes dans `RAW_ENUM_VALUES`.
- **`e2e/captures.spec.ts` (`6934436`, D84 ★) :** l'attente `networkidle` de 15 s (jamais atteinte dans 164 captures sur 172 au lot 6) est remplacée par : `ready`, puis polices chargées, puis aucune requête `/api/` depuis 500 ms, le tout plafonné à 3 s. Le dépassement est noté dans l'index. Contrôle bloquant ajouté : « Tout marquer comme lu » sur une ligne à 390 px. `e2e/support/network.ts` reçoit le compteur des requêtes `/api/` (`apiActivity`).
- **`e2e/support/screens.ts` :** 37 écrans de plus. `controleur-scanner` passe de 4 vues à 2 vues sombres (D85, thème forcé), après « Commencer le contrôle ».
- **`e2e/fumee.spec.ts` :**
  - étapes 8 et 10 adaptées (D81) : la boîte de E1 est vidée avant le repère, et les SMS sont identifiés par `provider_message_id` ;
  - étapes 11 à 16 ajoutées ;
  - délai porté de 12 à 20 min ;
  - `buyThroughUi` prend une quantité.
- **`playwright.config.ts`, `scripts/e2e/run-e2e.mjs` :** projets et phases `terrain`, `pwa`, `perf` et `emails` ; `serviceWorkers: 'block'` reste global.
- **`.github/workflows/verify.yml` :**
  - `51e0c70` :
    - étape `build-mesure`, pour mesurer même quand verify échoue ;
    - copie des TSV vers `ci-results` ;
    - `OFFLINE_CODES_PER_*=1000` dans `.env.e2e` ;
    - `timeout-minutes` passé de 60 à 90 pour le run « avant » (A2).
  - `6934436` : `timeout-minutes` remis à 60 ; contrôle `sharp-missing-in-production`.
  - `aaf6542` : ports 5432x journalisés et une seule nouvelle tentative de `supabase start` (runs 81 et 82).
- **`scripts/verify.mjs` (`cb90f62`) :** appelle `scripts/js-budget.mjs` après le build.
- **`scripts/e2e/start-app.mjs` (`6934436`) :** sharp doit se charger, et le serveur s'arrête si la sortie contient `sharp-missing-in-production`.
- **`tests/seed/seed-demo.ts` (`fe99f4a`, T24) :**
  - `ticket_scan` est appelé avec `secret_version` et `client_key` ;
  - deux acheteurs distincts pour les réservations en cours (garde M6) ;
  - fin par `assertTerrainInvariants` (a à q), au lieu de (a à o) : plus strict.
- **Fichiers `e2e/support/` :** `accounts.ts` (rôles `fumee-client-bis` et `fumee-controleur`), `fixtures.ts` (export), `demo-ids.ts` (version 3), `build-index.ts` (en-tête), `service.ts` (`maxPerOrder` facultatif).

**D. Suite supprimée :** `tests/scanner-wolof-audio.test.ts` (T14). Elle n'apparaît plus au run 72, qui compte 180 suites.

**E. Décision 4 du lot 6 renversée.** Le service worker du lot 6 ne mettait rien en cache. Celui du lot 7 garde un cache versionné `ev-hors-ligne-lot7-1`, limité à `/billet/hors-ligne`, à ses fichiers `/_next/static/` et aux icônes. Il ne met jamais en cache `/api/` ni `_rsc`, et supprime les anciens caches à l'activation. Preuves : terrain 2 aux runs 83 et 84 (29 entrées, aucune `/api/`) et fumée étape 16.

---

## 2. Par tâche : grep, test rouge, correctif, test vert

**Les deux runs de référence.**
- **Avant** : run 72 (`41784697018`, commit `51e0c70`). Les tests rouges sont committés, aucun correctif ne l'est.
- **Après** : run 84 (`41936361777`, commit `55afc8b`), entièrement vert. Les extraits e2e sont pris au run 84 ; certains extraits de suites restent cités au run 83 (`aaf6542`) quand ils y sont identiques. Les compteurs de toutes les suites sont égaux entre les deux runs, sauf `temps-reel-billets` (section 6.3).

**Origine des extraits.**
- Les greps ont été exécutés par `git grep` sur l'arbre de `6fff1bf` (départ du lot), puis sur celui de `aaf6542`.
- Chaque bloc « run 72 / run 84 » est recopié de `runs/<n>-<id>/test-logs/<suite>.log` sur `ci-results`. On y trouve :
  - jusqu'à quatre sous-tests en échec, avec la première ligne de leur erreur ;
  - jusqu'à six sous-tests réussis ;
  - les compteurs TAP.

  Les sorties complètes sont dans `docs/lot7-logs/ci-run72-verify.log` et `ci-run84-verify.log`.
- Les lignes sont tronquées à 240 caractères. Une valeur `totp_secret` imprimée par un test (base CI locale et éphémère) est masquée.

**Toutes les suites du lot.**
- Chaque suite nouvelle appelle `assertTerrainInvariants` en `after()`. Une suite dont les cas passent reste donc rouge tant que les migrations M4 et M5 manquent : c'est le cas de `sms-commande-4-billets` au run 72.
- Le tableau des 52 suites en échec au run 72, avec la cause de chacune : `scratchpad/lot7-run72-triage.md`, recopié en section 6.1.

### 7.0 a — Plafond SMS : indispensables jamais plafonnés, budget des optionnels

**Consigne.**
- Les SMS indispensables ne sont jamais refusés par un plafond journalier.
- Un budget SUPERADMIN `notif.sms_optional_daily_cap` (700) s'applique aux seuls SMS optionnels, avec le motif `SKIPPED SMS_OPTIONAL_CAP`.
- Une alerte part à 80 % de ce budget, et une alerte de la veille si les rappels prévus dépassent le budget restant, chacune une fois par jour.
- `notif.sms_daily_alert` est supprimée.

**Avant.** Décision 9 du lot 6 : la garde `sms_global` refusait aussi les SMS indispensables (`SMS_DAILY_CAP`). C'est l'objet de T1, dont l'extrait rouge est ci-dessous.

**Correctif.** `32fa446` :
- migrations `20261105000001_lot7_reglages.sql` et `20261105000002_lot7_sms.sql` ;
- `lib/sms/sms-guard.ts` (`SmsContext.family` : une famille ESSENTIAL ne passe plus par `sms_global`) ;
- `lib/notifications/dispatcher.ts`, `outbox-labels.ts`, `catalog.ts`, `catalog-types.ts` ;
- `app/api/admin/finance-settings/route.ts`.

Le budget est appliqué dans `notification_outbox_claim`, sous `pg_advisory_xact_lock`, et compté sur la boîte d'envoi au jour de Dakar (D13). L'agent correcteur A1 a relevé une référence fausse du contrat (4.1), sans effet sur le code : `SmsContext` est défini dans `lib/sms/sms-guard.ts:31` et non dans `lib/integrations/types.ts:33`.

```text
# run 72 (51e0c70, « avant ») — tests/parcours/sms-plafond-optionnel.test.ts
not ok 1 - notif.sms_optional_daily_cap (700) et notif.free_ticket_reminder_sms (NEVER) présents ; bornes ; notif.sms_daily_alert supprimée et refusée
      error: clés en base : ["notif.sms_daily_alert"] (migration 20261105000001 : deux clés créées, notif.sms_daily_alert supprimée)
not ok 1 - 701 rappels J-1 optionnels le même jour : 700 SMS SENT, 1 SKIPPED SMS_OPTIONAL_CAP, 700 messages, decision.sms_budget
      error: 'réglage notif.sms_optional_daily_cap absent de platform_settings (contrat I1 du lot 6, migration 20261103000003 ; clés du lot 7 : migration 20261105000001)'
not ok 2 - puis une confirmation d’achat (ESSENTIAL) au même jour simulé : SENT, hors budget
      error: 'précondition : le cas des 701 rappels a tourné'
not ok 3 - sous les défauts de la garde (SMS_GLOBAL_DAILY_CAP = 1 000, réserve OTP 30 %) : le 701ᵉ sort en SMS_OPTIONAL_CAP, jamais SMS_DAILY_CAP ; l’achat part ensuite
      error: 'réglage notif.sms_optional_daily_cap absent de platform_settings (contrat I1 du lot 6, migration 20261103000003 ; clés du lot 7 : migration 20261105000001)'
# … 5 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# crochet en échec :
not ok 7 - /home/runner/work/event-village/event-village/tests/parcours/sms-plafond-optionnel.test.ts
  schéma du lot 7 incomplet (sms-plafond-optionnel) : invariants (p)(q) impossibles à vérifier :
# tests 9
# pass 0
# fail 9
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/sms-plafond-optionnel.test.ts
ok 1 - notif.sms_optional_daily_cap (700) et notif.free_ticket_reminder_sms (NEVER) présents ; bornes ; notif.sms_daily_alert supprimée et refusée
ok 1 - 701 rappels J-1 optionnels le même jour : 700 SMS SENT, 1 SKIPPED SMS_OPTIONAL_CAP, 700 messages, decision.sms_budget
ok 2 - puis une confirmation d’achat (ESSENTIAL) au même jour simulé : SENT, hors budget
ok 3 - sous les défauts de la garde (SMS_GLOBAL_DAILY_CAP = 1 000, réserve OTP 30 %) : le 701ᵉ sort en SMS_OPTIONAL_CAP, jamais SMS_DAILY_CAP ; l’achat part ensuite
ok 1 - notification_daily_checks deux fois au jour des 701 rappels : une ligne ADMIN_SMS_OPTIONAL_80 par canal pour l’admin, un signal SMS_OPTIONAL_80
ok 2 - 559 SMS optionnels (seuil 560) : aucune alerte ; le 560ᵉ déclenche l’alerte (transaction annulée, rien ne reste)
# … 3 autre(s) sous-test(s) réussi(s)
# tests 9
# pass 9
# fail 0
# cancelled 0
```

Extrait vert complet de `sms-plafond-optionnel` au run 84. On y lit les **700 SENT, 1 SKIPPED SMS_OPTIONAL_CAP** demandés, et le cas sous les défauts de la garde :

```text
TAP version 13
# Subtest: 7.0 a Réglages du budget SMS optionnel (M1, D15)
    # Subtest: notif.sms_optional_daily_cap (700) et notif.free_ticket_reminder_sms (NEVER) présents ; bornes ; notif.sms_daily_alert supprimée et refusée
    ok 1 - notif.sms_optional_daily_cap (700) et notif.free_ticket_reminder_sms (NEVER) présents ; bornes ; notif.sms_daily_alert supprimée et refusée
    1..1
ok 1 - 7.0 a Réglages du budget SMS optionnel (M1, D15)
[notifications] Canal push désactivé : variables VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT absentes. Les notifications partent dans l'application et par SMS.
# Subtest: 7.0 a Budget des SMS optionnels dans la réservation (M2.5, D13)
    # Subtest: 701 rappels J-1 optionnels le même jour : 700 SMS SENT, 1 SKIPPED SMS_OPTIONAL_CAP, 700 messages, decision.sms_budget
    ok 1 - 701 rappels J-1 optionnels le même jour : 700 SMS SENT, 1 SKIPPED SMS_OPTIONAL_CAP, 700 messages, decision.sms_budget
    # Subtest: puis une confirmation d’achat (ESSENTIAL) au même jour simulé : SENT, hors budget
    ok 2 - puis une confirmation d’achat (ESSENTIAL) au même jour simulé : SENT, hors budget
    # Subtest: sous les défauts de la garde (SMS_GLOBAL_DAILY_CAP = 1 000, réserve OTP 30 %) : le 701ᵉ sort en SMS_OPTIONAL_CAP, jamais SMS_DAILY_CAP ; l’achat part ensuite
    ok 3 - sous les défauts de la garde (SMS_GLOBAL_DAILY_CAP = 1 000, réserve OTP 30 %) : le 701ᵉ sort en SMS_OPTIONAL_CAP, jamais SMS_DAILY_CAP ; l’achat part ensuite
    1..3
ok 2 - 7.0 a Budget des SMS optionnels dans la réservation (M2.5, D13)
[massHolders] numéro déjà attribué, nouveau tirage (essai 2/3) : duplicate key value violates unique constraint "users_phone_key"
# Subtest: 7.0 a Alerte à 80 % du budget optionnel, une fois par jour (M2.6, D15)
    # Subtest: notification_daily_checks deux fois au jour des 701 rappels : une ligne ADMIN_SMS_OPTIONAL_80 par canal pour l’admin, un signal SMS_OPTIONAL_80
    ok 1 - notification_daily_checks deux fois au jour des 701 rappels : une ligne ADMIN_SMS_OPTIONAL_80 par canal pour l’admin, un signal SMS_OPTIONAL_80
    # Subtest: 559 SMS optionnels (seuil 560) : aucune alerte ; le 560ᵉ déclenche l’alerte (transaction annulée, rien ne reste)
    ok 2 - 559 SMS optionnels (seuil 560) : aucune alerte ; le 560ᵉ déclenche l’alerte (transaction annulée, rien ne reste)
    1..2
ok 3 - 7.0 a Alerte à 80 % du budget optionnel, une fois par jour (M2.6, D15)
# Subtest: 7.0 a Plafond 0 : aucun SMS optionnel, aucune alerte ni prévision (D15)
    # Subtest: notif.sms_optional_daily_cap = 0 : chaque rappel SKIPPED SMS_OPTIONAL_CAP, aucun SMS ; ni ADMIN_SMS_OPTIONAL_80 ni ADMIN_SMS_FORECAST
    ok 1 - notif.sms_optional_daily_cap = 0 : chaque rappel SKIPPED SMS_OPTIONAL_CAP, aucun SMS ; ni ADMIN_SMS_OPTIONAL_80 ni ADMIN_SMS_FORECAST
    1..1
ok 4 - 7.0 a Plafond 0 : aucun SMS optionnel, aucune alerte ni prévision (D15)
[SMS] envoi refusé par la garde (SMS_DAILY_CAP_REACHED) vers 002217…
# Subtest: 7.0 a Garde anti-abus : les indispensables ne sont plus soumis au plafond global (D14)
    # Subtest: SMS_GLOBAL_DAILY_CAP = 1 : PASSWORD_CHANGED (ESSENTIAL) SENT au texte exact ; REMINDER_J1 (OPTIONAL) SKIPPED SMS_DAILY_CAP, sans relance
    ok 1 - SMS_GLOBAL_DAILY_CAP = 1 : PASSWORD_CHANGED (ESSENTIAL) SENT au texte exact ; REMINDER_J1 (OPTIONAL) SKIPPED SMS_DAILY_CAP, sans relance
    1..1
ok 5 - 7.0 a Garde anti-abus : les indispensables ne sont plus soumis au plafond global (D14)
# Subtest: 7.0 a Réglage du budget absent : les optionnels ne partent pas, les indispensables si (décision 25 du lot 6)
    # Subtest: notif.sms_optional_daily_cap supprimé (transaction annulée) : optionnel SKIPPED SETTING_MISSING, essentiel réservé pour l’envoi
    ok 1 - notif.sms_optional_daily_cap supprimé (transaction annulée) : optionnel SKIPPED SETTING_MISSING, essentiel réservé pour l’envoi
    1..1
ok 6 - 7.0 a Réglage du budget absent : les optionnels ne partent pas, les indispensables si (décision 25 du lot 6)
[INVARIANT] sms-plafond-optionnel — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] sms-plafond-optionnel — purge des réservations échues : {"expired":0}
[INVARIANT] sms-plafond-optionnel — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] sms-plafond-optionnel — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] sms-plafond-optionnel — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] sms-plafond-optionnel — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] sms-plafond-optionnel — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] sms-plafond-optionnel — envoyeur : 48 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] sms-plafond-optionnel — (m)(n)(o) : 0 violation(s)
[INVARIANT-TERRAIN] sms-plafond-optionnel — (p)(q) : 0 violation(s)
1..6
# tests 9
# suites 6
# pass 9
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6603.469224

```

```text
# run 72 (51e0c70, « avant ») — tests/parcours/sms-veille.test.ts
not ok 1 - 701 porteurs, plafond 700 : deux planifications → une seule alerte ADMIN_SMS_FORECAST par canal, { planned: 701, cap: 700, remaining: 700 }, un signal
      error: 'réglage notif.sms_optional_daily_cap absent de platform_settings (contrat I1 du lot 6, migration 20261103000003 ; clés du lot 7 : migration 20261105000001)'
not ok 2 - 700 porteurs, plafond 700 : prévision égale au budget restant, aucune alerte
      error: 'réglage notif.sms_optional_daily_cap absent de platform_settings (contrat I1 du lot 6, migration 20261103000003 ; clés du lot 7 : migration 20261105000001)'
not ok 1 - billets gratuits seulement avec NEVER : non comptés ; témoin SAME_AS_PAID : comptés et alerte
      error: 'réglage notif.sms_optional_daily_cap absent de platform_settings (contrat I1 du lot 6, migration 20261103000003 ; clés du lot 7 : migration 20261105000001)'
not ok 2 - plage de silence couvrant l’heure du J-1 (9 h - 11 h, J-1 à 10 h) : J-1 non comptés ; témoin J-1 à 12 h : comptés et alerte
      error: 'réglage notif.sms_optional_daily_cap absent de platform_settings (contrat I1 du lot 6, migration 20261103000003 ; clés du lot 7 : migration 20261105000001)'
# crochet en échec :
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/sms-veille.test.ts
  schéma du lot 7 incomplet (sms-veille) : invariants (p)(q) impossibles à vérifier :
# tests 4
# pass 0
# fail 4
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/sms-veille.test.ts
ok 1 - 701 porteurs, plafond 700 : deux planifications → une seule alerte ADMIN_SMS_FORECAST par canal, { planned: 701, cap: 700, remaining: 700 }, un signal
ok 2 - 700 porteurs, plafond 700 : prévision égale au budget restant, aucune alerte
ok 1 - billets gratuits seulement avec NEVER : non comptés ; témoin SAME_AS_PAID : comptés et alerte
ok 2 - plage de silence couvrant l’heure du J-1 (9 h - 11 h, J-1 à 10 h) : J-1 non comptés ; témoin J-1 à 12 h : comptés et alerte
# tests 4
# pass 4
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/security/r23-reglages-lot7.test.ts
not ok 1 - un ADMIN ne modifie aucune des clés du lot 7 par REST (update ni upsert), aucune ligne touchée
      error: 'notif.sms_optional_daily_cap absente : le lot 7 crée cette clé (migration 20261105000001)'
not ok 2 - un ADMIN ne crée pas de clé features.* ni notif.* par REST
      error: "création de features.r23_89c382ec43cb par un ADMIN : l'opération a été ACCEPTÉE alors qu'elle doit être refusée"
not ok 3 - un ADMIN ne supprime aucune des clés du lot 7 par REST
      error: 'notif.sms_optional_daily_cap absente : le lot 7 crée cette clé (migration 20261105000001)'
not ok 4 - témoin : le SUPERADMIN modifie notif.sms_optional_daily_cap et features.halls_enabled par PUT /api/admin/finance-settings (puis restaure)
      error: 'notif.sms_optional_daily_cap absente : le lot 7 crée cette clé (migration 20261105000001)'
# tests 4
# pass 0
# fail 4
# cancelled 0
# run 84 (55afc8b, « après ») — tests/security/r23-reglages-lot7.test.ts
ok 1 - un ADMIN ne modifie aucune des clés du lot 7 par REST (update ni upsert), aucune ligne touchée
ok 2 - un ADMIN ne crée pas de clé features.* ni notif.* par REST
ok 3 - un ADMIN ne supprime aucune des clés du lot 7 par REST
ok 4 - témoin : le SUPERADMIN modifie notif.sms_optional_daily_cap et features.halls_enabled par PUT /api/admin/finance-settings (puis restaure)
# tests 4
# pass 4
# fail 0
# cancelled 0
```

Tests existants adaptés : T1 à T6 et T34.

```text
# run 72 (51e0c70, « avant ») — tests/parcours/notif-envoyeur.test.ts
not ok 1 - plafond global (SMS_GLOBAL_DAILY_CAP = 1) : PASSWORD_CHANGED (indispensable) SENT au texte exact ; REMINDER_J1 (optionnel) SKIPPED SMS_DAILY_CAP, aucune relance
      error: indispensable sous le plafond global : {"status":"SKIPPED","reason":"SMS_DAILY_CAP","detail":"L'envoi de SMS est momentanément suspendu. Réessayez plus tard ou contactez le support.","attempts":1,"next":"2026-11-04T06:25:08.546+00:00","claimed":"2028-04-10T12:
not ok 2 - 80 % du budget des SMS optionnels atteint : une seule alerte ADMIN_SMS_OPTIONAL_80 et un seul signal SMS_OPTIONAL_80 par jour
      error: 'réglage notif.sms_optional_daily_cap absent de platform_settings (contrat I1 du lot 6, migration 20261103000003 ; clés du lot 7 : migration 20261105000001)'
# tests 15
# pass 13
# fail 2
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/notif-envoyeur.test.ts
ok 1 - deux envoyeurs en parallèle : chaque ligne est réservée et envoyée une seule fois (FOR UPDATE SKIP LOCKED)
ok 2 - numéro du compte résolu à l’envoi ; compte suspendu entre-temps : SKIPPED ACCOUNT_SUSPENDED, aucun SMS
ok 3 - ordre de réservation : IN_APP avant SMS ; réponse de la réservation ; marquage par jeton (stale)
ok 1 - SMS refusé à réessayer : relances à 1, 5, 15 et 60 min, puis FAILED après la 5e tentative, alerte admin et signal
ok 2 - refus définitif du fournisseur : FAILED SMS_REJECTED dès la 1re tentative, code en détail, alerte admin
ok 3 - Retry-After du service push : plafonné à 240 min, jamais sous l’attente de la tentative
# … 9 autre(s) sous-test(s) réussi(s)
# tests 15
# pass 15
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/parcours/notif-admins.test.ts
not ok 2 - 80 % du budget optionnel atteint (plafond 1, seuil 1) : ADMIN_SMS_OPTIONAL_80 (in-app, email) une fois pour le jour, un signal SMS_OPTIONAL_80 ; jour sans SMS : rien
      error: 'réglage notif.sms_optional_daily_cap absent de platform_settings (contrat I1 du lot 6, migration 20261103000003 ; clés du lot 7 : migration 20261105000001)'
# tests 10
# pass 9
# fail 1
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/notif-admins.test.ts
ok 1 - événement soumis : ADMIN_EVENT_SUBMITTED (in-app, push, email) aux admins events.read et au SUPERADMIN, sans SMS
ok 2 - partenaire inscrit : ADMIN_PARTNER_REGISTERED (in-app, push, email) aux admins partners.read et au SUPERADMIN
ok 1 - remboursement bloqué (solde insuffisant) : ADMIN_REFUND_TO_RETRY BLOQUE aux admins refunds.manage, un signal REFUND_TO_RETRY
ok 2 - remboursement refusé par l’opérateur : ADMIN_REFUND_TO_RETRY ECHOUE, un signal ; second passage du trigger sans doublon
ok 3 - cashout incertain : ADMIN_CASHOUT_UNCERTAIN aux admins refunds.manage, un signal CASHOUT_UNCERTAIN
ok 4 - créance sur un organisateur : ADMIN_FINANCE_DEBT (in-app, email) aux admins payments.read, metadata.debt_id
# … 4 autre(s) sous-test(s) réussi(s)
# tests 10
# pass 10
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/parcours/notif-admin.test.ts
not ok 1 - par différence autour de lignes de la suite : SMS envoyés (journal OTP compris), échecs, incertains, non envoyés, annulés ; email ; seuil
      error: 'réglage notif.sms_optional_daily_cap absent de platform_settings (contrat I1 du lot 6, migration 20261103000003 ; clés du lot 7 : migration 20261105000001)'
not ok 1 - statuts, canaux, chaque motif de C4 et chaque type du registre ont un libellé français, jamais le code
      error: motifs sans libellé humain : SMS_OPTIONAL_CAP, FREE_TICKETS_ONLY
# tests 16
# pass 14
# fail 2
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/notif-admin.test.ts
ok 1 - statut FAILED : uniquement des FAILED, les 3 de la suite en tête (created_at DESC), can_retry vrai ; compteurs par statut
ok 2 - pagination : page_size 2, page 1 puis page 2, sans recouvrement ; 20 par défaut
ok 3 - canal, type et période : chaque filtre restreint la liste ; période en jours de Dakar
ok 4 - filtre inconnu (statut, canal, type) → 400 INVALID_FILTER
ok 5 - destinataire masqué : numéro « +221 77 *** ** 45 », email « aw***@domaine », compte par son nom, jamais d’endpoint push
ok 6 - détail : ligne sans claim_token, destinataire, décision, données ; can_retry selon le statut ; inconnue → 404 NOT_FOUND
# … 10 autre(s) sous-test(s) réussi(s)
# tests 16
# pass 16
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/parcours/notif-reglages.test.ts
not ok 1 - les 10 clés notif.* existent avec leur valeur par défaut et une description
      error: clés notif.* en base : ["notif.reminder_j1_enabled","notif.reminder_j1_hour","notif.reminder_h3_enabled","notif.reminder_h3_hours","notif.j1_sms","notif.h3_sms","notif.sms_quiet_start","notif.sms_quiet_end","notif.sms_daily_alert"] (migrations 20261103000003 e
not ok 2 - finance_setting_set (SUPERADMIN) : chaque valeur admise par le contrat est appliquée
      error: 'réglage notif.sms_optional_daily_cap absent de platform_settings (contrat I1 du lot 6, migration 20261103000003 ; clés du lot 7 : migration 20261105000001)'
not ok 3 - finance_setting_set (SUPERADMIN) : chaque valeur hors bornes ou de mauvais type → INVALID_VALUE, sans effet ni historique
      error: 'réglage notif.sms_optional_daily_cap absent de platform_settings (contrat I1 du lot 6, migration 20261103000003 ; clés du lot 7 : migration 20261105000001)'
not ok 1 - GET : l’ADMIN et le SUPERADMIN lisent les 10 clés notif.* et leur historique
      error: 'réglage notif.sms_optional_daily_cap absent de platform_settings (contrat I1 du lot 6, migration 20261103000003 ; clés du lot 7 : migration 20261105000001)'
# … 3 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# tests 11
# pass 4
# fail 7
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/notif-reglages.test.ts
ok 1 - les 10 clés notif.* existent avec leur valeur par défaut et une description
ok 2 - finance_setting_set (SUPERADMIN) : chaque valeur admise par le contrat est appliquée
ok 3 - finance_setting_set (SUPERADMIN) : chaque valeur hors bornes ou de mauvais type → INVALID_VALUE, sans effet ni historique
ok 4 - notif_in_quiet_hours : 22 h - 8 h passe minuit, début = fin est une plage vide, plage dans la journée
ok 5 - finance_setting_set : ADMIN refusé (FORBIDDEN, message du contrat), clé notif.* inconnue refusée (UNKNOWN_KEY), sans effet
ok 6 - historique : ancienne et nouvelle valeur, auteur et motif de chaque modification
# … 5 autre(s) sous-test(s) réussi(s)
# tests 11
# pass 11
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/security/r22-reglages-notif.test.ts
not ok 1 - un ADMIN ne modifie aucune des 10 clés notif.* par REST (update ni upsert)
      error: 'notif.sms_optional_daily_cap absente : les lots 6 et 7 créent les clés notif.* (migrations 20261103000003, 20261105000001)'
# tests 3
# pass 2
# fail 1
# cancelled 0
# run 84 (55afc8b, « après ») — tests/security/r22-reglages-notif.test.ts
ok 1 - un ADMIN ne modifie aucune des 10 clés notif.* par REST (update ni upsert)
ok 2 - un ADMIN et un SUPERADMIN ne créent pas de clé notif.* par REST
ok 3 - un ADMIN ne supprime pas de clé notif.* par REST
# tests 3
# pass 3
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/parcours/notif-migration.test.ts
not ok 1 - liste blanche : chaque entrée existe (fichier ou dossier)
      error: entrées de la liste blanche absentes :
not ok 2 - app, lib, components, hooks : aucun motif interdit hors de la liste blanche
      error: 1 appel(s) direct(s) aux adaptateurs ou écriture(s) dans notifications :
not ok 3 - routes synchrones de la liste : la méthode permise est appelée, et elle seule
      error: app/api/auth/register/start/route.ts absent
not ok 1 - registre notification_types : tous les types de l’inventaire (K1) et des envois TypeScript
      error: types absents du registre : ADMIN_SMS_FORECAST, ADMIN_SMS_OPTIONAL_80
# … 1 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# tests 20
# pass 15
# fail 5
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/notif-migration.test.ts
ok 1 - liste blanche : chaque entrée existe (fichier ou dossier)
ok 2 - app, lib, components, hooks : aucun motif interdit hors de la liste blanche
ok 3 - routes synchrones de la liste : la méthode permise est appelée, et elle seule
ok 4 - contrat E7 : chaque appel .sendOtp( et .sendControllerInvite( de app/ passe `log:` (journal sans code)
ok 1 - fichiers supprimés : NotificationService, module et route event-change-notifications, stock-notifications
ok 2 - aucune référence aux fonctions d’envoi retirées dans app, lib, components, hooks
# … 14 autre(s) sous-test(s) réussi(s)
# tests 20
# pass 20
# fail 0
# cancelled 0
```

### 7.0 b — Billets gratuits : pas de SMS de rappel par défaut

**Consigne.**
- Les rappels J-1 et H-3 d'un compte qui ne détient que des billets gratuits ne partent pas par SMS.
- Réglage `notif.free_ticket_reminder_sms` : `NEVER` (défaut) ou `SAME_AS_PAID`.
- La confirmation des billets gratuits garde son SMS.

**Correctif.** `a233ebf` : boucles J-1 et H-3 de `notification_reminders_schedule` dans la migration 02.
- Prédicat retenu : `(price = 0 OR sale_channel IN ('FREE','INVITATION')) IS TRUE`. Un prix ou un canal vide compte comme payant, et le SMS part.
- Motif `FREE_TICKETS_ONLY`, décidé à la planification (D17).

```text
# run 72 (51e0c70, « avant ») — tests/parcours/rappels-gratuits.test.ts
not ok 1 - billet FREE à 0 F : J-1 et H-3 créés (application et push), SMS SKIPPED FREE_TICKETS_ONLY, free_only ; aucun SMS
      error: 'réglage notif.free_ticket_reminder_sms absent de platform_settings (contrat I1 du lot 6, migration 20261103000003 ; clés du lot 7 : migration 20261105000001)'
not ok 2 - invitation (INVITATION) et billet à 0 F vendu en ligne (ONLINE) : idem
      error: 'réglage notif.free_ticket_reminder_sms absent de platform_settings (contrat I1 du lot 6, migration 20261103000003 ; clés du lot 7 : migration 20261105000001)'
not ok 3 - billet gratuit et billet payant du même événement : SMS du J-1 envoyé, free_only = false
      error: 'réglage notif.free_ticket_reminder_sms absent de platform_settings (contrat I1 du lot 6, migration 20261103000003 ; clés du lot 7 : migration 20261105000001)'
not ok 4 - SAME_AS_PAID : porteur d’un billet gratuit seulement, SMS du J-1 envoyé
      error: 'réglage notif.free_ticket_reminder_sms absent de platform_settings (contrat I1 du lot 6, migration 20261103000003 ; clés du lot 7 : migration 20261105000001)'
# … 2 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# crochet en échec :
not ok 2 - /home/runner/work/event-village/event-village/tests/parcours/rappels-gratuits.test.ts
  schéma du lot 7 incomplet (rappels-gratuits) : invariants (p)(q) impossibles à vérifier :
# tests 6
# pass 0
# fail 6
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/rappels-gratuits.test.ts
ok 1 - billet FREE à 0 F : J-1 et H-3 créés (application et push), SMS SKIPPED FREE_TICKETS_ONLY, free_only ; aucun SMS
ok 2 - invitation (INVITATION) et billet à 0 F vendu en ligne (ONLINE) : idem
ok 3 - billet gratuit et billet payant du même événement : SMS du J-1 envoyé, free_only = false
ok 4 - SAME_AS_PAID : porteur d’un billet gratuit seulement, SMS du J-1 envoyé
ok 5 - FREE_TICKETS_CONFIRMED garde son SMS sous NEVER (couverture : déjà vrai)
ok 6 - gratuit sur A, payant sur B (même porteur, même jour) : rappel de A sans SMS, rappel de B avec SMS
# tests 6
# pass 6
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/parcours/notif-rappels.test.ts
not ok 1 - rien à 09:59 la veille ; à 10:00 une ligne par canal, clé avec le début, échéance 10:00 ; pas de H-3 à cette heure
      error: 'test did not finish before its parent and was cancelled'
not ok 2 - tolérance de 15 min : premier passage à 10:14 → créé (échéance 10:00) ; premier passage à 10:16 → rien, ni ensuite
      error: 'test did not finish before its parent and was cancelled'
not ok 3 - rappels désactivés (notif.reminder_j1_enabled, notif.reminder_h3_enabled = false) : rien ; réactivés dans la fenêtre : créés
      error: 'test did not finish before its parent and was cancelled'
not ok 4 - plage de silence (J-1 réglé à 7 h) : application et push envoyés, SMS SKIPPED QUIET_HOURS sans report ; textes in-app et push
      error: 'test did not finish before its parent and was cancelled'
# … 12 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# crochet en échec :
not ok 1 - 6.5 Rappel J-1 : la veille à l’heure réglée (contrat I2)
  error: 'réglage notif.free_ticket_reminder_sms absent de platform_settings (contrat I1 du lot 6, migration 20261103000003 ; clés du lot 7 : migration 20261105000001)'
# tests 16
# pass 0
# fail 0
# cancelled 16
# run 84 (55afc8b, « après ») — tests/parcours/notif-rappels.test.ts
ok 1 - rien à 09:59 la veille ; à 10:00 une ligne par canal, clé avec le début, échéance 10:00 ; pas de H-3 à cette heure
ok 2 - tolérance de 15 min : premier passage à 10:14 → créé (échéance 10:00) ; premier passage à 10:16 → rien, ni ensuite
ok 3 - rappels désactivés (notif.reminder_j1_enabled, notif.reminder_h3_enabled = false) : rien ; réactivés dans la fenêtre : créés
ok 4 - plage de silence (J-1 réglé à 7 h) : application et push envoyés, SMS SKIPPED QUIET_HOURS sans report ; textes in-app et push
ok 5 - notif.j1_sms = NEVER : SMS SKIPPED SMS_POLICY_NEVER dès la planification, les autres canaux en attente
ok 1 - rien à début - 3 h - 1 min, créé à début - 3 h (I P S, IF_NO_PUSH) ; le J-1 n’est pas rattrapé ; notif.reminder_h3_hours = 5 déplace l’échéance
# … 10 autre(s) sous-test(s) réussi(s)
# tests 16
# pass 16
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/parcours/notif-rappels-annulation.test.ts
not ok 1 - suspension : rappels PENDING → CANCELLED EVENT_SUSPENDU dans la même transaction ; réactivation dans la tolérance → pas recréés, rien envoyé
      error: 'test did not finish before its parent and was cancelled'
not ok 2 - annulation (event_cancel) : CANCELLED EVENT_ANNULE et EVENT_CHANGED NO_LONGER_RELEVANT dans la transaction de l’annulation
      error: 'test did not finish before its parent and was cancelled'
not ok 3 - fin (TERMINE) : REMINDER_H3 et CONTROLLER_REMINDER PENDING → CANCELLED EVENT_TERMINE, EVENT_CHANGED → NO_LONGER_RELEVANT
      error: 'test did not finish before its parent and was cancelled'
not ok 1 - event_update (début déplacé d’un jour) : CANCELLED EVENT_RESCHEDULED dans la transaction de l’édition ; nouvelle clé au passage suivant, un seul SMS
      error: 'test did not finish before its parent and was cancelled'
# … 3 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# crochet en échec :
not ok 1 - 6.5 Rappels annulés par la transition de l’événement (contrat I4)
  error: 'réglage notif.free_ticket_reminder_sms absent de platform_settings (contrat I1 du lot 6, migration 20261103000003 ; clés du lot 7 : migration 20261105000001)'
# tests 7
# pass 0
# fail 0
# cancelled 7
# run 84 (55afc8b, « après ») — tests/parcours/notif-rappels-annulation.test.ts
ok 1 - suspension : rappels PENDING → CANCELLED EVENT_SUSPENDU dans la même transaction ; réactivation dans la tolérance → pas recréés, rien envoyé
ok 2 - annulation (event_cancel) : CANCELLED EVENT_ANNULE et EVENT_CHANGED NO_LONGER_RELEVANT dans la transaction de l’annulation
ok 3 - fin (TERMINE) : REMINDER_H3 et CONTROLLER_REMINDER PENDING → CANCELLED EVENT_TERMINE, EVENT_CHANGED → NO_LONGER_RELEVANT
ok 1 - event_update (début déplacé d’un jour) : CANCELLED EVENT_RESCHEDULED dans la transaction de l’édition ; nouvelle clé au passage suivant, un seul SMS
ok 2 - UPDATE du service_role : un UPDATE sans changement du début ne touche rien ; l’heure de début changée → CANCELLED EVENT_RESCHEDULED ; nouvelle clé dans la tolérance
ok 1 - ancien porteur sans autre billet → CANCELLED NO_LONGER_HOLDER (transaction de l’acceptation) ; porteur qui garde un billet → intact ; nouveaux porteurs → rappels à venir
# … 1 autre(s) sous-test(s) réussi(s)
# tests 7
# pass 7
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/parcours/notif-preferences.test.ts
not ok 1 - à l’insertion : SMS SKIPPED PREFERENCE_DISABLED (stage ENQUEUE) ; autres canaux en attente ; préférence d’un autre sujet sans effet
      error: 'réglage notif.free_ticket_reminder_sms absent de platform_settings (contrat I1 du lot 6, migration 20261103000003 ; clés du lot 7 : migration 20261105000001)'
not ok 2 - à l’envoi : préférence coupée après la planification → SKIPPED PREFERENCE_DISABLED (stage CLAIM), aucun SMS ; témoin : un SMS
      error: 'réglage notif.free_ticket_reminder_sms absent de platform_settings (contrat I1 du lot 6, migration 20261103000003 ; clés du lot 7 : migration 20261105000001)'
# tests 11
# pass 9
# fail 2
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/notif-preferences.test.ts
ok 1 - client : sujets « Rappels avant l’événement » et « Changements d’un événement », 4 canaux activés, indispensables listés, pas d’« Activité de vos ventes »
ok 2 - partenaire : « Activité de vos ventes » en plus ; RPC notification_preferences_get : is_partner
ok 1 - PUT REMINDERS/SMS désactivé puis réactivé : seul ce canal change, ligne notification_preferences
ok 2 - sujet inconnu, canal inconnu, valeur non booléenne, indispensable → 400 INVALID_PREFERENCE, aucune écriture
ok 3 - statut du compte : EN_ATTENTE admis (lecture et écriture) ; SUSPENDU 403 ; sans session 401
ok 1 - à l’insertion : SMS SKIPPED PREFERENCE_DISABLED (stage ENQUEUE) ; autres canaux en attente ; préférence d’un autre sujet sans effet
# … 5 autre(s) sous-test(s) réussi(s)
# tests 11
# pass 11
# fail 0
# cancelled 0
```

Réserve R2 du tri du run 72 : jusqu'à `fix(7.0a)`, les crochets `before` de T7 et T8 annulaient toute la couverture des rappels du lot 6, soit 16 et 7 cas. Au run 84, les 23 cas sont verts.

### 7.0 c — Sécurité

**Greps d'origine.**

```text
$ git grep -n "admin_id" 6fff1bf -- lib/admin/admin.service.ts
6fff1bf:lib/admin/admin.service.ts:417:            (supabase.from('admin_permissions') as any).delete().eq('admin_id', targetUserId),
$ git grep -n "admin_id" aaf6542 -- lib/admin/admin.service.ts
aaf6542:lib/admin/admin.service.ts:414:        // aux shifts ni aux commandes). Lot 7 (D19) : admin_permissions par user_id (la colonne admin_id
```

**Correctif.** `6141f8f`.
- Migration `20261105000003_lot7_securite.sql` :
  - aide `ticket_category_private_read`, 7ᵉ aide RLS ;
  - les deux politiques de `ticket_categories` ;
  - `event_cancel` verrouille les transferts PENDING puis les billets, `ORDER BY id FOR UPDATE` ;
  - `ticket_transfer_accept` verrouille l'événement `FOR SHARE` avant le transfert et renvoie `EVENT_NOT_ACTIVE` ;
  - `ticket_transfer_claim` contrôle le statut de l'événement ;
  - `DROP TYPE notification_channel_enum`.
- `lib/admin/admin-auth.ts` :
  - non ACTIF → 403 `ACCOUNT_NOT_ACTIVE` ;
  - `user_roles` seul ;
  - `shifts.read` ;
  - 503 si une lecture échoue.
- `lib/admin/admin.service.ts` : `user_id`, rôles ADMIN et SUPERADMIN retirés ; un échec de nettoyage est remonté.
- Routes `refunds/[id]/retry` et `shifts/audit`.
- `supabase/hotfix/2026-10-31-lot1a/03-verification.sql` : 7 aides.
- **Hors liste de propriété :** une ligne ajoutée à `lib/tickets/ticket-transfer.service.ts` (`EVENT_NOT_ACTIVE` → 409). Sans elle, la route de réclamation répondait 500.
- T35 adapté dans ce même commit (section 1).

**Écart à la lettre de la consigne.** Pour l'ancien jeton d'un compte anonymisé, la suite admet un refus 401 **ou** 403. Les sessions sont révoquées, donc GoTrue répond probablement 401 avant tout contrôle de statut (SUPPOSÉ). Le refus par statut lui-même est prouvé par le cas « admin SUPPRIME (session valide) ».

**Écart à l'énoncé de la course.** Le scénario 1 du contrat était vert avant tout correctif. W2 a donc ajouté un scénario à trois connexions, qui est le vrai test rouge (40P01 ci-dessous).

```text
# run 72 (51e0c70, « avant ») — tests/parcours/securite-admin-lot7.test.ts
not ok 2 - admin SUPPRIME (session valide) → 403 ACCOUNT_NOT_ACTIVE sur /api/admin/users, /api/admin/notifications et verifyAdminAuth
      error: SUPPRIME : GET /api/admin/users : 403 attendu, reçu 200 {"success":true,"users":[{"id":"f79be149-3591-4bef-80ba-1a345f138117","first_name":"Ndeye","last_name":"Administratrice","email":"parcours-pay-adm-supprime-3aaa66-887c322eb7@test.eventvillage.local","phon
not ok 3 - admin EN_ATTENTE (session valide) → 403 ACCOUNT_NOT_ACTIVE sur /api/admin/users, /api/admin/notifications et verifyAdminAuth
      error: EN_ATTENTE : GET /api/admin/users : 403 attendu, reçu 200 {"success":true,"users":[{"id":"da80079e-c84b-4d20-b870-3b73b3c32622","first_name":"Ndeye","last_name":"Administratrice","email":"parcours-pay-adm-en_attente-78f500-15ee7bfecd@test.eventvillage.local","
not ok 4 - admin SUSPENDU (session valide) → 403 ACCOUNT_NOT_ACTIVE sur /api/admin/users, /api/admin/notifications et verifyAdminAuth
      error: SUSPENDU : GET /api/admin/users : code ACCOUNT_NOT_ACTIVE attendu, reçu {"error":"Compte suspendu."}
not ok 1 - compte sans aucune ligne user_roles, users.role = ADMIN, permissions users.read et notifications.read → 403
      error: GET /api/admin/users avec users.role seul : HTTP 200 {"success":true,"users":[{"id":"5ccf08c1-c929-4e1e-befa-646c531b05be","first_name":"Khady","last_name":"Sansrole","email":"parcours-pay-sans-roles-3c01513dc6@test.eventvillage.local","phone":"+221772807688",
# … 5 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# crochet en échec :
not ok 5 - /home/runner/work/event-village/event-village/tests/parcours/securite-admin-lot7.test.ts
  schéma du lot 7 incomplet (securite-admin-lot7) : invariants (p)(q) impossibles à vérifier :
# tests 10
# pass 1
# fail 9
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/securite-admin-lot7.test.ts
ok 1 - témoin : admin ACTIF (users.read, notifications.read) → 200 sur /api/admin/users et /api/admin/notifications
ok 2 - admin SUPPRIME (session valide) → 403 ACCOUNT_NOT_ACTIVE sur /api/admin/users, /api/admin/notifications et verifyAdminAuth
ok 3 - admin EN_ATTENTE (session valide) → 403 ACCOUNT_NOT_ACTIVE sur /api/admin/users, /api/admin/notifications et verifyAdminAuth
ok 4 - admin SUSPENDU (session valide) → 403 ACCOUNT_NOT_ACTIVE sur /api/admin/users, /api/admin/notifications et verifyAdminAuth
ok 1 - compte sans aucune ligne user_roles, users.role = ADMIN, permissions users.read et notifications.read → 403
ok 1 - ADMIN à 3 permissions anonymisé par DELETE /api/admin/users : permissions et rôles admin retirés, ancien jeton refusé
# … 4 autre(s) sous-test(s) réussi(s)
# tests 10
# pass 10
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/parcours/course-annulation-transfert.test.ts
not ok 3 - 3. course au milieu de event_cancel (C tient les catégories, B annule, A accepte) : aucun interblocage, A refusé, billet à l’expéditeur
      error: interblocage (40P01) entre event_cancel et ticket_transfer_accept :
not ok 1 - 4. événement ANNULE puis SUSPENDU (transaction annulée) → EVENT_NOT_ACTIVE ; témoin PUBLIE → réclamation réussie
      error: ticket_transfer_claim sur un événement ANNULE : {"ok":true,"ticket_id":"4493db03-127a-4474-af21-36f8f0633a37","ticket_number":"TCK-20261104-63CC64CB1A","previous_owner":"0a13f1a3-601c-499a-a1c9-9aec90c95af0"}
# crochet en échec :
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/course-annulation-transfert.test.ts
  schéma du lot 7 incomplet (course-annulation-transfert) : invariants (p)(q) impossibles à vérifier :
# tests 4
# pass 2
# fail 2
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/course-annulation-transfert.test.ts
ok 1 - 1. A accepte sans COMMIT, B annule et attend ; après le COMMIT de A, le destinataire reçoit EVENT_CANCELLED, l’expéditeur non
ok 2 - 2. ordre inverse : B tient event_cancel sans COMMIT, A attend ; après le COMMIT de B, A est refusé et le porteur ne change pas
ok 3 - 3. course au milieu de event_cancel (C tient les catégories, B annule, A accepte) : aucun interblocage, A refusé, billet à l’expéditeur
ok 1 - 4. événement ANNULE puis SUSPENDU (transaction annulée) → EVENT_NOT_ACTIVE ; témoin PUBLIE → réclamation réussie
# tests 4
# pass 4
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/security/r24-categories-anon.test.ts
not ok 2 - transaction annulée : sans SELECT de anon sur public.users, anon lit encore les catégories publiques (aucune 42501)
      error: lecture des catégories par anon refusée (42501 permission denied for table users) : une politique de ticket_categories lit encore public.users
not ok 3 - aide ticket_category_private_read(p_event uuid) : présente, STABLE, SECURITY DEFINER, search_path = public, exécutable par anon et authenticated
      error: aide RLS public.ticket_category_private_read absente ou surchargée (0 définition(s)) — migration 20261105000003, contrat M3.1
not ok 4 - politiques de ticket_categories : aucune lecture de la table users ; read_public et admin_manage appellent l’aide ; admin_manage TO authenticated
      error: politiques de ticket_categories qui lisent encore la table users :
not ok 6 - aide ticket_category_private_read : vraie pour le propriétaire ACTIF, fausse pour anon et pour le propriétaire SUSPENDU (transaction annulée)
      error: appel de ticket_category_private_read impossible (42883 function public.ticket_category_private_read(uuid) does not exist) — migration 20261105000003, contrat M3.1
# tests 6
# pass 2
# fail 4
# cancelled 0
# run 84 (55afc8b, « après ») — tests/security/r24-categories-anon.test.ts
ok 1 - anon (clé anon seule) : catégories du publié visibles, aucune du brouillon
ok 2 - transaction annulée : sans SELECT de anon sur public.users, anon lit encore les catégories publiques (aucune 42501)
ok 3 - aide ticket_category_private_read(p_event uuid) : présente, STABLE, SECURITY DEFINER, search_path = public, exécutable par anon et authenticated
ok 4 - politiques de ticket_categories : aucune lecture de la table users ; read_public et admin_manage appellent l’aide ; admin_manage TO authenticated
ok 5 - propriétaire suspendu (transaction annulée, rôle authenticated) : aucune catégorie privée ; témoin ACTIF : catégories du brouillon lues
ok 6 - aide ticket_category_private_read : vraie pour le propriétaire ACTIF, fausse pour anon et pour le propriétaire SUSPENDU (transaction annulée)
# tests 6
# pass 6
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/schema/fonctions-privileges.test.ts
not ok 3 - groupe a : présentes, exécutables par anon et authenticated, en lecture seule, search_path fixé
      error: 'aide RLS ticket_category_private_read absente'
# tests 7
# pass 6
# fail 1
# cancelled 0
# run 84 (55afc8b, « après ») — tests/schema/fonctions-privileges.test.ts
ok 1 - aucune fonction hors liste blanche n'est exécutable par anon ou authenticated
ok 2 - aucune fonction SECURITY DEFINER n'est exécutable par anon sans être sur la liste blanche
ok 3 - groupe a : présentes, exécutables par anon et authenticated, en lecture seule, search_path fixé
ok 4 - toute fonction SECURITY DEFINER du projet a un search_path fixé
ok 5 - groupe b : toujours exécutables par service_role (parcours serveur)
ok 6 - validate_and_check_in_ticket est supprimée (inutilisée, composte sans vérifier l'appelant)
# … 1 autre(s) sous-test(s) réussi(s)
# tests 7
# pass 7
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/parcours/dette-suspendu-temps-reel.test.ts
# (suite verte au run 72)
# tests 6
# pass 6
# fail 0
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/dette-suspendu-temps-reel.test.ts
ok 1 - précondition : le partenaire actif abonné reçoit chacune des huit tables ; témoins abonnés
ok 2 - suspendu (PATCH /api/admin/partners/[id]/status) puis reconnecté : rien sur les huit tables, le témoin reçoit chaque changement
ok 3 - réactivé (SUSPENDU → VALIDE par la même route) : un nouveau client reçoit chacune des huit tables
ok 1 - suspendu puis reconnecté : aucun signal ; l’admin du seed les reçoit ; réactivé : un nouveau client les reçoit
ok 1 - suspendu puis reconnecté : aucune mise à jour de sa caisse ; l’admin la reçoit ; réactivé : un nouveau client la reçoit
ok 1 - chaque politique du tableau A1 lit users.status (ni SUSPENDU ni SUPPRIME) et s’adresse à authenticated
# tests 6
# pass 6
# fail 0
# cancelled 0
```

### 7.0 d — Preuves demandées au lot 6

**Code d'activation de l'invitation contrôleur.**
- Les cas 1 à 4 (haché, lié au numéro, limité en essais, expiré après 24 h) étaient déjà vrais au run 72 et sont écrits comme garde-fous.
- Deux défauts réels sont rouges au run 72 :
  - trois activations simultanées réussissent toutes ;
  - une nouvelle invitation d'un compte encore temporaire n'émet pas de nouveau code.
- **Correctif** `48dff36` (`app/api/controller/setup/route.ts`, `app/api/partner/team/invite/route.ts`) : le code est vérifié et consommé sous verrou en première étape. Conséquence : un échec ultérieur (GoTrue, compte déjà configuré) laisse le code consommé ; il faut alors une nouvelle invitation, qui émet un nouveau code tant que le compte est temporaire.

```text
# run 72 (51e0c70, « avant ») — tests/parcours/activation-controleur.test.ts
not ok 1 - trois activations simultanées avec le bon code : exactement une 200, puis tout rejeu refusé ; seul le mot de passe accepté ouvre la session
      error: activations simultanées : une seule 200 attendue (statuts 200, 200, 200 ; HTTP 200 {"success":true,"message":"Mot de passe défini. Vous pouvez maintenant vous connecter.","activation_notice":"QUEUED"} | HTTP 200 {"success":true,"message":"Mot de passe défini. 
not ok 2 - nouvelle invitation du même numéro (compte encore temporaire) : nouveau code par SMS, utilisable ; l’ancien est refusé
      error: seconde invitation d'un compte temporaire : un nouveau code par SMS attendu (reçu [])
# crochet en échec :
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/activation-controleur.test.ts
  schéma du lot 7 incomplet (activation-controleur) : invariants (p)(q) impossibles à vérifier :
# tests 6
# pass 4
# fail 2
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/activation-controleur.test.ts
ok 1 - stocké haché : code_hash = HMAC(numéro, code), 64 hexadécimaux ; aucune colonne ne contient le code
ok 2 - lié au numéro : le code de A présenté avec le numéro de B (invité) est refusé ; le code de A reste intact et active A
ok 3 - 5 mauvais essais puis le bon code : TOO_MANY_ATTEMPTS (429), compte non activé
ok 4 - expiré après 24 h : expires_at ≈ invitation + 24 h (± 2 min) ; reculé en base locale → refusé
ok 1 - trois activations simultanées avec le bon code : exactement une 200, puis tout rejeu refusé ; seul le mot de passe accepté ouvre la session
ok 2 - nouvelle invitation du même numéro (compte encore temporaire) : nouveau code par SMS, utilisable ; l’ancien est refusé
# tests 6
# pass 6
# fail 0
# cancelled 0
```

**Une commande de 4 billets : exactement 1 SMS d'achat et 1 seul J-1.** La suite était verte au run 72 : la règle existait déjà, et le test la fige. Elle n'était rouge qu'au niveau de son `after()`, faute du schéma du lot 7.

```text
# run 72 (51e0c70, « avant ») — tests/parcours/sms-commande-4-billets.test.ts
# crochet en échec :
not ok 2 - /home/runner/work/event-village/event-village/tests/parcours/sms-commande-4-billets.test.ts
  schéma du lot 7 incomplet (sms-commande-4-billets) : invariants (p)(q) impossibles à vérifier :
# tests 1
# pass 1
# fail 0
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/sms-commande-4-billets.test.ts
ok 1 - achat de 4 billets payés, envoyeur, J-1 planifié et envoyé deux fois : [confirmation « 4 billets », rappel J-1], une ligne SMS de chaque
# tests 1
# pass 1
# fail 0
# cancelled 0
```

**Couplage de `sms-anti-abus` et `notif-admins` par la ligne ADMIN_SMS_CAP_GLOBAL du jour réel :** supprimé, voir T2 et T9.

```text
# run 72 (51e0c70, « avant ») — tests/parcours/sms-anti-abus.test.ts
not ok 5 - inscription d’un numéro déjà inscrit : 409, aucun SMS
      error: "route de démarrage de l'inscription absente : app/api/auth/register/start/route.ts (contrat 3.6, fix(7.3s)) — Cannot find module '/home/runner/work/event-village/event-village/app/api/auth/register/start/route' imported from /home/runner/work/event-village/ev
# tests 9
# pass 8
# fail 1
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/sms-anti-abus.test.ts
ok 1 - rafale parallèle sur un même numéro : seuls les envois sous la limite partent
ok 2 - même IP, numéros différents : bloquée après la limite par IP
ok 3 - plafond global quotidien atteint : refus propre, alerte journalisée, aucun SMS
ok 4 - garde indisponible : refus 503 en fail-closed, aucun SMS
ok 5 - inscription d’un numéro déjà inscrit : 409, aucun SMS
ok 6 - hook SMS de Supabase Auth : un fragment du secret est refusé, aucun SMS
# … 3 autre(s) sous-test(s) réussi(s)
# tests 9
# pass 9
# fail 0
# cancelled 0
```

**SMS non identifiés de la fumée du lot 6.**
- Aux runs 71 et 72, la fumée imprimait « SMS du client depuis l'étape 8 : 5 ({"j1":1,"h3":0,"annulation":1}) ». Le rapport du lot 6 (section 6) parle de « deux autres SMS » non identifiés, mais 5 − 1 − 1 = **3**.
- Depuis D81, la fumée vide la boîte de E1 avant le repère et identifie chaque SMS par `provider_message_id`.

Au run 84 (`docs/lot7-logs/ci-run84-e2e.log:404-416` ; même liste, autres clés, au run 83 : `ci-run83-e2e.log:404-416`) :

```text
[e2e][fumée] boîte vidée avant le repère (événements f361de4a-7323-4254-9af6-33b5d75217a0) : {"claimed":19,"sent":9,"retried":0,"failed":0,"skipped":11,"uncertain":0,"cancelled":0,"waiting":0,"reclaimed":0,"rounds":1,"smsToday":171}
[FUMEE-SMS] avant le repère (boîte de E1 vidée) : 1 SMS
[FUMEE-SMS]   PURCHASE_CONFIRMED · E1 · clé PURCHASE_CONFIRMED:fb3ba126-ce39-469a-aa6a-ad4220c9ef0e:SMS · SENT · ticket e2a8bb09-cb38-4003-a382-c5eec5c97c53 · 2026-11-05T00:12:04.267Z
[e2e][fumée] planification à 2026-11-06T10:00:30.000Z : {"created":{"REMINDER_J1":4,"REMINDER_H3":0,"CONTROLLER_REMINDER":0},"events":1}
[e2e][fumée] envoyeur à 2026-11-06T10:01:30.000Z : {"claimed":22,"sent":11,"retried":0,"failed":0,"skipped":11,"uncertain":0,"cancelled":0,"waiting":0,"reclaimed":0,"rounds":1,"smsToday":4}
[e2e][fumée] planification à 2026-11-07T17:00:30.000Z : {"created":{"REMINDER_J1":0,"REMINDER_H3":3,"CONTROLLER_REMINDER":0},"events":1}
[e2e][fumée] GET /api/cron/notifications-dispatch → 200 {"ok":true,"claimed":11,"sent":5,"retried":0,"failed":0,"skipped":6,"uncertain":0,"cancelled":0,"waiting":0,"reclaimed":0,"rounds":1,"smsToday":173}
[e2e][fumée] SMS du client depuis l’étape 8 : 4 ({"j1":1,"h3":0,"annulation":1})
[FUMEE-SMS] depuis le repère de l’étape 8 : 4 SMS
[FUMEE-SMS]   PURCHASE_CONFIRMED · E2 · clé PURCHASE_CONFIRMED:b3b57da7-9295-48fb-9af3-e89079097b91:SMS · SENT · ticket 4320f106-d6b3-4ba1-a2b3-2d513cd79f26 · 2026-11-05T00:12:04.909Z
[FUMEE-SMS]   REMINDER_J1 · E2 · clé REMINDER_J1:9ca1a8fc-3081-4118-a220-847dbe7eb680:c2662792-905d-4fc8-ab53-421d13bbe6ac:20261107T2000Z:SMS · SENT · ticket e56edee5-5a19-4e16-83a3-db990fcf7de4 · 2026-11-05T00:12:04.913Z
[FUMEE-SMS]   REFUND_PAID · E2 · clé REFUND_PAID:f3cc64f7-b0b9-4613-93b9-ca1f5596355c:SMS · SENT · ticket 2e9db71c-6cb7-49db-ae0a-3cda4522324b · 2026-11-05T00:12:07.016Z
[FUMEE-SMS]   EVENT_CANCELLED · E2 · clé EVENT_CANCELLED:9ca1a8fc-3081-4118-a220-847dbe7eb680:c2662792-905d-4fc8-ab53-421d13bbe6ac:SMS · SENT · ticket 2dec5376-4eaf-4c16-8980-13b6d001ae39 · 2026-11-05T00:12:07.017Z
```

| Type | Événement | Clé (`idempotency_key`) | Destinataire | Statut | Avant D81 |
|---|---|---|---|---|---|
| PURCHASE_CONFIRMED | E1 | `PURCHASE_CONFIRMED:fb3ba126-…:SMS` | numéro du client de la fumée | SENT | compté après le repère (envoi tardif de E1) |
| PURCHASE_CONFIRMED | E2 | `PURCHASE_CONFIRMED:b3b57da7-…:SMS` | idem | SENT | non identifié |
| REMINDER_J1 | E2 | `REMINDER_J1:<événement>:<porteur>:20261107T2000Z:SMS` | idem | SENT | compté (« j1 ») |
| EVENT_CANCELLED | E2 | `EVENT_CANCELLED:<événement>:<porteur>:SMS` | idem | SENT | compté (« annulation ») |
| REFUND_PAID | E2 | `REFUND_PAID:f3cc64f7-…:SMS` | idem | SENT | non identifié |

Ce que ce tableau prouve et ne prouve pas :
- Les trois SMS non identifiés du lot 6 sont donc l'achat de E1, l'achat de E2 et le remboursement de E2. Aucun n'est un doublon : chaque clé est unique (contrainte `UNIQUE (idempotency_key)`), et l'étape 10 vérifie qu'aucune clé n'apparaît deux fois.
- La correspondance avec les runs du lot 6 est **déduite**, pas lue : à l'époque, la fumée n'imprimait pas les clés. Elle est cohérente avec le décompte (5 = 1 + 4).
- La longueur de ces SMS n'est pas imprimée par la fumée : **NON VÉRIFIÉE**. Les longueurs au pire cas sont prouvées par `confirmation-achat` et `notif-modeles` (section 12).

### 7.0 e — Application installable

**Grep d'origine.**

```text
$ git grep -n -E '"(id|scope|purpose)"' 6fff1bf -- public/manifest.json
(aucune ligne)
$ git grep -n -E '"(id|scope|purpose)"' aaf6542 -- public/manifest.json
aaf6542:public/manifest.json:2:  "id": "/",
aaf6542:public/manifest.json:9:  "scope": "/",
aaf6542:public/manifest.json:18:      "purpose": "any"
aaf6542:public/manifest.json:24:      "purpose": "any"
aaf6542:public/manifest.json:30:      "purpose": "maskable"
```

**Correctif.**
- `4472f3e` :
  - `public/manifest.json` ;
  - icônes `public/icons/icon-maskable-512.png` (512 × 512, RVB opaque) et `apple-touch-icon.png` (180 × 180), générées par `scripts/generate-pwa-icons.mjs` ;
  - `middleware.ts` : `/icons/`, `/billet/hors-ligne`, `/api/features` et les GET publics des salles et des restaurants.
- `da26267` : `app/layout.tsx`, avec `metadata.icons` ; les balises écrites à la main sont retirées.

**Preuve Chromium (D25).**
- La preuve combine trois éléments : `launchPersistentContext` sur le Chromium complet, `beforeinstallprompt`, et `Page.getInstallabilityErrors` vide.
- Un témoin négatif l'accompagne : un manifest servi sans icône doit faire signaler l'icône manquante. Le headless shell donne un faux positif, et ce témoin le rendrait rouge.
- Le test d'installabilité était déjà vert au run 72 avec l'ancien manifest. Ce sont les deux autres tests qui étaient rouges.

Run 72 (`ci-run72-e2e.log:553-558`) :

```text
[e2e][pwa] Page.getInstallabilityErrors : aucune
  ✓  1 [pwa] › e2e/installable.spec.ts:109:5 › Chromium reconnaît l’application installable (beforeinstallprompt, aucune erreur d’installabilité) (1.3s)
  ✓  2 [pwa] › e2e/installable.spec.ts:147:5 › témoin négatif : manifest servi sans icône → Chromium signale l’icône manquante (1.0s)
  ✘  3 [pwa] › e2e/installable.spec.ts:166:5 › manifest servi : id, scope, start_url, standalone, couleurs, icônes 192 et 512 dont une maskable (contrat 4.5) (241ms)
[e2e][pwa] <head> : {"appleIcons":["/icon-192x192.png","/icon-192x192.png"],"capable":["yes"],"title":["Event Village"],"manifests":["/manifest.json"]}
  ✘  4 [pwa] › e2e/installable.spec.ts:193:5 › iPhone : balises apple-mobile-web-app et icône apple-touch 180×180 dans le <head> de l’accueil (639ms)
```
```text
    Error: exactement un link[rel=apple-touch-icon] (trouvés : ["/icon-192x192.png","/icon-192x192.png"])
```

Run 84 (`ci-run84-e2e.log:567-576`) :

```text
[e2e][pwa] Page.getInstallabilityErrors : aucune
  ✓  1 [pwa] › e2e/installable.spec.ts:109:5 › Chromium reconnaît l’application installable (beforeinstallprompt, aucune erreur d’installabilité) (1.2s)
  ✓  2 [pwa] › e2e/installable.spec.ts:147:5 › témoin négatif : manifest servi sans icône → Chromium signale l’icône manquante (797ms)
  ✓  3 [pwa] › e2e/installable.spec.ts:166:5 › manifest servi : id, scope, start_url, standalone, couleurs, icônes 192 et 512 dont une maskable (contrat 4.5) (174ms)
[e2e][pwa] <head> : {"appleIcons":["/icons/apple-touch-icon.png"],"capable":["yes"],"title":["Event Village"],"manifests":["/manifest.json"]}
  ✓  4 [pwa] › e2e/installable.spec.ts:193:5 › iPhone : balises apple-mobile-web-app et icône apple-touch 180×180 dans le <head> de l’accueil (390ms)
[e2e] index des captures : .e2e-captures/captures/index.txt (286 entrée(s), 0 en échec)

  4 passed (3.1s)
[e2e] phase pwa : OK en 4s
```

```text
# run 72 (51e0c70, « avant ») — tests/parcours/pwa-manifest.test.ts
not ok 1 - JSON valide : id, scope, start_url dans scope, display standalone, name, short_name ≤ 12, lang, couleurs \#RRGGBB
      error: public/manifest.json :
not ok 2 - valeurs du contrat (D24) : id, scope et start_url « / », lang fr, dir ltr, fond clair \#F8F9FA, thème \#FF5722 gardé, raccourci « Billets hors ligne »
      error: public/manifest.json :
not ok 2 - une 192 et une 512 « any », une « maskable » sur une entrée séparée (/icons/icon-maskable-512.png, 512×512)
      error: icônes du manifest :
not ok 3 - icône maskable : PNG de type de couleur 2 (RVB, sans alpha ni tRNS), motif dans le cercle de sécurité de 409 px, fond uni autour
      error: 'fichier absent : public/icons/icon-maskable-512.png'
# … 10 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# crochet en échec :
not ok 5 - /home/runner/work/event-village/event-village/tests/parcours/pwa-manifest.test.ts
  schéma du lot 7 incomplet (pwa-manifest) : invariants (p)(q) impossibles à vérifier :
# tests 23
# pass 9
# fail 14
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/pwa-manifest.test.ts
ok 1 - JSON valide : id, scope, start_url dans scope, display standalone, name, short_name ≤ 12, lang, couleurs \#RRGGBB
ok 2 - valeurs du contrat (D24) : id, scope et start_url « / », lang fr, dir ltr, fond clair \#F8F9FA, thème \#FF5722 gardé, raccourci « Billets hors ligne »
ok 1 - chaque icône existe sous public/, est un PNG « image/png » dont les dimensions IHDR égalent « sizes »
ok 2 - une 192 et une 512 « any », une « maskable » sur une entrée séparée (/icons/icon-maskable-512.png, 512×512)
ok 3 - icône maskable : PNG de type de couleur 2 (RVB, sans alpha ni tRNS), motif dans le cercle de sécurité de 409 px, fond uni autour
ok 1 - public/icons/apple-touch-icon.png : PNG 180×180 opaque
# … 17 autre(s) sous-test(s) réussi(s)
# tests 23
# pass 23
# fail 0
# cancelled 0
```

**iPhone.**
- Le test vérifie dans le `<head>` les balises `apple-mobile-web-app-capable` et `apple-mobile-web-app-title`, et une seule icône `apple-touch-icon` de 180 × 180.
- La marche à suivre de l'utilisateur est écrite dans `docs/installer-application.md`, section 2 : Safari, puis Partager, puis « Sur l'écran d'accueil ». Il faut ensuite toujours ouvrir l'application depuis l'icône, et se reconnecter une fois.
- Le document signale aussi trois comportements de Safari : stockage séparé entre Safari et l'application installée, effacement possible après 7 jours sans visite, push seulement dans l'application installée.
- Depuis `55afc8b`, `docs/installer-application.md` exige aussi l'adresse officielle en `https://` : sur une adresse non sécurisée, ni installation, ni billet hors ligne, ni caméra.
- **Aucun test automatisé n'est possible sur iOS** (point ouvert).

### 7.0 f — Restes d'interface du lot 6

**Correctif.** `eaeb60d` :
- `LoginForm` : `reset`, `session_expired`, `unauthorized_controller`, `already_configured`, et le `redirect` vers l'inscription ;
- `NotificationBell` : « Tout marquer comme lu » sur sa ligne (D68) ;
- `ImageUpload` : titre non cliquable, `aria-labelledby` ;
- `AppLayoutHeader` supprimé ;
- réglages : les deux clés, et la section « Fonctionnalités » ;
- supervision : carte « SMS optionnels aujourd'hui » ;
- `TransferExplainerModal`, `partner/register`, `controller/setup`, `admin/communications`, `partner/profile`, `controller/profile` migrés ;
- `PATCH /api/partner/profile` (D72).

`notification_channel_enum` est supprimé par la migration 03. `docs/architecture.md` est mis à jour par `34b631e`. Au run 76, `dette-interface-lot7` échouait encore sur « docs/architecture.md cite des fichiers supprimés » ; c'est corrigé avant le run 77.

```text
# run 72 (51e0c70, « avant ») — tests/parcours/dette-interface-lot7.test.ts
not ok 1 - LoginForm : ?reset=success → « Mot de passe modifié : connectez-vous avec le nouveau. »
      error: "components/auth/LoginForm.tsx : aucun message « Mot de passe modifié : connectez-vous avec le nouveau. » associé au code « success » (propriété « success: '…' » ou branche dont la condition contient 'success')"
not ok 2 - LoginForm : ?error=session_expired → « Le lien a expiré : demandez un nouveau code. »
      error: "components/auth/LoginForm.tsx : aucun message « Le lien a expiré : demandez un nouveau code. » associé au code « session_expired » (propriété « session_expired: '…' » ou branche dont la condition contient 'session_expired')"
not ok 3 - LoginForm : ?error=unauthorized_controller → « Accès réservé aux contrôleurs. »
      error: "components/auth/LoginForm.tsx : aucun message « Accès réservé aux contrôleurs. » associé au code « unauthorized_controller » (propriété « unauthorized_controller: '…' » ou branche dont la condition contient 'unauthorized_controller')"
not ok 4 - LoginForm : ?message=already_configured → « Ce compte est déjà activé : connectez-vous. »
      error: "components/auth/LoginForm.tsx : aucun message « Ce compte est déjà activé : connectez-vous. » associé au code « already_configured » (propriété « already_configured: '…' » ou branche dont la condition contient 'already_configured')"
# … 15 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# crochet en échec :
not ok 11 - /home/runner/work/event-village/event-village/tests/parcours/dette-interface-lot7.test.ts
  schéma du lot 7 incomplet (dette-interface-lot7) : invariants (p)(q) impossibles à vérifier :
# tests 22
# pass 3
# fail 19
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/dette-interface-lot7.test.ts
ok 1 - LoginForm : ?reset=success → « Mot de passe modifié : connectez-vous avec le nouveau. »
ok 2 - LoginForm : ?error=session_expired → « Le lien a expiré : demandez un nouveau code. »
ok 3 - LoginForm : ?error=unauthorized_controller → « Accès réservé aux contrôleurs. »
ok 4 - LoginForm : ?message=already_configured → « Ce compte est déjà activé : connectez-vous. »
ok 5 - app/login/page.tsx lit searchParams.reset et le transmet à <LoginForm>, qui le reçoit en prop
ok 6 - D61 : le lien « Créer un compte » mène à /register?redirect=<destination encodée>
# … 16 autre(s) sous-test(s) réussi(s)
# tests 22
# pass 22
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/notifications-and-documents.test.ts
# (suite verte au run 72)
# tests 5
# pass 5
# fail 0
# cancelled 0
# run 84 (55afc8b, « après ») — tests/notifications-and-documents.test.ts
# tests 5
# pass 5
# fail 0
# cancelled 0
```

**Écarts tranchés.**
- **Activation du contrôleur.** La section 4.6 du contrat voulait une page serveur, la section 12 interdisait tout nouveau `.tsx`. E1 a fait une page client qui reçoit `searchParams`, ce qu'accepte le test.
- **Alertes du lot 7 et temps réel.** `notif-interface.test.ts:957-961` fige le filtre temps réel de la page Notifications à `NOTIFICATION_FAILED,SMS_DAILY_THRESHOLD`. Les nouvelles alertes `SMS_OPTIONAL_80` et `SMS_FORECAST` ne rechargent donc pas cette page en direct (point ouvert).

### Dette : incident de production de la migration 05 du lot 6 (03-04/11)

**Chronologie.** Sources : mémoire du projet (`project_supabase_prod.md`, `project_lot6_etat.md`) et messages de commit.
1. **03/11** : l'utilisateur lance `db push --linked` sur le projet de production sans attendre le run vert du lot 6.
2. Les migrations `20261103000001` à `…04` sont enregistrées.
3. La migration `…05` échoue en `42P01` au bloc de reprise J1.9. Elle était pourtant déjà appliquée en partie :
   - `events.notify_version` présente ;
   - table `event_change_notifications` supprimée ;
   - migration non enregistrée.
4. Les migrations `…06` à `…08` ne sont pas appliquées.
5. **04/11, 01:37 UTC** :
   - `afb0edb` (test(6.7)) : la migration 05 rejouable après une application partielle, et les migrations 06 à 08 rejouables, en transaction annulée sur la base locale ;
   - `6fff1bf` (fix(6.7)) : la reprise J1.9 ne s'exécute que si `event_change_notifications` existe encore (bloc `DO`), ce qui rend la migration rejouable.
6. Run 68 (`5ed2bee`, rapport du lot 6) annulé, remplacé par la poussée de ces deux commits. Run 69 (`6fff1bf`, `lot6/notifications`) vert : verify 153/153, captures 172/172, fumée.
7. **04/11, 01:43 UTC** : `main` avancé en avance rapide `fff03b1..6fff1bf`, à la demande de l'utilisateur.
8. Les migrations 05 à 08 ont ensuite été appliquées en production **par l'utilisateur**. C'est la note de l'orchestrateur ; je n'ai aucun journal de cette application, donc **NON VÉRIFIÉ** par moi.
9. Run 70 (`6fff1bf` sur `main`) : verify 152/153, `acces-tracabilite` 4.9 en échec (test fragile). Run 71 (même commit, sur `lot7/terrain`) : 153/153 et e2e vert.

**Cause.** Une migration non transactionnelle dans les faits : le `db push` a appliqué une partie de la migration 05 avant d'échouer, sans enregistrer la version. Le rejeu tombait alors sur une table déjà supprimée.

**Règle retenue au lot 7.**
- Les migrations `20261103…` sont **gelées** : `migration-lot7-rejouable` contrôle le SHA-256 (fins de ligne LF) des 8 fichiers. Ce bloc est vert aux runs 72 à 83.
- Les nouvelles migrations sont préfixées `20261105…`. Aucune ne contient `BEGIN` ni `COMMIT`, et chacune est testée deux fois de suite en transaction annulée.
- La procédure de déploiement exige un `db push --dry-run` qui liste exactement les 7 fichiers ; sinon on s'arrête, sans `--include-all` ni `repair` (`docs/deploiement-projet-neuf.md`, section 3 bis).

```text
# run 72 (51e0c70, « avant ») — tests/schema/migration-lot7-rejouable.test.ts
not ok 1 - les migrations 20261105… du dépôt sont exactement les sept du contrat, dans cet ordre
      error: migrations 20261105… présentes : aucune
not ok 2 - 20261105000001_lot7_reglages.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
      error: 'migration du lot 7 absente : supabase/migrations/20261105000001_lot7_reglages.sql (contrat, section 2)'
not ok 3 - 20261105000002_lot7_sms.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
      error: 'migration du lot 7 absente : supabase/migrations/20261105000002_lot7_sms.sql (contrat, section 2)'
not ok 4 - 20261105000003_lot7_securite.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
      error: 'migration du lot 7 absente : supabase/migrations/20261105000003_lot7_securite.sql (contrat, section 2)'
# … 4 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# crochet en échec :
not ok 3 - /home/runner/work/event-village/event-village/tests/schema/migration-lot7-rejouable.test.ts
  schéma du lot 7 incomplet (migration-lot7-rejouable) : invariants (p)(q) impossibles à vérifier :
# tests 16
# pass 8
# fail 8
# cancelled 0
# run 84 (55afc8b, « après ») — tests/schema/migration-lot7-rejouable.test.ts
ok 1 - les migrations 20261105… du dépôt sont exactement les sept du contrat, dans cet ordre
ok 2 - 20261105000001_lot7_reglages.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
ok 3 - 20261105000002_lot7_sms.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
ok 4 - 20261105000003_lot7_securite.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
ok 5 - 20261105000004_lot7_billet_hors_ligne.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
ok 6 - 20261105000005_lot7_scan.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
# … 10 autre(s) sous-test(s) réussi(s)
# tests 16
# pass 16
# fail 0
# cancelled 0
```

### 7.1 s — Billet hors ligne, serveur

**Correctif.** `0930728` :
- migration `20261105000004_lot7_billet_hors_ligne.sql`, qui contient :
  - l'historique `ticket_secret_versions`, avec une reprise BACKFILL ;
  - trois triggers de rotation sur `tickets` (changement de porteur, sortie de VALIDE sauf vers UTILISE, changement du secret) ;
  - le journal `ticket_offline_downloads`, sans aucun code ;
  - les fonctions `ticket_secret_rotate`, `ticket_offline_window`, `ticket_offline_grant` et `ticket_offline_info` ;
- `lib/security/totp.ts` (`generateTicketCodes`) ;
- `lib/tickets/offline-codes.service.ts` ;
- les routes `app/api/tickets/[id]/offline-codes/route.ts`, `app/api/tickets/route.ts` (champ `offline`) et `live-code` (`server_time`) ;
- `lib/env.ts` (3 quotas).

Ce que fait la route :
- elle ne lit aucun paramètre de requête ni en-tête d'heure ;
- elle renvoie `Cache-Control: no-store` ;
- elle n'envoie jamais `totp_secret` au navigateur, seulement les codes ;
- quotas par billet (12 par heure) et par compte (60 par heure).

Le refus d'un ancien code est `qr_expired` (D3 ★), sauf billet ou événement annulé ou remboursé : statut contrôlé avant la version.

```text
# run 72 (51e0c70, « avant ») — tests/parcours/hors-ligne-codes.test.ts
not ok 1 - 1. 401 sans session ; 403 compte SUSPENDU ; 404 même corps pour le billet d’un autre, un UUID inconnu et un id non UUID
      error: "route des codes hors ligne absente : app/api/tickets/[id]/offline-codes/route.ts (contrat 3.1, fix(7.1s)) — Cannot find module '/home/runner/work/event-village/event-village/app/api/tickets/[id]/offline-codes/route' imported from /home/runner/work/event-villa
not ok 2 - 2. 409 TICKET_NOT_VALID (UTILISE, ANNULE), EVENT_NOT_PUBLISHED (SUSPENDU, TERMINE), TRANSFER_PENDING
      error: "route des codes hors ligne absente : app/api/tickets/[id]/offline-codes/route.ts (contrat 3.1, fix(7.1s)) — Cannot find module '/home/runner/work/event-village/event-village/app/api/tickets/[id]/offline-codes/route' imported from /home/runner/work/event-villa
not ok 1 - 3. début dans 23,9 h → 200 ; dans 24,1 h → 409 OFFLINE_WINDOW_CLOSED avec available_from ; fin passée, after = 0 → 409 (témoin after = 6 : 200)
      error: "route des codes hors ligne absente : app/api/tickets/[id]/offline-codes/route.ts (contrat 3.1, fix(7.1s)) — Cannot find module '/home/runner/work/event-village/event-village/app/api/tickets/[id]/offline-codes/route' imported from /home/runner/work/event-villa
not ok 2 - 4. bornes à la seconde (ticket_offline_grant, p.now) : début − 24 h − 1 s refusé, début − 24 h admis, fin + after admis, + 1 s refusé ; now passé → INVALID_NOW
      error: ticket_offline_grant (contrat M4.7, fix(7.1s)) : PGRST202 Could not find the function public.ticket_offline_grant(p) in the schema cache
# … 8 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# crochet en échec :
not ok 6 - /home/runner/work/event-village/event-village/tests/parcours/hors-ligne-codes.test.ts
  schéma du lot 7 incomplet (hors-ligne-codes) : invariants (p)(q) impossibles à vérifier :
# tests 12
# pass 0
# fail 12
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/hors-ligne-codes.test.ts
ok 1 - 1. 401 sans session ; 403 compte SUSPENDU ; 404 même corps pour le billet d’un autre, un UUID inconnu et un id non UUID
ok 2 - 2. 409 TICKET_NOT_VALID (UTILISE, ANNULE), EVENT_NOT_PUBLISHED (SUSPENDU, TERMINE), TRANSFER_PENDING
ok 1 - 3. début dans 23,9 h → 200 ; dans 24,1 h → 409 OFFLINE_WINDOW_CLOSED avec available_from ; fin passée, after = 0 → 409 (témoin after = 6 : 200)
ok 2 - 4. bornes à la seconde (ticket_offline_grant, p.now) : début − 24 h − 1 s refusé, début − 24 h admis, fin + after admis, + 1 s refusé ; now passé → INVALID_NOW
ok 1 - 5. format compact, champs dérivés, 30 codes au hasard égaux au code calculé ; le code courant est accepté au scan
ok 2 - 6. aucun secret dans la réponse ; Cache-Control: no-store
# … 6 autre(s) sous-test(s) réussi(s)
# tests 12
# pass 12
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/parcours/hors-ligne-rotation.test.ts
not ok 1 - 1. lot téléchargé puis transfert accepté : code courant de l’ancien lot → qr_expired, billet non composté, historique TRANSFER ; lot du nouveau porteur accepté
      error: "route des codes hors ligne absente : app/api/tickets/[id]/offline-codes/route.ts (contrat 3.1, fix(7.1s)) — Cannot find module '/home/runner/work/event-village/event-village/app/api/tickets/[id]/offline-codes/route' imported from /home/runner/work/event-villa
not ok 2 - 2. lot téléchargé puis event_cancel : ancien code → event_cancelled, version + 1 (CANCEL)
      error: "route des codes hors ligne absente : app/api/tickets/[id]/offline-codes/route.ts (contrat 3.1, fix(7.1s)) — Cannot find module '/home/runner/work/event-village/event-village/app/api/tickets/[id]/offline-codes/route' imported from /home/runner/work/event-villa
not ok 3 - 3. lot téléchargé puis ticket_refund_request (billet payé) : ancien code → refunded, version + 1 (REFUND)
      error: "route des codes hors ligne absente : app/api/tickets/[id]/offline-codes/route.ts (contrat 3.1, fix(7.1s)) — Cannot find module '/home/runner/work/event-village/event-village/app/api/tickets/[id]/offline-codes/route' imported from /home/runner/work/event-villa
not ok 4 - 4. lot téléchargé puis ticket_secret_rotate : ancien code → qr_expired, version + 1 (REGENERATE), nouveau lot accepté
      error: "route des codes hors ligne absente : app/api/tickets/[id]/offline-codes/route.ts (contrat 3.1, fix(7.1s)) — Cannot find module '/home/runner/work/event-village/event-village/app/api/tickets/[id]/offline-codes/route' imported from /home/runner/work/event-villa
# … 6 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# crochet en échec :
not ok 5 - /home/runner/work/event-village/event-village/tests/parcours/hors-ligne-rotation.test.ts
  schéma du lot 7 incomplet (hors-ligne-rotation) : invariants (p)(q) impossibles à vérifier :
# tests 11
# pass 1
# fail 10
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/hors-ligne-rotation.test.ts
ok 1 - 1. lot téléchargé puis transfert accepté : code courant de l’ancien lot → qr_expired, billet non composté, historique TRANSFER ; lot du nouveau porteur accepté
ok 2 - 2. lot téléchargé puis event_cancel : ancien code → event_cancelled, version + 1 (CANCEL)
ok 3 - 3. lot téléchargé puis ticket_refund_request (billet payé) : ancien code → refunded, version + 1 (REFUND)
ok 4 - 4. lot téléchargé puis ticket_secret_rotate : ancien code → qr_expired, version + 1 (REGENERATE), nouveau lot accepté
ok 5 - 4 bis. ticket_secret_rotate : billet inconnu → TICKET_NOT_FOUND ; billet non VALIDE → TICKET_NOT_VALID, version inchangée
ok 1 - 5. totp_ok = true avec secret_version ancienne → qr_expired ; sans secret_version → qr_expired ; témoin : version courante → valid
# … 5 autre(s) sous-test(s) réussi(s)
# tests 11
# pass 11
# fail 0
# cancelled 0
```

Extrait rouge du cas 6, la course de la version du secret au scan (`ci-run72-verify.log`, suite `hors-ligne-rotation`) :

```text
    not ok 1 - 6. A tient ticket_transfer_accept ; le scan d’un code de l’ancienne version attend le verrou du billet ; après le COMMIT de A → qr_expired, billet non composté
      error: |-
        code de la version 1 vérifié par la route avant la rotation, billet en version 2 sous le verrou : HTTP 200 {"result":"valid",…,"message":"Entrée validée"} (violation de (p) si a
        + actual - expected
        + 'valid'
        - 'qr_expired'
```

Run 84 : `ok 1 - 6. A tient ticket_transfer_accept ; le scan d’un code de l’ancienne version attend le verrou du billet ; après le COMMIT de A → qr_expired, billet non composté`.

### 7.1 e — Billet hors ligne, écran et service worker

**Correctif.** `da26267`.
- **Nouveaux fichiers :**
  - `app/billet/hors-ligne/page.tsx` : page publique et statique, alimentée par IndexedDB (D26) ;
  - `components/tickets/offline/OfflineTicketView.tsx`, `OfflineStatusBadge.tsx`, `components/tickets/OfflineTicketsSync.tsx` ;
  - `lib/tickets/offline-clock.ts` et `offline-store.ts`.
- **Modifiés :** `public/sw.js`, `app/layout.tsx`, `app/tickets/page.tsx`, `TicketCard`, `TransferModal` et `AuthProvider`. AuthProvider purge le stockage à la déconnexion et au changement de compte.
- **Reprise en vague F** (`abc6c7a`) : la synchronisation est chargée à la demande par `AuthProvider`, pour un compte CLIENT seulement.

```text
# run 72 (51e0c70, « avant ») — tests/parcours/hors-ligne-client.test.ts
not ok 1 - offsetFromFetch(serverTime, t0, t1) = serverTime − milieu de l’aller-retour
      error: "module de l’horloge hors ligne (contrat 5.2, D34, fix(7.1e)) absent : lib/tickets/offline-clock — Cannot find module '/home/runner/work/event-village/event-village/lib/tickets/offline-clock' imported from /home/runner/work/event-village/event-village/tests/pa
not ok 2 - téléphone en avance ou en retard de 5 min : le code affiché est celui de l’heure du serveur
      error: "module de l’horloge hors ligne (contrat 5.2, D34, fix(7.1e)) absent : lib/tickets/offline-clock — Cannot find module '/home/runner/work/event-village/event-village/lib/tickets/offline-clock' imported from /home/runner/work/event-village/event-village/tests/pa
not ok 3 - écart de ±20 s appliqué ; le code change à chaque frontière de pas de l’heure du serveur
      error: "module de l’horloge hors ligne (contrat 5.2, D34, fix(7.1e)) absent : lib/tickets/offline-clock — Cannot find module '/home/runner/work/event-village/event-village/lib/tickets/offline-clock' imported from /home/runner/work/event-village/event-village/tests/pa
not ok 4 - avant scan_opens_at → not_yet ; à partir de valid_until → expired ; jamais de code hors du lot
      error: "module de l’horloge hors ligne (contrat 5.2, D34, fix(7.1e)) absent : lib/tickets/offline-clock — Cannot find module '/home/runner/work/event-village/event-village/lib/tickets/offline-clock' imported from /home/runner/work/event-village/event-village/tests/pa
# … 6 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# crochet en échec :
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/hors-ligne-client.test.ts
  schéma du lot 7 incomplet (hors-ligne-client) : invariants (p)(q) impossibles à vérifier :
# tests 10
# pass 0
# fail 10
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/hors-ligne-client.test.ts
ok 1 - offsetFromFetch(serverTime, t0, t1) = serverTime − milieu de l’aller-retour
ok 2 - téléphone en avance ou en retard de 5 min : le code affiché est celui de l’heure du serveur
ok 3 - écart de ±20 s appliqué ; le code change à chaque frontière de pas de l’heure du serveur
ok 4 - avant scan_opens_at → not_yet ; à partir de valid_until → expired ; jamais de code hors du lot
ok 5 - horloge reculée sous downloadedAtDevice − 60 s → clock_changed ; à − 59 s, encore un code
ok 6 - needsDownload : absent, autre version, expiré, incomplet à moins de 24 h → vrai ; à jour → faux
# … 4 autre(s) sous-test(s) réussi(s)
# tests 10
# pass 10
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/parcours/hors-ligne-service-worker.test.ts
not ok 1 - aucune interception : API, POST, requêtes RSC et de préchargement, autres pages connectées, autre origine
      error: un écouteur fetch (liste blanche du contrat 5.3)
not ok 2 - navigation /billet/hors-ligne?id=… servie depuis le cache (réseau qui répond autre chose, puis réseau coupé)
      error: précondition : cache rempli à l’installation
not ok 3 - navigation /tickets ou / : réseau coupé → 302 vers /billet/hors-ligne ; réseau en service → réponse du réseau, rien en cache ; réponse préchargée utilisée
      error: précondition : cache rempli à l’installation
not ok 4 - ressource statique et ressource publique en cache : servies depuis le cache, sans réseau
      error: précondition : cache rempli à l’installation
# … 7 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# crochet en échec :
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/hors-ligne-service-worker.test.ts
  schéma du lot 7 incomplet (hors-ligne-service-worker) : invariants (p)(q) impossibles à vérifier :
# tests 11
# pass 0
# fail 11
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/hors-ligne-service-worker.test.ts
ok 1 - aucune interception : API, POST, requêtes RSC et de préchargement, autres pages connectées, autre origine
ok 2 - navigation /billet/hors-ligne?id=… servie depuis le cache (réseau qui répond autre chose, puis réseau coupé)
ok 3 - navigation /tickets ou / : réseau coupé → 302 vers /billet/hors-ligne ; réseau en service → réponse du réseau, rien en cache ; réponse préchargée utilisée
ok 4 - ressource statique et ressource publique en cache : servies depuis le cache, sans réseau
ok 5 - complément : /_next/static/ demandé par l’onglet de /billet/hors-ligne et absent du cache → ajouté ; par un autre onglet → pas ajouté
ok 1 - installation : skipWaiting, coquille sans cookie, cache ev-hors-ligne-lot7-1 = coquille + ressources découvertes + PUBLIC_ASSETS
# … 5 autre(s) sous-test(s) réussi(s)
# tests 11
# pass 11
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/parcours/push-service-worker.test.ts
not ok 1 - écouteurs install, activate, fetch (liste blanche du lot 7), push, notificationclick, pushsubscriptionchange ; aucun importScripts ; l’API n’est jamais interceptée
      error: écouteur fetch
# tests 17
# pass 16
# fail 1
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/push-service-worker.test.ts
ok 1 - écouteurs install, activate, fetch (liste blanche du lot 7), push, notificationclick, pushsubscriptionchange ; aucun importScripts ; l’API n’est jamais interceptée
ok 2 - install : skipWaiting, installation qui ne rejette jamais ; activate : supprime les seuls caches event-village-* puis clients.claim()
ok 3 - push JSON valide : showNotification(titre, { body, tag, data.url, icon, badge }) exact
ok 4 - push illisible ou sans charge : notification générique (titre, texte, /notifications, tag event-village)
ok 5 - notificationclick : lien interne ouvert dans une nouvelle fenêtre quand aucun onglet n’est ouvert ; notification fermée
ok 6 - notificationclick : lien externe, //hôte, javascript: ou absent → /notifications
# … 11 autre(s) sous-test(s) réussi(s)
# tests 17
# pass 17
# fail 0
# cancelled 0
```

**E2E, terrain 1 et 2 au run 84.**
- Le téléphone a 5 min d'avance (ou de retard), le client est hors ligne, et le contrôleur, sans horloge simulée, obtient `valid`.
- Le cache ne contient que la coquille, `/_next/static/` et les icônes, soit 29 entrées. Les anciens caches sont supprimés.

```text
[e2e][terrain] écart +5 min : événement 1cc3ccb0-5456-48d3-bb3d-8b9be9cad191 (début 2026-11-05T20:15:00.000Z), 1 billet(s) gratuit(s) de client, access.scan_window_before_hours 6 → 24
[e2e][terrain] access.scan_window_before_hours remis à 6
  ✓  1 [terrain] › e2e/terrain.spec.ts:112:9 › 1. téléphone en avance de 5 min : codes téléchargés, hors ligne, QR accepté par le contrôleur (3.4s)
[e2e][terrain] écart -5 min : événement 0f795266-9967-4375-a0b9-3bca664b4bce (début 2026-11-05T20:15:00.000Z), 1 billet(s) gratuit(s) de client, access.scan_window_before_hours 6 → 24
[e2e][terrain] access.scan_window_before_hours remis à 6
  ✓  2 [terrain] › e2e/terrain.spec.ts:112:9 › 1. téléphone en retard de 5 min : codes téléchargés, hors ligne, QR accepté par le contrôleur (3.3s)
[e2e][terrain] cache sans api : événement 10fe1680-9610-4727-855e-0a275e09f9fa (début 2026-11-05T20:15:00.000Z), 1 billet(s) gratuit(s) de client, access.scan_window_before_hours 6 → 24
[e2e][terrain] cache ev-hors-ligne-lot7-1 : 29 entrée(s)
http://localhost:3000/billet/hors-ligne
http://localhost:3000/_next/static/media/be6419ffe34f1ed7-s.p.woff2
http://localhost:3000/_next/static/css/79eb573b6b27f06a.css
http://localhost:3000/_next/static/css/2d868e641af26ece.css
http://localhost:3000/_next/static/chunks/webpack-27f0a6e23d7ced1d.js
```
```text
http://localhost:3000/icons/apple-touch-icon.png
[e2e][terrain] access.scan_window_before_hours remis à 6
  ✓  3 [terrain] › e2e/terrain.spec.ts:147:5 › 2. cache du service worker : coquille hors ligne et ressources statiques seulement, anciens caches supprimés (2.1s)
```

**Fumée, étapes 11 à 16 au run 84.** Achat de 2 billets la veille. Lot de 5 410 codes (5 400 au run 83). Hors ligne, page servie par le service worker, et le QR change au bout d'environ 21 s réelles. Scan accepté. Transfert, puis l'ancien code (version 1) est refusé.

```text
[e2e][terrain] fumee prolongee : événement 717355fd-4756-427c-b38a-3c0e706d5f25 (début 2026-11-05T20:15:00.000Z), 0 billet(s) gratuit(s) de client, access.scan_window_before_hours 6 → 24
[e2e][fumée] lot hors ligne du billet TCK-20261105-6A350EF97B : version 1, 5410 codes de 20 s à partir du pas 89691875
[e2e][fumée] numéro du second client marqué vérifié (2026-11-05T00:12:21.529Z)
[e2e][fumée] ancien code du billet TCK-20261105-6A350EF97B (version 1, pas 89691877) présenté au contrôleur
[e2e][terrain] access.scan_window_before_hours remis à 6
```

**Écart signalé.** Aux runs 83 et 84, l'étape 16 laisse deux lignes « erreurs observées dans le navigateur » : un `fetch` de `/api/tickets/<id>/offline-codes` en `ERR_INTERNET_DISCONNECTED` (lignes 433 à 435 au run 84). Elles correspondent, selon le contrat 11.4 (étape 16 : « hors ligne, fetch(…/offline-codes) rejeté »), au contrôle volontaire de cette étape. **SUPPOSÉ** : je n'ai pas relu l'étape dans le code de la fumée. La fumée est verte.

### 7.2 s — Scan, serveur

**Correctif.** `ef4c07f`.
- Migration `20261105000005_lot7_scan.sql` :
  - colonnes `ticket_scans.secret_version` et `client_key`, avec un index unique par scanneur ;
  - `scan_log` à 11 paramètres ;
  - `ticket_scan` recopiée : verrou consultatif par clé, rejeu qui rend le verdict d'origine, version contrôlée sous le verrou du billet après le statut d'annulation, QR sans version refusé (D32) ;
  - `ticket_cash_checkin` : rejeu du même scanneur, `CASH_QR_OUTDATED` ;
  - nouvelles fonctions `controller_scan_stats`, `ticket_manual_lookup` et `counter_sale_quote`.
- Routes `scan` (clé obligatoire), `scan/lookup`, `scans`, `counter-sale` (GET) et `counter-sale/quote`, `assignments` (« Arrivées » sans coupure à minuit UTC), `shifts/active`.

```text
# run 72 (51e0c70, « avant ») — tests/parcours/scan-idempotence.test.ts
not ok 1 - sans en-tête, clé trop courte (« a »), clé de 101 caractères ou à caractères interdits → 400 IDEMPOTENCY_KEY_REQUIRED, aucun effet
      error: en-tête absent : 400 attendu, HTTP 200 {"result":"valid","ticket":{"id":"265b720c-c65e-483f-a17d-f084a6e07679","price":0,"holder":"Mariama Porteuse","category":"Entrée","ticket_number":"TCK-HL-6E88A8B1C7DD","is_manual_entry":false},"scan_id":"8bf9dad8-6948-43b
not ok 1 - même clé deux fois (réponse perdue) : second `valid`, `replayed: true`, même scan_id, une seule ligne, aucune ligne already_used
      error: premier envoi : replayed = false (contrat 3.3), HTTP 200 {"result":"valid","ticket":{"id":"a4e6d38b-e0b6-4391-bd5c-52bcc671a1c0","price":0,"holder":"Mariama Porteuse","category":"Entrée","ticket_number":"TCK-HL-D18405AD75C2","is_manual_entry":false},"scan_id":
not ok 2 - même clé après expiration du code : verdict d’origine (valid, replayed), aucune nouvelle ligne
      error: rejeu avec un code expiré : verdict d’origine valid (pas qr_expired), HTTP 200 {"result":"qr_expired","ticket":{"id":"bc4c35f8-e409-4541-9376-d033618de3b8","price":0,"holder":"Mariama Porteuse","category":"Entrée","ticket_number":"TCK-HL-567F8853EF05","is_manu
not ok 3 - deux envois simultanés de la même clé : une seule ligne, réponses identiques (valid, même scan_id)
      error: envoi B : valid (rejeu de la ligne gagnante, pas already_used), HTTP 200 {"result":"already_used","ticket":{"id":"5c8a8b7d-5d64-4985-b21f-dd4462b100a6","price":0,"holder":"Mariama Porteuse","category":"Entrée","checked_in_at":"2026-11-04T06:26:59.333521+00:00"
# … 4 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# crochet en échec :
not ok 6 - /home/runner/work/event-village/event-village/tests/parcours/scan-idempotence.test.ts
  schéma du lot 7 incomplet (scan-idempotence) : invariants (p)(q) impossibles à vérifier :
# tests 9
# pass 1
# fail 8
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/scan-idempotence.test.ts
ok 1 - sans en-tête, clé trop courte (« a »), clé de 101 caractères ou à caractères interdits → 400 IDEMPOTENCY_KEY_REQUIRED, aucun effet
ok 1 - même clé deux fois (réponse perdue) : second `valid`, `replayed: true`, même scan_id, une seule ligne, aucune ligne already_used
ok 2 - même clé après expiration du code : verdict d’origine (valid, replayed), aucune nouvelle ligne
ok 3 - deux envois simultanés de la même clé : une seule ligne, réponses identiques (valid, même scan_id)
ok 4 - clés différentes, même code : valid puis already_used avec ticket.checked_in_by_me = true et checked_in_at
ok 5 - même clé, autre scanneur : nouveau scan (already_used, pas un rejeu, checked_in_by_me = false), ligne du second scanneur avec la clé
# … 3 autre(s) sous-test(s) réussi(s)
# tests 9
# pass 9
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/parcours/scan-controleur-stats.test.ts
not ok 1 - porte nommée : door_entries = entrées acceptées de la porte A (2 contrôleurs), my_entries, my_refusals, refus ventilés, « Porte A »
      error: "GET /api/controller/scans (contrat 3.3, fix(7.2s)) absente (../../app/api/controller/scans/route) : Cannot find module '/home/runner/work/event-village/event-village/app/api/controller/scans/route' imported from /home/runner/work/event-village/event-village/t
not ok 2 - recent : scans du contrôleur seulement, le plus récent d’abord, avec résultat, libellé, méthode, numéro et catégorie, sans nom de porteur
      error: "GET /api/controller/scans (contrat 3.3, fix(7.2s)) absente (../../app/api/controller/scans/route) : Cannot find module '/home/runner/work/event-village/event-village/app/api/controller/scans/route' imported from /home/runner/work/event-village/event-village/t
not ok 3 - sans point d’entrée : « Vos entrées », door_entries = entrées du contrôleur seul ; billet inconnu compté comme refus
      error: "GET /api/controller/scans (contrat 3.3, fix(7.2s)) absente (../../app/api/controller/scans/route) : Cannot find module '/home/runner/work/event-village/event-village/app/api/controller/scans/route' imported from /home/runner/work/event-village/event-village/t
not ok 4 - recent : 20 lignes au plus (22 scans du contrôleur), les 20 plus récentes
      error: "GET /api/controller/scans (contrat 3.3, fix(7.2s)) absente (../../app/api/controller/scans/route) : Cannot find module '/home/runner/work/event-village/event-village/app/api/controller/scans/route' imported from /home/runner/work/event-village/event-village/t
# … 8 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# crochet en échec :
not ok 6 - /home/runner/work/event-village/event-village/tests/parcours/scan-controleur-stats.test.ts
  schéma du lot 7 incomplet (scan-controleur-stats) : invariants (p)(q) impossibles à vérifier :
# tests 12
# pass 0
# fail 12
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/scan-controleur-stats.test.ts
ok 1 - porte nommée : door_entries = entrées acceptées de la porte A (2 contrôleurs), my_entries, my_refusals, refus ventilés, « Porte A »
ok 2 - recent : scans du contrôleur seulement, le plus récent d’abord, avec résultat, libellé, méthode, numéro et catégorie, sans nom de porteur
ok 3 - sans point d’entrée : « Vos entrées », door_entries = entrées du contrôleur seul ; billet inconnu compté comme refus
ok 4 - recent : 20 lignes au plus (22 scans du contrôleur), les 20 plus récentes
ok 5 - contrôleur non affecté à l’événement (ou affecté à un autre) → 404 sans donnée
ok 1 - entry_point et counter_sale_enabled de l’affectation ; entrée de la veille à 23 h 50 comptée dans les arrivées
# … 6 autre(s) sous-test(s) réussi(s)
# tests 12
# pass 12
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/parcours/acces-encaissement.test.ts
not ok 1 - commande de 3 billets à régler sur place : cash_required au prix du billet, encaissement billet par billet, commande SUCCESS au dernier
      error: rejeu par le même scanneur : 200 (jamais 409, D40) : HTTP 409 {"code":"CASH_ALREADY_PROCESSED","result":"already_used","message":"Billet déjà utilisé"}
# tests 12
# pass 11
# fail 1
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/acces-encaissement.test.ts
ok 1 - commande de 3 billets à régler sur place : cash_required au prix du billet, encaissement billet par billet, commande SUCCESS au dernier
ok 2 - commande de 2 billets VIP : un seul réglé → paid_amount = prix d’un billet, commande toujours impayée
ok 3 - commande payée entre le scan et l’encaissement : refus CASH_ALREADY_PAID, rien n’est composté ni encaissé
ok 4 - sans caisse ouverte : refus CASH_NO_OPEN_SHIFT pour le contrôleur, le partenaire propriétaire et l’admin, billet non composté
ok 5 - ouverture de caisse : partenaire propriétaire et admin ouvrent et encaissent ; contrôleur sans permission espèces refusé
ok 6 - scan d’un autre scanneur ou de plus de 5 minutes : refusé, billet non composté ; un scan frais du même scanneur passe
# … 6 autre(s) sous-test(s) réussi(s)
# tests 12
# pass 12
# fail 0
# cancelled 0
```

### 7.2 e — Scanner, écran

**Greps d'origine.**

```text
$ git grep -n -E "AudioContext|new Audio|wolof" 6fff1bf -- components/scan lib/hardware app/controller app/partner/scan   (8 premières lignes)
6fff1bf:app/controller/scanner/page.tsx:7: *    incidents techniques (carte neutre, ni voix wolof, ni compteur de refus).
6fff1bf:app/controller/scanner/page.tsx:37:    combatTypeFor, confirmCashCheckin, isTechnicalOutcome, isTicketRefusal, postScan, titleFor, wolofTypeFor,
6fff1bf:app/controller/scanner/page.tsx:45:import { playWolofAudio, repeatLastWolofAudio, stopWolofAudio, isWolofMuted, toggleWolofMuted } from '@/lib/hardware/
6fff1bf:app/controller/scanner/page.tsx:132:        const wolof = feedback ? wolofTypeFor(feedback) : null;
6fff1bf:app/controller/scanner/page.tsx:133:        await repeatLastWolofAudio('wolof', wolof ?? undefined);
6fff1bf:app/controller/scanner/page.tsx:240:        const wolof = wolofTypeFor(outcome);
6fff1bf:app/controller/scanner/page.tsx:241:        if (wolof) {
6fff1bf:app/controller/scanner/page.tsx:242:            playWolofAudio(wolof).catch((err: unknown) => console.warn('[scanner] voix wolof indisponible', err inst
$ git grep -n -E "AudioContext|new Audio|wolof" aaf6542 -- components/scan lib/hardware app/controller app/partner/scan
aaf6542:app/controller/scanner/page.tsx:260:            window.localStorage.removeItem('event_village_wolof_muted');
aaf6542:components/scan/ScanResultPanel.tsx:8: * Lot 7 (D52) : aucun son, plus de bouton « Répéter en wolof ».
aaf6542:lib/hardware/feedback.ts:4: * Aucun son : l'audio du scanner (voix wolof, oscillateurs) est supprimé par décision du client (D52).
```

**Correctif.** `e8668d5`.
- **Écran du contrôleur :** `app/controller/scanner/page.tsx`, avec `app/controller/layout.tsx` en sombre forcé (D45). Les composants touchés :
  - `CameraQrScanner`, `CombatFlashOverlay` (plein écran par catégorie), `scan-client.ts` (clé et relances 4, 6 puis 8 s), `ManualEntryForm` (deux temps), `ScanResultPanel`, `ScannerShiftBanner` ;
  - les nouveaux `ScanStatusBar`, `ScanHistoryList`, `CounterSalePanel` et `ScannerStartScreen` ;
  - `ShiftModals`, migré au système de design.
- **Retour au toucher et vibrations :** `lib/hardware/feedback.ts`, avec les vibrations de D50.
- **Partenaire :** `app/partner/scan/page.tsx`.
- **Styles :** jetons `--scan-*` et `--op-*` dans `app/globals.css` ; `.ev-page-enter` en transform seul (D78).
- **Audio supprimé :** `lib/hardware/wolof-audio.ts` et les 6 MP3 de `public/sounds/`.

**Défaut A6 : boucle de détection orpheline (lot 6).** Le défaut a été trouvé par la mesure « avant ».
- Chaque changement d'`isVerifying` recréait la chaîne `onScan` → `startCameraStream`, et un démarrage asynchrone encore en attente lançait une seconde boucle.
- Cette boucle gardait `isVerifying = true` et avalait chaque lecture en silence (`app/controller/scanner/page.tsx:271-272` à `6fff1bf`).
- Correctif : un jeton d'annulation par démarrage, un numéro par boucle, et `onScan` lu par une ref. Une lecture écartée est désormais écrite en console.

Preuves avant (run 73, `e2e.log:457`, et run 74, `e2e.log:464`) :

```text
    Error: normal : billet déjà utilisé TCK-20261104-C5D9F72821 : aucun résultat de scan affiché ([data-scan-result]) après la lecture (45 s) — sonde : readAt +2246 ms, lectures 18, dernière lecture +45011 ms, POST —, pendingAt —, résultat — « — », retiré — ; POST /api/controller/scan depuis la présentation : aucun ; écran : en veille non, vidéo en lecture oui, data-scan-result [], data-scan-state [] ; vibrations [[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80]]
```
```text
    Error: normal : billet neuf TCK-20261104-B270DBE4CA : aucun résultat de scan affiché ([data-scan-result]) après la lecture (45 s) — sonde : readAt +2344 ms, lectures 19, dernière lecture +47545 ms, POST —, pendingAt —, résultat — « — », retiré — ; POST /api/controller/scan depuis la présentation : aucun ; écran : en veille non, vidéo en lecture oui, data-scan-result [], data-scan-state [] ; vibrations [[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80],[80]]
```

Après (runs 83 et 84) :

```text
[SCAN-MESURE] lectures ignorées par l'écran (QR relu au moins une fois avant l'envoi) : 0 sur 30
```

**Défaut du décodeur ZXing (run 80).**
- Au run 80, la fumée échoue à l'étape 5 : le partenaire présente un QR valide, et aucune lecture n'a lieu en 40 s.
- Elle était verte aux runs 77 et 78 : l'échec est intermittent.

```text
  ✘  1 [fumee] › e2e/fumee.spec.ts:290:5 › fumée : créer, soumettre, valider, publier, acheter, scanner, piloter (50.3s)
[e2e] index des captures : .e2e-captures/captures/index.txt (286 entrée(s), 0 en échec)


  1) [fumee] › e2e/fumee.spec.ts:290:5 › fumée : créer, soumettre, valider, publier, acheter, scanner, piloter › 5. le partenaire propriétaire scanne le billet (caméra simulée) 

    Error: expect(locator).toBeVisible() failed

    Locator: getByText('Entrée validée').first()
    Expected: visible
    Timeout: 40000ms
    Error: element(s) not found

    Call log:
```

**Diagnostic de l'agent R3.** Preuves dans `scratchpad/r3scan/`, rapport résumé dans le message de `20378e3`.
- ZXing 0.23, utilisé quand `BarcodeDetector` est absent (Safari iPhone, Firefox, Chrome ordinateur), échoue sur 31 QR de billet valides sur 402 dans le navigateur ; jsQR 1.4.0 sur aucun.
- Extrait de `scratchpad/r3scan/batch2-jsqr.log`, lignes 1 à 3 :

```text
jsQR par image 640×480 (ms) : {"payload":"__jsqr_ms","median":40,"p95":101.70000004768372}
échecs sur 402 QR : {"app":31,"jsqr":0,"tryHarder":31,"global":24,"crop60":32,"scale075":29,"scale05":47,"crop60s075":27}
échecs restants — app+crop60 : 31 ; app+scale075 : 21 ; app+global : 22 ; app+crop60+scale075 : 21 ; app+global+crop60+scale075 : 19 ; toutes : 0 ; app+jsqr : 0 ; jsqr seul : 0
```

- Les 31 payloads en échec, écrits ensuite dans le journal, contiennent des codes de billets de test ; ils ne sont pas recopiés ici.
- « Même échec en 0.21 et 0.22 » vient du message du commit : je ne l'ai pas revérifié.
- Ces mesures ont été faites hors CI, sur le poste, avec les fichiers de `scratchpad/r3scan/`.

**Correctif** `20378e3` : `CameraQrScanner` fait alterner ZXing et jsQR 1.4.0 (version exacte, Apache-2.0, chargé à la demande), une image sur deux, et expose le décodeur actif dans `data-scan-decoder`. La fumée est verte aux runs 83 et 84. Le décodeur qui a lu le QR à l'étape 5 n'est pas imprimé : **NON VÉRIFIÉ**. Effet sur le poids : le JavaScript chargé à + 3 s caméra lancée passe de 396,1 Ko (run 80) à 446,8 Ko (run 83), soit + 50,7 Ko, puis 450,8 Ko au run 84. Cet écart mêle jsQR et la reprise de session (`4f6499d`), committés entre ces deux runs ; la part de chacun n'est pas mesurée (NON VÉRIFIÉ). Ce JavaScript est chargé à la demande et n'entre pas dans le budget post-build de la route (section 8).

```text
# run 72 (51e0c70, « avant ») — tests/parcours/scanner-interface.test.ts
not ok 1 - aucun Audio, AudioContext, webkitAudioContext, HTMLAudioElement, synthèse vocale, balise <audio> ni fichier audio cité
      error: son encore présent dans l’espace contrôleur :
not ok 2 - public/sounds et lib/hardware/wolof-audio.ts supprimés ; aucun fichier audio sous public/
      error: public/sounds doit être supprimé (6 fichiers .mp3 du lot 4)
not ok 3 - plus aucun appel du module audio ni bouton de son ; la préférence event_village_wolof_muted est retirée au démarrage du scanner
      error: restes de l’audio :
not ok 1 - les six paires --scan-<x>-fg / --scan-<x>-bg existent et chacune atteint 7:1
      error: 'jetons --scan-accept-bg et --scan-accept-fg attendus dans app/globals.css (trouvés : aucun)'
# … 17 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# crochet en échec :
not ok 9 - /home/runner/work/event-village/event-village/tests/parcours/scanner-interface.test.ts
  schéma du lot 7 incomplet (scanner-interface) : invariants (p)(q) impossibles à vérifier :
# tests 21
# pass 0
# fail 21
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/scanner-interface.test.ts
ok 1 - aucun Audio, AudioContext, webkitAudioContext, HTMLAudioElement, synthèse vocale, balise <audio> ni fichier audio cité
ok 2 - public/sounds et lib/hardware/wolof-audio.ts supprimés ; aucun fichier audio sous public/
ok 3 - plus aucun appel du module audio ni bouton de son ; la préférence event_village_wolof_muted est retirée au démarrage du scanner
ok 1 - les six paires --scan-<x>-fg / --scan-<x>-bg existent et chacune atteint 7:1
ok 2 - chaque jeton --scan-* a la même valeur partout (clair et sombre)
ok 3 - CombatFlashOverlay n’utilise que les jetons du scanner : ni palette brute, ni flou, ni ombre portée, ni zoom, ni rebond, ni texte atténué
# … 15 autre(s) sous-test(s) réussi(s)
# tests 21
# pass 21
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/scanner-combat-ui.test.ts
not ok 3 - 2.1 Succès (Validé) : vibration courte [60], aucun son, flash plein écran sur le jeton scan-accept
      error: Signature haptique succès exacte [60]
not ok 4 - 3.1 Rejet (Billet Utilisé / Faux) : vibration [120, 60, 120, 60, 120] distincte du succès, flash scan-used / scan-refuse
      error: Signature haptique rejet exacte [120, 60, 120, 60, 120]
not ok 5 - 4.1 QR expiré (refus, scan-refuse) et hors fenêtre (attention [250, 100, 250], scan-window)
      error: Signature haptique attention [250, 100, 250]
not ok 6 - 5.1 Résilience fail-safe : aucun crash sans navigator.vibrate ; aucune vibration pour un incident technique ; aucun son exporté
      error: Incident technique : aucune vibration
# tests 6
# pass 2
# fail 4
# cancelled 0
# run 84 (55afc8b, « après ») — tests/scanner-combat-ui.test.ts
ok 1 - 1.1 Contrôle Torche : allumage et extinction via MediaStreamTrack.applyConstraints
ok 2 - 1.2 Contrôle Torche : fallback gracieux sans crash si non supporté ou erreur matérielle
ok 3 - 2.1 Succès (Validé) : vibration courte [60], aucun son, flash plein écran sur le jeton scan-accept
ok 4 - 3.1 Rejet (Billet Utilisé / Faux) : vibration [120, 60, 120, 60, 120] distincte du succès, flash scan-used / scan-refuse
ok 5 - 4.1 QR expiré (refus, scan-refuse) et hors fenêtre (attention [250, 100, 250], scan-window)
ok 6 - 5.1 Résilience fail-safe : aucun crash sans navigator.vibrate ; aucune vibration pour un incident technique ; aucun son exporté
# tests 6
# pass 6
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/parcours/acces-tracabilite.test.ts
# (suite verte au run 72)
# tests 8
# pass 8
# fail 0
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/acces-tracabilite.test.ts
ok 1 - une ligne par tentative (acceptée ou refusée), complète, sans payload en clair ; scan_id = ligne du journal
ok 2 - colonnes du contrat ; journal illisible par un compte connecté (service_role seul)
ok 1 - type ScanResult = exactement l’union du contrat
ok 1 - SCAN_PER_SCANNER_10S déclaré dans .env.test.example ; rafale au-delà → 429 rate_limited
ok 1 - le statut HTTP de la réponse est lu ; 401 renvoie vers la connexion
ok 2 - erreurs techniques traitées à part : jamais « invalide » par défaut, aucun son de rejet, ni compteur de refus
# … 2 autre(s) sous-test(s) réussi(s)
# tests 8
# pass 8
# fail 0
# cancelled 0
```

**E2E terrain 3 à 6 au run 84.**
- Idempotence : une réponse perdue est relancée avec la même clé, et il n'y a qu'une entrée.
- Mesure du scan (section 8).
- Vibrations distinctes.
- Caméra arrêtée en arrière-plan.

```text
[e2e][terrain] idempotence : événement 196962bc-1346-4323-ad10-be612ab1207a (début 2026-11-05T20:15:00.000Z), 1 billet(s) gratuit(s) de client-bis, access.scan_window_before_hours 6 → 24
[e2e][terrain] 3. réponse du scan perdue : relance automatique avec la même clé, une seule entrée — observations du navigateur (non bloquantes) :
fumee-controleur : erreur de console : Failed to load resource: net::ERR_TIMED_OUT (http://localhost:3000/api/controller/scan)
fumee-controleur : requête en échec : POST localhost:3000/api/controller/scan : net::ERR_TIMED_OUT
[e2e][terrain] access.scan_window_before_hours remis à 6
  ✓  4 [terrain] › e2e/terrain.spec.ts:212:5 › 3. réponse du scan perdue : relance automatique avec la même clé, une seule entrée (2.2s)
```
```text
[e2e][terrain] vibrations : événement f5ca760f-91d1-477d-adbb-ff3a735e1360 (début 2026-11-05T20:15:00.000Z), 2 billet(s) gratuit(s) de client-bis, access.scan_window_before_hours 6 → 24
[e2e][terrain] vibrations reçues pour l'accepté (lectures : 1) : [[60]]
[e2e][terrain] vibrations reçues pour le refus (lectures : 1) : [[120,60,120,60,120]]
[e2e][terrain] access.scan_window_before_hours remis à 6
  ✓  6 [terrain] › e2e/terrain.spec.ts:461:5 › 5. vibrations : accepté [60], refusé [120,60,120,60,120], motifs distincts, aucune vibration à la lecture (3.2s)
[e2e][terrain] camera en arriere-plan : événement c1d7f0cc-093c-43c9-9f68-f566032fd155 (début 2026-11-05T20:15:00.000Z), 1 billet(s) gratuit(s) de client-bis, access.scan_window_before_hours 6 → 24
[e2e][terrain] access.scan_window_before_hours remis à 6
  ✓  7 [terrain] › e2e/terrain.spec.ts:499:5 › 6. onglet en arrière-plan : pistes de la caméra arrêtées (1.2s)
```

Au run 74, avant correctif, l'ancien écran vibrait 80 ms à chaque lecture, puis selon l'ancien motif :

```text
[e2e][terrain] vibrations reçues pour l'accepté (lectures : 1) : [[80],[100,50,100]]
[e2e][terrain] vibrations reçues pour le refus (lectures : 1) : [[80],[100,50,100,50,100]]
```

### 7.2 — Reprise de session du contrôleur (A10, demande de l'utilisateur du 04/11)

**Demande.**
- Quand le contrôleur quitte l'application et revient, rien de la session ne doit être perdu : l'utilisateur constatait que « les données sont parties ».
- Cela vaut sur `/controller/scanner` et `/partner/scan`, après un retour d'arrière-plan, une navigation aller-retour, un rechargement, ou la fermeture puis la réouverture de l'application installée.

**Correctif.** `4f6499d`.
- Nouveaux fichiers : `lib/scan/scan-session.ts` et `lib/scan/scan-memory.ts`.
- Modifiés : les deux écrans de scan, `CameraQrScanner`, `CombatFlashOverlay`, `ScanResultPanel`, `AuthProvider`, `app/controller/layout.tsx`, `middleware.ts` et le guide de l'organisateur.

Ce qui est conservé au retour :
1. **Même événement, même mode, même onglet.** Mémoire locale par compte, avec une empreinte FNV et aucun identifiant ni donnée personnelle. Elle dure 24 h. La reprise n'a lieu que si l'événement est encore ouvert au contrôle ; sinon s'affiche « Contrôle précédent non repris ». La mémoire est effacée à la déconnexion.
2. **Compteur de porte et derniers scans**, relus sur le serveur au montage, à `visibilitychange`, à `pageshow` et au retour du réseau.
3. **Scan en cours** au moment de la sortie : il est renvoyé au retour avec la même clé d'idempotence, dans les 2 min. L'écran affiche « Résultat retrouvé », et il n'y a aucune double entrée.
4. **Caisse ouverte**, relue.
5. **Caméra** coupée en arrière-plan, puis « Reprendre le contrôle » au retour, sans redémarrage d'office.

Décision : aucun état dans l'URL. Coût : `ManualEntryForm` chargé à la demande, environ + 1,4 Ko sur le scanner. Point ouvert, lot 8 : un mode « renvoi seulement » côté serveur.

```text
# run 72 (51e0c70) : tests/parcours/scanner-reprise.test.ts absente (suite ajoutée après le run « avant »)
# run 84 (55afc8b, « après ») — tests/parcours/scanner-reprise.test.ts
ok 1 - clé par compte, sans identifiant de compte en clair ; deux comptes ne se mélangent pas ; surfaces distinctes
ok 2 - valeur écrite : identifiants et choix d’écran seulement (aucune donnée personnelle)
ok 3 - oubliée après 24 h sans usage ; valeur hors format effacée
ok 1 - enregistré, relu, puis effacé seulement par sa propre clé
ok 2 - saisie manuelle : numéro et pièce vérifiée gardés ; requête incomplète refusée
ok 3 - plus de 2 minutes : oublié sans renvoi, rendu comme « expiré » (l’écran le dit)
# … 19 autre(s) sous-test(s) réussi(s)
# tests 25
# pass 25
# fail 0
# cancelled 0
```

E2E terrain 7 au run 84 (`ci-run84-e2e.log:548-557`). Les `ERR_TIMED_OUT` sont provoqués par le test, qui simule un scan resté sans réponse :

```text
[e2e][terrain] reprise de session : événement ff8f2ebb-c951-42fe-8f16-cba423905232 (début 2026-11-05T20:15:00.000Z), 4 billet(s) gratuit(s) de client-bis, access.scan_window_before_hours 6 → 24
[e2e][terrain] 7. reprise de session : même événement et même mode après une sortie, chiffres et historique relus, « Reprendre le contrôle », scan sans réponse renvoyé avec sa clé — observations du navigateur (non bloquantes) :
fumee-controleur : erreur de console : Failed to load resource: net::ERR_TIMED_OUT (http://localhost:3000/api/controller/scan)
fumee-controleur : erreur de console : Failed to load resource: net::ERR_TIMED_OUT (http://localhost:3000/api/controller/scan)
fumee-controleur : erreur de console : Failed to load resource: net::ERR_TIMED_OUT (http://localhost:3000/api/controller/scan)
fumee-controleur : requête en échec : POST localhost:3000/api/controller/scan : net::ERR_TIMED_OUT
fumee-controleur : requête en échec : POST localhost:3000/api/controller/scan : net::ERR_TIMED_OUT
fumee-controleur : requête en échec : POST localhost:3000/api/controller/scan : net::ERR_TIMED_OUT
[e2e][terrain] access.scan_window_before_hours remis à 6
  ✓  8 [terrain] › e2e/terrain.spec.ts:608:5 › 7. reprise de session : même événement et même mode après une sortie, chiffres et historique relus, « Reprendre le contrôle », scan sans réponse renvoyé avec sa clé (7.7s)
```

Le scénario de test au téléphone est en section 13.

### 7.3 s — Parcours client, serveur

**Greps d'origine.**

```text
$ git grep -n "userId" 6fff1bf -- app/api/orders/route.ts
6fff1bf:app/api/orders/route.ts:16:        let userId: string | null = null;
6fff1bf:app/api/orders/route.ts:19:            userId = user?.id || null;
6fff1bf:app/api/orders/route.ts:23:        const queryUserId = searchParams.get('userId');
6fff1bf:app/api/orders/route.ts:24:        const effectiveUserId = userId || queryUserId;
$ git grep -n "userId" aaf6542 -- app/api/orders/route.ts
aaf6542:app/api/orders/route.ts:13: * navigateur) ; un paramètre ?userId= est ignoré (faille IDOR corrigée). Interrupteurs (D55, D56) : session
$ git show 6fff1bf:app/api/auth/register/route.ts   (lignes 85 à 121, extraits)
85:        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
120:                status: 'ACTIF',
$ git grep -n -E "verifyStoredOtp|phone_verified_at" aaf6542 -- app/api/auth/register/route.ts
aaf6542:app/api/auth/register/route.ts:135:        const check = await verifyStoredOtp(phone, code, 'REGISTER');
aaf6542:app/api/auth/register/route.ts:176:            phone_verified_at: new Date().toISOString(),
```

**Correctif.** `64f87dd`.
- Migration `20261105000006_lot7_client.sql` : garde `PAYMENT_PENDING` sous verrou consultatif dans `checkout_create_payment` ; politiques d'insertion REST des réservations et commandes supprimées (D10).
- Interrupteurs `features.*` : `lib/features/flags.ts` et `client.ts`, `GET /api/features`, 8 layouts de garde, et la garde dans chaque route de l'inventaire.
- `GET /api/orders` corrigé (IDOR).
- Paiement : `checkout.service.ts`, `GET /api/checkout/pending`, annulation vérifiée chez SamirPay, champs de statut.
- Inscription en deux routes (D1).

Contrôles du code sur la route d'inscription :
- 429 dès le 5ᵉ mauvais code, comme `otp_check` (le contrat ne citait que le 6ᵉ) ;
- le quota `otp_verify_phone` s'applique ;
- un code qui n'a pas 6 chiffres reçoit 400, sans essai consommé.

```text
# run 72 (51e0c70, « avant ») — tests/parcours/interrupteurs.test.ts
not ok 1 - trois clés à false par défaut
      error: 'réglage features.halls_enabled absent de platform_settings (clés du lot 7 : migration 20261105000001, contrat M1)'
not ok 2 - finance_setting_set : SUPERADMIN accepté, ADMIN FORBIDDEN, valeur non booléenne INVALID_VALUE (valeur inchangée)
      error: 'réglage features.halls_enabled absent de platform_settings (clés du lot 7 : migration 20261105000001, contrat M1)'
not ok 1 - sans session : les trois valeurs, Cache-Control no-store ; la bascule est lue à la requête suivante
      error: "module absent : app/api/features/route.ts (contrat 3.4, fix(7.3s)) — Cannot find module '/home/runner/work/event-village/event-village/app/api/features/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts"
not ok 2 - lib/features/flags : getFeatureFlags() lit les trois clés, featureNotFound() renvoie le 404 du contrat
      error: "lib/features/flags.ts absent (contrat 3.4, fix(7.3s)) — Cannot find module '/home/runner/work/event-village/event-village/lib/features/flags' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts"
# … 13 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# crochet en échec :
not ok 7 - /home/runner/work/event-village/event-village/tests/parcours/interrupteurs.test.ts
  schéma du lot 7 incomplet (interrupteurs) : invariants (p)(q) impossibles à vérifier :
# tests 18
# pass 1
# fail 17
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/interrupteurs.test.ts
ok 1 - trois clés à false par défaut
ok 2 - finance_setting_set : SUPERADMIN accepté, ADMIN FORBIDDEN, valeur non booléenne INVALID_VALUE (valeur inchangée)
ok 1 - sans session : les trois valeurs, Cache-Control no-store ; la bascule est lue à la requête suivante
ok 2 - lib/features/flags : getFeatureFlags() lit les trois clés, featureNotFound() renvoie le 404 du contrat
ok 1 - GET publics des services sans session → 404 NOT_FOUND (interrupteur d'abord)
ok 2 - POST /api/halls/reserve : 401 sans session, 403 suspendu, 404 compte actif, aucune ligne créée
# … 12 autre(s) sous-test(s) réussi(s)
# tests 18
# pass 18
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/parcours/paiement-attente-lot7.test.ts
not ok 1 - autre clé pendant un PENDING → 409 PAYMENT_PENDING ; autre événement → 200 ; après échéance → 200 ; même clé → doublon
      error: second paiement (autre clé, autre opérateur) : HTTP 200 {"payment_id":"2321f7be-9ebe-43c2-9cbf-d57623aadf09","status":"PENDING","amount":3150,"facial_amount":3000,"service_fee":150,"currency":"XOF","operator":"ORANGE_MONEY","expires_at":"2026-11-04T06:40:34.41
not ok 2 - deux checkouts simultanés (clés différentes) → un seul PENDING, l'autre 409 PAYMENT_PENDING
      error: réponses : HTTP 200 {"payment_id":"eea33484-1011-442f-99a1-03d8cf8eb1e4","status":"PENDING","amount":3150,"facial_amount":3000,"service_fee":150,"currency":"XOF","operator":"WAVE","expires_at":"2026-11-04T06:40:34.548954+00:00","payment_url":"http://127.0.0.1:
not ok 1 - SamirPay dit SUCCESS : 409 PAYMENT_ALREADY_CONFIRMED, paiement confirmé, billets émis
      error: annulation d'un paiement payé : HTTP 200 {"payment_id":"de4416f1-3194-4a8f-8fef-75fb654e4803","status":"CANCELLED"}
not ok 2 - SamirPay injoignable : 503 PROVIDER_UNAVAILABLE, rien n'est annulé
      error: SamirPay injoignable : HTTP 200 {"payment_id":"eaf06d2a-8f46-4da8-bd43-eb115a0c8361","status":"CANCELLED"}
# … 4 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# crochet en échec :
not ok 5 - /home/runner/work/event-village/event-village/tests/parcours/paiement-attente-lot7.test.ts
  schéma du lot 7 incomplet (paiement-attente-lot7) : invariants (p)(q) impossibles à vérifier :
# tests 9
# pass 1
# fail 8
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/paiement-attente-lot7.test.ts
ok 1 - autre clé pendant un PENDING → 409 PAYMENT_PENDING ; autre événement → 200 ; après échéance → 200 ; même clé → doublon
ok 2 - deux checkouts simultanés (clés différentes) → un seul PENDING, l'autre 409 PAYMENT_PENDING
ok 1 - SamirPay dit SUCCESS : 409 PAYMENT_ALREADY_CONFIRMED, paiement confirmé, billets émis
ok 2 - SamirPay injoignable : 503 PROVIDER_UNAVAILABLE, rien n'est annulé
ok 3 - SamirPay dit PENDING : SamirPay interrogé, puis annulation (200 CANCELLED, réservation libérée)
ok 4 - succès tardif d'un paiement annulé : billets émis (D4, comportement conservé)
# … 3 autre(s) sous-test(s) réussi(s)
# tests 9
# pass 9
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/parcours/inscription-numero-dabord.test.ts
not ok 1 - start : réponse du contrat, aucun compte, une ligne otp_codes REGISTER hachée, un seul SMS
      error: "route de démarrage de l'inscription absente : app/api/auth/register/start/route.ts (contrat 3.6, fix(7.3s)) — Cannot find module '/home/runner/work/event-village/event-village/app/api/auth/register/start/route' imported from /home/runner/work/event-village/ev
not ok 2 - numéro déjà inscrit → 409 PHONE_ALREADY_REGISTERED, aucun SMS, aucun code
      error: "route de démarrage de l'inscription absente : app/api/auth/register/start/route.ts (contrat 3.6, fix(7.3s)) — Cannot find module '/home/runner/work/event-village/event-village/app/api/auth/register/start/route' imported from /home/runner/work/event-village/ev
not ok 3 - numéro invalide → 400 INVALID_PHONE
      error: "route de démarrage de l'inscription absente : app/api/auth/register/start/route.ts (contrat 3.6, fix(7.3s)) — Cannot find module '/home/runner/work/event-village/event-village/app/api/auth/register/start/route' imported from /home/runner/work/event-village/ev
not ok 1 - sans code → 400 REGISTRATION_CODE_REQUIRED, aucun compte
      error: "route de démarrage de l'inscription absente : app/api/auth/register/start/route.ts (contrat 3.6, fix(7.3s)) — Cannot find module '/home/runner/work/event-village/event-village/app/api/auth/register/start/route' imported from /home/runner/work/event-village/ev
# … 8 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# crochet en échec :
not ok 6 - /home/runner/work/event-village/event-village/tests/parcours/inscription-numero-dabord.test.ts
  schéma du lot 7 incomplet (inscription-numero-dabord) : invariants (p)(q) impossibles à vérifier :
# tests 12
# pass 0
# fail 12
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/inscription-numero-dabord.test.ts
ok 1 - start : réponse du contrat, aucun compte, une ligne otp_codes REGISTER hachée, un seul SMS
ok 2 - numéro déjà inscrit → 409 PHONE_ALREADY_REGISTERED, aucun SMS, aucun code
ok 3 - numéro invalide → 400 INVALID_PHONE
ok 1 - sans code → 400 REGISTRATION_CODE_REQUIRED, aucun compte
ok 2 - mauvais code → 400 INVALID_CODE ; code expiré → 400 CODE_EXPIRED ; aucun compte
ok 3 - 5 mauvais codes puis le bon → 429 TOO_MANY_ATTEMPTS (5e et 6e essai), aucun compte
# … 6 autre(s) sous-test(s) réussi(s)
# tests 12
# pass 12
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/security/r25-commandes-idor.test.ts
not ok 1 - sans session, ?userId=<B> → 401, aucune ligne de B ; le middleware garde la route fermée
      error: sans session : HTTP 200 {"orders":[{"id":"295ce803-3830-45e8-96d9-56dfa00cbf3c","orderNumber":"CMD-R25-B-e085239c-df04-4df5-965d-69b8e8161d46","type":"FOOD_ORDER","title":"Commande Traiteur — R25 Services (0 article)","itemCount":0,"totalAmountFormatted":"7 00
not ok 2 - client A connecté par cookies (session du navigateur), ?userId=<B> → ses seules lignes
      error: 'réglage features.halls_enabled absent de platform_settings (migration 20261105000001, fix(7.0a))'
not ok 3 - client A connecté par Bearer, ?userId=<B> → ses seules lignes (garde-fou)
      error: 'réglage features.halls_enabled absent de platform_settings (migration 20261105000001, fix(7.0a))'
not ok 1 - client connecté : hall_reservations, table_reservations, orders à son nom → refusées, aucune ligne
      error: "INSERT hall_reservations par un client à son nom : l'opération a été ACCEPTÉE alors qu'elle doit être refusée"
# … 1 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# tests 5
# pass 0
# fail 5
# cancelled 0
# run 84 (55afc8b, « après ») — tests/security/r25-commandes-idor.test.ts
ok 1 - sans session, ?userId=<B> → 401, aucune ligne de B ; le middleware garde la route fermée
ok 2 - client A connecté par cookies (session du navigateur), ?userId=<B> → ses seules lignes
ok 3 - client A connecté par Bearer, ?userId=<B> → ses seules lignes (garde-fou)
ok 1 - client connecté : hall_reservations, table_reservations, orders à son nom → refusées, aucune ligne
ok 2 - catalogue : les politiques hall_reservations_insert, table_reservations_insert, orders_insert n'existent plus
# tests 5
# pass 5
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/parcours/email-optionnel.test.ts
not ok 1 - inscriptions et achat sans RESEND_API_KEY : SMS envoyés, aucun email tenté, un seul avertissement
      error: "route de démarrage de l'inscription absente : app/api/auth/register/start/route.ts (contrat 3.6, fix(7.3s)) — Cannot find module '/home/runner/work/event-village/event-village/app/api/auth/register/start/route' imported from /home/runner/work/event-village/ev
# tests 2
# pass 1
# fail 1
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/email-optionnel.test.ts
ok 1 - inscriptions et achat sans RESEND_API_KEY : SMS envoyés, aucun email tenté, un seul avertissement
ok 2 - sans identifiants MTarget, la configuration serveur est refusée
# tests 2
# pass 2
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/parcours/otp-serveur.test.ts
not ok 2 - inscription client (numéro d’abord) → otp_codes → /api/auth/register depuis une autre instance
      error: "route de démarrage de l'inscription absente : app/api/auth/register/start/route.ts (contrat 3.6, fix(7.3s)) — Cannot find module '/home/runner/work/event-village/event-village/app/api/auth/register/start/route' imported from /home/runner/work/event-village/ev
# tests 3
# pass 2
# fail 1
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/otp-serveur.test.ts
ok 1 - send-otp → otp_codes → verify-otp depuis une autre instance
ok 2 - inscription client (numéro d’abord) → otp_codes → /api/auth/register depuis une autre instance
ok 3 - inscription partenaire → otp_codes → verify-otp depuis une autre instance
# tests 3
# pass 3
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/parcours/finance-cibles.test.ts
not ok 1 - paiement en ligne : PENDING, montants du contrat, succès SamirPay → SUCCESS, commande confirmée
      error: 'réglage features.orders_enabled absent de platform_settings (clés du lot 7 : migration 20261105000001, contrat M1)'
not ok 2 - échec chez SamirPay, réconciliation → FAILED, commande annulée
      error: 'réglage features.orders_enabled absent de platform_settings (clés du lot 7 : migration 20261105000001, contrat M1)'
not ok 1 - paiement en ligne : PENDING, montants du contrat, succès SamirPay → SUCCESS, réservation confirmée
      error: 'réglage features.halls_enabled absent de platform_settings (clés du lot 7 : migration 20261105000001, contrat M1)'
not ok 2 - échec chez SamirPay, réconciliation → FAILED, réservation annulée (créneau libéré)
      error: 'réglage features.halls_enabled absent de platform_settings (clés du lot 7 : migration 20261105000001, contrat M1)'
# … 2 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# tests 8
# pass 2
# fail 6
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/finance-cibles.test.ts
ok 1 - paiement en ligne : PENDING, montants du contrat, succès SamirPay → SUCCESS, commande confirmée
ok 2 - échec chez SamirPay, réconciliation → FAILED, commande annulée
ok 1 - paiement en ligne : PENDING, montants du contrat, succès SamirPay → SUCCESS, réservation confirmée
ok 2 - échec chez SamirPay, réconciliation → FAILED, réservation annulée (créneau libéré)
ok 1 - paiement en ligne : PENDING, montants du contrat, succès SamirPay → SUCCESS, réservation confirmée
ok 2 - échec chez SamirPay, réconciliation → FAILED, réservation annulée (table libérée)
# … 2 autre(s) sous-test(s) réussi(s)
# tests 8
# pass 8
# fail 0
# cancelled 0
```

### 7.3 e — Parcours client, écrans

**Correctif.** `2b37606`.
- Nouveaux fichiers : `lib/payments/payment-client.ts`, `components/payment/PendingPaymentBanner.tsx`, `PaymentWaitingInfo.tsx`.
- Migrés : `PaymentModal` (jetons d'opérateur `--op-*`, D59), `app/paiement/[id]/page.tsx` (attente honnête, D58), `app/events/[id]/page.tsx` (modale et carte chargées à la demande), `app/register/page.tsx` (numéro d'abord), `AppLayout` (navigation selon les interrupteurs), accueil, 404, page d'erreur, commandes, profil, portefeuille.
- Mention des tuiles de carte marquée `data-ev-caption` (D74).

```text
# run 72 (51e0c70, « avant ») — tests/parcours/client-interface.test.ts
not ok 1 - attente honnête : garder la page ouverte, achat enregistré même fermée, SMS au numéro masqué, billets dans Mes billets
      error: "texte d'attente de D58 absent : « Gardez cette page ouverte pour suivre la confirmation. »"
not ok 2 - échec, annulation, échéance : « Réessayer le paiement » vers retry_url ; succès vers success_url
      error: 'bouton « Réessayer le paiement » absent'
not ok 3 - plus de framer-motion ; montants par formatFcfa (« F CFA »), aucun « FCFA » écrit à la main
      error: 'framer-motion encore importé (D77)'
not ok 1 - jetons d'opérateur --op-* au lieu de couleurs brutes bg-[\#…]
      error: 'couleur brute bg-[#…] encore présente'
# … 13 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# crochet en échec :
not ok 6 - /home/runner/work/event-village/event-village/tests/parcours/client-interface.test.ts
  schéma du lot 7 incomplet (client-interface) : invariants (p)(q) impossibles à vérifier :
# tests 17
# pass 0
# fail 17
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/client-interface.test.ts
ok 1 - attente honnête : garder la page ouverte, achat enregistré même fermée, SMS au numéro masqué, billets dans Mes billets
ok 2 - échec, annulation, échéance : « Réessayer le paiement » vers retry_url ; succès vers success_url
ok 3 - plus de framer-motion ; montants par formatFcfa (« F CFA »), aucun « FCFA » écrit à la main
ok 1 - jetons d'opérateur --op-* au lieu de couleurs brutes bg-[\#…]
ok 2 - 409 PAYMENT_PENDING : « Un paiement est déjà en attente » et « Suivre le paiement »
ok 3 - montants par formatFcfa, aucun « FCFA » écrit à la main
# … 11 autre(s) sous-test(s) réussi(s)
# tests 17
# pass 17
# fail 0
# cancelled 0
```

### 7.4 — Parcours partenaire

**Correctif.** `9a8f13c`.
- **Serveur :**
  - `lib/partner/partner-dashboard.service.ts` : `onboarding` en 8 étapes cochées par le serveur, `trial` ;
  - routes `dashboard`, `subscription` (`trial_percent_used`, offres libellées, plus de `PLAN_HIGHLIGHTS` inventés) et `team/all` ;
  - `lib/finance/ledger.ts` : `is_pending` et `effective_status`.
- **Écrans :** `FirstEventSteps.tsx` (nouveau), puis le tableau de bord, les finances, l'équipe et l'abonnement.

Après la relecture : libellé comptable brut retiré des finances (`e82a9b9`), liste d'activités unique dans `lib/partner/activity-labels.ts`, offres « illimitées ».

```text
# run 72 (51e0c70, « avant ») — tests/parcours/partenaire-lot7.test.ts
not ok 1 - partenaire VALIDE sans événement : carte visible, aucune étape de création cochée
      error: 'partenaire VALIDE sans événement : dashboard.onboarding absent (contrat 3.8, D70) — clés servies : partner, kpis, events, recentActivity'
not ok 2 - étapes cochées par le serveur : création, affiche, catégorie, soumission, validation ; invisible après la publication
      error: 'brouillon sans affiche ni catégorie : dashboard.onboarding absent (contrat 3.8, D70) — clés servies : partner, kpis, events, recentActivity'
not ok 3 - invisible avec un événement TERMINE
      error: 'partenaire avec un événement TERMINE : dashboard.onboarding absent (contrat 3.8, D70) — clés servies : partner, kpis, events, recentActivity'
not ok 4 - invisible pour un partenaire EN_ATTENTE ou REJETE ; le motif du refus est servi pour le bandeau REJETE
      error: 'partenaire EN_ATTENTE : dashboard.onboarding absent (contrat 3.8, D70) — clés servies : partner, kpis, events, recentActivity'
# … 19 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# crochet en échec :
not ok 7 - /home/runner/work/event-village/event-village/tests/parcours/partenaire-lot7.test.ts
  schéma du lot 7 incomplet (partenaire-lot7) : invariants (p)(q) impossibles à vérifier :
# tests 25
# pass 2
# fail 23
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/partenaire-lot7.test.ts
ok 1 - partenaire VALIDE sans événement : carte visible, aucune étape de création cochée
ok 2 - étapes cochées par le serveur : création, affiche, catégorie, soumission, validation ; invisible après la publication
ok 3 - invisible avec un événement TERMINE
ok 4 - invisible pour un partenaire EN_ATTENTE ou REJETE ; le motif du refus est servi pour le bandeau REJETE
ok 1 - fondateur : trial.days = 90, trial.ends_at = fin d’essai en base
ok 2 - partenaire ordinaire : trial.days = 60, trial.ends_at = fin d’essai en base
# … 19 autre(s) sous-test(s) réussi(s)
# tests 25
# pass 25
# fail 0
# cancelled 0
```

Signalements d'E5 :
- **`ClosingReportModal.tsx`**, chargé par `next/dynamic`, sort du périmètre du contrôle statique du tableau de bord : il reste à migrer.
- **`max_events`** est affiché alors qu'il n'est appliqué nulle part (D8).
- **`kpis.commissionAmount`** est encore servi : `finance-hors-plateforme` le lit.

### 7.5 — Performance et accessibilité

**Greps d'origine.**

```text
$ git grep -n -E 'framer-motion|liquid-glass-react|react-leaflet|"sharp"|jsqr' 6fff1bf -- package.json
6fff1bf:package.json:29:    "framer-motion": "^11.5.0",
6fff1bf:package.json:31:    "liquid-glass-react": "^1.1.1",
6fff1bf:package.json:37:    "react-leaflet": "^5.0.0",
$ git grep -n -E 'framer-motion|liquid-glass-react|react-leaflet|"sharp"|jsqr' aaf6542 -- package.json
aaf6542:package.json:28:    "jsqr": "1.4.0",
aaf6542:package.json:35:    "sharp": "0.33.5",
```

**Correctifs.**
- `020fda0` :
  - sharp 0.33.5 avec ses binaires Linux dans le lockfile ;
  - framer-motion, liquid-glass-react et react-leaflet retirés ;
  - `@types/leaflet` en `devDependencies` ;
  - budgets bloquants dans `scripts/js-budget.json` ;
  - `.npmrc` garde `legacy-peer-deps=true`, qui ne pouvait pas être retiré sans désynchroniser le lockfile (`@emnapi/wasi-threads`).
- `abc6c7a` (reprise) : synchronisation hors ligne chargée à la demande par AuthProvider, `StatusBadge` sans `outbox-labels`, dépendances du panneau de la cloche chargées à la demande.
- `8ce353c` : budgets resserrés à « mesure du run 78 + 3 Ko ».
- `28d62ae` (scanner) : la caméra, le plein écran du résultat, le bandeau de caisse et les onglets de `/controller/scanner` sont chargés par `import()` et préchargés dès l'écran « Commencer le contrôle » (`lib/scan/deferred-part.ts`). Une fois chargés, ils sont rendus directement : aucune suspension au premier verdict. Si une partie manque encore, l'écran affiche un repli neutre, jamais un verdict. Le budget du scanner passe à 226 000. Premier chargement : 229 698 (run 83) → 222 499 (run 84). Traces R5-001 et R5-002.
- Le comportement du scanner après `28d62ae` est couvert par `scanner-interface`, `scanner-reprise` et `terrain` 3 à 7, tous verts au run 84. Le cas « parties encore absentes au premier verdict » n'a pas de test dédié : **NON VÉRIFIÉ** en CI.

Aux runs 83 et 84, `next-start.log` montre : `[e2e-app] sharp 0.33.5 chargé (libvips 8.15.3)`, sans aucune mention `sharp-missing-in-production`.

```text
# run 72 (51e0c70, « avant ») — tests/parcours/perf-statique.test.ts
not ok 1 - sharp est épinglé à 0.33.5 dans dependencies et convertit un PNG 1×1 en WebP
      error: package.json : sharp attendu en dependencies à « 0.33.5 » exactement, trouvé null
not ok 2 - package-lock.json contient sharp 0.33.5 et les binaires Linux @img/sharp-linux-x64 et @img/sharp-libvips-linux-x64
      error: package-lock.json : la racine ne déclare pas sharp 0.33.5 en dependencies (lockfile non régénéré)
not ok 3 - @types/leaflet est en devDependencies et plus dans dependencies
      error: @types/leaflet encore en dependencies (^1.9.22)
not ok 4 - framer-motion, liquid-glass-react et react-leaflet : aucune référence dans app/, components/, lib/, hooks/, absents de package.json
      error: références aux paquets retirés (D75, D77) :
# … 3 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# crochet en échec :
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/perf-statique.test.ts
  schéma du lot 7 incomplet (perf-statique) : invariants (p)(q) impossibles à vérifier :
# tests 12
# pass 5
# fail 7
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/perf-statique.test.ts
ok 1 - sharp est épinglé à 0.33.5 dans dependencies et convertit un PNG 1×1 en WebP
ok 2 - package-lock.json contient sharp 0.33.5 et les binaires Linux @img/sharp-linux-x64 et @img/sharp-libvips-linux-x64
ok 3 - @types/leaflet est en devDependencies et plus dans dependencies
ok 4 - framer-motion, liquid-glass-react et react-leaflet : aucune référence dans app/, components/, lib/, hooks/, absents de package.json
ok 5 - aucun fichier « use client » n'importe en valeur lib/supabase/server ni lib/shifts/shift.service
ok 6 - auto-test du détecteur d'imports : valeur, type, import(), require(), export … from, prologue « use client »
# … 6 autre(s) sous-test(s) réussi(s)
# tests 12
# pass 12
# fail 0
# cancelled 0
```

Mesures avant et après : section 8. Contrôles axe, 44 px et 14 px : section 9.

### 7.6 — Invariants (p)(q)

Section 4.

```text
# run 72 (51e0c70, « avant ») — tests/parcours/terrain-invariant.test.ts
not ok 1 - missingTerrainSchema() est vide (tables, colonnes et triggers de rotation présents)
      error: schéma du lot 7 incomplet, (p)(q) invérifiables :
not ok 1 - (p1) scan QR accepté sans version alors que l'historique du billet précède le scan
      error: schéma du lot 7 incomplet (terrain-invariant (p1)) : invariants (p)(q) impossibles à vérifier :
not ok 2 - (p2) versions 1 et 2 datées now() - 10 min et now() - 5 min, scan accepté en version 1 daté now()
      error: schéma du lot 7 incomplet (terrain-invariant (p2)) : invariants (p)(q) impossibles à vérifier :
not ok 3 - (p3) scan en version 3 d'un billet en version 2
      error: schéma du lot 7 incomplet (terrain-invariant (p3)) : invariants (p)(q) impossibles à vérifier :
# … 7 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# crochet en échec :
not ok 5 - /home/runner/work/event-village/event-village/tests/parcours/terrain-invariant.test.ts
  schéma du lot 7 incomplet (terrain-invariant) : invariants (p)(q) impossibles à vérifier :
# tests 11
# pass 0
# fail 11
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/terrain-invariant.test.ts
ok 1 - missingTerrainSchema() est vide (tables, colonnes et triggers de rotation présents)
ok 1 - (p1) scan QR accepté sans version alors que l'historique du billet précède le scan
ok 2 - (p2) versions 1 et 2 datées now() - 10 min et now() - 5 min, scan accepté en version 1 daté now()
ok 3 - (p3) scan en version 3 d'un billet en version 2
ok 1 - (q1) instantané au nom de A, téléchargement par B ; témoin : téléchargement conforme
ok 2 - (q2) version 2 au nom de A, téléchargement de B en version 2
# … 5 autre(s) sous-test(s) réussi(s)
# tests 11
# pass 11
# fail 0
# cancelled 0
```

### 7.7 — Captures et fumée

Section 3 pour les captures, section 6 pour la fumée.

### 7.9 — Confirmation d'achat claire (ajout de l'utilisateur du 04/11)

**Constats.** Lus dans le code le 04/11, contrat 19.1.
- L'email de tout type était générique : le contenu in-app, plus un bouton « Ouvrir Event Village ».
- Les données de `PURCHASE_CONFIRMED` ne portaient ni catégories ni numéros de billets.
- `TRANSFER_RECEIVED` n'avait pas d'email.
- Le SMS d'achat faisait déjà **161 septets au pire cas**, soit 2 segments.

**Correctif.** `bd9d6e1`.
- Migration `20261105000007_lot7_confirmation.sql` :
  - `notif_ticket_lines`, triée en `COLLATE "C"` ;
  - `payment_confirm`, `free_tickets_claim` et `ticket_transfer_accept`, dans sa version de la migration 03 ;
  - EMAIL ajouté à `TRANSFER_RECEIVED`.
- `lib/notifications/email-layout.ts` : blocs facultatifs et thème sombre par `@media (prefers-color-scheme: dark)`.
- `lib/notifications/catalog.ts` : emails des trois types et `smsVar(title, 19)` (D95).
- `catalog-types.ts`.

Les données sont figées à l'émission (D87). Aucun QR, code, secret ni lien de réclamation n'apparaît.

```text
# run 72 (51e0c70, « avant ») — tests/parcours/confirmation-achat.test.ts
not ok 1 - achat de 1 billet : categories et ticket_numbers figés, email complet (titre, date de Dakar, lieu, ville, « 1 × Standard », montant, numéro, P1, P2, P3, « Voir mes billets »)
      error: achat de 1 billet : template_data.categories figé à l'émission (D87, contrat 19.3) : {"city":"Ouakam","title":"Confirmation FABD","total":5250,"event_id":"c7782bb7-6938-495b-971f-89b318130dce","location":"Esplanade du Monument de la Renaissance","start_at":"20
not ok 2 - achat de 4 billets de deux catégories (2 + 2) : lignes dans l'ordre du nom, 4 numéros = tickets.ticket_number = ticketNumber de GET /api/tickets (D88)
      error: achat de 4 billets : template_data.categories figé à l'émission (D87, contrat 19.3) : {"city":"Ouakam","title":"Confirmation FABD","total":35700,"event_id":"c7782bb7-6938-495b-971f-89b318130dce","location":"Esplanade du Monument de la Renaissance","start_at":"
not ok 3 - achat de 12 billets : exactement les 10 premiers numéros dans l'ordre, « et 2 autres », les 2 derniers absents, ticket_count = 12
      error: achat de 12 billets : template_data.categories figé à l'émission (D87, contrat 19.3) : {"city":"Ouakam","title":"Confirmation FABD","total":63000,"event_id":"c7782bb7-6938-495b-971f-89b318130dce","location":"Esplanade du Monument de la Renaissance","start_at":
not ok 1 - 2 « Entree libre » + 1 « Invitation » : catégories et numéros figés, email complet sans montant (texte et HTML), in-app « Vos billets sont dans Mes billets. »
      error: categories figées, ordre du nom : {"city":"Ouakam","title":"Gratuits FABD","event_id":"3b03efd4-adfa-4ba7-92a7-51f7c629f563","location":"Esplanade du Monument de la Renaissance","start_at":"2026-11-09T06:22:00+00:00","ticket_id":"581cd491-d31c-40d4-b161-9b3028
# … 15 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# crochet en échec :
not ok 9 - /home/runner/work/event-village/event-village/tests/parcours/confirmation-achat.test.ts
  schéma du lot 7 incomplet (confirmation-achat) : invariants (p)(q) impossibles à vérifier :
# tests 21
# pass 2
# fail 19
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/confirmation-achat.test.ts
ok 1 - achat de 1 billet : categories et ticket_numbers figés, email complet (titre, date de Dakar, lieu, ville, « 1 × Standard », montant, numéro, P1, P2, P3, « Voir mes billets »)
ok 2 - achat de 4 billets de deux catégories (2 + 2) : lignes dans l'ordre du nom, 4 numéros = tickets.ticket_number = ticketNumber de GET /api/tickets (D88)
ok 3 - achat de 12 billets : exactement les 10 premiers numéros dans l'ordre, « et 2 autres », les 2 derniers absents, ticket_count = 12
ok 1 - 2 « Entree libre » + 1 « Invitation » : catégories et numéros figés, email complet sans montant (texte et HTML), in-app « Vos billets sont dans Mes billets. »
ok 1 - acceptation : ligne EMAIL créée, template_data.ticket_number = NOUVEAU numéro et catégorie ; email avec catégorie, numéro, P1, P2, P3, sans montant ; in-app avec le numéro
ok 1 - PURCHASE_CONFIRMED — achat de 1 billet : blocs attendus, aucun QR, code, secret ni lien de réclamation
# … 15 autre(s) sous-test(s) réussi(s)
# tests 21
# pass 21
# fail 0
# cancelled 0
```

**Longueur des SMS au pire cas, calculée par le test.** Table GSM 03.38 écrite dans le test.

Run 72 (`tests__parcours__confirmation-achat.test.ts.log:173-176`) :

```text
[7.9 SMS] PURCHASE_CONFIRMED (Festival des musique…) : 161 septets, 2 segment(s) ; avec « Billets dans l'appli, rubrique Mes billets. » : 205 septets, 2 segment(s)
[7.9 SMS] FREE_TICKETS_CONFIRMED (Festival des musique…) : 148 septets, 1 segment(s) ; avec « Billets dans l'appli, rubrique Mes billets. » : 192 septets, 2 segment(s)
[7.9 SMS] PURCHASE_CONFIRMED (Grande soirée « Ndëk…) : 161 septets, 2 segment(s) ; avec « Billets dans l'appli, rubrique Mes billets. » : 205 septets, 2 segment(s)
[7.9 SMS] FREE_TICKETS_CONFIRMED (Grande soirée « Ndëk…) : 148 septets, 1 segment(s) ; avec « Billets dans l'appli, rubrique Mes billets. » : 192 septets, 2 segment(s)
```

Run 84 (`:41-44`) :

```text
[7.9 SMS] PURCHASE_CONFIRMED (Festival des musique…) : 160 septets, 1 segment(s) ; avec « Billets dans l'appli, rubrique Mes billets. » : 204 septets, 2 segment(s)
[7.9 SMS] FREE_TICKETS_CONFIRMED (Festival des musique…) : 148 septets, 1 segment(s) ; avec « Billets dans l'appli, rubrique Mes billets. » : 192 septets, 2 segment(s)
[7.9 SMS] PURCHASE_CONFIRMED (Grande soirée « Ndëk…) : 159 septets, 1 segment(s) ; avec « Billets dans l'appli, rubrique Mes billets. » : 203 septets, 2 segment(s)
[7.9 SMS] FREE_TICKETS_CONFIRMED (Grande soirée « Ndëk…) : 148 septets, 1 segment(s) ; avec « Billets dans l'appli, rubrique Mes billets. » : 192 septets, 2 segment(s)
```

| SMS | Run 72 | Run 84 | Avec la mention « Billets dans l'appli, rubrique Mes billets. » |
|---|---|---|---|
| PURCHASE_CONFIRMED, titre de 60 caractères, 999 billets, frais 999 999, total 9 999 999 | 161 septets, 2 segments | 160 et 159 septets, 1 segment | 203 à 205 septets, 2 segments : jamais ajoutée (D95) |
| FREE_TICKETS_CONFIRMED, 999 billets | 148 septets, 1 segment | 148, 1 segment | 192 septets, 2 segments |

```text
# run 72 (51e0c70, « avant ») — tests/parcours/notif-modeles.test.ts
not ok 1 - NOTIFICATION_CATALOG contient exactement les types de G2, chacun avec ses attributs
      error: types du catalogue = types de G2
not ok 3 - chaque type rend chaque canal qu'il déclare (sample), sans variable manquante ni valeur JS affichée
      error: "Cannot read properties of undefined (reading 'sample')"
not ok 5 - liens : chemin interne de G2 (« / », jamais « // » ni schéma), avec l'identifiant du sample
      error: "Cannot read properties of undefined (reading 'link')"
not ok 1 - titres in-app exacts (G4) ; variables in-app non tronquées (titre complet de l'événement)
      error: "Cannot read properties of undefined (reading 'inApp')"
# … 2 autre(s) sous-test(s) en échec ou annulé(s) : docs/lot7-logs/ci-run72-verify.log
# tests 19
# pass 13
# fail 6
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/notif-modeles.test.ts
ok 1 - NOTIFICATION_CATALOG contient exactement les types de G2, chacun avec ses attributs
ok 2 - public.notification_types = NOTIFICATION_CATALOG (type, famille, sujet, canaux, audience, politique, journal, permission)
ok 3 - chaque type rend chaque canal qu'il déclare (sample), sans variable manquante ni valeur JS affichée
ok 4 - renderNotification lève TemplateDataError quand une variable obligatoire manque, et rend le même texte que le catalogue
ok 5 - liens : chemin interne de G2 (« / », jamais « // » ni schéma), avec l'identifiant du sample
ok 1 - titres in-app exacts (G4) ; variables in-app non tronquées (titre complet de l'événement)
# … 13 autre(s) sous-test(s) réussi(s)
# tests 19
# pass 19
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/parcours/notif-outbox.test.ts
not ok 1 - public.notification_types contient exactement les types du contrat, avec famille, sujet, canaux, audience, politique, journal et permission
      error: types absents du registre : ADMIN_SMS_OPTIONAL_80, ADMIN_SMS_FORECAST
# tests 32
# pass 31
# fail 1
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/notif-outbox.test.ts
ok 1 - public.notification_types contient exactement les types du contrat, avec famille, sujet, canaux, audience, politique, journal et permission
ok 2 - le registre refuse un type mal formé, une famille optionnelle sans sujet, un canal inconnu, une permission hors audience ADMIN
ok 1 - colonnes, types et nullabilité de public.notification_outbox
ok 2 - contraintes nommées, clés étrangères, index et triggers du contrat
ok 3 - chaque CHECK refuse sa ligne fabriquée ; une ligne conforme est acceptée (transaction annulée)
ok 4 - clé d’idempotence UNIQUE ; un seul SMS de changement PENDING par porteur et par événement
# … 26 autre(s) sous-test(s) réussi(s)
# tests 32
# pass 32
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/parcours/notif-canaux.test.ts
not ok 3 - message indispensable : HTML échappé (titre <script>), version texte, bouton vers l’application, sans désabonnement, clé d’idempotence transmise
      error: 'libellé du bouton (« Voir mes billets », D93)'
# tests 30
# pass 29
# fail 1
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/notif-canaux.test.ts
ok 1 - PASSWORD_CHANGED : une notification IN_APP (type, titre, contenu du catalogue, metadata), notification_id posé, une seule fois
ok 2 - type lié à un événement (optionnel) : metadata = données du modèle + actionUrl /events/<id> + outbox_id ; préférence dans l’instantané
ok 1 - GSM-7 et UCS-2 : texte exact, un SMS, encodage et segments dans decision.delivery
ok 1 - 2xx accepté (code 0) : SENT, identifiant du ticket ; la requête porte numéro MTarget et message
ok 2 - 2xx avec un code MTarget de refus : REJECTED définitif
ok 3 - 2xx illisible (texte, ou JSON sans « results ») : UNCERTAIN, jamais compté comme envoyé
# … 24 autre(s) sous-test(s) réussi(s)
# tests 30
# pass 30
# fail 0
# cancelled 0
```
```text
# run 72 (51e0c70, « avant ») — tests/parcours/notif-transferts.test.ts
not ok 1 - destinataire vérifié : 200, billet transféré, identité du billet renouvelée, TRANSFER_CLAIMED_SENDER et TRANSFER_RECEIVED (in-app, push, email du destinataire, aucun SMS) ; second appel 409
      error: destinataire prévenu (in-app, push, email ; D91) : ["PUSH","IN_APP"]
# tests 9
# pass 8
# fail 1
# cancelled 0
# run 84 (55afc8b, « après ») — tests/parcours/notif-transferts.test.ts
ok 1 - numéro vérifié : réponse QUEUED sans jeton ni lien, TRANSFER_OFFERED par SMS au numéro et in-app + push au compte ; SMS exact sans lien de réclamation
ok 2 - numéro sans vérification : SMS au numéro seulement (aucune in-app à un compte non prouvé)
ok 3 - cible email : 400 RECIPIENT_PHONE_REQUIRED, aucun transfert, billet libre
ok 1 - vérifié → l’élément ; non vérifié → phoneVerificationRequired sans détail ; autre compte → rien ; ancien transfert vers un email → rien
ok 1 - destinataire vérifié : 200, billet transféré, identité du billet renouvelée, TRANSFER_CLAIMED_SENDER et TRANSFER_RECEIVED (in-app, push, email du destinataire, aucun SMS) ; second appel 409
ok 2 - refus : 404 identique (inconnu, transfert d’un autre, ancien transfert vers un email), 403 PHONE_NOT_VERIFIED, 410 TRANSFER_EXPIRED, 400 SELF_TRANSFER ; billet inchangé
# … 3 autre(s) sous-test(s) réussi(s)
# tests 9
# pass 9
# fail 0
# cancelled 0
```

**Captures des emails** (projet `emails`, D98).
- Rendu par `scripts/e2e/render-emails.ts`, avec le catalogue réel et des données d'exemple, sans aucune route ni mode de test dans l'application.
- 5 emails × 2 largeurs × 2 thèmes = 20 captures, publiées sur `ci-results` : `runs/84-41936361777/captures/email-*.png`, et le HTML et le texte dans `runs/84-41936361777/emails/`.
- Le thème sombre dépend du client mail : Apple Mail et iOS l'appliquent ; Gmail web l'ignore (SUPPOSÉ).

`docs/lot7-logs/ci-run84-captures-emails.txt` :

```text
EVENT VILLAGE — EMAILS DE CONFIRMATION (lot 7, tâche 7.9, contrat 19.9)
généré le : 2026-11-05T00:11:47.489Z
rendu : scripts/e2e/render-emails.ts (catalogue réel, données d’exemple fictives) ; affichage : page.setContent, réseau refusé
thème sombre : appliqué par les clients qui lisent @media (prefers-color-scheme: dark) (Apple Mail, iOS) ; Gmail web l’ignore (SUPPOSÉ)

achat-1-billet (PURCHASE_CONFIRMED) — objet « Achat confirmé — Event Village »
  email-achat-1-billet__390__clair.png : OK
  email-achat-1-billet__390__sombre.png : OK
  email-achat-1-billet__600__clair.png : OK
  email-achat-1-billet__600__sombre.png : OK
achat-4-billets (PURCHASE_CONFIRMED) — objet « Achat confirmé — Event Village »
  email-achat-4-billets__390__clair.png : OK
  email-achat-4-billets__390__sombre.png : OK
  email-achat-4-billets__600__clair.png : OK
  email-achat-4-billets__600__sombre.png : OK
achat-12-billets (PURCHASE_CONFIRMED) — objet « Achat confirmé — Event Village »
  email-achat-12-billets__390__clair.png : OK
  email-achat-12-billets__390__sombre.png : OK
  email-achat-12-billets__600__clair.png : OK
  email-achat-12-billets__600__sombre.png : OK
gratuits-2-billets (FREE_TICKETS_CONFIRMED) — objet « Billets confirmés — Event Village »
  email-gratuits-2-billets__390__clair.png : OK
  email-gratuits-2-billets__390__sombre.png : OK
  email-gratuits-2-billets__600__clair.png : OK
  email-gratuits-2-billets__600__sombre.png : OK
transfert-recu (TRANSFER_RECEIVED) — objet « Billet reçu — Event Village »
  email-transfert-recu__390__clair.png : OK
  email-transfert-recu__390__sombre.png : OK
  email-transfert-recu__600__clair.png : OK
  email-transfert-recu__600__sombre.png : OK
```

Relecture humaine des emails (run 77, groupe 0) :
- les deux phrases obligatoires sont présentes mot pour mot ;
- la troncature « et 2 autres » fonctionne ;
- il n'y a ni QR ni code ;
- le sombre reste lisible.

Constats mineurs laissés :
- « Vos billets sont dans Mes billets » s'affiche aussi pour un seul billet, parce que la phrase est figée par D94 et testée ;
- le numéro de billet se coupe au trait d'union à 390 px.

**Décisions D87 à D99 :** section 14.

---

## 3. Captures : écrans capturés et corrections après relecture

**Au run 84 : 286 captures sur 286, aucune en échec** (`docs/lot7-logs/ci-run84-captures-index.txt`), comme au run 83. Cela fait 80 écrans :
- en 390 × 844 (DPR 2) et 1440 × 900, clair et sombre ;
- sauf les 17 écrans du contrôleur et de la caisse, en 2 vues sombres (D85, thème forcé).

Les 20 captures des emails viennent en plus (section 2, 7.9). L'en-tête de l'index :

```text
EVENT VILLAGE — CAPTURES D’ÉCRAN (lot 5, tâche 5.1 ; lot 6, tâche 6.12 ; lot 7, tâche 7.7)
généré le      : 2026-11-05T00:17:30.832Z
run CI         : 84-41936361777 (55afc8b3fa96948bccfa82993de41685a934f3f6)
format         : <écran>__<mobile|ordinateur>__<clair|sombre>.png — mobile 390×844 DPR 2, ordinateur 1440×900 DPR 1
captures       : 286 / 286 tentative(s)
en échec       : 0 (contrôles bloquants ou erreur)
avertissements : 268 capture(s) concernée(s) (lot 7 : cibles < 44 px, textes < 14 px hors exemption et axe-core sont bloquants)
emails         : captures email-<id>__<390|600>__<clair|sombre>.png et résumé emails.txt (projet emails, tâche 7.9)
textes < 14 px : 0 hors exemption au total (détail sous chaque capture ; tableau : avertissements.tsv)
préchargements : 129 préchargement(s) Next abandonné(s), non bloquants, listés sous chaque capture (network.ts, lot 6)
Relecture humaine obligatoire : un écran n’est terminé qu’une fois sa capture relue (rapport du lot, section 3).
```

**D'où viennent les 286 captures.**
- Le lot 6 en comptait 172, sur 43 écrans.
- Le lot 7 ajoute 37 écrans, soit 116 captures.
- `controleur-scanner` passe de 4 vues à 2, ce qui retire 2 captures.
- 172 + 116 − 2 = 286. Le contrat en annonçait 288 (section 11.2) sans compter ce retrait.

**Nouveaux écrans** (contrat 11.2) :
- billet hors ligne :
  - `billet-hors-ligne-disponible`, `-a-telecharger`, `-sans-codes` ;
  - `billet-hors-ligne-qr`, sur le billet de « ce soir » et non celui de « la veille », dont le contrôle n'ouvre que le lendemain (écart signalé) ;
- scanner :
  - `scanner-accueil` ;
  - six résultats plein écran (`scanner-accepte`, `-deja-utilise`, `-refuse`, `-a-encaisser`, `-hors-fenetre`, `-evenement-annule`) ;
  - `scanner-reseau-lent`, `-hors-ligne`, `-saisie-manuelle`, `-guichet` ;
- caisse : `caisse-ouverture`, `-cloture-ecart`, `-ticket-z` ;
- paiement : `paiement-modale`, `-attente`, `-succes`, `-echec` ;
- `inscription-code` ;
- partenaire : `partenaire-inscription`, `-tableau-de-bord`, `-finances`, `-equipe`, `-profil`, `-abonnement`, `-premiers-pas` ;
- pages masquées : `page-masquee-salles`, `page-masquee-commandes` ;
- contrôleur : `controleur-activation`, `controleur-profil` ;
- `admin-campagnes`, `aide-transfert`, `portefeuille`.

**Écrans existants dont l'aspect change :**
- `controleur-scanner` : sombre forcé, 2 vues, montré pendant le contrôle (après « Commencer le contrôle ») ;
- `inscription` : numéro d'abord ;
- `mes-billets` : indicateur hors ligne, titre passé sous l'affiche ;
- `connexion` : messages de l'URL ;
- `cloche-ouverte` : « Tout marquer comme lu » sur sa ligne ;
- `evenement-annule`, `-termine`, `-suspendu` : plus de pastille « En direct » ;
- `pilotage-*` : libellés et accords ;
- `accueil` : salles masquées par l'interrupteur.

**Relecture humaine.** Elle a porté sur les captures du **run 77**, en trois groupes, par trois lecteurs, chacun pour son groupe :
- groupe 0 : 28 écrans, 100 images, plus le HTML et le texte des 4 emails ;
- groupe 1 : 29 écrans, 116 images ;
- groupe 2 : 28 écrans, 90 images.

Les notes sont dans `scratchpad/lot7-releve-captures-g0.md`, `-g1.md` et `-g2.md`, et le bilan dans `scratchpad/lot7-releve-captures.md`. Les corrections sont dans `e82a9b9`.

**Les captures corrigées n'ont pas été relues à l'œil après correction.** Aux runs 83 et 84, les contrôles automatiques passent sur les 286 captures ; la relecture visuelle des corrections est **NON VÉRIFIÉE**.

| Gravité | Écran | Défaut | Suite donnée |
|---|---|---|---|
| BLOQUANT | `billet-hors-ligne-qr` | Capture en échec, aucun QR : le billet de « la veille » n'ouvre ses codes que le lendemain à 07:45. La page avait raison de ne pas afficher de code. | Corrigé dans la capture, billet de « ce soir » (`screens.ts`) |
| BLOQUANT | `cloche-ouverte` | « Tout marquer comme lu » compté sur 2 lignes à 390 px | Défaut de la mesure, qui comptait l'icône SVG : seuls les nœuds texte sont comptés (`captures.spec.ts`) |
| BLOQUANT | `partenaire-finances` | Libellé comptable brut (`REFUND-…`, `EVENT_CANCELLATION_REFUND`) | Corrigé (`lib/finance/ledger.ts`, `app/partner/finance/page.tsx`) ; `COMPENSATION_CREANCE` traité de même |
| BLOQUANT | `paiement-modale` | Jamais capturée : le sélecteur visait 2 boutons « Acheter » | Corrigé (`screens.ts`) |
| BLOQUANT | `portefeuille` | Pastille blanche sur `#cb5e30`, 4,05:1 | Corrigé : `bg-brand-hover`, 7,31:1 (`app/wallet/page.tsx`) |
| À CORRIGER | `aide-transfert`, `pilotage-annulation` | Modale enfermée sous l'en-tête, la barre latérale et la barre du bas ; titre, croix et boutons hors de vue | Corrigé : `Modal` rendu par un portail sur `document.body`. Focus, Échap et blocage du défilement inchangés. |
| À CORRIGER | `billet-hors-ligne-disponible`, `-a-telecharger` | 8 images identiques, indicateur sous la ligne de flottaison | Capture corrigée (`revealCenter`) |
| À CORRIGER | `admin-notifications-erreur` (mobile) | État d'erreur hors de l'image | Capture corrigée |
| À CORRIGER | `admin-notifications` (ordinateur) | Champ date affiché « mm/dd/yyyy » | **Laissé** : gabarit du Chromium sans interface de la CI, qui n'embarque que l'anglais, même en `fr-FR`. Point ouvert. |
| À CORRIGER | `evenement-annule`, `-termine`, `-suspendu`, `pilotage-remboursements` | « En direct » en vert sur un événement clos | Corrigé (`app/events/[id]/page.tsx`, `app/partner/events/[id]/page.tsx`) |
| À CORRIGER | `mes-billets` | Titre posé sur l'affiche, qui masque le texte imprimé de l'affiche | Corrigé : titre sous l'affiche (`TicketCard.tsx`) |
| À CORRIGER | `paiement-attente` | Compte à rebours en police à chasse fixe de repli, sur 2 lignes à 390 px | Corrigé sur cette page ; plus de 40 autres usages de `font-mono` laissés (point ouvert) |
| À CORRIGER | `partenaire-abonnement` | Offre Premium avec une seule caractéristique | Corrigé : « illimités », « Assistance VIP » ; `custom_branding` non affiché, car il n'est mis en œuvre nulle part |
| À CORRIGER | `pilotage-entrees` (mobile) | « Encaissemen… » tronqué | Corrigé : césure (`KpiCard.tsx`) |
| À CORRIGER | `pilotage-apercu`, `-ventes` | « 82 vendus sur 240 places » ne tombe pas juste : les ventes comptent une catégorie désactivée | Libellés corrigés (`OverviewTab.tsx`, `SalesTab.tsx`) ; les fonctions SQL du lot 5 ne changent pas |
| À CORRIGER | `scanner-a-encaisser` | Texte en double | Corrigé (`CombatFlashOverlay.tsx`) |
| À CORRIGER | `partenaire-inscription`, `-profil` | Deux listes d'activités différentes | Liste unique dans `lib/partner/activity-labels.ts` |

**MINEUR, corrigés :**
- montant de la capture de clôture de caisse (43 000), pour que l'écart affiché tombe juste ;
- accords au lieu de « (s) » dans le pilotage ;
- espace insécable avant « : » à l'accueil ;
- textes et numéro du billet hors ligne ;
- « 1 billet, avec son QR code » ;
- « Retour automatique au scan · touchez pour passer » au lieu de « Touchez l'écran… », qui contredisait la consigne « aucun clic nécessaire » ;
- une apostrophe de la connexion.

**MINEUR, laissés** (raison de chacun dans le bilan) :
- **figés par une décision ou un test :** « Vos billets sont dans Mes billets » pour un seul billet (D94, phrase testée) ;
- **à trancher dans `MASTER.md` ou dans les composants partagés :** la police à chasse fixe (plus de 40 usages), les composants de formulaire partagés, les onglets tronqués (`ScrollableTabs`) ;
- **demandent une donnée que le serveur ne sert pas :** l'heure d'ouverture sur l'écran « hors fenêtre » ;
- **page introuvable servie en HTTP 200 :** `evenement-non-public` (URL d'un brouillon, page du lot 5 rendue côté client) répond 200 aux runs 83 et 84 (`ci-run84-captures-index.txt`) ; un vrai 404 demande un `notFound()` côté serveur. Le relevé du run 77 citait aussi `page-masquee-*` ; aux runs 83 et 84, elles répondent bien `HTTP 404` (`/halls`, `/orders`) ;
- **question métier :** « Carré presse », catégorie masquée au public mais vendable au guichet. Est-ce voulu ? À l'utilisateur de trancher (point ouvert).

Sur toutes les images relues, les lecteurs n'ont trouvé ni « undefined », ni « null », ni NaN, ni date ISO, ni enum brut, ni emoji, ni texte anglais.

---

## 4. Requêtes des invariants et leur sortie

**(a) à (o).** Les requêtes des lots 2 à 6 sont inchangées ; elles sont recopiées dans `docs/lot6-rapport.md`, section 4. `assertTerrainInvariants` les appelle avant (p)(q).

**(p)(q).** La requête est dans `tests/helpers/terrain-invariants.ts:27-62` ; elle est exécutée par `inspect` (service_role, transaction en lecture seule).
- **Écart au contrat 10.2, plus strict :** q4 est évalué en mode fermé (`COALESCE(…, TRUE)`). Avec le SQL exact du contrat, un instantané sans fenêtre donnait NULL et passait inaperçu.
- `missingTerrainSchema` nomme chaque objet absent du lot 7. Il fait échouer la suite avant toute requête si le schéma est incomplet ; c'est ce qui rendait rouges les `after()` du run 72.

```sql
WITH s AS (SELECT * FROM public.ticket_scans WHERE accepted AND method = 'QR'),
p1 AS (SELECT 'p'::text AS regle, s.id::text AS objet, 'scan QR accepté sans version de secret'::text AS detail
         FROM s WHERE s.secret_version IS NULL
          AND EXISTS (SELECT 1 FROM public.ticket_secret_versions h WHERE h.ticket_id = s.ticket_id AND h.created_at <= s.created_at)),
p2 AS (SELECT 'p', s.id::text, format('scan QR accepté avec la version %s alors que la version courante était %s', s.secret_version, v.version)
         FROM s JOIN LATERAL (SELECT max(h.version) AS version FROM public.ticket_secret_versions h
                               WHERE h.ticket_id = s.ticket_id AND h.created_at <= s.created_at) v ON v.version IS NOT NULL
        WHERE s.secret_version IS NOT NULL AND s.secret_version < v.version),
p3 AS (SELECT 'p', s.id::text, format('scan avec la version %s, supérieure à la version du billet %s', s.secret_version, t.security_version)
         FROM s JOIN public.tickets t ON t.id = s.ticket_id WHERE s.secret_version > t.security_version),
d AS (SELECT * FROM public.ticket_offline_downloads),
q1 AS (SELECT 'q', d.id::text, 'téléchargement par un compte qui n''était pas le porteur (instantané : ' || COALESCE(d.decision->>'holder_user_id', 'absent') || ')'
         FROM d WHERE (d.decision->>'holder_user_id') IS DISTINCT FROM d.user_id::text),
q2 AS (SELECT 'q', d.id::text, 'téléchargement par un compte qui n''était pas le porteur de la version ' || d.secret_version
         FROM d JOIN public.ticket_secret_versions h ON h.ticket_id = d.ticket_id AND h.version = d.secret_version
        WHERE h.holder_user_id IS DISTINCT FROM d.user_id),
q3 AS (SELECT 'q', d.id::text, format('lot de la version %s alors que la version courante était %s', d.secret_version, v.version)
         FROM d JOIN LATERAL (SELECT max(h.version) AS version FROM public.ticket_secret_versions h
                               WHERE h.ticket_id = d.ticket_id AND h.created_at <= d.downloaded_at) v ON v.version IS NOT NULL
        WHERE d.secret_version <> v.version),
q4 AS (SELECT 'q', d.id::text, 'téléchargement hors de la fenêtre [' || COALESCE(d.decision->>'window_opens_at', '?') || ' ; ' || COALESCE(d.decision->>'window_closes_at', '?') || ']'
         FROM d WHERE COALESCE((
                   d.downloaded_at < (d.decision->>'window_opens_at')::timestamptz
                OR d.downloaded_at > (d.decision->>'window_closes_at')::timestamptz
                OR (d.decision->>'window_opens_at')::timestamptz <> (d.decision->>'event_start_at')::timestamptz - interval '24 hours'
                OR (d.decision->>'window_closes_at')::timestamptz <> (d.decision->>'event_end_at')::timestamptz + make_interval(hours => (d.decision->>'after_hours')::int)
              ), TRUE)),
q5 AS (SELECT 'q', d.id::text, 'téléchargement d''un billet ' || COALESCE(d.decision->>'ticket_status', 'absent') || ' (événement ' || COALESCE(d.decision->>'event_status', 'absent') || ')'
         FROM d WHERE COALESCE(d.decision->>'ticket_status', '') <> 'VALIDE' OR COALESCE(d.decision->>'event_status', '') <> 'PUBLIE'),
q6 AS (SELECT 'q', d.id::text, 'téléchargement après le compostage du billet (' || t.checked_in_at || ')'
         FROM d JOIN public.tickets t ON t.id = d.ticket_id
        WHERE t.checked_in_at IS NOT NULL AND t.checked_in_at < d.downloaded_at - interval '1 minute')
SELECT * FROM p1 UNION ALL SELECT * FROM p2 UNION ALL SELECT * FROM p3 UNION ALL SELECT * FROM q1 UNION ALL SELECT * FROM q2
UNION ALL SELECT * FROM q3 UNION ALL SELECT * FROM q4 UNION ALL SELECT * FROM q5 UNION ALL SELECT * FROM q6
ORDER BY 1, 2
```

**Sortie au run 84 : 0 violation dans chacune des 26 suites qui l'appellent, et dans le seed de démonstration** (même sortie au run 83).

```text
[INVARIANT-TERRAIN] activation-controleur — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] client-interface — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] confirmation-achat — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] course-annulation-transfert — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] dette-interface-lot7 — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] hors-ligne-client — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] hors-ligne-codes — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] hors-ligne-rotation — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] hors-ligne-service-worker — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] inscription-numero-dabord — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] interrupteurs — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] paiement-attente-lot7 — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] partenaire-lot7 — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] perf-statique — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] pwa-manifest — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] rappels-gratuits — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] scan-controleur-stats — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] scan-idempotence — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] scanner-interface — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] scanner-reprise — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] securite-admin-lot7 — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] sms-commande-4-billets — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] sms-plafond-optionnel — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] sms-veille — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] terrain-invariant — (p)(q) : 0 violation(s)
[INVARIANT-TERRAIN] migration-lot7-rejouable — (p)(q) : 0 violation(s)
```

`docs/lot7-logs/ci-run84-e2e-seed.log:216-226` :

```text
[seed-demo] invariants (a) à (q)…
[INVARIANT] seed-demo — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] seed-demo — purge des réservations échues : {"expired":0}
[INVARIANT] seed-demo — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] seed-demo — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] seed-demo — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] seed-demo — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] seed-demo — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] seed-demo — envoyeur : 0 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] seed-demo — (m)(n)(o) : 0 violation(s)
[INVARIANT-TERRAIN] seed-demo — (p)(q) : 0 violation(s)
```

Les suites `tests/security` du lot (`r23`, `r24`, `r25`) n'appellent pas l'aide, comme `r20` à `r22` au lot 6 : la règle du lot 1A interdit le service_role et l'envoyeur dans ce dossier. Ailleurs dans la sortie, les seules violations sont celles que `pilotage-invariant` (lot 5) fabrique exprès, et cette suite est verte.

**Garde-fous (p)(q)** (`tests/parcours/terrain-invariant.test.ts`). Chaque règle reçoit une violation fabriquée dans une transaction annulée, et un témoin conforme. La première exécution réelle date de l'arrivée des migrations M4 et M5 (réserve R4 du tri) ; au run 72, les 11 cas s'arrêtaient sur `assertTerrainSchema`.

```text
TAP version 13
# Subtest: 7.6 Invariants (p)(q) : schéma du lot 7
    # Subtest: missingTerrainSchema() est vide (tables, colonnes et triggers de rotation présents)
    ok 1 - missingTerrainSchema() est vide (tables, colonnes et triggers de rotation présents)
    1..1
ok 1 - 7.6 Invariants (p)(q) : schéma du lot 7
# Subtest: 7.6 Invariant (p) : aucun scan QR accepté avec une version de secret périmée (transaction annulée)
    # Subtest: (p1) scan QR accepté sans version alors que l'historique du billet précède le scan
    ok 1 - (p1) scan QR accepté sans version alors que l'historique du billet précède le scan
    # Subtest: (p2) versions 1 et 2 datées now() - 10 min et now() - 5 min, scan accepté en version 1 daté now()
    ok 2 - (p2) versions 1 et 2 datées now() - 10 min et now() - 5 min, scan accepté en version 1 daté now()
    # Subtest: (p3) scan en version 3 d'un billet en version 2
    ok 3 - (p3) scan en version 3 d'un billet en version 2
    1..3
ok 2 - 7.6 Invariant (p) : aucun scan QR accepté avec une version de secret périmée (transaction annulée)
# Subtest: 7.6 Invariant (q) : tout téléchargement par le porteur, dans la fenêtre, d'un billet VALIDE (transaction annulée)
    # Subtest: (q1) instantané au nom de A, téléchargement par B ; témoin : téléchargement conforme
    ok 1 - (q1) instantané au nom de A, téléchargement par B ; témoin : téléchargement conforme
    # Subtest: (q2) version 2 au nom de A, téléchargement de B en version 2
    ok 2 - (q2) version 2 au nom de A, téléchargement de B en version 2
    # Subtest: (q3) téléchargement en version 1 daté après la rotation vers 2 ; témoin : version 2
    ok 3 - (q3) téléchargement en version 1 daté après la rotation vers 2 ; témoin : version 2
    # Subtest: (q4) hors fenêtre : après window_closes_at, window_opens_at ≠ début − 24 h, window_closes_at ≠ fin + after, instantané sans fenêtre
    ok 4 - (q4) hors fenêtre : après window_closes_at, window_opens_at ≠ début − 24 h, window_closes_at ≠ fin + after, instantané sans fenêtre
    # Subtest: (q5) instantané UTILISE, événement SUSPENDU, statut du billet absent
    ok 5 - (q5) instantané UTILISE, événement SUSPENDU, statut du billet absent
    # Subtest: (q6) billet composté 10 min avant le téléchargement ; témoin : composté 30 s avant (tolérance d'une minute)
    ok 6 - (q6) billet composté 10 min avant le téléchargement ; témoin : composté 30 s avant (tolérance d'une minute)
    1..6
ok 3 - 7.6 Invariant (q) : tout téléchargement par le porteur, dans la fenêtre, d'un billet VALIDE (transaction annulée)
# Subtest: 7.6 Invariants (p)(q) sur l'état réel
    # Subtest: après ROLLBACK, aucune ligne fabriquée ne reste en base ni dans les violations
    ok 1 - après ROLLBACK, aucune ligne fabriquée ne reste en base ni dans les violations
    1..1
ok 4 - 7.6 Invariants (p)(q) sur l'état réel
[INVARIANT] terrain-invariant — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] terrain-invariant — purge des réservations échues : {"expired":0}
[INVARIANT] terrain-invariant — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] terrain-invariant — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] terrain-invariant — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] terrain-invariant — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] terrain-invariant — (j)(k)(l) : 0 violation(s)
[notifications] Canal push désactivé : variables VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT absentes. Les notifications partent dans l'application et par SMS.
[INVARIANT-NOTIF] terrain-invariant — envoyeur : 780 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] terrain-invariant — (m)(n)(o) : 0 violation(s)
[INVARIANT-TERRAIN] terrain-invariant — (p)(q) : 0 violation(s)
1..4
# tests 11
# suites 4
# pass 11
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1171.970184

```

---

## 5. Suites legacy touchées

Aucune. `git diff --stat 6fff1bf..55afc8b -- tests/legacy` ne renvoie rien.

Le contrat (section 13) citait trois suites legacy que le lot rend probablement fausses : `scanner-security-hardening`, `dynamic-qr-totp` et `ticket-transfer-*`. Elles sont hors CI (`scripts/run-tests.mjs:54-55`), et **je ne les ai pas lancées** (NON VÉRIFIÉ).

---

## 6. Sortie brute de `npm run verify`, de `npm run e2e` et CI

Journaux complets recopiés dans `docs/lot7-logs/` (liste en fin de section). Ils sont aussi sur `ci-results`, dans `runs/72-41784697018/`, `runs/83-41922500731/` et `runs/84-41936361777/`.

### 6.1 Run 72 (référence « avant »), récapitulatif

```text
[run-tests] 180 suite(s) — garde-fou : tests/helpers/env.ts — délai/suite : 600.0s
═══════════════════ RÉCAPITULATIF ═══════════════════
Suite                                                  Statut   Durée     Code  Journal
tests/parcours/acces-encaissement.test.ts              FAIL     2.4s      1     .test-logs/tests__parcours__acces-encaissement.test.ts.log
tests/parcours/activation-controleur.test.ts           FAIL     2.1s      1     .test-logs/tests__parcours__activation-controleur.test.ts.log
tests/parcours/client-interface.test.ts                FAIL     1.3s      1     .test-logs/tests__parcours__client-interface.test.ts.log
tests/parcours/confirmation-achat.test.ts              FAIL     1.8s      1     .test-logs/tests__parcours__confirmation-achat.test.ts.log
tests/parcours/course-annulation-transfert.test.ts     FAIL     3.2s      1     .test-logs/tests__parcours__course-annulation-transfert.test.ts.log
tests/parcours/design-systeme.test.ts                  FAIL     1.2s      1     .test-logs/tests__parcours__design-systeme.test.ts.log
tests/parcours/dette-interface-lot7.test.ts            FAIL     2.4s      1     .test-logs/tests__parcours__dette-interface-lot7.test.ts.log
tests/parcours/email-optionnel.test.ts                 FAIL     402ms     1     .test-logs/tests__parcours__email-optionnel.test.ts.log
tests/parcours/finance-cibles.test.ts                  FAIL     1.0s      1     .test-logs/tests__parcours__finance-cibles.test.ts.log
tests/parcours/hors-ligne-client.test.ts               FAIL     1.1s      1     .test-logs/tests__parcours__hors-ligne-client.test.ts.log
tests/parcours/hors-ligne-codes.test.ts                FAIL     4.3s      1     .test-logs/tests__parcours__hors-ligne-codes.test.ts.log
tests/parcours/hors-ligne-rotation.test.ts             FAIL     5.2s      1     .test-logs/tests__parcours__hors-ligne-rotation.test.ts.log
tests/parcours/hors-ligne-service-worker.test.ts       FAIL     704ms     1     .test-logs/tests__parcours__hors-ligne-service-worker.test.ts.log
tests/parcours/inscription-numero-dabord.test.ts       FAIL     1.1s      1     .test-logs/tests__parcours__inscription-numero-dabord.test.ts.log
tests/parcours/interrupteurs.test.ts                   FAIL     1.5s      1     .test-logs/tests__parcours__interrupteurs.test.ts.log
tests/parcours/notif-admin.test.ts                     FAIL     2.6s      1     .test-logs/tests__parcours__notif-admin.test.ts.log
tests/parcours/notif-admins.test.ts                    FAIL     3.6s      1     .test-logs/tests__parcours__notif-admins.test.ts.log
tests/parcours/notif-canaux.test.ts                    FAIL     3.8s      1     .test-logs/tests__parcours__notif-canaux.test.ts.log
tests/parcours/notif-envoyeur.test.ts                  FAIL     2.2s      1     .test-logs/tests__parcours__notif-envoyeur.test.ts.log
tests/parcours/notif-migration.test.ts                 FAIL     1.2s      1     .test-logs/tests__parcours__notif-migration.test.ts.log
tests/parcours/notif-modeles.test.ts                   FAIL     641ms     1     .test-logs/tests__parcours__notif-modeles.test.ts.log
tests/parcours/notif-outbox.test.ts                    FAIL     1.4s      1     .test-logs/tests__parcours__notif-outbox.test.ts.log
tests/parcours/notif-preferences.test.ts               FAIL     2.8s      1     .test-logs/tests__parcours__notif-preferences.test.ts.log
tests/parcours/notif-rappels-annulation.test.ts        FAIL     850ms     1     .test-logs/tests__parcours__notif-rappels-annulation.test.ts.log
tests/parcours/notif-rappels.test.ts                   FAIL     690ms     1     .test-logs/tests__parcours__notif-rappels.test.ts.log
tests/parcours/notif-reglages.test.ts                  FAIL     1.0s      1     .test-logs/tests__parcours__notif-reglages.test.ts.log
tests/parcours/notif-transferts.test.ts                FAIL     2.7s      1     .test-logs/tests__parcours__notif-transferts.test.ts.log
tests/parcours/otp-serveur.test.ts                     FAIL     547ms     1     .test-logs/tests__parcours__otp-serveur.test.ts.log
tests/parcours/paiement-attente-lot7.test.ts           FAIL     2.3s      1     .test-logs/tests__parcours__paiement-attente-lot7.test.ts.log
tests/parcours/partenaire-lot7.test.ts                 FAIL     3.9s      1     .test-logs/tests__parcours__partenaire-lot7.test.ts.log
tests/parcours/perf-statique.test.ts                   FAIL     1.9s      1     .test-logs/tests__parcours__perf-statique.test.ts.log
tests/parcours/push-service-worker.test.ts             FAIL     682ms     1     .test-logs/tests__parcours__push-service-worker.test.ts.log
tests/parcours/pwa-manifest.test.ts                    FAIL     865ms     1     .test-logs/tests__parcours__pwa-manifest.test.ts.log
tests/parcours/rappels-gratuits.test.ts                FAIL     820ms     1     .test-logs/tests__parcours__rappels-gratuits.test.ts.log
tests/parcours/scan-controleur-stats.test.ts           FAIL     3.4s      1     .test-logs/tests__parcours__scan-controleur-stats.test.ts.log
tests/parcours/scan-idempotence.test.ts                FAIL     2.6s      1     .test-logs/tests__parcours__scan-idempotence.test.ts.log
tests/parcours/scanner-interface.test.ts               FAIL     718ms     1     .test-logs/tests__parcours__scanner-interface.test.ts.log
tests/parcours/securite-admin-lot7.test.ts             FAIL     2.5s      1     .test-logs/tests__parcours__securite-admin-lot7.test.ts.log
tests/parcours/sms-anti-abus.test.ts                   FAIL     634ms     1     .test-logs/tests__parcours__sms-anti-abus.test.ts.log
tests/parcours/sms-commande-4-billets.test.ts          FAIL     1.0s      0     .test-logs/tests__parcours__sms-commande-4-billets.test.ts.log
tests/parcours/sms-plafond-optionnel.test.ts           FAIL     1.1s      1     .test-logs/tests__parcours__sms-plafond-optionnel.test.ts.log
tests/parcours/sms-veille.test.ts                      FAIL     937ms     1     .test-logs/tests__parcours__sms-veille.test.ts.log
tests/parcours/terrain-invariant.test.ts               FAIL     1.3s      1     .test-logs/tests__parcours__terrain-invariant.test.ts.log
tests/scanner-combat-ui.test.ts                        FAIL     236ms     1     .test-logs/tests__scanner-combat-ui.test.ts.log
tests/schema/fonctions-privileges.test.ts              FAIL     236ms     1     .test-logs/tests__schema__fonctions-privileges.test.ts.log
tests/schema/migration-lot7-rejouable.test.ts          FAIL     673ms     1     .test-logs/tests__schema__migration-lot7-rejouable.test.ts.log
tests/schema/secrets-codes-en-dur.test.ts              FAIL     312ms     1     .test-logs/tests__schema__secrets-codes-en-dur.test.ts.log
tests/security/r22-reglages-notif.test.ts              FAIL     468ms     1     .test-logs/tests__security__r22-reglages-notif.test.ts.log
tests/security/r23-reglages-lot7.test.ts               FAIL     441ms     1     .test-logs/tests__security__r23-reglages-lot7.test.ts.log
tests/security/r24-categories-anon.test.ts             FAIL     509ms     1     .test-logs/tests__security__r24-categories-anon.test.ts.log
tests/security/r25-commandes-idor.test.ts              FAIL     604ms     1     .test-logs/tests__security__r25-commandes-idor.test.ts.log
tests/security/r3-fonctions-rpc.test.ts                FAIL     1.0s      1     .test-logs/tests__security__r3-fonctions-rpc.test.ts.log
TOTAL : 180 suite(s) — 128 réussie(s), 52 en échec, 0 expirée(s)
[verify] ÉCHEC à l'étape "test" (code 1).
```

Tri des 52 échecs (`scratchpad/lot7-run72-triage.md`) :
- 51 sont rouges pour la bonne raison ;
- 1 est une MAUVAISE (`secrets-codes-en-dur`, défaut d'un test du lot, corrigé par `7710e78`).

Il n'y a aucune erreur de montage, d'import, de typage ou de délai. Aucun `after()` ne masque un échec antérieur. Les invariants (a) à (o) sont à 0 violation partout.

Au même run, côté e2e :
- **terrain 4** est une MAUVAISE (`live-code` refuse un billet UTILISE) : la mesure « avant » du scan est absente du run 72, d'où les runs 73 et 74 ;
- **terrain 5** est « à vérifier » ;
- le **scanner** n'a ni FCP ni LCP au relevé `perf`.

### 6.2 Run 84 (référence « après »), `npm run verify`

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

[run-tests] 181 suite(s) — garde-fou : tests/helpers/env.ts — délai/suite : 600.0s
```

```text
TOTAL : 181 suite(s) — 181 réussie(s), 0 en échec, 0 expirée(s)

═══════════════ verify › build : npm run build ═══════════════
```

```text
═══════════════ verify › js-budget : node scripts/js-budget.mjs ═══════════════
[JS-BUDGET] budgets : scripts/js-budget.json
[JS-BUDGET] / : 214399 octets gzip (214,4 Ko), 16 fichier(s) JS, 741617 octets bruts — budget 217000 octets (217,0 Ko) : OK
[JS-BUDGET] /events/[id] : 220604 octets gzip (220,6 Ko), 16 fichier(s) JS, 766376 octets bruts — budget 224000 octets (224,0 Ko) : OK
[JS-BUDGET] /tickets : 237601 octets gzip (237,6 Ko), 20 fichier(s) JS, 814713 octets bruts — budget 241000 octets (241,0 Ko) : OK
[JS-BUDGET] /controller/scanner : 222499 octets gzip (222,5 Ko), 17 fichier(s) JS, 769681 octets bruts — budget 226000 octets (226,0 Ko) : OK
[JS-BUDGET] /billet/hors-ligne : 211561 octets gzip (211,6 Ko), 15 fichier(s) JS, 735210 octets bruts — budget 215000 octets (215,0 Ko) : OK
[JS-BUDGET] tableau écrit : .verify/js-budget.tsv
[JS-BUDGET] toutes les routes budgétées sont dans leur budget.

[verify] OK — 5 étapes réussies en 605s.
```

Sous-tests au run 84, somme des compteurs TAP des 181 journaux : 2 169 tests, 2 169 réussis, 0 en échec, 0 annulé. Au run 72 : 2 144 tests, 1 714 réussis, 407 en échec, 23 annulés.

**Run 83, pour mémoire** (`docs/lot7-logs/ci-run83-verify.log`). Verify s'y était arrêté à l'étape « test », et le build a été refait par `build-mesure` (`runs/83-41922500731/build-mesure.log`) :

```text
[run-tests] 181 suite(s) — garde-fou : tests/helpers/env.ts — délai/suite : 600.0s
═══════════════════ RÉCAPITULATIF ═══════════════════
Suite                                                  Statut   Durée     Code  Journal
tests/parcours/temps-reel-billets.test.ts              FAIL     79.7s     1     .test-logs/tests__parcours__temps-reel-billets.test.ts.log
TOTAL : 181 suite(s) — 180 réussie(s), 1 en échec, 0 expirée(s)
[verify] ÉCHEC à l'étape "test" (code 1).
```

### 6.3 Instabilité observée une fois : `temps-reel-billets` au run 83

Journal complet : `docs/lot7-logs/ci-run83-temps-reel-billets.log`. Lignes 1 à 23 :

```text
TAP version 13
# Subtest: Billet composté : statut mis à jour chez son porteur (O4)
    # Subtest: garde-fou : le porteur (filtre user_id) reçoit UTILISE au scan ; un autre client et anon ne reçoivent rien
    not ok 1 - garde-fou : le porteur (filtre user_id) reçoit UTILISE au scan ; un autre client et anon ne reçoivent rien
      ---
      duration_ms: 27732.664231
      type: 'test'
      location: '/home/runner/work/event-village/event-village/tests/parcours/temps-reel-billets.test.ts:2:3618'
      failureType: 'testCodeFailure'
      error: |-
        délai dépassé (20000 ms) : passage à UTILISE reçu par le porteur, sans recharger — 2 message(s) reçu(s) sur porteur tickets (filtre user_id)
          INSERT tickets {"id":"ee0956f7-90ff-47ca-b1b4-fe0c30da09d4","price":3000,"status":"VALIDE","user_id":"00829b96-a4d0-4976-be99-73af5be637e5","event_id":"85251a9c-edd5-4de7-9935-c2f17a8e34ae","order_id":null,"created_at":"2026-11-04T22:20:19.255936+00:00","payment_id":"7181dafb-bf65-42aa-bac0-2c1334e9557e","updated_at":"2026-11-04T22:20:19.255936+00:00","category_id":"5a62e53b-95f7-42b4-8386-3e9d7851cd43","service_fee":150,"sale_channel":"ONLINE","checked_in_at":null,"checked_in_by":null,"ticket_number":"TCK-20261104-C5591E6164","transfer_locked":false,"security_version":1}
          INSERT tickets {"id":"4ce470fa-ecbc-41d6-a41f-d0b4453910d2","price":3000,"status":"VALIDE","user_id":"00829b96-a4d0-4976-be99-73af5be637e5","event_id":"85251a9c-edd5-4de7-9935-c2f17a8e34ae","order_id":null,"created_at":"2026-11-04T22:20:19.255936+00:00","payment_id":"7181dafb-bf65-42aa-bac0-2c1334e9557e","updated_at":"2026-11-04T22:20:19.255936+00:00","category_id":"5a62e53b-95f7-42b4-8386-3e9d7851cd43","service_fee":150,"sale_channel":"ONLINE","checked_in_at":null,"checked_in_by":null,"ticket_number":"TCK-20261104-8009A75756","transfer_locked":false,"security_version":1}
      code: 'ERR_TEST_FAILURE'
      stack: |-
        waitForEvent (/home/runner/work/event-village/event-village/tests/helpers/realtime.ts:226:19)
        async TestContext.<anonymous> (/home/runner/work/event-village/event-village/tests/parcours/temps-reel-billets.test.ts:130:26)
        async Test.run (node:internal/test_runner/test:1054:7)
        async Promise.all (index 0)
        async Suite.run (node:internal/test_runner/test:1442:7)
        async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
      ...
    # Subtest: totp_secret et qr_code : non lisibles par authenticated (REVOKE de colonne), absents de la charge reçue par le porteur et par le partenaire
```

Le porteur a bien reçu les deux INSERT de ses billets, mais pas le passage à UTILISE dans les 20 s. Le cas 2 de la même suite, qui ouvre aussi des abonnements temps réel, passe.

Même cas aux runs précédents (`runs/<n>/test-logs/tests__parcours__temps-reel-billets.test.ts.log`) :

```text
== 77-41877660414
    ok 1 - garde-fou : le porteur (filtre user_id) reçoit UTILISE au scan ; un autre client et anon ne reçoivent rien
      duration_ms: 7269.565713
== 78-41897429374
    ok 1 - garde-fou : le porteur (filtre user_id) reçoit UTILISE au scan ; un autre client et anon ne reçoivent rien
      duration_ms: 9123.954558
== 80-41903070105
    ok 1 - garde-fou : le porteur (filtre user_id) reçoit UTILISE au scan ; un autre client et anon ne reçoivent rien
      duration_ms: 7162.418314
== 83-41922500731
    not ok 1 - garde-fou : le porteur (filtre user_id) reçoit UTILISE au scan ; un autre client et anon ne reçoivent rien
      duration_ms: 27732.664231
== 84-41936361777
    ok 1 - garde-fou : le porteur (filtre user_id) reçoit UTILISE au scan ; un autre client et anon ne reçoivent rien
```

Démarrage de Supabase au run 83. Extrait de `runs/83-41922500731/supabase-start.log`, lignes 65-66, 169-170 et 246-247 ; ce fichier n'est pas recopié dans `docs/lot7-logs/`, car il affiche les URL et clés de démonstration de l'instance locale :

```text
error from registry: Rate exceeded
Retrying after 4s: public.ecr.aws/supabase/realtime:v2.147.1
error from registry: Rate exceeded
Retrying after 4s: public.ecr.aws/supabase/gotrue:v2.197.0
error from registry: Rate exceeded
Retrying after 4s: public.ecr.aws/supabase/postgres-meta:v0.100.0
```

**Lecture.**
- Au run 83, les images ont fini par être tirées, et toutes les autres suites temps réel passent : `temps-reel-prives` (71 s), `temps-reel-public` et `temps-reel-stock`.
- **Au run 84, le cas passe** (verify 181/181).
- Le registre a aussi répondu « Rate exceeded » au run 84 (`runs/84-41936361777/supabase-start.log:108-109` et `270-271`), mais sur `postgres-meta` et `postgres`, pas sur `realtime` :

```text
error from registry: Rate exceeded
Retrying after 4s: public.ecr.aws/supabase/postgres-meta:v0.100.0
error from registry: Rate exceeded
Retrying after 4s: public.ecr.aws/supabase/postgres:17.11.0.006
```

- Le cas a donc échoué **une seule fois sur cinq runs** où verify est allé au bout (77, 78, 80, 83, 84). Le lien avec le « Rate exceeded » de l'image `realtime` reste **SUPPOSÉ**.
- Le trigger de rotation du lot 7 (`trg_tickets_secret_guard`, BEFORE UPDATE sur `tickets`) est peu probable comme cause : le passage VALIDE → UTILISE ne déclenche pas de rotation (`hors-ligne-rotation` 7 est vert), et le cas est vert aux quatre autres runs avec ce trigger en place.
- **Constat retenu :** une instabilité observée une fois, gardée en point ouvert (section 15). Les journaux du run 83 restent dans `docs/lot7-logs/`.

### 6.4 Run 84, `npm run e2e`

Phases (`docs/lot7-logs/ci-run84-phases.tsv`) :

```text
phase	code	secondes
connexion	0	10
captures	0	688
emails	0	7
fumee	0	32
terrain	0	118
pwa	0	4
perf	0	184
```

Lignes de synthèse de `docs/lot7-logs/ci-run84-e2e.log` :

```text
  10 passed (9.2s)
[e2e] phase connexion : OK en 10s
[e2e] index des captures : .e2e-captures/captures/index.txt (286 entrée(s), 0 en échec)
  286 passed (11.5m)
[e2e] phase captures : OK en 688s
[e2e] index des captures : .e2e-captures/captures/index.txt (286 entrée(s), 0 en échec)
  5 passed (6.2s)
[e2e] phase emails : OK en 7s
[e2e] index des captures : .e2e-captures/captures/index.txt (286 entrée(s), 0 en échec)
  1 passed (31.7s)
[e2e] phase fumee : OK en 32s
[e2e] index des captures : .e2e-captures/captures/index.txt (286 entrée(s), 0 en échec)
  8 passed (2.0m)
[e2e] phase terrain : OK en 118s
[e2e] index des captures : .e2e-captures/captures/index.txt (286 entrée(s), 0 en échec)
  4 passed (3.1s)
[e2e] phase pwa : OK en 4s
[e2e] index des captures : .e2e-captures/captures/index.txt (286 entrée(s), 0 en échec)
  4 passed (3.1m)
[e2e] phase perf : OK en 184s
```

### 6.5 Tableau des runs 68 à 84

| Run | Identifiant | SHA | Branche | verify | e2e | Durée du job | Cause d'un échec |
|---|---|---|---|---|---|---|---|
| 68 | 41752757346 | `5ed2bee` | lot6/notifications | 152/152 | annulé | annulé | remplacé par la poussée de `afb0edb` et `6fff1bf` (incident de la migration 05) |
| 69 | 41755372697 | `6fff1bf` | lot6/notifications | 153/153 | captures 172/172, fumée OK | — | vert |
| 70 | 41756040588 | `6fff1bf` | main | 152/153 | non lancé | — | `acces-tracabilite` 4.9 : « au-delà du quota : HTTP 200 … 200 !== 429 » (rafale à cheval sur deux fenêtres de 10 s) |
| 71 | 41757570869 | `6fff1bf` | lot7/terrain | 153/153 | captures 172/172, fumée OK | — | vert (même commit que le run 70) |
| 72 | 41784697018 | `51e0c70` | lot7/terrain | 128/180 | captures 172/172, fumée OK, terrain 1/7, pwa 2/4, perf 4/4 | 2 603 s | run « avant » : tests rouges seuls ; terrain 4 MAUVAISE |
| 73 | 41793866877 | `1286752` | lot7/terrain | 129/180 | captures 172/172, fumée OK, terrain 1/7, pwa 2/4, perf 4/4 | 2 651 s | rouges attendus ; perf « avant » complète (A7) ; défaut A6 trouvé |
| 74 | 41800228547 | `cb56b5d` | lot7/terrain | 129/180 | idem | 2 778 s | rouges attendus ; scan « avant » : 3 lectures puis A6 (A8) |
| 75 | 41806726715 | `bd9d6e1` | lot7/terrain | 167/180 | seed en échec ; connexion 5/9, captures 24/172, fumée en échec, terrain 1/7, pwa 3/4, perf 1/4 | 1 314 s | serveur seul : 13 suites en attente des écrans ; seed en échec (D32 et M6, attendu jusqu'à `fe99f4a`) |
| 76 | 41816793690 | `020fda0` | lot7/terrain | 179/180 | seed en échec (QR `qr_expired`) ; connexion 5/9, captures 24/172, fumée OK, terrain 7/7, pwa 4/4, perf 1/4 | 1 429 s | `dette-interface-lot7` : `docs/architecture.md` cite des fichiers supprimés ; seed (D32) |
| 77 | 41877660414 | `0bc6e1d` | lot7/terrain | 180/180 | connexion 10/10, captures 270/286, emails 5/5, fumée en échec, terrain 7/7, pwa 4/4, perf 4/4 | 2 222 s | 16 captures sur 5 écrans ; fumée étape 10 (`REFUND_PAID` non attendu) |
| 78 | 41897429374 | `e82a9b9` | lot7/terrain | 180/180 | captures 286/286, emails 5/5, fumée en échec, terrain 7/7, pwa 4/4, perf 4/4 | 1 941 s | fumée étape 13 : `GET /api/features` hors ligne |
| 79 | 41902989817 | `b18b3dd` | lot7/terrain | — | — | 82 s | annulé, remplacé par la poussée de `8ce353c` |
| 80 | 41903070105 | `8ce353c` | lot7/terrain | 180/180 | captures 286/286, emails 5/5, fumée en échec, terrain 7/7, pwa 4/4, perf 4/4 | 2 222 s | fumée étape 5 : QR présenté, aucune lecture en 40 s (ZXing) |
| 81 | 41915822529 | `20378e3` | lot7/terrain | — | — | 98 s | runner : port 54322 « address already in use » au démarrage de Supabase |
| 82 | 41922023052 | `4f6499d` | lot7/terrain | — | — | 91 s | même incident du runner |
| 83 | 41922500731 | `aaf6542` | lot7/terrain | 180/181 | connexion 10/10, captures 286/286, emails 5/5, fumée OK, terrain 8/8, pwa 4/4, perf 4/4 | 2 287 s | `temps-reel-billets`, 1 cas : instabilité observée une fois (section 6.3) |
| **84** | **41936361777** | **`55afc8b`** | lot7/terrain | **181/181** | connexion 10/10, captures 286/286, emails 5/5, fumée OK, terrain 8/8, pwa 4/4, perf 4/4 | 1 857 s | **vert** (`job_status=success`) : run « après » de référence, sur le dernier commit de code |

Sources :
- verify : `TOTAL :` de chaque `verify.log` ;
- e2e : lignes `passed` et `failed` de chaque `e2e.log` ;
- durée : `job_elapsed_s` de `run.txt` (absente aux runs 68 à 71).

**Runs 81 et 82** (`runs/81-41915822529/supabase-start.log:281-283`, identique au run 82 à l'identifiant de conteneur près) :

```text
failed to start docker container "supabase_db_event-village": Error response from daemon: failed to set up container networking: driver failed programming external connectivity on endpoint supabase_db_event-village (c852759d9458f18e3cf6a53884bdeead32665b52f315f36d71ec5f3c9919fd1e): failed to bind host port 0.0.0.0:54322/tcp: address already in use
failed to start containers: 917469f4bada97928dc08ce8269972029d758a031eeb5e48ae01a5504bdb9681
Try rerunning the command with --debug to troubleshoot the error.
```

Ces runs ne sont pas liés au code. `aaf6542` journalise les ports et fait une seule nouvelle tentative après un arrêt propre. Au run 83, `supabase-start.log` ne contient aucune ligne « address already in use » : la nouvelle tentative n'a pas servi. La sortie de l'étape elle-même n'est pas publiée, donc ce point est **SUPPOSÉ**.

**Durée du job.** `timeout-minutes` est passé à 90 pour le run « avant » (A2), puis remis à 60 par `6934436`. Le run 84 dure 1 857 s, soit 31 min (le run 83 : 2 287 s, avec `build-mesure`). Les captures sont passées de 1 416 s (run 72, attente de 15 s) à 688 s (run 84, D84), avec 114 captures de plus.

**Journaux recopiés dans `docs/lot7-logs/`.**
- **run 84** (référence « après ») :
  - verify et e2e : `ci-run84-verify.log`, `ci-run84-e2e.log`, `ci-run84-e2e-seed.log` ;
  - mesures : `ci-run84-js-budget.tsv`, `ci-run84-perf.tsv`, `ci-run84-perf.txt`, `ci-run84-phases.tsv`, `ci-run84-scan.tsv`, `ci-run84-scan-lectures.tsv` ;
  - captures : `ci-run84-captures-index.txt`, `ci-run84-captures-avertissements.tsv`, `ci-run84-captures-emails.txt` ;
  - suite : `ci-run84-hors-ligne-codes.log` ;
- **run 83**, qui documente l'instabilité et l'état d'avant `28d62ae` :
  - verify et e2e : `ci-run83-verify.log`, `ci-run83-e2e.log`, `ci-run83-e2e-seed.log` ;
  - mesures : `ci-run83-js-budget.tsv`, `ci-run83-perf.tsv` et `.txt`, `ci-run83-phases.tsv`, `ci-run83-scan.tsv`, `ci-run83-scan-lectures.tsv` ;
  - captures : `ci-run83-captures-index.txt`, `ci-run83-captures-avertissements.tsv`, `ci-run83-captures-emails.txt` ;
  - suites : `ci-run83-temps-reel-billets.log`, `ci-run83-hors-ligne-codes.log` ;
- **run 72** (référence « avant ») : `ci-run72-verify.log` (une valeur `totp_secret` de test masquée), `ci-run72-e2e.log`, `ci-run72-js-budget.tsv`, `ci-run72-perf.tsv` ;
- **runs 73, 74 et 78** (mesures) : `ci-run73-js-budget.tsv`, `ci-run73-perf.tsv` et `.txt`, `ci-run73-phases.tsv` ; `ci-run74-js-budget.tsv`, `ci-run74-perf.tsv` et `.txt`, `ci-run74-phases.tsv`, `ci-run74-scan.tsv`, `ci-run74-scan-lectures.tsv` ; `ci-run78-js-budget.tsv`, `ci-run78-scan.tsv`, `ci-run78-scan-lectures.tsv`.

Le run 73 n'a pas de `scan.tsv` : la mesure du scan y échouait avant d'écrire, et c'est le run 74 qui fait foi pour le scan « avant » (A8).

---

## 7. Taille du lot de codes hors ligne

**Format** (contrat 3.1) : une chaîne de chiffres, 6 par code, pas de 20 s. Le lot est glissant, de 48 h au plus, et commence à `max(ouverture du contrôle, maintenant − 20 s)`. Quand le lot ne va pas jusqu'à la fermeture du contrôle, la réponse porte `complete: false` et `next_from` ; le client retélécharge quand son lot se termine dans moins de 24 h.

**Mesure en CI, sur la vraie route** (`hors-ligne-codes`, cas 7, run 84, `docs/lot7-logs/ci-run84-hors-ligne-codes.log:64-67` ; run 83 juste après, les codes et donc la compression varient de quelques octets) :

```text
[HORS-LIGNE-TAILLE] 3 jours, before = after = 48 h : 8640 codes, 52629 octets bruts, 25633 octets gzip (niveau 6)
[HORS-LIGNE-TAILLE] soirée de 4 h, réglages courants : 2162 codes, 13715 octets bruts, 6745 octets gzip (niveau 6)
    # Subtest: 7. taille : 3 jours avec before = after = 48 → 8 640 codes, lot glissant incomplet, gzip < 40 000 octets ; soirée par défaut complète
    ok 3 - 7. taille : 3 jours avec before = after = 48 → 8 640 codes, lot glissant incomplet, gzip < 40 000 octets ; soirée par défaut complète
```

```text
[HORS-LIGNE-TAILLE] 3 jours, before = after = 48 h : 8640 codes, 52629 octets bruts, 25663 octets gzip (niveau 6)
[HORS-LIGNE-TAILLE] soirée de 4 h, réglages courants : 2162 codes, 13715 octets bruts, 6750 octets gzip (niveau 6)
```

| Cas | Codes | Octets bruts | gzip niveau 6 | Source |
|---|---|---|---|---|
| « soirée de 4 h, réglages courants » (libellé du test ; 2 162 codes, soit 12 h de plage, que je n'ai pas recoupée avec les réglages de la base de test) | 2 162 | 13 715 | 6 745 (run 84) ; 6 750 (run 83) | CI |
| Fumée, événement à environ 20 h, `scan_window_before_hours` = 24 | 5 410 (run 84) ; 5 400 (run 83) | non mesuré | non mesuré | CI, `e2e.log:418` des deux runs |
| Journée de 00:00 à 23:59, 6 + 6 h (36 h) | 6 480 | 39,1 Ko | 19,1 Ko | découverte, script hors dépôt, clé fictive (`discovery-7-hors-ligne.md` §4.3) |
| 3 jours, before = after = 48 h : lot de 48 h | 8 640 | 52 629 | 25 633 (run 84) ; 25 663 (run 83) | CI (lot incomplet, `complete: false`) |
| Festival de 3 jours, 6 + 6 h (84 h) : sans découpage | 15 120 | 91,0 Ko | 43,6 Ko | découverte : dépasse 40 Ko, d'où le lot glissant de 48 h |

Bilan :
- **Seuil des 40 000 octets tenu** : 25 663 octets au pire (run 83 ; 25 633 au run 84), pour un lot de 48 h, soit une marge d'environ 36 %. Le test l'exige (`gzip < 40 000 octets`).
- **Découpage retenu** : lot glissant de 48 h. Tous les événements d'une journée, avec les réglages par défaut, tiennent en un seul lot.
- **NON VÉRIFIÉ :** la mesure « réelle » en e2e demandée par le contrat (16.7), avec l'en-tête `content-encoding` et la taille transférée, n'a pas été écrite. Ni la fumée ni `terrain` n'impriment la taille reçue.
- **Compression chez l'hébergeur** : le serveur Next compresse (`compress: true`, `next.config.mjs:38`). Sans gzip, un lot de 48 h fait 52 Ko. C'est un point ouvert du lot 8.

---

## 8. Performance avant et après

**Conditions.**
- Réseau 4G simulé (D83, DevTools « Slow 4G », ex-« Fast 3G ») : 562,5 ms de latence, 1,44 Mbit/s descendant, 675 kbit/s montant.
- Processeur ×4 (`Emulation.setCPUThrottlingRate`).
- Contexte neuf à chaque passage, cache vide, `serviceWorkers: 'block'`, hôtes de tuiles et d'images bloqués. 5 passages, médiane et maximum.
- Contrôle bloquant de cohérence : le plus gros chunk doit mettre au moins sa taille divisée par le débit.
- Scan en 3G (D83, DevTools « 3G », ex-« Slow 3G ») : 2 000 ms de latence, 400 kbit/s, 400 kbit/s, appliqué par CDP après le chargement.

Les noms DevTools sont SUPPOSÉS ; les valeurs sont celles du code.

**Avertissements sur ces chiffres.**
- La CI fait tourner l'application, la base et le navigateur sur la même machine : les allers-retours serveur sont locaux, seul le bridage réseau est simulé. Les chiffres de scan « en réseau normal » ne représentent donc pas un vrai réseau.
- Les mesures sur un hébergement réel reviennent au lot 8.
- Le marqueur « premier affichage utile » du scanner change entre avant et après, parce que l'écran du lot 6 a disparu : `#scanner-event-title` avant, `fieldset input[type="radio"]` après. Les deux chiffres ne sont pas strictement comparables.

### 8.1 Poids JavaScript après build (`[JS-BUDGET]`, gzip niveau 9, layout racine et template compris)

| Route | Avant (runs 72 à 74) | Run 76 (vague E) | Run 78 | Run 83 | **Run 84** | Budget bloquant au run 84 | Avant → run 84 | Exigence du contrat |
|---|---|---|---|---|---|---|---|---|
| `/` | 212 548 | 219 327 | 213 936 | 214 311 | **214 399** | 217 000 | + 1 851 | — |
| `/events/[id]` | 227 446 | 225 617 | 220 228 | 220 516 | **220 604** | 224 000 | − 6 842 | — |
| `/tickets` | 276 353 | 241 824 | 237 184 | 237 472 | **237 601** | 241 000 | **− 38 752** | ≤ avant − 35 Ko (241 353) : **tenue** |
| `/controller/scanner` | 229 207 | 232 950 | 227 807 | 229 698 | **222 499** | 226 000 (`28d62ae`) | **− 6 708** | ≤ avant − 10 Ko (219 207) : **manquée de 3 292 octets** |
| `/billet/hors-ligne` | absente | 216 561 | 211 185 | 211 473 | **211 561** | 215 000 | — | ≤ 150 Ko (SUPPOSÉ au contrat) : **impossible** |

Au run 84, verify fait lui-même le build et la mesure (`ci-run84-verify.log:20218-20228`, section 6.2). Tous les budgets sont tenus.

Fichiers bruts : `docs/lot7-logs/ci-run72-js-budget.tsv`, `ci-run73-js-budget.tsv`, `ci-run74-js-budget.tsv` (identiques entre eux), `ci-run78-js-budget.tsv`, `ci-run83-js-budget.tsv` et `ci-run84-js-budget.tsv`.

```text
route	fichiers	octets_gzip	octets_bruts	budget	statut
/	16	212548	736331		MESURE
/events/[id]	17	227446	787413		MESURE
/tickets	19	276353	937098		MESURE
/controller/scanner	18	229207	800436		MESURE
/billet/hors-ligne	0				ABSENTE
```
```text
route	fichiers	octets_gzip	octets_bruts	budget	statut
/	16	214399	741617	217000	OK
/events/[id]	16	220604	766376	224000	OK
/tickets	20	237601	814713	241000	OK
/controller/scanner	17	222499	769681	226000	OK
/billet/hors-ligne	15	211561	735210	215000	OK
```

**Pourquoi le scanner et la page hors ligne ne descendent pas davantage.** Mesure d'E6, faite sur le poste et non en CI :
- le layout racine et le template pèsent à eux seuls environ 200 238 octets, dont le framework (environ 88 Ko) et le client Supabase (environ 68,8 Ko, chunks 5283 et 44530001) ;
- le passage des pages publiques en composants serveur, qui permettrait de sortir Supabase du layout, est hors lot (D79, point ouvert).

**Le scanner au fil des runs :**
- au run 78, il avait baissé de 1,4 Ko ;
- entre le run 80 (227 868) et le run 83 (229 698), il a repris 1 830 octets, avec la reprise de session (`4f6499d`) et le changement de décodeur (`20378e3`) ;
- `28d62ae` le ramène à 222 499 au run 84 : caméra, plein écran du résultat, bandeau de caisse et onglets chargés par `import()`, préchargés dès l'écran « Commencer le contrôle » (`lib/scan/deferred-part.ts`), rendus directement une fois chargés ;
- c'est 6,7 Ko sous l'« avant ». **L'objectif de − 10 Ko reste manqué de 3,3 Ko.**

**Leviers appliqués :**
- framer-motion retiré ;
- parties du scanner chargées à la demande et préchargées (`28d62ae`) ;
- modales de `/tickets`, `ShiftModals`, `CounterSalePanel`, `PaymentModal`, `EventMap` et ZXing chargés à la demande ;
- synchronisation hors ligne montée seulement pour un compte CLIENT, à la demande ;
- `StatusBadge` sans `outbox-labels` ;
- dépendances de la cloche chargées à l'ouverture.

### 8.2 Temps d'affichage et JavaScript transféré (e2e `perf`, médianes de 5 passages)

« Avant » : run 73 (`1286752`), qui fait foi pour les temps d'affichage (A7). « Après » : run 84 (`55afc8b`) ; le run 83 est donné entre crochets pour le scanner, dont le chargement change avec `28d62ae`.

| Écran | Premier affichage utile | FCP | LCP | JS avant le marqueur (a) | JS à + 3 s (b) |
|---|---|---|---|---|---|
| Accueil `/` | 4 673 → 4 726 ms | 1 480 → 1 484 ms | 1 480 → 1 484 ms | 215,8 → 218,0 Ko | 250,9 → 250,4 Ko |
| Page événement | 4 703 → 4 656 ms | 1 460 → 1 452 ms | 5 396 → 5 344 ms | 230,7 → 224,3 Ko | 322,8 → 270,5 Ko |
| Mes billets `/tickets` | 5 754 → 5 769 ms | 1 472 → 1 476 ms | 6 764 → 7 108 ms | 279,7 → 241,3 Ko | 371,3 → 321,3 Ko |
| Scanner, avant la caméra | 4 748 → 4 670 ms [run 83 : 4 671] | 4 768 → 1 456 ms [1 484] | 4 768 → 4 696 ms [4 688] | 235,2 → 233,5 Ko [236,2] | 385,3 → 273,6 Ko [269,8] |
| Scanner, caméra lancée | caméra en lecture : 7 962 → 7 927 ms [8 045] | — | — | — | 385,3 → 450,8 Ko [446,8] |

**Lecture honnête.**
- Le JavaScript transféré baisse nettement sur Mes billets (− 38,4 Ko avant le marqueur, − 50,0 Ko à + 3 s), sur la page événement (− 52,3 Ko à + 3 s) et sur le scanner avant la caméra (− 111,7 Ko à + 3 s).
- Les **temps ne s'améliorent pas** :
  - le premier affichage utile reste entre 4,7 et 5,8 s ;
  - le LCP de Mes billets **augmente** de 344 ms ;
  - ces temps restent au-dessus des seuils d'avertissement : 3 s pour l'affichage utile sur les quatre écrans, et 4 s pour le LCP sur la page événement, Mes billets et le scanner. On compte 7 lignes `[PERF-AVERTISSEMENT]` aux runs 84, 83 et 73, et 5 au run 72.
- Ces temps sont dominés par la latence simulée (562,5 ms par aller-retour), les appels d'API de chaque page et le processeur ×4 ; ce n'est pas un problème de poids. La cause du LCP de Mes billets **n'est pas instruite** (NON VÉRIFIÉ). Le lien probable avec l'image de l'affiche, désormais au-dessus du titre, est **SUPPOSÉ**.
- Le FCP du scanner passe de 4 768 à 1 456 ms : l'écran « Commencer le contrôle » s'affiche avant toute lecture de données.
- Avec `28d62ae`, le JavaScript du scanner avant le marqueur baisse un peu (236,2 → 233,5 Ko). À + 3 s, il remonte (269,8 → 273,6 Ko) : les parties différées sont préchargées dès l'écran de départ.
- À + 3 s une fois la caméra lancée, le scanner charge 450,8 Ko au lieu de 385,3 Ko avant le lot (396,0 Ko au run 78). L'écart vient de jsQR, de la reprise de session et des parties préchargées ; il n'est pas réparti entre eux (NON VÉRIFIÉ). Ce JavaScript n'entre pas dans le budget post-build de la route, qui ne mesure que le premier chargement.

Fichiers bruts : `docs/lot7-logs/ci-run73-perf.txt`, `ci-run83-perf.txt` et `ci-run84-perf.txt`, avec les TSV associés.

```text
Accueil (/, anonyme) — 5 passages, 4G (DevTools « Slow 4G »), processeur ×4
  premier affichage utile : médiane 4673 ms, max 4683 ms ; FCP médiane 1480 ms ; LCP médiane 1480 ms, max 1488 ms
  JavaScript (a) avant le marqueur : médiane 215,8 Ko, max 215,8 Ko ; (b) à + 3 s : médiane 250,9 Ko ; CSS 19,1 Ko ; total 362,7 Ko ; recoupement réseau 251,4 Ko
  budget post-build / : aucun (mesure seule)
Page événement (/events/086c26fc-a361-40e7-b75f-cd8b7ee1b1bc, anonyme) — 5 passages, 4G (DevTools « Slow 4G »), processeur ×4
  premier affichage utile : médiane 4703 ms, max 4714 ms ; FCP médiane 1460 ms ; LCP médiane 5396 ms, max 5404 ms
  JavaScript (a) avant le marqueur : médiane 230,7 Ko, max 230,7 Ko ; (b) à + 3 s : médiane 322,8 Ko ; CSS 21,8 Ko ; total 419,8 Ko ; recoupement réseau 323,3 Ko
  budget post-build /events/[id] : aucun (mesure seule)
Mes billets (/tickets, client) — 5 passages, 4G (DevTools « Slow 4G »), processeur ×4
  premier affichage utile : médiane 5754 ms, max 5777 ms ; FCP médiane 1472 ms ; LCP médiane 6764 ms, max 6888 ms
  JavaScript (a) avant le marqueur : médiane 279,7 Ko, max 279,7 Ko ; (b) à + 3 s : médiane 371,3 Ko ; CSS 19,1 Ko ; total 495,3 Ko ; recoupement réseau 372,0 Ko
  budget post-build /tickets : aucun (mesure seule)
Scanner (/controller/scanner, controleur) — 5 passages, 4G (DevTools « Slow 4G »), processeur ×4
  premier affichage utile : médiane 4748 ms, max 4757 ms ; FCP médiane 4768 ms ; LCP médiane 4768 ms, max 4772 ms
  JavaScript (a) avant le marqueur : médiane 235,2 Ko, max 235,2 Ko ; (b) à + 3 s : médiane 385,3 Ko ; CSS 19,1 Ko ; total 446,7 Ko ; recoupement réseau 385,9 Ko
  caméra en lecture : médiane 7962 ms ; JavaScript à + 3 s caméra lancée : médiane 385,3 Ko, max 385,3 Ko
  budget post-build /controller/scanner : aucun (mesure seule)

```

```text
Accueil (/, anonyme) — 5 passages, 4G (DevTools « Slow 4G »), processeur ×4
  premier affichage utile : médiane 4726 ms, max 4728 ms ; FCP médiane 1484 ms ; LCP médiane 1484 ms, max 1488 ms
  JavaScript (a) avant le marqueur : médiane 218,0 Ko, max 218,0 Ko ; (b) à + 3 s : médiane 250,4 Ko ; CSS 17,1 Ko ; total 348,1 Ko ; recoupement réseau 250,8 Ko
  budget post-build / : 217,0 Ko + 20,0 Ko de tolérance
Page événement (/events/6233c9d7-ef1b-46d1-bd09-9926326afd1d, anonyme) — 5 passages, 4G (DevTools « Slow 4G »), processeur ×4
  premier affichage utile : médiane 4656 ms, max 4661 ms ; FCP médiane 1452 ms ; LCP médiane 5344 ms, max 5372 ms
  JavaScript (a) avant le marqueur : médiane 224,3 Ko, max 224,3 Ko ; (b) à + 3 s : médiane 270,5 Ko ; CSS 17,1 Ko ; total 353,5 Ko ; recoupement réseau 271,0 Ko
  budget post-build /events/[id] : 224,0 Ko + 20,0 Ko de tolérance
Mes billets (/tickets, client) — 5 passages, 4G (DevTools « Slow 4G »), processeur ×4
  premier affichage utile : médiane 5769 ms, max 5810 ms ; FCP médiane 1476 ms ; LCP médiane 7108 ms, max 7148 ms
  JavaScript (a) avant le marqueur : médiane 241,3 Ko, max 241,3 Ko ; (b) à + 3 s : médiane 321,3 Ko ; CSS 17,1 Ko ; total 493,2 Ko ; recoupement réseau 321,9 Ko
  budget post-build /tickets : 241,0 Ko + 20,0 Ko de tolérance
Scanner (/controller/scanner, controleur) — 5 passages, 4G (DevTools « Slow 4G »), processeur ×4
  premier affichage utile : médiane 4670 ms, max 4689 ms ; FCP médiane 1456 ms ; LCP médiane 4696 ms, max 4712 ms
  JavaScript (a) avant le marqueur : médiane 233,5 Ko, max 235,1 Ko ; (b) à + 3 s : médiane 273,6 Ko ; CSS 17,1 Ko ; total 331,1 Ko ; recoupement réseau 274,1 Ko
  caméra en lecture : médiane 7927 ms ; JavaScript à + 3 s caméra lancée : médiane 450,8 Ko, max 450,8 Ko
  budget post-build /controller/scanner : 226,0 Ko + 20,0 Ko de tolérance

```

### 8.3 Temps du scan (e2e `terrain` 4, `pending − read` et `result − read`)

« Avant » : run 74 (`cb56b5d`, A8). L'écran du lot 6 n'avait pas de marques de performance : seule la sonde du test mesure, et seulement 3 lectures de billets neufs en réseau normal. Au 4ᵉ billet, l'écran a avalé la lecture (A6 : 19 lectures, aucun POST). **Il n'existe donc aucune mesure en 3G sur l'ancien écran.**

```text
reseau	source	mesure	n	mediane_ms	p95_ms	min_ms	max_ms
normal	marques	attente	0	—	—	—	—
normal	marques	resultat	0	—	—	—	—
normal	sonde	attente	0	—	—	—	—
normal	sonde	resultat	3	53	93	50	93
normal	sonde-lecture-envoyee	resultat	3	53	93	50	93
3G	marques	attente	0	—	—	—	—
3G	marques	resultat	0	—	—	—	—
3G	sonde	attente	0	—	—	—	—
3G	sonde	resultat	0	—	—	—	—
3G	sonde-lecture-envoyee	resultat	0	—	—	—	—
```

« Après » : run 78 (`e82a9b9`), run 83 (`aaf6542`) et run 84 (`55afc8b`), 15 lectures par réseau (10 billets neufs et 5 relectures « déjà utilisé »).

```text
reseau	source	mesure	n	mediane_ms	p95_ms	min_ms	max_ms
normal	marques	attente	15	3	6	2	6
normal	marques	resultat	15	38	56	35	56
normal	sonde	attente	15	11	18	4	18
normal	sonde	resultat	15	47	58	37	58
normal	sonde-lecture-envoyee	resultat	15	47	58	37	58
3G	marques	attente	15	3	3	2	3
3G	marques	resultat	15	2039	2043	2030	2043
3G	sonde	attente	15	10	18	3	18
3G	sonde	resultat	15	2045	2054	2034	2054
3G	sonde-lecture-envoyee	resultat	15	2045	2054	2034	2054
```

```text
reseau	source	mesure	n	mediane_ms	p95_ms	min_ms	max_ms
normal	marques	attente	15	3	4	2	4
normal	marques	resultat	15	48	57	44	57
normal	sonde	attente	15	13	16	3	16
normal	sonde	resultat	15	62	68	45	68
normal	sonde-lecture-envoyee	resultat	15	62	68	45	68
3G	marques	attente	15	3	4	2	4
3G	marques	resultat	15	2039	2039	2018	2039
3G	sonde	attente	15	12	17	4	17
3G	sonde	resultat	15	2044	2055	2027	2055
3G	sonde-lecture-envoyee	resultat	15	2044	2055	2027	2055
```

```text
reseau	source	mesure	n	mediane_ms	p95_ms	min_ms	max_ms
normal	marques	attente	15	3	4	2	4
normal	marques	resultat	15	44	56	40	56
normal	sonde	attente	15	10	18	4	18
normal	sonde	resultat	15	48	67	42	67
normal	sonde-lecture-envoyee	resultat	15	48	67	42	67
3G	marques	attente	15	3	4	2	4
3G	marques	resultat	15	2039	2044	2037	2044
3G	sonde	attente	15	10	18	3	18
3G	sonde	resultat	15	2048	2060	2040	2060
3G	sonde-lecture-envoyee	resultat	15	2048	2060	2040	2060
```

| Mesure (médiane / p95) | Avant (run 74, sonde, n = 3) | Run 78 | Run 83 | **Run 84** | Objectif |
|---|---|---|---|---|---|
| Normal : état d'attente affiché (marques) | — | 3 / 6 ms | 3 / 4 ms | **3 / 4 ms** | ≤ 300 ms (bloquant) : **tenu** |
| Normal : résultat affiché (marques) | — | 38 / 56 ms | 48 / 57 ms | **44 / 56 ms** | ≤ 1 000 ms (bloquant) : **tenu** |
| Normal : résultat (sonde du test) | 53 / 93 ms | 47 / 58 ms | 62 / 68 ms | **48 / 67 ms** | — |
| 3G : état d'attente (marques) | — | 3 / 3 ms | 3 / 4 ms | **3 / 4 ms** | ≤ 300 ms (bloquant) : **tenu** |
| 3G : résultat (marques) | — | 2 039 / 2 043 ms | 2 039 / 2 039 ms | **2 039 / 2 044 ms** | imprimé seulement ; ≈ la latence imposée de 2 000 ms |

Au run 84, après le chargement différé de `28d62ae`, le premier verdict n'est pas ralenti : médiane de 44 ms, et « lectures ignorées par l'écran : 0 sur 30 » (`ci-run84-e2e.log:523`).

Lignes `[SCAN-MESURE]` du run 84 (`ci-run84-e2e.log:492-537`) :

```text
[SCAN-MESURE] réseau 3G (D83) : latence 2000 ms, 400 kbit/s descendant, 400 kbit/s montant ; tableaux tenus à jour lecture par lecture dans /home/runner/work/event-village/event-village/.e2e-captures/perf/scan.tsv et scan-lectures.tsv
[SCAN-MESURE] normal valid TCK-20261105-B1A4F24B8F : obtenu « valid », lectures 1, sonde résultat − lecture 43 ms, marques attente 3 ms / résultat 42 ms
[SCAN-MESURE] normal valid TCK-20261105-CC0F35894F : obtenu « valid », lectures 1, sonde résultat − lecture 50 ms, marques attente 3 ms / résultat 42 ms
[SCAN-MESURE] normal valid TCK-20261105-0B959286B8 : obtenu « valid », lectures 1, sonde résultat − lecture 56 ms, marques attente 3 ms / résultat 46 ms
[SCAN-MESURE] normal valid TCK-20261105-BE6909158F : obtenu « valid », lectures 1, sonde résultat − lecture 46 ms, marques attente 2 ms / résultat 45 ms
[SCAN-MESURE] normal valid TCK-20261105-1F45D05C7F : obtenu « valid », lectures 1, sonde résultat − lecture 47 ms, marques attente 3 ms / résultat 47 ms
[SCAN-MESURE] normal valid TCK-20261105-62426E7D0A : obtenu « valid », lectures 1, sonde résultat − lecture 48 ms, marques attente 3 ms / résultat 42 ms
[SCAN-MESURE] normal valid TCK-20261105-596E718A12 : obtenu « valid », lectures 1, sonde résultat − lecture 55 ms, marques attente 3 ms / résultat 48 ms
[SCAN-MESURE] normal valid TCK-20261105-EA65C6E6E9 : obtenu « valid », lectures 1, sonde résultat − lecture 55 ms, marques attente 3 ms / résultat 41 ms
[SCAN-MESURE] normal valid TCK-20261105-58AE4358FD : obtenu « valid », lectures 1, sonde résultat − lecture 46 ms, marques attente 3 ms / résultat 44 ms
[SCAN-MESURE] normal valid TCK-20261105-5311574E96 : obtenu « valid », lectures 1, sonde résultat − lecture 51 ms, marques attente 4 ms / résultat 44 ms
[SCAN-MESURE] 3G valid TCK-20261105-51D823C7A9 : obtenu « valid », lectures 1, sonde résultat − lecture 2040 ms, marques attente 3 ms / résultat 2037 ms
[SCAN-MESURE] 3G valid TCK-20261105-821636871D : obtenu « valid », lectures 1, sonde résultat − lecture 2051 ms, marques attente 4 ms / résultat 2038 ms
[SCAN-MESURE] 3G valid TCK-20261105-B022CF0560 : obtenu « valid », lectures 1, sonde résultat − lecture 2045 ms, marques attente 3 ms / résultat 2040 ms
[SCAN-MESURE] 3G valid TCK-20261105-B31C0EC51D : obtenu « valid », lectures 1, sonde résultat − lecture 2054 ms, marques attente 2 ms / résultat 2038 ms
[SCAN-MESURE] 3G valid TCK-20261105-6A4302E5A2 : obtenu « valid », lectures 1, sonde résultat − lecture 2048 ms, marques attente 3 ms / résultat 2039 ms
[SCAN-MESURE] 3G valid TCK-20261105-F58D99EBD8 : obtenu « valid », lectures 1, sonde résultat − lecture 2041 ms, marques attente 2 ms / résultat 2038 ms
[SCAN-MESURE] 3G valid TCK-20261105-335115BE05 : obtenu « valid », lectures 1, sonde résultat − lecture 2052 ms, marques attente 3 ms / résultat 2040 ms
[SCAN-MESURE] 3G valid TCK-20261105-388B2692C7 : obtenu « valid », lectures 1, sonde résultat − lecture 2044 ms, marques attente 3 ms / résultat 2039 ms
[SCAN-MESURE] 3G valid TCK-20261105-B160BD0D3B : obtenu « valid », lectures 1, sonde résultat − lecture 2055 ms, marques attente 2 ms / résultat 2040 ms
[SCAN-MESURE] 3G valid TCK-20261105-5C86F66E96 : obtenu « valid », lectures 1, sonde résultat − lecture 2050 ms, marques attente 3 ms / résultat 2038 ms
[SCAN-MESURE] normal already_used TCK-20261105-B1A4F24B8F : obtenu « already_used », lectures 1, sonde résultat − lecture 42 ms, marques attente 2 ms / résultat 42 ms
[SCAN-MESURE] normal already_used TCK-20261105-CC0F35894F : obtenu « already_used », lectures 1, sonde résultat − lecture 48 ms, marques attente 3 ms / résultat 40 ms
[SCAN-MESURE] normal already_used TCK-20261105-0B959286B8 : obtenu « already_used », lectures 1, sonde résultat − lecture 57 ms, marques attente 3 ms / résultat 44 ms
[SCAN-MESURE] normal already_used TCK-20261105-BE6909158F : obtenu « already_used », lectures 1, sonde résultat − lecture 45 ms, marques attente 3 ms / résultat 43 ms
[SCAN-MESURE] normal already_used TCK-20261105-1F45D05C7F : obtenu « already_used », lectures 1, sonde résultat − lecture 67 ms, marques attente 3 ms / résultat 56 ms
[SCAN-MESURE] 3G already_used TCK-20261105-51D823C7A9 : obtenu « already_used », lectures 1, sonde résultat − lecture 2060 ms, marques attente 2 ms / résultat 2044 ms
[SCAN-MESURE] 3G already_used TCK-20261105-821636871D : obtenu « already_used », lectures 1, sonde résultat − lecture 2048 ms, marques attente 3 ms / résultat 2038 ms
[SCAN-MESURE] 3G already_used TCK-20261105-B022CF0560 : obtenu « already_used », lectures 1, sonde résultat − lecture 2041 ms, marques attente 2 ms / résultat 2040 ms
[SCAN-MESURE] 3G already_used TCK-20261105-B31C0EC51D : obtenu « already_used », lectures 1, sonde résultat − lecture 2050 ms, marques attente 3 ms / résultat 2038 ms
[SCAN-MESURE] 3G already_used TCK-20261105-6A4302E5A2 : obtenu « already_used », lectures 1, sonde résultat − lecture 2044 ms, marques attente 2 ms / résultat 2039 ms
[SCAN-MESURE] lectures ignorées par l'écran (QR relu au moins une fois avant l'envoi) : 0 sur 30
[SCAN-MESURE] normal:marques:attente : n=15 médiane=3 ms p95=4 ms (min 2, max 4)
[SCAN-MESURE] normal:marques:resultat : n=15 médiane=44 ms p95=56 ms (min 40, max 56)
[SCAN-MESURE] normal:sonde:attente : n=15 médiane=10 ms p95=18 ms (min 4, max 18)
[SCAN-MESURE] normal:sonde:resultat : n=15 médiane=48 ms p95=67 ms (min 42, max 67)
[SCAN-MESURE] normal:sonde-lecture-envoyee:resultat : n=15 médiane=48 ms p95=67 ms (min 42, max 67)
[SCAN-MESURE] 3G:marques:attente : n=15 médiane=3 ms p95=4 ms (min 2, max 4)
[SCAN-MESURE] 3G:marques:resultat : n=15 médiane=2039 ms p95=2044 ms (min 2037, max 2044)
[SCAN-MESURE] 3G:sonde:attente : n=15 médiane=10 ms p95=18 ms (min 3, max 18)
[SCAN-MESURE] 3G:sonde:resultat : n=15 médiane=2048 ms p95=2060 ms (min 2040, max 2060)
[SCAN-MESURE] 3G:sonde-lecture-envoyee:resultat : n=15 médiane=2048 ms p95=2060 ms (min 2040, max 2060)
[SCAN-MESURE] AVERTISSEMENT (non bloquant) normal:marques:attente p95=4 ms
[SCAN-MESURE] AVERTISSEMENT (non bloquant) normal:marques:resultat p95=56 ms
[SCAN-MESURE] AVERTISSEMENT (non bloquant) 3G:marques:attente p95=4 ms
[SCAN-MESURE] AVERTISSEMENT (non bloquant) 3G:marques:resultat p95=2044 ms
```

---

## 9. Avertissements et contrôles bloquants des captures au run final

**Ce qui est bloquant au lot 7** (D73, `e2e/support/checks.ts`) :
- au moins une règle axe en échec ;
- une cible de moins de 44 px ;
- un texte de moins de 14 px hors exemption ;
- sur les écrans du scanner, un contraste du plein écran inférieur à 7:1.

Les textes de moins de 14 px **admis** restent des avertissements et sont listés : `small`, `time`, `figcaption`, `caption`, `legend`, texte SVG, `[data-ev-caption]`.

**Run 84** (identique au run 83, sauf le nombre de préchargements).
- 286 captures, 0 en échec.
- 0 texte de moins de 14 px hors exemption, 0 cible de moins de 44 px, 0 règle axe.
- 268 captures portent un avertissement non bloquant : uniquement des textes de moins de 14 px admis.
- 129 préchargements Next abandonnés, non bloquants (119 au run 83 ; règle du lot 6).

Tableau écran × règle (`docs/lot7-logs/ci-run84-captures-index.txt:13-94`, identique au run 83) :

```text
TABLEAU ÉCRAN × RÈGLE (avertissements ; valeurs par vue : m-c/m-s/o-c/o-s = mobile clair/sombre, ordinateur clair/sombre ; ? = contrôles non exécutés)
écran | cibles < 44 px | textes < 14 px bruts | dont admis | dont hors exemption | axe (règles, nœuds au plus)
accueil | 0/0/0/0 | 12/12/8/8 | 12/12/8/8 | 0/0/0/0 | aucune
admin-campagnes | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
admin-evenements | 0/0/0/0 | 10/10/5/5 | 10/10/5/5 | 0/0/0/0 | aucune
admin-evenements-en-attente | 0/0/0/0 | 10/10/5/5 | 10/10/5/5 | 0/0/0/0 | aucune
admin-evenements-erreur | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
admin-fiche-en-attente | 0/0/0/0 | 13/13/8/8 | 13/13/8/8 | 0/0/0/0 | aucune
admin-fiche-suspendu | 0/0/0/0 | 11/11/6/6 | 11/11/6/6 | 0/0/0/0 | aucune
admin-notifications | 0/0/0/0 | 26/26/21/21 | 26/26/21/21 | 0/0/0/0 | aucune
admin-notifications-detail | 0/0/0/0 | 9/9/4/4 | 9/9/4/4 | 0/0/0/0 | aucune
admin-notifications-erreur | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
aide-transfert | 0/0/0/0 | 8/8/4/4 | 8/8/4/4 | 0/0/0/0 | aucune
billet-hors-ligne-a-telecharger | 0/0/0/0 | 8/8/4/4 | 8/8/4/4 | 0/0/0/0 | aucune
billet-hors-ligne-disponible | 0/0/0/0 | 8/8/4/4 | 8/8/4/4 | 0/0/0/0 | aucune
billet-hors-ligne-qr | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | aucune
billet-hors-ligne-sans-codes | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 | aucune
caisse-cloture-ecart | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
caisse-ouverture | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
caisse-ticket-z | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
catalogue | 0/0/0/0 | 15/15/11/11 | 15/15/11/11 | 0/0/0/0 | aucune
cloche-ouverte | 0/0/0/0 | 27/27/23/23 | 27/27/23/23 | 0/0/0/0 | aucune
connexion | 0/0/0/0 | 4/4/0/0 | 4/4/0/0 | 0/0/0/0 | aucune
controleur-activation | —/0/—/0 | —/0/—/0 | —/0/—/0 | —/0/—/0 | aucune
controleur-profil | —/0/—/0 | —/3/—/3 | —/3/—/3 | —/0/—/0 | aucune
controleur-scanner | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
evenement-annule | 0/0/0/0 | 7/7/3/3 | 7/7/3/3 | 0/0/0/0 | aucune
evenement-non-public | 0/0/0/0 | 4/4/0/0 | 4/4/0/0 | 0/0/0/0 | aucune
evenement-publie | 0/0/0/0 | 9/9/5/5 | 9/9/5/5 | 0/0/0/0 | aucune
evenement-suspendu | 0/0/0/0 | 7/7/3/3 | 7/7/3/3 | 0/0/0/0 | aucune
evenement-termine | 0/0/0/0 | 7/7/3/3 | 7/7/3/3 | 0/0/0/0 | aucune
hors-ligne | 0/0/0/0 | 15/15/11/11 | 15/15/11/11 | 0/0/0/0 | aucune
inscription | 0/0/0/0 | 4/4/0/0 | 4/4/0/0 | 0/0/0/0 | aucune
inscription-code | 0/0/0/0 | 4/4/0/0 | 4/4/0/0 | 0/0/0/0 | aucune
mes-billets | 0/0/0/0 | 8/8/4/4 | 8/8/4/4 | 0/0/0/0 | aucune
mes-billets-recus | 0/0/0/0 | 5/5/1/1 | 5/5/1/1 | 0/0/0/0 | aucune
mot-de-passe-oublie | 0/0/0/0 | 4/4/0/0 | 4/4/0/0 | 0/0/0/0 | aucune
notifications | 0/0/0/0 | 14/14/10/10 | 14/14/10/10 | 0/0/0/0 | aucune
notifications-erreur | 0/0/0/0 | 4/4/0/0 | 4/4/0/0 | 0/0/0/0 | aucune
notifications-vide | 0/0/0/0 | 4/4/0/0 | 4/4/0/0 | 0/0/0/0 | aucune
page-masquee-commandes | 0/0/0/0 | 5/5/1/1 | 5/5/1/1 | 0/0/0/0 | aucune
page-masquee-salles | 0/0/0/0 | 4/4/0/0 | 4/4/0/0 | 0/0/0/0 | aucune
paiement-attente | 0/0/0/0 | 6/6/2/2 | 6/6/2/2 | 0/0/0/0 | aucune
paiement-echec | 0/0/0/0 | 6/6/2/2 | 6/6/2/2 | 0/0/0/0 | aucune
paiement-modale | 0/0/0/0 | 10/10/6/6 | 10/10/6/6 | 0/0/0/0 | aucune
paiement-succes | 0/0/0/0 | 6/6/2/2 | 6/6/2/2 | 0/0/0/0 | aucune
partenaire-abonnement | 0/0/0/0 | 12/12/7/7 | 12/12/7/7 | 0/0/0/0 | aucune
partenaire-creation | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
partenaire-edition | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
partenaire-equipe | 0/0/0/0 | 9/9/4/4 | 9/9/4/4 | 0/0/0/0 | aucune
partenaire-evenements | 0/0/0/0 | 14/14/9/9 | 14/14/9/9 | 0/0/0/0 | aucune
partenaire-evenements-annules | 0/0/0/0 | 7/7/2/2 | 7/7/2/2 | 0/0/0/0 | aucune
partenaire-evenements-erreur | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
partenaire-finances | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
partenaire-inscription | 0/0/0/0 | 5/5/1/1 | 5/5/1/1 | 0/0/0/0 | aucune
partenaire-premiers-pas | 0/0/0/0 | 8/8/3/3 | 8/8/3/3 | 0/0/0/0 | aucune
partenaire-profil | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
partenaire-tableau-de-bord | 0/0/0/0 | 30/30/25/25 | 30/30/25/25 | 0/0/0/0 | aucune
pilotage-annulation | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-apercu | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-caisse | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-cloture | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-entrees | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-equipe | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-erreur | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-remboursements | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
pilotage-ventes | 0/0/0/0 | 6/6/1/1 | 6/6/1/1 | 0/0/0/0 | aucune
portefeuille | 0/0/0/0 | 5/5/1/1 | 5/5/1/1 | 0/0/0/0 | aucune
preferences-push-active | 0/0/0/0 | 5/5/1/1 | 5/5/1/1 | 0/0/0/0 | aucune
preferences-push-non-pris-en-charge | 0/0/0/0 | 5/5/1/1 | 5/5/1/1 | 0/0/0/0 | aucune
preferences-push-refuse | 0/0/0/0 | 5/5/1/1 | 5/5/1/1 | 0/0/0/0 | aucune
scanner-a-encaisser | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
scanner-accepte | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
scanner-accueil | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
scanner-deja-utilise | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
scanner-evenement-annule | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
scanner-guichet | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
scanner-hors-fenetre | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
scanner-hors-ligne | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
scanner-refuse | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
scanner-reseau-lent | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
scanner-saisie-manuelle | —/0/—/0 | —/1/—/1 | —/1/—/1 | —/0/—/0 | aucune
```

Contraste du plein écran du scanner au run 84 (`ci-run84-captures-index.txt`, une ligne par vue sombre ; doublons retirés) :

```text
avertissement : plein écran du scanner (cash_required, « Encaissement requis : 5 000 F CFA ») : contraste 10.36:1 (texte rgb(255, 255, 255), fond rgb(30, 58, 138)) ≥ 7:1 (contrôle bloquant satisfait)
avertissement : plein écran du scanner (valid, « Entrée validée ») : contraste 12.05:1 (texte rgb(0, 0, 0), fond rgb(74, 222, 128)) ≥ 7:1 (contrôle bloquant satisfait)
avertissement : plein écran du scanner (already_used, « Billet déjà utilisé ») : contraste 9.37:1 (texte rgb(255, 255, 255), fond rgb(124, 45, 18)) ≥ 7:1 (contrôle bloquant satisfait)
avertissement : plein écran du scanner (event_cancelled, « Événement annulé ») : contraste 10.02:1 (texte rgb(255, 255, 255), fond rgb(127, 29, 29)) ≥ 7:1 (contrôle bloquant satisfait)
avertissement : plein écran du scanner (event_not_open, « Contrôle pas encore ouvert ») : contraste 12.58:1 (texte rgb(0, 0, 0), fond rgb(251, 191, 36)) ≥ 7:1 (contrôle bloquant satisfait)
avertissement : plein écran du scanner (qr_expired, « QR expiré : demandez au client de rafraîchir son billet ») : contraste 10.02:1 (texte rgb(255, 255, 255), fond rgb(127, 29, 29)) ≥ 7:1 (contrôle bloquant satisfait)
```

Rappel du run 72, avant le passage en bloquant : 16 lignes « 3 textes < 14 px hors exemption » sur `evenement-{annule,publie,suspendu,termine}`, et 2 lignes « 1 cible < 44 px » sur `partenaire-edition` en ordinateur. Elles sont toutes à 0 aux runs 83 et 84.

---

## 10. Traces ui-ux-pro-max

**Méthode.** La consigne demandait que chaque agent d'écran invoque le skill et garde la trace de chaque invocation, commande et sortie. Chaque invocation passe par l'outil de trace `scratchpad/uiux.sh`, qui écrit un fichier `docs/lot7-logs/ui-ux-pro-max/<agent>-<n°>-<sujet>.txt`. Ce fichier contient, dans l'en-tête, l'agent, le sujet, la date UTC et la commande exacte (`python ~/.claude/skills/ui-ux-pro-max/scripts/search.py …`), puis la sortie brute.

**75 traces**, committées avec les écrans :

| Agent | Traces | Rôle |
|---|---|---|
| A3 | 2 | icônes de l'application installable |
| E1 | 14 | restes d'interface |
| E2 | 4 | billet hors ligne |
| E3 | 11 | scanner |
| E4 | 12 | client |
| E5 | 9 | partenaire |
| E6 | 2 | performance |
| R1 | 3 | échecs du run 77 |
| R2 | 9 | relecture |
| R3 | 1 | décodeur |
| R4 | 6 | reprise de session |
| R5 | 2 | chargement différé du scanner (`28d62ae`) |

La colonne « Résultats » de la liste reprend le nombre que le skill annonce dans sa sortie (« Found »). La requête `E1-005` n'a rien rendu et a été reformulée en `E1-006`.

| Fichier | Agent | Date (UTC) | Requête | Résultats |
|---|---|---|---|---|
| `A3-001-icones-pwa.txt` | A3 | 2026-11-04T07:46:04Z | `PWA app icon maskable adaptive icon safe zone opaque background brand orange contrast home screen --domain ux` | 3 results |
| `A3-002-icones-couleur.txt` | A3 | 2026-11-04T07:46:10Z | `orange brand icon solid fill white mark launcher splash background light --domain color` | 3 results |
| `E1-001-connexion-messages.txt` | E1 | 2026-11-04T08:42:24Z | `login page status message from url redirect success error banner --domain ux` | 3 results |
| `E1-002-televersement-titre.txt` | E1 | 2026-11-04T08:44:00Z | `file upload field label touch target accessible name --domain ux` | 3 results |
| `E1-003-cloche-entete.txt` | E1 | 2026-11-04T08:44:00Z | `mobile panel header toolbar button text wrapping touch target 44px --domain ux` | 3 results |
| `E1-004-reglages-fonctionnalites.txt` | E1 | 2026-11-04T08:45:21Z | `admin settings feature toggle section disabled service explanation --domain ux` | 3 results |
| `E1-005-supervision-plafond.txt` | E1 | 2026-11-04T08:45:22Z | `quota usage counter limit threshold warning dashboard KPI --domain ux` | 0 results |
| `E1-006-supervision-plafond-2.txt` | E1 | 2026-11-04T08:45:32Z | `progress indicator limit warning color not only --domain ux` | 3 results |
| `E1-007-aide-transfert.txt` | E1 | 2026-11-04T08:47:08Z | `modal dialog accordion faq disclosure reduced motion --domain ux` | 3 results |
| `E1-008-aide-transfert-anim.txt` | E1 | 2026-11-04T08:47:09Z | `animation library bundle size css transition instead --stack nextjs` | 3 results |
| `E1-009-campagnes-brouillon.txt` | E1 | 2026-11-04T08:48:11Z | `form submit draft saved honest confirmation message disabled feature --domain ux` | 3 results |
| `E1-010-activation-searchparams.txt` | E1 | 2026-11-04T08:49:29Z | `useSearchParams suspense searchParams page prop client component --stack nextjs` | 3 results |
| `E1-011-activation-formulaire.txt` | E1 | 2026-11-04T08:49:30Z | `password requirements checklist otp code input form validation inline --domain ux` | 3 results |
| `E1-012-profils-erreur.txt` | E1 | 2026-11-04T08:52:59Z | `profile edit form load error empty form save state retry --domain ux` | 3 results |
| `E1-013-profils-selection.txt` | E1 | 2026-11-04T08:52:59Z | `multi select chips toggle buttons pressed state checkbox group --domain ux` | 3 results |
| `E1-014-inscription-partenaire.txt` | E1 | 2026-11-04T08:56:03Z | `long registration form sections validate all fields before upload error summary resend code countdown --domain ux` | 3 results |
| `E2-001-billet-hors-ligne.txt` | E2 | 2026-11-04T08:42:15Z | `offline ticket QR code display without network status message error state --domain ux -n 5` | 5 results |
| `E2-002-qr-contraste-sombre.txt` | E2 | 2026-11-04T08:42:23Z | `QR code contrast dark mode white background scan readability brightness --domain ux -n 4` | 4 results |
| `E2-003-page-statique-nextjs.txt` | E2 | 2026-11-04T08:42:24Z | `static client page prerender service worker offline cache no dynamic import --stack nextjs -n 5` | 5 results |
| `E2-004-indicateur-carte-billet.txt` | E2 | 2026-11-04T08:49:26Z | `offline availability status indicator badge icon text color not alone sync download progress --domain ux -n 5` | 5 results |
| `E3-001-scanner-resultat-plein-ecran.txt` | E3 | 2026-11-04T09:05:46Z | `full screen scan result feedback accepted refused one hand mobile dark night outdoor glanceable --domain ux` | 3 results |
| `E3-002-contrastes-resultat.txt` | E3 | 2026-11-04T09:05:56Z | `color contrast 7:1 AAA text background status colors not color alone --domain ux` | 3 results |
| `E3-003-etats-reseau.txt` | E3 | 2026-11-04T09:05:57Z | `loading state slow network offline indicator retry error feedback timeout --domain ux` | 3 results |
| `E3-004-rendu-differe-nextjs.txt` | E3 | 2026-11-04T09:08:34Z | `dynamic import client component modal lazy load bundle size useEffect cleanup --stack nextjs` | 3 results |
| `E3-005-saisie-manuelle-deux-temps.txt` | E3 | 2026-11-04T09:08:35Z | `two step confirmation verify then confirm destructive irreversible action form --domain ux` | 3 results |
| `E3-006-caisse-guichet.txt` | E3 | 2026-11-04T09:08:36Z | `form number input currency amount validation error message accessible modal --domain ux` | 3 results |
| `E3-007-ecran-depart-evenement.txt` | E3 | 2026-11-04T09:08:43Z | `start screen choose option radio list large touch target one hand primary action bottom --domain ux` | 3 results |
| `E3-008-historique-compteur.txt` | E3 | 2026-11-04T09:08:43Z | `collapsible list recent activity counter live region aria-live announcements --domain ux` | 2 results |
| `E3-009-camera-veille-arriere-plan.txt` | E3 | 2026-11-04T09:08:44Z | `camera permission battery background tab visibility pause resume reduced motion animation --domain ux` | 3 results |
| `E3-010-bandeau-hors-ligne.txt` | E3 | 2026-11-04T09:08:53Z | `offline banner error message plain language actionable next step persistent --domain ux` | 3 results |
| `E3-011-etat-client-nextjs.txt` | E3 | 2026-11-04T09:08:53Z | `useRef stale closure event handler effect race condition async cleanup abort --stack nextjs` | 3 results |
| `E4-001-attente-paiement.txt` | E4 | 2026-11-04T09:07:31Z | `payment pending waiting screen mobile money confirmation status polling retry --domain ux` | 3 results |
| `E4-002-attente-progression.txt` | E4 | 2026-11-04T09:07:41Z | `long running progress indicator countdown loading state feedback --domain ux` | 3 results |
| `E4-003-erreur-reessayer.txt` | E4 | 2026-11-04T09:07:41Z | `error message recovery retry action network failure --domain ux` | 3 results |
| `E4-004-inscription-otp.txt` | E4 | 2026-11-04T09:07:42Z | `signup form phone verification code otp password show toggle progressive disclosure --domain ux` | 3 results |
| `E4-005-navigation-masquee.txt` | E4 | 2026-11-04T09:07:42Z | `navigation menu hidden items feature disabled layout shift --domain ux` | 3 results |
| `E4-006-page-404.txt` | E4 | 2026-11-04T09:07:43Z | `404 not found page empty state navigation home --domain ux` | 3 results |
| `E4-007-commandes-onglets.txt` | E4 | 2026-11-04T09:07:44Z | `tabs filter list error empty state orders history --domain ux` | 3 results |
| `E4-008-portefeuille.txt` | E4 | 2026-11-04T09:07:44Z | `wallet balance transactions withdrawal list cards --domain ux` | 1 results |
| `E4-009-chargement-differe.txt` | E4 | 2026-11-04T09:07:53Z | `dynamic import lazy load component modal map below the fold intersection observer --stack nextjs` | 3 results |
| `E4-010-pages-erreur.txt` | E4 | 2026-11-04T09:07:53Z | `not-found error boundary error.tsx reset notFound --stack nextjs` | 3 results |
| `E4-011-redirection-interne.txt` | E4 | 2026-11-04T09:07:54Z | `redirect query parameter searchParams useSearchParams suspense --stack nextjs` | 3 results |
| `E4-012-contraste-operateurs.txt` | E4 | 2026-11-04T09:07:55Z | `brand color contrast text on colored background accessible --domain color` | 3 results |
| `E5-001-tableau-de-bord-etats.txt` | E5 | 2026-11-04T09:35:53Z | `dashboard KPI cards loading skeleton error state retry instead of zero values --domain ux` | 3 results |
| `E5-002-premiere-utilisation.txt` | E5 | 2026-11-04T09:36:04Z | `onboarding checklist first use steps progress next action empty dashboard --domain ux` | 3 results |
| `E5-003-tableau-donnees-mobile.txt` | E5 | 2026-11-04T09:36:05Z | `data table mobile cards icon buttons download accessible label touch target --domain ux` | 3 results |
| `E5-004-modale-differee-nextjs.txt` | E5 | 2026-11-04T09:36:11Z | `dynamic import modal lazy load client component bundle size --stack nextjs` | 3 results |
| `E5-005-finances-retrait.txt` | E5 | 2026-11-04T09:43:24Z | `withdrawal form one-time code verification step pending balance history status badges --domain ux` | 3 results |
| `E5-006-finances-montants.txt` | E5 | 2026-11-04T09:43:31Z | `financial amounts tabular numbers color not only indicator credit debit list truncated history notice --domain ux` | 3 results |
| `E5-007-abonnement-offres.txt` | E5 | 2026-11-04T09:46:18Z | `pricing plans comparison current plan trial progress bar empty state no plans disabled button explanation --domain ux` | 3 results |
| `E5-008-equipe-modales.txt` | E5 | 2026-11-04T10:31:32Z | `modal dialog form multi select checkbox list focus trap invite member search filter label --domain ux` | 3 results |
| `E5-009-equipe-liste.txt` | E5 | 2026-11-04T10:31:34Z | `team member list realtime status indicator destructive action confirmation icon button --domain ux` | 3 results |
| `E6-001-poids-js.txt` | E6 | 2026-11-04T10:38:24Z | `bundle size dynamic import code splitting heavy dependencies --stack nextjs` | 3 results |
| `E6-002-performance-ux.txt` | E6 | 2026-11-04T10:38:24Z | `performance bundle size lazy loading image optimization --domain ux` | 3 results |
| `R1-001-portefeuille-badge-contraste.txt` | R1 | 2026-11-04T18:11:55Z | `badge pill on colored brand background text contrast accessibility --domain ux` | 3 results |
| `R1-002-partenaire-finances-historique.txt` | R1 | 2026-11-04T18:12:18Z | `transaction history list readable labels no technical ids or codes shown to users --domain ux` | 3 results |
| `R1-003-partenaire-finances-detail-ecriture.txt` | R1 | 2026-11-04T18:58:27Z | `ledger entry secondary line show event name instead of internal accounting reference --domain ux` | 3 results |
| `R2-001-modale-portail.txt` | R2 | 2026-11-04T19:13:10Z | `modal dialog overlay must cover full viewport portal focus trap sticky header z-index --domain ux` | 3 results |
| `R2-002-indicateur-direct-evenement-clos.txt` | R2 | 2026-11-04T19:15:05Z | `live status indicator ambiguous next to cancelled status badge\, avoid misleading status labels --domain ux` | 3 results |
| `R2-003-billet-titre-hors-affiche.txt` | R2 | 2026-11-04T19:15:49Z | `text overlay on image with printed text readability\, card title placement below image --domain ux` | 3 results |
| `R2-004-paiement-compte-a-rebours.txt` | R2 | 2026-11-04T19:16:32Z | `countdown timer typography tabular numbers no wrap single font family --domain ux` | 3 results |
| `R2-005-kpi-libelle-cesure.txt` | R2 | 2026-11-04T19:17:47Z | `long label word overflow narrow card mobile hyphenation text wrapping --domain ux` | 3 results |
| `R2-006-pilotage-chiffres-libelles.txt` | R2 | 2026-11-04T19:18:24Z | `dashboard KPI labels must not imply wrong arithmetic\, clear denominators\, closed category state --domain ux` | 3 results |
| `R2-007-scanner-message-doublon.txt` | R2 | 2026-11-04T19:18:56Z | `full screen scan result avoid redundant duplicated text glanceable --domain ux` | 3 results |
| `R2-008-activites-partenaire-libelles.txt` | R2 | 2026-11-04T19:20:39Z | `consistent option labels across signup and profile forms single source of truth --domain ux` | 3 results |
| `R2-009-billet-hors-ligne-textes.txt` | R2 | 2026-11-04T19:21:56Z | `offline ticket page subtitle must match state\, ticket number should not break across lines --domain ux` | 3 results |
| `R3-001-scanner-decodeur.txt` | R3 | 2026-11-04T21:10:49Z | `camera QR scanner reliability feedback no silent failure --domain ux` | 3 results |
| `R4-001-reprise-session.txt` | R4 | 2026-11-04T21:32:24Z | `resume interrupted session restore state after app backgrounded reload persistence --domain ux` | 3 results |
| `R4-002-reprise-camera.txt` | R4 | 2026-11-04T21:32:32Z | `camera permission paused resume single tap primary action touch target feedback --domain ux` | 3 results |
| `R4-003-reprise-etat-client.txt` | R4 | 2026-11-04T21:32:38Z | `localStorage hydration client state restore useEffect visibility --stack nextjs` | 3 results |
| `R4-004-reprise-contraste.txt` | R4 | 2026-11-04T21:32:39Z | `contrast text on dark overlay status message AAA --domain ux` | 3 results |
| `R4-005-reprise-annonce.txt` | R4 | 2026-11-04T21:32:50Z | `status message live region announce restored result screen reader error recovery --domain ux` | 3 results |
| `R4-006-reprise-historique-partenaire.txt` | R4 | 2026-11-04T21:32:51Z | `list history empty state loading skeleton stale data indicator --domain ux` | 3 results |
| `R5-001-scanner-chargement-differe.txt` | R5 | 2026-11-04T23:28:48Z | `lazy loading code splitting dynamic import preload perceived performance --stack nextjs` | 3 results |
| `R5-002-scanner-verdict-immediat.txt` | R5 | 2026-11-04T23:28:56Z | `loading state skeleton feedback response time instant result screen reduced motion --domain ux` | 3 results |

**Extrait brut** (`E3-002-contrastes-resultat.txt`, début) :

```text
# Trace d'invocation du skill ui-ux-pro-max (lot 7)
# agent    : E3
# sujet    : contrastes-resultat
# date UTC : 2026-11-04T09:05:56Z
# commande : python ~/.claude/skills/ui-ux-pro-max/scripts/search.py color\ contrast\ 7:1\ AAA\ text\ background\ status\ colors\ not\ color\ alone --domain ux
# ---------------------------------------------------------------- sortie brute
## UI Pro Max Search Results
**Domain:** ux | **Query:** color contrast 7:1 AAA text background status colors not color alone
**Source:** ux-guidelines.csv | **Found:** 3 results

### Result 1
- **Category:** Accessibility
- **Issue:** Color Contrast
- **Platform:** All
- **Description:** Text must be readable against background
- **Do:** Minimum 4.5:1 ratio for normal text
- **Don't:** Low contrast text
- **Code Example Good:** #333 on white (7:1)
- **Code Example Bad:** #999 on white (2.8:1)
- **Severity:** High

### Result 2
- **Category:** Accessibility
- **Issue:** Color Only
- **Platform:** All
- **Description:** Don't convey information by color alone
- **Do:** Use icons/text in addition to color
- **Don't:** Red/green only for error/success
- **Code Example Good:** Red text + error icon
- **Code Example Bad:** Red border only for error
- **Severity:** High

```

**Ce que les traces ont fait décider.** Les décisions de chaque trace sont détaillées dans les réponses des agents (`scratchpad/lot7-ui-results.md`, `lot7-fix-results.md`, `lot7-relecture-results.md`, `r4-result.md`).
- **E1 :**
  - messages de l'URL dans `StatusBanner`, erreurs annoncées ;
  - titre du champ « Affiche » non cliquable ;
  - bouton de la cloche sur sa ligne, 44 px ;
  - état du plafond SMS dit en texte, pas seulement par la couleur (E1-006) ;
  - FAQ en `<details>` natifs, framer-motion retiré ;
  - retour honnête après l'enregistrement d'un brouillon ;
  - récapitulatif d'erreurs focalisé dans l'inscription partenaire.
- **E2 :**
  - QR sur fond blanc fixe même en sombre (E2-002) ;
  - états en `role="status"` atomiques, jamais la couleur seule (E2-004) ;
  - page hors ligne sans `import()` dynamique, puisqu'un morceau chargé plus tard manquerait au cache (E2-001, E2-003 : la recommandation générique est écartée et la raison donnée).
- **E3 :**
  - une vibration par verdict, rien à la lecture (E3-001) ;
  - jetons de couleur à 7:1 au moins, avec icône et titre propres à chaque catégorie (E3-002) ;
  - « Réseau lent » au bout de 1,5 s (E3-003) ;
  - confirmation de la saisie manuelle en deux temps (E3-005) ;
  - aucune animation de balayage (E3-009) ;
  - bandeau hors ligne en `role="alert"` avec la marche à suivre (E3-010) ;
  - jetons d'annulation pour les fermetures asynchrones, à l'origine du correctif A6 (E3-011).
- **E4 :**
  - bloc « Ce que vous allez recevoir » pendant l'attente (E4-001) ;
  - étapes de l'attente avec leur état lu (E4-002) ;
  - entrées de navigation masquées tant que les interrupteurs ne sont pas lus, pour éviter le décalage de mise en page (E4-005) ;
  - contraste des pastilles d'opérateur : 10,60:1 pour Wave, 7,99:1 pour Orange Money (E4-012).
- **E5 :**
  - indicateur « N étapes franchies sur 8 » (E5-002) ;
  - `DataList` en cartes sur mobile (E5-003) ;
  - icône et texte en plus de la couleur pour les montants (E5-006) ;
  - confirmation avant tout retrait (E5-009).
- **E6 :** répartition du bundle par chunk, au lieu de budgets fixés à l'aveugle (E6-001).
- **A3 :** blanc sur `#FF5722` à 3,2:1, ce qui suffit pour un graphique sans texte (WCAG 1.4.11). Les palettes génériques suggérées sont écartées.
- **R1 et R2 :**
  - badge du portefeuille à 7,31:1 ;
  - modale en portail ;
  - pastille « En direct » masquée sur un événement clos ;
  - titre du billet sous l'affiche ;
  - libellés du pilotage.
- **R3 :** pas d'échec silencieux du décodeur.
- **R4 :**
  - annonce « Résultat retrouvé » ;
  - contraste du texte sur le voile sombre ;
  - historique du partenaire servi par le serveur.
- **R5 :**
  - parties du scanner chargées par `import()` et préchargées dès l'écran de départ (R5-001) ;
  - aucune attente visible au premier verdict, et jamais un verdict de repli (R5-002).

**Limite.** Plusieurs sorties sont génériques (palettes d'autres secteurs, conseils Next.js qui ne s'appliquent pas). Les agents l'ont écrit, et ont alors gardé `design-system/event-village/MASTER.md`. Les traces prouvent l'invocation et sa sortie. Ce que chaque agent en a tiré est **déclaratif** : la preuve que les écrans respectent le système de design vient de `design-systeme` (284/284 aux runs 83 et 84), `client-interface`, `scanner-interface`, `partenaire-lot7` et des contrôles des captures.

---

## 11. Variables d'environnement et réglages SUPERADMIN

Référence : `lib/env.ts` à `55afc8b` (inchangé depuis `aaf6542`), `.env.example` et `docs/deploiement-projet-neuf.md`, sections 4 bis, 4 ter et 5. Aucune valeur réelle n'est écrite ici.

### 11.1 Variables d'environnement

**Nouvelles au lot 7.** Toutes sont facultatives. Ce sont des quotas en base, de même nature que ceux du lot 4 : au-delà, 429 avec `Retry-After` ; si la garde est injoignable, 503.

| Variable | Défaut | Rôle |
|---|---|---|
| `OFFLINE_CODES_PER_TICKET_HOUR` | 12 | téléchargements du lot de codes hors ligne d'un billet, par heure |
| `OFFLINE_CODES_PER_USER_HOUR` | 60 | même quota, par compte |
| `SCAN_LOOKUP_PER_SCANNER_MIN` | 20 | vérifications de saisie manuelle, par contrôleur et par minute |

Diff de `lib/env.ts` sur le lot (`git diff 6fff1bf..55afc8b -- lib/env.ts`, lignes ajoutées) :

```text
+    // Lot 7 (7.1, D37) : téléchargements du lot de codes hors ligne (GET /api/tickets/[id]/offline-codes), par
+    // billet et par compte, fenêtres fixes d'une heure ; une ouverture de l'application ne retélécharge que si
+    // le lot manque, a expiré, a changé de version ou se termine dans moins de 24 h
+    OFFLINE_CODES_PER_TICKET_HOUR: limit(12),
+    OFFLINE_CODES_PER_USER_HOUR: limit(60),
+    // Lot 7 (7.2, D43) : vérifications de saisie manuelle (POST /api/controller/scan/lookup), par contrôleur et par minute
+    SCAN_LOOKUP_PER_SCANNER_MIN: limit(20),
```

**Touchées sans changement de valeur :**
- `SMS_GLOBAL_DAILY_CAP` (1 000) : il **ne s'applique plus aux SMS indispensables**. Section 11.3.
- `SMS_GLOBAL_OTP_RESERVED_PERCENT` (30).

**Tableau complet après le lot 7 :**

| Catégorie | Variables |
|---|---|
| **Obligatoires** (le serveur refuse de démarrer sans elles) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL` (HTTPS définitive), `SAMIRPAY_API_URL`, `SAMIRPAY_API_KEY`, `SAMIRPAY_SECRET_KEY`, `MTARGET_USERNAME`, `MTARGET_PASSWORD`, `OTP_HASH_SECRET`, `TICKET_TOTP_MASTER_KEY`, `REGISSEUR_PIN_KEY` (trois secrets différents entre eux et de toute autre clé) |
| **Obligatoire en exploitation** | `CRON_SECRET` : sans elle, toutes les routes `/api/cron/*` répondent 503. Sa valeur est recopiée dans le secret Vault `ev_cron_secret`. |
| **Facultatives du lot 6** | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (les trois ou aucune) ; `MTARGET_TIMEOUT_MS` (15 000) ; `PUSH_TIMEOUT_MS` (10 000) ; `PUSH_SUBSCRIBE_PER_USER_HOUR` (20) ; `PUSH_TEST_PER_USER_HOUR` (5) ; `PUSH_ENDPOINT_ALLOWED_ORIGINS` (**à ne pas renseigner en production**) |
| **Facultatives du lot 7** | `OFFLINE_CODES_PER_TICKET_HOUR` (12), `OFFLINE_CODES_PER_USER_HOUR` (60), `SCAN_LOOKUP_PER_SCANNER_MIN` (20) |
| **Intégrations** | `MTARGET_API_URL`, `MTARGET_SERVICE_ID`, `MTARGET_SENDER`, `SAMIRPAY_TIMEOUT_MS` (15 000), `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`, `SUPPORT_EMAIL`, `SUPABASE_AUTH_HOOK_SECRET` |
| **Quotas SMS** | `SMS_OTP_PER_PHONE_15MIN` (3), `SMS_OTP_PER_PHONE_DAY` (10), `SMS_OTP_PER_IP_HOUR` (10), `SMS_OTP_PER_IP_DAY` (30), `SMS_PER_PHONE_DAY` (30), `SMS_GLOBAL_DAILY_CAP` (1 000), `SMS_PER_ACCOUNT_DAY` (30), `SMS_GLOBAL_OTP_RESERVED_PERCENT` (30) |
| **Paiement** | `PAYMENT_HOLD_MINUTES` (15), `CHECKOUT_PER_USER_15MIN` (10), `CHECKOUT_PER_USER_DAY` (50), `CLAIM_FREE_PER_USER_HOUR` (20), `STATUS_POLL_RECONCILE_SECONDS` (5), `PAYMENT_RECONCILE_MIN_AGE_MINUTES` (2), `PAYMENT_PENDING_MAX_AGE_MINUTES` (60), `PAYMENT_LATE_SUCCESS_WINDOW_HOURS` (48), `PAYMENT_RECONCILE_BATCH` (50) |
| **Quotas du lot 4** | `SCAN_PER_SCANNER_10S` (30), `CASH_COLLECT_PER_SCANNER_MIN` (20), `LIVE_CODE_PER_USER_MIN` (60), `RESOLVE_PHONE_PER_IP_HOUR` (30), `VERIFY_OTP_PER_PHONE_15MIN` (10), `CONTROLLER_SETUP_PER_PHONE_HOUR` (10), `PARTNER_REGISTER_PER_IP_HOUR` (10), `INVITE_PER_PARTNER_HOUR` (20), `INVITE_PER_PHONE_DAY` (3), `REGISSEUR_PIN_PER_SHIFT_15MIN` (5) |
| **Quotas du lot 5** | `WITHDRAWAL_REQUEST_PER_USER_HOUR` (10), `COUNTER_RECEIPT_PER_SHIFT_DAY` (500), `SCAN_INCIDENT_REPORT_PER_SCANNER_MIN` (10), `SCAN_INCIDENT_LOG_PER_SCANNER_MIN` (60) |
| **Autres** | `DOCUMENT_UPLOADS_PER_IP_HOUR` (20), `CLIENT_IP_SOURCE` (`x-forwarded-for`), `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION`, `SUPERADMIN_PHONE` (déclarée, lue nulle part), `NODE_ENV` ; `EV_INTEGRATIONS` : **ne pas définir** |

En e2e seulement, `.env.e2e` relève les quotas hors ligne à 1 000 (D37), parce que les captures ouvrent des contextes neufs. Ce fichier n'est jamais utilisé en production.

### 11.2 Réglages SUPERADMIN (`platform_settings`, modifiables par `finance_setting_set` : SUPERADMIN actif, motif obligatoire, historique)

28 clés modifiables. La table compte 37 lignes avec les autres réglages de la plateforme (`ticketing_fee_config`, etc.) : 33 après le lot 6, + 5 − 1. Bornes : `fin_setting_valid` dans la migration `20261105000001`.

| Clé | Défaut | Valeurs admises | Lot |
|---|---|---|---|
| `finance.service_fee_rate` | 5 (repris de `ticketing_fee_config`) | 0 à 50 (%) | 3 |
| `finance.aggregator_fee_rate.WAVE` | 1,5 | 0 à 10 (%) | 3 |
| `finance.aggregator_fee_rate.ORANGE_MONEY` | 1,5 | 0 à 10 (%) | 3 |
| `finance.cancellation_aggregator_fee_bearer` | `EVENT_VILLAGE` | `EVENT_VILLAGE`, `ORGANISATEUR` | 3 |
| `finance.payout_hold_enabled` | true | booléen | 3 |
| `finance.payout_delay_hours` | 48 | entier de 0 à 720 | 3 |
| `finance.withdrawal_fee_rate` | 1 | 0 à 10 (%) | 3 |
| `finance.withdrawal_min_amount` | 5 000 | entier de 0 à 10 000 000 (F CFA) | 3 |
| `finance.withdrawal_bank_enabled` | false | booléen | 3 |
| `finance.referral_availability_days` | 7 | entier de 7 à 14 | 3 |
| `access.manual_entry_scope` | `ASSIGNED_CONTROLLER` | `ASSIGNED_CONTROLLER`, `STAFF` | 4 |
| `access.scan_window_before_hours` | 6 | entier de 0 à 48 | 4 |
| `access.scan_window_after_hours` | 6 | entier de 0 à 48 | 4 |
| `access.counter_sale_enabled` | true | booléen | 4 |
| `access.low_stock_threshold` | 10 | entier de 1 à 1 000 | 5 |
| `notif.reminder_j1_enabled` | true | booléen | 6 |
| `notif.reminder_j1_hour` | 10 | entier de 6 à 20 (heure de Dakar) | 6 |
| `notif.reminder_h3_enabled` | true | booléen | 6 |
| `notif.reminder_h3_hours` | 3 | entier de 1 à 12 | 6 |
| `notif.j1_sms` | `ALWAYS` | `ALWAYS`, `IF_NO_PUSH`, `NEVER` | 6 |
| `notif.h3_sms` | `IF_NO_PUSH` | idem | 6 |
| `notif.sms_quiet_start` | 22 | entier de 0 à 23 | 6 |
| `notif.sms_quiet_end` | 8 | entier de 0 à 23 | 6 |
| `notif.sms_optional_daily_cap` | **700** | entier de 0 à 1 000 000 ; 0 : aucun SMS optionnel | **7** |
| `notif.free_ticket_reminder_sms` | **`NEVER`** | `NEVER`, `SAME_AS_PAID` | **7** |
| `features.halls_enabled` | **false** | booléen ; un ADMIN ne peut pas l'écrire | **7** |
| `features.tables_enabled` | **false** | idem | **7** |
| `features.orders_enabled` | **false** | idem ; `/orders` en 404 seulement si les trois sont fermés | **7** |
| `notif.sms_daily_alert` | — | **supprimée** au lot 7, suppression historisée | 6 → 7 |

### 11.3 Budget optionnel et plafond global : la différence

`docs/deploiement-projet-neuf.md`, section 5.5, résumé :

| | `notif.sms_optional_daily_cap` | `SMS_GLOBAL_DAILY_CAP` |
|---|---|---|
| Nature | **budget** : ce que le client accepte de payer chaque jour en SMS facultatifs | **protection anti-abus de dernier recours** |
| Réglage | SUPERADMIN, page Réglages, sans redéploiement | variable d'environnement, avec redéploiement |
| Défaut | 700 par jour de Dakar | 1 000 par jour, dont 30 % réservés aux OTP |
| SMS concernés | SMS `OPTIONAL` de la boîte d'envoi : J-1, H-3, rappel des contrôleurs, changement de date ou de lieu, premier billet vendu, catégorie épuisée, événement complet | OTP jusqu'au plafond entier ; SMS optionnels, invitations de contrôleurs et envois sans famille jusqu'à la part non OTP (700) |
| Jamais concernés | les SMS `ESSENTIAL`, les OTP, les invitations | les SMS `ESSENTIAL` de la boîte d'envoi |
| Au-delà | `SKIPPED SMS_OPTIONAL_CAP`, sans relance ; l'in-app et le push partent | notification `SKIPPED SMS_DAILY_CAP` ; OTP refusé (429) |
| Alertes | à 80 %, une fois par jour ; la veille, si la prévision dépasse le budget restant ; aucune si le budget vaut 0 | une fois par jour et par type, dans l'application |

**Ordre des contrôles.** Le budget est vérifié en premier, à la réservation, sous verrou. Le 701ᵉ rappel sort donc en `SMS_OPTIONAL_CAP`, jamais en `SMS_DAILY_CAP` : c'est le cas 3 de `sms-plafond-optionnel`, sous les défauts de la garde.

**Recouvrement avec les défauts.** La part non OTP de la garde (700) est égale au budget (700), mais elle est partagée avec les OTP et les invitations. Pour que le budget soit la vraie limite, il faut :

`SMS_GLOBAL_DAILY_CAP` × 0,7 ≥ budget + invitations + OTP prévus le même jour

Exemple de la documentation : (700 + 50 + 300) / 0,7 = 1 500.

**Quotas anti-abus du lot 1C** : toujours appliqués à tous les SMS, indispensables compris (par destinataire, par compte déclencheur, par caisse).

---

## 12. Coût SMS par billet (réglages par défaut, nouvelles règles)

**Sources.**
- **Registre** `notification_types` : migration `20261103000002`, complétée par `20261105000002` (deux alertes admin, sans SMS) et `20261105000007` (email de `TRANSFER_RECEIVED`, sans SMS). Il compte 69 types.
- **Catalogue** `lib/notifications/catalog.ts`. L'égalité entre registre et catalogue est vérifiée par `notif-modeles` (« types du catalogue = types de G2 »), PASS aux runs 83 et 84.
- **Réglages** du tableau 11.2.

**Types qui envoient un SMS** (relevé du registre) :

| Famille | Types | Plafond journalier |
|---|---|---|
| `ESSENTIAL`, par la boîte d'envoi (24) | PURCHASE_CONFIRMED, FREE_TICKETS_CONFIRMED, COUNTER_RECEIPT, TRANSFER_OFFERED, TRANSFER_CANCELLED, EVENT_CANCELLED, REFUND_PAID, PASSWORD_CHANGED, EVENT_VALIDATED, EVENT_REJECTED, EVENT_SUSPENDED, EVENT_REACTIVATED, SHIFT_DISCREPANCY, WITHDRAWAL_PAID, WITHDRAWAL_REJECTED, WITHDRAWAL_UNCERTAIN, PARTNER_VALIDATED, PARTNER_REJECTED, PARTNER_SUSPENDED, PARTNER_REACTIVATED, TRIAL_STARTED, CONTROLLER_ASSIGNED, CONTROLLER_UNASSIGNED, CONTROLLER_ACTIVATED | **aucun** (quotas par destinataire et par compte seulement) |
| `ESSENTIAL`, envoi synchrone (6) | OTP_LOGIN, OTP_REGISTER, OTP_PASSWORD_RESET, OTP_WITHDRAWAL, OTP_AUTH_HOOK, CONTROLLER_INVITE | OTP : compteurs propres et réserve de 30 % ; CONTROLLER_INVITE : part non OTP de la garde (D14) |
| `OPTIONAL` (7) | EVENT_CHANGED, REMINDER_J1, REMINDER_H3, FIRST_TICKET_SOLD, CATEGORY_SOLD_OUT, EVENT_SOLD_OUT, CONTROLLER_REMINDER | budget de 700 par jour, puis part non OTP de la garde |

`TRANSFER_RECEIVED` n'envoie pas de SMS : ses canaux sont l'application, le push et l'email.

**Règles par commande**, prouvées par les tests cités :
- **Achat payant :** 1 SMS `PURCHASE_CONFIRMED` par **commande**, au numéro du payeur. Une commande de 4 billets donne 1 SMS d'achat et 1 seul J-1 (`sms-commande-4-billets`, runs 83 et 84).
- **Rappel J-1** (`notif.j1_sms = ALWAYS`) : 1 SMS par porteur et par événement, optionnel.
- **Rappel H-3** (`notif.h3_sms = IF_NO_PUSH`) : 1 SMS seulement si aucun push n'a été remis. Aucun SMS si l'échéance tombe dans la plage de 22 h à 8 h, soit un événement qui commence entre 1 h et 10 h 59.
- **Billets gratuits seulement** pour l'événement (prix 0, ou canal `FREE` ou `INVITATION`) : 1 SMS `FREE_TICKETS_CONFIRMED` par réclamation, et aucun SMS de rappel avec `NEVER` (`rappels-gratuits`, runs 83 et 84). Avec `SAME_AS_PAID`, les rappels suivent les règles d'un billet payant. Un porteur d'un billet gratuit et d'un billet payant du même événement reçoit le SMS du J-1 (cas 3).
- **Au-delà de 700 SMS optionnels le même jour :** les rappels suivants partent sans SMS, mais l'in-app et le push partent (`sms-plafond-optionnel`).

| Cas (une commande) | SMS | Par billet | Coût à 5 F HT le SMS | Coût à 10 F HT le SMS |
|---|---|---|---|---|
| 1 billet payant, sans push remis | 3 (achat, J-1, H-3) | 3 | 15 F | 30 F |
| 1 billet payant, avec push remis | 2 (achat, J-1) | 2 | 10 F | 20 F |
| 1 billet payant, H-3 dans la plage de silence | 2 | 2 | 10 F | 20 F |
| 4 billets payants gardés par l'acheteur, sans push | 3 | 0,75 | 15 F, soit 3,75 F par billet | 30 F, soit 7,50 F par billet |
| 4 billets payants gardés, avec push | 2 | 0,5 | 10 F, soit 2,50 F par billet | 20 F, soit 5 F par billet |
| 1 billet gratuit ou une invitation (`NEVER`, défaut) | 1 (confirmation) | 1 | 5 F | 10 F |
| 4 billets gratuits en une réclamation (`NEVER`) | 1 | 0,25 | 5 F, soit 1,25 F par billet | 10 F, soit 2,50 F par billet |
| 1 billet gratuit avec `SAME_AS_PAID`, sans push | 3 | 3 | 15 F | 30 F |
| Rappel au-delà du 700ᵉ SMS optionnel du jour | 0 pour ce rappel | — | 0 F | 0 F |
| Billet vendu au guichet | 1 reçu si un numéro est saisi, aucun rappel (billet sans porteur) | 0 ou 1 | 0 ou 5 F | 0 ou 10 F |

**Hors vente :**
- **transfert** : 1 SMS `TRANSFER_OFFERED` au destinataire, et 1 `TRANSFER_CANCELLED` s'il est annulé ; le destinataire reçoit ensuite les rappels comme porteur ;
- **annulation d'un événement** : 1 SMS `EVENT_CANCELLED` par porteur, plus 1 `REFUND_PAID` par remboursement versé. C'est ce que montre la fumée des runs 83 et 84 : 2 SMS pour le client de E2 ;
- **changement de date ou de lieu** : 1 par porteur, optionnel ;
- **OTP** : 1 par code (connexion par code, inscription, mot de passe oublié, retrait) ;
- **professionnels** : statut, retraits, écart de caisse, affectation des contrôleurs, premier billet vendu, catégorie épuisée, événement complet.

**Plafond de la dépense optionnelle.** 700 SMS par jour au plus : **3 500 F HT par jour** à 5 F, **7 000 F HT** à 10 F. Les SMS indispensables n'ont plus de plafond journalier : leur coût suit le volume des ventes, des annulations et des transferts, sous les quotas par destinataire et par compte.

**Taille.**
- Tous les SMS du catalogue tiennent en un segment GSM-7, avec les valeurs maximales et une URL de 27 caractères (`notif-modeles`). Seule exception : `CONTROLLER_INVITE`, en 2 segments.
- Le SMS d'achat tient maintenant en un segment au pire cas : 160 septets (section 2, 7.9).
- La facturation par segment de MTarget reste à confirmer (point ouvert du lot 6).

---

## 13. Tester le lot 7 vous-même

**À ne jamais faire : lancer cette branche contre le projet de production.**
- `.env.local` pointe sur le projet Supabase de production, et `npm run dev` le charge (règle de Next.js : `.env.local` est lu en développement).
- Les migrations `20261105…` n'y sont pas appliquées. L'application du lot 7 appellerait des fonctions absentes, et la règle du projet interdit tout test sur un projet distant.
- Garde-fous du dépôt :
  - `tests/helpers/env.ts` refuse toute URL Supabase non locale pour les tests et le seed ;
  - `scripts/e2e/start-app.mjs` refuse un build qui contient une URL Supabase hébergée.
- **Mais `npm run dev` n'a aucun garde-fou.**

**Ce que le dépôt prévoit pour une base locale.** Commandes vérifiées dans `tests/README.md`, `package.json`, `.env.test.example` et `scripts/e2e/` :
1. **Installer Docker Desktop.** Il est absent du poste (rapport du lot 0, point 4).
2. `npx supabase start` démarre l'instance locale (`tests/README.md:18`).
3. `npx supabase db reset` applique toutes les migrations depuis zéro, lot 7 compris, puis `supabase/seed.sql` (`tests/README.md:19`).
4. Créer `.env.test` à partir de `.env.test.example`, avec les clés de démonstration affichées par `npx supabase status`, comme l'indique l'en-tête du fichier d'exemple. Ces clés sont publiques et propres à l'instance locale.
5. `npm run verify` : typecheck, lint, tests et build, avec `.env.test` (`tests/README.md:31`).
6. Données de démonstration : `npm run seed:demo` (ou `seed:test`), qui charge `.env.test` et refuse une URL non locale.
7. **Pour ouvrir l'application dans un navigateur**, le dépôt ne fournit qu'une voie, celle de la CI :
   - générer `.env.e2e` comme l'étape « E2E : générer .env.e2e » de `.github/workflows/verify.yml` (`scripts/e2e/env.mjs` le dit en cas d'absence) ;
   - puis `node scripts/e2e/fake-services.mjs` et `node scripts/e2e/start-app.mjs`, qui sert le build sur `http://localhost:<E2E_APP_PORT>` (3000 en CI) ;
   - et éventuellement `npm run e2e`.

   **Il n'existe pas de commande prête pour `npm run dev` contre l'instance locale.** Je n'en invente pas.

**Le téléphone.** La caméra et le service worker, donc le scanner, le billet hors ligne et l'installation, n'existent que sur une origine sécurisée (HTTPS) ou sur `localhost` de la machine elle-même. Un téléphone qui ouvre `http://<adresse du PC>:3000` n'aura ni caméra ni billet hors ligne.
- C'est écrit dans `docs/deploiement-projet-neuf.md` (section 5.6 : « Sans HTTPS, ni billet hors ligne, ni scanner ») et dans `docs/guide-organisateur-entrees.md:46` (« la caméra ne s'ouvre que sur l'adresse officielle de l'application »).
- `docs/installer-application.md` le dit aussi depuis `55afc8b` : « Ouvrez toujours l'application à son **adresse officielle, en `https://`**. Sur une adresse non sécurisée (`http://`, adresse IP d'un poste de test), le navigateur refuse l'installation, l'enregistrement du billet hors ligne et la caméra du scanner. »

Le test au téléphone demande donc l'hébergement en HTTPS du **lot 8**, ou une démonstration sur l'ordinateur seul.

**Scénario de test au téléphone de la reprise de session** (A10, réponse de l'agent R4, recopiée telle quelle) :

```text
1. Ouvrez l'application, connectez-vous en contrôleur, choisissez l'événement, touchez « Commencer le contrôle ». Scannez un billet : « Entrée validée ».
2. Passez dans une autre application (WhatsApp par exemple), puis revenez. Vous êtes toujours sur le même événement. Touchez « Reprendre le contrôle » : la caméra se rallume, et le compteur en haut indique 1 entrée.
3. Passez en « Saisie manuelle », fermez complètement l'application, puis rouvrez-la. Vous êtes sur le même événement, toujours en saisie manuelle. Dépliez « Derniers scans » : le billet du point 1 y est.
4. Repassez en « Caméra ». Présentez un billet et, juste au moment du « Envoi… », appuyez sur le bouton d'accueil du téléphone. Revenez : l'écran affiche le résultat avec « Résultat retrouvé ». Le compteur n'a augmenté que d'une entrée.
5. Déconnectez-vous puis reconnectez-vous : l'écran « Commencer le contrôle » revient, rien n'a été gardé.
```

La même chose est prouvée en CI par `scanner-reprise` (25/25) et `terrain` 7 (runs 83 et 84), sur Chromium avec une caméra simulée. **Sur un vrai téléphone : NON VÉRIFIÉ.**

---

## 14. Décisions prises

### 14.1 Décisions ★ (à lire par l'utilisateur)

- **D1 ★ Inscription.** Le numéro d'abord (`/api/auth/register/start` : code envoyé, aucun compte), puis le code et le profil (`/api/auth/register` vérifie et consomme le code **avant** de créer le compte). Deux écrans au lieu de trois. Raison : faille prouvée par lecture du code (compte ACTIF avant le code), et la consigne « numéro d'abord ».
- **D3 ★ Code d'une ancienne version du secret** : `qr_expired` (le résultat existant pour un code qui ne se vérifie pas), sauf événement annulé, billet annulé ou remboursé, qui affichent `event_cancelled`, `cancelled` ou `refunded`. Le statut est contrôlé avant la version.
- **D84 ★ Attente des captures** : `ready`, puis polices chargées, puis aucune requête `/api/` depuis 500 ms, plafonné à 3 s, au lieu de 15 s de « réseau au repos » jamais atteint. Sans ce changement, le job aurait dépassé 60 min.

### 14.2 Amendements de l'orchestrateur au contrat (A1 à A10)

- **A1** Tâche 7.9 ajoutée par l'utilisateur (contrat, section 19). Elle prime en cas de conflit.
- **A2** `timeout-minutes` passé de 60 à 90 pour le run « avant », puis remis à 60 (`6934436`) : 31 min au run 84 (38 min au run 83).
- **A3** T33 (`acces-encaissement`) et T34 (`notif-outbox`, `notif-modeles`) attribués à W11.
- **A4** `/.verify/` ajouté à `.gitignore`.
- **A5** Libellés de la page des réglages choisis par W1 : « Plafond quotidien des SMS optionnels », « SMS des rappels pour les billets gratuits », « Comme un billet payant », section « Fonctionnalités ».
- **A6** Défaut du lot 6 trouvé au run 73 (boucle de détection orpheline), à corriger dans `fix(7.2e)`.
- **A7** Le run 72 est écarté pour les temps d'affichage, faute de LCP sur le scanner : le run 73 fait foi.
- **A8** Temps de scan « avant » : run 74, 3 lectures (50, 53 et 93 ms), puis la lecture avalée par A6. Il n'y a aucune mesure en 3G sur l'ancien écran, et pas de run de plus.
- **A9** T35 : l'aide RLS porte désormais le statut du compte, et son corps doit lire `users`, `SUSPENDU` et `SUPPRIME`.
- **A10** Demande de l'utilisateur du 04/11 : la reprise de session du contrôleur.

### 14.3 Décisions du contrat (D1 à D99, une ligne chacune, recopiées de `scratchpad/lot7-design.md`)

- **D1 ★** Inscription (7.3) : le contrat de `POST /api/auth/register` change. Ordre : numéro (`POST /api/auth/register/start`, code envoyé, aucun compte), puis code et profil (`POST /api/auth/register` vérifie et consomme le code **avant** de créer le compte) ; le compte n'est jamais ACTIF avant la vérification. Deux écrans au lieu de trois. Raison : faille prouvée (`app/api/auth/register/route.ts:85-90,120`, compte ACTIF avant le code) et consigne « numéro d'abord ». Les suites qui appellent l'ancienne route sont adaptées en phase rouge et signalées (T).
- **D2** `SMS_GLOBAL_DAILY_CAP` garde sa valeur par défaut (1 000, `lib/env.ts:60`). Les SMS indispensables n'y sont plus soumis, l'OTP garde sa réserve ; le recouvrement « part non OTP 700 = plafond optionnel 700 » est documenté dans `docs/deploiement-projet-neuf.md`. Le motif `SMS_OPTIONAL_CAP` est garanti parce que le plafond optionnel est appliqué dans `notification_outbox_claim`, avant toute garde (D13). Raison : ne pas changer une protection anti-abus sans l'avis du client.
- **D3 ★** Code d'une ancienne version du secret : résultat existant pour un QR dont le code ne se vérifie pas, `qr_expired` (vérifié : `20261102000002_lot5_dette.sql:811-814`, `lib/scan/scan-result.ts:56`, `tests/parcours/acces-totp.test.ts:292-313`). `invalid` est le résultat d'un billet introuvable (`:800-802`) : le reprendre révélerait un comportement différent pour un même billet. Mais un événement annulé, un billet annulé ou remboursé affichent `event_cancelled`, `cancelled`, `refunded` : à l'étape du code, le statut d'annulation est contrôlé **avant** de conclure au code périmé (section 2, M5). Raison : lettre de la consigne et information utile au contrôleur.
- **D4** Un succès de paiement tardif émet toujours les billets (l'argent est pris). Ajouts : refus d'un second paiement PENDING non échu pour le même compte et le même événement (`409 PAYMENT_PENDING` avec `payment_id`) ; vérification chez SamirPay avant toute annulation par le client ; si SamirPay est injoignable, l'annulation est refusée (`503 PROVIDER_UNAVAILABLE`) plutôt que faite à l'aveugle. Le cas résiduel (deux paiements réussis du même panier) reste un point ouvert.
- **D5** IDOR `GET /api/orders?userId=` (`app/api/orders/route.ts:12-24`) corrigé en 7.3 même si la page est masquée par défaut.
- **D6** « La veille » en e2e : événement qui commence ≈ 20 h après l'heure réelle, `access.scan_window_before_hours = 24` posé par le service_role (`finance_setting_set`) puis restauré dans un `finally`. Aucune route n'accepte d'heure simulée, même en mode test.
- **D7** Le service worker reste à l'URL `/sw.js` (même URL dans `components/pwa/ServiceWorkerRegister.tsx` et `lib/push/client.ts:19`). Il ne met en cache que la page hors ligne et ses ressources statiques, jamais `/api/`. `serviceWorkers: 'block'` reste le réglage global de Playwright (`playwright.config.ts:40`), `'allow'` seulement dans les contextes dédiés. **Renverse la décision 4 du lot 6** (SW sans cache) : signalé dans le rapport.
- **D8** Transformer un client connecté en partenaire et appliquer `max_events` des abonnements : hors périmètre, points ouverts, rien n'est changé.
- **D9** Interblocage possible `payment_confirm` / `event_cancel` (`20261103000005_lot6_billetterie.sql:467,485-487` contre `:1094,1131,1161` ; aggravé par le `FOR KEY SHARE` que l'insertion d'un billet pose sur `events`) : **point ouvert**, non corrigé. Raison : SUPPOSÉ, `rpcWithRetry` rejoue déjà 40P01 (`lib/payments/rpc.ts:9-19`), et aucun test rouge déterministe n'est possible (il faudrait suspendre `event_cancel` au milieu de son corps) ; un correctif sans test rouge violerait la méthode. Remède documenté pour le lot 8 : `events FOR NO KEY UPDATE`, puis paiements, puis catégories.
- **D10** Insertions REST de `hall_reservations`, `table_reservations`, `orders` : les politiques `hall_reservations_insert`, `table_reservations_insert`, `orders_insert` (`supabase/migrations/0003_rls.sql:184,217,250`) sont **supprimées** ; toutes les écritures passent par des routes en service_role (PROUVÉ : `app/api/halls/reserve/route.ts:18`, `app/api/restaurants/reserve-table/route.ts:20`, `app/api/orders/create/route.ts:18` ; aucun `insert` navigateur, grep). Petit et sûr, testé sous anon.
- **D11** `401` sur `/api/halls` pour un visiteur : les GET publics des salles, tables et menus deviennent publics au middleware ; la route contrôle l'interrupteur en premier (404 si fermé).
- **D12** Indispensable = `family = 'ESSENTIAL'` du registre `notification_types` (une seule source). Liste des types ESSENTIAL avec SMS publiée dans le rapport pour le client : PURCHASE_CONFIRMED, FREE_TICKETS_CONFIRMED, reçus de guichet, REFUND_*, EVENT_CANCELLED, TRANSFER_*, PASSWORD_CHANGED et sécurité du compte, EVENT_VALIDATED/REJECTED/SUSPENDED/REACTIVATED, PARTNER_*, TRIAL_STARTED, CONTROLLER_ASSIGNED/UNASSIGNED/ACTIVATED, SHIFT_DISCREPANCY, WITHDRAWAL_* (liste exacte tirée du registre par le rapport).
- **D13** Compteur du budget optionnel = nombre de lignes `notification_outbox` SMS `OPTIONAL` en `SENDING`, `SENT` ou `UNCERTAIN` dont `claimed_at` tombe dans le jour de Dakar de l'horloge de l'envoyeur ; lu et incrémenté sous `pg_advisory_xact_lock(hashtext('notif.sms_optional_cap:'||jour))`. Une tentative réservée compte (même si l'envoi échoue ensuite) : prudent pour le coût.
- **D14** Les SMS optionnels restent soumis en plus à la garde anti-abus `sms_global` (part non OTP) ; les indispensables n'y sont plus soumis (ni à aucun plafond journalier) ; `sms_phone`, `sms_account`, `sms_counter_receipt` restent pour tous ; l'invitation de contrôleur et les appels sans famille (`acces-limiteurs.test.ts:425-455`) gardent la part non OTP.
- **D15** `notif.sms_daily_alert` est supprimé (ligne de `platform_settings`, historisée « suppression » par `trg_platform_settings_audit`, branche de validation, liste blanche, page). Le type `ADMIN_SMS_DAILY_THRESHOLD` reste au registre (clé étrangère des lignes écrites) sans nouvelle ligne. Nouveaux types `ADMIN_SMS_OPTIONAL_80` et `ADMIN_SMS_FORECAST`, signaux `SMS_OPTIONAL_80` et `SMS_FORECAST`. Plafond 0 : aucune alerte ni prévision (l'admin a coupé volontairement).
- **D16** Prévision de la veille calculée au pire (`IF_NO_PUSH` compté comme SMS), en excluant les porteurs sans SMS (préférence, compte bloqué, sans numéro, billets gratuits seulement avec `NEVER`, plage de silence) ; filtrée par `only_event_ids` quand il est fourni (isolation des suites, documenté) ; une fois par jour de Dakar du lendemain.
- **D17** Billet gratuit = `price = 0 OR sale_channel IN ('FREE','INVITATION')`. « Ne détient que des billets gratuits » : par événement et par porteur, aucun billet VALIDE de l'événement hors de ce prédicat. Décidé à la planification (motif `FREE_TICKETS_ONLY`), pas revérifié à l'envoi (cas marginal d'un achat payant entre-temps, listé).
- **D18** `verifyAdminAuth` refuse tout compte dont `users.status <> 'ACTIF'` (403 `ACCOUNT_NOT_ACTIVE`) et ne se replie plus sur `users.role` quand `user_roles` est vide (`lib/admin/admin-auth.ts:118-128`, règle du lot 1B.8).
- **D19** L'anonymisation retire aussi `ADMIN` et `SUPERADMIN` de `user_roles` (sinon `is_admin()` reste vrai côté RLS pendant la vie du JWT) et supprime `admin_permissions` par `user_id` (`lib/admin/admin.service.ts:417`). L'échec d'un retrait est une erreur remontée (plus un simple journal).
- **D20** Course `event_cancel` / acceptation : `ticket_transfer_accept` pose `events … FOR SHARE` (événement du billet) **avant** de verrouiller le transfert et refuse si le statut n'est ni `PUBLIE` ni `VALIDE` (`EVENT_NOT_ACTIVE`) ; `ticket_transfer_claim` (encore appelée par `accept`, `:396`, donc conservée) contrôle le statut en lecture simple ; `event_cancel` verrouille les transferts PENDING puis les billets de l'événement (`ORDER BY id FOR UPDATE`) **avant** de lire les porteurs.
- **D21** `ticket_categories_read_public` et `ticket_categories_admin_manage` ne lisent plus `public.users` : fonction `ticket_category_private_read(uuid)` SECURITY DEFINER, 7e aide RLS.
- **D22** Activation du contrôleur : code consommé atomiquement **avant** la pose du mot de passe ; deux activations simultanées → une seule 200. Une nouvelle invitation d'un numéro dont le compte est encore `is_temporary_controller_account` émet un nouveau code (`CONTROLLER_SETUP`), ce qui rend possible une nouvelle tentative.
- **D23** `notification_channel_enum` supprimé (`DROP TYPE IF EXISTS`, aucune dépendance, aucun corps de fonction ne le cite).
- **D24** `public/manifest.json` gardé (pas d'`app/manifest.ts`) ; `id`, `scope`, `start_url` = `/` ; `background_color` `#F8F9FA` (thème clair par défaut) ; `theme_color` `#FF5722` inchangé (`tests/e2e-scenarios.test.ts:163-169`) ; icônes maskable 512 et apple-touch 180 **opaques** générées à partir de l'anneau, sans le dégradé interdit (`MASTER.md:54`) ; `/icons/` public au middleware.
- **D25** Installabilité prouvée par `chromium.launchPersistentContext(…, { channel: 'chromium' })` : `beforeinstallprompt` **et** `Page.getInstallabilityErrors` vide **et** requêtes du manifest et des icônes en 200, plus un témoin négatif (manifest sans icône → `manifest-missing-suitable-icon`). Le headless shell donne un faux positif (PROUVÉ, `discovery-7-pwa.md` §2.3) : le témoin le rend rouge.
- **D26** Page unique, publique et statique `/billet/hors-ligne?id=<uuid>` (au lieu de `/billet/[id]/hors-ligne`) : rien de personnel ni de lié à la session dans le HTML mis en cache ; toutes les données viennent d'IndexedDB ; rendue nue par `AppLayout` ; liens `<a href>` (navigation complète, pas de `?_rsc=`).
- **D27** Rotation de la version par un trigger unique sur `tickets` : changement de porteur, sortie de `VALIDE` vers autre chose que `UTILISE`, changement explicite du secret ou de la version. `VALIDE → UTILISE` ne tourne pas (sinon le second scan d'un même code ne dirait plus `already_used`). Historique `ticket_secret_versions` daté par `clock_timestamp()` (après l'obtention du verrou de ligne).
- **D28** « Régénération du secret » : RPC service_role `ticket_secret_rotate`, testée, sans écran au lot 7.
- **D29** Téléchargement refusé pendant un transfert en attente (`409 TRANSFER_PENDING`), comme la carte qui masque déjà le QR (`components/tickets/TicketCard.tsx:121`).
- **D30** Événement `TERMINE` : téléchargement refusé (la consigne exige `PUBLIE`) ; les codes déjà téléchargés restent valables jusqu'à la fermeture du scan.
- **D31** Lot glissant de 48 h au plus, format compact (chaîne de chiffres), aucun paramètre de requête ; le client retélécharge quand il a du réseau et que son lot non complet se termine dans moins de 24 h.
- **D32** `secret_version` absent dans `ticket_scan` pour un QR : refus (fail-closed) ; `tests/seed/seed-demo.ts:716-724,1067` adapté.
- **D33** Rappel H-3 : lien `/tickets` gardé (`lib/notifications/catalog.ts:545,550`) ; seul le texte in-app change (`:548`, plus de « demande une connexion »).
- **D34** IndexedDB écrit à la main (`lib/tickets/offline-store.ts`), aucune dépendance ; la logique pure (choix du code, purge) est testée en node, le stockage en e2e.
- **D35** « Disponible hors ligne » exige les codes de la version courante **et** la coquille en cache (`caches.match('/billet/hors-ligne', { ignoreSearch: true })`).
- **D36** Repli de navigation du SW limité à `/` et `/tickets`, sur échec réseau seulement, par une redirection vers `/billet/hors-ligne` ; un lien « Afficher mes billets hors ligne » et le raccourci du manifest couvrent le réseau saturé.
- **D37** Quotas : `OFFLINE_CODES_PER_TICKET_HOUR = 12`, `OFFLINE_CODES_PER_USER_HOUR = 60` (fenêtres de 3 600 s) ; l'e2e les relève dans `.env.e2e` (captures en contextes neufs) ; leurs tests alignent la rafale sur une fenêtre.
- **D38** Les refus (404, 409, 429) ne sont pas écrits dans `ticket_offline_downloads` (pas d'oracle) : `console.warn` côté serveur.
- **D39** `Idempotency-Key` obligatoire sur `POST /api/controller/scan` (400 `IDEMPOTENCY_KEY_REQUIRED`) ; `postScan` la génère pour les deux écrans de scan ; l'encaissement (`PUT`) est idempotent par sa clé naturelle `scan_id`.
- **D40** Un rejeu rend le verdict d'origine même si le code a expiré entre-temps, sans nouvelle ligne ; un rejeu d'encaissement par le même scanneur rend `valid` avec le montant (jamais 409).
- **D41** Anti-doublon de lecture : le même payload est ignoré tant que le résultat est affiché et 20 s après un `valid` ; un `already_used` dont `checked_in_by` est le scanneur courant depuis moins de 30 s s'affiche « Déjà validé par vous à HH h MM ».
- **D42** Compteur de porte = entrées acceptées de l'événement avec le même `entry_point` ; sans point d'entrée, les entrées acceptées par ce contrôleur, libellé « Vos entrées ». « Arrivées » n'est plus coupé à minuit UTC (`app/api/controller/assignments/route.ts:45,63`) : total de l'événement.
- **D43** Saisie manuelle en deux temps : « Vérifier » (lecture sans compostage, quota, journal `audit_logs`) puis « Pièce conforme, valider l'entrée » (même clé d'idempotence).
- **D44** Délai de retour automatique : préférence locale à l'appareil (`localStorage` dans un `try`, erreur journalisée), 1 / 1,5 / 2 / 3 s pour un accepté (défaut 1,5 s) ; refus et hors fenêtre 3 s ; encaissement : attend une action ; un toucher ferme tout de suite.
- **D45** Thème sombre forcé sur `/controller/*` (classe `dark` et `color-scheme: dark` sur la racine de `app/controller/layout.tsx`), sans bascule.
- **D46** Caisse alignée sur le serveur : PIN facultatif à l'ouverture, obligatoire seulement pour une clôture avec écart ; écart et total attendu lus sur le serveur ; plus aucun `step` sur les montants (`components/shifts/ShiftModals.tsx:205,383`).
- **D47** Incident technique (`rate_limited`, `network_error`, `server_error`, hors ligne) : pas de vibration, écran neutre, jamais compté comme refus.
- **D48** Veille de la caméra : arrêt réel du flux (`getTracks().stop()`) après 3 min sans lecture, réveil par un toucher ; arrêt aussi à `visibilitychange` (déjà présent, `CameraQrScanner.tsx:338-352`) et boucle de détection suspendue pendant les pauses.
- **D49** Écran « Commencer le contrôle » (choix de l'événement, rappel de la porte) : premier toucher qui active la vibration (intervention de Chrome Android, SUPPOSÉ) ; ensuite aucun clic pour enchaîner.
- **D50** Vibrations : accepté `[60]` ; déjà utilisé, refusé, événement annulé `[120,60,120,60,120]` ; à encaisser et hors fenêtre `[250,100,250]` ; technique : aucune. La vibration de 80 ms à la lecture (`CameraQrScanner.tsx:163-170`) est supprimée.
- **D51** Jetons `--scan-*` identiques en clair et en sombre, texte ≥ 7:1 vérifié par un test (section 6.5).
- **D52** Audio supprimé entièrement : `lib/hardware/wolof-audio.ts`, `public/sounds/**`, oscillateurs de `lib/hardware/feedback.ts`, boutons, préférences ; la clé `localStorage` `event_village_wolof_muted` est retirée au démarrage du scanner (dans un `try`, échec journalisé).
- **D53** Vente au guichet : écran créé, total renvoyé par le serveur (`POST /api/controller/counter-sale/quote`) ; onglet masqué si `access.counter_sale_enabled` est faux ou sans `can_accept_cash`.
- **D54** Incidents réseau de l'appareil déclarés en lot au retour du réseau (`POST /api/controller/scan/incidents`, route existante sans appelant), sans bloquer le scan.
- **D55** `features.orders_enabled` = commandes de repas (produits, menu, `orders`) ; `/orders` répond 404 quand les **trois** interrupteurs sont fermés, sinon n'affiche que les onglets ouverts ; les achats de billets restent dans Mes billets et `/paiement/<id>`. Les valeurs sont lues par `GET /api/features` ; les entrées de navigation sont masquées tant que la réponse n'est pas arrivée.
- **D56** Ordre des contrôles : routes protégées = session puis interrupteur (préserve `tests/parcours/acces-securite-urgente.test.ts:150-180`) ; GET publics = interrupteur d'abord ; pages = `layout.tsx` serveur qui appelle `notFound()` ; paiement hors billetterie = 404 selon `targetType` après la session.
- **D57** `/admin/services` reste visible quand les interrupteurs sont fermés (lecture), avec la mention « service désactivé ».
- **D58** Texte d'attente honnête : « Gardez cette page ouverte pour suivre la confirmation. Si elle se ferme, votre achat est quand même enregistré : vous recevrez un SMS au <numéro masqué> et vos billets apparaîtront dans Mes billets. »
- **D59** Jetons d'opérateur `--op-wave`, `--op-orange-money` (fond et texte, contraste ≥ 4,5:1 vérifié), au lieu de `bg-[#1DC8F2]` et `bg-[#FF7900]` (`PaymentModal.tsx:383-386`).
- **D60** Montants du parcours d'achat au format `formatFcfa` (« F CFA ») partout.
- **D61** `?redirect=` conservé de la connexion à l'inscription et après l'inscription, chemins internes seulement (commence par `/`, pas `//`).
- **D62** Lien de la notification `PAYMENT_SUCCESS` d'un abonnement vers `/orders` (404 quand les interrupteurs sont fermés) : point ouvert (texte figé par `notif-modeles.test.ts:230-233`) ; la page `/paiement/<id>` mène, elle, vers `/partner/subscription` (cible renvoyée par la route).
- **D63** `/partner/register` ouvert par un compte connecté : état explicatif (« ce formulaire crée un compte professionnel distinct, avec un autre numéro ») et lien de déconnexion ; pas de conversion.
- **D64** Inscription partenaire : tout le formulaire validé (schéma partagé sans les jetons) **avant** les téléversements ; jetons de dépôt réutilisés d'une tentative à l'autre tant qu'ils ne sont pas expirés ; renvoi du code avec décompte.
- **D65** Abonnement : plus de `PLAN_HIGHLIGHTS` inventés (`app/partner/subscription/page.tsx:38-62`) ; nom, prix, période traduite, caractéristiques avec libellé servies ; état vide « Aucune offre n'est encore publiée » ; pourcentage d'essai servi.
- **D66** Équipe : `members_count`, `assignments_count`, affectations groupées et événements assignables servis par `/api/partner/team/all` ; la recherche par nom reste locale sur la liste complète (filtre de saisie, pas un chiffre).
- **D67** Contrôleur (setup, profil) : la page affiche la règle du serveur (8 caractères, majuscule, minuscule, chiffre), sans imposer le caractère spécial de `PasswordStrengthChecklist`.
- **D68** Cloche : libellé « Tout marquer comme lu » gardé, bouton sur sa propre ligne sous le titre, `whitespace-nowrap` ; aucun test à adapter (PROUVÉ, `discovery-7-partenaire.md` §3.6).
- **D69** Bloc « Commandes & Services Live » du tableau de bord masqué par `features.orders_enabled`, import de `usePartnerOrders` gardé (SCENARIO 15, `tests/e2e-scenarios.test.ts:119-126`).
- **D70** Première utilisation : objet `onboarding` servi par `/api/partner/dashboard` (étapes cochées par le serveur), carte visible tant que le partenaire est VALIDE sans événement PUBLIE ou TERMINE.
- **D71** Campagnes admin : la page dit « Brouillon enregistré : l'envoi immédiat est désactivé », n'envoie plus `sendNow: true`, n'affiche plus de statut brut ni « livrés ».
- **D72** `PATCH /api/partner/profile` validé par Zod (types, longueurs, numéro normalisé, URL `https:` du stockage), activités remplacées dans une seule RPC ou refus sans suppression ; message de base jamais renvoyé.
- **D73** Les contrôles axe (≥ 1 règle), cibles < 44 px et textes < 14 px hors exemption deviennent **bloquants** dans les captures (`e2e/support/checks.ts`) : durcissement signalé.
- **D74** Attribution Leaflet marquée `data-ev-caption` dans `components/ui/EventMap.tsx` et `MapPicker.tsx` (mention légale).
- **D75** `sharp` 0.33.5 épinglé en `dependencies` ; `liquid-glass-react` et `react-leaflet` retirés ; `@types/leaflet` en `devDependencies` ; `legacy-peer-deps` retiré de `.npmrc` seulement si `npm ci` passe en CI (sinon gardé, signalé) ; le lockfile contient `@img/sharp-linux-x64` et `@img/sharp-libvips-linux-x64`.
- **D76** Poids JS : budget **bloquant** mesuré après `next build` (layout racine et template compris) ; temps (FCP, LCP, premier affichage utile) en **avertissement** ; mesure sous 4G simulée et processeur ×4, médiane de 5 passages.
- **D77** `framer-motion` retiré du dépôt (seuls importateurs : `TransferExplainerModal.tsx:4`, `app/paiement/[id]/page.tsx:15`), contrôle statique.
- **D78** `.ev-page-enter` (`app/globals.css:411-419`) n'anime plus l'opacité depuis 0 (transform seul).
- **D79** Passage des pages publiques en composants serveur : hors lot 7, point ouvert.
- **D80** Nouveaux rôles e2e `fumee-client-bis` (`CLIENT_BIS`) et `fumee-controleur` (`CONTROLLER_A`, `tests/helpers/fixture-data.ts:13,16`).
- **D81** Fumée : identification des SMS par jointure `notification_outbox.provider_message_id` = `ticket` du faux MTarget ; la boîte d'E1 est vidée (`onlyEventIds=[E1]`) avant le repère de l'étape 8 ; l'étape 10 affirme la liste exacte (type, clé). Signalé.
- **D82** Trois nouvelles phases Playwright, séparées des captures : `terrain`, `pwa`, `perf`.
- **D83** Réseaux simulés : 4G = 562,5 ms, 1,44 Mbit/s descendant, 675 kbit/s montant (DevTools « Slow 4G », ex-« Fast 3G ») ; 3G = 2 000 ms, 400 kbit/s, 400 kbit/s (DevTools « 3G », ex-« Slow 3G ») ; noms SUPPOSÉS, valeurs recopiées telles quelles dans le rapport.
- **D84 ★** Captures : l'attente « réseau au repos 15 s » (`e2e/captures.spec.ts:51-54`, jamais atteinte dans 164/172 captures) est remplacée par `ready` + polices chargées + aucune requête `/api/` en cours depuis 500 ms, plafonné à 3 s. Sans cela, ≈ 100 captures de plus dépasseraient le délai de 60 min du job. Changement d'infrastructure signalé.
- **D85** Écrans du scanner capturés en deux vues (mobile et ordinateur, sombre seul : le thème est forcé).
- **D86** (p)(q) : instantané de décision écrit sous verrou, recoupé par l'historique des versions daté par `clock_timestamp()` ; pas de recoupement par `event_status_history` (daté par `now()` de début de transaction, faux positifs) ; tolérance d'une minute sur `checked_in_at` (daté par `now()`).
- **D87** Données de la confirmation **figées à l'émission**, dans la transaction métier : catégories et quantités, 10 premiers numéros, nombre total, montant, lieu, ville. Jamais lues au moment de l'envoi. Raisons : règle du lot 6 (l'envoyeur rend depuis `template_data`, instantané immuable) ; invariant (o) (aucune lecture de base au rendu, donc aucun `FAILED TEMPLATE_ERROR` supplémentaire) ; exactitude (l'email décrit l'achat tel qu'il a eu lieu, même si un billet est transféré entre l'achat et l'envoi). Moyen : nouvelle migration `20261105000007_lot7_confirmation.sql` (aucune migration gelée modifiée).
- **D88** Le numéro affiché partout est `tickets.ticket_number` (même valeur dans l'email, Mes billets, le PDF, la saisie manuelle et `ticket_manual_lookup`). Après un transfert, l'email `TRANSFER_RECEIVED` donne le **nouveau** numéro ; les numéros de l'email d'achat de l'expéditeur deviennent invalides à la saisie manuelle (attendu, sécurité).
- **D89** Ordre de la liste : nom de catégorie, puis numéro. Seuls les 10 premiers numéros sont stockés (`ticket_numbers`), avec `ticket_count` ; au-delà : « et N autres » (N = `ticket_count − 10`, singulier « et 1 autre »).
- **D90** Ligne mise en file avant la migration (sans `categories` ni `ticket_numbers`) : email rendu sans le détail des catégories ni la liste, avec toutes les phrases obligatoires ; ce n'est pas une erreur (champs facultatifs dans `catalog-types.ts`). SUPPOSÉ : aucune ligne de ce genre en production (base vide le 02/11).
- **D91** `TRANSFER_RECEIVED` reçoit le canal EMAIL (registre par la migration 07, catalogue dans le même commit) ; envoyé à l'adresse du compte destinataire (règle du lot 6 : adresse factice `…@eventvillage.sn` → `SKIPPED NO_REAL_EMAIL`) ; contenu : événement, date, lieu, ville, catégorie, **nouveau** numéro, phrases ; **aucun montant ni prix**. `TRANSFER_OFFERED` et `TRANSFER_CANCELLED` restent sans email (amendement 2 du lot 6).
- **D92** Gabarit : `emailLayout` étendu (blocs facultatifs, §19.5). Clair par défaut en styles en ligne ; thème sombre par `<style>` `@media (prefers-color-scheme: dark)` et `meta color-scheme`, qui ne fait que surcharger les styles en ligne. Les clients qui ignorent ce bloc (Gmail notamment, SUPPOSÉ) restent en clair. Change la règle « aucune feuille de style » du commentaire de tête du lot 6 : signalé.
- **D93** Bouton « Voir mes billets » vers `/tickets` pour les trois types ; tous les autres emails gardent « Ouvrir Event Village ».
- **D94** Sujet inchangé (`<titre in-app> — Event Village`) ; in-app de `PURCHASE_CONFIRMED` inchangé (contient déjà événement, date, nombre, Mes billets) ; in-app de `FREE_TICKETS_CONFIRMED` complété par « Vos billets sont dans Mes billets. » ; in-app de `TRANSFER_RECEIVED` complété par le numéro et la date (texte §19.4). Push : dérivé de l'in-app, inchangé dans son mécanisme.
- **D95** SMS : la mention « Billets dans l'appli, rubrique Mes billets » n'est **jamais** ajoutée : elle ne tient pas au pire cas (194 à 205 septets, §19.1), et le lien `/tickets` du SMS mène déjà à Mes billets. Pour que le SMS d'achat tienne en un segment au pire cas, le budget du titre passe de 20 à **19** septets (`smsVar(title, 19)`) : 160 septets avec 999 billets, frais 999 999 F, total 9 999 999 F, URL de 27 caractères. Aucun numéro de billet dans un SMS. Changement minimal (un septet), signalé ; les textes exacts des tests à titre court ne changent pas.
- **D96** Serveur de 7.9 confié à **A1** (propriétaire de `catalog.ts`, `catalog-types.ts`, `outbox-labels.ts`), commit `fix(7.9)` ; A1 prend aussi `lib/notifications/email-layout.ts` (sans propriétaire en section 12) et la migration 07. Pas d'agent A6 : un seul propriétaire par fichier.
- **D97** Ordre : `fix(7.9)` après `test(7.9)` (W11), après `fix(7.0b)` (même agent) et après `fix(7.0c)` d'A2 (la migration 07 recopie `ticket_transfer_accept` **dans sa version de M3**, verrou `FOR SHARE` compris).
- **D98** Capture de l'email : rendu par un script e2e (`node --import tsx`) qui appelle le catalogue avec des données d'exemple, sans aucune route ni mode de test dans l'application livrée.
- **D99** Phrases reprises mot pour mot de la consigne, avec l'apostrophe droite de la consigne (« ' ») ; le rappel de la saisie manuelle est rédigé ainsi : « En cas de problème à l'entrée, présentez le numéro de votre billet et une pièce d'identité : le contrôleur peut l'enregistrer à la main. »

**Écarts entre ces décisions et ce qui est livré :**
- **D57 :** `/admin/services` n'affiche pas « service désactivé ». La page reste seulement lisible ; la documentation le dit.
- **D75 :** `legacy-peer-deps` est gardé dans `.npmrc`. Sans lui, `@emnapi/wasi-threads` entre dans la résolution et `npm ci` trouve le lockfile désynchronisé (point ouvert).
- **Contrat 11.2 :** la capture `billet-hors-ligne-qr` prend le billet de « ce soir » et non celui de « la veille ».
- **Contrat 9, exigences de poids :** celle du scanner (− 10 Ko) et l'hypothèse de 150 Ko pour `/billet/hors-ligne` ne sont pas tenues (section 8).
- **Contrat 16.7 :** la mesure e2e de la taille réelle transférée, avec `content-encoding`, n'est pas faite.

### 14.4 Décisions prises par les agents (au plus prudent, signalées dans leurs réponses)

- **SMS (A1) :**
  - une famille absente compte comme non ESSENTIAL et garde la part non OTP ;
  - les reçus du guichet sont ESSENTIAL, donc hors plafond global, mais restent sous leur quota par caisse ;
  - le prédicat « gratuit » est `IS TRUE` : une valeur vide compte comme payante ;
  - prévision de la veille au pire, recalculée à chaque planification, une alerte par jour ;
  - seuil = `ceil(8 × plafond / 10)`, null si 0.
- **Sécurité (A2) :**
  - `EVENT_NOT_ACTIVE` n'est contrôlé qu'après l'identité et l'état du transfert, pour ne pas révéler l'existence d'un transfert ;
  - `ticket_transfer_claim` sur un billet introuvable renvoie `TICKET_NOT_TRANSFERABLE` ;
  - le code d'activation est consommé avant tout, donc un échec ultérieur demande une nouvelle invitation ;
  - une réinvitation fait échoir les codes précédents ;
  - le message `ACCOUNT_NOT_ACTIVE` ne dit pas le statut.
- **Hors ligne (A3) :**
  - un seul instantané de fenêtre en SQL ;
  - `ticket_secret_rotate` n'accepte que `REGENERATE` ;
  - une version en double est une erreur ;
  - 500 `SERVER_ERROR` avec un code ;
  - si `ticket_offline_info` échoue, `GET /api/tickets` répond 500 ;
  - icône maskable : disque `#FF5722` plein, centre blanc dans le cercle de sécurité.
- **Scan (A4) :**
  - la clé est contrôlée après le quota (une requête sans clé consomme le quota) ;
  - un rejeu ne rend `ticket` que si la réponse d'origine le rendait ;
  - la saisie manuelle refusée est aussi journalisée, numéro haché ;
  - le devis du guichet applique les contrôles de la vente (400 `INVALID_ITEMS`).
- **Client (A5) :**
  - erreur de lecture des interrupteurs : 503 `FEATURES_UNAVAILABLE` (routes) ou page d'erreur (layouts) ;
  - clé absente : `false` ;
  - annulation selon la réponse de SamirPay (codes dans « À lire en premier », point 5) ;
  - `receipt_channels` selon le registre et la configuration réelle ;
  - le quota `otp_verify_phone` s'applique à l'inscription.
- **Écrans :**
  - **E1 :** atomicité du profil partenaire par l'ordre des écritures, sans RPC (point ouvert) ; champs vidés enregistrés à null.
  - **E2 :**
    - téléchargement seulement dans la fenêtre ;
    - écart d'horloge recalculé à chaque `live-code` ;
    - état `corrupt` ;
    - `OFFLINE_READY` envoyé aux onglets ;
    - purge à la déconnexion, au transfert et au changement de compte.
  - **E3 :**
    - relances à 4, 6 puis 8 s, trois essais au plus ;
    - retour automatique réglable (1, 1,5, 2 ou 3 s) ;
    - veille de la caméra après 3 min ;
    - incidents envoyés par lots de 20.
  - **E4 :**
    - aides de paiement sorties de la modale ;
    - `?reprise=` préremplit le panier ;
    - « Commandes » visible si l'un des trois interrupteurs est ouvert.
  - **E5 :**
    - règles de la première utilisation (PROFILE : description et logo ; CONTROLLERS : une affectation) ;
    - `commission_rate` jamais affiché ;
    - « Passer à ce plan » remplacé par « Contacter le support ».
- **E2E :**
  - états éphémères tenus par des minuteries étirées, plutôt que par l'horloge simulée ;
  - numéro du second client marqué vérifié par le script de préparation.
- **R4 :**
  - 24 h pour la session, 2 min pour le scan en attente ;
  - renvoi seulement si l'application a été quittée pendant l'envoi ;
  - aucun état dans l'URL.

---

## 15. Points ouverts

1. **Instabilité observée une fois : `temps-reel-billets` au run 83.**
   - Le cas « le porteur reçoit UTILISE en temps réel » a échoué une fois, au run 83 (délai de 20 s dépassé).
   - Il est vert aux runs 77, 78, 80 et 84.
   - Le lien avec le « Rate exceeded » du registre sur l'image `realtime` est SUPPOSÉ ; la cause n'est pas établie (section 6.3).
   - À surveiller : s'il échoue de nouveau, il faut l'instruire.
2. **`main` est toujours sur `6fff1bf`**, rouge au sens du run 70. Il n'avance que sur demande de l'utilisateur, après lecture du rapport. La preuve du lot est le run 84 (`55afc8b`, dernier commit de code) ; le commit du rapport ne change que la documentation.
3. **Mode « renvoi seulement » du scan côté serveur** (lot 8, A10). Aujourd'hui, le scan en attente au moment de la sortie est renvoyé tel quel, avec sa clé d'idempotence.
4. **« Carré presse »** : une catégorie masquée au public mais vendable au guichet. Est-ce voulu ? **Question métier pour l'utilisateur.**
5. **Champ date « mm/dd/yyyy »** sur `admin-notifications` : gabarit du Chromium sans interface de la CI, anglais seulement. Un Chrome en français affiche « jj/mm/aaaa ». Le remplacer par un composant maison n'est pas sans risque.
6. **Police à chasse fixe** : plus de 40 usages de `font-mono`, dont des champs de saisie. Corrigée seulement sur la page de paiement ; à trancher dans `MASTER.md`.
7. **Barre d'achat fixe de la fiche événement** : elle reste rattachée à `.ev-page-enter`, comme les anciennes modales, et pourrait se placer en bas de la page plutôt qu'en bas de l'écran. Personne ne l'a relevée sur les captures : à surveiller.
8. **D79 : client Supabase dans le layout racine.** Environ 200 Ko communs à toutes les pages, dont environ 69 Ko pour Supabase. Il faudrait passer les pages publiques en composants serveur. Sans cela, l'objectif de − 10 Ko du scanner reste manqué de 3,3 Ko (222 499 octets au run 84, après `28d62ae`, pour 219 207 exigés), et les 150 Ko de la page hors ligne sont hors d'atteinte (211 561 octets).
9. **`max_events` des abonnements** : non appliqué (le seed vaut 2, l'écran dit « jusqu'à 3 »), et toujours affiché (D8).
10. **Transformer un compte client connecté en partenaire** : non prévu. `/partner/register` explique qu'il faut un autre numéro (D8, D63).
11. **Interblocage possible entre `payment_confirm` et `event_cancel`** (D9). Remède documenté : `events FOR NO KEY UPDATE`, puis paiements, puis catégories. Même famille, relevé par A2 : `ticket_scan` verrouille le billet, puis sa clé étrangère vers `events` attend le `FOR UPDATE` d'`event_cancel` (existant, non aggravé).
12. **Atomicité du profil partenaire** (`PATCH /api/partner/profile`) : l'ordre des écritures évite toute perte d'activité, mais une erreur entre deux étapes rend une 500. Une RPC unique serait plus sûre.
13. **`.npmrc` garde `legacy-peer-deps=true`** (D75). Pour le retirer, il faut un `npm ci` vert en CI sans lui, ce qui demande de régénérer le lockfile.
14. **Compression de `/api/` chez l'hébergeur** (lot 8). Sans gzip, un lot hors ligne de 48 h fait 52 Ko au lieu de 25,7 Ko. La mesure réelle de la taille transférée en e2e reste à écrire.
15. **Les « SMS non identifiés » de la fumée du lot 6 sont identifiés** (section 2, 7.0 d) : PURCHASE_CONFIRMED de E1 et de E2, et REFUND_PAID de E2. Il n'y a aucun doublon ; ce sont 3 SMS, et non 2 comme l'écrivait le rapport du lot 6. Leurs longueurs ne sont pas imprimées (NON VÉRIFIÉ).
16. **Deux paiements réussis du même panier** (succès tardif après un second paiement) : rembourser automatiquement ou non (D4).
17. **Lien de la notification `PAYMENT_SUCCESS` d'un abonnement vers `/orders`**, qui répond 404 quand les interrupteurs sont fermés (D62). Le texte est figé par `notif-modeles`.
18. **Alertes `SMS_OPTIONAL_80` et `SMS_FORECAST`** : elles ne rechargent pas la page Notifications de l'administration en direct, parce que le filtre est figé par `notif-interface:957-961`.
19. **D57 non livré** : `/admin/services` n'affiche pas « service désactivé ».
20. **`ClosingReportModal.tsx`** : non migré au système de design, et chargé à la demande hors du contrôle statique.
21. **iOS :**
    - aucun test automatisé possible ;
    - stockage séparé entre Safari et l'application installée ;
    - pas de vibration ;
    - effacement possible des données après 7 jours sans visite dans Safari (documenté).
22. **Préchargement des parties du scanner** (`28d62ae`) : le cas où une partie n'est pas encore chargée au premier verdict (repli neutre) n'a pas de test dédié. Il est NON VÉRIFIÉ en CI ; les parcours e2e du scanner sont verts au run 84.
23. **Écart d'horloge faussé** si le téléphone se recale par NTP après le téléchargement. C'est atténué par le recalcul à chaque `live-code` et par l'état `clock_changed`.
24. **Codes hors ligne lisibles dans IndexedDB par le porteur.** Une seule entrée reste possible, et les codes tournent au transfert.
25. **Écart signalé par E3** : le serveur ne renvoie pas l'écart de caisse avant une clôture refusée (`JUSTIFICATION_REQUIRED` ou `PIN_REQUIRED`, `lib/shifts/shift.service.ts:400-401`).
26. **Constats hors périmètre, non corrigés :**
    - **messages d'erreur bruts de la base :**
      - `GET /api/admin/communications` renvoie `error.message` brut ;
      - des messages du serveur sont repris tels quels dans certains états d'erreur ;
    - **erreurs de lecture ignorées :** `GET /api/controller/profile` ignore l'erreur de lecture des affectations ;
    - **salles, tables et commandes :**
      - `/api/restaurants/[id]/tables` se replie sur le premier partenaire venu ;
      - l'acompte de table est calculé dans le navigateur ;
      - les écrans des services ne sont pas migrés (derrière les interrupteurs) ;
    - **comptes et rôles :**
      - les redirections du middleware vers `/?error=unauthorized_*` ne sont lues par aucune page ;
      - l'essai d'un partenaire SUSPENDU peut être activé (SUPPOSÉ) ;
      - le retrait du rôle CONTROLEUR échoue à l'anonymisation quand une caisse est ouverte ;
    - **chiffres :** `commissionAmount` vaut 0 en dur au tableau de bord partenaire ;
    - **billets gratuits :** le prédicat « billets gratuits seulement » n'est pas revérifié à l'envoi (D17) ;
    - **pages :** `evenement-non-public` sert sa page introuvable en HTTP 200.
27. **Préchargement des navigations du service worker** (`navigationPreload`), SUPPOSÉ : il pourrait doubler les requêtes des pages que le service worker n'intercepte pas. Non mesuré.
28. **Legacy** : `scanner-security-hardening`, `dynamic-qr-totp` et `ticket-transfer-*` sont probablement rendues fausses par le lot. Elles sont hors CI et je ne les ai pas lancées.
29. **Les corrections de la relecture** (run 77) n'ont pas été relues à l'œil sur les captures des runs 78 à 83. Seuls les contrôles automatiques les couvrent.
30. **Clés du projet de production à faire tourner au moment de l'hébergement** (rappel des lots précédents, lot 8).

---

## 16. Addendum du 5 novembre 2026 : runs 85 à 91, avance de `main`

**`main` a été avancé à la demande de l'utilisateur** (« pousse le sur main »), en avance rapide depuis `lot7/terrain` :
- `6fff1bf..2719992` le 05/11 ;
- puis `2719992..fd7a822..43842d8` avec les correctifs de tests ci-dessous.

`main` et `lot7/terrain` pointent sur `43842d8`.

**Migrations du lot 7 appliquées par l'utilisateur** sur le projet Supabase renommé `event-village-dev` (ref inchangée) :
- `db push --dry-run --linked` listait exactement les 7 fichiers `20261105000001` à `…07` ;
- `db push --linked` les a appliqués, et `03-verification.sql` a donné 20 OK sur 20 ;
- le contrôle a donné : 8 migrations du lot 6 et 7 du lot 7, 37 réglages, 3 interrupteurs, 69 types de notifications, `TRANSFER_RECEIVED` = `{IN_APP,PUSH,EMAIL}`.

Rien n'a été exécuté contre ce projet depuis le poste de développement.

### Runs

| Run | Branche | Commit | Résultat | Constat |
|---|---|---|---|---|
| 85 | lot7/terrain | `4395b61` (rapport) | rouge | terrain 7 : course du test lui-même (compteur incrémenté avant la fin de `route.fetch()`, statut lu à 0) |
| 86 | lot7/terrain | `2719992` | rouge | `temps-reel-billets` cas 1 ; `dette-categories-publiques` (numéro de téléphone de test déjà attribué) |
| 87 | main | `2719992` | rouge | `temps-reel-billets` cas 1 |
| 88 | lot7/terrain | `fd7a822` | rouge | `temps-reel-billets` cas 1 et 2 (vivacité non atteinte en 60 s) |
| 89 | main | `fd7a822` | **vert** | 181/181, e2e vert |
| 90 | lot7/terrain | `43842d8` | **vert** | 181/181, e2e vert, job de 1 853 s |
| 91 | main | `43842d8` | **vert** | 181/181, e2e vert, job de 2 166 s |

Journaux : `docs/lot7-logs/ci-run85-run.txt` à `ci-run91-run.txt`, `ci-run88-temps-reel-billets.log`, `ci-run91-verify.log`.

### Correctifs de tests (aucune assertion relâchée ; tests existants modifiés, signalés)

1. **`2719992`, `e2e/terrain.spec.ts` (terrain 7).** Le test attend désormais la réponse du serveur avant d'en lire le statut. Le statut attendu reste 200.

2. **`8b26b86`, `tests/parcours/temps-reel-billets.test.ts` (suite du lot 5).**
   - **Défaut prouvé aux runs 83 et 87 :** la vérification de vivacité acceptait l'INSERT périmé du billet « spare », reçu avant l'ouverture du canal.
   - **Correctif :** elle n'accepte plus que l'UPDATE, ou l'INSERT de notification, qui porte la marque de sa propre action et arrive en moins de 1,5 s.
   - **Diagnostic :** `tests/helpers/realtime.ts` affiche, pour chaque message, l'heure de validation, l'heure de réception et l'état du canal. La CI capture le journal de Realtime, jetons masqués.
   - **Inchangé :** l'assertion UTILISE et son délai de 20 s.

3. **`fd7a822`, numéros de test (`tests/parcours/helpers.ts`, `terrain-helpers.ts`).**
   - **Cause :** `randomSenegalPhone` tirait au hasard, sans mémoire, parmi 9 millions de valeurs. Le paradoxe des anniversaires donnait quelques pour cent de risque de collision par run.
   - **Correctif :** le suffixe dérive de l'horloge en millisecondes, jamais deux fois la même, ce qui rend chaque numéro d'un run unique. `massHolders` écarte en plus les numéros déjà présents en base.
   - **Conséquence :** plus aucun « numéro déjà attribué » à partir du run 88.

4. **`43842d8`, ordre d'exécution (`scripts/run-tests.mjs`).**
   - **Cause établie au run 88 :** les suites `sms-plafond-optionnel` et `sms-veille` créent plus de 2 100 comptes et billets. Juste après elles, le lecteur de changements de Realtime ralentit jusqu'à l'annulation à 15 s (`PoolingReplicationError` à 15:17:26 et 15:18:28). Il recrée alors sa fente et perd les changements validés entre-temps, avec des retards mesurés de 13 à 25 s.
   - **Piste écartée :** la limite d'événements par seconde. Aucune ligne `MessagePerSecondRateLimitReached`.
   - **Correctif :** les suites qui créent des porteurs en masse passent après la dernière suite temps réel. La vivacité revient à son délai par défaut de 30 s.
   - **Extrait brut du run 91 :**

```
[run-tests] suites lourdes (massHolders) après la dernière suite temps réel (tests/parcours/temps-reel-stock.test.ts) : tests/parcours/sms-plafond-optionnel.test.ts, tests/parcours/sms-veille.test.ts
tests/parcours/temps-reel-billets.test.ts              PASS     27.5s     0     .test-logs/tests__parcours__temps-reel-billets.test.ts.log
TOTAL : 181 suite(s) — 181 réussie(s), 0 en échec, 0 expirée(s)
[verify] OK — 5 étapes réussies en 822s.
[e2e] résumé :connexion OK · captures OK · emails OK · fumee OK · terrain OK · pwa OK · perf OK
```

   - **NON PROUVÉ :** la raison, côté Postgres, du ralentissement de `realtime.list_changes` après ces écritures massives. La CI garde désormais le corps des erreurs de réplication et les annulations côté Postgres pour un futur run rouge.

### Points ouverts ajoutés

- **Charge laissée par les écritures massives et lecteur Realtime :** à surveiller en production. Une vente de milliers de billets en quelques secondes pourrait retarder les mises à jour en direct des clients. L'hébergement du lot 8 permettra de le mesurer.
- **`npm run dev` lit `.env.local` :** ce fichier pointe maintenant vers `event-village-dev`, qui est au niveau du lot 7. Ce projet ne doit tourner qu'avec le code de `lot7/terrain` ou plus récent, car le code du lot 6 ne présente pas la version du secret au scan.
