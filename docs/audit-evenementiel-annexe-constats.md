# Annexe — Constats détaillés de l'audit du parcours événementiel

Document généré à partir des résultats bruts des huit auditeurs automatisés (151 constats), complétés par la contre-vérification manuelle de l'auditeur principal. Chaque constat porte une mention de vérification :

- **Vérifié** : le code cité a été relu directement par l'auditeur principal et le constat est confirmé.
- **Non contre-vérifié** : constat d'un seul auditeur automatisé, non relu ligne à ligne (la passe de vérification adversariale n'a pas pu s'exécuter). Le niveau de confiance indiqué est celui de l'auditeur.

Les chemins de fichiers sont relatifs à la racine du dépôt. Les sévérités suivent la grille : CRITIQUE = faille exploitable, perte d'argent ou violation d'une règle financière/métier centrale du CDC ; ÉLEVÉE = non-conformité CDC ou intégrité des données ; MOYENNE = robustesse/UX à impact réel ; FAIBLE = finition.

## A. Conformité CDC Partie V — Événements

**Synthèse de l'auditeur :** Points forts : le cycle §31 est porté par une vraie machine à états serveur (changeEventStatus) qui interdit l'auto-validation partenaire, notifie le partenaire (in-app + SMS + email) à la validation/rejet/suspension et les admins à la soumission ; les champs §30/§32/§33 (titre, description, date/heure, lieu, image, programme chronologique, adresse/accès/parking/contact/règles) sont saisissables dans un stepper partenaire soigné, persistés (JSONB program/practical_info) et affichés sur la page publique ; la jauge capacité/quotas (§35) est contrôlée côté serveur à la création, à l'ajout et à la modification de catégorie, et la RLS Postgres limite correctement la lecture anonyme aux événements PUBLIE. Verdict global sur la dimension Partie V : NON CONFORME en l'état. Dix-sept constats dont 1 critique (le statut ANNULE est un trou de la machine à états : un partenaire peut remettre PUBLIE un événement annulé et remboursé) et 9 élevés : l'API publique de détail expose tous les statuts (brouillons, suspendus, annulés) avec panier d'achat, l'édition d'un événement publié échoue systématiquement depuis l'UI, les modifications de catégories de billets du formulaire d'édition sont silencieusement perdues, aucun passage automatique à TERMINE (billetterie ouverte sur des événements passés), aucune validation serveur structurée des événements, les services §34 « tables / communication / promotion » n'ont aucun effet fonctionnel, l'admin ne peut ni réactiver un événement suspendu ni voir son contenu avant validation, l'annulation §41 est inaccessible depuis l'interface, et SUSPENDU est une impasse sans annulation/remboursement possible.

**Limites de couverture :** Audit réalisé en lecture seule, sans exécution des tests ni de l'application. Non couvert ou partiellement couvert : (1) le comportement RLS à l'exécution (toutes les routes auditées utilisent le client service-role, la RLS n'est donc pas la barrière effective) ; (2) la configuration next.config (domaines images autorisés) et le composant MapPicker/EventMap ; (3) la route d'upload (app/api/partner/upload) uniquement survolée par grep (types MIME et taille contrôlés côté serveur) ; (4) les pages app/page.tsx et app/explore/page.tsx (catalogue) uniquement vérifiées quant à la source de données /api/events ; (5) les routes checkout/scan/caisse (hors dimension) uniquement consultées pour confirmer les garde-fous de statut ; (6) la résolution multi-rôles de getServerSessionUser (user.role vs user.roles) non auditée en profondeur alors que changeEventStatus et cancelEvent raisonnent sur user.role ; (7) docs/architecture.md ne contient aucune section détaillée sur le cycle de publication (une seule occurrence « publication ») et n'a donc pas pu servir de référence d'écart ; (8) les tests tests/partner-events-m5.test.ts et tests/event-live-editing-and-stock.test.ts n'ont été lus que par extraits ; (9) l'UI admin des promotions (app/admin/promotions) non lue. Base des chemins : C:\Users\DELL\Documents\event-village.

### events-cdc-1 — Machine à états : le statut ANNULE n'est pas traité dans changeEventStatus, toute transition est possible depuis ANNULE (y compris ANNULE → PUBLIE par le partenaire)

- **Sévérité :** CRITIQUE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §31 Publication ; §41 Remboursement ; §184 Règles financières
- **Emplacement :** lib/events/event.service.ts — lignes 733-812 (branches 746-801, update 804-812) ; app/api/partner/events/[id]/status/route.ts 21-33 ; app/api/admin/services/route.ts 104-111
- **Catégorie :** machine-a-etats / securite metier

**Description.** La matrice de transition n'a de branche que pour BROUILLON, EN_ATTENTE, VALIDE, PUBLIE, SUSPENDU et TERMINE. Si currentStatus vaut 'ANNULE' (valeur ajoutée par la migration 20260910 et présente dans le type EventStatus L8), aucune branche ne s'applique, aucune exception n'est levée et l'UPDATE L804-812 est exécuté avec le newStatus reçu. Le contrôle d'accès L735-739 accepte le partenaire propriétaire (isOwner). La route POST /status ne valide pas `status` contre l'énumération et transmet la chaîne brute ; la route admin fait un cast `status as any`.

**Preuve.** L746 `if (currentStatus === 'BROUILLON') {` … L790 `} else if (currentStatus === 'SUSPENDU') {` … L799 `} else if (currentStatus === 'TERMINE') { throw … }` — pas de `else` ni de branche ANNULE — puis L804-807 `.from('events').update({ status: newStatus, … })`. Route : L21 `const { status, reason } = body as { status: EventStatus … }` sans validation.

**Impact.** Un partenaire dont l'événement a été annulé (billets passés à ANNULE/REMBOURSE, remboursements SamirPay lancés ou en attente de trésorerie) peut, par un simple POST {status:'PUBLIE'} sur /api/partner/events/{id}/status, remettre l'événement en ligne sans repasser par la validation admin : il réapparaît dans /api/events (filtre status='PUBLIE' L40) et reserveTicketsAtomic (L1001) accepte à nouveau les ventes, alors que des remboursements PENDING peuvent encore être versés. Violation directe du cycle §31 et de la cohérence financière §41/§184.

**Recommandation.** Ajouter une branche terminale explicite `else if (currentStatus === 'ANNULE') throw new Error('Un événement annulé ne peut plus changer de statut.')` et un `else` par défaut qui rejette tout statut inconnu ; valider `newStatus` avec un schéma Zod `z.enum([...EventStatus])` dans les deux routes (partner/status et admin/services) ; ajouter un test de non-régression ANNULE → * pour les rôles PARTENAIRE et ADMIN ; envisager un trigger Postgres ou une contrainte applicative empêchant toute sortie de ANNULE.

### events-cdc-2 — Visibilité publique : /api/events/[id] ne filtre pas le statut, la page publique affiche brouillons, suspendus, annulés et terminés avec le module d'achat

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §31 Publication (seuls les événements Publiés sont visibles) ; §17 Découverte
- **Emplacement :** app/api/events/[id]/route.ts — lignes 19-53 et 157-192 ; app/events/[id]/page.tsx 89-94, 195-208, 544-616, 644-658
- **Catégorie :** visibilite / conformite-cycle-publication

**Description.** La route de détail utilise le client service-role (contourne la RLS events_read_public de 0003_rls.sql L135-136) et charge l'événement uniquement par id, sans condition `status = 'PUBLIE'`. Elle renvoie la totalité des données (programme, infos pratiques, catégories avec quantités vendues, organisateur). La page publique n'examine jamais `event.status` : elle rend le poster, les formules et le panier dès que l'API répond ; le seul garde-fou est le refus tardif du checkout (app/api/checkout/route.ts L53-55).

**Preuve.** L21-49 `.from('events').select(…).eq('id', eventId).maybeSingle();` — aucun `.eq('status', 'PUBLIE')` ; page L195 `if (error || !event) {` puis rendu complet, L648 `disabled={event.isFullySoldOut || isClaimingFree}` sans test de statut.

**Impact.** Un brouillon non validé, un événement SUSPENDU par l'admin pour litige ou un événement ANNULE restent intégralement consultables par URL (l'URL est partagée par le bouton « Partager » L277-290 et devinable depuis un ancien lien). Le client peut remplir un panier puis obtenir un message d'erreur générique au paiement ; aucune mention « annulé/suspendu » n'est affichée (public_notice de event_cancellations jamais restitué). La modération admin et la confidentialité des événements non publiés sont inopérantes.

**Recommandation.** Dans /api/events/[id] : charger l'événement puis renvoyer 404 (ou une réponse dédiée {status:'ANNULE', publicNotice}) si status ∉ {PUBLIE, TERMINE} selon la politique produit ; pour ANNULE renvoyer le public_notice sans catégories ; côté page, afficher un bandeau d'état et masquer le module d'achat lorsque status !== 'PUBLIE' ; ajouter un test anonyme sur un brouillon → 404.

### events-cdc-3 — Édition d'un événement PUBLIE depuis le formulaire partenaire échoue systématiquement : le payload contient toujours `ticket_categories`, champ refusé pour les événements publiés

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §30 Création ; §31 Publication (règles de modification après publication)
- **Emplacement :** app/partner/events/[id]/edit/page.tsx — lignes 337-345 (payload) ; lib/events/event.service.ts 261-276 (contrôle) ; app/partner/events/page.tsx 447-451 (bouton Modifier sur carte PUBLIE)
- **Catégorie :** bug-fonctionnel / modification-apres-publication

**Description.** Le formulaire d'édition envoie `ticket_categories` dans tous les cas (tableau rempli si ticketing activé, sinon `[]`). Dans updateEvent, pour un événement PUBLIE, chaque clé définie du body est vérifiée contre `allowedFieldsForPublished`, qui ne contient pas `ticket_categories` ; `[]` n'étant pas `undefined`, l'exception « Le champ 'ticket_categories' ne peut pas être modifié pour un événement publié. » est levée avant toute mise à jour. Les tests existants appellent EventService.updateEvent directement sans cette clé (tests/event-live-editing-and-stock.test.ts L243-245, L268-276), ce qui masque le défaut.

**Preuve.** edit/page.tsx L337 `ticket_categories: services.ticketing ? ticketCategories.map(…) : [],` ; event.service.ts L271-273 `if (input[key] === undefined || key === 'status') continue; if (!allowedFieldsForPublished.has(key)) { throw new Error(`Le champ '${key}' ne peut pas être modifié pour un événement publié.`); }`.

**Impact.** Le bouton « Modifier » affiché sur chaque événement en ligne, la bannière « Événement en direct… vos modifications s'appliqueront immédiatement » (edit L429-445) et le mécanisme de notification des acheteurs en cas de changement de date/lieu (service L369-453) sont inatteignables par l'interface : le partenaire ne peut corriger ni lieu, ni horaire, ni programme, ni infos pratiques d'un événement publié sans intervention technique.

**Recommandation.** Ne pas envoyer `ticket_categories` depuis le formulaire d'édition (les catégories ont leurs propres endpoints) ou, côté service, ignorer explicitement la clé (`delete input.ticket_categories`) avant le contrôle ; ajouter un test d'API PUT sur un événement PUBLIE avec le payload exact du formulaire.

### events-cdc-4 — Les modifications de catégories de billets saisies à l'étape 5 du formulaire d'édition ne sont jamais persistées (updateEvent ignore `ticket_categories`) ; aucune suppression ni édition des dates de vente/limite par commande n'est possible après création

- **Sévérité :** ÉLEVÉE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §35 Création ticketing (catégorie ; prix ; quantité ; date de début ; date de fin) ; §30
- **Emplacement :** lib/events/event.service.ts — lignes 279-315 (updateData sans ticket_categories) ; app/partner/events/[id]/edit/page.tsx 202-217, 683-720, 356-358 ; app/api/partner/events/[id]/categories/[categoryId]/route.ts 7-31
- **Catégorie :** integrite-donnees / perte-silencieuse

**Description.** updateEvent ne mappe que title/description/dates/lieu/image/capacity/géoloc/category/program/services/practical_info. Le tableau `ticket_categories` envoyé par le formulaire (ajouts, suppressions, prix, quotas) est ignoré, mais la réponse est un succès et le toast « modifié » s'affiche. Par ailleurs l'endpoint catégorie n'expose que PATCH (quota, is_active, is_visible, price, description) : pas de DELETE, pas de modification de `name`, `sale_start`, `sale_end`, `max_per_order` (le service accepte pourtant `name` L473/L504).

**Preuve.** service L283-298 : liste exhaustive `if (input.title !== undefined) … if (input.services !== undefined) updateData.services = input.services;` — aucune ligne `ticket_categories` ; edit page L690-694 bouton poubelle sur catégorie sans ventes, L356 `if (data.success) { toast.success(toastMessages.events.updated(title)) …`. PATCH route L25-29 ne transmet que total_quantity/is_active/is_visible/price/description.

**Impact.** Perte de données silencieuse : un partenaire qui ajoute un pass VIP, corrige un prix ou retire une catégorie sur un brouillon/en attente/validé croit l'avoir fait ; l'admin valide un événement dont les catégories diffèrent de l'intention du partenaire ; impossible de corriger une période de vente erronée après création sans intervention technique.

**Recommandation.** Soit retirer l'étape 5 du formulaire d'édition et la remplacer par le gestionnaire de catégories (AdjustTicketQuotaModal + endpoints), soit implémenter dans updateEvent une réconciliation des catégories (insert/update/delete avec garde sold_quantity) ; ajouter DELETE /categories/[categoryId] (refus si sold_quantity > 0) et étendre PATCH à name/sale_start/sale_end/max_per_order avec validation Zod.

### events-cdc-5 — Aucun passage automatique à TERMINE après la date : les événements passés restent PUBLIE, listés dans le catalogue et vendables

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §31 Publication (statut Terminé) ; §146/§148 Automatisation
- **Emplacement :** app/api/events/route.ts — lignes 19-41 ; lib/events/event.service.ts 705-712, 785-786, 1001-1011 ; app/api/cron (seuls moratoriums et ticket-transfers existent) ; app/api/checkout/route.ts 53-55
- **Catégorie :** conformite-cycle-publication / regle-metier

**Description.** La transition vers TERMINE est exclusivement manuelle (partenaire ou admin). Aucun cron ne clôture les événements dont start_date/end_date est dépassée (le dossier app/api/cron ne contient que moratoriums et ticket-transfers). Le catalogue public ne filtre que `status = 'PUBLIE'`, trié par start_date croissante, sans borne temporelle. La réservation (reserveTicketsAtomic) et le checkout ne vérifient que le statut et les dates de vente de la catégorie, jamais la date de l'événement.

**Preuve.** /api/events L40-41 `.eq('status', 'PUBLIE').order('start_date', { ascending: true });` ; service L1001 `if (category.events?.status !== 'PUBLIE') throw …` suivi uniquement des tests sale_start/sale_end L1005-1011 ; aucun fichier de app/api/cron ne référence events/TERMINE.

**Impact.** Un client peut acheter (et payer via SamirPay) un billet pour un événement déjà passé si le partenaire oublie de cliquer « Terminer » ; le catalogue affiche des événements périmés en tête de liste ; les statistiques §160 (événements, taux de présence) et l'éligibilité contrôleur (event-status.ts L14 accepte PUBLIE sans considération de date) sont faussées.

**Recommandation.** Ajouter un cron (app/api/cron/events-finalize) passant PUBLIE/VALIDE/SUSPENDU → TERMINE lorsque COALESCE(end_date, start_date) + end_time est dépassé, avec journal d'audit ; filtrer le catalogue sur la date (`start_date >= today` ou end_date) ; refuser la réservation/checkout si l'événement est passé ; rendre end_date/end_time obligatoires ou dériver une fin par défaut.

### events-cdc-6 — Aucune validation serveur structurée des événements (pas de schéma Zod) : dates passées, fin avant début, JSON arbitraire pour program/practical_info/services, URL image et longueurs non contrôlées

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §30 Création ; §137 Données événement ; §155 Protection des données
- **Emplacement :** lib/events/event.service.ts — lignes 96-105, 124, 134-143 (create) ; 283-298 (update) ; app/api/partner/events/route.ts 45-46 ; app/api/partner/events/[id]/route.ts 49-62 ; lib/validations (auth.ts, payment.ts, transfer.ts uniquement)
- **Catégorie :** validation-serveur / integrite-donnees

**Description.** lib/validations ne contient aucun schéma événement. createEvent ne vérifie que la présence de title/start_date/start_time/location ; category est transmis tel quel à l'enum Postgres (erreur brute remontée au client L150) ; program, practical_info, image_url, gallery_urls, latitude/longitude, city sont stockés sans contrôle de type, de taille ni de format ; updateEvent affecte les entrées brutes (y compris `services` non normalisé, contrairement à la création L139-143). Aucune règle serveur « date de début ≥ aujourd'hui » ni « fin ≥ début » ; le formulaire d'édition n'a même pas la règle client de date passée (edit/page.tsx L46-57 vs new/page.tsx L72-81).

**Preuve.** L97-105 trois `if (!input.title …) throw` seulement ; L137 `program: input.program || [],` L138 `practical_info: input.practical_info || {},` ; update L297 `if (input.program !== undefined) updateData.program = input.program;` L298 `updateData.services = input.services;` ; routes : L46 `await EventService.createEvent(user.id, body);` sans parsing.

**Impact.** Via l'API (ou le formulaire d'édition) un événement peut être publié avec une date passée, une fin antérieure au début, un `program` non tabulaire (la page publique fait `event.program.map` L384 → plantage), une image_url externe hostile ou non autorisée par next/image, des champs de plusieurs Mo ; les erreurs Postgres brutes (enum event_category) sont exposées aux utilisateurs.

**Recommandation.** Créer lib/validations/event.ts (Zod) : title 3-150, description ≤ 5000, dates ISO avec start ≥ today et end ≥ start, category z.enum(EVENT_CATEGORIES ids), image_url/gallery_urls z.string().url() restreintes au domaine Supabase Storage, program z.array({time HH:mm, title ≤ 120, artistOrSpeaker ≤ 120, description ≤ 500}).max(50), practical_info typé, services objet strict, lat/lng bornés ; l'appliquer dans POST/PUT et dans le service ; réutiliser le même schéma côté client (new et edit).

### events-cdc-7 — §34 Services associés : « tables » et « communication » sont des booléens sans aucun effet, « promotion » n'a ni UI partenaire ni effet public ; aucune modélisation événement ↔ zones/catégories/tables/prix (§51)

- **Sévérité :** ÉLEVÉE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §34 Services associés ; §51 Réservation de tables (événement) ; §116 Promotion ; §117 Communication
- **Emplacement :** lib/events/event.service.ts — lignes 26-31, 139-143 ; supabase/migrations/20260902_event_services_promotions.sql 2-5 ; app/partner/events/new/page.tsx 825-889 ; app/api/events/route.ts 21-39 ; app/api/admin/promotions/route.ts 73-79
- **Catégorie :** non-conformite-fonctionnelle

**Description.** `services` est un JSONB {ticketing, tableBooking, communication} stocké à la création. Un grep sur `tableBooking`/`services.communication` ne trouve aucun consommateur hors formulaires et test : aucune table de zones/tables/prix liée à un événement (les tables restaurant_zones/restaurant_tables de 0001 n'ont pas de event_id ; seules ticket_categories L314 et tickets L353 référencent events), aucune logique de communication. Le formulaire promet pourtant « Vos tables configurées… seront disponibles à la réservation » (L845-852) et « Présence dans le calendrier public • Newsletter » (L878-885). La promotion sponsorisée existe côté API (/promotion) mais aucune page partenaire n'y fait appel (grep `/promotion` dans *.tsx : aucun résultat) et l'approbation admin positionne `is_featured` que le catalogue public ne lit jamais (select L21-39 sans is_featured).

**Preuve.** service L139-143 `services: input.services ? { ticketing: !!…, tableBooking: !!…, communication: !!… } : {}` ; migration L3 `ADD COLUMN IF NOT EXISTS services JSONB DEFAULT '{}'` ; promotions route L75-78 `.update({ is_featured: true, featured_until: … })` sans lecteur ; `EventServicesConfig.promotion?` (L30) jamais persisté.

**Impact.** Le partenaire active des services qui ne produisent rien : pas de réservation de tables pour l'événement (zones, catégories, capacité, prix §51 absents), pas d'action de communication, promotion sponsorisée impossible à demander depuis l'interface et sans mise en avant réelle même approuvée. Écart fonctionnel majeur par rapport à la Partie V et à la promesse affichée dans l'UI.

**Recommandation.** Soit livrer les services : table `event_table_zones`/`event_tables` (zone, catégorie, capacité, prix, conditions) exploitées par le flux de réservation de tables, intégration newsletter/calendrier pour communication, bouton « Demander une promotion » sur la carte événement et tri/section « À la une » dans /api/events sur is_featured + featured_until ; soit retirer ces options du formulaire et documenter l'écart avec le client.

### events-cdc-8 — Workflow admin incomplet : aucune action pour réactiver un événement SUSPENDU (transition réservée à l'admin), ni publier/terminer, et validation « à l'aveugle » sans accès au contenu

- **Sévérité :** ÉLEVÉE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §31 Publication ; §130 Services (supervision) ; §24 Validation
- **Emplacement :** app/admin/services/page.tsx — lignes 178-241 (carte et actions) ; lib/events/event.service.ts 790-798 ; app/api/admin/services/route.ts 23-31
- **Catégorie :** conformite-cycle-publication / back-office

**Description.** La liste admin propose Valider/Rejeter pour EN_ATTENTE et Suspendre pour VALIDE/PUBLIE, rien d'autre. Or le service n'autorise SUSPENDU → PUBLIE qu'aux rôles ADMIN/SUPERADMIN (L792-793) : sans bouton, un événement suspendu ne peut plus être remis en ligne sauf appel API manuel. La carte n'affiche que titre, statut, partenaire, lieu et date de création (L186-203) : ni date de l'événement, ni affiche, ni programme, ni catégories/prix, ni lien de prévisualisation — alors que le placeholder de rejet suggère « Images manquantes, informations incomplètes, date incorrecte » (L274). L'API renvoie tous les événements sans pagination ni filtre (L24-27).

**Preuve.** L208 `{item.status === 'EN_ATTENTE' && (` … L230 `{(item.status === 'VALIDE' || item.status === 'PUBLIE') && (` Suspendre — aucune branche SUSPENDU ; service L792 `if (newStatus === 'PUBLIE' && isAdmin) {`.

**Impact.** La suspension (modération) est de fait définitive côté produit ; l'admin valide des événements sans pouvoir vérifier affiche, date, programme ni tarifs (risque de contenu inapproprié §125 et de données incorrectes publiées) ; la liste devient inexploitable avec le volume.

**Recommandation.** Ajouter à l'écran admin : bouton « Réactiver » pour SUSPENDU (→ PUBLIE), « Terminer », filtre par statut, pagination, et une fiche détail (ou lien de prévisualisation sécurisé) montrant image, dates, lieu, programme, infos pratiques et catégories avant validation ; exposer GET /api/admin/services?type=events&status=…&page=….

### events-cdc-9 — L'annulation d'événement (§41) est inaccessible depuis l'interface : EventCancelModal n'est importé nulle part, ANNULE est absent des filtres/types de la liste partenaire et de l'écran admin

- **Sévérité :** ÉLEVÉE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §41 Remboursement (annulation) ; §31 Publication ; §82 Remboursements
- **Emplacement :** app/partner/events/page.tsx — lignes 37 (type status), 255 (onglets), 391-481 (actions) ; components/events/EventCancelModal.tsx 17 (seule occurrence) ; app/admin/services/page.tsx 206-241 ; lib/events/event-status.ts 5-12
- **Catégorie :** non-conformite-fonctionnelle / coherence-types-ui

**Description.** Le backend d'annulation (EventCancellationService, routes partner/admin /cancel) est complet, mais le composant EventCancelModal n'est référencé par aucune page (grep sur tous les *.tsx : uniquement sa définition). La liste partenaire type `status` sans 'ANNULE', ses onglets de filtre s'arrêtent à TERMINE, et les cartes PUBLIE/VALIDE n'ont pas de bouton d'annulation ; l'écran admin n'en a pas non plus. La documentation de lib/events/event-status.ts énumère 6 statuts (sans ANNULE) alors que la fonction L43-44 le traite.

**Preuve.** page.tsx L37 `status: 'BROUILLON' | 'EN_ATTENTE' | 'VALIDE' | 'PUBLIE' | 'SUSPENDU' | 'TERMINE';` L255 `['TOUS', 'BROUILLON', 'EN_ATTENTE', 'VALIDE', 'PUBLIE', 'SUSPENDU', 'TERMINE'].map(` ; L436-458 actions PUBLIE = Quotas / Modifier / Voir uniquement ; EventCancelModal.tsx L17 `export const EventCancelModal` sans import ailleurs.

**Impact.** Ni le partenaire ni l'admin ne peuvent annuler un événement et déclencher les remboursements Mobile Money par le produit ; les événements ANNULE apparaissent sous « Tous » avec un badge mais sans filtre dédié ni résumé de remboursements (route /cancellation également sans UI) ; incohérence TS/SQL/UI sur l'énumération.

**Recommandation.** Brancher EventCancelModal sur les cartes VALIDE/PUBLIE (partenaire) et sur l'écran admin ; ajouter l'onglet ANNULE et le statut au type EventItem ; afficher le résumé /cancellation (remboursements traités/échoués) ; mettre à jour le commentaire de event-status.ts ; partager un unique `EVENT_STATUSES` const entre service, routes et UI.

### events-cdc-10 — SUSPENDU est une impasse : l'annulation/remboursement exige PUBLIE ou VALIDE, le partenaire peut verrouiller l'événement en TERMINE (irréversible, non annulable) et les détenteurs de billets ne sont jamais informés d'une suspension

- **Sévérité :** ÉLEVÉE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §31 Publication ; §41 Remboursement ; §82 Remboursements
- **Emplacement :** lib/events/event-cancellation.service.ts — lignes 134-140, 186 ; lib/events/event.service.ts 790-801, 871-891
- **Catégorie :** machine-a-etats / regle-financiere

**Description.** cancelEvent refuse tout statut autre que PUBLIE/VALIDE (et TERMINE explicitement). Depuis SUSPENDU, le service n'autorise que → PUBLIE (admin, sans UI cf. constat précédent) ou → TERMINE (partenaire ou admin), et TERMINE est terminal (L799-800) et non annulable. La suspension ne notifie que le partenaire ; les clients ayant des billets VALIDE ne reçoivent rien.

**Preuve.** cancellation L138-140 `if (!['PUBLIE', 'VALIDE'].includes(event.status)) { throw new Error(`Impossible d'annuler un événement au statut "${event.status}"…`) }` ; service L794-795 `} else if (newStatus === 'TERMINE') { // Autorisé pour partenaire et admin` ; L871-891 notifications SUSPENDU adressées uniquement à event.partners.user_id.

**Impact.** Si l'admin suspend un événement publié ayant vendu des billets (litige, contenu interdit) et que l'événement n'a finalement pas lieu, personne ne peut lancer l'annulation groupée et les remboursements SamirPay ; un partenaire de mauvaise foi peut passer SUSPENDU → TERMINE pour empêcher définitivement l'annulation groupée (seul refundTicket unitaire reste possible) ; les clients ne sont pas prévenus de la suspension.

**Recommandation.** Autoriser cancelEvent depuis SUSPENDU (et, pour l'admin, depuis TERMINE si des billets VALIDE subsistent) ; réserver SUSPENDU → TERMINE à l'admin ; interdire PUBLIE → TERMINE par le partenaire avant la date de fin si des billets sont vendus ; notifier les détenteurs de billets (in-app/SMS) lors d'une suspension et d'une réactivation.

### events-cdc-11 — Catalogue public : le prix « à partir de » et la liste des catégories incluent les catégories masquées (is_visible = false)

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §17 Découverte ; §35 Ticketing (visibilité des catégories)
- **Emplacement :** app/api/events/route.ts — lignes 38, 58-61, 77-79
- **Catégorie :** affichage-public / fuite-information

**Description.** La route liste sélectionne `is_active` mais pas `is_visible`, calcule minPrice sur toutes les catégories actives et renvoie `ticketCategories` brutes (avec sold_quantity). La route détail, elle, filtre bien `is_visible` (app/api/events/[id]/route.ts L93). Le formulaire de création encourage explicitement les catégories masquées (new/page.tsx L956-963, L1079-1084).

**Preuve.** L38 `ticket_categories(id, name, price, total_quantity, sold_quantity, is_active)` ; L58-61 `const activeCategories = (evt.ticket_categories || []).filter((c) => c.is_active); const minPrice = … Math.min(...activeCategories.map(c => Number(c.price)))` ; L78 `priceFormatted: minPrice === 0 ? 'Gratuit' : …`.

**Impact.** Une catégorie « Invitation » masquée à 0 FCFA fait apparaître l'événement comme « Gratuit » dans le catalogue et la page d'accueil ; les noms, prix et volumes vendus des catégories confidentielles sont exposés à tout visiteur.

**Recommandation.** Sélectionner `is_visible` et filtrer `is_active && is_visible` avant le calcul du prix minimal ; ne renvoyer au catalogue que id/name/price des catégories visibles (sans sold_quantity).

### events-cdc-12 — Règles de modification après publication vides de sens : tous les champs structurants restent modifiables, les changements de date/heure de fin ne sont pas notifiés, `services` et la capacité peuvent être supprimés sur un événement avec ventes

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §31 Publication ; §22 Notifications client
- **Emplacement :** lib/events/event.service.ts — lignes 261-265, 293, 298, 332-335
- **Catégorie :** regle-metier / modification-apres-publication

**Description.** La liste `allowedFieldsForPublished` contient title, dates, lieu, capacité, services, catégorie, image, programme, infos pratiques, géoloc : seul `ticket_categories` est exclu, la « restriction » n'en est donc pas une. La détection des changements critiques ne couvre que start_date/start_time et location/city : un report de l'heure de fin ou un changement de titre n'est pas notifié. `capacity: null` est accepté (suppression de la jauge) et `services` est stocké tel quel (le partenaire peut désactiver `ticketing` sur un événement en vente ou injecter des clés arbitraires).

**Preuve.** L261-265 `new Set(['title','description','location','city',…,'start_date','start_time','end_date','end_time','capacity','services','practical_info','latitude','longitude','category'])` ; L332-333 `dateTimeChanged = (input.start_date !== undefined && …) || (input.start_time !== undefined && …)` ; L293 `if (input.capacity !== undefined) updateData.capacity = input.capacity;`.

**Impact.** Après publication, un partenaire peut changer radicalement l'événement (titre, catégorie, date de fin) sans re-validation ni information systématique des acheteurs ; la jauge globale peut disparaître (quotas non bornés) ; le drapeau `services.ticketing` devient incohérent avec des catégories vendues.

**Recommandation.** Définir une politique explicite : champs libres (description, programme, infos pratiques, image), champs notifiés (toutes dates/heures, lieu, titre), champs verrouillés après ventes (catégorie, services.ticketing, suppression de capacité) ; inclure end_date/end_time dans dateTimeChanged ; normaliser `services` comme à la création ; refuser capacity null si des catégories existent.

### events-cdc-13 — Programme §32 : modèle plat sans distinction artistes/intervenants/activités, horaire en texte libre non validé, champ description non saisissable, lignes vides acceptées et aucun tri chronologique

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** moyenne
- **Référence CDC :** §32 Programme (artistes ; horaires ; activités ; intervenants)
- **Emplacement :** app/partner/events/new/page.tsx — lignes 645-682, 329 ; lib/events/event.service.ts 10-16, 137, 297 ; app/events/[id]/page.tsx 384-404
- **Catégorie :** conformite-fonctionnelle / qualite-donnees

**Description.** Le programme est un tableau de {time, title, artistOrSpeaker, description}. Les formulaires (création et édition L578-594) n'exposent que trois champs texte libres : « Horaire » est un input texte avec placeholder « Ex: 19:30 » sans pattern, le champ `description` du modèle n'est jamais saisissable, et les créneaux vides (time/title/artist à '') sont envoyés tels quels (L329 `program: programItems`) sans filtrage client ni serveur. La page publique rend les items dans l'ordre de saisie sans tri.

**Preuve.** L650-656 `<input type="text" placeholder="Ex: 19:30" value={item.time} …` ; L329 `program: programItems,` ; service L137 `program: input.program || [],` ; public L384 `event.program.map((item, idx) => …` sans tri ni filtrage.

**Impact.** Programme publié avec des créneaux vides ou des horaires non parsables (« vers 20h », « soir ») et non triés ; impossibilité de distinguer artiste, intervenant et activité comme le demande le CDC ; données inexploitables pour un affichage structuré ou un rappel automatique.

**Recommandation.** Typer ProgramItem {time: 'HH:mm', kind: 'ARTISTE'|'INTERVENANT'|'ACTIVITE', title, participant, description} ; input type="time", filtrage des lignes vides et validation Zod côté serveur ; tri par horaire à l'affichage ; exposer le champ description dans les formulaires.

### events-cdc-14 — Slug/SEO : slug généré mais inexploitable (la route publique exige un UUID), jamais recalculé, accents supprimés et collision UNIQUE possible

- **Sévérité :** FAIBLE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §137 Données événement ; N/A (qualité)
- **Emplacement :** lib/events/event.service.ts — lignes 115, 283 ; app/api/events/[id]/route.ts 14-17 ; supabase/migrations/0001_initial_schema.sql 292
- **Catégorie :** seo / dette

**Description.** Le slug est construit à partir du titre (caractères non [a-z0-9] remplacés par '-', donc « Soirée » → « soir-e ») suffixé des 6 derniers chiffres de Date.now(), stocké en colonne UNIQUE, jamais mis à jour lors d'un changement de titre, et la route publique rejette tout identifiant non UUID (404), rendant le slug inutilisable comme URL.

**Preuve.** L115 `const slug = `${input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-6)}`;` ; route L14-17 `const isUuid = /^[0-9a-f]{8}-…/i.test(eventId); if (!isUuid) return 404`.

**Impact.** Pas d'URL lisible/SEO pour les événements (Q9), colonne morte ; en cas (rare) de collision de slug la création échoue avec une erreur Postgres brute.

**Recommandation.** Générer un slug translittéré (ex. slugify avec suppression des diacritiques) + suffixe court aléatoire, le régénérer ou le versionner sur changement de titre, et accepter `slug` dans la route publique (/events/[slug]) avec redirection canonique.

### events-cdc-15 — Édition : catégorie d'événement, géolocalisation et galerie non modifiables ; `gallery_urls` n'est saisissable ni affiché nulle part (champ mort de bout en bout)

- **Sévérité :** FAIBLE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §30 Création (image) ; §33 Informations pratiques (adresse/accès)
- **Emplacement :** app/partner/events/[id]/edit/page.tsx — lignes 73-100, 317-346 ; app/partner/events/new/page.tsx 447-470, 715-720 ; app/api/events/[id]/route.ts 172
- **Catégorie :** completude-formulaires

**Description.** Le formulaire d'édition ne possède ni état ni champ pour `category`, `latitude/longitude` (MapPicker présent uniquement à la création) ni `gallery_urls` ; son payload les omet donc. Aucun formulaire ne permet de renseigner la galerie, et la page publique ne la rend pas (aucune référence à galleryUrls dans app/**/*.tsx) bien que l'API la retourne.

**Preuve.** edit L317-346 payload : title, description, dates, location, city, image_url, capacity, program, practical_info, services, ticket_categories — pas de category/latitude/longitude/gallery_urls ; API détail L172 `galleryUrls: event.gallery_urls || [],` sans consommateur.

**Impact.** Une erreur de catégorie ou de position carte à la création n'est pas corrigeable par le partenaire (la catégorie pilote le filtre du catalogue) ; la galerie promise par le modèle n'existe pas pour l'utilisateur.

**Recommandation.** Aligner le formulaire d'édition sur celui de création (catégorie, MapPicker) ; soit implémenter un composant multi-upload et l'affichage galerie sur la page publique, soit retirer gallery_urls du modèle.

### events-cdc-16 — Notifications de transition incomplètes : PUBLIE notifié en in-app seulement, TERMINE et retrait de soumission jamais notifiés, réactivation après suspension sans message dédié

- **Sévérité :** FAIBLE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §22 Notifications ; §31 Publication ; §150 Communications automatisées
- **Emplacement :** lib/events/event.service.ts — lignes 818-923
- **Catégorie :** notifications

**Description.** Le bloc de notifications couvre VALIDE (triple canal), rejet EN_ATTENTE→BROUILLON par admin (triple canal), SUSPENDU (triple canal) et PUBLIE (in-app uniquement, message identique pour une première publication et une réactivation SUSPENDU→PUBLIE). Aucune notification pour TERMINE (ni partenaire ni clients) ; le retrait d'une soumission par le partenaire (EN_ATTENTE→BROUILLON, L761-762) n'informe pas les admins qui ont reçu l'alerte de soumission.

**Preuve.** L892-900 `} else if (newStatus === 'PUBLIE') { await NotificationService.createNotification({ … title: 'Événement en ligne !' … }); }` sans SMS/email ; aucune branche `newStatus === 'TERMINE'` ; L903-904 notification admins uniquement `if (newStatus === 'EN_ATTENTE' && currentStatus === 'BROUILLON')`.

**Impact.** Le partenaire peut ignorer la mise en ligne effective (pas de SMS/email) ; les admins conservent une alerte de validation pour un événement retiré ; les clients ne sont pas informés de la clôture.

**Recommandation.** Compléter la matrice : PUBLIE (SMS + email partenaire, message distinct pour réactivation), TERMINE (partenaire + éventuellement clients), retrait de soumission (admins) ; centraliser la matrice statut → canaux dans une table de configuration.

### events-cdc-17 — Robustesse API/UI : paramètre `status` de la liste partenaire non validé (erreur 500 enum), recherche ilike non échappée, message d'inéditabilité contradictoire avec les règles serveur

- **Sévérité :** FAIBLE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** N/A (qualité)
- **Emplacement :** lib/events/event.service.ts — lignes 196-202 ; app/api/partner/events/route.ts 19-22 ; app/partner/events/[id]/edit/page.tsx 389-391 ; event.service.ts 254-258
- **Catégorie :** robustesse / coherence-ui

**Description.** getPartnerEvents applique directement `status` et `search` reçus de la query string : une valeur de statut hors enum provoque une erreur Postgres (22P02) renvoyée en 500 ; les jokers `%`/`_` du terme de recherche ne sont pas échappés. Le formulaire d'édition affiche « Seuls les événements en Brouillon ou En attente sont éditables » alors que le service autorise aussi VALIDE, PUBLIE et SUSPENDU.

**Preuve.** L196-198 `if (options?.status && options.status !== 'TOUS') { query = query.eq('status', options.status); }` ; L201 `query.ilike('title', `%${options.search.trim()}%`)` ; edit L390 « Seuls les evenements en "Brouillon" ou "En attente" sont editables. » vs service L256 `if (existing.status === 'TERMINE' || existing.status === 'ANNULE') throw`.

**Impact.** Erreurs techniques exposées au partenaire, résultats de recherche imprévisibles avec `%`, et message trompeur sur les droits de modification.

**Recommandation.** Valider `status` avec z.enum([...EVENT_STATUSES, 'TOUS']) et échapper les jokers (ou utiliser textSearch) ; aligner le texte UI sur la règle réelle (seuls TERMINE/ANNULE non éditables).

## B. Conformité CDC Partie VI — Ticketing et modèle financier

**Synthèse de l'auditeur :** Audit CDC Partie VI (§35-41), modèle financier ticketing (§37, §79, §80, §82, Annexe C/F) et régularisation parrainage (§41, §82, §103). Points forts : FinancialCalculatorService.calculateTicketingFinancials reproduit exactement l'Annexe C (1 050 / 15,75 / 1 000 / 34,25) et est couvert par tests ; la génération des commissions N1/N2 est faite en base par trigger, idempotente (idempotency_key) et assise sur net_event_village_revenue ; le moteur d'annulation d'événement dispose de cashouts idempotents, d'un pre-flight trésorerie et d'un audit trail SQL sur payments/refunds/commissions. Constats majeurs : (1) l'hypothèse est CONFIRMÉE : pour un billet 1 000 F, checkout panier et payments/create débitent le client de 1 000 F (pas 1 050), persistent service_fee 50, aggregator_fee 15 (1,5 % × 1 000), net EV 35, partner_payout 950 — l'organisateur perd 5 % au lieu de recevoir 100 % ; le calcul conforme exécuté dans reserveTicketsAtomic n'est jamais persisté ; le guichet espèces enregistre net EV = 50 F sans flux plateforme (§76) et l'invitation 0 F avec ticket.price = 1 000 ; (2) aucune régularisation des commissions ni du revenu net sur remboursement (§82/§103 absents) ; (3) le remboursement unitaire ne déplace aucun argent mais marque PROCESSED ; (4) l'annulation rembourse par cashout les ventes espèces et les invitations depuis la trésorerie EV ; (5) l'opérateur (Wave/OM) n'est jamais persisté donc tout remboursement part via Wave ; (6) panier multi-catégories partiellement honoré sans remboursement ; (7) solde partenaire affiché sur prix facial mais non retirable (RPC commissions uniquement) ; (8) contrôles §35 (dates de vente, max_per_order, visibilité) appliqués après encaissement.

**Limites de couverture :** Lecture seule, suite de tests non exécutée, état réel de la base non vérifié (en particulier : présence effective de la clé ticketing_fee_config en production — elle n'est seedée que par la migration 0012, pas par supabase/seed.sql). Non couvert ou partiellement : lib/samirpay/client.ts (format des montants attendu par SamirPay, entiers ou décimaux — hypothèse non vérifiée pour le constat arrondis), vérification de signature du webhook (app/api/webhooks/samirpay), RLS, interface Superadmin d'édition de platform_settings (seule l'API /api/admin/pricing a été lue), contenu exact des SMS/emails (NotificationService), transferts P2P et leur interaction avec les remboursements, interne du Z de caisse (lib/shifts au-delà de recordCashPayment), flux abonnements/commandes/salles, exports comptables partenaires. PaymentService.processRefund (L1072-1176) n'est appelé par aucun code applicatif (uniquement des tests) : il n'a pas été audité en profondeur car hors chemin réel. Le point « frais de service remboursés ou non » (§41) n'est pas tranché par le CDC ; le code actuel ne facture pas de frais au client donc la question ne se pose pas encore, mais elle devra être spécifiée lors de la mise en conformité du modèle §79.

### ticketing-finance-1 — Frais de service 5 % prélevés sur l'organisateur au lieu d'être facturés au client : modèle §37/§79 inversé (hypothèse confirmée)

- **Sévérité :** CRITIQUE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §37, §79, §111, Annexe C, Annexe F
- **Emplacement :** app/api/checkout/route.ts (et lib/payments/payment.service.ts) — lignes checkout L155-162, L179, L183-187, L240-241 ; payment.service.ts L248-255, L285, L289-293, L345
- **Catégorie :** conformité-financière

**Description.** Les deux chemins d'achat en ligne calculent les frais sur le prix facial, les retirent du reversement organisateur et envoient à SamirPay le seul prix facial. Pour un billet de 1 000 FCFA : amount (client débité) = 1 000 ; aggregator_fee = 15 (1,5 % × 1 000) ; service_fee = 50 ; gross = 50 ; net_event_village_revenue = 35 ; partner_payout_amount = 950. Le CDC exige : client 1 050 ; agrégateur 15,75 (1,5 % × 1 050) ; organisateur 1 000 ; EV 34,25. Le calcul conforme existe (FinancialCalculatorService.calculateTicketingFinancials) mais n'est utilisé que pour l'affichage des tableaux de bord. Affichage client (app/events/[id]/page.tsx L75, L697) = débit = stocké = prix facial : cohérent entre eux mais tous non conformes ; la page finance partenaire affirme pourtant « Frais service payés par l'acheteur » (app/partner/finance/page.tsx L318).

**Preuve.** const aggregatorFee = Math.round(payableAmount * aggregatorFeeRate * 100) / 100; const serviceFee = Math.round(payableAmount * serviceFeeRate * 100) / 100; const netRevenue = Math.max(0, grossRevenue - aggregatorFee); const partnerPayout = Math.max(0, payableAmount - serviceFee); ... .insert({ amount: payableAmount, ... partner_payout_amount: partnerPayout }) ... samirPayClient.initPayment({ amount: payableAmount

**Impact.** L'organisateur perd 5 % de chaque vente (950 au lieu de 1 000 F) ; Event Village n'encaisse pas les 50 F prévus auprès du client ; la base de commission parrainage est 35 F au lieu de 34,25 F (N1 5 % = 1,75 F au lieu de 1,71 F) ; les montants persistés dans payments contredisent les tableaux de bord qui recalculent 100 % du facial pour le partenaire (app/api/partner/finance/route.ts L95-97, L111) : deux vérités comptables pour la même vente.

**Recommandation.** Calculer via FinancialCalculatorService avec les taux platform_settings, envoyer buyerTotalPaid (1 050) à SamirPay, persister amount = 1 050, service_fee = 50, aggregator_fee = 15,75, partner_payout_amount = 1 000, net_event_village_revenue = 34,25 (ajouter une colonne facial_amount), afficher « Prix + frais de service » dans la page événement, PaymentModal, SMS et PDF ; prévoir un script de bascule et documenter le traitement des paiements historiques.

### ticketing-finance-3 — Annulation d'événement : les ventes guichet (espèces) et les invitations sont remboursées par cashout Mobile Money depuis la trésorerie Event Village

- **Sévérité :** CRITIQUE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §41, §76, §82
- **Emplacement :** lib/events/event-cancellation.service.ts (et lib/events/event.service.ts) — lignes event-cancellation.service.ts L261-278, L291, L305-387, L394-407, L445-478 ; event.service.ts L1222-1250, L1253-1279
- **Catégorie :** perte-financière

**Description.** cancelEvent collecte tous les payments status = SUCCESS liés par ticket_id ou metadata.event_id sans filtrer is_platform_payment ni amount > 0. Or le guichet insère des lignes payments CASH en status SUCCESS avec ticket_id et metadata.event_id (is_platform_payment false, aggregator GUICHET_PHYSIQUE), et les invitations des lignes amount 0 en SUCCESS. Ces lignes entrent dans totalRefundNeeded puis dans la boucle de cashout samirPayClient.sendCashout({ amount: Number(payment.amount) }) vers le téléphone de client_id.

**Preuve.** .from('payments').select('*').in('ticket_id', ticketIds).eq('status', 'SUCCESS') ... .contains('metadata', { event_id: eventId }) // aucun filtre is_platform_payment ; guichet : is_platform_payment: false, ... status: 'SUCCESS', metadata: { ..., event_id: params.eventId } ; cashout : amount: Number(payment.amount)

**Impact.** Pour un billet 1 000 F payé en espèces à l'organisateur, EV décaisse 1 000 F de son compte SamirPay (vers le porteur, ou vers le membre du staff si le billet a été émis via /api/events/[id]/tickets/purchase L27-33 où userId = user.id) ; les invitations déclenchent des cashouts de 0 F → refunds FAILED, alertes admin ; totalRefundNeeded gonflé → fausse alerte « TRÉSORERIE INSUFFISANTE » qui bloque les vrais remboursements.

**Recommandation.** Filtrer is_platform_payment = true AND amount > 0 AND payment_target = 'TICKET' ; pour les ventes espèces créer une ligne refunds « à rembourser par l'organisateur » sans cashout et notifier l'organisateur ; test d'annulation avec mix en ligne / guichet / invitation.

### ticketing-finance-4 — Opérateur Mobile Money jamais persisté : tous les remboursements partent par défaut via WAVE, y compris pour les clients Orange Money

- **Sévérité :** CRITIQUE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §41, §82, §148
- **Emplacement :** app/api/checkout/route.ts (et lib/payments/payment.service.ts, lib/events/event-cancellation.service.ts) — lignes checkout L171-199, L235-243 ; payment.service.ts L272-308, L340, L818-828, L607-611 ; event-cancellation.service.ts L439-443, L472-478, L648-654
- **Catégorie :** remboursement

**Description.** L'insert payments ne renseigne ni payment_method ni metadata.operator (metadata = target_type, event_id, checkout_items/quantity, held_expires_at, customer_*) ; le webhook SUCCESS ne stocke pas non plus l'opérateur. Tous les chemins de remboursement choisissent l'opérateur par `payment.payment_method?.toUpperCase().includes('ORANGE') || payment.metadata?.operator === 'ORANGE_MONEY'`, sinon 'WAVE'.

**Preuve.** let operator: SamirPayOperatorName = 'WAVE'; if (payment.payment_method?.toUpperCase().includes('ORANGE') || payment.metadata?.operator === 'ORANGE_MONEY') { operator = 'ORANGE_MONEY'; } // alors que l'insert ne contient ni payment_method ni metadata.operator

**Impact.** Un client ayant payé par Orange Money est « remboursé » par cashout Wave sur son numéro : échec (pas de compte Wave) ou crédit sur un portefeuille qu'il n'utilise pas ; si SamirPay accepte, le refund est marqué PROCESSED et la trésorerie EV est débitée sans que le client reconnaisse le remboursement.

**Recommandation.** Persister payment_method/metadata.operator à la création et confirmer au webhook (SamirPay renvoie l'opérateur) ; refuser tout cashout si l'opérateur est inconnu ; test de non-régression OM.

### ticketing-finance-5 — Remboursement unitaire d'un billet : ligne refunds marquée PROCESSED sans aucun cashout, paiement laissé en SUCCESS, billets de panier sans trace

- **Sévérité :** CRITIQUE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §41, §82
- **Emplacement :** lib/events/event.service.ts (route app/api/partner/events/[id]/tickets/[ticketId]/refund/route.ts L22-28) — lignes event.service.ts L1637-1771 (L1707-1731, L1735-1746) ; payment.service.ts L582-584, L823
- **Catégorie :** remboursement

**Description.** refundTicket passe le billet en REMBOURSE, décrémente sold_quantity, insère une ligne refunds status 'PROCESSED' et notifie le client « remboursé (X FCFA) », mais event.service.ts ne contient aucun appel SamirPay (grep samirPayClient/sendCashout : aucun) et ne modifie pas payments.status. De plus originalPayment est cherché par p.ticket_id === ticket.id alors que le webhook panier ne lie que le premier billet (ticket_id: confirmedTicketId) : les autres billets du panier n'ont aucune ligne refunds.

**Preuve.** await supabase.from('refunds').insert({ payment_id: originalPayment.id, refund_transaction_id: refundTxId, amount: refundAmount, reason: params.reason, status: 'PROCESSED', processed_by: params.operatorId }); ... message: `Votre billet n°${ticket.ticket_number} a été remboursé (${refundAmount} FCFA)`

**Impact.** Le client est informé d'un remboursement qu'il ne reçoit jamais ; la comptabilité affiche un remboursement exécuté fictif pendant que le paiement reste SUCCESS (revenu et commissions intacts) ; pour un panier de 3 billets, 2 remboursements n'ont aucune trace financière ; aucune distinction billets espèces / en ligne.

**Recommandation.** Réutiliser le moteur de cashout idempotent d'EventCancellationService (REFUND-TKT-<ticketId>, PENDING → PROCESSED/FAILED selon SamirPay), gérer le remboursement partiel d'un paiement panier (table de liaison payment_tickets ou metadata), passer payments en PARTIAL/REFUNDED, traiter les billets espèces comme remboursement hors plateforme.

### ticketing-finance-9 — Panier multi-catégories : succès partiel au webhook → paiement SUCCESS pour le montant total sans remboursement des billets non émis

- **Sévérité :** CRITIQUE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §36, §38, §41
- **Emplacement :** lib/payments/payment.service.ts — lignes L566-599, L601-602, L818-828
- **Catégorie :** perte-financière-client

**Description.** Dans le webhook, chaque item du panier est réservé dans un try/catch indépendant ; seule l'absence totale de billets (generatedTicketIds.length === 0) déclenche le remboursement automatique. Si une catégorie échoue (épuisée entre hold et webhook, sale_end dépassée, max_per_order), les autres sont émises et le paiement passe SUCCESS pour payment.amount complet.

**Preuve.** for (const item of items) { try { const purchaseResult = await EventService.reserveTicketsAtomic({...}) } catch (ticketError) { console.error(...) } finally { releaseHold... } } ... if (generatedTicketIds.length === 0) { /* auto-refund */ } ... .update({ status: 'SUCCESS', ... })

**Impact.** Un client paie 2 VIP + 3 Standard ; si Standard est épuisé, il reçoit 2 billets, le paiement est validé pour 5, aucun refund créé ni journalisé, commission parrainage calculée sur le total : perte sèche pour le client, litige SamirPay.

**Recommandation.** Comparer Σ quantités émises vs commandées ; créer un refund partiel (cashout du montant non honoré) + statut PARTIAL + notification explicite ; ou réserver toutes les catégories dans une RPC SQL transactionnelle tout-ou-rien.

### ticketing-finance-2 — Deux moteurs de calcul contradictoires : le calcul conforme de reserveTicketsAtomic n'est jamais persisté et ignore platform_settings (taux codés en dur)

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §75, §77, §79, §98
- **Emplacement :** lib/events/event.service.ts (et lib/payments/payment.service.ts) — lignes event.service.ts L1153-1159, L1324-1330 ; payment.service.ts L543-557, L572-589, L818-828
- **Catégorie :** intégrité-données

**Description.** reserveTicketsAtomic calcule des financials conformes (1 050 / 15,75 / 1 000 / 34,25) avec des défauts codés en dur (5.0 / 1.5) et les retourne ; le webhook qui l'appelle ne lit jamais purchaseResult.financials et la mise à jour finale du paiement n'écrit que status/ticket_id/provider_status. La ligne payments conserve donc les valeurs du constat précédent (950 / 15 / 35). Les dashboards (partner-dashboard.service.ts L245-249, partner/finance L95-97) recalculent à partir de tickets.price, jamais à partir de payments.

**Preuve.** serviceFeeRatePercent: params.serviceFeeRate ?? 5.0, aggregatorFeeRatePercent: params.aggregatorFeeRate ?? 1.5 ... return { tickets, ..., financials } // webhook : const purchaseResult = await EventService.reserveTicketsAtomic({...}); (financials jamais lu) ... .update({ status: 'SUCCESS', external_transaction_id, ticket_id: confirmedTicketId, provider_status, paid_at })

**Impact.** Les montants « conformes » sont purement décoratifs ; un changement de taux par le Superadmin n'est pas appliqué au guichet (service_fee espèces toujours 5 % en dur) ; le rapprochement financier §84 ne peut s'appuyer sur payments ; chaque rapport recalcule différemment.

**Recommandation.** Une seule source de vérité : calculer une fois côté service avec les taux DB, persister dans payments, et faire lire payments (SUM partner_payout_amount, net_event_village_revenue, refunds) par tous les rapports ; supprimer les défauts ?? 5.0 / ?? 1.5 (taux obligatoires passés par l'appelant ou chargés depuis platform_settings).

### ticketing-finance-6 — Aucune régularisation des commissions de parrainage ni du revenu net EV après remboursement (§82 / §103 non implémentés)

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §41, §82, §101, §102, §103
- **Emplacement :** supabase/migrations/0002_functions.sql (et services de remboursement) — lignes 0002_functions.sql L105-133, L169, L210, L222-235 ; event-cancellation.service.ts L500-506 ; event.service.ts L1680-1731 ; payment.service.ts L1127-1135 ; 0001_initial_schema.sql L610-613
- **Catégorie :** parrainage

**Description.** Le seul trigger parrainage se déclenche au passage à SUCCESS ; aucun trigger/fonction ne traite REFUNDED/PARTIAL. Le schéma prévoit status 'CANCELLED' et cancellation_reason, mais aucun code (lib/, app/, supabase/) n'y écrit. Les commissions sont insérées directement en 'AVAILABLE' (pas de délai 7-14 j §102) et donc immédiatement retirables via request_withdrawal (20260903_atomic_withdrawal_rpc.sql L37-41). net_event_village_revenue n'est jamais corrigé lors d'un remboursement.

**Preuve.** IF NEW.status = 'SUCCESS' AND (OLD.status IS NULL OR OLD.status != 'SUCCESS') THEN PERFORM calculate_referral_commissions(NEW.id); END IF; ... INSERT INTO referral_commissions (... status ...) VALUES (..., 'AVAILABLE', ...) // cancelEvent : .update({ status: 'REFUNDED' }) sans action commissions

**Impact.** Sur un événement annulé et intégralement remboursé, EV conserve des commissions N1/N2 AVAILABLE (déjà retirables) et un revenu net positif : EV paie des commissions sur un revenu restitué ; rapports §80/§84 surévalués ; impossibilité de « déduire du solde futur » (§103).

**Recommandation.** Fonction reverse_referral_commissions(p_payment_id) déclenchée sur REFUNDED/PARTIAL : CANCELLED si non payée, sinon commission négative/déduction FIFO du solde futur avec journalisation ; commissions créées en PENDING avec available_at = now() + 7..14 j ; recalculer net_event_village_revenue (ou colonne refunded_amount) à chaque refund PROCESSED.

### ticketing-finance-7 — Les ventes guichet en espèces génèrent un « revenu Event Village » de 5 % alors qu'aucun flux ne transite par la plateforme (§76)

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §76, §75, §84, §101
- **Emplacement :** lib/events/event.service.ts (et app/api/admin/metrics/route.ts) — lignes event.service.ts L1218-1250 (L1235-1238) ; admin/metrics/route.ts L22, L58
- **Catégorie :** conformité-financière

**Description.** Pour un billet payant émis au guichet, une ligne payments CASH (is_platform_payment false, aggregator GUICHET_PHYSIQUE) est créée avec service_fee, gross et net_event_village_revenue = 5 % du prix et partner_payout_amount = prix facial. Les métriques admin additionnent payments.amount SUCCESS sans filtre is_platform_payment.

**Preuve.** aggregator: 'GUICHET_PHYSIQUE', aggregator_fee: 0, service_fee: financials.serviceFeeAmount / requestedQty, gross_event_village_revenue: financials.serviceFeeAmount / requestedQty, net_event_village_revenue: financials.serviceFeeAmount / requestedQty, partner_payout_amount: ticketPrice // admin : supabase.from('payments').select('amount').eq('status', 'SUCCESS')

**Impact.** Pour 1 000 F en espèces : net EV 50 F + reversement 1 000 F = 1 050 F « répartis » sur 1 000 F encaissés par l'organisateur seul ; le volume plateforme admin inclut les espèces ; rapprochement §84 faux ; toute relance batch des commissions ne serait protégée que par le test is_platform_payment.

**Recommandation.** service_fee / gross / net = 0 pour is_platform_payment = false (si EV doit facturer les ventes guichet, le faire via une facture organisateur distincte et documentée) ; filtrer is_platform_payment = true dans tous les agrégats « revenu/volume Event Village ».

### ticketing-finance-8 — Solde partenaire calculé sur le prix facial de tous les billets (y compris espèces et invitations) et non retirable : la RPC de retrait ne lit que les commissions de parrainage

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §79, §81, §83, §76
- **Emplacement :** app/api/partner/finance/route.ts (et supabase/migrations/20260903_atomic_withdrawal_rpc.sql, lib/payments/withdrawal.service.ts) — lignes finance/route.ts L60-66, L95-97, L111, L121 ; 20260903_atomic_withdrawal_rpc.sql L37-56 ; withdrawal.service.ts L78-85, L148 ; app/api/withdrawals/request/route.ts L19-25 ; app/partner/finance/page.tsx L150, L466-471 ; event.service.ts L1175, L1259
- **Catégorie :** finance-partenaire

**Description.** La page finance partenaire calcule soldeDisponible = Σ tickets.price (VALIDE/UTILISE, donc billets espèces et invitations dont ticket.price = prix facial alors que payments.amount = 0) − retraits ; le formulaire de retrait appelle /api/withdrawals/request → request_withdrawal qui ne somme que referral_commissions AVAILABLE. partner_payout_amount (950 F) n'est consommé nulle part.

**Preuve.** from('tickets').select('price').in('event_id', eventIds).in('status', ['VALIDE','UTILISE']) ... soldeDisponible = Math.max(0, netRevenue - totalWithdrawn - pendingAmount) // RPC : SELECT COALESCE(SUM(amount),0) INTO v_total_available FROM referral_commissions WHERE sponsor_id = p_user_id AND status = 'AVAILABLE'

**Impact.** Un organisateur voit un solde de 100 000 F (dont espèces déjà encaissées et invitations à 0 F) mais toute demande échoue « Solde insuffisant » ; aucun mécanisme de reversement organisateur n'existe ; si la RPC était alignée sur ce solde, émettre des invitations permettrait de retirer de l'argent jamais encaissé.

**Recommandation.** Ledger organisateur basé sur payments (SUM partner_payout_amount WHERE is_platform_payment AND status IN ('SUCCESS','PARTIAL') − refunds PROCESSED) ; séparer solde organisateur et solde parrainage dans request_withdrawal ; exclure cash/invitation ; afficher les ventes espèces comme « encaissées hors plateforme ».

### ticketing-finance-10 — Contrôles §35 (fenêtre de vente, max_per_order, visibilité) appliqués seulement après encaissement : débit puis remboursement automatique

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §35, §36, §38, §41
- **Emplacement :** app/api/checkout/route.ts (et lib/payments/payment.service.ts, lib/events/event.service.ts) — lignes checkout L10-15, L57-96, L208-222 ; payment.service.ts L163-196, L318-325, L540-599, L601-745 ; event.service.ts L1005-1011, L1025-1027, L1446-1460
- **Catégorie :** parcours-achat

**Description.** Avant d'initier le paiement, checkout et createPayment ne vérifient que is_active et le stock ; le schéma accepte quantity ≤ 20 ; verifyAndEnforceHoldAtomic ne vérifie pas davantage. sale_start/sale_end, max_per_order et is_visible ne sont contrôlés que dans reserveTicketsAtomic, exécuté au webhook après encaissement ; l'échec aboutit au chemin « overbooking » (cashout automatique + SMS « billets épuisés »).

**Preuve.** if (!category.is_active) {...} const availableStock = ... // seuls contrôles ; reserveTicketsAtomic : if (category.sale_end && new Date(category.sale_end) < new Date()) throw ...; if (requestedQty > maxPerOrder) throw ... ; webhook : if (generatedTicketIds.length === 0) { ... Déclenchement du remboursement automatique

**Impact.** Un client peut payer 20 billets d'une catégorie limitée à 4 (défaut UI app/partner/events/new/page.tsx L161) ou une catégorie close/masquée : argent débité puis remboursé (frais agrégateur perdus à l'aller et au retour, trésorerie EV sollicitée), message trompeur « billets épuisés » (L713-715), tickets support si le cashout échoue.

**Recommandation.** Fonction partagée assertCategoryPurchasable(category, qty) (is_active, is_visible, sale_start/sale_end, max_per_order, stock − held) appelée dans checkout, createPayment et verifyAndEnforceHoldAtomic avant tout insert payments / initPayment.

### ticketing-finance-11 — Dates de début/fin de vente (§35) non modifiables après création : ni l'écran d'édition ni l'API PATCH catégorie ne les exposent

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §35
- **Emplacement :** app/api/partner/events/[id]/categories/[categoryId]/route.ts (et lib/events/event.service.ts, app/partner/events/[id]/edit/page.tsx) — lignes [categoryId]/route.ts L20-31 ; event.service.ts L500-512, L261-276, L279-315 ; edit/page.tsx L33-42, L233-236
- **Catégorie :** conformité-fonctionnelle

**Description.** Les dates sont saisissables à la création (new/page.tsx L1045-1057) et stockées (event.service L162, L638) mais le PATCH catégorie ne transmet que total_quantity/is_active/is_visible/price/description, updateCategoryStockAndStatus ne gère pas sale_start/sale_end, l'écran d'édition n'a pas ces champs, et updateEvent refuse ticket_categories pour un événement PUBLIE tout en ignorant ce champ pour les autres statuts.

**Preuve.** { total_quantity: ..., is_active: ..., is_visible: ..., price: ..., description: ... } // PATCH ; updateEvent : allowedFieldsForPublished = new Set([...]) sans ticket_categories, et aucun traitement de input.ticket_categories dans updateData

**Impact.** Prolonger ou corriger une fenêtre de vente (cas fréquent) impose de fermer et recréer la catégorie (perte de l'historique sold_quantity) ; les quotas/prix envoyés par l'écran d'édition sont silencieusement ignorés par updateEvent.

**Recommandation.** Ajouter sale_start/sale_end/max_per_order au PATCH catégorie et à l'UI d'édition avec validation (sale_end > sale_start, sale_end ≤ fin d'événement) ; soit traiter ticket_categories dans updateEvent, soit retirer le champ de l'écran d'édition.

### ticketing-finance-12 — Frais agrégateur non configurables par moyen de paiement : taux unique quel que soit Wave / Orange Money / Carte

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §77, §184
- **Emplacement :** supabase/migrations/0012_platform_financial_settings.sql (et app/api/checkout/route.ts, lib/payments/payment.service.ts) — lignes 0012 L11-14 ; checkout L156-158 ; payment.service.ts L249-251 ; lib/validations/payment.ts L22
- **Catégorie :** configuration

**Description.** ticketing_fee_config ne contient qu'un aggregator_fee_rate ; les deux chemins lisent ce taux sans tenir compte de l'opérateur (WAVE, ORANGE_MONEY, CARD accepté par le schéma).

**Preuve.** '{"service_fee_rate": 5.0, "aggregator_fee_rate": 1.5, ...}' ... const aggregatorFeeRate = Number(ticketingConfig?.value?.aggregator_fee_rate || 1.5) / 100; // aucune référence à operator

**Impact.** Si les opérateurs facturent des taux différents, le revenu net EV et la base de commission sont faux transaction par transaction ; le Superadmin n'a aucun levier (l'API /api/admin/pricing accepte un JSON libre mais le code ne lit qu'une clé).

**Recommandation.** Structure aggregator_fee_rates: { WAVE, ORANGE_MONEY, CARD } lue selon l'opérateur effectif (persisté, cf. constat opérateur) ; recalcul au webhook si l'opérateur final diffère de celui demandé.

### ticketing-finance-13 — Statistiques partenaire : billets REMBOURSE comptés comme ventes et chiffre d'affaires (transaction non corrigée)

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §82, §158, §160
- **Emplacement :** app/api/partner/metrics/route.ts — lignes L66-72 (comparer lib/partner/partner-dashboard.service.ts L239-243)
- **Catégorie :** reporting

**Description.** /api/partner/metrics exclut seulement ANNULE : les billets REMBOURSE restent dans ticketsSold et ticketRevenue, alors que partner-dashboard.service ne garde que VALIDE/UTILISE.

**Preuve.** .in('event_id', eventIds).neq('status', 'ANNULE'); ticketsSold = tickets?.length || 0; ticketRevenue = tickets?.reduce((acc, t) => acc + (Number(t.price) || 0), 0)

**Impact.** Après un remboursement, le partenaire voit deux chiffres différents (metrics vs dashboard) et un CA brut surévalué.

**Recommandation.** Filtrer status IN ('VALIDE','UTILISE') et centraliser le calcul dans un seul service lisant payments/refunds.

### ticketing-finance-14 — Montants à 2 décimales (centimes) en XOF sans règle d'arrondi centralisée

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** moyenne
- **Référence CDC :** §79, §94, Annexe C
- **Emplacement :** lib/payments/financial-calculator.service.ts (et checkout, event.service.ts, 0002_functions.sql, 0001_initial_schema.sql) — lignes financial-calculator.service.ts L65-75 ; checkout L158-159 ; event.service.ts L1235-1237 ; 0002_functions.sql L144, L185 ; 0001_initial_schema.sql L317
- **Catégorie :** robustesse

**Description.** Tous les calculs produisent des centimes (toFixed(2), Math.round(x*100)/100, division non arrondie service_fee / requestedQty, ROUND(...,2) pour les commissions → 1,71 F) et ticket_categories.price est NUMERIC(12,2) sans contrainte d'entier. Le CDC lui-même cite 15,75 F, mais le FCFA n'a pas de subdivision et un cashout/débit Mobile Money doit être entier.

**Preuve.** const aggregatorFeeAmount = Number((buyerTotalPaid * (aggregatorFeeRatePercent / 100)).toFixed(2)); ... service_fee: financials.serviceFeeAmount / requestedQty ... v_comm_n1_amount := ROUND((v_payment.net_event_village_revenue * (v_rel_n1.rate_n1_at_creation / 100.00)), 2);

**Impact.** Dès l'application du modèle §79, un prix 1 250 F donne 62,5 F de frais et un total client 1 312,5 F impossible à débiter ; commissions de 1,71 F cumulées puis retirées avec arrondis FIFO (withdrawal.service L261) ; écarts de centimes dans les rapprochements.

**Recommandation.** Règle unique validée avec le client : montants client et cashouts entiers (arrondi des frais au FCFA supérieur, des commissions au FCFA inférieur), CHECK price = trunc(price), appliquée dans calculateTicketingFinancials et la fonction SQL de commissions ; ligne d'écart d'arrondi si des sous-répartitions décimales sont conservées.

### ticketing-finance-15 — Taux de frais : fallback silencieux 5 % / 1,5 % dans le checkout panier alors que payments/create refuse sans configuration ; un taux à 0 est ignoré

- **Sévérité :** FAIBLE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §77, §98
- **Emplacement :** app/api/checkout/route.ts (et lib/payments/payment.service.ts, lib/partner/partner-dashboard.service.ts, supabase/seed.sql) — lignes checkout L149-156 ; payment.service.ts L236-245 ; partner-dashboard.service.ts L219-221 ; seed.sql (clé ticketing_fee_config absente, seedée uniquement par migration 0012 L11-14)
- **Catégorie :** robustesse

**Description.** Le checkout et le dashboard appliquent des défauts implicites avec `||` quand la clé est absente ou vaut 0, tandis que createPayment lève une erreur bloquante.

**Preuve.** const serviceFeeRate = Number(ticketingConfig?.value?.service_fee_rate || 5) / 100; // vs payment.service : throw new Error('Configuration des frais de paiement manquante. Contactez le support.')

**Impact.** Comportements divergents entre panier et achat unitaire si platform_settings est incomplet ; impossibilité pour le Superadmin de fixer un taux à 0 % (0 est falsy → 5 % appliqué).

**Recommandation.** Helper unique getTicketingFeeConfig() strict (erreur explicite), opérateur ?? au lieu de ||, test d'intégration vérifiant la présence des clés et ajout de la clé dans seed.sql.

### ticketing-finance-16 — Panier mixte gratuit + payant : billets gratuits émis et notifiés avant la validation du paiement, même si la partie payante échoue

- **Sévérité :** FAIBLE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §36, §38
- **Emplacement :** app/api/checkout/route.ts — lignes L98-133, L203-206, L219-222, L256-273
- **Catégorie :** parcours-achat

**Description.** Les billets gratuits sont réservés (paymentConfirmed: true) et les notifications SMS/email envoyées avant le bloc payant ; si l'insert payments, le hold ou l'API SamirPay échoue, la route renvoie une erreur sans mentionner les billets gratuits déjà émis.

**Preuve.** for (const item of freeItems) { const purchaseResult = await EventService.reserveTicketsAtomic({ ..., paymentConfirmed: true }); ... } ... if (insertError || !paymentRecord) { return NextResponse.json({ error: "Impossible d'enregistrer l'intention de paiement." }, { status: 500 }); }

**Impact.** Le client voit une erreur et resoumet → doublons de billets gratuits (jusqu'à max_per_order), stock gratuit consommé, notifications déjà parties.

**Recommandation.** Émettre les gratuits après l'initialisation réussie du paiement (ou au webhook), ou retourner freeTickets dans la réponse d'erreur et empêcher la re-soumission côté client.

## C. Sécurité du paiement, du webhook et du stock

**Synthèse de l'auditeur :** Points forts : le montant payé n'est jamais dicté par le client (recalculé depuis PostgreSQL), l'incrément de sold_quantity est protégé par un Compare-And-Swap avec retry et par la contrainte CHECK (sold_quantity + held_quantity <= total_quantity), et les clés SamirPay restent strictement côté serveur avec un garde d'idempotence sur l'état SUCCESS. En revanche, la chaîne paiement → webhook → émission de billets présente des défauts majeurs : le webhook POST /api/webhooks/samirpay n'authentifie pas l'émetteur (signature optionnelle jamais vérifiée, SAMIRPAY_WEBHOOK_SECRET inutilisé, aucune vérification de la transaction auprès de SamirPay), la transition PENDING→SUCCESS n'est pas atomique (double émission possible sur webhooks concurrents), un throw avalé dans verifyAndEnforceHoldAtomic supprime le paiement tout en laissant le client payer (argent encaissé sans trace ni billet), la route publique /api/payments/[id]/status marque SUCCESS sans émettre les billets puis court-circuite le webhook, et cleanupExpiredHolds n'est appelé par aucun cron, ce qui permet un blocage définitif du stock par simple abandon ou inondation de paniers. S'ajoutent des fuites de held_quantity (échec SamirPay niveau body, panier multi-catégories), un double décrément du hold au succès, un mécanisme d'auto-remboursement qui envoie toujours le cashout sur WAVE et, à défaut de téléphone, vers le numéro fictif 770000000, une injection de filtre PostgREST sur order_id/transactionId, et une policy RLS autorisant tout client authentifié à insérer des lignes arbitraires dans payments.

**Limites de couverture :** Non couvert : exécution des tests (interdite) ; contrat réel de l'API SamirPay (nom de l'en-tête de signature, format HMAC, sémantique des retries, réponse attendue du statut) — les constats H1/H12 sont établis sur l'absence de tout contrôle dans le code, pas sur la doc fournisseur ; état réel des policies RLS déployées en base (audit sur les fichiers de migration uniquement) ; calculs du Z de caisse (lib/shifts/shift.service.ts) et de l'annulation/remboursement massif (lib/events/event-cancellation.service.ts) qui relèvent d'une autre dimension — seul le point de contact 'billets CASH émis via /api/events/[id]/tickets/purchase' a été regardé ; agrégats du dashboard partenaire (lib/partner/partner-dashboard.service.ts) seulement survolés ; l'injection PostgREST n'a pas été testée en live (constat fondé sur la construction de la chaîne .or() non échappée) ; le hook usePaymentStatus s'abonne à toutes les mises à jour de la table payments sans filtre (hooks/usePaymentStatus.ts L82-88), la fuite éventuelle dépend de la policy payments_read et n'a pas été approfondie ; la configuration cron de l'hébergeur n'a pas pu être vérifiée au-delà de l'absence de vercel.json, de workflows GitHub et de pg_cron dans le dépôt.

### payment-security-1 — Webhook SamirPay non authentifié : n'importe qui peut déclarer un paiement SUCCESS et obtenir des billets gratuits

- **Sévérité :** CRITIQUE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** architecture.md §15 (étape 10 'Backend vérifie la transaction'), §16 (étape 4 'vérifier l'état réel de la transaction'), §17 ; CDC §38, §75, Partie XVII §152/§155
- **Emplacement :** lib/payments/payment.service.ts — lignes L488-517 (et lib/validations/payment.ts L41-54, app/api/webhooks/samirpay/route.ts L6-12, middleware.ts L6)
- **Catégorie :** Sécurité paiement / authentification webhook

**Description.** Le handler accepte un formulaire x-www-form-urlencoded contenant transaction_id, order_id et status. Le champ signature est déclaré optionnel dans SamirPayWebhookSchema (lib/validations/payment.ts L53) et n'est lu nulle part. La variable SAMIRPAY_WEBHOOK_SECRET existe dans .env.example (L19) mais une recherche sur tout le dépôt montre qu'elle n'est utilisée par aucun fichier de code. La méthode samirPayClient.checkTransactionStatus (lib/samirpay/client.ts L193) n'est jamais appelée depuis le webhook : le statut reçu est mappé (L514) et directement exécuté (L517 → génération des billets L543/L572, passage SUCCESS L818-828). Le montant et la devise du webhook (amount, currency) ne sont jamais comparés à payment.amount. La route est publique (middleware.ts L6 '/api/webhooks') et répond 200 dans tous les cas.

**Preuve.** lib/validations/payment.ts L53 : `signature: z.string().optional(),` — payment.service.ts L494 : `const { transaction_id, order_id, status } = validationResult.data;` puis L514 `const mappedStatus = mapSamirPayStatus(status);` L517 `if (mappedStatus === 'SUCCESS') {` ... L543 `EventService.reserveTicketsAtomic({... paymentConfirmed: true})` — aucun appel à checkTransactionStatus ni à une vérification HMAC entre L488 et L517.

**Impact.** Un client crée un checkout (il reçoit transaction_id/order_id dans la réponse L309-323), ne paie pas, puis envoie lui-même `POST /api/webhooks/samirpay` avec order_id=son ORD-EV-… et status=success : les billets sont émis (VALIDE), le paiement passe SUCCESS, les commissions de parrainage sont calculées par trigger (0002_functions.sql L232-235), le partenaire est crédité d'un payout fictif. Perte financière directe pour le partenaire et la plateforme, billets valides au scan.

**Recommandation.** 1) Rendre la signature obligatoire et la vérifier en HMAC (clé SAMIRPAY_WEBHOOK_SECRET) sur le corps brut avec comparaison en temps constant (crypto.timingSafeEqual), rejeter en 401 sinon ; 2) indépendamment de la signature, appeler samirPayClient.checkTransactionStatus(payment.external_order_id) côté serveur et n'accepter SUCCESS que si SamirPay le confirme ET que amount/currency correspondent à payment.amount/currency ; 3) restreindre par IP allowlist si le fournisseur la publie ; 4) ajouter un test d'intrusion 'webhook forgé sans signature → 401, aucun billet'.

### payment-security-2 — Throw avalé dans verifyAndEnforceHoldAtomic : le paiement est supprimé mais le client est quand même envoyé payer (argent encaissé sans billet ni trace)

- **Sévérité :** CRITIQUE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** architecture.md §20 (disponibilités côté serveur), §21 (concurrence) ; CDC §36 ('paie ; reçoit son ticket'), §75
- **Emplacement :** lib/events/event.service.ts — lignes L1518-1582 (throws L1534-1535, L1564-1565, L1574-1575 englobés par le catch L1578-1580) ; app/api/checkout/route.ts L209-222, L237-255, L301-307
- **Catégorie :** Intégrité stock / perte d'argent

**Description.** L'étape 3 (CAS sur held_quantity) est entièrement enveloppée dans un `try { … } catch { /* colonne held_quantity non configurée */ }`. Les trois `throw new Error('Stock insuffisant …')` situés à l'intérieur de ce try (après `supabase.from('payments').delete()`) sont donc interceptés par le catch vide, et la fonction se termine par `return true` (L1582). L'appelant (checkout L211) ne voit aucune erreur, continue vers samirPayClient.initPayment (L239) avec l'order_id du paiement déjà supprimé, puis fait un `update().eq('id', paymentRecord.id)` qui ne touche 0 ligne sans erreur (L301-307) et renvoie success:true avec payment_url au client (L309-323). Ce chemin est atteint dès que sold + held_quantity + quantité > total, ce qui arrive en exploitation normale : l'étape 2 ignore les holds de plus de 10 min (L1486-1490) alors que la colonne held_quantity, jamais nettoyée (cf. constat cron), les compte toujours.

**Preuve.** L1533-1535 : `if (currentSold + currentHeld + params.quantity > currentTotal) { await supabase.from('payments').delete().eq('id', params.paymentId); throw new Error(\`Stock insuffisant …\`); }` — L1578-1580 : `} catch { // colonne held_quantity non configurée en base }` — L1582 : `return true;` — checkout L239 : `samirPayResponse = await samirPayClient.initPayment({ … order_id: externalOrderId …})` exécuté après le hold.

**Impact.** Le client paie réellement via Wave/OM ; au webhook, `.or(external_order_id.eq.…)` ne trouve rien (L503-506 'Transaction introuvable'), aucun billet n'est émis, aucun remboursement automatique n'est déclenché (ce chemin n'existe que si le paiement existe), et la seule trace est une ligne audit_logs DELETE. Perte d'argent client, litiges, impossibilité de rapprochement.

**Recommandation.** Sortir les throws du try/catch (ne capturer que l'erreur de lecture de colonne, puis exécuter le CAS hors du try), ou mieux : remplacer l'ensemble étape 2 + étape 3 par une fonction SQL `reserve_hold(category_id, qty, payment_id)` exécutée en transaction avec `UPDATE ticket_categories SET held_quantity = held_quantity + qty WHERE id = … AND sold_quantity + held_quantity + qty <= total_quantity RETURNING …` et insertion du paiement PENDING dans la même transaction ; ne jamais appeler initPayment si le hold n'a pas été confirmé. Ajouter un test : held_quantity pré-rempli à total-1, checkout de 2 → 400 et aucun appel SamirPay.

### payment-security-3 — Route publique /api/payments/[id]/status : passe le paiement en SUCCESS sans émettre les billets, puis le webhook se court-circuite (client débité, aucun billet)

- **Sévérité :** CRITIQUE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** architecture.md §15 (étapes 10-12), §16 (étapes 5-7), §17 ('transitions contrôlées côté serveur') ; CDC §36
- **Emplacement :** app/api/payments/[transactionId]/status/route.ts — lignes L38-57 (et lib/payments/payment.service.ts L509-512, hooks/usePaymentStatus.ts L120-124, components/payment/PaymentModal.tsx L85-93, middleware.ts L10)
- **Catégorie :** Intégrité paiement / fulfilment

**Description.** Si le paiement est PENDING, la route appelle checkTransactionStatus et, si SamirPay répond un statut mappé SUCCESS, exécute `payments.update({ status: 'SUCCESS', paid_at … })` (L45-54) sans aucune logique métier : pas de reserveTicketsAtomic, pas de libération du hold, pas de confirmation de commande/abonnement. Le webhook, lorsqu'il arrive ensuite, lit `payment.status === 'SUCCESS'` et retourne 'Transaction déjà confirmée' (payment.service.ts L509-512) sans rien faire. Le frontend sonde cette route toutes les 4 s (usePaymentStatus L120-124) et PaymentModal toutes les POLL_INTERVAL_MS (L85-93) : la course est très souvent gagnée par le polling, l'API de statut du fournisseur étant mise à jour avant l'envoi du webhook. La route est de plus accessible sans authentification (middleware.ts L10 rend '/api/payments' public, la route n'appelle pas getServerSessionUser) et checkTransactionStatus ne vérifie pas que l'order_id renvoyé correspond à celui demandé (client.ts L206-218).

**Preuve.** status/route.ts L43-56 : `if (mapped === 'SUCCESS') { await supabase.from('payments').update({ status: 'SUCCESS', … paid_at: new Date().toISOString() … }).eq('id', payment.id); payment.status = 'SUCCESS'; }` — payment.service.ts L509-512 : `if (payment.status === 'SUCCESS') { … return { success: true, message: 'Transaction déjà confirmée.' }; }`

**Impact.** Le client voit l'écran de succès (PaymentModal L90-93 → onPaymentSuccess) mais ne reçoit jamais de billet ; le hold reste posé ; le trigger de parrainage calcule des commissions sur un paiement sans livraison ; aucune alerte, aucun remboursement automatique. Perte d'argent client et litiges massifs dès la mise en production.

**Recommandation.** La route de statut doit être en lecture seule et authentifiée (vérifier que payment.client_id === user.id). Si un rapprochement actif est souhaité, déléguer au même service de fulfilment que le webhook (ex. `paymentService.confirmPayment(payment, providerStatus)`) qui encapsule hold/billets/commande/abonnement dans une transition atomique PENDING→SUCCESS. Vérifier dans checkTransactionStatus que `order_id` de la réponse === order_id demandé. Ajouter un test 'statut SUCCESS via polling → billets émis exactement une fois, puis webhook → idempotent'.

### payment-security-4 — Transition PENDING→SUCCESS non atomique : deux webhooks concurrents (retry fournisseur ou rejeu) émettent deux fois les billets et peuvent déclencher deux cashouts

- **Sévérité :** CRITIQUE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** architecture.md §16 ('un même webhook reçu plusieurs fois ne doit jamais créer … deux tickets'), §21 ; CDC §75
- **Emplacement :** lib/payments/payment.service.ts — lignes L497-512 (lecture), L543-557 et L572-589 (émission), L636-642 (cashout), L818-828 (update sans condition d'état)
- **Catégorie :** Idempotence / concurrence

**Description.** L'idempotence repose uniquement sur une lecture `select('*')` suivie de `if (payment.status === 'SUCCESS') return`. Il n'y a ni verrou (SELECT … FOR UPDATE / pg_advisory_xact_lock), ni UPDATE conditionnel `.eq('status','PENDING')` avant l'émission, ni table de journal des webhooks avec contrainte d'unicité. L'update final (L818-828) ne filtre que sur `.eq('id', payment.id)`. Entre la lecture (L497) et l'écriture (L818) s'écoulent plusieurs centaines de millisecondes (CAS sur ticket_categories, insert tickets, notifications SMS/email), fenêtre largement suffisante pour qu'un second POST identique lise encore PENDING. Le même défaut s'applique au chemin overbooking (L602-745) : deux exécutions concurrentes envoient deux `sendCashout` du montant intégral (L636-642) sans clé d'idempotence côté fournisseur.

**Preuve.** L497-501 : `const { data: payment } = await supabase.from('payments').select('*').or(…).single();` — L509 : `if (payment.status === 'SUCCESS') {` — L818-828 : `.update({ status: 'SUCCESS', … }).eq('id', payment.id);` (aucun `.eq('status', 'PENDING')`).

**Impact.** Pour un seul paiement : 2×N billets VALIDE émis (sold_quantity consommé deux fois, survente réelle du stock partenaire), ou double remboursement en cash-out (perte sèche sur le float SamirPay). Exploitable par n'importe qui tant que le webhook n'est pas signé (constat précédent), et déclenchable par les retries légitimes du fournisseur.

**Recommandation.** Réserver le traitement par un UPDATE conditionnel atomique avant toute action : `UPDATE payments SET status='PROCESSING', provider_status=… WHERE id=… AND status IN ('PENDING','FAILED','CANCELLED') RETURNING *` ; si 0 ligne → répondre 'déjà traité'. Alternativement `pg_advisory_xact_lock(hashtext(order_id))` dans une fonction SQL de confirmation. Journaliser chaque webhook dans une table `payment_webhook_events(provider, transaction_id, status, raw_body, UNIQUE(provider, transaction_id, status))` et rejeter les doublons avant traitement. Donner une clé d'idempotence au cashout (refundTxId) si l'API SamirPay le permet.

### payment-security-5 — cleanupExpiredHolds n'est appelé par aucun cron : les holds abandonnés bloquent le stock définitivement et permettent un déni de vente par inondation de paniers

- **Sévérité :** CRITIQUE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** architecture.md §20, §21 ; CDC Partie XVI §146/§148 (expiration automatique), §36
- **Emplacement :** lib/payments/payment.service.ts — lignes L983-1035 (définition) ; appelants : aucun hors tests (tests/hold-cart-stock.test.ts L280, L423) ; app/api/cron ne contient que moratoriums/route.ts et ticket-transfers/route.ts ; app/api/checkout/route.ts L10-15, L189, L209-217
- **Catégorie :** Intégrité stock / disponibilité

**Description.** La recherche exhaustive de `cleanupExpiredHolds` dans le dépôt ne retourne que sa définition et deux appels dans les tests. Aucun vercel.json, aucun workflow GitHub, aucun pg_cron dans supabase/migrations. La colonne physique ticket_categories.held_quantity, incrémentée au checkout (event.service.ts L1538-1549), n'est décrémentée que par un webhook SamirPay (succès/échec) — or un push USSD Orange Money non confirmé ou une page Wave fermée ne génère pas forcément de webhook. Côté API, aucune idempotence : `idempotency_key: IDEMP-${externalOrderId}` est aléatoire par appel (checkout L165-167, L189), la quantité par ligne va jusqu'à 20 (L14) sans contrôle de max_per_order, et il n'y a pas de rate limit sur /api/checkout. Un simple client (ou un script) peut donc répéter le checkout jusqu'à ce que sold + held = total.

**Preuve.** Grep `cleanupExpiredHolds` → lib/payments/payment.service.ts:983 (définition), tests/hold-cart-stock.test.ts:280 et :423 uniquement. checkout L189 : `idempotency_key: \`IDEMP-${externalOrderId}\`,` avec L166-167 `crypto.randomBytes(3)…` ; event.service.ts L1538-1549 CAS `held_quantity: nextHeld` sans date d'expiration ; migration 20260907 L17 : `CHECK (… (sold_quantity + held_quantity) <= total_quantity)`.

**Impact.** Catégorie rendue invendable sans qu'aucun billet ne soit vendu (held_quantity saturé), sans action possible du partenaire dans l'UI ; pire, chaque acheteur réel qui arrive ensuite tombe dans le chemin 'throw avalé' du constat précédent (étape 2 ignore les holds expirés, étape 3 les compte) et est envoyé payer un paiement supprimé. Déni de vente gratuit et perte d'argent client en cascade.

**Recommandation.** 1) Planifier cleanupExpiredHolds (route /api/cron/expired-holds protégée par CRON_SECRET + cron hébergeur toutes les minutes, ou pg_cron), 2) faire de la libération une opération basée sur l'état réel : stocker chaque hold dans une table `ticket_holds(payment_id, category_id, qty, expires_at)` et calculer held_quantity comme SUM des holds non expirés (ou libérer par trigger à l'expiration), 3) ajouter une vraie clé d'idempotence fournie par le client (header Idempotency-Key) et annuler automatiquement le PENDING précédent du même utilisateur sur la même catégorie, 4) rate-limiter /api/checkout (table rate_limits déjà présente), 5) plafonner la quantité par max_per_order dès le checkout.

### payment-security-6 — Double décrément de held_quantity au succès (reserveTicketsAtomic puis releaseHoldTicketsAtomic) : les holds des autres acheteurs sont effacés → survente au paiement puis auto-remboursement

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** architecture.md §20, §21 ; CDC §36
- **Emplacement :** lib/payments/payment.service.ts — lignes L543-565 et L572-597 (finally release) ; lib/events/event.service.ts L1094, L1100-1102 (décrément dans le CAS), L1610 (second décrément)
- **Catégorie :** Intégrité stock / hold cart

**Description.** Dans le webhook SUCCESS, reserveTicketsAtomic est appelé avec paymentConfirmed:true : la mise à jour CAS écrit `held_quantity = max(0, currentHeld - requestedQty)` en même temps que sold_quantity (event.service.ts L1094, L1101). Puis le bloc `finally` appelle releaseHoldTicketsAtomic pour la même quantité (L561-564, L593-596), qui décrémente à nouveau held_quantity de qty (L1610). Chaque achat confirmé retire donc 2×qty au compteur de holds, clampé à 0. Le test nominal (hold-cart-stock.test.ts L190-191) ne le détecte pas car avec un seul acheteur les deux variantes donnent 0.

**Preuve.** event.service.ts L1094 : `const nextHeld = params.paymentConfirmed ? Math.max(0, currentHeld - requestedQty) : currentHeld;` L1101 : `updatePayload.held_quantity = nextHeld;` — payment.service.ts L560-565 : `} finally { await EventService.releaseHoldTicketsAtomic({ categoryId: payment.metadata.category_id, quantity: countToGenerate }); }` — event.service.ts L1610 : `const nextHeld = Math.max(0, currentHeld - qtyToRelease);`

**Impact.** Exemple : 2 places restantes, A et B ont chacun un hold (held=2). Webhook A : sold=1, held=1 puis held=0 ; le hold de B a disparu, un acheteur C peut poser un hold et payer. Webhook B : sold=2 ; webhook C : CAS sold échoue → 'Stock insuffisant' → chemin overbooking → cashout de remboursement (frais, risques du constat suivant). Le mécanisme anti-'débit sans billet' du CDC est défait sous concurrence.

**Recommandation.** Choisir un seul point de conversion hold→vente : soit reserveTicketsAtomic convertit (sold+qty, held-qty) et le webhook ne doit plus appeler release en cas de succès (release uniquement si l'émission a échoué), soit reserveTicketsAtomic ne touche jamais held et le release reste dans le finally. Idéalement, une fonction SQL `confirm_hold(payment_id)` fait `sold = sold + qty, held = held - qty` en une seule instruction avec `WHERE held >= qty`. Ajouter un test à 2 acheteurs concurrents vérifiant held_quantity après le premier webhook.

### payment-security-7 — Fuites permanentes de held_quantity : échec SamirPay niveau body sans libération, et panier multi-catégories dont le 2e hold échoue

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** architecture.md §20 ; CDC §36
- **Emplacement :** app/api/checkout/route.ts — lignes L289-297 (pas de release) vs L256-262 (release) ; L209-222 (boucle multi-items) ; lib/payments/payment.service.ts L423-440 ; lib/events/event.service.ts L1513
- **Catégorie :** Intégrité stock / hold cart

**Description.** (a) Quand SamirPay répond HTTP 200 avec status 'failed'/'error' (cas documenté dans le code : 'Operator not found', 'Invalid phone number'), le checkout passe le paiement FAILED (L290-294) mais n'appelle pas releaseHoldTicketsAtomic, contrairement au bloc catch de l'exception réseau (L257-262). Même asymétrie dans createPayment (L423-440 vs L362-367). Le paiement n'étant plus PENDING, cleanupExpiredHolds (même s'il tournait) ne le libérerait jamais. (b) Pour un panier de plusieurs catégories payantes, la boucle L210-217 incrémente le hold de la catégorie 1 puis, si la catégorie 2 échoue, verifyAndEnforceHoldAtomic supprime la ligne payments (L1513) et lève ; le catch L218-222 renvoie 400 sans libérer la catégorie 1, et comme la ligne payments n'existe plus, aucun mécanisme ne pourra la retrouver.

**Preuve.** checkout L289-297 : `if (responseBodyStatus === 'failed' || responseBodyStatus === 'error') { await supabase.from('payments').update({ status: 'FAILED', … }).eq('id', paymentRecord.id); return NextResponse.json({ error: 'Paiement refusé par l\'opérateur.' }, { status: 400 }); }` (aucun releaseHoldTicketsAtomic) — L218-222 : `} catch (holdErr: any) { return NextResponse.json({ error: … }, { status: 400 }); }` après la boucle L210-217.

**Impact.** Chaque numéro de téléphone invalide saisi par un client (cas fréquent sur mobile money) bloque définitivement qty places ; chaque panier mixte partiellement refusé en bloque aussi. Le stock affiché diminue sans vente, le partenaire perd du chiffre d'affaires, et la saturation de held_quantity déclenche le chemin 'throw avalé'.

**Recommandation.** Centraliser la libération dans un `finally`/helper `failPaymentAndReleaseHolds(paymentId, items)` appelé sur tous les chemins d'échec (exception, status body failed, hold partiel) ; dans verifyAndEnforceHoldAtomic, ne pas supprimer la ligne payments depuis la fonction de hold (laisser l'appelant orchestrer et libérer les holds déjà posés) ; mieux : poser tous les holds du panier dans une seule transaction SQL (tout ou rien).

### payment-security-8 — Le checkout ne vérifie ni max_per_order, ni sale_start/sale_end, ni held_quantity : les refus n'arrivent qu'au webhook, après encaissement, et finissent en remboursement automatique

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** CDC §35 (date de début, date de fin de vente), §36 ; architecture.md §20
- **Emplacement :** app/api/checkout/route.ts — lignes L14 (max 20), L81-96 ; lib/events/event.service.ts L1005-1011, L1015, L1025-1027 ; lib/payments/payment.service.ts L601-603
- **Catégorie :** Conformité fonctionnelle / stock

**Description.** Le premier contrôle du checkout ne regarde que is_active et total - sold (L77-87). Les règles sale_start/sale_end (event.service.ts L1005-1011), max_per_order (défaut 10, L1015 ; refus L1025-1027) et le statut de l'événement ne sont appliquées que par reserveTicketsAtomic, c'est-à-dire au moment du webhook SUCCESS. Le schéma Zod autorise 20 billets par ligne (L14). Une commande de 11 à 20 billets d'une catégorie à max_per_order=10, ou passée dans les 10 dernières minutes avant sale_end, ou sur un événement suspendu pendant le paiement, est donc systématiquement encaissée puis refusée : generatedTicketIds vide → branche 'ALERTE OVERBOOKING' (L602) → cashout de remboursement.

**Preuve.** checkout L81-87 : `const availableStock = Number(category.total_quantity) - Number(category.sold_quantity || 0); … if (item.quantity > availableStock) { return … }` (rien sur max_per_order/sale_end) — event.service.ts L1025-1027 : `if (requestedQty > maxPerOrder) { throw new Error(\`Quantité dépassant la limite autorisée par commande …\`); }` exécuté seulement via le webhook L543/L572.

**Impact.** Expérience 'payé puis remboursé' systématique sur des cas banals, coûts de cashout (frais agrégateur sortants non récupérés), exposition aux défauts du mécanisme d'auto-remboursement (opérateur et numéro erronés, double cashout), et stock 'en hold' pendant tout le cycle.

**Recommandation.** Factoriser une fonction `assertCategoryPurchasable(category, qty, now)` (is_active, événement PUBLIE, fenêtre de vente, max_per_order, total - sold - held >= qty) utilisée par le checkout, createPayment ET reserveTicketsAtomic ; aligner la borne Zod sur max_per_order ; refuser avant tout appel SamirPay.

### payment-security-9 — Auto-remboursement overbooking : cashout toujours envoyé sur WAVE (opérateur jamais stocké) et, sans téléphone, vers le numéro fictif 770000000

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** CDC §41, §82 (remboursement), §184 ; architecture.md §26
- **Emplacement :** lib/payments/payment.service.ts — lignes L605-611 (choix opérateur), L628 (numéro par défaut), L636-642 (cashout) ; app/api/checkout/route.ts L171-201 et L301-307 (payment_method/operator jamais écrits) ; createPayment L272-310
- **Catégorie :** Sécurité paiement / remboursement

**Description.** L'opérateur de remboursement est déduit de `payment.payment_method` ou `payment.metadata.operator` (L609). Or ni le checkout (insert L171-201, update L301-307) ni createPayment (L272-310, L446-452) n'écrivent payment_method ni metadata.operator ; la variable `operator` reçue du client (checkout L38, L235) n'est jamais persistée. Le remboursement part donc toujours sur WAVE (L607), y compris pour un payeur Orange Money. Par ailleurs, si metadata.customer_phone est vide (customerPhone optionnel dans CheckoutSchema L17) et que users.phone est vide (handle_new_user accepte '' — 0002_functions.sql L56), le numéro utilisé est le littéral '770000000' (L628) et le cashout du montant intégral est envoyé à ce numéro. Le test late-webhook-and-treasury-preflight.test.ts contourne le problème en insérant manuellement `payment_method: 'WAVE'` et `metadata.operator` (L79, L86), ce que le code de production ne fait jamais.

**Preuve.** L609-611 : `if (payment.payment_method?.toUpperCase().includes('ORANGE') || payment.metadata?.operator === 'ORANGE_MONEY') { operator = 'ORANGE_MONEY'; }` — L628 : `const cleanPhone = (buyerPhone || '770000000').replace(/\s+/g, '');` — L636-642 : `await samirPayClient.sendCashout({ phoneNumber: cleanPhone, operatorName: operator, amount: Number(payment.amount), … })` — checkout L190-198 : metadata sans clé `operator`.

**Impact.** Remboursements d'un payeur OM envoyés sur un compte Wave inexistant (échec → statut FAILED, client non remboursé) ou existant au même numéro (argent versé mais hors du canal d'origine, non traçable), et dans le cas limite sans téléphone : transfert réel de fonds vers un numéro arbitraire. Perte financière plateforme.

**Recommandation.** Persister `payment_method`/`metadata.operator` et le numéro payeur normalisé à la création du paiement ; refuser tout cashout automatique si l'opérateur ou le numéro n'est pas connu de façon fiable (statut refund PENDING + alerte admin plutôt que valeur par défaut) ; ne jamais utiliser de numéro de repli ; idéalement, utiliser l'API de remboursement de la transaction d'origine si SamirPay la propose.

### payment-security-10 — Injection de filtre PostgREST via .or() sur order_id (webhook) et transactionId (route de statut publique)

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** CDC Partie XVII §155 (protection des données financières) ; architecture.md §35 (validation)
- **Emplacement :** lib/payments/payment.service.ts — lignes L500 ; app/api/payments/[transactionId]/status/route.ts L27 ; lib/validations/payment.ts L45-47
- **Catégorie :** Sécurité / injection

**Description.** Les deux requêtes interpolent une valeur non authentifiée et non contrainte (`z.string().min(1)` côté webhook ; segment d'URL décodé côté statut) directement dans la grammaire de filtre PostgREST : `.or(\`external_order_id.eq.${order_id},transaction_id.eq.${order_id}\`)`. supabase-js n'échappe pas les séparateurs `,`, `(`, `)` ni les opérateurs ; une valeur telle que `x,and(status.eq.PENDING,payment_target.eq.TICKET,created_at.gt.2026-10-30T10:00:00)` ajoute des conditions arbitraires. Le `.single()` se comporte comme un oracle (succès si exactement une ligne), permettant d'énumérer la table payments par dichotomie sur created_at/amount depuis la route de statut, qui est publique (middleware.ts L10) et utilise le client service-role (contourne RLS).

**Preuve.** payment.service.ts L500 : `.or(\`external_order_id.eq.${order_id},transaction_id.eq.${order_id}\`)` — status/route.ts L27 : `.or(\`transaction_id.eq.${transactionId},external_order_id.eq.${transactionId}\`)` — validations L45-47 : `order_id: z.string().min(1, …)` sans regex.

**Impact.** Divulgation d'identifiants de transaction, montants et statuts de tous les paiements à un attaquant anonyme ; combiné au webhook non signé, ciblage d'un paiement PENDING d'une victime sans en connaître l'order_id (émission de billets gratuits à son profit, ou passage FAILED d'un paiement en cours).

**Recommandation.** Valider strictement le format (`/^(TX|ORD)-EV-\d{13}-[0-9A-F]{6}$/`) et utiliser deux `.eq()` séparés ou `.in('external_order_id', [v])` plutôt que la chaîne .or() ; authentifier la route de statut et filtrer par client_id ; ne jamais interpoler une entrée externe dans un filtre PostgREST sans la mettre entre guillemets doubles échappés.

### payment-security-11 — Policy RLS payments_insert_auth : tout client authentifié peut insérer des lignes payments arbitraires (empoisonnement de la file de holds, faux paiements SUCCESS)

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** moyenne
- **Référence CDC :** architecture.md §17 ('le frontend ne doit jamais pouvoir déclarer payment.status = SUCCESS'), §30 RLS ; CDC §152
- **Emplacement :** supabase/migrations/0003_rls.sql — lignes L281-282 ; lib/events/event.service.ts L1472-1509 ; lib/partner/partner-dashboard.service.ts L797
- **Catégorie :** Sécurité / intégrité données

**Description.** `CREATE POLICY "payments_insert_auth" ON payments FOR INSERT WITH CHECK (client_id = auth.uid() OR is_admin())` autorise n'importe quel utilisateur connecté, via la clé anon publique et l'API REST Supabase, à insérer une ligne payments avec les colonnes de son choix : status 'SUCCESS', partner_id d'un tiers, amount, partner_payout_amount, created_at dans le passé, metadata.event_id/checkout_items. Or verifyAndEnforceHoldAtomic construit sa file d'attente à partir de toutes les lignes PENDING/TICKET filtrées par metadata->>event_id et ordonnées par created_at (L1472-1479), sans distinguer leur origine. Un attaquant peut donc insérer des PENDING antidatés de grande quantité et faire rejeter tous les acheteurs légitimes ('en cours de réservation par d'autres acheteurs', L1511-1515). Les faux SUCCESS polluent aussi les agrégats partenaire (partner-dashboard.service.ts L797 somme payments par partner_id).

**Preuve.** 0003_rls.sql L281-282 : `CREATE POLICY "payments_insert_auth" ON payments FOR INSERT WITH CHECK (client_id = auth.uid() OR is_admin());` — event.service.ts L1472-1479 : `.from('payments').select('id, amount, metadata, created_at').eq('payment_target', 'TICKET').eq('status', 'PENDING').filter('metadata->>event_id', 'eq', params.eventId).order('created_at', …)`.

**Impact.** Déni de vente ciblé sur n'importe quel événement sans dépenser un franc, fausses recettes dans les tableaux de bord et exports comptables, confusion des rapprochements. Les retraits ne sont pas directement impactés (la RPC calcule depuis referral_commissions), mais toute évolution calculant un solde depuis payments deviendrait exploitable.

**Recommandation.** Supprimer la policy d'INSERT pour les rôles authentifiés (toutes les écritures payments passent déjà par le service-role côté serveur) ; si une insertion client est indispensable, la restreindre à status='PENDING', is_platform_payment=true et colonnes financières nulles via une fonction SECURITY DEFINER ; ne jamais faire dépendre la logique de stock d'enregistrements modifiables par le client.

### payment-security-12 — Panier mixte : billets gratuits émis avant la tentative de paiement, non annulés en cas d'échec, et re-émis à chaque nouvelle tentative

- **Sévérité :** MOYENNE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** CDC §36 ; architecture.md §21
- **Emplacement :** app/api/checkout/route.ts — lignes L102-133 (émission gratuite), L218-222 et L289-297 (échecs payants sans rollback), L325-328 (catch global) ; app/api/tickets/claim-free/route.ts L34
- **Catégorie :** Robustesse / intégrité stock

**Description.** Les lignes gratuites sont converties en billets VALIDE (L103-109) avant toute vérification de la partie payante. Si le hold (L218-222), l'appel SamirPay (L256-274) ou la réponse 'failed' (L289-297) échouent, la réponse est une erreur 4xx/5xx alors que les billets gratuits existent déjà ; l'utilisateur, invité à 'réessayer', obtient de nouveaux billets gratuits à chaque tentative (aucun plafond par utilisateur, ni dans le checkout ni dans claim-free qui accepte 20 par appel sans rate limit). De plus, une erreur métier dans la boucle gratuite (épuisé, max_per_order) remonte au catch global et devient un 500 'Erreur interne du serveur' (L325-328) au lieu d'un 400 explicite.

**Preuve.** L103-109 : `await EventService.reserveTicketsAtomic({ eventId, categoryId: item.categoryId, quantity: item.quantity, userId: user.id, paymentConfirmed: true })` exécuté avant L171 (insert paiement) ; L218-222 retourne 400 sans annuler freeTicketsGenerated.

**Impact.** Stock gratuit consommé plusieurs fois par le même client (doublons), incohérence entre message d'erreur et billets réellement présents dans 'Mes billets', support client sollicité.

**Recommandation.** Valider l'intégralité du panier (gratuit + payant, holds compris) avant toute émission ; émettre les billets gratuits seulement après succès de l'initialisation SamirPay (ou au webhook, en les listant dans checkout_items avec prix 0) ; imposer un plafond par utilisateur et par catégorie (max_per_order cumulé) et un rate limit sur claim-free ; mapper les erreurs métier en 400.

### payment-security-13 — Webhook : réponse 200 systématique même en erreur interne, aucun journal des webhooks reçus, données personnelles dans les logs

- **Sévérité :** MOYENNE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** architecture.md §16 (étape 9 'enregistrer l'opération', étape 10 'répondre correctement'), §28 audit log ; CDC §156
- **Emplacement :** app/api/webhooks/samirpay/route.ts — lignes L23-36 ; lib/payments/payment.service.ts L488-506, L700 ; lib/samirpay/client.ts L308-313, L321
- **Catégorie :** Observabilité / traçabilité

**Description.** Toute exception (base indisponible, timeout d'insertion des billets) est transformée en HTTP 200 `{received:true, success:false}` (L28-35), ce qui empêche le fournisseur de rejouer la notification : un incident transitoire pendant le webhook laisse le paiement PENDING pour toujours (jusqu'au polling de statut, lui-même défaillant, cf. constat dédié). Le payload brut du webhook n'est persisté nulle part (provider_response n'est renseigné qu'à l'init, L305), il n'existe pas de table d'événements webhook, et les cas 'Transaction introuvable' ne laissent qu'un console.error (L504). Les logs de cashout impriment le numéro de téléphone complet (client.ts L308-313, L321) et audit_logs.metadata stocke le téléphone en clair (L700).

**Preuve.** route.ts L28-35 : `return NextResponse.json({ received: true, success: false, error: … }, { status: 200 });` — payment.service.ts L504 : `console.error(\`[PaymentService.Webhook] Transaction introuvable pour order_id: ${order_id}\`);` sans persistance.

**Impact.** Paiements encaissés restant PENDING sans possibilité de rejeu ni de rapprochement a posteriori ; impossibilité de prouver ce que SamirPay a envoyé en cas de litige ; exposition de données personnelles dans les logs hébergeur.

**Recommandation.** Persister chaque webhook (table payment_webhook_events : payload brut, headers, résultat, timestamps) avant traitement ; répondre 2xx uniquement quand l'événement est durablement enregistré, 5xx sur erreur interne pour bénéficier des retries (selon contrat SamirPay) ; masquer les numéros dans les logs ; ajouter un job de réconciliation périodique (PENDING > 15 min → checkTransactionStatus).

### payment-security-14 — releaseHoldTicketsAtomic et le repli 'colonne absente' masquent silencieusement les erreurs et dérives du hold cart

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** architecture.md §20, §21
- **Emplacement :** lib/events/event.service.ts — lignes L1589-1630 (L1605, L1608, L1622-1626, L1629) ; L1578-1580 ; L1067-1081
- **Catégorie :** Robustesse / intégrité stock

**Description.** releaseHoldTicketsAtomic retourne toujours `{ success: true, released: qtyToRelease }` (L1629) : sur erreur de lecture (L1605 `break`), sur held déjà à 0 (L1608 `break`), sur exception (L1624-1626 `catch { break; }`) et même après 10 échecs de CAS, l'appelant ne peut pas savoir que rien n'a été libéré ; le clamp `Math.max(0, …)` absorbe les sur-libérations au lieu de les signaler. De même, verifyAndEnforceHoldAtomic (L1578-1580) et reserveTicketsAtomic (L1067-1081) traitent toute erreur Supabase sur held_quantity comme 'colonne non configurée' et désactivent le hold physique sans alerte, ne laissant que la file d'attente basée sur metadata, qui est un read-then-decide non atomique (L1472-1515).

**Preuve.** L1622-1629 : `if (!error && updated) break; await new Promise(…); } catch { break; } } return { success: true, released: qtyToRelease };` — L1578-1580 : `} catch { // colonne held_quantity non configurée en base }`

**Impact.** Impossible de détecter en production une panne du mécanisme de hold (compteur faux, holds non libérés), ce qui aggrave les constats de fuite et de double décrément ; les tests passent alors que la garantie n'est plus assurée.

**Recommandation.** Faire remonter une erreur typée (ou un résultat {success:false, reason}) et la journaliser côté appelant ; supprimer les replis 'colonne absente' (la migration 20260907 est obligatoire : vérifier au démarrage) ; remplacer les CAS applicatifs par des UPDATE relatifs en SQL (`held_quantity = held_quantity - $1 WHERE held_quantity >= $1`) qui échouent explicitement en cas de dérive.

### payment-security-15 — /api/events/[id]/tickets/purchase : tout CONTROLEUR/ADMIN peut émettre des billets VALIDE et des paiements CASH 'SUCCESS' pour n'importe quel événement, hors shift et sans validation d'orderId

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** moyenne
- **Référence CDC :** CDC §152 (chaque rôle dispose uniquement des droits nécessaires), §76 (paiement hors plateforme enregistré 'lorsque nécessaire')
- **Emplacement :** app/api/events/[id]/tickets/purchase/route.ts — lignes L21-33 ; lib/events/event.service.ts L1029-1058, L1218-1250 ; lib/shifts/shift.service.ts L418-445
- **Catégorie :** Contournement du paiement / périmètre des rôles

**Description.** La route passe `callerRole: user.role` et `orderId` brut du body à purchaseTicketAtomic. Dans reserveTicketsAtomic, un rôle CONTROLEUR/ADMIN/SUPERADMIN est 'isAuthorizedStaff' (L1048-1051) sans aucune vérification d'affectation à l'événement (aucune référence à event_controllers dans event.service.ts) ni de shift ouvert ; un billet payant est alors créé VALIDE au nom du contrôleur lui-même (user_id = params.userId, L1172) et une ligne payments CASH SUCCESS est insérée (L1222-1250) sans shift_id. Le service de shifts suit l'encaissement attendu par un compteur dédié (expected_cash_total, shift.service.ts L418-445) que ce chemin n'incrémente pas. Pour un CLIENT, le contournement est correctement bloqué (L1055-1057).

**Preuve.** purchase/route.ts L27-33 : `EventService.purchaseTicketAtomic({ eventId, categoryId, userId: user.id, orderId, callerRole: user.role })` — event.service.ts L1048-1051 : `isAuthorizedStaff = role === 'SUPERADMIN' || role === 'ADMIN' || role === 'CONTROLEUR';` puis L1222 insertion `payment_method: 'CASH', … status: 'SUCCESS'`.

**Impact.** Un contrôleur d'un événement A peut générer des billets valides (et des recettes 'espèces' fictives ou non déclarées) pour un événement B d'un autre partenaire, invisibles du Z de caisse ; risque de fraude interne et de faux dans les statistiques de vente.

**Recommandation.** Réserver ce endpoint au parcours guichet : exiger un shift OUVERT du contrôleur sur cet événement (event_controllers + controller_shifts), rattacher le paiement CASH au shift_id et incrémenter expected_cash_total dans la même transaction, valider orderId (uuid) ou le supprimer, et refuser les billets payants pour tout autre rôle via cette route.

### payment-security-16 — Client SamirPay : réponse de statut non corrélée à l'order_id, parsing JSON avant contrôle HTTP, journaux d'erreur bruts

- **Sévérité :** FAIBLE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** moyenne
- **Référence CDC :** architecture.md §13-§14, §39 (tests paiement)
- **Emplacement :** lib/samirpay/client.ts — lignes L206-218, L139-145, L250-255, L304-306, L179-181
- **Catégorie :** Robustesse intégration

**Description.** checkTransactionStatus renvoie la réponse telle quelle sans vérifier que `order_id`/`transaction_id` correspondent à la demande (L218), alors que l'URL de statut est devinée par repli (`/api/tiers/direct/status`, L35) : une réponse générique ou erronée du fournisseur serait interprétée comme un statut valide par la route de statut. getSolde et sendCashout appellent `response.json()` avant de tester `response.ok` (L250, L304) : un corps HTML d'erreur (502 passerelle) lève une SyntaxError peu explicite. Les corps d'erreur HTTP d'initPayment sont loggés bruts (L139-145). La neutralisation des secrets par `.replace(this.secretKey, '***')` (L179-181) est sans effet si la clé est vide, cas non détecté au démarrage.

**Preuve.** L218 : `return (await response.json()) as SamirPayCheckStatusResponse;` sans comparaison à orderId — L250-255 : `const data = (await response.json()) …; if (!response.ok) {`

**Impact.** Diagnostics difficiles en production, et faux positif SUCCESS possible via la route de statut si l'endpoint de statut est mal configuré ou renvoie une réponse non spécifique.

**Recommandation.** Valider les réponses avec un schéma Zod (status, order_id attendu), tester `response.ok` avant le parsing, échouer explicitement au démarrage si SAMIRPAY_API_KEY/SECRET_KEY/STATUS_URL sont absents, tronquer et anonymiser les corps d'erreur loggés.

### payment-security-17 — Taux de frais : repli codé en dur (5 % / 1,5 %) dans le checkout, incohérent avec createPayment et rendant un taux à 0 impossible

- **Sévérité :** FAIBLE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** CDC §37, §77 ('le taux doit être configurable'), §79
- **Emplacement :** app/api/checkout/route.ts — lignes L155-156 ; lib/payments/payment.service.ts L242-245
- **Catégorie :** Règles financières / cohérence

**Description.** Le checkout calcule `Number(ticketingConfig?.value?.service_fee_rate || 5) / 100` et `… aggregator_fee_rate || 1.5`, donc un taux configuré à 0 par l'administration est remplacé par 5 % / 1,5 %, et une configuration absente est silencieusement remplacée par des valeurs par défaut alors que createPayment refuse le paiement dans le même cas (L242-245). Les deux parcours peuvent ainsi produire des répartitions différentes pour un même billet.

**Preuve.** L155-156 : `const serviceFeeRate = Number(ticketingConfig?.value?.service_fee_rate || 5) / 100; const aggregatorFeeRate = Number(ticketingConfig?.value?.aggregator_fee_rate || 1.5) / 100;`

**Impact.** Répartition partenaire/plateforme erronée si l'admin fixe un taux promotionnel à 0, et comportement divergent entre panier et achat unitaire.

**Recommandation.** Utiliser `??` après validation numérique (ou exiger la configuration comme dans createPayment) et centraliser le calcul dans FinancialCalculatorService pour les deux parcours.

## D. Sécurité QR / TOTP / scan / contrôleur / caisse

**Synthèse de l'auditeur :** Points forts : le compostage contrôleur passe par la RPC atomic_ticket_checkin (advisory lock + FOR UPDATE, EXECUTE révoqué pour anon/authenticated) ; les sessions de caisse sont co-signées par un PIN régisseur haché HMAC, comparé en timingSafeEqual, avec rate limiting fail-closed et justification obligatoire des écarts ; l'onboarding contrôleur (compte coquille + OTP 24h + refus d'écraser un compte établi) et le modèle multi-rôles sont bien conçus. En revanche, la dimension contrôle d'accès présente 3 failles critiques combinables : (1) tout identifiant statique (qr_code EV-QR-… imprimé dans le PDF, ticket_number TCK-… affiché/partagé) est accepté par /api/controller/scan sans vérification TOTP, ce qui vide de sens le QR dynamique ; (2) /api/tickets/verify (utilisé par la page partenaire) n'a aucun contrôle de rôle/assignation/paiement et permet à n'importe quel compte authentifié de composter n'importe quel billet, donc à un contrôleur sans droit d'encaisser de contourner le "cash gate" ; (3) les politiques RLS tickets_read/tickets_update_controller donnent à tout CONTROLEUR, via le client Supabase navigateur, la lecture de tous les billets (QR statiques inclus) et l'UPDATE libre de n'importe quel billet (re-validation, changement de propriétaire) sans trigger d'audit. S'y ajoutent des non-conformités fortes : live-code et /api/tickets?userId= (IDOR), encaissement PUT non transactionnel et incohérent avec le modèle "prix + frais" du §37, branche partenaire/admin du scan sans cash gate ni atomicité, réactivation de comptes suspendus par un partenaire, journal d'audit falsifiable (WITH CHECK (TRUE)) et incomplet (refus non journalisés, attribution erronée), secret TOTP dérivé d'un secret tiers/constante codée en dur, hash du PIN régisseur lisible publiquement, absence de fenêtre temporelle au scan.

**Limites de couverture :** Audit statique en lecture seule, aucun test exécuté ni base interrogée. Non couvert ou partiellement : (a) les privilèges par défaut effectivement en place sur le projet Supabase (GRANT anon/authenticated sur les tables) — les constats RLS supposent la configuration standard Supabase, aucune REVOKE n'a été trouvée dans supabase/migrations ; (b) la présence éventuelle d'un pg_cron côté Supabase faisant passer les événements en TERMINE (rien dans le dépôt : seuls app/api/cron/moratoriums et ticket-transfers existent) ; (c) le contenu exact des SMS mTarget (OTP d'invitation, numéros de billets) et des templates email ; (d) les routes /api/admin et le flux webhook SamirPay ; (e) le détail de lib/tickets/ticket-transfer.service.ts et de /api/tickets/claim (seule la rotation qr_code/totp_secret L692-736 a été vérifiée) ; (f) components/scan/CameraQrScanner.tsx au-delà du fait qu'il transmet le texte décodé brut ; (g) la valeur réelle des variables d'environnement en production (SUPABASE_AUTH_HOOK_SECRET), dont dépend la gravité effective de la dérivation du secret TOTP et du hash PIN ; (h) la section app/api/partner/team/all PATCH et les pages admin de consultation du journal d'audit ; (i) la table otp_codes (schéma, partage entre flux login/invitation).

### scan-security-1 — Contournement total du QR dynamique TOTP : tout identifiant statique (qr_code EV-QR-… du PDF, ticket_number TCK-…) est accepté sans jeton temporel

- **Sévérité :** CRITIQUE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §39, §40, §154 (QR unique, sécurisé, vérifiable) ; architecture.md §31
- **Emplacement :** app/api/controller/scan/route.ts — lignes L72-73, L101-118, L135-163, L401 ; lib/security/totp.ts L148-152 ; app/api/tickets/[id]/pdf/route.ts L128 ; lib/tickets/ticket-pdf.service.ts L72-73 ; components/tickets/TicketCard.tsx L137, L323 ; app/api/tickets/route.ts L107 ; app/controller/scanner/page.tsx L467-478 ; lib/tickets/ticket-transfer.service.ts L708-713 ; tests/dynamic-qr-totp.test.ts L411-429
- **Catégorie :** controle-acces-qr

**Description.** La vérification TOTP n'est exécutée que si le payload commence par 'EVT1:' (parseDynamicQrPayload renvoie isDynamic=false pour tout autre texte). Le serveur cherche alors le billet par ticket_number puis par qr_code et le composte directement. Or ces deux identifiants sont largement exposés au client : le PDF officiel encode le qr_code statique 'EV-QR-…' dans son QR (pdf/route.ts L128 → qrPayload: ticket.qr_code), la carte billet affiche le ticket_number en clair (TicketCard L323) et le propose au partage WhatsApp (L137), /api/tickets renvoie qrCodeValue (L107). Le serveur ne distingue pas un scan caméra d'une saisie manuelle : la page scanner envoie exactement { qr_code: code.trim() } dans les deux cas (L475-478). Le test 6 de tests/dynamic-qr-totp.test.ts codifie ce comportement comme attendu. Après transfert P2P, seul qr_code est régénéré (L708-713) : le ticket_number reste valable pour l'ancien propriétaire.

**Preuve.** scan/route.ts L135 : `if (parsed.isDynamic) { ... verifyTotp(...) }` — aucun contrôle sinon ; L104 `.eq('ticket_number', lookupCode)` puis L114 `.eq('qr_code', lookupCode)` ; totp.ts L149-152 `return { isDynamic: false, identifier: trimmed }` ; pdf/route.ts L128 `qrPayload: ticket.qr_code || ticket.ticket_number` ; TicketCard L323 `{ticketNumber}` ; scanner/page.tsx L478 `body: JSON.stringify({ qr_code: code.trim() })`.

**Impact.** Une photo/impression du PDF, une capture du numéro de billet (WhatsApp, email de confirmation, écran du wallet) ou l'ancien propriétaire d'un billet transféré permettent de générer un QR simple contenant l'identifiant seul et d'entrer : le premier à se présenter consomme le billet du client légitime. La protection « anti-capture d'écran » annoncée dans l'UI (TicketCard L345) est inopérante ; perte de revenus organisateur et litiges clients.

**Recommandation.** Exiger le format EVT1:<id>:<totp> pour tout scan caméra et refuser les identifiants nus ; réserver la saisie manuelle à un champ explicite (ex. { manual_code }) soumis à une permission dédiée, à une vérification visuelle d'identité obligatoire et journalisée (action TICKET_SCAN_MANUAL). Ne plus encoder le qr_code statique dans le PDF (encoder un payload signé à durée de vie courte ou n'imprimer que le numéro, avec contrôle manuel renforcé). Régénérer ticket_number ou le rendre non scannable après transfert. Mettre à jour le test 6 pour attendre un refus.

### scan-security-2 — /api/tickets/verify : compostage de n'importe quel billet par tout compte authentifié (aucun rôle, aucune assignation, aucun cash gate) — utilisé par la page partenaire

- **Sévérité :** CRITIQUE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §11, §40, §152 (chaque rôle dispose uniquement des droits nécessaires), §156
- **Emplacement :** app/api/tickets/verify/route.ts — lignes L14-28, L87-99, L117-151, L154-156 ; app/partner/scan/page.tsx L53-57 ; middleware.ts L108-123, L171-176, L223
- **Catégorie :** rbac

**Description.** Le handler n'appelle jamais getServerSessionUser : il lit le JSON et composte. Le middleware ne fait qu'exiger une session pour /api/tickets/* (L113-118 puis L223 : laisser passer), donc tout CLIENT peut appeler la route. Aucun contrôle d'assignation event_controllers, de statut d'événement, de permission can_accept_cash ni de commande impayée ; l'update (L145-151) se fait sans advisory lock ni checked_in_by ; l'audit attribue le scan au porteur du billet (userId: ticket.user_id, L155) avec un rôle 'CONTROLEUR' fictif. La page /partner/scan (autorisée aux CONTROLEUR par middleware L171-176) consomme cette route : un contrôleur sans droit d'encaisser peut l'utiliser depuis l'UI, sans outil.

**Preuve.** verify/route.ts L14-16 : `export async function POST(req) { ... let body = await req.json()` (pas d'auth) ; L145-151 `.update({ status: 'UTILISE', checked_in_at: now }).eq('id', ticket.id)` ; L155 `userId: ticket.user_id || 'controller-scan'` ; partner/scan/page.tsx L53 `fetch('/api/tickets/verify', ...)` ; middleware L171 `/partner/scan` ouvert à 'CONTROLEUR'.

**Impact.** 1) Fraude financière : un contrôleur sans can_accept_cash scanne un billet impayé (réponse payment_required), puis composte le même billet via /api/tickets/verify ou /partner/scan : le client entre, la commande reste impayée, les espèces sont encaissées hors Z de caisse. 2) Sabotage : n'importe quel client connaissant un numéro de billet (visible sur les écrans d'autrui, partagé) marque le billet UTILISE ; le porteur légitime est refusé à l'entrée et reçoit un SMS de validation. 3) Fuite de l'email/nom du porteur (L45, L82-84) à tout utilisateur authentifié. 4) Journal d'audit faux (scan imputé à la victime, 'controller-scan' non-UUID fait échouer l'insert silencieusement).

**Recommandation.** Supprimer la route ou la fusionner avec /api/controller/scan (même authentification, RBAC, vérification de propriété de l'événement pour le PARTENAIRE, cash gate, RPC atomique, audit avec l'id du scanneur). Faire pointer app/partner/scan vers /api/controller/scan et restreindre /partner/scan aux rôles PARTENAIRE/ADMIN dans le middleware.

### scan-security-3 — RLS tickets : tout CONTROLEUR lit tous les billets de la plateforme (QR statiques inclus) et peut UPDATE n'importe quel billet sans restriction de colonne ni audit

- **Sévérité :** CRITIQUE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §152, §154, §155 ; architecture.md §30 (RLS) et §31
- **Emplacement :** supabase/migrations/0003_rls.sql — lignes L154-159, L164-165 ; supabase/migrations/20260906_user_roles_multi_role.sql L214-217 ; supabase/migrations/0002_functions.sql L388-393 ; supabase/migrations/20260907_tickets_realtime_replica.sql L7-15 ; supabase/migrations/20260906_atomic_partner_remove_controller.sql L43-51
- **Catégorie :** rls

**Description.** La politique tickets_read autorise SELECT à `is_controller()` sans condition d'événement, et tickets_update_controller autorise UPDATE à `is_controller() OR is_admin()` sans clause WITH CHECK ni limitation de colonnes. Avec la clé anon et son JWT (client navigateur déjà utilisé par le scanner), un contrôleur peut donc `select qr_code, ticket_number from tickets` sur tous les événements et `update tickets set status='VALIDE', checked_in_at=null, user_id=<moi>` sur n'importe quelle ligne. Aucun trigger audit_log_changes n'est posé sur tickets (0002_functions L388-393 : payments, refunds, commissions, withdrawals, referral_config, users seulement). Le rôle CONTROLEUR persiste tant qu'une assignation (même sur un événement TERMINE) subsiste (atomic_partner_remove_controller L43-51). REPLICA IDENTITY FULL + publication realtime diffusent en plus les lignes complètes à ces abonnés.

**Preuve.** 0003_rls.sql L154-159 : `CREATE POLICY "tickets_read" ON tickets FOR SELECT USING (user_id = auth.uid() OR EXISTS (...partner...) OR is_controller())` ; L164-165 : `CREATE POLICY "tickets_update_controller" ON tickets FOR UPDATE USING (is_controller() OR is_admin());` (pas de WITH CHECK) ; 20260906 L214-217 : is_controller() = has_role('CONTROLEUR') OR ...

**Impact.** Fraude de masse par un contrôleur (ou un ancien contrôleur jamais désaffecté) : export de tous les QR statiques de tous les organisateurs (exploitables via le constat n°1), re-validation de billets déjà utilisés pour revente, appropriation de billets (user_id) puis transfert, modification de prix/statut — le tout invisible dans audit_logs. Violation directe de l'isolation multi-tenant promise par l'architecture §30.

**Recommandation.** Restreindre tickets_read aux billets des événements où le contrôleur est assigné (EXISTS event_controllers ec WHERE ec.user_id = auth.uid() AND ec.event_id = tickets.event_id) ; supprimer tickets_update_controller (toutes les mutations passent déjà par le service_role) ou la limiter par WITH CHECK aux seules transitions VALIDE→UTILISE sur les événements assignés ; ajouter un trigger audit sur tickets ; révoquer UPDATE sur tickets pour authenticated ; retirer le rôle CONTROLEUR lorsque toutes les assignations restantes sont sur des événements TERMINE/ANNULE.

### scan-security-4 — GET /api/tickets/[id]/live-code : tout CONTROLEUR ou PARTENAIRE obtient le payload QR valide (qr_code statique + TOTP courant) de n'importe quel billet

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §152, §154 ; architecture.md §30
- **Emplacement :** app/api/tickets/[id]/live-code/route.ts — lignes L43-47, L59, L65-74
- **Catégorie :** rbac

**Description.** Le contrôle d'accès se limite à « propriétaire OU rôle ADMIN/SUPERADMIN/CONTROLEUR/PARTENAIRE » : aucune vérification que le billet appartient à un événement du partenaire ou assigné au contrôleur. La réponse contient qr_payload (EVT1:<qr_code>:<totp>), le totp_code isolé et donc le qr_code statique. Les UUID de billets sont obtenables par un contrôleur via la RLS tickets_read (constat n°3) ou par la réponse cash_required du scan (ticket_id, scan/route.ts L275).

**Preuve.** L44 : `const isStaff = serverHasAnyRole(user, ['ADMIN', 'SUPERADMIN', 'CONTROLEUR', 'PARTENAIRE']);` L45 : `if (!isOwner && !isStaff) return 403` ; L65 `buildDynamicQrPayload(ticket.qr_code, code)` ; L71 `totp_code: code`.

**Impact.** Un contrôleur ou un partenaire concurrent peut fabriquer un QR dynamique valide pour un billet d'un autre organisateur et le faire entrer (ou l'utiliser pour marquer le billet avant le client). Combiné au constat n°1, le qr_code statique renvoyé constitue un laissez-passer permanent.

**Recommandation.** Réserver live-code au propriétaire (user_id) et, si un usage staff est nécessaire, exiger pour CONTROLEUR une assignation event_controllers sur ticket.event_id et pour PARTENAIRE la propriété de l'événement ; ne jamais renvoyer totp_code séparément ; ajouter un rate limit par billet et utilisateur.

### scan-security-5 — GET /api/tickets : IDOR par paramètre ?userId= — tout compte authentifié liste les billets (qr_code, statut) d'un autre utilisateur

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §155 (protection des données) ; architecture.md §30 (« un Client ne doit accéder qu'à ses propres tickets »)
- **Emplacement :** app/api/tickets/route.ts — lignes L13-27, L46 ; app/tickets/page.tsx L36 ; middleware.ts L113-118, L223
- **Catégorie :** idor

**Description.** Le handler ne lit que l'en-tête Authorization ; sans Bearer, il se rabat sur searchParams userId sans aucune vérification (L22-24). Le middleware ne vérifie que l'existence d'une session cookie. La page client appelle justement `/api/tickets?userId=${user.id}` sans Bearer (app/tickets/page.tsx L36), ce qui confirme que le chemin « userId fourni par le client » est le chemin de production.

**Preuve.** L23-24 : `const queryUserId = searchParams.get('userId'); const effectiveUserId = userId || queryUserId;` L46 : `.eq('user_id', effectiveUserId)` ; L107 `qrCodeValue: t.qr_code`.

**Impact.** Toute personne connectée connaissant l'UUID d'un utilisateur (visible par les contrôleurs via users_select_policy, dans les notifications, etc.) récupère ses billets, QR statiques, statut et transferts en attente — avec le constat n°1, usage frauduleux direct des billets d'autrui.

**Recommandation.** Résoudre l'utilisateur uniquement via getServerSessionUser(req) (cookie ou Bearer) et ignorer tout userId fourni par le client ; côté front, supprimer le paramètre. Ajouter un test de non-régression (CLIENT A appelant ?userId=B → 403/liste vide).

### scan-security-6 — Encaissement espèces (PUT /api/controller/scan) : compostage avant contrôle de la commande, aucune vérification que la commande est réellement impayée, égalité total_amount === price incompatible avec « prix + frais » et multi-billets, Z de caisse ignoré pour PARTENAIRE/ADMIN

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §11 (paiement hors plateforme selon permission), §37 (Prix du ticket + frais de service), §40, §84 (rapprochement financier), §156
- **Emplacement :** app/api/controller/scan/route.ts — lignes L249, L454-456, L472-481, L482-503, L508-533, L536-553, L555-560, L564-566, L575 ; lib/payments/financial-calculator.service.ts L65-66 ; lib/shifts/shift.service.ts L421-463
- **Catégorie :** integrite-financiere

**Description.** 1) Ordre non transactionnel : atomic_ticket_checkin est exécuté (L508) AVANT la lecture/validation de la commande (L538-553) ; si la commande est introuvable (404) ou si le montant diffère (400), le billet est déjà UTILISE, la commande reste impayée, aucun audit ni enregistrement de caisse n'est écrit, et un second appel échoue sur « Billet invalide ou déjà utilisé » (L454-456). 2) Aucune vérification que order.payment_status !== 'SUCCESS' avant de passer la commande en SUCCESS et d'appeler recordCashPayment : une commande déjà payée en ligne peut être « ré-encaissée » en espèces (total attendu de caisse gonflé, double comptabilisation). 3) L549 impose total_amount === ticket.price : le CDC §37 et calculateTicketingFinancials (buyerTotalPaid = prix + frais) rendent l'égalité fausse dès qu'il y a des frais ou plusieurs billets par commande ; en POST, amount_due = balance_amount || total_amount (L249) affiche le total de la commande pour un seul billet. 4) Pour PARTENAIRE (L472-481) et ADMIN/SUPERADMIN (aucune branche), activeShiftId reste null : encaissement sans session de caisse, non rattaché à un shift, absent du Z. 5) L'update de la commande (L555-560) n'est pas vérifié (erreur FK sur shift_id fantôme, etc. ignorée). 6) recordCashPayment est un read-modify-write non atomique malgré son commentaire (shift.service L434-448). 7) L'audit enregistre `order_id: orderId` (valeur brute de la requête, souvent undefined) au lieu de targetOrderId (L575).

**Preuve.** L508 `rpc('atomic_ticket_checkin', ...)` puis L549 `if (Number(orderData.total_amount) !== Number(ticket.price)) return 400` ; L555-560 `await supabase.from('orders').update({ payment_status: 'SUCCESS', ... })` sans vérifier payment_status préalable ni l'erreur ; L472-481 branche PARTENAIRE sans getActiveShift ; financial-calculator L66 `buyerTotalPaid = ticketFacialPrice + serviceFeeAmount`.

**Impact.** Billets compostés sans paiement enregistré (perte sèche organisateur), encaissements multi-billets impossibles ou incohérents à l'entrée, Z de caisse faux (espèces du partenaire/admin hors Z, doubles comptages), litiges et écarts non justifiables au rapprochement §84.

**Recommandation.** Déplacer toute la logique dans une RPC PostgreSQL transactionnelle (lock billet + commande, vérifier payment_status != SUCCESS, calculer le dû par billet = balance restante / billets restants ou montant de la ligne, marquer le billet et la commande, incrémenter expected_cash_total avec UPDATE ... SET expected_cash_total = expected_cash_total + $1, écrire l'audit) ; exiger une session de caisse ouverte pour tout encaissement quel que soit le rôle ; enregistrer le montant réellement encaissé (frais inclus) et targetOrderId dans l'audit.

### scan-security-7 — Branche PARTENAIRE/ADMIN du scan POST : pas de cash gate, compostage non atomique dont le résultat n'est pas vérifié, réponse « valid » et audit même si aucune ligne n'a été mise à jour

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §40, §11, §154 (vérifiable, historisé)
- **Emplacement :** app/api/controller/scan/route.ts — lignes L306-352, L347-351, L355-367, L392-406
- **Catégorie :** integrite-metier

**Description.** Pour un PARTENAIRE (propriétaire) ou un ADMIN, le code saute l'étape 5 (commande impayée) et l'étape 6 (RPC atomic_ticket_checkin) : il fait un `update ... eq('status','VALIDE')` sans lire le nombre de lignes affectées ni l'erreur, puis renvoie scan_result 'valid' et écrit TICKET_SCAN dans audit_logs. Deux scans concurrents (partenaire + contrôleur) produisent deux « valid », et un billet dans un statut inattendu (ex. EN_ATTENTE) est annoncé valide sans être composté. Un billet rattaché à une commande impayée est admis sans encaissement.

**Preuve.** L347-351 : `await supabase.from('tickets').update({ status: 'UTILISE', ... }).eq('id', ticket.id).eq('status', 'VALIDE');` (aucune destructuration de data/error) ; L392-394 : `return NextResponse.json({ scan_result: 'valid', ...` ; aucune lecture de `order` dans cette branche.

**Impact.** Double entrée possible au portique pour un même billet, accès accordé pour des billets impayés lorsque l'organisateur scanne lui-même, journal d'audit contenant des scans « réussis » sans effet en base.

**Recommandation.** Factoriser les deux branches : mêmes contrôles de statut billet/commande et même appel à atomic_ticket_checkin pour tous les rôles ; vérifier `already_used`/erreur avant de répondre ; ne journaliser TICKET_SCAN qu'après confirmation de la transition.

### scan-security-8 — Un partenaire peut réactiver un compte SUSPENDU par l'administration via l'invitation ou la mise à jour des affectations (status: 'ACTIF' inconditionnel)

- **Sévérité :** ÉLEVÉE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §10, §129 (suspension), §152
- **Emplacement :** app/api/partner/team/invite/route.ts — lignes L194-201 ; app/api/partner/team/assignments/route.ts L122, L211-216
- **Catégorie :** rbac

**Description.** Lors de la promotion d'un compte existant en contrôleur, le partenaire force `status: 'ACTIF'` sur public.users sans vérifier l'état courant ; PATCH /api/partner/team/assignments fait de même (L122) et, en étape 7, remet ACTIF tout profil non actif (L211-216). Les seules protections de suspension (middleware /controller L197, scan L37-39) s'appuient sur ce champ.

**Preuve.** invite/route.ts L194-196 : `await supabase.from('users').update({ role: 'CONTROLEUR', status: 'ACTIF', ...` ; assignments/route.ts L211-215 : `if (ctrlUser && ctrlUser.status !== 'ACTIF') { await supabase.from('users').update({ status: 'ACTIF' }) ...`.

**Impact.** Contournement d'une sanction administrative (fraudeur suspendu) par un simple partenaire ; le compte récupère accès scanner, caisse et données ; aucune alerte admin.

**Recommandation.** Refuser l'invitation/affectation si users.status IN ('SUSPENDU','SUPPRIME') (403 explicite), ne jamais modifier status depuis les routes partenaire, et journaliser la tentative.

### scan-security-9 — Journal d'audit falsifiable : la politique audit_logs_insert_system accepte toute insertion (WITH CHECK (TRUE)) depuis le client Supabase

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** moyenne
- **Référence CDC :** §134 (journal d'activité), §156 ; architecture.md §28 (audit « inaltérable »)
- **Emplacement :** supabase/migrations/0003_rls.sql — lignes L355-359 ; supabase/migrations/0001_initial_schema.sql L665-680
- **Catégorie :** tracabilite

**Description.** RLS est activé sur audit_logs mais la politique d'INSERT est `WITH CHECK (TRUE)` pour tous les rôles PostgREST ; aucune REVOKE INSERT pour anon/authenticated n'existe dans les migrations (seules des fonctions sont révoquées). Avec la configuration Supabase standard (ALL sur public pour anon/authenticated), n'importe quel utilisateur connecté (voire anonyme) peut insérer des lignes TICKET_SCAN / CASH_COLLECTION / CONTROLLER_DELETED arbitraires avec le user_id de son choix.

**Preuve.** L358-359 : `CREATE POLICY "audit_logs_insert_system" ON audit_logs FOR INSERT WITH CHECK (TRUE);` ; commentaire L680 « Journal d'audit inaltérable ».

**Impact.** Un contrôleur ou client peut noyer ou maquiller le journal (faux scans, fausses collectes de caisse imputées à un collègue), ce qui annule la valeur probante exigée par §156 lors d'un litige d'écart de caisse.

**Recommandation.** Remplacer la politique par une insertion réservée au service_role (DROP POLICY + aucune policy INSERT, ou `WITH CHECK (auth.role() = 'service_role')`) et `REVOKE INSERT, UPDATE, DELETE ON audit_logs FROM anon, authenticated` ; les triggers SECURITY DEFINER continuent d'écrire.

### scan-security-10 — RLS users : tout CONTROLEUR lit l'intégralité de la table users (noms, téléphones, emails de tous les clients)

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §155 (données personnelles) ; architecture.md §30
- **Emplacement :** supabase/migrations/0003_rls.sql — lignes L75-81 ; supabase/migrations/20260906_user_roles_multi_role.sql L214-217
- **Catégorie :** rls

**Description.** users_select_policy inclut `OR is_controller()` sans restriction : un simple contrôleur (compte créé par n'importe quel partenaire) peut, avec la clé anon et son JWT, exporter toute la base utilisateurs via PostgREST. Le besoin métier (afficher le nom du porteur au scan) est déjà couvert côté serveur par le service_role.

**Preuve.** L75-81 : `CREATE POLICY "users_select_policy" ON users FOR SELECT USING (id = auth.uid() OR is_admin() OR is_controller() OR EXISTS (...partners...))`.

**Impact.** Fuite massive de données personnelles (RGPD / §155) exploitable pour du phishing SMS ciblé sur les acheteurs de billets ; combinée à l'IDOR /api/tickets?userId=, accès aux billets de chaque victime.

**Recommandation.** Retirer `is_controller()` de users_select_policy ; si une lecture est nécessaire côté client, la limiter aux porteurs de billets des événements assignés via une vue dédiée exposant uniquement prénom/nom.

### scan-security-11 — Traçabilité incomplète et attribution erronée : refus de scan, saisie manuelle et tentatives suspectes non journalisés ; audit de verify imputé au porteur ; échecs d'écriture silencieux

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §154 (historisé), §156, §134
- **Emplacement :** app/api/controller/scan/route.ts — lignes L120-125, L150-162, L204-209, L217-228, L231-237, L252-263, L300-305, L355-367, L401 ; app/api/tickets/verify/route.ts L154-156 ; lib/admin/admin.service.ts L232-246
- **Catégorie :** tracabilite

**Description.** Seul le scan réussi (L355-367) et l'encaissement (PUT L569-577) appellent AdminService.logAudit. Tous les chemins de refus (billet inexistant, QR expiré, non assigné, déjà utilisé, annulé/remboursé, paiement requis, double scan concurrent) retournent sans trace ; is_manual_entry (L401) n'est renvoyé qu'au client et jamais stocké. Dans verify, l'audit utilise userId = ticket.user_id (le client) et un rôle 'CONTROLEUR' codé en dur. logAudit avale toute erreur (console.error) : une insertion refusée (ex. 'controller-scan' non-UUID) disparaît sans alerte. stats.scanned_today est recalculé par COUNT à chaque scan mais aucune table de scans n'existe pour l'historique par contrôleur.

**Preuve.** scan/route.ts L217-227 : `return NextResponse.json({ scan_result: 'already_used', ... })` sans logAudit ; verify/route.ts L155-156 : `userId: ticket.user_id || 'controller-scan', userRole: 'CONTROLEUR'` ; admin.service.ts L244-246 : `catch (err) { console.error(...) }`.

**Impact.** Impossible de détecter des tentatives répétées sur un même billet, d'identifier un contrôleur qui multiplie les saisies manuelles, ou de reconstituer un litige « on m'a refusé l'entrée » ; l'exigence « historisé » du §154 n'est pas satisfaite.

**Recommandation.** Créer une table ticket_scans (ticket_id, event_id, scanner_id, result, is_manual, raw_payload_hash, ip, created_at) alimentée pour chaque tentative, y compris les refus ; faire remonter les erreurs de logAudit (retour booléen + alerte) ; corriger l'attribution dans verify ou supprimer la route.

### scan-security-12 — Secret TOTP : colonne totp_secret jamais lue ni alimentée, dérivation depuis le secret Svix du hook SMS / la clé service_role / une constante codée en dur ; rotation au transfert inopérante ; comparaison non constante

- **Sévérité :** MOYENNE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §154 (sécurisé), §151 ; architecture.md §29 (secrets côté serveur)
- **Emplacement :** lib/security/totp.ts — lignes L17-20, L85-104 ; app/api/controller/scan/route.ts L81-96, L144-148 ; app/api/tickets/[id]/live-code/route.ts L34, L59 ; lib/events/event.service.ts L1169-1178 ; lib/tickets/ticket-transfer.service.ts L693, L710 ; .env.example L30
- **Catégorie :** crypto

**Description.** reserveTicketsAtomic n'insère pas totp_secret ; les deux routes qui consomment le secret ne sélectionnent pas la colonne (ticketSelect L81-96 ; live-code L34), donc `(ticket as any).totp_secret` vaut toujours undefined et tous les billets utilisent deriveTicketTotpSecret(ticket.id) = HMAC(masterKey, 'ticket_secret_'+id). Le transfert P2P écrit bien un nouveau totp_secret (L710) mais il n'est jamais utilisé : la « révocation » est illusoire. masterKey = SUPABASE_AUTH_HOOK_SECRET (secret Svix du hook SMS, documenté comme tel dans .env.example) → SUPABASE_SERVICE_ROLE_KEY → constante '<valeur de repli retirée (lot 1C.6)>' : réutilisation d'un secret critique à un autre usage, aucune rotation possible sans invalider tous les QR, et si l'env est absente tout détenteur du code source calcule les codes de n'importe quel billet à partir de son UUID. verifyTotp compare avec `===` (non constant en temps) et accepte ±2 pas de 20 s, soit 100 s de validité par code alors que l'UI annonce 20 s. Même salt/fallback pour le PIN régisseur (shift.service L50-52).

**Preuve.** totp.ts L18 : `const masterKey = process.env.SUPABASE_AUTH_HOOK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '<valeur de repli retirée (lot 1C.6)>';` ; scan/route.ts L144 `const secret = (ticket as any).totp_secret || deriveTicketTotpSecret(ticket.id);` alors que L81-96 ne sélectionne pas totp_secret ; L146 `toleranceWindows: 2`.

**Impact.** Dépendance de la sécurité des QR à un secret conçu pour un autre composant (sa rotation ou sa fuite casse/compromet toute la billetterie) ; en environnement mal configuré, forgeabilité totale des codes ; rotation annoncée au transfert sans effet.

**Recommandation.** Alimenter totp_secret à l'émission (generateTotpSecret déjà présent), le sélectionner explicitement dans scan/live-code et n'utiliser la dérivation qu'en migration ponctuelle ; introduire une variable dédiée TICKET_TOTP_MASTER_KEY obligatoire (échec au démarrage si absente, aucun fallback constant) ; utiliser crypto.timingSafeEqual ; réduire la tolérance à ±1 pas (ou aligner l'affichage).

### scan-security-13 — Hash du PIN régisseur exposé publiquement via la RLS events_read_public et généré avec Math.random ; cache mémoire des PIN prioritaire sur la base

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** moyenne
- **Référence CDC :** §11, §153 (OTP opérations sensibles), §155
- **Emplacement :** supabase/migrations/20260906_controller_shifts.sql — lignes L7-9 ; supabase/migrations/0003_rls.sql L135-136 ; lib/shifts/shift.service.ts L50-56, L95, L100, L148-151
- **Catégorie :** caisse-securite

**Description.** regisseur_pin_hash est ajouté sur public.events, table dont la politique SELECT `status = 'PUBLIE' OR ...` expose toutes les colonnes à tout utilisateur (anon compris) via PostgREST (`select=regisseur_pin_hash`). Le hash est un HMAC-SHA256 d'un PIN à 6 chiffres (espace 10^6) : quiconque connaît la clé (fallback constante, ou clé partagée avec d'autres usages, cf. constat précédent) retrouve le PIN hors ligne en quelques millisecondes, ce qui neutralise le rate limiting fail-closed de verifyRegisseurPin. Le PIN est tiré avec Math.random (L95). verifyRegisseurPin lit d'abord memoryPins (L148-151) : sur une plateforme serverless multi-instances, un PIN régénéré n'est pas reconnu par les instances détenant l'ancien hash et l'ancien PIN y reste accepté. La génération du PIN (opération sensible : elle autorise ouvertures/clôtures de caisse) n'exige aucun OTP.

**Preuve.** 0003_rls.sql L135-136 : `CREATE POLICY "events_read_public" ON events FOR SELECT USING (status = 'PUBLIE' OR is_partner_owner(partner_id) OR is_admin());` ; shift.service.ts L95 `Math.floor(100000 + Math.random() * 900000)` ; L148-150 `const memoryEntry = memoryPins.get(eventId); if (memoryEntry) { storedHash = memoryEntry.hash; }`.

**Impact.** Un contrôleur (ou un tiers) peut récupérer le PIN régisseur et ouvrir/clôturer seul des sessions de caisse, falsifiant la co-signature qui fonde le Z de caisse ; incohérences d'acceptation du PIN entre instances en production.

**Recommandation.** Déplacer le hash dans une table non exposée (ou révoquer la colonne via une vue / column-level grants), utiliser un KDF lent (bcrypt/argon2) avec sel par événement, crypto.randomInt pour la génération, supprimer le cache mémoire (base = source de vérité) et exiger un OTP (§153) pour (re)générer le PIN.

### scan-security-14 — Aucun contrôle de date/heure au scan ni à l'encaissement : scan possible des jours avant/après, événements VALIDE non publiés scannables, pas de passage automatique en TERMINE, encaissement possible sur événement ANNULE

- **Sévérité :** MOYENNE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §40, §35 (date de début / date de fin), §41 (annulation)
- **Emplacement :** app/api/controller/scan/route.ts — lignes L165-193, L466-469 ; lib/events/event-status.ts L14 ; lib/shifts/shift.service.ts L199-261
- **Catégorie :** regles-metier

**Description.** Le scan ne vérifie que le statut de l'événement ; start_date/end_date ne sont jamais consultés (seule l'ouverture de shift applique isWithinShiftWindow, avec une tolérance de ±12h+2h/4h). ELIGIBLE_EVENT_STATUSES_FOR_CONTROLLER inclut 'VALIDE' (validé mais non publié, billetterie fermée). Aucun cron du dépôt (app/api/cron : moratoriums, ticket-transfers uniquement) ni trigger ne fait passer un événement en TERMINE : un billet reste scannable indéfiniment après la date. Le PUT d'encaissement ne bloque que TERMINE/SUSPENDU (L467) : un événement ANNULE accepte encore des encaissements espèces, alors que le POST les refuse (L166-172).

**Preuve.** scan/route.ts L187 : `if (eventData?.status && !isEventEligibleForController(eventData.status))` (aucune comparaison de dates) ; L467 : `if (evStatus === 'TERMINE' || evStatus === 'SUSPENDU')` ; event-status.ts L14 : `['VALIDE', 'PUBLIE']`.

**Impact.** Compostage de billets hors période (tests frauduleux la veille, entrée « en avance » consommant le billet), encaissements sur événement annulé devant être remboursé (§41), statistiques et Z de caisse incohérents.

**Recommandation.** Appliquer au scan et au PUT une fenêtre [start - X h, end + Y h] configurable par événement, refuser ANNULE/non PUBLIE à l'encaissement, et ajouter une tâche planifiée (pg_cron ou route cron sécurisée) passant les événements échus en TERMINE.

### scan-security-15 — Rate limiting du scan effectif uniquement en mémoire locale (checkAndRecord ne compte jamais les tentatives en base) ; aucun rate limit sur PUT et live-code

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §154 (sécurisé) ; architecture.md §29 (protection des API)
- **Emplacement :** lib/security/rate-limiter.ts — lignes L108-115, L117-141 ; app/api/controller/scan/route.ts L41-57, L423-445 ; app/api/tickets/[id]/live-code/route.ts L13-29
- **Catégorie :** robustesse

**Description.** checkAndRecord arbitre d'abord sur inMemoryBurstCache puis, côté base, ne vérifie qu'un éventuel locked_until et insère la tentative sans jamais compter les lignes de la fenêtre (contrairement à isRateLimited L68-79). Comme personne ne pose de locked_until pour la clé controller_scan, la limite « 5/s » n'existe que par instance Node : sur Vercel/serverless, chaque lambda a son propre compteur et une rafale distribuée n'est pas limitée ; failClosed=false désactive toute limite en cas d'erreur SQL. Le PUT d'encaissement et live-code n'ont aucun limiteur. Avec une fenêtre d'acceptation de 100 s et 6 chiffres, le TOTP résiste en théorie (~2×10^5 essais attendus), mais cette défense est secondaire tant que les identifiants statiques passent sans TOTP.

**Preuve.** rate-limiter.ts L136-141 : `await (supabase.from('rate_limits') as any).insert({ identifier, attempted_at: now }); return { limited: false };` (aucun COUNT) ; scan/route.ts L47 `failClosed: false`.

**Impact.** Énumération/force brute facilitée (codes TOTP, numéros de billets TCK-<date>-<8 hex>), amplification de charge sur la table tickets par un contrôleur malveillant ou un script.

**Recommandation.** Faire compter checkAndRecord en base (ou utiliser une RPC incrémentale atomique), poser locked_until au dépassement, activer failClosed sur les routes de contrôle, et appliquer un limiteur au PUT et à live-code.

### scan-security-16 — GET /api/controller/shifts/[id]/summary : tout contrôleur consulte le Z de caisse de n'importe quelle session (IDOR inter-partenaires)

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §152, §155 (données financières)
- **Emplacement :** app/api/controller/shifts/[id]/summary/route.ts — lignes L16-27 ; middleware.ts L179-207
- **Catégorie :** idor

**Description.** La route vérifie seulement l'existence d'une session puis appelle ShiftService.getShiftSummary(shiftId) qui ne reçoit ni l'utilisateur ni le partenaire : aucune vérification que le shift appartient au contrôleur appelant ou à un événement de son partenaire. Le middleware autorise tout CONTROLEUR actif sur /api/controller/*.

**Preuve.** L16-27 : `const user = await getServerSessionUser(req); if (!user) return 401; ... const summary = await ShiftService.getShiftSummary(shiftId);` (aucun contrôle d'appartenance).

**Impact.** Fuite des montants attendus/déclarés, écarts, justification, nom et téléphone d'un contrôleur d'un autre organisateur (UUID de shift visibles dans les listes partenaire et les réponses d'ouverture).

**Recommandation.** Dans la route, charger le shift et exiger controller_id === user.id, ou propriété partenaire de l'événement, ou rôle ADMIN ; sinon 403.

### scan-security-17 — Retrait d'une affectation en plein événement sans vérification de session de caisse ouverte (DELETE team/[eventId] et team/all) — shifts orphelins OUVERT

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §11, §84 (rapprochement), §156
- **Emplacement :** app/api/partner/team/[eventId]/route.ts — lignes L117-125 ; app/api/partner/team/all/route.ts L222-230 ; (contre-exemple) app/api/partner/team/controller/[controllerId]/route.ts L66-72 et app/api/partner/team/assignments/route.ts L161-167
- **Catégorie :** caisse-integrite

**Description.** Deux des quatre chemins de désaffectation suppriment event_controllers sans appeler ShiftService.hasActiveShift, alors que la suppression complète et le PATCH des affectations le font. Le contrôleur retiré perd l'événement dans son UI (fetchAssignments) alors que son shift reste OUVERT avec un expected_cash_total non clôturé ; aucun mécanisme ne clôture ou ne passe le shift en LITIGE.

**Preuve.** team/[eventId]/route.ts L117-120 : `const { error: delErr } = await supabase.from('event_controllers').delete().eq('id', assignmentId);` (pas de hasActiveShift) ; controller/[controllerId]/route.ts L66-72 fait le contrôle `OPEN_SHIFT_EXISTS`.

**Impact.** Espèces encaissées jamais déclarées ni rapprochées (Z de caisse incomplet), impossibilité d'imputer un écart, contournement possible par un partenaire qui veut « faire disparaître » une session gênante.

**Recommandation.** Centraliser la désaffectation dans un service unique qui refuse (ou force la clôture en LITIGE avec notification) lorsqu'un shift OUVERT existe sur l'événement concerné.

### scan-security-18 — ShiftService : fallbacks mémoire (shifts, PIN, encaissements) masquent les échecs base et créent des états de caisse fantômes ; update de commande non vérifié

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §84 (rapprochement financier), §156
- **Emplacement :** lib/shifts/shift.service.ts — lignes L46-48, L349-378, L385-415, L421-463, L482-490 ; app/api/controller/scan/route.ts L555-560
- **Catégorie :** robustesse

**Description.** Si l'insertion controller_shifts échoue, openShift renvoie quand même un shift stocké seulement en mémoire (L349-378) ; getActiveShift le retrouve (L407-414) et le PUT d'encaissement l'utilise : orders.update({ shift_id }) viole alors la FK, mais l'erreur n'est pas lue (scan/route.ts L555-560), et recordCashPayment incrémente un total en mémoire (L426-430) perdu au redémarrage/sur une autre instance. closeShift lit aussi la mémoire si la base ne répond pas. En serverless, chaque instance possède sa propre Map : un contrôleur peut voir une session « ouverte » sur une instance et « absente » sur une autre.

**Preuve.** L368-369 : `if (insErr) { console.warn('[ShiftService] Échec insertion controller_shifts en base (fallback actif):', ...)` puis L378 `return shiftData;` ; scan/route.ts L555-560 : `await supabase.from('orders').update({...}).eq('id', targetOrderId);` sans lecture de l'erreur.

**Impact.** Encaissements espèces validés côté client mais absents de toute table (ni shift, ni commande marquée payée), donc perte de traçabilité financière et litiges insolubles ; comportement non déterministe entre instances.

**Recommandation.** Supprimer les fallbacks mémoire (échec = erreur 5xx explicite), vérifier et propager toutes les erreurs d'écriture, et réaliser ouverture/encaissement/clôture dans des RPC transactionnelles avec incrément atomique (UPDATE ... SET expected_cash_total = expected_cash_total + p_amount).

### scan-security-19 — Routes partenaire sans contrôle du statut de compte : un PARTENAIRE suspendu continue d'inviter des contrôleurs, générer des PIN et scanner (middleware JWT-only, pas de vérification user.status)

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §129 (suspension partenaire), §152
- **Emplacement :** middleware.ts — lignes L209-221 ; app/api/partner/team/invite/route.ts L47-53 ; app/api/partner/events/[id]/regisseur-pin/route.ts L19-25 ; app/api/tickets/verify/route.ts L14-28 ; (contre-exemple) app/api/controller/scan/route.ts L37-39 et middleware.ts L190-197
- **Catégorie :** rbac

**Description.** Pour /partner et /api/partner, le middleware se contente des rôles du JWT (non rafraîchis) sans lire users.status, contrairement à /controller qui vérifie le statut ACTIF en base. Aucune route partenaire auditée (invite, assignments, regisseur-pin, team) ne teste user.status, et /api/tickets/verify ne teste rien. Une suspension administrative ne révoque donc ni les capacités d'équipe ni le scan côté partenaire tant que la session reste valide.

**Preuve.** middleware.ts L210-211 : `if (pathname.startsWith('/partner') ...) { if (!hasAnyRole(roles, ['PARTENAIRE', 'ADMIN', 'SUPERADMIN']))` (aucune requête users.status) ; invite/route.ts L47-53 : seulement `if (!serverIsPartner(user)) return 403`.

**Impact.** Un organisateur suspendu pour fraude peut continuer à créer des comptes contrôleurs (SMS envoyés au nom de la plateforme), ouvrir des caisses et composter des billets.

**Recommandation.** Ajouter dans getServerSessionUser (ou un helper requireActiveUser) un refus systématique si status != 'ACTIF', l'appliquer à toutes les routes /api/partner et /api/tickets, et aligner le middleware /partner sur la logique de /controller (statut lu en base).

### scan-security-20 — Fuite d'informations billet (numéro, titre, catégorie, nom du porteur) à un contrôleur non assigné : le contrôle TOTP et ses messages précèdent la vérification d'assignation

- **Sévérité :** FAIBLE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §152, §155
- **Emplacement :** app/api/controller/scan/route.ts — lignes L134-163, L195-209
- **Catégorie :** ordre-des-controles

**Description.** Pour un payload dynamique au TOTP invalide/expiré, la route renvoie QR_EXPIRED avec ticket_info (ticket_number, event_title, category, holder_name) à l'étape 1.1, avant de vérifier à l'étape 2 que le contrôleur est assigné à l'événement. Un contrôleur quelconque peut donc sonder des payloads (EVT1:<qr>:000000) pour confirmer l'existence d'un billet et obtenir le nom de son porteur.

**Preuve.** L150-161 : `if (!isTotpValid) return NextResponse.json({ code: 'QR_EXPIRED', ..., ticket_info: { ticket_number, event_title, category, holder_name } })` ; l'assignation n'est lue qu'en L197-209.

**Impact.** Oracle d'existence de billets et divulgation de données personnelles hors périmètre d'assignation.

**Recommandation.** Vérifier l'assignation (ou la propriété partenaire) immédiatement après la résolution du billet, avant toute vérification TOTP, et ne renvoyer ticket_info qu'aux appelants autorisés.

## E. Parcours Client (UX, front-end)

**Synthèse de l'auditeur :** Le parcours client est fonctionnellement complet dans son squelette : découverte → page événement avec panier multi-catégories et realtime sur les stocks → modale SamirPay (deep-link mobile, QR desktop, push USSD) → wallet avec QR TOTP rotatif 20 s → transfert P2P/réclamation → notifications realtime, avec des états skeleton/vide/erreur présents sur la plupart des écrans. Le design system (Plus Jakarta Sans, Sunset Coral #FF5722, classes dark: quasi systématiques, animations CSS légères) est appliqué de façon cohérente. En revanche, l'audit révèle une non-conformité financière centrale (frais de service §37 jamais affichés ni facturés au client), plusieurs bugs fonctionnels bloquants (option Carte Bancaire morte, fenêtre de vente ignorée, billet du jour J relégué en historique, annulation d'événement invisible côté client, filtres Explore masquant des événements), un flux de retour de paiement mobile sans écran de confirmation, deux failles liées au wallet (IDOR par userId en query, partage WhatsApp du numéro de billet qui vaut laissez-passer), et une finition visuelle en deçà du standard « zéro look IA » (emojis, placeholders, classes Tailwind inopérantes sur le hero).

**Limites de couverture :** Audit en lecture seule, sans exécution de build, de tests ni de rendu navigateur : aucune capture d'écran, pas de mesure Lighthouse, pas de test réel sur mobile. Le constat sur les classes Tailwind inopérantes (bg-white/8, shadow-xs, h-13) est déduit du comportement documenté de Tailwind 3.4 et de tailwind.config.ts, sans CSS compilé disponible dans le dépôt (.next absent) ; à confirmer par un build. La collision « hold propre » lors d'un retry après timeout de la modale est inférée du code (verifyAndEnforceHoldAtomic) sans exécution. Non couverts : pages /wallet, /orders, /profile, /register, /halls, /restaurants, composants Logo/OtpInput, templates SMS/Email/WhatsApp (§22 canaux), rendu du PDF billet, comportement réel de SamirPay sur return_url/cancel_url, espaces partenaire/admin/contrôleur (hors dimension). Le constat IDOR /api/tickets recoupe la dimension sécurité ; le constat frais de service recoupe la dimension finance (le backend n'a été lu que pour prouver l'incohérence avec l'UI).

### client-ux-1 — Frais de service CDC (§37/§79) ni affichés au client ni facturés : le total client = prix facial, les frais sont déduits du reversement organisateur

- **Sévérité :** CRITIQUE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §37, §79, Annexe F (Ticketing : Client paie 1 050 F, organisateur reçoit 1 000 F)
- **Emplacement :** app/events/[id]/page.tsx — lignes 75, 635-641, 657, 697 ; components/payment/PaymentModal.tsx 229, 339 ; app/api/checkout/route.ts 94, 155-162, 178, 240
- **Catégorie :** conformité-financière / affichage-prix

**Description.** Le récapitulatif panier et la modale de paiement n'affichent aucune ligne « Frais de service » : le total présenté est la somme des prix faciaux (cartTotal). Côté serveur, /api/checkout facture exactement ce montant à SamirPay (amount: payableAmount) et calcule un serviceFee qu'il soustrait du reversement partenaire (partnerPayout = payableAmount - serviceFee). Le modèle CDC « Prix du ticket + frais de service » est implémenté dans FinancialCalculatorService.calculateTicketingFinancials (buyerTotalPaid = facial + fee, lib/payments/financial-calculator.service.ts:65-66) mais n'est pas utilisé par le checkout ni par l'UI. Le montant débité est donc cohérent avec l'affichage, mais tous deux sont non conformes au CDC, et l'organisateur perçoit 95 % du prix facial au lieu de 100 %.

**Preuve.** app/events/[id]/page.tsx:75 `const cartTotal = cartItems.reduce((sum, item) => sum + (item.price || 0) * item.qty, 0);` ; :640 `${cartTotal.toLocaleString('fr-FR')} FCFA` ; PaymentModal.tsx:339 `Payer ${amountFormatted}` ; app/api/checkout/route.ts:94 `payableAmount += price * item.quantity;` ; :162 `const partnerPayout = Math.max(0, payableAmount - serviceFee);` ; :240 `amount: payableAmount,`

**Impact.** Violation d'une règle financière centrale : l'organisateur est amputé des frais de service au lieu du client ; aucune transparence tarifaire pour l'acheteur (pas de détail prix/frais/total) ; les rapports Z, le parrainage (base = revenu net) et la réconciliation reposent sur une répartition non conforme au CDC.

**Recommandation.** Faire calculer le détail par le backend (FinancialCalculatorService) et le renvoyer dans /api/events/[id] (serviceFeeRate) ou via un endpoint de devis ; afficher dans le panier et la modale trois lignes : Sous-total billets, Frais de service (5 %), Total à payer ; facturer buyerTotalPaid à SamirPay et reverser le prix facial intégral au partenaire ; ajouter un test de non-régression sur l'exemple CDC 1 000 → 1 050.

### client-ux-2 — Option « Carte Bancaire » de la modale de paiement inopérante : le checkout rejette l'opérateur CARD avec une erreur technique

- **Sévérité :** ÉLEVÉE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §38 (moyens intégrés), §36
- **Emplacement :** components/payment/PaymentModal.tsx — lignes 38, 52, 122, 141-142, 282-293 ; app/api/checkout/route.ts 16, 34-35
- **Catégorie :** fonctionnel / paiement

**Description.** La modale propose un troisième moyen « Carte Bancaire » (operator 'card'), ne demande alors pas de numéro, et envoie `operator: 'CARD'` à /api/checkout. Le schéma Zod du checkout n'accepte que WAVE et ORANGE_MONEY : la requête échoue en 400 et l'utilisateur voit le message brut « Données invalides ». Le schéma hérité CreatePaymentSchema (lib/validations/payment.ts:22) accepte CARD, d'où une incohérence entre les deux chemins. Le hero d'accueil n'annonce d'ailleurs que « Wave & Orange ».

**Preuve.** PaymentModal.tsx:122 `operator: operator === 'om' ? 'ORANGE_MONEY' : operator.toUpperCase(),` ; :284-293 bouton « Carte Bancaire » ; app/api/checkout/route.ts:16 `operator: z.enum(['WAVE', 'ORANGE_MONEY']).optional(),` ; :35 `return NextResponse.json({ error: 'Données invalides', details: ... }, { status: 400 })` ; PaymentModal.tsx:142 `throw new Error(data.error || ...)`

**Impact.** Tout client choisissant la carte ne peut pas payer et reçoit un message technique incompréhensible ; perte de conversion et image dégradée sur l'étape la plus sensible du parcours.

**Recommandation.** Retirer l'option carte tant que SamirPay carte n'est pas intégrée (ou l'alimenter par un flag de configuration serveur), aligner les deux schémas Zod, et traduire les erreurs de validation en messages utilisateur (« Moyen de paiement non disponible »).

### client-ux-3 — Fenêtre de vente des catégories (date début/fin) ignorée par l'UI et par /api/checkout

- **Sévérité :** ÉLEVÉE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §35 (date de début ; date de fin), archi §20 (disponibilités côté serveur)
- **Emplacement :** app/events/[id]/page.tsx — lignes 136, 547, 568-580 ; app/api/events/[id]/route.ts 96-98, 107, 132-136 ; app/api/checkout/route.ts 73-96
- **Catégorie :** conformité-fonctionnelle / règles-de-vente

**Description.** L'API détail calcule saleOpen/saleStarted/saleEnded et un isAvailable qui en tient compte, mais la page utilise sa propre condition isUnavailable (soldOut || closed || stock ≤ 0) : une catégorie dont la vente n'a pas commencé ou est terminée reste sélectionnable (+/−) et achetable, sans aucune mention « Ventes du … au … ». Le handler realtime recalcule isAvailable sans saleOpen. Côté serveur, /api/checkout vérifie is_active et le stock mais pas sale_start/sale_end ; seul le chemin d'achat hérité (lib/events/event.service.ts:1005-1011) applique la fenêtre.

**Preuve.** page.tsx:547 `const isUnavailable = cat.isSoldOut || cat.isClosed || (cat.availableQuantity !== undefined && cat.availableQuantity <= 0);` ; route.ts (events/[id]):107 `const isAvailable = !isClosed && !isSoldOut && !isHeld && availableQuantity > 0 && saleOpen;` ; checkout/route.ts:73-96 (boucle de validation sans sale_start/sale_end)

**Impact.** Un client peut acheter avant l'ouverture officielle (early-bird non respecté) ou après la clôture fixée par l'organisateur ; incohérence entre ce que le partenaire configure et ce que le client voit.

**Recommandation.** Utiliser cat.isAvailable (et saleOpen) dans isUnavailable et dans le handler realtime ; afficher « Ouverture le JJ/MM à HHhMM » / « Ventes clôturées le … » ; ajouter le contrôle de fenêtre dans /api/checkout et verifyAndEnforceHoldAtomic.

### client-ux-4 — Annulation d'événement (et statuts non publiés) invisibles sur la page événement : bannière jamais rendue, notice publique non exposée, événements BROUILLON/SUSPENDU accessibles par URL

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §31 (statuts), §41 (annulation/remboursement), §179
- **Emplacement :** app/events/[id]/page.tsx — lignes 82-101, 257-706 (aucune lecture de event.status) ; app/api/events/[id]/route.ts 48-49, 180, 184-190 ; components/events/EventCancellationBanner.tsx (non importé)
- **Catégorie :** conformité-fonctionnelle / états-du-parcours

**Description.** /api/events/[id] renvoie l'événement quel que soit son statut (pas de filtre PUBLIE) et expose `status`, mais la page ne le lit jamais : un événement ANNULE s'affiche comme un événement normal (titre, catégories, bouton Acheter), et le clic Acheter aboutit à l'erreur serveur « La billetterie de cet événement n'est pas disponible. » (checkout:53-55). Le service d'annulation stocke la notice publique dans practical_info.cancellation.public_notice (event-cancellation.service.ts:166-188), que l'API filtre (seuls address/accessNotes/parking/contactPhone/rules sont renvoyés). EventCancellationBanner existe mais n'est importé nulle part (grep : seul son propre fichier). Les routes /events/* et /api/events sont publiques (middleware.ts:11, 67), donc des brouillons/événements en attente/suspendus sont consultables par ID.

**Preuve.** app/api/events/[id]/route.ts:48-49 `.eq('id', eventId).maybeSingle();` (aucun .eq('status','PUBLIE')) ; :184-190 `practicalInfo: { address: ..., accessNotes: ..., parking: ..., contactPhone: ..., rules: ... }` ; page.tsx:648 `disabled={event.isFullySoldOut || isClaimingFree}` (seule condition de blocage) ; EventCancellationBanner.tsx:11 exporté, 0 usage

**Impact.** Un client ayant un lien (SMS, WhatsApp, partage) vers un événement annulé ne voit ni l'annulation ni le message de l'organisateur ni l'information de remboursement ; il tente d'acheter et reçoit une erreur ; fuite d'événements non validés par l'admin.

**Recommandation.** Dans l'API : filtrer sur status ∈ {PUBLIE, ANNULE, TERMINE} pour le public, renvoyer `cancellation: { publicNotice, cancelledAt }`. Dans la page : rendre EventCancellationBanner si status === 'ANNULE', masquer le panier, afficher « Terminé » si TERMINE, 404 pour BROUILLON/EN_ATTENTE/SUSPENDU.

### client-ux-5 — Le billet du jour J bascule dans « Historique / Utilisés » dès minuit : comparaison d'une DATE (minuit) avec Date.now()

- **Sévérité :** ÉLEVÉE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §20 (consulter statut), §21 (historique), §179 (UTILISER)
- **Emplacement :** app/api/tickets/route.ts — lignes 86, 92 ; app/tickets/page.tsx 81-82, 111-112 ; supabase/migrations/0001_initial_schema.sql 296
- **Catégorie :** bug-intégrité-données / wallet

**Description.** events.start_date est de type DATE (sans heure). L'API wallet construit `new Date(start_date)` (= minuit UTC) et calcule isUpcoming = status VALIDE && startDate ≥ Date.now(). Le jour du concert (ex. 20h), dès 00h00, isUpcoming devient false : le billet disparaît de l'onglet « À venir » (filtre par défaut) et apparaît sous « Historique / Utilisés ». Le handler realtime de la page reproduit la même logique.

**Preuve.** 0001_initial_schema.sql:296 `start_date DATE NOT NULL,` ; api/tickets/route.ts:86 `const startDate = t.events?.start_date ? new Date(t.events.start_date) : new Date();` ; :92 `const isUpcoming = t.status === 'VALIDE' && startDate.getTime() >= Date.now();` ; tickets/page.tsx:111 `if (activeTab === 'UPCOMING') return t.status === 'VALIDE' && t.isUpcoming;`

**Impact.** Le soir de l'événement, moment où le client cherche son QR en file d'attente, son billet n'est plus dans « À venir » et apparaît comme « Historique » : stress, appels support, files d'attente ralenties.

**Recommandation.** Combiner start_date + start_time (ou end_date/end_time) en timestamp local Africa/Dakar et considérer le billet « à venir » jusqu'à la fin de l'événement (+ marge), côté API et côté page ; ajouter un test avec un événement daté du jour.

### client-ux-6 — Explore : le filtre prix (max 100 000 FCFA par défaut) et le filtre ville (3 valeurs codées en dur) masquent silencieusement des événements ; « À partir de Gratuit » trompeur

- **Sévérité :** ÉLEVÉE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §16 (recherche par localisation), §17 (découverte)
- **Emplacement :** app/explore/page.tsx — lignes 14, 39-50, 41-42, 155-164, 173-181, 239-316 ; app/api/events/route.ts 59-61, 76, 78 ; components/events/EventCard.tsx 117-122
- **Catégorie :** fonctionnel / recherche-filtres

**Description.** priceMax vaut 100 000 par défaut et le slider est borné à 100 000 : tout événement dont le prix minimum dépasse 100 000 FCFA (gala, VIP-only) n'apparaît jamais dans Explore, sans message. Le select Ville ne propose que DAKAR / SAINT_LOUIS / SALY alors que l'API renvoie `city` en texte libre mis en majuscules (« THIÈS », « ZIGUINCHOR ») : ces villes sont inaccessibles. Le drawer mobile n'a ni ville ni tri. Enfin, le catalogue affiche « À partir de Gratuit » dès qu'une catégorie gratuite (invitation) coexiste avec des catégories payantes.

**Preuve.** explore/page.tsx:14 `const [priceMax, setPriceMax] = useState<number>(100000);` ; :42 `const matchPrice = evt.price <= priceMax;` ; :175-176 `min={5000} max={100000}` ; :160-163 options DAKAR/SAINT_LOUIS/SALY ; api/events/route.ts:76 `city: (evt.city || 'DAKAR').toUpperCase(),` ; :78 `priceFormatted: minPrice === 0 ? 'Gratuit' : ...`

**Impact.** Des événements payés par les partenaires ne sont pas trouvables par les clients (perte de ventes directe), et la localisation CDC §16 n'est pas opérationnelle hors trois villes ; le prix d'appel « Gratuit » génère déception et contestation.

**Recommandation.** Rendre priceMax non borné par défaut (null = pas de filtre) et calculer la borne du slider sur le max des événements ; alimenter le select ville depuis les valeurs distinctes de l'API ; dupliquer ville et tri dans le drawer mobile ; afficher « À partir de X FCFA » sur les catégories payantes et « Entrée libre » uniquement si toutes sont gratuites.

### client-ux-7 — Retour du paiement mobile sans écran d'attente/confirmation : atterrissage sur un wallet vide, annulation vers /explore sans message, timeout 3 min vs hold 10 min

- **Sévérité :** ÉLEVÉE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §36 (reçoit son ticket), §179 (RECEVOIR CONFIRMATION), archi §15 étapes 13-14
- **Emplacement :** components/payment/PaymentModal.tsx — lignes 23-24, 72-81, 154-157, 170-173, 203-210 ; app/api/checkout/route.ts 194, 219-221, 224-227 ; app/tickets/page.tsx 95-97, 219-226
- **Catégorie :** états-du-parcours / paiement

**Description.** Sur mobile, la modale redirige immédiatement vers le deep-link Wave/OM (window.location.href) ; SamirPay renvoie ensuite sur return_url = /tickets (ou cancel_url = /explore). Aucune page /paiement/retour ne montre « Paiement en cours de confirmation… » : si le webhook met quelques secondes, le client voit « Aucun billet disponible » (EmptyState) jusqu'à l'INSERT realtime ; s'il annule sur Wave, il revient sur /explore sans aucune explication. Sur desktop, le polling s'arrête après 3 minutes avec un message « délai Orange Money expiré » (même pour Wave) alors que le hold serveur dure 10 minutes et que l'intention reste PENDING (handleCancelUssd n'appelle aucun endpoint d'annulation) : un retry immédiat peut échouer avec « Stock insuffisant : des places sont en cours de réservation par d'autres acheteurs », à cause de sa propre réservation.

**Preuve.** PaymentModal.tsx:154-157 `if (isMobile && redirectTarget) { window.location.href = redirectTarget; return; }` ; :24 `const POLL_TIMEOUT_MS = 3 * 60 * 1000;` ; :80 `'Le délai de confirmation Orange Money a expiré...'` ; checkout/route.ts:194 `held_expires_at: new Date(Date.now() + 10 * 60 * 1000)` ; :226-227 `defaultReturnUrl = returnUrl || `${appUrl}/tickets``, `defaultCancelUrl = cancelUrl || `${appUrl}/explore`` ; tickets/page.tsx:221 `title="Aucun billet disponible"`

**Impact.** Doute du client sur le débit de son compte Mobile Money (« j'ai payé et je n'ai rien »), double paiement potentiel, abandon après annulation, blocage temporaire du stock par des intentions orphelines.

**Recommandation.** Créer une page /paiement/[transactionId] (return_url) qui utilise usePaymentStatus (déjà écrit) pour afficher PENDING/SUCCESS/FAILED avec redirection vers le billet ; passer cancel_url vers cette page avec état « annulé » ; exposer POST /api/payments/[id]/cancel appelé par handleCancelUssd pour libérer le hold ; aligner le timeout UI sur held_expires_at ; libeller l'opérateur dynamiquement.

### client-ux-8 — Wallet : le front envoie userId en query string sans jeton et l'API s'y fie — tout utilisateur connecté peut lister les billets (avec qr_code) d'un autre

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** archi §30 (un Client ne doit accéder qu'à ses propres tickets), §42 Règle 3, CDC §155
- **Emplacement :** app/tickets/page.tsx — lignes 36 ; app/api/tickets/route.ts 13-24, 46, 107
- **Catégorie :** code-front / contrat-API (recoupe sécurité)

**Description.** La page Mes billets appelle `/api/tickets?userId=${user.id}` sans en-tête Authorization (contrairement aux autres appels du même écran qui envoient le Bearer). L'API accepte alors `queryUserId` comme identité effective dès lors que le middleware laisse passer une session cookie quelconque. L'identité est donc fournie par le client, et la réponse contient qr_code (identifiant statique accepté par le scanner).

**Preuve.** tickets/page.tsx:36 `const res = await fetch(`/api/tickets?userId=${user.id}`);` ; api/tickets/route.ts:23-24 `const queryUserId = searchParams.get('userId'); const effectiveUserId = userId || queryUserId;` ; :46 `.eq('user_id', effectiveUserId)` ; :107 `qrCodeValue: t.qr_code,`

**Impact.** IDOR : énumération des billets et QR statiques d'autrui par un simple changement d'UUID ; non-respect du principe « le frontend n'est jamais source de vérité ».

**Recommandation.** Côté front, envoyer le Bearer (session.access_token) comme pour /api/tickets/[id]/pdf et supprimer le paramètre userId ; côté API, dériver l'utilisateur exclusivement de getServerSessionUser et ignorer tout userId client.

### client-ux-9 — Les boutons Partager/WhatsApp du billet diffusent le numéro de billet, que le scanner accepte comme laissez-passer sans TOTP ; domaines de partage incohérents

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §39 (QR unique), §154 (QR sécurisé), §104 (anti-fraude)
- **Emplacement :** components/tickets/TicketCard.tsx — lignes 122-134, 136-140, 410-418 ; app/api/tickets/verify/route.ts 23, 31-32, 53-57, 143-151 ; lib/security/totp.ts 148-152
- **Catégorie :** ux-sécurité / wallet

**Description.** TicketCard propose à tout porteur un bouton « WhatsApp » (visible même pour un billet VALIDE) qui ouvre wa.me avec « Mon billet officiel pour … (N° EV-…) », et handleShare copie le numéro dans le presse-papier. Or /api/tickets/verify, pour une saisie sans « : », cherche directement le billet par ticket_number et le composte sans vérification TOTP. Le numéro partagé sur un groupe WhatsApp vaut donc entrée : toute la protection anti-capture du QR dynamique est contournable par saisie manuelle du numéro. Par ailleurs, les liens partagés pointent vers https://event-village.sn (TicketCard:123,128) alors que TransferModal:129 et checkout:224 utilisent eventvillage.sn.

**Preuve.** TicketCard.tsx:137 `const shareText = `Mon billet officiel pour ${eventTitle} (${seat}) sur Event Village (N° ${ticketNumber})`;` ; :139 `window.open(`https://wa.me/?text=${encoded}`, '_blank');` ; verify/route.ts:53-57 `.eq('ticket_number', lookupCode).maybeSingle();` puis :145-151 update status 'UTILISE' ; totp.ts:148-152 (identifiant direct → isDynamic:false)

**Impact.** Fraude à l'entrée (le premier qui donne le numéro passe, le vrai porteur est refusé « déjà utilisé »), incohérence avec le discours « capture d'écran invalide » de la FAQ, liens de partage potentiellement cassés selon le domaine réellement déployé.

**Recommandation.** Retirer le numéro de billet des textes de partage (partager uniquement un lien vers l'événement ou utiliser le flux de transfert) ; côté scanner, réserver la saisie manuelle du numéro au contrôleur avec confirmation d'identité, ou exiger un code TOTP affiché à côté du QR ; centraliser l'URL publique dans NEXT_PUBLIC_APP_URL et l'utiliser partout.

### client-ux-10 — QR dynamique hors ligne : l'UI affiche « Code actif en cache » alors que le dernier payload TOTP est périmé après 20-40 s et sera refusé « QR_EXPIRED » ; aucun repli vers le QR statique

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §39, §40, archi §5 (données hors connexion), §31
- **Emplacement :** components/tickets/TicketCard.tsx — lignes 71, 84-101, 106-114, 313-320, 331-332, 343-345 ; app/api/tickets/verify/route.ts 96-112 ; public/sw.js 36-43
- **Catégorie :** états-du-parcours / QR-dynamique

**Description.** Au premier succès, dynamicQr contient « EVT1:<qr>:<code> ». Si le réseau tombe, fetchLiveCode passe isOffline à true mais ne modifie pas dynamicQr : le QR affiché reste le dernier code TOTP, valable ±1 fenêtre (±20 s) côté scanner, après quoi il est rejeté avec « QR Code expiré ». Le message rassure pourtant le porteur (« Code actif en cache »), le compteur continue de tourner et se remet à 20 toutes les 20 s en relançant une requête vouée à l'échec. Le QR statique (qrCodeValue, accepté par verify en mode non dynamique) n'est pas utilisé en repli, et le service worker ne met jamais /api/tickets en cache : hors ligne, la page /tickets ne charge aucun billet.

**Preuve.** TicketCard.tsx:95-99 `} else { if (isMounted) setIsOffline(true); } } catch { if (isMounted) setIsOffline(true); }` (dynamicQr inchangé) ; :344 `'Code actif en cache — vérifiez votre réseau'` ; verify/route.ts:97 `toleranceWindows: 1, // ±1 fenêtre (±20s)` ; sw.js:36-43 exclusion de `/api/`

**Impact.** Devant une salle où la 3G sature, le porteur présente un QR que le scanner refuse, tout en lisant qu'il est « actif » ; files d'attente et contestation.

**Recommandation.** En cas d'échec réseau, basculer l'affichage sur le QR statique de secours (ou le numéro) avec un libellé explicite « Mode secours : présentez ce code au contrôleur », stopper le compte à rebours, et précharger plusieurs fenêtres TOTP (ex. 10 codes à venir) pour tenir 3-5 minutes hors ligne ; mettre en cache la dernière réponse /api/tickets dans le SW ou IndexedDB.

### client-ux-11 — Mobile-first imparfait : CTA d'achat fixe qui recouvre la barre de navigation sans safe-area, conteneur de toasts qui déborde de l'écran, cibles tactiles de 28 px et 8 px

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** archi §38 (boutons suffisamment grands, navigation tactile), §37
- **Emplacement :** app/events/[id]/page.tsx — lignes 670-688, 584-605 ; components/ui/Toast.tsx 175 ; components/layout/AppLayout.tsx 708 ; components/notifications/NotificationBell.tsx 368-373
- **Catégorie :** mobile / accessibilité

**Description.** Le CTA mobile de la page événement est `fixed bottom-0 … z-50` sans `safe-bottom`, au-dessus de la bottom-nav `fixed bottom-0 z-40 safe-bottom` : il la masque entièrement dès qu'un billet est sélectionné et colle à l'encoche iPhone. Le conteneur de toasts est `fixed bottom-5 right-5 max-w-sm w-full` : sur un écran de 360-390 px, w-full (100 vw) ancré à 20 px du bord droit déborde à gauche et chevauche la bottom-nav. Les boutons +/− de quantité font 28 px (w-7 h-7) et la pastille « marquer comme lu » de la cloche est un bouton de 8 px (w-2 h-2).

**Preuve.** page.tsx:671 `className="fixed bottom-0 left-0 w-full z-50 p-4 ... lg:hidden"` ; AppLayout.tsx:708 `fixed bottom-0 inset-x-0 z-40 ... safe-bottom` ; Toast.tsx:175 `className="fixed bottom-5 right-5 z-[99999] ... max-w-sm w-full sm:max-w-md"` ; page.tsx:588 `className="w-7 h-7 rounded-lg ..."` ; NotificationBell.tsx:372 `className="w-2 h-2 rounded-full bg-[#FF5722] ..."`

**Impact.** Sur smartphone (cible prioritaire), toasts tronqués et illisibles, navigation inaccessible pendant la sélection, erreurs de saisie de quantité, pastille impossible à toucher.

**Recommandation.** Positionner le CTA au-dessus de la bottom-nav (bottom = hauteur nav + safe-area) ou l'intégrer dans la nav ; toasts en `inset-x-4 sm:inset-x-auto sm:right-5 sm:max-w-md` avec bottom calculé sur safe-area + nav ; cibles tactiles ≥ 44 px (boutons +/−, pastille remplacée par un bouton « Marquer lu » de taille normale).

### client-ux-12 — Look « IA générique » : emojis dans l'UI, numéro de téléphone placeholder, visuels Unsplash de secours, favoris factices, badge « Partenaire Certifié » et promesse « crypté 256-bit » non fondés

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** N/A (qualité) — AGENTS.md « zéro look IA générique, pixel-perfect »
- **Emplacement :** app/events/[id]/page.tsx — lignes 45, 270-276, 301, 503, 511-513, 524, 569, 574 ; app/page.tsx 508 ; components/events/EventCard.tsx 32-33, 42, 49, 65-79 ; components/tickets/TransferModal.tsx 238 ; components/layout/AppLayout.tsx 475 ; components/ui/Badge.tsx 132 ; components/payment/PaymentModal.tsx 328 ; components/tickets/TicketCard.tsx 51, 56 ; app/api/tickets/route.ts 101
- **Catégorie :** ux-ui / finition

**Description.** Plusieurs marqueurs de production inachevée sont visibles par le client : emojis « 🔴 ÉVÉNEMENT COMPLET », « 🔒 Ventes Clôturées », « ⏳ En cours de réservation », « 🔒 Verrouillé », « ⭐ Ambassadeur » ; footer avec « +221 78 XXX XX XX » ; images Unsplash génériques en repli (catalogue, hero événement, avatar organisateur, wallet) ; boutons cœur « Ajouter aux favoris » qui ne persistent rien (useState local) ; badge « Partenaire Certifié » affiché pour tout organisateur alors que l'API ne renvoie pas is_verified ; sceau « Paiement crypté 256-bit certifié par SamirPay API » ; valeurs par défaut anglophones/arbitraires (« Live Performance », « Fosse générale (Place libre) », dayNumber '19' / 'DÉC').

**Preuve.** page.tsx:524 `🔴 ÉVÉNEMENT COMPLET` ; :569 `🔒 Ventes Clôturées` ; :574 `⏳ En cours de réservation (réessayez dans quelques minutes)` ; app/page.tsx:508 `+221 78 XXX XX XX` ; EventCard.tsx:42 `const [isLiked, setIsLiked] = useState(false);` ; page.tsx:511-513 `Partenaire Certifié` (inconditionnel) ; PaymentModal.tsx:328 `Paiement crypté 256-bit certifié par SamirPay API` ; TicketCard.tsx:51 `eventSubtitle = 'Live Performance',`

**Impact.** Crédibilité et confiance entamées (fausse certification, faux favoris, contact impossible), rendu non pixel-perfect sur les écrans où le client paie.

**Recommandation.** Remplacer les emojis par des icônes lucide et des badges du design system ; renseigner le vrai numéro support ou retirer la ligne ; visuel de repli maison (illustration de marque) ; retirer les favoris ou les persister (table user_favorites + API) ; conditionner « Partenaire Certifié » à partners.is_verified renvoyé par l'API ; reformuler le sceau (« Paiement sécurisé via SamirPay ») ; supprimer les défauts anglophones.

### client-ux-13 — Liens morts et navigation incohérente : /legal, /privacy, /cgv, /restaurants inexistants ; entrée de menu vers un restaurant codé en dur ; deux parcours « Devenir partenaire » différents

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §17 (découverte restaurants), §179 (CRÉER COMPTE), N/A (qualité)
- **Emplacement :** app/page.tsx — lignes 424, 468-471, 488-490, 528-536 ; components/layout/AppLayout.tsx 78, 143 ; app/login/page.tsx 728
- **Catégorie :** fonctionnel / navigation

**Description.** Le footer pointe vers /legal, /privacy, /cgv et /restaurants : aucune de ces pages n'existe (seules app/restaurants/[id]/menu et /tables existent ; app/not-found.tsx rend un 404). Le menu principal « Restaurants & Tables » envoie tous les clients vers /restaurants/rest-terrou-bi/tables, un identifiant d'établissement codé en dur. « Tarifs & commission » mène au dashboard partenaire. Le CTA d'accueil « Devenir Partenaire » va vers /register?role=partner tandis que la sidebar et la page login utilisent /partner/register.

**Preuve.** app/page.tsx:470 `{ label: 'Restaurants', href: '/restaurants' }` ; :528-536 hrefs `/legal`, `/privacy`, `/cgv` ; :424 `<Link href="/register?role=partner">` ; AppLayout.tsx:78 `{ name: 'Restaurants & Tables', href: '/restaurants/rest-terrou-bi/tables', icon: Utensils }` ; AppLayout.tsx:143 `href: '/partner/register'` ; Glob app/{legal,privacy,cgv}/page.tsx → aucun fichier

**Impact.** Pages 404 depuis l'accueil (mentions légales/CGV obligatoires pour une billetterie), découverte restaurants inutilisable (CDC §17), confusion sur l'inscription partenaire.

**Recommandation.** Créer les pages légales (ou retirer les liens), créer /restaurants (catalogue) et pointer le menu dessus, unifier l'inscription partenaire sur /partner/register, ajouter un test de lint des liens internes.

### client-ux-14 — Design system : classes Tailwind inopérantes (opacités /8, /12, /08 ; shadow-xs ; h-13) qui laissent le champ de recherche du hero sans fond ni bordure ; dark mode non natif (défaut clair, prefers-color-scheme ignoré)

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** moyenne
- **Référence CDC :** N/A (qualité) — AGENTS.md « Dark Mode natif, pixel-perfect » ; archi §37
- **Emplacement :** app/page.tsx — lignes 80, 89, 134, 161, 329, 362 ; tailwind.config.ts 10-66 ; package.json 40 ; components/ui/Button.tsx 49 ; app/events/[id]/page.tsx 263, 272 ; components/providers/ThemeProvider.tsx 24-25 ; app/layout.tsx 52
- **Catégorie :** ux-ui / design-system

**Description.** Le projet est en Tailwind 3.4 (package.json) dont l'échelle d'opacité ne contient que 0,5,10,15… : les modificateurs `bg-white/8`, `border-white/12`, `focus:bg-white/12`, `bg-[#FF5722]/12`, `bg-[#FF3D68]/08` ne génèrent aucune classe (la config n'étend pas `opacity`). Le champ de recherche du hero (ligne 134) n'a donc ni fond ni bordure visible sur fond sombre, et le badge « La Référence Événementielle » perd son fond. De même, `shadow-xs` (absent du thème v3 et de la config), `sm:h-13` et `duration-3000` sont sans effet. Le ThemeProvider démarre en 'light' si rien n'est stocké (pas de 'system' par défaut) et le script anti-FOUC n'applique le sombre que si une valeur est déjà stockée : un utilisateur dont le téléphone est en mode sombre reçoit l'interface claire.

**Preuve.** app/page.tsx:134 `className="w-full h-[52px] pl-11 pr-4 rounded-2xl bg-white/8 border border-white/12 ... focus:bg-white/12 ..."` ; :80 `bg-[#FF3D68]/08` ; package.json:40 `"tailwindcss": "^3.4.10"` ; tailwind.config.ts:57-64 boxShadow sans `xs` ; Button.tsx:49 `'text-base px-6 py-3.5 h-12 sm:h-13 ...'` ; ThemeProvider.tsx:25 `const initialTheme: Theme = saved || 'light';`

**Impact.** Le premier écran vu par le client (hero) présente un champ de saisie « flottant » sans contour ; incohérences d'ombres et de hauteurs sur les boutons ; non-respect de la préférence système sombre.

**Recommandation.** Utiliser les valeurs d'échelle (`/10`, `/15`) ou la syntaxe arbitraire (`/[0.08]`), étendre `boxShadow.xs` ou remplacer par `shadow-sm`, remplacer `h-13` par `h-[3.25rem]` ; définir le thème par défaut sur 'system' et faire respecter prefers-color-scheme dans le script anti-FOUC ; activer un lint Tailwind (eslint-plugin-tailwindcss) pour détecter les classes inconnues. Confirmer par un build (CSS compilé non disponible dans le dépôt).

### client-ux-15 — Modale de paiement : libellés « Orange Money » codés en dur pour Wave et carte, écran « Paiement confirmé » jamais visible, validation du numéro incohérente avec la page login

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §38, §36
- **Emplacement :** components/payment/PaymentModal.tsx — lignes 52, 80, 90-93, 97, 145, 466 ; app/events/[id]/page.tsx 701-704 ; app/login/page.tsx 297
- **Catégorie :** ux-ui / paiement

**Description.** Les messages de timeout, d'échec et de succès mentionnent « Orange Money » quel que soit l'opérateur choisi (Wave ou carte). Sur le flux QR desktop, le statut SUCCESS déclenche setScreen('success') puis immédiatement onPaymentSuccess(), que la page utilise pour fermer la modale et naviguer vers /tickets : l'écran de confirmation avec bouton « Fermer » n'est jamais affiché. Le regex téléphone accepte 70-78 (dont 71-74 inexistants au Sénégal) alors que la page login valide 70/75/76/77/78 ; la détection mobile repose sur l'User-Agent (iPadOS desktop-mode exclu).

**Preuve.** PaymentModal.tsx:97 `setErrorMessage('Le paiement Orange Money a échoué ou a été annulé. Veuillez réessayer.');` ; :466 `Votre paiement Orange Money de ... a été validé.` ; :91-93 `setScreen('success'); onPaymentSuccess?.();` + page.tsx:701-704 `onPaymentSuccess={() => { setIsPaymentOpen(false); router.push('/tickets'); }}` ; :52 `/^(7[0-8])\d{7}$/` vs login:297 `/^\+221[7][05678]\d{7}$/`

**Impact.** Messages erronés pour la majorité des clients (Wave), pas de confirmation explicite après paiement desktop, numéros invalides acceptés puis refusés par l'opérateur.

**Recommandation.** Dériver le libellé de `operator` (map {wave:'Wave', om:'Orange Money', card:'Carte'}), afficher l'écran de succès 2-3 s (ou bouton « Voir mes billets ») avant navigation, partager la fonction de validation/normalisation téléphone de lib/validations/auth, et préférer `matchMedia('(pointer: coarse)')` ou laisser l'utilisateur choisir « Ouvrir l'application ».

### client-ux-16 — Découverte incomplète : aucune fonction « événements proches » (géolocalisation), recherche du hero non transmise à Explore, tri « Plus récents » sans effet, paramètres de recherche API inutilisés et absence de pagination

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §16 (localisation), §17 (événements proches), archi §36 (pagination, requêtes ciblées)
- **Emplacement :** app/page.tsx — lignes 129-146 ; app/explore/page.tsx 16, 21-36, 53-57, 194 ; components/layout/AppLayout.tsx 642-650 ; app/api/events/route.ts 15-17, 41, 84-98
- **Catégorie :** conformité-fonctionnelle / recherche

**Description.** Le CDC §17 prévoit « événements proches » : aucune géolocalisation ni tri par distance n'existe (la carte Leaflet n'apparaît que sur la fiche). Le champ de recherche du hero filtre la grille locale mais le bouton « Explorer » adjacent est un lien nu vers /explore : la saisie est perdue ; la barre de recherche du header est elle aussi un simple lien. Dans Explore, « RECENT » n'applique aucun tri (l'API renvoie par date croissante) alors que le libellé promet « Plus récents ». L'API accepte q/category/city mais le front charge toujours tout le catalogue (cache no-store) et filtre en mémoire, sans pagination.

**Preuve.** app/page.tsx:137-146 `<Link href="/explore"> ... Explorer` (sans query) ; explore/page.tsx:25 `const res = await fetch('/api/events', { cache: 'no-store' });` ; :53-57 (tri uniquement PRICE_ASC/PRICE_DESC) ; :194 `<option value="RECENT">Plus récents</option>` ; api/events/route.ts:15-17 `searchParams.get('q') ... 'category' ... 'city'` ; :41 `.order('start_date', { ascending: true })`

**Impact.** Un client ne peut pas trouver ce qui se passe près de lui ni poursuivre sa recherche depuis l'accueil ; coût réseau croissant avec le catalogue (faible consommation réseau exigée §38).

**Recommandation.** Propager la recherche via /explore?q=… (useSearchParams), implémenter « Près de moi » (navigator.geolocation + tri haversine ou RPC PostGIS côté API), renommer/implémenter le tri (date, pertinence), déléguer filtres et pagination à l'API (limit/offset ou curseur) avec rendu serveur initial.

### client-ux-17 — Gestion d'erreurs et i18n : erreurs réseau masquées en « Aucune notification », messages techniques bruts, codes de type non traduits, heure « 20:00 » fabriquée, statut « (rembourse) » brut, panier perdu après connexion

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §22, §20, archi §37 (lisibilité)
- **Emplacement :** app/notifications/page.tsx — lignes 48-51, 241-243, 284-291 ; app/page.tsx 257-260 ; app/events/[id]/page.tsx 51, 90-92, 211-215 ; components/tickets/TicketCard.tsx 379 ; app/tickets/claim/[token]/page.tsx 375 ; app/api/events/route.ts 55 ; app/api/tickets/route.ts 90
- **Catégorie :** états-du-parcours / messages-utilisateur

**Description.** La page Notifications transforme toute réponse non-OK (401, 500) en liste vide et affiche « Votre journal de notifications est vide », sans état d'erreur ni retry. L'accueil affiche l'erreur de chargement en texte rouge sans bouton « Réessayer » (contrairement à Explore). La fiche événement convertit toute erreur HTTP (y compris 500) en « Événement introuvable ». Les types de notification sont affichés tels quels (KYC, PAYMENT, SYSTEM). Le billet remboursé affiche « Ce billet n'est plus valide (rembourse) » (status.toLowerCase(), sans accent, sans montant/date de remboursement). L'heure « 20:00 » est inventée quand start_time manque (claim, catalogue, wallet). Enfin, le panier (état mémoire) est perdu quand un visiteur non connecté est redirigé vers /login : il doit tout resélectionner au retour.

**Preuve.** notifications/page.tsx:48-51 `if (!res.ok) { setNotifications([]); return; }` ; app/page.tsx:258 `<div className="py-10 text-center text-red-500 text-sm font-medium">{fetchError}</div>` ; events page.tsx:90-92 `if (!res.ok) { throw new Error('Événement introuvable.'); }` ; TicketCard.tsx:379 `Ce billet n'est plus valide ({status.toLowerCase()}).` ; claim page.tsx:375 `claimData.event.start_time ? claimData.event.start_time.substring(0, 5) : '20:00'` ; events page.tsx:211-215 redirection login sans persistance de `cart`

**Impact.** Le client ne sait pas s'il a « zéro notification » ou une panne ; informations fausses (heure) ; absence des informations de remboursement exigées (§82 historique conservé) ; friction à l'achat après connexion.

**Recommandation.** Utiliser ErrorState avec retry sur toutes les listes ; mapper les codes HTTP vers des messages humains ; dictionnaire de libellés pour types/statuts (« Remboursé », « Annulé ») et carte de remboursement (montant, date, opérateur) sur le billet ; afficher « Heure à confirmer » plutôt que 20:00 ; persister le panier en sessionStorage avant la redirection login.

### client-ux-18 — Performance et architecture front : pages catalogue 100 % client (pas de SSR), images hero en CSS non optimisées, Leaflet chargé depuis unpkg à l'exécution, hook realtime non filtré et composants morts

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** archi §36 (Server Components, images optimisées, Realtime ciblé), §38 (chargement rapide, faible consommation réseau)
- **Emplacement :** app/page.tsx — lignes 1, 30-51, 73, 324, 357 ; app/explore/page.tsx 1, 21-36 ; components/ui/EventMap.tsx 18-26, 53-57 ; hooks/usePaymentStatus.ts 83-88 ; components/events/CategoryFilters.tsx 12 ; components/events/FeaturedEventCard.tsx ; components/layout/AppLayoutHeader.tsx
- **Catégorie :** performance / code-front

**Description.** L'accueil et Explore sont des Client Components qui chargent /api/events après hydratation (cache no-store) : pas de HTML indexable, LCP retardé, et les loading.tsx (skeletons différents) ne couvrent que la navigation RSC, d'où un double skeleton. Les visuels hero/espaces sont des background-image CSS Unsplash 1600/900 px non passés par next/image. EventMap injecte un <link> CSS vers unpkg dans le body et charge les icônes marqueur depuis unpkg (dépendance CDN tierce à l'exécution, CSP impossible). usePaymentStatus (non utilisé) s'abonne à tous les UPDATE de la table payments sans filtre. FeaturedEventCard, CategoryFilters (libellés anglais 'My feed', 'Live') et AppLayoutHeader (copie du header) sont du code mort.

**Preuve.** app/page.tsx:1 `'use client';` + :35 `const res = await fetch('/api/events', { cache: 'no-store' });` ; :73 `style={{ backgroundImage: "url('https://images.unsplash.com/photo-...?w=1600...')" }}` ; EventMap.tsx:55 `href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"` ; usePaymentStatus.ts:83-88 `{ event: 'UPDATE', schema: 'public', table: 'payments' }` (sans filter) ; CategoryFilters.tsx:12 `['All', 'My feed', 'Live', ...]` ; grep : aucun import de FeaturedEventCard/CategoryFilters/AppLayoutHeader hors tests

**Impact.** Temps de premier affichage et consommation data élevés sur réseaux sénégalais, SEO nul pour les événements, surface de bugs et de maintenance inutile.

**Recommandation.** Rendre l'accueil/Explore en Server Components (fetch serveur + streaming, Client Component limité aux filtres), utiliser next/image (priority) pour les visuels hero, importer leaflet.css depuis node_modules et copier les icônes dans /public, supprimer ou filtrer usePaymentStatus (filter transaction_id=eq.…), supprimer les composants morts.

### client-ux-19 — Numéros de téléphone Superadmin codés en dur dans le layout client, en violation explicite de la documentation d'architecture

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** docs/architecture.md « Superadministrateur » (l. 1484-1496 : ne jamais hardcoder ce numéro dans les composants frontend), §152
- **Emplacement :** components/layout/AppLayout.tsx — lignes 53-56
- **Catégorie :** code-front / conformité-architecture

**Description.** AppLayout dérive isSuperAdmin d'une comparaison du téléphone du profil avec des constantes ('221773780756', '773780756', '221770000000', '770000000'), alors que l'architecture impose SUPERADMIN_PHONE côté serveur uniquement. La logique de rôles est ainsi dupliquée et divergente entre middleware, AuthProvider et layout.

**Preuve.** AppLayout.tsx:54 `const isSuperadminNumber = mounted && (cleanPhone === '221770000000' || cleanPhone === '770000000' || cleanPhone === '221773780756' || cleanPhone === '773780756');` ; :56 `const isSuperAdmin = roles.includes('SUPERADMIN') || isSuperadminNumber;`

**Impact.** Données sensibles (numéro du dirigeant, numéro de test) livrées dans le bundle public ; menu admin affiché/masqué sur une base non maîtrisée ; dette de maintenance (changement de numéro = redéploiement front).

**Recommandation.** Supprimer la comparaison et se fier uniquement à profile.roles renvoyé par /api/auth/me ; conserver SUPERADMIN_PHONE côté serveur (seed).

### client-ux-20 — Accessibilité : lignes de notification cliquables non focalisables, labels non associés, contrôles icône-seul sans aria-label, double h1, dialogues natifs et promesse share non gérée

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** archi §37 (priorité 3 : accessibilité), AGENTS.md (WCAG)
- **Emplacement :** components/notifications/NotificationBell.tsx — lignes 52-69, 129-141, 329-337 ; app/explore/page.tsx 124, 152, 173-181, 186 ; components/tickets/TicketCard.tsx 190, 387-396 ; app/page.tsx 97-109 ; app/events/[id]/page.tsx 279-284 ; components/payment/PaymentModal.tsx 256-293
- **Catégorie :** accessibilité

**Description.** Les notifications du dropdown sont des <div onClick> sans role/tabIndex/onKeyDown (inaccessibles au clavier), et deux useEffect dupliquent la fermeture au clic extérieur. Dans Explore, les <label> n'ont pas de htmlFor et le slider de prix n'a ni aria-label ni aria-valuetext. Sur mobile, le bouton « Info transfert » masque son texte (hidden sm:inline) sans aria-label. L'accueil contient deux <h1>. L'annulation de transfert passe par window.confirm (hors design system). navigator.share() est appelé sans catch (rejet non géré si l'utilisateur annule). Les boutons de choix d'opérateur n'exposent pas d'état sélectionné (aria-pressed / radiogroup).

**Preuve.** NotificationBell.tsx:329-331 `<div key={notif.id} onClick={() => handleNotificationClick(notif)} ...>` ; explore/page.tsx:173-181 `<input type="range" ... className="w-full accent-[#FF5722]" />` (sans aria-label) ; TicketCard.tsx:394 `<span className="hidden sm:inline">Info transfert</span>` ; app/page.tsx:97 et :103 deux `<h1 ...>` ; events page.tsx:280 `navigator.share({ title: event.title, url: window.location.href });` (sans .catch)

**Impact.** Navigation clavier/lecteur d'écran impossible sur des actions clés, erreurs console en production, non-conformité WCAG de base sur un produit grand public.

**Recommandation.** Transformer les lignes en <button> ou ajouter role="button" tabIndex={0} onKeyDown ; associer labels/inputs (id/htmlFor) et aria-label sur le range ; aria-label sur les boutons icône ; un seul h1 par page ; remplacer window.confirm par la Modal maison ; .catch sur navigator.share ; role="radiogroup" + aria-checked sur le choix d'opérateur.

## F. Parcours Partenaire (UX, front-end)

**Synthèse de l'auditeur :** Points forts : le tunnel de création en 5 étapes couvre réellement §30-§35 (programme, infos pratiques, services, catégories avec dates de vente et limite par commande) avec une validation croisée quotas/capacité répliquée côté serveur ; le calcul financier (FinancialCalculatorService) respecte §79 (le partenaire perçoit le prix facial) ; la page équipe globale est synchronisée en temps réel et le scanner contrôleur (/api/controller/scan) est robuste (RBAC, TOTP, verrou atomique). En revanche, l'espace partenaire présente des ruptures fonctionnelles majeures : le scan « partenaire » passe par un endpoint sans RBAC ni contrôle de propriété, l'annulation (§41) n'est câblée nulle part dans l'UI, l'édition d'un événement publié échoue systématiquement et les modifications de catégories en édition sont silencieusement perdues, les pages Équipe/Caisse par événement (PIN régisseur) sont orphelines, le rejet admin est invisible pour le partenaire, et le rapport Z déduit deux fois les remboursements. S'y ajoutent des KPI « billets vendus / CA » calculés de quatre façons différentes selon les pages, un formulaire sans sauvegarde ni validation par étape, et une finition inégale (accents manquants, références « §31 » exposées aux utilisateurs, couleurs codées en dur malgré des tokens Tailwind existants).

**Limites de couverture :** Audit statique exclusivement (lecture de code), sans exécution de l'application ni des tests. Non couverts ou couverts partiellement : app/controller/scanner/page.tsx (1185 lignes, inspecté par grep uniquement pour la comparaison avec partner/scan) ; components/scan/CameraQrScanner.tsx (non lu) ; les routes /api/partner/team/* (invite lu par grep seulement) ; components/events/EventCalendar.tsx ; pages partner/finance, subscription, profile, products, tables, halls (hors périmètre événementiel) ; la page publique /events/[id] (vérifiée par grep : programme et infos pratiques bien affichés) ; les politiques RLS et migrations. Deux points relevés mais relevant de la dimension sécurité, non développés ici : /api/controller/shifts/[id]/summary (route.ts:16-27) ne vérifie ni rôle ni propriété du shift ; /api/partner/upload ne vérifie que le MIME déclaré par le client (route.ts:26). Les sévérités « medium » sur les KPI et le format des prix dépendent de la durée réelle des holds et de l'arrondi effectué par le service de paiement, non vérifiés.

### partner-ux-1 — Scan partenaire : endpoint /api/tickets/verify sans RBAC, sans contrôle de propriété ni de statut, traçabilité inversée

- **Sévérité :** CRITIQUE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §40, §154, §156 (traçabilité) ; architecture §29-§30
- **Emplacement :** app/api/tickets/verify/route.ts — lignes 14-28, 86-114, 143-162 ; app/partner/scan/page.tsx:53-57 ; middleware.ts:113-118 ; app/api/controller/scan/route.ts:30-39, 165-193, 308-320, 347-351
- **Catégorie :** securite-fonctionnelle

**Description.** La page /partner/scan appelle POST /api/tickets/verify, qui ne lit jamais la session (aucun getServerSessionUser), ne vérifie ni le rôle, ni que l'événement appartient au partenaire connecté, ni le statut de l'événement (TERMINE/ANNULE/SUSPENDU), et composte le billet sans renseigner checked_in_by. Le middleware ne bloque que les requêtes non authentifiées (401) : tout compte CLIENT connecté peut donc poster un ticket_number ou qr_code et invalider le billet d'un tiers. Le scanner contrôleur utilise un autre endpoint (/api/controller/scan) qui fait tous ces contrôles : deux pipelines de scan divergents coexistent.

**Preuve.** verify/route.ts:14-28 : `export async function POST(req) { ... const rawCode = body.qrCode?.trim() || body.ticketNumber?.trim(); ... const supabase = getServiceRoleClient();` (aucune vérification d'utilisateur/rôle). Lignes 145-151 : `.update({ status: 'UTILISE', checked_in_at: now })` (pas de checked_in_by). Lignes 154-157 : `AdminService.logAudit({ userId: ticket.user_id || 'controller-scan', userRole: 'CONTROLEUR', ...` (le porteur du billet est enregistré comme auteur du scan). middleware.ts:113-118 : `if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Authentification requise...' }, { status: 401 })` (seule barrière). À comparer à controller/scan/route.ts:34 `serverHasAnyRole(user, ['CONTROLEUR','ADMIN','SUPERADMIN','PARTENAIRE'])`, 166-193 (statuts ANNULE/TERMINE/SUSPENDU refusés), 308-320 (vérification partner_id), 350 `checked_in_by: user.id`.

**Impact.** Un client malveillant connaissant un numéro de billet (format TKT-xxx lisible sur un billet imprimé ou une capture) peut le « composter » à distance : le porteur légitime est refusé à l'entrée (« déjà utilisé »). Un partenaire peut composter les billets d'un autre partenaire. Les scans partenaires ne sont pas attribués au scanneur dans l'audit et les statistiques de présence (§160) sont faussées ; le scan reste possible sur un événement annulé ou terminé.

**Recommandation.** Faire pointer /partner/scan sur /api/controller/scan (qui gère déjà le rôle PARTENAIRE et la propriété) et supprimer ou verrouiller /api/tickets/verify (RBAC CONTROLEUR/PARTENAIRE/ADMIN, vérification partner_id via resolvePartnerId, refus des statuts non opérationnels via isEventEligibleForController, checked_in_by = user.id, audit au nom du scanneur, verrou atomic_ticket_checkin). Mutualiser le rendu des résultats de scan dans un composant partagé avec le scanner contrôleur.

### partner-ux-2 — Annulation d'événement (§41) impossible depuis l'espace partenaire : EventCancelModal n'est câblé nulle part

- **Sévérité :** ÉLEVÉE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §41 Remboursement ; §82 ; §180 Parcours partenaire (GÉRER)
- **Emplacement :** app/partner/events/page.tsx — lignes 389-482 (aucune action d'annulation) ; components/events/EventCancelModal.tsx:17-24, 69-73, 115-170 ; app/api/partner/events/[id]/cancel/route.ts:11-41 ; lib/events/event-cancellation.service.ts:305-385
- **Catégorie :** conformite-cdc

**Description.** Le backend d'annulation avec remboursements Mobile Money existe (route + service), le composant EventCancelModal existe, mais une recherche sur tout le dépôt ne trouve aucun import de ce composant (seul DIAGNOSTIC.md le cite). La liste des événements n'offre aucune action « Annuler » quel que soit le statut. De plus, la modale elle-même n'affiche pas l'impact financier (nombre de billets, montant à rembourser) alors qu'un résumé GET /api/partner/events/[id]/cancellation existe, et elle ignore `data.message` : lorsque la trésorerie SamirPay est insuffisante, le service renvoie refundsProcessed = 0 avec un message « remboursements en attente », mais le toast affiche « Événement annulé avec succès ».

**Preuve.** Grep « EventCancelModal » : seules occurrences = components/events/EventCancelModal.tsx:8,17 et DIAGNOSTIC.md:111,132. events/page.tsx:391-481 : branches BROUILLON (Supprimer/Modifier/Soumettre), EN_ATTENTE (Modifier), PUBLIE (Quotas/Modifier/Voir), VALIDE (Publier) — aucun bouton Annuler. EventCancelModal.tsx:69-73 : `toast.success(data.refundsProcessed > 0 ? ... : 'Événement annulé avec succès.')` ; event-cancellation.service.ts:382-385 : `refundsProcessed: 0, ... message: 'L'événement a été annulé ... remboursements ... placés en attente de réapprovisionnement'`.

**Impact.** Un organisateur ne peut pas annuler un événement (cas de force majeure) sans passer par l'administration ; les acheteurs ne sont pas remboursés dans les délais ; si le composant est câblé tel quel, le partenaire croira les remboursements effectués alors qu'ils sont suspendus faute de trésorerie.

**Recommandation.** Ajouter l'action « Annuler l'événement » (statuts VALIDE/PUBLIE/SUSPENDU) dans la liste et la page d'édition, ouvrant EventCancelModal ; dans la modale, charger le résumé GET /cancellation (billets vendus, montant total, nombre d'acheteurs) avant confirmation, exiger la saisie du titre pour une confirmation forte, et afficher `data.message` (remboursements en attente) avec un état visuel distinct ; afficher ensuite le bandeau d'annulation et l'avancement des remboursements côté partenaire.

### partner-ux-3 — Édition d'un événement publié échoue systématiquement et les modifications de catégories (étape 5) sont perdues en silence

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §31 Publication ; §35 Création ticketing
- **Emplacement :** lib/events/event.service.ts — lignes 261-276, 283-315, 337-343 ; app/partner/events/[id]/edit/page.tsx:337-345, 356-358, 429-431, 441, 668-724 ; app/partner/events/page.tsx:447-451
- **Catégorie :** integrite-donnees

**Description.** La page d'édition envoie toujours la clé `ticket_categories` (tableau, éventuellement vide). Pour un événement PUBLIE, EventService.updateEvent parcourt les clés du payload et rejette toute clé hors liste blanche : `ticket_categories` n'y figure pas, donc la sauvegarde renvoie « Le champ 'ticket_categories' ne peut pas être modifié pour un événement publié » à chaque fois — alors que la liste propose un bouton « Modifier » sur les événements publiés et que le bandeau promet des modifications « appliquées immédiatement ». Pour les autres statuts, updateEvent ne traite jamais `input.ticket_categories` (aucun insert/update/delete de ticket_categories) : nom, prix, quotas, catégories ajoutées ou supprimées à l'étape 5 sont ignorés, mais le toast annonce une mise à jour réussie.

**Preuve.** edit/page.tsx:337-345 : `ticket_categories: services.ticketing ? ticketCategories.map(c => ({ id: c.id, name: c.name, price: Number(c.price), total_quantity: ... })) : []`. event.service.ts:268-275 : `if (existing.status === 'PUBLIE') { for (const key of Object.keys(input)) { if (input[key] === undefined || key === 'status') continue; if (!allowedFieldsForPublished.has(key)) throw new Error(\`Le champ '${key}' ne peut pas être modifié pour un événement publié.\`) } }` avec allowedFieldsForPublished (261-265) sans 'ticket_categories'. Lignes 283-315 : seuls title, description, dates, location, city, image_url, gallery_urls, capacity, latitude, longitude, category, program, services, practical_info sont copiés dans updateData ; lignes 337-343 : `.from('events').update(updateData)` — aucune écriture sur ticket_categories. edit/page.tsx:356-358 : `if (data.success) { toast.success(toastMessages.events.updated(title)); router.push('/partner/events'); }`.

**Impact.** Un organisateur ne peut corriger aucune information d'un événement en ligne (date, lieu, affiche), bien que l'API notifie les acheteurs de ces changements (event.service.ts:369-453). Sur un brouillon ou un événement validé, il croit avoir corrigé un prix ou un quota qui n'est jamais enregistré : risque de vente au mauvais tarif.

**Recommandation.** Côté client : ne pas envoyer `ticket_categories` sur un événement publié et masquer/désactiver l'étape 5 (renvoyer vers la modale Quotas) ; côté serveur : implémenter la synchronisation des catégories dans updateEvent (upsert par id, création via addTicketCategory, suppression interdite si sold_quantity > 0) ou renvoyer une erreur explicite plutôt qu'un succès. Ajouter un test d'intégration « PUT sur PUBLIE depuis le formulaire d'édition ».

### partner-ux-4 — Cycle de vie incomplet dans l'UI : pas de « Retirer », pas de « Terminer », aucun affichage/action pour SUSPENDU, TERMINE et ANNULE

- **Sévérité :** ÉLEVÉE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §31 Publication (statuts Brouillon ; En attente ; Validé ; Publié ; Suspendu ; Terminé) ; §180
- **Emplacement :** app/partner/events/page.tsx — lignes 37, 255, 391-481 ; lib/events/event.service.ts:756-801
- **Catégorie :** conformite-cdc

**Description.** Le serveur autorise au partenaire EN_ATTENTE→BROUILLON (retrait), PUBLIE→TERMINE et SUSPENDU→TERMINE, mais la liste n'expose que Soumettre, Publier, Modifier, Supprimer et Quotas. Les cartes SUSPENDU, TERMINE et ANNULE n'ont aucune action ni message explicatif (motif de suspension, lien vers le rapport Z, état des remboursements). Le type EventItem.status et les onglets de filtre ignorent le statut ANNULE pourtant présent dans l'enum PostgreSQL (migration 20260910) : un événement annulé n'est filtrable nulle part.

**Preuve.** events/page.tsx:37 : `status: 'BROUILLON' | 'EN_ATTENTE' | 'VALIDE' | 'PUBLIE' | 'SUSPENDU' | 'TERMINE'` (pas ANNULE) ; ligne 255 : `['TOUS','BROUILLON','EN_ATTENTE','VALIDE','PUBLIE','SUSPENDU','TERMINE']`. Lignes 421-434 (EN_ATTENTE) : uniquement « En examen » + Modifier ; 436-458 (PUBLIE) : Quotas/Modifier/Voir ; aucune branche SUSPENDU/TERMINE/ANNULE. event.service.ts:761 `} else if (newStatus === 'BROUILLON') { // Rejet par l'admin ou retrait par le partenaire` ; 785 `} else if (newStatus === 'TERMINE') { // Autorisé pour partenaire et admin` ; 794 idem depuis SUSPENDU. lib/events/event-status.ts:43 gère 'ANNULE'.

**Impact.** Le partenaire ne peut ni retirer une soumission erronée, ni clôturer son événement (déclenchement du bilan), ni comprendre pourquoi il est suspendu ; les événements annulés disparaissent des filtres. Le parcours « GÉRER » du §180 est tronqué.

**Recommandation.** Ajouter les actions conformes à la matrice serveur : « Retirer la soumission » (EN_ATTENTE), « Terminer l'événement » (PUBLIE/SUSPENDU, avec confirmation et lien vers le rapport Z), bandeau de suspension avec motif, carte ANNULE avec état des remboursements ; ajouter ANNULE au type et aux filtres ; remplacer les libellés d'onglets bruts par StatusBadge/labels humains.

### partner-ux-5 — Rejet par l'administrateur invisible pour le partenaire : l'événement redevient un simple BROUILLON sans motif persistant

- **Sévérité :** ÉLEVÉE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §31 ; §180 (VALIDATION) ; §134 Journal d'activité
- **Emplacement :** lib/events/event.service.ts — lignes 761, 804-812, 850-870 ; app/admin/services/page.tsx:77-89 ; app/partner/events/page.tsx:29-50, 391-419
- **Catégorie :** conformite-cdc

**Description.** Le rejet admin est implémenté comme une transition EN_ATTENTE→BROUILLON. Le motif n'est transmis que par notification/SMS/email ; la mise à jour en base ne stocke que `status` et `updated_at`. La liste partenaire ne charge aucun champ de motif/historique : une carte rejetée est strictement identique à un brouillon jamais soumis (mêmes boutons Supprimer/Modifier/Soumettre), sans bandeau « Non validé : motif… ». Le partenaire peut même resoumettre sans rien corriger.

**Preuve.** admin/services/page.tsx:77 : `openRejectModal(..., targetStatus = 'BROUILLON')`. event.service.ts:804-809 : `.update({ status: newStatus, updated_at: new Date().toISOString() })` ; 850-858 : `else if (newStatus === 'BROUILLON' && currentStatus === 'EN_ATTENTE' && isAdmin) { const reasonText = rejectionReason || 'Non spécifié'; await NotificationService.createNotification({... message: \`... Motif : ${reasonText}\` ...})`. events/page.tsx:29-50 : interface EventItem sans champ rejection_reason/last_review ; 391-419 : rendu BROUILLON unique.

**Impact.** L'organisateur ne sait pas, depuis son espace, que son événement a été refusé ni pourquoi ; il perd la notification SMS et resoumet à l'identique, générant des allers-retours avec l'administration et un retard de mise en vente.

**Recommandation.** Persister le rejet (colonnes `review_status`, `rejection_reason`, `reviewed_at` sur events ou table event_reviews) et l'exposer dans GET /api/partner/events ; afficher sur la carte un bandeau rouge « Non validé le JJ/MM — Motif : … » avec bouton « Corriger et resoumettre » ; conserver l'historique des soumissions.

### partner-ux-6 — Pages Équipe et Caisse par événement orphelines : le PIN régisseur et le suivi des Z de caisse sont inaccessibles sans taper l'URL

- **Sévérité :** ÉLEVÉE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §40 Contrôle ; §84 Rapprochement ; architecture §38 (navigation tactile)
- **Emplacement :** app/partner/events/[id]/caisse/page.tsx — lignes 65-85, 129, 150, 177 ; app/partner/events/[id]/team/page.tsx:277, 287 ; app/partner/events/page.tsx:389-482 ; components/layout/AppLayout.tsx:82-105 ; app/api/controller/scan/route.ts:494-501
- **Catégorie :** navigation-fonctionnelle

**Description.** Les seules références aux routes /partner/events/[id]/team et /partner/events/[id]/caisse dans app/ et components/ sont des liens croisés entre ces deux pages. Ni la liste des événements, ni le dashboard, ni la page Équipe globale, ni la navigation (AppLayout) n'y mènent. Or la génération du PIN régisseur n'existe que sur la page caisse, et l'ouverture d'une session de caisse par un contrôleur (préalable obligatoire à tout encaissement espèces) exige ce PIN.

**Preuve.** Grep `/caisse` et `}/team` sur app/ et components/ : uniquement team/page.tsx:287 `href={\`/partner/events/${eventId}/caisse\`}` et caisse/page.tsx:129,150 `href={\`/partner/events/${eventId}/team\`}`. Grep `regisseur-pin` dans les pages : uniquement caisse/page.tsx:68. events/page.tsx:403,427,447,452 : seuls liens vers /edit et /events/[id]. controller/scan/route.ts:496-500 : `if (!activeShift) return NextResponse.json({ error: "Session de caisse non ouverte...", code: 'SHIFT_NOT_OPEN' }, { status: 403 })`.

**Impact.** En pratique, un organisateur ne découvre jamais la fonction PIN régisseur : les contrôleurs ne peuvent ouvrir de caisse, l'encaissement espèces à l'entrée est bloqué et les Z de caisse ne sont pas consultables. Le lien « retour » de la page équipe renvoie vers une page d'édition qui, pour un événement publié, ne peut pas enregistrer (cf. constat précédent).

**Recommandation.** Ajouter sur chaque carte d'événement VALIDE/PUBLIE un menu « Opérations » (Équipe contrôleurs, Caisse & PIN régisseur, Rapport Z, Scanner) et un lien « Caisse » dans la page Équipe globale par événement ; proposer la génération du PIN directement depuis le flux d'affectation d'un contrôleur « espèces autorisées ».

### partner-ux-7 — Rapport de clôture Z : remboursements déduits deux fois (net négatif possible) et ligne de frais Event Village toujours à 0

- **Sévérité :** ÉLEVÉE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §79 ; §82 Remboursements ; §84 Rapprochement
- **Emplacement :** lib/partner/partner-dashboard.service.ts — lignes 445-456, 477, 484-496 ; lib/events/event-cancellation.service.ts:503, 512, 520 ; components/partner/ClosingReportModal.tsx:322-343 ; partner-dashboard.service.ts:704-723 (PDF)
- **Catégorie :** integrite-financiere

**Description.** Le brut par catégorie ne compte que les billets VALIDE/UTILISE ; un billet remboursé passe en statut REMBOURSE et sort donc déjà du brut. Le net est ensuite recalculé en soustrayant `refundedGross` (somme des paiements REFUNDED, montants acheteur incluant les frais de service) : le remboursement est retiré une seconde fois, sur une base différente (TTC acheteur vs facial). Pour un événement annulé avec remboursements, totalGross = 0 et totalNet devient négatif. Par ailleurs `commissionAmount` est codé en dur à 0 (conforme §79 pour le partenaire) mais le rapport et le PDF affichent une ligne « Frais de service & billetterie Event Village : - 0 FCFA » systématique.

**Preuve.** service:447 `const soldTickets = catTickets.filter(t => t.status === 'VALIDE' || t.status === 'UTILISE')` ; 455 `const commissionAmount = 0;` ; 486-490 `const refundedPayments = eventPayments.filter(p => p.status === 'REFUNDED'); ... refundedGross = refundedPayments.reduce((s, p) => s + Number(p.amount)...)` ; 496 `const totalNet = totalGross - totalCommission - totalRefundedAmount;`. event-cancellation.service.ts:503 `status: 'REFUNDED'` (payments) et 512/520 `status: 'REMBOURSE'` (tickets). ClosingReportModal.tsx:323-326 affiche `- {totalCommission}` ; 338-342 « Montant Net à Reverser au Partenaire : {totalNet} ».

**Impact.** Le « Montant net à reverser au partenaire » du document « certifié » et du PDF officiel est sous-évalué du montant TTC des remboursements, voire négatif : contestation du reversement, perte financière pour l'organisateur ou litige comptable avec la plateforme.

**Recommandation.** Calculer le net à partir d'une seule source : soit les billets (brut facial des billets VALIDE/UTILISE, sans nouvelle déduction), soit les paiements (SUCCESS − REFUNDED, convertis en base faciale via partner_payout_amount). Afficher les remboursements à titre informatif (nombre, montant) sans les soustraire du brut déjà net. Supprimer ou renommer la ligne « frais » à 0 (« Frais à la charge de l'acheteur : X FCFA, non déduits »). Couvrir par un test : événement avec 2 billets remboursés → net = brut facial des billets restants.

### partner-ux-8 — « Billets vendus » et « Chiffre d'affaires » calculés de quatre façons différentes ; la liste des événements compte les holds non payés

- **Sévérité :** ÉLEVÉE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** moyenne
- **Référence CDC :** §29 Tableau de bord ; §158 ; §160 ; §36
- **Emplacement :** app/partner/events/page.tsx — lignes 163-172, 318-320 ; lib/events/event.service.ts:1093-1097, 1198 ; lib/partner/partner-dashboard.service.ts:239-243 ; app/api/partner/metrics/route.ts:66-72 ; app/api/partner/stats/route.ts:65-67, 98
- **Catégorie :** integrite-donnees

**Description.** La liste des événements agrège `ticket_categories.sold_quantity`, or reserveTicketsAtomic incrémente sold_quantity dès la réservation (hold), que le paiement soit confirmé ou non (seul held_quantity dépend de paymentConfirmed), et ne le décrémente qu'à l'expiration : les KPI « Billets vendus » et « Chiffre d'Affaires » incluent les paniers en attente. Le dashboard compte les tickets VALIDE/UTILISE, /api/partner/metrics compte tous les tickets ≠ ANNULE (donc aussi REMBOURSE), /api/partner/stats compte VALIDE/UTILISE. De plus, les 4 cartes KPI de la liste sont calculées sur le sous-ensemble filtré/recherché (`events` déjà filtré), donc « Total Événements » devient 1 dès qu'un filtre est actif.

**Preuve.** events/page.tsx:165-171 : `const totalTicketsSold = events.reduce((acc, ev) => acc + (ev.ticket_categories?.reduce((s, c) => s + (c.sold_quantity || 0), 0) || 0), 0); const totalRevenue = ... (c.sold_quantity || 0) * Number(c.price || 0)`. event.service.ts:1093-1097 : `const nextSold = currentSold + requestedQty; const nextHeld = params.paymentConfirmed ? Math.max(0, currentHeld - requestedQty) : currentHeld; const updatePayload = { sold_quantity: nextSold, ... }`. partner-dashboard.service.ts:239 `tickets.filter(t => t.status === 'VALIDE' || t.status === 'UTILISE')` ; metrics/route.ts:70 `.neq('status', 'ANNULE')` ; stats/route.ts:66 `["VALIDE", "UTILISE"].includes(t.status)`.

**Impact.** Un organisateur voit des chiffres de ventes et de CA différents entre « Événements », « Dashboard » et « Statistiques » pour la même période, et un CA gonflé par des paniers jamais payés : perte de confiance dans l'outil et décisions (réassort, communication) prises sur de mauvais chiffres.

**Recommandation.** Définir une source unique de vérité (vue SQL ou service `TicketingKpiService`) : vendus = tickets VALIDE/UTILISE payés, CA facial = somme price de ces tickets, holds exposés séparément (« en cours de paiement ») ; exposer `sold_quantity` et `held_quantity` distinctement dans GET /api/partner/events et calculer les cartes KPI sur l'ensemble des événements (requête dédiée) et non sur la liste filtrée.

### partner-ux-9 — Formulaire de création : aucune validation par étape, pas de sauvegarde de brouillon, perte totale de saisie au rechargement, attributs required inopérants

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §30 Création ; architecture §35 (validation), §38 (formulaires adaptés mobile)
- **Emplacement :** app/partner/events/new/page.tsx — lignes 98-135, 263-284, 287-294, 397-418, 434-441, 1106-1114
- **Catégorie :** ux-formulaire

**Description.** Le formulaire de 5 étapes (1131 lignes) ne valide qu'au clic final : « Suivant » n'exécute aucune vérification, les onglets n'indiquent aucune erreur, et à la soumission l'utilisateur est renvoyé brutalement à l'étape 1 ou 5. Tout l'état est en useState sans persistance (ni localStorage, ni enregistrement serveur en BROUILLON intermédiaire, ni garde `beforeunload`) : un rechargement, un retour arrière ou une perte réseau sur mobile efface 5 étapes de saisie, affiche comprise. Les inputs portent `required` mais ne sont dans aucun `<form>`, l'attribut est donc sans effet et la touche Entrée ne soumet rien. Les champs quantité/limite clampent à chaque frappe (`Math.max(1, …)`), empêchant d'effacer le champ pour ressaisir.

**Preuve.** new/page.tsx:1106-1114 : `<Button ... onClick={() => setCurrentStep(currentStep + 1)}>Suivant</Button>` (aucune validation). 263-279 : `if (Object.keys(newErrors).length > 0) { const firstErrorKey = ...; if (firstErrorKey.startsWith('title') || ...) setCurrentStep(1); else if (...) setCurrentStep(5); return false; }`. 98-135 : uniquement des `useState` ; aucun `useEffect` de persistance dans le fichier. 434-441 : `<input type="text" required ... />` hors de tout `<form>`. 1014 : `onChange={(e) => updateTicketCategory(cat.id, 'total_quantity', Math.max(1, Number(e.target.value)))}`.

**Impact.** Abandon et frustration des organisateurs (souvent sur mobile en 3G) ; saisies longues perdues ; erreurs découvertes trop tard ; données incohérentes sauvées à l'étape finale.

**Recommandation.** Valider chaque étape au « Suivant » (schéma Zod par étape) et marquer les onglets en erreur ; sauvegarder automatiquement en BROUILLON côté serveur dès l'étape 1 (POST puis PUT) ou au minimum dans localStorage avec restauration proposée ; envelopper dans `<form onSubmit>` ; remplacer le clamp à la frappe par une validation au blur ; migrer vers react-hook-form + zodResolver pour réduire la taille du composant.

### partner-ux-10 — Divergence création / édition : catégorie d'événement, carte, dates de vente, limite par commande, visibilité et validations temporelles absentes du formulaire d'édition

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §30, §33, §35
- **Emplacement :** app/partner/events/[id]/edit/page.tsx — lignes 30-37, 39-57, 73-82, 161-172, 202-206, 219-294, 317-346, 570-596
- **Catégorie :** duplication-logique

**Description.** Le formulaire d'édition est une copie divergente du formulaire de création : pas de sélecteur de catégorie (CONCERT/FESTIVAL…), pas de MapPicker (impossible de corriger la position après création), les catégories de billets perdent sale_start/sale_end/max_per_order/is_visible (interface et payload), aucune vérification « date passée » ni « fin < début » (schéma sans refine, aucun contrôle croisé), le prix accepte les négatifs à la saisie, le bouton supprimer un créneau de programme est toujours visible en édition mais masqué en création quand il n'y a qu'un item. Le champ `description` de ProgramItem existe dans les deux interfaces mais n'a d'input nulle part.

**Preuve.** edit/page.tsx:30-37 : `interface TicketCategory { id; name; price; total_quantity; description; sold_quantity? }` (vs new/page.tsx:43-53 avec sale_start, sale_end, max_per_order, is_visible). edit:46-57 : `start_date: z.string().min(1, ...)` sans refine (vs new:72-81). edit:219-294 : aucune comparaison endDate/startDate (vs new:216-222). edit:317-346 : payload sans category/latitude/longitude. edit:705 `onChange={(e) => updateTicketCategory(cat.id, 'price', Number(e.target.value))}` (vs new:999 `Math.max(0, …)`). new:634 `{programItems.length > 1 && (<button ... removeProgramItem>` ; new:35-41 `description: string` jamais rendu (645-682).

**Impact.** Une position GPS erronée ou une catégorie mal choisie ne peuvent plus être corrigées ; une édition peut rendre une date de fin antérieure au début ou une date passée ; maintenance doublée (deux schémas Zod, deux UI) avec dérive garantie.

**Recommandation.** Extraire un composant `EventForm` unique (mode create/edit) avec un schéma Zod partagé dans lib/events/event-form.schema.ts, inclure MapPicker, catégorie et champs complets de catégories en édition, et supprimer le champ mort `description` ou lui donner un input.

### partner-ux-11 — Dates de vente en jour exclusif, validation « date passée » sur l'horloge du navigateur, horaires de programme en texte libre

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §35 (date de début / date de fin de vente) ; §30 (date ; heure)
- **Emplacement :** app/partner/events/new/page.tsx — lignes 72-81, 254-257, 650-656, 1043-1059 ; lib/events/event.service.ts:1005-1010
- **Catégorie :** regles-metier-dates

**Description.** Les dates de vente sont des `input type="date"` (sans heure) ; côté serveur la fin de vente est comparée avec `new Date(category.sale_end) < new Date()`, où 'YYYY-MM-DD' est interprété à minuit UTC : la vente s'arrête au début du jour choisi, pas à sa fin. Rien ne vérifie que la fin de vente est ≤ à la date de l'événement ni que le début de vente est antérieur. La règle « date dans le futur » utilise `new Date()` local du navigateur (pas Africa/Dakar) et n'existe pas en édition. L'horaire des créneaux de programme est un champ texte libre (« Ex: 19:30 ») sans format ni tri chronologique.

**Preuve.** new/page.tsx:1054-1058 : `<input type="date" value={cat.sale_end} ... />` ; event.service.ts:1009 : `if (category.sale_end && new Date(category.sale_end) < new Date()) { throw ...` ; new/page.tsx:72-81 : `const today = new Date(); today.setHours(0,0,0,0); const selected = new Date(val + 'T00:00:00'); return selected >= today;` ; 650-656 : `<input type="text" placeholder="Ex: 19:30" value={item.time} ...>`.

**Impact.** Un organisateur qui saisit « fin de vente : jour J » perd toute la journée J de ventes (souvent la plus forte) ; incohérences possibles entre période de vente et date d'événement ; programme non triable/affichable proprement côté public.

**Recommandation.** Utiliser `datetime-local` ou interpréter sale_end comme fin de journée Africa/Dakar (23:59:59) côté serveur ; valider sale_start ≤ sale_end ≤ start_date côté client et serveur ; centraliser la logique de dates (date-fns-tz, zone Africa/Dakar) ; champ `type="time"` pour les créneaux et tri automatique.

### partner-ux-12 — Prix en FCFA acceptant les décimales et quantités/capacité non entières, sans contrôle serveur

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** moyenne
- **Référence CDC :** §35 ; §37 (montants en FCFA entiers)
- **Emplacement :** app/partner/events/new/page.tsx — lignes 55-58, 87-89, 995-1001 ; lib/events/event.service.ts:155-167
- **Catégorie :** validation-metier

**Description.** Le schéma Zod n'impose `.int()` ni sur le prix, ni sur la quantité, ni sur la capacité ; l'input prix n'a ni `step="1"` ni `inputMode="numeric"` et la validation HTML ne s'exécute jamais (pas de form). Le serveur convertit simplement `Number(cat.price)` sans vérification d'entier ni de plafond. Un prix « 1000.5 » ou une quantité « 10.7 » peuvent être enregistrés en base.

**Preuve.** new/page.tsx:57 `price: z.number().min(0, ...)` ; 58 `total_quantity: z.number().min(1, ...)` ; 88 `z.number().positive(...)` ; 995-1000 `<input type="number" min="0" value={cat.price} onChange={(e) => updateTicketCategory(cat.id, 'price', Math.max(0, Number(e.target.value)))}` (pas de step). event.service.ts:159-160 : `price: Number(cat.price), total_quantity: Number(cat.total_quantity),`.

**Impact.** Montants non entiers impossibles à encaisser en Mobile Money (SamirPay attend des FCFA entiers), arrondis divergents entre affichage, paiement et reversement, quotas fractionnaires cassant les jauges.

**Recommandation.** `.int()` + `.max()` sur prix, quantités, capacité et max_per_order dans les schémas client et serveur ; `step="1" inputMode="numeric"` ; validation serveur Zod systématique dans POST/PUT /api/partner/events (actuellement absente : route.ts:45-46 passe le body brut).

### partner-ux-13 — Modale Quotas & Stock : quota 0 acceptable, prix non modifiable après publication, sémantique actif/visible non expliquée, modale non accessible

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §35 ; §36 Vente
- **Emplacement :** components/events/AdjustTicketQuotaModal.tsx — lignes 83-95, 135-136, 260-266, 339-358 ; lib/events/event.service.ts:519-521 ; app/api/partner/events/[id]/categories/[categoryId]/route.ts:28
- **Catégorie :** ux-quotas

**Description.** Si l'utilisateur vide le champ, `Number('')` = 0 ; avec 0 vendu, `canSubmit` reste vrai et le serveur accepte tout quota ≥ 0 : la catégorie passe à 0 place sans avertissement et devient invendable. L'API PATCH accepte `price` et `description`, mais la modale ne propose pas de modifier le prix : combiné à l'échec de l'édition sur événement publié, il n'existe aucun moyen UI de changer un tarif après publication. Les cases « Activer la vente » et « Visible sur le site » ne sont pas expliquées (différence inactive-visible = « épuisé » affiché ?). La modale est un `div fixed` maison : pas de fermeture Escape, pas de verrouillage du scroll, pas de rôle dialog, contrairement au composant Modal partagé.

**Preuve.** AdjustTicketQuotaModal.tsx:264 `onChange={(e) => setNewTotal(Number(e.target.value))}` ; 94-95 `const isBelowSold = newTotal < sold; const canSubmit = !isBelowSold && !isExceedingCapacity && !isSubmitting;` ; event.service.ts:519-521 `if (newTotal < 0) throw new Error('Le quota de billets doit être supérieur ou égal à 0.')` ; categories route.ts:28 `price: body.price !== undefined ? Number(body.price) : undefined` ; modale 135 `<div className="fixed inset-0 z-50 ...">` vs components/ui/Modal.tsx:29-43 (Escape + overflow hidden).

**Impact.** Arrêt involontaire des ventes d'une formule ; impossibilité de corriger un prix (ex. early bird → plein tarif) sans intervention technique ; erreurs de manipulation sur mobile.

**Recommandation.** Imposer quota ≥ max(1, vendus) avec message explicite, ajouter l'édition du prix (avec avertissement si des billets sont vendus) et un libellé d'aide pour actif/visible ; reconstruire la modale sur `components/ui/Modal` (Escape, focus, aria-modal) et réutiliser le même composant pour EventCancelModal et la modale PIN.

### partner-ux-14 — Gestion d'équipe : statut « En attente » déduit du prénom, SMS renvoyable à tout contrôleur, permission espèces non modifiable par événement, regex téléphone approximative

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §11 Contrôleur ; §40 ; §152 Permissions
- **Emplacement :** app/partner/events/[id]/team/page.tsx — lignes 48, 64, 142, 150, 347, 442-506, 471-475, 480-493 ; app/partner/team/page.tsx:267, 383-387, 396-400, 583, 678-691
- **Catégorie :** ux-equipe

**Description.** L'état « invitation en attente » est déduit de `first_name === 'Contrôleur' && !last_name` (valeur par défaut injectée par le formulaire) : un contrôleur invité avec son prénom apparaît « Actif » avant même d'avoir activé son compte, et inversement. Le bouton « Renvoyer SMS » est proposé pour tous, y compris les comptes actifs (coût SMS, confusion). Sur la page par événement, `can_accept_cash` ne peut pas être modifié après invitation (il faut retirer puis réinviter, ce qui renvoie un SMS) ; sur la page globale, « Gérer » applique un seul flag espèces à tous les événements du contrôleur (`some(...)` puis PATCH unique), effaçant la granularité par événement. La regex `/^(7[0-8])\d{7}$/` accepte des préfixes inexistants (71, 73, 74) et rejette un numéro saisi en +221. `nameError` n'est jamais alimenté ; `router` importé et inutilisé.

**Preuve.** team/[id]/page.tsx:471 `{ctrl.first_name === 'Contrôleur' && !ctrl.last_name && (<span ...>En attente</span>)}` ; 163 `first_name: firstName.trim() || 'Contrôleur'` ; 480-493 bouton Renvoyer sans condition ; 442-506 aucun contrôle pour changer can_accept_cash ; team/page.tsx:386 `setEditCanCash(grouped.assignments.some(a => a.can_accept_cash))` et 396-400 `body: JSON.stringify({ controller_id, event_ids: editEventIds, can_accept_cash: editCanCash })` ; team/[id]:150 `if (!/^(7[0-8])\d{7}$/.test(cleanPhone))` ; 64 `const [nameError, setNameError] = useState('')` jamais set non vide (142, 332, 342).

**Impact.** Mauvaise lecture de l'état réel des accès le jour J (contrôleur « actif » sans compte), envois SMS inutiles payants, perte de la permission espèces fine par événement (risque de caisse non autorisée), refus de numéros valides au format international.

**Recommandation.** Exposer un vrai statut d'invitation (users.status / event_controllers.invitation_status) et l'afficher via StatusBadge ; limiter « Renvoyer SMS » aux invitations non activées ; ajouter un toggle espèces par affectation (PATCH unitaire) ; normaliser le téléphone (+221, espaces) avec une liste de préfixes valides (70, 75, 76, 77, 78) partagée client/serveur ; nettoyer le code mort.

### partner-ux-15 — Caisse / Z : écart global « 100 % exact » avec sessions ouvertes, horodatages sans date, litiges sans action, régénération du PIN sans confirmation ni garde-fou

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §40 ; §84 Rapprochement financier ; §156 Traçabilité
- **Emplacement :** app/partner/events/[id]/caisse/page.tsx — lignes 9, 18, 65-85, 114-120, 181-192, 236-253, 296, 315-319, 322-323 ; lib/shifts/shift.service.ts:94-109 ; components/shifts/ShiftModals.tsx:485-487
- **Catégorie :** ux-caisse

**Description.** `totalDiscrepancy` traite `discrepancy_amount` null (session OUVERT) comme 0 : la carte affiche « Comptabilité 100% exacte » tant qu'aucune session n'est clôturée. Les horodatages n'affichent que l'heure (événements multi-jours illisibles). Le statut LITIGE est affiché mais aucune action de résolution/validation n'existe pour le partenaire. « Générer un code PIN » écrase immédiatement le hash précédent sans confirmation ni vérification de sessions ouvertes (dont la clôture exige le PIN). Le Z de caisse n'est disponible qu'en `window.print()` côté partenaire (pas de PDF/archivage comme pour le rapport de clôture). `(s as any).users`, imports `Clock`, `ChevronRight`, `router` inutilisés.

**Preuve.** caisse/page.tsx:117 `const totalDiscrepancy = shifts.reduce((acc, s) => acc + (Number(s.discrepancy_amount) || 0), 0);` ; 252-253 `{totalDiscrepancy === 0 ? 'Comptabilité 100% exacte' : 'Divergences constatées'}` ; 322 `new Date(s.opened_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })` ; 181-192 bouton Générer → handleGeneratePin direct ; shift.service.ts:104-109 `.update({ regisseur_pin_hash: hash, regisseur_pin_updated_at: now })` sans contrôle de shifts OUVERT ; ShiftModals.tsx:485-487 `const handlePrint = () => { window.print(); }` ; caisse:296 `const userObj = (s as any).users;`.

**Impact.** Faux sentiment de conformité comptable pendant l'événement ; impossibilité d'arbitrer un litige de caisse depuis l'espace ; un clic malencontreux invalide le PIN en pleine exploitation et bloque la clôture des caisses ouvertes ; pas d'archive Z exploitable par le comptable.

**Recommandation.** Calculer l'écart uniquement sur les sessions clôturées et afficher « N sessions ouvertes » ; dater les horodatages (JJ/MM HH:mm, fuseau Africa/Dakar) ; ajouter les actions « Valider / Contester » sur LITIGE avec journal ; ConfirmDialog avant régénération du PIN avec avertissement si sessions OUVERT ; export PDF du Z (réutiliser le générateur vectoriel existant) ; typer `Shift.users`.

### partner-ux-16 — Dashboard : capacité par défaut à 1 (« 25 / 1 », 100 %), activité « récente » non triée avant découpage, statuts bruts

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §29 ; §160 (taux de présence, remplissage)
- **Emplacement :** lib/partner/partner-dashboard.service.ts — lignes 231, 281-282, 299-304, 315, 329, 368 ; app/partner/dashboard/page.tsx:76, 389, 401-405
- **Catégorie :** integrite-affichage

**Description.** Pour un événement sans capacité renseignée (champ optionnel du formulaire), le service force `capacity = 1` : le tableau affiche « 25 / 1 » et un taux de remplissage de 100 % ; `ticketsAvailable` tombe à 0. La requête tickets n'a pas d'ORDER BY, mais les 8 « ventes récentes » et 5 « scans récents » sont découpés par `slice` avant le tri global : les éléments affichés comme récents sont arbitraires. Le statut est affiché brut (`ev.status` → « EN_ATTENTE ») au lieu du StatusBadge utilisé ailleurs. `catch (err: any)`.

**Preuve.** service:281 `const evCapacity = Number(ev.capacity) || 1;` ; 303 `fillRatePercent: Math.min(100, Math.round((evSold / evCapacity) * 100))` ; page:401 `{ev.ticketsSold} / {ev.capacity}` ; service:231 `.select('id, event_id, ...').in('event_id', eventIds)` (sans order) puis 315 `validTickets.slice(0, 8)`, 329 `.slice(0, 5)`, tri seulement en 368 ; page:389 `<span className="text-[10px] font-normal text-slate-400">{ev.status}</span>`.

**Impact.** Chiffres absurdes sur le tableau de bord principal (crédibilité), taux de remplissage faux (§160), journal d'opérations ne reflétant pas les dernières ventes/scans.

**Recommandation.** Utiliser la somme des quotas de catégories comme capacité de repli et afficher « — » si inconnue ; ajouter `.order('created_at', { ascending: false })` / trier avant `slice` ; utiliser StatusBadge ; typer les erreurs.

### partner-ux-17 — Scan partenaire : résultat « QR expiré » non géré (écran vide), aucun contexte d'événement ni encaissement, pipeline dupliqué avec le scanner contrôleur

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §39-§40 ; §154 QR dynamique
- **Emplacement :** app/partner/scan/page.tsx — lignes 34-44, 60-64, 75-83, 190-245, 254-258 ; app/api/tickets/verify/route.ts:101-112 ; app/controller/scanner/page.tsx:53-59, 412-413, 483-484, 618-625
- **Catégorie :** ux-scan-duplication

**Description.** L'API renvoie `status: 'qr_expired'` (HTTP 400) quand le QR dynamique TOTP est périmé, mais l'union de types de la page partenaire ne connaît que idle/valid/already_used/invalid : le conteneur de résultat s'affiche (status ≠ idle) sans aucune des trois branches, donc l'écran reste vide et l'historique classe le scan en « invalide ». Aucun sélecteur d'événement, pas de jauge avant le premier scan, pas de gestion du paiement espèces à l'entrée ni des statuts d'événement, alors que le scanner contrôleur (1185 lignes) gère qr_expired, cash_required, event_ended, etc. via un autre endpoint et un autre vocabulaire (`scan_result` vs `status`).

**Preuve.** scan/page.tsx:35 `status: 'idle' | 'valid' | 'already_used' | 'invalid';` ; 60-64 `setScanResult({ status: data.status || 'invalid', ...})` ; 190 `{scanResult.status !== 'idle' && (` puis 192/212/232 ne testent que valid/already_used/invalid. verify/route.ts:102-105 `return NextResponse.json({ code: 'QR_EXPIRED', status: 'qr_expired', message: 'QR Code expiré...' }, { status: 400 })`. controller/scanner/page.tsx:59 `| 'qr_expired'`, 618 `case 'qr_expired':`.

**Impact.** À l'entrée, le partenaire scanne un billet légitime dont le QR vient de tourner et ne voit rien : il conclut à un bug ou refuse le client ; expérience incohérente entre le téléphone du partenaire et celui de ses contrôleurs.

**Recommandation.** Faire de /partner/scan une simple surcouche du scanner contrôleur (même endpoint /api/controller/scan, même composant de résultat et même machine à états incluant qr_expired/cash_required/event_*), avec sélection d'événement et rappel « demandez au client de rafraîchir ».

### partner-ux-18 — Erreurs réseau avalées et états vides trompeurs (liste événements, équipe, calendrier, carte, upload)

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** N/A (qualité) ; architecture §38 (chargement rapide, faible réseau)
- **Emplacement :** app/partner/events/page.tsx — lignes 62-79, 295-314 ; app/partner/events/[id]/team/page.tsx:73-84 ; app/partner/team/page.tsx:102-120 ; app/partner/calendar/page.tsx:15-33 ; components/ui/MapPicker.tsx:82-97 ; components/ui/ImageUpload.tsx:113-119
- **Catégorie :** robustesse-front

**Description.** Sur la liste des événements, une erreur réseau ou `success: false` est seulement loguée en console et la page affiche l'état vide « Vous n'avez pas encore créé d'événement. Lancez votre première billetterie ! » : l'organisateur peut croire ses événements supprimés. Même schéma sur la page équipe par événement (`success:false` ignoré), la page équipe globale (`catch { // Silencieux }`) et le calendrier (`any`, succès non vérifié). MapPicker ignore les erreurs de géolocalisation (callback vide) ; ImageUpload n'a pas d'indicateur de progression ni d'aperçu avant upload.

**Preuve.** events/page.tsx:69-75 : `const data = await res.json(); if (data.success) { setEvents(data.events || []); } } catch (err) { console.error('Erreur chargement événements:', err); }` ; 303-305 : texte d'état vide sans distinction erreur ; team/[id]:78 `if (data.success) setControllers(data.controllers ?? []);` (pas de else) ; team/page.tsx:117-119 `} catch { // Silencieux }` ; MapPicker.tsx:94 `() => {},` ; ImageUpload.tsx:113-119 spinner seul.

**Impact.** Diagnostic impossible pour l'utilisateur en zone de faible couverture (cas nominal au Sénégal) ; appels support ; décisions prises sur des listes incomplètes.

**Recommandation.** Introduire un état `error` distinct avec composant « Impossible de charger — Réessayer », vérifier `res.ok && data.success` partout, utiliser un hook de fetch commun (SWR/React Query) avec retry et toasts, afficher un message en cas de refus de géolocalisation, et une barre de progression (XHR/fetch streaming) pour l'upload.

### partner-ux-19 — Mobile et accessibilité : inputs 12 px (zoom iOS), stepper tronqué, cartes cliquables non focusables, labels non liés, bouton de suppression d'image invisible au toucher, modales maison sans a11y

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** architecture §37 (lisibilité, accessibilité) et §38 (mobile prioritaire, boutons suffisamment grands) ; AGENTS.md
- **Emplacement :** app/partner/events/new/page.tsx — lignes 397-418, 431-441, 793-799, 826-832, 859-865 ; components/ui/ImageUpload.tsx:93-99, 102-112 ; app/partner/events/[id]/caisse/page.tsx:280-292, 283, 308, 372 ; components/events/AdjustTicketQuotaModal.tsx:135 ; components/events/EventCancelModal.tsx:87
- **Catégorie :** mobile-accessibilite

**Description.** Tous les champs du formulaire sont en `text-xs` (12 px) : iOS zoome automatiquement sur chaque focus (<16 px). Le stepper impose 5 colonnes avec des libellés « Infos Pratiques (§33) » tronqués (`truncate`) sur 360 px. Les cartes « Services » sont des `div onClick` sans rôle, tabIndex ni aria-pressed ; les `label` n'ont pas de `htmlFor`. Le bouton de suppression de l'affiche n'apparaît qu'au survol (`opacity-0 group-hover:opacity-100`) : inaccessible sur écran tactile, où l'organisateur gère souvent son événement. La zone de dépôt est un div cliquable non focusable. Le tableau de caisse a 8 colonnes avec des textes 9-10 px et défilement horizontal. Trois modales (quotas, annulation, PIN) sont des div fixes sans Escape, sans focus trap ni aria-modal.

**Preuve.** new/page.tsx:440 `className="w-full px-4 py-2.5 rounded-xl ... text-xs ..."` (idem 481, 495, 510, …) ; 397 `<div className="grid grid-cols-5 gap-2 ...">` et 415 `<span className="truncate block">{step.label}</span>` ; 793-794 `<div onClick={() => setServices(s => ({ ...s, ticketing: !s.ticketing }))} className="... cursor-pointer ...">` ; ImageUpload.tsx:96 `className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-600 text-white opacity-0 group-hover:opacity-100 ..."` ; caisse:283 `text-[10px]`, 308 `text-[9px]` ; AdjustTicketQuotaModal.tsx:135 `<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 ...">`.

**Impact.** Expérience dégradée sur smartphone (zoom intempestif, libellés illisibles, impossibilité de changer l'affiche), non-conformité d'accessibilité clavier/lecteur d'écran, contraire à la priorité mobile affichée dans l'architecture.

**Recommandation.** Base `text-sm`/16 px sur les inputs, stepper horizontal scrollable avec libellés courts, `<button type="button" aria-pressed>` pour les services, `id/htmlFor` sur tous les champs, bouton de suppression toujours visible (ou visible au focus/touch), `role="button" tabIndex=0` + onKeyDown sur la dropzone, vue carte mobile pour le tableau de caisse, et migration des trois modales vers `components/ui/Modal`.

### partner-ux-20 — Système de design non appliqué : 215 couleurs codées en dur malgré les tokens Tailwind, cartes KPI répétitives, statuts bruts et références CDC visibles par l'utilisateur

- **Sévérité :** FAIBLE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** AGENTS.md (zéro look générique, cards répétitives) ; architecture §37
- **Emplacement :** tailwind.config.ts — lignes 17-30 ; app/partner/events/page.tsx:184, 208-248, 261, 265, 416 ; app/partner/events/new/page.tsx:392, 399-403, 426, 609, 693, 784, 901, 1124 ; app/partner/scan/page.tsx:105 ; components/partner/ClosingReportModal.tsx:133 ; app/partner/stats/page.tsx:190, 332
- **Catégorie :** design-system

**Description.** Le thème Tailwind définit une palette `brand` (500 = #FF5722, coral…), mais l'espace partenaire contient 215 occurrences de `#FF5722` en dur réparties sur 22 fichiers (dont 21 dans team/page.tsx, 20 dans events/new). La liste des événements aligne 4 cartes KPI strictement identiques (icône carrée colorée + libellé + nombre), motif générique explicitement proscrit par AGENTS.md ; le même dégradé `from-[#FF6A3D] to-[#FF3D68]` est recopié pour les onglets actifs sur plusieurs pages. Les libellés exposent des références internes au cahier des charges (« Soumettre (§31) », « Enregistrer en Brouillon (§31) », « Général (§30) », « (§39-§40) », « Conforme CDC V3.0 ») et des valeurs d'enum brutes (« EN_ATTENTE », « PUBLIE » dans les filtres et statuts).

**Preuve.** tailwind.config.ts:18-29 `brand: { ... 500: '#FF5722', ... DEFAULT: '#FF5722', coral: '#FF6A3D' }` ; grep `#FF5722` dans app/partner : 215 occurrences / 22 fichiers ; events/page.tsx:209-247 quatre blocs `<div className="p-5 rounded-2xl bg-white ... flex items-center gap-4">` identiques ; 261 et stats/page.tsx:190 `bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68]` ; events:416 `Soumettre (§31)` ; new:1124 `'Enregistrer en Brouillon (§31)'` ; events:265 `{tab === 'TOUS' ? 'Tous les événements' : tab}`.

**Impact.** Dette de maintenance (changement de charte = 215 remplacements), rendu « template IA » dénoncé par le standard visuel du projet, jargon incompréhensible pour un organisateur (que signifie §31 ?).

**Recommandation.** Remplacer `[#FF5722]` par `brand-500`/`text-brand` et créer des composants `KpiCard`, `SegmentedTabs`, `StatusBadge` réutilisés ; mapper les statuts vers des libellés humains (Brouillon, En examen, Validé, En ligne, Suspendu, Terminé, Annulé) ; supprimer toute référence § du texte visible (la conserver en commentaire de code).

### partner-ux-21 — Finition textuelle : accents absents sur la page d'édition, l'upload d'image et la confirmation de suppression

- **Sévérité :** FAIBLE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** N/A (qualité)
- **Emplacement :** app/partner/events/[id]/edit/page.tsx — lignes 374, 390, 395, 408, 411, 419, 450-454, 482, 498, 506, 530, 543, 546, 559, 561, 566, 573, 585, 606, 616, 628, 633, 646, 650-652, 672, 674, 679, 698, 710, 730 ; components/ui/ImageUpload.tsx:30, 34, 53, 56, 90, 127 ; app/partner/events/page.tsx:494
- **Catégorie :** finition

**Description.** Toute la page d'édition est écrite sans accents (« Modifier l'Evenement », « Etape », « Precedent », « Reglement interieur », « Acces », « Categories de Billets », « La capacite doit etre positive. »), de même que les messages de l'upload (« Format non supporte », « Echec de l'upload », « Apercu », « glissez-deposez ») et le message de confirmation de suppression (« irreversible », « categories », « definitivement supprimes »), alors que la page de création et le reste de l'espace sont correctement accentués.

**Preuve.** edit/page.tsx:419 `Modifier l&apos;Evenement` ; 411 `Etape {currentStep} sur 5` ; 633 `Reglement interieur` ; 55 `'La capacite doit etre positive.'` ; ImageUpload.tsx:30 `'Format non supporte (JPEG, PNG, WebP uniquement).'` ; 127 `Cliquez ou glissez-deposez` ; events/page.tsx:494 `message="Cette action est irreversible. Le brouillon et ses categories de billets seront definitivement supprimes."`.

**Impact.** Perception d'un produit inachevé sur des écrans quotidiens de l'organisateur ; incohérence typographique entre création et édition.

**Recommandation.** Corriger les chaînes (ou les centraliser dans lib/messages) et ajouter une règle de relecture/lint (ex. script détectant « evenement », « categorie » sans accent) dans la CI.

### partner-ux-22 — Qualité du code front : composants de 760 à 1 339 lignes, imports/états morts, `any` récurrents, validation métier dupliquée en 4 endroits, dépendances CDN à l'exécution

- **Sévérité :** FAIBLE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** N/A (qualité) ; architecture §33 (services), §35 (validation Zod serveur)
- **Emplacement :** app/partner/team/page.tsx — lignes 1-1339 ; app/partner/events/new/page.tsx:3, 224-230, 304-313, 366 ; app/partner/events/[id]/edit/page.tsx:253-260, 305-315 ; app/api/partner/events/[id]/route.ts:51-60 ; lib/events/event.service.ts:107-113 ; app/partner/events/[id]/caisse/page.tsx:9, 18, 296 ; app/partner/events/[id]/team/page.tsx:48, 126 ; components/ui/MapPicker.tsx:17-18, 27, 32-34, 60, 115-119 ; app/partner/calendar/page.tsx:21 ; app/partner/dashboard/page.tsx:76 ; components/events/EventCancelModal.tsx:79 ; components/partner/ClosingReportModal.tsx:67
- **Catégorie :** qualite-code

**Description.** Trois composants-pages dépassent 750 lignes (team 1 339, new 1 131, edit 761) en mêlant état, validation, appels réseau et rendu. La règle « somme des quotas ≤ capacité » est écrite quatre fois (deux fois dans new, deux fois dans edit, une fois dans la route PUT, une fois dans le service). Imports inutilisés (`lazy`, `Suspense`, `Clock`, `ChevronRight`, `router` ×2), variable `err` non utilisée, `any` dans 8 fichiers (payload realtime, `(s as any).users`, `mapInstanceRef: any`, `e: any`, `err: any`). MapPicker charge Leaflet via `require()` dans un effet et dépend de CSS/icônes unpkg à l'exécution (ligne `<link>` injectée dans le corps du composant) : rupture visuelle si le CDN est bloqué, et incompatible avec une CSP stricte. La route POST /api/partner/events ne valide pas le body avec Zod contrairement à la règle d'architecture.

**Preuve.** new/page.tsx:3 `import React, { useState, lazy, Suspense } from 'react';` (lazy/Suspense inutilisés) ; 366 `} catch (err: unknown) { toast.error(...)` ; caisse:9 `Clock, RefreshCw, Loader2, Users, FileText, ChevronRight` et 18 `const router = useRouter();` non utilisés ; team/[id]:126 `(payload: any) => {` ; MapPicker.tsx:27 `const L = require('leaflet') as typeof import('leaflet');`, 115-119 `<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />` ; events/route.ts:45-46 `const body = await request.json(); const event = await EventService.createEvent(user.id, body);` (pas de schéma).

**Impact.** Dérive fonctionnelle entre copies (déjà constatée entre création et édition), coût de maintenance élevé, régressions silencieuses, dépendance réseau tierce en production.

**Recommandation.** Découper en hooks/composants (`useEventForm`, `TicketCategoriesEditor`, `ProgramEditor`, `ControllerRow`), centraliser les règles (`lib/events/event-rules.ts` : quotas/capacité, dates) importées côté client et serveur, activer `@typescript-eslint/no-explicit-any` et `no-unused-vars` en erreur, importer `leaflet/dist/leaflet.css` et les icônes depuis le bundle, et ajouter les schémas Zod `CreateEventSchema`/`UpdateEventSchema` aux routes.

## G. Parcours Contrôleur (UX, PWA, terrain)

**Synthèse de l'auditeur :** Points forts : chaque scan est validé côté serveur (TOTP RFC 6238, verrou atomique `atomic_ticket_checkin`, aucune validation locale), ce qui respecte l'architecture §31 et §5 ; l'architecture de feedback multi-sensoriel (overlay plein écran, vibration, Web Audio synthétisé, fail-safe SSR/permissions) et la cascade caméra native → ZXing → saisie manuelle avec messages de permission explicites sont bien pensées pour le terrain ; le service worker exclut `/api/` (aucune réponse de scan périmée) et le dark mode est appliqué de façon cohérente. En revanche, le parcours contrôleur souffre de défauts bloquants en conditions réelles : toute erreur serveur/session est présentée au spectateur comme « BILLET INVALIDE » avec voix Wolof accusatrice, la caméra est intégralement redémarrée à chaque scan (et à chaque scan d'un autre contrôleur via Realtime) avec fuites de boucles de décodage, les MP3 Wolof livrés sont des fichiers vides de 72 octets, 3 des 4 abonnements Realtime ciblent des tables absentes de la publication Supabase, les compteurs de statistiques sont faux dès le premier scan, et le flux d'encaissement espèces masque les refus du serveur derrière un message « billet invalide » éphémère.

**Limites de couverture :** Audit en lecture seule, sans exécution de l'application ni des tests, sans appareil réel : les comportements iOS Safari (autoplay, latence de redémarrage getUserMedia, verrouillage d'écran), la lisibilité en plein soleil et les ratios de contraste sont inférés des classes Tailwind et du code, pas mesurés. L'état réel de la publication `supabase_realtime` et des REPLICA IDENTITY sur l'instance de production n'est vérifiable qu'à partir des migrations du dépôt (une modification manuelle via le dashboard Supabase ne peut être exclue). Non couverts (hors dimension) : sécurité/RBAC détaillée de `app/api/controller/scan/route.ts` (chemin PARTENAIRE/ADMIN, exposition RLS `tickets_read ... OR is_controller()` qui permet à tout contrôleur de lire tous les billets de la plateforme), robustesse du `RateLimiter`, `lib/auth/session.ts`, `AuthProvider`, `/api/notifications`, internals de `ConfirmDialog`/`Button` au-delà des tailles, CSS d'impression du ticket Z (`window.print()` sans règle `@media print` globale : non vérifié à l'exécution). La latence du chemin de scan (middleware.ts:181-195 ajoute 2 requêtes DB `user_roles` + `users` à chaque appel `/api/controller/*`, puis rate limiter, 2 lookups billet, assignation, commande, RPC, audit, COUNT) est constatée mais non chiffrée. Les tests existants (`tests/scanner-combat-ui.test.ts`, `scanner-wolof-audio.test.ts`, `controller-complete-workflow.test.ts`) mockent `Audio`/`navigator` et ne couvrent ni la page `app/controller/scanner/page.tsx` ni `CameraQrScanner` en rendu React, ce qui explique que les défauts de cycle de vie (effets, dépendances) et les MP3 vides n'aient pas été détectés.

### controller-ux-1 — Erreurs serveur/session (401, 403, 429, 500) présentées au spectateur comme « BILLET INVALIDE » avec voix Wolof et comptage en « refusés »

- **Sévérité :** ÉLEVÉE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §40 CONTRÔLE, §11 CONTRÔLEUR ; architecture §31
- **Emplacement :** app/controller/scanner/page.tsx — lignes 480-488, 418-421, 452-457, 969-977
- **Catégorie :** fonctionnel / contrat API

**Description.** handleScan ne lit jamais res.ok ni res.status. Toute réponse sans scan_result (401 « Authentification requise. », 403 « Compte inactif ou suspendu. », 500 « Erreur lors du compostage. »/« Erreur interne du serveur. », 403 JSON du middleware) devient finalResult = 'invalid' ; le 429 renvoie scan_result 'rate_limited', absent du type ScanResult, qui tombe dans la branche else de orchestrateScanFeedback → combatType 'reject' + Wolof 'INVALID', sans titre dans la carte (aucun cas 'rate_limited' aux lignes 969-977).

**Preuve.** page.tsx:483 `let finalResult: ScanResult = data.scan_result || 'invalid';` ; :488 `const message = data.message || data.error || 'Erreur inconnue.';` ; :418-421 `} else { combatType = 'reject'; wolofType = 'INVALID'; }` ; :452 `if (!isNetworkError && scanResult && scanResult !== 'valid' && scanResult !== 'cash_required' && eventId) {` ; serveur : app/api/controller/scan/route.ts:32, :38, :51-56 (`scan_result: 'rate_limited'`, 429), :298, :410 ; middleware.ts:198-202.

**Impact.** À l'entrée, une session expirée (cookie Supabase) ou un incident serveur fait refuser des spectateurs payants : flash rouge « ACCÈS REFUSÉ », vibration de rejet, voix « Billet bi baaxul » (le billet est mauvais) et incrément du KPI « Billets refusés ». Le contrôleur n'a aucun signal qu'il s'agit d'un problème technique de son côté.

**Recommandation.** Brancher sur res.status et sur une liste blanche de scan_result : 401 → redirection /login?redirect=/controller/scanner avec message ; 403 compte → écran bloquant « compte suspendu » ; 429 → feedback neutre gris/ambre « Cadence trop élevée, patientez » sans voix ni compteur ; 5xx → même traitement que network_error (« Service indisponible, réessayez »). Typer ScanResult comme union exhaustive partagée avec l'API et traiter le default comme erreur technique neutre, jamais comme rejet du billet.

### controller-ux-2 — La caméra est intégralement arrêtée et redémarrée à chaque scan et à chaque mise à jour Realtime (chaîne useCallback → useEffect instable)

- **Sévérité :** ÉLEVÉE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** architecture §36 PERFORMANCE, §38 MOBILE
- **Emplacement :** components/scan/CameraQrScanner.tsx — lignes 145-180, 183-236, 239-335
- **Catégorie :** robustesse terrain / performance

**Description.** handleScan (page.tsx:467-517) dépend de [isVerifying, selected, orchestrateScanFeedback] : son identité change à chaque passage isVerifying true→false et à chaque remplacement de `selected` (nouvel objet créé à chaque UPDATE Realtime de ticket, page.tsx:342-352, et à chaque réponse de scan, :492). Dans CameraQrScanner, onScan → handleCodeDetected → startNativeDetectionLoop/startZXingDetection → startCameraStream → useEffect([startCameraStream, stopCameraStream]) qui exécute stopCameraStream() (arrêt des pistes, torche coupée) puis getUserMedia à nouveau avec overlay « Initialisation de la caméra... ».

**Preuve.** page.tsx:517 `}, [isVerifying, selected, orchestrateScanFeedback]);` ; :1061 `onScan={handleScan}` ; CameraQrScanner.tsx:179 `[onScan, autoResumeDelayMs, resetInactivityTimer]` ; :212 `[handleCodeDetected]` ; :319-327 deps de startCameraStream incluant startNativeDetectionLoop/startZXingDetection ; :330-335 `useEffect(() => { startCameraStream(); return () => { stopCameraStream(); }; }, [startCameraStream, stopCameraStream]);` ; :240 `setIsInitializing(true)` ; :133-137 torche forcée OFF dans stopCameraStream.

**Impact.** Au minimum deux cycles complets getUserMedia par scan, plus un cycle à chaque billet composté par n'importe quel autre contrôleur du même événement : écran noir/flicker « Initialisation… » entre chaque spectateur, torche éteinte à chaque scan de nuit, latence ajoutée (0,5–1,5 s sur iOS), surconsommation batterie, file ralentie aux heures de pointe.

**Recommandation.** Stabiliser onScan via une ref dans CameraQrScanner (`const onScanRef = useRef(onScan); onScanRef.current = onScan;` et appeler onScanRef.current dans handleCodeDetected) ; retirer isVerifying/selected des deps de handleScan en les lisant via des refs ; ne redémarrer le flux que sur changement de deviceId/facingMode. Ajouter un test React Testing Library vérifiant que getUserMedia n'est appelé qu'une fois pour N scans.

### controller-ux-3 — Boucles de décodage zombies : ZXing jamais arrêté (`reset()` inexistant en @zxing/browser 0.2.1, IScannerControls ignoré) et boucle native pouvant se replanifier après cancelAnimationFrame

- **Sévérité :** ÉLEVÉE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** moyenne
- **Référence CDC :** architecture §36 PERFORMANCE ; N/A (qualité)
- **Emplacement :** components/scan/CameraQrScanner.tsx — lignes 109-118, 183-213, 216-236
- **Catégorie :** memory leak / performance

**Description.** startZXingDetection appelle decodeFromVideoElement sans stocker la Promise<IScannerControls> retournée ; l'arrêt repose sur `typeof zxingReaderRef.current.reset === 'function'`, or aucune méthode reset n'existe dans @zxing/browser 0.2.1 (grep « reset( » sur node_modules/@zxing/browser/esm : aucun résultat ; BrowserCodeReader.d.ts:215 `decodeFromVideoElement(...): Promise<IScannerControls>`). La boucle native checkFrame est async : une itération en attente de `barcodeDetector.detect()` au moment du cancelAnimationFrame se replanifie elle-même à la ligne 207 sans drapeau d'annulation et écrase animationFrameRef.current.

**Preuve.** CameraQrScanner.tsx:224 `codeReader.decodeFromVideoElement(videoElement, (result, err) => {` (valeur de retour ignorée) ; :111 `if (typeof zxingReaderRef.current.reset === 'function') {` ; :198 `const barcodes = await barcodeDetector.detect(video);` puis :207 `animationFrameRef.current = requestAnimationFrame(checkFrame);` ; package.json:17 `"@zxing/browser": "^0.2.1"`.

**Impact.** Combiné au redémarrage caméra à chaque scan, chaque scan laisse tourner des boucles de décodage supplémentaires sur le même <video> : montée CPU/chauffe/batterie au fil de la soirée, détections dupliquées. Sur iOS Safari (chemin ZXing systématique car BarcodeDetector absent), la fuite est garantie et ZXing continue de décoder un flux détaché.

**Recommandation.** `const controls = await codeReader.decodeFromVideoElement(...)`, stocker dans une ref et appeler `controls.stop()` dans stopCameraStream ; dans la boucle native, utiliser un compteur de génération ou un drapeau `cancelled` vérifié après chaque await avant de replanifier. Tester sur iPhone (Safari) avec 50 scans successifs et surveiller le CPU.

### controller-ux-4 — Voix Wolof non fonctionnelle : les six MP3 livrés font 72 octets (une entête de trame MPEG suivie de zéros = silence)

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** N/A (qualité) — AGENTS.md « full-output-enforcement : sans placeholders » ; §40
- **Emplacement :** public/sounds/wolof/already-used.mp3 — lignes fichier binaire (72 octets) ; UI : app/controller/scanner/page.tsx:763-778, 999-1011 ; components/scan/CombatFlashOverlay.tsx:258-270
- **Catégorie :** fonctionnel / placeholder livré

**Description.** Les fichiers public/sounds/wolof/{already-used,invalid,wrong-event}.mp3 et public/sounds/fr/*.mp3 pèsent chacun 72 octets et commencent par `FF FB 14 C4 00 00 00 …` (une seule trame MP3 vide). Le lecteur wolof-audio.ts résout `played: true` dès que play() se résout (lignes 224-231), donc l'UI affiche « Voix Wolof : ON », propose « 🔊 Répéter en Wolof pour le spectateur » et le test unitaire (Audio mocké) passe, alors qu'aucun son n'est jamais émis.

**Preuve.** PowerShell : `Length 72` pour les 6 fichiers ; dump hex `FF FB 14 C4 00 00 00 00 …` ; page.tsx:777 `{isMuted ? 'OFF' : 'ON'}` ; page.tsx:1008 `<span>🔊 Répéter en Wolof pour le spectateur</span>` ; wolof-audio.ts:26-42 (3 messages déclarés avec filename), :224-231 (`played: true` sur résolution de play()).

**Impact.** Au moment le plus conflictuel (billet refusé, spectateur non francophone), le contrôleur appuie sur « Répéter en Wolof » devant la foule et rien ne se passe ; la fonctionnalité mise en avant (commit cc72a6e « scanner combat & wolof audio ») est un stub sans aucun signalement à l'utilisateur.

**Recommandation.** Produire de vrais enregistrements (voix native Wolof validée, 2–3 s, ~24–48 kbps mono) pour les 3 messages ; ajouter un contrôle au build (taille > 5 Ko et durée > 0,5 s via ffprobe) ; exposer un état « voix indisponible » lorsque l'élément audio a `duration < 0.3` ou renvoie FILE_NOT_FOUND et masquer les boutons dans ce cas ; conserver la transcription textuelle affichée comme repli.

### controller-ux-5 — Encaissement espèces : refus du serveur (caisse fermée, 409 déjà traité, incohérence financière, non autorisé) affichés comme « BILLET INVALIDE » éphémère ; confirmation perdue après ouverture de caisse et effacée par le scan suivant

- **Sévérité :** ÉLEVÉE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §11 (enregistrer un paiement hors plateforme), Partie VI §38 PAIEMENT ; architecture §12
- **Emplacement :** app/controller/scanner/page.tsx — lignes 520-599, 460-463, 470
- **Catégorie :** fonctionnel / flux financier

**Description.** handleConfirmCash mappe toute erreur du PUT en 'invalid' (`data.scan_result || (data.error ? 'invalid' : 'valid')`) : SHIFT_NOT_OPEN 403, « Billet déjà traité par un autre contrôleur » 409, « Incohérence financière » 400, « Non autorisé à encaisser » 403, « Commande associée introuvable » 404 déclenchent flash rouge, Wolof « Billet bi baaxul », compteur refusés++, puis la carte disparaît après 3,5 s. Avant l'appel, si la caisse est fermée, le code remplace la carte cash_required par un feedback 'invalid' (523-533) : une fois la caisse ouverte, le bouton « Confirmer X FCFA » a disparu et il faut rescanner. Enfin la caméra reprend 2,5 s après détection (CameraQrScanner.tsx:174-177) et handleScan fait setFeedback(null) : un autre QR dans le champ efface silencieusement la confirmation en attente.

**Preuve.** page.tsx:548 `const resultStatus: ScanResult = data.scan_result || (data.error ? 'invalid' : 'valid');` ; :526-531 `orchestrateScanFeedback({ scanResult: 'invalid', message: "Session de caisse fermée. …" })` ; :470 `setFeedback(null);` ; :1024 bouton « Confirmer {amount_due} FCFA et Valider l'entrée » ; serveur route.ts:455, :462, :468, :480, :491, :497-500 (`code: 'SHIFT_NOT_OPEN'`), :523 (409), :550-552.

**Impact.** Le libellé du bouton implique que l'argent est déjà encaissé physiquement quand le contrôleur confirme ; si le serveur refuse d'enregistrer, l'écran dit « billet invalide » pendant 3,5 s puis plus rien : espèces en main sans trace, écart au Z de caisse, litige avec le spectateur, et le code SHIFT_NOT_OPEN renvoyé par l'API n'est jamais exploité.

**Recommandation.** Introduire un état `cash_error` persistant (pas d'auto-clear, pas de voix, pas de compteur) avec le message serveur et des actions explicites (« Ouvrir ma caisse », « Réessayer », « Annuler ») ; traiter `code === 'SHIFT_NOT_OPEN'` en ouvrant la modale tout en conservant la carte cash_required ; mettre isScanningActiveRef à false (prop `paused`) tant qu'une confirmation espèces est en attente ; passer à un bouton en deux temps « Espèces reçues » → « Valider l'entrée ».

### controller-ux-6 — Statistiques fausses : POST /scan renvoie `stats` sans total_tickets (« Billets valides » retombe à 0), double comptage API + Realtime, et tout UPDATE d'un billet déjà UTILISE incrémente « Arrivées »

- **Sévérité :** ÉLEVÉE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §160 ÉVÉNEMENTS (taux de présence), §40
- **Emplacement :** app/controller/scanner/page.tsx — lignes 491-494, 339-366, 880
- **Catégorie :** intégrité des données affichées

**Description.** La réponse POST contient `stats: { scanned_today }` seulement (route.ts:403-405, contrairement au PUT :613-616) et le front remplace l'objet stats entier → `selected.stats?.total_tickets ?? 0` affiche 0 dès le premier scan. L'abonnement Realtime tickets ajoute +1 pour tout UPDATE dont new.status === 'UTILISE' (y compris le propre scan du contrôleur, déjà compté exactement par la réponse API, et toute mise à jour ultérieure d'un billet déjà utilisé : transfert, notification, correction).

**Preuve.** route.ts:403-405 `stats: { scanned_today: scannedToday ?? 1, },` ; page.tsx:492 `setSelected(prev => prev ? { ...prev, stats: data.stats } : prev);` ; :880 `{selected.stats?.total_tickets ?? 0}` ; :341 `if (newT?.status === 'UTILISE') {` puis :348 `scanned_today: (prev.stats?.scanned_today ?? 0) + 1`.

**Impact.** Le KPI « Billets valides » passe à 0 après le premier scan de la soirée ; « Arrivées » dérive à la hausse d'environ +1 par scan (selon l'ordre d'arrivée API/Realtime) et davantage avec plusieurs contrôleurs : chiffres de présence inexploitables pour le partenaire.

**Recommandation.** Renvoyer des stats complètes côté POST ou fusionner `{ ...prev.stats, ...data.stats }` ; côté Realtime, ne compter que la transition `payload.old.status !== 'UTILISE' && payload.new.status === 'UTILISE'` (REPLICA IDENTITY FULL déjà activée : supabase/migrations/20260907_tickets_realtime_replica.sql:7) et ignorer les billets dont checked_in_by est le contrôleur courant, ou re-fetch débouncé des compteurs.

### controller-ux-7 — Abonnements Realtime `events`, `event_controllers` et `users` inopérants : tables absentes de la publication supabase_realtime ; canal `events` sans filtre et bloqué par la RLS `status = 'PUBLIE'`

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** moyenne
- **Référence CDC :** architecture §18 TEMPS RÉEL, §36 (Realtime ciblé)
- **Emplacement :** app/controller/scanner/page.tsx — lignes 220-242, 245-292, 295-321
- **Catégorie :** realtime / fonctionnel

**Description.** Les migrations n'ajoutent à la publication que orders, payments, tickets, notifications, hall_reservations, table_reservations (0004_indexes.sql:143-148) et ticket_categories/tickets (20260907_*). Aucun `ADD TABLE events|event_controllers|users`. Les trois effets (statut événement, assignations, désactivation compte) ne recevront donc jamais d'événement. De plus, le canal `events` écoute toute la table sans filtre, et Realtime applique la RLS `events_read_public` (`status = 'PUBLIE' OR owner OR admin`) : une ligne passant à SUSPENDU/TERMINE ne serait pas délivrée à un contrôleur même si la table était publiée. Le handler users (:310) déconnecterait un utilisateur multi-rôle dont users.role ≠ 'CONTROLEUR' sur n'importe quelle mise à jour de profil.

**Preuve.** page.tsx:249-255 `.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events' }, …)` (sans filter) ; :310 `if (u && (u.status === 'SUSPENDU' || u.status === 'INACTIF' || u.role !== 'CONTROLEUR')) {` ; supabase/migrations/0004_indexes.sql:143-148 (liste des tables publiées) ; supabase/migrations/0003_rls.sql:135-136 `CREATE POLICY "events_read_public" ON events FOR SELECT USING (status = 'PUBLIE' OR is_partner_owner(partner_id) OR is_admin());`.

**Impact.** Les comportements « live » annoncés (blocage de l'écran quand l'événement est suspendu/terminé, rafraîchissement des assignations après révocation, déconnexion forcée) ne se produisent pas : le contrôleur révoqué ou l'événement suspendu conservent un écran de scan « actif » et chaque billet est refusé un à un par l'API avec des messages de refus ; coût réseau d'un canal global inutile.

**Recommandation.** Ajouter events/event_controllers/users (ou une vue dédiée) à la publication avec REPLICA IDENTITY FULL et une policy permettant au contrôleur assigné de lire ses événements (`EXISTS (SELECT 1 FROM event_controllers ec WHERE ec.event_id = events.id AND ec.user_id = auth.uid())`) ; filtrer le canal `id=in.(…ids assignés…)` ; remplacer la logique users.role par user_roles/status ; à défaut, polling de /api/controller/assignments toutes les 30–60 s. Confiance « medium » uniquement parce qu'un ajout manuel via le dashboard Supabase n'est pas vérifiable depuis le dépôt.

### controller-ux-8 — Codes de résultat non couverts ou incohérents : `event_cancelled` traité comme faux billet avec voix Wolof, `rate_limited` sans titre, `code: 'EVENT_CANCELLED'` renvoyé pour un billet annulé/remboursé, statut ANNULE annoncé « pas encore validé »

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §40 CONTRÔLE, §41 REMBOURSEMENT
- **Emplacement :** app/controller/scanner/page.tsx — lignes 484-486, 942-951, 808, 835-844
- **Catégorie :** contrat API / UX

**Description.** Le mapping ne couvre que unauthorized/event_ended/event_suspended/event_not_ready → wrong_event. `event_cancelled` (route.ts:166-171) tombe dans le default → 'reject' + Wolof 'INVALID' et aucun titre dans la carte. Côté API, un billet ANNULE/REMBOURSE renvoie `code: 'EVENT_CANCELLED'` (route.ts:233, :341), sémantiquement faux. Dans l'UI, un événement ANNULE affiche « Événement Non Opérationnel — Cet événement n'est pas encore validé pour les contrôles », et le sélecteur ne badge que TERMINE/SUSPENDU.

**Preuve.** page.tsx:484 `if (data.scan_result === 'unauthorized' || data.scan_result === 'event_ended' || data.scan_result === 'event_suspended' || data.scan_result === 'event_not_ready') {` ; :951 `'Cet événement n\'est pas encore validé pour les contrôles.'` ; route.ts:169 `scan_result: 'event_cancelled'` ; :233 `code: 'EVENT_CANCELLED', scan_result: 'invalid', message: \`Ce billet est ${…annulé/remboursé}.\``.

**Impact.** Un événement annulé (situation de remboursement §41) est annoncé au spectateur comme un billet frauduleux ; le contrôleur reçoit des messages contradictoires ; la dérive du contrat backend/frontend rend toute évolution risquée.

**Recommandation.** Créer `lib/scanner/scan-result.ts` avec une union exhaustive (`valid | already_used | invalid | ticket_cancelled | ticket_refunded | event_cancelled | event_ended | event_suspended | event_not_ready | unauthorized | payment_required | cash_required | qr_expired | rate_limited | network_error | server_error`) importée par l'API et la page ; `event_cancelled` → ambre « Événement annulé » sans voix accusatrice ; corriger les codes TICKET_CANCELLED/TICKET_REFUNDED ; badge et message dédiés pour ANNULE dans le sélecteur et l'en-tête.

### controller-ux-9 — Écran d'erreur de chargement sans issue : « Réessayer » appelle router.refresh() sans réinitialiser `error` ni relancer fetchAssignments ; session expirée (401) traitée comme erreur générique

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** N/A (qualité) ; architecture §38
- **Emplacement :** app/controller/scanner/page.tsx — lignes 682-689, 159-199
- **Catégorie :** robustesse / UX

**Description.** fetchAssignments pose `error` (192/195) sans jamais le réinitialiser ; le bouton « Réessayer » appelle `router.refresh()`, qui ne re-rend que les Server Components et conserve l'état client : l'écran d'erreur reste affiché. Un 401 (cookie expiré) donne « Authentification requise. » avec ce même bouton inopérant, sans redirection vers /login.

**Preuve.** page.tsx:686 `<Button variant="outline" onClick={() => router.refresh()}>Réessayer</Button>` ; :192 `setError(data.error || 'Impossible de charger les événements.');` ; :195 `setError('Erreur réseau.');` ; aucun `setError('')` dans le fichier.

**Impact.** Un contrôleur qui ouvre l'application avec une 4G instable à son arrivée reste bloqué sur un écran mort jusqu'à un rechargement complet manuel ; en cas de session expirée il ne comprend pas qu'il doit se reconnecter.

**Recommandation.** `onClick={() => { setError(''); setLoading(true); fetchAssignments(); }}` ; dans fetchAssignments, si `res.status === 401` → `router.push('/login?redirect=/controller/scanner')` ; afficher un bandeau hors-ligne si `!navigator.onLine`.

### controller-ux-10 — Page d'activation /controller/setup rendue dans ControllerLayout (en-tête « Mon espace Client », cloche notifications, bouton Déconnexion) pour un utilisateur non connecté ; pas de renvoi de code ; messages `already_configured` et `unauthorized_controller` ignorés sur /login

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §11, §151-§153 (OTP, mot de passe, récupération)
- **Emplacement :** app/controller/layout.tsx — lignes 30-75 ; setup : app/controller/setup/page.tsx (fichier entier) ; login : app/login/page.tsx:159-174
- **Catégorie :** UX activation / setup

**Description.** app/controller/setup/page.tsx hérite de app/controller/layout.tsx (AppLayout.tsx:232-235 délègue tout /controller/* à ce layout). Un nouveau contrôleur, non authentifié, voit donc un en-tête avec « Mon espace Client », une NotificationBell (clic → /login) et un bouton « Se déconnecter ». La page n'offre aucun « Renvoyer le code » (OTP valable 24 h, invite/route.ts:362-363 ; renvoi uniquement côté partenaire via le flag `resend`, invite/route.ts:168). Après `ACCOUNT_ALREADY_CONFIGURED` la page redirige vers `/login?message=already_configured` et le middleware vers `/login?error=unauthorized_controller`, deux paramètres que la page login ne traite pas.

**Preuve.** layout.tsx:52 `<NotificationBell />` ; :65-73 bouton `aria-label="Se déconnecter"` ; setup/page.tsx:54 `router.push(data.redirect || '/login?message=already_configured');` ; middleware.ts:204 `return redirect(new URL('/login?error=unauthorized_controller', req.url));` ; login/page.tsx:160-173 ne gère que unauthorized_admin/partner/scanner, account_deactivated et account_activated.

**Impact.** Première prise en main incohérente pour le personnel de terrain (souvent peu technophile) ; un SMS perdu ou expiré bloque l'activation sans recours autonome ; des redirections silencieuses vers /login sans explication.

**Recommandation.** Déplacer setup dans un groupe de routes hors layout (`app/controller/(public)/setup`) ou conditionner l'en-tête à `useAuth().user` ; ajouter un endpoint public rate-limité « Renvoyer le code » appelable depuis la page ; gérer `message=already_configured` et `error=unauthorized_controller` dans /login ; afficher la durée de validité du code.

### controller-ux-11 — Entrée manuelle / QR statique : `is_manual_entry` renvoyé par l'API mais jamais affiché, placeholder « code à 6 chiffres » non résoluble par l'API, aucun rappel de contrôle d'identité

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §154 QR CODE (sécurisé, vérifiable), §40
- **Emplacement :** app/controller/scanner/page.tsx — lignes 75, 1077-1088
- **Catégorie :** anti-fraude UX

**Description.** Le serveur signale `is_manual_entry: !parsed.isDynamic` (route.ts:401) pour tout code accepté sans jeton TOTP (numéro TCK-… saisi ou lu sur une capture d'écran), mais la page ne lit ce champ nulle part (une seule occurrence : la déclaration de type). Le placeholder annonce « TCK-... ou code à 6 chiffres » alors que parseDynamicQrPayload traite un code nu de 6 chiffres comme identifiant (totp.ts:148-152) et que l'API ne cherche que ticket_number/qr_code (route.ts:101-118) → « Billet inexistant ».

**Preuve.** route.ts:401 `is_manual_entry: !parsed.isDynamic,` ; page.tsx:75 `is_manual_entry?: boolean;` (aucun autre usage) ; :1079 `placeholder="TCK-... ou code à 6 chiffres"` ; :1087 « …ou le code dynamique pour contrôle d'identité. ».

**Impact.** La protection anti-capture d'écran (TOTP 20 s) est contournée en tapant le numéro de billet visible sur une capture, sans que le contrôleur soit invité à vérifier une pièce d'identité ; les contrôleurs qui saisissent les 6 chiffres comme indiqué obtiennent systématiquement un refus.

**Recommandation.** Afficher un bandeau ambre « Entrée manuelle — vérifier la pièce d'identité du porteur » quand `ticket_info.is_manual_entry` est vrai (carte + overlay) ; proposer un formulaire manuel à deux champs (N° billet + code dynamique) envoyant `TCK-xxx:123456` (déjà supporté par parseDynamicQrPayload:137-146) ; corriger le placeholder.

### controller-ux-12 — Mode veille « économie batterie » ne coupe pas la caméra, boucle rAF maintenue en veille, aucun Wake Lock ni indicateur hors-ligne

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** architecture §5 (PWA), §38 MOBILE (faible consommation)
- **Emplacement :** components/scan/CameraQrScanner.tsx — lignes 74-95, 188-192, 427-448
- **Catégorie :** robustesse terrain / batterie

**Description.** Après 45 s d'inactivité, le timer coupe la torche et pose isAsleep, mais ne stoppe ni les pistes vidéo ni le rendu du <video> sous l'overlay : le capteur reste allumé alors que l'écran annonce « Mis en veille … pour économiser la batterie ». La boucle native continue de demander des frames à 60 Hz quand isScanningActiveRef est false. Aucun appel à navigator.wakeLock, navigator.onLine ou aux événements online/offline dans tout le dépôt (grep : aucune occurrence) ; la perte réseau n'est découverte qu'après l'échec d'un scan.

**Preuve.** CameraQrScanner.tsx:80-88 `inactivityTimerRef.current = setTimeout(() => { … setIsTorchOn(false); setIsAsleep(true); isScanningActiveRef.current = false; }, …)` (pas de stopCameraStream) ; :189-192 `if (!isScanningActiveRef.current) { animationFrameRef.current = requestAnimationFrame(checkFrame); return; }` ; :440 « Mis en veille après 45s d'inactivité pour économiser la batterie. ».

**Impact.** Autonomie réduite sur une soirée de 5–6 h contrairement à la promesse affichée ; l'écran peut se verrouiller (délai OS) pendant un creux de file, imposant déverrouillage et réinitialisation caméra ; le contrôleur n'apprend la coupure réseau qu'avec un spectateur devant lui.

**Recommandation.** Appeler stopCameraStream() à la mise en veille et startCameraStream() au réveil ; `navigator.wakeLock?.request('screen')` pendant le scan actif (ré-acquisition sur visibilitychange) ; bandeau persistant « Hors-ligne » piloté par online/offline ; sortir de la boucle rAF quand inactive et la relancer au réveil.

### controller-ux-13 — Minuterie de l'overlay plein écran réinitialisée à chaque rendu du parent (onDismiss recréé inline) : durée du flash non déterministe

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** N/A (qualité) ; architecture §37 (lisibilité, navigation)
- **Emplacement :** components/scan/CombatFlashOverlay.tsx — lignes 114-122
- **Catégorie :** UX / cycle de vie React

**Description.** L'effet de fermeture automatique dépend de `onDismiss`, passé par le parent sous forme de fonction fléchée inline (page.tsx:745) dont l'identité change à chaque rendu. Chaque re-rendu du parent (setIsVerifying, setManualCode, mises à jour Realtime des tickets, stats, activeShift) annule et recrée le setTimeout, repoussant la fermeture.

**Preuve.** CombatFlashOverlay.tsx:117-122 `const timer = setTimeout(() => { if (onDismiss) onDismiss(); }, effectiveDuration); return () => clearTimeout(timer); }, [status, effectiveDuration, onDismiss]);` ; page.tsx:745 `onDismiss={() => setCombatFlash(null)}` ; overlay `fixed inset-0 z-50` (CombatFlashOverlay.tsx:137).

**Impact.** Le flash « ACCÈS AUTORISÉ » prévu pour 1 s peut rester affiché plusieurs secondes en période d'affluence (nombreux événements Realtime), masquant la caméra et ralentissant la file ; le contrôleur doit toucher l'écran pour enchaîner.

**Recommandation.** Mémoïser onDismiss avec useCallback dans le parent et/ou lire la dernière valeur via une ref dans l'overlay en ne dépendant que d'un `flashId` incrémenté par scan ; ajouter un test vérifiant que la durée reste 1000 ms malgré des re-rendus.

### controller-ux-14 — Assignation dont l'événement joint est null → crash TypeError (`selected.events.id`) ; sélection par défaut ne privilégie pas un événement éligible

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** moyenne
- **Référence CDC :** §11 ; N/A (qualité)
- **Emplacement :** app/controller/scanner/page.tsx — lignes 1147-1148, 178-190
- **Catégorie :** robustesse / sélection d'événement

**Description.** L'API renvoie `events: null` si la jointure est vide (assignments/route.ts:49-55). Tout le rendu utilise `selected.events?.…` sauf les props de OpenShiftModal qui accèdent à `selected.events.id`/`.title` sans optional chaining. La sélection initiale et le repli choisissent le premier élément dont `status !== 'TERMINE'`, ce qui peut retenir un événement SUSPENDU/ANNULE/BROUILLON avant un événement PUBLIE.

**Preuve.** page.tsx:1147 `eventId={selected.events.id}` ; :1148 `eventTitle={selected.events.title}` ; :181 `const active = list.find(a => a.events?.status !== 'TERMINE');` ; assignments/route.ts:49-53 `const formattedEvent = a.events ? {…} : null;`.

**Impact.** Écran blanc pour le contrôleur si une assignation orpheline (événement non joint) est sélectionnée par défaut ; démarrage sur un événement non opérationnel alors qu'un événement actif est assigné. La FK ON DELETE CASCADE (20260904_event_controllers.sql:7) réduit la probabilité, d'où une confiance moyenne.

**Recommandation.** Filtrer côté API les assignations sans événement ; utiliser `isEventEligibleForController(a.events?.status)` pour le choix par défaut ; protéger les props de la modale (`selected.events?.id ?? ''`) et n'afficher la modale que si l'événement existe.

### controller-ux-15 — Cibles tactiles sous 44 px (boutons size="sm" = 32 px, croix de modales ~26 px) et textes opérationnels en 8–10 px

- **Sévérité :** FAIBLE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** architecture §37 (lisibilité, accessibilité), §38 (boutons suffisamment grands)
- **Emplacement :** components/ui/Button.tsx — lignes 47 ; usages : components/scan/CameraQrScanner.tsx:414-421, 546 ; components/shifts/ShiftModals.tsx:64-72, 98-105, 180-186, 341-347, 504-510 ; app/controller/scanner/page.tsx:836, 846, 862, 1122
- **Catégorie :** UX mobile / accessibilité

**Description.** La variante `sm` du Button fait `h-8` (32 px) et sert pour « Réessayer », « Mode Manuel », « Scanner le billet suivant », « Clôturer (Z de Caisse) », « Ouvrir ma caisse » ; les croix de fermeture des trois modales sont `p-1` avec icône 18 px. Le sélecteur desktop utilise `text-[8px]`/`text-[9px]` pour les badges Terminé/Suspendu et la date, l'en-tête `text-[8px]`, l'historique `text-[9px]`, malgré les commentaires « Touch targets >= 44px » du fichier.

**Preuve.** Button.tsx:47 `sm: 'text-xs px-3.5 py-1.5 h-8 gap-1.5 rounded-lg',` ; ShiftModals.tsx:183 `className="p-1 rounded-full …"` ; page.tsx:836 `<span className="text-[8px] font-bold …">Terminé</span>` ; :846 `text-[9px]`.

**Impact.** Erreurs de toucher avec gants/pluie/foule, illisibilité en plein soleil pour des informations opérationnelles (statut de l'événement, date) ; contradiction avec les exigences mobile-first du document d'architecture.

**Recommandation.** Imposer `min-h-[44px] min-w-[44px]` sur tous les contrôles du parcours contrôleur (variante `sm` dédiée terrain ou `size="md"`), taille minimale 11–12 px pour tout texte porteur d'information, 14 px pour les statuts.

### controller-ux-16 — Session de caisse : PIN régisseur sans clavier numérique ni autoComplete, aucune alerte de caisse laissée ouverte (changement d'événement, déconnexion), état des modales conservé entre ouvertures

- **Sévérité :** FAIBLE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §11 (paiement hors plateforme selon permission) ; architecture §12
- **Emplacement :** components/shifts/ShiftModals.tsx — lignes 221-229, 442-450, 134, 270 ; page.tsx:211-217, 602-606
- **Catégorie :** UX caisse / sécurité d'usage

**Description.** Les champs PIN sont `type="password" maxLength={6}` sans `inputMode="numeric"`, `pattern` ni `autoComplete`, dans un formulaire comportant un champ montant : les gestionnaires de mots de passe proposent d'enregistrer le PIN du régisseur sous le compte du contrôleur et le clavier QWERTY s'affiche. En changeant d'événement, `activeShift` est remis à null sans avertir qu'une caisse reste OUVERTE sur l'événement précédent ; la déconnexion (globale) n'avertit pas non plus. Les modales renvoient null après les hooks, conservant PIN, montant et erreur d'une ouverture à l'autre.

**Preuve.** ShiftModals.tsx:222-223 `type="password" maxLength={6}` (idem :443-444) ; :134 `if (!isOpen) return null;` après les useState ; page.tsx:214-216 `} else { setActiveShift(null); }` ; :602-606 handleLogout sans vérification ; service disponible : lib/shifts/shift.service.ts:627 `hasActiveShift(controllerUserId, eventIds?)`.

**Impact.** Saisie du PIN lente et exposée ; caisses oubliées en statut OUVERT toute la nuit, Z de caisse partenaire incomplet et écarts non constatés le soir même.

**Recommandation.** `inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code"` ; bannière « Caisse ouverte sur <événement> » visible quel que soit l'événement sélectionné et confirmation bloquante avant déconnexion/changement d'événement (endpoint `GET /api/controller/shifts/active` sans event_id ou nouvel endpoint listant les shifts OUVERT) ; réinitialiser l'état des modales à la fermeture.

### controller-ux-17 — PWA : manifest sans scope/orientation/id/icônes maskable/raccourci Scanner ; SW précache des pages authentifiées et renvoie la home comme shell hors-ligne ; CACHE_NAME figé ; enregistrement dépendant de l'événement load

- **Sévérité :** FAIBLE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** architecture §5 ARCHITECTURE PWA
- **Emplacement :** public/sw.js — lignes 2-10, 45-54 ; public/manifest.json:1-21 ; components/pwa/ServiceWorkerRegister.tsx:7-17
- **Catégorie :** PWA / installabilité

**Description.** Le manifest démarre sur `/` sans `scope`, `id`, `orientation`, icônes `purpose: maskable` ni `shortcuts` vers /controller/scanner. Le SW précache `/tickets`, `/orders`, `/profile` (pages authentifiées : à l'installation anonyme, c'est la page de login redirigée qui est stockée) ; le fetch handler est network-first sans `cache.put`, donc hors-ligne `/controller/scanner` retombe sur `/` (home marketing) au lieu d'un shell « hors-ligne » ; `event-village-v1` n'est jamais versionné (HTML précaché obsolète après déploiement). L'enregistrement attend `window load` depuis un useEffect : si l'hydratation s'achève après `load`, le listener ne se déclenche jamais. Point positif : `/api/` et supabase.co sont exclus du cache (aucune réponse de scan périmée).

**Preuve.** sw.js:3-10 `STATIC_ASSETS = ['/', '/manifest.json', '/explore', '/tickets', '/orders', '/profile']` ; :49-51 `if (event.request.mode === 'navigate') { return caches.match('/'); }` ; :2 `const CACHE_NAME = 'event-village-v1';` ; manifest.json:5 `"start_url": "/"` ; ServiceWorkerRegister.tsx:8 `window.addEventListener('load', () => {`.

**Impact.** L'application installée s'ouvre sur l'accueil public plutôt que sur le scanner ; hors-ligne, le contrôleur voit une page marketing sans explication ; risque de shell obsolète après mise en production. Le point sur `load` est une hypothèse (confiance moyenne sur ce sous-point).

**Recommandation.** Ajouter `scope`, `id`, `orientation: "portrait"`, icônes maskable et `shortcuts: [{ name: "Scanner", url: "/controller/scanner" }]` ; page `/offline` dédiée comme fallback de navigation ; cache runtime de `/_next/static` avec nom de cache versionné au build ; enregistrer immédiatement si `document.readyState === 'complete'`.

### controller-ux-18 — Dette structurelle : composant de 1185 lignes, `any`, imports morts, navigation et ConfirmDialog dupliqués, classes Tailwind v4 inexistantes en v3, second moteur de scan /partner/scan sur /api/tickets/verify sans règles métier

- **Sévérité :** FAIBLE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** N/A (qualité) — AGENTS.md ; architecture §36
- **Emplacement :** app/controller/scanner/page.tsx — lignes 1-1185 ; any : 205, 256-257, 308-309, 339-340 ; imports : 7 (Ticket), 10 (RefreshCw) ; doublons : 751-759 vs layout.tsx:34-42, 717-725 & 1174-1182 vs layout.tsx:81-89
- **Catégorie :** qualité de code / duplication

**Description.** La page mêle fetch, 4 abonnements Realtime, orchestration sensorielle, caisse et rendu. `Ticket` et `RefreshCw` sont importés sans usage. La barre « Mon espace Client » et le ConfirmDialog de déconnexion existent à la fois dans le layout et dans la page. Les classes `shadow-2xs`, `active:scale-98`, `animate-in fade-in zoom-in-95`, `sm:h-13` n'existent pas en Tailwind 3.4 sans plugin (tailwind.config.ts:57-64 ne définit pas 2xs, :67 `plugins: []`, package.json:40 `tailwindcss ^3.4.10`) : effets visuels attendus absents. `/scan` redirige vers `/partner/scan` qui appelle `/api/tickets/verify`, un moteur parallèle : tolérance TOTP ±1 (vs ±2), aucun contrôle de statut événement, aucune assignation/cash gate, pas de `checked_in_by`, pas de rate limit, `userId: ticket.user_id || 'controller-scan'` dans l'audit.

**Preuve.** page.tsx:10 `ArrowLeft, Volume2, VolumeX, WifiOff, RefreshCw,` (RefreshCw jamais utilisé) ; :750 `… shadow-2xs">` ; :1005 `active:scale-98` ; app/scan/page.tsx:4 `redirect('/partner/scan');` ; app/partner/scan/page.tsx:53 `fetch('/api/tickets/verify'` ; app/api/tickets/verify/route.ts:97 `toleranceWindows: 1`, :145-151 update sans checked_in_by, :155 `userId: ticket.user_id || 'controller-scan'`.

**Impact.** Deux chemins de compostage aux règles divergentes (un partenaire scannant via /partner/scan contourne le blocage événement suspendu/terminé et l'encaissement espèces, et les billets compostés n'ont pas de checked_in_by) ; maintenance coûteuse et régressions probables ; finitions visuelles (ombres, animations d'entrée) silencieusement absentes.

**Recommandation.** Extraire `useControllerAssignments`, `useScanRealtime`, `useShiftSession`, `useScanFeedback` ; typer les payloads Realtime ; supprimer les imports/duplications ; soit installer `tailwindcss-animate` et définir les tokens manquants, soit remplacer par des classes v3 valides ; faire pointer /partner/scan sur /api/controller/scan (qui accepte déjà PARTENAIRE) et déprécier /api/tickets/verify.

### controller-ux-19 — Sémantique couleur incohérente entre carte, overlay et historique ; KPI « Billets refusés » gonflé par qr_expired, payment_required et erreurs techniques

- **Sévérité :** FAIBLE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** §40 (🔴 INVALIDE / DÉJÀ UTILISÉ)
- **Emplacement :** app/controller/scanner/page.tsx — lignes 1113-1118, 1123, 452-457
- **Catégorie :** UX / cohérence visuelle

**Description.** `already_used` est rouge dans la carte (625-631) et l'overlay (CombatFlashOverlay.tsx:41-46) mais ambre dans l'historique ; `wrong_event` est ambre dans la carte/overlay mais rouge dans l'historique (default). Le compteur « refusés » s'incrémente pour tout résultat non valid/non cash_required, donc aussi pour un QR expiré (le spectateur rafraîchit et entre 10 s plus tard), un paiement requis à la caisse principale, et — via le défaut 'invalid' — pour les erreurs serveur.

**Preuve.** page.tsx:1113-1115 `const color = h.result === 'valid' ? 'text-emerald-500' : h.result === 'already_used' ? 'text-amber-500' : 'text-red-500';` ; :1123 `(h.result === 'valid' ? 'OK' : h.result === 'already_used' ? 'Doublon' : 'Erreur')` ; :452-456 incrément pour tout `scanResult !== 'valid' && scanResult !== 'cash_required'`.

**Impact.** Lecture rapide de l'historique trompeuse (un doublon ambre vs rouge selon l'endroit) ; KPI « refusés » sans valeur pour le partenaire car il mélange fraudes, expirations bénignes et incidents techniques.

**Recommandation.** Centraliser une table `SCAN_RESULT_THEME` (couleur, icône, libellé, voix) utilisée par la carte, l'overlay et l'historique ; ne compter en « refusés » que already_used/invalid/wrong_event/ticket_cancelled et afficher « Expirés » et « À régler en caisse » séparément.

## H. Modèle de données, migrations, RLS

**Synthèse de l'auditeur :** Points forts : RLS activée sur toutes les tables, verrous consultatifs (pg_advisory_xact_lock) pour le compostage et les retraits avec REVOKE correct sur ces trois RPC, contrainte CHECK sold+held ≤ total et clés d'idempotence sur payments/commissions, triggers d'audit sur les tables financières. En revanche, l'audit du modèle de données révèle des failles RLS directement exploitables via l'API REST Supabase (forge/altération de billets, otp_codes sans RLS, auto-attribution du rôle SUPERADMIN à l'inscription, RPC validate_and_check_in_ticket exposée publiquement), une absence totale de régularisation des commissions de parrainage lors des remboursements, et une série d'incohérences code↔schéma (enum partner_status 'ACTIF' inexistant, colonnes ticket_transfers.event_id/updated_at inexistantes, totp_secret jamais lu, held_expires_at jamais écrit, seeds de parrainage contradictoires avec le CDC).

**Limites de couverture :** Analyse statique uniquement (aucune exécution SQL ni test) : les comportements PostgreSQL cités (résolution de référence externe dans event_cancellations, détection de récursion RLS sur user_roles, privilèges EXECUTE par défaut sur les fonctions, GRANT ALL par défaut de Supabase sur le schéma public) sont déduits de la sémantique PostgreSQL/Supabase et non vérifiés sur l'instance. Non vérifiés : la configuration Auth du projet hébergé (enable_signup, hooks), l'état réel de la table supabase_migrations sur la base distante, les migrations 0009/0010 (salles/tables), les politiques Storage, les tables campaigns/sponsored_promotions, la RLS détaillée de ticket_transfers, et les services de notification. Les index ont été évalués sur les requêtes lues, pas sur des plans d'exécution réels.

### data-model-1 — handle_new_user accepte n'importe quel rôle (ADMIN/SUPERADMIN) depuis les métadonnées d'inscription contrôlées par l'utilisateur

- **Sévérité :** CRITIQUE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** CDC §152 Permissions, §151 ; architecture §29-§30
- **Emplacement :** supabase/migrations/20260906_user_roles_multi_role.sql — lignes L397-404, L418-424 (et 20260904_fix_handle_new_user.sql L42-49 ; supabase/config.toml L163, L198)
- **Catégorie :** RLS / fonctions SQL / élévation de privilèges

**Description.** La dernière version du trigger handle_new_user (AFTER INSERT ON auth.users, SECURITY DEFINER) lit `raw_user_meta_data->>'role'` et le caste en user_role sans liste blanche : toute valeur valide de l'enum, y compris 'ADMIN' et 'SUPERADMIN', est acceptée puis insérée dans user_roles (L421-424). Les versions 0005/0006 n'acceptaient que PARTENAIRE/CONTROLEUR ; le hotfix 20260904 puis 20260906 ont supprimé ce garde-fou. Or raw_user_meta_data est fourni par le client lors d'un signup GoTrue (`options.data`) et config.toml laisse enable_signup = true. Un appel direct POST /auth/v1/signup avec la clé anon publique et `data: {role:'SUPERADMIN'}` suffit. Par ricochet, is_admin()/is_superadmin() (L202-211) s'appuient sur user_roles et deviennent vrais pour cet utilisateur dans toutes les politiques RLS. Régressions annexes du même trigger : phone forcé à '' au lieu de NULL (L382) malgré la colonne UNIQUE et le DROP NOT NULL de 0005 L16 ; statut 'ACTIF' forcé même pour PARTENAIRE (L411) alors que 0006 L37-39 imposait EN_ATTENTE ; perte du bloc EXCEPTION de résilience de 0005/0006.

**Preuve.** v_role_meta := NEW.raw_user_meta_data->>'role';
IF v_role_meta IS NOT NULL THEN
    BEGIN
        v_role := v_role_meta::user_role;   -- accepte 'ADMIN' / 'SUPERADMIN'
...
IF v_role != 'CLIENT' THEN
    INSERT INTO user_roles (user_id, role) VALUES (NEW.id, v_role)

**Impact.** Prise de contrôle complète de la plateforme par un inconnu (lecture/écriture de toutes les tables via REST grâce à is_admin() dans les politiques, accès au back-office), sans aucune interaction d'un administrateur. Exploitabilité conditionnée à l'activation du signup public sur le projet hébergé (valeur par défaut Supabase : activé).

**Recommandation.** Dans handle_new_user, n'accepter depuis les métadonnées que 'CLIENT' (éventuellement 'PARTENAIRE' avec statut EN_ATTENTE) ; attribuer CONTROLEUR/ADMIN/SUPERADMIN uniquement via les routes service_role (auth.admin.createUser) en écrivant le rôle dans raw_app_meta_data, jamais raw_user_meta_data. Rétablir NULLIF(TRIM(phone),'') et le statut EN_ATTENTE pour les partenaires. Activer un hook before_user_created ou désactiver le signup public si tous les parcours passent par /api/auth/register. Auditer immédiatement user_roles en production pour détecter des rôles ADMIN/SUPERADMIN non attendus.

### data-model-2 — RLS tickets : tout client peut forger un billet par INSERT direct, tout CONTROLEUR peut lire et réécrire n'importe quel billet de n'importe quel partenaire

- **Sévérité :** CRITIQUE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** CDC §39-§40 QR unique et contrôle, §154 QR sécurisé, §152 ; architecture §30-§31
- **Emplacement :** supabase/migrations/0003_rls.sql — lignes L154-165 (et L281-282 payments ; app/api/controller/scan/route.ts L72-73, L101-118, L283-286 ; lib/security/totp.ts L148-152)
- **Catégorie :** RLS / intégrité billetterie

**Description.** Trois politiques sur tickets sont trop larges et jamais resserrées par les migrations suivantes (grep : aucune redéfinition) : (1) `tickets_insert_auth` WITH CHECK (user_id = auth.uid() OR is_admin()) autorise tout utilisateur authentifié à insérer une ligne tickets via PostgREST avec event_id/category_id publics (ticket_categories_read_public expose les catégories), ticket_number et qr_code arbitraires, price 0, status VALIDE par défaut ; (2) `tickets_update_controller` FOR UPDATE USING (is_controller() OR is_admin()) sans WITH CHECK ni restriction de colonne : un contrôleur peut remettre un billet UTILISE en VALIDE, changer user_id, etc., sur tous les événements de tous les partenaires ; (3) `tickets_read` accorde is_controller() sans lien avec event_controllers : lecture globale des qr_code/user_id/totp_secret. Côté scan, la route accepte un identifiant statique (parseDynamicQrPayload renvoie isDynamic=false, scan L135 saute le TOTP), recherche par ticket_number puis qr_code (L101-118) et composte tout billet VALIDE sans order_id (L283-286). `payments_insert_auth` (L281-282) permet en plus d'insérer un paiement SUCCESS factice rattaché au billet forgé. Supabase accorde par défaut ALL sur les tables du schéma public à anon/authenticated : la RLS est l'unique barrière.

**Preuve.** CREATE POLICY "tickets_insert_auth" ON tickets
    FOR INSERT WITH CHECK (user_id = auth.uid() OR is_admin());
CREATE POLICY "tickets_update_controller" ON tickets
    FOR UPDATE USING (is_controller() OR is_admin());

**Impact.** Entrée gratuite à n'importe quel événement payant avec un billet auto-émis qui passe le scan (perte directe pour l'organisateur et sur les frais de service), réadmission de billets déjà utilisés par un contrôleur malveillant, fuite des données de tous les porteurs vers n'importe quel contrôleur.

**Recommandation.** Supprimer tickets_insert_auth (émission uniquement par service_role via reserveTicketsAtomic) ; remplacer tickets_update_controller par aucune politique (compostage via RPC atomic_ticket_checkin service_role) ou une politique restreinte via une fonction SECURITY DEFINER vérifiant event_controllers et ne permettant que VALIDE→UTILISE ; limiter tickets_read des contrôleurs aux événements où ils sont assignés (EXISTS sur event_controllers) ; retirer le prédicat client_id = auth.uid() de payments_insert_auth. Ajouter un test RLS automatisé (rôle authenticated) sur ces tables.

### data-model-3 — Table otp_codes créée sans RLS : codes OTP lisibles par anon via REST, prise de contrôle des comptes contrôleurs

- **Sévérité :** CRITIQUE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** CDC §153 OTP, §155 Protection des données, §11 Contrôleur
- **Emplacement :** supabase/migrations/0005_storage_and_auth.sql — lignes L19-28 (et app/api/controller/setup/route.ts L55-66 ; middleware.ts L20-22 ; app/api/auth/verify-otp/route.ts L75-96)
- **Catégorie :** RLS / authentification contrôleurs

**Description.** 0005 crée public.otp_codes (phone, code, expires_at, verified) sans `ENABLE ROW LEVEL SECURITY` et aucune migration ultérieure ne l'active (grep otp_codes : seules les lignes L19 et L28 de 0005 dans supabase/). Avec les privilèges par défaut de Supabase, `GET /rest/v1/otp_codes?phone=eq.…` avec la clé anon renvoie le code en clair. L'endpoint public /api/controller/setup (liste PUBLIC_API_EXACT du middleware L20-22) vérifie l'OTP en lisant otp_codes (L55-66) puis définit new_password pour le compte dont le téléphone correspond ; verify-otp utilise la même table en secours. Le rate-limit (L41) ne protège pas contre une lecture directe du code.

**Preuve.** CREATE TABLE IF NOT EXISTS public.otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    code TEXT NOT NULL,
    ...
);
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ...
-- aucun ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY

**Impact.** Un attaquant connaissant le numéro d'un contrôleur invité (ou d'un utilisateur en flux OTP) lit le code, fixe un mot de passe et agit comme contrôleur (compostage, encaissement espèces) ; contournement de l'OTP des opérations sensibles.

**Recommandation.** Migration immédiate : `ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;` sans politique (accès service_role uniquement) + `REVOKE ALL ON public.otp_codes FROM anon, authenticated;`. Stocker un hash du code (bcrypt/HMAC) plutôt que le code en clair, purger les codes expirés, et ajouter un test automatisé vérifiant que chaque table du schéma public a RLS activée (requête sur pg_tables.rowsecurity).

### data-model-4 — RPC validate_and_check_in_ticket (SECURITY DEFINER) exposée à anon/authenticated sans vérification de l'appelant : compostage de n'importe quel billet par son qr_code

- **Sévérité :** CRITIQUE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** CDC §40 Contrôle, §154 QR vérifiable/historisé ; architecture §31
- **Emplacement :** supabase/migrations/20260906_user_roles_multi_role.sql — lignes L235-307 (origine 0002_functions.sql L241-307 ; GRANT/REVOKE présents uniquement dans 20260903 L96-100, 20260904 L55-56, 20260906_atomic_partner_remove_controller L61-62)
- **Catégorie :** fonctions/RPC / privilèges

**Description.** Contrairement à atomic_ticket_checkin, request_withdrawal et atomic_partner_remove_controller, la fonction validate_and_check_in_ticket(p_qr_code, p_controller_id) n'a jamais reçu de REVOKE : avec les privilèges par défaut (EXECUTE à PUBLIC), elle est appelable via POST /rest/v1/rpc/validate_and_check_in_ticket par anon et authenticated. Elle ne compare jamais p_controller_id à auth.uid() : elle vérifie seulement que l'id fourni a un rôle contrôleur/admin (L252-256) ou est le propriétaire partenaire (L268-271), puis passe le billet en UTILISE (L291-296) sans contrôle d'assignation à l'événement, sans TOTP, sans vérification du statut ANNULE de l'événement ni audit. Les user_id des propriétaires partenaires sont publics (0003 L109-110 partners_read_public expose partners.user_id pour les partenaires VALIDE). Le qr_code statique est inclus en clair dans le payload dynamique affiché au client (app/api/tickets/[id]/live-code/route.ts L65, totp.ts L112-114) : toute personne ayant photographié un QR, même expiré, le connaît.

**Preuve.** CREATE OR REPLACE FUNCTION validate_and_check_in_ticket(p_qr_code TEXT, p_controller_id UUID) RETURNS JSONB AS $$ ...
    IF NOT v_has_controller_role AND p_controller_id != v_partner_owner THEN ... -- jamais comparé à auth.uid()
    UPDATE tickets SET status = 'UTILISE', checked_in_at = now(), checked_in_by = p_controller_id ...
$$ LANGUAGE plpgsql SECURITY DEFINER;  -- aucun REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated

**Impact.** Déni d'accès ciblé ou massif : des billets payés sont marqués utilisés avant l'arrivée des clients (refus à l'entrée, litiges, remboursements), attribués faussement à un contrôleur ; aucune trace dans audit_logs. Également calculable : activate_partner_trial et calculate_referral_commissions sont exposées de la même façon.

**Recommandation.** `REVOKE EXECUTE ON FUNCTION validate_and_check_in_ticket(TEXT, UUID) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO service_role;` (idem activate_partner_trial, calculate_referral_commissions, has_admin_permission) ou supprimer la fonction devenue redondante avec atomic_ticket_checkin. Adopter la règle « ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC » et fixer SET search_path = public sur toutes les fonctions SECURITY DEFINER (seule request_withdrawal le fait, 20260903 L23).

### data-model-5 — Aucune régularisation des commissions de parrainage lors d'un remboursement : trigger uniquement sur SUCCESS, aucune mise à jour CANCELLED dans le code

- **Sévérité :** CRITIQUE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** CDC §41 Remboursement, §82 Remboursements, §103 ; architecture §26
- **Emplacement :** supabase/migrations/0002_functions.sql — lignes L222-235 (et 0001 L600-617 ; lib/payments/withdrawal.service.ts L255-265 ; lib/events/event-cancellation.service.ts L492-530 ; lib/payments/payment.service.ts L1113-1135)
- **Catégorie :** fonctions/triggers / règle financière

**Description.** Le seul mécanisme de commissions est le trigger trg_payment_success_referrals qui crée des commissions N1/N2 en statut AVAILABLE dès le passage à SUCCESS (0002 L169, L210). Aucun trigger, fonction ou code applicatif ne les annule ou ne les corrige quand le paiement passe à REFUNDED/PARTIAL : grep `.from('referral_commissions')` dans lib/ et app/ ne montre que des lectures et le passage AVAILABLE→PAID par withdrawal.service (L255-265) ; la colonne cancellation_reason (0001 L613) et le statut CANCELLED ne sont jamais écrits. Les parcours d'annulation d'événement (event-cancellation.service L492-530, status REFUNDED) et de remboursement manuel (payment.service L1113-1135) ne touchent pas aux commissions.

**Preuve.** CREATE OR REPLACE FUNCTION trg_fn_payment_success_commissions() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'SUCCESS' AND (OLD.status IS NULL OR OLD.status != 'SUCCESS') THEN
        PERFORM calculate_referral_commissions(NEW.id);
    END IF;
    RETURN NEW;  -- aucun traitement de REFUNDED / CANCELLED
END;

**Impact.** Event Village paie des commissions sur un revenu net qu'elle a restitué : perte financière systématique à chaque annulation d'événement (tous les billets remboursés) et schéma de fraude parrain/filleul (achat → commission disponible → remboursement → retrait). Violation directe du CDC §82 « commission de parrainage corrigée ».

**Recommandation.** Ajouter un trigger AFTER UPDATE OF status ON payments : quand status passe à REFUNDED (ou PARTIAL avec recalcul prorata), mettre les commissions liées (payment_id) en CANCELLED avec cancellation_reason si elles sont PENDING/AVAILABLE, et créer une commission négative/ligne de régularisation si elles sont déjà PAID (historique conservé, jamais de suppression). Exclure les commissions CANCELLED du calcul de request_withdrawal (déjà le cas via status='AVAILABLE'). Couvrir par un test d'intégration.

### data-model-6 — Politiques RLS event_cancellations : la sous-requête référence partners.partner_id inexistant, résolu silencieusement en events.partner_id → accès inter-partenaires

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** CDC §41, §152 ; architecture §30
- **Emplacement :** supabase/migrations/20260910_event_cancellation_and_refunds.sql — lignes L36-90 (sous-requêtes L43-45, L57-59, L71-73, L85-87 ; schéma partners 0001 L245-268)
- **Catégorie :** RLS / annulations

**Description.** Les quatre politiques (SELECT/INSERT/UPDATE/DELETE TO authenticated) comparent events.partner_id à `(SELECT partner_id FROM partners WHERE user_id = auth.uid())`. La table partners n'a pas de colonne partner_id (sa clé est id) ; PostgreSQL ne rejette pas la politique mais résout l'identifiant non qualifié comme référence externe vers events.partner_id du niveau englobant. La condition devient `events.partner_id = events.partner_id` pour toute ligne partners de l'utilisateur : tout utilisateur possédant au moins une ligne partners (même EN_ATTENTE ou REJETE) satisfait la politique pour TOUS les événements ; un utilisateur avec deux lignes partners provoque « more than one row returned by a subquery ». L'hypothèse H3 (politique invalide) est donc infirmée au profit d'un défaut plus grave : sur-permission silencieuse.

**Preuve.** AND events.partner_id = (
    SELECT partner_id FROM partners WHERE user_id = auth.uid()
)  -- partners n'a pas de colonne partner_id : référence externe vers events.partner_id

**Impact.** Tout compte partenaire peut, via REST, lire les motifs internes d'annulation de concurrents, insérer/modifier/supprimer des enregistrements d'annulation (public_notice, internal_reason) sur les événements d'autrui, corrompant la traçabilité exigée par le CDC §41/§156.

**Recommandation.** Remplacer par `events.partner_id IN (SELECT id FROM partners WHERE user_id = auth.uid())` ou mieux `is_partner_owner(events.partner_id)` (0003 L33-40). Restreindre INSERT/UPDATE/DELETE au service_role (le service ne passe que par getServiceRoleClient). Ajouter un test qui exécute chaque politique avec un JWT partenaire tiers.

### data-model-7 — Politiques FOR ALL partenaires sur events/ticket_categories sans restriction de colonnes ni trigger de transition : auto-publication, auto-mise en avant et manipulation des stocks par REST

- **Sévérité :** ÉLEVÉE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** CDC §24 Validation, §31 Publication, §35 ; architecture §20-§21
- **Emplacement :** supabase/migrations/0003_rls.sql — lignes L138-139, L148-152 (colonnes sensibles : 20260902_event_services_promotions.sql L4-5, 20260906_controller_shifts.sql L7-9, 20260907 L6-7 ; contrôles uniquement applicatifs : lib/events/event.service.ts L108-111, L528-536)
- **Catégorie :** RLS / workflow événement

**Description.** `events_partner_manage FOR ALL USING (is_partner_owner(partner_id) OR is_admin())` et `ticket_categories_partner_manage FOR ALL` donnent au propriétaire un UPDATE libre sur toutes les colonnes. Aucun trigger ne contrôle les transitions de statut ni les colonnes réservées. Un partenaire peut donc, avec son JWT et la clé anon : passer status de BROUILLON à PUBLIE (ou de SUSPENDU/ANNULE à PUBLIE) sans validation admin, forcer is_featured=true/featured_until (promotion payante), modifier regisseur_pin_hash, et sur ticket_categories réécrire sold_quantity/held_quantity/total_quantity (contrainte CHECK seule garde-fou), contournant les règles capacité/quotas implémentées uniquement dans event.service.ts.

**Preuve.** CREATE POLICY "events_partner_manage" ON events
    FOR ALL USING (is_partner_owner(partner_id) OR is_admin());
CREATE POLICY "ticket_categories_partner_manage" ON ticket_categories
    FOR ALL USING (EXISTS (...is_partner_owner(events.partner_id)) OR is_admin());

**Impact.** Le workflow création → validation admin → publication exigé par le CDC est contournable ; mise en avant gratuite ; statistiques de vente falsifiables (sold_quantity) ; réouverture d'un événement suspendu par l'admin.

**Recommandation.** Supprimer les politiques d'écriture partenaire (toutes les mutations passent déjà par service_role) ou les limiter à SELECT ; sinon ajouter un trigger BEFORE UPDATE sur events refusant toute modification de status/is_featured/featured_until/regisseur_pin_hash quand current_setting('request.jwt.claims')->>'role' = 'authenticated', et un trigger équivalent sur ticket_categories pour sold_quantity/held_quantity. Déplacer la règle « somme des quotas ≤ capacity » dans un trigger SQL.

### data-model-8 — activate_partner_trial écrit partners.status = 'ACTIF', valeur absente de l'enum partner_status : la RPC échoue toujours et le fallback applicatif reproduit l'erreur

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** CDC §24 Validation, §25 Période d'essai
- **Emplacement :** supabase/migrations/0008_partner_auth_production.sql — lignes L63-69 (enum : 0001_initial_schema.sql L39-44 ; app/api/partner/activation/route.ts L57-60, L62-83, L98-105)
- **Catégorie :** fonctions/RPC / cohérence code↔schéma

**Description.** partner_status = ('EN_ATTENTE','VALIDE','REJETE','SUSPENDU'). Aucune migration n'ajoute 'ACTIF' (grep ADD VALUE : seuls user_status et event_status). L'UPDATE L63-69 lève donc « invalid input value for enum partner_status: "ACTIF" », la transaction de la fonction est annulée et le RPC retourne une erreur. La route d'activation bascule alors sur un fallback JS (L62) qui exécute le même UPDATE invalide sur partners (L70-78) sans vérifier l'erreur retournée, met users.status à ACTIF (L80-83) puis renvoie success/status 'ACTIF' (L98-105).

**Preuve.** UPDATE public.partners
SET trial_started_at = v_started_at,
    trial_ends_at = v_ends_at,
    status = 'ACTIF',   -- partner_status ne contient pas 'ACTIF'
    updated_at = now()

**Impact.** trial_started_at/trial_ends_at ne sont jamais persistés : la période d'essai (60/90 jours) n'est ni datée ni expirable, l'idempotence est perdue (chaque appel renvoie isNewActivation=true et renvoie la notification), et le code croit à un statut inexistant.

**Recommandation.** Corriger la fonction (et le fallback) pour utiliser 'VALIDE' ou ajouter explicitement 'ACTIF' à partner_status par migration si c'est le statut métier voulu ; supprimer le fallback JS et remonter l'erreur RPC ; ajouter un test d'intégration d'activation vérifiant trial_ends_at en base.

### data-model-9 — Annulation d'événement : révocation des transferts P2P sur des colonnes inexistantes (ticket_transfers.event_id, updated_at), erreurs avalées et repli sur SUSPENDU

- **Sévérité :** ÉLEVÉE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** CDC §41 Remboursement/annulation, §156
- **Emplacement :** lib/events/event-cancellation.service.ts — lignes L225-237 (schéma : supabase/migrations/20260908_ticket_transfers_p2p.sql L37-60 ; voir aussi L145-164 et L190-208 ; enum : 20260910 L10-15)
- **Catégorie :** cohérence code↔schéma / annulations

**Description.** L'étape 7 exécute `update ticket_transfers set status='CANCELLED', updated_at=… where event_id = … and status='PENDING'`. La table ticket_transfers (20260908) n'a ni colonne event_id ni updated_at : PostgREST renvoie une erreur 42703 qui est avalée par le try/catch (« Table non bloquante si migration différente »). Les transferts PENDING ne sont donc jamais révoqués. Le même service ignore l'échec d'insertion dans event_cancellations (L162-164) et retombe sur status 'SUSPENDU' si l'enum ne contient pas ANNULE (L190-208) alors que la migration 20260910 l'ajoute : un événement annulé peut se retrouver SUSPENDU, statut que le scan et les tableaux de bord traitent différemment (scan L166-186 ; partner-dashboard L241, L476 ne comptent que ANNULE).

**Preuve.** await supabase
    .from('ticket_transfers')
    .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
    .eq('event_id', eventId)      // colonne inexistante
    .eq('status', 'PENDING');
} catch { /* Table non bloquante si migration différente */ }

**Impact.** Des transferts restent PENDING sur des billets annulés (liens de réclamation actifs, incohérence pour l'expéditeur et le destinataire) ; divergence silencieuse entre l'état réel et l'état attendu ; impossibilité de diagnostiquer car l'erreur n'est pas journalisée.

**Recommandation.** Révoquer via jointure : sélectionner les ticket_id de l'événement puis `update ticket_transfers set status='CANCELLED', cancelled_at=now() where ticket_id in (...) and status='PENDING'` (contrainte chk_ticket_transfers_cancelled exige cancelled_at) ; supprimer les try/catch silencieux et les replis (SUSPENDU, table absente) : une migration manquante doit faire échouer le déploiement, pas dégrader le métier ; générer les types Supabase (supabase gen types) pour détecter ces colonnes à la compilation.

### data-model-10 — Seeds contradictoires : referral_config de 0011 contredit le CDC §95-§97 (et seed.sql), tarifs des packs dupliqués entre subscription_plans et platform_settings

- **Sévérité :** ÉLEVÉE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** CDC §95-§97 Taux de parrainage, §26-§27 Packs ; architecture §27
- **Emplacement :** supabase/migrations/0011_referral_codes.sql — lignes L111-126 (seed.sql L41-57 et L9-39 ; config.toml L58-63 ; 0007_superadmin_complete.sql L30-36 ; app/admin/pricing/page.tsx L59, L143 ; lib/payments/payment.service.ts L202)
- **Catégorie :** seed / données de référence

**Description.** 0011 insère STANDARD/CLIENT_TO_CLIENT = 4 %/1,5 %/24 mois et AMBASSADEUR/CLIENT_TO_CLIENT = 7 %/2 %/36 mois avec ON CONFLICT DO UPDATE, en se réclamant du « CDC V3.0 ». Le CDC §95 fixe 5 %/2 %/12 mois pour le client standard et §97 7 %/2 %/24 mois pour l'ambassadeur ; les relations CLIENT_TO_PRESTATAIRE (§96 : 7/2/24 ; §97 : 10/3/36) ne sont pas créées par 0011. seed.sql (L47-57) contient les bonnes valeurs mais n'est appliqué que par `supabase db reset` (config.toml sql_paths), pas par `db push` : la production tourne avec les taux de 0011, le développement local avec ceux du seed. De même, seed.sql définit PREMIUM à 50 000 FCFA/commission 5 (L27-33) tandis que 0007 insère platform_settings.subscription_packs avec premium 75 000 et business 6,5 % ; l'écran admin de tarification modifie subscription_packs (pricing/page.tsx L59, L143) alors que le paiement d'abonnement lit subscription_plans (payment.service L202).

**Preuve.** -- 0011 L113-120
-- STANDARD   CLIENT_TO_CLIENT : N1 = 4 %,  N2 = 1,5 % — durée 24 mois
('STANDARD',    'CLIENT_TO_CLIENT', 4.00, 1.50, 24, TRUE),
-- seed.sql L49
('STANDARD', 'CLIENT_TO_CLIENT', 5.00, 2.00, 12, TRUE),

**Impact.** Commissions calculées en production avec des taux non conformes au CDC et historisés comme tels dans referral_relationships (rate_n1_at_creation) ; parrainage de prestataires impossible faute de configuration ; prix de pack affiché/édité par l'admin différent du prix réellement facturé.

**Recommandation.** Faire des migrations la source unique des données de référence (déplacer les INSERT de seed.sql dans une migration idempotente alignée sur le CDC, supprimer les valeurs divergentes de 0011) ; choisir une seule source pour les packs (subscription_plans) et faire pointer l'écran admin dessus ; ajouter un test de conformité des taux (lecture referral_config vs constantes CDC).

### data-model-11 — Politiques RLS auto-référentes sur user_roles (et users_update_own) : récursion infinie, lecture impossible depuis le client ; contrôle de fraîcheur du middleware neutralisé

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** moyenne
- **Référence CDC :** CDC §152 ; architecture §30
- **Emplacement :** supabase/migrations/20260906_user_roles_multi_role.sql — lignes L36-48 (et L442-449 ; app/login/page.tsx L188-204 ; middleware.ts L181-188)
- **Catégorie :** RLS / robustesse

**Description.** user_roles_select_own et user_roles_admin_manage contiennent une sous-requête sur user_roles elle-même. Lorsqu'un rôle soumis à RLS (authenticated) interroge user_roles, PostgreSQL applique les politiques à la sous-requête, retrouve la même relation en cours de traitement et lève « infinite recursion detected in policy for relation user_roles » (42P17). La même structure existe dans users_update_own (WITH CHECK avec SELECT sur users, dont la politique SELECT contient un sous-SELECT sur partners), sans impact runtime car aucune écriture client n'est faite sur users. Consommateurs réels : la page de connexion lit user_roles avec le client navigateur (L190) et bascule sur users.role en cas d'erreur (L202-204) ; le middleware lit user_roles avec le client anon/SSR (L181-184) « pour fraîcheur » et retombe silencieusement sur les rôles du JWT (L186-188), ce qui annule l'objectif (invalidation après rétrogradation).

**Preuve.** CREATE POLICY "user_roles_select_own" ON user_roles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM user_roles ur   -- auto-référence sous RLS
        WHERE ur.user_id = auth.uid() AND ur.role IN ('ADMIN', 'SUPERADMIN')
    ));

**Impact.** Un contrôleur rétrogradé conserve l'accès /controller tant que son JWT porte l'ancien rôle (jusqu'à expiration/refresh) ; comportements multi-rôles dégradés à la connexion ; erreurs 42P17 masquées dans les logs.

**Recommandation.** Réécrire les politiques avec les fonctions SECURITY DEFINER existantes : `USING (user_id = auth.uid() OR is_admin())` ; pour users_update_own, utiliser une fonction `current_user_role()` SECURITY DEFINER. Ajouter un test exécutant `set role authenticated; select * from user_roles` dans la CI.

### data-model-12 — Les rôles sont synchronisés dans raw_user_meta_data (modifiable par l'utilisateur) et approuvés par le middleware pour /admin, /partner et /scan

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** CDC §152 ; architecture §29
- **Emplacement :** supabase/migrations/20260906_user_roles_multi_role.sql — lignes L126-130 (middleware.ts L36-45, L126, L142-168, L171-176, L210-221 ; components/providers/AuthProvider.tsx L98-102 ; API protégée en DB : lib/auth/session.ts L43-63)
- **Catégorie :** fonctions/triggers / RBAC

**Description.** sync_user_roles_to_jwt écrit `roles`/`role` dans auth.users.raw_user_meta_data, champ que tout utilisateur peut réécrire lui-même via l'API GoTrue (`supabase.auth.updateUser({ data: { roles: ['SUPERADMIN'] } })`) avec la clé anon. Le middleware fonde ses décisions sur user.user_metadata.roles sans relecture base pour /admin et /api/admin (L157-168), /partner (L210-221) et /scan (L171-176) ; AuthProvider privilégie aussi les métadonnées. Les routes API rechargent les rôles via service_role (session.ts), ce qui limite l'impact aux pages/navigations et aux routes sans recheck.

**Preuve.** UPDATE auth.users
SET raw_user_meta_data = v_current
    || jsonb_build_object('roles', to_jsonb(v_roles))
    || jsonb_build_object('role', v_roles[1])   -- user_metadata, pas app_metadata

**Impact.** Accès aux interfaces admin/partenaire/scanner par simple modification de ses propres métadonnées ; les écrans exposent des données via les API seulement si celles-ci ont une vérification propre (vrai pour la plupart, mais la page /scan n'a aucune revérification base).

**Recommandation.** Synchroniser dans raw_app_meta_data (non modifiable par l'utilisateur) et lire user.app_metadata.roles dans le middleware ; ou utiliser le hook custom_access_token pour injecter des claims depuis user_roles. Supprimer le fallback silencieux sur les métadonnées dans AuthProvider.

### data-model-13 — Historisation financière incomplète : les taux de frais ne sont pas conservés dans payments et les tableaux de bord recalculent avec les taux courants

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** CDC §142 Données financières, §75 ; architecture §27
- **Emplacement :** supabase/migrations/0001_initial_schema.sql — lignes L531-535 (lib/payments/payment.service.ts L248-249, L289-307 ; app/api/checkout/route.ts L183-198 ; lib/partner/partner-dashboard.service.ts L219-249)
- **Catégorie :** modèle de données / historisation

**Description.** payments stocke aggregator_fee, service_fee, gross/net revenue et partner_payout_amount mais aucune colonne de taux (service_fee_rate, aggregator_fee_rate, commission_rate_at_transaction) ; le service ne les met pas non plus dans metadata (L296-307). L'architecture §27 impose de conserver les valeurs ayant servi à la transaction. Le tableau de bord partenaire ignore d'ailleurs les montants historisés et recalcule les KPIs billetterie en appliquant les taux actuels de platform_settings au prix facial des billets (L219-249), ce qui est exactement l'anti-pattern décrit.

**Preuve.** const ticketServiceFeeRate = Number(ticketConfigRes.data?.value?.service_fee_rate || 5.0);
const ticketAggregatorFeeRate = Number(ticketConfigRes.data?.value?.aggregator_fee_rate || 1.5);
...
const ticketingCalc = FinancialCalculatorService.calculateTicketingFinancials({ ticketFacialPrice: totalTicketFacialRevenue, serviceFeeRatePercent: ticketServiceFeeRate, ... });

**Impact.** Après un changement de taux par le superadmin, les rapports partenaires/admin divergent des paiements réellement enregistrés ; impossibilité d'auditer un paiement ancien (quel taux s'appliquait) ; non-conformité §27.

**Recommandation.** Ajouter à payments `service_fee_rate NUMERIC(5,2)`, `aggregator_fee_rate NUMERIC(5,2)`, `fee_config_snapshot JSONB` renseignés à la création ; faire reposer les KPIs et exports sur SUM(payments.*) par statut plutôt que sur un recalcul ; interdire la modification de ces colonnes par trigger.

### data-model-14 — REPLICA IDENTITY FULL + publication Realtime sur tickets combinés à tickets_read : diffusion de lignes complètes (qr_code, user_id, totp_secret) à tout contrôleur abonné

- **Sévérité :** MOYENNE — **Vérification :** Vérifié — **Confiance de l'auditeur :** moyenne
- **Référence CDC :** CDC §155 Protection des données, §154
- **Emplacement :** supabase/migrations/20260907_tickets_realtime_replica.sql — lignes L7-15 (déjà 0004_indexes.sql L134, L145 ; 0003_rls.sql L154-159 ; app/controller/scanner/page.tsx L329-338)
- **Catégorie :** realtime / protection des données

**Description.** tickets est publiée dans supabase_realtime avec REPLICA IDENTITY FULL. Realtime filtre les événements postgres_changes selon la RLS SELECT du souscripteur ; or tickets_read accorde is_controller() sans restriction d'événement. Tout détenteur du rôle CONTROLEUR peut ouvrir un canal `postgres_changes` sur tickets (avec ou sans filtre event_id) et recevoir pour chaque UPDATE/DELETE la ligne entière : qr_code statique (suffisant pour la RPC de compostage exposée, cf. constat RPC), user_id, checked_in_by, et totp_secret pour les billets transférés. La page scanner s'abonne effectivement à tickets par event_id (L329-338) et reçoit payload.new complet alors qu'elle n'utilise que status.

**Preuve.** ALTER TABLE public.tickets REPLICA IDENTITY FULL;
...
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;

**Impact.** Fuite continue des identifiants de billets et des porteurs vers n'importe quel compte contrôleur (y compris d'un autre partenaire), exploitable pour le déni d'accès ou le profilage.

**Recommandation.** Restreindre tickets_read aux événements assignés ; préférer Realtime Broadcast depuis le serveur (payload minimal : ticket_id, status) ou une vue/table de comptage dédiée publiée à la place de tickets ; revenir à REPLICA IDENTITY DEFAULT si le filtrage sur colonnes non-clé n'est pas indispensable.

### data-model-15 — Colonne tickets.totp_secret jamais renseignée à l'émission ni lue par les chemins de vérification : la sécurité TOTP repose en réalité sur une dérivation à partir de SUPABASE_SERVICE_ROLE_KEY

- **Sévérité :** MOYENNE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** CDC §39 QR unique, §154 QR sécurisé ; architecture §31
- **Emplacement :** supabase/migrations/20260906_ticket_totp_secret.sql — lignes L6-9 (lib/events/event.service.ts L1169-1178 ; app/api/controller/scan/route.ts L81-96 et L144 ; app/api/tickets/[id]/live-code/route.ts L32-36 et L59 ; app/api/tickets/verify/route.ts L95 ; lib/tickets/ticket-transfer.service.ts L693, L708-713 ; lib/security/totp.ts L17-20)
- **Catégorie :** cohérence code↔schéma / QR dynamique

**Description.** L'hypothèse H1 est confirmée : totp_secret est TEXT nullable sans DEFAULT ; reserveTicketsAtomic n'insère pas la colonne (L1169-1178) ; seul le claim de transfert l'écrit (L708-713). Surtout, aucune des trois routes de vérification/génération ne sélectionne la colonne (scan : liste de colonnes L81-96 sans totp_secret ; live-code : select('id, ticket_number, qr_code, status, user_id, event_id')) : l'expression `(ticket as any).totp_secret || deriveTicketTotpSecret(ticket.id)` tombe donc toujours sur la dérivation HMAC(masterKey, ticket.id) où masterKey = SUPABASE_AUTH_HOOK_SECRET || SUPABASE_SERVICE_ROLE_KEY || constante codée en dur (totp.ts L18). La « rotation du secret » à chaque transfert n'a aucun effet sur la vérification (seul le changement de qr_code révoque l'ancien QR), et les tests qui asservissent totp_secret (tests/ticket-transfer-phase3-claim.test.ts L423-425) valident une propriété inerte.

**Preuve.** const masterKey = process.env.SUPABASE_AUTH_HOOK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '<valeur de repli retirée (lot 1C.6)>';
return crypto.createHmac('sha256', masterKey).update(`ticket_secret_${ticketId}`).digest('hex');

**Impact.** Couplage de la sécurité des QR à la clé service_role (une rotation de clé invalide instantanément tous les QR en circulation ; un environnement sans variables retombe sur un sel public) ; colonne et tests trompeurs pour la maintenance ; divergence entre la conception documentée (secret par billet) et l'implémentation.

**Recommandation.** Trancher : soit rendre totp_secret NOT NULL avec génération à l'émission (reserveTicketsAtomic, claim-free) et le sélectionner explicitement dans scan/verify/live-code, soit supprimer la colonne et dédier une variable TOTP_MASTER_KEY distincte de la clé service_role, sans fallback codé en dur (échec au démarrage si absente).

### data-model-16 — Replis applicatifs « si la colonne/RPC n'existe pas » : compostage sans verrou ni vérification de résultat, hold cart désactivable silencieusement

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** architecture §20-§21 Concurrence
- **Emplacement :** app/api/controller/scan/route.ts — lignes L288-299, L513-527 (lib/events/event.service.ts L1067-1081, L1100-1113, L1139-1146 ; app/api/partner/activation/route.ts L62-66)
- **Catégorie :** cohérence code↔schéma / robustesse

**Description.** Symptôme H5 confirmé : le code suppose que le schéma peut ne pas être migré. Scan L288-299 : si atomic_ticket_checkin « does not exist », UPDATE conditionnel sans lecture du résultat → deux scans concurrents répondent tous deux « succès ». event.service L1067-1081 : hasHeldCol est déduit d'une lecture ; en cas d'erreur (réseau, RLS, typage) il passe à false et la logique de réservation temporaire est désactivée sans journalisation, exposant un overbooking entre hold et confirmation (L1100-1113 n'alimentent plus held_quantity). activation/route.ts L62-66 reproduit la logique SQL en JS avec le même bug d'enum. Ces replis empêchent de détecter une base désynchronisée en production.

**Preuve.** if (lockErr.message.includes('does not exist')) {
    await supabase.from('tickets').update({ status: 'UTILISE', checked_in_at: ..., checked_in_by: user.id })
        .eq('id', ticket.id).eq('status', 'VALIDE');   // résultat ignoré, pas de 409
}

**Impact.** Double compostage accepté, perte de l'anti-overbooking, erreurs de schéma masquées ; coût de maintenance élevé (chaque colonne « optionnelle » double les chemins de code).

**Recommandation.** Supprimer tous les replis : une RPC ou une colonne absente doit produire une erreur 500 explicite et une alerte ; ajouter un contrôle de version de schéma au démarrage (table schema_migrations ou SELECT sur les colonnes attendues) ; utiliser les types générés Supabase pour que la compilation échoue si une colonne manque.

### data-model-17 — Contraintes et FK incohérentes avec le métier : order_id SET NULL transforme un billet impayé en billet valide, shifts supprimés en cascade avec l'événement, pas d'unicité de session OUVERTE, pas de lien catégorie↔événement

- **Sévérité :** MOYENNE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** CDC §40, §84 Rapprochement, §156 ; architecture §21
- **Emplacement :** supabase/migrations/0001_initial_schema.sql — lignes L351-365 (tickets) ; 20260906_controller_shifts.sql L17-18, L36-43 ; app/api/controller/scan/route.ts L241-248 ; lib/shifts/shift.service.ts L302-306, L326-345
- **Catégorie :** modèle de données / intégrité

**Description.** (1) tickets.order_id REFERENCES orders ON DELETE SET NULL (L356) alors que le « cash gate » du scan ne s'applique que si order_id est présent (scan L241-248) : la suppression d'une commande impayée (admin via orders_* ou cascade) rend le billet scannable gratuitement. (2) controller_shifts.event_id ON DELETE CASCADE (20260906 L18) : supprimer un événement efface les Z de caisse, pièces comptables à conserver. (3) Aucun index unique partiel `(controller_id, event_id) WHERE status='OUVERT'` : l'ouverture repose sur un check-then-insert applicatif (shift.service L302-306 puis insert L326+), donc deux ouvertures concurrentes créent deux sessions OUVERT. (4) Aucune contrainte garantissant ticket.category_id ∈ catégories de ticket.event_id (FK composite absente) ni `status='UTILISE' ⇒ checked_in_at/by NOT NULL`. (5) Pas de trigger handle_updated_at sur controller_shifts, event_cancellations, sponsored_promotions (0002 L22-40 ne les couvrent pas).

**Preuve.** order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
...
event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,  -- controller_shifts

**Impact.** Perte de recette (billets réservés impayés devenant valides), perte de pièces comptables, incohérence des sessions de caisse et des rapports Z, données de billets incohérentes non détectables en base.

**Recommandation.** tickets.order_id ON DELETE RESTRICT ; controller_shifts.event_id ON DELETE RESTRICT ; `CREATE UNIQUE INDEX uq_shift_open ON controller_shifts(controller_id, event_id) WHERE status='OUVERT'` ; UNIQUE(id, event_id) sur ticket_categories + FK composite (category_id, event_id) sur tickets ; CHECK (status <> 'UTILISE' OR (checked_in_at IS NOT NULL AND checked_in_by IS NOT NULL)) ; triggers updated_at manquants.

### data-model-18 — Traçabilité partielle : aucun trigger d'audit sur events, tickets, ticket_categories, controller_shifts, event_cancellations ; audit_logs insérable par tout le monde

- **Sévérité :** MOYENNE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** CDC §154 QR historisé, §156 Traçabilité, §134 ; architecture §28
- **Emplacement :** supabase/migrations/0002_functions.sql — lignes L388-393 (compléments : 0005 L89-92, 20260906_user_roles_multi_role.sql L455-457 ; 0003_rls.sql L358-359 ; audit applicatif seulement : lib/events/event.service.ts L349-365, L563-579, L652-661)
- **Catégorie :** audit / traçabilité

**Description.** Les triggers audit_log_changes couvrent payments, refunds, referral_commissions, withdrawals, referral_config, users (rôle/statut), partners et user_roles. Rien sur les tables du parcours événementiel : transitions de statut d'événement (validation, publication, suspension, annulation), modification de prix/quotas de catégories, compostage des billets (checked_in_by), clôture des Z de caisse (declared_cash_total, discrepancy_amount). L'audit n'existe que dans le code applicatif (event.service) et est donc contourné par toute écriture directe autorisée par les politiques FOR ALL. Par ailleurs `audit_logs_insert_system WITH CHECK (TRUE)` (0003 L358-359) permet à anon/authenticated d'insérer des entrées d'audit arbitraires (user_role 'SUPERADMIN', action 'FINANCIAL_OVERRIDE'…), ce qui contredit le caractère « inaltérable » annoncé (0001 L680).

**Preuve.** CREATE POLICY "audit_logs_insert_system" ON audit_logs
    FOR INSERT WITH CHECK (TRUE);

**Impact.** Impossible de prouver qui a publié/suspendu un événement, modifié un prix ou clôturé une caisse en cas de litige ; journal d'audit falsifiable par un tiers.

**Recommandation.** Étendre trg_audit_* à events (UPDATE OF status, is_featured, regisseur_pin_hash), ticket_categories (price, total_quantity, sold_quantity, is_active), tickets (status, user_id, checked_in_by), controller_shifts (status, declared_cash_total) et event_cancellations ; supprimer la politique INSERT publique (les triggers SECURITY DEFINER insèrent sans RLS) ; envisager une table d'événements de scan (tentatives refusées incluses) pour satisfaire « QR historisé ».

### data-model-19 — users_select_policy : tout contrôleur lit l'annuaire complet (téléphone, email) et les profils des propriétaires de partenaires sont lisibles par anon

- **Sévérité :** MOYENNE — **Vérification :** Vérifié — **Confiance de l'auditeur :** haute
- **Référence CDC :** CDC §155 Protection des données, §152
- **Emplacement :** supabase/migrations/0003_rls.sql — lignes L75-81
- **Catégorie :** RLS / protection des données

**Description.** La politique SELECT sur users (sans clause TO) renvoie vrai pour `is_controller()` sans aucune restriction et pour toute ligne liée à un partenaire VALIDE (`EXISTS (SELECT 1 FROM partners WHERE user_id = users.id AND status = 'VALIDE')`), y compris pour le rôle anon. Un contrôleur de n'importe quel partenaire peut donc exporter tous les utilisateurs (`GET /rest/v1/users`) ; un visiteur non authentifié récupère nom, téléphone et email personnels des dirigeants de partenaires.

**Preuve.** CREATE POLICY "users_select_policy" ON users
    FOR SELECT USING (
        id = auth.uid()
        OR is_admin()
        OR is_controller()
        OR EXISTS (SELECT 1 FROM partners WHERE user_id = users.id AND status = 'VALIDE')
    );

**Impact.** Fuite massive de données personnelles (clients et partenaires), exploitable pour du phishing ciblé ; non-conformité aux exigences de protection des données.

**Recommandation.** Restreindre à `id = auth.uid() OR is_admin()` ; servir les informations de porteur nécessaires au scan via la route API (service_role) comme c'est déjà le cas ; exposer les données publiques des partenaires via une vue dédiée (company_name, commercial_name) sans colonnes personnelles.

### data-model-20 — Index : index partiel sur payments.held_expires_at inutile (colonne jamais écrite), recherches par metadata non indexées, index redondants sur colonnes UNIQUE, pas de composite tickets(event_id,status)

- **Sévérité :** FAIBLE — **Vérification :** Non contre-vérifié — **Confiance de l'auditeur :** moyenne
- **Référence CDC :** N/A (qualité) ; architecture §36
- **Emplacement :** supabase/migrations/20260907_ticket_categories_hold_cart.sql — lignes L19-28 (lib/payments/payment.service.ts L296-307, L988-1001 ; app/api/checkout/route.ts L190-198 ; lib/events/event-cancellation.service.ts L270-288 ; 0004_indexes.sql L12-13, L39, L75, L85-86, L95, L98, L110 ; 0011 L131 ; lib/partner/partner-dashboard.service.ts L231 ; app/api/partner/metrics/route.ts L70)
- **Catégorie :** index / performance

**Description.** H2/H8 confirmées : la colonne physique payments.held_expires_at et l'index partiel idx_payments_held_expiration ne servent à rien car les deux parcours de checkout n'écrivent held_expires_at que dans metadata (payment.service L303, checkout L194) ; cleanupExpiredHolds charge tous les paiements PENDING avec select('*') et filtre en JS (L988-1001). L'annulation d'événement cherche les paiements par `metadata @> {event_id}` (L270-288) sans index GIN sur metadata, ni colonne event_id dédiée. Les requêtes chaudes par event_id + status (dashboard partenaire, metrics, cancellation) n'ont que des index mono-colonne. Enfin 0004 crée des index B-tree sur users.phone/email, tickets.qr_code, orders.order_number, payments.transaction_id/external_order_id/idempotency_key, refunds.refund_transaction_id, referral_commissions.idempotency_key et 0011 users.referral_code, tous déjà couverts par une contrainte UNIQUE : doublons qui pénalisent les écritures.

**Preuve.** CREATE INDEX IF NOT EXISTS idx_payments_held_expiration
    ON public.payments(payment_target, status, held_expires_at)
    WHERE status = 'PENDING' AND payment_target = 'TICKET';
-- mais : metadata: { ..., held_expires_at: new Date(Date.now() + 10*60*1000).toISOString(), ... }

**Impact.** Nettoyage des holds et annulations de plus en plus lents avec le volume de paiements (balayages séquentiels), écritures ralenties par des index inutiles, dette de schéma trompeuse.

**Recommandation.** Écrire la colonne held_expires_at (et un event_id/category_id physiques sur payments) à la création ; ajouter `CREATE INDEX ON payments USING gin (metadata jsonb_path_ops)` tant que metadata reste interrogée ; créer tickets(event_id, status) et payments(partner_id, status, created_at) ; supprimer les index redondants listés.

---

Total : 151 constats (21 critiques, 54 élevés, 58 moyens, 18 faibles).