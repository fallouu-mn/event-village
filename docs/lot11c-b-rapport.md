# Lot 11c-b — Tables d'un événement : écrans du client

Branche `lot11c/tables-client`, partie de `main` à `1c131b1830` (lot 11c-a et carte B3 fusionnés), worktree
`event-village-lot11cb`. **Fusionné dans main (`774e19a34a`), run complet de main 724 vert** (branche : run complet 723
vert). Aucune migration. Le service reste fermé par `features.event_tables_enabled` ;
les suites et le spec e2e l'ouvrent le temps de leur passage.

## À lire en premier

**Verdict.** Run complet **703** : 618/618 suites, 783 tests e2e, responsive 0 défaut, budgets JavaScript « OK » sans
relèvement, mesure mobile **95 / 92 / 93** (accueil, fiche, Mes billets ; seuil 90). Son seul rouge (une attente du spec
e2e du lot, au 4ᵉ parcours) est corrigé et prouvé vert au run **704** (responsive : spec complet, 0 défaut). Temps de
blocage de Mes billets : **376 ms avant, 316 ms après** (médianes ; détail plus bas).

**Deux défauts trouvés par les runs et corrigés** (à connaître, aucun n'est une faille) :
- **Fiche en erreur 500** (run 694) : le résumé des tables était lu en base sans cache dans la page préparée et resservie ;
  Next refuse alors la page. Le résumé passe désormais par le même cache que la fiche (`unstable_cache`, 60 s, étiquette
  `fiche-publique` déjà invalidée par les routes des tables) ; un test statique l'exige.
- **Plan d'un restaurant (lot 11b), accessibilité** (run 702) : le mot « Prise » écrit sur une table prise n'était pas dans
  le nom lu par les lecteurs d'écran. Il est maintenant décoratif (le nom lu dit déjà « prise »).

**Pas de fusion, pas de migration appliquée.** Jonction `node_modules` retirée ; worktree gardé.

- **Sécurité.** Aucune faille trouvée. Ce que le serveur ajoute est lu après le contrôle de session de chaque route, et
  ne sort que pour le bon compte : l'identifiant de la vente d'une table (qui ouvre « Ma table ») seulement pour son
  titulaire ; « Invité par Awa D. » (prénom et initiale, même forme que la base) seulement pour l'invité qui tient la
  place ; rien de la table d'un autre compte (`GET /api/event-tables/<vente>` : 404, liste vide, suivi du paiement :
  404 ; prouvé par la suite `l11cb-ecrans`, partie E). `tests/audit/` et `tests/audit-auth/` : aucune assertion changée.
- **Aucune migration.** Les places « à inviter » (« Envoyez vos 5 places ») sont calculées par le serveur, avec la règle
  du rappel déjà en base (`event_table_seats_reminders` : places à envoyer moins la sienne) ; le navigateur n'en calcule
  aucune. Aucun montant n'est calculé dans le navigateur (test statique : aucune opération sur un prix, un total, des
  frais ou des places dans les écrans).
- **Poids.** Rien des tables au premier chargement de la fiche ni de Mes billets : l'onglet « Tables », le plan de salle
  et « Ma table » sont trois modules, chacun avec **un seul** `import()` (`components/event-tables/client/load.ts`,
  `components/tables/plan/load.ts`, ce dernier repris aussi par le choix d'une table de restaurant du lot 11b). La fiche
  ne reçoit qu'une bascule de deux onglets, rendue seulement quand le serveur a trouvé une offre.
  Coût mesuré (run 703 contre main) : fiche **+777 o** gzip (marge 8 794 o), Mes billets +503 o, accueil +497 o,
  Explorer +580 o, scanner et billet hors ligne +128 et +123 o ; détail dans « Poids JavaScript ».
- **Fichiers partagés touchés** (à connaître pour la fusion, en parallèle du lot 11c-c) :
  - `components/tables/plan/FloorPlan.tsx` : la prop `labels` du lot 11c-c est **reprise à l'identique** (mêmes lignes),
    puis trois ajouts à l'écart de ses lignes (hachures et mot « Prise » en mode choix, `data-table-id`). Fusion simulée
    (`git merge-tree`) avec `origin/lot11c/tables-organisatrice` à `700e9274e4` : **aucun conflit**. Les écrans du lot 11b
    en mode choix (table d'un restaurant) gagnent aussi les hachures et le mot « Prise » ; la vue et l'édition (planning,
    pilotage) ne changent pas.
  - `components/ui/Modal.tsx` : option `fullScreen` (ajout pur, les modales existantes ne changent pas). Le contrôle du
    système de design interdit une fenêtre écrite à la main ; le plan plein écran passe donc par la modale partagée.
  - `components/tickets/TransferModal.tsx` : numéro prérempli et champ « Prénom de l'invité » facultatifs (seulement quand
    « Ma table » les donne).
  - `app/tickets/tabs.ts` : onglet `tables` (montré seulement au titulaire d'une table, ou demandé dans l'adresse).
  - `docs/apres-lancement.md` : section du lot insérée **avant** celle du lot 11c-a (le lot 11c-c ajoute la sienne à la
    fin : pas de conflit).
- **Tests existants modifiés** (deux, signalés, pour le changement demandé du lien des avis) :
  - `tests/parcours/notif-modeles.test.ts` : lien attendu de `EVENT_TABLE_CONFIRMED` et `EVENT_TABLE_SEATS_REMINDER`
    `/tickets/:event` → `/tickets?tab=tables#table-:booking`, et `:booking` ajouté aux identifiants pris dans l'exemple
    (mêmes lignes : les lignes citées par `docs/recette-billetterie.md` ne bougent pas) ;
  - `tests/schema/design1b-billets.test.ts` : les deux types ajoutés à la liste des avis qui mènent à Mes billets, avec
    leur onglet `tables` (une ligne ajoutée).

## Correctifs après contre-vérification

Contre-vérification : `docs/audit-lot11c-b.md` (branche `lot11c/cv-rouges-b`, `1a124f8ad6`). Ses trois suites
`tests/audit/cv11cb-1-trous`, `cv11cb-2-gardes`, `cv11cb-3-statique` sont reprises **sans changer une assertion**
(`009e51331c`). **Aucune migration** (la suite statique de l'audit l'exige d'ailleurs). Run complet **714**
(`a5f4db242b`, branche à jour avec `origin/main` `1c131b1830`) : **entièrement vert**.

| Trou | Correctif | Commit | Preuve (run 714) |
|---|---|---|---|
| T1 (moyen) — « La table 7 vient d'être prise » n'arrivait jamais | Le serveur réécrit **l'heure seule** (`updated_at`) des tranches **déjà publiques** de l'événement (`public_category_stock`, canal déjà écouté par l'onglet) quand une table est mise en attente, rendue (échec du paiement, prix changé) ou remboursée : aucune ligne, aucune valeur, aucun stock nouveau, aucune donnée d'un client ; les règles des billets ne changent pas. Filet : l'onglet relit l'offre toutes les 15 s tant que le plan est ouvert et l'écran visible (événement sans billet en ligne, donc sans tranche). La table que l'on paie n'est jamais annoncée « prise » (inchangé) | `ba7e360709` | `cv11cb-1` T1 **vert** : « messages reçus après la mise en attente de la table 1 : 1 » ; `l11cb-cv-correctifs` (statique) |
| T2 (moyen) — titulaire qui a envoyé toutes ses places : « Ma table » introuvable | `GET /api/tickets` sert `tables` d'après les **ventes** du compte (`event_table_bookings` actives, après le contrôle de session) : onglet « Tables » affiché tant qu'il est titulaire ; bandeau « Soirée reportée : votre table peut être remboursée » (montant de la base) avec « Voir ma table » dans Mes billets ; l'avis du report qui ouvre le remboursement (`EVENT_CHANGED`, `refund_open`) mène aux billets de l'événement (`/tickets/<événement>`), qui renvoie le titulaire vers « Ma table » (remboursement ouvert, ou plus aucun billet) | `7366d1f4cf`, `5e057d8243`, `a5f4db242b` | `cv11cb-1` T2 **vert** (« onglet lié aux billets seulement : false ») ; `l11cb-cv-correctifs` (base) : `holder` vrai sans billet, remboursement de 157 500 F annoncé, rien pour un autre compte |
| T3 (faible) — prénoms des invités gardés après une session close ailleurs | Clé des prénoms ajoutée à la portée « données du compte » de `clearDevicePrefs` (chemin « page chargée sans session », cvf2b 6.5) ; écritures **nommées** dans `lib/device/device-prefs.ts` (écrivain classé de cvf2b-6), plus d'accès générique réexporté ; `table-prefs.ts` ne touche plus au stockage. Le classement de cvf2b-6 n'est pas modifié : l'ajout au détecteur est dans un test nouveau (`tests/schema/l11cb-cv-correctifs.test.ts`) | `6a4f90b8de` | `cv11cb-3` T3 **vert** ; `cvf2b-6` vert (15/15) ; test nouveau : prénoms effacés sans session, recherches gardées, tout effacé au bouton |
| T4 (faible) — SMS du rappel vers `/tickets` | `EVENT_TABLE_SEATS_REMINDER` : `/tickets?tab=tables` ; la confirmation garde `/tickets` (157 caractères avec l'onglet). `docs/apres-lancement.md` corrigé | `5e057d8243` | `cv11cb-3` T4 **vert** ; pire cas : **GSM-7, 154 caractères, 1 segment** |
| Observation — prix changé | L'écran envoie le total **affiché** (`expectedTotal`) ; le serveur le compare au devis de la base **avant** toute attente, puis au montant **réellement créé** (course : paiement annulé avant toute demande à l'opérateur, table rendue). Refus 409 `TABLE_PRICE_CHANGED` : « Le prix de cette table a changé : 210 000 F CFA. Vérifiez avant de payer. » ; l'écran relit le devis et le bouton montre le nouveau total. Le montant du navigateur ne sert qu'à la comparaison ; sans lui, comportement d'avant (garde G1 de l'audit) | `ba7e360709` | `l11cb-cv-correctifs` (base) : refus, **aucun paiement** créé, puis paiement de 210 000 F avec le total à jour ; total forgé à 1 F : refus |
| Observation — cache | `PUT /api/admin/finance-settings` : écrire `features.event_tables_enabled` invalide aussitôt l'étiquette `fiche-publique` (page et résumé de la fiche) | `8a5561d260` | statique (`l11cb-cv-correctifs`) |

**Tests existants modifiés** (signalés) :
- `tests/parcours/notif-modeles.test.ts`, lignes 980 et 982 : texte attendu du SMS du rappel, lien `/tickets?tab=tables`
  (mêmes lignes ; conséquence directe de T4).
- Aucun autre. `tests/audit/`, `tests/audit-auth/` et `tests/schema/f5-liens-avis.test.ts` : inchangés (la lecture de
  `/tickets/<id>` a été écrite pour garder telle quelle la ligne que `f5-liens-avis` fige ; rouge au run 712, verte ensuite).

**Runs** : 712 (rapide, 78 suites + responsive + mesure) : 77/78, seul `f5-liens-avis` rouge (corrigé dans le code, voir
ci-dessus) ; responsive : seul le spec `carte-b3` à 360 px sombre (sans lien avec le lot, déjà rouge une fois au run 696,
vert aux runs 697 à 704 et 714). **714 (complet)** : **623/623 suites**, e2e **783** tests, responsive **237** tests et
190 pages × thèmes à **0 défaut**, budgets « OK », mesure **94 / 94 / 94**, toucher 80 ms, verdict vert.

**Poids et mesure, avant et après les correctifs** (avant = run complet 703 du lot ; main = run 686) :

| Route | main (686) | Lot (703) | Correctifs (714) | Écart 714 − 703 | Marge (714) |
|---|---:|---:|---:|---:|---:|
| `/` | 215 068 | 215 565 | 215 595 | +30 | 10 747 |
| `/events/[id]` | 223 745 | 224 522 | 224 552 | +30 | 8 764 |
| `/tickets` | 239 990 | 240 493 | 240 825 | +332 | 9 592 |
| `/controller/scanner` | 224 947 | 225 075 | 225 105 | +30 | 9 806 |
| `/billet/hors-ligne` | 214 066 | 214 189 | 214 219 | +30 | 10 049 |
| `/explore` | 225 578 | 226 158 | 226 441 | +283 | 9 271 |

+30 o partout : les deux clés des tables dans le module de purge (chargé par chaque page). Mes billets : l'indicateur des
tables et le bandeau du remboursement. Explorer : les fonctions nommées des préférences des tables, dans le module des
préférences de l'appareil (chargé par la recherche) — c'est le prix de T3 (écriture visible par l'audit). Aucun budget
relevé.

| Mesure mobile (médiane de 5) | main (691) | Lot (703) | Correctifs (714) |
|---|---|---|---|
| Accueil | 91 (TBT 361 ms) | 95 (TBT 255 ms) | 94 (TBT 288 ms) |
| Fiche | 91 (TBT 330 ms) | 92 (TBT 322 ms) | 94 (TBT 263 ms) |
| Mes billets | 91 (TBT **376 ms**) | 93 (TBT **316 ms**) | 94 (TBT **295 ms** ; passages 263, 346, 286, 295, 371) |

### Fusion de main (lot 11c-c) : assertion d'audit modifiée avec accord

Fusion de `origin/main` (`953914229a`, lot 11c-c fusionné en `7d45274fb6`) dans la branche : `01d883cf98`. Un seul conflit,
`tests/helpers/design-files.ts` (deux listes d'écrans ajoutées au même endroit) : les deux gardées. `FloorPlan.tsx` et
`docs/apres-lancement.md` : fusion automatique, les deux lots gardés (prop `labels` identique).

Après cette fusion, la garde « aucune migration » voyait les deux migrations du 11c-c (`20261215000001_l11cc_lectures_tables.sql`,
`20261215000002_l11cc_cv_correctifs.sql`), qui ne sont pas du lot 11c-b. **Avec l'accord de l'utilisateur et dans la forme qu'il a
donnée** (`c22c25e33c`), même changement dans `tests/audit/cv11cb-3-statique.test.ts` (G-S, lignes 128-129) et dans
`tests/schema/l11cb-cv-correctifs.test.ts` (ligne 52, message « aucune migration ») ; les vérifications suivantes du test
(abonnement unique, aucune lecture directe) sont inchangées.

Avant :

```ts
const migrations = fs.readdirSync(path.join(ROOT, 'supabase', 'migrations')).filter((f) => f > '20261210000001_cb3_lieux_publics.sql');
assert.deepEqual(migrations, [], 'migration ajoutée par le lot');
```

Après :

```ts
const toutes = fs.readdirSync(path.join(ROOT, 'supabase', 'migrations')).filter((f) => f > '20261210000001_cb3_lieux_publics.sql');
// Jusqu'à la fusion du 11c-b : seules les deux migrations du 11c-c (fusionné en 7d45274fb6) ; les lots suivants commencent à 20261216.
assert.deepEqual(toutes.filter((f) => f < '20261216'), ['20261215000001_l11cc_lectures_tables.sql', '20261215000002_l11cc_cv_correctifs.sql'], 'migration ajoutée par le lot');
assert.deepEqual(toutes.filter((f) => /l11cb/i.test(f)), [], 'migration ajoutée par le lot');
```

Avant le changement, après la fusion : `cv11cb-3` 6/7 et `l11cb-cv-correctifs` (statique) 8/9, seule cette assertion rouge ;
après : 7/7 et 9/9.

Premier run complet des deux lots ensemble (**722**, `ef2bb5bd75`) : suites 4/4 lots verts ; e2e 783 verts mais mesure mobile
**faussée** (machine trop rapide aux 3 tentatives, aucune conclusion) ; responsive à 0 défaut mais 3 tests rouges :
- spec 11c-b, « Ma table » : connexion refusée (`LOGIN_RATE_LIMITED`, 30 connexions par IP et par heure, partagées par la
  phase de connexion, `cvcb`, 11c-b et 11c-c) ;
- spec 11c-c : bouton « Modifier » introuvable : le spec 11c-b, arrêté, avait refermé le service des tables dans son
  `afterAll` pendant que le spec 11c-c tournait ;
- `cvcb` G6 (bouton « Afficher la carte » détaché) : vert au run suivant sans changement, sans lien établi avec le lot.

Correctif e2e (`4b47cf1361`) : `e2e/support/tables-service.ts`, compteur commun (fichier + verrou) ; le premier spec inscrit
note l'état d'origine du service, le dernier le remet. Le spec 11c-c l'utilise à la place de son ouverture et de sa remise
(aucun autre changement) ; le spec 11c-b connecte le titulaire et l'invitée une seule fois (cookies repris) : 12 → 6
connexions. Run complet **723** (`4b47cf1361`) : **entièrement vert** (632/632 suites, e2e 783, responsive 243 tests et
0 défaut, budgets « OK », mesure **93 / 93 / 91**, fiche TBT 279 ms). Fusion `774e19a34a` ; run complet de main **724**
vert (632/632, e2e 783, responsive 243 et 0 défaut, budgets « OK », mesure **92 / 95 / 92**, fiche TBT 250 ms).

## Décisions prises

| Sujet | Décision | Pourquoi |
|---|---|---|
| Adresse de « Ma table » | `/tickets?tab=tables#table-<vente>` (avis, paiement confirmé, confirmation) | Même forme que les billets reçus (`?tab=recus#recu-…`) ; le test des onglets de Mes billets l'exige |
| Onglet « Tables » de Mes billets | Montré seulement si un billet du compte appartient à une table dont il est titulaire (ou si l'adresse le demande) | Aucun onglet vide pour les autres comptes ; rien chargé pour eux |
| Bascule de la fiche | Lue par la page serveur (`event_table_offer` : service ouvert, types en vente), en cache avec la fiche (60 s) | Rien ne saute après l'affichage, aucune requête pour les fiches sans tables |
| Plan | Fenêtre plein écran sur téléphone ET ordinateur ; sans plan, le devis est dans le panneau de la fiche (feuille du bas sur téléphone) | La colonne de la billetterie (1/3 de la fiche) est trop étroite pour un plan et son panneau |
| Paiement | Dans la feuille du devis (opérateur, numéro, un bouton), sans la fenêtre de paiement des billets ; mêmes règles (clé d'idempotence, refus tels quels, paiement déjà en attente) | Rester sur le plan et voir « Table gardée » pendant qu'on valide dans Wave ; la fenêtre des billets n'appelle que ses deux routes |
| Numéro sans plan | Donné à la confirmation (le serveur le réserve dès l'attente, il n'est pas montré avant) | Décision du client : « reçoit un numéro après le paiement » |
| Prénom de l'invité | Saisi (ou lu dans le carnet) à l'envoi, gardé sur le téléphone du titulaire seulement, effacé à la déconnexion | Le transfert ne porte que le numéro ; garder le prénom au serveur demanderait une migration (noté dans `apres-lancement`) |
| Table prise en direct | Signal temps réel existant du stock des types ; une table qui passe de libre à prise : animation (échelle et opacité, 240 ms) et « La table 7 vient d'être prise » ; si c'était la mienne, choix remis à zéro | Décision 2 de la consigne ; la table qu'on est en train de payer n'est jamais annoncée « prise » |

## Écrans livrés

**1. Fiche d'un événement : bascule « Billets | Tables ».** Deux onglets en tête de la billetterie (« Tables » avec
« dès 120 000 F CFA »), clavier (flèches, Début, Fin). Rendue seulement si le service est ouvert et qu'un type est en
vente. L'onglet « Tables » se charge au survol, au toucher ou à l'ouverture. Une carte par type : nom, pastille
« 6 places », **prix de la table** en grand, « soit 25 000 F CFA par personne » en petit (« soit environ » quand le prix
ne se partage pas au franc près, valeur de la base), « Compris : … », « Sur place : … » (indiqué seulement), tables
restantes vraies (« 8 tables disponibles », « Plus que 2 tables », « Plus qu'une table », « Complet ») ou le refus du
serveur (« La vente des tables « … » n'est pas encore ouverte »). Indicateur « En direct ».

**2. Choix.**
- *Avec plan* : « Voir le plan et choisir ma table » ouvre une fenêtre plein écran. Plan partagé en mode choix : libre =
  contour plein, **prise = hachurée avec le mot « Prise »** et un cadenas, **la mienne = coche** ; une légende le dit
  aussi. Zoom : pincement à deux doigts, boutons « Réduire », « Plan entier », « Agrandir », touches + et −. Sur
  ordinateur, le survol d'une table (ou le focus au clavier) montre « Table 7 · Carré VIP, 6 places, soit 25 000 F CFA
  par personne, Libre ». Une table prise pendant qu'on regarde se grise avec une courte animation et le bandeau « La
  table 7 vient d'être prise » ; si c'était la table choisie : « … Choisissez-en une autre. », choix remis à zéro.
- *Sans plan* : le client choisit un type (carte à cocher) ; « Son numéro vous est donné après le paiement ».
- Retour de la connexion (`/events/<id>?tables=1`) : le choix gardé (30 min) est repris s'il est encore libre.

**3. Devis et achat.** Téléphone : feuille du bas (au-dessus de la barre de navigation sur la fiche, posée sur le plan dans
la fenêtre) ; ordinateur : panneau collant dans la billetterie, ou colonne à droite du plan. Devis de la base : « Table 2
· Carré VIP · 6 places », total « 157 500 F CFA frais compris », « Détail du prix » (table, frais de service, total, prix
par personne hors frais), ce qui est compris, le minimum sur place, la règle de remboursement. **Un seul grand bouton** :
« Réserver la table 2 » (ou « Réserver une table Carré VIP »). Non connecté : connexion par le parcours existant, choix
gardé. Puis, dans la même feuille : opérateur (Wave, Orange Money), numéro du payeur (prérempli par le dernier paiement
de ce téléphone ou le profil), « Payer 157 500 F CFA avec Wave ». Numéro du compte non vérifié : la vérification par
code existante s'ouvre, puis l'achat repart. Paiement déjà en attente : « Suivre le paiement ». Table prise entre-temps
(`TABLE_TAKEN`, `TABLES_SOLD_OUT`) : retour au choix avec le message du serveur.
Ensuite **« Table gardée 9:42 »** (fin servie par le serveur, `expires_at`) avec une horloge ; à 1 minute : icône
d'avertissement et « Moins d'une minute : validez le paiement maintenant » ; à 0 : « Délai de garde passé. Si vous avez
validé le paiement, il est encore vérifié : ne payez pas une seconde fois. » Le lecteur d'écran n'entend que le début, la
dernière minute et la fin. L'écran suit le paiement tout seul (toutes les 3 s, et au retour sur l'onglet) ; échec ou
expiration : « Le paiement n'a pas abouti : la table est libérée. »

**4. Confirmation.** Coche qui se dessine, légère vibration (si le téléphone la propose, sans « réduire les
animations »), carte de la table (« Table 2 · Carré VIP », 6 places, total payé), puis tout de suite **« Envoyez vos 5
places »** (vers « Ma table », nombre servi par le serveur) et « Ajouter à mon agenda » (fichier .ics ou Google Agenda).

**5. « Ma table » dans Mes billets.** Onglet « Tables », visible pour le titulaire d'une table (et par l'adresse
`/tickets?tab=tables#table-<vente>`, qui amène la table à l'écran). Une carte par table : événement, « Table 2 · Carré
VIP », date et lieu ; compteurs **« 1/6 places envoyées »**, « 1 en attente », et **« 2/6 entrés »** le soir même (ou dès
une entrée). Rangée de places : « Vous » (initiales du compte), invité accepté = avatar plein à ses initiales, en attente
= pointillés et « •• 42 » (et le prénom saisi), à envoyer = pointillés « + Inviter », entrée = coche ; un avatar se
remplit (courte animation) quand l'invité accepte. Encart « Envoyez vos 3 places » : « Inviter par son numéro » (transfert
existant, prénom facultatif gardé sur ce téléphone), « Depuis mes contacts » (carnet du téléphone, quand le navigateur le
permet), « Prévenir mes invités par WhatsApp » (lien du serveur, sans jeton). Après un report de plus de 24 h : bandeau
« La soirée a été reportée de plus de 24 h » avec le montant (« 157 500 F CFA, jusqu'au … »), « Me faire rembourser la
table », puis confirmation qui redit le montant et que les places des invités seront annulées. État vide illustré.
Sur la carte du billet du titulaire : « Gérer ma table et mes invités ».

**6. Côté invité.** Son billet affiche « Table 2 · Carré VIP » (vignette et carte) et « Invité par Awa D. ».

**7. Avis.** `EVENT_TABLE_CONFIRMED` et `EVENT_TABLE_SEATS_REMINDER` mènent à « Ma table » (cloche, notification du
téléphone, email). Le paiement confirmé (page de suivi) aussi ; « Réessayer le paiement » rouvre l'onglet « Tables ».

## Tests et accès

| Suite | Ce qu'elle prouve |
|---|---|
| `tests/parcours/l11cb-ecrans.test.ts` (nouvelle, base locale) | A. bascule : rien sans type ni service fermé, « 1 type, dès 150 000 F » sinon. B. parcours avec plan : offre (plan, table LIBRE, prix par personne, minimum sur place en texte), devis (total = prix + frais, calculé à la main), achat (`expires_at` dans le futur, table tenue = table choisie), suivi pendant l'attente (`retry_url` vers l'onglet, aucune vente), table vue PRISE par un autre visiteur, paiement confirmé (`success_url` et `table_booking_id` vers « Ma table »), « Ma table » (`invite_left` = 5, WhatsApp sans jeton), 6 billets du titulaire libellés « Table N · type » avec `bookingId`, envoi d'une place (en attente, places à inviter 4), acceptation, billet de l'invité « Invité par Awa D. » **sans** `bookingId`, compteurs, prénom de l'invité, avis de confirmation et son lien. C. sans plan : devis sans table, numéro attribué. D. report de plus de 24 h : montant affiché = total payé, confirmation exigée (400), remboursement (200), table REFUNDED. E. accès : « Ma table » d'un autre compte 404 sans rien de la table, liste vide, suivi du paiement 404, aucune place de table chez lui, sans session 401. F. liens des deux avis |
| `tests/schema/l11cb-ecrans-statique.test.ts` (nouvelle, 14 tests) | un seul `import()` par module (onglet, Ma table, plan) ; fiche, bascule, Mes billets et carte du billet n'importent que les chargeurs ; résumé dans le cache de la fiche ; **aucune opération arithmétique** sur un prix, un total, des frais ou des places dans les écrans (détecteur auto-testé) ; places à inviter servies par le serveur ; refus affichés tels quels ; animations par échelle et opacité, coupées si « réduire les animations », vibration conditionnelle ; hachures, « Prise », coche, boutons de zoom, pincement, survol ; compte à rebours ; liens ; fichiers déclarés au système de design |
| `e2e/lot11cb.responsive.spec.ts` (nouveau, job responsive) | vrai parcours à l'écran (connexion, plan, devis, Wave, compte à rebours, faux SamirPay + vrai webhook, confirmation), fiche sans plan, « Ma table » du titulaire, billet de l'invité ; contrôle responsive (0 défaut bloquant) et capture de chaque écran, 390 et 1 440 px, clair et sombre |
| `tests/parcours/design-systeme.test.ts` (existante) | les 8 écrans nouveaux respectent le contrat du système de design (jetons, tailles, accessibilité) |
| `tests/audit/cvf2b-6-deconnexion.test.ts` (existante, **non modifiée**) | rouge au run 694 sur une écriture du stockage du navigateur non classée (choix gardé dans `sessionStorage`) ; corrigé dans le code (préférences de l'appareil, effacées à la déconnexion), verte ensuite |

**Accès vérifiés** : « Ma table » d'un autre compte (route unitaire et liste), suivi du paiement d'un autre compte, billets
d'un autre compte, sans session. Ce que voit un invité : le libellé de la table et le prénom avec l'initiale du
titulaire, jamais l'identifiant de la vente ni les autres places. Rien des tables n'est lisible par l'API REST (aucune
lecture nouvelle) ; toutes les lectures passent par les routes du serveur après le contrôle de session.

## Poids JavaScript et mesure mobile

**Avant** : main `1c131b1830`, poids du run complet 686 (même code JavaScript que main), mesure du run 691 (ci-perf).
**Après** : run complet **703** (`3bfbd8d955`, code final des écrans ; le run 704 ne change que le spec e2e).

Poids des routes (octets gzip, `js-budget.tsv`) — **aucun budget relevé**, toutes « OK » :

| Route | Avant (686) | Après (703) | Écart | Budget | Marge après |
|---|---:|---:|---:|---:|---:|
| `/` | 215 068 | 215 565 | +497 | 226 342 | 10 777 |
| `/events/[id]` (fiche) | 223 745 | 224 522 | +777 | 233 316 | **8 794** |
| `/tickets` (Mes billets) | 239 990 | 240 493 | +503 | 250 417 | 9 924 |
| `/controller/scanner` | 224 947 | 225 075 | +128 | 234 911 | 9 836 |
| `/billet/hors-ligne` | 214 066 | 214 189 | +123 | 224 268 | 10 079 |
| `/explore` | 225 578 | 226 158 | +580 | 235 712 | 9 554 |

D'où viennent ces octets (détail des morceaux du run 694, mêmes causes au 703) :
- **toutes les routes** : registre des morceaux (`webpack.js`, +33 o : les trois modules chargés à la demande),
  `ui-base.js` +45 o (option plein écran de la modale partagée), `90229.js` +5 o ;
- **fiche** : `app/events/[id]/page.js` +1 162 o (la bascule « Billets | Tables » et son chargeur), en partie compensés
  par un morceau partagé réorganisé (−511 o) ;
- **Mes billets** : `page.js` +440 o (onglet « Tables », chargeur de « Ma table », deux lignes de la carte du billet) ;
- **accueil et Explorer** : un morceau partagé de 5 131 o est découpé par webpack en deux (2 879 + 2 620 o, +368 o).
  Aucun code des tables n'y entre : c'est l'effet du regroupement des modules partagés (Button, format, aides de
  paiement) quand de nouveaux morceaux à la demande les utilisent aussi. Les préférences propres aux tables ont été
  sorties du module chargé au premier affichage (`lib/device/table-prefs.ts`), sans changer ce découpage. Piste pour un
  prochain lot de poids : une règle `splitChunks` pour ce groupe, comme `ui-base` au lot Carte B3 (non essayée ici :
  aucune construction locale).

Mesure mobile (Lighthouse, médiane de 5 passages, seuil 90) :

| Page | Avant (691) | Après (703) |
|---|---|---|
| Accueil | 91 (TBT médian 361 ms) | **95** (TBT 255 ms) |
| Fiche | 91 (TBT 330 ms) | **92** (TBT 322 ms) |
| Mes billets | 91 (TBT 376 ms) | **93** (TBT **316 ms**) |

**Temps de blocage (TBT) de Mes billets** : avant 376 ms (médiane ; passages 641, 314, 376, 415, 290 ms) ; après
316 ms (médiane ; passages 337, 243, 239, 344, 316 ms). Au run rapide 696 (même code que 703 pour Mes billets) : 376 ms
(432, 438, 372, 376, 273 ms), score 91. L'écart tient à la variance de la machine de CI : la page ne gagne aucun travail
au premier chargement (l'onglet « Tables » n'apparaît que pour un titulaire, « Ma table » n'est chargée qu'à son
ouverture). Toucher : 80 ms au plus (seuil 200 ms).

## Captures

Publiées sur `ci-results`, dossier **`runs/704-45777361141/captures-responsive/`** : 28 captures
`l11cb-<écran>__<largeur>__<thème>.jpg`, écrans `fiche-plan`, `plan-devis` (plan et feuille de devis),
`compte-a-rebours`, `confirmation`, `fiche-sans-plan`, `ma-table`, `billet-invite`, à 390 et 1 440 px, clair et sombre,
chacune après le contrôle responsive (0 défaut). Le run 703 en a 21 (le 4ᵉ parcours s'arrêtait sur l'attente du spec).
Relues : plan hachuré avec « Prise » et cadenas, table choisie cochée, feuille du bas avec le total et un seul bouton ;
panneau à droite du plan sur ordinateur (détail du prix, compris, sur place, règle de remboursement) ; « Table gardée
10:00 » avec son icône ; coche, carte de la table, « Envoyez vos 5 places », agenda ; « Ma table » en sombre (« 1/6
places envoyées », « 1 en attente », avatars « Vous », « Awa S. », place en attente « •• 69 », trois « + Inviter »,
« Envoyez vos 3 places ») ; billet de l'invité (« Table 1 · Carré VIP », « Invité par Awa S. »).

## Runs

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 694 | `c84c9a8770` | rapide (112 suites qui citent les routes, tables et écrans touchés) + responsive + mesure | 111/112 : `cvf2b-6-deconnexion` rouge (écriture `sessionStorage` du choix gardé, non classée) ; **fiche en erreur 500** (résumé des tables lu sans cache dans la page préparée : « Page changed from static to dynamic at runtime ») ; mesure de la fiche impossible (500) ; spec e2e arrêté au premier écran (500) |
| 696 | `2d87696ca5` | rapide (34 suites) + responsive + mesure | suites vertes ; mesure 93 / 91 / 91 ; responsive : carte de survol du plan sur la phrase d'aide à 390 px (+ `carte-b3` rouge une fois, verte aux runs suivants, sans lien avec le lot) |
| 697 | `d67fe7316a` | responsive | la carte de survol rouverte par le focus du clic, sur les numéros des tables |
| 699 | `f50d710249` | responsive | plan et compte à rebours verts ; le spec visait l'ancien titre de la fenêtre à la confirmation |
| 700 | `5dcfffbe45` | responsive | parcours complet vert à 390 px clair (captures relues) ; à 1 440 px, sélecteur du spec qui trouvait deux tables prises |
| 702 | `f43a7bab31` | **complet** | 4 lots de tests verts, build, budgets et mesure OK ; rouges : captures e2e `tables-fiche-plan` du lot 11b (axe `label-content-name-mismatch` : mot « Prise » visible absent du nom lu) et légende du plan coupée à 1 440 px |
| 703 | `3bfbd8d955` | **complet** | **618/618 suites**, e2e **783** tests verts (captures, recette, fumée…), budgets OK, mesure 95 / 92 / 93, toucher 80 ms, responsive 190 pages × thèmes **0 défaut** ; seul rouge : une attente du spec du lot au 4ᵉ parcours (« Plus que N tables » alors que le Carré VIP était complet) |
| 704 | `2685b17cc7` | responsive (+ statique du lot) | **vert** : spec du lot entier (8 tests : 4 parcours d'achat, 4 « Ma table » et billet de l'invité), responsive 0 défaut |

Le run 703 est le run complet de référence du code ; le run 704 ne change que l'attente du spec e2e (texte des tables
restantes) et le prouve vert. Aucun run sur `main`.

## Essais pour un non-développeur

Sur une copie de recette, après la fusion (le service des tables s'ouvre dans les réglages du super-administrateur,
section « Tables des événements » ; l'organisatrice crée ses types et son plan avec les écrans du lot 11c-c) :

1. **Fiche avec plan.** Ouvrir la fiche d'un événement qui a des tables : deux onglets « Billets » et « Tables » en haut
   de la billetterie. Toucher « Tables » : une carte par type, avec le prix de la table en grand et le prix par personne
   en petit. Toucher « Voir le plan et choisir ma table ».
2. **Plan.** Les tables libres ont un contour plein, les prises sont hachurées et écrivent « Prise ». Pincer pour
   zoomer (ou les boutons + et −). Toucher une table libre : elle prend une coche, la feuille du bas montre son prix total.
   Sur ordinateur, passer la souris sur une table : type, places, prix par personne.
3. **Table prise en direct.** Garder le plan ouvert sur un téléphone ; sur un autre appareil, réserver une table : sur le
   premier, elle se grise et « La table 7 vient d'être prise » s'affiche.
4. **Achat.** Toucher « Réserver la table N », choisir Wave, payer. « Table gardée » compte les minutes ; à moins d'une
   minute, il passe en avertissement. Une fois payé : coche, carte de la table, « Envoyez vos 5 places ».
5. **Ma table.** Toucher « Envoyez vos 5 places » : Mes billets s'ouvre sur l'onglet « Tables ». Toucher « + Inviter »,
   écrire un prénom et le numéro d'un proche, envoyer : la place passe en pointillés « en attente ». Le proche se connecte
   avec ce numéro et accepte le billet (onglet « Reçus ») : l'avatar se remplit de ses initiales, « 1/6 places
   envoyées ».
6. **Invité.** Sur le compte du proche, Mes billets : son billet montre « Table N · Carré VIP » et « Invité par … ».
7. **Sans plan.** Sur un événement dont le plan n'est pas montré : choisir un type, le devis apparaît, le numéro est donné
   après le paiement.
8. **Report.** L'organisatrice décale l'événement de plus de 24 h : dans « Ma table », « Me faire rembourser la table »
   avec le montant ; confirmer : la table passe « Remboursée ».
9. **Sans tables.** Une fiche sans type de table ne montre aucun onglet : rien ne change.

## Autres idées

- Choisir sa table **par sa vue** : photo ou petite vue de la scène depuis chaque zone, dans la carte de survol.
- « Ma table » **le soir même** : écran de porte du titulaire, QR de toutes ses places à la suite pour faire entrer ses
  invités avec lui (le scanner sait déjà les lire une à une).
- Rappel **au titulaire, le jour même**, quand des places restent à envoyer (le rappel de la veille existe).
- Partage **d'une place précise** par WhatsApp : le lien reste sans jeton, mais le message dit « ta place t'attend,
  connecte-toi avec ce numéro ».
- Sur le plan, **filtre par type** (« Montrer seulement les Carrés VIP ») et numéro de table recherché au clavier.
- Prix par personne **après partage des frais** (« 26 250 F avec les frais »), si le client le souhaite.
