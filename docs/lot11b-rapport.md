# Lot 11b — Tables : écrans, plan de salle, fermetures et absences

Branche `lot11b/tables-ecrans`, partie de `main` à `2ec11bb66`. **Fusionnée dans main** (`4198965e4`, 21/11 ; run
complet de main 579 vert sur `30019290e`). Migrations `20261129000001` à `…010` (dont `…006` à `…010` : correctifs de
la contre-vérification), sans BEGIN ni COMMIT, rejouables, **appliquées sur event-village-dev le 21/11** (dry-run
exact, contrôles avant et après conformes, `03-verification` 20/20 : section « Application sur event-village-dev »).
Event-village-dev ne doit plus tourner qu'avec le code de main ≥ `4198965e4`. Le service reste fermé par son
interrupteur (`features.tables_enabled`) ; les suites et l'e2e l'ouvrent le temps de leur passage.

## À lire en premier

### Correctifs de la contre-vérification (`docs/audit-lot11b.md`, branche `lot11b/cv-rouges` 8d178c84c)

Branche de la contre-vérification récupérée en avance rapide (ses suites `tests/audit/cv11b-*` sont dans la branche).
Aucun trou critique ni élevé ; tous corrigés, un commit chacun. **T8 vaut pour toute l'application.**

| # | Trou (gravité) | Correctif | Commit |
|---|---|---|---|
| T1 | Fermeture confirmée sur le seul **nombre** de réservations : une réservation prise entre l'aperçu et la confirmation, jamais montrée, était annulée (moyenne) | Migration 06 : l'aperçu rend l'**empreinte** de sa liste (md5 des identifiants triés et des montants rendus) ; la confirmation la renvoie (`expected_hash`) ; la base la recalcule **sous le verrou** de l'établissement : `PREVIEW_CHANGED` sinon, avec la nouvelle liste, que l'écran remontre avant une nouvelle confirmation. Sans empreinte, seul un aperçu **vide** se confirme (`PREVIEW_REQUIRED`). | `a705f93a2` |
| T2 | « Client absent » accepté 5 min après l'heure, acompte gardé, alors que les avis promettent la table « gardée jusqu'à » l'heure + 30 min (moyenne) | Migration 07 (recopie de `table_reservation_presence`) : `TOO_EARLY` tant que l'heure + `tables.no_show_minutes` n'est pas passée (« La table est gardée jusqu'à 20 h 30 : vous pourrez marquer le client absent à partir de cette heure. ») ; bouton « Client absent » (détail et planning en direct) seulement ensuite. | `25331e6af` |
| T3 | Aperçu « vous récupérez 21 000 F », l'heure gratuite passe pendant la lecture : annulation avec 0 F rendu sans nouvelle confirmation (faible) | Migration 07 (recopie de `table_reservation_cancel`) : l'écran envoie le montant de l'aperçu (`expected_refund`) ; s'il a changé, `PREVIEW_CHANGED` avec le nouveau montant, rien n'est annulé ; l'écran relit l'aperçu et redemande la confirmation (« Le montant rendu a changé »). | `25331e6af` |
| T4 | Téléphone d'un client « arrivé » donné 3 jours après son créneau (faible) | Contact seulement pour une demande à accepter, une réservation confirmée, ou un client arrivé **avant la fin de son créneau** (`lib/tables/queries.ts`). | `c77f436af` |
| T5 | Demande particulière laissée sur l'appareil quand la session se ferme à l'insu du navigateur (faible) | La purge des données du compte (page chargée sans session) retire aussi les clés `table-demande:` ; les recherches récentes d'un visiteur restent. | `e0dcb484e` |
| T6 | Établissement non public et ses tables lus par sa propriétaire par la REST (faible) | Migration 09 : `venues_read`, `restaurant_zones_read`, `restaurant_tables_read`, `venue_opening_hours_read` : public ou administration (plus `is_partner_owner`). Colonnes de `venues` lisibles par `anon` et `authenticated` réduites à la fiche publique (plus `validated_by`, `validated_at`, `validation_reason`, `submitted_at`, `created_at`, `updated_at`). | `c87fde2ed` |
| T7 | Plan de salle refusé mais à moitié enregistré (faible) | Migration 08 (recopie de `venue_plan_set`) : tables et zones vérifiées **avant** la première écriture ; écritures dans un bloc annulé en entier par tout refus (le refus « placez au moins une table » gardait lui aussi des positions). | `7c4955bfb` |
| T8 | **Paiements des clients** (numéro du payeur, compte, montant, état) et remboursements lus par la partenaire par la REST — billets, salles, tables (moyenne, antérieur au lot) | Migration 10 : `payments_read` et `refunds_read` limitées **au client et à l'administration**, pour toute l'application (et les commandes à venir). Vérifié avant : aucune lecture de `payments` ni de `refunds` hors des routes serveur, aucune fonction non `SECURITY DEFINER` qui les lise. Nouveau test `tests/security/l11b-cv-paiements-partenaire` : billet, salle, table payée, table annulée → la partenaire ne lit rien par la REST, le client lit les siens, recettes justes par les routes serveur. | `e49d27e87` |
| SMS | Annulation par Event Village à 160 caractères pile au pire cas | « nous avons annulé la table chez … » : **154** au pire cas ; nouveau test `l11b-cv-sms-marge` : tous les SMS des tables à 155 au plus. | `809a1d28e` |

### Faille trouvée et corrigée (sécurité)

| # | Faille | Correctif | Preuve |
|---|---|---|---|
| F1 | **Fiche partenaire SUSPENDU (compte ACTIF) : écriture gardée sur les établissements, les tables et leurs réservations.** La garde des fiches (`lib/auth/partner-fiche-guard.ts`, `partnerEventWrite`) couvrait événements, équipe, caisses et salles, pas `/api/partner/venues*` ni `/api/partner/tables*`. Run 522 : une partenaire suspendue a renommé un établissement validé, créé une table, **marqué « absent » un client qui avait payé son acompte (acompte gardé)** et annulé une réservation. En base, `table_reservation_presence` et `table_reservation_cancel` (établissement) ne regardaient que le compte. Gravité : moyenne (il faut une partenaire déjà suspendue). | Garde étendue aux deux préfixes (403 `PARTNER_SUSPENDED`, texte propre aux établissements) ; en base, fiche `VALIDE` exigée pour la présence, l'annulation par l'établissement et toutes les écritures nouvelles (`venue_owner_refusal`, `table_partner_fiche_refusal`). Exception voulue : accepter ou refuser une demande va en base, qui refuse l'acceptation d'une fiche suspendue et **rembourse le client en entier** (correctif T5 du lot 11a gardé). | Rouge run 522 (`e003f640b`, tests seuls) ; vert runs 527 et 531 (`l11b-securite`, 3/3) |

### État des vérifications

**État final (21/11)** : correctifs de la contre-vérification compris et main (design 1e) fusionnée, run complet 577
de la branche puis run complet 579 de main **entièrement verts** (578/578, e2e 787 captures, mesure mobile au seuil
bloquant de 90 : 94, 93, 92, responsive 0 défaut) ; fusion dans main `4198965e4` ; migrations appliquées sur
event-village-dev, `03-verification` 20/20 (section « Application sur event-village-dev »). Historique ci-dessous.

**Run complet 556** (avant la contre-vérification) (`7fb2253af`, état final de la branche) : tests **566/566**, contrôle des lots, build,
budgets JS, **les 12 phases de l'e2e** (captures 787, 0 en échec ; perf, fumée, recette…) et contrôle responsive (0
défaut) **verts**. Seul rouge : la mesure mobile Lighthouse, sur deux pages que le lot ne touche pas : Mes billets 84
(non bloquant par consigne) et la fiche événement « ce soir » 86 (passages [86 ; 94 ; 81 ; 89 ; 85], écart de 13
points d'un passage à l'autre). Au run 551, même code des écrans, **tous les seuils étaient tenus** ; au run 549, la
même fiche était à 89. Écart de mesure du serveur de CI, pas du lot : à relancer (job « build · js-budget · e2e ») si
une preuve verte est voulue. Les runs 541 à 551 ont trouvé puis fait corriger des défauts d'accessibilité des écrans du
lot (§ Runs).

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
  des pages connectées sortent en clair depuis le design 1a, pour tous les lots. Le design 1e ne l'a contourné que pour
  ses propres captures (`e2e/design1e-captures.responsive.spec.ts:52-55`) ; `e2e/captures.spec.ts` et le contrôle
  responsive restent concernés (cause et correctif proposé à la section Captures ; noté dans `docs/apres-lancement.md`).

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

Annulation par Event Village (`TABLE_RESERVATION_CANCELLED`, origine `EVENT_VILLAGE`), raccourcie après la
contre-vérification (160 caractères pile au pire cas) : « Event Village : nous avons annulé la table chez Le Grand Bleu
le 5 déc. à 20:00. 21 000 F CFA remboursés. https://app.eventvillage.sn/t/k7m2p9x », **154** au pire cas. Tous les SMS
des tables tiennent en 155 caractères au plus (test `l11b-cv-sms-marge`).

## Migrations

| Fichier | Contenu |
|---|---|
| `…01_l11b_etablissements` | `venues.photos`, `submitted_at`, `floor_plan_enabled` ; positions du plan (tables, zones) ; `venue_owner_refusal`, `venue_create`, `venue_submit`, `venue_plan_set` ; recopie de `venues_validation_guard` |
| `…02_l11b_fermetures_disponibilites` | `venue_closures` (REST fermée) ; `venue_closed_during`, `venue_closure_parse/_touched/_preview/_create/_delete` ; `table_free_count`, `venue_is_public`, `venue_slots`, `venue_floor`, `venue_search` ; recopies de `table_reserve` et `table_hold_refusal` (refus `VENUE_CLOSED`) |
| `…03_l11b_reservations` | `short_code` (lien court), `client_coming_at` ; `table_partner_fiche_refusal`, `table_cancel_preview`, `table_client_coming`, `table_partner_earnings`, `table_quote` ; recopies de `table_reservation_presence` et `table_reservation_cancel` (F1) |
| `…04_l11b_avis` | types `TABLE_CLIENT_COMING`, `TABLE_REFUND_PAID` ; nuit ; `tables.reminder_hours` 3 → 2 ; recopies de `table_notif_data`, `notif_event_soon`, `notif_cashouts_notify` |
| `…05_l11b_photos_citees` | recopie de `storage_public_citations` : photos des établissements comptées comme citées (run complet 541 : une purge des images non citées aurait pu les effacer) |
| `…06_l11b_cv_fermeture_empreinte` | CV T1 : `venue_closure_fingerprint` ; recopies de `venue_closure_preview` (empreinte rendue) et `venue_closure_create` (empreinte exigée et recalculée sous le verrou) |
| `…07_l11b_cv_absence_annulation` | CV T2 et T3 : recopies de `table_reservation_presence` (absence après la garde) et `table_reservation_cancel` (montant de l'aperçu vérifié) ; contrôles ajoutés seulement, aucune ligne recopiée retirée |
| `…08_l11b_cv_plan_tout_ou_rien` | CV T7 : recopie de `venue_plan_set` (vérification complète, écritures annulées ensemble au moindre refus) |
| `…09_l11b_cv_lectures_etablissements` | CV T6 : règles de lecture de `venues`, `restaurant_zones`, `restaurant_tables`, `venue_opening_hours` sans la propriétaire ; colonnes publiques de `venues` |
| `…10_l11b_cv_paiements_lecture` | CV T8 : `payments_read` et `refunds_read` : le client ou l'administration (toute l'application) |

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

-- Correctifs de la contre-vérification (migrations 06 à 10)
select count(*) from supabase_migrations.schema_migrations where version like '20261129%';        -- 10
select has_function_privilege('anon', 'public.venue_closure_fingerprint(jsonb)', 'execute'),
       has_function_privilege('authenticated', 'public.venue_closure_fingerprint(jsonb)', 'execute'); -- false, false
select pg_get_functiondef('public.venue_closure_create(jsonb)'::regprocedure) like '%expected_hash%';  -- true
select pg_get_functiondef('public.table_reservation_presence(jsonb)'::regprocedure) like '%tables.no_show_minutes%'; -- true
select pg_get_functiondef('public.table_reservation_cancel(jsonb)'::regprocedure) like '%expected_refund%';         -- true
select tablename, policyname, qual from pg_policies where schemaname = 'public'
   and policyname in ('payments_read','refunds_read','venues_read','restaurant_zones_read','restaurant_tables_read','venue_opening_hours_read')
 order by 1;                                                                     -- 6 lignes, aucune ne contient is_partner_owner
select has_column_privilege('anon','public.venues','validated_by','select'),
       has_column_privilege('authenticated','public.venues','validation_reason','select'),
       has_column_privilege('anon','public.venues','name','select');                                -- false, false, true
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

**Correctifs de la contre-vérification** (entrées seulement, aucune assertion changée) :

| Test | Modification | Pourquoi |
|---|---|---|
| `tests/audit/cv11b-2-gardes` G6a, G6b, G6c (suite de la contre-vérification) | chaque fermeture est précédée de son aperçu et confirmée avec l'empreinte de cet aperçu (`expected_hash`) ; G6a : un aperçu par période | T1 : sans empreinte, un aperçu non vide ne se confirme plus ; les assertions (une seule fermeture, un seul remboursement de 21 000, attente annulée puis rendue) sont inchangées |
| `l11b-tables` § 3 | confirmation avec l'empreinte ; ajout : sans empreinte → `400 PREVIEW_REQUIRED`, empreinte de 32 caractères rendue par l'aperçu | T1 |
| `l11a-annulation` C5 et `l11b-securite` (garde-fou fiche VALIDE) | « Client absent » marqué 31 minutes après l'heure au lieu de 5 et 10 | T2 : absence seulement après la garde de 30 minutes |
| `tests/security/r31-tables-lecture` (lot 10b) — **assertions changées, décision du chef de projet (T6 de cv11b)** | sous-tests 2 et 3 : la propriétaire ne lit plus par la REST que son établissement et ses tables validés et publics (en attente ou refusés : 0 ligne ; zones et horaires de même) au lieu de tous les siens ; ajout : par les routes serveur, elle voit toujours ses établissements en attente et refusés, leurs tables et zones (`GET /api/partner/venues`, `GET /api/partner/venues/[id]`), une autre partenaire reçoit 404 | run complet 575 : seule suite rouge, elle exigeait l'inverse de T6 |
| `migration-lot11b-rejouable` | migrations 06 à 10 ajoutées ; recopies `venue_closure_preview`, `venue_closure_create`, `table_reservation_presence`, `table_reservation_cancel`, `venue_plan_set` contrôlées, lignes remplacées listées | migrations nouvelles |

Ajoutés : `tests/security/l11b-cv-paiements-partenaire` (T8, toute l'application), `tests/schema/l11b-cv-sms-marge`
(5 caractères de marge). Les suites `tests/audit/cv11b-1-trous`, `cv11b-2-gardes`, `cv11b-3-statique` doivent passer
au vert sans changer leurs assertions (§ Runs).

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
| 556 | `7fb2253af` | **complet (final)** | tests **566/566** (142 + 141 + 141 + 142), contrôle des lots, build, budgets JS, contrôle responsive (0 défaut, 184 pages × thème) verts ; **e2e : les 12 phases vertes** (787 captures, 0 en échec ; perf de l'accueil de nouveau verte) ; mesure mobile hors seuil sur deux pages non touchées : Mes billets 84 (non bloquant) et fiche événement « ce soir » 86 [86 ; 94 ; 81 ; 89 ; 85] (verte au run 551 sur le même code des écrans) |
| 569 | `265e774cc` | rapide, 25 suites (correctifs de la contre-vérification) | **vert : 25/25**, typecheck et lint verts. `cv11b-1-trous` **7/7** (avant : 0/7) : T1 `400 PREVIEW_REQUIRED`, B reste `CONFIRMEE` ; T2 `409 TOO_EARLY` « La table est gardée jusqu’à 16 h 04 : vous pourrez marquer le client absent à partir de cette heure. », bouton absent caché ; T3 `409 PREVIEW_CHANGED` (nouveau montant 0), rien annulé ; T4 téléphone `null` au détail et au planning ; T6 `permission denied` sur les colonnes internes, 0 table, 0 horaire ; T7 `404 TABLE_NOT_FOUND`, table inchangée ; T8 0 paiement, 0 remboursement lisibles. `cv11b-2-gardes` **20/20** (G6a : une fermeture `201`, l'autre `409 PREVIEW_CHANGED`) ; `cv11b-3-statique` vert (T5, SMS, recopies) ; `l11b-cv-paiements-partenaire` 2/2 (partenaire : 0 paiement et 0 remboursement lus ; client : 4 paiements, 1 remboursement ; recettes justes) ; audits `aud-06`, `cv10a-4`, `cv11a-1`, `-2`, `-4`, `cvf2b-6` verts, assertions inchangées ; invariants : 0 violation |
| 575 | `aba5994d6` | **complet**, après fusion de main (`4d1a221d6`, design 1e) à `e33c69bdb` | **rouge sur une seule suite** : tests 577/578 (145 + 143 + 144 + 145) ; build, budgets JS, contrôle responsive (0 défaut, 184 pages × thème), **e2e entièrement vert** (12 phases, 787 captures, 0 en échec) et **mesure mobile verte au seuil bloquant de 90** (médianes 93, 91, 90 ; « tous les seuils sont tenus »). Seule rouge : `tests/security/r31-tables-lecture` (lot 10b, `e74538000`), sous-tests 2 et 3 : ils exigent que la propriétaire lise par la REST ses établissements en attente ou refusés (`:104`) et les tables d'un établissement en attente (`:108`), exactement ce que le correctif T6 demandé interdit. Suite absente du run rapide 569 (oubli de ma part dans la ligne `ci-rapide`). Arrêt sans fusion, comme convenu |
| 577 | `4da2112c1` | **complet**, après `r31-tables-lecture` aligné sur T6 (décision du chef de projet, `1677df2c7`) | **entièrement vert** : tests **578/578** (145 + 144 + 144 + 145), contrôle des lots, build, budgets JS, contrôle responsive (0 défaut, 184 pages × thème), e2e (12 phases, 787 captures, 0 en échec), **mesure mobile au seuil bloquant de 90 : 91, 93, 92** ; `r31-tables-lecture` 9/9. Fusion dans main : `4198965e4` (arbre identique à `4da2112c1`) |
| 578 | `4198965e4` (main) | **complet de main** | tests 578/578, e2e (787 captures, 0 en échec) et contrôle responsive verts ; **mesure mobile rouge : 81, 84, 85**, sur le même code que le run 577. Cause : serveur de CI plus rapide (indice de calibration 3 400 à 3 700 au lieu de 2 200 à 2 500), donc ralentissement simulé de **×6,7 à ×7,4** au lieu de ×4,5 à ×4,9 ; au ralentissement brut ×4, scores de 95 à 98. Arrêt avant toute opération sur event-village-dev ; ce commit de rapport, poussé sur main sans ligne `ci-rapide`, relance un run complet de main |
| 579 | `30019290e` (main) | **complet de main** (run frais) | **entièrement vert** : tests **578/578** (145 + 144 + 144 + 145), contrôle des lots, build, budgets JS, contrôle responsive (0 défaut, 184 pages × thème), e2e (12 phases, 787 captures, 0 en échec), **mesure mobile 94, 93, 92** (ralentissement ×3,6 à ×3,8, « tous les seuils sont tenus ») |

Journaux bruts : branche `ci-results`, dossiers `runs/<numéro>-<identifiant>/`.

## Application sur event-village-dev (21/11, après le run 579 vert)

Depuis le worktree du lot, HEAD = main = `30019290e`, `npx -y supabase@2.122.0` (projet lié `rswkzklxrqswimcxghch`).

**Dry-run** (`db push --linked --dry-run`) : exactement les 10 migrations du lot, rien d'autre.

```
Would push these migrations:
 • 20261129000001_l11b_etablissements.sql
 • 20261129000002_l11b_fermetures_disponibilites.sql
 • 20261129000003_l11b_reservations.sql
 • 20261129000004_l11b_avis.sql
 • 20261129000005_l11b_photos_citees.sql
 • 20261129000006_l11b_cv_fermeture_empreinte.sql
 • 20261129000007_l11b_cv_absence_annulation.sql
 • 20261129000008_l11b_cv_plan_tout_ou_rien.sql
 • 20261129000009_l11b_cv_lectures_etablissements.sql
 • 20261129000010_l11b_cv_paiements_lecture.sql
```

**Contrôles avant** (lecture seule, `db query --linked`) :

```
derniere_migration           20261127000001
migrations_20261129          0
fonctions_du_lot             0
venue_closures               absente
reminder_hours               {"value": 3}
payments_read_proprio        true
venues_read_proprio          true
venues_anon_validated_by     true
reservations_de_table        0
etablissements               0
superadmins_actifs           1
```

**db push** (`db push --linked --yes`) : les 10 migrations appliquées dans l'ordre, sans erreur (« Finished supabase db
push »).

**Contrôles après** :

```
migrations_20261129            20261129000001,…002,…003,…004,…005,…006,…007,…008,…009,…010
fonctions_fermees_anon_auth    24 fonctions, 0 ouvertes
venue_closures_rls_anon_auth   true false false
short_code_null_sur_total      0 / 0
avis_nuit                      TABLE_CLIENT_COMING=DEFER TABLE_NEW_RESERVATION=DEFER TABLE_REFUND_PAID=SEND TABLE_REMINDER=DEFER TABLE_REQUEST_SENT=SEND TABLE_RESERVATION_CONFIRMED=DEFER VENUE_VALIDATION_DECIDED=DEFER
reminder_hours                 {"value": 2}
citations_photos               true
T1_expected_hash               true
T2_no_show                     true
T3_expected_refund             true
T7_raise                       true
T6_T8_regles_avec_proprio      0
T6_T8_regles_presentes         6
T6_colonnes                    false false true
reservations_de_table          0
etablissements                 0
superadmins_actifs             1
```

Conformes : 24 fonctions du lot fermées à `anon` et `authenticated` ; `venue_closures` sous RLS et fermée à la REST ;
nuit et rappel à 2 h appliqués ; T1, T2, T3, T7 en base ; les 6 règles de lecture de T6 et T8 présentes, aucune
n'ouvre plus l'accès à la propriétaire (`is_partner_owner`) ; colonnes internes de `venues` fermées (`validated_by`,
`validation_reason`), colonnes publiques ouvertes (`name`) ; aucune donnée touchée (0 établissement, 0 réservation de
table, 1 Superadmin actif).

**`03-verification.sql`** (`supabase/hotfix/2026-10-31-lot1a/03-verification.sql`) : **20/20 OK** (9 aides RLS,
aucune fonction hors liste blanche ouverte à `anon` ou `authenticated`, toutes les tables de `public` sous RLS).

Event-village-dev ne doit plus tourner qu'avec le code de main ≥ `4198965e4`.

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
captures comme dans le contrôle responsive, pour tous les lots (le design 1e l'a contourné pour ses seules captures,
`e2e/design1e-captures.responsive.spec.ts:52-55`, en posant le cookie du thème). Cause : `e2e/auth.setup.ts:55` connecte les comptes
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
