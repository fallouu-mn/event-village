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

**Preuves.** Rouge au run 300 (tests seuls, § 4) ; vert au run rapide 303 et au run complet RUN_COMPLET.

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
| `/` | 226 342 | 226 300 | JS_ACCUEIL |
| `/events/[id]` | 233 316 | 232 938 | JS_EVENEMENT |
| `/tickets` | 250 417 | 249 690 | JS_BILLETS |
| `/controller/scanner` | 234 911 | 233 887 | JS_SCANNER |
| `/billet/hors-ligne` | 224 268 | 221 850 | JS_HORS_LIGNE |

## 4. Runs

| Run | Commit | Rôle | Résultat |
|---|---|---|---|
| 300 | `22b61315e` | Tests seuls, run complet (rouge attendu) | **Rouge pour la bonne raison** : seule `securite-deconnexion` rouge sur 459 suites (module absent, ancien code ; le témoin de la cause dans auth-js vert) ; e2e : seule la phase `deconnexion` rouge. Sans réseau, aucun message, et les cookies `sb-127-auth-token.0` et `.1` restent ; au retour du réseau, `/api/tickets` et `/api/auth/me` repartent avec l'ancienne session, et l'écran de connexion arrive sans le message. Dans ce run, le compte n'a pas été rouvert : le réseau est revenu pendant que l'ancien code réessayait encore, ce qui a fini par fermer la session. Job arrêté par sa limite de 90 min juste après l'e2e (machine lente, § 5). |
| 303 | `8b7086287` | Correctif, mode rapide (43 suites qui lisent un fichier modifié, plus les suites d'audit de l'authentification) | **43/43**. Témoin : `auth.signOut` sans réseau rend `AuthRetryableFetchError` et laisse les deux cookies de session. Retour du réseau : 4 requêtes, la révocation en premier : déconnexion avec l'ancien jeton (refusée), nouveau jeton, déconnexion. |
| 307 | `fa465ba71` | Run complet | Suites **459/459**, poids JavaScript vert (`/` 225 675 pour 226 342), toutes les phases e2e vertes sauf `deconnexion`, rouge sur un seul constat : au retour du réseau, l'écran de connexion n'est pas venu dans les 30 s (page restée sur l'écran « déconnecté »). Les autres constats étaient verts : message et cookies effacés sans réseau, révocation faite, aucun compte ensuite, aucune requête avec l'ancien jeton. Cause probable, non prouvée faute de trace : le rappel attendait un second effacement local avant de naviguer, ou le premier essai au retour du réseau est parti trop tôt, le suivant n'arrivant que 30 s plus tard. Corrigé (commit `e9b495f86`) : navigation d'abord, effacement ensuite sans l'attendre ; nouveaux essais à 1 s, 2 s, 4 s… jusqu'à 30 s, en repartant de 1 s au retour du réseau. |
| RUN_COMPLET | COMPLET_SHA | Run complet final | COMPLET_RESULTAT |

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
