# Contre-vérification du lot Carte B3 (lieux publics, position obligatoire)

- Branche auditée : `origin/carte-b3/lieux` au commit `558e708b2b` (rapport `docs/carte-b3-rapport.md`), lue sans
  modification.
- Branche des tests : `carte-b3/cv-rouges` (jamais fusionnée), depuis `558e708b2b`. Aucun correctif, aucune migration
  appliquée, aucun appel au projet distant, `.env.local` non lu, aucune construction locale.
- Règle de lecture : le rapport du lot sert seulement à repérer ses affirmations ; chacune est revérifiée dans le code
  et, quand c'est possible, par un test sur la base locale de la CI.
- Référence : décision du client du 25/11 (application entièrement publique ; position exacte obligatoire pour toute
  salle, tout établissement et tout événement publié ; ce qui est déjà publié sans position reste en ligne, avec le
  bandeau).

## 1. Verdict

**Le lot tient ses promesses sur l'essentiel, avec quatre trous à corriger avant la fusion : deux moyens (T1, T2), deux
faibles (T3, T4). Aucun critique, aucun élevé.** Ce qui tient : la position est bien obligatoire à l'envoi et à la
validation en base, les recopies n'ont perdu aucune ligne, la recherche ne compare le texte tapé qu'aux lieux publiés,
un lieu suspendu disparaît partout (même par une ancienne URL), les interrupteurs ferment les couches par 404, et rien
de nouveau n'est chargé au premier affichage d'Explorer.

| Trou | Gravité | Point de la consigne | Antérieur au lot ? | Test rouge |
|---|---|---|---|---|
| T1 — REST encore ouverte sur `halls` et `venues` (identifiant du compte de l'administratrice, `partner_id`) | moyenne | 1, 2 | en partie (le lot a gardé la REST ouverte en ne retirant que trois colonnes) | `cvcb3-1-trous` T1 |
| T2 — raison sociale (« nom légal de la société ») rendue publiquement | moyenne | 1, 3 | oui (lots 5, 10b, 11b ; aussi sur `main`) | `cvcb3-1-trous` T2 |
| T3 — VALIDE → PUBLIE sans position accepté en base | faible | 4 | oui (le lot n'a pas fermé ce chemin) | `cvcb3-1-trous` T3 |
| T4 — modification d'un établissement : écriture partielle, carte non vidée | faible | 5 | non (invalidation ajoutée par le lot, placée après les horaires) | `cvcb3-1-trous` T4 |

L'adresse et la position exactes ne sont plus des secrets (décision du 25/11) : les deux trous moyens portent sur des données d'identité (compte d'administration, raison sociale), pas sur le lieu.

## 2. Runs

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 674 | `8a64f75612` (tests seuls) | rapide : `cvcb3-1-trous`, `cvcb3-2-gardes`, `cvcb3-3-statique` | typecheck OK (52 s), lint OK (16 s) ; `cvcb3-1-trous` **9 rouges / 1 vert** (le témoin de T4), chaque rouge pour la raison attendue ; `cvcb3-2-gardes` **10/10** ; `cvcb3-3-statique` **17/17** |

Journaux bruts : branche `ci-results`, dossier `runs/674-45682250192/` (`verify.log`,
`test-logs/tests__audit__cvcb3-1-trous.test.ts.log`, `test-logs/tests__audit__cvcb3-2-gardes.test.ts.log`). Aucun run
complet ni e2e lancé (consigne) ; un seul autre run tournait (lot 11c, run 673).

## 3. Trous

### T1 — REST encore ouverte sur `halls` et `venues` (moyenne)

**Constat.** La consigne demande qu'aucune lecture REST des salles et des établissements, ni de leurs colonnes, ne
reste ouverte aux rôles publics : tout doit passer par les routes du serveur. La migration du lot ne retire que trois
colonnes et redonne le reste :

- `supabase/migrations/20261210000001_cb3_lieux_publics.sql:40-44` : `GRANT SELECT (id, partner_id, name, …,
  validation_status, validation_reason, validated_by, validated_at, …) ON public.halls TO anon, authenticated` ;
- `:48-51` : même chose sur `venues` (`id, partner_id, kind, name, …`) ;
- la règle `halls_read_public` (`20261126000004_l10b_cv_correctifs.sql:36-41`) laisse lire toute salle publiée.

Conséquences, prouvées par le test :
- la clé anon et le jeton d'un attaquant lisent les lignes des deux tables ;
- `halls.validated_by` rend l'**identifiant du compte de l'administratrice** qui a validé (consigne, point 1 : aucun
  identifiant de compte) ;
- `partner_id` mène à la vue `public_partners` (T2), d'où la raison sociale de la propriétaire de chaque lieu.

Le rapport du lot écrit « F1 est gardée » et « aucun écran ne lit ces tables par le navigateur » : la seconde
affirmation est vraie (aucune lecture de `halls` ni de `venues` par un client du navigateur, jointures comprises), la
première ne couvre que trois colonnes.

**Sortie brute.**

```
not ok 1 - halls : aucune ligne pour la clé anon ni pour le jeton d’un attaquant
  halls lisible par la REST
  + [ 'anon lit la ligne (erreur : aucune)', 'attaquant lit la ligne (erreur : aucune)' ]
not ok 2 - venues : aucune ligne pour la clé anon ni pour le jeton d’un attaquant
  venues lisible par la REST
  + [ 'anon lit la ligne (erreur : aucune)', 'attaquant lit la ligne (erreur : aucune)' ]
not ok 3 - halls.validated_by : l’identifiant du compte de l’administratrice n’est jamais rendu
  error: 'identifiant de compte rendu à anon : [{"id":"e0c8a6db-…","partner_id":"c90bc5de-…",
          "validated_by":"c4cd5315-0404-4321-9d7d-8c3681cfb2d0"}]'
```
`c4cd5315-0404-4321-9d7d-8c3681cfb2d0` est le compte SUPERADMIN de la graine (`seed.log` du même run).

**Correctif proposé.** `REVOKE SELECT ON public.halls, public.venues FROM anon, authenticated;` sans `GRANT` de
colonnes. Attention : les règles de lecture de `restaurant_tables`, `restaurant_zones`, `venue_opening_hours`
(`20261129000009_l11b_cv_lectures_etablissements.sql:22-48`) et d'autres tables lisent `venues` dans des sous-requêtes
aux droits de l'appelant ; les remplacer par une fonction `venue_listed(uuid)` en `SECURITY DEFINER` (sur le modèle de
`partner_listed`), ou fermer aussi la REST de ces tables (aucun écran ne les lit par le navigateur : à revérifier au
moment du correctif). Le test F1 du lot (`tests/security/cb3-lieux-publics.test.ts`) reste vrai après ce correctif.

### T2 — raison sociale de la partenaire rendue publiquement (moyenne, antérieure)

**Constat.** À l'inscription, `company_name` est la « Raison sociale », avec l'aide « Nom légal de la société »
(`app/partner/register/page.tsx:508`) ; le nom commercial est **facultatif** (`:510`, `lib/validations/auth.ts:219`).
Partout où un nom de partenaire est montré, le code prend le nom commercial, **sinon la raison sociale** :

| Lecture publique | Référence |
|---|---|
| recherche des salles (`/api/halls`) : rendue dans `partner_name` et comparée au texte tapé | `20261126000002_l10b_salles.sql:371`, `:377` |
| recherche des établissements (`/api/tables`) : idem | `20261129000002_l11b_fermetures_disponibilites.sql:535`, `:540` |
| fiche d'une salle (page et `/api/halls/[id]`) | `lib/halls/queries.ts:167` |
| fiche d'un établissement (page et `/api/tables/[id]`) | `lib/tables/queries.ts:171` |
| fiche d'un événement (`/api/events/[id]`, page) | `lib/events/event-detail.server.ts:229` |
| liste d'Explorer et de l'accueil | `lib/events/catalog.server.ts:252` |
| carte des événements : filtre `q` comparé à la raison sociale (oracle) | `lib/events/map-data.ts:87` |
| REST : vue `public_partners` (raison sociale de **toute** partenaire VALIDE, même avec un nom commercial) | `20261102000001_lot5_securite.sql:35-43` |

Le test « R » du lot (`tests/security/cb3-lieux-publics.test.ts:152-170`) ne le voit pas : sa partenaire de test a un
nom commercial (`tests/parcours/finance-helpers.ts:77`), et il cherche la **clé** `company_name`, pas la valeur sous
`partner_name` ou `partnerName`. L'affirmation du rapport « ni nom légal … dans les sept lectures publiques » n'est
donc vraie que pour une partenaire qui a rempli son nom commercial.

Conflit à signaler : la suite `tests/security/r18-partenaires-public.test.ts:82-100` (lot 5, contrat A2) **exige** que
la clé anon lise `company_name` dans `public_partners`. La consigne de cette contre-vérification (« aucun nom légal »)
la contredit : c'est au client de trancher, puis de faire modifier r18 avec le correctif.

**Sortie brute.**

Partenaire de test sans nom commercial, raison sociale `RaisonLegalecvcb33331a1d9` :
```
not ok 1 - recherches, fiches et tables des lieux : la raison sociale n’est jamais rendue
  + 'recherche des salles : HTTP 200 {… "partnerName":"RaisonLegalecvcb33331a1d9", …}'
  + 'fiche de la salle : HTTP 200 {… "partnerName":"RaisonLegalecvcb33331a1d9", …}'
  + 'recherche des établissements : HTTP 200 {… "partnerName":"RaisonLegalecvcb33331a1d9", …}'
  + 'fiche de l’établissement : HTTP 200 {… "partnerName":"RaisonLegalecvcb33331a1d9", …}'
not ok 2 - recherche : la raison sociale tapée ne retrouve pas les lieux (oracle)
  + [ 1, 1 ]   - [ 0, 0 ]      (salle et établissement retrouvés en tapant la raison sociale)
not ok 3 - vue public_partners : la raison sociale n’est pas lisible par la clé anon (partner_id des lieux y mène)
  error: 'raison sociale lisible : [{"id":"c90bc5de-…","company_name":"RaisonLegalecvcb33331a1d9",
          "logo_url":null,"city":"Dakar",…,"status":"VALIDE"}]'
not ok 4 - événement publié : carte et fiche ne rendent pas la raison sociale
  fiche : HTTP 200 {"event":{…,"subtitle":"RaisonLegalecvcb33331a1d9",
                    "organizer":{"id":"c90bc5de-…","name":"RaisonLegalecvcb33331a1d9",…},…}}
```
La partie publique de la carte des événements (`pub`) ne contient pas la raison sociale : seule la fiche la rend dans
ce test ; sur la carte, elle ne sert qu'au filtre `q` (oracle, voir le tableau).

**Correctif proposé.** (1) Rendre le nom commercial obligatoire à l'inscription et dans le profil (reprise des
partenaires existantes : nom commercial = raison sociale seulement avec leur accord, sinon « Partenaire Event
Village ») ; (2) ne plus jamais retomber sur `company_name` dans les sept lectures ci-dessus ; (3) ne plus comparer le
texte tapé à `company_name` (recherches, filtre de la carte) ; (4) retirer `company_name` de `public_partners` (ou y
mettre le nom commercial) et adapter r18.

### T3 — VALIDE → PUBLIE accepté en base sans position (faible, antérieure)

**Constat.** `event_transition` (recopie du lot) contrôle la position à l'envoi (BROUILLON → EN_ATTENTE,
`20261210000001_cb3_lieux_publics.sql:640-676`) et à la validation (EN_ATTENTE → VALIDE, `:677-681`), jamais à la
**publication** (VALIDE → PUBLIE, partenaire ou administration : `20261102000003_lot5_cycle.sql:54-55`). Un événement
validé avant l'obligation (avant la finition 2a, ou une donnée reprise) est publié sans position, alors que la décision
du 25/11 n'épargne que ce qui est **déjà publié**. `event_update` empêche bien de retirer la position après la
validation : le chemin ne concerne que des données anciennes, d'où la gravité faible.

**Sortie brute.**

```
not ok 1 - VALIDE → PUBLIE refusé en base sans position (événement validé avant l’obligation)
  {"ok":true,"to":"PUBLIE","from":"VALIDE",…,"actor_role":"PARTENAIRE",…}
  + [ true, undefined, 'PUBLIE' ]
  - [ false, 'POSITION_REQUIRED', 'VALIDE' ]
```

**Correctif proposé.** Dans `event_transition`, ajouter `IF e.status = 'VALIDE' AND v_to = 'PUBLIE' AND (e.latitude
IS NULL OR e.longitude IS NULL) THEN RETURN … 'POSITION_REQUIRED' …` (la réactivation SUSPENDU → PUBLIE reste libre).
Compter d'abord les événements VALIDE sans position sur `event-village-dev` pour prévenir leurs organisatrices.

### T4 — modification d'un établissement : écriture partielle, carte non vidée (faible)

**Constat.** `TableService.updateVenue` (`lib/tables/table.service.ts:227-252`) écrit d'abord la fiche (nom, photos,
position, acompte…), **puis** appelle `venue_hours_set` (`:248`) ; si les horaires sont refusés (deux heures égales,
plages qui se chevauchent…), l'exception part avant `invalidatePublicPlaces` (`:250`). Résultat : la partenaire lit une
erreur alors que le nom (ou la position, ou les photos) est enregistré, et la carte garde l'ancien nom ou l'ancien point
jusqu'à 60 s (consigne, point 5 : moins de 5 s). Les fiches et les listes (pages `force-dynamic`, lectures sans cache)
montrent tout de suite le nouveau nom : seule la carte retarde.

**Sortie brute.**

```
ok 1 - témoin : un changement de nom accepté vide la carte
not ok 2 - nom changé + horaires refusés : rien d’écrit, ou la carte est vidée
  error: 'erreur rendue (« Une plage d’ouverture n’est pas valable : choisissez le jour, puis une heure d’ouverture
          et de fermeture différentes. ») mais nom enregistré (TEST Renommé cvcb33331a1d9) et 0 invalidation'
```
Le témoin prouve que la mesure fonctionne : hors du serveur Next, chaque invalidation est journalisée
(`[lieux-publics] …`) ; le changement accepté en produit une, le changement suivi d'horaires refusés aucune.

**Correctif proposé.** Contrôler et écrire les horaires **avant** la fiche, ou tout faire dans une seule fonction en
base ; à défaut, appeler `invalidatePublicPlaces` dans un `finally` dès que l'écriture de la fiche a réussi.

## 4. Garde-fous verts

Run 674, `cvcb3-2-gardes` 10/10 et `cvcb3-3-statique` 17/17 :

| Garde-fou | Ce qui est prouvé | Point |
|---|---|---|
| G1 | Un mot de l'adresse d'une salle en attente, d'une salle suspendue ou d'un établissement refusé ne les retrouve pas (`total` 0) ; la raison sociale d'une partenaire **qui a** un nom commercial ne retrouve rien | 3 |
| G2 | Salle suspendue : fiche 404, absente de la recherche et de la carte ; réactivée : de retour. Établissement suspendu : `/api/tables/[id]` et `/api/restaurants/[id]/tables` 404, absent de la carte ; réactivé : de retour. Partenaire suspendue : ses salles et établissements 404 et hors carte | 5, 6 |
| G3 | `features.halls_enabled` fermé : `GET /api/lieux/carte?couche=salles` et la fiche d'une salle 404, aucun identifiant dans la réponse ; même chose pour `features.tables_enabled` et la couche « restaurants » | 7 |
| G4 | Ni l'identifiant du compte de la partenaire, ni son téléphone, ni son adresse électronique dans les fiches, recherches, tables et la carte ; table `partners` illisible par la clé anon et par l'attaquant | 1 |
| G5 | Événement suspendu : absent de la carte ; sa fiche (ancienne URL) répond `status: SUSPENDU`, `purchasable: false` (voir O2) | 6 |
| S1 | Huit recopies : aucune ligne perdue par rapport à la dernière définition trouvée dans toutes les migrations antérieures, hors lignes réécrites listées ; aucune migration plus récente ne les redéfinit | 4 |
| S2 | `event_update`, `ticket_category_create`, `ticket_category_update` non recopiées | 4 |
| S3 | Couches, fiches de lieu, repères, lecture des lieux : importés seulement dans le morceau de la carte ; Explorer charge ce morceau par `next/dynamic` | 8 |

Garde-fous du lot relus et jugés justes (non relancés) : position exigée à l'envoi et à la validation pour les salles,
les établissements et les événements, réactivation libre, insertion sans position jamais validée d'office, retrait de
la position refusé par les routes (`tests/parcours/cb3-position-obligatoire.test.ts`, groupes A à D).

## 5. Observations (sans test rouge)

- **O1 — couche gardée après un 404.** Si l'administration ferme un service pendant qu'une personne regarde la carte,
  la relecture suivante (retour sur l'onglet, déplacement) reçoit 404 ; `ExploreMap` garde alors la liste précédente
  (`components/explore/ExploreMap.tsx:297-299`, « les listes précédentes ne servent qu'en cas d'échec ») et les
  interrupteurs déjà lus restent en mémoire (`lib/features/client.ts`) : la couche reste affichée avec un message
  d'erreur jusqu'au rechargement de la page. Proposition : sur 404, vider la couche et la retirer des couches proposées.
- **O2 — fiche d'un événement suspendu.** Une ancienne URL de fiche d'un événement SUSPENDU s'ouvre, avec le bandeau
  « Événement suspendu » et l'achat fermé : c'est le contrat E du lot 5 (`lib/events/public-status.ts:9-11`), pour que
  les porteurs de billets s'informent. La consigne (point 6) dit « n'apparaît jamais, même via une ancienne URL » : à
  trancher par le client. Les salles et établissements suspendus, eux, répondent bien 404 (G2).
- **O3 — position retirable en base.** Une écriture directe peut remettre à vide la position d'une salle ou d'un
  établissement validé (aucune contrainte ni déclencheur ; seules les routes refusent, test D du lot). Aucun rôle public
  n'écrit dans ces tables (pas de règle d'écriture depuis le lot 9 ter) : défense en profondeur seulement.
- **O4 — feuille de style commune.** Les formes des repères (45 lignes) sont dans `app/globals.css`, donc chargées par
  toutes les pages ; ce n'est pas un import de script (la règle du lot), et le poids est faible.

## 6. Points écartés après vérification

- **Recherche par l'adresse (point 3).** Depuis la décision du 25/11, l'adresse d'un lieu publié est sur sa fiche ;
  la recherche ne compare le texte tapé qu'aux lieux **publiés** (CTE `visible` : actif, validé, partenaire VALIDE) et
  rend ces mêmes champs. Un mot de l'adresse d'une salle en attente, d'une salle suspendue ou d'un établissement refusé
  ne les retrouve pas (G1). Seule la raison sociale fait exception (T2).
- **Recopies (point 4).** Les huit fonctions recopiées ont été comparées à leur dernière définition **dans toutes les
  migrations antérieures** (pas seulement celle citée par l'en-tête) : aucune ligne perdue en dehors des lignes
  réécrites (S1). `event_update`, `ticket_category_create` et `ticket_category_update` ne sont pas recopiées (S2). La
  branche `origin/lot11c/tables-argent` (`16436ae006`, migrations `20261201000001-007`) ne définit aucune des huit
  fonctions ; aucune migration plus récente que celle du lot ne les redéfinit.
- **Réactivation sans position.** `hall_validation_decide` et `venue_validation_decide` ne bloquent que `VALIDER` ; une
  réactivation de ce qui était publié reste possible, comme le veut la décision (test C du lot, relu).
- **Contraintes de position.** `halls_position_chk` et `venues_position_chk` imposent latitude et longitude ensemble :
  le contrôle `h.latitude IS NULL` seul de `hall_submit` suffit.
- **Photos.** Leur chemin contient l'identifiant de la fiche partenaire (`public-images/halls/<partner_id>/…`), pas
  celui d'un compte ; il n'apparaît dans aucune autre donnée publique que T1.
- **Statut d'un compte de partenaire.** La suspension d'un compte partenaire passe obligatoirement par sa fiche
  (`admin_user_status_set` refuse : `PARTNER_STATUS_VIA_PARTNER_SHEET`), dont la route vide le cache des lieux.
- **Modération des services.** `PATCH /api/admin/services` ne touche ni `halls` ni `venues`.
- **Invalidation (point 5), hors T4.** Chaque écriture relue vide le cache après succès : décisions de
  l'administration (les quatre, `app/api/admin/{halls,venues}/[id]/validation/route.ts:43`), statut de la partenaire
  (`app/api/admin/partners/[id]/status/route.ts:125`), création, modification, suppression et renvoi d'une salle
  (`lib/halls/hall.service.ts:251, 361, 406, 425`), création, renvoi et modification d'un établissement, ajout,
  modification et suppression d'une table (`lib/tables/table.service.ts:188-344`). Fiches et listes ne sont pas mises
  en cache. Le rapport du lot cite 18 ms (salle validée visible) et 13 ms (salle suspendue retirée) en e2e (`docs/carte-b3-rapport.md:228-229`) ; je n’ai pas relancé d’e2e : réactivation, retrait, nom, photo et position ne sont prouvés que par la lecture du code ci-dessus.
- **Premier chargement (point 8).** Explorer charge la carte par `next/dynamic` ; les modules nouveaux (couches, fiches
  de lieu, repères, lecture des lieux) ne sont importés que dans ce morceau (S3). `lib/events/map-client.ts`, déjà
  chargé par l'aperçu de l'accueil, ne gagne qu'une fonction de trois lignes. La règle `ui-base` de `next.config.mjs`
  regroupe Button et `cn` sans rien ajouter aux pages qui ne les chargeaient pas.

## 7. Fichiers de la branche carte-b3/cv-rouges

| Suite | Contenu | Attendu |
|---|---|---|
| `tests/audit/cvcb3-1-trous.test.ts` | T1 à T4 (et un témoin pour T4) | rouge tant que les trous existent (le témoin est vert) |
| `tests/audit/cvcb3-2-gardes.test.ts` | G1 à G5 | vert |
| `tests/audit/cvcb3-3-statique.test.ts` | S1 à S3 (sans base) | vert (17/17 en local) |
