# Contre-vérification — finition 1 (équipe)

Branche `audit/finition-1`, partie de `finition-1/equipe` à `0eb7c392`, dans un dossier séparé. **Tests seulement : aucun correctif.** Rien n'est fusionné, aucune migration n'est faite, aucun test ne vise un projet distant, `.env.local` n'a pas été lu.

Neuf suites `tests/audit/cvf1-*.test.ts` jouent l'attaquant, une par point de la consigne, avec des aides communes dans `tests/audit/cvf1-helpers.ts`. Les comptes et les événements sont montés par le service_role sur la base locale de la CI, comme dans les suites du lot. Les attaques passent par les vraies routes, par la REST de Supabase (clé publique et jeton de l'attaquant) ou sans jeton. **Une suite verte veut dire que l'attaque a échoué ; une suite rouge montre un trou réel.** Chaque essai est écrit dans les journaux de la CI (lignes `[CVF1-n]`).

## À lire en premier

**Cinq trous, aucun critique.** Aucune entrée ni aucune vente frauduleuse n'a été possible. Le cloisonnement entre organisatrices, les retraits, les courses et les droits des fonctions tiennent.

| # | Point | Trou | Gravité |
|---|---|---|---|
| T1 | 6 | **Le numéro d'un ADMIN ou d'un SUPERADMIN s'invite.** L'invitation est créée et le SMS part. Si l'admin accepte, son compte reçoit le rôle CONTROLEUR, il est affecté à l'événement, et l'organisatrice lit son nom et son numéro dans son équipe. | moyenne |
| T2 | 4 | **Une propriétaire dont la fiche n'est pas VALIDE ouvre une caisse sur son événement**, avec son compte resté actif : fiche SUSPENDU, ou fiche EN_ATTENTE / REJETE quand le compte a aussi le rôle CONTROLEUR. Aucune vente ni aucune entrée ne suit : la base les refuse. | faible à moyenne |
| T3 | 2 | **« Mes soirées » montre l'événement d'une autre organisatrice** dès que le compte y a tenté un scan, pourtant refusé. N'importe quel compte peut le faire, même un simple client. Il lit alors le titre, la date, le statut et le nom de l'organisatrice. | faible |
| T4 | 3 | **Hors de la plage** (avant l'ouverture, après la fermeture, événement annulé ou suspendu), la vérification manuelle d'un numéro de billet rend encore le nom du porteur, la catégorie et l'état du billet. Aucune entrée n'est possible. | faible |
| T5 | 7 | **Le motif d'un admin n'a pas de limite haute** sur « Renvoyer », « Annuler » et « Effacer » une invitation : 5 000 caractères sont acceptés et inscrits au journal, alors que les autres écritures s'arrêtent à 500. | faible |

**Runs :**
- **205**, sur les neuf suites : 402 sur 407 ;
- **206**, avec deux essais de plus : 402 sur 407.

Dans les deux runs, les seules suites rouges sont exactement `cvf1-2`, `cvf1-3`, `cvf1-4`, `cvf1-6` et `cvf1-7`. Toutes les autres suites restent vertes, dont les 17 de `tests/audit/` et `tests/audit-auth/` qui existaient déjà, et l'e2e est vert (453 captures, aucune en échec).

## 1. Résultat point par point

| Point | Attaques tentées | Résultat |
|---|---|---|
| 1. Cloisonnement | La partenaire A vise la partenaire B :<br>– 5 lectures : `team?eventId`, `team?partnerId`, `team/all`, `team/[eventId]` deux fois ;<br>– 16 écritures : réglages (2), porte, point d'entrée, droit d'encaisser, affectations (2), renvoi, annulation, effacement, « Retirer de l'équipe » (2), « Retirer de cet événement », retrait par la liste, invitation sur un événement de B (2) ;<br>– une porte de B posée sur un événement de A ;<br>– chez B : guichet, devis, vente, caisse, scan sans porte, recherche d'invités, vérification et saisie manuelles ;<br>– REST sur 6 tables, puis 16 fonctions par la REST, avec le jeton de A puis sans jeton. | **Bloquée.** 403 ou 404 sans donnée de B. Rien ne change chez B : affectation, rôle, invitation, SMS, session de son contrôleur. Les 32 appels RPC sont refusés (`42501`). `cvf1-1` vert. |
| 2. Contrôleur | – les 5 routes de l'équipe ;<br>– REST sur 8 tables : affectations, comptes, caisses, invitations, liens, scans, billets ;<br>– `partner_team_view`, `controller_evenings` et `controller_evening_figures` par la REST ;<br>– « Mes soirées » : ses chiffres, l'identifiant de C2 dans l'adresse et dans des en-têtes, sans session ;<br>– scan refusé chez une autre organisatrice. | **Bloquée, sauf T3.** Ses entrées seulement : 1, alors que C2 en a validé une autre. Champs limités à la liste prévue, aucune donnée de client ni de C2, même réponse quel que soit l'identifiant ajouté, 401 sans session. |
| 3. Plage du contrôle | – 4 états (avant, après, annulé, suspendu) × 2 acteurs (contrôleur affecté, propriétaire) × 9 actions : scan, saisie, validation par la liste, vérification, recherche d'invités, devis, vente, caisse, codes hors ligne d'un billet d'autrui ;<br>– codes hors ligne demandés par le porteur lui-même ;<br>– caisse ouverte pendant la plage, puis événement déplacé après, déplacé avant ou suspendu. | Aucune entrée, aucune vente, aucune caisse, aucun code ; ventes refusées `EVENT_CLOSED` quand la caisse était ouverte. **T4** sur la vérification manuelle. |
| 4. Propriétaire | – témoin : « Toutes les portes » sur son événement, accepté ;<br>– chez B : scan sans porte, guichet, devis, vente, caisse ;<br>– « Toutes les portes » demandé par : un contrôleur à une porte (porte vide, puis absente), un contrôleur sans porte, un compte partenaire affecté, un admin `access.operate` ;<br>– fiche EN_ATTENTE, REJETE puis SUSPENDU, compte ACTIF, avec et sans le rôle CONTROLEUR : 7 actions. | « Toutes les portes » réservé à la propriétaire : `GATE_CHANGED` ou `GATE_REQUIRED` pour les autres, rien validé. Bloquée chez B. Fiche non validée : ni scan, ni vente, ni devis, ni guichet. **T2** sur la caisse. |
| 5. Retrait | – « Retirer de cet événement », puis avec le téléphone resté ouvert : lecture perdue renvoyée (en renvoi, puis en envoi normal), clé d'une entrée déjà acceptée, 12 actions, liste de ses événements ;<br>– « Retirer de l'équipe » d'un contrôleur qui travaille aussi chez Q (rôle gardé), puis d'un contrôleur qui ne travaille que pour elle (rôle retiré). | **Bloquée.** 403 sur tout, et l'entrée d'avant le retrait reste unique. Témoins : l'autre événement de la même organisatrice et l'événement de Q restent ouverts. Contrôleur seul : 401 (sessions révoquées). `cvf1-5` vert. |
| 6. Invitations | – invitation annulée, effacée, échue ou refusée : liste du titulaire, route, fonction par la REST, renvoi, annulation ;<br>– ancien lien après « Inviter de nouveau » ;<br>– SMS en masse : 6 renvois simultanés, quota brûlé par une autre partenaire, 5 invitations vers le même numéro, 25 renvois simultanés vers 25 numéros ;<br>– numéro d'un ADMIN et d'un SUPERADMIN, puis acceptation par l'ADMIN ;<br>– usurpation : accepter pour un autre, annuler à la place de l'organisatrice, renommer un compte existant, organisatrice et société d'une autre dans le corps. | **Bloquée, sauf T1.**<br>– Refus 410, 409 ou 404, et `42501` par la REST.<br>– Plafonds tenus : 3 SMS par numéro, 20 par organisatrice et par heure. Les renvois de B n'ont brûlé aucun quota.<br>– Le compte n'est pas renommé, et le SMS porte la société de la session. |
| 7. Admin | – `events.read` : lecture, puis 11 écritures avec motif ;<br>– admin sans permission ;<br>– `events.write` sans mot de passe redemandé ni code ;<br>– `events.write` avec le mot de passe saisi mais sans code ;<br>– admin rétrogradé ;<br>– motif absent, de 3 caractères, blanc, de 5 000 caractères ;<br>– motif valable, puis lecture du journal. | **Bloquée, sauf T5.**<br>– `events.read` lit, avec `can_manage` faux, mais n'écrit rien.<br>– Sans mot de passe : `ADMIN_PASSWORD_REQUIRED` partout ; sans code : `ADMIN_SMS_REQUIRED` partout, REST vide.<br>– Motif valable : l'action passe et le motif est au journal (réglages, annulation, retrait). |
| 8. Courses | – 2 « Retirer de l'équipe », 2 « Retirer de cet événement », puis les deux à la fois ;<br>– 4 invitations simultanées du même numéro ;<br>– renvoi et annulation en même temps ; renvoi et acceptation en même temps ;<br>– 6 réglages simultanés ;<br>– porte d'un autre événement, porte supprimée avant, porte supprimée pendant l'enregistrement (transaction concurrente ; une attente de verrou observée). | **Bloquée.** Un seul retrait effectif et un seul SMS ; une seule invitation en attente ; état final cohérent ; un journal par réglage ; jamais d'affectation vers une porte qui n'existe plus. `cvf1-8` vert ; remarques au § 3. |
| 9. Fonctions | – les 21 fonctions créées ou recopiées par les 5 migrations, liste lue dans les fichiers : droits dans le catalogue (anon, authenticated, PUBLIC) et `search_path`, puis 42 appels PostgREST ;<br>– politiques de lecture fondées sur `created_by`, dans tout le schéma public ;<br>– droits de lecture des tables de l'équipe. | **Bloquée.** Aucune fonction exécutable par l'API (`42501` partout) ; `search_path` fixé partout ; aucune politique fondée sur `created_by` ; `controller_invitations` et `partner_controllers` sans droit SELECT. `cvf1-9` vert. |

## 2. Trous : sortie brute, gravité, correctif proposé

### T1 — Le numéro d'un ADMIN ou d'un SUPERADMIN s'invite (point 6) — gravité moyenne

**Attaque.** L'organisatrice saisit le numéro d'un compte ADMIN, puis d'un compte SUPERADMIN, dans « Inviter un contrôleur » et confirme. Dans un second essai, l'ADMIN invité accepte l'invitation depuis son compte.

**Résultat : TROU** (`cvf1-6`, runs 205 et 206).

```
[CVF1-6] numéro d'un ADMIN : première étape → HTTP 200 {"requires_confirmation":true,"code":"EXISTING_ACCOUNT","existing_user":{"display_name":"Nd*** A***","phone":"+221779085797"},"message":"Ce numéro a déjà un compte Event Village (Nd*** A***). Nous lui envoyons une invitation par SMS : il contrôl…
[CVF1-6] numéro d'un ADMIN : invitations créées 1 ; SMS 1 ; rôles ADMIN,CLIENT → ADMIN,CLIENT
[CVF1-6] numéro d'un SUPERADMIN : première étape → HTTP 200 {"requires_confirmation":true,"code":"EXISTING_ACCOUNT","existing_user":{"display_name":"Nd*** A***","phone":"+221779085946"},"message":"Ce numéro a déjà un compte Event Village (Nd*** A***). Nous lui envoyons une invitation par SMS : il co…
[CVF1-6] numéro d'un SUPERADMIN : invitations créées 1 ; SMS 1 ; rôles CLIENT,SUPERADMIN → CLIENT,SUPERADMIN
[CVF1-6] ADMIN (suite) : invitation → HTTP 201 {"success":true,"assignments":[],"assignment":null,"is_new_user":false,"invitation_id":"48f577ce-7ff3-4fbf-8193-083a5c5399a5","invitation_expires_at":"2026-11-18T14:11:27.211542+00:00","notification":"QUEUED","message":"Invitation envoyée à Nd*** A*** : réponse attendue avant le mer…
[CVF1-6] ADMIN (suite) : acceptation → HTTP 200 {"success":true,"status":"ACCEPTED","assigned_event_ids":["5071999f-15da-4e24-b07f-e1567ce8295d"],"message":"Invitation acceptée : vous pouvez contrôler l’entrée de ces événements."} ; rôles ADMIN,CLIENT,CONTROLEUR ; numéro de l'admin dans l'équipe de l'organisatrice : true
    not ok 1 - ADMIN et SUPERADMIN : aucune invitation, aucun SMS, aucun rôle
    not ok 2 - suite de l’essai : l’ADMIN invité qui accepte devient contrôleur de l’organisatrice, qui lit son nom et son numéro
        0: 'ADMIN : invitation acceptée par la route HTTP 201 {"success":true,"assignments":[],"assignment":null,"is_new_user":false,"invitation_id":"e898169a-b70e-4f78-bf8c-6bd7b0a763d5","invitation_…
        3: 'SUPERADMIN : invitation acceptée par la route HTTP 201 {"success":true,"assignments":[],"assignment":null,"is_new_user":false,"invitation_id":"5f9cbc01-e9f6-41a0-9be5-24ee1c906d4f","invita…
        1: 'le compte ADMIN porte désormais le rôle CONTROLEUR'
        2: 'le compte ADMIN est affecté à un événement de l’organisatrice'
        3: 'l’organisatrice lit le numéro du compte ADMIN dans son équipe'
```

**Cause.** `app/api/partner/team/invite/route.ts` range un compte ADMIN ou SUPERADMIN parmi les comptes « déjà contrôleurs ». Comme l'organisatrice ne le connaît pas encore, le chemin du consentement (lot 9 ter) lui envoie une invitation à accepter. Ni `controller_invitation_create`, ni `controller_invitation_respond` ne regardent les rôles d'administration.

**Gravité.**
- Une organisatrice peut faire entrer un compte d'administration dans son équipe, par exemple avec un message convaincant (« acceptez l'invitation reçue par SMS »).
- Ce compte porte alors aussi le rôle CONTROLEUR, et il est affecté à son événement.
- Elle lit son nom complet et son numéro dans sa page Équipe.
- Dès la première étape, elle apprend que le numéro a un compte, avec le nom masqué (« Nd*** A*** »).
- Les SMS vers ce numéro restent limités à 3 par jour.

**Correctif proposé.** Refuser un compte ADMIN ou SUPERADMIN à l'invitation (dans la route et dans `controller_invitation_create`) et à l'acceptation (dans `controller_invitation_respond`), avec le texte neutre d'un compte qui ne peut pas être invité.

### T2 — Caisse ouverte par une propriétaire dont la fiche n'est pas VALIDE (point 4) — gravité faible à moyenne

**Attaque.** Sur son propre événement, compte ACTIF, l'organisatrice passe successivement en fiche EN_ATTENTE, REJETE puis SUSPENDU, avec et sans le rôle CONTROLEUR. Dans chaque cas elle tente : scan « Toutes les portes », guichet, devis, ouverture de caisse, vente, recherche d'invités, vérification manuelle.

**Résultat : TROU sur l'ouverture de caisse, dans 4 cas sur 6** (`cvf1-4`, runs 205 et 206) : fiche SUSPENDU (avec ou sans le rôle), fiche EN_ATTENTE ou REJETE avec le rôle CONTROLEUR. Tout le reste est refusé.

```
[CVF1-4] fiche EN_ATTENTE, sans rôle CONTROLEUR : ouverture de caisse → HTTP 403 {"error":"Votre profil d’organisateur doit être validé avant cette action.","code":"PARTNER_NOT_VALIDATED"}
[CVF1-4] fiche REJETE, sans rôle CONTROLEUR : ouverture de caisse → HTTP 403 {"error":"Votre profil d’organisateur doit être validé avant cette action.","code":"PARTNER_NOT_VALIDATED"}
[CVF1-4] fiche SUSPENDU, sans rôle CONTROLEUR : ouverture de caisse → HTTP 200 {"success":true,"shift":{"id":"86c948c2-2c7b-4429-bce7-b85b258aa15e","controller_id":"10a7b3e2-751f-4eff-9adb-499e76522027","event_id":"8807014b-17e7-4…
[CVF1-4] fiche EN_ATTENTE, avec rôle CONTROLEUR : ouverture de caisse → HTTP 200 {"success":true,"shift":{"id":"ed4e944a-82d7-4ae1-92bb-fb90a9e47dd0","controller_id":"10a7b3e2-751f-4eff-9adb-499e76522027","event_id":"d7116e34-5fd5…
[CVF1-4] fiche REJETE, avec rôle CONTROLEUR : ouverture de caisse → HTTP 200 {"success":true,"shift":{"id":"4d622dee-d687-4dcb-aba7-74920b85c56e","controller_id":"10a7b3e2-751f-4eff-9adb-499e76522027","event_id":"618d1782-3dff-4d9…
[CVF1-4] fiche SUSPENDU, avec rôle CONTROLEUR : ouverture de caisse → HTTP 200 {"success":true,"shift":{"id":"909d21f3-07db-4c72-8a9c-f41f38565480","controller_id":"10a7b3e2-751f-4eff-9adb-499e76522027","event_id":"a4a411ed-3848-4…
[CVF1-4] fiche SUSPENDU, sans rôle CONTROLEUR : scan sans porte → HTTP 403 {"error":"Vous n’êtes pas autorisé à contrôler cet événement.","code":"SCAN_FORBIDDEN"}
[CVF1-4] fiche SUSPENDU, sans rôle CONTROLEUR : vente → HTTP 403 {"ok":false,"code":"NOT_ASSIGNED","message":"Vente réservée au contrôleur affecté à l'événement.","error":"Vente réservée au contrôleur…
    not ok 1 - EN_ATTENTE, REJETE, SUSPENDU, avec et sans rôle CONTROLEUR : ni scan, ni guichet, ni caisse
        0: 'fiche SUSPENDU, sans rôle CONTROLEUR : caisse ouverte sur son événement HTTP 200 {"success":true,"shift":{"id":"86c948c2-2c7b-44…
        1: 'fiche EN_ATTENTE, avec rôle CONTROLEUR : caisse ouverte sur son événement HTTP 200 {"success":true,"shift":{"id":"ed4e944a-82d7-…
        2: 'fiche REJETE, avec rôle CONTROLEUR : caisse ouverte sur son événement HTTP 200 {"success":true,"shift":{"id":"4d622dee-d687-4dcb…
        3: 'fiche SUSPENDU, avec rôle CONTROLEUR : caisse ouverte sur son événement HTTP 200 {"success":true,"shift":{"id":"909d21f3-07db-4c…
```

**Cause.**
- `shift_can_handle_cash` (`20261111000003_lot9quater_droits.sql`) admet la propriétaire de l'événement sans regarder l'état de sa fiche.
- Côté route, la garde de la fiche laisse passer une fiche SUSPENDU partout. Elle ne s'applique pas non plus aux routes `/api/controller/*` quand le compte a le rôle CONTROLEUR.
- `counter_sale` et `scan_scanner_authorized` exigent bien une fiche VALIDE, d'où l'absence de vente et d'entrée.

**Gravité.**
- Une organisatrice suspendue, dont le compte a été remis actif à part, ouvre une caisse sur son événement. La caisse apparaît, avec son fonds de caisse déclaré, dans l'onglet Caisse et dans le pilotage.
- La règle du complément 12 (« fiche VALIDE exigée ») n'est donc pas tenue pour la caisse, alors que le § 1.3 du rapport de la finition l'annonce.
- Aucune vente ni aucune entrée ne peut suivre.

**Correctif proposé.** Dans `shift_can_handle_cash`, n'admettre la propriétaire que si sa fiche est VALIDE (`p.status = 'VALIDE'`), comme `counter_sale` et `scan_scanner_authorized`.

### T3 — « Mes soirées » montre l'événement d'autrui après un scan refusé (point 2) — gravité faible

**Attaque.** Un contrôleur de l'organisatrice P, puis un simple client sans aucun rôle, envoient au scanner un billet d'un événement passé de l'organisatrice Q. Le scan est refusé (403). Ils ouvrent ensuite « Mes soirées ».

**Résultat : TROU** (`cvf1-2`, runs 205 et 206). L'événement de Q apparaît dans les deux listes.

```
[CVF1-2] scan de C1 sur l'événement de Q → HTTP 403 {"error":"Vous n’êtes pas autorisé à contrôler cet événement.","code":"SCAN_FORBIDDEN"}
[CVF1-2] « Mes soirées » de C1 après le refus chez Q → CONTIENT {"event_id":"9803a306-53ae-4e8d-8ac3-4d9870d5183b","title":"TEST Accès cvf1-ctrl-autre 1794751865746","status":"PUBLIE","start_at":"2026-11-14T08:11:05+00:00","organizer":"Finance cvf1-ctrl-q","gate":null,"zone":null,"entry_point":null,"entries":0,"cash":null}
[CVF1-2] scan d'un client sans rôle sur l'événement de Q → HTTP 403 {"error":"Vous n’êtes pas autorisé à contrôler cet événement.","code":"SCAN_FORBIDDEN"}
[CVF1-2] « Mes soirées » du client → HTTP 200 {"items":[{"event_id":"9803a306-53ae-4e8d-8ac3-4d9870d5183b","title":"TEST Accès cvf1-ctrl-autre 1794751865746","status":"PUBLIE","start_at":"2026-11-14T08:11:05+00:00","organizer":"Finance cvf1-ctrl-q","gate":null,"zone":null,"entry_point":null,"entries":0,"cash":null}]}
    not ok 1 - contrôleur de P qui tente un scan chez Q, puis client sans rôle : l’événement de Q n’apparaît pas
```

**Cause.** `controller_evenings` (`20261115000005_finition1_soirees.sql`) reprend toutes les lignes `ticket_scans` du compte (`UNION SELECT sc.event_id FROM ticket_scans sc WHERE sc.scanner_id = v_user`). Cela comprend la ligne `forbidden` que `ticket_scan` écrit justement quand il refuse le scanneur. Or la route du scan est ouverte à toute session active : c'est la base qui décide.

**Gravité.**
- Il faut connaître l'identifiant de l'événement. Pour un événement publié, ces données sont de toute façon publiques.
- Mais « Mes soirées » ne veut plus dire « ce que j'ai contrôlé » : n'importe quel compte peut y ajouter des événements qu'il n'a jamais contrôlés.
- Pour un événement passé jamais publié (validé puis annulé, par exemple), le titre et l'organisatrice sortent.

**Correctif proposé.** Dans `controller_evenings`, ne retenir que les scans acceptés du compte (`sc.accepted`), ou au moins exclure ceux dont le résultat est `forbidden`.

### T4 — Vérification manuelle hors de la plage du contrôle (point 3) — gravité faible

**Attaque.** Avant l'ouverture, après la fermeture, sur un événement annulé puis suspendu, le contrôleur affecté vérifie un billet par son numéro (`POST /api/controller/scan/lookup`).

**Résultat : TROU** (`cvf1-3`, runs 205 et 206). Le serveur rend le nom du porteur, la catégorie et l'état du billet. Aucune entrée n'est possible : le verdict est bien « fermé ». Le verdict de refus du scan rend lui aussi le billet, nom du porteur compris (ligne « scan » ci-dessous).

```
[CVF1-3] contrôleur, avant l’ouverture : vérification manuelle → HTTP 200 {"found":true,"ticket":{"ticket_number":"TCK-CVF1-4E00E1DEE5","holder":"Fatou Porteuse","category":"Entrée libre","status_label":"Valable","preview":"event_not_open","preview_label":"Contrôle pas encore ouvert"}}
[CVF1-3] contrôleur, après la fermeture : vérification manuelle → HTTP 200 {"found":true,"ticket":{"ticket_number":"TCK-CVF1-46EE2E5234","holder":"Fatou Porteuse","category":"Entrée libre","status_label":"Valable","preview":"event_ended","preview_label":"Événement terminé"}}
[CVF1-3] contrôleur, annulé : vérification manuelle → HTTP 200 {"found":true,"ticket":{"ticket_number":"TCK-CVF1-563101C88B","holder":"Fatou Porteuse","category":"Entrée libre","status_label":"Valable","preview":"event_cancelled","preview_label":"Événement annulé"}}
[CVF1-3] contrôleur, suspendu : vérification manuelle → HTTP 200 {"found":true,"ticket":{"ticket_number":"TCK-CVF1-74440480FE","holder":"Fatou Porteuse","category":"Entrée libre","status_label":"Valable","preview":"event_suspended","preview_label":"Événement suspendu"}}
[CVF1-3] contrôleur, après la fermeture : scan → HTTP 200 {"gate":null,"zone":{"id":null,"kind":"ENTREE","name":"Entrée","implicit":true},"result":"event_ended","ticket":{"id":"e5fa3bd2-19cc-449e-8193-e61dd5275f3f","price":0,"holder":"Fatou Porteuse","origin":"FREE","category":"Entrée libre","is_gue…
[CVF1-3] contrôleur, après la fermeture : recherche d’invités → HTTP 409 {"error":"Cet événement est terminé : le contrôle est fermé.","code":"CONTROL_CLOSED"}
    not ok 1 - scan, saisie, invités, devis, guichet, caisse, codes : aucune entrée, aucune vente
```

**Gravité.**
- Il faut connaître le numéro du billet (10 caractères tirés au hasard) ou avoir son QR sous les yeux : ce n'est pas une recherche par le numéro de téléphone.
- C'est pourtant la même famille que la recherche d'invités, fermée par la finition au § 1.2 : après la fermeture, le scanner transforme encore un numéro de billet en nom de porteur.

**Correctif proposé.** Hors de la plage (`scan_event_problem` non nul), faire rendre à `ticket_manual_lookup` et au verdict de refus de `ticket_scan` le seul verdict, sans le nom du porteur ni le numéro du billet.

### T5 — Motif d'un admin sans limite haute sur les actions d'invitation (point 7) — gravité faible

**Attaque.** Un admin `events.write`, avec son code, envoie chaque écriture d'équipe avec un motif de 5 000 caractères.

**Résultat : TROU** (`cvf1-7`, runs 205 et 206).
- « Renvoyer », « Annuler » et « Effacer » acceptent ce motif et l'inscrivent au journal ; le renvoi envoie même le SMS.
- Les 8 autres écritures le refusent (400, limite de 500 caractères).

```
[CVF1-7] motif 5 000 caractères : POST invite → HTTP 400 {"error":"Too big: expected string to have <=500 characters"}
[CVF1-7] motif 5 000 caractères : POST resend → HTTP 200 {"ok":true,"expires_at":"2026-11-18T14:11:32.929391+00:00","message":"Invitation renvoyée par SMS : réponse attendue avant le mer. 18 nov. 2026…
[CVF1-7] motif 5 000 caractères : POST cancel → HTTP 200 {"ok":true,"message":"Invitation annulée : le lien du SMS ne mène plus à rien."}
[CVF1-7] motif 5 000 caractères : DELETE invitation (effacer) → HTTP 200 {"ok":true,"message":"Invitation effacée."}
[CVF1-7] motif 5 000 caractères : PATCH settings → HTTP 400 {"error":"Too big: expected string to have <=500 characters","code":"INVALID_BODY"}
[CVF1-7] motif 5 000 caractères : PATCH entry-point → HTTP 400 {"error":"Point d’entrée invalide (80 caractères au plus).","details":{"formErrors":[],"fieldErrors":{"reason":["Too big: expected string…
[CVF1-7] motif 5 000 caractères : PATCH assignments/[id] → HTTP 400 {"error":"Données invalides : canAcceptCash doit valoir vrai ou faux.","code":"INVALID_BODY"}
[CVF1-7] motif 5 000 caractères : PATCH assignments → HTTP 400 {"error":"Too big: expected string to have <=500 characters","code":"INVALID_FIELD"}
[CVF1-7] motif 5 000 caractères : DELETE team/[eventId] → HTTP 400 {"error":"Indiquez le motif de cette action (5 caractères au moins) : il est inscrit au journal.","code":"REASON_REQUIRED","field":"r…
[CVF1-7] motif 5 000 caractères : DELETE team/controller → HTTP 400 {"error":"Indiquez le motif de cette action (5 caractères au moins) : il est inscrit au journal.","code":"REASON_REQUIRED","field":"…
[CVF1-7] motif 5 000 caractères : DELETE team/all → HTTP 400 {"error":"Indiquez le motif de cette action (5 caractères au moins) : il est inscrit au journal.","code":"REASON_REQUIRED","field":"reason"…
    not ok 1 - sans motif, trop court, blanc, plus de 500 caractères : chaque écriture refusée
[CVF1-7] journal de l'admin : [["CONTROLLER_INVITATION_CANCELLED","ADMIN","Demande écrite de l’organisatrice, ticket support 4521"],["CONTROLLER_DELETED","ADMIN","Demande écrite de l’organisatrice, ticket support 4521"],["USER_SESSIONS_REVOKED",null,"CONTROLLER_REMOVED"],["CONTROLLER_SETTINGS_SET","…
```

**Cause.** `app/api/partner/team/invitations/invitation-actions.ts` transmet `body.reason` à la fonction sans limite, et `controller_invitation_actor_check` ne vérifie que le minimum de 5 caractères.

**Gravité.** Le journal peut être gonflé, mais seulement par un admin qui a son code et la permission `events.write`. C'est aussi un écart avec le rapport de la finition, qui annonce « 5 à 500 caractères » (§ 1.4).

**Correctif proposé.** Appliquer `adminReasonRefusal` (5 à 500 caractères) dans `invitation-actions.ts`, et limiter le motif à 500 caractères dans `controller_invitation_actor_check`.

## 3. Remarques (pas des trous)

- **Porte supprimée pendant l'enregistrement** (`cvf1-8`). La réponse est une erreur 500 générique, « Enregistrement momentanément impossible. Réessayez. », provoquée par la clé étrangère qui refuse la porte supprimée. Il n'y a aucun dégât : la porte du contrôleur ne change pas. Un refus « Porte inconnue » serait plus juste.
- **Quatre invitations simultanées du même numéro** (`cvf1-8`).
  - Résultat : 201, 201, 429, 201 ; trois invitations créées, dont une seule reste en attente.
  - Mais trois SMS sont partis, dont deux vers des liens aussitôt morts.
  - `controller_invitation_create` ne prend aucun verrou : l'invariant f2 tient par l'enchaînement de la mise à jour puis de l'insertion, et non par une contrainte. Le plafond du numéro (3 SMS) a tenu.
- **Textes faux pour un motif d'admin trop long.** Les refus sont justes, mais les messages ne correspondent pas à l'erreur :
  - `PATCH /api/partner/team/entry-point` répond « Point d’entrée invalide (80 caractères au plus). » ;
  - `PATCH /api/partner/team/assignments/[id]` répond « Données invalides : canAcceptCash doit valoir vrai ou faux. ».
- **Affectations du contrôleur d'une autre organisatrice.** `PATCH /api/partner/team/assignments` envoyé par A avec le contrôleur de B et une liste vide répond 200 « Événements du contrôleur enregistrés. ». Rien ne change chez B et rien ne fuit, mais la réponse est trompeuse.

## 4. Runs

| Run | Commit | Résultat |
|---|---|---|
| 205 | `3a87f753` (les 9 suites) | 402 réussies sur 407 ; les seules rouges sont `cvf1-2`, `cvf1-3`, `cvf1-4`, `cvf1-6`, `cvf1-7` (trous T1 à T5) ; toutes les autres suites vertes, dont les 17 de `tests/audit/` et `tests/audit-auth/` existantes ; invariants à 0 en fin de chaque suite cvf1 ; e2e vert, 453 captures, aucune en échec |
| 206 | `6f04e250` (deux essais de plus) | 402 réussies sur 407, mêmes 5 suites rouges et seulement elles. Le cas « mot de passe saisi, sans code » est refusé partout (`ADMIN_SMS_REQUIRED`). L'acceptation par l'ADMIN invité est confirmée (T1). e2e vert, 453 captures, aucune en échec |

Journaux bruts : branche `ci-results`, `runs/205-43716925236/` et `runs/206-43722687313/` (`verify.log`, et `test-logs/tests__audit__cvf1-*.log` pour chaque suite).

## 5. Fichiers

Tous nouveaux, tous sous `tests/audit/` (aucun fichier existant n'est touché, aucune suite de `tests/audit/` ni de `tests/audit-auth/` n'est modifiée) :

| Fichier | Point |
|---|---|
| `cvf1-helpers.ts` | aides communes (appel des routes, clients REST, montage d'événements, de billets et d'admins sans code) |
| `cvf1-1-cloisonnement.test.ts` | 1 |
| `cvf1-2-controleur.test.ts` | 2 |
| `cvf1-3-plage.test.ts` | 3 |
| `cvf1-4-proprietaire.test.ts` | 4 |
| `cvf1-5-retrait.test.ts` | 5 |
| `cvf1-6-invitations.test.ts` | 6 |
| `cvf1-7-admin.test.ts` | 7 |
| `cvf1-8-courses.test.ts` | 8 |
| `cvf1-9-fonctions.test.ts` | 9 |

Après le run 205, deux de ces suites ont reçu un essai de plus. Aucune assertion n'a été retirée ni affaiblie :
- `cvf1-7` : le cas « mot de passe saisi, code administrateur absent ». Au run 205, l'admin « sans code » n'avait pas non plus saisi son mot de passe : il était refusé pour le mot de passe (`ADMIN_PASSWORD_REQUIRED`), et le code seul n'était pas éprouvé.
- `cvf1-6` : la suite de l'essai du numéro d'un admin, c'est-à-dire ce qui se passe s'il accepte l'invitation.
