# Contre-vérification — finition 2a (fiche suspendue, affiche, carte, fin retenue)

Branche `audit/finition-2a`, partie de `finition-2a/fin-carte-affiche` à `a2acb49e`, dans un dossier séparé. **Tests seulement : aucun correctif.** Rien n'est fusionné, aucune migration n'est faite, aucun test ne vise un projet distant, `.env.local` n'a pas été lu.

Cinq suites `tests/audit/cvf2a-*.test.ts` jouent l'attaquant, une par point de la consigne. Leurs aides communes sont dans `tests/audit/cvf2a-helpers.ts`. Les comptes et les événements sont montés par le service_role sur la base locale de la CI, comme dans les suites du lot. Les attaques passent par :
- les vraies routes de l'application ;
- la REST de Supabase et le stockage, avec la clé publique et le jeton de l'attaquante, ou sans jeton ;
- les fonctions de la base, appelées avec l'attaquante pour auteur.

Une suite verte veut dire « attaque bloquée », une suite rouge « trou ».

## À lire en premier

**Six trous, aucun critique.** Aucune entrée, aucune vente, aucun mouvement d'argent n'a été possible. Ce qui tient :
- le réencodage de l'affiche (15 fichiers piégés) ;
- les adresses d'affiche (24 adresses piégées) ;
- la recherche de lieu, entièrement ;
- les bornes de la position ;
- la fin retenue, la même partout ;
- les fiches EN_ATTENTE et REJETE (31 écritures, aucune acceptée).

| # | Point | Trou | Gravité |
|---|---|---|---|
| T1 | 1 | **Une fiche SUSPENDU modifie encore son équipe**, à la route et en base. Sur 12 écritures de l'onglet Équipe, 11 sont acceptées : changer une porte, donner le droit d'encaisser, inviter un contrôleur (le SMS part), renvoyer, annuler et effacer une invitation, retirer un contrôleur d'un événement ou de toutes ses affectations. La douzième n'a échoué que parce que le contrôleur était déjà retiré. Les trois fonctions de la base acceptent aussi la partenaire suspendue pour autrice. | moyenne |
| T2 | 1 | **Une fiche SUSPENDU valide l'écart d'une caisse** de son événement : l'écart passe de « à valider » à « validé par elle ». | faible à moyenne |
| T3 | 4 | **Des petits pas contournent l'avis de changement de lieu.** Quatre déplacements de 150 m dans la même direction (600 m au total) : aucun détenteur prévenu, puisque chaque pas est mesuré depuis le repère précédent. | moyenne |
| T4 | 4 | **Des allers-retours font une rafale de SMS.** Quatre déplacements de 300 m (aller, retour, aller, retour) donnent quatre SMS « change de lieu » au même détenteur en moins d'une heure, pour un repère revenu à sa place. Un aller-retour dans la même fenêtre de 10 minutes donne aussi un SMS, alors que rien n'a changé. | faible à moyenne |
| T5 | 2 | **Une affiche d'avant la finition se réutilise telle quelle.** Un fichier brut déjà présent dans son dossier (JPEG avec position GPS) est accepté comme affiche, puis servi avec ses métadonnées. | faible |
| T6 | 2 | **Le remplacement et la purge effacent un fichier encore cité** par une salle, un produit, le logo ou la couverture du profil, dès qu'il est rangé sous `events/<partenaire>/`. Aucun fichier hors de `events/` n'est touché, aucun fichier d'une autre partenaire non plus. | faible |

**Runs :**
- **233**, sur `886a2ec8` : 424 suites sur 428. Les rouges sont exactement `cvf2a-1`, `cvf2a-2`, `cvf2a-4` et `cvf2a-5`, l'e2e est vert (469 captures, 0 en échec). Trois de ces rouges venaient de mes propres erreurs (montage de `cvf2a-1` j, attente fausse de `cvf2a-5` a). Corrigés dans `f0593858`, sans affaiblir aucune assertion d'attaque (§ 5).
- **234**, sur `f0593858` : 425 suites sur 428. Les rouges sont exactement `cvf2a-1` (a, b, c), `cvf2a-2` (c, e) et `cvf2a-4` (b), c'est-à-dire T1 à T6 et rien d'autre. `cvf2a-1` j et `cvf2a-5` passent. Les sorties brutes des six trous sont les mêmes qu'au run 233, aux identifiants et horodatages près. Invariants à 0, e2e vert (469 captures, 0 en échec).

## 1. Résultat point par point

| Point | Attaques tentées | Résultat |
|---|---|---|
| 1. Fiche SUSPENDU | Hors des 17 routes listées par la finition :<br>– onglet Équipe : 12 écritures (réglages, porte, point d'entrée, droit d'encaisser, invitation, renvoi, annulation, effacement, affectations, « Retirer de cet événement », « Retirer de l'équipe », retrait de toutes les affectations) ;<br>– les 3 fonctions d'équipe de la base, avec un témoin accepté quand la fiche est VALIDE ;<br>– caisse : validation d'un écart en attente, après saisie du mot de passe ;<br>– contrôle et guichet sur son propre événement : scan, saisie manuelle, vérification, invités, devis, vente, choix de porte, ouverture de caisse ;<br>– transferts : annulation d'un transfert en attente, transfert d'un billet d'invitation ;<br>– REST avec son jeton : 18 écritures sur 9 tables (événements, catégories, billets, zones, portes, affectations, invitations, PIN, transferts) ;<br>– toutes les fonctions exécutables par `authenticated` (196), appelées avec son jeton ;<br>– stockage avec son jeton : déposer, remplacer, effacer une affiche citée. | **TROU : T1 et T2.** Le reste est bloqué : 403 `PARTNER_NOT_VALIDATED` sur ses routes de contrôle, 403 `NOT_SENDER` / `NOT_OWNER` sur les transferts, 42501 sur la REST, refus du stockage, aucun changement d'état. |
| 1 bis. Fiches EN_ATTENTE et REJETE | Pour chacune : les 16 écritures de `/api/partner/events`, le dépôt d'image, son propre scan et les 12 écritures de l'équipe (31 en tout). | **Bloquée.** 31 refus sur 31 (403 `PARTNER_NOT_VALIDATED`), aucun changement d'état. |
| 1 ter. Fiche réactivée | – SUSPENDU puis VALIDE directement : modification, catégorie, invitation, PIN, dépôt d'image, réglages et invitation de l'équipe, puis `event_update` en base ;<br>– suspension puis réactivation par `partner_status_set`, reconnexion, mêmes écritures, et retour de l'événement à PUBLIE. | **Conforme.** Run 234, les deux essais sont verts. Toutes les écritures sont de nouveau acceptées (200 ou 201) par la route, `event_update` répond `ok:true` en base, et l'événement revient à PUBLIE après `partner_status_set`. |
| 2. Affiche | – Dépôt par la route de 15 fichiers piégés : SVG avec script, SVG annoncé PNG, HEIC, GIF, JPEG suivi d'un SVG, fichier vide, bombe de décompression PNG 8 000 × 8 000 (62 Ko), WebP animé, PNG suivi d'un HTML, PNG annoncé SVG, WebP avec EXIF (GPS) et XMP, JPEG avec ICC et EXIF (GPS), image de 6 000 × 6 000, dossiers `../avatars` et `events/../../halls` ;<br>– stockage direct (jeton de la partenaire, puis sans jeton) : SVG, JPEG avec GPS, WebP dans le dossier d'une autre, remplacement, effacement ;<br>– fichier brut d'avant la finition, déjà dans son dossier, enregistré comme affiche ;<br>– 12 adresses `image_url` par la création et par la modification : affiche d'une autre partenaire, dossier `halls`, autre compartiment, hôte externe, `../` en clair et encodé (2 formes), paramètre, fragment, identifiant en majuscules, `data:`, `javascript:` ; puis `gallery_urls` ;<br>– affiche remplacée encore citée par une salle, un produit, le logo ;<br>– purge de fichiers de 8 jours : affiche, galerie d'une autre partenaire, salle, produit, logo, couverture, orpheline, et 5 fichiers hors du périmètre. | **TROU : T5 et T6.** Le reste est bloqué :<br>– 7 fichiers refusés (400, aucun fichier stocké) ;<br>– 8 stockés en WebP d'une seule image, sans EXIF, XMP ni ICC, sans la charge utile, 1 600 px au plus, `image/webp`, sous `events/<A>/` ou `misc/<A>/` ;<br>– stockage direct refusé (politique ou type de fichier) ;<br>– 24 adresses refusées (400 `IMAGE_ORIGIN_INVALID`), `gallery_urls` refusé (`FIELD_NOT_EDITABLE`, `UNKNOWN_FIELD`) ;<br>– la purge garde l'affiche et la galerie citées, efface l'orpheline et ne touche à rien hors de `events/<partenaire>/`. |
| 3. Recherche de lieu | – sans session, jeton illisible, client, contrôleur, fiche EN_ATTENTE, fiche REJETE (avec témoin VALIDE) ;<br>– 12 recherches en parallèle au quota de 5 ;<br>– 3 comptes × 6 recherches distinctes en parallèle ;<br>– 121 caractères, 500 espaces puis « x », `q` répété, injection de paramètres (`&countrycodes=fr&limit=50&format=xml&email=…`), caractère nul, retours à la ligne et faux en-tête, caractères combinants, jokers SQL, 120 caractères multioctets ;<br>– même recherche par deux comptes ;<br>– REST et fonction des tables de la recherche (jeton, puis sans jeton) ;<br>– réponses 200, 400, 429, 503 (service en panne, service injoignable) relues pour l'adresse, l'hôte, le contact et l'identification du service. | **Bloquée.**<br>– refus 401 ou 403, service jamais appelé ;<br>– 5 servies au plus, 7 refus 429 ;<br>– jamais deux appels au service à moins de 1 098 ms ;<br>– jamais de 500, paramètres du service intacts (`countrycodes=sn`, `limit=5`, `format=jsonv2`) ;<br>– réponses identiques entre les deux comptes, clés `attribution` et `results` seulement ;<br>– tables et fonction refusées (42501) ;<br>– aucune adresse, aucun contact. |
| 4. Position | – création par la route et par `event_create` : latitude seule, longitude seule, longitude nulle, Paris, au large, 1e308, chaînes, valeurs inversées, NaN, Infinity (témoins acceptés) ;<br>– modification d'un brouillon, par la route et par `event_update` : les mêmes, plus la Mauritanie ;<br>– retrait du repère sur un événement VALIDE, PUBLIE et SUSPENDU : les deux nuls, latitude nulle seule, longitude nulle seule, par la route et par `event_update` ;<br>– 4 pas de 150 m ;<br>– 4 allers-retours de 300 m, chaque SMS parti avant le pas suivant ;<br>– un aller-retour de 300 m dans la même fenêtre de 10 minutes. | **TROU : T3 et T4.** Les bornes sont bloquées : 400 ou refus de la base (`POSITION_INCOMPLETE`, `POSITION_OUT_OF_BOUNDS`, `POSITION_REQUIRED`, `VALIDATION_FAILED`), repère inchangé. |
| 5. Fin retenue | – 5 cas comparés entre la règle écrite, la base, le catalogue, l'équipe (événement, affectation, « passé »), « Mes soirées » et la fiche admin : début 22:00 sans fin, début 10:00 sans fin, date de fin sans heure, plusieurs jours, heure de fin sans date de fin ;<br>– catalogue par la route, autour de l'instant présent : fin dans 10 min, fin il y a 10 min, plusieurs jours, date de fin sans heure ;<br>– catalogue de la base : aucune fonction ne calcule encore une autre fin. | **Bloquée : aucune différence.** Run 234 :<br>– les 5 cas donnent la même heure aux 6 ou 7 endroits : début 22:00 sans fin → 04:00 le lendemain ; début 10:00 sans fin → 16:00 ; date de fin sans heure → 23:59 ; plusieurs jours → 03:00 du dernier jour ;<br>– « Mes soirées » montre une soirée si et seulement si sa fin est passée ;<br>– le catalogue liste un événement si et seulement si sa fin est à venir ;<br>– aucune fonction de la base ne calcule une autre fin. |

## 2. Trous : sortie brute, gravité, correctif proposé

### T1 — Une fiche SUSPENDU modifie encore son équipe (point 1) — gravité moyenne

**Attaque.** Fiche SUSPENDU, compte actif, jeton valide. Sur ses deux événements, l'un à portes et l'autre sans, la partenaire enchaîne les 12 écritures de l'onglet Équipe. Ensuite, elle passe par les trois fonctions de la base qu'utilisent ces routes, en se donnant pour autrice. Chacune est d'abord essayée avec une fiche VALIDE, comme témoin.

**Résultat : TROU** (`cvf2a-1` a et b, runs 233 et 234).

```
[CVF2A] PATCH /api/partner/team/settings (porte 2, espèces) → HTTP 200 {"ok":true,"gate":{"id":"8f58fb30-c528-4c91-a32d-640cd2d7afba","name":"Porte 2","zone_name":"Pelouse","categories":[{"name":"Entrée libre","scan_color":null},{"name":"Standard","scan_color":null}]},"event_id":"eee13847-ff0e-414b-ae79-8de643a6eb0c","op…
[CVF2A] PATCH /api/partner/team/gate (porte 2) → HTTP 200 {"ok":true,"controller_id":"729db818-0251-49f6-9815-ab4f4412c6b2","gate":{"id":"8f58fb30-c528-4c91-a32d-640cd2d7afba","name":"Porte 2","zone":{"id":"b83fe6bd-4a6b-4d64-bcf2-86249654028e","kind":"ENTREE","name":"Pelouse"}},"gate_change_allowed":true}
[CVF2A] PATCH /api/partner/team/entry-point (événement sans porte) → HTTP 200 {"ok":true,"entry_point":"Sortie de secours"}
[CVF2A] PATCH /api/partner/team/assignments/[id] (espèces) → HTTP 200 {"success":true,"assignment":{"id":"34f14d89-5e54-475b-a21a-ed426db79371","eventId":"eee13847-ff0e-414b-ae79-8de643a6eb0c","controllerId":"729db818-0251-49f6-9815-ab4f4412c6b2","canAcceptCash":true},"changed":false,"openShift":false}
[CVF2A] POST /api/partner/team/invite (compte existant) → HTTP 201 {"success":true,"assignments":[],"assignment":null,"is_new_user":false,"invitation_id":"cbf4de70-6bef-4b50-be7b-661282e4c861","invitation_expires_at":"2026-11-19T06:03:38.393306+00:00","notification":"QUEUED","message":"Invitation envoyée à Aw*** A***…
[CVF2A] POST /api/partner/team/invitations/[id]/resend → HTTP 200 {"ok":true,"expires_at":"2026-11-19T06:03:38.413966+00:00","message":"Invitation renvoyée par SMS : réponse attendue avant le jeu. 19 nov. 2026 à 06:03."}
[CVF2A] POST /api/partner/team/invitations/[id]/cancel → HTTP 200 {"ok":true,"message":"Invitation annulée : le lien du SMS ne mène plus à rien."}
[CVF2A] DELETE /api/partner/team/invitations/[id] (effacer) → HTTP 200 {"ok":true,"message":"Invitation effacée."}
[CVF2A] PATCH /api/partner/team/assignments (retire l’événement sans porte) → HTTP 200 {"success":true,"message":"Événements du contrôleur enregistrés.","added":[],"removed":["73afc564-feeb-4c4e-a644-d99c4b2216d7"],"total_active":1,"notification":"QUEUED"}
[CVF2A] DELETE /api/partner/team/[eventId] (Retirer de cet événement) → HTTP 200 {"success":true,"message":"Contrôleur retiré de l’événement.","notification":"QUEUED"}
[CVF2A] DELETE /api/partner/team/controller/[controllerId] (Retirer de l’équipe) → HTTP 404 {"error":"Ce contrôleur ne fait pas partie de cette équipe.","code":"CONTROLLER_NOT_IN_TEAM"}
[CVF2A] DELETE /api/partner/team/all → HTTP 200 {"success":true,"message":"Aucune affectation active trouvée pour ce partenaire."}
[CVF2A-1] équipe : 12 écritures essayées, 11 acceptées
    not ok 1 - a. routes de l’équipe sur ses événements : refusées, rien ne change
[CVF2A-1] témoin event_controller_settings_set (fiche VALIDE) → {"ok":true,"gate":{"id":"61928f11-addb-451a-b456-ce1daceeacf1","name":"Porte 1",…
[CVF2A-1] event_controller_settings_set (fiche SUSPENDU) → {"ok":true,"gate":{"id":"d0819b94-b600-445a-836f-7e094670f4bb","name":"Porte 2",…
[CVF2A-1] témoin event_controller_gate_set (fiche VALIDE) → {"ok":true,"gate":{"id":"d0819b94-b600-445a-836f-7e094670f4bb","name":"Porte 2",…
[CVF2A-1] event_controller_gate_set (fiche SUSPENDU) → {"ok":true,"gate":{"id":"61928f11-addb-451a-b456-ce1daceeacf1","name":"Porte 1",…
[CVF2A-1] témoin controller_invitation_create (fiche VALIDE) → {"ok":true,"expires_at":"2026-11-19T06:03:38.816682+00:00","invitation_id":"d61dc0ff-eefd-48f6-b514-1df02cd7b521"}
[CVF2A-1] controller_invitation_create (fiche SUSPENDU) → {"ok":true,"expires_at":"2026-11-19T06:03:38.825483+00:00","invitation_id":"1ae35355-e5f6-4d73-bdfe-f5d604d54622"}
    not ok 2 - b. la base : fonctions d’équipe avec la partenaire suspendue pour auteur (témoin : acceptées si VALIDE)
```

État relevé après les 12 essais : les deux affectations du contrôleur sont supprimées. L'invitation de départ est annulée puis effacée, après avoir été renvoyée (`send_count` 2). Une invitation nouvelle est en attente, et 2 SMS d'invitation sont partis.

**Cause.** La garde des routes (`partnerEventWrite`, `lib/auth/partner-fiche-guard.ts`) ne voit comme écriture que les méthodes autres que GET sous `/api/partner/events`, plus `/api/partner/upload`. `/api/partner/team/*` lui échappe. En base, `partner_owner_suspended` n'est contrôlée que dans les 10 fonctions listées par la finition et dans `event_regisseur_pin_store`. `event_controller_settings_set`, `event_controller_gate_set` et `controller_invitation_create` ne la contrôlent pas.

**Gravité : moyenne.** La promesse de la finition (« ses événements sont en lecture seule pour elle ») ne tient pas pour l'équipe. Pendant sa suspension, une partenaire peut :
- défaire l'équipe d'un événement ;
- donner le droit d'encaisser ;
- faire partir des SMS d'invitation aux frais de la plateforme.

Ce trou ne crée ni entrée ni vente : `partner_status_set` passe ses événements publiés en SUSPENDU, et la vente comme l'entrée y sont fermées. Les changements restent pourtant en place à la réactivation.

**Correctif proposé.** Compter `/api/partner/team/*` parmi les écritures de `partnerEventWrite` (403 `PARTNER_SUSPENDED`), et contrôler `partner_owner_suspended` en tête des fonctions d'équipe (réglages, porte, invitation, renvoi, annulation, retrait).

### T2 — Une fiche SUSPENDU valide l'écart d'une caisse (point 1) — gravité faible à moyenne

**Attaque.** Avant la suspension, un contrôleur ouvre puis ferme une caisse en déclarant 500 FCFA de trop, ce qui laisse un écart en attente. Fiche SUSPENDU, la partenaire saisit son mot de passe puis appelle `POST /api/partner/shifts/[id]/validate-discrepancy`.

**Résultat : TROU** (`cvf2a-1` c, runs 233 et 234).

```
[CVF2A-1] POST /api/partner/shifts/[id]/validate-discrepancy → HTTP 200 {"ok":true,"shift_id":"28822e46-7add-4bc1-a9e8-253faa38cea8","discrepancy":500,"validated_at":"2026-11-16T06:03:38.911841+00:00","message":"Écart validé."}
[CVF2A-1] caisse 28822e46-7add-4bc1-a9e8-253faa38cea8 : {"discrepancy_validated_at":"2026-11-16T06:03:38.911841+00:00","discrepancy_validated_by":"1a236451-e099-4912-b12b-8e5c26f71080"}
    not ok 1 - c. valider l’écart d’une caisse de son événement : refusé
```

**Cause.** La route est sous `/api/partner/shifts`, hors du périmètre de `partnerEventWrite`. La fonction de validation ne contrôle pas `partner_owner_suspended`.

**Gravité : faible à moyenne.** Aucun argent ne bouge. Mais une partenaire suspendue, souvent pour un doute sur ses comptes, efface elle-même le signal « écart à valider ». L'administration ne le voit alors plus.

**Correctif proposé.** Refuser la validation d'un écart à une fiche SUSPENDU (route et base), l'écart restant à valider par un admin `events.write`.

### T3 — Des petits pas contournent l'avis de changement de lieu (point 4) — gravité moyenne

**Attaque.** Événement PUBLIE, deux détenteurs. La partenaire déplace le repère quatre fois de 150 m vers le nord par « Modifier » puis « Enregistrer ». Elle l'a donc déplacé de 600 m en tout.

**Résultat : TROU** (`cvf2a-4` b, runs 233 et 234).

```
[CVF2A-4] pas 1 (150 m du lieu d'origine, 150 m du précédent) → HTTP 200 {"success":true,"event":{"id":"4122d2a5-560c-48a3-9109-00165d008a8f","city":"Dakar","slug":null,"title":"TEST Accès cvf2a-pos-petits-pas 1794809051608"…
[CVF2A-4] pas 2 (300 m du lieu d'origine, 150 m du précédent) → HTTP 200 {"success":true,…
[CVF2A-4] pas 3 (450 m du lieu d'origine, 150 m du précédent) → HTTP 200 {"success":true,…
[CVF2A-4] pas 4 (600 m du lieu d'origine, 150 m du précédent) → HTTP 200 {"success":true,…
[CVF2A-4] petits pas : détenteurs prévenus par pas [0,0,0,0] ; repère final [14.6982,-17.4467] (≈ 600 m au nord) ; boîte d'envoi : vide
    not ok 1 - petits pas de 150 m dans la même direction (600 m au total) : les détenteurs sont prévenus
      error: "lieu déplacé d'environ 600 m par petits pas de 150 m : aucun détenteur prévenu (SMS par détenteur [0,0], prévenus par pas [0,0,0,0])"
```

**Cause.** `event_update` compare le nouveau repère au repère précédent seulement (`geo_distance_m(e.latitude, e.longitude, n_lat, n_lng) > 200`, migration `20261116000003_f2a_carte.sql`, ligne 563). Rien ne retient la position annoncée aux détenteurs.

Le code montre une seconde conséquence, non prouvée par un test : l'alerte « lieu » de l'administration est faite par un déclencheur qui compare l'ancienne et la nouvelle ligne (ligne 1013). Les petits pas la contournent donc aussi.

**Gravité : moyenne.** Les détenteurs peuvent aller au mauvais endroit. Il n'y faut pas d'intention de nuire : deux retouches de 150 m d'une partenaire qui ajuste son repère suffisent.

**Correctif proposé.** Mesurer les 200 m depuis la dernière position annoncée aux détenteurs (enregistrée à chaque avis, sinon celle de la validation), pas depuis le repère précédent.

### T4 — Des allers-retours font une rafale de SMS « change de lieu » (point 4) — gravité faible à moyenne

**Attaque.**
1. Événement PUBLIE, un détenteur. La partenaire déplace le repère de 300 m, puis le remet en place, deux fois de suite. Chaque déplacement attend le départ du SMS du précédent : l'envoi est simulé 11 minutes plus tard, la précondition « aucun SMS en attente, au moins un parti » est vérifiée.
2. Un aller-retour de 300 m dans la même fenêtre de 10 minutes, puis l'envoi.

**Résultat : TROU** (`cvf2a-4` b, runs 233 et 234).

```
[CVF2A-4] déplacement 1 (aller, 300 m) → HTTP 200 {"success":true,"event":{"id":"8200f00e-71dd-4ca8-89f1-99c3a67f4f53","city":"Dakar","slug":null,"title":"TEST Accès cvf2a-pos-rafale 1794809051978","st…
[CVF2A-4] déplacement 2 (retour, 300 m) → HTTP 200 {"success":true,…
[CVF2A-4] déplacement 3 (aller, 300 m) → HTTP 200 {"success":true,…
[CVF2A-4] déplacement 4 (retour, 300 m) → HTTP 200 {"success":true,…
[CVF2A-4] rafale : 4 SMS et 4 notifications push au détenteur pour 4 déplacements (repère revenu à sa place) ; PUSH:SKIPPED:["position"] | EMAIL:SKIPPED:["position"] | SMS:SENT:["position"] | IN_APP:SENT:["position"] | PUSH:SKIPPED:["position"] | SMS:SENT:["position"] | IN_APP:SENT:["p…
    not ok 2 - aller-retour de 300 m quatre fois dans l’heure, chaque SMS parti avant le pas suivant : pas de rafale
      error: `rafale : 4 SMS « change de lieu » au même détenteur en moins d'une heure pour un repère revenu à sa place (SMS:SENT:["position"] | SMS:SENT:["position"] | SMS:SENT:["position"] | SMS:SENT:["position"])`
[CVF2A-4] aller-retour dans la fenêtre : repère final [14.6928,-17.4467] ; boîte d'envoi : EMAIL:SKIPPED:["position"] | SMS:SENT:["position"] | IN_APP:SENT:["position"] | PUSH:SKIPPED:["position"] | IN_APP:SENT:["position"] | EMAIL:SKIPPED:["position"] | PUSH:SKIPPED:["position"]
    not ok 3 - aller-retour de 300 m dans la même fenêtre de 10 minutes : aucun SMS « change de lieu »
        SMS « change de lieu » envoyé alors que le repère est revenu à sa place
        + [
        +   'SENT:["position"]'
        + ]
```

Les 4 « notifications push » du journal sont les 4 lignes PUSH créées, marquées SKIPPED parce que la CI n'a pas de clés VAPID. En production, un détenteur abonné aux notifications push en reçoit donc 4 de plus, en plus des 4 notifications dans l'application.

**Cause.** Chaque version de l'événement qui dépasse 200 m crée son avis. Les SMS ne sont regroupés que dans la ligne encore en attente (10 minutes) : une fois le SMS parti, le déplacement suivant en crée un autre. Dans la fenêtre, le second déplacement s'ajoute à l'avis en attente au lieu de l'annuler, alors que le repère est revenu à sa place. La famille ESSENTIAL ignore les heures calmes : ces SMS partent aussi la nuit.

**Gravité : faible à moyenne.** Pas de faille d'accès. Mais une partenaire peut faire envoyer aux détenteurs des SMS de changement de lieu à volonté, faux ou répétés, aux frais de la plateforme, de jour comme de nuit.

**Correctif proposé.** Ne prévenir que si la position diffère de plus de 200 m de la dernière position annoncée (ce qui annule l'avis d'un aller-retour), et limiter l'avis de lieu à un SMS par détenteur et par événement sur une fenêtre glissante (par exemple une heure).

### T5 — Une affiche d'avant la finition se réutilise telle quelle (point 2) — gravité faible

**Attaque.** Avant la finition, la route de dépôt gardait les octets reçus. Un tel fichier est donc posé dans `events/<A>/` : un JPEG brut avec un bloc GPS, nommé `<horodatage>_avant.jpg`, comme l'ancienne route les nommait. La partenaire l'enregistre ensuite comme affiche d'un brouillon par la route de modification.

**Résultat : TROU** (`cvf2a-2` c, runs 233 et 234).

```
[CVF2A-2] affiche d'avant la finition (JPEG brut, GPS) enregistrée → HTTP 200 {"success":true,"event":{"id":"6fbedae0-4c6f-4071-a621-424d5791b9a2","city":"Dakar","slug":null,"title":"TEST Cycle cvf2a-affiche-ancienne 1794809026792","status":"BROUILLON","program":null,"…
[CVF2A-2] affiche de l'événement : http://127.0.0.1:54321/storage/v1/object/public/public-images/events/f2a0dbf9-0be6-476f-a158-1590fa629b5c/1794809026783_avant.jpg ; fichier servi : jpeg exif=true
    not ok 1 - fichier brut avec position GPS déjà dans son dossier, enregistré comme affiche : jamais servi tel quel
      error: 'affiche servie avec ses métadonnées (GPS) : http://127.0.0.1:54321/storage/v1/object/public/public-images/events/f2a0dbf9-0be6-476f-a158-1590fa629b5c/1794809026783_avant.jpg accepté (HTTP 200 {"success":true,"event":{"id":"6fbedae0-4c6f-4071-a621-424d5791b9a2","city":"Daka…
```

**Cause.** La validation de l'adresse (`isPartnerPosterUrl`, `POSTER_FILE_RE`) et la vérification d'existence acceptent tout fichier du dossier de la partenaire, quel que soit son format. Aucune migration ne réencode les fichiers déjà stockés : le rapport de la finition le dit, « Aucune ne modifie de donnée existante ».

**Gravité : faible.** Le fichier est le sien, déjà public à son adresse. Mais l'affiche servie garde la position GPS de la prise de vue, ce que la finition voulait supprimer. Les affiches d'avant la finition encore citées sont dans le même cas, sans aucune action de la partenaire (§ 3).

**Correctif proposé.** N'accepter comme affiche que les fichiers produits par la route (`<horodatage>_<8 caractères>.webp`), et réencoder une fois les affiches existantes encore citées.

### T6 — Le remplacement et la purge effacent un fichier encore cité (point 2) — gravité faible

**Attaque.**
1. Trois affiches déposées sous `events/<P>/`, chacune citée par un événement, puis aussi par une salle, par un produit, puis comme logo du profil (`PATCH /api/partner/profile`, accepté). L'affiche de l'événement est ensuite remplacée.
2. Purge : 12 fichiers de 8 jours, puis la tâche planifiée `events-finish`. Sous `events/<P>/` : affiche citée, galerie d'une autre partenaire, salle, produit, logo, couverture, orpheline. Hors du périmètre : `halls/<P>/`, `products/<P>/`, `misc/<P>/`, la racine de `events/` et un sous-dossier de `events/<P>/`.

**Résultat : TROU** (`cvf2a-2` e, runs 233 et 234).

```
[CVF2A-2] affiche X remplacée, encore citée par salle → EFFACÉE
[CVF2A-2] affiche X remplacée, encore citée par produit → EFFACÉE
[CVF2A-2] PATCH profile logo_url = affiche → HTTP 200 {"success":true,"partner":{"id":"e626cf2b-7f0c-4900-82a4-a3815caadf3c","company_name":"TEST Finance cvf2a-affiche-remplacee 1794809027385","commercial_name":"Finance cvf2a-affiche-remplacee",…
[CVF2A-2] affiche X remplacée, encore citée par logo du profil → EFFACÉE
    not ok 1 - affiche remplacée encore citée par une salle, un produit ou le profil : gardée
[CVF2A-2] PATCH profile logo_url et cover_url (dossier events/) → HTTP 200 {"success":true,"partner":{"id":"03f7e0a8-fbac-41d6-ab6f-c8b274a063fe","company_name":"TEST Finance cvf2a-purge 1794809027850","commercial_name":"Finance cvf2a-purge","description":"Partenair…
[CVF2A-2] tâche planifiée events-finish → HTTP 200 {"ok":true,"finished":0,"ids":[],"posters":{"scanned":7,"deleted":5}}
[CVF2A-2] après la purge : affiche=gardé ; galerie=gardé ; salle=effacé ; produit=effacé ; logo=effacé ; couverture=effacé ; orpheline=effacé ; halls/<P>=gardé ; products/<P>=gardé ; misc/<P>=gardé ; events/ (racine)=gardé ; events/<P>/sous-dossier=gardé
    not ok 2 - purge : fichiers de plus de 7 jours cités (affiche, galerie, salle, produit, logo, couverture) gardés ; hors de events/ jamais touchés
```

**Cause.** `referencedPaths` (`lib/events/poster-storage.ts`) ne lit que `events.image_url` et `events.gallery_urls`. Or :
- le profil accepte une image de n'importe quel dossier de la partenaire, `events/` compris (`isPartnerImageUrl`) ;
- les salles et les produits enregistrent `images` sans aucun contrôle (`HallService.createHall`, `ProductService`).

Le test pose les images de la salle et du produit par le service. Leurs routes acceptent les mêmes adresses, mais elles sont fermées par défaut (`features.halls_enabled` et `features.orders_enabled` à false, 404). Aujourd'hui, la seule route ouverte qui place une image de `events/` ailleurs que dans un événement est donc celle du profil, prouvée ici.

**Gravité : faible.** L'interface range les images des salles sous `halls/`, celles des produits sous `products/` et celles du profil sous `misc/`. Le trou demande donc une adresse écrite à la main. Il n'efface que des fichiers de la partenaire elle-même, et rien hors de `events/<partenaire>/`. Une donnée ancienne rangée autrement serait effacée par la première purge sans que personne ne le demande : voir le contrôle E du § 5.1 du rapport de la finition.

**Correctif proposé.** Faire lire aussi à la purge et au remplacement `halls.images`, `products.images`, `partners.logo_url` et `partners.cover_url`, et refuser une adresse du dossier `events/` dans ces champs.

## 3. Remarques (pas des trous)

- **Trois routes de contrôle sans la garde de fiche, lues dans le code, non testées.** Ces trois routes n'appellent pas `ownEventFicheRefusal` :
  - `POST /api/controller/scan/incidents` : journal des incidents techniques de l'appareil (coupure réseau, délai dépassé), sans effet sur les billets ;
  - `POST /api/controller/shifts/close` : clôture de sa propre caisse seulement, qu'une fiche suspendue ne peut plus ouvrir ;
  - `POST /api/controller/setup` : activation d'un compte contrôleur.

  Je n'y vois pas d'écriture sur les événements ou les billets à refuser. À trancher avec le correctif de T1.
- **`controller_invitation_create` ne contrôle pas son auteur.** Elle n'est exécutable que par le service_role (`authenticated` révoqué) : la route est la seule barrière. Même chose pour `event_poster_path_ok`, qui accepte tout hôte dans l'adresse de l'affiche. La route, elle, impose l'adresse du stockage.
- **Les affiches d'avant la finition encore citées restent brutes.** Leurs métadonnées, dont la position GPS, restent publiques jusqu'à leur remplacement (voir T5).
- **Bandeau du formulaire.** « Description, programme, informations pratiques, affiche et position : modifiables librement. » Or un déplacement de plus de 200 m prévient les détenteurs par SMS. La partenaire ne l'apprend qu'après coup.
- **Purge bornée.** Elle liste au plus 1 000 dossiers sous `events/` et 1 000 fichiers par dossier. Au-delà, les orphelines ne sont jamais purgées. C'est un coût de stockage, pas un risque d'effacement.
- **Rapport de la finition, § 11.** Il écrit qu'une fiche « suspendue ou non validée » peut encore chercher un lieu. En réalité, EN_ATTENTE et REJETE reçoivent 403 `PARTNER_NOT_VALIDATED` (`cvf2a-3` a). Seule la fiche SUSPENDU cherche. Le code est plus strict que le texte : c'est le texte qu'il faut corriger.
- **Recherche sous charge.** Pour 3 comptes × 6 recherches distinctes en même temps, 4 réponses sont servies et 14 reçoivent « Recherche indisponible » (503). C'est la cadence de 1 appel par seconde, avec 4 s d'attente au plus. Une recherche indisponible compte quand même dans le quota : 2 des 5 recherches servies au quota de 5 étaient des 503.
- **Caractère nul.** Il n'est pas retiré de la recherche et part au service (`%00`). L'écriture du cache échoue alors (journalisée, sans erreur pour la partenaire) : la même recherche rappelle le service à chaque fois, dans la limite du quota.
- **Hors du périmètre, lu dans le code, non testé : produits.** `ProductService.createProduct` insère `{ partner_id, ...input }` avec le service_role, `input` étant le corps de la requête sans aucun schéma. Un `partner_id` placé dans le corps remplace donc celui de la session. `updateProduct` écrit de même le corps tel quel : `partner_id`, statut, toute colonne. Le service est fermé par défaut (`features.orders_enabled` à false, 404). À corriger avant toute ouverture : liste blanche des champs, `partner_id` imposé après le corps.
- **Fonctions exécutables par `authenticated`.** Sur les 196 appelées avec le jeton de la partenaire suspendue :
  - 8 s'exécutent, toutes en lecture : `auth_user_role`, `controller_assignment_active`, `has_role`, `is_admin`, `is_controller`, `is_partner_owner`, `is_superadmin`, `ticket_category_private_read` ;
  - les 188 autres sont des fonctions des extensions (`btree_gist`, `pg_trgm`), que PostgREST ne sait pas appeler (PGRST202).

## 4. Runs

| Run | Commit | Contenu | Résultat |
|---|---|---|---|
| 233 | `886a2ec8` | les 5 suites cvf2a | verify : 424 suites sur 428. Rouges : exactement `cvf2a-1`, `cvf2a-2`, `cvf2a-4`, `cvf2a-5` ; `cvf2a-3` verte (7 sur 7). Les autres suites sont vertes, dont toutes celles de `tests/audit/` et `tests/audit-auth/` qui existaient déjà. Invariants à 0. e2e vert (469 captures, 0 en échec). Trois rouges viennent de mes tests, corrigés ensuite (§ 5) : `cvf2a-1` j (2 essais arrêtés au montage) et `cvf2a-5` a (« Mes soirées » ne liste que les soirées finies). |
| 234 | `f0593858` | montage de `cvf2a-1` j et attente de `cvf2a-5` a corrigés | verify : 425 suites sur 428. Rouges : exactement `cvf2a-1` (a, b, c), `cvf2a-2` (c, e) et `cvf2a-4` (b), soit T1 à T6, avec les mêmes sorties qu'au run 233. `cvf2a-1` j (2 sur 2) et `cvf2a-5` (3 sur 3) passent, `cvf2a-3` reste verte. Toutes les autres suites sont vertes. Invariants à 0. e2e vert (469 captures, 0 en échec). |

Journaux : branche `ci-results`, dossiers `runs/233-43813860561/` et `runs/234-43821839426/` (`verify.log`, `run.txt`, `test-logs/tests__audit__cvf2a-*.log`).

## 5. Tests modifiés entre les deux runs (et pourquoi)

Seules mes cinq suites nouvelles ont changé. Aucune suite qui existait avant cette contre-vérification n'a été touchée, et aucune assertion d'attaque n'a été affaiblie.

| Fichier | Changement | Raison (run 233) |
|---|---|---|
| `tests/audit/cvf2a-1-fiche.test.ts` (j, essai direct) | Libellé ASCII passé à `newBuyer` pour l'invitation de contrôleur | L'adresse e-mail est tirée du libellé. « réactivée » donnait une adresse refusée par GoTrue (« Unable to validate email address: invalid format »). L'essai s'arrêtait avant la dernière écriture, après 6 écritures acceptées. |
| `tests/audit/cvf2a-1-fiche.test.ts` (j, par l'administration) | Motif fourni à `partner_status_set` pour la réactivation | La fonction exige un motif de 3 caractères au moins (`REASON_REQUIRED`). L'essai s'arrêtait au montage. |
| `tests/audit/cvf2a-5-fin.test.ts` (a) | « Mes soirées » : il faut que la soirée y figure si et seulement si sa fin retenue est passée, et que l'heure soit la même quand elle y figure | `controller_evenings` ne liste que les soirées finies (`end_at < now()`, ou TERMINE / ANNULE). Les trois soirées à venir y étaient absentes par construction. Le test les attendait à tort. Les deux soirées passées y figuraient, avec la bonne heure. |

## 6. Fichiers

- `tests/audit/cvf2a-helpers.ts` : montage commun (partenaire, événement à portes, événement sans porte, contrôleur, invitation, billet), relevés d'état, 12 écritures de l'équipe, dépôt d'image, stockage.
- `tests/audit/cvf2a-1-fiche.test.ts` : point 1.
- `tests/audit/cvf2a-2-affiche.test.ts` : point 2.
- `tests/audit/cvf2a-3-recherche.test.ts` : point 3 (service de recherche simulé en local).
- `tests/audit/cvf2a-4-position.test.ts` : point 4.
- `tests/audit/cvf2a-5-fin.test.ts` : point 5.
- `docs/audit-finition-2a.md` : ce rapport.
