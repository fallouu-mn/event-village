# LOT 5 — RAPPORT

**Objet :** cycle de vie de l'événement et page de pilotage de l'organisateur. Le lot couvre :
- la machine à états, la visibilité publique et le passage automatique à TERMINÉ ;
- l'édition, la validation serveur et l'annulation dans l'interface ;
- le côté admin et la liste des événements du partenaire ;
- la page de pilotage, le temps réel et les captures Playwright ;
- la dette du lot 4.

Constats traités : R27 à R31, events-cdc-1 à -17, partner-ux-2 à -17, points ouverts 1, 4 à 7, 11, 12, 18 et 19 du lot 4.

**Branche :** `fix/evenementiel`. Rien n'a été exécuté contre le projet Supabase distant. Migrations du dépôt uniquement (`20261102000001` à `…06`), appliquées et testées en CI depuis une base vide.

**Date :** 1er novembre 2026.

**Résultat :** **vert.** Run 55 (`41335287062`, commit `c20442b`) :
- `npm run verify` : 125 suites sur 125, 1 232 sous-tests, aucun échec ni test ignoré. Typecheck, lint et build compris.
- `npm run e2e` :
  - 7 connexions par le formulaire ;
  - 120 captures (30 écrans, en 390 × 844 et 1440 × 900, en clair et en sombre), sans aucun contrôle bloquant ;
  - le parcours de fumée complet : créer, soumettre, valider, publier, acheter, scanner, piloter.

Au run 43 (référence « avant »), les 34 nouvelles suites étaient en échec, et elles seules. L'invariant étendu (a) à (l) donne 0 violation à la fin de chacune des 29 suites du lot qui touchent la base.

---

## À lire en premier

1. **Défauts réels trouvés pendant le lot, hors de la consigne, tous corrigés et testés :**
   - **Lectures périmées côté serveur.** Next 14 mettait en cache les requêtes de supabase-js faites pendant une route, appels RPC en POST compris. Une fiche relue après une écriture renvoyait l'état d'avant, et une vérification de session pouvait être servie depuis ce cache. Les tests appelaient les routes hors du serveur Next et ne le voyaient pas : c'est le parcours de fumée qui l'a révélé (runs 50 et 51). Tous les clients Supabase serveur lisent maintenant sans cache (`lib/supabase/no-store-fetch.ts`).
   - **Faille `PATCH /api/admin/services`.** Un ADMIN qui n'avait que `events.write` pouvait changer le statut de n'importe quelle table avec le service_role. Exemple : passer un paiement à SUCCESS, ce qui créditait le grand livre. La route n'accepte plus qu'une liste blanche.
   - **Fuites par REST et temps réel :**
     - partenaires VALIDE (téléphone, email, pièces) lisibles par anon ;
     - catégories d'événements non publics lisibles par anon ;
     - `payments` diffusé en temps réel ;
     - insertion REST de `ticket_transfers` possible.
   - **OTP.** La limite de 5 essais se contournait par requêtes parallèles, y compris pour le code de retrait d'argent.
   - **Faux succès.** Le retrait d'un contrôleur répondait 200 et envoyait le SMS « compte désactivé » sans rien retirer.
   - **XSS sur la carte publique.** La bulle du lieu insérait en HTML le nom saisi par l'organisateur.
   - **Mes billets.** Un billet pour un événement du soir même passait dans l'historique dès minuit UTC.
   - **Lanceur de tests.** Une assertion d'invariant en échec dans un `after()` laissait la suite PASS : un vert ne prouvait pas les invariants de fin de suite (point 6 ci-dessous).
2. **Le statut d'un événement ne change plus que par une transition.**
   - La table `event_status_transitions` reprend mot pour mot la liste de la consigne.
   - Toute transition passe par la RPC `event_transition`, ou par `event_cancel` pour l'annulation. Un trigger refuse tout autre changement de `events.status`, y compris par le service_role.
   - Chaque changement est journalisé dans `event_status_history`, en ajout seul.
   - Un INSERT est toujours forcé en BROUILLON.

   Conséquence pour les tests : les helpers et le seed qui créaient des événements PUBLIE directement passent désormais par les transitions (section 1).
3. **Contrats d'API modifiés ou nouveaux.** Le contrat complet est dans le code des routes ; les principaux :
   - **Transitions et annulation :**
     - `POST /api/partner/events/[id]/transition` et `POST /api/admin/events/[id]/transition` `{ to, reason? }`, qui remplacent `/status` (supprimée) ;
     - `POST …/cancel` exige `{ publicNotice, internalReason, confirmTitle }` ;
     - `GET …/cancellation` renvoie `{ impact | progress }`, au propriétaire et aux admins seulement.
   - **Édition :**
     - `PUT /api/partner/events/[id]` attend `{ patch, expected_updated_at }` et répond `{ notified_holders, sms_queued }` ;
     - les catégories passent par `POST`, `PATCH` et `DELETE /categories/…`.
   - **Admin et partenaire :**
     - `GET /api/admin/events` (filtres, recherche, pagination) et `GET /api/admin/events/[id]` (fiche) ;
     - `GET /api/partner/events/overview` ;
     - `GET /api/partner/events/[id]/pilotage/{overview,sales,entries,team,cash,closing}` ;
     - `POST …/participants-export` (CSV) ;
     - `PATCH /api/partner/team/assignments/[id]`.
   - **Contrôle d'accès :**
     - `POST /api/controller/counter-sale` exige `Idempotency-Key` ; le billet vendu est composté et n'a pas de porteur ;
     - `POST /api/controller/shifts/close` `{ shiftId, declaredCashTotal, justification?, regisseurPin? }` ;
     - `POST /api/controller/scan/incidents`.
   - **Public :** `GET /api/events/[id]` renvoie 404 avant publication et `purchasable`, `banner`, `cancellation` après. `GET /api/events` ne liste que les PUBLIE à venir.
4. **Exploitation** (`docs/deploiement-projet-neuf.md`) :
   - deux nouvelles tâches planifiées : `/api/cron/events-finish` toutes les 15 minutes, et `/api/cron/event-change-notifications` ;
   - le bucket `public-images` est créé par migration ;
   - nouveaux quotas, avec des valeurs par défaut : `WITHDRAWAL_REQUEST_PER_USER_HOUR` (10), `COUNTER_RECEIPT_PER_SHIFT_DAY` (500), `SCAN_INCIDENT_REPORT_PER_SCANNER_MIN` (10), `SCAN_INCIDENT_LOG_PER_SCANNER_MIN` (60) ;
   - nouveau réglage SUPERADMIN `access.low_stock_threshold` (10, de 1 à 1000) ;
   - aucune nouvelle variable obligatoire.
5. **Décisions de l'utilisateur appliquées :**
   - orange brûlé accessible `#C2410C` avec texte blanc sur les boutons (5,18:1) ; l'orange vif `#FF5722` est réservé au décor ;
   - billet de guichet sans compte, jamais rattaché au numéro saisi ;
   - export des participants avec une finalité à choisir dans une liste fermée ;
   - stock public en tranches.

   Changements visibles :
   - boutons de 44 px à toutes les tailles ;
   - libellés courts dans la barre du bas mobile : « Billets », « Achats », « Solde », « Billetterie », « Validation », « Comptes » ;
   - écrans du lot sur un système de design commun (`design-system/event-village/MASTER.md`, généré avec ui-ux-pro-max).
6. **Le lanceur de tests est corrigé, et deux tests anciens sont adaptés en conséquence.** Le lanceur classe désormais FAIL une suite dont un hook échoue (`scripts/run-tests.mjs`, commit `3518d06`). Corriger le lanceur a révélé deux données de test qui violaient des invariants. Ce n'était pas visible avant le lot 5, faute de suite qui vérifie ces invariants après elles :
   - `paiement-remboursement` (lot 2) : paiement sans répartition financière, contraire à (d) ;
   - `finance-retraits` (lot 3) : reversement hors plateforme, contraire à (i).

   Les deux tests sont adaptés et signalés en section 1.
7. **Découpage des commits.** Comme aux lots précédents : tests rouges par tâche, puis correctifs par tâche. Les commits intermédiaires ne compilent pas tous isolément ; seule la tête est vérifiée par la CI. La relecture des captures a ajouté des commits de correction, listés en section 3.

---

## 1. Commits

| Commit | Message |
|---|---|
| 4c4087f | test(infra)[5]: outils des suites du lot 5 (événement par les RPC de transition, invariants du cycle de vie (j)(k)(l), aide temps réel, liste blanche des fichiers migrés au système de design) |
| 6c89ba0 | test(securite)[5.0]: dette du lot 4 et failles urgentes : /api/admin/services limité à une liste blanche, partenaires et catégories non publics illisibles par anon, ticket_transfers sans insertion REST, statut d'événement non modifiable par REST, transferts sans mémoire, clôture de caisse transactionnelle, retrait d'un contrôleur sans faux succès, rôles atomiques, OTP atomique, guichet = vente et compostage, incidents de scan |
| 6cb40e2 | test(e2e)[5.1]: Playwright en CI sur la base locale (faux SamirPay et MTarget locaux, seed de démonstration par les RPC, captures 390×844 et 1440×900 en clair et sombre publiées sur ci-results, contrôles bloquants, fumée créer → soumettre → valider → publier → acheter → scanner → piloter) |
| 7f4379a | test(cycle)[5.2]: machine à états en base (table de transitions, historique en ajout seul, garde du statut, INSERT forcé en BROUILLON, motifs obligatoires, ANNULE et TERMINE terminaux, statut inconnu → 400) |
| fdfc7f7 | test(cycle)[5.3]: visibilité publique par statut (404 avant publication, bandeaux SUSPENDU/ANNULE/TERMINE sans achat, catalogue des seuls PUBLIE à venir, prix à partir des catégories actives et visibles) |
| bad2833 | test(cycle)[5.4]: passage automatique à TERMINE par le cron protégé (fin ou début à 23:59 Dakar), journalisé, scan encore ouvert dans la fenêtre |
| 8218de1 | test(edition)[5.5]: formulaire partagé, édition après publication (champs libres, notifiés, verrouillés), notification des acheteurs, catégories par routes dédiées (quota ≥ vendus + réservés, prix verrouillé après vente) |
| b0e13bd | test(edition)[5.6]: schéma Zod partagé client et serveur (dates Dakar, entiers, programme typé, origine de l'affiche, longueurs, clés inconnues refusées) |
| 4ff5666 | test(admin)[5.7]: côté admin (liste filtrée et paginée, fiche complète, actions par statut, motifs persistés et montrés au partenaire) |
| 80536a3 | test(cycle)[5.8]: annulation transactionnelle (titre retapé, impact, avancement des remboursements, SUSPENDU → ANNULE avec remboursements, résumé réservé au propriétaire) |
| 7472d19 | test(edition)[5.9]: services associés masqués (billetterie seule, promotion indisponible) |
| 04cf921 | test(pilotage)[5.10]: page de pilotage sur une source unique (aperçu, ventes, entrées en direct, équipe, caisse, clôture, export journalisé sans données de paiement), jeu de données connu, partenaire B sans accès |
| 7b96a1f | test(partenaire)[5.11]: liste des événements du partenaire (indicateurs sur tous les événements, onglet Annulé, actions par statut, StatusBadge, états de chargement, vide et erreur) |
| 1000c05 | test(cycle)[5.12]: invariants (j)(k)(l) et garde-fous (chaque règle détecte une violation fabriquée) |
| 1c7cbe6 | test(temps-reel)[5.13]: temps réel (catalogue et stock public en tranches, billets du porteur, données privées invisibles pour B, anon et clients, payments retiré, hook partagé) |
| 214a820 | test(design)[5]: système de design (tokens, orange accessible, composants partagés, règles des fichiers migrés : couleurs, tailles, textes, accessibilité) |
| 10a8d54 | fix(securite)[5.0]: /api/admin/services limité à une liste blanche (réservations et commandes en attente, plus d'écriture d'un paiement, d'un compte ni d'un événement) ; partenaires lisibles par anon et clients seulement par la vue public_partners ; catégories publiques actives et visibles d'un événement public, sans colonnes de vente ; payments retiré du temps réel ; plus d'écriture REST de ticket_transfers |
| 3fde6b7 | fix(dette)[5.0]: transferts par RPC sans repli mémoire, clôture de caisse transactionnelle (écart justifié et PIN co-signé sous verrou, une seule clôture), retrait d'un contrôleur sans faux succès, rôles atomiques (user_roles_set), OTP atomique et quota des retraits, guichet = vente et compostage (méthode COUNTER, billet sans compte, Idempotency-Key, reçu SMS), incidents de scan (scan_incidents), crons protégés par CRON_SECRET seul |
| a729d9a | fix(cycle)[5.2]: machine à états en base (table de transitions, historique en ajout seul, trigger de garde du statut, INSERT forcé en BROUILLON, event_transition et event_actions, motifs obligatoires) ; routes /transition partenaire et admin, /status supprimée ; helpers de tests et seed passés par les transitions |
| b0ab888 | fix(cycle)[5.3]: visibilité publique (404 avant publication, bandeau et achat fermé pour SUSPENDU, ANNULE et TERMINE, catalogue des PUBLIE à venir, prix à partir des catégories actives et visibles, stock en tranches, plus de lecture des paiements) |
| ba39a4d | fix(cycle)[5.4]: cron /api/cron/events-finish (PUBLIE terminé → TERMINE par la transition système, journalisé), event_end_at unique, scan et caisse ouverts en TERMINE dans la fenêtre ; documentation du cron |
| 832c649 | fix(cycle)[5.8]: annulation transactionnelle event_cancel (titre retapé, remboursements, transferts annulés, une seule annulation, motif interne jamais public), impact et avancement réservés au propriétaire et aux admins ; paiement confirmé sur un événement suspendu ou terminé remboursé |
| 9e75ad2 | fix(dette)[5.0]: migration 02 : délimiteurs $$ de ticket_scan rétablis (un remplacement de texte les avait réduits à $, la migration ne s'appliquait pas, run 44) |
| 35f6d89 | fix(cycle)[5.2]: les fonctions de trigger du cycle de vie restent exécutables par le service_role (contrôle 1A.3 de 03-verification.sql, régression de hotfix-scripts au run 45) ; anon et authenticated n'y ont toujours aucun droit |
| 6a44397 | fix(edition)[5.5]: création et édition par RPC transactionnelles (event_create, event_update : champs libres, notifiés, verrouillés après ventes, interdits ; EN_ATTENTE à retirer ; conflit d'édition ; fonds recalculés si la fin recule), catégories par routes dédiées (prix verrouillé après vente, quota ≥ vendus + réservés, suppression sans vente), file des notifications de changement et son cron ; affiches téléversées sous le dossier du partenaire, format vérifié ; seed et tests alignés |
| fa4d9f3 | fix(edition)[5.6]: schéma Zod partagé client et serveur (lib/validations/event.ts : dates Dakar, entiers, programme typé, origine de l'affiche, longueurs bornées, clés inconnues refusées, messages français) |
| 1770696 | fix(edition)[5.9]: services associés indisponibles (promotion partenaire 403 SERVICE_UNAVAILABLE, lecture réservée au propriétaire et aux admins) |
| e020e47 | fix(admin)[5.7]: liste admin des événements (filtres, recherche littérale, pagination, compteurs) et fiche complète (affiche, dates, lieu, programme, catégories, organisateur, historique, actions) |
| 213fcbd | fix(pilotage)[5.10]: pilotage sur une source unique en base (pilotage_compute_* et RPC pilotage_* : aperçu, ventes, entrées, équipe, caisse, clôture), export des participants journalisé sans données de paiement, permission espèces par affectation, vue d'ensemble du partenaire calculée sur tous ses événements ; cash_sales ne compte plus que les billets réellement encaissés |
| e66c293 | fix(temps-reel)[5.13]: résumés publics (public_event_state, stock en tranches public_category_stock, seuil réglable), admin_signals, publication complétée avec RLS, colonnes secrètes des billets non diffusées ; hook partagé useRealtimeRefresh ; page événement, cloche, scanner et équipe sans abonnement mort ; compteur des notifications PUSH non lues |
| 9e4797a | fix(pilotage)[5.10]: chaque route du pilotage appelle requireActiveSession elle-même (contrôle statique existant de statut-compte, cas 10, run 46) ; la fabrique devient pilotageTabResponse |
| d2a21c8 | feat(design)[5]: système de design (tokens sémantiques clair et sombre, orange brûlé accessible #C2410C et orange vif réservé au décor, text-caption, rampe brand orange), composants partagés accessibles (Modal, ConfirmDialog, ReasonDialog, StatusBadge, KpiCard, Tabs, Pagination, PageHeader, IconButton, LinkButton, champs, DataList, StatusBanner, LiveIndicator), Button à 44 px, libellés de statut et formats Dakar partagés, MASTER.md généré avec ui-ux-pro-max |
| 3518d06 | test(infra)[5]: le lanceur classe FAIL une suite dont un hook after() échoue (ligne « not ok » de premier niveau avec un code de sortie 0 : les invariants violés en fin de suite passaient inaperçus) ; paiement-remboursement : le paiement inséré directement porte sa répartition sans frais (invariant (d) du lot 3) ; temps-reel-stock : la ligne de stock créée à la publication, livrée après l'abonnement, n'est plus comptée comme diffusion de la vente |
| 3e493f5 | test(finance)[5]: finance-retraits remet à 0 le reversement du paiement « ancien guichet » qu'il fabrique, une fois la preuve faite (il violait l'invariant (i) du lot 4, révélé au run 47 par le lanceur corrigé) |
| b1fc7fe | feat(edition)[5.5]: formulaire d'événement unique pour la création et l'édition (EventForm : schéma partagé, catégorie, carte, programme typé, erreurs du serveur près du champ, envoi des seuls champs modifiés, porteurs prévenus affichés ; billetterie par les routes dédiées avec verrous visibles ; plus d'étape Services), affiche et carte accessibles (Leaflet servi localement), libellés de la connexion liés aux champs |
| dbf670a | feat(cycle)[5.3]: page publique selon le statut (bandeau, achat seulement si ouvert, stock en tranches, avis et remboursement d'un événement annulé, 404 propre), catalogue et accueil en direct sans images externes, Mes billets en direct ; images limitées au stockage du projet |
| 89930e9 | feat(admin)[5.7]: file de validation /admin/events (onglets par statut, recherche, pagination, en direct) et fiche complète (actions par statut, motif obligatoire pour refuser et suspendre, annulation et remboursements) ; tableau de bord admin sur le système de design ; services sans écriture de statut ; navigation avec « Événements » |
| 33985e1 | feat(pilotage)[5.10]: page de pilotage /partner/events/[id] (Aperçu, Ventes, Entrées en direct, Équipe avec permission espèces, Caisse avec PIN, Clôture avec Z de caisse, absents et export à finalité fermée), anciennes pages équipe et caisse redirigées vers les onglets |
| 455f025 | feat(partenaire)[5.11]: liste des événements du partenaire (indicateurs sur tous les événements, onglets par statut dont Annulé, actions par statut issues d'event_actions, motif affiché, en direct) ; la liste API renvoie les actions de chaque événement |
| 5ac827c | feat(cycle)[5.8]: annulation dans l'interface (modale avec impact, avis public, motif interne et titre retapé ; avancement des remboursements, à reprendre pour l'admin) |
| 7170afe | test(e2e)[5.1]: les sélecteurs des modales acceptent le rôle alertdialog (confirmation d'une action irréversible) ; liste des fichiers migrés au système de design complétée par les écrans du lot |
| d46dc10 | fix(edition)[5.5]: MapPicker sert les icônes Leaflet depuis public/leaflet (l'import d'images comme modules dépendait de next-env.d.ts, absent du dépôt : typecheck en échec au run 48) |
| ccb7c2a | test(e2e)[5.1]: e2e sur un seul hôte (localhost:3000 : Next réécrit 127.x en localhost dans les redirections du middleware, les rôles protégés perdaient leur session au run 49) ; affiches du seed de test réellement téléversées (PNG déterministe) ; diagnostic des échecs Playwright publié sur ci-results |
| adc1d9c | fix(design)[5.1]: corrections après relecture des captures du run 49 : espacement des mots (Plus Jakarta Sans a une espace de 0,17 em, écrasée par le resserrement des titres : word-spacing compensé), logo de l'en-tête mobile (identifiant de dégradé unique par instance), barre du bas sans troncature (libellés courts), cartes d'événement sans pastille posée sur l'affiche |
| d1e1c23 | fix(temps-reel)[5.13]: plus aucun code technique affiché côté client (libellés partagés des statuts de billet et des types de notification), carte billet et page des notifications sur le système de design et en direct, Mes billets sans défilement horizontal à 390 px |
| b20547f | test(e2e)[5.1]: diagnostic de l'étape de validation de la fumée (réponses de la fiche admin et de la transition, erreurs de console) : fiche restée en attente après une validation réussie au run 50 |
| 7326764 | fix(admin)[5.7]: les clients Supabase côté serveur lisent sans cache (fetch no-store) : Next 14 mettait en cache les requêtes de supabase-js pendant les routes, POST compris, et la fiche admin relue après une validation renvoyait encore EN_ATTENTE (fumée, runs 50 et 51) ; les vérifications de session ne passent plus par ce cache non plus |
| be41aa5 | fix(design)[5.1]: corrections transverses après relecture des captures du run 50 : séparateur de milliers visible (espace insécable au lieu de l'espace fine, dessinée à 1,4 px par la police), boutons de l'en-tête à 44 px, noms accessibles contenant le texte visible, contrastes de la pastille et de l'en-tête contrôleur, toast accessible en casse de phrase, cartes Leaflet (zoom à 44 px, icônes locales, bulle sans HTML injecté depuis le nom du lieu) ; index des captures avec le détail des nœuds axe |
| 1649123 | fix(pilotage)[5.10]: corrections des écrans après relecture des captures du run 50 : montants par le format partagé, indicateurs sur 2 colonnes en mobile, onglets défilants avec indice, affiche entière et listes de définitions valides dans la fiche admin, scanner du contrôleur sur le système de design (libellés humains, caisse, résultat, saisie manuelle) |
| 3a7a654 | test(e2e)[5.1]: fumée, choix de l'opérateur : radio masqué dans son libellé coché par check({ force: true }) (le libellé intercepte le clic, comme pour un utilisateur), run 52 |
| a00f73b | fix(design)[5.1]: bulle de la carte avec un bouton « Fermer la bulle » de 44 px et un texte à 14 px sur les tokens, liens de titre de la liste admin à 44 px (avertissements des captures du run 52) |
| 0a56f2c | test(e2e)[5.1]: la mesure des cibles tactiles porte sur la zone réellement cliquable (lien étiré sur sa carte, champ enveloppé par son libellé) et non plus sur le seul texte ou la case native |
| 0d6bab5 | fix(temps-reel)[5.13]: Mes billets classe un billet « à venir » tant que l'événement n'est pas fini (event_end_at : fin, ou début à 23:59 Dakar) ; un billet pour le soir même partait dans l'historique dès minuit UTC (fumée, run 53) |
| c20442b | test(e2e)[5.1]: fumée, scan : « Entrée validée » apparaît dans le panneau de résultat et dans l'historique des scans, la vérification porte sur le premier (run 54, le scan est accepté) |

Ce rapport est ajouté par le commit qui suit le dernier de cette liste.

**Écriture des tests.** Le contrat commun est écrit après une découverte par six sous-agents. Les tests rouges sont écrits par six écrivains, chacun dans son domaine, sur des fichiers nouveaux. Ils sont typecheckés sans les correctifs, puis committés avant tout correctif. Toute l'interface est passée par le skill ui-ux-pro-max.

### Tests existants modifiés (signalement)

**Machine à états (5.2).** Ces adaptations sont prévues par le contrat (section S) :
- `tests/parcours/paiement-helpers.ts`, `acces-helpers.ts` et `finance-helpers.ts` : `createSaleEvent`, `createTimedEvent` et `createPartnerEvent` créent un brouillon avec une affiche, puis l'avancent par les RPC de transition. Les dates passées sont posées après la publication.
- `achat-serveur`, `email-optionnel`, `statut-compte` : leurs inserts PUBLIE directs passent par `advanceEventTo`.
- `tests/helpers/fixture-data.ts` et `tests/seed/seed-test.ts` :
  - A_PASSE est TERMINE (créé à venir, publié, redaté, puis terminé par l'admin) ;
  - B_ANNULATION est annulé par la vraie `event_cancel` ;
  - les affiches du seed sont réellement téléversées (`tests/helpers/fixture-poster.ts`).

**Autres suites existantes :**

| Suite | Changement | Raison |
|---|---|---|
| `acces-fenetre` | le TERMINE refusé au scan est un événement fini depuis 7 h ; l'annulation passe par `event_cancel` et le billet attendu est ANNULE | contrat D7 : le scan reste ouvert en TERMINE dans la fenêtre |
| `finance-annulation` | titre retapé et avis public | contrat D6 |
| `paiement-remboursement` | même raison pour l'annulation ; le paiement inséré directement porte sa répartition sans frais | invariant (d), voir « À lire en premier », point 6 |
| `finance-retraits` | le paiement « ancien guichet » fabriqué repasse à un reversement 0 une fois la preuve faite | invariant (i), même raison |
| `acces-guichet` | `Idempotency-Key` ; billets UTILISE et sans porteur | contrat C7 |
| `r3-fonctions-rpc` | nouvelles RPC ajoutées | plus strict |
| `r9-partenaire-ecritures` | la lecture REST de `sold_quantity`/`held_quantity` par le partenaire est retirée ; l'assertion « écriture refusée » est intacte | arbitrage A3/O : colonnes de vente non lisibles par les rôles API |
| `ux-performance-and-double-click` | catégorie, ville et date relative | schéma Zod partagé (5.6) |
| `temps-reel-stock` (suite du lot, modifiée après son commit rouge) | la ligne de stock créée à la publication, livrée par Realtime après l'abonnement, n'est plus comptée comme une diffusion de la vente ; toute autre écriture reste comptée | course du test |
| `acces-reglages` | aucune modification ; seul son en-tête parle encore de « 4 clés access.* » | — |

**Outillage e2e.** Ces modifications du test de fumée et des contrôles ont été faites pendant la mise au point en CI :
- un seul hôte (`localhost`) ;
- les modales acceptent le rôle `alertdialog` ;
- le radio de l'opérateur est coché par son libellé ;
- le sélecteur « Entrée validée » vise le premier élément ;
- les cibles tactiles sont mesurées sur la zone réellement cliquable ;
- une trace des réponses de la fiche admin est conservée.

---

## 2. Par tâche : grep, test rouge, correctif, test vert

Avant correctif : run CI 43 (`41270894272`, commit `214a820`), tests dans leur version finale, aucun correctif. Après : run 55 (`41335287062`, commit `c20442b`). Greps exécutés sur l'arbre du commit `214a820`. Journaux bruts sur la branche `ci-results`.

**Lecture des blocs « avant ».**
- La plupart des nouvelles suites échouent d'abord dans leur `before()`, sur l'absence d'une RPC ou d'une table du contrat (`event_transition`, `sale_channel`, `scan_incidents`…). C'est un rouge réel mais structurel.
- Les défauts de fond sont visibles dans les cas qui n'en dépendent pas, et dans les messages d'erreur.
- Les blocs des suites adaptées (section 1) montrent leur ancienne version : ce ne sont pas des tests rouges.

### 5.0 — Failles urgentes et dette du lot 4

```text
$ git grep -n -E 'from\(table\)|\.from\(body\.table|table:' 214a820 -- app/api/admin/services/route.ts
214a820:app/api/admin/services/route.ts:89:        let body: { table: 'events' | 'halls' | 'products'; id: string; status: string; isActive?: boolean; reason?: string };
214a820:app/api/admin/services/route.ts:118:            const { data, error } = await (supabase.from(table) as any)
(code de sortie 0)

$ git grep -n -E 'partners_read_public|ticket_categories_read_public' 214a820 -- supabase/migrations
214a820:supabase/migrations/0003_rls.sql:109:CREATE POLICY "partners_read_public" ON partners
214a820:supabase/migrations/0003_rls.sql:141:CREATE POLICY "ticket_categories_read_public" ON ticket_categories
214a820:supabase/migrations/20261031000005_lot1b4_partenaire_ecritures.sql:10:-- ticket_categories_read_public (branche is_partner_owner).
(code de sortie 0)

$ git grep -n -E 'inMemoryTransfers|activeTransfersLock' 214a820 -- lib/tickets/ticket-transfer.service.ts
214a820:lib/tickets/ticket-transfer.service.ts:92:    private static activeTransfersLock = new Set<string>();
214a820:lib/tickets/ticket-transfer.service.ts:93:    private static inMemoryTransfers = new Map<string, any>();
214a820:lib/tickets/ticket-transfer.service.ts:199:        for (const tr of Array.from(this.inMemoryTransfers.values())) {
214a820:lib/tickets/ticket-transfer.service.ts:206:        if (this.activeTransfersLock.has(ticketId)) {
214a820:lib/tickets/ticket-transfer.service.ts:244:                    this.activeTransfersLock.add(ticketId);
214a820:lib/tickets/ticket-transfer.service.ts:251:            if (!this.activeTransfersLock.has(ticketId)) {
214a820:lib/tickets/ticket-transfer.service.ts:252:                this.activeTransfersLock.add(ticketId);
214a820:lib/tickets/ticket-transfer.service.ts:296:                    this.inMemoryTransfers.set(transferId, newTransferData);
214a820:lib/tickets/ticket-transfer.service.ts:299:                    this.activeTransfersLock.delete(ticketId);
214a820:lib/tickets/ticket-transfer.service.ts:314:                this.inMemoryTransfers.set(transferId, newTransferData);
214a820:lib/tickets/ticket-transfer.service.ts:318:            this.inMemoryTransfers.set(transferId, newTransferData);
214a820:lib/tickets/ticket-transfer.service.ts:393:            for (const tr of Array.from(this.inMemoryTransfers.values())) {
214a820:lib/tickets/ticket-transfer.service.ts:592:        this.activeTransfersLock.delete(transfer.ticket_id);
214a820:lib/tickets/ticket-transfer.service.ts:593:        this.inMemoryTransfers.delete(transfer.id);
214a820:lib/tickets/ticket-transfer.service.ts:666:            transfer = this.inMemoryTransfers.get(transferId);
214a820:lib/tickets/ticket-transfer.service.ts:723:            const memTr = this.inMemoryTransfers.get(transferId);
214a820:lib/tickets/ticket-transfer.service.ts:738:        this.inMemoryTransfers.set(transferId, {
214a820:lib/tickets/ticket-transfer.service.ts:757:        this.activeTransfersLock.delete(transfer.ticket_id);
214a820:lib/tickets/ticket-transfer.service.ts:822:                        this.activeTransfersLock.delete(tr.ticket_id);
214a820:lib/tickets/ticket-transfer.service.ts:831:        for (const [id, tr] of Array.from(this.inMemoryTransfers.entries())) {
214a820:lib/tickets/ticket-transfer.service.ts:835:                this.activeTransfersLock.delete(tr.ticket_id);
214a820:lib/tickets/ticket-transfer.service.ts:859:        return this.inMemoryTransfers.get(transferId) || null;
214a820:lib/tickets/ticket-transfer.service.ts:873:        const matches = Array.from(this.inMemoryTransfers.values()).filter(t => t.ticket_id === ticketId);
214a820:lib/tickets/ticket-transfer.service.ts:890:        return this.activeTransfersLock.has(ticketId);
(code de sortie 0)

$ git grep -n -E attempts 214a820 -- lib/auth/otp-store.ts
214a820:lib/auth/otp-store.ts:50:        .insert({ phone, purpose, code_hash: hashOtpCode(phone, code), expires_at: expiresAt.toISOString(), verified: false, attempts: 0 })
214a820:lib/auth/otp-store.ts:69:        .select('id, code_hash, expires_at, attempts')
214a820:lib/auth/otp-store.ts:79:    const attempts = Number(record.attempts ?? 0);
214a820:lib/auth/otp-store.ts:80:    if (attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: 'TOO_MANY_ATTEMPTS' };
214a820:lib/auth/otp-store.ts:82:        const { error: incErr } = await supabase.from('otp_codes').update({ attempts: attempts + 1 }).eq('id', record.id);
214a820:lib/auth/otp-store.ts:84:        return { ok: false, reason: attempts + 1 >= OTP_MAX_ATTEMPTS ? 'TOO_MANY_ATTEMPTS' : 'INVALID' };
(code de sortie 0)

$ git grep -n -E '\.insert\(added|\.delete\(\)' 214a820 -- lib/auth/roles.ts
214a820:lib/auth/roles.ts:79:        .delete()
214a820:lib/auth/roles.ts:114:        const { error } = await supabase.from('user_roles').insert(added.map(role => ({ user_id: userId, role })));
214a820:lib/auth/roles.ts:118:        const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).in('role', removed);
(code de sortie 0)

$ git grep -n -E 'buyerUserId|seller_id' 214a820 -- app/api/controller/counter-sale/route.ts
214a820:app/api/controller/counter-sale/route.ts:46:        let buyerUserId: string | null = null;
214a820:app/api/controller/counter-sale/route.ts:51:            buyerUserId = (buyer?.id as string | undefined) ?? null;
214a820:app/api/controller/counter-sale/route.ts:55:                seller_id: session.user.id,
214a820:app/api/controller/counter-sale/route.ts:58:                buyer_user_id: buyerUserId,
(code de sortie 0)
```

**Correctif** (migrations `…01` et `…02`).

*Failles :*
- `/api/admin/services` : liste blanche de tables et de transitions.
- Vue `public_partners`, colonnes publiques seulement.
- RLS des catégories publiques : actives, visibles, événement public, sans colonnes de vente.
- `payments` retiré du temps réel.
- Plus d'écriture REST de `ticket_transfers`.

*Dette du lot 4 :*
- **Transferts.** RPC `ticket_transfer_initiate`, `ticket_transfer_cancel` et `ticket_transfers_expire` ; plus de mémoire, toute erreur remonte.
- **Clôture.** RPC `shift_close` : verrou, écart, justification de 10 caractères au moins, PIN co-signé sous verrou, une seule clôture, alerte au partenaire.
- **Retrait d'un contrôleur.** `PARTNER_SCOPE_REQUIRED`, `CONTROLLER_NOT_IN_TEAM`, plus de faux succès ; `DELETE team/[eventId]` vérifie l'événement.
- **Rôles.** RPC `user_roles_set` atomique.
- **OTP.** RPC `otp_check` atomique ; quota sur les demandes de retrait.
- **Guichet.** Vente et compostage dans la même transaction (méthode COUNTER, billet sans porteur, `Idempotency-Key`, reçu SMS).
- **Incidents.** Table `scan_incidents`, écrite par le serveur (429, 5xx) et par l'appareil (réseau, délai).
- **Crons.** Ils n'acceptent plus que `CRON_SECRET`.

**parcours/dette-admin-services**

Run 43 (avant correctif) :

```text
    not ok 1 - ADMIN events.write qui passe un paiement à SUCCESS → 400 INVALID_SERVICE_TABLE ; paiement, billets et grand livre inchangés
        → paiement passé à SUCCESS par la route de modération (HTTP 200 {"success":true,"updated":{"id":"a0368d3e-e935-4774-adfb-f9bbe9fd1496","transaction_id":"TX-EV-1793505388398-B6304BA0","external_order_id":"ORD-EV-1793505388398-B6304BA0","external_transaction_id":"d0375fe6-e33c-4d07-b07f-9ea6aed6a891","c
        → + 'SUCCESS'
        → - 'PENDING'
    not ok 2 - table users (statut d’un compte) → 400 INVALID_SERVICE_TABLE ; compte inchangé
        → compte suspendu par la route de modération (HTTP 200 {"success":true,"updated":{"id":"738f72f1-2e44-4f3f-accf-97a52abdb4b5","first_name":"Awa","last_name":"Acheteusesvcvictime","phone":"+221774628108","email":"parcours-pay-svc-victime-b05fe94a38@test.eventvillage.local","role":"CLIENT","status":"SUS
        → + 'SUSPENDU'
        → - 'ACTIF'
    not ok 3 - table events : retirée de la route → 400 INVALID_SERVICE_TABLE ; statut inchangé (transitions par la section D)
        → statut de l’événement changé par la route générique (HTTP 200 {"success":true,"updated":{"id":"45200ea8-2987-4125-bdf2-2cbde262d07e","partner_id":"c0eb08b1-420f-4c73-8a5d-93bbf1422de6","title":"TEST Accès dette-services-evt 1793505388581","slug":null,"description":"Événement dédié aux tests du contr
        → + 'SUSPENDU'
        → - 'PUBLIE'
    not ok 4 - table inconnue → 400 INVALID_SERVICE_TABLE (jamais un 500 avec l’erreur brute)
        → table inconnue : 400 attendu, reçu HTTP 500 {"error":"Erreur interne du serveur"}
        → 500 !== 400
    ok 5 - garde-fou : annulation d’une réservation de salle (table de la liste blanche) → 200, statut ANNULEE
not ok 1 - A1 — PATCH /api/admin/services : liste blanche des tables
not ok 2 - /home/runner/work/event-village/event-village/tests/parcours/dette-admin-services.test.ts
        → events_finish_overdue : Could not find the function public.events_finish_overdue(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.events_finish_overdue with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
# pass 1
# fail 4
```

Run 55 (après correctif) :

```text
    ok 1 - ADMIN events.write qui passe un paiement à SUCCESS → 400 INVALID_SERVICE_TABLE ; paiement, billets et grand livre inchangés
    ok 2 - table users (statut d’un compte) → 400 INVALID_SERVICE_TABLE ; compte inchangé
    ok 3 - table events : retirée de la route → 400 INVALID_SERVICE_TABLE ; statut inchangé (transitions par la section D)
    ok 4 - table inconnue → 400 INVALID_SERVICE_TABLE (jamais un 500 avec l’erreur brute)
    ok 5 - garde-fou : annulation d’une réservation de salle (table de la liste blanche) → 200, statut ANNULEE
ok 1 - A1 — PATCH /api/admin/services : liste blanche des tables
# pass 5
# fail 0
```

**security/r17-statut-evenement-rest**

Run 43 (avant correctif) :

```text
    not ok 1 - ADMIN : UPDATE events.status BROUILLON → VALIDE par REST → refusé (garde EV422), statut inchangé
        → statut changé par REST : VALIDE (réponse [{"id":"5d62fb1e-f659-4281-89a0-085809cfcd21","status":"VALIDE"}])
        → + 'VALIDE'
        → - 'BROUILLON'
    not ok 2 - ADMIN : UPSERT de la ligne complète avec status EN_ATTENTE par REST → statut inchangé
        → statut changé par UPSERT REST : EN_ATTENTE (réponse [{"id":"5d62fb1e-f659-4281-89a0-085809cfcd21","status":"EN_ATTENTE"}], erreur aucune)
        → + 'EN_ATTENTE'
        → - 'BROUILLON'
not ok 1 - R17 — events.status non modifiable par REST, même par un ADMIN
# pass 0
# fail 2
```

Run 55 (après correctif) :

```text
    ok 1 - ADMIN : UPDATE events.status BROUILLON → VALIDE par REST → refusé (garde EV422), statut inchangé
    ok 2 - ADMIN : UPSERT de la ligne complète avec status EN_ATTENTE par REST → statut inchangé
ok 1 - R17 — events.status non modifiable par REST, même par un ADMIN
# pass 2
# fail 0
```

**security/r18-partenaires-public**

Run 43 (avant correctif) :

```text
    not ok 1 - anon : ni téléphone, ni email, ni pièces, ni données administratives d’un partenaire VALIDE
        → anon : 111 partenaire(s) VALIDE exposent leurs données administratives (phone, email, id_card_url, business_doc_url, rejection_reason, suspended_reason, user_id)
        → +   'd8c1d244-2f37-465a-b7b0-8671cd7d9e53',
        → +   '7ee5b18a-4688-46ef-9a59-d3afecd9163e',
        → +   'fca96364-b982-4552-b2ac-0803c2ff6137',
    not ok 2 - compte CLIENT du seed : rien non plus
        → CLIENT : 111 partenaire(s) VALIDE exposent leurs données administratives (phone, email, id_card_url, business_doc_url, rejection_reason, suspended_reason, user_id)
        → +   'd8c1d244-2f37-465a-b7b0-8671cd7d9e53',
        → +   '7ee5b18a-4688-46ef-9a59-d3afecd9163e',
        → +   'fca96364-b982-4552-b2ac-0803c2ff6137',
    not ok 3 - compte fraîchement inscrit : rien non plus
        → compte inscrit : 111 partenaire(s) VALIDE exposent leurs données administratives (phone, email, id_card_url, business_doc_url, rejection_reason, suspended_reason, user_id)
        → +   'd8c1d244-2f37-465a-b7b0-8671cd7d9e53',
        → +   '7ee5b18a-4688-46ef-9a59-d3afecd9163e',
        → +   'fca96364-b982-4552-b2ac-0803c2ff6137',
    not ok 4 - partenaire B : rien des autres partenaires (sa propre fiche exclue)
        → partenaire B : 110 partenaire(s) VALIDE exposent leurs données administratives (phone, email, id_card_url, business_doc_url, rejection_reason, suspended_reason, user_id)
        → +   'd8c1d244-2f37-465a-b7b0-8671cd7d9e53',
        → +   'fca96364-b982-4552-b2ac-0803c2ff6137',
        → +   'ee86843c-7b28-47f0-998c-07901d9aa639',
    ok 5 - garde-fou : la fiche publique du partenaire A (nom, ville) reste lisible par anon, sans colonne administrative
not ok 1 - R18 — données administratives des partenaires non lisibles publiquement
# pass 1
# fail 4
```

Run 55 (après correctif) :

```text
    ok 1 - anon : ni téléphone, ni email, ni pièces, ni données administratives d’un partenaire VALIDE
    ok 2 - compte CLIENT du seed : rien non plus
    ok 3 - compte fraîchement inscrit : rien non plus
    ok 4 - partenaire B : rien des autres partenaires (sa propre fiche exclue)
    ok 5 - garde-fou : la fiche publique du partenaire A (nom, ville) reste lisible par anon, sans colonne administrative
ok 1 - R18 — données administratives des partenaires non lisibles publiquement
# pass 5
# fail 0
```

**security/r19-categories-transferts**

Run 43 (avant correctif) :

```text
    not ok 1 - anon ne lit pas les catégories du brouillon A_BROUILLON
        → anon : 1 catégorie(s) d’un événement non public lisible(s)
        → +     event_id: '5d62fb1e-f659-4281-89a0-085809cfcd21',
        → +     id: '503caf52-1136-4f7c-b67b-ee64844f4923'
        → - []
    not ok 2 - compte CLIENT : ne lit pas les catégories du brouillon
        → CLIENT : 1 catégorie(s) d’un événement non public lisible(s)
        → +     event_id: '5d62fb1e-f659-4281-89a0-085809cfcd21',
        → +     id: '503caf52-1136-4f7c-b67b-ee64844f4923'
        → - []
    not ok 3 - partenaire B : ne lit pas les catégories non publiques de A
        → partenaire B : 1 catégorie(s) d’un événement non public lisible(s)
        → +     event_id: '5d62fb1e-f659-4281-89a0-085809cfcd21',
        → +     id: '503caf52-1136-4f7c-b67b-ee64844f4923'
        → - []
    ok 4 - garde-fou : anon lit toujours les catégories actives et visibles de l’événement publié A_PUBLIE
not ok 1 - R19 / A3 — catégories d’un événement non public
    ok 1 - garde-fou : anon n’insère pas de transfert
    not ok 2 - compte CLIENT_BIS : n’insère pas de transfert PENDING sur le billet d’un autre (déni de service du porteur)
        → CLIENT_BIS INSERT ticket_transfers (billet d’autrui) : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
    not ok 3 - compte CLIENT : n’insère pas de transfert sur son propre billet hors de la route (RPC seule)
        → CLIENT INSERT ticket_transfers (son billet) : l'opération a été ACCEPTÉE alors qu'elle doit être refusée
not ok 2 - R19 / A5 — aucune insertion REST dans ticket_transfers
# pass 2
# fail 5
```

Run 55 (après correctif) :

```text
    ok 1 - anon ne lit pas les catégories du brouillon A_BROUILLON
    ok 2 - compte CLIENT : ne lit pas les catégories du brouillon
    ok 3 - partenaire B : ne lit pas les catégories non publiques de A
    ok 4 - garde-fou : anon lit toujours les catégories actives et visibles de l’événement publié A_PUBLIE
ok 1 - R19 / A3 — catégories d’un événement non public
    ok 1 - garde-fou : anon n’insère pas de transfert
    ok 2 - compte CLIENT_BIS : n’insère pas de transfert PENDING sur le billet d’un autre (déni de service du porteur)
    ok 3 - compte CLIENT : n’insère pas de transfert sur son propre billet hors de la route (RPC seule)
ok 2 - R19 / A5 — aucune insertion REST dans ticket_transfers
# pass 7
# fail 0
```

**parcours/dette-categories-publiques**

Run 43 (avant correctif) :

```text
    not ok 1 - événement PUBLIE : anon, client et partenaire B ne lisent que la catégorie active et visible
        → anon : seule la catégorie active et visible est lisible (masquée et inactive exclues)
        → +   '8fe7e2c0-6c04-432b-8004-afa29c75d51e',
        → 'c6aecd22-3d73-4ec2-b9c6-5725b35f617f'
    not ok 2 - événements non publics (BROUILLON, VALIDE) : anon, client et partenaire B ne lisent aucune catégorie
        → anon : catégories d’événements non publics lisibles : ["55dad959-df4c-4d82-b59a-65988b82f6d8","593a1ce1-f635-4a4f-89ac-f31e14c07a76"]
    ok 3 - garde-fou : le partenaire propriétaire et un admin lisent toutes les catégories (masquées, inactives, non publiques)
    ok 4 - garde-fou : statut public SUSPENDU → anon lit encore la catégorie active et visible (pas l’inactive)
not ok 1 - A3 — lecture publique de ticket_categories
not ok 2 - /home/runner/work/event-village/event-village/tests/parcours/dette-categories-publiques.test.ts
        → events_finish_overdue : Could not find the function public.events_finish_overdue(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.events_finish_overdue with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
# pass 2
# fail 2
```

Run 55 (après correctif) :

```text
    ok 1 - événement PUBLIE : anon, client et partenaire B ne lisent que la catégorie active et visible
    ok 2 - événements non publics (BROUILLON, VALIDE) : anon, client et partenaire B ne lisent aucune catégorie
    ok 3 - garde-fou : le partenaire propriétaire et un admin lisent toutes les catégories (masquées, inactives, non publiques)
    ok 4 - garde-fou : statut public SUSPENDU → anon lit encore la catégorie active et visible (pas l’inactive)
ok 1 - A3 — lecture publique de ticket_categories
# pass 4
# fail 0
```

**parcours/dette-transferts**

Run 43 (avant correctif) :

```text
    not ok 1 - lib/tickets/ticket-transfer.service.ts : plus aucun inMemoryTransfers ni activeTransfersLock
        → état en mémoire encore présent dans lib/tickets/ticket-transfer.service.ts : inMemoryTransfers, activeTransfersLock
        → +   'inMemoryTransfers',
        → +   'activeTransfersLock'
        → - []
    not ok 2 - aucun catch vide ou réduit à un commentaire : toute erreur remonte
        → catch qui avalent l’erreur :
        → lib/tickets/ticket-transfer.service.ts:195 } catch {
        → lib/tickets/ticket-transfer.service.ts:305 } catch {
        → lib/tickets/ticket-transfer.service.ts:388 } catch {
    not ok 3 - initiation, annulation et expiration passent par les RPC du contrat
        → RPC non appelées par lib/tickets/ticket-transfer.service.ts : ticket_transfer_initiate, ticket_transfer_cancel, ticket_transfers_expire
        → +   'ticket_transfer_initiate',
        → +   'ticket_transfer_cancel',
        → +   'ticket_transfers_expire'
    not ok 4 - crons ticket-transfers et moratoriums : refuseUnlessCron, aucun repli sur la clé service_role
        → app/api/cron/ticket-transfers/route.ts : refuseUnlessCron absent
        → app/api/cron/ticket-transfers/route.ts : repli sur SUPABASE_SERVICE_ROLE_KEY
        → app/api/cron/moratoriums/route.ts : refuseUnlessCron absent
        → app/api/cron/moratoriums/route.ts : repli sur SUPABASE_SERVICE_ROLE_KEY
not ok 1 - C1 — service sans mémoire (contrôle statique)
    not ok 1 - ticket_transfer_initiate, ticket_transfer_cancel, ticket_transfers_expire : SECURITY DEFINER, search_path = public, service_role seul
        → fonctions absentes : ticket_transfer_initiate, ticket_transfer_cancel, ticket_transfers_expire
        → +   'ticket_transfer_initiate',
        → +   'ticket_transfer_cancel',
        → +   'ticket_transfers_expire'
not ok 2 - C1 — RPC du contrat dans le catalogue
    not ok 1 - initiation vers un téléphone : transfert PENDING et transfer_locked posés ensemble ; SMS remis → recipient_notified true
        → recipient_notified: true attendu dans la réponse : HTTP 200 {"success":true,"message":"Transfert initié avec succès vers +221772914879.","transfer":{"transfer_id":"47dfd2b9-474b-4307-9790-7da1f0089661","ticket_id":"2d863ad5-f129-4b83-9cbf-c73c006e8201","ticket_number":"TCK-20261101-25803E7C7A","reci
        → + undefined
        → - true
    not ok 2 - échec du SMS au destinataire : transfert conservé (PENDING, billet verrouillé), recipient_notified false
        → recipient_notified: false attendu dans la réponse : HTTP 200 {"success":true,"message":"Transfert initié avec succès vers +221774486685.","transfer":{"transfer_id":"4562a919-eda0-482b-b698-9f1fc2cf738f","ticket_id":"9c141089-4124-49ea-be17-be9f57799597","ticket_number":"TCK-20261101-4C3320CA8B","rec
        → + undefined
        → - false
    ok 3 - garde-fou : deux initiations simultanées du même billet → une seule réussit, un seul transfert PENDING
not ok 3 - C1 — initiation par la route
    not ok 1 - ticket_transfer_initiate : transfert PENDING et verrou ensemble ; second transfert refusé ; tiers refusé sans effet
        → ticket_transfer_initiate : Could not find the function public.ticket_transfer_initiate(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.ticket_transfer_initiate with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 2 - ticket_transfer_initiate : entrée invalide → rien d’écrit, pas de verrou ; deux appels simultanés → un seul transfert
        → précondition : fonction ticket_transfer_initiate présente
        → 0 !== 1
    not ok 3 - ticket_transfer_cancel : CANCELLED et billet déverrouillé ensemble ; annulation par un tiers refusée sans effet
        → annulation par un tiers : refus attendu sous la forme { ok: false, code }, reçu l’erreur Could not find the function public.ticket_transfer_cancel(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.ticket_transfer_cancel with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: 'Perhaps you meant to call the function public.ticket_transfer_claim',
    not ok 4 - ticket_transfers_expire : transfert échu → EXPIRED et billet déverrouillé ; transfert en cours intact
        → ticket_transfers_expire : Could not find the function public.ticket_transfers_expire(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.ticket_transfers_expire with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 4 - C1 — RPC transactionnelles
    not ok 1 - getTransferRecord, getTransferByTicketId, isTicketLocked lisent la base et lèvent sur erreur (identifiant mal formé)
        → Missing expected rejection: getTransferRecord : erreur de lecture avalée (null renvoyé)
not ok 5 - C1 — lectures strictes du service
    not ok 1 - sans CRON_SECRET : la clé service_role ne déclenche pas le cron (refus), le transfert échu reste PENDING
        → clé service_role acceptée par le cron sans CRON_SECRET : HTTP 200 {"success":true,"message":"Traitement terminé. 2 transfert(s) expiré(s).","expiredCount":2,"transferIds":["e678d7e6-8e63-4451-ae7b-acd8c2f425fa","23b99b85-b772-4b0c-8fc4-beea441792c8"]}
    ok 2 - garde-fou : CRON_SECRET présent → clé service_role refusée (401) ; bon secret → transfert échu EXPIRED, billet déverrouillé
not ok 6 - C1 — cron ticket-transfers protégé par CRON_SECRET seul
not ok 7 - /home/runner/work/event-village/event-village/tests/parcours/dette-transferts.test.ts
        → events_finish_overdue : Could not find the function public.events_finish_overdue(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.events_finish_overdue with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
# pass 2
# fail 13
```

Run 55 (après correctif) :

```text
    ok 1 - lib/tickets/ticket-transfer.service.ts : plus aucun inMemoryTransfers ni activeTransfersLock
    ok 2 - aucun catch vide ou réduit à un commentaire : toute erreur remonte
    ok 3 - initiation, annulation et expiration passent par les RPC du contrat
    ok 4 - crons ticket-transfers et moratoriums : refuseUnlessCron, aucun repli sur la clé service_role
ok 1 - C1 — service sans mémoire (contrôle statique)
    ok 1 - ticket_transfer_initiate, ticket_transfer_cancel, ticket_transfers_expire : SECURITY DEFINER, search_path = public, service_role seul
ok 2 - C1 — RPC du contrat dans le catalogue
    ok 1 - initiation vers un téléphone : transfert PENDING et transfer_locked posés ensemble ; SMS remis → recipient_notified true
    ok 2 - échec du SMS au destinataire : transfert conservé (PENDING, billet verrouillé), recipient_notified false
    ok 3 - garde-fou : deux initiations simultanées du même billet → une seule réussit, un seul transfert PENDING
ok 3 - C1 — initiation par la route
    ok 1 - ticket_transfer_initiate : transfert PENDING et verrou ensemble ; second transfert refusé ; tiers refusé sans effet
    ok 2 - ticket_transfer_initiate : entrée invalide → rien d’écrit, pas de verrou ; deux appels simultanés → un seul transfert
    ok 3 - ticket_transfer_cancel : CANCELLED et billet déverrouillé ensemble ; annulation par un tiers refusée sans effet
    ok 4 - ticket_transfers_expire : transfert échu → EXPIRED et billet déverrouillé ; transfert en cours intact
ok 4 - C1 — RPC transactionnelles
    ok 1 - getTransferRecord, getTransferByTicketId, isTicketLocked lisent la base et lèvent sur erreur (identifiant mal formé)
ok 5 - C1 — lectures strictes du service
    ok 1 - sans CRON_SECRET : la clé service_role ne déclenche pas le cron (refus), le transfert échu reste PENDING
    ok 2 - garde-fou : CRON_SECRET présent → clé service_role refusée (401) ; bon secret → transfert échu EXPIRED, billet déverrouillé
ok 6 - C1 — cron ticket-transfers protégé par CRON_SECRET seul
# pass 15
# fail 0
```

**parcours/dette-cloture-caisse**

Run 43 (avant correctif) :

```text
    not ok 1 - clôture sans écart : sans PIN, CLOTURE, écart 0, déclaré = attendu, closed_by = contrôleur
        → clôture sans écart (sans PIN) : HTTP 400 {"error":"Le code PIN régisseur est obligatoire pour co-signer la clôture.","code":"PIN_REQUIRED"}
        → 400 !== 200
    not ok 2 - clôture avec écart justifié et PIN : CLOTURE, écart = déclaré − attendu, justification, co-signature, une alerte in-app sans emoji
        → clôture avec écart justifié : HTTP 400 {"error":"Une justification est obligatoire en cas d’écart de caisse (montant déclaré différent du montant attendu).","code":"JUSTIFICATION_REQUIRED"}
        → 400 !== 200
    ok 3 - garde-fou : écart sans justification, ou justification de moins de 10 caractères → 400 JUSTIFICATION_REQUIRED, caisse OUVERT
    ok 4 - garde-fou : écart justifié avec un PIN faux → 401 PIN_INVALID ; sans PIN → 400 PIN_REQUIRED ; caisse OUVERT
    not ok 5 - double clôture simultanée sans écart : une 200, une 409 SHIFT_NOT_OPEN ; une seule clôture journalisée
        → une clôture acceptée, l’autre refusée : HTTP 400 {"error":"Le code PIN régisseur est obligatoire pour co-signer la clôture.","code":"PIN_REQUIRED"} | HTTP 400 {"error":"Le code PIN régisseur est obligatoire pour co-signer la clôture.","code":"PIN_REQUIRED"}
        → +   400,
        → +   400
        → -   200,
    not ok 6 - double clôture simultanée avec écart justifié : une seule réussit, une seule alerte au partenaire
        → une clôture acceptée, l’autre refusée : HTTP 400 {"error":"Une justification est obligatoire en cas d’écart de caisse (montant déclaré différent du montant attendu).","code":"JUSTIFICATION_REQUIRED"} | HTTP 400 {"error":"Une justification est obligatoire en cas d’écart de caisse (montant déclaré dif
        → +   400,
        → +   400
        → -   200,
    not ok 7 - le partenaire propriétaire clôture la caisse d’un contrôleur : 200, closed_by = partenaire
        → clôture par le partenaire propriétaire : HTTP 404 {"error":"Session de caisse introuvable.","code":"SHIFT_NOT_FOUND"}
        → 404 !== 200
    not ok 8 - un admin clôture avec écart justifié et PIN : 200, closed_by = admin
        → clôture par un admin : HTTP 404 {"error":"Session de caisse introuvable.","code":"SHIFT_NOT_FOUND"}
        → 404 !== 200
    ok 9 - garde-fou : le contrôleur d’une autre caisse du même événement est refusé (403 ou 404), caisse OUVERT
not ok 1 - C2 — clôture de caisse par la route
    not ok 1 - catalogue : SECURITY DEFINER, search_path = public, service_role seul
        → fonction shift_close absente
    not ok 2 - deux appels simultanés sans écart : un ok, l’autre SHIFT_NOT_OPEN
        → shift_close : Could not find the function public.shift_close(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.shift_close with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 3 - montant déclaré non entier ou négatif : refusé, caisse OUVERT
        → shift_close (0.5) : refus attendu sous la forme { ok: false }, reçu l’erreur Could not find the function public.shift_close(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.shift_close with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 4 - acteur sans droit (autre contrôleur) : refusé, caisse OUVERT
        → shift_close : refus attendu sous la forme { ok: false }, reçu l’erreur Could not find the function public.shift_close(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.shift_close with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 2 - C2 — RPC shift_close
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/dette-cloture-caisse.test.ts
        → events_finish_overdue : Could not find the function public.events_finish_overdue(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.events_finish_overdue with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
# pass 3
# fail 10
```

Run 55 (après correctif) :

```text
    ok 1 - clôture sans écart : sans PIN, CLOTURE, écart 0, déclaré = attendu, closed_by = contrôleur
    ok 2 - clôture avec écart justifié et PIN : CLOTURE, écart = déclaré − attendu, justification, co-signature, une alerte in-app sans emoji
    ok 3 - garde-fou : écart sans justification, ou justification de moins de 10 caractères → 400 JUSTIFICATION_REQUIRED, caisse OUVERT
    ok 4 - garde-fou : écart justifié avec un PIN faux → 401 PIN_INVALID ; sans PIN → 400 PIN_REQUIRED ; caisse OUVERT
    ok 5 - double clôture simultanée sans écart : une 200, une 409 SHIFT_NOT_OPEN ; une seule clôture journalisée
    ok 6 - double clôture simultanée avec écart justifié : une seule réussit, une seule alerte au partenaire
    ok 7 - le partenaire propriétaire clôture la caisse d’un contrôleur : 200, closed_by = partenaire
    ok 8 - un admin clôture avec écart justifié et PIN : 200, closed_by = admin
    ok 9 - garde-fou : le contrôleur d’une autre caisse du même événement est refusé (403 ou 404), caisse OUVERT
ok 1 - C2 — clôture de caisse par la route
    ok 1 - catalogue : SECURITY DEFINER, search_path = public, service_role seul
    ok 2 - deux appels simultanés sans écart : un ok, l’autre SHIFT_NOT_OPEN
    ok 3 - montant déclaré non entier ou négatif : refusé, caisse OUVERT
    ok 4 - acteur sans droit (autre contrôleur) : refusé, caisse OUVERT
ok 2 - C2 — RPC shift_close
# pass 13
# fail 0
```

**parcours/dette-retrait-controleur**

Run 43 (avant correctif) :

```text
    not ok 1 - admin sans ?partnerId= → 400 PARTNER_SCOPE_REQUIRED ; rien retiré, ni SMS ni notification
        → admin sans partnerId : HTTP 200 {"success":true,"message":"Contrôleur supprimé de l'équipe avec succès.","deactivated":false}
        → 200 !== 400
    not ok 2 - admin avec ?partnerId=A → retrait réel des affectations de A seulement (celle de B reste)
        → seule l’affectation chez B reste : [{"id":"2ef36bd6-0fb1-4c1b-895a-d4a8721ea70a","event_id":"0b220afb-148a-41f2-8ab9-91329d453f48"},{"id":"6ede201a-8955-4fbe-90a5-db5e49b385c4","event_id":"89d94b13-1aa2-4084-b792-b64c2166ee67"},{"id":"f603e326-e975-4272-8b64-6e7e29678371","event_id":"bfb3a7c1-8e4b-4
        → '0b220afb-148a-41f2-8ab9-91329d453f48',
        → +   '89d94b13-1aa2-4084-b792-b64c2166ee67',
        → +   'bfb3a7c1-8e4b-4669-8a1d-793d92568b9e'
    not ok 3 - partenaire B qui vise le contrôleur de A → 404 CONTROLLER_NOT_IN_TEAM ; rien retiré, ni SMS ni notification
        → partenaire B sur le contrôleur de A : HTTP 200 {"success":true,"message":"Contrôleur supprimé de l'équipe avec succès.","deactivated":false}
        → 200 !== 404
    not ok 4 - contrôleur inexistant → 404 CONTROLLER_NOT_IN_TEAM (plus de 200)
        → contrôleur inexistant : HTTP 200 {"success":true,"message":"Contrôleur supprimé de l'équipe avec succès.","deactivated":true}
        → 200 !== 404
    not ok 5 - RPC atomic_partner_remove_controller : p_partner_id NULL refusé, rien retiré
        → p_partner_id NULL accepté : {"new_role":"CONTROLEUR","is_exclusive":false,"remaining_assignments":1}
    ok 6 - garde-fou : le partenaire A retire son contrôleur → 200, affectations de A supprimées
not ok 1 - C3 — retrait d’un contrôleur : retrait réel ou refus explicite
    not ok 1 - affectation de A2 appelée sous l’URL de A1 (même propriétaire) → 404 ASSIGNMENT_NOT_FOUND, affectation intacte
        → affectation d’un autre événement : HTTP 200 {"success":true,"message":"Contrôleur retiré de l'événement."}
        → 200 !== 404
    not ok 2 - affectation absente → 404 (plus de 200 « déjà retirée »)
        → affectation absente : HTTP 200 {"success":true,"message":"Assignation déjà retirée."}
        → 200 !== 404
    ok 3 - garde-fou : bonne URL → 200, affectation retirée, l’autre affectation reste
not ok 2 - C5 — DELETE /api/partner/team/[eventId] : l’affectation doit appartenir à l’événement de l’URL
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/dette-retrait-controleur.test.ts
        → events_finish_overdue : Could not find the function public.events_finish_overdue(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.events_finish_overdue with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
# pass 2
# fail 7
```

Run 55 (après correctif) :

```text
    ok 1 - admin sans ?partnerId= → 400 PARTNER_SCOPE_REQUIRED ; rien retiré, ni SMS ni notification
    ok 2 - admin avec ?partnerId=A → retrait réel des affectations de A seulement (celle de B reste)
    ok 3 - partenaire B qui vise le contrôleur de A → 404 CONTROLLER_NOT_IN_TEAM ; rien retiré, ni SMS ni notification
    ok 4 - contrôleur inexistant → 404 CONTROLLER_NOT_IN_TEAM (plus de 200)
    ok 5 - RPC atomic_partner_remove_controller : p_partner_id NULL refusé, rien retiré
    ok 6 - garde-fou : le partenaire A retire son contrôleur → 200, affectations de A supprimées
ok 1 - C3 — retrait d’un contrôleur : retrait réel ou refus explicite
    ok 1 - affectation de A2 appelée sous l’URL de A1 (même propriétaire) → 404 ASSIGNMENT_NOT_FOUND, affectation intacte
    ok 2 - affectation absente → 404 (plus de 200 « déjà retirée »)
    ok 3 - garde-fou : bonne URL → 200, affectation retirée, l’autre affectation reste
ok 2 - C5 — DELETE /api/partner/team/[eventId] : l’affectation doit appartenir à l’événement de l’URL
# pass 9
# fail 0
```

**parcours/dette-roles-otp**

Run 43 (avant correctif) :

```text
    not ok 1 - user_roles_set et otp_check : SECURITY DEFINER, search_path = public, service_role seul
        → fonctions absentes : user_roles_set, otp_check
        → +   'user_roles_set',
        → +   'otp_check'
        → - []
    not ok 2 - setUserRoles passe par user_roles_set (plus d’INSERT puis DELETE séparés) ; otp-store passe par otp_check (plus d’UPDATE de attempts)
        → setUserRoles appelle la RPC user_roles_set
not ok 1 - C4 et C6 — RPC du contrat
    not ok 1 - RPC : remplace l’ensemble des rôles d’un compte (CLIENT → CLIENT + PARTENAIRE)
        → user_roles_set : Could not find the function public.user_roles_set(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.user_roles_set with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 2 - RPC : retrait de CONTROLEUR (caisse ouverte) + ajout d’ADMIN → refus CONTROLLER_HAS_OPEN_SHIFT, aucun rôle modifié
        → refus CONTROLLER_HAS_OPEN_SHIFT attendu : {"data":null,"error":{"code":"PGRST202","details":"Searched for the function public.user_roles_set with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.","hint":null,"message":"Could not find the funct
    not ok 3 - PATCH /api/admin/users (SUPERADMIN, roles: [ADMIN]) sur un contrôleur à caisse ouverte → 409 CONTROLLER_HAS_OPEN_SHIFT ; rôles et users.role inchangés
        → aucun rôle modifié : ADMIN ne doit pas être accordé par une requête refusée
        → +   'ADMIN',
        → 'CLIENT',
        → 'CONTROLEUR'
not ok 2 - C4 — user_roles_set : tout ou rien
    not ok 1 - 5 essais faux comptés un par un ; le 6ᵉ et le bon code ensuite → TOO_MANY_ATTEMPTS ; attempts = 5
        → essai faux 1 : Could not find the function public.otp_check(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.otp_check with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 2 - bon code → accepté et consommé (verified) ; le même code rejoué → refusé
        → otp_check : Could not find the function public.otp_check(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.otp_check with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 3 - 10 essais faux simultanés (RPC) : attempts = 5 exactement, au plus 5 refus INVALID, puis le bon code refusé
        → otp_check : Could not find the function public.otp_check(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.otp_check with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 4 - 10 essais faux simultanés par verifyStoredOtp (vérificateur du retrait) : attempts = 5, puis le bon code refusé (TOO_MANY_ATTEMPTS)
        → compteur exact sous concurrence (écritures perdues sinon) : [{"ok":false,"reason":"INVALID"},{"ok":false,"reason":"INVALID"},{"ok":false,"reason":"INVALID"},{"ok":false,"reason":"INVALID"},{"ok":false,"reason":"INVALID"},{"ok":false,"reason":"INVALID"},{"ok":false,"reason":"INVALID"},{"ok":false,"re
        → 1 !== 5
    not ok 5 - POST /api/withdrawals/request : quota par compte (WITHDRAWAL_REQUEST_PER_USER_HOUR = 3) → 4ᵉ demande en 429
        → demande 4 au-delà du quota par compte : HTTP 400 {"error":"Code de vérification incorrect ou expiré.","code":"OTP_INVALID"} | HTTP 400 {"error":"Code de vérification incorrect ou expiré.","code":"OTP_INVALID"} | HTTP 400 {"error":"Code de vérification incorrect ou expiré.","code":"OTP_INVALID"} | HT
        → 400 !== 429
not ok 3 - C6 — otp_check : compteur atomique, limite de 5 essais, consommation
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/dette-roles-otp.test.ts
        → events_finish_overdue : Could not find the function public.events_finish_overdue(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.events_finish_overdue with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
# pass 0
# fail 10
```

Run 55 (après correctif) :

```text
    ok 1 - user_roles_set et otp_check : SECURITY DEFINER, search_path = public, service_role seul
    ok 2 - setUserRoles passe par user_roles_set (plus d’INSERT puis DELETE séparés) ; otp-store passe par otp_check (plus d’UPDATE de attempts)
ok 1 - C4 et C6 — RPC du contrat
    ok 1 - RPC : remplace l’ensemble des rôles d’un compte (CLIENT → CLIENT + PARTENAIRE)
    ok 2 - RPC : retrait de CONTROLEUR (caisse ouverte) + ajout d’ADMIN → refus CONTROLLER_HAS_OPEN_SHIFT, aucun rôle modifié
    ok 3 - PATCH /api/admin/users (SUPERADMIN, roles: [ADMIN]) sur un contrôleur à caisse ouverte → 409 CONTROLLER_HAS_OPEN_SHIFT ; rôles et users.role inchangés
ok 2 - C4 — user_roles_set : tout ou rien
    ok 1 - 5 essais faux comptés un par un ; le 6ᵉ et le bon code ensuite → TOO_MANY_ATTEMPTS ; attempts = 5
    ok 2 - bon code → accepté et consommé (verified) ; le même code rejoué → refusé
    ok 3 - 10 essais faux simultanés (RPC) : attempts = 5 exactement, au plus 5 refus INVALID, puis le bon code refusé
    ok 4 - 10 essais faux simultanés par verifyStoredOtp (vérificateur du retrait) : attempts = 5, puis le bon code refusé (TOO_MANY_ATTEMPTS)
    ok 5 - POST /api/withdrawals/request : quota par compte (WITHDRAWAL_REQUEST_PER_USER_HOUR = 3) → 4ᵉ demande en 429
ok 3 - C6 — otp_check : compteur atomique, limite de 5 essais, consommation
# pass 10
# fail 0
```

**parcours/dette-guichet**

Run 43 (avant correctif) :

```text
    not ok 1 - tickets.user_id et payments.client_id nullables sous CHECK ; tickets.sale_channel ; ticket_scans.method COUNTER
        → tickets.sale_channel illisible : column "sale_channel" does not exist
not ok 1 - C7 — schéma du billet sans compte
    not ok 1 - Idempotency-Key absente → 400, rien vendu
        → vente sans Idempotency-Key : HTTP 200 {"ok":true,"amount":3000,"owner_id":"a0fb056e-e1b3-4727-afa1-709c4c7ef8ae","shift_id":"517fd45e-ab0f-4725-88f6-81b77b9332b3","payment_id":"0af5492c-04eb-4657-9deb-f4201f30d234","ticket_ids":["c2db673c-d5f4-4f52-a703-7b1d055b77ea"]}
        → 200 !== 400
    not ok 2 - vente sans numéro : billets UTILISE, une ligne ticket_scans COUNTER acceptée par billet, paiement hors plateforme sans client, caisse créditée, même transaction
        → vente sans numéro : billet sans compte (user_id a0fb056e-e1b3-4727-afa1-709c4c7ef8ae)
        → + 'a0fb056e-e1b3-4727-afa1-709c4c7ef8ae'
        → - null
    not ok 3 - numéro d’un compte existant : billet sans compte (aucun rattachement), payer_phone renseigné
        → numéro d’un compte existant : billet sans compte (user_id a177cd2f-a530-4dfe-901b-edac1e6d5b94)
        → + 'a177cd2f-a530-4dfe-901b-edac1e6d5b94'
        → - null
    not ok 4 - numéro du vendeur : jamais porteur
        → numéro du vendeur : billet sans compte (user_id a0fb056e-e1b3-4727-afa1-709c4c7ef8ae)
        → + 'a0fb056e-e1b3-4727-afa1-709c4c7ef8ae'
        → - null
    not ok 5 - même Idempotency-Key rejouée : même vente, aucun billet ni paiement en double, caisse créditée une fois
        → rejeu : même vente (payment_id) : HTTP 200 {"ok":true,"amount":3000,"owner_id":"a0fb056e-e1b3-4727-afa1-709c4c7ef8ae","shift_id":"517fd45e-ab0f-4725-88f6-81b77b9332b3","payment_id":"6d923a84-934a-4e11-bcb6-13341535dbe9","ticket_ids":["54c500f2-bdff-490f-9acd-937efc3ef86d"]} | HTTP 200 {"ok":true,"am
        → + 'c7fc2425-3b94-41a7-8b98-e931937698ca'
        → - '6d923a84-934a-4e11-bcb6-13341535dbe9'
    not ok 6 - reçu SMS : numéro fourni → SMS au numéro, receipt_sent true ; échec du SMS → vente conservée, receipt_sent false
        → un reçu SMS au numéro de l’acheteur (trouvé 0)
        → 0 !== 1
    not ok 7 - un nouveau scan d’un billet vendu au guichet → already_used, toujours une seule entrée acceptée
        → billet vendu au guichet déjà composté : HTTP 200 {"result":"valid","ticket":{"id":"c3d0b0d4-f804-4705-9c22-bb70f75d6275","price":3000,"holder":"Ibrahima Controleur","category":"Standard","ticket_number":"TCK-20261101-4BB8B8DF28","is_manual_entry":false},"scan_id":"4cb7892c-0d17-446d-9976-a50ded1547e
        → + 'valid'
        → - 'already_used'
    ok 8 - garde-fou : le partenaire propriétaire ne vend pas au guichet (NOT_ASSIGNED), rien vendu
    ok 9 - garde-fou : invariants (g)(h)(i) vrais sur les billets, la caisse et les paiements de la suite
not ok 2 - C7 — vente au guichet = entrée immédiate
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/dette-guichet.test.ts
        → events_finish_overdue : Could not find the function public.events_finish_overdue(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.events_finish_overdue with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
# pass 2
# fail 8
```

Run 55 (après correctif) :

```text
    ok 1 - tickets.user_id et payments.client_id nullables sous CHECK ; tickets.sale_channel ; ticket_scans.method COUNTER
ok 1 - C7 — schéma du billet sans compte
    ok 1 - Idempotency-Key absente → 400, rien vendu
    ok 2 - vente sans numéro : billets UTILISE, une ligne ticket_scans COUNTER acceptée par billet, paiement hors plateforme sans client, caisse créditée, même transaction
    ok 3 - numéro d’un compte existant : billet sans compte (aucun rattachement), payer_phone renseigné
    ok 4 - numéro du vendeur : jamais porteur
    ok 5 - même Idempotency-Key rejouée : même vente, aucun billet ni paiement en double, caisse créditée une fois
    ok 6 - reçu SMS : numéro fourni → SMS au numéro, receipt_sent true ; échec du SMS → vente conservée, receipt_sent false
    ok 7 - un nouveau scan d’un billet vendu au guichet → already_used, toujours une seule entrée acceptée
    ok 8 - garde-fou : le partenaire propriétaire ne vend pas au guichet (NOT_ASSIGNED), rien vendu
    ok 9 - garde-fou : invariants (g)(h)(i) vrais sur les billets, la caisse et les paiements de la suite
ok 2 - C7 — vente au guichet = entrée immédiate
# pass 10
# fail 0
```

**parcours/dette-incidents**

Run 43 (avant correctif) :

```text
    not ok 1 - 429 du scan : une ligne scan_incidents RATE_LIMITED (source SERVER, event_id) par refus ; corps illisible → event_id NULL ; ticket_scans inchangé
        → scan_incidents du scanneur 11ca1566-f9fc-4b57-b383-b05d032501ed : Could not find the table 'public.scan_incidents' in the schema cache (code PGRST205)
        → +   code: 'PGRST205',
        → +   details: null,
        → +   hint: null,
not ok 1 - C8 — incidents écrits par le serveur
    not ok 1 - contrôleur affecté : NETWORK et TIMEOUT enregistrés (source DEVICE, event_id) ; ticket_scans inchangé
        → POST /api/controller/scan/incidents absente (contrat C8) : Cannot find module '/home/runner/work/event-village/event-village/app/api/controller/scan/incidents/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
    not ok 2 - scanneur non autorisé sur l’événement (contrôleur de B) → 204, incident ignoré
        → POST /api/controller/scan/incidents absente (contrat C8) : Cannot find module '/home/runner/work/event-village/event-village/app/api/controller/scan/incidents/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
    not ok 3 - plus de 20 incidents dans un appel → refus 4xx, aucune ligne écrite
        → POST /api/controller/scan/incidents absente (contrat C8) : Cannot find module '/home/runner/work/event-village/event-village/app/api/controller/scan/incidents/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
    not ok 4 - middleware : le partenaire propriétaire passe sur /api/controller/scan/incidents (voie de contrôle partagée)
        → middleware → HTTP 403  (refusé)
        → false !== true
not ok 2 - C8 — incidents déclarés par l’appareil
    not ok 1 - partenaire propriétaire et admin lisent les incidents de l’événement ; partenaire B, client et anon ne lisent rien
        → POST /api/controller/scan/incidents absente (contrat C8) : Cannot find module '/home/runner/work/event-village/event-village/app/api/controller/scan/incidents/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
not ok 3 - C8 — lecture de scan_incidents
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/dette-incidents.test.ts
        → events_finish_overdue : Could not find the function public.events_finish_overdue(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.events_finish_overdue with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
# pass 0
# fail 6
```

Run 55 (après correctif) :

```text
    ok 1 - 429 du scan : une ligne scan_incidents RATE_LIMITED (source SERVER, event_id) par refus ; corps illisible → event_id NULL ; ticket_scans inchangé
ok 1 - C8 — incidents écrits par le serveur
    ok 1 - contrôleur affecté : NETWORK et TIMEOUT enregistrés (source DEVICE, event_id) ; ticket_scans inchangé
    ok 2 - scanneur non autorisé sur l’événement (contrôleur de B) → 204, incident ignoré
    ok 3 - plus de 20 incidents dans un appel → refus 4xx, aucune ligne écrite
    ok 4 - middleware : le partenaire propriétaire passe sur /api/controller/scan/incidents (voie de contrôle partagée)
ok 2 - C8 — incidents déclarés par l’appareil
    ok 1 - partenaire propriétaire et admin lisent les incidents de l’événement ; partenaire B, client et anon ne lisent rien
ok 3 - C8 — lecture de scan_incidents
# pass 6
# fail 0
```

**parcours/acces-guichet**

Run 43 (code non corrigé, version du test antérieure à son adaptation dans un commit de correctif : pas un test rouge) :

```text
    ok 1 - vente sans caisse ouverte : refusée, aucun billet ni paiement
    ok 2 - contrôleur sans permission espèces, ou non affecté à l’événement : refusé
    ok 3 - réglage access.counter_sale_enabled = false : refusé
    ok 4 - vente réussie : billets VALIDE payés hors plateforme au prix facial, caisse créditée, revenu EV nul, aucune écriture au grand livre, stock décrémenté
    ok 5 - catégorie inactive, stock insuffisant ou panier en partie impossible : refusé sans rien vendre
    ok 6 - propriétaire des billets : compte du buyerPhone s’il existe, sinon le vendeur
ok 1 - Vente au guichet en espèces
    ok 1 - /api/events/[id]/tickets/purchase n’existe plus et n’est plus référencée
    ok 2 - RPC counter_sale : SECURITY DEFINER, search_path = public, réservée au service_role
ok 2 - Ancienne route d’émission par le staff et RPC du guichet
# pass 8
# fail 0
```

Run 55 (après correctif) :

```text
    ok 1 - vente sans caisse ouverte : refusée, aucun billet ni paiement
    ok 2 - contrôleur sans permission espèces, ou non affecté à l’événement : refusé
    ok 3 - réglage access.counter_sale_enabled = false : refusé
    ok 4 - vente réussie : billets payés hors plateforme au prix facial, compostés (UTILISE) sans compte, caisse créditée, revenu EV nul, aucune écriture au grand livre, stock décrémenté
    ok 5 - catégorie inactive, stock insuffisant ou panier en partie impossible : refusé sans rien vendre
    ok 6 - lot 5 (C7) : aucun porteur, que le buyerPhone soit celui d’un compte ou inconnu (ni l’acheteur, ni le vendeur)
ok 1 - Vente au guichet en espèces
    ok 1 - /api/events/[id]/tickets/purchase n’existe plus et n’est plus référencée
    ok 2 - RPC counter_sale : SECURITY DEFINER, search_path = public, réservée au service_role
ok 2 - Ancienne route d’émission par le staff et RPC du guichet
# pass 8
# fail 0
```

**security/r9-partenaire-ecritures**

Run 43 (code non corrigé, version du test antérieure à son adaptation dans un commit de correctif : pas un test rouge) :

```text
    ok 1 - partenaire A qui passe son BROUILLON en PUBLIE → refusé
    ok 2 - partenaire A qui met son événement en avant (is_featured) → refusé
    ok 3 - partenaire A qui modifie sold_quantity / held_quantity de sa catégorie → refusé
    ok 4 - partenaire A qui crée un événement PUBLIE par REST → refusé
    ok 5 - partenaire A qui lit les annulations de B → rien
    ok 6 - partenaire A qui écrit une annulation sur l'événement publié de B → refusé
    ok 7 - partenaire A qui écrit une annulation par REST → refusé
ok 1 - R9 — écritures partenaire par REST
# pass 7
# fail 0
```

Run 55 (après correctif) :

```text
    ok 1 - partenaire A qui passe son BROUILLON en PUBLIE → refusé
    ok 2 - partenaire A qui met son événement en avant (is_featured) → refusé
    ok 3 - partenaire A qui modifie sold_quantity / held_quantity de sa catégorie → refusé
    ok 4 - partenaire A qui crée un événement PUBLIE par REST → refusé
    ok 5 - partenaire A qui lit les annulations de B → rien
    ok 6 - partenaire A qui écrit une annulation sur l'événement publié de B → refusé
    ok 7 - partenaire A qui écrit une annulation par REST → refusé
ok 1 - R9 — écritures partenaire par REST
# pass 7
# fail 0
```

**security/r3-fonctions-rpc**

Run 43 (code non corrigé, version du test antérieure à son adaptation dans un commit de correctif : pas un test rouge) :

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
ok 1 - R3 — RPC métier non appelables par anon / authenticated
    ok 1 - anon et authenticated : rpc(is_admin) acceptée
    ok 2 - anon et authenticated : rpc(is_superadmin) acceptée
    ok 3 - anon et authenticated : rpc(is_controller) acceptée
    ok 4 - anon et authenticated : rpc(has_role) acceptée
    ok 5 - anon et authenticated : rpc(is_partner_owner) acceptée
    ok 6 - anon et authenticated : rpc(auth_user_role) acceptée
ok 2 - R3 — aides RLS toujours appelables (sinon les politiques échouent)
# pass 74
# fail 0
```

Run 55 (après correctif) :

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
    ok 105 - anon : rpc(event_notify) refusée
    ok 106 - authenticated (compte CLIENT) : rpc(event_notify) refusée
    ok 107 - anon : rpc(event_create) refusée
    ok 108 - authenticated (compte CLIENT) : rpc(event_create) refusée
    ok 109 - anon : rpc(event_update) refusée
    ok 110 - authenticated (compte CLIENT) : rpc(event_update) refusée
    ok 111 - anon : rpc(ticket_category_create) refusée
    ok 112 - authenticated (compte CLIENT) : rpc(ticket_category_create) refusée
    ok 113 - anon : rpc(ticket_category_update) refusée
    ok 114 - authenticated (compte CLIENT) : rpc(ticket_category_update) refusée
    ok 115 - anon : rpc(ticket_category_delete) refusée
    ok 116 - authenticated (compte CLIENT) : rpc(ticket_category_delete) refusée
    ok 117 - anon : rpc(event_change_notifications_claim) refusée
    ok 118 - authenticated (compte CLIENT) : rpc(event_change_notifications_claim) refusée
    ok 119 - anon : rpc(event_change_notifications_mark) refusée
    ok 120 - authenticated (compte CLIENT) : rpc(event_change_notifications_mark) refusée
    ok 121 - anon : rpc(event_edit_refusal) refusée
    ok 122 - authenticated (compte CLIENT) : rpc(event_edit_refusal) refusée
    ok 123 - anon : rpc(event_end_from) refusée
    ok 124 - authenticated (compte CLIENT) : rpc(event_end_from) refusée
    ok 125 - anon : rpc(event_poster_path_ok) refusée
    ok 126 - authenticated (compte CLIENT) : rpc(event_poster_path_ok) refusée
    ok 127 - anon : rpc(ticket_category_has_sales) refusée
    ok 128 - authenticated (compte CLIENT) : rpc(ticket_category_has_sales) refusée
    ok 129 - anon : rpc(event_has_sales) refusée
    ok 130 - authenticated (compte CLIENT) : rpc(event_has_sales) refusée
    ok 131 - anon : rpc(ticket_category_normalize) refusée
    ok 132 - authenticated (compte CLIENT) : rpc(ticket_category_normalize) refusée
    ok 133 - anon : rpc(ticket_category_guard) refusée
    ok 134 - authenticated (compte CLIENT) : rpc(ticket_category_guard) refusée
    ok 135 - anon : rpc(low_stock_threshold) refusée
    ok 136 - authenticated (compte CLIENT) : rpc(low_stock_threshold) refusée
    ok 137 - anon : rpc(public_category_stock_sync) refusée
    ok 138 - authenticated (compte CLIENT) : rpc(public_category_stock_sync) refusée
    ok 139 - anon : rpc(public_event_state_sync) refusée
    ok 140 - authenticated (compte CLIENT) : rpc(public_event_state_sync) refusée
    ok 141 - anon : rpc(pilotage_scan_result_label) refusée
    ok 142 - authenticated (compte CLIENT) : rpc(pilotage_scan_result_label) refusée
    ok 143 - anon : rpc(pilotage_ticket_status_label) refusée
    ok 144 - authenticated (compte CLIENT) : rpc(pilotage_ticket_status_label) refusée
    ok 145 - anon : rpc(pilotage_display_name) refusée
    ok 146 - authenticated (compte CLIENT) : rpc(pilotage_display_name) refusée
    ok 147 - anon : rpc(pilotage_access) refusée
    ok 148 - authenticated (compte CLIENT) : rpc(pilotage_access) refusée
    ok 149 - anon : rpc(pilotage_refusal) refusée
    ok 150 - authenticated (compte CLIENT) : rpc(pilotage_refusal) refusée
    ok 151 - anon : rpc(pilotage_category_stats) refusée
    ok 152 - authenticated (compte CLIENT) : rpc(pilotage_category_stats) refusée
    ok 153 - anon : rpc(pilotage_compute_overview) refusée
    ok 154 - authenticated (compte CLIENT) : rpc(pilotage_compute_overview) refusée
    ok 155 - anon : rpc(pilotage_compute_cash) refusée
    ok 156 - authenticated (compte CLIENT) : rpc(pilotage_compute_cash) refusée
    ok 157 - anon : rpc(pilotage_overview) refusée
    ok 158 - authenticated (compte CLIENT) : rpc(pilotage_overview) refusée
    ok 159 - anon : rpc(pilotage_sales) refusée
    ok 160 - authenticated (compte CLIENT) : rpc(pilotage_sales) refusée
    ok 161 - anon : rpc(pilotage_entries) refusée
    ok 162 - authenticated (compte CLIENT) : rpc(pilotage_entries) refusée
    ok 163 - anon : rpc(pilotage_team) refusée
    ok 164 - authenticated (compte CLIENT) : rpc(pilotage_team) refusée
    ok 165 - anon : rpc(pilotage_cash) refusée
    ok 166 - authenticated (compte CLIENT) : rpc(pilotage_cash) refusée
    ok 167 - anon : rpc(pilotage_closing) refusée
    ok 168 - authenticated (compte CLIENT) : rpc(pilotage_closing) refusée
    ok 169 - anon : rpc(participants_export) refusée
    ok 170 - authenticated (compte CLIENT) : rpc(participants_export) refusée
    ok 171 - anon : rpc(event_controller_set_cash) refusée
    ok 172 - authenticated (compte CLIENT) : rpc(event_controller_set_cash) refusée
    ok 173 - anon : rpc(partner_events_overview) refusée
    ok 174 - authenticated (compte CLIENT) : rpc(partner_events_overview) refusée
    ok 175 - anon : rpc(admin_events_list) refusée
    ok 176 - authenticated (compte CLIENT) : rpc(admin_events_list) refusée
ok 1 - R3 — RPC métier non appelables par anon / authenticated
    ok 1 - anon et authenticated : rpc(is_admin) acceptée
    ok 2 - anon et authenticated : rpc(is_superadmin) acceptée
    ok 3 - anon et authenticated : rpc(is_controller) acceptée
    ok 4 - anon et authenticated : rpc(has_role) acceptée
    ok 5 - anon et authenticated : rpc(is_partner_owner) acceptée
    ok 6 - anon et authenticated : rpc(auth_user_role) acceptée
ok 2 - R3 — aides RLS toujours appelables (sinon les politiques échouent)
# pass 182
# fail 0
```

### 5.1 — Captures et fumée en CI

```text
$ git ls-tree --name-only 214a820 -- playwright.config.ts e2e
e2e
playwright.config.ts
(code de sortie 0)
```

**Correctif.**
- Playwright sur la base locale seedée.
- Faux SamirPay et MTarget locaux, liés à 127.0.0.1.
- `seed:demo` par les RPC métier ; affiches générées.
- Verrou réseau côté navigateur.
- Captures publiées sur `ci-results` avec leur index et la purge des anciens runs.
- Contrôles bloquants et avertissements.

Mise au point en CI, runs 49 à 55 (tableau en section 6). Le rendu et sa relecture sont en section 3.

**parcours/design-systeme**

Run 43 (avant correctif) :

```text
    not ok 1 - lib/events/event-status.ts exporte EVENT_STATUS_META : les 7 statuts, libellés et tons exacts du contrat B, description en français
        → EVENT_STATUS_META absent de lib/events/event-status.ts (exports : ELIGIBLE_EVENT_STATUSES_FOR_CONTROLLER, INELIGIBLE_EVENT_ASSIGNMENT_ERROR, getEventEligibilityRejectionReason, isEventEligibleForController)
    not ok 2 - StatusBadge (components/ui) lit EVENT_STATUS_META, a un domaine « event », sans majuscules forcées
        → StatusBadge : aucun fichier de components/ui n'exporte StatusBadge (contrat Q) en lisant EVENT_STATUS_META de lib/events/event-status.ts
not ok 1 - B — EVENT_STATUS_META, seule source des libellés de statut
    not ok 1 - app/globals.css : chaque token sémantique est une variable CSS de :root
        → variables absentes de :root : --surface, --surface-raised, --surface-sunken, --fg, --fg-muted, --border, --ring, --brand, --on-brand, --brand-decor, --success, --success-bg, --success-fg, --success-border, --warning, --warning-bg, --warning-fg, --warning-border, --danger, --danger-bg, --danger-fg, -
        → +   'surface',
        → +   'surface-raised',
        → +   'surface-sunken',
    not ok 2 - app/globals.css : le thème sombre (.dark) redéfinit surfaces, textes, bordures, anneau et tons
        → variables absentes de .dark : --surface, --surface-raised, --surface-sunken, --fg, --fg-muted, --border, --ring, --success-bg, --success-fg, --success-border, --warning-bg, --warning-fg, --warning-border, --danger-bg, --danger-fg, --danger-border, --info-bg, --info-fg, --info-border
        → +   'surface',
        → +   'surface-raised',
        → +   'surface-sunken',
    not ok 3 - tailwind.config : couleurs branchées sur les variables (bg-surface, text-fg, bg-brand, text-on-brand, bg-success-bg…)
        → surface : absent des couleurs Tailwind
        → surface-raised : absent des couleurs Tailwind
        → surface-sunken : absent des couleurs Tailwind
        → fg : absent des couleurs Tailwind
    not ok 4 - tailwind.config : utilitaire text-caption à 12 px (seule petite taille admise, voir la règle text-xs)
        → text-caption absent : ni theme.extend.fontSize.caption ni règle .text-caption dans globals.css
    not ok 5 - rampe brand-50 à brand-900 en orange : teinte 12°–40°, saturation ≥ 0,35, luminosité décroissante
        → brand-300 = #FFB3A1 : teinte 11.5° hors de l'orange (12°–40°)
        → brand-400 = #FF8266 : teinte 11.0° hors de l'orange (12°–40°)
        → brand-600 = #F44336 : teinte 4.1° hors de l'orange (12°–40°)
        → brand-600 = #F44336 : luminosité 0.584 non décroissante
    not ok 6 - contraste WCAG : --brand avec le blanc ≥ 4,5:1, --on-brand sur --brand ≥ 4,5:1 (clair et sombre) ; --brand-decor = \#FF5722
        → --brand = #FF5722 : contraste avec le blanc 3.16:1 < 4,5:1 (texte blanc des boutons primaires)
not ok 2 - Q — tokens sémantiques (globals.css, tailwind.config)
    not ok 1 - Button : au moins 44 px à toutes les tailles (min-h-11, icône min-w-11), primaire plein bg-brand et text-on-brand
        → components/ui/Button.tsx : tailles sans min-h-11 (44 px)
        → +   'sm: text-xs px-3.5 py-1.5 h-8 gap-1.5 rounded-lg',
        → +   'md: text-sm px-4 py-2.5 h-10 sm:h-11 gap-2 rounded-xl',
        → +   'lg: text-base px-6 py-3.5 h-12 sm:h-13 gap-2.5 font-bold rounded-2xl',
    not ok 2 - Modal : role dialog, aria-modal, aria-labelledby, Escape, piège de focus, focus restitué, bouton Fermer de 44 px avec aria-label
        → components/ui/Modal.tsx : exigences manquantes : role="dialog" (ou alertdialog) ; aria-modal ; aria-labelledby ; piège de focus (touche Tab et éléments focalisables) ; restitution du focus (document.activeElement puis .focus()) ; bouton Fermer de 44 px (IconButton, ou h-11 et w-11)
        → +   'role="dialog" (ou alertdialog)',
        → +   'aria-modal',
        → +   'aria-labelledby',
    not ok 3 - ConfirmDialog : children, requireText (saisie comparée, champ étiqueté) et isLoading
        → components/ui/ConfirmDialog.tsx : exigences manquantes : prop requireText: string ; prop children (contenu : impact de l’annulation) ; saisie comparée à requireText ; champ de saisie étiqueté (TextInput/Field, ou input + htmlFor)
        → +   'prop requireText: string',
        → +   'prop children (contenu : impact de l’annulation)',
        → +   'saisie comparée à requireText',
    not ok 4 - ReasonDialog : motif obligatoire (au moins 3 caractères), champ étiqueté, sur Modal ou ConfirmDialog
        → ReasonDialog : aucun fichier de components/ui n'exporte ReasonDialog (contrat Q)
    not ok 5 - KpiCard et KpiCardSkeleton : label, value, hint, tone, icon, loading
        → KpiCard : aucun fichier de components/ui n'exporte KpiCard (contrat Q)
    not ok 6 - Tabs : role tablist et tab, aria-selected, flèches gauche et droite, compteur par onglet
        → Tabs : aucun fichier de components/ui n'exporte Tabs (contrat Q)
    not ok 7 - Pagination : <nav aria-label>, Précédent, Suivant, « Page X sur Y », cibles de 44 px
        → Pagination : aucun fichier de components/ui n'exporte Pagination (contrat Q)
    not ok 8 - PageHeader : <h1>, title, description, actions qui passent à la ligne (flex-wrap)
        → PageHeader : aucun fichier de components/ui n'exporte PageHeader (contrat Q)
    not ok 9 - IconButton : aria-label obligatoire dans le type, 44 × 44 px
        → IconButton : aucun fichier de components/ui n'exporte IconButton (contrat Q)
    not ok 10 - LinkButton : next/link stylé en bouton, sans <button> imbriqué, 44 px
        → LinkButton : aucun fichier de components/ui n'exporte LinkButton (contrat Q)
    not ok 11 - Field, TextInput, Textarea, Select : label lié (htmlFor, id), aide et erreur reliées (aria-describedby), aria-invalid
        → composants de champ absents de components/ui : Field, TextInput, Textarea, Select
        → +   'Field',
        → +   'TextInput',
        → +   'Textarea',
    not ok 12 - DataList : tableau à partir de md, cartes en dessous
        → DataList : aucun fichier de components/ui n'exporte DataList (contrat Q)
    not ok 13 - StatusBanner : annoncé aux lecteurs d’écran (role status ou alert, ou aria-live)
        → StatusBanner : aucun fichier de components/ui n'exporte StatusBanner (contrat Q)
    not ok 14 - LiveIndicator : « En direct » et « Hors ligne », annoncé (role status ou aria-live)
        → LiveIndicator : aucun fichier de components/ui n'exporte LiveIndicator (contrat Q)
    not ok 15 - ErrorState : onRetry obligatoire et bouton « Réessayer » ; EmptyState présent
        → components/ui/EmptyState.tsx : onRetry optionnel (contrat Q : ErrorState toujours avec « Réessayer »)
not ok 3 - Q — composants partagés (components/ui)
    not ok 1 - versionné, généré puis complété des règles du lot (brand-decor, text-caption)
        → design-system/event-village/MASTER.md absent (contrat Q : généré avec ui-ux-pro-max --persist, puis versionné)
not ok 4 - Q — design-system/event-village/MASTER.md
    ok 1 - garde-fou du détecteur : un fichier fautif est signalé règle par règle, les commentaires sont ignorés
    ok 2 - garde-fou du détecteur : un fichier conforme ne déclenche aucune règle
    ok 3 - garde-fou : chaque entrée de la liste existe, sans doublon, en chemin relatif à la racine
    not ok 4 - la liste contient les écrans du lot (admin, liste et pilotage partenaire, formulaire, page publique, catalogue, accueil, mes billets, anciennes pages caisse et équipe)
        → écrans du lot absents du dépôt : app/admin/events/page.tsx, app/admin/events/[id]/page.tsx, app/partner/events/[id]/page.tsx, components/events/EventForm.tsx
        → +   'app/admin/events/page.tsx',
        → +   'app/admin/events/[id]/page.tsx',
        → +   'app/partner/events/[id]/page.tsx',
    not ok 5 - la liste contient les composants partagés créés ou corrigés par le lot
        → Modal : components/ui/Modal.tsx absent de la liste
        → ConfirmDialog : components/ui/ConfirmDialog.tsx absent de la liste
        → ReasonDialog : absent de components/ui
        → StatusBadge : absent de components/ui
    ok 6 - garde-fou : tout fichier .tsx créé par le lot dans app/ ou components/ figure dans la liste
not ok 5 - Q — fichiers migrés (tests/helpers/design-files.ts)
# pass 4
# fail 26
```

Run 55 (après correctif) :

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
    ok 121 - règles du contrat Q : components/partner/pilotage/ScrollableTabs.tsx
    ok 122 - accessibilité et mobile (DoD 3 et 7) : components/partner/pilotage/ScrollableTabs.tsx
    ok 123 - règles du contrat Q : app/controller/scanner/page.tsx
    ok 124 - accessibilité et mobile (DoD 3 et 7) : app/controller/scanner/page.tsx
    ok 125 - règles du contrat Q : components/scan/ScannerShiftBanner.tsx
    ok 126 - accessibilité et mobile (DoD 3 et 7) : components/scan/ScannerShiftBanner.tsx
    ok 127 - règles du contrat Q : components/scan/ScanResultPanel.tsx
    ok 128 - accessibilité et mobile (DoD 3 et 7) : components/scan/ScanResultPanel.tsx
    ok 129 - règles du contrat Q : components/scan/ManualEntryForm.tsx
    ok 130 - accessibilité et mobile (DoD 3 et 7) : components/scan/ManualEntryForm.tsx
    ok 131 - règles du contrat Q : components/scan/CameraQrScanner.tsx
    ok 132 - accessibilité et mobile (DoD 3 et 7) : components/scan/CameraQrScanner.tsx
ok 5 - Q — fichiers migrés (tests/helpers/design-files.ts)
# pass 156
# fail 0
```

### 5.2 — Machine à états stricte

```text
$ git grep -n -E 'status:|\.update\(\{ *status' 214a820 -- lib/events/event.service.ts
214a820:lib/events/event.service.ts:145:                status: 'BROUILLON', // Statut initial strict (§31)
214a820:lib/events/event.service.ts:358:                    status: existing.status,
214a820:lib/events/event.service.ts:808:                status: newStatus,
214a820:lib/events/event.service.ts:837:                    data: { eventId, status: newStatus, actionUrl: '/partner/events' },
214a820:lib/events/event.service.ts:858:                    data: { eventId, status: newStatus, reason: reasonText, actionUrl: '/partner/events' },
214a820:lib/events/event.service.ts:879:                    data: { eventId, status: newStatus, reason: reasonText },
214a820:lib/events/event.service.ts:899:                    data: { eventId, status: newStatus },
(code de sortie 0)

$ git grep -n -E 'event_status_history|event_status_transitions' 214a820 -- supabase/migrations
(code de sortie 1)
```

**Correctif** (migration `…03`) :
- table de transitions ;
- historique en ajout seul ;
- INSERT forcé en BROUILLON ;
- garde du statut par une ligne d'historique de la transaction courante (EV422) ;
- `event_transition` : rôles, motifs, `SUBMIT_INCOMPLETE`, `EVENT_NOT_STARTED`, `EVENT_ENDED`, `UNKNOWN_STATUS` → 400 ;
- `event_actions` ;
- notifications.

**parcours/cycle-transitions**

Run 43 (avant correctif) :

```text
    not ok 1 - liste exacte de 5.2 : 16 couples (ancien, nouveau, rôle, canal), motif obligatoire pour le refus et la suspension
        → event_status_transitions : Could not find the table 'public.event_status_transitions' in the schema cache (code PGRST205)
        → +   code: 'PGRST205',
        → +   details: null,
        → +   hint: null,
    not ok 2 - la table est lisible par un compte connecté (actions possibles des interfaces)
        → lecture par authenticated : Could not find the table 'public.event_status_transitions' in the schema cache
        → +   code: 'PGRST205',
        → +   details: null,
        → +   hint: null,
not ok 1 - 5.2 Table de transitions (event_status_transitions)
    not ok 1 - chaque transition permise au bon rôle passe et écrit sa ligne (acteur, ancien, nouveau, motif, canal)
        → BROUILLON → EN_ATTENTE (soumission) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 2 - VALIDE → PUBLIE par un admin : permis et journalisé ADMIN
        → advanceEventTo(2921b718-a1ec-4bb8-affc-f2f2e081d388, VALIDE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 466667ec-1fb4-4f9a-9553-92eea98d3766) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 2 - 5.2 Transitions permises : event_transition et historique
    not ok 1 - ANNULE → PUBLIE refusé pour tous les rôles (partenaire, ADMIN, SUPERADMIN, système)
        → advanceEventTo(7fca7af1-e47e-4ba7-b33b-bae6198384fa, ANNULE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 466667ec-1fb4-4f9a-9553-92eea98d3766) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 2 - TERMINE → PUBLIE, SUSPENDU ou BROUILLON refusé, et TERMINE ne s’annule plus
        → advanceEventTo(94801eba-c14c-42f1-9692-82897f938ddf, TERMINE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 466667ec-1fb4-4f9a-9553-92eea98d3766) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 3 - 5.2 Statuts terminaux : ANNULE et TERMINE
    not ok 1 - partenaire qui tente VALIDE ou SUSPENDU (et TERMINE) → refusé par la RPC (TRANSITION_NOT_ALLOWED) et par sa route (403)
        → advanceEventTo(d2693b2d-6010-4415-8e2d-1c60acd5515d, EN_ATTENTE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 466667ec-1fb4-4f9a-9553-92eea98d3766) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 2 - route partenaire : la soumission passe et journalise le compte de la session
        → route ../../app/api/partner/events/[id]/transition/route absente (contrat D4) : Cannot find module '/home/runner/work/event-village/event-village/app/api/partner/events/[id]/transition/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
    not ok 3 - partenaire B et client : aucune transition sur l’événement du partenaire A
        → historique des statuts de l'événement 923277ed-baf0-4100-a679-81dee19688c5 : Could not find the table 'public.event_status_history' in the schema cache
        → +   code: 'PGRST205',
        → +   details: null,
        → +   hint: null,
    not ok 4 - transitions hors table de l’ancienne matrice refusées à l’admin : VALIDE → SUSPENDU, * → TERMINE, BROUILLON → EN_ATTENTE ou VALIDE
        → advanceEventTo(10e14c82-320e-4b23-beab-3b7f67d7c436, VALIDE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 466667ec-1fb4-4f9a-9553-92eea98d3766) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 4 - 5.2 Rôles : le partenaire ne valide, ne suspend ni ne termine
    not ok 1 - motif obligatoire (REASON_REQUIRED) pour le refus admin et la suspension ; le retrait par le partenaire s’en passe
        → advanceEventTo(e80c5c9a-6361-4bc8-935b-82bf63c79a8b, EN_ATTENTE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 466667ec-1fb4-4f9a-9553-92eea98d3766) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 2 - SUBMIT_INCOMPLETE : soumission sans affiche, sans catégorie active, ou sans rien (liste des manques)
        → historique des statuts de l'événement 7d497dfe-1841-4ae5-8edf-4fcc64768626 : Could not find the table 'public.event_status_history' in the schema cache
        → +   code: 'PGRST205',
        → +   details: null,
        → +   hint: null,
    not ok 3 - TERMINE manuel avant le début → EVENT_NOT_STARTED
        → advanceEventTo(3b700122-fe0e-43a5-a403-c6bf70a34f1f, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 466667ec-1fb4-4f9a-9553-92eea98d3766) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 4 - publication d’un événement dont la fin est passée → EVENT_ENDED (fin renseignée, ou début la veille sans fin)
        → advanceEventTo(12e34e8a-66c2-4c85-ac0f-edd3e6e6dbfd, VALIDE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 466667ec-1fb4-4f9a-9553-92eea98d3766) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 5 - 5.2 Motifs, complétude et dates
    not ok 1 - statut inconnu → 400 UNKNOWN_STATUS par les deux routes (et refus UNKNOWN_STATUS de la RPC)
        → advanceEventTo(92c0f2b0-1667-420f-ac6e-74d90905f6db, EN_ATTENTE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 466667ec-1fb4-4f9a-9553-92eea98d3766) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 2 - route admin : permission events.write exigée (ADMIN en lecture seule et client refusés en 403)
        → advanceEventTo(a549df30-cd4b-463f-a8d9-490c49fdf496, EN_ATTENTE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 466667ec-1fb4-4f9a-9553-92eea98d3766) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 3 - ancienne route /api/partner/events/[id]/status supprimée, plus aucun appel dans le code
        → app/api/partner/events/[id]/status/route.ts existe encore
        → true !== false
not ok 6 - 5.2 Routes
    not ok 1 - UPDATE direct de events.status par le service_role refusé (EV422), même pour une transition de la table
        → historique des statuts de l'événement 2223c5f1-f53d-4e46-8b34-dea960dcf91c : Could not find the table 'public.event_status_history' in the schema cache
        → +   code: 'PGRST205',
        → +   details: null,
        → +   hint: null,
    not ok 2 - une ligne d’historique écrite dans une autre transaction ne déverrouille pas la garde
        → UPDATE après une ligne forgée (insertion refusée : Could not find the table 'public.event_status_history' in the schema cache) : {"success":true,"error":null,"data":[{"id":"6a1e8ca9-c291-423f-b602-bfa630c13405"}],"count":null,"status":200,"statusText":"OK"}
        → + undefined
        → - 'EV422'
    not ok 3 - INSERT forcé à BROUILLON, avec la seule ligne NULL → BROUILLON (canal CREATION)
        → INSERT demandé en PUBLIE : statut forcé à BROUILLON
        → + 'PUBLIE'
        → - 'BROUILLON'
not ok 7 - 5.2 Garde du statut (D3) et création (D2)
    not ok 1 - ajout seul : UPDATE et DELETE refusés au service_role, lignes intactes
        → advanceEventTo(090e9693-2b30-45b8-bb68-332de303ba8a, EN_ATTENTE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 466667ec-1fb4-4f9a-9553-92eea98d3766) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 2 - lecture : le partenaire propriétaire lit son historique, le partenaire B rien ; aucune écriture par l’API
        → advanceEventTo(0a9ed0d7-63f8-4459-8675-d33b13a9d4b0, EN_ATTENTE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 466667ec-1fb4-4f9a-9553-92eea98d3766) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 3 - suppression d’un brouillon : l’historique part en cascade
        → historique des statuts de l'événement 2e23ffac-1588-4495-a7ec-fbbfb30d1fea : Could not find the table 'public.event_status_history' in the schema cache
        → +   code: 'PGRST205',
        → +   details: null,
        → +   hint: null,
not ok 8 - 5.2 Historique des statuts (event_status_history)
    not ok 1 - refus avec motif, validation, suspension avec motif : acteur de la session journalisé, partenaire notifié
        → advanceEventTo(0a41ba61-a8ad-4dd3-af25-8c0af3b9c266, EN_ATTENTE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 466667ec-1fb4-4f9a-9553-92eea98d3766) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 9 - 5.2 Notifications au partenaire (route admin)
not ok 10 - /home/runner/work/event-village/event-village/tests/parcours/cycle-transitions.test.ts
        → events_finish_overdue : Could not find the function public.events_finish_overdue(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.events_finish_overdue with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
# pass 0
# fail 24
```

Run 55 (après correctif) :

```text
    ok 1 - liste exacte de 5.2 : 16 couples (ancien, nouveau, rôle, canal), motif obligatoire pour le refus et la suspension
    ok 2 - la table est lisible par un compte connecté (actions possibles des interfaces)
ok 1 - 5.2 Table de transitions (event_status_transitions)
    ok 1 - chaque transition permise au bon rôle passe et écrit sa ligne (acteur, ancien, nouveau, motif, canal)
    ok 2 - VALIDE → PUBLIE par un admin : permis et journalisé ADMIN
ok 2 - 5.2 Transitions permises : event_transition et historique
    ok 1 - ANNULE → PUBLIE refusé pour tous les rôles (partenaire, ADMIN, SUPERADMIN, système)
    ok 2 - TERMINE → PUBLIE, SUSPENDU ou BROUILLON refusé, et TERMINE ne s’annule plus
ok 3 - 5.2 Statuts terminaux : ANNULE et TERMINE
    ok 1 - partenaire qui tente VALIDE ou SUSPENDU (et TERMINE) → refusé par la RPC (TRANSITION_NOT_ALLOWED) et par sa route (403)
    ok 2 - route partenaire : la soumission passe et journalise le compte de la session
    ok 3 - partenaire B et client : aucune transition sur l’événement du partenaire A
    ok 4 - transitions hors table de l’ancienne matrice refusées à l’admin : VALIDE → SUSPENDU, * → TERMINE, BROUILLON → EN_ATTENTE ou VALIDE
ok 4 - 5.2 Rôles : le partenaire ne valide, ne suspend ni ne termine
    ok 1 - motif obligatoire (REASON_REQUIRED) pour le refus admin et la suspension ; le retrait par le partenaire s’en passe
    ok 2 - SUBMIT_INCOMPLETE : soumission sans affiche, sans catégorie active, ou sans rien (liste des manques)
    ok 3 - TERMINE manuel avant le début → EVENT_NOT_STARTED
    ok 4 - publication d’un événement dont la fin est passée → EVENT_ENDED (fin renseignée, ou début la veille sans fin)
ok 5 - 5.2 Motifs, complétude et dates
    ok 1 - statut inconnu → 400 UNKNOWN_STATUS par les deux routes (et refus UNKNOWN_STATUS de la RPC)
    ok 2 - route admin : permission events.write exigée (ADMIN en lecture seule et client refusés en 403)
    ok 3 - ancienne route /api/partner/events/[id]/status supprimée, plus aucun appel dans le code
ok 6 - 5.2 Routes
    ok 1 - UPDATE direct de events.status par le service_role refusé (EV422), même pour une transition de la table
    ok 2 - une ligne d’historique écrite dans une autre transaction ne déverrouille pas la garde
    ok 3 - INSERT forcé à BROUILLON, avec la seule ligne NULL → BROUILLON (canal CREATION)
ok 7 - 5.2 Garde du statut (D3) et création (D2)
    ok 1 - ajout seul : UPDATE et DELETE refusés au service_role, lignes intactes
    ok 2 - lecture : le partenaire propriétaire lit son historique, le partenaire B rien ; aucune écriture par l’API
    ok 3 - suppression d’un brouillon : l’historique part en cascade
ok 8 - 5.2 Historique des statuts (event_status_history)
    ok 1 - refus avec motif, validation, suspension avec motif : acteur de la session journalisé, partenaire notifié
ok 9 - 5.2 Notifications au partenaire (route admin)
# pass 24
# fail 0
```

**parcours/achat-serveur**

Run 43 (code non corrigé, version du test antérieure à son adaptation dans un commit de correctif : pas un test rouge) :

```text
ok 1 - checkout → paiement PENDING → notification SUCCESS → billet VALIDE émis par le serveur
# pass 1
# fail 0
```

Run 55 (après correctif) :

```text
ok 1 - checkout → paiement PENDING → notification SUCCESS → billet VALIDE émis par le serveur
# pass 1
# fail 0
```

**parcours/email-optionnel**

Run 43 (code non corrigé, version du test antérieure à son adaptation dans un commit de correctif : pas un test rouge) :

```text
    ok 1 - inscriptions et achat sans RESEND_API_KEY : SMS envoyés, aucun email tenté, un seul avertissement
    ok 2 - sans identifiants MTarget, la configuration serveur est refusée
ok 1 - Email optionnel, SMS obligatoire
# pass 2
# fail 0
```

Run 55 (après correctif) :

```text
    ok 1 - inscriptions et achat sans RESEND_API_KEY : SMS envoyés, aucun email tenté, un seul avertissement
    ok 2 - sans identifiants MTarget, la configuration serveur est refusée
ok 1 - Email optionnel, SMS obligatoire
# pass 2
# fail 0
```

**parcours/statut-compte**

Run 43 (code non corrigé, version du test antérieure à son adaptation dans un commit de correctif : pas un test rouge) :

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

Run 55 (après correctif) :

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

### 5.3 — Visibilité publique

```text
$ git grep -n -E '\.eq\('"'"'status'"'"'|status' 214a820 -- 'app/api/events/[id]/route.ts' app/api/events/route.ts
214a820:app/api/events/[id]/route.ts:11:            return NextResponse.json({ error: 'ID événement requis.' }, { status: 400 });
214a820:app/api/events/[id]/route.ts:16:            return NextResponse.json({ error: 'Événement introuvable.' }, { status: 404 });
214a820:app/api/events/[id]/route.ts:40:                status,
214a820:app/api/events/[id]/route.ts:52:            return NextResponse.json({ error: 'Événement introuvable.' }, { status: 404 });
214a820:app/api/events/[id]/route.ts:71:            .eq('status', 'PENDING');
214a820:app/api/events/[id]/route.ts:127:                    status: categoryStatus,
214a820:app/api/events/[id]/route.ts:180:                status: event.status,
214a820:app/api/events/[id]/route.ts:196:        return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
214a820:app/api/events/route.ts:34:                status,
214a820:app/api/events/route.ts:40:            .eq('status', 'PUBLIE')
214a820:app/api/events/route.ts:47:            return NextResponse.json({ error: 'Impossible de charger les événements.' }, { status: 500 });
214a820:app/api/events/route.ts:80:                status: evt.status,
214a820:app/api/events/route.ts:103:        return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
(code de sortie 0)
```

**Correctif :**
- `/api/events/[id]` : 404 avant publication ; bandeau, avis public et `purchasable` ; catégories actives et visibles ; stock en tranches.
- Catalogue : PUBLIE à venir seulement, « Bientôt en vente » sans prix.
- Page publique : bandeau, achat masqué hors `purchasable`, 404 propre.

**parcours/cycle-visibilite**

Run 43 (avant correctif) :

```text
    not ok 1 - BROUILLON, EN_ATTENTE et VALIDE → 404, sans rien divulguer
        → BROUILLON : 404 attendu, HTTP 200 {"event":{"id":"2b2352cc-2add-450b-a6cc-50e7505d4e3c","slug":"2b2352cc-2add-450b-a6cc-50e7505d4e3c","title":"TEST Cycle nonpublic-brouillon 1793505386876","category":"CONCERT","categoryLabel":"Concerts & Musique","description":"Événement dédié aux tests du cycle de 
        → 200 !== 404
    not ok 2 - PUBLIE : fiche normale, purchasable true, aucun bandeau
        → advanceEventTo(00bd07c8-a4ac-45bc-8b26-ef7049a3a4ae, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE fa2bbd48-4a54-4e90-9d91-a4d8f3e50c4b) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 3 - PUBLIE dont la vente est close → purchasable false, aucun bandeau
        → advanceEventTo(14cc020b-e6d1-45cd-a2e3-159df57d5ee7, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE fa2bbd48-4a54-4e90-9d91-a4d8f3e50c4b) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 4 - SUSPENDU : 200 avec bandeau, purchasable false
        → advanceEventTo(798d546e-6579-44aa-b74d-934d1fd83188, SUSPENDU) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE fa2bbd48-4a54-4e90-9d91-a4d8f3e50c4b) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 5 - ANNULE : 200 avec bandeau, avis public, date et information de remboursement, sans motif interne, purchasable false
        → advanceEventTo(81a663cb-3ba8-4d5e-b19c-5ebc1823237a, ANNULE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE fa2bbd48-4a54-4e90-9d91-a4d8f3e50c4b) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 6 - TERMINE : 200 en archive, bandeau, purchasable false
        → advanceEventTo(54579d3e-fdfc-42b6-b618-3daff1a15c7d, TERMINE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE fa2bbd48-4a54-4e90-9d91-a4d8f3e50c4b) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 7 - catégories inactives ou masquées absentes de la fiche
        → advanceEventTo(4a627223-f33b-42f3-9334-fec9f6f84a2b, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE fa2bbd48-4a54-4e90-9d91-a4d8f3e50c4b) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 1 - 5.3 Fiche publique GET /api/events/[id]
    not ok 1 - seulement les PUBLIE à venir : passés, suspendus, annulés, terminés et non publics exclus ; en cours inclus
        → advanceEventTo(e2a67ca1-66d3-4a20-9817-f1f3c4690627, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE fa2bbd48-4a54-4e90-9d91-a4d8f3e50c4b) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 2 - prix « à partir de » calculé sur les catégories actives ET visibles
        → advanceEventTo(03597c4c-c06a-4ac0-b7f9-3ac0d6ba60b9, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE fa2bbd48-4a54-4e90-9d91-a4d8f3e50c4b) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 3 - jamais « Gratuit » sans catégorie achetable : sans prix, « Bientôt en vente » ; témoin : catégorie gratuite achetable → 0 F
        → advanceEventTo(fce605d6-60f7-4cd8-b087-ae261e71f4be, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE fa2bbd48-4a54-4e90-9d91-a4d8f3e50c4b) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 2 - 5.3 Catalogue GET /api/events
    not ok 1 - bandeau StatusBanner selon le statut et module d’achat masqué hors purchasable
        → components/ui/StatusBanner.tsx (contrat Q)
not ok 3 - 5.3 Page publique app/events/[id] (contrôle statique)
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/cycle-visibilite.test.ts
        → events_finish_overdue : Could not find the function public.events_finish_overdue(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.events_finish_overdue with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
# pass 0
# fail 11
```

Run 55 (après correctif) :

```text
    ok 1 - BROUILLON, EN_ATTENTE et VALIDE → 404, sans rien divulguer
    ok 2 - PUBLIE : fiche normale, purchasable true, aucun bandeau
    ok 3 - PUBLIE dont la vente est close → purchasable false, aucun bandeau
    ok 4 - SUSPENDU : 200 avec bandeau, purchasable false
    ok 5 - ANNULE : 200 avec bandeau, avis public, date et information de remboursement, sans motif interne, purchasable false
    ok 6 - TERMINE : 200 en archive, bandeau, purchasable false
    ok 7 - catégories inactives ou masquées absentes de la fiche
ok 1 - 5.3 Fiche publique GET /api/events/[id]
    ok 1 - seulement les PUBLIE à venir : passés, suspendus, annulés, terminés et non publics exclus ; en cours inclus
    ok 2 - prix « à partir de » calculé sur les catégories actives ET visibles
    ok 3 - jamais « Gratuit » sans catégorie achetable : sans prix, « Bientôt en vente » ; témoin : catégorie gratuite achetable → 0 F
ok 2 - 5.3 Catalogue GET /api/events
    ok 1 - bandeau StatusBanner selon le statut et module d’achat masqué hors purchasable
ok 3 - 5.3 Page publique app/events/[id] (contrôle statique)
# pass 11
# fail 0
```

### 5.4 — Passage automatique à TERMINÉ

```text
$ git ls-tree --name-only 214a820 -- app/api/cron
app/api/cron
(code de sortie 0)

$ git grep -n -E TERMINE 214a820 -- app/api/cron lib/events
214a820:lib/events/event-cancellation.service.ts:135:        if (event.status === 'TERMINE') {
214a820:lib/events/event-status.ts:11: * 6. TERMINE     : Événement clôturé / passé. NON ÉLIGIBLE ❌
214a820:lib/events/event-status.ts:47:        case 'TERMINE':
214a820:lib/events/event.service.ts:9:export type EventStatus = 'BROUILLON' | 'EN_ATTENTE' | 'VALIDE' | 'PUBLIE' | 'SUSPENDU' | 'TERMINE' | 'ANNULE';
214a820:lib/events/event.service.ts:256:        // TERMINE et ANNULE ne peuvent plus être modifiés
214a820:lib/events/event.service.ts:257:        if (existing.status === 'TERMINE' || existing.status === 'ANNULE') {
214a820:lib/events/event.service.ts:492:        if (['ANNULE', 'TERMINE'].includes(event.status)) {
214a820:lib/events/event.service.ts:611:        if (['ANNULE', 'TERMINE'].includes(event.status)) {
214a820:lib/events/event.service.ts:711:     * - PARTENAIRE : peut faire BROUILLON → EN_ATTENTE, et PUBLIE → TERMINE.
214a820:lib/events/event.service.ts:712:     * - ADMIN / SUPERADMIN : peut faire EN_ATTENTE → VALIDE, VALIDE → PUBLIE, PUBLIE → SUSPENDU, SUSPENDU → PUBLIE, * → TERMINE.
214a820:lib/events/event.service.ts:749:            // ADMIN/SUPERADMIN : BROUILLON → EN_ATTENTE (seul chemin autorisé depuis BROUILLON, sauf TERMINE via * → TERMINE)
214a820:lib/events/event.service.ts:752:            } else if (newStatus === 'TERMINE' && isAdmin) {
214a820:lib/events/event.service.ts:753:                // Autorisé uniquement pour admin (* → TERMINE)
214a820:lib/events/event.service.ts:764:            } else if (newStatus === 'TERMINE' && isAdmin) {
214a820:lib/events/event.service.ts:765:                // Autorisé uniquement pour admin (* → TERMINE)
214a820:lib/events/event.service.ts:776:            } else if (newStatus === 'TERMINE' && isAdmin) {
214a820:lib/events/event.service.ts:777:                // Autorisé uniquement pour admin (* → TERMINE)
214a820:lib/events/event.service.ts:782:            // ADMIN/SUPERADMIN : PUBLIE → SUSPENDU, PUBLIE → TERMINE
214a820:lib/events/event.service.ts:783:            // PARTENAIRE : PUBLIE → TERMINE
214a820:lib/events/event.service.ts:786:            } else if (newStatus === 'TERMINE') {
214a820:lib/events/event.service.ts:792:            // ADMIN/SUPERADMIN : SUSPENDU → PUBLIE, SUSPENDU → TERMINE
214a820:lib/events/event.service.ts:795:            } else if (newStatus === 'TERMINE') {
214a820:lib/events/event.service.ts:800:        } else if (currentStatus === 'TERMINE') {
(code de sortie 0)
```

**Correctif :**
- fonction unique `event_end_at` ;
- `events_finish_overdue` (SKIP LOCKED, SYSTEM et CRON) ;
- route `/api/cron/events-finish` ;
- scan et caisse encore ouverts en TERMINE dans la fenêtre.

**parcours/cycle-cron**

Run 43 (avant correctif) :

```text
    not ok 1 - refusée sans CRON_SECRET ou avec un faux secret (GET et POST), sans aucun effet
        → advanceEventTo(00a5a2eb-41cc-4927-871d-262d5b09baf9, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE aa31d5d2-41a4-4575-8845-a598cbdbfad6) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 2 - PUBLIE dont la fin est passée → TERMINE, journalisé (SYSTEM, CRON) ; second passage sans effet ; ids rendus par la RPC
        → advanceEventTo(ffd3994f-6c6c-4ba4-8ecd-582b044c8d73, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE aa31d5d2-41a4-4575-8845-a598cbdbfad6) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 1 - 5.4 Route /api/cron/events-finish
    not ok 1 - sans fin, commencé la veille → TERMINE ; sans fin, commencé aujourd’hui → reste PUBLIE jusqu’à 23:59
        → advanceEventTo(59599eec-a6f0-42dc-ac0b-38971eef97c9, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE aa31d5d2-41a4-4575-8845-a598cbdbfad6) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 2 - le cron ne touche ni un PUBLIE à venir, ni un SUSPENDU passé
        → advanceEventTo(669998cd-609d-4fec-a0c8-14d5f880c93b, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE aa31d5d2-41a4-4575-8845-a598cbdbfad6) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 3 - event_end_at unique : fin renseignée à Dakar, sinon début à 23:59 ; fin_event_end et scan_window la reprennent
        → advanceEventTo(8155ed18-3643-4d9c-abca-b93277e4f6cc, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE aa31d5d2-41a4-4575-8845-a598cbdbfad6) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 4 - même règle que ticket_sale_problems : un événement sans fin reste en vente jusqu’à 23:59 si la fin de vente le permet
        → advanceEventTo(ba758850-8c38-4bd9-8187-2053254be6bc, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE aa31d5d2-41a4-4575-8845-a598cbdbfad6) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 2 - 5.4 Fin absente : début à 23:59 Africa/Dakar
    not ok 1 - scan accepté en TERMINE dans la fenêtre (fin + access.scan_window_after_hours), refusé après
        → advanceEventTo(4437928e-490e-4a2e-b2a9-a0f138016212, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE aa31d5d2-41a4-4575-8845-a598cbdbfad6) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 2 - ouverture de caisse en TERMINE dans la fenêtre, refusée après
        → advanceEventTo(db0094e1-08d9-45a0-864e-b5c12c8fed87, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE aa31d5d2-41a4-4575-8845-a598cbdbfad6) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 3 - 5.4 Après TERMINE : scan et caisse dans la fenêtre seulement
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/cycle-cron.test.ts
        → events_finish_overdue : Could not find the function public.events_finish_overdue(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.events_finish_overdue with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
# pass 0
# fail 8
```

Run 55 (après correctif) :

```text
    ok 1 - refusée sans CRON_SECRET ou avec un faux secret (GET et POST), sans aucun effet
    ok 2 - PUBLIE dont la fin est passée → TERMINE, journalisé (SYSTEM, CRON) ; second passage sans effet ; ids rendus par la RPC
ok 1 - 5.4 Route /api/cron/events-finish
    ok 1 - sans fin, commencé la veille → TERMINE ; sans fin, commencé aujourd’hui → reste PUBLIE jusqu’à 23:59
    ok 2 - le cron ne touche ni un PUBLIE à venir, ni un SUSPENDU passé
    ok 3 - event_end_at unique : fin renseignée à Dakar, sinon début à 23:59 ; fin_event_end et scan_window la reprennent
    ok 4 - même règle que ticket_sale_problems : un événement sans fin reste en vente jusqu’à 23:59 si la fin de vente le permet
ok 2 - 5.4 Fin absente : début à 23:59 Africa/Dakar
    ok 1 - scan accepté en TERMINE dans la fenêtre (fin + access.scan_window_after_hours), refusé après
    ok 2 - ouverture de caisse en TERMINE dans la fenêtre, refusée après
ok 3 - 5.4 Après TERMINE : scan et caisse dans la fenêtre seulement
# pass 8
# fail 0
```

**parcours/acces-fenetre**

Run 43 (code non corrigé, version du test antérieure à son adaptation dans un commit de correctif : pas un test rouge) :

```text
    ok 1 - 8 h avant le début → event_not_open
    ok 2 - 5 h avant le début, en cours, 5 h après la fin → valid
    ok 3 - fin + 6 h dépassée → event_ended
ok 1 - 4.4 Fenêtre de scan (réglages par défaut : 6 h avant, 6 h après)
    ok 1 - non PUBLIE (VALIDE non publié, BROUILLON) → event_not_open
    ok 2 - ANNULE → event_cancelled ; SUSPENDU → event_suspended ; TERMINE → event_ended
ok 2 - 4.4 Statut de l’événement
    ok 1 - access.scan_window_before_hours : un événement dans 8 h s’ouvre avec 10 h, pas avec 6 h
    ok 2 - access.scan_window_after_hours : un événement fini il y a 3 h se ferme avec 2 h, reste ouvert avec 6 h
ok 3 - 4.4 Fenêtre réglable
    ok 1 - billet « à régler sur place » scanné cash_required, puis événement ANNULE → encaissement refusé, rien d’écrit
ok 4 - 4.4 Encaissement sur un événement annulé
# pass 8
# fail 0
```

Run 55 (après correctif) :

```text
    ok 1 - 8 h avant le début → event_not_open
    ok 2 - 5 h avant le début, en cours, 5 h après la fin → valid
    ok 3 - fin + 6 h dépassée → event_ended
ok 1 - 4.4 Fenêtre de scan (réglages par défaut : 6 h avant, 6 h après)
    ok 1 - non PUBLIE (VALIDE non publié, BROUILLON) → event_not_open
    ok 2 - ANNULE → event_cancelled ; SUSPENDU → event_suspended ; TERMINE → event_ended
ok 2 - 4.4 Statut de l’événement
    ok 1 - access.scan_window_before_hours : un événement dans 8 h s’ouvre avec 10 h, pas avec 6 h
    ok 2 - access.scan_window_after_hours : un événement fini il y a 3 h se ferme avec 2 h, reste ouvert avec 6 h
ok 3 - 4.4 Fenêtre réglable
    ok 1 - billet « à régler sur place » scanné cash_required, puis événement ANNULE → encaissement refusé, rien d’écrit
ok 4 - 4.4 Encaissement sur un événement annulé
# pass 8
# fail 0
```

### 5.5 — Édition

```text
$ git grep -n -E 'ticket_categories|full_name' 214a820 -- lib/events/event.service.ts 'app/partner/events/[id]/edit/page.tsx'
214a820:app/partner/events/[id]/edit/page.tsx:56:    ticket_categories: z.array(ticketCategorySchema).optional(),
214a820:app/partner/events/[id]/edit/page.tsx:161:                if (ev.ticket_categories && Array.isArray(ev.ticket_categories)) {
214a820:app/partner/events/[id]/edit/page.tsx:163:                        ev.ticket_categories.map((c: Record<string, unknown>) => ({
214a820:app/partner/events/[id]/edit/page.tsx:233:            formData.ticket_categories = ticketCategories.map((c) => ({
214a820:app/partner/events/[id]/edit/page.tsx:272:                        const key = `ticket_categories.${index}.${issue.path.join('.')}`;
214a820:app/partner/events/[id]/edit/page.tsx:287:            } else if (firstErrorKey.startsWith('ticket_categories') || firstErrorKey === 'ticket_quota_exceeded') {
214a820:app/partner/events/[id]/edit/page.tsx:337:            ticket_categories: services.ticketing
214a820:app/partner/events/[id]/edit/page.tsx:701:                                                {errors[`ticket_categories.${index}.name`] && <p className="mt-1 text-[11px] font-semibold text-red-500">{errors[`ticket_categories.${index}.name`]}</p>}
214a820:app/partner/events/[id]/edit/page.tsx:707:                                                {errors[`ticket_categories.${index}.price`] && <p className="mt-1 text-[11px] font-semibold text-red-500">{errors[`ticket_categories.${index}.price`]}</p>}
214a820:app/partner/events/[id]/edit/page.tsx:716:                                                {errors[`ticket_categories.${index}.total_quantity`] && <p className="mt-1 text-[11px] font-semibold text-red-500">{errors[`ticket_categories.${index}.total_quantity`]}</p>}
214a820:lib/events/event.service.ts:63:    ticket_categories?: TicketCategoryInput[];
214a820:lib/events/event.service.ts:109:        if (input.ticket_categories && input.ticket_categories.length > 0 && input.capacity && input.capacity > 0) {
214a820:lib/events/event.service.ts:110:            const totalQuota = input.ticket_categories.reduce((sum, cat) => sum + Number(cat.total_quantity), 0);
214a820:lib/events/event.service.ts:155:        if (input.ticket_categories && input.ticket_categories.length > 0) {
214a820:lib/events/event.service.ts:156:            const categoriesToInsert = input.ticket_categories.map(cat => ({
214a820:lib/events/event.service.ts:171:                .from('ticket_categories')
214a820:lib/events/event.service.ts:193:            .select('*, ticket_categories(*)')
214a820:lib/events/event.service.ts:220:            .select('*, ticket_categories(*), partners(company_name, phone, user_id)')
214a820:lib/events/event.service.ts:246:            .select('*, ticket_categories(*)')
214a820:lib/events/event.service.ts:319:        const soldTotal = (existing.ticket_categories || []).reduce((sum: number, cat: any) => sum + (cat.sold_quantity || 0), 0);
214a820:lib/events/event.service.ts:320:        const sumQuotas = (existing.ticket_categories || []).reduce((sum: number, cat: any) => sum + (cat.total_quantity || 0), 0);
214a820:lib/events/event.service.ts:383:                        .select('id, email, phone, full_name')
214a820:lib/events/event.service.ts:433:                                            <p>Bonjour <strong>${clientUser.full_name || 'Cher client'}</strong>,</p>
214a820:lib/events/event.service.ts:483:            .select('id, title, status, capacity, partner_id, ticket_categories(*)')
214a820:lib/events/event.service.ts:496:        const existingCategory = (event.ticket_categories || []).find((c: any) => c.id === categoryId);
214a820:lib/events/event.service.ts:531:                const otherCategoriesTotal = (event.ticket_categories || [])
214a820:lib/events/event.service.ts:551:            .from('ticket_categories')
214a820:lib/events/event.service.ts:602:            .select('id, status, capacity, partner_id, ticket_categories(*)')
214a820:lib/events/event.service.ts:621:            const currentTotalQuotas = (event.ticket_categories || []).reduce(
214a820:lib/events/event.service.ts:631:            .from('ticket_categories')
214a820:lib/events/event.service.ts:690:        const { error: catDelErr } = await supabase.from('ticket_categories').delete().eq('event_id', eventId);
(code de sortie 0)
```

**Correctif** (migration `…04`) :
- `event_create` et `event_update` transactionnelles : champs libres, notifiés, verrouillés, interdits ; `WITHDRAW_TO_EDIT` ; `EDIT_CONFLICT` ;
- fonds recalculés si la fin recule ;
- file des notifications de changement et son cron ;
- catégories par RPC dédiées (`QUOTA_BELOW_SOLD`, `QUOTA_BELOW_HELD`, `PRICE_LOCKED_AFTER_SALES`, `CATEGORY_HAS_SALES`) ;
- formulaire unique `EventForm`.

**parcours/edition-formulaire**

Run 43 (avant correctif) :

```text
    not ok 1 - événement BROUILLON et ses catégories créés ensemble, champs appliqués, historique NULL → BROUILLON (CREATION)
        → historique des statuts de l'événement 6772c719-a4b1-4238-b7c9-10913452e405 : Could not find the table 'public.event_status_history' in the schema cache
        → +   code: 'PGRST205',
        → +   details: null,
        → +   hint: null,
    not ok 2 - tout ou rien : deux catégories au même nom (casse différente) → refus, ni événement ni catégorie créés
        → doublon de nom : HTTP 400 ou 409 attendu, reçu 201 {"success":true,"event":{"id":"cd0adc3e-d2cc-4210-87d3-be159ba16716","partner_id":"c87c8f59-c086-4d9c-83c9-18ce9c4beadd","title":"TEST Édition doublon 1793505407763","slug":"test-dition-doublon-1793505407763-407772","description":"Concert de test du
    not ok 3 - statut, slug, partenaire ou clé inconnue dans le corps → 400 avec le champ refusé, aucun événement créé
        → status en entrée : HTTP 400 attendu, reçu 201 {"success":true,"event":{"id":"65553d7f-1972-4cfe-865d-358da9772f5b","partner_id":"c87c8f59-c086-4d9c-83c9-18ce9c4beadd","title":"TEST Édition cle-status 1793505407778","slug":"test-dition-cle-status-1793505407778-407784","description":"Concert de test d
        → 201 !== 400
    ok 4 - compte sans rôle partenaire → 403, aucun événement (garde-fou)
    not ok 5 - statique : la création passe par event_create ; plus d’insertion directe des catégories ni de rattrapage par suppression
        → POST /api/partner/events (ou EventService) appelle la RPC event_create
not ok 1 - 5.5 — création : POST /api/partner/events (event_create)
    not ok 1 - R29 — PUBLIÉ avec une vente : l’ancien envoi (ticket_categories) est refusé en clair, le nouvel envoi du formulaire est appliqué
        → advanceEventTo(720d4e10-a748-4880-8cf3-c4a5fdeef585, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 98f2fd2a-4ecf-430b-9765-368059d78ec8) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 2 - enregistrement sans changement réel (heure HH:mm contre HH:mm:ss en base, champs verrouillés renvoyés à l’identique) : aucun porteur notifié
        → advanceEventTo(af8e4eba-cb8d-41bc-a8a6-3d2f4a786c98, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 98f2fd2a-4ecf-430b-9765-368059d78ec8) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 3 - changement de date d’un PUBLIÉ : une ligne event_change_notifications par porteur VALIDE, notification dans l’application, { notified_holders, sms_queued }
        → advanceEventTo(2c9c3d30-c2ca-43b8-a768-a0d0a158d54c, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 98f2fd2a-4ecf-430b-9765-368059d78ec8) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 4 - changement de titre : notification dans l’application seulement, aucun SMS en file
        → advanceEventTo(9c558a1c-195a-4df3-88bb-4738d6fb7586, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 98f2fd2a-4ecf-430b-9765-368059d78ec8) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 5 - lieu et adresse : porteur notifié, SMS en file
        → advanceEventTo(afd41f2b-56c6-4fc9-9152-32ea17a63669, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 98f2fd2a-4ecf-430b-9765-368059d78ec8) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 6 - champs libres d’un PUBLIÉ (description, programme, infos pratiques hors adresse, affiche, coordonnées) : appliqués sans notification
        → advanceEventTo(b6f3a427-2e26-4b0f-9a67-98ac4fe42769, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 98f2fd2a-4ecf-430b-9765-368059d78ec8) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 7 - catégorie d’événement et jauge verrouillées dès qu’il y a des ventes (LOCKED_AFTER_SALES, champ en cause) ; hausse de jauge acceptée ; sans vente, modifiables
        → advanceEventTo(32502682-0768-47c7-8a5e-ef9ad6199ace, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 98f2fd2a-4ecf-430b-9765-368059d78ec8) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 8 - champs interdits (status, services, gallery_urls, ticket_categories, slug, partner_id, is_featured) → 400 FIELD_NOT_EDITABLE, rien n’est modifié
        → champ status : HTTP 400 attendu, reçu 200 {"success":true,"event":{"id":"80965663-d5c4-4658-9c5a-2843f091deb6","partner_id":"c87c8f59-c086-4d9c-83c9-18ce9c4beadd","title":"TEST Cycle interdits 1793505407986","slug":null,"description":"Événement dédié aux tests du cycle de vie (lot 5).","program":nul
    not ok 9 - EN_ATTENTE → 409 WITHDRAW_TO_EDIT ; après retrait en BROUILLON, la modification passe
        → advanceEventTo(a5bc15fa-681d-4b10-b4e8-ebe738cfca06, EN_ATTENTE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 98f2fd2a-4ecf-430b-9765-368059d78ec8) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 10 - VALIDE et SUSPENDU : règles d’après publication (champ libre appliqué, statut refusé)
        → advanceEventTo(b6b05526-b6a8-45b2-9cb4-20a14db8994b, VALIDE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 98f2fd2a-4ecf-430b-9765-368059d78ec8) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 11 - TERMINE et ANNULE → 409 EVENT_LOCKED, rien n’est modifié
        → advanceEventTo(d29d0089-4c11-46b7-bf9d-f2524d2952de, TERMINE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 98f2fd2a-4ecf-430b-9765-368059d78ec8) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 12 - admin → 403 ADMIN_CANNOT_EDIT ; partenaire B → refus sans effet
        → admin : HTTP 403 attendu, reçu 400 {"error":"Profil partenaire introuvable pour cet utilisateur."}
    not ok 13 - EDIT_CONFLICT : expected_updated_at périmé → 409, la première modification reste
        → première modification appliquée
        → + 'Événement dédié aux tests du cycle de vie (lot 5).'
        → - 'Première session'
    not ok 14 - report de la fin après des ventes : available_at du crédit VENTE recalculé dans la même modification, jamais avancé
        → advanceEventTo(b9426b33-d91a-485c-9348-1d7cf94d40c4, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 98f2fd2a-4ecf-430b-9765-368059d78ec8) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 15 - fin avancée sous une fin de vente → 409 SALE_END_AFTER_EVENT avec les catégories concernées ; rien n’est modifié
        → fin à 21:00 sous la fin de vente de 22:00 : HTTP 409 attendu, reçu 200 {"success":true,"event":{"id":"a2785886-b051-4b74-b46d-442f00f11793","partner_id":"c87c8f59-c086-4d9c-83c9-18ce9c4beadd","title":"TEST Cycle fin-de-vente 1793505408094","slug":null,"description":"Événement dédié aux tests du cycl
    not ok 16 - file des SMS : le cron event-change-notifications envoie un SMS par porteur et une seule fois ; refus sans CRON_SECRET
        → Cannot find module '/home/runner/work/event-village/event-village/app/api/cron/event-change-notifications/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
not ok 2 - 5.5 — édition : PUT /api/partner/events/[id] (event_update)
    not ok 1 - un seul composant components/events/EventForm.tsx, rendu par la création et l’édition, sans copie locale du formulaire
        → components/events/EventForm.tsx absent
    not ok 2 - statique : l’édition passe par event_update ; plus de notification synchrone dans le service
        → PUT /api/partner/events/[id] (ou EventService) appelle la RPC event_update
    not ok 3 - RPC event_create et event_update : SECURITY DEFINER, search_path = public, (p jsonb) RETURNS jsonb, réservées au service_role
        → fonction event_create : une seule signature attendue ([])
        → 0 !== 1
not ok 3 - F6 — formulaire partagé et RPC (contrôles statiques et catalogue)
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/edition-formulaire.test.ts
        → events_finish_overdue : Could not find the function public.events_finish_overdue(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.events_finish_overdue with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
# pass 1
# fail 23
```

Run 55 (après correctif) :

```text
    ok 1 - événement BROUILLON et ses catégories créés ensemble, champs appliqués, historique NULL → BROUILLON (CREATION)
    ok 2 - tout ou rien : deux catégories au même nom (casse différente) → refus, ni événement ni catégorie créés
    ok 3 - statut, slug, partenaire ou clé inconnue dans le corps → 400 avec le champ refusé, aucun événement créé
    ok 4 - compte sans rôle partenaire → 403, aucun événement (garde-fou)
    ok 5 - statique : la création passe par event_create ; plus d’insertion directe des catégories ni de rattrapage par suppression
ok 1 - 5.5 — création : POST /api/partner/events (event_create)
    ok 1 - R29 — PUBLIÉ avec une vente : l’ancien envoi (ticket_categories) est refusé en clair, le nouvel envoi du formulaire est appliqué
    ok 2 - enregistrement sans changement réel (heure HH:mm contre HH:mm:ss en base, champs verrouillés renvoyés à l’identique) : aucun porteur notifié
    ok 3 - changement de date d’un PUBLIÉ : une ligne event_change_notifications par porteur VALIDE, notification dans l’application, { notified_holders, sms_queued }
    ok 4 - changement de titre : notification dans l’application seulement, aucun SMS en file
    ok 5 - lieu et adresse : porteur notifié, SMS en file
    ok 6 - champs libres d’un PUBLIÉ (description, programme, infos pratiques hors adresse, affiche, coordonnées) : appliqués sans notification
    ok 7 - catégorie d’événement et jauge verrouillées dès qu’il y a des ventes (LOCKED_AFTER_SALES, champ en cause) ; hausse de jauge acceptée ; sans vente, modifiables
    ok 8 - champs interdits (status, services, gallery_urls, ticket_categories, slug, partner_id, is_featured) → 400 FIELD_NOT_EDITABLE, rien n’est modifié
    ok 9 - EN_ATTENTE → 409 WITHDRAW_TO_EDIT ; après retrait en BROUILLON, la modification passe
    ok 10 - VALIDE et SUSPENDU : règles d’après publication (champ libre appliqué, statut refusé)
    ok 11 - TERMINE et ANNULE → 409 EVENT_LOCKED, rien n’est modifié
    ok 12 - admin → 403 ADMIN_CANNOT_EDIT ; partenaire B → refus sans effet
    ok 13 - EDIT_CONFLICT : expected_updated_at périmé → 409, la première modification reste
    ok 14 - report de la fin après des ventes : available_at du crédit VENTE recalculé dans la même modification, jamais avancé
    ok 15 - fin avancée sous une fin de vente → 409 SALE_END_AFTER_EVENT avec les catégories concernées ; rien n’est modifié
    ok 16 - file des SMS : le cron event-change-notifications envoie un SMS par porteur et une seule fois ; refus sans CRON_SECRET
ok 2 - 5.5 — édition : PUT /api/partner/events/[id] (event_update)
    ok 1 - un seul composant components/events/EventForm.tsx, rendu par la création et l’édition, sans copie locale du formulaire
    ok 2 - statique : l’édition passe par event_update ; plus de notification synchrone dans le service
    ok 3 - RPC event_create et event_update : SECURITY DEFINER, search_path = public, (p jsonb) RETURNS jsonb, réservées au service_role
ok 3 - F6 — formulaire partagé et RPC (contrôles statiques et catalogue)
# pass 24
# fail 0
```

**parcours/edition-categories**

Run 43 (avant correctif) :

```text
    not ok 1 - tous les champs appliqués, rien d’ignoré (is_active: false, max_per_order, dates de vente en heure de Dakar)
        → tous les champs appliqués : {"id":"6a8b9346-1d0c-4c3a-a3b0-4fc12acb80c4","event_id":"86089189-957b-46ca-8dbf-1985d106132e","name":"Prévente","description":"Tarif de prévente","price":4000,"total_quantity":15,"sold_quantity":0,"sale_start":"2026-11-03T08:00:00+00:00","sale_end":"2026-11-06T18:00:00+0
        → 'Prévente',
        → 'Tarif de prévente',
        → 4000,
    not ok 2 - max_per_order 0, prix 1500,5 ou clé inconnue (sold_quantity) → 400 en français, aucune catégorie créée
        → max_per_order 0 : HTTP 400 attendu, reçu 201 {"success":true,"category":{"id":"c53ef9e1-90c5-4c49-b144-4df0b859db54","event_id":"86089189-957b-46ca-8dbf-1985d106132e","name":"Groupe zéro","description":null,"price":2000,"total_quantity":5,"sold_quantity":0,"sale_start":null,"sale_end":null,"is_activ
    not ok 3 - Σ des quotas au-delà de la jauge → QUOTA_ABOVE_CAPACITY, aucune catégorie créée
        → quota 71 au-delà de la jauge de 100 : code QUOTA_ABOVE_CAPACITY attendu : {"success":false,"error":"La somme des quotas de billets (101) dépasse la capacité maximale de l'événement (100)."}
        → + undefined
        → - 'QUOTA_ABOVE_CAPACITY'
    not ok 4 - nom déjà pris (casse différente) → refusé, aucune catégorie créée
        → nom en double : HTTP 400 ou 409 attendu, reçu 201 {"success":true,"category":{"id":"6266fdfc-bf8a-4af7-850c-3b9a66af2d64","event_id":"86089189-957b-46ca-8dbf-1985d106132e","name":"STANDARD","description":null,"price":3000,"total_quantity":5,"sold_quantity":0,"sale_start":null,"sale_end":null,"is_act
not ok 1 - F4 — création : POST /api/partner/events/[id]/categories (ticket_category_create)
    not ok 1 - name, description, dates de vente, max_per_order, is_visible et is_active appliqués (plus rien d’ignoré)
        → champs appliqués : {"id":"e2b27e80-7664-4bdf-b972-cf26fd801e51","event_id":"587652b9-c825-4fa0-96e2-52c2275f4f2e","name":"Standard","description":"Billet plein tarif","price":5000,"total_quantity":10,"sold_quantity":0,"sale_start":null,"sale_end":null,"is_active":false,"created_at":"2026-11-01T03:56
        → +   'Standard',
        → -   'Plein tarif',
        → 'Billet plein tarif',
    ok 2 - prix et quota modifiables sans vente ni réservation (garde-fou)
    not ok 3 - hausse de quota d’une catégorie désactivée : elle reste désactivée (aucune réactivation implicite)
        → la catégorie reste désactivée : aucune modification implicite
        → true !== false
    not ok 4 - clé inconnue (sold_quantity, held_quantity, event_id) → 400 avec le champ refusé, rien n’est modifié
        → clé sold_quantity : HTTP 400 attendu, reçu 200 {"success":true,"category":{"id":"ea32b513-f994-43e3-b526-3541758d9a1a","event_id":"587652b9-c825-4fa0-96e2-52c2275f4f2e","name":"Tardif","description":null,"price":3000,"total_quantity":9,"sold_quantity":0,"sale_start":null,"sale_end":null,"is_active":
    not ok 5 - renommer vers un nom déjà pris (casse différente) → refusé, rien n’est modifié
        → nom en double : HTTP 400 ou 409 attendu, reçu 200 {"success":true,"category":{"id":"ea32b513-f994-43e3-b526-3541758d9a1a","event_id":"587652b9-c825-4fa0-96e2-52c2275f4f2e","name":"Tardif","description":null,"price":3000,"total_quantity":9,"sold_quantity":0,"sale_start":null,"sale_end":null,"is_activ
    not ok 6 - valeurs invalides (quota non numérique, prix décimal, fin de vente avant le début ou après la fin) → refus en français, sans message Postgres
        → quota non numérique : code attendu : {"success":false,"error":"Échec de la mise à jour de la catégorie: null value in column \"total_quantity\" of relation \"ticket_categories\" violates not-null constraint"}
        → + 'undefined'
        → - 'string'
not ok 2 - F4 — modification sans vente : PATCH …/categories/[categoryId] (ticket_category_update)
    not ok 1 - quota sous les vendus → QUOTA_BELOW_SOLD, rien n’est modifié
        → test did not finish before its parent and was cancelled
    not ok 2 - quota sous vendus + réservés → QUOTA_BELOW_HELD, sans message Postgres, rien n’est modifié
        → test did not finish before its parent and was cancelled
    not ok 3 - quota égal à vendus + réservés : accepté (garde-fou)
        → test did not finish before its parent and was cancelled
    not ok 4 - Σ des quotas au-delà de la jauge → QUOTA_ABOVE_CAPACITY, rien n’est modifié
        → test did not finish before its parent and was cancelled
    not ok 5 - prix d’une catégorie vendue → 409 PRICE_LOCKED_AFTER_SALES, rien n’est modifié
        → test did not finish before its parent and was cancelled
    not ok 6 - prix d’une catégorie qui n’a qu’une réservation en cours → 409 PRICE_LOCKED_AFTER_SALES
        → test did not finish before its parent and was cancelled
    not ok 7 - champs non financiers d’une catégorie vendue (nom, description, max_per_order, visibilité) : appliqués
        → test did not finish before its parent and was cancelled
    not ok 8 - prix d’une catégorie sans vente ni réservation : modifiable (garde-fou)
        → test did not finish before its parent and was cancelled
    not ok 9 - suppression d’une catégorie vendue ou réservée → 409 CATEGORY_HAS_SALES, la réponse propose de la désactiver
        → test did not finish before its parent and was cancelled
    not ok 10 - suppression d’une catégorie sans vente ni réservation : effective
        → test did not finish before its parent and was cancelled
not ok 3 - F4 — catégories avec des ventes (événement publié)
        → advanceEventTo(719c5dbd-29cf-4892-a1ab-1b8a7006e0f5, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 9488208c-8a20-43cd-9563-5d86af590bef) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 1 - TERMINE et ANNULE → 409 EVENT_LOCKED pour la création, la modification et la suppression
        → advanceEventTo(59ac5ce6-514d-4a4f-975d-67b77966a61f, TERMINE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 9488208c-8a20-43cd-9563-5d86af590bef) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 2 - partenaire B : création, modification et suppression sur l’événement de A refusées sans effet
        → ../../app/api/partner/events/[id]/categories/[categoryId]/route : gestionnaire DELETE exporté
        → + 'undefined'
        → - 'function'
not ok 4 - F4 — statuts et droits
    not ok 1 - RPC ticket_category_create, _update et _delete : SECURITY DEFINER, search_path = public, (p jsonb) RETURNS jsonb, réservées au service_role
        → fonction ticket_category_create : une seule signature attendue ([])
        → 0 !== 1
    not ok 2 - statique : les routes des catégories passent par les RPC ; DELETE exporté
        → POST /categories (ou EventService) appelle ticket_category_create
not ok 5 - F4 — RPC et routes (catalogue et contrôles statiques)
not ok 6 - /home/runner/work/event-village/event-village/tests/parcours/edition-categories.test.ts
        → events_finish_overdue : Could not find the function public.events_finish_overdue(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.events_finish_overdue with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
# pass 1
# fail 13
```

Run 55 (après correctif) :

```text
    ok 1 - tous les champs appliqués, rien d’ignoré (is_active: false, max_per_order, dates de vente en heure de Dakar)
    ok 2 - max_per_order 0, prix 1500,5 ou clé inconnue (sold_quantity) → 400 en français, aucune catégorie créée
    ok 3 - Σ des quotas au-delà de la jauge → QUOTA_ABOVE_CAPACITY, aucune catégorie créée
    ok 4 - nom déjà pris (casse différente) → refusé, aucune catégorie créée
ok 1 - F4 — création : POST /api/partner/events/[id]/categories (ticket_category_create)
    ok 1 - name, description, dates de vente, max_per_order, is_visible et is_active appliqués (plus rien d’ignoré)
    ok 2 - prix et quota modifiables sans vente ni réservation (garde-fou)
    ok 3 - hausse de quota d’une catégorie désactivée : elle reste désactivée (aucune réactivation implicite)
    ok 4 - clé inconnue (sold_quantity, held_quantity, event_id) → 400 avec le champ refusé, rien n’est modifié
    ok 5 - renommer vers un nom déjà pris (casse différente) → refusé, rien n’est modifié
    ok 6 - valeurs invalides (quota non numérique, prix décimal, fin de vente avant le début ou après la fin) → refus en français, sans message Postgres
ok 2 - F4 — modification sans vente : PATCH …/categories/[categoryId] (ticket_category_update)
    ok 1 - quota sous les vendus → QUOTA_BELOW_SOLD, rien n’est modifié
    ok 2 - quota sous vendus + réservés → QUOTA_BELOW_HELD, sans message Postgres, rien n’est modifié
    ok 3 - quota égal à vendus + réservés : accepté (garde-fou)
    ok 4 - Σ des quotas au-delà de la jauge → QUOTA_ABOVE_CAPACITY, rien n’est modifié
    ok 5 - prix d’une catégorie vendue → 409 PRICE_LOCKED_AFTER_SALES, rien n’est modifié
    ok 6 - prix d’une catégorie qui n’a qu’une réservation en cours → 409 PRICE_LOCKED_AFTER_SALES
    ok 7 - champs non financiers d’une catégorie vendue (nom, description, max_per_order, visibilité) : appliqués
    ok 8 - prix d’une catégorie sans vente ni réservation : modifiable (garde-fou)
    ok 9 - suppression d’une catégorie vendue ou réservée → 409 CATEGORY_HAS_SALES, la réponse propose de la désactiver
    ok 10 - suppression d’une catégorie sans vente ni réservation : effective
ok 3 - F4 — catégories avec des ventes (événement publié)
    ok 1 - TERMINE et ANNULE → 409 EVENT_LOCKED pour la création, la modification et la suppression
    ok 2 - partenaire B : création, modification et suppression sur l’événement de A refusées sans effet
ok 4 - F4 — statuts et droits
    ok 1 - RPC ticket_category_create, _update et _delete : SECURITY DEFINER, search_path = public, (p jsonb) RETURNS jsonb, réservées au service_role
    ok 2 - statique : les routes des catégories passent par les RPC ; DELETE exporté
ok 5 - F4 — RPC et routes (catalogue et contrôles statiques)
# pass 24
# fail 0
```

**ux-performance-and-double-click**

Run 43 (code non corrigé, version du test antérieure à son adaptation dans un commit de correctif : pas un test rouge) :

```text
ok 1 - 1. UX / MUTATION UNIQUE : 1 clic valide déclenche exactement 1 création en base de données
ok 2 - 2. PROTECTION ANTI-DOUBLE CLIC CONCURRENT : 2 clics simultanés sur une réservation de salle -> 1 création, 1 rejet de conflit
# pass 2
# fail 0
```

Run 55 (après correctif) :

```text
ok 1 - 1. UX / MUTATION UNIQUE : 1 clic valide déclenche exactement 1 création en base de données
ok 2 - 2. PROTECTION ANTI-DOUBLE CLIC CONCURRENT : 2 clics simultanés sur une réservation de salle -> 1 création, 1 rejet de conflit
# pass 2
# fail 0
```

### 5.6 — Validation serveur

```text
$ git ls-tree --name-only 214a820 -- lib/validations
lib/validations
(code de sortie 0)

$ git grep -n -E 'z\.object' 214a820 -- app/partner/events/new/page.tsx 'app/partner/events/[id]/edit/page.tsx'
214a820:app/partner/events/[id]/edit/page.tsx:39:const ticketCategorySchema = z.object({
214a820:app/partner/events/[id]/edit/page.tsx:46:const eventFormSchema = z.object({
214a820:app/partner/events/new/page.tsx:55:const ticketCategorySchema = z.object({
214a820:app/partner/events/new/page.tsx:68:const eventFormSchema = z.object({
(code de sortie 0)
```

**Correctif :**
- `lib/validations/event.ts`, partagé par le formulaire et le serveur : dates Dakar, entiers, programme typé, origine de l'affiche, longueurs, clés inconnues refusées ;
- `CHECK` d'entier sur les prix.

**parcours/edition-validation**

Run 43 (avant correctif) :

```text
    not ok 1 - corps complet conforme : accepté, valeurs conservées
        → schéma partagé lib/validations/event.ts introuvable (contrat F1) : Cannot find module '/home/runner/work/event-village/event-village/lib/validations/event' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
    not ok 2 - clés inconnues refusées (.strict), y compris dans une catégorie de billet ; services et statut ne sont pas des champs du formulaire
        → schéma partagé lib/validations/event.ts introuvable (contrat F1) : Cannot find module '/home/runner/work/event-village/event-village/lib/validations/event' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
    not ok 3 - longueurs bornées : titre, description, lieu, ville, infos pratiques, catégorie de billet, programme
        → schéma partagé lib/validations/event.ts introuvable (contrat F1) : Cannot find module '/home/runner/work/event-village/event-village/lib/validations/event' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
    not ok 4 - catégorie d’événement obligatoire, parmi CONCERT, FESTIVAL, FOOD et SALLE
        → schéma partagé lib/validations/event.ts introuvable (contrat F1) : Cannot find module '/home/runner/work/event-village/event-village/lib/validations/event' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
    not ok 5 - coordonnées : latitude de −90 à 90, longitude de −180 à 180
        → schéma partagé lib/validations/event.ts introuvable (contrat F1) : Cannot find module '/home/runner/work/event-village/event-village/lib/validations/event' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
    not ok 6 - montants et quantités entiers et bornés (prix 1500,5 refusé)
        → schéma partagé lib/validations/event.ts introuvable (contrat F1) : Cannot find module '/home/runner/work/event-village/event-village/lib/validations/event' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
    not ok 7 - dates : début obligatoire, end_date exigée si end_time, fin après le début, heures au format HH:mm
        → schéma partagé lib/validations/event.ts introuvable (contrat F1) : Cannot find module '/home/runner/work/event-village/event-village/lib/validations/event' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
    not ok 8 - début dans le futur à la création (EVENT_START_PAST), calculé à Dakar quel que soit le fuseau du processus
        → schéma partagé lib/validations/event.ts introuvable (contrat F1) : Cannot find module '/home/runner/work/event-village/event-village/lib/validations/event' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
    not ok 9 - mise à jour : EVENT_START_PAST seulement si les dates changent ; HH:mm égal à HH:mm:ss n’est pas un changement ; fin comparée au début actuel
        → schéma partagé lib/validations/event.ts introuvable (contrat F1) : Cannot find module '/home/runner/work/event-village/event-village/lib/validations/event' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
    not ok 10 - dates de vente : début < fin ≤ fin de l’événement (datetime-local de Dakar)
        → schéma partagé lib/validations/event.ts introuvable (contrat F1) : Cannot find module '/home/runner/work/event-village/event-village/lib/validations/event' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
    not ok 11 - programme typé : heure HH:mm, type ARTISTE, INTERVENANT ou ACTIVITE, identifiant uuid, au plus 50 lignes
        → schéma partagé lib/validations/event.ts introuvable (contrat F1) : Cannot find module '/home/runner/work/event-village/event-village/lib/validations/event' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
    not ok 12 - programme : lignes vides retirées, tri par jour puis par heure
        → schéma partagé lib/validations/event.ts introuvable (contrat F1) : Cannot find module '/home/runner/work/event-village/event-village/lib/validations/event' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
    not ok 13 - affiche : stockage public-images du projet, dossier du partenaire, sinon IMAGE_ORIGIN_INVALID
        → schéma partagé lib/validations/event.ts introuvable (contrat F1) : Cannot find module '/home/runner/work/event-village/event-village/lib/validations/event' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
not ok 1 - F1 — schéma partagé lib/validations/event.ts
    not ok 1 - POST /api/partner/events : 400 avec la liste des champs en cause, aucun événement créé
        → corps invalide : HTTP 400 attendu, reçu 201 {"success":true,"event":{"id":"4d3eb3e4-87ab-473b-af28-ea91ad05cbac","partner_id":"1c4efc13-ecb9-4fe6-a158-9be0d6f1415e","title":"TEST Validation 403a3168-6b70-4e69-97a1-9335eab49d91 xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx","sl
        → 201 !== 400
    not ok 2 - POST : début passé → EVENT_START_PAST ; affiche externe → IMAGE_ORIGIN_INVALID ; aucun événement créé
        → début hier : HTTP 400 attendu, reçu 201 {"success":true,"event":{"id":"388d618a-88c5-47b3-9b0d-a177ce17e0d7","partner_id":"1c4efc13-ecb9-4fe6-a158-9be0d6f1415e","title":"TEST Validation passé d1f595b6-e511-4822-8ddc-789017e80bc0","slug":"test-validation-pass-d1f595b6-e511-4822-8ddc-789017e80bc0-4092
        → 201 !== 400
    ok 3 - POST : début dans 2 h à Dakar accepté et heure de vente stockée en heure de Dakar, serveur en UTC+14 (garde-fou)
    not ok 4 - PUT : patch invalide → 400 avec les champs, date passée → EVENT_START_PAST, rien n’est modifié
        → programme invalide : HTTP 400 attendu, reçu 200 {"success":true,"event":{"id":"e1d57abc-f0ac-4d5a-a9a6-bbe2d65b8d61","partner_id":"1c4efc13-ecb9-4fe6-a158-9be0d6f1415e","title":"TEST Cycle valid-put 1793505409246","slug":null,"description":"Événement dédié aux tests du cycle de vie (lot 5).","progra
        → 200 !== 400
    not ok 5 - PUT : un événement déjà commencé reste modifiable hors dates, sans EVENT_START_PAST
        → modification appliquée
        → + 'Événement dédié aux tests du cycle de vie (lot 5).'
        → - 'Précision ajoutée pendant l’événement'
    not ok 6 - statique : lib/validations/event importé par EventForm et par le serveur ; aucun schéma local dans les pages
        → components/events/EventForm.tsx absent
    not ok 7 - CHECK en base : un prix non entier est refusé à l’insertion et à la modification d’une catégorie
        → insertion d’un prix de 1500,5 acceptée par la base : [{"id":"9b3d99f8-a6df-4ef2-90a2-72516aa5da5e"}]
not ok 2 - F1 — même schéma côté serveur (routes) et côté formulaire
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/edition-validation.test.ts
        → events_finish_overdue : Could not find the function public.events_finish_overdue(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.events_finish_overdue with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
# pass 1
# fail 19
```

Run 55 (après correctif) :

```text
    ok 1 - corps complet conforme : accepté, valeurs conservées
    ok 2 - clés inconnues refusées (.strict), y compris dans une catégorie de billet ; services et statut ne sont pas des champs du formulaire
    ok 3 - longueurs bornées : titre, description, lieu, ville, infos pratiques, catégorie de billet, programme
    ok 4 - catégorie d’événement obligatoire, parmi CONCERT, FESTIVAL, FOOD et SALLE
    ok 5 - coordonnées : latitude de −90 à 90, longitude de −180 à 180
    ok 6 - montants et quantités entiers et bornés (prix 1500,5 refusé)
    ok 7 - dates : début obligatoire, end_date exigée si end_time, fin après le début, heures au format HH:mm
    ok 8 - début dans le futur à la création (EVENT_START_PAST), calculé à Dakar quel que soit le fuseau du processus
    ok 9 - mise à jour : EVENT_START_PAST seulement si les dates changent ; HH:mm égal à HH:mm:ss n’est pas un changement ; fin comparée au début actuel
    ok 10 - dates de vente : début < fin ≤ fin de l’événement (datetime-local de Dakar)
    ok 11 - programme typé : heure HH:mm, type ARTISTE, INTERVENANT ou ACTIVITE, identifiant uuid, au plus 50 lignes
    ok 12 - programme : lignes vides retirées, tri par jour puis par heure
    ok 13 - affiche : stockage public-images du projet, dossier du partenaire, sinon IMAGE_ORIGIN_INVALID
ok 1 - F1 — schéma partagé lib/validations/event.ts
    ok 1 - POST /api/partner/events : 400 avec la liste des champs en cause, aucun événement créé
    ok 2 - POST : début passé → EVENT_START_PAST ; affiche externe → IMAGE_ORIGIN_INVALID ; aucun événement créé
    ok 3 - POST : début dans 2 h à Dakar accepté et heure de vente stockée en heure de Dakar, serveur en UTC+14 (garde-fou)
    ok 4 - PUT : patch invalide → 400 avec les champs, date passée → EVENT_START_PAST, rien n’est modifié
    ok 5 - PUT : un événement déjà commencé reste modifiable hors dates, sans EVENT_START_PAST
    ok 6 - statique : lib/validations/event importé par EventForm et par le serveur ; aucun schéma local dans les pages
    ok 7 - CHECK en base : un prix non entier est refusé à l’insertion et à la modification d’une catégorie
ok 2 - F1 — même schéma côté serveur (routes) et côté formulaire
# pass 20
# fail 0
```

### 5.7 — Côté admin

```text
$ git ls-tree --name-only -r 214a820 -- app/admin/events app/api/admin/events
app/api/admin/events/[id]/cancel/route.ts
(code de sortie 0)
```

**Correctif :**
- liste et fiche admin (API et écrans) ;
- actions par `event_actions`, motif obligatoire pour refuser et suspendre ;
- motif rendu au partenaire par `last_reason` ;
- navigation « Événements » ;
- services sans écriture de statut.

**parcours/admin-evenements**

Run 43 (avant correctif) :

```text
    not ok 1 - filtre par statut (les 7, ANNULE compris) avec q : exactement les événements de ce statut, total = vérité en base
        → test did not finish before its parent and was cancelled
    not ok 2 - sans statut : tous les statuts ; counts par statut = vérité en base, indépendants du filtre de statut
        → test did not finish before its parent and was cancelled
    not ok 3 - pagination : 20 par défaut, page 2 disjointe, réunion = vérité ; pageSize plafonné à 50
        → test did not finish before its parent and was cancelled
    not ok 4 - recherche q : insensible à la casse ; % et _ pris à la lettre
        → test did not finish before its parent and was cancelled
    not ok 5 - statut inconnu → 400 UNKNOWN_STATUS, message en français, aucune erreur Postgres
        → test did not finish before its parent and was cancelled
    not ok 6 - droits : sans session 401 ; CLIENT, partenaire et ADMIN sans events.read 403 ; ADMIN events.read et SUPERADMIN 200
        → test did not finish before its parent and was cancelled
    not ok 7 - élément de liste : id, titre, statut, date, lieu et organisateur
        → test did not finish before its parent and was cancelled
not ok 1 - 5.7 — GET /api/admin/events : filtres, recherche, pagination, compteurs
        → advanceEventTo(e893addc-1222-430d-818f-8886250da51d, EN_ATTENTE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE a21a51ad-785a-4c35-9b96-05d1b08c4a01) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 1 - affiche, dates, lieu, programme, catégories et prix (masquées et inactives comprises), organisateur et contact, historique, actions
        → test did not finish before its parent and was cancelled
    not ok 2 - événement inconnu → 404 ; droits : 401 sans session, 403 CLIENT, partenaire propriétaire et ADMIN sans events.read
        → test did not finish before its parent and was cancelled
not ok 2 - 5.7 — GET /api/admin/events/[id] : fiche complète avant validation
        → advanceEventTo(6735e0b2-0d58-4f49-ac8f-aa9117af67ee, EN_ATTENTE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE a21a51ad-785a-4c35-9b96-05d1b08c4a01) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 1 - valider : EN_ATTENTE → VALIDE, journalisé (ADMIN, acteur, canal TRANSITION)
        → advanceEventTo(268899c0-45a0-4a47-9ab4-97f9eb928b77, EN_ATTENTE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE a21a51ad-785a-4c35-9b96-05d1b08c4a01) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 2 - refuser : motif obligatoire (absent, vide ou < 3 caractères → REASON_REQUIRED, statut inchangé), puis refus motivé → BROUILLON
        → advanceEventTo(52432641-7029-45fe-ad85-0ccb0f4647cb, EN_ATTENTE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE a21a51ad-785a-4c35-9b96-05d1b08c4a01) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 3 - suspendre (PUBLIE → SUSPENDU, motif obligatoire) puis réactiver (SUSPENDU → PUBLIE)
        → advanceEventTo(457dd35f-853d-4d00-b57d-5bd202af039e, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE a21a51ad-785a-4c35-9b96-05d1b08c4a01) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 4 - terminer : PUBLIE commencé → TERMINE (fin manuelle, canal TRANSITION)
        → advanceEventTo(f4f16baf-5991-45ba-83e8-db328df11096, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE a21a51ad-785a-4c35-9b96-05d1b08c4a01) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 5 - annuler : POST /api/admin/events/[id]/cancel exige le titre retapé (TITLE_MISMATCH), puis ANNULE journalisé (canal CANCELLATION)
        → advanceEventTo(c53ae7ad-900e-41ab-bad7-0a7b42dae0c4, VALIDE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE a21a51ad-785a-4c35-9b96-05d1b08c4a01) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 6 - ADMIN avec events.read seul : 403 sur /transition, statut inchangé, aucune ligne d’historique
        → advanceEventTo(dd5fb180-dd3b-4dd7-a787-c06acd52ef9b, EN_ATTENTE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE a21a51ad-785a-4c35-9b96-05d1b08c4a01) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 7 - refus explicites : statut inconnu 400 UNKNOWN_STATUS ; ANNULE par /transition CANCELLATION_REQUIRED ; hors table 409 TRANSITION_NOT_ALLOWED ; événement inconnu 404
        → Cannot find module '/home/runner/work/event-village/event-village/app/api/admin/events/[id]/transition/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts
not ok 3 - 5.7 — actions admin par statut (transition D4, annulation D6)
    not ok 1 - partenaire propriétaire : soumettre, retirer, publier selon le statut ; can_edit et can_cancel
        → test did not finish before its parent and was cancelled
    not ok 2 - admin (SUPERADMIN et ADMIN) : valider, refuser, publier, suspendre, terminer, réactiver ; jamais can_edit
        → test did not finish before its parent and was cancelled
    not ok 3 - partenaire tiers et client : aucune action, aucun droit, aucun motif
        → test did not finish before its parent and was cancelled
not ok 4 - D5 — event_actions : actions exactes par statut et par rôle
        → advanceEventTo(f516e4a2-0e94-4f19-97ab-ae332c2c6764, EN_ATTENTE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE a21a51ad-785a-4c35-9b96-05d1b08c4a01) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 1 - refus : motif dans l’historique et la fiche admin, rendu au propriétaire (pas au tiers), plus rendu après resoumission ou retrait ; le dernier refus fait foi
        → advanceEventTo(ecf902a9-5a9c-4d93-8861-a256178588c3, EN_ATTENTE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE a21a51ad-785a-4c35-9b96-05d1b08c4a01) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 2 - suspension : motif rendu au propriétaire, effacé à la réactivation, le dernier motif fait foi
        → advanceEventTo(924e5d6e-225d-40cb-9de1-66ec513e6fd7, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE a21a51ad-785a-4c35-9b96-05d1b08c4a01) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 5 - 5.7 — motifs de refus et de suspension : persistés, rendus au partenaire, effacés quand le statut n’en découle plus
    not ok 1 - app/admin/events/page.tsx : StatusBadge, Tabs (par statut), Pagination ; lit /api/admin/events ; états chargement, vide, erreur avec « Réessayer »
        → app/admin/events/page.tsx absent
    not ok 2 - app/admin/events/[id]/page.tsx : StatusBadge, ReasonDialog (refuser, suspendre), POST …/transition, historique, lien depuis la liste
        → app/admin/events/[id]/page.tsx absent
    not ok 3 - navigation admin : « Événements » → /admin/events dans le menu et dans la barre du bas ; aucune entrée en double
        → barre du bas admin sans « Événements » → /admin/events (entrées trouvées : [])
    not ok 4 - app/admin/services/page.tsx n’écrit plus le statut d’un événement (PATCH table events retiré)
        → app/admin/services/page.tsx : changement de statut d'événement depuis l'onglet services
not ok 6 - 5.7 — écrans admin (contrôles statiques)
not ok 7 - /home/runner/work/event-village/event-village/tests/parcours/admin-evenements.test.ts
        → events_finish_overdue : Could not find the function public.events_finish_overdue(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.events_finish_overdue with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
# pass 0
# fail 13
```

Run 55 (après correctif) :

```text
    ok 1 - filtre par statut (les 7, ANNULE compris) avec q : exactement les événements de ce statut, total = vérité en base
    ok 2 - sans statut : tous les statuts ; counts par statut = vérité en base, indépendants du filtre de statut
    ok 3 - pagination : 20 par défaut, page 2 disjointe, réunion = vérité ; pageSize plafonné à 50
    ok 4 - recherche q : insensible à la casse ; % et _ pris à la lettre
    ok 5 - statut inconnu → 400 UNKNOWN_STATUS, message en français, aucune erreur Postgres
    ok 6 - droits : sans session 401 ; CLIENT, partenaire et ADMIN sans events.read 403 ; ADMIN events.read et SUPERADMIN 200
    ok 7 - élément de liste : id, titre, statut, date, lieu et organisateur
ok 1 - 5.7 — GET /api/admin/events : filtres, recherche, pagination, compteurs
    ok 1 - affiche, dates, lieu, programme, catégories et prix (masquées et inactives comprises), organisateur et contact, historique, actions
    ok 2 - événement inconnu → 404 ; droits : 401 sans session, 403 CLIENT, partenaire propriétaire et ADMIN sans events.read
ok 2 - 5.7 — GET /api/admin/events/[id] : fiche complète avant validation
    ok 1 - valider : EN_ATTENTE → VALIDE, journalisé (ADMIN, acteur, canal TRANSITION)
    ok 2 - refuser : motif obligatoire (absent, vide ou < 3 caractères → REASON_REQUIRED, statut inchangé), puis refus motivé → BROUILLON
    ok 3 - suspendre (PUBLIE → SUSPENDU, motif obligatoire) puis réactiver (SUSPENDU → PUBLIE)
    ok 4 - terminer : PUBLIE commencé → TERMINE (fin manuelle, canal TRANSITION)
    ok 5 - annuler : POST /api/admin/events/[id]/cancel exige le titre retapé (TITLE_MISMATCH), puis ANNULE journalisé (canal CANCELLATION)
    ok 6 - ADMIN avec events.read seul : 403 sur /transition, statut inchangé, aucune ligne d’historique
    ok 7 - refus explicites : statut inconnu 400 UNKNOWN_STATUS ; ANNULE par /transition CANCELLATION_REQUIRED ; hors table 409 TRANSITION_NOT_ALLOWED ; événement inconnu 404
ok 3 - 5.7 — actions admin par statut (transition D4, annulation D6)
    ok 1 - partenaire propriétaire : soumettre, retirer, publier selon le statut ; can_edit et can_cancel
    ok 2 - admin (SUPERADMIN et ADMIN) : valider, refuser, publier, suspendre, terminer, réactiver ; jamais can_edit
    ok 3 - partenaire tiers et client : aucune action, aucun droit, aucun motif
ok 4 - D5 — event_actions : actions exactes par statut et par rôle
    ok 1 - refus : motif dans l’historique et la fiche admin, rendu au propriétaire (pas au tiers), plus rendu après resoumission ou retrait ; le dernier refus fait foi
    ok 2 - suspension : motif rendu au propriétaire, effacé à la réactivation, le dernier motif fait foi
ok 5 - 5.7 — motifs de refus et de suspension : persistés, rendus au partenaire, effacés quand le statut n’en découle plus
    ok 1 - app/admin/events/page.tsx : StatusBadge, Tabs (par statut), Pagination ; lit /api/admin/events ; états chargement, vide, erreur avec « Réessayer »
    ok 2 - app/admin/events/[id]/page.tsx : StatusBadge, ReasonDialog (refuser, suspendre), POST …/transition, historique, lien depuis la liste
    ok 3 - navigation admin : « Événements » → /admin/events dans le menu et dans la barre du bas ; aucune entrée en double
    ok 4 - app/admin/services/page.tsx n’écrit plus le statut d’un événement (PATCH table events retiré)
ok 6 - 5.7 — écrans admin (contrôles statiques)
# pass 25
# fail 0
```

### 5.8 — Annulation dans l'interface

```text
$ git grep -n -E 'practical_info|cancellation' 214a820 -- lib/events/event-cancellation.service.ts
214a820:lib/events/event-cancellation.service.ts:21:    cancellationId: string;
214a820:lib/events/event-cancellation.service.ts:99:                practical_info,
214a820:lib/events/event-cancellation.service.ts:130:        const isAlreadyCancelled = event.status === 'ANNULE' || (event.status === 'SUSPENDU' && (event.practical_info as any)?.cancellation);
214a820:lib/events/event-cancellation.service.ts:144:        let cancellationId = eventId;
214a820:lib/events/event-cancellation.service.ts:147:            const { data: cancellationRecord } = await supabase
214a820:lib/events/event-cancellation.service.ts:148:                .from('event_cancellations')
214a820:lib/events/event-cancellation.service.ts:160:            if (cancellationRecord?.id) {
214a820:lib/events/event-cancellation.service.ts:161:                cancellationId = cancellationRecord.id;
214a820:lib/events/event-cancellation.service.ts:169:            ...((event.practical_info as Record<string, any>) || {}),
214a820:lib/events/event-cancellation.service.ts:170:            cancellation: {
214a820:lib/events/event-cancellation.service.ts:171:                id: cancellationId,
214a820:lib/events/event-cancellation.service.ts:183:                practical_info: updatedPracticalInfo,
214a820:lib/events/event-cancellation.service.ts:196:                    practical_info: updatedPracticalInfo,
214a820:lib/events/event-cancellation.service.ts:308:            cancellationId,
214a820:lib/events/event-cancellation.service.ts:395:        const { data: cancellation } = await supabase
214a820:lib/events/event-cancellation.service.ts:396:            .from('event_cancellations')
214a820:lib/events/event-cancellation.service.ts:403:                users:users!event_cancellations_cancelled_by_fkey (
214a820:lib/events/event-cancellation.service.ts:468:        const canceller = cancellation?.users as any;
214a820:lib/events/event-cancellation.service.ts:477:            cancelledAt: cancellation?.cancelled_at || new Date().toISOString(),
214a820:lib/events/event-cancellation.service.ts:479:                id: cancellation?.cancelled_by || userId,
214a820:lib/events/event-cancellation.service.ts:483:            internalReason: cancellation?.internal_reason || 'Annulation officielle',
214a820:lib/events/event-cancellation.service.ts:484:            publicNotice: cancellation?.public_notice || undefined,
(code de sortie 0)
```

**Correctif :**
- `event_cancel` transactionnelle : titre retapé, une seule annulation, remboursements, motif interne jamais public ;
- impact et avancement ;
- modale `EventCancelDialog` et `RefundProgress`, côté partenaire et côté admin ;
- paiement confirmé sur un événement suspendu ou terminé : remboursé.

**parcours/cycle-annulation**

Run 43 (avant correctif) :

```text
    not ok 1 - SUSPENDU → ANNULE accepté avec remboursements (route partenaire)
        → advanceEventTo(3590e41b-c65c-4714-9ae1-937882299aa0, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE d1d816ac-f9cd-4d53-8ef5-d465b5f7bd1b) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 2 - PUBLIE → ANNULE (route partenaire, titre retapé avec des espaces) et VALIDE → ANNULE (route admin)
        → advanceEventTo(a37bf5fc-df5a-4fdf-907f-31e5e5d14c9a, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE d1d816ac-f9cd-4d53-8ef5-d465b5f7bd1b) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 3 - titre retapé faux → TITLE_MISMATCH, rien d’écrit ; avis public ou motif interne trop courts refusés
        → advanceEventTo(8a33b2d0-5de4-41a8-acc4-82e61580cf4a, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE d1d816ac-f9cd-4d53-8ef5-d465b5f7bd1b) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 4 - ANNULE par event_transition → CANCELLATION_REQUIRED (RPC et route), rien d’écrit
        → advanceEventTo(898d9cd5-5330-4727-9b0e-6e71f766032f, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE d1d816ac-f9cd-4d53-8ef5-d465b5f7bd1b) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 5 - une seule annulation : deux annulations simultanées → une seule acceptée ; UNIQUE(event_id) en base
        → advanceEventTo(ebb7b89d-3116-4315-9186-29ee29fc5a30, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE d1d816ac-f9cd-4d53-8ef5-d465b5f7bd1b) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 6 - practical_info.cancellation n’est plus écrit ; le motif interne reste dans event_cancellations et n’est jamais public
        → advanceEventTo(135153ae-df89-47e9-8c58-1252ffe5eba9, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE d1d816ac-f9cd-4d53-8ef5-d465b5f7bd1b) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 1 - 5.2 / 5.8 Annulation transactionnelle (event_cancel) par statut
    not ok 1 - impact exact sur un jeu connu : 5 billets en ligne, 1 espèces, 1 gratuit, 1 invitation, 4 acheteurs, montants
        → test did not finish before its parent and was cancelled
    not ok 2 - avancement : versés, en cours, en vérification ; « à reprendre » pour l’admin seul ; espèces de l’organisateur
        → test did not finish before its parent and was cancelled
not ok 2 - 5.8 Impact et avancement des remboursements
        → advanceEventTo(60893404-cc58-4f88-a679-94a1e840b503, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE d1d816ac-f9cd-4d53-8ef5-d465b5f7bd1b) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 1 - GET /api/partner/events/[id]/cancellation : 404 pour un client et pour le partenaire B ; 200 pour le propriétaire et l’admin
        → advanceEventTo(131de971-4bd4-4883-b556-70139d92a08b, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE d1d816ac-f9cd-4d53-8ef5-d465b5f7bd1b) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 3 - A6 Lecture de l’impact et de l’avancement réservée au propriétaire et aux admins
    not ok 1 - paiement confirmé après la suspension de l’événement → refusé et remboursé
        → advanceEventTo(769d2306-adb8-40f6-a3fa-dc4cb125b2d9, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE d1d816ac-f9cd-4d53-8ef5-d465b5f7bd1b) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 2 - paiement confirmé après la fin manuelle (TERMINE) → refusé et remboursé
        → advanceEventTo(5ab356d5-2df7-4bac-a078-c173f0043cfe, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE d1d816ac-f9cd-4d53-8ef5-d465b5f7bd1b) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 4 - D6 Paiement confirmé sur un événement suspendu ou terminé
not ok 5 - /home/runner/work/event-village/event-village/tests/parcours/cycle-annulation.test.ts
        → events_finish_overdue : Could not find the function public.events_finish_overdue(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.events_finish_overdue with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
# pass 0
# fail 9
```

Run 55 (après correctif) :

```text
    ok 1 - SUSPENDU → ANNULE accepté avec remboursements (route partenaire)
    ok 2 - PUBLIE → ANNULE (route partenaire, titre retapé avec des espaces) et VALIDE → ANNULE (route admin)
    ok 3 - titre retapé faux → TITLE_MISMATCH, rien d’écrit ; avis public ou motif interne trop courts refusés
    ok 4 - ANNULE par event_transition → CANCELLATION_REQUIRED (RPC et route), rien d’écrit
    ok 5 - une seule annulation : deux annulations simultanées → une seule acceptée ; UNIQUE(event_id) en base
    ok 6 - practical_info.cancellation n’est plus écrit ; le motif interne reste dans event_cancellations et n’est jamais public
ok 1 - 5.2 / 5.8 Annulation transactionnelle (event_cancel) par statut
    ok 1 - impact exact sur un jeu connu : 5 billets en ligne, 1 espèces, 1 gratuit, 1 invitation, 4 acheteurs, montants
    ok 2 - avancement : versés, en cours, en vérification ; « à reprendre » pour l’admin seul ; espèces de l’organisateur
ok 2 - 5.8 Impact et avancement des remboursements
    ok 1 - GET /api/partner/events/[id]/cancellation : 404 pour un client et pour le partenaire B ; 200 pour le propriétaire et l’admin
ok 3 - A6 Lecture de l’impact et de l’avancement réservée au propriétaire et aux admins
    ok 1 - paiement confirmé après la suspension de l’événement → refusé et remboursé
    ok 2 - paiement confirmé après la fin manuelle (TERMINE) → refusé et remboursé
ok 4 - D6 Paiement confirmé sur un événement suspendu ou terminé
# pass 11
# fail 0
```

**parcours/finance-annulation**

Run 43 (code non corrigé, version du test antérieure à son adaptation dans un commit de correctif : pas un test rouge) :

```text
    ok 1 - 3 paiements en ligne, 1 vente espèces, 1 invitation → 3 cashouts au total client, rien pour les deux autres
    ok 2 - fonds déjà retirés par l’organisateur → débit limité au solde, créance et alerte admin
ok 1 - Annulation d’un événement
# pass 2
# fail 0
```

Run 55 (après correctif) :

```text
    ok 1 - 3 paiements en ligne, 1 vente espèces, 1 invitation → 3 cashouts au total client, rien pour les deux autres
    ok 2 - fonds déjà retirés par l’organisateur → débit limité au solde, créance et alerte admin
ok 1 - Annulation d’un événement
# pass 2
# fail 0
```

**parcours/paiement-remboursement**

Run 43 (code non corrigé, version du test antérieure à son adaptation dans un commit de correctif : pas un test rouge) :

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

Run 55 (après correctif) :

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

### 5.9 — Services associés

```text
$ git grep -n -E 'Services|tableBooking|communication' 214a820 -- app/partner/events/new/page.tsx
214a820:app/partner/events/new/page.tsx:127:    // Étape 4 : Services Associés (§34)
214a820:app/partner/events/new/page.tsx:128:    const [services, setServices] = useState({
214a820:app/partner/events/new/page.tsx:130:        tableBooking: false,
214a820:app/partner/events/new/page.tsx:131:        communication: true,
214a820:app/partner/events/new/page.tsx:402:                    { num: 4, label: 'Services (§34)' },
214a820:app/partner/events/new/page.tsx:784:                                4. Services Associés (§34 CDC V3.0)
214a820:app/partner/events/new/page.tsx:794:                                onClick={() => setServices(s => ({ ...s, ticketing: !s.ticketing }))}
214a820:app/partner/events/new/page.tsx:827:                                onClick={() => setServices(s => ({ ...s, tableBooking: !s.tableBooking }))}
214a820:app/partner/events/new/page.tsx:829:                                    services.tableBooking
214a820:app/partner/events/new/page.tsx:835:                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${services.tableBooking ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}>
214a820:app/partner/events/new/page.tsx:841:                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${services.tableBooking ? 'bg-purple-600 border-purple-600' : 'border-slate-300 dark:border-zinc-600'}`}>
214a820:app/partner/events/new/page.tsx:842:                                                {services.tableBooking && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
214a820:app/partner/events/new/page.tsx:848:                                        {services.tableBooking && (
214a820:app/partner/events/new/page.tsx:860:                                onClick={() => setServices(s => ({ ...s, communication: !s.communication }))}
214a820:app/partner/events/new/page.tsx:862:                                    services.communication
214a820:app/partner/events/new/page.tsx:868:                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${services.communication ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}>
214a820:app/partner/events/new/page.tsx:874:                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${services.communication ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 dark:border-zinc-600'}`}>
214a820:app/partner/events/new/page.tsx:875:                                                {services.communication && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
214a820:app/partner/events/new/page.tsx:881:                                        {services.communication && (
(code de sortie 0)
```

**Correctif :** services forcés à la billetterie seule, promotion du partenaire en 403 `SERVICE_UNAVAILABLE`, étape Services retirée.

**parcours/edition-services**

Run 43 (avant correctif) :

```text
    not ok 1 - services forcé à { ticketing: true, tableBooking: false, communication: false } quand le corps n’en a pas
        → services forcé à la seule billetterie : {}
        → + {}
        → -   communication: false,
        → -   tableBooking: false,
    not ok 2 - un champ services en entrée → 400, aucun événement créé (même la valeur imposée)
        → services en entrée (tous les services) : HTTP 400 attendu, reçu 201 {"success":true,"event":{"id":"1710ca2c-2578-4ed8-a49a-657cfc167a57","partner_id":"1c0bb11b-0938-4d4f-ae27-ef609ade31b9","title":"TEST Services entree-tous-les-services 0845bc59","slug":"test-services-entree-tous-les-services-0845bc
        → 201 !== 400
not ok 1 - 5.9 — services associés à la création
    not ok 1 - brouillon du partenaire → 403 SERVICE_UNAVAILABLE, aucune demande créée
        → promotion d’un brouillon : HTTP 403 attendu, reçu 400 {"error":"La promotion ne peut être demandée que pour un événement validé ou publié."}
        → 400 !== 403
    not ok 2 - événement PUBLIÉ du partenaire → 403 SERVICE_UNAVAILABLE, aucune demande, aucune notification
        → advanceEventTo(0a9563c2-6d8c-4ebb-ad7f-a6486a534e20, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE be7b1bf0-3090-4d93-ac78-f09d3907560b) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 2 - 5.9 — promotion indisponible : POST /api/partner/events/[id]/promotion
    not ok 1 - plus d’étape « Services » ni de tables, communication ou promotion dans EventForm et les pages de création et d’édition
        → components/events/EventForm.tsx absent
    ok 2 - rien des services associés côté public ni côté partenaire (garde-fou ; page de pilotage contrôlée si présente)
not ok 3 - 5.9 — interface : billetterie seule (contrôles statiques, commentaires exclus)
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/edition-services.test.ts
        → events_finish_overdue : Could not find the function public.events_finish_overdue(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.events_finish_overdue with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
# pass 1
# fail 5
```

Run 55 (après correctif) :

```text
    ok 1 - services forcé à { ticketing: true, tableBooking: false, communication: false } quand le corps n’en a pas
    ok 2 - un champ services en entrée → 400, aucun événement créé (même la valeur imposée)
ok 1 - 5.9 — services associés à la création
    ok 1 - brouillon du partenaire → 403 SERVICE_UNAVAILABLE, aucune demande créée
    ok 2 - événement PUBLIÉ du partenaire → 403 SERVICE_UNAVAILABLE, aucune demande, aucune notification
ok 2 - 5.9 — promotion indisponible : POST /api/partner/events/[id]/promotion
    ok 1 - plus d’étape « Services » ni de tables, communication ou promotion dans EventForm et les pages de création et d’édition
    ok 2 - rien des services associés côté public ni côté partenaire (garde-fou ; page de pilotage contrôlée si présente)
ok 3 - 5.9 — interface : billetterie seule (contrôles statiques, commentaires exclus)
# pass 6
# fail 0
```

### 5.10 — Page de pilotage

```text
$ git ls-tree --name-only 214a820 -- 'app/partner/events/[id]'
app/partner/events/[id]
(code de sortie 0)

$ git grep -n -E 'reduce\(' 214a820 -- 'app/partner/events/[id]/caisse/page.tsx' app/partner/events/page.tsx
214a820:app/partner/events/[id]/caisse/page.tsx:125:    const totalOpeningFloat = shifts.reduce((acc, s) => acc + (Number(s.opening_float_amount) || 0), 0);
214a820:app/partner/events/[id]/caisse/page.tsx:126:    const totalExpectedCash = shifts.reduce((acc, s) => acc + (Number(s.expected_cash_total) || 0), 0);
214a820:app/partner/events/[id]/caisse/page.tsx:127:    const totalDeclaredCash = shifts.reduce((acc, s) => acc + (Number(s.declared_cash_total) || 0), 0);
214a820:app/partner/events/[id]/caisse/page.tsx:131:        .reduce((acc, s) => acc + (Number(s.discrepancy_amount) || 0), 0);
214a820:app/partner/events/page.tsx:165:    const totalTicketsSold = events.reduce((acc, ev) => {
214a820:app/partner/events/page.tsx:166:        const catSold = ev.ticket_categories?.reduce((s, c) => s + (c.sold_quantity || 0), 0) || 0;
214a820:app/partner/events/page.tsx:169:    const totalRevenue = events.reduce((acc, ev) => {
214a820:app/partner/events/page.tsx:170:        const catRev = ev.ticket_categories?.reduce((s, c) => s + (c.sold_quantity || 0) * Number(c.price || 0), 0) || 0;
214a820:app/partner/events/page.tsx:318:                        const totalSold = ev.ticket_categories?.reduce((s, c) => s + (c.sold_quantity || 0), 0) || 0;
214a820:app/partner/events/page.tsx:319:                        const totalCap = ev.ticket_categories?.reduce((s, c) => s + (c.total_quantity || 0), 0) || ev.capacity || 0;
(code de sortie 0)
```

**Correctif** (migration `…05`) :
- `pilotage_compute_*` et RPC `pilotage_*`, une seule source de vérité ;
- export des participants journalisé dans la même transaction, sans données de paiement, contacts seulement avec une finalité fermée ;
- page à six onglets en direct, avec les anciennes pages Équipe et Caisse redirigées ;
- `cash_sales` corrigé.

**parcours/pilotage-apercu-ventes**

Run 43 (avant correctif) :

```text
    not ok 1 - propriétaire : statut PUBLIE et actions possibles du partenaire, sans aucune action réservée à l’admin
        → test did not finish before its parent and was cancelled
    not ok 2 - billets : vendus hors invitations, invitations à part, capacité = Σ quotas actifs, en cours de paiement, restants
        → test did not finish before its parent and was cancelled
    not ok 3 - chiffre d’affaires : en ligne (grand livre), espèces (paiements hors plateforme, billet impayé exclu), remboursé
        → test did not finish before its parent and was cancelled
    not ok 4 - entrées : scans acceptés dont guichet, taux de présence = entrées / (vendus + invitations)
        → test did not finish before its parent and was cancelled
    not ok 5 - admin : 200 et mêmes chiffres ; l’action « suspendre » lui est proposée avec motif obligatoire
        → test did not finish before its parent and was cancelled
not ok 1 - 5.10 Aperçu : GET …/pilotage/overview
        → advanceEventTo(063f6c97-2427-4816-b515-6fdd1b0bd56a, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE b76593dd-04bd-4c87-8a0b-45a292e96024) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 1 - par catégorie : vendus, en cours de paiement, restants (Standard, VIP, Étudiant) ; catégorie inactive sans vente
        → test did not finish before its parent and was cancelled
    not ok 2 - Σ par catégorie = totaux de l’aperçu (une seule source de vérité)
        → test did not finish before its parent and was cancelled
    not ok 3 - jour par jour en Africa/Dakar : chaque jour = billets vendus émis ce jour-là, Σ = vendus, ordre chronologique
        → test did not finish before its parent and was cancelled
not ok 2 - 5.10 Ventes : GET …/pilotage/sales
        → advanceEventTo(063f6c97-2427-4816-b515-6fdd1b0bd56a, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE b76593dd-04bd-4c87-8a0b-45a292e96024) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/pilotage-apercu-ventes.test.ts
        → invariant financier violé :
        → (d) 6290c03d-7c23-411d-9752-171739a524ed : TICKET : montants financiers absents (facial )
        → +     detail: 'TICKET : montants financiers absents (facial )',
        → +     objet: '6290c03d-7c23-411d-9752-171739a524ed',
# pass 0
# fail 0
```

Run 55 (après correctif) :

```text
    ok 1 - propriétaire : statut PUBLIE et actions possibles du partenaire, sans aucune action réservée à l’admin
    ok 2 - billets : vendus hors invitations, invitations à part, capacité = Σ quotas actifs, en cours de paiement, restants
    ok 3 - chiffre d’affaires : en ligne (grand livre), espèces (paiements hors plateforme, billet impayé exclu), remboursé
    ok 4 - entrées : scans acceptés dont guichet, taux de présence = entrées / (vendus + invitations)
    ok 5 - admin : 200 et mêmes chiffres ; l’action « suspendre » lui est proposée avec motif obligatoire
ok 1 - 5.10 Aperçu : GET …/pilotage/overview
    ok 1 - par catégorie : vendus, en cours de paiement, restants (Standard, VIP, Étudiant) ; catégorie inactive sans vente
    ok 2 - Σ par catégorie = totaux de l’aperçu (une seule source de vérité)
    ok 3 - jour par jour en Africa/Dakar : chaque jour = billets vendus émis ce jour-là, Σ = vendus, ordre chronologique
ok 2 - 5.10 Ventes : GET …/pilotage/sales
# pass 8
# fail 0
```

**parcours/pilotage-entrees**

Run 43 (avant correctif) :

```text
    not ok 1 - total des entrées (scans acceptés), dont guichet, et total des refus
        → test did not finish before its parent and was cancelled
    not ok 2 - par contrôleur : nom, entrées, refus et dernière activité
        → test did not finish before its parent and was cancelled
    not ok 3 - par point d’entrée et par catégorie
        → test did not finish before its parent and was cancelled
    not ok 4 - flux par quart d’heure (Africa/Dakar) : entrées et refus de chaque quart d’heure du jeu
        → test did not finish before its parent and was cancelled
    not ok 5 - refus par motif, libellés français (forbidden compris) ; l’encaissement consommé n’est pas un refus
        → test did not finish before its parent and was cancelled
    not ok 6 - tentatives multiples : le billet tenté 3 fois est signalé avec son numéro ; le couple cash_required → valid est exclu
        → test did not finish before its parent and was cancelled
    not ok 7 - incidents techniques par contrôleur (scan_incidents), sans ceux d’un autre événement
        → test did not finish before its parent and was cancelled
not ok 1 - 5.10 Entrées : GET …/pilotage/entries
        → advanceEventTo(f33a96ec-96c2-47fa-a7fc-31d17ffd77f4, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 6e26c69c-bee4-4bfc-b992-8286e77c0c78) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 1 - le propriétaire abonné reçoit le scan, puis l’API entries le compte ; le partenaire B ne reçoit rien
        → test did not finish before its parent and was cancelled
not ok 2 - 5.10 Entrées en direct (Realtime sur ticket_scans, sans recharger)
        → advanceEventTo(f33a96ec-96c2-47fa-a7fc-31d17ffd77f4, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 6e26c69c-bee4-4bfc-b992-8286e77c0c78) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/pilotage-entrees.test.ts
        → invariant financier violé :
        → (d) 6290c03d-7c23-411d-9752-171739a524ed : TICKET : montants financiers absents (facial )
        → +     detail: 'TICKET : montants financiers absents (facial )',
        → +     objet: '6290c03d-7c23-411d-9752-171739a524ed',
# pass 0
# fail 0
```

Run 55 (après correctif) :

```text
    ok 1 - total des entrées (scans acceptés), dont guichet, et total des refus
    ok 2 - par contrôleur : nom, entrées, refus et dernière activité
    ok 3 - par point d’entrée et par catégorie
    ok 4 - flux par quart d’heure (Africa/Dakar) : entrées et refus de chaque quart d’heure du jeu
    ok 5 - refus par motif, libellés français (forbidden compris) ; l’encaissement consommé n’est pas un refus
    ok 6 - tentatives multiples : le billet tenté 3 fois est signalé avec son numéro ; le couple cash_required → valid est exclu
    ok 7 - incidents techniques par contrôleur (scan_incidents), sans ceux d’un autre événement
ok 1 - 5.10 Entrées : GET …/pilotage/entries
    ok 1 - le propriétaire abonné reçoit le scan, puis l’API entries le compte ; le partenaire B ne reçoit rien
ok 2 - 5.10 Entrées en direct (Realtime sur ticket_scans, sans recharger)
# pass 8
# fail 0
```

**parcours/pilotage-equipe-caisse**

Run 43 (avant correctif) :

```text
    not ok 1 - contrôleurs affectés : identifiant d’affectation, nom, point d’entrée, permission espèces ; le contrôleur non affecté absent
        → test did not finish before its parent and was cancelled
not ok 1 - 5.10 Équipe : GET …/pilotage/team
        → advanceEventTo(1f0cb0a2-6637-4cae-afeb-a20985520730, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE b0a23127-ba0f-4747-98cd-c5c5889c3d1f) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 1 - propriétaire : permission espèces de cette seule affectation, journalisée, visible dans l’onglet Équipe
        → test did not finish before its parent and was cancelled
    not ok 2 - partenaire B : 404 sans effet ; admin : refusé ; corps invalide : 400 ; affectation inconnue : 404
        → test did not finish before its parent and was cancelled
not ok 2 - PATCH /api/partner/team/assignments/[id] { canAcceptCash }
        → advanceEventTo(1f0cb0a2-6637-4cae-afeb-a20985520730, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE b0a23127-ba0f-4747-98cd-c5c5889c3d1f) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 1 - caisses ouvertes et clôturées : fonds, espèces encaissées, déclaré hors fonds, écart, justification
        → test did not finish before its parent and was cancelled
    not ok 2 - espèces par contrôleur
        → test did not finish before its parent and was cancelled
    not ok 3 - PIN régisseur : hasPin et date de mise à jour, jamais le haché ; régénération confirmée visible
        → test did not finish before its parent and was cancelled
not ok 3 - 5.10 Caisse : GET …/pilotage/cash
        → advanceEventTo(1f0cb0a2-6637-4cae-afeb-a20985520730, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE b0a23127-ba0f-4747-98cd-c5c5889c3d1f) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/pilotage-equipe-caisse.test.ts
        → invariant financier violé :
        → (d) 6290c03d-7c23-411d-9752-171739a524ed : TICKET : montants financiers absents (facial )
        → +     detail: 'TICKET : montants financiers absents (facial )',
        → +     objet: '6290c03d-7c23-411d-9752-171739a524ed',
# pass 0
# fail 0
```

Run 55 (après correctif) :

```text
    ok 1 - contrôleurs affectés : identifiant d’affectation, nom, point d’entrée, permission espèces ; le contrôleur non affecté absent
ok 1 - 5.10 Équipe : GET …/pilotage/team
    ok 1 - propriétaire : permission espèces de cette seule affectation, journalisée, visible dans l’onglet Équipe
    ok 2 - partenaire B : 404 sans effet ; admin : refusé ; corps invalide : 400 ; affectation inconnue : 404
ok 2 - PATCH /api/partner/team/assignments/[id] { canAcceptCash }
    ok 1 - caisses ouvertes et clôturées : fonds, espèces encaissées, déclaré hors fonds, écart, justification
    ok 2 - espèces par contrôleur
    ok 3 - PIN régisseur : hasPin et date de mise à jour, jamais le haché ; régénération confirmée visible
ok 3 - 5.10 Caisse : GET …/pilotage/cash
# pass 6
# fail 0
```

**parcours/pilotage-cloture-export**

Run 43 (avant correctif) :

```text
    not ok 1 - absents : nombre en direct (billets VALIDE), aucune liste nominative avant la fin
        → test did not finish before its parent and was cancelled
    not ok 2 - Z de caisse de S1 : déclaré hors fonds, attendu, écart, détail SCAN / GUICHET et par catégorie
        → test did not finish before its parent and was cancelled
    not ok 3 - montant net et plage de disponibilité des fonds (min et max des crédits VENTE de l’événement)
        → test did not finish before its parent and was cancelled
not ok 1 - 5.10 Clôture avant la fin de l’événement : GET …/pilotage/closing
        → advanceEventTo(451826dd-7f73-4f0c-9f66-709de8b732fe, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE e292652a-e262-48cc-b5bf-8531d0323523) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 1 - sans contacts : CSV UTF-8 avec BOM, en-têtes français, nom / catégorie / statut (libellé) / heure d’entrée, sans paiement, numéro, téléphone ni email
        → test did not finish before its parent and was cancelled
    not ok 2 - contacts sans finalité, ou finalité hors de la liste fermée : 400 PURPOSE_REQUIRED, aucun fichier
        → test did not finish before its parent and was cancelled
    not ok 3 - contacts avec une finalité de la liste fermée : téléphone et email ajoutés, toujours sans donnée de paiement
        → test did not finish before its parent and was cancelled
    not ok 4 - chaque export journalisé : acteur, contacts, finalité, nombre de lignes, sans donnée de participant ; l’admin aussi
        → test did not finish before its parent and was cancelled
not ok 2 - 5.10 Export des participants : POST …/participants-export
        → advanceEventTo(451826dd-7f73-4f0c-9f66-709de8b732fe, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE e292652a-e262-48cc-b5bf-8531d0323523) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 1 - après la fin : liste nominative des absents (nom, catégorie), même nombre ; fonds inchangés
        → test did not finish before its parent and was cancelled
not ok 3 - 5.10 Clôture après la fin de l’événement
        → advanceEventTo(451826dd-7f73-4f0c-9f66-709de8b732fe, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE e292652a-e262-48cc-b5bf-8531d0323523) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/pilotage-cloture-export.test.ts
        → invariant financier violé :
        → (d) 6290c03d-7c23-411d-9752-171739a524ed : TICKET : montants financiers absents (facial )
        → +     detail: 'TICKET : montants financiers absents (facial )',
        → +     objet: '6290c03d-7c23-411d-9752-171739a524ed',
# pass 0
# fail 0
```

Run 55 (après correctif) :

```text
    ok 1 - absents : nombre en direct (billets VALIDE), aucune liste nominative avant la fin
    ok 2 - Z de caisse de S1 : déclaré hors fonds, attendu, écart, détail SCAN / GUICHET et par catégorie
    ok 3 - montant net et plage de disponibilité des fonds (min et max des crédits VENTE de l’événement)
ok 1 - 5.10 Clôture avant la fin de l’événement : GET …/pilotage/closing
    ok 1 - sans contacts : CSV UTF-8 avec BOM, en-têtes français, nom / catégorie / statut (libellé) / heure d’entrée, sans paiement, numéro, téléphone ni email
    ok 2 - contacts sans finalité, ou finalité hors de la liste fermée : 400 PURPOSE_REQUIRED, aucun fichier
    ok 3 - contacts avec une finalité de la liste fermée : téléphone et email ajoutés, toujours sans donnée de paiement
    ok 4 - chaque export journalisé : acteur, contacts, finalité, nombre de lignes, sans donnée de participant ; l’admin aussi
ok 2 - 5.10 Export des participants : POST …/participants-export
    ok 1 - après la fin : liste nominative des absents (nom, catégorie), même nombre ; fonds inchangés
ok 3 - 5.10 Clôture après la fin de l’événement
# pass 8
# fail 0
```

**parcours/pilotage-acces**

Run 43 (avant correctif) :

```text
    not ok 1 - propriétaire : 200 sur les six onglets et l’export (témoin)
        → test did not finish before its parent and was cancelled
    not ok 2 - partenaire B : 404 sans aucune donnée sur les six onglets et l’export de A ; 200 sur son propre événement (témoin)
        → test did not finish before its parent and was cancelled
    not ok 3 - client (porteur d’un billet de l’événement) : 403 ou 404 ; sans session : 401
        → test did not finish before its parent and was cancelled
    not ok 4 - admin : 200 sur les six onglets et l’export
        → test did not finish before its parent and was cancelled
    not ok 5 - événement inconnu : 404, même pour un partenaire ou un admin
        → test did not finish before its parent and was cancelled
    not ok 6 - compte du partenaire propriétaire SUSPENDU : refusé sur son propre événement, sans donnée
        → test did not finish before its parent and was cancelled
    not ok 7 - participant_exports : lisible par le propriétaire, ni par le partenaire B ni par un client (RLS)
        → test did not finish before its parent and was cancelled
not ok 1 - 5.10 Isolation : le partenaire B ne voit rien de l’événement de A
        → advanceEventTo(799d65ad-2cde-493b-8449-62f77c9d70a0, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 3339381a-4a83-421b-8ff2-89ff7137c2a2) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 1 - onglets du composant partagé Tabs : Aperçu, Ventes, Entrées, Équipe, Caisse, Clôture
        → app/partner/events/[id]/page.tsx absente : la page de pilotage n’existe pas
    not ok 2 - indicateurs KpiCard et temps réel par useRealtimeRefresh (ticket_scans, scan_incidents, controller_shifts)
        → app/partner/events/[id]/page.tsx absent
    not ok 3 - aucun calcul d’agrégat dans le navigateur : ni reduce, ni filter(…).length, ni lecture directe des tables ou des anciennes routes
        → app/partner/events/[id]/page.tsx absent
    not ok 4 - les anciennes pages team et caisse redirigent vers les onglets (?tab=)
        → app/partner/events/[id]/team/page.tsx : redirection attendue (redirect, permanentRedirect ou router.replace)
not ok 2 - 5.10 Page de pilotage app/partner/events/[id]/page.tsx (contrôles statiques)
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/pilotage-acces.test.ts
        → invariant financier violé :
        → (d) 6290c03d-7c23-411d-9752-171739a524ed : TICKET : montants financiers absents (facial )
        → +     detail: 'TICKET : montants financiers absents (facial )',
        → +     objet: '6290c03d-7c23-411d-9752-171739a524ed',
# pass 0
# fail 4
```

Run 55 (après correctif) :

```text
    ok 1 - propriétaire : 200 sur les six onglets et l’export (témoin)
    ok 2 - partenaire B : 404 sans aucune donnée sur les six onglets et l’export de A ; 200 sur son propre événement (témoin)
    ok 3 - client (porteur d’un billet de l’événement) : 403 ou 404 ; sans session : 401
    ok 4 - admin : 200 sur les six onglets et l’export
    ok 5 - événement inconnu : 404, même pour un partenaire ou un admin
    ok 6 - compte du partenaire propriétaire SUSPENDU : refusé sur son propre événement, sans donnée
    ok 7 - participant_exports : lisible par le propriétaire, ni par le partenaire B ni par un client (RLS)
ok 1 - 5.10 Isolation : le partenaire B ne voit rien de l’événement de A
    ok 1 - onglets du composant partagé Tabs : Aperçu, Ventes, Entrées, Équipe, Caisse, Clôture
    ok 2 - indicateurs KpiCard et temps réel par useRealtimeRefresh (ticket_scans, scan_incidents, controller_shifts)
    ok 3 - aucun calcul d’agrégat dans le navigateur : ni reduce, ni filter(…).length, ni lecture directe des tables ou des anciennes routes
    ok 4 - les anciennes pages team et caisse redirigent vers les onglets (?tab=)
ok 2 - 5.10 Page de pilotage app/partner/events/[id]/page.tsx (contrôles statiques)
# pass 11
# fail 0
```

### 5.11 — Liste des événements du partenaire

```text
$ git grep -n -E 'PUBLIE|BROUILLON|EN_ATTENTE' 214a820 -- app/partner/events/page.tsx
214a820:app/partner/events/page.tsx:37:    status: 'BROUILLON' | 'EN_ATTENTE' | 'VALIDE' | 'PUBLIE' | 'SUSPENDU' | 'TERMINE';
214a820:app/partner/events/page.tsx:97:                body: JSON.stringify({ status: 'PUBLIE' }),
214a820:app/partner/events/page.tsx:119:                body: JSON.stringify({ status: 'EN_ATTENTE' }),
214a820:app/partner/events/page.tsx:164:    const publishedEvents = events.filter((e) => e.status === 'PUBLIE').length;
214a820:app/partner/events/page.tsx:255:                        {['TOUS', 'BROUILLON', 'EN_ATTENTE', 'VALIDE', 'PUBLIE', 'SUSPENDU', 'TERMINE'].map((tab) => (
214a820:app/partner/events/page.tsx:391:                                    {ev.status === 'BROUILLON' && (
214a820:app/partner/events/page.tsx:421:                                    {ev.status === 'EN_ATTENTE' && (
214a820:app/partner/events/page.tsx:436:                                    {ev.status === 'PUBLIE' && (
(code de sortie 0)
```

**Correctif :**
- `partner_events_overview`, calculée sur tous les événements ;
- onglets par statut, onglet Annulé compris ;
- actions issues d'`event_actions` ;
- `StatusBadge` et motif affiché ;
- états chargement, vide et erreur.

**parcours/partenaire-liste**

Run 43 (avant correctif) :

```text
    not ok 1 - RPC : counts par statut et totaux = vérité en base = jeu de données connu (1 événement par statut, 5 vendus, 20 000 F en ligne, 3 000 F espèces)
        → test did not finish before its parent and was cancelled
    not ok 2 - route GET /api/partner/events/overview : mêmes chiffres, insensibles au filtre de la liste ; la liste filtrée PUBLIE ne contient qu’un événement
        → test did not finish before its parent and was cancelled
    not ok 3 - isolation : les indicateurs d’un autre partenaire ne comptent pas ses événements ; un client ne lit rien
        → test did not finish before its parent and was cancelled
    not ok 4 - garde-fou : GET /api/partner/events?status=ANNULE renvoie les annulés, sans statut tous les événements
        → test did not finish before its parent and was cancelled
    not ok 5 - GET /api/partner/events : statut inconnu → 400 avec code, jamais l’erreur Postgres
        → test did not finish before its parent and was cancelled
not ok 1 - 5.11 — partner_events_overview : indicateurs calculés sur TOUS les événements
        → advanceEventTo(37419bfa-aff6-4ada-9804-78ed6b5a6342, EN_ATTENTE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 89d65ba9-b721-43f1-af26-2c78aac38e67) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 1 - statuts en libellés humains : StatusBadge du contrat, aucun statut brut rendu
        → app/partner/events/page.tsx : composant StatusBadge absent de components/ui
    not ok 2 - onglets : composant Tabs, libellés de EVENT_STATUS_META, onglet « Annulé », compteurs de l’overview
        → app/partner/events/page.tsx : composant Tabs absent de components/ui
    not ok 3 - actions issues de event_actions : soumettre/retirer/publier par …/transition, Piloter, Modifier (can_edit), Annuler (can_cancel)
        → aucun appel à POST /api/partner/events/[id]/transition
    not ok 4 - motif de refus ou de suspension affiché sur la carte (last_reason, StatusBanner ou Callout)
        → motif (last_reason de event_actions) non lu
    not ok 5 - états : squelette de chargement, EmptyState, ErrorState avec onRetry (« Réessayer »)
        → aucun squelette de chargement
    not ok 6 - indicateurs : KpiCard alimentés par /api/partner/events/overview, aucun calcul dans le navigateur
        → app/partner/events/page.tsx : composant KpiCard absent de components/ui
not ok 2 - 5.11 — app/partner/events/page.tsx (contrôles statiques)
    not ok 1 - liste du partenaire (app/partner/events/page.tsx) : « Annuler l’événement » ouvre une ConfirmDialog avec requireText (titre), impact, avis public, motif interne, POST …/cancel
        → app/partner/events/page.tsx : aucune ConfirmDialog avec requireText
    not ok 2 - pilotage (app/partner/events/[id]/page.tsx) : « Annuler l’événement » ouvre une ConfirmDialog avec requireText (titre), impact, avis public, motif interne, POST …/cancel
        → app/partner/events/[id]/page.tsx absent
    not ok 3 - fiche admin (app/admin/events/[id]/page.tsx) : « Annuler l’événement » ouvre une ConfirmDialog avec requireText (titre), impact, avis public, motif interne, POST …/cancel
        → app/admin/events/[id]/page.tsx absent
    not ok 4 - pilotage (app/partner/events/[id]/page.tsx) : bloc « Remboursements » (versés, en cours, en vérification)
        → app/partner/events/[id]/page.tsx absent
    not ok 5 - fiche admin (app/admin/events/[id]/page.tsx) : bloc « Remboursements » (versés, en cours, en vérification, à reprendre)
        → app/admin/events/[id]/page.tsx absent
not ok 3 - 5.8 — interface de l’annulation (contrôles statiques)
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/partenaire-liste.test.ts
        → invariant financier violé :
        → (d) 6290c03d-7c23-411d-9752-171739a524ed : TICKET : montants financiers absents (facial )
        → +     detail: 'TICKET : montants financiers absents (facial )',
        → +     objet: '6290c03d-7c23-411d-9752-171739a524ed',
# pass 0
# fail 11
```

Run 55 (après correctif) :

```text
    ok 1 - RPC : counts par statut et totaux = vérité en base = jeu de données connu (1 événement par statut, 5 vendus, 20 000 F en ligne, 3 000 F espèces)
    ok 2 - route GET /api/partner/events/overview : mêmes chiffres, insensibles au filtre de la liste ; la liste filtrée PUBLIE ne contient qu’un événement
    ok 3 - isolation : les indicateurs d’un autre partenaire ne comptent pas ses événements ; un client ne lit rien
    ok 4 - garde-fou : GET /api/partner/events?status=ANNULE renvoie les annulés, sans statut tous les événements
    ok 5 - GET /api/partner/events : statut inconnu → 400 avec code, jamais l’erreur Postgres
ok 1 - 5.11 — partner_events_overview : indicateurs calculés sur TOUS les événements
    ok 1 - statuts en libellés humains : StatusBadge du contrat, aucun statut brut rendu
    ok 2 - onglets : composant Tabs, libellés de EVENT_STATUS_META, onglet « Annulé », compteurs de l’overview
    ok 3 - actions issues de event_actions : soumettre/retirer/publier par …/transition, Piloter, Modifier (can_edit), Annuler (can_cancel)
    ok 4 - motif de refus ou de suspension affiché sur la carte (last_reason, StatusBanner ou Callout)
    ok 5 - états : squelette de chargement, EmptyState, ErrorState avec onRetry (« Réessayer »)
    ok 6 - indicateurs : KpiCard alimentés par /api/partner/events/overview, aucun calcul dans le navigateur
ok 2 - 5.11 — app/partner/events/page.tsx (contrôles statiques)
    ok 1 - liste du partenaire (app/partner/events/page.tsx) : « Annuler l’événement » ouvre une ConfirmDialog avec requireText (titre), impact, avis public, motif interne, POST …/cancel
    ok 2 - pilotage (app/partner/events/[id]/page.tsx) : « Annuler l’événement » ouvre une ConfirmDialog avec requireText (titre), impact, avis public, motif interne, POST …/cancel
    ok 3 - fiche admin (app/admin/events/[id]/page.tsx) : « Annuler l’événement » ouvre une ConfirmDialog avec requireText (titre), impact, avis public, motif interne, POST …/cancel
    ok 4 - pilotage (app/partner/events/[id]/page.tsx) : bloc « Remboursements » (versés, en cours, en vérification)
    ok 5 - fiche admin (app/admin/events/[id]/page.tsx) : bloc « Remboursements » (versés, en cours, en vérification, à reprendre)
ok 3 - 5.8 — interface de l’annulation (contrôles statiques)
# pass 16
# fail 0
```

### 5.12 — Invariants du cycle de vie

```text
$ git grep -n -E LIFECYCLE_INVARIANT_SQL 214a820 -- tests/helpers
214a820:tests/helpers/lifecycle-invariants.ts:38:export const LIFECYCLE_INVARIANT_SQL = `
214a820:tests/helpers/lifecycle-invariants.ts:156:    return inspect(async (db) => (await db.query<Violation>(LIFECYCLE_INVARIANT_SQL)).rows);
(code de sortie 0)
```

**Correctif :** aucun code de production. Les règles (j)(k)(l) sont des contrôles des tests (section 4). Les garde-fous `cycle-invariant` et `pilotage-invariant` prouvent que chaque règle détecte une violation fabriquée, dans une transaction annulée.

**parcours/cycle-invariant**

Run 43 (avant correctif) :

```text
    not ok 1 - (j) historique et (k) PUBLIE en retard
        → relation "public.event_status_history" does not exist
    not ok 2 - (l) par les données : billet UTILISE sans scan accepté, caisse sans encaissement correspondant
        → relation "public.event_status_history" does not exist
    not ok 3 - (l) par les fonctions : vendus faussés, caisse manquante, caisse d’un autre événement, clé shifts invalide
        → relation "public.event_status_history" does not exist
not ok 1 - 5.12 Invariant du cycle de vie : chaque règle détecte une violation fabriquée (transaction annulée)
    not ok 1 - (k) un PUBLIE réellement en retard est signalé avant le passage du cron, plus après
        → advanceEventTo(8f65d8dc-d37a-40da-9783-0896d99f0f41, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE a388071e-68c8-4d18-a1bb-4a42da5a21de) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 2 - état propre : après le passage du cron, 0 violation (j)(k)(l)
        → events_finish_overdue : Could not find the function public.events_finish_overdue(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.events_finish_overdue with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 2 - 5.12 Invariant du cycle de vie sur l’état réel
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/cycle-invariant.test.ts
        → events_finish_overdue : Could not find the function public.events_finish_overdue(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.events_finish_overdue with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
# pass 0
# fail 5
```

Run 55 (après correctif) :

```text
    ok 1 - (j) historique et (k) PUBLIE en retard
    ok 2 - (l) par les données : billet UTILISE sans scan accepté, caisse sans encaissement correspondant
    ok 3 - (l) par les fonctions : vendus faussés, caisse manquante, caisse d’un autre événement, clé shifts invalide
ok 1 - 5.12 Invariant du cycle de vie : chaque règle détecte une violation fabriquée (transaction annulée)
    ok 1 - (k) un PUBLIE réellement en retard est signalé avant le passage du cron, plus après
    ok 2 - état propre : après le passage du cron, 0 violation (j)(k)(l)
ok 2 - 5.12 Invariant du cycle de vie sur l’état réel
# pass 5
# fail 0
```

**parcours/pilotage-invariant**

Run 43 (avant correctif) :

```text
    not ok 1 - pilotage_compute_overview(événement) = valeurs calculées à la main
        → test did not finish before its parent and was cancelled
    not ok 2 - pilotage_compute_cash(événement) = valeurs calculées à la main, une entrée par caisse
        → test did not finish before its parent and was cancelled
    not ok 3 - (l) : 0 violation pour l’événement du jeu et ses caisses
        → test did not finish before its parent and was cancelled
not ok 1 - 5.12 (l) sur le jeu de données connu
        → advanceEventTo(40e2436c-60f3-4117-9cf8-7287870b79b8, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE cbbfd59e-d443-454f-8ed2-1346da9e8594) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 1 - billet passé UTILISE sans scan accepté : violation (l) sur l’événement (entrées ≠ billets UTILISE)
        → test did not finish before its parent and was cancelled
    not ok 2 - paiement espèces détaché de sa caisse : violation (l) sur la caisse (espèces ≠ paiements rattachés)
        → test did not finish before its parent and was cancelled
    not ok 3 - garde-fou : les transactions annulées, (l) revient à 0 violation pour le jeu
        → test did not finish before its parent and was cancelled
not ok 2 - 5.12 (l) détecte une divergence fabriquée (transaction annulée)
        → advanceEventTo(40e2436c-60f3-4117-9cf8-7287870b79b8, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE cbbfd59e-d443-454f-8ed2-1346da9e8594) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/pilotage-invariant.test.ts
        → invariant financier violé :
        → (d) 6290c03d-7c23-411d-9752-171739a524ed : TICKET : montants financiers absents (facial )
        → +     detail: 'TICKET : montants financiers absents (facial )',
        → +     objet: '6290c03d-7c23-411d-9752-171739a524ed',
# pass 0
# fail 0
```

Run 55 (après correctif) :

```text
    ok 1 - pilotage_compute_overview(événement) = valeurs calculées à la main
    ok 2 - pilotage_compute_cash(événement) = valeurs calculées à la main, une entrée par caisse
    ok 3 - (l) : 0 violation pour l’événement du jeu et ses caisses
ok 1 - 5.12 (l) sur le jeu de données connu
    ok 1 - billet passé UTILISE sans scan accepté : violation (l) sur l’événement (entrées ≠ billets UTILISE)
    ok 2 - paiement espèces détaché de sa caisse : violation (l) sur la caisse (espèces ≠ paiements rattachés)
    ok 3 - garde-fou : les transactions annulées, (l) revient à 0 violation pour le jeu
ok 2 - 5.12 (l) détecte une divergence fabriquée (transaction annulée)
# pass 6
# fail 0
```

**parcours/finance-retraits**

Run 43 (code non corrigé, version du test antérieure à son adaptation dans un commit de correctif : pas un test rouge) :

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

Run 55 (après correctif) :

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

### 5.13 — Temps réel

```text
$ git grep -n -E 'ADD TABLE' 214a820 -- supabase/migrations
214a820:supabase/migrations/0004_indexes.sql:143:        ALTER PUBLICATION supabase_realtime ADD TABLE orders;
214a820:supabase/migrations/0004_indexes.sql:144:        ALTER PUBLICATION supabase_realtime ADD TABLE payments;
214a820:supabase/migrations/0004_indexes.sql:145:        ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
214a820:supabase/migrations/0004_indexes.sql:146:        ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
214a820:supabase/migrations/0004_indexes.sql:147:        ALTER PUBLICATION supabase_realtime ADD TABLE hall_reservations;
214a820:supabase/migrations/0004_indexes.sql:148:        ALTER PUBLICATION supabase_realtime ADD TABLE table_reservations;
214a820:supabase/migrations/20260907000002_ticket_categories_realtime_replica.sql:15:        ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_categories;
214a820:supabase/migrations/20260907000003_tickets_realtime_replica.sql:15:        ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
214a820:supabase/migrations/20261101000013_lot4_pilotage.sql:77:        ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_scans;
(code de sortie 0)

$ git grep -n -E postgres_changes 214a820 -- app components hooks
214a820:app/controller/scanner/page.tsx:211:            .on('postgres_changes', { event: '*', schema: 'public', table: 'event_controllers', filter: `user_id=eq.${controllerId}` },
214a820:app/controller/scanner/page.tsx:222:            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events' }, (payload: { new: Record<string, unknown> }) => {
214a820:app/controller/scanner/page.tsx:241:            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${controllerId}` },
214a820:app/controller/scanner/page.tsx:260:            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `event_id=eq.${eventId}` },
214a820:app/events/[id]/page.tsx:200:        'postgres_changes',
214a820:app/partner/events/[id]/team/page.tsx:101:                'postgres_changes',
214a820:app/partner/events/[id]/team/page.tsx:117:                'postgres_changes',
214a820:app/partner/orders/page.tsx:150:                'postgres_changes',
214a820:app/partner/team/page.tsx:171:                'postgres_changes',
214a820:app/partner/team/page.tsx:186:                'postgres_changes',
214a820:app/tickets/page.tsx:70:        'postgres_changes',
214a820:components/notifications/NotificationBell.tsx:97:                'postgres_changes',
214a820:hooks/usePartnerOrders.ts:66:                'postgres_changes',
214a820:hooks/usePartnerOrders.ts:79:                'postgres_changes',
214a820:hooks/usePartnerOrders.ts:94:                'postgres_changes',
(code de sortie 0)
```

**Correctif** (migration `…06`) :
- `public_event_state` et `public_category_stock` (tranches) tenues par triggers différés ;
- `admin_signals` ;
- publication complétée, RLS vérifiée ;
- colonnes secrètes des billets non diffusées ;
- hook partagé `useRealtimeRefresh` et `LiveIndicator` sur les neuf écrans ;
- compteur des notifications PUSH.

**parcours/temps-reel-public**

Run 43 (avant correctif) :

```text
    not ok 1 - VALIDE → PUBLIE : anon abonné à public_event_state reçoit la ligne (prix « à partir de » des seules catégories actives et visibles) et le catalogue rechargé contient l’événement
        → test did not finish before its parent and was cancelled
not ok 1 - Publication d’un événement : visible dans le catalogue ouvert, sans recharger (O4)
        → advanceEventTo(861edac3-d938-4935-a449-7348de71eb63, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 27afaa8d-2a06-4798-b0ec-7caba5ae54d7) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 1 - PUBLIE → SUSPENDU → PUBLIE → ANNULE : chaque statut arrive à anon, sans le motif de suspension ni le motif interne ; l’événement annulé sort du catalogue
        → test did not finish before its parent and was cancelled
    not ok 2 - fin automatique (cron events_finish_overdue) : TERMINE diffusé à anon, l’événement sort du catalogue
        → test did not finish before its parent and was cancelled
not ok 2 - Suspension, réactivation, annulation et fin : diffusées à anon avec leur statut
        → advanceEventTo(861edac3-d938-4935-a449-7348de71eb63, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 27afaa8d-2a06-4798-b0ec-7caba5ae54d7) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 1 - création BROUILLON, modification, soumission EN_ATTENTE, validation VALIDE : rien sur public_event_state, aucune ligne en base, rien sur events
        → test did not finish before its parent and was cancelled
    not ok 2 - ticket_categories : anon ne reçoit rien des catégories d’un événement non public, ni d’une catégorie masquée d’un événement publié (le propriétaire, témoin, les reçoit)
        → test did not finish before its parent and was cancelled
not ok 3 - Aucun événement non public diffusé à anon (O4)
        → advanceEventTo(861edac3-d938-4935-a449-7348de71eb63, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 27afaa8d-2a06-4798-b0ec-7caba5ae54d7) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 1 - colonnes du contrat O1 et rien d’autre (aucune info pratique, aucun motif, aucun volume de vente)
        → test did not finish before its parent and was cancelled
    not ok 2 - lecture par anon et authenticated ; INSERT, UPDATE et DELETE refusés aux rôles API
        → test did not finish before its parent and was cancelled
not ok 4 - public_event_state : colonnes publiques seulement, lecture publique, aucune écriture par les rôles API
        → advanceEventTo(861edac3-d938-4935-a449-7348de71eb63, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 27afaa8d-2a06-4798-b0ec-7caba5ae54d7) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 5 - /home/runner/work/event-village/event-village/tests/parcours/temps-reel-public.test.ts
        → invariant financier violé :
        → (d) 6290c03d-7c23-411d-9752-171739a524ed : TICKET : montants financiers absents (facial )
        → +     detail: 'TICKET : montants financiers absents (facial )',
        → +     objet: '6290c03d-7c23-411d-9752-171739a524ed',
# pass 0
# fail 0
```

Run 55 (après correctif) :

```text
    ok 1 - VALIDE → PUBLIE : anon abonné à public_event_state reçoit la ligne (prix « à partir de » des seules catégories actives et visibles) et le catalogue rechargé contient l’événement
ok 1 - Publication d’un événement : visible dans le catalogue ouvert, sans recharger (O4)
    ok 1 - PUBLIE → SUSPENDU → PUBLIE → ANNULE : chaque statut arrive à anon, sans le motif de suspension ni le motif interne ; l’événement annulé sort du catalogue
    ok 2 - fin automatique (cron events_finish_overdue) : TERMINE diffusé à anon, l’événement sort du catalogue
ok 2 - Suspension, réactivation, annulation et fin : diffusées à anon avec leur statut
    ok 1 - création BROUILLON, modification, soumission EN_ATTENTE, validation VALIDE : rien sur public_event_state, aucune ligne en base, rien sur events
    ok 2 - ticket_categories : anon ne reçoit rien des catégories d’un événement non public, ni d’une catégorie masquée d’un événement publié (le propriétaire, témoin, les reçoit)
ok 3 - Aucun événement non public diffusé à anon (O4)
    ok 1 - colonnes du contrat O1 et rien d’autre (aucune info pratique, aucun motif, aucun volume de vente)
    ok 2 - lecture par anon et authenticated ; INSERT, UPDATE et DELETE refusés aux rôles API
ok 4 - public_event_state : colonnes publiques seulement, lecture publique, aucune écriture par les rôles API
# pass 7
# fail 0
```

**parcours/temps-reel-stock**

Run 43 (avant correctif) :

```text
    not ok 1 - défaut 10 ; entier de 1 à 1000 ; SUPERADMIN seul ; valeur historisée
        → test did not finish before its parent and was cancelled
not ok 1 - Réglage access.low_stock_threshold (contrat O1)
        → advanceEventTo(bd8efd18-ad54-4644-8070-b3bd5f39dc7d, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 3b4c045d-5b28-4599-abd2-b354f2a3c134) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 1 - colonnes du contrat O1 et rien d’autre (ni vendus, ni réservés, ni quota) ; lisible par anon et authenticated
        → test did not finish before its parent and was cancelled
not ok 2 - public_category_stock : colonnes du contrat, lecture publique
        → advanceEventTo(bd8efd18-ad54-4644-8070-b3bd5f39dc7d, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 3b4c045d-5b28-4599-abd2-b354f2a3c134) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 1 - 14 places, seuil 10 : vente de 3 (AVAILABLE, rien diffusé), de 3 (LOW, restant 8), de 8 (SOLD_OUT) ; anon ne reçoit ni billets, ni paiements, ni réservations
        → test did not finish before its parent and was cancelled
    not ok 2 - seuil réglé à 5 par le SUPERADMIN : 8 places restent AVAILABLE, la vente de 4 diffuse LOW avec le restant 4
        → test did not finish before its parent and was cancelled
not ok 3 - Une vente sous le seuil diffuse LOW à anon, sans aucune ligne de vente
        → advanceEventTo(bd8efd18-ad54-4644-8070-b3bd5f39dc7d, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 3b4c045d-5b28-4599-abd2-b354f2a3c134) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
    not ok 1 - quotas réduits sous le seuil : la catégorie visible d’un événement publié passe en LOW chez anon, les autres ne produisent rien
        → test did not finish before its parent and was cancelled
not ok 4 - Catégorie masquée ou inactive, événement non public : aucune ligne, rien diffusé
        → advanceEventTo(bd8efd18-ad54-4644-8070-b3bd5f39dc7d, PUBLIE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE 3b4c045d-5b28-4599-abd2-b354f2a3c134) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 5 - /home/runner/work/event-village/event-village/tests/parcours/temps-reel-stock.test.ts
        → invariant financier violé :
        → (d) 6290c03d-7c23-411d-9752-171739a524ed : TICKET : montants financiers absents (facial )
        → +     detail: 'TICKET : montants financiers absents (facial )',
        → +     objet: '6290c03d-7c23-411d-9752-171739a524ed',
# pass 0
# fail 0
```

Run 55 (après correctif) :

```text
    ok 1 - défaut 10 ; entier de 1 à 1000 ; SUPERADMIN seul ; valeur historisée
ok 1 - Réglage access.low_stock_threshold (contrat O1)
    ok 1 - colonnes du contrat O1 et rien d’autre (ni vendus, ni réservés, ni quota) ; lisible par anon et authenticated
ok 2 - public_category_stock : colonnes du contrat, lecture publique
    ok 1 - 14 places, seuil 10 : vente de 3 (AVAILABLE, rien diffusé), de 3 (LOW, restant 8), de 8 (SOLD_OUT) ; anon ne reçoit ni billets, ni paiements, ni réservations
    ok 2 - seuil réglé à 5 par le SUPERADMIN : 8 places restent AVAILABLE, la vente de 4 diffuse LOW avec le restant 4
ok 3 - Une vente sous le seuil diffuse LOW à anon, sans aucune ligne de vente
    ok 1 - quotas réduits sous le seuil : la catégorie visible d’un événement publié passe en LOW chez anon, les autres ne produisent rien
ok 4 - Catégorie masquée ou inactive, événement non public : aucune ligne, rien diffusé
# pass 5
# fail 0
```

**parcours/temps-reel-billets**

Run 43 (avant correctif) :

```text
    not ok 1 - garde-fou : le porteur (filtre user_id) reçoit UTILISE au scan ; un autre client et anon ne reçoivent rien
        → délai dépassé (20000 ms) : sentinelle reçue par le porteur — 3 message(s) reçu(s) sur porteur tickets (filtre user_id)
        → UPDATE tickets {"id":"0cfdf7ad-3e3e-429c-b349-adc87311c337","price":3000,"status":"VALIDE","qr_code":"EV-QR-111dc3a446a04f859f0a2141b71559d5","user_id":"7750e13a-1b86-475e-843e-084df128952b","event_id":"61813e91-9bd9-4148-abf9-1a3ea70f95ae","order_id":null,"created_at":"2026-11-01T03:57:46.774348+00
        → UPDATE tickets {"id":"793564f0-0542-469b-810f-05ba5b186288","price":3000,"status":"UTILISE","qr_code":"EV-QR-74e91e737e944ed7a8d448c28b53c502","user_id":"7750e13a-1b86-475e-843e-084df128952b","event_id":"61813e91-9bd9-4148-abf9-1a3ea70f95ae","order_id":null,"created_at":"2026-11-01T03:57:46.774348+0
        → UPDATE tickets {"id":"0cfdf7ad-3e3e-429c-b349-adc87311c337","price":3000,"status":"VALIDE","qr_code":"EV-QR-111dc3a446a04f859f0a2141b71559d5","user_id":"7750e13a-1b86-475e-843e-084df128952b","event_id":"61813e91-9bd9-4148-abf9-1a3ea70f95ae","order_id":null,"created_at":"2026-11-01T03:57:46.774348+00
    not ok 2 - totp_secret et qr_code : non lisibles par authenticated (REVOKE de colonne), absents de la charge reçue par le porteur et par le partenaire
        → anon ne doit pas lire tickets.totp_secret (REVOKE de colonne, contrat O2)
        → true !== false
not ok 1 - Billet composté : statut mis à jour chez son porteur (O4)
    ok 1 - garde-fou : INSERT puis passage à « lue » reçus par le destinataire ; un autre compte et anon ne reçoivent rien
    not ok 2 - compteur de la cloche : GET /api/notifications compte les seules notifications PUSH non lues
        → compteur : notifications PUSH non lues (2), tous canaux : 4 ; reçu 4
        → 4 !== 2
not ok 2 - Notifications : le destinataire seul reçoit les siennes (O2, O5)
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/temps-reel-billets.test.ts
        → invariant financier violé :
        → (d) 6290c03d-7c23-411d-9752-171739a524ed : TICKET : montants financiers absents (facial )
        → +     detail: 'TICKET : montants financiers absents (facial )',
        → +     objet: '6290c03d-7c23-411d-9752-171739a524ed',
# pass 1
# fail 3
```

Run 55 (après correctif) :

```text
    ok 1 - garde-fou : le porteur (filtre user_id) reçoit UTILISE au scan ; un autre client et anon ne reçoivent rien
    ok 2 - totp_secret et qr_code : non lisibles par authenticated (REVOKE de colonne), absents de la charge reçue par le porteur et par le partenaire
ok 1 - Billet composté : statut mis à jour chez son porteur (O4)
    ok 1 - garde-fou : INSERT puis passage à « lue » reçus par le destinataire ; un autre compte et anon ne reçoivent rien
    ok 2 - compteur de la cloche : GET /api/notifications compte les seules notifications PUSH non lues
ok 2 - Notifications : le destinataire seul reçoit les siennes (O2, O5)
# pass 4
# fail 0
```

**parcours/temps-reel-prives**

Run 43 (avant correctif) :

```text
    ok 1 - garde-fou : ticket_scans, ni au partenaire B, ni à un client, ni à anon
    not ok 2 - scan_incidents : reçu par le partenaire propriétaire, ni par le partenaire B, ni par un client, ni par anon
        → incident de scan (table scan_incidents, contrat C8) : Could not find the table 'public.scan_incidents' in the schema cache
        → +   code: 'PGRST205',
        → +   details: null,
        → +   hint: null,
    not ok 3 - controller_shifts : reçu par le partenaire propriétaire et par le contrôleur de la caisse, ni par le partenaire B, ni par un client, ni par anon
        → délai dépassé (30000 ms, 20 action(s)) : vivacité : mise à jour de la caisse reçu par le témoin — 0 message(s) reçu(s)
    not ok 4 - event_status_history : création et soumission reçues par le partenaire propriétaire, ni par le partenaire B, ni par un client, ni par anon
        → délai dépassé (30000 ms, 20 action(s)) : vivacité : création d’un brouillon reçue par le partenaire propriétaire — 0 message(s) reçu(s)
not ok 1 - Tables du pilotage : reçues par le partenaire propriétaire seul
    not ok 1 - PARTNER_REGISTERED à l’inscription d’un partenaire : l’admin le reçoit, ni anon, ni un client, ni un partenaire
        → délai dépassé (30000 ms, 19 action(s)) : vivacité : inscription d’un partenaire reçue par l’admin — 0 message(s) reçu(s)
    not ok 2 - EVENT_SUBMITTED à la soumission d’un événement : l’admin le reçoit, ni anon, ni un client, ni le partenaire qui soumet
        → advanceEventTo(79f7feb2-3b95-464c-b87a-820d351737a2, EN_ATTENTE) : étape BROUILLON → EN_ATTENTE (event_transition, acteur PARTENAIRE fc2af8fd-fb49-4fca-8f81-54f9d50b9a95) : Could not find the function public.event_transition(p) in the schema cache (code PGRST202)
        → +   code: 'PGRST202',
        → +   details: 'Searched for the function public.event_transition with parameter p or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
        → +   hint: null,
not ok 2 - admin_signals : reçus par un admin seulement (O2)
    not ok 1 - pendant un achat, ni le payeur, ni le partenaire, ni un admin, ni anon ne reçoivent de paiement ; payments n’est plus dans supabase_realtime
        → délai dépassé (20000 ms) : sentinelle reçue par le payeur — 4 message(s) reçu(s) sur payeur tickets (témoin)
        → INSERT tickets {"id":"bcd663e8-a9db-4ecf-bb64-a4f592a4d57e","price":2000,"status":"VALIDE","qr_code":"EV-QR-4a144ec08abf4742b5f9e6fafaeeed28","user_id":"eee2980e-ed7f-4f46-b018-f0aae3c16a43","event_id":"200943d4-b8ee-4166-bcf3-2867d9505f69","order_id":null,"created_at":"2026-11-01T04:00:06.123497+00
        → UPDATE tickets {"id":"bcd663e8-a9db-4ecf-bb64-a4f592a4d57e","price":2000,"status":"VALIDE","qr_code":"EV-QR-4a144ec08abf4742b5f9e6fafaeeed28","user_id":"eee2980e-ed7f-4f46-b018-f0aae3c16a43","event_id":"200943d4-b8ee-4166-bcf3-2867d9505f69","order_id":null,"created_at":"2026-11-01T04:00:06.123497+00
        → INSERT tickets {"id":"546223e2-fe89-4a3d-90b9-d0819af54dea","price":2000,"status":"VALIDE","qr_code":"EV-QR-b769f2281add47659b526a69c08e3d9c","user_id":"eee2980e-ed7f-4f46-b018-f0aae3c16a43","event_id":"200943d4-b8ee-4166-bcf3-2867d9505f69","order_id":null,"created_at":"2026-11-01T04:00:06.446707+00
not ok 3 - payments retirée de la publication (A4)
    not ok 1 - les tables du contrat O2 sont publiées ; payments, partners, users et ticket_transfers ne le sont pas
        → tables absentes de la publication : public_event_state, public_category_stock, event_status_history, controller_shifts, scan_incidents, admin_signals
        → +   'public_event_state',
        → +   'public_category_stock',
        → +   'event_status_history',
    not ok 2 - chaque table publiée (et chaque table ajoutée par le contrat) existe, a la RLS activée et une politique SELECT
        → tables du contrat absentes : admin_signals, event_status_history, public_category_stock, public_event_state, scan_incidents
        → +   'admin_signals',
        → +   'event_status_history',
        → +   'public_category_stock',
    not ok 3 - anon ne lit aucune ligne des tables privées ajoutées (event_status_history, controller_shifts, scan_incidents, admin_signals)
        → anon et event_status_history : {"code":"42P01","rows":0} (attendu : refus 42501 ou aucune ligne)
not ok 4 - Publication supabase_realtime : contenu et RLS (O2)
not ok 5 - /home/runner/work/event-village/event-village/tests/parcours/temps-reel-prives.test.ts
        → invariant financier violé :
        → (d) 6290c03d-7c23-411d-9752-171739a524ed : TICKET : montants financiers absents (facial )
        → +     detail: 'TICKET : montants financiers absents (facial )',
        → +     objet: '6290c03d-7c23-411d-9752-171739a524ed',
# pass 1
# fail 9
```

Run 55 (après correctif) :

```text
    ok 1 - garde-fou : ticket_scans, ni au partenaire B, ni à un client, ni à anon
    ok 2 - scan_incidents : reçu par le partenaire propriétaire, ni par le partenaire B, ni par un client, ni par anon
    ok 3 - controller_shifts : reçu par le partenaire propriétaire et par le contrôleur de la caisse, ni par le partenaire B, ni par un client, ni par anon
    ok 4 - event_status_history : création et soumission reçues par le partenaire propriétaire, ni par le partenaire B, ni par un client, ni par anon
ok 1 - Tables du pilotage : reçues par le partenaire propriétaire seul
    ok 1 - PARTNER_REGISTERED à l’inscription d’un partenaire : l’admin le reçoit, ni anon, ni un client, ni un partenaire
    ok 2 - EVENT_SUBMITTED à la soumission d’un événement : l’admin le reçoit, ni anon, ni un client, ni le partenaire qui soumet
ok 2 - admin_signals : reçus par un admin seulement (O2)
    ok 1 - pendant un achat, ni le payeur, ni le partenaire, ni un admin, ni anon ne reçoivent de paiement ; payments n’est plus dans supabase_realtime
ok 3 - payments retirée de la publication (A4)
    ok 1 - les tables du contrat O2 sont publiées ; payments, partners, users et ticket_transfers ne le sont pas
    ok 2 - chaque table publiée (et chaque table ajoutée par le contrat) existe, a la RLS activée et une politique SELECT
    ok 3 - anon ne lit aucune ligne des tables privées ajoutées (event_status_history, controller_shifts, scan_incidents, admin_signals)
ok 4 - Publication supabase_realtime : contenu et RLS (O2)
# pass 10
# fail 0
```

**parcours/temps-reel-hook**

Run 43 (avant correctif) :

```text
    not ok 1 - API du contrat : useRealtimeRefresh({ channelKey, subscriptions, onSignal, enabled }) → { status: live | connecting | offline }
        → hooks/useRealtimeRefresh.ts absent (contrat O3)
    not ok 2 - anti-rebond de 300 ms avant onSignal ; onSignal aussi à la (re)connexion ; états hors ligne suivis
        → hooks/useRealtimeRefresh.ts absent (contrat O3)
    not ok 3 - désabonnement au démontage : removeChannel dans le nettoyage de l’effet
        → hooks/useRealtimeRefresh.ts absent (contrat O3)
not ok 1 - Hook partagé hooks/useRealtimeRefresh.ts (contrat O3)
    not ok 1 - composant exporté, « En direct » et « Hors ligne »
        → components/ui/LiveIndicator.tsx absent (contrat Q)
not ok 2 - Indicateur components/ui/LiveIndicator.tsx (contrat O3, Q)
    not ok 1 - catalogue (app/explore/page.tsx) : useRealtimeRefresh sur public_event_state, LiveIndicator
        → catalogue : aucun appel de useRealtimeRefresh importé de hooks/useRealtimeRefresh.ts — fichiers lus : app/explore/page.tsx, components/events/EventCard.tsx, components/ui/Button.tsx, components/ui/EmptyState.tsx, components/ui/Skeleton.tsx, components/ui/Badge.tsx ; tables par le hook : [] ; abonnem
    not ok 2 - accueil (app/page.tsx) : useRealtimeRefresh sur public_event_state, LiveIndicator
        → accueil : aucun appel de useRealtimeRefresh importé de hooks/useRealtimeRefresh.ts — fichiers lus : app/page.tsx, components/events/EventCard.tsx, components/ui/Button.tsx, components/ui/Skeleton.tsx, components/ui/Badge.tsx ; tables par le hook : [] ; abonnements directs : []
    not ok 3 - page événement (app/events/[id]/page.tsx) : useRealtimeRefresh sur public_event_state, public_category_stock (filtre event_id=eq.), LiveIndicator
        → page événement : aucun appel de useRealtimeRefresh importé de hooks/useRealtimeRefresh.ts — fichiers lus : app/events/[id]/page.tsx, components/ui/EventMap.tsx, components/ui/Button.tsx, components/ui/Skeleton.tsx, components/payment/PaymentModal.tsx, components/ui/Toast.tsx, components/providers/Au
    not ok 4 - Mes billets (app/tickets/page.tsx) : useRealtimeRefresh sur tickets, notifications (filtre user_id=eq.), LiveIndicator
        → Mes billets : aucun appel de useRealtimeRefresh importé de hooks/useRealtimeRefresh.ts — fichiers lus : app/tickets/page.tsx, components/tickets/TicketCard.tsx, components/tickets/TransferModal.tsx, components/tickets/TransferExplainerModal.tsx, components/ui/EmptyState.tsx, components/ui/Button.tsx
    not ok 5 - cloche des notifications (components/notifications/NotificationBell.tsx) : useRealtimeRefresh sur notifications
        → cloche des notifications : aucun appel de useRealtimeRefresh importé de hooks/useRealtimeRefresh.ts — fichiers lus : components/notifications/NotificationBell.tsx, components/providers/AuthProvider.tsx, lib/supabase/client.ts ; tables par le hook : [] ; abonnements directs : [notifications]
    not ok 6 - liste des événements du partenaire (app/partner/events/page.tsx) : useRealtimeRefresh sur event_status_history, LiveIndicator
        → liste des événements du partenaire : aucun appel de useRealtimeRefresh importé de hooks/useRealtimeRefresh.ts — fichiers lus : app/partner/events/page.tsx, components/ui/Button.tsx, components/ui/Badge.tsx, components/ui/Toast.tsx, components/ui/ConfirmDialog.tsx, lib/messages/toast-messages.ts, com
    not ok 7 - page de pilotage (app/partner/events/[id]/page.tsx) : useRealtimeRefresh sur ticket_scans, scan_incidents, controller_shifts (filtre event_id=eq.), LiveIndicator
        → app/partner/events/[id]/page.tsx absent
    not ok 8 - admin : file de validation des événements (app/admin/events/page.tsx) : useRealtimeRefresh sur admin_signals, LiveIndicator
        → app/admin/events/page.tsx absent
    not ok 9 - admin : nouveaux partenaires (app/admin/dashboard/page.tsx) : useRealtimeRefresh sur admin_signals, LiveIndicator
        → admin : nouveaux partenaires : aucun appel de useRealtimeRefresh importé de hooks/useRealtimeRefresh.ts — fichiers lus : app/admin/dashboard/page.tsx, components/ui/Button.tsx, components/ui/Badge.tsx, components/ui/Modal.tsx, components/ui/Toast.tsx, lib/messages/toast-messages.ts ; tables par le h
    not ok 10 - la cloche ne lit plus la colonne inexistante notifications.is_read
        → components/notifications/NotificationBell.tsx lit is_read (colonne absente de notifications : status et read_at) : [{"line":114,"text":"isRead: (n.is_read as boolean) || false,"}]
        → +     line: 114,
        → +     text: 'isRead: (n.is_read as boolean) || false,'
        → - []
not ok 3 - Écrans du contrat O5 : un seul hook partagé
    not ok 1 - chaque table suivie par l’application (postgres_changes direct ou hook) est dans la publication attendue après le lot 5
        → abonnements à des tables hors publication (rien ne serait reçu, ou une table sensible serait à publier) :
        → app/controller/scanner/page.tsx : event_controllers
        → app/controller/scanner/page.tsx : events
        → app/controller/scanner/page.tsx : users
not ok 4 - Aucun abonnement à une table hors de la publication
# pass 0
# fail 15
```

Run 55 (après correctif) :

```text
    ok 1 - API du contrat : useRealtimeRefresh({ channelKey, subscriptions, onSignal, enabled }) → { status: live | connecting | offline }
    ok 2 - anti-rebond de 300 ms avant onSignal ; onSignal aussi à la (re)connexion ; états hors ligne suivis
    ok 3 - désabonnement au démontage : removeChannel dans le nettoyage de l’effet
ok 1 - Hook partagé hooks/useRealtimeRefresh.ts (contrat O3)
    ok 1 - composant exporté, « En direct » et « Hors ligne »
ok 2 - Indicateur components/ui/LiveIndicator.tsx (contrat O3, Q)
    ok 1 - catalogue (app/explore/page.tsx) : useRealtimeRefresh sur public_event_state, LiveIndicator
    ok 2 - accueil (app/page.tsx) : useRealtimeRefresh sur public_event_state, LiveIndicator
    ok 3 - page événement (app/events/[id]/page.tsx) : useRealtimeRefresh sur public_event_state, public_category_stock (filtre event_id=eq.), LiveIndicator
    ok 4 - Mes billets (app/tickets/page.tsx) : useRealtimeRefresh sur tickets, notifications (filtre user_id=eq.), LiveIndicator
    ok 5 - cloche des notifications (components/notifications/NotificationBell.tsx) : useRealtimeRefresh sur notifications
    ok 6 - liste des événements du partenaire (app/partner/events/page.tsx) : useRealtimeRefresh sur event_status_history, LiveIndicator
    ok 7 - page de pilotage (app/partner/events/[id]/page.tsx) : useRealtimeRefresh sur ticket_scans, scan_incidents, controller_shifts (filtre event_id=eq.), LiveIndicator
    ok 8 - admin : file de validation des événements (app/admin/events/page.tsx) : useRealtimeRefresh sur admin_signals, LiveIndicator
    ok 9 - admin : nouveaux partenaires (app/admin/dashboard/page.tsx) : useRealtimeRefresh sur admin_signals, LiveIndicator
    ok 10 - la cloche ne lit plus la colonne inexistante notifications.is_read
ok 3 - Écrans du contrat O5 : un seul hook partagé
    ok 1 - chaque table suivie par l’application (postgres_changes direct ou hook) est dans la publication attendue après le lot 5
ok 4 - Aucun abonnement à une table hors de la publication
# pass 15
# fail 0
```

---

## 3. Captures : écrans capturés et corrections après relecture

En-tête de l'index du run vert (complet dans `docs/lot5-logs/ci-run55-captures-index.txt`, images sur `ci-results`, `runs/55-41335287062/captures/`) :

```text
EVENT VILLAGE — CAPTURES D’ÉCRAN (lot 5, tâche 5.1)
généré le      : 2026-11-01T18:26:53.289Z
run CI         : 55-41335287062 (c20442b8c483d74e3d5b9e4b874c836199e279c8)
format         : <écran>__<mobile|ordinateur>__<clair|sombre>.png — mobile 390×844 DPR 2, ordinateur 1440×900 DPR 1
captures       : 120 / 120 tentative(s)
en échec       : 0 (contrôles bloquants ou erreur)
avertissements : 112 capture(s) concernée(s) (cibles < 44 px, textes < 14 px, axe-core)
Relecture humaine obligatoire : un écran n’est terminé qu’une fois sa capture relue (rapport du lot, section 3).
```

**30 écrans**, chacun en 4 vues : mobile et ordinateur, clair et sombre.

| Écran | Rôle | Adresse | Description |
|---|---|---|---|
| `accueil` | anonyme | `/` | Accueil |
| `admin-evenements` | admin | `/admin/events` | Administration — événements (filtres, pagination) |
| `admin-evenements-en-attente` | admin | `/admin/events?status=EN_ATTENTE` | Administration — file de validation |
| `admin-evenements-erreur` | admin | `/admin/events` | Administration — état d’erreur |
| `admin-fiche-en-attente` | admin | `/admin/events/<id>` | Administration — fiche complète avant validation |
| `admin-fiche-suspendu` | admin | `/admin/events/<id>` | Administration — fiche d’un événement suspendu (motif, réactiver) |
| `catalogue` | anonyme | `/explore` | Catalogue des événements |
| `controleur-scanner` | controleur | `/controller/scanner` | Scanner du contrôleur (caméra simulée) |
| `evenement-annule` | anonyme | `/events/<id>` | Page publique — événement annulé (avis public, remboursement) |
| `evenement-non-public` | anonyme | `/events/<id>` | URL d’un brouillon : page introuvable propre |
| `evenement-publie` | anonyme | `/events/<id>` | Page publique — événement publié (ce soir) |
| `evenement-suspendu` | anonyme | `/events/<id>` | Page publique — événement suspendu (bandeau, sans achat) |
| `evenement-termine` | anonyme | `/events/<id>` | Page publique — événement terminé (archive) |
| `hors-ligne` | anonyme | `/explore` | Indicateur « Hors ligne » (catalogue ouvert, connexion coupée) |
| `mes-billets` | client | `/tickets` | Mes billets (QR masqué) |
| `notifications` | client | `/notifications` | Notifications du client |
| `partenaire-creation` | organisateur | `/partner/events/new` | Création d’un événement (formulaire partagé) |
| `partenaire-edition` | organisateur | `/partner/events/<id>/edit` | Édition d’un événement publié avec ventes (champs verrouillés) |
| `partenaire-evenements` | organisateur | `/partner/events` | Liste des événements de l’organisateur |
| `partenaire-evenements-annules` | organisateur | `/partner/events` | Liste de l’organisateur — onglet Annulé |
| `partenaire-evenements-erreur` | organisateur | `/partner/events` | Liste de l’organisateur — état d’erreur |
| `pilotage-annulation` | organisateur | `/partner/events/<id>` | Modale « Annuler l’événement » (impact, titre à retaper) |
| `pilotage-apercu` | organisateur | `/partner/events/<id>` | Pilotage — Aperçu |
| `pilotage-caisse` | organisateur | `/partner/events/<id>` | Pilotage — Caisse |
| `pilotage-cloture` | organisateur | `/partner/events/<id>` | Pilotage — Clôture et export |
| `pilotage-entrees` | organisateur | `/partner/events/<id>` | Pilotage — Entrées en direct |
| `pilotage-equipe` | organisateur | `/partner/events/<id>` | Pilotage — Équipe |
| `pilotage-erreur` | organisateur | `/partner/events/<id>` | Pilotage — état d’erreur |
| `pilotage-remboursements` | organisateur | `/partner/events/<id>` | Événement annulé — avancement des remboursements |
| `pilotage-ventes` | organisateur | `/partner/events/<id>` | Pilotage — Ventes |

**Relecture.** J'ai regardé moi-même les captures des runs 49, 50, 52, 53 et 54 : pages publiques des quatre statuts, catalogue, accueil, pilotage (aperçu, entrées, clôture, annulation), liste partenaire, formulaire, file et fiche admin, scanner, Mes billets. J'ai aussi relu les captures d'échec de la fumée.

**Ce que j'ai corrigé après les avoir vues :**

| Run | Constat sur la capture | Correction |
|---|---|---|
| 49 | espaces entre les mots qui disparaissent (« réservezet », « Explorerles ») | Plus Jakarta Sans a une espace de 0,17 em, écrasée par le resserrement des titres ; `word-spacing` compensé (`adc1d9c`, preuve avant/après par rendu Chromium) |
| 49 | logo de l'en-tête mobile réduit à trois points | identifiant de dégradé SVG unique par instance (`adc1d9c`) |
| 49 | « Comman… » tronqué dans la barre du bas | libellés courts (`adc1d9c`) |
| 49 | date et catégorie posées sur le texte des affiches | sortis de l'image (`adc1d9c`) |
| 49 | « VALIDE », « REFUND_PROCESSED », « EVENT_STATUS » affichés ; Mes billets à 421 px de large | libellés partagés, actions de la carte en grille (`d1e1c23`) |
| 50 | montants sans séparateur (« 351000 F CFA ») | l'espace fine U+202F est dessinée à 1,4 px par la police : espace insécable U+00A0 (`be41aa5`, `1649123`) |
| 50 | affiche recadrée dans la fiche admin | affiche entière à son ratio (`1649123`) |
| 50 | indicateurs empilés un par ligne en mobile ; onglets coupés sans indice | 2 colonnes ; onglets défilants avec indice (`1649123`) |
| 50 | scanner du contrôleur hors système de design (« ON », majuscules, chasse fixe, ancien orange) | migré (`1649123`) |
| 50 | toast « SUCCÈS » en majuscules | toast sur les tokens, accessible (`be41aa5`) |
| 50 | fiche admin restée « En attente » après la validation (capture d'échec de la fumée) | cache des fetch côté serveur (`7326764`), voir « À lire en premier » |
| 50 et 52 (index) | 104 alertes axe « nom accessible », 60 de contraste, listes de définitions, liens sans nom, boutons d'en-tête à 40 px, contrôles Leaflet de 10 px | corrigés (`be41aa5`, `1649123`, `a00f73b`) ; au run 52, plus aucune règle axe en échec |
| 53 | billet du soir même absent de « À venir » | classement par `event_end_at` (`0d6bab5`) |

**Détails mineurs relevés et laissés en l'état**, en points ouverts :
- les onglets de la file admin défilent en mobile sans l'indice du pilotage ;
- le dégradé de l'indice recouvre un fragment de l'onglet voisin ;
- « Saisie manuelle » passe sur deux lignes dans le scanner.

---

## 4. Requêtes des invariants et leur sortie

Chaque suite du lot qui touche la base vérifie à sa fin, en lecture seule, les invariants dans cet ordre : (a)(b)(c), (d)(e)(f), (g)(h)(i), puis (j)(k)(l) (`tests/helpers/lifecycle-invariants.ts`). Avant (k), la RPC du cron est appelée, comme en production.
- **(j)** Tout événement :
  - a un historique qui commence par NULL → BROUILLON ;
  - forme une chaîne continue ;
  - n'a que des transitions de la table, avec le bon rôle et le bon canal ;
  - a un dernier statut égal à `events.status`.
- **(k)** Aucun PUBLIE n'a une fin (`event_end_at`) dépassée de plus d'une heure.
- **(l)** Les totaux de `pilotage_compute_overview` et `pilotage_compute_cash` (vendus, entrées, espèces par caisse) égalent des requêtes indépendantes.

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
```

Sortie brute, run 55 (`41335287062`, commit `c20442b`), des 29 suites du lot qui touchent la base. Les seules violations affichées, les deux lignes « (l) sur le jeu » et leur détail, viennent du garde-fou `pilotage-invariant`. Il fabrique exprès une divergence dans une transaction annulée, puis vérifie « après annulation : 0 violation ». Chaque suite se termine par « (j)(k)(l) : 0 violation(s) ».

```text
# tests__parcours__admin-evenements.test.ts.log
[INVARIANT] admin-evenements — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] admin-evenements — purge des réservations échues : {"expired":0}
[INVARIANT] admin-evenements — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] admin-evenements — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] admin-evenements — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] admin-evenements — cron events_finish_overdue : 3 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] admin-evenements — (j)(k)(l) : 0 violation(s)
# tests__parcours__cycle-annulation.test.ts.log
[INVARIANT] cycle-annulation — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] cycle-annulation — purge des réservations échues : {"expired":0}
[INVARIANT] cycle-annulation — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] cycle-annulation — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] cycle-annulation — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] cycle-annulation — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] cycle-annulation — (j)(k)(l) : 0 violation(s)
# tests__parcours__cycle-cron.test.ts.log
[INVARIANT] cycle-cron — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] cycle-cron — purge des réservations échues : {"expired":0}
[INVARIANT] cycle-cron — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] cycle-cron — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] cycle-cron — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] cycle-cron — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] cycle-cron — (j)(k)(l) : 0 violation(s)
# tests__parcours__cycle-invariant.test.ts.log
[INVARIANT] cycle-invariant — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] cycle-invariant — purge des réservations échues : {"expired":0}
[INVARIANT] cycle-invariant — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] cycle-invariant — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] cycle-invariant — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] cycle-invariant — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] cycle-invariant — (j)(k)(l) : 0 violation(s)
# tests__parcours__cycle-transitions.test.ts.log
[INVARIANT] cycle-transitions — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] cycle-transitions — purge des réservations échues : {"expired":0}
[INVARIANT] cycle-transitions — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] cycle-transitions — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] cycle-transitions — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] cycle-transitions — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] cycle-transitions — (j)(k)(l) : 0 violation(s)
# tests__parcours__cycle-visibilite.test.ts.log
[INVARIANT] cycle-visibilite — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] cycle-visibilite — purge des réservations échues : {"expired":0}
[INVARIANT] cycle-visibilite — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] cycle-visibilite — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] cycle-visibilite — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] cycle-visibilite — cron events_finish_overdue : 2 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] cycle-visibilite — (j)(k)(l) : 0 violation(s)
# tests__parcours__dette-admin-services.test.ts.log
[INVARIANT] dette-admin-services — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] dette-admin-services — purge des réservations échues : {"expired":0}
[INVARIANT] dette-admin-services — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] dette-admin-services — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] dette-admin-services — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] dette-admin-services — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] dette-admin-services — (j)(k)(l) : 0 violation(s)
# tests__parcours__dette-categories-publiques.test.ts.log
[INVARIANT] dette-categories-publiques — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] dette-categories-publiques — purge des réservations échues : {"expired":0}
[INVARIANT] dette-categories-publiques — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] dette-categories-publiques — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] dette-categories-publiques — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] dette-categories-publiques — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] dette-categories-publiques — (j)(k)(l) : 0 violation(s)
# tests__parcours__dette-cloture-caisse.test.ts.log
[INVARIANT] dette-cloture-caisse — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] dette-cloture-caisse — purge des réservations échues : {"expired":0}
[INVARIANT] dette-cloture-caisse — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] dette-cloture-caisse — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] dette-cloture-caisse — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] dette-cloture-caisse — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] dette-cloture-caisse — (j)(k)(l) : 0 violation(s)
# tests__parcours__dette-guichet.test.ts.log
[INVARIANT] dette-guichet — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] dette-guichet — purge des réservations échues : {"expired":0}
[INVARIANT] dette-guichet — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] dette-guichet — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] dette-guichet — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] dette-guichet — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] dette-guichet — (j)(k)(l) : 0 violation(s)
# tests__parcours__dette-incidents.test.ts.log
[INVARIANT] dette-incidents — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] dette-incidents — purge des réservations échues : {"expired":0}
[INVARIANT] dette-incidents — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] dette-incidents — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] dette-incidents — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] dette-incidents — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] dette-incidents — (j)(k)(l) : 0 violation(s)
# tests__parcours__dette-retrait-controleur.test.ts.log
[INVARIANT] dette-retrait-controleur — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] dette-retrait-controleur — purge des réservations échues : {"expired":0}
[INVARIANT] dette-retrait-controleur — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] dette-retrait-controleur — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] dette-retrait-controleur — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] dette-retrait-controleur — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] dette-retrait-controleur — (j)(k)(l) : 0 violation(s)
# tests__parcours__dette-roles-otp.test.ts.log
[INVARIANT] dette-roles-otp — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] dette-roles-otp — purge des réservations échues : {"expired":0}
[INVARIANT] dette-roles-otp — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] dette-roles-otp — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] dette-roles-otp — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] dette-roles-otp — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] dette-roles-otp — (j)(k)(l) : 0 violation(s)
# tests__parcours__dette-transferts.test.ts.log
[INVARIANT] dette-transferts — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] dette-transferts — purge des réservations échues : {"expired":0}
[INVARIANT] dette-transferts — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] dette-transferts — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] dette-transferts — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] dette-transferts — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] dette-transferts — (j)(k)(l) : 0 violation(s)
# tests__parcours__edition-categories.test.ts.log
[INVARIANT] edition-categories — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] edition-categories — purge des réservations échues : {"expired":0}
[INVARIANT] edition-categories — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] edition-categories — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] edition-categories — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] edition-categories — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] edition-categories — (j)(k)(l) : 0 violation(s)
# tests__parcours__edition-formulaire.test.ts.log
[INVARIANT] edition-formulaire — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] edition-formulaire — purge des réservations échues : {"expired":0}
[INVARIANT] edition-formulaire — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] edition-formulaire — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] edition-formulaire — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] edition-formulaire — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] edition-formulaire — (j)(k)(l) : 0 violation(s)
# tests__parcours__edition-services.test.ts.log
[INVARIANT] edition-services — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] edition-services — purge des réservations échues : {"expired":0}
[INVARIANT] edition-services — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] edition-services — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] edition-services — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] edition-services — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] edition-services — (j)(k)(l) : 0 violation(s)
# tests__parcours__edition-validation.test.ts.log
[INVARIANT] edition-validation — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] edition-validation — purge des réservations échues : {"expired":0}
[INVARIANT] edition-validation — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] edition-validation — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] edition-validation — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] edition-validation — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] edition-validation — (j)(k)(l) : 0 violation(s)
# tests__parcours__partenaire-liste.test.ts.log
[INVARIANT] partenaire-liste — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] partenaire-liste — purge des réservations échues : {"expired":0}
[INVARIANT] partenaire-liste — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] partenaire-liste — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] partenaire-liste — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] partenaire-liste — cron events_finish_overdue : 1 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] partenaire-liste — (j)(k)(l) : 0 violation(s)
# tests__parcours__pilotage-acces.test.ts.log
[INVARIANT] pilotage-acces — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] pilotage-acces — purge des réservations échues : {"expired":0}
[INVARIANT] pilotage-acces — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] pilotage-acces — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] pilotage-acces — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] pilotage-acces — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] pilotage-acces — (j)(k)(l) : 0 violation(s)
# tests__parcours__pilotage-apercu-ventes.test.ts.log
[INVARIANT] pilotage-apercu-ventes — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] pilotage-apercu-ventes — purge des réservations échues : {"expired":0}
[INVARIANT] pilotage-apercu-ventes — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] pilotage-apercu-ventes — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] pilotage-apercu-ventes — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] pilotage-apercu-ventes — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] pilotage-apercu-ventes — (j)(k)(l) : 0 violation(s)
# tests__parcours__pilotage-cloture-export.test.ts.log
[INVARIANT] pilotage-cloture-export — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] pilotage-cloture-export — purge des réservations échues : {"expired":0}
[INVARIANT] pilotage-cloture-export — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] pilotage-cloture-export — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] pilotage-cloture-export — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] pilotage-cloture-export — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] pilotage-cloture-export — (j)(k)(l) : 0 violation(s)
# tests__parcours__pilotage-entrees.test.ts.log
[INVARIANT] pilotage-entrees — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] pilotage-entrees — purge des réservations échues : {"expired":0}
[INVARIANT] pilotage-entrees — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] pilotage-entrees — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] pilotage-entrees — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] pilotage-entrees — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] pilotage-entrees — (j)(k)(l) : 0 violation(s)
# tests__parcours__pilotage-equipe-caisse.test.ts.log
[INVARIANT] pilotage-equipe-caisse — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] pilotage-equipe-caisse — purge des réservations échues : {"expired":0}
[INVARIANT] pilotage-equipe-caisse — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] pilotage-equipe-caisse — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] pilotage-equipe-caisse — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] pilotage-equipe-caisse — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] pilotage-equipe-caisse — (j)(k)(l) : 0 violation(s)
# tests__parcours__pilotage-invariant.test.ts.log
[INVARIANT-CYCLE] pilotage-invariant — jeu connu : 0 violation(s) (l) sur le jeu
[INVARIANT-CYCLE] pilotage-invariant — billet UTILISE sans scan : 1 violation(s) (l) sur le jeu
[INVARIANT-CYCLE]   (l) 2b8d2568-222d-438f-a40c-8b8b189c0f7d : pilotage_compute_overview : entrées 7, billets UTILISE 8
[INVARIANT-CYCLE] pilotage-invariant — paiement espèces détaché : 1 violation(s) (l) sur le jeu
[INVARIANT-CYCLE]   (l) 14c44b1f-d7fc-4af4-8567-8ccb4b315d8d : caisse CLOTURE : espèces au pilotage 2000.00, total attendu 7000.00, paiements rattachés 2000.00
[INVARIANT-CYCLE] pilotage-invariant — après annulation : 0 violation(s) (l) sur le jeu
[INVARIANT] pilotage-invariant — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] pilotage-invariant — purge des réservations échues : {"expired":0}
[INVARIANT] pilotage-invariant — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] pilotage-invariant — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] pilotage-invariant — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] pilotage-invariant — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] pilotage-invariant — (j)(k)(l) : 0 violation(s)
# tests__parcours__temps-reel-billets.test.ts.log
[INVARIANT] temps-reel-billets — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] temps-reel-billets — purge des réservations échues : {"expired":0}
[INVARIANT] temps-reel-billets — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] temps-reel-billets — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] temps-reel-billets — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] temps-reel-billets — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] temps-reel-billets — (j)(k)(l) : 0 violation(s)
# tests__parcours__temps-reel-prives.test.ts.log
[INVARIANT] temps-reel-prives — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] temps-reel-prives — purge des réservations échues : {"expired":0}
[INVARIANT] temps-reel-prives — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] temps-reel-prives — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] temps-reel-prives — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] temps-reel-prives — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] temps-reel-prives — (j)(k)(l) : 0 violation(s)
# tests__parcours__temps-reel-public.test.ts.log
[INVARIANT] temps-reel-public — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] temps-reel-public — purge des réservations échues : {"expired":0}
[INVARIANT] temps-reel-public — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] temps-reel-public — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] temps-reel-public — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] temps-reel-public — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] temps-reel-public — (j)(k)(l) : 0 violation(s)
# tests__parcours__temps-reel-stock.test.ts.log
[INVARIANT] temps-reel-stock — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] temps-reel-stock — purge des réservations échues : {"expired":0}
[INVARIANT] temps-reel-stock — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] temps-reel-stock — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] temps-reel-stock — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] temps-reel-stock — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] temps-reel-stock — (j)(k)(l) : 0 violation(s)
```

---

## 5. Suites legacy touchées

Les suites `tests/legacy/` sont en quarantaine : `npm test` ne les exécute pas, mais elles sont typecheckées. Sortie brute :

```text
$ git diff --stat 640153a c20442b -- tests/legacy
 .../legacy/event-cancellation-and-refunds.test.ts  | 446 +--------------------
 tests/legacy/event-live-editing-and-stock.test.ts  |  24 +-
 2 files changed, 17 insertions(+), 453 deletions(-)
```

- **`event-cancellation-and-refunds`** (commit `832c649`) : les cas 1, 2, 3, 4 et 6 sont supprimés, chacun remplacé par un commentaire `// [lot 5 — cas supprimé] …`. Ils appelaient l'ancienne signature de `cancelEvent`. Ils sont couverts par `cycle-annulation` et `finance-annulation`, sauf le cas 6 (révocation des transferts à l'annulation), noté non couvert. Les cas 5 et 7 sont conservés.
- **`event-live-editing-and-stock`** (commit `6a44397`) : `updateCategoryStockAndStatus` devient `updateTicketCategory`, et `updateEvent` renvoie `{ event }`. C'est un alignement de signature ; les assertions ne changent pas.
- **Assertions devenues fausses dans les autres suites legacy**, en particulier celles des lots 2 et 4 déjà signalées : non modifiées, conformément à la règle.

---

## 6. Sortie brute de `npm run verify`, de `npm run e2e` et CI

Run de référence : **https://github.com/fallouu-mn/event-village/actions/runs/41335287062** (run 55, commit `c20442b`). Sorties complètes dans `docs/lot5-logs/` : `ci-run55-verify.log`, `ci-run55-e2e.log`, `ci-run55-e2e-seed.log`, `ci-run55-captures-index.txt`. Run rouge de référence : `ci-run43-verify.log`.

**`npm run verify`** :

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

[run-tests] 125 suite(s) — garde-fou : tests/helpers/env.ts — délai/suite : 600.0s
[… 11910 lignes de sortie des suites, intégralement dans docs/lot5-logs/ci-run55-verify.log …]
═══════════════════ RÉCAPITULATIF ═══════════════════
Suite                                                Statut   Durée     Code  Journal
tests/auth-rbac.test.ts                              PASS     236ms     0     .test-logs/tests__auth-rbac.test.ts.log
tests/e2e-scenarios.test.ts                          PASS     400ms     0     .test-logs/tests__e2e-scenarios.test.ts.log
tests/fondations-lot0.test.ts                        PASS     371ms     0     .test-logs/tests__fondations-lot0.test.ts.log
tests/notifications-and-documents.test.ts            PASS     181ms     0     .test-logs/tests__notifications-and-documents.test.ts.log
tests/parcours/acces-caisse-pin.test.ts              PASS     2.9s      0     .test-logs/tests__parcours__acces-caisse-pin.test.ts.log
tests/parcours/acces-encaissement.test.ts            PASS     2.9s      0     .test-logs/tests__parcours__acces-encaissement.test.ts.log
tests/parcours/acces-fenetre.test.ts                 PASS     2.2s      0     .test-logs/tests__parcours__acces-fenetre.test.ts.log
tests/parcours/acces-guichet.test.ts                 PASS     1.9s      0     .test-logs/tests__parcours__acces-guichet.test.ts.log
tests/parcours/acces-invariant.test.ts               PASS     418ms     0     .test-logs/tests__parcours__acces-invariant.test.ts.log
tests/parcours/acces-limiteurs.test.ts               PASS     6.9s      0     .test-logs/tests__parcours__acces-limiteurs.test.ts.log
tests/parcours/acces-pilotage.test.ts                PASS     16.2s     0     .test-logs/tests__parcours__acces-pilotage.test.ts.log
tests/parcours/acces-qr.test.ts                      PASS     1.6s      0     .test-logs/tests__parcours__acces-qr.test.ts.log
tests/parcours/acces-reglages.test.ts                PASS     1.2s      0     .test-logs/tests__parcours__acces-reglages.test.ts.log
tests/parcours/acces-scan.test.ts                    PASS     1.8s      0     .test-logs/tests__parcours__acces-scan.test.ts.log
tests/parcours/acces-securite-urgente.test.ts        PASS     1.9s      0     .test-logs/tests__parcours__acces-securite-urgente.test.ts.log
tests/parcours/acces-totp.test.ts                    PASS     1.7s      0     .test-logs/tests__parcours__acces-totp.test.ts.log
tests/parcours/acces-tracabilite.test.ts             PASS     2.4s      0     .test-logs/tests__parcours__acces-tracabilite.test.ts.log
tests/parcours/achat-serveur.test.ts                 PASS     555ms     0     .test-logs/tests__parcours__achat-serveur.test.ts.log
tests/parcours/admin-evenements.test.ts              PASS     3.6s      0     .test-logs/tests__parcours__admin-evenements.test.ts.log
tests/parcours/anonymisation-debogage.test.ts        PASS     671ms     0     .test-logs/tests__parcours__anonymisation-debogage.test.ts.log
tests/parcours/attribution-roles.test.ts             PASS     1.1s      0     .test-logs/tests__parcours__attribution-roles.test.ts.log
tests/parcours/bootstrap-superadmin.test.ts          PASS     504ms     0     .test-logs/tests__parcours__bootstrap-superadmin.test.ts.log
tests/parcours/changement-role-admin.test.ts         PASS     848ms     0     .test-logs/tests__parcours__changement-role-admin.test.ts.log
tests/parcours/cycle-annulation.test.ts              PASS     11.9s     0     .test-logs/tests__parcours__cycle-annulation.test.ts.log
tests/parcours/cycle-cron.test.ts                    PASS     1.8s      0     .test-logs/tests__parcours__cycle-cron.test.ts.log
tests/parcours/cycle-invariant.test.ts               PASS     1.1s      0     .test-logs/tests__parcours__cycle-invariant.test.ts.log
tests/parcours/cycle-transitions.test.ts             PASS     12.4s     0     .test-logs/tests__parcours__cycle-transitions.test.ts.log
tests/parcours/cycle-visibilite.test.ts              PASS     1.2s      0     .test-logs/tests__parcours__cycle-visibilite.test.ts.log
tests/parcours/design-systeme.test.ts                PASS     1.2s      0     .test-logs/tests__parcours__design-systeme.test.ts.log
tests/parcours/dette-admin-services.test.ts          PASS     1.2s      0     .test-logs/tests__parcours__dette-admin-services.test.ts.log
tests/parcours/dette-categories-publiques.test.ts    PASS     1.6s      0     .test-logs/tests__parcours__dette-categories-publiques.test.ts.log
tests/parcours/dette-cloture-caisse.test.ts          PASS     3.2s      0     .test-logs/tests__parcours__dette-cloture-caisse.test.ts.log
tests/parcours/dette-guichet.test.ts                 PASS     1.3s      0     .test-logs/tests__parcours__dette-guichet.test.ts.log
tests/parcours/dette-incidents.test.ts               PASS     7.4s      0     .test-logs/tests__parcours__dette-incidents.test.ts.log
tests/parcours/dette-retrait-controleur.test.ts      PASS     2.1s      0     .test-logs/tests__parcours__dette-retrait-controleur.test.ts.log
tests/parcours/dette-roles-otp.test.ts               PASS     1.5s      0     .test-logs/tests__parcours__dette-roles-otp.test.ts.log
tests/parcours/dette-transferts.test.ts              PASS     1.3s      0     .test-logs/tests__parcours__dette-transferts.test.ts.log
tests/parcours/documents-inscription.test.ts         PASS     1.7s      0     .test-logs/tests__parcours__documents-inscription.test.ts.log
tests/parcours/edition-categories.test.ts            PASS     2.1s      0     .test-logs/tests__parcours__edition-categories.test.ts.log
tests/parcours/edition-formulaire.test.ts            PASS     4.3s      0     .test-logs/tests__parcours__edition-formulaire.test.ts.log
tests/parcours/edition-services.test.ts              PASS     817ms     0     .test-logs/tests__parcours__edition-services.test.ts.log
tests/parcours/edition-validation.test.ts            PASS     885ms     0     .test-logs/tests__parcours__edition-validation.test.ts.log
tests/parcours/email-optionnel.test.ts               PASS     860ms     0     .test-logs/tests__parcours__email-optionnel.test.ts.log
tests/parcours/filtres-postgrest.test.ts             PASS     467ms     0     .test-logs/tests__parcours__filtres-postgrest.test.ts.log
tests/parcours/finance-affichage.test.ts             PASS     1.2s      0     .test-logs/tests__parcours__finance-affichage.test.ts.log
tests/parcours/finance-annulation.test.ts            PASS     2.1s      0     .test-logs/tests__parcours__finance-annulation.test.ts.log
tests/parcours/finance-cibles.test.ts                PASS     1.4s      0     .test-logs/tests__parcours__finance-cibles.test.ts.log
tests/parcours/finance-commissions.test.ts           PASS     4.4s      0     .test-logs/tests__parcours__finance-commissions.test.ts.log
tests/parcours/finance-hors-plateforme.test.ts       PASS     1.3s      0     .test-logs/tests__parcours__finance-hors-plateforme.test.ts.log
tests/parcours/finance-invariant.test.ts             PASS     429ms     0     .test-logs/tests__parcours__finance-invariant.test.ts.log
tests/parcours/finance-moteur.test.ts                PASS     1.3s      0     .test-logs/tests__parcours__finance-moteur.test.ts.log
tests/parcours/finance-rapports.test.ts              PASS     1.3s      0     .test-logs/tests__parcours__finance-rapports.test.ts.log
tests/parcours/finance-reglages.test.ts              PASS     1.3s      0     .test-logs/tests__parcours__finance-reglages.test.ts.log
tests/parcours/finance-remboursement-billet.test.ts  PASS     1.7s      0     .test-logs/tests__parcours__finance-remboursement-billet.test.ts.log
tests/parcours/finance-retraits.test.ts              PASS     6.0s      0     .test-logs/tests__parcours__finance-retraits.test.ts.log
tests/parcours/invitation-identite.test.ts           PASS     1.3s      0     .test-logs/tests__parcours__invitation-identite.test.ts.log
tests/parcours/otp-hachage.test.ts                   PASS     403ms     0     .test-logs/tests__parcours__otp-hachage.test.ts.log
tests/parcours/otp-objet.test.ts                     PASS     1.3s      0     .test-logs/tests__parcours__otp-objet.test.ts.log
tests/parcours/otp-serveur.test.ts                   PASS     712ms     0     .test-logs/tests__parcours__otp-serveur.test.ts.log
tests/parcours/paiement-confirmation.test.ts         PASS     1.4s      0     .test-logs/tests__parcours__paiement-confirmation.test.ts.log
tests/parcours/paiement-controles.test.ts            PASS     1.8s      0     .test-logs/tests__parcours__paiement-controles.test.ts.log
tests/parcours/paiement-gratuits.test.ts             PASS     1.2s      0     .test-logs/tests__parcours__paiement-gratuits.test.ts.log
tests/parcours/paiement-operateur.test.ts            PASS     801ms     0     .test-logs/tests__parcours__paiement-operateur.test.ts.log
tests/parcours/paiement-reconciliation.test.ts       PASS     1.3s      0     .test-logs/tests__parcours__paiement-reconciliation.test.ts.log
tests/parcours/paiement-remboursement.test.ts        PASS     1.8s      0     .test-logs/tests__parcours__paiement-remboursement.test.ts.log
tests/parcours/paiement-reservation.test.ts          PASS     1.8s      0     .test-logs/tests__parcours__paiement-reservation.test.ts.log
tests/parcours/paiement-retour.test.ts               PASS     625ms     0     .test-logs/tests__parcours__paiement-retour.test.ts.log
tests/parcours/paiement-statut.test.ts               PASS     1.2s      0     .test-logs/tests__parcours__paiement-statut.test.ts.log
tests/parcours/paiement-webhook.test.ts              PASS     2.0s      0     .test-logs/tests__parcours__paiement-webhook.test.ts.log
tests/parcours/partenaire-liste.test.ts              PASS     2.4s      0     .test-logs/tests__parcours__partenaire-liste.test.ts.log
tests/parcours/pilotage-acces.test.ts                PASS     12.4s     0     .test-logs/tests__parcours__pilotage-acces.test.ts.log
tests/parcours/pilotage-apercu-ventes.test.ts        PASS     3.0s      0     .test-logs/tests__parcours__pilotage-apercu-ventes.test.ts.log
tests/parcours/pilotage-cloture-export.test.ts       PASS     3.0s      0     .test-logs/tests__parcours__pilotage-cloture-export.test.ts.log
tests/parcours/pilotage-entrees.test.ts              PASS     15.9s     0     .test-logs/tests__parcours__pilotage-entrees.test.ts.log
tests/parcours/pilotage-equipe-caisse.test.ts        PASS     3.2s      0     .test-logs/tests__parcours__pilotage-equipe-caisse.test.ts.log
tests/parcours/pilotage-invariant.test.ts            PASS     3.2s      0     .test-logs/tests__parcours__pilotage-invariant.test.ts.log
tests/parcours/pin-regisseur.test.ts                 PASS     390ms     0     .test-logs/tests__parcours__pin-regisseur.test.ts.log
tests/parcours/realtime-scanner.test.ts              PASS     13.7s     0     .test-logs/tests__parcours__realtime-scanner.test.ts.log
tests/parcours/revocation-sessions.test.ts           PASS     1.5s      0     .test-logs/tests__parcours__revocation-sessions.test.ts.log
tests/parcours/roles-fraicheur.test.ts               PASS     834ms     0     .test-logs/tests__parcours__roles-fraicheur.test.ts.log
tests/parcours/roles-metadonnees.test.ts             PASS     554ms     0     .test-logs/tests__parcours__roles-metadonnees.test.ts.log
tests/parcours/sms-anti-abus.test.ts                 PASS     517ms     0     .test-logs/tests__parcours__sms-anti-abus.test.ts.log
tests/parcours/statut-compte.test.ts                 PASS     2.1s      0     .test-logs/tests__parcours__statut-compte.test.ts.log
tests/parcours/temps-reel-billets.test.ts            PASS     20.7s     0     .test-logs/tests__parcours__temps-reel-billets.test.ts.log
tests/parcours/temps-reel-hook.test.ts               PASS     247ms     0     .test-logs/tests__parcours__temps-reel-hook.test.ts.log
tests/parcours/temps-reel-prives.test.ts             PASS     40.7s     0     .test-logs/tests__parcours__temps-reel-prives.test.ts.log
tests/parcours/temps-reel-public.test.ts             PASS     26.9s     0     .test-logs/tests__parcours__temps-reel-public.test.ts.log
tests/parcours/temps-reel-stock.test.ts              PASS     21.1s     0     .test-logs/tests__parcours__temps-reel-stock.test.ts.log
tests/partner-auth-complete.test.ts                  PASS     388ms     0     .test-logs/tests__partner-auth-complete.test.ts.log
tests/partner-halls-m7.test.ts                       PASS     1.0s      0     .test-logs/tests__partner-halls-m7.test.ts.log
tests/partner-orders-m9.test.ts                      PASS     1.2s      0     .test-logs/tests__partner-orders-m9.test.ts.log
tests/payment.test.ts                                PASS     199ms     0     .test-logs/tests__payment.test.ts.log
tests/roles-isolation.test.ts                        PASS     197ms     0     .test-logs/tests__roles-isolation.test.ts.log
tests/samirpay-contrat.test.ts                       PASS     3.7s      0     .test-logs/tests__samirpay-contrat.test.ts.log
tests/scanner-combat-ui.test.ts                      PASS     329ms     0     .test-logs/tests__scanner-combat-ui.test.ts.log
tests/scanner-wolof-audio.test.ts                    PASS     327ms     0     .test-logs/tests__scanner-wolof-audio.test.ts.log
tests/schema/fonctions-privileges.test.ts            PASS     279ms     0     .test-logs/tests__schema__fonctions-privileges.test.ts.log
tests/schema/hotfix-identique.test.ts                PASS     199ms     0     .test-logs/tests__schema__hotfix-identique.test.ts.log
tests/schema/hotfix-scripts.test.ts                  PASS     391ms     0     .test-logs/tests__schema__hotfix-scripts.test.ts.log
tests/schema/reset-test-password.test.ts             PASS     216ms     0     .test-logs/tests__schema__reset-test-password.test.ts.log
tests/schema/rls-toutes-tables.test.ts               PASS     231ms     0     .test-logs/tests__schema__rls-toutes-tables.test.ts.log
tests/schema/secrets-codes-en-dur.test.ts            PASS     260ms     0     .test-logs/tests__schema__secrets-codes-en-dur.test.ts.log
tests/security/anon-uniquement.test.ts               PASS     191ms     0     .test-logs/tests__security__anon-uniquement.test.ts.log
tests/security/r1-inscription-roles.test.ts          PASS     1.1s      0     .test-logs/tests__security__r1-inscription-roles.test.ts.log
tests/security/r10-user-roles.test.ts                PASS     629ms     0     .test-logs/tests__security__r10-user-roles.test.ts.log
tests/security/r11-storage-documents.test.ts         PASS     618ms     0     .test-logs/tests__security__r11-storage-documents.test.ts.log
tests/security/r12-reglages-finance.test.ts          PASS     466ms     0     .test-logs/tests__security__r12-reglages-finance.test.ts.log
tests/security/r13-parrainage-relations.test.ts      PASS     961ms     0     .test-logs/tests__security__r13-parrainage-relations.test.ts.log
tests/security/r14-retraits-insertion.test.ts        PASS     548ms     0     .test-logs/tests__security__r14-retraits-insertion.test.ts.log
tests/security/r15-statut-ambassadeur.test.ts        PASS     527ms     0     .test-logs/tests__security__r15-statut-ambassadeur.test.ts.log
tests/security/r16-reglages-acces.test.ts            PASS     412ms     0     .test-logs/tests__security__r16-reglages-acces.test.ts.log
tests/security/r17-statut-evenement-rest.test.ts     PASS     449ms     0     .test-logs/tests__security__r17-statut-evenement-rest.test.ts.log
tests/security/r18-partenaires-public.test.ts        PASS     678ms     0     .test-logs/tests__security__r18-partenaires-public.test.ts.log
tests/security/r19-categories-transferts.test.ts     PASS     654ms     0     .test-logs/tests__security__r19-categories-transferts.test.ts.log
tests/security/r2-otp-codes.test.ts                  PASS     417ms     0     .test-logs/tests__security__r2-otp-codes.test.ts.log
tests/security/r3-fonctions-rpc.test.ts              PASS     805ms     0     .test-logs/tests__security__r3-fonctions-rpc.test.ts.log
tests/security/r4-ecritures-directes.test.ts         PASS     477ms     0     .test-logs/tests__security__r4-ecritures-directes.test.ts.log
tests/security/r5-lectures-anon.test.ts              PASS     477ms     0     .test-logs/tests__security__r5-lectures-anon.test.ts.log
tests/security/r6-roles-jeton.test.ts                PASS     586ms     0     .test-logs/tests__security__r6-roles-jeton.test.ts.log
tests/security/r7-profil-colonnes.test.ts            PASS     771ms     0     .test-logs/tests__security__r7-profil-colonnes.test.ts.log
tests/security/r8-controleur-lectures.test.ts        PASS     576ms     0     .test-logs/tests__security__r8-controleur-lectures.test.ts.log
tests/security/r9-partenaire-ecritures.test.ts       PASS     482ms     0     .test-logs/tests__security__r9-partenaire-ecritures.test.ts.log
tests/sms-formatage.test.ts                          PASS     273ms     0     .test-logs/tests__sms-formatage.test.ts.log
tests/superadmin-complete.test.ts                    PASS     312ms     0     .test-logs/tests__superadmin-complete.test.ts.log
tests/ux-performance-and-double-click.test.ts        PASS     609ms     0     .test-logs/tests__ux-performance-and-double-click.test.ts.log
──────────────────────────────────────────────────────
TOTAL : 125 suite(s) — 125 réussie(s), 0 en échec, 0 expirée(s)

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
   Generating static pages (0/54) ...
[getServerSessionUser] Erreur session: B [Error]: Dynamic server usage: Route /api/partner/orders couldn't be rendered statically because it used `request.headers`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error
    at V (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:21778)
    at Object.get (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:29465)
    at E (/home/runner/work/event-village/event-village/.next/server/chunks/8272.js:1:12449)
    at u (/home/runner/work/event-village/event-village/.next/server/chunks/3138.js:1:920)
    at c (/home/runner/work/event-village/event-village/.next/server/chunks/3138.js:1:445)
    at c (/home/runner/work/event-village/event-village/.next/server/app/api/partner/orders/route.js:1:568)
    at /home/runner/work/event-village/event-village/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:6:38417
    at /home/runner/work/event-village/event-village/node_modules/next/dist/server/lib/trace/tracer.js:140:36
    at NoopContextManager.with (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:7062)
    at ContextAPI.with (/home/runner/work/event-village/event-village/node_modules/next/dist/compiled/@opentelemetry/api/index.js:1:518) {
  description: "Route /api/partner/orders couldn't be rendered statically because it used `request.headers`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error",
  digest: 'DYNAMIC_SERVER_USAGE'
}
   Generating static pages (13/54) 
   Generating static pages (26/54) 
   Generating static pages (40/54) 
 ✓ Generating static pages (54/54)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                             Size     First Load JS
┌ ○ /                                                   4.74 kB         191 kB
├ ○ /_not-found                                         183 B          88.2 kB
├ ○ /admin                                              183 B          88.2 kB
├ ○ /admin/audit                                        5.5 kB          110 kB
├ ○ /admin/communications                               5.89 kB         110 kB
├ ○ /admin/dashboard                                    16.8 kB         194 kB
├ ○ /admin/events                                       10.5 kB         186 kB
├ ƒ /admin/events/[id]                                  10.9 kB         146 kB
├ ○ /admin/finance                                      9.87 kB         193 kB
├ ○ /admin/finance-settings                             9.73 kB         193 kB
├ ○ /admin/pricing                                      5.5 kB          110 kB
├ ○ /admin/referral                                     7.83 kB         112 kB
├ ○ /admin/services                                     9.5 kB          114 kB
├ ○ /admin/users                                        24.1 kB         146 kB
├ ƒ /api/admin/audit                                    0 B                0 B
├ ƒ /api/admin/communications                           0 B                0 B
├ ƒ /api/admin/events                                   0 B                0 B
├ ƒ /api/admin/events/[id]                              0 B                0 B
├ ƒ /api/admin/events/[id]/cancel                       0 B                0 B
├ ƒ /api/admin/events/[id]/transition                   0 B                0 B
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
├ ƒ /api/controller/counter-sale                        0 B                0 B
├ ƒ /api/controller/profile                             0 B                0 B
├ ƒ /api/controller/scan                                0 B                0 B
├ ƒ /api/controller/scan/incidents                      0 B                0 B
├ ƒ /api/controller/setup                               0 B                0 B
├ ƒ /api/controller/shifts/[id]/summary                 0 B                0 B
├ ƒ /api/controller/shifts/active                       0 B                0 B
├ ƒ /api/controller/shifts/close                        0 B                0 B
├ ƒ /api/controller/shifts/open                         0 B                0 B
├ ƒ /api/cron/event-change-notifications                0 B                0 B
├ ƒ /api/cron/events-finish                             0 B                0 B
├ ƒ /api/cron/moratoriums                               0 B                0 B
├ ƒ /api/cron/payments-reconcile                        0 B                0 B
├ ƒ /api/cron/referral-commissions                      0 B                0 B
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
├ ƒ /api/webhooks/samirpay                              0 B                0 B
├ ƒ /api/withdrawals/otp                                0 B                0 B
├ ƒ /api/withdrawals/request                            0 B                0 B
├ ○ /controller/profile                                 6.28 kB         110 kB
├ ○ /controller/scanner                                 14.4 kB         204 kB
├ ○ /controller/setup                                   4.69 kB         169 kB
├ ƒ /events/[id]                                        17 kB           205 kB
├ ○ /explore                                            3.41 kB         190 kB
├ ○ /forgot-password                                    8.89 kB         195 kB
├ ○ /halls                                              5.69 kB         115 kB
├ ƒ /halls/[id]                                         8.4 kB          197 kB
├ ○ /login                                              10.5 kB         197 kB
├ ○ /notifications                                      13 kB           186 kB
├ ○ /orders                                             6.44 kB         179 kB
├ ƒ /paiement/[id]                                      8.68 kB         240 kB
├ ○ /partner                                            183 B          88.2 kB
├ ○ /partner/calendar                                   4.88 kB         109 kB
├ ○ /partner/dashboard                                  15.3 kB         188 kB
├ ○ /partner/events                                     7.1 kB          202 kB
├ ƒ /partner/events/[id]                                19.1 kB         209 kB
├ ƒ /partner/events/[id]/caisse                         183 B          88.2 kB
├ ƒ /partner/events/[id]/edit                           367 B           218 kB
├ ƒ /partner/events/[id]/team                           183 B          88.2 kB
├ ○ /partner/events/new                                 297 B           218 kB
├ ○ /partner/finance                                    7.82 kB         196 kB
├ ○ /partner/halls                                      8.14 kB         122 kB
├ ƒ /partner/halls/[id]/edit                            9.86 kB         127 kB
├ ○ /partner/halls/new                                  9.37 kB         127 kB
├ ○ /partner/orders                                     10.5 kB         188 kB
├ ○ /partner/products                                   7.43 kB         121 kB
├ ○ /partner/products/new                               9.13 kB         127 kB
├ ○ /partner/profile                                    4.52 kB         100 kB
├ ○ /partner/register                                   9.67 kB         127 kB
├ ○ /partner/scan                                       5.47 kB         119 kB
├ ○ /partner/stats                                      5.77 kB         101 kB
├ ○ /partner/subscription                               6.21 kB         110 kB
├ ○ /partner/tables                                     9.79 kB         123 kB
├ ○ /partner/team                                       13.2 kB         190 kB
├ ○ /profile                                            7.18 kB         180 kB
├ ○ /register                                           9.07 kB         195 kB
├ ○ /reset-password                                     7.95 kB         181 kB
├ ƒ /restaurants/[id]/menu                              7.46 kB         196 kB
├ ƒ /restaurants/[id]/tables                            7.88 kB         196 kB
├ ○ /scan                                               183 B          88.2 kB
├ ○ /tickets                                            13.3 kB         249 kB
├ ƒ /tickets/claim/[token]                              5.61 kB         227 kB
└ ○ /wallet                                             9.27 kB         197 kB
+ First Load JS shared by all                           88 kB
  ├ chunks/2117-488d789e9004e22c.js                     31.9 kB
  ├ chunks/fd9d1056-270721ac51469ce4.js                 53.6 kB
  └ other shared chunks (total)                         2.48 kB


ƒ Middleware                                            87.6 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand


[verify] OK — 4 étapes réussies en 415s.
```

**`npm run e2e`** (connexions, captures, fumée), lignes de synthèse :

```text
  7 passed (9.0s)
[e2e] phase connexion : OK en 10s
  120 passed (4.2m)
[e2e] phase captures : OK en 250s
[e2e][fiche admin] GET /api/admin/events/5cd3e16e-8adf-4868-ab94-1882caf2f288 → 200 statut=EN_ATTENTE code=—
[e2e][fiche admin] POST /api/admin/events/5cd3e16e-8adf-4868-ab94-1882caf2f288/transition → 200 statut=VALIDE code=—
[e2e][fiche admin] GET /api/admin/events/5cd3e16e-8adf-4868-ab94-1882caf2f288 → 200 statut=VALIDE code=—
  ✓  1 [fumee] › e2e/fumee.spec.ts:79:5 › fumée : créer, soumettre, valider, publier, acheter, scanner, piloter (8.8s)
  1 passed (9.5s)
[e2e] phase fumee : OK en 10s
```

| Run | Commit | verify | e2e | Rôle |
|---|---|---|---|---|
| [42 · 41257553816](https://github.com/fallouu-mn/event-village/actions/runs/41257553816) | 640153a | 91/91 | — | rapport du lot 4, point de départ du lot 5 |
| [43 · 41270894272](https://github.com/fallouu-mn/event-village/actions/runs/41270894272) | 214a820 | 91/125 | sauté | **référence « avant »** : tests du lot dans leur version finale, aucun correctif. 34 suites en échec, exactement les 34 nouvelles |
| [44 · 41273820807](https://github.com/fallouu-mn/event-village/actions/runs/41273820807) | 832c649 | — | sauté | migration 02 non appliquée : délimiteurs `$$` réduits à `$` par un remplacement de texte (corrigé par `9e75ad2`) |
| [45 · 41274045900](https://github.com/fallouu-mn/event-village/actions/runs/41274045900) | 9e75ad2 | 104/125 | sauté | première vague (sécurité, dette, cycle de vie) verte ; régression de `hotfix-scripts` (EXECUTE retiré au service_role sur les fonctions de trigger, corrigé par `35f6d89`) |
| [46 · 41275602892](https://github.com/fallouu-mn/event-village/actions/runs/41275602892) | e66c293 | 114/125 | sauté | deuxième vague (édition, pilotage, temps réel) ; restaient les écrans, `statut-compte` (routes du pilotage sans `requireActiveSession(` explicite) et `temps-reel-stock` |
| [47 · 41320395405](https://github.com/fallouu-mn/event-village/actions/runs/41320395405) | 3518d06 | 107/125 | sauté | lanceur corrigé : un `after()` en échec fait échouer la suite. Il révèle la violation (i) créée par `finance-retraits`, adapté par `3e493f5` |
| [48 · 41322047660](https://github.com/fallouu-mn/event-village/actions/runs/41322047660) | 7170afe | — | sauté | typecheck : import d'images de Leaflet dépendant de `next-env.d.ts`, absent du dépôt (corrigé par `d46dc10`) |
| [49 · 41322462242](https://github.com/fallouu-mn/event-village/actions/runs/41322462242) | d46dc10 | 125/125 | échec | premier verify vert ; e2e : rôles protégés renvoyés vers `localhost` (hôte réécrit par Next), affiches du seed absentes, codes techniques affichés |
| [50 · 41327147346](https://github.com/fallouu-mn/event-village/actions/runs/41327147346) | d1e1c23 | 125/125 | échec | 120 captures sans contrôle bloquant ; fumée arrêtée à la validation (fiche admin restée « En attente ») |
| [51 · 41328811615](https://github.com/fallouu-mn/event-village/actions/runs/41328811615) | b20547f | 125/125 | échec | diagnostic : le GET de la fiche relu après la transition renvoie `EN_ATTENTE` (cache des fetch de supabase-js sous Next 14, corrigé par `7326764`) |
| [52 · 41330626995](https://github.com/fallouu-mn/event-village/actions/runs/41330626995) | 1649123 | 125/125 | échec | fiche relue en `VALIDE` ; fumée arrêtée au choix de l'opérateur (radio masqué dans son libellé) |
| [53 · 41332292688](https://github.com/fallouu-mn/event-village/actions/runs/41332292688) | 3a7a654 | 125/125 | échec | achat confirmé ; billet du soir même classé dans l'historique de Mes billets (corrigé par `0d6bab5`) |
| [54 · 41333728980](https://github.com/fallouu-mn/event-village/actions/runs/41333728980) | 0d6bab5 | 125/125 | échec | scan accepté ; « Entrée validée » présent deux fois (panneau et historique), sélecteur trop large |
| [55 · 41335287062](https://github.com/fallouu-mn/event-village/actions/runs/41335287062) | c20442b | 125/125 | **succès** | **référence « après »** : 125 suites, 1 232 sous-tests, aucun échec ni test ignoré ; 7 connexions, 120 captures et la fumée complète |

---

## 7. Points ouverts

1. **Hébergement.** Aucun hébergeur n'est encore choisi. La mise en ligne demandera :
   - les migrations `…01` à `…06` et celles des lots précédents ;
   - les deux tâches planifiées ;
   - les variables du lot 4.

   Si l'application est un jour auto-hébergée avec `next start` derrière un proxy, le middleware construira ses redirections sur l'hôte d'écoute (Next réécrit 127.x en `localhost`). Il faudra alors les construire depuis l'en-tête Host ou `NEXT_PUBLIC_APP_URL`.
2. **Interface :**
   - la page de connexion n'est pas migrée au système de design (seuls ses libellés sont liés) ;
   - `CombatFlashOverlay` et `ShiftModals` gardent leur ancien style (un test existant impose les classes du premier) ;
   - `FeaturedEventCard` n'est utilisé nulle part ;
   - les détails mineurs de la section 3 ;
   - les fichiers `loading.tsx` de trois pages sur l'ancienne palette.
3. **Vocabulaire à valider** : « Billetterie », « Validation », « Solde » dans la barre du bas, et « Bientôt en vente ».
4. **Performances :**
   - la liste du partenaire appelle `event_actions` une fois par événement (N appels) ; une RPC groupée sera utile au-delà de quelques dizaines d'événements ;
   - `sharp` n'est pas installé : optimisation d'images plus lente.
5. **Temps réel :**
   - un compte partenaire suspendu reçoit encore les diffusions ; la RLS ne lit pas le statut du compte ;
   - `orders`, `hall_reservations` et `table_reservations` restent publiées (hors périmètre) ;
   - `has_purchasable` ne suit pas le temps qui passe : c'est l'API qui décide de l'achat ;
   - la liste de la cloche montre tous les canaux, alors que le compteur ne compte que PUSH.
6. **Données :**
   - le service_role peut encore supprimer un événement non brouillon par REST (`events_admin_manage`), ce qui efface son historique par cascade ;
   - les écritures `COMPENSATION_CREANCE` ne sont pas décalées quand la fin recule ;
   - aucune donnée de consentement pour les contacts exportés (à traiter au lot RGPD).
7. **Variables de tuiles de carte** (`NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION`) : facultatives, ni dans `lib/env.ts` ni dans la documentation de déploiement.
8. **Couverture :**
   - la révocation des transferts à l'annulation n'a plus de test (ancien cas legacy) ;
   - la notification d'expiration d'un transfert n'est pas envoyée (non demandée).

Le lot 6 n'a pas été commencé.
