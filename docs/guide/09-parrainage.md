# 09 — Parrainage : code et lien, filleuls, niveaux, taux, commissions, retrait, statut Ambassadeur

> Guide complet de l'application Event Village, état de `main` à `0889df6` (lots 1 à 9 ter). Source de vérité : le code.
> Chaque fait porte sa preuve `fichier:ligne` (chemins relatifs au dépôt ; `M/` = `supabase/migrations/`).
> Ce qui n'a pas pu être établi est marqué **NON VÉRIFIÉ**. Données d'exemple fictives : marraine « Fatou Diop »
> (numéro `77 000 00 00`), filleul « Moussa Ndiaye », événement « Concert Test ».
> Les règles d'argent communes (grand livre, retraits, versements, reprise par l'administration) sont dans
> `03-partenaire.md` (03.19 à 03.21) et `08-argent.md` ; le calcul du revenu net d'Event Village sur un achat dans
> `06-achat-paiement.md` ; les messages dans `10-notifications.md`. Les écarts relevés sont listés dans `15-constats.md`.

## Sommaire

| N° | Scénario |
|---|---|
| 09.1 | Où trouver son code et son lien de parrainage ; leur forme |
| 09.2 | Un filleul s'inscrit avec le lien ou le code |
| 09.3 | Filleuls et niveaux (N1, N2) : qui compte, qui rapporte |
| 09.4 | Taux et durées : la grille, fixée à l'inscription du filleul |
| 09.5 | Le filleul achète : calcul d'une commission |
| 09.6 | Commission en attente, puis disponible (fin de l'événement + 7 jours) |
| 09.7 | Commissions gelées quand l'événement est suspendu |
| 09.8 | Achat remboursé : commission annulée, recalculée ou régularisée |
| 09.9 | Le Portefeuille de parrainage : ce qu'il montre |
| 09.10 | Retirer ses commissions |
| 09.11 | Statut Ambassadeur : promotion et retour au statut standard |
| 09.12 | L'écran d'administration « Gestion des Ambassadeurs & Parrainage » |
| 09.13 | Messages liés au parrainage |
| 09.14 | Ce qui n'existe pas encore (renvoyé au lot 13) |

Règles communes à tout le fichier :

- **Compte de parrainage.** Chaque compte a un compte d'argent « PARRAINAGE » dans le grand livre, distinct du compte
  « ORGANISATEUR » d'une partenaire (`M/20261101000006_lot3_commissions.sql:1-19`,
  `M/20261110000007_lot9ter_evenements.sql:154-195`). Une partenaire peut donc aussi parrainer : son code existe comme
  pour tout compte (09.1).
- **Vocabulaire à l'écran.** « Génération 1 (filleuls directs) » = niveau N1 ; « Génération 2 (sous-filleuls) » = niveau
  N2 ; les codes N1 et N2 ne sont jamais montrés au client (`app/wallet/page.tsx:300-304`, `:1028`, `:1035`).

---

## 09.1 Où trouver son code et son lien de parrainage ; leur forme

1. **Qui, où.** Tout compte connecté. Menu « Portefeuille » (`/wallet`, `components/layout/AppLayout.tsx:134`) ou, depuis
   « Mon profil », la carte « Portefeuille de parrainage » : « Vos gains de parrainage et vos demandes de retrait »
   (`app/profile/page.tsx:172-176`). Bloc « Votre lien de parrainage » : « Partagez ce lien : vous touchez une commission
   sur les achats en ligne de vos filleuls. », bouton « Copier mon lien » (`app/wallet/page.tsx:996-1025`).
2. **Ce qu'il saisit.** Rien. « Copier mon lien » copie le lien ; toast « Lien de parrainage copié. », le bouton devient
   « Lien copié » 2 secondes ; si la copie échoue : « Copie impossible : sélectionnez le lien et copiez-le manuellement. »
   (`app/wallet/page.tsx:453-464`, `:1021-1024`).
3. **Ce que fait le système.**
   - Le **code** est créé automatiquement à la création du compte : « EV- » suivi des **6 derniers chiffres du numéro**
     (ou, sans numéro, des 6 premiers caractères de l'identifiant), avec un chiffre ajouté en cas de doublon : par exemple
     `EV-000000` pour le `77 000 00 00`, puis `EV-0000001` pour un second compte aux mêmes chiffres
     (`M/0011_referral_codes.sql:17-62`). Le code révèle donc les 6 derniers chiffres du numéro (constat W3-15).
   - Le **lien** est `{adresse de l'application}/register?ref={code}`, par exemple
     `https://app.exemple.sn/register?ref=EV-000000` (`app/api/referrals/my-stats/route.ts:119-125`). Le code est lu dans
     la base, jamais recalculé (`:48-52`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien.
6. **Refus.** Page non connectée : renvoi vers la connexion (`middleware.ts:171-185`). Lecture impossible : « Vos
   informations de parrainage n’ont pas pu être chargées. » et « Réessayer », ou « Connexion impossible : vos
   informations de parrainage n’ont pas pu être chargées. » (`app/wallet/page.tsx:418-432`, `:1007-1012`) ; serveur :
   « Statistiques de parrainage momentanément indisponibles. » (`app/api/referrals/my-stats/route.ts:147-149`).
7. **Preuves et essai.** Fichiers cités. Recette : essai 49 (`docs/recette-billetterie.md:1153-1170`).

## 09.2 Un filleul s'inscrit avec le lien ou le code

1. **Qui, où.** Visiteur. En ouvrant le lien, `/register?ref={code}` préremplit le code (en capitales, 64 caractères au
   plus) et ouvre « Plus d’options : code de parrainage » (`app/register/page.tsx:41`, `:144-154`). Champ « Code de
   parrainage (facultatif) », exemple affiché « ex : EV-AMB-1234 » (`:566-592`). Déroulé complet de l'inscription :
   `02-comptes.md` (02.1 et 02.2).
2. **Ce qu'il saisit.** Le code, facultatif, 64 caractères au plus (`lib/validations/auth.ts:155`). L'exemple « EV-AMB-1234 »
   ne ressemble pas aux vrais codes (`EV-` + 6 chiffres) : constat W3-15.
3. **Ce que fait le système.**
   - Un code inconnu est refusé **avant** la consommation du code SMS (le même code SMS reste utilisable)
     (`app/api/auth/register/route.ts:134-147`).
   - Le compte créé, la relation de parrainage est enregistrée : type « client vers client », parrain = propriétaire du
     code, statut du parrain au moment de l'inscription, **taux N1 et N2 et durée recopiés** depuis la grille de ce statut,
     date de fin = aujourd'hui + durée (`app/api/auth/register/route.ts:19-63`, `:214-220`).
   - Un filleul n'a qu'**un seul** parrain, pour toujours : la relation ne se crée qu'à l'inscription, aucun écran ne
     permet d'en ajouter ou d'en changer après (`M/0001_initial_schema.sql:594`, `M/20261101000006_lot3_commissions.sql:17-18`,
     `:57-58`). Un parrainage en boucle est refusé par la base (`M/0011_referral_codes.sql:76-105`).
   - Si l'enregistrement de la relation échoue, l'inscription réussit quand même, **sans** parrainage, et l'erreur reste au
     journal du serveur (`app/api/auth/register/route.ts:214-220`). Même chose, sans message, si la grille du statut du
     parrain n'a pas de ligne active (`:44-47`).
   - L'inscription **partenaire** n'a pas de champ de parrainage : une partenaire ne peut pas être filleule
     (`app/partner/register/page.tsx:35-38`).
4. **Messages envoyés.** Aucun au parrain ni au filleul pour le parrainage (09.13).
5. **Ce que voient les autres rôles.** Le parrain voit son compteur « Génération 1 » augmenter au rechargement de son
   Portefeuille (09.3).
6. **Refus.** Code inconnu : « Code de parrainage inconnu. Vérifiez-le ou laissez le champ vide. », sous le champ
   (`app/api/auth/register/route.ts:141-146`, `app/register/page.tsx:189-193`). Code de plus de 64 caractères : « Code de
   parrainage invalide » (`lib/validations/auth.ts:155`).
7. **Preuves et essai.** Fichiers cités. Recette : essai 49 (`docs/recette-billetterie.md:1153-1170`).

## 09.3 Filleuls et niveaux (N1, N2) : qui compte, qui rapporte

1. **Qui, où.** Parrain, `/wallet`, cartes « Génération 1 (filleuls directs) » et « Génération 2 (sous-filleuls) » :
   taux et « {n} filleul » / « {n} filleuls » (`app/wallet/page.tsx:1026-1040`).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.**
   - **N1** = les comptes inscrits avec son code ; **N2** = les filleuls de ses filleuls. Il n'y a pas de niveau 3
     (`app/api/referrals/my-stats/route.ts:72-91`, `M/20261109000007_lot9bis_versements.sql:840-893`).
   - Les compteurs incluent **toutes** les relations, y compris celles arrivées à leur date de fin ou inactives, qui ne
     rapportent plus rien (`app/api/referrals/my-stats/route.ts:73-90` ; constat W3-11).
   - Une commission n'est due que si la relation est **active et non expirée** au moment du paiement : pour N1 la
     relation filleul → parrain, pour N2 aussi la relation parrain → grand-parrain
     (`M/20261109000007_lot9bis_versements.sql:840-845`, `:872-876`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien : le filleul ne voit pas qui est son parrain (NON VÉRIFIÉ : aucun écran
   client ne lit la relation, recherche de `referral_relationships` dans `app/` : seules l'inscription et ce compteur).
6. **Refus.** Sans objet.
7. **Preuves et essai.** Fichiers cités. Recette : essai 49.

## 09.4 Taux et durées : la grille, fixée à l'inscription du filleul

1. **Qui, où.** Lu par le parrain dans `/wallet` (09.3) et par l'administration dans `/admin/referral` (09.12).
2. **Ce qu'il saisit.** Rien : **aucun écran ne permet de modifier la grille** ; l'administration affiche « La
   personnalisation des taux n’est pas disponible pour le moment. » (`app/admin/referral/page.tsx:232-233`).
3. **Ce que fait le système.** Grille en base (dernière écriture : lot 3), lignes actives :

   | Statut du parrain | Type | N1 | N2 | Durée de la relation | Utilisée aujourd'hui | Preuve |
   |---|---|---|---|---|---|---|
   | Standard | client vers client | 5 % | 2 % | 12 mois | oui | `M/20261101000006_lot3_commissions.sql:48-49` |
   | Ambassadeur | client vers client | 7 % | 2 % | 24 mois | oui | `:51` |
   | Standard | client vers prestataire | 7 % | 2 % | 24 mois | non (aucune relation de ce type n’est créée) | `:50` |
   | Ambassadeur | client vers prestataire | 10 % | 3 % | 36 mois | non | `:52` |

   Les taux et la durée sont **recopiés sur la relation** quand le filleul s'inscrit : ils ne changent plus ensuite, même
   si le parrain devient Ambassadeur ou redevient Standard (pas de rétroactivité) (`app/api/auth/register/route.ts:51-61`,
   `docs/recette-billetterie.md:137`). Le taux N2 appliqué est celui recopié sur la relation du **filleul direct**
   (statut de son parrain à son inscription), pas celui du grand-parrain (`M/20261109000007_lot9bis_versements.sql:878`).
   Le Portefeuille affiche, lui, les taux **actuels** du statut du parrain (`app/api/referrals/my-stats/route.ts:54-70`) :
   pour un ancien filleul, le taux réellement appliqué peut différer de celui affiché (constat W3-11). Avec la grille
   actuelle, seul le passage Standard ↔ Ambassadeur change le N1 affiché (5 % ↔ 7 %).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien.
6. **Refus.** Sans objet.
7. **Preuves et essai.** Fichiers cités. Recette : essai 51 (`docs/recette-billetterie.md:1189-1201`).

## 09.5 Le filleul achète : calcul d'une commission

1. **Qui, où.** Le filleul paie en ligne (Wave ou Orange Money) un achat sur Event Village (voir 06).
2. **Ce qu'il saisit.** Rien de propre au parrainage.
3. **Ce que fait le système.** Au passage du paiement à « réussi », la commission est calculée une fois
   (`M/0002_functions.sql:225-235`, `M/20261109000007_lot9bis_versements.sql:813-899`) :
   - **Base** : le **revenu net d'Event Village** sur ce paiement (et non le prix du billet). Pas de commission si le
     paiement n'est pas un paiement en ligne de la plateforme (vente au guichet en espèces) ou si ce revenu net est nul
     (billet gratuit) (`:834-839`).
   - **N1** = base × taux N1 de la relation, arrondi au centime, plafonné à la base ; **N2** = base × taux N2, plafonné à
     ce qui reste de la base après N1 (`:854-856`, `:878-879`).
   - Chaque commission est créée « En attente » et inscrite au crédit du compte de parrainage du bénéficiaire, avec sa
     date de disponibilité (09.6) ; une même commission n'est jamais créée deux fois (`:857-870`, `:880-893`).
   - **Exemple fictif** (le revenu net réel d'un achat se calcule comme dans 06) : si l'achat de Moussa laisse 500 F de
     revenu net à Event Village, Fatou (Standard, N1 5 %) reçoit 25 F ; le parrain de Fatou, s'il existe et que la
     relation est active, reçoit 500 × 2 % = 10 F. Avec un minimum de retrait de 5 000 F (09.10), il faut beaucoup
     d'achats pour pouvoir retirer.
4. **Messages envoyés.** Aucun (09.13).
5. **Ce que voient les autres rôles.** Le parrain voit, au rechargement de son Portefeuille, la ligne dans « Dernières
   commissions » (« Commission sur un filleul direct · En attente », « + 25 F CFA ») et le montant dans « En attente »
   (`app/wallet/page.tsx:1042-1070`, `:636-646`).
6. **Refus.** Sans objet.
7. **Preuves et essai.** Fichiers cités. Recette : essai 50 (`docs/recette-billetterie.md:1172-1187`).

## 09.6 Commission en attente, puis disponible (fin de l'événement + 7 jours)

1. **Qui, où.** Parrain, `/wallet`.
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.**
   - Date de disponibilité d'une commission sur un **billet** : **la fin de l'événement + 7 jours** (et jamais avant la
     confirmation + 7 jours) ; pour un paiement sans événement : confirmation + 7 jours
     (`M/20261109000007_lot9bis_versements.sql:846-852`). Le délai est le réglage « délai de disponibilité des commissions
     de parrainage », **7 jours** par défaut, de 7 à 14 (`M/20261101000002_lot3_reglages.sql:72`,
     `M/20261110000002_lot9ter_reglages.sql:86`). La fin d'un événement sans date de fin est son début + 6 h
     (`M/20261109000008_lot9bis_cycle.sql:476-488`).
   - L'argent devient retirable **à cette date** (le grand livre la porte) ; le statut affiché « Disponible » suit à la
     prochaine passe de la tâche horaire des commissions (`M/20261101000006_lot3_commissions.sql:131-146`,
     `app/api/cron/referral-commissions/route.ts:7-22` ; fréquence : voir 12).
   - **Événement déplacé** : si la fin recule, les commissions encore non retirées de cet événement sont repoussées à la
     nouvelle fin + 7 jours et repassent « En attente » si besoin ; elles ne sont **jamais avancées** ; chaque
     déplacement est journalisé (`REFERRAL_COMMISSION_DEFERRED`) (`M/20261109000007_lot9bis_versements.sql:901-981`).
   - À l'écran : « En attente » avec « Prochaine disponibilité : {date}. » ou « Chaque commission devient disponible après
     son délai de validation. » ; dans l'historique, « , disponible le {date} » (`app/wallet/page.tsx:636-646`, `:1146-1151`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien.
6. **Refus.** Sans objet.
7. **Preuves et essai.** Fichiers cités. Recette : essai 50 (« Disponible après le délai, qui est de 7 jours au moins »).

## 09.7 Commissions gelées quand l'événement est suspendu

1. **Qui, où.** Parrain, `/wallet`, quand un événement pour lequel ses filleuls ont acheté est `SUSPENDU`.
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** Le **gel** est calculé à chaque lecture : somme des commissions **déjà disponibles** dont
   l'événement (celui de l'écriture, à défaut celui du paiement) est suspendu ; rien n'est écrit, le dégel est immédiat
   à la reprise (`M/20261110000005_lot9ter_argent.sql:255-306`). Le « Disponible au retrait » est diminué du gel
   (`M/20261110000007_lot9ter_evenements.sql:192`). À l'écran, au-dessus du disponible : « Commissions gelées :
   {montant}. » et « Un événement pour lequel vos filleuls ont acheté des billets est suspendu : ces commissions ne sont
   pas retirables tant qu’il l’est. » (`app/wallet/page.tsx:617-621`).
   **En pratique, ce bandeau n'apparaît presque jamais** : une commission sur billet n'est disponible que 7 jours après
   la fin de l'événement (09.6) ; à ce moment l'événement est passé « Terminé » par la tâche de fin, et un événement
   terminé ne peut plus être suspendu (`M/20261110000007_lot9ter_evenements.sql:80-112` ; seule `PUBLIE → SUSPENDU`
   existe, voir 04). Les commissions encore « En attente » d'un événement suspendu ne sont pas comptées comme gelées (elles
   ne sont pas encore retirables). La préparation de l'essai 87 (« des commissions disponibles … sur un même événement
   publié ») n'est donc atteignable que si la tâche de fin des événements n'a pas tourné : constat W3-05.
4. **Messages envoyés.** Aucun au parrain. (Les porteurs et la partenaire sont prévenus de la suspension : voir 04.)
5. **Ce que voient les autres rôles.** Rien.
6. **Refus.** Retrait d'un montant touché par le gel : « Une partie de vos commissions est gelée : un événement pour
   lequel vos filleuls ont acheté des billets est suspendu. » (`M/20261110000005_lot9ter_argent.sql:374-381`).
7. **Preuves et essai.** Fichiers cités. Recette : essai 87 (`docs/recette-billetterie.md:1865-1880`).

## 09.8 Achat remboursé : commission annulée, recalculée ou régularisée

1. **Qui, où.** Déclenché par tout remboursement de l'achat du filleul (billet remboursé par la partenaire, annulation
   d'événement, report, voir 08).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.** Pour chaque commission de cet achat, N1 d'abord (`M/20261106000004_lot8_commissions.sql:123-193`) :
   - **jamais retirée** (en attente ou disponible) : elle passe « Annulée » (motif interne « REMBOURSEMENT », ou
     « RECALCUL_PRORATA » si le remboursement est partiel) et son montant est débité du compte de parrainage ; en cas de
     remboursement partiel, une nouvelle commission au prorata la remplace, avec la même date de disponibilité
     (`:155-178`) ;
   - **déjà retirée, même en partie** : une **régularisation** négative est débitée tout de suite ; si le solde ne suffit
     pas, une **créance** est ouverte et sera prise sur les gains futurs (`:179-189`, `M/20261101000006_lot3_commissions.sql:8-12`).
   - Le prorata ne peut jamais dépasser ce qui reste du revenu net d'Event Village sur l'achat (`M/20261106000004_lot8_commissions.sql:139-155`).
   À l'écran, l'historique affiche « Commission annulée (achat remboursé) » ou « Régularisation (achat remboursé) », et la
   carte « À compenser » : « Commission déjà versée sur un achat remboursé : déduite de vos prochains gains. »
   (`app/wallet/page.tsx:281-290`, `:654-662`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Le parrain | — | — | — | Aucun avis d'annulation ou de régularisation |
   | Administrateurs avec « Consulter les paiements » (`payments.read`) | Cloche, email | Indispensable (`ADMIN_FINANCE_DEBT`) | File d'envoi, seulement si une créance s'ouvre | « Créance sur un compte » ; « Un débit de {montant} sur le compte de parrainage dépasse le solde disponible : une créance de {créance} sera compensée sur les gains futurs. » (`lib/notifications/catalog.ts:1237-1248`, `M/20261103000006_lot6_pros_admin.sql:515-535`) |

5. **Ce que voient les autres rôles.** Rien d'autre.
6. **Refus.** Sans objet.
7. **Preuves et essai.** Fichiers cités. Recette : aucun essai dédié.

## 09.9 Le Portefeuille de parrainage : ce qu'il montre

1. **Qui, où.** Tout compte actif, `/wallet`. Titre « Portefeuille de parrainage », texte « Vos commissions de parrainage
   deviennent disponibles après leur délai de validation ; retirez-les par Wave ou Orange Money. »
   (`app/wallet/page.tsx:592-595`).
2. **Ce qu'il saisit.** Rien (le retrait : 09.10).
3. **Ce que fait le système.** Lit le compte de parrainage (`GET /api/finance/balance?account=PARRAINAGE`) et les
   informations de parrainage (`GET /api/referrals/my-stats`) (`app/wallet/page.tsx:388-433`). Blocs, dans l'ordre :

   | Bloc | Contenu exact | Preuve |
   |---|---|---|
   | Bandeau du gel (si positif) | « Commissions gelées : {montant}. » (09.7) | `app/wallet/page.tsx:617-621` |
   | Carte principale | « Disponible au retrait », montant, badge « Ambassadeur » ou « Client standard », « Commissions validées, retirables dès maintenant. » | `:622-634` |
   | « En attente » | montant ; « Prochaine disponibilité : {date}. » ou « Chaque commission devient disponible après son délai de validation. » | `:636-646` |
   | « Retraits en cours » | montant brut réservé ; « Montant réservé sur votre solde, frais compris, pendant l’envoi vers Wave ou Orange Money. » | `:647-653`, `M/20261110000007_lot9ter_evenements.sql:177-179` |
   | « À compenser » | créance ; texte de 09.8 ou « Aucune somme à compenser. » | `:654-662` |
   | « Retirer mes commissions » | formulaire (09.10) | `:666-` |
   | « Votre lien de parrainage » | lien, « Copier mon lien », cartes N1 et N2 (09.3), « Dernières commissions » : 10 dernières lignes, « Commission sur un filleul direct » ou « Commission sur un filleul indirect » · « En attente », « Disponible », « Versée » ou « Annulée », date, « + {montant} » | `:996-1070`, `app/api/referrals/my-stats/route.ts:93-99`, `:144-145` |
   | « Mes retraits » | statut (« En attente », « En cours », « Versé », « Refusé, montant rendu », « Annulé », « Retardé »), opérateur, numéro masqué, dates, brut, « Versé : {net} · frais : {frais} » ; vide : « Aucun retrait », « Vous n’avez pas encore retiré de commissions. » | `:292-299`, `:1075-1114` |
   | « Historique du compte » | « Commission de parrainage », « Commission annulée (achat remboursé) », « Régularisation (achat remboursé) », « Retrait demandé », « Retrait refusé : montant rendu », « Compensation d’une créance » ; vide : « Aucune opération », « Partagez votre lien : les commissions de vos filleuls apparaîtront ici. » | `:281-290`, `:1116-1160` |

   « Dernières commissions » affiche « + » devant chaque ligne, y compris une commission annulée et une régularisation
   négative (« + -… ») (`app/wallet/page.tsx:1065` ; constat W3-06).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien.
6. **Refus.** Compte non actif : « Votre compte n'est pas actif. Contactez le support. » ; panne : « Solde momentanément
   indisponible. » ; écran : « Solde indisponible » avec « Réessayer », « Le solde n’a pas pu être chargé (erreur
   {code}). », « Réponse inattendue du serveur : le solde n’a pas pu être affiché. », « Connexion impossible : vérifiez
   votre réseau puis réessayez. » (`app/api/finance/balance/route.ts:14-33`, `app/wallet/page.tsx:388-413`, `:598-599`).
7. **Preuves et essai.** Fichiers cités. Recette : essais 49, 50, 87.

## 09.10 Retirer ses commissions

1. **Qui, où.** Tout compte actif ayant un disponible, `/wallet`, bloc « Retirer mes commissions » : « Wave ou Orange
   Money. Le minimum, les frais et le montant que vous recevrez sont affichés avant l’envoi du code. » ; étapes
   « Demande », « Code SMS », « Suivi » (`app/wallet/page.tsx:664-698`).
2. **Ce qu'il saisit.** Mêmes champs, aides et erreurs que pour une partenaire (03.19) : « Recevoir sur », « Numéro {…}
   qui reçoit le retrait » (prérempli avec le numéro du compte), « Montant à retirer (F CFA) » (exemple `Ex : 10000`),
   ligne de devis « Minimum de retrait : {minimum}. Frais : {taux} ({frais}). Vous recevrez {net}. »
   (`app/wallet/page.tsx:441-451`, `:707-834`).
3. **Ce que fait le système.** Même chaîne que 03.19 avec le compte `PARRAINAGE` : devis avant tout SMS, code au numéro
   du compte, confirmation avec clé anti-doublon, brut réservé tout de suite, versement Mobile Money du net
   (`app/wallet/page.tsx:470-554`, `app/api/withdrawals/otp/route.ts:75-134`, `app/api/withdrawals/request/route.ts:43-117`).
   Différences avec la partenaire : aucune fiche validée n'est exigée (`M/20261110000005_lot9ter_argent.sql:352-355`) ; les
   commissions retirées sont imputées **de la plus ancienne à la plus récente** et passent « Versée » quand elles sont
   entièrement couvertes ; si l'opérateur refuse, cette imputation est défaite (`M/20261109000006_lot9bis_argent.sql:746-748`,
   `M/20261101000006_lot3_commissions.sql:214-276`). Minimum **5 000 F**, frais **1 %** arrondis au franc supérieur, payés
   par le parrain (`M/20261101000002_lot3_reglages.sql:69-70`). Les commissions sont au centime, le retrait au franc : le
   disponible est arrondi au franc inférieur (`M/20261110000007_lot9ter_evenements.sql:192`).
4. **Messages envoyés.** Code SMS `OTP_WITHDRAWAL` et avis `WITHDRAWAL_PAID`, `WITHDRAWAL_REJECTED`,
   `WITHDRAWAL_UNCERTAIN`, `WITHDRAWAL_DELAYED` : mêmes textes que 03.19 et 03.21 ; leur lien mène à `/wallet`
   (`lib/notifications/catalog.ts:388`).
5. **Ce que voient les autres rôles.** L'administration : voir 08.
6. **Refus.** Ceux de 03.20, avec pour le gel : « Une partie de vos commissions est gelée : un événement pour lequel vos
   filleuls ont acheté des billets est suspendu. » (`M/20261110000005_lot9ter_argent.sql:377-380`). Le verrou de 24 h après
   un changement de numéro s'applique aussi au compte de parrainage (`:383-392`).
7. **Preuves et essai.** Fichiers cités. Recette : aucun essai dédié (retrait partenaire : essais 42, 43).

## 09.11 Statut Ambassadeur : promotion et retour au statut standard

1. **Qui, où.** **SUPERADMIN seul** (un ADMIN, même avec « Gérer les comptes », est refusé). `/admin/referral`, ligne
   d'un compte, bouton « Promouvoir Ambassadeur ⭐ » ou « Rétrograder » (`app/admin/referral/page.tsx:344-357`,
   `app/api/admin/users/route.ts:284-302`).
2. **Ce qu'il saisit.** Rien : un clic bascule le statut, **sans confirmation ni motif** (`app/admin/referral/page.tsx:120-151`).
3. **Ce que fait le système.** Écrit le statut de parrainage du compte (`STANDARD` ou `AMBASSADEUR`) et le journal
   `UPDATE_USER` avec l'ancienne valeur (`app/api/admin/users/route.ts:415-458`). Effets :
   - les **nouveaux** filleuls de ce compte auront les taux et la durée Ambassadeur (09.4) ; les filleuls déjà inscrits
     gardent les leurs (pas de rétroactivité) ;
   - le compte voit le badge « Ambassadeur » dans son Portefeuille, « Ambassadeur Event Village » sur « Mon profil », et
     « Ambassadeur » sous son nom dans le menu (`app/wallet/page.tsx:628`, `app/profile/page.tsx:159`, `:220`,
     `components/layout/AppLayout.tsx:121`, `:321`) ;
   - l'administration peut cibler les ambassadeurs dans une campagne (« Ambassadeurs seulement ») et les compte dans ses
     indicateurs (`app/admin/communications/page.tsx:45`, `app/api/admin/metrics/route.ts:67`) ; voir 11.
   Toasts : « Le statut Ambassadeur a bien été attribué à {prénom} {nom}. » ou « Le statut Ambassadeur a été retiré pour
   {prénom} {nom}. » — ex. « Le statut Ambassadeur a bien été attribué à Fatou Diop. » (`app/admin/referral/page.tsx:139-143`).
4. **Messages envoyés.** **Aucun** à la personne promue ou rétrogradée (aucun type de notification de parrainage :
   `lib/notifications/catalog.ts`, recherche de « referral », « ambassad », « commission »).
5. **Ce que voient les autres rôles.** La personne voit son badge au prochain chargement.
6. **Refus.** ADMIN : « Seul un SUPERADMIN peut modifier le statut ambassadeur. » ; ADMIN sans « Gérer les comptes » :
   « Action non autorisée : votre compte n’a pas la permission « Gérer les comptes ». » ; affichés en toast, repli « Erreur
   lors de la mise à jour. » ou « Échec de la mise à jour. » (`app/api/admin/users/route.ts:264-265`, `:288-293`,
   `lib/admin/permission-labels.ts:10`, `:33-35`, `app/admin/referral/page.tsx:136-148`).
7. **Preuves et essai.** Fichiers cités. Recette : essai 51 (`docs/recette-billetterie.md:1189-1201`).

## 09.12 L'écran d'administration « Gestion des Ambassadeurs & Parrainage »

1. **Qui, où.** Tout ADMIN et SUPERADMIN : le menu affiche « Parrainage et ambassadeurs » (espaces pro) et « Parrainage »
   (groupe « Engagement ») à tout administrateur, sans condition de permission (`components/layout/AppLayout.tsx:195`,
   `:226-232`) ; raccourci depuis le tableau de bord d'administration (`app/admin/dashboard/page.tsx:644`). URL
   `/admin/referral`. En-tête « Console Superadmin HQ », titre « Gestion des Ambassadeurs & Parrainage », bouton
   « Actualiser » (`app/admin/referral/page.tsx:159-187`).
2. **Ce qu'il saisit.** Recherche « Rechercher par nom, email, téléphone... » et filtre « Tous », « Ambassadeurs »,
   « Standard » (`app/admin/referral/page.tsx:248-288`).
3. **Ce que fait le système.**
   - Trois cartes : « Utilisateurs » (« {n} compte(s) standard »), « Ambassadeurs actifs » (« Taux ambassadeur : N1 {x} %,
     N2 {y} % », ou « Taux ambassadeur non configuré », « Taux ambassadeur indisponible ») et « Durée du parrainage »
     (« {n} mois », « Compte standard ; {n} mois pour un ambassadeur ») ; ex. « Taux ambassadeur : N1 7 %, N2 2 % »,
     « 12 mois », « Compte standard ; 24 mois pour un ambassadeur » (`app/admin/referral/page.tsx:189-219`). La grille est
     lue en base, lignes client vers client (`app/api/admin/referral/config/route.ts:17-40`). Les deux compteurs comptent
     la **liste affichée** (après filtre et recherche), pas toute la plateforme (`app/admin/referral/page.tsx:153-154` ;
     constat W3-12).
   - Bandeau fixe « La personnalisation des taux n’est pas disponible pour le moment. » (`:232-233`).
   - « Répertoire des Utilisateurs » : « Attribuez le statut Ambassadeur pour débloquer les commissions N1/N2 majorées. » ;
     chaque ligne : prénom et nom, rôle en code (« CLIENT », « PARTENAIRE »…), badge « ⭐ Ambassadeur VIP » ou « Parrainage
     Standard », téléphone, email (« Non renseigné »), bouton (09.11) ; chargement « Chargement des utilisateurs
     réels... » ; vide « Aucun utilisateur trouvé. » (`:236-363`).
   - Aucune liste des commissions, des retraits de parrainage, des filleuls ni des gains par ambassadeur (renvoyé au lot 13,
     09.14).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien.
6. **Refus et cas limites.**
   - Lecture de la grille sans la permission « Gérer le parrainage » : bandeau « Taux et durées du parrainage
     indisponibles » avec « Action non autorisée : votre compte n’a pas la permission « Gérer le parrainage ». » et
     « Réessayer » (`app/api/admin/referral/config/route.ts:18`, `app/admin/referral/page.tsx:78-94`, `:221-230`).
   - Liste des comptes sans « Consulter les comptes » : la page affiche « Aucun utilisateur trouvé. » sans dire pourquoi
     (l'erreur est ignorée) (`app/api/admin/users/route.ts:55`, `app/admin/referral/page.tsx:101-114` ; constat W3-12).
   - La bascule : 09.11.
7. **Preuves et essai.** Fichiers cités. Recette : essais 51 et 53 (`docs/recette-billetterie.md:1189-1201`, `:1224`).

## 09.13 Messages liés au parrainage

Aucun type de notification n'est propre au parrainage (`lib/notifications/catalog.ts`, `lib/notifications/catalog-types.ts:70`) :

| Événement | Message |
|---|---|
| Un filleul s'inscrit avec le code | aucun |
| Une commission est créée, devient disponible, est gelée, annulée ou régularisée | aucun au parrain (créance : `ADMIN_FINANCE_DEBT` aux administrateurs, 09.8) |
| Passage Ambassadeur ou retour Standard | aucun |
| Retrait de commissions | `OTP_WITHDRAWAL`, puis `WITHDRAWAL_PAID`, `WITHDRAWAL_REJECTED`, `WITHDRAWAL_UNCERTAIN`, `WITHDRAWAL_DELAYED` (textes en 03.19 et 03.21), lien vers `/wallet` |

## 09.14 Ce qui n'existe pas encore (renvoyé au lot 13)

| Point | État dans le code | Preuve |
|---|---|---|
| Parrainage de prestataires (client vers prestataire, N1 7 % ou 10 %, N2 2 % ou 3 %) | lignes de grille présentes, jamais utilisées : aucune relation de ce type n'est créée ; l'inscription partenaire n'a pas de champ de parrainage | `M/20261101000006_lot3_commissions.sql:50`, `:52`, `app/api/auth/register/route.ts:24-63`, `docs/recette-billetterie.md:136`, `:244` |
| Personnalisation des taux et durées par le SUPERADMIN, avec historique | absente ; mention « La personnalisation des taux n’est pas disponible pour le moment. » | `app/admin/referral/page.tsx:232-233`, `docs/recette-billetterie.md:137`, `:295` |
| Suivi admin des commissions, des retraits de parrainage, des gains par ambassadeur | absent | `docs/recette-billetterie.md:163`, `docs/parcours-evenement-complet.md:4232` |
| Avis au parrain (nouveau filleul, commission, passage Ambassadeur) | absent | 09.13 |

Un « Wallet » au sens d'un porte-monnaie de paiement est hors périmètre ; le Portefeuille actuel ne sert qu'au parrainage
(`docs/lot9bis-rapport.md:2077`).
