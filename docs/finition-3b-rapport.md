# Finition 3b — Administration claire

Branche `finition-3b/admin`, partie de `main` à `fdaa6c365` (finition 3a appliquée), dans son propre dossier (`event-village-finition3b`, `node_modules` propre, aucune jonction). **Rien n'est fusionné dans `main`.** Migrations `20261118000001` à `…03`, sans BEGIN ni COMMIT, rejouables. La finition 2b (formulaire d'événement, migrations `20261119…`) n'est pas touchée : ni le formulaire ni `requireActiveSession`.

## À lire en premier

### 1. Sécurité d'abord

Aucune faille qui expose des données ou ouvre une action sans droit n'a été trouvée. Un écart d'ordre des contrôles a été corrigé en premier, avec un test rouge puis vert.

- **Inventaire de toutes les routes de `/api/admin`** (`tests/parcours/f3b-securite.test.ts`). Le test lit les fichiers sur le disque (37 routes au départ, 35 après le retrait de « Tarification » et de la liste des écarts de caisse) et appelle chaque méthode exportée avec un ADMIN au compte actif sans aucun droit. Chaque appel doit être refusé (401 ou 403), sauf pour quatre routes ouvertes à tout administrateur par construction, vérifiées sans fuite :
  - la double vérification ;
  - ses propres droits ;
  - « Argent qui attend » ;
  - « À faire aujourd'hui ».
- **Écart trouvé (run 264) :** `PATCH /api/admin/partners/[id]/status` répondait 400 « Statut partenaire invalide » à un ADMIN sans droit, parce qu'il lisait le corps avant de contrôler la permission. Aucune donnée n'était exposée : avec un statut valable, la permission était contrôlée ensuite. La route refuse désormais d'abord (403, permission nommée) tout administrateur qui n'a ni « Valider les partenaires » ni « Suspendre les partenaires » (`5f073149e`). Run 265 : inventaire vert.
- **« Le menu n'est qu'un confort »** (même suite). Pour chaque entrée du menu, un ADMIN muni de tous les droits sauf celui de l'entrée est refusé (403) par la route que la page lit. Le journal d'audit reste réservé au Superadmin, même pour un ADMIN qui a tous les droits.
- **Droits retirés et vérifiés en base** : `pricing.manage` et `shifts.read` (point 4). La base ne garde plus aucune ligne de ces droits (migration `…03`).

**Runs.** Le test de sécurité a d'abord été rouge (run 264, écart trouvé), puis vert dès le run 265, après `5f073149e`. Il est resté vert à chaque run qui l'a lancé (266 à 270, 273) et aux runs complets 274, 277 et 281. Les 31 suites de `tests/audit/` et `tests/audit-auth/` sont vertes à chaque run complet.

### 2. Ce que voit l'administration

- **Accueil** : « À faire aujourd'hui » en tête, avant « Argent qui attend ». Une carte par file à traiter (un nombre, une phrase simple, un bouton vers la bonne liste), les files à jour regroupées, « Rien d'urgent aujourd'hui. » quand tout est à jour.
- **Menu** : chaque entrée suit son droit ; « Scanner » seulement avec « Contrôler les entrées et tenir une caisse » ; « Réglages » pour qui lit les réglages ; « Mes droits » pour un ADMIN ; plus de « Tarification ».
- **Mes droits** : ce que le compte peut faire et ne pas faire, en phrases simples.
- **Réglages de la plateforme** : sommaire des thèmes, valeur par défaut, bornes vérifiées sous le champ, alerte sur les valeurs risquées, confirmation « Avant → Après » avec le motif, historique « qui, quoi, quand, pourquoi ».
- **Créer un administrateur** : la grille de ses droits s'ouvre tout de suite, avec quatre profils prêts ; cocher un droit d'écriture coche sa lecture.
- **Confirmations** : chacune dit qui est prévenu, par quel canal, avec ou sans le motif, et seulement ce qui se passe vraiment.
- **Libellés** : plus de jargon (« Console Superadmin HQ », « RBAC », « Permissions Granulaires », « SYSTEM », « Anonymiser & Supprimer »…) ; le journal d'audit dit l'action, l'objet et l'auteur en mots ; le rôle s'appelle « Superadmin » (menu, profil, réglages) ; plus aucun code d'erreur dans un message ; « filleuls directs » au lieu de « N1 ».

## État de chaque point

| Point | État | Où |
|---|---|---|
| 1. « À faire aujourd'hui » (E-29) | Fait. Huit files, une seule route serveur ; une file n'apparaît que si l'administrateur a le droit d'agir dessus ; compteur illisible : « Compteur indisponible », jamais 0 ; relecture toutes les 60 s et au bouton « Actualiser » ; compteur des candidatures servi par la liste des partenaires (plus par les indicateurs). | migration `…01` (`admin_todo`), `GET /api/admin/todo`, `lib/admin/todo.ts`, `components/admin/TodoToday.tsx`, accueil |
| 2. Menu et « Mes droits » (E-34) | Fait. Menu et barre du bas filtrés par les droits servis par `/api/auth/me` ; « Scanner » seulement avec `access.operate` ; page « Mes droits » ; un ADMIN sans aucun droit lit « Vous n'avez encore aucun droit : demandez-les au super-administrateur. » | `components/layout/admin-nav.ts` (chargé à la demande), `app/admin/mes-droits/page.tsx` |
| 3. Réglages (E-35) | Fait. Entrée « Réglages » au menu ; thèmes et sommaire ; pour chaque réglage, sa phrase, sa valeur par défaut, ses bornes vérifiées à l'écran et une alerte sur les valeurs risquées ; confirmation « Avant → Après » avec le motif ; historique avec l'auteur ; refus du serveur en français. | `lib/settings/catalog.ts`, migration `…02`, route et page des réglages |
| 4. Créer un admin et ses droits (E-36) | Fait. Grille ouverte aussitôt après la création ; profils « Validation », « Support client », « Finance », « Lecture seule » ; dépendances cochées d'office et appliquées par le serveur ; texte de création réécrit. Retirés après vérification : « Tarification » et `pricing.manage`, `shifts.read`. | `lib/admin/permission-profiles.ts`, `/api/admin/permissions`, `/api/admin/users`, page des comptes, migration `…03` |
| 5. Confirmations qui disent vrai (E-32) | Fait pour les actions de la consigne : réactivation (compte, partenaire, événement), suspension d'un événement, « Terminer » (et « Clore » un suspendu), « Marquer versé », statut d'une partenaire (et validation et refus d'une candidature). Chaque phrase est relue contre le registre des avis et les déclencheurs, et testée en base. | `lib/admin/confirmations.ts` |
| 6. Libellés (E-37, E-39) | Fait : jargon cité, codes bruts et table des libellés de la revue (section 5.2). Journal d'audit, parrainage et comptes en mots ; « Superadmin » au menu, au profil, dans les réglages, et message de la connexion aligné ; « Partenaire » dans le journal et l'historique d'un événement ; plus de code HTTP dans les messages (Campagnes, envois, versements) ; alertes de SMS sans « UTC » ; origine d'un envoi en mots ; parrainage sans « N1 / N2 ». Statuts et rôles sans capitales forcées. Six lignes de la table n'ont été faites qu'après le run complet 277 (voir « Erreurs »). | `lib/labels/audit.ts`, pages d'audit, de parrainage, des comptes, des envois et des campagnes, `AppLayout`, profil, connexion, `lib/notifications/catalog.ts` |

### Vérifié avant de retirer (point 4)

- **« Tarification » et `pricing.manage`** :
  - la page n'était plus qu'un renvoi vers les Réglages ;
  - `POST /api/admin/pricing` n'écrivait que trois clés (`subscription_packs`, `aggregator_fees`, `communication_tariffs`) ; une recherche dans tout le dépôt ne trouve aucun code qui les relit, en dehors de la ligne de départ de la migration `0007` ;
  - `GET /api/admin/pricing` n'était appelée par aucun écran.
- **`shifts.read`** :
  - sa seule route, `GET /api/admin/shifts/audit`, n'était appelée par aucun écran ;
  - les écarts de caisse se valident dans l'onglet « Caisse » du pilotage d'un événement, avec « Gérer les événements » (finition 2a) ;
  - la méthode `ShiftService.getConsolidatedDiscrepancies`, utilisée par cette seule route, est retirée aussi.

## Textes nouveaux

- **Accueil :**
  - titre « À faire aujourd’hui » ;
  - lignes :
    - « {n} versement(s) à reprendre » — « {montant} que des clients ou des partenaires attendent depuis plus de 30 minutes. » — « Voir l’argent qui attend » ;
    - « {n} événement(s) à valider » — « Le plus ancien attend depuis {2 jours}. » — « Examiner les événements » ;
    - « {n} candidature(s) de partenaire(s) » — « Dont {k} dossier(s) complété(s) après un refus. » — « Examiner les candidatures » ;
    - « {n} événement(s) suspendu(s) à décider » — « {a} dont la date est passée : clôturez-les ou annulez-les. {b} à venir : réactivez-les ou annulez-les. » — « Voir les événements suspendus » ;
    - « {n} écart(s) de caisse à valider » — « Le plus ancien : « {événement} ». Recomptez l’argent avec le contrôleur avant de valider. » — « Voir la caisse » ;
    - « {n} envoi(s) en échec aujourd’hui » — « SMS, emails ou notifications qui ne sont pas partis. » — « Voir les envois en échec » ;
    - « SMS optionnels : {utilisés} sur {plafond} aujourd’hui » — « Au-delà de {plafond}, les rappels et les annonces partent sans SMS. » — « Voir les envois » ;
    - « {n} créance(s) » — « {montant} que des partenaires ou des parrains doivent encore à Event Village, repris sur leurs prochains gains. » — « Voir les créances » ;
  - groupe « À jour » (« Versements à reprendre : aucun »…) ;
  - « Rien d’urgent aujourd’hui. » ;
  - « Vous ne voyez que ce que vos droits vous permettent de traiter. Voir mes droits » ;
  - « Vous n’avez encore aucun droit : demandez-les au super-administrateur. » ;
  - sans « Voir les indicateurs » : « Action non autorisée : votre compte n’a pas la permission « Consulter les statistiques ». » (plus « Vérifiez votre connexion »).
- **Mes droits** :
  - « Voici ce que votre compte peut faire. Pour un droit de plus, demandez-le au Superadmin. » ;
  - rubriques « Vous pouvez » et « Vous ne pouvez pas » ;
  - une phrase par droit (`lib/admin/permission-labels.ts`, `PERMISSION_DESCRIPTIONS`) ;
  - Superadmin : « Vous avez tous les droits, dont les réglages de la plateforme, le journal d’audit et la création des administrateurs. »
- **Réglages** :
  - « Par défaut : {valeur} » ;
  - « Valeur risquée » avec la phrase de chaque réglage (par exemple : « Un partenaire peut retirer avant l’événement ; s’il est annulé, Event Village rembourse sans pouvoir reprendre l’argent. ») ;
  - erreur sous le champ : « Choisissez entre {min} et {max} {unité}. », « Indiquez un nombre entier, sans virgule. » ;
  - bouton « Vérifier et enregistrer » ;
  - confirmation « Confirmer le changement ? » : « Avant : … → Après : … », « S’applique aux opérations faites à partir de maintenant ; le passé ne change pas. Personne n’est prévenu. », « Motif : … » ;
  - historique « Par {Prénom Nom} · Motif : … », « Par Automatique » sans compte ;
  - refus du serveur : « Frais de service : 60 % n’est pas admis. Choisissez entre 0 et 50 %. »
- **Créer un compte** :
  - « Créer un compte » ;
  - « Le compte est actif tout de suite ; le titulaire choisit lui-même son mot de passe. » ;
  - « Le titulaire reçoit par SMS un lien d’activation valable 24 heures pour choisir son mot de passe. » ;
  - rôles « Contrôleur », « Administrateur », « Superadmin », « Client », chacun avec sa phrase ;
  - « Un administrateur n’a aucun droit tant que vous ne lui en donnez pas : vous les choisissez juste après la création. » ;
  - réponse du serveur : « … Il n’a encore aucun droit : choisissez-les maintenant. »
- **Droits** :
  - titre « Droits de {Prénom Nom} » ;
  - « Effet immédiat ; la personne voit ses nouveaux écrans en rechargeant la page. Elle n’est pas prévenue. » ;
  - « Partez d’un profil prêt, puis ajustez les cases. Un droit qui modifie amène toujours le droit de voir. » ;
  - boutons « Validation », « Support client », « Finance », « Lecture seule », « Aucun droit », puis « Enregistrer les droits ».
- **Confirmations** (phrase « Prévenu(s) : … » construite par `lib/admin/confirmations.ts`) :
  - suspendre un événement : « Prévenus : le partenaire par SMS, notification et email (si une adresse vérifiée), avec votre motif ; les détenteurs de billets par notification et email (si une adresse vérifiée), sans SMS, sans votre motif, seulement s’ils acceptent les actualités des événements ; les contrôleurs affectés par notification et email (si une adresse vérifiée), sans SMS, sans votre motif. » ;
  - « Terminer » un événement publié : partenaire seul, par notification et email, sans SMS ; « Si une caisse est encore ouverte, le partenaire reçoit à la place une alerte par SMS, notification et email. Les détenteurs de billets ne sont pas prévenus. » ;
  - « Clore l’événement ? » pour un suspendu : « L’événement passe « Terminé », sans annulation : personne n’est remboursé automatiquement. » ; partenaire avec votre motif et détenteurs par SMS, sans motif ; « Si les participants doivent être remboursés, choisissez plutôt « Annuler l’événement ». » ;
  - « Marquer versé » : « Un SMS part tout de suite à {bénéficiaire} : ne le faites qu’après avoir vérifié le versement. » ;
  - réactivations (compte, partenaire, événement) : « sans votre motif » ; aide du motif : « Gardé au journal ; la personne ne le voit pas. » ;
  - supprimer un compte : « Supprimer définitivement {Prénom Nom} ? » — « Nom, téléphone et email sont effacés pour toujours ; ce compte ne pourra plus jamais se connecter. Ses paiements et ses billets restent dans l’historique. La personne n’est pas prévenue. Cette action est irréversible. »
- **Journal d’audit** :
  - titre « Journal d’audit » ;
  - actions, objets et rôles en mots (« Droits d’un administrateur changés », « Réglage », « Automatique »…), avec le repli « Autre action » et jamais le code ;
  - détail « Avant » / « Après ».
- **Parrainage** : « Parrainage et ambassadeurs », « Ambassadeur », « Nommer ambassadeur », « Retirer le statut d’ambassadeur » ; « Taux ambassadeur : {taux} sur les filleuls directs, {taux} sur les filleuls de ses filleuls » ; « Nommez un ambassadeur pour majorer ses commissions sur ses filleuls directs et sur les filleuls de ses filleuls. »
- **Comptes** : « Comptes et administrateurs », « Compte supprimé ».
- **Rôles** :
  - « Superadmin » sous le nom du compte (menu) et dans « Mon profil » ;
  - réglages : « Lecture seule : seul un Superadmin peut modifier ces réglages. … » ;
  - connexion refusée : « Cet espace est réservé aux administrateurs. » (le message des redirections) ;
  - « Partenaire » dans le journal d’audit et l’historique d’un événement.
- **Messages sans code d’erreur** :
  - « Historique indisponible. Le serveur n’a pas répondu comme prévu. Réessayez ; si cela continue, prévenez l’équipe technique. » ;
  - la même fin pour un brouillon de campagne, la liste et le détail des envois, et la relance d’un envoi ;
  - « Décision refusée par le serveur. Relisez la liste avant de recommencer ; si cela continue, prévenez l’équipe technique. »
- **Envois** :
  - alertes de plafond : « … jusqu’à minuit, heure de Dakar. » ;
  - détail : « Origine : Envoyé tout de suite (code reçu par SMS ou invitation d’un contrôleur) ».

## Migrations

| Fichier | Contenu |
|---|---|
| `20261118000001_f3b_todo.sql` | `admin_todo(p jsonb)` : compteurs des seules lignes demandées, chacune dans son propre bloc ; une ligne illisible rend `unavailable`, jamais 0. Lecture seule. |
| `20261118000002_f3b_reglages.sql` | `platform_settings_defaults()` : valeur d'origine de chaque réglage, lue dans l'historique (première ligne), sinon la valeur actuelle. Lecture seule. |
| `20261118000003_f3b_droits.sql` | Efface les droits `pricing.manage` et `shifts.read` déjà attribués (ils n'ouvraient plus rien). |

Les deux fonctions sont en SECURITY DEFINER, avec un `search_path` fixé, et seul le rôle de service peut les exécuter (`tests/security/r3-fonctions-rpc.test.ts`). Aucune fonction de la finition 2a ou de la 2b n'est touchée.

## Contrôles avant et après (event-village-dev, lecture seule)

```sql
-- Avant
-- A. Dernière migration appliquée : 20261117000004 attendu (finition 3a)
select max(version) from supabase_migrations.schema_migrations;
-- B. Fonctions de la finition absentes : 0 ligne
select proname from pg_proc where pronamespace = 'public'::regnamespace and proname in ('admin_todo', 'platform_settings_defaults');
-- C. Droits qui vont être effacés : nombre de lignes par droit (à noter)
select permission, count(*) from public.admin_permissions where permission in ('pricing.manage', 'shifts.read') group by 1;

-- Après
-- A. Trois versions 20261118000001 à …03
select version from supabase_migrations.schema_migrations where version like '20261118%' order by 1;
-- B. Deux fonctions réservées au rôle de service : anon false, authenticated false, service_role true
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
       has_function_privilege('service_role', p.oid, 'execute') as service_role
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('admin_todo', 'platform_settings_defaults') order by 1;
-- C. Droits retirés : 0 ligne
select permission, count(*) from public.admin_permissions where permission in ('pricing.manage', 'shifts.read') group by 1;
-- D. « À faire aujourd'hui » lisible, aucune ligne indisponible
select jsonb_pretty(public.admin_todo('{"lines": ["events_to_validate", "partners_to_validate", "events_suspended", "cash_discrepancies", "failed_sends", "sms_cap", "debts"]}'::jsonb));
-- E. Défaut de chaque réglage lisible (autant de clés que de réglages)
select count(*) as reglages, (select count(*) from jsonb_object_keys(public.platform_settings_defaults())) as defauts
  from public.platform_settings where key ~ '^(finance|access|notif|features|support)\.';
```

**F. Recalcul indépendant** (invariant h1) : lancer la requête `FINITION3B_TODO_ORACLE_SQL` de `tests/helpers/finition3b-invariants.ts`, en remplaçant `$1` par `array['to_resume','events_to_validate','partners_to_validate','events_suspended','cash_discrepancies','failed_sends','sms_cap','debts']`. Elle doit rendre 0 ligne. Elle lit tout et n'écrit rien.

## Runs

Résultats sur la branche `origin/ci-results`, dossier `runs/<numéro>-<identifiant>/`. Les runs « rapides » ne lancent que les suites nommées dans le commit ; un run « complet » lance tout : 449 suites, e2e, captures, recette et budgets JS.

| Run | Commit | Mode | Résultat | Ce qu'il montre |
|---|---|---|---|---|
| 264 | `10d54a7ce` | rapide | rouge, 0/3 | rouges voulus : inventaire de sécurité (écart de `PATCH …/partners/[id]/status`), « À faire aujourd'hui », migration rejouable |
| 265 | `19b951f8f` | rapide | 1/2 | inventaire vert après `5f073149e` ; rouge voulu des écrans de l'étape 1 |
| 266 | `aa51670c7` | rapide | 8/10 | quatre nombres sans `tabular-nums` (corrigé) ; rouge voulu de l'étape 2 |
| 267 | `a3230391f` | rapide | 7/10 | adaptation de `notif-interface` incomplète (corrigée) ; rouges voulus de l'étape 3 |
| 268 | `35422dbd4` | rapide | 12/15 | deux expressions fausses dans mes tests ; rouges voulus de l'étape 4 |
| 269 | `45d7b69a6` | rapide | 16/17 | « SamirPay (${ » interdit par R75 (corrigé) |
| 270 | `bfd9e0352` | rapide | 10/12 | lecture des avis de fin ; conseil de « Marquer versé » (corrigés) |
| 271 | `f1fcffc6f` (`finition-3b/rouges-5`) | rapide | rouge voulu, 0/1 | preuve rouge de l'étape 5 |
| 272 | `92008aa55` (`finition-3b/rouges-6`) | rapide | rouge voulu, 0/2 | preuve rouge de l'étape 6 |
| 273 | `08825a667` | rapide | vert, 21/21 | toutes les suites de la 3b et celles qu'elle touche |
| 274 | `d54412db0` | complet | rouge : 445/449, e2e | voir « Erreurs » ; 87 min |
| 276 | `4a23d4bcd` | rapide | vert, 6/6 | corrections du run 274 |
| 277 | `b58c376e1` | complet | rouge : 449/449, captures vertes, recette acte 1 | voir « Erreurs » ; 73 min |
| 278 | `7b03f4fe1` | rapide | rouge voulu, 21/27 tests | preuve rouge du point 6 complété (six contrôles) |
| 279 | `8fb3565d6` | rapide | 49/50 | correction du point 6 : `f3b-ecrans` vert, avec les 49 suites qui lisent les fichiers touchés (dont 3 d'audit) ; un échec temps réel sans lien, ci-dessous |
| 281 | `f29167472` | complet | vert : 449/449, e2e, 533 captures, recette 10/10 | recette alignée sur « Superadmin » (acte 1, essais 52 et 53) ; 31 suites d'audit, suites `f3b-…` et `evenements-fin-valide` vertes ; invariants à 0 ; budgets JS tenus ; 82 min |

Les runs 275 et 280 appartiennent à d'autres sessions.

**Run 279, échec sans lien avec la 3b.** `evenements-fin-valide`, cas 5 :
- l'abonnement en temps réel est actif et le passage termine bien l'événement « sentinelle » ;
- mais le message de diffusion n'arrive pas en 20 secondes (« délai dépassé (20000 ms) »).

Ce chemin (base, déclencheurs, Supabase Realtime) n'est touché par aucun des textes changés. Le même symptôme est déjà apparu aux runs 43 à 130, sur `temps-reel-billets`, `temps-reel-prives` et `stock-public-9ter`. La suite est relancée telle quelle par le run complet 281, sur le même code : verte, cas 5 compris (8 tests sur 8). La fragilité est notée dans `docs/apres-lancement.md`.

**Budgets JS** (gzip, run 281), aucun relevé : « / » 225 445 octets (budget 226 342) ; « /events/[id] » 232 072 (233 316) ; « /tickets » 248 777 (250 417) ; « /controller/scanner » 232 925 (234 911) ; « /billet/hors-ligne » 220 996 (224 268).

## Captures

Neuf écrans, 32 images, dans `runs/281-43994269565/captures/` : `<écran>__mobile__clair.png`, `__mobile__sombre.png`, `__ordinateur__clair.png`, `__ordinateur__sombre.png`. Mobile : 390 px ; ordinateur : 1440 px. Chaque image passe les contrôles bloquants : cibles de 44 px, textes de 14 px au moins, accessibilité (axe), aucun code brut.

| Écran | Ce qu'il montre | Vues |
|---|---|---|
| `admin-accueil-a-faire` | « À faire aujourd'hui » avec des lignes, puis « À jour » | 4 |
| `admin-accueil-rien-a-faire` | « Rien d'urgent aujourd'hui. » | mobile clair, ordinateur sombre |
| `admin-menu-droits-limites` | menu d'un ADMIN qui n'a que les événements | mobile clair et sombre (tiroir ouvert) |
| `admin-mes-droits` | « Vous pouvez » / « Vous ne pouvez pas » | 4 |
| `admin-reglages` | sommaire, thèmes, valeurs par défaut, alerte « Valeur risquée » | 4 |
| `admin-reglages-borne` | « Choisissez entre 0 et 50 %. » sous le champ | 4 |
| `admin-reglages-confirmation` | « Avant : 5 % → Après : 6 % », conséquence et motif | 4 |
| `admin-creation-administrateur` | création d'un compte Administrateur, phrase « aucun droit » | 4 |
| `admin-droits-apres-creation` | grille des droits ouverte aussitôt, profils prêts | 4 |

## Tests existants modifiés (signalés)

Aucune assertion de sécurité n'est affaiblie. Chaque modification suit un changement voulu par la consigne (route, page, droit ou texte retirés, déplacés ou renommés), ou rend plus sûr un test fragile.

- **`tests/parcours/notif-interface.test.ts`** (6.8) et **`tests/parcours/admin-audit-lot9.test.ts`** (A24) : mêmes règles qu'avant, lues dans `components/layout/admin-nav.ts` au lieu d'`AppLayout`. Ces règles sont :
  - « Notifications » dans le groupe « Système » et dans les espaces métier ;
  - barre du bas de 5 cases ;
  - journal d'audit réservé au Superadmin.

  Le menu de l'administration est désormais chargé à la demande, pour ne pas alourdir les pages publiques (avant la 3b, « / » n'avait que 76 octets de marge).
- **`tests/parcours/lectures-ignorees.test.ts`** (A34), **`acces-reglages.test.ts`**, **`notif-reglages.test.ts`**, **`lot9quater-droits.test.ts`** (B1, B5) : leurs cas sur `POST /api/admin/pricing` deviennent « la route n'existe plus ». C'est plus strict : il ne reste que `/api/admin/finance-settings` (Superadmin, valeur validée et historisée en base) pour écrire un réglage. Dans `notif-reglages`, l'ADMIN refusé par `finance_setting_set` a désormais `settings.read` au lieu de `pricing.manage`.
- **`tests/parcours/securite-admin-lot7.test.ts`** (7.0 c) : « `ADMIN_PERMISSIONS` contient `shifts.read` » devient « ne le contient plus » ; le test de `/api/admin/shifts/audit` devient « la route n'existe plus ».
- **`tests/schema/validations-metier.test.ts`** (A21) : la liste témoin des droits cite `settings.read` au lieu de `pricing.manage`.
- **`tests/schema/textes-techniques-9bis.test.ts`** (R21) : « la page Tarification n'a plus de section sans effet » devient « la page n'existe plus ».
- **`tests/security/r3-fonctions-rpc.test.ts`** : bloc ajouté pour `admin_todo` et `platform_settings_defaults`. C'est un garde-fou, vert dès l'écriture.
- **`tests/helpers/design-files.ts`** : deux fichiers ajoutés : `TodoToday` et « Mes droits ». La page des comptes n'y entre pas encore : seules sa création d'un compte et sa grille des droits sont sur le système de design.
- **`e2e/support/screens.ts`** : neuf captures ajoutées, aucune existante modifiée.
- **`e2e/recette.spec.ts`**, acte 1 :
  - run 274 : « Enregistrer » devient « Vérifier et enregistrer », puis la confirmation « Avant → Après » est lue et « Confirmer le changement » envoie la modification. Le motif reste exigé avant la confirmation, et le refus d'un ADMIN est inchangé. C'est le parcours voulu par le point 3 ;
  - run 277 : la phrase de lecture seule que lit l'ADMIN devient « … seul un Superadmin peut modifier ces réglages. » (nom du rôle, point 6). Le reste de l'étape est inchangé : aucun bouton « Modifier », et sa modification envoyée sans l'écran est refusée (403).
- **`docs/recette-billetterie.md`** :
  - run 274, `recette-matrice` : 68 citations de lignes recalées sur les tests adaptés ci-dessus et sur la recette ; la route « Tarification » est marquée retirée ;
  - essais 52 et 53 réécrits pour un testeur : « Vérifier et enregistrer », la fenêtre « Confirmer le changement ? », et « Superadmin ».
- **Trois tests fragiles du run complet 274 (aucune assertion affaiblie)** :
  - `tests/parcours/notif-migration.test.ts` (6.7) lit les destinataires en SQL. La liste de leurs identifiants dans l'adresse de l'API dépassait la longueur admise (« URI too long ») : la base de test compte plus de deux cents administrateurs, dont 14 créés par les suites de la 3b. Une assertion plus stricte s'ajoute : chaque destinataire est un compte existant.
  - `tests/parcours/sms-anti-abus.test.ts` tire ses adresses IP dans une plage qui lui est propre. D'autres suites tirent au hasard dans le même bloc `198.51.100.x` : un envoi étranger depuis `198.51.100.8` a compté dans la limite par IP (200, 200, 429 au lieu de 200, 200, 200, 429).
  - `tests/parcours/notif-envoyeur.test.ts` vide la file des avis jusqu'à un passage qui ne réserve plus rien. C'est le test fragile déjà noté à la 3a (run 252), rouge de nouveau au run 274.
- **`tests/parcours/f3b-securite.test.ts`** et **`tests/schema/migration-finition3b-rejouable.test.ts`** (mes suites) finissent désormais sur les invariants de la 3b, règle h1 comprise, au lieu de ceux de la 3a.
- **Suites nouvelles** :
  - `f3b-securite`, `f3b-todo`, `f3b-reglages`, `f3b-droits` et `f3b-confirmations` (avec base) ;
  - `f3b-ecrans` (sans base : aucune écriture, donc aucun appel d'invariants, écart signalé), dont le bloc « 6 bis » sur la table des libellés de la revue ;
  - `migration-finition3b-rejouable` ;
  - aide `tests/helpers/finition3b-invariants.ts` : règle h1, recalcul indépendant de « À faire aujourd'hui », après toutes les règles des livraisons précédentes.

## Décisions prises, à relire

1. **Une file de « À faire aujourd'hui » suit le droit d'AGIR**, pas celui de voir. Par exemple, les événements à valider demandent « Gérer les événements » ; la seule lecture ne suffit pas. Exception : le plafond des SMS suit « Consulter les envois », car il n'y a rien à faire d'autre que surveiller.
2. **Libellés des permissions gardés** (« Consulter les comptes »…), avec une phrase simple sous chacun. Les noms proposés par la revue changeraient tous les refus déjà testés ; la question est notée dans l'après-lancement.
3. **Menu chargé à la demande.** Le code des pages publiques était au bord de son budget (« / » : 76 octets de marge avant la 3b). Les entrées de l'administration et sept icônes en sortent, soit 821 octets de moins sur « / » (226 266 au run complet 252 de la 3a, 225 445 au run 281) ; un administrateur voit son menu une fraction de seconde après la page.
4. **« Réglages » au menu pour qui a « Lire les réglages »**, et non pour tout administrateur : la route refuse la lecture sans ce droit depuis le lot 9 quater.
5. **Défaut d'un réglage = sa valeur d'origine**, lue dans l'historique (premier état connu), et non une valeur écrite à la main dans le code.
6. **Dépendances appliquées aussi par le serveur** (`POST /api/admin/permissions`). Les droits déjà attribués ne sont pas changés sans le Superadmin : la lecture manquante s'ajoute au prochain enregistrement.
7. **`shifts.read` retiré, pas seulement masqué** : sa route n'avait aucun écran. La file « écarts de caisse à valider » suit « Gérer les événements », le droit qui permet de les valider.
8. **Confirmations** : une seule source (`lib/admin/confirmations.ts`), relue contre le registre des avis et testée en base. Une confirmation ne promet jamais un motif que l'avis ne transmet pas.
9. **Création d'un compte mise sur le système de design** (en-tête, recherche, filtres, fenêtre, grille des droits), sinon les captures demandées échouaient aux contrôles de 44 px et 14 px. Le reste de la liste des comptes (lignes, pagination) reste à faire (après-lancement).
10. **« super-administrateur » gardé dans la phrase dictée par la consigne** (« Vous n'avez encore aucun droit : demandez-les au super-administrateur. », accueil et « Mes droits »). La revue veut « Superadmin » partout, et c'est ce que dit désormais tout le reste de l'écran. Pour l'uniformité, il suffit de changer ce mot dans la phrase : dis-le-moi.
11. **« Non renseigné » gardé pour un compte sans email** (la revue proposait « Aucun email ») : la liste ne montre plus d'adresse technique, et c'est le mot déjà utilisé pour un numéro absent.
12. **« Argent qui attend » reste sous « À faire aujourd'hui ».** La consigne met « versements à reprendre » et « créances » dans la liste, avec un lien vers « Argent qui attend » (3a) : ces deux nombres s'affichent donc deux fois sur l'accueil (capture `admin-accueil-a-faire`). N'en garder qu'un est noté dans l'après-lancement.

## Erreurs de ma part, trouvées et corrigées

- **Commit mélangé** : `72788df22` (« corrections de mes tests ») contient aussi les trois suppressions de l'étape 4 (page et route « Tarification », route des écarts de caisse). Je les avais préparées par `git rm` avant ce commit. Le contenu final est juste ; seul le découpage des commits est faux. L'historique, déjà poussé, n'est pas réécrit.
- **Run 266** : quatre nombres des phrases de « À faire aujourd'hui » n'étaient pas en `tabular-nums` (règle 8.2 q).
- **Run 267** : l'adaptation de `notif-interface` 6.8 était incomplète (trois appels lisaient encore `AppLayout`) ; corrigé dans `eaa192730`.
- **Run 268** : deux expressions de mes tests étaient fausses. La première ignorait les clés avec des chiffres (`notif.reminder_j1_hour`, `notif.reminder_h3_hours`), la seconde prenait la clé React `${h.key}` pour une clé affichée.
- **Run 269** : ma phrase d'alerte contenait « SamirPay (${ », séquence interdite par la règle R75.
- **Run 270** :
  - mon test lisait les avis par l'identifiant de la ligne d'historique, alors que l'avis de fin a une clé par événement (et dédoublonnée) ;
  - ma nouvelle phrase de « Marquer versé » avait fait disparaître, en tant que chaîne simple, le conseil du support que `admin-remboursements` lit ; il est gardé tel quel dans une constante.
- **Run complet 274** : rouge, par ma faute sur trois points.
  - Le lien de retour de la page des comptes rétrécissait à 42 px sur téléphone (captures de création d'un administrateur).
  - La recette e2e cherchait encore le bouton « Enregistrer » des réglages ; ses neuf autres actes n'ont donc pas tourné.
  - Les citations de lignes de la matrice de recette étaient décalées.
  - J'avais aussi changé l'amorce de la recherche des comptes, que l'acte 8 de la recette lit. Elle est remise à l'identique (« Rechercher par nom, email ou téléphone »).
  - Trois tests fragiles, sans lien avec la 3b, ont lâché en même temps (ci-dessus).
  - Un second run complet a donc été nécessaire.
- **Run complet 277** : rouge, par ma faute. Les 449 suites et les 533 captures étaient vertes.
  - En nommant le rôle « Superadmin » sur la page des réglages (`c20d94adb`), j'ai changé la phrase de lecture seule que l'acte 1 de la recette lit pour l'ADMIN. Les neuf autres actes n'ont donc pas tourné.
  - Avant de relancer, j'ai relu les actes 2 à 10 contre tout ce que la 3b change à l'écran : accueil et validation d'une partenaire, fiche d'un événement, liste des comptes, suspension d'une partenaire, versements. Aucun autre texte lu par la recette n'a changé.
- **Point 6 incomplet jusqu'au run 277.** En relisant cette phrase contre la revue, j'ai vu que six lignes de sa table des libellés (section 5.2) n'étaient pas faites :
  - « Superadmin » au menu, au profil et à la connexion ;
  - « Partenaire » dans le journal ;
  - huit messages qui affichaient un code HTTP ;
  - « UTC » dans trois alertes ;
  - l'origine d'un envoi ;
  - « N1 / N2 » du parrainage.

  Elles sont faites avec un test rouge d'abord (run 278), puis la correction `8fb3565d6` (run 279). Un troisième run complet a donc été nécessaire.
- **Preuves des rouges manquantes** pour les étapes 5 et 6 (les tests n'avaient pas été la pointe d'un envoi). Elles sont faites sur des branches de preuve, à ne pas fusionner : `finition-3b/rouges-5` (run 271) et `finition-3b/rouges-6` (run 272).

## Essais pour un non-développeur

Avec le compte Superadmin, sur event-village-dev, une fois l'application déployée et les migrations appliquées :
1. **Accueil de l'administration.** En haut, « À faire aujourd'hui » : une carte par file, avec son nombre, sa phrase et son bouton, puis la liste « À jour ». Si tout est à jour : « Rien d'urgent aujourd'hui. »
2. **Comptes → Créer un compte → Administrateur.** La phrase dit qu'il n'aura aucun droit tant que vous ne lui en donnez pas. Après « Créer le compte Administrateur », la fenêtre « Droits de … » s'ouvre. Cliquer « Validation » : « Gérer les événements » et « Consulter les événements » sont cochées ensemble. Enregistrer.
3. **Se connecter avec ce nouvel administrateur** (lien reçu par SMS). Le menu ne montre que « Événements », « Catalogues et services » et « Mes droits ». « Mes droits » liste ce qu'il peut faire et ne pas faire. Taper l'adresse `/admin/finance` à la main : la page dit qu'il n'a pas la permission.
4. **Réglages (Superadmin).** Sommaire en haut. Sur « Frais de service », « Modifier » puis 60 : « Choisissez entre 0 et 50 %. » s'affiche sous le champ, sans envoi. Avec 6 et un motif, puis « Vérifier et enregistrer » : « Avant : 5 % → Après : 6 % ». Annuler. L'historique dit qui a changé quoi.
5. **Fiche d'un événement en ligne → « Suspendre ».** La boîte dit qui est prévenu et par quel canal : les détenteurs sans SMS ni motif. Annuler.
6. **Journal d'audit.** Les actions s'affichent en mots (« Droits d’un administrateur changés »), les automates en « Automatique », un partenaire en « Partenaire ».
7. **Libellés.** Sous votre nom dans le menu et dans « Mon profil » : « Superadmin ». Parrainage : « Taux ambassadeur : … sur les filleuls directs, … sur les filleuls de ses filleuls », plus de « N1 » ni « N2 ».

## À faire de ton côté

1. **Décider la fusion.** La branche part de `fdaa6c365`. Depuis, `main` a reçu la phase 0 du design (`144e4fd7a`, commit du 17/11 à 02 h 37 TU) : 84 fichiers, tous sous `docs/design/`, aucun en commun avec la 3b ; une fusion d'essai (`git merge-tree`) passe sans conflit. Une avance rapide n'est donc plus possible : il faudra fusionner `main` dans la branche, ce que je n'ai pas fait (« Tu ne fusionnes pas »). Même chose si la 2b est fusionnée avant (ses migrations `20261119…` passent déjà après les `20261118…`). Pour information : les runs complets de la 2b (263 et 275) dépassent le budget JS de « / » de 585 octets, et la 3b en retire 821 ; le run complet qui suivra la seconde fusion le vérifiera.
2. **Appliquer les trois migrations `20261118…` sur event-village-dev**, après les `20261117…`, avec les contrôles ci-dessus avant et après. Noter le nombre de droits `pricing.manage` et `shifts.read` effacés (contrôle C avant).
3. **Déployer l'application juste après**, car le menu et les écrans lisent les nouvelles routes.
4. **Ne pas fusionner** les branches de preuve `finition-3b/rouges-5` et `finition-3b/rouges-6`.
5. **Trancher le mot « super-administrateur »** de la phrase dictée (décision 10) : le garder tel quel, ou écrire « Superadmin » comme partout ailleurs.

