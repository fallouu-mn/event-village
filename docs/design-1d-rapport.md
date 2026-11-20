# Design 1d — Vitrine

Branche `design-1d/vitrine`, partie de `main` à `6afe843df` (designs 1a, 1b, 1c et 1c bis fusionnés), **fusionnée dans
`main` le 20/11 (`d0bbe8caa`)**. Une seule migration, `20261127000001_d1d_vitrine.sql`, **appliquée sur event-village-dev le
20/11** (section 13). Le catalogue des avis (`lib/notifications`), les
types d'avis, les pages des salles et des tables ne sont pas touchés ; aucun nouveau type d'avis.

## À lire en premier

**État final : fusionné dans `main` (`d0bbe8caa`), migration appliquée, 03-verification 20/20.** Run de la branche 512
(main `15a51f663` compris) vert à la 2ᵉ tentative : tests, budgets JavaScript tenus sans relèvement, e2e vert, responsive
vert, **accueil 91, fiche 93, Mes billets 90**. Run complet de main **515 rouge sur un seul point : Mes billets 89**
[85 ; 89 ; 91 ; 89 ; 87], machine normale (×3,8 à ×4,4) ; tout le reste vert (accueil 93, fiche 90). **Accepté par
l'utilisateur pour ce lot** (même code à 90 aux runs 491 et 512) ; le lot « vitesse » qui suit s'en charge. Détail en
section 13.

- **Le script des affiches existantes n'est pas lancé** (consigne) : à faire par l'utilisateur (section 7, étape 6).
  Tant qu'il ne l'est pas, les 2 événements à affiche du compartiment s'affichent en « bleu nuit » par défaut.

- **Mes billets est au seuil (90)**, la fiche à 92 : la cible de 93 n'est atteinte que pour l'accueil. Trois tentatives
  ont été faites (mode autonome) ; le détail est en section 10.
- **Un défaut de mon code trouvé par les captures et corrigé** (pas une faille) : les recherches récentes d'un visiteur
  étaient effacées à chaque page, la purge « session close à l'insu » valant aussi pour toute visite sans compte.
- **Un écart relevé sur les captures, corrigé avant la fusion** : « Retour » au lieu de « Retour aux événements » en haut de la fiche sur grand écran
  (section 11).

- **Sécurité** : aucune faille trouvée dans le code existant pendant le lot. Les deux sujets de sécurité du lot ont leurs
  tests, rouges avant le code (run 478) puis verts :
  - **partage privé** : l'image d'aperçu n'est générée que pour un événement **publié** ; brouillon, en attente, validé,
    suspendu, annulé, terminé, inconnu : 404 sans image, jamais gardé en cache (`tests/parcours/design1d-partage-prive`) ;
  - **favoris d'autrui** : une personne ne voit ni ne retire jamais les favoris d'une autre, ni par les routes, ni par la
    REST, ni par les fonctions (`tests/security/r32-favoris`, clé anon seule).
- **« Privé »** : il n'existe aucun champ « événement privé » dans le projet. Est privé tout événement non public
  (brouillon, en attente, validé, terminé sans publication). C'est ce que vérifient les tests.
- **Migration appliquée** le 20/11 (section 13). Reste le script rejouable des affiches existantes
  (`npx tsx scripts/poster-styles.ts`, à blanc puis `--appliquer`), par l'utilisateur.
- **Tests modifiés, signalés** : section 8.

## 1. Couleur de l'affiche

- **Calcul** (`lib/images/poster-style.ts`) : à l'envoi d'une affiche (route `POST /api/partner/upload`, dossier `events`),
  sharp calcule la couleur dominante (histogramme, `stats().dominant`), puis l'assombrit (même teinte, les trois canaux
  multipliés par le même facteur) jusqu'à un contraste d'au moins **4,6:1** avec du texte blanc (marge au-dessus de
  4,5:1). Il prépare aussi une **image déjà floutée** de 24 px de côté au plus, WebP en adresse `data:` (130 à
  400 caractères), que la fiche agrandit : aucun flou CSS (`filter`) à calculer.
- **Rangement** : `poster_styles` (par chemin du fichier). L'événement prend le style en enregistrant l'adresse de
  l'affiche (trigger `trg_events_poster_style`), quel que soit le chemin d'écriture (création, modification,
  réencodage). Une autre affiche sans style, une adresse d'un autre hôte, une affiche retirée : couleur vide.
- **Repli « bleu nuit »** : nouveau jeton `--poster-fallback` (#14213D, texte blanc 15,9:1), dans `app/globals.css` et
  `docs/design/jetons.css`, mêmes valeurs en sombre. Une couleur enregistrée trop claire ou mal formée est ignorée à
  l'affichage (`posterColorOrFallback`).
- **Affiches existantes** : `scripts/poster-styles.ts` (à blanc par défaut, `--appliquer` pour écrire, 100 fichiers par
  passage, rejouable). Le réencodage des anciennes affiches (`scripts/reencode-posters.ts`) enregistre aussi le style du
  nouveau fichier.
- **Contrôles de la base** : la couleur est revérifiée par `poster_style_put` (forme et contraste calculé en SQL) et par
  des contraintes des tables ; l'image floutée doit être `data:image/webp;base64,…` (3 000 caractères au plus).

## 2. Cartes d'événement verticales

- Accueil (« En ce moment », « À la une », rangées), Explorer, Mes favoris : **affiche 4:5 entière** (`object-contain`,
  jamais rognée sur son texte) sur la couleur de l'affiche ; bas de carte en **dégradé** de cette couleur vers une teinte
  plus sombre (le contraste du texte ne fait que monter) ; **titre blanc entier** (retour à la ligne), date, compte à
  rebours, catégorie, lieu, **prix d'appel dans une pastille orange** (orange de la marque, texte foncé).
- **Chargement** : la carte a sa couleur dès le premier affichage ; l'image arrive **en fondu** (250 ms) quand elle est
  chargée, par un script de quelques octets dans `<head>` (`lib/ui/poster-fade.ts`) : aucun îlot par carte, jamais de
  flash blanc. L'image principale (préchargée, `fetchpriority=high`) n'attend jamais.
- Explorer et Mes favoris : **deux colonnes sur téléphone**, trois dès 640 px, quatre dès 1 024 px.
- Rangées de l'accueil : 64 % de la largeur sur téléphone (la carte suivante dépasse), la première carte d'« À la une »
  78 %.

## 3. Fiche

- **Haut immersif** : image floutée de l'affiche en fond, sous un voile de la couleur de l'affiche ; **affiche entière au
  premier plan** (4:5), même nom de transition que la carte (transition carte → fiche gardée) ; titre, organisateur,
  date, lieu et compte à rebours en blanc, **toujours sur la couleur pleine** (sous l'affiche sur téléphone, à sa droite
  sur ordinateur).
- **Feuille de contenu aux coins arrondis** qui monte par-dessus le haut (250 ms, transform et opacity).
- **Barre d'achat fixe gardée** (billetterie inchangée), bandeaux d'état et de paiement en attente dans la feuille.
- En haut : « Retour aux événements », **cœur des favoris** et **« Partager »** sur pastilles sombres.

## 4. Comptes à rebours

Calculés dans le navigateur **après** le chargement (`lib/events/countdown.ts`), jamais dans la page en cache ; premier
rendu identique serveur et navigateur (aucune erreur d'hydratation).

| Moment | Carte (à la minute) | Fiche |
|---|---|---|
| Plus de 7 jours | rien (la date) | rien (la date) |
| De 7 jours à 24 h | « Commence dans 2 j 4 h » | « Commence dans 2 j 4 h » |
| Dernier jour | « Commence dans 3 h 12 min » | « Commence dans 3 h 12 min 05 s » |
| Pendant | badge « En cours » (existant) | badge « En cours » sur l'affiche (existant) |
| Fin des ventes en ligne à 48 h ou moins | — | « Ventes closes dans 1 j 4 h », puis l'horloge |
| Paiement en attente | — | « 12 min 05 s pour finir le paiement » (bandeau) |

- **Lecteurs d'écran** : le texte visible leur est caché ; ils lisent une phrase en mots entiers, à la minute près
  (« Commence dans 3 heures et 12 minutes »), sans annonce automatique. Test : la phrase est la même pendant toute une
  minute.
- **Une seule minuterie** pour toutes les cartes de la page (îlot `CardLiveBadges`, déjà là pour « En cours »).

## 5. Partage

- **Image d'aperçu** (`GET /api/events/[id]/apercu`, PNG 1 200 × 630, `next/og`) : affiche entière à gauche sur sa
  couleur, logo Bras levés, titre, date et heure, lieu, prix d'appel en orange. Polices Plus Jakarta Sans statiques
  (`lib/og/fonts`, licence OFL, dans le dépôt).
- **Seulement pour un événement publié** : le statut est relu en base, sans cache, à chaque demande ; sinon 404 sans
  image, `Cache-Control: no-store`, même corps pour tous. L'image est gardée côté serveur par version (titre, date, prix,
  affiche, couleur) et 5 minutes chez le visiteur.
- Les métadonnées de la fiche (Open Graph, Twitter) citent cette image seulement pour un événement publié ; sinon l'image
  générique du site.
- **Bouton « Partager »** : feuille de partage du téléphone, sinon copie du lien (comportement existant), écrit dès
  640 px, icône seule en dessous.

## 6. Achat rapide, agenda, favoris, recherche, finitions

- **Achat rapide** : le dernier opérateur (Wave ou Orange Money) et le numéro de paiement de **cet appareil** sont
  proposés d'avance (`lib/device/device-prefs.ts`, stockage local, try/catch) ; ils ne sont gardés que quand le serveur
  a **accepté** la demande de paiement. **Effacement** (AuthProvider) : tout (numéro et recherches récentes) au bouton
  « Se déconnecter » et sur SIGNED_OUT dans chaque onglet ; le numéro seul sur une page chargée sans session (ce chemin,
  « session close à l'insu », vaut aussi pour toute visite sans compte, qui garde ainsi ses recherches récentes). Rien de
  nouveau côté serveur ; le bouton « Payer », la confirmation chez l'opérateur et tous les contrôles restent. Sur
  téléphone, la fenêtre de paiement **monte du bas** (translation seule : boutons de 44 px à chaque image).
- **Agenda** : « Ajouter à mon agenda » (fichier .ics, fuseau Africa/Dakar déclaré) et « Google Agenda » sur chaque
  billet actif ; l'acheteur arrive sur ses billets après l'achat. Module chargé au toucher.
- **Favoris** : cœur sur chaque carte et sur la fiche (rendu par le serveur ; un seul îlot par page, chargé pour un
  compte connecté ou au premier toucher d'un cœur, toucher rejoué ; rebond de 260 ms, vibration légère à l'ajout) ;
  visiteur → connexion puis retour ; page **« Mes favoris »** dans le compte (raccourci du
  profil). Table sans aucun droit de table ; lecture et écriture par deux fonctions réservées au rôle de service ; compte
  toujours lu dans la session. Aucun avis.
- **Recherche instantanée** : fenêtre ouverte depuis l'en-tête, le menu et le champ de l'accueil (code chargé au premier
  geste sur l'un d'eux, geste rejoué ; sans JavaScript, ils mènent à Explorer comme avant) ; résultats pendant la
  saisie (250 ms, serveur, 8 au plus, catalogue en cache) ; **recherches récentes** sur l'appareil (6 au plus), avec
  **« Effacer »** ; aussi sous le champ d'Explorer.
- **Pastilles de catégories** d'Explorer collées en haut pendant tout le défilement, **indicateur qui glisse** (transform).
- **États vides illustrés** (Bras levés + une phrase + un bouton) : accueil, Explorer, Mes billets, Mes favoris, recherche.
- **Tirer pour actualiser** sur Mes billets (écrans tactiles ; le rechargement natif du navigateur est coupé sur cette
  page ; résultat annoncé aux lecteurs d'écran).
- **Vibration légère** à l'achat confirmé (petite fête de Mes billets) et au favori ajouté.
- **Retour arrière** : la position de la liste (carte touchée, rangées horizontales) est gardée **en mémoire** au toucher
  d'une carte et remise au retour (ancrée sur la carte touchée) ; rien n'est écrit dans le stockage.
- **Animations** : 150 à 300 ms, transform et opacity seulement, jamais en boucle, toutes coupées par « réduire les
  animations » (bloc existant). Aucun mot technique à l'écran (garde-fous verts).

### Décisions prises pendant le lot (validées par l'utilisateur le 20/11)

1. **« En ce moment » à l'accueil** (règle du design 1b modifiée) : une rangée **absente du HTML en cache** n'est plus
   insérée au chargement de la page (avec les cartes 4:5, elle poussait toute la page d'environ 540 px : saut mesuré de
   0,642 au run 481). Les cartes portent déjà « En cours », et la page régénérée (60 s au plus) l'a. Page ouverte, les
   changements à la bonne minute restent ; un événement fini est toujours retiré.
2. **Purge des préférences de l'appareil** : voir section 6 (le numéro seul sur une page chargée sans session).
3. **Fin des ventes** annoncée 48 h avant au plus ; **cartes** : compte à rebours à la minute (une seule minuterie par
   page), la fiche seule compte les secondes le dernier jour.
4. **Explorer et Mes favoris en deux colonnes** sur téléphone ; rangées de l'accueil à 64 % de la largeur.
5. **Recherche instantanée sans limiteur de débit** : elle ne lit que le catalogue public déjà en mémoire (comme Explorer),
   aucune lecture en base par frappe ; noté dans `docs/apres-lancement.md`.
6. **Graine de démonstration** : les affiches de la graine passent par le même calcul de couleur qu'un dépôt
   (`tests/seed/seed-demo.ts`), pour que les captures montrent l'état après le script des affiches existantes.

## 7. Migration et contrôles prévus

**Migration** : `supabase/migrations/20261127000001_d1d_vitrine.sql`, sans BEGIN ni COMMIT, rejouable (test
`migration-d1d-vitrine-rejouable` : deux passages de plus dans une transaction annulée). Elle ajoute :
- `events.poster_color`, `events.poster_blur` (contraintes de forme) ;
- `poster_styles` (RLS, aucune politique, lecture seule du service_role) ;
- `event_favorites` (RLS, aucune politique, **aucun** droit de table pour anon, authenticated ni service_role) ;
- 6 fonctions SECURITY DEFINER à `search_path` fixé, exécutables par le service_role seul : `poster_color_contrast`,
  `poster_path_of`, `poster_style_put`, `events_poster_style_sync` (trigger), `event_favorite_set`, `event_favorite_list` ;
- le trigger `trg_events_poster_style` (BEFORE INSERT OR UPDATE OF image_url) : il ne touche que les deux colonnes de
  style ; le trigger d'alerte aux admins (`trg_events_admin_change_alert`) ne regarde pas ces colonnes.

**Ordre prévu, après la fusion** (par l'utilisateur ; je n'applique rien) :
1. `supabase db push --dry-run` : il doit lister **cette seule** migration (avec celles des lots fusionnés avant).
2. Contrôle « avant » (lecture seule) :
   ```sql
   SELECT to_regclass('public.event_favorites') AS favoris, to_regclass('public.poster_styles') AS styles,
          (SELECT count(*) FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'events' AND column_name IN ('poster_color', 'poster_blur')) AS colonnes;
   -- attendu : null, null, 0
   ```
3. `supabase db push`.
4. Contrôle « après » (lecture seule) :
   ```sql
   SELECT c.relname, c.relrowsecurity,
          (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS politiques
     FROM pg_class c WHERE c.oid IN ('public.event_favorites'::regclass, 'public.poster_styles'::regclass);
   -- attendu : RLS vraie, 0 politique pour les deux
   SELECT t, r, has_table_privilege(r, 'public.' || t, 'SELECT') AS lire, has_table_privilege(r, 'public.' || t, 'INSERT') AS ecrire
     FROM unnest(ARRAY['event_favorites', 'poster_styles']) t, unnest(ARRAY['anon', 'authenticated', 'service_role']) r;
   -- attendu : tout faux, sauf poster_styles / service_role / lire
   SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
          has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
          has_function_privilege('service_role', p.oid, 'EXECUTE') AS service, p.prosecdef
     FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('poster_color_contrast', 'poster_path_of', 'poster_style_put', 'events_poster_style_sync',
                        'event_favorite_set', 'event_favorite_list');
   -- attendu : 6 lignes, anon et auth faux, service et prosecdef vrais
   SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.events'::regclass AND tgname = 'trg_events_poster_style';
   -- attendu : 1
   SELECT count(*) FILTER (WHERE poster_color IS NOT NULL) AS colorees, count(*) AS total FROM public.events;
   -- attendu : 0 colorée avant le script
   ```
5. `supabase/tests/03-verification.sql` (20/20 attendu, comme aux lots précédents).
6. Script des affiches existantes : `npx tsx scripts/poster-styles.ts` (à blanc : liste des affiches et couleur
   prévue), puis `npx tsx scripts/poster-styles.ts --appliquer`, à relancer tant que « Restants » n'est pas 0 ; un
   second passage ne retrouve que les fichiers absents ou illisibles (signalés, « bleu nuit » à l'écran).
7. Contrôle « après le script » : `SELECT count(*) FILTER (WHERE poster_color IS NOT NULL), count(*) FROM public.events
   WHERE image_url LIKE '%/storage/v1/object/public/public-images/events/%';` (toutes colorées, sauf les fichiers signalés).

## 8. Tests

**Nouveaux** (écrits avant le code, commit `54f609489`, rouges au run 478) :

| Suite | Ce qu'elle prouve |
|---|---|
| `tests/security/r32-favoris` | Favoris d'autrui : routes (cookies de session, compte d'autrui en paramètre ignoré, retrait de B sans effet sur A, 401 sans session), REST (lecture, insertion au nom d'autrui, mise à jour, suppression refusées, jeton de B et sans jeton), fonctions (refusées), événement annulé = même 404 qu'un inconnu. Clé anon seule. |
| `tests/parcours/design1d-partage-prive` | Aucune image d'aperçu pour un brouillon, un événement en attente, validé, suspendu, annulé, terminé, inconnu ou illisible (404, `no-store`, même corps, aucun titre) ; publié : PNG 1 200 × 630 ; suspendu ou annulé juste après la génération : 404 aussitôt ; métadonnées de la fiche. |
| `tests/parcours/design1d-favoris` | Favoris par les routes (statuts, cartes, autrui, sans session, aucun avis créé) ; couleur par un vrai dépôt d'affiche (contraste ≥ 4,5:1), prise par l'événement (trigger), servie par la fiche, remise à vide pour une autre affiche ; script des affiches existantes (à blanc, appliqué, rejoué). |
| `tests/parcours/design1d-recherche` | Recherche instantanée : publiés seulement (5 statuts non publiés portant le même mot jamais servis), 8 au plus, total juste, champs de la carte seulement, saisies piégées sans erreur. |
| `tests/schema/migration-d1d-vitrine-rejouable` | Migration rejouable ; droits des deux tables et des 6 fonctions ; trigger unique ; refus de `poster_style_put` (chemin, blanc, orange vif, forme, image floutée piégée) ; trigger et rangement ; favoris (brouillon, compte inconnu, liste du compte seulement, jamais un brouillon). |
| `tests/schema/design1d-vitrine` | Couleur (sharp, 8 affiches dont transparente et rayée), jeton identique partout, branchements ; comptes à rebours (seuils, texte des lecteurs d'écran stable sur une minute, cartes à la minute) ; agenda (.ics CRLF, fuseau, échappements, lignes de 75 octets, Google) ; préférences de l'appareil (valeurs illisibles, stockage refusé ou plein, purge et ses trois appels) ; recherche ; prix de l'aperçu. |
| e2e | Captures `explorer-pastilles-collees`, `recherche-instantanee`, `recherche-recentes`, `paiement-rapide`, `mes-favoris` (4 vues chacune) ; fumée : image d'aperçu (publié 200, annulé 404) et retour arrière à la même place ; page `profil-favoris` ajoutée au contrôle responsive. |

**Modifiés, signalés** (aucune exigence baissée) :
- `tests/audit/cvf2b-6-deconnexion` (13b, inventaire du stockage) : nouvel écrivain `lib/device/device-prefs.ts` classé « lié au compte », purge `clearDevicePrefs` exigée dans le bouton ET sur SIGNED_OUT (le test le vérifie). Sans cette ligne, le test refuse tout écrivain inconnu.
- `tests/schema/d1cbis-horloge` : la fiche de test reçoit les deux nouveaux champs obligatoires (`posterColor`, `posterBlur`) ; aucune assertion changée.
- `tests/schema/design1b-catalogue` : première carte de « À la une » à 78 % de la largeur (88 % avant), demande du point 2.
- `tests/schema/design1b-fiche` : affiche de la fiche en 4:5 (16/10 avant), demande du point 3.
- `tests/parcours/stock-public-9ter` : la liste exacte des clés de la carte reçoit `posterColor` (aucune donnée de stock).
- `tests/helpers/design-files.ts` : les nouveaux écrans entrent dans la liste du système de design (et en subissent les règles).
- `tests/seed/seed-demo.ts` (graine de démonstration de l'e2e) : style des affiches calculé comme au dépôt (décision 6).
- `e2e/fumee.spec.ts` : un test ajouté à la fin ; ses imports sont dans le test lui-même pour ne décaler aucune ligne
  citée par la recette (`docs/recette-billetterie.md`, ligne 99) : rouge au run 481 avant ce déplacement.
- `tests/schema/design1d-vitrine` (test du lot) : la règle de purge a changé après le run 481 (le numéro seul sur une page
  chargée sans session) ; le test vérifie la nouvelle règle (recherches gardées pour un visiteur, tout effacé au bouton et
  sur SIGNED_OUT).
- Erreurs de **mes** tests corrigées après le run 479 (pas du code) : un événement suspendu ne s'annule pas (second
  événement publié pour l'annulation) ; la route de la fiche enveloppe sa réponse (`{ event }`).

**Garde-fous déjà verts avant le code** (signalés) : dans `r32-favoris`, les refus REST et fonctions passaient au run 478
parce que la table et les fonctions n'existaient pas encore (PGRST202, PGRST205) ; la suite était rouge par ses routes.

## 9. Runs

Journaux bruts sur la branche `ci-results`, dossier `runs/<n>-<id>/`.

| Run | Commit | Mode | Résultat |
|---|---|---|---|
| 471 (main) | `6afe843df` | complet | **référence « avant »** : tests 539/539, accueil 92, fiche 92, Mes billets 91, responsive 0 défaut |
| 478 | `54f609489` | rapide, tests seuls | **rouge attendu** : les 6 suites du lot rouges (modules, routes, table absents), `anon-uniquement` vert |
| 479 | `cf0f2555e` | rapide, 36 suites | 33/36 : deux erreurs de mes tests (un suspendu ne s'annule pas ; réponse `{ event }`), une liste de clés à compléter (`stock-public-9ter`) |
| 481 | `d81b0e683` | complet | tests 544/545 (`recette-matrice` : ligne citée décalée par mes imports) ; budget de la fiche + 728 o ; fiche 89, Mes billets 89 ; saut de 0,642 à l'accueil sur 3 passages ; 4 captures « recherches récentes » rouges ; 2 défauts responsive à 1 024 px. Toutes les causes trouvées, corrigées dans `6f33acf9d` (tentative 1) |
| 485 | `6f33acf9d` | complet | **tests 545/545**, budgets JS tenus, e2e vert (captures, fumée, terrain, recette), responsive **0 défaut** ; restent la fiche 88 (85 à 94, temps de blocage 274 à 556 ms) et Mes billets 89 (saut nouveau de 0,049 : « tirer pour actualiser » en tête d'un conteneur à marges). Corrigé dans `72d15e9bb` (tentative 2) |
| 488 | `72d15e9bb` | complet | tests 545/545, budgets tenus, responsive 0 défaut ; **mesure inexploitable** : machine très rapide (indice 3 400 à 3 800, processeur ×6,4 à ×7,7, cas du run 426 du design 1b), accueil 86 alors que son code n'a fait que s'alléger, fiche 86, Mes billets 83 ; connexion du superadmin en échec dans l'e2e (fenêtre du code remplacée pendant une navigation, instabilité connue de la finition 4) et captures de l'administration en cascade. Nouvelle mesure demandée par un commit vide (`d482bbc5f`), aucun code changé |
| 489 | `d482bbc5f` | complet (même code que 488) | **tests 545/545**, budgets tenus, **e2e vert**, **responsive 0 défaut**, **accueil 91, fiche 91** ; Mes billets **87** (84 à 88 ; temps de blocage 528 à 631 ms) : trois petits morceaux nouveaux (lanceur de recherche, tirer pour actualiser, agenda) arrivaient pendant le chargement, chacun suivi d'un rendu de React (script de React 1 412 → 1 595 ms). Corrigé dans `1bc8eeec8` (tentative 3, la dernière) |
| **491** | `1bc8eeec8` | complet | **VERT** (conclusion « success ») : tests **545/545**, budgets JS tenus sans relèvement, e2e vert (captures, fumée, terrain, recette, perf), contrôle responsive **0 défaut** sur 126 résultats ; **accueil 93, fiche 92, Mes billets 90** (seuils et calibration inchangés) |
| 504 | `eaaf853eb` (main `7a10640ba` fusionné : lot 10b) | complet | **rouge** : budget de `/billet/hors-ligne` dépassé de 166 o (224 434 pour 224 268 permis) : `next/dynamic` dans le layout racine ajoutait son moteur au JavaScript de chaque page ; Mes billets 89 [89 ; 88 ; 93 ; 89 ; 93] ; un échec e2e isolé sur un champ de date (avis de l'administration, mode sombre), non reproduit ensuite. Accueil 92, fiche 91. Corrigé dans `5720d5f7d` (React.lazy, comme la barre de progression) |
| 510 | `fda0a7351` | complet | budgets **tenus** (`/billet/hors-ligne` 223 340), e2e vert, responsive vert ; Mes billets **86** [86 ; 86 ; 84 ; 89 ; 89] avec « tirer pour actualiser » armé au premier moment libre (`3899bb612`) : aucun gain mesurable (machine ×4,7 à ×5). **Annulé** sur décision de l'utilisateur (`ea60b3d42`) |
| 512 | `47850a3d3` (main `15a51f663` fusionné : connexion) | complet | 1ʳᵉ tentative : tout vert sauf la mesure, **inexploitable** (machine ×7 : accueil 83, fiche 85, Mes billets 80). Job relancé par l'utilisateur. **2ᵉ tentative VERTE** : budgets tenus, e2e vert, responsive vert, **accueil 91, fiche 93, Mes billets 90** |
| **515 (main)** | `d0bbe8caa` (fusion) | complet | **rouge sur un seul point** : Mes billets **89** [85 ; 89 ; 91 ; 89 ; 87] (machine ×3,8 à ×4,4, mesure valable) ; tests, budgets JS, e2e, responsive verts ; accueil **93**, fiche **90**. Accepté par l'utilisateur pour ce lot |

## 10. Poids JavaScript et mesures mobiles

### Poids JavaScript (gzip, octets ; budgets inchangés)

| Route | Avant (run 471, main) | Run 481 | Run 491 | Run 504 | **Fusionné (run 512)** | Budget |
|---|---|---|---|---|---|---|
| `/` | 220 320 | 225 700 | 223 559 | 224 395 | **223 301** | 226 342 |
| `/events/[id]` | 230 254 | 234 044 (**dépassé**) | 232 333 | 232 962 | **231 868** | 233 316 |
| `/tickets` | 242 883 | 246 559 | 246 663 | 247 371 | **246 277** | 250 417 |
| `/controller/scanner` | 231 751 | 233 332 | 233 435 | 234 288 | **233 194** | 234 911 |
| `/billet/hors-ligne` | 222 006 | 223 875 | 223 978 | 224 434 (**dépassé**) | **223 340** | 224 268 |

Ce qui ne sert pas au premier affichage arrive après lui ou au premier geste : cœurs (compte connecté ou premier
toucher, toucher rejoué), lanceur de la recherche (premier geste, rejoué), fenêtre de recherche (première ouverture),
comptes à rebours de la fiche et de la vente, module de l'agenda (toucher).

### Mesures mobiles (Lighthouse 13.6.0, téléphone de référence calibré, médiane de 5 passages ; seuils inchangés)

| Page | Avant (run 471) | Run 481 | Run 485 | Run 488 (machine ×7) | Run 489 | Run 491 | Run 504 | Run 510 | Run 512, 1ʳᵉ (×7) | Run 512, 2ᵉ | **Main (run 515)** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Accueil | 92 | 91 (saut réel 0,642) | 91 | 86 | 91 | 93 | 92 | 91 | 83 | 91 | **93** [92 ; 93 ; 93 ; 93 ; 91] |
| Fiche | 92 | 89 | 88 | 86 | 91 | 92 | 91 | 91 | 85 | 93 | **90** [88 ; 90 ; 95 ; 90 ; 92] |
| Mes billets | 91 | 89 | 89 (saut 0,049) | 83 | 87 | 90 | 89 | 86 | 80 | 90 | **89** [85 ; 89 ; 91 ; 89 ; 87] (accepté) |

- Run 491 : LCP médian accueil 1,06 s (élément : le texte d'accroche), fiche 2,11 s (l'affiche), Mes billets 926 ms ;
  sauts de mise en page réels 0,052 (accueil, comme avant), 0 (fiche), 0 (Mes billets) ; toucher sous 200 ms.
- **Mes billets est au seuil (90)**, comme avant le lot (89 à 92 selon les runs depuis le design 1b). La cible de 93 est
  atteinte pour l'accueil, pas pour la fiche (92) ni pour Mes billets (90). Une page à 89 sur un autre run ne serait pas
  une surprise ; la cause de fond (rendu React du portefeuille, client Supabase chargé pour la session) est celle déjà
  décrite au rapport du design 1b.
- Causes trouvées et corrigées en chemin (détail au tableau des runs) : rangée « En ce moment » insérée au chargement
  (saut de 540 px), « tirer pour actualiser » en tête d'un conteneur à marges (saut de 24 px), trois petits morceaux
  JavaScript arrivant pendant le chargement de Mes billets.

## 11. Captures

**Dans le dépôt** (décision du 20/11 : 20 captures clés au plus, le dépôt pèse déjà 4,3 Go), `docs/design-1d-captures/`,
téléphone, clair et sombre, JPEG compressé (1,4 Mo en tout) : accueil, Explorer (« Concerts »), fiche, fenêtre de paiement,
Mes billets.
- **avant** (`avant/`) : run 486, branche `finition-4/messages`, qui contient main `6afe843df` et ne touche que les
  messages (pages publiques identiques à main ; les captures du run 471 n'étaient déjà plus dans `ci-results`) ;
- **après** (`apres/`) : run 491.

**Dans `ci-results`**, par numéro de run :
- run 491, `runs/491-44683320670/captures/` (691 captures, téléphone et ordinateur, clair et sombre) : en plus des écrans
  ci-dessus, `explorer-pastilles-collees`, `paiement-rapide`, `mes-favoris`, `recherche-instantanee`,
  `recherche-recentes`, et l'image d'aperçu de partage `apercu-partage__ce-soir.png` ;
- run 491, `runs/491-44683320670/captures-responsive/` (386 captures du contrôle responsive, 360, 768 et 1 440 px, clair
  et sombre, dont `fiche`, `explorer`, `profil-favoris`) ;
- « avant » : run 486, `runs/486-44669202308/captures/`. L'image de partage d'avant était l'image générique du site
  (`public/images/og-image.png`).

« Partage », « favoris » et « recherche instantanée » n'existaient pas avant le lot : pas de capture « avant » propre.

**Écart relevé sur les captures du run 491, corrigé avant la fusion** : le bouton du haut de la fiche devait écrire
« Retour aux événements » dès 400 px et « Retour » en dessous ; le palier arbitraire `min-[400px]` n'était pas produit
(Tailwind ne produit pas les paliers `min-[…]` quand la configuration déclare un palier brut, ici `paysage`), et c'est
« Retour » qui s'affichait partout. Correctif : palier `xs` (400 px) déclaré dans `tailwind.config.ts`, classes
`xs:hidden` et `hidden xs:inline` (vérifié dans la feuille produite par Tailwind ; la classe `container`, qui reçoit aussi
ce palier, n'est utilisée nulle part).

## 12. Essais pour un non-développeur

Sur un téléphone, après la fusion, la migration et le script des affiches :

1. **Accueil** : les cartes sont verticales, l'affiche se voit en entier, le bas de chaque carte a la couleur de son
   affiche et le prix est dans une pastille orange. En connexion lente, la carte montre d'abord sa couleur, puis l'affiche
   apparaît doucement (jamais un rectangle blanc).
2. **Organisatrice** : déposez une nouvelle affiche très colorée, publiez : la carte prend une teinte foncée de cette
   couleur, et le texte blanc reste bien lisible. Une affiche toute blanche donne une carte gris foncé.
3. **Fiche** : le haut montre l'affiche floutée en fond et l'affiche entière devant ; le contenu monte par-dessus avec des
   coins arrondis ; la barre « Choisir mes billets » reste en bas.
4. **Compte à rebours** : un événement dans 3 jours affiche « Commence dans 3 j » ; le jour même, la fiche compte les
   secondes ; à l'heure du début, « En cours ».
5. **Partage** : touchez « Partager » sur la fiche, envoyez le lien dans WhatsApp : l'aperçu montre l'affiche, le titre,
   la date, le prix et le logo. Pour un événement suspendu ou annulé, aucun aperçu propre à l'événement.
6. **Achat rapide** : faites un premier achat avec Orange Money et votre numéro. Au second achat, Orange Money et le numéro
   sont déjà choisis (on peut les changer) ; il faut toujours toucher « Payer » et valider sur le téléphone. Déconnectez-
   vous puis reconnectez-vous : plus rien n'est proposé.
7. **Agenda** : dans Mes billets, touchez « Ajouter à mon agenda » : le téléphone propose d'ajouter l'événement à
   l'heure de Dakar. « Google Agenda » ouvre la page de Google déjà remplie.
8. **Favoris** : touchez le cœur d'une carte (il se remplit, le téléphone vibre légèrement) ; ouvrez Profil → « Mes
   favoris ». Avec un autre compte, la liste est vide. Sans compte, le cœur mène à la connexion.
9. **Recherche** : touchez le champ de recherche de l'accueil, tapez « sab » : les résultats arrivent pendant la saisie.
   Refermez, rouvrez : vos recherches récentes sont là, « Effacer » les retire.
10. **Explorer** : choisissez « Concerts » et faites défiler : les pastilles restent en haut, un trait orange glisse sous
    la pastille choisie. Ouvrez une carte en bas de liste, revenez en arrière : vous êtes au même endroit.
11. **Mes billets** : en haut de la page, tirez vers le bas puis relâchez : « Mise à jour… », puis les billets à jour.
12. **Réduire les animations** (réglage du téléphone) : plus de fondu, de rebond ni de glissement ; tout reste utilisable.

## 13. Fusion et mise en service (20/11)

1. **Fusion** : `main` (`15a51f663`, mini-lot connexion) fusionné dans la branche (`47850a3d3`, aucun conflit), run 512
   vert à la 2ᵉ tentative (la 1ʳᵉ, sur une machine ×7, était inexploitable), puis branche fusionnée dans `main` sans
   avance rapide : **`d0bbe8caa`**, poussé alors qu'aucun run ne tournait sur `main`.
2. **Run complet de main 515** : rouge sur Mes billets seul (89 ; section 9). **Décision de l'utilisateur** : 89 accepté
   pour ce lot, noté ici ; le lot « vitesse » s'en charge. Aucun autre point rouge.
3. **Dry-run** (`supabase db push --linked --dry-run`, CLI 2.122.0, depuis `d0bbe8caa`) : **`20261127000001_d1d_vitrine.sql`
   seule**, la 10b ayant appliqué ses `20261126000001` à `007` avant.
4. **Contrôle « avant »** (lecture seule) : dernière migration `20261126000007`, aucune version `20261127*`,
   `event_favorites` et `poster_styles` absentes, 0 colonne de style, aucune fonction du lot, 0 trigger, 2 événements à
   affiche du compartiment.
5. **`supabase db push --linked`** : `20261127000001_d1d_vitrine.sql` appliquée sans erreur.
6. **Contrôle « après »** (lecture seule), tout conforme :
   - dernière migration `20261127000001` ;
   - `event_favorites` et `poster_styles` : RLS vraie, 0 politique ;
   - droits de table : tout faux, sauf la lecture de `poster_styles` par le service_role ;
   - 6 fonctions, chacune non exécutable par anon ni authenticated, exécutable par le service_role, SECURITY DEFINER,
     `search_path` fixé ;
   - trigger `trg_events_poster_style` présent (1) ; contraintes `events_poster_color_check` et `events_poster_blur_check` ;
   - contraste calculé : 15,97 (bleu nuit `#14213d`), 1,00 (blanc) ;
   - 0 événement coloré sur 2 à affiche du compartiment (normal avant le script), 0 favori, 0 style enregistré.
7. **`03-verification.sql`** : **20/20 OK**.
8. **Non fait, par consigne** : le script des affiches existantes (`npx tsx scripts/poster-styles.ts`, à blanc puis
   `--appliquer` ; section 7, étapes 6 et 7) reste à lancer par l'utilisateur.
9. 6,6 Mo d'images dans l'historique (captures, polices de l'aperçu) : gardés, aucune poussée forcée.
