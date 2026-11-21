# Lot 11b — Tables : écrans, plan de salle, fermetures et absences

Branche `lot11b/tables-ecrans`, partie de `main` à `2ec11bb66`. **Non fusionnée.** Migrations `20261129000001` à
`…005`, sans BEGIN ni COMMIT, rejouables, **non appliquées** sur event-village-dev. Le service reste fermé par son
interrupteur (`features.tables_enabled`) ; les suites et l'e2e l'ouvrent le temps de leur passage.

## À lire en premier

### Faille trouvée et corrigée (sécurité)

| # | Faille | Correctif | Preuve |
|---|---|---|---|
| F1 | **Fiche partenaire SUSPENDU (compte ACTIF) : écriture gardée sur les établissements, les tables et leurs réservations.** La garde des fiches (`lib/auth/partner-fiche-guard.ts`, `partnerEventWrite`) couvrait événements, équipe, caisses et salles, pas `/api/partner/venues*` ni `/api/partner/tables*`. Run 522 : une partenaire suspendue a renommé un établissement validé, créé une table, **marqué « absent » un client qui avait payé son acompte (acompte gardé)** et annulé une réservation. En base, `table_reservation_presence` et `table_reservation_cancel` (établissement) ne regardaient que le compte. Gravité : moyenne (il faut une partenaire déjà suspendue). | Garde étendue aux deux préfixes (403 `PARTNER_SUSPENDED`, texte propre aux établissements) ; en base, fiche `VALIDE` exigée pour la présence, l'annulation par l'établissement et toutes les écritures nouvelles (`venue_owner_refusal`, `table_partner_fiche_refusal`). Exception voulue : accepter ou refuser une demande va en base, qui refuse l'acceptation d'une fiche suspendue et **rembourse le client en entier** (correctif T5 du lot 11a gardé). | Rouge run 522 (`e003f640b`, tests seuls) ; vert runs 527 et 531 (`l11b-securite`, 3/3) |

### État des vérifications

Run complet 551 (`89f9de75f`, code du lot complet) : tests, contrôle des lots, build, budgets JS, **captures (787, 0
en échec)**, contrôle responsive (0 défaut) et mesure mobile verts. Un seul rouge : la phase « perf » de l'accueil, le
navigateur fermé sous le test (page non touchée, verte aux trois runs complets précédents). Le run du commit de ce
rapport (ligne RUN_FINAL du § Runs) la rejoue. Les runs 541 à 549 ont trouvé puis fait corriger des défauts
d'accessibilité des écrans du lot (§ Runs).

### À savoir avant tout

- **Interrupteur fermé (décision du 20/11, salles comprises).** Fermé, le service n'a plus de catalogue (recherche,
  fiche), plus de nouvelle réservation, plus de création ni de modification d'établissement ou de salle. Mais tout ce
  qui touche une réservation **existante** reste ouvert : « Mes réservations » et le détail (client), l'espace de
  l'établissement hors édition (liste, planning, détail, recettes) et ses actions (accepter, refuser, présence, annuler,
  paiement sur place), les mêmes pages des salles. Le lien d'une notification ne mène plus jamais à une page
  introuvable. Les gardes ont été déplacées en conséquence (groupes de routes `(catalogue)`, dossiers d'édition).
- **Une table par créneau et par client : par établissement**, comme validé le 18/11 (contre-vérification du lot 11a,
  T2). Une première version l'étendait à tous les établissements : elle cassait cette décision validée et deux suites
  d'audit (run 524) ; retirée. Si le client veut la règle globale, c'est une décision à reprendre (noté dans
  `docs/apres-lancement.md`).
- **Lien court des SMS : `APP_URL/t/<code>`.** Le contrat des SMS interdit raccourcisseur et jeton : le code (7
  caractères, `table_reservations.short_code`) n'est pas un secret, il ne donne accès à rien ; la page exige la session
  et ne mène qu'au client ou à l'établissement de la réservation (sinon 404 sans indice).
- **Rappel 2 h avant** (réglage `tables.reminder_hours` passé de 3 à 2, seulement s'il valait encore 3). Il ouvre la
  réservation avec deux boutons mis en avant, « J'arrive » et « Annuler » (boutons dans la notification push elle-même :
  après le lancement, le service worker est partagé).
- **Le menu n'est pas touché** (coquille commune d'une autre session). Accès : liens des avis ; l'ancienne entrée
  « Restaurants et tables » du menu client mène maintenant à `/tables` (redirection de l'ancienne page) ; lien
  « Établissements à valider » dans la page « Salles à valider ».
- **Défaut de l'e2e trouvé en passant (hors lot, non corrigé)** : les captures et le contrôle responsive « sombre »
  des pages connectées sortent en clair depuis le design 1a, pour tous les lots (cause et correctif proposé à la
  section Captures ; noté dans `docs/apres-lancement.md`).

## Ce que le lot livre

1. **Client** : recherche (`/tables` : ville, texte, genre, date, heure, personnes, « seulement les tables libres »,
   pastilles des créneaux sur chaque carte) ; fiche (`/tables/[id]` : photos glissables, horaires, fermetures à venir,
   règles lues en base, pastilles du jour avec retour immédiat, zone, plan de salle au toucher si montré, devis de la base
   avant de payer si acompte) ; réservation et confirmation animée ; « Mes réservations » et détail (ouverts service
   fermé) : états en mots, comptes à rebours (paiement, réponse, « table gardée jusqu'à … »), annulation avec le montant
   rendu affiché **avant** de confirmer (aperçu calculé en base), remboursements en cours ou versés, « J'arrive ».
2. **Établissement** : création en une fois (fiche, photos réencodées, horaires jour par jour, zones, tables, réglages :
   confirmation automatique ou manuelle, acompte par personne, durée du créneau) et modification, brouillon sur
   l'appareil, envoi et renvoi en validation ; **plan de salle interactif facultatif** (tables et zones déplacées au doigt,
   à la souris et au clavier, rotation, forme, plan montré ou non) ; **planning du jour** relu toutes les 20 s (arrivées,
   « Client arrivé », « Client absent », table libérée, « a confirmé sa venue », nouvelle réservation signalée par une
   vibration ou un bip court **désactivable**) ; **demandes à accepter** avec compte à rebours des 2 h ; **fermetures
   exceptionnelles** avec l'aperçu des réservations touchées et du montant rendu avant de confirmer ; recettes.
3. **Administration** : file de validation des établissements (droit `halls.validate`), fiche de décision ; valider,
   refuser ou suspendre avec motif, réactiver ; téléphone et email de la partenaire seulement avec `partners.read`.
4. **Tâches planifiées** : expiration des acceptations manuelles (2 h), absences (30 min) et rappels (2 h avant) sont
   faites par `table_reservations_tick`, appelée par `/api/cron/tables` : tâche `ev_tables` (toutes les 5 minutes) de
   `supabase/ops/schedule-crons.sql`, que `npm run taches` (`scripts/dev/cron-local.mjs`) relit pour ses fréquences.
   Déjà branchées au lot 11a ; rien à ajouter (vérifié : `schedule-crons.sql` lignes de `ev_tables`, `cron-local.mjs`
   ligne `SCHEDULE_FILE`).
5. **Avis** : chaque avis d'une table mène à la réservation (cloche, push, email : sa page ; SMS : lien court), dit quoi
   faire ensuite, tient en un SMS GSM-7 au pire cas ; règle de nuit de la finition 4 respectée (voir § Avis).

## Décisions prises (à valider par le client si besoin)

| Sujet | Décision | Pourquoi |
|---|---|---|
| Création d'un établissement | En une seule fois, une photo, une plage d'ouverture et une table au moins ; envoyé en validation à la création | L'administration ne valide pas une fiche vide ; une transaction (rien de créé si un champ est refusé, aucun avis envoyé) |
| Établissement refusé puis modifié | Reste refusé jusqu'au bouton « Renvoyer en validation » | Comme les salles (lot 10b) |
| Fermeture et réservations prises | Annulées par l'établissement, remboursées à 100 % (frais compris), motif « Fermeture exceptionnelle : … » envoyé au client | Décision du client ; la confirmation exige que la liste soit celle de l'aperçu (sinon « vérifiez la liste de nouveau ») |
| Pastilles | Toutes les 30 minutes dans les horaires ; le créneau entier (2 h par défaut) doit tenir dans les horaires et hors fermeture | Lisibilité ; la réservation reste possible au quart d'heure |
| Coordonnées du client données à l'établissement | Prénom et initiale ; téléphone seulement pour une réservation qui tient la table (demande, confirmée, arrivée) | Pas de données pour une attente de paiement ou une réservation close |
| « J'arrive » | Possible de 24 h avant l'heure à la fin de la garde de la table ; une fois ; avis à l'établissement | Rappel 2 h avant |
| Nuit | Reportés à 7 h (sauf réservation à moins de 12 h) : confirmation, nouvelle réservation, « le client arrive », décision sur un établissement, rappel. Tout de suite : demande envoyée (réponse sous 2 h), demande à accepter, annulations, refus, absences, remboursements | Règle de la finition 4 ; une demande reportée à 7 h serait périmée |
| Saisie gardée sur l'appareil | Demande particulière du client et choix du signal du planning dans les préférences de l'appareil (`lib/device/device-prefs.ts`), effacées à la déconnexion ; formulaire de l'établissement en brouillon local (comme les salles) ; jour, heure, personnes, table dans l'adresse de la fiche | Audit `cvf2b-6` : toute donnée liée au compte effacée à la déconnexion (run complet 541) |
| « En direct » | Le planning dit « Mis à jour à 14:32 » | Relecture toutes les 20 s, pas d'abonnement temps réel (règle R49 de l'indicateur) ; aucune lecture REST pour l'établissement |

## Avis : textes exacts

Exemples du catalogue (`lib/notifications/catalog.ts`), lien de l'application `https://app.eventvillage.sn` (27
caractères, contrat G3). « Pire cas » : nom de 46 caractères (tronqué), 50 personnes, 30 décembre, montants de
52 500 000 F, chaque origine d'annulation. Tous en GSM-7, un segment (≤ 160).

| Type | Destinataire | Nuit | Cloche (titre — contenu) | SMS (exemple) | Caractères exemple / pire cas |
|---|---|---|---|---|---|
| `TABLE_RESERVATION_CONFIRMED` | client | reporté | **Table réservée** — Votre table chez « Le Grand Bleu » est réservée le sam. 5 déc. 2026 à 20:00 pour 4 personnes. Elle vous est gardée jusqu’à 20 h 30. Acompte payé : 21 000 F CFA. Annulation gratuite avant le sam. 5 déc. 2026 à 18:00. Un empêchement ? Annulez depuis votre réservation pour libérer la table. | Event Village : table chez Le Grand Bleu le 5 déc. à 20:00, 4 pers. Gardée jusqu'à 20 h 30. https://app.eventvillage.sn/t/k7m2p9x | 129 / 140 |
| `TABLE_REQUEST_SENT` | client | tout de suite | **Demande envoyée** — Votre demande de table chez « Le Grand Bleu » le sam. 5 déc. 2026 à 20:00 pour 4 personnes est envoyée. L’établissement répond avant le 5 déc. à 18 h : vous recevrez sa réponse ici. Sans réponse, la demande est annulée et l’acompte vous est rendu, vous n’avez rien à faire. | Event Village : demande envoyée à Le Grand Bleu pour le 5 déc. à 20:00, 4 pers. Réponse avant 5 déc. 18 h. https://app.eventvillage.sn/t/k7m2p9x | 144 / 151 |
| `TABLE_REQUEST_TO_ANSWER` | établissement | tout de suite | **Demande à accepter** — Nouvelle demande chez « Le Grand Bleu » : 4 personnes le sam. 5 déc. 2026 à 20:00, table 12. Répondez avant le 5 déc. à 18 h ; sans réponse, elle est annulée et le client remboursé. | Event Village : demande chez Le Grand Bleu : 4 pers. le 5 déc. à 20:00. Répondez avant 5 déc. 18 h. https://app.eventvillage.sn/t/k7m2p9x | 137 / 144 |
| `TABLE_NEW_RESERVATION` | établissement | reporté | **Nouvelle réservation** — « Le Grand Bleu » : 4 personnes le sam. 5 déc. 2026 à 20:00, table 12. Acompte payé : 21 000 F CFA. Elle est sur votre planning ; la table est gardée jusqu’à 20 h 30. | Event Village : nouvelle réservation chez Le Grand Bleu : 4 pers. le 5 déc. à 20:00, table 12. https://app.eventvillage.sn/t/k7m2p9x | 132 / 142 |
| `TABLE_REQUEST_REFUSED` | client | tout de suite | **Demande refusée** — « Le Grand Bleu » ne peut pas vous recevoir le sam. 5 déc. 2026 à 20:00. Motif : Complet ce soir-là. Vous êtes remboursé de 21 000 F CFA sur votre compte de paiement. Choisissez une autre heure depuis la fiche de l’établissement. | Event Village : Le Grand Bleu ne peut pas vous recevoir le 5 déc. à 20:00. 21 000 F CFA remboursés. https://app.eventvillage.sn/t/k7m2p9x | 137 / 147 |
| `TABLE_REQUEST_EXPIRED` | client | tout de suite | **Demande sans réponse** — « Le Grand Bleu » n’a pas répondu à temps : votre demande le sam. 5 déc. 2026 à 20:00 est annulée. Vous êtes remboursé de 21 000 F CFA sur votre compte de paiement. Vous pouvez réserver ailleurs ou à une autre heure. | Event Village : Le Grand Bleu n'a pas répondu à temps : demande du 5 déc. annulée. 21 000 F CFA remboursés. https://app.eventvillage.sn/t/k7m2p9x | 145 / 155 |
| `TABLE_HOLD_EXPIRED` | client | tout de suite | **Acompte non payé à temps** — L’acompte n’a pas été payé à temps : la table chez « Le Grand Bleu » le sam. 5 déc. 2026 à 20:00 est libérée. Pour la garder, refaites une demande depuis la fiche de l’établissement. | Event Village : acompte non payé à temps : la table chez Le Grand Bleu le 5 déc. à 20:00 est libérée. https://app.eventvillage.sn/t/k7m2p9x | 139 / 145 |
| `TABLE_RESERVATION_CANCELLED` | client | tout de suite | **Réservation annulée** — Votre réservation chez « Le Grand Bleu » le sam. 5 déc. 2026 à 20:00 est annulée par l’établissement. Motif : Fermeture exceptionnelle : travaux dans la salle. Vous êtes remboursé de 21 000 F CFA sur votre compte de paiement. | Event Village : Le Grand Bleu a annulé votre table le 5 déc. à 20:00. 21 000 F CFA remboursés. https://app.eventvillage.sn/t/k7m2p9x | 132 / 160 |
| `TABLE_RESERVATION_CANCELLED_PRO` | établissement | tout de suite | **Réservation annulée** — La réservation chez « Le Grand Bleu » le sam. 5 déc. 2026 à 20:00 (4 personnes) est annulée par le client. Le client récupère 21 000 F CFA. La table est de nouveau libre sur votre planning. | Event Village : table chez Le Grand Bleu le 5 déc. à 20:00 (4 pers.) annulée par le client. Table libre. https://app.eventvillage.sn/t/k7m2p9x | 142 / 153 |
| `TABLE_NO_SHOW` | client | tout de suite | **Absence constatée** — Vous n’êtes pas venu chez « Le Grand Bleu » le sam. 5 déc. 2026 à 20:00 : la table est libérée. Selon les conditions de réservation, l’acompte n’est pas remboursé. Une prochaine fois, annulez depuis votre réservation si vous avez un empêchement. | Event Village : absence constatée chez Le Grand Bleu le 5 déc. à 20:00 : table libérée, acompte non remboursé. https://app.eventvillage.sn/t/k7m2p9x | 148 / 154 |
| `TABLE_PAYMENT_REFUNDED` | client | tout de suite | **Paiement remboursé** — Votre paiement de 21 000 F CFA pour « Le Grand Bleu » est arrivé alors que la réservation n’était plus possible (table reprise, réservation annulée ou déjà payée). Il vous est remboursé sur votre compte Orange Money : vous n’avez rien à faire. | Event Village : paiement de 21 000 F CFA pour Le Grand Bleu non utilisé, remboursé sur Orange Money. https://app.eventvillage.sn/t/k7m2p9x | 138 / 147 |
| `TABLE_REMINDER` | client | reporté | **Votre table vous attend** — Votre table chez « Le Grand Bleu » vous attend le sam. 5 déc. 2026 à 20:00 pour 4 personnes, gardée jusqu’à 20 h 30. Dites-le à l’établissement : « J’arrive » ou « Annuler » depuis votre réservation. | Event Village : votre table chez Le Grand Bleu à 20:00, 4 pers., gardée jusqu'à 20 h 30. J'arrive ou annuler : https://app.eventvillage.sn/t/k7m2p9x | 148 / 154 |
| `TABLE_CLIENT_COMING` | établissement | reporté | **Le client arrive** — Le client de 4 personnes le sam. 5 déc. 2026 à 20:00 (table 12) chez « Le Grand Bleu » confirme sa venue. Table gardée jusqu’à 20 h 30 ; marquez-le « Client arrivé » à son arrivée. | Event Village : le client de 4 pers. à 20:00, table 12, confirme sa venue chez Le Grand Bleu. https://app.eventvillage.sn/t/k7m2p9x | 131 / 140 |
| `TABLE_REFUND_PAID` | client | tout de suite | **Remboursement versé** — Le remboursement de 21 000 F CFA pour votre réservation chez « Le Grand Bleu » le sam. 5 déc. 2026 à 20:00 est versé sur votre compte Orange Money. Vous n’avez rien à faire. | Event Village : remboursement de 21 000 F CFA versé sur Orange Money pour la table chez Le Grand Bleu. https://app.eventvillage.sn/t/k7m2p9x | 140 / 148 |
| `VENUE_VALIDATION_DECIDED` | établissement | reporté | **Établissement refusé** — « Le Grand Bleu » n’est pas accepté. Motif : Photos manquantes. Corrigez-le puis renvoyez-le en validation depuis sa fiche. | Event Village : votre établissement Le Grand Bleu n'est pas accepté. Motif : Photos manquantes. | 95 / 107 |
| `ADMIN_VENUE_SUBMITTED` | administrateurs | tout de suite | **Établissement à valider** — « Le Grand Bleu » (Dakar) attend votre validation. | (SMS groupé des administrateurs) |  |

## Migrations

| Fichier | Contenu |
|---|---|
| `…01_l11b_etablissements` | `venues.photos`, `submitted_at`, `floor_plan_enabled` ; positions du plan (tables, zones) ; `venue_owner_refusal`, `venue_create`, `venue_submit`, `venue_plan_set` ; recopie de `venues_validation_guard` |
| `…02_l11b_fermetures_disponibilites` | `venue_closures` (REST fermée) ; `venue_closed_during`, `venue_closure_parse/_touched/_preview/_create/_delete` ; `table_free_count`, `venue_is_public`, `venue_slots`, `venue_floor`, `venue_search` ; recopies de `table_reserve` et `table_hold_refusal` (refus `VENUE_CLOSED`) |
| `…03_l11b_reservations` | `short_code` (lien court), `client_coming_at` ; `table_partner_fiche_refusal`, `table_cancel_preview`, `table_client_coming`, `table_partner_earnings`, `table_quote` ; recopies de `table_reservation_presence` et `table_reservation_cancel` (F1) |
| `…04_l11b_avis` | types `TABLE_CLIENT_COMING`, `TABLE_REFUND_PAID` ; nuit ; `tables.reminder_hours` 3 → 2 ; recopies de `table_notif_data`, `notif_event_soon`, `notif_cashouts_notify` |
| `…05_l11b_photos_citees` | recopie de `storage_public_citations` : photos des établissements comptées comme citées (run complet 541 : une purge des images non citées aurait pu les effacer) |

Chaque recopie part de la **dernière** définition (fichier et lignes cités en tête de migration) ; le test
`migration-lot11b-rejouable` vérifie qu'aucune ligne n'est perdue (lignes remplacées listées une à une : seulement
`venues_validation_guard`, le retour automatique en attente) et que chaque migration se rejoue deux fois. Toutes les
fonctions nouvelles sont fermées à `anon` et `authenticated` (`fonctions-privileges`, `r3-fonctions-rpc`).

### Contrôles prévus sur event-village-dev

```sql
-- Avant : dernière migration appliquée de main ; rien du lot
select max(version) from supabase_migrations.schema_migrations;                                   -- 20261127000001 (ou plus récent de main)
select count(*) from pg_proc where pronamespace = 'public'::regnamespace
   and proname in ('venue_create','venue_slots','venue_closure_create','table_client_coming'); -- 0
select to_regclass('public.venue_closures');                                                       -- null
select key, value from public.platform_settings where key = 'tables.reminder_hours';              -- {"value": 3}

-- Après
select version from supabase_migrations.schema_migrations where version like '20261129%' order by 1; -- 5 versions
select p.proname, has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('authenticated', p.oid, 'execute') u
  from pg_proc p where p.pronamespace = 'public'::regnamespace
   and p.proname in ('venue_owner_refusal','venue_create','venue_submit','venue_plan_set','venue_closed_during','table_free_count',
                     'venue_closure_parse','venue_closure_touched','venue_closure_preview','venue_closure_create','venue_closure_delete',
                     'venue_is_public','venue_slots','venue_floor','venue_search','table_short_code','table_partner_fiche_refusal',
                     'table_cancel_preview','table_client_coming','table_partner_earnings','table_quote') order by 1; -- 21 lignes, false, false
select relrowsecurity, has_table_privilege('anon','public.venue_closures','select'),
       has_table_privilege('authenticated','public.venue_closures','select')
  from pg_class where oid = 'public.venue_closures'::regclass;                                    -- true, false, false
select count(*) filter (where short_code is null), count(*) from public.table_reservations;      -- 0, n
select type, channels, night_policy from public.notification_types
 where type in ('TABLE_CLIENT_COMING','TABLE_REFUND_PAID','TABLE_RESERVATION_CONFIRMED','TABLE_NEW_RESERVATION',
                'VENUE_VALIDATION_DECIDED','TABLE_REMINDER','TABLE_REQUEST_SENT') order by 1;    -- DEFER sauf REFUND_PAID et REQUEST_SENT
select key, value from public.platform_settings where key = 'tables.reminder_hours';              -- {"value": 2}
select pg_get_functiondef('public.storage_public_citations()'::regprocedure) like '%public.venues ve, unnest(ve.photos)%'; -- true
```

Puis `03-verification.sql`. Aucune tâche planifiée nouvelle (`ev_tables` existe depuis le lot 11a).

## Tests

Ajoutés : `l11b-securite` (F1, rouge puis vert), `l11b-tables` (13 tests : création en une fois et refus, renvoi,
plan de salle et plan public, fermetures, plage horaire et recherche, aperçu d'annulation = remboursement réel,
« J'arrive », lien court, planning, administration, service fermé, nuit), `migration-lot11b-rejouable`.

### Tests existants modifiés (signalés)

| Test | Modification | Pourquoi |
|---|---|---|
| `l11b-securite` (le mien, avant correctif) | chaque sous-test prépare ses réservations ; tables comptées après la préparation | run 522 : les sous-tests 2 et 3 échouaient par effet du 1er ; run 524 : compte fait trop tôt |
| `l11a-tables` | réglage `tables.reminder_hours` attendu 2 ; création par la route avec photo et table ; fiche SUSPENDU refusée par la garde (403 `PARTNER_SUSPENDED`) ; avis `TABLE_REFUND_PAID` attendu | décision du client ; création en une fois ; F1 ; avis nouveau |
| `l11a-annulation` | rappel 2 h avant (début dans 90 à 105 min) | décision du client |
| `f2acv-ecritures-fiche` | écritures des établissements et des tables retirées des écritures « gardées » | F1 |
| `interrupteurs` | lectures partenaire et actions sur une réservation existante retirées des gestionnaires coupés ; écritures nouvelles ajoutées ; recherche et fiche publiques ajoutées ; chemins des gardes déplacées | décision du 20/11 |
| `l10b-salles` | service fermé : réservations et recettes de la propriétaire attendues ouvertes (200) | décision du 20/11 |
| `notif-modeles`, `notif-outbox`, `notif-migration`, `l11a-textes` | liens vers la réservation, textes exacts des SMS (lien court), deux types, émetteurs, données (code court, heure de garde) | ajout de l'utilisateur en cours de lot |
| `tests/helpers/design-files.ts` | 71 écrans des tables ; chemins des pages des salles déplacées | système de design |
| `e2e/*` | verrou des services (salles et tables), champ `salles` → `services` (aucune assertion changée), pages et captures des tables, graine v6 | contrôle responsive et captures |
| `f2acv-stockage-cite` | `venues.photos` ajoutée à l'inventaire des colonnes lues par la purge | migration 05 (run complet 541) |
| `migration-d1d-vitrine-rejouable` | « aucune migration après la vitrine » devient « aucune migration postérieure ne redéfinit ses fonctions » | migrations 20261129… (run complet 541) |
| `l10b-routes` | GET des réservations, d'une réservation et des recettes de la propriétaire sans interrupteur | décision du 20/11 (run complet 541) |
| `docs/recette-billetterie.md` | A37 : chemins déplacés ; lignes citées recalées (`interrupteurs.test.ts:391`, `notif-modeles.test.ts:556`) | contrôle `recette-matrice` |

Aucun test changé pour les échecs d'accessibilité des captures (runs 541 et 547) : ce sont les écrans qui ont été
corrigés (`8e79b577f`). Les mots visibles d'un bouton se suivent maintenant dans son nom accessible (WCAG 2.5.3 :
« Copier sur tous les jours les horaires du lundi », « Placer sur le plan la table 3 », « Table 3, 4 places, à partir de
2 », jours de la fiche lus « Auj. 21 nov, aujourd'hui, samedi 21 novembre ») et la galerie de photos se fait défiler au
clavier.

Aucune assertion des suites `tests/audit/` ni `tests/audit-auth/` n'a changé (runs 524, 527 : `cv11a-1` à `-5`,
`cv10b-1` à `-3` verts).

## Runs

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 522 | `e003f640b` | rapide, tests seuls | **rouge voulu** (F1) : 0/3 — fiche SUSPENDU : établissement renommé, table créée, client payant marqué absent, réservation annulée (HTTP 200 partout) |
| 524 | `9ac1f6851` | rapide, 16 suites | SQL des 4 migrations appliqué et rejoué (`migration-lot11b-rejouable` vert) ; rouges : règle « une table par créneau » étendue à tous les établissements (contredit T2 validé : `l11a-cv` T2, audit `cv11a-2`, `l11a-tables` B), correctif T5 court-circuité par la garde, création d'établissement par une fiche suspendue (403 au lieu de 400, attendu), mon test F1 (tables comptées trop tôt) |
| 527 | `571f5b4e6` | rapide, 27 suites | 25/27 : `l11b-tables` 13/13, `l11b-securite` 3/3 (**F1 corrigée**), audits `cv10b-*` et `cv11a-*` verts ; rouges : `l10b-salles` (lectures de la propriétaire service fermé, décision du 20/11), `notif-modeles` (donnée facultative de l'avis de confirmation) |
| 531 | `b4765039a` | rapide, 10 suites | **vert** : écrans au registre du système de design (761/761), interrupteurs, salles, sécurité, tables, avis, recette |
| 534 | `1f0f05134` | rapide + contrôle responsive | tests verts ; responsive : 44 défauts (noms des zones sous les numéros des tables, bande des jours du planning) |
| 538 | `3c9bba210` | rapide + contrôle responsive | 18 défauts restants (défilement horizontal du planning : texte sr-only du 14e jour) |
| 539 | `69f8f02a1` | rapide + contrôle responsive | **vert : 0 défaut** sur 184 pages × thème (17 pages des tables comprises), 836 contrôles |
| 541 | `f15e70d09` | **complet** | tests : 4 suites rouges sur le lot (audit `cvf2b-6` : deux écritures du stockage web non classées ; `f2acv-stockage-cite` : `venues.photos` non lue par la purge ; `l10b-routes` et `migration-d1d-vitrine-rejouable` à aligner) ; build, budgets JS et contrôle responsive verts ; **e2e rouge : phase « captures », 20 échecs** (les mêmes qu'au run 547, vus seulement à sa lecture : une première version de ce rapport disait à tort les captures vertes) ; mesure mobile : seule Mes billets 89 (page non touchée, non bloquante) |
| 545 | `308864a6c` | rapide, 8 suites | **vert** : correctifs du run 541 (audit `cvf2b-6` 15/15, assertions inchangées) |
| 547 | `c344e287e` | **complet** | tests **566/566** (142 + 141 + 141 + 142), contrôle des lots, build, budgets JS, contrôle responsive (0 défaut) verts ; **e2e rouge : phase « captures », 20 échecs** = 5 écrans × téléphone et ordinateur × clair et sombre (`tables-fiche`, `tables-fiche-plan`, `org-tables-creation`, `org-tables-modification`, `org-tables-plan`), toutes les autres phases vertes. Cause : contrôles axe-core des captures, `label-content-name-mismatch` (7 à 22 nœuds : bande des jours de la fiche, « Copier sur tous les jours » des horaires, tables du plan) et `scrollable-region-focusable` (galerie de photos) ; mesure mobile : seule Mes billets 86 (non bloquante) |
| 549 | `8e79b577f` | **complet** | tests, contrôle des lots, build, budgets JS, responsive verts ; e2e : fiche, création et modification corrigées ; **restent 8 échecs** (`tables-fiche-plan`, `org-tables-plan` × 4 vues, 8 nœuds = les 8 tables du plan) : axe-core assemble le texte visible des enfants sans séparateur, « 1 » et « 4 » donnaient « 14 », absent du nom « Table 1, 4 places » ; mesure mobile : seule la fiche événement « ce soir » à 89 (médiane [93 ; 93 ; 89 ; 89 ; 85], page non touchée par le lot, écart d'un point d'une mesure à l'autre) |
| 551 | `89f9de75f` | **complet** | tests, contrôle des lots, build, budgets JS verts ; **captures vertes** (787 captures, 0 en échec ; les 19 écrans du lot dans les 4 vues) ; contrôle responsive 0 défaut (184 pages × thème) ; **mesure mobile verte** (« tous les seuils sont tenus ») ; e2e rouge sur une seule phase, « perf », test de l'accueil : le navigateur s'est fermé sous le test au 4e passage (« Target page, context or browser has been closed », 16 s), les 3 premiers passages normaux (FCP 1,64 s) ; page non touchée par le lot, phase verte aux runs 541, 547 et 549 ; les 3 autres pages de la phase vertes |
| RUN_FINAL |

Journaux bruts : branche `ci-results`, dossiers `runs/<numéro>-<identifiant>/`.

## Captures

Branche `ci-results`, dossier `runs/551-44894506687/captures/`, fichiers `<écran>__<mobile|ordinateur>__<clair|sombre>.png`
(chaque capture passe aussi les contrôles axe-core WCAG 2.2 AA). Le contrôle responsive (6 largeurs, clair et sombre)
a ses propres captures dans `captures-responsive/`.

| Espace | Écrans |
|---|---|
| Client | `tables-recherche` (recherche et pastilles), `tables-fiche` (pastilles du jour, devis à acompte), `tables-fiche-plan` (plan de salle au créneau choisi), `tables-confirmation`, `tables-mes-reservations`, `tables-ma-reservation`, `tables-ma-reservation-rappel` (« J'arrive » et « Annuler » mis en avant) |
| Établissement | `org-tables-liste`, `org-tables-planning` (planning du jour, demande en tête avec « Répondez avant … »), `org-tables-demande`, `org-tables-detail`, `org-tables-creation`, `org-tables-modification`, `org-tables-plan` (plan de salle en édition), `org-tables-fermetures`, `org-tables-fermeture-apercu` (réservations touchées et montant rendu), `org-tables-recettes` |
| Administration | `adm-etablissements-liste`, `adm-etablissements-fiche` (fiche de décision) |

**Défaut de l'outillage e2e (hors lot) : les variantes « sombre » des pages connectées sortent en clair**, dans les
captures comme dans le contrôle responsive, pour tous les lots. Cause : `e2e/auth.setup.ts:55` connecte les comptes
en thème clair ; `ThemeProvider` recopie ce choix dans le cookie `ev-theme=light`, que `context.storageState` (ligne 67)
enregistre avec la session ; ensuite le cookie l'emporte sur `localStorage['ev-theme']` posé par
`e2e/support/fixtures.ts` (ordre de `THEME_BOOT_SCRIPT`, `lib/theme.ts`). Le défaut date du cookie de thème (design
1a, `cebf1dd1f`, 17/11). Les pages sans compte (accueil, recherche anonyme) sortent bien en sombre. Non corrigé ici :
le correctif (poser aussi le cookie dans `prepareContext`, ou le retirer de l'état de connexion) change toutes les
captures et tous les contrôles des autres lots ; il revient à la session du design (couleurs). Les écrans de ce lot
n'utilisent que les jetons du design (contrat Q vert), donc rien de propre au lot n'est attendu en sombre, mais ce
n'est pas prouvé par une capture.

## Essais pour un non-développeur

Sur un projet de test, interrupteur « Réservation de tables » ouvert par le Superadmin (Administration → Services).

1. **Créer un établissement** (compte partenaire validé) : Espace partenaire → Tables → « Ajouter un établissement ».
   Remplir le nom, l'adresse, une photo, les horaires (« copier sur tous les jours »), deux tables. « Envoyer en
   validation ». Attendu : l'établissement apparaît « En attente de validation ».
2. **Valider** (administrateur avec « Valider les salles et les établissements ») : Salles à valider → « Établissements à
   valider » → ouvrir la fiche → « Valider ». Attendu : la partenaire reçoit « Établissement validé ».
3. **Plan de salle** : fiche de l'établissement → « Plan de salle » → faire glisser les tables au doigt, cocher
   « Montrer le plan aux clients », « Enregistrer ».
4. **Réserver** (compte client) : `/tables` → choisir l'établissement → personnes, jour, toucher une pastille, choisir une
   table sur le plan → « Réserver ». Attendu : coche animée, « Table gardée jusqu'à … » ; SMS avec un lien court qui
   ouvre la réservation.
5. **Planning** (partenaire) : la réservation arrive sur le planning du jour, avec un petit signal (désactivable). À
   l'heure : « Client arrivé ».
6. **Acceptation manuelle** : régler l'établissement sur « Acceptation manuelle », réserver de nouveau. Attendu : côté
   établissement, la demande en tête avec « Répondez avant … · reste … » ; sans réponse en 2 h, la demande est annulée et
   le client prévenu.
7. **Fermeture exceptionnelle** : fiche → « Fermetures » → un jour qui a une réservation → « Voir les réservations
   touchées » (liste et montant rendu) → « Confirmer la fermeture ». Attendu : la réservation est annulée, le client
   prévenu avec le motif ; le jour n'est plus réservable.
8. **Annuler** (client) : Mes réservations → la réservation → « Annuler » : le montant rendu s'affiche avant de confirmer.
9. **Service fermé** : refermer l'interrupteur. Attendu : `/tables` introuvable ; « Mes réservations », le détail et le
   planning de l'établissement restent ouverts ; le lien d'un SMS reçu ouvre toujours la réservation.

## Points ouverts

Dans `docs/apres-lancement.md`, section « Tables : écrans, plan de salle, fermetures (lot 11b) » : entrées de menu
(coquille), avis à l'administration quand un établissement validé change, correction d'une absence marquée par erreur,
règle « une table par créneau » globale à trancher, tri par distance et carte, calcul groupé des créneaux de la
recherche, temps réel de la base pour le planning, valeur d'origine du réglage du rappel, boutons dans la notification
push du rappel.
