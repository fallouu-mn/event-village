# Lot sécurité — déconnexion sans réseau

Branche `securite/deconnexion-hors-ligne`, partie de `finition-2b/creation` (`2859b9a75`), à fusionner après la 2b. **Rien n'est fusionné.**

## À lire en premier

**Faille corrigée.** Un téléphone sans réseau depuis plus d'une heure (jeton d'accès échu : `jwt_expiry = 3600`) : « Se déconnecter » affichait l'écran de connexion, mais la session restait dans les cookies.
- **Cause.** Avant de fermer la session, auth-js 2.114 tente de rafraîchir le jeton échu (jusqu'à 25 s d'essais). Sans réseau, il échoue et sort sans rien effacer ; l'application ignorait l'erreur. Le scanner faisait de même, et « Déconnecter tous mes appareils » n'effaçait rien du tout sans réseau.
- **Conséquence.** Au retour du réseau, l'application relisait le compte avec l'ancienne session (billets, profil). Si la page avait été fermée entre-temps, la personne suivante retrouvait le compte à l'ouverture.

**Maintenant**, règle de la consigne :
- tout de suite, avec ou sans réseau : session (cookies), billets hors ligne, brouillons et mémoire du contrôle effacés ; l'écran affiche « Vous êtes déconnecté de ce téléphone. » ;
- la révocation côté serveur part avec les jetons gardés en mémoire. Sans réseau, elle est refaite au retour du réseau (et après une attente qui double, jusqu'à 30 s) ; si la page est fermée avant, elle est abandonnée : plus personne n'a les jetons sur ce téléphone ;
- une fois la session révoquée, l'écran de connexion s'ouvre avec le même message ;
- même règle pour le scanner (et l'en-tête du contrôleur) et pour « Déconnecter tous mes appareils » (toutes les sessions du compte, révocation journalisée).

**Preuves.** Rouge au run 300 (tests seuls, § 4) ; vert au run rapide 303 et au run complet 315.

## 1. À l'écran

| Où | Avant | Maintenant |
|---|---|---|
| « Se déconnecter » (menu, profil, en-tête du contrôleur, scanner, contrôle d'identité de l'admin), sans réseau | Écran de connexion, ou page d'erreur du navigateur ; session gardée | « Vous êtes déconnecté de ce téléphone. » avec « Se connecter », tout de suite ; au retour du réseau, écran de connexion avec le même message |
| Même chose, avec réseau | Écran de connexion | Le même écran un instant, puis l'écran de connexion avec le message |
| « Déconnecter tous mes appareils », sans réseau | Erreur brute « Failed to fetch », rien d'effacé | Comme « Se déconnecter » ; les autres appareils sont déconnectés au retour du réseau |

Textes nouveaux : « Vous êtes déconnecté de ce téléphone. » (écran sur place, et bandeau de la page de connexion) ; « Se connecter » (lien).

## 2. Comment

- **`lib/auth/sign-out-here.ts`** (nouveau, chargé par chaque page) :
  - effacement local par `_removeSession` d'auth-js. C'est une méthode interne, mais la seule qui efface tous les morceaux du cookie sans réseau ET prévient l'application (événement de fin de session, ici et dans les autres onglets ; temps réel remis sur la clé anonyme). Son comportement est verrouillé par le test, avec la vraie bibliothèque ; un filet efface en plus tout cookie de session restant ;
  - révocation : déconnexion de cette session chez Supabase ; jeton refusé (échu) : nouveau jeton par le jeton de rafraîchissement, puis déconnexion ; « partout » : route `/api/auth/sign-out-global` ;
  - nouvel essai au retour du réseau, et après une attente qui double, de 1 s à 30 s au plus ;
  - abonnement aux notifications retiré du navigateur, sans réseau.
- **`AuthProvider`** : purges, état remis à zéro et écran sur place AVANT tout appel réseau ; aucune navigation tant que la session n'est pas révoquée (sans réseau, `/login` ne se charge pas, et la page d'erreur du navigateur perdrait les jetons gardés).
- **Contrôleur, scanner, profil, contrôle d'identité de l'admin** : tous passent par la même déconnexion (`useAuth().signOut`).
- **Notifications** : le retrait côté serveur n'est plus tenté à la déconnexion (la session est déjà effacée, la route le refuserait). L'abonnement resté côté serveur est supprimé au premier envoi refusé par le service push (comportement du lot 6).

## 3. Poids JavaScript

Budgets inchangés. Pour faire de la place, deux modules sortent du code chargé par chaque page, sans changement de comportement :
- `lib/tickets/offline-lots.ts` : enregistrement, lecture et réconciliation des billets hors ligne, déplacés tels quels d'`offline-store.ts` (la purge reste dans `offline-store.ts`, seule utile à la déconnexion) ;
- le module des notifications, que la déconnexion n'importe plus.

| Route | Budget | 2b (run 285) | Ce lot, CI |
|---|---|---|---|
| `/` | 226 342 | 226 300 | 225 706 |
| `/events/[id]` | 233 316 | 232 938 | 232 352 |
| `/tickets` | 250 417 | 249 690 | 249 859 |
| `/controller/scanner` | 234 911 | 233 887 | 232 092 |
| `/billet/hors-ligne` | 224 268 | 221 850 | 221 335 |

## 4. Runs

| Run | Commit | Rôle | Résultat |
|---|---|---|---|
| 300 | `22b61315e` | Tests seuls, run complet (rouge attendu) | **Rouge pour la bonne raison** : seule `securite-deconnexion` rouge sur 459 suites (module absent, ancien code ; le témoin de la cause dans auth-js vert) ; e2e : seule la phase `deconnexion` rouge. Sans réseau, aucun message, et les cookies `sb-127-auth-token.0` et `.1` restent ; au retour du réseau, `/api/tickets` et `/api/auth/me` repartent avec l'ancienne session, et l'écran de connexion arrive sans le message. Dans ce run, le compte n'a pas été rouvert : le réseau est revenu pendant que l'ancien code réessayait encore, ce qui a fini par fermer la session. Job arrêté par sa limite de 90 min juste après l'e2e (machine lente, § 5). |
| 303 | `8b7086287` | Correctif, mode rapide (43 suites qui lisent un fichier modifié, plus les suites d'audit de l'authentification) | **43/43**. Témoin : `auth.signOut` sans réseau rend `AuthRetryableFetchError` et laisse les deux cookies de session. Retour du réseau : 4 requêtes, la révocation en premier : déconnexion avec l'ancien jeton (refusée), nouveau jeton, déconnexion. |
| 307 | `fa465ba71` | Run complet | Suites **459/459**, poids JavaScript vert (`/` 225 675 pour 226 342), toutes les phases e2e vertes sauf `deconnexion`, rouge sur un seul constat : au retour du réseau, l'écran de connexion n'est pas venu dans les 30 s (page restée sur l'écran « déconnecté »). Les autres constats étaient verts : message et cookies effacés sans réseau, révocation faite, aucun compte ensuite, aucune requête avec l'ancien jeton. Cause probable, non prouvée faute de trace : le rappel attendait un second effacement local avant de naviguer, ou le premier essai au retour du réseau est parti trop tôt, le suivant n'arrivant que 30 s plus tard. Corrigé (commit `e9b495f86`) : navigation d'abord, effacement ensuite sans l'attendre ; nouveaux essais à 1 s, 2 s, 4 s… jusqu'à 30 s, en repartant de 1 s au retour du réseau. |
| 315 | `6d6d37706` | Run complet final | **Vert** : suites 459/459 (dont `tests/audit/` et `tests/audit-auth/`) ; build et poids JavaScript verts (§ 3) ; e2e : 11/11 phases vertes, dont `deconnexion` (verte) ; job success en 87 min. |

Le run complet final a été poussé pendant le run 314 d'une autre branche (`ci/parallele`). La CI était occupée sans interruption par d'autres sessions depuis 11 h 46, et l'API de GitHub, partagée par les sessions de ce poste, refusait les interrogations pendant le seul créneau libre. Les runs de branches différentes ne s'annulent pas entre eux.

## 5. Tests et infrastructure

**Tests nouveaux**
- `tests/parcours/securite-deconnexion.test.ts` : vraie bibliothèque contre le Supabase local, réseau coupé puis rétabli, jeton « deux heures plus tard ». Il couvre le témoin de la cause, l'effacement immédiat sans requête, la révocation au retour du réseau, l'absence de requête avec l'ancien jeton hors révocation, « Déconnecter tous mes appareils » (l'autre appareil déconnecté) et les écrans.
- `e2e/deconnexion.spec.ts` (phase `deconnexion`) : navigateur réel, compte créé pour le test, réseau coupé, horloge avancée de deux heures, retour du réseau, chaque requête examinée.

**Tests existants modifiés (et pourquoi)** : tous figeaient l'ancienne forme, `supabase.auth.signOut` appelé dans la fonction de déconnexion. L'exigence est gardée, avec la nouvelle fermeture de session.

| Test | Modification |
|---|---|
| `f2b-brouillon-local` | `signOut(scope ?)` ; brouillons effacés avant `dropLocalSession` (avant : avant `auth.signOut`) ; lecture des fichiers en fins de ligne LF |
| `hors-ligne-client` | Même chose pour les billets hors ligne |
| `scanner-reprise` | Mémoire du contrôle effacée par `AuthProvider` avant la fermeture de la session ; contrôleur et scanner passent par `useAuth().signOut` |
| `lot9quinquies-ecrans` | Portée « cet appareil » et route « tous mes appareils » lues dans `lib/auth/sign-out-here.ts` ; profil : `signOut('partout')` |
| `notif-interface` | `AuthProvider` retire l'abonnement du navigateur (`unsubscribePush`) sans importer le module des notifications ; contrôleur et scanner par `useAuth().signOut` ; la règle « retrait avant `auth.signOut` » reste pour la connexion et la réinitialisation |

**Infrastructure**
- `.github/workflows/verify.yml` : déclencheur `securite/**` (sans lui, la branche ne lançait aucun run) ; limite du job portée de 90 à 120 min. Au run 300, toutes les étapes ont passé, mais le job a été arrêté par la limite juste après l'e2e : `verify` y a pris 2 812 s, contre 1 882 s au run 285 sur une machine plus rapide.
- `playwright.config.ts` et `scripts/e2e/run-e2e.mjs` : projet et phase `deconnexion` ; `e2e/support/service.ts` : `createClientAccount`.

**Documents** : citations « fichier:ligne » recalées (36 dans `docs/parcours-evenement-complet.md`, une dans `docs/guide/07-billets.md`).

## 6. Limites connues

- Page rechargée ou fermée avant le retour du réseau : révocation abandonnée, comme le veut la règle. La session reste valable côté serveur, mais plus personne ne l'a sur ce téléphone.
- `_removeSession` est une méthode interne d'auth-js : à revérifier à chaque mise à jour de `@supabase/supabase-js` (le test échoue si elle change).
- La réinitialisation du mot de passe et le compte suspendu à la connexion gardent leur `supabase.auth.signOut` : le réseau vient d'y répondre.
- En ligne, une réponse déjà en vol peut reposer un cookie de session : il est effacé de nouveau après la révocation, et refusé par le serveur (session révoquée).
- Réseau présent mais sans données : l'événement « retour du réseau » ne vient pas ; nouvel essai au plus toutes les 30 s.

## 7. Essais pour un non-développeur

1. Se connecter sur un téléphone, passer en mode avion, « Se déconnecter » : « Vous êtes déconnecté de ce téléphone. » s'affiche aussitôt.
2. Quitter le mode avion : l'écran de connexion s'ouvre avec le même message. Fermer puis rouvrir l'application : aucun compte.
3. Même essai avec l'application fermée pendant le mode avion : à la réouverture, aucun compte.
4. « Déconnecter tous mes appareils » en mode avion, puis quitter le mode avion sans fermer l'application : sur un autre appareil connecté au même compte, la session est fermée.
5. Scanner (contrôleur) : même essai qu'au point 1.

## 8. Correctifs de la contre-vérification (finition 2b et déconnexion)

Branche `correctifs/cvf2b`, partie de `main` à `08d854851`. La contre-vérification y est fusionnée (`origin/audit/finition-2b`, `6ccf12e9c`). Ses suites `tests/audit/cvf2b-*` sont les tests rouges ; leurs assertions sont inchangées. Une seule donnée a été renseignée, voir 6.13b. Un commit par point. Non fusionnée.

### Graves

| Point | Constat | Correctif | Test | Commit |
|---|---|---|---|---|
| 6.4 | Un téléchargement de billets parti avant « Se déconnecter » réécrivait, après la purge, le compte hors ligne et ses codes. | Génération du stockage hors ligne, changée par chaque purge dans la même transaction que l'effacement. Le téléchargement et la liste `/api/tickets` la lisent avant leur requête et la revérifient dans la transaction d'écriture : après une purge, rien n'est écrit. Fichiers : `lib/tickets/offline-store.ts`, `offline-lots.ts`, `components/tickets/OfflineTicketsSync.tsx`. | cvf2b-6, cas 4 | `6afff9fd7` |
| 6.5 | Une session fermée ailleurs laissait au téléphone ses billets, la mémoire du contrôle et les brouillons. | Au chargement sans session, si aucun cookie de session ne reste, ou si le middleware a posé `ev-session-close=1` (5 min, posé quand il vide une session révoquée) : effacement des billets hors ligne, de la mémoire du contrôle, des brouillons, des liens de paiement et de l'abonnement push. | cvf2b-6, cas 5 | `97daaabab` |
| 6.6 | Un jeton de session fermée lisait encore la REST jusqu'à 1 h. | Migration `20261121000001` : `securite.db_pre_request()`, pré-requête de PostgREST. Une lecture par clé primaire de `auth.sessions`. Si la session est absente, échue ou appartient à un autre compte : 401 `SESSION_FERMEE`. Sans jeton, avec anon ou avec le rôle de service : rien. Coût mesuré sur 10 000 appels : 15,1 µs par appel au run 349, dont 9,5 µs pour la lecture de la session ; 19,1 µs au run 352, dont 11,8 µs. Plan : `Index Scan using sessions_pkey`, 0,05 ms. | cvf2b-6, cas 6 et 7 ; `cvf2b-correctif-pre-requete` (nouvelle) | `695def1af` |
| 6.7 | Jetons d'une heure. | `supabase/config.toml` : `jwt_expiry = 600`. Le temps réel coupe un canal à l'échéance de son jeton. Test : un jeton de 25 s abonné aux notifications du compte reçoit avant l'échéance, ne reçoit plus rien après, et son canal passe à `CLOSED` (run 352). | `cvf2b-correctif-pre-requete`, section 5 | `e77468e48` |

### Moyens

| Point | Constat | Correctif | Test | Commit |
|---|---|---|---|---|
| 6.2 | Les autres onglets gardaient la page après « Se déconnecter ». | Sur tout SIGNED_OUT, dans tous les onglets, l'écran « Vous êtes déconnecté de ce téléphone. » remplace la page. Jamais sur `/login`, `/register`, `/forgot-password` ni `/reset-password`. | cvf2b-6, cas 2 | `9aa0cb5e7` |
| 6.8 / 6.9 | Les autres appareils restaient abonnés aux notifications ; SIGNED_OUT ne désabonnait pas le navigateur. | `sign-out-global` supprime les abonnements push du compte, avant et après la révocation. Tout SIGNED_OUT désabonne le navigateur. | cvf2b-6, cas 8 et 9 | `02f639006` |
| 4d | La retenue d'une heure ignorait les avis en cours d'envoi : deux SMS à 11 min. | Migration `20261121000005` : les SMS en cours d'envoi comptent dès leur réservation ; plancher d'une heure depuis le dernier SMS réservé ou parti ; retenue repoussée au départ réel. | cvf2b-4, bloc d | `d8079a59f` |
| 4f | Reporter le début rouvrait le plafond : 4 SMS en 37 s. | Migration `20261121000006` : jamais plus de 2 SMS par détenteur et par événement dans l'heure glissante, quelle que soit l'heure de début (trace `LAST_HOUR_CAP`). Pendant l'événement : 2 SMS par heure glissante. | cvf2b-4, bloc f | `ab8bfedac` |

### Faibles

| Point | Constat | Correctif | Test | Commit |
|---|---|---|---|---|
| 2b | OR (#FACC15) à 5,1 de l'ambre « hors fenêtre » du scanner. | OR est retiré du choix : sélecteur, schéma, migration `20261121000007` (normalize, update). Le choix automatique ne le proposait déjà pas. Une catégorie déjà en OR garde sa couleur, affichée en vieil or #685400 (texte blanc 7,35:1). Chaque couleur choisissable est à 25 au moins de chaque verdict. | cvf2b-2, bloc b ; `cvf2b-couleur-choisissable` (nouvelle) | `0c4d406a4`, `4de809067` |
| 2c | La consigne acceptait les caractères de contrôle et les contrôles bidirectionnels. | Refusés par le schéma et, en base, par la migration `20261121000008` (normalize, update), comme les noms de zone et de porte. | cvf2b-2, bloc c ; `cvf2b-consigne-controle` (nouvelle) | `f587cfbda` |
| 5c / 5d | Les brouillons d'un autre compte restaient ; aucune durée de vie. | À toute connexion, les brouillons des autres comptes sont effacés ; un brouillon de plus de 7 jours est effacé. | cvf2b-5 | `2e9ed8551` |
| 6.13b | Les liens de paiement (`event-village:paiement:`) survivaient à la déconnexion. | `clearPaymentHandoffs()` (`lib/payments/payment-handoff-purge.ts`) est appelée dans « Se déconnecter », sur tout SIGNED_OUT et dans le cas de la 6.5. | cvf2b-6, cas 13b | `91053a0f7` |

### Écarts et décisions à relire
1. **6.8.** L'abonnement de l'appareil qui demande est supprimé aussi : cet appareil est lui-même déconnecté (`signOut('partout')`). Garder sa ligne laisserait arriver des notifications du compte si le désabonnement du navigateur échouait.
2. **6.6.** La fonction est dans le schéma `securite`, non exposé, et non dans `public` : dans `public`, elle aurait été appelable par la REST, contrairement au garde-fou des privilèges. Storage et le temps réel ne passent pas par la pré-requête : ils acceptent un jeton jusqu'à son échéance, soit 10 min au plus.
3. **6.7.** Le job e2e de la CI garde des jetons d'une heure, parce qu'il rejoue un état de connexion pendant plus de 30 min. Toutes les suites tournent à 10 min.
4. **6.13b.** Dans `tests/audit/cvf2b-6-deconnexion.test.ts`, la table des stockages disait « aucune purge » pour `payment-client.ts`. Elle vaut maintenant `clearPaymentHandoffs` (commit `f6ee3d776`), assertion inchangée. Sans cela, le test ne pouvait passer qu'en perdant les liens de paiement.
5. **Tests existants adaptés.**
   - `changement-role-admin` et `lot9quater-droits` attendaient un jeton de session révoquée encore servi ; ils vérifient maintenant le 401.
   - `f2b-couleur-auto`, `zones-scan` et `e2e/recette.spec.ts` : OR n'est plus choisissable.
   - `securite-admin-lot7` (run 353) : l'ancien jeton d'un admin anonymisé est maintenant refusé par la pré-requête (401 `SESSION_FERMEE`). Ce refus est admis comme les autres ; l'assertion « refusé » est inchangée.
   - `migration-finition2b-rejouable` (run 353) : les migrations 20261121 passent après la 2b. Elles sont exclues de « toutes les autres » que la 2b doit suivre.
   - `docs/recette-billetterie.md` (runs 353 et 354) : des lignes citées ont été décalées par ces adaptations. Elles sont mises à jour : `changement-role-admin` 43 → 47, `zones-scan` 454 → 455, `securite-admin-lot7` 312 → 314 et 342 → 344.
   - `f2b-recherche-cadence` : rouge une fois au run 353 (« 1 appel » au lieu de 2 au moins), verte au run 354 sans changement. Elle avait passé aux 11 runs précédents, et aucun fichier de la recherche de lieux n'est touché ; la recherche passe par le rôle de service, que la pré-requête laisse passer aussitôt. C'est donc un minutage fragile du créneau commun.
6. **CI.** `verify.yml` ne se déclenchait pas sur `correctifs/**` : le premier envoi (`c15bb85f4`) n'a lancé aucun run. Le motif `correctifs/**` est ajouté aux branches du déclencheur (commit `c1dedc49b`), rien d'autre ne change.
7. **Test du temps réel réécrit** (`f28b284f4`, ma suite et non une suite cvf2b). Au run 349, la première version restait rouge : le canal recevait encore après l'échéance. Ce n'était pas un défaut du serveur, le test était mal construit, pour deux raisons :
   - il visait `public_event_state`, que la clé anon peut lire ;
   - realtime-js 2.114 s'abonne avant que le rappel `accessToken`, asynchrone, ait rendu le jeton. Le canal tournait donc avec la seule clé anon, qui n'expire pas.

   Le test vise maintenant les notifications du compte, une table privée, et le jeton est remis au client avant l'abonnement. Une réception avant l'échéance prouve donc que le canal porte bien ce jeton ; un contrôle vérifie aussi que la clé anon ne reçoit rien. L'assertion « rien après l'échéance » est inchangée. Au run 352, aucun message n'arrive après l'échéance et le canal est fermé par le serveur. Le code de Realtime v2.147.1 programme d'ailleurs cette vérification à l'échéance exacte du jeton.
8. **Signalé, non traité (hors consigne).**
   - `/api/auth/reset-password` révoque les sessions sans supprimer les abonnements push des autres appareils : c'est le même trou que la 6.8.
   - `docs/apres-lancement.md` : la ligne sur le brouillon gardé est devenue fausse avec 5c et 5d.

### Migrations, dans l'ordre (les 7 et 8 redéfinissent les mêmes fonctions)
`20261121000001_cvf2b_jeton_session_revoquee`, `20261121000005_cvf2b_avis_en_cours_envoi`, `20261121000006_cvf2b_plafond_heure_glissante`, `20261121000007_cvf2b_couleur_or`, `20261121000008_cvf2b_consigne_controle`.

### Contrôles (lecture seule, event-village-dev)

| Contrôle | Avant | Après |
|---|---|---|
| pré-requête : réglage de `authenticator` | aucune ligne | `pgrst.db_pre_request=securite.db_pre_request` |
| pré-requête : fonction présente | f | t |
| 4d | f, f, f | t, t, t |
| 4f | t, f | f, t |
| 2b | t, t | f, f |
| 2c | f, f | t, t |
| catégories en OR | à noter | identique |

```sql
SELECT c FROM pg_db_role_setting rs, unnest(rs.setconfig) c
 WHERE rs.setrole = 'authenticator'::regrole AND c LIKE 'pgrst.db_pre_request=%';
SELECT to_regprocedure('securite.db_pre_request()') IS NOT NULL AS pre_requete;
SELECT position('o.status = ''SENDING''' IN pg_get_functiondef('public.event_update(jsonb)'::regprocedure)) > 0,
       position('v_hdue' IN pg_get_functiondef('public.event_change_notify(jsonb)'::regprocedure)) > 0,
       position('held_until = CASE' IN pg_get_functiondef('public.notif_place_notice_sent()'::regprocedure)) > 0;
SELECT position('p->>''last_hour_from''' IN pg_get_functiondef('public.event_change_notify(jsonb)'::regprocedure)) > 0,
       position('v_cap_from := v_hdue - interval' IN pg_get_functiondef('public.event_change_notify(jsonb)'::regprocedure)) > 0;
SELECT position('''OR''' IN pg_get_functiondef('public.ticket_category_normalize(jsonb, timestamptz, text)'::regprocedure)) > 0,
       position('''OR''' IN pg_get_functiondef('public.ticket_category_update(jsonb)'::regprocedure)) > 0;
SELECT position('‪-‮' IN pg_get_functiondef('public.ticket_category_normalize(jsonb, timestamptz, text)'::regprocedure)) > 0,
       position('‪-‮' IN pg_get_functiondef('public.ticket_category_update(jsonb)'::regprocedure)) > 0;
SELECT count(*) AS categories_or FROM public.ticket_categories WHERE scan_color = 'OR';
```

Avec un jeton de session fermée, `GET /rest/v1/users?select=id&limit=1` répond 401 `SESSION_FERMEE` ; avec la clé anon seule, 200.

### Réglage à faire sur le tableau de bord
Supabase, projet event-village-dev :
- **Chemin** : Project Settings > JWT Keys. Si le projet est passé aux nouvelles clés de signature, ouvrir l'onglet « Legacy JWT Secret ».
- **Champ** : « Access token expiry time » = **600**.
- **Sans le tableau de bord** : `PATCH /v1/projects/<ref>/config/auth` avec `{"jwt_exp": 600}`.

La nouvelle durée vaut pour les jetons émis ou rafraîchis après le changement.

### Runs

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| — | `c15bb85f4` | rapide | aucun run : branche absente du déclencheur |
| 349 | `c1dedc49b` | rapide, 81 suites : toutes les cvf2b, audit, audit-auth, nouvelles et adaptées | 80/81 ; seule rouge : `cvf2b-correctif-pre-requete`, cas 5 (test mal construit, écart 7) ; typecheck et lint OK |
| 352 | `f28b284f4` | rapide, `cvf2b-correctif-pre-requete` | vert, 5/5 |
| 353 | `6adcd63ac` | complet, 4 lots | 471/475 ; rouges : `securite-admin-lot7`, `migration-finition2b-rejouable`, `recette-matrice` (suites anciennes, écart 5), `f2b-recherche-cadence` (fragile) ; e2e, build et budget JS verts |
| 354 | `cb0a1ad67` | rapide, ces 4 suites | 3/4 ; `recette-matrice` encore rouge : deux citations décalées par le commentaire ajouté à `securite-admin-lot7` |
| 355 | `f2753e3ea` | complet, 4 lots, 44 min | 474/475 ; seule rouge : `invitations-annulation`, GoTrue répond 504 (« Processing this request timed out ») à la création d'un compte de test. La suite était verte au run 353 avec le même code ; GoTrue ne passe pas par la pré-requête. e2e, build et budget JS verts |

Poids JS au run 355, en octets compressés : `/` 225 259 (main au run 336 : 224 866, soit +393 ; budget 226 342), `/events/[id]` 231 901 (233 316), `/tickets` 249 591 (250 417), `/controller/scanner` 231 668 (234 911), `/billet/hors-ligne` 221 089 (224 268). Budgets non relevés.
