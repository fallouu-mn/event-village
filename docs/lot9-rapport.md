# LOT 9 — RAPPORT

**Objet :** billetterie V1 complète : invitations (9.0), découverte (9.1), compte client et photo (9.2), sécurité et fiabilité (9.3), nettoyage (9.4). **Branche :** `lot9/billetterie-v1`, depuis `main` (`534d6b3`). Dernier commit de code : `304d846`. Le commit de ce rapport ne change que `docs/`. `main` n'a pas bougé. Aucun test n'a été exécuté contre un projet Supabase distant. **Date :** 8 novembre 2026.

---

## À lire en premier

1. **Verdict : vert sur le code final.** Run 115 (`304d846`) : job réussi, 245 suites sur 245, 10 phases e2e, 353 captures, recette en 9 actes, invariants (a) à (v) à 0 violation, 47 min pour une limite de 60.
2. **Avant / après.** Run 110 (`e6c23d1`) : 212 suites sur 250, 38 rouges, tous expliqués. Run 113 (`d255bf3`) : 244/244, base des extraits verts. Run 115 : même code, plus la seule correction ci-dessous (rouge au run 114, vert au 115).
3. **Trouvé en rédigeant, corrigé :** la RLS de `audit_logs` laissait tout ADMIN lire le journal en appelant directement PostgREST. La politique portait le nom « superadmin » mais testait `is_admin()` ; la consigne supposait l'inverse.
4. **Supposé infirmé en CI :** GoTrue rend une erreur 500 sans code quand un email ou un numéro est déjà pris. Le refus propre vient d'une vérification préalable (AM1).
5. **Défauts du contrat rattrapés par les tests :** remède PO3 initial qui aurait créé un deadlock (section 7) ; `e2e-scenarios`, gardé puis porté, car un cas annoncé couvert ne l'était pas.
6. **Décisions ★ à lire (section 17) :** L3 et L6 (invitation sans compte, résolue à la réclamation), L9 (verrous), L20 (Populaires), L28 (API admin puis RPC, compensation), L32, L34.
7. **Écarts à signaler :** le bucket `avatars` est écrit par la route seule, pour que le recadrage et le retrait EXIF ne soient pas contournables (AR3) ; `first_name`, `last_name` et `avatar_url` ne s'écrivent plus en REST direct (r7 renforcé).
8. **Autres écarts :** liens d'audit masqués pour un ADMIN (AR10) ; en-tête « document officiel » du PDF retiré aussi (A39) ; ligne `cash_required` historique gardée en fixture (A16).
9. **À faire de ton côté, dans l'ordre :** appliquer les 5 migrations `20261108000001` à `…05` sur event-village-dev (section 15, contrôle anti-boucle A27 avant `db push`).
10. **Puis :** jouer les essais 62 à 69 du cahier, surtout le changement de numéro (8.15 du guide) : les écritures de session ne sont prouvées qu'en local.
11. **À relire par un humain :** la relecture des captures a été faite par des agents. La liste à part est en section 3.
12. **Écart documenté :** les champs `datetime-local` restent en format américain dans le Chromium Linux de la CI, malgré `--lang=fr-FR`. Non reproduit sous Windows, cause non établie.
13. **Budget JS :** `/` à 216 801 octets pour 217 000, budget non relevé. `HomeDiscovery` et `AccessNotice` sont chargés à part : la mesure ne les compte pas (section 11).
14. **Matrice CDC :** 49 fait, 35 partiel, 2 non fait, 6 écarté, 14 hors périmètre ; 49 sur 49 prouvées au run 113. A24 y est « corrigée » : sa partie RLS est prouvée au run 115.
15. **Restent ouverts (section 18) :** A30 (`halls/[id]` sans contrôle, Élevée, service fermé), A31, partenaire EN_ATTENTE dans `/partner/*`, pas de blocage des retraits après un changement de numéro (AR1).

---

## 1. Commits

63 commits depuis `534d6b3` (point de départ de la branche, égal à `main`), du plus ancien au plus récent. Le dernier est `fede597`. Le commit de ce rapport viendra après et ne changera que `docs/`.

**Code final : run 115** (`304d846`, job vert, 245 sur 245), qui ne diffère du run 113 que par la politique RLS d'A24 et son test ; deux commits s'ajoutent donc à ce tableau : `de4405a` `test(9.3-A24)[rls]` et `304d846` `fix(9.3-A24)`. Les journaux du lot sont dans `docs/lot9-logs/`.

**Run « après » de référence : le run 113** (`d255bf3`, job vert, 244 suites sur 244, toutes les phases e2e, `recette` à 9 actes sur 9). Il porte le dernier état du code d'application. Les deux commits qui suivent ne touchent que la matrice : `75943b1` (`docs/recette-billetterie.md`) et `fede597` (`tests/schema/recette-matrice.test.ts`, T36). **`fede597` n'est donc pas prouvé par le run 113** : sa version nouvelle, 19 tests, a tourné sur le poste, sans base, d'après la réponse de l'agent D2. Un second run, à code d'application identique, est parti après ce commit ; son résultat n'est pas connu à l'écriture de cette partie.

Commandes et sorties (liste complète dans le tableau qui suit) :

```text
$ git log --format='%h%x09%s' 534d6b3..HEAD | wc -l
63

$ git diff --stat d255bf3..HEAD
 docs/recette-billetterie.md          | 406 ++++++++++++++++++++++++-----------
 tests/schema/recette-matrice.test.ts |  26 ++-
 2 files changed, 292 insertions(+), 140 deletions(-)
```

Répartition par type, comptée sur ces 63 lignes : `fix` 32, `test` 27, `docs` 3, `chore` 1.

La colonne « Run » donne les runs CI lancés sur ce commit (`rap9/runs-table.txt`, lu sur la branche `ci-results`). Le message est coupé à environ 175 caractères ; le texte complet est dans `git log`. La colonne « Tâche » est tirée du préfixe du message.

| # | Commit | Message (coupé) | Tâche | Run |
|---|---|---|---|---|
| 1 | 54fd8e1 | test(infra)[9]: socle des tests du lot 9, écrit seul avant les suites rouges. tests/helpers/lot9-invariants.ts enveloppe assertRecetteInvariants, garde de schéma qui nomme cha … | infra, 9 |  |
| 2 | 298ac75 | test(9.1): suites rouges de la découverte. decouverte-populaires prouve le classement exact d'events_popular sur des données fabriquées (grande limite, seuls les événements de … | 9.1 |  |
| 3 | 31089d5 | test(9.0): tests rouges de l'outil d'invitations, écrits avant tout correctif. invitations (droits, forme, statuts, catégories, stock, attribution au compte vérifié ou attente … | 9.0 |  |
| 4 | 1fad0dc | test(9.0-notif): registre et catalogue attendus portent les trois types nouveaux (T6, T7, T8). notif-outbox : INVITATION_RECEIVED, PHONE_CHANGED, OTP_PHONE_CHANGE au registre … | 9.0 notif |  |
| 5 | 5edf241 | test(9.2): suites rouges du compte client. compte-profil prouve PATCH /api/account/profile (Zod, email unique par email_exists et par public.users, domaine réservé, email vidé … | 9.2 |  |
| 6 | e3afef6 | test(9.2-photo): suites rouges de la photo de profil. compte-photo prouve POST et DELETE /api/account/avatar (JPEG, PNG, WebP, sortie WebP carrée de 256 px, orientation, EXIF … | 9.2 photo |  |
| 7 | c741bad | test(9.3): tests rouges de la sécurité et de la fiabilité, écrits avant tout correctif. admin-audit-lot9 (A24 ADMIN 403 non tracé, SUPERADMIN 200, A25 limit borné par le param … | 9.3 |  |
| 8 | c85b74d | test(e2e)[9]: captures du lot 9 et masques des QR (T26, T27). screens.ts : scanner-a-encaisser retirée (A16), accueil attend Populaires, sept captures ajoutées (invitations-on … | e2e, 9 |  |
| 9 | c32b5bb | test(9.0e): acte 9 de la recette (T1, AR8), le partenaire invite un numéro sans compte, l'invité s'inscrit, réclame et entre. Bloc inséré avant l'acte 8, qui suspend E1 et P1 … | 9.0e |  |
| 10 | 10780e9 | test(9.4-A16): retrait du code à régler sur place, tests écrits avant le correctif. nettoyage-sur-place prouve : billet payant impayé sur payment_required au scan et en saisie … | 9.4 A16 |  |
| 11 | 1032277 | test(9.4-PO10): code mort et preuve A21 rejoués par grep, sans base. code-mort-lot9 prouve l'absence d'AdjustTicketQuotaModal, EventCancelModal et financial-calculator.service … | 9.4 PO10 |  |
| 12 | 79a817e | test(9.4-A21)[ports]: cas réels des suites racine portés avant leur suppression, verts dès l'écriture (annoncé). validations-metier (sans base) : VerifyOtpSchema, normalizePho … | 9.4 A21, ports |  |
| 13 | e6c23d1 | test(9)[citations]: fin de la vague R, deux citations de la matrice recalées sans toucher aux tests. notif-modeles:501 devient :504 (A29, décalé par T7) ; acces-encaissement:2 … | 9, citations | 110 |
| 14 | 8c33122 | docs(lot9): journaux bruts du run « avant » (run 110, sha e6c23d1, 212 suites vertes sur 250, 38 rouges attendus), triage par suite et par test | lot9 |  |
| 15 | cb0d3e2 | test(9.2)[AM1]: constat du run 110, GoTrue ne garantit pas phone_exists ni email_exists (code=undefined, status=500). Les deux sondes SUPPOSÉ de compte-numero et compte-profil … | 9.2, AM1 |  |
| 16 | 4e0dfce | test(9.4-seed): AM5, T28, L47, l'appel de ticket_cash_checkin retiré avant fix(9.4-A16s). Les deux encaissements au scan deviennent une vente au guichet de 2 (même caisse c1, … | 9.4 seed |  |
| 17 | f7cd941 | test(9.0)[AM6]: l'aide de la catégorie sans canal disait que l'application n'envoyait pas d'invitations, devenu faux. Nouveau texte mot pour mot dans canaux-interface:35 et e2 … | 9.0, AM6 |  |
| 18 | f1ff53d | test(9.4-A21)[suppression]: T33 à T35, tableau 5.5, cinq suites supprimées (auth-rbac, partner-auth-complete, payment, roles-isolation, superadmin-complete), ports verts au ru … | 9.4 A21, suppression |  |
| 19 | 521b8e3 | chore(9.env): les quatre quotas du lot 9 (section 11.1) ajoutés à lib/env.ts, .env.example et .env.test.example sur le patron limit(n), facultatifs avec défaut (INVITATION_PER … | 9.env |  |
| 20 | faaa81d | fix(9.1s): découverte côté serveur (section 5.2, AR12, L18 à L22). M3 ajoute users.city, idx_tickets_created_at et la RPC events_popular réservée au service_role ; GET /api/ev … | 9.1s |  |
| 21 | 68a8614 | fix(9.0-notif): catalogue des trois types du lot 9, section 5.1 et T6 à T8 : INVITATION_RECEIVED (SMS seul, ANY, ALLOW, texte figé, 158 septets au pire cas), PHONE_CHANGED (SM … | 9.0 notif |  |
| 22 | c5c6d5d | fix(9.0s): outil d'invitations côté serveur, section 5.1 et tableaux 3.2, 3.3. M2 : billet sans porteur et transfert sans expéditeur admis, INVITATION_RECEIVED au registre, ti … | 9.0s |  |
| 23 | 7f8a8a1 | fix(9.2s): compte client côté serveur (section 5.3, AR2, AM1, AM2, L24 à L33). M4 étend l'objet OTP à PHONE_CHANGE, inscrit PHONE_CHANGED et OTP_PHONE_CHANGE, retire l'UPDATE … | 9.2s |  |
| 24 | fff118f | fix(9.2-photo): photo de profil côté serveur (section 5.3, AR3, L34, L35). M4 ajoute le bucket avatars (public, 2 Mo, image/webp, aucune politique : la route est le seul écriv … | 9.2 photo |  |
| 25 | bf96b1d | fix(9.3-PO3): ticket_refund_request respecte l'ordre unique des verrous (section 3.2, 3.3, AR4). M1 recopie la fonction de 20261101000005:85-191 et prend la catégorie en FOR N … | 9.3 PO3 |  |
| 26 | 31e6e61 | fix(9.3-PO4): event_update et ticket_category_guard respectent l'ordre unique des verrous (section 3.2, 3.3, AR4). M1 recopie les deux fonctions (20261103000005:1339-1702, 202 … | 9.3 PO4 |  |
| 27 | 6687b89 | fix(9.3-A27): le trigger anti-boucle du parrainage couvre aussi l'UPDATE, quel que soit le rôle (section 3.2, L42). M1 remplace trg_check_circular_referral par BEFORE INSERT O … | 9.3 A27 |  |
| 28 | 84da7d5 | fix(9.3-A33): chaque écriture dont l'erreur était ignorée la traite (section 5.4, L39). M1 ajoute admin_permissions_set (cible sous verrou, suppression, insertion et audit en … | 9.3 A33 |  |
| 29 | 327e130 | fix(9.3-A24s): GET /api/admin/audit réservé au SUPERADMIN, comme la RLS (section 5.4, 4.4, L37) : verifyAdminAuth avec requireSuperadmin, 403 pour un ADMIN, sans ligne au jour … | 9.3 A24s |  |
| 30 | 565619c | fix(9.3-A25): limit du journal d'audit borné (section 5.4, L38) : 100 au plus, 50 pour une valeur illisible, nulle ou négative ; avant, limit=100000 passait et NaN partait à P … | 9.3 A25 |  |
| 31 | 9c63b51 | fix(9.3-A38s): le journal d'audit rend le nom et le rôle de l'auteur par une jointure côté serveur (section 5.4, L38, D-sec 3) : select embarqué sur users, actor_name (Prénom … | 9.3 A38s |  |
| 32 | cca809d | fix(9.3-A34): chaque lecture dont l'erreur était ignorée la traite (section 5.4, L40, D-sec 5). admin/communications POST : 500 RECIPIENTS_UNAVAILABLE, plus de campagne à 0 de … | 9.3 A34 |  |
| 33 | 3796cde | fix(9.3-A32): une panne n'est plus présentée comme une absence (section 5.4, L41, D-sec 6). getEventById, getHallById, getProductById et GET partner/orders/[id] : uuid invalid … | 9.3 A32 |  |
| 34 | 8e0a36d | fix(9.3-A26): la fiche partenaire d'un événement ne présente plus une panne comme une absence (section 5.4, L41, T11) : le repli de GET partner/events/[id] passe à 500 EVENT_U … | 9.3 A26 |  |
| 35 | 62be3f2 | fix(9.3-A39): le PDF de clôture s'intitule Rapport de clôture (section 5.4, L43, D-sec 8) : plus aucun certifié, certificat, document comptable, ni document officiel (ce derni … | 9.3 A39 |  |
| 36 | a118e37 | fix(9.3-A40): la route de développement rend l'échec du webhook (section 5.4, 4.4, L43, D-sec 9) : le faux service répond 200 avec webhookStatus même si le webhook de l'applic … | 9.3 A40 |  |
| 37 | 505d70f | fix(9.4-A16s): retrait du code à régler sur place côté serveur (section 5.5, 3.2, L44, L45, AR5) : aucun émetteur en production, décision du client. M5 recopie ticket_scan (20 … | 9.4 A16s |  |
| 38 | f1b4ed6 | fix(9.4-PO10): lib/payments/financial-calculator.service.ts supprimé entier (section 5.5, L49, AM8) : plus aucun appelant, preuve par grep sur app, lib, components, hooks, scr … | 9.4 PO10 |  |
| 39 | fb78ba7 | fix(9.0e): onglet Invitations du pilotage (section 8, 5.1, 4.1, AM7) : InvitationsTab nouveau, role=tab par ScrollableTabs, ouvert par ?tab=invitations ; catégories lues sur / … | 9.0e |  |
| 40 | b5e8f32 | fix(9.1e): accueil et catalogue passent à la découverte par le serveur (section 5.2, A28, L18, L22, L23, AR12) : app/explore/page.tsx envoie q, ville et catégorie à readCatalo … | 9.1e |  |
| 41 | 339a185 | fix(9.2e): écrans du compte client (section 5.3, 4.3, AR13, AM7) : ProfileForm (prénom, nom, email par PATCH /api/account/profile, mêmes règles que le schéma serveur, erreur s … | 9.2e |  |
| 42 | 8d55067 | fix(9.2e-avatar): photo de profil à l'écran (section 5.3, AR3, L36). Avatar commun en <img> avec width, height et alt vide quand le nom est à côté, garde isAvatarUrl (seul le … | 9.2e avatar |  |
| 43 | f42d687 | fix(9.3-A24e-nav): liens du journal d'audit masqués pour un ADMIN qui n'est pas SUPERADMIN (section 5.4, AR10, L37) : l'entrée d'Espaces métier et celle du groupe Système sont … | 9.3 A24e nav |  |
| 44 | f53cb2f | fix(9.3-A24e): un ADMIN qui arrive sur le journal d'audit voit un refus propre (section 5.4, L37, AR10, AR11) : app/admin/audit/page.tsx distingue res.status === 403 d'une pan … | 9.3 A24e |  |
| 45 | ee9b096 | fix(9.3-A38e): la colonne Utilisateur du journal d'audit affiche enfin une personne (section 5.4, L38) : app/admin/audit/page.tsx lit actor_name et actor_role de la route, cel … | 9.3 A38e |  |
| 46 | ef209ea | test(9.4-A21)[webhook]: ports des deux cas de e2e-scenarios annoncés couverts à tort (section 5.5, f1ff53d4). Avant : aucun test ne passait de corps multipart à deliverWebhook … | 9.4 A21, webhook |  |
| 47 | 3606784 | test(9.4-A16)[camera]: retrait de « caméra en pause pendant une confirmation d'encaissement espèces » (acces-tracabilite:255-262). Avant : le cas cherchait le mot cash près de … | 9.4 A16, camera |  |
| 48 | 80df715 | fix(9.4-A16e): plus d'état à encaisser au scan (section 5.5, L44, L45). Écrans : confirmCashCheckin et le PUT retirés de components/scan/scan-client.ts (seule voie POST, sendW … | 9.4 A16e |  |
| 49 | 2423f39 | fix(9.4-PO10e): code mort supprimé (section 5.5, PO10, AM3) : components/events/AdjustTicketQuotaModal.tsx et EventCancelModal.tsx, importés nulle part. Fait passer au vert le … | 9.4 PO10e |  |
| 50 | 3c83ab1 | test(9.4-A16)[jetons]: scanner-interface n'exige plus le jeton cash que le contrat 5.5 retire (T22 l'avait omis, test existant modifié, signalé au rapport). Cinq paires de jet … | 9.4 A16, jetons | 111 |
| 51 | ef265f3 | test(9.2)[fixture]: compte-paiements fournit created_at à chaque ligne (test du lot corrigé, signalé au rapport). Run 111 : une insertion par lot mêlant lignes avec et sans da … | 9.2, fixture |  |
| 52 | 667cb16 | test(9.0)[fixture]: la catégorie inactive du test d'invitation est accompagnée d'une catégorie active (test du lot corrigé, signalé au rapport). Run 111 : un événement sans ca … | 9.0, fixture |  |
| 53 | b3c5a73 | test(9.2)[liste-blanche]: notif-migration admet la route de changement de numéro parmi les envois synchrones d'OTP (test existant modifié, signalé au rapport). Même catégorie … | 9.2, liste-blanche |  |
| 54 | 3ca034a | test(9.4-A21)[suppression]: e2e-scenarios supprimé, ses deux cas réels vus verts au run 111 (paiement-webhook multipart, partenaire-lot7 Realtime). hors-ligne-service-worker n … | 9.4 A21, suppression |  |
| 55 | d992ef2 | fix(9.1e): sections de découverte de l'accueil chargées à part (budget JS de / : 217 389 octets pour 217 000 au run 111, cause : Avatar et HomeDiscovery). Repli prévu au contr … | 9.1e | 112 |
| 56 | f0105fc | fix(9-seed): le seed de démonstration et les invariants de la recette passent à assertLot9Invariants (T29, AR6), qui vérifie (a) à (t), le schéma du lot puis (t)(u)(v) sur tou … | 9 seed |  |
| 57 | e2484be | docs(9): guides du lot 9. deploiement-projet-neuf, section 3 quater : les 5 migrations 20261108 dans l'ordre, db push --linked, contrôle A27 en lecture des boucles de parraina … | 9 |  |
| 58 | a969a24 | fix(9.x)[relecture]: relecture visuelle du run 111, 39 lignes relevées : 21 corrigées, 2 non réelles, 16 laissées (bilan S/lot9-releve.md). À CORRIGER 3 sur 3 : catalogue mobi … | 9.x, relecture |  |
| 59 | d813751 | test(lot9): sms-veille tire ses jours hors de ceux des autres suites (test existant modifié, signalé au rapport). Run 112 : remaining 699 au lieu de 700, un SMS optionnel d'un … | lot9 |  |
| 60 | a525015 | fix(9.1e): AccessNotice chargé à part, côté navigateur (budget JS de / : 217 012 octets pour 217 000 au run 112, 216 798 après, mesure locale). Seul un accès refusé en a besoi … | 9.1e |  |
| 61 | d255bf3 | test(e2e)[9]: capture caisse-cloture-ecart et terrain 12 suivent le libellé « Écart constaté » de fix(9.x)[relecture], « par le serveur » était un mot technique montré au cont … | e2e, 9 | 113 |
| 62 | 75943b1 | docs(9.4): matrice de recette régénérée sur le run 113 (sha d255bf3, 244 suites sur 244, recette 9 actes, 349 captures). §15, §16, §17 passent à fait ; fait 49, partiel 35, no … | 9.4 |  |
| 63 | fede597 | test(9.4-matrice): T36, la matrice suit le lot 9. CORRIGEES reçoit A6, A7, A16, A17, A21, A24 à A28, A32 à A34, A38 à A40, PO3, PO4, PO10 ; NOMBRE_ESSAIS 69 ; PO3, PO4 et PO10 … | 9.4 matrice |  |

Le run 109 porte sur `534d6b3`, avant le premier commit du lot : vert, 220 sur 220. Les runs du lot sont donc 110 (« avant », rouges attendus), 111, 112 (rouges, instruits ci-dessous) et 113 (« après »).

### Tests existants modifiés (signalement)

Règle de la consigne : « Aucun test existant affaibli. Toute modification d'un test existant est signalée et justifiée. »

Chaque fichier ci-dessous a été retrouvé par `git diff --name-status 534d6b3..HEAD -- tests e2e playwright.config.ts scripts .github` (32 ajoutés, 39 modifiés, 6 supprimés), puis par `git log` fichier par fichier. **Ce que j'ai relu et comment** : toutes les lignes retirées et ajoutées (`git diff -U0`) des 39 fichiers modifiés, sauf six. Pour `acces-encaissement` (les 60 premières lignes correspondantes, puis la liste des tests avant et après), `acces-fenetre`, `scan-idempotence` et `hors-ligne-rotation`, j'ai lu les lignes `test(`, `describe(` et `assert`, pas chaque ligne. Pour `e2e/support/screens.ts` et `e2e/recette.spec.ts`, les lignes retirées, pas les lignes ajoutées.

**Ce qui retire de vraies assertions :**
- **A16 (T13 à T20, T22, T23)** : le parcours « à régler sur place » n'existe plus, ses tests partent avec lui. Le nombre de tests baisse (tableau ci-dessous), la couverture de ce parcours disparaît, c'est voulu. Le filet est `tests/parcours/nettoyage-sur-place.test.ts`, qui prouve que le billet impayé tombe sur `payment_required`.
- **`acces-tracabilite`, cas « caméra en pause » (B.5)** : cas retiré, non réécrit. Il cherchait le mot `cash` près de `<CameraQrScanner>`. **La pause réelle de la caméra n'a donc aucun test** (absence antérieure au lot, point ouvert en 18.5).

**Ce qui élargit une règle : une seule entrée.** `notif-migration` admet une route de plus parmi les envois synchrones d'OTP (B.1). Elle est nommée, la règle ne change pas.

**Ce qui durcit** : T5 (`r7` : l'écriture REST du prénom, du nom et de la photo passait, elle doit désormais être refusée), T10 (`admin-audit` : ADMIN 200 devient 403), T36 (`recette-matrice`).

La colonne « Run 113 » vient du récapitulatif de `docs/lot9-logs/ci-run113-verify.log` (extrait brut à la fin de cette sous-section) ou, pour l'e2e, de `docs/lot9-logs/ci-run113-e2e.log`. Lignes ajoutées et retirées : `git diff --numstat`, sortie brute plus bas.

**A. Liste du contrat (section 9, T1 à T36)**

| # | Fichier | Commit | Avant → après | Raison | Run 113 |
|---|---|---|---|---|---|
| T1 | `e2e/recette.spec.ts:3,22`, bloc avant l'acte 8 | c32b5bb | En-tête « 8 actes » → « 9 actes », sans ligne ajoutée ; bloc acte 9 inséré à `:841`, l'acte 8 passe à `:944` (+105, -2) | Consigne 9.0 ; AR8 : l'acte 8 suspend E1 et P1, l'acte 9 doit passer avant | recette OK (9 sur 9) |
| T2 | `tests/security/r3-fonctions-rpc.test.ts` | 54fd8e1, cb0d3e2 | `LOT9_RPCS` : 10 fonctions du contrat, plus `account_identity_taken` (AM1) ; `...LOT9_RPCS` ; bloc strict 42501 | Fonctions nouvelles | PASS |
| T3 | même fichier | 54fd8e1 | Ligne `ticket_cash_checkin` retirée | Fonction supprimée par M5 (A16). De `54fd8e1` à M5, `r3` ne la contrôlait plus ; le contrat dit que `fonctions-privileges` la couvrait, R0 ne l'a pas revérifié | PASS |
| T4 | `tests/helpers/design-files.ts` | 54fd8e1 | Section « Lot 9 » (+14, 0 retirée) | Règle du lot | — (aide) |
| T5 | `tests/security/r7-profil-colonnes.test.ts:2-3,46,49-51` | 5edf241 | « prénom, nom, photo accepté » avec `deepEqual` → « par REST → refusé, la route est seule à écrire », `assertDenied`, relecture de `first_name`. Même nombre de lignes, citation `:46` intacte | **Renforcement** (L32, AR3). Écart à la lettre, dit plus bas | PASS |
| T6 | `tests/parcours/notif-outbox.test.ts` | 1fad0dc | 3 lignes au registre exact : `INVITATION_RECEIVED`, `PHONE_CHANGED`, `OTP_PHONE_CHANGE` | Types nouveaux, comparaison exacte | PASS |
| T7 | `tests/parcours/notif-modeles.test.ts` | 1fad0dc | Mêmes 3 types à `EXPECTED`, 3 textes exacts, `OTP_PHONE_CHANGE` à la boucle OTP (+7, -1) | Égalité registre-catalogue | PASS |
| T8 | `tests/parcours/notif-migration.test.ts` | 1fad0dc | `ticket_invitation_create` et `account_phone_finalize` à l'inventaire, `OTP_PHONE_CHANGE` à `TS_TYPES` | Inventaire K1 | PASS |
| T9 | `tests/parcours/pilotage-cloture-export.test.ts:233,297` | 31089d5 | CSV 4 → 5 colonnes, 6 → 7 colonnes, messages | Canal à l'export (L13) | PASS |
| T10 | `tests/parcours/admin-audit.test.ts:4,107,119-124` | c741bad | ADMIN 200 → `[['ADMIN', 403], ['SUPERADMIN', 200]]`, même nombre de lignes | A24 : **durcissement** | PASS |
| T11 | `tests/parcours/messages-bruts.test.ts:14,161-166` | c741bad | 404 « introuvable » → 500 `EVENT_UNAVAILABLE`, « momentanément indisponible » | A26 : une panne n'est pas une absence | PASS |
| T12 | `tests/parcours/decouverte-recherche.test.ts:12-13` | 298ac75 | Commentaire seul | A28 | PASS |
| T13 | `tests/parcours/acces-encaissement.test.ts` | 10780e9 | 12 tests → 5 (+19, -306). Retirés : `:166,235,250,271,304,331,397`. `:284` réduit à l'ouverture de caisse, nouveau `:69`, refus sans permission gardé. `:442` réduit à `shift_open` | A16 : parcours retiré. Sortie brute plus bas | PASS |
| T14 | `tests/parcours/acces-fenetre.test.ts` | 10780e9 | Bloc 4.4 supprimé, 8 tests → 7 (+9, -54) ; `:95` et `:116` inchangés | A16 | PASS |
| T15 | `tests/parcours/acces-limiteurs.test.ts` | 10780e9, 79a817e | Quota et refus d'encaissement retirés, titre de `:345` ; port `partner-auth 22` ajouté en fin. 17 tests → 17 | A16, A21 | PASS |
| T16 | `tests/parcours/acces-tracabilite.test.ts:23,46` | 10780e9 | `cash_required` retiré de l'union, même ligne. Rouge au run 110 jusqu'à `fix(9.4-A16s)` (AM3) | A16 | PASS |
| T17 | `tests/parcours/scan-idempotence.test.ts` | 10780e9 | PUT idempotent supprimé, 9 tests → 8 (+5, -64) | A16 | PASS |
| T18 | `tests/parcours/scan-controleur-stats.test.ts:436-451` | 10780e9 | Encaissement au scan → vente au guichet, même montant attendu `2500 + PRICE` | A16, le moyen seul change | PASS |
| T19 | `tests/parcours/dette-cloture-caisse.test.ts:246-256` | 10780e9 | Idem, assertions d'écart inchangées | A16 | PASS |
| T20 | `tests/parcours/hors-ligne-rotation.test.ts:389-420` | 10780e9 | Cas 9 supprimé, 11 tests → 10 | A16 : RPC retirée | PASS |
| T21 | `tests/parcours/partenaire-liste.test.ts:182-192` | 10780e9 | `cashSale` par scan → contrôleur affecté, caisse, vente au guichet | A16 | PASS |
| T22 | `tests/parcours/scanner-interface.test.ts:16,271,279` | 10780e9 | `a_encaisser` retiré. Le contrat a omis `SCAN_TONES` : voir B.2 | A16 | PASS |
| T23 | `tests/parcours/scanner-reprise.test.ts:210` | 10780e9 | `result: 'cash_required'` → `'payment_required'` | Type retiré, même intention | PASS |
| T24 | `tests/parcours/acces-helpers.ts`, `tests/parcours/pilotage-helpers.ts` | 10780e9 | Helper `cashCheckin` retiré ; `legacyCashCheckin` reproduit en SQL ce que `ticket_cash_checkin` laissait. `EXPECTED` inchangé, `entries.counter` reste 3 | A16, X5, L46 ★. R5 signale : ligne d'audit `CASH_COLLECTED` non reproduite (aucun test ne la lit), ligne `cash_required` datée d'une seconde avant la ligne `valid` | PASS (suites `pilotage-*`) |
| T25 | `tests/parcours/canaux-interface.test.ts:50` | 1032277 | Entrée `AdjustTicketQuotaModal` retirée de la liste blanche, remplacée par un commentaire pour garder les lignes `:197,205,275` | PO10. Annoncé vert au contrat, rouge en réalité au run 110 jusqu'à E4 (AM3) | PASS |
| T26 | `e2e/support/screens.ts` | c85b74d, f7cd941, a969a24, d255bf3 | `scanner-a-encaisser` retirée, `ready` sur `accueil`, 7 captures ajoutées (+87, -6) | A16, 9.1, 9.4 | captures OK |
| T27 | `e2e/captures.spec.ts:90-109` | c85b74d, a969a24 | `QR_ENTREE` global, `MASK_STYLE`, masque posé sur l'élément au lieu de l'option `mask` | 9.4. `runPageChecks` reste avant la capture, contrôles inchangés | captures OK |
| T28 | `tests/seed/seed-demo.ts` | 4e0dfce | Appels de `ticket_cash_checkin` retirés ; deux encaissements → une vente au guichet de 2, même caisse, même montant, un billet resté impayé | A16, L47. Fait en dehors de la vague R (AM5) | e2e-seed success |
| T29 | `tests/seed/seed-demo.ts`, `scripts/e2e/invariants-run.ts` | f0105fc | `assertRecetteInvariants` → `assertLot9Invariants` | AR6, commit de correctif | e2e-seed success, recette OK |
| T30 | `tests/README.md:29` | 79a817e | `tests/payment.test.ts` → `tests/samirpay-contrat.test.ts` | A21 | — |
| T31 | `tests/parcours/partenaire-lot7.test.ts:783` | 79a817e | Titre sans citer `tests/e2e-scenarios`, aucune assertion | A21 | PASS |
| T32 | `tests/parcours/push-service-worker.test.ts:181` | 79a817e | Message reformulé, aucune assertion | A21 | PASS |
| T33 à T35 | 6 suites à la racine de `tests/` | f1ff53d (5), 3ca034a (1) | **Supprimées**, 78 cas | A21, tableau ci-dessous | — |
| T36 | `tests/schema/recette-matrice.test.ts` | fede597 | `CORRIGEES` + A6, A7, A16, A17, A21, A24 à A28, A32 à A34, A38 à A40 ; `NOMBRE_ESSAIS` 61 → 69. **Au-delà du contrat** : PO3, PO4, PO10 contrôlés une fois chacun comme A1 à A41, mutation « PO3 retiré » | Matrice à jour, renforcement. `SUITES_INTERDITES` inchangée | **Non prouvé au run 113** (commit postérieur) ; D2 déclare 19/19 sans base, journal sans `failing tests` |

Aucun fichier de `.github/` n'a changé au lot (sortie en fin de section).

**B. Modifications hors de la liste du contrat**

| # | Fichier | Commit | Avant | Après | Raison | Run 113 |
|---|---|---|---|---|---|---|
| B.1 | `tests/parcours/notif-migration.test.ts` | b3c5a73 | Liste blanche des envois synchrones d'OTP | Entrée `app/api/account/phone/start/route.ts`, méthode `sendOtp` | **Seul élargissement du lot.** Rouge au run 111. Même catégorie que `send-otp` et `withdrawals/otp` : le code ne peut pas attendre l'envoyeur | PASS |
| B.2 | `tests/parcours/scanner-interface.test.ts:219` | 3c83ab1 | `SCAN_TONES` à 6 valeurs, dont `cash`, titre « les six paires » | 5 valeurs, titre « les cinq paires » | T22 l'avait omis : `nettoyage-sur-place` exige l'absence du jeton, les deux suites ne pouvaient pas être vertes ensemble (signalé par E4) | PASS |
| B.3 | `tests/parcours/sms-veille.test.ts` | d813751 | Jour tiré entre J+120 et J+1 800 | J+2 000 à J+3 680 | Run 112 : `remaining` 699 au lieu de 700, un SMS optionnel d'une autre suite tombait le même jour. Aucune assertion touchée | PASS |
| B.4 | `tests/parcours/canaux-interface.test.ts:35`, `e2e/support/screens.ts:539` | f7cd941 | Aide : « L'application n'envoie pas encore d'invitations… » | « Distribuez ses billets depuis l'onglet Invitations du pilotage. » | AM6, le texte était devenu faux | PASS ; captures OK |
| B.5 | `tests/parcours/acces-tracabilite.test.ts:255-262` | 3606784 | Cas « caméra en pause pendant une confirmation d'encaissement espèces » | Cas retiré, en-tête recalé à nombre de lignes égal (`:90`, `:144` gardées). 8 tests → 7 | S4 a montré qu'il resterait vert par coïncidence (`if (!canAcceptCash) return null`) une fois E4 passé. Retiré plutôt que réécrit. Voir 18.5 | PASS |
| B.6 | `tests/parcours/hors-ligne-service-worker.test.ts:585` | 3ca034a | Message citant `tests/e2e-scenarios.test.ts:171-173` | Message sans cette citation | Fichier supprimé. Assertion identique | PASS |
| B.7 | `tests/parcours/paiement-webhook.test.ts:156` | ef209ea | — | Test ajouté : corps multipart, 200, `received: true`, `REJECTED_INVALID_PAYLOAD`, `result_detail`, aucun billet (+25) | Port du cas 6-7 de `e2e-scenarios`, trouvé non couvert | PASS |
| B.8 | `tests/parcours/partenaire-lot7.test.ts:925` | ef209ea | — | Test ajouté (+9) : `Realtime \|\| connected` dans la source. Le titre dit ce qu'il prouve : la présence d'un mot | Port du cas 15 | PASS |
| B.9 | `tests/parcours/compte-numero.test.ts`, `compte-profil.test.ts` (suites du lot) | cb0d3e2 | Sondes `error.code === 'phone_exists'`, `'email_exists'` ; refus vus par l'API | Constat : l'appel échoue, `auth.users` inchangé, code non figé ; refus avant l'API (`put = 0`) | AM1. **Hors liste d'AM1, signalé** : les deux cas « présent seulement dans public.users » voient la vérification préalable libre une fois, sans quoi ils ne pouvaient plus atteindre la RPC. Assertions inchangées | PASS |
| B.10 | `tests/parcours/compte-paiements.test.ts` (suite du lot) | ef265f3 | `created_at` fourni pour certaines lignes | Fourni pour toutes | Run 111 : une insertion par lot mêlant les deux formes complète par NULL, 23502, échec avant la route. Valeurs attendues inchangées | PASS |
| B.11 | `tests/parcours/invitations.test.ts` (suite du lot) | 667cb16 | Catégorie inactive seule | Accompagnée d'une catégorie active | Run 111 : événement sans catégorie active non soumis (`SUBMIT_INCOMPLETE`), échec au montage. Refus attendu inchangé : `CATEGORY_INACTIVE` | PASS |
| B.12 | `e2e/support/parcours.ts` | f0105fc | Commentaire « (a) à (t) » | « (a) à (v) » | Hors T29 | recette OK |
| B.13 | `e2e/terrain.spec.ts:958`, `e2e/support/screens.ts:819` | d255bf3 | `/^écart constaté par le serveur$/i` | `/^écart constaté$/i` | Libellé changé par `a969a24` (« par le serveur » était un mot technique). Motif exact gardé | terrain OK, captures OK |
| B.14 | `playwright.config.ts` | a969a24 | Drapeau de langue seul | `--lang=fr-FR` en plus | Relecture du run 111, champs `datetime-local` en format américain. **Sans effet au run 113 : voir ci-dessous** | toutes phases OK |
| B.15 | `e2e/captures.spec.ts`, `e2e/support/screens.ts` | a969a24 | Faux 500 au texte générique | Option `injectErrorMessage`, texte réel de la route | Capture `accueil-populaires-erreur` ; aucun contrôle relâché | captures OK |

**B.14 n'a rien corrigé.** Le bilan de la relecture le marquait « corrigé, à confirmer au run ». Sur l'image du run 113 `partenaire-categorie-canaux__ordinateur__clair.png`, j'ai lu « 10/27/2026, 08:38 PM » et « mm/dd/yyyy, --:-- -- ». C'est le même format qu'aux lots précédents. Je n'ai ouvert que cette vue. Le format américain reste donc sur ces captures en CI ; `--lang=fr-FR` n'y change rien.

Nombre de lignes par fichier et nombre de tests avant et après, sorties brutes :

```text
$ git diff --numstat --diff-filter=M 534d6b3..HEAD -- tests e2e playwright.config.ts scripts .github
17	2	e2e/captures.spec.ts
105	2	e2e/recette.spec.ts
1	1	e2e/support/parcours.ts
87	6	e2e/support/screens.ts
1	1	e2e/terrain.spec.ts
3	2	playwright.config.ts
5	5	scripts/e2e/invariants-run.ts
1	1	tests/README.md
14	0	tests/helpers/design-files.ts
19	306	tests/parcours/acces-encaissement.test.ts
9	54	tests/parcours/acces-fenetre.test.ts
1	6	tests/parcours/acces-helpers.ts
23	15	tests/parcours/acces-limiteurs.test.ts
4	13	tests/parcours/acces-tracabilite.test.ts
5	5	tests/parcours/admin-audit.test.ts
3	3	tests/parcours/canaux-interface.test.ts
2	2	tests/parcours/decouverte-recherche.test.ts
12	9	tests/parcours/dette-cloture-caisse.test.ts
2	35	tests/parcours/hors-ligne-rotation.test.ts
1	1	tests/parcours/hors-ligne-service-worker.test.ts
4	4	tests/parcours/messages-bruts.test.ts
5	1	tests/parcours/notif-migration.test.ts
7	1	tests/parcours/notif-modeles.test.ts
3	0	tests/parcours/notif-outbox.test.ts
25	0	tests/parcours/paiement-webhook.test.ts
20	11	tests/parcours/partenaire-liste.test.ts
10	1	tests/parcours/partenaire-lot7.test.ts
2	2	tests/parcours/pilotage-cloture-export.test.ts
76	13	tests/parcours/pilotage-helpers.ts
1	1	tests/parcours/push-service-worker.test.ts
14	9	tests/parcours/scan-controleur-stats.test.ts
5	64	tests/parcours/scan-idempotence.test.ts
5	6	tests/parcours/scanner-interface.test.ts
1	1	tests/parcours/scanner-reprise.test.ts
2	2	tests/parcours/sms-veille.test.ts
17	9	tests/schema/recette-matrice.test.ts
44	1	tests/security/r3-fonctions-rpc.test.ts
6	6	tests/security/r7-profil-colonnes.test.ts
15	18	tests/seed/seed-demo.ts

# lignes test( ou it( en tête de ligne, à 534d6b3 puis à HEAD
acces-encaissement: avant=12 apres=5
acces-fenetre: avant=8 apres=7
acces-limiteurs: avant=17 apres=17
scan-idempotence: avant=9 apres=8
hors-ligne-rotation: avant=11 apres=10
scan-controleur-stats: avant=12 apres=12
dette-cloture-caisse: avant=14 apres=14
partenaire-liste: avant=13 apres=13
acces-tracabilite: avant=8 apres=7
scanner-interface: avant=31 apres=31
canaux-interface: avant=16 apres=16
```

Tests d'`acces-encaissement` avant et après T13 :

```text
$ git show 534d6b3:tests/parcours/acces-encaissement.test.ts | grep -nE '^\s*(test|describe)\(' | cut -c1-170
165:describe('Encaissement espèces au scan', () => {
166:    test('commande de 3 billets à régler sur place : cash_required au prix du billet, encaissement billet par billet, commande SUCCESS au dernier', async () => {
235:    test('commande de 2 billets VIP : un seul réglé → paid_amount = prix d’un billet, commande toujours impayée', async () => {
250:    test('commande payée entre le scan et l’encaissement : refus CASH_ALREADY_PAID, rien n’est composté ni encaissé', async () => {
271:    test('sans caisse ouverte : refus CASH_NO_OPEN_SHIFT pour le contrôleur, le partenaire propriétaire et l’admin, billet non composté', async () => {
284:    test('ouverture de caisse : partenaire propriétaire et admin ouvrent et encaissent ; contrôleur sans permission espèces refusé', async () => {
304:    test('scan d’un autre scanneur ou de plus de 5 minutes : refusé, billet non composté ; un scan frais du même scanneur passe', async () => {
331:    test('échec de l’encaissement (caisse fermée ou billet devenu non valable après le scan) : rien n’est composté, aucun paiement', async () => {
359:    test('ouvertures simultanées pour le même contrôleur et le même événement : une seule caisse OUVERT', async () => {
386:describe('Contrôles statiques et schéma de la caisse', () => {
387:    test('ShiftService sans repli en mémoire ni erreur avalée', () => {
397:    test('route de scan : encaissement délégué à ticket_cash_checkin (plus de compostage puis mise à jour de commande en TypeScript)', () => {
410:    test('schéma : index unique partiel des caisses OUVERT, ON DELETE RESTRICT sur controller_shifts.event_id, tickets.order_id et payments.shift_id', async () => {
442:    test('RPC shift_open et ticket_cash_checkin : SECURITY DEFINER, search_path = public, réservées au service_role', async () => {

$ grep -nE '^\s*(test|describe)\(' tests/parcours/acces-encaissement.test.ts | cut -c1-170
68:describe('Ouverture de caisse', () => {
69:    test('ouverture de caisse : partenaire propriétaire et admin ouvrent leur caisse ; contrôleur sans permission espèces refusé', async () => {
85:    test('ouvertures simultanées pour le même contrôleur et le même événement : une seule caisse OUVERT', async () => {
112:describe('Contrôles statiques et schéma de la caisse', () => {
113:    test('ShiftService sans repli en mémoire ni erreur avalée', () => {
123:    test('schéma : index unique partiel des caisses OUVERT, ON DELETE RESTRICT sur controller_shifts.event_id, tickets.order_id et payments.shift_id', async () => {
155:    test('RPC shift_open : SECURITY DEFINER, search_path = public, réservée au service_role', async () => {
```

Run 113 (`d255bf3`, « après »), récapitulatif de `npm run test`, lignes des suites citées en A et B :

```text
tests/parcours/acces-encaissement.test.ts              PASS     1.6s      0     .test-logs/tests__parcours__acces-encaissement.test.ts.log
tests/parcours/acces-fenetre.test.ts                   PASS     2.3s      0     .test-logs/tests__parcours__acces-fenetre.test.ts.log
tests/parcours/acces-limiteurs.test.ts                 PASS     9.7s      0     .test-logs/tests__parcours__acces-limiteurs.test.ts.log
tests/parcours/acces-tracabilite.test.ts               PASS     5.7s      0     .test-logs/tests__parcours__acces-tracabilite.test.ts.log
tests/parcours/admin-audit.test.ts                     PASS     2.5s      0     .test-logs/tests__parcours__admin-audit.test.ts.log
tests/parcours/canaux-interface.test.ts                PASS     723ms     0     .test-logs/tests__parcours__canaux-interface.test.ts.log
tests/parcours/compte-numero.test.ts                   PASS     14.3s     0     .test-logs/tests__parcours__compte-numero.test.ts.log
tests/parcours/compte-paiements.test.ts                PASS     5.3s      0     .test-logs/tests__parcours__compte-paiements.test.ts.log
tests/parcours/compte-profil.test.ts                   PASS     6.5s      0     .test-logs/tests__parcours__compte-profil.test.ts.log
tests/parcours/decouverte-recherche.test.ts            PASS     1.8s      0     .test-logs/tests__parcours__decouverte-recherche.test.ts.log
tests/parcours/dette-cloture-caisse.test.ts            PASS     4.5s      0     .test-logs/tests__parcours__dette-cloture-caisse.test.ts.log
tests/parcours/hors-ligne-rotation.test.ts             PASS     8.3s      0     .test-logs/tests__parcours__hors-ligne-rotation.test.ts.log
tests/parcours/hors-ligne-service-worker.test.ts       PASS     2.6s      0     .test-logs/tests__parcours__hors-ligne-service-worker.test.ts.log
tests/parcours/invitations.test.ts                     PASS     8.2s      0     .test-logs/tests__parcours__invitations.test.ts.log
tests/parcours/messages-bruts.test.ts                  PASS     2.6s      0     .test-logs/tests__parcours__messages-bruts.test.ts.log
tests/parcours/notif-migration.test.ts                 PASS     2.1s      0     .test-logs/tests__parcours__notif-migration.test.ts.log
tests/parcours/notif-modeles.test.ts                   PASS     1.4s      0     .test-logs/tests__parcours__notif-modeles.test.ts.log
tests/parcours/notif-outbox.test.ts                    PASS     2.5s      0     .test-logs/tests__parcours__notif-outbox.test.ts.log
tests/parcours/paiement-webhook.test.ts                PASS     2.7s      0     .test-logs/tests__parcours__paiement-webhook.test.ts.log
tests/parcours/partenaire-liste.test.ts                PASS     3.6s      0     .test-logs/tests__parcours__partenaire-liste.test.ts.log
tests/parcours/partenaire-lot7.test.ts                 PASS     7.5s      0     .test-logs/tests__parcours__partenaire-lot7.test.ts.log
tests/parcours/pilotage-acces.test.ts                  PASS     13.3s     0     .test-logs/tests__parcours__pilotage-acces.test.ts.log
tests/parcours/pilotage-apercu-ventes.test.ts          PASS     4.3s      0     .test-logs/tests__parcours__pilotage-apercu-ventes.test.ts.log
tests/parcours/pilotage-cloture-export.test.ts         PASS     4.4s      0     .test-logs/tests__parcours__pilotage-cloture-export.test.ts.log
tests/parcours/pilotage-entrees.test.ts                PASS     19.9s     0     .test-logs/tests__parcours__pilotage-entrees.test.ts.log
tests/parcours/pilotage-equipe-caisse.test.ts          PASS     4.2s      0     .test-logs/tests__parcours__pilotage-equipe-caisse.test.ts.log
tests/parcours/pilotage-invariant.test.ts              PASS     4.9s      0     .test-logs/tests__parcours__pilotage-invariant.test.ts.log
tests/parcours/pilotage-remboursement-billet.test.ts   PASS     5.3s      0     .test-logs/tests__parcours__pilotage-remboursement-billet.test.ts.log
tests/parcours/push-service-worker.test.ts             PASS     1.4s      0     .test-logs/tests__parcours__push-service-worker.test.ts.log
tests/parcours/scan-controleur-stats.test.ts           PASS     5.6s      0     .test-logs/tests__parcours__scan-controleur-stats.test.ts.log
tests/parcours/scan-idempotence.test.ts                PASS     3.9s      0     .test-logs/tests__parcours__scan-idempotence.test.ts.log
tests/parcours/scanner-interface.test.ts               PASS     4.9s      0     .test-logs/tests__parcours__scanner-interface.test.ts.log
tests/parcours/scanner-reprise.test.ts                 PASS     1.5s      0     .test-logs/tests__parcours__scanner-reprise.test.ts.log
tests/parcours/sms-veille.test.ts                      PASS     5.0s      0     .test-logs/tests__parcours__sms-veille.test.ts.log
tests/schema/messages-bruts.test.ts                    PASS     1.9s      0     .test-logs/tests__schema__messages-bruts.test.ts.log
tests/schema/recette-matrice.test.ts                   PASS     437ms     0     .test-logs/tests__schema__recette-matrice.test.ts.log
tests/security/r3-fonctions-rpc.test.ts                PASS     1.6s      0     .test-logs/tests__security__r3-fonctions-rpc.test.ts.log
tests/security/r7-profil-colonnes.test.ts              PASS     853ms     0     .test-logs/tests__security__r7-profil-colonnes.test.ts.log
…
TOTAL : 244 suite(s) — 244 réussie(s), 0 en échec, 0 expirée(s)
```

Run 113, phases e2e (lignes « passed » et « phase ») :

```text
  10 passed (15.8s)
[e2e] phase connexion : OK en 17s
  349 passed (16.4m)
[e2e] phase captures : OK en 985s
  5 passed (7.9s)
[e2e] phase emails : OK en 9s
  4 passed (5.3s)
[e2e] phase dev-page : OK en 6s
  2 passed (41.3s)
[e2e] phase fumee : OK en 42s
  13 passed (2.3m)
[e2e] phase terrain : OK en 137s
  4 passed (5.0s)
[e2e] phase pwa : OK en 6s
[e2e] phase fake-prod : OK en 2s
  4 passed (3.2m)
[e2e] phase perf : OK en 195s
  9 passed (1.4m)
[e2e] phase recette : OK en 84s
[e2e] résumé :connexion OK · captures OK · emails OK · dev-page OK · fumee OK · terrain OK · pwa OK · fake-prod OK · perf OK · recette OK
```

Suites supprimées : voir la section 5, tableau A21.

### Écarts au contrat dans les commits et les tests

**Écarts au périmètre, à la lettre ou par décision**
- **L32, colonnes de profil fermées en REST.** `REVOKE UPDATE (first_name, last_name, avatar_url) ON public.users FROM authenticated`. La consigne 9.2 ne le demandait pas : sans cela, Zod était contournable. `r7` est modifié en conséquence (T5). Aucune écriture client de `users` dans `app/`, `components/`, `hooks/` (grep du contrat).
- **D2, bucket `avatars` écrit par la route seule (AR3, L34) : écart à la lettre.** La consigne dit « Seul le propriétaire peut écrire ». Aucune politique sur `storage.objects`, la route est seule à écrire (service_role), pour que sharp et le retrait EXIF ne soient pas contournables. « Seul le propriétaire » est tenu par le chemin imposé : `<id de session>/<uuid>.webp`.
- **D8 de la découverte du compte : refusée (AR1).** La découverte proposait un blocage des retraits de 24 h après un changement de numéro. Non construit, point ouvert 18.1 : la seule garde est le SMS à l'ancien numéro.
- **A39, plus large que la consigne (L43)** : « DOCUMENT OFFICIEL… » est retiré aussi, non cité par la consigne.
- **A24, lien masqué (AR10)** : les liens vers `/admin/audit` sont masqués pour un ADMIN qui n'est pas SUPERADMIN, en plus du refus de la route.
- **A16, fixture historique (L46 ★)** : `legacyCashCheckin` reproduit en SQL l'encaissement passé, pour qu'aucune assertion du pilotage ne change.
- **`docs/essai-local.md`, section 8.15 ajoutée hors liste** par D1 : changement de numéro. C'est le seul contrôle, sur un projet hébergé, des écritures sur `auth.sessions` et `auth.refresh_tokens`. À retirer si tu préfères.

**Écarts de méthode**
- **Mode ciblé `[recette-seule]` non utilisé au lot 9.** AR9 l'autorisait : `verify.yml` n'a pas été touché, aucun message ne le cite. Les runs 110 à 113 sont des runs complets.
- **`git rm` par un agent.** L'agent de suppression A21 a retiré les fichiers par `git rm` avant `commit8.sh`, alors que `commit8.sh` devait être la seule commande (`f1ff53d` ne contient que les 5 chemins). Un seul agent le déclare dans sa réponse ; je n'ai pas de moyen de le vérifier pour les autres suppressions (`2423f39`, `f1b4ed6`, `3ca034a`), leurs réponses n'en parlent pas.
- **Un commit par tâche (AR16) : plusieurs commits sur une même tâche, chacun avec son objet.** `fix(9.1e)` en trois (`b5e8f32`, `d992ef2`, `a525015`), les deux derniers pour le budget JS ; A21 en cinq (`79a817e`, `f1ff53d`, `ef209ea`, `3ca034a`, et `1032277` pour la preuve) ; `fix(9.4-PO10e)` s'ajoute à `fix(9.4-PO10)` du contrat parce que les deux modaux étaient au domaine d'E4.
- **T28 fait hors vague R (AM5)** : R-E2E ne l'a pas pris, le seed appelait encore `ticket_cash_checkin`. Fait par `4e0dfce`, avant `fix(9.4-A16s)`.
- **`next/dynamic` sur `/` (L53).** Budget de `/` dépassé au run 111 (217 389 octets pour 217 000) puis au run 112 (217 012). `HomeDiscovery` (`d992ef2`) puis `AccessNotice` (`a525015`) sont chargés à part. **Le budget n'est pas relevé, mais ces morceaux ne comptent plus dans la mesure** : mesure du run 113, section 11.
- **Exécutions locales** :
  - Sondes PostgreSQL 14 jetables (R0, R4, R5, S0, S1, S2, S3, D1) : permises par D-out 6, jamais citées comme preuve, arrêtées ou supprimées selon les agents.
  - Banc hors dépôt `S/e1-smoke` (E1), rejeux `S/e2-a24-static.cjs`, `S/e3-statique.cjs`, `S/rejeu-a21-webhook.mts` : aucun n'est une preuve.
  - **`scripts/e2e/build-mesure.mjs`, lancé par E1 et par R2 sur le poste, ouvre `.env.local` pour en neutraliser les clés** (`:48-58`, il en affiche les noms). E1 dit ne pas avoir regardé les valeurs. Le contrat dit « `.env.local` jamais lu » : c'est une lecture par un script existant, pas par un agent, je le signale quand même.
  - S2 a copié puis supprimé aussitôt un fichier temporaire dans `tests/`. Rien n'en reste ni n'est committé.
- **Pas de `npm install`, aucun `--amend`, aucun test contre un Supabase distant** d'après les réponses des agents ; je n'ai pas d'autre preuve que ces réponses et l'historique linéaire de la branche.

**Messages de commit inexacts, laissés tels quels** (`--amend` est interdit)
- `2423f39` annonce « les 3 tests PO10 restants ». Il y en a 2, un par fichier supprimé. Le décompte 10 sur 11 est juste.
- `505d70f` dit `acces-tracabilite` « relu ligne à ligne ». S4 n'en avait lu qu'une partie à ce moment-là. La lecture complète, faite juste après, n'a pas changé le code ; c'est elle qui a trouvé le cas caméra (B.5).

**Contrat, sections devenues inexactes ou contradictoires**
- AR2, L24 et la section 5.3 parlent encore de `phone_exists` et `email_exists` : AM1 fait foi.
- Section 6.4 : « `lot9-invariant` rouge jusqu'à M2 » alors que la garde exige aussi M4 (R0).
- Section 10 : « captures existantes » restent vertes, alors que T26 rend `accueil` rouge (R-E2E).
- Section 7, étape 5 de l'acte 9 : `openScanner` est écarté, la reprise de session retient E1 depuis l'acte 5 (R-E2E).
- Section 3.2 : `VOLATILE` écrit sur `ticket_refund_request`, `ticket_category_guard` et `participants_export`, seul écart au « rien d'autre », sans effet sur le comportement (S3, S0).
- Section 10 : `lib/auth/session.ts:60` n'avait pas de commit, porté par `fix(9.3-A24s)` (S3).

```text
$ git log --format='%h %s' 534d6b3..HEAD -- .github | wc -l
0
$ git log --format='%h' --grep='recette-seule' 534d6b3..HEAD | wc -l
0
$ git grep -c recette-seule HEAD -- .github/workflows/verify.yml; echo "code $?"
code 1

$ git log -1 --format=%s 2423f39 | grep -o 'Fait passer au vert les 3 tests PO10 restants[^;]*'
Fait passer au vert les 3 tests PO10 restants de code-mort-lot9 (10 sur 11, le 11e porte sur tests/e2e-scenarios.test.ts, hors de ce lot d'écran) et le contrôle is_visible de canaux-interface 
$ git log -1 --format=%s 505d70f | grep -o 'nettoyage-sur-place et acces-tracabilite relus ligne à ligne'
nettoyage-sur-place et acces-tracabilite relus ligne à ligne
```

---

---

## 2. Par tâche : origine, test rouge, correctif, test vert

**Les runs de référence.**
- **Avant** : run 110 (`42499989446`, commit `e6c23d1`), 212 suites vertes sur 250, 38 en échec, phases e2e `captures` et `recette` en échec. Les tests rouges sont committés, aucun correctif ne l'est.
- **Après** : run 113 (`42519327711`, commit `d255bf3`), job vert, 244 suites sur 244, toutes les phases e2e, recette à 9 actes. **Tous les extraits verts ci-dessous viennent du run 113.** Les commits `75943b1b` et `fede5970` (matrice, T36) sont postérieurs : ils ne touchent pas au code d'application. Le second run à code d'application identique, lancé après le commit de la matrice, n'est pas décrit dans cette section.

**Origine des extraits.**
- Chaque bloc « run 110 / run 113 » est recopié par script des journaux `test-logs/<suite>.log` des deux runs. On y trouve : quelques sous-tests en échec, avec les deux premières lignes de leur erreur ; le crochet `after()` en échec quand il existe ; au run 113, les **mêmes** sous-tests retrouvés par leur nom, le nombre des autres réussis, la ligne `[INVARIANT-LOT9]` de la suite et les compteurs TAP (**toujours ceux de la suite entière**, même sous filtre).
- Quand une suite porte plusieurs tâches, seuls les sous-tests de la tâche sont retenus, et le filtre est imprimé dans l'en-tête du bloc.
- Les lignes sont tronquées à 240 caractères (`…`). Le script masque tout champ `totp_secret` et tout jeton ; aucun de ces journaux n'en contient dans les extraits retenus.
- Les blocs `git show <sha>:<fichier>` montrent les lignes du défaut sur `534d6b3`, le point de départ du lot : rejoués pour ce rapport, ils confirment les citations de la découverte. Les autres citations « Origine » viennent des fichiers `scratchpad/discovery-9-*.md`, sans rejeu.
- `M/` = `supabase/migrations/`. Les blocs « git show --numstat » donnent les fichiers et les lignes de chaque commit de correctif ; les traces `docs/lot9-logs/` sont comptées, pas listées.

**Ce que ces rouges prouvent, et ce qu'ils ne prouvent pas.** Pour une fonction neuve (invitations, découverte, compte, photo), le rouge du run 110 dit seulement que la route ou la RPC n'existe pas encore : il prouve que le test échoue sans le code, pas que le test est juste. Ces tests n'ont touché du vrai code qu'au vert. Les rouges qui constatent un défaut existant sont ceux de 9.3 et de A16. Ne se lisent pas au run 110, parce que leur test a changé ou a été écrit après : les constats AM1 (`cb0d3e25`), l'aide AM6 (`f7cd9419`), `account_identity_taken` dans `r3`, et le port multipart de A21 (`ef209ead`). Le masque des captures n'a aucun test rouge : sa preuve est une image (fin de 9.4).

### Socle commun du lot

Rejeu des cinq migrations, privilèges des RPC du lot, garde de schéma des invariants, fichiers d'écran déclarés.

```text
# run 110 (e6c23d1, « avant ») — tests/schema/migration-lot9-rejouable.test.ts
not ok 1 - les migrations 20261108… du dépôt sont exactement les cinq du contrat, dans cet ordre
      error: migrations 20261108… présentes : aucune
not ok 2 - 20261108000001_lot9_securite.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
      error: 'migration du lot 9 absente : supabase/migrations/20261108000001_lot9_securite.sql (contrat, section 3.1)'
# … 4 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 2 - /home/runner/work/event-village/event-village/tests/schema/migration-lot9-rejouable.test.ts
  schéma du lot 9 incomplet (migration-lot9-rejouable) : invariants (t)(u)(v) impossibles à vérifier :
  fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
  fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
# tests 6
# pass 0
# fail 6
# cancelled 0
# run 113 (d255bf3, « après ») — tests/schema/migration-lot9-rejouable.test.ts
ok 1 - les migrations 20261108… du dépôt sont exactement les cinq du contrat, dans cet ordre
ok 2 - 20261108000001_lot9_securite.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
ok 3 - 20261108000002_lot9_invitations.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
ok 4 - 20261108000003_lot9_decouverte.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
ok 5 - 20261108000004_lot9_compte.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
ok 6 - 20261108000005_lot9_nettoyage.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
[INVARIANT-LOT9] migration-lot9-rejouable — (t)(u)(v) : 0 violation(s)
# tests 6
# pass 6
# fail 0
# cancelled 0
```

```text
# run 110 (e6c23d1, « avant ») — tests/security/r3-fonctions-rpc.test.ts  [sous-tests retenus : /lot 9/]
not ok 1 - anon et authenticated (compte CLIENT) : rpc(ticket_invitation_create) existe et est refusée
      error: 'anon rpc(ticket_invitation_create) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.ticket_invitation_create(p) in the schema cache — PGRST202 : fonction absente (migrations 20261108000001 (sécurité), …02 (i …
not ok 2 - anon et authenticated (compte CLIENT) : rpc(ticket_invitation_cancel) existe et est refusée
      error: 'anon rpc(ticket_invitation_cancel) : refus attendu par le privilège EXECUTE (42501), obtenu PGRST202 Could not find the function public.ticket_invitation_cancel(p) in the schema cache — PGRST202 : fonction absente (migrations 20261108000001 (sécurité), …02 (i …
# … 8 autre(s) sous-test(s) en échec retenu(s)
# tests 312
# pass 302
# fail 10
# cancelled 0
# run 113 (d255bf3, « après ») — tests/security/r3-fonctions-rpc.test.ts  [sous-tests retenus : /lot 9/]
ok 1 - anon et authenticated (compte CLIENT) : rpc(ticket_invitation_create) existe et est refusée
ok 2 - anon et authenticated (compte CLIENT) : rpc(ticket_invitation_cancel) existe et est refusée
ok 3 - anon et authenticated (compte CLIENT) : rpc(ticket_invitations_list) existe et est refusée
ok 4 - anon et authenticated (compte CLIENT) : rpc(account_profile_finalize) existe et est refusée
ok 5 - anon et authenticated (compte CLIENT) : rpc(account_phone_finalize) existe et est refusée
ok 7 - anon et authenticated (compte CLIENT) : rpc(account_avatar_set) existe et est refusée
# … 5 autre(s) sous-test(s) réussi(s) dans ce filtre
# tests 315
# pass 315
# fail 0
# cancelled 0
```

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/lot9-invariant.test.ts  [sous-tests retenus : /garde/]
not ok 1 - RPC ticket_invitation_create : présent, puis retiré dans une transaction annulée, la garde le nomme
      error: RPC ticket_invitation_create : l'objet doit exister avant la coupure (migrations M2 et M4 du lot) : fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
not ok 2 - RPC account_phone_finalize : présent, puis retiré dans une transaction annulée, la garde le nomme
      error: RPC account_phone_finalize : l'objet doit exister avant la coupure (migrations M2 et M4 du lot) : fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
# … 6 autre(s) sous-test(s) en échec retenu(s)
# tests 23
# pass 0
# fail 23
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/lot9-invariant.test.ts  [sous-tests retenus : /garde/]
ok 1 - RPC ticket_invitation_create : présent, puis retiré dans une transaction annulée, la garde le nomme
ok 2 - RPC account_phone_finalize : présent, puis retiré dans une transaction annulée, la garde le nomme
ok 3 - contrainte tickets_holder_or_counter : présent, puis retiré dans une transaction annulée, la garde le nomme
ok 4 - ticket_transfers.from_user_id nullable : présent, puis retiré dans une transaction annulée, la garde le nomme
ok 5 - tickets_sale_decision_set sans INVITATION : présent, puis retiré dans une transaction annulée, la garde le nomme
ok 6 - type INVITATION_RECEIVED au registre : présent, puis retiré dans une transaction annulée, la garde le nomme
ok 7 - type PHONE_CHANGED au registre : présent, puis retiré dans une transaction annulée, la garde le nomme
ok 8 - bucket avatars public : présent, puis retiré dans une transaction annulée, la garde le nomme
[INVARIANT-LOT9] lot9-invariant — (t)(u)(v) : 0 violation(s)
# tests 23
# pass 23
# fail 0
# cancelled 0
```

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/design-systeme.test.ts  [sous-tests retenus : /garde-fou|InvitationsTab/]
not ok 3 - garde-fou : chaque entrée de la liste existe, sans doublon, en chemin relatif à la racine
      error: entrées invalides ou fichiers absents : components/partner/pilotage/InvitationsTab.tsx, components/events/HomeDiscovery.tsx, components/ui/Avatar.tsx, components/profile/ProfileForm.tsx, components/profile/PhoneChangeDialog.tsx, components/profile/AvatarEditor …
not ok 277 - règles du contrat Q : components/partner/pilotage/InvitationsTab.tsx
      error: 'components/partner/pilotage/InvitationsTab.tsx absent'
# … 1 autre(s) sous-test(s) en échec retenu(s)
# tests 327
# pass 310
# fail 17
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/design-systeme.test.ts  [sous-tests retenus : /garde-fou|InvitationsTab/]
ok 3 - garde-fou : chaque entrée de la liste existe, sans doublon, en chemin relatif à la racine
ok 277 - règles du contrat Q : components/partner/pilotage/InvitationsTab.tsx
ok 278 - accessibilité et mobile (DoD 3 et 7) : components/partner/pilotage/InvitationsTab.tsx
# … 7 autre(s) sous-test(s) réussi(s) dans ce filtre
# tests 327
# pass 327
# fail 0
# cancelled 0
```

Les 32 lignes `[INVARIANT-LOT9]` du `verify.log` du run 113 qui ne disent pas « 0 violation » sont toutes celles de cette garde : l'objet est retiré dans une transaction annulée, et le test exige qu'il soit nommé. Les 23 autres lignes de suites disent 0 violation :

```text
$ grep -E '^\[INVARIANT-LOT9\].*schéma du lot 9 incomplet' S/run113/verify.log
[INVARIANT-LOT9] lot9-invariant garde — schéma du lot 9 incomplet : 1 objet(s) manquant(s)
[INVARIANT-LOT9] lot9Violations — schéma du lot 9 incomplet : 1 objet(s) manquant(s)
# … 14 autre(s) ligne(s)
```

### 9.0 — Outil d'invitations

**Origine.** `discovery-9-invitations.md`, section 1 : le mécanisme de transfert ne se réutilise pas tel quel. `ticket_transfers.from_user_id` est `NOT NULL` ; un billet sans porteur n'est permis qu'au guichet ; `ticket_transfer_accept` envoie un avis à l'expéditeur, qui lève NT004 sans expéditeur.

```text
$ git show 534d6b3:supabase/migrations/20260908000001_ticket_transfers_p2p.sql  [lignes 40]
40:     from_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
```

```text
$ git show 534d6b3:supabase/migrations/20261102000002_lot5_dette.sql  [lignes 53-55]
53: ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_holder_or_counter;
54: ALTER TABLE public.tickets ADD CONSTRAINT tickets_holder_or_counter
55:     CHECK (user_id IS NOT NULL OR sale_channel = 'COUNTER');
```

```text
$ git show 534d6b3:supabase/migrations/20261105000007_lot7_confirmation.sql  [lignes 364-366]
364:     PERFORM public.notif_enqueue(jsonb_build_object(
365:         'type', 'TRANSFER_CLAIMED_SENDER', 'key', 'TRANSFER_CLAIMED_SENDER:' || tr.id::text,
366:         'user_id', tr.from_user_id, 'event_id', v_event, 'data', v_data));
```

Deux pièges relevés au même endroit : avec un `actor_id`, le 31e SMS du jour serait refusé (`lib/sms/sms-guard.ts:114`, `SMS_PER_ACCOUNT_DAY` à 30, quota métier à 50 par heure) ; un quota réservé avant les droits laisserait un tiers épuiser celui d'un événement qui n'est pas le sien.

**Tests.** Rouges de `31089d54` (invitations) et `1fad0dcf` (registre et catalogue, T6 à T8).

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/invitations.test.ts
not ok 1 - sans session : middleware 401 sur /api/partner/events/<id>/invitations, puis route 401 AUTH_REQUIRED en POST et en GET
      error: "POST /api/partner/events/[id]/invitations (contrat 4.1) absente (../../app/api/partner/events/[id]/invitations/route) : Cannot find module '/home/runner/work/event-village/event-village/app/api/partner/events/[id]/invitations/route' imported from /home/runner …
not ok 2 - partenaire propriétaire : 200 { ok, ticket_count, phone_count, message }
      error: "POST /api/partner/events/[id]/invitations (contrat 4.1) absente (../../app/api/partner/events/[id]/invitations/route) : Cannot find module '/home/runner/work/event-village/event-village/app/api/partner/events/[id]/invitations/route' imported from /home/runner …
not ok 3 - tiers : autre partenaire, client et contrôleur affecté → 404 EVENT_NOT_FOUND, sans écriture ; un actor_id dans le corps n’y change rien
      error: "POST /api/partner/events/[id]/invitations (contrat 4.1) absente (../../app/api/partner/events/[id]/invitations/route) : Cannot find module '/home/runner/work/event-village/event-village/app/api/partner/events/[id]/invitations/route' imported from /home/runner …
not ok 4 - ADMIN sans events.write : 403 FORBIDDEN ; ADMIN avec events.write et SUPERADMIN : 200
      error: "POST /api/partner/events/[id]/invitations (contrat 4.1) absente (../../app/api/partner/events/[id]/invitations/route) : Cannot find module '/home/runner/work/event-village/event-village/app/api/partner/events/[id]/invitations/route' imported from /home/runner …
# … 26 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 9 - /home/runner/work/event-village/event-village/tests/parcours/invitations.test.ts
  schéma du lot 9 incomplet (invitations) : invariants (t)(u)(v) impossibles à vérifier :
  fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
  fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
# tests 30
# pass 0
# fail 30
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/invitations.test.ts
ok 1 - sans session : middleware 401 sur /api/partner/events/<id>/invitations, puis route 401 AUTH_REQUIRED en POST et en GET
ok 2 - partenaire propriétaire : 200 { ok, ticket_count, phone_count, message }
ok 3 - tiers : autre partenaire, client et contrôleur affecté → 404 EVENT_NOT_FOUND, sans écriture ; un actor_id dans le corps n’y change rien
ok 4 - ADMIN sans events.write : 403 FORBIDDEN ; ADMIN avec events.write et SUPERADMIN : 200
ok 5 - compte inactif : route 403 ACCOUNT_NOT_ACTIVE ; RPC directe ACCOUNT_NOT_ACTIVE
ok 6 - statuts BROUILLON, EN_ATTENTE, SUSPENDU, TERMINE, ANNULE : 409 EVENT_NOT_ACTIVE, sans écriture
# … 24 autre(s) sous-test(s) réussi(s)
[INVARIANT-LOT9] invitations — (t)(u)(v) : 0 violation(s)
# tests 30
# pass 30
# fail 0
# cancelled 0
```

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/invitations-reclamation.test.ts
not ok 1 - le billet est retrouvé dans « Reçus », accepté, numéro, QR et secret changés ; aucun avis à un expéditeur
      error: "POST /api/partner/events/[id]/invitations (contrat 4.1) absente (../../app/api/partner/events/[id]/invitations/route) : Cannot find module '/home/runner/work/event-village/event-village/app/api/partner/events/[id]/invitations/route' imported from /home/runner …
not ok 2 - plusieurs billets : un transfert et une acceptation par billet
      error: "POST /api/partner/events/[id]/invitations (contrat 4.1) absente (../../app/api/partner/events/[id]/invitations/route) : Cannot find module '/home/runner/work/event-village/event-village/app/api/partner/events/[id]/invitations/route' imported from /home/runner …
# … 5 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/invitations-reclamation.test.ts
  schéma du lot 9 incomplet (invitations-reclamation) : invariants (t)(u)(v) impossibles à vérifier :
  fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
  fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
# tests 7
# pass 0
# fail 7
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/invitations-reclamation.test.ts
ok 1 - le billet est retrouvé dans « Reçus », accepté, numéro, QR et secret changés ; aucun avis à un expéditeur
ok 2 - plusieurs billets : un transfert et une acceptation par billet
ok 1 - autre compte : 404 identique à un transfert inconnu, billet intact
ok 2 - compte au numéro non vérifié : aucun détail, 403 PHONE_NOT_VERIFIED, puis accepté une fois vérifié (AR15)
ok 3 - route d’annulation d’un transfert : 403 NOT_SENDER pour le partenaire et le destinataire, transfert PENDING et billet verrouillé (L3)
ok 1 - expiration : 410 avant le passage du cron, puis EXPIRED sans aucun avis, billet déverrouillé et sans porteur, réclamation 409
# … 1 autre(s) sous-test(s) réussi(s)
[INVARIANT-LOT9] invitations-reclamation — (t)(u)(v) : 0 violation(s)
# tests 7
# pass 7
# fail 0
# cancelled 0
```

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/invitations-quotas.test.ts
not ok 1 - événement : 50 numéros par heure, le 51e est refusé, stock et billets inchangés
      error: "POST /api/partner/events/[id]/invitations (contrat 4.1) absente (../../app/api/partner/events/[id]/invitations/route) : Cannot find module '/home/runner/work/event-village/event-village/app/api/partner/events/[id]/invitations/route' imported from /home/runner …
not ok 2 - numéro : 3 envois par jour, tous événements confondus, quelle que soit la quantité ; le 4e est refusé
      error: "POST /api/partner/events/[id]/invitations (contrat 4.1) absente (../../app/api/partner/events/[id]/invitations/route) : Cannot find module '/home/runner/work/event-village/event-village/app/api/partner/events/[id]/invitations/route' imported from /home/runner …
# … 4 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/invitations-quotas.test.ts
  schéma du lot 9 incomplet (invitations-quotas) : invariants (t)(u)(v) impossibles à vérifier :
  fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
  fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
# tests 6
# pass 0
# fail 6
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/invitations-quotas.test.ts
ok 1 - événement : 50 numéros par heure, le 51e est refusé, stock et billets inchangés
ok 2 - numéro : 3 envois par jour, tous événements confondus, quelle que soit la quantité ; le 4e est refusé
ok 1 - un numéro au plafond dans l’envoi : refus entier, rien pour les autres numéros, leur quota intact
ok 2 - une règle par numéro : 3 numéros sur une limite de 2 refusés en bloc, puis 2 acceptés
ok 3 - un refus de stock ne consomme aucun quota
ok 4 - un tiers ne consomme pas le quota de l’événement
[INVARIANT-LOT9] invitations-quotas — (t)(u)(v) : 0 violation(s)
# tests 6
# pass 6
# fail 0
# cancelled 0
```

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/invitations-annulation.test.ts
not ok 1 - sans session : 401 AUTH_REQUIRED
      error: "POST /api/partner/events/[id]/invitations (contrat 4.1) absente (../../app/api/partner/events/[id]/invitations/route) : Cannot find module '/home/runner/work/event-village/event-village/app/api/partner/events/[id]/invitations/route' imported from /home/runner …
not ok 2 - invitation en attente : billet ANNULE et déverrouillé, transfert CANCELLED, stock rendu, audit ; aucune notification
      error: "POST /api/partner/events/[id]/invitations (contrat 4.1) absente (../../app/api/partner/events/[id]/invitations/route) : Cannot find module '/home/runner/work/event-village/event-village/app/api/partner/events/[id]/invitations/route' imported from /home/runner …
# … 8 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/invitations-annulation.test.ts
  schéma du lot 9 incomplet (invitations-annulation) : invariants (t)(u)(v) impossibles à vérifier :
  fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
  fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
# tests 10
# pass 0
# fail 10
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/invitations-annulation.test.ts
ok 1 - sans session : 401 AUTH_REQUIRED
ok 2 - invitation en attente : billet ANNULE et déverrouillé, transfert CANCELLED, stock rendu, audit ; aucune notification
ok 3 - acceptation après annulation : 409 TRANSFER_NOT_PENDING, absente de « Reçus », billet resté annulé
ok 4 - après réclamation : billet au compte annulé, transfert CLAIMED conservé, stock rendu, aucun avis
ok 5 - attribution directe à un compte vérifié : annulable, stock rendu
ok 6 - événement suspendu : annulation permise, le statut n’est pas contrôlé
# … 4 autre(s) sous-test(s) réussi(s)
[INVARIANT-LOT9] invitations-annulation — (t)(u)(v) : 0 violation(s)
# tests 10
# pass 10
# fail 0
# cancelled 0
```

Concurrence, trois connexions, attentes constatées sans minuterie :

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/invitations-course.test.ts
not ok 1 - 1. dépassement du stock : un seul envoi passe, stock exact, rien pour le perdant
      error: RPC absentes (migration M2, contrat 5.1) : ticket_invitation_create(jsonb), ticket_invitation_cancel(jsonb)
not ok 2 - 2. témoin : deux envois qui tiennent exactement dans le stock passent, stock exact
      error: RPC absentes (migration M2, contrat 5.1) : ticket_invitation_create(jsonb), ticket_invitation_cancel(jsonb)
not ok 1 - 3. annulation d’abord : la réclamation attend, puis TRANSFER_NOT_PENDING ; billet annulé, sans porteur, stock rendu
      error: RPC absentes (migration M2, contrat 5.1) : ticket_invitation_create(jsonb), ticket_invitation_cancel(jsonb)
not ok 2 - 4. réclamation d’abord : l’annulation attend, puis annule le billet réclamé ; transfert CLAIMED, stock rendu
      error: RPC absentes (migration M2, contrat 5.1) : ticket_invitation_create(jsonb), ticket_invitation_cancel(jsonb)
# crochet en échec :
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/invitations-course.test.ts
  schéma du lot 9 incomplet (invitations-course) : invariants (t)(u)(v) impossibles à vérifier :
  fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
  fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
# tests 4
# pass 0
# fail 4
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/invitations-course.test.ts
ok 1 - 1. dépassement du stock : un seul envoi passe, stock exact, rien pour le perdant
ok 2 - 2. témoin : deux envois qui tiennent exactement dans le stock passent, stock exact
ok 1 - 3. annulation d’abord : la réclamation attend, puis TRANSFER_NOT_PENDING ; billet annulé, sans porteur, stock rendu
ok 2 - 4. réclamation d’abord : l’annulation attend, puis annule le billet réclamé ; transfert CLAIMED, stock rendu
[INVARIANT-LOT9] invitations-course — (t)(u)(v) : 0 violation(s)
# tests 4
# pass 4
# fail 0
# cancelled 0
```

Invariants (t) étendu et (u) :

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/lot9-invariant.test.ts  [sous-tests retenus : /Invariant \((t|u)\)/]
not ok 1 - t5 : billet INVITATION dont la décision ne vient pas d'une invitation ; témoins : décisions INVITATION et REPRISE
      error: schéma du lot 9 incomplet (lot9-invariant t5) : invariants (t)(u)(v) impossibles à vérifier :
        fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
not ok 2 - t6 : décision INVITATION sur un billet ONLINE, puis COUNTER ; témoin : billet INVITATION
      error: schéma du lot 9 incomplet (lot9-invariant t6) : invariants (t)(u)(v) impossibles à vérifier :
        fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
# … 6 autre(s) sous-test(s) en échec retenu(s)
# tests 23
# pass 0
# fail 23
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/lot9-invariant.test.ts  [sous-tests retenus : /Invariant \((t|u)\)/]
ok 1 - t5 : billet INVITATION dont la décision ne vient pas d'une invitation ; témoins : décisions INVITATION et REPRISE
ok 2 - t6 : décision INVITATION sur un billet ONLINE, puis COUNTER ; témoin : billet INVITATION
ok 1 - u1 : invitation à prix non nul, ou rattachée à un paiement ; témoin : gratuite sans paiement
ok 2 - u2 : invitation sans porteur et sans transfert ; témoins : transfert en attente, échu, billet annulé, billet avec porteur
ok 3 - u3 : billet sans porteur en attente, non verrouillé ; témoin : verrouillé
ok 4 - u4 : transfert sans expéditeur sur un billet ONLINE ; témoins : billet INVITATION, transfert avec expéditeur
ok 5 - u5 : numéro en clair dans chaque action du journal, puis dans old_value et new_value ; témoins : numéro masqué, UUID à 9 chiffres
ok 6 - u6 : plus d'invitations actives que de vendus sur une catégorie passée par la RPC ; témoins : égalité, billet annulé, catégorie hors RPC
[INVARIANT-LOT9] lot9-invariant — (t)(u)(v) : 0 violation(s)
# tests 23
# pass 23
# fail 0
# cancelled 0
```

Tests existants adaptés (signalés en section 1) : export à une colonne de plus (T9), registre et catalogue (T6 à T8).

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/pilotage-cloture-export.test.ts
not ok 1 - sans contacts : CSV UTF-8 avec BOM, en-têtes français, nom / catégorie / statut (libellé) / heure d’entrée, sans paiement, numéro, téléphone ni email
      error: cinq colonnes sans les contacts (Canal ajouté, lot 9) : ["Nom","Catégorie","Statut du billet","Heure d’entrée"]
        4 !== 5
# … 2 autre(s) sous-test(s) en échec retenu(s)
# tests 8
# pass 5
# fail 3
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/pilotage-cloture-export.test.ts
ok 1 - sans contacts : CSV UTF-8 avec BOM, en-têtes français, nom / catégorie / statut (libellé) / heure d’entrée, sans paiement, numéro, téléphone ni email
ok 3 - contacts avec une finalité de la liste fermée : téléphone et email ajoutés, toujours sans donnée de paiement
ok 4 - chaque export journalisé : acteur, contacts, finalité, nombre de lignes, sans donnée de participant ; l’admin aussi
# … 5 autre(s) sous-test(s) réussi(s)
# tests 8
# pass 8
# fail 0
# cancelled 0
```

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/notif-outbox.test.ts
not ok 1 - public.notification_types contient exactement les types du contrat, avec famille, sujet, canaux, audience, politique, journal et permission
      error: types absents du registre : INVITATION_RECEIVED, PHONE_CHANGED, OTP_PHONE_CHANGE
# tests 32
# pass 31
# fail 1
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/notif-outbox.test.ts
ok 1 - public.notification_types contient exactement les types du contrat, avec famille, sujet, canaux, audience, politique, journal et permission
# … 31 autre(s) sous-test(s) réussi(s)
# tests 32
# pass 32
# fail 0
# cancelled 0
```

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/notif-modeles.test.ts
not ok 1 - NOTIFICATION_CATALOG contient exactement les types de G2, chacun avec ses attributs
      error: types du catalogue = types de G2
        ... Skipped lines
not ok 3 - chaque type rend chaque canal qu'il déclare (sample), sans variable manquante ni valeur JS affichée
      error: 'type INVITATION_RECEIVED absent de NOTIFICATION_CATALOG'
# … 5 autre(s) sous-test(s) en échec retenu(s)
# tests 22
# pass 15
# fail 7
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/notif-modeles.test.ts
ok 1 - NOTIFICATION_CATALOG contient exactement les types de G2, chacun avec ses attributs
ok 3 - chaque type rend chaque canal qu'il déclare (sample), sans variable manquante ni valeur JS affichée
ok 1 - chaque SMS tient en un SMS GSM-7 (≤ 160) avec les valeurs maximales réalistes de G3 et une URL de 27 caractères
ok 2 - texte fixe en GSM-7 de base : rendu avec des valeurs ASCII, aucun caractère interdit (« » ’ ° ç ê â ô î û ï ë œ, espaces insécables)
ok 3 - variable non translittérable (autres écritures) : SMS UCS-2 de 3 segments au plus
ok 4 - textes exacts G3 pour des valeurs courtes
# … 16 autre(s) sous-test(s) réussi(s)
# tests 22
# pass 22
# fail 0
# cancelled 0
```

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/notif-migration.test.ts
not ok 1 - registre notification_types : tous les types de l’inventaire (K1) et des envois TypeScript
      error: types absents du registre : INVITATION_RECEIVED, OTP_PHONE_CHANGE, PHONE_CHANGED
not ok 2 - RPC recopiées : chacune existe et nomme ses types
      error: 9.0 : fonction public.ticket_invitation_create absente
        9.2 : fonction public.account_phone_finalize absente
# tests 20
# pass 18
# fail 2
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/notif-migration.test.ts
ok 1 - registre notification_types : tous les types de l’inventaire (K1) et des envois TypeScript
ok 2 - RPC recopiées : chacune existe et nomme ses types
# … 18 autre(s) sous-test(s) réussi(s)
# tests 20
# pass 20
# fail 0
# cancelled 0
```

L'aide de la catégorie sans canal disait que l'application n'envoyait pas d'invitations (AM6, `f7cd9419`) : le test modifié est postérieur au run 110, seul son vert se lit.

```text
# run 113 (d255bf3, « après ») — tests/parcours/canaux-interface.test.ts  [sous-tests retenus : /CATEGORY_CHANNEL_HELP/]
ok 2 - CATEGORY_CHANNEL_HELP : trois aides en français, celle de `none` mot pour mot
# tests 16
# pass 16
# fail 0
# cancelled 0
```

**Correctif.** Catalogue (avec `PHONE_CHANGED` et `OTP_PHONE_CHANGE`), serveur, écran :

```text
$ git show --numstat 68a8614f
68a8614f fix(9.0-notif): catalogue des trois types du lot 9, section 5.1 et T6 à T8 : INVITATION_RECEIVED (SMS seul, ANY, ALLOW, texte figé, 158 septets au pire cas), PHONE_CHANGED (SMS à l'ancien num …
  +    6 -    1  lib/notifications/catalog-types.ts
  +   15 -    0  lib/notifications/catalog.ts
  +    3 -    0  lib/notifications/outbox-labels.ts
  +    2 -    2  lib/notifications/sync-log.ts
  +    2 -    1  lib/sms/mtarget.service.ts
$ git show --numstat c5c6d5d2
c5c6d5d2 fix(9.0s): outil d'invitations côté serveur, section 5.1 et tableaux 3.2, 3.3. M2 : billet sans porteur et transfert sans expéditeur admis, INVITATION_RECEIVED au registre, tickets_sale_decis …
  +   27 -    0  app/api/partner/events/[id]/invitations/[ticketId]/cancel/route.ts
  +   68 -    0  app/api/partner/events/[id]/invitations/route.ts
  +    2 -    2  lib/events/category-channels.ts
  +    3 -    2  lib/events/pilotage.service.ts
  +  133 -    0  lib/tickets/invitation.service.ts
  +   48 -    0  lib/validations/invitation.ts
  +  686 -    0  supabase/migrations/20261108000002_lot9_invitations.sql
$ git show --numstat fb78ba7d
fb78ba7d fix(9.0e): onglet Invitations du pilotage (section 8, 5.1, 4.1, AM7) : InvitationsTab nouveau, role=tab par ScrollableTabs, ouvert par ?tab=invitations ; catégories lues sur /pilotage/sales,  …
  +    6 -    3  app/partner/events/[id]/page.tsx
  +  503 -    0  components/partner/pilotage/InvitationsTab.tsx
  (+ 3 trace(s) docs/lot9-logs/ non listée(s))
```

**Acte 9 de la recette.** `e2e/recette.spec.ts:841`, placé avant l'acte 8 qui suspend E1 et P1 (AR8). Le partenaire envoie à l'écran une invitation à un numéro sans compte ; en base, billet `INVITATION` à 0 F, sans porteur, verrouillé, décision `INVITATION`, stock + 1, transfert sans expéditeur ; exactement un SMS, avec `/tickets`, sans code à 6 chiffres ; l'invité s'inscrit à l'écran, réclame, le billet passe à son compte ; le contrôleur scanne, résultat `valid`, billet `UTILISE`. Commit du test : `c32b5bbb`.

Au run 110, l'acte 9 échoue sur l'onglet absent et l'acte 8 ne joue pas (mode `serial`) :

```text
# S/run110/e2e.log, lignes 2249 à 2250
  ✘  8 [recette] › e2e/recette.spec.ts:841:5 › acte 9 [partenaire] [client] [contrôleur] : invitation d’un numéro sans compte, inscription, réclamation, entrée (20.3s)
  -  9 [recette] › e2e/recette.spec.ts:944:5 › acte 8 [admin] : supervision et relance d’une notification, remboursement bloqué relancé (A3), événement et partenaire suspendus
```

```text
# S/run110/e2e.log, lignes 2254 à 2267
  1) [recette] › e2e/recette.spec.ts:841:5 › acte 9 [partenaire] [client] [contrôleur] : invitation d’un numéro sans compte, inscription, réclamation, entrée › P1 invite un numéro neuf sur la catégorie Invitations

    Error: onglet Invitations du pilotage ouvert par ?tab=invitations

    expect(locator).toHaveAttribute(expected) failed

    Locator: getByRole('tab', { name: /^invitations/i })
    Expected: "true"
    Timeout: 15000ms
    Error: element(s) not found

    Call log:
      - onglet Invitations du pilotage ouvert par ?tab=invitations getByRole('tab', { name: /^invitations/i }) with timeout 15000ms
      - waiting for getByRole('tab', { name: /^invitations/i })
```

Au run 113, les neuf actes passent, l'acte 9 en huitième position :

```text
$ grep -E 'recette\.spec\.ts:[0-9]+:5 › acte' S/run113/e2e.log
  ✓  1 [recette] › e2e/recette.spec.ts:285:5 › acte 1 [admin] : délai de garde coupé à l’écran, motif exigé, historique ; un ADMIN est refusé (3.0s)
  ✓  2 [recette] › e2e/recette.spec.ts:323:5 › acte 2 [partenaire] [admin] : inscription avec pièces, validation, E1 et ses canaux, soumission, publication, E2 (9.2s)
  ✓  3 [recette] › e2e/recette.spec.ts:453:5 › acte 3 [partenaire] : invitation de K1, permission espèces, point d’entrée, PIN régisseur (1.9s)
  ✓  4 [recette] › e2e/recette.spec.ts:487:5 › acte 4 [client] : découverte, fiche, refus direct, inscription depuis l’achat, achats, Mes billets, transfert (20.8s)
  ✓  5 [recette] › e2e/recette.spec.ts:616:5 › acte 5 [contrôleur] : activation, caisse, scan en ligne et hors ligne, ancien code, saisie manuelle, guichet, reprise, clôture (17.6s)
  ✓  6 [recette] › e2e/recette.spec.ts:728:5 › acte 6 [partenaire] : pilotage, rapport de clôture, export, retrait, remboursement d’un billet à l’écran (5.9s)
  ✓  7 [recette] › e2e/recette.spec.ts:797:5 › acte 7 [client] [partenaire] : annulation de E2, envoyeur par la vraie route, billet remboursé, avis, bandeau public (2.5s)
  ✓  8 [recette] › e2e/recette.spec.ts:841:5 › acte 9 [partenaire] [client] [contrôleur] : invitation d’un numéro sans compte, inscription, réclamation, entrée (6.4s)
  ✓  9 [recette] › e2e/recette.spec.ts:944:5 › acte 8 [admin] : supervision et relance d’une notification, remboursement bloqué relancé (A3), événement et partenaire suspendus (8.8s)
```

Sortie de l'acte 9, tous les invariants, dont (t)(u)(v) sur une vraie invitation réclamée :

```text
# S/run113/e2e.log, lignes 816 à 830
[e2e][recette] après l’envoi de l’invitation : 1 ligne(s) envoyée(s) par la vraie route
[e2e][recette] avant les invariants recette-invitation : 4 ligne(s) envoyée(s) par la vraie route
[INVARIANT] recette-invitation — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] recette-invitation — purge des réservations échues : {"expired":0}
[INVARIANT] recette-invitation — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] recette-invitation — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] recette-invitation — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] recette-invitation — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] recette-invitation — (j)(k)(l) : 0 violation(s)
[INVARIANT-NOTIF] recette-invitation — envoyeur : 0 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] recette-invitation — (m)(n)(o) : 0 violation(s)
[INVARIANT-TERRAIN] recette-invitation — (p)(q) : 0 violation(s)
[INVARIANT-RECETTE] recette-invitation — (r)(s)(t) : 0 violation(s)
[INVARIANT-LOT9] recette-invitation — (t)(u)(v) : 0 violation(s)
  ✓  8 [recette] › e2e/recette.spec.ts:841:5 › acte 9 [partenaire] [client] [contrôleur] : invitation d’un numéro sans compte, inscription, réclamation, entrée (6.4s)
```

Les cinq passages `[INVARIANT-LOT9]` de la recette, et celui du seed de démonstration :

```text
$ grep -E '^\[INVARIANT-LOT9\]' S/run113/e2e.log
[INVARIANT-LOT9] recette-client — (t)(u)(v) : 0 violation(s)
[INVARIANT-LOT9] recette-controleur — (t)(u)(v) : 0 violation(s)
[INVARIANT-LOT9] recette-partenaire — (t)(u)(v) : 0 violation(s)
[INVARIANT-LOT9] recette-invitation — (t)(u)(v) : 0 violation(s)
[INVARIANT-LOT9] recette-admin — (t)(u)(v) : 0 violation(s)
```

```text
$ grep -E '^\[INVARIANT-LOT9\]' S/run113/e2e-seed.log
[INVARIANT-LOT9] seed-demo — (t)(u)(v) : 0 violation(s)
```

Limite : les règles (v) (photo, changement de numéro) sont à vide en e2e, aucun parcours n'y change de photo ou de numéro. Leur preuve vient de `lot9-invariant` et des suites `compte-*`. L'acte 9 n'assure pas le rendu de la carte billet (L55).

### 9.1 — Découverte

**Origine.** `discovery-9-decouverte.md`, section 1 (A7, A28). La route sait filtrer `q`, `category`, `city`, mais le catalogue filtre dans le navigateur (C2), et le texte du navigateur cherche aussi la ville, pas le `q` du serveur : y passer tel quel était une régression (C4). L'accueil filtrait aussi côté navigateur (A28 ne citait que le catalogue). `readCatalog` ne prenait aucun paramètre (C3). `users.city` absente (C9).

```text
$ git show 534d6b3:app/explore/page.tsx  [lignes 37-42]
37: function matches(evt: CatalogEvent, query: string): boolean {
38:   if (!query) return true;
39:   const q = query.toLocaleLowerCase('fr-FR');
40:   return [evt.title, evt.venue, evt.subtitle ?? '', evt.city ?? '']
41:     .some((field) => field.toLocaleLowerCase('fr-FR').includes(q));
42: }
```

```text
$ git show 534d6b3:app/page.tsx  [lignes 121-124]
121:   const shown = useMemo(
122:     () => events.filter((evt) => category === ALL || evt.category === category).slice(0, HOME_LIMIT),
123:     [events, category],
124:   );
```

```text
$ git show 534d6b3:lib/events/catalog-client.ts  [lignes 59-62]
59: export async function readCatalog(tag: string): Promise<CatalogResult> {
60:     let res: Response;
61:     try {
62:         res = await fetch('/api/events', { cache: 'no-store' });
```

**A7 — Populaires et Près de chez vous.** Classement exact sur données fabriquées, exclusions (non publics, invitations, plus de 7 jours), cache 60 s, ville du profil et de l'appareil.

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/decouverte-populaires.test.ts
not ok 1 - ordre et comptes exacts sur la sous-liste de la suite
      error: events_popular : Could not find the function public.events_popular(p_limit) in the schema cache (code PGRST202)
not ok 2 - à ventes égales, le début le plus proche passe devant
      error: events_popular : Could not find the function public.events_popular(p_limit) in the schema cache (code PGRST202)
not ok 3 - à ventes et début égaux, l’id départage
      error: events_popular : Could not find the function public.events_popular(p_limit) in the schema cache (code PGRST202)
# … 16 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 6 - /home/runner/work/event-village/event-village/tests/parcours/decouverte-populaires.test.ts
  schéma du lot 9 incomplet (decouverte-populaires) : invariants (t)(u)(v) impossibles à vérifier :
  fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
  fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
# tests 20
# pass 1
# fail 19
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/decouverte-populaires.test.ts
ok 1 - ordre et comptes exacts sur la sous-liste de la suite
ok 2 - à ventes égales, le début le plus proche passe devant
ok 3 - à ventes et début égaux, l’id départage
ok 4 - un événement sans vente n’apparaît pas
ok 1 - fenêtre de 168 h : 6 j 23 h compté, 7 j 1 h non
ok 2 - UTILISE compté ; ANNULE et REMBOURSE non
# … 14 autre(s) sous-test(s) réussi(s)
[INVARIANT-LOT9] decouverte-populaires — (t)(u)(v) : 0 violation(s)
# tests 20
# pass 20
# fail 0
# cancelled 0
```

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/decouverte-cache.test.ts
not ok 1 - à 59 s et à 59,999 s : aucune relecture, même liste
      error: "Cannot find module '/home/runner/work/event-village/event-village/lib/events/popular.service' imported from /home/runner/work/event-village/event-village/tests/parcours/decouverte-cache.test.ts"
not ok 2 - à 60 s exactement : relecture, la nouvelle liste est rendue
      error: "Cannot find module '/home/runner/work/event-village/event-village/lib/events/popular.service' imported from /home/runner/work/event-village/event-village/tests/parcours/decouverte-cache.test.ts"
# … 5 autre(s) sous-test(s) en échec retenu(s)
# tests 7
# pass 0
# fail 7
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/decouverte-cache.test.ts
ok 1 - à 59 s et à 59,999 s : aucune relecture, même liste
ok 2 - à 60 s exactement : relecture, la nouvelle liste est rendue
ok 3 - la relecture repart pour 60 s
ok 4 - une lecture en échec n’est jamais gardée : l’appel suivant relit, à la même heure
ok 5 - panne à l’expiration : erreur rendue, jamais l’ancienne liste, et l’appel suivant relit
ok 6 - deux appels simultanés : une seule lecture, même liste pour les deux
# … 1 autre(s) sous-test(s) réussi(s)
# tests 7
# pass 7
# fail 0
# cancelled 0
```

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/decouverte-ville.test.ts
not ok 1 - stockée en capitales, sans espaces, rendue et relue par /api/auth/me
      error: "Cannot find module '/home/runner/work/event-village/event-village/app/api/profile/city/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts"
not ok 2 - accents conservés, 2 et 80 caractères admis
      error: "Cannot find module '/home/runner/work/event-village/event-village/app/api/profile/city/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts"
# … 11 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 6 - /home/runner/work/event-village/event-village/tests/parcours/decouverte-ville.test.ts
  schéma du lot 9 incomplet (decouverte-ville) : invariants (t)(u)(v) impossibles à vérifier :
  fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
  fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
# tests 15
# pass 2
# fail 13
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/decouverte-ville.test.ts
ok 1 - stockée en capitales, sans espaces, rendue et relue par /api/auth/me
ok 2 - accents conservés, 2 et 80 caractères admis
ok 3 - `null` efface la ville
ok 1 - type, 1 caractère, 81 caractères, absente : 400 INVALID_FIELD, ville inchangée
ok 2 - corps illisible : 400 INVALID_BODY
ok 3 - sans session : 401 AUTH_REQUIRED
# … 9 autre(s) sous-test(s) réussi(s)
[INVARIANT-LOT9] decouverte-ville — (t)(u)(v) : 0 violation(s)
# tests 15
# pass 15
# fail 0
# cancelled 0
```

**A28 — Recherche par le serveur.**

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/decouverte-recherche-lot9.test.ts
not ok 1 - par ville, sans tenir compte de la casse
      error: Expected values to be strictly deep-equal:
not ok 2 - `q` est limité à 120 caractères : ce qui dépasse n’empêche pas la recherche
      error: Expected values to be strictly deep-equal:
not ok 1 - en minuscules et avec des espaces autour
      error: Expected values to be strictly deep-equal:
# … 3 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 5 - /home/runner/work/event-village/event-village/tests/parcours/decouverte-recherche-lot9.test.ts
  schéma du lot 9 incomplet (decouverte-recherche-lot9) : invariants (t)(u)(v) impossibles à vérifier :
  fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
  fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
# tests 7
# pass 1
# fail 6
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/decouverte-recherche-lot9.test.ts
ok 1 - par ville, sans tenir compte de la casse
ok 2 - `q` est limité à 120 caractères : ce qui dépasse n’empêche pas la recherche
ok 1 - en minuscules et avec des espaces autour
ok 2 - `all` en minuscules : pas de filtre
ok 1 - sans filtre : les villes publiques en capitales, sans doublon, triées, sans le brouillon
ok 2 - `cities` reste complet malgré un filtre de ville, de texte, ou une recherche vide
# … 1 autre(s) sous-test(s) réussi(s)
[INVARIANT-LOT9] decouverte-recherche-lot9 — (t)(u)(v) : 0 violation(s)
# tests 7
# pass 7
# fail 0
# cancelled 0
```

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/decouverte-ecrans.test.ts
not ok 2 - q, city et category sont passés au serveur, encodés
      error: Expected values to be strictly deep-equal:
not ok 3 - la valeur de l’écran « tous » n’est jamais envoyée
      error: Expected values to be strictly deep-equal:
# … 20 autre(s) sous-test(s) en échec retenu(s)
# tests 23
# pass 1
# fail 22
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/decouverte-ecrans.test.ts
ok 2 - q, city et category sont passés au serveur, encodés
ok 3 - la valeur de l’écran « tous » n’est jamais envoyée
ok 4 - un filtre vide n’est pas envoyé
ok 5 - tous les filtres à « tous » ou vides : URL exacte /api/events
ok 6 - les villes de la réponse sont rendues avec les événements
ok 7 - une panne du serveur avec filtre : erreur rendue, requête bien filtrée
# … 17 autre(s) sous-test(s) réussi(s)
# tests 23
# pass 23
# fail 0
# cancelled 0
```

**Correctif.** Serveur, écran, puis deux commits de budget : `/` dépassait de 389 octets au run 111 (217 389 pour 217 000), puis de 12 au run 112. Les sections de découverte et `AccessNotice` sont chargées à part (`next/dynamic`, repli prévu à L53). Le budget n'a pas été relevé.

```text
$ git show --numstat faaa81d6
faaa81d6 fix(9.1s): découverte côté serveur (section 5.2, AR12, L18 à L22). M3 ajoute users.city, idx_tickets_created_at et la RPC events_popular réservée au service_role ; GET /api/events cherche aus …
  +   25 -    0  app/api/events/popular/route.ts
  +   28 -   70  app/api/events/route.ts
  +   65 -    0  app/api/profile/city/route.ts
  +   37 -    6  lib/events/catalog-client.ts
  +  101 -    0  lib/events/catalog.server.ts
  +   26 -    0  lib/events/city-preference.ts
  +   52 -    0  lib/events/popular.service.ts
  +   48 -    0  supabase/migrations/20261108000003_lot9_decouverte.sql
$ git show --numstat b5e8f324
b5e8f324 fix(9.1e): accueil et catalogue passent à la découverte par le serveur (section 5.2, A28, L18, L22, L23, AR12) : app/explore/page.tsx envoie q, ville et catégorie à readCatalog (plus de filtr …
  +   62 -   38  app/explore/page.tsx
  +   29 -   11  app/page.tsx
  +  290 -    0  components/events/HomeDiscovery.tsx
  +    1 -    0  components/providers/AuthProvider.tsx
  (+ 3 trace(s) docs/lot9-logs/ non listée(s))
$ git show --numstat d992ef28
d992ef28 fix(9.1e): sections de découverte de l'accueil chargées à part (budget JS de / : 217 389 octets pour 217 000 au run 111, cause : Avatar et HomeDiscovery). Repli prévu au contrat, à signaler : …
  +    5 -    1  app/page.tsx
  (+ 1 trace(s) docs/lot9-logs/ non listée(s))
$ git show --numstat a525015e
a525015e fix(9.1e): AccessNotice chargé à part, côté navigateur (budget JS de / : 217 012 octets pour 217 000 au run 112, 216 798 après, mesure locale). Seul un accès refusé en a besoin, il lit l'URL, …
  +    4 -    5  app/page.tsx
```

### 9.2 — Compte client

**Origine.** `discovery-9-compte.md`, section 0 (A6, A17). Aucune route de profil client (C1). La connexion par numéro exige que `public.users.email` et `auth.users.email` restent égaux (C2). Un compte sans email réel porte un email technique dérivé du numéro (C3). La révocation existante supprime toutes les sessions, sans exception (C4). Un paiement `PARTIAL` tombait sur « Statut inconnu » (C7).

```text
$ git show 534d6b3:supabase/migrations/20261031000008_lot1c3_revocation_sessions.sql  [lignes 28-33]
28:     UPDATE auth.refresh_tokens
29:        SET revoked = true, updated_at = now()
30:      WHERE user_id = p_user_id::text
31:        AND revoked IS DISTINCT FROM true;
32: 
33:     DELETE FROM auth.sessions WHERE user_id = p_user_id;
```

```text
$ git show 534d6b3:app/api/auth/resolve-phone/route.ts  [lignes 66-68]
66:         return NextResponse.json({
67:             success: true,
68:             email: userRow.email || `${normalizedPhone.replace('+', '')}@eventvillage.sn`,
```

**A6 — profil et changement de numéro.**

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/compte-profil.test.ts
not ok 1 - prénom, nom, email : 200, public.users et auth.users à jour, réponse sans cache, audit sans valeur
      error: "Cannot find module '/home/runner/work/event-village/event-village/app/api/account/profile/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts"
not ok 2 - email saisi en majuscules : enregistré en minuscules dans les deux tables
      error: "Cannot find module '/home/runner/work/event-village/event-village/app/api/account/profile/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts"
not ok 3 - email inchangé : aucun appel à l’API d’authentification, prénom enregistré
      error: "Cannot find module '/home/runner/work/event-village/event-village/app/api/account/profile/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts"
# … 22 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 9 - /home/runner/work/event-village/event-village/tests/parcours/compte-profil.test.ts
  schéma du lot 9 incomplet (compte-profil) : invariants (t)(u)(v) impossibles à vérifier :
  fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
  fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
# tests 27
# pass 2
# fail 25
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/compte-profil.test.ts
ok 1 - prénom, nom, email : 200, public.users et auth.users à jour, réponse sans cache, audit sans valeur
ok 2 - email saisi en majuscules : enregistré en minuscules dans les deux tables
ok 3 - email inchangé : aucun appel à l’API d’authentification, prénom enregistré
ok 4 - appel à l’API d’authentification : updateUserById avec email et email_confirm, une seule fois
ok 5 - la connexion suit : nouvel email accepté, ancien refusé, connexion par numéro intacte
ok 1 - email vide : email technique du numéro rétabli dans les deux tables, connexion possible, email_technical vrai
# … 21 autre(s) sous-test(s) réussi(s)
[INVARIANT-LOT9] compte-profil — (t)(u)(v) : 0 violation(s)
# tests 27
# pass 27
# fail 0
# cancelled 0
```

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/compte-numero.test.ts
not ok 1 - un code de 6 chiffres au nouveau numéro, objet PHONE_CHANGE, aucun SMS à l’ancien, journal sans le code, compte inchangé
      error: "Cannot find module '/home/runner/work/event-village/event-village/app/api/account/phone/start/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts"
not ok 2 - numéro déjà pris sous la forme +221… puis 221… : 409 PHONE_TAKEN sans aucun SMS
      error: "Cannot find module '/home/runner/work/event-village/event-village/app/api/account/phone/start/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts"
not ok 3 - même numéro : 400 PHONE_UNCHANGED sans SMS
      error: "Cannot find module '/home/runner/work/event-village/event-village/app/api/account/phone/start/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts"
# … 39 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 12 - /home/runner/work/event-village/event-village/tests/parcours/compte-numero.test.ts
  schéma du lot 9 incomplet (compte-numero) : invariants (t)(u)(v) impossibles à vérifier :
  fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
  fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
# tests 47
# pass 5
# fail 42
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/compte-numero.test.ts
ok 1 - un code de 6 chiffres au nouveau numéro, objet PHONE_CHANGE, aucun SMS à l’ancien, journal sans le code, compte inchangé
ok 2 - numéro déjà pris sous la forme +221… puis 221… : 409 PHONE_TAKEN sans aucun SMS
ok 3 - même numéro : 400 PHONE_UNCHANGED sans SMS
ok 4 - mauvais format, numéro absent : 400 INVALID_FIELD ; corps illisible : 400 INVALID_BODY
ok 5 - quota du compte, numéros différents : au-delà de 2, 429 PHONE_CHANGE_RATE_LIMITED et aucun SMS
ok 6 - sans session : 401 AUTH_REQUIRED ; compte suspendu : 403 ACCOUNT_NOT_ACTIVE ; aucun SMS
# … 41 autre(s) sous-test(s) réussi(s)
[INVARIANT-LOT9] compte-numero — (t)(u)(v) : 0 violation(s)
# tests 47
# pass 47
# fail 0
# cancelled 0
```

**AM1 — le SUPPOSÉ du contrat, infirmé au run 110.** Le contrat supposait que `auth.admin.updateUserById` rend `phone_exists` ou `email_exists` vers une valeur prise. Le run 110, sur le vrai GoTrue (la sonde tourne sans attendre aucun correctif), dit autre chose : `code=undefined, status=500, message=Error updating user`.

```text
# S/run110/test-logs/tests__parcours__compte-numero.test.ts.log, lignes 963 à 980
    # Subtest: SUPPOSÉ : updateUserById vers un numéro pris renvoie error.code = phone_exists
    not ok 2 - SUPPOSÉ : updateUserById vers un numéro pris renvoie error.code = phone_exists
      ---
      duration_ms: 296.21307
      type: 'test'
      location: '/home/runner/work/event-village/event-village/tests/parcours/compte-numero.test.ts:3:54466'
      failureType: 'testCodeFailure'
      error: |-
        SUPPOSÉ INFIRMÉ (contrat, section 13) : GoTrue ne renvoie pas phone_exists mais code=undefined, status=500, message=Error updating user ; la table de codes de fix(9.2s) doit reprendre ce code
        + actual - expected

        + undefined
        - 'phone_exists'

      code: 'ERR_ASSERTION'
      name: 'AssertionError'
      expected: 'phone_exists'
      operator: 'strictEqual'
```

```text
# S/run110/test-logs/tests__parcours__compte-profil.test.ts.log, lignes 543 à 560
    # Subtest: SUPPOSÉ : updateUserById vers un email pris renvoie error.code = email_exists
    not ok 1 - SUPPOSÉ : updateUserById vers un email pris renvoie error.code = email_exists
      ---
      duration_ms: 301.431028
      type: 'test'
      location: '/home/runner/work/event-village/event-village/tests/parcours/compte-profil.test.ts:2:28849'
      failureType: 'testCodeFailure'
      error: |-
        SUPPOSÉ INFIRMÉ (contrat, section 13) : GoTrue ne renvoie pas email_exists mais code=undefined, status=500, message=Error updating user ; la table de codes de fix(9.2s) doit reprendre ce code
        + actual - expected

        + undefined
        - 'email_exists'

      code: 'ERR_ASSERTION'
      name: 'AssertionError'
      expected: 'email_exists'
      operator: 'strictEqual'
```

Sans le constat, un doublon serait parti en 500 au lieu d'un refus propre. Remède : RPC `account_identity_taken` (STABLE, service_role), appelée avant l'API (pris : 409 sans appel) et après toute erreur de l'API (pris par course : même 409, sans compensation ; sinon le 500 du contrat). Les deux sondes deviennent un constat durable (`cb0d3e25`), sans figer le code d'erreur. `phone_exists` et `email_exists` restent acceptés s'ils arrivent, jamais supposés.

```text
$ grep -E 'identityTaken|account_identity_taken|phone_exists|email_exists' lib/auth/account-sync.ts
/** RPC account_identity_taken, sur tout autre compte que `userId`. Lève une erreur si la lecture échoue. */
export async function identityTaken(userId: string, email: string | null, phone: string | null): Promise<IdentityTaken> {
    const { data, error } = await getServiceRoleClient().rpc('account_identity_taken', { p_user_id: userId, p_email: email, p_phone: phone });
    if (error) throw new Error(`account_identity_taken : ${error.message}`);
        throw new Error(`account_identity_taken : réponse inattendue ${JSON.stringify(data)}`);
    if (error.code === 'phone_exists' || error.code === 'email_exists') return true;
        const taken = await identityTaken(userId, email, phone);
```

```text
$ grep -E 'identityTaken|isTaken' app/api/account/phone/confirm/route.ts
    identityTaken,
        const taken = await identityTaken(user.id, newEmail, phone);
```

```text
$ grep -E 'identityTaken|isTaken' app/api/account/profile/route.ts
    identityTaken,
            if ((await identityTaken(user.id, email, null)).emailTaken) return refuse(EMAIL_TAKEN);
```

```text
$ grep -E 'FUNCTION public\.account_identity_taken' supabase/migrations/20261108000004_lot9_compte.sql
CREATE OR REPLACE FUNCTION public.account_identity_taken(p_user_id uuid, p_email text, p_phone text)
REVOKE ALL ON FUNCTION public.account_identity_taken(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_identity_taken(uuid, text, text) TO service_role;
```

Au run 113, constats verts, RPC réservée au rôle de service :

```text
$ grep -E '^\s+ok .*constat AM1' S/run113/test-logs/tests__parcours__compte-numero.test.ts.log
    ok 2 - constat AM1 : updateUserById vers un numéro pris échoue et laisse auth.users inchangé, sans figer le code d’erreur
```

```text
$ grep -E '^\s+ok .*constat AM1' S/run113/test-logs/tests__parcours__compte-profil.test.ts.log
    ok 1 - constat AM1 : updateUserById vers un email pris échoue et laisse auth.users inchangé, sans figer le code d’erreur
```

```text
$ grep -E '^\s+ok .*account_identity_taken' S/run113/test-logs/tests__security__r3-fonctions-rpc.test.ts.log
    ok 251 - anon : rpc(account_identity_taken) refusée
    ok 252 - authenticated (compte CLIENT) : rpc(account_identity_taken) refusée
    ok 6 - anon et authenticated (compte CLIENT) : rpc(account_identity_taken) existe et est refusée
```

L'autre hypothèse, `session_id` dans le JWT, a tenu dès le run 110 (AM2) :

```text
# S/run110/test-logs/tests__parcours__compte-numero.test.ts.log, lignes 957 à 958
    # Subtest: SUPPOSÉ : le JWT porte session_id, uuid d’une ligne de auth.sessions du compte
    ok 1 - SUPPOSÉ : le JWT porte session_id, uuid d’une ligne de auth.sessions du compte
```

**A17 — Mes paiements.** A ne voit jamais B, pagination serveur, totaux, aucun identifiant technique.

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/compte-paiements.test.ts
not ok 1 - A ne voit jamais les paiements de B
      error: "Cannot find module '/home/runner/work/event-village/event-village/app/api/account/payments/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts"
not ok 2 - user_id, client_id et id en paramètre sont ignorés
      error: "Cannot find module '/home/runner/work/event-village/event-village/app/api/account/payments/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts"
not ok 3 - sans session : 401 AUTH_REQUIRED
      error: "Cannot find module '/home/runner/work/event-village/event-village/app/api/account/payments/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts"
# … 21 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 8 - /home/runner/work/event-village/event-village/tests/parcours/compte-paiements.test.ts
  schéma du lot 9 incomplet (compte-paiements) : invariants (t)(u)(v) impossibles à vérifier :
  fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
  fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
# tests 26
# pass 2
# fail 24
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/compte-paiements.test.ts
ok 1 - A ne voit jamais les paiements de B
ok 2 - user_id, client_id et id en paramètre sont ignorés
ok 3 - sans session : 401 AUTH_REQUIRED
ok 4 - compte suspendu : 403 ACCOUNT_NOT_ACTIVE
ok 1 - 25 paiements : page 1 = 20, page 2 = 5, page 3 vide, sans doublon ni trou, ordre exact
ok 2 - page absente : page 1 ; même date : départage par id décroissant
# … 20 autre(s) sous-test(s) réussi(s)
[INVARIANT-LOT9] compte-paiements — (t)(u)(v) : 0 violation(s)
# tests 26
# pass 26
# fail 0
# cancelled 0
```

Colonnes de profil en REST retirées à `authenticated` (L32), renforcement de `r7`, signalé (T5) :

```text
# run 110 (e6c23d1, « avant ») — tests/security/r7-profil-colonnes.test.ts
not ok 4 - CLIENT qui change son prénom, son nom et sa photo par REST → refusé, la route est seule à écrire
      error: "modification du prénom, du nom et de la photo par REST : l'opération a été ACCEPTÉE alors qu'elle doit être refusée"
# tests 4
# pass 3
# fail 1
# cancelled 0
# run 113 (d255bf3, « après ») — tests/security/r7-profil-colonnes.test.ts
ok 4 - CLIENT qui change son prénom, son nom et sa photo par REST → refusé, la route est seule à écrire
# … 3 autre(s) sous-test(s) réussi(s)
# tests 4
# pass 4
# fail 0
# cancelled 0
```

Invariants (v) :

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/lot9-invariant.test.ts  [sous-tests retenus : /Invariant \(v\)/]
not ok 1 - v1 : photo sans objet, puis dans le dossier d'un autre compte ; témoins : photo du compte, URL extérieure
      error: schéma du lot 9 incomplet (lot9-invariant v1) : invariants (t)(u)(v) impossibles à vérifier :
        fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
not ok 2 - v2 : nom hors format, puis dossier sans compte ; témoin : nom conforme
      error: schéma du lot 9 incomplet (lot9-invariant v2) : invariants (t)(u)(v) impossibles à vérifier :
        fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
# … 4 autre(s) sous-test(s) en échec retenu(s)
# tests 23
# pass 0
# fail 23
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/lot9-invariant.test.ts  [sous-tests retenus : /Invariant \(v\)/]
ok 1 - v1 : photo sans objet, puis dans le dossier d'un autre compte ; témoins : photo du compte, URL extérieure
ok 2 - v2 : nom hors format, puis dossier sans compte ; témoin : nom conforme
ok 3 - v3 : deux photos pour un compte ; témoin : une seule photo
ok 4 - v4 : numéro du profil différent de l'authentification après un changement ; témoin : numéros identiques, formes réelles
ok 5 - v5 : changement sans SMS ; clé absente comptée comme un SMS attendu ; témoins : SMS en file, sms_queued faux
ok 6 - v6 : email du profil différent de l'authentification, après un profil ou un numéro ; témoins : même email en casse différente, compte sans changement
[INVARIANT-LOT9] lot9-invariant — (t)(u)(v) : 0 violation(s)
# tests 23
# pass 23
# fail 0
# cancelled 0
```

**Correctif.** Serveur, puis écran :

```text
$ git show --numstat 7f8a8a11
7f8a8a11 fix(9.2s): compte client côté serveur (section 5.3, AR2, AM1, AM2, L24 à L33). M4 étend l'objet OTP à PHONE_CHANGE, inscrit PHONE_CHANGED et OTP_PHONE_CHANGE, retire l'UPDATE REST de first_na …
  +   77 -    0  app/api/account/payments/route.ts
  +  126 -    0  app/api/account/phone/confirm/route.ts
  +   91 -    0  app/api/account/phone/start/route.ts
  +   85 -    0  app/api/account/profile/route.ts
  +  100 -    0  lib/auth/account-sync.ts
  +    1 -    1  lib/auth/otp-store.ts
  +   36 -    0  lib/payments/payment-labels.ts
  +   64 -    5  lib/supabase/server.ts
  +   42 -    0  lib/validations/account.ts
  +  320 -    0  supabase/migrations/20261108000004_lot9_compte.sql
$ git show --numstat 339a185c
339a185c fix(9.2e): écrans du compte client (section 5.3, 4.3, AR13, AM7) : ProfileForm (prénom, nom, email par PATCH /api/account/profile, mêmes règles que le schéma serveur, erreur sous le champ, EM …
  +    9 -    0  app/paiement/[id]/page.tsx
  +   13 -    1  app/profile/page.tsx
  +   23 -    0  app/profile/payments/loading.tsx
  +  148 -    0  app/profile/payments/page.tsx
  +  221 -    0  components/profile/PhoneChangeDialog.tsx
  +  175 -    0  components/profile/ProfileForm.tsx
  (+ 4 trace(s) docs/lot9-logs/ non listée(s))
```

Non prouvé : l'écriture réelle sur `auth.sessions` et `auth.refresh_tokens` n'a tourné que sur la base locale de la CI, pas sur un projet hébergé (essai 8.15 de `docs/essai-local.md`).

### 9.2 — Photo de profil

**Origine.** `discovery-9-compte.md`, C5, C6, C10. `authenticated` pouvait écrire `avatar_url` en REST avec n'importe quelle valeur : si la route supprimait « l'ancienne photo » sur cette URL, un compte A faisait supprimer l'objet de B, et le service_role contourne les politiques.

```text
$ git show 534d6b3:supabase/migrations/20261031000003_lot1b2_users_colonnes_protegees.sql  [lignes 18]
18: GRANT UPDATE (first_name, last_name, avatar_url) ON TABLE public.users TO authenticated;
```

**Écart à la lettre de la consigne (AR3, L34).** La consigne dit « seul le propriétaire peut écrire ». Le bucket n'a aucune politique : la route est le seul écrivain, sinon sharp et le retrait EXIF se contournent.

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/compte-photo.test.ts
not ok 1 - JPEG : 200, WebP carré de 256 px, URL enregistrée, réponse sans cache
      error: "Cannot find module '/home/runner/work/event-village/event-village/app/api/account/avatar/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts"
not ok 2 - PNG : 200, WebP carré de 256 px, URL enregistrée, réponse sans cache
      error: "Cannot find module '/home/runner/work/event-village/event-village/app/api/account/avatar/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts"
not ok 3 - WebP : 200, WebP carré de 256 px, URL enregistrée, réponse sans cache
      error: "Cannot find module '/home/runner/work/event-village/event-village/app/api/account/avatar/route' imported from /home/runner/work/event-village/event-village/tests/parcours/paiement-helpers.ts"
# … 35 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 9 - /home/runner/work/event-village/event-village/tests/parcours/compte-photo.test.ts
  schéma du lot 9 incomplet (compte-photo) : invariants (t)(u)(v) impossibles à vérifier :
  fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
  fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
# tests 40
# pass 2
# fail 38
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/compte-photo.test.ts
ok 1 - JPEG : 200, WebP carré de 256 px, URL enregistrée, réponse sans cache
ok 2 - PNG : 200, WebP carré de 256 px, URL enregistrée, réponse sans cache
ok 3 - WebP : 200, WebP carré de 256 px, URL enregistrée, réponse sans cache
ok 4 - image non carrée : recadrée en 256 × 256
ok 5 - le type vient du contenu : un PNG nommé .txt et déclaré text/plain est accepté
ok 6 - exactement 2 Mo : accepté
# … 34 autre(s) sous-test(s) réussi(s)
[INVARIANT-LOT9] compte-photo — (t)(u)(v) : 0 violation(s)
# tests 40
# pass 40
# fail 0
# cancelled 0
```

```text
# run 110 (e6c23d1, « avant ») — tests/security/r27-avatars.test.ts
not ok 1 - public, 2 Mo, image/webp seul, aucune politique sur storage.objects (AR3)
      error: bucket avatars absent (migration M4, contrat 5.3)
        0 !== 1
not ok 1 - écriture refusée, chez un compte existant comme dans un dossier inventé
      error: bucket avatars absent (migration M4, contrat 5.3) : un refus ne prouverait rien
        0 !== 1
not ok 2 - remplacement et suppression refusés, objet de la victime intact
      error: bucket avatars absent (migration M4, contrat 5.3) : un refus ne prouverait rien
        0 !== 1
# … 12 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 6 - /home/runner/work/event-village/event-village/tests/security/r27-avatars.test.ts
  schéma du lot 9 incomplet (r27-avatars) : invariants (t)(u)(v) impossibles à vérifier :
  fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
  fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
# tests 16
# pass 1
# fail 15
# cancelled 0
# run 113 (d255bf3, « après ») — tests/security/r27-avatars.test.ts
ok 1 - public, 2 Mo, image/webp seul, aucune politique sur storage.objects (AR3)
ok 1 - écriture refusée, chez un compte existant comme dans un dossier inventé
ok 2 - remplacement et suppression refusés, objet de la victime intact
ok 3 - lecture publique ouverte, en image/webp ; liste des dossiers vide
ok 4 - POST et DELETE de la route sans session : 401, rien d’écrit
ok 5 - jeton invalide : 401 sur la route
# … 10 autre(s) sous-test(s) réussi(s)
[INVARIANT-LOT9] r27-avatars — (t)(u)(v) : 0 violation(s)
# tests 16
# pass 16
# fail 0
# cancelled 0
```

**Correctif.**

```text
$ git show --numstat fff118f0
fff118f0 fix(9.2-photo): photo de profil côté serveur (section 5.3, AR3, L34, L35). M4 ajoute le bucket avatars (public, 2 Mo, image/webp, aucune politique : la route est le seul écrivain, sharp et le …
  +  150 -    0  app/api/account/avatar/route.ts
  +    1 -   12  app/api/partner/upload/route.ts
  +   11 -    0  lib/images/sniff.ts
  +   43 -    1  supabase/migrations/20261108000004_lot9_compte.sql
$ git show --numstat 8d55067f
8d55067f fix(9.2e-avatar): photo de profil à l'écran (section 5.3, AR3, L36). Avatar commun en <img> avec width, height et alt vide quand le nom est à côté, garde isAvatarUrl (seul le bucket avatars d …
  +    2 -    3  app/profile/page.tsx
  +    8 -    8  components/layout/AppLayout.tsx
  +  125 -    0  components/profile/AvatarEditor.tsx
  +   64 -    0  components/ui/Avatar.tsx
  (+ 1 trace(s) docs/lot9-logs/ non listée(s))
```

Non prouvé : aucune capture ne montre une vraie photo, seul l'état à initiales est capturé.

### 9.3 — Sécurité et fiabilité

Tests rouges : commit `c741bad9`. Origine : `discovery-9-securite.md`, section indiquée à chaque entrée.

#### A24 — `/api/admin/audit` réservé au SUPERADMIN

**Origine.** Section 1. La route appelait `verifyAdminAuth` sans option : tout ADMIN lisait le journal.

```text
$ git show 534d6b3:app/api/admin/audit/route.ts  [lignes 15]
15:     const auth = await verifyAdminAuth(req);
```

**Défaut trouvé en écrivant ce rapport, corrigé ensuite : la RLS ne réservait pas le journal au SUPERADMIN.** La consigne, la découverte et la ligne A24 de la matrice (`docs/recette-billetterie.md:257`) disent « comme la RLS ». La politique porte ce nom, mais sa condition est `is_admin()`, et `is_admin()` vaut pour ADMIN comme pour SUPERADMIN :

```text
$ git show 534d6b3:supabase/migrations/0003_rls.sql  [lignes 355-356]
355: CREATE POLICY "audit_logs_superadmin_read" ON audit_logs
356:     FOR SELECT USING (is_admin());
```

```text
$ git show 534d6b3:supabase/migrations/20260906000004_user_roles_multi_role.sql  [lignes 208-211]
208: CREATE OR REPLACE FUNCTION is_admin()
209: RETURNS BOOLEAN AS $$
210:     SELECT COALESCE(has_role('ADMIN') OR has_role('SUPERADMIN'), FALSE);
211: $$ LANGUAGE sql STABLE SECURITY DEFINER;
```

Aucune migration ne la remplace, et le seul `REVOKE` retire l'écriture, pas la lecture :

```text
$ git grep -n -E 'POLICY.*audit_logs|REVOKE.*audit_logs' HEAD -- supabase/migrations
HEAD:supabase/migrations/0003_rls.sql:355:CREATE POLICY "audit_logs_superadmin_read" ON audit_logs
HEAD:supabase/migrations/0003_rls.sql:358:CREATE POLICY "audit_logs_insert_system" ON audit_logs
HEAD:supabase/migrations/20261031000002_lot1a_failles_sans_privilege.sql:151:DROP POLICY IF EXISTS "audit_logs_insert_system" ON public.audit_logs;  -- WITH CHECK (TRUE) : journal falsifiable
HEAD:supabase/migrations/20261031000002_lot1a_failles_sans_privilege.sql:153:REVOKE INSERT, UPDATE, DELETE ON TABLE public.audit_logs FROM anon, authenticated;
```

Conséquence : un ADMIN gardait la lecture de `audit_logs` en REST direct, avec son propre jeton, en contournant la route fermée par A24.

**Corrigé après ce constat.** Test `tests/parcours/audit-logs-rls.test.ts` (`de4405a`), rouge au run 114, puis `304d846` : la politique est recréée avec `is_superadmin()` à la fin de M1. Les lecteurs de l'application passent tous par le service_role, aucun ne change.

```text
# run 114 (de4405a) — audit-logs-rls
    ok 1 - SUPERADMIN lit la ligne témoin (la ligne existe et la politique la laisse passer)
    not ok 2 - ADMIN ne lit rien du journal, même avec son propre jeton
        audit_logs lisible par un ADMIN en REST direct : la RLS doit réserver la lecture au SUPERADMIN
    ok 3 - CLIENT ne lit rien du journal
not ok 1 - A24 — audit_logs en lecture directe (PostgREST)
```

```text
# run 115 (304d846) — audit-logs-rls
    ok 1 - SUPERADMIN lit la ligne témoin (la ligne existe et la politique la laisse passer)
    ok 2 - ADMIN ne lit rien du journal, même avec son propre jeton
    ok 3 - CLIENT ne lit rien du journal
ok 1 - A24 — audit_logs en lecture directe (PostgREST)
```

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/admin-audit-lot9.test.ts  [sous-tests retenus : /^A24 —|^A24 :|^A24, AR10/]
not ok 1 - ADMIN avec permissions : 403, aucune ligne servie, tentative non journalisée
      error: HTTP 200 {"success":true,"logs":[{"id":"1e48382e-78ce-4876-a367-10c3ddb89bdd","user_id":null,"user_role":"SYSTEM","action":"INSERT","object_type":"user_roles","object_id":"7a9cf4ab-c746-4550-942d-6572a488688a","old_value":null,"new_value":{"id":"7a9cf4ab-c746- …
        200 !== 403
not ok 1 - A24 : la page distingue le refus 403 et affiche « Réservé au superadmin » sans bouton Réessayer
      error: "app/admin/audit/page.tsx : le refus 403 n'est pas distingué d'une panne"
not ok 4 - A24, AR10 : la barre latérale et le groupe Système masquent le lien pour un ADMIN
      error: 'components/layout/AppLayout.tsx : lien vers /admin/audit non conditionné à isSuperAdmin (isAdmin)'
not ok 5 - A24, AR10 : la barre du bas filtre à l’usage, le littéral garde ses 5 objets (notif-interface:956)
      error: 'components/layout/AppLayout.tsx : filtre attendu sur adminMobileItems'
not ok 6 - A24, AR10 : le raccourci du tableau de bord est réservé au SUPERADMIN
      error: 'app/admin/dashboard/page.tsx : raccourci non conditionné au rôle SUPERADMIN ()'
# tests 19
# pass 7
# fail 12
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/admin-audit-lot9.test.ts  [sous-tests retenus : /^A24 —|^A24 :|^A24, AR10/]
ok 1 - ADMIN avec permissions : 403, aucune ligne servie, tentative non journalisée
ok 1 - A24 : la page distingue le refus 403 et affiche « Réservé au superadmin » sans bouton Réessayer
ok 4 - A24, AR10 : la barre latérale et le groupe Système masquent le lien pour un ADMIN
ok 5 - A24, AR10 : la barre du bas filtre à l’usage, le littéral garde ses 5 objets (notif-interface:956)
ok 6 - A24, AR10 : le raccourci du tableau de bord est réservé au SUPERADMIN
# … 1 autre(s) sous-test(s) réussi(s) dans ce filtre
[INVARIANT-LOT9] admin-audit-lot9 — (t)(u)(v) : 0 violation(s)
# tests 19
# pass 19
# fail 0
# cancelled 0
```

Test existant durci, signalé (T10) :

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/admin-audit.test.ts  [sous-tests retenus : /A24/]
not ok 1 - sans session 401 ; partenaire et contrôleur 403 ; ADMIN 403 (A24, lot 9) ; SUPERADMIN 200
      error: ADMIN : HTTP 200 {"success":true,"logs":[{"id":"a1f81fa5-21ea-4c08-a260-b6a3e9217e3f","user_id":"05041e9e-4d67-46bc-a15c-9c40ba074893","user_role":"CONTROLEUR","action":"UNAUTHORIZED_ACCESS_ATTEMPT","object_type":"admin_api","object_id":null,"old_value":null," …
        200 !== 403
# tests 12
# pass 11
# fail 1
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/admin-audit.test.ts  [sous-tests retenus : /A24/]
ok 1 - sans session 401 ; partenaire et contrôleur 403 ; ADMIN 403 (A24, lot 9) ; SUPERADMIN 200
# tests 12
# pass 12
# fail 0
# cancelled 0
```

**Correctif.** Route, liens masqués pour un ADMIN (AR10, non demandé littéralement, signalé), état « Réservé au superadmin » :

```text
$ git show --numstat 327e130a
327e130a fix(9.3-A24s): GET /api/admin/audit réservé au SUPERADMIN, comme la RLS (section 5.4, 4.4, L37) : verifyAdminAuth avec requireSuperadmin, 403 pour un ADMIN, sans ligne au journal. lib/auth/se …
  +    2 -    1  app/api/admin/audit/route.ts
  +    1 -    1  lib/auth/session.ts
$ git show --numstat f42d687a
f42d687a fix(9.3-A24e-nav): liens du journal d'audit masqués pour un ADMIN qui n'est pas SUPERADMIN (section 5.4, AR10, L37) : l'entrée d'Espaces métier et celle du groupe Système sont conditionnées à …
  +    3 -    3  components/layout/AppLayout.tsx
$ git show --numstat f53cb2fc
f53cb2fc fix(9.3-A24e): un ADMIN qui arrive sur le journal d'audit voit un refus propre (section 5.4, L37, AR10, AR11) : app/admin/audit/page.tsx distingue res.status === 403 d'une panne et rend l'Emp …
  +   31 -   12  app/admin/audit/page.tsx
  +    7 -    3  app/admin/dashboard/page.tsx
  (+ 2 trace(s) docs/lot9-logs/ non listée(s))
```

#### A25 — `limit` borné

**Origine.** Section 2.

```text
$ git show 534d6b3:app/api/admin/audit/route.ts  [lignes 23]
23:         const limit = parseInt(searchParams.get('limit') || '50', 10);
```

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/admin-audit-lot9.test.ts  [sous-tests retenus : /^A25/]
not ok 1 - limit=500 : plafonné à 100
      error: paramètre limit envoyé à PostgREST : ["500"], attendu 100
not ok 2 - limit=abc : 50
      error: paramètre limit envoyé à PostgREST : ["NaN"], attendu 50
not ok 3 - limit=0 : 50
      error: paramètre limit envoyé à PostgREST : ["0"], attendu 50
not ok 4 - limit=-1 : 50
      error: HTTP 500 {"error":"Journal d’audit momentanément indisponible.","code":"AUDIT_UNAVAILABLE"}
        500 !== 200
# tests 19
# pass 7
# fail 12
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/admin-audit-lot9.test.ts  [sous-tests retenus : /^A25/]
ok 1 - limit=500 : plafonné à 100
ok 2 - limit=abc : 50
ok 3 - limit=0 : 50
ok 4 - limit=-1 : 50
# … 3 autre(s) sous-test(s) réussi(s) dans ce filtre
[INVARIANT-LOT9] admin-audit-lot9 — (t)(u)(v) : 0 violation(s)
# tests 19
# pass 19
# fail 0
# cancelled 0
```

**Correctif.**

```text
$ git show --numstat 565619cc
565619cc fix(9.3-A25): limit du journal d'audit borné (section 5.4, L38) : 100 au plus, 50 pour une valeur illisible, nulle ou négative ; avant, limit=100000 passait et NaN partait à PostgREST. Non ex …
  +    3 -    1  app/api/admin/audit/route.ts
```

#### A38 — Colonne Utilisateur avec le nom et le rôle

**Origine.** Section 3 : `select('*')`, aucune jointure.

```text
$ git show 534d6b3:app/api/admin/audit/route.ts  [lignes 29]
29:             .select('*')
```

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/admin-audit-lot9.test.ts  [sous-tests retenus : /^A38/]
not ok 1 - compte connu : actor_name « Prénom Nom », actor_role = rôle courant
      error: Expected values to be strictly equal:
not ok 4 - ligne système (user_id nul) : actor_name et actor_role nuls
      error: 'actor_name absent : {"id":"940942d9-44c9-4984-ae64-beda9127e79d","user_id":null,"user_role":"SYSTEM","action":"TEST_AUDIT_LOT9_852078FD","object_type":"test_objet","object_id":null,"old_value":null,"new_value":null,"ip_address":null,"user_agent":null,"metadat …
not ok 2 - A38 : la cellule Utilisateur affiche le nom (Système sinon) et le rôle courant, jamais l’identifiant
      error: "app/admin/audit/page.tsx : actor_name ?? 'Système' attendu dans la cellule"
# tests 19
# pass 7
# fail 12
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/admin-audit-lot9.test.ts  [sous-tests retenus : /^A38/]
ok 1 - compte connu : actor_name « Prénom Nom », actor_role = rôle courant
ok 4 - ligne système (user_id nul) : actor_name et actor_role nuls
ok 2 - A38 : la cellule Utilisateur affiche le nom (Système sinon) et le rôle courant, jamais l’identifiant
# … 3 autre(s) sous-test(s) réussi(s) dans ce filtre
[INVARIANT-LOT9] admin-audit-lot9 — (t)(u)(v) : 0 violation(s)
# tests 19
# pass 19
# fail 0
# cancelled 0
```

**Correctif.** Route, puis écran :

```text
$ git show --numstat 9c63b516
9c63b516 fix(9.3-A38s): le journal d'audit rend le nom et le rôle de l'auteur par une jointure côté serveur (section 5.4, L38, D-sec 3) : select embarqué sur users, actor_name (Prénom Nom, null sinon) …
  +   13 -    3  app/api/admin/audit/route.ts
$ git show --numstat ee9b0966
ee9b0966 fix(9.3-A38e): la colonne Utilisateur du journal d'audit affiche enfin une personne (section 5.4, L38) : app/admin/audit/page.tsx lit actor_name et actor_role de la route, cellule actor_name  …
  +   24 -    4  app/admin/audit/page.tsx
  (+ 1 trace(s) docs/lot9-logs/ non listée(s))
```

#### A33 — Écritures dont l'erreur était ignorée

**Origine.** Section 4. `admin/permissions` : si `delete` réussit et `insert` échoue, l'admin perd tous ses droits et la route répond `success: true`. `partner/register` : `users.upsert` et `partner_activities.insert` sans contrôle, compte à moitié créé après un échec.

```text
$ git show 534d6b3:app/api/admin/permissions/route.ts  [lignes 83 96]
83:         await supabase.from('admin_permissions').delete().eq('user_id', adminId);
96:             await supabase.from('admin_permissions').insert(rowsToInsert);
```

```text
$ git show 534d6b3:app/api/partner/register/route.ts  [lignes 147 202]
147:         await supabase.from('users').upsert({
202:             await (supabase.from('partner_activities') as any).insert(activitiesPayload);
```

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/ecritures-ignorees.test.ts
not ok 1 - panne à l’insertion : 500 PERMISSIONS_SAVE_FAILED, anciennes permissions intactes, aucun audit, aucun texte de base
      error: panne présentée comme un succès : HTTP 200 {"success":true,"adminId":"1af79ee0-34f5-4f1c-9158-870efa66895e","permissions":["events.read","partners.read"],"message":"Permissions de l'administrateur mises à jour avec succès."}
        200 !== 500
not ok 3 - l’audit porte aussi les permissions d’avant
      error: 'users.read absente d’old_value : null'
not ok 5 - RPC directe : remplace les droits, rend l’état d’avant et écrit l’audit dans la transaction
      error: admin_permissions_set : PGRST202 Could not find the function public.admin_permissions_set(p) in the schema cache
not ok 6 - RPC directe : cible inconnue TARGET_NOT_FOUND, cible SUPERADMIN TARGET_IS_SUPERADMIN, rien d’écrit
      error: admin_permissions_set : PGRST202 Could not find the function public.admin_permissions_set(p) in the schema cache
# … 6 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/ecritures-ignorees.test.ts
  schéma du lot 9 incomplet (ecritures-ignorees) : invariants (t)(u)(v) impossibles à vérifier :
  fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
  fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
# tests 12
# pass 2
# fail 10
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/ecritures-ignorees.test.ts
ok 1 - panne à l’insertion : 500 PERMISSIONS_SAVE_FAILED, anciennes permissions intactes, aucun audit, aucun texte de base
ok 3 - l’audit porte aussi les permissions d’avant
ok 5 - RPC directe : remplace les droits, rend l’état d’avant et écrit l’audit dans la transaction
ok 6 - RPC directe : cible inconnue TARGET_NOT_FOUND, cible SUPERADMIN TARGET_IS_SUPERADMIN, rien d’écrit
ok 7 - statique : la route passe par la RPC, plus de DELETE ni d’INSERT directs
ok 1 - panne sur les activités : 500 PARTNER_REGISTER_FAILED, aucune fiche, pièces libres, compte retiré, aucun texte de base
# … 6 autre(s) sous-test(s) réussi(s)
[INVARIANT-LOT9] ecritures-ignorees — (t)(u)(v) : 0 violation(s)
# tests 12
# pass 12
# fail 0
# cancelled 0
```

**Correctif.** RPC `admin_permissions_set` et `partner_register_finalize`, compensation `deleteUser` :

```text
$ git show --numstat 84da7d5a
84da7d5a fix(9.3-A33): chaque écriture dont l'erreur était ignorée la traite (section 5.4, L39). M1 ajoute admin_permissions_set (cible sous verrou, suppression, insertion et audit en une transaction  …
  +   16 -   39  app/api/admin/permissions/route.ts
  +   44 -   73  app/api/partner/register/route.ts
  +  135 -    0  supabase/migrations/20261108000001_lot9_securite.sql
```

Reste ouvert : `logAudit` tait les erreurs partout ailleurs (L39).

#### A34 — Lectures dont l'erreur était ignorée

**Origine.** Section 5.

```text
$ git show 534d6b3:app/api/admin/communications/route.ts  [lignes 82 85 89]
82:             const { data: partners } = await supabase.from('partners').select('phone').not('phone', 'is', null);
85:             const { data: ambassadors } = await supabase.from('users').select('phone').eq('referral_status', 'AMBASSADEUR');
89:             const { data: users } = await supabase.from('users').select('phone').not('phone', 'is', null);
```

```text
$ git show 534d6b3:app/api/admin/pricing/route.ts  [lignes 73]
73:         const { data: current } = await supabase
```

```text
$ git show 534d6b3:app/api/auth/send-otp/route.ts  [lignes 59]
59:             const { data: userRecord } = await supabase
```

```text
$ git show 534d6b3:app/api/auth/verify-otp/route.ts  [lignes 82]
82:         const { data: userProfile } = await supabase
```

```text
$ git show 534d6b3:app/api/admin/users/route.ts  [lignes 266]
266:         if (targetErr || !targetUser) {
```

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/lectures-ignorees.test.ts
not ok 1 - ALL_PARTNERS, panne des destinataires : 500 RECIPIENTS_UNAVAILABLE, aucune campagne, journal
      error: panne présentée comme un succès : HTTP 200 {"success":true,"campaign":{"id":"c5364127-85a2-4f40-954a-0a1a7ba85931","title":"Campagne panne ALL_PARTNERS 96f43a90e3","message":"Message de test du lot 9.","sender_profile":"Event Village Info","target_audience":"A …
        200 !== 500
not ok 2 - AMBASSADORS, panne des destinataires : 500 RECIPIENTS_UNAVAILABLE, aucune campagne, journal
      error: panne présentée comme un succès : HTTP 200 {"success":true,"campaign":{"id":"6d69f41f-1b5d-429a-b2b4-add52c49e251","title":"Campagne panne AMBASSADORS 7bde981d84","message":"Message de test du lot 9.","sender_profile":"Event Village Info","target_audience":"AM …
        200 !== 500
not ok 3 - ALL_CLIENTS, panne des destinataires : 500 RECIPIENTS_UNAVAILABLE, aucune campagne, journal
      error: panne présentée comme un succès : HTTP 200 {"success":true,"campaign":{"id":"da30d81e-6d0a-4c66-aaae-91b37767d1a7","title":"Campagne panne ALL_CLIENTS 0e6af43094","message":"Message de test du lot 9.","sender_profile":"Event Village Info","target_audience":"AL …
        200 !== 500
not ok 1 - panne de lecture de l’ancienne valeur : 500 PRICING_SAVE_FAILED, pas d’upsert, pas d’audit
      error: panne présentée comme un succès : HTTP 200 {"success":true,"key":"lot9.panne_978df85cc7","message":"Grille tarifaire \"lot9.panne_978df85cc7\" mise à jour avec succès."}
        200 !== 500
# … 6 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 6 - /home/runner/work/event-village/event-village/tests/parcours/lectures-ignorees.test.ts
  schéma du lot 9 incomplet (lectures-ignorees) : invariants (t)(u)(v) impossibles à vérifier :
  fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
  fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
# tests 16
# pass 6
# fail 10
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/lectures-ignorees.test.ts
ok 1 - ALL_PARTNERS, panne des destinataires : 500 RECIPIENTS_UNAVAILABLE, aucune campagne, journal
ok 2 - AMBASSADORS, panne des destinataires : 500 RECIPIENTS_UNAVAILABLE, aucune campagne, journal
ok 3 - ALL_CLIENTS, panne des destinataires : 500 RECIPIENTS_UNAVAILABLE, aucune campagne, journal
ok 1 - panne de lecture de l’ancienne valeur : 500 PRICING_SAVE_FAILED, pas d’upsert, pas d’audit
ok 1 - panne de lecture du compte : 500 OTP_SEND_FAILED, jamais 404, aucun SMS, aucun code
ok 1 - panne de lecture du profil (isLogin true) : 503 PHONE_VERIFY_FAILED, jamais verified: true ni 404
# … 10 autre(s) sous-test(s) réussi(s)
[INVARIANT-LOT9] lectures-ignorees — (t)(u)(v) : 0 violation(s)
# tests 16
# pass 16
# fail 0
# cancelled 0
```

**Correctif.**

```text
$ git show --numstat cca809dc
cca809dc fix(9.3-A34): chaque lecture dont l'erreur était ignorée la traite (section 5.4, L40, D-sec 5). admin/communications POST : 500 RECIPIENTS_UNAVAILABLE, plus de campagne à 0 destinataire sur u …
  +   10 -   14  app/api/admin/communications/route.ts
  +    4 -    1  app/api/admin/pricing/route.ts
  +    5 -    1  app/api/admin/users/route.ts
  +    6 -    1  app/api/auth/send-otp/route.ts
  +   15 -    3  app/api/auth/verify-otp/route.ts
```

#### A32 — Une panne n'est plus présentée comme une absence

**Origine.** Section 6. La découverte a trouvé aussi le défaut inverse, non cité par la consigne : `GET partner/products/[id]` répondait 500 sur un produit réellement absent.

```text
$ git show 534d6b3:lib/events/event.service.ts  [lignes 303-306]
303:         const { data, error } = await query.single();
304:         if (error || !data) {
305:             throw new PublicError('Événement introuvable ou non autorisé.');
306:         }
```

```text
$ git show 534d6b3:lib/halls/hall.service.ts  [lignes 124-134]
124:     public static async getHallById(hallId: string) {
125:         const supabase = getServiceRoleClient();
126:         const { data: hall, error } = await supabase
127:             .from('halls')
128:             .select('*, partners(company_name, phone, user_id), hall_reservations(*)')
129:             .eq('id', hallId)
130:             .single();
131: 
132:         if (error || !hall) {
133:             throw new PublicError('Salle introuvable.');
134:         }
```

```text
$ git show 534d6b3:lib/products/product.service.ts  [lignes 163-171]
163:     static async getProductById(productId: string): Promise<Product> {
164:         const supabase = getServiceRoleClient();
165:         const { data, error } = await supabase
166:             .from('products')
167:             .select('*')
168:             .eq('id', productId)
169:             .single();
170: 
171:         if (error || !data) throw new PublicError('Produit introuvable.');
```

```text
$ git show 534d6b3:app/api/partner/orders/[id]/route.ts  [lignes 27-40]
27:         const { data: order, error } = await supabase
28:             .from('orders')
29:             .select(`
30:                 *,
31:                 client:client_id (first_name, last_name, phone),
32:                 order_items (id, product_id, product_name, quantity, unit_price, total_price, notes)
33:             `)
34:             .eq('id', id)
35:             .eq('partner_id', partnerId)
36:             .single();
37: 
38:         if (error || !order) {
39:             return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
40:         }
```

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/pannes-absences.test.ts  [sous-tests retenus : /^A32/]
not ok 1 - panne de events : 500 EVENT_UNAVAILABLE, journalisée, jamais 404
      error: panne présentée comme une absence : HTTP 404 {"error":"Événement introuvable ou non autorisé.","code":"EVENT_NOT_FOUND"}
        404 !== 500
not ok 1 - panne de halls : 500 HALL_UNAVAILABLE, journalisée, jamais 404
      error: panne présentée comme une absence : HTTP 404 {"error":"Salle introuvable.","code":"HALL_NOT_FOUND"}
        404 !== 500
not ok 1 - panne de products : 500 PRODUCT_UNAVAILABLE, journalisée, jamais 404
      error: 'HTTP 500 {"error":"Produit introuvable.","code":"PRODUCT_UNAVAILABLE"}'
not ok 2 - produit absent : 404 PRODUCT_NOT_FOUND
      error: absent : HTTP 500 {"error":"Produit introuvable.","code":"PRODUCT_UNAVAILABLE"}
        500 !== 404
not ok 3 - uuid invalide : 404 PRODUCT_NOT_FOUND, pas une panne
      error: uuid invalide : HTTP 500 {"error":"Produit introuvable.","code":"PRODUCT_UNAVAILABLE"}
        500 !== 404
not ok 1 - panne de orders : 500 ORDER_UNAVAILABLE, journalisée, jamais 404
      error: panne présentée comme une absence : HTTP 404 {"error":"Commande introuvable."}
        404 !== 500
# … 4 autre(s) sous-test(s) en échec retenu(s)
# tests 21
# pass 10
# fail 11
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/pannes-absences.test.ts  [sous-tests retenus : /^A32/]
ok 1 - panne de events : 500 EVENT_UNAVAILABLE, journalisée, jamais 404
ok 1 - panne de halls : 500 HALL_UNAVAILABLE, journalisée, jamais 404
ok 1 - panne de products : 500 PRODUCT_UNAVAILABLE, journalisée, jamais 404
ok 2 - produit absent : 404 PRODUCT_NOT_FOUND
ok 3 - uuid invalide : 404 PRODUCT_NOT_FOUND, pas une panne
ok 1 - panne de orders : 500 ORDER_UNAVAILABLE, journalisée, jamais 404
ok 2 - commande absent : 404 ORDER_NOT_FOUND
ok 3 - uuid invalide : 404 ORDER_NOT_FOUND, pas une panne
# … 10 autre(s) sous-test(s) réussi(s) dans ce filtre
[INVARIANT-LOT9] pannes-absences — (t)(u)(v) : 0 violation(s)
# tests 21
# pass 21
# fail 0
# cancelled 0
```

**Correctif.**

```text
$ git show --numstat 3796cdeb
3796cdeb fix(9.3-A32): une panne n'est plus présentée comme une absence (section 5.4, L41, D-sec 6). getEventById, getHallById, getProductById et GET partner/orders/[id] : uuid invalide et absence en  …
  +    1 -    1  app/api/partner/halls/[id]/route.ts
  +    9 -    4  app/api/partner/orders/[id]/route.ts
  +   10 -    6  lib/events/event.service.ts
  +    9 -    5  lib/halls/hall.service.ts
  +   13 -    6  lib/products/product.service.ts
```

#### A26 — Fiche partenaire d'un événement

**Origine.** Section 6, `partner/events/[id]/route.ts:32`.

```text
$ git show 534d6b3:app/api/partner/events/[id]/route.ts  [lignes 32]
32:         return apiFailure('GET /api/partner/events/[id]', error, { message: 'Événement introuvable.', code: 'EVENT_NOT_FOUND', status: 404 });
```

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/pannes-absences.test.ts  [sous-tests retenus : /^A26/]
not ok 1 - panne de partners : 500 EVENT_UNAVAILABLE, journalisée, jamais 404
      error: panne présentée comme une absence : HTTP 404 {"error":"Profil partenaire introuvable pour cet utilisateur.","code":"EVENT_NOT_FOUND"}
        404 !== 500
# tests 21
# pass 10
# fail 11
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/pannes-absences.test.ts  [sous-tests retenus : /^A26/]
ok 1 - panne de partners : 500 EVENT_UNAVAILABLE, journalisée, jamais 404
# … 2 autre(s) sous-test(s) réussi(s) dans ce filtre
[INVARIANT-LOT9] pannes-absences — (t)(u)(v) : 0 violation(s)
# tests 21
# pass 21
# fail 0
# cancelled 0
```

Test existant adapté, signalé (T11) : de 404 à 500 `EVENT_UNAVAILABLE`.

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/messages-bruts.test.ts  [sous-tests retenus : /A26/]
not ok 3 - partner/events/[id] : 500 EVENT_UNAVAILABLE (A26, lot 9), une panne n'est pas une absence, message français
      error: {"error":"Événement introuvable ou non autorisé.","code":"EVENT_NOT_FOUND"}
# tests 14
# pass 13
# fail 1
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/messages-bruts.test.ts  [sous-tests retenus : /A26/]
ok 3 - partner/events/[id] : 500 EVENT_UNAVAILABLE (A26, lot 9), une panne n'est pas une absence, message français
# tests 14
# pass 14
# fail 0
# cancelled 0
```

**Correctif.**

```text
$ git show --numstat 8e0a36da
8e0a36da fix(9.3-A26): la fiche partenaire d'un événement ne présente plus une panne comme une absence (section 5.4, L41, T11) : le repli de GET partner/events/[id] passe à 500 EVENT_UNAVAILABLE, Évén …
  +    2 -    2  app/api/partner/events/[id]/route.ts
```

#### A27 — Trigger anti-boucle du parrainage

**Origine.** Section 7 : le trigger ne couvre que `INSERT`. La découverte n'a trouvé aucune écriture `UPDATE` de cette table dans `app/`, `lib/` ni les fonctions SQL : aucun chemin de code ne passait par ce trou.

```text
$ git show 534d6b3:supabase/migrations/0011_referral_codes.sql  [lignes 106-109]
106: DROP TRIGGER IF EXISTS trg_check_circular_referral ON public.referral_relationships;
107: CREATE TRIGGER trg_check_circular_referral
108:     BEFORE INSERT ON public.referral_relationships
109:     FOR EACH ROW EXECUTE FUNCTION check_no_circular_referral();
```

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/parrainage-boucle-update.test.ts
not ok 1 - UPDATE sponsor_id qui ferme une boucle : P0001
      error: 'Missing expected rejection (assertLoopRefused).'
not ok 2 - UPDATE referred_id qui ferme une boucle : P0001
      error: 'Missing expected rejection (assertLoopRefused).'
not ok 1 - UPDATE sponsor_id qui ferme une boucle : P0001, relation inchangée
      error: 'UPDATE accepté : boucle créée (A27)'
not ok 2 - UPDATE referred_id qui ferme une boucle : P0001, relation inchangée
      error: 'UPDATE accepté : boucle créée (A27)'
# crochet en échec :
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/parrainage-boucle-update.test.ts
  schéma du lot 9 incomplet (parrainage-boucle-update) : invariants (t)(u)(v) impossibles à vérifier :
  fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
  fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
# tests 7
# pass 3
# fail 4
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/parrainage-boucle-update.test.ts
ok 1 - UPDATE sponsor_id qui ferme une boucle : P0001
ok 2 - UPDATE referred_id qui ferme une boucle : P0001
ok 1 - UPDATE sponsor_id qui ferme une boucle : P0001, relation inchangée
ok 2 - UPDATE referred_id qui ferme une boucle : P0001, relation inchangée
# … 3 autre(s) sous-test(s) réussi(s)
[INVARIANT-LOT9] parrainage-boucle-update — (t)(u)(v) : 0 violation(s)
# tests 7
# pass 7
# fail 0
# cancelled 0
```

**Correctif.** Trigger seul, fonction non recopiée (L42) :

```text
$ git show --numstat 6687b89e
6687b89e fix(9.3-A27): le trigger anti-boucle du parrainage couvre aussi l'UPDATE, quel que soit le rôle (section 3.2, L42). M1 remplace trg_check_circular_referral par BEFORE INSERT OR UPDATE OF spon …
  +   11 -    0  supabase/migrations/20261108000001_lot9_securite.sql
```

À faire avant d'appliquer sur `event-village-dev` : la requête en lecture des boucles existantes (section des migrations). Une boucle préexistante ne fait pas échouer la migration, mais bloque ensuite les écritures de la chaîne.

#### A39 — « Rapport de clôture »

**Origine.** Section 8. Trois lignes et non deux : l'en-tête `:921` « DOCUMENT OFFICIEL… » n'était pas cité par la consigne, retiré aussi, signalé (L43).

```text
$ git show 534d6b3:lib/partner/partner-dashboard.service.ts  [lignes 918 921 1069 1072]
918:         stream += `52 ${headerY + 44} Td\n(EVENT VILLAGE -- RAPPORT DE CLOTURE DE SESSION) Tj\nET\n`;
921:         stream += `52 ${headerY + 28} Td\n(DOCUMENT OFFICIEL DE SYNTHESE COMPTABLE & DE BILLETTERIE) Tj\nET\n`;
1069:         stream += `36 ${footerY + 10} Td\n(Document comptable certifie genere automatiquement par Event Village Senegal -- contact@event-village.sn) Tj\nET\n`;
1072:         stream += `36 ${footerY} Td\n(Certificat de cloture : ${escapePdfText(data.reportId)}) Tj\nET\n`;
```

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/cloture-vocabulaire.test.ts
not ok 1 - PDF : aucun « certifié », « certificat », « document comptable » ni « document officiel »
      error: mentions interdites dans le PDF :
        (DOCUMENT OFFICIEL DE SYNTHESE COMPTABLE & DE BILLETTERIE) Tj
not ok 2 - PDF : le titre est « Rapport de clôture », avec ô en WinAnsi
      error: 'titre « Rapport de clôture » absent du PDF'
not ok 4 - statique : le service n’écrit plus ces libellés
      error: lib/partner/partner-dashboard.service.ts :
        stream += `52 ${headerY + 28} Td\n(DOCUMENT OFFICIEL DE SYNTHESE COMPTABLE & DE BILLETTERIE) Tj\nET\n`;
# crochet en échec :
not ok 2 - /home/runner/work/event-village/event-village/tests/parcours/cloture-vocabulaire.test.ts
  schéma du lot 9 incomplet (cloture-vocabulaire) : invariants (t)(u)(v) impossibles à vérifier :
  fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
  fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
# tests 6
# pass 3
# fail 3
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/cloture-vocabulaire.test.ts
ok 1 - PDF : aucun « certifié », « certificat », « document comptable » ni « document officiel »
ok 2 - PDF : le titre est « Rapport de clôture », avec ô en WinAnsi
ok 4 - statique : le service n’écrit plus ces libellés
# … 3 autre(s) sous-test(s) réussi(s)
[INVARIANT-LOT9] cloture-vocabulaire — (t)(u)(v) : 0 violation(s)
# tests 6
# pass 6
# fail 0
# cancelled 0
```

**Correctif.**

```text
$ git show --numstat 62be3f26
62be3f26 fix(9.3-A39): le PDF de clôture s'intitule Rapport de clôture (section 5.4, L43, D-sec 8) : plus aucun certifié, certificat, document comptable, ni document officiel (ce dernier, en-tête non  …
  +    4 -    4  lib/partner/partner-dashboard.service.ts
```

#### A40 — La route de développement rend l'échec du webhook

**Origine.** Section 9 : `res.ok` donne `ok: true` sans lire `webhookStatus`, et le faux service répond 200 quand le webhook de l'application a répondu 500.

```text
$ git show 534d6b3:app/api/dev/samirpay/[action]/route.dev.ts  [lignes 50-53]
50:     if (res.ok) {
51:         const done = (await res.json()) as { status?: string };
52:         return NextResponse.json({ ok: true, status: done.status ?? null });
53:     }
```

```text
# run 110 (e6c23d1, « avant ») — tests/schema/essai-route-dev.test.ts
not ok 1 - validate, webhook 500 : 502, ok:false, FAKE_SERVICE_ERROR, message
      error: webhook 500 présenté comme un succès
        200 !== 502
not ok 2 - validate, webhook 404 : 502, ok:false, FAKE_SERVICE_ERROR, message
      error: webhook 404 présenté comme un succès
        200 !== 502
not ok 3 - validate, webhook 301 : 502, ok:false, FAKE_SERVICE_ERROR, message
      error: webhook 301 présenté comme un succès
        200 !== 502
# tests 7
# pass 4
# fail 3
# cancelled 0
# run 113 (d255bf3, « après ») — tests/schema/essai-route-dev.test.ts
ok 1 - validate, webhook 500 : 502, ok:false, FAKE_SERVICE_ERROR, message
ok 2 - validate, webhook 404 : 502, ok:false, FAKE_SERVICE_ERROR, message
ok 3 - validate, webhook 301 : 502, ok:false, FAKE_SERVICE_ERROR, message
# … 4 autre(s) sous-test(s) réussi(s)
# tests 7
# pass 7
# fail 0
# cancelled 0
```

**Correctif.**

```text
$ git show --numstat a118e370
a118e370 fix(9.3-A40): la route de développement rend l'échec du webhook (section 5.4, 4.4, L43, D-sec 9) : le faux service répond 200 avec webhookStatus même si le webhook de l'application a échoué ; …
  +    9 -    2  app/api/dev/samirpay/[action]/route.dev.ts
```

#### PO3 — `ticket_refund_request` et l'ordre des verrous

**Origine.** Section 10. Billet verrouillé avant la catégorie. Le remède du rapport du lot 8 (« correctif d'une ligne ») était insuffisant : un `FOR UPDATE` sur la catégorie crée un nouveau cycle avec `ticket_scan`, d'où `FOR NO KEY UPDATE` (AR4).

```text
$ git show 534d6b3:supabase/migrations/20261101000005_lot3_remboursements.sql  [lignes 109 114 116 128]
109:     SELECT payment_id INTO v_payment_id FROM public.tickets WHERE id = p_ticket_id;
114:         SELECT * INTO p FROM public.payments WHERE id = v_payment_id FOR UPDATE;
116:     SELECT * INTO t FROM public.tickets WHERE id = p_ticket_id FOR UPDATE;
128:     PERFORM 1 FROM public.ticket_categories WHERE id = t.category_id FOR UPDATE;
```

Sortie brute du run 110, l'interblocage réel à trois connexions :

```text
# S/run110/test-logs/tests__parcours__course-verrous-lot9.test.ts.log, lignes 3 à 24
    # Subtest: 1. vrai cycle sur un billet gratuit : C tient le billet, A rembourse, B annule, C libère : A AUCUN, B aboutit, aucun 40P01
    not ok 1 - 1. vrai cycle sur un billet gratuit : C tient le billet, A rembourse, B annule, C libère : A AUCUN, B aboutit, aucun 40P01
      ---
      duration_ms: 1285.12678
      type: 'test'
      location: '/home/runner/work/event-village/event-village/tests/parcours/course-verrous-lot9.test.ts:3:3769'
      failureType: 'testCodeFailure'
      error: |-
        interblocage (40P01) :
        B (annulation) : erreur 40P01 deadlock detected
        + actual - expected

        + [
        +   'B (annulation) : erreur 40P01 deadlock detected'
        + ]
        - []

      code: 'ERR_ASSERTION'
      name: 'AssertionError'
      expected:
      actual:
        0: 'B (annulation) : erreur 40P01 deadlock detected'
```

Mêmes scénarios, mêmes étapes, au run 113 : `git log e6c23d1..HEAD -- tests/parcours/course-verrous-lot9.test.ts` ne rend aucun commit, le test n'a pas changé entre les deux runs. Le filtre garde le contrôle statique de l'ordre écrit dans la fonction.

```text
# run 113 (d255bf3, « après ») — tests/parcours/course-verrous-lot9.test.ts  [sous-tests retenus : /^PO3 —|^ticket_refund_request :/]
ok 1 - 1. vrai cycle sur un billet gratuit : C tient le billet, A rembourse, B annule, C libère : A AUCUN, B aboutit, aucun 40P01
ok 2 - 2. garde-fou : C tient la catégorie, A rembourse un billet payé, S scanne, C libère : issue cohérente, aucun 40P01
ok 3 - 3. témoin, billet payé : le paiement sérialise A et B, A puis B, aucun 40P01 (vert dès l’écriture)
ok 1 - ticket_refund_request : paiement, puis catégorie en FOR NO KEY UPDATE, puis billet ; aucun FOR UPDATE sur la catégorie
[INVARIANT-LOT9] course-verrous-lot9 — (t)(u)(v) : 0 violation(s)
# tests 9
# pass 9
# fail 0
# cancelled 0
```

```text
$ grep -E 'erreur 40P01' S/run113/test-logs/tests__parcours__course-verrous-lot9.test.ts.log
(aucune ligne)
```

**Correctif.**

```text
$ git show --numstat bf96b1d3
bf96b1d3 fix(9.3-PO3): ticket_refund_request respecte l'ordre unique des verrous (section 3.2, 3.3, AR4). M1 recopie la fonction de 20261101000005:85-191 et prend la catégorie en FOR NO KEY UPDATE ava …
  +  129 -    0  supabase/migrations/20261108000001_lot9_securite.sql
```

#### PO4 — `event_update` et `ticket_category_guard`

**Origine.** Section 11. `events FOR UPDATE` puis catégories, contre un achat qui tient une catégorie et prend `FOR KEY SHARE` sur `events`.

```text
$ git show 534d6b3:supabase/migrations/20261103000005_lot6_billetterie.sql  [lignes 1413 1542]
1413:     SELECT * INTO e FROM public.events WHERE id = v_event FOR UPDATE;
1542:     PERFORM 1 FROM public.ticket_categories WHERE event_id = v_event ORDER BY id FOR UPDATE;
```

```text
$ git show 534d6b3:supabase/migrations/20261102000004_lot5_edition.sql  [lignes 822 842]
822:     SELECT status::text INTO v_status FROM public.events WHERE id = p_event FOR UPDATE;
842:     PERFORM 1 FROM public.ticket_categories WHERE event_id = p_event ORDER BY id FOR UPDATE;
```

```text
$ git show 534d6b3:supabase/migrations/20261105000006_lot7_client.sql  [lignes 43-45]
43:     PERFORM 1 FROM public.ticket_categories
44:      WHERE id IN (SELECT (e->>'category_id')::uuid FROM jsonb_array_elements(v_items) e)
45:      ORDER BY id FOR UPDATE;
```

Sortie brute du run 110 :

```text
# S/run110/test-logs/tests__parcours__course-verrous-lot9.test.ts.log, lignes 58 à 79
    # Subtest: 1. event_update : C tient la plus petite catégorie, B édite, A achète l’autre, C libère : A puis B, aucun 40P01
    not ok 1 - 1. event_update : C tient la plus petite catégorie, B édite, A achète l’autre, C libère : A puis B, aucun 40P01
      ---
      duration_ms: 1244.22392
      type: 'test'
      location: '/home/runner/work/event-village/event-village/tests/parcours/course-verrous-lot9.test.ts:3:12917'
      failureType: 'testCodeFailure'
      error: |-
        interblocage (40P01) :
        A (checkout) : erreur 40P01 deadlock detected
        + actual - expected

        + [
        +   'A (checkout) : erreur 40P01 deadlock detected'
        + ]
        - []

      code: 'ERR_ASSERTION'
      name: 'AssertionError'
      expected:
      actual:
        0: 'A (checkout) : erreur 40P01 deadlock detected'
```

```text
# S/run110/test-logs/tests__parcours__course-verrous-lot9.test.ts.log, lignes 91 à 112
    # Subtest: 2. ticket_category_update (ticket_category_guard) : même montage, aucun 40P01
    not ok 2 - 2. ticket_category_update (ticket_category_guard) : même montage, aucun 40P01
      ---
      duration_ms: 1238.247486
      type: 'test'
      location: '/home/runner/work/event-village/event-village/tests/parcours/course-verrous-lot9.test.ts:3:13632'
      failureType: 'testCodeFailure'
      error: |-
        interblocage (40P01) :
        A (checkout) : erreur 40P01 deadlock detected
        + actual - expected

        + [
        +   'A (checkout) : erreur 40P01 deadlock detected'
        + ]
        - []

      code: 'ERR_ASSERTION'
      name: 'AssertionError'
      expected:
      actual:
        0: 'A (checkout) : erreur 40P01 deadlock detected'
```

Run 113 :

```text
# run 113 (d255bf3, « après ») — tests/parcours/course-verrous-lot9.test.ts  [sous-tests retenus : /^PO4 —|^event_update :|^ticket_category_guard :/]
ok 1 - 1. event_update : C tient la plus petite catégorie, B édite, A achète l’autre, C libère : A puis B, aucun 40P01
ok 2 - 2. ticket_category_update (ticket_category_guard) : même montage, aucun 40P01
ok 3 - 3. témoin D20 : ticket_transfer_accept attend tant que event_update tient events (vert dès l’écriture)
ok 2 - event_update : events en FOR NO KEY UPDATE, plus aucun FOR UPDATE sur events
ok 3 - ticket_category_guard : events en FOR NO KEY UPDATE, plus aucun FOR UPDATE sur events
[INVARIANT-LOT9] course-verrous-lot9 — (t)(u)(v) : 0 violation(s)
# tests 9
# pass 9
# fail 0
# cancelled 0
```

**Correctif.** Un mot par fonction, le `FOR SHARE` des autres chemins reste en conflit (D20, témoin vert au scénario 3) :

```text
$ git show --numstat 31e6e613
31e6e613 fix(9.3-PO4): event_update et ticket_category_guard respectent l'ordre unique des verrous (section 3.2, 3.3, AR4). M1 recopie les deux fonctions (20261103000005:1339-1702, 20261102000004:809- …
  +  428 -    0  supabase/migrations/20261108000001_lot9_securite.sql
```

La sortie complète et les scénarios sont en section 7 du rapport (ordre des verrous).

### 9.4 — Nettoyage

#### A16 — Retrait de « à régler sur place »

**Origine.** `discovery-9-nettoyage.md`, 1.1 : aucun émetteur en production. Le chemin `cash_required` exige `tickets.order_id` non nul, et aucun code de production ne le pose ; seules deux fixtures le faisaient.

```text
$ git show 534d6b3:supabase/migrations/20261106000005_lot8_scan.sql  [lignes 193-199]
193:             IF t.order_id IS NOT NULL THEN
194:                 SELECT payment_status::text INTO v_order_status FROM public.orders WHERE id = t.order_id;
195:             END IF;
196:             IF t.payment_id IS NULL AND v_order_status IS NOT NULL AND v_order_status <> 'SUCCESS' THEN
197:                 v_scan := public.scan_log(t.id, v_event, v_scanner, 'cash_required', FALSE, v_method, v_identity, v_hash, t.price, v_version, v_key);
198:                 RETURN jsonb_build_object('result', 'cash_required', 'scan_id', v_scan, 'amount_due', t.price, 'consumed', FALSE, 'ticket', v_info);
199:             END IF;
```

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/nettoyage-sur-place.test.ts
not ok 1 - scan caméra : payment_required, billet VALIDE sans paiement, aucune ligne cash_required, caisse ouverte non créditée
      error: billet payant sans paiement : payment_required attendu, HTTP 200 {"result":"cash_required","ticket":{"id":"65e4ea37-2c4b-4889-81b2-2332ea8e2b14","price":5000,"holder":"Awa Acheteusenettoyagea","category":"Standard","ticket_number":"TCK-ACCES-E9DCC2D2BA1D","is_ …
not ok 2 - saisie manuelle : preview payment_required, aucune ligne de scan, billet VALIDE
      error: résultat prévu : HTTP 200 {"found":true,"ticket":{"ticket_number":"TCK-ACCES-EF58207B94BC","holder":"Awa Acheteusenettoyagea","category":"Standard","status_label":"Valable","preview":"cash_required","preview_label":"Encaissement requis"}}
not ok 1 - app/api/controller/scan/route : PUT n’est plus exporté, POST reste
      error: PUT /api/controller/scan encore exporté (encaissement au scan)
not ok 2 - la fonction public.ticket_cash_checkin n’existe plus
      error: fonction encore présente : [{"signature":"ticket_cash_checkin(jsonb)"}]
# … 4 autre(s) sous-test(s) en échec retenu(s)
# crochet en échec :
not ok 5 - /home/runner/work/event-village/event-village/tests/parcours/nettoyage-sur-place.test.ts
  schéma du lot 9 incomplet (nettoyage-sur-place) : invariants (t)(u)(v) impossibles à vérifier :
  fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
  fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
# tests 9
# pass 1
# fail 8
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/nettoyage-sur-place.test.ts
ok 1 - scan caméra : payment_required, billet VALIDE sans paiement, aucune ligne cash_required, caisse ouverte non créditée
ok 2 - saisie manuelle : preview payment_required, aucune ligne de scan, billet VALIDE
ok 1 - app/api/controller/scan/route : PUT n’est plus exporté, POST reste
ok 2 - la fonction public.ticket_cash_checkin n’existe plus
ok 3 - lib/scan/scan-result : ni cash_required ni a_encaisser ; vibration a_encaisser sans motif
ok 1 - app, components, lib, hooks : ni cash_required, ni a_encaisser, ni confirmCashCheckin, ni ticket_cash_checkin
ok 2 - variable CASH_COLLECT_PER_SCANNER_MIN retirée de lib/env.ts, .env.example et .env.test.example
ok 3 - jetons scan-cash retirés de app/globals.css, tailwind.config.ts et MASTER.md
# … 1 autre(s) sous-test(s) réussi(s)
[INVARIANT-LOT9] nettoyage-sur-place — (t)(u)(v) : 0 violation(s)
# tests 9
# pass 9
# fail 0
# cancelled 0
```

Test existant adapté (T16), `cash_required` retiré de l'union :

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/acces-tracabilite.test.ts  [sous-tests retenus : /ScanResult/]
not ok 1 - type ScanResult = exactement l’union du contrat
      error: ScanResult = valid | already_used | invalid | cancelled | refunded | wrong_event | event_cancelled | event_ended | event_suspended | event_not_open | payment_required | cash_required | qr_expired | dynamic_qr_required | manual_entry_refused | rate_limited | ne …
# tests 8
# pass 7
# fail 1
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/acces-tracabilite.test.ts  [sous-tests retenus : /ScanResult/]
ok 1 - type ScanResult = exactement l’union du contrat
# tests 7
# pass 7
# fail 0
# cancelled 0
```

**Correctif.** Serveur, puis écrans. Le billet impayé tombe sur `payment_required`, le filet existant (L44). Tests existants adaptés dans `10780e93`, `4e0dfce7` (seed, AM5), `36067844` et `3c83ab11`, listés en section 1.

```text
$ git show --numstat 505d70f3
505d70f3 fix(9.4-A16s): retrait du code à régler sur place côté serveur (section 5.5, 3.2, L44, L45, AR5) : aucun émetteur en production, décision du client. M5 recopie ticket_scan (20261106000005:21- …
  +    0 -    1  .env.example
  +    0 -    1  .env.test.example
  +    0 -   35  app/api/controller/scan/route.ts
  +    0 -    1  lib/env.ts
  +    1 -    2  lib/hardware/feedback.ts
  +    1 -    4  lib/scan/scan-result.ts
  +    1 -    1  lib/shifts/shift.service.ts
  +  314 -    0  supabase/migrations/20261108000005_lot9_nettoyage.sql
$ git show --numstat 80df7153
80df7153 fix(9.4-A16e): plus d'état à encaisser au scan (section 5.5, L44, L45). Écrans : confirmCashCheckin et le PUT retirés de components/scan/scan-client.ts (seule voie POST, sendWithRetry sans mé …
  +   10 -   73  app/controller/scanner/page.tsx
  +    0 -    2  app/globals.css
  +    2 -    9  app/partner/scan/page.tsx
  +    2 -    2  app/partner/team/page.tsx
  +    3 -    5  components/partner/pilotage/EntriesTab.tsx
  +    0 -    1  components/partner/pilotage/types.ts
  +   12 -   32  components/scan/CombatFlashOverlay.tsx
  +    3 -    3  components/scan/ManualEntryForm.tsx
  +    0 -    1  components/scan/ScanHistoryList.tsx
  +    3 -   13  components/scan/ScanResultPanel.tsx
  +    2 -    2  components/scan/ScannerShiftBanner.tsx
  +   10 -   34  components/scan/scan-client.ts
  +    1 -    2  design-system/event-village/MASTER.md
  +    0 -    2  tailwind.config.ts
  (+ 4 trace(s) docs/lot9-logs/ non listée(s))
```

La fixture du pilotage reproduit l'ancien encaissement en SQL (L46, X5), sans changer aucune assertion du pilotage.

#### PO10 — Code mort

**Origine.** `discovery-9-nettoyage.md`, section 2. La preuve par grep exigée par la consigne, rejouée sur `534d6b3` (seuls `tests/` et la définition elle-même citent ces symboles ; `hall.service.ts:3` est un import inerte) :

```text
$ git grep -n -E 'AdjustTicketQuotaModal|EventCancelModal\b|calculateTicketingFinancials|calculateOrderFinancials|FinancialCalculatorService' 534d6b3 -- app components lib hooks scripts e2e tests
534d6b3:components/events/AdjustTicketQuotaModal.tsx:30:interface AdjustTicketQuotaModalProps {
534d6b3:components/events/AdjustTicketQuotaModal.tsx:40:export const AdjustTicketQuotaModal: React.FC<AdjustTicketQuotaModalProps> = ({
534d6b3:components/events/EventCancelModal.tsx:17:export const EventCancelModal: React.FC<EventCancelModalProps> = ({
534d6b3:lib/halls/hall.service.ts:3:import { FinancialCalculatorService } from '../payments/financial-calculator.service';
534d6b3:lib/payments/financial-calculator.service.ts:49:export class FinancialCalculatorService {
534d6b3:lib/payments/financial-calculator.service.ts:58:    public static calculateTicketingFinancials(params: {
534d6b3:lib/payments/financial-calculator.service.ts:96:    public static calculateOrderFinancials(params: {
534d6b3:tests/parcours/canaux-interface.test.ts:50:    'components/events/AdjustTicketQuotaModal.tsx': { why: 'code mort, conservé (L13)' },
534d6b3:tests/parcours/design-systeme.test.ts:961:    'components/events/AdjustTicketQuotaModal.tsx',
534d6b3:tests/parcours/design-systeme.test.ts:964:    'components/events/EventCancelModal.tsx',
534d6b3:tests/parcours/finance-moteur.test.ts:268:    { file: 'lib/partner/partner-dashboard.service.ts', pattern: /FinancialCalculatorService\.calculate/, what: 'recalcul avec les taux courants (L245, L255, L285)' },
534d6b3:tests/parcours/finance-moteur.test.ts:269:    { file: 'app/api/partner/finance/route.ts', pattern: /FinancialCalculatorService\.calculate/, what: 'recalcul avec les défauts 5 / 1,5 du calculateur (L97-110)' },
534d6b3:tests/parcours/finance-moteur.test.ts:270:    { file: 'app/api/partner/metrics/route.ts', pattern: /FinancialCalculatorService\.calculate/, what: 'recalcul avec ticketing_fee_config et les taux courants (L53, L97-107)' },
534d6b3:tests/parcours/finance-moteur.test.ts:271:    { file: 'lib/orders/order.service.ts', pattern: /FinancialCalculatorService\.calculate/, what: 'commission commande au taux par défaut de 5 % (L144)' },
534d6b3:tests/parcours/partenaire-liste.test.ts:36: *  - app/partner/events/[id]/page.tsx et app/admin/events/[id]/page.tsx absents ; EventCancelModal
534d6b3:tests/parcours/partenaire-liste.test.ts:37: *    (components/events/EventCancelModal.tsx) n'est importé nulle part et n'exige pas le titre.
```

Même recherche sur `HEAD`, code de production :

```text
$ git grep -n -E 'AdjustTicketQuotaModal|EventCancelModal\b|calculateTicketingFinancials|calculateOrderFinancials|FinancialCalculatorService' HEAD -- app components lib hooks scripts e2e
(aucune ligne)
```

```text
# run 110 (e6c23d1, « avant ») — tests/schema/code-mort-lot9.test.ts  [sous-tests retenus : /^PO10/]
not ok 1 - components/events/AdjustTicketQuotaModal.tsx n’existe plus
      error: components/events/AdjustTicketQuotaModal.tsx existe encore
        true !== false
not ok 2 - components/events/EventCancelModal.tsx n’existe plus
      error: components/events/EventCancelModal.tsx existe encore
        true !== false
not ok 3 - lib/payments/financial-calculator.service.ts n’existe plus
      error: lib/payments/financial-calculator.service.ts existe encore
        true !== false
not ok 4 - lib/halls/hall.service.ts n’importe plus le service de calcul
      error: import inerte :
        lib/halls/hall.service.ts:3 import { FinancialCalculatorService } from '../payments/financial-calculator.service';
not ok 5 - app, lib, components : aucune mention des composants et des calculs retirés
      error: mentions restantes :
        lib/halls/hall.service.ts:3 import { FinancialCalculatorService } from '../payments/financial-calculator.service';
# tests 11
# pass 0
# fail 11
# cancelled 0
# run 113 (d255bf3, « après ») — tests/schema/code-mort-lot9.test.ts  [sous-tests retenus : /^PO10/]
ok 1 - components/events/AdjustTicketQuotaModal.tsx n’existe plus
ok 2 - components/events/EventCancelModal.tsx n’existe plus
ok 3 - lib/payments/financial-calculator.service.ts n’existe plus
ok 4 - lib/halls/hall.service.ts n’importe plus le service de calcul
ok 5 - app, lib, components : aucune mention des composants et des calculs retirés
# tests 11
# pass 11
# fail 0
# cancelled 0
```

`canaux-interface` (T25) était annoncé vert à tort : `is_visible` restait lu par le modal mort, ce qui a été vu au run 110 (AM3).

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/canaux-interface.test.ts  [sous-tests retenus : /is_visible/]
not ok 4 - aucun is_visible lu hors de la liste blanche
      error: is_visible lu hors de la liste blanche, à passer à sale_online :
        components/events/AdjustTicketQuotaModal.tsx
# tests 16
# pass 15
# fail 1
# cancelled 0
# run 113 (d255bf3, « après ») — tests/parcours/canaux-interface.test.ts  [sous-tests retenus : /is_visible/]
ok 4 - aucun is_visible lu hors de la liste blanche
# … 4 autre(s) sous-test(s) réussi(s) dans ce filtre
# tests 16
# pass 16
# fail 0
# cancelled 0
```

**Correctif.**

```text
$ git show --numstat f1b4ed60
f1b4ed60 fix(9.4-PO10): lib/payments/financial-calculator.service.ts supprimé entier (section 5.5, L49, AM8) : plus aucun appelant, preuve par grep sur app, lib, components, hooks, scripts ; le dernie …
  +    0 -  188  lib/payments/financial-calculator.service.ts
$ git show --numstat 2423f393
2423f393 fix(9.4-PO10e): code mort supprimé (section 5.5, PO10, AM3) : components/events/AdjustTicketQuotaModal.tsx et EventCancelModal.tsx, importés nulle part. Fait passer au vert les 3 tests PO10 r …
  +    0 -  391  components/events/AdjustTicketQuotaModal.tsx
  +    0 -  198  components/events/EventCancelModal.tsx
```

#### A21 — Suites qui ne prouvaient rien

**Origine.** `discovery-9-nettoyage.md`, section 3 : 14 suites à la racine de `tests/`, six ne prouvaient rien (simulateur en mémoire, constantes, chaînes). Tableau complet en section 5 du rapport.

Les ports ont été écrits verts (annoncé au commit `79a817eb`) et vus verts au run 110 **avant** toute suppression :

```text
# run 110 (e6c23d1, « avant ») — tests/schema/validations-metier.test.ts
ok 1 - VerifyOtpSchema accepte un code à 6 chiffres, normalizePhoneNumber rend le E.164 sénégalais
ok 2 - VerifyOtpSchema refuse un code trop court
ok 3 - RegisterPartnerSchema exige les deux jetons de pièces et garde leurs valeurs
# … 7 autre(s) sous-test(s) réussi(s)
# tests 10
# pass 10
# fail 0
# cancelled 0
```

```text
# run 110 (e6c23d1, « avant ») — tests/security/r28-middleware-matrice.test.ts
ok 1 - pages publiques servies, pages protégées et /wallet renvoient vers /login?redirect=
ok 1 - CLIENT : pages publiques servies, espaces protégés selon la règle réelle
ok 2 - CLIENT : les pages d’authentification renvoient vers /
# … 8 autre(s) sous-test(s) réussi(s)
# tests 11
# pass 11
# fail 0
# cancelled 0
```

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/acces-limiteurs.test.ts  [sous-tests retenus : /retryAfterSeconds/]
ok 1 - 5 tentatives acceptées, la 6e refusée EXCEEDED avec retryAfterSeconds > 0 ; compteur en base (T15)
# tests 17
# pass 17
# fail 0
# cancelled 0
```

La suppression de `e2e-scenarios` a été **retardée** : l'agent a constaté que deux cas annoncés couverts par le tableau du contrat ne l'étaient pas (cas 6-7 : aucun test ne passait de corps multipart au webhook ; cas 15 : couverture partielle). Ils ont été portés d'abord (`ef209ead`), le fichier supprimé ensuite (`3ca034a4`).

```text
# run 113 (d255bf3, « après ») — tests/parcours/paiement-webhook.test.ts  [sous-tests retenus : /multipart/]
ok 10 - corps multipart : 200, received: true, REJECTED_INVALID_PAYLOAD « corps non form-urlencoded », aucun billet
# tests 10
# pass 10
# fail 0
# cancelled 0
```

```text
# run 113 (d255bf3, « après ») — tests/parcours/partenaire-lot7.test.ts  [sous-tests retenus : /Realtime/]
ok 1 - tableau de bord (app/partner/dashboard/page.tsx) : le code mentionne toujours Realtime ou connected
# tests 30
# pass 30
# fail 0
# cancelled 0
```

Preuve rejouée de l'absence des six suites :

```text
# run 110 (e6c23d1, « avant ») — tests/schema/code-mort-lot9.test.ts  [sous-tests retenus : /^A21/]
not ok 1 - tests/auth-rbac.test.ts n’existe plus (cas réels portés, tableau 5.5)
      error: tests/auth-rbac.test.ts existe encore (suppression en vague L, T33 à T35)
        true !== false
not ok 2 - tests/e2e-scenarios.test.ts n’existe plus (cas réels portés, tableau 5.5)
      error: tests/e2e-scenarios.test.ts existe encore (suppression en vague L, T33 à T35)
        true !== false
not ok 3 - tests/partner-auth-complete.test.ts n’existe plus (cas réels portés, tableau 5.5)
      error: tests/partner-auth-complete.test.ts existe encore (suppression en vague L, T33 à T35)
        true !== false
not ok 4 - tests/payment.test.ts n’existe plus (cas réels portés, tableau 5.5)
      error: tests/payment.test.ts existe encore (suppression en vague L, T33 à T35)
        true !== false
not ok 5 - tests/roles-isolation.test.ts n’existe plus (cas réels portés, tableau 5.5)
      error: tests/roles-isolation.test.ts existe encore (suppression en vague L, T33 à T35)
        true !== false
not ok 6 - tests/superadmin-complete.test.ts n’existe plus (cas réels portés, tableau 5.5)
      error: tests/superadmin-complete.test.ts existe encore (suppression en vague L, T33 à T35)
        true !== false
# tests 11
# pass 0
# fail 11
# cancelled 0
# run 113 (d255bf3, « après ») — tests/schema/code-mort-lot9.test.ts  [sous-tests retenus : /^A21/]
ok 1 - tests/auth-rbac.test.ts n’existe plus (cas réels portés, tableau 5.5)
ok 2 - tests/e2e-scenarios.test.ts n’existe plus (cas réels portés, tableau 5.5)
ok 3 - tests/partner-auth-complete.test.ts n’existe plus (cas réels portés, tableau 5.5)
ok 4 - tests/payment.test.ts n’existe plus (cas réels portés, tableau 5.5)
ok 5 - tests/roles-isolation.test.ts n’existe plus (cas réels portés, tableau 5.5)
ok 6 - tests/superadmin-complete.test.ts n’existe plus (cas réels portés, tableau 5.5)
# tests 11
# pass 11
# fail 0
# cancelled 0
```

**Correctif.** Ports, suppressions (cinq suites puis `e2e-scenarios`) :

```text
$ git show --numstat 79a817eb
79a817eb test(9.4-A21)[ports]: cas réels des suites racine portés avant leur suppression, verts dès l'écriture (annoncé). validations-metier (sans base) : VerifyOtpSchema, normalizePhoneNumber, Regist …
  +    1 -    1  tests/README.md
  +   21 -    0  tests/parcours/acces-limiteurs.test.ts
  +    1 -    1  tests/parcours/partenaire-lot7.test.ts
  +    1 -    1  tests/parcours/push-service-worker.test.ts
  +  118 -    0  tests/schema/validations-metier.test.ts
  +  149 -    0  tests/security/r28-middleware-matrice.test.ts
$ git show --numstat f1ff53d4
f1ff53d4 test(9.4-A21)[suppression]: T33 à T35, tableau 5.5, cinq suites supprimées (auth-rbac, partner-auth-complete, payment, roles-isolation, superadmin-complete), ports verts au run 110 (validatio …
  +    0 -  260  tests/auth-rbac.test.ts
  +    0 -  246  tests/partner-auth-complete.test.ts
  +    0 -  124  tests/payment.test.ts
  +    0 -  122  tests/roles-isolation.test.ts
  +    0 -  155  tests/superadmin-complete.test.ts
$ git show --numstat ef209ead
ef209ead test(9.4-A21)[webhook]: ports des deux cas de e2e-scenarios annoncés couverts à tort (section 5.5, f1ff53d4). Avant : aucun test ne passait de corps multipart à deliverWebhook, et paiement-we …
  +   25 -    0  tests/parcours/paiement-webhook.test.ts
  +    9 -    0  tests/parcours/partenaire-lot7.test.ts
$ git show --numstat 3ca034a4
3ca034a4 test(9.4-A21)[suppression]: e2e-scenarios supprimé, ses deux cas réels vus verts au run 111 (paiement-webhook multipart, partenaire-lot7 Realtime). hors-ligne-service-worker ne cite plus ce f …
  +    0 -  175  tests/e2e-scenarios.test.ts
  +    1 -    1  tests/parcours/hors-ligne-service-worker.test.ts
```

Non porté, par décision : le cas « partenaire `EN_ATTENTE` » d'`auth-rbac`, qui affirmait le contraire du comportement réel (AR14, point ouvert).

#### Captures

**Origine.** `discovery-9-nettoyage.md`, 4.1, sur les images du run 109. `cloche-ouverte` ordinateur : aucun masque de QR déclaré, et les masques des heures restaient à leur position hors du panneau. `billet-hors-ligne-*` mobile : le QR passait sous l'en-tête collant, le masque se dessinait dessus. Cause commune : un masque en surimpression ignore l'empilement et le découpage.

Run 110, rouge sur les huit captures attendues (`accueil` et les sept nouvelles), en deux thèmes et deux formats :

```text
$ grep -E '✘.*clair ·.*(accueil|mes-paiements|profil —|changement-numero|invitations)' S/run110/e2e.log
  ✘    1 [mobile] › e2e/captures.spec.ts:174:9 › clair · anonyme › accueil — Accueil (31.0s)
  ✘   19 [mobile] › e2e/captures.spec.ts:174:9 › clair · anonyme › accueil-populaires-erreur — Accueil — Populaires, état d’erreur (Réessayer) (15.6s)
  ✘   18 [mobile] › e2e/captures.spec.ts:174:9 › clair · anonyme › accueil-ville — Accueil — Près de chez vous, ville gardée sur l’appareil (30.7s)
  ✘   42 [mobile] › e2e/captures.spec.ts:174:9 › clair · client › mes-paiements — Mes paiements (date, événement, montant, opérateur, statut, totaux) (768ms)
  ✘   43 [mobile] › e2e/captures.spec.ts:174:9 › clair · client › profil — Profil du client (identité, photo, numéro) (15.9s)
  ✘   44 [mobile] › e2e/captures.spec.ts:174:9 › clair · client › changement-numero — Profil du client — changement de numéro (boîte ouverte) (18.6s)
  ✘   68 [mobile] › e2e/captures.spec.ts:174:9 › clair · organisateur › invitations-onglet — Pilotage — Invitations (catégorie, numéros, liste) (15.6s)
  ✘   69 [mobile] › e2e/captures.spec.ts:174:9 › clair · organisateur › invitations-confirmation — Pilotage — Invitations : confirmation de l’envoi (15.7s)
# … 8 autre(s) ligne(s)
```

```text
# S/run110/e2e.log, lignes 421 à 430
  1) [mobile] › e2e/captures.spec.ts:174:9 › clair · anonyme › accueil — Accueil ───────────────────

    Error: expect(locator).toBeVisible() failed

    Locator: getByRole('region', { name: /^populaires/i }).getByRole('link').first()
    Expected: visible
    Timeout: 30000ms
    Error: element(s) not found

    Call log:
```

```text
# S/run110/e2e.log, lignes 1789 à 1789
  32 failed
```

Run 113 :

```text
# S/run113/e2e.log, lignes 418 à 422
[e2e] index des captures : .e2e-captures/captures/index.txt (349 entrée(s), 0 en échec)

  39 skipped
  349 passed (16.4m)
[e2e] phase captures : OK en 985s
```

Les 39 cas ignorés sont les vues qu'un écran ne capture pas (`test.skip`, `e2e/captures.spec.ts:177`) ; le run 110 en comptait autant.

Les sept écrans nouveaux, quatre images chacun :

```text
$ ls S/run113/captures | grep -E '^(accueil-ville|accueil-populaires-erreur|mes-paiements|profil|changement-numero|invitations-onglet|invitations-confirmation)__'  (28 fichier(s))
accueil-populaires-erreur__mobile__clair.png
accueil-populaires-erreur__mobile__sombre.png
accueil-populaires-erreur__ordinateur__clair.png
accueil-populaires-erreur__ordinateur__sombre.png
accueil-ville__mobile__clair.png
accueil-ville__mobile__sombre.png
accueil-ville__ordinateur__clair.png
accueil-ville__ordinateur__sombre.png
changement-numero__mobile__clair.png
changement-numero__mobile__sombre.png
changement-numero__ordinateur__clair.png
changement-numero__ordinateur__sombre.png
invitations-confirmation__mobile__clair.png
invitations-confirmation__mobile__sombre.png
invitations-confirmation__ordinateur__clair.png
invitations-confirmation__ordinateur__sombre.png
invitations-onglet__mobile__clair.png
invitations-onglet__mobile__sombre.png
invitations-onglet__ordinateur__clair.png
invitations-onglet__ordinateur__sombre.png
mes-paiements__mobile__clair.png
mes-paiements__mobile__sombre.png
mes-paiements__ordinateur__clair.png
mes-paiements__ordinateur__sombre.png
profil__mobile__clair.png
profil__mobile__sombre.png
profil__ordinateur__clair.png
profil__ordinateur__sombre.png
```

**Correctif.** Masques en place par `style` au lieu de l'option `mask` de Playwright, QR d'entrée masqué globalement (L50), puis les captures et les corrections de la relecture :

```text
$ git show --numstat c85b74dd
c85b74dd test(e2e)[9]: captures du lot 9 et masques des QR (T26, T27). screens.ts : scanner-a-encaisser retirée (A16), accueil attend Populaires, sept captures ajoutées (invitations-onglet, invitation …
  +   16 -    1  e2e/captures.spec.ts
  +   82 -    4  e2e/support/screens.ts
$ git show --numstat a969a24b
a969a24b fix(9.x)[relecture]: relecture visuelle du run 111, 39 lignes relevées : 21 corrigées, 2 non réelles, 16 laissées (bilan S/lot9-releve.md). À CORRIGER 3 sur 3 : catalogue mobile avec ville, t …
  +    1 -    1  app/admin/finance/page.tsx
  +   57 -   37  app/explore/page.tsx
  +   12 -    2  app/profile/page.tsx
  +    1 -    1  app/profile/payments/page.tsx
  +    5 -    5  components/admin/RefundsToRetry.tsx
  +    2 -    1  components/events/EventCard.tsx
  +    3 -    2  components/events/EventTicketing.tsx
  +    2 -    1  components/events/HomeDiscovery.tsx
  +    1 -    1  components/notifications/NotificationBell.tsx
  +    1 -    1  components/partner/ClosingReportModal.tsx
  +   11 -    3  components/scan/CombatFlashOverlay.tsx
  +    5 -    1  components/scan/CounterSalePanel.tsx
  +   12 -   10  components/shifts/ShiftModals.tsx
  +    1 -    1  components/tickets/offline/OfflineStatusBadge.tsx
  +    2 -    2  components/ui/ScrollableTabs.tsx
  +    1 -    1  e2e/captures.spec.ts
  +    3 -    0  e2e/support/screens.ts
  +    3 -    2  playwright.config.ts
  (+ 4 trace(s) docs/lot9-logs/ non listée(s))
$ git show --numstat d255bf37
d255bf37 test(e2e)[9]: capture caisse-cloture-ecart et terrain 12 suivent le libellé « Écart constaté » de fix(9.x)[relecture], « par le serveur » était un mot technique montré au contrôleur. Motif ex …
  +    1 -    1  e2e/support/screens.ts
  +    1 -    1  e2e/terrain.spec.ts
```

**Preuve des masques : des images, pas un test.** La relecture du run 111 a été faite **par des agents**, pas par un humain (section 3) : 122 images relues, aucun BLOQUANT. Pour ce rapport, j'ai ouvert trois images du run 113 : `cloche-ouverte__ordinateur__clair` (pavés magenta dans le panneau, QR masqués, rien sur la carte « Festival Jazz » derrière), `billet-hors-ligne-disponible__mobile__clair` et `billet-hors-ligne-a-telecharger__mobile__sombre` (pavé coupé sous l'en-tête collant, cloche visible). Trois images, pas les 349 : le reste relève de la liste à faire relire par un humain, section 3.

Non prouvé : le QR réel sous le masque (seul un essai sur téléphone dit s'il se scanne), et le masquage des numéros dans l'historique des invitations, sous la ligne de flottaison sur les captures.

---

## 3. Captures : écrans capturés, relecture par agents, corrections

**Au run 113 : 353 captures sur 353, 0 en échec**, sur 98 écrans (`runs/113-42519327711/captures/index.txt` sur `ci-results`). Ces 353 se décomposent ainsi, d'après `e2e.log` : 349 cas de la phase `captures` (mobile et ordinateur), et les 4 vues `dev-paiements` de la phase `dev-page`. Les 39 cas ignorés de la phase `captures` sont des vues que leur écran ne prévoit pas. L'artefact contient 373 images : les 353 captures d'écran et les 20 captures des emails. En-tête de l'index, tel quel :

```text
# runs/113-42519327711/captures/index.txt:1-11
EVENT VILLAGE — CAPTURES D’ÉCRAN (lot 5, tâche 5.1 ; lot 6, tâche 6.12 ; lot 7, tâche 7.7)
généré le      : 2026-11-08T21:03:50.119Z
run CI         : 113-42519327711 (d255bf37d3bfda64f96967553cab705c407a6012)
format         : <écran>__<mobile|ordinateur>__<clair|sombre>.png — mobile 390×844 DPR 2, ordinateur 1440×900 DPR 1
captures       : 353 / 353 tentative(s)
en échec       : 0 (contrôles bloquants ou erreur)
avertissements : 337 capture(s) concernée(s) (lot 7 : cibles < 44 px, textes < 14 px hors exemption et axe-core sont bloquants)
emails         : captures email-<id>__<390|600>__<clair|sombre>.png et résumé emails.txt (projet emails, tâche 7.9)
textes < 14 px : 0 hors exemption au total (détail sous chaque capture ; tableau : avertissements.tsv)
préchargements : 200 préchargement(s) Next abandonné(s), non bloquants, listés sous chaque capture (network.ts, lot 6)
Relecture humaine obligatoire : un écran n’est terminé qu’une fois sa capture relue (rapport du lot, section 3).
```

La dernière ligne de cet en-tête est le texte fixe du gabarit depuis le lot 5. **Au lot 9, aucune capture n'a été relue par un humain.** La relecture a été faite par des agents (L52), et c'est ainsi qu'elle est présentée ci-dessous. La relecture à l'œil reste à faire par vous, liste en 3.5.

**D'où viennent les 353 captures.** Le lot 8 finissait à 327 captures sur 92 écrans. Le lot 9 ajoute 7 écrans, soit 28 captures, et en retire un, soit 2 captures. 327 + 28 − 2 = 353. Décompte refait sur les noms de fichiers du run 105 (`scratchpad/cap105`) et du run 113, aucun écran existant ne change de nombre de vues.

| Écran nouveau | Vues | Consigne |
|---|---|---|
| `invitations-onglet` | 4 | 9.4, invitations |
| `invitations-confirmation` | 4 | 9.4, invitations |
| `mes-paiements` | 4 | 9.4, Mes paiements |
| `profil` | 4 | 9.4, profil |
| `changement-numero` | 4 | 9.4, changement de numéro |
| `accueil-ville` | 4 | 9.4, ville |
| `accueil-populaires-erreur` | 4 | 9.4, populaires (la section Populaires chargée, elle, est sur `accueil`, qui attend désormais qu'elle soit affichée) |

Écran retiré : `scanner-a-encaisser` (2 vues), conséquence d'A16.

Captures ajoutées et masques posés par `c85b74dd`, `test(e2e)[9]`.

### 3.1 Relecture par agents, captures du run 111

Deux agents lecteurs ont relu les images du run 111 (`3c83ab1`), un par groupe ; un agent correcteur a ensuite vérifié chaque constat dans le code avant de corriger (commit `a969a24b`). Relevés dans le scratchpad : `lot9-releve-client.md`, `lot9-releve-pro.md`, bilan `lot9-releve.md`.

- groupe client : 14 écrans, 56 images ouvertes une à une ;
- groupe pro : 18 écrans, 60 images, plus 6 images de masques déjà comprises dans le groupe client.

**116 images distinctes sur 353 ont donc été relues**, soit les écrans nouveaux et une partie des écrans modifiés. Les 237 autres n'ont été ouvertes par aucun agent au lot 9. Les captures s'arrêtent à la hauteur d'écran (390×844 ou 1440×900) : ce qui est sous la ligne de flottaison n'a pas été vu.

**Décompte du bilan**, recopié et recoupé sur son tableau : 39 lignes de relevé (la ligne « billet hors ligne, ce téléphone » du bilan en regroupe deux du relevé client).

| Gravité | Corrigé | Non réel | Laissé | Total |
|---|---|---|---|---|
| BLOQUANT | 0 | 0 | 0 | 0 |
| À CORRIGER | 3 | 0 | 0 | 3 |
| MINEUR | 18 (dont 1 en partie) | 2 | 16 | 36 |
| Total | 21 | 2 | 16 | 39 |

Une ligne « corrigé » du bilan ne l'est pas : les dates de `partenaire-categorie-*`, marquée « corrigé, à confirmer au run », est infirmée par le run 113 (3.4). Il reste donc 2 À CORRIGER corrigés sur 3.

Les 16 lignes laissées sont au bilan (`lot9-releve.md`, tableaux « Groupe client » et « Groupe pro ») avec leur raison. La plus importante : la barre latérale coupe le bloc utilisateur à 900 px de haut, le correctif (+22 octets sur `/`) a été écrit puis retiré à cause du budget JS.

**Écrans sans défaut d'après le bilan** : `accueil-acces-refuse`, `changement-numero`, `paiement-attente`, `paiement-succes`, `accueil` (hors cloche et noms de menu) ; `invitations-onglet`, `invitations-confirmation`, `pilotage-ventes`, `pilotage-caisse`, `pilotage-apercu`, `pilotage-cloture`, `scanner-saisie-manuelle` (hors lignes transversales).

### 3.2 Ce qui a été revu au run 113

Le bilan le dit lui-même : « Aucun de ces correctifs n'a été vu rendu. » **Aucun agent n'a refait de relecture complète sur les images du run 113.** L'agent qui rédige cette partie a ouvert onze images du run 113, pas davantage :

| Image du run 113 | Lu sur l'image |
|---|---|
| `cloche-ouverte__ordinateur__clair.png` | Pavés magenta sur l'heure de chaque notification, dans leur ligne ; deux pavés sur les QR au bas des deux cartes de billet ; aucun vrai QR visible |
| `cloche-ouverte__ordinateur__sombre.png` | Idem |
| `billet-hors-ligne-disponible__mobile__clair.png` | Le pavé magenta s'arrête net sous l'en-tête, l'en-tête n'est pas recouvert ; « Disponible hors ligne » |
| `billet-hors-ligne-a-telecharger__mobile__sombre.png` | Idem ; « Enregistrement du billet sur ce téléphone… » |
| `partenaire-categorie-canaux__mobile__clair.png` | « Fin de la vente » : `mm/dd/yyyy, --:-- --`, voir 3.4 |
| `partenaire-categorie-invitations__ordinateur__clair.png` | « Début de la vente » : `10/27/2026, 08:38 PM` ; « Fin de la vente » : `mm/dd/yyyy, --:-- --` ; aide AM6 mot pour mot |
| `catalogue__mobile__clair.png` | Recherche, bouton « Filtres et tri », « 11 événements », première carte visible dans l'écran : le À CORRIGER est levé |
| `caisse-cloture-ecart__mobile__sombre.png` | Bandeau « Écart constaté » ; 10 000, 55 000, 65 000 attendus, 53000 comptés, « Écart de -2 000 F CFA » ; « Clôturer avec l'écart » et « Annuler » dans le pied fixe ; le PIN reste hors de la vue |
| `invitations-confirmation__ordinateur__clair.png` | Numéro « +221***67 », récapitulatif catégorie, billets par numéro, billets au total |
| `profil__mobile__clair.png` | « +221 70 000 01 05 », icône devant « Compte actif », initiales « FM » |
| `accueil-populaires-erreur__mobile__clair.png` | Le faux 500 porte le texte de la route : « Populaires momentanément indisponibles. », titre « Impossible d'afficher les événements populaires », bouton « Réessayer » |

Les autres corrections du bilan n'ont pas été rouvertes au run 113 : NON VÉRIFIÉ. Sont dans ce cas : `accueil-ville` (ville avant le lieu, carrousels jusqu'au bord), `mes-paiements` (doublon), `billet-hors-ligne-*` à l'ordinateur (heure insécable), `cloche-ouverte` mobile (`line-clamp-3`), onglets mobiles (dégradé sous le chevron), `scanner-guichet`, `scanner-accepte`, `-refuse` et `-non-traite`, `partenaire-rapport-cloture`, `admin-remboursements-a-reprendre`.

Le contrôle des masques exigé par la consigne 9.4 repose donc sur les relectures d'agents du run 111 (client et pro concordants : masque en place, aucun vrai QR visible, en-tête non recouvert) et sur les quatre images ci-dessus du run 113. Les masques sont posés par `style`, jamais par l'option `mask` (L50). Ils n'ont pas été comparés image par image, et la capture ne couvre que la hauteur d'écran : à confirmer à l'œil (3.5).

### 3.3 Écrans existants dont l'aspect change au lot 9

Liste établie depuis les commits et le bilan. Les écrans nouveaux sont au tableau ci-dessus.

| Écran | Ce qui change | Source |
|---|---|---|
| `accueil` | sections Populaires et Près de chez vous ; recherche et ville par le serveur | `b5e8f324`, `d992ef28` |
| `catalogue` | recherche par le serveur ; sur mobile, ville, tri et catégories repliés sous « Filtres et tri » | `b5e8f324`, `a969a24b` |
| `partenaire-categorie-invitations`, `-canaux` | aide de la catégorie sans canal (AM6) ; « Vente fermée » | `c5c6d5d2`, `a969a24b` |
| `pilotage-*` | onglet Invitations ; plus d'encaissement à l'entrée (A16), carte d'entrées à 3 colonnes à partir de `xl` | `fb78ba7d`, `80df7153` |
| `scanner-*` (plein écran) | plus d'état à encaisser ; numéro insécable, `text-balance` | `80df7153`, `a969a24b` |
| `caisse-cloture-ecart` | « Écart constaté » ; pied fixe, unité insécable | `a969a24b`, `d255bf37` |
| `billet-hors-ligne-*`, `cloche-ouverte`, `mes-billets` | masques des QR recalés ; heure insécable ; résumé sur trois lignes | `c85b74dd`, `a969a24b` |
| en-tête, barre latérale (tous les écrans connectés) | photo de profil, repli sur les initiales ; le lien Journal d'audit disparaît pour un ADMIN qui n'est pas SUPERADMIN (AR10) | `8d55067f`, `f42d687a` |
| `partenaire-rapport-cloture` | « Rapport de clôture » ; pied en pleine largeur sur mobile | `62be3f26`, `a969a24b` |
| `admin-*` (audit, remboursements, finance) | colonne Utilisateur nom et rôle ; badge ; « Contrôle automatique » | `ee9b0966`, `a969a24b` |

### 3.4 Format de date américain des champs `datetime-local` (écart documenté, encore là)

Le lot 8 l'avait documenté (`docs/lot8-rapport.md`, section 3.4). La relecture du run 111 l'a classé À CORRIGER et le correcteur a ajouté `--lang=fr-FR` aux projets de capture (`a969a24b`, `playwright.config.ts:37`), en précisant « non prouvé sous Linux ».

**Le run 113 l'infirme.** Sous le Chromium Linux de la CI, malgré `--lang=fr-FR` et le drapeau `LangAttributeAwareFormControlUI` du lot 8, les champs `datetime-local` de `partenaire-categorie-canaux` et `partenaire-categorie-invitations` restent en format américain : `mm/dd/yyyy, --:-- --`, et rempli `10/27/2026, 08:38 PM` (deux images ouvertes, 3.2). Les 8 images sont concernées d'après le relevé du run 111 ; au run 113, j'en ai ouvert 2.

- Sous Windows, le correcteur a sondé par CDP, sur Chromium 156 : `--lang=en-US` donne `10/27/2026 06:59 PM`, `--lang=de-DE` `27.10.2026 18:59`, `--lang=fr-FR` `27/10/2026 18:59`. L'écart n'est donc vu qu'en CI, sous Linux. Pourquoi : NON ÉTABLI.
- Le contrôle automatique (`expectFrenchDateField`) ne lit que le premier `input[type="date"]` de `admin-notifications`, il ne voit pas ces champs (constat du lot 8, section 3.4, non rouvert).
- **Écart gardé** : c'est un champ natif ; un navigateur réglé en anglais affichera de toute façon son format (L66), et un composant de saisie maison coûterait le sélecteur natif du téléphone.
- **Ce que cela veut dire pour le client** : ces 8 captures ne montrent pas ce que verra un partenaire dont le téléphone est en français. À expliquer si elles sont montrées.

### 3.5 LISTE À PART : images à faire relire par un humain

Liste reprise du bilan (`lot9-releve.md`, « À faire relire par un humain ») et de la section 7 du contrat. Les noms sont ceux du run 113.

**Billets et masques**
- `cloche-ouverte__ordinateur__clair.png`, `cloche-ouverte__ordinateur__sombre.png`, et les vues mobiles de `cloche-ouverte` : confirmer le masque à l'œil. La capture ne couvre que la hauteur d'écran.
- `billet-hors-ligne-disponible__mobile__clair.png`, `__sombre.png`, `billet-hors-ligne-a-telecharger__mobile__clair.png`, `__sombre.png`, `billet-hors-ligne-qr__*` : le QR réel est sous le masque, seul un essai sur téléphone dit s'il se scanne, surtout en sombre.
- `mes-billets__*` (nouveau masque, section 7 du contrat) : **aucun agent ne l'a relue au lot 9**.
- Billets : « PDF » côtoie « Une capture d'écran n'est pas acceptée au contrôle ». À confirmer : ce que le PDF permet à l'entrée.

**Découverte**
- `catalogue__mobile__clair.png`, `__sombre.png` : nouvelle mise en page à juger, ville et catégories derrière « Filtres et tri ». Le relevé en faisait une décision de produit.
- `accueil-populaires-erreur__*` : le texte est désormais celui de la route, la capture reste simulée.
- `accueil-ville__*` : les 2 couvertures rayées, données de test ou image de repli.

**Compte**
- `profil__*` : seul l'état à initiales est capturé, aucune vraie photo.
- `changement-numero__*` : seule l'étape 1 est capturée (code, erreur, réussite non vus) ; goût du fond flouté.
- `mes-paiements__*` : « Total payé 56 175 F CFA » porte sur toutes les pages, non vérifiable avec les lignes visibles.

**Organisateur**
- `invitations-onglet__*` (4 images) : aucune ligne d'historique visible. Le masquage des numéros dans la liste n'est pas prouvé par ces images. Regarder une liste réelle après un envoi.
- `invitations-confirmation__*` (4 images) : le numéro est masqué au moment de confirmer l'envoi, l'organisateur ne peut pas vérifier ce qu'il a tapé. Choix de produit ; à voir avec plusieurs numéros.
- `pilotage-entrees__*` (4 images) : cartes à trois colonnes sur ordinateur, « Refus » seul sur sa ligne sur mobile, double soulignement.
- `partenaire-categorie-canaux__*`, `partenaire-categorie-invitations__*` (8 images) : champ de date sur un vrai navigateur français et sur un téléphone réglé en anglais (3.4).
- `partenaire-rapport-cloture__*` : le bas du rapport et le PDF téléchargé ne figurent sur aucune capture.

**Terrain**
- `scanner-accepte__*`, `scanner-refuse__*`, `scanner-non-traite__*` (6 images) : lisibilité à la porte, de nuit et en plein soleil.
- `caisse-cloture-ecart__mobile__sombre.png` : parcours jusqu'au PIN et à la validation, clavier ouvert, avec le nouveau pied fixe.

**Images à ne pas remettre au client en l'état** : les 8 `partenaire-categorie-*` (format américain, 3.4) ; `accueil-populaires-erreur__*` (panne simulée) ; `dev-paiements__*` (rendu statique, police de repli, constat du lot 8 non rouvert) ; `accueil-ville__*` (données de recette visibles, « TEST Spectacle B », relevé client du run 111, non corrigeable depuis l'écran).

### 3.6 Avertissements et contrôles bloquants au run 113

Décompte refait sur `avertissements.tsv` du run 113 (353 lignes) : résultat `OK` pour 353 captures ; cibles < 44 px : 0 ; textes < 14 px hors exemption : 0 ; règles axe-core en défaut : 0 ; préchargements Next abandonnés (non bloquants) : 200.

---

---

## 4. Requêtes des invariants et leur sortie

**(a) à (s).** Requêtes des lots 2 à 8, inchangées. Aucun des fichiers qui les portent n'a changé au lot 9 (`access-invariants.ts`, `finance-invariants.ts`, `lifecycle-invariants.ts`, `notification-invariants.ts`, `payment-invariants.ts`, `recette-invariants.ts`, `terrain-invariants.ts`) : `git diff --stat 534d6b3..HEAD -- tests/helpers/` ne cite que `design-files.ts` et `lot9-invariants.ts`. Elles sont recopiées dans `docs/lot6-rapport.md`, `docs/lot7-rapport.md` et `docs/lot8-rapport.md`, section 4 de chacun.

**(t), première partie.** Requête du lot 8, inchangée (`tests/helpers/recette-invariants.ts:81-104`) :

```sql
t AS (SELECT * FROM public.tickets),
t0 AS (
    SELECT 't'::text, t.id::text, 'billet sans décision de vente' FROM t WHERE t.sale_decision->>'source' = 'SANS_DECISION'
),
t1 AS (
    SELECT 't', t.id::text, 'billet ' || t.sale_channel || ' d''une catégorie non vendue en ligne au moment de l''achat'
      FROM t WHERE t.sale_channel IN ('ONLINE', 'FREE') AND t.sale_decision->>'source' <> 'REPRISE'
       AND COALESCE((t.sale_decision->>'sale_online')::boolean, FALSE) IS NOT TRUE
),
t2 AS (
    SELECT 't', t.id::text, 'billet COUNTER d''une catégorie non vendue au guichet au moment de la vente'
      FROM t WHERE t.sale_channel = 'COUNTER' AND t.sale_decision->>'source' <> 'REPRISE'
       AND COALESCE((t.sale_decision->>'sale_counter')::boolean, FALSE) IS NOT TRUE
),
t3 AS (
    SELECT 't', c.id::text, 'is_visible et sale_online divergent'
      FROM public.ticket_categories c WHERE c.is_visible IS DISTINCT FROM c.sale_online
),
t4 AS (
    SELECT 't', t.id::text, 'billet payé en ligne dont la décision ne vient pas de sa réservation'
      FROM t JOIN public.stock_reservations r ON r.payment_id = t.payment_id AND r.category_id = t.category_id
     WHERE t.sale_channel = 'ONLINE' AND t.sale_decision->>'source' <> 'REPRISE'
       AND (t.sale_decision->>'sale_online')::boolean IS DISTINCT FROM r.sale_online_at_checkout
)
```

**(t) étendu, (u), (v).** Requête du lot 9, `tests/helpers/lot9-invariants.ts:30-84`, identique au contrat 6.3. Elle est exécutée en lecture seule (transaction READ ONLY) sur toute la base locale, après (a) à (t) par `assertRecetteInvariants` et après un contrôle du schéma qui nomme chaque objet absent (`missingLot9Schema`). Le fichier la porte dans un gabarit JavaScript, les deux `\\` y sont donc doublés ; recopiée ici avec un seul.

```sql
WITH t AS (SELECT * FROM public.tickets),
t5 AS (SELECT 't'::text AS regle, id::text AS objet, 'billet INVITATION dont la décision ne vient pas d''une invitation' AS detail
         FROM t WHERE sale_channel = 'INVITATION' AND sale_decision->>'source' NOT IN ('INVITATION', 'REPRISE')),
t6 AS (SELECT 't', id::text, 'décision INVITATION sur un billet ' || sale_channel
         FROM t WHERE sale_decision->>'source' = 'INVITATION' AND sale_channel IS DISTINCT FROM 'INVITATION'),
u1 AS (SELECT 'u', id::text, format('invitation à %s F ou rattachée à un paiement', price)
         FROM t WHERE sale_channel = 'INVITATION' AND (price <> 0 OR payment_id IS NOT NULL)),
u2 AS (SELECT 'u', t.id::text, 'invitation sans porteur, sans transfert en attente ou échu'
         FROM t WHERE sale_channel = 'INVITATION' AND user_id IS NULL AND status = 'VALIDE'
          AND NOT EXISTS (SELECT 1 FROM public.ticket_transfers x WHERE x.ticket_id = t.id AND x.status IN ('PENDING', 'EXPIRED'))),
u3 AS (SELECT 'u', t.id::text, 'billet sans porteur en attente de réclamation, non verrouillé'
         FROM t WHERE user_id IS NULL AND NOT transfer_locked
          AND EXISTS (SELECT 1 FROM public.ticket_transfers x WHERE x.ticket_id = t.id AND x.status = 'PENDING')),
u4 AS (SELECT 'u', x.id::text, 'transfert sans expéditeur sur un billet ' || t.sale_channel
         FROM public.ticket_transfers x JOIN t ON t.id = x.ticket_id
        WHERE x.from_user_id IS NULL AND t.sale_channel IS DISTINCT FROM 'INVITATION'),
journal AS (
    SELECT id, action, user_id, metadata,
           regexp_replace(COALESCE(old_value::text, '') || COALESCE(new_value::text, '') || metadata::text,
                          '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '', 'gi') AS texte
      FROM public.audit_logs
     WHERE action IN ('TICKET_INVITATIONS_SENT', 'TICKET_INVITATION_CANCELLED', 'ACCOUNT_PHONE_CHANGED', 'ACCOUNT_PROFILE_UPDATED')
),
u5 AS (SELECT 'u', id::text, action || ' : numéro en clair au journal'
         FROM journal WHERE texte ~ '(^|[^0-9])(\+?221)?7[05678][0-9]{7}([^0-9]|$)'),
invit AS (SELECT category_id, count(*) AS n FROM t WHERE sale_channel = 'INVITATION' AND status IN ('VALIDE', 'UTILISE') GROUP BY 1),
u6 AS (SELECT 'u', c.id::text, format('%s invitations actives pour %s vendus', i.n, c.sold_quantity)
         FROM public.ticket_categories c JOIN invit i ON i.category_id = c.id
        WHERE i.n > c.sold_quantity
          AND c.id IN (SELECT (metadata->>'category_id')::uuid FROM journal WHERE action = 'TICKET_INVITATIONS_SENT')),
av AS (SELECT name, split_part(name, '/', 1) AS dossier FROM storage.objects WHERE bucket_id = 'avatars'),
v1 AS (SELECT 'v', u.id::text, 'photo hors du dossier du compte, ou objet absent'
         FROM public.users u
        WHERE u.avatar_url LIKE '%/storage/v1/object/public/avatars/%'
          AND NOT EXISTS (SELECT 1 FROM av WHERE av.name = substring(u.avatar_url from '/object/public/avatars/(.+)$') AND av.dossier = u.id::text)),
v2 AS (SELECT 'v', name, 'nom d''objet hors du format <user_id>/<uuid>.webp, ou dossier sans compte'
         FROM av WHERE name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
            OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id::text = av.dossier)),
v3 AS (SELECT 'v', dossier, 'plusieurs photos pour un compte (' || count(*) || ')' FROM av GROUP BY dossier HAVING count(*) > 1),
changes AS (SELECT DISTINCT user_id FROM journal WHERE action = 'ACCOUNT_PHONE_CHANGED' AND user_id IS NOT NULL),
v4 AS (SELECT 'v', u.id::text, 'numéro différent entre le profil et l''authentification après un changement'
         FROM changes c JOIN public.users u ON u.id = c.user_id JOIN auth.users a ON a.id = u.id
        WHERE regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g') <> COALESCE(a.phone, '')),
v5 AS (SELECT 'v', j.id::text, 'changement de numéro sans SMS à l''ancien numéro'
         FROM journal j
        WHERE j.action = 'ACCOUNT_PHONE_CHANGED' AND COALESCE((j.metadata->>'sms_queued')::boolean, TRUE)
          AND NOT EXISTS (SELECT 1 FROM public.notification_outbox o
                           WHERE o.type = 'PHONE_CHANGED' AND o.idempotency_key LIKE 'PHONE_CHANGED:' || j.user_id::text || ':%')),
v6 AS (SELECT 'v', u.id::text, 'email différent entre le profil et l''authentification'
         FROM (SELECT DISTINCT user_id FROM journal WHERE action IN ('ACCOUNT_PHONE_CHANGED', 'ACCOUNT_PROFILE_UPDATED')) c
         JOIN public.users u ON u.id = c.user_id JOIN auth.users a ON a.id = u.id
        WHERE lower(COALESCE(u.email, '')) <> lower(COALESCE(a.email, '')))
SELECT * FROM t5 UNION ALL SELECT * FROM t6 UNION ALL SELECT * FROM u1 UNION ALL SELECT * FROM u2 UNION ALL SELECT * FROM u3
UNION ALL SELECT * FROM u4 UNION ALL SELECT * FROM u5 UNION ALL SELECT * FROM u6 UNION ALL SELECT * FROM v1 UNION ALL SELECT * FROM v2
UNION ALL SELECT * FROM v3 UNION ALL SELECT * FROM v4 UNION ALL SELECT * FROM v5 UNION ALL SELECT * FROM v6 ORDER BY 1, 2
```

**Règles fabriquées.** `tests/parcours/lot9-invariant.test.ts`, chaque règle prouvée par une violation fabriquée en transaction annulée, avec un témoin conforme :

```text
# run 113 (d255bf3) — runs/113-42519327711/test-logs/tests__parcours__lot9-invariant.test.ts.log
    ok 1 - RPC ticket_invitation_create : présent, puis retiré dans une transaction annulée, la garde le nomme
    ok 2 - RPC account_phone_finalize : présent, puis retiré dans une transaction annulée, la garde le nomme
    ok 3 - contrainte tickets_holder_or_counter : présent, puis retiré dans une transaction annulée, la garde le nomme
    ok 4 - ticket_transfers.from_user_id nullable : présent, puis retiré dans une transaction annulée, la garde le nomme
    ok 5 - tickets_sale_decision_set sans INVITATION : présent, puis retiré dans une transaction annulée, la garde le nomme
    ok 6 - type INVITATION_RECEIVED au registre : présent, puis retiré dans une transaction annulée, la garde le nomme
    ok 7 - type PHONE_CHANGED au registre : présent, puis retiré dans une transaction annulée, la garde le nomme
    ok 8 - bucket avatars public : présent, puis retiré dans une transaction annulée, la garde le nomme
ok 1 - Lot 9, garde de schéma : chaque objet retiré est nommé, jamais un faux vert
    ok 1 - t5 : billet INVITATION dont la décision ne vient pas d'une invitation ; témoins : décisions INVITATION et REPRISE
    ok 2 - t6 : décision INVITATION sur un billet ONLINE, puis COUNTER ; témoin : billet INVITATION
ok 2 - Lot 9 Invariant (t) : la décision de vente d'une invitation
    ok 1 - u1 : invitation à prix non nul, ou rattachée à un paiement ; témoin : gratuite sans paiement
    ok 2 - u2 : invitation sans porteur et sans transfert ; témoins : transfert en attente, échu, billet annulé, billet avec porteur
    ok 3 - u3 : billet sans porteur en attente, non verrouillé ; témoin : verrouillé
    ok 4 - u4 : transfert sans expéditeur sur un billet ONLINE ; témoins : billet INVITATION, transfert avec expéditeur
    ok 5 - u5 : numéro en clair dans chaque action du journal, puis dans old_value et new_value ; témoins : numéro masqué, UUID à 9 chiffres
    ok 6 - u6 : plus d'invitations actives que de vendus sur une catégorie passée par la RPC ; témoins : égalité, billet annulé, catégorie hors RPC
ok 3 - Lot 9 Invariant (u) : invitations
    ok 1 - v1 : photo sans objet, puis dans le dossier d'un autre compte ; témoins : photo du compte, URL extérieure
    ok 2 - v2 : nom hors format, puis dossier sans compte ; témoin : nom conforme
    ok 3 - v3 : deux photos pour un compte ; témoin : une seule photo
    ok 4 - v4 : numéro du profil différent de l'authentification après un changement ; témoin : numéros identiques, formes réelles
    ok 5 - v5 : changement sans SMS ; clé absente comptée comme un SMS attendu ; témoins : SMS en file, sms_queued faux
    ok 6 - v6 : email du profil différent de l'authentification, après un profil ou un numéro ; témoins : même email en casse différente, compte sans changement
ok 4 - Lot 9 Invariant (v) : compte
    ok 1 - schéma du lot présent ; après ROLLBACK, aucune ligne fabriquée ne reste et les triggers sont actifs
ok 5 - Lot 9 Invariant sur l'état réel
# tests 23
# pass 23
# fail 0
# cancelled 0
```

Avant le correctif, au run 110, la garde de schéma nommait les 8 objets absents, et toutes les suites du lot échouaient dessus :

```text
# run 110 (e6c23d1) — docs/lot9-logs/ci-run110-verify.log:3485-3492, 74 lignes « schéma du lot 9 incomplet » dans ce journal (suites du lot, sans correctif)
[INVARIANT-LOT9] admin-audit-lot9 — schéma du lot 9 incomplet : 8 objet(s) manquant(s)
[INVARIANT-LOT9]   fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
[INVARIANT-LOT9]   fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
[INVARIANT-LOT9]   contrainte public.tickets.tickets_holder_or_counter n'admet pas le canal INVITATION — migration 20261108000002_lot9_invitations (contrat 6.2)
[INVARIANT-LOT9]   colonne public.ticket_transfers.from_user_id encore NOT NULL — expéditeur NULL d'une invitation en attente, migration 20261108000002_lot9_invitations (contrat 6.2)
[INVARIANT-LOT9]   fonction public.tickets_sale_decision_set ne connaît pas le canal 'INVITATION' — migration 20261108000002_lot9_invitations (contrat 6.2)
[INVARIANT-LOT9]   type INVITATION_RECEIVED absent de public.notification_types — migration 20261108000002_lot9_invitations (contrat 6.2)
[INVARIANT-LOT9]   type PHONE_CHANGED absent de public.notification_types — migration 20261108000004_lot9_compte (contrat 6.2)
```

**Sortie `[INVARIANT-LOT9]` au run 113, brute.** Une ligne par suite qui écrit (`assertLot9Invariants`), une par acte de la recette, une pour le seed de démonstration.

```text
# run 113 (d255bf3) — docs/lot9-logs/ci-run113-verify.log
1822: [INVARIANT-LOT9] admin-audit-lot9 — (t)(u)(v) : 0 violation(s)
3268: [INVARIANT-LOT9] cloture-vocabulaire — (t)(u)(v) : 0 violation(s)
3746: [INVARIANT-LOT9] compte-numero — (t)(u)(v) : 0 violation(s)
3977: [INVARIANT-LOT9] compte-paiements — (t)(u)(v) : 0 violation(s)
4301: [INVARIANT-LOT9] compte-photo — (t)(u)(v) : 0 violation(s)
4544: [INVARIANT-LOT9] compte-profil — (t)(u)(v) : 0 violation(s)
5001: [INVARIANT-LOT9] course-verrous-lot9 — (t)(u)(v) : 0 violation(s)
6033: [INVARIANT-LOT9] decouverte-populaires — (t)(u)(v) : 0 violation(s)
6128: [INVARIANT-LOT9] decouverte-recherche-lot9 — (t)(u)(v) : 0 violation(s)
6389: [INVARIANT-LOT9] decouverte-ville — (t)(u)(v) : 0 violation(s)
10138: [INVARIANT-LOT9] ecritures-ignorees — (t)(u)(v) : 0 violation(s)
13266: [INVARIANT-LOT9] invitations-annulation — (t)(u)(v) : 0 violation(s)
13329: [INVARIANT-LOT9] invitations-course — (t)(u)(v) : 0 violation(s)
13404: [INVARIANT-LOT9] invitations-quotas — (t)(u)(v) : 0 violation(s)
13492: [INVARIANT-LOT9] invitations-reclamation — (t)(u)(v) : 0 violation(s)
13755: [INVARIANT-LOT9] invitations — (t)(u)(v) : 0 violation(s)
13911: [INVARIANT-LOT9] lectures-ignorees — (t)(u)(v) : 0 violation(s)
14311: [INVARIANT-LOT9] lot9-invariant — (t)(u)(v) : 0 violation(s)
14555: [INVARIANT-LOT9] nettoyage-sur-place — (t)(u)(v) : 0 violation(s)
18330: [INVARIANT-LOT9] pannes-absences — (t)(u)(v) : 0 violation(s)
18410: [INVARIANT-LOT9] parrainage-boucle-update — (t)(u)(v) : 0 violation(s)
25533: [INVARIANT-LOT9] migration-lot9-rejouable — (t)(u)(v) : 0 violation(s)
27354: [INVARIANT-LOT9] r27-avatars — (t)(u)(v) : 0 violation(s)
# docs/lot9-logs/ci-run113-e2e.log
784: [INVARIANT-LOT9] recette-client — (t)(u)(v) : 0 violation(s)
798: [INVARIANT-LOT9] recette-controleur — (t)(u)(v) : 0 violation(s)
812: [INVARIANT-LOT9] recette-partenaire — (t)(u)(v) : 0 violation(s)
829: [INVARIANT-LOT9] recette-invitation — (t)(u)(v) : 0 violation(s)
843: [INVARIANT-LOT9] recette-admin — (t)(u)(v) : 0 violation(s)
# runs/113-42519327711/e2e-seed.log
239: [INVARIANT-LOT9] seed-demo — (t)(u)(v) : 0 violation(s)
```

Les lignes « schéma du lot 9 incomplet » du journal ne concernent que `lot9-invariant.test.ts`, qui retire chaque objet dans une transaction annulée et vérifie que la garde le nomme (`ok 1` à `ok 8` ci-dessus). Telles quelles :

```text
# run 113 — docs/lot9-logs/ci-run113-verify.log:14095-14169, lignes [INVARIANT-LOT9] de la suite lot9-invariant seulement
14095: [INVARIANT-LOT9] lot9-invariant garde — schéma du lot 9 incomplet : 1 objet(s) manquant(s)
14096: [INVARIANT-LOT9]   fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
14097: [INVARIANT-LOT9] lot9Violations — schéma du lot 9 incomplet : 1 objet(s) manquant(s)
14098: [INVARIANT-LOT9]   fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
14106: [INVARIANT-LOT9] lot9-invariant garde — schéma du lot 9 incomplet : 1 objet(s) manquant(s)
14107: [INVARIANT-LOT9]   fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
14108: [INVARIANT-LOT9] lot9Violations — schéma du lot 9 incomplet : 1 objet(s) manquant(s)
14109: [INVARIANT-LOT9]   fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
14116: [INVARIANT-LOT9] lot9-invariant garde — schéma du lot 9 incomplet : 1 objet(s) manquant(s)
14117: [INVARIANT-LOT9]   contrainte public.tickets.tickets_holder_or_counter absente — migration 20261108000002_lot9_invitations (contrat 6.2)
14118: [INVARIANT-LOT9] lot9Violations — schéma du lot 9 incomplet : 1 objet(s) manquant(s)
14119: [INVARIANT-LOT9]   contrainte public.tickets.tickets_holder_or_counter absente — migration 20261108000002_lot9_invitations (contrat 6.2)
14126: [INVARIANT-LOT9] lot9-invariant garde — schéma du lot 9 incomplet : 1 objet(s) manquant(s)
14127: [INVARIANT-LOT9]   colonne public.ticket_transfers.from_user_id encore NOT NULL — expéditeur NULL d'une invitation en attente, migration 20261108000002_lot9_invitations (contrat 6.2)
14128: [INVARIANT-LOT9] lot9Violations — schéma du lot 9 incomplet : 1 objet(s) manquant(s)
14129: [INVARIANT-LOT9]   colonne public.ticket_transfers.from_user_id encore NOT NULL — expéditeur NULL d'une invitation en attente, migration 20261108000002_lot9_invitations (contrat 6.2)
14136: [INVARIANT-LOT9] lot9-invariant garde — schéma du lot 9 incomplet : 1 objet(s) manquant(s)
14137: [INVARIANT-LOT9]   fonction public.tickets_sale_decision_set ne connaît pas le canal 'INVITATION' — migration 20261108000002_lot9_invitations (contrat 6.2)
14138: [INVARIANT-LOT9] lot9Violations — schéma du lot 9 incomplet : 1 objet(s) manquant(s)
14139: [INVARIANT-LOT9]   fonction public.tickets_sale_decision_set ne connaît pas le canal 'INVITATION' — migration 20261108000002_lot9_invitations (contrat 6.2)
14146: [INVARIANT-LOT9] lot9-invariant garde — schéma du lot 9 incomplet : 1 objet(s) manquant(s)
14147: [INVARIANT-LOT9]   type INVITATION_RECEIVED absent de public.notification_types — migration 20261108000002_lot9_invitations (contrat 6.2)
14148: [INVARIANT-LOT9] lot9Violations — schéma du lot 9 incomplet : 1 objet(s) manquant(s)
14149: [INVARIANT-LOT9]   type INVITATION_RECEIVED absent de public.notification_types — migration 20261108000002_lot9_invitations (contrat 6.2)
14156: [INVARIANT-LOT9] lot9-invariant garde — schéma du lot 9 incomplet : 1 objet(s) manquant(s)
14157: [INVARIANT-LOT9]   type PHONE_CHANGED absent de public.notification_types — migration 20261108000004_lot9_compte (contrat 6.2)
14158: [INVARIANT-LOT9] lot9Violations — schéma du lot 9 incomplet : 1 objet(s) manquant(s)
14159: [INVARIANT-LOT9]   type PHONE_CHANGED absent de public.notification_types — migration 20261108000004_lot9_compte (contrat 6.2)
14166: [INVARIANT-LOT9] lot9-invariant garde — schéma du lot 9 incomplet : 1 objet(s) manquant(s)
14167: [INVARIANT-LOT9]   bucket avatars non public dans storage.buckets — migration 20261108000004_lot9_compte (contrat 6.2)
14168: [INVARIANT-LOT9] lot9Violations — schéma du lot 9 incomplet : 1 objet(s) manquant(s)
14169: [INVARIANT-LOT9]   bucket avatars non public dans storage.buckets — migration 20261108000004_lot9_compte (contrat 6.2)
```

Décompte sur les trois journaux :

```text
# compté par script sur les journaux du run 113
verify.log     [INVARIANT] : 326 ligne(s)
verify.log     [INVARIANT-FIN] : 153 ligne(s)
verify.log     [INVARIANT-ACCES] : 141 ligne(s)
verify.log     [INVARIANT-CYCLE] : 132 ligne(s)
verify.log     [INVARIANT-NOTIF] : 99 ligne(s)
verify.log     [INVARIANT-TERRAIN] : 75 ligne(s)
verify.log     [INVARIANT-RECETTE] : 42 ligne(s)
verify.log     [INVARIANT-LOT9] : 23 ligne(s)
e2e.log        [INVARIANT] : 10 ligne(s)
e2e.log        [INVARIANT-FIN] : 5 ligne(s)
e2e.log        [INVARIANT-ACCES] : 5 ligne(s)
e2e.log        [INVARIANT-CYCLE] : 5 ligne(s)
e2e.log        [INVARIANT-NOTIF] : 5 ligne(s)
e2e.log        [INVARIANT-TERRAIN] : 5 ligne(s)
e2e.log        [INVARIANT-RECETTE] : 5 ligne(s)
e2e.log        [INVARIANT-LOT9] : 5 ligne(s)
e2e-seed.log   [INVARIANT] : 2 ligne(s)
e2e-seed.log   [INVARIANT-FIN] : 1 ligne(s)
e2e-seed.log   [INVARIANT-ACCES] : 1 ligne(s)
e2e-seed.log   [INVARIANT-CYCLE] : 1 ligne(s)
e2e-seed.log   [INVARIANT-NOTIF] : 1 ligne(s)
e2e-seed.log   [INVARIANT-TERRAIN] : 1 ligne(s)
e2e-seed.log   [INVARIANT-RECETTE] : 1 ligne(s)
e2e-seed.log   [INVARIANT-LOT9] : 1 ligne(s)
lignes à plus de 0 violation sur ces trois journaux : 2
lignes [INVARIANT-LOT9] à 0 violation : verify 23, e2e 5, seed 1
  verify.log : [INVARIANT-CYCLE] pilotage-invariant — billet UTILISE sans scan : 1 violation(s) (l) sur le jeu
  verify.log : [INVARIANT-CYCLE] pilotage-invariant — paiement espèces détaché : 1 violation(s) (l) sur le jeu
```

Les 2 lignes à plus de 0 violation viennent de `pilotage-invariant.test.ts`, qui fabrique exprès une divergence de la règle (l) en transaction annulée, pour prouver que le contrôle la voit (tests « 5.12 (l) détecte une divergence fabriquée »). Ce ne sont pas des violations de la base : la même suite imprime `jeu connu : 0 violation(s)` (`docs/lot9-logs/ci-run113-verify.log:19861`).

**Limite.** `recette-invitation` est le seul libellé où (t) et (u) portent sur une vraie invitation réclamée, d'après l'agent F. Les règles (v) restent à vide en e2e : aucun parcours ne change de photo ni de numéro. La preuve de (v) vient des suites `compte-*` et `r27-avatars` de `verify`.

---

---

## 5. Tableau A21 : suites à la racine de `tests/`

Six suites à la racine de `tests/`, 78 cas, en deux commits. **`e2e-scenarios` a d'abord été gardée** : l'agent chargé de la suppression a relu la couverture annoncée et a trouvé deux cas qui n'étaient pas couverts.
- **Cas 6-7, annoncé couvert par `paiement-webhook:52-62` : faux.** Le cas passe un corps multipart et atteint la branche `webhook.service.ts:72` (« corps non form-urlencoded »). `paiement-webhook:52` envoie un corps form-urlencoded sans jeton, donc l'autre branche. Le retirer laissait cette branche sans aucun test.
- **Cas 15, annoncé couvert par `partenaire-lot7:783` : partiel.** La ligne ne couvre que l'import, pas `Realtime || connected`.

Les deux cas ont été portés (`ef209ea`) puis **vus verts au run 111**, et `e2e-scenarios` n'a été supprimée qu'ensuite (`3ca034a`). Les cinq autres sont parties après lecture des ports verts au run 110 (`f1ff53d`).

Le décompte passe de 220 suites (run 109) à 250 au run 110 (30 fichiers ajoutés), 245 au run 111 (cinq supprimés) et 244 aux runs 112 et 113 (`e2e-scenarios`). `.test.ts` ajoutés : 30, plus deux fichiers d'aides (`lot9-invariants.ts`, `panne-helpers.ts`).

```text
$ git diff --name-status --diff-filter=D 534d6b3..HEAD -- tests e2e
D	tests/auth-rbac.test.ts
D	tests/e2e-scenarios.test.ts
D	tests/partner-auth-complete.test.ts
D	tests/payment.test.ts
D	tests/roles-isolation.test.ts
D	tests/superadmin-complete.test.ts

$ git show --shortstat --abbrev=7 --format='%h %s' f1ff53d 3ca034a | cut -c1-170
f1ff53d test(9.4-A21)[suppression]: T33 à T35, tableau 5.5, cinq suites supprimées (auth-rbac, partner-auth-complete, payment, roles-isolation, superadmin-complete), po

 5 files changed, 907 deletions(-)
3ca034a test(9.4-A21)[suppression]: e2e-scenarios supprimé, ses deux cas réels vus verts au run 111 (paiement-webhook multipart, partenaire-lot7 Realtime). hors-ligne-s

 2 files changed, 1 insertion(+), 176 deletions(-)

$ for r in 110 111 113; do grep -h "TOTAL :" <verify.log du run $r>; done
run 110 : TOTAL : 250 suite(s) — 212 réussie(s), 38 en échec, 0 expirée(s)
run 111 : TOTAL : 245 suite(s) — 241 réussie(s), 4 en échec, 0 expirée(s)
run 113 : TOTAL : 244 suite(s) — 244 réussie(s), 0 en échec, 0 expirée(s)
```

| Suite supprimée | Cas | Lignes | Nature (contrat 5.5) | Commit | Où vont les cas réels |
|---|---|---|---|---|---|
| `auth-rbac` | 20 | 260 | Simulateur `evaluateRbac`, `middleware` importé jamais appelé ; 2 cas réels | f1ff53d | `r28-middleware-matrice`, `validations-metier` |
| `e2e-scenarios` | 11 | 175 | Chaînes, constantes, `Set` local ; 2 cas réels, trouvés après coup | 3ca034a | `paiement-webhook:156`, `partenaire-lot7:925` |
| `partner-auth-complete` | 24 | 246 | Constantes ; 2 cas réels | f1ff53d | `validations-metier`, fin d'`acces-limiteurs` |
| `payment` | 6 | 124 | Schémas réels ; 3 simulés | f1ff53d | `validations-metier` |
| `roles-isolation` | 7 | 122 | Tout local | f1ff53d | `validations-metier` (source `AppLayout`), sinon déjà couvert |
| `superadmin-complete` | 10 | 155 | Constantes ; 2 réels | f1ff53d | `validations-metier` |

**Gardées (8), elles prouvent quelque chose** : `fondations-lot0` (vrai garde-fou, adaptateurs, base), `notifications-and-documents` (4 contrôles de source, 1 en base), `partner-halls-m7`, `partner-orders-m9`, `ux-performance-and-double-click` (vrais services, base), `samirpay-contrat` (vrai client HTTP), `scanner-combat-ui` (vrais modules), `sms-formatage` (vraie fonction). Toutes PASS au run 113 :

```text
tests/fondations-lot0.test.ts                          PASS     682ms     0     .test-logs/tests__fondations-lot0.test.ts.log
tests/notifications-and-documents.test.ts              PASS     400ms     0     .test-logs/tests__notifications-and-documents.test.ts.log
tests/partner-halls-m7.test.ts                         PASS     1.6s      0     .test-logs/tests__partner-halls-m7.test.ts.log
tests/partner-orders-m9.test.ts                        PASS     1.7s      0     .test-logs/tests__partner-orders-m9.test.ts.log
tests/samirpay-contrat.test.ts                         PASS     3.8s      0     .test-logs/tests__samirpay-contrat.test.ts.log
tests/scanner-combat-ui.test.ts                        PASS     553ms     0     .test-logs/tests__scanner-combat-ui.test.ts.log
tests/sms-formatage.test.ts                            PASS     431ms     0     .test-logs/tests__sms-formatage.test.ts.log
tests/ux-performance-and-double-click.test.ts          PASS     877ms     0     .test-logs/tests__ux-performance-and-double-click.test.ts.log
```

**Tableau ligne par ligne.** Colonnes reprises de la vérification faite par l'agent de suppression sur le code du run 110. J'ai contrôlé à `HEAD`, pour les suites citées, le titre du test à ces lignes, ainsi que `middleware.ts:259` et `webhook.service.ts:72`. Je n'ai pas relu chaque cas d'origine : les 78 cas sont jugés par cet agent.

| Cas | Verdict | Preuve |
|---|---|---|
| auth-rbac 1-3, 12 (public, anonyme vers `/login?redirect=`) | porté | `r28`, anonyme et chaque rôle ; `/wallet` vers `/login?redirect=%2Fwallet` |
| auth-rbac 4, 5, 11 (CLIENT refusé) | couvert | `r6:25-29,131-146`. Le cas 11 (`/partner/scan`) n'est pas dans `r6` ; `r28` le couvre |
| auth-rbac 7 (PARTENAIRE accepté) | couvert | `roles-fraicheur:75-88`, plus `r28` |
| auth-rbac 8, 9, 10 | porté | matrice de `r28` |
| auth-rbac 6 (partenaire EN_ATTENTE) | **non porté** | AR14 : aucun comportement figé, point ouvert 18.1 |
| auth-rbac 21 | porté, règle réelle | `r28` ; `middleware.ts:259` relu |
| auth-rbac 19 | porté | `r28`, `POST_LOGIN`. La priorité de `redirectUrl` était du simulateur |
| auth-rbac 13, 14 | porté | `validations-metier`, à l'identique |
| auth-rbac 15, 17 | supprimé | constantes, sans code visé |
| auth-rbac 16 | couvert | `r11:25-50` |
| auth-rbac 20, roles-isolation 7 | porté | `validations-metier`, motif de source sur `AppLayout.tsx` (lignes 207 à 209 à `HEAD`, « Devenir partenaire ») |
| e2e-scenarios 1, 10-11 | supprimé | chaînes lâches sur de vraies pages ; `client-interface` et `acces-qr` couvrent mieux |
| e2e-scenarios 2-3 | couvert | port de payment 4 |
| e2e-scenarios 4-5, 8-9, 16, 17 | supprimé | constantes |
| **e2e-scenarios 6-7** | **annoncé couvert à tort, porté** | `paiement-webhook:156`, ajoute `result_detail`, `order_id` vide, aucun billet, PENDING |
| e2e-scenarios 12-14 | couvert | `acces-scan:134-152` |
| **e2e-scenarios 15** | **annoncé couvert à tort, porté** | `partenaire-lot7:925` (mot présent dans la source), `:783` (import). **Partie `EventCalendar` non portée** : elle vérifiait la présence du nom du fichier dans ce fichier |
| e2e-scenarios 18-20 | couvert | `pwa-manifest:366-377`, `push-service-worker:181` |
| partner-auth 1 | porté | `validations-metier`, toutes les assertions reprises |
| partner-auth 22 | porté | fin d'`acces-limiteurs` : `EXCEEDED`, `retryAfterSeconds`, compteur en base |
| partner-auth 23 | couvert | `partenaire-lot7:252-268`, fondateur et ordinaire |
| partner-auth 24 | couvert | `notif-pros:762-771` ; les dates ne sont pas relues, le retour anticipé de la RPC (`20261103000006:846-854`) précède tout UPDATE |
| partner-auth 2-21 | supprimé | constantes, les 20 relus par l'agent |
| payment 1, 2, 4, 6 (schéma) | porté | `validations-metier`, à l'identique |
| payment 3, 5, 6 (calcul) | supprimé | calcul local (le 3 est un `replace` local) |
| roles-isolation 1 | couvert | `attribution-roles:73-88` |
| roles-isolation 2 | couvert, **citation du contrat fausse** | `r6` ne teste pas ces accès du contrôleur ; `r28`, ligne CONTROLEUR, les couvre |
| roles-isolation 3 | couvert | `acces-scan:134-152` |
| roles-isolation 4 | couvert, **citation partielle** | `acces-pilotage:118-134` ne porte que sur les scans ; `pilotage-acces:115` refuse le partenaire B. L'original filtrait un tableau local |
| roles-isolation 5, 6 | sans objet | constantes ; statut ambassadeur à `acces-securite-urgente:211-233` |
| superadmin 1, 5 | porté | `validations-metier`, à l'identique |
| superadmin 3 | couvert, **citation imprécise** | `finance-reglages:179-200` porte sur le taux de service ; taux de parrainage figé à `parrainage-gardes:177-184`. L'original était de l'arithmétique locale |
| superadmin 2, 4, 6-10 | supprimé | constantes |

Preuve des ports, aux trois runs. Run 110 : ports verts avant la première suppression. Run 111 : les deux ports de `e2e-scenarios` verts avant sa suppression. Run 113 : état final.

```text
# run 110 (e6c23d1), ports de la vague L, avant la première suppression
tests__schema__validations-metier.test.ts : tests 10 pass 10 fail 0 ; failing tests : 0
tests__security__r28-middleware-matrice.test.ts : tests 11 pass 11 fail 0 ; failing tests : 0
tests__parcours__acces-limiteurs.test.ts : tests 17 pass 17 fail 0 ; failing tests : 0

# run 111 (3c83ab1), les deux ports de e2e-scenarios, avant sa suppression (runs/111-42511133163)
tests__parcours__paiement-webhook.test.ts : tests 10 pass 10 fail 0
ok 10 - corps multipart : 200, received: true, REJECTED_INVALID_PAYLOAD « corps non form-urlencoded », aucun billet
tests__parcours__partenaire-lot7.test.ts : tests 30 pass 30 fail 0
ok 1 - tableau de bord (app/partner/dashboard/page.tsx) : le code mentionne toujours Realtime ou connected

# run 113 (d255bf3), état final
tests__schema__validations-metier.test.ts : tests 10 pass 10 fail 0 ; failing tests : 0
ok 1 - VerifyOtpSchema accepte un code à 6 chiffres, normalizePhoneNumber rend le E.164 sénégalais
ok 2 - VerifyOtpSchema refuse un code trop court
ok 3 - RegisterPartnerSchema exige les deux jetons de pièces et garde leurs valeurs
ok 1 - A21 — schémas d’authentification
ok 1 - opérateurs du contrat SamirPay : Wave et Orange Money uniquement, libellé Orange Money
ok 2 - SamirPayWebhookSchema : statut et identifiants obligatoires
ok 3 - CreatePaymentSchema : opérateur obligatoire, carte refusée, montant envoyé ignoré
ok 4 - RequestWithdrawalSchema : 15 000 F accepté, 3 000 F refusé (seuil de 5 000 F)
ok 2 - A21 — paiement
ok 1 - ADMIN_PERMISSIONS : plus de 10 droits, dont users.read, partners.validate, refunds.manage, pricing.manage
ok 2 - moderateContent : message licite accepté, mots interdits relevés
ok 3 - A21 — administration
ok 1 - AppLayout : « Devenir partenaire » réservé à qui n’est ni partenaire, ni admin, ni contrôleur
ok 4 - A21 — navigation
tests__security__r28-middleware-matrice.test.ts : tests 11 pass 11 fail 0 ; failing tests : 0
ok 1 - pages publiques servies, pages protégées et /wallet renvoient vers /login?redirect=
ok 1 - R28 — visiteur anonyme
ok 1 - CLIENT : pages publiques servies, espaces protégés selon la règle réelle
ok 2 - CLIENT : les pages d’authentification renvoient vers /
ok 3 - PARTENAIRE : pages publiques servies, espaces protégés selon la règle réelle
ok 4 - PARTENAIRE : les pages d’authentification renvoient vers /partner/dashboard
ok 5 - CONTROLEUR : pages publiques servies, espaces protégés selon la règle réelle
ok 6 - CONTROLEUR : les pages d’authentification renvoient vers /controller/scanner
ok 7 - ADMIN : pages publiques servies, espaces protégés selon la règle réelle
ok 8 - ADMIN : les pages d’authentification renvoient vers /admin/dashboard
ok 9 - SUPERADMIN : pages publiques servies, espaces protégés selon la règle réelle
ok 10 - SUPERADMIN : les pages d’authentification renvoient vers /admin/dashboard
ok 2 - R28 — chaque rôle
tests__parcours__acces-limiteurs.test.ts : tests 17 pass 17 fail 0 ; failing tests : 0
ok 1 - 5 tentatives acceptées, la 6e refusée EXCEEDED avec retryAfterSeconds > 0 ; compteur en base (T15)
ok 6 - A21 — reserveQuota : refus motivé
tests__parcours__paiement-webhook.test.ts : tests 10 pass 10 fail 0 ; failing tests : 0
ok 10 - corps multipart : 200, received: true, REJECTED_INVALID_PAYLOAD « corps non form-urlencoded », aucun billet
tests__parcours__partenaire-lot7.test.ts : tests 30 pass 30 fail 0 ; failing tests : 0
ok 1 - tableau de bord (app/partner/dashboard/page.tsx) : le code mentionne toujours Realtime ou connected
ok 8 - A21 — port du SCENARIO 15, sans rien de plus
tests__schema__code-mort-lot9.test.ts : tests 11 pass 11 fail 0 ; failing tests : 0
ok 1 - components/events/AdjustTicketQuotaModal.tsx n’existe plus
ok 2 - components/events/EventCancelModal.tsx n’existe plus
ok 3 - lib/payments/financial-calculator.service.ts n’existe plus
ok 4 - lib/halls/hall.service.ts n’importe plus le service de calcul
ok 5 - app, lib, components : aucune mention des composants et des calculs retirés
ok 1 - PO10 — code mort supprimé
ok 1 - tests/auth-rbac.test.ts n’existe plus (cas réels portés, tableau 5.5)
ok 2 - tests/e2e-scenarios.test.ts n’existe plus (cas réels portés, tableau 5.5)
ok 3 - tests/partner-auth-complete.test.ts n’existe plus (cas réels portés, tableau 5.5)
ok 4 - tests/payment.test.ts n’existe plus (cas réels portés, tableau 5.5)
ok 5 - tests/roles-isolation.test.ts n’existe plus (cas réels portés, tableau 5.5)
ok 6 - tests/superadmin-complete.test.ts n’existe plus (cas réels portés, tableau 5.5)
ok 2 - A21 — suites qui ne prouvaient rien supprimées
```

`tests/schema/code-mort-lot9.test.ts` et `recette-matrice` (`SUITES_INTERDITES`, inchangée) rejouent l'absence de ces fichiers à chaque run.

---

## 6. Sortie brute de `npm run verify`, de `npm run e2e` et CI

Journaux complets : `docs/lot9-logs/ci-run110-*` (« avant », committés) et `docs/lot9-logs/ci-run113-*` (non committés à l'heure de cette partie, `git status` les montre). Sur `ci-results` : `runs/110-42499989446/`, `runs/113-42519327711/`.

### 6.1 Run 110 (référence « avant »), récapitulatif

Le tri des 38 échecs et de la phase e2e est dans `docs/lot9-logs/ci-run110-triage.txt` (et `scratchpad/triage-110-42499989446.txt`) ; il est repris en section 2.

```text
# run 110 (e6c23d1) — docs/lot9-logs/ci-run110-verify.log:44633-44888, lignes PASS retirées
═══════════════════ RÉCAPITULATIF ═══════════════════
Suite                                                  Statut   Durée     Code  Journal
tests/parcours/acces-tracabilite.test.ts               FAIL     5.5s      1     .test-logs/tests__parcours__acces-tracabilite.test.ts.log
tests/parcours/admin-audit-lot9.test.ts                FAIL     1.9s      1     .test-logs/tests__parcours__admin-audit-lot9.test.ts.log
tests/parcours/admin-audit.test.ts                     FAIL     2.2s      1     .test-logs/tests__parcours__admin-audit.test.ts.log
tests/parcours/canaux-interface.test.ts                FAIL     653ms     1     .test-logs/tests__parcours__canaux-interface.test.ts.log
tests/parcours/cloture-vocabulaire.test.ts             FAIL     1.4s      1     .test-logs/tests__parcours__cloture-vocabulaire.test.ts.log
tests/parcours/compte-numero.test.ts                   FAIL     10.2s     1     .test-logs/tests__parcours__compte-numero.test.ts.log
tests/parcours/compte-paiements.test.ts                FAIL     4.7s      1     .test-logs/tests__parcours__compte-paiements.test.ts.log
tests/parcours/compte-photo.test.ts                    FAIL     7.1s      1     .test-logs/tests__parcours__compte-photo.test.ts.log
tests/parcours/compte-profil.test.ts                   FAIL     5.3s      1     .test-logs/tests__parcours__compte-profil.test.ts.log
tests/parcours/course-verrous-lot9.test.ts             FAIL     6.3s      1     .test-logs/tests__parcours__course-verrous-lot9.test.ts.log
tests/parcours/decouverte-cache.test.ts                FAIL     327ms     1     .test-logs/tests__parcours__decouverte-cache.test.ts.log
tests/parcours/decouverte-ecrans.test.ts               FAIL     402ms     1     .test-logs/tests__parcours__decouverte-ecrans.test.ts.log
tests/parcours/decouverte-populaires.test.ts           FAIL     3.2s      1     .test-logs/tests__parcours__decouverte-populaires.test.ts.log
tests/parcours/decouverte-recherche-lot9.test.ts       FAIL     2.1s      1     .test-logs/tests__parcours__decouverte-recherche-lot9.test.ts.log
tests/parcours/decouverte-ville.test.ts                FAIL     1.8s      1     .test-logs/tests__parcours__decouverte-ville.test.ts.log
tests/parcours/design-systeme.test.ts                  FAIL     2.9s      1     .test-logs/tests__parcours__design-systeme.test.ts.log
tests/parcours/ecritures-ignorees.test.ts              FAIL     3.5s      1     .test-logs/tests__parcours__ecritures-ignorees.test.ts.log
tests/parcours/invitations-annulation.test.ts          FAIL     2.8s      1     .test-logs/tests__parcours__invitations-annulation.test.ts.log
tests/parcours/invitations-course.test.ts              FAIL     1.3s      1     .test-logs/tests__parcours__invitations-course.test.ts.log
tests/parcours/invitations-quotas.test.ts              FAIL     2.2s      1     .test-logs/tests__parcours__invitations-quotas.test.ts.log
tests/parcours/invitations-reclamation.test.ts         FAIL     2.5s      1     .test-logs/tests__parcours__invitations-reclamation.test.ts.log
tests/parcours/invitations.test.ts                     FAIL     5.3s      1     .test-logs/tests__parcours__invitations.test.ts.log
tests/parcours/lectures-ignorees.test.ts               FAIL     3.2s      1     .test-logs/tests__parcours__lectures-ignorees.test.ts.log
tests/parcours/lot9-invariant.test.ts                  FAIL     1.7s      1     .test-logs/tests__parcours__lot9-invariant.test.ts.log
tests/parcours/messages-bruts.test.ts                  FAIL     2.5s      1     .test-logs/tests__parcours__messages-bruts.test.ts.log
tests/parcours/nettoyage-sur-place.test.ts             FAIL     2.3s      1     .test-logs/tests__parcours__nettoyage-sur-place.test.ts.log
tests/parcours/notif-migration.test.ts                 FAIL     2.0s      1     .test-logs/tests__parcours__notif-migration.test.ts.log
tests/parcours/notif-modeles.test.ts                   FAIL     1.2s      1     .test-logs/tests__parcours__notif-modeles.test.ts.log
tests/parcours/notif-outbox.test.ts                    FAIL     2.3s      1     .test-logs/tests__parcours__notif-outbox.test.ts.log
tests/parcours/pannes-absences.test.ts                 FAIL     3.5s      1     .test-logs/tests__parcours__pannes-absences.test.ts.log
tests/parcours/parrainage-boucle-update.test.ts        FAIL     2.0s      1     .test-logs/tests__parcours__parrainage-boucle-update.test.ts.log
tests/parcours/pilotage-cloture-export.test.ts         FAIL     3.9s      1     .test-logs/tests__parcours__pilotage-cloture-export.test.ts.log
tests/schema/code-mort-lot9.test.ts                    FAIL     351ms     1     .test-logs/tests__schema__code-mort-lot9.test.ts.log
tests/schema/essai-route-dev.test.ts                   FAIL     350ms     1     .test-logs/tests__schema__essai-route-dev.test.ts.log
tests/schema/migration-lot9-rejouable.test.ts          FAIL     1.3s      1     .test-logs/tests__schema__migration-lot9-rejouable.test.ts.log
tests/security/r27-avatars.test.ts                     FAIL     1.8s      1     .test-logs/tests__security__r27-avatars.test.ts.log
tests/security/r3-fonctions-rpc.test.ts                FAIL     1.7s      1     .test-logs/tests__security__r3-fonctions-rpc.test.ts.log
tests/security/r7-profil-colonnes.test.ts              FAIL     2.8s      1     .test-logs/tests__security__r7-profil-colonnes.test.ts.log
TOTAL : 250 suite(s) — 212 réussie(s), 38 en échec, 0 expirée(s)

[verify] ÉCHEC à l'étape "test" (code 1).
```

Phases e2e du run 110, avec les cas rouges :

```text
# run 110 (e6c23d1) — docs/lot9-logs/ci-run110-e2e.log, lignes filtrées (phases, ✓ et ✘ hors captures, ✘ des captures, résumés)
[e2e] faux services : HTTP 200
[e2e] application   : HTTP 200
═══════════════ e2e › connexion : playwright test --project=setup ═══════════════
Running 10 tests using 2 workers
  ✓   1 [setup] › e2e/auth.setup.ts:26:10 › connexion : organisateur (démonstration) (2.9s)
  ✓   2 [setup] › e2e/auth.setup.ts:26:10 › connexion : administrateur (démonstration, events.read et events.write) (3.0s)
  ✓   4 [setup] › e2e/auth.setup.ts:26:10 › connexion : contrôleur (démonstration) (3.2s)
  ✓   3 [setup] › e2e/auth.setup.ts:26:10 › connexion : client (démonstration) (3.5s)
  ✓   5 [setup] › e2e/auth.setup.ts:26:10 › connexion : partenaire « premiers pas » (démonstration, aucun événement) (1.9s)
  ✓   6 [setup] › e2e/auth.setup.ts:26:10 › connexion : organisateur A (seed de test) (1.9s)
  ✓   8 [setup] › e2e/auth.setup.ts:26:10 › connexion : client (seed de test) (2.2s)
  ✓   7 [setup] › e2e/auth.setup.ts:26:10 › connexion : superadmin (seed de test) (2.5s)
  ✓  10 [setup] › e2e/auth.setup.ts:26:10 › connexion : contrôleur A (seed de test) (1.9s)
  ✓   9 [setup] › e2e/auth.setup.ts:26:10 › connexion : second client (seed de test) (2.1s)
  10 passed (13.5s)
[e2e] phase connexion : OK en 14s
═══════════════ e2e › captures : playwright test --project=mobile --project=desktop ═══════════════
Running 388 tests using 2 workers
  ✘    1 [mobile] › e2e/captures.spec.ts:174:9 › clair · anonyme › accueil — Accueil (31.0s)
  ✘   19 [mobile] › e2e/captures.spec.ts:174:9 › clair · anonyme › accueil-populaires-erreur — Accueil — Populaires, état d’erreur (Réessayer) (15.6s)
  ✘   18 [mobile] › e2e/captures.spec.ts:174:9 › clair · anonyme › accueil-ville — Accueil — Près de chez vous, ville gardée sur l’appareil (30.7s)
  ✘   42 [mobile] › e2e/captures.spec.ts:174:9 › clair · client › mes-paiements — Mes paiements (date, événement, montant, opérateur, statut, totaux) (768ms)
  ✘   43 [mobile] › e2e/captures.spec.ts:174:9 › clair · client › profil — Profil du client (identité, photo, numéro) (15.9s)
  ✘   44 [mobile] › e2e/captures.spec.ts:174:9 › clair · client › changement-numero — Profil du client — changement de numéro (boîte ouverte) (18.6s)
  ✘   68 [mobile] › e2e/captures.spec.ts:174:9 › clair · organisateur › invitations-onglet — Pilotage — Invitations (catégorie, numéros, liste) (15.6s)
  ✘   69 [mobile] › e2e/captures.spec.ts:174:9 › clair · organisateur › invitations-confirmation — Pilotage — Invitations : confirmation de l’envoi (15.7s)
  ✘   98 [mobile] › e2e/captures.spec.ts:174:9 › sombre · anonyme › accueil — Accueil (30.8s)
  ✘  116 [mobile] › e2e/captures.spec.ts:174:9 › sombre · anonyme › accueil-populaires-erreur — Accueil — Populaires, état d’erreur (Réessayer) (15.6s)
  ✘  115 [mobile] › e2e/captures.spec.ts:174:9 › sombre · anonyme › accueil-ville — Accueil — Près de chez vous, ville gardée sur l’appareil (30.8s)
  ✘  139 [mobile] › e2e/captures.spec.ts:174:9 › sombre · client › mes-paiements — Mes paiements (date, événement, montant, opérateur, statut, totaux) (837ms)
  ✘  140 [mobile] › e2e/captures.spec.ts:174:9 › sombre · client › profil — Profil du client (identité, photo, numéro) (15.8s)
  ✘  141 [mobile] › e2e/captures.spec.ts:174:9 › sombre · client › changement-numero — Profil du client — changement de numéro (boîte ouverte) (18.6s)
  ✘  165 [mobile] › e2e/captures.spec.ts:174:9 › sombre · organisateur › invitations-onglet — Pilotage — Invitations (catégorie, numéros, liste) (15.6s)
  ✘  166 [mobile] › e2e/captures.spec.ts:174:9 › sombre · organisateur › invitations-confirmation — Pilotage — Invitations : confirmation de l’envoi (15.6s)
  ✘  195 [desktop] › e2e/captures.spec.ts:174:9 › clair · anonyme › accueil — Accueil (30.8s)
  ✘  213 [desktop] › e2e/captures.spec.ts:174:9 › clair · anonyme › accueil-populaires-erreur — Accueil — Populaires, état d’erreur (Réessayer) (15.7s)
  ✘  212 [desktop] › e2e/captures.spec.ts:174:9 › clair · anonyme › accueil-ville — Accueil — Près de chez vous, ville gardée sur l’appareil (30.6s)
  ✘  236 [desktop] › e2e/captures.spec.ts:174:9 › clair · client › mes-paiements — Mes paiements (date, événement, montant, opérateur, statut, totaux) (776ms)
  ✘  237 [desktop] › e2e/captures.spec.ts:174:9 › clair · client › profil — Profil du client (identité, photo, numéro) (15.8s)
  ✘  238 [desktop] › e2e/captures.spec.ts:174:9 › clair · client › changement-numero — Profil du client — changement de numéro (boîte ouverte) (18.6s)
  ✘  262 [desktop] › e2e/captures.spec.ts:174:9 › clair · organisateur › invitations-onglet — Pilotage — Invitations (catégorie, numéros, liste) (15.5s)
  ✘  263 [desktop] › e2e/captures.spec.ts:174:9 › clair · organisateur › invitations-confirmation — Pilotage — Invitations : confirmation de l’envoi (15.6s)
  ✘  292 [desktop] › e2e/captures.spec.ts:174:9 › sombre · anonyme › accueil — Accueil (30.7s)
  ✘  310 [desktop] › e2e/captures.spec.ts:174:9 › sombre · anonyme › accueil-populaires-erreur — Accueil — Populaires, état d’erreur (Réessayer) (15.7s)
  ✘  309 [desktop] › e2e/captures.spec.ts:174:9 › sombre · anonyme › accueil-ville — Accueil — Près de chez vous, ville gardée sur l’appareil (30.6s)
  ✘  333 [desktop] › e2e/captures.spec.ts:174:9 › sombre · client › mes-paiements — Mes paiements (date, événement, montant, opérateur, statut, totaux) (856ms)
  ✘  334 [desktop] › e2e/captures.spec.ts:174:9 › sombre · client › profil — Profil du client (identité, photo, numéro) (15.8s)
  ✘  335 [desktop] › e2e/captures.spec.ts:174:9 › sombre · client › changement-numero — Profil du client — changement de numéro (boîte ouverte) (18.7s)
  ✘  359 [desktop] › e2e/captures.spec.ts:174:9 › sombre · organisateur › invitations-onglet — Pilotage — Invitations (catégorie, numéros, liste) (15.6s)
  ✘  360 [desktop] › e2e/captures.spec.ts:174:9 › sombre · organisateur › invitations-confirmation — Pilotage — Invitations : confirmation de l’envoi (15.7s)
[e2e] index des captures : .e2e-captures/captures/index.txt (349 entrée(s), 32 en échec)
  32 failed
  39 skipped
  317 passed (19.5m)
[e2e] phase captures : ÉCHEC (code 1) en 1171s
═══════════════ e2e › emails : playwright test --project=emails --workers=1 ═══════════════
Running 5 tests using 1 worker
  ✓  1 [emails] › e2e/emails.spec.ts:142:9 › email achat-1-billet : 390 et 600 px, clair et sombre, sans ressource externe (1.3s)
  ✓  2 [emails] › e2e/emails.spec.ts:142:9 › email achat-4-billets : 390 et 600 px, clair et sombre, sans ressource externe (1.3s)
  ✓  3 [emails] › e2e/emails.spec.ts:142:9 › email achat-12-billets : 390 et 600 px, clair et sombre, sans ressource externe (1.3s)
  ✓  4 [emails] › e2e/emails.spec.ts:142:9 › email gratuits-2-billets : 390 et 600 px, clair et sombre, sans ressource externe (1.2s)
  ✓  5 [emails] › e2e/emails.spec.ts:142:9 › email transfert-recu : 390 et 600 px, clair et sombre, sans ressource externe (1.2s)
[e2e] index des captures : .e2e-captures/captures/index.txt (349 entrée(s), 32 en échec)
  5 passed (7.5s)
[e2e] phase emails : OK en 8s
═══════════════ e2e › dev-page : playwright test --project=dev-page --workers=1 ═══════════════
Running 4 tests using 1 worker
  ✓  1 [dev-page] › e2e/dev-page.spec.ts:53:13 › page de développement : mobile, clair (1.0s)
  ✓  2 [dev-page] › e2e/dev-page.spec.ts:53:13 › page de développement : mobile, sombre (918ms)
  ✓  3 [dev-page] › e2e/dev-page.spec.ts:53:13 › page de développement : ordinateur, clair (801ms)
  ✓  4 [dev-page] › e2e/dev-page.spec.ts:53:13 › page de développement : ordinateur, sombre (904ms)
[e2e] index des captures : .e2e-captures/captures/index.txt (353 entrée(s), 32 en échec)
  4 passed (5.0s)
[e2e] phase dev-page : OK en 6s
═══════════════ e2e › fumee : playwright test --project=fumee ═══════════════
Running 2 tests using 1 worker
  ✓  1 [fumee] › e2e/fumee.spec.ts:91:5 › fumée : créer, soumettre, valider, publier, acheter, scanner, piloter (34.9s)
  ✓  2 [fumee] › e2e/fumee.spec.ts:604:5 › pages et routes de développement : 404 sur next start, avec et sans session (125ms)
[e2e] index des captures : .e2e-captures/captures/index.txt (353 entrée(s), 32 en échec)
  2 passed (36.3s)
[e2e] phase fumee : OK en 37s
═══════════════ e2e › terrain : playwright test --project=terrain --workers=1 ═══════════════
Running 13 tests using 1 worker
  ✓   1 [terrain] › e2e/terrain.spec.ts:119:9 › 1. téléphone en avance de 5 min : codes téléchargés, hors ligne, QR accepté par le contrôleur (4.1s)
  ✓   2 [terrain] › e2e/terrain.spec.ts:119:9 › 1. téléphone en retard de 5 min : codes téléchargés, hors ligne, QR accepté par le contrôleur (3.9s)
  ✓   3 [terrain] › e2e/terrain.spec.ts:154:5 › 2. cache du service worker : coquille hors ligne et ressources statiques seulement, anciens caches supprimés (2.4s)
  ✓   4 [terrain] › e2e/terrain.spec.ts:219:5 › 3. réponse du scan perdue : relance automatique avec la même clé, une seule entrée (2.8s)
  ✓   5 [terrain] › e2e/terrain.spec.ts:369:5 › 4. mesure du scan : billets neufs en réseau normal puis en 3G, relectures « déjà utilisé », puis une lecture hors ligne (1.6m)
  ✓   6 [terrain] › e2e/terrain.spec.ts:468:5 › 5. vibrations : accepté [60], refusé [120,60,120,60,120], motifs distincts, aucune vibration à la lecture (3.7s)
  ✓   7 [terrain] › e2e/terrain.spec.ts:506:5 › 6. onglet en arrière-plan : pistes de la caméra arrêtées (1.6s)
  ✓   8 [terrain] › e2e/terrain.spec.ts:604:5 › 7. reprise de session : même événement et même mode après une sortie, chiffres et historique relus, « Reprendre le contrôle », scan sans réponse renvoyé avec sa c …
  ✓   9 [terrain] › e2e/terrain.spec.ts:765:5 › 8. barre d’achat de la fiche : collée au bas de l’écran en haut de page et à mi-page, pleine largeur (1.8s)
  ✓  10 [terrain] › e2e/terrain.spec.ts:781:5 › 9. résultat du scanner : plein écran égal à la fenêtre, page défilée de force (2.1s)
  ✓  11 [terrain] › e2e/terrain.spec.ts:815:5 › 10. lot hors ligne : réponse compressée en gzip, moins de 40 000 octets transférés (1.7s)
  ✓  12 [terrain] › e2e/terrain.spec.ts:853:5 › 11. lecture jamais arrivée au serveur : au retour, « non traité », pas de « Résultat retrouvé », billet intact (3.3s)
  ✓  13 [terrain] › e2e/terrain.spec.ts:924:5 › 12. clôture de caisse avec écart, sans réponse imposée : refus 400, écart du serveur affiché, puis clôture juste (2.7s)
[e2e] index des captures : .e2e-captures/captures/index.txt (353 entrée(s), 32 en échec)
  13 passed (2.2m)
[e2e] phase terrain : OK en 135s
═══════════════ e2e › pwa : playwright test --project=pwa --workers=1 ═══════════════
Running 4 tests using 1 worker
  ✓  1 [pwa] › e2e/installable.spec.ts:109:5 › Chromium reconnaît l’application installable (beforeinstallprompt, aucune erreur d’installabilité) (1.8s)
  ✓  2 [pwa] › e2e/installable.spec.ts:147:5 › témoin négatif : manifest servi sans icône → Chromium signale l’icône manquante (1.1s)
  ✓  3 [pwa] › e2e/installable.spec.ts:166:5 › manifest servi : id, scope, start_url, standalone, couleurs, icônes 192 et 512 dont une maskable (contrat 4.5) (189ms)
  ✓  4 [pwa] › e2e/installable.spec.ts:193:5 › iPhone : balises apple-mobile-web-app et icône apple-touch 180×180 dans le <head> de l’accueil (518ms)
[e2e] index des captures : .e2e-captures/captures/index.txt (353 entrée(s), 32 en échec)
  4 passed (4.6s)
[e2e] phase pwa : OK en 5s
═══════════════ e2e › fake-prod : node scripts/e2e/fake-prod.mjs ═══════════════
[e2e] phase fake-prod : OK en 2s
═══════════════ e2e › perf : playwright test --project=perf --workers=1 ═══════════════
Running 4 tests using 1 worker
  ✓  1 [perf] › e2e/perf.spec.ts:374:9 › Accueil : premier affichage utile et JavaScript chargé, 4G simulée et processeur ×4 (5 passages) (41.1s)
  ✓  2 [perf] › e2e/perf.spec.ts:374:9 › Page événement : premier affichage utile et JavaScript chargé, 4G simulée et processeur ×4 (5 passages) (41.0s)
  ✓  3 [perf] › e2e/perf.spec.ts:374:9 › Mes billets : premier affichage utile et JavaScript chargé, 4G simulée et processeur ×4 (5 passages) (47.9s)
  ✓  4 [perf] › e2e/perf.spec.ts:374:9 › Scanner : premier affichage utile et JavaScript chargé, 4G simulée et processeur ×4 (5 passages) (57.6s)
[e2e] index des captures : .e2e-captures/captures/index.txt (353 entrée(s), 32 en échec)
  4 passed (3.1m)
[e2e] phase perf : OK en 189s
═══════════════ e2e › recette : playwright test --project=recette --workers=1 ═══════════════
Running 9 tests using 1 worker
  ✓  1 [recette] › e2e/recette.spec.ts:285:5 › acte 1 [admin] : délai de garde coupé à l’écran, motif exigé, historique ; un ADMIN est refusé (2.9s)
  ✓  2 [recette] › e2e/recette.spec.ts:323:5 › acte 2 [partenaire] [admin] : inscription avec pièces, validation, E1 et ses canaux, soumission, publication, E2 (9.0s)
  ✓  3 [recette] › e2e/recette.spec.ts:453:5 › acte 3 [partenaire] : invitation de K1, permission espèces, point d’entrée, PIN régisseur (1.9s)
  ✓  4 [recette] › e2e/recette.spec.ts:487:5 › acte 4 [client] : découverte, fiche, refus direct, inscription depuis l’achat, achats, Mes billets, transfert (17.1s)
  ✓  5 [recette] › e2e/recette.spec.ts:616:5 › acte 5 [contrôleur] : activation, caisse, scan en ligne et hors ligne, ancien code, saisie manuelle, guichet, reprise, clôture (17.2s)
  ✓  6 [recette] › e2e/recette.spec.ts:728:5 › acte 6 [partenaire] : pilotage, rapport de clôture, export, retrait, remboursement d’un billet à l’écran (5.4s)
  ✓  7 [recette] › e2e/recette.spec.ts:797:5 › acte 7 [client] [partenaire] : annulation de E2, envoyeur par la vraie route, billet remboursé, avis, bandeau public (2.2s)
  ✘  8 [recette] › e2e/recette.spec.ts:841:5 › acte 9 [partenaire] [client] [contrôleur] : invitation d’un numéro sans compte, inscription, réclamation, entrée (20.3s)
[e2e] index des captures : .e2e-captures/captures/index.txt (353 entrée(s), 32 en échec)
  1 failed
  7 passed (1.3m)
[e2e] phase recette : ÉCHEC (code 1) en 80s
[e2e] durées : connexion 14s · captures 1171s · emails 8s · dev-page 6s · fumee 37s · terrain 135s · pwa 5s · fake-prod 2s · perf 189s · recette 80s — total 1647s (27.4 min)
[e2e] résumé :connexion OK · captures ÉCHEC · emails OK · dev-page OK · fumee OK · terrain OK · pwa OK · fake-prod OK · perf OK · recette ÉCHEC
```

Au run 110, 32 captures échouent : les 7 écrans nouveaux (28 cas) et `accueil` (4 cas, T26 : il attend désormais la section Populaires). Dans la recette, l'acte 9 est rouge et l'acte 8 n'est pas lancé (`1 did not run`, projet en série). C'est le rouge annoncé par le contrat (section 7 et AM3).

### 6.2 Run 113 (référence « après »), `npm run verify`

```text
# run 113 (d255bf3) — docs/lot9-logs/ci-run113-verify.log:1-25

> event-village@1.0.0 verify
> node scripts/verify.mjs


═══════════════ verify › typecheck : npm run typecheck ═══════════════

> event-village@1.0.0 typecheck
> tsc --noEmit


═══════════════ verify › lint : npm run lint ═══════════════

> event-village@1.0.0 lint
> next lint

✔ No ESLint warnings or errors

═══════════════ verify › test : npm run test ═══════════════

> event-village@1.0.0 test
> node scripts/run-tests.mjs

[run-tests] suites lourdes (massHolders) après la dernière suite temps réel (tests/parcours/temps-reel-stock.test.ts) : tests/parcours/sms-plafond-optionnel.test.ts, tests/parcours/sms-veille.test.ts
[run-tests] 244 suite(s) — garde-fou : tests/helpers/env.ts — délai/suite : 600.0s
```

Récapitulatif complet (244 lignes PASS, aucune autre) :

```text
# run 113 (d255bf3) — docs/lot9-logs/ci-run113-verify.log:29800-30047
═══════════════════ RÉCAPITULATIF ═══════════════════
Suite                                                  Statut   Durée     Code  Journal
tests/fondations-lot0.test.ts                          PASS     682ms     0     .test-logs/tests__fondations-lot0.test.ts.log
tests/notifications-and-documents.test.ts              PASS     400ms     0     .test-logs/tests__notifications-and-documents.test.ts.log
tests/parcours/acces-caisse-pin.test.ts                PASS     4.2s      0     .test-logs/tests__parcours__acces-caisse-pin.test.ts.log
tests/parcours/acces-encaissement.test.ts              PASS     1.6s      0     .test-logs/tests__parcours__acces-encaissement.test.ts.log
tests/parcours/acces-fenetre.test.ts                   PASS     2.3s      0     .test-logs/tests__parcours__acces-fenetre.test.ts.log
tests/parcours/acces-guichet.test.ts                   PASS     2.6s      0     .test-logs/tests__parcours__acces-guichet.test.ts.log
tests/parcours/acces-invariant.test.ts                 PASS     668ms     0     .test-logs/tests__parcours__acces-invariant.test.ts.log
tests/parcours/acces-limiteurs.test.ts                 PASS     9.7s      0     .test-logs/tests__parcours__acces-limiteurs.test.ts.log
tests/parcours/acces-messages.test.ts                  PASS     1.0s      0     .test-logs/tests__parcours__acces-messages.test.ts.log
tests/parcours/acces-pilotage.test.ts                  PASS     18.5s     0     .test-logs/tests__parcours__acces-pilotage.test.ts.log
tests/parcours/acces-qr.test.ts                        PASS     2.4s      0     .test-logs/tests__parcours__acces-qr.test.ts.log
tests/parcours/acces-reglages.test.ts                  PASS     1.6s      0     .test-logs/tests__parcours__acces-reglages.test.ts.log
tests/parcours/acces-scan.test.ts                      PASS     2.6s      0     .test-logs/tests__parcours__acces-scan.test.ts.log
tests/parcours/acces-securite-urgente.test.ts          PASS     2.4s      0     .test-logs/tests__parcours__acces-securite-urgente.test.ts.log
tests/parcours/acces-totp.test.ts                      PASS     2.4s      0     .test-logs/tests__parcours__acces-totp.test.ts.log
tests/parcours/acces-tracabilite.test.ts               PASS     5.7s      0     .test-logs/tests__parcours__acces-tracabilite.test.ts.log
tests/parcours/achat-serveur.test.ts                   PASS     813ms     0     .test-logs/tests__parcours__achat-serveur.test.ts.log
tests/parcours/activation-controleur.test.ts           PASS     4.2s      0     .test-logs/tests__parcours__activation-controleur.test.ts.log
tests/parcours/admin-audit-lot9.test.ts                PASS     2.2s      0     .test-logs/tests__parcours__admin-audit-lot9.test.ts.log
tests/parcours/admin-audit.test.ts                     PASS     2.5s      0     .test-logs/tests__parcours__admin-audit.test.ts.log
tests/parcours/admin-evenements.test.ts                PASS     5.5s      0     .test-logs/tests__parcours__admin-evenements.test.ts.log
tests/parcours/admin-parrainage.test.ts                PASS     1.1s      0     .test-logs/tests__parcours__admin-parrainage.test.ts.log
tests/parcours/admin-remboursements.test.ts            PASS     5.2s      0     .test-logs/tests__parcours__admin-remboursements.test.ts.log
tests/parcours/admin-services-mention.test.ts          PASS     770ms     0     .test-logs/tests__parcours__admin-services-mention.test.ts.log
tests/parcours/anonymisation-debogage.test.ts          PASS     1.6s      0     .test-logs/tests__parcours__anonymisation-debogage.test.ts.log
tests/parcours/attribution-roles.test.ts               PASS     1.4s      0     .test-logs/tests__parcours__attribution-roles.test.ts.log
tests/parcours/bootstrap-superadmin.test.ts            PASS     706ms     0     .test-logs/tests__parcours__bootstrap-superadmin.test.ts.log
tests/parcours/canaux-interface.test.ts                PASS     723ms     0     .test-logs/tests__parcours__canaux-interface.test.ts.log
tests/parcours/canaux-invariant.test.ts                PASS     2.2s      0     .test-logs/tests__parcours__canaux-invariant.test.ts.log
tests/parcours/canaux-vente.test.ts                    PASS     5.7s      0     .test-logs/tests__parcours__canaux-vente.test.ts.log
tests/parcours/changement-role-admin.test.ts           PASS     1.2s      0     .test-logs/tests__parcours__changement-role-admin.test.ts.log
tests/parcours/client-interface.test.ts                PASS     1.8s      0     .test-logs/tests__parcours__client-interface.test.ts.log
tests/parcours/cloture-vocabulaire.test.ts             PASS     1.6s      0     .test-logs/tests__parcours__cloture-vocabulaire.test.ts.log
tests/parcours/commissions-plafond.test.ts             PASS     7.3s      0     .test-logs/tests__parcours__commissions-plafond.test.ts.log
tests/parcours/compte-numero.test.ts                   PASS     14.3s     0     .test-logs/tests__parcours__compte-numero.test.ts.log
tests/parcours/compte-paiements.test.ts                PASS     5.3s      0     .test-logs/tests__parcours__compte-paiements.test.ts.log
tests/parcours/compte-photo.test.ts                    PASS     9.6s      0     .test-logs/tests__parcours__compte-photo.test.ts.log
tests/parcours/compte-profil.test.ts                   PASS     6.5s      0     .test-logs/tests__parcours__compte-profil.test.ts.log
tests/parcours/confirmation-achat.test.ts              PASS     3.3s      0     .test-logs/tests__parcours__confirmation-achat.test.ts.log
tests/parcours/course-annulation-transfert.test.ts     PASS     3.2s      0     .test-logs/tests__parcours__course-annulation-transfert.test.ts.log
tests/parcours/course-confirmation-annulation.test.ts  PASS     3.2s      0     .test-logs/tests__parcours__course-confirmation-annulation.test.ts.log
tests/parcours/course-verrous-lot9.test.ts             PASS     3.9s      0     .test-logs/tests__parcours__course-verrous-lot9.test.ts.log
tests/parcours/cycle-annulation.test.ts                PASS     12.6s     0     .test-logs/tests__parcours__cycle-annulation.test.ts.log
tests/parcours/cycle-cron.test.ts                      PASS     2.5s      0     .test-logs/tests__parcours__cycle-cron.test.ts.log
tests/parcours/cycle-invariant.test.ts                 PASS     1.8s      0     .test-logs/tests__parcours__cycle-invariant.test.ts.log
tests/parcours/cycle-transitions.test.ts               PASS     13.4s     0     .test-logs/tests__parcours__cycle-transitions.test.ts.log
tests/parcours/cycle-visibilite.test.ts                PASS     1.7s      0     .test-logs/tests__parcours__cycle-visibilite.test.ts.log
tests/parcours/decouverte-cache.test.ts                PASS     437ms     0     .test-logs/tests__parcours__decouverte-cache.test.ts.log
tests/parcours/decouverte-ecrans.test.ts               PASS     434ms     0     .test-logs/tests__parcours__decouverte-ecrans.test.ts.log
tests/parcours/decouverte-populaires.test.ts           PASS     3.6s      0     .test-logs/tests__parcours__decouverte-populaires.test.ts.log
tests/parcours/decouverte-recherche-lot9.test.ts       PASS     2.4s      0     .test-logs/tests__parcours__decouverte-recherche-lot9.test.ts.log
tests/parcours/decouverte-recherche.test.ts            PASS     1.8s      0     .test-logs/tests__parcours__decouverte-recherche.test.ts.log
tests/parcours/decouverte-ville.test.ts                PASS     2.5s      0     .test-logs/tests__parcours__decouverte-ville.test.ts.log
tests/parcours/design-systeme.test.ts                  PASS     3.1s      0     .test-logs/tests__parcours__design-systeme.test.ts.log
tests/parcours/dette-admin-services.test.ts            PASS     1.7s      0     .test-logs/tests__parcours__dette-admin-services.test.ts.log
tests/parcours/dette-annulation-transferts.test.ts     PASS     2.9s      0     .test-logs/tests__parcours__dette-annulation-transferts.test.ts.log
tests/parcours/dette-categories-publiques.test.ts      PASS     2.1s      0     .test-logs/tests__parcours__dette-categories-publiques.test.ts.log
tests/parcours/dette-cloture-caisse.test.ts            PASS     4.5s      0     .test-logs/tests__parcours__dette-cloture-caisse.test.ts.log
tests/parcours/dette-guichet.test.ts                   PASS     1.9s      0     .test-logs/tests__parcours__dette-guichet.test.ts.log
tests/parcours/dette-incidents.test.ts                 PASS     6.8s      0     .test-logs/tests__parcours__dette-incidents.test.ts.log
tests/parcours/dette-interface-lot7.test.ts            PASS     3.7s      0     .test-logs/tests__parcours__dette-interface-lot7.test.ts.log
tests/parcours/dette-publication-reservations.test.ts  PASS     22.8s     0     .test-logs/tests__parcours__dette-publication-reservations.test.ts.log
tests/parcours/dette-retrait-controleur.test.ts        PASS     3.7s      0     .test-logs/tests__parcours__dette-retrait-controleur.test.ts.log
tests/parcours/dette-roles-otp.test.ts                 PASS     2.2s      0     .test-logs/tests__parcours__dette-roles-otp.test.ts.log
tests/parcours/dette-suppression-evenement.test.ts     PASS     2.4s      0     .test-logs/tests__parcours__dette-suppression-evenement.test.ts.log
tests/parcours/dette-suspendu-temps-reel.test.ts       PASS     55.0s     0     .test-logs/tests__parcours__dette-suspendu-temps-reel.test.ts.log
tests/parcours/dette-transferts.test.ts                PASS     2.3s      0     .test-logs/tests__parcours__dette-transferts.test.ts.log
tests/parcours/documents-inscription.test.ts           PASS     2.0s      0     .test-logs/tests__parcours__documents-inscription.test.ts.log
tests/parcours/double-paiement.test.ts                 PASS     6.7s      0     .test-logs/tests__parcours__double-paiement.test.ts.log
tests/parcours/ecritures-ignorees.test.ts              PASS     4.0s      0     .test-logs/tests__parcours__ecritures-ignorees.test.ts.log
tests/parcours/edition-categories.test.ts              PASS     3.2s      0     .test-logs/tests__parcours__edition-categories.test.ts.log
tests/parcours/edition-formulaire.test.ts              PASS     6.2s      0     .test-logs/tests__parcours__edition-formulaire.test.ts.log
tests/parcours/edition-services.test.ts                PASS     1.3s      0     .test-logs/tests__parcours__edition-services.test.ts.log
tests/parcours/edition-validation.test.ts              PASS     1.3s      0     .test-logs/tests__parcours__edition-validation.test.ts.log
tests/parcours/email-optionnel.test.ts                 PASS     1.2s      0     .test-logs/tests__parcours__email-optionnel.test.ts.log
tests/parcours/equipe-eligibilite.test.ts              PASS     5.1s      0     .test-logs/tests__parcours__equipe-eligibilite.test.ts.log
tests/parcours/essai-middleware.test.ts                PASS     860ms     0     .test-logs/tests__parcours__essai-middleware.test.ts.log
tests/parcours/essai-seed-dev.test.ts                  PASS     2.8s      0     .test-logs/tests__parcours__essai-seed-dev.test.ts.log
tests/parcours/essai-simule.test.ts                    PASS     8.6s      0     .test-logs/tests__parcours__essai-simule.test.ts.log
tests/parcours/evenement-404.test.ts                   PASS     2.6s      0     .test-logs/tests__parcours__evenement-404.test.ts.log
tests/parcours/filtres-postgrest.test.ts               PASS     662ms     0     .test-logs/tests__parcours__filtres-postgrest.test.ts.log
tests/parcours/finance-affichage.test.ts               PASS     1.8s      0     .test-logs/tests__parcours__finance-affichage.test.ts.log
tests/parcours/finance-annulation.test.ts              PASS     2.6s      0     .test-logs/tests__parcours__finance-annulation.test.ts.log
tests/parcours/finance-cibles.test.ts                  PASS     2.0s      0     .test-logs/tests__parcours__finance-cibles.test.ts.log
tests/parcours/finance-commissions.test.ts             PASS     5.2s      0     .test-logs/tests__parcours__finance-commissions.test.ts.log
tests/parcours/finance-hors-plateforme.test.ts         PASS     1.8s      0     .test-logs/tests__parcours__finance-hors-plateforme.test.ts.log
tests/parcours/finance-invariant.test.ts               PASS     625ms     0     .test-logs/tests__parcours__finance-invariant.test.ts.log
tests/parcours/finance-moteur.test.ts                  PASS     1.8s      0     .test-logs/tests__parcours__finance-moteur.test.ts.log
tests/parcours/finance-rapports.test.ts                PASS     2.0s      0     .test-logs/tests__parcours__finance-rapports.test.ts.log
tests/parcours/finance-reglages.test.ts                PASS     1.7s      0     .test-logs/tests__parcours__finance-reglages.test.ts.log
tests/parcours/finance-remboursement-billet.test.ts    PASS     2.4s      0     .test-logs/tests__parcours__finance-remboursement-billet.test.ts.log
tests/parcours/finance-retraits.test.ts                PASS     7.8s      0     .test-logs/tests__parcours__finance-retraits.test.ts.log
tests/parcours/hors-ligne-client.test.ts               PASS     2.1s      0     .test-logs/tests__parcours__hors-ligne-client.test.ts.log
tests/parcours/hors-ligne-codes.test.ts                PASS     13.7s     0     .test-logs/tests__parcours__hors-ligne-codes.test.ts.log
tests/parcours/hors-ligne-rotation.test.ts             PASS     8.3s      0     .test-logs/tests__parcours__hors-ligne-rotation.test.ts.log
tests/parcours/hors-ligne-service-worker.test.ts       PASS     2.6s      0     .test-logs/tests__parcours__hors-ligne-service-worker.test.ts.log
tests/parcours/inscription-numero-dabord.test.ts       PASS     2.7s      0     .test-logs/tests__parcours__inscription-numero-dabord.test.ts.log
tests/parcours/interrupteurs.test.ts                   PASS     3.4s      0     .test-logs/tests__parcours__interrupteurs.test.ts.log
tests/parcours/invitation-identite.test.ts             PASS     1.7s      0     .test-logs/tests__parcours__invitation-identite.test.ts.log
tests/parcours/invitations-annulation.test.ts          PASS     4.9s      0     .test-logs/tests__parcours__invitations-annulation.test.ts.log
tests/parcours/invitations-course.test.ts              PASS     2.6s      0     .test-logs/tests__parcours__invitations-course.test.ts.log
tests/parcours/invitations-quotas.test.ts              PASS     3.3s      0     .test-logs/tests__parcours__invitations-quotas.test.ts.log
tests/parcours/invitations-reclamation.test.ts         PASS     3.9s      0     .test-logs/tests__parcours__invitations-reclamation.test.ts.log
tests/parcours/invitations.test.ts                     PASS     8.2s      0     .test-logs/tests__parcours__invitations.test.ts.log
tests/parcours/lectures-ignorees.test.ts               PASS     4.2s      0     .test-logs/tests__parcours__lectures-ignorees.test.ts.log
tests/parcours/legacy-billet-pdf.test.ts               PASS     2.5s      0     .test-logs/tests__parcours__legacy-billet-pdf.test.ts.log
tests/parcours/legacy-exports-partenaire.test.ts       PASS     2.7s      0     .test-logs/tests__parcours__legacy-exports-partenaire.test.ts.log
tests/parcours/lot9-invariant.test.ts                  PASS     3.0s      0     .test-logs/tests__parcours__lot9-invariant.test.ts.log
tests/parcours/messages-bruts.test.ts                  PASS     2.6s      0     .test-logs/tests__parcours__messages-bruts.test.ts.log
tests/parcours/nettoyage-sur-place.test.ts             PASS     2.6s      0     .test-logs/tests__parcours__nettoyage-sur-place.test.ts.log
tests/parcours/notif-abonnement.test.ts                PASS     1.5s      0     .test-logs/tests__parcours__notif-abonnement.test.ts.log
tests/parcours/notif-admin.test.ts                     PASS     4.3s      0     .test-logs/tests__parcours__notif-admin.test.ts.log
tests/parcours/notif-admins.test.ts                    PASS     6.0s      0     .test-logs/tests__parcours__notif-admins.test.ts.log
tests/parcours/notif-canaux.test.ts                    PASS     5.7s      0     .test-logs/tests__parcours__notif-canaux.test.ts.log
tests/parcours/notif-cloche.test.ts                    PASS     17.7s     0     .test-logs/tests__parcours__notif-cloche.test.ts.log
tests/parcours/notif-controleurs.test.ts               PASS     5.0s      0     .test-logs/tests__parcours__notif-controleurs.test.ts.log
tests/parcours/notif-envoyeur.test.ts                  PASS     3.6s      0     .test-logs/tests__parcours__notif-envoyeur.test.ts.log
tests/parcours/notif-interface.test.ts                 PASS     3.4s      0     .test-logs/tests__parcours__notif-interface.test.ts.log
tests/parcours/notif-invariant.test.ts                 PASS     1.7s      0     .test-logs/tests__parcours__notif-invariant.test.ts.log
tests/parcours/notif-migration.test.ts                 PASS     2.1s      0     .test-logs/tests__parcours__notif-migration.test.ts.log
tests/parcours/notif-modeles.test.ts                   PASS     1.4s      0     .test-logs/tests__parcours__notif-modeles.test.ts.log
tests/parcours/notif-outbox.test.ts                    PASS     2.5s      0     .test-logs/tests__parcours__notif-outbox.test.ts.log
tests/parcours/notif-preferences.test.ts               PASS     4.8s      0     .test-logs/tests__parcours__notif-preferences.test.ts.log
tests/parcours/notif-pros.test.ts                      PASS     13.0s     0     .test-logs/tests__parcours__notif-pros.test.ts.log
tests/parcours/notif-rappels-annulation.test.ts        PASS     5.3s      0     .test-logs/tests__parcours__notif-rappels-annulation.test.ts.log
tests/parcours/notif-rappels.test.ts                   PASS     8.2s      0     .test-logs/tests__parcours__notif-rappels.test.ts.log
tests/parcours/notif-reglages.test.ts                  PASS     3.0s      0     .test-logs/tests__parcours__notif-reglages.test.ts.log
tests/parcours/notif-transferts.test.ts                PASS     4.6s      0     .test-logs/tests__parcours__notif-transferts.test.ts.log
tests/parcours/otp-hachage.test.ts                     PASS     591ms     0     .test-logs/tests__parcours__otp-hachage.test.ts.log
tests/parcours/otp-objet.test.ts                       PASS     1.8s      0     .test-logs/tests__parcours__otp-objet.test.ts.log
tests/parcours/otp-serveur.test.ts                     PASS     984ms     0     .test-logs/tests__parcours__otp-serveur.test.ts.log
tests/parcours/paiement-attente-lot7.test.ts           PASS     4.0s      0     .test-logs/tests__parcours__paiement-attente-lot7.test.ts.log
tests/parcours/paiement-confirmation.test.ts           PASS     1.8s      0     .test-logs/tests__parcours__paiement-confirmation.test.ts.log
tests/parcours/paiement-controles.test.ts              PASS     2.4s      0     .test-logs/tests__parcours__paiement-controles.test.ts.log
tests/parcours/paiement-gratuits.test.ts               PASS     2.1s      0     .test-logs/tests__parcours__paiement-gratuits.test.ts.log
tests/parcours/paiement-operateur.test.ts              PASS     1.1s      0     .test-logs/tests__parcours__paiement-operateur.test.ts.log
tests/parcours/paiement-reconciliation.test.ts         PASS     1.7s      0     .test-logs/tests__parcours__paiement-reconciliation.test.ts.log
tests/parcours/paiement-remboursement.test.ts          PASS     2.6s      0     .test-logs/tests__parcours__paiement-remboursement.test.ts.log
tests/parcours/paiement-reservation.test.ts            PASS     2.2s      0     .test-logs/tests__parcours__paiement-reservation.test.ts.log
tests/parcours/paiement-retour.test.ts                 PASS     864ms     0     .test-logs/tests__parcours__paiement-retour.test.ts.log
tests/parcours/paiement-statut.test.ts                 PASS     1.5s      0     .test-logs/tests__parcours__paiement-statut.test.ts.log
tests/parcours/paiement-webhook.test.ts                PASS     2.7s      0     .test-logs/tests__parcours__paiement-webhook.test.ts.log
tests/parcours/pannes-absences.test.ts                 PASS     3.4s      0     .test-logs/tests__parcours__pannes-absences.test.ts.log
tests/parcours/parrainage-boucle-update.test.ts        PASS     2.5s      0     .test-logs/tests__parcours__parrainage-boucle-update.test.ts.log
tests/parcours/parrainage-gardes.test.ts               PASS     2.2s      0     .test-logs/tests__parcours__parrainage-gardes.test.ts.log
tests/parcours/parrainage-lien.test.ts                 PASS     2.9s      0     .test-logs/tests__parcours__parrainage-lien.test.ts.log
tests/parcours/partenaire-liste.test.ts                PASS     3.6s      0     .test-logs/tests__parcours__partenaire-liste.test.ts.log
tests/parcours/partenaire-lot7.test.ts                 PASS     7.5s      0     .test-logs/tests__parcours__partenaire-lot7.test.ts.log
tests/parcours/partenaire-profil-rpc.test.ts           PASS     6.3s      0     .test-logs/tests__parcours__partenaire-profil-rpc.test.ts.log
tests/parcours/perf-statique.test.ts                   PASS     3.6s      0     .test-logs/tests__parcours__perf-statique.test.ts.log
tests/parcours/pilotage-acces.test.ts                  PASS     13.3s     0     .test-logs/tests__parcours__pilotage-acces.test.ts.log
tests/parcours/pilotage-apercu-ventes.test.ts          PASS     4.3s      0     .test-logs/tests__parcours__pilotage-apercu-ventes.test.ts.log
tests/parcours/pilotage-cloture-export.test.ts         PASS     4.4s      0     .test-logs/tests__parcours__pilotage-cloture-export.test.ts.log
tests/parcours/pilotage-entrees.test.ts                PASS     19.9s     0     .test-logs/tests__parcours__pilotage-entrees.test.ts.log
tests/parcours/pilotage-equipe-caisse.test.ts          PASS     4.2s      0     .test-logs/tests__parcours__pilotage-equipe-caisse.test.ts.log
tests/parcours/pilotage-invariant.test.ts              PASS     4.9s      0     .test-logs/tests__parcours__pilotage-invariant.test.ts.log
tests/parcours/pilotage-remboursement-billet.test.ts   PASS     5.3s      0     .test-logs/tests__parcours__pilotage-remboursement-billet.test.ts.log
tests/parcours/pin-regisseur.test.ts                   PASS     535ms     0     .test-logs/tests__parcours__pin-regisseur.test.ts.log
tests/parcours/push-abonnements.test.ts                PASS     5.1s      0     .test-logs/tests__parcours__push-abonnements.test.ts.log
tests/parcours/push-service-worker.test.ts             PASS     1.4s      0     .test-logs/tests__parcours__push-service-worker.test.ts.log
tests/parcours/pwa-manifest.test.ts                    PASS     1.8s      0     .test-logs/tests__parcours__pwa-manifest.test.ts.log
tests/parcours/rappels-gratuits.test.ts                PASS     4.3s      0     .test-logs/tests__parcours__rappels-gratuits.test.ts.log
tests/parcours/realtime-diagnostic.test.ts             PASS     713ms     0     .test-logs/tests__parcours__realtime-diagnostic.test.ts.log
tests/parcours/realtime-scanner.test.ts                PASS     13.3s     0     .test-logs/tests__parcours__realtime-scanner.test.ts.log
tests/parcours/recette-invariant.test.ts               PASS     2.6s      0     .test-logs/tests__parcours__recette-invariant.test.ts.log
tests/parcours/remboursement-relance.test.ts           PASS     3.5s      0     .test-logs/tests__parcours__remboursement-relance.test.ts.log
tests/parcours/revocation-sessions.test.ts             PASS     1.9s      0     .test-logs/tests__parcours__revocation-sessions.test.ts.log
tests/parcours/roles-fraicheur.test.ts                 PASS     1.1s      0     .test-logs/tests__parcours__roles-fraicheur.test.ts.log
tests/parcours/roles-metadonnees.test.ts               PASS     765ms     0     .test-logs/tests__parcours__roles-metadonnees.test.ts.log
tests/parcours/scan-controleur-stats.test.ts           PASS     5.6s      0     .test-logs/tests__parcours__scan-controleur-stats.test.ts.log
tests/parcours/scan-idempotence.test.ts                PASS     3.9s      0     .test-logs/tests__parcours__scan-idempotence.test.ts.log
tests/parcours/scan-renvoi-seulement.test.ts           PASS     5.4s      0     .test-logs/tests__parcours__scan-renvoi-seulement.test.ts.log
tests/parcours/scanner-interface.test.ts               PASS     4.9s      0     .test-logs/tests__parcours__scanner-interface.test.ts.log
tests/parcours/scanner-reprise.test.ts                 PASS     1.5s      0     .test-logs/tests__parcours__scanner-reprise.test.ts.log
tests/parcours/securite-admin-lot7.test.ts             PASS     6.1s      0     .test-logs/tests__parcours__securite-admin-lot7.test.ts.log
tests/parcours/sms-anti-abus.test.ts                   PASS     1.1s      0     .test-logs/tests__parcours__sms-anti-abus.test.ts.log
tests/parcours/sms-commande-4-billets.test.ts          PASS     2.0s      0     .test-logs/tests__parcours__sms-commande-4-billets.test.ts.log
tests/parcours/statut-compte.test.ts                   PASS     2.6s      0     .test-logs/tests__parcours__statut-compte.test.ts.log
tests/parcours/temps-reel-billets.test.ts              PASS     41.0s     0     .test-logs/tests__parcours__temps-reel-billets.test.ts.log
tests/parcours/temps-reel-hook.test.ts                 PASS     390ms     0     .test-logs/tests__parcours__temps-reel-hook.test.ts.log
tests/parcours/temps-reel-prives.test.ts               PASS     78.9s     0     .test-logs/tests__parcours__temps-reel-prives.test.ts.log
tests/parcours/temps-reel-public.test.ts               PASS     27.1s     0     .test-logs/tests__parcours__temps-reel-public.test.ts.log
tests/parcours/temps-reel-stock.test.ts                PASS     26.4s     0     .test-logs/tests__parcours__temps-reel-stock.test.ts.log
tests/parcours/sms-plafond-optionnel.test.ts           PASS     14.5s     0     .test-logs/tests__parcours__sms-plafond-optionnel.test.ts.log
tests/parcours/sms-veille.test.ts                      PASS     5.0s      0     .test-logs/tests__parcours__sms-veille.test.ts.log
tests/parcours/terrain-invariant.test.ts               PASS     2.5s      0     .test-logs/tests__parcours__terrain-invariant.test.ts.log
tests/partner-halls-m7.test.ts                         PASS     1.6s      0     .test-logs/tests__partner-halls-m7.test.ts.log
tests/partner-orders-m9.test.ts                        PASS     1.7s      0     .test-logs/tests__partner-orders-m9.test.ts.log
tests/samirpay-contrat.test.ts                         PASS     3.8s      0     .test-logs/tests__samirpay-contrat.test.ts.log
tests/scanner-combat-ui.test.ts                        PASS     553ms     0     .test-logs/tests__scanner-combat-ui.test.ts.log
tests/schema/code-mort-lot9.test.ts                    PASS     370ms     0     .test-logs/tests__schema__code-mort-lot9.test.ts.log
tests/schema/essai-cron-local.test.ts                  PASS     1.3s      0     .test-logs/tests__schema__essai-cron-local.test.ts.log
tests/schema/essai-env-local.test.ts                   PASS     982ms     0     .test-logs/tests__schema__essai-env-local.test.ts.log
tests/schema/essai-faux-samirpay.test.ts               PASS     1.8s      0     .test-logs/tests__schema__essai-faux-samirpay.test.ts.log
tests/schema/essai-integrations.test.ts                PASS     7.6s      0     .test-logs/tests__schema__essai-integrations.test.ts.log
tests/schema/essai-route-dev.test.ts                   PASS     368ms     0     .test-logs/tests__schema__essai-route-dev.test.ts.log
tests/schema/essai-seed-gardes.test.ts                 PASS     994ms     0     .test-logs/tests__schema__essai-seed-gardes.test.ts.log
tests/schema/fonctions-privileges.test.ts              PASS     417ms     0     .test-logs/tests__schema__fonctions-privileges.test.ts.log
tests/schema/hotfix-identique.test.ts                  PASS     345ms     0     .test-logs/tests__schema__hotfix-identique.test.ts.log
tests/schema/hotfix-scripts.test.ts                    PASS     872ms     0     .test-logs/tests__schema__hotfix-scripts.test.ts.log
tests/schema/messages-bruts.test.ts                    PASS     1.9s      0     .test-logs/tests__schema__messages-bruts.test.ts.log
tests/schema/migration-lot6-rejouable.test.ts          PASS     510ms     0     .test-logs/tests__schema__migration-lot6-rejouable.test.ts.log
tests/schema/migration-lot7-rejouable.test.ts          PASS     1.9s      0     .test-logs/tests__schema__migration-lot7-rejouable.test.ts.log
tests/schema/migration-lot8-rejouable.test.ts          PASS     1.9s      0     .test-logs/tests__schema__migration-lot8-rejouable.test.ts.log
tests/schema/migration-lot9-rejouable.test.ts          PASS     1.8s      0     .test-logs/tests__schema__migration-lot9-rejouable.test.ts.log
tests/schema/migrations-gelees.test.ts                 PASS     337ms     0     .test-logs/tests__schema__migrations-gelees.test.ts.log
tests/schema/ordre-suites.test.ts                      PASS     593ms     0     .test-logs/tests__schema__ordre-suites.test.ts.log
tests/schema/planification-crons.test.ts               PASS     1.7s      0     .test-logs/tests__schema__planification-crons.test.ts.log
tests/schema/recette-matrice.test.ts                   PASS     437ms     0     .test-logs/tests__schema__recette-matrice.test.ts.log
tests/schema/reset-test-password.test.ts               PASS     366ms     0     .test-logs/tests__schema__reset-test-password.test.ts.log
tests/schema/rls-toutes-tables.test.ts                 PASS     380ms     0     .test-logs/tests__schema__rls-toutes-tables.test.ts.log
tests/schema/secrets-codes-en-dur.test.ts              PASS     442ms     0     .test-logs/tests__schema__secrets-codes-en-dur.test.ts.log
tests/schema/validations-metier.test.ts                PASS     476ms     0     .test-logs/tests__schema__validations-metier.test.ts.log
tests/security/anon-uniquement.test.ts                 PASS     346ms     0     .test-logs/tests__security__anon-uniquement.test.ts.log
tests/security/r1-inscription-roles.test.ts            PASS     1.5s      0     .test-logs/tests__security__r1-inscription-roles.test.ts.log
tests/security/r10-user-roles.test.ts                  PASS     2.1s      0     .test-logs/tests__security__r10-user-roles.test.ts.log
tests/security/r11-storage-documents.test.ts           PASS     772ms     0     .test-logs/tests__security__r11-storage-documents.test.ts.log
tests/security/r12-reglages-finance.test.ts            PASS     656ms     0     .test-logs/tests__security__r12-reglages-finance.test.ts.log
tests/security/r13-parrainage-relations.test.ts        PASS     913ms     0     .test-logs/tests__security__r13-parrainage-relations.test.ts.log
tests/security/r14-retraits-insertion.test.ts          PASS     716ms     0     .test-logs/tests__security__r14-retraits-insertion.test.ts.log
tests/security/r15-statut-ambassadeur.test.ts          PASS     768ms     0     .test-logs/tests__security__r15-statut-ambassadeur.test.ts.log
tests/security/r16-reglages-acces.test.ts              PASS     639ms     0     .test-logs/tests__security__r16-reglages-acces.test.ts.log
tests/security/r17-statut-evenement-rest.test.ts       PASS     617ms     0     .test-logs/tests__security__r17-statut-evenement-rest.test.ts.log
tests/security/r18-partenaires-public.test.ts          PASS     1.3s      0     .test-logs/tests__security__r18-partenaires-public.test.ts.log
tests/security/r19-categories-transferts.test.ts       PASS     855ms     0     .test-logs/tests__security__r19-categories-transferts.test.ts.log
tests/security/r2-otp-codes.test.ts                    PASS     582ms     0     .test-logs/tests__security__r2-otp-codes.test.ts.log
tests/security/r20-evenements-ecritures-rest.test.ts   PASS     684ms     0     .test-logs/tests__security__r20-evenements-ecritures-rest.test.ts.log
tests/security/r21-notifications-rest.test.ts          PASS     1.1s      0     .test-logs/tests__security__r21-notifications-rest.test.ts.log
tests/security/r22-reglages-notif.test.ts              PASS     767ms     0     .test-logs/tests__security__r22-reglages-notif.test.ts.log
tests/security/r23-reglages-lot7.test.ts               PASS     824ms     0     .test-logs/tests__security__r23-reglages-lot7.test.ts.log
tests/security/r24-categories-anon.test.ts             PASS     690ms     0     .test-logs/tests__security__r24-categories-anon.test.ts.log
tests/security/r25-commandes-idor.test.ts              PASS     1.2s      0     .test-logs/tests__security__r25-commandes-idor.test.ts.log
tests/security/r26-brouillon-autre-partenaire.test.ts  PASS     2.2s      0     .test-logs/tests__security__r26-brouillon-autre-partenaire.test.ts.log
tests/security/r27-avatars.test.ts                     PASS     4.4s      0     .test-logs/tests__security__r27-avatars.test.ts.log
tests/security/r28-middleware-matrice.test.ts          PASS     2.5s      0     .test-logs/tests__security__r28-middleware-matrice.test.ts.log
tests/security/r3-fonctions-rpc.test.ts                PASS     1.6s      0     .test-logs/tests__security__r3-fonctions-rpc.test.ts.log
tests/security/r4-ecritures-directes.test.ts           PASS     659ms     0     .test-logs/tests__security__r4-ecritures-directes.test.ts.log
tests/security/r5-lectures-anon.test.ts                PASS     1.6s      0     .test-logs/tests__security__r5-lectures-anon.test.ts.log
tests/security/r6-roles-jeton.test.ts                  PASS     1.5s      0     .test-logs/tests__security__r6-roles-jeton.test.ts.log
tests/security/r7-profil-colonnes.test.ts              PASS     853ms     0     .test-logs/tests__security__r7-profil-colonnes.test.ts.log
tests/security/r8-controleur-lectures.test.ts          PASS     3.6s      0     .test-logs/tests__security__r8-controleur-lectures.test.ts.log
tests/security/r9-partenaire-ecritures.test.ts         PASS     660ms     0     .test-logs/tests__security__r9-partenaire-ecritures.test.ts.log
tests/sms-formatage.test.ts                            PASS     431ms     0     .test-logs/tests__sms-formatage.test.ts.log
tests/ux-performance-and-double-click.test.ts          PASS     877ms     0     .test-logs/tests__ux-performance-and-double-click.test.ts.log
──────────────────────────────────────────────────────
TOTAL : 244 suite(s) — 244 réussie(s), 0 en échec, 0 expirée(s)
```

```text
# run 113 — docs/lot9-logs/ci-run113-verify.log:30049-30326, build résumé
═══════════════ verify › build : npm run build ═══════════════
 ✓ Compiled successfully
 ✓ Generating static pages (57/57)
[…]
═══════════════ verify › js-budget : node scripts/js-budget.mjs ═══════════════
[JS-BUDGET] budgets : scripts/js-budget.json
[JS-BUDGET] / : 216801 octets gzip (216,8 Ko), 18 fichier(s) JS, 746743 octets bruts — budget 217000 octets (217,0 Ko) : OK
[JS-BUDGET] /events/[id] : 221939 octets gzip (221,9 Ko), 17 fichier(s) JS, 768358 octets bruts — budget 224000 octets (224,0 Ko) : OK
[JS-BUDGET] /tickets : 239011 octets gzip (239,0 Ko), 21 fichier(s) JS, 816890 octets bruts — budget 241000 octets (241,0 Ko) : OK
[JS-BUDGET] /controller/scanner : 223075 octets gzip (223,1 Ko), 18 fichier(s) JS, 769322 octets bruts — budget 226000 octets (226,0 Ko) : OK
[JS-BUDGET] /billet/hors-ligne : 212701 octets gzip (212,7 Ko), 16 fichier(s) JS, 736817 octets bruts — budget 215000 octets (215,0 Ko) : OK
[JS-BUDGET] tableau écrit : .verify/js-budget.tsv
[JS-BUDGET] toutes les routes budgétées sont dans leur budget.

[verify] OK — 5 étapes réussies en 1123s.
```

### 6.3 Run 113, `npm run e2e`

```text
# run 113 (d255bf3) — docs/lot9-logs/ci-run113-e2e.log, lignes filtrées (phases, ✓ et ✘ hors captures, résumés) ; les 349 ✓ de la phase captures sont au journal
[e2e] faux services : HTTP 200
[e2e] application   : HTTP 200
═══════════════ e2e › connexion : playwright test --project=setup ═══════════════
Running 10 tests using 2 workers
  ✓   2 [setup] › e2e/auth.setup.ts:26:10 › connexion : organisateur (démonstration) (3.3s)
  ✓   1 [setup] › e2e/auth.setup.ts:26:10 › connexion : administrateur (démonstration, events.read et events.write) (3.6s)
  ✓   3 [setup] › e2e/auth.setup.ts:26:10 › connexion : client (démonstration) (2.8s)
  ✓   4 [setup] › e2e/auth.setup.ts:26:10 › connexion : contrôleur (démonstration) (2.7s)
  ✓   5 [setup] › e2e/auth.setup.ts:26:10 › connexion : partenaire « premiers pas » (démonstration, aucun événement) (2.3s)
  ✓   6 [setup] › e2e/auth.setup.ts:26:10 › connexion : organisateur A (seed de test) (2.3s)
  ✓   8 [setup] › e2e/auth.setup.ts:26:10 › connexion : client (seed de test) (3.3s)
  ✓   7 [setup] › e2e/auth.setup.ts:26:10 › connexion : superadmin (seed de test) (3.6s)
  ✓   9 [setup] › e2e/auth.setup.ts:26:10 › connexion : second client (seed de test) (2.4s)
  ✓  10 [setup] › e2e/auth.setup.ts:26:10 › connexion : contrôleur A (seed de test) (2.5s)
  10 passed (15.8s)
[e2e] phase connexion : OK en 17s
═══════════════ e2e › captures : playwright test --project=mobile --project=desktop ═══════════════
Running 388 tests using 2 workers
[e2e] index des captures : .e2e-captures/captures/index.txt (349 entrée(s), 0 en échec)
  39 skipped
  349 passed (16.4m)
[e2e] phase captures : OK en 985s
═══════════════ e2e › emails : playwright test --project=emails --workers=1 ═══════════════
Running 5 tests using 1 worker
  ✓  1 [emails] › e2e/emails.spec.ts:142:9 › email achat-1-billet : 390 et 600 px, clair et sombre, sans ressource externe (1.4s)
  ✓  2 [emails] › e2e/emails.spec.ts:142:9 › email achat-4-billets : 390 et 600 px, clair et sombre, sans ressource externe (1.3s)
  ✓  3 [emails] › e2e/emails.spec.ts:142:9 › email achat-12-billets : 390 et 600 px, clair et sombre, sans ressource externe (1.4s)
  ✓  4 [emails] › e2e/emails.spec.ts:142:9 › email gratuits-2-billets : 390 et 600 px, clair et sombre, sans ressource externe (1.2s)
  ✓  5 [emails] › e2e/emails.spec.ts:142:9 › email transfert-recu : 390 et 600 px, clair et sombre, sans ressource externe (1.3s)
[e2e] index des captures : .e2e-captures/captures/index.txt (349 entrée(s), 0 en échec)
  5 passed (7.9s)
[e2e] phase emails : OK en 9s
═══════════════ e2e › dev-page : playwright test --project=dev-page --workers=1 ═══════════════
Running 4 tests using 1 worker
  ✓  1 [dev-page] › e2e/dev-page.spec.ts:53:13 › page de développement : mobile, clair (1.1s)
  ✓  2 [dev-page] › e2e/dev-page.spec.ts:53:13 › page de développement : mobile, sombre (1.0s)
  ✓  3 [dev-page] › e2e/dev-page.spec.ts:53:13 › page de développement : ordinateur, clair (831ms)
  ✓  4 [dev-page] › e2e/dev-page.spec.ts:53:13 › page de développement : ordinateur, sombre (894ms)
[e2e] index des captures : .e2e-captures/captures/index.txt (353 entrée(s), 0 en échec)
  4 passed (5.3s)
[e2e] phase dev-page : OK en 6s
═══════════════ e2e › fumee : playwright test --project=fumee ═══════════════
Running 2 tests using 1 worker
  ✓  1 [fumee] › e2e/fumee.spec.ts:91:5 › fumée : créer, soumettre, valider, publier, acheter, scanner, piloter (39.9s)
  ✓  2 [fumee] › e2e/fumee.spec.ts:604:5 › pages et routes de développement : 404 sur next start, avec et sans session (130ms)
[e2e] index des captures : .e2e-captures/captures/index.txt (353 entrée(s), 0 en échec)
  2 passed (41.3s)
[e2e] phase fumee : OK en 42s
═══════════════ e2e › terrain : playwright test --project=terrain --workers=1 ═══════════════
Running 13 tests using 1 worker
  ✓   1 [terrain] › e2e/terrain.spec.ts:119:9 › 1. téléphone en avance de 5 min : codes téléchargés, hors ligne, QR accepté par le contrôleur (4.3s)
  ✓   2 [terrain] › e2e/terrain.spec.ts:119:9 › 1. téléphone en retard de 5 min : codes téléchargés, hors ligne, QR accepté par le contrôleur (4.2s)
  ✓   3 [terrain] › e2e/terrain.spec.ts:154:5 › 2. cache du service worker : coquille hors ligne et ressources statiques seulement, anciens caches supprimés (2.5s)
  ✓   4 [terrain] › e2e/terrain.spec.ts:219:5 › 3. réponse du scan perdue : relance automatique avec la même clé, une seule entrée (2.7s)
  ✓   5 [terrain] › e2e/terrain.spec.ts:369:5 › 4. mesure du scan : billets neufs en réseau normal puis en 3G, relectures « déjà utilisé », puis une lecture hors ligne (1.6m)
  ✓   6 [terrain] › e2e/terrain.spec.ts:468:5 › 5. vibrations : accepté [60], refusé [120,60,120,60,120], motifs distincts, aucune vibration à la lecture (3.6s)
  ✓   7 [terrain] › e2e/terrain.spec.ts:506:5 › 6. onglet en arrière-plan : pistes de la caméra arrêtées (1.7s)
  ✓   8 [terrain] › e2e/terrain.spec.ts:604:5 › 7. reprise de session : même événement et même mode après une sortie, chiffres et historique relus, « Reprendre le contrôle », scan sans réponse renvoyé avec sa c …
  ✓   9 [terrain] › e2e/terrain.spec.ts:765:5 › 8. barre d’achat de la fiche : collée au bas de l’écran en haut de page et à mi-page, pleine largeur (2.0s)
  ✓  10 [terrain] › e2e/terrain.spec.ts:781:5 › 9. résultat du scanner : plein écran égal à la fenêtre, page défilée de force (2.2s)
  ✓  11 [terrain] › e2e/terrain.spec.ts:815:5 › 10. lot hors ligne : réponse compressée en gzip, moins de 40 000 octets transférés (1.8s)
  ✓  12 [terrain] › e2e/terrain.spec.ts:853:5 › 11. lecture jamais arrivée au serveur : au retour, « non traité », pas de « Résultat retrouvé », billet intact (3.5s)
  ✓  13 [terrain] › e2e/terrain.spec.ts:924:5 › 12. clôture de caisse avec écart, sans réponse imposée : refus 400, écart du serveur affiché, puis clôture juste (2.8s)
[e2e] index des captures : .e2e-captures/captures/index.txt (353 entrée(s), 0 en échec)
  13 passed (2.3m)
[e2e] phase terrain : OK en 137s
═══════════════ e2e › pwa : playwright test --project=pwa --workers=1 ═══════════════
Running 4 tests using 1 worker
  ✓  1 [pwa] › e2e/installable.spec.ts:109:5 › Chromium reconnaît l’application installable (beforeinstallprompt, aucune erreur d’installabilité) (2.0s)
  ✓  2 [pwa] › e2e/installable.spec.ts:147:5 › témoin négatif : manifest servi sans icône → Chromium signale l’icône manquante (1.1s)
  ✓  3 [pwa] › e2e/installable.spec.ts:166:5 › manifest servi : id, scope, start_url, standalone, couleurs, icônes 192 et 512 dont une maskable (contrat 4.5) (258ms)
  ✓  4 [pwa] › e2e/installable.spec.ts:193:5 › iPhone : balises apple-mobile-web-app et icône apple-touch 180×180 dans le <head> de l’accueil (644ms)
[e2e] index des captures : .e2e-captures/captures/index.txt (353 entrée(s), 0 en échec)
  4 passed (5.0s)
[e2e] phase pwa : OK en 6s
═══════════════ e2e › fake-prod : node scripts/e2e/fake-prod.mjs ═══════════════
[e2e] phase fake-prod : OK en 2s
═══════════════ e2e › perf : playwright test --project=perf --workers=1 ═══════════════
Running 4 tests using 1 worker
  ✓  1 [perf] › e2e/perf.spec.ts:374:9 › Accueil : premier affichage utile et JavaScript chargé, 4G simulée et processeur ×4 (5 passages) (45.4s)
  ✓  2 [perf] › e2e/perf.spec.ts:374:9 › Page événement : premier affichage utile et JavaScript chargé, 4G simulée et processeur ×4 (5 passages) (41.3s)
  ✓  3 [perf] › e2e/perf.spec.ts:374:9 › Mes billets : premier affichage utile et JavaScript chargé, 4G simulée et processeur ×4 (5 passages) (48.5s)
  ✓  4 [perf] › e2e/perf.spec.ts:374:9 › Scanner : premier affichage utile et JavaScript chargé, 4G simulée et processeur ×4 (5 passages) (58.1s)
[e2e] index des captures : .e2e-captures/captures/index.txt (353 entrée(s), 0 en échec)
  4 passed (3.2m)
[e2e] phase perf : OK en 195s
═══════════════ e2e › recette : playwright test --project=recette --workers=1 ═══════════════
Running 9 tests using 1 worker
  ✓  1 [recette] › e2e/recette.spec.ts:285:5 › acte 1 [admin] : délai de garde coupé à l’écran, motif exigé, historique ; un ADMIN est refusé (3.0s)
  ✓  2 [recette] › e2e/recette.spec.ts:323:5 › acte 2 [partenaire] [admin] : inscription avec pièces, validation, E1 et ses canaux, soumission, publication, E2 (9.2s)
  ✓  3 [recette] › e2e/recette.spec.ts:453:5 › acte 3 [partenaire] : invitation de K1, permission espèces, point d’entrée, PIN régisseur (1.9s)
  ✓  4 [recette] › e2e/recette.spec.ts:487:5 › acte 4 [client] : découverte, fiche, refus direct, inscription depuis l’achat, achats, Mes billets, transfert (20.8s)
  ✓  5 [recette] › e2e/recette.spec.ts:616:5 › acte 5 [contrôleur] : activation, caisse, scan en ligne et hors ligne, ancien code, saisie manuelle, guichet, reprise, clôture (17.6s)
  ✓  6 [recette] › e2e/recette.spec.ts:728:5 › acte 6 [partenaire] : pilotage, rapport de clôture, export, retrait, remboursement d’un billet à l’écran (5.9s)
  ✓  7 [recette] › e2e/recette.spec.ts:797:5 › acte 7 [client] [partenaire] : annulation de E2, envoyeur par la vraie route, billet remboursé, avis, bandeau public (2.5s)
  ✓  8 [recette] › e2e/recette.spec.ts:841:5 › acte 9 [partenaire] [client] [contrôleur] : invitation d’un numéro sans compte, inscription, réclamation, entrée (6.4s)
  ✓  9 [recette] › e2e/recette.spec.ts:944:5 › acte 8 [admin] : supervision et relance d’une notification, remboursement bloqué relancé (A3), événement et partenaire suspendus (8.8s)
[e2e] index des captures : .e2e-captures/captures/index.txt (353 entrée(s), 0 en échec)
  9 passed (1.4m)
[e2e] phase recette : OK en 84s
[e2e] durées : connexion 17s · captures 985s · emails 9s · dev-page 6s · fumee 42s · terrain 137s · pwa 6s · fake-prod 2s · perf 195s · recette 84s — total 1483s (24.7 min)
[e2e] résumé :connexion OK · captures OK · emails OK · dev-page OK · fumee OK · terrain OK · pwa OK · fake-prod OK · perf OK · recette OK
```

### 6.4 Run 113, CI (`run.txt`)

```text
# runs/113-42519327711/run.txt (ci-results) = docs/lot9-logs/ci-run113-run.txt
run_id=42519327711
run_number=113
sha=d255bf37d3bfda64f96967553cab705c407a6012
ref=refs/heads/lot9/billetterie-v1
job_status=success
build_mesure=skipped
e2e_seed=success
e2e=success
url=https://github.com/fallouu-mn/event-village/actions/runs/42519327711
job_elapsed_s=2813
npm_version=10.9.9
etape_npm-ci=debut_s:5 duree_s:22 code:0
etape_supabase-start=debut_s:28 duree_s:67 code:0
etape_db-reset=debut_s:95 duree_s:30 code:0
etape_env-test=debut_s:125 duree_s:1 code:0
etape_seed-test=debut_s:126 duree_s:2 code:0
etape_verify=debut_s:128 duree_s:1123 code:0
etape_e2e-chromium=debut_s:1254 duree_s:9 code:0
etape_e2e-env=debut_s:1263 duree_s:1 code:0
etape_e2e-seed=debut_s:1264 duree_s:54 code:0
etape_e2e-demarrage=debut_s:1318 duree_s:3 code:0
etape_e2e=debut_s:1321 duree_s:1481 code:0
```

Le job dure 2 813 s (46,9 min), sous le délai de 60 min (L53). L'étape `verify` dure 1 123 s, l'étape `e2e` 1 481 s.

`build_mesure=skipped` : cette étape ne tourne que si `verify` échoue. Le `[JS-BUDGET]` du run 113 vient donc de `verify` (section 11).

### 6.5 Tableau des runs 109 à 114

Source : `scratchpad/rap9/runs-table.txt`, valeurs telles que lues.

| Run | SHA | Job | Durée | Suites (total:vertes, rouges) | Phases e2e |
|---|---|---|---|---|---|
| 109-42419333354 | 534d6b3 | success | 2315s | 220:220ok 0ko | connexion OK · captures OK · emails OK · dev-page OK · fumee OK · terrain OK · pwa OK · fake-prod OK · perf OK · recette OK |
| 110-42499989446 | e6c23d1 | failure | 2847s | 250:212ok 38ko | connexion OK · captures ÉCHEC · emails OK · dev-page OK · fumee OK · terrain OK · pwa OK · fake-prod OK · perf OK · recette ÉCHEC |
| 111-42511133163 | 3c83ab1 | failure | 2587s | 245:241ok 4ko | connexion OK · captures OK · emails OK · dev-page OK · fumee OK · terrain OK · pwa OK · fake-prod OK · perf OK · recette OK |
| 112-42515091224 | d992ef2 | failure | 2663s | 244:243ok 1ko | connexion OK · captures OK · emails OK · dev-page OK · fumee OK · terrain OK · pwa OK · fake-prod OK · perf OK · recette OK |
| 113-42519327711 | d255bf3 | success | 2813s | 244:244ok 0ko | connexion OK · captures OK · emails OK · dev-page OK · fumee OK · terrain OK · pwa OK · fake-prod OK · perf OK · recette OK |
| 114-42526645647 | de4405a | failure | 2768 s | 244 sur 245 | toutes OK | seul rouge voulu : `audit-logs-rls`, ADMIN lit le journal (A24) |
| 115-42530621307 | 304d846 | **success** | 2835 s | **245 sur 245** | toutes OK, recette 9 actes | code final : politique RLS corrigée |

Remarques :
- **Run 109** : point de départ de la branche, `main` à 534d6b3.
- **Run 110** : run « avant », 38 suites rouges, tests rouges committés avant tout correctif. Les rouges non annoncés par la liste 10 du contrat sont traités par AM3.
- **Run 111** : 4 suites rouges, aucune instabilité, chacune corrigée par un commit signalé : `compte-paiements` (`ef265f34`, fixture), `invitations` (`667cb167`, fixture), `notif-migration` (`b3c5a735`, liste blanche), `code-mort-lot9` (`3ca034a4`, suppression d'`e2e-scenarios` après les ports vus verts). Budget de `/` à 217 389 octets, section 11.
- **Run 112** : une suite rouge, l'instabilité de 6.6. Budget de `/` à 217 012 octets, 12 de trop, section 11.
- **Run 113** : vert, 244 sur 244 et toutes les phases.
- **Run 114** : second run à code d'application identique, lancé après le commit de la matrice.

Passage de 250 suites au run 110 à 244 ensuite : les 6 suites A21 supprimées (section 5).

### 6.6 Instabilité observée une fois : `sms-veille` au run 112

Au run 112 (`d992ef2`), `tests/parcours/sms-veille.test.ts` échoue. Un SMS optionnel d'une autre suite, tombé le même jour tiré au hasard sur la plage partagée J+120 à J+1 800, fait passer `remaining` de 700 à 699. La cause est lue dans le message du commit `d8137513` et cohérente avec la valeur observée, mais je ne l'ai pas rejouée.

```text
# run 112 (d992ef2) — runs/112-42515091224/test-logs/tests__parcours__sms-veille.test.ts.log (ci-results), lignes duration_ms, type, location, code, opérateur et piles retirées ; lignes INVARIANT retirées
TAP version 13
# Subtest: 7.0 a Alerte de la veille : rappels SMS prévus pour demain au-delà du budget (M2.7, D16)
    # Subtest: 701 porteurs, plafond 700 : deux planifications → une seule alerte ADMIN_SMS_FORECAST par canal, { planned: 701, cap: 700, remaining: 700 }, un signal
    ok 1 - 701 porteurs, plafond 700 : deux planifications → une seule alerte ADMIN_SMS_FORECAST par canal, { planned: 701, cap: 700, remaining: 700 }, un signal
    # Subtest: 700 porteurs, plafond 700 : prévision égale au budget restant, aucune alerte
    not ok 2 - 700 porteurs, plafond 700 : prévision égale au budget restant, aucune alerte
      error: |-
        700 porteurs : aucune alerte ({"cap":700,"day":"2027-05-28","alerted":true,"planned":700,"remaining":699})
        true !== false
      expected: false
      actual: true
    1..2
not ok 1 - 7.0 a Alerte de la veille : rappels SMS prévus pour demain au-delà du budget (M2.7, D16)
  error: '1 subtest failed'
# Subtest: 7.0 a Alerte de la veille : porteurs sans SMS exclus de la prévision (D16, D17)
    # Subtest: billets gratuits seulement avec NEVER : non comptés ; témoin SAME_AS_PAID : comptés et alerte
    ok 1 - billets gratuits seulement avec NEVER : non comptés ; témoin SAME_AS_PAID : comptés et alerte
    # Subtest: plage de silence couvrant l’heure du J-1 (9 h - 11 h, J-1 à 10 h) : J-1 non comptés ; témoin J-1 à 12 h : comptés et alerte
    ok 2 - plage de silence couvrant l’heure du J-1 (9 h - 11 h, J-1 à 10 h) : J-1 non comptés ; témoin J-1 à 12 h : comptés et alerte
    1..2
ok 2 - 7.0 a Alerte de la veille : porteurs sans SMS exclus de la prévision (D16, D17)
1..2
# tests 4
# suites 2
# pass 3
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 3564.17475
```

Correctif, `d8137513` (test existant modifié, signalé, aucune assertion touchée) :

```text
# git show d8137513 -- tests/parcours/sms-veille.test.ts (lignes de diff seulement)
--- a/tests/parcours/sms-veille.test.ts
+++ b/tests/parcours/sms-veille.test.ts
@@ -67,10 +67,10 @@ before(async () => {
-/** Jour D futur tiré au hasard (J+120 à J+1 800), distinct des autres cas à ±2 jours près. */
+/** Jour D futur tiré au hasard (J+2 000 à J+3 680, hors des jours tirés par les autres suites), distinct des autres cas à ±2 jours près. */
-        const offset = 120 + randomInt(0, 1680);
+        const offset = 2000 + randomInt(0, 1680);
```

```text
# run 113 (d255bf3) — docs/lot9-logs/ci-run113-verify.log, récapitulatif
tests/parcours/sms-veille.test.ts                      PASS     5.0s      0     .test-logs/tests__parcours__sms-veille.test.ts.log
```

Une seule occurrence sur les 5 runs du tableau. Le test tire désormais ses jours sur J+2 000 à J+3 680. Que plus aucune autre suite ne tire dans cette plage : NON VÉRIFIÉ.

---

---

## 7. Ordre des verrous

**Ordre unique : `events` (`FOR NO KEY UPDATE` ou `FOR SHARE`) → paiements → catégories → transferts → billets.** `FOR KEY SHARE` (clé étrangère) n'est bloqué ni par NKU ni par `FOR SHARE`. Une catégorie prise **avant un billet** l'est en NKU, parce que les chemins qui tiennent un billet prennent `FOR KEY SHARE` sur la catégorie par `ticket_scans.category_id`.

**Tableau 3.3 du contrat, à jour.** Lignes `corrigé`, `ticket_invitation_create` et `ticket_invitation_cancel` relues dans les fichiers finaux (`M1` = `20261108000001_lot9_securite.sql`, `M2` = `20261108000002_lot9_invitations.sql`, `M5` = `20261108000005_lot9_nettoyage.sql`) ; les autres lignes sont recopiées du contrat, non relues une à une.

| Fonction | Ordre réel après le lot | Verdict |
|---|---|---|
| `payment_confirm` | events NKU → paiement → catégories `FOR UPDATE` → INSERT billets | conforme |
| `event_cancel` | events NKU → paiements → catégories NKU → transferts → billets | conforme |
| `checkout_create_payment` | catégories → verrou consultatif → INSERT payments (FK events KEY SHARE) | compatible avec NKU, c'est le remède de PO4 |
| `free_tickets_claim` | catégories `FOR UPDATE` → INSERT (FK) | conforme, aucun billet existant pris |
| `counter_sale` | caisse → catégories `FOR UPDATE` → INSERT (FK) | idem |
| `ticket_scan` | billet → INSERT `ticket_scans` (FK catégorie KEY SHARE, FK events KEY SHARE) | arête billet → catégorie, tenue seulement en KEY SHARE |
| `ticket_cash_checkin` | rectifié au contrat : scan → billet → commande → caisse → INSERT `ticket_scans` | **supprimée par M5** (`M5:314`) |
| `payment_release`, `stock_reservations_expire` | paiement → catégories ; catégories | conforme |
| `refund_request`, `cashout_finalize` | paiement ; cashout → remboursement → paiement → billets | conforme |
| `ticket_refund_request` | **corrigé** : paiement si présent (`M1:52`) → catégorie NKU (`M1:54`) → billet (`M1:55`) | PO3 |
| `event_update` | **corrigé** : events NKU (`M1:217`) → catégories `FOR UPDATE` (`M1:346`) → outbox ; trigger d'échéance : transferts | PO4 |
| `ticket_category_guard` | **corrigé** : events NKU (`M1:532`) → catégories (`M1:552`) | PO4 |
| `event_controller_set_cash` | rectifié au contrat : ne verrouille pas `events`, seulement `FOR UPDATE OF ec` | sans effet |
| `event_transition`, `events_finish_overdue` | events `FOR UPDATE` (SKIP LOCKED pour le second), aucune catégorie | attente sans cycle |
| `ticket_transfer_accept`, `ticket_offline_grant` | events `FOR SHARE` → transfert → billet (`ticket_transfer_accept` : `M2:122`, `M2:124`) | conforme, D20 tient (SHARE conflit NKU) |
| `ticket_transfer_initiate`, `_cancel`, `_claim`, `ticket_secret_rotate` | transfert → billet ; events lu sans verrou | aucun cycle (rectifie l'absence au tableau du lot 8) |
| `ticket_transfers_expire` | transferts SKIP LOCKED | conforme |
| `ticket_invitation_create` | events `FOR SHARE` (`M2:398`) → catégorie `FOR UPDATE` (`M2:425`) → INSERT billets, transferts | conforme : aucun billet existant pris, un scan attend sans cycle |
| `ticket_invitation_cancel` | events `FOR SHARE` (`M2:526`) → catégorie NKU (`M2:552`) → transferts (`M2:553`) → billet (`M2:554`) | conforme, même ordre que `ticket_transfer_accept` pour transfert puis billet |
| `events_invitation_expiry_sync` | dans la transaction qui tient `events` : UPDATE des transferts PENDING | events → transferts, conforme |

**Sortie brute des scénarios PO3 et PO4** (`tests/parcours/course-verrous-lot9.test.ts`, trois connexions, modèle `course-confirmation-annulation.test.ts`). Au run 110, les trois vrais cycles (PO3 cas 1, PO4 cas 1 et 2) rencontrent `40P01` ; au run 113, aucun. Le cas 2 de PO3 (garde-fou) et les cas 3 (témoins) sont verts dès le run 110. Les trois contrôles statiques de l'ordre écrit sont rouges au run 110 et verts au run 113.

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/course-verrous-lot9.test.ts (lignes duration_ms, type, location, code, opérateur et piles retirées)
TAP version 13
# Subtest: PO3 — ticket_refund_request : catégorie avant billet, trois connexions
    # Subtest: 1. vrai cycle sur un billet gratuit : C tient le billet, A rembourse, B annule, C libère : A AUCUN, B aboutit, aucun 40P01
    not ok 1 - 1. vrai cycle sur un billet gratuit : C tient le billet, A rembourse, B annule, C libère : A AUCUN, B aboutit, aucun 40P01
      error: |-
        interblocage (40P01) :
        B (annulation) : erreur 40P01 deadlock detected
        + actual - expected
        + [
        +   'B (annulation) : erreur 40P01 deadlock detected'
        + ]
        - []
      expected:
      actual:
        0: 'B (annulation) : erreur 40P01 deadlock detected'
    # Subtest: 2. garde-fou : C tient la catégorie, A rembourse un billet payé, S scanne, C libère : issue cohérente, aucun 40P01
    ok 2 - 2. garde-fou : C tient la catégorie, A rembourse un billet payé, S scanne, C libère : issue cohérente, aucun 40P01
    # Subtest: 3. témoin, billet payé : le paiement sérialise A et B, A puis B, aucun 40P01 (vert dès l’écriture)
    ok 3 - 3. témoin, billet payé : le paiement sérialise A et B, A puis B, aucun 40P01 (vert dès l’écriture)
    1..3
not ok 1 - PO3 — ticket_refund_request : catégorie avant billet, trois connexions
  error: '1 subtest failed'
# Subtest: PO4 — event_update et ticket_category_guard : events en FOR NO KEY UPDATE, trois connexions
    # Subtest: 1. event_update : C tient la plus petite catégorie, B édite, A achète l’autre, C libère : A puis B, aucun 40P01
    not ok 1 - 1. event_update : C tient la plus petite catégorie, B édite, A achète l’autre, C libère : A puis B, aucun 40P01
      error: |-
        interblocage (40P01) :
        A (checkout) : erreur 40P01 deadlock detected
        + actual - expected
        + [
        +   'A (checkout) : erreur 40P01 deadlock detected'
        + ]
        - []
      expected:
      actual:
        0: 'A (checkout) : erreur 40P01 deadlock detected'
    # Subtest: 2. ticket_category_update (ticket_category_guard) : même montage, aucun 40P01
    not ok 2 - 2. ticket_category_update (ticket_category_guard) : même montage, aucun 40P01
      error: |-
        interblocage (40P01) :
        A (checkout) : erreur 40P01 deadlock detected
        + actual - expected
        + [
        +   'A (checkout) : erreur 40P01 deadlock detected'
        + ]
        - []
      expected:
      actual:
        0: 'A (checkout) : erreur 40P01 deadlock detected'
    # Subtest: 3. témoin D20 : ticket_transfer_accept attend tant que event_update tient events (vert dès l’écriture)
    ok 3 - 3. témoin D20 : ticket_transfer_accept attend tant que event_update tient events (vert dès l’écriture)
    1..3
not ok 2 - PO4 — event_update et ticket_category_guard : events en FOR NO KEY UPDATE, trois connexions
  error: '2 subtests failed'
# Subtest: PO3, PO4 — ordre écrit dans les fonctions (statique)
    # Subtest: ticket_refund_request : paiement, puis catégorie en FOR NO KEY UPDATE, puis billet ; aucun FOR UPDATE sur la catégorie
    not ok 1 - ticket_refund_request : paiement, puis catégorie en FOR NO KEY UPDATE, puis billet ; aucun FOR UPDATE sur la catégorie
      error: 'verrou de la catégorie en FOR NO KEY UPDATE'
      expected: true
      actual: false
    # Subtest: event_update : events en FOR NO KEY UPDATE, plus aucun FOR UPDATE sur events
    not ok 2 - event_update : events en FOR NO KEY UPDATE, plus aucun FOR UPDATE sur events
      error: 'event_update : verrou FOR NO KEY UPDATE sur public.events'
      expected: true
      actual: false
    # Subtest: ticket_category_guard : events en FOR NO KEY UPDATE, plus aucun FOR UPDATE sur events
    not ok 3 - ticket_category_guard : events en FOR NO KEY UPDATE, plus aucun FOR UPDATE sur events
      error: 'ticket_category_guard : verrou FOR NO KEY UPDATE sur public.events'
      expected: true
      actual: false
    1..3
not ok 3 - PO3, PO4 — ordre écrit dans les fonctions (statique)
  error: '3 subtests failed'
[INVARIANT] course-verrous-lot9 — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] course-verrous-lot9 — purge des réservations échues : {"expired":0}
[INVARIANT] course-verrous-lot9 — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] course-verrous-lot9 — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] course-verrous-lot9 — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] course-verrous-lot9 — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] course-verrous-lot9 — (j)(k)(l) : 0 violation(s)
[notifications] Canal push désactivé : variables VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT absentes. Les notifications partent dans l'application et par SMS.
[INVARIANT-NOTIF] course-verrous-lot9 — envoyeur : 144 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] course-verrous-lot9 — (m)(n)(o) : 0 violation(s)
[INVARIANT-TERRAIN] course-verrous-lot9 — (p)(q) : 0 violation(s)
[INVARIANT-RECETTE] course-verrous-lot9 — (r)(s)(t) : 0 violation(s)
[INVARIANT-LOT9] course-verrous-lot9 — schéma du lot 9 incomplet : 8 objet(s) manquant(s)
[INVARIANT-LOT9]   fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
[INVARIANT-LOT9]   fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
[INVARIANT-LOT9]   contrainte public.tickets.tickets_holder_or_counter n'admet pas le canal INVITATION — migration 20261108000002_lot9_invitations (contrat 6.2)
[INVARIANT-LOT9]   colonne public.ticket_transfers.from_user_id encore NOT NULL — expéditeur NULL d'une invitation en attente, migration 20261108000002_lot9_invitations (contrat 6.2)
[INVARIANT-LOT9]   fonction public.tickets_sale_decision_set ne connaît pas le canal 'INVITATION' — migration 20261108000002_lot9_invitations (contrat 6.2)
[INVARIANT-LOT9]   type INVITATION_RECEIVED absent de public.notification_types — migration 20261108000002_lot9_invitations (contrat 6.2)
[INVARIANT-LOT9]   type PHONE_CHANGED absent de public.notification_types — migration 20261108000004_lot9_compte (contrat 6.2)
[INVARIANT-LOT9]   bucket avatars absent de storage.buckets — migration 20261108000004_lot9_compte (contrat 6.2)
not ok 4 - /home/runner/work/event-village/event-village/tests/parcours/course-verrous-lot9.test.ts
  error: |-
    schéma du lot 9 incomplet (course-verrous-lot9) : invariants (t)(u)(v) impossibles à vérifier :
    fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
    fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
    contrainte public.tickets.tickets_holder_or_counter n'admet pas le canal INVITATION — migration 20261108000002_lot9_invitations (contrat 6.2)
    colonne public.ticket_transfers.from_user_id encore NOT NULL — expéditeur NULL d'une invitation en attente, migration 20261108000002_lot9_invitations (contrat 6.2)
    fonction public.tickets_sale_decision_set ne connaît pas le canal 'INVITATION' — migration 20261108000002_lot9_invitations (contrat 6.2)
    type INVITATION_RECEIVED absent de public.notification_types — migration 20261108000002_lot9_invitations (contrat 6.2)
    type PHONE_CHANGED absent de public.notification_types — migration 20261108000004_lot9_compte (contrat 6.2)
    bucket avatars absent de storage.buckets — migration 20261108000004_lot9_compte (contrat 6.2)
    + actual - expected
    + [
    +   'fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)',
    +   'fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)',
    +   "contrainte public.tickets.tickets_holder_or_counter n'admet pas le canal INVITATION — migration 20261108000002_lot9_invitations (contrat 6.2)",
    +   "colonne public.ticket_transfers.from_user_id encore NOT NULL — expéditeur NULL d'une invitation en attente, migration 20261108000002_lot9_invitations (contrat 6.2)",
    +   "fonction public.tickets_sale_decision_set ne connaît pas le canal 'INVITATION' — migration 20261108000002_lot9_invitations (contrat 6.2)",
    +   'type INVITATION_RECEIVED absent de public.notification_types — migration 20261108000002_lot9_invitations (contrat 6.2)',
    +   'type PHONE_CHANGED absent de public.notification_types — migration 20261108000004_lot9_compte (contrat 6.2)',
    +   'bucket avatars absent de storage.buckets — migration 20261108000004_lot9_compte (contrat 6.2)'
    + ]
    - []
  expected:
  actual:
    0: 'fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)'
    1: 'fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)'
    2: "contrainte public.tickets.tickets_holder_or_counter n'admet pas le canal INVITATION — migration 20261108000002_lot9_invitations (contrat 6.2)"
    3: "colonne public.ticket_transfers.from_user_id encore NOT NULL — expéditeur NULL d'une invitation en attente, migration 20261108000002_lot9_invitations (contrat 6.2)"
    4: "fonction public.tickets_sale_decision_set ne connaît pas le canal 'INVITATION' — migration 20261108000002_lot9_invitations (contrat 6.2)"
    5: 'type INVITATION_RECEIVED absent de public.notification_types — migration 20261108000002_lot9_invitations (contrat 6.2)'
    6: 'type PHONE_CHANGED absent de public.notification_types — migration 20261108000004_lot9_compte (contrat 6.2)'
    7: 'bucket avatars absent de storage.buckets — migration 20261108000004_lot9_compte (contrat 6.2)'
1..3
# tests 9
# suites 3
# pass 3
# fail 6
# cancelled 0
# skipped 0
# todo 0
# duration_ms 5841.726272
```

```text
# run 113 (d255bf3, « après ») — tests/parcours/course-verrous-lot9.test.ts (lignes duration_ms, type, location, code, opérateur et piles retirées)
TAP version 13
# Subtest: PO3 — ticket_refund_request : catégorie avant billet, trois connexions
    # Subtest: 1. vrai cycle sur un billet gratuit : C tient le billet, A rembourse, B annule, C libère : A AUCUN, B aboutit, aucun 40P01
    ok 1 - 1. vrai cycle sur un billet gratuit : C tient le billet, A rembourse, B annule, C libère : A AUCUN, B aboutit, aucun 40P01
    # Subtest: 2. garde-fou : C tient la catégorie, A rembourse un billet payé, S scanne, C libère : issue cohérente, aucun 40P01
    ok 2 - 2. garde-fou : C tient la catégorie, A rembourse un billet payé, S scanne, C libère : issue cohérente, aucun 40P01
    # Subtest: 3. témoin, billet payé : le paiement sérialise A et B, A puis B, aucun 40P01 (vert dès l’écriture)
    ok 3 - 3. témoin, billet payé : le paiement sérialise A et B, A puis B, aucun 40P01 (vert dès l’écriture)
    1..3
ok 1 - PO3 — ticket_refund_request : catégorie avant billet, trois connexions
# Subtest: PO4 — event_update et ticket_category_guard : events en FOR NO KEY UPDATE, trois connexions
    # Subtest: 1. event_update : C tient la plus petite catégorie, B édite, A achète l’autre, C libère : A puis B, aucun 40P01
    ok 1 - 1. event_update : C tient la plus petite catégorie, B édite, A achète l’autre, C libère : A puis B, aucun 40P01
    # Subtest: 2. ticket_category_update (ticket_category_guard) : même montage, aucun 40P01
    ok 2 - 2. ticket_category_update (ticket_category_guard) : même montage, aucun 40P01
    # Subtest: 3. témoin D20 : ticket_transfer_accept attend tant que event_update tient events (vert dès l’écriture)
    ok 3 - 3. témoin D20 : ticket_transfer_accept attend tant que event_update tient events (vert dès l’écriture)
    1..3
ok 2 - PO4 — event_update et ticket_category_guard : events en FOR NO KEY UPDATE, trois connexions
# Subtest: PO3, PO4 — ordre écrit dans les fonctions (statique)
    # Subtest: ticket_refund_request : paiement, puis catégorie en FOR NO KEY UPDATE, puis billet ; aucun FOR UPDATE sur la catégorie
    ok 1 - ticket_refund_request : paiement, puis catégorie en FOR NO KEY UPDATE, puis billet ; aucun FOR UPDATE sur la catégorie
    # Subtest: event_update : events en FOR NO KEY UPDATE, plus aucun FOR UPDATE sur events
    ok 2 - event_update : events en FOR NO KEY UPDATE, plus aucun FOR UPDATE sur events
    # Subtest: ticket_category_guard : events en FOR NO KEY UPDATE, plus aucun FOR UPDATE sur events
    ok 3 - ticket_category_guard : events en FOR NO KEY UPDATE, plus aucun FOR UPDATE sur events
    1..3
ok 3 - PO3, PO4 — ordre écrit dans les fonctions (statique)
[INVARIANT] course-verrous-lot9 — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] course-verrous-lot9 — purge des réservations échues : {"expired":0}
[INVARIANT] course-verrous-lot9 — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] course-verrous-lot9 — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] course-verrous-lot9 — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] course-verrous-lot9 — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] course-verrous-lot9 — (j)(k)(l) : 0 violation(s)
[notifications] Canal push désactivé : variables VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT absentes. Les notifications partent dans l'application et par SMS.
[INVARIANT-NOTIF] course-verrous-lot9 — envoyeur : 145 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] course-verrous-lot9 — (m)(n)(o) : 0 violation(s)
[INVARIANT-TERRAIN] course-verrous-lot9 — (p)(q) : 0 violation(s)
[INVARIANT-RECETTE] course-verrous-lot9 — (r)(s)(t) : 0 violation(s)
[INVARIANT-LOT9] course-verrous-lot9 — (t)(u)(v) : 0 violation(s)
1..3
# tests 9
# suites 3
# pass 9
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 3388.317319
```

**Invitations** (`tests/parcours/invitations-course.test.ts`, deux envois simultanés qui dépasseraient le stock, annulation contre réclamation). Au run 110, les 4 cas échouent, l'envoi d'invitations n'existant pas.

```text
# run 110 (e6c23d1, « avant ») — tests/parcours/invitations-course.test.ts (lignes duration_ms, type, location, code, opérateur et piles retirées)
TAP version 13
# Subtest: 9.0 Course : deux envois simultanés (trois connexions)
    # Subtest: 1. dépassement du stock : un seul envoi passe, stock exact, rien pour le perdant
    not ok 1 - 1. dépassement du stock : un seul envoi passe, stock exact, rien pour le perdant
      error: |-
        RPC absentes (migration M2, contrat 5.1) : ticket_invitation_create(jsonb), ticket_invitation_cancel(jsonb)
        + actual - expected
        + [
        +   'ticket_invitation_create(jsonb)',
        +   'ticket_invitation_cancel(jsonb)'
        + ]
        - []
      expected:
      actual:
        0: 'ticket_invitation_create(jsonb)'
        1: 'ticket_invitation_cancel(jsonb)'
    # Subtest: 2. témoin : deux envois qui tiennent exactement dans le stock passent, stock exact
    not ok 2 - 2. témoin : deux envois qui tiennent exactement dans le stock passent, stock exact
      error: |-
        RPC absentes (migration M2, contrat 5.1) : ticket_invitation_create(jsonb), ticket_invitation_cancel(jsonb)
        + actual - expected
        + [
        +   'ticket_invitation_create(jsonb)',
        +   'ticket_invitation_cancel(jsonb)'
        + ]
        - []
      expected:
      actual:
        0: 'ticket_invitation_create(jsonb)'
        1: 'ticket_invitation_cancel(jsonb)'
    1..2
not ok 1 - 9.0 Course : deux envois simultanés (trois connexions)
  error: '2 subtests failed'
# Subtest: 9.0 Course : annulation contre réclamation (deux connexions)
    # Subtest: 3. annulation d’abord : la réclamation attend, puis TRANSFER_NOT_PENDING ; billet annulé, sans porteur, stock rendu
    not ok 1 - 3. annulation d’abord : la réclamation attend, puis TRANSFER_NOT_PENDING ; billet annulé, sans porteur, stock rendu
      error: |-
        RPC absentes (migration M2, contrat 5.1) : ticket_invitation_create(jsonb), ticket_invitation_cancel(jsonb)
        + actual - expected
        + [
        +   'ticket_invitation_create(jsonb)',
        +   'ticket_invitation_cancel(jsonb)'
        + ]
        - []
      expected:
      actual:
        0: 'ticket_invitation_create(jsonb)'
        1: 'ticket_invitation_cancel(jsonb)'
    # Subtest: 4. réclamation d’abord : l’annulation attend, puis annule le billet réclamé ; transfert CLAIMED, stock rendu
    not ok 2 - 4. réclamation d’abord : l’annulation attend, puis annule le billet réclamé ; transfert CLAIMED, stock rendu
      error: |-
        RPC absentes (migration M2, contrat 5.1) : ticket_invitation_create(jsonb), ticket_invitation_cancel(jsonb)
        + actual - expected
        + [
        +   'ticket_invitation_create(jsonb)',
        +   'ticket_invitation_cancel(jsonb)'
        + ]
        - []
      expected:
      actual:
        0: 'ticket_invitation_create(jsonb)'
        1: 'ticket_invitation_cancel(jsonb)'
    1..2
not ok 2 - 9.0 Course : annulation contre réclamation (deux connexions)
  error: '2 subtests failed'
[INVARIANT] invitations-course — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] invitations-course — purge des réservations échues : {"expired":0}
[INVARIANT] invitations-course — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] invitations-course — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] invitations-course — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] invitations-course — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] invitations-course — (j)(k)(l) : 0 violation(s)
[notifications] Canal push désactivé : variables VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT absentes. Les notifications partent dans l'application et par SMS.
[INVARIANT-NOTIF] invitations-course — envoyeur : 14 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] invitations-course — (m)(n)(o) : 0 violation(s)
[INVARIANT-TERRAIN] invitations-course — (p)(q) : 0 violation(s)
[INVARIANT-RECETTE] invitations-course — (r)(s)(t) : 0 violation(s)
[INVARIANT-LOT9] invitations-course — schéma du lot 9 incomplet : 8 objet(s) manquant(s)
[INVARIANT-LOT9]   fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
[INVARIANT-LOT9]   fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
[INVARIANT-LOT9]   contrainte public.tickets.tickets_holder_or_counter n'admet pas le canal INVITATION — migration 20261108000002_lot9_invitations (contrat 6.2)
[INVARIANT-LOT9]   colonne public.ticket_transfers.from_user_id encore NOT NULL — expéditeur NULL d'une invitation en attente, migration 20261108000002_lot9_invitations (contrat 6.2)
[INVARIANT-LOT9]   fonction public.tickets_sale_decision_set ne connaît pas le canal 'INVITATION' — migration 20261108000002_lot9_invitations (contrat 6.2)
[INVARIANT-LOT9]   type INVITATION_RECEIVED absent de public.notification_types — migration 20261108000002_lot9_invitations (contrat 6.2)
[INVARIANT-LOT9]   type PHONE_CHANGED absent de public.notification_types — migration 20261108000004_lot9_compte (contrat 6.2)
[INVARIANT-LOT9]   bucket avatars absent de storage.buckets — migration 20261108000004_lot9_compte (contrat 6.2)
not ok 3 - /home/runner/work/event-village/event-village/tests/parcours/invitations-course.test.ts
  error: |-
    schéma du lot 9 incomplet (invitations-course) : invariants (t)(u)(v) impossibles à vérifier :
    fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)
    fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)
    contrainte public.tickets.tickets_holder_or_counter n'admet pas le canal INVITATION — migration 20261108000002_lot9_invitations (contrat 6.2)
    colonne public.ticket_transfers.from_user_id encore NOT NULL — expéditeur NULL d'une invitation en attente, migration 20261108000002_lot9_invitations (contrat 6.2)
    fonction public.tickets_sale_decision_set ne connaît pas le canal 'INVITATION' — migration 20261108000002_lot9_invitations (contrat 6.2)
    type INVITATION_RECEIVED absent de public.notification_types — migration 20261108000002_lot9_invitations (contrat 6.2)
    type PHONE_CHANGED absent de public.notification_types — migration 20261108000004_lot9_compte (contrat 6.2)
    bucket avatars absent de storage.buckets — migration 20261108000004_lot9_compte (contrat 6.2)
    + actual - expected
    + [
    +   'fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)',
    +   'fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)',
    +   "contrainte public.tickets.tickets_holder_or_counter n'admet pas le canal INVITATION — migration 20261108000002_lot9_invitations (contrat 6.2)",
    +   "colonne public.ticket_transfers.from_user_id encore NOT NULL — expéditeur NULL d'une invitation en attente, migration 20261108000002_lot9_invitations (contrat 6.2)",
    +   "fonction public.tickets_sale_decision_set ne connaît pas le canal 'INVITATION' — migration 20261108000002_lot9_invitations (contrat 6.2)",
    +   'type INVITATION_RECEIVED absent de public.notification_types — migration 20261108000002_lot9_invitations (contrat 6.2)',
    +   'type PHONE_CHANGED absent de public.notification_types — migration 20261108000004_lot9_compte (contrat 6.2)',
    +   'bucket avatars absent de storage.buckets — migration 20261108000004_lot9_compte (contrat 6.2)'
    + ]
    - []
  expected:
  actual:
    0: 'fonction public.ticket_invitation_create absente — migration 20261108000002_lot9_invitations (contrat 6.2)'
    1: 'fonction public.account_phone_finalize absente — migration 20261108000004_lot9_compte (contrat 6.2)'
    2: "contrainte public.tickets.tickets_holder_or_counter n'admet pas le canal INVITATION — migration 20261108000002_lot9_invitations (contrat 6.2)"
    3: "colonne public.ticket_transfers.from_user_id encore NOT NULL — expéditeur NULL d'une invitation en attente, migration 20261108000002_lot9_invitations (contrat 6.2)"
    4: "fonction public.tickets_sale_decision_set ne connaît pas le canal 'INVITATION' — migration 20261108000002_lot9_invitations (contrat 6.2)"
    5: 'type INVITATION_RECEIVED absent de public.notification_types — migration 20261108000002_lot9_invitations (contrat 6.2)'
    6: 'type PHONE_CHANGED absent de public.notification_types — migration 20261108000004_lot9_compte (contrat 6.2)'
    7: 'bucket avatars absent de storage.buckets — migration 20261108000004_lot9_compte (contrat 6.2)'
1..2
# tests 4
# suites 2
# pass 0
# fail 4
# cancelled 0
# skipped 0
# todo 0
# duration_ms 897.907261
```

```text
# run 113 (d255bf3, « après ») — tests/parcours/invitations-course.test.ts (lignes duration_ms, type, location, code, opérateur et piles retirées)
TAP version 13
# Subtest: 9.0 Course : deux envois simultanés (trois connexions)
    # Subtest: 1. dépassement du stock : un seul envoi passe, stock exact, rien pour le perdant
    ok 1 - 1. dépassement du stock : un seul envoi passe, stock exact, rien pour le perdant
    # Subtest: 2. témoin : deux envois qui tiennent exactement dans le stock passent, stock exact
    ok 2 - 2. témoin : deux envois qui tiennent exactement dans le stock passent, stock exact
    1..2
ok 1 - 9.0 Course : deux envois simultanés (trois connexions)
# Subtest: 9.0 Course : annulation contre réclamation (deux connexions)
    # Subtest: 3. annulation d’abord : la réclamation attend, puis TRANSFER_NOT_PENDING ; billet annulé, sans porteur, stock rendu
    ok 1 - 3. annulation d’abord : la réclamation attend, puis TRANSFER_NOT_PENDING ; billet annulé, sans porteur, stock rendu
    # Subtest: 4. réclamation d’abord : l’annulation attend, puis annule le billet réclamé ; transfert CLAIMED, stock rendu
    ok 2 - 4. réclamation d’abord : l’annulation attend, puis annule le billet réclamé ; transfert CLAIMED, stock rendu
    1..2
ok 2 - 9.0 Course : annulation contre réclamation (deux connexions)
[INVARIANT] invitations-course — avant purge (held = réservations ACTIVE) : 0 violation(s)
[INVARIANT] invitations-course — purge des réservations échues : {"expired":0}
[INVARIANT] invitations-course — après purge (held = réservations non échues) : 0 violation(s)
[INVARIANT-FIN] invitations-course — (d)(e)(f) : 0 violation(s)
[INVARIANT-ACCES] invitations-course — (g)(h)(i) : 0 violation(s)
[INVARIANT-CYCLE] invitations-course — cron events_finish_overdue : 0 événement(s) passé(s) à TERMINE
[INVARIANT-CYCLE] invitations-course — (j)(k)(l) : 0 violation(s)
[notifications] Canal push désactivé : variables VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT absentes. Les notifications partent dans l'application et par SMS.
[INVARIANT-NOTIF] invitations-course — envoyeur : 205 ligne(s) réservée(s), 0 reprise(s)
[INVARIANT-NOTIF] invitations-course — (m)(n)(o) : 0 violation(s)
[INVARIANT-TERRAIN] invitations-course — (p)(q) : 0 violation(s)
[INVARIANT-RECETTE] invitations-course — (r)(s)(t) : 0 violation(s)
[INVARIANT-LOT9] invitations-course — (t)(u)(v) : 0 violation(s)
1..2
# tests 4
# suites 2
# pass 4
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2095.873687
```

Les scénarios ne prouvent l'absence d'interblocage que sur ces ordres-là, à trois connexions et sans charge. Comportement sous charge réelle : hors périmètre (lots 14 et 15).

---

---

## 8. Compte : ordre des écritures, compensation, réparation

**Pourquoi deux temps.** Le numéro et l'email vivent à la fois dans `auth.users` et dans `public.users`, et aucune transaction ne couvre les deux. `auth.users` est écrit par l'API d'administration officielle (`auth.admin.updateUserById`), jamais par un `UPDATE` direct, pour ne pas écrire les colonnes internes de GoTrue (AR2).

**Ordre (`POST /api/account/phone/confirm`).**
1. Session, avec son `session_id` : 401 `SESSION_REQUIRED` s'il manque, avant de consommer le code.
2. Code SMS vérifié et consommé.
3. `account_identity_taken` (AM1) : numéro pris → 409 `PHONE_TAKEN`, sans appel d'API.
4. `updateUserById` (numéro, et email technique s'il y en a un).
5. Sur erreur de l'API : `account_identity_taken` relue. Pris entre-temps → 409, sans compensation ; sinon 500 `PHONE_CHANGE_FAILED`.
6. RPC `account_phone_finalize` : `public.users`, `phone_verified_at`, révocation des autres sessions, `PHONE_CHANGED` à l'ancien numéro, audit, en une transaction.

**AM1, supposé infirmé.** GoTrue ne renvoie pas `phone_exists` ni `email_exists` pour un numéro ou un email déjà pris : le run 110 lit `code=undefined, status=500, message=Error updating user`. Le refus propre vient donc de `account_identity_taken`, pas du code d'erreur. Sorties brutes en section 2, 9.2.

**Compensation.** Si la RPC échoue après l'API, `compensateAuthIdentity` relit `public.users` à cet instant (et non la valeur du début : deux confirmations concurrentes laissent ainsi `auth` aligné sur le gagnant) et remet `auth.users` sur ces valeurs.

**Si la compensation échoue.** Le compte a alors `auth.users` sur la nouvelle valeur et `public.users` sur l'ancienne. Ce qui se passe :
- journal d'erreur `[account-sync] compensation impossible` ;
- ligne `audit_logs` d'action `ACCOUNT_AUTH_DESYNC`, avec `metadata { label, step: 'compensation' }` ;
- réponse 500 `ACCOUNT_SYNC_FAILED` : le client lit qu'il doit réessayer avec le même numéro, ou contacter le support.

**Repérer et réparer.**
```sql
select created_at, user_id, metadata from public.audit_logs where action = 'ACCOUNT_AUTH_DESYNC' order by created_at desc;
```
- Le client reprend `start` et `confirm` avec le même numéro depuis sa session encore valide : l'API accepte ses propres valeurs et la RPC aboutit.
- Pour l'email du profil, un nouvel enregistrement du profil répare de la même façon.
- Aucun écran d'administration n'a été ajouté : non demandé.

**Ce qui n'est pas prouvé.** Les écritures sur `auth.sessions` et `auth.refresh_tokens` passent en CI sur le Supabase local, mais pas encore sur un projet hébergé : l'essai 8.15 de `docs/essai-local.md` les vérifie. La révocation et la compensation sont prouvées en CI par `compte-numero` et `compte-profil`.

---

## 9. Matrice de traçabilité

La matrice complète, avec le code et le test de chaque ligne, est dans [`docs/recette-billetterie.md`](recette-billetterie.md), sections 3 et 4. Elle a été régénérée sur le run 113 par `75943b1b` ; `tests/schema/recette-matrice.test.ts` la suit (`fede5970`, 19/19 d'après l'agent D2, sans `failing tests` au journal). Résumé, tel quel (`docs/recette-billetterie.md:7-14`) :

| Statut | Lignes |
|---|---|
| fait | 49 |
| partiel | 35 |
| non fait | 2 |
| écarté | 6 |
| hors périmètre | 14 |
| total | 106 |

Décompte refait sur le fichier par cette partie (statut de la 3ᵉ colonne de chaque ligne des sections 3 et 4) :

| Partie du cahier des charges | fait | partiel | non fait | écarté | hors périmètre |
|---|---|---|---|---|---|
| Parties I et II : principes et rôles | 8 | 2 | 0 | 0 | 0 |
| Partie III : compte client | 4 | 3 | 0 | 0 | 1 |
| Partie IV : espace partenaire | 2 | 1 | 0 | 0 | 2 |
| Partie V : événements | 3 | 1 | 0 | 1 | 0 |
| Partie VI : ticketing | 7 | 0 | 0 | 0 | 0 |
| Parties VII à IX : salles, tables, commandes | 0 | 0 | 0 | 0 | 1 |
| Partie X : paiements et finances | 5 | 2 | 0 | 0 | 0 |
| Partie XI : parrainage, part billetterie | 7 | 6 | 1 | 0 | 1 |
| Parties XII et XIII : modèle économique et communication | 0 | 0 | 1 | 0 | 2 |
| Partie XIV : administration | 2 | 5 | 0 | 0 | 0 |
| Parties XV à XVIII : données, automatisation, sécurité, statistiques | 7 | 10 | 0 | 0 | 3 |
| Parties XX à XXIII : architecture, règles, livrables | 4 | 5 | 0 | 0 | 4 |
| Écarts par décision du client (section 4) | 0 | 0 | 0 | 5 | 0 |

Total refait : 106 lignes, fait 49, partiel 35, non fait 2, écarté 6, hors périmètre 14.

Lignes passées à « fait », avec leurs preuves (`docs/recette-billetterie.md:63-65`, telles quelles) :

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §15 | Profil modifiable : photo, nom, téléphone, email, préférences | fait | `app/profile/page.tsx`, `components/profile/ProfileForm.tsx`, `components/profile/PhoneChangeDialog.tsx`, `components/profile/AvatarEditor.tsx`, `app/profile/notifications/page.tsx`, `app/api/account/profile/route.ts`, `app/api/account/phone/confirm/route.ts`, `app/api/account/avatar/route.ts`, `M/20261108000004_lot9_compte.sql:148` | `tests/parcours/compte-profil.test.ts:186`, `tests/parcours/compte-profil.test.ts:235`, `tests/parcours/compte-profil.test.ts:570`, `tests/parcours/compte-profil.test.ts:577`, `tests/parcours/compte-numero.test.ts:286`, `tests/parcours/compte-numero.test.ts:488`, `tests/parcours/compte-numero.test.ts:540`, `tests/parcours/compte-numero.test.ts:1042`, `tests/parcours/compte-photo.test.ts:252`, `tests/parcours/compte-photo.test.ts:468`, `tests/parcours/compte-photo.test.ts:491`, `tests/parcours/compte-photo.test.ts:670`, `tests/security/r27-avatars.test.ts:184`, `tests/security/r27-avatars.test.ts:258`, `tests/security/r7-profil-colonnes.test.ts:46`, `tests/parcours/notif-preferences.test.ts:367` | vert au run 113 | A6 corrigée : une route, jamais d’écriture directe par REST |
| §16 | Recherche par événement et par localisation | fait | `app/api/events/route.ts`, `app/explore/page.tsx`, `lib/events/catalog-client.ts` | `tests/parcours/decouverte-recherche.test.ts:88`, `tests/parcours/decouverte-recherche.test.ts:97`, `tests/parcours/decouverte-recherche.test.ts:111`, `tests/parcours/decouverte-recherche.test.ts:122`, `tests/parcours/decouverte-recherche.test.ts:129`, `tests/parcours/decouverte-recherche-lot9.test.ts:87`, `tests/parcours/decouverte-recherche-lot9.test.ts:98`, `tests/parcours/decouverte-recherche-lot9.test.ts:120`, `tests/parcours/decouverte-ecrans.test.ts:95`, `tests/parcours/decouverte-ecrans.test.ts:293`, `e2e/recette.spec.ts:487` | vert au run 113 | A28 corrigée : le catalogue passe q et city au serveur. Restaurant, salle, produit, table : hors périmètre ; prestataire : par le nom de l’organisateur seulement |
| §17 | Événements populaires et proches | fait | `app/api/events/popular/route.ts`, `lib/events/popular.service.ts`, `components/events/HomeDiscovery.tsx`, `app/api/profile/city/route.ts`, `M/20261108000003_lot9_decouverte.sql:27` | `tests/parcours/decouverte-populaires.test.ts:157`, `tests/parcours/decouverte-populaires.test.ts:186`, `tests/parcours/decouverte-populaires.test.ts:212`, `tests/parcours/decouverte-populaires.test.ts:233`, `tests/parcours/decouverte-populaires.test.ts:362`, `tests/parcours/decouverte-populaires.test.ts:380`, `tests/parcours/decouverte-cache.test.ts:54`, `tests/parcours/decouverte-cache.test.ts:67`, `tests/parcours/decouverte-cache.test.ts:89`, `tests/parcours/decouverte-ville.test.ts:108`, `tests/parcours/decouverte-ville.test.ts:276`, `tests/parcours/decouverte-ecrans.test.ts:154`, `tests/parcours/decouverte-ecrans.test.ts:317`, `tests/parcours/decouverte-ecrans.test.ts:328`, `tests/parcours/decouverte-ecrans.test.ts:335` | vert au run 113 | A7 corrigée (Q4 tranchée) : Populaires selon les billets vendus sur 7 jours, proches selon la ville du profil ou de l’appareil, sans géolocalisation. Restaurants, offres, plats du jour, salles, prestataires : hors périmètre |

**Compte rendu de l'agent D2**, sur la matrice :

- lignes « fait » prouvées au run 113 : 49 sur 49, aucune mention « à prouver » ; le corps de chaque test nouvellement cité a été lu ;
- lignes descendues : aucune ; aucune citation ne visait une suite supprimée. La seule citation retirée, `acces-encaissement:284`, est recalée sur le test réduit `:69`, lu et vert ;
- restent en partiel, remarque mise à jour : §21 (A17 retirée, A9 reste), §134 (champ « statut » absent), §152 (A30, A31), §104 (transactions artificielles), §190 (charge, iPhone) ;
- autres mises à jour : §35 prend les invitations (consigne 9.0, PO1 tranchée) ; §160 : `invitations:579,591` ; écart « à régler sur place » : code retiré, `nettoyage-sur-place:99,137,143` ;
- citations recalées : acte 8 à `recette.spec:944`, `notif-modeles:504`, `ticket_scan` et `ticket_refund_request` à leur dernière définition ;
- essais : `NOMBRE_ESSAIS` à 69, section O (essais 62 à 69), essais 41, 57 et 61 réécrits ;
- `tests/schema/recette-matrice.test.ts` (T36) : `CORRIGEES` et `NOMBRE_ESSAIS` conformes au contrat, plus un renforcement hors contrat (PO3, PO4, PO10 contrôlés comme A1 à A41, mutation « PO3 retiré »). `SUITES_INTERDITES` inchangée, aucune règle assouplie.

Je n'ai pas relu ces 49 lignes moi-même : ce qui précède reprend le compte rendu de D2, sauf le décompte et les trois lignes ci-dessus, relus dans le fichier.

Ce qu'il faut savoir pour lire ces chiffres :
- « fait » exige deux lectures, le corps du test et son résultat au run 113 (légende du document). Au run 114, `recette-matrice` garantira seulement que chaque ligne citée ouvre toujours un test.
- « partiel » dès qu'un affichage ou une route n'a pas d'assertion.
- Limite écrite dans le document : l'annexe de l'audit n'a été lue qu'en version condensée à la découverte du lot.

---

---

## 10. Anomalies et questions au client

Tableau recopié tel quel de `docs/recette-billetterie.md`, section 5 (lignes 232 à 277) : A1 à A41, plus PO3, PO4 et PO10 ajoutées au lot 9.

- **corrigée** : 30 (A1, A2, A3, A4, A6, A7, A13, A16, A17, A20, A21, A23, A24, A25, A26, A27, A28, A29, A32, A33, A34, A35, A36, A38, A39, A40, A41, PO3, PO4, PO10) ;
- **preuve ajoutée** : 3 (A11, A14, A15) ;
- **listée** : 11 (A5, A8, A9, A10, A12, A18, A19, A22, A30, A31, A37) ;
- par gravité : Élevée 7, Moyenne 19, Faible 18.

Décompte refait par script sur les 44 lignes du tableau. D2 annonce 30 corrigées, 3 preuve ajoutée, 11 listées : conforme.

« corrigée » veut dire test rouge puis correctif ; « preuve ajoutée », que le code était juste et que le test manquait ; « listée », non corrigée dans ce lot. La colonne CI renvoie au run 113.

**PO fermés** : PO1 (outil d'invitations, ligne §35 de la matrice), PO3, PO4, PO10.

| Id | Gravité | Exigence | Constat | État | Référence | Test | CI |
|---|---|---|---|---|---|---|---|
| A1 | Élevée | §98, §133 | Fausse sauvegarde sur la page de parrainage de l’administration. Bouton et modale retirés, mention « La personnalisation des taux n’est pas disponible pour le moment. » | corrigée | `fix(8.3-A1)` 3fa31ed ; `app/admin/referral/page.tsx:157` | `tests/parcours/admin-parrainage.test.ts:229`, `tests/parcours/admin-parrainage.test.ts:239`, `tests/parcours/admin-parrainage.test.ts:250` | vert au run 113 |
| A2 | Élevée | §86 | Lien de parrainage mort. Lien sur l’adresse de l’application, /register lit ref et ouvre les options | corrigée | `fix(8.3-A2s)` b92928e, `fix(8.3-A2e)` 407d09c ; `app/api/referrals/my-stats/route.ts`, `app/register/page.tsx` | `tests/parcours/parrainage-lien.test.ts:122`, `tests/parcours/parrainage-lien.test.ts:159`, `tests/parcours/parrainage-lien.test.ts:227` | vert au run 113 |
| A3 | Élevée | §41, §131 | Relance d’un remboursement bloqué sans écran. Panneau sur les finances de l’administration, double étape, cas incertain sans bouton | corrigée | `fix(8.3-A3s)` 9a92e59, `fix(8.3-A3e)` 2506b89 et 5a6dcbc ; `app/api/admin/refunds/route.ts`, `components/admin/RefundsToRetry.tsx` | `tests/parcours/admin-remboursements.test.ts:180`, `tests/parcours/admin-remboursements.test.ts:350`, `tests/parcours/admin-remboursements.test.ts:467`, `tests/parcours/admin-remboursements.test.ts:479`, `tests/parcours/admin-remboursements.test.ts:498`, `e2e/recette.spec.ts:944` | vert au run 113 |
| A4 | Élevée | §41, §82 | Remboursement d’un billet sans écran. Recherche par numéro et double confirmation dans l’onglet Ventes | corrigée | `fix(8.3-A4s)` c1eabd6, `fix(8.3-A4e)` 18c69b8 ; `app/api/partner/events/[id]/tickets/lookup/route.ts`, `components/partner/pilotage/TicketRefundPanel.tsx` | `tests/parcours/pilotage-remboursement-billet.test.ts:138`, `tests/parcours/pilotage-remboursement-billet.test.ts:191`, `tests/parcours/pilotage-remboursement-billet.test.ts:235`, `tests/parcours/pilotage-remboursement-billet.test.ts:356`, `tests/parcours/pilotage-remboursement-billet.test.ts:369`, `e2e/recette.spec.ts:728` | vert au run 113 |
| A5 | Élevée | §87, §88, §96, §97 | Parrainage prestataire absent : Q2 à trancher d’abord | listée | `app/api/auth/register/route.ts` | — | sans objet |
| A6 | Moyenne | §15 | Profil en lecture seule. Prénom, nom, email, photo et numéro se modifient désormais à l’écran, par des routes dédiées, jamais par une écriture directe | corrigée | `fix(9.2s)` 7f8a8a11, `fix(9.2e)` 339a185c, `fix(9.2-photo)` fff118f0, `fix(9.2e-avatar)` 8d55067f ; `app/profile/page.tsx`, `app/api/account/profile/route.ts`, `app/api/account/phone/confirm/route.ts`, `app/api/account/avatar/route.ts` | `tests/parcours/compte-profil.test.ts:186`, `tests/parcours/compte-profil.test.ts:570`, `tests/parcours/compte-profil.test.ts:577`, `tests/parcours/compte-numero.test.ts:488`, `tests/parcours/compte-numero.test.ts:1042`, `tests/parcours/compte-photo.test.ts:252`, `tests/parcours/compte-photo.test.ts:491`, `tests/parcours/compte-photo.test.ts:670` | vert au run 113 |
| A7 | Moyenne | §17 | Événements populaires et proches absents. Accueil : Populaires (billets vendus sur 7 jours, gardés 60 secondes) et Près de chez vous (ville du profil ou de l’appareil, sans géolocalisation). Q4 tranchée par la consigne du lot 9 | corrigée | `fix(9.1s)` faaa81d6, `fix(9.1e)` b5e8f324 ; `app/api/events/popular/route.ts`, `components/events/HomeDiscovery.tsx`, `M/20261108000003_lot9_decouverte.sql:27` | `tests/parcours/decouverte-populaires.test.ts:157`, `tests/parcours/decouverte-populaires.test.ts:212`, `tests/parcours/decouverte-populaires.test.ts:380`, `tests/parcours/decouverte-cache.test.ts:67`, `tests/parcours/decouverte-cache.test.ts:89`, `tests/parcours/decouverte-ville.test.ts:276`, `tests/parcours/decouverte-ecrans.test.ts:317`, `tests/parcours/decouverte-ecrans.test.ts:335` | vert au run 113 |
| A8 | Moyenne | §22, §144 | WhatsApp absent, sans décision écrite : Q1 | listée | `lib/notifications/dispatcher.ts` | — | sans objet |
| A9 | Moyenne | §106, §119, §132, §133, §162 | Historique du parrainage incomplet, ROI absent | listée | `app/api/referrals/my-stats/route.ts`, `app/admin/referral/page.tsx` | — | sans objet |
| A10 | Moyenne | §83, §105 | Virement bancaire non traité, réglage fermé par défaut | listée | `docs/lot3-rapport.md:1900` | — | sans objet |
| A11 | Moyenne | §104 | Auto-parrainage et boucles sans test. Preuve ajoutée, verte dès l’écriture | preuve ajoutée | `test(8.3)[garde-fous]` 2769248 ; `tests/parcours/parrainage-gardes.test.ts` | `tests/parcours/parrainage-gardes.test.ts:90`, `tests/parcours/parrainage-gardes.test.ts:128`, `tests/parcours/parrainage-gardes.test.ts:139` | vert au run 113 |
| A12 | Moyenne | §1, §183 | Un client ne devient pas partenaire (D8, D63) | listée | `docs/lot7-rapport.md` | — | sans objet |
| A13 | Moyenne | §134 | Une erreur de lecture du journal d’audit s’affichait comme une liste vide. ErrorState et colonne Utilisateur | corrigée | `fix(8.3-A13)` 404d06a ; `app/admin/audit/page.tsx` | `tests/parcours/admin-audit.test.ts:107`, `tests/parcours/admin-audit.test.ts:180`, `tests/parcours/admin-audit.test.ts:246`, `tests/parcours/admin-audit.test.ts:277` | vert au run 113 |
| A14 | Faible | §16 | q et city de la liste publique sans test. Preuve ajoutée, verte dès l’écriture | preuve ajoutée | `test(8.3)[garde-fous]` 2769248 ; `tests/parcours/decouverte-recherche.test.ts` | `tests/parcours/decouverte-recherche.test.ts:88`, `tests/parcours/decouverte-recherche.test.ts:97`, `tests/parcours/decouverte-recherche.test.ts:111`, `tests/parcours/decouverte-recherche.test.ts:122`, `tests/parcours/decouverte-recherche.test.ts:129` | vert au run 113 |
| A15 | Faible | §32, §33 | Affichage public sans assertion. Assertions ajoutées à l’acte 4, sauf le contact de l’organisateur | preuve ajoutée | `test(8.3b)` f7d8c5d ; `e2e/recette.spec.ts` | `e2e/recette.spec.ts:487` | vert au run 113 |
| A16 | Faible | décision | Code « à régler sur place » retiré : plus d’état à encaisser au scan, fonction d’encaissement supprimée, billet impayé refusé en payment_required. Le guichet reste | corrigée | `fix(9.4-A16s)` 505d70f3, `fix(9.4-A16e)` 80df7153 ; `M/20261108000005_lot9_nettoyage.sql:21`, `app/api/controller/scan/route.ts`, `lib/scan/scan-result.ts` | `tests/parcours/nettoyage-sur-place.test.ts:99`, `tests/parcours/nettoyage-sur-place.test.ts:137`, `tests/parcours/nettoyage-sur-place.test.ts:143`, `tests/parcours/nettoyage-sur-place.test.ts:151`, `tests/parcours/nettoyage-sur-place.test.ts:165`, `tests/parcours/nettoyage-sur-place.test.ts:184` | vert au run 113 |
| A17 | Faible | §21 | Pas de liste des paiements du client. Page Mes paiements, totaux, pagination, lien vers le statut, jamais d’identifiant technique | corrigée | `fix(9.2s)` 7f8a8a11, `fix(9.2e)` 339a185c ; `app/profile/payments/page.tsx`, `app/api/account/payments/route.ts`, `M/20261108000004_lot9_compte.sql:307` | `tests/parcours/compte-paiements.test.ts:132`, `tests/parcours/compte-paiements.test.ts:233`, `tests/parcours/compte-paiements.test.ts:453`, `tests/parcours/compte-paiements.test.ts:461`, `tests/parcours/compte-paiements.test.ts:475` | vert au run 113 |
| A18 | Faible | §157 | Pas d’écran de statistiques client | listée | `app/wallet/page.tsx` | — | sans objet |
| A19 | Faible | §189 | Guides client et administration absents, pages légales à prévoir | listée | `docs/guide-organisateur-entrees.md` | — | sans objet |
| A20 | Moyenne | outillage | Instabilité de la fumée au run 92 : case forcée hors de l’écran | corrigée | `test(e2e)[run 92]` ef2b36b ; `e2e/fumee.spec.ts` | `e2e/fumee.spec.ts:91` | vert au run 113 |
| A21 | Moyenne | §190 | Suites à la racine de tests/ qui ne prouvaient rien : six supprimées, leurs cas réels portés avant (ports vus verts à la CI) | corrigée | `test(9.4-A21)[suppression]` f1ff53d4 et 3ca034a4 ; `docs/lot0-rapport.md:547`, `tests/schema/recette-matrice.test.ts` | `tests/schema/code-mort-lot9.test.ts:77` | vert au run 113 |
| A22 | Faible | design | Pages d’administration non migrées, hors du contrôle de design | listée | `tests/parcours/design-systeme.test.ts` | — | sans objet |
| A23 | Moyenne | export | Injection de formule dans l’export CSV ; statut technique affiché au refus du PDF ; statut brut à l’annulation | corrigée | `fix(8.3-A23)` 1fa3fe9 ; `lib/partner/partner-dashboard.service.ts`, `app/api/tickets/[id]/pdf/route.ts` | `tests/parcours/legacy-exports-partenaire.test.ts:221`, `tests/parcours/legacy-billet-pdf.test.ts:115` | vert au run 113 |
| A24 | Moyenne | §134, §152 | La route du journal d’audit servait tout ADMIN alors que la RLS réserve le superadmin. Route réservée, page 403 « Réservé au superadmin », liens masqués à l’admin | corrigée | `fix(9.3-A24s)` 327e130a, `fix(9.3-A24e)` f53cb2fc, `fix(9.3-A24e-nav)` f42d687a ; `app/api/admin/audit/route.ts:18`, `M/0003_rls.sql:355` | `tests/parcours/admin-audit.test.ts:107`, `tests/parcours/admin-audit-lot9.test.ts:77`, `tests/parcours/admin-audit-lot9.test.ts:199`, `tests/parcours/admin-audit-lot9.test.ts:218`, `tests/parcours/admin-audit-lot9.test.ts:233` | vert au run 113 |
| A25 | Faible | §134 | `limit` de cette route non borné. Borné à 100, 50 par défaut pour une valeur invalide | corrigée | `fix(9.3-A25)` 565619cc ; `app/api/admin/audit/route.ts:27` | `tests/parcours/admin-audit-lot9.test.ts:107` | vert au run 113 |
| A26 | Faible | §31 | Fiche partenaire d’un événement : une panne de lecture était un 404. Panne : 500, message français, jamais une absence | corrigée | `fix(9.3-A26)` 8e0a36da ; `app/api/partner/events/[id]/route.ts:32` | `tests/parcours/pannes-absences.test.ts:148`, `tests/parcours/messages-bruts.test.ts:161` | vert au run 113 |
| A27 | Faible | §104 | Le trigger de boucle de parrainage ne couvrait pas l’UPDATE. Il couvre désormais l’UPDATE, quel que soit le rôle | corrigée | `fix(9.3-A27)` 6687b89e ; `M/20261108000001_lot9_securite.sql:567` | `tests/parcours/parrainage-boucle-update.test.ts:68`, `tests/parcours/parrainage-boucle-update.test.ts:79`, `tests/parcours/parrainage-boucle-update.test.ts:125`, `tests/parcours/parrainage-boucle-update.test.ts:136` | vert au run 113 |
| A28 | Faible | §16 | Écrans de recherche sans q ni city : filtre dans le navigateur. Le catalogue et l’accueil passent au serveur, q cherche aussi la ville | corrigée | `fix(9.1s)` faaa81d6, `fix(9.1e)` b5e8f324 ; `app/explore/page.tsx:95`, `lib/events/catalog-client.ts` | `tests/parcours/decouverte-ecrans.test.ts:95`, `tests/parcours/decouverte-ecrans.test.ts:293`, `tests/parcours/decouverte-ecrans.test.ts:309`, `tests/parcours/decouverte-recherche-lot9.test.ts:87`, `tests/parcours/decouverte-recherche-lot9.test.ts:98`, `e2e/recette.spec.ts:487` | vert au run 113 |
| A29 | Moyenne | §131 | L’alerte d’un remboursement bloqué pour solde insuffisant parlait d’un bénéficiaire incomplet | corrigée | `fix(8.3-A29)` f2334de ; `lib/notifications/catalog.ts` | `tests/parcours/notif-modeles.test.ts:504` | vert au run 113 |
| A30 | Élevée | §152, §155 | GET partner/halls/[id] sans contrôle de rôle ni de propriétaire : réservations et téléphone du partenaire lisibles par tout compte connecté quand le service est ouvert. Hors périmètre, service fermé aujourd’hui | listée | `app/api/partner/halls/[id]/route.ts` | — | sans objet |
| A31 | Moyenne | §152 | GET partner/products/[id] sans contrôle de propriétaire. Hors périmètre, service fermé | listée | `app/api/partner/products/[id]/route.ts` | — | sans objet |
| A32 | Faible | qualité | Panne présentée comme une absence, non journalisée : getEventById, getHallById, getProductById, GET orders/[id]. Désormais 500 journalisé, 404 seulement pour un objet absent | corrigée | `fix(9.3-A32)` 3796cdeb ; `lib/events/event.service.ts:291`, `lib/halls/hall.service.ts:125`, `lib/products/product.service.ts:165` | `tests/parcours/pannes-absences.test.ts:120`, `tests/parcours/pannes-absences.test.ts:129`, `tests/parcours/pannes-absences.test.ts:133`, `tests/parcours/pannes-absences.test.ts:169` | vert au run 113 |
| A33 | Moyenne | qualité | Écritures ignorées : admin/permissions POST, partner/register. Une transaction, l’échec se voit, le compte créé est retiré | corrigée | `fix(9.3-A33)` 84da7d5a ; `app/api/admin/permissions/route.ts`, `app/api/partner/register/route.ts`, `M/20261108000001_lot9_securite.sql:579`, `M/20261108000001_lot9_securite.sql:637` | `tests/parcours/ecritures-ignorees.test.ts:120`, `tests/parcours/ecritures-ignorees.test.ts:134`, `tests/parcours/ecritures-ignorees.test.ts:299`, `tests/parcours/ecritures-ignorees.test.ts:319` | vert au run 113 |
| A34 | Moyenne | qualité | Lectures ignorées : admin/communications POST, admin/pricing POST, send-otp, verify-otp, admin/users PATCH. Une panne n’est plus prise pour un résultat vide | corrigée | `fix(9.3-A34)` cca809dc ; `app/api/admin/communications/route.ts`, `app/api/admin/pricing/route.ts`, `app/api/auth/send-otp/route.ts`, `app/api/auth/verify-otp/route.ts`, `app/api/admin/users/route.ts` | `tests/parcours/lectures-ignorees.test.ts:67`, `tests/parcours/lectures-ignorees.test.ts:114`, `tests/parcours/lectures-ignorees.test.ts:161`, `tests/parcours/lectures-ignorees.test.ts:198`, `tests/parcours/lectures-ignorees.test.ts:253` | vert au run 113 |
| A35 | Faible | 8.2 i | Un refus du fournisseur SMS arrivait à l’écran : send-otp recopiait `sendResult.error`. Texte fixe, détail au journal | corrigée | `test(8.3-A35)` 02e331f, `fix(8.3-A35)` 15dc7d0 ; `app/api/auth/send-otp/route.ts` | `tests/parcours/otp-serveur.test.ts:77` | vert au run 113 |
| A36 | Faible | 8.2 i | Le refus de rembourser un billet utilisé montrait le statut technique : `ticket_refund_request` l’écrit, migration gelée, la route met un texte fixe | corrigée | `test(8.3-A36)` ef3e9fa, `fix(8.3-A36)` ffc0167 ; `app/api/partner/events/[id]/tickets/[ticketId]/refund/route.ts`, `M/20261101000005_lot3_remboursements.sql:85` | `tests/parcours/pilotage-remboursement-billet.test.ts:266` | vert au run 113 |
| A37 | Faible | design | Effet de 8.2 s : les barres fixes en bas des pages salles, menu et tables passent sous la navigation mobile. Hors périmètre, derrière interrupteurs | listée | `app/halls/[id]/page.tsx:347`, `app/restaurants/[id]/menu/page.tsx:395`, `app/restaurants/[id]/tables/page.tsx:343` | — | sans objet |
| A38 | Faible | §134 | La colonne Utilisateur montrait un identifiant tronqué. Jointure côté serveur, nom et rôle courant à l’écran | corrigée | `fix(9.3-A38s)` 9c63b516, `fix(9.3-A38e)` ee9b0966 ; `app/api/admin/audit/route.ts:34`, `app/admin/audit/page.tsx:228` | `tests/parcours/admin-audit-lot9.test.ts:136`, `tests/parcours/admin-audit-lot9.test.ts:141`, `tests/parcours/admin-audit-lot9.test.ts:150`, `tests/parcours/admin-audit-lot9.test.ts:207` | vert au run 113 |
| A39 | Moyenne | §158 | Le PDF de clôture portait « Document comptable certifie » et « Certificat de cloture ». Intitulé « Rapport de clôture », plus aucune mention de certification | corrigée | `fix(9.3-A39)` 62be3f26 ; `lib/partner/partner-dashboard.service.ts:918`, `lib/partner/partner-dashboard.service.ts:1072` | `tests/parcours/cloture-vocabulaire.test.ts:61`, `tests/parcours/cloture-vocabulaire.test.ts:66`, `tests/parcours/cloture-vocabulaire.test.ts:74` | vert au run 113 |
| A40 | Faible | outil d’essai | La route de développement ignorait le statut du webhook : un webhook en 500 rendait ok:true. Désormais 502 et message clair | corrigée | `fix(9.3-A40)` a118e370 ; `app/api/dev/samirpay/[action]/route.dev.ts:54`, `components/dev/FakePaymentPanel.tsx` | `tests/schema/essai-route-dev.test.ts:70` | vert au run 113 |
| A41 | Élevée | §36, §179 | Depuis le lot 3, un visiteur sans compte ne pouvait pas commencer un achat : le middleware refusait le devis public, la fiche affichait « Total indisponible ». Trouvée par le parcours de recette au run 99. Le devis passe sans session, le paiement reste protégé | corrigée | `test(8.3-A41)` 697f9ec, `fix(8.3-A41)` c532ca7 ; `middleware.ts:38` | `tests/parcours/finance-affichage.test.ts:80`, `e2e/recette.spec.ts:487` | vert au run 113 |
| PO3 | Moyenne | concurrence | Remboursement d’un billet sans paiement : billet avant catégorie, cycle possible avec l’annulation. Ordre unique rétabli | corrigée | `fix(9.3-PO3)` bf96b1d3 ; `M/20261108000001_lot9_securite.sql:21` | `tests/parcours/course-verrous-lot9.test.ts:186`, `tests/parcours/course-verrous-lot9.test.ts:219`, `tests/parcours/course-verrous-lot9.test.ts:444` | vert au run 113 |
| PO4 | Moyenne | concurrence | event_update et ticket_category_guard : verrou fort sur l’événement, cycle possible avec un paiement. Verrou affaibli, ordre unique | corrigée | `fix(9.3-PO4)` 31e6e613 ; `M/20261108000001_lot9_securite.sql:143`, `M/20261108000001_lot9_securite.sql:518` | `tests/parcours/course-verrous-lot9.test.ts:362`, `tests/parcours/course-verrous-lot9.test.ts:374`, `tests/parcours/course-verrous-lot9.test.ts:457` | vert au run 113 |
| PO10 | Faible | qualité | Code mort : deux modales et le service de calcul sans appelant. Supprimés | corrigée | `fix(9.4-PO10)` f1b4ed60, `fix(9.4-PO10e)` 2423f393 ; `lib/halls/hall.service.ts`, `tests/schema/code-mort-lot9.test.ts` | `tests/schema/code-mort-lot9.test.ts:57`, `tests/schema/code-mort-lot9.test.ts:62`, `tests/schema/code-mort-lot9.test.ts:67` | vert au run 113 |

### Questions au client

Recopiées de `docs/recette-billetterie.md`, section 6 :

| N° | Question |
|---|---|
| Q1 | WhatsApp : faut-il le construire, et pour quels messages ? |
| Q2 | Parrainage prestataire : quelles transactions d’un prestataire comptent ? |
| Q3 | Que recouvre « Wallet » : Apple ou Google Wallet, ou la page Portefeuille ? |
| Q4 | Tranchée par la consigne du lot 9 : Populaires selon les billets vendus sur 7 jours, proches selon la ville du profil ou de l’appareil, sans géolocalisation |
| Q5 | Personnalisation des taux par le superadmin : à construire quand ? |
| Q6 | Quels taux après le passage d’un client en Ambassadeur ? |

À ajouter, posée au rapport du lot 8 et non reprise par la consigne du lot 9 :

| N° | Question |
|---|---|
| N2 | Taux N2 : 2 % comme le fixe la consigne du lot 8, ou 3 % comme l'Annexe A du cahier des charges pour un Ambassadeur qui parraine un prestataire ? Aujourd'hui 2 %, la ligne 3 % est inatteignable tant que le parrainage prestataire n'existe pas (A5, Q2). |

**À trancher avant de recopier ces questions au client.** La consigne du lot 9 place WhatsApp, Apple et Google Wallet, virement bancaire et conversion d'un client en partenaire « hors V1, par décision ». Le document de recette garde pourtant Q1 et Q3 comme des questions, A8 « sans décision écrite », et sa section 4 note « Sans aucune trace écrite : WhatsApp, virement bancaire, application native ». La trace existe désormais. Je n'ai rien corrigé, le fichier est committé et je n'y touche pas ici : à reprendre par le chef de projet, ou à confirmer.

---

---

## 11. Performance avant et après

### 11.1 Poids JavaScript après build (`[JS-BUDGET]`, gzip)

Au run 110, `verify` s'arrête à l'étape `test` : le `[JS-BUDGET]` n'y est pas imprimé. Le tableau vient de l'étape `build-mesure` du même run (`js-budget.tsv`) :

```text
# run 110 (e6c23d1) — docs/lot9-logs/ci-run110-js-budget.tsv
route	fichiers	octets_gzip	octets_bruts	budget	statut
/	16	214735	742650	217000	OK
/events/[id]	16	220686	766708	224000	OK
/tickets	20	237729	815236	241000	OK
/controller/scanner	17	222731	770483	226000	OK
/billet/hors-ligne	15	211628	735453	215000	OK
```

```text
# run 113 (d255bf3) — docs/lot9-logs/ci-run113-verify.log:30316-30323
[JS-BUDGET] budgets : scripts/js-budget.json
[JS-BUDGET] / : 216801 octets gzip (216,8 Ko), 18 fichier(s) JS, 746743 octets bruts — budget 217000 octets (217,0 Ko) : OK
[JS-BUDGET] /events/[id] : 221939 octets gzip (221,9 Ko), 17 fichier(s) JS, 768358 octets bruts — budget 224000 octets (224,0 Ko) : OK
[JS-BUDGET] /tickets : 239011 octets gzip (239,0 Ko), 21 fichier(s) JS, 816890 octets bruts — budget 241000 octets (241,0 Ko) : OK
[JS-BUDGET] /controller/scanner : 223075 octets gzip (223,1 Ko), 18 fichier(s) JS, 769322 octets bruts — budget 226000 octets (226,0 Ko) : OK
[JS-BUDGET] /billet/hors-ligne : 212701 octets gzip (212,7 Ko), 16 fichier(s) JS, 736817 octets bruts — budget 215000 octets (215,0 Ko) : OK
[JS-BUDGET] tableau écrit : .verify/js-budget.tsv
[JS-BUDGET] toutes les routes budgétées sont dans leur budget.
```

| Route | Run 110 (octets gzip) | Run 113 | Écart | Budget | Marge au run 113 |
|---|---|---|---|---|---|
| `/` | 214 735 | 216 801 | +2 066 | 217 000 | **199** |
| `/events/[id]` | 220 686 | 221 939 | +1 253 | 224 000 | 2 061 |
| `/tickets` | 237 729 | 239 011 | +1 282 | 241 000 | 1 989 |
| `/controller/scanner` | 222 731 | 223 075 | +344 | 226 000 | 2 925 |
| `/billet/hors-ligne` | 211 628 | 212 701 | +1 073 | 215 000 | 2 299 |

Aucun budget relevé (`git diff --stat 534d6b3..HEAD -- scripts/js-budget.json` ne renvoie rien).

**Deux chargements différés sur `/`, que la mesure ne compte pas : à lire.** `scripts/js-budget.mjs` ne somme que les fichiers listés dans `app-build-manifest.json` pour `/layout`, `/template` et `/page`. Un morceau chargé par `next/dynamic` n'y figure pas : la mesure baisse quand on sort un composant ainsi, sans que la fonctionnalité disparaisse (217 389, puis 217 012 en CI ; 216 798 en local après `a525015e`). Deux composants de l'accueil ont été sortis ainsi, le second hors contrat :

| Composant | Commit | Raison | Prévu au contrat |
|---|---|---|---|
| `HomeDiscovery` (`app/page.tsx:35`) | `d992ef28` | budget de `/` à 217 389 octets au run 111 | oui, repli annoncé (L53) |
| `AccessNotice` (`app/page.tsx:34`, `ssr: false`) | `a525015e` | budget de `/` à 217 012 octets au run 112 | **non** ; seul un accès refusé en a besoin, il lit l'URL |

```text
# runs/111-42511133163/js-budget.tsv et runs/112-42515091224/js-budget.tsv (ci-results, étape build-mesure), ligne de / seulement
route	fichiers	octets_gzip	octets_bruts	budget	statut
/	17	217389	750654	217000	DEPASSE   ← run 111
/	18	217012	747339	217000	DEPASSE   ← run 112
```

La marge de 199 octets sur `/` ne dit donc pas ce que charge réellement le navigateur. La mesure réseau de la phase `perf`, elle, voit ces morceaux : voir 11.2, JavaScript avant le marqueur à 228,8 Ko sur `/`.

### 11.2 Temps d'affichage (e2e `perf`, médianes de 5 passages, 4G simulée, processeur ×4)

```text
# run 110 (e6c23d1) — docs/lot9-logs/ci-run110-e2e.log
[PERF] Accueil (/, anonyme) — 5 passages, 4G (DevTools « Slow 4G »), processeur ×4
[PERF]   premier affichage utile : médiane 4754 ms, max 4804 ms ; FCP médiane 1496 ms ; LCP médiane 1496 ms, max 1508 ms
[PERF]   JavaScript (a) avant le marqueur : médiane 218,5 Ko, max 218,5 Ko ; (b) à + 3 s : médiane 250,8 Ko ; CSS 16,9 Ko ; total 380,9 Ko ; recoupement réseau 251,3 Ko
[PERF]   budget post-build / : 217,0 Ko + 20,0 Ko de tolérance
[PERF-AVERTISSEMENT] accueil : premier affichage utile médian 4754 ms > 3 000 ms
[PERF] Page événement (/events/708dc7ca-aaf1-400d-be6b-33df27beb3c1, anonyme) — 5 passages, 4G (DevTools « Slow 4G »), processeur ×4
[PERF]   premier affichage utile : médiane 4728 ms, max 4741 ms ; FCP médiane 1472 ms ; LCP médiane 5408 ms, max 5408 ms
[PERF]   JavaScript (a) avant le marqueur : médiane 224,4 Ko, max 224,4 Ko ; (b) à + 3 s : médiane 271,0 Ko ; CSS 16,9 Ko ; total 354,3 Ko ; recoupement réseau 271,5 Ko
[PERF]   budget post-build /events/[id] : 224,0 Ko + 20,0 Ko de tolérance
[PERF-AVERTISSEMENT] evenement : premier affichage utile médian 4728 ms > 3 000 ms
[PERF-AVERTISSEMENT] evenement : LCP médian 5408 ms > 4 000 ms
[PERF] Mes billets (/tickets, client) — 5 passages, 4G (DevTools « Slow 4G »), processeur ×4
[PERF]   premier affichage utile : médiane 5859 ms, max 5880 ms ; FCP médiane 1480 ms ; LCP médiane 7216 ms, max 7256 ms
[PERF]   JavaScript (a) avant le marqueur : médiane 241,5 Ko, max 241,5 Ko ; (b) à + 3 s : médiane 321,9 Ko ; CSS 16,9 Ko ; total 478,4 Ko ; recoupement réseau 322,6 Ko
[PERF]   budget post-build /tickets : 241,0 Ko + 20,0 Ko de tolérance
[PERF-AVERTISSEMENT] mes-billets : premier affichage utile médian 5859 ms > 3 000 ms
[PERF-AVERTISSEMENT] mes-billets : LCP médian 7216 ms > 4 000 ms
[PERF] Scanner (/controller/scanner, controleur) — 5 passages, 4G (DevTools « Slow 4G »), processeur ×4
[PERF]   premier affichage utile : médiane 4764 ms, max 4782 ms ; FCP médiane 1476 ms ; LCP médiane 4788 ms, max 4808 ms
[PERF]   JavaScript (a) avant le marqueur : médiane 240,4 Ko, max 240,4 Ko ; (b) à + 3 s : médiane 274,3 Ko ; CSS 16,9 Ko ; total 331,7 Ko ; recoupement réseau 274,9 Ko
[PERF]   caméra en lecture : médiane 8170 ms ; JavaScript à + 3 s caméra lancée : médiane 451,5 Ko, max 451,5 Ko
[PERF]   budget post-build /controller/scanner : 226,0 Ko + 20,0 Ko de tolérance
[PERF-AVERTISSEMENT] scanner : premier affichage utile médian 4764 ms > 3 000 ms
[PERF-AVERTISSEMENT] scanner : LCP médian 4788 ms > 4 000 ms
```

```text
# run 113 (d255bf3) — docs/lot9-logs/ci-run113-e2e.log
[PERF] Accueil (/, anonyme) — 5 passages, 4G (DevTools « Slow 4G »), processeur ×4
[PERF]   premier affichage utile : médiane 5544 ms, max 5575 ms ; FCP médiane 1504 ms ; LCP médiane 1504 ms, max 1520 ms
[PERF]   JavaScript (a) avant le marqueur : médiane 228,8 Ko, max 228,8 Ko ; (b) à + 3 s : médiane 258,2 Ko ; CSS 16,8 Ko ; total 395,1 Ko ; recoupement réseau 258,7 Ko
[PERF]   budget post-build / : 217,0 Ko + 20,0 Ko de tolérance
[PERF-AVERTISSEMENT] accueil : premier affichage utile médian 5544 ms > 3 000 ms
[PERF] Page événement (/events/3ef2b861-c6e9-487e-9b72-1fb9664264a8, anonyme) — 5 passages, 4G (DevTools « Slow 4G »), processeur ×4
[PERF]   premier affichage utile : médiane 4741 ms, max 4789 ms ; FCP médiane 1464 ms ; LCP médiane 5420 ms, max 5456 ms
[PERF]   JavaScript (a) avant le marqueur : médiane 225,7 Ko, max 225,7 Ko ; (b) à + 3 s : médiane 275,1 Ko ; CSS 16,8 Ko ; total 358,4 Ko ; recoupement réseau 275,6 Ko
[PERF]   budget post-build /events/[id] : 224,0 Ko + 20,0 Ko de tolérance
[PERF-AVERTISSEMENT] evenement : premier affichage utile médian 4741 ms > 3 000 ms
[PERF-AVERTISSEMENT] evenement : LCP médian 5420 ms > 4 000 ms
[PERF] Mes billets (/tickets, client) — 5 passages, 4G (DevTools « Slow 4G »), processeur ×4
[PERF]   premier affichage utile : médiane 5937 ms, max 5950 ms ; FCP médiane 1496 ms ; LCP médiane 7108 ms, max 7144 ms
[PERF]   JavaScript (a) avant le marqueur : médiane 242,8 Ko, max 242,8 Ko ; (b) à + 3 s : médiane 335,3 Ko ; CSS 16,8 Ko ; total 491,9 Ko ; recoupement réseau 336,0 Ko
[PERF]   budget post-build /tickets : 241,0 Ko + 20,0 Ko de tolérance
[PERF-AVERTISSEMENT] mes-billets : premier affichage utile médian 5937 ms > 3 000 ms
[PERF-AVERTISSEMENT] mes-billets : LCP médian 7108 ms > 4 000 ms
[PERF] Scanner (/controller/scanner, controleur) — 5 passages, 4G (DevTools « Slow 4G »), processeur ×4
[PERF]   premier affichage utile : médiane 4818 ms, max 4842 ms ; FCP médiane 1480 ms ; LCP médiane 4852 ms, max 4864 ms
[PERF]   JavaScript (a) avant le marqueur : médiane 240,7 Ko, max 240,7 Ko ; (b) à + 3 s : médiane 275,7 Ko ; CSS 16,8 Ko ; total 333,2 Ko ; recoupement réseau 276,3 Ko
[PERF]   caméra en lecture : médiane 8298 ms ; JavaScript à + 3 s caméra lancée : médiane 453,1 Ko, max 453,1 Ko
[PERF]   budget post-build /controller/scanner : 226,0 Ko + 20,0 Ko de tolérance
[PERF-AVERTISSEMENT] scanner : premier affichage utile médian 4818 ms > 3 000 ms
[PERF-AVERTISSEMENT] scanner : LCP médian 4852 ms > 4 000 ms
```

| Page | Affichage utile, médiane 110 → 113 | LCP, médiane 110 → 113 | JS avant le marqueur 110 → 113 | JS à + 3 s 110 → 113 |
|---|---|---|---|---|
| Accueil | 4754 → **5544 ms** (+790 ms, +16,6 %) | 1496 → 1504 ms | 218,5 → **228,8 Ko** | 250,8 → 258,2 Ko |
| Page événement | 4728 → 4741 ms | 5408 → 5420 ms | 224,4 → 225,7 Ko | 271,0 → 275,1 Ko |
| Mes billets | 5859 → 5937 ms | 7216 → 7108 ms | 241,5 → 242,8 Ko | 321,9 → **335,3 Ko** |
| Scanner | 4764 → 4818 ms | 4788 → 4852 ms | 240,4 → 240,7 Ko | 274,3 → 275,7 Ko |

**À lire.** L'accueil est plus lent de 790 ms et charge 10,3 Ko de JavaScript de plus avant le marqueur, alors que le `[JS-BUDGET]` de `/` ne monte que de 2 066 octets. Cet écart est cohérent avec les morceaux différés, que `[JS-BUDGET]` ne compte pas ; je ne l'ai pas chiffré morceau par morceau. Le plafond de la phase `perf` (`e2e/perf.spec.ts:423`, budget + 20,0 Ko, en `expect.soft`) n'est pas dépassé : 228,8 Ko pour 237,0. Sur `/tickets`, le JavaScript à + 3 s gagne 13,4 Ko, cause non recherchée.

Le marqueur de l'accueil est un élément de la section « À l'affiche » (`section[aria-labelledby="affiche-titre"] h3`), pas de Populaires. Que les 790 ms viennent des morceaux différés, du passage au filtre serveur, ou d'autre chose : NON ÉTABLI, un seul run de chaque côté.

Les avertissements `[PERF-AVERTISSEMENT]` (affichage utile au-delà de 3 s, LCP au-delà de 4 s) sont les mêmes avant et après, sur les quatre pages ; ils ne sont pas bloquants et existaient avant le lot 9.

---

---

## 12. Avertissements et contrôles bloquants des captures au run final

Run 115 : `avertissements.tsv`, 353 lignes, 353 à `OK`, 0 autres.

```text
ecran	vue	theme	resultat	cibles_44	textes_14_bruts	textes_14_admis	textes_14_hors_exemption	axe_regles	axe_detail	prechargements_abandonnes
```

`runPageChecks` passe avant le masquage des QR : les contrôles ne changent pas. Détail par écran : section 3.

---

## 13. Traces ui-ux-pro-max

23 traces dans `docs/lot9-logs/ui-ux-pro-max/`, une par appel du skill. Chaque fichier garde l'en-tête (agent, sujet, date, commande) puis la sortie brute du skill. L'en-tête du script dit encore « lot 8 » : sans effet, signalé au contrat. Répartition : E0 3, E1 3, E2 5, E3 3, E4 4, ORCH 1, R2 4. « R2 » est l'agent correcteur de la relecture ; « ORCH », l'orchestrateur. Aucune trace n'est vide.

| Fichier | Agent | Requête | Résultats | Règles renvoyées (titres) |
|---|---|---|---|---|
| `E0-001-invitations-formulaire.txt` | E0 | domain ux | 3 | Focusable Error Summary; Inline Validation; Error Placement |
| `E0-002-invitations-liste.txt` | E0 | domain ux | 3 | Confirmation Dialogs; Empty States; Confirmation Messages |
| `E0-003-invitations-rendu.txt` | E0 | stack nextjs | 3 | Push Client Components down; Mark Client Components explicitly; Use generateMetadata for dynamic |
| `E1-001-accueil-sections.txt` | E1 | domain ux | 3 | Active State; Content Jumping; Error Messages |
| `E1-002-catalogue-recherche.txt` | E1 | domain ux | 3 | No Results; Autocomplete; ARIA Labels |
| `E1-003-rendu-client.txt` | E1 | stack nextjs | 3 | Use dynamic imports; Analyze bundle size; Push Client Components down |
| `E2-001-profil-formulaire.txt` | E2 | domain ux | 3 | Focusable Error Summary; Inline Validation; Error Placement |
| `E2-002-numero-otp.txt` | E2 | domain ux | 3 | Progress Indicators; Code Splitting; Focus States |
| `E2-003-avatar-photo.txt` | E2 | domain ux | 3 | Input Types; Input Labels; Confirmation Messages |
| `E2-004-mes-paiements.txt` | E2 | domain ux | 3 | Submit Feedback; Compact Label Overflow; Input Labels |
| `E2-005-rendu.txt` | E2 | stack nextjs | 3 | Handle loading states; Use next/image for optimization; Revalidate or update data appropriately |
| `E3-001-audit-acces-refuse.txt` | E3 | domain ux | 3 | Empty States; Essential Text Truncation; Active State |
| `E3-002-audit-cellule-utilisateur.txt` | E3 | domain ux | 3 | Readable Font Size; Color Contrast; Table Handling |
| `E3-003-audit-rendu.txt` | E3 | stack nextjs | 3 | Handle errors with error.tsx; Push Client Components down; Mark Client Components explicitly |
| `E4-001-scanner-sans-encaissement.txt` | E4 | domain ux | 3 | Haptic Feedback; Auto-Rotating Content Controls; Streaming |
| `E4-002-pilotage-grille-kpi.txt` | E4 | domain ux | 3 | Mobile First; Viewport Meta; Table Handling |
| `E4-003-libelles-caisse-equipe.txt` | E4 | domain ux | 3 | Submit Feedback; Form Labels; Compact Label Overflow |
| `E4-004-rendu-suppression-branches.txt` | E4 | stack nextjs | 3 | Push Client Components down; Mark Client Components explicitly; Use dynamic imports |
| `ORCH-001-accueil-chargement-differe.txt` | ORCH | stack nextjs | 3 | Provide width and height; Use next/font for fonts; Apply font to layout |
| `R2-001-catalogue-filtres-mobile.txt` | R2 | domain ux | 3 | Horizontal Scroll; Chip Collection Reflow; Smooth Scroll |
| `R2-002-modale-pied-fixe.txt` | R2 | domain ux | 3 | Focus States; Keyboard Navigation; Smooth Scroll |
| `R2-003-troncature-retour-ligne.txt` | R2 | domain ux | 3 | Essential Text Truncation; Compact Label Overflow; Line Height |
| `R2-004-rendu-next.txt` | R2 | stack nextjs | 3 | Push Client Components down; Mark Client Components explicitly; Use Server Components by default |

**Ce que chaque agent en a tiré**, selon ce qu'il a écrit dans son compte rendu (`lot9-ecrans-results.md`, `lot9-f-results.md`) :

| Trace | Décision écrite |
|---|---|
| `E0-001-invitations-formulaire` | Erreurs sous chaque champ, reliées par `aria-describedby` ; validation à la sortie du champ et à l'envoi ; focus sur le premier champ invalide ; bandeau `role="alert"` pour les refus du serveur. Écart assumé : pas de liens dans le bandeau, un refus ne porte que sur un champ |
| `E0-002-invitations-liste` | Annulation derrière `ConfirmDialog` en variante danger ; état vide explicite ; bandeau de succès |
| `E0-003-invitations-rendu` | Onglet en composant client feuille ; page déjà `'use client'`, inchangée |
| `E1-001-accueil-sections` | Squelette de même gabarit, sélecteur réservé, liste gardée au changement de ville ; `ErrorState` en `role="alert"` |
| `E1-002-catalogue-recherche` | État vide distinct, « Effacer les filtres » ; recherche debouncée sans liste de suggestions |
| `E1-003-rendu-client` | Mesure avant tout repli, `dynamic` gardé en réserve ; lecture de la ville dans un composant feuille, en effet seulement |
| `E2-001-profil-formulaire` | Erreur sous chaque champ, `aria-describedby`, validation à la sortie du champ, focus sur le premier champ invalide |
| `E2-002-numero-otp` | « Étape 1 sur 2 » en sous-titre, anneaux de focus des composants communs |
| `E2-003-avatar-photo` | Champ de fichier étiqueté, confirmation par toast |
| `E2-004-mes-paiements` | Pastille de statut sur une ligne, libellé toujours écrit, retour de chargement |
| `E2-005-rendu` | `loading.tsx` à côté de la page. Recommandation `next/image` écartée par AR3 |
| `E3-001-audit-acces-refuse` | Message utile et lien de retour ; pas de nom coupé par une ellipse |
| `E3-002-audit-cellule-utilisateur` | Cellule `text-sm`, tokens `text-fg` et `text-fg-muted`, retour à la ligne ; `overflow-x-auto` conservé |
| `E3-003-audit-rendu` | La consigne `error.tsx` ne s'applique pas : un refus attendu n'est pas une exception |
| `E4-001-scanner-sans-encaissement` | Aucune règle applicable, rien décidé d'après elle |
| `E4-002-pilotage-grille-kpi` | Mobile d'abord : 2 colonnes, 3 à partir de `xl` |
| `E4-003-libelles-caisse-equipe` | Rien de spécifique sur la rédaction ; textes réduits à ce qui reste vrai |
| `E4-004-rendu-suppression-branches` | `'use client'` et `dynamic()` du scanner laissés tels quels |
| `R2-001-catalogue-filtres-mobile` | Proscrit une rangée de puces coupée : d'où le repli sous un bouton |
| `R2-002-modale-pied-fixe` | N'a pas fait décider le pied fixe ; rappelle le focus visible et l'ordre de tabulation |
| `R2-003-troncature-retour-ligne` | Texte essentiel accessible en entier, d'où les numéros insécables |
| `R2-004-rendu-next` | Aucune décision, le changement reste dans le composant client existant |
| `ORCH-001-accueil-chargement-differe` | Aucune note de l'orchestrateur. Le commit `d992ef28` invoque le repli du contrat, pas la trace |

### Extrait brut, une trace par agent (en-tête et premier résultat)

```text
# docs/lot9-logs/ui-ux-pro-max/E0-001-invitations-formulaire.txt (lignes 1 à 21, lignes vides retirées)
# Trace d'invocation du skill ui-ux-pro-max (lot 8)
# agent    : E0
# sujet    : invitations-formulaire
# date UTC : 2026-11-08T18:16:10Z
# commande : python ~/.claude/skills/ui-ux-pro-max/scripts/search.py form\ multiple\ phone\ numbers\ textarea\ inline\ validation\ error\ summary\ bulk\ send\ confirmation --domain ux
# ---------------------------------------------------------------- sortie brute
## UI Pro Max Search Results
**Domain:** ux | **Query:** form multiple phone numbers textarea inline validation error summary bulk send confirmation
**Source:** ux-guidelines.csv | **Found:** 3 results
### Result 1
- **Category:** Forms / Accessibility
- **Issue:** Focusable Error Summary
- **Platform:** Web
- **Description:** An error summary for failed validation complements inline field errors and must be easy to find by keyboard and screen reader users
- **Do:** Place it at the top of the form; move focus to its heading or container after failed submit; link each item to its invalid field; retain inline errors
- **Don't:** Replace inline errors with a visual-only summary or move focus on every blur
- **Code Example Good:** <div role="alert" tabindex="-1" aria-labelledby="error-title"><h2 id="error-title">There is a problem</h2><a href="#email">Enter an email address</a></div>
- **Code Example Bad:** Toast only with no field links or focus target
- **Severity:** High
```

```text
# docs/lot9-logs/ui-ux-pro-max/E1-001-accueil-sections.txt (lignes 1 à 21, lignes vides retirées)
# Trace d'invocation du skill ui-ux-pro-max (lot 8)
# agent    : E1
# sujet    : accueil-sections
# date UTC : 2026-11-08T18:16:13Z
# commande : python ~/.claude/skills/ui-ux-pro-max/scripts/search.py home\ page\ discovery\ sections\ popular\ nearby\ city\ selector\ empty\ state\ error\ retry\ skeleton\ loading --domain ux
# ---------------------------------------------------------------- sortie brute
## UI Pro Max Search Results
**Domain:** ux | **Query:** home page discovery sections popular nearby city selector empty state error retry skeleton loading
**Source:** ux-guidelines.csv | **Found:** 3 results
### Result 1
- **Category:** Navigation
- **Issue:** Active State
- **Platform:** All
- **Description:** Current page/section should be visually indicated
- **Do:** Highlight active nav item with color/underline
- **Don't:** No visual feedback on current location
- **Code Example Good:** text-primary border-b-2
- **Code Example Bad:** All links same style
- **Severity:** Medium
```

```text
# docs/lot9-logs/ui-ux-pro-max/E2-001-profil-formulaire.txt (lignes 1 à 21, lignes vides retirées)
# Trace d'invocation du skill ui-ux-pro-max (lot 8)
# agent    : E2
# sujet    : profil-formulaire
# date UTC : 2026-11-08T18:23:18Z
# commande : python ~/.claude/skills/ui-ux-pro-max/scripts/search.py profile\ settings\ form\ inline\ validation\ error\ message\ save\ feedback --domain ux
# ---------------------------------------------------------------- sortie brute
## UI Pro Max Search Results
**Domain:** ux | **Query:** profile settings form inline validation error message save feedback
**Source:** ux-guidelines.csv | **Found:** 3 results
### Result 1
- **Category:** Forms / Accessibility
- **Issue:** Focusable Error Summary
- **Platform:** Web
- **Description:** An error summary for failed validation complements inline field errors and must be easy to find by keyboard and screen reader users
- **Do:** Place it at the top of the form; move focus to its heading or container after failed submit; link each item to its invalid field; retain inline errors
- **Don't:** Replace inline errors with a visual-only summary or move focus on every blur
- **Code Example Good:** <div role="alert" tabindex="-1" aria-labelledby="error-title"><h2 id="error-title">There is a problem</h2><a href="#email">Enter an email address</a></div>
- **Code Example Bad:** Toast only with no field links or focus target
- **Severity:** High
```

```text
# docs/lot9-logs/ui-ux-pro-max/E3-001-audit-acces-refuse.txt (lignes 1 à 21, lignes vides retirées)
# Trace d'invocation du skill ui-ux-pro-max (lot 8)
# agent    : E3
# sujet    : audit-acces-refuse
# date UTC : 2026-11-08T18:30:28Z
# commande : python ~/.claude/skills/ui-ux-pro-max/scripts/search.py access\ denied\ forbidden\ empty\ state\ permission\ message\ no\ retry --domain ux
# ---------------------------------------------------------------- sortie brute
## UI Pro Max Search Results
**Domain:** ux | **Query:** access denied forbidden empty state permission message no retry
**Source:** ux-guidelines.csv | **Found:** 3 results
### Result 1
- **Category:** Feedback
- **Issue:** Empty States
- **Platform:** All
- **Description:** Guide users when no content exists
- **Do:** Show helpful message and action
- **Don't:** Blank empty screens
- **Code Example Good:** No items yet. Create one!
- **Code Example Bad:** Empty white space
- **Severity:** Medium
```

```text
# docs/lot9-logs/ui-ux-pro-max/E4-001-scanner-sans-encaissement.txt (lignes 1 à 21, lignes vides retirées)
# Trace d'invocation du skill ui-ux-pro-max (lot 8)
# agent    : E4
# sujet    : scanner-sans-encaissement
# date UTC : 2026-11-08T18:33:55Z
# commande : python ~/.claude/skills/ui-ux-pro-max/scripts/search.py scanner\ full\ screen\ result\ auto\ dismiss\,\ remove\ action\ state\,\ touch\ to\ dismiss\,\ consistent\ feedback --domain ux
# ---------------------------------------------------------------- sortie brute
## UI Pro Max Search Results
**Domain:** ux | **Query:** scanner full screen result auto dismiss, remove action state, touch to dismiss, consistent feedback
**Source:** ux-guidelines.csv | **Found:** 3 results
### Result 1
- **Category:** Touch
- **Issue:** Haptic Feedback
- **Platform:** Mobile
- **Description:** Tactile feedback improves interaction feel
- **Do:** Use for confirmations and important actions
- **Don't:** Overuse vibration feedback
- **Code Example Good:** navigator.vibrate(10)
- **Code Example Bad:** Vibrate on every tap
- **Severity:** Low
```

```text
# docs/lot9-logs/ui-ux-pro-max/R2-001-catalogue-filtres-mobile.txt (lignes 1 à 21, lignes vides retirées)
# Trace d'invocation du skill ui-ux-pro-max (lot 8)
# agent    : R2
# sujet    : catalogue-filtres-mobile
# date UTC : 2026-11-08T19:49:53Z
# commande : python ~/.claude/skills/ui-ux-pro-max/scripts/search.py mobile\ filter\ panel\ collapse\ progressive\ disclosure\ horizontal\ scroll\ chips\ above\ the\ fold --domain ux
# ---------------------------------------------------------------- sortie brute
## UI Pro Max Search Results
**Domain:** ux | **Query:** mobile filter panel collapse progressive disclosure horizontal scroll chips above the fold
**Source:** ux-guidelines.csv | **Found:** 3 results
### Result 1
- **Category:** Responsive
- **Issue:** Horizontal Scroll
- **Platform:** Web
- **Description:** Avoid horizontal scrolling
- **Do:** Ensure content fits viewport width
- **Don't:** Content wider than viewport
- **Code Example Good:** max-w-full overflow-x-hidden
- **Code Example Bad:** Horizontal scrollbar on mobile
- **Severity:** High
```

```text
# docs/lot9-logs/ui-ux-pro-max/ORCH-001-accueil-chargement-differe.txt (lignes 1 à 24, lignes vides retirées)
# Trace d'invocation du skill ui-ux-pro-max (lot 8)
# agent    : ORCH
# sujet    : accueil-chargement-differe
# date UTC : 2026-11-08T19:25:38Z
# commande : python ~/.claude/skills/ui-ux-pro-max/scripts/search.py lazy\ load\ below\ the\ fold\ section\ without\ layout\ shift --stack nextjs
# ---------------------------------------------------------------- sortie brute
## UI Pro Max Stack Guidelines
**Stack:** nextjs | **Query:** lazy load below the fold section without layout shift
**Source:** stacks/nextjs.csv | **Found:** 3 results
### Result 1
- **Category:** Images
- **Guideline:** Provide width and height
- **Description:** Prevent layout shift with dimensions
- **Do:** width and height props or fill
- **Don't:** Missing dimensions
- **Code Good:** <Image width={400} height={300}/>
- **Code Bad:** <Image src={url}/>
- **Severity:** High
- **Docs URL:** https://nextjs.org/docs/app/api-reference/components/image
- **Applies To:** nextjs 16.2
- **Status:** active
- **Verified At:** 2026-08-13
```

---

---

## 14. Variables d'environnement, réglages SUPERADMIN, coût SMS

Référence : `lib/env.ts` et `.env.example` à `fede597`, contrat section 11. Aucune valeur réelle n'est écrite ici.

### 14.1 Variables d'environnement

**Aucune variable obligatoire nouvelle.** Quatre variables facultatives, une retirée.

| Variable | Rôle | Lue par | Défaut | Tâche |
|---|---|---|---|---|
| `INVITATION_PER_EVENT_HOUR` | invitations (lignes numéro d'un envoi) par événement et par heure | `lib/tickets/invitation.service.ts` | 50 | 9.0 |
| `INVITATION_PER_PHONE_DAY` | invitations par numéro et par jour, tous événements confondus | idem | 3 | 9.0 |
| `PHONE_CHANGE_PER_ACCOUNT_DAY` | codes de changement de numéro par compte et par jour | `app/api/account/phone/start/route.ts` | 5 | 9.2 |
| `AVATAR_UPLOADS_PER_ACCOUNT_HOUR` | envois de photo par compte et par heure | `app/api/account/avatar/route.ts` | 20 | 9.2 |
| `CASH_COLLECT_PER_SCANNER_MIN` | **retirée** (A16) : à retirer aussi de l'hébergeur | — | — | 9.4 |

Dépendance à vérifier en production, sans variable : **`sharp`** (0.33.5, en `dependencies`). `scripts/e2e/start-app.mjs:86-92` échoue s'il ne se charge pas, la route photo est en `runtime = 'nodejs'`.

Diff de `lib/env.ts`, `.env.example` et `.env.test.example` sur le lot (lignes ajoutées et retirées) :

```text
$ git diff 534d6b3..HEAD -- lib/env.ts | grep '^[-+]'
--- a/lib/env.ts
+++ b/lib/env.ts
-    CASH_COLLECT_PER_SCANNER_MIN: limit(20), // encaissements espèces par scanneur
+    // Lot 9 (9.0) : invitations (lignes numéro) par événement et par heure, puis par numéro et par jour
+    INVITATION_PER_EVENT_HOUR: limit(50),
+    INVITATION_PER_PHONE_DAY: limit(3),
+    // Lot 9 (9.2) : codes de changement de numéro par compte et par jour ; envois de photo par compte et par heure
+    PHONE_CHANGE_PER_ACCOUNT_DAY: limit(5),
+    AVATAR_UPLOADS_PER_ACCOUNT_HOUR: limit(20),

$ git diff 534d6b3..HEAD -- .env.example | grep '^[-+]'
--- a/.env.example
+++ b/.env.example
-# CASH_COLLECT_PER_SCANNER_MIN=20
+# Lot 9 : invitations (lignes numéro) par événement et par heure, puis par numéro et par jour
+# INVITATION_PER_EVENT_HOUR=50
+# INVITATION_PER_PHONE_DAY=3
+# Lot 9 : codes de changement de numéro par compte et par jour ; envois de photo par compte et par heure
+# PHONE_CHANGE_PER_ACCOUNT_DAY=5
+# AVATAR_UPLOADS_PER_ACCOUNT_HOUR=20

$ git diff 534d6b3..HEAD -- .env.test.example | grep '^[-+]'
--- a/.env.test.example
+++ b/.env.test.example
-CASH_COLLECT_PER_SCANNER_MIN=20
+# Lot 9 : invitations (par événement et par heure, par numéro et par jour), changement de numéro (par compte
+# et par jour), photo (par compte et par heure) ; valeurs du contrat, les suites de quota règlent les leurs par withEnv
+INVITATION_PER_EVENT_HOUR=50
+INVITATION_PER_PHONE_DAY=3
+PHONE_CHANGE_PER_ACCOUNT_DAY=5
+AVATAR_UPLOADS_PER_ACCOUNT_HOUR=20
```

Lectures directes de `process.env` dans le code de l'application et les scripts du mode d'essai, même commande qu'au lot 8. **Une seule différence avec le lot 8** : `NEXT_PUBLIC_SUPABASE_URL` passe de 10 à 11 lectures (`components/ui/Avatar.tsx:12`, garde `isAvatarUrl`). Aucune variable nouvelle hors de `lib/env.ts`.

```text
$ grep -rhoE "process\.env\.[A-Z_][A-Z0-9_]*|process\.env\[['\"][A-Z_][A-Z0-9_]*" app lib components hooks middleware.ts instrumentation.ts next.config.* scripts/dev scripts/*.mjs | sed … | sort | uniq -c
      1 CRON_SECRET
      1 EV_DEV_APP_PORT
      3 EV_DEV_FAKE_PORT
      1 EV_DEV_FAKE_SERVICES_URL
      2 EV_ENV_FILE
      5 EV_INTEGRATIONS
      1 MTARGET_API_URL
      1 MTARGET_PASSWORD
      1 MTARGET_SENDER
      1 MTARGET_SERVICE_ID
      1 MTARGET_TIMEOUT_MS
      1 MTARGET_USERNAME
      2 NEXT_PUBLIC_APP_URL
      2 NEXT_PUBLIC_MAP_TILE_ATTRIBUTION
      2 NEXT_PUBLIC_MAP_TILE_URL
      5 NEXT_PUBLIC_SUPABASE_ANON_KEY
     11 NEXT_PUBLIC_SUPABASE_URL
      1 NEXT_RUNTIME
      1 NEXT_TELEMETRY_DISABLED
     19 NODE_ENV
      1 NOTIFICATION_FROM_EMAIL
      1 PUSH_ENDPOINT_ALLOWED_ORIGINS
      1 PUSH_TIMEOUT_MS
      2 RESEND_API_KEY
      1 SUPABASE_AUTH_HOOK_SECRET
      1 VAPID_PRIVATE_KEY
      1 VAPID_PUBLIC_KEY
      1 VAPID_SUBJECT
```

**Tableau complet après le lot 9** (lot 8, section 16.1 de `docs/lot8-rapport.md`, moins `CASH_COLLECT_PER_SCANNER_MIN`, plus la ligne du lot 9). Contrôle fait par script : chaque clé du schéma de `lib/env.ts` à `fede597` figure dans ce tableau. Résultat : 73 clés au schéma, aucune absente du tableau.

| Catégorie | Variables |
|---|---|
| **Obligatoires** (le serveur refuse de démarrer sans elles) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL` (HTTPS définitive), `SAMIRPAY_API_URL`, `SAMIRPAY_API_KEY`, `SAMIRPAY_SECRET_KEY`, `MTARGET_USERNAME`, `MTARGET_PASSWORD`, `OTP_HASH_SECRET`, `TICKET_TOTP_MASTER_KEY`, `REGISSEUR_PIN_KEY` (trois secrets différents entre eux et de toute autre clé) |
| **Obligatoire en exploitation** | `CRON_SECRET` : sans elle, toutes les routes `/api/cron/*` répondent 503. Sa valeur est recopiée dans le secret Vault `ev_cron_secret` |
| **Facultatives du lot 6** | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (les trois ou aucune) ; `MTARGET_TIMEOUT_MS` (15 000) ; `PUSH_TIMEOUT_MS` (10 000) ; `PUSH_SUBSCRIBE_PER_USER_HOUR` (20) ; `PUSH_TEST_PER_USER_HOUR` (5) ; `PUSH_ENDPOINT_ALLOWED_ORIGINS` (à ne pas renseigner en production) |
| **Facultatives du lot 7** | `OFFLINE_CODES_PER_TICKET_HOUR` (12), `OFFLINE_CODES_PER_USER_HOUR` (60), `SCAN_LOOKUP_PER_SCANNER_MIN` (20) |
| **Facultatives du lot 9** | `INVITATION_PER_EVENT_HOUR` (50), `INVITATION_PER_PHONE_DAY` (3), `PHONE_CHANGE_PER_ACCOUNT_DAY` (5), `AVATAR_UPLOADS_PER_ACCOUNT_HOUR` (20) |
| **Intégrations** | `MTARGET_API_URL`, `MTARGET_SERVICE_ID`, `MTARGET_SENDER`, `SAMIRPAY_TIMEOUT_MS` (15 000), `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`, `SUPPORT_EMAIL`, `SUPABASE_AUTH_HOOK_SECRET` |
| **Quotas SMS** | `SMS_OTP_PER_PHONE_15MIN` (3), `SMS_OTP_PER_PHONE_DAY` (10), `SMS_OTP_PER_IP_HOUR` (10), `SMS_OTP_PER_IP_DAY` (30), `SMS_PER_PHONE_DAY` (30), `SMS_GLOBAL_DAILY_CAP` (1 000), `SMS_PER_ACCOUNT_DAY` (30), `SMS_GLOBAL_OTP_RESERVED_PERCENT` (30) |
| **Paiement** | `PAYMENT_HOLD_MINUTES` (15), `CHECKOUT_PER_USER_15MIN` (10), `CHECKOUT_PER_USER_DAY` (50), `CLAIM_FREE_PER_USER_HOUR` (20), `STATUS_POLL_RECONCILE_SECONDS` (5), `PAYMENT_RECONCILE_MIN_AGE_MINUTES` (2), `PAYMENT_PENDING_MAX_AGE_MINUTES` (60), `PAYMENT_LATE_SUCCESS_WINDOW_HOURS` (48), `PAYMENT_RECONCILE_BATCH` (50) |
| **Quotas du lot 4** | `SCAN_PER_SCANNER_10S` (30), `LIVE_CODE_PER_USER_MIN` (60), `RESOLVE_PHONE_PER_IP_HOUR` (30), `VERIFY_OTP_PER_PHONE_15MIN` (10), `CONTROLLER_SETUP_PER_PHONE_HOUR` (10), `PARTNER_REGISTER_PER_IP_HOUR` (10), `INVITE_PER_PARTNER_HOUR` (20), `INVITE_PER_PHONE_DAY` (3), `REGISSEUR_PIN_PER_SHIFT_15MIN` (5) |
| **Quotas du lot 5** | `WITHDRAWAL_REQUEST_PER_USER_HOUR` (10), `COUNTER_RECEIPT_PER_SHIFT_DAY` (500), `SCAN_INCIDENT_REPORT_PER_SCANNER_MIN` (10), `SCAN_INCIDENT_LOG_PER_SCANNER_MIN` (60) |
| **Autres** | `DOCUMENT_UPLOADS_PER_IP_HOUR` (20), `CLIENT_IP_SOURCE` (`x-forwarded-for`), `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION`, `SUPERADMIN_PHONE` (déclarée, lue nulle part selon le lot 8), `NODE_ENV` ; `EV_INTEGRATIONS` : **ne pas définir en production** (refusée hors développement et test) |
| **Mode d'essai (lot 8), jamais en production** | `EV_DEV_FAKE_SERVICES_URL`, `EV_DEV_FAKE_PORT` (4010), `EV_DEV_APP_PORT` (3000), `EV_DEV_PROJECT_REF`, `EV_DEV_SEED_PASSWORD`, `EV_DEV_TUNNEL_URL`, `EV_ESSAI_SIMULATION` (posée par `essai:start` seulement) |

Les valeurs par défaut des quatre variables du lot sont lues dans `lib/env.ts`. INFRA-S dit aussi avoir contrôlé `getServerEnv()` : 50, 3, 5, 20, avec et sans `.env.test.example`. `.env.test.example` les déclare aux mêmes valeurs ; les suites de quota les règlent par `withEnv`.

### 14.2 Réglages SUPERADMIN

**Aucun réglage nouveau au lot 9** (L56). Preuve : les cinq migrations du lot ne nomment ni `platform_settings`, ni `fin_setting_valid`, ni `finance_setting_set` ; les migrations `20261105…` et `20261106…` sont gelées par SHA-256 et `migrations-gelees` est vert au run 113.

```text
$ git grep -nE 'platform_settings|fin_setting_valid|finance_setting_set' HEAD -- 'supabase/migrations/20261108*'; echo "code $?"
code 1

tests/schema/migrations-gelees.test.ts                 PASS     337ms     0     .test-logs/tests__schema__migrations-gelees.test.ts.log
```

Le tableau reste donc celui de la fin du lot 7. Je ne l'ai pas relu contre une base : il est recopié de `docs/lot8-rapport.md`, section 16.2.

| Clé | Défaut | Valeurs admises | Lot |
|---|---|---|---|
| `finance.service_fee_rate` | 5 (repris de `ticketing_fee_config`) | 0 à 50 (%) | 3 |
| `finance.aggregator_fee_rate.WAVE` | 1,5 | 0 à 10 (%) | 3 |
| `finance.aggregator_fee_rate.ORANGE_MONEY` | 1,5 | 0 à 10 (%) | 3 |
| `finance.cancellation_aggregator_fee_bearer` | `EVENT_VILLAGE` | `EVENT_VILLAGE`, `ORGANISATEUR` | 3 |
| `finance.payout_hold_enabled` | true | booléen | 3 |
| `finance.payout_delay_hours` | 48 | entier de 0 à 720 | 3 |
| `finance.withdrawal_fee_rate` | 1 | 0 à 10 (%) | 3 |
| `finance.withdrawal_min_amount` | 5 000 | entier de 0 à 10 000 000 (F CFA) | 3 |
| `finance.withdrawal_bank_enabled` | false | booléen | 3 |
| `finance.referral_availability_days` | 7 | entier de 7 à 14 | 3 |
| `access.manual_entry_scope` | `ASSIGNED_CONTROLLER` | `ASSIGNED_CONTROLLER`, `STAFF` | 4 |
| `access.scan_window_before_hours` | 6 | entier de 0 à 48 | 4 |
| `access.scan_window_after_hours` | 6 | entier de 0 à 48 | 4 |
| `access.counter_sale_enabled` | true | booléen | 4 |
| `access.low_stock_threshold` | 10 | entier de 1 à 1 000 | 5 |
| `notif.reminder_j1_enabled` | true | booléen | 6 |
| `notif.reminder_j1_hour` | 10 | entier de 6 à 20 (heure de Dakar) | 6 |
| `notif.reminder_h3_enabled` | true | booléen | 6 |
| `notif.reminder_h3_hours` | 3 | entier de 1 à 12 | 6 |
| `notif.j1_sms` | `ALWAYS` | `ALWAYS`, `IF_NO_PUSH`, `NEVER` | 6 |
| `notif.h3_sms` | `IF_NO_PUSH` | idem | 6 |
| `notif.sms_quiet_start` | 22 | entier de 0 à 23 | 6 |
| `notif.sms_quiet_end` | 8 | entier de 0 à 23 | 6 |
| `notif.sms_optional_daily_cap` | 700 | entier de 0 à 1 000 000 ; 0 : aucun SMS optionnel | 7 |
| `notif.free_ticket_reminder_sms` | `NEVER` | `NEVER`, `SAME_AS_PAID` | 7 |
| `features.halls_enabled` | false | booléen ; un ADMIN ne peut pas l'écrire | 7 |
| `features.tables_enabled` | false | idem | 7 |
| `features.orders_enabled` | false | idem ; `/orders` en 404 seulement si les trois sont fermés | 7 |

Effet du lot 9 sur ces réglages : `notif.free_ticket_reminder_sms` s'applique aux invitations, qui entraient déjà dans « billet gratuit » depuis le lot 7 (voir 14.3).

### 14.3 Coût SMS (réglages par défaut, avec INVITATION_RECEIVED et PHONE_CHANGED)

Format de `docs/lot7-rapport.md`, section 12 ; le rapport du lot 8 n'avait pas ce tableau.

**Sources.**
- **Registre** `notification_types` : `M/20261103000002`, complétée par les lots 7 et 8, puis `M/20261108000002:42` (`INVITATION_RECEIVED`) et `M/20261108000004:31-32` (`PHONE_CHANGED`, `OTP_PHONE_CHANGE`).
- **Catalogue** `lib/notifications/catalog.ts:564,728,1147`. L'égalité registre-catalogue est vérifiée par `notif-modeles`, PASS au run 113.
- **Réglages** du tableau 14.2. **Règle d'envoi** : `lib/sms/sms-guard.ts:104-115`.

**Contradiction du contrat 11.3, tranchée par le code.** Le contrat dit dans la même section que ces SMS sont « hors plafond global » et qu'il faut les ajouter « à la part non OTP de `SMS_GLOBAL_DAILY_CAP` ». Les deux ne peuvent pas être vrais. Le code tranche : `lib/sms/sms-guard.ts:105` n'applique la règle `sms_global` que si `ctx.family !== 'ESSENTIAL'`, et les deux types sont ESSENTIAL au registre. **`INVITATION_RECEIVED` et `PHONE_CHANGED` sont hors `SMS_GLOBAL_DAILY_CAP`**, part non OTP comprise. `docs/deploiement-projet-neuf.md` §5.5 documente ce comportement réel. `OTP_PHONE_CHANGE` est un code OTP : il compte dans le plafond entier.

**Limite de preuve.** La règle ESSENTIAL est prouvée au lot 7 sur `PASSWORD_CHANGED` et `PURCHASE_CONFIRMED` (`sms-plafond-optionnel`, PASS au run 113). **Aucun test du lot 9 ne joue `INVITATION_RECEIVED` contre le plafond global** : c'est la lecture du code et le registre, pas une exécution.

**Types qui envoient un SMS** (relevé du registre attendu de `notif-outbox`, script) :

| Famille | Types | Plafond journalier |
|---|---|---|
| `ESSENTIAL`, par la boîte d'envoi (26) | PURCHASE_CONFIRMED, FREE_TICKETS_CONFIRMED, COUNTER_RECEIPT, INVITATION_RECEIVED, TRANSFER_OFFERED, TRANSFER_CANCELLED, EVENT_CANCELLED, REFUND_PAID, PASSWORD_CHANGED, PHONE_CHANGED, EVENT_VALIDATED, EVENT_REJECTED, EVENT_SUSPENDED, EVENT_REACTIVATED, SHIFT_DISCREPANCY, WITHDRAWAL_PAID, WITHDRAWAL_REJECTED, WITHDRAWAL_UNCERTAIN, PARTNER_VALIDATED, PARTNER_REJECTED, PARTNER_SUSPENDED, PARTNER_REACTIVATED, TRIAL_STARTED, CONTROLLER_ASSIGNED, CONTROLLER_UNASSIGNED, CONTROLLER_ACTIVATED | **aucun plafond global** : quotas par destinataire et, s'il y a un compte déclencheur, par compte |
| `ESSENTIAL`, envoi synchrone (7) | OTP_LOGIN, OTP_REGISTER, OTP_PASSWORD_RESET, OTP_WITHDRAWAL, OTP_PHONE_CHANGE, OTP_AUTH_HOOK, CONTROLLER_INVITE | OTP : compteurs propres et réserve de 30 % ; `CONTROLLER_INVITE` : part non OTP de la garde |
| `OPTIONAL` (7) | EVENT_CHANGED, REMINDER_J1, REMINDER_H3, FIRST_TICKET_SOLD, CATEGORY_SOLD_OUT, EVENT_SOLD_OUT, CONTROLLER_REMINDER | budget de 700 par jour, puis part non OTP de la garde |

```text
# tests/parcours/notif-outbox.test.ts, tableau attendu du registre, comptage par script
lignes du registre attendu : 73
ESSENTIAL avec SMS, boîte d'envoi : 26 (lot 7 : 24)
synchrones : 7 (lot 7 : 6)
OPTIONAL avec SMS : 7 (lot 7 : 7)
```

**Règles**, prouvées par les tests cités ou lues dans le code :
- **Invitation :** 1 SMS `INVITATION_RECEIVED` par numéro et par envoi, quel que soit le nombre de billets (`M/20261108000002:478-482`). Pas de compte déclencheur (AR15, sans `actor_id` : `dispatcher.ts:291` n'applique pas `SMS_PER_ACCOUNT_DAY`), mais `SMS_PER_PHONE_DAY` (30) et les quotas `INVITATION_PER_*` s'appliquent. Non retiré si l'invitation est annulée après coup (L11).
- **Invitation annulée :** 0 SMS (consigne 9.0, `invitations-annulation`).
- **Invité réclamant son billet :** pas de `TRANSFER_CLAIMED_SENDER` (expéditeur absent), pas de SMS de plus.
- **Rappels après réclamation :** une invitation est un billet gratuit pour les rappels (`M/20261105000002:654,688`). Avec `notif.free_ticket_reminder_sms = NEVER` (défaut), **aucun SMS J-1 ni H-3**. Porteur d'une invitation et d'un billet payant du même événement : SMS comme un payant. Le texte du lot 7 s'applique.
- **Invitation en attente :** billet sans porteur, aucun rappel (`t.user_id IS NOT NULL`, `M/20261105000002:643`).
- **Changement de numéro :** 1 `OTP_PHONE_CHANGE` au nouveau numéro par code demandé (`category: 'OTP'`, compteurs OTP par numéro et par IP, quota de 5 par compte et par jour) ; à la réussite, 1 `PHONE_CHANGED` à l'ancien numéro, sans `user_id` ni `actor_id` (`M/20261108000004:250-256`), soumis à `SMS_PER_PHONE_DAY`. Ancien numéro absent ou hors format : pas de SMS, `sms_queued: false` à l'audit (L30).

| Cas | SMS | Coût à 5 F HT le SMS | Coût à 10 F HT le SMS |
|---|---|---|---|
| `INVITATION_RECEIVED`, un numéro, 1 à 4 billets | 1 | 5 F | 10 F |
| Envoi plein, 10 numéros (limite d'un envoi) | 10 | 50 F | 100 F |
| Plafond du quota, par événement et par heure | 50 | 250 F | 500 F |
| Plafond du quota, par numéro et par jour | 3 | 15 F | 30 F |
| Changement de numéro abouti : `OTP_PHONE_CHANGE` au nouveau + `PHONE_CHANGED` à l'ancien | 2 | 10 F | 20 F |
| Changement de numéro, pire cas par compte et par jour : 5 codes demandés, dont 1 abouti | 6 | 30 F | 60 F |
| Annulation d'une invitation | 0 | 0 F | 0 F |

**Borne d'un événement, calcul de ma part, pas un test.** Aucun plafond journalier global ne s'applique à `INVITATION_RECEIVED` : la borne est de 50 numéros par heure et par événement, soit 1 200 SMS en 24 h pour un événement au stock suffisant, 6 000 F à 5 F, 12 000 F à 10 F. Plus bas, la consommation réelle dépend du stock et de la limite de 3 par numéro et par jour.

**Taille.** `INVITATION_RECEIVED` et `PHONE_CHANGED` tiennent en un segment GSM-7, vérifié sur le texte produit par les suites `invitations` (`septets <= 160`, `:532`) et `compte-numero`. Le pire cas de 158 septets vient du message de `68a8614` ; je ne l'ai pas recalculé. La facturation par segment de MTarget reste à confirmer (point ouvert du lot 6).

Le reste des coûts par billet (achat, gratuit, guichet, plafond optionnel) est inchangé : `docs/lot7-rapport.md`, section 12.

```text
tests/parcours/compte-numero.test.ts                   PASS     14.3s     0     .test-logs/tests__parcours__compte-numero.test.ts.log
tests/parcours/invitations.test.ts                     PASS     8.2s      0     .test-logs/tests__parcours__invitations.test.ts.log
tests/parcours/notif-modeles.test.ts                   PASS     1.4s      0     .test-logs/tests__parcours__notif-modeles.test.ts.log
tests/parcours/notif-outbox.test.ts                    PASS     2.5s      0     .test-logs/tests__parcours__notif-outbox.test.ts.log
tests/parcours/sms-plafond-optionnel.test.ts           PASS     14.5s     0     .test-logs/tests__parcours__sms-plafond-optionnel.test.ts.log
# tests__parcours__notif-modeles.test.ts
ok 1 - 6.3 Catalogue : registre SQL = catalogue TS = table G2 (contrat C1, G1, G2)
# tests__parcours__invitations.test.ts
ok 2 - texte exact au singulier et au pluriel, 1 segment GSM-7, lien /tickets, aucun claim, token ni code à 6 chiffres
# tests__parcours__compte-numero.test.ts
ok 1 - une ligne vers l’ancien numéro, sans compte ni acteur ; texte exact, un segment GSM-7 ; rien au nouveau numéro
# tests__parcours__sms-plafond-optionnel.test.ts
ok 2 - puis une confirmation d’achat (ESSENTIAL) au même jour simulé : SENT, hors budget
ok 1 - SMS_GLOBAL_DAILY_CAP = 1 : PASSWORD_CHANGED (ESSENTIAL) SENT au texte exact ; REMINDER_J1 (OPTIONAL) SKIPPED SMS_DAILY_CAP, sans relance
```

---

---

## 15. Migrations à appliquer sur event-village-dev, dans l'ordre

**Rien n'a été appliqué.** Je n'ai rien exécuté contre ce projet. D'après `docs/essai-local.md`, section 3, les migrations jusqu'au lot 8 y sont déjà appliquées (`20261106000001` à `…06`). À appliquer ensuite, cinq fichiers, dans cet ordre, celui des noms, que suit `db push` :

| Ordre | Fichier | Tâche | Contenu |
|---|---|---|---|
| 1 | `20261108000001_lot9_securite.sql` | 9.3 | Ordre des verrous : `ticket_refund_request` (PO3), `event_update`, `ticket_category_guard` (PO4). Trigger A27 sur l'UPDATE. `admin_permissions_set`, `partner_register_finalize` (A33) |
| 2 | `20261108000002_lot9_invitations.sql` | 9.0 | Billet sans porteur et transfert sans expéditeur admis, `INVITATION_RECEIVED`, RPC d'invitation, trigger d'échéance, recopies de `tickets_sale_decision_set`, `ticket_transfer_accept`, `ticket_transfers_incoming`, `participants_export` |
| 3 | `20261108000003_lot9_decouverte.sql` | 9.1 | `users.city`, index `idx_tickets_created_at` (sans `CONCURRENTLY`, les écritures de billets attendent la construction), `events_popular` |
| 4 | `20261108000004_lot9_compte.sql` | 9.2 | Objet OTP `PHONE_CHANGE`, `PHONE_CHANGED`, `OTP_PHONE_CHANGE`, **bucket `avatars`**, `REVOKE` des colonnes de profil, RPC du compte, recopie de `notification_sync_log` |
| 5 | `20261108000005_lot9_nettoyage.sql` | 9.4 | `ticket_scan` et `ticket_manual_lookup` sans `cash_required`, `DROP` de `ticket_cash_checkin` |

```text
$ wc -l supabase/migrations/20261108*
   703 supabase/migrations/20261108000001_lot9_securite.sql
   686 supabase/migrations/20261108000002_lot9_invitations.sql
    48 supabase/migrations/20261108000003_lot9_decouverte.sql
   362 supabase/migrations/20261108000004_lot9_compte.sql
   314 supabase/migrations/20261108000005_lot9_nettoyage.sql
  2113 total

$ sha256sum supabase/migrations/20261108*
b04c259bbbf5c0f2881b8b97980828d2881ff785ed032e82d998afe121730683 *supabase/migrations/20261108000001_lot9_securite.sql
274fda972bfcc180a05db5da5b058d3e73f8c0f8ee4eecc876c15a845438241e *supabase/migrations/20261108000002_lot9_invitations.sql
1005cd14ab64385088d807201def226ee8d0b805d3c08237c6a8db6eb23d2a27 *supabase/migrations/20261108000003_lot9_decouverte.sql
378bf2594b5f095d0ceb261599fb9525cb6a3454de05497b22ab84fb4e5a677e *supabase/migrations/20261108000004_lot9_compte.sql
f842a5208f52bda7ed7910d0669f1f668a8979d8947f6141fb4c05535950c353 *supabase/migrations/20261108000005_lot9_nettoyage.sql

$ grep -cE '^\s*(BEGIN|COMMIT)\s*;' supabase/migrations/20261108*
supabase/migrations/20261108000001_lot9_securite.sql:0
supabase/migrations/20261108000002_lot9_invitations.sql:0
supabase/migrations/20261108000003_lot9_decouverte.sql:0
supabase/migrations/20261108000004_lot9_compte.sql:0
supabase/migrations/20261108000005_lot9_nettoyage.sql:0
```

**Procédure** : `docs/deploiement-projet-neuf.md`, section 3 quater, et, pour ce projet, `docs/essai-local.md`, section 3, qui la suit pas à pas. Dans les commandes, remplacez `VOTRE_REFERENCE` par la référence du projet, sans rien ajouter autour : ni chevrons, ni guillemets. PowerShell refuse `<` et `>`.

**Avant.**

1. Relier le projet et voir ce qui serait appliqué :

   ```powershell
   npx supabase@2.122.0 link --project-ref VOTRE_REFERENCE
   npx supabase@2.122.0 migration list --linked
   npx supabase@2.122.0 db push --linked --dry-run
   ```

   `migration list` : `20261106000006` présent des deux côtés, les cinq `20261108…` en local seulement. `--dry-run` : exactement les cinq fichiers ci-dessus. **Autre chose : s'arrêter**, sans `--include-all` ni `supabase migration repair`.

2. **Contrôle A27, en lecture seule, dans SQL Editor, avant `db push`.** Une boucle de parrainage déjà présente ne ferait pas échouer la migration, mais toute écriture d'une relation de cette chaîne resterait bloquée jusqu'au délai maximal de la requête.

   ```sql
   -- attendu : aucune ligne ; une ligne ou plus : s'arrêter, ne rien corriger à la main
   with recursive chaine as (
     select r.referred_id as depart, r.sponsor_id as ancetre,
            array[r.referred_id, r.sponsor_id] as chemin, false as boucle
       from public.referral_relationships r
     union all
     select c.depart, r.sponsor_id, c.chemin || r.sponsor_id, r.sponsor_id = any(c.chemin)
       from chaine c
       join public.referral_relationships r on r.referred_id = c.ancetre
      where not c.boucle
   )
   select depart, chemin from chaine where boucle;
   ```

**Appliquer.**

```powershell
npx supabase@2.122.0 db push --linked
```

**Après, dans SQL Editor, une requête à la fois :**

```sql
-- attendu : 5 lignes, de 20261108000001 à 20261108000005
select version from supabase_migrations.schema_migrations where version like '20261108%' order by version;

-- attendu : 1 ligne, avatars, public = true, 2097152, {image/webp} ; ne créez pas ce bucket à la main
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars';

-- attendu : 0 ; aucune politique sur ce bucket
select count(*) as politiques_avatars from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and (coalesce(qual, '') ilike '%avatars%' or coalesce(with_check, '') ilike '%avatars%');

-- attendu : 3 lignes, toutes ESSENTIAL
select type, family from public.notification_types
 where type in ('INVITATION_RECEIVED', 'PHONE_CHANGED', 'OTP_PHONE_CHANGE') order by type;

-- attendu : la définition contient BEFORE INSERT OR UPDATE OF sponsor_id, referred_id
select pg_get_triggerdef(oid) from pg_trigger where tgname = 'trg_check_circular_referral';

-- attendu : NULL ; la fonction est retirée
select to_regprocedure('public.ticket_cash_checkin(jsonb)') as fonction_retiree;

-- attendu : false, false, false
select has_column_privilege('authenticated', 'public.users', 'first_name', 'UPDATE') as prenom,
       has_column_privilege('authenticated', 'public.users', 'last_name', 'UPDATE') as nom,
       has_column_privilege('authenticated', 'public.users', 'avatar_url', 'UPDATE') as photo;
```

Puis `supabase/hotfix/2026-10-31-lot1a/03-verification.sql` : tout `OK`.

**À savoir** :
- Le code du lot 9 ne fonctionne pas sans ces migrations, et **event-village-dev ne doit plus tourner qu'avec lui ou plus récent** : la route `PUT /api/controller/scan` du lot 8 appelle `ticket_cash_checkin`, que la migration 5 retire.
- Retirer `CASH_COLLECT_PER_SCANNER_MIN` de l'hébergeur s'il y est.
- **Aucune migration n'a été jouée sur un projet hébergé.** Les écritures de `account_phone_finalize` sur `auth.sessions` et `auth.refresh_tokens` ne sont exercées qu'en CI, sur une instance locale. L'essai 8.15 de `docs/essai-local.md` est le seul contrôle sur un projet hébergé.
- **Migrations gelées** : `20261103…`, `20261105…` et `20261106…` (`migrations-gelees`, 21 empreintes SHA-256). Les cinq nouvelles sont rejouées dans une transaction annulée par `migration-lot9-rejouable`.

```text
tests/schema/migration-lot9-rejouable.test.ts          PASS     1.8s      0     .test-logs/tests__schema__migration-lot9-rejouable.test.ts.log
tests/schema/migrations-gelees.test.ts                 PASS     337ms     0     .test-logs/tests__schema__migrations-gelees.test.ts.log
tests__schema__migration-lot9-rejouable.test.ts : tests 6 pass 6 fail 0 ; failing tests : 0
tests__schema__migrations-gelees.test.ts : tests 24 pass 24 fail 0 ; failing tests : 0
ok 1 - les migrations 20261108… du dépôt sont exactement les cinq du contrat, dans cet ordre
ok 2 - 20261108000001_lot9_securite.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
ok 3 - 20261108000002_lot9_invitations.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
ok 4 - 20261108000003_lot9_decouverte.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
ok 5 - 20261108000004_lot9_compte.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
ok 6 - 20261108000005_lot9_nettoyage.sql : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur
ok 1 - Lot 9 — migrations 20261108000001 à …05 rejouables (transaction annulée)
```

---

---

## 16. Comment tester

Tout est dans **`docs/essai-local.md`**, écrit pour Windows, 8 Go, sans Docker, contre le projet **event-village-dev**. Il se suit dans l'ordre. Mêmes modes qu'au lot 8 : **A, simulé** (`/dev/paiements`, `npm run seed:dev`, `npm run cron:local`) et **B, sur un build** (faux SamirPay, `http://127.0.0.1:4010/`).

**À lire avant tout** : sans la ligne `EV_INTEGRATIONS=fake` dans `.env.local`, `npm run dev` et `npm run cron:local` envoient de vrais SMS et parlent au vrai SamirPay.

Ce que le lot 9 ajoute au guide :
- **Section 3** : les cinq migrations du lot 9 (section 15 ci-dessus).
- **8.8 bis Invitations** (avant l'annulation de 8.10) : trois invités, compte vérifié, compte non vérifié, numéro sans compte ; annulation ; export.
- **8.12 Mes paiements**, **8.13 Photo de profil**, **8.14 Ville et Populaires**.
- **8.15 Changement de numéro**, à faire en dernier : **ajoutée hors liste par D1**, seul essai qui vérifie la révocation des autres sessions sur un projet hébergé.

Trois choses à savoir avant de les jouer (D1, F) :
- **Comptes de `seed:dev`** : leur `phone_verified_at` est NULL. Inviter `client2` passe par l'attente et le bandeau « Confirmer mon numéro », pas par l'attribution directe. L'attribution directe s'essaie avec le compte créé en 8.6.
- **Mes paiements en mode d'essai** ne montre que les paiements simulés. Une base issue de `seed-demo`, dont les paiements ne sont pas simulés, y afficherait une liste vide. C'est le comportement voulu par le contrat.
- **Historique des invitations** : pas de ligne de démonstration.

**Cahier de recette manuelle** : `docs/recette-billetterie.md`, section 7, 69 essais. Section O, nouvelle : essais 62 à 69, qui renvoient aux sections 8.8 bis à 8.15. Les essais 41, 57 et 61 sont réécrits, A39, A38 et l'outil d'invitations y étant décrits comme manquants.

**Ce qui est prouvé et ce qui ne l'est pas.** Les refus du mode d'essai sont prouvés en CI (extrait ci-dessous). **Ni le guide ni le cahier n'ont été déroulés par personne contre event-village-dev** : aucun agent n'exécute contre un projet distant, et le poste n'a pas de base locale. Commandes `--linked` et `--dry-run` relues sur `--help` de la CLI 2.122.0 par D1. Requête anti-boucle et contrôles après migration sondés par D1 sur un PostgreSQL 14 jetable, sans Storage ni GoTrue : pas une preuve.

```text
tests/parcours/essai-middleware.test.ts                PASS     860ms     0     .test-logs/tests__parcours__essai-middleware.test.ts.log
tests/parcours/essai-seed-dev.test.ts                  PASS     2.8s      0     .test-logs/tests__parcours__essai-seed-dev.test.ts.log
tests/parcours/essai-simule.test.ts                    PASS     8.6s      0     .test-logs/tests__parcours__essai-simule.test.ts.log
tests/schema/essai-cron-local.test.ts                  PASS     1.3s      0     .test-logs/tests__schema__essai-cron-local.test.ts.log
tests/schema/essai-env-local.test.ts                   PASS     982ms     0     .test-logs/tests__schema__essai-env-local.test.ts.log
tests/schema/essai-faux-samirpay.test.ts               PASS     1.8s      0     .test-logs/tests__schema__essai-faux-samirpay.test.ts.log
tests/schema/essai-integrations.test.ts                PASS     7.6s      0     .test-logs/tests__schema__essai-integrations.test.ts.log
tests/schema/essai-route-dev.test.ts                   PASS     368ms     0     .test-logs/tests__schema__essai-route-dev.test.ts.log
tests/schema/essai-seed-gardes.test.ts                 PASS     994ms     0     .test-logs/tests__schema__essai-seed-gardes.test.ts.log
[FAKE-PROD] ═══ production : next start -p 3199, EV_INTEGRATIONS=fake ═══
[FAKE-PROD] production : OK GET /login répond (témoin) HTTP 200
[FAKE-PROD] production : OK POST /api/auth/register/start, numéro neuf, refusé HTTP 500 {"error":"Inscription momentanément impossible. Réessayez dans un instant.","code":"REGISTER_START_FAILED"}
[FAKE-PROD] production : OK aucun SMS au faux MTarget 0 SMS
[FAKE-PROD] production : OK GET /dev/paiements HTTP 404 
[FAKE-PROD] production : OK POST /api/dev/samirpay/validate HTTP 404 
[FAKE-PROD] production : conforme
[FAKE-PROD] ═══ development : next start -p 3199, EV_INTEGRATIONS=fake ═══
[FAKE-PROD] development : OK GET /login répond (témoin) HTTP 200
[FAKE-PROD] development : OK POST /api/auth/register/start, numéro neuf, refusé HTTP 500 {"error":"Inscription momentanément impossible. Réessayez dans un instant.","code":"REGISTER_START_FAILED"}
[FAKE-PROD] development : OK aucun SMS au faux MTarget 0 SMS
[FAKE-PROD] development : OK GET /dev/paiements HTTP 404 
[FAKE-PROD] development : OK POST /api/dev/samirpay/validate HTTP 404 
[FAKE-PROD] development : conforme
[FAKE-PROD] résultat : OK, simulé impossible sur le build, dans les deux lancements
[e2e] phase fake-prod : OK en 2s
```

---

---

## 17. Décisions prises

La consigne demande, pour toute décision non tranchée et non bloquante, l'option la plus prudente, appliquée et listée ici. Aucune question n'a été bloquante (L1). Les décisions sont recopiées du contrat (`lot9-design.md`), une ligne chacune ; une note en italique dit ce que le lot a réellement fait quand cela diffère ou mérite d'être su. Dans ces lignes, « section x » renvoie au contrat, pas au présent rapport ; `M/` est `supabase/migrations/`, `S/` le dossier de travail, `D-inv`, `D-cpt`, `D-sec`, `D-net`, `D-out` les rapports de découverte.

### 17.1 Décisions ★ (à lire par l'utilisateur)

- **L3** ★ Invitation en attente : billet `user_id` NULL, transfert `from_user_id` NULL (D-inv 1.2). Le partenaire ne détient jamais le billet : pas d'annulation par la route de transfert, pas de notification d'expiration.
- **L6** ★ Le billet va directement au compte si `ticket_transfer_identity(numéro, compte) = 'MATCH'` à l'envoi (ACTIF, vérifié) ; sinon attente, le compte se résout à la réclamation (AR15). Compte au numéro non vérifié : attente, bandeau existant.
- **L9** ★ Ordre des verrous : création `events FOR SHARE → catégorie FOR UPDATE → INSERT` ; annulation `events FOR SHARE → catégorie FOR NO KEY UPDATE → transferts → billet`.
- **L20** ★ Populaires : billets VALIDE et UTILISE créés depuis 168 h, tous canaux sauf INVITATION (`FREE` et `COUNTER` comptés, définition « vendus » du pilotage), PUBLIE et non terminés. Global, pas par ville. `sold` jamais exposé. Départage : ventes, début le plus proche, id.
- **L28** ★ Ordre API puis RPC ; compensation vers la valeur **relue dans `public.users`** à l'instant de la compensation ; si elle échoue : journal, ligne `ACCOUNT_AUTH_DESYNC`, 500, réparation par un nouvel essai vers le même numéro (section 5.3).
- **L32** ★ `REVOKE UPDATE (first_name, last_name, avatar_url) ON public.users FROM authenticated`, écriture par routes seules ; r7 renforcé et signalé. Aucune écriture client de `users` dans `app/`, `components/`, `hooks/` (PROUVÉ grep).
- **L34** ★ Bucket `avatars` public, `file_size_limit` 2 Mo, `image/webp`, **aucune politique** : la route est le seul écrivain ; signalé (AR3).
- **L46** ★ Fixture du pilotage : l'encaissement passé est reproduit en SQL (historique), aucune assertion de pilotage modifiée (X5).
- **L51** ★ A21 : 6 suites supprimées, 8 gardées, 10 cas réels portés plus la matrice du vrai middleware (section 5.5). *Réalisé en deux temps : cinq suites par `f1ff53d`, `e2e-scenarios` par `3ca034a` une fois ses deux cas portés et vus verts. Ports : 10 tests dans `validations-metier`, 11 dans `r28-middleware-matrice`, 1 à la fin d'`acces-limiteurs`, 2 pour `e2e-scenarios` (`paiement-webhook:156`, `partenaire-lot7:925`). Voir section 1.*

### 17.2 Décisions du contrat, L1 à L56

*Invitations (9.0)*

- **L1** Aucune question bloquante : chaque point ouvert a reçu l'option la plus prudente.
- **L2** RPC `ticket_invitation_create`, `ticket_invitation_cancel`, `ticket_invitations_list` ; la RPC pose elle-même le transfert (`ticket_transfer_initiate` exige un billet possédé).
- **L3** ★ voir 17.1.
- **L4** Une « invitation » est une ligne numéro d'un envoi (seule lecture compatible 3 par numéro / 4 billets par numéro). Quotas : événement × nombre de numéros, numéro × 1.
- **L5** Catégorie inactive et événement passé refusés (« toute catégorie » s'entend des canaux).
- **L6** ★ voir 17.1.
- **L7** Réponse et liste identiques avec ou sans compte : aucune énumération. Jamais d'état « en attente de réclamation » montré au partenaire.
- **L8** `expires_at` = fin de l'événement, recalé par trigger au report de date.
- **L9** ★ voir 17.1.
- **L10** SMS seul (ni in-app ni push), `link: null`, lien `/tickets` dans le texte, pas d'`actor_id` (AR15).
- **L11** Annulation billet par billet, sans retrait du SMS déjà en file (D-inv risque 2).
- **L12** Pas de clé d'idempotence, RPC appelée une seule fois, bouton désactivé (D-inv risque 3) ; double envoi borné et annulable.
- **L13** Export : colonne « Canal » et nom « Invitation en attente » ; test adapté et signalé (T9).
- **L14** Liste des invitations lisible par `pilotage_access` (tout admin), écriture réservée à `events.write` (consigne).
- **L15** `has_admin_permission` non utilisée : elle lit le rôle legacy `users.role` (PROUVÉ `M/0007_superadmin_complete.sql:79`). Droit relu sur `user_roles` et `admin_permissions`.
- **L16** Scan d'une invitation en attente : aucune garde ajoutée à `ticket_scan` (numéro et QR jamais exposés tant qu'elle n'est pas réclamée, test à l'appui).
- **L17** Message d'expiration « 48 h » inexact pour une invitation expirée : non traité, point ouvert (rare, fin d'événement). *Point ouvert 18.1.*

*Découverte (9.1)*

- **L18** `q` cherche aussi la ville (sinon régression), catégorie côté serveur, tri par prix laissé au navigateur (pas un filtre).
- **L19** `cities` ajouté à la réponse du catalogue, calculé avant filtres.
- **L20** ★ voir 17.1.
- **L21** Cache : mémoire du module, 60 s strictes, panne non gardée, `no-store` vers l'extérieur. Événement suspendu visible 60 s au plus, assumé (AR12).
- **L22** Ville stockée en capitales ; `PATCH /api/profile/city` route distincte ; `null` efface. Visiteur : `localStorage` clé `ev-city`, jamais écrit par un connecté, pas de synchronisation silencieuse. Pas de géolocalisation.
- **L23** Liste des villes tirée du catalogue, pas de liste fixe. Pas de repli d'accents, pas de budget `/explore` (non demandés).

*Compte (9.2)*

- **L24** Email : refus `EMAIL_TAKEN` par `email_exists` et par l'unique de `public.users` ; domaine `@eventvillage.sn` refusé en Zod ; email vidé : email technique du numéro rétabli, jamais NULL. *`email_exists` n'est pas garanti par GoTrue (AM1) : le refus vient d'`account_identity_taken`, avant l'API et après toute erreur de l'API.*
- **L25** Changement d'email sans code ni révocation (consigne muette).
- **L26** Changement de numéro : OTP au nouveau numéro, objet `PHONE_CHANGE`, hors `ACCOUNT_OTP_PURPOSES` (n'ouvre aucune session).
- **L27** Numéro : si l'email d'authentification est technique (`^[0-9]+@eventvillage\.sn$`), il est réécrit vers le nouveau numéro par la même API, sinon `resolve-phone` casse la connexion (D-cpt C3).
- **L28** ★ voir 17.1.
- **L29** `phone_verified_at` remis à `now()` au changement ; billets inchangés ; transfert vers l'ancien numéro non reciblé.
- **L30** PHONE_CHANGED mis en file dans la RPC, vers l'ancien numéro seul, sans `user_id`. Ancien numéro absent ou hors format : pas de SMS, `sms_queued: false` à l'audit.
- **L31** Quotas `PHONE_CHANGE_PER_ACCOUNT_DAY` (5) et `AVATAR_UPLOADS_PER_ACCOUNT_HOUR` (20), facultatifs.
- **L32** ★ voir 17.1.
- **L33** Mes paiements : `amount > 0`, simulés masqués hors simulation, totaux sur tout le filtre, `total_paid` = SUCCESS, PARTIAL, REFUNDED, REFUND_PENDING. Paiements hors billetterie listés sous un libellé de cible. 20 par page, décalage. *En mode d'essai, seuls les paiements simulés sont listés : une base `seed-demo` y paraîtrait vide (F).*
- **L34** ★ voir 17.1.
- **L35** `sniffImage` extrait dans `lib/images/sniff.ts`, sans changement de comportement de `partner/upload`.
- **L36** Avatar `<img>` : `next/image` entrerait dans le layout des cinq routes budgétées.

*Sécurité (9.3)*

- **L37** A24 : `requireSuperadmin` ; lien masqué et état « Réservé au superadmin » pour un ADMIN (AR10), sans `ErrorState` (`admin-audit.test.ts:251` exige `onRetry`).
- **L38** A25 : valeur hors bornes = 50, plafond 100. A38 : `actor_name`, `actor_role` aplatis ; colonne Rôle = rôle au moment de l'action.
- **L39** A33 : `admin_permissions_set` et `partner_register_finalize` ; compensation `deleteUser` côté route. `logAudit` muet : point ouvert.
- **L40** A34 : `generateLink` et `updateUserById` de verify-otp journalisés, réponse inchangée.
- **L41** A32, A26 : absence = `PublicError(…, 404)`, panne = `Error`, 500 `*_UNAVAILABLE`, journal ; uuid invalide = 404 ; produit réellement absent passe de 500 à 404. `resolvePartnerId` garde son statut pour ses autres appelants.
- **L42** A27 : trigger seul, fonction non recopiée (`search_path` posé par `M/20261031000001:25` conservé).
- **L43** A39 : aussi `:921` « DOCUMENT OFFICIEL… » (non cité par la consigne, signalé). A40 : webhook non 2xx = `ok:false`, 502, `FAKE_SERVICE_ERROR`. *`:921` « DOCUMENT OFFICIEL… » retiré, non cité par la consigne.*

*Nettoyage (9.4)*

- **L44** A16 : `ticket_scan` et `ticket_manual_lookup` recopiées sans `cash_required`, `ticket_cash_checkin` supprimée, PUT du scan retiré. Le billet impayé tombe sur `payment_required` (filet existant).
- **L45** Conservés, au plus prudent : filtres `cash_required` du pilotage et des stats (historique), `CHECK` de `ticket_scans.result`, branche `event_cancel`, `tickets.order_id`, `amount_due`, `RAW_ENUM_VALUES` e2e (D-net 1.3).
- **L46** ★ voir 17.1.
- **L47** Seed : deux encaissements remplacés par une vente au guichet de 2 ; un billet impayé gardé. *Voir T28.*
- **L48** `createCashOrderTickets` garde son nom (une dizaine d'appelants), commentaire corrigé.
- **L49** PO10 : `lib/payments/financial-calculator.service.ts` supprimé entier (plus aucun appelant), avec les deux modaux et l'import de `hall.service.ts:3`. *Deux commits : `fix(9.4-PO10)` (`f1b4ed6`) pour le service, `fix(9.4-PO10e)` (`2423f39`) pour les deux modaux, le contrat les donnant à E4.*
- **L50** Captures : masque en place par `style`, jamais par l'option `mask` ; QR d'entrée masqué globalement. *Masques conformes à la relecture du run 111, par agents (section 3).*
- **L51** ★ voir 17.1.
- **L52** Relecture des captures par agents, présentée comme telle ; liste à part pour un humain.

*Outillage*

- **L53** Délai CI 60 min, aucun relèvement (D-out 5). Aucune hausse de budget JS ; `dynamic()` de `HomeDiscovery` si `/` dépasse, dit au rapport. *Délai CI 60 min gardé ; `verify.yml` inchangé. `next/dynamic` employé deux fois sur `/` : `HomeDiscovery` (`d992ef2`) et `AccessNotice` (`a525015`, hors contrat).*
- **L54** Matrice : citations recalées par commit pendant le lot, régénérée une fois sur le run « après ». 8 essais ajoutés, essai 61 réécrit (`NOMBRE_ESSAIS` 69). *Essais 41, 57 et 61 réécrits, plus les 8 essais 62 à 69 (D2).*
- **L55** Acte 9 sans assertion de carte billet (§20 reste partiel) : hors consigne.
- **L56** Aucun réglage SUPERADMIN nouveau. *Vérifié : section 14.2.*

### 17.3 Arbitrages de l'orchestrateur, AR1 à AR16

- **AR1** Pas de blocage des retraits après un changement de numéro. D8 de D-cpt écartée, point ouvert, aucun code.
- **AR2** `auth.users` n'est écrit que par `auth.admin.updateUserById` (`phone`, `email`, `phone_confirm`, `email_confirm`). Ordre : OTP vérifié, API admin (erreurs `phone_exists`, `email_exists` = refus propre), RPC de finalisation (`public.users`, autres sessions, PHONE_CHANGED, audit). RPC en échec : compensation par l'API, journal, 500 (section 5.3). Révocation « sauf la session courante » dans la RPC, `session_id` du JWT validé, 401 s'il est absent.
- **AR3** Bucket `avatars` : la route est seule à écrire (service_role), sharp et le retrait EXIF ne sont pas contournables. Écart à la lettre de la consigne, à signaler au rapport. Tests : ni jeton anon ni authenticated n'écrit ou ne supprime dans le bucket ; A ne peut rien chez B par la route. `avatar_url` n'est plus écrivable en REST (r7 renforcé, à signaler). Chemin de l'ancienne photo vérifié par motif avec l'id de session avant suppression. Avatar dans AppLayout : `<img>`.
- **AR4** PO3 : catégorie `FOR NO KEY UPDATE` avant le billet, jamais `FOR UPDATE`. PO4 : `events` en `FOR NO KEY UPDATE` dans `event_update` et `ticket_category_guard`. Tableau des verrous rectifié (section 3.3).
- **AR5** Une seule recopie de `ticket_scan`, dans M5. Une seule définition finale par fonction (section 3.2).
- **AR6** Invariants du lot dans `tests/helpers/lot9-invariants.ts`, enveloppant `assertRecetteInvariants`. `recette-invariants.ts` inchangé. `seed-demo` et `invariants-run` ne passent au helper du lot que dans le commit de correctif.
- **AR7** Gel SHA-256 : `tests/schema/migrations-gelees.test.ts`, nouvelle suite sans base, 20261103…, 20261105…, 20261106….
- **AR8** Acte 9 placé avant l'acte 8 ; citations de la matrice recalées dans le même commit.
- **AR9** CI : délai de 60 min gardé. Mode `[recette-seule]` réécrit à la main pour la mise au point, retiré avant le run « après », jamais une preuve.
- **AR10** A24 : liens vers `/admin/audit` masqués pour un ADMIN qui n'est pas SUPERADMIN, sans casser `notif-interface.test.ts:956`.
- **AR11** Tout échec passe par `apiFailure` et `PublicError` ; français ; aucun statut, enum ni identifiant technique à l'écran.
- **AR12** Populaires : RPC `events_popular`, cache mémoire du module 60 s, panne jamais mise en cache, `no-store` vers l'extérieur, route publique prouvée par `callMiddleware`.
- **AR13** `PARTIAL` affiché sur `/paiement/[id]`, rien de plus sur cette page.
- **AR14** Partenaire EN_ATTENTE dans `/partner/*` : point ouvert, jamais figé par un test.
- **AR15** Un compte existe pour un numéro seulement s'il est vérifié (`phone_verified_at`) ; résolu à l'envoi pour l'attribution directe, à la réclamation pour une attente, jamais autrement. Le SMS d'invitation ne renseigne pas `actor_id`. Quotas réservés dans la RPC, après droits et stock.
- **AR16** Un seul commit par tâche, préfixes `test(9.x)` et `fix(9.x)` ; rouges committés avant tout correctif ; les suites annoncées vertes à l'écriture le sont par écrit.

### 17.4 Amendements après le run « avant », AM1 à AM8

- **AM1** SUPPOSÉ infirmé par le run 110 : `auth.admin.updateUserById` vers un email ou un numéro déjà pris rend `code=undefined, status=500, message=Error updating user`, pas `email_exists` ni `phone_exists`. Remède :
  - nouvelle RPC de M4 `account_identity_taken(p_user_id uuid, p_email text, p_phone text) RETURNS jsonb` (`{ email_taken, phone_taken }`), STABLE, service_role, lecture de `auth.users` et `public.users` sur tout autre compte, email comparé en minuscules, numéro comparé par ses chiffres (formes `+221…` et `221…`) ;
  - appelée **avant** `updateUserById` : pris → 409 `EMAIL_TAKEN` ou `PHONE_TAKEN`, sans appel d'API ni RPC de finalisation ;
  - appelée **après** toute erreur de `updateUserById` : pris (course) → même 409, sans compensation ; sinon le 500 du contrat. Les codes `email_exists` et `phone_exists` restent acceptés s'ils arrivent, jamais supposés.
  - Tests : les deux sondes « SUPPOSÉ » de `compte-numero` et `compte-profil` deviennent le constat durable : l'appel échoue et `auth.users` reste inchangé, sans figer le code. `r3-fonctions-rpc` ajoute la RPC à `LOT9_RPCS`.
- **AM2** `session_id` est présent dans le JWT et désigne une ligne de `auth.sessions` : SUPPOSÉ confirmé au run 110.
- **AM3** Rouges du run 110 hors de la liste 10, légitimes : `acces-tracabilite` (T16, jusqu'à `fix(9.4-A16s)`), `canaux-interface` (T25 annoncé vert à tort : `is_visible` lu par `AdjustTicketQuotaModal.tsx`, jusqu'à sa suppression par E4), captures `accueil` (T26, jusqu'à E1). Les ports A21 sont verts au run 110 : la vague L est libre.
- **AM4** `sender_display` s'écrit avec l'apostrophe typographique, `L’organisateur…`, dans le SQL comme à l'écran (la contradiction 3.2 / section 7 est tranchée ainsi).
- **AM5** T28 (`tests/seed/seed-demo.ts:1214-1215`, appel de `ticket_cash_checkin`) n'a pas été fait en vague R. Il est fait avant `fix(9.4-A16s)`, commit `test(9.4-seed)` : le seed remplace cet appel comme le contrat le prévoit pour A16, sans rien retirer d'autre.
- **AM6** L'aide de la catégorie sans canal disait « L’application n’envoie pas encore d’invitations ». Devenu faux, le texte passe à : « Cette catégorie n’est vendue ni en ligne ni au guichet. Distribuez ses billets depuis l’onglet Invitations du pilotage. » (`lib/events/category-channels.ts`, S0 dans `fix(9.0s)`). Tests : `canaux-interface.test.ts:35` et `e2e/support/screens.ts`, modifiés et signalés, commit `test(9.0)[AM6]`, rouges jusqu'à `fix(9.0s)`.
- **AM7** Hypothèses de R-E2E à respecter par les écrans, sinon à signaler : valeur de l'option ville `DAKAR` ; « Près de chez vous » est un élément `section` ; le libellé de l'onglet commence par « Invitations », en `role="tab"`, ouvert par `?tab=invitations` ; le changement de numéro s'ouvre en `dialog` ; le client de démonstration a des liens `/paiement/` dans Mes paiements.
- **AM8** Les fixeurs committent par `S/commit8.sh`, un commit par tâche, sans pousser (`S/lot9-fixer-brief.md`). S4 passe après S3 : `fix(9.3-A32)` retire l'import de `hall.service.ts` avant `fix(9.4-PO10)`.

### 17.5 Contradictions entre découvertes, tranchées au plus prudent

| # | Sujet | Rapports | Tranché |
|---|---|---|---|
| X1 | Verrou catégorie à l'annulation d'invitation | D-inv 3.3 `FOR UPDATE` ; D-sec 13 NKU | `FOR NO KEY UPDATE` (L9), scan tient le billet et prend KEY SHARE sur la catégorie |
| X2 | Écriture de `auth.users` | D-cpt D1 RPC directe | AR2 : API admin ; RPC renommées `account_profile_finalize`, `account_phone_finalize` (D-out citait `account_profile_update`, `account_phone_change`) |
| X3 | Noms des quotas | D-inv `INVITATION_PER_*`, D-out `INVITATIONS_PER_*` | `INVITATION_PER_EVENT_HOUR`, `INVITATION_PER_PHONE_DAY` (patron `INVITE_PER_PHONE_DAY`, `lib/env.ts:87`) |
| X4 | Avatar | D-cpt `next/image`, D-out `<img>` | AR3 : `<img>` partout, un seul composant |
| X5 | Fixture de l'encaissement du pilotage | D-net 1.5 : vente au guichet, `entries.counter` 3→4 | **Écartée**. PROUVÉ : `pilotage-cloture-export.test.ts:162` attend le billet ESP-a au nom de b6, et `:266` trois lignes guichet ; une vente au guichet n'a pas de porteur. Fixture : reproduction SQL de ce que `ticket_cash_checkin` laissait (T24). **Aucune assertion de pilotage changée**, `entries.counter` reste 3 |
| X6 | `first_name`, `last_name` en REST | AR3 parle d'`avatar_url`, D-cpt D3 des trois colonnes | Les trois colonnes (L32 ★) : sinon Zod est contournable, contre la consigne 9.2 |
| X7 | Place des nouveaux tests | D-sec, D-dec, D-sec 7 ajoutent aux suites citées | Règle D-out : **nouveaux tests dans de nouveaux fichiers** ; un test adapté garde son nombre de lignes |
| X8 | Propriétaire de `recette-invariants.ts`, `screens.ts`, catalogue | plusieurs domaines | section 8, un propriétaire chacun |

### 17.6 Décisions prises par les agents, hors contrat

Reprises de leurs réponses, une ligne par décision.

**Tests**
- **R0** : garde de schéma élargie aux tables et colonnes lues par la requête, pour nommer un absent plutôt qu'une erreur brute ; triggers de `storage.objects` et `auth.users` non coupés, `postgres` n'en est pas propriétaire.
- **R1** : `field` contrôlé par préfixe (`phones…`) ; audit d'envoi filtré par `metadata.category_id` et `user_id` ; EN_ATTENTE ajouté aux statuts refusés.
- **R2** : transactions annulées pour l'âge des billets, ANNULE et REMBOURSE, COUNTER et statuts d'événement ; non testés : `writeLocalCity(null)`, 404 de PATCH.
- **R3** : codes OTP de `confirm` repris de `register` ; image corrompue ou trop de pixels : `UNSUPPORTED_FORMAT` ; avatar forgé vers B testé dans `compte-photo`, `anon-uniquement` interdisant ce cas dans `tests/security`.
- **R4** : statiques `AppLayout` et tableau de bord ajoutés au-delà de « statique de la page » ; `old_value` exige seulement chaque permission d'avant ; `partner_register_finalize` prouvé par la route, pas en appel direct.
- **R5** : mentions lues en texte brut, commentaires compris.
- **R-E2E** : `openScanner` écarté de l'acte 9 ; T1 traité par blocs insérés, sans import ajouté.
- **Agent A21** : `e2e-scenarios` gardée jusqu'à vue verte de ses ports. **tests-fin** : cas caméra retiré, non réécrit ; port du cas 15 limité à la présence d'un mot, `EventCalendar` non porté.

**Serveur**
- **S0** : `GET …/invitations?page=` invalide : 400 `INVALID_FIELD` ; champs en plus par `InvitationRefusal` ; `SALE_CHECK_FAILED` sans `category_id` ; masque de la liste tiré du transfert sans expéditeur, sinon du compte ; trigger d'échéance gardé par `IS DISTINCT FROM` ; `user_role` : `PARTENAIRE` pour le propriétaire, `ADMIN` pour tout autre, SUPERADMIN compris.
- **S1** : `GET /api/events` par `apiFailure`, message unique et `CATALOG_UNAVAILABLE` ; `no-store` ajouté ; majuscules avant le contrôle de longueur ; `tous` écarté pour `city` et `category`, pas pour `q`.
- **S2** : email technique réécrit si l'email d'authentification est technique **ou** si `users.email` est NULL ; `compensateAuthIdentity` à trois modes ; codes hors contrat `FILE_REQUIRED`, `SMS_SEND_FAILED` ; toute erreur sharp donne 400 `UNSUPPORTED_FORMAT` ; page bornée à 9 chiffres ; un Bearer valide sans `session_id` ne retombe pas sur les cookies.
- **S3** : `REVOKE` et `GRANT` réaffirmés après chaque recopie ; `getEventById` réutilise `partnerOf` ; compensation `deleteUser` aussi sur l'échec de `grantUserRoles` ; `admin/users` PATCH : identifiant mal formé reste 404 ; permissions et activités dédoublonnées.
- **S4** : `CASH_COLLECT_PER_SCANNER_MIN` retirée dans `fix(9.4-A16s)` ; toute la chaîne `financial-calculator` part, `calculateHallFinancials` et `calculateWithdrawal` comprises ; ligne historique `cash_required` rejouée : incident technique, jamais une entrée ; `amount_due` reste au rejeu de `ticket_scan`.

**Écrans**
- **E0** : onglet après Ventes ; catégories complètes ou inactives listées et désactivées ; confirmation aux numéros masqués ; coupure réseau : « Envoi non confirmé », aucune relance automatique ; catégorie et quantité gardées après un envoi.
- **E1** : villes de « Près de chez vous » depuis `cities` de l'accueil ; pas d'option « effacer ma ville » ; section absente sans ville ni catalogue ; défilement par section sur mobile ; connecté sans ville au profil, ville de l'appareil pour l'affichage seulement.
- **E2** : Mes paiements hors `DataList` ; adresse technique jamais affichée ; « Supprimer la photo » par `ConfirmDialog` ; initiales si l'image ne se charge pas ; numéro non répété ; retour de `/paiement/[id]` à la page 1.
- **E3** : sur 403, la page entière laisse place au refus ; deux rôles nommés, « Aujourd'hui : » et « Rôle à l'action » ; colonne « Rôle à l'action » brute, exigée par `admin-audit:287`.
- **E4** : prop `children` retirée de l'overlay et du panneau ; `sendWithRetry` sans méthode ; branche 409 gardée, peut-être morte ; « Encaissement en espèces bloqué » reste ; grille des entrées 2 puis 3 colonnes.
- **Correcteur de la relecture** : voir section 3 ; correctif de la barre latérale écrit puis retiré pour 22 octets de budget.

**Documentation et seed**
- **D1** : contrôle A27 porté avant `db push` ; comportement réel des SMS documenté (11.3) ; section 8.15 ajoutée.
- **D2** : voir section 9 ; renforcement PO3, PO4, PO10 dans `recette-matrice` ; `S/d2/tests-index.mjs` indexe un `test(<identifiant>, …)` en boucle.
- **F** : pas de `missingLot9Schema` au contrôle préalable du seed ; aucune donnée de démonstration ajoutée.

---

---

## 18. Points ouverts

Hors périmètre ou non corrigés. Chaque point dit d'où il vient. Rien ici n'est un défaut caché : tous sont nommés dans le contrat, dans `docs/recette-billetterie.md` ou dans les réponses des agents, sauf mention.

### 18.1 Points ouverts du contrat (section 13)

| # | Point | État |
|---|---|---|
| 1 | AR1 : session volée, changement de numéro, retrait : seule garde, le SMS à l'ancien numéro. Blocage de 24 h proposé (D8), refusé | ouvert, décision |
| 2 | AR14 : partenaire EN_ATTENTE dans `/partner/*`. Aucun test ne fige le comportement ; `middleware.ts` ne cite pas ce statut (grep) | ouvert |
| 3 | `logAudit` n'échoue jamais : il capte l'erreur et l'écrit en console (`lib/admin/admin.service.ts:274,297`). A33 ne l'a corrigé que sur ses deux routes | ouvert |
| 4 | Message « délai de 48 h » pour une invitation expirée (`M/20261108000002:139`, recopie de `M/20261105000007:332`, L17), inexact : l'échéance est la fin de l'événement. Rare | ouvert |
| 5 | Compte au format `221…` : invitation en attente invisible pour lui. SUPPOSÉ, limite préexistante du transfert (D-inv risque 4) | SUPPOSÉ |
| 6 | `app/forgot-password/page.tsx:325` : sans `token_hash` dans la réponse, aucune session, le parcours continue ; `app/partner/products/new` : formulaire vide après une panne | ouvert |
| 7 | Jeton d'accès des sessions révoquées valable 1 h au plus (`lib/auth/sessions.ts:7`), même limite qu'au lot 1C. Les droits sont relus en base à chaque requête | ouvert, voulu |
| 8 | Numéro recyclé détenu par un compte dormant : 409 `PHONE_TAKEN`, support | ouvert |
| 9 | Pas d'écran d'administration pour `ACCOUNT_AUTH_DESYNC`. Procédure : section 8 du rapport | ouvert |
| 10 | Accents de ville et de recherche (« Thies » différent de « Thiès ») (L23) | ouvert |
| 11 | A30, A31 et lignes de la matrice restées partielles : 18.3 et 18.4 | listés |

### 18.2 Points ouverts du lot 8 : ce que devient chacun

| # | Point | État après le lot 9 |
|---|---|---|
| PO1 | Invitations : aucun émetteur en production | **Fermé** par 9.0 (consigne, Q4 tranchée) |
| PO2 | Paniers différents : deux paiements réussis gardés | ouvert, non traité |
| PO3 | `ticket_refund_request` : cycle de verrous | **Fermé** (`bf96b1d`, section 7) |
| PO4 | `event_update`, `ticket_category_guard` | **Fermé** (`31e6e61`, section 7) |
| PO5 | Confirmations d'un même événement sérialisées, à mesurer au test de charge | ouvert, lots 14 et 15 |
| PO6 | Initialisation en délai dépassé mais acceptée par SamirPay | SUPPOSÉ, non vérifié |
| PO7 | Cashout `ECHOUE` d'un paiement en double | ouvert, voulu |
| PO8 | Routes API non compressées | ouvert, à l'hébergement |
| PO9 | `is_visible` miroir tant que les tests de rejeu du lot 7 existent | ouvert |
| PO10 | Code mort | **Fermé** (`f1b4ed6`, `2423f39`) |
| PO11 | `EVENT_SOLD_OUT` non émis tant qu'une catégorie sans canal a du stock | ouvert |
| PO12 | Événement « sur place uniquement » : « Bientôt en vente » | ouvert |
| PO13 | Course résiduelle du renvoi | ouvert |
| PO14 | Solde partenaire d'un compte qui a des ventes simulées | voulu |
| PO15 | Taux N2 de 3 % : inatteignable sans parrainage prestataire | ouvert, question au client |
| PO16 | Cause des 766 s du run 93 | cause inconnue |
| PO17 | `next dev` au téléphone par le tunnel | SUPPOSÉ |

PO2, PO5 à PO9, PO11 à PO17 : repris du rapport du lot 8, le lot 9 ne les a pas traités et je ne les ai pas revérifiés.

### 18.3 Anomalies listées, non corrigées

Gravité et texte recopiés de `docs/recette-billetterie.md`, section 5. **A30 reste à corriger avant d'ouvrir le module salles.**

| # | Gravité | Cahier des charges | Anomalie |
|---|---|---|---|
| A5 | Élevée | §87, §88, §96, §97 | Parrainage prestataire absent : Q2 à trancher d’abord |
| A8 | Moyenne | §22, §144 | WhatsApp absent, sans décision écrite : Q1 |
| A9 | Moyenne | §106, §119, §132, §133, §162 | Historique du parrainage incomplet, ROI absent |
| A10 | Moyenne | §83, §105 | Virement bancaire non traité, réglage fermé par défaut |
| A12 | Moyenne | §1, §183 | Un client ne devient pas partenaire (D8, D63) |
| A18 | Faible | §157 | Pas d’écran de statistiques client |
| A19 | Faible | §189 | Guides client et administration absents, pages légales à prévoir |
| A22 | Faible | design | Pages d’administration non migrées, hors du contrôle de design |
| A30 | Élevée | §152, §155 | GET partner/halls/[id] sans contrôle de rôle ni de propriétaire : réservations et téléphone du partenaire lisibles par tout compte connecté quand le service est ouvert. Hors périmètre, service fermé aujourd’hui |
| A31 | Moyenne | §152 | GET partner/products/[id] sans contrôle de propriétaire. Hors périmètre, service fermé |
| A37 | Faible | design | Effet de 8.2 s : les barres fixes en bas des pages salles, menu et tables passent sous la navigation mobile. Hors périmètre, derrière interrupteurs |

Corrigées au lot 9, avec un test vert au run 113 selon la matrice : A6, A7, A16, A17, A21, A24 à A28, A32 à A34, A38 à A40, PO3, PO4, PO10 (section 10).

### 18.4 Lignes de la matrice restées partielles, questions au client

Reprises de la réponse de D2 :
- **§21** : A17 retirée, A9 reste (historique du parrainage).
- **§134** : champ « statut » absent du journal.
- **§152** : A30, A31.
- **§104** : transactions artificielles.
- **§190** : charge (lots 14 et 15), iPhone (aucun test possible).

Questions au client restant ouvertes (`docs/recette-billetterie.md`, section 6) : Q1 WhatsApp, Q2 parrainage prestataire, Q3 Wallet, Q5 personnalisation des taux, Q6 taux après passage en Ambassadeur, taux N2 (A5, PO15). Q4 est tranchée par la consigne du lot 9.

### 18.5 Points relevés par les agents, non corrigés

- **R3** : `public.users.email` n'a qu'un index sensible à la casse. La vérification préalable d'AM1 (`account_identity_taken`) compare en minuscules (`M/20261108000004:126-133`), mais une course entre cette lecture et l'écriture reste tranchée par l'index. Le cas n'est pas testé.
- **S2** : un email réel dans `auth.users` avec `users.email` NULL serait écrasé au changement de numéro : état déjà cassé, choix qui garde (v6).
- **S3** : `claimRegistrationUploads` (`lib/partners/documents.ts:91`) n'a plus d'appelant. Pas dans PO10, laissé en place.
- **E3 : un 403 de la route d'audit n'est pas toujours un manque de rôle.** Un compte non actif reçoit aussi 403 (`ACCOUNT_NOT_ACTIVE`) et verrait « Réservé au superadmin ». Message propre, motif inexact pour ce cas. Non traité.
- **E4** : branche 409 de `readScanResponse` peut-être morte ; commentaire périmé `components/scan/CameraQrScanner.tsx:52` ; sur mobile, la 3ᵉ carte des entrées est seule sur sa ligne.
- **tests-fin** : le `paused` de la page scanner n'a aucun test, ni dans `tests/` ni dans `e2e/`. Absence antérieure au lot.
- **E0** : changer de page dans l'historique affiche un squelette et perd le focus du bouton, à cause de `useServerData`.
- **E1** : `writeLocalCity` n'accepte qu'une chaîne, un visiteur change de ville mais ne l'efface pas.
- **E2** : la page de Mes paiements n'est pas dans l'URL : retour à la page 1 après `/paiement/[id]`.
- **D1** : `scripts/dev/seed-dev.core.ts:94` dit encore « appliquez les migrations 20261106 », sans effet.
- **F** : les règles (v) restent à vide en e2e, aucun parcours n'y change de photo ou de numéro. Leur preuve vient des suites `compte-*` de verify.
- **R0** : T3 : de `54fd8e1` à M5, `ticket_cash_checkin` n'était plus contrôlée par `r3`. Sans objet après M5.
- **Relecture des captures** : section 3 : 16 lignes laissées, liste des images pour un humain.

### 18.6 Ce qui n'est pas prouvé

- **Migrations du lot 9 sur event-village-dev et tout projet hébergé** : non appliquées, non exécutées. Écritures sur `auth.sessions` et `auth.refresh_tokens` : CI locale seulement (section 15).
- **Comportement de GoTrue hébergé** : AM1 et AM2 ont été constatés au run 110 sur l'instance locale de la CI. Le code ne suppose aucun code d'erreur (AM1), mais le projet hébergé n'a pas été interrogé.
- **Guide d'essai et cahier de recette** : relus contre le code, pas joués (section 16).
- **Second run à code identique** : parti après le commit de la matrice, résultat inconnu à l'écriture de cette partie. **`fede597` (T36) n'est pas couvert par le run 113.**
- **Dates des captures** : `--lang=fr-FR` n'a pas corrigé le format américain sous Linux (B.14). Le comportement d'un vrai navigateur français reste sur la liste des relectures humaines (section 3).
- **Photo de profil à l'écran** : aucune capture ne montre une vraie photo, seul l'état à initiales. Les suites `compte-photo` et `r27-avatars` prouvent la route et le stockage.
- **`sharp` sur l'hébergeur final** : prouvé en CI seulement (`next start` et suites `compte-photo`).
- **Budget JS** : `HomeDiscovery` et `AccessNotice` ne sont plus comptés par la mesure, chargés après.
