# Finition 1 — Page Équipe

Branche `finition-1/equipe`, partie de `main` à `6d5020b5`, dans son propre dossier (`event-village-finition1`). Rien n'est fusionné. Le dossier de recette n'a pas été touché.

## À lire en premier

**Correctifs de la contre-vérification, en premier (§ 0).** La contre-vérification (`docs/audit-finition-1.md`) a trouvé 5 trous, aucun critique. Tous sont fermés, le plus grave d'abord, chacun avec un test rouge puis vert :
- **T1.** Le numéro d'un compte ADMIN ou SUPERADMIN ne s'invite plus, sans révéler de nom masqué, et un tel compte ne devient plus contrôleur. Depuis la migration 13, demandée après la première livraison, la base elle-même refuse toute nouvelle affectation d'un tel compte, quel que soit le chemin (§ 0.2). Depuis la migration 14, un contrôleur qui devient administrateur quitte les équipes de contrôle, dans la même transaction (§ 0.3).
- **T2.** Une propriétaire dont la fiche n'est pas VALIDE n'ouvre plus de caisse sur ses événements.
- **T3.** « Mes soirées » ne retient plus un scan refusé.
- **T4.** Hors de la plage du contrôle, le scanner ne rend plus que le verdict : ni nom du porteur, ni numéro, ni catégorie.
- **T5.** Le motif d'un admin fait de 5 à 500 caractères partout.

Les remarques R1 à R4 sont corrigées aussi. Les 9 suites `tests/audit/cvf1-*` sont vertes, avec `tests/audit/` et `tests/audit-auth/`. Tu demandais s'il existe déjà des comptes d'administration avec le rôle CONTROLEUR : la réponse, la requête et ma proposition sont au § 0.1.

1. **Sécurité, corrigée en premier (S1).** La règle de lecture `ec_select_by_creator` de la table des contrôleurs d'événement laissait la personne qui avait ajouté un contrôleur relire la ligne par l'API REST de Supabase, sans regarder ni l'état de son compte ni la propriété actuelle de l'événement. Deux cas le prouvaient :
   - un admin à qui on avait retiré le rôle relisait encore les contrôleurs qu'il avait ajoutés ;
   - une partenaire suspendue relisait encore les siens tant que son jeton restait valable (jusqu'à 1 h).

   La règle est remplacée : la propriétaire lit les contrôleurs de ses événements si sa fiche le permet, et un contrôleur lit sa propre ligne si son compte n'est pas suspendu. Le test était rouge au run 189 et il est vert depuis. Migration `20261115000001`. Détail au § 1.1.
2. **Deux autres écarts de sécurité, fermés en chemin :**
   - la recherche d'invités du scanner restait ouverte en dehors de la plage du contrôle (§ 1.2) ;
   - une propriétaire dont le compte était actif mais la fiche suspendue pouvait encore scanner ses propres événements (§ 1.3). Ses contrôleurs, eux, scannent toujours : c'est la règle A9 du lot 9 quinquies, gardée.
3. **Ce que voit la partenaire.** Une seule page Équipe, identique dans `/partner/team` et dans l'onglet Équipe d'un événement :
   - cartes sur téléphone, tableau sur ordinateur ;
   - « Appeler » et « WhatsApp » ;
   - un état écrit et daté pour chaque personne ;
   - sur chaque événement, la porte (avec les couleurs qu'elle laisse entrer) et les espèces ;
   - une fenêtre « Modifier » à un seul bouton « Enregistrer » ;
   - les invitations visibles 30 jours, avec « Renvoyer », « Annuler » et « Effacer » ;
   - « Retirer de l'équipe » coupe le scanner tout de suite, côté serveur.

   Elle est prévenue quand une invitation est acceptée, refusée ou laissée sans réponse : cloche, push et email, jamais de SMS. Elle-même apparaît en tête de la liste, « Vous (organisatrice) — toutes les portes ». Elle scanne et vend au guichet sur ses propres événements sans s'inviter.
4. **Fin d'un événement : règle existante gardée.** Le contrôle ouvre 6 h avant le début et ferme 6 h après la fin retenue (la fin saisie, sinon début + 6 h). Un événement annulé ou suspendu ferme tout de suite. C'est exactement la règle demandée ; seuls les messages et un trou (la recherche d'invités) ont changé (§ 3.1). Le compte du contrôleur reste actif et son rôle n'est jamais retiré à la fin d'un événement. Le menu « Scanner » n'apparaît que si un contrôle est ouvert ou ouvre dans les 24 h, et il se met à jour sans recharger la page (§ 3.6).
5. **« Mes soirées » (complément 13).** Le contrôleur ouvre depuis son profil, même sans contrôle ouvert, l'historique de ses événements passés : date, événement, organisatrice, sa porte, les entrées qu'il a validées et, s'il a tenu la caisse, le total encaissé et l'état de la clôture. Il ne voit que ses propres chiffres : aucun nom, numéro ni billet de client, rien des autres contrôleurs (testé). L'organisatrice lit les mêmes chiffres, calculés par la même fonction, dans « Événements passés » de sa page Équipe (§ 3.5).
6. **Quatorze migrations `20261115…` à appliquer sur event-village-dev** : cinq pour la finition, neuf pour les correctifs de la contre-vérification. Déployer ensuite l'application de la branche dans la même fenêtre (§ 5). Aucune ne modifie les données existantes, sauf la reprise de deux colonnes neuves sur les invitations.
7. **Runs :**
   - « avant » : 188, sur le code de `main`, vert (391/391, e2e vert) ;
   - preuve des rouges : 189, 196 et 197 (branches de tests seuls) ;
   - « après » : 203, sur `9e2edf23`, vert (398/398, e2e vert, captures comprises) ;
   - correctifs de la contre-vérification : preuve des rouges aux runs 208 et 210, « après » au run 211 (§ 0) ;
   - T1 en base (migration 13) : preuve des rouges au run 213, « après » au run 214 (§ 0.2) ;
   - promotion en administrateur (migration 14) : preuve des rouges au run 216, « après » au run 217 (§ 0.3).

   Entre les deux, la relecture des captures du run 199 a fait corriger trois fautes de texte de l'équipe (§ 7.1). Le run 202 a révélé un défaut d'isolation entre deux suites de SMS, antérieur à la finition, corrigé sans toucher aux assertions (§ 6).

   `tests/audit/` et `tests/audit-auth/` restent verts, les invariants sont à 0 et les budgets JavaScript n'ont pas été relevés (un dépassement de 41 octets au run 193 a été corrigé dans le code, § 6).
8. **Tests existants modifiés : 17 fichiers**, chacun justifié au § 8.2. Les correctifs de la contre-vérification ont aussi recalé trois tests de la finition elle-même ; c'est signalé au même endroit. Aucune assertion de sécurité n'a été affaiblie.
9. **Budget de la page d'accueil tenu sans relèvement.** La relecture du menu ajoute environ 150 octets compressés au code commun à toutes les pages. Pour les compenser, des messages de journal de la console du navigateur ont été raccourcis (AuthProvider, service worker, avatar, interrupteurs), sans changer aucun comportement (§ 3.6). Mesure du run 203 : 226 271 octets pour un budget de 226 342 (`main` : 226 297).

## 0. Correctifs de la contre-vérification

La contre-vérification de la finition (`docs/audit-finition-1.md`, branche `audit/finition-1`, `672f8388`) a trouvé 5 trous (T1 à T5), aucun critique, et 4 remarques (R1 à R4). Elle a été fusionnée dans `finition-1/equipe` (`51bb05da`) sans toucher à ses assertions : ses 9 suites `tests/audit/cvf1-*` servent de tests rouges. Chaque point est corrigé dans son propre commit, dans l'ordre, avec un test rouge avant le correctif. Neuf migrations nouvelles, `20261115000006` à `20261115000014`, sont décrites au § 5. Les deux dernières ont été ajoutées à ta demande après la première livraison : la 13 refuse aussi en base toute affectation d'un compte d'administration (§ 0.2), la 14 retire de ses équipes un contrôleur qui devient administrateur (§ 0.3).

Preuve des rouges :
- runs 205 et 206 de la contre-vérification : `cvf1-2`, `cvf1-3`, `cvf1-4`, `cvf1-6` et `cvf1-7` rouges ;
- run 208, sur `finition-1/rouges-cvf1` (`c3f89e37`, tests seuls, sans les correctifs) : 397/415. Les rouges sont exactement les 5 suites cvf1 ci-dessus, les 8 suites nouvelles `cvf1c-*`, `migration-finition1-rejouable` (migrations 6 à 12 absentes) et 4 suites de la finition (`finition1-controle`, `-equipe`, `-securite`, `-soirees`). Ces 4 suites ne tombent sur aucune de leurs assertions : elles tombent sur l'invariant f2, que R2 viole (« 3 invitations en attente pour le même organisateur et le même compte »), et prouvent donc R2 elles aussi ;
- run 210, sur `3ac9c2d5` : preuve refaite pour `cvf1c-t4-verdict`. Au run 208, ses cas « avant l'ouverture », « après la fermeture » et « annulé » tombaient avant toute vérification : le libellé du contrôleur de test, « avant l’ouverture », entrait dans son adresse email, qui était alors refusée. Libellé réduit à de l'ASCII (§ 8.2). Au run 210, `cvf1c-t4-verdict` tombe sur son assertion : « scan : billet rendu » avant l'ouverture, après la fermeture et pour l'annulé. Les autres rouges sont les mêmes qu'au run 208, plus `cvf1-8` : ses quatre invitations simultanées laissent cette fois 2 invitations en attente et 3 SMS. La course sort au hasard ; c'est encore R2.

Après les neuf correctifs : run 211, sur `0ffe3924`. Vert : 415/415, dont les 9 suites `cvf1-*` et les 26 suites de `tests/audit/` et `tests/audit-auth/`. Invariants à 0 (seules lignes à 1 : les violations fabriquées exprès par l'auto-test `pilotage-invariant`). e2e vert : captures, fumée, terrain et recette. Budgets JavaScript identiques au run 203, aucun relevé.

Après la migration 13 : run 214, sur `f0523410`. Vert : 416/416, dont les 9 suites `cvf1-*`, les 26 suites de `tests/audit/` et `tests/audit-auth/`, et `cvf1c-t1-affectations-base`. Invariants à 0, x5 compris. e2e vert : captures, fumée, terrain et recette. Budgets JavaScript identiques au run 203, aucun relevé.

Après la migration 14 : run 217, sur `6714e822`. Vert : 417/417, dont les 9 suites `cvf1-*`, les 26 suites de `tests/audit/` et `tests/audit-auth/`, `cvf1c-t1-affectations-base` et `cvf1c-t1-promotion`. Invariants à 0, f5 compris. e2e vert : captures, fumée, terrain et recette. Budgets JavaScript identiques au run 203, aucun relevé.

| Point | Constat | Cause | Correctif (commit) | Test rouge puis vert |
|---|---|---|---|---|
| **T1** (gravité moyenne) | Le numéro d'un compte ADMIN ou SUPERADMIN s'invitait :<br>– la route répondait « Ce numéro a déjà un compte Event Village (Nd*** A***) », avec le nom masqué ;<br>– l'invitation et le SMS partaient ;<br>– à l'acceptation, le compte recevait le rôle CONTROLEUR et l'affectation, et l'organisatrice lisait son nom et son numéro dans son équipe. | La route rangeait un compte d'administration parmi les comptes « déjà contrôleurs », puis le chemin du consentement lui envoyait une invitation. Ni `controller_invitation_create` ni `controller_invitation_respond` ne regardaient les rôles d'administration. | `165e7b11`, migration 6.<br>– Nouvelle fonction `account_is_staff` : rôle ADMIN ou SUPERADMIN dans `user_roles` ou dans `users.role`.<br>– Route d'invitation : refus 409 `NOT_INVITABLE`, « Ce numéro ne peut pas être invité comme contrôleur. Choisissez une autre personne. ». Il arrive juste après la lecture des rôles, donc avant le renvoi, avant la confirmation « ce numéro a déjà un compte » et avant le quota du numéro : ni nom masqué, ni SMS, ni quota consommé.<br>– `controller_invitation_create` : même refus.<br>– `controller_invitation_respond` : l'acceptation est refusée (403, « Ce compte ne peut pas devenir contrôleur. Refusez cette invitation. ») ; le refus reste possible.<br>– `PATCH assignments` : même refus 409 si un événement serait ajouté à un compte d'administration ; retirer reste possible. | `cvf1-6` : rouge aux runs 205, 206 et 208, vert au run 211.<br>`cvf1c-t1-admin` (nouveau) : rouge au run 208, vert au run 211. Il couvre la route sans nom ni confirmation, la fonction, l'acceptation par une invitation déjà en attente (route et fonction ; refuser reste possible) et `PATCH assignments`. |
| **T2** (faible à moyenne) | Une propriétaire dont la fiche n'était pas VALIDE ouvrait une caisse sur son événement dans 4 cas sur 6 : fiche SUSPENDU avec ou sans le rôle CONTROLEUR, fiche EN_ATTENTE ou REJETE avec le rôle. Aucune vente ni entrée ne suivait. | `shift_can_handle_cash` admettait la propriétaire sans regarder sa fiche. Les routes `/api/controller/*` n'appliquaient pas la garde de la fiche à un compte qui a aussi le rôle CONTROLEUR, et laissaient passer une fiche SUSPENDU. | `9471addb`, migration 7.<br>– `shift_can_handle_cash` n'admet la propriétaire qu'avec `p.status = 'VALIDE'`, comme `counter_sale` et `scan_scanner_authorized`.<br>– Nouvelle garde `ownEventFicheRefusal` (`lib/auth/partner-fiche-guard.ts`). Un compte partenaire, avec ou sans le rôle CONTROLEUR, n'agit sur **ses propres** événements qu'avec une fiche VALIDE ; sinon 403 `PARTNER_NOT_VALIDATED`. Elle s'applique à l'ouverture de caisse, au guichet (lecture et vente), au devis, au scan, à la vérification manuelle, aux invités et au choix de porte.<br>– Ses affectations chez une autre organisatrice ne sont pas visées : elle y scanne toujours (testé). | `cvf1-4` : rouge aux runs 205, 206 et 208, vert au run 211.<br>`cvf1c-t2-caisse` (nouveau) : rouge au run 208, vert au run 211. Il couvre la fonction pour les 4 états de fiche, les 7 routes, le témoin chez l'autre organisatrice et la fiche SUSPENDU sans le rôle. |
| **T3** (faible) | Après un scan refusé sur l'événement d'une autre organisatrice, cet événement apparaissait dans « Mes soirées », pour un contrôleur comme pour un simple client. | `controller_evenings` reprenait toutes les lignes de scan du compte, y compris la ligne `forbidden` que `ticket_scan` écrit quand il refuse le scanneur. | `62754a75`, migration 8 : `controller_evenings` ne retient que les scans **acceptés** du compte (`sc.accepted`), plus ses affectations et ses caisses. Cela vaut pour la liste des événements comme pour la porte lue à défaut d'affectation. Les chiffres sont inchangés : ils ne comptaient déjà que les entrées acceptées. | `cvf1-2` : rouge aux runs 205, 206 et 208, vert au run 211. |
| **T4** (faible) | Hors de la plage du contrôle (avant l'ouverture, après la fermeture, événement annulé ou suspendu), la vérification manuelle rendait le nom du porteur, le numéro, la catégorie et l'état du billet. Le verdict de refus du scan rendait aussi le billet, nom du porteur compris. | `ticket_manual_lookup` lisait le billet avant de regarder la plage. Les réponses « contrôle fermé » de `ticket_scan` (étapes 5 et 6, et le renvoi d'une lecture) portaient l'objet `ticket`. | `dd89e9fa`, migration 9.<br>– `ticket_manual_lookup` : après le droit et la porte, hors de la plage, refus 409 `CONTROL_CLOSED` sans lire le billet. La route affiche le message commun du contrôle fermé (complément 10) et la vérification est journalisée.<br>– `ticket_scan` : le verdict « contrôle fermé » ne porte plus `ticket`. Un renvoi ne rend le billet que si le contrôle est ouvert et que la lecture d'origine n'était pas un refus « contrôle fermé ».<br>– Un scanneur non autorisé reçoit toujours 403 sans rien du billet ; c'est vérifié. | `cvf1-3` : rouge aux runs 205, 206 et 208, vert au run 211.<br>`cvf1c-t4-verdict` (nouveau) : rouge au run 210 (voir plus haut), vert au run 211. Il couvre l'avant, l'après et l'annulé (scan, renvoi, vérification) et le scanneur non autorisé. |
| **T5** (faible) | « Renvoyer », « Annuler » et « Effacer » acceptaient un motif d'admin de 5 000 caractères et l'inscrivaient au journal ; le renvoi envoyait même le SMS. | `invitation-actions.ts` passait le motif à la fonction sans limite, et `controller_invitation_actor_check` ne vérifiait que le minimum de 5 caractères. | `471e746a`, migration 10.<br>– `adminReasonRefusal` (`team-access.ts`) refuse aussi plus de 500 caractères : 400 `REASON_TOO_LONG`, « Le motif est trop long : 500 caractères au plus. Raccourcissez-le. ».<br>– Elle s'applique désormais dans `invitation-actions.ts`, avant tout effet.<br>– `controller_invitation_actor_check` applique la même borne. | `cvf1-7` : rouge aux runs 205, 206 et 208, vert au run 211.<br>`cvf1c-t5-motif` (nouveau) : rouge au run 208, vert au run 211. Il vérifie 501 caractères refusés sans effet, 500 acceptés, et la fonction directement. |
| **R1** | Une porte supprimée pendant l'enregistrement faisait répondre une erreur 500 générique, sans dégât. | La porte était lue, puis supprimée par une autre transaction avant l'écriture ; la clé étrangère refusait alors l'écriture. | `83f9cce6`, migration 11 : `event_controller_settings_set` et `event_controller_gate_set` verrouillent la porte en partage de clé (`FOR KEY SHARE`) avant de la lire. Une suppression concurrente fait attendre l'enregistrement, qui refuse ensuite 409 `GATE_GONE`, « Cette porte n’existe plus. Choisissez-en une autre. ». Une porte d'un autre événement garde son refus `GATE_INVALID`. | `cvf1c-r1-porte-supprimee` (nouveau) : rouge au run 208 (HTTP 500), vert au run 211. Il couvre la suppression concurrente avec l'attente du verrou observée, la porte supprimée avant, et la porte d'un autre événement. `cvf1-8` restait vert, puisqu'il n'y avait pas de dégât. |
| **R2** | Quatre invitations simultanées du même numéro créaient trois invitations et envoyaient trois SMS, dont deux vers des liens aussitôt morts. | `controller_invitation_create` ne prenait aucun verrou. | `4c5462d1`, migration 12 : `controller_invitation_create` (version T1) prend un verrou transactionnel par organisatrice et par compte. Une invitation identique (mêmes événements, mêmes droits), encore en attente et créée il y a moins de 60 s, n'est pas recréée : refus 409 `INVITATION_ALREADY_SENT`, « Une invitation vient d’être envoyée à ce numéro. Attendez sa réponse ou utilisez « Renvoyer ». ». « Inviter de nouveau » avec d'autres événements remplace toujours la précédente. | `cvf1c-r2-invitations-simultanees` (nouveau) : rouge au run 208, avec 3 invitations en attente (invariant f2 violé dans 4 autres suites), vert au run 211. Il vérifie 1 seul 201, 1 invitation, 1 SMS, et le remplacement avec d'autres événements. Son attente a été élargie avant son premier vert (§ 8.2). |
| **R3** | Pour un motif d'admin trop long, les refus étaient justes mais leurs messages faux : « Point d’entrée invalide (80 caractères au plus). », « canAcceptCash doit valoir vrai ou faux. » ou « Too big: expected string… ». | Les schémas des routes bornaient eux-mêmes `reason` à 500 caractères, et leurs messages d'erreur génériques passaient avant `adminReasonRefusal`. | `8aa9e443` : plus de borne propre sur `reason` dans les schémas d'inviter, des réglages, du point d'entrée, du droit d'encaisser, des événements du contrôleur et de la porte. C'est `adminReasonRefusal` qui juge, avec son texte. La route des réglages appelle désormais elle aussi `adminReasonRefusal` et ne transmet le motif que pour un admin. | `cvf1c-r3-textes-motif` (nouveau) : rouge au run 208, vert au run 211. Pour 8 écritures, il vérifie que 501 caractères donnent le texte « trop long », que « abc » donne le texte « 5 caractères au moins », et que rien ne change. |
| **R4** | `PATCH /api/partner/team/assignments` envoyé par A avec le contrôleur de B et une liste vide répondait 200 « Événements du contrôleur enregistrés. », sans aucun effet. | Une liste vide ne passait par aucun contrôle de lien entre l'organisatrice et le contrôleur. | `87053069` : sans événement à ajouter, si le contrôleur n'a ni lien avec l'organisatrice ni affectation sur ses événements, la route répond 404 « Contrôleur introuvable. », exactement comme pour un identifiant inconnu. Avec des événements à ajouter, le chemin du consentement est inchangé. | `cvf1c-r4-affectations-autre` (nouveau) : rouge au run 208, vert au run 211. Il vérifie 404, un corps identique à celui d'un identifiant tiré au hasard, et l'affectation de B inchangée. |

### 0.1 Comptes d'administration qui ont déjà le rôle CONTROLEUR (T1)

**Je ne peux pas dire s'il en existe sur event-village-dev :** je n'y ai aucun accès en lecture, et le jeu de test n'en contient pas. La requête suivante, à lancer dans l'éditeur SQL, est en lecture seule ; elle est aussi au § 5.1, contrôle G :

```sql
select u.id, array_agg(ur.role::text order by ur.role::text) as roles,
       (select count(*) from public.event_controllers ec where ec.user_id = u.id) as affectations,
       (select count(*) from public.controller_invitations ci
         where ci.user_id = u.id and ci.status = 'PENDING' and ci.expires_at > now()) as invitations_en_attente
  from public.users u join public.user_roles ur on ur.user_id = u.id
 group by u.id
having bool_or(ur.role::text in ('ADMIN', 'SUPERADMIN')) and bool_or(ur.role::text = 'CONTROLEUR');
```

Ce que je propose, sans migration automatique des données (retirer un rôle ou une affectation se décide compte par compte) :
- **0 ligne :** rien à faire. Les correctifs empêchent le cas de se reproduire.
- **Des lignes :** pour chaque compte, l'organisatrice concernée, ou un admin depuis `/partner/team?partnerId=…`, choisit « Retirer de l'équipe ». Cela retire les affectations, le rôle CONTROLEUR s'il ne travaille pour personne d'autre, et ferme son scanner. Une invitation encore en attente est annulée par « Annuler l’invitation ». De toute façon, il ne peut plus l'accepter : `controller_invitation_respond` refuse désormais.
- Si tu préfères que je le fasse par une requête de support, dis-le-moi avec les identifiants. Je l'écrirai dans une transaction, avec le journal d'audit.

Les affectations déjà en place ne sont pas retirées par les correctifs. Un compte d'administration déjà contrôleur garde son scanner jusqu'à ce retrait ; on ne peut simplement plus lui ajouter d'événement.

### 0.2 T1 en base : aucune affectation pour un compte d'administration, quel que soit le chemin (migration 13)

Demandé après la première livraison : refuser aussi en base l'ajout d'un événement à un compte ADMIN ou SUPERADMIN, dans `controller_assignments_sync` et dans toute autre fonction qui crée une affectation de contrôleur.

**Inventaire.** J'ai relevé toutes les écritures `INSERT INTO event_controllers` des migrations, soit 6 occurrences, qui appartiennent toutes à deux fonctions. J'ai aussi relevé toutes les écritures de cette table dans le code serveur, les scripts et les jeux d'essai.

| Chemin qui crée une affectation | Version en place | Quand | Compte d'administration |
|---|---|---|---|
| Fonction `controller_assignments_sync` | migration 13 (avant : `20261111000001`, `20261110000006`, `20261109000008`) | La partenaire, ou un admin, enregistre les événements d'un contrôleur (`PATCH /api/partner/team/assignments`). | **Refusé depuis la migration 13** : `NOT_INVITABLE`, texte neutre. Retirer ses événements et changer son droit d'encaisser restent possibles. |
| Fonction `controller_invitation_respond` | migration 6 (avant : `20261115000002`, `20261109000008`) | Le titulaire accepte une invitation. | Refusé depuis la migration 6 (`NOT_INVITABLE`) ; fonction inchangée. |
| Écriture directe du serveur : `POST /api/partner/team/invite`, étape 3 | — | Compte neuf créé par l'invitation, compte encore à activer, ou contrôleur déjà connu de l'organisatrice. | Refusé par la route dès la lecture des rôles (T1) et, depuis la migration 13, par la garde de la table. |
| Jeux d'essai : `tests/seed/seed-test.ts`, `tests/seed/seed-demo.ts`, `scripts/dev/seed-dev.core.ts`, `scripts/e2e/terrain-setup.ts` | — | Comptes contrôleurs dédiés, jamais d'administration. | Garde de la table. |

Aucune autre fonction et aucun déclencheur n'écrit dans `event_controllers`, et aucun code ne change le titulaire d'une ligne. Les autres écritures de la table (droit d'encaisser, porte, point d'entrée, retrait) ne créent pas d'affectation et restent possibles.

Correction de ma livraison précédente : j'écrivais que la route d'invitation appelait `controller_assignments_sync`. C'est faux : elle écrit directement dans la table. C'est ce chemin, qui n'est pas une fonction, qui demandait une garde sur la table elle-même.

**Correctif** (`f0523410`, migration `20261115000013`) :
- `controller_assignments_sync` refuse dès qu'au moins un événement serait ajouté à un compte d'administration : `NOT_INVITABLE`, « Ce numéro ne peut pas être invité comme contrôleur. Choisissez une autre personne. ». Rien n'est écrit, pas même au journal.
- **Garde de la table.** Le déclencheur `trg_event_controllers_staff_guard` s'exécute avant chaque insertion et avant tout changement de titulaire d'une ligne. Il refuse un compte d'administration avec le même texte, sous le code `CT409`. Il couvre l'écriture directe de la route d'invitation, les jeux d'essai et toute fonction future. Les lignes existantes ne sont pas touchées.
- **Routes.** La garde peut refuser alors que la route a déjà fait ses propres vérifications : c'est le cas d'un compte devenu admin pendant la demande. L'invitation et l'enregistrement des événements répondent alors le refus neutre 409 `NOT_INVITABLE`, et l'acceptation le refus 403 de la migration 6, au lieu d'une erreur 500. Ces trois routes reconnaissent ce refus par une aide commune, `isNotInvitableDbError` (`lib/auth/staff-account.ts`).

**Test** `cvf1c-t1-affectations-base` (nouveau), rouge au run 213 (`finition-1/rouges-cvf1-13`, tests seuls, sans la migration 13) et vert au run 214 :
- a. la fonction, pour un contrôleur de l'organisatrice devenu ADMIN puis SUPERADMIN : aucun événement ajouté, texte neutre ; le droit d'encaisser et le retrait restent possibles ;
- b. l'insertion directe par le service_role est refusée pour ADMIN et SUPERADMIN, une ligne passée à un compte d'administration aussi ; un contrôleur ordinaire est toujours affecté ;
- c, d, e. compte devenu admin pendant une invitation, un enregistrement des événements ou une acceptation. La table est verrouillée, et le rôle est validé pendant que l'écriture attend. Réponses 409, 409 et 403 neutres, aucune affectation ; l'invitation reste en attente et peut encore être refusée.

Au run 213, celui des rouges, 357 suites sur 416 passent. `cvf1c-t1-affectations-base` est rouge sur chacun de ses cas, sauf le témoin du retrait :
- la fonction ajoute l'événement (`ok: true`) ;
- les insertions directes et le changement de titulaire passent ;
- les trois courses créent l'affectation (201, 200, 200), et l'attente du verrou est observée chaque fois.

Les 58 autres suites rouges ne tombent sur aucune de leurs assertions. Toutes tombent sur l'invariant x5 du lot 9 ter : « affectation … sans lien partner_controllers ». En cause, la ligne que le cas b a fait passer au compte d'administration : c'est le trou lui-même, comme l'invariant f2 au run 208 pour R2. Avec la migration 13, ce changement est refusé et la ligne ne bouge pas.

### 0.3 Un contrôleur qui devient administrateur quitte les équipes de contrôle (migration 14)

Ta décision : quand un compte qui a des affectations de contrôleur reçoit le rôle ADMIN ou SUPERADMIN (page des comptes, création, toute fonction qui donne ce rôle), une caisse ouverte refuse la promotion ; sinon une confirmation vient d'abord, puis tout est retiré dans la même transaction, les organisatrices sont prévenues et le passé reste intact ; un garde-fou en base est éprouvé par un invariant et un test, promotion et invitation simultanées comprises.

**Voies qui donnent le rôle, toutes relevées :**

| Voie | Écriture du rôle | Désormais |
|---|---|---|
| Page des comptes : `PATCH /api/admin/users` sur un compte existant | fonction `user_roles_set` | Refus si caisse ouverte, confirmation, puis retrait complet. |
| Création d'un compte : `POST /api/admin/users` | `user_roles_set` sur un compte neuf (un numéro déjà inscrit est refusé) | Un compte neuf n'a aucune affectation : rien à retirer. |
| Amorçage du premier superadmin : `scripts/bootstrap-superadmin.ts` | `user_roles` écrit par le serveur (`grantUserRoles`) | Déclencheur : même retrait, même refus si caisse ouverte. |
| Toute autre écriture du rôle (requête de support, fonction future) | `user_roles`, ou la colonne héritée `users.role` | Déclencheurs sur les deux : même retrait. |

**À savoir sur l'écran.** La page des comptes ne change pas aujourd'hui le rôle d'un compte existant : elle crée des comptes, suspend, règle les droits des administrateurs. Promouvoir un contrôleur passe donc par l'API de cette page, qu'aucune fenêtre n'appelle pour cela. La confirmation est portée par l'API : sans `confirm_staff_promotion: true`, elle répond `requires_confirmation` avec le texte ci-dessous, et rien ne change. Je n'ai pas ajouté de bouton « Changer le rôle », qui n'était pas demandé ; s'il vient, sa fenêtre affichera ce texte tel quel.

**Correctif** (`6714e822`, migration `20261115000014`) :
- **Caisse ouverte** : promotion refusée, rien ne change. Texte : « Cette personne a une caisse ouverte sur « {événement} ». Elle doit la fermer avec l’organisatrice avant de devenir administrateur. » Le code reste `CONTROLLER_HAS_OPEN_SHIFT`, comme avant ce correctif.
- **Confirmation** : « Cette personne contrôle les entrées pour 2 organisateurs. En devenant administrateur, elle sera retirée de leurs équipes. » ; au singulier, « … pour 1 organisateur. En devenant administrateur, elle sera retirée de son équipe. ». J'ai accordé ton texte au singulier ; dis-moi si tu préfères « organisateur(s) » tel quel.
- **Dans la transaction de la promotion** (fonction `controller_staff_promotion_apply`, lancée par l'écriture du rôle) :
  - toutes ses affectations sont retirées, sans avis de retrait ni SMS au compte promu ; ses rappels de la veille sont annulés ;
  - son rôle CONTROLEUR est retiré ; ses invitations en attente sont annulées, au nom de l'administrateur qui promeut ;
  - ses sessions sont révoquées : le scanner resté ouvert est refusé (401) ;
  - le journal reçoit `CONTROLLER_REMOVED_FOR_ADMIN`, avec ses événements, ses organisatrices et le nombre d'invitations annulées ;
  - chaque organisatrice dont il quitte l'équipe reçoit l'avis `CONTROLLER_BECAME_ADMIN`, par la cloche, le push et l'email, jamais par SMS : « {nom} ne fait plus partie de votre équipe : son compte est devenu un compte d'administration Event Village. Invitez une autre personne pour vos entrées. ». Une organisatrice qui n'avait qu'une invitation en attente voit cette invitation annulée, sans cet avis.
- **Passé intact** : rien n'est supprimé dans ses scans ni dans ses caisses. « Mes soirées » garde ses soirées passées, grâce à ses scans et à ses caisses (testé). Chez l'organisatrice, il disparaît de la page Équipe, puisqu'il n'en fait plus partie ; ses entrées et sa caisse restent enregistrées.
- **Garde-fou** : la promotion verrouille le compte. L'affectation (garde de la table), l'invitation (`controller_invitation_create`) et l'acceptation (`controller_invitation_respond`) le lisent sous verrou. Si la promotion commence la première, la demande attend puis refuse ; si une affectation est déjà en cours, la promotion l'attend puis la retire. Partout, le compte est verrouillé avant l'invitation : aucun interblocage. L'invariant f5 (aucun compte d'administration affecté) est vérifié à la fin de chaque suite de la finition.
- `user_roles_set` retire CONTROLEUR quand ADMIN ou SUPERADMIN est demandé : un compte d'administration n'est jamais contrôleur.

**Test** `cvf1c-t1-promotion` (nouveau), rouge au run 216 (`finition-1/rouges-cvf1-14`, tests seuls) et vert au run 217 :
- a. caisse ouverte : refus sur la route, par `user_roles_set` et par une écriture directe du rôle ; rien ne change ;
- b. confirmation au pluriel et au singulier ; rien ne change ;
- c. promotion confirmée. Vérifiés : affectations, rôle, invitation annulée, scanner refusé, journal ; avis à deux organisatrices, sans SMS, et aucun à celle qui n'avait qu'une invitation ; aucun avis de retrait ni SMS au compte promu ; « Mes soirées », chiffres de la soirée passée, scans et caisses identiques ;
- d. rôle SUPERADMIN écrit directement, comme à l'amorçage : même retrait, avis et journal ;
- e. quatre courses. Pendant la promotion : une acceptation, une affectation directe, une nouvelle invitation. Et une affectation déjà en cours quand la promotion commence. Aucun compte d'administration ne reste affecté.

Au run 216, celui des rouges, 405 suites sur 417 passent. Les rouges se rangent ainsi :
- `cvf1c-t1-promotion` est rouge sur tous ses cas. La route refuse avec l'ancien texte générique et promeut sans confirmation ; la promotion ne retire rien. Pendant les courses, l'affectation et l'invitation sont créées (201) et les affectations restent. L'attente de la promotion est observée à chaque course.
- `cvf1c-t1-affectations-base` est rouge sur ses cas adaptés : l'affectation d'avant reste.
- `notif-modeles` et `notif-outbox` sont rouges, faute du type d'avis ; `migration-finition1-rejouable` aussi, faute du fichier.
- Les 6 autres suites de la finition ne tombent sur aucune de leurs assertions. Toutes tombent sur l'invariant f5 : des comptes d'administration gardent une affectation, ce qui est le trou lui-même.

### 0.4 Ce qui reste

- La page des comptes n'a pas de bouton « Changer le rôle » d'un compte existant (§ 0.3) ; la confirmation est prête côté API.
- Si quelqu'un accepte une invitation pendant sa propre promotion, il reçoit « L’organisateur a annulé cette invitation. » : c'est la promotion qui l'a annulée. Ses sessions sont révoquées dans la même transaction, il doit de toute façon se reconnecter. Un texte propre à ce cas est possible si tu le veux.
- La fenêtre de 60 s de R2 ne vaut que pour une invitation **identique**. Renvoyer un SMS passe par « Renvoyer », qui garde son plafond.

## 1. Sécurité

### 1.1 S1 — lecture des contrôleurs d'un événement par la REST

- **Constat** (`tests/parcours/finition1-securite.test.ts`, S1 a et b) : la politique `ec_select_by_creator` (créée en `20260904000002`, jamais reprise depuis) donnait la lecture d'une ligne de `event_controllers` à `created_by = auth.uid()`, sans statut du compte ni propriété actuelle. Un admin rétrogradé (rôle retiré) lisait encore les affectations qu'il avait créées, et une partenaire suspendue aussi, avec son jeton encore valable. C'est la même famille qu'AUD-06, que le lot 9 quater avait fermé pour les aides RLS.
- **Correctif** (migration `20261115000001`) :
  - `ec_select_by_creator` est supprimée ;
  - `ec_select_owner` donne la lecture si `is_partner_owner(partner_id de l'événement)`, c'est-à-dire fiche VALIDE ou SUSPENDU et compte actif (règle du lot 9 quinquies) ;
  - `ec_select_by_controller` garde sa propre ligne, avec la garde « compte non suspendu ».
- **Vérifié :** aucune lecture de l'application ne passe par une session utilisateur (toutes les routes lisent par le service_role) et la table n'est pas publiée en temps réel. L'invariant (f4) refuse désormais toute politique de lecture fondée sur `created_by`.
- **Preuve :** rouge au run 189 (branche `finition-1/rouges`, tests seuls). Les attaques passent depuis le correctif (run 192 : 4 sur 4) ; la suite est entièrement verte depuis le run 193 (au 192, elle tombait seulement sur l'invariant (x8) laissé par une autre suite, § 6).

### 1.2 Recherche d'invités ouverte en dehors de la plage du contrôle

`ticket_guest_list_search` ne passait pas par `scan_event_problem`, alors que toutes les autres fonctions du contrôle le font : scan, saisie manuelle, encaissement d'un billet en espèces, guichet, ouverture de caisse, état du contrôle. Après la fin de la plage, un contrôleur pouvait donc encore chercher des invités par leur nom. La fonction est recopiée avec la même garde (migration `20261115000003`), et la route répond 409 avec le message commun (§ 4.5). Test : `finition1-controle`, « après la fermeture : … recherche d'invités refusée ».

### 1.3 Propriétaire dont la fiche est suspendue (complément 12)

Le complément 12 exige une fiche VALIDE pour la partenaire qui scanne. Jusqu'ici, `scan_scanner_authorized` laissait la propriétaire scanner avec une fiche SUSPENDU, en appliquant la règle A9, écrite pour les affectations de contrôleurs.

Dans le parcours normal, cela ne se voyait pas : suspendre la fiche (`partner_status_set`) suspend aussi le compte, et le scan exige un compte ACTIF. L'écart n'apparaissait que si le compte redevenait actif à part.

La fonction est recopiée (migration `20261115000004`) :
- la propriétaire de l'événement scanne avec une fiche VALIDE seulement ;
- un contrôleur affecté garde la règle A9 (fiche VALIDE ou SUSPENDU : les détenteurs de billets entrent toujours) ;
- les admins ne changent pas.

Son guichet exigeait déjà une fiche VALIDE. Test : `finition1-controle`, « fiche VALIDE exigée … ». Preuve rouge : run 196.

### 1.4 Droits des routes nouvelles ou modifiées

Chaque route exige une session active (`requireActiveSession`, avec la garde de la fiche partenaire) puis vérifie le droit et la propriété côté serveur. Aucune écriture ne passe par la REST : tout passe par des fonctions réservées au service_role. Un admin qui écrit dans l'équipe d'un organisateur doit donner un motif (5 à 500 caractères), qui est inscrit au journal.

| Route | Qui | Propriété vérifiée | Refus |
|---|---|---|---|
| `GET /api/partner/team` | partenaire (sa fiche) ; admin `events.read` | `partner_team_view` : événement d'autrui → 404 ; `partnerId` d'autrui ignoré pour une partenaire | admin sans organisateur → 400 « Choisissez l’organisateur dont vous gérez l’équipe. » |
| `POST /api/partner/team/invitations/[id]/resend` | propriétaire de l'invitation ; admin `events.write` + motif | RPC `controller_invitation_resend` (droit et état d'abord, sans effet, puis quotas, puis renvoi) | tiers ou invitation inconnue → 404 sans indice ; quotas par organisateur/heure et par numéro/jour |
| `POST /api/partner/team/invitations/[id]/cancel` | idem | `controller_invitation_cancel` | idem |
| `DELETE /api/partner/team/invitations/[id]` | idem | `controller_invitation_clear` (invitation qui n'attend plus de réponse) | « Cette invitation attend encore une réponse : annulez-la d’abord. » |
| `PATCH /api/partner/team/settings` | propriétaire ; admin `events.write` + motif | `event_controller_settings_set` : la porte doit appartenir à l'événement | porte inconnue ou d'un autre événement refusée ; texte libre refusé sur un événement à portes |
| `GET /api/controller/status` | toute session active | ses propres affectations seulement | — |
| `GET /api/auth/me` (champ `scanner_open`) | le compte lui-même | ses propres affectations | — |
| `GET/POST /api/controller/counter-sale` | contrôleur affecté ; propriétaire, fiche VALIDE | événement de la propriétaire seulement | événement d'une autre partenaire → 403 |
| Écritures d'équipe existantes : retraits, affectations, porte, point d'entrée, espèces | inchangées, avec en plus le motif d'un admin | inchangée | sans motif → 400 « Indiquez le motif de cette action (5 caractères au moins) : il est inscrit au journal. » |

Tests de sécurité (`finition1-securite`) :
- S1 ;
- cloisonnement entre deux partenaires sur chaque route nouvelle ;
- un contrôleur ne voit pas l'équipe ;
- une fiche non validée est refusée ;
- les renvois vers un même numéro sont plafonnés.

Les quatre groupes passent depuis le run 192 ; la suite entière est verte depuis le run 193.

## 2. État de chaque point

| Point | État | Ce qui a été fait | Preuve |
|---|---|---|---|
| E-10 | Fait | « Renvoyer le SMS d’activation » seulement pour un compte à activer ; message « SMS renvoyé à {prénom} : code valable jusqu’au {date}. » ; plus de « Droits mis à jour » pour un renvoi | `finition1-equipe` |
| E-11 | Fait | Invitations en attente visibles sur la page et dans l'onglet ; la ligne apparaît dès l'envoi (relecture après chaque action) | `finition1-equipe`, recette e2e |
| E-13 | Fait | Une lecture serveur, `partner_team_view` via `GET /api/partner/team`, pour la page et l'onglet. Elle sert les membres avec leurs événements, la porte, le point d'entrée, les espèces, la caisse ouverte, les entrées, le dernier scan, l'état et l'activation ; les invitations ; les portes avec leurs catégories ; les alertes ; et les nombres (`counts`), sans aucun comptage dans le navigateur | `finition1-equipe`, `finition1-ecran-equipe` |
| E-14 | Fait, sauf le lien PIN | Un seul composant `TeamPanel` (`components/partner/team/`) aux deux endroits ; porte et espèces par événement ; une fenêtre « Modifier » à un seul « Enregistrer » (`PATCH /api/partner/team/settings`, en une transaction) ; bandeaux ; liens « Caisse ouverte » et « N entrées » vers les onglets. Bandeau et lien PIN : voir `docs/apres-lancement.md` | `finition1-ecran-equipe`, captures |
| E-15 | Fait | « Appeler » (`tel:+221…`) et « WhatsApp » (`wa.me`, message prêt, sans aucun code) | `finition1-ecran-equipe` |
| E-16 | Fait | « Retirer de l'équipe » remplace « Retirer de tous » et « Supprimer ». La fenêtre dit ce qui se passe selon qu'il contrôle ou non pour d'autres organisateurs. Le serveur refuse le scanner dès la confirmation, même sur un téléphone déjà ouvert. Hors ligne : voir § 3.4 | `finition1-equipe` (« retrait qui ferme le scanner ») |
| E-17 | Fait, sauf le choix de l'organisateur dans la page | `can_manage` = propriétaire ou admin `events.write` ; motif exigé et journalisé sur toutes les écritures d'équipe ; un admin `events.read` lit sans bouton. Choix de l'organisateur par une liste : `docs/apres-lancement.md` (aujourd'hui `?partnerId=`) | `finition1-equipe`, `droits-partenaire-9bis`, `lot9quater-droits` |
| E-18 | Fait | Texte unique de « Ce numéro a déjà un compte », sans « affectation » (§ 4.3) | `finition1-equipe`, `cycle9bis-equipe`, `equipe-consentement-9ter` |
| E-19 | Fait | Invitations visibles 30 jours : en attente, sans réponse, refusées, annulées ; « Renvoyer l’invitation » (+72 h, plafonné) ; « Annuler l’invitation » (nouvel état ; le titulaire voit « Aucune invitation en attente ») ; « Inviter de nouveau » ; « Effacer » ; numéro saisi gardé | `finition1-equipe` |
| E-20 | Fait (sans SMS, comme demandé) | Trois avis à la partenaire (acceptée, refusée, sans réponse) par cloche, push et email. Les invitations échues sont closes par `/api/cron/reminders`. La revue proposait un SMS de refus à moins de 48 h : la consigne de la finition dit « pas de SMS », c'est elle qui s'applique. La page relit l'équipe toutes les 60 s (temps réel : `docs/apres-lancement.md`) | `finition1-equipe`, `notif-modeles`, `notif-outbox` |
| E-21 | Fait | États datés : « Lien d’activation envoyé le …, valable jusqu’au … », « Code expiré le … : renvoyez le SMS. », « Actif depuis le … » | `finition1-equipe` |
| Complément 9 | Fait | Chaque porte dit ce qu'elle laisse entrer, avec la pastille de couleur du scanner (« Porte VIP — Laisse entrer : VIP » et pastille or ; « toutes les catégories » sans zone). Porte choisie dans une liste ; le serveur refuse une porte inconnue ou un texte libre sur un événement à portes. Éditeur des zones inchangé dans l'onglet, avec le lien « Modifier les portes et les couleurs ». Avertissements : « catégorie en vente sans porte » et « porte sans contrôleur ». Le scanner applique les mêmes règles (§ 3.3) | `finition1-equipe` |
| Complément 10 | Fait (règle gardée) | § 3.1 | `finition1-controle` |
| Complément 11 | Fait | § 3.2 | `finition1-controle` |
| Complément 12 | Fait | § 3.3 | `finition1-controle` |
| Complément 13 | Fait | § 3.5 | `finition1-soirees` |
| Complément 14 | Fait | § 3.6 | `finition1-soirees` |

## 3. Ce qui existait, ce qui change

### 3.1 Fin d'un événement (complément 10)

**Avant :**
- La plage du contrôle existait déjà dans la base : `scan_window` ouvre 6 h avant le début (`access.scan_window_before_hours`) et ferme 6 h (`access.scan_window_after_hours`) après la fin retenue, c'est-à-dire la fin saisie, sinon début + 6 h (`event_end_at`).
- `scan_event_problem` ferme tout de suite un événement annulé (`event_cancelled`) ou suspendu (`event_suspended`), et n'ouvre qu'un événement publié ou terminé, dans sa plage.
- Ces deux fonctions servaient au scan, à la saisie manuelle, à l'encaissement d'un billet en espèces, au guichet et à son devis, à l'ouverture de caisse, au billet hors ligne et à l'état du contrôle.

**Décision :** c'est la règle demandée (−6 h / +6 h, annulé ou suspendu fermé tout de suite), donc **elle est gardée telle quelle**.

**Ce qui change :**
- le trou de la recherche d'invités est fermé (§ 1.2) ;
- les messages sont les mêmes partout : scanner, état du contrôle, recherche d'invités, caisse (§ 4.5) ;
- un événement passé va dans « Événements passés », sans action, sur la page Équipe et sur la ligne de chaque contrôleur ;
- le compte du contrôleur reste actif.

### 3.2 Le menu « Scanner » suit les événements (complément 11)

**Avant :**
- Le menu « Scanner » (en-tête, barre du bas, accès à `/controller/*`) apparaissait dès que le compte avait le rôle CONTROLEUR, que ses événements soient passés ou lointains.
- Le rôle n'était jamais retiré à la fin d'un événement. Il ne l'était que par « Retirer de l'équipe », quand la personne ne contrôlait plus pour aucun organisateur. Ce retrait voulu est gardé tel quel.
- Il n'existe aucun écran d'historique de caisse côté contrôleur : il ne voit que la caisse ouverte dans le scanner, et l'historique des caisses est dans l'onglet Caisse de l'organisatrice. Ses données restent après l'événement. L'écran « Mes soirées » est fait (complément 13, § 3.5).

**Maintenant :**
- La fonction `controller_scanner_status` dit si le compte a au moins un événement dont le contrôle est ouvert, ou s'ouvre dans les 24 h. `GET /api/auth/me` sert ce résultat dans `profile.scanner_open`, pour un compte contrôleur sans rôle partenaire ni admin.
- Si le résultat est faux, le menu « Scanner » disparaît et la personne voit l'application d'un client normal. Si elle ouvre `/controller/scanner` quand même, elle voit « Aucun contrôle ouvert pour vous », avec la date du prochain contrôle s'il y en a un et un bouton « Mes billets ».
- Si l'état est illisible, le menu reste affiché ; le scanner refuse de lui-même en dehors de la plage.
- Aucun rôle n'est retiré et aucun compte n'est désactivé à la fin d'un événement : c'est testé.
- Partenaires et admins gardent leurs entrées.

Pourquoi le profil plutôt qu'un appel de plus : au run 193, l'appel ajouté dans la mise en page commune faisait dépasser de 41 octets le budget JavaScript de la page d'accueil. Plutôt que de relever le budget, l'information passe par le profil, déjà lu. Le profil n'était relu qu'à l'ouverture de l'application et à chaque renouvellement de session (environ toutes les heures) : le complément 14 le fait relire au bon moment (§ 3.6).

### 3.3 La partenaire scanne ses propres événements (complément 12)

**Avant :**
- `scan_scanner_authorized` laissait déjà la propriétaire scanner ses événements, sans s'inviter, sur `/partner/scan`.
- Sur un événement à zones, il fallait une porte (`scan_gate_context`) : sans affectation, elle ne pouvait pas choisir « toutes les portes ».
- Le guichet exigeait d'être affecté (`counter_sale` → NOT_ASSIGNED).
- La fiche SUSPENDU passait (§ 1.3).

**Maintenant :**
- Option « Toutes les portes » dans le choix de la porte, pour la propriétaire seulement. L'entrée est validée avec les mêmes refus qu'un contrôleur : billet déjà utilisé, catégorie qu'aucune porte d'entrée n'admet, plage fermée, etc. La base inscrit sur l'entrée la première porte d'entrée qui admet la catégorie du billet, ce qui garde l'invariant (x8) du lot 9 ter : aucune entrée acceptée sans porte sur un événement à zones.
- Le scanner d'un contrôleur ne change pas : un contrôleur affecté à une porte a exactement les mêmes règles qu'avant.
- Mode « Guichet » sur `/partner/scan` : elle vend sur ses événements, avec une caisse ouverte (sinon NO_OPEN_SHIFT, comme un contrôleur).
- Jamais sur l'événement d'une autre partenaire : c'est testé, le scan est refusé et le billet n'est pas consommé ; le guichet répond 403.
- Fiche VALIDE exigée (§ 1.3).
- En tête de la page Équipe : « Vous (organisatrice) — toutes les portes », avec « Scanner les billets ».

### 3.4 « Retirer de l'équipe » et les codes lus sans réseau (E-16)

Le scanner ne valide jamais une entrée sans réseau : chaque lecture attend le verdict du serveur. Une lecture partie sans réponse (coupure de réseau) reste sur le téléphone **2 minutes au plus**. Au retour du réseau, elle est renvoyée avec la même clé, et le serveur la vérifie de nouveau, droits compris. Donc :
- après « Retirer de l'équipe » ou « Retirer de cet événement », toute lecture, renvoyée ou nouvelle, est refusée par le serveur, même sur un téléphone resté ouvert ;
- une lecture que le serveur avait déjà acceptée **avant** le retrait garde son verdict : l'entrée a eu lieu, elle reste dans les entrées ;
- au-delà de 2 minutes, une lecture en attente est oubliée et le scanner le dit. Rien n'est validé sur l'appareil seul.

Le billet hors ligne du spectateur (le QR enregistré sur son téléphone) ne change pas : ce n'est pas un droit du contrôleur.

### 3.5 « Mes soirées » du contrôleur (complément 13)

**Avant :** aucun historique côté contrôleur (§ 3.2).

**Maintenant :**
- Page `/profile/soirees`, en lecture seule. Elle est ouverte depuis le profil (raccourci « Mes soirées » pour un compte qui a le rôle contrôleur) et depuis le profil du contrôleur (`/controller/profile`). Elle est hors de l'espace `/controller`, donc accessible même quand aucun contrôle n'est ouvert et que le menu « Scanner » est masqué. L'adresse reste utilisable par un ancien contrôleur dont le rôle a été retiré : la liste dépend de ce qu'il a fait, pas du rôle.
- Lecture : `GET /api/account/evenings`, toujours pour le compte de la session ; un identifiant ajouté à l'adresse est ignoré (testé). Fonction `controller_evenings` :
  - prend les événements passés (fin passée, ou terminés, ou annulés) où le compte a été affecté, a scanné ou a tenu une caisse. Une affectation retirée après la soirée ne fait donc pas disparaître la soirée ;
  - sert pour chacun la date, l'événement, l'organisatrice (nom commercial, sinon raison sociale) et sa porte : celle de son affectation, sinon celle de sa dernière entrée validée, sinon son point d'entrée ;
  - sert enfin les chiffres de `controller_evening_figures`.
- Chiffres (`controller_evening_figures`, une seule fonction pour les deux écrans) :
  - les entrées que **ce** contrôleur a validées (scans acceptés, même compte que la colonne « entrées » de l'équipe). Une vente au guichet fait entrer la personne aussitôt : elle compte comme une entrée validée par le vendeur ;
  - s'il a tenu une ou plusieurs caisses sur l'événement : le total encaissé (somme des encaissements enregistrés de ses caisses, sans le fonds de caisse), l'écart (déclaré moins attendu) et l'état de la clôture (clôturée ; clôturée avec écart en attente de l'organisatrice ; écart accepté ; en litige ; pas encore clôturée).
- Confidentialité, vérifiée par le test : la réponse ne contient aucun nom, numéro, adresse ni identifiant de client, aucun numéro ni identifiant de billet, et aucune donnée d'un autre contrôleur. Les champs servis forment une liste fermée (`event_id`, `title`, `status`, `start_at`, `organizer`, `gate`, `zone`, `entry_point`, `entries`, `cash`). Un client sans soirée reçoit une liste vide ; sans session, la réponse est 401.
- Organisatrice : chaque événement passé d'un contrôleur, dans « Événements passés » de la page Équipe, affiche les mêmes chiffres (`partner_team_view` les sert dans `evening`, testé égal à la réponse du contrôleur).
- Limite : si l'organisatrice retire un contrôleur de son équipe après la soirée, la ligne disparaît de sa page Équipe (l'affectation n'existe plus) ; les entrées restent dans l'onglet Entrées de l'événement et la caisse dans l'onglet Caisse. Le contrôleur, lui, garde la soirée dans « Mes soirées ».

### 3.6 Menu « Scanner » à jour sans recharger la page (complément 14)

**Avant :** le menu suivait le profil, relu seulement à l'ouverture de l'application et à chaque renouvellement de session (environ toutes les heures).

**Maintenant :**
- Le profil déjà lu (`/api/auth/me`) sert aussi `scanner_next_change_at` : le prochain instant où le menu peut changer, c'est-à-dire 24 h avant l'ouverture d'un contrôle ou la fermeture d'un contrôle. Il n'est servi que s'il tombe dans les 24 h ; au-delà, la valeur est vide et la relecture horaire du profil la rapproche.
- Le navigateur (AuthProvider, contrôleur seul) relit le profil :
  - une seconde après cette heure ;
  - quand l'application revient au premier plan ;
  - dès que le scanner reçoit un refus « contrôle fermé » (événement terminé, pas encore ouvert, annulé ou suspendu).

  Dans ce dernier cas, le menu disparaît dès que le serveur le confirme, sans délai fixe. Il reste affiché si un autre contrôle du même compte est encore ouvert, ce qui serait faux si l'écran le masquait de lui-même.
- La relecture n'a jamais lieu en arrière-plan : elle attend le retour au premier plan.
- Aucune bibliothèque ajoutée. Un seul gestionnaire d'événements, partagé avec la relecture au retour du réseau qui existait déjà.
- Le serveur reste la seule protection : le menu n'est qu'un confort, et tout scan hors de la plage est refusé par la base.
- Budget : sans relever aucun budget, le poids ajouté au code commun est compensé par des messages de journal raccourcis (console du navigateur seulement) :
  - `[AuthProvider] billets hors ligne non chargés :` ;
  - `[AuthProvider] hors ligne : profil différé` ;
  - `[AuthProvider] /api/auth/me illisible` ;
  - `[AuthProvider] /api/auth/me` ;
  - `[AuthProvider] profil :` ;
  - `[PWA] service worker non enregistré :` ;
  - `[Avatar] photo illisible : initiales` ;
  - `[features] interrupteurs illisibles, services masqués :`.

  Chaque erreur reste journalisée avec l'objet d'erreur complet.

## 4. Textes exacts nouveaux

### 4.1 Page Équipe et onglet Équipe

- Titres : « Vos contrôleurs » (page), « Équipe de cet événement » (onglet). Boutons : « Actualiser », « Inviter un contrôleur ».
- Recherche « Rechercher » (exemple dans le champ : « Nom ou numéro »), choix « Événement » (« Tous les événements »). Filtres : « En attente », « Sans porte », « À relancer ».
- Ligne de la partenaire : « Vous (organisatrice) — toutes les portes ». « Vous scannez vos événements dont le contrôle est ouvert, à toutes les portes ou à une porte choisie, et vous vendez au guichet. » Bouton « Scanner les billets ».
- Personne : « Appeler », « WhatsApp » ; noms accessibles « Appeler {nom} », « Écrire à {nom} sur WhatsApp ». « Contrôleur sans nom » si le compte n'a pas de nom.
- États :
  - « Prêt » : « Actif depuis le {date} » ;
  - « Activation en attente » : « Lien d’activation envoyé le {date}, valable jusqu’au {date}. », « Code expiré le {date} : renvoyez le SMS. », « Lien d’activation pas encore envoyé : renvoyez le SMS. » ;
  - « Compte suspendu » : « Il ne peut pas scanner. Contactez le support. »
- Par événement :
  - lieu : « {porte} · {zone} », « Sans porte : ne peut pas scanner », « Point d’entrée : {texte} » ou « Point d’entrée non précisé » ;
  - espèces : « Espèces autorisées » ou « Sans espèces » ;
  - caisse : lien « Caisse ouverte » ;
  - entrées : « Aucune entrée », « {n} entrée(s) · dernier scan à {heure} » ;
  - date : « {date} à {heure} » ou « Date à venir ».
- Actions : « Modifier », « Retirer de cet événement », « Retirer de l’équipe », « Renvoyer le SMS d’activation ». Événements groupés sous « Événements passés de {nom} », sans action.
- Portes : section « Portes et couleurs ». Pour chaque porte, « Laisse entrer : » suivi des catégories avec leur pastille, ou « Laisse entrer : toutes les catégories », ou « Cette porte ne laisse entrer aucune catégorie. ». Sans zone : « Pas de zones : chaque contrôleur laisse entrer toutes les catégories. ». Lien « Modifier les portes et les couleurs ».
- Avertissements : « « {événement} » : catégorie en vente sans porte », « « {événement} » : porte sans contrôleur ». Bandeau « Attribuer les portes » : « Il ne peut pas scanner tant que vous ne lui attribuez pas une porte. » (au pluriel : « Ils ne peuvent pas scanner tant que vous ne leur attribuez pas une porte. »).
- Listes vides :
  - « Aucun contrôleur dans votre équipe » : « Invitez vos contrôleurs : ils reçoivent un SMS et scannent les billets à l’entrée. » ;
  - « Personne ne contrôle encore cet événement » : « Invitez au moins un contrôleur par porte. » ;
  - « Pas encore d’équipe » : « Pour inviter un contrôleur, il faut un événement validé ou publié. » ;
  - « Aucun contrôleur ne correspond à ce filtre. »
- Événement terminé : « Événement terminé : l’équipe ne change plus. » et « La liste reste visible pour mémoire. ». Pas encore validé : « Équipe disponible après la validation » et « Les contrôleurs s’ajoutent dès que l’événement est validé. ».
- Invitations (section « Invitations ») :
  - « Invitation envoyée » : « Envoyée le {date}. {nom} doit accepter avant le {date}. Événements : « {titre} ». » ;
  - « Sans réponse » : « Invitation expirée le {date}. » ;
  - « Refusée » : « Refusée le {date}. » ;
  - « Annulée » : « Annulée le {date}. Le lien du SMS ne mène plus à rien. »
  - Boutons : « Renvoyer l’invitation », « Annuler l’invitation », « Inviter de nouveau », « Effacer ». Rien à montrer : « Aucune invitation à relancer. »
- Équipe illisible : « Équipe indisponible ». Mise à jour : « Mis à jour à {heure} », jamais « En direct ».

### 4.2 Fenêtres

- **Inviter un contrôleur** :
  - « Il reçoit un SMS pour activer son accès au scanner. » ;
  - champs « Prénom », « Nom » (« Facultatif »), « Numéro de téléphone » (exemple « 77 123 45 67 »), « Événements » ;
  - interrupteur « Encaisser les espèces » : « Vend des billets au guichet de ces événements. » ;
  - boutons « Inviter » ou « Inviter sur {n} événements », « Fermer ». Sans événement : « Aucun événement validé ou publié : l’invitation sera possible après la validation. »
- **Ce numéro a déjà un compte** : « Titulaire : {nom masqué} », puis le texte du § 4.3, boutons « Revenir » et « Envoyer l’invitation ».
- **Modifier** :
  - « Porte » (liste ; « Aucune porte ») ;
  - « Peut changer de porte » : « Choisit lui-même sa porte dans le scanner. » ;
  - « Point d’entrée » (exemple « Porte Nord, Entrée VIP… ») sur un événement sans porte ;
  - « Encaisser les espèces » : « Vend des billets au guichet de cet événement. » ;
  - boutons « Enregistrer », « Fermer » ;
  - retrait des espèces : « Retirer le droit d’encaisser ? », bouton « Retirer le droit ».
- **Retirer {nom} de « {événement} » ?** : « Son scanner est refusé pour cet événement dès votre confirmation, même sur un téléphone déjà ouvert. Il reçoit un SMS et un avis. Ses scans déjà faits restent dans les entrées. » Bouton « Retirer de cet événement ».
- **Retirer {nom} de votre équipe ?** :
  - « {prénom} est retiré de votre événement » (un seul), « … de vos {n} événements » (plusieurs) ou « … de votre équipe » (aucun), puis « et reçoit un SMS et un avis. Son scanner est refusé pour vos événements dès votre confirmation, même sur un téléphone déjà ouvert. » ;
  - puis, selon le cas : « Il continue de contrôler pour les autres organisateurs qui l’ont invité. » ou « Son accès au scanner est fermé et il est déconnecté de l’application sur tous ses téléphones, espace client compris. Il pourra se reconnecter pour ses billets. » ;
  - enfin : « Pour le reprendre, invitez-le de nouveau. » Bouton « Retirer de l’équipe ».
- **Renvoyer le code à {nom} ?** : « Un SMS part vers le {numéro} avec un nouveau code valable 24 h ; l’ancien code ne marche plus. 3 envois au plus par jour vers ce numéro. » Bouton « Renvoyer le SMS ».
- **Renvoyer l’invitation à {nom} ?** : « Un nouveau SMS part et l’invitation est prolongée de 72 h. 3 envois au plus par jour vers ce numéro. »
- **Annuler l’invitation de {nom} ?** : « Le lien du SMS ne mènera plus à rien : il verra « Aucune invitation en attente ». Aucun message ne lui est envoyé. »
- **Effacer cette invitation ?** : « Elle disparaît de votre équipe. Vous pourrez toujours inviter ce numéro de nouveau. »
- **Motif (admin seulement)**, sur chaque fenêtre qui écrit : champ « Motif », aide « Obligatoire pour un administrateur : il est inscrit au journal. »

### 4.3 Messages après une action

- Invitation d'un numéro qui a déjà un compte (E-18), texte unique : « Ce numéro a déjà un compte Event Village ({nom}). Nous lui envoyons une invitation par SMS : il contrôlera vos événements après l’avoir acceptée dans l’application, sous 72 h. Son compte, ses billets et son portefeuille ne changent pas. »
- Invitations :
  - « Invitation envoyée à {nom} : réponse attendue avant le {date}. » ;
  - « Invitation envoyée à {prénom} par SMS : code d’activation valable jusqu’au {date}. » ;
  - « SMS renvoyé à {prénom} : code valable jusqu’au {date}. » (E-10).
- Gestion des invitations :
  - « Invitation renvoyée par SMS : réponse attendue avant le {date}. » ;
  - « Invitation annulée : le lien du SMS ne mène plus à rien. » ;
  - « Invitation effacée. »
- Retraits :
  - « {nom} ne contrôle plus « {événement} ». Il ne peut plus scanner ses billets. » ;
  - « {nom} est retiré de votre équipe : son accès au scanner est fermé sur tous ses téléphones. » ;
  - « {nom} est retiré de votre équipe : il ne peut plus scanner vos événements. »
- « Réglages de {nom} enregistrés. Ils s’appliquent à son prochain retour dans le scanner. »
- Échecs : « Action impossible pour le moment. Réessayez. », « Enregistrement impossible pour le moment. Réessayez. », « Invitation impossible pour le moment. Réessayez. »
- Refus du serveur :
  - « Cet événement a des portes : choisissez la porte du contrôleur dans la liste. » ;
  - « Cet événement n’a pas de portes : indiquez un point d’entrée. » ;
  - « Ce contrôleur ne contrôle pas cet événement. » ;
  - « Cette invitation attend encore une réponse : annulez-la d’abord. » ;
  - « Cette invitation n’attend plus de réponse : invitez de nouveau. » ;
  - « Indiquez le motif de cette action (5 caractères au moins) : il est inscrit au journal. » ;
  - « Action non autorisée : votre compte n’a pas la permission « Gérer les événements ». » ;
  - « Choisissez l’organisateur dont vous gérez l’équipe. »
- Côté contrôleur, invitation annulée : « L’organisateur a annulé cette invitation. »

### 4.4 Messages WhatsApp préparés

Ils ne sont pas envoyés par Event Village : WhatsApp s'ouvre sur le téléphone de la partenaire avec le texte déjà écrit.
- Prêt : « Bonjour {prénom}, ici {organisateur}. Vous contrôlez l’entrée de « {événement} » le {date} à {heure}, porte {porte}. Ouvrez le scanner : {adresse}/controller/scanner »
- À activer : « Bonjour {prénom}, ici {organisateur}. Pour scanner les billets de « {événement} », activez votre compte avec le code reçu par SMS : {adresse}/controller/setup. Si le code a expiré, dites-le-moi et je vous le renvoie. »
- Invitation : « Bonjour, ici {organisateur}. Je vous ai invité à contrôler l’entrée de « {événement} » sur Event Village. Acceptez l’invitation avant le {date} : {adresse}/invitations »

### 4.5 Scanner, guichet et contrôle fermé (complément 10)

- « Cet événement est terminé : le contrôle est fermé. » ; dans le bandeau du scanner, suivi de « Fermé depuis le {date} à {heure}. »
- « Le contrôle ouvre le {date} à {heure}. » ; dans le bandeau du scanner, suivi de « Le scan s’activera de lui-même à cette heure. »
- « Cet événement est annulé : le contrôle est fermé. » / « Cet événement est suspendu : le contrôle est fermé. » / « Le contrôle ouvrira quand l’événement sera publié. »
- Contrôleur sans contrôle ouvert : « Aucun contrôle ouvert pour vous », puis « Votre prochain contrôle ouvre le {date} à {heure}. Le scanner apparaîtra 24 h avant. » (ou « Le scanner apparaît quand un organisateur vous confie un événement, 24 h avant l’ouverture du contrôle. »), bouton « Mes billets ».
- `/partner/scan` : choix de porte « Toutes les portes » ; modes « Caméra », « Saisie manuelle », « Guichet » ; « Chargement du guichet… » ; « Fermez votre caisse à la fin de la soirée dans l’onglet Caisse de l’événement. »

### 4.5 bis « Mes soirées » (complément 13)

- Raccourci du profil : « Mes soirées », « Les événements que vous avez contrôlés : vos entrées et votre caisse ». Bouton du profil du contrôleur : « Mes soirées ».
- En-tête : « Mes soirées », « Les événements passés que vous avez contrôlés : vos entrées et votre caisse. », retour « Mon profil ».
- Carte :
  - « {événement} » ;
  - « {date} à {heure} · {organisatrice} » ;
  - « Porte {porte} · {zone} » (« Porte » omis si le nom commence déjà par Porte, Portail, Entrée, Accès ou Guichet, comme au scanner), « Point d’entrée : {texte} » ou « Porte non précisée » ;
  - « Aucune entrée validée », « 1 entrée validée », « {n} entrées validées » ;
  - pastille « Événement annulé ».
- Caisse :
  - « Pas de caisse » ;
  - « Caisse : {total} encaissés · Clôturée » ;
  - « … · Clôturée, il manquait {montant} : en attente de l’organisatrice » (ou « {montant} de trop ») ;
  - « … · Clôturée, il manquait {montant} : écart accepté par l’organisatrice » ;
  - « … · En litige : l’organisatrice vérifie la caisse » ;
  - « … · Pas encore clôturée : à fermer avec l’organisatrice ».
- Vide : « Aucune soirée pour le moment », « Après un événement où vous avez contrôlé les billets, vos entrées et votre caisse apparaissent ici. », bouton « Mes billets ».
- Erreur : « Vos soirées n’ont pas pu être chargées » ; repli du serveur : « Vos soirées sont momentanément indisponibles. Réessayez. ».
- Sans session : « Connectez-vous pour voir vos soirées », « L’historique des événements que vous avez contrôlés est lié à votre compte. ».
- Page Équipe, « Événements passés » : « {événement} · {date} », puis « {n} entrées validées · Caisse : … » (mêmes textes que ci-dessus).

### 4.6 Cloche, push et email (E-20) — aucun SMS

| Avis | Titre (cloche, push ; objet de l'email : « {titre} — Event Village ») | Texte |
|---|---|---|
| Acceptée | Invitation acceptée | {nom} a accepté votre invitation à contrôler l'entrée de « {événement} ». Choisissez sa porte et les espèces dans votre équipe. |
| Refusée | Invitation refusée | {nom masqué} a refusé votre invitation à contrôler l'entrée de « {événement} ». Invitez une autre personne depuis votre équipe. |
| Sans réponse | Invitation sans réponse | {nom masqué} n'a pas répondu à votre invitation à contrôler l'entrée de « {événement} » : elle a expiré. Invitez de nouveau depuis votre équipe. |

- Plusieurs événements : « « {événement} » et {n} autre(s) événement(s) ». Événement supprimé entre-temps : « vos événements ».
- Lien : `/partner/team`. Bouton de l'email : « Ouvrir Event Village ». Le push reprend le titre et le texte.
- Le nom complet n'apparaît que pour une acceptation ; il est masqué sinon (« Ou*** B*** »).

### 4.7 SMS

**Aucun SMS nouveau ni modifié.** « Renvoyer l’invitation » renvoie le SMS existant `CONTROLLER_INVITATION`, sans le changer, avec une nouvelle clé d'envoi pour chaque renvoi (`CONTROLLER_INVITATION:{id}:{n}`). Le SMS d'activation et les SMS de retrait sont inchangés.

## 5. Migrations à appliquer sur event-village-dev

| Ordre | Migration | Ce qu'elle fait |
|---|---|---|
| 1 | `20261115000001_finition1_securite.sql` | S1 : `ec_select_by_creator` supprimée ; `ec_select_owner` ; `ec_select_by_controller` avec la garde du compte. |
| 2 | `20261115000002_finition1_equipe.sql` | `controller_invitations` : état CANCELLED ; colonnes `phone_entered`, `cleared_at`, `last_sent_at`, `send_count`, `cancelled_by` ; reprise (`last_sent_at` = création, `phone_entered` = numéro du titulaire) ; index. Trois types d'avis `CONTROLLER_INVITATION_ACCEPTED/_DECLINED/_EXPIRED`. Fonctions `team_mask_name`, `team_gate_categories`, `controller_invitation_notify_partner`, `controller_invitation_actor_check`, `controller_invitation_cancel`, `_clear`, `_resend`, `controller_invitations_expire_due`, `partner_team_view`, `event_controller_settings_set` ; recopies de `controller_invitation_create` et `controller_invitation_respond`. Toutes réservées au service_role. |
| 3 | `20261115000003_finition1_controle.sql` | Recopies de `ticket_guest_list_search` (plage du contrôle), `scan_gate_context` (« Toutes les portes » de la propriétaire), `counter_sale` et `counter_sale_quote` (guichet de la propriétaire), `ticket_scan` (porte de la catégorie inscrite sur l'entrée) ; `controller_scanner_status`. |
| 4 | `20261115000004_finition1_fiche_proprietaire.sql` | Recopie de `scan_scanner_authorized` : la propriétaire doit avoir une fiche VALIDE. |
| 5 | `20261115000005_finition1_soirees.sql` | `controller_evening_figures`, `controller_evenings` (« Mes soirées ») ; recopies de `partner_team_view` (+ chiffres des soirées passées) et de `controller_scanner_status` (+ `next_change_at`). Réservées au service_role. |
| 6 | `20261115000006_cvf1_admin_non_invitable.sql` | T1 : `account_is_staff` ; recopies de `controller_invitation_create` (refus `NOT_INVITABLE`) et `controller_invitation_respond` (acceptation refusée à un compte d'administration, refus possible). |
| 7 | `20261115000007_cvf1_caisse_fiche.sql` | T2 : recopie de `shift_can_handle_cash` (la propriétaire seulement avec une fiche VALIDE). |
| 8 | `20261115000008_cvf1_soirees_scans_acceptes.sql` | T3 : recopie de `controller_evenings` (scans acceptés seulement). |
| 9 | `20261115000009_cvf1_verdict_hors_plage.sql` | T4 : recopies de `ticket_manual_lookup` (refus `CONTROL_CLOSED` sans lire le billet) et `ticket_scan` (verdict « contrôle fermé » sans billet). |
| 10 | `20261115000010_cvf1_motif.sql` | T5 : recopie de `controller_invitation_actor_check` (motif de 500 caractères au plus). |
| 11 | `20261115000011_cvf1_porte_supprimee.sql` | R1 : recopies de `event_controller_settings_set` et `event_controller_gate_set` (porte verrouillée, refus `GATE_GONE`). |
| 12 | `20261115000012_cvf1_invitations_simultanees.sql` | R2 : recopie de `controller_invitation_create`, version de la migration 6 (verrou par organisatrice et par compte, refus `INVITATION_ALREADY_SENT`). |
| 13 | `20261115000013_cvf1_affectations_admin_base.sql` | T1 en base : recopie de `controller_assignments_sync` (refus `NOT_INVITABLE` d'un événement ajouté à un compte d'administration) ; garde de la table `event_controllers`, avec la fonction `event_controllers_staff_guard` et le déclencheur `trg_event_controllers_staff_guard` (avant insertion ou changement de titulaire, code `CT409`). |
| 14 | `20261115000014_cvf1_promotion_admin.sql` | Promotion en administrateur. Type d'avis `CONTROLLER_BECAME_ADMIN`. Fonctions `controller_staff_open_shift`, `controller_staff_promotion_preview` et `controller_staff_promotion_apply`. Déclencheurs `trg_user_roles_staff_promotion` (`user_roles`) et `trg_users_staff_promotion` (`users.role`). Recopies de `user_roles_set` (CONTROLEUR retiré, refus d'une caisse ouverte), `notif_event_controllers_notify` (aucun avis de retrait pendant une promotion), `event_controllers_staff_guard`, `controller_invitation_create` et `controller_invitation_respond` (compte lu sous verrou). |

Toutes sont sans BEGIN ni COMMIT et rejouables : c'est prouvé en CI par `migration-finition1-rejouable`, où chacune des quatorze est rejouée dans une transaction annulée. Les migrations jusqu'à `20261112…` sont inchangées (`migrations-gelees`). Les neuf migrations des correctifs ne modifient aucune donnée existante. Elles remplacent des fonctions et en créent, réservées au service_role ou à la base ; elles ajoutent un type d'avis et trois déclencheurs (`event_controllers`, `user_roles`, `users`), qui n'agissent que sur une nouvelle affectation ou une nouvelle promotion d'un compte d'administration.

**Déployer l'application de la branche juste après, dans la même fenêtre.** Entre les migrations et le déploiement, l'ancienne application marche :
- les fonctions recopiées gardent leurs paramètres (le numéro saisi et le motif y sont facultatifs) ;
- les anciennes routes restent ;
- le scanner et le guichet d'un contrôleur ne changent pas.

Trois différences seulement :
- une propriétaire dont la fiche n'est pas VALIDE ne scanne plus et n'ouvre plus de caisse, ce qui est voulu ;
- le motif d'un admin n'est exigé qu'une fois la nouvelle application déployée, puisque ce sont ses routes qui le demandent ;
- l'ancienne application ne connaît pas les nouveaux refus des fonctions et de la table : compte d'administration, porte supprimée, invitation déjà envoyée, motif trop long, vérification hors de la plage. Le refus a bien lieu et rien n'est écrit, mais le message peut rester général jusqu'au déploiement.

### 5.1 Avant `db push` (éditeur SQL, une requête à la fois, garder les résultats)

```sql
-- A. attendu : 20261112000014, et aucune 20261115…
select max(version) from supabase_migrations.schema_migrations;

-- B. politiques de lecture de event_controllers (garder la liste) : attendu, ec_select_by_creator présente
select policyname, cmd from pg_policies
 where schemaname = 'public' and tablename = 'event_controllers' order by 1;

-- C. invitations de contrôleur par état (garder les nombres : ils ne doivent pas changer)
select status, count(*) from public.controller_invitations group by 1 order by 1;

-- D. attendu : 0 ligne (au plus une invitation en attente par organisateur et par compte).
--    S'il y en a : rien ne bloque ; après le déploiement, annuler les doublons dans la page Équipe.
select partner_id, user_id, count(*) from public.controller_invitations
 where status = 'PENDING' and expires_at > now() group by 1, 2 having count(*) > 1;

-- E. attendu : 0 ligne (types d'avis nouveaux absents)
select type from public.notification_types
 where type in ('CONTROLLER_INVITATION_ACCEPTED', 'CONTROLLER_INVITATION_DECLINED', 'CONTROLLER_INVITATION_EXPIRED',
                'CONTROLLER_BECAME_ADMIN');

-- F. fiches partenaires SUSPENDU dont le compte est ACTIF (garder le nombre) : ces propriétaires ne scanneront plus
--    leurs événements (§ 1.3) ; leurs contrôleurs, si.
select count(*) from public.partners p join public.users u on u.id = p.user_id
 where p.status::text = 'SUSPENDU' and u.status::text = 'ACTIF';

-- G. comptes d'administration qui ont aussi le rôle CONTROLEUR (garder la liste, § 0.1) : attendu 0 ligne.
--    S'il y en a : rien ne bloque la migration ; les retirer de l'équipe après le déploiement (§ 0.1).
select u.id, array_agg(ur.role::text order by ur.role::text) as roles,
       (select count(*) from public.event_controllers ec where ec.user_id = u.id) as affectations,
       (select count(*) from public.controller_invitations ci
         where ci.user_id = u.id and ci.status = 'PENDING' and ci.expires_at > now()) as invitations_en_attente
  from public.users u join public.user_roles ur on ur.user_id = u.id
 group by u.id
having bool_or(ur.role::text in ('ADMIN', 'SUPERADMIN')) and bool_or(ur.role::text = 'CONTROLEUR');
```

### 5.2 Appliquer

```powershell
cd C:\Users\DELL\Documents\event-village
git switch finition-1/equipe   # ou main après fusion
npx supabase db push            # projet lié : event-village-dev (rswk…)
```

### 5.3 Après (éditeur SQL)

```sql
-- A. attendu : 20261115000014
select max(version) from supabase_migrations.schema_migrations;

-- B. attendu : ec_select_by_controller et ec_select_owner présentes, ec_select_by_creator absente
--    (les autres politiques relevées en B avant sont inchangées)
select policyname, cmd from pg_policies
 where schemaname = 'public' and tablename = 'event_controllers' order by 1;

-- C. attendu : 5 lignes
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'controller_invitations'
   and column_name in ('phone_entered', 'cleared_at', 'last_sent_at', 'send_count', 'cancelled_by');

-- D. reprise : attendu 0 et 0 ; et les nombres par état identiques à C avant
select count(*) filter (where ci.last_sent_at is null) as sans_date_envoi,
       count(*) filter (where ci.phone_entered is null and u.phone is not null) as sans_numero_saisi
  from public.controller_invitations ci left join public.users u on u.id = ci.user_id;
select status, count(*) from public.controller_invitations group by 1 order by 1;

-- E. attendu : 4 lignes, canaux {IN_APP,PUSH,EMAIL}, audience PARTNER, aucune avec SMS
select type, channels, audience from public.notification_types
 where type in ('CONTROLLER_INVITATION_ACCEPTED', 'CONTROLLER_INVITATION_DECLINED', 'CONTROLLER_INVITATION_EXPIRED',
                'CONTROLLER_BECAME_ADMIN');

-- F. attendu : 22 (toutes les fonctions nouvelles présentes, celles des migrations 6, 13 et 14 comprises)
select count(distinct p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('team_mask_name', 'team_gate_categories', 'controller_invitation_notify_partner',
   'controller_invitation_create', 'controller_invitation_respond', 'controller_invitation_actor_check',
   'controller_invitation_cancel', 'controller_invitation_clear', 'controller_invitation_resend',
   'controller_invitations_expire_due', 'partner_team_view', 'event_controller_settings_set', 'controller_scanner_status',
   'controller_evening_figures', 'controller_evenings', 'account_is_staff', 'event_controllers_staff_guard',
   'controller_staff_open_shift', 'controller_staff_promotion_preview', 'controller_staff_promotion_apply',
   'user_roles_staff_promotion', 'users_staff_promotion');

-- G. attendu : 0 ligne (aucune de ces fonctions, créées ou recopiées, n'est exécutable par anon ni par authenticated)
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('team_mask_name', 'team_gate_categories', 'controller_invitation_notify_partner',
   'controller_invitation_create', 'controller_invitation_respond', 'controller_invitation_actor_check',
   'controller_invitation_cancel', 'controller_invitation_clear', 'controller_invitation_resend',
   'controller_invitations_expire_due', 'partner_team_view', 'event_controller_settings_set', 'controller_scanner_status',
   'controller_evening_figures', 'controller_evenings', 'account_is_staff', 'shift_can_handle_cash',
   'ticket_manual_lookup', 'ticket_scan', 'event_controller_gate_set', 'controller_assignments_sync',
   'event_controllers_staff_guard', 'controller_staff_open_shift', 'controller_staff_promotion_preview',
   'controller_staff_promotion_apply', 'user_roles_staff_promotion', 'users_staff_promotion', 'user_roles_set',
   'notif_event_controllers_notify')
   and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));

-- H. invariants (f1) à (f5) : attendu 0 ligne
select 'f1' as regle, id::text from public.controller_invitations where status = 'CANCELLED' and responded_at is null
union all
select 'f2', min(id::text) from public.controller_invitations where status = 'PENDING' and expires_at > now()
 group by partner_id, user_id having count(*) > 1
union all
select 'f3', id::text from public.controller_invitations where cleared_at is not null and status = 'PENDING' and expires_at > now()
union all
select 'f4', policyname from pg_policies where schemaname = 'public' and tablename = 'event_controllers'
   and cmd in ('SELECT', 'ALL') and coalesce(qual, '') ~ 'created_by'
union all
select 'f5', ec.id::text from public.event_controllers ec join public.users u on u.id = ec.user_id
 where u.role::text in ('ADMIN', 'SUPERADMIN')
    or exists (select 1 from public.user_roles r where r.user_id = ec.user_id and r.role::text in ('ADMIN', 'SUPERADMIN'));

-- I. essais sans effet : attendu {"ok": true, "scanner": false, "open_now": 0, "next_opens_at": null, "next_change_at": null}
--    puis {"ok": true, "items": []}
select public.controller_scanner_status(jsonb_build_object('user_id', gen_random_uuid()));
select public.controller_evenings(jsonb_build_object('user_id', gen_random_uuid()));

-- J. correctifs de la contre-vérification en place : attendu 16 lignes, toutes à true
select v.fonction, v.marque,
       (select bool_or(p.prosrc like '%' || v.marque || '%') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = v.fonction) as en_place
  from (values ('controller_invitation_create', 'NOT_INVITABLE'),              -- T1
               ('controller_invitation_respond', 'NOT_INVITABLE'),             -- T1
               ('shift_can_handle_cash', 'p.status = ''VALIDE'''),             -- T2
               ('controller_evenings', 'sc.accepted'),                         -- T3
               ('ticket_manual_lookup', 'CONTROL_CLOSED'),                     -- T4
               ('ticket_scan', 'cvf1 T4'),                                     -- T4
               ('controller_invitation_actor_check', 'REASON_TOO_LONG'),       -- T5
               ('event_controller_settings_set', 'GATE_GONE'),                 -- R1
               ('event_controller_gate_set', 'GATE_GONE'),                     -- R1
               ('controller_invitation_create', 'pg_advisory_xact_lock'),      -- R2
               ('controller_assignments_sync', 'NOT_INVITABLE'),               -- T1 en base (migration 13)
               ('user_roles_set', 'STAFF_PROMOTION_OPEN_SHIFT'),               -- promotion (migration 14)
               ('notif_event_controllers_notify', 'staff_promotion'),          -- promotion (migration 14)
               ('event_controllers_staff_guard', 'FOR SHARE'),                 -- promotion (migration 14)
               ('controller_invitation_create', 'FOR SHARE'),                  -- promotion (migration 14)
               ('controller_invitation_respond', 'FOR NO KEY UPDATE')          -- promotion (migration 14)
       ) as v(fonction, marque);

-- K. essai sans effet : attendu false (compte inconnu)
select public.account_is_staff(gen_random_uuid());

-- K bis. déclencheurs des migrations 13 et 14 : attendu 3 lignes, toutes activées (O)
select tgrelid::regclass as table_, tgname, tgenabled from pg_trigger
 where tgname in ('trg_event_controllers_staff_guard', 'trg_user_roles_staff_promotion', 'trg_users_staff_promotion')
   and not tgisinternal order by 2;

-- K ter. essai sans effet : attendu {"ok": true, "events": 0, "open_shift": null, "organizers": 0}
select public.controller_staff_promotion_preview(jsonb_build_object('user_id', gen_random_uuid()));

-- L. comptes d'administration avec le rôle CONTROLEUR : relancer G du § 5.1 ; même liste qu'avant (les correctifs
--    n'en retirent aucun, ils empêchent seulement d'en ajouter)
```

## 6. Runs

| Run | Code | Résultat |
|---|---|---|
| 188 | `0c198899` (code de `main` + déclencheur CI) | « Avant » : vert, 391/391, e2e vert |
| 189 | `0d1234eb` (`finition-1/rouges`, tests seuls) | Preuve des rouges : 348 réussies sur 395 ; les 4 suites de la finition rouges sur leurs assertions, 43 autres en cascade (invariants laissés par les tests rouges) |
| 190, 191 | `6f36e763`, `93db37ea` | Annulés par la poussée suivante. Le 190 a montré, avant son annulation : la cascade (x10) des montages à zones, le 500 sur une invitation annulée, les anciens textes E-18 dans deux tests, le motif d'admin dans `dette-retrait-controleur` |
| 192 | `b19b7f5e` | 345/396 : cascade (x8) d'une entrée « Toutes les portes » sans porte, garde de session dans les routes d'invitation, `dette-guichet` et `pilotage-equipe-caisse` à recaler, citations de la recette ; e2e : liens de moins de 44 px |
| 193 | `ae06e584` | Tests verts, 396/396 ; e2e : contraste en sombre (liens de l'équipe, filtre choisi) ; budget JS de `/` dépassé de 41 octets |
| 194 | `d089a8cf` | Annulé par la poussée suivante |
| 195 | `aa2d0451` | Vert : 396/396, e2e vert (avant le complément 4) ; `/` à 226 280 octets |
| 196 | `ce12933f` (`finition-1/rouges-2`, tests seuls sur `8afec8e0`) | Preuve des rouges : 394/396 ; rouges exactement `finition1-controle` (complément 11 : menu lu dans le profil ; complément 12 : fiche VALIDE) et `finition1-ecran-equipe` (contraste en sombre) ; e2e : seules les captures sombres de l'équipe |
| 197 | `a9e7f5d6` (`finition-1/rouges-3`, tests seuls sur `aa2d0451`) | Preuve des rouges du complément 4 : 394/397 ; rouges exactement `finition1-soirees` (route, page et heure du prochain changement absentes ; montage passé), `migration-finition1-rejouable` (migration 5 absente) et `design-systeme` (page inscrite, absente) ; e2e vert |
| 198 | `dccf08ef` (complément 4) | 396/397 : `finition1-soirees`, attente du test fausse (A a validé 3 entrées : 2 scans + la vente au guichet, entrée inscrite au nom du vendeur ; le test attendait 2). Code juste : les mêmes chiffres chez l'organisatrice étaient verts. Attente corrigée (§ 8.2). e2e vert, capture `controleur-soirees` comprise |
| 199 | `cc998a12` | Vert : 397/397, e2e vert ; `/` à 226 271 octets. Relecture des captures : trois défauts de texte (§ 7.1) |
| 200 | `e578f515` | Annulé par la poussée suivante |
| 201 | `94d325a9` | Tests verts, 398/398 ; e2e : la capture `partenaire-equipe-retirer` (4 sur 4) cherchait le titre avec une espace ordinaire avant « ? », devenue insécable (§ 7.1). Motif de la capture corrigé, écran inchangé (§ 8.2) |
| 202 | `ba77815d` | e2e vert (captures comprises) ; tests 397/398 : `sms-veille` (« 700 porteurs, plafond 700 » : une alerte de prévision inattendue). Cause : `sms-plafond-optionnel` et `sms-veille` tirent leur jour simulé dans la même plage (J+2 000 à J+3 680) depuis le lot 9 quinquies ; les 700 SMS optionnels de l'une sont tombés sur le jour de l'autre. Défaut d'isolation antérieur à la finition, sans lien avec son code ; plage séparée (§ 8.2) |
| 203 | `9e2edf23` | « Après » de la finition : vert, 398/398 (dont les 17 suites de `tests/audit/` et `tests/audit-auth/`), invariants à 0 (les seules lignes à 1 sont les violations fabriquées exprès par l'auto-test `pilotage-invariant`), e2e vert, 24 captures de l'équipe et de « Mes soirées » sans blocage |
| 205, 206 | `3a87f753`, `6f04e250` (`audit/finition-1`) | Contre-vérification : 402/407 ; rouges exactement `cvf1-2`, `cvf1-3`, `cvf1-4`, `cvf1-6`, `cvf1-7` (T1 à T5) |
| 208 | `c3f89e37` (`finition-1/rouges-cvf1`, tests seuls, sans les correctifs) | Preuve des rouges des correctifs : 397/415. Rouges exactement les 5 suites cvf1 ci-dessus, les 8 suites `cvf1c-*`, `migration-finition1-rejouable` (migrations 6 à 12 absentes) et `finition1-controle`, `-equipe`, `-securite`, `-soirees` (invariant f2 : 3 invitations en attente laissées par R2). `cvf1c-t4-verdict` tombait sur une adresse email de test invalide, pas sur son assertion : preuve refaite au run 210. e2e vert |
| 209 | `87053069` (les 9 commits de correctifs) | 413/415 ; e2e vert ; budgets inchangés. Deux rouges : `cvf1c-t4-verdict` (même adresse email invalide qu'au run 208 : les cas a et b ne vérifiaient rien) et `lot9quinquies-cv-controleur` (partenaire à fiche EN_ATTENTE ou REJETE : 403 `PARTNER_NOT_VALIDATED`, refus de la garde ajoutée par T2, au lieu de 403 `SCAN_FORBIDDEN` ; même refus). Les deux tests sont corrigés au commit `0ffe3924` (§ 8.2) |
| 210 | `3ac9c2d5` (`finition-1/rouges-cvf1` + test T4 corrigé) | Preuve des rouges refaite : 396/415. `cvf1c-t4-verdict` est rouge sur son assertion (« billet rendu » avant l'ouverture, après la fermeture, annulé). Mêmes rouges qu'au run 208, plus `cvf1-8` (R2 : 2 invitations en attente, 3 SMS). e2e vert |
| 211 | `0ffe3924` | « Après » des correctifs : vert, 415/415 (9 suites `cvf1-*`, 26 suites de `tests/audit/` et `tests/audit-auth/`), invariants à 0, e2e vert, budgets inchangés |
| 213 | `2e2ba502` (`finition-1/rouges-cvf1-13`, test de la migration 13 seul, sur `fbeda670`) | Preuve des rouges de la migration 13 : 357/416. `cvf1c-t1-affectations-base` est rouge sur tous ses cas sauf le témoin du retrait : la fonction rend `ok: true`, les insertions et le changement de titulaire sont acceptés, les trois courses répondent 201, 200 et 200 (attente du verrou observée). Les 58 autres rouges tombent toutes, et seulement, sur l'invariant x5 : la ligne passée par le cas b au compte d'administration n'a pas de lien partner_controllers. e2e vert |
| 214 | `f0523410` (migration 13) | « Après » de la migration 13 : vert, 416/416 (9 suites `cvf1-*`, 26 suites de `tests/audit/` et `tests/audit-auth/`). `cvf1c-t1-affectations-base` est vert : la fonction rend `NOT_INVITABLE`, la garde refuse avec `CT409`, les trois courses répondent 409, 409 et 403 (attente du verrou observée). Invariants à 0, e2e vert, budgets inchangés |
| 216 | `c0f59581` (`finition-1/rouges-cvf1-14`, tests de la migration 14 seuls, sur `07654261`) | Preuve des rouges de la migration 14 : 405/417. `cvf1c-t1-promotion` est rouge sur tous ses cas : ancien texte, aucune confirmation, rien de retiré ; pendant les courses, affectation et invitation créées (attente observée). `cvf1c-t1-affectations-base` est rouge sur ses cas adaptés. Registres d'avis et rejeu rouges (type et fichier absents). Les 6 autres suites ne tombent que sur f5. e2e vert |
| 217 | `6714e822` (migration 14) | « Après » de la migration 14 : vert, 417/417 (9 suites `cvf1-*`, 26 suites de `tests/audit/` et `tests/audit-auth/`). Promotion : refus de caisse ouverte au texte exact (route, fonction, écriture directe), confirmation au pluriel et au singulier, retrait complet avec avis aux organisatrices, scanner refusé (401). Courses : acceptation 410, affectation directe et nouvelle invitation 409 neutres, affectation en cours retirée ; attente observée chaque fois. Invariants à 0, e2e vert, budgets inchangés |

Budgets JavaScript : aucun n'a été relevé, ni par la finition ni par les correctifs de la contre-vérification (mesures des runs 209, 211, 214 et 217 identiques à celles du run 203). Le dépassement de `/` au run 193 venait de l'appel ajouté dans la mise en page commune ; il est remplacé par le champ du profil (§ 3.2). Mesure du run 203 : `/` 226 271 octets pour un budget de 226 342 (`main` : 226 297) ; `/events/[id]` 232 573 / 233 316 ; `/tickets` 249 662 / 250 417 ; `/controller/scanner` 233 757 / 234 911 ; `/billet/hors-ligne` 221 822 / 224 268. Toutes dans leur budget, aucun relevé.

## 7. Captures avant et après

Toutes les captures sont prises à 390 et 1440 px, en clair et en sombre. Elles sont copiées dans `docs/finition-1-captures/avant/` (12, run 188) et `docs/finition-1-captures/apres/` (24, run 203). Sur la branche `ci-results`, celles du run 203 s'ouvrent avec `git show origin/ci-results:<chemin> > fichier.png`. Celles du run 188 ne sont plus à la pointe, à cause de la rétention des 5 derniers runs : elles restent dans l'historique, au commit `a39e7727` (`git show a39e7727:<chemin>`).

| Écran | Avant (run 188) | Après (run 203) |
|---|---|---|
| Page Équipe (`/partner/team`) | `runs/188-43656859052/captures/partenaire-equipe__{mobile,ordinateur}__{clair,sombre}.png` | `runs/203-43702583039/captures/partenaire-equipe__…` |
| Onglet Équipe (pilotage) | `…/pilotage-equipe__…` | `…/pilotage-equipe__…` |
| Portes et couleurs | `…/partenaire-equipe-portes__…` | `…/partenaire-equipe-portes__…` |
| Fenêtre « Inviter un contrôleur » | n'existait pas (formulaire dans la page) | `…/partenaire-equipe-inviter__…` |
| Fenêtre « Retirer de l’équipe » | n'existait pas (« Retirer de tous » / « Supprimer ») | `…/partenaire-equipe-retirer__…` |
| « Mes soirées » (contrôleur) | n'existait pas | `…/controleur-soirees__…` |

Contrôles automatiques de chaque capture : axe-core (contraste compris), cibles tactiles de 44 px au moins et textes de moins de 14 px classés, tous sans blocage au run 203.

Ce qui change à l'œil, avant/après :
- **Page Équipe.** Avant : une fiche par membre, avec des libellés « Membre », « État », « Événements » et des pastilles d'événement à croix rouge. Après : sur téléphone, une carte par personne avec « Appeler » et « WhatsApp », l'état écrit et daté, puis la porte et les espèces de chaque événement ; sur ordinateur, un tableau. En tête : les bandeaux d'action (porte sans contrôleur) et la ligne « Vous (organisatrice) — toutes les portes ».
- **Onglet Équipe d'un événement.** Le même composant, limité à cet événement ; « Caisse ouverte » et « N entrées » mènent aux onglets correspondants.
- **Fenêtres.** « Inviter un contrôleur » et « Retirer de l’équipe » remplacent le formulaire dans la page et les boutons « Retirer de tous » et « Supprimer ». La fenêtre « Modifier » n'a qu'un seul « Enregistrer ».
- **« Mes soirées ».** Une carte par soirée passée : porte, entrées validées, caisse ; la pastille « Événement annulé » quand il y a lieu.
- Clair et sombre : textes et liens lisibles. Le contraste en sombre corrigé au run 193 tient toujours.

### 7.1 Relecture des captures du run 199, et corrections

Relues à l'œil après le run 199 (vert). Trois défauts de texte, corrigés chacun avec un test rouge (local) puis vert :

| Constat | Correctif | Test rouge puis vert |
|---|---|---|
| « Mes soirées » : « Porte Porte VIP · Carré VIP » quand le nom de la porte commence déjà par « Porte » | `eveningPlaceText` (`lib/shifts/evening-format.ts`) reprend la règle du scanner (lot 9 bis, R100) : « Porte » ajouté seulement si le nom ne commence pas par Porte, Portail, Entrée, Accès ou Guichet. Commit `e578f515` | `tests/schema/finition1-soirees-mots.test.ts` : 4 sur 4 rouges, puis verts |
| Fenêtre « Retirer de l’équipe » : « retiré de vos 1 événement » | `removedFromText` (`components/partner/team/team-types.ts`) : « de votre événement », « de vos {n} événements », ou « de votre équipe » s'il n'en a aucun. Commit `94d325a9` | `finition1-ecran-equipe` : 2 tests sur 9 rouges, puis verts |
| Même fenêtre : le « ? » du titre tombe seul sur la ligne suivante à 390 px | Espace insécable avant les « ? » et « ! » finaux des textes de l'équipe (7 titres de fenêtre). Même commit | Même test (aucune espace ordinaire avant un « ? » ou un « ! » final) |

Vu et laissé tel quel :
- sur la page Équipe, la ligne d'un événement dit « Porte : Porte Nord · Entrée générale ». C'est l'étiquette « Porte : » suivie du nom choisi par l'organisatrice, et la recette e2e l'attend telle quelle ;
- la loupe de « Rechercher » est à côté de l'étiquette, pas dans le champ : c'est l'emplacement prévu par le composant de champ du système de design.


## 8. Tests

### 8.1 Tests nouveaux

- `tests/parcours/finition1-securite.test.ts` : S1, cloisonnement des routes nouvelles, contrôleur sans vue de l'équipe, fiche non validée, renvois plafonnés.
- `tests/parcours/finition1-equipe.test.ts` : lecture unique, états datés, invitations sur 30 jours (annuler, effacer, renvoyer), textes E-10 et E-18, réglages en un enregistrement, retrait qui ferme le scanner, avis sans SMS, droits de l'admin avec motif, portes et couleurs (complément 9).
- `tests/parcours/finition1-controle.test.ts` : plage du contrôle, recherche d'invités, rôle gardé, événements passés (10) ; statut du scanner et champ du profil (11) ; « Toutes les portes », guichet, jamais chez une autre partenaire, fiche VALIDE exigée, ligne « Vous (organisatrice) » (12).
- `tests/parcours/finition1-soirees.test.ts` : « Mes soirées » (chiffres, confidentialité, mêmes chiffres chez l'organisatrice, page depuis le profil) et menu « Scanner » à jour (heure du prochain changement, relectures). Attente corrigée au run 198 : le contrôleur du montage a validé 3 entrées (2 scans et 1 vente au guichet), et non 2 ; le code n'a pas changé.
- `tests/schema/finition1-ecran-equipe.test.ts` : un seul composant, cartes et tableau (DataList), aucun mot technique ni code à l'écran, jetons du système de design, contraste en sombre ; accord « de votre événement » et espace insécable avant « ? » (§ 7.1).
- `tests/schema/finition1-soirees-mots.test.ts` : porte de « Mes soirées » sans « Porte » en double (§ 7.1).
- `tests/schema/migration-finition1-rejouable.test.ts` : les cinq migrations, rejouées.
- `tests/helpers/finition1-invariants.ts` : invariants (f1) à (f4), enchaînés après ceux des lots précédents.
- Correctifs de la contre-vérification (§ 0) :
  - les 9 suites `tests/audit/cvf1-*`, fusionnées sans changement ;
  - 8 suites nouvelles dans `tests/parcours/` : `cvf1c-t1-admin`, `cvf1c-t2-caisse`, `cvf1c-t4-verdict`, `cvf1c-t5-motif`, `cvf1c-r1-porte-supprimee`, `cvf1c-r2-invitations-simultanees`, `cvf1c-r3-textes-motif` et `cvf1c-r4-affectations-autre` ;
  - pour la migration 13 : `cvf1c-t1-affectations-base` (§ 0.2) ;
  - pour la migration 14 : `cvf1c-t1-promotion` (§ 0.3), et l'invariant (f5) dans `tests/helpers/finition1-invariants.ts`.

### 8.2 Tests existants modifiés (et pourquoi)

| Fichier | Modification | Raison |
|---|---|---|
| `notif-modeles`, `notif-outbox` | Trois types ajoutés aux registres | Avis E-20, nouveaux types |
| `droits-partenaire-9bis`, `lot9quater-droits`, `dette-retrait-controleur`, `pilotage-equipe-caisse` | Motif ajouté aux appels d'admin | E-17 : un admin donne désormais un motif ; les mêmes droits sont vérifiés |
| `partenaire-lot7` | Champs lus `counts` et `assignable` au lieu de `members_count`, `assignments_count`, `assignable_events` | La page lit `GET /api/partner/team` (E-13) |
| `cycle9bis-equipe`, `equipe-consentement-9ter` | Texte E-18 | Texte unique, sans « affecté » |
| `cycle9bis-fenetre-scan` | Phrases du bandeau du scanner | Messages communs du complément 10 |
| `dette-guichet` | Garde-fou : la propriétaire sans caisse ouverte est refusée par NO_OPEN_SHIFT, et non plus par NOT_ASSIGNED ; toujours rien vendu | Complément 12 : elle vend désormais au guichet |
| `tests/helpers/design-files.ts` | `TeamPanel`, `TeamDialogs`, `CategoryPills`, puis la page « Mes soirées » (page et squelette) inscrits | Règle du système de design |
| `e2e/recette.spec.ts`, `e2e/support/screens.ts` | Recette recalée sur la fenêtre d'invitation, la fenêtre « Modifier » et le tableau ; captures nouvelles `partenaire-equipe-inviter`, `partenaire-equipe-retirer` et `controleur-soirees` (réponse imposée : trois soirées types) | Nouveaux écrans |
| `e2e/support/screens.ts` (capture `partenaire-equipe-retirer`) | Titre cherché par `/de votre équipe\s\?/` au lieu de `/de votre équipe \?/` | Espace insécable avant « ? » (§ 7.1) ; rouge au run 201 |
| `docs/recette-billetterie.md`, `docs/parcours-evenement-complet.md` | Citations de lignes recalées (540→548, 692→700, 809→817, 886→894, 934→942, 1039→1047, 1191→1199 ; `partenaire-lot7` 892→894) | Lignes déplacées par la recette ; texte cité inchangé ; journaux et rapports des anciens lots non touchés |
| `sms-plafond-optionnel`, `sms-veille` | Jour simulé de `sms-plafond-optionnel` tiré entre J+4 000 et J+5 680 au lieu de J+2 000 à J+3 680 ; commentaires des deux suites. Aucune assertion changée | Les deux suites partageaient la même plage ; collision au run 202 (§ 6) |
| `.github/workflows/verify.yml` | Déclencheur `finition-*/**` | Runs « avant » et « après » de la finition |
| `lot9quinquies-cv-controleur` | Partenaire à fiche EN_ATTENTE ou REJETE : code attendu `PARTNER_NOT_VALIDATED` au lieu de `SCAN_FORBIDDEN` (même 403). Contrôleur inchangé | T2 : la garde de fiche des routes `/api/controller/*` refuse désormais la partenaire avant la fonction de scan, comme pour une fiche SUSPENDU ; rouge au run 209 |
| `finition1-controle` (test de la finition) | Même changement de code attendu pour la propriétaire à fiche non VALIDE | T2, même raison |
| `migration-finition1-rejouable` (test de la finition) | Migrations 6 à 14 ajoutées à la liste, une par commit | Chaque migration nouvelle est rejouée |
| `cvf1c-r2-invitations-simultanees` (nouveau, avant son premier vert) | Parmi les 4 demandes simultanées, un 429 `PHONE_INVITE_RATE_LIMIT` est accepté à côté des 409 `INVITATION_ALREADY_SENT` ; toujours un seul 201, une seule invitation et un seul SMS | Le plafond du numéro (lot 9 ter) peut légitimement répondre avant le verrou |
| `cvf1c-t4-verdict` (nouveau) | Libellé du contrôleur de test réduit à de l'ASCII avant d'entrer dans son adresse email ; aucune assertion changée | « avant l’ouverture » donnait une adresse invalide : les cas a et b tombaient avant toute vérification (runs 208 et 209) |
| `notif-modeles`, `notif-outbox` | Type `CONTROLLER_BECAME_ADMIN` ajouté aux registres | Avis nouveau de la migration 14 |
| `cvf1c-t1-affectations-base` (test de la migration 13) | Cas a et d : l'affectation d'avant (ev1) est désormais retirée par la promotion, au lieu d'être gardée. Témoin « droit d'encaisser et retrait d'un compte d'administration encore affecté » retiré : depuis la migration 14, ce compte ne peut plus exister après une promotion. Cas e (acceptation pendant la promotion) retiré : il interbloquerait avec le verrou du compte, et cette course est éprouvée par `cvf1c-t1-promotion`, cas e | Règle de la migration 14 |
| `tests/helpers/finition1-invariants.ts` | Invariant (f5) ajouté | Garde-fou demandé |

## 9. Essais pour un non-développeur

Sur l'application de la branche, avec un compte partenaire dont la fiche est validée et un événement publié :

1. Ouvrir « Équipe ». La première ligne doit dire « Vous (organisatrice) — toutes les portes ».
2. « Inviter un contrôleur » : prénom, numéro, un événement, puis envoyer. L'invitation apparaît tout de suite sous « Invitations », avec « Envoyée le … » et la date limite.
3. Sur cette invitation : « Annuler l’invitation ». Sur le téléphone invité, `/invitations` dit « Aucune invitation en attente ». « Effacer » fait disparaître la ligne.
4. Inviter de nouveau et accepter depuis le téléphone invité. La partenaire reçoit « Invitation acceptée » dans la cloche (et en push et par email selon ses réglages) ; la ligne passe à « Prêt » en une minute au plus, ou tout de suite avec « Actualiser ».
5. « Modifier » : choisir une porte et « Encaisser les espèces », puis un seul « Enregistrer ». La ligne affiche la porte et « Espèces autorisées ».
6. Sur téléphone : « Appeler » ouvre le composeur avec +221… ; « WhatsApp » ouvre la conversation avec un message déjà écrit.
7. Ouvrir « Portes et couleurs » : chaque porte dit ce qu'elle laisse entrer, avec ses pastilles. « Modifier les portes et les couleurs » mène à l'éditeur.
8. Le contrôleur scanne un billet ; puis la partenaire choisit « Retirer de l’équipe ». Le scan suivant sur son téléphone, resté ouvert, est refusé.
9. La partenaire ouvre « Scanner les billets », choisit « Toutes les portes » et scanne un billet : il passe. Elle choisit « Guichet » : sans caisse ouverte, le guichet lui propose d'abord « Ouvrir la caisse » ; ensuite elle vend.
10. Pour un contrôleur dont le seul événement commence dans plus de 30 h : pas de menu « Scanner », l'application est celle d'un client. Dans les 24 h précédant l'ouverture du contrôle, le menu revient de lui-même, sans recharger (§ 3.6).

11. Avec le compte du contrôleur de l'essai 8, une fois l'événement passé : Profil → « Mes soirées ». La soirée apparaît avec sa porte, le nombre d'entrées qu'il a validées et sa caisse, sans aucun nom de spectateur. La partenaire voit les mêmes chiffres dans « Événements passés » de sa page Équipe.
12. Avec un contrôleur dont le contrôle ferme dans quelques minutes, laisser l'application ouverte sur une page de client : le menu « Scanner » disparaît tout seul une seconde après la fermeture, sans recharger. Scanner un billet après la fermeture : le refus s'affiche et le menu disparaît aussitôt.

## 10. À faire de ton côté

1. Relire ce rapport et regarder les captures (`docs/finition-1-captures/`).
2. Décider de la fusion de `finition-1/equipe` dans `main` (avance rapide possible, la branche part de `main` à `6d5020b5`). Les branches `finition-1/rouges`, `finition-1/rouges-2`, `finition-1/rouges-3`, `finition-1/rouges-cvf1`, `finition-1/rouges-cvf1-13` et `finition-1/rouges-cvf1-14` ne sont pas à fusionner : ce sont des preuves. `audit/finition-1` est déjà contenue dans `finition-1/equipe`.
3. Après la fusion : contrôles du § 5.1 (G compris : comptes d'administration déjà contrôleurs), `db push` des quatorze migrations, contrôles du § 5.3, puis déploiement de l'application dans la même fenêtre.
4. Si le contrôle G rend des lignes : décider pour chaque compte (§ 0.1).
5. Vérifier que la tâche planifiée `/api/cron/reminders` tourne sur l'hébergement : c'est elle qui clôt les invitations échues et prévient la partenaire.
6. Pour un admin qui gère l'équipe d'un organisateur : ouvrir `/partner/team?partnerId={id}`. La liste de choix est notée pour après le lancement.

## 11. Points ouverts

Notés dans `docs/apres-lancement.md`, section « Équipe de contrôle (finition 1) » :
- zones et portes vers l'étape « Entrées » de la création d'événement ;
- bandeaux PIN et caisses ouvertes ;
- équipe en temps réel ;
- choix de l'organisateur pour un admin ;
- retrait des anciennes routes ;
- renommer un contrôleur à activer ;
- lien des avis vers la ligne précise.

L'historique des soirées et la relecture du menu « Scanner » pendant une session, notés un temps dans `docs/apres-lancement.md`, sont faits (compléments 13 et 14) et en ont été retirés.
