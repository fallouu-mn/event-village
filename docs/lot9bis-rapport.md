# LOT 9 BIS — RAPPORT

**Objet :** corrections du cycle de vie des événements (revue critique R1 à R109 de `docs/parcours-evenement-complet.md`), points 10.0 a) à f) repris du lot 10, l'email comme vrai canal, conformité à l'API SamirPay v1.2 (H1 à H9), mode réel sûr depuis le poste (I1 à I5). **Branche :** `lot9bis/cycle-evenement`, depuis `931f4fa`. `main` n'a pas bougé (`7cca60f`). Aucun test n'a tourné contre un projet Supabase distant ; `.env.local` n'a pas été lu ; aucun passage du document SamirPay v1.2 (`.private/`) n'est recopié ici, seulement des noms de champs, de codes et de statuts. **Date :** 12 novembre 2026.

---

## À lire en premier

1. **Verdict : VERT.** Run « après » 125 (`a8e49e3`) : verify 307/307, e2e vert, 10 phases sur 10 (connexion, captures, emails, dev-page, fumée, terrain, PWA, fake-prod, perf, recette), invariants (a) à (w) à 0 sur toutes les suites ; les 2 seules lignes non nulles sont les divergences fabriquées de pilotage-invariant (transaction annulée, détection prouvée). Le code d'application est celui du run 121 (`cb35f7b`) : depuis, seuls des tests ont changé (`fb1f0b3`, `c0b0b96`, `368a11c`, `ba75bfc`, `725688d`, `a8e49e3`).
2. **Avant / intermédiaires.** Run 118 (`44d850c`, avant) : 181 suites sur 307, 126 rouges (110 attendus, 10 pour une mauvaise raison, 6 non attendus, tous instruits). Run 119 (`b2892ab`) 182/307 ; run 120 (`78b32ac`) 287/307 ; run 121 (`cb35f7b`) 304/307, e2e vert ; runs 123 (302/307) et 124 (306/307) rouges seulement par des montages de tests, corrigés (`725688d`, `a8e49e3`).
3. **Revue R1 à R109 :** 94 traités (dont R5 et R59 avec une partie non reproduite, R95 et R106 en partie), 1 décision écrite (R24), 1 non reproduit (R81), 13 renvoyés. **H1 à H8 corrigés ; H9 = section 3.**
4. **Trois défauts graves hors revue, corrigés :** le client SamirPay lisait `data` au lieu de `body` (solde, transferts) ; les liens Orange `urls.OM` et `urls.MAXIT` n'étaient pas lus ; un 409 de `/payments/send` était classé refus, donc renvoyable : double versement possible. Corrigés par `c83c2ba` (H5) et `72c4b22` (H7).
5. **À faire de ton côté, AVANT les migrations :** la requête des admins et de leurs permissions (section 5). Après la migration 4, un ADMIN sans permission perd le pilotage, les remboursements et les équipes (B32 : aucune permission donnée d'office).
6. **Puis :** appliquer les 12 migrations `20261109000001` à `…12` sur event-village-dev, dans l'ordre, et déployer l'application dans la même fenêtre (sans la 12, tout SMS, email et push reste « à réessayer »).
7. **Avant toute séance réelle :** les 11 points du bac à sable SamirPay (section 3.3), `npm run essai:check-reel`, puis `docs/essai-local.md` section 13.
8. **Invariant modifié, à relire :** (b) du lot 2 admet désormais un billet UTILISE dont le paiement est REFUNDED, sur un événement ANNULE seulement (`f7d7d56`, R48 + R1). Section 9.3.
9. **Tests existants modifiés :** T1 à T64 du contrat, T65, 37 commits d'adaptation hors section 9 et 9 corrections de montage, chacun avec sa raison (section 9). Aucune assertion retirée sans que le commit le dise.
10. **Écarts au contrat :** refus de démarrer en réel par `process.exit(1)` et non `throw` (`cb35f7b`, contrat 4.7) ; `retryRefund` et `resumeUnsentRefunds` gardés (contrat 5.1) ; fiche partenaire verrouillée en `FOR NO KEY UPDATE` ; `fix(9b.34-SB)` sans commit propre ; délai CI 75/65 min (`44d850c`). Section 18.
11. **Décisions ★ :** B1, B2, B12, B14, B16, B23, B28, B30, B31, B32, B35, B45, B47, B51, B62, B71, B74, B96, B97, B101, B108 ; et S10, S11, S13 de l'orchestrateur (section 17).
12. **À relire par un humain :** captures (relues par un agent au run 121 : 15 défauts, aucun bloquant, 1 corrigé, section 12) ; deux textes faux restés dans l'application (`InvitationsTab.tsx:449`, « Motif du refus » à la clôture).
13. **Restent ouverts (section 19) :** détenteur d'un billet déjà transféré non prévenu au remboursement ; risque w19 ; « Versements à reprendre » muet sur le simulé en réel ; `successUrl`/`errorUrl` non envoyés.
14. **Arrêt :** le lot 10 n'est pas commencé.

---

## 1. Runs « avant », intermédiaires et « après »

Source : branche `origin/ci-results`, fichiers `runs/<n>-<id>/run.txt`, `verify.log`, `e2e.log`, `js-budget.tsv`. Les journaux bruts du run « avant » sont dans `docs/lot9bis-logs/ci-run118-*`, son triage dans `docs/lot9bis-logs/ci-run118-triage.txt`.

| Run | Rôle | SHA | verify | e2e | Job | verify (s) | e2e (s) |
|---|---|---|---|---|---|---|---|
| 118 (`42942347516`) | avant | `44d850c` | 181/307 (126 rouges) | rouge (captures, fake-prod) | 2 793 s, échec | 949 | 1 566 |
| 119 (`43057618536`) | intermédiaire | `b2892ab` | 182/307 | rouge (graine : connexion, captures, fumée, terrain, fake-prod, perf, recette) | 2 445 s, échec | 1 064 | 474 |
| 120 (`43079518412`) | intermédiaire | `78b32ac` | 287/307 | rouge (captures, fumée, fake-prod, perf, recette) | 3 924 s, échec | 1 392 | 2 195 |
| 121 (`43105187110`) | intermédiaire | `cb35f7b` | 304/307 | **vert**, 10 phases | 3 440 s, échec (verify) | 1 451 | 1 633 |
| 122 | annulé | `368a11c` | — | — | annulé par la CI (`cancel-in-progress`) à la poussée de `ba75bfc` | — | — |
| 123 (`43115311442`) | intermédiaire | `ba75bfc` | 302/307 | **vert**, 10 phases | 2 907 s, échec (verify) | — | — |
| 124 (`43122046637`) | intermédiaire | `725688d` | 306/307 | **vert**, 10 phases | échec (verify) | — | — |
| 125 (`43128293638`) | **après** | `a8e49e3` | 307/307 | vert, 10 phases sur 10 (connexion, captures, emails, dev-page, fumée, terrain, PWA, fake-prod, perf, recette) | 2 973 s, succès | 1232 | 1487 |

**Run 118, lecture du triage** (`docs/lot9bis-logs/ci-run118-triage.txt`) : 126 rouges, dont 110 attendus pour la bonne raison, 10 attendus mais en partie pour une mauvaise raison, 6 non attendus. Quatre causes de fond : (A) `lot9bis-verrou-numero` laissait 3 comptes au numéro différent entre `public.users` et `auth.users`, l'invariant (v) tombait dans 25 suites ; (B) le quota `PARTNER_REGISTER_PER_IP_HOUR` saturé par l'inscription en deux appels sans IP ; (C) des routes montées avec des `params` synchrones (404) ; (D) cas isolés. Toutes corrigées par les montages de la section 9.4. Invariants (a) à (u) à 0, (v) 3 violations (cause A). Aucune ligne w1 à w21 évaluée au run 118 : la garde de schéma s'arrêtait avant (29 objets manquants), ce qui ne prouve rien pour w8 à w11 et w17. e2e : 32 captures en échec, toutes nouvelles ou modifiées (T9), fake-prod rouge attendu (I3 absent) ; fumée et recette vertes sur l'ancien code (X25 tenu).

**Run 121, les 3 rouges** (`S/triage-121-43105187110.txt`) : `notif-outbox` (REMINDER_H3 : 4 lignes, EMAIL en plus), `pilotage-cloture-export` (fin placée dans le futur par le garde-fou de `7bd0ffb`), `essai-reel-demarrage` (le test attendait une exception, le code sort en code 1). Corrigés par `c0b0b96`, `368a11c`, `fb1f0b3` (section 9.2). e2e du run 121 : connexion 10/10, captures 387 passées et 41 ignorées (391 entrées, 0 en échec), emails 7/7, fumée 2/2 (toutes les étapes), terrain 13/13, pwa 4/4, fake-prod conforme dans les trois lancements, perf 4/4, recette 9/9 actes. Durée e2e 1 633 s (27,2 min).

**Run 123, 5 rouges, une seule cause** : `textes-base-9bis`, `textes-pdf-9bis`, `versements-frais`, `versements-reprise` et `migration-lot9bis-rejouable` ont tous leurs cas verts, mais leur `after()` tombe sur une même violation **w20** (« remboursement de billet demandé par l'organisateur après la fin »). Cause : `shiftEventDates` (`tests/parcours/cycle-helpers.ts`) tronque l'heure à la seconde, et la fin placée 500 ms après le remboursement par `368a11c` pouvait retomber avant lui. Corrigé par `725688d` (fin sur une seconde ronde, au moins 1 s après le remboursement). Aucun code d'application en cause.

**Run 124, 1 rouge** : `decouverte-populaires`, « ordre de la RPC, et même carte que le catalogue » : la première carte du catalogue avait `endFormatted`, pas celle des populaires. R36 (contrat 5.25) ne sert cette clé que si une fin est saisie : la comparaison des premières cartes dépendait des événements en tête (vert aux runs 120, 121 et 123). Corrigé par `a8e49e3` (comparaison sur un même événement des deux listes). Aucun code d'application en cause.

**Run 125, après** : 307/307, e2e vert dans ses 10 phases, job en succès. Les deux seules lignes `[INVARIANT…]` à violation non nulle sont celles de `pilotage-invariant` marquées « sur le jeu » : divergences fabriquées dans une transaction annulée, pour prouver que (l) les détecte (`tests/parcours/pilotage-invariant.test.ts:106` et suivantes).

**Après le run 121**, un seul commit a touché l'e2e : `ba75bfc` (bouchon des frais de « Versements à reprendre », relecture des captures). Le run « après » le couvre.

---

## 2. Tableau R1 à R109

Colonnes : statut ; tâche de la consigne ; commit du test rouge (les commits de « correction de montage » sont en section 9.4) ; commits de correctif (serveur, délégués au propriétaire d'un fichier partagé, puis écran) ; état et test principal, recopiés de la colonne « État au lot 9 bis » de la revue (`docs/parcours-evenement-complet.md`, section finale, mise à jour par `0f534dc`). « Renvoyé » : R56, R65, R82, R83, R108 au lot 13 ; R64, R68, R89, R99, R101 au lot 14 (consigne, F) ; R49, R93, R96 et R106 hors argent, lot à désigner par le chef de projet (A14). R95 : le retrait de validation, la publication par la partenaire, les prix et les canaux restent sans alerte, signalé.

Bilan : 94 traités, 1 décision écrite (R24), 1 non reproduit (R81), 13 renvoyés. Parties non reproduites, avec preuve : R1 (« requête interrompue », couverte par la reprise de tous les versements), R5 (retrait déjà refusé à un compte suspendu, `M/20261101000014_lot4_correctif_retraits_concurrents.sql:63-71`), R59 (l'entrée ne lit pas le statut du porteur, `M/20261108000005_lot9_nettoyage.sql:104`, `:141`), R69 (défaut de lecture prouvé par le code, test statique), R81 (`event_notify` déjà supprimée, `tests/parcours/notif-migration.test.ts:343`), R104 (historique « Envoyée » gardé, décision L7 du lot 9).

**R106, vérifié au code :** la partie argent est livrée par la tâche 7 (`e2471ce`, `00aab1c`). La commission d'un billet est disponible à la fin de l'événement plus `finance.referral_availability_days` (7 par défaut), `supabase/migrations/20261109000007_lot9bis_versements.sql:849`, `:851`, `:909`, `:947` ; les lignes existantes sont reprises par `referral_commissions_realign` (M07, puis une seconde passe en fin de M08, `00aab1c`). Le reste de R106 (événement validé jamais publié resté « Validé », deux rapports de clôture différents, « Retraits en cours » au net) n'est pas traité : renvoyé, lot à désigner.

| R | Statut | Tâche | Rouge | Correctif(s) | État et test |
|---|---|---|---|---|---|
| R1 | traité | 1 | `a53a095` | `9fae4dd`, `804aeb0`, `0fdc4b1`, `b148c30`, `d11f790`, `65fbb75`, `472855f`, `423a15a` | corrigé au lot 9 bis (tâche 1, `tests/parcours/versements-reprise.test.ts`) ; le cas « requête interrompue » n'est pas reproduit tel quel, il est couvert par la reprise de tous les versements |
| R2 | traité | 11 | `b779914` | `0de99c2`, `a4d30a2`, `d3b9ed0`, `72de786`, `bff5894`, `08405b0`, `ab5c7ac`, `903fe54` | corrigé au lot 9 bis (tâche 11, `tests/parcours/droits-partenaire-9bis.test.ts`) |
| R3 | traité | 20 | `b2aaec3` | `4304f45`, `f1618d9` | corrigé au lot 9 bis (tâche 20, `tests/parcours/cycle9bis-cloture-admin.test.ts`) |
| R4 | traité | 2 | `c644cf2` | `c1b2d71`, `a5f74d5`, `0beaa9f`, `e4ea7fd`, `1376185`, `0bc19aa`, `a9bc648` | corrigé au lot 9 bis (tâche 2, `tests/parcours/lot9bis-fonds-suspension.test.ts`) |
| R5 | traité, partie non reproduite | 2 | `c644cf2` | `c1b2d71`, `a5f74d5`, `0beaa9f`, `e4ea7fd`, `1376185`, `0bc19aa`, `a9bc648` | corrigé au lot 9 bis (tâche 2, `tests/parcours/lot9bis-fonds-suspension.test.ts`) ; non reproduit pour la partie « retrait » : un retrait demandé était déjà refusé à un compte suspendu (`M/20261101000014_lot4_correctif_retraits_concurrents.sql:63-71`) |
| R6 | traité | 15 | `b74e957` | `36e4cff`, `28769f7`, `e59002b` | corrigé au lot 9 bis (tâche 15, `tests/parcours/fiche-partenaire-9bis.test.ts`) |
| R7 | traité | 16 | `bccb5de` | `f9ccdf5`, `69d284e`, `c276fcf` | corrigé au lot 9 bis (tâche 16, `tests/parcours/partenaire-en-attente.test.ts`) |
| R8 | traité | 8 | `713dccc` | `ce6b147` | corrigé au lot 9 bis (tâche 8, `tests/parcours/lot9bis-abonnement.test.ts`) |
| R9 | traité | 1 | `a53a095` | `9fae4dd`, `804aeb0`, `0fdc4b1`, `b148c30`, `d11f790`, `65fbb75`, `472855f`, `423a15a` | corrigé au lot 9 bis (tâche 1, `tests/parcours/versements-reprise.test.ts`) |
| R10 | traité | 1 | `a53a095` | `9fae4dd`, `804aeb0`, `0fdc4b1`, `b148c30`, `d11f790`, `65fbb75`, `472855f`, `423a15a` | corrigé au lot 9 bis (tâche 1, `tests/parcours/versements-reprise.test.ts`) |
| R11 | traité | 3 | `61384b0` | `9f15896`, `12ace48`, `0a8043f` | corrigé au lot 9 bis (tâche 3, `tests/parcours/lot9bis-remboursement-fin.test.ts`) |
| R12 | traité | 30 | `88306a8` | `45ba69f`, `03401a6` | corrigé au lot 9 bis (tâche 30, `tests/parcours/messages-annulation-9bis.test.ts`) |
| R13 | traité | 31 | `36bf73a` | `b55ea7c` | corrigé au lot 9 bis (tâche 31, `tests/parcours/messages-annulation-9bis.test.ts`) |
| R14 | traité | 32 | `379120a` | `a8e2e8c` | corrigé au lot 9 bis (tâche 32, `tests/parcours/messages-changement-9bis.test.ts`) |
| R15 | traité | 33 | `429ab6a` | `596db36` | corrigé au lot 9 bis (tâche 33, `tests/parcours/messages-acteurs-9bis.test.ts`) |
| R16 | traité | 21 | `0d1bff4` | `c3dfe24`, `f1a214d`, `bc82374` | corrigé au lot 9 bis (tâche 21, `tests/parcours/cycle9bis-fenetre-scan.test.ts`) |
| R17 | traité | 22 | `099cdcf` | `4c88049`, `e748633`, `8bb2bbd`, `e94540d` | corrigé au lot 9 bis (tâche 22, `tests/parcours/cycle9bis-caisse.test.ts`) |
| R18 | traité | 36 | `68d16c1` | `2b68541` | corrigé au lot 9 bis (tâche 36, `tests/parcours/messages-changement-9bis.test.ts`) |
| R19 | traité | 23 | `f118183` | `68be19e`, `43022f7`, `adf089f`, `594dcbe`, `5244710` | corrigé au lot 9 bis (tâche 23, `tests/parcours/cycle9bis-transfert.test.ts`) |
| R20 | traité | 4 | `82976f0` | `d8b41f6`, `2c390de`, `7d375de` | corrigé au lot 9 bis (tâche 4, `tests/parcours/lot9bis-guichet-annulation.test.ts`) ; Essai 46 réécrit |
| R21 | traité | 41 | `b5eafc3` | `b3039d6` | corrigé au lot 9 bis (tâche 41, `tests/schema/textes-techniques-9bis.test.ts`) |
| R22 | traité | 34 | `b5efb17` | `c962841`, `3eb18bf` | corrigé au lot 9 bis (tâche 34, `tests/parcours/messages-comptes-9bis.test.ts`) |
| R23 | traité | 34 | `b5efb17` | `c962841`, `3eb18bf` | corrigé au lot 9 bis (tâche 34, `tests/parcours/messages-comptes-9bis.test.ts`) |
| R24 | décision écrite | 35 | `7581504` | — | corrigé au lot 9 bis par décision écrite (tâche 35) : suspension et réactivation restent en cloche et push, plus l'email ; aucun SMS ; la suite définitive (annulation, fin) part en SMS |
| R25 | traité | 24 | `362856d` | `bc7f429`, `6de12bf` | corrigé au lot 9 bis (tâche 24, `tests/parcours/cycle9bis-carte-billet.test.ts`) |
| R26 | traité | 32 | `379120a` | `a8e2e8c` | corrigé au lot 9 bis (tâche 32, `tests/parcours/messages-changement-9bis.test.ts`) |
| R27 | traité | 38 | `f208ed7` | `b2eb2cb`, `69f9209`, `5af759a` | corrigé au lot 9 bis (tâche 38, `tests/parcours/messages-sms-9bis.test.ts`) |
| R28 | libellé traité ; push gardé (décision) | 39 | `82c71d4` | `da2306e` | libellé corrigé au lot 9 bis (tâche 39, `tests/parcours/messages-sms-9bis.test.ts`) ; le push garde la place du SMS de 3 heures, par décision de coût |
| R29 | traité | 38 | `f208ed7` | `b2eb2cb`, `69f9209`, `5af759a` | corrigé au lot 9 bis (tâche 38, `tests/parcours/messages-sms-9bis.test.ts`) |
| R30 | traité | 6 | `b6ff250` | `b879077`, `7da6279`, `299ea6f` | corrigé au lot 9 bis (tâche 6, `tests/parcours/paiement-attente-9bis.test.ts`) |
| R31 | traité | 38 | `f208ed7` | `b2eb2cb`, `69f9209`, `5af759a` | corrigé au lot 9 bis (tâche 38, `tests/parcours/messages-sms-9bis.test.ts`) |
| R32 | traité | 5 | `069b37b` | `6551806`, `4cdc509`, `6dd860f` | corrigé au lot 9 bis (tâche 5, `tests/parcours/lot9bis-report.test.ts`) |
| R33 | traité | 33 | `429ab6a` | `596db36` | corrigé au lot 9 bis (tâche 33, `tests/parcours/messages-acteurs-9bis.test.ts`) |
| R34 | traité | 25 | `ff54475` | `f9eb999`, `295bc6c`, `95e7e38`, `66688ea`, `bdfd12a`, `f56f055` | corrigé au lot 9 bis (tâche 25, `tests/parcours/cycle9bis-soumission-fiche.test.ts`) |
| R35 | traité | 25 | `ff54475` | `f9eb999`, `295bc6c`, `95e7e38`, `66688ea`, `bdfd12a`, `f56f055` | corrigé au lot 9 bis (tâche 25, `tests/parcours/cycle9bis-soumission-fiche.test.ts`) |
| R36 | traité | 25 | `ff54475` | `f9eb999`, `295bc6c`, `95e7e38`, `66688ea`, `bdfd12a`, `f56f055` | corrigé au lot 9 bis (tâche 25, `tests/parcours/cycle9bis-soumission-fiche.test.ts`) |
| R37 | traité | 26 | `656ffd2` | `cda370f`, `415fafa`, `dfc332b` | corrigé au lot 9 bis (tâche 26, `tests/parcours/cycle9bis-equipe.test.ts`) |
| R38 | traité | 26 | `656ffd2` | `cda370f`, `415fafa`, `dfc332b` | corrigé au lot 9 bis (tâche 26, `tests/parcours/cycle9bis-equipe.test.ts`) |
| R39 | traité | 26 | `656ffd2` | `cda370f`, `415fafa`, `dfc332b` | corrigé au lot 9 bis (tâche 26, `tests/parcours/cycle9bis-equipe.test.ts`) |
| R40 | traité | 26 | `656ffd2` | `cda370f`, `415fafa`, `dfc332b` | corrigé au lot 9 bis (tâche 26, `tests/parcours/cycle9bis-equipe.test.ts`) |
| R41 | traité | 26 | `656ffd2` | `cda370f`, `415fafa`, `dfc332b` | corrigé au lot 9 bis (tâche 26, `tests/parcours/cycle9bis-equipe.test.ts`) |
| R42 | traité | 22 | `099cdcf` | `4c88049`, `e748633`, `8bb2bbd`, `e94540d` | corrigé au lot 9 bis (tâche 22, `tests/parcours/cycle9bis-caisse.test.ts`) |
| R43 | traité | 22 | `099cdcf` | `4c88049`, `e748633`, `8bb2bbd`, `e94540d` | corrigé au lot 9 bis (tâche 22, `tests/parcours/cycle9bis-caisse.test.ts`) |
| R44 | traité | 23 | `f118183` | `68be19e`, `43022f7`, `adf089f`, `594dcbe`, `5244710` | corrigé au lot 9 bis (tâche 23, `tests/parcours/cycle9bis-transfert.test.ts`) |
| R45 | traité | 23 | `f118183` | `68be19e`, `43022f7`, `adf089f`, `594dcbe`, `5244710` | corrigé au lot 9 bis (tâche 23, `tests/parcours/cycle9bis-transfert.test.ts`) |
| R46 | traité | 23 | `f118183` | `68be19e`, `43022f7`, `adf089f`, `594dcbe`, `5244710` | corrigé au lot 9 bis (tâche 23, `tests/parcours/cycle9bis-transfert.test.ts`) |
| R47 | traité | 6 | `b6ff250` | `b879077`, `7da6279`, `299ea6f` | corrigé au lot 9 bis (tâche 6, `tests/parcours/paiement-attente-9bis.test.ts`) |
| R48 | traité | 27 | `fcce367` | `69c1b0b`, `b24cdd3` | corrigé au lot 9 bis (tâche 27, `tests/parcours/cycle9bis-annulation-en-cours.test.ts`) |
| R49 | renvoyé | — | — | — | renvoyé, lot à désigner par le chef de projet |
| R50 | traité | 28 | `7d2f959` | `a78cdff`, `f3ea18f` | corrigé au lot 9 bis (tâche 28, `tests/parcours/cycle9bis-ventes-canal.test.ts`) |
| R51 | traité | 12 | `4114ae1` | `f178159`, `2751c1a`, `4ffb57a`, `d991fa4` | corrigé au lot 9 bis (tâche 12, `tests/parcours/droits-boutons-9bis.test.ts`) |
| R52 | traité | 1 | `a53a095` | `9fae4dd`, `804aeb0`, `0fdc4b1`, `b148c30`, `d11f790`, `65fbb75`, `472855f`, `423a15a` | corrigé au lot 9 bis (tâche 1, `tests/parcours/versements-reprise.test.ts`) |
| R53 | traité | 17 | `ef25817` | `714733a`, `8d03eba`, `58544b2`, `56601dd`, `ea5ae8e` | corrigé au lot 9 bis (tâche 17, `tests/parcours/dossier-partenaire-9bis.test.ts`) |
| R54 | traité | 17 | `ef25817` | `714733a`, `8d03eba`, `58544b2`, `56601dd`, `ea5ae8e` | corrigé au lot 9 bis (tâche 17, `tests/parcours/dossier-partenaire-9bis.test.ts`) |
| R55 | traité | 15 | `b74e957` | `36e4cff`, `28769f7`, `e59002b` | corrigé au lot 9 bis (tâche 15, `tests/parcours/fiche-partenaire-9bis.test.ts`) |
| R56 | renvoyé | — | — | — | renvoyé au lot 13 |
| R57 | traité | 13 | `54d1311` | `5cf77de`, `e7e89d4`, `2adab8c`, `e7292e0` | corrigé au lot 9 bis (tâche 13, `tests/parcours/mot-de-passe-recent.test.ts`) |
| R58 | traité | 14 | `7fcc38c` | `ba67cd4`, `65be705` | corrigé au lot 9 bis (tâche 14, `tests/parcours/connexion-serveur.test.ts`) |
| R59 | traité, partie non reproduite | 34 | `b5efb17` | `c962841`, `3eb18bf`, `28769f7`, `e1a5840` (contenu de `fix(9b.34-SB)`, sans commit propre) | corrigé au lot 9 bis (tâche 34, `tests/parcours/messages-comptes-9bis.test.ts`) pour les messages et le motif ; non reproduit pour l'entrée : le scan ne lit pas le statut du porteur, et la décision garde les billets payés valables à l'entrée |
| R60 | traité | 44 | `1ecc892` | `a97716c` | corrigé au lot 9 bis (tâche 44, `tests/parcours/essai-seed-dev-9bis.test.ts`) |
| R61 | traité | 23 | `f118183` | `68be19e`, `43022f7`, `adf089f`, `594dcbe`, `5244710` | corrigé au lot 9 bis (tâche 23, `tests/parcours/cycle9bis-transfert.test.ts`) |
| R62 | traité | 10 | `4ba56f1` | `67c386e`, `2c7d927` | corrigé au lot 9 bis (tâche 10, `tests/parcours/lot9bis-retrait-devis.test.ts`) |
| R63 | traité | 23 | `f118183` | `68be19e`, `43022f7`, `adf089f`, `594dcbe`, `5244710` | corrigé au lot 9 bis (tâche 23, `tests/parcours/cycle9bis-transfert.test.ts`) |
| R64 | renvoyé | — | — | — | renvoyé au lot 14 |
| R65 | renvoyé | — | — | — | renvoyé au lot 13 |
| R66 | traité | 24 | `362856d` | `bc7f429`, `6de12bf` | corrigé au lot 9 bis (tâche 24, `tests/parcours/cycle9bis-carte-billet.test.ts`) |
| R67 | traité | 41 | `b5eafc3` | `6364814`, `28c79a9` | corrigé au lot 9 bis (tâche 41, `tests/schema/textes-techniques-9bis.test.ts`) |
| R68 | renvoyé | — | — | — | renvoyé au lot 14 |
| R69 | traité | 29 | `df61005` | `ab4f57c`, `c9c5e2e` | corrigé au lot 9 bis (tâche 29, `tests/parcours/cycle9bis-billet-pdf.test.ts`) ; le défaut de lecture n'est pas reproduit en exécution, la preuve est la lecture du code |
| R70 | traité | 41 | `b5eafc3` | `7661c77`, `894f6c8`, `643b268`, `25e2d39`, `ce19d84` | corrigé au lot 9 bis (tâche 41, `tests/schema/textes-techniques-9bis.test.ts`) |
| R71 | traité | 11 | `b779914` | `0de99c2`, `a4d30a2`, `d3b9ed0`, `72de786`, `bff5894`, `08405b0`, `ab5c7ac`, `903fe54` | corrigé au lot 9 bis (tâche 11, `tests/parcours/droits-admin-9bis.test.ts`) |
| R72 | traité | 37 | `afe6640` | `0d0e3f5` | corrigé au lot 9 bis (tâche 37, `tests/parcours/messages-fin-9bis.test.ts`) |
| R73 | traité | 41 | `b5eafc3` | `acc9f3f` | corrigé au lot 9 bis (tâche 41, `tests/parcours/textes-sms-9bis.test.ts`) |
| R74 | traité | 41 | `b5eafc3` | `acc9f3f` | corrigé au lot 9 bis (tâche 41, `tests/parcours/textes-sms-9bis.test.ts`) |
| R75 | traité | 41 | `b5eafc3` | `9fae4dd`, `1400782`, `3b95965`, `df1212a`, `5f4faa3` | corrigé au lot 9 bis (tâche 41, `tests/schema/textes-techniques-9bis.test.ts`) |
| R76 | traité | 41 | `b5eafc3` | `abeb814`, `894f6c8`, `3b95965`, `bc97081`, `c20af98`, `25e2d39`, `df1212a`, `185ab24`, `3c54be7`, `30813b8`, `b9b9737`, `624a8c4` | corrigé au lot 9 bis (tâche 41, `tests/schema/textes-techniques-9bis.test.ts`) ; glossaire unique `docs/glossaire.md` |
| R77 | traité | 41 | `b5eafc3` | `18ffeba`, `88d1564`, `4a58cce` | corrigé au lot 9 bis (tâche 41, `tests/parcours/textes-pdf-9bis.test.ts`) |
| R78 | traité | 37 | `afe6640` | `0d0e3f5` | corrigé au lot 9 bis (tâche 37, `tests/parcours/messages-fin-9bis.test.ts`) |
| R79 | traité | 37 | `afe6640` | `0d0e3f5` | corrigé au lot 9 bis (tâche 37, `tests/parcours/messages-comptes-9bis.test.ts`) |
| R80 | traité | 41 | `b5eafc3` | `acc9f3f`, `f354004` | corrigé au lot 9 bis (tâche 41, `tests/parcours/textes-base-9bis.test.ts`) |
| R81 | non reproduit | 46 | `b9a1160` | — | non reproduit pour `event_notify`, déjà supprimée (`tests/parcours/notif-migration.test.ts:343`) ; l'alerte de volume et la branche « organisateur » sont réemployées (R31, R12) |
| R82 | renvoyé | — | — | — | renvoyé au lot 13 : WhatsApp hors de la V1 (question Q1 fermée) |
| R83 | renvoyé | — | — | — | renvoyé au lot 13 |
| R84 | traité | 41 | `b5eafc3` | `55ada88`, `185ab24` | corrigé au lot 9 bis (tâche 41, `tests/parcours/textes-base-9bis.test.ts`) |
| R85 | traité | 42 | `7c3ad01` | `a28dee5`, `3c6d462`, `c64c17a` | corrigé au lot 9 bis (tâche 42, `tests/parcours/compte-mot-de-passe.test.ts`) |
| R86 | traité | 41 | `b5eafc3` | `894f6c8`, `06f9451` | corrigé au lot 9 bis (tâche 41, `tests/parcours/textes-base-9bis.test.ts`) |
| R87 | traité | 48 | `f4e8cbe` | `8e58ab0`, `953ff44`, `4a9a5e8`, `d378a5b` | corrigé au lot 9 bis (tâche 48, `tests/parcours/email-verification.test.ts`) |
| R88 | traité | 41 | `b5eafc3` | `df1212a`, `185ab24` | corrigé au lot 9 bis (tâche 41, `tests/schema/textes-techniques-9bis.test.ts`) |
| R89 | renvoyé | — | — | — | renvoyé au lot 14 |
| R90 | traité | 17 | `ef25817` | `714733a`, `8d03eba`, `58544b2`, `56601dd`, `ea5ae8e` | corrigé au lot 9 bis (tâche 17, `tests/parcours/dossier-partenaire-9bis.test.ts`) |
| R91 | traité | 44 | `1ecc892` | `a97716c` | corrigé au lot 9 bis (tâche 44, `tests/parcours/essai-seed-dev-9bis.test.ts`) |
| R92 | traité | 41 | `b5eafc3` | `18ffeba`, `643b268`, `14400fe` | corrigé au lot 9 bis (tâche 41, `tests/parcours/textes-base-9bis.test.ts`) |
| R93 | renvoyé | — | — | — | renvoyé, lot à désigner par le chef de projet |
| R94 | traité | 25 | `ff54475` | `f9eb999`, `295bc6c`, `95e7e38`, `66688ea`, `bdfd12a`, `f56f055` | corrigé au lot 9 bis (tâche 25, `tests/parcours/cycle9bis-soumission-fiche.test.ts`) |
| R95 | traité en partie ; reste renvoyé | 36 | `68d16c1` | `2b68541` | corrigé au lot 9 bis (tâche 36, `tests/parcours/messages-changement-9bis.test.ts`) pour l'accusé de soumission et l'alerte des changements ; renvoyé pour le retrait de validation, la publication par la partenaire, les prix et les canaux |
| R96 | renvoyé | — | — | — | renvoyé, lot à désigner par le chef de projet ; les doublons d'accent des villes publiques sont réglés par la tâche 45 |
| R97 | traité | 41 | `b5eafc3` | `8bb2bbd`, `415fafa` | corrigé au lot 9 bis (tâche 41, `tests/schema/textes-techniques-9bis.test.ts`) |
| R98 | traité | 43 | `c85ce05` | `e14e47e`, `25b804b` | corrigé au lot 9 bis (tâche 43, `tests/parcours/invitations-controleur-quota.test.ts`) |
| R99 | renvoyé | — | — | — | renvoyé au lot 14 |
| R100 | traité | 41 | `b5eafc3` | `18ffeba`, `2919d2b`, `c7a46c6` | corrigé au lot 9 bis (tâche 41, `tests/schema/textes-techniques-9bis.test.ts`) |
| R101 | renvoyé | — | — | — | renvoyé au lot 14 |
| R102 | traité | 18 | `69776d9` | `b5be3cf`, `f153844` | corrigé au lot 9 bis (tâche 18, `tests/parcours/controleur-9bis.test.ts`) |
| R103 | traité | 18, H5 | `69776d9`, `f85b848` | `b5be3cf`, `f153844`, `c83c2ba` | corrigé au lot 9 bis (tâche 18, `tests/parcours/controleur-9bis.test.ts`) ; le paiement inconnu de SamirPay est traité par H5 (`tests/parcours/paiement-succes-tardif-v12.test.ts`) |
| R104 | traité ; historique « Envoyée » gardé (L7) | 41 | `b5eafc3` | `18ffeba`, `bab7844`, `95e7e38`, `5244710`, `30813b8` | corrigé au lot 9 bis (tâche 41, `tests/parcours/textes-base-9bis.test.ts`) ; l'historique « Envoyée » uniforme est gardé par décision (aucune énumération des comptes, décision L7 du lot 9) |
| R105 | traité | 41 | `b5eafc3` | `9fae4dd`, `18ffeba`, `9779071`, `7577ef2`, `2db2c5a` | corrigé au lot 9 bis (tâche 41, `tests/parcours/textes-base-9bis.test.ts`) |
| R106 | traité (argent) ; reste renvoyé, lot à désigner | 7 | `ca0235e` | `e2471ce`, `00aab1c` | corrigé au lot 9 bis (tâche 7, `tests/parcours/commissions-fin-evenement.test.ts`) pour la commission retirable avant l'événement ; renvoyé, lot à désigner, pour le reste |
| R107 | traité | 41 | `b5eafc3` | `acc9f3f`, `bc82374`, `c7a46c6` | corrigé au lot 9 bis (tâche 41, `tests/parcours/textes-sms-9bis.test.ts`) |
| R108 | renvoyé | — | — | — | renvoyé au lot 13 |
| R109 | traité | 44 | `1ecc892` | `a97716c` | corrigé au lot 9 bis (tâche 44, `tests/schema/recette-matrice.test.ts`) ; Essai 1 précisé, essais 70 à 76 ajoutés au cahier |

---

## 3. Conformité à l'API SamirPay v1.2 (H1 à H9)

### 3.1 Tableau H1 à H9

| H | Objet | Statut | Rouge | Correctif(s) | Test principal |
|---|---|---|---|---|---|
| H1 | Un `FAILED` d'expiration n'est pas définitif pendant 2 h après la création : webhook de succès et reprise par statut acceptés ; billets émis s'il reste du stock, sinon remboursement et avis `PAYMENT_REFUND_STARTED` | corrigé | `e4dd163` | `21a6d93` (M05, `payment_release`), `e779c51` (cron, délégué S-V) | `paiement-succes-tardif-v12` |
| H2 | Durée de garde des places en réglage SUPERADMIN (`finance.payment_hold_minutes`, 10 min), dite sur la page d'attente ; paiement suivi jusqu'à sa fin de validité (création + 60 min) | corrigé | `eec780c` | `5e7b22f`, `5217e46` (écran), `02a07e3` (réglage), `c24f5f4` (S13 : `PAYMENT_HOLD_MINUTES` retirée) | `paiement-reservation-v12` |
| H3 | Signature `X-SamirPay-Signature` vérifiée si `SAMIRPAY_WEBHOOK_SECRET` est défini (HMAC-SHA256, 5 min, temps constant, plusieurs `v1`) ; absente ou fausse : 401, journal, aucun effet ; confirmation par le statut toujours exigée | corrigé ; clé `whsec_` à confirmer en bac à sable | `d3bf812` | `a6fede5` | `paiement-webhook-signature`, `samirpay-v12-statique` |
| H4 | `orderId` unique et stable ; une seule relance au même `orderId` sur délai dépassé ; 409 `CONFLICT` : identifiant existant repris (PO6) | corrigé | `668a662` | `f55e524` | `paiement-init-relance`, `samirpay-contrat` |
| H5 | Formats A, B, C, D et statuts `PENDING`, `SUCCESS`, `FAILED`, `CANCELLED`, `INVALID_ID`, `NOT_FOUND` ; forme inattendue = erreur journalisée, jamais un succès supposé | corrigé (commit unique en tête du lot, A1) | `f85b848` | `c83c2ba` ; `2bbd844` (T65, faux local de développement) | `samirpay-contrat`, `essai-faux-samirpay` |
| H6 | `fees`, `netAmount`, `refOperator` enregistrés pour chaque transfert ; `/admin/finance` montre frais réels, estimés et écart | corrigé ; encaissement : frais non fournis par la v1.2, l'écran le dit | `32c0df3` | `a663b9a`, `9f6e7e1` (délégué S-V), `7796b96` (écran), `5fa207a` | `versements-frais` |
| H7 | 409 de `/payments/send` = issue incertaine, jamais relancé ; « Solde insuffisant » et « limites » = blocages lisibles ; frais d'un remboursement d'annulation par la partenaire imputés à son solde ; avertissement si les frais de retrait réglés sont sous le coût constaté | corrigé | `af3b876` | `72c4b22` (M05), `bd66b67` (délégué S-V), `a5f61eb` (écran) | `samirpay-contrat`, `versements-frais` |
| H8 | 500 à l'initialisation traduit en message clair ; prix minimum d'une catégorie payante en réglage SUPERADMIN (`finance.min_paid_price`, 100 F) | corrigé ; vrai minimum à recevoir de SamirPay | `0bb4814` | `68457d5`, `f9c0f26` (écran) | `paiement-prix-minimum` |
| H9 | Tableau « v1.2 / code / corrigé », bac à sable | ce rapport, 3.2 et 3.3 | — | — | — |

### 3.2 Ce que dit la v1.2, ce que faisait le code, ce qu'il fait

Repris du tableau de la découverte SamirPay (`S/9bis/discovery-9bis-samirpay.md`, section 12), complété par les commits. La colonne « v1.2 » reformule la règle et donne la section du document, sans le citer.

| # | v1.2 (reformulé) | Code avant le lot | Code après | Corrigé |
|---|---|---|---|---|
| 1 | Solde lu dans `body.solde` (format A, §4.4) | `data.solde` (`lib/samirpay/http-client.ts:153`) | lecteur `readA`, `body.solde` | oui, `c83c2ba` |
| 2 | Transfert 200 : `body` porte la transaction, statut interne (§5.1) | `data.transactionId`, succès par défaut | `body.id`, statut traduit par `mapInternalStatus`, inconnu = UNCERTAIN journalisé | oui, `c83c2ba` |
| 3 | 409 sur un transfert = issue incertaine (§5.1, §8) | REJECTED → ECHOUE, donc renvoyable | UNCERTAIN, jamais relancé automatiquement | oui, `72c4b22` |
| 4 | 400 solde insuffisant ou limites du compte (§5.1) | ECHOUE | blocages `INSUFFICIENT_BALANCE`, `ACCOUNT_LIMIT`, repli `OPERATOR_REFUSED` | oui, `72c4b22` |
| 5 | Orange : `urls.OM` puis `urls.MAXIT`, `qrCode` brut (§4.2) | `urls.orange`, QR seulement sur ordinateur | `deepLinks.orange = urls.OM ?? urls.MAXIT`, QR en `data:image/png;base64` | oui, `c83c2ba` |
| 6 | Erreurs au format B : `errorMessage` (§3.1) | lisait `message` | `errorMessage` (B) et `message` (D ou A) repris | oui, `c83c2ba` |
| 7 | 409 au format D, identifiant existant dans `message` (§3.1, §9) | DUPLICATE sans identifiant | `existingTransactionId` lu (`transactionId=`), adopté | oui, `f55e524` |
| 8 | Une seule relance avec le même `orderId` (§9) | aucune relance | une relance, même `orderId` | oui, `f55e524` |
| 9 | 500 au format D, y compris sous le montant minimum (§4.2) | « ne répond pas » | `PAYMENT_PROVIDER_INTERNAL`, message clair ; prix minimum réglable | oui, `68457d5` |
| 10 | Statut : 404 `NOT_FOUND`, 400 `INVALID_ID` (§4.3) | tout 404 JSON = NOT_FOUND ; paiement inconnu en attente sans fin | NOT_FOUND seulement si `status === 'NOT_FOUND'` ; paiement inconnu de plus de `PAYMENT_PENDING_MAX_AGE_MINUTES` libéré (R103) | oui, `c83c2ba` |
| 11 | Un `FAILED` d'expiration peut être suivi d'un succès (§3.3) | `provider_final = TRUE` d'office, cron sans FAILED | non définitif pendant 2 h, relu par le cron | oui, `21a6d93`, `e779c51` |
| 12 | Paiement valable 1 h, QR Orange 15 min (§4.2) | garde de 15 min, texte « délai écoulé » | garde réglable (10 min), échéance du paiement affichée | oui, `5e7b22f`, `5217e46` |
| 13 | Signature facultative (§7) | absente | vérifiée si le secret est défini | oui, `a6fede5` |
| 14 | Frais de transfert `fees`, `netAmount`, `refOperator` (§5.1) | non lus, non stockés | `samirpay_fees`, `samirpay_net_amount`, `samirpay_ref_operator`, `samirpay_reference` | oui, `a663b9a`, `9f6e7e1` |
| 15 | Aucun frais dans l'encaissement ni le statut (§4.2, §4.3) | — | « Frais réels non fournis par SamirPay pour ce mode d’encaissement : comparez avec votre tableau de bord SamirPay. » (`lib/admin/finance-reconciliation.ts:58`) | non corrigeable |
| 16 | Webhook en formulaire, `status=success` (§7) | conforme | inchangé | sans objet |
| 17 | En-têtes `X-API-KEY`, `X-SECRET-KEY`, JSON (§2, §8) | conformes | inchangé | sans objet |
| 18 | Montant en chaîne, téléphone à 9 chiffres (§1, §4.2, §5.1) | conformes | inchangé | sans objet |
| 19 | Confirmation par le statut avant de livrer (§7) | déjà faite | gardée, signature ou non | sans objet |
| 20 | `successUrl` et `errorUrl` facultatifs (§4.2) | non envoyés | non envoyés (non demandé) | non : point ouvert |

**Message du commit `c83c2ba` faux sur un chiffre :** il annonce « essai-faux-samirpay 13/13 ». Le résultat réel était 12/12 (rapport de l'agent S-H, `S/lot9bis-s0s2-results.md`, section S0). Le commit n'a pas été réécrit.

### 3.3 À vérifier en bac à sable SamirPay, avant toute séance réelle

1. Formes réelles du solde et du transfert (`body` ou `data`) : un appel de solde, puis un transfert de 100 F.
2. Texte exact du 409 au format D et présence de `transactionId=` (expression de H4).
3. Clés `urls.OM` et `urls.MAXIT`, `qrCode` brut, ouverture du lien OM sur Android et iOS.
4. L'endpoint de statut répond-il pour un **transfert** (`CashoutService.confirmSent`) ?
5. Le `callBackUrl` avec `?t=<jeton>` est-il gardé tel quel ? Une URL non https bascule sur l'URL du compte, donc sans jeton.
6. Signature : clé avec ou sans `whsec_` ; deux `v1` pendant un renouvellement ; relance d'un webhook refusé en 401.
7. Qui paie les frais d'encaissement (marchand ou client) ; frais réels Wave et Orange, comparés à `/admin/finance`.
8. Minimum d'encaissement du compte (H8) et limites des transferts (H7).
9. Textes exacts des 400 « Solde insuffisant » et « limites » (classement H7 ; repli `OPERATOR_REFUSED`).
10. Délai réel entre un `FAILED` d'expiration et un webhook de succès tardif.
11. Filtrage des IP sortantes : inapplicable si l'hébergeur n'a pas d'IP fixe (SUPPOSÉ).

---

## 4. Messages nouveaux ou modifiés, SMS et email

### 4.1 Source, règles et mesure

- **Texte exact :** chaque modèle vient de `lib/notifications/catalog.ts`, rendu par le script en lecture seule `S/d3new/render.ts` (sortie `S/d3new/render-output.json`, produite après le dernier commit qui touche le catalogue, `894f6c8`). Les accolades `{…}` sont les variables du modèle ; quelques valeurs internes (nature d'un versement, motif de blocage) apparaissent rendues sur l'exemple du script. Le pied des emails rendus en local porte l'adresse de support de l'environnement de test ; en service, c'est `SUPPORT_EMAIL` (R70).
- **Règle SMS :** un segment GSM-7 au pire cas, préfixe « Event Village : » (R73), accents hors alphabet translittérés et caractères restants retirés (`smsVar`, R27), texte fixe sans « » ’ ° ç ê â ô î û ï ë œ. Famille déclarée pour chaque type : **indispensable** (`ESSENTIAL`, jamais coupé) ou **optionnel** (`OPTIONAL`, réglable par sujet).
- **Mesure au pire cas :** `S/9bis/msg-calc/contrat.ts`, avec les fonctions du dépôt (titre long translittérable tronqué, date « mer. 30 sept. à 20:00 », URL de 27 caractères, montant « 1 250 000 F CFA »). Sortie brute en 4.5. Les mesures « exemple » et « pire cas du rendu » ci-dessous viennent du rendu réel du catalogue.
- **Email :** un email ne part que vers une adresse vérifiée (B96) ; l'adresse technique `…@eventvillage.sn` ne reçoit jamais rien ; aucun QR ni lien de connexion automatique ; un email en échec ne bloque jamais le SMS (B99, `2af8862`). Mise en page commune `lib/notifications/email-layout.ts`, bouton vers la page indiquée.
- **Registre final :** 99 types, 91 en file et 8 synchrones (`OTP_LOGIN`, `OTP_REGISTER`, `OTP_PASSWORD_RESET`, `OTP_WITHDRAWAL`, `OTP_PHONE_CHANGE`, `OTP_AUTH_HOOK`, `CONTROLLER_INVITE`, `EMAIL_VERIFICATION`) ; 82 indispensables non synchrones, dont 80 déclarent EMAIL ; 9 optionnels.

### 4.2 Types nouveaux (26)

#### N1 `REFUND_DELAYED` — Remboursement retardé

Famille : indispensable. Canaux : IN_APP, SMS, EMAIL, PUSH. Audience : CLIENT. Suspendu : ALLOW.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : remboursement de {amount} retardé ("{title}"). L'équipe Event Village s'en occupe, aucune action de votre part.
    exemple : 142 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 157 car., GSM7, 1 segment(s)
```

- In-app [principal] : « Remboursement retardé » — Le remboursement de {amount} pour « {title} » est retardé. L'équipe Event Village s'en occupe : vous serez prévenu dès le versement. (lien `/tickets?tab=historique`)
- Email [principal] : objet « Remboursement retardé — Event Village » ; corps : Le remboursement de {amount} pour « {title} » est retardé. L'équipe Event Village s'en occupe : vous serez prévenu dès le versement. Ouvrir Event Village : {APP_URL}/tickets?tab=historique

#### N2 `WITHDRAWAL_DELAYED` — Retrait retardé

Famille : indispensable. Canaux : IN_APP, SMS, EMAIL, PUSH. Audience : ANY. Suspendu : ALLOW.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : votre retrait de {amount} est retardé. L'équipe Event Village s'en occupe, aucune action de votre part.
    exemple : 123 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 126 car., GSM7, 1 segment(s)
```

- In-app [principal] : « Retrait retardé » — Votre retrait de {amount} est retardé. L'équipe Event Village s'en occupe : le montant reste réservé et vous serez prévenu du versement. (lien `/partner/finance`)
- Email [principal] : objet « Retrait retardé — Event Village » ; corps : Votre retrait de {amount} est retardé. L'équipe Event Village s'en occupe : le montant reste réservé et vous serez prévenu du versement. Ouvrir Event Village : {APP_URL}/partner/finance

#### N3 `ADMIN_CASHOUT_TO_RESUME` — Versement à reprendre

Famille : indispensable. Canaux : IN_APP, PUSH, EMAIL. Audience : ADMIN, permission `refunds.manage`. Suspendu : BLOCK.

- In-app [principal] : « Versement à reprendre » — Un versement de {amount} (remboursement d’un paiement) attend depuis plus de 30 minutes. (lien `/admin/finance`)
- Email [principal] : objet « Versement à reprendre — Event Village » ; corps : Un versement de {amount} (remboursement d’un paiement) attend depuis plus de 30 minutes. Ouvrir Event Village : {APP_URL}/admin/finance
- In-app [retrait bloqué, solde insuffisant] : « Versement à reprendre » — Un retrait de {amount} est bloqué : solde du compte partenaire SamirPay insuffisant. (lien `/admin/finance`)
- Email [retrait bloqué, solde insuffisant] : objet « Versement à reprendre — Event Village » ; corps : Un retrait de {amount} est bloqué : solde du compte partenaire SamirPay insuffisant. Ouvrir Event Village : {APP_URL}/admin/finance

#### N4 `PAYMENT_REFUND_STARTED` — Remboursement d’un paiement

Famille : indispensable. Canaux : IN_APP, SMS, EMAIL, PUSH. Audience : CLIENT. Suspendu : ALLOW.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : paiement de {amount} ("{title}") sans billet possible : il vous est remboursé sur votre compte Wave.
    exemple : 131 car., GSM7, 1 segment(s)
[paiement en double] Event Village : paiement en double de {amount} ("{title}"), remboursé sur votre compte Wave. Vos billets restent valables.
    exemple : 137 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 146 car., GSM7, 1 segment(s)
```

- In-app [principal] : « Remboursement de votre paiement » — Votre paiement de {amount} pour « {title} » a été reçu, mais aucun billet n'a pu être émis. Il vous est remboursé sur votre compte Wave : vous serez prévenu du versement. (lien `/tickets?tab=historique`)
- Email [principal] : objet « Remboursement de votre paiement — Event Village » ; corps : Votre paiement de {amount} pour « {title} » a été reçu, mais aucun billet n'a pu être émis. Il vous est remboursé sur votre compte Wave : vous serez prévenu du versement. Ouvrir Event Village : {APP_URL}/tickets?tab=historique
- In-app [paiement en double] : « Remboursement de votre paiement » — Un second paiement de {amount} pour « {title} » a été encaissé pour le même panier. Il vous est remboursé sur votre compte Wave ; vos billets restent valables. (lien `/tickets?tab=historique`)
- Email [paiement en double] : objet « Remboursement de votre paiement — Event Village » ; corps : Un second paiement de {amount} pour « {title} » a été encaissé pour le même panier. Il vous est remboursé sur votre compte Wave ; vos billets restent valables. Ouvrir Event Village : {APP_URL}/tickets?tab=historique

#### N5 `ADMIN_PARTNER_RESUBMITTED` — Dossier partenaire complété

Famille : indispensable. Canaux : IN_APP, PUSH, EMAIL. Audience : ADMIN, permission `partners.read`. Suspendu : BLOCK.

- In-app [principal] : « Dossier complété » — {company} a complété son dossier refusé : il attend un nouvel examen. (lien `/admin/dashboard`)
- Email [principal] : objet « Dossier complété — Event Village » ; corps : {company} a complété son dossier refusé : il attend un nouvel examen. Ouvrir Event Village : {APP_URL}/admin/dashboard

#### N6 `EVENT_CLOSED_HOLDER` — Clôture d’un événement suspendu (porteurs)

Famille : indispensable. Canaux : IN_APP, SMS, EMAIL, PUSH. Audience : CLIENT. Suspendu : ALLOW.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : {title} est clos après sa suspension, sans annulation ni remboursement automatique. {APP_URL}/tickets
    exemple : 142 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 158 car., GSM7, 1 segment(s)
```

- In-app [principal] : « Événement clos » — « {title} » est clos par l'équipe Event Village après sa suspension. Il n'est pas annulé : aucun remboursement automatique. (lien `/tickets`)
- Email [principal] : objet « Événement clos — Event Village » ; corps : « {title} » est clos par l'équipe Event Village après sa suspension. Il n'est pas annulé : aucun remboursement automatique. Ouvrir Event Village : {APP_URL}/tickets

#### N7 `EVENT_CLOSED_BY_ADMIN` — Clôture d’un événement par l’administration

Famille : indispensable. Canaux : IN_APP, SMS, EMAIL, PUSH. Audience : PARTNER. Suspendu : BLOCK.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : {title} est clos par l'équipe Event Village après sa suspension. Motif : {reason}
    exemple : 125 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 151 car., GSM7, 1 segment(s)
```

- In-app [principal] : « Événement clos par l'administration » — « {title} » du {start_at} est clos par l'administration, sans annulation. Motif : {reason} (lien `/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01`)
- Email [principal] : objet « Événement clos par l'administration — Event Village » ; corps : « {title} » du {start_at} est clos par l'administration, sans annulation. Motif : {reason} Ouvrir Event Village : {APP_URL}/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01

#### N8 `SHIFT_OPEN_AT_END` — Caisse encore ouverte à la fin

Famille : indispensable. Canaux : IN_APP, PUSH, SMS, EMAIL. Audience : PARTNER. Suspendu : ALLOW.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : {title} est terminé et {open_shifts} caisses restent ouvertes. Fermez-les dans le pilotage : {APP_URL}/partner/events
    exemple : 146 car., GSM7, 1 segment(s)
[une caisse] Event Village : {title} est terminé et {open_shifts} caisse reste ouverte. Fermez-la dans le pilotage : {APP_URL}/partner/events
    exemple : 141 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 157 car., GSM7, 1 segment(s)
```

- In-app [principal] : « Caisse encore ouverte » — « {title} » est terminé et {open_shifts} caisses restent ouvertes. Fermez-les dans l'onglet Caisse du pilotage. (lien `/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=caisse`)
- Email [principal] : objet « Caisse encore ouverte — Event Village » ; corps : « {title} » est terminé et {open_shifts} caisses restent ouvertes. Fermez-les dans l'onglet Caisse du pilotage. Ouvrir Event Village : {APP_URL}/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=caisse
- In-app [une caisse] : « Caisse encore ouverte » — « {title} » est terminé et {open_shifts} caisse reste ouverte. Fermez-la dans l'onglet Caisse du pilotage. (lien `/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=caisse`)
- Email [une caisse] : objet « Caisse encore ouverte — Event Village » ; corps : « {title} » est terminé et {open_shifts} caisse reste ouverte. Fermez-la dans l'onglet Caisse du pilotage. Ouvrir Event Village : {APP_URL}/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=caisse

#### N9 `TRANSFER_REVOKED` — Transfert annulé par un remboursement

Famille : indispensable. Canaux : SMS, IN_APP, PUSH, EMAIL. Audience : CLIENT. Suspendu : BLOCK.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : le billet {title} qui vous était transféré a été remboursé à son acheteur. Le transfert est annulé.
    exemple : 126 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 138 car., GSM7, 1 segment(s)
```

- In-app [principal] : « Transfert annulé » — Le billet pour « {title} » a été remboursé à son acheteur : le transfert est annulé. (lien `/tickets`)
- Email [principal] : objet « Transfert annulé — Event Village » ; corps : Le billet pour « {title} » a été remboursé à son acheteur : le transfert est annulé. Ouvrir Event Village : {APP_URL}/tickets

#### N10 `TRANSFER_DECLINED_SENDER` — Transfert refusé (expéditeur)

Famille : indispensable. Canaux : IN_APP, PUSH, EMAIL. Audience : CLIENT. Suspendu : BLOCK.

- In-app [principal] : « Billet refusé » — Le destinataire a refusé votre billet pour « {title} » : il reste dans vos billets. (lien `/tickets`)
- Email [principal] : objet « Billet refusé — Event Village » ; corps : Le destinataire a refusé votre billet pour « {title} » : il reste dans vos billets. Ouvrir Event Village : {APP_URL}/tickets

#### N11 `TRANSFER_RECIPIENT_CHANGED` — Transfert annulé (numéro du destinataire changé)

Famille : indispensable. Canaux : IN_APP, PUSH, EMAIL. Audience : CLIENT. Suspendu : BLOCK.

- In-app [principal] : « Transfert annulé » — Le destinataire de votre billet pour « {title} » a changé de numéro : le transfert est annulé et le billet reste dans vos billets. (lien `/tickets`)
- Email [principal] : objet « Transfert annulé — Event Village » ; corps : Le destinataire de votre billet pour « {title} » a changé de numéro : le transfert est annulé et le billet reste dans vos billets. Ouvrir Event Village : {APP_URL}/tickets

#### N12 `CONTROLLER_INVITATION` — Invitation à contrôler l’entrée

Famille : indispensable. Canaux : SMS, IN_APP, PUSH, EMAIL. Audience : CLIENT. Suspendu : BLOCK.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : {company} vous invite à scanner les billets de Gala de la Teranga, et 1 autre. Répondez sur {APP_URL}/invitations
    exemple : 146 car., GSM7, 1 segment(s)
[un seul événement] Event Village : {company} vous invite à scanner les billets de Gala de la Teranga. Répondez sur {APP_URL}/invitations
    exemple : 134 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 158 car., GSM7, 1 segment(s)
```

- In-app [principal] : « Invitation de Sabar Events » — {company} vous invite à contrôler l'entrée de « Gala de la Teranga » et 1 autre événement. Répondez avant le {expires_at}. (lien `/invitations`)
- Email [principal] : objet « Invitation de {company} — Event Village » ; corps : {company} vous invite à contrôler l'entrée de « Gala de la Teranga » et 1 autre événement. Répondez avant le {expires_at}. Ouvrir Event Village : {APP_URL}/invitations
- In-app [un seul événement] : « Invitation de Sabar Events » — {company} vous invite à contrôler l'entrée de « Gala de la Teranga ». Répondez avant le {expires_at}. (lien `/invitations`)
- Email [un seul événement] : objet « Invitation de {company} — Event Village » ; corps : {company} vous invite à contrôler l'entrée de « Gala de la Teranga ». Répondez avant le {expires_at}. Ouvrir Event Village : {APP_URL}/invitations

#### N13 `EVENT_CANCELLED_BY_ADMIN` — Annulation d’un événement par l’administration

Famille : indispensable. Canaux : IN_APP, SMS, EMAIL. Audience : PARTNER. Suspendu : ALLOW.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : {title} annulé par l'administration. Motif : {public_notice} {APP_URL}/partner/events
    exemple : 143 car., GSM7, 1 segment(s)
[sans avis public] Event Village : {title} annulé par l'administration. {APP_URL}/partner/events
    exemple : 102 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 157 car., GSM7, 1 segment(s)
```

- In-app [principal] : « Événement annulé par l'administration » — « {title} » du {start_at} est annulé par l'administration. Motif : {public_notice} Les remboursements en ligne sont lancés : suivez-les dans l'onglet Clôture. (lien `/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=cloture`)
- Email [principal] : objet « Événement annulé par l'administration — Event Village » ; corps : « {title} » du {start_at} est annulé par l'administration. Motif : {public_notice} Les remboursements en ligne sont lancés : suivez-les dans l'onglet Clôture. Ouvrir Event Village : {APP_URL}/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=cloture
- In-app [sans avis public] : « Événement annulé par l'administration » — « {title} » du {start_at} est annulé par l'administration. Les remboursements en ligne sont lancés : suivez-les dans l'onglet Clôture. (lien `/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=cloture`)
- Email [sans avis public] : objet « Événement annulé par l'administration — Event Village » ; corps : « {title} » du {start_at} est annulé par l'administration. Les remboursements en ligne sont lancés : suivez-les dans l'onglet Clôture. Ouvrir Event Village : {APP_URL}/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=cloture

#### N14 `ADMIN_EVENT_CANCELLED` — Événement annulé par l’organisateur

Famille : indispensable. Canaux : IN_APP, EMAIL. Audience : ADMIN, permission `events.read`. Suspendu : BLOCK.

- In-app [principal] : « Événement annulé par l'organisateur » — « {title} » de {company} est annulé par l'organisateur. Motif interne : {reason} (lien `/admin/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01`)
- Email [principal] : objet « Événement annulé par l'organisateur — Event Village » ; corps : « {title} » de {company} est annulé par l'organisateur. Motif interne : {reason} Ouvrir Event Village : {APP_URL}/admin/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01

#### N15 `CONTROLLER_EVENT_CANCELLED` — Annulation d’un événement contrôlé

Famille : indispensable. Canaux : IN_APP, SMS, EMAIL. Audience : CONTROLLER. Suspendu : BLOCK.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : {title} du {start_at} est annulé. Votre affectation à l'entrée est retirée.
    exemple : 112 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 125 car., GSM7, 1 segment(s)
```

- In-app [principal] : « Contrôle annulé » — « {title} » du {start_at} est annulé : votre affectation à l'entrée est retirée. (lien `/controller/scanner`)
- Email [principal] : objet « Contrôle annulé — Event Village » ; corps : « {title} » du {start_at} est annulé : votre affectation à l'entrée est retirée. Ouvrir Event Village : {APP_URL}/controller/scanner

#### N16 `CONTROLLER_EVENT_CHANGED` — Changement d’un événement contrôlé

Famille : indispensable. Canaux : IN_APP, SMS, EMAIL. Audience : CONTROLLER. Suspendu : BLOCK.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : affectation à l'entrée de {title} : nouvelle date {new_start_at}. {APP_URL}/login
    exemple : 128 car., GSM7, 1 segment(s)
[lieu seul] Event Village : affectation à l'entrée de {title} : nouveau lieu {new_location}. {APP_URL}/login
    exemple : 120 car., GSM7, 1 segment(s)
[date et lieu] Event Village : affectation à l'entrée de {title} : {new_start_at}, {new_location}. {APP_URL}/login
    exemple : 129 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 140 car., GSM7, 1 segment(s)
```

- In-app [principal] : « Contrôle modifié » — « {title} » : nouvelle date : {new_start_at}. Votre affectation est maintenue. (lien `/controller/scanner`)
- Email [principal] : objet « Contrôle modifié — Event Village » ; corps : « {title} » : nouvelle date : {new_start_at}. Votre affectation est maintenue. Ouvrir Event Village : {APP_URL}/controller/scanner
- In-app [lieu seul] : « Contrôle modifié » — « {title} » : nouveau lieu : {new_location}. Votre affectation est maintenue. (lien `/controller/scanner`)
- Email [lieu seul] : objet « Contrôle modifié — Event Village » ; corps : « {title} » : nouveau lieu : {new_location}. Votre affectation est maintenue. Ouvrir Event Village : {APP_URL}/controller/scanner
- In-app [date et lieu] : « Contrôle modifié » — « {title} » : nouvelle date : {new_start_at}, nouveau lieu : {new_location}. Votre affectation est maintenue. (lien `/controller/scanner`)
- Email [date et lieu] : objet « Contrôle modifié — Event Village » ; corps : « {title} » : nouvelle date : {new_start_at}, nouveau lieu : {new_location}. Votre affectation est maintenue. Ouvrir Event Village : {APP_URL}/controller/scanner

#### N17 `CONTROLLER_EVENT_STATUS` — Suspension ou reprise d’un événement contrôlé

Famille : indispensable. Canaux : IN_APP, EMAIL. Audience : CONTROLLER. Suspendu : BLOCK.

- In-app [principal] : « Événement suspendu » — « {title} » est suspendu : le contrôle d'accès est fermé jusqu'à nouvel avis. (lien `/controller/scanner`)
- Email [principal] : objet « Événement suspendu — Event Village » ; corps : « {title} » est suspendu : le contrôle d'accès est fermé jusqu'à nouvel avis. Ouvrir Event Village : {APP_URL}/controller/scanner
- In-app [reprise] : « Événement de nouveau en ligne » — « {title} » reprend : votre affectation est maintenue. (lien `/controller/scanner`)
- Email [reprise] : objet « Événement de nouveau en ligne — Event Village » ; corps : « {title} » reprend : votre affectation est maintenue. Ouvrir Event Village : {APP_URL}/controller/scanner

#### N18 `TICKET_CANCELLED` — Billet annulé

Famille : indispensable. Canaux : IN_APP, SMS, EMAIL. Audience : ANY. Suspendu : ALLOW.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : votre invitation pour {title} du {start_at} est annulée par l'organisateur.
    exemple : 112 car., GSM7, 1 segment(s)
[billet gratuit (FREE)] Event Village : votre billet gratuit pour {title} du {start_at} est annulé par l'organisateur.
    exemple : 115 car., GSM7, 1 segment(s)
[billet payé en espèces (CASH)] Event Village : votre billet pour {title} du {start_at} est annulé. Remboursement par l'organisateur.
    exemple : 122 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 125 car., GSM7, 1 segment(s)
```

- In-app [principal] : « Invitation annulée » — Votre invitation pour « {title} » du {start_at} est annulée par l'organisateur. (lien `/tickets`)
- Email [principal] : objet « Invitation annulée — Event Village » ; corps : Votre invitation pour « {title} » du {start_at} est annulée par l'organisateur. Ouvrir Event Village : {APP_URL}/tickets
- In-app [billet gratuit (FREE)] : « Billet annulé » — Votre billet gratuit pour « {title} » du {start_at} est annulé par l'organisateur. (lien `/tickets`)
- Email [billet gratuit (FREE)] : objet « Billet annulé — Event Village » ; corps : Votre billet gratuit pour « {title} » du {start_at} est annulé par l'organisateur. Ouvrir Event Village : {APP_URL}/tickets
- In-app [billet payé en espèces (CASH)] : « Billet annulé » — Votre billet pour « {title} » du {start_at} est annulé. Le remboursement se fait auprès de l'organisateur. (lien `/tickets`)
- Email [billet payé en espèces (CASH)] : objet « Billet annulé — Event Village » ; corps : Votre billet pour « {title} » du {start_at} est annulé. Le remboursement se fait auprès de l'organisateur. Ouvrir Event Village : {APP_URL}/tickets

#### N19 `ACCOUNT_SUSPENDED` — Compte suspendu

Famille : indispensable. Canaux : IN_APP, SMS, EMAIL. Audience : ANY. Suspendu : ALLOW.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : votre compte est suspendu. Motif : {reason}. Vos billets payés restent valables à l'entrée. Contactez le support.
    exemple : 140 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 155 car., GSM7, 1 segment(s)
```

- In-app [principal] : « Compte suspendu » — Votre compte est suspendu. Motif : {reason}. Vos billets payés restent valables à l'entrée : présentez le billet hors ligne déjà enregistré sur votre téléphone, ou donnez le numéro du billet avec une pièce d'identité. Contactez le support. (lien `/billet/hors-ligne`)
- Email [principal] : objet « Compte suspendu — Event Village » ; corps : Votre compte est suspendu. Motif : {reason}. Vos billets payés restent valables à l'entrée : présentez le billet hors ligne déjà enregistré sur votre téléphone, ou donnez le numéro du billet avec une pièce d'identité. Contactez le support. Ouvrir Event Village : {APP_URL}/billet/hors-ligne

#### N20 `ACCOUNT_REACTIVATED` — Compte réactivé

Famille : indispensable. Canaux : IN_APP, SMS, EMAIL. Audience : ANY. Suspendu : ALLOW.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : votre compte est réactivé. Vous pouvez de nouveau vous connecter : {APP_URL}/login
    exemple : 112 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 116 car., GSM7, 1 segment(s)
```

- In-app [principal] : « Compte réactivé » — Votre compte est réactivé : vous pouvez de nouveau vous connecter. (lien `/login`)
- Email [principal] : objet « Compte réactivé — Event Village » ; corps : Votre compte est réactivé : vous pouvez de nouveau vous connecter. Ouvrir Event Village : {APP_URL}/login

#### N21 `ADMIN_EVENT_CHANGED` — Événement modifié après validation

Famille : indispensable. Canaux : IN_APP, EMAIL. Audience : ADMIN, permission `events.read`. Suspendu : BLOCK.

- In-app [principal] : « Événement modifié après validation » — « {title} » de {company} : nouveau titre (ancien : « {old_title} »), nouvelle affiche après validation. Vérifiez la fiche. (lien `/admin/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01`)
- Email [principal] : objet « Événement modifié après validation — Event Village » ; corps : « {title} » de {company} : nouveau titre (ancien : « {old_title} »), nouvelle affiche après validation. Vérifiez la fiche. Ouvrir Event Village : {APP_URL}/admin/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01
- In-app [lieu et date] : « Événement modifié après validation » — « {title} » de {company} : nouveau lieu, nouvelle date après validation. Vérifiez la fiche. (lien `/admin/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01`)
- Email [lieu et date] : objet « Événement modifié après validation — Event Village » ; corps : « {title} » de {company} : nouveau lieu, nouvelle date après validation. Vérifiez la fiche. Ouvrir Event Village : {APP_URL}/admin/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01
- In-app [catégorie ajoutée] : « Événement modifié après validation » — « {title} » de {company} : catégorie « {category} » ajoutée après validation. Vérifiez la fiche. (lien `/admin/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01`)
- Email [catégorie ajoutée] : objet « Événement modifié après validation — Event Village » ; corps : « {title} » de {company} : catégorie « {category} » ajoutée après validation. Vérifiez la fiche. Ouvrir Event Village : {APP_URL}/admin/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01

#### N22 `EVENT_SUBMITTED_ACK` — Événement envoyé en validation

Famille : indispensable. Canaux : IN_APP, EMAIL. Audience : PARTNER. Suspendu : BLOCK.

- In-app [principal] : « Événement envoyé en validation » — « {title} » est envoyé à l'équipe Event Village pour validation. Vous serez prévenu de la décision. (lien `/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01`)
- Email [principal] : objet « Événement envoyé en validation — Event Village » ; corps : « {title} » est envoyé à l'équipe Event Village pour validation. Vous serez prévenu de la décision. Ouvrir Event Village : {APP_URL}/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01

#### N23 `EVENT_FINISHED` — Événement terminé

Famille : indispensable. Canaux : IN_APP, EMAIL. Audience : PARTNER. Suspendu : ALLOW.

- In-app [principal] : « Événement terminé » — « {title} » est terminé. Le rapport de clôture est prêt dans l'onglet Clôture. (lien `/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=cloture`)
- Email [principal] : objet « Événement terminé — Event Village » ; corps : « {title} » est terminé. Le rapport de clôture est prêt dans l'onglet Clôture. Ouvrir Event Village : {APP_URL}/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=cloture

#### N24 `CLOSING_REPORT_READY` — Rapport de clôture prêt

Famille : indispensable. Canaux : IN_APP, EMAIL. Audience : PARTNER. Suspendu : ALLOW.

- In-app [principal] : « Rapport de clôture prêt » — Toutes les caisses de « {title} » sont fermées : le rapport de clôture est prêt. (lien `/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=cloture`)
- Email [principal] : objet « Rapport de clôture prêt — Event Village » ; corps : Toutes les caisses de « {title} » sont fermées : le rapport de clôture est prêt. Ouvrir Event Village : {APP_URL}/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=cloture

#### N25 `FUNDS_AVAILABLE` — Recettes disponibles

Famille : indispensable. Canaux : IN_APP, EMAIL. Audience : PARTNER. Suspendu : BLOCK.

- In-app [principal] : « Recettes disponibles » — Les recettes de « {title} » sont disponibles sur votre solde : vous pouvez demander un retrait. (lien `/partner/finance`)
- Email [principal] : objet « Recettes disponibles — Event Village » ; corps : Les recettes de « {title} » sont disponibles sur votre solde : vous pouvez demander un retrait. Ouvrir Event Village : {APP_URL}/partner/finance

#### N26 `EMAIL_VERIFICATION` — Vérification de l’adresse email

Famille : indispensable, synchrone (`sync_only`). Canal : EMAIL seul. Seul envoi vers une adresse non vérifiée. Texte (`lib/notifications/catalog.ts:1755-1761`) : objet « Vérifiez votre adresse email — Event Village » ; titre « Vérifiez votre adresse email » ; paragraphe « Vous avez indiqué cette adresse pour votre compte Event Village. Confirmez-la pour recevoir vos billets et vos confirmations par email. » ; bouton « Vérifier mon adresse » vers `{APP_URL}/verify-email?t={jeton}` ; note « Ce lien est valable 24 heures et ne sert qu’une fois. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : l’adresse ne sera pas ajoutée. »

### 4.3 Types modifiés par le texte ou la règle

#### M1 `EVENT_CHANGED` — Changement d’un événement

Changement : devient indispensable (sujet retiré), + EMAIL ; SMS et email à + 10 min, regroupés sur la fenêtre (R14, R26) ; aussi aux numéros sans compte (R12) ; variantes report de plus de 24 h avec droit au remboursement (R32) et adresse retirée (R80) ; « .... » remplacé (R74).

Famille : indispensable. Canaux : IN_APP, PUSH, SMS, EMAIL. Audience : CLIENT. Suspendu : BLOCK.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : {title} change de date : {new_start_at}. Vos billets restent valables. {APP_URL}/tickets
    exemple : 135 car., GSM7, 1 segment(s)
[report de plus de 24 h (refund_open)] Event Village : {title} reporté au {new_start_at}. Remboursement total possible avant cette date : {APP_URL}/tickets
    exemple : 147 car., GSM7, 1 segment(s)
[report de plus de 24 h et nouveau lieu] Event Village : {title} reporté au {new_start_at}, nouveau lieu. Remboursement total avant cette date : {APP_URL}/tickets
    exemple : 152 car., GSM7, 1 segment(s)
[adresse retirée] Event Village : {title} : adresse retirée, lieu {location}. Billets toujours valables. {APP_URL}/tickets
    exemple : 124 car., GSM7, 1 segment(s)
[lieu seul] Event Village : {title} change de lieu : {new_location}. Vos billets restent valables. {APP_URL}/tickets
    exemple : 128 car., GSM7, 1 segment(s)
[date et lieu] Event Village : {title} change : {new_start_at}, {new_location}. Billets toujours valables. {APP_URL}/tickets
    exemple : 139 car., GSM7, 1 segment(s)
[fin seule] Event Village : {title} : nouvelle fin le {new_end_at}. Vos billets restent valables. {APP_URL}/tickets
    exemple : 136 car., GSM7, 1 segment(s)
[ville seule] Event Village : {title} change de lieu : {location}, {new_city}. Vos billets restent valables. {APP_URL}/tickets
    exemple : 127 car., GSM7, 1 segment(s)
[adresse seule] Event Village : {title} change de lieu : {new_address} Vos billets restent valables. {APP_URL}/tickets
    exemple : 139 car., GSM7, 1 segment(s)
[titre seul (aucun SMS : ligne SKIPPED TITLE_ONLY)] (aucun SMS : Donnée du modèle « changed_fields » ne contient aucun changement de date ou de lieu (aucun SMS))
[pire cas du rendu, URL 27, titre long] 152 car., GSM7, 1 segment(s)
```

- In-app [principal] : « Événement modifié » — « {title} » : nouvelle date : {new_start_at}. Vos billets restent valables. (lien `/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01`)
- Email [principal] : objet « Événement modifié — Event Village » ; corps : « {title} » : nouvelle date : {new_start_at}. Vos billets restent valables. Ouvrir Event Village : {APP_URL}/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01
- In-app [report de plus de 24 h (refund_open)] : « Événement modifié » — « {title} » est reporté au {new_start_at}. Vos billets restent valables ; vous pouvez aussi demander leur remboursement total, frais compris, dans Mes billets jusqu'au début de l'événement. (lien `/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01`)
- Email [report de plus de 24 h (refund_open)] : objet « Événement modifié — Event Village » ; corps : « {title} » est reporté au {new_start_at}. Vos billets restent valables ; vous pouvez aussi demander leur remboursement total, frais compris, dans Mes billets jusqu'au début de l'événement. Ouvrir Event Village : {APP_URL}/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01
- In-app [report de plus de 24 h et nouveau lieu] : « Événement modifié » — « {title} » est reporté au {new_start_at}, nouveau lieu : {new_location}. Vos billets restent valables ; vous pouvez aussi demander leur remboursement total, frais compris, dans Mes billets jusqu'au début de l'événement. (lien `/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01`)
- Email [report de plus de 24 h et nouveau lieu] : objet « Événement modifié — Event Village » ; corps : « {title} » est reporté au {new_start_at}, nouveau lieu : {new_location}. Vos billets restent valables ; vous pouvez aussi demander leur remboursement total, frais compris, dans Mes billets jusqu'au début de l'événement. Ouvrir Event Village : {APP_URL}/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01
- In-app [adresse retirée] : « Événement modifié » — « {title} » : adresse retirée. Vos billets restent valables. (lien `/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01`)
- Email [adresse retirée] : objet « Événement modifié — Event Village » ; corps : « {title} » : adresse retirée. Vos billets restent valables. Ouvrir Event Village : {APP_URL}/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01
- In-app [lieu seul] : « Événement modifié » — « {title} » : nouveau lieu : {new_location}. Vos billets restent valables. (lien `/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01`)
- Email [lieu seul] : objet « Événement modifié — Event Village » ; corps : « {title} » : nouveau lieu : {new_location}. Vos billets restent valables. Ouvrir Event Village : {APP_URL}/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01
- In-app [date et lieu] : « Événement modifié » — « {title} » : nouvelle date : {new_start_at}, nouveau lieu : {new_location}. Vos billets restent valables. (lien `/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01`)
- Email [date et lieu] : objet « Événement modifié — Event Village » ; corps : « {title} » : nouvelle date : {new_start_at}, nouveau lieu : {new_location}. Vos billets restent valables. Ouvrir Event Village : {APP_URL}/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01
- In-app [fin seule] : « Événement modifié » — « {title} » : nouvelle fin : {new_end_at}. Vos billets restent valables. (lien `/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01`)
- Email [fin seule] : objet « Événement modifié — Event Village » ; corps : « {title} » : nouvelle fin : {new_end_at}. Vos billets restent valables. Ouvrir Event Village : {APP_URL}/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01
- In-app [ville seule] : « Événement modifié » — « {title} » : nouvelle ville : {new_city}. Vos billets restent valables. (lien `/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01`)
- Email [ville seule] : objet « Événement modifié — Event Village » ; corps : « {title} » : nouvelle ville : {new_city}. Vos billets restent valables. Ouvrir Event Village : {APP_URL}/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01
- In-app [adresse seule] : « Événement modifié » — « {title} » : nouvelle adresse : {new_address}. Vos billets restent valables. (lien `/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01`)
- Email [adresse seule] : objet « Événement modifié — Event Village » ; corps : « {title} » : nouvelle adresse : {new_address}. Vos billets restent valables. Ouvrir Event Village : {APP_URL}/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01
- In-app [titre seul (aucun SMS : ligne SKIPPED TITLE_ONLY)] : « Événement modifié » — « {title} » : nouveau titre (ancien titre : « {old_title} »). Vos billets restent valables. (lien `/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01`)
- Email [titre seul (aucun SMS : ligne SKIPPED TITLE_ONLY)] : objet « Événement modifié — Event Village » ; corps : « {title} » : nouveau titre (ancien titre : « {old_title} »). Vos billets restent valables. Ouvrir Event Village : {APP_URL}/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01

#### M2 `EVENT_CANCELLED` — Annulation d’un événement

Changement : mode `TRANSFERRED` pour le détenteur d'un billet reçu par transfert, acheteur d'origine prévenu en `AUTO` (R13) ; numéro seul `ORGANIZER` (guichet) et `NONE` (invitation ou transfert en attente), SMS seul (R12, R22).

Famille : indispensable. Canaux : IN_APP, SMS, EMAIL, PUSH. Audience : CLIENT. Suspendu : ALLOW.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : {title} du {start_at} est annulé. Remboursement automatique en cours. {APP_URL}/tickets
    exemple : 138 car., GSM7, 1 segment(s)
[remboursement par l’organisateur (ORGANIZER)] Event Village : {title} du {start_at} est annulé. Remboursement par l'organisateur. {APP_URL}/tickets
    exemple : 136 car., GSM7, 1 segment(s)
[sans remboursement (NONE, gratuit ou invitation)] Event Village : {title} du {start_at} est annulé. Détails : {APP_URL}/tickets
    exemple : 112 car., GSM7, 1 segment(s)
[billet reçu par transfert (TRANSFERRED)] Event Village : {title} du {start_at} est annulé. Remboursement à l'acheteur d'origine. {APP_URL}/tickets
    exemple : 140 car., GSM7, 1 segment(s)
[numéro seul, acheteur au guichet (PHONE, ORGANIZER)] Event Village : {title} du {start_at} est annulé. Remboursement par l'organisateur.
    exemple : 104 car., GSM7, 1 segment(s)
[numéro seul, invitation ou transfert en attente (PHONE, NONE)] Event Village : {title} du {start_at} est annulé. Le billet qui vous était destiné n'est plus valable.
    exemple : 123 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 155 car., GSM7, 1 segment(s)
```

- In-app [principal] : « Événement annulé » — « {title} » du {start_at} est annulé. {public_notice} Votre remboursement est en cours. (lien `/tickets`)
- Email [principal] : objet « Événement annulé — Event Village » ; corps : « {title} » du {start_at} est annulé. {public_notice} Votre remboursement est en cours. Ouvrir Event Village : {APP_URL}/tickets
- In-app [remboursement par l’organisateur (ORGANIZER)] : « Événement annulé » — « {title} » du {start_at} est annulé. {public_notice} Le remboursement se fait auprès de l'organisateur. (lien `/tickets`)
- Email [remboursement par l’organisateur (ORGANIZER)] : objet « Événement annulé — Event Village » ; corps : « {title} » du {start_at} est annulé. {public_notice} Le remboursement se fait auprès de l'organisateur. Ouvrir Event Village : {APP_URL}/tickets
- In-app [sans remboursement (NONE, gratuit ou invitation)] : « Événement annulé » — « {title} » du {start_at} est annulé. {public_notice} (lien `/tickets`)
- Email [sans remboursement (NONE, gratuit ou invitation)] : objet « Événement annulé — Event Village » ; corps : « {title} » du {start_at} est annulé. {public_notice} Ouvrir Event Village : {APP_URL}/tickets
- In-app [AUTO sans avis public] : « Événement annulé » — « {title} » du {start_at} est annulé. Votre remboursement est en cours. (lien `/tickets`)
- Email [AUTO sans avis public] : objet « Événement annulé — Event Village » ; corps : « {title} » du {start_at} est annulé. Votre remboursement est en cours. Ouvrir Event Village : {APP_URL}/tickets
- In-app [billet reçu par transfert (TRANSFERRED)] : « Événement annulé » — « {title} » du {start_at} est annulé. {public_notice} Le remboursement va à l'acheteur d'origine du billet. (lien `/tickets`)
- Email [billet reçu par transfert (TRANSFERRED)] : objet « Événement annulé — Event Village » ; corps : « {title} » du {start_at} est annulé. {public_notice} Le remboursement va à l'acheteur d'origine du billet. Ouvrir Event Village : {APP_URL}/tickets

#### M3 `INVITATION_RECEIVED` — Invitation reçue

Changement : + IN_APP, PUSH, EMAIL au compte connu (R79) ; SMS inchangé.

Famille : indispensable. Canaux : SMS, IN_APP, PUSH, EMAIL. Audience : ANY. Suspendu : ALLOW.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : {ticket_count} invitations pour {title} le {start_at}. Connectez-vous avec ce numéro : {APP_URL}/tickets
    exemple : 142 car., GSM7, 1 segment(s)
[1 invitation] Event Village : {ticket_count} invitation pour {title} le {start_at}. Connectez-vous avec ce numéro : {APP_URL}/tickets
    exemple : 141 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 159 car., GSM7, 1 segment(s)
```

- In-app [principal] : « Invitation reçue » — {ticket_count} invitations pour « {title} » le {start_at} : vos billets sont dans Mes billets. (lien `/tickets?tab=recus`)
- Email [principal] : objet « Invitation reçue — Event Village » ; corps : {ticket_count} invitations pour « {title} » le {start_at} : vos billets sont dans Mes billets. Ouvrir Event Village : {APP_URL}/tickets?tab=recus
- In-app [1 invitation] : « Invitation reçue » — {ticket_count} invitation pour « {title} » le {start_at} : vos billets sont dans Mes billets. (lien `/tickets?tab=recus`)
- Email [1 invitation] : objet « Invitation reçue — Event Village » ; corps : {ticket_count} invitation pour « {title} » le {start_at} : vos billets sont dans Mes billets. Ouvrir Event Village : {APP_URL}/tickets?tab=recus

#### M4 `TICKET_SCANNED` — Entrée validée

Changement : + EMAIL ; avis regroupés par commande (R78).

Famille : indispensable. Canaux : IN_APP, PUSH, EMAIL. Audience : CLIENT. Suspendu : BLOCK.

- In-app [principal] : « Entrée validée » — Votre billet pour « {title} » a été contrôlé à l'entrée. (lien `/tickets?tab=historique`)
- Email [principal] : objet « Entrée validée — Event Village » ; corps : Votre billet pour « {title} » a été contrôlé à l'entrée. Ouvrir Event Village : {APP_URL}/tickets?tab=historique

#### M5 `TRIAL_STARTED` — Période d’essai activée

Changement : SMS retiré (R31, décision de coût) ; + EMAIL.

Famille : indispensable. Canaux : IN_APP, EMAIL. Audience : PARTNER. Suspendu : BLOCK.

- In-app [principal] : « Période d'essai activée » — Votre période d'essai de {days} jours commence aujourd'hui. (lien `/partner/dashboard`)
- Email [principal] : objet « Période d'essai activée — Event Village » ; corps : Votre période d'essai de {days} jours commence aujourd'hui. Ouvrir Event Village : {APP_URL}/partner/dashboard

#### M6 `ADMIN_SMS_DAILY_THRESHOLD` — Volume de SMS indispensables élevé

Changement : réémis (R31) avec le seuil réglable `notif.sms_essential_daily_alert` ; texte nouveau.

Famille : indispensable. Canaux : IN_APP, EMAIL. Audience : ADMIN, permission `notifications.read`. Suspendu : BLOCK.

- In-app [principal] : « Volume de SMS indispensables élevé » — {count} SMS indispensables envoyés aujourd'hui (seuil d'alerte : {threshold}). Ils n'ont pas de plafond : vérifiez leur origine dans la supervision. (lien `/admin/notifications`)
- Email [principal] : objet « Volume de SMS indispensables élevé — Event Village » ; corps : {count} SMS indispensables envoyés aujourd'hui (seuil d'alerte : {threshold}). Ils n'ont pas de plafond : vérifiez leur origine dans la supervision. Ouvrir Event Village : {APP_URL}/admin/notifications

#### M7 `PASSWORD_CHANGED` — Mot de passe modifié

Changement : n'est plus émis à l'activation d'un compte coquille de contrôleur (R29) ; texte inchangé.

Famille : indispensable. Canaux : IN_APP, SMS, EMAIL. Audience : ANY. Suspendu : BLOCK.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : le mot de passe de votre compte a été défini ou modifié. Si ce n'est pas vous, contactez le support.
    exemple : 116 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 116 car., GSM7, 1 segment(s)
```

- In-app [principal] : « Mot de passe modifié » — Le mot de passe de votre compte a été défini ou modifié. Si ce n'est pas vous, contactez le support. (lien `/profile`)
- Email [principal] : objet « Mot de passe modifié — Event Village » ; corps : Le mot de passe de votre compte a été défini ou modifié. Si ce n'est pas vous, contactez le support. Ouvrir Event Village : {APP_URL}/profile

#### M8 `PARTNER_REJECTED` — Demande de compte partenaire refusée

Changement : in-app : la partenaire peut compléter son dossier une fois (R54) ; SMS inchangé.

Famille : indispensable. Canaux : IN_APP, SMS, EMAIL. Audience : PARTNER. Suspendu : BLOCK.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : votre demande de compte partenaire n'est pas acceptée. Motif : {reason}
    exemple : 106 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 139 car., GSM7, 1 segment(s)
```

- In-app [principal] : « Demande refusée » — Votre demande de compte partenaire n'est pas acceptée. Motif : {reason} Vous pouvez compléter votre dossier une fois depuis votre tableau de bord. (lien `/partner/dashboard`)
- Email [principal] : objet « Demande refusée — Event Village » ; corps : Votre demande de compte partenaire n'est pas acceptée. Motif : {reason} Vous pouvez compléter votre dossier une fois depuis votre tableau de bord. Ouvrir Event Village : {APP_URL}/partner/dashboard

#### M9 `CONTROLLER_ASSIGNED` — Affectation d’un contrôleur

Changement : pluriel « et 1 autre. » (R73) ; + EMAIL ; aussi à l'acceptation d'une invitation de contrôleur (R37).

Famille : indispensable. Canaux : IN_APP, PUSH, SMS, EMAIL. Audience : CONTROLLER. Suspendu : BLOCK.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : affectation à l'entrée de {title}, {start_at}, point {entry_point}, et 1 autre. {APP_URL}/login
    exemple : 143 car., GSM7, 1 segment(s)
[un seul événement, sans point d’entrée, sans espèces] Event Village : affectation à l'entrée de {title}, {start_at}. {APP_URL}/login
    exemple : 113 car., GSM7, 1 segment(s)
[3 événements] Event Village : affectation à l'entrée de {title}, {start_at}, point {entry_point}, et 2 autres. {APP_URL}/login
    exemple : 144 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 158 car., GSM7, 1 segment(s)
```

- In-app [principal] : « Nouvelle affectation » — Vous contrôlez l'entrée de « {title} » le {start_at}, point d'entrée {entry_point}. Encaissement des espèces autorisé. (lien `/controller/scanner`)
- Email [principal] : objet « Nouvelle affectation — Event Village » ; corps : Vous contrôlez l'entrée de « {title} » le {start_at}, point d'entrée {entry_point}. Encaissement des espèces autorisé. Ouvrir Event Village : {APP_URL}/controller/scanner
- In-app [un seul événement, sans point d’entrée, sans espèces] : « Nouvelle affectation » — Vous contrôlez l'entrée de « {title} » le {start_at}. (lien `/controller/scanner`)
- Email [un seul événement, sans point d’entrée, sans espèces] : objet « Nouvelle affectation — Event Village » ; corps : Vous contrôlez l'entrée de « {title} » le {start_at}. Ouvrir Event Village : {APP_URL}/controller/scanner

#### M10 `CONTROLLER_UNASSIGNED` — Retrait d’affectation

Changement : pluriel (R73) ; + EMAIL.

Famille : indispensable. Canaux : IN_APP, PUSH, SMS, EMAIL. Audience : CONTROLLER. Suspendu : BLOCK.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : votre affectation à l'entrée de {title} est retirée, et 1 autre.
    exemple : 91 car., GSM7, 1 segment(s)
[un seul événement] Event Village : votre affectation à l'entrée de {title} est retirée.
    exemple : 79 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 105 car., GSM7, 1 segment(s)
```

- In-app [principal] : « Affectation retirée » — Vous ne contrôlez plus l'entrée de « {title} ». (lien `/controller/scanner`)
- Email [principal] : objet « Affectation retirée — Event Village » ; corps : Vous ne contrôlez plus l'entrée de « {title} ». Ouvrir Event Village : {APP_URL}/controller/scanner

#### M18 `PURCHASE_CONFIRMED` — Confirmation d’achat

Changement : « .... » remplacé par « ... » (R74).

Famille : indispensable. Canaux : IN_APP, SMS, EMAIL. Audience : CLIENT. Suspendu : ALLOW.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : achat confirmé, {ticket_count} billets {title}. Frais de service {service_fee}, total payé {total}. {APP_URL}/tickets
    exemple : 146 car., GSM7, 1 segment(s)
[1 billet] Event Village : achat confirmé, {ticket_count} billet {title}. Frais de service {service_fee}, total payé {total}. {APP_URL}/tickets
    exemple : 144 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 159 car., GSM7, 1 segment(s)
```

- In-app [principal] : « Achat confirmé » — {ticket_count} billets pour « {title} » le {start_at}. Total payé : {total}. Vos billets sont dans Mes billets. (lien `/tickets`)
- Email [principal] : objet « Achat confirmé — Event Village » ; corps : {ticket_count} billets pour « {title} » le {start_at}. Total payé : {total}. Vos billets sont dans Mes billets. Événement : {title} / Date : {start_at} / Lieu : {location}, {city} / Billets : 1 × Standard, 1 × VIP / Montant payé : {total}, dont frais de service {service_fee} Numéros de billets : / - TCK-20261104-3F9A1C7E2B / - TCK-20261104-8D2E6B4A1F Votre billet s'affiche dans l'application, rubrique Mes billets. Son QR code change toutes les 20 secondes : une capture d'écran ne sera pas acceptée à l'entrée. Ouvrez votre billet avec du réseau avant d'arriver : il restera disponible même sans connexion. Voir mes billets : {APP_URL}/tickets En cas de problème à l'entrée, présentez le numéro de votre billet et une pièce d'identité : le contrôleur peut l'enregistrer à la main.
- In-app [1 billet] : « Achat confirmé » — {ticket_count} billet pour « {title} » le {start_at}. Total payé : {total}. Vos billets sont dans Mes billets. (lien `/tickets`)
- Email [1 billet] : objet « Achat confirmé — Event Village » ; corps : {ticket_count} billet pour « {title} » le {start_at}. Total payé : {total}. Vos billets sont dans Mes billets. Événement : {title} / Date : {start_at} / Lieu : {location}, {city} / Billets : {ticket_count} × Standard / Montant payé : {total}, dont frais de service {service_fee} Numéro du billet : / - TCK-20261104-3F9A1C7E2B Votre billet s'affiche dans l'application, rubrique Mes billets. Son QR code change toutes les 20 secondes : une capture d'écran ne sera pas acceptée à l'entrée. Ouvrez votre billet avec du réseau avant d'arriver : il restera disponible même sans connexion. Voir mes billets : {APP_URL}/tickets En cas de problème à l'entrée, présentez le numéro de votre billet et une pièce d'identité : le contrôleur peut l'enregistrer à la main.
- In-app [12 billets (numéros : 10 listés, « et 2 autres »)] : « Achat confirmé » — {ticket_count} billets pour « {title} » le {start_at}. Total payé : {total}. Vos billets sont dans Mes billets. (lien `/tickets`)
- Email [12 billets (numéros : 10 listés, « et 2 autres »)] : objet « Achat confirmé — Event Village » ; corps : {ticket_count} billets pour « {title} » le {start_at}. Total payé : {total}. Vos billets sont dans Mes billets. Événement : {title} / Date : {start_at} / Lieu : {location}, {city} / Billets : {ticket_count} × Standard / Montant payé : {total}, dont frais de service {service_fee} Numéros de billets : / - TCK-20261104-AAAAAAAAA0 / - TCK-20261104-AAAAAAAAA1 / - TCK-20261104-AAAAAAAAA2 / - TCK-20261104-AAAAAAAAA3 / - TCK-20261104-AAAAAAAAA4 / - TCK-20261104-AAAAAAAAA5 / - TCK-20261104-AAAAAAAAA6 / - TCK-20261104-AAAAAAAAA7 / - TCK-20261104-AAAAAAAAA8 / - TCK-20261104-AAAAAAAAA9 / et 2 autres Votre billet s'affiche dans l'application, rubrique Mes billets. Son QR code change toutes les 20 secondes : une capture d'écran ne sera pas acceptée à l'entrée. Ouvrez votre billet avec du réseau avant d'arriver : il restera disponible même sans connexion. Voir mes billets : {APP_URL}/tickets En cas de problème à l'entrée, présentez le numéro de votre billet et une pièce d'identité : le contrôleur peut l'enregistrer à la main.

#### M19 `COUNTER_RECEIPT` — Reçu de vente au guichet

Changement : « .... » remplacé par « ... » (R74) ; reste sans EMAIL (numéro saisi au guichet).

Famille : indispensable. Canaux : SMS. Audience : ANY. Suspendu : ALLOW.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : achat au guichet pour {title}, {ticket_count} billets, {amount}. Entrée validée. Réf. {reference}.
    exemple : 113 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 134 car., GSM7, 1 segment(s)
```


#### M20 `REMINDER_J1` — Rappel la veille

Changement : « .... » remplacé par « ... » (R74).

Famille : optionnel (sujet REMINDERS). Canaux : IN_APP, PUSH, SMS, EMAIL. Audience : CLIENT. Suspendu : BLOCK.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : rappel, {title} demain à {start_at}, {location}. Vos billets : {APP_URL}/tickets
    exemple : 111 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 151 car., GSM7, 1 segment(s)
```

- In-app [principal] : « Rappel : c'est demain » — « {title} » demain à {start_at}, {location}, {city}. Vos billets sont dans Mes billets. (lien `/tickets`)
- Email [principal] : objet « Rappel : c'est demain — Event Village » ; corps : « {title} » demain à {start_at}, {location}, {city}. Vos billets sont dans Mes billets. Ouvrir Event Village : {APP_URL}/tickets

#### M21 `FIRST_TICKET_SOLD` — Premier billet vendu

Changement : « .... » remplacé par « ... » (R74).

Famille : optionnel (sujet PRO_ACTIVITY). Canaux : IN_APP, PUSH, SMS, EMAIL. Audience : PARTNER. Suspendu : BLOCK.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : premier billet vendu pour {title}. Suivez vos ventes : {APP_URL}/partner/events
    exemple : 120 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 135 car., GSM7, 1 segment(s)
```

- In-app [principal] : « Premier billet vendu » — Le premier billet de « {title} » est vendu. (lien `/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=ventes`)
- Email [principal] : objet « Premier billet vendu — Event Village » ; corps : Le premier billet de « {title} » est vendu. Ouvrir Event Village : {APP_URL}/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=ventes

#### M22 `PHONE_CHANGED` — Numéro de téléphone modifié

Changement : + ligne EMAIL au compte (seconde mise en file, `account_phone_finalize`, `9159f97`) ; SMS à l'ancien numéro inchangé.

Famille : indispensable. Canaux : SMS, EMAIL. Audience : ANY. Suspendu : ALLOW.

SMS (modèle exact du catalogue ; mesure sur l’exemple du rendu) :

```text
[principal] Event Village : le numéro de votre compte a été modifié. Si ce n'est pas vous, contactez le support.
    exemple : 100 car., GSM7, 1 segment(s)
[pire cas du rendu, URL 27, titre long] 100 car., GSM7, 1 segment(s)
```

- Email [principal] : objet « Numéro de téléphone modifié — Event Village » ; corps : Le numéro de téléphone de votre compte a été modifié. Si ce n'est pas vous, contactez le support. Ouvrir Event Village : {APP_URL}/profile

#### M11 à M17 — envois synchrones (codes et invitation de contrôleur)

Changement : préfixe « Event Village : » et texte unique des codes (R73) ; code de retrait dédié, « Ne le donnez à personne. » (R107) ; invitation de contrôleur sur 1 segment (R73). Rendus réels :

```text
[OTP_LOGIN] Event Village : votre code de vérification est 483920. Valable 10 minutes.
    74 car., GSM7, 1 segment(s)
[OTP_REGISTER] Event Village : votre code de vérification est 483920. Valable 10 minutes.
    74 car., GSM7, 1 segment(s)
[OTP_PASSWORD_RESET] Event Village : votre code de réinitialisation du mot de passe est 483920. Valable 10 minutes.
    94 car., GSM7, 1 segment(s)
[OTP_WITHDRAWAL] Event Village : votre code de retrait est 483920. Valable 10 minutes. Ne le donnez à personne.
    94 car., GSM7, 1 segment(s)
[OTP_PHONE_CHANGE] Event Village : votre code de vérification est 483920. Valable 10 minutes.
    74 car., GSM7, 1 segment(s)
[OTP_AUTH_HOOK] Event Village : votre code de vérification est 483920. Valable 10 minutes.
    74 car., GSM7, 1 segment(s)
[CONTROLLER_INVITE — avec prénom (Ibrahima), URL 23] Event Village : Bonjour Ibrahima, code d'activation 483920 (24 h) pour scanner les billets : https://eventvillage.sn/controller/setup?phone=%2B221771234567
    155 car., GSM7, 1 segment(s)
[CONTROLLER_INVITE — sans prénom, URL 23] Event Village : code d'activation 483920 (24 h) pour scanner les billets : https://eventvillage.sn/controller/setup?phone=%2B221771234567
    137 car., GSM7, 1 segment(s)
[CONTROLLER_INVITE — avec prénom (Ibrahima), URL 27] Event Village : Bonjour Ibrahima, code d'activation 483920 (24 h) pour scanner les billets : https://app.eventvillage.sn/controller/setup?phone=%2B221771234567
    159 car., GSM7, 1 segment(s)
[CONTROLLER_INVITE — prénom hors GSM-7 (Maïmouna)] Event Village : Bonjour Maimouna, code d'activation 483920 (24 h) pour scanner les billets : https://eventvillage.sn/controller/setup?phone=%2B221771234567
    155 car., GSM7, 1 segment(s)
[CONTROLLER_INVITE — prénom hors GSM-7 (Ousmanê)] Event Village : Bonjour Ousmane, code d'activation 483920 (24 h) pour scanner les billets : https://eventvillage.sn/controller/setup?phone=%2B221771234567
    154 car., GSM7, 1 segment(s)
```

### 4.4 Types qui gagnent seulement le canal EMAIL (23)

| Type | Famille | Objet | Corps de l’email (modèle) |
|---|---|---|---|
| `EVENT_SUSPENDED_HOLDER` | optionnel (EVENT_UPDATES) | Événement suspendu — Event Village | « {title} » est suspendu pour le moment. Vos billets restent valables, vous serez prévenu de la suite. Ouvrir Event Village : {APP_URL}/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01 |
| `EVENT_REACTIVATED_HOLDER` | optionnel (EVENT_UPDATES) | Événement de nouveau en ligne — Event Village | « {title} » reprend comme prévu. Vos billets restent valables. Ouvrir Event Village : {APP_URL}/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01 |
| `REMINDER_H3` | optionnel (REMINDERS) | C'est bientôt — Event Village | « {title} » commence à {start_at} ({location}). Ouvrez votre billet dans l'application avant d'arriver : il restera disponible sans réseau. Ouvrir Event Village : {APP_URL}/tickets |
| `CONTROLLER_REMINDER` | optionnel (REMINDERS) | Contrôle demain — Event Village | Demain « {title} » à {start_at}, point d'entrée {entry_point}, espèces autorisées. Ouvrir Event Village : {APP_URL}/controller/scanner |
| `TRANSFER_OFFERED` | indispensable | Un billet vous est transféré — Event Village | Un billet pour « {title} » vous attend. Acceptez-le avant le {expires_at}. Ouvrir Event Village : {APP_URL}/tickets?tab=recus |
| `TRANSFER_CANCELLED` | indispensable | Transfert annulé — Event Village | Le transfert du billet pour « {title} » a été annulé par son propriétaire. Ouvrir Event Village : {APP_URL}/tickets |
| `TRANSFER_EXPIRED` | indispensable | Transfert expiré — Event Village | Votre billet pour « {title} » n'a pas été accepté à temps : il reste dans vos billets. Ouvrir Event Village : {APP_URL}/tickets |
| `TRANSFER_CLAIMED_SENDER` | indispensable | Billet accepté — Event Village | Votre billet pour « {title} » a été accepté par son destinataire. Ouvrir Event Village : {APP_URL}/tickets?tab=historique |
| `REFUND_REQUESTED` | indispensable | Remboursement demandé — Event Village | Le remboursement de votre billet pour « {title} » ({amount}) est en cours. Ouvrir Event Village : {APP_URL}/tickets?tab=historique |
| `EVENT_PUBLISHED_BY_ADMIN` | indispensable | Événement publié — Event Village | « {title} » a été publié par l'administration. Ouvrir Event Village : {APP_URL}/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01 |
| `SHIFT_DISCREPANCY` | indispensable | Écart de caisse — Event Village | La caisse de {controller_name} pour « {title} » est fermée avec un écart de -{difference}. Justification : {justification} Ouvrir Event Village : {APP_URL}/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01?tab=caisse |
| `SUBSCRIPTION_ACTIVATED` | indispensable | Abonnement activé — Event Village | Votre pack « {plan} » est activé pour {days} jours. Ouvrir Event Village : {APP_URL}/partner/subscription |
| `PROMOTION_DECIDED` | indispensable | Mise en avant acceptée — Event Village | La mise en avant de « {title} » est acceptée. Ouvrir Event Village : {APP_URL}/partner/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01 |
| `HALL_RESERVATION_REQUESTED` | indispensable | Nouvelle demande de réservation — Event Village | Demande de réservation de « {hall_name} » du {start_date} au {end_date}. Ouvrir Event Village : {APP_URL}/partner/halls |
| `WITHDRAWAL_UNCERTAIN` | indispensable | Retrait en vérification — Event Village | Votre retrait de {amount} est en vérification auprès de l'opérateur. Aucune action n'est nécessaire. Ouvrir Event Village : {APP_URL}/partner/finance |
| `PAYMENT_SUCCESS` | indispensable | Paiement confirmé — Event Village | Votre paiement de {amount} a été validé. Ouvrir Event Village : {APP_URL}/orders |
| `HALL_RESERVATION_CONFIRMED` | indispensable | Réservation confirmée — Event Village | Votre réservation de « {hall_name} » du {start_date} au {end_date} est confirmée. Ouvrir Event Village : {APP_URL}/orders |
| `HALL_RESERVATION_CANCELLED` | indispensable | Réservation annulée — Event Village | La réservation de « {hall_name} » du {start_date} au {end_date} est annulée. Motif : {reason} Ouvrir Event Village : {APP_URL}/orders |
| `SHIFT_CLOSED_BY_OTHER` | indispensable | Caisse fermée — Event Village | Votre caisse pour « {title} » a été fermée par l'organisateur. Montant déclaré : {declared}. Ouvrir Event Village : {APP_URL}/controller/scanner |
| `CONTROLLER_ACTIVATED` | indispensable | Compte activé — Event Village | Votre compte est activé : vous pouvez scanner les billets. Ouvrir Event Village : {APP_URL}/controller/scanner |
| `ADMIN_NOTIFICATION_FAILED` | indispensable | Envoi en échec — Event Village | Une notification « Confirmation d’achat » par {channel} a échoué après {attempts} tentatives. Ouvrir Event Village : {APP_URL}/admin/notifications/e1b3d5f7-9a2c-4e6b-8d4f-1a3c5e7b9d71 |
| `ADMIN_SMS_CAP_GLOBAL` | indispensable | Plafond de SMS atteint — Event Village | Le plafond de {cap} SMS par jour est atteint : les envois sont suspendus jusqu'à minuit (UTC, heure de Dakar). Ouvrir Event Village : {APP_URL}/admin/notifications |
| `ADMIN_SMS_CAP_NON_OTP` | indispensable | Quota de SMS hors code atteint — Event Village | La part des SMS hors codes de connexion ({limit} sur {cap} par jour) est atteinte : seuls les codes de connexion partent encore jusqu'à minuit (UTC, heure de Dakar). Ouvrir Event Village : {APP_URL}/admin/notifications |

### 4.5 Sortie brute de la mesure au pire cas

```text
$ npx tsx S/9bis/msg-calc/contrat.ts
157 GSM7 1seg | 01 EVENT_CANCELLED TRANSFERRED
      Event Village : Grande soirée " Ndekk " - l... du mer. 30 sept. à 20:00 est annulé. Remboursement à l'acheteur d'origine. https://app.eventvillage.sn/tickets
117 GSM7 1seg | 02 EVENT_CANCELLED numéro seul ORGANIZER
      Event Village : Grande soirée " Ndekk " - l... du mer. 30 sept. à 20:00 est annulé. Remboursement par l'organisateur.
136 GSM7 1seg | 03 EVENT_CANCELLED numéro seul NONE
      Event Village : Grande soirée " Ndekk " - l... du mer. 30 sept. à 20:00 est annulé. Le billet qui vous était destiné n'est plus valable.
155 GSM7 1seg | 04 EVENT_CANCELLED_BY_ADMIN
      Event Village : Grande soirée " Ndekk... annulé par l'administration. Motif : Grande soirée " Ndekk " - l'été... https://app.eventvillage.sn/partner/events
125 GSM7 1seg | 05 CONTROLLER_EVENT_CANCELLED
      Event Village : Grande soirée " Ndekk " - l... du mer. 30 sept. à 20:00 est annulé. Votre affectation à l'entrée est retirée.
139 GSM7 1seg | 06a CONTROLLER_EVENT_CHANGED date
      Event Village : affectation à l'entrée de Grande soirée " Ndekk... : nouvelle date mer. 30 sept. à 20:00. https://app.eventvillage.sn/login
140 GSM7 1seg | 06b CONTROLLER_EVENT_CHANGED lieu
      Event Village : affectation à l'entrée de Grande soirée " Ndekk... : nouveau lieu Grande soirée " Ndekk... https://app.eventvillage.sn/login
146 GSM7 1seg | 06c CONTROLLER_EVENT_CHANGED date+lieu
      Event Village : affectation à l'entrée de Grande soirée " Ndekk... : mer. 30 sept. à 20:00, Grande soirée " N... https://app.eventvillage.sn/login
141 GSM7 1seg | 06d CONTROLLER_EVENT_CHANGED fin
      Event Village : affectation à l'entrée de Grande soirée " Ndekk... : nouvelle fin le mer. 30 sept. à 20:00. https://app.eventvillage.sn/login
125 GSM7 1seg | 07a TICKET_CANCELLED INVITATION
      Event Village : votre invitation pour Grande soirée " Ndekk " - l... du mer. 30 sept. à 20:00 est annulée par l'organisateur.
128 GSM7 1seg | 07b TICKET_CANCELLED FREE
      Event Village : votre billet gratuit pour Grande soirée " Ndekk " - l... du mer. 30 sept. à 20:00 est annulé par l'organisateur.
135 GSM7 1seg | 07c TICKET_CANCELLED CASH
      Event Village : votre billet pour Grande soirée " Ndekk " - l... du mer. 30 sept. à 20:00 est annulé. Remboursement par l'organisateur.
154 GSM7 1seg | 08 ACCOUNT_SUSPENDED
      Event Village : votre compte est suspendu. Motif : Grande soirée " Ndekk " - l'été... Vos billets payés restent valables à l'entrée. Contactez le support.
116 GSM7 1seg | 09 ACCOUNT_REACTIVATED
      Event Village : votre compte est réactivé. Vous pouvez de nouveau vous connecter : https://app.eventvillage.sn/login
158 GSM7 1seg | 10 EVENT_CLOSED_HOLDER
      Event Village : Grande soirée " Ndekk " - l... est clos après sa suspension, sans annulation ni remboursement automatique. https://app.eventvillage.sn/tickets
152 GSM7 1seg | 11 EVENT_CLOSED_BY_ADMIN
      Event Village : Grande soirée " Ndekk " - l... est clos par l'équipe Event Village après sa suspension. Motif : Grande soirée " Ndekk " - l'été à Sal...
151 GSM7 1seg | 12a SHIFT_OPEN_AT_END 1
      Event Village : Grande soirée " Ndekk... est terminé et 1 caisse reste ouverte. Fermez-la dans le pilotage : https://app.eventvillage.sn/partner/events
157 GSM7 1seg | 12b SHIFT_OPEN_AT_END 99
      Event Village : Grande soirée " Ndekk... est terminé et 99 caisses restent ouvertes. Fermez-les dans le pilotage : https://app.eventvillage.sn/partner/events
144 GSM7 1seg | 13a CONTROLLER_INVITATION
      Event Village : Grande soirée "... vous invite à scanner les billets de Grande soirée ".... Répondez sur https://app.eventvillage.sn/invitations
158 GSM7 1seg | 13b CONTROLLER_INVITATION 99
      Event Village : Grande soirée "... vous invite à scanner les billets de Grande soirée "..., et 99 autres. Répondez sur https://app.eventvillage.sn/invitations
138 GSM7 1seg | 14 TRANSFER_REVOKED REFUND
      Event Village : le billet Grande soirée " Ndekk " - l... qui vous était transféré a été remboursé à son acheteur. Le transfert est annulé.
154 GSM7 1seg | 15a PAYMENT_REFUND_STARTED
      Event Village : paiement de 1 250 000 F CFA ("Grande soirée " Ndekk " - l...") sans billet possible : il vous est remboursé sur votre compte Orange Money.
158 GSM7 1seg | 15b PAYMENT_REFUND_STARTED double
      Event Village : paiement en double de 1 250 000 F CFA ("Grande soirée " Ndekk " -..."), remboursé sur votre compte Orange Money. Vos billets restent valables.
157 GSM7 1seg | 16 REFUND_DELAYED
      Event Village : remboursement de 1 250 000 F CFA retardé ("Grande soirée " Ndekk " - l..."). L'équipe Event Village s'en occupe, aucune action de votre part.
126 GSM7 1seg | 17 WITHDRAWAL_DELAYED
      Event Village : votre retrait de 1 250 000 F CFA est retardé. L'équipe Event Village s'en occupe, aucune action de votre part.
154 GSM7 1seg | 18a EVENT_CHANGED report
      Event Village : Grande soirée " N... reporté au mer. 30 sept. à 20:00. Remboursement total possible avant cette date : https://app.eventvillage.sn/tickets
159 GSM7 1seg | 18b EVENT_CHANGED report + lieu
      Event Village : Grande soirée " N... reporté au mer. 30 sept. à 20:00, nouveau lieu. Remboursement total avant cette date : https://app.eventvillage.sn/tickets
154 GSM7 1seg | 19 EVENT_CHANGED adresse retirée
      Event Village : Grande soirée " Ndekk " - l... : adresse retirée, lieu Grande soirée " N... Billets toujours valables. https://app.eventvillage.sn/tickets
 74 GSM7 1seg | 20a OTP vérification
      Event Village : votre code de vérification est 123456. Valable 10 minutes.
 94 GSM7 1seg | 20b OTP réinitialisation
      Event Village : votre code de réinitialisation du mot de passe est 123456. Valable 10 minutes.
 94 GSM7 1seg | 20c OTP retrait
      Event Village : votre code de retrait est 123456. Valable 10 minutes. Ne le donnez à personne.
157 GSM7 1seg | 21a CONTROLLER_INVITE prénom
      Event Village : Bonjour Aminat..., code d'activation 123456 (24 h) pour scanner les billets : https://app.eventvillage.sn/controller/setup?phone=221771234567
156 GSM7 1seg | 21b CONTROLLER_INVITE Maïmouna
      Event Village : Bonjour Maimouna, code d'activation 123456 (24 h) pour scanner les billets : https://app.eventvillage.sn/controller/setup?phone=221771234567
138 GSM7 1seg | 21c CONTROLLER_INVITE sans prénom
      Event Village : code d'activation 123456 (24 h) pour scanner les billets : https://app.eventvillage.sn/controller/setup?phone=221771234567
```

Tous les SMS nouveaux ou modifiés tiennent en 1 segment GSM-7 ; le plus long fait 159 caractères (`EVENT_CHANGED`, report et nouveau lieu).

### 4.6 Inventaire de la règle d'envoi par email (G.49), message par message

Règle (B97) : tout type indispensable non synchrone adressé à un compte déclare EMAIL ; il ne part que vers une adresse vérifiée. Le test structurel `tests/parcours/email-regle-envoi.test.ts` (G53-8, `f5b855b`) tient l'exhaustivité ; le registre est posé par M03 (`acc9f3f`).

| Groupe | Types | Email |
|---|---|---|
| Avaient déjà EMAIL | `PURCHASE_CONFIRMED`, `FREE_TICKETS_CONFIRMED`, `TRANSFER_RECEIVED`, `EVENT_CANCELLED`, `REFUND_PAID`, `PASSWORD_CHANGED`, `EVENT_VALIDATED`, `EVENT_REJECTED`, `EVENT_SUSPENDED`, `EVENT_REACTIVATED`, `WITHDRAWAL_PAID`, `WITHDRAWAL_REJECTED`, `CANCEL_REFUNDS_DONE`, `CANCEL_REFUNDS_BLOCKED`, `PARTNER_REGISTERED_ACK`, `PARTNER_VALIDATED`, `PARTNER_REJECTED`, `PARTNER_SUSPENDED`, `PARTNER_REACTIVATED`, `ADMIN_EVENT_SUBMITTED`, `ADMIN_PARTNER_REGISTERED`, `ADMIN_REFUND_TO_RETRY`, `ADMIN_DUPLICATE_PAYMENT`, `ADMIN_CASHOUT_UNCERTAIN`, `ADMIN_WITHDRAWAL_REJECTED`, `ADMIN_FINANCE_DEBT`, `ADMIN_SMS_DAILY_THRESHOLD`, `ADMIN_SMS_OPTIONAL_80`, `ADMIN_SMS_FORECAST` ; optionnels `REMINDER_J1`, `FIRST_TICKET_SOLD`, `CATEGORY_SOLD_OUT`, `EVENT_SOLD_OUT` | oui |
| Minimum de la consigne | changement de date ou de lieu et report qui ouvre un remboursement (`EVENT_CHANGED`, ajouté) ; billet reçu par invitation (`INVITATION_RECEIVED`, ajouté) ; billet reçu par transfert (`TRANSFER_RECEIVED`, déjà) ; suspension ou réactivation du compte (`ACCOUNT_SUSPENDED`, `ACCOUNT_REACTIVATED`, nouveaux ; partenaire : `PARTNER_SUSPENDED`, `PARTNER_REACTIVATED`, déjà) ; échec ou retard d'un remboursement (`REFUND_DELAYED`, `PAYMENT_REFUND_STARTED`, nouveaux) ; retrait versé (`WITHDRAWAL_PAID`, déjà) ; contrôleur affecté ou retiré (`CONTROLLER_ASSIGNED`, `CONTROLLER_UNASSIGNED`, ajouté) | oui |
| Autres ajoutés | les types nouveaux N1 à N25 (4.2), les 23 types de 4.4, `TICKET_SCANNED`, `TRIAL_STARTED`, `PHONE_CHANGED` (ligne au compte) | oui |
| Exclus | `PUSH_TEST` (essai d'un appareil) ; `COUNTER_RECEIPT` (numéro saisi au guichet, aucun compte) ; `OTP_*` et `CONTROLLER_INVITE` (codes et liens d'activation, jamais par email) ; lignes « numéro seul » d'`EVENT_CANCELLED`, `EVENT_CHANGED`, `TRANSFER_REVOKED`, `TICKET_CANCELLED` (aucun compte) ; `NEW_ORDER` (optionnel, in-app seul) | non |
| Exception | `EMAIL_VERIFICATION` : seul envoi vers une adresse **non** vérifiée | oui |

Vérifié sur le rendu du registre final : parmi les 82 types indispensables non synchrones, seuls `COUNTER_RECEIPT` et `PUSH_TEST` n'ont pas EMAIL. Préférences : l'email est réglable par sujet pour les optionnels qui ont le push (G.50, `139eb19`, `0513bbf`) ; les indispensables ne se coupent pas.

### 4.7 Nouveau coût SMS du scénario de l'annexe D

Source : `docs/parcours-evenement-complet.md`, annexe D, recalculée sur le catalogue final par `a8ed63a`. Scénario : un événement, 100 billets payants, 20 gratuits, 5 invitations, 3 transferts, puis une annulation par la partenaire. H1 : 100 commandes d'un billet, 20 comptes gratuits, 5 numéros invités non réclamés, 3 transferts acceptés vers 3 comptes sans billet. H2 : 25 commandes de 4 billets, 5 réservations gratuites de 4, 5 invitations sur 2 numéros, 3 transferts.

| Étape | Type | H1 avant | H1 après | H2 avant | H2 après |
|---|---|---|---|---|---|
| Validation par l'admin | `EVENT_VALIDATED` | 1 | 1 | 1 | 1 |
| Première vente (optionnel) | `FIRST_TICKET_SOLD` | 1 | 1 | 1 | 1 |
| Paiements | `PURCHASE_CONFIRMED` | 100 | 100 | 25 | 25 |
| Billets gratuits | `FREE_TICKETS_CONFIRMED` | 20 | 20 | 5 | 5 |
| Invitations | `INVITATION_RECEIVED` | 5 | 5 | 2 | 2 |
| Offres de transfert | `TRANSFER_OFFERED` | 3 | 3 | 3 | 3 |
| Annulation | `EVENT_CANCELLED` | 120 | 128 | 33 | 35 |
| Remboursements | `REFUND_PAID` | 100 | 100 | 25 | 25 |
| **Total** | | **350** | **358** | **95** | **97** |

Les 8 SMS de plus en H1 : 3 acheteurs d'origine de billets transférés, prévenus même sans billet (R13), et 5 numéros d'invitations non réclamées (R12). En H2 : 2 numéros invités. **Maximum H1** avec les deux rappels sans push : 358 + 100 + 100 = **558 SMS** (555 avant), dont 201 optionnels, sous le budget de 700 optionnels par jour.

**Segments.** Avec le titre « Gala Teranga » suivi d’un emoji, H1 faisait 908 segments pour 350 SMS ; après R27, chaque SMS tient en 1 segment : **358 segments**. Ordre de grandeur, non prouvé (aucun tarif MTarget dans le code) : à 8 F le SMS, 2 864 F pour H1.

**Hors scénario :** + 1 SMS si l'annulation vient d'un admin (`EVENT_CANCELLED_BY_ADMIN`, R15) ; + 1 par acheteur au guichet qui a laissé son numéro ; + 1 par contrôleur affecté à l'annulation (R33) ; + 1 par fenêtre de 10 min de changement de date ou de lieu et par destinataire ; + 1 par remboursement ou retrait retardé, paiement non honorable ou en double, transfert révoqué, billet annulé, suspension ou réactivation de compte, détenteur d'un suspendu clos, caisse ouverte à la fin, invitation de contrôleur ; − 1 par activation de contrôleur (R29), par essai démarré (R31), par code refusé sous le minimum ou pendant le verrou de retrait (R62, ex-10.0 a), par « mot de passe oublié » sur un numéro inconnu (R84). Invitation de contrôleur sur 1 segment au lieu de 2 ou 3 (R73). Les emails ne changent rien au coût SMS ; leur volume face à la limite de l'offre Resend reste à suivre.

---

## 5. Migrations à appliquer sur event-village-dev, dans l'ordre

Procédure complète : `docs/deploiement-projet-neuf.md`, section 3 quinquies (`e5fcc64`). Les migrations `20261103…` à `20261108…` sont gelées (`tests/schema/migrations-gelees.test.ts`). Les 12 fichiers sont rejouables, sans `BEGIN` ni `COMMIT` ; chaque fonction est `SECURITY DEFINER`, réservée au service_role ; les six tables nouvelles ont la RLS activée sans politique.

| Ordre | Migration | Contenu |
|---|---|---|
| 1 | `20261109000001_lot9bis_reglages.sql` | 3 réglages SUPERADMIN : `finance.payment_hold_minutes` (10), `finance.min_paid_price` (100), `notif.sms_essential_daily_alert` (2 000) |
| 2 | `20261109000002_lot9bis_transfert_statut.sql` | valeur `DECLINED` du type `ticket_transfer_status`, seule dans son fichier |
| 3 | `20261109000003_lot9bis_registre.sql` | registre des notifications : 26 types nouveaux, EMAIL sur les indispensables adressés à un compte, `EVENT_CHANGED` indispensable |
| 4 | `20261109000004_lot9bis_droits.sql` | `admin_can`, permissions par action (**aucune donnée d'office**), SUPERADMIN seul pour le rôle ADMIN, `password_confirmations`, NINEA, RCCM, complément de dossier, audit des versements par trigger, `admin_user_status_set` |
| 5 | `20261109000005_lot9bis_samirpay.sql` | colonnes de frais réels SamirPay, `cashout_fee_apply`, prix minimum par trigger, `payment_release` (H1) |
| 6 | `20261109000006_lot9bis_argent.sql` | fonds gelés, cascade de suspension, règle de retrait et devis, droit au remboursement après report, espèces du guichet, fin du droit de remboursement de la partenaire |
| 7 | `20261109000007_lot9bis_versements.sql` | « Versements à reprendre », retard de 30 min, « Renvoyer » et « Marquer versé », commissions à la fin de l'événement + 7 j (reprise annoncée par `NOTICE`) |
| 8 | `20261109000008_lot9bis_cycle.sql` | clôture admin d'un suspendu, fin par défaut à début + 6 h, état du contrôle, PIN obligatoire, transferts, invitations de contrôleurs ; deux `NOTICE` en fin de fichier |
| 9 | `20261109000009_lot9bis_messages.sql` | numéros sans compte, changement regroupé sur 10 min, avis partenaire, admins, contrôleurs, scans regroupés, alerte des SMS indispensables |
| 10 | `20261109000010_lot9bis_email.sql` | `users.email_verified_at`, `users.email_pending`, table `email_verifications` ; aucune adresse existante marquée vérifiée |
| 11 | `20261109000011_lot9bis_textes.sql` | `account_password_finalize`, `quota_release` |
| 12 | `20261109000012_lot9bis_mode_reel.sql` | `users.demo_account`, `essai_check_reel` |

**Contrôles AVANT `db push`, dans l'ordre :**

1. `npx supabase@2.122.0 migration list --linked`, puis `npx supabase@2.122.0 db push --linked --dry-run` : exactement les 12 fichiers, dans cet ordre. Autre chose : s'arrêter (règle de la section 3 bis).
2. **Requête B32, à garder** : la liste des ADMIN et de leurs permissions. Après la migration 4, un ADMIN sans ligne dans `admin_permissions` perd le pilotage, les remboursements, les équipes et la validation des événements. Un SUPERADMIN donne ensuite les permissions manquantes (`/admin/users`, bouton « Permissions »).

   ```sql
   select u.id, u.email, array_remove(array_agg(p.permission order by p.permission), null) as permissions
     from public.users u
     join public.user_roles r on r.user_id = u.id and r.role = 'ADMIN'
     left join public.admin_permissions p on p.user_id = u.id
    group by u.id, u.email
    order by u.email;
   ```

3. Comptes à vraie adresse email (ils ne reçoivent plus d'email avant d'avoir vérifié leur adresse, B98) :

   ```sql
   select count(*) as adresses_a_verifier from public.users
    where email is not null and email !~* '@([a-z0-9-]+\.)*eventvillage\.sn$';
   ```

4. Catégories dont la vente finit après la nouvelle fin par défaut (A12 ; rien n'est réécrit, ces ventes s'arrêteront plus tôt) :

   ```sql
   select e.title, c.name, c.sale_end
     from public.ticket_categories c
     join public.events e on e.id = c.event_id
    where e.end_date is null and c.sale_end is not null
      and e.status::text not in ('ANNULE', 'TERMINE')
      and c.sale_end > ((e.start_date + coalesce(e.start_time, time '00:00')) at time zone 'Africa/Dakar') + interval '6 hours';
   ```

**Appliquer :** `npx supabase@2.122.0 db push --linked`. Recopier les lignes `NOTICE` qui commencent par `lot 9 bis` : commissions repoussées à la fin de l'événement, lignes déjà retirées laissées telles quelles, catégories dont la vente dépasse la nouvelle fin.

**Contrôles APRÈS** (une requête à la fois) : 12 versions `20261109%` dans `supabase_migrations.schema_migrations` ; les 3 réglages (100, 10, 2000) ; `DECLINED` dans `pg_enum` ; `EVENT_CHANGED`, `REFUND_DELAYED`, `EMAIL_VERIFICATION` en `ESSENTIAL` ; `select count(*) from public.users where demo_account` (event-village-dev : les comptes de `seed:dev` ; production : 0) ; puis `supabase/hotfix/2026-10-31-lot1a/03-verification.sql`, tout `OK`. Requêtes exactes : `docs/deploiement-projet-neuf.md`, section 3 quinquies.

**Ensuite, dans la même fenêtre :** déployer l'application du lot ; retirer `PAYMENT_HOLD_MINUTES` de l'environnement ; ne poser `SAMIRPAY_WEBHOOK_SECRET` qu'en suivant la section 6.1 du même document (activé d'un seul côté, tous les webhooks seraient refusés en 401) ; donner leurs permissions aux admins relevés au contrôle 2 ; sur le poste, `npm run essai:check-reel` (code de sortie 0 attendu avant tout passage en réel).

---

## 6. Essais du plan de test à rejouer après ce lot

Cahier : `docs/recette-billetterie.md` (mis au lot par `b67b0fa`). Plan : `docs/plan-de-test-evenement.md` (`8ab1e2b`). Guide : `docs/essai-local.md`, section 13 « Tout en réel depuis votre PC » (`28c8be3`).

**D'abord en simulé :**

- Cahier, essais **1, 2, 4, 5, 7, 8, 9, 10, 12 à 16, 18, 19, 23, 27, 29 à 39, 42 à 50, 52 à 60, 62, 63, 66, 67, 69**.
- Essais **réécrits ou recalés** au lot : 1 (aucun bandeau promis, lignes `[essai]` et `[réel]` de la fenêtre 2), **46** (espèces du guichet : jamais remboursées par la plateforme, liste « Espèces à rembourser par l'organisateur », case « Remboursé » définitive, lecture seule de l'admin), 7, 9, 14, 27, 42, 43, 52, 53, 55, 58, 60, 66, 67.
- Essais **nouveaux 70 à 76** : 70 suspendre puis réactiver un événement ; 71 fin de l'événement, passage à Terminé ; 72 ouverture et fermeture du contrôle à l'entrée ; 73 suspendre un client ; 74 changer de numéro pendant un transfert ; 75 retrait bloqué, puis renvoyé par l'administration ; 76 changer son mot de passe.
- Plan de test : P0.2, P2.3, P7.1, P7.2, P14.1, P16.3, et les lignes ajoutées P1.4, P1.5, P3.4, P3.5, P6.5, P7.5, P7.6, P8.5, P8.6, P14.4, P15.3, P18.3, P18.4.

**Puis en réel** (après `npm run essai:check-reel` à code 0, comptes réels créés pour l'occasion, jamais ceux de `seed:dev`, `SMS_GLOBAL_DAILY_CAP=50`) :

- Guide, section 13.5, dans l'ordre : achat Wave ; achat Orange Money ; paiement abandonné (« Annuler ce paiement » après la durée de garde) ; annulation avec remboursement réel ; retrait, facultatif. Relevés de la section 13.6 (avis SamirPay reçu, délai, frais réellement prélevés, `/admin/finance`, supervision, compte MTarget). Fin de séance de la section 13.7 : **couper le tunnel en premier**.
- Cahier : 7 (SMS), 16 (Wave puis Orange Money), 19 (abandon), 44 (remboursement réel), 42 (retrait, facultatif), 66 (email vers l'adresse du compte Resend, seule permise sans domaine vérifié), 47 ou 48 (push).

Avertissements gardés : les comptes de la graine n'ont toujours pas de téléphone vérifié (essai 27, P0.3). L'essai 60 attend que « Versements à reprendre » ne montre pas, en réel, un remboursement né d'un paiement simulé : c'est le comportement codé (`app/api/admin/refunds/route.ts:185`), signalé en point ouvert.

---

## 7. Sorties brutes des commandes

### 7.1 tsc et eslint sur la pointe de la branche

Lancés sur la pointe de la branche, `a8e49e3` (celle du run « après »), arbre propre hors ce rapport :

```text
$ bash S/tsc-lock.sh    # node --max-old-space-size=2048 node_modules/typescript/bin/tsc --noEmit -p .
tsc exit 0

$ npx next lint
✔ No ESLint warnings or errors
next lint exit 0
```

### 7.2 Run « avant » : run 118 (`44d850c`)

```text
$ sed -n 70115,70427p docs/lot9bis-logs/ci-run118-verify.log | grep -E "RÉCAPITULATIF|^Suite|FAIL|TOTAL|ÉCHEC"
═══════════════════ RÉCAPITULATIF ═══════════════════
Suite                                                  Statut   Durée     Code  Journal
tests/parcours/acces-caisse-pin.test.ts                FAIL     2.8s      1     .test-logs/tests__parcours__acces-caisse-pin.test.ts.log
tests/parcours/acces-limiteurs.test.ts                 FAIL     7.6s      1     .test-logs/tests__parcours__acces-limiteurs.test.ts.log
tests/parcours/acces-qr.test.ts                        FAIL     1.4s      1     .test-logs/tests__parcours__acces-qr.test.ts.log
tests/parcours/acces-totp.test.ts                      FAIL     1.4s      1     .test-logs/tests__parcours__acces-totp.test.ts.log
tests/parcours/admin-remboursements.test.ts            FAIL     3.7s      1     .test-logs/tests__parcours__admin-remboursements.test.ts.log
tests/parcours/attribution-roles.test.ts               FAIL     915ms     1     .test-logs/tests__parcours__attribution-roles.test.ts.log
tests/parcours/audit-transactionnel.test.ts            FAIL     3.3s      1     .test-logs/tests__parcours__audit-transactionnel.test.ts.log
tests/parcours/commissions-fin-evenement.test.ts       FAIL     2.5s      1     .test-logs/tests__parcours__commissions-fin-evenement.test.ts.log
tests/parcours/compte-mot-de-passe.test.ts             FAIL     22.2s     1     .test-logs/tests__parcours__compte-mot-de-passe.test.ts.log
tests/parcours/compte-numero.test.ts                   FAIL     8.2s      1     .test-logs/tests__parcours__compte-numero.test.ts.log
tests/parcours/compte-profil.test.ts                   FAIL     4.4s      1     .test-logs/tests__parcours__compte-profil.test.ts.log
tests/parcours/confirmation-achat.test.ts              FAIL     2.2s      1     .test-logs/tests__parcours__confirmation-achat.test.ts.log
tests/parcours/connexion-serveur.test.ts               FAIL     1.5s      1     .test-logs/tests__parcours__connexion-serveur.test.ts.log
tests/parcours/controleur-9bis.test.ts                 FAIL     1.9s      1     .test-logs/tests__parcours__controleur-9bis.test.ts.log
tests/parcours/course-annulation-transfert.test.ts     FAIL     2.4s      1     .test-logs/tests__parcours__course-annulation-transfert.test.ts.log
tests/parcours/course-verrous-lot9.test.ts             FAIL     2.8s      1     .test-logs/tests__parcours__course-verrous-lot9.test.ts.log
tests/parcours/course-verrous-lot9bis.test.ts          FAIL     1.8s      1     .test-logs/tests__parcours__course-verrous-lot9bis.test.ts.log
tests/parcours/cycle-cron.test.ts                      FAIL     2.1s      1     .test-logs/tests__parcours__cycle-cron.test.ts.log
tests/parcours/cycle-transitions.test.ts               FAIL     12.7s     1     .test-logs/tests__parcours__cycle-transitions.test.ts.log
tests/parcours/cycle9bis-annulation-en-cours.test.ts   FAIL     2.0s      1     .test-logs/tests__parcours__cycle9bis-annulation-en-cours.test.ts.log
tests/parcours/cycle9bis-billet-pdf.test.ts            FAIL     219ms     1     .test-logs/tests__parcours__cycle9bis-billet-pdf.test.ts.log
tests/parcours/cycle9bis-caisse.test.ts                FAIL     3.5s      1     .test-logs/tests__parcours__cycle9bis-caisse.test.ts.log
tests/parcours/cycle9bis-carte-billet.test.ts          FAIL     2.3s      1     .test-logs/tests__parcours__cycle9bis-carte-billet.test.ts.log
tests/parcours/cycle9bis-cloture-admin.test.ts         FAIL     2.2s      1     .test-logs/tests__parcours__cycle9bis-cloture-admin.test.ts.log
tests/parcours/cycle9bis-equipe.test.ts                FAIL     2.5s      1     .test-logs/tests__parcours__cycle9bis-equipe.test.ts.log
tests/parcours/cycle9bis-fenetre-scan.test.ts          FAIL     1.8s      1     .test-logs/tests__parcours__cycle9bis-fenetre-scan.test.ts.log
tests/parcours/cycle9bis-soumission-fiche.test.ts      FAIL     1.6s      1     .test-logs/tests__parcours__cycle9bis-soumission-fiche.test.ts.log
tests/parcours/cycle9bis-transfert.test.ts             FAIL     3.2s      1     .test-logs/tests__parcours__cycle9bis-transfert.test.ts.log
tests/parcours/cycle9bis-ventes-canal.test.ts          FAIL     1.6s      1     .test-logs/tests__parcours__cycle9bis-ventes-canal.test.ts.log
tests/parcours/decouverte-recherche-lot9bis.test.ts    FAIL     1.2s      1     .test-logs/tests__parcours__decouverte-recherche-lot9bis.test.ts.log
tests/parcours/design-systeme.test.ts                  FAIL     2.0s      1     .test-logs/tests__parcours__design-systeme.test.ts.log
tests/parcours/dette-annulation-transferts.test.ts     FAIL     1.7s      1     .test-logs/tests__parcours__dette-annulation-transferts.test.ts.log
tests/parcours/dette-retrait-controleur.test.ts        FAIL     2.5s      1     .test-logs/tests__parcours__dette-retrait-controleur.test.ts.log
tests/parcours/dette-transferts.test.ts                FAIL     1.3s      1     .test-logs/tests__parcours__dette-transferts.test.ts.log
tests/parcours/documents-inscription.test.ts           FAIL     937ms     1     .test-logs/tests__parcours__documents-inscription.test.ts.log
tests/parcours/dossier-partenaire-9bis.test.ts         FAIL     1.6s      1     .test-logs/tests__parcours__dossier-partenaire-9bis.test.ts.log
tests/parcours/double-paiement.test.ts                 FAIL     4.8s      1     .test-logs/tests__parcours__double-paiement.test.ts.log
tests/parcours/droits-admin-9bis.test.ts               FAIL     2.2s      1     .test-logs/tests__parcours__droits-admin-9bis.test.ts.log
tests/parcours/droits-boutons-9bis.test.ts             FAIL     2.3s      1     .test-logs/tests__parcours__droits-boutons-9bis.test.ts.log
tests/parcours/droits-partenaire-9bis.test.ts          FAIL     5.4s      1     .test-logs/tests__parcours__droits-partenaire-9bis.test.ts.log
tests/parcours/ecritures-ignorees.test.ts              FAIL     2.9s      1     .test-logs/tests__parcours__ecritures-ignorees.test.ts.log
tests/parcours/edition-validation.test.ts              FAIL     882ms     1     .test-logs/tests__parcours__edition-validation.test.ts.log
tests/parcours/email-optionnel.test.ts                 FAIL     734ms     1     .test-logs/tests__parcours__email-optionnel.test.ts.log
tests/parcours/email-regle-envoi.test.ts               FAIL     3.4s      1     .test-logs/tests__parcours__email-regle-envoi.test.ts.log
tests/parcours/email-verification.test.ts              FAIL     4.1s      1     .test-logs/tests__parcours__email-verification.test.ts.log
tests/parcours/equipe-eligibilite.test.ts              FAIL     3.6s      1     .test-logs/tests__parcours__equipe-eligibilite.test.ts.log
tests/parcours/essai-check-reel.test.ts                FAIL     1.4s      1     .test-logs/tests__parcours__essai-check-reel.test.ts.log
tests/parcours/essai-comptes-demo.test.ts              FAIL     1.7s      1     .test-logs/tests__parcours__essai-comptes-demo.test.ts.log
tests/parcours/essai-seed-dev-9bis.test.ts             FAIL     1.7s      1     .test-logs/tests__parcours__essai-seed-dev-9bis.test.ts.log
tests/parcours/essai-seed-dev.test.ts                  FAIL     2.0s      1     .test-logs/tests__parcours__essai-seed-dev.test.ts.log
tests/parcours/fiche-partenaire-9bis.test.ts           FAIL     2.6s      1     .test-logs/tests__parcours__fiche-partenaire-9bis.test.ts.log
tests/parcours/finance-commissions.test.ts             FAIL     3.7s      1     .test-logs/tests__parcours__finance-commissions.test.ts.log
tests/parcours/finance-remboursement-billet.test.ts    FAIL     1.6s      1     .test-logs/tests__parcours__finance-remboursement-billet.test.ts.log
tests/parcours/finance-retraits.test.ts                FAIL     5.7s      1     .test-logs/tests__parcours__finance-retraits.test.ts.log
tests/parcours/inscription-numero-dabord.test.ts       FAIL     2.4s      1     .test-logs/tests__parcours__inscription-numero-dabord.test.ts.log
tests/parcours/invitation-identite.test.ts             FAIL     1.2s      1     .test-logs/tests__parcours__invitation-identite.test.ts.log
tests/parcours/invitations-annulation.test.ts          FAIL     3.8s      1     .test-logs/tests__parcours__invitations-annulation.test.ts.log
tests/parcours/invitations-controleur-quota.test.ts    FAIL     2.2s      1     .test-logs/tests__parcours__invitations-controleur-quota.test.ts.log
tests/parcours/invitations-reclamation.test.ts         FAIL     3.0s      1     .test-logs/tests__parcours__invitations-reclamation.test.ts.log
tests/parcours/invitations.test.ts                     FAIL     6.0s      1     .test-logs/tests__parcours__invitations.test.ts.log
tests/parcours/lectures-ignorees.test.ts               FAIL     3.1s      1     .test-logs/tests__parcours__lectures-ignorees.test.ts.log
tests/parcours/legacy-exports-partenaire.test.ts       FAIL     2.2s      1     .test-logs/tests__parcours__legacy-exports-partenaire.test.ts.log
tests/parcours/lot9bis-abonnement.test.ts              FAIL     1.4s      1     .test-logs/tests__parcours__lot9bis-abonnement.test.ts.log
tests/parcours/lot9bis-fonds-suspension.test.ts        FAIL     5.3s      1     .test-logs/tests__parcours__lot9bis-fonds-suspension.test.ts.log
tests/parcours/lot9bis-guichet-annulation.test.ts      FAIL     2.1s      1     .test-logs/tests__parcours__lot9bis-guichet-annulation.test.ts.log
tests/parcours/lot9bis-invariant.test.ts               FAIL     2.4s      1     .test-logs/tests__parcours__lot9bis-invariant.test.ts.log
tests/parcours/lot9bis-remboursement-fin.test.ts       FAIL     3.3s      1     .test-logs/tests__parcours__lot9bis-remboursement-fin.test.ts.log
tests/parcours/lot9bis-report.test.ts                  FAIL     2.9s      1     .test-logs/tests__parcours__lot9bis-report.test.ts.log
tests/parcours/lot9bis-retrait-devis.test.ts           FAIL     1.7s      1     .test-logs/tests__parcours__lot9bis-retrait-devis.test.ts.log
tests/parcours/lot9bis-verrou-numero.test.ts           FAIL     2.8s      1     .test-logs/tests__parcours__lot9bis-verrou-numero.test.ts.log
tests/parcours/messages-acteurs-9bis.test.ts           FAIL     2.9s      1     .test-logs/tests__parcours__messages-acteurs-9bis.test.ts.log
tests/parcours/messages-annulation-9bis.test.ts        FAIL     2.1s      1     .test-logs/tests__parcours__messages-annulation-9bis.test.ts.log
tests/parcours/messages-changement-9bis.test.ts        FAIL     3.9s      1     .test-logs/tests__parcours__messages-changement-9bis.test.ts.log
tests/parcours/messages-comptes-9bis.test.ts           FAIL     3.0s      1     .test-logs/tests__parcours__messages-comptes-9bis.test.ts.log
tests/parcours/messages-fin-9bis.test.ts               FAIL     2.5s      1     .test-logs/tests__parcours__messages-fin-9bis.test.ts.log
tests/parcours/messages-sms-9bis.test.ts               FAIL     2.2s      1     .test-logs/tests__parcours__messages-sms-9bis.test.ts.log
tests/parcours/mot-de-passe-recent.test.ts             FAIL     2.4s      1     .test-logs/tests__parcours__mot-de-passe-recent.test.ts.log
tests/parcours/nettoyage-sur-place.test.ts             FAIL     2.0s      0     .test-logs/tests__parcours__nettoyage-sur-place.test.ts.log
tests/parcours/notif-admin.test.ts                     FAIL     3.1s      1     .test-logs/tests__parcours__notif-admin.test.ts.log
tests/parcours/notif-canaux.test.ts                    FAIL     4.0s      1     .test-logs/tests__parcours__notif-canaux.test.ts.log
tests/parcours/notif-migration.test.ts                 FAIL     1.6s      1     .test-logs/tests__parcours__notif-migration.test.ts.log
tests/parcours/notif-modeles.test.ts                   FAIL     942ms     1     .test-logs/tests__parcours__notif-modeles.test.ts.log
tests/parcours/notif-outbox.test.ts                    FAIL     1.8s      1     .test-logs/tests__parcours__notif-outbox.test.ts.log
tests/parcours/notif-preferences.test.ts               FAIL     3.5s      1     .test-logs/tests__parcours__notif-preferences.test.ts.log
tests/parcours/notif-pros.test.ts                      FAIL     9.2s      1     .test-logs/tests__parcours__notif-pros.test.ts.log
tests/parcours/notif-rappels-annulation.test.ts        FAIL     3.8s      1     .test-logs/tests__parcours__notif-rappels-annulation.test.ts.log
tests/parcours/notif-reglages.test.ts                  FAIL     2.1s      1     .test-logs/tests__parcours__notif-reglages.test.ts.log
tests/parcours/notif-transferts.test.ts                FAIL     3.3s      1     .test-logs/tests__parcours__notif-transferts.test.ts.log
tests/parcours/otp-serveur.test.ts                     FAIL     578ms     1     .test-logs/tests__parcours__otp-serveur.test.ts.log
tests/parcours/paiement-attente-9bis.test.ts           FAIL     3.3s      1     .test-logs/tests__parcours__paiement-attente-9bis.test.ts.log
tests/parcours/paiement-attente-lot7.test.ts           FAIL     3.3s      1     .test-logs/tests__parcours__paiement-attente-lot7.test.ts.log
tests/parcours/paiement-init-relance.test.ts           FAIL     2.5s      1     .test-logs/tests__parcours__paiement-init-relance.test.ts.log
tests/parcours/paiement-prix-minimum.test.ts           FAIL     2.0s      1     .test-logs/tests__parcours__paiement-prix-minimum.test.ts.log
tests/parcours/paiement-reservation-v12.test.ts        FAIL     1.5s      1     .test-logs/tests__parcours__paiement-reservation-v12.test.ts.log
tests/parcours/paiement-succes-tardif-v12.test.ts      FAIL     3.5s      1     .test-logs/tests__parcours__paiement-succes-tardif-v12.test.ts.log
tests/parcours/paiement-webhook-signature.test.ts      FAIL     2.7s      1     .test-logs/tests__parcours__paiement-webhook-signature.test.ts.log
tests/parcours/pannes-absences.test.ts                 FAIL     2.1s      0     .test-logs/tests__parcours__pannes-absences.test.ts.log
tests/parcours/parrainage-boucle-update.test.ts        FAIL     1.6s      0     .test-logs/tests__parcours__parrainage-boucle-update.test.ts.log
tests/parcours/partenaire-en-attente.test.ts           FAIL     1.2s      1     .test-logs/tests__parcours__partenaire-en-attente.test.ts.log
tests/parcours/pilotage-acces.test.ts                  FAIL     12.5s     1     .test-logs/tests__parcours__pilotage-acces.test.ts.log
tests/parcours/pilotage-apercu-ventes.test.ts          FAIL     2.8s      1     .test-logs/tests__parcours__pilotage-apercu-ventes.test.ts.log
tests/parcours/pilotage-equipe-caisse.test.ts          FAIL     3.1s      1     .test-logs/tests__parcours__pilotage-equipe-caisse.test.ts.log
tests/parcours/pilotage-remboursement-billet.test.ts   FAIL     4.0s      1     .test-logs/tests__parcours__pilotage-remboursement-billet.test.ts.log
tests/parcours/remboursement-relance.test.ts           FAIL     2.6s      1     .test-logs/tests__parcours__remboursement-relance.test.ts.log
tests/parcours/scanner-reprise.test.ts                 FAIL     1.2s      1     .test-logs/tests__parcours__scanner-reprise.test.ts.log
tests/parcours/securite-admin-lot7.test.ts             FAIL     3.7s      1     .test-logs/tests__parcours__securite-admin-lot7.test.ts.log
tests/parcours/textes-base-9bis.test.ts                FAIL     4.3s      1     .test-logs/tests__parcours__textes-base-9bis.test.ts.log
tests/parcours/textes-pdf-9bis.test.ts                 FAIL     2.2s      1     .test-logs/tests__parcours__textes-pdf-9bis.test.ts.log
tests/parcours/textes-sms-9bis.test.ts                 FAIL     248ms     1     .test-logs/tests__parcours__textes-sms-9bis.test.ts.log
tests/parcours/versements-frais.test.ts                FAIL     5.3s      1     .test-logs/tests__parcours__versements-frais.test.ts.log
tests/parcours/versements-reprise.test.ts              FAIL     7.5s      1     .test-logs/tests__parcours__versements-reprise.test.ts.log
tests/samirpay-contrat.test.ts                         FAIL     1.8s      1     .test-logs/tests__samirpay-contrat.test.ts.log
tests/schema/essai-check-reel.test.ts                  FAIL     274ms     1     .test-logs/tests__schema__essai-check-reel.test.ts.log
tests/schema/essai-comptes-demo.test.ts                FAIL     1.4s      1     .test-logs/tests__schema__essai-comptes-demo.test.ts.log
tests/schema/essai-faux-samirpay.test.ts               FAIL     1.6s      1     .test-logs/tests__schema__essai-faux-samirpay.test.ts.log
tests/schema/essai-reel-demarrage.test.ts              FAIL     224ms     1     .test-logs/tests__schema__essai-reel-demarrage.test.ts.log
tests/schema/migration-lot9-rejouable.test.ts          FAIL     2.0s      0     .test-logs/tests__schema__migration-lot9-rejouable.test.ts.log
tests/schema/migration-lot9bis-rejouable.test.ts       FAIL     2.0s      1     .test-logs/tests__schema__migration-lot9bis-rejouable.test.ts.log
tests/schema/recette-matrice.test.ts                   FAIL     324ms     1     .test-logs/tests__schema__recette-matrice.test.ts.log
tests/schema/samirpay-v12-statique.test.ts             FAIL     508ms     1     .test-logs/tests__schema__samirpay-v12-statique.test.ts.log
tests/schema/textes-techniques-9bis.test.ts            FAIL     490ms     1     .test-logs/tests__schema__textes-techniques-9bis.test.ts.log
tests/security/r22-reglages-notif.test.ts              FAIL     487ms     1     .test-logs/tests__security__r22-reglages-notif.test.ts.log
tests/security/r27-avatars.test.ts                     FAIL     3.2s      0     .test-logs/tests__security__r27-avatars.test.ts.log
tests/security/r28-middleware-matrice.test.ts          FAIL     1.9s      1     .test-logs/tests__security__r28-middleware-matrice.test.ts.log
tests/security/r3-fonctions-rpc.test.ts                FAIL     1.6s      1     .test-logs/tests__security__r3-fonctions-rpc.test.ts.log
tests/security/r7-profil-colonnes.test.ts              FAIL     670ms     1     .test-logs/tests__security__r7-profil-colonnes.test.ts.log
TOTAL : 307 suite(s) — 181 réussie(s), 126 en échec, 0 expirée(s)
[verify] ÉCHEC à l'étape "test" (code 1).

$ cat docs/lot9bis-logs/ci-run118-run.txt
run_id=42942347516
run_number=118
sha=44d850c13ce1278617f8213a947f0c22d75540e6
ref=refs/heads/lot9bis/cycle-evenement
job_status=failure
build_mesure=success
e2e_seed=success
e2e=failure
url=https://github.com/fallouu-mn/event-village/actions/runs/42942347516
job_elapsed_s=2793
npm_version=10.9.9
etape_npm-ci=debut_s:5 duree_s:46 code:0
etape_supabase-start=debut_s:54 duree_s:80 code:0
etape_db-reset=debut_s:134 duree_s:27 code:0
etape_env-test=debut_s:161 duree_s:1 code:0
etape_seed-test=debut_s:162 duree_s:1 code:0
etape_verify=debut_s:163 duree_s:949 code:1
etape_build-mesure=debut_s:1112 duree_s:45 code:0
etape_e2e-chromium=debut_s:1160 duree_s:8 code:0
etape_e2e-env=debut_s:1168 duree_s:1 code:0
etape_e2e-seed=debut_s:1169 duree_s:46 code:0
etape_e2e-demarrage=debut_s:1215 duree_s:2 code:0
etape_e2e=debut_s:1217 duree_s:1566 code:1
etape_diagnostic-conteneurs=debut_s:2783 duree_s:0 code:0

$ grep -E "\[e2e\] (durées|résumé)" docs/lot9bis-logs/ci-run118-e2e.log
[e2e] durées : connexion 11s · captures 1134s · emails 6s · dev-page 4s · fumee 22s · terrain 126s · pwa 4s · fake-prod 4s · perf 189s · recette 66s — total 1566s (26.1 min)
[e2e] résumé :connexion OK · captures ÉCHEC · emails OK · dev-page OK · fumee OK · terrain OK · pwa OK · fake-prod ÉCHEC · perf OK · recette OK

$ cat docs/lot9bis-logs/ci-run118-js-budget.tsv
route	fichiers	octets_gzip	octets_bruts	budget	statut
/	18	216802	746743	217000	OK
/events/[id]	17	221940	768358	224000	OK
/tickets	21	239012	816890	241000	OK
/controller/scanner	18	223076	769322	226000	OK
/billet/hors-ligne	16	212702	736817	215000	OK
```

### 7.3 Run « après » : run 125 (`a8e49e3`)

```text
$ git show origin/ci-results:runs/125-43128293638/run.txt
run_id=43128293638
run_number=125
sha=a8e49e3fa8bc5ba0917fa12f21f1284ccf48ac08
ref=refs/heads/lot9bis/cycle-evenement
job_status=success
build_mesure=skipped
e2e_seed=success
e2e=success
url=https://github.com/fallouu-mn/event-village/actions/runs/43128293638
job_elapsed_s=2973
npm_version=10.9.9
etape_npm-ci=debut_s:9 duree_s:61 code:0
etape_supabase-start=debut_s:72 duree_s:68 code:0
etape_db-reset=debut_s:140 duree_s:29 code:0
etape_env-test=debut_s:169 duree_s:1 code:0
etape_seed-test=debut_s:170 duree_s:1 code:0
etape_verify=debut_s:171 duree_s:1232 code:0
etape_e2e-chromium=debut_s:1407 duree_s:10 code:0
etape_e2e-env=debut_s:1417 duree_s:1 code:0
etape_e2e-seed=debut_s:1418 duree_s:52 code:0
etape_e2e-demarrage=debut_s:1470 duree_s:2 code:0
etape_e2e=debut_s:1472 duree_s:1487 code:0

$ git show origin/ci-results:runs/125-43128293638/verify.log | sed -n '/RÉCAPITULATIF/,/^TOTAL :/p'   # dernier récapitulatif
═══════════════════ RÉCAPITULATIF ═══════════════════
Suite                                                  Statut   Durée     Code  Journal
tests/fondations-lot0.test.ts                          PASS     517ms     0     .test-logs/tests__fondations-lot0.test.ts.log
tests/notifications-and-documents.test.ts              PASS     284ms     0     .test-logs/tests__notifications-and-documents.test.ts.log
tests/parcours/acces-caisse-pin.test.ts                PASS     3.5s      0     .test-logs/tests__parcours__acces-caisse-pin.test.ts.log
tests/parcours/acces-encaissement.test.ts              PASS     1.3s      0     .test-logs/tests__parcours__acces-encaissement.test.ts.log
tests/parcours/acces-fenetre.test.ts                   PASS     1.8s      0     .test-logs/tests__parcours__acces-fenetre.test.ts.log
tests/parcours/acces-guichet.test.ts                   PASS     2.1s      0     .test-logs/tests__parcours__acces-guichet.test.ts.log
tests/parcours/acces-invariant.test.ts                 PASS     451ms     0     .test-logs/tests__parcours__acces-invariant.test.ts.log
tests/parcours/acces-limiteurs.test.ts                 PASS     4.4s      0     .test-logs/tests__parcours__acces-limiteurs.test.ts.log
tests/parcours/acces-messages.test.ts                  PASS     756ms     0     .test-logs/tests__parcours__acces-messages.test.ts.log
tests/parcours/acces-pilotage.test.ts                  PASS     18.0s     0     .test-logs/tests__parcours__acces-pilotage.test.ts.log
tests/parcours/acces-qr.test.ts                        PASS     1.9s      0     .test-logs/tests__parcours__acces-qr.test.ts.log
tests/parcours/acces-reglages.test.ts                  PASS     1.4s      0     .test-logs/tests__parcours__acces-reglages.test.ts.log
tests/parcours/acces-scan.test.ts                      PASS     2.2s      0     .test-logs/tests__parcours__acces-scan.test.ts.log
tests/parcours/acces-securite-urgente.test.ts          PASS     2.3s      0     .test-logs/tests__parcours__acces-securite-urgente.test.ts.log
tests/parcours/acces-totp.test.ts                      PASS     2.5s      0     .test-logs/tests__parcours__acces-totp.test.ts.log
tests/parcours/acces-tracabilite.test.ts               PASS     2.7s      0     .test-logs/tests__parcours__acces-tracabilite.test.ts.log
tests/parcours/achat-serveur.test.ts                   PASS     653ms     0     .test-logs/tests__parcours__achat-serveur.test.ts.log
tests/parcours/activation-controleur.test.ts           PASS     5.2s      0     .test-logs/tests__parcours__activation-controleur.test.ts.log
tests/parcours/admin-audit-lot9.test.ts                PASS     1.6s      0     .test-logs/tests__parcours__admin-audit-lot9.test.ts.log
tests/parcours/admin-audit.test.ts                     PASS     2.0s      0     .test-logs/tests__parcours__admin-audit.test.ts.log
tests/parcours/admin-evenements.test.ts                PASS     4.4s      0     .test-logs/tests__parcours__admin-evenements.test.ts.log
tests/parcours/admin-parrainage.test.ts                PASS     814ms     0     .test-logs/tests__parcours__admin-parrainage.test.ts.log
tests/parcours/admin-remboursements.test.ts            PASS     4.3s      0     .test-logs/tests__parcours__admin-remboursements.test.ts.log
tests/parcours/admin-services-mention.test.ts          PASS     589ms     0     .test-logs/tests__parcours__admin-services-mention.test.ts.log
tests/parcours/anonymisation-debogage.test.ts          PASS     1.3s      0     .test-logs/tests__parcours__anonymisation-debogage.test.ts.log
tests/parcours/attribution-roles.test.ts               PASS     1.3s      0     .test-logs/tests__parcours__attribution-roles.test.ts.log
tests/parcours/audit-logs-rls.test.ts                  PASS     1.1s      0     .test-logs/tests__parcours__audit-logs-rls.test.ts.log
tests/parcours/audit-transactionnel.test.ts            PASS     4.0s      0     .test-logs/tests__parcours__audit-transactionnel.test.ts.log
tests/parcours/bootstrap-superadmin.test.ts            PASS     548ms     0     .test-logs/tests__parcours__bootstrap-superadmin.test.ts.log
tests/parcours/canaux-interface.test.ts                PASS     539ms     0     .test-logs/tests__parcours__canaux-interface.test.ts.log
tests/parcours/canaux-invariant.test.ts                PASS     1.8s      0     .test-logs/tests__parcours__canaux-invariant.test.ts.log
tests/parcours/canaux-vente.test.ts                    PASS     5.5s      0     .test-logs/tests__parcours__canaux-vente.test.ts.log
tests/parcours/changement-role-admin.test.ts           PASS     974ms     0     .test-logs/tests__parcours__changement-role-admin.test.ts.log
tests/parcours/client-interface.test.ts                PASS     1.3s      0     .test-logs/tests__parcours__client-interface.test.ts.log
tests/parcours/cloture-vocabulaire.test.ts             PASS     1.4s      0     .test-logs/tests__parcours__cloture-vocabulaire.test.ts.log
tests/parcours/commissions-fin-evenement.test.ts       PASS     3.1s      0     .test-logs/tests__parcours__commissions-fin-evenement.test.ts.log
tests/parcours/commissions-plafond.test.ts             PASS     6.1s      0     .test-logs/tests__parcours__commissions-plafond.test.ts.log
tests/parcours/compte-mot-de-passe.test.ts             PASS     3.0s      0     .test-logs/tests__parcours__compte-mot-de-passe.test.ts.log
tests/parcours/compte-numero.test.ts                   PASS     16.4s     0     .test-logs/tests__parcours__compte-numero.test.ts.log
tests/parcours/compte-paiements.test.ts                PASS     4.4s      0     .test-logs/tests__parcours__compte-paiements.test.ts.log
tests/parcours/compte-photo.test.ts                    PASS     8.0s      0     .test-logs/tests__parcours__compte-photo.test.ts.log
tests/parcours/compte-profil.test.ts                   PASS     7.4s      0     .test-logs/tests__parcours__compte-profil.test.ts.log
tests/parcours/confirmation-achat.test.ts              PASS     2.8s      0     .test-logs/tests__parcours__confirmation-achat.test.ts.log
tests/parcours/connexion-serveur.test.ts               PASS     2.2s      0     .test-logs/tests__parcours__connexion-serveur.test.ts.log
tests/parcours/controleur-9bis.test.ts                 PASS     2.3s      0     .test-logs/tests__parcours__controleur-9bis.test.ts.log
tests/parcours/course-annulation-transfert.test.ts     PASS     3.5s      0     .test-logs/tests__parcours__course-annulation-transfert.test.ts.log
tests/parcours/course-confirmation-annulation.test.ts  PASS     2.8s      0     .test-logs/tests__parcours__course-confirmation-annulation.test.ts.log
tests/parcours/course-verrous-lot9.test.ts             PASS     3.3s      0     .test-logs/tests__parcours__course-verrous-lot9.test.ts.log
tests/parcours/course-verrous-lot9bis.test.ts          PASS     2.0s      0     .test-logs/tests__parcours__course-verrous-lot9bis.test.ts.log
tests/parcours/cycle-annulation.test.ts                PASS     12.0s     0     .test-logs/tests__parcours__cycle-annulation.test.ts.log
tests/parcours/cycle-cron.test.ts                      PASS     2.2s      0     .test-logs/tests__parcours__cycle-cron.test.ts.log
tests/parcours/cycle-invariant.test.ts                 PASS     1.5s      0     .test-logs/tests__parcours__cycle-invariant.test.ts.log
tests/parcours/cycle-transitions.test.ts               PASS     14.4s     0     .test-logs/tests__parcours__cycle-transitions.test.ts.log
tests/parcours/cycle-visibilite.test.ts                PASS     1.7s      0     .test-logs/tests__parcours__cycle-visibilite.test.ts.log
tests/parcours/cycle9bis-annulation-en-cours.test.ts   PASS     2.3s      0     .test-logs/tests__parcours__cycle9bis-annulation-en-cours.test.ts.log
tests/parcours/cycle9bis-billet-pdf.test.ts            PASS     232ms     0     .test-logs/tests__parcours__cycle9bis-billet-pdf.test.ts.log
tests/parcours/cycle9bis-caisse.test.ts                PASS     4.8s      0     .test-logs/tests__parcours__cycle9bis-caisse.test.ts.log
tests/parcours/cycle9bis-carte-billet.test.ts          PASS     3.2s      0     .test-logs/tests__parcours__cycle9bis-carte-billet.test.ts.log
tests/parcours/cycle9bis-cloture-admin.test.ts         PASS     2.9s      0     .test-logs/tests__parcours__cycle9bis-cloture-admin.test.ts.log
tests/parcours/cycle9bis-equipe.test.ts                PASS     3.4s      0     .test-logs/tests__parcours__cycle9bis-equipe.test.ts.log
tests/parcours/cycle9bis-fenetre-scan.test.ts          PASS     2.2s      0     .test-logs/tests__parcours__cycle9bis-fenetre-scan.test.ts.log
tests/parcours/cycle9bis-soumission-fiche.test.ts      PASS     1.9s      0     .test-logs/tests__parcours__cycle9bis-soumission-fiche.test.ts.log
tests/parcours/cycle9bis-transfert.test.ts             PASS     5.5s      0     .test-logs/tests__parcours__cycle9bis-transfert.test.ts.log
tests/parcours/cycle9bis-ventes-canal.test.ts          PASS     1.8s      0     .test-logs/tests__parcours__cycle9bis-ventes-canal.test.ts.log
tests/parcours/decouverte-cache.test.ts                PASS     341ms     0     .test-logs/tests__parcours__decouverte-cache.test.ts.log
tests/parcours/decouverte-ecrans.test.ts               PASS     324ms     0     .test-logs/tests__parcours__decouverte-ecrans.test.ts.log
tests/parcours/decouverte-populaires.test.ts           PASS     3.2s      0     .test-logs/tests__parcours__decouverte-populaires.test.ts.log
tests/parcours/decouverte-recherche-lot9.test.ts       PASS     1.4s      0     .test-logs/tests__parcours__decouverte-recherche-lot9.test.ts.log
tests/parcours/decouverte-recherche-lot9bis.test.ts    PASS     1.5s      0     .test-logs/tests__parcours__decouverte-recherche-lot9bis.test.ts.log
tests/parcours/decouverte-recherche.test.ts            PASS     1.3s      0     .test-logs/tests__parcours__decouverte-recherche.test.ts.log
tests/parcours/decouverte-ville.test.ts                PASS     2.1s      0     .test-logs/tests__parcours__decouverte-ville.test.ts.log
tests/parcours/design-systeme.test.ts                  PASS     2.5s      0     .test-logs/tests__parcours__design-systeme.test.ts.log
tests/parcours/dette-admin-services.test.ts            PASS     1.5s      0     .test-logs/tests__parcours__dette-admin-services.test.ts.log
tests/parcours/dette-annulation-transferts.test.ts     PASS     2.6s      0     .test-logs/tests__parcours__dette-annulation-transferts.test.ts.log
tests/parcours/dette-categories-publiques.test.ts      PASS     1.8s      0     .test-logs/tests__parcours__dette-categories-publiques.test.ts.log
tests/parcours/dette-cloture-caisse.test.ts            PASS     3.9s      0     .test-logs/tests__parcours__dette-cloture-caisse.test.ts.log
tests/parcours/dette-guichet.test.ts                   PASS     1.5s      0     .test-logs/tests__parcours__dette-guichet.test.ts.log
tests/parcours/dette-incidents.test.ts                 PASS     6.3s      0     .test-logs/tests__parcours__dette-incidents.test.ts.log
tests/parcours/dette-interface-lot7.test.ts            PASS     3.1s      0     .test-logs/tests__parcours__dette-interface-lot7.test.ts.log
tests/parcours/dette-publication-reservations.test.ts  PASS     21.4s     0     .test-logs/tests__parcours__dette-publication-reservations.test.ts.log
tests/parcours/dette-retrait-controleur.test.ts        PASS     3.0s      0     .test-logs/tests__parcours__dette-retrait-controleur.test.ts.log
tests/parcours/dette-roles-otp.test.ts                 PASS     1.7s      0     .test-logs/tests__parcours__dette-roles-otp.test.ts.log
tests/parcours/dette-suppression-evenement.test.ts     PASS     2.0s      0     .test-logs/tests__parcours__dette-suppression-evenement.test.ts.log
tests/parcours/dette-suspendu-temps-reel.test.ts       PASS     52.7s     0     .test-logs/tests__parcours__dette-suspendu-temps-reel.test.ts.log
tests/parcours/dette-transferts.test.ts                PASS     2.0s      0     .test-logs/tests__parcours__dette-transferts.test.ts.log
tests/parcours/documents-inscription.test.ts           PASS     2.0s      0     .test-logs/tests__parcours__documents-inscription.test.ts.log
tests/parcours/dossier-partenaire-9bis.test.ts         PASS     2.5s      0     .test-logs/tests__parcours__dossier-partenaire-9bis.test.ts.log
tests/parcours/double-paiement.test.ts                 PASS     5.4s      0     .test-logs/tests__parcours__double-paiement.test.ts.log
tests/parcours/droits-admin-9bis.test.ts               PASS     2.7s      0     .test-logs/tests__parcours__droits-admin-9bis.test.ts.log
tests/parcours/droits-boutons-9bis.test.ts             PASS     3.3s      0     .test-logs/tests__parcours__droits-boutons-9bis.test.ts.log
tests/parcours/droits-partenaire-9bis.test.ts          PASS     7.1s      0     .test-logs/tests__parcours__droits-partenaire-9bis.test.ts.log
tests/parcours/ecritures-ignorees.test.ts              PASS     3.5s      0     .test-logs/tests__parcours__ecritures-ignorees.test.ts.log
tests/parcours/edition-categories.test.ts              PASS     2.5s      0     .test-logs/tests__parcours__edition-categories.test.ts.log
tests/parcours/edition-formulaire.test.ts              PASS     5.3s      0     .test-logs/tests__parcours__edition-formulaire.test.ts.log
tests/parcours/edition-services.test.ts                PASS     957ms     0     .test-logs/tests__parcours__edition-services.test.ts.log
tests/parcours/edition-validation.test.ts              PASS     988ms     0     .test-logs/tests__parcours__edition-validation.test.ts.log
tests/parcours/email-optionnel.test.ts                 PASS     1.4s      0     .test-logs/tests__parcours__email-optionnel.test.ts.log
tests/parcours/email-regle-envoi.test.ts               PASS     8.1s      0     .test-logs/tests__parcours__email-regle-envoi.test.ts.log
tests/parcours/email-verification.test.ts              PASS     6.5s      0     .test-logs/tests__parcours__email-verification.test.ts.log
tests/parcours/equipe-eligibilite.test.ts              PASS     4.1s      0     .test-logs/tests__parcours__equipe-eligibilite.test.ts.log
tests/parcours/essai-check-reel.test.ts                PASS     1.6s      0     .test-logs/tests__parcours__essai-check-reel.test.ts.log
tests/parcours/essai-comptes-demo.test.ts              PASS     2.8s      0     .test-logs/tests__parcours__essai-comptes-demo.test.ts.log
tests/parcours/essai-middleware.test.ts                PASS     638ms     0     .test-logs/tests__parcours__essai-middleware.test.ts.log
tests/parcours/essai-seed-dev-9bis.test.ts             PASS     2.1s      0     .test-logs/tests__parcours__essai-seed-dev-9bis.test.ts.log
tests/parcours/essai-seed-dev.test.ts                  PASS     2.2s      0     .test-logs/tests__parcours__essai-seed-dev.test.ts.log
tests/parcours/essai-simule.test.ts                    PASS     8.3s      0     .test-logs/tests__parcours__essai-simule.test.ts.log
tests/parcours/evenement-404.test.ts                   PASS     2.3s      0     .test-logs/tests__parcours__evenement-404.test.ts.log
tests/parcours/fiche-partenaire-9bis.test.ts           PASS     3.5s      0     .test-logs/tests__parcours__fiche-partenaire-9bis.test.ts.log
tests/parcours/filtres-postgrest.test.ts               PASS     513ms     0     .test-logs/tests__parcours__filtres-postgrest.test.ts.log
tests/parcours/finance-affichage.test.ts               PASS     1.4s      0     .test-logs/tests__parcours__finance-affichage.test.ts.log
tests/parcours/finance-annulation.test.ts              PASS     2.3s      0     .test-logs/tests__parcours__finance-annulation.test.ts.log
tests/parcours/finance-cibles.test.ts                  PASS     2.1s      0     .test-logs/tests__parcours__finance-cibles.test.ts.log
tests/parcours/finance-commissions.test.ts             PASS     4.8s      0     .test-logs/tests__parcours__finance-commissions.test.ts.log
tests/parcours/finance-hors-plateforme.test.ts         PASS     1.4s      0     .test-logs/tests__parcours__finance-hors-plateforme.test.ts.log
tests/parcours/finance-invariant.test.ts               PASS     503ms     0     .test-logs/tests__parcours__finance-invariant.test.ts.log
tests/parcours/finance-moteur.test.ts                  PASS     1.5s      0     .test-logs/tests__parcours__finance-moteur.test.ts.log
tests/parcours/finance-rapports.test.ts                PASS     1.5s      0     .test-logs/tests__parcours__finance-rapports.test.ts.log
tests/parcours/finance-reglages.test.ts                PASS     1.5s      0     .test-logs/tests__parcours__finance-reglages.test.ts.log
tests/parcours/finance-remboursement-billet.test.ts    PASS     2.4s      0     .test-logs/tests__parcours__finance-remboursement-billet.test.ts.log
tests/parcours/finance-retraits.test.ts                PASS     7.4s      0     .test-logs/tests__parcours__finance-retraits.test.ts.log
tests/parcours/hors-ligne-client.test.ts               PASS     1.7s      0     .test-logs/tests__parcours__hors-ligne-client.test.ts.log
tests/parcours/hors-ligne-codes.test.ts                PASS     11.9s     0     .test-logs/tests__parcours__hors-ligne-codes.test.ts.log
tests/parcours/hors-ligne-rotation.test.ts             PASS     7.3s      0     .test-logs/tests__parcours__hors-ligne-rotation.test.ts.log
tests/parcours/hors-ligne-service-worker.test.ts       PASS     2.4s      0     .test-logs/tests__parcours__hors-ligne-service-worker.test.ts.log
tests/parcours/inscription-numero-dabord.test.ts       PASS     3.0s      0     .test-logs/tests__parcours__inscription-numero-dabord.test.ts.log
tests/parcours/interrupteurs.test.ts                   PASS     3.6s      0     .test-logs/tests__parcours__interrupteurs.test.ts.log
tests/parcours/invitation-identite.test.ts             PASS     1.5s      0     .test-logs/tests__parcours__invitation-identite.test.ts.log
tests/parcours/invitations-annulation.test.ts          PASS     4.5s      0     .test-logs/tests__parcours__invitations-annulation.test.ts.log
tests/parcours/invitations-controleur-quota.test.ts    PASS     2.9s      0     .test-logs/tests__parcours__invitations-controleur-quota.test.ts.log
tests/parcours/invitations-course.test.ts              PASS     2.5s      0     .test-logs/tests__parcours__invitations-course.test.ts.log
tests/parcours/invitations-quotas.test.ts              PASS     2.9s      0     .test-logs/tests__parcours__invitations-quotas.test.ts.log
tests/parcours/invitations-reclamation.test.ts         PASS     3.6s      0     .test-logs/tests__parcours__invitations-reclamation.test.ts.log
tests/parcours/invitations.test.ts                     PASS     7.1s      0     .test-logs/tests__parcours__invitations.test.ts.log
tests/parcours/lectures-ignorees.test.ts               PASS     5.2s      0     .test-logs/tests__parcours__lectures-ignorees.test.ts.log
tests/parcours/legacy-billet-pdf.test.ts               PASS     2.9s      0     .test-logs/tests__parcours__legacy-billet-pdf.test.ts.log
tests/parcours/legacy-exports-partenaire.test.ts       PASS     2.7s      0     .test-logs/tests__parcours__legacy-exports-partenaire.test.ts.log
tests/parcours/lot9-invariant.test.ts                  PASS     2.5s      0     .test-logs/tests__parcours__lot9-invariant.test.ts.log
tests/parcours/lot9bis-abonnement.test.ts              PASS     1.8s      0     .test-logs/tests__parcours__lot9bis-abonnement.test.ts.log
tests/parcours/lot9bis-fonds-suspension.test.ts        PASS     7.9s      0     .test-logs/tests__parcours__lot9bis-fonds-suspension.test.ts.log
tests/parcours/lot9bis-guichet-annulation.test.ts      PASS     3.2s      0     .test-logs/tests__parcours__lot9bis-guichet-annulation.test.ts.log
tests/parcours/lot9bis-invariant.test.ts               PASS     7.6s      0     .test-logs/tests__parcours__lot9bis-invariant.test.ts.log
tests/parcours/lot9bis-remboursement-fin.test.ts       PASS     5.6s      0     .test-logs/tests__parcours__lot9bis-remboursement-fin.test.ts.log
tests/parcours/lot9bis-report.test.ts                  PASS     5.1s      0     .test-logs/tests__parcours__lot9bis-report.test.ts.log
tests/parcours/lot9bis-retrait-devis.test.ts           PASS     2.2s      0     .test-logs/tests__parcours__lot9bis-retrait-devis.test.ts.log
tests/parcours/lot9bis-verrou-numero.test.ts           PASS     4.2s      0     .test-logs/tests__parcours__lot9bis-verrou-numero.test.ts.log
tests/parcours/messages-acteurs-9bis.test.ts           PASS     4.3s      0     .test-logs/tests__parcours__messages-acteurs-9bis.test.ts.log
tests/parcours/messages-annulation-9bis.test.ts        PASS     3.9s      0     .test-logs/tests__parcours__messages-annulation-9bis.test.ts.log
tests/parcours/messages-bruts.test.ts                  PASS     2.5s      0     .test-logs/tests__parcours__messages-bruts.test.ts.log
tests/parcours/messages-changement-9bis.test.ts        PASS     7.2s      0     .test-logs/tests__parcours__messages-changement-9bis.test.ts.log
tests/parcours/messages-comptes-9bis.test.ts           PASS     4.7s      0     .test-logs/tests__parcours__messages-comptes-9bis.test.ts.log
tests/parcours/messages-fin-9bis.test.ts               PASS     4.4s      0     .test-logs/tests__parcours__messages-fin-9bis.test.ts.log
tests/parcours/messages-sms-9bis.test.ts               PASS     4.3s      0     .test-logs/tests__parcours__messages-sms-9bis.test.ts.log
tests/parcours/mot-de-passe-recent.test.ts             PASS     4.1s      0     .test-logs/tests__parcours__mot-de-passe-recent.test.ts.log
tests/parcours/nettoyage-sur-place.test.ts             PASS     2.4s      0     .test-logs/tests__parcours__nettoyage-sur-place.test.ts.log
tests/parcours/notif-abonnement.test.ts                PASS     1.5s      0     .test-logs/tests__parcours__notif-abonnement.test.ts.log
tests/parcours/notif-admin.test.ts                     PASS     5.0s      0     .test-logs/tests__parcours__notif-admin.test.ts.log
tests/parcours/notif-admins.test.ts                    PASS     6.5s      0     .test-logs/tests__parcours__notif-admins.test.ts.log
tests/parcours/notif-canaux.test.ts                    PASS     5.7s      0     .test-logs/tests__parcours__notif-canaux.test.ts.log
tests/parcours/notif-cloche.test.ts                    PASS     17.1s     0     .test-logs/tests__parcours__notif-cloche.test.ts.log
tests/parcours/notif-controleurs.test.ts               PASS     5.3s      0     .test-logs/tests__parcours__notif-controleurs.test.ts.log
tests/parcours/notif-envoyeur.test.ts                  PASS     3.7s      0     .test-logs/tests__parcours__notif-envoyeur.test.ts.log
tests/parcours/notif-interface.test.ts                 PASS     3.0s      0     .test-logs/tests__parcours__notif-interface.test.ts.log
tests/parcours/notif-invariant.test.ts                 PASS     2.5s      0     .test-logs/tests__parcours__notif-invariant.test.ts.log
tests/parcours/notif-migration.test.ts                 PASS     2.0s      0     .test-logs/tests__parcours__notif-migration.test.ts.log
tests/parcours/notif-modeles.test.ts                   PASS     1.3s      0     .test-logs/tests__parcours__notif-modeles.test.ts.log
tests/parcours/notif-outbox.test.ts                    PASS     2.3s      0     .test-logs/tests__parcours__notif-outbox.test.ts.log
tests/parcours/notif-preferences.test.ts               PASS     4.2s      0     .test-logs/tests__parcours__notif-preferences.test.ts.log
tests/parcours/notif-pros.test.ts                      PASS     11.9s     0     .test-logs/tests__parcours__notif-pros.test.ts.log
tests/parcours/notif-rappels-annulation.test.ts        PASS     5.2s      0     .test-logs/tests__parcours__notif-rappels-annulation.test.ts.log
tests/parcours/notif-rappels.test.ts                   PASS     7.8s      0     .test-logs/tests__parcours__notif-rappels.test.ts.log
tests/parcours/notif-reglages.test.ts                  PASS     3.2s      0     .test-logs/tests__parcours__notif-reglages.test.ts.log
tests/parcours/notif-transferts.test.ts                PASS     4.7s      0     .test-logs/tests__parcours__notif-transferts.test.ts.log
tests/parcours/otp-hachage.test.ts                     PASS     454ms     0     .test-logs/tests__parcours__otp-hachage.test.ts.log
tests/parcours/otp-objet.test.ts                       PASS     1.6s      0     .test-logs/tests__parcours__otp-objet.test.ts.log
tests/parcours/otp-serveur.test.ts                     PASS     901ms     0     .test-logs/tests__parcours__otp-serveur.test.ts.log
tests/parcours/paiement-attente-9bis.test.ts           PASS     4.5s      0     .test-logs/tests__parcours__paiement-attente-9bis.test.ts.log
tests/parcours/paiement-attente-lot7.test.ts           PASS     3.8s      0     .test-logs/tests__parcours__paiement-attente-lot7.test.ts.log
tests/parcours/paiement-confirmation.test.ts           PASS     1.5s      0     .test-logs/tests__parcours__paiement-confirmation.test.ts.log
tests/parcours/paiement-controles.test.ts              PASS     2.1s      0     .test-logs/tests__parcours__paiement-controles.test.ts.log
tests/parcours/paiement-gratuits.test.ts               PASS     1.7s      0     .test-logs/tests__parcours__paiement-gratuits.test.ts.log
tests/parcours/paiement-init-relance.test.ts           PASS     3.2s      0     .test-logs/tests__parcours__paiement-init-relance.test.ts.log
tests/parcours/paiement-operateur.test.ts              PASS     889ms     0     .test-logs/tests__parcours__paiement-operateur.test.ts.log
tests/parcours/paiement-prix-minimum.test.ts           PASS     2.3s      0     .test-logs/tests__parcours__paiement-prix-minimum.test.ts.log
tests/parcours/paiement-reconciliation.test.ts         PASS     1.6s      0     .test-logs/tests__parcours__paiement-reconciliation.test.ts.log
tests/parcours/paiement-remboursement.test.ts          PASS     1.9s      0     .test-logs/tests__parcours__paiement-remboursement.test.ts.log
tests/parcours/paiement-reservation-v12.test.ts        PASS     2.8s      0     .test-logs/tests__parcours__paiement-reservation-v12.test.ts.log
tests/parcours/paiement-reservation.test.ts            PASS     2.0s      0     .test-logs/tests__parcours__paiement-reservation.test.ts.log
tests/parcours/paiement-retour.test.ts                 PASS     817ms     0     .test-logs/tests__parcours__paiement-retour.test.ts.log
tests/parcours/paiement-statut.test.ts                 PASS     1.3s      0     .test-logs/tests__parcours__paiement-statut.test.ts.log
tests/parcours/paiement-succes-tardif-v12.test.ts      PASS     5.1s      0     .test-logs/tests__parcours__paiement-succes-tardif-v12.test.ts.log
tests/parcours/paiement-webhook-signature.test.ts      PASS     3.9s      0     .test-logs/tests__parcours__paiement-webhook-signature.test.ts.log
tests/parcours/paiement-webhook.test.ts                PASS     2.3s      0     .test-logs/tests__parcours__paiement-webhook.test.ts.log
tests/parcours/pannes-absences.test.ts                 PASS     2.6s      0     .test-logs/tests__parcours__pannes-absences.test.ts.log
tests/parcours/parrainage-boucle-update.test.ts        PASS     2.1s      0     .test-logs/tests__parcours__parrainage-boucle-update.test.ts.log
tests/parcours/parrainage-gardes.test.ts               PASS     2.0s      0     .test-logs/tests__parcours__parrainage-gardes.test.ts.log
tests/parcours/parrainage-lien.test.ts                 PASS     2.7s      0     .test-logs/tests__parcours__parrainage-lien.test.ts.log
tests/parcours/partenaire-en-attente.test.ts           PASS     2.4s      0     .test-logs/tests__parcours__partenaire-en-attente.test.ts.log
tests/parcours/partenaire-liste.test.ts                PASS     3.1s      0     .test-logs/tests__parcours__partenaire-liste.test.ts.log
tests/parcours/partenaire-lot7.test.ts                 PASS     6.6s      0     .test-logs/tests__parcours__partenaire-lot7.test.ts.log
tests/parcours/partenaire-profil-rpc.test.ts           PASS     5.4s      0     .test-logs/tests__parcours__partenaire-profil-rpc.test.ts.log
tests/parcours/perf-statique.test.ts                   PASS     3.6s      0     .test-logs/tests__parcours__perf-statique.test.ts.log
tests/parcours/pilotage-acces.test.ts                  PASS     13.0s     0     .test-logs/tests__parcours__pilotage-acces.test.ts.log
tests/parcours/pilotage-apercu-ventes.test.ts          PASS     3.7s      0     .test-logs/tests__parcours__pilotage-apercu-ventes.test.ts.log
tests/parcours/pilotage-cloture-export.test.ts         PASS     5.7s      0     .test-logs/tests__parcours__pilotage-cloture-export.test.ts.log
tests/parcours/pilotage-entrees.test.ts                PASS     17.9s     0     .test-logs/tests__parcours__pilotage-entrees.test.ts.log
tests/parcours/pilotage-equipe-caisse.test.ts          PASS     3.6s      0     .test-logs/tests__parcours__pilotage-equipe-caisse.test.ts.log
tests/parcours/pilotage-invariant.test.ts              PASS     4.5s      0     .test-logs/tests__parcours__pilotage-invariant.test.ts.log
tests/parcours/pilotage-remboursement-billet.test.ts   PASS     5.1s      0     .test-logs/tests__parcours__pilotage-remboursement-billet.test.ts.log
tests/parcours/pin-regisseur.test.ts                   PASS     421ms     0     .test-logs/tests__parcours__pin-regisseur.test.ts.log
tests/parcours/push-abonnements.test.ts                PASS     4.8s      0     .test-logs/tests__parcours__push-abonnements.test.ts.log
tests/parcours/push-service-worker.test.ts             PASS     2.2s      0     .test-logs/tests__parcours__push-service-worker.test.ts.log
tests/parcours/pwa-manifest.test.ts                    PASS     1.7s      0     .test-logs/tests__parcours__pwa-manifest.test.ts.log
tests/parcours/rappels-gratuits.test.ts                PASS     4.5s      0     .test-logs/tests__parcours__rappels-gratuits.test.ts.log
tests/parcours/realtime-diagnostic.test.ts             PASS     656ms     0     .test-logs/tests__parcours__realtime-diagnostic.test.ts.log
tests/parcours/realtime-scanner.test.ts                PASS     13.5s     0     .test-logs/tests__parcours__realtime-scanner.test.ts.log
tests/parcours/recette-invariant.test.ts               PASS     2.8s      0     .test-logs/tests__parcours__recette-invariant.test.ts.log
tests/parcours/remboursement-relance.test.ts           PASS     3.7s      0     .test-logs/tests__parcours__remboursement-relance.test.ts.log
tests/parcours/revocation-sessions.test.ts             PASS     1.7s      0     .test-logs/tests__parcours__revocation-sessions.test.ts.log
tests/parcours/roles-fraicheur.test.ts                 PASS     941ms     0     .test-logs/tests__parcours__roles-fraicheur.test.ts.log
tests/parcours/roles-metadonnees.test.ts               PASS     600ms     0     .test-logs/tests__parcours__roles-metadonnees.test.ts.log
tests/parcours/scan-controleur-stats.test.ts           PASS     6.5s      0     .test-logs/tests__parcours__scan-controleur-stats.test.ts.log
tests/parcours/scan-idempotence.test.ts                PASS     4.0s      0     .test-logs/tests__parcours__scan-idempotence.test.ts.log
tests/parcours/scan-renvoi-seulement.test.ts           PASS     5.1s      0     .test-logs/tests__parcours__scan-renvoi-seulement.test.ts.log
tests/parcours/scanner-interface.test.ts               PASS     4.9s      0     .test-logs/tests__parcours__scanner-interface.test.ts.log
tests/parcours/scanner-reprise.test.ts                 PASS     1.5s      0     .test-logs/tests__parcours__scanner-reprise.test.ts.log
tests/parcours/securite-admin-lot7.test.ts             PASS     5.2s      0     .test-logs/tests__parcours__securite-admin-lot7.test.ts.log
tests/parcours/sms-anti-abus.test.ts                   PASS     826ms     0     .test-logs/tests__parcours__sms-anti-abus.test.ts.log
tests/parcours/sms-commande-4-billets.test.ts          PASS     2.0s      0     .test-logs/tests__parcours__sms-commande-4-billets.test.ts.log
tests/parcours/statut-compte.test.ts                   PASS     2.2s      0     .test-logs/tests__parcours__statut-compte.test.ts.log
tests/parcours/temps-reel-billets.test.ts              PASS     32.5s     0     .test-logs/tests__parcours__temps-reel-billets.test.ts.log
tests/parcours/temps-reel-hook.test.ts                 PASS     315ms     0     .test-logs/tests__parcours__temps-reel-hook.test.ts.log
tests/parcours/temps-reel-prives.test.ts               PASS     67.1s     0     .test-logs/tests__parcours__temps-reel-prives.test.ts.log
tests/parcours/temps-reel-public.test.ts               PASS     26.9s     0     .test-logs/tests__parcours__temps-reel-public.test.ts.log
tests/parcours/temps-reel-stock.test.ts                PASS     24.2s     0     .test-logs/tests__parcours__temps-reel-stock.test.ts.log
tests/parcours/sms-plafond-optionnel.test.ts           PASS     11.4s     0     .test-logs/tests__parcours__sms-plafond-optionnel.test.ts.log
tests/parcours/sms-veille.test.ts                      PASS     4.2s      0     .test-logs/tests__parcours__sms-veille.test.ts.log
tests/parcours/terrain-invariant.test.ts               PASS     2.6s      0     .test-logs/tests__parcours__terrain-invariant.test.ts.log
tests/parcours/textes-base-9bis.test.ts                PASS     5.9s      0     .test-logs/tests__parcours__textes-base-9bis.test.ts.log
tests/parcours/textes-pdf-9bis.test.ts                 PASS     3.1s      0     .test-logs/tests__parcours__textes-pdf-9bis.test.ts.log
tests/parcours/textes-sms-9bis.test.ts                 PASS     295ms     0     .test-logs/tests__parcours__textes-sms-9bis.test.ts.log
tests/parcours/versements-frais.test.ts                PASS     8.1s      0     .test-logs/tests__parcours__versements-frais.test.ts.log
tests/parcours/versements-reprise.test.ts              PASS     11.5s     0     .test-logs/tests__parcours__versements-reprise.test.ts.log
tests/partner-halls-m7.test.ts                         PASS     1.4s      0     .test-logs/tests__partner-halls-m7.test.ts.log
tests/partner-orders-m9.test.ts                        PASS     1.5s      0     .test-logs/tests__partner-orders-m9.test.ts.log
tests/samirpay-contrat.test.ts                         PASS     1.8s      0     .test-logs/tests__samirpay-contrat.test.ts.log
tests/scanner-combat-ui.test.ts                        PASS     446ms     0     .test-logs/tests__scanner-combat-ui.test.ts.log
tests/schema/code-mort-lot9.test.ts                    PASS     284ms     0     .test-logs/tests__schema__code-mort-lot9.test.ts.log
tests/schema/documents-prives.test.ts                  PASS     253ms     0     .test-logs/tests__schema__documents-prives.test.ts.log
tests/schema/essai-check-reel.test.ts                  PASS     1.3s      0     .test-logs/tests__schema__essai-check-reel.test.ts.log
tests/schema/essai-comptes-demo.test.ts                PASS     3.1s      0     .test-logs/tests__schema__essai-comptes-demo.test.ts.log
tests/schema/essai-cron-local.test.ts                  PASS     922ms     0     .test-logs/tests__schema__essai-cron-local.test.ts.log
tests/schema/essai-env-local.test.ts                   PASS     725ms     0     .test-logs/tests__schema__essai-env-local.test.ts.log
tests/schema/essai-faux-samirpay.test.ts               PASS     1.6s      0     .test-logs/tests__schema__essai-faux-samirpay.test.ts.log
tests/schema/essai-integrations.test.ts                PASS     5.6s      0     .test-logs/tests__schema__essai-integrations.test.ts.log
tests/schema/essai-reel-demarrage.test.ts              PASS     2.5s      0     .test-logs/tests__schema__essai-reel-demarrage.test.ts.log
tests/schema/essai-route-dev.test.ts                   PASS     280ms     0     .test-logs/tests__schema__essai-route-dev.test.ts.log
tests/schema/essai-seed-gardes.test.ts                 PASS     733ms     0     .test-logs/tests__schema__essai-seed-gardes.test.ts.log
tests/schema/fonctions-privileges.test.ts              PASS     301ms     0     .test-logs/tests__schema__fonctions-privileges.test.ts.log
tests/schema/hotfix-identique.test.ts                  PASS     247ms     0     .test-logs/tests__schema__hotfix-identique.test.ts.log
tests/schema/hotfix-scripts.test.ts                    PASS     686ms     0     .test-logs/tests__schema__hotfix-scripts.test.ts.log
tests/schema/messages-bruts.test.ts                    PASS     1.5s      0     .test-logs/tests__schema__messages-bruts.test.ts.log
tests/schema/migration-lot6-rejouable.test.ts          PASS     438ms     0     .test-logs/tests__schema__migration-lot6-rejouable.test.ts.log
tests/schema/migration-lot7-rejouable.test.ts          PASS     2.7s      0     .test-logs/tests__schema__migration-lot7-rejouable.test.ts.log
tests/schema/migration-lot8-rejouable.test.ts          PASS     3.0s      0     .test-logs/tests__schema__migration-lot8-rejouable.test.ts.log
tests/schema/migration-lot9-rejouable.test.ts          PASS     2.7s      0     .test-logs/tests__schema__migration-lot9-rejouable.test.ts.log
tests/schema/migration-lot9bis-rejouable.test.ts       PASS     3.1s      0     .test-logs/tests__schema__migration-lot9bis-rejouable.test.ts.log
tests/schema/migrations-gelees.test.ts                 PASS     251ms     0     .test-logs/tests__schema__migrations-gelees.test.ts.log
tests/schema/ordre-suites.test.ts                      PASS     478ms     0     .test-logs/tests__schema__ordre-suites.test.ts.log
tests/schema/planification-crons.test.ts               PASS     2.5s      0     .test-logs/tests__schema__planification-crons.test.ts.log
tests/schema/recette-matrice.test.ts                   PASS     356ms     0     .test-logs/tests__schema__recette-matrice.test.ts.log
tests/schema/reset-test-password.test.ts               PASS     260ms     0     .test-logs/tests__schema__reset-test-password.test.ts.log
tests/schema/rls-toutes-tables.test.ts                 PASS     265ms     0     .test-logs/tests__schema__rls-toutes-tables.test.ts.log
tests/schema/samirpay-v12-statique.test.ts             PASS     599ms     0     .test-logs/tests__schema__samirpay-v12-statique.test.ts.log
tests/schema/secrets-codes-en-dur.test.ts              PASS     366ms     0     .test-logs/tests__schema__secrets-codes-en-dur.test.ts.log
tests/schema/textes-techniques-9bis.test.ts            PASS     552ms     0     .test-logs/tests__schema__textes-techniques-9bis.test.ts.log
tests/schema/validations-metier.test.ts                PASS     366ms     0     .test-logs/tests__schema__validations-metier.test.ts.log
tests/security/anon-uniquement.test.ts                 PASS     243ms     0     .test-logs/tests__security__anon-uniquement.test.ts.log
tests/security/r1-inscription-roles.test.ts            PASS     1.2s      0     .test-logs/tests__security__r1-inscription-roles.test.ts.log
tests/security/r10-user-roles.test.ts                  PASS     1.5s      0     .test-logs/tests__security__r10-user-roles.test.ts.log
tests/security/r11-storage-documents.test.ts           PASS     602ms     0     .test-logs/tests__security__r11-storage-documents.test.ts.log
tests/security/r12-reglages-finance.test.ts            PASS     500ms     0     .test-logs/tests__security__r12-reglages-finance.test.ts.log
tests/security/r13-parrainage-relations.test.ts        PASS     710ms     0     .test-logs/tests__security__r13-parrainage-relations.test.ts.log
tests/security/r14-retraits-insertion.test.ts          PASS     553ms     0     .test-logs/tests__security__r14-retraits-insertion.test.ts.log
tests/security/r15-statut-ambassadeur.test.ts          PASS     561ms     0     .test-logs/tests__security__r15-statut-ambassadeur.test.ts.log
tests/security/r16-reglages-acces.test.ts              PASS     432ms     0     .test-logs/tests__security__r16-reglages-acces.test.ts.log
tests/security/r17-statut-evenement-rest.test.ts       PASS     438ms     0     .test-logs/tests__security__r17-statut-evenement-rest.test.ts.log
tests/security/r18-partenaires-public.test.ts          PASS     1.1s      0     .test-logs/tests__security__r18-partenaires-public.test.ts.log
tests/security/r19-categories-transferts.test.ts       PASS     665ms     0     .test-logs/tests__security__r19-categories-transferts.test.ts.log
tests/security/r2-otp-codes.test.ts                    PASS     432ms     0     .test-logs/tests__security__r2-otp-codes.test.ts.log
tests/security/r20-evenements-ecritures-rest.test.ts   PASS     551ms     0     .test-logs/tests__security__r20-evenements-ecritures-rest.test.ts.log
tests/security/r21-notifications-rest.test.ts          PASS     892ms     0     .test-logs/tests__security__r21-notifications-rest.test.ts.log
tests/security/r22-reglages-notif.test.ts              PASS     616ms     0     .test-logs/tests__security__r22-reglages-notif.test.ts.log
tests/security/r23-reglages-lot7.test.ts               PASS     693ms     0     .test-logs/tests__security__r23-reglages-lot7.test.ts.log
tests/security/r24-categories-anon.test.ts             PASS     592ms     0     .test-logs/tests__security__r24-categories-anon.test.ts.log
tests/security/r25-commandes-idor.test.ts              PASS     967ms     0     .test-logs/tests__security__r25-commandes-idor.test.ts.log
tests/security/r26-brouillon-autre-partenaire.test.ts  PASS     2.3s      0     .test-logs/tests__security__r26-brouillon-autre-partenaire.test.ts.log
tests/security/r27-avatars.test.ts                     PASS     4.0s      0     .test-logs/tests__security__r27-avatars.test.ts.log
tests/security/r28-middleware-matrice.test.ts          PASS     2.5s      0     .test-logs/tests__security__r28-middleware-matrice.test.ts.log
tests/security/r3-fonctions-rpc.test.ts                PASS     1.5s      0     .test-logs/tests__security__r3-fonctions-rpc.test.ts.log
tests/security/r4-ecritures-directes.test.ts           PASS     500ms     0     .test-logs/tests__security__r4-ecritures-directes.test.ts.log
tests/security/r5-lectures-anon.test.ts                PASS     1.0s      0     .test-logs/tests__security__r5-lectures-anon.test.ts.log
tests/security/r6-roles-jeton.test.ts                  PASS     1.2s      0     .test-logs/tests__security__r6-roles-jeton.test.ts.log
tests/security/r7-profil-colonnes.test.ts              PASS     831ms     0     .test-logs/tests__security__r7-profil-colonnes.test.ts.log
tests/security/r8-controleur-lectures.test.ts          PASS     2.3s      0     .test-logs/tests__security__r8-controleur-lectures.test.ts.log
tests/security/r9-partenaire-ecritures.test.ts         PASS     492ms     0     .test-logs/tests__security__r9-partenaire-ecritures.test.ts.log
tests/sms-formatage.test.ts                            PASS     330ms     0     .test-logs/tests__sms-formatage.test.ts.log
tests/ux-performance-and-double-click.test.ts          PASS     804ms     0     .test-logs/tests__ux-performance-and-double-click.test.ts.log
──────────────────────────────────────────────────────
TOTAL : 307 suite(s) — 307 réussie(s), 0 en échec, 0 expirée(s)

$ git show origin/ci-results:runs/125-43128293638/e2e.log | grep -E "\[e2e\] (durées|résumé)|passed|failed"
  10 passed (11.7s)
  387 passed (16.9m)
  7 passed (8.3s)
  4 passed (4.2s)
[e2e][fumée] boîte vidée avant le repère (événements badd2eb9-4eac-4bac-a7d4-57eae69e516b) : {"claimed":13,"sent":9,"retried":0,"failed":0,"skipped":5,"uncertain":0,"cancelled":0,"waiting":0,"reclaimed":0,"rounds":1,"smsToday":178}
[e2e][fumée] envoyeur à 2026-11-13T10:01:30.000Z : {"claimed":17,"sent":12,"retried":0,"failed":0,"skipped":5,"uncertain":0,"cancelled":0,"waiting":0,"reclaimed":0,"rounds":1,"smsToday":4}
[e2e][fumée] GET /api/cron/notifications-dispatch → 200 {"ok":true,"claimed":96,"sent":52,"retried":0,"failed":0,"skipped":44,"uncertain":0,"cancelled":0,"waiting":0,"reclaimed":0,"rounds":1,"smsToday":180}
  2 passed (46.4s)
  13 passed (2.1m)
  4 passed (4.3s)
  4 passed (3.1m)
  9 passed (1.2m)
[e2e] durées : connexion 12s · captures 1014s · emails 9s · dev-page 5s · fumee 47s · terrain 129s · pwa 5s · fake-prod 2s · perf 189s · recette 75s — total 1487s (24.8 min)
[e2e] résumé :connexion OK · captures OK · emails OK · dev-page OK · fumee OK · terrain OK · pwa OK · fake-prod OK · perf OK · recette OK

$ git show origin/ci-results:runs/125-43128293638/js-budget.tsv
route	fichiers	octets_gzip	octets_bruts	budget	statut
/	17	216502	747187	217000	OK
/events/[id]	16	222143	770719	224000	OK
/tickets	20	240112	823384	241000	OK
/controller/scanner	17	223602	772363	226000	OK
/billet/hors-ligne	15	212344	737182	215000	OK
```

Invariants du run « après » (lignes `[INVARIANT]`, `[INVARIANT-LOT9]`, `[INVARIANT-LOT9BIS]` de `verify.log`, et `scripts/e2e/invariants-run.ts` de l'e2e) :

```text
lignes [INVARIANT…] lues : 2318 ; lignes « (w) : … » : 59 ; lignes à violation non nulle : 2
[INVARIANT-CYCLE] pilotage-invariant — billet UTILISE sans scan : 1 violation(s) (l) sur le jeu
[INVARIANT-CYCLE] pilotage-invariant — paiement espèces détaché : 1 violation(s) (l) sur le jeu
--- dernières lignes [INVARIANT…] de verify.log ---
[INVARIANT-TERRAIN] r27-avatars — (p)(q) : 0 violation(s)
[INVARIANT-RECETTE] r27-avatars — (r)(s)(t) : 0 violation(s)
[INVARIANT-LOT9] r27-avatars — (t)(u)(v) : 0 violation(s)
[INVARIANT] r28-middleware-matrice — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] r28-middleware-matrice — purge des réservations échues : {"expired":0}
[INVARIANT] r28-middleware-matrice — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] r28-middleware-matrice — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] r28-middleware-matrice — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] r28-middleware-matrice — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] r28-middleware-matrice — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] r28-middleware-matrice — envoyeur : 1 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] r28-middleware-matrice — (m)(n)(o) : 0 violation(s)
[INVARIANT-TERRAIN] r28-middleware-matrice — (p)(q) : 0 violation(s)
[INVARIANT-RECETTE] r28-middleware-matrice — (r)(s)(t) : 0 violation(s)
--- lignes [INVARIANT…] de e2e.log ---
[INVARIANT-CYCLE] recette-invitation — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] recette-invitation — envoyeur : 0 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] recette-invitation — (m)(n)(o) : 0 violation(s)
[INVARIANT-TERRAIN] recette-invitation — (p)(q) : 0 violation(s)
[INVARIANT-RECETTE] recette-invitation — (r)(s)(t) : 0 violation(s)
[INVARIANT-LOT9] recette-invitation — (t)(u)(v) : 0 violation(s)
[INVARIANT-LOT9BIS] recette-invitation — (w) : 0 violation(s)
[INVARIANT] recette-admin — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] recette-admin — purge des réservations échues : {"expired":0}
[INVARIANT] recette-admin — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] recette-admin — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] recette-admin — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] recette-admin — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] recette-admin — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] recette-admin — envoyeur : 0 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] recette-admin — (m)(n)(o) : 0 violation(s)
[INVARIANT-TERRAIN] recette-admin — (p)(q) : 0 violation(s)
[INVARIANT-RECETTE] recette-admin — (r)(s)(t) : 0 violation(s)
[INVARIANT-LOT9] recette-admin — (t)(u)(v) : 0 violation(s)
[INVARIANT-LOT9BIS] recette-admin — (w) : 0 violation(s)
```

---

## 8. Commits

**345 commits** depuis `931f4fa`, du plus ancien `c3f03f6` (`.private/` ignoré par git) au plus récent `a8e49e3`. Répartition par type, comptée sur les messages : `fix` 192, `test` 135, `docs` 15, `chore` 3. Le commit de ce rapport viendra après et ne changera que `docs/`.

```text
$ git log --oneline 931f4fa..HEAD | wc -l
343
$ git log --format='%s' 931f4fa..HEAD | sed -E 's/^([a-z]+)\(.*/\1/' | sort | uniq -c
      3 chore
     15 docs
    192 fix
    133 test
$ git diff --name-status 931f4fa..HEAD -- tests e2e scripts .github playwright.config.ts | awk '{print $1}' | sort | uniq -c
     65 A
    105 M
```

62 suites de test nouvelles (`tests/**/*.test.ts` ajoutés). Aucune suite supprimée. **Route supprimée :** `app/api/admin/refunds/[id]/retry/route.ts`, par `9fae4dd` (`fix(9b.1)`) ; ses tests sont passés à `cashouts/[id]/resend` (T16 à T19).

Commits hors tâche : `c3f03f6` (`chore(9bis)`, `.private/` ignoré) ; `a27c0c3` (`chore(9b.env)`, variables) ; `44d850c` (`chore(9b.ci)`, délais CI) ; `54e0b77` (`fix(9b.reglages)`, M01) ; `68be19e` (`fix(9b.23-statut)`, M02) ; `acc9f3f` (`fix(9b.registre)`, M03, catalogue) ; `3bfd106` (`test(9b.infra)`) ; `0d9cfb6`, `5e1a1c6`, `ba75bfc` (`test(9b.e2e)`) ; `7cccfa3` (`fix(9b.seed)`) ; `48cf9b8` (`fix(9b.e2e)`) ; `e847efe` (`docs(9b.avant)`, journaux du run 118) ; documents `5e29dd2` (glossaire), `28c8be3` (I4), `b67b0fa` (cahier), `e5fcc64` (déploiement), `0f534dc` à `8ab1e2b` (parcours et plan de test, 10 commits).

Table des commits par tâche (préfixes `test(9b.n)` et `fix(9b.n…)` ; délégués `-SA`, `-SB`… et écrans `e` compris) :

| Tâche | Commit(s) rouge(s) | Correctif(s) serveur, délégués et écrans | Tests adaptés ensuite |
|---|---|---|---|
| 1 | `a53a095` | `9fae4dd`, `804aeb0`, `0fdc4b1`, `b148c30`, `d11f790`, `65fbb75`, `472855f`, `423a15a` | — |
| 2 | `c644cf2` | `c1b2d71`, `a5f74d5`, `0beaa9f`, `e4ea7fd`, `1376185`, `0bc19aa`, `a9bc648` | — |
| 3 | `61384b0` | `9f15896`, `12ace48`, `0a8043f` | `5e32838`, `7bd0ffb`, `368a11c` |
| 4 | `82976f0` | `d8b41f6`, `2c390de`, `7d375de` | — |
| 5 | `069b37b` | `6551806`, `4cdc509`, `6dd860f` | — |
| 6 | `b6ff250` | `b879077`, `7da6279`, `299ea6f` | — |
| 7 | `ca0235e` | `e2471ce`, `00aab1c` | `8f24267` |
| 8 | `713dccc` | `ce6b147` | — |
| 9 | `cd2e571`, `b74636d` (montage) | `a5f69cf` | — |
| 10 | `4ba56f1` | `67c386e`, `2c7d927` | — |
| 11 | `b779914` | `0de99c2`, `a4d30a2`, `d3b9ed0`, `72de786`, `bff5894`, `08405b0`, `ab5c7ac`, `903fe54` | `34b558a` |
| 12 | `4114ae1`, `796a5e0` | `f178159`, `2751c1a`, `4ffb57a`, `d991fa4` | `5a4b74a` |
| 13 | `54d1311`, `d304e07` | `5cf77de`, `e7e89d4`, `2adab8c`, `e7292e0` | `546b1d6` |
| 14 | `7fcc38c` | `ba67cd4`, `65be705` | — |
| 15 | `b74e957` | `36e4cff`, `28769f7`, `e59002b` | `289fe49`, `1f12602` |
| 16 | `bccb5de` | `f9ccdf5`, `69d284e`, `c276fcf` | — |
| 17 | `14a10d0`, `ef25817`, `cbd1090` (montage) | `714733a`, `8d03eba`, `58544b2`, `56601dd`, `ea5ae8e` | — |
| 18 | `69776d9` | `b5be3cf`, `f153844` | `8362397` |
| 19 | `128155e` | `e1a5840` | `fabb9c0` |
| 20 | `b2aaec3` | `4304f45`, `f1618d9` | — |
| 21 | `0d1bff4` | `c3dfe24`, `f1a214d`, `bc82374` | — |
| 22 | `099cdcf` | `4c88049`, `e748633`, `8bb2bbd`, `e94540d` | — |
| 23 | `74daa56`, `f118183`, `cae81bc` | `68be19e`, `43022f7`, `adf089f`, `594dcbe`, `5244710` | `5eea979` |
| 24 | `362856d` | `bc7f429`, `6de12bf` | — |
| 25 | `ff54475` | `f9eb999`, `295bc6c`, `95e7e38`, `66688ea`, `bdfd12a`, `f56f055` | `67e00bc` |
| 26 | `ea859c3`, `656ffd2`, `6b4e777`, `153d326` | `cda370f`, `415fafa`, `dfc332b` | `6e141da` |
| 27 | `fcce367` | `69c1b0b`, `b24cdd3` | `f7d7d56` |
| 28 | `7d2f959` | `a78cdff`, `f3ea18f` | — |
| 29 | `df61005` | `ab4f57c`, `c9c5e2e` | — |
| 30 | `88306a8`, `75316ab` | `45ba69f`, `03401a6` | `5de3514` |
| 31 | `07f8a1f`, `36bf73a`, `5b318e5` | `b55ea7c` | — |
| 32 | `379120a`, `c319e73`, `a8d2694` | `a8e2e8c` | — |
| 33 | `429ab6a`, `3f19eb4`, `8970c94`, `49ad6c4` (montage) | `596db36` | — |
| 34 | `b5efb17`, `599bd7b`, `066df0c` (montage) | `c962841`, `3eb18bf` | `6db27ca` |
| 35 | `7581504` | — | — |
| 36 | `68d16c1` | `2b68541` | — |
| 37 | `afe6640` | `0d0e3f5` | — |
| 38 | `f208ed7`, `bb991e2`, `fa0f311` | `b2eb2cb`, `69f9209`, `5af759a` | — |
| 39 | `82c71d4` | `da2306e` | — |
| 40 | `e63fcbf`, `c0d5142` (montage) | `77b1779` | — |
| 41 | `b5eafc3`, `a1ab759` (montage) | `f354004`, `18ffeba`, `1400782`, `abeb814`, `7661c77`, `88d1564`, `55ada88`, `6364814`, `bab7844`, `894f6c8`, `4a58cce`, `643b268`, `3b95965`, `bc97081`, `c20af98`, `2919d2b`, `9779071`, `25e2d39`, `df1212a`, `7577ef2`, `5f4faa3`, `c7a46c6`, `b3039d6`, `28c79a9`, `ce19d84`, `14400fe`, `2db2c5a`, `185ab24`, `3c54be7`, `30813b8`, `b9b9737`, `624a8c4` | `6381a1d`, `2a5adea`, `684db59`, `dd0a169`, `78b32ac`, `9c21763`, `ae39c5b`, `a4ce788` |
| 42 | `7c3ad01` | `a28dee5`, `3c6d462`, `c64c17a` | — |
| 43 | `c85ce05`, `ea5303f` (montage) | `e14e47e`, `25b804b` | — |
| 44 | `1ecc892` | `a97716c` | — |
| 45 | `1a402e1` | `4222767`, `8c7145e` | — |
| 46 | `b9a1160` | — | — |
| 47 | `f249026` | `6a5bf79`, `06f9451` | — |
| 48 | `1308038`, `f4e8cbe`, `8e3f8f5` | `8e58ab0`, `953ff44`, `4a9a5e8`, `d378a5b` | `ca2cebc`, `0ba104b` |
| 49 | `94abb55`, `f5b855b` | `9159f97`, `a3d2256`, `2eed04c`, `11f1052` | `53b2194`, `82336c7`, `1e469e5`, `548c9dd`, `f9497e6`, `c0b0b96` |
| 50 | `0ded28c` | `139eb19`, `0513bbf` | — |
| 51 | `bdd2aae` | — | — |
| 52 | `da8dec3` | `2af8862` | — |
| 53 | `fe5b847` | — | — |
| H1 | `e4dd163` | `e779c51`, `21a6d93` | — |
| H2 | `eec780c` | `5e7b22f`, `5217e46`, `02a07e3`, `c24f5f4` | — |
| H3 | `d3bf812` | `a6fede5` | — |
| H4 | `668a662` | `f55e524` | — |
| H5 | `f85b848` | `c83c2ba` | `2bbd844` |
| H6 | `32c0df3` | `a663b9a`, `9f6e7e1`, `7796b96`, `5fa207a` | — |
| H7 | `af3b876`, `5980b16` (montage) | `72c4b22`, `bd66b67`, `a5f61eb` | — |
| H8 | `0bb4814` | `68457d5`, `f9c0f26` | — |
| H9 | — | — | — |
| I1 | `dafca31` | `41f7b25`, `5a89267`, `5672f13`, `b2892ab` | — |
| I2 | `6a023dc` | `3b1935f` | — |
| I3 | `29057f0` | `c583473`, `cb35f7b` | `fb1f0b3` |
| I4 | — | — | — |
| I5 | `b30737f` | — | — |

Tâches sans commit de correctif propre : **35** (R24, décision ; témoin `7581504`) ; **39** (libellé posé par M03 `acc9f3f`, page `da2306e`) ; **46** (R81 non reproduit, témoin `b9a1160`) ; **51** (contenu des emails, garde verte dès `bdd2aae` ; rendu porté par `8e58ab0` et `11f1052`) ; **53** (G53-5, G53-10, G53-13 de `fe5b847`, corrigés par `8e58ab0`) ; **H9** (ce rapport) ; **I4** (document, `28c8be3`) ; **I5** (`b30737f`, corrigé par `c583473` puis `cb35f7b`). `fix(9b.34-SB)` n'a pas de commit propre : son contenu (`admin_user_status_set`, motif, audit, `ACCOUNT_SUSPENDED`, `ACCOUNT_REACTIVATED`, révocation des sessions) est livré par `28769f7` (`fix(9b.15)`) et `e1a5840` (`fix(9b.19)`). Les délégués sans tâche numérotée : `fix(9b.4-SV)` `2c390de`, `fix(9b.H1-SV)` `e779c51` (dans la table).

---

## 9. Tests existants modifiés

Règle de la consigne : aucun test existant affaibli, toute modification signalée. Chaque commit ci-dessous dit dans son message ce qui change et pourquoi. Fichiers de tests, e2e, scripts et CI modifiés depuis `931f4fa` : 105 (`git diff --name-status`, section 8).

### 9.1 Liste du contrat (section 9, T1 à T64) et T65

Commit d'écriture = commit de la vague R (tests rouges) qui porte l'adaptation ; le correctif qui la rend verte est celui de la tâche (section 8).

| T | Fichier | Changement | Raison | Commit |
|---|---|---|---|---|
| T1 | `tests/schema/migrations-gelees.test.ts` | gel du lot 9 ajouté | renforcement | `3bfd106` |
| T2 | `tests/security/r3-fonctions-rpc.test.ts` | `LOT9BIS_RPCS`, bloc 42501 des migrations `20261109…` | fonctions nouvelles | `3bfd106` |
| T3 | `tests/helpers/design-files.ts` | section « Lot 9 bis », 6 `.tsx` | règle du lot | `3bfd106` |
| T4 | `tests/schema/recette-matrice.test.ts` | nombre d'essais, écart WhatsApp, essai 1 | R109, ex-10.0 f | `1ecc892` |
| T5 | `tests/seed/seed-demo.ts`, `scripts/e2e/invariants-run.ts` | `assertLot9bisInvariants` | A19 | `7cccfa3` |
| T6 | `tests/seed/seed-demo.ts` | garde reculée après création, PIN généré | H2, R42 | `7cccfa3` |
| T7 | `e2e/recette.spec.ts` | actes adaptés (mot de passe récent, devis, PIN…) | B, G, C, A, V | `48cf9b8` |
| T8 | `e2e/fumee.spec.ts`, `e2e/terrain.spec.ts` | mot de passe confirmé ; PIN | R57, R42 | `48cf9b8` |
| T9 | `e2e/support/screens.ts` | 10 captures nouvelles et écrans modifiés | contrat 7.3 | `0d9cfb6` |
| T10 | `e2e/support/service.ts` | `userIdByPhone` | R87 | `48cf9b8` |
| T11 | `scripts/e2e/render-emails.ts`, `e2e/emails.spec.ts` | + `EMAIL_VERIFICATION`, `EVENT_CHANGED` | G.51 | `48cf9b8` |
| T12 | `scripts/e2e/fake-prod.mjs` | troisième lancement « réel sans https » | I5 | `b30737f` |
| T13 | `tests/samirpay-contrat.test.ts` | v1.2 ; 409 → UNCERTAIN ; `existingTransactionId`, `fees`, `netAmount`, `refOperator` (renforcé) | H5, H4, H7, H6 | `f85b848`, `668a662`, `af3b876` |
| T14 | `tests/fakes/fake-samirpay.ts` | modes v1.2 (délai, conflit, solde, limites), frais, signature | faux aligné | `f85b848`, `af3b876`, `668a662`, `d3bf812`, `0bb4814` |
| T15 | `tests/schema/essai-faux-samirpay.test.ts` | formes v1.2, même nombre d'assertions | H5 | `f85b848` |
| T16 | `tests/parcours/admin-remboursements.test.ts` | retraits et lignes de plus de 30 min, « Renvoyer », « Marquer versé » ; titres et nombre de lignes gardés | B4 | `a53a095` |
| T17 | `tests/parcours/remboursement-relance.test.ts` | route `resend`, `reason`, audit dans la transaction | B4 | `a53a095` |
| T18 | `tests/parcours/double-paiement.test.ts` | A expiré réellement puis succès tardif ; `resend` | R47 (règle changée), B4 | `a53a095`, `b6ff250` |
| T19 | `tests/parcours/securite-admin-lot7.test.ts` | mêmes assertions sur `resend` | B4 | `a53a095` |
| T20 | `tests/parcours/paiement-attente-lot7.test.ts` | encore PENDING → 409 ; après annulation ou expiration → 200 | R47 (règle changée) | `b6ff250` |
| T21 | `tests/parcours/finance-commissions.test.ts` | disponibilité comptée depuis la fin de l'événement | R106 (règle changée) | `ca0235e` |
| T22 | `tests/parcours/finance-retraits.test.ts` | montant envoyé au code ; fin « début + 6 h + 48 h » | R62 ; R16 (règle changée) | `4ba56f1` |
| T23 | `tests/parcours/otp-objet.test.ts` | `{ account, amount: 5000 }` | R62 | `4ba56f1` |
| T24 | `tests/parcours/dette-suspendu-temps-reel.test.ts` | statut relu avant la bascule, motif | R5, B18, B37 | `c644cf2` (et `1f12602`, 9.2) |
| T25 | `tests/parcours/notif-pros.test.ts` | montant, motif, `TRIAL_STARTED` sans SMS | R62, B37, R31 | `f208ed7` |
| T26 | `tests/parcours/pilotage-acces.test.ts` | `events.read` → 200, sans permission → 403, contacts selon `partners.read` | **consigne 11 : renforcé** | `b779914` |
| T27 | `tests/parcours/finance-remboursement-billet.test.ts` | sans `refunds.manage` → 403 sans versement ; avec → 200 | **consigne 11 : renforcé** | `b779914` |
| T28 | `tests/parcours/pilotage-remboursement-billet.test.ts` | `refunds.manage` → fiche ; sans → 403 | R2 | `b779914` |
| T29 | `tests/parcours/pilotage-apercu-ventes.test.ts` | admin `events.read`, cas sans permission | R2 | `b779914` |
| T30 | `tests/parcours/pilotage-cloture-export.test.ts` | admin `events.read` | R2 | `b779914` |
| T31 | `tests/parcours/pilotage-equipe-caisse.test.ts` | admin `events.write`, cas sans permission | R2 | `b779914` |
| T32 | `tests/parcours/notif-admin.test.ts` | motifs nouveaux ; `PERMISSION_MISSING` et libellé français (plus précis) | R51, G.52, I1 | `796a5e0` |
| T33 | `tests/parcours/partenaire-lot7.test.ts` | remise EN_ATTENTE avant REJETE ; `assignments[]` | B37, R41 | `b74e957` |
| T34 | `acces-qr`, `acces-totp`, `confirmation-achat`, `course-annulation-transfert`, `course-verrous-lot9`, `dette-annulation-transferts`, `dette-transferts`, `invitations-reclamation` ; `notif-rappels-annulation`, `notif-transferts` | `confirmPassword` avant chaque transfert, assertions intactes | R57 | `54d1311` (RB), `d304e07` (RD) |
| T35 | `tests/parcours/compte-numero.test.ts` | mot de passe confirmé ; connexion par `/api/auth/login` ; transfert vers l'ancien numéro **CANCELLED** | R57, R58, R63 (règle changée) | `54d1311`, `7fcc38c`, `74daa56` |
| T36 | `tests/parcours/compte-profil.test.ts` | garanties déplacées à l'étape de validation de l'adresse, mêmes assertions | R58, R57, R87 | `f4e8cbe` |
| T37 | `tests/parcours/notif-migration.test.ts` | inventaire K1 étendu, inscription en deux appels | R57, R53, D | `8970c94` |
| T38 | inscription partenaire en deux appels : `acces-limiteurs`, `attribution-roles`, `documents-inscription`, `ecritures-ignorees`, `otp-serveur`, `helpers.ts` (RB) ; `email-optionnel` (RG) ; `notif-pros`, `notif-migration` (RD) | code lu dans le faux SMS, assertions gardées | R53, R87 | `14a10d0`, `ef25817`, `7fcc38c`, `fe5b847`, `f208ed7`, `8970c94` ; `statut-compte` : non modifié, à raison : la suite n'inscrit aucun partenaire par la route d'inscription (vérifié au code), elle est verte au run 125 |
| T39 | `tests/parcours/acces-limiteurs.test.ts` | quota de `/api/auth/login` ajouté | R58 | `7fcc38c` |
| T40 | `tests/security/r28-middleware-matrice.test.ts` | `/api/auth/login`, `/verify-email`, `/api/account/email/verify`, `/invitations`, `/api/account/controller-invitations` | B, G, C | `7fcc38c`, `1308038`, `ea859c3` |
| T41 | `tests/parcours/cycle-transitions.test.ts` | + SUSPENDU → TERMINE ADMIN, − SUSPENDU → ANNULE PARTENAIRE | R3, R105, R16 (règles changées) | `b2aaec3` |
| T42 | `tests/parcours/admin-evenements.test.ts:283` | inchangé par T42 ; le fichier est adapté hors section 9 (`6381a1d`, `34b558a`) | R3 | — |
| T43 | `tests/parcours/cycle-cron.test.ts` | fin à début + 6 h ; PIN | R16, R42 (règles changées) | `0d1bff4` |
| T44 | `tests/parcours/cycle-visibilite.test.ts` | décalage au-delà de 6 h | R16 | `0d1bff4` |
| T45 | `tests/parcours/edition-validation.test.ts` | bornes sur début + 6 h | R16 | `0d1bff4` |
| T46 | `tests/parcours/scanner-reprise.test.ts` | `scan.open`, « contrôle ouvert exigé » | R16 | `0d1bff4` |
| T47 | `tests/parcours/acces-helpers.ts`, `acces-caisse-pin.test.ts` | PIN passé par l'aide ; « sans PIN » devient le refus `PIN_REQUIRED` | R42 (A11) | `099cdcf` |
| T48 | `tests/parcours/nettoyage-sur-place.test.ts` | vérifié, non modifié (la liste exacte cassée était dans `acces-tracabilite`, adaptée hors section 9 par `fabb9c0`) | R19 | — |
| T49 | `invitation-identite`, `equipe-eligibilite`, `dette-retrait-controleur` | invitation PENDING, acceptation par le titulaire, puis rôle | R37 (règle changée) | `656ffd2` |
| T50 | `tests/parcours/notif-helpers.ts` | début + 6 h ; clé `notif.sms_essential_daily_alert` | R16, R31 | `f208ed7`, `fa0f311` |
| T51 | `tests/parcours/notif-modeles.test.ts` | registre, EMAIL (annule l'amendement 2 du lot 6), GSM-7 un segment (renforcé), cas `:791` retiré (TRIAL_STARTED sans SMS) | D, E, G | `bb991e2` |
| T52 | `tests/parcours/notif-outbox.test.ts` | registre complet ; adresse non vérifiée → SKIPPED (plus strict) | D, G | `a8d2694` |
| T53 | `tests/parcours/notif-canaux.test.ts` | titre GSM-7 ; `deleted.eventvillage.sn` ; destinataires vérifiés | R27, G | `fa0f311` |
| T54 | `tests/parcours/notif-preferences.test.ts` | sujets renommés et ajoutés | R14 | `379120a` |
| T55 | `notif-reglages`, `tests/security/r22-reglages-notif.test.ts` | + `notif.sms_essential_daily_alert` | R31 | `f208ed7` |
| T56 | `tests/parcours/invitations-annulation.test.ts` | une ligne `TICKET_CANCELLED` au numéro | R22 (renverse L11) | `b5efb17` |
| T57 | `tests/parcours/invitations.test.ts` | IN_APP et PUSH présents au compte | R79 (renverse L10) | `afe6640` |
| T58 | `tests/parcours/course-annulation-transfert.test.ts` | l'expéditeur sans billet reçoit `EVENT_CANCELLED` AUTO | R13 | `07f8a1f` |
| T59 | `tests/parcours/confirmation-achat.test.ts` | acheteur vérifié avant l'email | G | `94abb55` |
| T60 | `tests/parcours/inscription-numero-dabord.test.ts` | adresse en attente, lien envoyé | R87 | `f4e8cbe` |
| T61 | `tests/parcours/lectures-ignorees.test.ts` | compte absent : 200 `{success:true}`, aucun SMS, aucun code (assertion ajoutée) | R84 | `b5eafc3` |
| T62 | `tests/parcours/legacy-exports-partenaire.test.ts` | en-têtes accentués | R77 | `b5eafc3` |
| T63 | `tests/parcours/essai-seed-dev.test.ts` | + `demo_account === true` | I1 | `dafca31` |
| T64 | `tests/security/r7-profil-colonnes.test.ts` | `demo_account` refusée en REST | I1 | `dafca31` |
| **T65** | `tests/schema/essai-integrations.test.ts:278` | le faux serveur local répond au format v1.2 (`body` au lieu de `data`) ; même nombre de lignes, aucune assertion changée | seule conséquence de `c83c2ba` hors domaine, absente de la section 9 | `2bbd844` |

### 9.2 Adaptations hors section 9 du contrat, une par commit

Chaque message porte « adaptation hors section 9, à signaler au rapport » (ou l'équivalent pour les trois du run 121). Le contrat (sections 2 et 4) tranche pour le code ; le nombre de lignes des fichiers cités par la matrice est gardé.

| Commit | Fichier:ligne | Changement | Raison |
|---|---|---|---|
| `2a5adea` puis `78b32ac` | `tests/parcours/activation-controleur.test.ts:52` | texte du code expiré « Le code a expiré. Demandez-en un nouveau. » | passe R75 (mot « OTP » retiré). **`2a5adea` a remplacé la mauvaise ligne** (`:51`, `INVALID_MESSAGE` écrasé, tsc en échec) ; `78b32ac` corrige : seule `:52` diffère de la base |
| `289fe49` | `tests/parcours/revocation-sessions.test.ts:84` | suspension avec motif | contrat 4.2 (400 `REASON_REQUIRED`), B74 |
| `53b2194` | `tests/parcours/compte-numero.test.ts:175` | aide `phoneChangedRows` filtrée sur SMS | B97 : seconde ligne EMAIL au compte (`9159f97`) |
| `ca2cebc` | `tests/parcours/attribution-roles.test.ts:87` | connexion par l'adresse lue dans GoTrue | contrat 4.6 : adresse technique dans GoTrue (`953ff44`) |
| `0ba104b` | `tests/parcours/notif-pros.test.ts:651`, `:655` | partenaire lue par numéro ; EMAIL `SKIPPED NO_REAL_EMAIL` exigé (plus précis) | contrat 4.6, B100 |
| `6e141da` | `tests/parcours/notif-controleurs.test.ts:212` | corps `assignments[]` | B64 (R41), 400 `INVALID_FIELD` |
| `6381a1d` | `tests/parcours/admin-evenements.test.ts` (table `CAN_CANCEL`) | table `OWNER_CAN_CANCEL` : SUSPENDU faux pour la propriétaire | B68 (R105) : seul un admin annule un suspendu |
| `34b558a` | `admin-evenements.test.ts:465`, `dette-cloture-caisse.test.ts:101`, `dette-retrait-controleur.test.ts:66` | admin avec `events.write` | R2, B31 |
| `546b1d6` | `tests/parcours/helpers.ts` (`confirmPassword`) | ne reconfirme pas une session confirmée depuis moins de 5 min | quota `PASSWORD_CONFIRM_PER_ACCOUNT_15MIN` = 5 (contrat 4.2) ; la saisie vaut 10 min (B35) |
| `67e00bc` | `tests/parcours/paiement-helpers.ts`, `tests/parcours/cycle-helpers.ts` | dates d'insertion avancées pour un début passé | R94 : la soumission refuse un début passé |
| `684db59` | `tests/parcours/dette-annulation-transferts.test.ts:237` | variante SUSPENDU → ANNULE par un admin | R105, B68 |
| `1f12602` | `tests/parcours/dette-suspendu-temps-reel.test.ts:230` | suspension avec motif | contrat 4.2, B74 |
| `5a4b74a` | `tests/parcours/notif-admin.test.ts:474` | refus lu sur `PERMISSION_MISSING` et `notifications.write` | R51, B34 : le libellé ne nomme plus le code |
| `5e32838` | `tests/parcours/pilotage-remboursement-billet.test.ts:42` | champ `refund_closed_reason` dans la liste exacte | contrat 4.1, R11 |
| **`f7d7d56`** | **`tests/helpers/payment-invariants.ts`, invariant (b) du lot 2** | **voir 9.3** | R48, R1 |
| `8f24267` | `finance-commissions.test.ts:325-328`, `lot9bis-verrou-numero.test.ts` | événement fini depuis 16 jours au lieu de reculer `available_at` seul | invariant w18 (R106, B12) |
| `8362397` | `tests/parcours/notif-transferts.test.ts:376` | transfert vers le numéro de l'expéditeur rendu à sa cible après les assertions | invariant w11 (R103) |
| `5de3514` | suites `messages-*-9bis` | avis antérieurs de la scène vidés avant la marque | les avis restés en attente partaient avec l'envoi du test |
| `82336c7` | `notif-controleurs.test.ts`, `notif-pros.test.ts` | listes exactes de canaux + EMAIL ; adresses vérifiées | G.49 (B97, X20), R87 (B96) |
| `dd0a169` | `tests/parcours/confirmation-achat.test.ts:84` | lien de support lu dans `SUPPORT_EMAIL` | R70, B88 |
| `fabb9c0` | `tests/parcours/acces-tracabilite.test.ts:47` | union exacte des résultats de scan + `transfer_pending` | R19 |
| `9c21763` | `tests/parcours/cycle-annulation.test.ts:233` | refus 409 à la partenaire sans écriture, puis annulation par un admin `events.write` | B68 (R105) ; tableau 6.5 (j) du contrat |
| `ae39c5b` | `tests/parcours/parrainage-gardes.test.ts:90-95` | inscription avec son « propre » code : 400 `REFERRAL_CODE_UNKNOWN`, aucun compte | B87 (R86) ; l'anti-auto-parrainage reste tenu par la base (cas 2 à 5) |
| `7bd0ffb` | `tests/parcours/pilotage-cloture-export.test.ts:344` | fin reculée placée après le remboursement de l'organisateur | w20 : l'historique fabriqué était impossible (remboursement après la fin) |
| `1e469e5` | `notif-abonnement`, `notif-admins`, `notif-envoyeur`, `notif-outbox`, `notif-rappels`, `notif-rappels-annulation`, `notif-transferts`, `rappels-gratuits`, `sms-anti-abus` | + EMAIL dans les listes exactes ; comptes de test à adresse vérifiée | G.49, R87 (même patron que `82336c7`) |
| `a4ce788` | `tests/parcours/notif-interface.test.ts` (« LoginForm ») | `.signInWithPassword(` remplacé par `fetch('/api/auth/login')` | R58, B36 |
| `6db27ca` | `tests/parcours/invitations-annulation.test.ts:187`, `:205` | « aucun avis » devient « seul avis : `TICKET_CANCELLED` au porteur » | R22, B73 (renverse L11) |
| `548c9dd` | `tests/parcours/notif-envoyeur.test.ts` (cas « 80 % ») | jour tiré parmi les jours sans SMS optionnel réservé ; message d'échec détaillé | **cause non prouvée** : vert au run 119, rouge au 120 sans changement de code d'envoi ; hypothèse : SMS optionnel d'une suite antérieure le même jour simulé ; assertions inchangées |
| `5eea979` | `e2e/support/screens.ts` (5 écrans), `e2e/perf.spec.ts:71` | ouvrent `/tickets?tab=a-venir` | A10 (R45) : sans onglet demandé, Mes billets ouvre « Reçus » ; aucun seuil ni marqueur changé |
| `f9497e6` | `e2e/fumee.spec.ts:384`, `:412-413` | ligne EMAIL du `REMINDER_H3` attendue `SKIPPED EMAIL_NOT_VERIFIED` | G.49, R87 |
| `fb1f0b3` | `tests/schema/essai-reel-demarrage.test.ts` | refus = arrêt du processus en code 1, une seule fois sur la sortie d'erreur, sans la valeur | écart au contrat 4.7 (section 18) |
| `c0b0b96` | `tests/parcours/notif-outbox.test.ts:997` | `REMINDER_H3` : 4 lignes et non 3 | `1e469e5` a vérifié l'adresse de l'acheteur sans recaler ce compte |
| `368a11c` | `tests/parcours/pilotage-cloture-export.test.ts` | fin 500 ms après le remboursement, attente d'1 s | la fin tombait dans le futur (garde-fou de `7bd0ffb`) |
| `ba75bfc` | `e2e/support/screens.ts` | bouchon `EMPTY_RECONCILIATION` complété des champs de frais H6 | relecture des captures du run 121 ; aucune assertion changée |
| `725688d` | `tests/parcours/pilotage-cloture-export.test.ts` | fin sur une seconde ronde, au moins 1 s après le remboursement de P4 | `shiftEventDates` tronque à la seconde : w20 dans 5 `after()` au run 123 ; assertions inchangées |
| `a8e49e3` | `tests/parcours/decouverte-populaires.test.ts` | même format de carte vérifié sur un même événement des deux listes (à défaut hors `endFormatted`), `endFormatted` exigé texte quand il est servi | R36 : clé facultative, rouge au run 124 selon les événements en tête |

### 9.3 Invariant modifié : (b) du lot 2 assoupli

**C'est une modification d'invariant, à relire.** `f7d7d56` ajoute à `tests/helpers/payment-invariants.ts` une exception à (b) (« billet sans paiement SUCCESS ni PARTIAL ») :

```sql
   AND NOT (t.status = 'UTILISE' AND p.status = 'REFUNDED' AND EXISTS (
           SELECT 1 FROM public.events e WHERE e.id = t.event_id AND e.status = 'ANNULE'))
```

Raison : R48 (contrat 5.27) fait rembourser aussi les billets déjà utilisés quand un événement commencé est annulé ; l'entrée a eu lieu, le billet reste UTILISE (pour l'invariant (l)). Depuis R1, la reprise automatique confirme ces remboursements ; au run 119, (b) tombait dans 57 suites à partir de `paiement-reconciliation`. L'exception ne vaut que sur un événement ANNULE ; toute autre combinaison reste interdite.

### 9.4 Corrections de montage des tests rouges, après le run « avant »

Les tests rouges étaient rouges pour une mauvaise raison (triage du run 118). Corrections avant les correctifs, sans toucher aux assertions :

| Commit | Suite | Correction |
|---|---|---|
| `b74636d` | `lot9bis-verrou-numero` | `finalizePhone` aligne `auth.users` (cause A : invariant (v) dans 25 suites) |
| `cbd1090` | `registerPartnerTwoStep` (`helpers.ts`) | une adresse IPv6 /64 neuve par défaut (cause B : quota d'inscription saturé) |
| `5980b16` | `versements-frais` | les routes d'annulation lisent `params.id` sans `await` ; la suite ne leur passait qu'une promesse (404) : contexte objet et promesse à la fois (cause C) |
| `a1ab759` | `textes-base-9bis` | même cause sur `GET /api/events/[id]` (cause C) ; ordre de `markPhoneVerified` |
| `c0d5142` | `messages-sms-9bis` | invitation échue qui violait `chk_ticket_transfers_dates` : `created_at` reculé de 49 h |
| `066df0c` | `messages-comptes-9bis` | libellé du cas R23 trop long pour l'aide `shortTitle`, qui arrêtait le cas avant toute action |
| `49ad6c4` | `messages-acteurs-9bis` | précondition : la route d'invitation rend 201 à la création, pas 200 |
| `ea5303f` | `invitations-controleur-quota` | ligne `SYNC_LOG` FAILED retirée dans `after()` (cas 3b du triage, `notif-admin:240`) |
| `5e1a1c6` | `e2e/captures.spec.ts` | `fumee-superadmin` ajouté à `ROLE_ORDER` (écart E1 du triage) |

### 9.5 CI

`44d850c` (`chore(9b.ci)`) : délai du job de vérification porté de 60 à 75 min, étape e2e de 50 à 65 min, pendant le lot (A18). Durées constatées : section 12.

---

## 10. Invariants nouveaux (w1 à w21) et garde-fous

Aide : `tests/helpers/lot9bis-invariants.ts` (A19), appelée par `assertLot9bisInvariants(label)` en `after()` de chaque suite nouvelle qui écrit, et par `scripts/e2e/invariants-run.ts` en e2e (T5). Ordre : (a) à (v) par `assertLot9Invariants`, puis contrôle du schéma du lot (échec explicite qui nomme chaque objet absent), puis w1 à w21. Les aides existantes ne changent pas, sauf (b) (9.3).

| Règle | Contrôle |
|---|---|
| w1 | versement non final depuis plus de 30 min, absent des « Versements à reprendre » (R1, R9, R10) |
| w2 | versement incertain renvoyé sans décision justifiée (B2, B3) |
| w3 | « Marquer versé » sans journal ni référence |
| w4 | retrait et versement incohérents (H7 : un 409 ne rend jamais le solde) |
| w5 | événement publié d'une partenaire suspendue (R5) |
| w6 | trace de cascade ouverte sur un événement remis en ligne hors réactivation |
| w7 | trace de cascade non close après la réactivation |
| w8 | entrée acceptée pendant un transfert en attente (R19) |
| w9 | transfert en attente sur un billet qui n'est plus VALIDE (R61) |
| w10 | verrou du billet sans transfert en attente, ou l'inverse (R44, R46) |
| w11 | transfert vers le numéro de l'expéditeur (R103) |
| w12 | email envoyé à une adresse non vérifiée, hors lien de vérification (R87) |
| w13 | email envoyé à une adresse technique |
| w14 | adresse vérifiée différente entre le profil et l'authentification, ou technique |
| w15 | SMS, email ou push envoyé à un destinataire de démonstration (I1) |
| w16 | message retenu « compte de démonstration » pour un vrai destinataire |
| w17 | deux paiements de billets PENDING du même compte pour le même événement (R47) |
| w18 | commission d'un billet disponible avant la fin de l'événement + délai (R106) |
| w19 | écriture de frais sans versement confirmé, de montant ou de date incohérents (H7, A6) |
| w20 | remboursement de billet demandé par l'organisateur après la fin, hors annulation (R11) |
| w21 | marque « espèces remboursées » sur un paiement en ligne (R20) |

SQL exact : `S/lot9bis-design.md`, section 6, recopié dans l'aide. Run 121 : 54 lignes `[INVARIANT-LOT9BIS] … (w) : 0 violation(s)` ; les autres lignes `[INVARIANT-LOT9BIS]` sont celles du garde-fou de `lot9bis-invariant` (31 objets retirés un à un dans une transaction annulée, chacun nommé), attendues. Run « après » : 59 lignes « (w) », violations non nulles : 0.

Violations constatées pendant le lot, toutes expliquées et corrigées dans les tests (section 9.2) : (v) au run 118 (`b74636d`), (b) au run 119 (`f7d7d56`), w18 au run 119 (`8f24267`), w11 au run 119 (`8362397`), w20 au run 120 (`7bd0ffb`, `368a11c`). **Risque w19 non levé** : section 19.

---

## 11. Journal d'audit transactionnel (ex-10.0 c, tâche 19)

Rouge `128155e` : une contrainte d'essai `CHECK NOT VALID` sur `audit_logs` refuse le journal ; l'action doit échouer sans effet. Correctif `e1a5840` (`fix(9b.19)`), plus les RPC des autres tâches.

| Domaine | Action | Où s'écrit l'audit |
|---|---|---|
| Rôles | ajout ou retrait de rôles (`ROLES_SET`, rôles avant et après) | `user_roles_set` (M04), dans la transaction ; `POST /api/admin/users` pose le rôle par `setUserRoles` |
| Permissions | `admin_permissions_set` | déjà transactionnel (témoin vert) |
| Statut d'un compte client | suspension, réactivation, motif | `admin_user_status_set` (M04, `28769f7`) |
| Statut d'une partenaire | `PARTNER_STATUS_SET` | `partner_status_set` (M06, `36e4cff`) ; la route ne double plus le journal |
| Versements | toute création ou transition de statut ou de blocage d'un versement, même écrite par TypeScript | trigger `trg_audit_cashouts` (M04) |
| Décisions admin sur un versement | `CASHOUT_RESENT`, `CASHOUT_MARKED_PAID`, `CASHOUT_BATCH_PARTIAL` | `cashout_admin_decide` (M07, `9fae4dd`) |
| Équipes | `CONTROLLER_ASSIGNMENTS_UPDATED` | affectations en une opération (`f153844`) |
| Hors RPC | écritures GoTrue | `AdminService.logAudit` lève sur erreur (avant : avalée) ; 500 explicite |

---

## 12. Fin par défaut, captures, budget JS, durées

**Fin par défaut (B47, R16).** Fin d'un événement = date et heure de fin saisies ; date de fin sans heure → 23:59 ; **aucune date de fin → début + 6 h**, heure de Dakar (`supabase/migrations/20261109000008_lot9bis_cycle.sql:457-468`, `event_end_from_v2` ; `:476-488`, `event_end_at`). Aucune donnée n'est réécrite. Effets, pour un événement sans fin saisie : la vente s'arrête plus tôt (catégories qui dépassent comptées par la requête 4 de la section 5) ; la fenêtre de contrôle se calcule sur cette fin (réglages `access.scan_window_before_hours` et `access.scan_window_after_hours`) ; le passage à Terminé, la disponibilité des fonds et des commissions, et la fin du droit de remboursement de la partenaire (R11) suivent cette fin. L'ancienne `event_end_from` à 3 arguments reste en base sans appelant (X7).

**Ordre des verrous.** Celui du contrat (section 3.3), avec trois écarts tranchés par les correcteurs : `partner_status_set` prend la fiche en `FOR NO KEY UPDATE` (cycle avec la vente de `payment_confirm`) ; `partner_dossier_resubmit` verrouille la fiche puis le compte ; `email_verification_finalize` verrouille tous les comptes concernés (`ORDER BY id`) puis le lien (X28). Le scan prend le transfert en `FOR UPDATE SKIP LOCKED` quand il tient déjà le billet (X27). Preuve de course : `tests/parcours/course-verrous-lot9bis.test.ts` (`f118183`).

**Captures.** Run 121 : 387 captures passées, 41 ignorées, index de 391 entrées, 0 en échec ; 12 écrans nouveaux d'après la relecture (dont les 10 du contrat 7.3, déclarés par `0d9cfb6`). Relecture par un agent (pas par un humain) : `S/lot9bis-captures-relecture.md`, 15 points, rien de bloquant ; aucun enum, erreur Postgres, `undefined`, `NaN`, « FCFA », « quota » ni emoji. Le seul défaut de contenu (« Frais SamirPay non disponibles » sur « Versements à reprendre ») venait du bouchon e2e : corrigé par `ba75bfc`. **À relire par un humain**, défauts mineurs relevés : colonne Bénéficiaire étroite et pastilles sur deux lignes (`RefundsToRetry`, bureau) ; « Places gardées encore 3 h 53 min » contre « gardées 10 minutes » sur `paiement-attente` (donnée de graine, `app/paiement/[id]/page.tsx:853-856`) ; libellés d'onglets coupés par le fondu de `ScrollableTabs` sur mobile ; `pilotage-especes-a-rembourser` (accord « 0 vente sur 1 cochée », masque « *** ** 05 », « Déjà remboursé » répété) ; boutons sur deux lignes (« Suspendre le partenaire », « Confirmer l'annulation ») ; numéro brut affiché trois fois à `inscription-code` ; œil du mot de passe placé de trois façons ; apostrophes droites dans `PushDeviceCard:209` et le pied des emails ; boutons désactivés peu lisibles en sombre. Non capturés : bouton « Clore l'événement », carte « Bientôt en vente », retraits « Retardé », étape 2 de l'inscription partenaire, « Fermer cette caisse ».

**Défauts relevés à la relecture des captures du run 121** (agent, aucun bloquant ; aucun enum, erreur Postgres, « undefined », « NaN », « FCFA », « quota » ni emoji vus). Un seul corrigé dans le lot, les autres sont des points ouverts :
1. « Frais SamirPay non disponibles » sur `admin-remboursements-a-reprendre` : bouchon e2e sans les champs de frais H6. **Corrigé** par `ba75bfc` (test seul).
2. `components/admin/RefundsToRetry.tsx`, bureau : colonne Bénéficiaire étroite, numéro masqué et pastilles d'état sur deux lignes (mineur).
3. `paiement-attente` : « Places gardées encore 3 h 53 min » puis « gardées 10 minutes… Échéance à 02:10 » ; l'échéance du paiement de la graine ne suit pas `finance.payment_hold_minutes` (`app/paiement/[id]/page.tsx:853-856`) (visible, donnée de graine).
4. `components/ui/ScrollableTabs.tsx` sur mobile : le fondu coupe les libellés (« \ venir », « ‹ tions », « En attente de valida› ») ; antérieur au lot sauf l'onglet « Reçus » (visible).
5. `pilotage-especes-a-rembourser` (écran du lot, R20) : « 0 vente sur 1 cochée « Remboursé » (jamais remboursées…) » mal accordé, masque « *** ** 05 » au lieu de « •••• », référence « Vente 37B4308E » affichée, bouton d'actualisation isolé sur mobile, « Déjà remboursé » répété (`components/events/RefundProgress.tsx:48,120`, `components/partner/pilotage/CashRefundsList.tsx:160,184`) (mineur).
6. `partenaire-equipe` mobile : nom affiché deux fois, puces d'événements sur trois lignes (mineur, antérieur).
7. `partenaire-tableau-de-bord` bureau : boutons « Rapports » sur deux lignes ; « Clôture » proposé sur un brouillon (mineur).
8. Libellés sur deux lignes : « Suspendre le partenaire » (`PartnerStatusDialog`), « Confirmer l'annulation » (`EventCancelDialog`) (mineur).
9. `mot-de-passe-oublie` : texte indicatif coupé (mineur, antérieur).
10. `inscription-code` : numéro brut « +221… » affiché trois fois au lieu de « 77 123 45 67 » (mineur).
11. `verification-email` (écran du lot) : marge haute double, adresse à confirmer non rappelée (mineur).
12. Bouton d'affichage du mot de passe placé de trois façons (`PasswordConfirmDialog`, `PasswordChangeDialog`, `app/controller/setup`, connexion) (mineur).
13. Apostrophes droites : `PushDeviceCard.tsx:209`, pied des emails `lib/notifications/email-layout.ts:181,200` ; email de changement de date « » : nouvelle date : … » à deux deux-points (`lib/notifications/catalog.ts:463`, texte du lot 7) (mineur).
14. Boutons désactivés peu lisibles en sombre (« Marquer versé », « Continuer ») (mineur).
15. `controleur-activation` pour un visiteur : icône de déconnexion dans l'en-tête (mineur).

Non capturés dans la partie visible : bouton « Clore l'événement », carte « Bientôt en vente », retraits « Retardé », étape 2 de l'inscription partenaire, « Fermer cette caisse ». Prouvés par des suites, sans capture : « Bientôt en vente » (`cycle-visibilite`), « Clore l'événement » (`cycle9bis-cloture-admin`), « Fermer cette caisse » (`cycle9bis-caisse`), inscription partenaire en deux temps (`dossier-partenaire-9bis`, `documents-inscription`). Le badge « Retardé » des retraits (`423a15a`) n'a ni test d'écran ni capture : à vérifier à l'œil à l'essai.

**Budget JS** (octets gzip, `js-budget.tsv`) :

| Route | Budget | Run 118 (avant) | Run 121 | Après |
|---|---|---|---|---|
| `/` | 217 000 | 216 802 | 216 501 | 216 502 (OK) |
| `/events/[id]` | 224 000 | 221 940 | 222 142 | 222 143 (OK) |
| `/tickets` | 241 000 | 239 012 | 240 111 | 240 112 (OK) |
| `/controller/scanner` | 226 000 | 223 076 | 223 601 | 223 602 (OK) |
| `/billet/hors-ligne` | 215 000 | 212 702 | 212 343 | 212 344 (OK) |

Aucun budget relevé. `/tickets` est la route la plus serrée : 889 octets de marge au run 121 ; les boîtes nouvelles y sont chargées à la demande (`next/dynamic`, traces EB-002 et EZ-002).

**Durées et délai du job (A18, `44d850c`).** Limites portées à 75 min (job) et 65 min (e2e) pendant le lot. Run 118 : 2 793 s (46,5 min). Run 120 : 3 924 s (65,4 min), dont e2e 2 195 s. Run 121 : 3 440 s (57,3 min), dont verify 1 451 s et e2e 1 633 s. Run « après » : 2 973 s, succès. À décider : garder 75/65 min ou revenir à 60/50 après le lot (le run 121 dépasserait 60 min).

---

## 13. Matrice et cahier de recette

`docs/recette-billetterie.md` (`b67b0fa`) : matrice recomptée, **fait 50, partiel 34, non fait 2, écarté 7, hors périmètre 14, total 107**. Six lignes « fait » (§20, §22, §24, §41, §76, §144) ajoutent une preuve du lot 9 bis marquée « (à prouver) », à lire au run « après » : voir verify.log, suite tests/schema/recette-matrice.test.ts : PASS. Questions Q1 à Q6 et taux N2 fermées (section 6 du cahier) : WhatsApp hors V1 ; parrainage prestataire sur le revenu net d'Event Village au lot 13 ; Wallet hors périmètre ; taux personnalisés au lot 13 avec historique ; passage en Ambassadeur sans effet rétroactif ; N2 à 3 % seulement Ambassadeur → prestataire, lot 13. Essais ajoutés 70 à 76 ; essai 46 réécrit ; essais 1, 7, 9, 14, 27, 42, 43, 52, 53, 55, 58, 60, 66, 67 recalés (section 6). Garde : `tests/schema/recette-matrice.test.ts` (T4).

Glossaire unique : `docs/glossaire.md` (`5e29dd2`, écarts corrigés par `624a8c4`) : « quota » devient « quantité mise en vente », « FCFA » devient « franc CFA » dans les phrases et « F CFA » comme unité.

---

## 14. Variables d'environnement et réglages SUPERADMIN

**Réglages SUPERADMIN nouveaux** (`platform_settings`, écrits par `finance_setting_set`, SUPERADMIN seul ; M01 `54e0b77`) :

| Clé | Défaut | Bornes | Tâche | Écran |
|---|---|---|---|---|
| `finance.payment_hold_minutes` | 10 | entier 5 à 60 | H2 | `/admin/finance-settings` (`02a07e3`) |
| `finance.min_paid_price` | 100 | entier 1 à 100 000 | H8 | `/admin/finance-settings` (`f9c0f26`) |
| `notif.sms_essential_daily_alert` | 2 000 | entier 1 à 1 000 000 | 38 (R31) | `/admin/finance-settings`, section Notifications (`69f9209`) |

Réglages existants lus autrement : `finance.withdrawal_fee_rate` avec avertissement quand le coût SamirPay constaté (90 jours) dépasse le taux réglé (H7, `a5f61eb`) ; `finance.referral_availability_days` (7) compté depuis la fin de l'événement (R106) ; `access.scan_window_before_hours` et `access.scan_window_after_hours` servis au scanner (R16). « Modifier » est masqué à tout compte qui n'est pas SUPERADMIN (`4ffb57a`).

**Variables** (`lib/env.ts`, bloc « Lot 9 bis » de `.env.example`, `a27c0c3`) :

| Variable | Rôle | Défaut |
|---|---|---|
| `SAMIRPAY_WEBHOOK_SECRET` | secret de signature des webhooks (16 caractères au moins) ; défini, la signature est exigée | absente |
| `PASSWORD_CONFIRM_PER_ACCOUNT_15MIN` | confirmations et changements de mot de passe par compte | 5 |
| `PASSWORD_LOGIN_PER_IP_HOUR` | connexions par mot de passe par IP | 30 |
| `EMAIL_VERIFY_PER_ACCOUNT_HOUR` | liens de vérification par compte | 3 |
| `EMAIL_VERIFY_PER_ADDRESS_DAY` | liens par adresse | 5 |
| `SUPPORT_EMAIL` | adresse de support, désormais lue partout (R70) | `support@eventvillage.sn` |
| `PAYMENT_HOLD_MINUTES` | **retirée** (S13, `c24f5f4`), remplacée par le réglage | — |

Aucune variable obligatoire nouvelle.

---

## 15. Mode réel depuis le poste (I1 à I5)

- **I1** (`41f7b25`, `5a89267`, `5672f13`, `b2892ab`) : colonne `users.demo_account` (M12), écrite par le service_role seul ; hors simulation, rien n'est envoyé à un compte, un numéro (9 derniers chiffres), une adresse ou un événement de démonstration ; ligne `SKIPPED DEMO_ACCOUNT` « Non envoyé : compte de démonstration » ; garde indisponible → échec fermé (`DEMO_GUARD_UNAVAILABLE`). Tests : `essai-comptes-demo` (parcours et schéma), T63, T64, w15, w16.
- **I2** (`3b1935f`) : `npm run essai:check-reel`, lecture seule, code de sortie non nul s'il reste des notifications en file, des paiements simulés en attente, des versements simulés en cours ou des billets de démonstration sur des événements à venir ; code 2 si la fonction `essai_check_reel` manque (migration 12 absente). Tests : `essai-check-reel` (parcours et schéma). **Aucune sortie réelle de la commande n'est donnée ici** : elle demande une base, et aucune n'a été interrogée pour ce brouillon.
- **I3** (`c583473`, puis `cb35f7b`) : mode réel = intégrations réelles **et** `SAMIRPAY_API_URL` hors boucle locale (A9). Ligne `[réel]` au démarrage ; si `NEXT_PUBLIC_APP_URL` n'est pas en https, refus écrit sur la sortie d'erreur puis arrêt en code 1 (écart au contrat 4.7, section 18). Tests : `essai-reel-demarrage` (`fb1f0b3`), phase fake-prod « réel sans https » (T12), conforme au run 121.
- **I4** (`28c8be3`) : `docs/essai-local.md`, section 13 « Tout en réel depuis votre PC » (ce qu'il faut, préparation en simulé, passage en réel avec `SMS_GLOBAL_DAILY_CAP=50`, vos comptes, essais d'argent, relevés, fin de séance tunnel coupé en premier). Limite de Resend sans domaine vérifié : envoi seulement à l'adresse du compte Resend.
- **I5** : tests de I1 à I3, ci-dessus.

---

## 16. Traces ui-ux-pro-max

61 traces dans `docs/lot9bis-logs/ui-ux-pro-max/`, committées avec les écrans : EA 8, EB 9, EC 8, ED 5, EE 12, EG 5, EV 9, EZ 3, SR 2. Ce que chacune a fait décider (réponses des agents d'écran, `S/lot9bis-e-results.md` et `S/lot9bis-r120-results.md`) :

- **EA (argent) :** bouton de retrait désactivé sous le minimum, devis relié par `aria-describedby` (001) ; refus du serveur sous le champ (002) ; case « J'ai compris » en plus du titre retapé avant une annulation en cours (003) ; marquage des espèces par `ConfirmDialog` (004) ; bandeau « Retardé » qui dit qu'il n'y a rien à faire (005) ; données lues côté client par `useServerData`, pas de couche nouvelle (006) ; jamais la couleur seule pour les fonds gelés (007) ; action fermée expliquée par un bandeau (008).
- **EV (versements, paiement, réglages) :** décisions par `ConfirmDialog`, erreurs sous les champs (001) ; liste relue sans cache après chaque décision (002) ; annulation du paiement avec chargement et résultat annoncé (003) ; page déjà cliente gardée (004) ; un seul `h1` (005) ; « Modifier » masqué plutôt que grisé (006, R51) ; cartes existantes de `/admin/finance` gardées (007) ; icône et titre sur l'avertissement et l'écart, phrase quand rien n'est constaté (008) ; rôle lu dans le contexte (009).
- **EB (droits, comptes) :** collage et gestionnaire de mots de passe permis, bouton Afficher (001) ; boîte du mot de passe chargée à la demande (002) ; motif obligatoire avant suspension ou réactivation (003) ; boutons sans droit masqués avec une explication visible (004) ; « Étape 1 sur 2 » à l'inscription partenaire (005) ; chemin visible pour la partenaire en attente (006) ; champs de fichiers étiquetés (007) ; même message pour tout identifiant refusé (008) ; navigation complète après la connexion côté serveur (009).
- **EC (cycle) :** un seul message d'état pour la fenêtre de contrôle (001) ; scanner client, minuterie nettoyée (002) ; erreur du PIN sous le champ (003) ; `DataList` pour les ventes par canal (004) ; message à la place du QR quand il est masqué (005) ; confirmation avant le refus d'un billet (006) ; résumé des manques à la soumission, focalisé (007) ; pastilles d'état de l'équipe (008).
- **ED (messages) :** bascule email désactivée avec son motif en texte (001) ; chemin de sortie dit une fois (002) ; lien par `next/link` (003) ; « partiront dans 10 minutes » à l'enregistrement (004) ; libellés en clair à la supervision (005).
- **EE (textes) :** afficher les mots de passe, erreurs sous chaque champ (001) ; un seul nom « Tarification » (002) ; erreurs annoncées sur la grille du parrainage (003) ; icône décorative masquée (004) ; carte « Suspendue » avec texte et icône (005) ; confirmation avant suppression du brouillon (006) ; « Renvoyer le code » tout de suite (007) ; vocabulaire de navigation (008) ; texte d'aide de la billetterie (009) ; panier lu après l'hydratation (010) ; une option par ville (011, 012).
- **EG (email) :** erreurs sous les champs `email` et code de parrainage (001) ; écran de confirmation qui dit le sort du lien (002) ; badges « vérifié » et bandeau persistant (003) ; « Ouvrir mon profil » focalisé après la vérification (004) ; page cliente gardée, adresse lue dans un effet (005).
- **EZ (passe e2e du run 120) :** `PasswordConfirmDialog` réutilisé tel quel au transfert (001) ; boîte chargée à la demande, hors du premier chargement de `/tickets` (002) ; champ PIN obligatoire signalé à l'écran et par `aria-required` (003).
- **SR (passe du run 120) :** libellé de vente en gras sous « Billetterie » (001) ; un seul message d'état par retrait, sans région vivante (002).

---

## 17. Décisions prises

### 17.1 Décisions ★ du contrat, à lire par le chef de projet

Texte complet : `S/lot9bis-design.md`, section 2.

- **B1** « Versements à reprendre » = fonction `cashouts_to_resume()` réservée au service_role : remboursement ECHOUE, tout versement bloqué, tout INCERTAIN, « à envoyer » sans motif depuis plus de 30 min, ENVOYE non confirmé depuis plus de 30 min ; tous types, retraits compris ; seuil fixe de 30 min.
- **B2** Versement INCERTAIN sans identifiant SamirPay : jamais « Renvoyer » ; seul « Marquer versé » avec la référence ; le montant reste réservé.
- **B12** Commission d'un billet disponible à la fin de l'événement + 7 jours ; lignes déjà retirées inchangées.
- **B14** Gel des fonds d'un événement suspendu calculé à la lecture, jamais écrit ; `withdrawable` réduit.
- **B16** Cascade : à la suspension d'une partenaire, ses événements PUBLIE passent SUSPENDU (« Organisateur suspendu »), trace dans `partner_suspension_cascades` ; à la réactivation, seuls ceux de la cascade reviennent.
- **B23** Report de plus de 24 h : droit au remboursement total, frais compris, jusqu'au nouveau début ; billets payés en ligne ; une avance n'ouvre rien.
- **B28** Frais réels d'un remboursement d'annulation par la partenaire imputés à son solde ; double paiement, annulation par un admin, remboursement de billet, report : Event Village.
- **B30, B31** `admin_can` ; permission par action (lecture `events.read`, écriture `events.write`, remboursement `refunds.manage`, export avec contacts `partners.read`).
- **B32** **Aucune permission donnée par migration** ; requête au rapport (section 5) ; `seed:dev` donne à Moussa les 8 permissions.
- **B35** Mot de passe saisi depuis moins de 10 min sur la session pour un transfert, un changement de numéro ou d'email.
- **B45** L'audit va dans la RPC qui agit ; trigger sur les versements ; `logAudit` lève.
- **B47** Fin par défaut à début + 6 h (section 12).
- **B51** PIN régisseur obligatoire à toute ouverture de caisse (A11 : aides de test adaptées, T47).
- **B62** Consentement du titulaire pour tout compte à qui le rôle CONTROLEUR serait ajouté ; un contrôleur déjà actif reste affecté sans consentement (point ouvert).
- **B71** `EVENT_CHANGED` indispensable, SMS et email regroupés sur 10 min, immédiats si le début est à moins d'une heure.
- **B74** R59 : les billets payés d'un client suspendu restent valables à l'entrée, par le billet hors ligne déjà enregistré ou la saisie du numéro avec pièce d'identité ; QR en direct et PDF indisponibles (session révoquée) ; le SMS le dit.
- **B96** Adresse en attente : `users.email` ne porte que l'adresse technique ou une adresse vérifiée ; adresse saisie dans `users.email_pending` ; lien de 24 h, jeton haché ; adresse déjà vérifiée ailleurs refusée.
- **B97** Tout type indispensable non synchrone adressé à un compte déclare EMAIL (section 4.6).
- **B101** Un lecteur par format SamirPay ; forme inattendue = erreur ou UNCERTAIN, jamais un succès supposé.
- **B108** Garde des comptes de démonstration sur `users.demo_account`, échec fermé.

### 17.2 Décisions demandées par le coordinateur, et où elles sont tenues

| Décision | Contenu | Commit |
|---|---|---|
| S10 | `GET /api/checkout/pending` montre aussi un paiement de billets PENDING dont la garde est échue, tant qu'il bloque un second paiement, pour proposer de l'annuler | `299ea6f` |
| S11 | « Remboursement retardé » dans Mes paiements : B9 et l'état honnête de la consigne l'emportent sur « route `client_payments_list` intacte » (contrat 5.1) ; la RPC reste inchangée | `65fbb75` |
| S12 | repli de date de `cashout_fee_apply` laissé tel quel ; risque w19 écrit (section 19) | — |
| S13 | `PAYMENT_HOLD_MINUTES` retirée de `lib/env.ts` ; la graine suit (T6) | `c24f5f4` |
| I3 (A9) | mode réel = intégrations réelles **et** SamirPay hors boucle locale ; la CI e2e n'est pas touchée | `c583473`, `cb35f7b` |
| R45 (A10) | les SMS ne changent pas de lien ; Mes billets ouvre « Reçus » d'office quand un billet attend et qu'aucun onglet n'est demandé | `5244710` ; e2e `5eea979` |
| PIN (A11) | PIN régisseur obligatoire à l'ouverture de caisse | `4c88049`, `8bb2bbd`, `e94540d` |
| Fin par défaut (A12) | début + 6 h, nouvelles fonctions, aucune donnée réécrite, fins de vente comptées | `c3dfe24`, `f1a214d` |
| R2 (A13) | aucune permission d'office ; requête B32 avant les migrations | `0de99c2` ; `e5fcc64` |
| Email (A17) | modèle « adresse en attente » ; un groupe d'envoi par canal ; `@deleted.eventvillage.sn` compte comme technique | `8e58ab0`, `2af8862` |
| Cascade (A7) | aucun SMS `EVENT_SUSPENDED` ni `EVENT_REACTIVATED` par événement à la partenaire pendant la cascade ; détenteurs en in-app et push (R24) ; un admin ne republie pas l'événement d'une partenaire suspendue (`PARTNER_SUSPENDED`) | `0beaa9f`, `e4ea7fd` |
| R59 (A8, B74) | billets payés d'un client suspendu valables à l'entrée ; texte du SMS rendu vrai | `28769f7`, `3eb18bf` |
| R24 | suspension et réactivation : in-app, push et email aux détenteurs, aucun SMS ; la suite définitive part en SMS | `7581504` (témoin) |
| R28 | le push garde la place du SMS de 3 heures ; seul le libellé de supervision change | `da2306e` |
| R104 (A15) | décision L7 du lot 9 gardée (aucune énumération des comptes) | — |

### 17.3 Décisions prises par les correcteurs

Recueillies dans `S/lot9bis-s3-reste.md` (section 4) et les rapports de vague ; les plus lourdes de conséquences :

- **Argent (S-A, S-V) :** début en vigueur à l'achat = ancien début du premier changement postérieur au paiement, seuil strict > 24 h ; `POST /api/tickets/[id]/refund` passe par `CashoutService.requestTicketRefund` (RPC idempotente rappelée, écart à la règle « une seule fois » de la section 1) ; 423 du verrou de retrait rendu avec `unlock_at` ; « Renvoyer » quand SamirPay dit SUCCESS = confirmation d'office ; statut illisible → 503 `PROVIDER_STATUS_UNAVAILABLE` ; `REFUND_DELAYED` aussi à la création d'un remboursement déjà bloqué, un avis par versement ; commission repassée en attente seulement si la nouvelle date est future.
- **Droits (S-B) :** `events.write` n'implique pas `events.read` ; mot de passe vérifié par une connexion GoTrue jetable fermée aussitôt (503 si la fermeture échoue) ; `/api/auth/login` rend 503 `QUOTA_GUARD_UNAVAILABLE` (le contrat disait `QUOTA_UNAVAILABLE`) ; `admin_user_status_set` : motif d'au moins 3 caractères, sessions révoquées dans la RPC ; toute création ou publication refusée à une fiche non VALIDE, admin compris.
- **SamirPay (S-H) :** imputation des frais en tout ou rien (créance `CASHOUT_FEE-<id>-CREANCE`) ; après adoption d'un identifiant existant (H4), 502 `PAYMENT_PROVIDER_UNCERTAIN` et paiement CANCELLED `INIT_CONFLICT_ADOPTED` ; tout 5xx = `PAYMENT_PROVIDER_INTERNAL` ; en-tête de signature illisible = INVALIDE ; réglage de garde illisible → 503 `CHECKOUT_GUARD_UNAVAILABLE` (échec fermé) ; taux constaté sur 90 jours.
- **Cycle (S-C) :** une invitation PENDING par partenaire et par compte ; invitation refusée → billet ANNULE, place rendue, sans avis ; `by_channel` exclusif (invitation, guichet, gratuit, en ligne) ; R100 préfixe « Porte » ; R103 sur les 9 derniers chiffres.
- **Messages (S-D) :** fusion des changements : échéance urgente ramenée à maintenant, titre seul fusionné ; `FUNDS_AVAILABLE` pour un TERMINE de moins de 30 jours, toutes ventes disponibles, sans montant ; `TICKET_SCANNED` regroupé ; R31 compte les SMS indispensables SENDING, SENT et UNCERTAIN.
- **Email (S-G) :** quota du lien consommé dans la RPC d'émission (3 par heure et par compte, 5 par jour et par adresse) ; sans `RESEND_API_KEY`, `SKIPPED EMAIL_NOT_CONFIGURED` ; compte d'avant le lot : lien vers l'adresse réelle, sans écriture GoTrue ; renvoi refusé par le fournisseur → 502 `EMAIL_NOT_SENT` (code hors contrat 4.6).
- **Textes (S-E) :** R84 rend `{ success: true }` pour tout numéro ; R77 `pdfText` (jusqu'à U+00FF, « ’ » → « ' ») ; « Organisateur » gardé dans le PDF (CSV figé par `legacy-exports-partenaire:168`) ; R60 permissions manquantes seules ; R91 essai de 60 jours, `is_founder` faux.
- **Mode réel (S-I) :** `essai_check_reel` donne 10 exemples ; `EV_DEV_PROJECT_REF` doit égaler la référence de l'URL.
- **E2E :** les écrans de liste de Mes billets ouvrent l'onglet « À venir » ; le transfert relancé une seule fois après « Confirmer » ; `aria-required` posé à l'écran pour ne pas toucher `components/ui`.
- **Tests :** dans les adaptations R87, les comptes de test reçoivent une adresse vérifiée (l'intention « EMAIL PENDING » est gardée) ; aucune adresse non vérifiée n'est laissée attendue PENDING.

### 17.4 Contradictions tranchées

X1 à X28 : `S/lot9bis-design.md`, en tête. Les plus visibles : X3 (frais au grand livre en `REGULARISATION`, datés comme le remboursement), X4 (qui paie les frais : lettre de la consigne), X10 (`EVENT_CLOSED_HOLDER` sans motif), X11 (un seul avis de fin), X13 (I1 sur `users.demo_account`), X14 (I3 sur le mode et l'adresse SamirPay), X20 (EMAIL sur tout indispensable adressé à un compte), X22 (`TRANSFER_REVOKED`), X25 (actes e2e adaptés avec les correctifs), X27 et X28 (verrous).

---

## 18. Écarts au contrat

| Écart | Contrat | Ce qui est fait | Preuve |
|---|---|---|---|
| Refus de démarrer en réel sans https | 4.7 : `throw` dans `register()` | message sur la sortie d'erreur puis `process.exit(1)` : Next 14.2 n'appelle `register()` qu'à la première requête et ne fait que journaliser une exception (« Failed to prepare server »), `next start` continuait | `cb35f7b`, `fb1f0b3` ; fake-prod conforme au run 121 |
| `retryRefund` et `resumeUnsentRefunds` | 5.1 : retirés | gardés (alias) : `essai-simule` les appelle et reste vert | `lib/events/event-cancellation.service.ts:196`, `lib/payments/cashout.service.ts:480` |
| Verrou de la fiche partenaire | 3.3 : `FOR UPDATE` | `FOR NO KEY UPDATE`, pour éviter le cycle avec la vente de `payment_confirm` | `supabase/migrations/20261109000006_lot9bis_argent.sql:30-34` |
| Ordre des verrous de `partner_dossier_resubmit` et `email_verification_finalize` | 3.3 | fiche puis compte ; comptes puis lien | rapports S-B et S-G |
| `fix(9b.34-SB)` | 5.34 : un commit délégué | aucun commit propre ; contenu livré par `fix(9b.15)` et `fix(9b.19)` | `28769f7`, `e1a5840` |
| `client_payments_list` « intacte » | 5.1 | la route de Mes paiements lit en plus l'état des remboursements (S11) | `65fbb75` |
| Code de refus du quota de connexion | 4.2 : `QUOTA_UNAVAILABLE` | `QUOTA_GUARD_UNAVAILABLE` (aide commune) ; le test ne lit que le statut | rapport S-B |
| Message du commit S0 | — | `c83c2ba` annonce « essai-faux-samirpay 13/13 » ; la réalité est 12/12 | `S/lot9bis-s0s2-results.md` |
| Exception de fichier dans `fix(9b.H5)` | 5.58 | `scripts/e2e/fake-core.mjs` modifié dans le commit H5, comme le contrat l'avait prévu | `c83c2ba` |
| Délai CI | — | job 75 min, e2e 65 min pendant le lot (A18) | `44d850c` |
| PIN obligatoire | — | aides de test et suites qui ouvrent une caisse adaptées (A11) | T47, `099cdcf` |
| Actes e2e | X25 | adaptés avec les correctifs (vague F), pas en rouge | `48cf9b8` |
| Route supprimée | — | `app/api/admin/refunds/[id]/retry/route.ts` | `9fae4dd` |
| Tests modifiés | section 9 : 64 | 64, plus T65 et 37 adaptations hors section 9, plus l'invariant (b) | section 9 |

---

## 19. Points ouverts

Vérifiés dans le code ou les documents à l'écriture de ce rapport.

1. **Texte faux resté dans l'application :** `components/partner/pilotage/InvitationsTab.tsx:449` dit encore « … La place revient au stock et aucun SMS n’est envoyé. » alors que l'invité est prévenu depuis R22 (`TICKET_CANCELLED`). Signalé à l'étape 8.12 et en P8.3.
2. **Libellé faux :** la fenêtre « Clore l'événement » de l'admin nomme son champ « Motif du refus » (`app/admin/events/[id]/page.tsx:791` : tout motif autre que la suspension). Signalé à l'étape 13.4 et en P13.4.
3. **Détenteur d'un billet transféré déjà accepté, non prévenu au remboursement** : seul le transfert en attente est annulé et prévenu (R61) ; Lamine, nouveau détenteur, ne reçoit rien (`docs/parcours-evenement-complet.md`, étape 15.5).
4. **Risque w19 (S12)** : le repli de date de `cashout_fee_apply` (`GREATEST(now(), max VENTE)`) peut produire une écriture de frais que w19 refuse, si un remboursement passé entièrement en créance est suivi d'un crédit avant la confirmation du versement. Aucune violation w19 aux runs 119 à 121.
5. **« Versements à reprendre » filtré par le mode du serveur** (`app/api/admin/refunds/route.ts:185`) : en réel, un remboursement né d'un paiement simulé reste bloqué sans apparaître (essai 60).
6. **`TextInput` (`components/ui/Field.tsx:98-115`) ne transmet pas `aria-required`** à son `<input>` (seul l'attribut HTML `required`). Contourné à l'écran pour le PIN (`e94540d`) ; défaut commun.
7. **Fumée au-delà de l'étape 9 et actes 5 à 9 de la recette** : jamais joués avant le run 121, verts au run 121 (fumée 2/2, recette 9/9) ; à confirmer au run « après » :   ✓  1 [fumee] › e2e/fumee.spec.ts:99:5 › fumée : créer, soumettre, valider, publier, acheter, scanner, piloter (45.2s)
  ✓  2 [fumee] › e2e/fumee.spec.ts:630:5 › pages et routes de développement : 404 sur next start, avec et sans session (103ms)
  ✓  1 [recette] › e2e/recette.spec.ts:316:5 › acte 1 [admin] : délai de garde coupé à l’écran, motif exigé, historique ; un ADMIN est refusé (2.2s)
  ✓  2 [recette] › e2e/recette.spec.ts:363:5 › acte 2 [partenaire] [admin] : inscription avec pièces, validation, E1 et ses canaux, soumission, publication, E2 (7.8s)
  ✓  3 [recette] › e2e/recette.spec.ts:506:5 › acte 3 [partenaire] : invitation de K1, permission espèces, point d’entrée, PIN régisseur (1.5s)
  ✓  4 [recette] › e2e/recette.spec.ts:540:5 › acte 4 [client] : découverte, fiche, refus direct, inscription depuis l’achat, achats, Mes billets, transfert (19.2s)
  ✓  5 [recette] › e2e/recette.spec.ts:692:5 › acte 5 [contrôleur] : activation, caisse, scan en ligne et hors ligne, ancien code, saisie manuelle, guichet, reprise, clôture (17.3s)
  ✓  6 [recette] › e2e/recette.spec.ts:809:5 › acte 6 [partenaire] : pilotage, rapport de clôture, export, retrait, remboursement d’un billet à l’écran (4.8s)
  ✓  7 [recette] › e2e/recette.spec.ts:886:5 › acte 7 [client] [partenaire] : annulation de E2, envoyeur par la vraie route, billet remboursé, avis, bandeau public (1.9s)
  ✓  8 [recette] › e2e/recette.spec.ts:934:5 › acte 9 [partenaire] [client] [contrôleur] : invitation d’un numéro sa.
8. **Comptes de la graine sans téléphone vérifié** : avertissement de l'essai 27 et P0.3 gardés.
9. **Cause non prouvée** du rouge `notif-envoyeur` « 80 % » au run 120 (`548c9dd`) : hypothèse d'un SMS optionnel d'une suite antérieure le même jour simulé.
10. INCERTAIN sans identifiant SamirPay que le support déclare non parti : aucune action « Constater non versé » (B2).
11. Frais d'un remboursement de billet ou d'un report à la charge d'Event Village (X4) ; extension à la partenaire à décider.
12. Contrôleur déjà actif chez une autre partenaire : affecté sans consentement (B62).
13. R95 partiel : retrait de validation, publication par la partenaire, prix et canaux non alertés.
14. R84 n'empêche pas l'énumération : l'inscription (409) et `resolve-phone` (200/404) disent toujours l'existence d'un compte.
15. `successUrl` et `errorUrl` SamirPay non envoyés : après Wave, le client arrive sur la page SamirPay.
16. Répartition des frais d'encaissement, vrai minimum d'encaissement et limites de transfert inconnus (bac à sable, 3.3).
17. Une session révoquée garde son jeton d'accès 1 h au plus (`lib/auth/sessions.ts:7-8`) : vaut pour R59 et la cascade.
18. Volume d'emails face à la limite de l'offre Resend (G.49).
19. Avance de date de plus de 24 h : aucun droit nouveau (B23).
20. Fonds d'un événement SUSPENDU côté parrainage non gelés (B13).
21. Branches historiques `order_id`, `cash_required`, `amount_due` gardées (R81) ; leurs données sur event-village-dev à vérifier au lot 14.
22. La propriétaire peut modifier sa fiche partenaire par REST, `status` et `resubmitted_at` compris (`supabase/migrations/0003_rls.sql:115`, politique `partners_update_owner`, antérieure au lot).
23. Captures : 15 défauts mineurs relevés par l'agent (section 12), dont la durée de garde affichée « 3 h 53 min » sur la capture de paiement en attente (donnée de graine).
24. Délai CI : 75/65 min à garder ou à ramener après le lot (le run 121 a pris 57,3 min).
25. Reste de R106 et R49, R93, R96 : lot à désigner par le chef de projet.

---

Arrêt : le lot 10 n'est pas commencé.
