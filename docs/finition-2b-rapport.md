# Finition 2b — Fin de la création d'un événement

Branche `finition-2b/creation` (worktree `event-village-finition2b`), partie de main `fb3dcbcd6`. Main a reçu ensuite la finition 3a (`fdaa6c365`) : je l'ai fusionnée dans la branche avant le run complet (§ 6). **Rien n'est fusionné dans main.** Branche des rouges : `finition-2b/rouges` (tests seuls posés sur main, jamais fusionnée).

## À lire en premier

**Faille trouvée hors de la 2b, non corrigée : décision demandée (déconnexion sans réseau).** Trouvée par la relecture du correctif du run 275 ; elle existait avant la 2b.
- **Scénario.** Téléphone partagé, sans réseau depuis plus d'une heure. « Se déconnecter » affiche l'écran de connexion, mais la session n'est pas fermée : sans réseau, la fermeture échoue et l'erreur est ignorée (`AuthProvider.signOut`, et les deux boutons « Se déconnecter » du contrôleur). Au retour du réseau, la personne suivante qui ouvre l'application se retrouve dans le compte précédent.
- **Pourquoi pas dans la 2b.** C'est l'authentification, pas la création d'un événement. Il faut décider ce que l'écran dit quand la déconnexion est impossible. Et la correction ajoute du code à chaque page : il reste une quarantaine d'octets sous le budget de la page d'accueil.
- **Proposition.** Sans réseau, ne pas faire croire à la déconnexion (« Déconnexion impossible sans connexion : réessayez une fois connecté. ») et la terminer d'elle-même au retour du réseau ; test rouge puis vert sur ce scénario.

**Faille trouvée et corrigée en premier (A4, sécurité faible).** Supprimer une catégorie sans vente effaçait aussi ses admissions dans les zones (clé étrangère `ON DELETE CASCADE` de `zone_categories`), sans revérifier les zones. Une zone pouvait ainsi rester sans aucune catégorie admise : chaque billet présenté à ses portes était alors refusé au scanner. Désormais, la suppression est refusée (`CATEGORY_ONLY_IN_ZONE`, 409), avec un message qui nomme la ou les zones et l'étape où les régler. Migration `20261119000001` ; test `f2b-categorie-zone` (rouge : la suppression réussissait et vidait la zone).

Aucune autre faille dans le périmètre de la 2b. Contrôles faits :
- **Route nouvelle** `POST /api/partner/events/[id]/notice-preview` : mêmes contrôles que `PUT` (session active, organisatrice, propriétaire, statut, version attendue) par une validation commune (`prepareUpdate`).
  - Fiche suspendue : refusée par la garde de la session, comme toute écriture sous `/api/partner/events/`.
  - La base calcule l'aperçu en exécutant `event_update` puis en l'annulant : mêmes refus, rien d'écrit (§ 3.4).
- **Route nouvelle** `GET /api/partner/ticketing-rules` : session de partenaire exigée, rend le seul minimum du prix.
- **Fonctions nouvelles de la base** : toutes réservées au service_role (`r3-fonctions-rpc`, bloc « finition 2b », 5 fonctions, 42501 pour anon et pour un compte).
- `tests/audit/` et `tests/audit-auth/` : verts au run complet (§ 6).

**Ajout à la consigne (16/11), traité :**
1. **Recherche de lieu.**
   - Avant : le limiteur espaçait les réservations de créneau, pas les appels. Au run 252 de la 3a, deux appels sont partis à 801 ms d'écart.
   - Maintenant, l'appel attend l'heure de son créneau. Il ne part que si son retard sur ce créneau reste sous 150 ms et qu'au moins une seconde s'est écoulée depuis le dernier appel ; sinon, un autre créneau est réservé.
   - Les créneaux sont espacés de 1,3 s : deux appels sont séparés de 1,15 s au moins, toutes instances confondues.
   - `cvf2a-3-recherche` rejouée 5 fois en mode rapide : verte les 5 fois (§ 6).
2. **`notif-envoyeur`.**
   - Avant : le vidage s'arrêtait dès qu'un passage réservait moins de 1 000 lignes, alors qu'un passage peut examiner sans réserver.
   - Maintenant, il compte en base les lignes encore dues et repasse jusqu'à zéro.
   - Pour que ce cas soit joué à chaque fois, le test pose une file de 2 500 lignes examinées sans être réservées. Assertions inchangées.
   - Rejouée 5 fois : verte les 5 fois. Avec l'ancien vidage, la même file la fait échouer (branche des rouges, § 6).
3. **Ordre des migrations.**
   - Main fusionnée dans la branche ; mes migrations `20261119…` passent après les `20261117…` de la 3a, sans renumérotation.
   - Aucun objet de la base n'est commun aux deux finitions.
   - Une assertion le vérifie à chaque run (`migration-finition2b-rejouable`).

## 1. État de chaque point

| Point | État | Preuve |
|---|---|---|
| A. Couleur et consigne à la création et sur une catégorie nouvelle (E-22) | Fait : schéma, `ticket_category_normalize`, `event_create` | `f2b-couleur-consigne` |
| A. Couleur proposée par l'écran, distincte par catégorie, posée par la base si elle manque | Fait. Ordre : Blanc, Noir, Violet, Rose, Turquoise, Bleu, Argent, puis la moins utilisée. « Or », proche de l'orange « mauvaise zone » et de l'ambre « hors fenêtre », n'est jamais proposé (choix manuel possible). Modifiable. | `f2b-couleur-auto` |
| A. Prix minimum (E-26) | Fait. L'écran lit le minimum par le serveur, l'aide le dit, le contrôle a lieu dès « Suivant ». Un refus du serveur s'affiche sous le prix de la bonne catégorie, étape Billets ouverte. | `f2b-prix-minimum` |
| A. Suppression d'une catégorie sans vente | Fait : refus clair (faille ci-dessus) | `f2b-categorie-zone` |
| A. « Type d'événement » (E-66) ; « Leaflet » retiré du pied des cartes, « © contributeurs OpenStreetMap » gardé | Fait | `f2b-type-evenement`, `f2b-pied-cartes` |
| B. Étape 5 « Contrôle à l'entrée (facultatif) » (E-23) | Fait.<br>• Partie écriture de `event_zones_save` sortie dans `event_zones_write` (règles du formulaire : `event_zones_form_refusal`).<br>• Catégories insérées avant les zones, désignées par leur ordre, dans la même transaction que l'événement.<br>• En modification, la même étape utilise l'enregistrement des zones ; les couleurs y sont modifiables.<br>• Le lien de la page Équipe y mène. | `f2b-zones-creation` (mêmes verdicts au scanner, zones créées avec l'événement ou ajoutées après) |
| C. Vérifier avant d'envoyer (E-24) | Fait.<br>• Récapitulatif avec « Modifier » par étape.<br>• Liste des manques identique au refus de la base : mêmes textes, même ordre.<br>• « Envoyer pour validation » depuis le formulaire ; la soumission depuis la liste reste. | `f2b-verifier-envoyer` (parité écran / base sur 4 cas) |
| C. Téléphone : nom de l'étape visible, barre fixe « Précédent / Suivant » | Fait.<br>• La barre « Navigation rapide » de l'application est masquée tant que celle du formulaire est affichée : attribut posé par le formulaire, règle CSS, tous navigateurs (rien dans le JavaScript de chaque page, § 6).<br>• Étape Accès : en défilant, la carte passe sous la barre ; « Suivant » n'est jamais recouvert. | `f2b-telephone`, captures 390 px (« Navigation rapide » masquée et carte sous la barre, contrôlées dans le navigateur) |
| C. Brouillon dans le navigateur, par compte et par événement | Fait.<br>• Lectures et écritures protégées, 64 Kio au plus, rien côté serveur.<br>• Au retour : « Reprendre votre saisie du {date} à {heure} ? », avec « Reprendre » et « Effacer ».<br>• Effacé à l'envoi.<br>• À la déconnexion et à toute fin de session signalée au navigateur, tous les brouillons de ce navigateur sont effacés, quel que soit le compte (appareil partagé ; § 6). | `f2b-brouillon-local` |
| C. Bouton Retour d'Android | Fait : entrée d'historique sentinelle, la fenêtre « Quitter sans enregistrer ? » s'ouvre | `f2b-brouillon-local` |
| D. Fiche admin de validation : couleurs, consignes, portes, zones (E-25) | Fait | `f2b-fiche-admin` |
| D. Message de validation : prochaines étapes (cloche, push, email ; SMS inchangé) | Fait | `f2b-message-validation` |
| D. Encadré de modification réécrit ; aide « seront prévenus » dès Validé et sous la date et l'heure de fin | Fait. L'aide est aussi sous l'heure de début, qui prévient de même. | `f2b-prevenir` (g) |
| D. Fenêtre « Prévenir » avant d'enregistrer date, heure, lieu, repère (> 200 m) ; heure réelle (E-27) | Fait | `f2b-prevenir` (a à f) |
| D. Cadence des avis de lieu ET de date (E-28) | Fait.<br>• Un SMS par détenteur et par heure glissante, changements regroupés.<br>• À moins d'une heure du début : tout de suite, deux SMS au plus. | `f2b-cadence-avis` |

Ce qui ne rentre pas : `docs/apres-lancement.md`, section « Création d'un événement (finition 2b) ».

## 2. Textes nouveaux (exacts)

**Billets.**
- Champs « Couleur au contrôle » et « Consigne d'entrée ».
- Couleur partagée : « Même couleur que « {catégorie} » : au contrôle, ces catégories auront la même bande. »
- Aide du prix : « Billet payant : {min} F CFA au moins. 0 pour une entrée gratuite. »
- Suppression refusée (une zone) : « La zone « {zone} » n'admet que cette catégorie : elle resterait sans catégorie. Avant de la supprimer, cochez une autre catégorie pour cette zone ou retirez la zone, à l'étape « Contrôle à l'entrée ». » Pour plusieurs zones : « Les zones « … » et « … » n'admettent que cette catégorie… ».

**Informations.**
- « Type d'événement ».
- Erreur : « Choisissez un type d'événement dans la liste. »

**Étape 5.**
- Titre : « Contrôle à l'entrée (facultatif) » ; sections « Couleurs au contrôle » et « Plusieurs portes ou zones ».
- Sans réglage : « Une seule entrée : chaque contrôleur laisse entrer toutes les catégories. »
- Page Équipe : lien « Modifier les portes et les couleurs ».

**Vérifier.**
- Titre : « Vérifier avant d'envoyer » ; un « Modifier » par étape.
- Manques : « Un point à compléter avant d'envoyer » ou « {n} points à compléter avant d'envoyer », suivis des textes de la base.
- Bouton « Envoyer pour validation ».

**Brouillon.**
- « Reprendre votre saisie du {date} à {heure} ? » avec « Reprendre » et « Effacer ».
- « Une saisie non enregistrée est gardée sur cet appareil. »

**Message de validation.**
- Cloche et push : « « {titre} » est validé. Prochaines étapes : réglez les portes, invitez vos contrôleurs, générez le code PIN de caisse, puis publiez-le. »
- Email : liste « Prochaines étapes » (4 lignes) et bouton « Ouvrir Event Village ».
- SMS inchangé, un segment.

**Encadré de modification.** Titre « Votre événement est validé : ce que vos modifications changent ». Puces :
- « Description, programme, informations pratiques et affiche : modifiables à tout moment, personne n'est prévenu. »
- « Dates, heures, lieu, ville et adresse : les détenteurs de billets, invités compris, sont prévenus dans l'application et par SMS. Avant d'enregistrer, vous voyez combien recevront un SMS et à quelle heure. »
- « Titre : les détenteurs de billets sont prévenus dans l'application. »
- « Déplacer le repère de plus de 200 m prévient les détenteurs de billets par SMS. » (inchangée)
- « Un seul SMS par heure : les changements faits dans l'heure partent ensemble. À moins d'une heure du début, l'avis part tout de suite. »
- La puce « Type d'événement : verrouillé dès qu'un billet est vendu, réservé ou offert. Jauge : … » est gardée.

**Fenêtre « Prévenir ».**
- Titre « Prévenir les détenteurs de billets » ; boutons « Enregistrer et prévenir » et « Annuler ».
- Phrase : « {n} détenteurs seront prévenus par SMS {à HH:MM | tout de suite}. » (« 1 détenteur sera prévenu… »).
- Puis, selon le cas :
  - « Vos corrections faites d'ici là partiront dans le même SMS. »
  - « Un avis est déjà parti il y a moins d'une heure : un seul SMS par heure, vos changements d'ici là y seront regroupés. »
  - « L'événement commence dans moins d'une heure : l'avis part dès l'enregistrement, deux SMS au plus dans cette dernière heure. »

**Bilan après l'enregistrement.**
- Nouveau : « {n} SMS partent tout de suite. » (« 1 SMS part tout de suite. »).
- Nouveau : « Le changement sera annoncé aux détenteurs de billets à {HH:MM} : un seul SMS part par heure, vos changements d'ici là y seront regroupés. »
- Inchangé : « … SMS partiront dans 10 minutes (vos corrections d'ici là y seront regroupées). »

## 3. Ce qui change, en bref

### 3.1 Couleur au contrôle
- **La base pose la couleur quand elle manque.** Le déclencheur `trg_ticket_categories_auto_color` agit à l'insertion, et à la modification de `scan_color` quand la valeur est vide.
- **Catégories existantes sans couleur** : remplies par la migration 03, dans l'ordre de l'événement, du prix et du nom.
- **Choix d'une couleur** : jamais le vert « valide », le rouge « refusé » ou l'orange « mauvaise zone », qui ne sont pas dans la palette du scanner. « Or » n'est jamais proposé.

### 3.2 Zones à la création
- **Corps de la création** : `zones: [{ name, kind, position?, category_refs: [ordre des catégories], gates: [{ name }] }]`.
- **Refus d'une zone** : la création entière est annulée (aucune ligne écrite), et le refus est rangé sous le champ de la zone.

### 3.3 Cadence des avis (date et lieu)
- **Retenue d'une heure.** Elle couvre aussi les champs de date (`event_place_notices`), quand :
  - un SMS de lieu ou de date est parti il y a moins d'une heure ;
  - et aucun SMS n'est en attente (sinon, le changement rejoint le SMS en attente).
- **À l'échéance**, l'avis retenu part avec les valeurs du moment.
- **À moins d'une heure du début**, l'avis n'est jamais retenu : il part tout de suite. Au-delà de deux SMS par détenteur dans cette heure, l'avis n'est pas envoyé par SMS (ligne `SKIPPED`, raison `LAST_HOUR_CAP`) ; la notification dans l'application part quand même.

### 3.4 Aperçu de la fenêtre « Prévenir »
- **`event_update_preview(p)`** exécute `event_update(p)` dans un sous-bloc, puis lève une erreur qui l'annule. Il rend le nombre de SMS et l'heure réelle de l'avis : fenêtre de 10 minutes, retenue d'une heure, ou tout de suite.
- **Mêmes règles, mêmes refus**, y compris les 200 m mesurés depuis la position annoncée.
- **Rien n'est écrit** : `f2b-prevenir` compare la ligne de l'événement, la file des avis, les retenues et le journal avant et après.
- **L'écran ne demande l'aperçu** que si un champ de date, d'heure, de lieu, de ville, d'adresse ou de repère change, et que l'événement est Validé, Publié ou Suspendu. Sans SMS à envoyer, il enregistre directement.

## 4. Migrations à appliquer sur event-village-dev

**Pré-requis : la finition 3a appliquée** (`20261117000001` à `…04`).

| Ordre | Migration | Ce qu'elle fait |
|---|---|---|
| 1 | `20261119000001_f2b_categorie_zone.sql` | `ticket_category_delete` recopiée : refus `CATEGORY_ONLY_IN_ZONE` |
| 2 | `20261119000002_f2b_couleur_consigne.sql` | `ticket_category_normalize`, `ticket_category_create`, `event_create` : couleur et consigne |
| 3 | `20261119000003_f2b_couleur_auto.sql` | `ticket_category_auto_color`, déclencheur `trg_ticket_categories_auto_color`, **remplissage des catégories sans couleur** (seule écriture de données) |
| 4 | `20261119000004_f2b_prix_minimum.sql` | `ticket_category_normalize` : refus `PRICE_BELOW_MINIMUM` sous la bonne catégorie |
| 5 | `20261119000005_f2b_zones_creation.sql` | `event_zones_form_refusal`, `event_zones_write` ; `event_zones_save` et `event_create` recopiées |
| 6 | `20261119000006_f2b_cadence_avis.sql` | Contrainte des champs retenus élargie, `event_notice_recipient_count` ; `event_change_notify`, `event_update`, `event_place_notices_release`, `notif_place_notice_sent` recopiées |
| 7 | `20261119000007_f2b_apercu_avis.sql` | `event_update_preview` |
| 8 | `20261119000008_f2b_cadence_recherche.sql` | `place_search_slot` recopiée : créneaux espacés de 1,3 s |

- **Écriture** : toutes sont sans BEGIN ni COMMIT et rejouables (`migration-finition2b-rejouable`) ; aucune ne supprime de donnée.
- **Fonctions nouvelles** : réservées au service_role.
- **Déploiement** : déployer l'application juste après, dans la même fenêtre. Entre les deux, l'ancienne application fonctionne : elle ignore simplement les nouveaux champs de la réponse.

### 4.1 Avant `db push` (éditeur SQL, une requête à la fois, garder les résultats)

```sql
-- A. attendu : 20261117000004 (finition 3a appliquée), aucune 20261119…
select max(version) from supabase_migrations.schema_migrations;

-- B. catégories sans couleur au contrôle (garder le nombre) : la migration 03 les remplit
select count(*) filter (where scan_color is null) as sans_couleur, count(*) filter (where scan_color is not null) as avec_couleur from public.ticket_categories;

-- C. zones qui n'admettent qu'une catégorie (garder la liste) : la suppression de cette catégorie sera refusée
select e.title, z.name as zone, count(zc.category_id) as categories
  from public.event_zones z join public.events e on e.id = z.event_id
  left join public.zone_categories zc on zc.zone_id = z.id
 group by 1, 2 having count(zc.category_id) <= 1 order by 1, 2;

-- D. zones sans aucune catégorie admise (garder la liste) : attendu 0 ligne. S'il y en a, la faille A4 a déjà servi :
--    régler ces zones (étape « Contrôle à l'entrée ») après le déploiement.
select e.title, z.name from public.event_zones z join public.events e on e.id = z.event_id
 where not exists (select 1 from public.zone_categories zc where zc.zone_id = z.id);

-- E. retenues d'avis en cours (garder) : les lignes restent valides après l'élargissement de la contrainte
select count(*) filter (where cardinality(held_fields) > 0) as retenues, count(*) as lignes from public.event_place_notices;

-- F. attendu : 0 ligne (fonctions nouvelles absentes)
select proname from pg_proc where pronamespace = 'public'::regnamespace
   and proname in ('ticket_category_auto_color', 'event_zones_form_refusal', 'event_zones_write',
                   'event_notice_recipient_count', 'event_update_preview');
```

### 4.2 Appliquer

```powershell
cd C:\Users\DELL\Documents\event-village
git switch main                    # après fusion de finition-2b/creation
npx supabase migration list        # les huit 20261119… en attente, rien d'autre
npx supabase db push --dry-run     # exactement 20261119000001 à 000008, dans l'ordre
npx supabase db push
```

### 4.3 Après (éditeur SQL)

```sql
-- A. attendu : 20261119000008
select max(version) from supabase_migrations.schema_migrations;

-- B. fonctions nouvelles : attendu 5 lignes, anon = false, authenticated = false, service_role = true
select p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role
  from pg_proc p where p.pronamespace = 'public'::regnamespace
   and p.proname in ('ticket_category_auto_color', 'event_zones_form_refusal', 'event_zones_write',
                     'event_notice_recipient_count', 'event_update_preview')
 order by 1;

-- C. attendu : sans_couleur = 0, avec_couleur = sans_couleur + avec_couleur de B avant
select count(*) filter (where scan_color is null) as sans_couleur, count(*) filter (where scan_color is not null) as avec_couleur
  from public.ticket_categories;

-- D. couleurs posées : seulement les huit de la palette du scanner (BLANC, NOIR, VIOLET, ROSE, TURQUOISE, BLEU, ARGENT, OR)
select scan_color, count(*) from public.ticket_categories group by 1 order by 2 desc;

-- E. déclencheur : attendu 1 ligne
select tgname from pg_trigger where tgname = 'trg_ticket_categories_auto_color';

-- F. champs retenus : la définition cite start_date, start_time, end_date, end_time
select pg_get_constraintdef(oid) from pg_constraint where conname = 'event_place_notices_fields_chk';

-- G. cadence de la recherche de lieu : attendu true
select prosrc like '%1300 milliseconds%' from pg_proc where proname = 'place_search_slot';

-- H. aperçu sans écriture : attendu EVENT_NOT_FOUND (événement inconnu, rien d'écrit)
select public.event_update_preview(jsonb_build_object('event_id', gen_random_uuid(), 'actor_id', gen_random_uuid(),
       'patch', '{}'::jsonb, 'expected_updated_at', now()))->>'code';

-- I. listes C et D d'avant : inchangées
```

Puis `03-verification.sql`, comme aux lots précédents.

## 5. Captures

Produites par le run complet, à 390 et 1 440 px, en clair et en sombre (§ 6).

| Écran | Capture |
|---|---|
| Étape 1, Informations | `partenaire-creation` |
| Étape 2, Programme | `partenaire-creation-programme` |
| Étape 3, Accès | `partenaire-creation-acces`, `partenaire-creation-carte` |
| Étape 4, Billets (couleur, prix minimum) | `partenaire-creation-billets` |
| Étape 5, Contrôle à l'entrée | `partenaire-creation-controle` ; en modification : `partenaire-zones` |
| Vérifier avant d'envoyer (ce qui manque) | `partenaire-creation-verifier` |
| Fenêtre « Prévenir » | `partenaire-edition-prevenir` |

## 6. Runs

Mode rapide pendant le travail (ligne `ci-rapide:` du commit : typecheck, lint, suites citées), un seul run complet à la fin. Journaux bruts : branche `ci-results`, `runs/<n>-<id>/`.

| Run | Commit | Rôle | Résultat |
|---|---|---|---|
| 253 | `392bc8a8d` | A et B (rapide, 20 suites) | 17/20. Trois corrections :<br>• `f2b-couleur-auto` : insertion du montage pendant des événements de déclencheur en attente, passée en mode réplica ;<br>• `f2b-zones-creation` : libellé « après » rendu en adresse invalide ;<br>• `zones-scan` : couleur posée par la base. |
| 254 | `4b330c0f2` | Même lot, après corrections | **18/18** |
| 255 | `ef1fdb3bf` | C (rapide, 30 suites) | 28/30 :<br>• `f2b-verifier-envoyer` cherchait le titre dans le mauvais fichier ;<br>• `evenements-verrous-ecran` attendait l'ancien texte (E-66).<br>Parité des manques écran / base verte sur les 4 cas. |
| 256 | `4cc4b3b81` | C, D1, D2 (rapide, 8 suites) | 7/8 : `notif-modeles` refuse le bouton « Ouvrir l'événement » (contrat G4) ; bouton commun remis. |
| 257 | `543b617da` | D5 cadence (rapide, 16 suites) | Vérification **verte**. La publication des journaux a échoué : course avec le run 258 de la 3a, fini à la même seconde. |
| 261 | `d0ada3ebf` | D3, D4, fusion de main, ajout (points 1 à 3) (rapide, 29 suites) | **29/29**, dont 5 passages chacune pour :<br>• `cvf2a-3-recherche` : écarts entre appels de 1 296 à 1 303 ms ;<br>• `notif-envoyeur` : vidage en 3 passes à chaque fois (2 516 → 1 516 → 516 → 0, dont 0 ligne réservée sur 1 000 examinées à la 1re passe : l'ancien vidage se serait arrêté là).<br>`f2b-recherche-cadence` : 1 300 ms malgré la réservation revenue 450 ms en retard. |
| 262 | `4beb4d668` (branche `finition-2b/rouges`) | Tests seuls sur main (`fdaa6c365`), sans aucun correctif | **0/19, chaque suite rouge pour la bonne raison** :<br>• code absent (modules, routes, fonctions : `PGRST202` pour r3, aucune migration `20261119…`) ;<br>• anciens textes à l'écran ; suppression qui vide la zone (HTTP 200) ; champs `scan_color` et `zones` refusés ;<br>• `f2b-recherche-cadence` : 646 ms entre deux appels ;<br>• `notif-envoyeur` : avec l'ancien vidage et la file d'essai, le passage de la route ne réserve pas la ligne du test (cas du run 252). |
| 263 | `c879fba9e` | Premier run complet | Rouge, deux erreurs de ma part :<br>• suites 457/458 : `recette-matrice`, car mes ajouts dans `e2e/recette.spec.ts` et `zones-scan` décalaient les lignes citées par `docs/recette-billetterie.md` (recalées) ;<br>• e2e 517 réussis, 4 en échec : la capture `partenaire-creation-billets` cherchait la case « Billets », dont le nom accessible est « Billetterie » (corrigé).<br>Autres corrections après examen des captures :<br>• l'étape 1 s'affichait « Informati… » à 390 px : libellé court « Infos » sous 1 024 px ;<br>• fenêtre « Prévenir » : « 12 détenteurs seront prévenus par SMS à 21:40. ». |
| 275 | `f47921b77` | Run complet après corrections | Rouge sur un seul point, **le poids JavaScript**. Typecheck, lint, suites **458/458** (dont `tests/audit/` et `tests/audit-auth/`), build, e2e et captures verts.<br>• `/` à 226 927 octets gzip pour un budget de 226 342 (+585) ; `/events/[id]` à 233 567 pour 233 316 (+251).<br>• Erreur de ma part : chaque page avait pris 661 octets (détail sous le tableau). Le dépassement figurait déjà dans la mesure du run 263 (`js-budget.tsv`) ; je ne l'avais pas relevé.<br>• Corrigé sans relever les budgets (commit `804bed0e1`). |
| 285 | `9335361aa` | Run complet final (typecheck, lint, toutes les suites, build, poids JavaScript, e2e et captures) | **Poids JavaScript vert** : `/` 226 300 octets gzip pour 226 342 (attendu : 226 302), `/events/[id]` 232 938, `/tickets` 249 690, `/controller/scanner` 233 887, `/billet/hors-ligne` 221 850.<br>e2e et captures verts, dont « Navigation rapide » masquée et la carte sous la barre ; `tests/audit/` et `tests/audit-auth/` verts.<br>Suites **457/458** : seule `r11-storage-documents` est rouge, hors de la 2b. Son compte d'essai tire au hasard un numéro de téléphone, déjà pris par une autre suite du même run (409 `PHONE_ALREADY_REGISTERED` à l'inscription). La 2b ne touche pas l'inscription, et la suite était verte au run 275 sur le même code. Rejouée seule : ligne suivante. |
| 295 | `2859b9a75` | `r11-storage-documents` rejouée seule (mode rapide) | **Verte** (1/1) : le rouge du run 285 venait du numéro tiré au hasard. |

**Poids JavaScript (run 275) : cause et correctif.**
- **Cause.** `AuthProvider`, chargé par chaque page, importait la purge des brouillons depuis `lib/events/local-draft.ts` : tout ce module entrait dans le code commun. `AppLayout` portait en plus le test d'adresse qui masque « Navigation rapide ». Main est à 226 266 octets sur `/` : la branche ne pouvait ajouter que 76 octets au code commun.
- **Correctif**, budgets inchangés :
  - la purge est dans un module à part, sans dépendance (`lib/events/draft-purge.ts`). Elle efface tous les brouillons de ce navigateur, quel que soit le compte (avant : ceux du compte seul), au bouton « Se déconnecter » et à toute fin de session signalée au navigateur (autre onglet, autre appareil, déconnexion du contrôleur). Elle ne lève jamais : la déconnexion continue ;
  - `AppLayout` est remis à l'identique de main. Le formulaire pose un attribut sur la page tant que sa barre est affichée ; une règle CSS masque alors « Navigation rapide », dans tous les navigateurs.
- **Relecture du correctif** (quatre relecteurs, chaque constat important contre-vérifié). Trois corrections :
  - ma première règle CSS (`:has()`) laissait, dans un navigateur ancien, la navigation par-dessus les boutons du formulaire : remplacée par l'attribut ;
  - à l'étape Accès sur téléphone, le bouton « Déplacer la carte » passait au-dessus de la barre fixe en défilant et prenait l'appui destiné à « Suivant » (défaut de la 2b, barre fixe) : bloc de la carte isolé ;
  - les brouillons n'étaient effacés qu'au bouton « Se déconnecter » de l'application : effacés aussi à toute fin de session signalée.
- **Mesure sur ce poste**, avec le build et l'environnement de la CI : `/` passe de 226 953 à 226 328 octets (−625) ; toutes les routes baissent de 624 à 626 octets. Sur le même code (`f47921b77`), ce poste mesure 25 à 32 octets de plus que la CI : attendu à la CI, environ 226 302 pour un budget de 226 342 (résultat réel au run complet ci-dessus).
- **Tests.** `f2b-telephone` et `f2b-brouillon-local` rouges avant chaque correction (6, puis 4 tests), verts après. Les captures vérifient dans le navigateur que « Navigation rapide » est masquée sur les étapes de création, et qu'à l'étape Accès la barre reçoit l'appui au-dessus du bouton de la carte.

Remarque sur la recherche de lieu : sur 18 recherches simultanées (cvf2a-3), 3 sont servies et 15 reçoivent « Recherche indisponible pour le moment » (attente admise de 4 s). C'était 4 sur 18 avec l'ancien espacement. Une recherche isolée n'attend pas.

## 7. Tests

### 7.1 Tests nouveaux
- `f2b-categorie-zone`, `f2b-couleur-consigne`, `f2b-couleur-auto`, `f2b-prix-minimum` ;
- `f2b-type-evenement`, `f2b-pied-cartes` ;
- `f2b-zones-creation`, `f2b-verifier-envoyer`, `f2b-telephone`, `f2b-brouillon-local` ;
- `f2b-fiche-admin`, `f2b-message-validation`, `f2b-cadence-avis`, `f2b-prevenir` ;
- `f2b-recherche-cadence`, `migration-finition2b-rejouable`.

### 7.2 Tests existants modifiés (et pourquoi)

| Test | Modification | Raison |
|---|---|---|
| `migrations-gelees` | Empreintes des migrations `20261116…` ajoutées | Elles sont appliquées ; plus aucune ne doit changer |
| `finition1-equipe` (3 endroits), `zones-scan` | Couleur attendue `null` remplacée par `'BLANC'` | La base pose désormais la couleur d'une catégorie qui n'en a pas (A) |
| `evenements-verrous-ecran` | Texte « Type d'événement : verrouillé » (avant : « Catégorie de l'événement : verrouillée ») | E-66 ; même règle |
| `r3-fonctions-rpc` | Bloc « finition 2b » ajouté (5 fonctions) ; conflit de fusion avec la 3a résolu en gardant les deux blocs | Ajout seul |
| `notif-envoyeur` | Vidage de la file par comptage des lignes dues, file d'essai de 2 500 lignes | Ajout, point 2 ; assertions inchangées |
| `design-files` | `ScanColorPicker`, `ZoneListEditor`, `EntryControlStep`, `EntryControlEditor`, `EventReview` déclarés | Fichiers nouveaux soumis aux règles du système de design |
| `e2e/recette.spec.ts`, `e2e/fumee.spec.ts`, `e2e/support/screens.ts` | Création par les 5 étapes et « Vérifier » ; zones par `?etape=controle` ; radio « Or » ; captures nouvelles ; « Navigation rapide » masquée (étapes de création) ; carte sous la barre (étape Accès, téléphone) | Parcours de création changé (B, C) |

Documents dont les numéros de ligne cités ont été recalés : `docs/recette-billetterie.md` (contrôlé par `recette-matrice`) et `docs/parcours-evenement-complet.md` (correspondances exactes seulement ; voir l'après-lancement). Après le run 275, 9 citations du parcours complet : 4 d'`AppLayout`, remises aux numéros de main ; 5 calées sur l'état du run 263, décalées depuis.

`notif-modeles` est inchangé. Au run 256, il a refusé mon bouton « Ouvrir l'événement » : le message de validation garde le bouton commun « Ouvrir Event Village » (contrat G4).

## 8. Essais pour un non-développeur (event-village-dev, après le déploiement)

1. **Créer un événement** avec deux catégories, l'une gratuite, l'autre à 50 F CFA.
   - « Suivant » à l'étape Billets refuse 50 F CFA sous le prix de cette catégorie, avec le minimum.
   - Les deux catégories ont chacune une couleur différente, déjà choisie.
2. **Étape 5** : ajouter une zone « Carré VIP » qui n'admet que la catégorie payante, avec une porte. Aller à « Vérifier » : chaque étape a « Modifier », et ce qui manque est listé. Envoyer pour validation.
3. **Revenir dans la modification**, à l'étape Billets : supprimer la catégorie payante. C'est refusé, et le message nomme « Carré VIP ».
4. **Sur téléphone** : commencer un événement, fermer l'onglet, revenir.
   - « Reprendre votre saisie du … ? » s'affiche.
   - Le bouton Retour d'Android ouvre « Quitter sans enregistrer ? ».
   - Une seule barre en bas de l'écran : celle du formulaire.
   - Étape Accès : faire défiler jusqu'à la carte ; « Suivant » répond toujours, même quand la carte passe sous la barre.
   - Se déconnecter, puis se reconnecter : la reprise n'est plus proposée (brouillon effacé à la déconnexion).
5. **Admin, fiche de validation** : couleurs, consignes, zones et portes visibles. Valider : l'organisatrice reçoit les prochaines étapes (cloche, email).
6. **Publier l'événement et prendre un billet avec un compte de test.** Côté organisatrice :
   - changer le lieu : la fenêtre « 1 détenteur sera prévenu par SMS à HH:MM. » s'ouvre ; « Annuler » ne change rien ;
   - recommencer avec « Enregistrer et prévenir » : un SMS arrive à l'heure dite ;
   - changer l'heure de fin dans l'heure qui suit : la fenêtre annonce un avis retenu, qui part une heure après le premier.
7. **Recherche de lieu** : deux recherches de suite donnent des résultats ; aucune erreur.
