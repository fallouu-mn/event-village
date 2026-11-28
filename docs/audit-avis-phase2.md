# Contre-vérification du lot « Avis », phase 2

Branche auditée : `origin/avis/phase2` à `1dc25b2f7` (rapport `docs/avis-phase2-rapport.md`, inventaire `docs/avis-inventaire.md` et
son annexe). Contre-vérification indépendante du 28/11/2026, sur la branche `avis/cv-rouges` (jamais fusionnée). Aucun appel au
projet distant, aucune migration appliquée, branche du lot non modifiée. Le rapport du lot n'a servi qu'à repérer ses affirmations :
chacune est revérifiée dans le code, par un script ou par un test. Résultats de la CI lus par l'API GitHub et les fichiers bruts.

Suites (rouge = trou, vert = attaque bloquée) :

- `tests/audit/cvavis2-1-trous.test.ts` (base locale) : T1 à T4 ;
- `tests/audit/cvavis2-2-gardes.test.ts` (base locale) : garde-fous G1 à G6 ;
- `tests/audit/cvavis2-3-statique.test.ts` (sans base) : T5 à T7, contrôles S1 à S3.

Runs rapides (mes trois suites seulement ; aucune construction locale, aucun run complet) :

| Run | Commit | Contenu | Résultat |
|---|---|---|---|
| 812 | `f1093a41b` | les trois suites | typecheck et lint OK ; **gardes 6/6 verts** ; statique : T5 (2), T6, T7 rouges pour la bonne raison, S1 (12), S2 (12), S3 verts ; trous : T1 (2), T3 (2), T4 rouges pour la bonne raison, T2 rouge par une erreur de MON test (succès tardif relu trop tôt : la route ne relit SamirPay qu'une fois par `STATUS_POLL_RECONCILE_SECONDS`) |
| 815 | `b27a40314` | trous (T2 corrigé) | 6/6 rouges pour la bonne raison |
| 817 | `772dd22d0` | trous (T3b : écriture du grand livre avancée avec la commission, gel exigé > 0 ; invariants financiers ajoutés) | **6/6 rouges pour la bonne raison** ; invariants financiers, accès, cycle et avis : 0 violation |

Journaux bruts : `ci-results/runs/812-46124442791/`, `815-46125589199/`, `817-46126190095/` (`test-logs/`).

## Verdict

**Pas de faille critique ; à corriger avant la fusion : T1, T2, T3 (moyens).** Le lot fait ce qu'il annonce pour l'essentiel :
onze types nouveaux, 25 types complétés, aucun canal enlevé du registre, recopies exactes, droits fermés, SMS d'un segment,
aucun test affaibli. Mais trois défauts touchent la règle du 27/11 ou l'argent : un plafond qui supprime des SMS qui partaient
avant (T1), un SMS qui affirme « Rien n'a été débité » trop tôt (T2), des commissions annoncées retirables qui ne le sont pas
(T3). T4 à T7 sont faibles ; T6 est à régler avec le 12d avant la fusion des deux lots.

| N° | Gravité | Constat | Point de la consigne |
|---|---|---|---|
| T1 | moyen | le plafond de 2 SMS par heure, étendu aux avis d'état, fait sauter des SMS qui partaient avant le lot (report après suspension et reprise ; clôture d'un événement) | 2, 3 |
| T2 | moyen | « paiement non abouti » envoyé 10 minutes après un échec qui n'est définitif qu'au bout de 2 h : « Rien n'a été débité. Réessayez » pour un paiement finalement débité | 4 |
| T3 | moyen | commissions annoncées « peuvent maintenant être retirées » alors qu'elles sont déjà retirées ou gelées (événement suspendu) | 4 |
| T4 | faible | anonymisation (D8) : le numéro effacé reste écrit dans la boîte d'envoi ; une reprise l'utiliserait encore | 5 |
| T5 | faible | garde de l'adresse (C3) : en production, n'importe quelle valeur de `EV_DEV_TUNNEL_URL` la lève, pour n'importe quelle adresse | 6 |
| T6 | faible | le SMS d'invitation d'un livreur mène à `/courier/invitations`, page qui n'existe ni ici ni dans le 12d | 9 |
| T7 | faible | garde-fou des mots (bloc e) : 8 formes de messages techniques passent (dont 4 sous une forme que le bloc dit lire) ; 68 messages SQL réels jamais lus | 7 |

Aucun trou critique. Aucun avis n'est enlevé, aucune écriture d'argent n'est ajoutée, les 12 recopies sont exactes, aucun test
existant n'est affaibli.

---

## 1. Trous, par gravité

### T1 (moyen) — plafond des avis d'état : des SMS qui partaient avant le lot sont sautés

**Constat.** Avant le lot, le plafond « 2 SMS d'avis par heure glissante » ne comptait que les reports (`EVENT_CHANGED`,
`20261121000006_cvf2b_plafond_heure_glissante.sql:147-158`) ; la suspension, la reprise et la clôture n'étaient jamais plafonnées.
Le lot compte ensemble les quatre types (`private.notif_holder_sms_count`, `20261230000001_avis_titulaires_table.sql:50-63`) et
applique le plafond aux trois avis d'état (`private.notif_holder_status_sms_cap`, lignes 69-82, appelée lignes 579, 609 et 756) et
au report (lignes 151-158 de la recopie d'`event_change_notify`). Conséquences, chaque fois pour un SMS qui partait avant :

- a. suspension puis reprise (2 SMS), puis report de l'événement dans l'heure : le SMS du report, qui annonce le remboursement
  possible, est sauté (`SKIPPED LAST_HOUR_CAP`) ;
- b. suspension, reprise, nouvelle suspension, puis clôture par l'administration : le SMS de clôture (`EVENT_CLOSED_HOLDER`,
  indispensable, SMS depuis le lot 9 bis) est sauté.

La règle du 27/11 (« on n'enlève aucun avis ») est enfreinte pour ces suites d'étapes. Le rapport du lot (point 6 de « À lire en
premier ») signale l'extension du plafond, mais pas qu'elle supprime le SMS de la clôture ni celui d'un report.

**Sortie brute.**

```
# run 817 — tests/audit/cvavis2-1-trous.test.ts
not ok 1 - a. suspension et reprise prévenues par SMS, puis report de 48 h dans l’heure : le SMS du report doit partir
  TROU : le SMS du report (remboursement possible) est sauté à cause des SMS de suspension et de reprise : [["EVENT_CHANGED","SMS","SKIPPED","LAST_HOUR_CAP"]]
not ok 2 - b. suspension, reprise, nouvelle suspension, puis clôture par l’administration : le SMS de clôture doit partir
  TROU : le SMS indispensable de la clôture est sauté (plafond des avis) : [["EVENT_CLOSED_HOLDER","SMS","SKIPPED","LAST_HOUR_CAP"]]
```

**Correctif proposé.** Garder le plafond tel qu'il était pour le report (ne compter que les `EVENT_CHANGED` dans
`event_change_notify`) et ne jamais plafonner le SMS de la clôture (`EVENT_CLOSED_HOLDER`) ni celui de la première suspension.
Si l'on veut quand même borner les bascules répétées, ne plafonner que la reprise et une nouvelle suspension, et seulement entre
elles (compter `EVENT_SUSPENDED_HOLDER` et `EVENT_REACTIVATED_HOLDER`, jamais `EVENT_CHANGED` ni `EVENT_CLOSED_HOLDER`).

### T2 (moyen) — « paiement non abouti » avant que l'échec soit définitif

**Constat.** `private.notif_payment_not_completed` (`20261230000005_avis_parrainage_paiement.sql:317-356`) met l'avis en file dès
que le paiement passe à `FAILED` ou `EXPIRED`, dû 10 minutes plus tard. Or un `FAILED` de SamirPay n'est définitif qu'au bout de
2 h (`lib/payments/confirmation.service.ts:226-230`, `PROVIDER_FAILED_GRACE_MS` : « un FAILED peut être l'expiration d'un paiement
qui redevient un succès ») et un `EXPIRED` reste surveillé par le cron des succès tardifs (même fichier, lignes 198-208). Le
déclencheur ne regarde ni `provider_final` ni ce délai ; `private.notif_payment_cart_paid` n'annule que les lignes encore en
attente. Entre la 10e minute et la 2e heure, un succès tardif arrive APRÈS le SMS « Rien n'a été débité. Réessayez » : la personne
a été débitée, et le message l'invite à payer une seconde fois (double paiement, remboursé plus tard par le circuit des doublons).

**Sortie brute.**

```
# run 817 — échec SamirPay (FAILED, provider_final faux), avis envoyé à 10 min, puis succès tardif du même paiement
not ok 1 - échec SamirPay non définitif, avis envoyé à 10 min (« Rien n’a été débité »), puis succès tardif du même paiement
  TROU : SMS « Rien n'a été débité. Réessayez » envoyé pour un paiement finalement débité : ["Event Village : paiement non abouti pour TEST Paiement cvavis2-t2 17... Rien n'a été débité. Réessayez : http://127.0.0.1:3000/tickets"]
```

**Correctif proposé.** Ne mettre l'avis en file que lorsque l'échec est définitif : déclencheur sur `provider_final` passé à vrai
(`FAILED` après le délai, `CANCELLED` exclu), ou échéance à `created_at + 2 h` au lieu de 10 minutes, avec annulation par
`notif_payment_cart_paid` (inchangée). À défaut, retirer « Rien n'a été débité » du texte (le SMS ne peut pas l'affirmer avant 2 h).

### T3 (moyen) — commissions annoncées disponibles alors qu'elles ne sont pas retirables

**Constat.** Le contrôle de 9 h (`notification_daily_checks`, recopie, `20261230000005_avis_parrainage_paiement.sql`, ajout des
lignes 178-217 de la fonction) annonce `REFERRAL_AVAILABLE` (« … de commissions de parrainage peuvent maintenant être retirés »,
SMS « Retirez-les ») pour toute commission `kind = 'COMMISSION'`, `status <> 'CANCELLED'`, dont `available_at` tombe dans la
journée. Il ne tient compte :

- ni d'une commission déjà retirée (`status = 'PAID'`, `paid_amount`) : une commission disponible hier à 10 h et retirée à 15 h est
  annoncée le lendemain à 9 h ;
- ni du gel : `fin_frozen_amount` (`20261110000005_lot9ter_argent.sql:293-305`) gèle les commissions d'un événement suspendu, et le
  retrait est refusé (`FUNDS_FROZEN`) ;
- ni des régularisations (`kind = 'REGULARISATION'`, remboursement partiel) : le montant annoncé est le montant brut.

**Sortie brute.**

```
# run 817
not ok 1 - a. commission devenue disponible puis déjà retirée (PAID) : jamais annoncée « disponible »
  TROU : commission déjà retirée annoncée « peuvent maintenant être retirés » (68.5 F) : [["REFERRAL_AVAILABLE","SMS","PENDING",null],["REFERRAL_AVAILABLE","EMAIL","SKIPPED","EMAIL_NOT_VERIFIED"],["REFERRAL_AVAILABLE","IN_APP","PENDING",null],["REFERRAL_AVAILABLE","PUSH","PENDING",null]]
[CVAVIS2-T3b] fonds de parrainage gelés à l'heure du contrôle : 68.5
not ok 2 - b. commission d’un événement suspendu (gelée, fin_frozen_amount) : jamais annoncée « disponible »
  TROU : commission gelée (événement suspendu) annoncée « peuvent maintenant être retirés » : [["REFERRAL_AVAILABLE","PUSH","PENDING",null],["REFERRAL_AVAILABLE","EMAIL","SKIPPED","EMAIL_NOT_VERIFIED"],["REFERRAL_AVAILABLE","IN_APP","PENDING",null],["REFERRAL_AVAILABLE","SMS","PENDING",null]]
```
Commissions, écritures du grand livre et événement remis dans leur état (`finally`) ; invariants financiers : 0 violation.

**Correctif proposé.** Annoncer le montant réellement retirable : ne compter que `status IN ('PENDING','AVAILABLE')`, le reste
`amount + régularisations − paid_amount`, et retirer les commissions dont l'événement (de l'écriture ou du paiement) est suspendu
(même règle que `fin_frozen_amount`) ; ne rien envoyer si le total est nul. Le plus simple : borner le montant par
`finance_account_balance(parrain, 'PARRAINAGE')->'withdrawable'` lu au même moment.

### T4 (faible) — anonymisation : le numéro effacé reste dans la boîte d'envoi

**Constat.** `AdminService.noticeBeforeAnonymization` (`lib/admin/admin.service.ts:327-355`) écrit le numéro du compte dans la ligne
SMS de `ACCOUNT_ANONYMIZATION_NOTICE` (`recipient_phone`), puis l'anonymisation efface le numéro de `users` (lignes 441-500) sans
toucher la boîte d'envoi. Le numéro qui « devait disparaître » reste donc lisible indéfiniment dans `notification_outbox`, et si
l'envoi immédiat a échoué, la reprise normale de l'envoyeur l'utilise encore après l'effacement. L'email, lui, n'est pas écrit dans
la ligne : sa reprise vise l'adresse technique du compte et est sautée (`NO_REAL_EMAIL`), sans rien envoyer.
Autre point : l'avis part AVANT les étapes qui peuvent échouer (pseudonymisation du journal, compte de connexion : lignes 394-439,
qui lèvent une erreur) ; si l'une échoue, la personne a reçu « votre compte est supprimé » alors qu'il ne l'est pas.

**Sortie brute.**

```
# run 817 — après AdminService.anonymizeUser (numéro du compte effacé)
not ok 1 - après anonymizeUser, aucune ligne de la boîte d’envoi ne garde l’ancien numéro ni l’ancienne adresse
  TROU : donnée effacée par l'anonymisation encore écrite dans la boîte d'envoi : [{"type":"ACCOUNT_ANONYMIZATION_NOTICE","channel":"EMAIL","status":"SENT","recipient_phone":"+221775136730","recipient_email":null},{"type":"ACCOUNT_ANONYMIZATION_NOTICE","channel":"SMS","status":"SENT","recipient_phone":"+221775136730","recipient_email":null}]
```
(`notif_enqueue` écrit le numéro donné dans CHAQUE ligne, la ligne email comprise.)

**Correctif proposé (réponse à « le numéro doit-il rester ? » : non).** À la fin d'`anonymizeUser`, une seule écriture :
lignes de la boîte d'envoi du compte (`recipient_user_id`) → `recipient_phone` et `recipient_email` remplacés par `NULL` (ou par
la forme masquée `*** ** 67` déjà utilisée dans le journal) ; lignes encore `PENDING` ou `SENDING` → `CANCELLED`, motif
`ACCOUNT_ANONYMIZED`. Pour que l'avis ait quand même sa chance : une seule tentative immédiate (déjà faite), pas de reprise après
l'effacement. Et déplacer l'avis après la dernière étape qui peut échouer (juste avant l'effacement de `users`), pour ne jamais
annoncer une suppression qui n'a pas eu lieu.

### T5 (faible) — garde de l'adresse : exemption du tunnel non bornée

**Constat.** `appUrlStartupProblem` (`lib/notifications/app-url-guard.ts:16-24`) rend `null` dès que `EV_DEV_TUNNEL_URL` n'est pas
vide (ligne 18), sans vérifier que l'adresse de l'application EST celle du tunnel, ni que c'est un tunnel `*.trycloudflare.com`.
Une variable oubliée (ou mise à « oui ») sur le serveur de production suffit à démarrer avec une adresse de 45 caractères : tous les
SMS mesurés à 150-158 caractères passent en deux segments. Le refus « en production » est donc contournable par une variable de
développement. (`scripts/dev/cron-local.core.mjs:82-89` borne bien le tunnel : https et `<nom>.trycloudflare.com`.)

**Sortie brute.**

```
# run 812 — tests/audit/cvavis2-3-statique.test.ts
not ok 1 - production, adresse de 45 caractères, EV_DEV_TUNNEL_URL quelconque (« oui ») : le démarrage doit être refusé
  TROU : en production, une valeur quelconque de EV_DEV_TUNNEL_URL lève la garde pour une adresse de 45 caractères (SMS en deux segments)
not ok 2 - production, tunnel déclaré mais adresse de l’application différente et longue : refus attendu
  TROU : l’exemption du tunnel couvre aussi une adresse qui n’est pas celle du tunnel
```
Témoin vert : la même adresse sans la variable est bien refusée.

**Correctif proposé.** Exempter seulement si `NEXT_PUBLIC_APP_URL` (sans « / » final) est égale à `EV_DEV_TUNNEL_URL` ET
correspond à `^https://[a-z0-9-]+\.trycloudflare\.com$` (la ligne 20 le fait déjà pour l'adresse seule) ; supprimer la ligne 18.

### T6 (faible) — lien du SMS d'invitation d'un livreur

**Constat.** Le SMS ajouté à `ORDER_COURIER_INVITED` (B6, `lib/notifications/catalog.ts:2136`) finit par
`https://app.eventvillage.sn/courier/invitations`. Aucune page `app/courier/invitations/page.tsx` n'existe, ni sur `avis/phase2`, ni
sur `lot12d/livreur-admin` (`bbe9fec97`), qui n'apporte que `app/courier/invitations/[id]/page.tsx`. Le rapport du lot (point 3)
dit « la page arrive avec le 12d » : c'est vrai pour le lien de la cloche (`/courier/invitations/<id>`), faux pour celui du SMS.
Après la fusion des deux lots, le livreur qui touche le lien du SMS tombe sur une page introuvable.

**Sortie brute.**

```
# run 812
not ok 1 - le chemin du SMS ORDER_COURIER_INVITED est une page de l’application
  TROU : le SMS mène à /courier/invitations : aucune page (app/courier/invitations/page.tsx), ni ici ni sur lot12d/livreur-admin (seulement /courier/invitations/[id]) — « Event Village : Chez Fatou, cuisine du Sénégal et gri... vous invite à livrer ses commandes. Répondez : https://app.eventvillage.sn/courier/invitations »
$ git cat-file -e origin/lot12d/livreur-admin:app/courier/invitations/page.tsx
fatal: path 'app/courier/invitations/page.tsx' does not exist in 'origin/lot12d/livreur-admin'
```

**Correctif proposé.** Ajouter dans le 12d une page `/courier/invitations` (liste des invitations en attente du compte, ou
redirection vers la seule invitation en attente), ou faire pointer le SMS vers `/courier/orders` si cette page montre les
invitations. Le SMS tient à 151 caractères au pire cas ; un identifiant complet ne tiendrait pas.

### T7 (faible) — garde-fou des mots (bloc e) : formes qui passent

**Méthode.** Le VRAI test `tests/schema/design1b-mots.test.ts` est lancé sur une copie de l'arbre (app, components, lib, hooks,
e2e/support, migrations) où j'ai introduit douze messages techniques sous des formes différentes. Trois témoins (formes que le
bloc dit lire) sont bien attrapés ; le test échoue donc sur la copie. Mais huit formes passent :

| Forme introduite | Dans ce que le bloc dit lire ? | Résultat |
|---|---|---|
| route : `{ error: 'Payload invalide.' }` (témoin) | oui | attrapé |
| route : `{ error: ok ? 'Payload invalide.' : '…' }` | **oui** (propriété `error`) | **passe** |
| route : `const MSG = 'userId requis.'` puis `{ error: MSG }` | oui (message renvoyé) | **passe** |
| route : `new Response('Invalid token', { status: 401 })` | non annoncé | **passe** |
| route : `{ error: 'event_id requis.' }` (identifiant en snake_case) | oui (identifiant de variable) | **passe** |
| export CSV d'une route : `EN_LIGNE;VALIDE` | non (seuls deux exports ciblés) | **passe** |
| SQL : `RAISE … USING MESSAGE = 'Payload invalide.'` (témoin) | oui | attrapé |
| SQL : `RAISE EXCEPTION 'Payload invalide : user_id requis'` | **oui** (« RAISE … ») | **passe** |
| SQL : `jsonb_build_object('ok', false, 'error', 'Invalid payload')` | oui (réponse) | **passe** |
| écran : `setError(err.message)` (témoin) | oui | attrapé |
| écran : `setError((err as Error).message)` | **oui** (erreur affichée) | **passe** |
| écran : `setError((e as Error)?.message ?? 'Réessayez.')` | **oui** | **passe** |

Dans le code réel, la forme classique `RAISE EXCEPTION '…'` n'est jamais lue : 68 messages de dernières définitions contiennent un
code ou un identifiant (`CONTROLLER_HAS_OPEN_SHIFT : le contrôleur % a une caisse ouverte`, `EVENT_ZONES_REFUSED`,
`revoke_user_sessions : p_user_id requis`, `finance_compute : aucune ligne`…). Ce sont surtout des gardes internes ; je n'en ai
pas trouvé un qui arrive tel quel à l'écran (`CONTROLLER_HAS_OPEN_SHIFT` est traduit par `app/api/admin/users/route.ts:466-491`),
mais le garde-fou ne le garantit pas. Les exceptions (`EXCEPTIONS_E`, texte exact par fichier ; `OPERATOR_FILES`) ne sont pas trop
larges : chacune est un texte exact, et les deux fichiers du catalogue exclus sont relus rendus au bloc a.

**Sortie brute.**

```
# run 812 — le vrai tests/schema/design1b-mots.test.ts lancé sur la copie modifiée
[CVAVIS2-T7] code de sortie du garde-fou : 1
attrapé  route : texte direct (témoin)
PASSE    route : texte dans un ternaire
PASSE    route : texte dans une constante
PASSE    route : corps texte de new Response
PASSE    route : identifiant en snake_case
PASSE    export CSV : codes bruts
attrapé  SQL : RAISE … MESSAGE = (témoin)
PASSE    SQL : RAISE EXCEPTION '…' (forme classique)
PASSE    SQL : clé « error » d’une réponse
attrapé  erreur affichée : setError(err.message) (témoin)
PASSE    erreur affichée : setError((err as Error).message)
PASSE    erreur affichée : setError(e?.message ?? …)
  TROU : formes de messages techniques qui passent le garde-fou des mots : …
```
Recherche dans le code réel (script local, motifs du bloc e appliqués aux formes non lues) : `SQL : 68 messages échappés`, par
exemple `RAISE EXCEPTION '…' public.controller_removal_guard [CONTROLLER_HAS_OPEN_SHIFT] « CONTROLLER_HAS_OPEN_SHIFT : le
contrôleur % a une caisse ouverte »`, `public.event_create [EVENT_ZONES_REFUSED] « EVENT_ZONES_REFUSED »`,
`public.revoke_user_sessions « revoke_user_sessions : p_user_id requis »`.

**Correctif proposé.** Dans le bloc e : lire tous les littéraux sous la valeur de `error` / `message` / `details` (ternaires,
concaténations, `??`), suivre une constante du même fichier, lire le premier argument de `new Response(…)` ; ajouter au motif
SQL `RAISE EXCEPTION '…'` et la clé `'error'` ; ajouter `SNAKE_RE` (identifiant en minuscules avec tiret bas) aux mots
interdits des messages ; pour les erreurs affichées, accepter `(err as Error).message` et `?.message` dans l'expression régulière.
Laisser les gardes internes en anglais technique seulement si elles sont listées (fichier, texte exact), comme les autres
exceptions.

---

## 2. Garde-fous verts (vérifiés par moi ; G1 à G6 et S1 à S3 verts au run 812)

| Point | Vérification | Résultat |
|---|---|---|
| 1. Recopies | script indépendant (dernière définition d'avant le lot cherchée avec ou sans schéma, comparaison ligne à ligne) puis S2 | 12 fonctions, une recopie chacune, sources = celles du rapport ; 0 ligne perdue, sauf la ligne déclarée de `cashouts_simulation_guard` (`SIMULATION_MISMATCH`) |
| 1. Lot 12d | fonctions redéfinies par `lot12d/livreur-admin` (20261228000001-006) | aucune fonction commune avec le lot ; aucun type du registre touché par les deux |
| 1. Droits | G1 (`has_function_privilege` en base) | 15 fonctions `private` fermées à anon, authenticated et service_role ; recopies publiques jamais ouvertes à anon ni authenticated |
| 1. 03-verification | journal brut du run complet 799 (`test-logs/tests__schema__hotfix-scripts.test.ts.log`) | 20 points OK sur 20 |
| 2. Canaux des types | catalogue de `f7bf7ad94` comparé à celui de la branche (script) | 175 → 186 types, aucun type disparu, aucun canal perdu, 25 types avec un canal de plus ; registre en base = catalogue (G6) |
| 2. Émetteurs | recherche des émetteurs qui imposent leurs canaux pour les 25 types complétés | seul `account_phone_finalize` (PHONE_CHANGED), qui ajoute bien la cloche et la notification |
| 2. Doublons | lecture du code + tests du lot relus | retrait versé dans les 2 minutes : SMS d'accusé annulé (`notif_withdrawal_ack_paid`) ; remboursement de commande bloqué : ligne SMS sautée `GROUPED_ADMIN_SMS`, comptée une fois dans `ADMIN_MONEY_SMS` (les trois états ont leur alerte `ADMIN_REFUND_TO_RETRY` / `ADMIN_CASHOUT_UNCERTAIN`, `20261130000006_l12a_etapes.sql:1245-1418`) ; abonnement : `SUBSCRIPTION_ACTIVATED` sans SMS ; billet reçu : SMS seulement à l'acceptation ; titulaire qui garde un billet : même clé |
| 3. Nuit | G5 : SMS de suspension réservé à 2 h 30 (Dakar) | événement lointain : reporté (`NIGHT`) ; événement dans moins de 12 h : envoyé |
| 3. Préférences | G4 | suspension envoyée malgré « Reprise d'un événement » coupée ; reprise coupée ; rappels de table toujours facultatifs (`REMINDERS`) |
| 4. Accusé de retrait | G2 (deux organisatrices) | chacune ne reçoit que son accusé ; données = montant, opérateur, moyen, sorte de compte, références ; aucun numéro dans la ligne ni dans les données |
| 4. Annulation par la personne | G3 (SamirPay `CANCELLED`) | aucun avis « paiement non abouti » |
| 4. Argent | S3 | aucune écriture sur les tables d'argent dans les migrations du lot (les seules écritures de `tickets` sont les lignes recopiées d'`account_phone_finalize`) |
| 5. Filleul | lecture du code (`notif_referral_signup` : `data = {}`) + test du lot | jamais le nom ni le numéro du filleul |
| 5. Titulaire de table | lecture des textes des avis aux invités (`TRANSFER_OFFERED`, `TRANSFER_RECEIVED`) | aucun nom ni numéro du titulaire |
| 6. SMS | S1 : mesure indépendante, textes de 110 caractères avec ç, ê, ’, « », –, emoji, €, crochets ; 9 999 999 F ; compteurs à 999 ; adresse de 27 caractères | 12 types, toutes variantes ≤ 158 septets, aucun caractère hors GSM-7 (le pire : `ADMIN_MONEY_SMS` à 158) |
| 8. Tests modifiés | comparaison assertion par assertion des 25 fichiers modifiés (diff de `f7bf7ad94`) | aucun affaibli ; chaque nombre de lignes changé (2 → 3, 2 → 4) correspond à un canal ajouté et les canaux exacts sont vérifiés dans le même test ; aucun fichier de `tests/audit/` ni `tests/audit-auth/` touché ; aucun `skip` |
| 9. Liens | script : lien de la cloche et du SMS de chaque type, rendu avec son exemple, comparé aux pages de `app/` | tous mènent à une page existante, sauf les liens du livreur (pages du 12d) et le SMS de T6 |

## 3. Points écartés après vérification

- **Nom complet dans les données de la cloche.** `SHIFT_DISCREPANCY` et les avis d'équipe gardent `controller_name` complet dans
  `template_data`, que `GET /api/notifications` renvoie au navigateur (`metadata`, `app/api/notifications/route.ts:74-88`). Écarté :
  l'organisatrice voit déjà le nom complet de ses contrôleurs dans son pilotage (`pilotage_display_name` = prénom et nom). Le texte
  affiché est bien « Fatou S. » partout (cloche, SMS, email, notification).
- **Accusé de retrait au mauvais compte.** `withdrawals.user_id` est toujours le compte de la session (`app/api/withdrawals/request`),
  et le lien suit la sorte de compte (`/wallet/retraits/<id>` pour un parrain, page présente).
- **Panier qui change de clé.** Les réservations de stock ne sont jamais supprimées (statut `RELEASED` / `CONVERTED`) : la clé du
  panier d'un paiement de billets est stable, « une fois par panier » tient.
- **SMS regroupé « argent à vérifier » et SMS d'origine.** Aucune des six alertes n'a de SMS propre : pas de double SMS.

## 4. Observations (à décider, non bloquantes)

1. `ACCOUNT_ANONYMIZATION_NOTICE` part la nuit (`SEND`) : une anonymisation faite à 3 h envoie un SMS à 3 h. Rien d'urgent pour la
   personne : `DEFER` conviendrait, si l'avis est déplacé après l'effacement (T4).
2. Poste d'un contrôleur changé puis remis à l'identique dans la même transaction (porte A → B → A) : le déclencheur différé voit
   chaque mise à jour avec son propre `OLD` ; la seconde annonce « votre porte est maintenant A » alors que rien n'a changé
   (`20261230000002_avis_nouveaux_simples.sql:199-211`).
3. SMS des validations : « 1 demande(s) de partenaire et 999 événement(s) et 999 produit(s) attendent… » (deux « et ») ; tient
   en un segment.
4. Paiement non abouti d'un achat de billets : la cloche mène à l'événement, le SMS à `/tickets`.
5. Nuit des canaux ajoutés (registre en base, G6) : la notification ajoutée à `ADMIN_FINANCE_DEBT` et aux plafonds de SMS
   (`ADMIN_SMS_CAP_*`) part la nuit (`SEND`), alors que celle des autres alertes d'administration (B11) est reportée ; le SMS
   ajouté à `PAYMENT_SUCCESS` part la nuit aussi (la personne vient de payer : acceptable).
6. Rapport du lot : « + 9 exclusions » à G.49 dans `email-regle-envoi` (il y en a 8 ; `NEW_ORDER` est une exception de G.50) ;
   « la page arrive avec le 12d » pour le SMS du livreur (faux, T6).

## 5. Fin

Branche `avis/cv-rouges` (jamais fusionnée) : suites `tests/audit/cvavis2-1-trous.test.ts`, `cvavis2-2-gardes.test.ts`,
`cvavis2-3-statique.test.ts` et ce rapport. Rien de changé sur `avis/phase2`, aucune migration appliquée, aucun appel au projet
distant. Fiches, préférences, commissions, écritures du grand livre et événements modifiés par les tests remis dans leur état
(invariants de fin de suite : 0 violation). Dossier `event-village-cvavis2` retiré après la poussée (jonction `node_modules`
d'abord, `cmd /c rmdir`) ; `.env.test` local (copie de l'exemple, ignoré par git) retiré avec lui.
